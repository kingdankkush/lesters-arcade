// Jackpot keeper error classes and the jackpot code allowlist (design §A.15,
// §C.4 "Codes", contract A31).
//
// Every keeper failure is one class and one allowlisted code:
//   deterministic  the chain rejects the action and will keep rejecting it:
//                  failed, attempts + 1, dead after 3 attempts (an alert)
//   skipped        terminal and not an error (a better row, a closed window,
//                  an admin decision that stands)
//   already-done   the chain already holds the result: confirmed, nothing sent
//   wait           infrastructure, fees, balance, pause, hold or an uncleared
//                  leader: failed with a backoff, attempts unchanged
//
// The table is design §A.15 revision 2 with the J1 amendments of 2026-09-25
// (docs/web3/weekly-jackpot-operations.md, "Interface notes for
// jackpot-server"): AFTER_END on finalize and NOTHING_TO_CLAIM are
// already-done; BAD_RULES, END_FINAL and EMPTY_GAME_ID are never sent by the
// keeper. Stored and logged values are codes from JACKPOT_ERROR_CODES only,
// never raw error text (an ethers message can embed the RPC URL).

import { classifyRelayError, decodeRevertReason } from '../settle/errors.mjs';

export const JACKPOT_ERROR_CODES = Object.freeze([
  'jackpot-not-configured', 'jackpot-paused', 'jackpot-address-mismatch', 'keeper-underfunded', 'fee-too-high',
  'already-done', 'skipped', 'not-eligible', 'window-closed', 'settled-late', 'payout-not-due', 'leader-not-cleared',
  'week-held', 'review-locked', 'replay-mismatch', 'evidence-missing', 'chain-mismatch', 'verify-unavailable',
  'chain-read-failed', 'rpc-timeout', 'nonce-conflict', 'tx-dropped', 'unknown-season', 'non-stock-client',
  'ticket-invalid', 'ticket-missing', 'late-evidence', 'unknown-error',
  // Additions of the server slice (on both allowlists): a keeper that is not
  // the contract's keeper (ONLY_KEEPER, a rotated key), a busy keeper lease,
  // and a screen that kept failing on infrastructure (§C.4: "after 6
  // consecutive errors the week is marked for attention").
  'keeper-not-authorized', 'lease-busy', 'screen-errors',
]);
const ALLOWED = new Set(JACKPOT_ERROR_CODES);

export const JACKPOT_ERROR_CLASSES = Object.freeze(['deterministic', 'skipped', 'already-done', 'wait']);

export function allowlistedJackpotCode(code) {
  return typeof code === 'string' && ALLOWED.has(code) ? code : 'unknown-error';
}

const entry = (cls, code) => Object.freeze({ class: cls, code });
const NOT_ELIGIBLE = entry('deterministic', 'not-eligible');
const CONFIG_ERROR = entry('deterministic', 'keeper-not-authorized');

// Revert string → class and code. `kinds` limits an entry to some action kinds
// (AFTER_END differs between submit and finalize).
export const JACKPOT_REVERTS = Object.freeze({
  // submit: the Neon filter and the chain disagree (an alert).
  NOT_FOUND: NOT_ELIGIBLE,
  NOT_VERIFIED: NOT_ELIGIBLE,
  WRONG_GAME: NOT_ELIGIBLE,
  NOT_PAID: NOT_ELIGIBLE,
  BELOW_MIN_PAID: NOT_ELIGIBLE,
  BEFORE_FIRST_WEEK: NOT_ELIGIBLE,
  WRONG_SEASON: NOT_ELIGIBLE,
  SURVIVAL_CAP: NOT_ELIGIBLE,
  SCORE_CAP: NOT_ELIGIBLE,
  ZERO_SCORE: NOT_ELIGIBLE,
  STAFF_WALLET: NOT_ELIGIBLE,
  // submit: terminal, not an error.
  SETTLED_LATE: entry('skipped', 'settled-late'),
  WINDOW_CLOSED: entry('skipped', 'window-closed'),
  WALLET_BLOCKED: entry('skipped', 'skipped'),
  DISQUALIFIED: entry('skipped', 'skipped'),
  NOT_BETTER: entry('skipped', 'skipped'),
  NOT_IN_TOP: entry('skipped', 'skipped'),
  // submit, finalize: the chain already holds it.
  ALREADY_CANDIDATE: entry('already-done', 'already-done'),
  WEEK_SETTLED: entry('already-done', 'already-done'),
  // J1 amendment: claim / recycle with nothing to move.
  NOTHING_TO_CLAIM: entry('already-done', 'already-done'),
  // finalize, clear: wait (the week goes to awaiting-admin for the last two).
  PAYOUT_NOT_DUE: entry('wait', 'payout-not-due'),
  PAUSED: entry('wait', 'jackpot-paused'),
  WEEK_HELD: entry('wait', 'week-held'),
  LEADER_NOT_CLEARED: entry('wait', 'leader-not-cleared'),
  // keeper clear or flag on an admin decision: it stands.
  REVIEW_LOCKED: entry('skipped', 'review-locked'),
  // configuration errors (an alert).
  ONLY_KEEPER: CONFIG_ERROR,
  ONLY_ADMIN: CONFIG_ERROR,
  'Only platform operator': CONFIG_ERROR,
});

// AFTER_END: a submit of a session after a scheduled end is a Neon/chain
// disagreement; a finalize of a week after the end is terminal (refund-only).
function afterEnd(kind) {
  return kind === 'finalize' ? entry('already-done', 'already-done') : NOT_ELIGIBLE;
}

// Reverts the keeper never sends (fund, claim, refund, constructor, admin and
// operator paths). Seeing one means a bug or a hostile node: deterministic.
export const NEVER_SENT_REVERTS = Object.freeze([
  'NOTHING_RECEIVED', 'BELOW_MIN_FUND', 'BAD_WEEK', 'ONLY_WINNER', 'TOO_EARLY', 'TOO_LATE', 'LIST_FULL', 'RULES_NOT_FUTURE',
  'RULES_TOO_FAR', 'TOO_MANY_EPOCHS', 'END_TOO_SOON', 'FUNDED_AFTER_END', 'NOT_AFTER_END', 'NOTHING_TO_REFUND', 'EXTENSION_CAP',
  'OPERATOR_LOCK', 'LIABILITIES_BREACHED', 'ZERO_ADDRESS', 'Only pending operator', 'ONLY_PENDING_ADMIN',
  'ONLY_RESIDUAL_RECIPIENT', 'BAD_RULES', 'END_FINAL', 'EMPTY_GAME_ID',
]);

// { class, code } of a decoded revert string for an action kind.
export function classifyJackpotRevert(reason, { kind = null } = {}) {
  if (typeof reason !== 'string' || !reason) return null;
  if (reason === 'AFTER_END') return afterEnd(kind);
  // DISQUALIFIED on a keeper flag is `skipped` too (same entry).
  if (Object.hasOwn(JACKPOT_REVERTS, reason)) return JACKPOT_REVERTS[reason];
  return entry('deterministic', 'unknown-error');
}

// Relayer infrastructure codes → jackpot codes.
const RELAY_CODE_MAP = Object.freeze({
  'relayer-underfunded': 'keeper-underfunded',
  'rpc-unavailable': 'chain-read-failed',
  'rpc-timeout': 'rpc-timeout',
  'nonce-conflict': 'nonce-conflict',
  'fee-too-high': 'fee-too-high',
  'lease-busy': 'lease-busy',
});

// { class, code } for any keeper failure: a revert (from estimateGas, a call
// or a receipt), a broadcast rejection, an RPC failure or a timeout.
export function classifyJackpotError(error, { kind = null, decodeRevert = decodeRevertReason } = {}) {
  let reason = null;
  try {
    reason = decodeRevert(error);
  } catch {
    reason = null;
  }
  if (reason) return classifyJackpotRevert(reason, { kind });
  const relay = classifyRelayError(error, { decodeRevert: () => null });
  if (relay.class === 'deterministic') return entry('deterministic', 'unknown-error');
  return entry('wait', allowlistedJackpotCode(RELAY_CODE_MAP[relay.code] ?? relay.code));
}

// A timeout error with the code classifyRelayError reads as rpc-timeout.
export function timeoutError(label = 'rpc') {
  return Object.assign(new Error(`${label} timed out`), { code: 'TIMEOUT' });
}
