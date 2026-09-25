// GET /api/jackpot (design §C.5): the Chikun Weekly Jackpot for the UI.
//
// Public and CDN-cached (public, s-maxage=30, stale-while-revalidate=120), so
// an answer can be up to about 150 s old; the client corrects its clock from
// serverTime and the Age header (design §D.2). Only `game` (chikun, the
// default) and `history` (0-26, default 8) are accepted; anything else is 400
// invalid-query, so varying queries cannot bust the cache.
//
// Neon only: the jackpot mirrors (amounts only from indexed events, rules
// from jackpot_rules) and the provisional open-week leader. No RPC call.
// { ok:true, live:false, game:'chikun' } while the jackpot is unconfigured or
// undeployed, or JACKPOT_UI_HIDDEN=true (an emergency hide without a client
// release: every surface disappears once the CDN copy expires). It needs the
// contract address (matching LITVM_JACKPOT), never the keeper key: reads
// continue while the keeper is stopped (config.jackpot.readable).
//
// Test seam: buildDeps accepts jackpotDeployment next to the A30 overrides.

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { DEFAULT_HISTORY, JACKPOT_CACHE_CONTROL, JACKPOT_QUERY, MAX_HISTORY, jackpotApiBody } from '../server/jackpot/api-model.mjs';

const cache = {};
const cached = (status, body) => ({ status, body, headers: { 'Cache-Control': JACKPOT_CACHE_CONTROL } });
const fail = (status, error) => ({ status, body: { ok: false, error }, headers: { 'Cache-Control': 'no-store' } });

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

function historyCount(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_HISTORY;
  if (!/^[0-9]{1,2}$/.test(String(value))) return null;
  const count = Number(value);
  return count <= MAX_HISTORY ? count : null;
}

export async function jackpotRequest({ query = {} } = {}, deps) {
  const game = query.game === undefined || query.game === '' ? 'chikun' : String(query.game);
  const history = historyCount(query.history);
  if (game !== 'chikun' || history === null) return fail(400, 'invalid-query');
  const jackpot = deps.config.jackpot;
  if (jackpot.uiHidden || !jackpot.readable) return cached(200, { ok: true, live: false, game: 'chikun' });
  if (!deps.db) return fail(503, 'index-not-configured');
  await ensureSchema(deps.db);
  const body = await jackpotApiBody(deps.db, { config: deps.config, deployment: deps.deployment, nowMs: deps.nowMs(), history, chainId: deps.config.chainId });
  return cached(200, body);
}

const adapter = makeHandler({ label: 'jackpot', methods: ['GET'], query: JACKPOT_QUERY, run: jackpotRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
