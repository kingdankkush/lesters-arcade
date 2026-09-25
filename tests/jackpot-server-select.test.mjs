import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';

import { periodKeyFor } from '../apps/portal/src/leaderboard-engine.mjs';
import { readLeaderboard } from '../server/neon/queries.mjs';
import { periodKeyResetAt, periodStartMs } from '../server/neon/period-keys.mjs';
import { upsertCandidate, upsertWalletFlag } from '../server/jackpot/store.mjs';
import {
  KEEPER_KEEP, KEEPER_SELECT_LIMIT, SELECTION_SQL, chikunSeasonCatalog, roleWallets, seasonTextsFor, selectCandidates,
} from '../server/jackpot/select.mjs';
import {
  boundsIsoOf, boundsOf, dateRangeLabel, periodOfWeek, weekIndexOf, weekIndexOfKey, weekKeyOfIndex, weekStartOf,
} from '../server/jackpot/weeks.mjs';
import { weekBoundsOf as scriptBounds, weekIndexOf as scriptIndexOf, weekKeyOf as scriptKeyOf } from '../scripts/generate-litvm-jackpot.mjs';
import { activateLocalGames, deployLocalSuite, startLocalChain } from '../scripts/lib/local-chain.mjs';
import { deployLocalJackpot, fastLocalProvider, launchRules, reconnectWallets, setChainTime } from '../scripts/lib/local-jackpot.mjs';
import { createPgliteClient, seedWalletProfile } from './helpers/pglite-client.mjs';
import { CHIKUN, launchRulesRow, seedJackpotRun } from './fixtures/jackpot-server/helpers.mjs';

/**
 * jackpot-server AC4 and AC6 (design §A.2, §C.4 "Selection query"): the week
 * helpers are the contract's week math, and the keeper selection is stricter
 * than the weekly board, sorts on numeric scores, and keeps board order.
 */

const CONTRACT = `0x${'1a'.repeat(20)}`;
const W40 = 2961;
const KEY = '2026-W40';
const CUTOFF = '2026-10-05T06:00:00.000Z';
const RULES = launchRulesRow({ fromWeek: W40 });
const wallet = (n) => `0x${String(n).padStart(2, '0').repeat(20)}`;

async function withDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

const select = (db, extra = {}) => selectCandidates(db, { contract: CONTRACT, weekKey: KEY, rules: RULES, cutoffIso: CUTOFF, ...extra });

test('week helpers match the contract at every boundary', async () => {
  const named = [
    ['2026-09-21T00:00:00Z', 2960, '2026-W39'],
    ['2026-09-27T23:59:59Z', 2960, '2026-W39'],
    ['2026-09-28T00:00:00Z', 2961, '2026-W40'],
    ['2026-12-28T00:00:00Z', 2974, '2026-W53'],
    ['2027-01-03T23:59:59Z', 2974, '2026-W53'],
    ['2027-01-04T00:00:00Z', 2975, '2027-W01'],
  ];
  for (const [iso, index, key] of named) {
    const ts = Date.parse(iso) / 1000;
    assert.equal(weekIndexOf(ts), index, iso);
    assert.equal(scriptIndexOf(ts), index);
    assert.equal(weekKeyOfIndex(index), key);
    assert.equal(scriptKeyOf(index), key);
    assert.equal(periodKeyFor('weekly', ts * 1000), key, 'the board key');
    assert.equal(weekIndexOfKey(key), index);
    const period = periodOfWeek(index);
    assert.equal(period.startMs, periodStartMs('weekly', key));
    assert.equal(period.startMs, weekStartOf(index) * 1000);
    assert.equal(period.resetAt, periodKeyResetAt('weekly', key));
    assert.equal(Date.parse(period.resetAt) / 1000, boundsOf(index).close);
  }
  assert.equal(weekIndexOfKey('2026-W54'), null);
  assert.equal(weekIndexOfKey('2026-w40'), null);
  assert.deepEqual(boundsIsoOf(W40), {
    startsAt: '2026-09-28T00:00:00.000Z', closesAt: '2026-10-05T00:00:00.000Z', settleCutoffAt: '2026-10-05T06:00:00.000Z',
    candidateUntil: '2026-10-05T12:00:00.000Z', payoutAt: '2026-10-06T00:00:00.000Z',
  });
  assert.equal(dateRangeLabel(W40), 'Sep 28 – Oct 4, 2026');
  assert.equal(dateRangeLabel('2026-12-28T00:00:00.000Z'), 'Dec 28, 2026 – Jan 3, 2027');
  assert.equal(dateRangeLabel(weekStartOf(W40) * 1000, { timeZone: 'America/New_York' }), 'Sep 27 – Oct 3, 2026', 'a viewer zone shifts the label');

  // Against the deployed contract: weekOf at every boundary second, weekBounds with and without an extension.
  const chain = await startLocalChain();
  try {
    const provider = fastLocalProvider(chain);
    const wallets = reconnectWallets(chain.wallets, provider);
    const now = (await provider.getBlock('latest')).timestamp;
    await setChainTime(provider, weekStartOf(weekIndexOf(now) + 1) + 86_400);
    const suite = await deployLocalSuite({ provider, wallets });
    await activateLocalGames({ provider, record: suite, developer: wallets.developer, operator: wallets.operator });
    const { jackpot, record } = await deployLocalJackpot({ provider, wallets, record: suite, rules: { ...launchRules(suite), adminClearOnly: false } });
    const first = record.instances.chikun.firstWeek;
    for (const index of [first, first + 1, first + 7, 2961, 2974, 2975]) {
      const start = weekStartOf(index);
      for (const ts of [start - 1, start, start + 1, start + 604_799]) assert.equal(Number(await jackpot.weekOf(ts)), weekIndexOf(ts), `weekOf(${ts})`);
      const [s, c, cutoff, until, payout] = (await jackpot.weekBounds(index)).map(Number);
      assert.deepEqual({ start: s, close: c, settleCutoff: cutoff, candidateUntil: until, payoutAt: payout }, { ...boundsOf(index) }, `weekBounds(${index})`);
      assert.deepEqual({ ...boundsOf(index) }, scriptBounds(index));
    }
    await (await jackpot.connect(wallets.developer).extendWeek(first, 7_200)).wait();
    const [, , cutoff, until, payout] = (await jackpot.weekBounds(first)).map(Number);
    const extended = boundsOf(first, 7_200);
    assert.deepEqual([cutoff, until, payout], [extended.settleCutoff, extended.candidateUntil, extended.payoutAt], 'the extension shifts the last three');
  } finally {
    await chain.close();
  }
});

test('selection is stricter than the board, sorts scores numerically and keeps board order', async () => withDb(async (db) => {
  // 9,999 vs 48,213: a text sort would rank '9999' first.
  const low = await seedJackpotRun(db, { wallet: wallet(1), score: 9_999 });
  const high = await seedJackpotRun(db, { wallet: wallet(2), score: 48_213 });
  // A tie on score: the earlier confirmation ranks first, then the session id.
  const tieEarly = await seedJackpotRun(db, { wallet: wallet(3), score: 20_000, confirmedAt: '2026-10-01T10:00:00Z' });
  const tieLate = await seedJackpotRun(db, { wallet: wallet(4), score: 20_000, confirmedAt: '2026-10-01T11:00:00Z' });
  // One row per wallet: its best.
  const best = await seedJackpotRun(db, { wallet: wallet(5), score: 30_000 });
  await seedJackpotRun(db, { wallet: wallet(5), score: 29_000 });
  // Board-only rows: chain-index, late, mismatch.
  await seedJackpotRun(db, { wallet: wallet(6), score: 90_000, source: 'chain-index' });
  await seedJackpotRun(db, { wallet: wallet(7), score: 80_000, confirmedAt: '2026-10-05T06:00:01Z' });
  await seedJackpotRun(db, { wallet: wallet(8), score: 70_000, chainMismatch: true });

  const { rows, dropped, unknownSeason } = await select(db);
  assert.equal(unknownSeason, false);
  assert.deepEqual(dropped, []);
  assert.deepEqual(rows.map((row) => row.sessionId32), [high.sessionId32, best.sessionId32, tieEarly.sessionId32, tieLate.sessionId32, low.sessionId32]);
  assert.deepEqual(rows.map((row) => row.score), [48_213, 30_000, 20_000, 20_000, 9_999]);
  assert.deepEqual(Object.keys(rows[0]), ['sessionId32', 'wallet', 'score', 'confirmedAt', 'openedAt', 'entryAmountWei']);

  const board = await readLeaderboard(db, { gameId: 'chikun', seasonId: CHIKUN.seasonId, period: 'weekly', periodKey: KEY, pageSize: 25 });
  assert.deepEqual(board.rows.slice(0, 3).map((row) => row.score), [90_000, 80_000, 70_000], 'the board keeps chain-index, late and mismatched rows');
  assert.equal(board.rows.length, 8);
  const boardOrder = board.rows.map((row) => row.sessionId32).filter((id) => rows.some((row) => row.sessionId32 === id));
  assert.deepEqual(boardOrder, rows.map((row) => row.sessionId32), 'the jackpot keeps the board order of the rows it keeps');

  // The open-week leader: no cutoff (the late row is still excluded as chain-index/mismatch only).
  const open = await select(db, { cutoffIso: null, limit: 3, keep: 1 });
  assert.deepEqual(open.rows.map((row) => row.score), [80_000], 'with no cutoff the late run leads');

  // Keeper sizes and the SQL shape: numeric ORDER BY everywhere, text only in the projection.
  assert.deepEqual([KEEPER_SELECT_LIMIT, KEEPER_KEEP], [10, 5]);
  assert.match(SELECTION_SQL, /ORDER BY vs\.wallet, vs\.score DESC, vs\.confirmed_at ASC, vs\.session_id32 ASC/);
  assert.match(SELECTION_SQL, /ORDER BY b\.score DESC, b\.confirmed_at ASC, b\.session_id32 ASC/);
  assert.equal((SELECTION_SQL.match(/::text/g) ?? []).length, 1, 'the only cast to text is the projected score');
  assert.match(SELECTION_SQL, /entry_amount_wei::numeric >= \$7::numeric/);
}));

test('selection excludes late, chain-index, mismatched, excluded, blocked, disqualified, staff, underpaid and non-stock rows', async () => withDb(async (db) => {
  const keep = await seedJackpotRun(db, { wallet: wallet(10), score: 1_000, entryAmountWei: '100000000000000000' });
  const reserve = await seedJackpotRun(db, { wallet: wallet(11), score: 1_001, entryAmountWei: '102000000000000000' });
  const excluded = {
    underpaid: await seedJackpotRun(db, { wallet: wallet(12), score: 5_000, entryAmountWei: '99900000000000000' }),
    unpaid: await seedJackpotRun(db, { wallet: wallet(13), score: 5_001, entryAmountWei: null }),
    late: await seedJackpotRun(db, { wallet: wallet(14), score: 5_002, confirmedAt: '2026-10-05T06:00:00.001Z' }),
    chainIndex: await seedJackpotRun(db, { wallet: wallet(15), score: 5_003, source: 'chain-index' }),
    mismatch: await seedJackpotRun(db, { wallet: wallet(16), score: 5_004, chainMismatch: true }),
    boardExcluded: await seedJackpotRun(db, { wallet: wallet(17), score: 5_005 }),
    blocked: await seedJackpotRun(db, { wallet: wallet(18), score: 5_006 }),
    staffFlag: await seedJackpotRun(db, { wallet: wallet(19), score: 5_007 }),
    staffRole: await seedJackpotRun(db, { wallet: wallet(20), score: 5_008 }),
    disqualified: await seedJackpotRun(db, { wallet: wallet(21), score: 5_009 }),
    nonStock: await seedJackpotRun(db, { wallet: wallet(22), score: 5_010, evidenceOptions: { maxTicks: 10_800 } }),
    noEvidence: await seedJackpotRun(db, { wallet: wallet(23), score: 5_011, withEvidence: false }),
    otherWeek: await seedJackpotRun(db, { wallet: wallet(24), score: 5_012, openedAt: '2026-10-05T00:00:00.000Z' }),
    earlierWeek: await seedJackpotRun(db, { wallet: wallet(25), score: 5_013, openedAt: '2026-09-27T23:59:59.999Z' }),
    pending: await seedJackpotRun(db, { wallet: wallet(26), score: 5_014, status: 'submitted', confirmedAt: null }),
    otherSeason: await seedJackpotRun(db, { wallet: wallet(27), score: 5_015, seasonId: 'chikun-season-preview-0' }),
    overCap: await seedJackpotRun(db, { wallet: wallet(28), score: 5_016, survivalSeconds: 3_600 }),
  };
  await seedWalletProfile(db, { wallet: wallet(17), boardExcluded: true });
  await upsertWalletFlag(db, { contract: CONTRACT, wallet: wallet(18), blocked: true, reason: 'cheating' });
  await upsertWalletFlag(db, { contract: CONTRACT, wallet: wallet(19), staffEver: true });
  // Another instance's flags never apply here (rows are keyed by contract).
  await upsertWalletFlag(db, { contract: `0x${'2b'.repeat(20)}`, wallet: wallet(10), blocked: true });
  await upsertCandidate(db, { contract: CONTRACT, weekKey: KEY, sessionId32: excluded.disqualified.sessionId32, wallet: wallet(21), score: 5_009, source: 'public' });
  await db.query("UPDATE jackpot_candidates SET review = 'disqualified' WHERE session_id32 = $1", [excluded.disqualified.sessionId32]);

  const staff = roleWallets({ deployment: { trustedVerifier: wallet(20), relayer: `0x${'49'.repeat(20)}` }, jackpotInstance: { admin: `0x${'07'.repeat(20)}` } });
  assert.deepEqual([...staff].sort(), [wallet(20), `0x${'49'.repeat(20)}`, `0x${'07'.repeat(20)}`].sort());
  const { rows, dropped } = await select(db, { staff });
  assert.deepEqual(rows.map((row) => row.sessionId32), [reserve.sessionId32, keep.sessionId32], 'only the paid, settled, in-week, stock rows remain');
  assert.deepEqual(dropped, [{ sessionId32: excluded.nonStock.sessionId32, code: 'non-stock-client' }], 'a non-stock client is dropped in code');
  assert.deepEqual(rows.map((row) => row.entryAmountWei), ['102000000000000000', '100000000000000000'], '0.1 zkLTC meets minPaidWei; 0.0999 does not');

  // Survival cap 0 means none (the 3,600 s run returns), and a higher minPaid drops the 0.1 row.
  const uncapped = await select(db, { rules: { ...RULES, maxSurvivalSeconds: 0 }, staff });
  assert.ok(uncapped.rows.some((row) => row.sessionId32 === excluded.overCap.sessionId32));
  const strict = await select(db, { rules: { ...RULES, minPaidWei: '102000000000000000' }, staff });
  assert.deepEqual(strict.rows.map((row) => row.sessionId32), [reserve.sessionId32]);

  // The alt season admits the other season's rows; an unknown season selects nothing.
  const catalog = new Map([...chikunSeasonCatalog(), [ethers.id('chikun-season-preview-0'), 'chikun-season-preview-0']]);
  const alt = { ...RULES, altSeasonId32: ethers.id('chikun-season-preview-0') };
  assert.deepEqual(seasonTextsFor(alt, catalog), ['chikun-season-preview-1', 'chikun-season-preview-0']);
  const withAlt = await select(db, { rules: alt, seasons: seasonTextsFor(alt, catalog), staff });
  assert.ok(withAlt.rows.some((row) => row.sessionId32 === excluded.otherSeason.sessionId32));
  assert.equal(seasonTextsFor(alt), null, 'a season hash outside the catalog is unknown');
  const unknown = await select(db, { rules: { ...RULES, seasonId32: ethers.id('chikun-season-9') } });
  assert.deepEqual([unknown.unknownSeason, unknown.rows], [true, []]);
  assert.deepEqual(seasonTextsFor(RULES), [CHIKUN.seasonId], 'the week season comes from jackpot_rules via the catalog');

  // Limit and keep: at most `keep` passing rows out of `limit`.
  const many = await select(db, { rules: { ...RULES, maxSurvivalSeconds: 0, minPaidWei: '0' }, limit: 10, keep: 3 });
  assert.equal(many.rows.length, 3);
}));
