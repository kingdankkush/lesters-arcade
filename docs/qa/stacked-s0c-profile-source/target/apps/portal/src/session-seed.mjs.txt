// Session seeds (contract §2.3 and §2.7). Shared by the browser and the server,
// so this module imports only session-integrity.mjs and touches no DOM, no
// environment and no clock.
//
// - deriveSessionSeed: the Preview and Free seed, FNV-1a 32 over
//   `sessionId|gameId|seasonId|buildHash`. Moved here byte-identical from
//   arcade-core.mjs, which re-exports it (startPlaySession still calls it).
// - deriveRankedSeed: the live Ranked seed of a server-issued seed ticket, the
//   first 32 bits of a SHA-256 over the ticket's session binding and salt. It is
//   unpredictable until the server hands out the salt (decision A25).
import { canonicalSessionJson, sha256Hex } from './session-integrity.mjs';

export const RANKED_SEED_VERSION = 'lesters-ranked-seed-v1';
export const RANKED_SEED_SALT_PATTERN = /^[0-9a-f]{32}$/;

export function deriveSessionSeed({ sessionId, gameId, seasonId, buildHash } = {}) {
  const parts = [sessionId, gameId, seasonId, buildHash].map((value) => String(value ?? '').trim());
  if (parts.some((value) => !value)) throw new Error('sessionId, gameId, seasonId, and buildHash are required to derive a session seed');
  let hash = 0x811c9dc5;
  for (const character of parts.join('|')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${field} is required to derive a ranked seed`);
  return value;
}

// seed = parseInt(sha256Hex(canonicalSessionJson({ v, sessionId, wallet, gameId,
// seasonId, buildHash, salt })).slice(2, 10), 16) >>> 0, with the wallet in
// lowercase. WebCrypto, so it is the same function in the browser and in Node.
export async function deriveRankedSeed({ sessionId, wallet, gameId, seasonId, buildHash, salt } = {}, { cryptoProvider } = {}) {
  const preimage = {
    v: RANKED_SEED_VERSION,
    sessionId: requiredText(sessionId, 'sessionId'),
    wallet: requiredText(wallet, 'wallet').toLowerCase(),
    gameId: requiredText(gameId, 'gameId'),
    seasonId: requiredText(seasonId, 'seasonId'),
    buildHash: requiredText(buildHash, 'buildHash'),
    salt: requiredText(salt, 'salt'),
  };
  if (!RANKED_SEED_SALT_PATTERN.test(preimage.salt)) throw new TypeError('salt must be 32 lowercase hex characters');
  const digest = await sha256Hex(canonicalSessionJson(preimage), cryptoProvider ? { cryptoProvider } : undefined);
  return parseInt(digest.slice(2, 10), 16) >>> 0;
}
