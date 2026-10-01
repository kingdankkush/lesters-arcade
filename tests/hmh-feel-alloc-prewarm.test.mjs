// 2.1 HMH-FEEL item 5: the remaining per-frame allocations (upgrade guide
// §2.8) and the GPU texture prewarm (§2.9).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import v8 from 'node:v8';
import vm from 'node:vm';

import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { poolableSprites } from '../apps/hmh-reboot/src/world-production-art.mjs';
import { prewarmTexture, prewarmTextures } from '../apps/portal/src/feel/texture-prewarm.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');
const TICK = 1000 / 60;

test('step callbacks keep the snapshot order: an add during a tick runs next tick, a remove during a tick still finishes it', () => {
  const simulation = new DeterministicSimulation({ seed: 7 });
  simulation.start();
  const calls = [];
  let lateOff = null;
  let selfOff = null;
  const late = (step) => calls.push(`late:${step.tick}`);
  const second = (step) => calls.push(`second:${step.tick}`);
  simulation.onStep((step) => {
    calls.push(`first:${step.tick}`);
    if (step.tick === 1) lateOff = simulation.onStep(late);
    if (step.tick === 2) assert.equal(secondOff(), true, 'removing a live callback reports true');
  });
  const secondOff = simulation.onStep(second);
  selfOff = simulation.onStep((step) => { calls.push(`self:${step.tick}`); selfOff(); });
  simulation.update(TICK * 3);
  assert.deepEqual(calls, [
    'first:1', 'second:1', 'self:1',
    'first:2', 'second:2', 'late:2',
    'first:3', 'late:3',
  ]);
  assert.equal(lateOff(), true);
  assert.equal(lateOff(), false, 'a second removal reports false');
  assert.equal(secondOff(), false);
});

test('replay and projection callbacks keep their behaviour; a projection fault is counted and swallowed', () => {
  const simulation = new DeterministicSimulation({ seed: 9 });
  simulation.start();
  const replay = [];
  simulation.onReplayEvent((event) => replay.push(`${event.type}:${event.tick}`));
  simulation.onProjectionStep(() => { throw new Error('art fault'); });
  const seen = [];
  simulation.onProjectionStep((step) => seen.push(step.tick));
  simulation.update(TICK * 2);
  assert.deepEqual(replay, ['tick:1', 'tick:2']);
  assert.deepEqual(seen, [1, 2]);
  assert.equal(simulation.getProjectionFaultCount(), 2);
});

test('the callback snapshot is reused across ticks and rebuilt only after a change', () => {
  const simulation = new DeterministicSimulation({ seed: 3 });
  simulation.start();
  const off = simulation.onStep(() => {});
  const first = simulation.callbackList(simulation.stepCallbacks);
  simulation.update(TICK * 4);
  assert.equal(simulation.callbackList(simulation.stepCallbacks), first, 'no new array per tick');
  assert.ok(Object.isFrozen(first));
  off();
  assert.notEqual(simulation.callbackList(simulation.stepCallbacks), first, 'rebuilt after a removal');
  const source = read('../apps/hmh-reboot/src/simulation.mjs');
  assert.doesNotMatch(source, /\[\.\.\.this\.(?:step|replay|projection)Callbacks\]/, 'no per-tick spread');
});

test('1,000 ticks with step, replay and projection callbacks retain nothing', () => {
  const simulation = new DeterministicSimulation({ seed: 11 });
  simulation.start();
  let sum = 0;
  simulation.onStep((step) => { sum += step.tick; });
  simulation.onProjectionStep((step) => { sum -= step.tick; });
  for (let frame = 0; frame < 200; frame += 1) simulation.update(TICK);
  gc();
  const before = process.memoryUsage().heapUsed;
  for (let frame = 0; frame < 1000; frame += 1) simulation.update(TICK);
  gc();
  const grown = process.memoryUsage().heapUsed - before;
  assert.equal(sum, 0);
  assert.ok(grown < 64 * 1024, `retained ${grown} B over 1,000 ticks`);
});

test('the gamepad lookup and the terrain pool no longer allocate per frame', () => {
  const main = read('../apps/hmh-reboot/src/main.mjs');
  assert.doesNotMatch(main, /\[\.\.\.\(navigator\.getGamepads/, 'no gamepad spread');
  assert.match(main, /for \(let index = 0; index < gamepads\.length; index \+= 1\) if \(gamepads\[index\]\) \{ gamepad = gamepads\[index\]; break; \}/);
  const art = read('../apps/hmh-reboot/src/world-production-art.mjs');
  assert.match(art, /const poolable = \(\) => poolableSprites\(container\);/);
  // Behaviour: masks excluded, cached while the child list is unchanged.
  const mask = { label: 'world-road-mask' };
  const a = { label: 'terrain' };
  const b = { label: 'terrain' };
  const container = { children: [mask, a, b] };
  const first = poolableSprites(container);
  assert.deepEqual(first, [a, b]);
  assert.equal(poolableSprites(container), first, 'same array while nothing changed');
  const c = { label: 'terrain' };
  container.children.push(c);
  const grown = poolableSprites(container);
  assert.deepEqual(grown, [a, b, c], 'a new sprite invalidates the cache');
  container.children[3] = { label: 'world-path-mask' };
  assert.deepEqual(poolableSprites(container), [a, b], 'a swapped last child invalidates too');
});

test('texture prewarm: one upload per source through the renderer texture system, no-op without it', () => {
  const uploads = [];
  const renderer = { texture: { initSource: (source) => uploads.push(source) } };
  const shared = { id: 'atlas' };
  const seen = new WeakSet();
  assert.equal(prewarmTexture(renderer, { source: shared }, seen), true);
  assert.equal(prewarmTexture(renderer, { source: shared }, seen), false, 'already uploaded');
  assert.equal(prewarmTextures(renderer, [{ source: shared }, { source: { id: 'boss' } }, null], seen), 1);
  assert.deepEqual(uploads.map((source) => source.id), ['atlas', 'boss']);
  assert.equal(prewarmTexture({}, { source: {} }), false, 'no texture system: no-op');
  assert.equal(prewarmTexture({ texture: { initSource() { throw new Error('lost context'); } } }, { source: {} }), false);
  const main = read('../apps/hmh-reboot/src/main.mjs');
  // Before the player enters, and on every late atlas (the boss) before its first draw.
  assert.match(main, /dataset\.texturePrewarm = String\(prewarmTextures\(app\.renderer, enemyRosterTextures\.values\(\), prewarmedSources\)\);/);
  assert.match(main, /enemyRosterTextures\.set\(archetypeId, texture\);\n\s*prewarmTexture\(app\.renderer, texture, prewarmedSources\);/);
  assert.match(main, /prewarmTexture\(app\.renderer, hmhFeel\.damageTexture, prewarmedSources\);/);
  // Prewarm never creates actors or display objects.
  const prewarm = read('../apps/portal/src/feel/texture-prewarm.mjs');
  const code = prewarm.split(/\r?\n/).filter((line) => !line.trim().startsWith('//')).join(' ');
  assert.doesNotMatch(code, /new (?!WeakSet)|addChild|Sprite|Container|spawn/);
});
