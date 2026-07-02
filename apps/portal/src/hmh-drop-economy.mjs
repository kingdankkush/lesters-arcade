import { levelOneRoguelikeSpawnDirectorAt } from './arcade-core.mjs';
import { mulberry32 } from './seeded-rng.mjs';

const freeze = (value) => Object.freeze(value);

const entry = (id, weight, category, rarityScore = 1) => freeze({ id, weight, category, rarityScore });

const TABLES = freeze({
  grunt: freeze([
    entry('xp-gem', 48, 'xp', 0),
    entry('ltc-cache', 20, 'score', 1),
    entry('grenade-crate', 16, 'grenade', 2),
    entry('ammo-cache', 10, 'ammo', 2),
    entry('heal-pack', 5, 'sustain', 3),
    entry('shield-cache', 3, 'sustain', 4),
  ]),
  elite: freeze([
    entry('xp-gem', 24, 'xp', 0),
    entry('ltc-cache', 18, 'score', 1),
    entry('grenade-crate', 15, 'grenade', 2),
    entry('ammo-cache', 9, 'ammo', 2),
    entry('heal-pack', 8, 'sustain', 3),
    entry('shield-cache', 8, 'sustain', 4),
    entry('block-breaker-shells', 7, 'weapon', 5),
    entry('hashstorm-drum', 7, 'weapon', 5),
    entry('magnet-surge', 4, 'utility', 6),
    entry('berserk-candle', 2, 'offense', 8),
    entry('time-dilation', 2, 'utility', 7),
  ]),
  boss: freeze([
    entry('xp-gem', 10, 'xp', 0),
    entry('ltc-cache', 14, 'score', 1),
    entry('grenade-crate', 14, 'grenade', 2),
    entry('heal-pack', 9, 'sustain', 3),
    entry('shield-cache', 9, 'sustain', 4),
    entry('block-breaker-shells', 11, 'weapon', 5),
    entry('hashstorm-drum', 11, 'weapon', 5),
    entry('time-dilation', 9, 'utility', 7),
    entry('berserk-candle', 7, 'offense', 8),
    entry('nuke-liquidation', 3, 'offense', 10),
  ]),
});

export const HMH_LEVEL_ONE_DROP_ECONOMY = freeze({
  version: 'wo-29-level-one-drop-economy-v1',
  seedStream: 'drops',
  tables: TABLES,
  chanceCurve: freeze({
    startChance: 0.145,
    capChance: 0.38,
    tauSeconds: 560,
  }),
  budgetCurve: freeze({
    startPowerUpsPerMinute: 1.9,
    capPowerUpsPerMinute: 4.15,
    tauSeconds: 720,
  }),
});

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function smoothKnobAt(elapsedSeconds, start, cap, tauSeconds, precision = 3) {
  const seconds = Math.max(0, Number(elapsedSeconds) || 0);
  const tau = Math.max(1, Number(tauSeconds) || 1);
  const p = 1 - Math.exp(-seconds / tau);
  return Number((start + (cap - start) * p).toFixed(precision));
}

function expectedKillsPerMinuteAt(elapsedSeconds = 0, skillFactor = 1) {
  const director = levelOneRoguelikeSpawnDirectorAt(elapsedSeconds);
  const clearFactor = clampNumber(skillFactor, 0.25, 1.15);
  return (60 / Math.max(0.25, director.spawnIntervalSeconds || 1)) * clearFactor;
}

export function dropEconomyBandAt({ elapsedSeconds = 0, skillFactor = 1 } = {}) {
  const curve = HMH_LEVEL_ONE_DROP_ECONOMY.chanceCurve;
  const budget = HMH_LEVEL_ONE_DROP_ECONOMY.budgetCurve;
  const normalDropChance = smoothKnobAt(elapsedSeconds, curve.startChance, curve.capChance, curve.tauSeconds, 3);
  const maxPowerUpsPerMinute = smoothKnobAt(elapsedSeconds, budget.startPowerUpsPerMinute, budget.capPowerUpsPerMinute, budget.tauSeconds, 2);
  const expectedKillsPerMinute = expectedKillsPerMinuteAt(elapsedSeconds, skillFactor);
  const budgetedDropChance = Number(Math.min(normalDropChance, maxPowerUpsPerMinute / Math.max(1, expectedKillsPerMinute)).toFixed(3));
  return freeze({
    elapsedSeconds: Math.max(0, Number(elapsedSeconds) || 0),
    normalDropChance,
    budgetedDropChance,
    maxPowerUpsPerMinute,
    expectedKillsPerMinute: Number(expectedKillsPerMinute.toFixed(2)),
  });
}

function weightedPick(table, rng, luck = 1) {
  const safeLuck = clampNumber(luck, 0.35, 3.5);
  const pickOnce = () => {
    const weighted = table.map((candidate) => {
      const rareBias = 1 + (candidate.rarityScore / 10) * Math.max(-0.5, safeLuck - 1);
      const offenseDampener = candidate.category === 'offense' && safeLuck < 1.5 ? 0.55 : 1;
      return { candidate, weight: Math.max(0.01, candidate.weight * rareBias * offenseDampener) };
    });
    const total = weighted.reduce((sum, row) => sum + row.weight, 0);
    let roll = rng() * total;
    for (const row of weighted) {
      roll -= row.weight;
      if (roll <= 0) return row.candidate;
    }
    return weighted.at(-1).candidate;
  };
  let best = pickOnce();
  const extraAttempts = Math.max(0, Math.floor(safeLuck - 1));
  for (let i = 0; i < extraAttempts; i += 1) {
    const next = pickOnce();
    if (next.rarityScore > best.rarityScore) best = next;
  }
  return best;
}

export function rollLevelOnePowerUpDrop({
  seed = 0,
  elapsedSeconds = 0,
  tier = 'grunt',
  luck = 1,
  skillFactor = 1,
  dropChance = null,
} = {}) {
  const safeTier = HMH_LEVEL_ONE_DROP_ECONOMY.tables[tier] ? tier : 'grunt';
  const band = dropEconomyBandAt({ elapsedSeconds, skillFactor });
  const chance = clampNumber(dropChance ?? band.budgetedDropChance, 0, 1);
  const rng = mulberry32(Number(seed) >>> 0);
  const eventRoll = rng();
  if (eventRoll > chance) {
    return freeze({
      didDrop: false,
      dropId: null,
      category: null,
      rarityScore: 0,
      seed: Number(seed) >>> 0,
      tier: safeTier,
      dropChance: chance,
      eventRoll: Number(eventRoll.toFixed(6)),
      band,
    });
  }
  const picked = weightedPick(HMH_LEVEL_ONE_DROP_ECONOMY.tables[safeTier], rng, luck);
  return freeze({
    didDrop: true,
    dropId: picked.id,
    category: picked.category,
    rarityScore: picked.rarityScore,
    seed: Number(seed) >>> 0,
    tier: safeTier,
    dropChance: chance,
    eventRoll: Number(eventRoll.toFixed(6)),
    band,
  });
}

function tierForKill({ seed, eliteShare = 0, boss = false } = {}) {
  if (boss) return 'boss';
  const rng = mulberry32((Number(seed) >>> 0) ^ 0x9e3779b9);
  return rng() < clampNumber(eliteShare, 0, 1) ? 'elite' : 'grunt';
}

export function simulateLevelOneDropEconomy({
  minutes = 20,
  skillFactor = 0.9,
  seed = 1,
  tickSeconds = 1,
  luck = 1,
} = {}) {
  const totalSeconds = Math.max(0, Number(minutes) || 0) * 60;
  const dt = Math.max(0.25, Number(tickSeconds) || 1);
  const clearFactor = clampNumber(skillFactor, 0.25, 1.15);
  const drops = [];
  let killAccumulator = 0;
  let killIndex = 0;

  for (let elapsed = 0; elapsed < totalSeconds; elapsed += dt) {
    const director = levelOneRoguelikeSpawnDirectorAt(elapsed);
    killAccumulator += (dt / Math.max(0.25, director.spawnIntervalSeconds || 1)) * clearFactor;
    while (killAccumulator >= 1) {
      killAccumulator -= 1;
      killIndex += 1;
      const dropSeed = ((Number(seed) >>> 0) + killIndex * 2654435761 + Math.round(elapsed) * 1013904223) >>> 0;
      const tier = tierForKill({ seed: dropSeed, eliteShare: director.eliteEnemyShare ?? 0 });
      const decision = rollLevelOnePowerUpDrop({
        seed: dropSeed,
        elapsedSeconds: elapsed,
        tier,
        luck,
        skillFactor: clearFactor,
      });
      if (decision.didDrop) drops.push(freeze({ elapsedSeconds: Math.round(elapsed), killIndex, ...decision }));
    }
  }

  return freeze({
    version: HMH_LEVEL_ONE_DROP_ECONOMY.version,
    minutes: Number((totalSeconds / 60).toFixed(2)),
    skillFactor: clearFactor,
    seed: Number(seed) >>> 0,
    killCount: killIndex,
    drops: freeze(drops),
  });
}

export function summarizeDropEconomy(simulation = {}) {
  const drops = Array.isArray(simulation.drops) ? simulation.drops : [];
  const categories = {};
  const ids = new Set();
  for (const drop of drops) {
    if (drop.category) categories[drop.category] = (categories[drop.category] ?? 0) + 1;
    if (drop.dropId) ids.add(drop.dropId);
  }
  const minutes = Math.max(0.01, Number(simulation.minutes) || 0.01);
  return freeze({
    version: simulation.version ?? HMH_LEVEL_ONE_DROP_ECONOMY.version,
    minutes: simulation.minutes ?? 0,
    totalDrops: drops.length,
    dropsPerMinute: Number((drops.length / minutes).toFixed(2)),
    killCount: simulation.killCount ?? 0,
    dropPerKill: Number((drops.length / Math.max(1, simulation.killCount ?? 0)).toFixed(3)),
    uniqueIds: ids.size,
    categories: freeze(categories),
  });
}
