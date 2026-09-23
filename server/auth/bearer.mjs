// Bearer authentication for the settle endpoints (E3, E15; E4's optional
// owner view) on top of index's server/http.mjs seam (contract A13, A30).
//
// A v2 session token is valid only for this deployment's audience
// ('lestersarcade:' + (VERCEL_ENV ?? 'production')). The adapter runs the
// check BEFORE the body is read, so a request without a valid token never
// makes the function parse (or even look at) its body.

import { sessionAudience, verifyBearer } from '../http.mjs';

export { sessionAudience };

const noStore = { 'Cache-Control': 'no-store' };

// → { ok:true, wallet, expiresAt } | { ok:false, status, error }
// Without SESSION_SECRET no token can verify, so the endpoint is not
// configured (503) rather than the caller unauthenticated.
export function authenticateBearer(headers, deps, { notConfigured = 'settlement-not-configured' } = {}) {
  if (!deps?.config?.session?.configured) return { ok: false, status: 503, error: notConfigured };
  const session = verifyBearer(headers ?? {}, deps);
  if (!session) return { ok: false, status: 401, error: 'invalid-session' };
  return { ok: true, wallet: session.wallet, expiresAt: session.expiresAt };
}

// The token's wallet when the request carries a valid token, else null.
// Never throws; used where a token is optional (E4's owner view).
export function optionalBearerWallet(headers, deps) {
  if (!deps?.config?.session?.configured) return null;
  return verifyBearer(headers ?? {}, deps)?.wallet ?? null;
}

// makeHandler auth hook (server/http.mjs): null when the token is good, else
// the error result, sent without reading the body.
export function bearerAuthHook(options = {}) {
  return async function requireBearer(request, deps) {
    const auth = authenticateBearer(request?.headers, deps, options);
    if (auth.ok) return null;
    const body = { ok: false, error: auth.error };
    if (auth.status === 503 && Array.isArray(deps?.config?.missing) && deps.config.missing.length) body.detail = deps.config.missing.join(',').slice(0, 240);
    return { status: auth.status, body, headers: noStore };
  };
}
