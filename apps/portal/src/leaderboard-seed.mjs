// Leaderboard provenance for Lester's Arcade (clean slate, guide D4 and §5.8).
//
// Earlier builds seeded the device-local board with a synthetic "House Demo"
// Top-50. That seed is gone: nothing seeds a board any more, and the rows an
// older build stored in a browser are recognised here (seed flag, 0xSEED
// wallets) so they never rank, never fill a period bucket and never show as a
// player (purgeHouseSeedRows runs on load). The Scores page has no source tabs:
// hosted boards come only from the verified-session index, and preview boards
// show only this device's Ranked runs (A22).
//
// Pure + DOM-free so it is unit-testable.

const HOUSE_SCORE_PROVENANCE = Object.freeze({ source: 'house-score', label: 'HOUSE SCORE', official: false });
const OFFICIAL_SCORE_PROVENANCE = Object.freeze({ source: 'ranked-settlement', label: 'ON-CHAIN', official: true });
const LOCAL_SCORE_PROVENANCE = Object.freeze({ source: 'local-practice', label: 'LOCAL', official: false });

// The standings a device-local board can be partitioned into (the leaderboard
// engine's `source` option). Unknown sources fail closed to 'official'.
export const LEADERBOARD_SOURCES = Object.freeze([
  Object.freeze({ id: 'official', label: 'Verified Ranked', copy: 'Settled ranked scores only.' }),
  Object.freeze({ id: 'local', label: 'This device', copy: 'Ranked runs recorded in this browser.' }),
]);

export function leaderboardEntryProvenance(entry = {}, profile = null) {
  if (isHouseSeedRow(entry, profile)) return HOUSE_SCORE_PROVENANCE;
  const isHex32 = (value) => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
  // Older hydrated caches used a session ID as a fake transaction hash.
  // Require explicit verified-registry provenance for these rows instead.
  if (entry.onChain === true || String(entry.sessionId ?? '').startsWith('chain:')) {
    return entry.chainVerified === true && isHex32(entry.onChainSessionId32)
      ? OFFICIAL_SCORE_PROVENANCE : LOCAL_SCORE_PROVENANCE;
  }
  if (isHex32(entry.settlementTxHash)) return OFFICIAL_SCORE_PROVENANCE;
  return LOCAL_SCORE_PROVENANCE;
}

// A row (or profile) the retired House Demo seed stored in this browser.
export function isHouseSeedRow(entry = {}, profile = null) {
  return entry?.seed === true || profile?.seed === true || String(entry?.wallet ?? '').startsWith('0xSEED');
}

export function filterLeaderboardEntriesBySource(entries = [], profiles = {}, requestedSource = 'official') {
  const tab = LEADERBOARD_SOURCES.find((row) => row.id === requestedSource) ?? LEADERBOARD_SOURCES[0];
  const rows = (Array.isArray(entries) ? entries : []).filter((entry) => {
    const provenance = leaderboardEntryProvenance(entry, profiles?.[entry?.wallet]);
    if (tab.id === 'official') return provenance.official;
    return provenance.source === 'local-practice';
  }).map((entry, index) => ({ ...entry, rank: index + 1 }));
  return Object.freeze({
    source: tab.id,
    label: tab.label,
    copy: tab.copy,
    rows,
    total: rows.length,
    playerRank: rows.find((row) => row.isCurrentPlayer)?.rank ?? null,
    playerEntry: rows.find((row) => row.isCurrentPlayer) ?? null,
  });
}

// Drops every House Demo row an older build seeded into this browser: cadence
// buckets, the flat per-game boards and the synthetic 0xSEED profiles. Returns
// the number of rows removed. Idempotent.
export function purgeHouseSeedRows(state) {
  if (!state || typeof state !== 'object') return 0;
  let removed = 0;
  const profiles = state.profiles ?? {};
  const keep = (row) => {
    const house = isHouseSeedRow(row, profiles[row?.wallet]);
    if (house) removed += 1;
    return !house;
  };
  for (const cadences of Object.values(state.cadenceLeaderboards ?? {})) {
    for (const periods of Object.values(cadences ?? {})) {
      for (const [periodKey, rows] of Object.entries(periods ?? {})) {
        if (Array.isArray(rows)) periods[periodKey] = rows.filter(keep);
      }
    }
  }
  for (const [gameId, rows] of Object.entries(state.leaderboards ?? {})) {
    if (Array.isArray(rows)) state.leaderboards[gameId] = rows.filter(keep);
  }
  for (const [wallet, profile] of Object.entries(profiles)) {
    if (isHouseSeedRow({ wallet }, profile)) delete profiles[wallet];
  }
  return removed;
}

export function summarizeVisibleLeaderboardProvenance(entries = [], profiles = {}, totalRankedPlayers = entries.length) {
  const rows = Array.isArray(entries) ? entries : [];
  const visibleCount = rows.length;
  let officialCount = 0;
  let houseScoreCount = 0;

  for (const entry of rows) {
    const provenance = leaderboardEntryProvenance(entry, profiles?.[entry?.wallet]);
    if (provenance.official) officialCount += 1;
    else if (provenance.source === 'house-score') houseScoreCount += 1;
  }

  const localScoreCount = Math.max(0, visibleCount - officialCount - houseScoreCount);
  const totalIsConsistent = typeof totalRankedPlayers === 'number'
    && Number.isSafeInteger(totalRankedPlayers)
    && totalRankedPlayers >= visibleCount;
  const normalizedTotal = totalIsConsistent ? totalRankedPlayers : null;
  const visibleScope = normalizedTotal !== null && normalizedTotal > visibleCount
    ? `${visibleCount} of ${normalizedTotal} players`
    : `${visibleCount} player${visibleCount === 1 ? '' : 's'}`;
  const totalStatus = totalIsConsistent ? '' : ' · total unavailable';
  const sourceParts = [
    `${officialCount} official`,
    `${houseScoreCount} house score${houseScoreCount === 1 ? '' : 's'}`,
  ];
  if (localScoreCount > 0) sourceParts.push(`${localScoreCount} local`);

  return {
    visibleCount,
    totalRankedPlayers: normalizedTotal,
    totalIsConsistent,
    officialCount,
    houseScoreCount,
    localScoreCount,
    label: `Showing ${visibleScope}${totalStatus} · ${sourceParts.join(' · ')}`,
  };
}

// Format mm:ss for the survive-time highlight.
export function formatSurvive(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
