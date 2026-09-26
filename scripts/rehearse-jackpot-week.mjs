#!/usr/bin/env node
// The Chikun Weekly Jackpot rehearsal (jackpot-rehearsal slice; design §E E1, §G, Appendix K; brief AC2).
//
//   node scripts/rehearse-jackpot-week.mjs [--only R1,R13,...] [--out <path>] [--no-write] [--json]
//
// Runs scenarios R1-R20 (plus the R3 and R13 variants) on ONE local jackpot stack
// (scripts/lib/jackpot-rehearsal-driver.mjs): the in-process Hardhat chain, PGlite and every api/*.mjs
// handler mounted as production mounts it, with the chain and server clocks moved together. Each scenario
// takes the next unused week(s), plays real Ranked runs through the real endpoints (seed tickets logged,
// entries paid, evidence played for the issued seed, settled by the real relayer), drives the real
// weekly-jackpot cron, and acts as the admin (the owner page's call encoding), the operator
// (scripts/jackpot-actions.mjs) and the owner (scripts/jackpot-ops.mjs). It asserts on-chain state, the
// Neon mirrors, GET /api/jackpot through the UI's parseJackpot, and token balances, and checks
// balanceOf(jackpot) >= liabilities at the end of every scenario.
//
// The receipt, docs/qa/jackpot-rehearsal-<YYYYMMDD>.json (schema lesters-jackpot-rehearsal-v2), records per
// scenario: every check, the week keys, the transactions by role, the keeper's gas, the final balances,
// the invariant and `expectedMisses` (runs the screen is known not to catch: design §B.5; R16 is one, and
// it is not a failure). `productBugs` lists anything a scenario exposed in the product, with its fix.
//
// Safety: local only. No LiteForge transaction, no Vercel change, no production Neon, never the vault.
// JACKPOT_LIVE is not touched.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

import {
  DAY, DROPPED_AFTER_SECONDS, HOUR, MINUTE, TEST_WALLET, TOKEN, jackpotContract, revertReasonOf, startJackpotStack,
} from './lib/jackpot-rehearsal-driver.mjs';
import { attestLocalRun, deployLocalJackpot, deployMockToken, launchRules, openLocalSession } from './lib/local-jackpot.mjs';
import { startLocalHttp } from './lib/local-http.mjs';
import { localWalletKeys, serveJsonRpc } from './lib/local-chain.mjs';
import { jackpotModuleValue } from './generate-litvm-jackpot.mjs';
import { runJackpotLiveDryRun } from './jackpot-live-dry-run.mjs';
import { shareIdFor } from '../apps/portal/src/ranked-identity.mjs';
import { currentPrize, resetJackpotMemo } from '../apps/portal/src/jackpot/jackpot-client.mjs';
import { showEntryJackpot } from '../apps/portal/src/jackpot/jackpot-entry-line.mjs';
import { normalizeReview, timelineGeometry } from '../apps/portal/owner/jackpot-review-model.mjs';
import { jackpotWarnings } from '../apps/portal/owner/status.mjs';
import { buildChikunJackpotTease } from '../apps/chikun/src/presentation.mjs';
import { JACKPOT_LIVE } from '../apps/portal/src/jackpot-config.mjs';
import { dateRangeLabel } from '../server/jackpot/weeks.mjs';
import { fakeDocument, visibleText } from '../tests/helpers/jackpot-fake-dom.mjs';
import { buildChikunEvidence } from '../tests/fixtures/ranked/build-fixtures.mjs';
import { flapTicksOf, simulateChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const REHEARSAL_RECEIPT_SCHEMA = 'lesters-jackpot-rehearsal-v2';
export const REHEARSAL_SCRIPT_RELATIVE_PATH = 'scripts/rehearse-jackpot-week.mjs';
// The subset tests/jackpot-rehearsal.test.mjs runs inside npm test (brief AC3).
export const FAST_SUBSET = Object.freeze(['R1', 'R3a', 'R5', 'R10', 'R13', 'R15', 'R17']);
export const receiptPathFor = (yyyymmdd) => `docs/qa/jackpot-rehearsal-${yyyymmdd}.json`;

const lower = (value) => String(value ?? '').toLowerCase();
const tokens = (count) => BigInt(count) * TOKEN;
const bytes32 = (text) => ethers.encodeBytes32String(text);

// ---------------------------------------------------------------------------------------------------
// Scenario framework.

export class ScenarioFailure extends Error {
  constructor(checkId, detail) {
    super(`${checkId} failed${detail === undefined ? '' : `: ${brief(detail)}`}`);
    this.name = 'ScenarioFailure';
    this.checkId = checkId;
  }
}

function brief(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(plain(value));
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
  } catch {
    return String(value);
  }
}

// JSON-safe copy (bigint → decimal string).
export function plain(value) {
  return JSON.parse(JSON.stringify(value ?? null, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)));
}

function createScenarioContext(js, spec, { log }) {
  const checks = [];
  const weeks = new Set();
  const ctx = {
    js,
    id: spec.id,
    shared: spec.shared,
    checks,
    weeks,
    expectedMisses: [],
    notes: [],
    balances: [],
    instances: [],
    log: (message) => log(`[${spec.id}] ${message}`),
    week(index) {
      weeks.add(index);
      js.claimWeek(index);
      return index;
    },
    check(id, ok, detail) {
      checks.push({ id, ok: Boolean(ok), ...(detail === undefined ? {} : { detail: plain(detail) }) });
      if (!ok) throw new ScenarioFailure(id, detail);
      return true;
    },
    note(text) {
      ctx.notes.push(text);
    },
    // A token balance reported in the receipt at the end of the scenario.
    balance(label, address, token = js.tokenAddress) {
      ctx.balances.push({ label, address: lower(address), token: lower(token) });
    },
    // Another jackpot instance whose invariant the scenario checks too.
    instance(label, address, token) {
      ctx.instances.push({ label, address: lower(address), token: lower(token) });
    },
  };
  return ctx;
}

// Everything the receipt records about the transactions of a scenario, by role.
function roleOf(js, address, keepers) {
  const a = lower(address);
  if (keepers.has(a)) return 'keeper';
  if (a === lower(js.wallets.relayer.address)) return 'relayer';
  if (a === lower(js.wallets.operator.address)) return 'operator';
  if (js.adminWallets.has(a)) return 'admin';
  if (a === lower(js.wallets.funder.address)) return 'funder';
  return 'players';
}

export async function runScenario(js, spec, { log = () => {} } = {}) {
  const ctx = createScenarioContext(js, spec, { log });
  const startBlock = await js.blockNumber();
  const started = Date.now();
  const keepersBefore = new Set([...js.keeperAddresses]);
  let error = null;
  log(`[${spec.id}] ${spec.title}`);
  try {
    await spec.run(ctx);
  } catch (caught) {
    error = caught;
  } finally {
    js.seams.select = null;
    js.seams.fault = null;
  }
  const endBlock = await js.blockNumber();
  const keepers = new Set([...keepersBefore, ...js.keeperAddresses]);
  const txs = await js.transactionsBetween(startBlock, endBlock);
  const transactions = { total: txs.length, keeper: 0, relayer: 0, operator: 0, admin: 0, funder: 0, players: 0, reverted: 0 };
  let keeperGas = 0n;
  for (const tx of txs) {
    const role = roleOf(js, tx.from, keepers);
    transactions[role] += 1;
    if (tx.status !== 1) transactions.reverted += 1;
    if (role === 'keeper') keeperGas += tx.gasUsed;
  }
  const invariants = [{ label: 'main', ...(await js.invariant()) }];
  for (const extra of ctx.instances) invariants.push({ label: extra.label, ...(await js.invariant(jackpotContract(extra.address, js.provider), extra.token)) });
  const finalBalances = {};
  for (const entry of ctx.balances) {
    // eslint-disable-next-line no-await-in-loop
    finalBalances[entry.label] = { address: entry.address, token: entry.token, balanceWei: (await js.tokenBalance(entry.address, entry.token)).toString() };
  }
  finalBalances.jackpot = { address: js.address, token: js.tokenAddress, balanceWei: (await js.tokenBalance(js.address)).toString() };
  const invariantOk = invariants.every((entry) => entry.ok);
  if (!error && !invariantOk) error = new ScenarioFailure('invariant', invariants);
  if (!error) ctx.checks.push({ id: 'invariant', ok: true, detail: plain(invariants) });
  const failed = error ? { checkId: error.checkId ?? 'unexpected-error', message: brief(error.shortMessage ?? error.message ?? error) } : null;
  if (error && !(error instanceof ScenarioFailure)) ctx.checks.push({ id: 'unexpected-error', ok: false, detail: `${error?.name ?? 'Error'}: ${brief(error?.shortMessage ?? error?.message ?? error)}` });
  const result = {
    id: spec.id,
    title: spec.title,
    status: error ? 'failed' : 'passed',
    weekKeys: [...ctx.weeks].sort((a, b) => a - b).map((week) => js.weekKey(week)),
    checks: ctx.checks,
    passedChecks: ctx.checks.filter((check) => check.ok).length,
    transactions,
    keeperGasUsed: keeperGas.toString(),
    finalBalances,
    invariant: invariants,
    expectedMisses: ctx.expectedMisses,
    notes: ctx.notes,
    durationMs: Date.now() - started,
    ...(failed ? { failure: failed } : {}),
  };
  log(`[${spec.id}] ${result.status.toUpperCase()} (${result.passedChecks}/${result.checks.length} checks, ${result.durationMs} ms)${failed ? `: ${failed.message}` : ''}`);
  return result;
}

// ---------------------------------------------------------------------------------------------------
// Shared steps.

const OPEN_ACTION = (action) => ['pending', 'signed', 'submitted'].includes(action.status) || (action.status === 'failed' && action.nextAttemptAt);

async function openActions(js, week, contract = js.address) {
  return (await js.actionRows(week, contract)).filter(OPEN_ACTION);
}

// Candidate rows the keeper still has to screen.
async function pendingScreens(js, week, contract = js.address) {
  return (await js.candidateRows(week, contract)).filter((row) => row.screen === 'pending' && row.review !== 'disqualified');
}

async function keeperIdle(js, week) {
  return (await openActions(js, week)).length === 0 && (await pendingScreens(js, week)).length === 0;
}

// Runs the cron until no keeper action of the week is open, then once more 5 minutes later so the index
// mirrors the last sends (the mirrors lag the chain by one run, as in production). → the number of runs
// that drained it (null when it never drained)
async function drainKeeper(ctx, week, { max = 6, id = 'keeper-drained' } = {}) {
  const runs = await ctx.js.cronUntil(() => keeperIdle(ctx.js, week), { max });
  ctx.check(id, runs !== null, {
    week: ctx.js.weekKey(week),
    open: (await openActions(ctx.js, week)).map((action) => [action.kind, action.status, action.lastError]),
    unscreened: (await pendingScreens(ctx.js, week)).length,
  });
  await ctx.js.advanceBy(5 * MINUTE);
  await ctx.js.runJackpotCron(1);
  return runs;
}

// C + 2 h: the keeper's first selection, screen and sends.
async function toSelection(ctx, week, { max = 6 } = {}) {
  await ctx.js.advanceTo(ctx.js.at(week, 'close', 2 * HOUR + MINUTE));
  return drainKeeper(ctx, week, { max, id: 'selection-drained' });
}

// Settle cutoff + 11 min: the last re-select, then 'review' (and any new rows screened and sent).
async function toReview(ctx, week, { extension = 0, max = 6 } = {}) {
  await ctx.js.advanceTo(ctx.js.at(week, 'settleCutoff', 11 * MINUTE, extension));
  const runs = await ctx.js.cronUntil(async () => (await ctx.js.weekRow(week)).status === 'review', { max });
  const row = await ctx.js.weekRow(week);
  ctx.check('review', runs !== null && row.status === 'review', { status: row.status });
  // Rows the last re-select added are screened and sent while the week is in review.
  await drainKeeper(ctx, week, { max, id: 'review-drained' });
  return runs;
}

// Payout time + 1 min: the cron until the week reaches one of `statuses`.
async function toPayout(ctx, week, { statuses = ['paid'], extension = 0, max = 5, id = 'payout' } = {}) {
  await ctx.js.advanceTo(ctx.js.at(week, 'payoutAt', MINUTE, extension));
  const runs = await ctx.js.cronUntil(async () => statuses.includes((await ctx.js.weekRow(week)).status), { max });
  const row = await ctx.js.weekRow(week);
  ctx.check(id, runs !== null && statuses.includes(row.status), { status: row.status, lastError: row.lastError });
  return row;
}

function topOf(runs) {
  return [...runs].sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt || (a.sessionId32 < b.sessionId32 ? -1 : 1))[0];
}

async function stranger(ctx, label = 'stranger') {
  return ctx.js.freshWallet(`${ctx.id} ${label}`);
}

async function expectPaid(ctx, week, winner, prizeWei, { before = null, contract = ctx.js.address, token = ctx.js.tokenAddress } = {}) {
  const row = await ctx.js.weekRow(week, contract);
  const chain = await ctx.js.chainWeek(week, jackpotContract(contract, ctx.js.provider));
  ctx.check('winner-mirror', row.status === 'paid' && row.winner === winner.wallet && row.winningSession === winner.sessionId32 && row.prizeWei === String(prizeWei), { status: row.status, winner: row.winner, prize: row.prizeWei });
  ctx.check('winner-chain', chain.status === 'paid' && chain.winner === winner.wallet && chain.winningSession === winner.sessionId32 && chain.prize === BigInt(prizeWei) && chain.unclaimed === 0n, { status: chain.status, winner: chain.winner, prize: chain.prize });
  if (before !== null) {
    const after = await ctx.js.tokenBalance(winner.wallet, token);
    ctx.check('winner-balance', after - before === BigInt(prizeWei), { before, after });
  }
  ctx.balance(`winner ${winner.label ?? winner.wallet}`, winner.wallet, token);
  // GET /api/jackpot through the UI's parser shows the same outcome.
  const { previous } = await apiPrevious(ctx, week, contract);
  ctx.check('api-paid', previous?.status === 'paid' && previous.winner?.wallet === winner.wallet && previous.prizeWei === String(prizeWei) && previous.unclaimedWei === '0' && previous.finalizeTx === row.finalizeTxHash, previous && {
    status: previous.status, winner: previous.winner?.wallet, prizeWei: previous.prizeWei, finalizeTx: previous.finalizeTx,
  });
  return row;
}

// GET /api/jackpot through the UI's parseJackpot, and the row of `week` (the previous week, or a history row)
// of the instance at `contract`.
async function apiPrevious(ctx, week, contract = ctx.js.address) {
  const answer = await ctx.js.jackpotApi();
  ctx.check('api-parsed', answer.status === 200 && answer.api !== null, { status: answer.status });
  const key = ctx.js.weekKey(week);
  const previous = answer.api.previous?.weekKey === key && (answer.api.previous.contract ?? answer.api.contract) === contract ? answer.api.previous : null;
  return { api: answer.api, previous: previous ?? answer.api.history.find((row) => row.weekKey === key && row.contract === contract) ?? null };
}

async function board(ctx, week) {
  const response = await ctx.js.api('GET', `/api/leaderboard?game=chikun&period=weekly&periodKey=${ctx.js.weekKey(week)}`);
  ctx.check('board-read', response.status === 200, { status: response.status });
  return response.body;
}

// An in-process fetch for the UI modules (the response object the browser's fetch gives).
function inProcessFetch(js) {
  return async (url) => {
    const target = String(url);
    const response = await js.api('GET', target.startsWith('http') ? new URL(target).pathname + new URL(target).search : target);
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: { get: (key) => response.headers?.[String(key).toLowerCase()] ?? null },
      json: async () => response.body,
    };
  };
}

// ---------------------------------------------------------------------------------------------------
// Scenarios R1-R12.

async function r1(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  const funded = await js.fund(W, tokens(10_000));
  ctx.check('fund-10000', funded.ok, funded.reason);
  const [a, b, c] = await js.freshWallets(3, 'R1 player');
  const runs = [
    await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.5 }),
    await js.playRankedChikunRun({ player: b, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 1.0 }),
    await js.playRankedChikunRun({ player: c, openedAt: js.at(W, 'start', 3 * DAY), maxMinutes: 0.5 }),
  ];
  const top = topOf(runs);
  ctx.check('seed-tickets-logged', (await js.db.query("SELECT count(*)::int AS n FROM seed_ticket_log WHERE session_handle IN (SELECT jsonb_array_elements_text($1::jsonb))", [JSON.stringify(runs.map((run) => run.sessionHandle))]))[0].n === 3);

  // The open week through the UI's parser (after the cron's index run): the funded prize and a
  // score-only provisional leader.
  await js.runJackpotCron(1);
  const open = await js.jackpotApi();
  ctx.check('api-open-week', open.api?.current?.weekKey === js.weekKey(W) && open.api.current.pot.funded === true && open.api.current.pot.prizeWei === tokens(10_000).toString(), open.body?.current?.pot);
  ctx.check('api-open-leader', open.api.current.leader?.score === top.score && open.api.current.leader.provisional === true && Object.keys(open.api.current.leader).sort().join() === 'provisional,score,screened', open.api.current.leader);
  ctx.check('ui-prize-text', currentPrize(open.api)?.text({ first: true }) === '10,000 tCHIKUN (testnet token, no value)');

  // C + 2 h: the keeper selects, screens, submits and clears.
  const selectRuns = await toSelection(ctx, W);
  const chain = await js.chainWeek(W);
  ctx.check('listed-by-keeper', chain.list.length === 3 && chain.list[0].sessionId32 === top.sessionId32, chain.list);
  for (const run of runs) ctx.check(`cleared-${run.label}`, (await js.review(run.sessionId32)) === 'cleared');
  const rows = await js.candidateRows(W);
  ctx.check('mirror-candidates', rows.length === 3 && rows.every((row) => row.source === 'keeper' && row.screen === 'pass' && row.review === 'cleared' && row.onChain), rows.map((row) => [row.source, row.screen, row.review, row.onChain]));
  ctx.check('selection-runs', selectRuns <= 3, { runs: selectRuns });

  await toReview(ctx, W);
  // Anyone may finalize at C + 24 h, not at C + 24 h - 1 s.
  const payoutAt = js.at(W, 'payoutAt');
  const outsider = await stranger(ctx);
  const early = await js.sendReverting(outsider, js.jackpotCall('finalize', [W]), { at: payoutAt - 1 });
  ctx.check('finalize-early-reverts', early.reason === 'PAYOUT_NOT_DUE' && early.minedStatus === 0 && early.blockTimestamp === payoutAt - 1, early);
  const before = await js.tokenBalance(top.wallet);
  await js.advanceTo(payoutAt, { mine: false });
  const finalized = await js.pageCall(outsider, 'finalize', { week: W });
  ctx.check('finalize-by-anyone-at-payout', finalized.ok && finalized.blockTimestamp === payoutAt, { ok: finalized.ok, reason: finalized.reason, at: finalized.blockTimestamp });
  const cronRuns = await js.cronUntil(async () => (await js.weekRow(W)).status === 'paid', { max: 3 });
  ctx.check('mirror-paid', cronRuns !== null);
  await expectPaid(ctx, W, top, tokens(10_000), { before });
  const keeperFinalize = (await js.actionRows(W)).find((action) => action.kind === 'finalize');
  ctx.check('keeper-finalize-not-sent', !keeperFinalize || keeperFinalize.txHash === null || keeperFinalize.lastError === 'already-done', keeperFinalize);

  // The board's top eligible wallet is the winner.
  const weekly = await board(ctx, W);
  ctx.check('board-top-is-winner', weekly.rows[0]?.wallet === top.wallet, weekly.rows.slice(0, 3).map((row) => [row.wallet, row.score]));
  // The API, the profile (token and date range) and the share page (champion badge).
  const { previous } = await apiPrevious(ctx, W);
  ctx.check('api-previous-paid', previous?.status === 'paid' && previous.winner?.wallet === top.wallet && previous.prizeWei === tokens(10_000).toString() && previous.token.symbol === 'tCHIKUN', previous);
  const profile = await js.profile(top.wallet);
  const win = profile?.jackpot?.wins?.[0];
  const row = await js.weekRow(W);
  ctx.check('profile-win', win?.weekKey === js.weekKey(W) && win.token.symbol === 'tCHIKUN' && win.token.testnet === true && win.startsAt === row.startsAt && win.closesAt === row.closesAt && win.status === 'paid', win);
  const share = await js.api('GET', `/s/${shareIdFor(top.sessionId32)}`);
  const badge = `Weekly Jackpot Champion · ${dateRangeLabel(row.startsAt)}`;
  ctx.check('share-champion-badge', share.status === 200 && String(share.body).includes(badge), { status: share.status, badge });
  const loser = runs.find((run) => run !== top);
  const other = await js.api('GET', `/s/${shareIdFor(loser.sessionId32)}`);
  ctx.check('share-no-badge-for-others', other.status === 200 && !String(other.body).includes('Weekly Jackpot Champion'));
  ctx.balance('funder', js.wallets.funder.address);
}

async function r2(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(5_000))).ok);
  const [a, b, challenger] = [await js.freshWallet('R2 honest a'), await js.freshWallet('R2 honest b'), await js.freshWallet('R2 challenger')];
  const runA = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 0.5 });
  const runB = await js.playRankedChikunRun({ player: b, openedAt: js.at(W, 'start', DAY + HOUR), maxMinutes: 0.75 });
  const best = await js.playRankedChikunRun({ player: challenger, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 1.5 });
  ctx.check('challenger-is-best', best.score > runA.score && best.score > runB.score);
  // The keeper's selection is made to miss the best session (censorship), for the whole week.
  const dropped = [];
  js.seams.select = (rows) => rows.filter((row) => {
    if (row.sessionId32 !== best.sessionId32) return true;
    dropped.push(row.sessionId32);
    return false;
  });
  await toSelection(ctx, W);
  await toReview(ctx, W);
  ctx.check('keeper-censored', dropped.length >= 2 && !(await js.candidateRows(W)).some((row) => row.sessionId32 === best.sessionId32) && (await js.chainWeek(W)).list.length === 2, { dropped: dropped.length });
  // C + 8 h: the player puts the better session on chain.
  await js.advanceTo(js.at(W, 'close', 8 * HOUR));
  const submitted = await js.submitCandidate(challenger, best.sessionId32);
  ctx.check('challenge-submitted', submitted.ok && (await js.chainWeek(W)).list[0].sessionId32 === best.sessionId32, submitted.reason);
  const runs = await js.cronUntil(async () => (await js.review(best.sessionId32)) === 'cleared' && await keeperIdle(js, W), { max: 3 });
  ctx.check('challenger-cleared-within-three-runs', runs !== null && runs <= 3, { runs });
  await js.advanceBy(5 * MINUTE);
  await js.runJackpotCron(1);
  const row = (await js.candidateRows(W)).find((candidate) => candidate.sessionId32 === best.sessionId32);
  ctx.check('challenger-mirror', row?.source === 'public' && row.screen === 'pass' && row.review === 'cleared', row && [row.source, row.screen, row.review]);
  const before = await js.tokenBalance(best.wallet);
  await toPayout(ctx, W);
  await expectPaid(ctx, W, best, tokens(5_000), { before });
}

// R3: the leader is a scripted-pilot run; the admin decides (a: disqualify → #2 paid; b: clear → paid).
async function flaggedLeaderWeek(ctx, { decision }) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(3_000))).ok);
  const [pilotWallet, a, b] = [await js.freshWallet(`${ctx.id} pilot`), await js.freshWallet(`${ctx.id} honest a`), await js.freshWallet(`${ctx.id} honest b`)];
  const pilot = await js.playRankedChikunRun({ player: pilotWallet, openedAt: js.at(W, 'start', DAY), pilot: 'route', maxMinutes: 2.5 });
  const runA = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 1.5 });
  const runB = await js.playRankedChikunRun({ player: b, openedAt: js.at(W, 'start', 3 * DAY), maxMinutes: 0.75 });
  ctx.check('pilot-leads', pilot.score > runA.score && runA.score > runB.score, [pilot.score, runA.score, runB.score]);
  await toSelection(ctx, W);
  const pilotRow = (await js.candidateRows(W)).find((row) => row.sessionId32 === pilot.sessionId32);
  const holds = pilotRow?.screenCodes ?? [];
  ctx.check('pilot-held-by-h4-h6', pilotRow?.screen === 'hold' && holds.some((code) => ['H4', 'H5', 'H6'].includes(code)), { screen: pilotRow?.screen, codes: holds });
  ctx.check('pilot-flagged-on-chain', (await js.review(pilot.sessionId32)) === 'flagged' && ethers.decodeBytes32String(await js.jackpot.reviewReason(pilot.sessionId32)) === 'screen-hold');
  ctx.check('honest-cleared', (await js.review(runA.sessionId32)) === 'cleared' && (await js.review(runB.sessionId32)) === 'cleared');
  await toReview(ctx, W);
  const row = await toPayout(ctx, W, { statuses: ['awaiting-admin'], id: 'awaiting-admin' });
  ctx.check('admin-waiting-since', row.adminWaitingSince !== null);
  const outsider = await stranger(ctx);
  const blocked = await js.sendReverting(outsider, js.jackpotCall('finalize', [W]));
  ctx.check('finalize-reverts-leader-not-cleared', blocked.reason === 'LEADER_NOT_CLEARED' && blocked.minedStatus === 0, blocked);
  const health = await js.health();
  ctx.check('status-page-warns', health.jackpot?.awaitingAdmin >= 1 && jackpotWarnings(health.jackpot).some((warning) => warning.id === 'jackpot-awaiting-admin'), health.jackpot);
  // The owner reviews the week (GET /api/jackpot/review as the live on-chain admin).
  const review = await js.reviewApi(W);
  const model = normalizeReview(review.body);
  const reviewed = model?.candidates.find((candidate) => candidate.sessionId === pilot.sessionId32);
  ctx.check('review-api', review.status === 200 && reviewed && reviewed.holdCodes.length > 0 && timelineGeometry(review.body.candidates.find((candidate) => candidate.sessionId32 === pilot.sessionId32).timeline) !== null, { status: review.status });
  if (decision === 'disqualify') {
    const done = await js.admin('disqualify', { sessionId: pilot.sessionId32, wholeWalletForWeek: false, reason: 'automation' });
    ctx.check('admin-disqualifies', done.ok, done.reason);
    const before = await js.tokenBalance(runA.wallet);
    const runs = await js.cronUntil(async () => (await js.weekRow(W)).status === 'paid', { max: 4 });
    ctx.check('paid-after-decision', runs !== null);
    await expectPaid(ctx, W, runA, tokens(3_000), { before });
    const { previous } = await apiPrevious(ctx, W);
    const listed = previous.candidates.find((candidate) => candidate.review === 'disqualified');
    ctx.check('api-shows-disqualified-reason', listed?.reason === 'automation', previous.candidates);
  } else {
    const done = await js.admin('clear', { sessionId: pilot.sessionId32 });
    ctx.check('admin-clears', done.ok && (await js.jackpot.adminReviewed(pilot.sessionId32)) === true, done.reason);
    const before = await js.tokenBalance(pilot.wallet);
    const runs = await js.cronUntil(async () => (await js.weekRow(W)).status === 'paid', { max: 4 });
    ctx.check('paid-after-decision', runs !== null);
    await expectPaid(ctx, W, pilot, tokens(3_000), { before });
  }
}

async function r4(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(2_000))).ok);
  const [forger, a, b] = [await js.freshWallet('R4 forged record'), await js.freshWallet('R4 honest a'), await js.freshWallet('R4 honest b')];
  const forged = await js.playRankedChikunRun({ player: forger, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.5 });
  // A forged record: on chain and verified, but the server holds no evidence for it.
  await js.db.query('DELETE FROM session_evidence WHERE session_id32 = $1', [forged.sessionId32]);
  const runA = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 1.0 });
  await js.playRankedChikunRun({ player: b, openedAt: js.at(W, 'start', 3 * DAY), maxMinutes: 0.5 });
  await toSelection(ctx, W);
  ctx.check('not-selected-without-evidence', !(await js.candidateRows(W)).some((row) => row.sessionId32 === forged.sessionId32));
  await js.advanceTo(js.at(W, 'close', 3 * HOUR));
  const submitted = await js.submitCandidate(forger, forged.sessionId32);
  ctx.check('submitted-publicly', submitted.ok, submitted.reason);
  await drainKeeper(ctx, W);
  const row = (await js.candidateRows(W)).find((candidate) => candidate.sessionId32 === forged.sessionId32);
  ctx.check('integrity-fail', row?.screen === 'integrity-fail' && row.screenCodes.includes('H7') && row.features?.integrity?.code === 'evidence-missing', { screen: row?.screen, codes: row?.screenCodes, integrity: row?.features?.integrity });
  ctx.check('flagged-integrity', (await js.review(forged.sessionId32)) === 'flagged' && ethers.decodeBytes32String(await js.jackpot.reviewReason(forged.sessionId32)) === 'integrity');
  await toReview(ctx, W);
  await toPayout(ctx, W, { statuses: ['awaiting-admin'], id: 'never-auto-paid' });
  ctx.check('not-paid', (await js.chainWeek(W)).status === 'open');
  ctx.check('admin-disqualifies', (await js.admin('disqualify', { sessionId: forged.sessionId32, wholeWalletForWeek: true, reason: 'integrity' })).ok);
  const before = await js.tokenBalance(runA.wallet);
  ctx.check('paid-next', (await js.cronUntil(async () => (await js.weekRow(W)).status === 'paid', { max: 4 })) !== null);
  await expectPaid(ctx, W, runA, tokens(2_000), { before });
}

async function r5(ctx) {
  const { js } = ctx;
  const W1 = ctx.week(await js.beginWeek());
  ctx.check('fund-w1', (await js.fund(W1, tokens(1_000))).ok);
  // The only run of the week is ineligible (a staff wallet: the operator).
  await js.playRankedChikunRun({ player: js.wallets.operator, openedAt: js.at(W1, 'start', DAY), maxMinutes: 0.5 });
  await toSelection(ctx, W1);
  ctx.check('no-candidates', (await js.candidateRows(W1)).length === 0 && (await js.chainWeek(W1)).list.length === 0);
  await toReview(ctx, W1);
  const row = await toPayout(ctx, W1, { statuses: ['rolled'], id: 'keeper-finalizes-rollover' });
  const W2 = ctx.week(W1 + 1);
  const finalize = (await js.actionRows(W1)).find((action) => action.kind === 'finalize');
  ctx.check('keeper-finalized-empty-leader', finalize?.status === 'confirmed' && finalize.txHash && lower((await js.provider.getTransaction(finalize.txHash)).from) === lower(js.keeperWallet.address), finalize);
  const chain1 = await js.chainWeek(W1);
  ctx.check('rolled-on-chain', chain1.status === 'rolled' && chain1.winner === ethers.ZeroAddress && chain1.prize === 0n);
  ctx.check('rolled-mirror', row.rolledToWeek === js.weekKey(W2) && row.winner === null, row);
  const pot2 = (await js.chainWeek(W2)).pot;
  ctx.check('carried-into-next-week', pot2.carriedIn === tokens(1_000), pot2);
  // Next week: its own funding plus the carried pot, paid R1-style.
  ctx.check('fund-w2', (await js.fund(W2, tokens(500))).ok);
  await js.runJackpotCron(1);
  const open = await js.jackpotApi();
  ctx.check('api-next-week-pot', open.api?.current?.weekKey === js.weekKey(W2) && open.api.current.pot.fundedWei === tokens(500).toString() && open.api.current.pot.carriedInWei === tokens(1_000).toString() && open.api.current.pot.prizeWei === tokens(1_500).toString(), open.body?.current?.pot);
  const { previous } = await apiPrevious(ctx, W1);
  ctx.check('api-previous-rolled', previous?.status === 'rolled' && previous.winner === null, previous);
  const [a, b] = await js.freshWallets(2, 'R5 player');
  const runA = await js.playRankedChikunRun({ player: a, openedAt: js.at(W2, 'start', 2 * DAY), maxMinutes: 1.0 });
  const runB = await js.playRankedChikunRun({ player: b, openedAt: js.at(W2, 'start', 3 * DAY), maxMinutes: 0.5 });
  const top = topOf([runA, runB]);
  await toSelection(ctx, W2);
  await toReview(ctx, W2);
  const before = await js.tokenBalance(top.wallet);
  await toPayout(ctx, W2);
  await expectPaid(ctx, W2, top, tokens(1_500), { before });
}

// R6: a run opened in W settles at C + 6 h + 1 s (a relayer outage near the close). R7 continues the week.
async function r6(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(2_000))).ok);
  const [a, late] = [await js.freshWallet('R6 honest'), await js.freshWallet('R6 late settler')];
  const runA = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 0.5 });
  // The late run is played on Sunday and posted at once, but the relayer is out of gas until after the
  // cutoff (the outage the admin's extension is for): the server verified it on time, the chain late.
  const played = await js.playRankedChikunRun({ player: late, openedAt: js.at(W, 'close', -3 * HOUR), maxMinutes: 1.5, settle: false });
  await js.advanceTo(played.openedAt + played.survivalSeconds + 5);
  const relayer = js.wallets.relayer.address;
  const relayerBalance = await js.provider.getBalance(relayer);
  await js.provider.send('hardhat_setBalance', [relayer, '0x0']);
  const first = await js.postSettle(played);
  ctx.check('settle-accepted-then-stalls', first.status === 200 && first.body.status !== 'confirmed', { status: first.status, state: first.body?.status, error: first.body?.lastError ?? first.body?.error });
  await toSelection(ctx, W);
  // The relayer is refilled after the cutoff; the settle-retry cron publishes at C + 6 h + 1 s.
  await js.provider.send('hardhat_setBalance', [relayer, ethers.toQuantity(relayerBalance)]);
  const cutoff = js.at(W, 'settleCutoff');
  await js.advanceTo(cutoff + 1, { mine: false });
  const retry = await js.api('GET', '/api/cron/settle-retry', { headers: { authorization: `Bearer ${js.env.CRON_SECRET}` } });
  ctx.check('settle-retry-cron', retry.status === 200, retry.body);
  const record = await js.ranked.scores.getSession(played.sessionId32);
  ctx.check('published-at-cutoff-plus-1s', record.exists && Number(record.submittedAt) === cutoff + 1, { submittedAt: Number(record.submittedAt), cutoff });
  const eligibility = await js.checkEligibility(played.sessionId32);
  ctx.check('on-chain-settled-late', eligibility.ok === false && eligibility.reason === 'SETTLED_LATE', eligibility);
  const refused = await js.submitCandidate(late, played.sessionId32);
  ctx.check('public-submit-refused', refused.ok === false && refused.reason === 'SETTLED_LATE', refused);
  await toReview(ctx, W);
  ctx.check('excluded-by-selection', !(await js.candidateRows(W)).some((row) => row.sessionId32 === played.sessionId32));
  const weekly = await board(ctx, W);
  const lateRow = weekly.rows.find((row) => row.sessionId32 === played.sessionId32);
  ctx.check('board-still-shows-it', lateRow && weekly.rows[0].sessionId32 === played.sessionId32, weekly.rows.slice(0, 3).map((row) => [row.wallet, row.score]));
  ctx.note('Documented divergence (design B.5 item 10): the weekly board ranks the late run first; the jackpot excludes it (SETTLED_LATE).');
  const [session] = await js.db.query('SELECT score::text AS score, round(extract(epoch FROM verified_at))::text AS verified_at FROM verified_sessions WHERE session_id32 = $1', [played.sessionId32]);
  const lateScore = Number(session.score);
  const { previous } = await apiPrevious(ctx, W);
  ctx.check('api-candidates-exclude-late-run', previous?.status === 'review' && previous.candidates.length === 1 && previous.candidates[0].score === runA.score && lateScore > runA.score, previous && { status: previous.status, candidates: previous.candidates.map((row) => row.score), late: lateScore });
  ctx.shared.r6 = { W, runA, late: { ...played, score: lateScore, submittedAt: Number(record.submittedAt), verifiedAt: Number(session.verified_at) } };
}

async function r7(ctx) {
  const { js } = ctx;
  const state = ctx.shared.r6;
  ctx.check('r6-state', Boolean(state), 'R7 continues the week of R6');
  const { W, runA, late } = state;
  ctx.week(W);
  ctx.check('week-in-review', (await js.weekRow(W)).status === 'review');
  // The admin extends W by 12 h after the keeper reached review.
  const extended = await js.admin('extend', { week: W, extraSeconds: 12 * HOUR });
  ctx.check('admin-extends', extended.ok, extended.reason);
  const chain = await js.chainWeek(W);
  ctx.check('payout-moved', chain.payoutAt === js.at(W, 'payoutAt', 12 * HOUR) && chain.extension === 12 * HOUR, chain);
  const runs = await js.runJackpotCron(1);
  const row = await js.weekRow(W);
  ctx.check('reselect-row', runs[0].status === 200 && row.status === 'selecting' && row.extensionSeconds === 12 * HOUR && row.payoutAt === new Date(js.at(W, 'payoutAt', 12 * HOUR) * 1000).toISOString(), { status: row.status, extension: row.extensionSeconds });
  ctx.check('late-run-now-eligible', (await js.checkEligibility(late.sessionId32)).ok === true);
  await toReview(ctx, W, { extension: 12 * HOUR });
  const lateRow = (await js.candidateRows(W)).find((candidate) => candidate.sessionId32 === late.sessionId32);
  ctx.check('late-run-selected', lateRow?.source === 'keeper' && lateRow.onChain && lateRow.review === 'cleared', lateRow && [lateRow.source, lateRow.onChain, lateRow.review, lateRow.screen, lateRow.screenCodes]);
  const outsider = await stranger(ctx);
  await js.advanceTo(js.at(W, 'payoutAt', MINUTE));
  const early = await js.sendReverting(outsider, js.jackpotCall('finalize', [W]));
  ctx.check('not-due-at-c-plus-24h', early.reason === 'PAYOUT_NOT_DUE', early);
  const before = await js.tokenBalance(late.wallet);
  await toPayout(ctx, W, { extension: 12 * HOUR });
  const paid = await js.weekRow(W);
  ctx.check('paid-at-c-plus-36h', Date.parse(paid.finalizedAt) >= js.at(W, 'payoutAt', 12 * HOUR) * 1000, paid.finalizedAt);
  await expectPaid(ctx, W, { ...late, label: 'R6 late settler' }, tokens(2_000), { before });
  ctx.check('honest-not-paid', (await js.weekRow(W)).winner !== runA.wallet);
}

async function r8(ctx) {
  const { js } = ctx;
  const current = js.currentWeek();
  const W = Math.max(current + 1, (js.lastUsedWeek ?? 0) + 1);
  // The cap is in the week's rules, scheduled the week before; the next week goes back to no cap.
  const capped = await js.operatorAction('schedule-rules', { argv: ['--from-week', String(W), '--max-prize', '1000'] });
  const uncapped = await js.operatorAction('schedule-rules', { argv: ['--from-week', String(W + 1), '--max-prize', '0'] });
  ctx.check('rules-scheduled', capped.receipts.length === 1 && uncapped.receipts.length === 1);
  ctx.week(await js.beginWeek());
  ctx.check('week', js.currentWeek() === W);
  ctx.check('rules-in-force', BigInt((await js.jackpot.rulesFor(W)).maxPrizeWei) === tokens(1_000) && BigInt((await js.jackpot.rulesFor(W + 1)).maxPrizeWei) === 0n);
  ctx.check('fund', (await js.fund(W, tokens(2_500))).ok);
  await js.runJackpotCron(1);
  const open = await js.jackpotApi();
  const pot = open.api?.current?.pot;
  ctx.check('api-cap', pot?.prizeCapWei === tokens(1_000).toString() && pot.prizeWei === tokens(1_000).toString() && pot.carryOverWei === tokens(1_500).toString() && pot.totalWei === tokens(2_500).toString(), pot);
  ctx.check('ui-cap-note', currentPrize(open.api)?.capNote === 'up to 1,000 tCHIKUN; the rest rolls over', currentPrize(open.api)?.capNote);
  const [a, b] = await js.freshWallets(2, 'R8 player');
  const runA = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.0 });
  const runB = await js.playRankedChikunRun({ player: b, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 0.5 });
  const top = topOf([runA, runB]);
  await toSelection(ctx, W);
  await toReview(ctx, W);
  const before = await js.tokenBalance(top.wallet);
  await toPayout(ctx, W);
  await expectPaid(ctx, W, top, tokens(1_000), { before });
  const next = ctx.week(W + 1);
  const nextPot = (await js.chainWeek(next)).pot;
  ctx.check('excess-reaches-current-week', nextPot.carriedIn === tokens(1_500), nextPot);
  const events = await js.db.query("SELECT amount_wei FROM jackpot_events WHERE contract = $1 AND event = 'CapExcessCarried' AND week_key = $2", [js.address, js.weekKey(W)]);
  ctx.check('cap-excess-event', events.length === 1 && events[0].amount_wei === tokens(1_500).toString(), events);
  const nextApi = await js.jackpotApi();
  ctx.check('api-carried', nextApi.api?.current?.weekKey === js.weekKey(next) && nextApi.api.current.pot.carriedInWei === tokens(1_500).toString() && nextApi.api.current.pot.funded === true);
  // The next week pays the carried excess (so no later scenario inherits it).
  const c = await js.freshWallet('R8 next-week player');
  const runC = await js.playRankedChikunRun({ player: c, openedAt: js.at(next, 'start', 2 * DAY), maxMinutes: 0.5 });
  await toSelection(ctx, next);
  await toReview(ctx, next);
  const beforeC = await js.tokenBalance(runC.wallet);
  await toPayout(ctx, next);
  await expectPaid(ctx, next, runC, tokens(1_500), { before: beforeC });
}

async function r9(ctx) {
  const { js } = ctx;
  const operator = js.wallets.operator;
  // A separate instance whose prize token is the blacklist mock.
  const blk = await deployMockToken('BlacklistToken', [], operator);
  const blkAddress = lower(await blk.getAddress());
  await (await blk.mint(js.wallets.funder.address, tokens(100_000))).wait();
  const deployed = await deployLocalJackpot({
    provider: js.provider, wallets: js.wallets, record: js.record, token: blkAddress, keeper: js.keeperWallet.address, admin: js.adminWallet.address,
    rules: { ...launchRules(js.record), adminClearOnly: false }, tokenTestnet: true,
  });
  const record = deployed.record;
  const address = lower(record.instances.chikun.address);
  ctx.instance('blacklist instance', address, blkAddress);
  ctx.check('instance-token', record.instances.chikun.token.symbol === 'BLKMOCK');
  const previous = await js.useInstance({ record });
  try {
    ctx.check('rules-indexed', (await js.runJackpotCron(1))[0].status === 200);
    const W = ctx.week(await js.beginWeek());
    ctx.check('first-week', W >= Number(record.instances.chikun.firstWeek));
    ctx.check('fund', (await js.fund(W, tokens(800), { jackpot: address, token: blkAddress })).ok);
    const [winner, other, payee] = [await js.freshWallet('R9 winner'), await js.freshWallet('R9 other'), await js.freshWallet('R9 claim payee')];
    const run = await js.playRankedChikunRun({ player: winner, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.0 });
    await js.playRankedChikunRun({ player: other, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 0.5 });
    // The token freezes the winner (a blacklist, like USDC/USDT).
    await (await blk.connect(operator).setBlacklisted(winner.address, true)).wait();
    await toSelection(ctx, W);
    await toReview(ctx, W);
    await toPayout(ctx, W, { statuses: ['claim-pending'], id: 'claim-pending' });
    const chain = await js.chainWeek(W, jackpotContract(address, js.provider));
    ctx.check('prize-transfer-failed', chain.status === 'paid' && chain.winner === run.wallet && chain.unclaimed === tokens(800) && chain.prize === tokens(800), chain);
    const failedEvents = await js.db.query("SELECT amount_wei FROM jackpot_events WHERE contract = $1 AND event = 'PrizeTransferFailed'", [address]);
    ctx.check('prize-transfer-failed-event', failedEvents.length === 1 && failedEvents[0].amount_wei === tokens(800).toString());
    const answer = await js.jackpotApi();
    ctx.check('api-claim-pending', answer.api?.previous?.weekKey === js.weekKey(W) && answer.api.previous.status === 'claim-pending' && answer.api.previous.unclaimedWei === tokens(800).toString() && answer.api.token.symbol === 'BLKMOCK', answer.body?.previous);
    const profile = await js.profile(run.wallet);
    const win = profile.jackpot.wins.find((entry) => entry.contract === address);
    ctx.check('profile-claim-pending', win?.status === 'claim-pending' && win.unclaimedWei === tokens(800).toString() && win.token.symbol === 'BLKMOCK', win);
    const health = await js.health();
    ctx.check('status-page-warns', health.jackpot?.claimPending === 1 && jackpotWarnings(health.jackpot).some((warning) => warning.id === 'jackpot-claim-pending'), health.jackpot);
    const claimed = await js.claim(winner, W, payee.address, { jackpot: address, token: blkAddress });
    ctx.check('claim-to-another-address', claimed.ok && BigInt(await blk.balanceOf(payee.address)) === tokens(800), claimed.reason);
    ctx.balance('claim payee', payee.address, blkAddress);
    ctx.check('mirror-paid', (await js.cronUntil(async () => (await js.weekRow(W, address)).status === 'paid', { max: 3 })) !== null);
    const after = await js.jackpotApi();
    ctx.check('api-paid', after.api?.previous?.status === 'paid' && after.api.previous.unclaimedWei === '0', after.body?.previous);
  } finally {
    await js.useInstance(previous);
  }
  ctx.check('main-instance-back', (await js.runJackpotCron(1))[0].status === 200 && js.address === lower(previous.record.instances.chikun.address));
}

async function r10(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(1_500))).ok);
  const [a, b] = await js.freshWallets(2, 'R10 player');
  const runA = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.0 });
  const runB = await js.playRankedChikunRun({ player: b, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 0.5 });
  const keeper = js.keeperWallet.address;
  const startNonce = await js.nonceOf(keeper);
  const startBlock = await js.blockNumber();
  await js.advanceTo(js.at(W, 'close', 2 * HOUR + MINUTE));
  const faults = {};
  for (const stage of ['after-cas', 'after-broadcast', 'before-receipt']) {
    const fault = js.faultOnce({ stage });
    // eslint-disable-next-line no-await-in-loop
    const [response] = await js.runJackpotCron(1, { fault });
    faults[stage] = { status: response.status, fired: fault.state.fired };
    ctx.check(`killed-${stage}`, response.status === 500 && fault.state.fired !== null, faults[stage]);
    // eslint-disable-next-line no-await-in-loop
    await js.advanceBy(5 * MINUTE);
  }
  ctx.check('cas-without-broadcast', (await js.provider.getTransaction(faults['after-cas'].fired.txHash)) === null, faults['after-cas'].fired);
  await drainKeeper(ctx, W, { max: 6 });
  await toReview(ctx, W);
  await toPayout(ctx, W);
  await expectPaid(ctx, W, topOf([runA, runB]), tokens(1_500));
  const actions = await js.actionRows(W);
  const sent = actions.filter((action) => action.status === 'confirmed' && action.txHash && action.lastError !== 'already-done');
  const keeperTxs = (await js.transactionsBetween(startBlock, await js.blockNumber())).filter((tx) => tx.from === lower(keeper));
  const endNonce = await js.nonceOf(keeper);
  ctx.check('nonce-advances-by-distinct-actions', endNonce - startNonce === sent.length && keeperTxs.length === sent.length, { nonceDelta: endNonce - startNonce, actions: sent.length, keeperTxs: keeperTxs.length });
  ctx.check('no-duplicate-transactions', new Set(sent.map((action) => action.id)).size === sent.length && keeperTxs.every((tx) => tx.status === 1 && sent.some((action) => action.txHash === tx.hash)), keeperTxs.map((tx) => [tx.nonce, tx.status]));
  const nonces = keeperTxs.map((tx) => tx.nonce).sort((a, b) => a - b);
  ctx.check('no-nonce-gap', nonces.every((nonce, index) => nonce === startNonce + index) && nonces.includes(faults['after-cas'].fired.nonce), { nonces, unbroadcast: faults['after-cas'].fired.nonce });
  const dropped = actions.find((action) => action.id === faults['after-cas'].fired.id);
  ctx.check('dropped-detected', dropped?.infraFailures >= 1, dropped);
  ctx.note(`keeper faults: ${JSON.stringify(Object.fromEntries(Object.entries(faults).map(([stage, value]) => [stage, value.fired?.kind])))}; the after-cas action (recorded, never broadcast) is found dropped once the ${DROPPED_AFTER_SECONDS} s receipt window passes and re-signed, its unused nonce taken by the next send (no gap); the other two confirm from chain state.`);
}

async function r11(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(1_200))).ok);
  // Rotate the keeper first (the old one stays staffEver) and record the change publicly (E5 practice).
  const oldKeeper = js.keeperWallet;
  const newKeeper = await js.freshWallet('R11 new keeper');
  const rotated = await js.operatorAction('set-keeper', { args: [newKeeper.address] });
  ctx.check('keeper-rotated', rotated.receipts.length === 1 && lower(await js.jackpot.keeper()) === lower(newKeeper.address));
  await js.setKeeperKey(newKeeper.privateKey);
  js.recordRoles({ keeper: newKeeper.address });
  ctx.check('old-keeper-blocked', (await js.admin('block', { wallet: oldKeeper.address, reason: 'staff' })).ok);
  const [h1, h2, h3] = await js.freshWallets(3, 'R11 honest');
  const honest = [
    await js.playRankedChikunRun({ player: h1, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.0 }),
    await js.playRankedChikunRun({ player: h2, openedAt: js.at(W, 'start', DAY + HOUR), maxMinutes: 0.75 }),
  ];
  // Staff and blocked wallets play better runs through the real endpoints.
  const staffPlayers = [
    ['admin', js.adminWallet, 'STAFF_WALLET'], ['operator', js.wallets.operator, 'STAFF_WALLET'], ['rotated-out keeper', oldKeeper, 'STAFF_WALLET'],
    ['current keeper', newKeeper, 'STAFF_WALLET'], ['verifier', js.wallets.verifier, 'WALLET_BLOCKED'], ['funder', js.wallets.funder, 'WALLET_BLOCKED'],
  ];
  const staffRuns = [];
  let at = js.at(W, 'start', 2 * DAY);
  for (const [role, wallet, expected] of staffPlayers) {
    at += HOUR;
    // eslint-disable-next-line no-await-in-loop
    staffRuns.push({ role, expected, wallet, run: await js.playRankedChikunRun({ player: wallet, openedAt: at, maxMinutes: 1.5 }) });
  }
  // The test wallet and the relayer have no Ranked client of their own here: their runs are opened and
  // verified on chain directly (the test wallet by impersonation).
  const chainOnly = [];
  for (const [role, address] of [['test wallet', TEST_WALLET], ['relayer', js.wallets.relayer.address]]) {
    at += HOUR;
    // eslint-disable-next-line no-await-in-loop
    await js.provider.send('hardhat_impersonateAccount', [ethers.getAddress(address)]);
    // eslint-disable-next-line no-await-in-loop
    await js.provider.send('hardhat_setBalance', [ethers.getAddress(address), ethers.toQuantity(10n ** 20n)]);
    const signer = new ethers.JsonRpcSigner(js.provider, ethers.getAddress(address));
    const sessionId = ethers.hexlify(ethers.randomBytes(32)).toLowerCase();
    // eslint-disable-next-line no-await-in-loop
    await js.advanceTo(at, { mine: false });
    // eslint-disable-next-line no-await-in-loop
    await openLocalSession({ provider: js.provider, record: js.record, player: signer, sessionId });
    // eslint-disable-next-line no-await-in-loop
    const { run, signature } = await attestLocalRun({ provider: js.provider, record: js.record, player: signer, verifierKey: localWalletKeys().verifier, sessionId, score: 50_000n, survivalSeconds: 700n, runtimeId: ethers.id('chikun:canvas-runtime-v7') });
    // eslint-disable-next-line no-await-in-loop
    await (await js.suite.scores.connect(js.wallets.relayer).submitVerifiedSession(run, [], signature)).wait();
    chainOnly.push({ role, address: lower(address), signer, sessionId32: sessionId, expected: 'WALLET_BLOCKED' });
  }
  await js.clock.sync();
  // The open week: the provisional leader is the best honest score, never a staff one.
  const best = topOf(honest);
  await js.runJackpotCron(1);
  const open = await js.jackpotApi();
  ctx.check('open-leader-is-honest', open.api?.current?.leader?.score === best.score, { leader: open.api?.current?.leader, best: best.score, staff: staffRuns.map((entry) => entry.run.score) });
  // The admin pauses before the close. Funding and public submissions still work while paused.
  ctx.check('admin-pause', (await js.admin('pause')).ok && (await js.jackpot.paused()) === true);
  const topUp = await js.fund(W, tokens(300));
  ctx.check('funding-while-paused', topUp.ok, topUp.reason);
  const late = await js.playRankedChikunRun({ player: h3, openedAt: js.at(W, 'close', -2 * HOUR), maxMinutes: 0.5 });
  honest.push(late);
  const publicSubmit = await js.submitCandidate(h3, late.sessionId32);
  ctx.check('submission-while-paused', publicSubmit.ok, publicSubmit.reason);
  for (const entry of staffRuns) {
    // eslint-disable-next-line no-await-in-loop
    const refused = await js.submitCandidate(entry.wallet, entry.run.sessionId32);
    ctx.check(`never-candidate-${entry.role.replaceAll(' ', '-')}`, refused.ok === false && refused.reason === entry.expected, refused);
  }
  for (const entry of chainOnly) {
    // eslint-disable-next-line no-await-in-loop
    const refused = await js.submitCandidate(entry.signer, entry.sessionId32);
    ctx.check(`never-candidate-${entry.role.replaceAll(' ', '-')}`, refused.ok === false && refused.reason === entry.expected, refused);
  }
  // C + 2 h: the keeper lists only honest runs; its clears wait for the pause.
  await js.advanceTo(js.at(W, 'close', 2 * HOUR + MINUTE));
  await js.runJackpotCron(3);
  const rows = await js.candidateRows(W);
  const staffWallets = new Set([...staffRuns.map((entry) => lower(entry.wallet.address)), ...chainOnly.map((entry) => entry.address)]);
  ctx.check('keeper-selects-no-staff', rows.length === 3 && rows.every((row) => !staffWallets.has(row.wallet)), rows.map((row) => [js.label(row.wallet), row.source]));
  const clears = (await js.actionRows(W)).filter((action) => action.kind === 'clear');
  ctx.check('clears-wait-for-pause', clears.length === 3 && clears.every((action) => action.status === 'failed' && action.lastError === 'jackpot-paused'), clears.map((action) => [action.status, action.lastError]));
  ctx.check('nothing-cleared-on-chain', (await Promise.all(honest.map((run) => js.review(run.sessionId32)))).every((review) => review === 'none'));
  ctx.check('submits-not-blocked-by-pause', (await js.chainWeek(W)).list.length === 3);
  // Past the payout time the paused week waits: finalize reverts PAUSED, the clears keep waiting, and the
  // status page shows the pause (the keeper's waiting clears keep the week in 'selecting').
  await js.advanceTo(js.at(W, 'payoutAt', MINUTE));
  await js.runJackpotCron(2);
  const outsider = await stranger(ctx);
  const paused = await js.sendReverting(outsider, js.jackpotCall('finalize', [W]));
  ctx.check('finalize-blocked-by-pause', paused.reason === 'PAUSED' && paused.minedStatus === 0, paused);
  const waiting = await js.weekRow(W);
  ctx.check('paused-week-waits', !['paid', 'finalizing'].includes(waiting.status) && (await js.chainWeek(W)).status === 'open', { status: waiting.status });
  const health = await js.health();
  ctx.check('status-page-shows-pause', health.jackpot?.paused?.onChain === true && jackpotWarnings(health.jackpot).some((warning) => warning.id === 'jackpot-paused'), health.jackpot?.paused);
  // The admin lifts the pause but holds the week: the clears go through, the payout waits.
  ctx.check('admin-unpause', (await js.admin('unpause')).ok);
  ctx.check('admin-hold', (await js.admin('hold', { week: W, reason: 'investigation' })).ok);
  const clearedRuns = await js.cronUntil(async () => (await Promise.all(honest.map((run) => js.review(run.sessionId32)))).every((review) => review === 'cleared') && (await js.weekRow(W)).status === 'awaiting-admin', { max: 5 });
  ctx.check('cleared-after-unpause', clearedRuns !== null, { status: (await js.weekRow(W)).status });
  const held = await js.sendReverting(outsider, js.jackpotCall('finalize', [W]));
  ctx.check('finalize-blocked-by-hold', held.reason === 'WEEK_HELD', held);
  const heldRow = await js.weekRow(W);
  ctx.check('held-week-waits', heldRow.status === 'awaiting-admin' && heldRow.held === true && heldRow.adminWaitingSince !== null, { status: heldRow.status, held: heldRow.held });
  ctx.check('admin-release', (await js.admin('release', { week: W })).ok);
  const before = await js.tokenBalance(best.wallet);
  ctx.check('paid-after-release', (await js.cronUntil(async () => (await js.weekRow(W)).status === 'paid', { max: 4 })) !== null);
  await expectPaid(ctx, W, best, tokens(1_500), { before });
  for (const address of [oldKeeper.address, newKeeper.address, js.adminWallet.address, js.wallets.operator.address]) {
    // eslint-disable-next-line no-await-in-loop
    ctx.check(`staff-ever-${js.label(address) ?? address.slice(0, 10)}`, (await js.jackpot.staffEver(address)) === true);
  }
}

async function r12(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  const [a] = await js.freshWallets(1, 'R12 player');
  await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.0 });
  // Tokens sent straight to the contract are not attributed to any week (stray).
  await (await js.token.connect(js.wallets.funder).transfer(js.address, tokens(50))).wait();
  await js.runJackpotCron(1);
  const open = await js.jackpotApi();
  ctx.check('api-unfunded', open.api?.current?.weekKey === js.weekKey(W) && open.api.current.pot.funded === false && open.api.current.pot.totalWei === '0', open.body?.current?.pot);
  ctx.check('ui-renders-no-amount', currentPrize(open.api) === null);
  const tease = buildChikunJackpotTease(open.api, Date.parse(open.api.serverTime));
  ctx.check('child-says-no-prize', tease?.rewards === 'Weekly Jackpot: no prize funded this week' && !/\d/.test(tease.rewards), tease);
  const keeper = js.keeperWallet.address;
  const nonce = await js.nonceOf(keeper);
  await js.advanceTo(js.at(W, 'close', 2 * HOUR + MINUTE));
  await js.runJackpotCron(1);
  ctx.check('unfunded', (await js.weekRow(W)).status === 'unfunded');
  await js.advanceTo(js.at(W, 'payoutAt', HOUR));
  await js.runJackpotCron(2);
  ctx.check('zero-keeper-transactions', (await js.nonceOf(keeper)) === nonce && (await js.actionRows(W)).length === 0 && (await js.candidateRows(W)).length === 0);
  const { previous } = await apiPrevious(ctx, W);
  ctx.check('api-previous-unfunded', previous?.status === 'unfunded' && previous.pot.funded === false && previous.prizeWei === null && previous.winner === null, previous);
  // The stray tokens: only the excess over liabilities can be swept, to the residual recipient.
  const recipient = lower(await js.jackpot.residualRecipient());
  const before = await js.tokenBalance(recipient);
  const swept = await js.operatorAction('sweep-stray', { args: [js.tokenAddress] });
  ctx.check('stray-swept', swept.receipts.length === 1 && (await js.tokenBalance(recipient)) - before === tokens(50));
}

// ---------------------------------------------------------------------------------------------------
// Scenarios R13-R20 (the adversarial set).

async function sybilWeek(ctx, { variant }) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(5_000))).ok);
  const honestWallets = await js.freshWallets(variant ? 6 : 5, `${ctx.id} honest`);
  const honest = [];
  for (const [index, wallet] of honestWallets.entries()) {
    // eslint-disable-next-line no-await-in-loop
    honest.push(await js.playRankedChikunRun({ player: wallet, openedAt: js.at(W, 'start', DAY + index * HOUR), maxMinutes: 0.4 + (honestWallets.length - index) * 0.02 }));
  }
  const ranked = [...honest].sort((a, b) => b.score - a.score);
  const top5 = ranked.slice(0, 5);
  const sixth = variant ? ranked[5] : null;
  // Five decoy wallets settle scripted-pilot runs (1 minute), higher than every honest run, after the
  // keeper's first selection and before the cutoff (their sessions were paid on Sunday, in W).
  const decoyWallets = await js.freshWallets(5, `${ctx.id} decoy`);
  const decoys = [];
  for (const [index, wallet] of decoyWallets.entries()) {
    // eslint-disable-next-line no-await-in-loop
    decoys.push(await js.playRankedChikunRun({ player: wallet, openedAt: js.at(W, 'close', -HOUR + index * 5 * MINUTE), pilot: 'route', maxMinutes: 1.0, settle: false }));
  }
  await toSelection(ctx, W);
  const list0 = (await js.chainWeek(W)).list.map((row) => row.sessionId32);
  ctx.check('honest-hold-top-5', list0.length === 5 && top5.every((run) => list0.includes(run.sessionId32)), { listed: list0.length });
  ctx.check('honest-cleared', (await Promise.all(top5.map((run) => js.review(run.sessionId32)))).every((review) => review === 'cleared'));
  if (sixth) ctx.check('sixth-never-listed', !(await js.jackpot.wasListed(sixth.sessionId32)));
  for (const [index, run] of [...decoys.entries()]) {
    // eslint-disable-next-line no-await-in-loop
    decoys[index] = await js.settleRun(run, { settleAt: js.at(W, 'close', 4 * HOUR + index * 5 * MINUTE) });
  }
  ctx.check('decoys-outscore-honest', decoys.every((run) => run.score > ranked[0].score) && decoys.every((run) => run.submittedAt < js.at(W, 'settleCutoff')), decoys.map((run) => run.score));
  const decoyIds = new Set(decoys.map((run) => run.sessionId32));
  if (variant) {
    // The keeper's selection never sees the decoys here (as if they had reached no Neon selection), so the
    // attacker lists them itself at C + 11 h 59 min: the worst timing for the defence.
    js.seams.select = (rows) => rows.filter((row) => !decoyIds.has(row.sessionId32));
  }
  await toReview(ctx, W);
  await js.advanceTo(js.at(W, 'close', 11 * HOUR + 59 * MINUTE));
  const attempts = [];
  for (const run of decoys) {
    // eslint-disable-next-line no-await-in-loop
    attempts.push(await js.submitCandidate(run.player, run.sessionId32));
  }
  if (variant) {
    ctx.check('decoys-submitted-at-c-11h59', attempts.every((attempt) => attempt.ok), attempts.map((attempt) => attempt.reason));
  } else {
    // The keeper's last re-select (cutoff + 10 min) already listed the decoys and flagged them: their own
    // submissions at C + 11 h 59 min are no-ops.
    ctx.check('decoys-already-listed-by-keeper', attempts.every((attempt) => attempt.ok || attempt.reason === 'ALREADY_CANDIDATE'), attempts.map((attempt) => attempt.reason));
    ctx.note('Implementation reality: decoys settled before the cutoff are in the keeper\'s last re-select (cutoff + 10 min), so the keeper lists and flags them itself about 5 h before an attacker could at C + 11 h 59 min; the R13 variant forces the literal C + 11 h 59 min timing.');
  }
  const listed = (await js.chainWeek(W)).list.map((row) => row.sessionId32);
  ctx.check('honest-displaced', decoys.every((run) => listed.includes(run.sessionId32)) && listed.length === 5, {
    listed: listed.map((id) => js.label((decoys.find((run) => run.sessionId32 === id) ?? honest.find((run) => run.sessionId32 === id))?.wallet) ?? id),
    decoys: decoys.map((run) => [js.label(run.wallet), run.score]),
    attempts: attempts.map((attempt) => attempt.reason ?? 'ok'),
    decoyRows: (await js.candidateRows(W)).filter((row) => decoyIds.has(row.sessionId32)).map((row) => [row.source, row.screen, row.onChain, row.wasListed, row.review]),
    decoyActions: (await js.actionRows(W)).filter((action) => decoyIds.has(action.sessionId32)).map((action) => [action.kind, action.status, action.lastError]),
    honest: ranked.map((run) => [js.label(run.wallet), run.score]),
  });
  const screened = await js.cronUntil(async () => (await Promise.all(decoys.map((run) => js.review(run.sessionId32)))).every((review) => review === 'flagged'), { max: 4 });
  ctx.check('decoys-screened-first-and-flagged', screened !== null, { runs: screened });
  const decoyRows = (await js.candidateRows(W)).filter((row) => decoyIds.has(row.sessionId32));
  ctx.check('decoys-held', decoyRows.every((row) => row.screen === 'hold' && row.screenCodes.some((code) => ['H4', 'H5', 'H6'].includes(code))), decoyRows.map((row) => row.screenCodes));
  // The admin disqualifies every decoy wallet for the week (multi-wallet), freeing the slots.
  for (const run of decoys) {
    // eslint-disable-next-line no-await-in-loop
    const done = await js.admin('disqualify', { sessionId: run.sessionId32, wholeWalletForWeek: true, reason: 'multi-wallet' });
    ctx.check(`disqualify-${js.label(run.wallet)}`, done.ok, done.reason);
  }
  if (!variant) {
    const relisted = await js.cronUntil(async () => {
      const list = (await js.chainWeek(W)).list.map((row) => row.sessionId32);
      return list.length === 5 && top5.every((run) => list.includes(run.sessionId32));
    }, { max: 8 });
    ctx.check('keeper-relists-honest', relisted !== null, { runs: relisted });
    ctx.check('relists-before-payout-minus-2h', js.now() < js.at(W, 'payoutAt', -2 * HOUR));
    const relistActions = (await js.actionRows(W)).filter((action) => action.kind === 'submit' && top5.some((run) => run.sessionId32 === action.sessionId32));
    ctx.check('relist-actions-confirmed', relistActions.every((action) => action.status === 'confirmed'), relistActions.map((action) => [action.status, action.lastError]));
    const leader = top5[0];
    const before = await js.tokenBalance(leader.wallet);
    await toPayout(ctx, W);
    await expectPaid(ctx, W, leader, tokens(5_000), { before });
    const decoyAgain = await js.submitCandidate(decoys[0].player, decoys[0].sessionId32);
    ctx.check('decoys-cannot-return', decoyAgain.ok === false, decoyAgain.reason);
    return;
  }
  // Variant: the honest #1-#5 are also disqualified (for the rehearsal: reason 'other'), the list is empty,
  // and the honest #6, never listed, is added by adminSubmit and paid.
  await js.cronUntil(async () => (await js.chainWeek(W)).list.length === 5, { max: 6 });
  for (const run of top5) {
    // eslint-disable-next-line no-await-in-loop
    const done = await js.admin('disqualify', { sessionId: run.sessionId32, wholeWalletForWeek: true, reason: 'other' });
    ctx.check(`disqualify-honest-${js.label(run.wallet)}`, done.ok, done.reason);
  }
  ctx.check('list-empty', (await js.chainWeek(W)).list.length === 0);
  const relistSixth = await js.submitCandidate(sixth.player, sixth.sessionId32);
  ctx.check('sixth-cannot-self-relist', relistSixth.ok === false && relistSixth.reason === 'WINDOW_CLOSED', relistSixth);
  const review = await js.reviewApi(W);
  ctx.check('next-eligible-lists-sixth', review.status === 200 && normalizeReview(review.body).nextEligible.some((row) => row.sessionId === sixth.sessionId32));
  const added = await js.admin('adminSubmit', { sessionId: sixth.sessionId32 });
  ctx.check('admin-submits-sixth', added.ok && (await js.chainWeek(W)).list[0]?.sessionId32 === sixth.sessionId32, added.reason);
  const cleared = await js.cronUntil(async () => (await js.review(sixth.sessionId32)) === 'cleared', { max: 4 });
  ctx.check('sixth-screened-and-cleared', cleared !== null);
  const before = await js.tokenBalance(sixth.wallet);
  await toPayout(ctx, W);
  await expectPaid(ctx, W, sixth, tokens(5_000), { before });
}

// Evidence just above `leaderScore` on this seed: an expert-bot run truncated after the fewest flaps that
// still beat the leader (bisection over the flap count; the replay of a prefix crashes soon after its last
// flap, so the score grows with the count).
function justAbove(leaderScore, { maxMinutes = 4 } = {}) {
  return (seed) => {
    const full = buildChikunEvidence({ seed, profile: 'expert', maxMinutes });
    const ticks = flapTicksOf(full.flap);
    const prefix = (count) => simulateChikunRun({ seed, taps: ticks.slice(0, count), maxTicks: full.flap.maxTicks });
    let lo = 0;
    let hi = ticks.length;
    if (prefix(hi).score <= leaderScore) throw new Error('no run just above the leader on this seed');
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (prefix(mid).score > leaderScore) hi = mid;
      else lo = mid;
    }
    return prefix(hi).evidence;
  };
}

async function r14(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(3_000))).ok);
  const [h, sniper] = [await js.freshWallet('R14 honest leader'), await js.freshWallet('R14 sniper')];
  const leader = await js.playRankedChikunRun({ player: h, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 1.5 });
  // The sniper banks a session on Sunday: paid, not played.
  const banked = await js.playRankedChikunRun({ player: sniper, openedAt: js.at(W, 'close', -4 * HOUR), maxMinutes: 0.5, settle: false });
  await toSelection(ctx, W);
  ctx.check('leader-listed', (await js.chainWeek(W)).leader?.sessionId32 === leader.sessionId32);
  // C + 5 h, after the standings are public: a run just above the leader on the banked seed.
  const open = await js.jackpotApi();
  ctx.check('standings-public', open.api?.previous?.candidates?.[0]?.score === leader.score, open.body?.previous?.candidates);
  const replayed = await js.replayRun(banked, { evidence: justAbove(leader.score) });
  const sniped = await js.settleRun(replayed, { settleAt: js.at(W, 'close', 5 * HOUR) });
  // The fewest flaps that beat the leader on this seed (Chikun runs on until the next obstacle after its last
  // flap, so the margin is one course segment, not a point).
  ctx.check('just-above', sniped.score > leader.score && sniped.score < leader.score * 1.25, { sniper: sniped.score, leader: leader.score, margin: sniped.score - leader.score });
  await toReview(ctx, W);
  const row = (await js.candidateRows(W)).find((candidate) => candidate.sessionId32 === sniped.sessionId32);
  ctx.check('held-by-h9', row?.screen === 'hold' && row.screenCodes.includes('H9') && row.features?.features?.evidenceDelaySeconds > 1200, row && { codes: row.screenCodes, delay: row.features?.features?.evidenceDelaySeconds });
  ctx.check('flagged-late-evidence', (await js.review(sniped.sessionId32)) === 'flagged' && ethers.decodeBytes32String(await js.jackpot.reviewReason(sniped.sessionId32)) === 'late-evidence');
  await toPayout(ctx, W, { statuses: ['awaiting-admin'], id: 'awaiting-admin' });
  ctx.check('not-auto-paid', (await js.chainWeek(W)).status === 'open');
  ctx.check('admin-disqualifies', (await js.admin('disqualify', { sessionId: sniped.sessionId32, wholeWalletForWeek: true, reason: 'rules' })).ok);
  const before = await js.tokenBalance(leader.wallet);
  ctx.check('paid-honest', (await js.cronUntil(async () => (await js.weekRow(W)).status === 'paid', { max: 4 })) !== null);
  await expectPaid(ctx, W, leader, tokens(3_000), { before });
}

async function r15(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(1_000))).ok);
  const [a, modded] = [await js.freshWallet('R15 honest'), await js.freshWallet('R15 non-stock client')];
  const honest = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.0 });
  // maxTicks 108,000 (half the stock 216,000): the verifier accepts it, the screen must not.
  const nonStock = await js.playRankedChikunRun({ player: modded, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 1.5, maxTicks: 108_000 });
  ctx.check('settled-through-verifier', nonStock.maxTicks === 108_000 && nonStock.score > honest.score);
  await toSelection(ctx, W);
  await toReview(ctx, W);
  ctx.check('never-submitted-by-keeper', !(await js.candidateRows(W)).some((row) => row.sessionId32 === nonStock.sessionId32) && !(await js.actionRows(W)).some((action) => action.sessionId32 === nonStock.sessionId32));
  const submitted = await js.submitCandidate(modded, nonStock.sessionId32);
  ctx.check('submitted-publicly', submitted.ok, submitted.reason);
  await drainKeeper(ctx, W);
  const row = (await js.candidateRows(W)).find((candidate) => candidate.sessionId32 === nonStock.sessionId32);
  ctx.check('flagged-integrity', row?.screen === 'integrity-fail' && row.features?.integrity?.code === 'non-stock-client' && (await js.review(nonStock.sessionId32)) === 'flagged' && ethers.decodeBytes32String(await js.jackpot.reviewReason(nonStock.sessionId32)) === 'integrity', row && { screen: row.screen, integrity: row.features?.integrity });
  ctx.check('no-keeper-submit', !(await js.actionRows(W)).some((action) => action.kind === 'submit' && action.sessionId32 === nonStock.sessionId32));
  await toPayout(ctx, W, { statuses: ['awaiting-admin'], id: 'never-auto-paid' });
  ctx.check('admin-disqualifies', (await js.admin('disqualify', { sessionId: nonStock.sessionId32, wholeWalletForWeek: true, reason: 'integrity' })).ok);
  const before = await js.tokenBalance(honest.wallet);
  ctx.check('paid-honest', (await js.cronUntil(async () => (await js.weekRow(W)).status === 'paid', { max: 4 })) !== null);
  await expectPaid(ctx, W, honest, tokens(1_000), { before });
}

async function r16(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(1_000))).ok);
  const [bot, human] = [await js.freshWallet('R16 exceptional bot'), await js.freshWallet('R16 player')];
  const run = await js.playRankedChikunRun({ player: bot, openedAt: js.at(W, 'start', DAY), profile: 'exceptional', maxMinutes: ctx.shared.fast ? 1.5 : 5 });
  await js.playRankedChikunRun({ player: human, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 0.5 });
  await toSelection(ctx, W);
  const row = (await js.candidateRows(W)).find((candidate) => candidate.sessionId32 === run.sessionId32);
  ctx.check('passes-the-screen', row?.screen === 'pass' && row.screenCodes.length === 0 && (await js.review(run.sessionId32)) === 'cleared', row && { screen: row.screen, codes: row.screenCodes });
  await toReview(ctx, W);
  const before = await js.tokenBalance(run.wallet);
  await toPayout(ctx, W);
  await expectPaid(ctx, W, run, tokens(1_000), { before });
  ctx.expectedMisses.push({
    population: 'exceptional-model bot on a real seed (design B.4 set (b), B.5 item 1)',
    sessionId32: run.sessionId32,
    score: run.score,
    survivalSeconds: run.survivalSeconds,
    screen: row.screen,
    holdCodes: row.screenCodes,
    soft: Object.entries(row.features?.soft ?? {}).filter(([, signal]) => signal?.on === true).map(([code]) => code),
    outcome: 'cleared by the keeper and paid',
    note: 'The documented residual: a careful in-view bot is indistinguishable from an elite human by these features. Not a failure; adminClearOnly, caps and human review are the defence (J16, OJ6).',
  });
}

async function r17(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(1_200))).ok);
  const [a, l] = [await js.freshWallet('R17 honest'), await js.freshWallet('R17 leader (paused 25 min)')];
  await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY), maxMinutes: 0.5 });
  // The leader's evidence reaches the server 25 min after the run could have ended (a pause): H9 holds it.
  const leader = await js.playRankedChikunRun({ player: l, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 1.5, settleAfterSeconds: 25 * MINUTE });
  const keeper = js.keeperWallet.address;
  const startBlock = await js.blockNumber();
  await js.advanceTo(js.at(W, 'close', 2 * HOUR + MINUTE));
  // The keeper's flag of the leader is signed and recorded, then dropped (never reaches the chain).
  const drop = js.faultOnce({ stage: 'after-cas', kind: 'flag', sessionId32: leader.sessionId32 });
  const [killed] = await js.runJackpotCron(1, { fault: drop });
  ctx.check('flag-dropped', killed.status === 500 && drop.state.fired?.kind === 'flag' && (await js.provider.getTransaction(drop.state.fired.txHash)) === null, drop.state.fired);
  const flagRow = (await js.candidateRows(W)).find((row) => row.sessionId32 === leader.sessionId32);
  ctx.check('held-h9', flagRow?.screen === 'hold' && flagRow.screenCodes.includes('H9'), flagRow?.screenCodes);
  // The admin reviews the flagged leader (a documented pause explains H9) and clears it.
  const cleared = await js.admin('clear', { sessionId: leader.sessionId32 });
  ctx.check('admin-clears', cleared.ok && (await js.jackpot.adminReviewed(leader.sessionId32)) === true, cleared.reason);
  // The owner then re-screens it before the mirror has seen the admin's clear.
  const rescreen = await js.jackpotOps(['rescreen', '--session', leader.sessionId32, '--apply', '--confirm', 'RESCREEN_JACKPOT']);
  ctx.check('rescreen-applied-on-stale-mirror', rescreen.exitCode === 0 && rescreen.out.some((line) => line.startsWith('applied')), rescreen.out);
  await drainKeeper(ctx, W, { max: 6 });
  const actions = (await js.actionRows(W)).filter((action) => action.sessionId32 === leader.sessionId32);
  const flag = actions.find((action) => action.kind === 'flag');
  ctx.check('dropped-flag-resigned-then-skipped', flag?.status === 'skipped' && flag.lastError === 'review-locked' && flag.infraFailures >= 1, flag);
  ctx.check('rescreen-created-no-review-action', !actions.some((action) => action.kind === 'clear') && actions.filter((action) => action.kind === 'flag').length === 1, actions.map((action) => [action.kind, action.status, action.lastError]));
  const keeperTxs = (await js.transactionsBetween(startBlock, await js.blockNumber())).filter((tx) => tx.from === lower(keeper));
  const flagSelector = js.jackpot.interface.getFunction('flag').selector;
  ctx.check('no-keeper-flag-on-chain', !keeperTxs.some((tx) => tx.data === flagSelector), keeperTxs.map((tx) => tx.data));
  const again = await js.jackpotOps(['rescreen', '--session', leader.sessionId32, '--apply', '--confirm', 'RESCREEN_JACKPOT']);
  ctx.check('rescreen-refused-once-mirrored', again.exitCode === 1 && again.out.some((line) => line.startsWith('Refusing: the admin reviewed')), again.out);
  const direct = await js.sendReverting(js.keeperWallet, js.jackpotCall('flag', [leader.sessionId32, bytes32('screen-hold')]));
  ctx.check('keeper-flag-reverts-review-locked', direct.reason === 'REVIEW_LOCKED' && direct.minedStatus === 0, direct);
  ctx.check('still-cleared', (await js.review(leader.sessionId32)) === 'cleared');
  await toReview(ctx, W);
  const before = await js.tokenBalance(leader.wallet);
  await toPayout(ctx, W);
  await expectPaid(ctx, W, leader, tokens(1_200), { before });
}

async function r18(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(1_000))).ok);
  const [h, g] = [await js.freshWallet('R18 honest leader'), await js.freshWallet('R18 honest b')];
  const leader = await js.playRankedChikunRun({ player: h, openedAt: js.at(W, 'start', DAY), maxMinutes: 1.0 });
  await js.playRankedChikunRun({ player: g, openedAt: js.at(W, 'start', 2 * DAY), maxMinutes: 0.5 });
  await toSelection(ctx, W);
  // The admin key is compromised: it starts handing itself over and disqualifies the honest leader.
  const oldAdmin = js.adminWallet;
  const thief = await js.freshWallet('R18 thief');
  const transferAdmin = (to) => js.jackpotCall('transferAdmin', [to]);
  ctx.check('compromised-transfer-started', (await js.sendCall(oldAdmin, transferAdmin(thief.address))).ok && lower(await js.jackpot.pendingAdmin()) === lower(thief.address));
  ctx.check('compromised-disqualifies-leader', (await js.admin('disqualify', { sessionId: leader.sessionId32, wholeWalletForWeek: false, reason: 'other' })).ok);
  // The owner's review access while the old admin is still admin (warms the 60 s admin cache).
  ctx.check('old-admin-reviews-before', (await js.reviewApi(W, oldAdmin)).status === 200);
  // Emergency stop 5: the operator pauses (the admin cannot lift it) and forces a new admin.
  const paused = await js.operatorAction('operator-pause');
  ctx.check('operator-pause', paused.receipts.length === 1 && (await js.jackpot.operatorPaused()) === true);
  const unpause = await js.admin('unpause');
  ctx.check('admin-unpause-does-not-lift-it', (await js.jackpot.paused()) === true, { sent: unpause.ok });
  const again = await js.sendReverting(oldAdmin, transferAdmin(thief.address));
  ctx.check('transfer-admin-operator-lock', again.reason === 'OPERATOR_LOCK' && again.minedStatus === 0, again);
  const accept = await js.sendReverting(thief, js.jackpotCall('acceptAdmin'));
  ctx.check('accept-admin-operator-lock', accept.reason === 'OPERATOR_LOCK', accept);
  const newAdmin = await js.freshWallet('R18 new admin');
  const forced = await js.operatorAction('force-admin', { args: [newAdmin.address] });
  ctx.check('force-admin-one-transaction', forced.receipts.length === 1 && lower(await js.jackpot.admin()) === lower(newAdmin.address) && (await js.jackpot.pendingAdmin()) === ethers.ZeroAddress && (await js.jackpot.staffEver(newAdmin.address)) === true);
  js.setAdminWallet(newAdmin);
  js.recordRoles({ admin: newAdmin.address });
  const late = await js.sendReverting(oldAdmin, transferAdmin(thief.address));
  ctx.check('old-admin-transfer-reverts', late.reason === 'OPERATOR_LOCK' || late.reason === 'ONLY_ADMIN', late);
  ctx.note(`After force-admin the old admin's transferAdmin reverts ${late.reason} (the operator pause is still on; the onlyAdmin guard would refuse it next).`);
  const cachedAnswer = (await js.reviewApi(W, oldAdmin)).status;
  await js.advanceBy(61);
  const refused = await js.reviewApi(W, oldAdmin);
  ctx.check('review-api-refuses-old-admin-within-60s', refused.status === 403 && refused.body?.error === 'not-admin', { beforeExpiry: cachedAnswer, after: refused.status });
  ctx.check('review-api-new-admin', (await js.reviewApi(W, newAdmin)).status === 200);
  // The new admin reviews what the old one did: reinstate and clear the honest leader.
  ctx.check('new-admin-reinstates', (await js.admin('reinstate', { sessionId: leader.sessionId32 })).ok);
  ctx.check('new-admin-clears', (await js.admin('clear', { sessionId: leader.sessionId32 })).ok && (await js.chainWeek(W)).leader?.sessionId32 === leader.sessionId32);
  ctx.check('operator-unpause', (await js.operatorAction('operator-unpause')).receipts.length === 1 && (await js.jackpot.paused()) === false);
  await toReview(ctx, W);
  const before = await js.tokenBalance(leader.wallet);
  await toPayout(ctx, W);
  await expectPaid(ctx, W, leader, tokens(1_000), { before });
}

async function r19(ctx) {
  const { js } = ctx;
  const operator = js.wallets.operator;
  // A separate instance whose prize token is the double-entry mock (the end-of-life paths and the sweep
  // post-condition), driven by the operator CLI with its module.
  const dbl = await deployMockToken('DoubleEntryToken', [], operator);
  const dblAddress = lower(await dbl.getAddress());
  const secondary = lower(await dbl.secondary());
  const deployed = await deployLocalJackpot({
    provider: js.provider, wallets: js.wallets, record: js.record, token: dblAddress, keeper: js.keeperWallet.address, admin: js.adminWallet.address,
    rules: { ...launchRules(js.record), adminClearOnly: false }, tokenTestnet: true,
  });
  const module = jackpotModuleValue(deployed.record);
  const address = lower(deployed.record.instances.chikun.address);
  const jackpot = jackpotContract(address, js.provider);
  ctx.instance('end-of-life instance', address, dblAddress);
  // The server serves this instance while the scenario runs (the cron indexes it; /api/jackpot reads it).
  const served = await js.useInstance({ record: deployed.record });
  try {
    await endOfLife(ctx, { dbl, dblAddress, secondary, module, address, jackpot });
  } finally {
    await js.useInstance(served);
  }
  // The main instance simply saw empty weeks meanwhile.
  ctx.check('main-cron-ok', (await js.runJackpotCron(1))[0].status === 200);
}

async function endOfLife(ctx, { dbl, dblAddress, secondary, module, address, jackpot }) {
  const { js } = ctx;
  const [attacker, louie, owner] = [await js.freshWallet('R19 attacker'), await js.freshWallet('R19 Louie'), await js.freshWallet('R19 final-week funder')];
  for (const wallet of [attacker, louie, owner]) {
    // eslint-disable-next-line no-await-in-loop
    await (await dbl.mint(wallet.address, tokens(10_000))).wait();
  }
  const current = Number(await jackpot.currentWeek());
  const minFund = BigInt((await jackpot.rulesFor(current + 8)).minFundWei);
  const approve = async (wallet, amount) => (await dbl.connect(wallet).approve(address, amount)).wait();
  // Dust far ahead, then exactly minFundWei 8 weeks ahead.
  await approve(attacker, minFund * 2n);
  const dust = await js.sendReverting(attacker, js.jackpotCall('fund', [current + 8, minFund - 1n], { jackpot: address }));
  ctx.check('dust-reverts-below-min-fund', dust.reason === 'BELOW_MIN_FUND', dust);
  const minimum = await js.sendCall(attacker, js.jackpotCall('fund', [current + 8, minFund], { jackpot: address }));
  ctx.check('min-fund-8-weeks-ahead', minimum.ok, minimum.reason);
  const lastWeek = ctx.week(current + 2);
  // Louie pre-funds a week after the (coming) end; a funder funds the final week.
  const louieWeek = lastWeek + 3;
  ctx.check('louie-prefunds', (await js.fund(louieWeek, tokens(500), { from: louie, jackpot: address, token: dblAddress })).ok);
  ctx.check('final-week-funded', (await js.fund(lastWeek, tokens(300), { from: owner, jackpot: address, token: dblAddress })).ok);
  // sweepStray of the double entry point would drain the prize token: the post-condition stops it.
  let sweepReason = null;
  try {
    await js.operatorAction('sweep-stray', { args: [secondary], module });
  } catch (error) {
    sweepReason = revertReasonOf(error);
  }
  ctx.check('sweep-double-entry-reverts', sweepReason === 'LIABILITIES_BREACHED', sweepReason);
  // The operator schedules an end before those weeks: no funding precondition (J1 rev. 2).
  const ended = await js.operatorAction('schedule-end', { args: [String(lastWeek)], module });
  ctx.check('schedule-end', ended.receipts.length === 1 && Number(await jackpot.endAfterWeek()) === lastWeek);
  const afterEnd = await js.fund(lastWeek + 1, tokens(200), { from: louie, jackpot: address, token: dblAddress });
  ctx.check('fund-after-end-refused', afterEnd.ok === false, afterEnd.reason);
  // The final week closes unwon: finalize (the manual CLI fallback) puts its pot into the residue.
  const finalBounds = js.bounds(lastWeek);
  await js.advanceTo(finalBounds.payoutAt + MINUTE);
  const finalizer = await stranger(ctx, 'finalizer');
  const finalized = await js.operatorAction('finalize', { args: [String(lastWeek)], module, signer: finalizer });
  ctx.check('final-week-finalized', finalized.receipts.length === 1);
  const residual = BigInt(await jackpot.residual());
  ctx.check('unwon-pot-becomes-residual', residual === tokens(300), residual);
  await js.runJackpotCron(1);
  const { previous } = await apiPrevious(ctx, lastWeek, address);
  ctx.check('api-final-week-rolled-to-residue', previous?.status === 'rolled' && previous.winner === null && previous.prizeWei === null && previous.pot.totalWei === tokens(300).toString(), previous && { status: previous.status, pot: previous.pot });
  ctx.check('mirror-rolled-to-residue', (await js.weekRow(lastWeek, address)).status === 'rolled' && (await js.weekRow(lastWeek, address)).rolledToWeek === null, await js.weekRow(lastWeek, address));
  // Refunds: each funder gets back exactly its own funding of weeks after the end.
  const attackerBefore = BigInt(await dbl.balanceOf(attacker.address));
  const refunded = await js.operatorAction('refund-after-end', { args: [String(current + 8)], module, signer: attacker });
  ctx.check('attacker-refunded-own', refunded.receipts.length === 1 && BigInt(await dbl.balanceOf(attacker.address)) - attackerBefore === minFund);
  let crossRefund = null;
  try {
    await js.operatorAction('refund-after-end', { args: [String(louieWeek)], module, signer: attacker });
  } catch (error) {
    crossRefund = error?.message ?? String(error);
  }
  ctx.check('cannot-refund-others', crossRefund !== null && /funded nothing|NOTHING_TO_REFUND/.test(crossRefund), crossRefund);
  const louieBefore = BigInt(await dbl.balanceOf(louie.address));
  ctx.check('louie-refunded', (await js.operatorAction('refund-after-end', { args: [String(louieWeek)], module, signer: louie })).receipts.length === 1 && BigInt(await dbl.balanceOf(louie.address)) - louieBefore === tokens(500));
  // The residue reaches the recipient only after 30 days.
  let early = null;
  try {
    await js.operatorAction('recover-residual', { module });
  } catch (error) {
    early = error?.message ?? String(error);
  }
  ctx.check('residual-not-before-30-days', early !== null && /TOO_EARLY|available from/.test(early), early);
  await js.advanceTo(Number(await jackpot.residualAvailableAt()) + MINUTE);
  const recipient = lower(await jackpot.residualRecipient());
  const recipientBefore = BigInt(await dbl.balanceOf(recipient));
  ctx.check('residual-recovered', (await js.operatorAction('recover-residual', { module })).receipts.length === 1 && BigInt(await dbl.balanceOf(recipient)) - recipientBefore === tokens(300));
  ctx.check('nothing-owed', BigInt(await jackpot.liabilities()) === 0n);
  ctx.balance('attacker', attacker.address, dblAddress);
  ctx.balance('louie', louie.address, dblAddress);
  ctx.balance('residual recipient', recipient, dblAddress);
}

async function r20(ctx) {
  const { js } = ctx;
  const W = ctx.week(await js.beginWeek());
  ctx.check('fund', (await js.fund(W, tokens(1_000))).ok);
  const operator = js.wallets.operator;
  const entry = js.suite.rankedEntry.connect(operator);
  const scores = js.suite.scores.connect(operator);
  const gameId = ethers.id('chikun');
  const reserve = BigInt(await entry.settlementGasReserveWei());
  const live = await startLiveTarget(js);
  try {
    await js.runJackpotCron(1);
    const baseline = await live.check();
    ctx.check('live-checker-baseline', baseline.ok === true, baseline.failures);
    // Mid-week, the operator lowers the settlement reserve to 0.
    await (await entry.setSettlementGasReserve(0)).wait();
    const quote = await entry.quoteEntry(gameId);
    ctx.check('quote-is-flat-fee', BigInt(quote.totalWei) === 10n ** 17n, quote.totalWei);
    const [a] = await js.freshWallets(1, 'R20 player');
    const played = await js.playRankedChikunRun({ player: a, openedAt: js.at(W, 'start', DAY + HOUR), maxMinutes: 1.0, settle: false });
    ctx.check('paid-flat-fee', played.paidWei === (10n ** 17n).toString());
    await js.advanceTo(played.openedAt + played.survivalSeconds + 5);
    const refused = await js.postSettle(played);
    ctx.check('server-settle-floor-refuses', refused.status === 402 && refused.body?.error === 'entry-underpaid', refused.body);
    ctx.note('J17 coupling beyond the jackpot: the settle floor RANKED_MIN_PAID_WEI (default 0.102) refuses entries paid after a reserve cut until the same Monday step lowers it (runbook J17 weekly check).');
    js.env.RANKED_MIN_PAID_WEI = (10n ** 17n).toString();
    const run = await js.settleRun(played);
    ctx.check('settles-with-floor-lowered', run.score > 0 && run.settleTxHash);
    ctx.check('still-jackpot-eligible', (await js.checkEligibility(run.sessionId32)).ok === true);
    await js.runJackpotCron(1);
    const reserveZero = await live.check();
    ctx.check('live-checker-reserve-zero', reserveZero.checks.find((check) => check.id === 'j17-quote')?.ok === true, reserveZero.checks.find((check) => check.id === 'j17-quote'));
    // Separately, the registry's rankedEntry is repointed.
    const original = await scores.rankedEntry();
    await (await scores.setRankedEntry(js.wallets.attacker.address)).wait();
    const drift = await live.check();
    const repoint = drift.checks.find((check) => check.id === 'j17-ranked-entry');
    ctx.check('live-checker-flags-ranked-entry', drift.ok === false && repoint?.ok === false, repoint);
    await (await scores.setRankedEntry(original)).wait();
    // Fees off: the quote falls below minPaidWei, the checker fails J17 and the entry-modal row hides.
    await (await entry.setEntryFeeEnabled(false)).wait();
    const feesOff = await live.check();
    ctx.check('live-checker-flags-fees-off', feesOff.checks.find((check) => check.id === 'j17-quote')?.ok === false);
    const hidden = await entryRow(js, '0');
    ctx.check('entry-row-hidden-below-min-paid', hidden.hidden === true);
    await (await entry.setEntryFeeEnabled(true)).wait();
    await (await entry.setSettlementGasReserve(reserve)).wait();
    delete js.env.RANKED_MIN_PAID_WEI;
    const shown = await entryRow(js, (await entry.quoteEntry(gameId)).totalWei.toString());
    ctx.check('entry-row-shown-at-full-quote', shown.hidden === false && shown.text.includes("This week's jackpot"), shown.text);
    const restored = await live.check();
    ctx.check('live-checker-restored', restored.ok === true, restored.failures);
    await toSelection(ctx, W);
    await toReview(ctx, W);
    const before = await js.tokenBalance(run.wallet);
    await toPayout(ctx, W);
    await expectPaid(ctx, W, run, tokens(1_000), { before });
    ctx.shared.liveChecks = restored.checks.map((check) => check.id);
  } finally {
    await live.close();
  }
}

// The live dry run pointed at this stack over real HTTP and JSON-RPC (read-only methods recorded).
async function startLiveTarget(js) {
  const methods = new Set();
  const recording = { request: async (args) => { methods.add(args.method); return js.stack.chain.eip1193.request(args); } };
  const rpc = await serveJsonRpc(recording);
  const http = await startLocalHttp(js.httpStack, { staticRoot: join(root, 'apps', 'portal') });
  return {
    methods,
    async check() {
      return runJackpotLiveDryRun({ site: http.origin, rpc: rpc.url, deployment: js.deployment, jackpotModule: js.module, record: js.jackpotRecord, expectLive: JACKPOT_LIVE, log: () => {} });
    },
    async close() {
      await http.close();
      await rpc.close();
    },
  };
}

// The Ranked entry modal's jackpot row (jackpot-entry-line.mjs) for a quoted total.
async function entryRow(js, quoteWei) {
  const documentRef = fakeDocument();
  const row = documentRef.createElement('div');
  row.hidden = true;
  resetJackpotMemo();
  await showEntryJackpot({ row, gameId: 'chikun', session: { sessionId: 'game-session-rehearsal' }, quote: () => quoteWei, open: () => true, documentRef, fetchImpl: inProcessFetch(js), now: () => js.nowMs(), setTimeoutImpl: () => 0 });
  return { hidden: row.hidden, text: visibleText(row) };
}

// ---------------------------------------------------------------------------------------------------
// The scenario table.

export const SCENARIOS = Object.freeze([
  { id: 'R1', title: 'Happy path: 10,000 tCHIKUN, 3 players, the keeper selects at C + 2 h and clears; anyone finalizes at C + 24 h', run: r1 },
  { id: 'R2', title: 'Challenge: the keeper misses the best session; the player submits it at C + 8 h and is paid', run: r2 },
  { id: 'R3a', title: 'Flag → admin: a scripted-pilot leader is flagged; the admin disqualifies it and #2 is paid', run: (ctx) => flaggedLeaderWeek(ctx, { decision: 'disqualify' }) },
  { id: 'R3b', title: 'Flag → admin (replay variant): the admin clears the flagged leader and it is paid', run: (ctx) => flaggedLeaderWeek(ctx, { decision: 'clear' }) },
  { id: 'R4', title: 'Integrity: a record without Neon evidence, submitted publicly, is flagged integrity and never auto-paid', run: r4 },
  { id: 'R5', title: 'Rollover: an unwon funded week rolls into the next, whose payout pays both', run: r5 },
  { id: 'R6', title: 'Late settlement at C + 6 h + 1 s: SETTLED_LATE on chain, excluded by selection, still on the board', run: r6 },
  { id: 'R7', title: 'Extension: the admin extends by 12 h; the late run qualifies and is paid at C + 36 h', run: r7 },
  { id: 'R8', title: 'Prize cap scheduled the week before: the cap is paid, the excess reaches the current week', run: r8 },
  { id: 'R9', title: 'Token failure: a blacklisted winner is claim-pending, then claims to another address and is paid', run: r9 },
  { id: 'R10', title: 'Crash recovery: faults at after-cas, after-broadcast and before-receipt, no duplicate transactions', run: r10 },
  { id: 'R11', title: 'Pause, hold and staff: pause and hold stop payouts only; staff and blocked wallets are never candidates', run: r11 },
  { id: 'R12', title: 'Unfunded week: no keeper transaction, no amount in the API or the UI', run: r12 },
  { id: 'R13', title: 'Sybil eviction: five decoys displace the honest top 5; disqualified; honest rows re-listed; the honest leader is paid', run: (ctx) => sybilWeek(ctx, { variant: false }) },
  { id: 'R13v', title: 'Sybil eviction at C + 11 h 59 min, and the never-listed honest #6 added by adminSubmit and paid', run: (ctx) => sybilWeek(ctx, { variant: true }) },
  { id: 'R14', title: 'Banked-session sniping: a Sunday session settled at C + 5 h just above the leader is held by H9', run: r14 },
  { id: 'R15', title: 'Non-stock client (maxTicks 108,000): never submitted by the keeper, flagged integrity when submitted', run: r15 },
  { id: 'R16', title: 'Expected miss: an exceptional-model bot passes the screen and is paid (design B.5 residual)', run: r16 },
  { id: 'R17', title: 'Stale keeper action: a dropped flag and a rescreen never override the admin clear', run: r17 },
  { id: 'R18', title: 'Contested admin: operator pause, force-admin, OPERATOR_LOCK, the review API drops the old admin', run: r18 },
  { id: 'R19', title: 'Dust and end of life: BELOW_MIN_FUND, scheduleEnd, refunds to funders, residual after 30 days, sweep post-condition', run: r19 },
  { id: 'R20', title: 'Ranked-setting drift: reserve 0 keeps runs eligible; the live checker flags rankedEntry; the entry row hides fees-off', run: r20 },
]);

// ---------------------------------------------------------------------------------------------------
// The run and the receipt.

function gitHead() {
  const result = spawnSync('git', ['rev-parse', '--short=8', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function scriptSha256() {
  return createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

// Runs `ids` (all scenarios by default) on one stack. → the receipt object.
export async function runJackpotRehearsal({ ids = null, log = console.log, fast = false } = {}) {
  const selected = ids ? SCENARIOS.filter((spec) => ids.includes(spec.id)) : SCENARIOS;
  if (ids) for (const id of ids) if (!SCENARIOS.some((spec) => spec.id === id)) throw new Error(`unknown scenario ${id}`);
  const started = Date.now();
  const js = await startJackpotStack({ log });
  const shared = { fast };
  const results = [];
  try {
    for (const spec of selected) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await runScenario(js, { ...spec, shared }, { log }));
    }
    const receipt = {
      schema: REHEARSAL_RECEIPT_SCHEMA,
      generatedAt: new Date().toISOString(),
      head: gitHead(),
      scriptSha256: scriptSha256(),
      command: `node ${REHEARSAL_SCRIPT_RELATIVE_PATH}${ids ? ` --only ${ids.join(',')}` : ''}`,
      note: 'Local rehearsal only: Hardhat chain 4441 in process, PGlite for Neon, every api/*.mjs handler in process, public fixture keys. Nothing touched LiteForge, Vercel or production Neon; JACKPOT_LIVE was not flipped.',
      ok: results.every((result) => result.status === 'passed'),
      summary: {
        scenarios: results.length,
        passed: results.filter((result) => result.status === 'passed').length,
        failed: results.filter((result) => result.status === 'failed').map((result) => result.id),
        expectedMisses: results.reduce((sum, result) => sum + result.expectedMisses.length, 0),
        durationMs: Date.now() - started,
      },
      stack: {
        chainId: 4441,
        jackpot: js.address,
        token: js.tokenAddress,
        firstWeek: js.weekKey(js.firstWeek),
        scoreRegistry: js.deployment.addresses.scoreSubmissionRegistry,
        rankedEntry: js.deployment.addresses.arcadeRankedEntry,
        rules: 'design §A.5 launch rules; the first epoch adminClearOnly = true, adminClearOnly = false from the next week (operator schedule-rules)',
        e5: ['test wallet 0x8841…ce824 (test-wallet)', 'verifier (staff)', 'relayer (staff)', 'prize funder (funder)'],
      },
      scenarios: results,
      expectedMisses: results.flatMap((result) => result.expectedMisses.map((miss) => ({ scenario: result.id, ...miss }))),
      productBugs: PRODUCT_BUGS,
      liveDryRunChecks: shared.liveChecks ?? null,
    };
    return receipt;
  } finally {
    await js.close();
  }
}

// Product bugs a scenario exposed, fixed in their own commits (brief: "report it").
export const PRODUCT_BUGS = Object.freeze([]);

function flagValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] ?? null : null;
}

export async function runRehearsalCli({ argv = process.argv.slice(2), log = console.log } = {}) {
  const only = flagValue(argv, '--only');
  const ids = only ? only.split(',').map((id) => id.trim()).filter(Boolean) : null;
  const receipt = await runJackpotRehearsal({ ids, log });
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const out = flagValue(argv, '--out') ?? receiptPathFor(date);
  if (!argv.includes('--no-write')) {
    const target = resolve(root, out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    log(`receipt: ${out}`);
  }
  if (argv.includes('--json')) log(JSON.stringify(receipt, null, 2));
  log(`jackpot rehearsal: ${receipt.summary.passed}/${receipt.summary.scenarios} scenarios passed${receipt.summary.failed.length ? `; failed ${receipt.summary.failed.join(', ')}` : ''}; expected misses ${receipt.summary.expectedMisses}`);
  return receipt.ok ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runRehearsalCli().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`rehearse-jackpot-week: ${error?.stack ?? error}`);
    process.exitCode = 1;
  });
}
