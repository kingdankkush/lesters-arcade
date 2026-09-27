import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { createStackedHaptics, stackedHapticForStep } from '../apps/stacked/src/haptics.mjs';
import { createCabinetHaptics } from '../apps/portal/src/cabinet-haptics.mjs';

const base = { tick: 1, lines: 0, perfectClears: 0, piecesLocked: 0, hardDropCells: 0, terminal: false, terminalReason: null };
const at = (patch) => ({ ...base, tick: 2, ...patch });

test('the shared cabinet API keeps its named patterns, intensity and quiet paths', () => {
  const calls = [], rumbles = [];
  const pad = { vibrationActuator: { playEffect: (type, options) => { rumbles.push([type, options]); return Promise.resolve(); } } };
  const haptics = createCabinetHaptics({ navigatorRef: { vibrate: ms => calls.push(ms) }, getGamepads: () => [null, pad] });
  for (const name of ['tap', 'hit', 'death', 'clear', 'big']) assert.equal(haptics.pulse(name, .5), true);
  assert.deepEqual(calls, [8, 20, 60, 15, 40]);
  assert.equal(rumbles[4][0], 'dual-rumble');
  assert.deepEqual(rumbles[4][1], { duration: 40, strongMagnitude: .5, weakMagnitude: .3 });
  assert.equal(haptics.pulse('unknown'), false);
  assert.equal(createCabinetHaptics({ navigatorRef: { vibrate: () => assert.fail('disabled') }, getGamepads: () => [], enabled: () => false }).pulse('big'), false);
  assert.equal(createCabinetHaptics({ navigatorRef: { vibrate: () => assert.fail('reduced') }, getGamepads: () => [], reducedMotion: () => true }).pulse('big'), false);
  assert.equal(createCabinetHaptics({ navigatorRef: {}, getGamepads: () => [] }).pulse('tap'), true, 'a missing vibrate API is not an error');
});

test('STACKED maps a committed step to tap on lock, clear per line, big on HALVING and death on top-out', () => {
  assert.equal(stackedHapticForStep(base, at({})), null);
  assert.deepEqual(stackedHapticForStep(base, at({ piecesLocked: 1 })), ['tap', .4]);
  assert.deepEqual(stackedHapticForStep(base, at({ piecesLocked: 1, hardDropCells: 12 })), ['tap', .6]);
  const clears = [1, 2, 3].map(lines => stackedHapticForStep(base, at({ piecesLocked: 1, lines })));
  assert.deepEqual(clears.map(([name]) => name), ['clear', 'clear', 'clear']);
  assert.ok(clears[0][1] < clears[1][1] && clears[1][1] < clears[2][1], 'more lines, a stronger clear');
  assert.deepEqual(stackedHapticForStep(base, at({ piecesLocked: 1, lines: 4 })), ['big', 1]);
  assert.deepEqual(stackedHapticForStep(base, at({ piecesLocked: 1, lines: 2, perfectClears: 1 })), ['big', 1]);
  for (const terminalReason of ['block-out', 'lock-out', 'garbage-out']) {
    assert.deepEqual(stackedHapticForStep(base, at({ terminal: true, terminalReason, lines: 4 })), ['death', 1]);
  }
  for (const terminalReason of ['tick-ceiling', 'evidence-ceiling']) assert.equal(stackedHapticForStep(base, at({ terminal: true, terminalReason })), null);
});

test('reduced motion silences STACKED haptics and a real run only reads committed snapshots', () => {
  const calls = [];
  let settings = { accessibility: { reduceMotion: false } };
  const haptics = createStackedHaptics({ getSettings: () => settings, navigatorRef: { vibrate: ms => calls.push(ms) }, getGamepads: () => [] });
  const runtime = createStackedRuntime({ seed: 7 });
  const control = createStackedRuntime({ seed: 7 });
  let before = runtime.snapshot();
  for (let tick = 0; tick < 400 && !runtime.terminal; tick += 1) {
    const mask = tick % 12 === 0 ? 8 : 0;
    const after = runtime.step(mask);
    control.step(mask);
    haptics.step(before, after);
    before = after;
  }
  assert.ok(calls.filter(ms => ms === 8).length > 5, 'hard drops tap');
  assert.equal(runtime.stateHash(), control.stateHash(), 'haptics never touch the simulation');
  settings = { accessibility: { reduceMotion: true } };
  const count = calls.length;
  assert.equal(haptics.step(base, at({ piecesLocked: 1, lines: 4 })), false);
  assert.equal(calls.length, count);
});

test('a gamepad API that throws (no iframe permission) cannot break the frame loop', () => {
  const calls = [];
  const haptics = createStackedHaptics({ getSettings: () => ({ accessibility: { reduceMotion: false } }), navigatorRef: { vibrate: ms => calls.push(ms) }, getGamepads: () => { throw new Error('SecurityError'); } });
  assert.equal(haptics.step(base, at({ piecesLocked: 1 })), true);
  assert.deepEqual(calls, [8]);
});

test('haptics load lazily with the renderer, outside the STACKED entry', async () => {
  const main = await readFile(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /import\('\.\/haptics\.mjs'\)/);
  assert.doesNotMatch(main, /^import .*haptics/m);
  assert.match(main, /haptics\?\.step\(before, s\)/);
});
