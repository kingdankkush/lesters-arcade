import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialArcadeState, startPlaySession, recordScore, recordStackedScore } from '../apps/portal/src/arcade-core.mjs';
import { createStackedPlaySession } from '../apps/stacked/src/play-session.mjs';
import { snapshotArcadeState, restoreArcadeState } from '../apps/portal/src/persistence.mjs';
const wallet = '0x1234567890abcdef1234567890abcdef12345678';
function fixture(mode = 'paid') {
  const session = startPlaySession({ wallet, gameId: 'stacked', mode, allowDevCabinet: true });
  const run = createStackedPlaySession({ ...session, mode: mode === 'paid' ? 'ranked' : 'free' });
  while (!run.result) run.step(run.snapshot.tick % 2 ? 0 : 8);
  return { session, run };
}
test('Free score path leaves the complete parent state byte-identical', () => {
  const state = createInitialArcadeState(), { session, run } = fixture('free'), before = JSON.stringify(state);
  recordStackedScore(state, session, run.evidence(), run.result);
  assert.equal(JSON.stringify(state), before);
});
test('Ranked rejects wrong score before writes and never grants HMH badges or settlement records', () => {
  const state = createInitialArcadeState(), { session, run } = fixture(), before = JSON.stringify(state);
  assert.throws(() => recordScore(state, session, run.result.score));
  assert.throws(() => recordStackedScore(state, session, run.evidence(), { ...run.result, score: 999999 }));
  assert.equal(JSON.stringify(state), before);
  recordStackedScore(state, session, run.evidence(), run.result);
  assert.equal(state.profiles[wallet].progress.stacked.paidRuns, 1);
  assert.deepEqual(state.profiles[wallet].achievements, ['cabinet-pioneer']);
  assert.equal(state.payments.length, 0);
  assert.throws(() => recordStackedScore(state, session, run.evidence(), run.result));
});
test('reloaded Ranked sessions cannot credit the same run twice', () => {
  const state = createInitialArcadeState(), { session, run } = fixture();
  recordStackedScore(state, session, run.evidence(), run.result);
  const restored = createInitialArcadeState(); restoreArcadeState(restored, snapshotArcadeState(state));
  assert.throws(() => recordStackedScore(restored, session, run.evidence(), run.result));
});
