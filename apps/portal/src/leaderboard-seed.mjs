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

// Mulberry32 deterministic PRNG so the seed is identical every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build `count` deterministic AI leaderboard entries with scores spread across
// the requested range and timestamps spread across the last `daysSpan` days so
// the daily/weekly/monthly cadence boards all populate.
export function buildSeedLeaderboardEntries({
  count = 50,
  seed = 0x1e57e2,
  minScore = 100,
  maxScore = 10000,
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

    // Score: bias toward the lower/middle so the top spots feel earned, but the
    // full 100..10000 range is covered (and easily beatable, per the brief).
    const t = rnd() ** 1.5; // skew toward 0 => more low/mid scores
    const score = Math.round(minScore + t * (maxScore - minScore));

    // Synthetic, clearly-fake wallet address (not a real key, never settles).
    const walletHex = Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
    const wallet = `0xSEED${walletHex.slice(4)}`;

    const ageDays = rnd() * daysSpan;
    const recordedAt = new Date(now - ageDays * 86400000).toISOString();

    // Ranked-run "highlights" — the stats a real ranked submission would carry.
    const surviveSec = Math.round(40 + t * 560 + rnd() * 60); // ~0:40..10:00
    const kills = Math.round(score / (18 + rnd() * 22));
    const level = Math.max(1, Math.round(1 + t * 18 + rnd() * 4));
    const tier = Math.max(1, Math.round(1 + t * 7));

    entries.push({
      wallet,
      displayName: name,
      score,
      seed: true,
      recordedAt,
      hero: HEROES[Math.floor(rnd() * HEROES.length)],
      settlementTxHash: `0xseedtx${walletHex.slice(0, 24)}`,
      runStats: {
        kills,
        surviveSeconds: surviveSec,
        level,
        tier,
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
