// E12 GET /api/cron/index-chain (contract §4.3.10, A24, A34).
//
// Vercel Cron calls this every 5 minutes with Authorization: Bearer
// ${CRON_SECRET}. It runs migrate(db) first (the runbook's production
// migration step, §13 step 8b) and reports the schema version, then mirrors
// ScoreSubmitted, AchievementUnlocked and profile events into Neon. On a
// deployed deployment it needs RANKED_SCORE_REGISTRY_ADDRESS equal to the
// deployment's score registry (§9.2), else 503. Every authorized run's
// outcome is recorded in cron_runs for /api/health (ops-health).

import { makeHandler } from '../../server/http.mjs';
import { buildBaseDeps } from '../../server/config.mjs';
import { attachLazyProvider } from '../../server/chain/public-rpc.mjs';
import { indexChain } from '../../server/indexer/index-chain.mjs';
import { migrate } from '../../server/neon/migrations.mjs';
import { CRON_NAMES, withCronRun } from '../../server/ops/cron-runs.mjs';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return attachLazyProvider(await buildBaseDeps(env, overrides, cache), overrides, cache);
}

const json = (status, body) => ({ status, body, headers: { 'Cache-Control': 'no-store' } });

export async function indexChainRequest({ headers = {} } = {}, deps) {
  if (!deps.config.cron.matches(headers.authorization)) return json(401, { ok: false, error: 'unauthorized' });
  if (!deps.db) return json(503, { ok: false, error: 'index-not-configured' });
  return withCronRun(CRON_NAMES.indexChain, deps, () => indexChainRun(deps));
}

async function indexChainRun(deps) {
  const migration = await migrate(deps.db);
  const schema = { schemaVersion: migration.version, appliedMigrations: migration.applied };
  if (deps.deployment?.status !== 'deployed') return json(200, { ok: true, skipped: 'not-deployed', ...schema });
  // §9.2: E12 is a user of RANKED_SCORE_REGISTRY_ADDRESS. Settle writes to
  // that address and the indexer confirms rows from the deployment's registry,
  // so a missing or different value would leave every row unconfirmed. The
  // migration above still runs (runbook step 8b).
  const registry = deps.config.scoreRegistry;
  if (!registry.configured) return json(503, { ok: false, error: 'settlement-not-configured', detail: 'RANKED_SCORE_REGISTRY_ADDRESS', ...schema });
  if (!registry.matchesDeployment) return json(503, { ok: false, error: 'address-mismatch', detail: 'RANKED_SCORE_REGISTRY_ADDRESS differs from LITVM_DEPLOYMENT', ...schema });
  const provider = deps.provider;
  let result;
  try {
    result = await indexChain({
      db: deps.db,
      deployment: deps.deployment,
      getLogs: (filter) => provider.getLogs(filter),
      getBlock: (tag) => provider.getBlock(tag),
      call: (tx) => provider.call(tx),
      nowMs: deps.nowMs,
      startBlock: deps.config.indexStartBlock,
    });
  } catch (error) {
    if (error?.chainIo) return json(502, { ok: false, error: 'chain-read-failed', retryable: true, ...schema });
    throw error;
  }
  return json(200, {
    ok: true,
    ...schema,
    fromBlock: result.fromBlock,
    toBlock: result.toBlock,
    scores: result.scores,
    achievements: result.achievements,
    profiles: result.profiles,
    skipped: result.skipped,
    mismatches: result.mismatches,
    failed: result.failed,
    lagBlocks: result.lagBlocks,
  });
}

const adapter = makeHandler({ label: 'cron/index-chain', methods: ['GET'], query: [], run: indexChainRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
