import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEADERBOARD_SOURCE_TABS,
  filterLeaderboardEntriesBySource,
} from '../apps/portal/src/leaderboard-seed.mjs';

const entries = [
  { wallet: '0xSEED111', score: 30_000, rank: 1, seed: true },
  { wallet: '0x1111111111111111111111111111111111111111', score: 20_000, rank: 2, settlementTxHash: '0xabc', isCurrentPlayer: true },
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
