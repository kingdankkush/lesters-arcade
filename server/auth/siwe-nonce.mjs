// Server-issued SIWE nonces (contract A13, §4.3.1, §4.3.2).
//
// A nonce is stateless and HMAC-signed with SESSION_SECRET:
//
//   nonce = hex(16 random bytes) ‖ hex8(expiresAtSeconds) ‖ first 16 bytes of
//           HMAC-SHA256(SESSION_SECRET, 'siwe-nonce|' + randomHex + '|' + expiresAtSeconds)
//
// 72 lowercase hex characters in all. It expires 10 minutes after issue and is
// made single-use by inserting it into auth_nonces (primary key) when a login
// spends it: a second use finds the row and fails as nonce-used.
//
// Server-only (A14). Nothing here logs or returns the secret.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIWE_NONCE_TTL_MS = 10 * 60 * 1000;
export const SIWE_NONCE_PATTERN = /^[0-9a-f]{72}$/;
const RANDOM_HEX = 32;
const EXPIRY_HEX = 8;

function macHex(secret, randomHex, expiresAtSeconds) {
  return createHmac('sha256', secret).update(`siwe-nonce|${randomHex}|${expiresAtSeconds}`).digest('hex').slice(0, 32);
}

function requireSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('SIWE nonces need a session secret of at least 32 characters');
  return secret;
}

function toHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

// Returns { nonce, issuedAt, expiresAt } with ISO timestamps (milliseconds).
// `randomBytes(n)` is injected (node:crypto randomBytes in production).
export function issueSiweNonce({ secret, nowMs = Date.now(), randomBytes } = {}) {
  requireSecret(secret);
  if (typeof randomBytes !== 'function') throw new TypeError('issueSiweNonce needs randomBytes');
  const now = Number(nowMs);
  if (!Number.isFinite(now)) throw new TypeError('issueSiweNonce needs nowMs');
  const random = toHex(randomBytes(16));
  if (!/^[0-9a-f]{32}$/.test(random)) throw new TypeError('randomBytes(16) must return 16 bytes');
  const expiresAtMs = now + SIWE_NONCE_TTL_MS;
  const expiresAtSeconds = Math.floor(expiresAtMs / 1000);
  const nonce = `${random}${expiresAtSeconds.toString(16).padStart(EXPIRY_HEX, '0')}${macHex(secret, random, expiresAtSeconds)}`;
  return Object.freeze({
    nonce,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
  });
}

// Checks the format and the MAC first (nonce-invalid), then the expiry
// (nonce-expired). Returns { ok:true, expiresAtMs } or { ok:false, error }.
export function checkSiweNonce(nonce, { secret, nowMs = Date.now() } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) return { ok: false, error: 'nonce-invalid' };
  if (typeof nonce !== 'string' || !SIWE_NONCE_PATTERN.test(nonce)) return { ok: false, error: 'nonce-invalid' };
  const random = nonce.slice(0, RANDOM_HEX);
  const expiresAtSeconds = parseInt(nonce.slice(RANDOM_HEX, RANDOM_HEX + EXPIRY_HEX), 16);
  const given = Buffer.from(nonce.slice(RANDOM_HEX + EXPIRY_HEX), 'utf8');
  const expected = Buffer.from(macHex(secret, random, expiresAtSeconds), 'utf8');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, error: 'nonce-invalid' };
  const expiresAtMs = expiresAtSeconds * 1000;
  if (!(Number(nowMs) < expiresAtMs)) return { ok: false, error: 'nonce-expired' };
  return { ok: true, expiresAtMs };
}

// Spends a nonce: one statement, single use through the auth_nonces primary
// key. Returns true when this call consumed it, false when it was used before.
export async function consumeSiweNonce(db, { nonce, wallet = null, expiresAt } = {}) {
  if (typeof nonce !== 'string' || !SIWE_NONCE_PATTERN.test(nonce)) throw new TypeError('consumeSiweNonce needs a server nonce');
  const expires = typeof expiresAt === 'number' ? new Date(expiresAt).toISOString() : String(expiresAt ?? '');
  if (Number.isNaN(Date.parse(expires))) throw new TypeError('consumeSiweNonce needs expiresAt');
  const rows = await db.query(
    'INSERT INTO auth_nonces (nonce, wallet, expires_at) VALUES ($1, $2, $3::timestamptz) ON CONFLICT DO NOTHING RETURNING nonce',
    [nonce, wallet === null || wallet === undefined ? null : String(wallet).toLowerCase(), expires],
  );
  return rows.length === 1;
}
