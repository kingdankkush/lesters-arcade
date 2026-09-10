import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEADERBOARD_SOURCE_TABS,
  filterLeaderboardEntriesBySource,
} from '../apps/portal/src/leaderboard-seed.mjs';
import { recordCadenceScore } from '../apps/portal/src/leaderboard-engine.mjs';
import { buildLeaderboardExperienceV2Model } from '../apps/portal/src/arcade-core.mjs';
import { createOfficialLeaderboardRoute } from '../apps/portal/src/routes/official-leaderboard-route.mjs';

function mixedWalletFixture() {
  const state = { profiles: {}, sessions: {} };
  const wallet = `0x${'12'.repeat(20)}`;
  const other = `0x${'34'.repeat(20)}`;
  const recordedAt = '2026-09-09T12:00:00.000Z';
  const put = (sessionId, score, extra = {}) => recordCadenceScore(state, 'lester-blaster', { wallet, sessionId, score, recordedAt, ...extra });
  put('local-higher', 9000);
  put('official-best', 500, { settlementTxHash: `0x${'ab'.repeat(32)}` });
  put('official-lower', 300, { settlementTxHash: `0x${'cd'.repeat(32)}` });
  put('other-official', 1000, { wallet: other, settlementTxHash: `0x${'ef'.repeat(32)}` });
  return { state, wallet, other, recordedAt };
}

test('source partition precedes best-per-wallet selection and visible truncation', () => {
  const { state, wallet, recordedAt } = mixedWalletFixture();
  const options = { gameId: 'lester-blaster', cadence: 'all-time', wallet, now: recordedAt, source: 'official' };
  const model = buildLeaderboardExperienceV2Model(state, { ...options, limit: 1 });
  assert.equal(model.total, 2);
  assert.equal(model.topEntries.length, 1);
  assert.equal(model.topEntries[0].score, 1000);
  assert.equal(model.playerRank, 2);
  const full = buildLeaderboardExperienceV2Model(state, { ...options, limit: 50 });
  assert.equal(full.playerEntry.score, 500);
  assert.equal(full.topEntries.filter(row => row.wallet === wallet).length, 1);
});

test('local and default aggregate boards keep their existing best-score semantics', () => {
  const { state, wallet, recordedAt } = mixedWalletFixture();
  const options = { gameId: 'lester-blaster', cadence: 'all-time', wallet, now: recordedAt };
  const local = buildLeaderboardExperienceV2Model(state, { ...options, source: 'local' });
  assert.equal(local.total, 1);
  assert.equal(local.playerEntry.score, 9000);
  const all = buildLeaderboardExperienceV2Model(state, options);
  assert.equal(all.total, 2);
  assert.equal(all.playerEntry.score, 9000);
});

test('source selection owns a distinct normalized V2 cache namespace', () => {
  const { state, wallet, recordedAt } = mixedWalletFixture();
  const options = { gameId: 'lester-blaster', cadence: 'all-time', wallet, now: recordedAt };
  const all = buildLeaderboardExperienceV2Model(state, options);
  const official = buildLeaderboardExperienceV2Model(state, { ...options, source: 'official' });
  assert.notEqual(all.cache.key, official.cache.key);
  assert.equal(buildLeaderboardExperienceV2Model(state, { ...options, source: 'official' }).cache.status, 'hit');
  const unknown = buildLeaderboardExperienceV2Model(state, { ...options, source: 'invalid-source' });
  assert.equal(unknown.cache.key, official.cache.key);
});

test('the real public route passes source selection into its aggregation model', () => {
  const sentinel = new Error('stop after real route-to-model boundary');
  let captured;
  const route = createOfficialLeaderboardRoute({
    dom: { officialCabinetGrid: { replaceChildren() {} } },
    getContext: () => ({ state: { profiles: {} }, connectedWallet: null }),
    publicLeaderboardCabinets: () => [{ gameId: 'lester-blaster', title: 'Hard Money Heroes' }],
    routeState: { gameId: 'lester-blaster', cadence: 'all-time', source: 'official' },
    buildLeaderboardExperienceV2Model: (_state, options) => { captured = options; throw sentinel; },
  });
  assert.throws(() => route.renderLeaderboards(), error => error === sentinel);
  assert.equal(captured.source, 'official');
});

test('V2 cache refreshes the requesting player rank below the visible cut', () => {
  const { state, wallet, recordedAt } = mixedWalletFixture();
  const third = `0x${'56'.repeat(20)}`;
  recordCadenceScore(state, 'lester-blaster', { wallet: third, sessionId: 'third-official', score: 200, recordedAt, settlementTxHash: `0x${'56'.repeat(32)}` });
  const options = { gameId: 'lester-blaster', cadence: 'all-time', now: recordedAt, source: 'official', limit: 1 };
  assert.equal(buildLeaderboardExperienceV2Model(state, { ...options, wallet }).playerRank, 2);
  const changedViewer = buildLeaderboardExperienceV2Model(state, { ...options, wallet: third });
  assert.equal(changedViewer.playerRank, 3);
  assert.equal(changedViewer.cache.status, 'rebuilt');
});

test('V2 cache refreshes a display name resolved from an updated profile', () => {
  const { state, wallet, recordedAt } = mixedWalletFixture();
  let displayName = 'Old name';
  const options = { gameId: 'lester-blaster', cadence: 'all-time', now: recordedAt, source: 'official', wallet, displayNameFor: value => value === wallet ? displayName : value };
  assert.equal(buildLeaderboardExperienceV2Model(state, options).playerEntry.displayName, 'Old name');
  displayName = 'Updated name';
  const renamed = buildLeaderboardExperienceV2Model(state, options);
  assert.equal(renamed.playerEntry.displayName, 'Updated name');
  assert.equal(renamed.cache.status, 'rebuilt');
});

const entries = [
  { wallet: '0xSEED111', score: 30_000, rank: 1, seed: true },
  { wallet: '0x1111111111111111111111111111111111111111', score: 20_000, rank: 2, settlementTxHash: `0x${'ab'.repeat(32)}`, isCurrentPlayer: true },
  { wallet: '0x2222222222222222222222222222222222222222', score: 10_000, rank: 3 },
];

test('leaderboard source tabs keep official, local, and house demo scores in separate standings', () => {
  assert.deepEqual(LEADERBOARD_SOURCE_TABS.map((tab) => tab.id), ['official', 'local', 'demo']);
  const official = filterLeaderboardEntriesBySource(entries, {}, 'official');
  assert.deepEqual(official.rows.map((row) => [row.wallet, row.rank]), [[entries[1].wallet, 1]]);
  assert.equal(official.playerRank, 1);
  assert.equal(official.label, 'Verified Ranked');

  const local = filterLeaderboardEntriesBySource(entries, {}, 'local');
  assert.deepEqual(local.rows.map((row) => [row.wallet, row.rank]), [[entries[2].wallet, 1]]);
  assert.equal(local.playerRank, null);
  assert.equal(local.label, 'Local Preview');

  const demo = filterLeaderboardEntriesBySource(entries, {}, 'demo');
  assert.deepEqual(demo.rows.map((row) => [row.wallet, row.rank]), [[entries[0].wallet, 1]]);
  assert.equal(demo.label, 'House Demo');
});

test('unknown source fails closed to the official standing', () => {
  const result = filterLeaderboardEntriesBySource(entries, {}, 'all');
  assert.equal(result.source, 'official');
  assert.deepEqual(result.rows.map((row) => row.wallet), [entries[1].wallet]);
});
