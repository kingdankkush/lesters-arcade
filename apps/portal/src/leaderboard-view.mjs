// Pure helpers for the Scores page (global leaderboards).
//
// The route module (routes/official-leaderboard-route.mjs) owns the DOM; this
// module owns the presentation model: which game banners exist, which columns
// a game's board shows, how rows are searched / sorted / paginated, how the
// selected game round-trips through the URL, and what the empty states say.
// Everything here is DOM-free so it can be unit-tested with node --test.

export const LEADERBOARD_PAGE_SIZE = 10;
export const LEADERBOARD_MAX_ROWS = 50;
export const LEADERBOARD_GAME_PREFERENCE_KEY = 'lesters-arcade-scores-game-v1';
export const LEADERBOARD_GAME_QUERY_PARAM = 'game';
// Hosted boards page through GET /api/leaderboard (E5): 25 rows a page, and a
// search is sent to the server after the player stops typing.
export const HOSTED_LEADERBOARD_PAGE_SIZE = 25;
export const LEADERBOARD_SEARCH_DEBOUNCE_MS = 300;

// Launch periods (D2): Weekly is the default, then Monthly and All-time. The
// API already accepts `daily`; flip `daily` to true when Daily returns as the
// headline board. There is no Yearly board.
export const LEADERBOARD_PERIODS = Object.freeze({
  daily: false,
  weekly: true,
  monthly: true,
  'all-time': true,
});
export const DEFAULT_LEADERBOARD_PERIOD = 'weekly';

const PERIOD_TABS = Object.freeze([
  Object.freeze({ id: 'daily', label: 'Daily', resets: 'Resets daily, 00:00 UTC', board: 'today’s board' }),
  Object.freeze({ id: 'weekly', label: 'Weekly', resets: 'Resets Monday 00:00 UTC', board: 'this week’s board' }),
  Object.freeze({ id: 'monthly', label: 'Monthly', resets: 'Resets on the 1st, 00:00 UTC', board: 'this month’s board' }),
  Object.freeze({ id: 'all-time', label: 'All-time', resets: null, board: 'the all-time board' }),
]);

// The period tabs a hosted board offers, in display order.
export function leaderboardPeriodTabs(periods = LEADERBOARD_PERIODS) {
  return Object.freeze(PERIOD_TABS.filter((tab) => periods?.[tab.id] === true));
}

// A hosted board's period for a stored cadence: any tab that is switched on,
// otherwise the Weekly default (older sessions may hold 'yearly' or 'daily').
export function hostedLeaderboardPeriod(cadence, periods = LEADERBOARD_PERIODS) {
  return leaderboardPeriodTabs(periods).some((tab) => tab.id === cadence) ? cadence : DEFAULT_LEADERBOARD_PERIOD;
}

export function leaderboardPeriodTab(period) {
  return PERIOD_TABS.find((tab) => tab.id === period) ?? PERIOD_TABS[1];
}

// "in 3d 4h", "in 5h 12m", "in 9m", "in under a minute"; null when there is
// no reset (all-time) or the time cannot be read.
export function formatResetCountdown(resetsAt, now = Date.now()) {
  const at = Date.parse(String(resetsAt ?? ''));
  if (!Number.isFinite(at)) return null;
  const minutes = Math.floor(Math.max(0, at - now) / 60_000);
  if (minutes < 1) return 'in under a minute';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

// The E5 page that holds a rank (1-based).
export function hostedPageForRank(rank, pageSize = HOSTED_LEADERBOARD_PAGE_SIZE) {
  const r = Math.max(1, Math.floor(Number(rank) || 1));
  return Math.ceil(r / pageSize);
}

const EXPLORER_TX = /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-fA-F]{64}$/;

// The index's explorer link when it has the expected shape, else null.
export function verifiedExplorerUrl(value) {
  return EXPLORER_TX.test(String(value ?? '')) ? String(value) : null;
}

// One E5 row as a board entry. Names are the index's sanitized values: a
// hidden or blocked name is null there and shows as the short wallet here.
export function hostedLeaderboardEntry(row = {}, { connectedWallet = null } = {}) {
  const wallet = String(row.wallet ?? '').toLowerCase();
  const you = Boolean(connectedWallet) && wallet === String(connectedWallet).toLowerCase();
  const walletShort = row.walletShort || (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '');
  return Object.freeze({
    rank: Number(row.rank) || 0,
    trueRank: Number(row.rank) || 0,
    wallet,
    walletShort,
    displayName: row.displayName || walletShort,
    named: Boolean(row.displayName),
    avatarUri: row.avatarUri ?? null,
    score: Number(row.score) || 0,
    runStats: row.stats && typeof row.stats === 'object' ? row.stats : {},
    recordedAt: row.confirmedAt ?? null,
    explorerUrl: verifiedExplorerUrl(row.explorerUrl),
    shareId: row.shareId ?? null,
    sessionId32: row.sessionId32 ?? null,
    isCurrentPlayer: you,
  });
}

// Banner presentation per public leaderboard cabinet. `art` and `cabinet`
// reuse the assets the cabinet browser and mode-select screens already ship;
// the matching CSS (styles-arcade-polish.css, .leaderboard-game-banner) must
// reference the same paths so the picture stays in one place.
export const LEADERBOARD_GAME_BANNERS = Object.freeze({
  'lester-blaster': Object.freeze({
    gameId: 'lester-blaster',
    slug: 'hard-money-heroes',
    title: 'Hard Money Heroes',
    kicker: 'Cabinet 01',
    tagline: 'Isometric roguelite score survival',
    art: './assets/generated/hmh-banners/hard-money-heroes-ranked-banner.jpg',
    cabinet: './assets/hard-money-heroes/cabinet/rotation/hmh-cabinet-rotation-00-front.png?v=hmh-cabinet-white-bg-v1',
    accent: '#ffe84d',
    scoreLabel: 'points',
  }),
  chikun: Object.freeze({
    gameId: 'chikun',
    slug: 'chikun',
    title: "Chikun's Escape",
    kicker: 'Cabinet 02',
    tagline: 'Flap through the fork gauntlet',
    art: './assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp',
    cabinet: './assets/generated/chikun-cabinet/chikun-cabinet-front.png?v=transparent-v2',
    accent: '#45ff8a',
    scoreLabel: 'points',
  }),
  stacked: Object.freeze({
    gameId: 'stacked',
    slug: 'stacked',
    title: 'STACKED',
    kicker: 'Cabinet 03',
    tagline: 'Stack, spin, and seal the ledger',
    art: './assets/stacked-mode-select/stacked-mode-bg.svg',
    cabinet: './assets/cabinet-stacked.svg',
    accent: '#b48cff',
    scoreLabel: 'points',
  }),
});

export function leaderboardBannerFor(gameId, cabinet = null) {
  const known = LEADERBOARD_GAME_BANNERS[gameId];
  if (known) return known;
  return Object.freeze({
    gameId,
    slug: cabinet?.id ?? String(gameId),
    title: cabinet?.title ?? String(gameId),
    kicker: 'Cabinet',
    tagline: cabinet?.description ?? '',
    art: null,
    cabinet: null,
    accent: '#19f7ff',
    scoreLabel: 'points',
  });
}

const CADENCE_WINDOW_LABELS = Object.freeze({
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
  yearly: 'This year',
  'all-time': 'All time',
});

export function describeLeaderboardWindow(cadence = 'all-time', periodKey = '') {
  const label = CADENCE_WINDOW_LABELS[cadence] ?? String(cadence).replace('-', ' ');
  const tab = String(cadence).replace('-', ' ').toUpperCase();
  const detail = periodKey && periodKey !== cadence && periodKey !== 'all-time' ? String(periodKey) : '';
  return Object.freeze({ cadence, label, tab, detail });
}

// ---------------------------------------------------------------------------
// Run stats + columns
// ---------------------------------------------------------------------------

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatClock(seconds) {
  const s = Math.max(0, Math.round(num(seconds) ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatCount(value, fallback = '—') {
  const n = num(value);
  return n === null ? fallback : n.toLocaleString();
}

export function runSecondsFor(entry = {}) {
  const stats = entry?.runStats ?? {};
  return num(stats.surviveSeconds) ?? num(stats.survivalSeconds) ?? num(stats.survivalTime) ?? num(stats.elapsedSeconds) ?? 0;
}

export function hmhBossClearedFor(entry = {}) {
  const stats = entry?.runStats ?? {};
  if ((num(stats.bossKills) ?? 0) > 0) return true;
  if (Array.isArray(stats.bossesDefeated) && stats.bossesDefeated.length > 0) return true;
  return Boolean(stats.bossId);
}

const RANK_COLUMN = Object.freeze({ key: 'rank', label: '#', sortKey: 'rank', align: 'start', kind: 'rank', priority: 1, value: (entry) => num(entry.trueRank ?? entry.rank) ?? 0, format: (entry) => `#${entry.trueRank ?? entry.rank ?? '—'}` });
const PLAYER_COLUMN = Object.freeze({ key: 'name', label: 'Player', sortKey: 'name', align: 'start', kind: 'player', priority: 1, value: (entry) => String(entry.displayName ?? '').toLowerCase(), format: (entry) => String(entry.displayName ?? '') });
const SCORE_COLUMN = Object.freeze({ key: 'score', label: 'Score', sortKey: 'score', align: 'end', kind: 'score', priority: 1, value: (entry) => num(entry.score) ?? 0, format: (entry) => formatCount(entry.score, '0') });
const TRUST_COLUMN = Object.freeze({ key: 'trust', label: 'Source', sortKey: null, align: 'start', kind: 'trust', priority: 3, value: () => 0, format: () => '' });
const POSTED_COLUMN = Object.freeze({ key: 'date', label: 'Posted', sortKey: 'date', align: 'end', kind: 'posted', priority: 2, value: (entry) => String(entry.recordedAt ?? ''), format: (entry) => String(entry.recordedAt ?? '') });

function stat(key, label, read, { format = (entry) => formatCount(read(entry)), priority = 2, title = label } = {}) {
  return Object.freeze({ key, label, title, sortKey: key, align: 'end', kind: 'stat', priority, value: (entry) => num(read(entry)) ?? 0, format });
}

const GAME_STAT_COLUMNS = Object.freeze({
  'lester-blaster': Object.freeze([
    stat('kills', 'Kills', (entry) => entry.runStats?.kills),
    stat('survive', 'Time', runSecondsFor, { format: (entry) => formatClock(runSecondsFor(entry)), title: 'Survival time' }),
    stat('boss', 'Boss', (entry) => (hmhBossClearedFor(entry) ? 1 : 0), { format: (entry) => (hmhBossClearedFor(entry) ? 'Cleared' : '—'), priority: 3, title: 'Boss cleared' }),
    stat('level', 'Level', (entry) => entry.runStats?.level, { format: (entry) => (num(entry.runStats?.level) === null ? '—' : `L${entry.runStats.level}`), priority: 3 }),
    stat('combo', 'Combo', (entry) => entry.runStats?.maxCombo ?? entry.runStats?.combo, { format: (entry) => { const value = num(entry.runStats?.maxCombo ?? entry.runStats?.combo); return value === null ? '—' : `×${value}`; }, priority: 3 }),
  ]),
  chikun: Object.freeze([
    stat('obstacles', 'Cleared', (entry) => entry.runStats?.forksPassed, { title: 'Obstacles cleared' }),
    stat('nearMisses', 'Near miss', (entry) => entry.runStats?.nearMisses, { title: 'Near misses' }),
    stat('survive', 'Flight', runSecondsFor, { format: (entry) => formatClock(runSecondsFor(entry)), title: 'Flight time' }),
    stat('coins', 'Coins', (entry) => entry.runStats?.coinsCollected, { priority: 3 }),
    stat('combo', 'Combo', (entry) => entry.runStats?.bestCombo ?? entry.runStats?.maxCombo, { format: (entry) => { const value = num(entry.runStats?.bestCombo ?? entry.runStats?.maxCombo); return value === null ? '—' : `×${value}`; }, priority: 3 }),
  ]),
  stacked: Object.freeze([
    stat('lines', 'Lines', (entry) => entry.runStats?.linesCleared ?? entry.runStats?.lines),
    stat('level', 'Level', (entry) => entry.runStats?.level, { format: (entry) => (num(entry.runStats?.level) === null ? '—' : `L${entry.runStats.level}`) }),
    stat('halvings', 'Halvings', (entry) => entry.runStats?.quadClears, { title: 'Halvings (quad clears)' }),
    stat('combo', 'Combo', (entry) => entry.runStats?.maxCombo, { format: (entry) => { const value = num(entry.runStats?.maxCombo); return value === null ? '—' : `×${value}`; }, priority: 3 }),
    stat('survive', 'Time', runSecondsFor, { format: (entry) => formatClock(runSecondsFor(entry)), priority: 3, title: 'Run time' }),
  ]),
});

const GENERIC_STAT_COLUMNS = Object.freeze([
  stat('survive', 'Time', runSecondsFor, { format: (entry) => formatClock(runSecondsFor(entry)) }),
]);

// Column definitions for a game's board, in display order.
export function leaderboardColumnsFor(gameId = 'lester-blaster') {
  const stats = GAME_STAT_COLUMNS[gameId] ?? GENERIC_STAT_COLUMNS;
  return Object.freeze([RANK_COLUMN, PLAYER_COLUMN, SCORE_COLUMN, ...stats, TRUST_COLUMN, POSTED_COLUMN]);
}

// The sort options offered in the toolbar (score, date, survival, per-game stats).
export function leaderboardSortOptionsFor(gameId = 'lester-blaster') {
  return leaderboardColumnsFor(gameId)
    .filter((column) => column.sortKey && column.kind !== 'rank')
    .map((column) => Object.freeze({ key: column.sortKey, label: column.kind === 'posted' ? 'Date posted' : column.kind === 'player' ? 'Player name' : (column.title ?? column.label) }));
}

export function defaultSortDirFor(sortKey) {
  return sortKey === 'name' ? 'asc' : 'desc';
}

// Short "key stats" line used by the you-card and compact row summaries.
export function summarizeLeaderboardRun(gameId, entry = {}) {
  const columns = leaderboardColumnsFor(gameId).filter((column) => column.kind === 'stat');
  return columns.map((column) => `${column.format(entry)} ${column.label.toLowerCase()}`).join(' · ');
}

// ---------------------------------------------------------------------------
// Search / sort / paginate
// ---------------------------------------------------------------------------

export function normalizeLeaderboardSearch(term = '') {
  return String(term ?? '').trim().toLowerCase();
}

// Matches by display name substring or wallet prefix ("0xab…" or "ab…").
export function matchesLeaderboardSearch(entry = {}, term = '') {
  const needle = normalizeLeaderboardSearch(term);
  if (!needle) return true;
  const name = String(entry.displayName ?? '').toLowerCase();
  if (name.includes(needle)) return true;
  const wallet = String(entry.wallet ?? entry.address ?? '').toLowerCase();
  if (!wallet) return false;
  if (wallet.startsWith(needle)) return true;
  const bare = wallet.startsWith('0x') ? wallet.slice(2) : wallet;
  return bare.startsWith(needle.startsWith('0x') ? needle.slice(2) : needle) && needle.length >= 2;
}

export function filterLeaderboardRows(rows = [], term = '') {
  const list = Array.isArray(rows) ? rows : [];
  const needle = normalizeLeaderboardSearch(term);
  if (!needle) return list.slice();
  return list.filter((entry) => matchesLeaderboardSearch(entry, needle));
}

// Rows keep their standing (`trueRank`) no matter how they are sorted; ties
// fall back to the standing so the order is stable.
export function sortLeaderboardRows(rows = [], { sortKey = 'score', sortDir = 'desc', gameId = 'lester-blaster' } = {}) {
  const columns = leaderboardColumnsFor(gameId);
  const column = columns.find((candidate) => candidate.sortKey === sortKey) ?? SCORE_COLUMN;
  const dir = sortDir === 'asc' ? 1 : -1;
  const standing = (entry) => num(entry.trueRank ?? entry.rank) ?? Number.MAX_SAFE_INTEGER;
  return (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
    const va = column.value(a);
    const vb = column.value(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return standing(a) - standing(b);
  });
}

export function paginateLeaderboardRows(rows = [], visibleLimit = LEADERBOARD_PAGE_SIZE) {
  const list = Array.isArray(rows) ? rows : [];
  const limit = Math.max(1, Math.floor(num(visibleLimit) ?? LEADERBOARD_PAGE_SIZE));
  const visible = list.slice(0, limit);
  const hiddenCount = Math.max(0, list.length - visible.length);
  return Object.freeze({
    visible,
    total: list.length,
    shown: visible.length,
    hiddenCount,
    hasMore: hiddenCount > 0,
    nextLimit: Math.min(list.length, limit + LEADERBOARD_PAGE_SIZE),
  });
}

// Smallest page limit that reveals a given standing.
export function visibleLimitForRank(rank, pageSize = LEADERBOARD_PAGE_SIZE) {
  const r = Math.max(1, Math.floor(num(rank) ?? 1));
  return Math.ceil(r / pageSize) * pageSize;
}

// ---------------------------------------------------------------------------
// Game selection persistence (URL query + local preference)
// ---------------------------------------------------------------------------

export function leaderboardGameSlug(gameId) {
  return LEADERBOARD_GAME_BANNERS[gameId]?.slug ?? String(gameId ?? '');
}

export function leaderboardGameIdForQuery(value, cabinets = []) {
  const wanted = String(value ?? '').trim().toLowerCase();
  if (!wanted) return null;
  for (const cabinet of cabinets) {
    const banner = leaderboardBannerFor(cabinet.gameId, cabinet);
    const aliases = [cabinet.gameId, cabinet.id, banner.slug].filter(Boolean).map((alias) => String(alias).toLowerCase());
    if (aliases.includes(wanted)) return cabinet.gameId;
  }
  return null;
}

// Priority: explicit ?game= query, then the in-session choice (when already
// made), then the stored device preference, then the first public cabinet.
export function resolveLeaderboardGameId({ search = '', stored = null, current = null, settled = false, cabinets = [] } = {}) {
  const eligible = Array.isArray(cabinets) ? cabinets : [];
  const fallback = eligible[0]?.gameId ?? 'lester-blaster';
  let queryValue = '';
  try {
    queryValue = new URLSearchParams(String(search ?? '')).get(LEADERBOARD_GAME_QUERY_PARAM) ?? '';
  } catch {
    queryValue = '';
  }
  const fromQuery = leaderboardGameIdForQuery(queryValue, eligible);
  if (fromQuery) return fromQuery;
  if (settled && current && eligible.some((cabinet) => cabinet.gameId === current)) return current;
  const fromStored = leaderboardGameIdForQuery(stored, eligible);
  if (fromStored) return fromStored;
  if (current && eligible.some((cabinet) => cabinet.gameId === current)) return current;
  return fallback;
}

export function leaderboardScoresPath(gameId, pathname = '/scores') {
  const base = /^\/(scores|leaderboards)\/?$/.test(String(pathname ?? '')) ? String(pathname).replace(/\/$/, '') : '/scores';
  const slug = leaderboardGameSlug(gameId);
  return slug ? `${base}?${LEADERBOARD_GAME_QUERY_PARAM}=${encodeURIComponent(slug)}` : base;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

// Preview (HOSTED_PROFILE_SYNC off, A22): the board is this browser's own
// Ranked runs, labelled as such. Hosted boards come only from the index.
export const LEADERBOARD_PREVIEW_LABEL = 'Preview · this device';
export const LEADERBOARD_DEVICE_LOCAL_NOTICE = 'Device-local preview: records stay in this browser until on-chain settlement is live. Boards can be wiped per game as games evolve; the only planned full reset is at mainnet.';
export const STACKED_LOCAL_NOTICE = 'Device-local Ranked preview. One board across input devices; labels are self-reported. No fees, prizes or online ranking.';
export const HOSTED_LEADERBOARD_NOTICE = 'Verified Ranked runs published on LitVM. Best score per wallet; ties go to whoever got there first. Every row links to its transaction.';

export function leaderboardEmptyState({ hosted = false, period = DEFAULT_LEADERBOARD_PERIOD, search = '', gameTitle = '' } = {}) {
  const needle = normalizeLeaderboardSearch(search);
  if (needle) {
    return Object.freeze({
      kind: 'search',
      title: `No players match "${String(search).trim()}".`,
      copy: hosted
        ? 'Search matches display names and wallet prefixes (at least four characters) on this board. Clear the search to see every row.'
        : 'Search matches display names and wallet prefixes on the standing shown. Clear the search to see every row.',
      action: 'clear-search',
    });
  }
  if (hosted) {
    return Object.freeze({
      kind: 'empty',
      title: `Be the first on ${leaderboardPeriodTab(period).board}`,
      copy: `No verified Ranked run is on ${leaderboardPeriodTab(period).board}${gameTitle ? ` for ${gameTitle}` : ''} yet. Play Ranked and your score posts here once it is published on LitVM.`,
      action: 'play-ranked',
    });
  }
  return Object.freeze({
    kind: 'empty',
    title: 'No unpublished local ranked scores are available in this period.',
    copy: `Finish a Ranked run${gameTitle ? ` in ${gameTitle}` : ''} on this device to place here.`,
    action: null,
  });
}

// Loading and failure states of a hosted board (the render stays synchronous;
// the hydrate hook fills the board and renders again).
export function hostedLeaderboardStatusCopy(status) {
  if (status === 'loading') return Object.freeze({ kind: 'loading', title: 'Loading verified scores…', copy: 'Reading this board from the arcade index.', action: null });
  if (status === 'offline') return Object.freeze({ kind: 'offline', title: 'You appear to be offline.', copy: 'Verified scores load again when your connection is back.', action: 'retry' });
  if (status === 'error') return Object.freeze({ kind: 'error', title: 'Scores are unavailable right now.', copy: 'The arcade index did not answer. Try again in a moment.', action: 'retry' });
  return null;
}

export function formatPostedDate(iso, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.floor((now - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
