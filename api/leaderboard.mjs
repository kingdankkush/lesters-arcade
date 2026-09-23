// E5 GET /api/leaderboard (contract §4.3.5, D1, D2, A29).
//
// Public and CDN-cached. Every declared parameter is validated and any other
// parameter is rejected, so cache-busting reads never reach Neon.

import { makeHandler } from '../server/http.mjs';
import { buildBaseDeps } from '../server/config.mjs';
import { ensureSchema } from '../server/neon/migrations.mjs';
import { currentPeriodKey, INDEX_PERIODS, isValidPeriodKey, periodKeyResetAt } from '../server/neon/period-keys.mjs';
import { LEADERBOARD_PAGE_SIZE, readLeaderboard } from '../server/neon/queries.mjs';
import { INDEX_GAMES, resolveGameId } from '../server/neon/rows.mjs';

export const LEADERBOARD_QUERY = Object.freeze(['game', 'period', 'periodKey', 'page', 'q', 'wallet']);
export const LEADERBOARD_CACHE = 'public, s-maxage=15, stale-while-revalidate=60';
export const MAX_LEADERBOARD_PAGE = 400;
export const MAX_SEARCH_LENGTH = 32;

const cache = {};

export async function buildDeps(env = process.env, overrides = {}) {
  return buildBaseDeps(env, overrides, cache);
}

const fail = (status, error) => ({ status, body: { ok: false, error }, headers: { 'Cache-Control': 'no-store' } });

function present(value) {
  return value !== undefined && value !== null && value !== '';
}

export async function leaderboardRequest({ query = {} } = {}, deps) {
  const gameId = resolveGameId(query.game);
  if (!gameId) return fail(400, 'invalid-game');
  const period = present(query.period) ? String(query.period) : 'weekly';
  if (!INDEX_PERIODS.includes(period)) return fail(400, 'invalid-period');
  let periodKey;
  if (present(query.periodKey)) {
    if (!isValidPeriodKey(period, String(query.periodKey))) return fail(400, 'invalid-period-key');
    periodKey = String(query.periodKey);
  } else {
    periodKey = currentPeriodKey(period, deps.nowMs());
  }
  let page = 1;
  if (present(query.page)) {
    const text = String(query.page);
    page = /^[0-9]{1,3}$/.test(text) ? Number(text) : 0;
    if (page < 1 || page > MAX_LEADERBOARD_PAGE) return fail(400, 'invalid-page');
  }
  const q = present(query.q) ? String(query.q).trim() : '';
  if (q.length > MAX_SEARCH_LENGTH) return fail(400, 'invalid-query');
  let wallet = null;
  if (present(query.wallet)) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(query.wallet))) return fail(400, 'invalid-wallet');
    wallet = String(query.wallet).toLowerCase();
  }
  if (!deps.db) return fail(503, 'index-not-configured');
  await ensureSchema(deps.db);
  const seasonId = INDEX_GAMES[gameId].seasonId;
  const board = await readLeaderboard(deps.db, { gameId, seasonId, period, periodKey, page, pageSize: LEADERBOARD_PAGE_SIZE, q: q || null, wallet });
  return {
    status: 200,
    body: {
      ok: true,
      gameId,
      seasonId,
      period,
      periodKey,
      resetsAt: periodKeyResetAt(period, periodKey),
      page,
      pageSize: LEADERBOARD_PAGE_SIZE,
      total: board.total,
      rows: board.rows,
      you: board.you,
    },
    headers: { 'Cache-Control': LEADERBOARD_CACHE },
  };
}

const adapter = makeHandler({ label: 'leaderboard', methods: ['GET'], query: LEADERBOARD_QUERY, run: leaderboardRequest });

export function createHandler(depsFactory) {
  return adapter(depsFactory);
}

export default createHandler(() => buildDeps());
