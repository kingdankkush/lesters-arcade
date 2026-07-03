import {
  calculateRoguelikeKillXp,
  levelOneRoguelikeSpawnDirectorAt,
  levelOneThreatBeatSchedule,
  roguelikeXpCostForLevel,
  ROGUELIKE_LEVEL_CAP,
  POST_CAP_XP_TO_SCORE,
} from './arcade-core.mjs';

const DEFAULT_STANDARD_KILL_SCORE = 140;
const DEFAULT_ELITE_KILL_SCORE = 220;
const DEFAULT_MINIBOSS_XP = 72;
const DEFAULT_BOSS_XP = 140;
const DEFAULT_MINIBOSS_INTERVAL_SECONDS = 180;
const DEFAULT_BOSS_SECONDS = 510;

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function levelFromCumulativeXp(cumulativeXp = 0, { maxLevel = ROGUELIKE_LEVEL_CAP } = {}) {
  let xp = Math.max(0, Number(cumulativeXp) || 0);
  let level = 1;
  while (level < maxLevel) {
    const cost = roguelikeXpCostForLevel(level);
    if (xp < cost) break;
    xp -= cost;
    level += 1;
  }
  return level;
}

function xpPerKillAt(director) {
  const standard = calculateRoguelikeKillXp({ score: DEFAULT_STANDARD_KILL_SCORE });
  const elite = calculateRoguelikeKillXp({ score: DEFAULT_ELITE_KILL_SCORE, elite: true, tier: 'elite' });
  const eliteShare = clampNumber(director.eliteEnemyShare ?? 0, 0, 1);
  return standard * (1 - eliteShare) + elite * eliteShare;
}

function activeStageForDirector(director) {
  return director.difficultyLabel ?? (director.pressure >= 1 ? 'survival-wall' : 'opening');
}

function timelinePointAt({ minute, cumulativeXp, xpPerSecond, director }) {
  return Object.freeze({
    minute,
    cumulativeXp: Math.round(cumulativeXp),
    level: levelFromCumulativeXp(cumulativeXp),
    xpPerSecond: Number(xpPerSecond.toFixed(2)),
    activeStage: activeStageForDirector(director),
    archetypeMixCount: director.archetypeMixCount ?? 2,
    packCohesion: director.packCohesion ?? 0,
    patternDensity: director.patternDensity ?? 1,
    healthMultiplier: director.healthMultiplier ?? 1,
    damageMultiplier: director.damageMultiplier ?? 1,
    currentThreatBeat: director.currentThreatBeat ?? null,
  });
}

export function simulateHmhRunEconomy({
  minutes = 20,
  skillFactor = 0.9,
  tickSeconds = 1,
  miniBossIntervalSeconds = DEFAULT_MINIBOSS_INTERVAL_SECONDS,
  bossSeconds = DEFAULT_BOSS_SECONDS,
  includeBossXp = true,
  seed = 0,
} = {}) {
  const totalSeconds = Math.max(0, Number(minutes) || 0) * 60;
  const dt = Math.max(0.1, Number(tickSeconds) || 1);
  const clearFactor = clampNumber(skillFactor, 0, 1.25);
  const timeline = [];
  let cumulativeXp = 0;
  let nextMiniBossAt = miniBossIntervalSeconds;
  let bossAwarded = false;

  for (let elapsed = 0; elapsed <= totalSeconds + 1e-9; elapsed += dt) {
    const director = levelOneRoguelikeSpawnDirectorAt(elapsed, { seed });
    const killsPerSecond = (1 / Math.max(0.1, director.spawnIntervalSeconds)) * clearFactor;
    const xpPerSecond = killsPerSecond * xpPerKillAt(director);
    const roundedElapsed = Math.round(elapsed);

    if (Math.abs(elapsed / 60 - Math.round(elapsed / 60)) < dt / 120) {
      timeline.push(timelinePointAt({
        minute: Math.round(elapsed / 60),
        cumulativeXp,
        xpPerSecond,
        director,
      }));
    }

    if (elapsed >= totalSeconds) break;

    cumulativeXp += xpPerSecond * Math.min(dt, totalSeconds - elapsed);

    while (nextMiniBossAt > 0 && elapsed < nextMiniBossAt && elapsed + dt >= nextMiniBossAt && nextMiniBossAt <= totalSeconds) {
      cumulativeXp += DEFAULT_MINIBOSS_XP * clearFactor;
      nextMiniBossAt += miniBossIntervalSeconds;
    }
    if (includeBossXp && !bossAwarded && elapsed < bossSeconds && elapsed + dt >= bossSeconds && bossSeconds <= totalSeconds) {
      cumulativeXp += DEFAULT_BOSS_XP * clearFactor;
      bossAwarded = true;
    }
  }

  const finalDirector = levelOneRoguelikeSpawnDirectorAt(totalSeconds, { seed });
  const finalKillsPerSecond = (1 / Math.max(0.1, finalDirector.spawnIntervalSeconds)) * clearFactor;
  const finalXpPerSecond = finalKillsPerSecond * xpPerKillAt(finalDirector);
  const summary = timelinePointAt({
    minute: Math.round(totalSeconds / 60),
    cumulativeXp,
    xpPerSecond: finalXpPerSecond,
    director: finalDirector,
  });

  return Object.freeze({
    minutes: Number((totalSeconds / 60).toFixed(2)),
    skillFactor: clearFactor,
    tickSeconds: dt,
    seed: Math.floor(Number(seed) || 0),
    threatBeatLog: levelOneThreatBeatSchedule({ seed, minutes: totalSeconds / 60 }),
    timeline: Object.freeze(timeline),
    summary,
  });
}

function cumulativeXpForLevel(targetLevel = ROGUELIKE_LEVEL_CAP) {
  let total = 0;
  for (let level = 1; level < Math.max(1, targetLevel); level += 1) total += roguelikeXpCostForLevel(level);
  return total;
}

function pointForMinute(sim, minute) {
  return sim.timeline.find((point) => point.minute === minute) ?? sim.timeline.at(-1);
}

function capTimingFor(sim) {
  const hit = sim.timeline.find((point) => point.level >= ROGUELIKE_LEVEL_CAP);
  return Object.freeze({
    reached: Boolean(hit),
    minute: hit?.minute ?? null,
    cumulativeXp: hit?.cumulativeXp ?? null,
  });
}

function postCapFor(sim, capXp) {
  const postCapXp = Math.max(0, sim.summary.cumulativeXp - capXp);
  return Object.freeze({
    xp: Math.round(postCapXp),
    scoreBonus: Math.round(postCapXp * POST_CAP_XP_TO_SCORE),
  });
}

export function summarizeHmhLongRunTelemetry({ minutes = 35, skillFactors = [0.75, 0.9, 1], tickSeconds = 1 } = {}) {
  const factors = Object.freeze(skillFactors.map((factor) => clampNumber(factor, 0, 1.25)));
  const labels = ['average', 'strong', 'perfect'];
  const runs = {};
  for (let i = 0; i < factors.length; i += 1) runs[labels[i] ?? `skill${i}`] = simulateHmhRunEconomy({ minutes, skillFactor: factors[i], tickSeconds });

  const capXp = cumulativeXpForLevel(ROGUELIKE_LEVEL_CAP);
  const strong = runs.strong ?? runs[Object.keys(runs)[0]];
  const perfect = runs.perfect ?? runs[Object.keys(runs).at(-1)];
  const flags = [];
  const strong20 = pointForMinute(strong, 20);
  const strong28 = pointForMinute(strong, 28);
  if (!(strong20.level >= 58 && strong20.level <= 70)) flags.push(Object.freeze({ code: 'strong-20-out-of-band', detail: `level=${strong20.level}` }));
  if (!(strong28.level >= 72 && strong28.level <= 80)) flags.push(Object.freeze({ code: 'strong-28-out-of-band', detail: `level=${strong28.level}` }));
  if (!capTimingFor(perfect).reached) flags.push(Object.freeze({ code: 'perfect-run-no-cap', detail: `${minutes}m telemetry did not reach level cap` }));

  return Object.freeze({
    version: 'wave2-long-run-telemetry-v1',
    minutes: Number((Math.max(0, Number(minutes) || 0)).toFixed(2)),
    skillFactors: factors,
    levelCap: ROGUELIKE_LEVEL_CAP,
    capXp,
    bands: Object.freeze({
      strong20,
      strong28,
      average20: pointForMinute(runs.average ?? strong, 20),
      perfect35: pointForMinute(perfect, Math.round(minutes)),
    }),
    capTiming: Object.freeze(Object.fromEntries(Object.entries(runs).map(([label, sim]) => [label, capTimingFor(sim)]))),
    postCap: Object.freeze(Object.fromEntries(Object.entries(runs).map(([label, sim]) => [label, postCapFor(sim, capXp)]))),
    flags: Object.freeze(flags),
  });
}
