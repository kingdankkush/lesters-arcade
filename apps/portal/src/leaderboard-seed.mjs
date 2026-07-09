// Deterministic AI leaderboard seed for Lester's Arcade / Hard Money Heroes.
//
// Fills the global leaderboard with a believable Top-50 of AI "players" so the
// leaderboard UI (podium, rows, sort, filter, search, ranked session highlights)
// can be evaluated with real-looking data BEFORE live ranked play exists.
//
// These are clearly synthetic seed entries (flagged `seed: true`) and live only
// in local state — they are NOT on-chain and never settle. Pure + DOM-free so it
// is unit-testable.

const FIRST = ['Lit', 'Hodl', 'Block', 'Satoshi', 'Mempool', 'Gas', 'Hash', 'Node', 'Chain', 'Crypto',
  'Neon', 'Pixel', 'Turbo', 'Mega', 'Cyber', 'Glitch', 'Vault', 'Ledger', 'Proof', 'Genesis',
  'Diamond', 'Laser', 'Moon', 'Degen', 'Whale', 'Miner', 'Forge', 'Quantum', 'Volt', 'Static'];
const SECOND = ['Commando', 'Valkyrie', 'Slinger', 'Reaper', 'Bandit', 'Maverick', 'Phantom', 'Striker',
  'Nomad', 'Ranger', 'Hunter', 'Outlaw', 'Sentinel', 'Specter', 'Raider', 'Vanguard', 'Drifter',
  'Crusher', 'Blaster', 'Renegade', 'Warden', 'Saint', 'Rogue', 'Titan', 'Ace', 'Viper', 'Wolf',
  'Hawk', 'Fury', 'Ghost'];
const WEAPONS = ['Pistol', 'Hunting Knife', 'Throwing Axes', 'Shotgun', 'Machine Gun'];
const HEROES = ['lit-commando', 'lit-valkyrie'];
const HOUSE_SCORE_PROVENANCE = Object.freeze({ source: 'house-score', label: 'HOUSE SCORE', official: false });
const OFFICIAL_SCORE_PROVENANCE = Object.freeze({ source: 'ranked-settlement', label: 'ON-CHAIN', official: true });
const LOCAL_SCORE_PROVENANCE = Object.freeze({ source: 'local-practice', label: 'LOCAL', official: false });

export function leaderboardEntryProvenance(entry = {}, profile = null) {
  if (entry.seed === true || profile?.seed === true || String(entry.wallet ?? '').startsWith('0xSEED')) {
    return HOUSE_SCORE_PROVENANCE;
  }
  if (entry.settlementTxHash) return OFFICIAL_SCORE_PROVENANCE;
  return LOCAL_SCORE_PROVENANCE;
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
  const normalizedTotal = Math.max(visibleCount, Math.floor(Number(totalRankedPlayers) || 0));
  const visibleScope = normalizedTotal > visibleCount
    ? `${visibleCount} of ${normalizedTotal} players`
    : `${visibleCount} player${visibleCount === 1 ? '' : 's'}`;
  const sourceParts = [
    `${officialCount} official`,
    `${houseScoreCount} house score${houseScoreCount === 1 ? '' : 's'}`,
  ];
  if (localScoreCount > 0) sourceParts.push(`${localScoreCount} local`);

  return {
    visibleCount,
    totalRankedPlayers: normalizedTotal,
    officialCount,
    houseScoreCount,
    localScoreCount,
    label: `Showing ${visibleScope} · ${sourceParts.join(' · ')}`,
  };
}

// Mulberry32 deterministic PRNG (imported from the canonical seeded-rng module)
// so the seed is identical every load and there is one source of truth.
import { mulberry32 } from './seeded-rng.mjs';

// Build `count` deterministic AI leaderboard entries with realistic score spread
// matching the user's playtest baseline (~15,420 for 58 kills / 2:59 / Level 1 / Combo 45).
// Default range covers a believable Top-50 (5,000 to 25,000).
export function buildSeedLeaderboardEntries({
  count = 50,
  seed = 0x1e57e2,
  minScore = 5000,
  maxScore = 25000,
  daysSpan = 60,
  now = Date.now(),
} = {}) {
  const rnd = mulberry32(seed);
  const usedNames = new Set();
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    // Unique display name.
    let name;
    let guard = 0;
    do {
      name = `${FIRST[Math.floor(rnd() * FIRST.length)]}${SECOND[Math.floor(rnd() * SECOND.length)]}`;
      if (rnd() < 0.4) name += Math.floor(rnd() * 90 + 10); // some get a number suffix
      guard += 1;
    } while (usedNames.has(name) && guard < 50);
    usedNames.add(name);

    // Score: smooth linear spread from maxScore (rank #1) down to minScore (rank #N),
    // with small per-entry jitter so the list doesn't feel formulaic.
    const baseScore = maxScore - (i / Math.max(1, count - 1)) * (maxScore - minScore);
    const jitter = (rnd() - 0.5) * 600;
    const score = Math.max(minScore, Math.round(baseScore + jitter));

    // Synthetic, clearly-fake wallet address (not a real key, never settles).
    const walletHex = Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
    const wallet = `0xSEED${walletHex.slice(4)}`;

    const ageDays = rnd() * daysSpan;
    const recordedAt = new Date(now - ageDays * 86400000).toISOString();

    // Run stats calibrated to the user's playtest baseline:
    //   15,420 ≈ 58 kills × 265 + 179 sec × ~15 + 45 combo × ~100 (ballpark).
    // So kills ≈ score/260, surviveSec ≈ score/85, combo ≈ score/300, level ≈ 1+score/4000.
    const kills = Math.max(6, Math.round(score / (240 + rnd() * 40)));
    const surviveSec = Math.max(30, Math.round(score / (80 + rnd() * 20)));
    const combo = Math.max(3, Math.round(score / (280 + rnd() * 80)));
    const level = Math.max(1, Math.round(1 + score / 4000 + rnd() * 0.5));
    const tier = Math.max(1, Math.round(1 + level / 2 + rnd() * 0.8));

    entries.push({
      wallet,
      displayName: name,
      score,
      seed: true,
      provenance: HOUSE_SCORE_PROVENANCE,
      recordedAt,
      hero: HEROES[Math.floor(rnd() * HEROES.length)],
      settlementTxHash: null,
      runStats: {
        kills,
        surviveSeconds: surviveSec,
        level,
        tier,
        combo,
        weapon: WEAPONS[Math.floor(rnd() * WEAPONS.length)],
      },
    });
  }
  // Sort descending by score so ranks read naturally.
  entries.sort((a, b) => b.score - a.score || a.recordedAt.localeCompare(b.recordedAt));
  return entries;
}

// Format mm:ss for the survive-time highlight.
export function formatSurvive(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Apply seed entries: record each across cadence buckets AND register a profile
// display name so the engine's `displayNameFor(wallet)` resolves the AI name.
// `recordFn` is the engine's recordCadenceScore (injected to avoid a cycle).
export function applySeedLeaderboard(state, gameId, recordFn, options = {}) {
  state.profiles ??= {};
  const entries = buildSeedLeaderboardEntries(options);
  for (const e of entries) {
    state.profiles[e.wallet] ??= { handle: e.displayName, displayName: e.displayName, usernameSet: true, seed: true };
    recordFn(state, gameId, {
      wallet: e.wallet,
      score: e.score,
      recordedAt: e.recordedAt,
      settlementTxHash: e.settlementTxHash,
      runStats: e.runStats,
    }, { limitPerPeriod: 200 });
  }
  return entries.length;
}
