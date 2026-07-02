import {
  calculateRoguelikeKillXp,
  levelOneRoguelikeSpawnDirectorAt,
  roguelikeXpCostForLevel,
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

export function levelFromCumulativeXp(cumulativeXp = 0, { maxLevel = 10_000 } = {}) {
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
  });
}

export function simulateHmhRunEconomy({
  minutes = 20,
  skillFactor = 0.9,
  tickSeconds = 1,
  miniBossIntervalSeconds = DEFAULT_MINIBOSS_INTERVAL_SECONDS,
  bossSeconds = DEFAULT_BOSS_SECONDS,
  includeBossXp = true,
} = {}) {
  const totalSeconds = Math.max(0, Number(minutes) || 0) * 60;
  const dt = Math.max(0.1, Number(tickSeconds) || 1);
  const clearFactor = clampNumber(skillFactor, 0, 1.25);
  const timeline = [];
  let cumulativeXp = 0;
  let nextMiniBossAt = miniBossIntervalSeconds;
  let bossAwarded = false;

  for (let elapsed = 0; elapsed <= totalSeconds + 1e-9; elapsed += dt) {
    const director = levelOneRoguelikeSpawnDirectorAt(elapsed);
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

  const finalDirector = levelOneRoguelikeSpawnDirectorAt(totalSeconds);
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
    timeline: Object.freeze(timeline),
    summary,
  });
}
