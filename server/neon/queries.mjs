// Read and write queries of the verified-session index (contract §4.3.5-§4.3.8,
// §6.5, A15, A29, D1).
//
// Driver independence (A15): every SELECT returns only text, int4 or boolean
// columns (JSON as ::text, bigints as ::text, timestamps through to_char in
// UTC), and every parameter is a string or null. Each call is one statement,
// because the Neon HTTP endpoint runs one statement per request.

import { canonicalSessionJson, sha256Hex } from '../../apps/portal/src/session-integrity.mjs';
import { periodKeysFor } from './period-keys.mjs';
import {
  ALL_NUMERIC_HEADLINE_KEYS, INDEX_GAMES, INDEX_GAME_IDS, NUMERIC_HEADLINE_KEYS,
  explorerUrlFor, leaderboardRow, numberOrNull, parseJsonText, publicDisplay, recentSessionRow,
  shareIdFor, verificationFor, walletShort,
} from './rows.mjs';

export const LEADERBOARD_PAGE_SIZE = 25;
export const RECENT_SESSION_LIMIT = 20;
export const HISTORY_PATH = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)?$/;
const WALLET = /^0x[0-9a-f]{40}$/;
const SESSION_ID32 = /^0x[0-9a-f]{64}$/;
const STAT_KEY = /^[a-zA-Z][a-zA-Z0-9]*$/;

// ISO-8601 UTC with milliseconds, identical on Neon and PGlite.
export function isoSql(column) {
  return `to_char((${column}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

function requireWallet(wallet) {
  const text = String(wallet ?? '').toLowerCase();
  if (!WALLET.test(text)) throw new TypeError('wallet must be a lowercase address');
  return text;
}

function requireGame(gameId) {
  if (!INDEX_GAME_IDS.includes(gameId)) throw new TypeError(`unknown gameId ${gameId}`);
  return gameId;
}

// The NFT flag always comes from the current achievement catalog (A20, A32).
// The achievements slice lands the catalog in parallel, so the import is lazy
// and an unavailable catalog means "no NFT candidates".
let catalogModule = null;
export async function loadAchievementCatalog() {
  catalogModule ??= import('../../apps/portal/src/achievements/index.mjs').catch(() => null);
  return catalogModule;
}

async function nftIdSets(catalog) {
  const source = catalog === undefined ? await loadAchievementCatalog() : catalog;
  const sets = {};
  for (const gameId of INDEX_GAME_IDS) {
    let ids = [];
    try {
      ids = typeof source?.nftAchievementIds === 'function' ? source.nftAchievementIds(gameId) : [];
    } catch {
      ids = [];
    }
    sets[gameId] = new Set(Array.isArray(ids) ? ids : []);
  }
  return sets;
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// q matches a visible display name (substring, case-insensitive) or, with at
// least four hex characters, a wallet prefix (with or without 0x).
export function leaderboardSearch(q) {
  const text = String(q ?? '').trim();
  if (!text) return { namePattern: null, walletPrefix: null };
  const hex = /^(?:0x)?([0-9a-fA-F]{4,40})$/.exec(text);
  return {
    namePattern: `%${escapeLike(text.toLowerCase())}%`,
    walletPrefix: hex ? `0x${hex[1].toLowerCase()}%` : null,
  };
}

// E5 (D1): the best confirmed row per wallet for the game, season and period,
// never board_excluded wallets, ranked by score DESC, confirmed_at ASC,
// session_id32 ASC. Search filters the ranked list without re-ranking.
export async function readLeaderboard(db, { gameId, seasonId, period, periodKey, page = 1, pageSize = LEADERBOARD_PAGE_SIZE, q = null, wallet = null } = {}) {
  requireGame(gameId);
  if (!['weekly', 'monthly', 'daily', 'all-time'].includes(period)) throw new TypeError(`unknown period ${period}`);
  const size = Math.max(1, Math.min(100, Math.floor(Number(pageSize) || LEADERBOARD_PAGE_SIZE)));
  const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
  const { namePattern, walletPrefix } = leaderboardSearch(q);
  const you = wallet ? requireWallet(wallet) : null;
  const rows = await db.query(
    `WITH best AS (
       SELECT DISTINCT ON (vs.wallet) vs.wallet, vs.session_id32, vs.score, vs.stats, vs.tx_hash, vs.confirmed_at
       FROM verified_sessions vs
       WHERE vs.game_id = $1 AND vs.season_id = $2 AND vs.status = 'confirmed'
         AND (CASE $3::text WHEN 'weekly' THEN vs.week_key = $4 WHEN 'monthly' THEN vs.month_key = $4 WHEN 'daily' THEN vs.day_key = $4 ELSE true END)
         AND NOT EXISTS (SELECT 1 FROM wallet_profiles x WHERE x.wallet = vs.wallet AND x.board_excluded)
       ORDER BY vs.wallet, vs.score DESC, vs.confirmed_at ASC, vs.session_id32 ASC
     ), ranked AS (
       SELECT b.wallet, b.session_id32, b.score, b.stats, b.tx_hash, b.confirmed_at,
              (ROW_NUMBER() OVER (ORDER BY b.score DESC, b.confirmed_at ASC, b.session_id32 ASC))::int AS rank,
              wp.display_name, wp.avatar_uri, coalesce(wp.hidden, false) AS hidden
       FROM best b LEFT JOIN wallet_profiles wp ON wp.wallet = b.wallet
     ), matched AS (
       SELECT * FROM ranked
       WHERE ($5::text IS NULL AND $6::text IS NULL)
          OR ($5::text IS NOT NULL AND NOT hidden AND display_name IS NOT NULL AND lower(display_name) LIKE $5::text)
          OR ($6::text IS NOT NULL AND wallet LIKE $6::text)
     )
     SELECT
       (SELECT count(*)::int FROM matched) AS total,
       (SELECT coalesce(json_agg(json_build_object(
           'rank', p.rank, 'wallet', p.wallet, 'session_id32', p.session_id32, 'score', p.score::text,
           'stats', p.stats, 'tx_hash', p.tx_hash, 'confirmed_at', ${isoSql('p.confirmed_at')},
           'display_name', p.display_name, 'avatar_uri', p.avatar_uri, 'hidden', p.hidden) ORDER BY p.rank), '[]'::json)::text
        FROM (SELECT * FROM matched ORDER BY rank LIMIT $7::int OFFSET $8::int) p) AS rows,
       (SELECT json_build_object('rank', y.rank, 'score', y.score::text, 'session_id32', y.session_id32)::text
        FROM ranked y WHERE $9::text IS NOT NULL AND y.wallet = $9::text) AS you`,
    [gameId, String(seasonId), period, period === 'all-time' ? '' : String(periodKey ?? ''), namePattern, walletPrefix,
      String(size), String((pageNumber - 1) * size), you],
  );
  const row = rows[0] ?? {};
  const youRow = parseJsonText(row.you, null);
  return {
    total: Number(row.total ?? 0),
    rows: parseJsonText(row.rows, []).map((entry) => leaderboardRow(gameId, entry)),
    you: youRow ? { rank: Number(youRow.rank), score: Number(youRow.score), sessionId32: youRow.session_id32, shareId: shareIdFor(youRow.session_id32) } : null,
  };
}

// Ranks of one wallet in the weekly, monthly and all-time boards of several
// games, in one statement. Excluded wallets have no standing.
export async function readWalletStandings(db, { wallet, games, weekKey, monthKey, nowMs = Date.now() } = {}) {
  const who = requireWallet(wallet);
  const list = (games ?? []).map((game) => ({ gameId: requireGame(game.gameId), seasonId: String(game.seasonId ?? INDEX_GAMES[game.gameId].seasonId) }));
  const keys = periodKeysFor(nowMs);
  const rows = await db.query(
    `WITH wanted AS (
       SELECT g.game_id, g.season_id FROM jsonb_to_recordset($1::jsonb) AS g(game_id text, season_id text)
     ), base AS (
       SELECT vs.game_id, vs.wallet, vs.session_id32, vs.score, vs.confirmed_at, vs.week_key, vs.month_key
       FROM verified_sessions vs JOIN wanted w ON w.game_id = vs.game_id AND w.season_id = vs.season_id
       WHERE vs.status = 'confirmed'
         AND NOT EXISTS (SELECT 1 FROM wallet_profiles x WHERE x.wallet = vs.wallet AND x.board_excluded)
     ), scoped AS (
       SELECT 'weekly'::text AS period, base.* FROM base WHERE base.week_key = $2
       UNION ALL SELECT 'monthly'::text, base.* FROM base WHERE base.month_key = $3
       UNION ALL SELECT 'allTime'::text, base.* FROM base
     ), best AS (
       SELECT DISTINCT ON (period, game_id, wallet) period, game_id, wallet, session_id32, score, confirmed_at
       FROM scoped ORDER BY period, game_id, wallet, score DESC, confirmed_at ASC, session_id32 ASC
     ), ranked AS (
       SELECT period, game_id, wallet, session_id32, score,
              (ROW_NUMBER() OVER (PARTITION BY period, game_id ORDER BY score DESC, confirmed_at ASC, session_id32 ASC))::int AS rank
       FROM best
     )
     SELECT period, game_id, rank, score::text AS score, session_id32 FROM ranked WHERE wallet = $4`,
    [JSON.stringify(list.map((game) => ({ game_id: game.gameId, season_id: game.seasonId }))), String(weekKey ?? keys.week), String(monthKey ?? keys.month), who],
  );
  const out = {};
  for (const game of list) out[game.gameId] = { weekly: null, monthly: null, allTime: null };
  for (const row of rows) {
    if (!out[row.game_id]) continue;
    out[row.game_id][row.period] = { rank: Number(row.rank), score: Number(row.score), sessionId32: row.session_id32 };
  }
  return out;
}

export async function readWalletStanding(db, { gameId, seasonId, wallet, weekKey, monthKey, nowMs = Date.now() } = {}) {
  const standings = await readWalletStandings(db, { wallet, games: [{ gameId, seasonId }], weekKey, monthKey, nowMs });
  return standings[gameId];
}

function totalsSql() {
  return ALL_NUMERIC_HEADLINE_KEYS.map((key, index) => {
    if (!STAT_KEY.test(key)) throw new TypeError(`unsafe stats key ${key}`);
    return `coalesce(sum(CASE WHEN status = 'confirmed' AND jsonb_typeof(stats -> '${key}') = 'number' THEN (stats ->> '${key}')::numeric END), 0)::text AS t${index}`;
  }).join(',\n       ');
}

// E6 (§4.3.6). The public view shows only confirmed sessions; the self view
// adds every non-pending status with retry details, the preferences and the
// moderation reason. Run counts and totals span every season; the best score
// and ranks are for the game's current season (the boards' season).
export async function readPublicProfile(db, wallet, { self = false, nowMs = Date.now(), catalog } = {}) {
  const who = requireWallet(wallet);
  const keys = periodKeysFor(nowMs);
  const games = INDEX_GAME_IDS.map((gameId) => ({ gameId, seasonId: INDEX_GAMES[gameId].seasonId }));
  const [profileRows, aggregateRows, bestRows, standings, recentRows, achievementRows, nftSets] = await Promise.all([
    db.query(
      `SELECT display_name, avatar_uri, hidden, name_blocked, preferences::text AS preferences,
              ${isoSql('onchain_updated_at')} AS onchain_updated_at, ${isoSql('updated_at')} AS updated_at
       FROM wallet_profiles WHERE wallet = $1`,
      [who],
    ),
    db.query(
      `SELECT game_id,
              (count(*) FILTER (WHERE status <> 'pending'))::int AS ranked_runs,
              (count(*) FILTER (WHERE status = 'confirmed'))::int AS confirmed_runs,
              ${isoSql(`max(coalesce(opened_at, verified_at)) FILTER (WHERE status <> 'pending')`)} AS last_played_at,
       ${totalsSql()}
       FROM verified_sessions WHERE wallet = $1 GROUP BY game_id`,
      [who],
    ),
    db.query(
      `SELECT DISTINCT ON (vs.game_id) vs.game_id, vs.session_id32, vs.score::text AS score
       FROM verified_sessions vs JOIN jsonb_to_recordset($2::jsonb) AS g(game_id text, season_id text)
         ON g.game_id = vs.game_id AND g.season_id = vs.season_id
       WHERE vs.wallet = $1 AND vs.status = 'confirmed'
       ORDER BY vs.game_id, vs.score DESC, vs.confirmed_at ASC, vs.session_id32 ASC`,
      [who, JSON.stringify(games.map((game) => ({ game_id: game.gameId, season_id: game.seasonId })))],
    ),
    readWalletStandings(db, { wallet: who, games, weekKey: keys.week, monthKey: keys.month, nowMs }),
    db.query(
      `SELECT session_id32, game_id, score::text AS score, status, tx_hash, stats::text AS stats,
              ${isoSql('verified_at')} AS verified_at, ${isoSql('confirmed_at')} AS confirmed_at,
              last_error, ${isoSql('next_attempt_at')} AS next_attempt_at
       FROM verified_sessions
       WHERE wallet = $1 AND (CASE WHEN $2::text = 'true' THEN status <> 'pending' ELSE status = 'confirmed' END)
       ORDER BY verified_at DESC, session_id32 DESC
       LIMIT $3::int`,
      [who, self ? 'true' : 'false', String(RECENT_SESSION_LIMIT)],
    ),
    db.query(
      `SELECT game_id, achievement_id, tier, session_id32, ${isoSql('unlocked_at')} AS unlocked_at, token_id, mint_tx_hash
       FROM achievement_unlocks WHERE wallet = $1
       ORDER BY unlocked_at ASC, game_id ASC, achievement_id ASC`,
      [who],
    ),
    nftIdSets(catalog),
  ]);
  const profileRow = profileRows[0] ?? null;
  const display = publicDisplay({ hidden: profileRow?.hidden === true, displayName: profileRow?.display_name ?? null, avatarUri: profileRow?.avatar_uri ?? null });
  const profile = {
    displayName: display.displayName,
    avatarUri: display.avatarUri,
    hidden: display.hidden,
    onchainUpdatedAt: profileRow?.onchain_updated_at ?? null,
  };
  if (self) profile.nameBlocked = profileRow?.name_blocked ?? null;
  const aggregates = new Map(aggregateRows.map((row) => [row.game_id, row]));
  const bests = new Map(bestRows.map((row) => [row.game_id, row]));
  const gamesOut = {};
  for (const gameId of INDEX_GAME_IDS) {
    const aggregate = aggregates.get(gameId);
    const best = bests.get(gameId);
    const totals = {};
    for (const key of NUMERIC_HEADLINE_KEYS[gameId]) {
      const index = ALL_NUMERIC_HEADLINE_KEYS.indexOf(key);
      totals[key] = Number(aggregate?.[`t${index}`] ?? 0);
    }
    const standing = standings[gameId] ?? {};
    gamesOut[gameId] = {
      rankedRuns: Number(aggregate?.ranked_runs ?? 0),
      confirmedRuns: Number(aggregate?.confirmed_runs ?? 0),
      bestScore: best ? Number(best.score) : null,
      bestSessionId32: best?.session_id32 ?? null,
      ranks: { weekly: standing.weekly?.rank ?? null, monthly: standing.monthly?.rank ?? null, allTime: standing.allTime?.rank ?? null },
      totals,
      lastPlayedAt: aggregate?.last_played_at ?? null,
    };
  }
  return {
    ok: true,
    wallet: who,
    profile,
    games: gamesOut,
    recentSessions: recentRows.map((row) => recentSessionRow(row, { self })),
    achievements: achievementRows.map((row) => ({
      id: row.achievement_id,
      gameId: row.game_id,
      tier: row.tier,
      nft: nftSets[row.game_id]?.has(row.achievement_id) ?? false,
      sessionId32: row.session_id32,
      unlockedAt: row.unlocked_at,
      tokenId: row.token_id ?? null,
      mintTxHash: row.mint_tx_hash ?? null,
    })),
    preferences: self ? parseJsonText(profileRow?.preferences, {}) : null,
    updatedAt: profileRow?.updated_at ?? null,
  };
}

// §7.5: a new card image URL whenever anything visible on it changes.
export async function cardRevision({ status, displayName, avatarUri, hidden, verification }) {
  const digest = await sha256Hex(canonicalSessionJson({ status, displayName, avatarUri, hidden, verification }));
  return digest.slice(2, 14);
}

// E9 (§4.3.8). Pending rows are not public records and read as missing.
// client_claim and plausibility are never selected.
export async function readPublicSession(db, sessionId32, { catalog } = {}) {
  const id = String(sessionId32 ?? '').toLowerCase();
  if (!SESSION_ID32.test(id)) throw new TypeError('sessionId32 must be 0x + 64 lowercase hex');
  const rows = await db.query(
    `SELECT vs.session_id32, vs.wallet, vs.game_id, vs.season_id, vs.runtime_id, vs.score::text AS score,
            vs.kills::text AS kills, vs.max_combo::text AS max_combo, vs.survival_seconds::text AS survival_seconds,
            vs.boss_id, vs.stats::text AS stats, vs.status, vs.source, vs.tx_hash, vs.block_number::text AS block_number,
            ${isoSql('vs.verified_at')} AS verified_at, ${isoSql('vs.confirmed_at')} AS confirmed_at, vs.week_key, vs.month_key,
            wp.display_name, wp.avatar_uri, coalesce(wp.hidden, false) AS hidden, coalesce(wp.board_excluded, false) AS board_excluded
     FROM verified_sessions vs LEFT JOIN wallet_profiles wp ON wp.wallet = vs.wallet
     WHERE vs.session_id32 = $1 AND vs.status <> 'pending'`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const [achievementRows, nftSets] = await Promise.all([
    db.query(
      `SELECT achievement_id, tier, ${isoSql('unlocked_at')} AS unlocked_at, token_id
       FROM achievement_unlocks WHERE session_id32 = $1 ORDER BY unlocked_at ASC, achievement_id ASC`,
      [id],
    ),
    nftIdSets(catalog),
  ]);
  const standing = { weekly: null, monthly: null, allTime: null };
  if (row.status === 'confirmed' && row.board_excluded !== true) {
    const found = await readWalletStanding(db, { gameId: row.game_id, seasonId: row.season_id, wallet: row.wallet, weekKey: row.week_key, monthKey: row.month_key });
    for (const period of ['weekly', 'monthly', 'allTime']) {
      if (found?.[period]?.sessionId32 === id) standing[period] = found[period].rank;
    }
  }
  const display = publicDisplay({ hidden: row.hidden === true, displayName: row.display_name, avatarUri: row.avatar_uri });
  const verification = verificationFor(row.game_id, row.source);
  return {
    sessionId32: id,
    shareId: shareIdFor(id),
    gameId: row.game_id,
    gameTitle: INDEX_GAMES[row.game_id]?.title ?? row.game_id,
    wallet: row.wallet,
    walletShort: walletShort(row.wallet),
    displayName: display.displayName,
    avatarUri: display.avatarUri,
    score: Number(row.score),
    stats: parseJsonText(row.stats, {}),
    contract: {
      kills: Number(row.kills),
      maxCombo: Number(row.max_combo),
      survivalSeconds: Number(row.survival_seconds),
      bossId: row.boss_id ?? null,
    },
    status: row.status,
    txHash: row.tx_hash ?? null,
    blockNumber: numberOrNull(row.block_number),
    explorerUrl: explorerUrlFor(row.tx_hash),
    verifiedAt: row.verified_at ?? null,
    confirmedAt: row.confirmed_at ?? null,
    seasonId: row.season_id,
    runtimeId: row.runtime_id,
    achievements: achievementRows.map((entry) => ({
      id: entry.achievement_id,
      tier: entry.tier,
      nft: nftSets[row.game_id]?.has(entry.achievement_id) ?? false,
      unlockedAt: entry.unlocked_at,
      tokenId: entry.token_id ?? null,
    })),
    standing,
    verification,
    cardRev: await cardRevision({ status: row.status, displayName: display.displayName, avatarUri: display.avatarUri, hidden: display.hidden, verification }),
  };
}

function validatedPaths(paths, label) {
  const list = Array.isArray(paths) ? paths : [];
  for (const path of list) {
    if (typeof path !== 'string' || !HISTORY_PATH.test(path)) throw new TypeError(`unsafe history ${label} path`);
  }
  return [...new Set(list)];
}

function pathSql(path) {
  // Segments are [a-zA-Z0-9] only (HISTORY_PATH), so the literal is safe.
  const segments = path.split('.');
  return { json: `stats #> '{${segments.join(',')}}'`, text: `stats #>> '{${segments.join(',')}}'` };
}

// §6.5. The SQL is built only from validated stats paths (never user input):
// sums and maxima over the wallet's other sessions for the game (all
// statuses), and every achievement it has recorded for the game.
export async function readAchievementHistory(db, { wallet, gameId, fields = {}, excludeSessionId32 = null } = {}) {
  const who = requireWallet(wallet);
  requireGame(gameId);
  const sumPaths = validatedPaths(fields.sum, 'sum');
  const maxPaths = validatedPaths(fields.max, 'max');
  if (excludeSessionId32 !== null && excludeSessionId32 !== undefined && !SESSION_ID32.test(String(excludeSessionId32))) {
    throw new TypeError('excludeSessionId32 must be 0x + 64 lowercase hex');
  }
  const columns = [
    'count(*)::int AS runs',
    ...sumPaths.map((path, index) => {
      const sql = pathSql(path);
      return `coalesce(sum(CASE WHEN jsonb_typeof(${sql.json}) = 'number' THEN (${sql.text})::numeric END), 0)::text AS s${index}`;
    }),
    ...maxPaths.map((path, index) => {
      const sql = pathSql(path);
      return `coalesce(max(CASE WHEN jsonb_typeof(${sql.json}) = 'number' THEN (${sql.text})::numeric END), 0)::text AS m${index}`;
    }),
    `(SELECT coalesce(array_to_json(array_agg(u.achievement_id ORDER BY u.achievement_id)), '[]'::json)::text
      FROM achievement_unlocks u WHERE u.wallet = $1 AND u.game_id = $2) AS unlocked`,
  ];
  const rows = await db.query(
    `SELECT ${columns.join(',\n       ')}
     FROM verified_sessions
     WHERE wallet = $1 AND game_id = $2 AND ($3::text IS NULL OR session_id32 <> $3::text)`,
    [who, gameId, excludeSessionId32 ?? null],
  );
  const row = rows[0] ?? {};
  return {
    wallet: who,
    gameId,
    runs: Number(row.runs ?? 0),
    sums: Object.fromEntries(sumPaths.map((path, index) => [path, Number(row[`s${index}`] ?? 0)])),
    maxima: Object.fromEntries(maxPaths.map((path, index) => [path, Number(row[`m${index}`] ?? 0)])),
    unlockedIds: parseJsonText(row.unlocked, []),
  };
}

// Mirrors PlayerProfileRegistry into wallet_profiles (§8.4, A29). The owner
// flags hidden and board_excluded are never touched. A write carrying an older
// profile_block than the stored one is ignored.
export async function upsertWalletProfile(db, { wallet, displayName = null, nameBlocked = null, handleHash = null, avatarUri = null, profileBlock = null, onchainUpdatedAt = null } = {}) {
  const who = requireWallet(wallet);
  const rows = await db.query(
    `INSERT INTO wallet_profiles (wallet, display_name, name_blocked, handle_hash, avatar_uri, profile_block, onchain_updated_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::timestamptz, now())
     ON CONFLICT (wallet) DO UPDATE SET
       display_name = EXCLUDED.display_name, name_blocked = EXCLUDED.name_blocked, handle_hash = EXCLUDED.handle_hash,
       avatar_uri = EXCLUDED.avatar_uri, profile_block = EXCLUDED.profile_block,
       onchain_updated_at = EXCLUDED.onchain_updated_at, updated_at = now()
     WHERE wallet_profiles.profile_block IS NULL OR EXCLUDED.profile_block IS NULL
        OR EXCLUDED.profile_block >= wallet_profiles.profile_block
     RETURNING display_name, avatar_uri, hidden`,
    [who, displayName, nameBlocked, handleHash, avatarUri, profileBlock === null || profileBlock === undefined ? null : String(profileBlock), onchainUpdatedAt],
  );
  const row = rows[0] ?? (await db.query('SELECT display_name, avatar_uri, hidden FROM wallet_profiles WHERE wallet = $1', [who]))[0] ?? null;
  return publicDisplay({ hidden: row?.hidden === true, displayName: row?.display_name ?? null, avatarUri: row?.avatar_uri ?? null });
}

// E7: preferences are the only profile field the browser writes (§4.3.6).
export async function writePreferences(db, wallet, preferences) {
  const who = requireWallet(wallet);
  const rows = await db.query(
    `INSERT INTO wallet_profiles (wallet, preferences, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (wallet) DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = now()
     RETURNING preferences::text AS preferences, ${isoSql('updated_at')} AS updated_at`,
    [who, JSON.stringify(preferences ?? {})],
  );
  return { preferences: parseJsonText(rows[0]?.preferences, {}), updatedAt: rows[0]?.updated_at ?? null };
}
