// Cadence-bucketed leaderboard engine for Lester's Arcade / Hard Money Heroes.
//
// Replaces the single flat top-10 list with five time-bucketed boards per game:
//   daily, weekly, monthly, yearly, all-time
//
// Each ranked run is filed into the period it belongs to (derived from the run
// timestamp, UTC). Reads filter to the *current* period for daily/weekly/etc,
// and to everything for all-time. Display name is resolved at read time so a
// player renaming themselves updates every board immediately.
//
// Pure + DOM-free so it is unit-testable. The arcade state owns the storage:
//   state.cadenceLeaderboards[gameId][cadence][periodKey] = [entries...]

export const LEADERBOARD_CADENCES = Object.freeze(['daily', 'weekly', 'monthly', 'yearly', 'all-time']);

function toDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(value ?? Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

// ISO week number (UTC). Returns { year, week }.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

// The period key a given timestamp falls into, per cadence. Stable, sortable.
export function periodKeyFor(cadence, when = Date.now()) {
  const date = toDate(when);
  const y = date.getUTCFullYear();
  switch (cadence) {
    case 'daily':
      return `${y}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    case 'weekly': {
      const { year, week } = isoWeek(date);
      return `${year}-W${pad(week)}`;
    }
    case 'monthly':
      return `${y}-${pad(date.getUTCMonth() + 1)}`;
    case 'yearly':
      return `${y}`;
    case 'all-time':
      return 'all-time';
    default:
      throw new Error(`Unknown leaderboard cadence: ${cadence}`);
  }
}

// All period keys a single run timestamp belongs to (one per cadence).
export function periodKeys(when = Date.now()) {
  return Object.fromEntries(LEADERBOARD_CADENCES.map((cadence) => [cadence, periodKeyFor(cadence, when)]));
}

function ensureCadenceStore(state, gameId) {
  state.cadenceLeaderboards ??= {};
  const game = (state.cadenceLeaderboards[gameId] ??= {});
  for (const cadence of LEADERBOARD_CADENCES) {
    game[cadence] ??= {};
  }
  return game;
}

// Record a ranked score across all five cadence buckets. `entry` must carry
// at least { wallet, score } and should carry { gameId, recordedAt, runStats }.
// `limitPerPeriod` caps stored rows per bucket to keep state bounded.
export function recordCadenceScore(state, gameId, entry, { limitPerPeriod = 100 } = {}) {
  if (!state || typeof state !== 'object') throw new Error('state is required');
  if (!gameId) throw new Error('gameId is required');
  if (!entry?.wallet || !Number.isFinite(entry.score)) {
    throw new Error('entry with wallet and numeric score is required');
  }

  const store = ensureCadenceStore(state, gameId);
  const when = entry.recordedAt ?? new Date().toISOString();
  const keys = periodKeys(when);
  const baseRow = {
    wallet: entry.wallet,
    score: entry.score,
    sessionId: entry.sessionId ?? null,
    recordedAt: when,
    runStats: { ...(entry.runStats ?? {}) },
    settlementTxHash: entry.settlementTxHash ?? null,
  };

  for (const cadence of LEADERBOARD_CADENCES) {
    const key = keys[cadence];
    const bucket = (store[cadence][key] ??= []);
    bucket.push({ ...baseRow });
    bucket.sort((a, b) => b.score - a.score || a.recordedAt.localeCompare(b.recordedAt));
    if (bucket.length > limitPerPeriod) bucket.length = limitPerPeriod;
  }

  return keys;
}

// Read the current-period board for a cadence. `displayNameFor(wallet)` resolves
// the username/truncated-address shown for each row; `wallet` highlights the
// requesting player's own placement.
export function getLeaderboard(state, gameId, cadence, {
  limit = 10,
  now = Date.now(),
  wallet = null,
  displayNameFor = (w) => w,
} = {}) {
  if (!LEADERBOARD_CADENCES.includes(cadence)) {
    throw new Error(`Unknown leaderboard cadence: ${cadence}`);
  }
  const store = state?.cadenceLeaderboards?.[gameId]?.[cadence] ?? {};
  const key = periodKeyFor(cadence, now);
  const rows = store[key] ?? [];

  const ranked = rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    displayName: displayNameFor(row.wallet),
    isCurrentPlayer: wallet ? row.wallet === wallet : false,
  }));

  const top = ranked.slice(0, limit);
  const playerEntry = wallet ? ranked.find((row) => row.wallet === wallet) ?? null : null;

  return {
    gameId,
    cadence,
    periodKey: key,
    total: ranked.length,
    topEntries: top,
    playerEntry,
    playerRank: playerEntry?.rank ?? null,
  };
}

// All five boards at once (current period each), for rendering tabbed UI.
export function getAllCadenceLeaderboards(state, gameId, options = {}) {
  return LEADERBOARD_CADENCES.map((cadence) => getLeaderboard(state, gameId, cadence, options));
}
