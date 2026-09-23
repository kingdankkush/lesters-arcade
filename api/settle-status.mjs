// E4 GET /api/settle/status?sessionId32=0x… (or ?id=<shareId>) → /api/settle-status
// (contract §4.3.4, §4.4, A30).
//
// The owner view for a Bearer token of the row's wallet, the public view
// otherwise: every session key is public in RankedSessionOpened events, so
// the public view never shows an unpublished run's wallet, score or stats,
// and never lastError or attempts. Read-only apart from a throttled receipt
// check of a submitted row (at most every 3 s). Rate limit status:ip 1,200/h.

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { attachLazyProvider } from '../server/chain/public-rpc.mjs';
import { loadAchievementRegistry, settleStatusRequest } from '../server/settle/settle-core.mjs';

export { settleStatusRequest };

export const SETTLE_STATUS_QUERY = Object.freeze(['sessionId32', 'id']);

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  const deps = attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
  deps.catalog = await loadAchievementRegistry();
  return deps;
}

const adapter = makeHandler({ label: 'settle-status', methods: ['GET'], query: SETTLE_STATUS_QUERY, run: settleStatusRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
