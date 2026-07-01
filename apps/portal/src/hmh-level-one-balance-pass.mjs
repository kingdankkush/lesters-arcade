import {
  HMH_LEVEL_ONE_PLAYTEST_BALANCE,
  levelOneRoguelikeDropChance,
  levelOneRoguelikeSpawnDirectorAt,
  roguelikeXpCostForLevel,
} from './arcade-core.mjs';

export const LEVEL_ONE_BALANCE_RECOMMENDATION_AREAS = Object.freeze([
  'telemetry-harness',
  'xp-leveling-curve',
  'enemy-role-spawn-composition',
  'mini-boss-final-boss-choreography',
  'weapon-upgrade-build-variety',
  'player-damage-recovery-feel',
]);

const ACT_WINDOWS = Object.freeze([
  Object.freeze({ id: 'safe-road-controls', start: 0, end: 90, label: 'Safe Road / Controls Read' }),
  Object.freeze({ id: 'ghost-saloon-mainstreet-duel', start: 90, end: 180, label: 'Ghost Saloon Main Street Duel' }),
  Object.freeze({ id: 'forest-shoreline-ford-loop', start: 180, end: 300, label: 'Forest Grove / Shoreline Ford Loop' }),
  Object.freeze({ id: 'desert-gas-yard-pressure', start: 300, end: 435, label: 'Desert Cache / Gas Yard Pressure' }),
  Object.freeze({ id: 'rugpull-boss-yard-extraction', start: 435, end: 480, label: 'Rugpull Boss Yard / Extraction Reveal' }),
]);

const COMPOSITION_BY_ACT = Object.freeze({
  'safe-road-controls': Object.freeze({
    minSpawnDistanceTiles: 18,
    rangedEnemyShare: 0.12,
    eliteEnemyShare: 0,
    genericSpawnSuppression: false,
    spawnLaneTags: Object.freeze(['front-road', 'rear-shoulder']),
    roles: Object.freeze([
      Object.freeze({ id: 'tutorial-chaser', share: 0.72, read: 'slow readable chase pressure' }),
      Object.freeze({ id: 'coin-lane-pickup', share: 0.28, read: 'reward lane teaching' }),
    ]),
  }),
  'ghost-saloon-mainstreet-duel': Object.freeze({
    minSpawnDistanceTiles: 20,
    rangedEnemyShare: 0.26,
    eliteEnemyShare: 0.08,
    genericSpawnSuppression: false,
    spawnLaneTags: Object.freeze(['saloon-cover-left', 'mainstreet-right', 'storefront-porch']),
    roles: Object.freeze([
      Object.freeze({ id: 'cover-shooter', share: 0.38, read: 'rifle enemies staged around saloon cover' }),
      Object.freeze({ id: 'lane-chaser', share: 0.42, read: 'front pressure from the main street' }),
      Object.freeze({ id: 'cache-guard', share: 0.2, read: 'risk/reward guard near breakable props' }),
    ]),
  }),
  'forest-shoreline-ford-loop': Object.freeze({
    minSpawnDistanceTiles: 20,
    rangedEnemyShare: 0.18,
    eliteEnemyShare: 0.11,
    genericSpawnSuppression: false,
    spawnLaneTags: Object.freeze(['tree-line-left', 'shoreline-ford', 'mushroom-ring']),
    roles: Object.freeze([
      Object.freeze({ id: 'animal-rusher', share: 0.52, read: 'boar/coyote rushers telegraphed by forest edge' }),
      Object.freeze({ id: 'spore-herder', share: 0.28, read: 'pressure around mushroom hazard pulse' }),
      Object.freeze({ id: 'ford-blocker', share: 0.2, read: 'slow bodies at bridge/fording lane' }),
    ]),
  }),
  'desert-gas-yard-pressure': Object.freeze({
    minSpawnDistanceTiles: 21,
    rangedEnemyShare: 0.32,
    eliteEnemyShare: 0.18,
    genericSpawnSuppression: false,
    spawnLaneTags: Object.freeze(['desert-cache', 'gas-pump-chain', 'warehouse-crates']),
    roles: Object.freeze([
      Object.freeze({ id: 'explosive-ranged', share: 0.34, read: 'ranged enemies tempt gas-pump chain detonations' }),
      Object.freeze({ id: 'crate-flanker', share: 0.31, read: 'flankers that move around warehouse cover' }),
      Object.freeze({ id: 'cache-taxman', share: 0.35, read: 'reward pressure around Litecoin cache' }),
    ]),
  }),
  'rugpull-boss-yard-extraction': Object.freeze({
    minSpawnDistanceTiles: 24,
    rangedEnemyShare: 0.24,
    eliteEnemyShare: 0.2,
    genericSpawnSuppression: true,
    spawnLaneTags: Object.freeze(['boss-gate', 'warning-sign', 'extraction-flare']),
    roles: Object.freeze([
      Object.freeze({ id: 'boss-guard', share: 0.25, read: 'small guard wave before boss patterns' }),
      Object.freeze({ id: 'boss-pattern-space', share: 0.55, read: 'empty space preserved for boss tells' }),
      Object.freeze({ id: 'extraction-lane-holder', share: 0.2, read: 'final pressure without spawn soup' }),
    ]),
  }),
});

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function actForSeconds(elapsedSeconds = 0) {
  const seconds = clamp(elapsedSeconds, 0, HMH_LEVEL_ONE_PLAYTEST_BALANCE.targetSessionSeconds);
  return ACT_WINDOWS.find((act) => seconds >= act.start && seconds < act.end) ?? ACT_WINDOWS.at(-1);
}

function targetLevelForXp(totalXp = 0) {
  let level = 1;
  let remaining = Math.max(0, Number(totalXp) || 0);
  while (level < 20 && remaining >= roguelikeXpCostForLevel(level)) {
    remaining -= roguelikeXpCostForLevel(level);
    level += 1;
  }
  return level;
}

export function levelOneBalanceRecommendationAreas() {
  return LEVEL_ONE_BALANCE_RECOMMENDATION_AREAS;
}

export function buildLevelOneSpawnCompositionAt(elapsedSeconds = 0) {
  const act = actForSeconds(elapsedSeconds);
  const director = levelOneRoguelikeSpawnDirectorAt(elapsedSeconds);
  const composition = COMPOSITION_BY_ACT[act.id];
  return Object.freeze({
    actId: act.id,
    actLabel: act.label,
    elapsedSeconds: Math.max(0, Math.round(Number(elapsedSeconds) || 0)),
    minSpawnDistanceTiles: composition.minSpawnDistanceTiles,
    rangedEnemyShare: Math.min(composition.rangedEnemyShare, director.rangedEnemyShare),
    eliteEnemyShare: Math.max(composition.eliteEnemyShare, director.eliteEnemyShare * 0.65),
    genericSpawnSuppression: composition.genericSpawnSuppression,
    spawnLaneTags: composition.spawnLaneTags,
    roles: composition.roles,
  });
}

export function levelOneXpPacingPlan({ killsPerMinute = 20, cacheOpens = 2, miniBossKills = 2 } = {}) {
  const kpm = Math.max(0, Number(killsPerMinute) || 0);
  const killXpAtEight = kpm * 8 * 11.5;
  const cacheXp = Math.max(0, Number(cacheOpens) || 0) * 85;
  const bossXp = Math.max(0, Number(miniBossKills) || 0) * 62;
  const totalXp = killXpAtEight + cacheXp + bossXp;
  return Object.freeze({
    firstUpgradeTargetWindowSeconds: Object.freeze([45, 75]),
    firstUpgradeExpectedSeconds: 58,
    targetLevelAtEightMinutes: Math.max(7, targetLevelForXp(totalXp)),
    totalExpectedXpAtEightMinutes: Math.round(totalXp),
    killXpAtEightMinutes: Math.round(killXpAtEight),
    cacheXpAtEightMinutes: Math.round(cacheXp),
    miniBossXpAtEightMinutes: Math.round(bossXp),
    guardrails: Object.freeze([
      'first upgrade should arrive after the player understands movement but before the first POI lock',
      'cache XP should feel valuable without chaining multiple level-ups by itself',
      'one enemy pack must still pause after one level-up through grantRoguelikeXp',
    ]),
  });
}

export function buildLevelOneBossChoreographyPlan() {
  return Object.freeze({
    miniBosses: Object.freeze([
      Object.freeze({ poiId: 'ghost-saloon-mainstreet', title: 'Claim-Jumper Sheriff', phaseCount: 2, telegraphFrames: 48, addWindowSeconds: [0, 12], counterplay: 'break saloon cover/cache before crossing main street', rewardHook: 'saloon cache + first strong upgrade pacing' }),
      Object.freeze({ poiId: 'dead-forest-mushroom-grove', title: 'Scam Cult Zealot Alpha', phaseCount: 2, telegraphFrames: 54, addWindowSeconds: [8, 20], counterplay: 'bait rushers through mushroom pulse downtime', rewardHook: 'spore resistance/mobility read' }),
      Object.freeze({ poiId: 'warehouse-gas-station-yard', title: 'Gas Beast Tank', phaseCount: 2, telegraphFrames: 50, addWindowSeconds: [5, 18], counterplay: 'chain gas pump detonation into boss armor window', rewardHook: 'grenade/chain economy payoff' }),
    ]),
    finalBoss: Object.freeze({
      poiId: 'rugpull-gulch-boss-yard',
      title: 'Bandit Captain / Rugpull Baron Proxy',
      phases: Object.freeze([
        Object.freeze({ id: 'gate-warning', hpPct: [100, 66], telegraphFrames: 60, addWaveSuppression: true, pattern: 'rifle fan + warning sign tell', counterplay: 'use boss gate/warning sign lane to read volleys' }),
        Object.freeze({ id: 'panic-crossfire', hpPct: [66, 33], telegraphFrames: 54, addWaveSuppression: false, pattern: 'short guard pair then crossfire', counterplay: 'clear guards before pushing extraction lane' }),
        Object.freeze({ id: 'extraction-break', hpPct: [33, 0], telegraphFrames: 72, addWaveSuppression: true, pattern: 'long windup, fewer adds, stronger boss shots', counterplay: 'survive the tell, then punish during recovery' }),
      ]),
      onDefeat: Object.freeze({ unlocksGate: true, activatesExtractionFlare: true, suppressesGenericSpawns: true }),
    }),
  });
}

export function buildLevelOneUpgradeVarietyPlan() {
  const mechanicCards = Object.freeze([
    Object.freeze({ id: 'saloon-ricochet', mechanic: 'shots glance through saloon/warehouse lanes', stat: 'pierce' }),
    Object.freeze({ id: 'gas-chain-refund', mechanic: 'gas-pump chain kills refund grenade tempo', stat: 'grenadeCooldown' }),
    Object.freeze({ id: 'spore-filter', mechanic: 'mushroom pulse slow/damage is easier to route around', stat: 'armor' }),
    Object.freeze({ id: 'cache-magnet', mechanic: 'Litecoin cache rewards pull harder and stay readable', stat: 'pickupRadius' }),
    Object.freeze({ id: 'boss-yard-breaker', mechanic: 'boss gate/final boss damage windows hit harder', stat: 'bossDamage' }),
    Object.freeze({ id: 'ford-line-dash', mechanic: 'short safer dashes through ford/bridge chokepoints', stat: 'dashDistance' }),
  ]);
  return Object.freeze({
    choicesPerLevel: 2,
    mechanicCards,
    buildVarietyGoal: 'at least one card per route act should change movement, routing, explosive setup, or boss pressure instead of only nudging a stat',
  });
}

export function buildLevelOneBalanceTelemetrySnapshot({ sampleSeconds = [0, 60, 120, 240, 360, 480] } = {}) {
  const checkpoints = Object.freeze(sampleSeconds.map((seconds) => Object.freeze({
    seconds,
    actId: actForSeconds(seconds).id,
    director: levelOneRoguelikeSpawnDirectorAt(seconds),
    composition: buildLevelOneSpawnCompositionAt(seconds),
    normalDropChance: levelOneRoguelikeDropChance({ elapsedSeconds: seconds, rare: false }),
  })));
  const xpPacing = Object.freeze({
    passiveRun: levelOneXpPacingPlan({ killsPerMinute: 8, cacheOpens: 1, miniBossKills: 0 }),
    swarmFighter: levelOneXpPacingPlan({ killsPerMinute: 20, cacheOpens: 2, miniBossKills: 2 }),
    firstUpgradeExpectedSeconds: 58,
  });
  return Object.freeze({
    targetSessionSeconds: HMH_LEVEL_ONE_PLAYTEST_BALANCE.targetSessionSeconds,
    generatedBy: 'hmh-level-one-balance-pass',
    areas: LEVEL_ONE_BALANCE_RECOMMENDATION_AREAS,
    checkpoints,
    killsModel: Object.freeze({
      passiveRun: Object.freeze({ killsPerMinute: 8, killsAtEightMinutes: 64 }),
      swarmFighter: Object.freeze({ killsPerMinute: 20, killsAtEightMinutes: 160 }),
    }),
    xpPacing,
    rewardModel: Object.freeze({
      normalDropChanceAtStart: levelOneRoguelikeDropChance({ elapsedSeconds: 0, rare: false }),
      normalDropChanceAtEightMinutes: levelOneRoguelikeDropChance({ elapsedSeconds: 480, rare: false }),
      rareDropPolicy: 'elite, mini-boss, boss, and authored cache rewards remain deliberate rather than random spam',
    }),
    spawnModel: Object.freeze({
      minRegularSpawnDistanceTiles: 18,
      minPoiSupportSpawnDistanceTiles: 20,
      minMiniBossSpawnDistanceTiles: 24,
      bossGenericSpawnSuppression: true,
    }),
    bossChoreography: buildLevelOneBossChoreographyPlan(),
    upgradeVariety: buildLevelOneUpgradeVarietyPlan(),
  });
}

export function validateLevelOneBalancePass() {
  const errors = [];
  const snapshot = buildLevelOneBalanceTelemetrySnapshot();
  if (snapshot.areas.length !== 6) errors.push('all six recommendation areas must be represented');
  if (snapshot.targetSessionSeconds !== 480) errors.push('Level 1 target session must remain 8 minutes');
  if (snapshot.checkpoints.at(-1).director.maxEnemiesOnMap < 92) errors.push('8-minute wall needs dense pressure');
  if (snapshot.xpPacing.swarmFighter.targetLevelAtEightMinutes < 7) errors.push('swarm fighter should reach level 7+');
  if (!snapshot.bossChoreography.finalBoss.onDefeat.unlocksGate) errors.push('final boss must unlock the authored gate');
  if (!snapshot.upgradeVariety.mechanicCards.some((card) => card.id === 'gas-chain-refund')) errors.push('gas chain upgrade card missing');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
