// 2.1 HMH-FEEL item 3 (upgrade guide §2.1, owner decision: option b,
// presentation-only, every mode). The renderer holds the last presented pose
// for N frames while the simulation keeps stepping, then catches up.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { HITSTOP_FRAME_MS, createHitstop } from '../apps/portal/src/feel/hitstop.mjs';
import {
  HMH_HITSTOP_FRAMES,
  HMH_HITSTOP_MAX_PER_SECOND,
  createHmhFeel,
  hmhHitstopEnabled,
  hmhHitstopFrames,
} from '../apps/hmh-reboot/src/hmh-feel.mjs';
import { validateChildMessage, validateParentMessage, createBridgeEnvelope } from '../sdk/hmh-bridge-protocol.mjs';
import {
  HMH_PLAYER_SETTINGS_DEFAULTS,
  mergeHmhRuntimeSettings,
  normalizeHmhPlayerSettings,
  projectHmhRuntimeSettings,
} from '../apps/portal/src/hmh-player-settings.mjs';
import { createStandaloneInitPayload } from '../apps/hmh-reboot/src/standalone-session.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../apps/hmh-reboot/src/main.mjs');
const ON = { hitstop: true, reduceMotion: false };
const F = HITSTOP_FRAME_MS;

// Drive a hitstop at 60 Hz: `events[frame]` is a list of frame requests made
// during that frame's ticks. Returns which frames were held.
function drive(hitstop, events, frames, enabled = true) {
  const held = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const now = 1000 + frame * F;
    for (const request of events[frame] ?? []) hitstop.request(request);
    hitstop.commit(now, enabled);
    if (hitstop.holding(now)) held.push(frame);
  }
  return held;
}

test('the impact frame renders, then exactly N frames hold, then the renderer catches up', () => {
  for (const frames of [2, 3, 4, 6]) {
    const hitstop = createHitstop();
    assert.deepEqual(drive(hitstop, { 10: [frames] }, 30), Array.from({ length: frames }, (_, i) => 11 + i), `N=${frames}`);
  }
  // A 120 Hz display holds the same wall time (2 x 1000/60 ms = 4 frames at 120 Hz).
  const hitstop = createHitstop();
  hitstop.request(2);
  hitstop.commit(0);
  const held = [];
  for (let frame = 1; frame < 12; frame += 1) if (hitstop.holding(frame * 1000 / 120)) held.push(frame);
  assert.deepEqual(held, [1, 2, 3, 4]);
});

test('requests in one frame collapse to the strongest; requests during a hold are ignored; max per rolling second', () => {
  const strongest = createHitstop();
  assert.deepEqual(drive(strongest, { 0: [2, 6, 3] }, 12), [1, 2, 3, 4, 5, 6]);
  assert.equal(strongest.stats.lastFrames, 6);
  const busy = createHitstop({ maxPerSecond: 3 });
  // A kill every frame for two seconds.
  const events = Object.fromEntries(Array.from({ length: 120 }, (_, frame) => [frame, [2]]));
  drive(busy, events, 120);
  assert.equal(busy.stats.started, 6, 'three per second, two seconds');
  assert.ok(busy.stats.ignoredActive > 0 && busy.stats.ignoredRate > 0);
  assert.equal(busy.stats.peakPerSecond, 3);
  // Disabled: nothing starts and nothing holds.
  const off = createHitstop();
  assert.deepEqual(drive(off, { 1: [6] }, 10, false), []);
  assert.equal(off.stats.started, 0);
  assert.throws(() => createHitstop({ maxPerSecond: 0 }));
});

test('HMH freeze values: crit 2, kill 2-3, heavy 3, boss hit 4, boss death 6', () => {
  assert.deepEqual({ ...HMH_HITSTOP_FRAMES }, { crit: 2, kill: 2, heavyKill: 3, heavy: 3, bossHit: 4, bossDeath: 6 });
  assert.equal(hmhHitstopFrames(true, false, 'coin-blaster', false, false), 2, 'crit');
  assert.equal(hmhHitstopFrames(false, false, 'coin-blaster', false, false), 0, 'a plain hit never freezes');
  assert.equal(hmhHitstopFrames(false, true, 'auto-miner', false, false), 2, 'kill');
  assert.equal(hmhHitstopFrames(false, true, 'scatter-shotgun', false, false), 3, 'heavy kill');
  assert.equal(hmhHitstopFrames(false, false, 'launcher-rig', false, false), 3, 'heavy hit');
  assert.equal(hmhHitstopFrames(true, false, 'coin-blaster', true, false), 4, 'boss hit');
  assert.equal(hmhHitstopFrames(false, true, 'coin-blaster', true, true), 6, 'boss death');
  assert.equal(HMH_HITSTOP_MAX_PER_SECOND, 3);
});

test('own toggle (default on), independent of screen shake, and off under reduced motion', () => {
  assert.equal(hmhHitstopEnabled({}), true, 'default on');
  assert.equal(hmhHitstopEnabled({ hitstop: true, screenShake: false }), true, 'screen shake off does not turn it off');
  assert.equal(hmhHitstopEnabled({ hitstop: false, screenShake: true }), false);
  assert.equal(hmhHitstopEnabled({ hitstop: true, reduceMotion: true }), false);
  const feel = createHmhFeel();
  feel.enemyHit(false, true, 'coin-blaster', false, true);
  assert.equal(feel.commitHitstop(0, { hitstop: true, reduceMotion: true }), false);
  assert.equal(feel.holding(10, { hitstop: true, reduceMotion: true }), false);
});

test('the cap holds through a 30-enemy wave', () => {
  // Thirty enemies die over 40 frames (a grenade, a shotgun sweep and crits),
  // as the step callback would report them: several per frame.
  const feel = createHmhFeel();
  let frame = 0;
  const startsAt = [];
  let held = 0;
  for (let enemy = 0; enemy < 30; enemy += 1) {
    if (enemy % 3 === 0) frame += 4;
    feel.enemyHit(enemy % 4 === 0, true, enemy % 2 ? 'scatter-shotgun' : 'coin-blaster', false, false);
    feel.enemyHit(true, false, 'auto-miner', false, false);
    if (enemy % 3 === 2) {
      const now = 1000 + frame * F;
      if (feel.commitHitstop(now, ON)) startsAt.push(now);
      if (feel.holding(now, ON)) held += 1;
      for (let k = 1; k < 4; k += 1) if (feel.holding(now + k * F, ON)) held += 1;
    }
  }
  const stats = feel.hitstop.stats;
  assert.ok(stats.started >= 1);
  assert.ok(stats.peakPerSecond <= HMH_HITSTOP_MAX_PER_SECOND, `peak ${stats.peakPerSecond}`);
  for (let i = HMH_HITSTOP_MAX_PER_SECOND; i < startsAt.length; i += 1) {
    assert.ok(startsAt[i] - startsAt[i - HMH_HITSTOP_MAX_PER_SECOND] >= 1000, 'never more than the cap in a rolling second');
  }
  // Total frozen time inside the wave stays bounded: cap x 3 frames per second.
  assert.ok(held <= stats.started * 3, `held ${held}`);
});

test('main.mjs: the simulation steps before the hold is consulted; a hold only skips the render', () => {
  const loop = main.slice(main.indexOf('const frame = simulation.update(ticker.deltaMS'), main.indexOf('const handleExitKey'));
  const update = loop.indexOf('simulation.update(');
  const commit = loop.indexOf('hmhFeel.commitHitstop(nowMs, settings)');
  const hold = loop.indexOf('if (hmhFeel.holding(nowMs, settings))');
  const render = loop.indexOf('renderWorld(renderActor);');
  assert.ok(update >= 0 && update < commit && commit < hold && hold < render, 'update -> commit -> hold check -> render');
  // The held branch returns after the simulation bookkeeping and before the render only.
  const held = loop.slice(hold, loop.indexOf('}', loop.indexOf('return;', hold)) + 1);
  assert.match(held, /return;/);
  assert.doesNotMatch(held, /simulation\.|bridge\.|recordRun|runSummary/);
  // One call site feeds it, after the hit was resolved, with primitive copies.
  assert.equal(main.match(/hmhFeel\?\.enemyHit\(/g)?.length, 1);
  assert.match(main, /hmhFeel\?\.enemyHit\(damageEvent\.critical === true, damageEvent\.killed === true, damageEvent\.weaponId, bossHit, Boolean\(bossHit && bossDamage\.runEvent\)\);/);
  // The simulation and evidence modules never mention it.
  for (const file of ['simulation.mjs', 'enemy-simulation.mjs', 'combat-events.mjs', 'combat-lifecycle.mjs', 'run-summary-v7.mjs', 'enemy-combat.mjs', 'collision.mjs']) {
    assert.doesNotMatch(read(`../apps/hmh-reboot/src/${file}`), /hitstop|hmhFeel/i, file);
  }
  for (const file of ['hmh-run-summary.mjs', 'hmh-run-summary-schema-v7.mjs']) {
    assert.doesNotMatch(read(`../sdk/${file}`), /hitstop/i, file);
  }
});

test('settings: bridge optional boolean, portal persistence, standalone off, pause toggle on its own path', () => {
  const settings = { ...projectHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS) };
  assert.equal(settings.hitstop, true, 'portal default on');
  const init = (value) => createBridgeEnvelope({ type: 'portal:settings', sessionId: 'game-session-hitstop', messageId: 'p-1', payload: { settings: value } });
  assert.equal(validateParentMessage(init(settings)).ok, true);
  assert.equal(validateParentMessage(init({ ...settings, hitstop: false })).ok, true);
  const { hitstop, ...older } = settings;
  assert.equal(hitstop, true);
  assert.equal(validateParentMessage(init(older)).ok, true, 'an older parent without it stays valid');
  assert.equal(validateParentMessage(init({ ...settings, hitstop: 'yes' })).ok, false);
  const echoed = createBridgeEnvelope({ type: 'game:settings', sessionId: 'game-session-hitstop', messageId: 'c-1', payload: { settings: { ...settings, hitstop: false } } });
  assert.equal(validateChildMessage(echoed).ok, true, 'the child can echo it on game:settings');
  // The pause menu choice persists in 'hmh-settings' through the merge path.
  const merged = mergeHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS, { hitstop: false });
  assert.equal(merged.gameplay.hitstop, false);
  assert.equal(projectHmhRuntimeSettings(JSON.parse(JSON.stringify(merged))).hitstop, false);
  assert.equal(normalizeHmhPlayerSettings({ gameplay: { hitstop: 'x' } }).gameplay.hitstop, true);
  assert.equal(createStandaloneInitPayload().settings.hitstop, false, 'standalone evidence captures stay hold-free');
  // Pause menu wiring.
  const html = read('../apps/portal/hmh-reboot/index.html');
  assert.match(html, /<label class="hmh-setting-toggle hmh-setting-feel">\s*<input id="hmhSettingHitstop" type="checkbox" checked>/);
  assert.equal((html.match(/class="hmh-setting-toggle"/g) ?? []).length, 4, 'the four pinned toggles are unchanged');
  assert.match(main, /const PAUSE_SETTING_KEYS = new Set\(\['musicEnabled', 'screenShake', 'reduceMotion', 'reduceFlash'\]\);/);
  assert.match(main, /onSettingFeel: applyPauseFeel,/);
  assert.match(main, /dataset\.settingHitstop = String\(settings\.hitstop !== false\);/);
});

// The acceptance check: one scripted Ranked run of the REAL child (headless
// harness, virtual 60 Hz clock, deterministic pilot), twice, hitstop on and
// off with reduced motion off. The bridge messages (run events, state, score
// result, game over, run summary) and the per-tick simulation stream must be
// byte-identical, and the on run must actually have frozen frames.
test('real child: evidence and the simulation stream are byte-identical with hitstop on and off', () => {
  const script = fileURLToPath(new URL('../scripts/hmh-honest-corpus/feel-parity.mjs', import.meta.url));
  const run = (hitstop) => {
    const result = spawnSync(process.execPath, [script, JSON.stringify({ hitstop, tickCap: 2400 })], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 240_000 });
    assert.equal(result.status, 0, result.stderr.slice(-2000));
    return JSON.parse(result.stdout.trim().split('\n').at(-1));
  };
  const on = run(true);
  const off = run(false);
  assert.deepEqual(on.errors, []);
  assert.deepEqual(off.errors, []);
  assert.equal(on.finalState, 'game-over');
  assert.ok(on.evidence.some((entry) => entry.message.type === 'game:run-summary'), 'the run produced its summary');
  assert.ok(on.evidence.every((entry) => entry.valid), 'every child message is valid hmh-bridge/v1');
  assert.ok(on.feel.hitstopStarted > 10, `hitstop actually fired (${on.feel.hitstopStarted})`);
  assert.ok(on.feel.hitstopHeldFrames > 10);
  assert.ok(on.feel.hitstopMaxPerSecond <= HMH_HITSTOP_MAX_PER_SECOND);
  assert.equal(off.feel.hitstopStarted, 0);
  assert.equal(on.finalTick, off.finalTick);
  assert.equal(JSON.stringify(on.evidence), JSON.stringify(off.evidence), 'bridge evidence byte-identical');
  assert.equal(JSON.stringify(on.stream), JSON.stringify(off.stream), 'simulation stream byte-identical');
});
