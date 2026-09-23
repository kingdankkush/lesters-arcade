// Server-side SIWE session tokens (owner decision 2026-09-16: wallet login is
// the account; profiles sync across devices through a hosted database).
// Pure helpers: `ethers` and `crypto` are injected so the same code runs in
// the Vercel function and in Node tests. Tokens are v2 (contract A13):
// HMAC-SHA256 with SESSION_SECRET over `v2|<audience>|<wallet>|<expiresAt>`,
// where audience = 'lestersarcade:' + (VERCEL_ENV ?? 'production'). A v1 token
// (`wallet|expiresAt`) or a token minted for another audience never verifies.
// Tokens carry no private data.

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
// `expectedChainId` (optional): E2 passes 4441, and a login signed for any
// other chain then fails as wrong-chain after every other check has passed
// (contract §4.3.2). Callers that omit it behave as before.
export function verifySiweLogin(ethers, { challenge, signature, allowedDomains, nowMs = Date.now(), expectedChainId } = {}) {
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
  if (expectedChainId !== undefined && expectedChainId !== null && Number(chainId) !== Number(expectedChainId)) return { ok: false, error: 'wrong-chain' };
  return { ok: true, wallet: String(address).toLowerCase(), chainId: Number(chainId) };
}

export const SESSION_TOKEN_VERSION = 'v2';
// 'lestersarcade:production', 'lestersarcade:preview', 'lestersarcade:development', …
// Never contains '|', the payload separator.
const AUDIENCE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,95}$/;

function requireAudience(audience) {
  if (typeof audience !== 'string' || !AUDIENCE.test(audience)) throw new TypeError('session token audience must be a label such as lestersarcade:production');
  return audience;
}

export function issueSessionToken(crypto, { secret, wallet, nowMs = Date.now(), ttlMs = SESSION_TTL_MS, audience } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) throw new TypeError('session secret must be at least 32 characters');
  if (!HEX_ADDRESS.test(String(wallet ?? ''))) throw new TypeError('wallet must be an address');
  const tokenAudience = requireAudience(audience);
  const expiresAt = nowMs + ttlMs;
  const payload = `${SESSION_TOKEN_VERSION}|${tokenAudience}|${String(wallet).toLowerCase()}|${expiresAt}`;
  return { token: `${base64url(payload)}.${hmac(crypto, secret, payload)}`, expiresAt };
}

// Returns { wallet, expiresAt } for a live v2 token of this audience, else
// null. v1 tokens, other audiences, tampering and expiry all give null.
export function verifySessionToken(crypto, { secret, token, nowMs = Date.now(), audience } = {}) {
  if (typeof secret !== 'string' || secret.length < 32 || typeof token !== 'string') return null;
  if (typeof audience !== 'string' || !AUDIENCE.test(audience)) return null;
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra !== undefined) return null;
  let payload;
  try {
    payload = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const expected = hmac(crypto, secret, payload);
  const a = Buffer.from(expected), b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const parts = payload.split('|');
  if (parts.length !== 4) return null;
  const [version, tokenAudience, wallet, expiresAt] = parts;
  if (version !== SESSION_TOKEN_VERSION || tokenAudience !== audience) return null;
  if (!/^0x[a-f0-9]{40}$/.test(wallet) || !/^[0-9]{1,16}$/.test(expiresAt) || Number(expiresAt) < nowMs) return null;
  return { wallet, expiresAt: Number(expiresAt) };
}

// Bounded public profile document stored per wallet. Anything not listed is
// dropped so a client cannot stash arbitrary data server-side.
export const PROFILE_DOCUMENT_LIMITS = Object.freeze({ handle: 18, avatar: 8, runHistory: 50, achievements: 200, preferencesBytes: 2_048 });

// ISO-8601 timestamps keep their digits and : - T . Z (+ for offsets).
function isoText(value) {
  return String(value ?? '').replace(/[^0-9TZ:.+\-]/g, '').slice(0, 40);
}

// Avatars may be emoji, including multi-codepoint sequences (ZWJ, skin
// tones, flags), up to the limit in UTF-16 units, cut on a whole character.
function avatarText(value, maxUnits) {
  const cleaned = String(value ?? '').replace(/[^\p{L}\p{N}\p{Extended_Pictographic}\p{Emoji_Component}‍️ _.'\-]/gu, '');
  let out = '';
  for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(cleaned)) {
    if (out.length + segment.length > maxUnits) break;
    out += segment;
  }
  return out;
}

// A bare 64-hex hash stays bare; a 0x-prefixed one keeps its 0x. Both are
// stored lowercase.
function envelopeHashText(value) {
  const text = String(value ?? '');
  if (/^0x[0-9a-f]{64}$/i.test(text)) return `0x${text.slice(2).toLowerCase()}`;
  return /^[0-9a-f]{64}$/i.test(text) ? text.toLowerCase() : null;
}

export function sanitizeProfileDocument(input = {}) {
  const text = (value, max) => String(value ?? '').replace(/[^\p{L}\p{N} _.'\-]/gu, '').slice(0, max);
  const runs = Array.isArray(input.runHistory) ? input.runHistory.slice(0, PROFILE_DOCUMENT_LIMITS.runHistory) : [];
  const runHistory = runs.map((run) => ({
    sessionId: text(run?.sessionId, 64), gameId: text(run?.gameId, 32), mode: text(run?.mode, 16),
    score: Math.max(0, Math.round(Number(run?.score) || 0)), recordedAt: isoText(run?.recordedAt),
    kills: Math.max(0, Math.round(Number(run?.kills) || 0)), elapsedSeconds: Math.max(0, Math.round(Number(run?.elapsedSeconds) || 0)),
    envelopeHash: envelopeHashText(run?.envelopeHash),
  })).filter((run) => run.sessionId && run.gameId);
  const achievements = Array.isArray(input.achievements) ? [...new Set(input.achievements.map((id) => text(id, 64)).filter(Boolean))].slice(0, PROFILE_DOCUMENT_LIMITS.achievements) : [];
  let preferences = {};
  try {
    const json = JSON.stringify(input.preferences ?? {});
    preferences = json.length <= PROFILE_DOCUMENT_LIMITS.preferencesBytes ? JSON.parse(json) : {};
  } catch { preferences = {}; }
  return {
    handle: text(input.handle, PROFILE_DOCUMENT_LIMITS.handle),
    avatar: avatarText(input.avatar, PROFILE_DOCUMENT_LIMITS.avatar),
    xp: Math.max(0, Math.round(Number(input.xp) || 0)),
    rank: text(input.rank, 32),
    totalPaidRuns: Math.max(0, Math.round(Number(input.totalPaidRuns) || 0)),
    totalFreeRuns: Math.max(0, Math.round(Number(input.totalFreeRuns) || 0)),
    achievements,
    runHistory,
    preferences,
  };
}
