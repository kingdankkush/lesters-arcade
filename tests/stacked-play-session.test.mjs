import test from 'node:test';
import assert from 'node:assert/strict';
import { createStackedPlaySession } from '../apps/stacked/src/play-session.mjs';
import { replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';

test('play session records only committed ticks and produces a matching terminal replay', () => {
  const run = createStackedPlaySession({ seed: 21, mode: 'ranked' });
  while (!run.snapshot.terminalReason) run.step(run.snapshot.tick % 2 ? 0 : 8);
  assert.deepEqual(replayStackedRun(run.evidence(), { expectedSeed: 21 }), run.result);
});
test('pause freezes time and reserves neutral input on resume', () => {
  const run = createStackedPlaySession({ seed: 21, mode: 'free' });
  run.step(1); run.pause(); const before = run.snapshot;
  run.step(2); assert.equal(run.snapshot, before);
  run.resume(); run.step(2); assert.equal(run.snapshot.prevMask, 0);
  run.step(2); assert.equal(run.snapshot.prevMask, 2);
});
test('Ranked rejects start-level skips and undo', () => {
  assert.throws(() => createStackedPlaySession({ seed: 21, mode: 'ranked', startLevel: 4 }));
  const run = createStackedPlaySession({ seed: 21, mode: 'ranked' });
  run.step(8); assert.equal(run.undo(), false);
});
test('Free undo restores the pre-placement state without touching another run', () => {
  const run = createStackedPlaySession({ seed: 21, mode: 'free', startLevel: 3 });
  const original = run.snapshot; run.step(0); run.step(8);
  assert.equal(run.snapshot.piecesLocked, 1);
  assert.equal(run.undo(), true);
  assert.deepEqual(run.snapshot, original);
  assert.equal(run.assisted, true);
});
