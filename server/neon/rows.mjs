// Row → API shape mappers and the index's game table (contract §2.1, §2.2,
// §4.3.5-§4.3.8, §6.3).
//
// The game table mirrors RANKED_GAMES (verify slice, ranked-identity.mjs); a
// test pins the 32-byte ids against ethers.id so the two cannot drift.

import { versionLabelFor } from '../../apps/portal/src/game-version-labels.mjs';

export const EXPLORER_TX_BASE = 'https://liteforge.explorer.caldera.xyz/tx/';

export const INDEX_GAMES = Object.freeze({
  'lester-blaster': Object.freeze({
    gameId: 'lester-blaster', slug: 'hard-money-heroes', title: 'Hard Money Heroes',
    seasonId: 'hmh-season-1-2026', runtimeId: 'lester-blaster:hmh-run-summary-v6',
    gameId32: '0x545dd61662e9dc794369142dd2768078f04eb05c60daec6fe35ec6b9f854205e',
    seasonId32: '0x0d51bf17a0c812235cd14152862053cdf66fb19a7fc64fd41dae9fa18cf72947',
    runtimeId32: '0x7a49b1ef4a70d8a4f787edc9cf0777f9eeae2c08d8c4d0b63c0a123600b4a2e0',
    verification: 'plausibility',
  }),
  chikun: Object.freeze({
    gameId: 'chikun', slug: 'chikun', title: "Chikun's Escape",
    seasonId: 'chikun-season-preview-1', runtimeId: 'chikun:canvas-runtime-v7',
    gameId32: '0xe293f354d567ca05ed272162a4f9056216cf9f40e9fe59bbf8b6227c0ce4f385',
    seasonId32: '0xdec4900d7408bc67cb59219f09a8afed684ab088cf7633784e5f97d6cda50e51',
    runtimeId32: '0x22ee05d74f52b967d5644200912b19d1834d60274eeedc9c692f2e83fcfbd411',
    verification: 'replay',
  }),
  stacked: Object.freeze({
    gameId: 'stacked', slug: 'stacked', title: 'STACKED',
    seasonId: 'stacked-season-preview-1', runtimeId: 'stacked:stacked-result-v1',
    gameId32: '0xf59739dcdad762dcc1b5c107223be71d49deb6bb5c775307196190123630d7f5',
    seasonId32: '0xc0ea09f7acabf8c293b44bb21d4ddd53036bc6886649dbe65b2afb6b17277db5',
    runtimeId32: '0x34b1f2f810dadc00f74f2fc706011f6f5e06c3a70850ee288227a914f995f60e',
    verification: 'replay',
  }),
});

export const INDEX_GAME_IDS = Object.freeze(Object.keys(INDEX_GAMES));

// boss-liquidator is the only HMH boss id on chain (§2.2).
export const BOSS_IDS = Object.freeze({ '0x81b9332af0bfe9f6c1d9221d44a8ee1c46ba5c60c4e4f7cc4e7e4b61d7991cb8': 'boss-liquidator' });

// Leaderboard headline keys (§6.3): the stats subset in E5, E6 and E9 rows.
export const HEADLINE_KEYS = Object.freeze({
  'lester-blaster': Object.freeze(['kills', 'survivalSeconds', 'maxCombo', 'level', 'bossKills']),
  chikun: Object.freeze(['forksPassed', 'nearMisses', 'coinsCollected', 'bestCombo', 'survivalSeconds', 'regionReached', 'laps']),
  stacked: Object.freeze(['lines', 'level', 'quadClears', 'perfectClears', 'maxCombo', 'survivalSeconds']),
});

// Numeric headline keys (totals in E6 sum these; regionReached is a string).
export const NUMERIC_HEADLINE_KEYS = Object.freeze(Object.fromEntries(
  Object.entries(HEADLINE_KEYS).map(([gameId, keys]) => [gameId, Object.freeze(keys.filter((key) => key !== 'regionReached'))]),
));

export const ALL_NUMERIC_HEADLINE_KEYS = Object.freeze([...new Set(Object.values(NUMERIC_HEADLINE_KEYS).flat())]);

// Headline keys that are a per-run best, where a sum across runs means
// nothing (a combo total, the levels added up): E6 also reports their maximum
// as `bests` (polish-2). `totals` keeps summing every numeric key (§4.3.6).
export const PER_RUN_BEST_KEYS = Object.freeze(['maxCombo', 'bestCombo', 'level']);
export const BEST_HEADLINE_KEYS = Object.freeze(Object.fromEntries(
  Object.entries(NUMERIC_HEADLINE_KEYS).map(([gameId, keys]) => [gameId, Object.freeze(keys.filter((key) => PER_RUN_BEST_KEYS.includes(key)))]),
));
export const ALL_BEST_HEADLINE_KEYS = Object.freeze(ALL_NUMERIC_HEADLINE_KEYS.filter((key) => PER_RUN_BEST_KEYS.includes(key)));

// game= accepts a gameId or a route slug; answers always carry the gameId.
export function resolveGameId(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (Object.hasOwn(INDEX_GAMES, text)) return text;
  const bySlug = Object.values(INDEX_GAMES).find((game) => game.slug === text);
  return bySlug ? bySlug.gameId : null;
}

export function walletShort(wallet) {
  const text = String(wallet ?? '').toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(text) ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
}

export function shareIdFor(sessionId32) {
  return String(sessionId32 ?? '').toLowerCase().replace(/^0x/, '');
}

// 0x-prefixed or bare 64 hex, any case → canonical 0x + 64 lowercase hex.
export function normalizeSessionId32(value) {
  const text = String(value ?? '').trim().toLowerCase();
  const match = /^(?:0x)?([0-9a-f]{64})$/.exec(text);
  return match ? `0x${match[1]}` : null;
}

export function explorerUrlFor(txHash) {
  return typeof txHash === 'string' && /^0x[0-9a-f]{64}$/.test(txHash) ? `${EXPLORER_TX_BASE}${txHash}` : null;
}

export function parseJsonText(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function headlineStats(gameId, stats) {
  const source = stats && typeof stats === 'object' ? stats : {};
  const out = {};
  for (const key of HEADLINE_KEYS[gameId] ?? []) {
    if (Object.hasOwn(source, key)) out[key] = source[key];
  }
  return out;
}

export function publicDisplay(profile) {
  const hidden = profile?.hidden === true;
  return {
    displayName: hidden ? null : (profile?.displayName ?? null),
    avatarUri: hidden ? null : (profile?.avatarUri ?? null),
    hidden,
  };
}

// A dead letter is a failed row with no next attempt (§3.3, §4.4).
export function isRetryable(status, nextAttemptAt) {
  if (status === 'confirmed') return false;
  if (status === 'failed' && !nextAttemptAt) return false;
  return true;
}

export function verificationFor(gameId, source) {
  if (source === 'chain-index') return 'chain-index';
  return INDEX_GAMES[gameId]?.verification ?? 'replay';
}

// The game version a run was played on (owner decision 2026-09-25: no testnet
// season resets), from its stored build_hash and runtime_id. Only the label is
// public in E5 and E6; the raw build hash is never returned. The build hash is
// the client's (format-checked, A11), so an HMH or STACKED cabinet this deploy
// has not shipped reads '<Game> v?' (game-version-labels.mjs SHIPPED_CABINETS).
// A chain-index row stores no build hash; it reads the game's only shipped
// cabinet while there is one ('HMH v0.5', 'STACKED v0.2'), else '<Game> v?'.
export function rowVersionLabel(gameId, row) {
  return versionLabelFor(gameId, row ? { buildHash: row.build_hash ?? null, runtimeId: row.runtime_id ?? null } : null);
}

export function leaderboardRow(gameId, row) {
  const display = publicDisplay({ hidden: row.hidden, displayName: row.display_name, avatarUri: row.avatar_uri });
  return {
    rank: Number(row.rank),
    wallet: row.wallet,
    walletShort: walletShort(row.wallet),
    displayName: display.displayName,
    avatarUri: display.avatarUri,
    score: Number(row.score),
    stats: headlineStats(gameId, parseJsonText(row.stats, {})),
    versionLabel: rowVersionLabel(gameId, row),
    sessionId32: row.session_id32,
    shareId: shareIdFor(row.session_id32),
    txHash: row.tx_hash ?? null,
    explorerUrl: explorerUrlFor(row.tx_hash),
    confirmedAt: row.confirmed_at ?? null,
  };
}

export function recentSessionRow(row, { self = false } = {}) {
  const out = {
    sessionId32: row.session_id32,
    shareId: shareIdFor(row.session_id32),
    gameId: row.game_id,
    score: Number(row.score),
    status: row.status,
    txHash: row.tx_hash ?? null,
    explorerUrl: explorerUrlFor(row.tx_hash),
    verifiedAt: row.verified_at ?? null,
    confirmedAt: row.confirmed_at ?? null,
    stats: headlineStats(row.game_id, parseJsonText(row.stats, {})),
    versionLabel: rowVersionLabel(row.game_id, row),
  };
  if (self) {
    out.retryable = isRetryable(row.status, row.next_attempt_at);
    out.lastError = row.last_error ?? null;
    out.nextAttemptAt = row.next_attempt_at ?? null;
  }
  return out;
}
