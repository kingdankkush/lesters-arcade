// E15 POST /api/ranked/seed (contract §4.3.13, §2.7, A25, A27).
//
// Issues the server seed ticket of a live Ranked session: a random 16-byte
// salt, issuedAt and a MAC binding them to the session, wallet, game, season
// and build. The browser applies it before it computes the session key and
// pays, so a paused or unconfigured service (503) stops players before any
// payment. The ticket itself comes from the verify slice's issueSeedTicket
// (server/verify/seed-ticket.mjs), injected as deps.issueSeedTicket.
//
// E15 is ready only when E3 could settle the run: the verify functions, the
// achievements registry and, for Hard Money Heroes, the hero gates must load
// too. Otherwise it answers 503 and the player never pays for a run that E3
// would refuse to settle.

import * as nodeCrypto from 'node:crypto';
import { ipBucket } from '../http.mjs';
import { authenticateBearer, bearerAuthHook } from '../auth/bearer.mjs';
import { RANKED_GAMES, RANKED_SESSION_HANDLE_PATTERN } from '../../apps/portal/src/ranked-identity.mjs';
import { ensureSchema } from '../neon/migrations.mjs';
import { hitRateLimit, rateLimitedResult } from '../neon/rate-limit.mjs';
import { logSeedTicketInBackground } from '../jackpot/ticket-log.mjs';
import { logSafeError } from './errors.mjs';
import { heroPolicyFrom, moduleGate, optionalImport, settlementGate } from './settle-core.mjs';

export const SEED_BODY_MAX_BYTES = 2048;
export const SEED_LIMITS = Object.freeze({ wallet: 60, ip: 600, windowSeconds: 3600 });
// The session handle, season and build hash rules are the verifier's own
// (apps/portal/src/ranked-identity.mjs, which bindRankedIdentity applies in
// E3), not copies, so E15 never issues a ticket for a session E3 would refuse
// after the player paid.
export const SESSION_HANDLE_PATTERN = RANKED_SESSION_HANDLE_PATTERN;
// A11: format-checked, not allowlisted.
export const BUILD_HASH_PATTERNS = Object.freeze(Object.fromEntries(Object.entries(RANKED_GAMES).map(([gameId, game]) => [gameId, game.buildHashPattern])));
const BODY_KEYS = ['buildHash', 'gameId', 'seasonId', 'sessionId'];

const NO_STORE = Object.freeze({ 'Cache-Control': 'no-store' });
const json = (status, body) => ({ status, body, headers: { ...NO_STORE } });
const fail = (status, error, extra = {}) => json(status, { ok: false, error, ...extra });

export function validateSeedBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Object.keys(body).sort().join(',') !== BODY_KEYS.join(',')) return false;
  const { gameId, sessionId, seasonId, buildHash } = body;
  if (![gameId, sessionId, seasonId, buildHash].every((value) => typeof value === 'string')) return false;
  if (!Object.hasOwn(RANKED_GAMES, gameId)) return false;
  if (seasonId !== RANKED_GAMES[gameId].seasonId) return false;
  if (!SESSION_HANDLE_PATTERN.test(sessionId)) return false;
  return BUILD_HASH_PATTERNS[gameId].test(buildHash);
}

async function limitedBy(db, bucket, limit, nowMs) {
  const hit = await hitRateLimit(db, { bucket, limit, windowSeconds: SEED_LIMITS.windowSeconds, nowMs });
  return hit.ok ? null : rateLimitedResult(hit.retryAfterSeconds);
}

// The ticket issuer plus everything E3 needs to settle (moduleGate).
export function seedModuleGate(deps) {
  if (typeof deps?.issueSeedTicket !== 'function') return fail(503, 'settlement-not-configured', { detail: 'seed-ticket-unavailable' });
  return moduleGate(deps);
}

// The makeHandler auth hook of E15 (A30, §4.3.13): the Bearer, then the pause,
// the config and the modules, all before the body is read.
export function seedAuthHook() {
  const bearer = bearerAuthHook();
  return async function seedAuth(request, deps) {
    return (await bearer(request, deps)) ?? settlementGate(deps) ?? seedModuleGate(deps);
  };
}

async function heroGatesReady(deps) {
  try {
    return heroPolicyFrom(typeof deps.heroGates === 'function' ? await deps.heroGates() : deps.heroGates) !== null;
  } catch (error) {
    logSafeError('ranked-seed:hero-gates', error);
    return false;
  }
}

export async function seedRequest({ headers = {}, body = null, ip = 'unknown' } = {}, deps) {
  const auth = authenticateBearer(headers, deps);
  if (!auth.ok) return auth.status === 503 ? fail(503, 'settlement-not-configured', { detail: [...(deps?.config?.missing ?? [])].join(',').slice(0, 240) }) : fail(401, 'invalid-session');
  const gate = settlementGate(deps) ?? seedModuleGate(deps);
  if (gate) return gate;
  const { issueSeedTicket } = deps;
  if (!validateSeedBody(body)) return fail(400, 'invalid-body');
  if (body.gameId === 'lester-blaster' && !(await heroGatesReady(deps))) return fail(503, 'settlement-not-configured', { detail: 'hero-gates-unavailable' });
  const { db, config } = deps;
  const nowMs = typeof deps.nowMs === 'function' ? deps.nowMs() : Date.now();
  const secret = config.session.secret();
  await ensureSchema(db);
  const limited = (await limitedBy(db, `seed:w:${auth.wallet}`, SEED_LIMITS.wallet, nowMs)) ?? (await limitedBy(db, `seed:ip:${ipBucket(ip, secret)}`, SEED_LIMITS.ip, nowMs));
  if (limited) return limited;
  const crypto = deps.crypto ?? nodeCrypto;
  const issued = await issueSeedTicket({
    crypto,
    secret,
    nowMs,
    randomBytes: (size) => crypto.randomBytes(size),
    sessionId: body.sessionId,
    wallet: auth.wallet,
    gameId: body.gameId,
    seasonId: body.seasonId,
    buildHash: body.buildHash,
  });
  // Seed-ticket log (jackpot-server; design §C.4 "Seed tickets"): one
  // best-effort background insert. It is never awaited, never throws, is a
  // no-op without the table, and never changes this response or its timing.
  try {
    logSeedTicketInBackground(db, { wallet: auth.wallet, sessionId: body.sessionId, gameId: body.gameId, seasonId: body.seasonId, buildHash: body.buildHash, seedTicket: issued.seedTicket });
  } catch (error) {
    logSafeError('ranked-seed:ticket-log', error);
  }
  return json(200, { ok: true, seedTicket: issued.seedTicket, seed: issued.seed });
}

// The verify slice's issueSeedTicket (server/verify/seed-ticket.mjs), resolved
// at request time; null when it cannot load, so E15 fails closed with 503.
// Every import failure, ERR_MODULE_NOT_FOUND included, is logged by error name
// and code only. `load` is a test seam.
export async function loadIssueSeedTicket(load = () => import('../verify/seed-ticket.mjs')) {
  const module = await optionalImport(load, 'seed-ticket');
  return typeof module?.issueSeedTicket === 'function' ? module.issueSeedTicket : null;
}
