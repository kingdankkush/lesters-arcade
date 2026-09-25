import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { migrate } from '../server/neon/migrations.mjs';
import { isValidPeriodKey, periodKeyResetAt, periodKeysFor, periodResetAt, periodStartMs } from '../server/neon/period-keys.mjs';
import { hitRateLimit } from '../server/neon/rate-limit.mjs';
import {
  cardRevision, leaderboardSearch, readAchievementHistory, readLeaderboard, readPublicProfile, readPublicSession,
  readWalletStanding, upsertWalletProfile, writePreferences,
} from '../server/neon/queries.mjs';
import { headlineStats, resolveGameId, walletShort } from '../server/neon/rows.mjs';
import { sanitizeOnchainProfile } from '../server/profile/sanitize.mjs';
import { createPgliteClient, seedAchievementUnlock, seedVerifiedSession, seedWalletProfile } from './helpers/pglite-client.mjs';

/**
 * Contract §4.3.5-§4.3.8, §6.5, A29 and D1: the index reads rank the best
 * confirmed run per wallet, honour the owner's hidden and board_excluded
 * flags, never find hidden or blocked names, and read achievement history
 * only through validated stats paths.
 */

const W = (n) => `0x${String(n).padStart(2, '0').repeat(20)}`;
const SEASON = 'chikun-season-preview-1';
const board = (db, extra = {}) => readLeaderboard(db, { gameId: 'chikun', seasonId: SEASON, period: 'all-time', periodKey: null, ...extra });

async function withDb(run) {
  const db = createPgliteClient();
  try {
    await migrate(db);
    await run(db);
  } finally {
    await db.close();
  }
}

test('period keys follow ISO weeks and reset on Monday, the 1st and midnight UTC', () => {
  const at = Date.parse('2026-09-23T10:00:00.000Z');
  assert.deepEqual({ ...periodKeysFor(at) }, { day: '2026-09-23', week: '2026-W39', month: '2026-09' });
  assert.equal(periodResetAt('weekly', at), '2026-09-28T00:00:00.000Z');
  assert.equal(periodResetAt('monthly', at), '2026-10-01T00:00:00.000Z');
  assert.equal(periodResetAt('daily', at), '2026-09-24T00:00:00.000Z');
  assert.equal(periodResetAt('all-time', at), null);
  assert.equal(periodKeyResetAt('weekly', '2026-W01'), '2026-01-05T00:00:00.000Z');
  assert.equal(periodStartMs('weekly', '2026-W01'), Date.parse('2025-12-29T00:00:00.000Z'));
  assert.equal(periodKeyResetAt('monthly', '2026-12'), '2027-01-01T00:00:00.000Z');
  assert.equal(isValidPeriodKey('weekly', '2026-W53'), true, '2026 starts on a Thursday and has 53 ISO weeks');
  assert.equal(isValidPeriodKey('weekly', '2025-W53'), false);
  assert.equal(isValidPeriodKey('weekly', '2026-39'), false);
  assert.equal(isValidPeriodKey('daily', '2026-02-30'), false);
  assert.equal(isValidPeriodKey('monthly', '2026-13'), false);
  assert.equal(isValidPeriodKey('all-time', 'all-time'), true);
  assert.equal(resolveGameId('hard-money-heroes'), 'lester-blaster');
  assert.equal(resolveGameId('CHIKUN'), 'chikun');
  assert.equal(resolveGameId('tetris'), null);
  assert.equal(walletShort(W(12)), '0x1212…1212');
  assert.deepEqual(headlineStats('stacked', { lines: 4, boardHash: 'x', level: 2 }), { lines: 4, level: 2 });
});

test('leaderboard ranks the best score per wallet with earliest confirmation winning ties', async () => withDb(async (db) => {
  await seedVerifiedSession(db, { wallet: W(1), score: 500, confirmedAt: '2026-09-23T10:01:00.000Z' });
  const w1Best = await seedVerifiedSession(db, { wallet: W(1), score: 900, confirmedAt: '2026-09-23T10:05:00.000Z' });
  await seedVerifiedSession(db, { wallet: W(1), score: 900, confirmedAt: '2026-09-23T10:09:00.000Z' });
  const w2 = await seedVerifiedSession(db, { wallet: W(2), score: 900, confirmedAt: '2026-09-23T10:02:00.000Z' });
  await seedVerifiedSession(db, { wallet: W(3), score: 300 });
  const result = await board(db);
  assert.equal(result.total, 3);
  assert.deepEqual(result.rows.map((row) => [row.rank, row.wallet, row.score]), [[1, W(2), 900], [2, W(1), 900], [3, W(3), 300]]);
  assert.equal(result.rows[0].sessionId32, w2.sessionId32);
  assert.equal(result.rows[1].sessionId32, w1Best.sessionId32, 'a wallet\'s tie goes to its earliest confirmation');
  const [top] = result.rows;
  assert.equal(top.shareId, w2.sessionId32.slice(2));
  assert.equal(top.walletShort, `${W(2).slice(0, 6)}…${W(2).slice(-4)}`);
  assert.equal(top.explorerUrl, `https://liteforge.explorer.caldera.xyz/tx/${w2.txHash}`);
  assert.equal(top.confirmedAt, '2026-09-23T10:02:00.000Z');
  assert.deepEqual(Object.keys(top.stats).sort(), ['bestCombo', 'coinsCollected', 'forksPassed', 'laps', 'nearMisses', 'regionReached', 'survivalSeconds'], 'rows carry the §6.3 headline keys only');
}));

test('weekly, monthly, daily and all-time filter by period key and season', async () => withDb(async (db) => {
  await seedVerifiedSession(db, { wallet: W(1), score: 100, openedAt: '2026-09-23T10:00:00.000Z' });
  await seedVerifiedSession(db, { wallet: W(2), score: 200, openedAt: '2026-09-16T10:00:00.000Z' });
  await seedVerifiedSession(db, { wallet: W(3), score: 300, openedAt: '2026-08-20T10:00:00.000Z' });
  await seedVerifiedSession(db, { wallet: W(4), score: 400, openedAt: '2026-09-22T10:00:00.000Z' });
  await seedVerifiedSession(db, { wallet: W(5), score: 999, openedAt: '2026-09-23T10:00:00.000Z', seasonId: 'chikun-season-old' });
  await seedVerifiedSession(db, { wallet: W(6), score: 888, openedAt: '2026-09-23T10:00:00.000Z', gameId: 'stacked' });
  const wallets = (result) => result.rows.map((row) => row.wallet);
  assert.deepEqual(wallets(await board(db, { period: 'weekly', periodKey: '2026-W39' })), [W(4), W(1)]);
  assert.deepEqual(wallets(await board(db, { period: 'weekly', periodKey: '2026-W38' })), [W(2)]);
  assert.deepEqual(wallets(await board(db, { period: 'monthly', periodKey: '2026-09' })), [W(4), W(2), W(1)]);
  assert.deepEqual(wallets(await board(db, { period: 'daily', periodKey: '2026-09-23' })), [W(1)]);
  assert.deepEqual(wallets(await board(db)), [W(4), W(3), W(2), W(1)], 'all-time keeps only the current season and game');
  assert.deepEqual(wallets(await readLeaderboard(db, { gameId: 'chikun', seasonId: 'chikun-season-old', period: 'all-time' })), [W(5)]);
}));

test('only confirmed rows rank', async () => withDb(async (db) => {
  for (const [n, status] of [[1, 'pending'], [2, 'signed'], [3, 'submitted'], [4, 'failed']]) {
    await seedVerifiedSession(db, { wallet: W(n), score: 10_000 + n, status });
  }
  await seedVerifiedSession(db, { wallet: W(5), score: 50 });
  const result = await board(db);
  assert.deepEqual(result.rows.map((row) => [row.rank, row.wallet]), [[1, W(5)]]);
  assert.equal(result.total, 1);
}));

test('search matches display names and wallet prefixes without re-ranking', async () => withDb(async (db) => {
  await seedVerifiedSession(db, { wallet: W(1), score: 300 });
  await seedVerifiedSession(db, { wallet: W(2), score: 200 });
  await seedVerifiedSession(db, { wallet: W(3), score: 100 });
  await seedWalletProfile(db, { wallet: W(1), displayName: 'Lit Pilot' });
  await seedWalletProfile(db, { wallet: W(2), displayName: 'Chikun King' });
  await seedWalletProfile(db, { wallet: W(3), displayName: 'under_score' });
  const king = await board(db, { q: 'KING' });
  assert.deepEqual(king.rows.map((row) => [row.rank, row.displayName]), [[2, 'Chikun King']], 'search keeps the full-board rank');
  assert.equal(king.total, 1);
  assert.deepEqual((await board(db, { q: `0x${'03'.repeat(3)}` })).rows.map((row) => row.rank), [3], 'wallet prefix with 0x');
  assert.deepEqual((await board(db, { q: '0303' })).rows.map((row) => row.rank), [3], 'wallet prefix without 0x');
  assert.deepEqual((await board(db, { q: '030' })).rows, [], 'fewer than four hex characters is a name search only');
  assert.deepEqual((await board(db, { q: '%' })).rows, [], 'LIKE wildcards are escaped');
  assert.deepEqual((await board(db, { q: '_' })).rows.map((row) => row.displayName), ['under_score'], 'an underscore matches only itself');
  assert.deepEqual(leaderboardSearch('  '), { namePattern: null, walletPrefix: null });
}));

test('hidden profiles keep their rank but lose their name, and search never finds them', async () => withDb(async (db) => {
  await seedVerifiedSession(db, { wallet: W(1), score: 900 });
  await seedVerifiedSession(db, { wallet: W(2), score: 100 });
  await seedWalletProfile(db, { wallet: W(1), displayName: 'Chikun King', hidden: true });
  await seedWalletProfile(db, { wallet: W(2), displayName: 'Lit Pilot' });
  const result = await board(db);
  assert.deepEqual(result.rows.map((row) => [row.rank, row.wallet, row.displayName, row.avatarUri]), [
    [1, W(1), null, null],
    [2, W(2), 'Lit Pilot', 'lestersarcade:avatar/lester'],
  ]);
  assert.equal((await board(db, { q: 'king' })).total, 0, 'q never matches a hidden name');
  assert.deepEqual((await board(db, { q: W(1).slice(0, 10) })).rows.map((row) => [row.rank, row.displayName]), [[1, null]], 'a hidden wallet is still found by its address');
}));

test('board-excluded wallets never rank and have no standing', async () => withDb(async (db) => {
  await seedVerifiedSession(db, { wallet: W(1), score: 5000 });
  await seedVerifiedSession(db, { wallet: W(2), score: 100 });
  await seedWalletProfile(db, { wallet: W(1), displayName: 'Test Wallet', boardExcluded: true });
  const result = await board(db, { wallet: W(1) });
  assert.deepEqual(result.rows.map((row) => [row.rank, row.wallet]), [[1, W(2)]]);
  assert.equal(result.total, 1);
  assert.equal(result.you, null);
  const standing = await readWalletStanding(db, { gameId: 'chikun', seasonId: SEASON, wallet: W(1), nowMs: Date.parse('2026-09-23T12:00:00.000Z') });
  assert.deepEqual(standing, { weekly: null, monthly: null, allTime: null });
  const other = await readWalletStanding(db, { gameId: 'chikun', seasonId: SEASON, wallet: W(2), nowMs: Date.parse('2026-09-23T12:00:00.000Z') });
  assert.deepEqual([other.weekly.rank, other.monthly.rank, other.allTime.rank], [1, 1, 1]);
}));

test('blocked names are stored null with the reason', async () => withDb(async (db) => {
  const handle = `0x${'ab'.repeat(32)}`;
  const blocked = sanitizeOnchainProfile({ handle, displayName: 'Admin L3ster', avatarUri: 'lestersarcade:avatar/chikun', createdAt: 1n, lastUpdated: 2n, exists: true });
  assert.deepEqual(blocked, { displayName: null, nameBlocked: 'impersonation', handleHash: handle, avatarUri: 'lestersarcade:avatar/chikun' });
  await seedWalletProfile(db, { wallet: W(1), displayName: 'Old Name', hidden: true, boardExcluded: true });
  const display = await upsertWalletProfile(db, { wallet: W(1), ...blocked, profileBlock: 50, onchainUpdatedAt: '2026-09-23T10:00:00.000Z' });
  assert.deepEqual(display, { displayName: null, avatarUri: null, hidden: true });
  const [row] = await db.query('SELECT display_name, name_blocked, hidden, board_excluded, handle_hash FROM wallet_profiles WHERE wallet = $1', [W(1)]);
  assert.deepEqual(row, { display_name: null, name_blocked: 'impersonation', hidden: true, board_excluded: true, handle_hash: handle }, 'the upsert never touches hidden or board_excluded');

  const profane = sanitizeOnchainProfile({ handle, displayName: 'sh1t head', avatarUri: 'https://x', createdAt: 1n, lastUpdated: 2n, exists: true });
  assert.deepEqual([profane.displayName, profane.nameBlocked, profane.avatarUri], [null, 'profanity', null]);
  await upsertWalletProfile(db, { wallet: W(2), ...profane, profileBlock: 51 });
  await seedVerifiedSession(db, { wallet: W(2), score: 10 });
  assert.equal((await board(db)).rows[0].displayName, null, 'a blocked name never reaches a board');
  assert.equal((await board(db, { q: 'head' })).total, 0);
  const self = await readPublicProfile(db, W(2), { self: true, catalog: null });
  assert.equal(self.profile.nameBlocked, 'profanity', 'the owner learns why the name does not show');
  const publicView = await readPublicProfile(db, W(2), { catalog: null });
  assert.equal('nameBlocked' in publicView.profile, false);

  // An older profile block never overwrites a newer mirror.
  await upsertWalletProfile(db, { wallet: W(3), displayName: 'New Name', profileBlock: 100 });
  await upsertWalletProfile(db, { wallet: W(3), displayName: 'Old Name', profileBlock: 90 });
  assert.equal((await db.query('SELECT display_name FROM wallet_profiles WHERE wallet = $1', [W(3)]))[0].display_name, 'New Name');
  const charset = sanitizeOnchainProfile({ handle, displayName: '  Lit   Pilot ', avatarUri: 'lestersarcade:avatar/lester', exists: true });
  assert.deepEqual([charset.displayName, charset.nameBlocked], ['Lit Pilot', null]);
  assert.deepEqual(sanitizeOnchainProfile({ handle, displayName: 'no<script>', exists: true }).displayName, null);
  assert.deepEqual(sanitizeOnchainProfile({ displayName: 'Ghost', exists: false }), { displayName: null, nameBlocked: null, handleHash: null, avatarUri: null });
}));

test('pagination returns 25 rows and the total', async () => withDb(async (db) => {
  for (let n = 1; n <= 30; n += 1) await seedVerifiedSession(db, { wallet: W(n), score: 1000 - n });
  const first = await board(db);
  assert.equal(first.total, 30);
  assert.equal(first.rows.length, 25);
  assert.deepEqual(first.rows.map((row) => row.rank), Array.from({ length: 25 }, (_, i) => i + 1));
  const second = await board(db, { page: 2 });
  assert.equal(second.total, 30);
  assert.deepEqual(second.rows.map((row) => row.rank), [26, 27, 28, 29, 30]);
  assert.deepEqual((await board(db, { page: 3 })).rows, []);
}));

test('`you` reports the caller\'s standing', async () => withDb(async (db) => {
  for (let n = 1; n <= 30; n += 1) await seedVerifiedSession(db, { wallet: W(n), score: 1000 - n });
  const mine = await board(db, { wallet: W(27) });
  assert.equal(mine.rows.some((row) => row.wallet === W(27)), false, 'the caller is on page 2');
  assert.equal(mine.you.rank, 27);
  assert.equal(mine.you.score, 973);
  assert.match(mine.you.sessionId32, /^0x[0-9a-f]{64}$/);
  assert.equal(mine.you.shareId, mine.you.sessionId32.slice(2));
  assert.equal((await board(db, { wallet: W(27), q: 'nobody' })).you.rank, 27, 'search never changes the caller\'s rank');
  assert.equal((await board(db, { wallet: W(77) })).you, null);
}));

test('history sums and maxima exclude the current session', async () => withDb(async (db) => {
  const wallet = W(1);
  const stats = (kills, gas, level) => ({ kills, level, familyKills: { gasBeast: gas, goblin: 1 }, heroId: 'lit-valkyrie' });
  await seedVerifiedSession(db, { wallet, gameId: 'lester-blaster', status: 'confirmed', stats: stats(100, 5, 10) });
  await seedVerifiedSession(db, { wallet, gameId: 'lester-blaster', status: 'failed', stats: stats(50, 2, 30) });
  await seedVerifiedSession(db, { wallet, gameId: 'lester-blaster', status: 'pending', stats: { kills: 'many', level: 4 } });
  const current = await seedVerifiedSession(db, { wallet, gameId: 'lester-blaster', status: 'pending', stats: stats(1000, 99, 99) });
  await seedVerifiedSession(db, { wallet: W(2), gameId: 'lester-blaster', stats: stats(7000, 70, 70) });
  await seedVerifiedSession(db, { wallet, gameId: 'chikun', stats: { kills: 5000 } });
  await seedAchievementUnlock(db, { wallet, gameId: 'lester-blaster', achievementId: 'first-blood', sessionId32: current.sessionId32 });
  await seedAchievementUnlock(db, { wallet, gameId: 'chikun', achievementId: 'chikun-first-flight', sessionId32: current.sessionId32 });
  const history = await readAchievementHistory(db, {
    wallet, gameId: 'lester-blaster', excludeSessionId32: current.sessionId32,
    fields: { sum: ['kills', 'familyKills.gasBeast', 'noSuchStat'], max: ['level', 'familyKills.gasBeast'] },
  });
  assert.deepEqual(history, {
    wallet, gameId: 'lester-blaster', runs: 3,
    sums: { kills: 150, 'familyKills.gasBeast': 7, noSuchStat: 0 },
    maxima: { level: 30, 'familyKills.gasBeast': 5 },
    unlockedIds: ['first-blood'],
  });
  const withCurrent = await readAchievementHistory(db, { wallet, gameId: 'lester-blaster', fields: { sum: ['kills'], max: [] } });
  assert.equal(withCurrent.runs, 4);
  assert.equal(withCurrent.sums.kills, 1150);
  const empty = await readAchievementHistory(db, { wallet: W(9), gameId: 'stacked', fields: { sum: ['lines'], max: ['level'] } });
  assert.deepEqual(empty, { wallet: W(9), gameId: 'stacked', runs: 0, sums: { lines: 0 }, maxima: { level: 0 }, unlockedIds: [] });
}));

test('history rejects unsafe paths', async () => {
  const calls = [];
  const spy = { async query(sql) { calls.push(sql); return [{ runs: 0 }]; } };
  const wallet = W(1);
  for (const path of ["kills') FROM x; DROP TABLE verified_sessions; --", 'a.b.c', '1abc', '', 'kills ', 'familyKills.', "a'b", '{a}', 'a-b']) {
    await assert.rejects(readAchievementHistory(spy, { wallet, gameId: 'chikun', fields: { sum: [path], max: [] } }), TypeError, JSON.stringify(path));
    await assert.rejects(readAchievementHistory(spy, { wallet, gameId: 'chikun', fields: { sum: [], max: [path] } }), TypeError, JSON.stringify(path));
  }
  await assert.rejects(readAchievementHistory(spy, { wallet, gameId: 'chikun', fields: { sum: [42], max: [] } }), TypeError);
  await assert.rejects(readAchievementHistory(spy, { wallet, gameId: 'tetris', fields: {} }), TypeError);
  await assert.rejects(readAchievementHistory(spy, { wallet, gameId: 'chikun', fields: {}, excludeSessionId32: "x' OR 1=1" }), TypeError);
  assert.equal(calls.length, 0, 'no SQL is built from a rejected path');
});

test('rate limit counts per window and reports retry-after', async () => withDb(async (db) => {
  const start = Date.parse('2026-09-23T10:59:30.000Z');
  const hit = (bucket, nowMs) => hitRateLimit(db, { bucket, limit: 2, windowSeconds: 3600, nowMs });
  assert.deepEqual(await hit('refresh:ip:abc', start), { ok: true, hits: 1, retryAfterSeconds: 0 });
  assert.deepEqual(await hit('refresh:ip:abc', start + 1000), { ok: true, hits: 2, retryAfterSeconds: 0 });
  assert.deepEqual(await hit('refresh:ip:abc', start + 2000), { ok: false, hits: 3, retryAfterSeconds: 28 });
  assert.deepEqual(await hit('refresh:ip:other', start + 2000), { ok: true, hits: 1, retryAfterSeconds: 0 }, 'buckets are independent');
  assert.deepEqual(await hit('refresh:ip:abc', start + 31_000), { ok: true, hits: 1, retryAfterSeconds: 0 }, 'a new window starts at 11:00');
  await assert.rejects(hitRateLimit(db, { bucket: 'x'.repeat(129), limit: 1, windowSeconds: 60, nowMs: start }), TypeError);
}));

// polish-2: 'Combo total' and 'Levels' summed per-run bests. E6 reports the
// highest confirmed value of each per-run best as `bests`; `totals` still sums.
test('profile bests are the highest confirmed per-run value, and totals still sum', async () => withDb(async (db) => {
  const wallet = W(2);
  const now = Date.parse('2026-09-23T12:00:00.000Z');
  const stacked = (stats, extra = {}) => seedVerifiedSession(db, { wallet, gameId: 'stacked', stats: { score: 100, lines: 0, level: 1, quadClears: 0, perfectClears: 0, maxCombo: 0, survivalSeconds: 10, ...stats }, ...extra });
  await stacked({ lines: 12, level: 3, maxCombo: 4 });
  await stacked({ lines: 30, level: 9, maxCombo: 2 });
  await stacked({ lines: 99, level: 20, maxCombo: 50 }, { status: 'failed', lastError: 'rpc-timeout' });
  await stacked({ lines: 99, level: 21, maxCombo: 51 }, { status: 'pending' });
  const hmh = (stats) => seedVerifiedSession(db, { wallet, gameId: 'lester-blaster', stats: { score: 500, kills: 0, survivalSeconds: 60, maxCombo: 0, level: 1, bossKills: 0, ...stats } });
  await hmh({ kills: 10, level: 5, maxCombo: 7 });
  await hmh({ kills: 20, level: 4, maxCombo: 12, bossKills: 1 });
  await seedVerifiedSession(db, { wallet, gameId: 'chikun', stats: { score: 10, forksPassed: 5, nearMisses: 1, coinsCollected: 2, bestCombo: 3, survivalSeconds: 20, regionReached: 'coast', laps: 1 } });
  await seedVerifiedSession(db, { wallet, gameId: 'chikun', stats: { score: 20, forksPassed: 8, nearMisses: 0, coinsCollected: 4, bestCombo: 8, survivalSeconds: 30, regionReached: 'coast', laps: 2 } });

  for (const self of [false, true]) {
    const { games } = await readPublicProfile(db, wallet, { self, nowMs: now });
    assert.deepEqual(games.stacked.bests, { level: 9, maxCombo: 4 }, 'failed and pending runs never count');
    assert.equal(games.stacked.totals.lines, 42);
    assert.equal(games.stacked.totals.level, 12, 'totals keep summing every numeric headline key (contract §4.3.6)');
    assert.deepEqual(games['lester-blaster'].bests, { maxCombo: 12, level: 5 });
    assert.deepEqual([games['lester-blaster'].totals.kills, games['lester-blaster'].totals.bossKills], [30, 1]);
    assert.deepEqual(games.chikun.bests, { bestCombo: 8 });
    assert.deepEqual([games.chikun.totals.forksPassed, games.chikun.totals.laps], [13, 3]);
  }
  // A wallet with no runs reads zeros, like its totals.
  const empty = await readPublicProfile(db, W(3), { nowMs: now });
  assert.deepEqual(Object.fromEntries(Object.entries(empty.games).map(([gameId, game]) => [gameId, game.bests])), { 'lester-blaster': { maxCombo: 0, level: 0 }, chikun: { bestCombo: 0 }, stacked: { level: 0, maxCombo: 0 } });
}));

test('profile reads split the public and self views and take NFT flags from the catalog', async () => withDb(async (db) => {
  const wallet = W(1);
  const now = Date.parse('2026-09-23T12:00:00.000Z');
  const confirmed = await seedVerifiedSession(db, { wallet, score: 700 });
  const failed = await seedVerifiedSession(db, { wallet, score: 999, status: 'failed', lastError: 'rpc-timeout', nextAttemptAt: '2026-09-23T12:05:00.000Z', verifiedAt: '2026-09-23T11:00:00.000Z' });
  await seedVerifiedSession(db, { wallet, score: 5, status: 'failed', lastError: 'session-not-paid', verifiedAt: '2026-09-23T11:10:00.000Z' });
  await seedVerifiedSession(db, { wallet, score: 1, status: 'pending' });
  await seedVerifiedSession(db, { wallet, gameId: 'stacked', score: 4200, stats: { lines: 12, level: 3, quadClears: 1, perfectClears: 0, maxCombo: 4, survivalSeconds: 200.5 } });
  await seedWalletProfile(db, { wallet, displayName: 'Lit Pilot', preferences: { selectedCharacterId: 'lester' } });
  await seedAchievementUnlock(db, { wallet, achievementId: 'chikun-first-flight', sessionId32: confirmed.sessionId32, unlockedAt: '2026-09-23T10:02:00.000Z' });
  await seedAchievementUnlock(db, { wallet, achievementId: 'chikun-coast-legend', tier: 'platinum', nft: false, sessionId32: confirmed.sessionId32, unlockedAt: '2026-09-23T10:03:00.000Z' });
  const catalog = { nftAchievementIds: (gameId) => (gameId === 'chikun' ? ['chikun-coast-legend'] : []) };

  const publicView = await readPublicProfile(db, wallet, { nowMs: now, catalog });
  assert.deepEqual(publicView.profile, { displayName: 'Lit Pilot', avatarUri: 'lestersarcade:avatar/lester', hidden: false, onchainUpdatedAt: null });
  assert.deepEqual(publicView.recentSessions.map((row) => row.status), ['confirmed', 'confirmed'], 'the public view lists only confirmed sessions');
  assert.equal(publicView.preferences, null);
  assert.deepEqual(Object.keys(publicView.games).sort(), ['chikun', 'lester-blaster', 'stacked']);
  assert.deepEqual(publicView.games['lester-blaster'], { rankedRuns: 0, confirmedRuns: 0, bestScore: null, bestSessionId32: null, ranks: { weekly: null, monthly: null, allTime: null }, totals: { kills: 0, survivalSeconds: 0, maxCombo: 0, level: 0, bossKills: 0 }, bests: { maxCombo: 0, level: 0 }, lastPlayedAt: null });
  assert.equal(publicView.games.chikun.rankedRuns, 3, 'every verified run except pending counts');
  assert.equal(publicView.games.chikun.confirmedRuns, 1);
  assert.equal(publicView.games.chikun.bestScore, 700, 'unconfirmed scores never show publicly');
  assert.equal(publicView.games.chikun.bestSessionId32, confirmed.sessionId32);
  assert.deepEqual(publicView.games.chikun.ranks, { weekly: 1, monthly: 1, allTime: 1 });
  assert.equal(publicView.games.chikun.totals.forksPassed, 40);
  assert.equal(publicView.games.stacked.totals.survivalSeconds, 200.5);
  assert.deepEqual(publicView.games.chikun.bests, { bestCombo: 6 }, 'bests hold only the per-run-best keys of the game');
  assert.deepEqual(publicView.games.stacked.bests, { level: 3, maxCombo: 4 });
  assert.deepEqual(publicView.achievements.map((entry) => [entry.id, entry.nft, entry.tokenId]), [['chikun-first-flight', false, null], ['chikun-coast-legend', true, null]], 'nft comes from the current catalog, not the stored flag');

  const self = await readPublicProfile(db, wallet, { self: true, nowMs: now, catalog });
  assert.deepEqual(self.preferences, { selectedCharacterId: 'lester' });
  assert.equal(self.profile.nameBlocked, null);
  const byId = new Map(self.recentSessions.map((row) => [row.sessionId32, row]));
  assert.equal(self.recentSessions.length, 4, 'the self view adds every non-pending status');
  assert.deepEqual([byId.get(failed.sessionId32).retryable, byId.get(failed.sessionId32).lastError, byId.get(failed.sessionId32).nextAttemptAt], [true, 'rpc-timeout', '2026-09-23T12:05:00.000Z']);
  const dead = self.recentSessions.find((row) => row.lastError === 'session-not-paid');
  assert.equal(dead.retryable, false, 'a failed row without a next attempt is a dead letter');
  assert.equal(byId.get(confirmed.sessionId32).retryable, false);

  const saved = await writePreferences(db, wallet, { nameClaimDismissed: true });
  assert.deepEqual(saved.preferences, { selectedCharacterId: 'lester', nameClaimDismissed: true }, 'a PUT merges into the stored preferences');
  assert.match(saved.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal((await db.query('SELECT display_name FROM wallet_profiles WHERE wallet = $1', [wallet]))[0].display_name, 'Lit Pilot', 'preferences never touch the name');
}));

test('preferences merge by top-level key and the merged document keeps the byte cap', async () => withDb(async (db) => {
  const wallet = W(7);
  const stored = async () => JSON.parse((await db.query('SELECT preferences::text AS p FROM wallet_profiles WHERE wallet = $1', [wallet]))[0].p);
  assert.deepEqual((await writePreferences(db, wallet, { nameClaimDismissed: true })).preferences, { nameClaimDismissed: true }, 'the first PUT creates the row');
  const cosmetics = { chikun: { hat: 'crown' }, stacked: { skin: 'neon-grid' } };
  await writePreferences(db, wallet, { cosmetics, selectedCharacterId: 'lilly' });
  assert.deepEqual(await stored(), { nameClaimDismissed: true, cosmetics, selectedCharacterId: 'lilly' }, 'the unlockables PUT keeps the name prompt flag');
  await writePreferences(db, wallet, { nameClaimDismissed: false });
  assert.deepEqual(await stored(), { nameClaimDismissed: false, cosmetics, selectedCharacterId: 'lilly' }, 'the name prompt PUT keeps the cosmetics and the character');
  await writePreferences(db, wallet, { cosmetics: { chikun: { trail: 'sparks' } } });
  assert.deepEqual((await stored()).cosmetics, { chikun: { trail: 'sparks' } }, 'the whole value of a key is replaced, not deep-merged');

  // The cap counts the merged document the way JSON.stringify does.
  const big = (n) => ({ cosmetics: { chikun: Object.fromEntries(Array.from({ length: n }, (_, i) => [`slot-${'abcdefghijklmnopqrstuvwxyz'[i]}`, `cosmetic-id-${String(i).padStart(2, '0')}-${'x'.repeat(24)}`])) } });
  const before = await stored();
  const fits = { ...before, ...big(26) };
  const limit = Buffer.byteLength(JSON.stringify(fits), 'utf8');
  assert.ok(limit < 2048, `fixture fits (${limit} bytes)`);
  assert.notEqual(await writePreferences(db, wallet, big(26), { maxBytes: limit }), null, 'exactly at the cap is accepted');
  assert.equal(await writePreferences(db, wallet, { selectedCharacterId: 'lester-long-name' }, { maxBytes: limit }), null, 'a merge that grows past the cap is refused');
  assert.equal((await stored()).selectedCharacterId, 'lilly', 'a refused merge writes nothing');
}));

test('session reads hide pending rows, private columns and hidden names, and version the card', async () => withDb(async (db) => {
  const wallet = W(1);
  const best = await seedVerifiedSession(db, { wallet, score: 800, clientClaim: { score: 123456 }, plausibility: { flags: ['xp-near-ceiling'] } });
  const lower = await seedVerifiedSession(db, { wallet, score: 100 });
  const pending = await seedVerifiedSession(db, { wallet, score: 5, status: 'pending' });
  const submitted = await seedVerifiedSession(db, { wallet, score: 50, status: 'submitted' });
  const indexed = await seedVerifiedSession(db, { wallet: W(2), gameId: 'stacked', source: 'chain-index', score: 42 });
  await seedAchievementUnlock(db, { wallet, achievementId: 'chikun-coast-legend', tier: 'platinum', sessionId32: best.sessionId32, tokenId: '77' });
  const catalog = { nftAchievementIds: () => ['chikun-coast-legend'] };

  assert.equal(await readPublicSession(db, pending.sessionId32, { catalog }), null, 'pending runs are not public records');
  assert.equal(await readPublicSession(db, `0x${'ee'.repeat(32)}`, { catalog }), null);
  const session = await readPublicSession(db, best.sessionId32, { catalog });
  assert.equal(JSON.stringify(session).includes('123456'), false, 'client_claim is never returned');
  assert.equal(JSON.stringify(session).includes('xp-near-ceiling'), false, 'plausibility is never returned');
  assert.equal(session.verification, 'replay');
  assert.equal(session.gameTitle, "Chikun's Escape");
  assert.deepEqual(session.standing, { weekly: 1, monthly: 1, allTime: 1 });
  assert.deepEqual(session.achievements, [{ id: 'chikun-coast-legend', tier: 'platinum', nft: true, unlockedAt: '2026-09-23T10:02:00.000Z', tokenId: '77' }]);
  assert.deepEqual(session.contract, { kills: 0, maxCombo: 0, survivalSeconds: 60, bossId: null });
  assert.match(session.cardRev, /^[0-9a-f]{12}$/);
  // §7.5 computed independently: SHA-256 of the sorted-key JSON of exactly
  // { status, displayName, avatarUri, hidden, verification }, first 12 hex.
  assert.equal(session.cardRev, expectedCardRev({ status: 'confirmed', displayName: null, avatarUri: null, hidden: false, verification: 'replay' }));
  assert.equal(session.cardRev, '9aad35cebaa9', 'literal fixture for a confirmed, unnamed Chikun run');
  assert.equal(await cardRevision({ status: 'confirmed', displayName: null, avatarUri: null, hidden: false, verification: 'replay' }), '9aad35cebaa9');
  assert.deepEqual((await readPublicSession(db, lower.sessionId32, { catalog })).standing, { weekly: null, monthly: null, allTime: null }, 'standing only for the wallet\'s best session');
  assert.equal((await readPublicSession(db, submitted.sessionId32, { catalog })).status, 'submitted');
  assert.equal((await readPublicSession(db, indexed.sessionId32, { catalog })).verification, 'chain-index');

  await seedWalletProfile(db, { wallet, displayName: 'Lit Pilot' });
  const named = await readPublicSession(db, best.sessionId32, { catalog });
  assert.equal(named.displayName, 'Lit Pilot');
  assert.notEqual(named.cardRev, session.cardRev, 'a rename produces a new card revision');
  await seedWalletProfile(db, { wallet, displayName: 'Lit Pilot', hidden: true });
  const hidden = await readPublicSession(db, best.sessionId32, { catalog });
  assert.deepEqual([hidden.displayName, hidden.avatarUri, hidden.walletShort], [null, null, walletShort(wallet)]);
  assert.notEqual(hidden.cardRev, named.cardRev, 'hiding a profile produces a new card revision');
  await seedWalletProfile(db, { wallet, displayName: 'Lit Pilot', boardExcluded: true });
  assert.deepEqual((await readPublicSession(db, best.sessionId32, { catalog })).standing, { weekly: null, monthly: null, allTime: null });
}));

// SHA-256 over the sorted-key JSON, built by hand so the test does not reuse
// the module's canonicalSessionJson or sha256Hex.
function expectedCardRev(fields) {
  const sorted = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex').slice(0, 12);
}

test('the card revision follows §7.5 and changes when a run is published', async () => withDb(async (db) => {
  const wallet = W(3);
  await seedWalletProfile(db, { wallet, displayName: 'Ace Pilot', avatarUri: 'lestersarcade:avatar/lester' });
  const run = await seedVerifiedSession(db, { wallet, gameId: 'lester-blaster', score: 48210, status: 'submitted' });
  const submitted = await readPublicSession(db, run.sessionId32);
  assert.equal(submitted.cardRev, expectedCardRev({ status: 'submitted', displayName: 'Ace Pilot', avatarUri: 'lestersarcade:avatar/lester', hidden: false, verification: 'plausibility' }));
  await db.query("UPDATE verified_sessions SET status = 'confirmed', confirmed_at = now() WHERE session_id32 = $1", [run.sessionId32]);
  const confirmed = await readPublicSession(db, run.sessionId32);
  assert.equal(confirmed.cardRev, expectedCardRev({ status: 'confirmed', displayName: 'Ace Pilot', avatarUri: 'lestersarcade:avatar/lester', hidden: false, verification: 'plausibility' }));
  assert.notEqual(confirmed.cardRev, submitted.cardRev, 'publishing the run gives the card a new revision');
}));

test('E9 stats are the §6.3 headline subset', async () => withDb(async (db) => {
  const fullHmhStats = {
    score: 48210, kills: 120, bossKills: 1, eliteKills: 4, maxCombo: 30, level: 12, xp: 9000, survivalTicks: 36000, elapsedMs: 600000,
    survivalSeconds: 600, damageTaken: 350, damageDealt: 90000, healing: 40, litecoin: 77, weaponsUsed: ['pistol', 'railgun'],
    uniqueWeaponCount: 2, killsByRole: { grunt: 100, elite: 20 }, heroId: 'lilly', noDamage: 0, terminalReason: 'death',
  };
  const hmh = await seedVerifiedSession(db, { wallet: W(4), gameId: 'lester-blaster', stats: fullHmhStats });
  const session = await readPublicSession(db, hmh.sessionId32);
  assert.deepEqual(Object.keys(session.stats), ['kills', 'survivalSeconds', 'maxCombo', 'level', 'bossKills']);
  assert.deepEqual(session.stats, { kills: 120, survivalSeconds: 600, maxCombo: 30, level: 12, bossKills: 1 });
  const chikun = await seedVerifiedSession(db, { wallet: W(4) });
  assert.deepEqual(Object.keys((await readPublicSession(db, chikun.sessionId32)).stats), ['forksPassed', 'nearMisses', 'coinsCollected', 'bestCombo', 'survivalSeconds', 'regionReached', 'laps']);
}));
