// E2 POST /api/session (contract §4.3.2, A13, A30, A34).
//
// The browser posts the SIWE challenge its wallet signed, built on a server
// nonce from E1. Checks, in this order:
//   1. verifySiweLogin (allowed domain, freshness, exact message, signature);
//   2. chainId === 4441, else wrong-chain;
//   3. the nonce format and MAC, else nonce-invalid;
//   4. the nonce has not expired, else nonce-expired;
//   5. the nonce is consumed through auth_nonces, else nonce-used.
// Then it returns a v2 session token for this deployment's audience.
//
// Allowed domains: SESSION_ALLOWED_DOMAINS, else lestersarcade.io and www,
// plus localhost and 127.0.0.1 only when VERCEL_ENV is set and not
// production (an absent VERCEL_ENV is production; server/config.mjs).
// Rate limits: session:ip:<ipBucket> 300/h, and session:w:<wallet> 30/h
// counted once the signature verifies.

import { ethers } from 'ethers';
import { ipBucket, makeHandler, sessionAudience } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { checkSiweNonce, consumeSiweNonce } from '../server/auth/siwe-nonce.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { hitRateLimit, rateLimitedResult } from '../server/neon/rate-limit.mjs';
import { issueSessionToken, verifySiweLogin } from '../apps/portal/src/server-session.mjs';

export const SESSION_BODY_MAX_BYTES = 16 * 1024;
// §4.3.2 step 2: logins are for LitVM LiteForge only. A literal, not
// config.chainId: LITVM_CHAIN_ID is a test and rehearsal override (§9.2) and
// must never change which chain a production login is accepted for.
export const SESSION_CHAIN_ID = 4441;
export const SESSION_LIMITS = Object.freeze({ ip: 300, wallet: 30, windowSeconds: 3600 });

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const json = (status, body) => ({ status, body, headers: { 'Cache-Control': 'no-store' } });
const unauthorized = (error) => json(401, { ok: false, error });

async function limited(db, bucket, limit, nowMs) {
  const hit = await hitRateLimit(db, { bucket, limit, windowSeconds: SESSION_LIMITS.windowSeconds, nowMs });
  return hit.ok ? null : rateLimitedResult(hit.retryAfterSeconds);
}

export async function sessionRequest({ body = null, ip = 'unknown' } = {}, deps) {
  const config = deps?.config;
  if (!config?.session?.configured || !deps.db) return json(503, { ok: false, error: 'session-not-configured' });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, error: 'invalid-body' });
  const secret = config.session.secret();
  await ensureSchema(deps.db);
  const nowMs = deps.nowMs();

  const ipLimited = await limited(deps.db, `session:ip:${ipBucket(ip, secret)}`, SESSION_LIMITS.ip, nowMs);
  if (ipLimited) return ipLimited;

  // Steps 1 and 2.
  const login = verifySiweLogin(ethers, {
    challenge: body.challenge,
    signature: body.signature,
    allowedDomains: [...config.session.allowedDomains],
    nowMs,
    expectedChainId: SESSION_CHAIN_ID,
  });
  if (!login.ok) return unauthorized(login.error);

  const walletLimited = await limited(deps.db, `session:w:${login.wallet}`, SESSION_LIMITS.wallet, nowMs);
  if (walletLimited) return walletLimited;

  // Steps 3 to 5.
  const nonce = body.challenge.nonce;
  const checked = checkSiweNonce(nonce, { secret, nowMs });
  if (!checked.ok) return unauthorized(checked.error);
  const consumed = await consumeSiweNonce(deps.db, { nonce, wallet: login.wallet, expiresAt: checked.expiresAtMs });
  if (!consumed) return unauthorized('nonce-used');

  const session = issueSessionToken(deps.crypto, { secret, wallet: login.wallet, nowMs, audience: sessionAudience(config) });
  return json(200, { ok: true, wallet: login.wallet, token: session.token, expiresAt: session.expiresAt });
}

const adapter = makeHandler({ label: 'session', methods: ['POST'], query: [], maxBytes: SESSION_BODY_MAX_BYTES, run: sessionRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
