// Server-side SIWE session tokens (owner decision 2026-09-16: wallet login is
// the account; profiles sync across devices through a hosted database).
// Pure helpers: `ethers` and `crypto` are injected so the same code runs in
// the Vercel function and in Node tests. Tokens are HMAC-SHA256 over
// `wallet|expiresAt` with SESSION_SECRET; they carry no private data.

import { buildSiweMessage, SIWE_CHALLENGE_TTL_MS } from './wallet-auth.mjs';

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmac(crypto, secret, payload) {
  return base64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

// Verify a SIWE login: the challenge must reconstruct byte for byte, belong
// to an allowed domain, be fresh, and the signature must recover to the
// challenged address.
export function verifySiweLogin(ethers, { challenge, signature, allowedDomains, nowMs = Date.now() } = {}) {
  if (!challenge || typeof challenge !== 'object') return { ok: false, error: 'missing-challenge' };
  const { domain, address, chainId, nonce, issuedAt, uri = null, message } = challenge;
  if (!HEX_ADDRESS.test(String(address ?? ''))) return { ok: false, error: 'invalid-address' };
  if (!Array.isArray(allowedDomains) || !allowedDomains.includes(String(domain))) return { ok: false, error: 'domain-not-allowed' };
  const issued = Date.parse(issuedAt ?? '');
  if (!Number.isFinite(issued) || nowMs - issued > SIWE_CHALLENGE_TTL_MS || issued - nowMs > 60_000) return { ok: false, error: 'challenge-stale' };
  // The wallet signed the message with the address exactly as the browser
  // presented it (checksummed); the stored challenge address is lowercased.
  // Rebuild from the message's own address line and bind it to the challenge.
  const messageAddress = String(message ?? '').split('\n')[1] ?? '';
  if (!HEX_ADDRESS.test(messageAddress) || messageAddress.toLowerCase() !== String(address).toLowerCase()) return { ok: false, error: 'message-mismatch' };
  let expected;
  try {
    expected = buildSiweMessage({ domain, address: messageAddress, chainId, nonce, issuedAt, uri: uri ?? undefined });
  } catch (error) {
    return { ok: false, error: 'invalid-challenge', detail: error.message };
  }
  if (expected !== message) return { ok: false, error: 'message-mismatch' };
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return { ok: false, error: 'invalid-signature' };
  let recovered;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    return { ok: false, error: 'invalid-signature' };
  }
  if (recovered.toLowerCase() !== String(address).toLowerCase()) return { ok: false, error: 'signer-mismatch' };
  return { ok: true, wallet: String(address).toLowerCase(), chainId: Number(chainId) };
}

export function issueSessionToken(crypto, { secret, wallet, nowMs = Date.now(), ttlMs = SESSION_TTL_MS } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('session secret must be at least 32 characters');
  if (!HEX_ADDRESS.test(String(wallet ?? ''))) throw new TypeError('wallet must be an address');
  const expiresAt = nowMs + ttlMs;
  const payload = `${String(wallet).toLowerCase()}|${expiresAt}`;
  return { token: `${base64url(payload)}.${hmac(crypto, secret, payload)}`, expiresAt };
}

export function verifySessionToken(crypto, { secret, token, nowMs = Date.now() } = {}) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  let payload;
  try {
    payload = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const expected = hmac(crypto, secret, payload);
  const a = Buffer.from(expected), b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [wallet, expiresAt] = payload.split('|');
  if (!HEX_ADDRESS.test(wallet) || !Number.isFinite(Number(expiresAt)) || Number(expiresAt) < nowMs) return null;
  return { wallet, expiresAt: Number(expiresAt) };
}

// Bounded public profile document stored per wallet. Anything not listed is
// dropped so a client cannot stash arbitrary data server-side.
export const PROFILE_DOCUMENT_LIMITS = Object.freeze({ handle: 18, avatar: 8, runHistory: 50, achievements: 200, preferencesBytes: 2_048 });

export function sanitizeProfileDocument(input = {}) {
  const text = (value, max) => String(value ?? '').replace(/[^\p{L}\p{N} _.'\-]/gu, '').slice(0, max);
  const runs = Array.isArray(input.runHistory) ? input.runHistory.slice(0, PROFILE_DOCUMENT_LIMITS.runHistory) : [];
  const runHistory = runs.map((run) => ({
    sessionId: text(run?.sessionId, 64), gameId: text(run?.gameId, 32), mode: text(run?.mode, 16),
    score: Math.max(0, Math.round(Number(run?.score) || 0)), recordedAt: text(run?.recordedAt, 40),
    kills: Math.max(0, Math.round(Number(run?.kills) || 0)), elapsedSeconds: Math.max(0, Math.round(Number(run?.elapsedSeconds) || 0)),
    envelopeHash: /^[0-9a-f]{64}$/i.test(String(run?.envelopeHash ?? '')) ? String(run.envelopeHash).toLowerCase() : null,
  })).filter((run) => run.sessionId && run.gameId);
  const achievements = Array.isArray(input.achievements) ? [...new Set(input.achievements.map((id) => text(id, 64)).filter(Boolean))].slice(0, PROFILE_DOCUMENT_LIMITS.achievements) : [];
  let preferences = {};
  try {
    const json = JSON.stringify(input.preferences ?? {});
    preferences = json.length <= PROFILE_DOCUMENT_LIMITS.preferencesBytes ? JSON.parse(json) : {};
  } catch { preferences = {}; }
  return {
    handle: text(input.handle, PROFILE_DOCUMENT_LIMITS.handle),
    avatar: text(input.avatar, PROFILE_DOCUMENT_LIMITS.avatar),
    xp: Math.max(0, Math.round(Number(input.xp) || 0)),
    rank: text(input.rank, 32),
    totalPaidRuns: Math.max(0, Math.round(Number(input.totalPaidRuns) || 0)),
    totalFreeRuns: Math.max(0, Math.round(Number(input.totalFreeRuns) || 0)),
    achievements,
    runHistory,
    preferences,
  };
}
