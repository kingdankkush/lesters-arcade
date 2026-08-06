import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildSeedLeaderboardEntries,
  leaderboardEntryProvenance,
  summarizeVisibleLeaderboardProvenance,
} from '../apps/portal/src/leaderboard-seed.mjs';

test('synthetic leaderboard seeds are explicitly labeled as unofficial House Scores', () => {
  const [entry] = buildSeedLeaderboardEntries({ count: 1, now: 1_700_000_000_000 });
  assert.equal(entry.seed, true);
  assert.equal(entry.settlementTxHash, null);
  assert.deepEqual(entry.provenance, {
    source: 'house-score',
    label: 'HOUSE SCORE',
    official: false,
  });
  assert.deepEqual(leaderboardEntryProvenance(entry), entry.provenance);
});

test('real settled leaderboard entries remain official', () => {
  assert.deepEqual(leaderboardEntryProvenance({
    wallet: '0x1234567890123456789012345678901234567890',
    settlementTxHash: '0xabc',
  }), {
    source: 'ranked-settlement',
    label: 'ON-CHAIN',
    official: true,
  });
});

test('leaderboard provenance summary says its counts cover only the visible rows', () => {
  const [houseEntry] = buildSeedLeaderboardEntries({ count: 1, now: 1_700_000_000_000 });
  const officialEntry = {
    wallet: '0x1234567890123456789012345678901234567890',
    settlementTxHash: '0xabc',
  };
  const localEntry = { wallet: '0x9876543210987654321098765432109876543210' };

  assert.deepEqual(summarizeVisibleLeaderboardProvenance(
    [officialEntry, houseEntry, localEntry],
    {},
    12,
  ), {
    visibleCount: 3,
    totalRankedPlayers: 12,
    totalIsConsistent: true,
    officialCount: 1,
    houseScoreCount: 1,
    localScoreCount: 1,
    label: 'Showing 3 of 12 players · 1 official · 1 house score · 1 local',
  });
});

test('leaderboard provenance summary surfaces invalid or stale total counts', () => {
  const rows = [
    { wallet: '0x1111111111111111111111111111111111111111' },
    { wallet: '0x2222222222222222222222222222222222222222' },
    { wallet: '0x3333333333333333333333333333333333333333' },
  ];

  for (const invalidTotal of [0, null, 'not-a-number', 2, 3.5, -1]) {
    const summary = summarizeVisibleLeaderboardProvenance(rows, {}, invalidTotal);
    assert.equal(summary.totalRankedPlayers, null);
    assert.equal(summary.totalIsConsistent, false);
    assert.equal(summary.label, 'Showing 3 players · total unavailable · 0 official · 0 house scores · 3 local');
  }
});

test('leaderboard provenance summary accepts an empty board total of zero', () => {
  assert.deepEqual(summarizeVisibleLeaderboardProvenance([], {}, 0), {
    visibleCount: 0,
    totalRankedPlayers: 0,
    totalIsConsistent: true,
    officialCount: 0,
    houseScoreCount: 0,
    localScoreCount: 0,
    label: 'Showing 0 players · 0 official · 0 house scores',
  });
});

test('portal renders guest identity and House Score provenance without claiming a wallet is active', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const appRoutesSource = readFileSync(new URL('../apps/portal/src/routes/official-app-routes.mjs', import.meta.url), 'utf8');
  const leaderboardRouteSource = readFileSync(new URL('../apps/portal/src/routes/official-leaderboard-route.mjs', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');

  assert.match(appRoutesSource, /connectedWallet \? 'Wallet Profile' : 'Guest Practice Profile'/);
  assert.match(leaderboardRouteSource, /leaderboardEntryProvenance\(entry/);
  assert.match(leaderboardRouteSource, /provenance\.label/);
  assert.match(leaderboardRouteSource, /summarizeVisibleLeaderboardProvenance/);
  assert.match(leaderboardRouteSource, /Official shown/);
  assert.match(leaderboardRouteSource, /House shown/);
  assert.doesNotMatch(htmlSource, /Wallet\/profile is already active/);
  assert.doesNotMatch(htmlSource, /Your Lester’s Arcade profile is already active/);
  assert.doesNotMatch(htmlSource, /Wallet profile active/i);
  assert.match(appRoutesSource, /officialProfileEyebrow/);
  assert.match(htmlSource, /Lester’s Arcade session is active/);
});
