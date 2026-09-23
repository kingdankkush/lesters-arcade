// Server-issued seed tickets (contract A25, §2.7). Server only.
//
//   seedTicket = { v: 'lesters-ranked-seed-v1', salt, issuedAt, mac }
//   mac  = hex(HMAC-SHA256(SESSION_SECRET, 'lesters-ranked-seed-v1|' +
//            [sessionId, wallet, gameId, seasonId, buildHash, salt, issuedAt].join('|')))
//   seed = deriveRankedSeed({ sessionId, wallet, gameId, seasonId, buildHash, salt })
//
// crypto (node:crypto shaped: createHmac, timingSafeEqual, randomBytes) and the
// secret are injected. The secret may be a string or a function returning one
// (config.session.secret), so callers never have to hold it in an object.
// A ticket is bound to one sessionId, so replaying it only reproduces a session
// key that can be paid once; no single-use table is needed.
import * as nodeCrypto from 'node:crypto';
import { deriveRankedSeed, RANKED_SEED_SALT_PATTERN, RANKED_SEED_VERSION } from '../../apps/portal/src/session-seed.mjs';

export const SEED_TICKET_VERSION = RANKED_SEED_VERSION;
export const SEED_TICKET_FUTURE_SKEW_MS = 60_000;
export const SEED_TICKET_ERROR = 'seed-ticket-invalid';
const SEED_TICKET_KEYS = Object.freeze(['issuedAt', 'mac', 'salt', 'v']);
const MAC_PATTERN = /^[0-9a-f]{64}$/;
const MIN_SECRET_LENGTH = 32;

function secretText(secret) {
  const value = typeof secret === 'function' ? secret() : secret;
  if (typeof value !== 'string' || value.length < MIN_SECRET_LENGTH) throw new TypeError(`seed ticket secret must be a string of at least ${MIN_SECRET_LENGTH} characters`);
  return value;
}

function nowMsOf(nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('nowMs must be a non-negative integer of milliseconds');
  return nowMs;
}

function bindingOf({ sessionId, wallet, gameId, seasonId, buildHash }) {
  const binding = { sessionId, wallet, gameId, seasonId, buildHash };
  for (const [field, value] of Object.entries(binding)) {
    if (typeof value !== 'string' || !value || value.includes('|')) throw new TypeError(`seed ticket ${field} must be a non-empty string without '|'`);
  }
  return { ...binding, wallet: wallet.toLowerCase() };
}

// The exact MAC input of §2.7.
export function seedTicketMacInput({ sessionId, wallet, gameId, seasonId, buildHash, salt, issuedAt }) {
  const binding = bindingOf({ sessionId, wallet, gameId, seasonId, buildHash });
  return `${SEED_TICKET_VERSION}|${[binding.sessionId, binding.wallet, binding.gameId, binding.seasonId, binding.buildHash, salt, issuedAt].join('|')}`;
}

function macFor(crypto, secret, fields) {
  return crypto.createHmac('sha256', secretText(secret)).update(seedTicketMacInput(fields), 'utf8').digest('hex');
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// → Promise<{ seedTicket, seed }>. issuedAt comes from the injected clock.
export async function issueSeedTicket({
  crypto = nodeCrypto,
  secret,
  nowMs,
  randomBytes = (length) => crypto.randomBytes(length),
  sessionId,
  wallet,
  gameId,
  seasonId,
  buildHash,
} = {}) {
  const binding = bindingOf({ sessionId, wallet, gameId, seasonId, buildHash });
  const issuedAt = Math.floor(nowMsOf(nowMs) / 1000);
  const random = randomBytes(16);
  if (!random || random.length !== 16) throw new TypeError('randomBytes(16) must return 16 bytes');
  const salt = toHex(random);
  const mac = macFor(crypto, secret, { ...binding, salt, issuedAt });
  const seed = await deriveRankedSeed({ ...binding, salt });
  return Object.freeze({
    seedTicket: Object.freeze({ v: SEED_TICKET_VERSION, salt, issuedAt, mac }),
    seed,
  });
}

// The §2.7 shape: exactly { v, salt, issuedAt, mac }, all well formed.
export function isSeedTicketShape(seedTicket) {
  if (!seedTicket || typeof seedTicket !== 'object' || Array.isArray(seedTicket)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(seedTicket))) return false;
  const keys = Object.keys(seedTicket).sort();
  if (keys.length !== SEED_TICKET_KEYS.length || keys.some((key, index) => key !== SEED_TICKET_KEYS[index])) return false;
  return seedTicket.v === SEED_TICKET_VERSION
    && typeof seedTicket.salt === 'string' && RANKED_SEED_SALT_PATTERN.test(seedTicket.salt)
    && Number.isSafeInteger(seedTicket.issuedAt) && seedTicket.issuedAt >= 0
    && typeof seedTicket.mac === 'string' && MAC_PATTERN.test(seedTicket.mac);
}

// → { ok:true, error:null } | { ok:false, error:'seed-ticket-invalid', detail }.
// Checks the shape, that issuedAt is at most 60 s in the future, and the MAC
// (timingSafeEqual). It never reads the seed: bindRankedIdentity compares the
// identity seed with deriveRankedSeed afterwards.
export function checkSeedTicket(seedTicket, {
  crypto = nodeCrypto,
  secret,
  nowMs,
  sessionId,
  wallet,
  gameId,
  seasonId,
  buildHash,
} = {}) {
  const fail = (detail) => Object.freeze({ ok: false, error: SEED_TICKET_ERROR, detail });
  const now = nowMsOf(nowMs);
  const key = secretText(secret);
  if (!isSeedTicketShape(seedTicket)) return fail('shape');
  if (seedTicket.issuedAt * 1000 > now + SEED_TICKET_FUTURE_SKEW_MS) return fail('future');
  let binding;
  try {
    binding = bindingOf({ sessionId, wallet, gameId, seasonId, buildHash });
  } catch {
    return fail('binding');
  }
  const expected = Buffer.from(macFor(crypto, key, { ...binding, salt: seedTicket.salt, issuedAt: seedTicket.issuedAt }), 'hex');
  const received = Buffer.from(seedTicket.mac, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return fail('mac');
  return Object.freeze({ ok: true, error: null });
}
