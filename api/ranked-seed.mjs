// E15 POST /api/ranked/seed → /api/ranked-seed (contract §4.3.13, §2.7, A25, A30).
//
// Issues the seed ticket of a live Ranked session to a signed-in wallet
// (Bearer checked before the body is read; body at most 2 KB). Needs
// SESSION_SECRET, NEON_DATABASE_URL and settlementReady; SETTLEMENT_PAUSED
// answers 503 settlement-paused. Because the browser cannot compute a live
// session key without a ticket, both 503s stop players before they pay.
// Rate limits: seed:w 60/h and seed:ip 600/h.

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { bearerAuthHook } from '../server/auth/bearer.mjs';
import { loadIssueSeedTicket, SEED_BODY_MAX_BYTES, seedRequest } from '../server/settle/seed.mjs';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  const deps = await buildBaseDeps(env, overrides, cache);
  deps.issueSeedTicket = await loadIssueSeedTicket();
  return deps;
}

export async function rankedSeedRequest(request = {}, deps) {
  return seedRequest(request, deps);
}

const adapter = makeHandler({
  label: 'ranked-seed',
  methods: ['POST'],
  query: [],
  maxBytes: SEED_BODY_MAX_BYTES,
  auth: bearerAuthHook(),
  run: rankedSeedRequest,
});

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
