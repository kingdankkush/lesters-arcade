// GET /api/health (ops-health): one public place to see whether Ranked is
// healthy.
//
// Public JSON with only aggregate, non-secret facts (server/ops/health.mjs):
// ok (the envelope flag), healthy (the one boolean for an uptime monitor),
// version, settlementReady (a boolean only), paused, the relayer's public
// address, balance, allowance and estimated settles left, the settle queue by
// status, the chain index lag, each cron's last outcome and the base fee.
// Chain and database reads each have a short deadline; a failed part is null
// with degraded: true and healthy: false, never a 500. Cached at the edge for
// 30 s plus up to 60 s stale-while-revalidate, and any query parameter is
// rejected (400 invalid-query), so the endpoint cannot be used to bypass the
// cache and load Neon or the RPC.

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { attachLazyProvider } from '../server/chain/public-rpc.mjs';
import { collectHealth, HEALTH_CACHE_CONTROL } from '../server/ops/health.mjs';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
}

export async function healthRequest(_request, deps) {
  return { status: 200, body: await collectHealth(deps), headers: { 'Cache-Control': HEALTH_CACHE_CONTROL } };
}

const adapter = makeHandler({ label: 'health', methods: ['GET'], query: [], run: healthRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
