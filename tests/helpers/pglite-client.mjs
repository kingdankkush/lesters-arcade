// In-memory PGlite standing in for Neon in tests and the local rehearsal
// (contract A15, A34). The client has the same shape as the Neon HTTP client:
// { schemaKey, query(sql, params) → rows, close() }. Every instance gets its
// own schemaKey, so the per-process ensureSchema memo never leaks between
// databases. Handler tests must NOT migrate in setup: the first request has to
// prove the handler calls ensureSchema itself.

import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../../server/neon/migrations.mjs';
import { periodKeysFor } from '../../server/neon/period-keys.mjs';
import { INDEX_GAMES } from '../../server/neon/rows.mjs';

export function createPgliteClient() {
  let pg = null;
  let closed = false;
  const ready = () => {
    if (closed) throw new Error('pglite client is closed');
    pg ??= new PGlite();
    return pg;
  };
  return Object.freeze({
    schemaKey: `pglite:${randomUUID()}`,
    async query(sql, params = []) {
      for (const value of params) {
        if (value !== null && typeof value !== 'string') throw new TypeError(`A15: query parameters must be strings or null, got ${typeof value}`);
      }
      const result = await ready().query(sql, params);
      return result.rows;
    },
    async close() {
      closed = true;
      if (pg) await pg.close();
    },
  });
}

const migrated = new WeakSet();
async function ensureMigrated(db) {
  if (migrated.has(db)) return;
  await migrate(db);
  migrated.add(db);
}

export function randomHex32() {
  return `0x${randomBytes(32).toString('hex')}`;
}

export function randomWallet() {
  return `0x${randomBytes(20).toString('hex')}`;
}

const DEFAULT_STATS = Object.freeze({
  'lester-blaster': { kills: 120, survivalSeconds: 600, maxCombo: 30, level: 12, bossKills: 0 },
  chikun: { forksPassed: 40, nearMisses: 9, coinsCollected: 22, bestCombo: 6, survivalSeconds: 180, regionReached: 'coast', laps: 0 },
  stacked: { lines: 60, level: 7, quadClears: 3, perfectClears: 0, maxCombo: 5, survivalSeconds: 420 },
});

const BUILD_HASHES = Object.freeze({
  'lester-blaster': 'site-1.7.0:game-1.7.0',
  chikun: 'site-1.7.0:game-1.7.0:cabinet-0.9.0',
  stacked: 'site-1.7.0:game-1.7.0:cabinet-1.6.0',
});

function iso(value) {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

// Inserts one verified_sessions row (migrating the database first when
// needed) and returns the values used. Defaults describe a confirmed Chikun
// run; any column can be overridden in camelCase.
export async function seedVerifiedSession(db, overrides = {}) {
  await ensureMigrated(db);
  const gameId = overrides.gameId ?? 'chikun';
  const game = INDEX_GAMES[gameId];
  const status = overrides.status ?? 'confirmed';
  const openedAt = iso(overrides.openedAt ?? '2026-09-23T10:00:00.000Z');
  const verifiedAt = iso(overrides.verifiedAt ?? Date.parse(openedAt) + 60_000);
  const confirmedAt = Object.hasOwn(overrides, 'confirmedAt') ? iso(overrides.confirmedAt) : (status === 'confirmed' ? iso(Date.parse(verifiedAt) + 30_000) : null);
  const txHash = Object.hasOwn(overrides, 'txHash') ? overrides.txHash : (['confirmed', 'submitted'].includes(status) ? randomHex32() : null);
  const keys = periodKeysFor(Date.parse(overrides.periodAt ?? openedAt));
  const stats = overrides.stats ?? { score: overrides.score ?? 1000, ...(DEFAULT_STATS[gameId] ?? {}) };
  const row = {
    sessionId32: overrides.sessionId32 ?? randomHex32(),
    sessionHandle: Object.hasOwn(overrides, 'sessionHandle') ? overrides.sessionHandle : `game-session-${randomUUID()}`,
    wallet: (overrides.wallet ?? `0x${'11'.repeat(20)}`).toLowerCase(),
    gameId,
    seasonId: overrides.seasonId ?? game.seasonId,
    runtimeId: overrides.runtimeId ?? game.runtimeId,
    buildHash: Object.hasOwn(overrides, 'buildHash') ? overrides.buildHash : BUILD_HASHES[gameId],
    seed: Object.hasOwn(overrides, 'seed') ? overrides.seed : 12345,
    score: overrides.score ?? 1000,
    kills: overrides.kills ?? 0,
    maxCombo: overrides.maxCombo ?? 0,
    survivalSeconds: overrides.survivalSeconds ?? 60,
    bossId: overrides.bossId ?? null,
    stats,
    envelopeHash: overrides.envelopeHash ?? randomHex32(),
    achievements: overrides.achievements ?? [],
    nftAchievements: overrides.nftAchievements ?? [],
    dayKey: overrides.dayKey ?? keys.day,
    weekKey: overrides.weekKey ?? keys.week,
    monthKey: overrides.monthKey ?? keys.month,
    status,
    source: overrides.source ?? 'settle',
    txHash,
    blockNumber: Object.hasOwn(overrides, 'blockNumber') ? overrides.blockNumber : (txHash ? 100 : null),
    attempts: overrides.attempts ?? 0,
    lastError: overrides.lastError ?? null,
    nextAttemptAt: iso(overrides.nextAttemptAt ?? null),
    openedAt,
    verifiedAt,
    confirmedAt,
    entryAmountWei: overrides.entryAmountWei ?? '100100000000000000',
    clientClaim: overrides.clientClaim ?? null,
    plausibility: overrides.plausibility ?? null,
    chainMismatch: overrides.chainMismatch ?? false,
  };
  await db.query(
    `INSERT INTO verified_sessions (session_id32, session_handle, wallet, game_id, season_id, runtime_id, build_hash, seed,
        score, kills, max_combo, survival_seconds, boss_id, stats, envelope_hash, achievements, nft_achievements,
        day_key, week_key, month_key, status, source, tx_hash, block_number, attempts, last_error, next_attempt_at,
        opened_at, verified_at, confirmed_at, entry_amount_wei, client_claim, plausibility, chain_mismatch)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::bigint,$9::bigint,$10::bigint,$11::bigint,$12::bigint,$13,$14::jsonb,$15,
        ARRAY(SELECT jsonb_array_elements_text($16::jsonb)), ARRAY(SELECT jsonb_array_elements_text($17::jsonb)),
        $18,$19,$20,$21,$22,$23,$24::bigint,$25::int,$26,$27::timestamptz,$28::timestamptz,$29::timestamptz,$30::timestamptz,
        $31,$32::jsonb,$33::jsonb,$34::boolean)`,
    [row.sessionId32, row.sessionHandle, row.wallet, row.gameId, row.seasonId, row.runtimeId, row.buildHash,
      row.seed === null ? null : String(row.seed), String(row.score), String(row.kills), String(row.maxCombo), String(row.survivalSeconds),
      row.bossId, JSON.stringify(row.stats), row.envelopeHash, JSON.stringify(row.achievements), JSON.stringify(row.nftAchievements),
      row.dayKey, row.weekKey, row.monthKey, row.status, row.source, row.txHash, row.blockNumber === null ? null : String(row.blockNumber),
      String(row.attempts), row.lastError, row.nextAttemptAt, row.openedAt, row.verifiedAt, row.confirmedAt, row.entryAmountWei,
      row.clientClaim === null ? null : JSON.stringify(row.clientClaim), row.plausibility === null ? null : JSON.stringify(row.plausibility),
      row.chainMismatch ? 'true' : 'false'],
  );
  return row;
}

export async function seedWalletProfile(db, overrides = {}) {
  await ensureMigrated(db);
  const row = {
    wallet: (overrides.wallet ?? `0x${'11'.repeat(20)}`).toLowerCase(),
    displayName: Object.hasOwn(overrides, 'displayName') ? overrides.displayName : 'Lit Pilot',
    avatarUri: Object.hasOwn(overrides, 'avatarUri') ? overrides.avatarUri : 'lestersarcade:avatar/lester',
    handleHash: overrides.handleHash ?? null,
    hidden: overrides.hidden ?? false,
    nameBlocked: overrides.nameBlocked ?? null,
    boardExcluded: overrides.boardExcluded ?? false,
    preferences: overrides.preferences ?? {},
    profileBlock: overrides.profileBlock ?? null,
  };
  await db.query(
    `INSERT INTO wallet_profiles (wallet, display_name, avatar_uri, handle_hash, hidden, name_blocked, board_excluded, preferences, profile_block)
     VALUES ($1,$2,$3,$4,$5::boolean,$6,$7::boolean,$8::jsonb,$9::bigint)
     ON CONFLICT (wallet) DO UPDATE SET display_name = EXCLUDED.display_name, avatar_uri = EXCLUDED.avatar_uri,
       handle_hash = EXCLUDED.handle_hash, hidden = EXCLUDED.hidden, name_blocked = EXCLUDED.name_blocked,
       board_excluded = EXCLUDED.board_excluded, preferences = EXCLUDED.preferences, profile_block = EXCLUDED.profile_block`,
    [row.wallet, row.displayName, row.avatarUri, row.handleHash, row.hidden ? 'true' : 'false', row.nameBlocked,
      row.boardExcluded ? 'true' : 'false', JSON.stringify(row.preferences), row.profileBlock === null ? null : String(row.profileBlock)],
  );
  return row;
}

export async function seedAchievementUnlock(db, overrides = {}) {
  await ensureMigrated(db);
  const row = {
    wallet: (overrides.wallet ?? `0x${'11'.repeat(20)}`).toLowerCase(),
    gameId: overrides.gameId ?? 'chikun',
    achievementId: overrides.achievementId ?? 'chikun-first-flight',
    sessionId32: overrides.sessionId32,
    tier: overrides.tier ?? 'bronze',
    nft: overrides.nft ?? false,
    unlockedAt: iso(overrides.unlockedAt ?? '2026-09-23T10:02:00.000Z'),
    tokenId: overrides.tokenId ?? null,
    mintTxHash: overrides.mintTxHash ?? null,
  };
  await db.query(
    `INSERT INTO achievement_unlocks (wallet, game_id, achievement_id, session_id32, tier, nft, unlocked_at, token_id, mint_tx_hash)
     VALUES ($1,$2,$3,$4,$5,$6::boolean,$7::timestamptz,$8,$9)`,
    [row.wallet, row.gameId, row.achievementId, row.sessionId32, row.tier, row.nft ? 'true' : 'false', row.unlockedAt, row.tokenId, row.mintTxHash],
  );
  return row;
}
