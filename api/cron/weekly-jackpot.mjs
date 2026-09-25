// GET /api/cron/weekly-jackpot (Vercel Cron, every 5 minutes; design §C.4,
// contract A24, A30).
//
// The handler seam of api/cron/settle-retry.mjs. Gate order (design §C.4):
//   1. Authorization: Bearer ${CRON_SECRET}            → else 401
//   2. a database                                      → else 503 index-not-configured
//   3. config.jackpot.ready (keeper key, contract address matching the
//      statically imported LITVM_JACKPOT, a deployed module)
//                                                       → else 200 { ok:true, skipped:'jackpot-not-configured' }
//      (an undeployed jackpot is not a failure; the run is a no-op)
//   4. JACKPOT_PAUSED                                   → 200 { ok:true, skipped:'jackpot-paused' }
//   5. ensureSchema(db), then server/jackpot/cron.mjs runJackpot(deps)
// Every authorized run's outcome is recorded in cron_runs as 'weekly-jackpot'
// (withCronRun), so /api/health and the owner status page see it; a skipped
// run is a success there, and health reports the pause itself.
//
// Deps: attachSettleDeps(base, { env, relayer: false }) gives deps.verify
// (the re-replay) and deps.chain without ever creating the settle relayer.
// The keeper wallet comes from config.jackpot.keeper.createWallet, and only
// when a send is due.
//
// Test seams (J2 → J3, never read from env): buildDeps overrides
// jackpotDeployment (to the config), jackpotSelect, keeperFault and
// fundingLookup, next to db, provider, deployment, nowMs, fetchImpl, crypto.

import { makeHandler } from '../../server/http.mjs';
import { buildBaseDeps } from '../../server/config.mjs';
import { attachLazyProvider } from '../../server/chain/public-rpc.mjs';
import { ensureSchema } from '../../server/neon/migrations.mjs';
import { CRON_NAMES, withCronRun } from '../../server/ops/cron-runs.mjs';
import { attachSettleDeps } from '../../server/settle/settle-core.mjs';
import { runJackpot } from '../../server/jackpot/cron.mjs';

const cache = {};
const json = (status, body) => ({ status, body, headers: { 'Cache-Control': 'no-store' } });

export const WEEKLY_JACKPOT_OVERRIDES = Object.freeze(['db', 'provider', 'deployment', 'nowMs', 'fetchImpl', 'crypto', 'jackpotDeployment', 'jackpotSelect', 'keeperFault', 'fundingLookup']);

export async function buildDeps(env = process.env, overrides = {}) {
  const base = attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
  const deps = await attachSettleDeps(base, { env, relayer: false });
  deps.jackpotDeployment = deps.config.jackpot.deployment;
  if (typeof overrides.jackpotSelect === 'function') deps.jackpotSelect = overrides.jackpotSelect;
  if (typeof overrides.keeperFault === 'function') deps.keeperFault = overrides.keeperFault;
  if (Object.hasOwn(overrides, 'fundingLookup')) deps.fundingLookup = overrides.fundingLookup;
  return deps;
}

export async function weeklyJackpotRequest({ headers = {} } = {}, deps) {
  if (!deps?.config?.cron?.matches(headers.authorization)) return json(401, { ok: false, error: 'unauthorized' });
  return withCronRun(CRON_NAMES.weeklyJackpot, deps, async () => {
    if (!deps.db) return json(503, { ok: false, error: 'index-not-configured' });
    if (!deps.config.jackpot.ready) return json(200, { ok: true, skipped: 'jackpot-not-configured' });
    if (deps.config.jackpot.paused) return json(200, { ok: true, skipped: 'jackpot-paused' });
    await ensureSchema(deps.db);
    return runJackpot(deps);
  });
}

const adapter = makeHandler({ label: 'cron/weekly-jackpot', methods: ['GET'], query: [], run: weeklyJackpotRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
