// The weekly-jackpot cron run (design §C.4). api/cron/weekly-jackpot.mjs owns
// the gates (cron secret, database, config.jackpot.ready, JACKPOT_PAUSED) and
// the cron_runs bookkeeping; runJackpot(deps) does one idempotent,
// at-least-once-safe pass:
//
//   for every instance in [active, ...retired] with non-terminal weeks:
//     index its events (indexer.mjs), reconcile the views, then walk every
//     non-terminal week, oldest first, through the state machine below.
//
// State machine (design §C.4 table, revision 2), per instance and week:
//   open            now >= closes_at                         → closed
//   closed          now >= close + 2 h, pot < min_fund_wei   → unfunded (terminal; nothing sent)
//   closed          now >= close + 2 h, pot >= min_fund_wei  select → selecting
//   selecting/review/awaiting-admin:
//                   screen pending rows (on-chain by rank, then keeper-selected,
//                   then displaced public rows; <= 5 per week per run): pass →
//                   clear, hold/integrity-fail → flag; keeper-selected rows that
//                   pass integrity → submit; never a clear or flag for an
//                   admin-reviewed or disqualified row
//                   send due actions (<= 3 per week per run)
//   selecting       every keeper action settled, now >= cutoff + 10 min
//                   → one last re-select → review
//   review/awaiting-admin  now < settle cutoff (a WeekExtended moved it) → selecting
//   review/awaiting-admin  < 5 on-chain rows, a displaced was_listed row that is
//                   not disqualified or integrity-failed, now < payout − 2 h
//                   → re-list the best one (submit)
//   review          now >= payout_at: leaderOf cleared, or empty (the pot rolls
//                   over), not held, not paused → finalize → finalizing;
//                   otherwise → awaiting-admin (admin_waiting_since set)
//   awaiting-admin  re-evaluated every run (a superset of the design's trigger
//                   list: Cleared, Flagged, Disqualified, Reinstated,
//                   CandidateSubmitted, CandidateRemoved, WalletBlocked,
//                   WeekReleased, WeekExtended, Unpaused, AdminTransferred)
//                   → review → finalizing when it can finalize
//   finalizing      Finalized indexed or weekState != Open → paid /
//                   claim-pending / rolled (the indexer and reconcile mirror it)
//   claim-pending   PrizeClaimed / UnclaimedRecycled → paid / rolled
//   any             an action goes dead → failed (the owner requeues)
// Anyone may finalize: a Finalized event makes the week terminal whatever its
// state. A week after a scheduled end is refund-only and never processed.
//
// Budget: a 120 s soft budget inside the function's 300 s; indexing <= 15 s
// per instance; every RPC call has an 8 s timeout and every receipt wait
// <= 15 s; a step starts only with the room to finish it.
//
// Test seams (J2 → J3, never read from env): deps.jackpotDeployment (through
// config), deps.jackpotSelect(rows) → rows, deps.keeperFault(stage).

import { ethers } from 'ethers';
import { ensureSchema } from '../neon/migrations.mjs';
import { errorLogFields } from '../http.mjs';
import { createJackpotChain } from './chain.mjs';
import { createKeeper } from './keeper.mjs';
import { indexJackpotInstance, jackpotInstances, openWeekIndexes, reconcileInstance } from './indexer.mjs';
import { KEEPER_KEEP, KEEPER_SELECT_LIMIT, roleWallets, selectCandidates } from './select.mjs';
import { createFundingLookup, screenCandidate } from './screen.mjs';
import {
  TERMINAL_WEEK_STATUSES, casAction, casWeekStatus, createAction, listDueActions, readAction, readCandidates, readRules, readWalletFlags,
  readWeekActions, readWeekRow, readWeekRows, requeueAction, rulesForWeek, updateCandidate, updateWeek, upsertCandidate,
} from './store.mjs';
import { RESELECT_AFTER_CUTOFF_SECONDS, RELIST_MARGIN_SECONDS, SELECT_AFTER_SECONDS, weekIndexOfMs, weekKeyOfIndex } from './weeks.mjs';

export const JACKPOT_RUN_BUDGET_MS = 120_000;
export const SCREENS_PER_WEEK = 5;
export const SENDS_PER_WEEK = 3;
export const SCREEN_RESERVE_MS = 15_000;
export const SEND_RESERVE_MS = 20_000;
export const SEND_KEEP_MS = 5_000;
export const SCREEN_ERROR_LIMIT = 6;
export const ACTIVE_WEEK_STATUSES = Object.freeze(['selecting', 'review', 'awaiting-admin']);

const ms = (iso) => Date.parse(iso ?? '');

function clockOf(deps) {
  return typeof deps.nowMs === 'function' ? deps.nowMs : () => Number(deps.nowMs ?? Date.now());
}

// Rows that still need a screen: pending, or an error whose backoff passed.
function needsScreen(candidate, nowMs) {
  if (candidate.review === 'disqualified') return false;
  if (candidate.screen === 'pending') return true;
  if (candidate.screen !== 'error') return false;
  const retryAt = ms(candidate.features?.retryAt);
  return !Number.isFinite(retryAt) || retryAt <= nowMs;
}

// Screening order (design §C.4): on-chain rows by chain rank, then keeper
// selections, then displaced public rows.
function screeningOrder(candidates) {
  const rank = (row) => {
    if (row.onChain) return [0, row.chainRank ?? 9];
    if (row.source === 'keeper') return [1, -row.score];
    return [2, -row.score];
  };
  return [...candidates].sort((a, b) => {
    const [ga, sa] = rank(a);
    const [gb, sb] = rank(b);
    return ga - gb || sa - sb || (a.sessionId32 < b.sessionId32 ? -1 : 1);
  });
}

// The context one run shares across instances and weeks.
function runContext(deps, { budgetMs, monotonicMs }) {
  const started = monotonicMs();
  const clock = clockOf(deps);
  return {
    deps,
    db: deps.db,
    clock,
    remaining: () => budgetMs - (monotonicMs() - started),
    monotonicMs,
    fundingCache: new Map(),
    firstFunder: deps.fundingLookup === undefined ? createFundingLookup({ fetchImpl: deps.fetchImpl }) : deps.fundingLookup,
    keeperWallet: null,
    results: [],
  };
}

async function staffFor(ctx, instance) {
  const flags = await readWalletFlags(ctx.db, { contract: instance.contract });
  const staff = roleWallets({ deployment: ctx.deps.deployment, jackpotInstance: instance });
  for (const flag of flags) if (flag.staffEver) staff.add(flag.wallet);
  return staff;
}

async function select(ctx, instance, week, rules) {
  const staff = await staffFor(ctx, instance);
  const selection = await selectCandidates(ctx.db, {
    contract: instance.contract, weekKey: week.weekKey, rules, cutoffIso: week.settleCutoffAt, staff, limit: KEEPER_SELECT_LIMIT, keep: KEEPER_KEEP,
  });
  if (selection.unknownSeason) {
    await updateWeek(ctx.db, { contract: instance.contract, weekKey: week.weekKey, set: { last_error: 'unknown-season' } });
    return { inserted: 0, code: 'unknown-season' };
  }
  const rows = typeof ctx.deps.jackpotSelect === 'function' ? await ctx.deps.jackpotSelect(selection.rows) : selection.rows;
  let inserted = 0;
  for (const row of rows ?? []) {
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertCandidate(ctx.db, { contract: instance.contract, weekKey: week.weekKey, sessionId32: row.sessionId32, wallet: row.wallet, score: row.score, source: 'keeper' });
    if (result.inserted) inserted += 1;
  }
  return { inserted, code: null };
}

function keeperFor(ctx, instance, chain, rulesList) {
  const { deps } = ctx;
  ctx.keeperWallet ??= deps.config.jackpot.keeper.createWallet(ethers, deps.provider);
  return createKeeper({
    db: ctx.db,
    provider: deps.provider,
    wallet: ctx.keeperWallet,
    chain,
    maxTxFeeWei: deps.config.jackpot.maxTxFeeWei,
    rulesFor: async (weekIndex) => rulesForWeek(rulesList, weekIndex),
    holderId: `${process.env.VERCEL_REGION ?? 'local'}:${(deps.crypto ?? globalThis.crypto).randomUUID()}`,
    nowMs: ctx.clock,
    chainId: deps.config.chainId,
    keeperFault: deps.keeperFault ?? null,
  });
}

async function screenRows(ctx, { instance, chain, week, rules, candidates }) {
  const now = ctx.clock();
  const due = screeningOrder(candidates.filter((row) => needsScreen(row, now))).slice(0, SCREENS_PER_WEEK);
  const outcomes = [];
  const h11Active = rules.adminClearOnly === true || instance.token.testnet !== true;
  for (const candidate of due) {
    if (ctx.remaining() < SCREEN_RESERVE_MS) break;
    // eslint-disable-next-line no-await-in-loop
    const result = await screenCandidate({
      db: ctx.db, chain, verify: ctx.deps.verify, secret: () => ctx.deps.config.session.secret(), candidate, weekIndex: week.weekIndex, weekKey: week.weekKey,
      rules, nowMs: now, h11Active, firstFunder: ctx.firstFunder, fundingCache: ctx.fundingCache,
      recentWeekKeys: Array.from({ length: 8 }, (_, index) => weekKeyOfIndex(Math.max(1, week.weekIndex - index))),
    });
    if (result.result === 'error') {
      const errors = Number(candidate.features?.errors ?? 0) + 1;
      const retryAt = new Date(now + Math.min(60_000 * 2 ** Math.min(errors - 1, 4), 15 * 60_000)).toISOString();
      // eslint-disable-next-line no-await-in-loop
      await updateCandidate(ctx.db, { contract: instance.contract, sessionId32: candidate.sessionId32, set: { screen: 'error', features: { errors, retryAt, code: result.code } } });
      if (errors >= SCREEN_ERROR_LIMIT) {
        // eslint-disable-next-line no-await-in-loop
        await updateWeek(ctx.db, { contract: instance.contract, weekKey: week.weekKey, set: { last_error: 'screen-errors' } });
      }
      outcomes.push({ sessionId32: candidate.sessionId32, result: 'error', code: result.code });
      continue;
    }
    const features = {
      result: result.result, codes: result.codes, features: result.features, soft: result.soft, integrity: result.integrity, provenance: result.provenance,
      eligibility: result.eligibility, flagReason: result.flagReason, timeline: result.timeline, screenedBy: 'keeper',
    };
    // eslint-disable-next-line no-await-in-loop
    await updateCandidate(ctx.db, {
      contract: instance.contract, sessionId32: candidate.sessionId32,
      set: { screen: result.result, screen_codes: result.codes, features, screened_at: now },
    });
    // eslint-disable-next-line no-await-in-loop
    await actionsForScreen(ctx, { instance, week, rules, candidate, result });
    outcomes.push({ sessionId32: candidate.sessionId32, result: result.result, code: result.code });
  }
  return outcomes;
}

// Clear or flag (never for an admin-reviewed or disqualified row, never a
// keeper clear under adminClearOnly), and submit for keeper selections that
// pass integrity (integrity-failed rows are never submitted).
async function actionsForScreen(ctx, { instance, week, rules, candidate, result }) {
  const base = { contract: instance.contract, weekIndex: week.weekIndex };
  const locked = candidate.adminReviewed || candidate.review === 'disqualified';
  if (!locked) {
    if (result.result === 'pass') {
      if (!rules.adminClearOnly) await createAction(ctx.db, { ...base, kind: 'clear', sessionId32: candidate.sessionId32 });
    } else {
      await createAction(ctx.db, { ...base, kind: 'flag', sessionId32: candidate.sessionId32, reason: result.flagReason ?? 'screen-hold' });
    }
  }
  if (candidate.source === 'keeper' && !candidate.onChain && !candidate.wasListed && result.result !== 'integrity-fail' && candidate.review !== 'disqualified') {
    await createAction(ctx.db, { ...base, kind: 'submit', sessionId32: candidate.sessionId32 });
  }
}

// Sends (and receipt checks) of a week's due actions, at most `budget.sends`
// sends per week per run.
async function sendDue(ctx, { instance, chain, week, rulesList, budget }) {
  const outcomes = [];
  const due = await listDueActions(ctx.db, { contract: instance.contract, weekKey: week.weekKey, nowMs: ctx.clock(), limit: SENDS_PER_WEEK * 2 });
  for (const action of due) {
    if (budget.sends <= 0 || ctx.remaining() < SEND_RESERVE_MS) break;
    const keeper = keeperFor(ctx, instance, chain, rulesList);
    let outcome;
    if (action.status === 'submitted') {
      // eslint-disable-next-line no-await-in-loop
      outcome = await keeper.checkSubmitted(action);
    } else {
      budget.sends -= 1;
      const waitMs = Math.max(1, Math.min(15_000, ctx.remaining() - SEND_KEEP_MS));
      // eslint-disable-next-line no-await-in-loop
      outcome = await keeper.send(action, { receiptTimeoutMs: waitMs });
    }
    outcomes.push({ id: action.id, kind: action.kind, status: outcome.status, code: outcome.code ?? null });
  }
  return outcomes;
}

// A displaced row to re-list (design §C.4 relist row), or null.
function relistCandidate(candidates) {
  const onChain = candidates.filter((row) => row.onChain).length;
  if (onChain >= 5) return null;
  return candidates
    .filter((row) => !row.onChain && row.wasListed && row.review !== 'disqualified' && row.screen !== 'integrity-fail')
    .sort((a, b) => b.score - a.score || (a.sessionId32 < b.sessionId32 ? -1 : 1))[0] ?? null;
}

async function relist(ctx, { instance, week, candidate }) {
  const created = await createAction(ctx.db, { contract: instance.contract, weekIndex: week.weekIndex, kind: 'submit', sessionId32: candidate.sessionId32 });
  if (!created.created && ['confirmed', 'skipped'].includes(created.action.status)) await requeueAction(ctx.db, { id: created.action.id });
  return (await readAction(ctx.db, created.action.id))?.status ?? null;
}

// The finalize decision at payout (design §C.4 review rows). → 'finalize' | 'wait'
async function finalizeDecision(chain, { week, candidates }) {
  const [leader, state, paused] = await Promise.all([chain.leaderOf(week.weekIndex), chain.weekState(week.weekIndex), chain.paused()]);
  if (state.status !== 'open') return { decision: 'done' };
  if (state.held || paused) return { decision: 'wait', code: state.held ? 'week-held' : 'jackpot-paused' };
  if (leader && leader.review === 'cleared') return { decision: 'finalize' };
  if (!leader) {
    // Blocked rows keep their slots (J1 note): a full list of skipped rows
    // with an honest displaced row waiting is the admin's to free, not a
    // rollover.
    if (state.count > 0 && relistCandidate(candidates)) return { decision: 'wait', code: 'leader-not-cleared' };
    return { decision: 'finalize' };
  }
  return { decision: 'wait', code: 'leader-not-cleared' };
}

async function setStatus(ctx, instance, week, from, to, set = {}) {
  const moved = await casWeekStatus(ctx.db, { contract: instance.contract, weekKey: week.weekKey, from: [from], to, set });
  return moved ? to : from;
}

// One week through the state machine. → { from, to, code }
async function processWeek(ctx, { instance, chain, weekIndex, rulesList }) {
  const { db } = ctx;
  let week = await readWeekRow(db, { contract: instance.contract, weekKey: weekKeyOfIndex(weekIndex) });
  if (!week) return null;
  const from = week.status;
  if (TERMINAL_WEEK_STATUSES.includes(from)) return null;
  const now = ctx.clock();
  const rules = rulesForWeek(rulesList, weekIndex);
  let status = from;
  let code = null;
  const budget = { sends: SENDS_PER_WEEK };

  if (status === 'open' && now >= ms(week.closesAt)) status = await setStatus(ctx, instance, week, 'open', 'closed');

  if (status === 'closed' && now >= ms(week.closesAt) + SELECT_AFTER_SECONDS * 1000) {
    if (!rules) return { from, to: status, code: 'unknown-season' };
    const pot = BigInt(week.fundedWei) + BigInt(week.carriedInWei);
    if (pot < BigInt(rules.minFundWei)) {
      status = await setStatus(ctx, instance, week, 'closed', 'unfunded');
      return { from, to: status, code: null };
    }
    const picked = await select(ctx, instance, week, rules);
    code = picked.code;
    status = await setStatus(ctx, instance, week, 'closed', 'selecting');
  }

  if (ACTIVE_WEEK_STATUSES.includes(status)) {
    week = await readWeekRow(db, { contract: instance.contract, weekKey: week.weekKey });
    // WeekExtended after review: back to selecting until the new cutoff.
    if ((status === 'review' || status === 'awaiting-admin') && now < ms(week.settleCutoffAt)) {
      status = await setStatus(ctx, instance, week, status, 'selecting', { admin_waiting_since: null });
    }
    let candidates = await readCandidates(db, { contract: instance.contract, weekKey: week.weekKey });
    await screenRows(ctx, { instance, chain, week, rules, candidates });
    candidates = await readCandidates(db, { contract: instance.contract, weekKey: week.weekKey });
    if ((status === 'review' || status === 'awaiting-admin') && now < ms(week.payoutAt) - RELIST_MARGIN_SECONDS * 1000) {
      const displaced = relistCandidate(candidates);
      if (displaced) await relist(ctx, { instance, week, candidate: displaced });
    }
    const sent = await sendDue(ctx, { instance, chain, week, rulesList, budget });
    const dead = (await readWeekActions(db, { contract: instance.contract, weekKey: week.weekKey })).find((action) => action.status === 'dead');
    if (dead) {
      status = await setStatus(ctx, instance, week, status, 'failed', { last_error: dead.lastError ?? 'unknown-error' });
      return { from, to: status, code: dead.lastError ?? 'unknown-error' };
    }
    if (status === 'selecting' && now >= ms(week.settleCutoffAt) + RESELECT_AFTER_CUTOFF_SECONDS * 1000) {
      const actions = await readWeekActions(db, { contract: instance.contract, weekKey: week.weekKey });
      const open = actions.some((action) => ['pending', 'signed', 'submitted'].includes(action.status) || (action.status === 'failed' && action.nextAttemptAt));
      const unscreened = candidates.some((row) => needsScreen(row, Infinity) && row.source === 'keeper');
      if (!open && !unscreened) {
        const picked = await select(ctx, instance, week, rules);
        code = picked.code ?? code;
        status = await setStatus(ctx, instance, week, 'selecting', 'review');
      }
    }
    if ((status === 'review' || status === 'awaiting-admin') && now >= ms(week.payoutAt)) {
      const verdict = await finalizeDecision(chain, { week, candidates });
      if (verdict.decision === 'finalize') {
        if (status === 'awaiting-admin') status = await setStatus(ctx, instance, week, 'awaiting-admin', 'review');
        const created = await createAction(db, { contract: instance.contract, weekIndex, kind: 'finalize' });
        if (!created.created && created.action.status === 'skipped') await requeueAction(db, { id: created.action.id, from: ['skipped'] });
        status = await setStatus(ctx, instance, week, 'review', 'finalizing', { admin_waiting_since: null });
      } else if (verdict.decision === 'wait' && status === 'review') {
        status = await setStatus(ctx, instance, week, 'review', 'awaiting-admin', week.adminWaitingSince ? {} : { admin_waiting_since: now });
        code = verdict.code;
      } else if (verdict.decision === 'wait') {
        code = verdict.code;
      }
    }
    code = code ?? sent.find((entry) => entry.code && entry.status !== 'confirmed')?.code ?? null;
  }

  if (status === 'finalizing') {
    const sent = await sendDue(ctx, { instance, chain, week, rulesList, budget });
    const finalize = (await readWeekActions(db, { contract: instance.contract, weekKey: week.weekKey })).find((action) => action.kind === 'finalize');
    if (finalize?.status === 'dead') {
      status = await setStatus(ctx, instance, week, 'finalizing', 'failed', { last_error: finalize.lastError ?? 'unknown-error' });
      code = finalize.lastError;
    } else if (finalize?.status === 'failed' && ['leader-not-cleared', 'week-held'].includes(finalize.lastError)) {
      // The leader changed or the week was held after the decision: the admin's turn.
      status = await setStatus(ctx, instance, week, 'finalizing', 'awaiting-admin', { admin_waiting_since: now });
      await requeueFinalize(ctx, finalize);
      code = finalize.lastError;
    } else {
      code = code ?? sent.find((entry) => entry.code && entry.status !== 'confirmed')?.code ?? null;
    }
  }
  return { from, to: status, code };
}

// A finalize that now waits on the admin is parked ('skipped') so the
// awaiting-admin runs do not keep re-sending it; the next finalize decision
// requeues it (its id is the idempotency key).
async function requeueFinalize(ctx, action) {
  await casAction(ctx.db, { id: action.id, from: ['failed'], to: 'skipped', set: { next_attempt_at: null } });
}

// Retired instances whose weeks are all terminal are not serviced any more.
async function instanceDone(db, instance) {
  if (instance.active || !instance.endAfterWeek) return false;
  const rows = await readWeekRows(db, { contract: instance.contract });
  const byIndex = new Map(rows.map((row) => [row.weekIndex, row]));
  for (let index = instance.firstWeek; index <= instance.endAfterWeek; index += 1) {
    const row = byIndex.get(index);
    if (!row || !TERMINAL_WEEK_STATUSES.includes(row.status)) return false;
  }
  return true;
}

// One cron pass. → { status, body: { ok, weeks: [{ contract, weekKey, from, to, code }] } }
export async function runJackpot(deps, { budgetMs = JACKPOT_RUN_BUDGET_MS, monotonicMs = () => performance.now(), logger = console } = {}) {
  const ctx = runContext(deps, { budgetMs, monotonicMs });
  await ensureSchema(deps.db);
  const instances = jackpotInstances(deps.config.jackpot.deployment);
  const weeks = [];
  let indexed = 0;
  let failedInstances = 0;
  for (const instance of instances) {
    // eslint-disable-next-line no-await-in-loop
    if (await instanceDone(deps.db, instance)) continue;
    const chain = createJackpotChain({ provider: () => deps.provider, contract: instance.contract, deployment: deps.deployment });
    try {
      // eslint-disable-next-line no-await-in-loop
      await indexJackpotInstance({ db: deps.db, chain, instance, chainId: deps.config.chainId, monotonicMs, logger });
      // eslint-disable-next-line no-await-in-loop
      const endAfterWeek = instance.active ? await chain.endAfterWeek() : instance.endAfterWeek;
      const currentWeek = weekIndexOfMs(ctx.clock());
      // eslint-disable-next-line no-await-in-loop
      const indexes = await openWeekIndexes(deps.db, { instance, currentWeek, endAfterWeek: endAfterWeek || null });
      // eslint-disable-next-line no-await-in-loop
      await reconcileInstance({ db: deps.db, chain, instance, weekIndexes: indexes });
      indexed += 1;
      // eslint-disable-next-line no-await-in-loop
      const rulesList = await readRules(deps.db, { contract: instance.contract });
      for (const weekIndex of indexes) {
        if (weekIndex >= currentWeek) continue;
        // eslint-disable-next-line no-await-in-loop
        const result = await processWeek(ctx, { instance, chain, weekIndex, rulesList });
        if (result) weeks.push({ contract: instance.contract, weekKey: weekKeyOfIndex(weekIndex), ...result });
      }
    } catch (error) {
      failedInstances += 1;
      logger?.error?.('[cron/weekly-jackpot] instance', errorLogFields(error));
      if (!error?.chainIo && !['TIMEOUT', 'SERVER_ERROR', 'NETWORK_ERROR'].includes(error?.code)) throw error;
      weeks.push({ contract: instance.contract, weekKey: null, from: null, to: null, code: error?.code === 'TIMEOUT' ? 'rpc-timeout' : 'chain-read-failed' });
    }
  }
  if (instances.length && !indexed && failedInstances) {
    return { status: 502, body: { ok: false, error: 'chain-read-failed', retryable: true, weeks }, headers: { 'Cache-Control': 'no-store' } };
  }
  return { status: 200, body: { ok: true, weeks }, headers: { 'Cache-Control': 'no-store' } };
}

