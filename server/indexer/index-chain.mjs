// Chain indexer behind E12 GET /api/cron/index-chain (contract §4.3.10).
//
// Reads ScoreSubmitted, AchievementUnlocked and profile events in chunks and
// mirrors them into Neon. Chain access is injected (getLogs, getBlock, call),
// so tests feed real ABI-encoded logs without a node.
//
// Safety rules:
// - every getLogs call carries the explicit address of its stream, and every
//   returned log is re-checked against that address (anyone can deploy a
//   contract emitting the same topic0);
// - an existing row is confirmed only when the log's player, game and score
//   equal the row's; otherwise it is flagged chain_mismatch and counted;
// - unknown games or seasons are skipped and counted, never inserted;
// - a log that can never succeed (bad data, a CHECK violation) is counted and
//   skipped, so it never freezes the cursor; a chain read failure aborts the
//   chunk without moving the cursor, so the next run retries it.

import { ethers } from 'ethers';
import { ACHIEVEMENT_REGISTRY_ABI, EVENT_TOPICS, PROFILE_REGISTRY_ABI, RANKED_ENTRY_ABI, SCORE_REGISTRY_ABI } from '../chain/abis.mjs';
import { upsertWalletProfile } from '../neon/queries.mjs';
import { periodKeysFor } from '../neon/period-keys.mjs';
import { BOSS_IDS, INDEX_GAMES } from '../neon/rows.mjs';
import { sanitizeOnchainProfile } from '../profile/sanitize.mjs';

export const INDEXER_STREAM = 'litvm-4441';
const scoreIface = new ethers.Interface(SCORE_REGISTRY_ABI);
const entryIface = new ethers.Interface(RANKED_ENTRY_ABI);
const profileIface = new ethers.Interface(PROFILE_REGISTRY_ABI);
const achievementIface = new ethers.Interface(ACHIEVEMENT_REGISTRY_ABI);

function lower(value) {
  const text = String(value ?? '').toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(text) ? text : null;
}

function iso(seconds) {
  return new Date(Number(seconds) * 1000).toISOString();
}

// Chain read failures are transient: they abort the chunk (the cursor stays)
// and surface as 502 chain-read-failed. A fresh error is thrown so an RPC
// message, which can embed the RPC URL, never travels further.
async function chainRead(run) {
  try {
    return await run();
  } catch (error) {
    throw Object.assign(new Error('chain read failed'), { chainIo: true, code: typeof error?.code === 'string' ? error.code : 'CHAIN_READ' });
  }
}

function isPermanent(error) {
  if (error?.chainIo) return false;
  const code = String(error?.code ?? '');
  return /^(22|23)[0-9A-Z]{3}$/.test(code) || ['BAD_DATA', 'INVALID_ARGUMENT', 'NUMERIC_FAULT'].includes(code) || error?.permanent === true;
}

let catalogModule = null;
async function loadCatalog() {
  catalogModule ??= import('../../apps/portal/src/achievements/index.mjs').catch(() => null);
  return catalogModule;
}

// Reverse maps from the ids of §2.1, §2.2 and the achievement catalogs (§6).
export async function buildReverseMaps(catalog) {
  const games = new Map();
  const seasons = new Map();
  const runtimes = new Map();
  for (const game of Object.values(INDEX_GAMES)) {
    games.set(game.gameId32, game.gameId);
    seasons.set(game.seasonId32, { seasonId: game.seasonId, gameId: game.gameId });
    runtimes.set(game.runtimeId32, game.runtimeId);
  }
  const source = catalog === undefined ? await loadCatalog() : catalog;
  const achievements = {};
  for (const game of Object.values(INDEX_GAMES)) {
    const map = new Map();
    let entries = [];
    try {
      entries = typeof source?.catalogFor === 'function' ? source.catalogFor(game.gameId) : [];
    } catch {
      entries = [];
    }
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (typeof entry?.id === 'string' && entry.id) map.set(ethers.id(entry.id), { id: entry.id, tier: entry.tier });
    }
    achievements[game.gameId] = map;
  }
  return { games, seasons, runtimes, achievements };
}

export async function indexChain({
  db, deployment, getLogs, getBlock, call, nowMs = Date.now, budgetMs = 45000, chunk = 5000, maxChunks = 10,
  startBlock = null, catalog = undefined, logger = console,
} = {}) {
  const clock = typeof nowMs === 'function' ? nowMs : () => Number(nowMs);
  const started = clock();
  const addresses = deployment?.addresses ?? {};
  const registry = lower(addresses.scoreSubmissionRegistry);
  const profileRegistry = lower(addresses.playerProfileRegistry);
  const rankedEntry = lower(addresses.arcadeRankedEntry);
  const collections = new Map();
  for (const [gameId, address] of Object.entries(addresses.achievementRegistries ?? {})) {
    if (lower(address) && INDEX_GAMES[gameId]) collections.set(lower(address), gameId);
  }
  const reverse = await buildReverseMaps(catalog);
  const counts = { scores: 0, achievements: 0, profiles: 0, skipped: 0, mismatches: 0, failed: 0 };
  const blockTimes = new Map();

  const blockTime = async (blockNumber) => {
    const key = Number(blockNumber);
    if (!blockTimes.has(key)) {
      const block = await chainRead(() => getBlock(key));
      if (!block) throw Object.assign(new Error('block not found'), { chainIo: true, code: 'BLOCK_NOT_FOUND' });
      blockTimes.set(key, Number(block.timestamp));
    }
    return blockTimes.get(key);
  };
  const readCall = async (to, iface, name, args) => {
    const data = iface.encodeFunctionData(name, args);
    const result = await chainRead(() => call({ to, data }));
    return iface.decodeFunctionResult(name, result);
  };

  const stateRows = await db.query('SELECT last_block::text AS last_block FROM indexer_state WHERE stream = $1', [INDEXER_STREAM]);
  let from = stateRows.length ? Number(stateRows[0].last_block) + 1 : Number(startBlock ?? deployment?.startBlock ?? 0);
  if (!Number.isSafeInteger(from) || from < 0) from = 0;
  const head = await chainRead(() => getBlock('latest'));
  const headNumber = Number(head?.number ?? 0);
  const fromBlock = from;
  let toBlock = from - 1;
  let chunks = 0;

  const handleScore = async (log) => {
    const parsed = scoreIface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed || parsed.name !== 'ScoreSubmitted') { counts.skipped += 1; return; }
    const { args } = parsed;
    const sessionId32 = String(args.sessionId).toLowerCase();
    const player = String(args.player).toLowerCase();
    const gameId = reverse.games.get(String(args.gameId).toLowerCase());
    const season = reverse.seasons.get(String(args.seasonId).toLowerCase());
    if (!gameId || !season || season.gameId !== gameId) { counts.skipped += 1; return; }
    const score = args.score.toString();
    const txHash = String(log.transactionHash).toLowerCase();
    const blockNumber = Number(log.blockNumber);
    const existing = await db.query('SELECT status, wallet, game_id, score::text AS score FROM verified_sessions WHERE session_id32 = $1', [sessionId32]);
    if (existing.length) {
      const row = existing[0];
      if (row.wallet !== player || row.game_id !== gameId || row.score !== score) {
        await db.query('UPDATE verified_sessions SET chain_mismatch = true, updated_at = now() WHERE session_id32 = $1', [sessionId32]);
        counts.mismatches += 1;
        return;
      }
      if (row.status === 'confirmed') return;
      const confirmedAt = iso(await blockTime(blockNumber));
      const updated = await db.query(
        `UPDATE verified_sessions
            SET status = 'confirmed', tx_hash = $2, block_number = $3::bigint, confirmed_at = $4::timestamptz,
                next_attempt_at = NULL, updated_at = now()
          WHERE session_id32 = $1 AND status <> 'confirmed'
          RETURNING session_id32`,
        [sessionId32, txHash, String(blockNumber), confirmedAt],
      );
      if (updated.length) counts.scores += 1;
      return;
    }
    // A run published without this server (for example player-signed, or a
    // row lost before its insert): mirror it as a chain-index row.
    const minedAt = await blockTime(blockNumber);
    let paid = null;
    if (rankedEntry) {
      const [session] = await readCall(rankedEntry, entryIface, 'getPaidSession', [sessionId32]);
      if (session?.exists) paid = { openedAt: Number(session.openedAt), amountWei: session.amountWei.toString() };
    }
    const [envelope] = await readCall(registry, scoreIface, 'sessionEnvelopeHash', [sessionId32]);
    const keys = periodKeysFor((paid?.openedAt ? paid.openedAt : minedAt) * 1000);
    const runtimeId = reverse.runtimes.get(String(args.runtimeId).toLowerCase()) ?? String(args.runtimeId).toLowerCase();
    const bossId = BOSS_IDS[String(args.bossId).toLowerCase()] ?? null;
    const stats = { kills: Number(args.kills), maxCombo: Number(args.maxCombo), survivalSeconds: Number(args.survivalSeconds) };
    const inserted = await db.query(
      `INSERT INTO verified_sessions (session_id32, session_handle, wallet, game_id, season_id, runtime_id, build_hash, seed,
          score, kills, max_combo, survival_seconds, boss_id, stats, envelope_hash, day_key, week_key, month_key,
          status, source, tx_hash, block_number, verified_at, confirmed_at, opened_at, entry_amount_wei)
       VALUES ($1, NULL, $2, $3, $4, $5, NULL, NULL, $6::bigint, $7::bigint, $8::bigint, $9::bigint, $10, $11::jsonb, $12,
          $13, $14, $15, 'confirmed', 'chain-index', $16, $17::bigint, $18::timestamptz, $18::timestamptz, $19::timestamptz, $20)
       ON CONFLICT (session_id32) DO NOTHING
       RETURNING session_id32`,
      [sessionId32, player, gameId, season.seasonId, runtimeId, score, String(stats.kills), String(stats.maxCombo), String(stats.survivalSeconds),
        bossId, JSON.stringify(stats), String(envelope).toLowerCase(), keys.day, keys.week, keys.month, txHash, String(blockNumber),
        iso(minedAt), paid ? iso(paid.openedAt) : null, paid ? paid.amountWei : null],
    );
    if (inserted.length) counts.scores += 1;
  };

  const handleAchievement = async (log, gameId) => {
    const parsed = achievementIface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed || parsed.name !== 'AchievementUnlocked') { counts.skipped += 1; return; }
    const { args } = parsed;
    const entry = reverse.achievements[gameId]?.get(String(args.achievementId).toLowerCase());
    if (!entry) { counts.skipped += 1; return; }
    const wallet = String(args.wallet).toLowerCase();
    const sessionId32 = String(args.sessionId).toLowerCase();
    const tokenId = args.tokenId.toString();
    const txHash = String(log.transactionHash).toLowerCase();
    const mintedAt = iso(await blockTime(log.blockNumber));
    const stamped = await db.query(
      `UPDATE achievement_unlocks SET token_id = $4, mint_tx_hash = $5, minted_at = $6::timestamptz
        WHERE wallet = $1 AND game_id = $2 AND achievement_id = $3
        RETURNING achievement_id`,
      [wallet, gameId, entry.id, tokenId, txHash, mintedAt],
    );
    if (stamped.length) { counts.achievements += 1; return; }
    const inserted = await db.query(
      `INSERT INTO achievement_unlocks (wallet, game_id, achievement_id, session_id32, tier, nft, unlocked_at, token_id, mint_tx_hash, minted_at)
       SELECT $1, $2, $3, $4, $5, true, $6::timestamptz, $7, $8, $6::timestamptz
        WHERE EXISTS (SELECT 1 FROM verified_sessions WHERE session_id32 = $4)
       ON CONFLICT (wallet, game_id, achievement_id) DO UPDATE
         SET token_id = EXCLUDED.token_id, mint_tx_hash = EXCLUDED.mint_tx_hash, minted_at = EXCLUDED.minted_at
       RETURNING achievement_id`,
      [wallet, gameId, entry.id, sessionId32, entry.tier, mintedAt, tokenId, txHash],
    );
    if (inserted.length) counts.achievements += 1;
    else counts.skipped += 1;
  };

  const refreshProfile = async (wallet) => {
    const [profile] = await readCall(profileRegistry, profileIface, 'getProfile', [wallet]);
    const clean = sanitizeOnchainProfile(profile);
    const lastUpdated = Number(profile?.lastUpdated ?? 0);
    await upsertWalletProfile(db, { wallet, ...clean, profileBlock: headNumber, onchainUpdatedAt: lastUpdated > 0 ? iso(lastUpdated) : null });
    counts.profiles += 1;
  };

  const guarded = async (label, run) => {
    try {
      await run();
    } catch (error) {
      if (!isPermanent(error)) throw error;
      counts.failed += 1;
      logger?.warn?.(`[index-chain] ${label} skipped`, error?.name ?? 'Error', error?.code ?? 'none');
    }
  };

  const logsFor = async (address, topics, fromChunk, toChunk) => {
    const logs = await chainRead(() => getLogs({ address, topics, fromBlock: fromChunk, toBlock: toChunk }));
    return (logs ?? [])
      .filter((log) => String(log?.address ?? '').toLowerCase() === address)
      .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.index ?? a.logIndex ?? 0) - Number(b.index ?? b.logIndex ?? 0));
  };

  while (from <= headNumber && chunks < maxChunks && clock() - started < budgetMs) {
    const to = Math.min(from + chunk - 1, headNumber);
    const scoreLogs = registry ? await logsFor(registry, [EVENT_TOPICS.ScoreSubmitted], from, to) : [];
    const achievementLogs = [];
    for (const [address, gameId] of collections) {
      for (const log of await logsFor(address, [EVENT_TOPICS.AchievementUnlocked], from, to)) achievementLogs.push({ log, gameId });
    }
    const profileLogs = profileRegistry ? await logsFor(profileRegistry, [[EVENT_TOPICS.ProfileCreated, EVENT_TOPICS.ProfileUpdated]], from, to) : [];

    for (const log of scoreLogs) await guarded('score log', () => handleScore(log));
    for (const { log, gameId } of achievementLogs) await guarded('achievement log', () => handleAchievement(log, gameId));
    const wallets = [...new Set(profileLogs.map((log) => (log.topics?.[1] ? lower(ethers.dataSlice(log.topics[1], 12)) : null)).filter(Boolean))];
    for (const wallet of wallets) await guarded('profile', () => refreshProfile(wallet));

    await db.query(
      `INSERT INTO indexer_state (stream, last_block, updated_at) VALUES ($1, $2::bigint, now())
       ON CONFLICT (stream) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = now()`,
      [INDEXER_STREAM, String(to)],
    );
    toBlock = to;
    from = to + 1;
    chunks += 1;
  }

  // Housekeeping: spent login nonces and old rate-limit windows.
  const nowSeconds = String(Math.floor(clock() / 1000));
  await db.query("DELETE FROM auth_nonces WHERE expires_at < to_timestamp($1::double precision) - interval '1 hour'", [nowSeconds]);
  await db.query("DELETE FROM rate_limits WHERE window_start < to_timestamp($1::double precision) - interval '2 days'", [nowSeconds]);

  return {
    fromBlock,
    toBlock,
    headBlock: headNumber,
    chunks,
    ...counts,
    lagBlocks: Math.max(0, headNumber - toBlock),
  };
}
