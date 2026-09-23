// Relayer error classes and the stored-error allowlist (contract §3.3, §4.4, A31).
//
// Every failure is decoded into one class and one allowlisted code:
//   deterministic  a contract rejection that will not change on retry: failed,
//                  attempts + 1, dead letter at 3 attempts
//   re-sign        the attestation expired or was rejected: back to pending,
//                  re-signed from re-verified evidence
//   already-done   SESSION_EXISTS: confirmed when getSession shows this player
//   wait           infrastructure or configuration trouble: failed with a
//                  backoff, attempts unchanged, never dead-letters on its own
//
// Stored last_error values and returned lastError values are only codes from
// the allowlist, never raw messages: ethers messages can embed the RPC URL,
// which may carry credentials. Logs carry the error name and code only.

import { ethers } from 'ethers';

// Revert reasons of ScoreSubmissionRegistry.submitVerifiedSession (§8.2) and
// their class. Codes are the names lowercased with '_' → '-', except
// NOT_PLAYER_OR_RELAYER, which the contract names relayer-not-allowed.
export const CONTRACT_REVERTS = Object.freeze({
  NOT_PLAYER_OR_RELAYER: Object.freeze({ class: 'wait', code: 'relayer-not-allowed' }),
  ATTESTATION_EXPIRED: Object.freeze({ class: 're-sign', code: 'attestation-expired' }),
  EMPTY_ENVELOPE_HASH: Object.freeze({ class: 'deterministic', code: 'empty-envelope-hash' }),
  EMPTY_SESSION_ID: Object.freeze({ class: 'deterministic', code: 'empty-session-id' }),
  EMPTY_GAME_ID: Object.freeze({ class: 'deterministic', code: 'empty-game-id' }),
  EMPTY_PLAYER: Object.freeze({ class: 'deterministic', code: 'empty-player' }),
  SESSION_EXISTS: Object.freeze({ class: 'already-done', code: 'session-exists' }),
  TOO_MANY_ACHIEVEMENTS: Object.freeze({ class: 'deterministic', code: 'too-many-achievements' }),
  ACHIEVEMENTS_HASH_MISMATCH: Object.freeze({ class: 'deterministic', code: 'achievements-hash-mismatch' }),
  GAME_NOT_PLAYABLE: Object.freeze({ class: 'wait', code: 'game-not-playable' }),
  RANKED_ENTRY_UNSET: Object.freeze({ class: 'wait', code: 'ranked-entry-unset' }),
  SESSION_NOT_PAID: Object.freeze({ class: 'deterministic', code: 'session-not-paid' }),
  SCORE_OUT_OF_BOUNDS: Object.freeze({ class: 'deterministic', code: 'score-out-of-bounds' }),
  KILLS_OUT_OF_BOUNDS: Object.freeze({ class: 'deterministic', code: 'kills-out-of-bounds' }),
  COMBO_OUT_OF_BOUNDS: Object.freeze({ class: 'deterministic', code: 'combo-out-of-bounds' }),
  SURVIVAL_OUT_OF_BOUNDS: Object.freeze({ class: 'deterministic', code: 'survival-out-of-bounds' }),
  INVALID_ATTESTATION: Object.freeze({ class: 're-sign', code: 'invalid-attestation' }),
  // OpenZeppelin ECDSA custom errors (a malformed or high-s signature).
  ECDSAInvalidSignature: Object.freeze({ class: 're-sign', code: 'invalid-attestation' }),
  ECDSAInvalidSignatureLength: Object.freeze({ class: 're-sign', code: 'invalid-attestation' }),
  ECDSAInvalidSignatureS: Object.freeze({ class: 're-sign', code: 'invalid-attestation' }),
});

// The fixed codes of §4.4.
export const FIXED_ERROR_CODES = Object.freeze([
  'relayer-not-allowed', 'relayer-underfunded', 'fee-too-high', 'rpc-unavailable', 'rpc-timeout', 'lease-busy',
  'nonce-conflict', 'dropped-tx', 'verifier-rejected', 'stored-run-mismatch', 'settlement-paused', 'stale', 'unknown-error',
]);

export const ERROR_CODE_ALLOWLIST = Object.freeze([...new Set([
  ...Object.values(CONTRACT_REVERTS).map((entry) => entry.code),
  ...FIXED_ERROR_CODES,
])]);
const ALLOWED = new Set(ERROR_CODE_ALLOWLIST);

export const ERROR_CLASSES = Object.freeze(['deterministic', 're-sign', 'already-done', 'wait']);

// Anything that is not an allowlisted code is stored as unknown-error.
export function allowlistedCode(code) {
  return typeof code === 'string' && ALLOWED.has(code) ? code : 'unknown-error';
}

const ERROR_STRING_SELECTOR = '0x08c379a0';
const CUSTOM_ERROR_SELECTORS = Object.freeze(Object.fromEntries(
  ['ECDSAInvalidSignature()', 'ECDSAInvalidSignatureLength(uint256)', 'ECDSAInvalidSignatureS(bytes32)']
    .map((signature) => [ethers.id(signature).slice(0, 10), signature.slice(0, signature.indexOf('('))]),
));
const REASON = /^[A-Za-z][A-Za-z0-9_ ]{0,63}$/;

function revertDataCandidates(error) {
  const out = [];
  const push = (value) => { if (typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value)) out.push(value); };
  push(error?.data);
  push(error?.info?.error?.data);
  push(error?.info?.error?.data?.data);
  push(error?.error?.data);
  push(error?.error?.data?.data);
  push(error?.error?.error?.data);
  return out;
}

function decodeRevertData(data) {
  if (data.startsWith(ERROR_STRING_SELECTOR) && data.length > 10) {
    try {
      const [reason] = ethers.AbiCoder.defaultAbiCoder().decode(['string'], `0x${data.slice(10)}`);
      return typeof reason === 'string' ? reason : null;
    } catch {
      return null;
    }
  }
  return CUSTOM_ERROR_SELECTORS[data.slice(0, 10).toLowerCase()] ?? null;
}

// The revert reason of a contract call or estimate ('SESSION_NOT_PAID'), or
// null when the error is not a decodable revert.
export function decodeRevertReason(error) {
  if (!error || typeof error !== 'object') return null;
  if (typeof error.reason === 'string' && REASON.test(error.reason)) return error.reason;
  const revert = error.revert;
  if (revert && typeof revert === 'object') {
    if (revert.name === 'Error' && typeof revert.args?.[0] === 'string' && REASON.test(revert.args[0])) return revert.args[0];
    if (typeof revert.name === 'string' && revert.name !== 'Error' && revert.name !== 'Panic' && REASON.test(revert.name)) return revert.name;
  }
  for (const data of revertDataCandidates(error)) {
    const reason = decodeRevertData(data);
    if (reason && REASON.test(reason)) return reason;
  }
  return null;
}

// Lowercased text of an error for matching only. It is never stored,
// returned or logged.
function errorText(error) {
  const parts = [error?.shortMessage, error?.message, error?.info?.error?.message, error?.error?.message, error?.error?.error?.message];
  return parts.filter((part) => typeof part === 'string').join(' | ').toLowerCase();
}

// 'too-low' | 'too-high' | 'replacement' | null (contract §3.4 nonce errors).
export function nonceErrorKind(error) {
  const code = error?.code;
  const text = errorText(error);
  if (code === 'NONCE_EXPIRED' || /nonce too low|nonce has already been used|nonce is too low|oldnonce/.test(text)) return 'too-low';
  if (/nonce too high|nonce is too high|nonce gap|future transaction/.test(text)) return 'too-high';
  if (code === 'REPLACEMENT_UNDERPRICED' || /replacement (transaction )?(fee|transaction)? ?underpriced|replacement fee too low|already known|known transaction/.test(text)) return 'replacement';
  return null;
}

function isTimeout(error) {
  return error?.code === 'TIMEOUT' || error?.code === 'ETIMEDOUT' || /timeout|timed out|etimedout/.test(errorText(error));
}

// True when an RPC node answered the broadcast with an explicit JSON-RPC
// error (the transaction is certainly not in its mempool). Timeouts and
// transport failures are ambiguous: the transaction may have been accepted.
export function isDefiniteRejection(error) {
  if (!error || typeof error !== 'object') return false;
  if (['INSUFFICIENT_FUNDS', 'NONCE_EXPIRED', 'REPLACEMENT_UNDERPRICED', 'CALL_EXCEPTION', 'INVALID_ARGUMENT'].includes(error.code)) return true;
  if (isTimeout(error) || error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') return false;
  return typeof error?.info?.error?.message === 'string' || typeof error?.error?.message === 'string';
}

// { class, code } for any relayer failure: an estimate, call or receipt
// revert, a broadcast rejection, or an RPC failure.
export function classifyRelayError(error, { decodeRevert = decodeRevertReason } = {}) {
  let reason = null;
  try {
    reason = decodeRevert(error);
  } catch {
    reason = null;
  }
  if (typeof reason === 'string' && reason) {
    const known = CONTRACT_REVERTS[reason];
    if (known) return { class: known.class, code: known.code };
    // A revert the contract table does not name ("Only minter" from a
    // misconfigured collection, for example) is still a contract rejection.
    return { class: 'deterministic', code: 'unknown-error' };
  }
  if (nonceErrorKind(error)) return { class: 'wait', code: 'nonce-conflict' };
  if (error?.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/.test(errorText(error))) return { class: 'wait', code: 'relayer-underfunded' };
  if (isTimeout(error)) return { class: 'wait', code: 'rpc-timeout' };
  if (error?.code === 'CALL_EXCEPTION') return { class: 'deterministic', code: 'unknown-error' };
  if (['NETWORK_ERROR', 'SERVER_ERROR', 'UNKNOWN_ERROR', 'BAD_DATA', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(error?.code)
    || /fetch failed|failed to detect network|could not detect network|missing response|bad response|socket hang up|econnrefused|econnreset|enotfound/.test(errorText(error))) {
    return { class: 'wait', code: 'rpc-unavailable' };
  }
  return { class: 'wait', code: 'unknown-error' };
}

// Logs the error name and code only: never the message (RPC URLs, connection
// strings), never deps, config, wallets or the raw error object.
export function logSafeError(label, error) {
  const name = typeof error?.name === 'string' ? error.name : 'Error';
  const code = typeof error?.code === 'string' || typeof error?.code === 'number' ? error.code : 'none';
  console.error(`[${label}]`, name, code);
}
