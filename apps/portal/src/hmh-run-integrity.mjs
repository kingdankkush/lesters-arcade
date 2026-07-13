// Ranked run integrity / plausibility gate for Hard Money Heroes.
//
// WHY THIS EXISTS
// ---------------
// Ranked runs publish a score, kills, combo, survival time, and boss-clear
// flag on-chain (submitSession) against the player's wallet. Gameplay is
// off-chain and client-authoritative today, so nothing stops a tampered client
// from submitting a physically-impossible run (e.g. 5,000,000 points in 3
// seconds, or 10,000 kills with no time elapsed). The handoff (§17) and the
// design canon both flag server-side/deterministic sanity checks as the HARD
// GATE before any paid launch or real-value leaderboard.
//
// This module is the first, deterministic layer of that gate: it re-derives the
// physically-achievable ceilings from the *same* balance constants the runtime
// uses (HMH_LEVEL_ONE_PLAYTEST_BALANCE, calculateRoguelikeKillXp) and flags a
// submitted run that exceeds them. It does NOT re-simulate the run — that's a
// later P1/P2 layer (replay hash + backend verifier). It catches the crude,
// high-value cheats cheaply and gives the UI/contract layer a verdict to act on.
//
// It is PURE (no DOM, no chain, no RNG) so it can run identically in the
// browser (pre-submit warning), in a future backend verifier, and in tests.

import {
  HMH_LEVEL_ONE_PLAYTEST_BALANCE,
  calculateRoguelikeKillXp,
  ROGUELIKE_LEVEL_CAP,
  POST_CAP_XP_TO_SCORE,
  roguelikeXpCostForLevel,
} from './arcade-core.mjs';

// Tolerance multiplier applied to every derived ceiling. Real runs vary (elite
// packs, POI density, lucky score multipliers), so we only flag a value that
// exceeds the *design* ceiling by more than this slack. Tuned generous on
// purpose: this layer should never flag a legitimate run, only absurd ones.
export const INTEGRITY_TOLERANCE = Object.freeze({
  score: 3.0,        // score is the noisiest signal (multipliers, caches) -> widest band
  kills: 1.6,        // kill count is bounded by spawn cap + session length
  xpPerKill: 1.35,   // XP per kill is tightly bounded by calculateRoguelikeKillXp
  combo: 1.5,        // combo is bounded by kills
});

// Absolute per-kill XP ceiling from the runtime helper (boss kill is the max).
const MAX_XP_PER_KILL = calculateRoguelikeKillXp({ boss: true });

// Highest single-kill *score* a normal/elite enemy is expected to be worth.
// calculateRoguelikeKillXp caps its XP input at score 260, and boss/mini-boss
// kills are the top scorers; we treat a generous 400 as the per-kill score
// ceiling for standard enemies and 4000 for a boss kill.
const MAX_SCORE_PER_STANDARD_KILL = 400;
const MAX_SCORE_PER_BOSS_KILL = 4000;

// Passive score drip (caches, survival bonuses) that can accrue without kills,
// per second. Generous so a cache-heavy but low-kill run is never flagged.
const MAX_PASSIVE_SCORE_PER_SECOND = 60;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function cumulativeXpForLevel(targetLevel = ROGUELIKE_LEVEL_CAP) {
  let total = 0;
  for (let level = 1; level < Math.max(1, targetLevel); level += 1) total += roguelikeXpCostForLevel(level);
  return total;
}

function sortedObjectEntries(obj = {}) {
  return Object.keys(obj ?? {}).sort().map((key) => [key, Math.max(0, Math.floor(num(obj[key], 0)))]);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function replayDigest64(text) {
  const input = String(text);
  const seeds = [0x811c9dc5, 0x45d9f3b, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c];
  return seeds.map((seed, stream) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i) + stream;
      h = Math.imul(h, 0x01000193) >>> 0;
      h = (h ^ (h >>> 13)) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }).join('');
}

// Derive the physically-achievable ceilings for a run of `survivalSeconds`.
// All ceilings scale with time + the balance director's spawn cap so they track
// design intent instead of being magic numbers.
export function deriveRunCeilings({ survivalSeconds = 0, level = 1 } = {}) {
  const seconds = Math.max(0, num(survivalSeconds));
  const balance = HMH_LEVEL_ONE_PLAYTEST_BALANCE;

  // Max concurrent enemies the director allows in the elite band.
  const maxConcurrentEnemies = balance.director.maxEnemiesCap;
  // Designed swarm-fighter kill rate (kills/min) under sustained pressure.
  const swarmKillsPerMinute = balance.xpPacing.swarmFighterRun.assumedKillsPerMinute;
  // A skilled player clears faster than the *assumed* rate; allow up to the
  // spawn cap being cleared roughly every 20s at peak, whichever is higher.
  const killRatePerSecond = Math.max(swarmKillsPerMinute / 60, maxConcurrentEnemies / 20);

  const minutes = seconds / 60;
  // Baseline kill ceiling: sustained peak kill rate over the whole run, plus
  // the standing spawn cap that can be alive at the final instant.
  const maxKills = Math.ceil(killRatePerSecond * seconds + maxConcurrentEnemies);

  // Score ceiling: every kill worth the boss-tier per-kill score (absurdly
  // generous) plus passive drip. This is intentionally loose.
  const maxScore = Math.ceil(
    maxKills * MAX_SCORE_PER_STANDARD_KILL
    + MAX_PASSIVE_SCORE_PER_SECOND * seconds
    // allow a handful of boss/mini-boss kills at the boss score tier
    + 5 * MAX_SCORE_PER_BOSS_KILL,
  );

  // Combo can never exceed total kills (a combo is a chain of kills/hits).
  const maxCombo = Math.ceil(maxKills * 1.2); // hits can slightly exceed kills

  return Object.freeze({
    level,
    survivalSeconds: seconds,
    maxKills,
    maxScore,
    maxCombo,
    maxXpPerKill: MAX_XP_PER_KILL,
    killRatePerSecond: Number(killRatePerSecond.toFixed(3)),
  });
}

// The minimum survival time in which a boss clear is even possible. A run that
// claims a boss kill at 0-3 seconds is tampered: the signature boss is gated behind
// the final route and cannot spawn instantly.
export const MIN_BOSS_CLEAR_SECONDS = 45;

// Validate a submitted ranked run summary against the derived ceilings.
// Returns { ok, verdict, flags[], ceilings }. `verdict` is one of:
//   'ok'          — within all bounds
//   'suspicious'  — one soft bound exceeded (log + allow, review later)
//   'rejected'    — a hard impossibility (never submit / never rank)
export function validateRunPlausibility({
  score = 0,
  kills = 0,
  maxCombo = 0,
  survivalSeconds = 0,
  totalXp = null,
  postCapScoreBonus = 0,
  bossDefeated = false,
  level = 1,
} = {}) {
  const s = Math.max(0, num(score));
  const k = Math.max(0, num(kills));
  const combo = Math.max(0, num(maxCombo));
  const seconds = Math.max(0, num(survivalSeconds));
  const ceilings = deriveRunCeilings({ survivalSeconds: seconds, level });
  const flags = [];

  // Hard impossibilities (rejected):
  // 1. Any positive score/kills with zero elapsed time.
  if (seconds <= 0 && (s > 0 || k > 0)) {
    flags.push({ code: 'no-time-with-progress', severity: 'reject', detail: `score=${s} kills=${k} at ${seconds}s` });
  }
  // 2. Boss clear claimed below the minimum possible clear time.
  if (bossDefeated && seconds < MIN_BOSS_CLEAR_SECONDS) {
    flags.push({ code: 'boss-clear-too-fast', severity: 'reject', detail: `bossDefeated at ${seconds}s < ${MIN_BOSS_CLEAR_SECONDS}s` });
  }
  // 3. Combo cannot exceed total kills by a wide margin (a combo is chained kills/hits).
  if (combo > ceilings.maxCombo && combo > k * INTEGRITY_TOLERANCE.combo + 10) {
    flags.push({ code: 'combo-exceeds-kills', severity: 'reject', detail: `combo=${combo} kills=${k}` });
  }
  // 4. Wave 2 economy caps run level at 80; anything above that cannot be produced by the runtime.
  if (Math.floor(num(level, 1)) > ROGUELIKE_LEVEL_CAP) {
    flags.push({ code: 'level-cap-exceeded', severity: 'reject', detail: `level=${level} cap=${ROGUELIKE_LEVEL_CAP}` });
  }

  // Soft implausibilities (suspicious): exceed design ceiling * tolerance.
  if (k > ceilings.maxKills * INTEGRITY_TOLERANCE.kills) {
    flags.push({ code: 'kills-implausible', severity: 'suspect', detail: `kills=${k} ceiling≈${ceilings.maxKills}` });
  }
  if (s > ceilings.maxScore * INTEGRITY_TOLERANCE.score) {
    flags.push({ code: 'score-implausible', severity: 'suspect', detail: `score=${s} ceiling≈${ceilings.maxScore}` });
  }
  // XP vs kills: total XP should not vastly exceed maxXpPerKill * kills (+ a
  // small base for level-up/pickup XP). Only checked when totalXp is provided.
  if (totalXp != null) {
    const xp = Math.max(0, num(totalXp));
    const xpCeiling = (ceilings.maxXpPerKill * INTEGRITY_TOLERANCE.xpPerKill) * k + 200;
    if (xp > xpCeiling) {
      flags.push({ code: 'xp-exceeds-kills', severity: 'suspect', detail: `xp=${xp} ceiling≈${Math.round(xpCeiling)} for kills=${k}` });
    }
    const postCapScore = Math.max(0, num(postCapScoreBonus));
    if (postCapScore > 0) {
      const maxPostCapScore = Math.max(0, xp - cumulativeXpForLevel(ROGUELIKE_LEVEL_CAP)) * POST_CAP_XP_TO_SCORE;
      if (postCapScore > maxPostCapScore + 500) {
        flags.push({ code: 'post-cap-score-without-xp', severity: 'suspect', detail: `postCapScore=${Math.round(postCapScore)} max≈${Math.round(maxPostCapScore)}` });
      }
    }
  }

  const rejected = flags.some((f) => f.severity === 'reject');
  const suspicious = flags.some((f) => f.severity === 'suspect');
  const verdict = rejected ? 'rejected' : suspicious ? 'suspicious' : 'ok';

  return Object.freeze({
    ok: verdict === 'ok',
    verdict,
    rankable: !rejected, // suspicious runs still rank but are flagged for review
    flags: Object.freeze(flags),
    ceilings,
  });
}

export function buildReplayVerificationEnvelope({
  seed = 0,
  gameVersion = 'unknown',
  survivalSeconds = 0,
  level = 1,
  totalXp = 0,
  postCapScoreBonus = 0,
  rngDraws = {},
  inputChecksum = '',
  eventChecksum = '',
} = {}) {
  const normalizedRngDraws = Object.freeze(Object.fromEntries(sortedObjectEntries(rngDraws)));
  const envelopeWithoutHash = Object.freeze({
    version: 'wave2-replay-envelope-v1',
    seed: Math.max(0, Math.floor(num(seed, 0))),
    gameVersion: String(gameVersion || 'unknown'),
    survivalSeconds: Math.max(0, Number(num(survivalSeconds, 0).toFixed(3))),
    level: Math.max(1, Math.min(ROGUELIKE_LEVEL_CAP, Math.floor(num(level, 1)))),
    totalXp: Math.max(0, Math.round(num(totalXp, 0))),
    postCapScoreBonus: Math.max(0, Math.round(num(postCapScoreBonus, 0))),
    rngDraws: normalizedRngDraws,
    inputChecksum: String(inputChecksum || ''),
    eventChecksum: String(eventChecksum || ''),
  });
  const replayHash = replayDigest64(canonicalJson(envelopeWithoutHash));
  return Object.freeze({ ...envelopeWithoutHash, replayHash });
}
