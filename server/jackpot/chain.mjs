// Chain reads of the jackpot server (design §C.3, §C.4), every one with its
// own timeout (8 s by default): an in-flight RPC call cannot be stopped by a
// soft budget (the index-chain 504s of 2026-09-24), so each call races its
// own deadline and a timeout is an infrastructure error (rpc-timeout), never
// a verdict.
//
// It also owns the jackpot-local full ScoreRecord decoder: the settle chain
// reader's getSession returns only { exists, player, submittedAt }
// (server/settle/relayer.mjs), and the screen's chain cross-check needs the
// whole record (game, season, runtime, score, survival, verified).

import { ethers } from 'ethers';
import { ERC20_READ_ABI, RANKED_ENTRY_ABI, SCORE_REGISTRY_ABI, WEEKLY_JACKPOT_ABI } from '../chain/abis.mjs';
import { timeoutError } from './errors.mjs';

export const RPC_TIMEOUT_MS = 8_000;
export const REVIEW_STATES_BY_CODE = Object.freeze(['none', 'cleared', 'flagged', 'disqualified']);
export const WEEK_STATUS_BY_CODE = Object.freeze(['open', 'paid', 'rolled']);

export const jackpotIface = new ethers.Interface(WEEKLY_JACKPOT_ABI);
const registryIface = new ethers.Interface(SCORE_REGISTRY_ABI);
const entryIface = new ethers.Interface(RANKED_ENTRY_ABI);
const erc20Iface = new ethers.Interface(ERC20_READ_ABI);
const lower = (value) => String(value ?? '').toLowerCase();
const ZERO32 = `0x${'0'.repeat(64)}`;

// Races `run()` against a deadline; the losing call is abandoned, never awaited.
export function withTimeout(run, ms = RPC_TIMEOUT_MS, label = 'rpc') {
  let timer = null;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError(label)), Math.max(1, ms));
  });
  return Promise.race([Promise.resolve().then(run), deadline]).finally(() => clearTimeout(timer));
}

// bytes32 → short ASCII reason ('screen-hold'), or 'other' when it is not a
// decodable, CHECK-shaped code (design §C.3: a non-conforming reason is stored
// as 'other', so an event is never lost).
export function reasonText(bytes32, { pattern = /^[a-z][a-z0-9-]{0,31}$/ } = {}) {
  if (!bytes32 || lower(bytes32) === ZERO32) return null;
  try {
    const text = ethers.decodeBytes32String(bytes32);
    return pattern.test(text) ? text : 'other';
  } catch {
    return 'other';
  }
}

export function createJackpotChain({ provider, contract, deployment = null, timeoutMs = RPC_TIMEOUT_MS }) {
  const current = () => (typeof provider === 'function' ? provider() : provider);
  const address = lower(contract);
  const registry = () => lower(deployment?.addresses?.scoreSubmissionRegistry);
  const entry = () => lower(deployment?.addresses?.arcadeRankedEntry);

  async function call(to, iface, name, args = [], label = name) {
    const data = iface.encodeFunctionData(name, args);
    const raw = await withTimeout(() => current().call({ to, data }), timeoutMs, label);
    return iface.decodeFunctionResult(name, raw);
  }
  const view = (name, args = []) => call(address, jackpotIface, name, args, `jackpot.${name}`);

  return Object.freeze({
    address,
    timeoutMs,
    withTimeout: (run, label) => withTimeout(run, timeoutMs, label),
    // --- WeeklyJackpot views -------------------------------------------------
    async admin() { return lower((await view('admin'))[0]); },
    async keeper() { return lower((await view('keeper'))[0]); },
    async operator() { return lower((await view('operator'))[0]); },
    async paused() { return (await view('paused'))[0] === true; },
    async operatorPaused() { return (await view('operatorPaused'))[0] === true; },
    async endAfterWeek() { return Number((await view('endAfterWeek'))[0]); },
    async currentWeek() { return Number((await view('currentWeek'))[0]); },
    async weekBounds(week) {
      const [start, close, settleCutoff, candidateUntil, payoutAt] = await view('weekBounds', [week]);
      return { start: Number(start), close: Number(close), settleCutoff: Number(settleCutoff), candidateUntil: Number(candidateUntil), payoutAt: Number(payoutAt) };
    },
    async potOf(week) {
      const [funded, carriedIn, total] = await view('potOf', [week]);
      return { funded: BigInt(funded), carriedIn: BigInt(carriedIn), total: BigInt(total) };
    },
    async weekState(week) {
      const [status, held, count, winner, winningSession, prize, unclaimed, finalizedAt, extension] = await view('weekState', [week]);
      return {
        status: WEEK_STATUS_BY_CODE[Number(status)] ?? 'open', held: held === true, count: Number(count), winner: lower(winner),
        winningSession: lower(winningSession), prize: BigInt(prize), unclaimed: BigInt(unclaimed), finalizedAt: Number(finalizedAt), extension: Number(extension),
      };
    },
    async candidatesOf(week) {
      const [list] = await view('candidatesOf', [week]);
      return list.map((row, index) => ({ sessionId32: lower(row.sessionId), player: lower(row.player), submittedAt: Number(row.submittedAt), score: Number(row.score), rank: index + 1 }));
    },
    async leaderOf(week) {
      const [sessionId, player, score, review] = await view('leaderOf', [week]);
      if (lower(sessionId) === ZERO32) return null;
      return { sessionId32: lower(sessionId), player: lower(player), score: Number(score), review: REVIEW_STATES_BY_CODE[Number(review)] ?? 'none' };
    },
    async rulesCount() { return Number((await view('rulesCount'))[0]); },
    async rulesAt(index) { return rulesFromTuple((await view('rulesAt', [index]))[0]); },
    async rulesFor(week) { return rulesFromTuple((await view('rulesFor', [week]))[0]); },
    async checkEligibility(sessionId32) {
      const [ok, week, reason] = await view('checkEligibility', [sessionId32]);
      return { ok: ok === true, week: Number(week), reason: String(reason ?? '') };
    },
    async reviewOf(sessionId32) { return REVIEW_STATES_BY_CODE[Number((await view('reviewOf', [sessionId32]))[0])] ?? 'none'; },
    async reviewReason(sessionId32) { return reasonText((await view('reviewReason', [sessionId32]))[0]); },
    async adminReviewed(sessionId32) { return (await view('adminReviewed', [sessionId32]))[0] === true; },
    async wasListed(sessionId32) { return (await view('wasListed', [sessionId32]))[0] === true; },
    async staffEver(wallet) { return (await view('staffEver', [wallet]))[0] === true; },
    async blocked(wallet) { return (await view('blocked', [wallet]))[0] === true; },
    // --- Registries ------------------------------------------------------------
    // The full ScoreRecord (IRankedScoreReader field order, design §A.4).
    async getSession(sessionId32) {
      const [record] = await call(registry(), registryIface, 'getSession', [sessionId32], 'registry.getSession');
      return {
        sessionId32: lower(record.sessionId), player: lower(record.player), gameId32: lower(record.gameId), score: BigInt(record.score),
        kills: Number(record.kills), maxCombo: Number(record.maxCombo), survivalSeconds: Number(record.survivalSeconds), bossId32: lower(record.bossId),
        runtimeId32: lower(record.runtimeId), seasonId32: lower(record.seasonId), submittedAt: Number(record.submittedAt),
        verified: record.verified === true, exists: record.exists === true,
      };
    },
    async getPaidSession(sessionId32) {
      const [paid] = await call(entry(), entryIface, 'getPaidSession', [sessionId32], 'entry.getPaidSession');
      return { exists: paid.exists === true, player: lower(paid.player), gameId32: lower(paid.gameId), amountWei: BigInt(paid.amountWei), openedAt: Number(paid.openedAt) };
    },
    // --- Token and balances --------------------------------------------------
    async tokenBalance(token, wallet) { return BigInt((await call(lower(token), erc20Iface, 'balanceOf', [wallet], 'token.balanceOf'))[0]); },
    async balance(wallet) { return BigInt(await withTimeout(() => current().getBalance(wallet), timeoutMs, 'getBalance')); },
    async latestBlock() { return withTimeout(() => current().getBlock('latest'), timeoutMs, 'getBlock'); },
    async block(number) { return withTimeout(() => current().getBlock(number), timeoutMs, 'getBlock'); },
    async logs(filter) { return withTimeout(() => current().getLogs(filter), timeoutMs, 'getLogs'); },
  });
}

// The Rules struct → the jackpot_rules shape (strings for wei and hashes).
export function rulesFromTuple(tuple) {
  return {
    fromWeek: Number(tuple.fromWeek),
    maxSurvivalSeconds: Number(tuple.maxSurvivalSeconds),
    adminClearOnly: tuple.adminClearOnly === true,
    minPaidWei: BigInt(tuple.minPaidWei).toString(),
    maxPrizeWei: BigInt(tuple.maxPrizeWei).toString(),
    minFundWei: BigInt(tuple.minFundWei).toString(),
    maxScore: BigInt(tuple.maxScore).toString(),
    seasonId32: lower(tuple.seasonId),
    altSeasonId32: lower(tuple.altSeasonId) === ZERO32 ? null : lower(tuple.altSeasonId),
  };
}
