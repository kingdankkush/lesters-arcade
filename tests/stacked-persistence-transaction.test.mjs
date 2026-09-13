import test from 'node:test';
import assert from 'node:assert/strict';
import { persistStackedScore } from '../apps/portal/src/stacked-persistence.mjs';
import { createInitialArcadeState } from '../apps/portal/src/arcade-core.mjs';
import { createStackedPlaySession } from '../apps/stacked/src/play-session.mjs';
test('failed storage leaves profile, boards, sessions and XP unchanged', () => {
  const state = createInitialArcadeState(), before = JSON.stringify(state);
  const run = createStackedPlaySession({ seed:44, mode:'ranked' });
  while (!run.result) run.step(run.snapshot.tick % 2 ? 0 : 8);
  const session = { gameId:'stacked', sessionId:'stacked-test-transaction', seed:44, buildHash:'stacked-local', seasonId:'stacked-season-preview-1', wallet:'0x1111111111111111111111111111111111111111', leaderboardEligible:true };
  assert.throws(() => persistStackedScore(state, { setItem(){throw Error('quota');}, getItem(){return null;} }, session, run.evidence(), run.result), /storage/i);
  assert.equal(JSON.stringify(state), before);
  const values = new Map(), storage = {setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)??null};
  const result = persistStackedScore(state, storage, session, run.evidence(), run.result);
  assert.equal(result.acceptedForLocalLeaderboard, true);
  assert.ok(state.profiles[session.wallet].progress.stacked.rankedArchive[session.sessionId]);
});
