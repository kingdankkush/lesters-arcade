// GET /api/jackpot/replay?session=0x… → /api/jackpot-replay (design §C.5).
//
// The replay of a jackpot candidate as a Chikun replay file
// ({ format: 'chikun-replay-file-v1', game: 'chikun', evidence }), which
// importChikunReplay (apps/chikun/src/replay-file.mjs) imports as is. Only
// for sessions that are candidates of a week that has closed; anything else
// is 404 not-available (cached briefly, so a replay appears soon after its
// week closes). Neon only. Only `session` is accepted.
// Cache: public, s-maxage=3600, stale-while-revalidate=86400 (a closed
// week's evidence never changes).

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { normalizeSessionId32 } from '../server/neon/rows.mjs';
import { jackpotInstances } from '../server/jackpot/indexer.mjs';
import { REPLAY_CACHE_CONTROL, REPLAY_MISSING_CACHE_CONTROL, REPLAY_QUERY, jackpotReplayBody } from '../server/jackpot/api-model.mjs';

const cache = {};
const missing = () => ({ status: 404, body: { ok: false, error: 'not-available' }, headers: { 'Cache-Control': REPLAY_MISSING_CACHE_CONTROL } });

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

export async function jackpotReplayRequest({ query = {} } = {}, deps) {
  const sessionId32 = normalizeSessionId32(query.session);
  if (!sessionId32) return missing();
  const jackpot = deps.config.jackpot;
  if (jackpot.uiHidden || !jackpot.ready || !deps.db) return missing();
  await ensureSchema(deps.db);
  const contracts = jackpotInstances(jackpot.deployment).map((instance) => instance.contract);
  const body = await jackpotReplayBody(deps.db, { sessionId32, nowMs: deps.nowMs(), contracts });
  if (!body) return missing();
  return { status: 200, body, headers: { 'Cache-Control': REPLAY_CACHE_CONTROL } };
}

const adapter = makeHandler({ label: 'jackpot-replay', methods: ['GET'], query: REPLAY_QUERY, run: jackpotReplayRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
