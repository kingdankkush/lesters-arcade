import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  leaderboardEntryProvenance,
  purgeHouseSeedRows,
  summarizeVisibleLeaderboardProvenance,
} from '../apps/portal/src/leaderboard-seed.mjs';
import { recordCadenceScore } from '../apps/portal/src/leaderboard-engine.mjs';
import * as leaderboardSeed from '../apps/portal/src/leaderboard-seed.mjs';

// A row the retired House Demo seed stored in a browser before the clean slate (D4).
const storedHouseRow = Object.freeze({
  wallet: '0xSEED0123456789abcdef0123456789abcdef01',
  displayName: 'LitCommando42',
  score: 25_000,
  seed: true,
  settlementTxHash: null,
  recordedAt: '2026-09-01T00:00:00.000Z',
  runStats: { kills: 90, surviveSeconds: 300 },
});

test('stored House Demo rows are still recognised as unofficial House Scores', () => {
  assert.deepEqual(leaderboardEntryProvenance(storedHouseRow), {
    source: 'house-score',
    label: 'HOUSE SCORE',
    official: false,
  });
  assert.equal(leaderboardEntryProvenance({ wallet: storedHouseRow.wallet }).source, 'house-score', 'a 0xSEED wallet is a seed row even without the flag');
  assert.equal(typeof leaderboardSeed.applySeedLeaderboard, 'undefined', 'nothing can seed a board any more');
  assert.equal(typeof leaderboardSeed.buildSeedLeaderboardEntries, 'undefined');
});

test('the clean slate purges stored House Demo rows and profiles on load', () => {
  const player = `0x${'12'.repeat(20)}`;
  const state = { profiles: { [storedHouseRow.wallet]: { handle: 'LitCommando42', seed: true }, [player]: { handle: 'Real Player' } }, leaderboards: {} };
  recordCadenceScore(state, 'lester-blaster', { ...storedHouseRow });
  recordCadenceScore(state, 'lester-blaster', { wallet: player, score: 700, sessionId: 'real-run', recordedAt: '2026-09-01T00:00:00.000Z' });
  state.leaderboards['lester-blaster'] = [{ ...storedHouseRow }, { wallet: player, score: 700 }];
  const removed = purgeHouseSeedRows(state);
  assert.ok(removed >= 6, `every cadence bucket and the flat board lose the seed row (${removed})`);
  const allTime = state.cadenceLeaderboards['lester-blaster']['all-time']['all-time'];
  assert.deepEqual(allTime.map((row) => row.wallet), [player]);
  assert.deepEqual(state.leaderboards['lester-blaster'].map((row) => row.wallet), [player]);
  assert.deepEqual(Object.keys(state.profiles), [player], 'the synthetic profile is gone, the real one stays');
  assert.equal(purgeHouseSeedRows(state), 0, 'idempotent');
  assert.equal(purgeHouseSeedRows(null), 0);
});

test('real settled leaderboard entries remain official', () => {
  assert.deepEqual(leaderboardEntryProvenance({
    wallet: '0x1234567890123456789012345678901234567890',
    settlementTxHash: `0x${'ab'.repeat(32)}`,
  }), {
    source: 'ranked-settlement',
    label: 'ON-CHAIN',
    official: true,
  });
});

test('leaderboard provenance summary says its counts cover only the visible rows', () => {
  const houseEntry = storedHouseRow;
  const officialEntry = {
    wallet: '0x1234567890123456789012345678901234567890',
    settlementTxHash: `0x${'ab'.repeat(32)}`,
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
  // Clean slate (D4): no House Demo standing or House counts; preview rows are labelled as this device's.
  assert.doesNotMatch(leaderboardRouteSource, /House shown|LEADERBOARD_SOURCE_TABS/);
  assert.match(leaderboardRouteSource, /LEADERBOARD_PREVIEW_LABEL/);
  assert.doesNotMatch(htmlSource, /Wallet\/profile is already active/);
  assert.doesNotMatch(htmlSource, /Your Lester’s Arcade profile is already active/);
  assert.doesNotMatch(htmlSource, /Wallet profile active/i);
  assert.match(appRoutesSource, /officialProfileEyebrow/);
  // The HMH intro note no longer tells signed-out visitors a session is
  // active (live UI audit follow-up, polish-2).
  assert.doesNotMatch(htmlSource, /session is active/);
  assert.match(htmlSource, /Free play needs no wallet, and Hard Money Heroes never interrupts it with a wallet prompt\./);
});

// Preview safety (A22, D4) lives in main.js wiring that the module tests
// cannot see: pin it at the source.
test('main.js purges House Demo rows on load and gates every index read on HOSTED_PROFILE_SYNC', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(main, /^loadArcadeState\(state, ARCADE_STORAGE\);\n(?:\/\/.*\n)*purgeHouseSeedRows\(state\);$/m, 'the purge runs right after the stored state loads');
  assert.doesNotMatch(main, /applySeedLeaderboard/, 'nothing seeds the boards any more');
  assert.doesNotMatch(main, /__seededLeaderboard/);

  const block = (start, end) => {
    const from = main.indexOf(start);
    assert.ok(from > 0, `${start} is in main.js`);
    return main.slice(from, main.indexOf(end, from));
  };
  assert.match(block('const indexApi = createIndexApiClient({', '});'), /hosted: HOSTED_PROFILE_SYNC,/, 'the index client is offline in preview');
  assert.match(block('const officialProfileRoute = createOfficialProfileRoute({', '\n});'), /\n {2}hosted: HOSTED_PROFILE_SYNC,\n/, 'the Profile route renders the device-local view in preview');
  assert.match(block('const officialLeaderboardRoute = createOfficialLeaderboardRoute({', '\n});'), /\n {2}hosted: HOSTED_PROFILE_SYNC,\n/, 'the Scores route renders the device-local board in preview');
  assert.doesNotMatch(main, /hosted: true\b/, 'never hard-coded on');
  for (const hook of ['function hydrateLeaderboardFromIndex() {', 'function hydrateProfileFromIndex() {']) {
    assert.match(block(hook, '\n}'), /^ {2}if \(!HOSTED_PROFILE_SYNC\) return;$/m, `${hook} is a no-op in preview`);
  }
  assert.match(main, /hydrateLeaderboard: hydrateLeaderboardFromIndex,/);
  assert.match(main, /hydrateProfile: hydrateProfileFromIndex,/);
  assert.doesNotMatch(main, /hydrateLeaderboardFromChain|hydrateProfileFromChain/, 'the 200-session chain scan is retired');
});
