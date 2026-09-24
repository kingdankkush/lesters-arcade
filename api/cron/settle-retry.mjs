// E13 GET /api/cron/settle-retry (Vercel Cron, every minute; contract §4.3.11, A24, A30).
//
// Needs Authorization: Bearer ${CRON_SECRET} (both sides SHA-256 hashed and
// compared with timingSafeEqual; a missing secret or a mismatch is 401).
// SETTLEMENT_PAUSED answers 503 settlement-paused with no row touched. The
// drain itself (priority order, budget, classification, stale dead letters)
// is server/settle/retry.mjs. Every authorized run's outcome, except a
// paused one (A27: nothing is touched), is recorded in cron_runs for
// /api/health (ops-health).

import { makeHandler } from '../../server/http.mjs';
import { buildBaseDeps } from '../../server/config.mjs';
import { attachLazyProvider } from '../../server/chain/public-rpc.mjs';
import { CRON_NAMES, withCronRun } from '../../server/ops/cron-runs.mjs';
import { attachSettleDeps } from '../../server/settle/settle-core.mjs';
import { runSettleRetry } from '../../server/settle/retry.mjs';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  const base = attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
  return attachSettleDeps(base, { env });
}

export async function settleRetryRequest({ headers = {} } = {}, deps) {
  if (!deps?.config?.cron?.matches(headers.authorization)) return { status: 401, body: { ok: false, error: 'unauthorized' }, headers: { 'Cache-Control': 'no-store' } };
  return withCronRun(CRON_NAMES.settleRetry, deps, () => runSettleRetry(deps));
}

const adapter = makeHandler({ label: 'cron/settle-retry', methods: ['GET'], query: [], run: settleRetryRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
