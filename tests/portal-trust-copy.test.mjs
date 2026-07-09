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
    officialCount: 1,
    houseScoreCount: 1,
    localScoreCount: 1,
    label: 'Showing 3 of 12 players · 1 official · 1 house score · 1 local',
  });
});

test('portal renders guest identity and House Score provenance without claiming a wallet is active', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');

  assert.match(mainSource, /connectedWallet \? 'Wallet Profile' : 'Guest Practice Profile'/);
  assert.match(mainSource, /leaderboardEntryProvenance\(entry/);
  assert.match(mainSource, /provenance\.label/);
  assert.match(mainSource, /summarizeVisibleLeaderboardProvenance/);
  assert.match(mainSource, /Official shown/);
  assert.match(mainSource, /House shown/);
  assert.doesNotMatch(htmlSource, /Wallet\/profile is already active/);
  assert.doesNotMatch(htmlSource, /Your Lester’s Arcade profile is already active/);
  assert.doesNotMatch(htmlSource, /Wallet profile active/i);
  assert.match(mainSource, /officialProfileEyebrow/);
  assert.match(htmlSource, /Lester’s Arcade session is active/);
});
