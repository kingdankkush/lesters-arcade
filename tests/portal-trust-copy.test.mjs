import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildSeedLeaderboardEntries,
  leaderboardEntryProvenance,
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

test('portal renders guest identity and House Score provenance without claiming a wallet is active', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');

  assert.match(mainSource, /connectedWallet \? 'Wallet Profile' : 'Guest Practice Profile'/);
  assert.match(mainSource, /leaderboardEntryProvenance\(entry/);
  assert.match(mainSource, /provenance\.label/);
  assert.doesNotMatch(htmlSource, /Wallet\/profile is already active/);
  assert.doesNotMatch(htmlSource, /Your Lester’s Arcade profile is already active/);
  assert.doesNotMatch(htmlSource, /Wallet profile active/i);
  assert.match(mainSource, /officialProfileEyebrow/);
  assert.match(htmlSource, /Lester’s Arcade session is active/);
});
