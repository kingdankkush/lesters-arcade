// Ranked identity (contract §7.1): the one module the browser and the server
// share for session keys, share ids, the v2 ranked envelope and seed tickets.
// Pure: it imports only session-integrity.mjs and session-seed.mjs, has no DOM,
// and reads no environment or clock.
import { createCanonicalSessionIdentity, sha256Hex } from './session-integrity.mjs';
import { RANKED_SEED_SALT_PATTERN, RANKED_SEED_VERSION } from './session-seed.mjs';

export const RANKED_SETTLE_VERSION = 'lesters-ranked-settle-v1';
export const RANKED_ENVELOPE_VERSION = 'lesters-ranked-envelope-v2';
export const RANKED_CHAIN_ID = 4441;
// §2.3: 'game-session-' + a lowercase RFC 4122 uuid.
export const RANKED_SESSION_HANDLE_PREFIX = 'game-session-';
export const RANKED_SESSION_HANDLE_PATTERN = Object.freeze(/^game-session-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const SESSION_ID32_PATTERN = /^0x[0-9a-f]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const MAC_PATTERN = /^[0-9a-f]{64}$/;

// §2.1, §2.2, §2.6 and A11. The *32 ids are ethers.id of these strings; they
// are pinned by tests, so this module needs no keccak.
export const RANKED_GAMES = Object.freeze({
  'lester-blaster': Object.freeze({
    gameId: 'lester-blaster',
    slug: 'hard-money-heroes',
    title: 'Hard Money Heroes',
    seasonId: 'hmh-season-1-2026',
    runtimeId: 'lester-blaster:hmh-run-summary-v6',
    buildHashPattern: Object.freeze(/^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+$/),
    evidenceEncoding: 'hmh-run-summary-v6+json',
  }),
  chikun: Object.freeze({
    gameId: 'chikun',
    slug: 'chikun',
    title: "Chikun's Escape",
    seasonId: 'chikun-season-preview-1',
    runtimeId: 'chikun:canvas-runtime-v7',
    buildHashPattern: Object.freeze(/^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+:cabinet-\d+\.\d+\.\d+$/),
    evidenceEncoding: 'chikun-flap-evidence-v6+json',
  }),
  stacked: Object.freeze({
    gameId: 'stacked',
    slug: 'stacked',
    title: 'STACKED',
    seasonId: 'stacked-season-preview-1',
    runtimeId: 'stacked:stacked-result-v1',
    buildHashPattern: Object.freeze(/^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+:cabinet-\d+\.\d+\.\d+$/),
    evidenceEncoding: 'stacked-sic1+base64',
  }),
});
export const RANKED_GAME_IDS = Object.freeze(Object.keys(RANKED_GAMES));

// The §2.4 preimage: exactly these 9 keys (createCanonicalSessionIdentity adds
// version and sessionKey).
export const RANKED_IDENTITY_KEYS = Object.freeze(['sessionId', 'chainId', 'scoreRegistryAddress', 'wallet', 'gameId', 'seasonId', 'buildHash', 'seed', 'nonce']);
const SORTED_IDENTITY_KEYS = Object.freeze([...RANKED_IDENTITY_KEYS].sort());

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isUint32 = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const lower = (value) => (typeof value === 'string' ? value.toLowerCase() : '');

function requireAddress(value, field) {
  const normalized = lower(value).trim();
  if (!ADDRESS_PATTERN.test(normalized)) throw new TypeError(`${field} must be an EVM address`);
  return normalized;
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} is required for a ranked identity`);
  return value;
}

// The identity preimage of a Ranked session (A10). seasonId comes from the
// session (the per-game value), never from CURRENT_RANKED_SEASON_ID; seed is
// session.seed (the ticket seed once applySeedTicket ran) and nonce is
// session.sessionNonce. Synchronous; throws on an incomplete session.
export function rankedIdentityFor(session, { chainId = RANKED_CHAIN_ID, scoreRegistryAddress } = {}) {
  if (!session || typeof session !== 'object') throw new TypeError('session is required for a ranked identity');
  const context = session.canonicalContext ?? {};
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new TypeError('chainId must be a positive integer');
  if (!isUint32(session.seed)) throw new TypeError('session.seed must be an unsigned 32-bit integer');
  return Object.freeze({
    sessionId: requireText(context.sessionId ?? session.sessionId, 'sessionId'),
    chainId,
    scoreRegistryAddress: requireAddress(scoreRegistryAddress, 'scoreRegistryAddress'),
    wallet: requireAddress(context.wallet ?? session.wallet, 'wallet'),
    gameId: requireText(context.gameId ?? session.gameId, 'gameId'),
    seasonId: requireText(session.seasonId, 'seasonId'),
    buildHash: requireText(context.buildHash ?? session.buildHash, 'buildHash'),
    seed: session.seed,
    nonce: requireText(session.sessionNonce, 'sessionNonce'),
  });
}

// sessionId32 = '0x' + sha256(canonicalSessionJson({ version, ...identity })).
export async function rankedSessionKey(identity) {
  return (await createCanonicalSessionIdentity(identity)).sessionKey;
}

// §5.2 minus the async checks (ticket, seed, session key), in the contract's
// order. Every error is a 400 code of §4.3.3.
export function validateRankedIdentity(identity, { chainId = RANKED_CHAIN_ID, scoreRegistryAddress, wallet, gameId } = {}) {
  const fail = (error) => Object.freeze({ ok: false, error });
  if (!isPlainObject(identity)) return fail('identity-invalid');
  const keys = Object.keys(identity).sort();
  if (keys.length !== SORTED_IDENTITY_KEYS.length || keys.some((key, index) => key !== SORTED_IDENTITY_KEYS[index])) return fail('identity-invalid');
  for (const key of ['sessionId', 'scoreRegistryAddress', 'wallet', 'gameId', 'seasonId', 'buildHash', 'nonce']) {
    if (typeof identity[key] !== 'string' || !identity[key]) return fail('identity-invalid');
  }
  if (!Number.isSafeInteger(identity.chainId) || !isUint32(identity.seed)) return fail('identity-invalid');
  const game = Object.hasOwn(RANKED_GAMES, identity.gameId) ? RANKED_GAMES[identity.gameId] : null;
  if (!game) return fail('identity-game-unknown');
  if (identity.gameId !== gameId) return fail('identity-invalid');
  if (identity.chainId !== chainId) return fail('identity-chain-mismatch');
  const registry = lower(identity.scoreRegistryAddress);
  if (!ADDRESS_PATTERN.test(registry) || registry !== lower(scoreRegistryAddress)) return fail('identity-registry-mismatch');
  const player = lower(identity.wallet);
  if (!ADDRESS_PATTERN.test(player) || player !== lower(wallet)) return fail('identity-wallet-mismatch');
  if (identity.seasonId !== game.seasonId) return fail('identity-season-mismatch');
  if (!game.buildHashPattern.test(identity.buildHash)) return fail('identity-buildhash-invalid');
  if (!RANKED_SESSION_HANDLE_PATTERN.test(identity.sessionId)) return fail('identity-session-invalid');
  if (identity.nonce !== identity.sessionId.slice(RANKED_SESSION_HANDLE_PREFIX.length)) return fail('identity-nonce-mismatch');
  return Object.freeze({
    ok: true,
    identity: Object.freeze({
      sessionId: identity.sessionId,
      chainId: identity.chainId,
      scoreRegistryAddress: registry,
      wallet: player,
      gameId: identity.gameId,
      seasonId: identity.seasonId,
      buildHash: identity.buildHash,
      seed: identity.seed,
      nonce: identity.nonce,
    }),
  });
}

// §2.5: shareId is the session key without 0x, as 64 lowercase hex.
export function shareIdFor(sessionId32) {
  if (typeof sessionId32 !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(sessionId32)) throw new TypeError('sessionId32 must be 0x followed by 64 hex characters');
  return sessionId32.slice(2).toLowerCase();
}

// Accepts either form (64 hex, with or without 0x); anything else is null.
export function sessionId32ForShareId(shareId) {
  if (typeof shareId !== 'string') return null;
  const hex = /^0x/i.test(shareId) ? shareId.slice(2) : shareId;
  return /^[0-9a-fA-F]{64}$/.test(hex) ? `0x${hex.toLowerCase()}` : null;
}

// WebCrypto SHA-256 of raw bytes (Node 20+ and browsers).
export async function sha256BytesHex(bytes, { cryptoProvider = globalThis.crypto } = {}) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be a Uint8Array');
  if (!cryptoProvider?.subtle?.digest) throw new Error('Web Crypto SHA-256 is required');
  const digest = await cryptoProvider.subtle.digest('SHA-256', bytes);
  return `0x${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function decodeCanonicalBase64(text) {
  if (typeof text !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new TypeError('sic1 must be standard base64 with padding');
  const binary = atob(text);
  if (btoa(binary) !== text) throw new TypeError('sic1 base64 is not canonical');
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function gameOf(gameId) {
  if (typeof gameId !== 'string' || !Object.hasOwn(RANKED_GAMES, gameId)) throw new TypeError(`unknown ranked gameId: ${String(gameId)}`);
  return RANKED_GAMES[gameId];
}

// §2.6 evidenceDigest. `evidence` is either the per-game evidence itself (the
// v6 flap object, the SIC1 bytes, or { runSummary, sessionEnvelope }) or the
// §5.1 settle-body evidence that wraps it. None of the bare forms has an
// `encoding` key, so an object with one is a wrapper and its encoding must be
// the game's: a wrong one throws rather than hashing the wrapper.
export async function evidenceDigestFor(gameId, evidence) {
  const game = gameOf(gameId);
  const wrapped = isPlainObject(evidence) && Object.hasOwn(evidence, 'encoding');
  if (wrapped && evidence.encoding !== game.evidenceEncoding) throw new TypeError(`evidence encoding must be ${game.evidenceEncoding}`);
  if (gameId === 'chikun') {
    const flap = wrapped ? evidence.flap : evidence;
    if (!isPlainObject(flap)) throw new TypeError('Chikun evidence must be the v6 flap object');
    return sha256Hex(flap);
  }
  if (gameId === 'stacked') {
    const bytes = wrapped ? decodeCanonicalBase64(evidence.sic1) : evidence;
    return sha256BytesHex(bytes);
  }
  if (!isPlainObject(evidence) || !Object.hasOwn(evidence, 'runSummary') || !Object.hasOwn(evidence, 'sessionEnvelope')) {
    throw new TypeError('Hard Money Heroes evidence must carry runSummary and sessionEnvelope');
  }
  return sha256Hex({ runSummary: evidence.runSummary, sessionEnvelope: evidence.sessionEnvelope });
}

// §2.6: the on-chain envelopeHash of a Ranked run. The only implementation;
// the browser and the server share it.
export async function rankedEnvelopeHash({ gameId, sessionId32, encoding, evidenceDigest } = {}) {
  const game = gameOf(gameId);
  if (encoding !== game.evidenceEncoding) throw new TypeError(`encoding must be ${game.evidenceEncoding}`);
  if (typeof sessionId32 !== 'string' || !SESSION_ID32_PATTERN.test(sessionId32)) throw new TypeError('sessionId32 must be 0x followed by 64 lowercase hex characters');
  if (typeof evidenceDigest !== 'string' || !SESSION_ID32_PATTERN.test(evidenceDigest)) throw new TypeError('evidenceDigest must be 0x followed by 64 lowercase hex characters');
  return sha256Hex({ version: RANKED_ENVELOPE_VERSION, gameId, sessionKey: sessionId32, encoding, evidenceDigest });
}

// A25: apply a server seed ticket to the pending session before the identity
// and the session key are computed, and before the game mounts.
export function applySeedTicket(session, { seed, seedTicket } = {}) {
  if (!session || typeof session !== 'object') throw new TypeError('session is required');
  if (!isUint32(seed)) throw new TypeError('ticket seed must be an unsigned 32-bit integer');
  if (!isPlainObject(seedTicket) || seedTicket.v !== RANKED_SEED_VERSION
    || typeof seedTicket.salt !== 'string' || !RANKED_SEED_SALT_PATTERN.test(seedTicket.salt)
    || !Number.isSafeInteger(seedTicket.issuedAt) || seedTicket.issuedAt < 0
    || typeof seedTicket.mac !== 'string' || !MAC_PATTERN.test(seedTicket.mac)) {
    throw new TypeError('seedTicket must be { v, salt, issuedAt, mac } per contract §2.7');
  }
  session.seed = seed;
  session.canonicalContext = Object.freeze({ ...session.canonicalContext, seed });
  session.seedTicket = Object.freeze({ v: seedTicket.v, salt: seedTicket.salt, issuedAt: seedTicket.issuedAt, mac: seedTicket.mac });
  return session;
}
