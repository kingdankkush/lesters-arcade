import test from 'node:test';
import assert from 'node:assert/strict';
import { persistStackedScore } from '../apps/portal/src/stacked-persistence.mjs';
import { createInitialArcadeState, ensureProfile, buildProfileExperienceV2Model, getSessionByUrlId } from '../apps/portal/src/arcade-core.mjs';
import { createStackedPlaySession } from '../apps/stacked/src/play-session.mjs';
import { ARCADE_PERSIST_KEY, snapshotArcadeState, loadArcadeState } from '../apps/portal/src/persistence.mjs';
import { recordCadenceScore } from '../apps/portal/src/leaderboard-engine.mjs';

function rankedFixture() {
  const run = createStackedPlaySession({ seed:44, mode:'ranked' });
  while (!run.result) run.step(run.snapshot.tick % 2 ? 0 : 8);
  const session = { gameId:'stacked', sessionId:'stacked-reload', urlSessionId:'game-session-000000042', seed:44, buildHash:'stacked-local', seasonId:'stacked-season-preview-1', wallet:'0x1111111111111111111111111111111111111111', leaderboardEligible:true };
  return { run, session };
}

test('quota never discards existing HMH or Chikun saves to fit a STACKED score', () => {
  const { run, session } = rankedFixture(), state = createInitialArcadeState();
  ensureProfile(state, session.wallet).avatarDataUrl = 'data:image/png;base64,' + 'A'.repeat(500);
  for (const gameId of ['lester-blaster', 'chikun']) recordCadenceScore(state, gameId, { wallet:session.wallet, score:100, sessionId:gameId + '-keep' });
  const original = JSON.stringify(snapshotArcadeState(state));
  let saved = original;
  const storage = { getItem: () => saved, setItem: (_, value) => { if (value.length > original.length) throw Error('quota'); saved = value; } };
  const before = JSON.stringify(state);
  assert.throws(() => persistStackedScore(state, storage, session, run.evidence(), run.result), /storage/i);
  assert.equal(saved, original, 'previous durable save is byte-for-byte untouched');
  assert.equal(JSON.stringify(state), before, 'no profile, XP or board is mutated');
});

test('STACKED profile feed and session links survive reload without changing other games', () => {
  const { run, session } = rankedFixture(), state = createInitialArcadeState(), values = new Map();
  const storage = { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value) };
  persistStackedScore(state, storage, session, run.evidence(), run.result, {inputDevice:'touch',score:999999});
  const restored = createInitialArcadeState();
  assert.equal(loadArcadeState(restored, storage), true);
  const model = buildProfileExperienceV2Model(restored, session.wallet, { selectedGameId:'stacked' });
  assert.equal(model.trophyRoom.summary.totalRankedRuns, 1);
  assert.equal(model.sessionFeed.rows.length, 1);
  assert.equal(model.sessionFeed.rows[0].sessionId, session.sessionId);
  assert.equal(getSessionByUrlId(restored, session.urlSessionId)?.canonical.resultHash, run.result.resultHash);
  assert.equal(restored.profiles[session.wallet].progress.stacked.paidRuns, 1);
  const archived=restored.profiles[session.wallet].progress.stacked.rankedArchive[session.sessionId];
  assert.equal(archived.runStats.inputDevice,'touch');assert.equal(archived.runStats.inputDeviceSource,'self-reported');
  assert.equal(archived.score,run.result.score);
  assert.ok(values.get(ARCADE_PERSIST_KEY));
});
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
