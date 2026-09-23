// E1 GET /api/session/nonce → /api/session-nonce (contract §4.3.1, A13, A30, A34).
//
// Issues a server nonce for the SIWE login: 72 lowercase hex characters,
// HMAC-signed with SESSION_SECRET, valid for 10 minutes and spendable once
// (E2 inserts it into auth_nonces). The browser also takes issuedAt from this
// response, so a skewed client clock cannot make its own login stale.
//
// Needs SESSION_SECRET and NEON_DATABASE_URL, else 503 session-not-configured.
// Rate limit: nonce:ip:<ipBucket>, 300 per hour (shared mobile and event IPs, D9).

import { ipBucket, makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { issueSiweNonce } from '../server/auth/siwe-nonce.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { hitRateLimit, rateLimitedResult } from '../server/neon/rate-limit.mjs';

export const NONCE_LIMITS = Object.freeze({ ip: 300, windowSeconds: 3600 });

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const json = (status, body) => ({ status, body, headers: { 'Cache-Control': 'no-store' } });

export async function sessionNonceRequest({ ip = 'unknown' } = {}, deps) {
  const config = deps?.config;
  if (!config?.session?.configured || !deps.db) return json(503, { ok: false, error: 'session-not-configured' });
  const secret = config.session.secret();
  await ensureSchema(deps.db);
  const nowMs = deps.nowMs();
  const limit = await hitRateLimit(deps.db, { bucket: `nonce:ip:${ipBucket(ip, secret)}`, limit: NONCE_LIMITS.ip, windowSeconds: NONCE_LIMITS.windowSeconds, nowMs });
  if (!limit.ok) return rateLimitedResult(limit.retryAfterSeconds);
  const issued = issueSiweNonce({ secret, nowMs, randomBytes: (size) => deps.crypto.randomBytes(size) });
  return json(200, { ok: true, nonce: issued.nonce, issuedAt: issued.issuedAt, expiresAt: issued.expiresAt });
}

const adapter = makeHandler({ label: 'session-nonce', methods: ['GET'], query: [], run: sessionNonceRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
