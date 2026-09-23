// E15 POST /api/ranked/seed (contract §4.3.13, §2.7, A25, A27).
//
// Issues the server seed ticket of a live Ranked session: a random 16-byte
// salt, issuedAt and a MAC binding them to the session, wallet, game, season
// and build. The browser applies it before it computes the session key and
// pays, so a paused or unconfigured service (503) stops players before any
// payment. The ticket itself comes from the verify slice's issueSeedTicket
// (server/verify/seed-ticket.mjs), injected as deps.issueSeedTicket.

import * as nodeCrypto from 'node:crypto';
import { ipBucket } from '../http.mjs';
import { authenticateBearer } from '../auth/bearer.mjs';
import { ensureSchema } from '../neon/migrations.mjs';
import { hitRateLimit, rateLimitedResult } from '../neon/rate-limit.mjs';
import { INDEX_GAMES } from '../neon/rows.mjs';
import { logSafeError } from './errors.mjs';
import { settlementGate } from './settle-core.mjs';

export const SEED_BODY_MAX_BYTES = 2048;
export const SEED_LIMITS = Object.freeze({ wallet: 60, ip: 600, windowSeconds: 3600 });
export const SESSION_HANDLE_PATTERN = /^game-session-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// A11: format-checked, not allowlisted.
export const BUILD_HASH_PATTERNS = Object.freeze({
  'lester-blaster': /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+$/,
  chikun: /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+:cabinet-\d+\.\d+\.\d+$/,
  stacked: /^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+:cabinet-\d+\.\d+\.\d+$/,
});
const BODY_KEYS = ['buildHash', 'gameId', 'seasonId', 'sessionId'];

const NO_STORE = Object.freeze({ 'Cache-Control': 'no-store' });
const json = (status, body) => ({ status, body, headers: { ...NO_STORE } });
const fail = (status, error, extra = {}) => json(status, { ok: false, error, ...extra });

export function validateSeedBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Object.keys(body).sort().join(',') !== BODY_KEYS.join(',')) return false;
  const { gameId, sessionId, seasonId, buildHash } = body;
  if (![gameId, sessionId, seasonId, buildHash].every((value) => typeof value === 'string')) return false;
  if (!Object.hasOwn(INDEX_GAMES, gameId)) return false;
  if (seasonId !== INDEX_GAMES[gameId].seasonId) return false;
  if (!SESSION_HANDLE_PATTERN.test(sessionId)) return false;
  return BUILD_HASH_PATTERNS[gameId].test(buildHash);
}

async function limitedBy(db, bucket, limit, nowMs) {
  const hit = await hitRateLimit(db, { bucket, limit, windowSeconds: SEED_LIMITS.windowSeconds, nowMs });
  return hit.ok ? null : rateLimitedResult(hit.retryAfterSeconds);
}

export async function seedRequest({ headers = {}, body = null, ip = 'unknown' } = {}, deps) {
  const auth = authenticateBearer(headers, deps);
  if (!auth.ok) return auth.status === 503 ? fail(503, 'settlement-not-configured', { detail: [...(deps?.config?.missing ?? [])].join(',').slice(0, 240) }) : fail(401, 'invalid-session');
  const gate = settlementGate(deps);
  if (gate) return gate;
  const issueSeedTicket = typeof deps.issueSeedTicket === 'function' ? deps.issueSeedTicket : null;
  if (!issueSeedTicket) return fail(503, 'settlement-not-configured', { detail: 'seed-ticket-unavailable' });
  if (!validateSeedBody(body)) return fail(400, 'invalid-body');
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
  return json(200, { ok: true, seedTicket: issued.seedTicket, seed: issued.seed });
}

// The verify slice's issueSeedTicket, resolved at request time; null until
// server/verify/seed-ticket.mjs exists.
export async function loadIssueSeedTicket() {
  try {
    const module = await import('../verify/seed-ticket.mjs');
    return typeof module.issueSeedTicket === 'function' ? module.issueSeedTicket : null;
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') logSafeError('ranked-seed:import', error);
    return null;
  }
}
