import {
  HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE,
  HMH_LEVEL_ONE_PLAYTEST_BALANCE,
  POST_CAP_XP_TO_SCORE,
  ROGUELIKE_LEVEL_CAP,
  applyRoguelikeSkillUpgrade,
  calculateRoguelikeKillXp,
  chooseRoguelikeUpgradeOptions,
  createRoguelikeRunState,
  grantRoguelikeXp,
  levelOneRoguelikeDropChance,
  levelOneRoguelikePerformanceBudgetAt,
  levelOneRoguelikePickupAssistAt,
  levelOneRoguelikeSpawnDirectorAt,
} from './arcade-core.mjs';
import {
  HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES,
  playableCharacterStatIdentityFor,
} from './hmh-character-config.mjs';
import { buildUpgradeRuntimePolicy, evolutionScoreMultiplier } from './hmh-upgrade-runtime.mjs';

export const HMH_LONG_RUN_HERO_IDS = Object.freeze(Object.keys(HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES));
export const HMH_LONG_RUN_CHECKPOINT_SECONDS = Object.freeze([5, 10, 20, 30, 45].map((minutes) => minutes * 60));
export const HMH_LONG_RUN_SCHEMA_VERSION = 1;

export const HMH_CERTIFIED_BUILD_PROFILES = Object.freeze([
  Object.freeze({ id: 'settler-rail', title: 'Settler Rail', heroId: 'lester', preferredSkillIds: Object.freeze(['damage-alpha', 'pierce', 'rate-of-fire', 'evolve-settler-rail']) }),
  Object.freeze({ id: 'hashstorm-overdrive', title: 'Hashstorm Overdrive', heroId: 'lit-commando', preferredSkillIds: Object.freeze(['rate-of-fire', 'magazine-size', 'reload-hands', 'evolve-hashstorm-overdrive']) }),
  Object.freeze({ id: 'crit-candle', title: 'Crit Candle', heroId: 'lit-valkyrie', preferredSkillIds: Object.freeze(['critical-chance', 'critical-damage', 'projectile-speed', 'evolve-crit-candle']) }),
  Object.freeze({ id: 'crypto-bomb-orbit', title: 'Crypto Bomb Orbit', heroId: 'lilly', preferredSkillIds: Object.freeze(['grenade-capacity', 'grenade-damage', 'grenade-radius', 'launcher-rig', 'homing-cluster', 'block-buster', 'evolve-crypto-bomb-orbit']) }),
  Object.freeze({ id: 'wasteland-bulwark', title: 'Wasteland Bulwark', heroId: 'lit-commando', preferredSkillIds: Object.freeze(['max-health', 'armor', 'health-regen', 'revive', 'combo-retention']) }),
  Object.freeze({ id: 'velocity-dividend', title: 'Velocity Dividend', heroId: 'lit-valkyrie', preferredSkillIds: Object.freeze(['dash-cooldown', 'dash-distance', 'move-speed', 'pickup-radius', 'xp-gain', 'power-up-luck', 'coin-value']) }),
]);

const MAX_PROJECTILES = 512;
const MAX_TRACKED_OBJECTS = HMH_LEVEL_ONE_PLAYTEST_BALANCE.director.maxEnemiesCap
  + HMH_LEVEL_ONE_PLAYTEST_BALANCE.pickupAssist.maxLooseXpGems
  + HMH_LEVEL_ONE_PLAYTEST_BALANCE.pickupAssist.maxLoosePowerUps
  + MAX_PROJECTILES;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round((Number(value) || 0) * scale) / scale;
}

function createPrng(seed = 1) {
  let state = (Math.floor(Number(seed) || 1) >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function digestValue(value) {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function median(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function bossBeatsAtSecond(second) {
  return HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE.filter((beat) => beat.startSeconds === second);
}

function majorBossBeat(beat) {
  return beat.type === 'major-boss' || beat.type === 'major-rematch' || beat.id.includes('major');
}

function chooseAndApplyUpgrade(run, seed, preferredSkillIds = []) {
  if (!run.pausedForLevelUp) return { run, applied: null };
  let fallback = null;
  let option = null;
  for (let attempt = 0; attempt < 12 && !option; attempt += 1) {
    const draft = chooseRoguelikeUpgradeOptions(run, { seed: seed + run.level * 997 + attempt * 131 });
    const legal = draft.options.filter((entry) => entry?.id && entry.id !== 'post-cap-coins');
    fallback ??= legal[0] ?? null;
    option = preferredSkillIds
      .map((id) => legal.find((entry) => entry.id === id))
      .find(Boolean) ?? null;
  }
  option ??= fallback;
  if (!option) {
    run.pausedForLevelUp = false;
    run.pendingUpgradeChoices = 0;
    return { run, applied: 'post-cap-coins' };
  }
  return { run: applyRoguelikeSkillUpgrade(run, option.id), applied: option.id };
}

function heroModel(heroId) {
  const identity = playableCharacterStatIdentityFor(heroId);
  if (!identity) throw new Error(`Unknown Hard Money Heroes character: ${heroId}`);
  const multipliers = identity.simMultipliers ?? {};
  const offense = (multipliers.damage ?? 1)
    * (multipliers.rateOfFire ?? 1)
    * (1 + ((multipliers.movingFireRate ?? 1) - 1) * 0.65)
    * (1 + ((multipliers.criticalChance ?? 1) - 1) * 0.45);
  const mobility = multipliers.movementSpeed ?? 1;
  const armor = multipliers.armor ?? 1;
  return Object.freeze({ identity, offense, mobility, armor });
}

function checkpointFor(state, elapsedSeconds, run) {
  const policy = buildUpgradeRuntimePolicy(run.stats);
  return Object.freeze({
    elapsedSeconds,
    level: run.level,
    xp: round(run.xp),
    postCapScoreBonus: run.postCapScoreBonus,
    score: Math.round((state.score + run.postCapScoreBonus) * policy.scoreMultiplier),
    kills: state.kills,
    killsPerMinute: round(state.kills / Math.max(1, elapsedSeconds / 60), 2),
    activeEnemies: state.activeEnemies,
    bossesDefeated: state.bossesDefeated,
    health: round(state.health, 2),
    droppedPickups: state.droppedPickups,
    collectedPickups: state.collectedPickups,
    trackedObjects: state.trackedObjects,
  });
}

export function simulateHmhLongRun({
  heroId = 'lit-commando',
  seed = 1337,
  durationSeconds = 30 * 60,
  checkpointSeconds = HMH_LONG_RUN_CHECKPOINT_SECONDS,
  preferredSkillIds = [],
} = {}) {
  const safeDuration = Math.max(1, Math.floor(Number(durationSeconds) || 1));
  const safeSeed = Math.floor(Number(seed) || 1);
  const hero = heroModel(heroId);
  const random = createPrng(safeSeed ^ digestValue(heroId).charCodeAt(0));
  let run = createRoguelikeRunState({ seed: safeSeed, characterId: heroId, mode: 'free' });
  const startingMaxHealth = Math.max(1, Math.round(100 * (Number(run.stats.maxHealth) || 1)));
  const checkpointsWanted = new Set(checkpointSeconds.filter((seconds) => seconds > 0 && seconds <= safeDuration));
  const checkpoints = [];
  const upgrades = [];
  const triggeredBossBeats = [];
  let spawnAccumulator = 0;
  let looseXpGems = 0;
  let loosePowerUps = 0;
  let terminalReason = 'time-limit';

  const state = {
    elapsedSeconds: 0,
    health: startingMaxHealth,
    maxHealth: startingMaxHealth,
    kills: 0,
    score: 0,
    activeEnemies: 0,
    projectiles: 0,
    trackedObjects: 0,
    droppedPickups: 0,
    collectedPickups: 0,
    xpCollected: 0,
    damageTaken: 0,
    healthRecovered: 0,
    bossesDefeated: 0,
    miniBossesDefeated: 0,
    revivesUsed: 0,
    maxima: { activeEnemies: 0, projectiles: 0, looseXpGems: 0, loosePowerUps: 0, totalTrackedObjects: 0 },
  };

  for (let second = 1; second <= safeDuration; second += 1) {
    const director = levelOneRoguelikeSpawnDirectorAt(second, { seed: safeSeed });
    const upgradePolicy = buildUpgradeRuntimePolicy(run.stats);
    const nextMaxHealth = Math.max(1, Math.round(100 * (Number(run.stats.maxHealth) || 1)));
    if (nextMaxHealth > state.maxHealth) state.health += nextMaxHealth - state.maxHealth;
    state.maxHealth = nextMaxHealth;
    state.health = Math.min(state.health, state.maxHealth);
    spawnAccumulator += 1 / Math.max(0.05, director.spawnIntervalSeconds);
    let spawned = Math.floor(spawnAccumulator);
    spawnAccumulator -= spawned;
    spawned = Math.max(0, Math.min(spawned, director.maxEnemiesOnMap - state.activeEnemies));
    state.activeEnemies += spawned;

    const buildDamage = Number(run.stats.damage) || 1;
    const buildFireRate = upgradePolicy.fireRateMultiplier;
    const expectedCritDamage = 1 + (0.08 + upgradePolicy.critChanceBonus) * (0.75 + upgradePolicy.critDamageBonus);
    const grenadePressure = 1
      + Math.max(0, (Number(run.stats.grenadeDamage) || 1) - 1) * 0.16
      + Math.max(0, (Number(run.stats.grenadeRadius) || 1) - 1) * 0.1
      + Math.max(0, Number(run.stats.grenadeCapacity) || 0) * 0.015;
    const killRatePerSecond = (0.13 + director.pressure * 0.215)
      * hero.offense
      * buildDamage
      * buildFireRate
      * expectedCritDamage
      * grenadePressure
      / Math.max(1, director.healthMultiplier * 0.82);
    const killBudget = killRatePerSecond + random() * 0.42;
    const killsThisSecond = Math.min(state.activeEnemies, Math.floor(killBudget) + (random() < killBudget % 1 ? 1 : 0));
    state.activeEnemies -= killsThisSecond;

    for (let kill = 0; kill < killsThisSecond; kill += 1) {
      const elite = random() < director.eliteEnemyShare;
      const xpValue = calculateRoguelikeKillXp({ score: elite ? 150 : 80, elite });
      const dropChance = clamp(
        levelOneRoguelikeDropChance({ elapsedSeconds: second }) * (Number(run.stats.luck) || 1),
        0,
        0.95,
      );
      const assist = levelOneRoguelikePickupAssistAt({ elapsedSeconds: second, activeEnemies: state.activeEnemies });
      const collectionChance = clamp(0.72 + (assist.xpAttractRadiusMultiplier - 1) * 0.14 + (hero.mobility - 1) * 0.2, 0.64, 0.98);
      looseXpGems += 1;
      state.droppedPickups += 1;
      if (random() < collectionChance) {
        looseXpGems = Math.max(0, looseXpGems - 1);
        state.collectedPickups += 1;
        state.xpCollected += xpValue;
        run = grantRoguelikeXp(run, xpValue);
        const upgraded = chooseAndApplyUpgrade(run, safeSeed + second + kill, preferredSkillIds);
        run = upgraded.run;
        if (upgraded.applied) upgrades.push(upgraded.applied);
      }
      if (random() < dropChance * 0.18) {
        loosePowerUps += 1;
        state.droppedPickups += 1;
        const powerCollectionChance = clamp(collectionChance - 0.05, 0.55, 0.94);
        if (random() < powerCollectionChance) {
          loosePowerUps = Math.max(0, loosePowerUps - 1);
          state.collectedPickups += 1;
          const recovery = Math.min(state.maxHealth - state.health, 3 + random() * 5);
          state.health += recovery;
          state.healthRecovered += recovery;
        }
      }
      state.kills += 1;
      state.score += Math.round((elite ? 180 : 90) * (1 + director.pressure * 0.5));
    }

    for (const beat of bossBeatsAtSecond(second)) {
      triggeredBossBeats.push(beat.id);
      const isMajor = majorBossBeat(beat);
      const bossXp = isMajor ? 115 : 62 * 2;
      run = grantRoguelikeXp(run, bossXp);
      let upgraded = chooseAndApplyUpgrade(run, safeSeed + second + beat.pressureTier, preferredSkillIds);
      run = upgraded.run;
      if (upgraded.applied) upgrades.push(upgraded.applied);
      if (isMajor) state.bossesDefeated += 1;
      else state.miniBossesDefeated += 2;
      const bossScoreMultiplier = isMajor ? (hero.identity.signature?.bossScoreMultiplier ?? 1) : 1;
      state.score += isMajor ? 5000 * beat.pressureTier * bossScoreMultiplier : 1800 * beat.pressureTier;
      const signatureRecovery = isMajor ? (hero.identity.signature?.bossRecoveryFraction ?? 0) : 0;
      const rewardRecovery = Math.min(
        state.maxHealth - state.health,
        state.maxHealth * ((isMajor ? 0.18 : 0.08) + signatureRecovery),
      );
      state.health += rewardRecovery;
      state.healthRecovered += rewardRecovery;
    }

    const activeRatio = state.activeEnemies / Math.max(1, director.maxEnemiesOnMap);
    const dashEvasion = 1 + Math.max(0, upgradePolicy.dashDistanceMultiplier - 1) * 0.18
      + Math.max(0, 2.2 / upgradePolicy.dashCooldownSeconds - 1) * 0.12;
    const evasion = clamp(hero.mobility * (Number(run.stats.movementSpeed) || 1) * dashEvasion, 0.7, 1.8);
    const armor = clamp(hero.armor * (Number(run.stats.armor) || 1), 0.7, 1.6);
    const incoming = director.pressure
      * activeRatio
      * director.damageMultiplier
      * (Number(run.stats.incomingDamage) || 1)
      * (0.09 + director.rangedEnemyShare * 0.11)
      * (0.82 + random() * 0.36)
      / (evasion * armor);
    state.health -= incoming;
    state.damageTaken += incoming;
    if (upgradePolicy.healthRegenPerSecond > 0 && state.health > 0) {
      const recovery = Math.min(state.maxHealth - state.health, upgradePolicy.healthRegenPerSecond);
      state.health += recovery;
      state.healthRecovered += recovery;
    }

    looseXpGems = Math.min(looseXpGems, HMH_LEVEL_ONE_PLAYTEST_BALANCE.pickupAssist.maxLooseXpGems);
    loosePowerUps = Math.min(loosePowerUps, HMH_LEVEL_ONE_PLAYTEST_BALANCE.pickupAssist.maxLoosePowerUps);
    const performance = levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds: second, activeEnemies: state.activeEnemies });
    state.projectiles = Math.min(MAX_PROJECTILES, Math.round(state.activeEnemies * director.rangedEnemyShare * director.patternDensity * 1.6));
    state.trackedObjects = state.activeEnemies + looseXpGems + loosePowerUps + state.projectiles;
    state.maxima.activeEnemies = Math.max(state.maxima.activeEnemies, state.activeEnemies);
    state.maxima.projectiles = Math.max(state.maxima.projectiles, state.projectiles);
    state.maxima.looseXpGems = Math.max(state.maxima.looseXpGems, looseXpGems);
    state.maxima.loosePowerUps = Math.max(state.maxima.loosePowerUps, loosePowerUps);
    state.maxima.totalTrackedObjects = Math.max(state.maxima.totalTrackedObjects, state.trackedObjects);
    state.elapsedSeconds = second;
    state.score += 2;

    if (state.health <= 0) {
      if (state.revivesUsed < upgradePolicy.reviveCharges) {
        state.revivesUsed += 1;
        state.health = Math.round(state.maxHealth * 0.35);
      } else {
        state.health = 0;
        terminalReason = 'hero-defeated';
      }
    }
    if (checkpointsWanted.has(second)) checkpoints.push(checkpointFor(state, second, run));
    if (terminalReason !== 'time-limit') break;

    void performance;
  }

  const finalPolicy = buildUpgradeRuntimePolicy(run.stats);
  const finalEvolutionMultiplier = evolutionScoreMultiplier(finalPolicy, hero.identity.startingWeaponId);
  const final = Object.freeze({
    elapsedSeconds: state.elapsedSeconds,
    level: run.level,
    xp: round(run.xp),
    xpToNextLevel: run.xpToNextLevel,
    maxLevelReached: run.maxLevelReached,
    postCapXpToScore: POST_CAP_XP_TO_SCORE,
    postCapScoreBonus: run.postCapScoreBonus,
    score: Math.round((state.score + run.postCapScoreBonus) * finalPolicy.scoreMultiplier * finalEvolutionMultiplier),
    kills: state.kills,
    killsPerMinute: round(state.kills / Math.max(1, state.elapsedSeconds / 60), 2),
    bossesDefeated: state.bossesDefeated,
    miniBossesDefeated: state.miniBossesDefeated,
    health: round(state.health, 2),
    maxHealth: round(state.maxHealth, 2),
    damageTaken: round(state.damageTaken, 2),
    healthRecovered: round(state.healthRecovered, 2),
    revivesUsed: state.revivesUsed,
    upgradesTaken: upgrades.length,
    uniqueUpgrades: new Set(upgrades).size,
    droppedPickups: state.droppedPickups,
    collectedPickups: state.collectedPickups,
    collectionRate: round(state.collectedPickups / Math.max(1, state.droppedPickups), 3),
    activeEnemies: state.activeEnemies,
    projectiles: state.projectiles,
    trackedObjects: state.trackedObjects,
  });
  const limits = Object.freeze({
    maxEnemies: HMH_LEVEL_ONE_PLAYTEST_BALANCE.director.maxEnemiesCap,
    maxLooseXpGems: HMH_LEVEL_ONE_PLAYTEST_BALANCE.pickupAssist.maxLooseXpGems,
    maxLoosePowerUps: HMH_LEVEL_ONE_PLAYTEST_BALANCE.pickupAssist.maxLoosePowerUps,
    maxProjectiles: MAX_PROJECTILES,
    maxTrackedObjects: MAX_TRACKED_OBJECTS,
  });
  const result = {
    schemaVersion: HMH_LONG_RUN_SCHEMA_VERSION,
    model: 'deterministic-baseline-player-balance-simulation',
    heroId,
    seed: safeSeed,
    requestedDurationSeconds: safeDuration,
    terminalReason,
    checkpoints: Object.freeze(checkpoints),
    triggeredBossBeats: Object.freeze(triggeredBossBeats),
    upgradeHistory: Object.freeze(upgrades),
    maxima: Object.freeze({ ...state.maxima }),
    limits,
    final,
  };
  return Object.freeze({ ...result, digest: digestValue(result) });
}

function runIsValid(run) {
  const text = JSON.stringify(run);
  return !/undefined|NaN|Infinity/.test(text)
    && run.maxima.activeEnemies <= run.limits.maxEnemies
    && run.maxima.looseXpGems <= run.limits.maxLooseXpGems
    && run.maxima.loosePowerUps <= run.limits.maxLoosePowerUps
    && run.maxima.projectiles <= run.limits.maxProjectiles
    && run.maxima.totalTrackedObjects <= run.limits.maxTrackedObjects;
}

export function buildHmhUpgradeBuildCertification({
  profiles = HMH_CERTIFIED_BUILD_PROFILES,
  seeds = Object.freeze([2301, 2302, 2303, 2304, 2305]),
  durationSeconds = 30 * 60,
} = {}) {
  const builds = profiles.map((profile) => {
    const runs = seeds.map((seed) => simulateHmhLongRun({
      heroId: profile.heroId,
      seed,
      durationSeconds,
      preferredSkillIds: profile.preferredSkillIds,
    }));
    const selected = new Set(runs.flatMap((run) => run.upgradeHistory));
    const preferredSelected = profile.preferredSkillIds.filter((id) => selected.has(id));
    const completedRuns = runs.filter((run) => run.terminalReason === 'time-limit').length;
    const validRuns = runs.filter(runIsValid).length;
    const minimumBossesDefeated = Math.min(...runs.map((run) => run.final.bossesDefeated));
    const medianKillsPerMinute = round(median(runs.map((run) => run.final.killsPerMinute)), 2);
    const passed = completedRuns === runs.length
      && validRuns === runs.length
      && minimumBossesDefeated >= 4
      && medianKillsPerMinute >= 8
      && preferredSelected.length >= 3;
    return Object.freeze({
      id: profile.id,
      title: profile.title,
      heroId: profile.heroId,
      passed,
      runs: runs.length,
      completedRuns,
      validRuns,
      minimumBossesDefeated,
      medianKillsPerMinute,
      medianScore: Math.round(median(runs.map((run) => run.final.score))),
      preferredSelected: Object.freeze(preferredSelected),
      runDigests: Object.freeze(runs.map((run) => run.digest)),
    });
  });
  return Object.freeze({
    schemaVersion: HMH_LONG_RUN_SCHEMA_VERSION,
    model: 'deterministic-preferred-draft-build-certification',
    durationSeconds,
    seeds: Object.freeze([...seeds]),
    passed: builds.every((build) => build.passed),
    builds: Object.freeze(builds),
  });
}

export function buildHmhLongRunCertification({
  heroIds = HMH_LONG_RUN_HERO_IDS,
  seeds = Array.from({ length: 10 }, (_, index) => 1337 + index),
  durationSeconds = 30 * 60,
} = {}) {
  const runs = heroIds.flatMap((heroId) => seeds.map((seed) => simulateHmhLongRun({ heroId, seed, durationSeconds })));
  const heroSummaries = heroIds.map((heroId) => {
    const heroRuns = runs.filter((run) => run.heroId === heroId);
    return Object.freeze({
      heroId,
      runs: heroRuns.length,
      medianScore: Math.round(median(heroRuns.map((run) => run.final.score))),
      medianKills: Math.round(median(heroRuns.map((run) => run.final.kills))),
      medianLevel: round(median(heroRuns.map((run) => run.final.level)), 1),
      survivalRate: round(heroRuns.filter((run) => run.terminalReason === 'time-limit').length / Math.max(1, heroRuns.length), 3),
      minimumBossesDefeated: Math.min(...heroRuns.map((run) => run.final.bossesDefeated)),
    });
  });
  const medianScores = heroSummaries.map((entry) => entry.medianScore);
  const meanMedianScore = medianScores.reduce((sum, score) => sum + score, 0) / Math.max(1, medianScores.length);
  const scoreSpreadPct = round(((Math.max(...medianScores) - Math.min(...medianScores)) / Math.max(1, meanMedianScore)) * 100, 2);
  const validRuns = runs.filter(runIsValid);
  const completedRuns = runs.filter((run) => run.terminalReason === 'time-limit');
  const report = {
    schemaVersion: HMH_LONG_RUN_SCHEMA_VERSION,
    generatedBy: 'npm run design:long-run',
    model: 'deterministic-baseline-player-balance-simulation',
    durationSeconds,
    heroIds: Object.freeze([...heroIds]),
    seeds: Object.freeze([...seeds]),
    runs: Object.freeze(runs),
    heroSummaries: Object.freeze(heroSummaries),
    summary: Object.freeze({
      totalRuns: runs.length,
      validRuns: validRuns.length,
      invalidRuns: runs.length - validRuns.length,
      completedRuns: completedRuns.length,
      survivalRate: round(completedRuns.length / Math.max(1, runs.length), 3),
      scoreSpreadPct,
      minimumBossesDefeated: Math.min(...runs.map((run) => run.final.bossesDefeated)),
      maximumTrackedObjects: Math.max(...runs.map((run) => run.maxima.totalTrackedObjects)),
      levelCap: ROGUELIKE_LEVEL_CAP,
    }),
  };
  return Object.freeze({ ...report, digest: digestValue(report) });
}
