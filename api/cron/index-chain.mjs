// E12 GET /api/cron/index-chain (contract §4.3.10, A24, A34).
//
// Vercel Cron calls this every 5 minutes with Authorization: Bearer
// ${CRON_SECRET}. It runs migrate(db) first (the runbook's production
// migration step, §13 step 8b) and reports the schema version, then mirrors
// ScoreSubmitted, AchievementUnlocked and profile events into Neon.

import { makeHandler } from '../../server/http.mjs';
import { buildBaseDeps } from '../../server/config.mjs';
import { createPublicProvider } from '../../server/chain/public-rpc.mjs';
import { indexChain } from '../../server/indexer/index-chain.mjs';
import { migrate } from '../../server/neon/migrations.mjs';

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  const deps = await buildBaseDeps(env, overrides, cache);
  let provider = overrides.provider ?? null;
  Object.defineProperty(deps, 'provider', {
    enumerable: true,
    get() {
      if (!provider) {
        if (!cache.provider || cache.rpcUrl !== deps.config.rpcUrl) {
          cache.provider = createPublicProvider({ rpcUrl: deps.config.rpcUrl, chainId: deps.config.chainId });
          cache.rpcUrl = deps.config.rpcUrl;
        }
        provider = cache.provider;
      }
      return provider;
    },
  });
  return deps;
}

const json = (status, body) => ({ status, body, headers: { 'Cache-Control': 'no-store' } });

export async function indexChainRequest({ headers = {} } = {}, deps) {
  if (!deps.config.cron.matches(headers.authorization)) return json(401, { ok: false, error: 'unauthorized' });
  if (!deps.db) return json(503, { ok: false, error: 'index-not-configured' });
  const migration = await migrate(deps.db);
  const schema = { schemaVersion: migration.version, appliedMigrations: migration.applied };
  if (deps.deployment?.status !== 'deployed') return json(200, { ok: true, skipped: 'not-deployed', ...schema });
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
