// The jackpot event index (design §C.3). Runs inside the weekly-jackpot cron,
// never the index-chain cron, so that cron stays untouched.
//
// - One stream per instance: indexer_state('litvm-4441-jackpot-<contract hex>'),
//   starting at the instance's startBlock, for the active instance and every
//   retired instance whose weeks are not all terminal.
// - Address-filtered getLogs in 5,000-block chunks within a 15 s budget per
//   instance; every RPC call has its own 8 s timeout; returned logs are
//   re-filtered by address and sorted by block, then log index.
// - The cursor moves only after a chunk succeeds. RPC failures and timeouts
//   abort the chunk ({ chainIo: true }); permanent row errors (SQLSTATE
//   22xxx/23xxx, BAD_DATA) are skipped and counted, EXCEPT that a reason that
//   does not fit its CHECK (or a bytes32 decodeBytes32String rejects) is
//   stored as 'other', so a Disqualified or Flagged event is never lost.
// - Mirrors are idempotent: an amount is applied only when its event row is
//   new, so replaying a range yields the same rows.
// - reconcileInstance() then reads candidatesOf, weekState, potOf, reviewOf
//   and adminReviewed for the listed candidates of every non-terminal week,
//   and rulesCount/rulesAt, and heals any missed or skipped log. The mirrors
//   are the only source of amounts in the public API.

import { jackpotIface, reasonText } from './chain.mjs';
import {
  TERMINAL_WEEK_STATUSES, casWeekStatus, clearChainRanks, deleteRulesNotIn, ensureWeekRow, insertEvent, jackpotStream, readCandidate, readCursor,
  readWeekRow, readWeekRows, replaceRulesFrom, updateCandidate, updateWeek, upsertCandidate, upsertRules, upsertWalletFlag, writeCursor,
} from './store.mjs';
import { boundsIsoOf, weekKeyOfIndex } from './weeks.mjs';

export const INDEX_CHUNK_BLOCKS = 5_000;
export const INDEX_BUDGET_MS = 15_000;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const ZERO32 = `0x${'0'.repeat(64)}`;
const lower = (value) => String(value ?? '').toLowerCase();
const WALLET_REASON = /^[a-z][a-z0-9-]{0,31}$/;
const REVIEW_REASON = /^[a-z][a-z0-9-]{1,31}$/;

function isPermanent(error) {
  if (error?.chainIo) return false;
  const code = String(error?.code ?? '');
  return /^(22|23)[0-9A-Z]{3}$/.test(code) || ['BAD_DATA', 'INVALID_ARGUMENT', 'NUMERIC_FAULT'].includes(code) || error?.permanent === true;
}

// Chain failures abort the chunk; a fresh error carries no RPC message.
async function chainRead(run) {
  try {
    return await run();
  } catch (error) {
    throw Object.assign(new Error('chain read failed'), { chainIo: true, code: error?.code === 'TIMEOUT' ? 'TIMEOUT' : (typeof error?.code === 'string' ? error.code : 'CHAIN_READ') });
  }
}

// The instances of a LITVM_JACKPOT-shaped deployment: the active one first,
// then every retired one (design §A.19).
export function jackpotInstances(jackpotDeployment) {
  if (jackpotDeployment?.status !== 'deployed') return [];
  const active = jackpotDeployment.instances?.chikun;
  if (!active?.address) return [];
  const token = (entry) => ({
    address: lower(entry?.token?.address), symbol: String(entry?.token?.symbol ?? ''), decimals: Number(entry?.token?.decimals ?? 18),
    testnet: entry?.token?.testnet === true, name: entry?.token?.name ?? null,
  });
  const list = [{
    contract: lower(active.address), startBlock: Number(active.startBlock ?? 0), firstWeek: Number(active.firstWeek), endAfterWeek: null,
    admin: lower(active.admin), keeper: lower(active.keeper), residualRecipient: lower(active.residualRecipient), token: token(active), active: true,
  }];
  for (const retired of active.retired ?? []) {
    list.push({
      contract: lower(retired.address), startBlock: Number(retired.startBlock ?? 0), firstWeek: Number(retired.firstWeek), endAfterWeek: Number(retired.endAfterWeek ?? 0) || null,
      admin: null, keeper: null, residualRecipient: null, token: token(retired), active: false,
    });
  }
  return list;
}

function weekOf(value) {
  const index = Number(value);
  return Number.isSafeInteger(index) && index > 0 ? index : null;
}

// Indexes one instance. → { fromBlock, toBlock, headBlock, events, skipped, failed, lagBlocks }
export async function indexJackpotInstance({
  db, chain, instance, keepers = [], chainId = 4441, budgetMs = INDEX_BUDGET_MS, chunk = INDEX_CHUNK_BLOCKS, monotonicMs = () => performance.now(), logger = console,
}) {
  const contract = instance.contract;
  const stream = jackpotStream(contract, chainId);
  const started = monotonicMs();
  const counts = { events: 0, skipped: 0, failed: 0 };
  const keeperSet = new Set([...keepers, instance.keeper].filter(Boolean).map(lower));
  const blockTimes = new Map();
  const blockTime = async (number) => {
    const key = Number(number);
    if (!blockTimes.has(key)) {
      const block = await chainRead(() => chain.block(key));
      if (!block) throw Object.assign(new Error('block not found'), { chainIo: true, code: 'BLOCK_NOT_FOUND' });
      blockTimes.set(key, Number(block.timestamp));
    }
    return blockTimes.get(key);
  };
  const ensureWeek = (index) => ensureWeekRow(db, { contract, weekIndex: index, token: instance.token });
  const addWei = async (index, column, amount, sign = 1n) => {
    await ensureWeek(index);
    const row = await readWeekRow(db, { contract, weekKey: weekKeyOfIndex(index) });
    const next = BigInt(row[column === 'funded_wei' ? 'fundedWei' : 'carriedInWei']) + sign * BigInt(amount);
    await updateWeek(db, { contract, weekKey: row.weekKey, set: { [column]: next < 0n ? 0n : next } });
  };
  const setStatus = async (index, to, from = ['open', 'closed', 'selecting', 'review', 'awaiting-admin', 'finalizing', 'claim-pending', 'failed', 'paid']) => {
    await casWeekStatus(db, { contract, weekKey: weekKeyOfIndex(index), from, to });
  };

  const stateRow = await readCursor(db, stream);
  let from = stateRow === null ? Number(instance.startBlock ?? 0) : stateRow + 1;
  if (!Number.isSafeInteger(from) || from < 0) from = 0;
  const head = await chainRead(() => chain.latestBlock());
  const headNumber = Number(head?.number ?? 0);
  const fromBlock = from;
  let toBlock = from - 1;

  const handle = async (log) => {
    let parsed;
    try {
      parsed = jackpotIface.parseLog({ topics: log.topics, data: log.data });
    } catch {
      parsed = null;
    }
    if (!parsed) { counts.skipped += 1; return; }
    const { name, args } = parsed;
    const base = { txHash: lower(log.transactionHash), logIndex: Number(log.index ?? log.logIndex ?? 0), blockNumber: Number(log.blockNumber), contract, event: name };
    const blockTimeMs = (await blockTime(log.blockNumber)) * 1000;
    const record = (extra = {}) => insertEvent(db, { ...base, blockTimeMs, ...extra });
    const week = weekOf(args.week ?? args.fromWeek);
    const weekKey = week ? weekKeyOfIndex(week) : null;
    switch (name) {
      case 'Funded': {
        if (await record({ weekKey, wallet: lower(args.funder), amountWei: args.amount })) await addWei(week, 'funded_wei', args.amount);
        break;
      }
      case 'RefundedAfterEnd': {
        if (await record({ weekKey, wallet: lower(args.funder), amountWei: args.amount })) await addWei(week, 'funded_wei', args.amount, -1n);
        break;
      }
      case 'RolledOver':
      case 'CapExcessCarried':
      case 'UnclaimedRecycled': {
        const target = weekOf(args.toWeek);
        const fresh = await record({ weekKey, amountWei: args.amount, reason: target ? null : 'residue' });
        await ensureWeek(week);
        if (name === 'RolledOver') await updateWeek(db, { contract, weekKey, set: { rolled_to_week: target ? weekKeyOfIndex(target) : null } });
        if (name === 'UnclaimedRecycled') {
          await updateWeek(db, { contract, weekKey, set: { unclaimed_wei: 0n, rolled_to_week: target ? weekKeyOfIndex(target) : null } });
          await setStatus(week, 'rolled', ['claim-pending', 'paid', 'finalizing', 'review', 'awaiting-admin']);
        }
        // toWeek 0 = the residue after a scheduled end: no week gains it.
        if (fresh && target) await addWei(target, 'carried_in_wei', args.amount);
        break;
      }
      case 'CandidateSubmitted': {
        const session = lower(args.sessionId);
        await record({ weekKey, sessionId32: session, wallet: lower(args.player), amountWei: null });
        const submitter = lower(args.submitter);
        // A CandidateSubmitted from anyone but a keeper is a public
        // challenge: a 'public' row with screen 'pending' (an existing
        // keeper-selected row keeps its source).
        await upsertCandidate(db, {
          contract, weekKey, sessionId32: session, wallet: lower(args.player), score: Number(args.score),
          source: keeperSet.has(submitter) ? 'keeper' : 'public', submittedAt: Number(args.submittedAt) * 1000, onChain: true, wasListed: true, chainRank: Number(args.rank),
        });
        await ensureWeek(week);
        break;
      }
      case 'CandidateRemoved': {
        const session = lower(args.sessionId);
        await record({ weekKey, sessionId32: session, reason: reasonText(args.reason) });
        if (await readCandidate(db, { contract, sessionId32: session })) await updateCandidate(db, { contract, sessionId32: session, set: { on_chain: false, chain_rank: null } });
        break;
      }
      case 'CandidateSkipped':
      case 'LeaderChanged': {
        await record({ weekKey, sessionId32: lower(args.sessionId), wallet: args.player ? lower(args.player) : null, reason: name === 'CandidateSkipped' ? reasonText(args.reason) : null });
        break;
      }
      case 'Cleared':
      case 'Flagged':
      case 'Reinstated': {
        const session = lower(args.sessionId);
        const candidate = await readCandidate(db, { contract, sessionId32: session });
        const reviewer = args.by ? lower(args.by) : null;
        const reason = name === 'Flagged' ? reasonText(args.reason, { pattern: REVIEW_REASON }) : null;
        await record({ weekKey: weekKey ?? candidate?.weekKey ?? null, sessionId32: session, wallet: reviewer, reason: name === 'Flagged' ? reasonText(args.reason) : null });
        if (!candidate) break;
        const byAdmin = name === 'Reinstated' || (reviewer && !keeperSet.has(reviewer));
        const set = name === 'Cleared' ? { review: 'cleared', review_reason: null } : name === 'Flagged' ? { review: 'flagged', review_reason: reason } : { review: 'none', review_reason: null };
        if (byAdmin) set.admin_reviewed = true;
        await updateCandidate(db, { contract, sessionId32: session, set });
        break;
      }
      case 'Disqualified': {
        const session = lower(args.sessionId);
        const player = lower(args.player);
        const reason = reasonText(args.reason, { pattern: REVIEW_REASON }) ?? 'other';
        await record({ weekKey, sessionId32: session, wallet: player, reason: reasonText(args.reason) ?? 'other' });
        // A disqualified session is mirrored even when it was never listed,
        // so the keeper's selection never picks it (design §C.4 SQL).
        if (!(await readCandidate(db, { contract, sessionId32: session }))) {
          const rows = await db.query("SELECT score::text AS score FROM verified_sessions WHERE session_id32 = $1", [session]);
          await upsertCandidate(db, { contract, weekKey, sessionId32: session, wallet: player, score: Number(rows[0]?.score ?? 0), source: 'public' });
        }
        await updateCandidate(db, { contract, sessionId32: session, set: { review: 'disqualified', review_reason: reason, admin_reviewed: true, on_chain: false, chain_rank: null } });
        break;
      }
      case 'WalletBlocked': {
        const wallet = lower(args.wallet);
        await record({ wallet, reason: reasonText(args.reason) });
        await upsertWalletFlag(db, { contract, wallet, blocked: args.blocked === true, reason: reasonText(args.reason, { pattern: WALLET_REASON }) });
        break;
      }
      case 'WeekHeld':
      case 'WeekReleased': {
        await record({ weekKey, reason: name === 'WeekHeld' ? reasonText(args.reason) : null });
        await ensureWeek(week);
        await updateWeek(db, { contract, weekKey, set: { held: name === 'WeekHeld' } });
        break;
      }
      case 'WeekExtended': {
        const total = Number(args.totalExtensionSeconds);
        await record({ weekKey });
        await ensureWeek(week);
        const bounds = boundsIsoOf(week, total);
        await updateWeek(db, { contract, weekKey, set: { extension_s: total, settle_cutoff_at: bounds.settleCutoffAt, candidate_until: bounds.candidateUntil, payout_at: bounds.payoutAt } });
        break;
      }
      case 'Finalized': {
        const winner = lower(args.winner);
        const session = lower(args.sessionId);
        await record({ weekKey, sessionId32: session === ZERO32 ? null : session, wallet: winner === ZERO_ADDRESS ? null : winner, amountWei: args.prize });
        await ensureWeek(week);
        const paid = winner !== ZERO_ADDRESS;
        await updateWeek(db, {
          contract, weekKey,
          set: {
            winner: paid ? winner : null, winning_session: paid ? session : null, winning_score: paid ? String(args.score) : null,
            prize_wei: paid ? BigInt(args.prize) : 0n, finalize_tx_hash: base.txHash, finalized_at: blockTimeMs,
          },
        });
        // A Finalized event makes the week terminal whatever its state (an
        // unfunded week stays 'unfunded'). PrizeTransferFailed, in the same
        // transaction, then moves a paid week to claim-pending.
        await setStatus(week, paid ? 'paid' : 'rolled', ['open', 'closed', 'selecting', 'review', 'awaiting-admin', 'finalizing', 'failed']);
        break;
      }
      case 'PrizeTransferFailed': {
        await record({ weekKey, wallet: lower(args.winner), amountWei: args.amount });
        await ensureWeek(week);
        await updateWeek(db, { contract, weekKey, set: { unclaimed_wei: BigInt(args.amount) } });
        await setStatus(week, 'claim-pending', ['paid', 'finalizing', 'review', 'awaiting-admin', 'selecting', 'closed', 'open', 'failed']);
        break;
      }
      case 'PrizeClaimed': {
        await record({ weekKey, wallet: lower(args.to), amountWei: args.amount });
        await ensureWeek(week);
        await updateWeek(db, { contract, weekKey, set: { unclaimed_wei: 0n } });
        await setStatus(week, 'paid', ['claim-pending']);
        break;
      }
      case 'RulesScheduled': {
        await record({ weekKey: null });
        await replaceRulesFrom(db, {
          contract,
          rules: {
            fromWeek: Number(args.fromWeek), seasonId32: lower(args.seasonId), altSeasonId32: lower(args.altSeasonId), minPaidWei: args.minPaidWei,
            maxSurvivalSeconds: Number(args.maxSurvivalSeconds), maxScore: args.maxScore, maxPrizeWei: args.maxPrizeWei, minFundWei: args.minFundWei,
            adminClearOnly: args.adminClearOnly === true,
          },
        });
        break;
      }
      case 'KeeperUpdated':
      case 'AdminTransferred':
      case 'OperatorTransferred': {
        const wallet = lower(name === 'KeeperUpdated' ? args.keeper : args.current);
        await record({ wallet: wallet === ZERO_ADDRESS ? null : wallet });
        if (name === 'KeeperUpdated' && wallet !== ZERO_ADDRESS) keeperSet.add(wallet);
        if (wallet !== ZERO_ADDRESS) await upsertWalletFlag(db, { contract, wallet, staffEver: true });
        break;
      }
      default: {
        // Paused, Unpaused, EndScheduled, EndCancelled: recorded for the
        // awaiting-admin triggers and the owner page; the cron reads the
        // live pause and end from the chain.
        await record({ weekKey: name === 'EndScheduled' && weekOf(args.lastWeek) ? weekKeyOfIndex(weekOf(args.lastWeek)) : null, wallet: args.by ? lower(args.by) : null });
      }
    }
    counts.events += 1;
  };

  const guarded = async (log) => {
    try {
      await handle(log);
    } catch (error) {
      if (!isPermanent(error)) throw error;
      counts.failed += 1;
      logger?.warn?.('[jackpot-index] log skipped', error?.name ?? 'Error', error?.code ?? 'none');
    }
  };

  while (from <= headNumber && monotonicMs() - started < budgetMs) {
    const to = Math.min(from + chunk - 1, headNumber);
    const logs = await chainRead(() => chain.logs({ address: contract, fromBlock: from, toBlock: to }));
    const ours = (logs ?? [])
      .filter((log) => log && !log.removed && lower(log.address) === contract)
      .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.index ?? a.logIndex ?? 0) - Number(b.index ?? b.logIndex ?? 0));
    for (const log of ours) await guarded(log);
    await writeCursor(db, stream, to);
    toBlock = to;
    from = to + 1;
  }
  return { fromBlock, toBlock, headBlock: headNumber, ...counts, lagBlocks: Math.max(0, headNumber - toBlock), keepers: [...keeperSet] };
}

// The view read after indexing (design §C.3 last bullet): rules epochs, and
// for every non-terminal week in `weekIndexes`, candidatesOf, weekState,
// potOf, and reviewOf + adminReviewed + wasListed of every listed candidate.
export async function reconcileInstance({ db, chain, instance, weekIndexes = [], maxRuleEpochs = 32 }) {
  const contract = instance.contract;
  const count = await chainRead(() => chain.rulesCount());
  if (count > 0 && count <= maxRuleEpochs) {
    const fromWeeks = [];
    for (let index = 0; index < count; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const rules = await chainRead(() => chain.rulesAt(index));
      fromWeeks.push(rules.fromWeek);
      // eslint-disable-next-line no-await-in-loop
      await upsertRules(db, { contract, rules });
    }
    await deleteRulesNotIn(db, { contract, fromWeeks });
  }
  const healed = [];
  for (const weekIndex of weekIndexes) {
    const weekKey = weekKeyOfIndex(weekIndex);
    // eslint-disable-next-line no-await-in-loop
    const row = await ensureWeekRow(db, { contract, weekIndex, token: instance.token });
    if (TERMINAL_WEEK_STATUSES.includes(row.status)) continue;
    // eslint-disable-next-line no-await-in-loop
    const [state, pot, list] = await Promise.all([chainRead(() => chain.weekState(weekIndex)), chainRead(() => chain.potOf(weekIndex)), chainRead(() => chain.candidatesOf(weekIndex))]);
    const bounds = boundsIsoOf(weekIndex, state.extension);
    const set = {
      funded_wei: pot.funded, carried_in_wei: pot.carriedIn, held: state.held, extension_s: state.extension,
      settle_cutoff_at: bounds.settleCutoffAt, candidate_until: bounds.candidateUntil, payout_at: bounds.payoutAt, unclaimed_wei: state.unclaimed,
    };
    if (state.status !== 'open') {
      const paid = state.status === 'paid';
      Object.assign(set, {
        winner: paid ? state.winner : null, winning_session: paid ? state.winningSession : null, prize_wei: paid ? state.prize : 0n,
        finalized_at: state.finalizedAt ? state.finalizedAt * 1000 : null,
      });
    }
    // eslint-disable-next-line no-await-in-loop
    await updateWeek(db, { contract, weekKey, set });
    if (state.status !== 'open' && row.status !== 'unfunded') {
      const target = state.status === 'rolled' ? 'rolled' : (state.unclaimed > 0n ? 'claim-pending' : 'paid');
      if (target !== row.status) {
        // eslint-disable-next-line no-await-in-loop
        await casWeekStatus(db, { contract, weekKey, from: [row.status], to: target, set: { admin_waiting_since: null } });
        healed.push({ weekKey, from: row.status, to: target });
      }
    }
    for (const entry of list) {
      // eslint-disable-next-line no-await-in-loop
      const [review, adminReviewed] = await Promise.all([chainRead(() => chain.reviewOf(entry.sessionId32)), chainRead(() => chain.adminReviewed(entry.sessionId32))]);
      // eslint-disable-next-line no-await-in-loop
      await upsertCandidate(db, { contract, weekKey, sessionId32: entry.sessionId32, wallet: entry.player, score: entry.score, source: 'public', submittedAt: entry.submittedAt * 1000, onChain: true, wasListed: true, chainRank: entry.rank });
      // eslint-disable-next-line no-await-in-loop
      const reason = review === 'flagged' || review === 'disqualified' ? await chainRead(() => chain.reviewReason(entry.sessionId32)) : null;
      // eslint-disable-next-line no-await-in-loop
      await updateCandidate(db, { contract, sessionId32: entry.sessionId32, set: { review, admin_reviewed: adminReviewed, review_reason: reason && REVIEW_REASON.test(reason) ? reason : (reason ? 'other' : null) } });
    }
    // eslint-disable-next-line no-await-in-loop
    await clearChainRanks(db, { contract, weekKey, keepSessions: list.map((entry) => entry.sessionId32) });
  }
  return { healed };
}

// Every non-terminal week row of an instance, plus the closed weeks that have
// no row yet (from firstWeek to the week before `currentWeek`, never after a
// scheduled end). → week indexes, ascending.
export async function openWeekIndexes(db, { instance, currentWeek, endAfterWeek = null }) {
  const rows = await readWeekRows(db, { contract: instance.contract });
  const byIndex = new Map(rows.map((row) => [row.weekIndex, row]));
  const last = Math.min(currentWeek, endAfterWeek ? endAfterWeek : Infinity);
  const out = new Set();
  for (let index = Math.max(1, instance.firstWeek); index <= last; index += 1) {
    const row = byIndex.get(index);
    if (!row || !TERMINAL_WEEK_STATUSES.includes(row.status)) out.add(index);
  }
  for (const row of rows) {
    if (TERMINAL_WEEK_STATUSES.includes(row.status)) continue;
    if (endAfterWeek && row.weekIndex > endAfterWeek) continue;
    out.add(row.weekIndex);
  }
  return [...out].sort((a, b) => a - b);
}

