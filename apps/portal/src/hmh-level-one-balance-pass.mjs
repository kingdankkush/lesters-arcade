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
  const seconds = Math.max(0, Number(elapsedSeconds) || 0);
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

export function levelOneXpPacingPlan({ killsPerMinute = 20, cacheOpens = 2, miniBossKills = 6 } = {}) {
  const kpm = Math.max(0, Number(killsPerMinute) || 0);
  const eliteBandMinutes = 22.5;
  const killXpAtEliteBand = kpm * eliteBandMinutes * 11.5;
  const cacheXp = Math.max(0, Number(cacheOpens) || 0) * 85;
  const bossXp = Math.max(0, Number(miniBossKills) || 0) * 62;
  const totalXp = killXpAtEliteBand + cacheXp + bossXp;
  return Object.freeze({
    firstUpgradeTargetWindowSeconds: Object.freeze([45, 75]),
    firstUpgradeExpectedSeconds: 58,
    targetLevelAtEliteBand: Math.max(18, targetLevelForXp(totalXp)),
    totalExpectedXpAtEliteBand: Math.round(totalXp),
    killXpAtEliteBand: Math.round(killXpAtEliteBand),
    cacheXpAtEliteBand: Math.round(cacheXp),
    bossXpAtEliteBand: Math.round(bossXp),
    guardrails: Object.freeze([
      'first upgrade should arrive after the player understands movement but before the first boss beat',
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
      title: 'The Rug Pull Baron',
      phases: Object.freeze([
        Object.freeze({ id: 'gate-warning', hpPct: [100, 66], telegraphFrames: 60, addWaveSuppression: true, pattern: 'whale dump fan + warning sign tell', counterplay: 'use the boss gate lane to read and sidestep the deliberate fan' }),
        Object.freeze({ id: 'panic-crossfire', hpPct: [66, 33], telegraphFrames: 54, addWaveSuppression: false, pattern: 'rug-pull chain + guard crossfire', counterplay: 'clear the guard pair before the chain closes the safe lane' }),
        Object.freeze({ id: 'extraction-break', hpPct: [33, 0], telegraphFrames: 72, addWaveSuppression: true, pattern: 'liquidation wave + punish recovery', counterplay: 'dash through the long tell, then punish during recovery' }),
      ]),
      onDefeat: Object.freeze({ continuesSurvival: true, dropsBossPayout: true, suppressesGenericSpawnsDuringDeathSpectacle: true }),
    }),
  });
}

export function buildLevelOneUpgradeVarietyPlan() {
  const mechanicCards = Object.freeze([
    Object.freeze({ id: 'pierce', mechanic: 'shots punch through dense saloon and road-loop bodies', stat: 'pierce' }),
    Object.freeze({ id: 'grenade-damage', mechanic: 'grenade builds become a deliberate branch instead of a one-off pickup', stat: 'grenadeDamage' }),
    Object.freeze({ id: 'pickup-radius', mechanic: 'cache and XP rewards pull harder and stay readable while kiting', stat: 'pickupRadius' }),
    Object.freeze({ id: 'dash-distance', mechanic: 'safer committed dashes through ford, bridge, and chokepoint routes', stat: 'dashDistance' }),
    Object.freeze({ id: 'block-buster', mechanic: 'grenade type can become a heavy room-clearing build identity', stat: 'grenadeType' }),
    Object.freeze({ id: 'revive', mechanic: 'late-run defense can trade many picks for one extra lethal mistake', stat: 'revive' }),
  ]);
  return Object.freeze({
    choicesPerLevel: 3,
    mechanicCards,
    buildVarietyGoal: 'ranked bases and gated unlocks should create build identity instead of letting one run complete every upgrade',
  });
}

export function buildLevelOneBalanceTelemetrySnapshot({ sampleSeconds = [0, 300, 600, 900, 1200, 1500, 1800] } = {}) {
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
    mode: HMH_LEVEL_ONE_PLAYTEST_BALANCE.mode,
    eliteBandSeconds: HMH_LEVEL_ONE_PLAYTEST_BALANCE.eliteBandSeconds,
    generatedBy: 'hmh-level-one-balance-pass',
    areas: LEVEL_ONE_BALANCE_RECOMMENDATION_AREAS,
    checkpoints,
    killsModel: Object.freeze({
      passiveRun: Object.freeze({ killsPerMinute: 8, killsAtEliteBand: 8 * 22.5 }),
      swarmFighter: Object.freeze({ killsPerMinute: 20, killsAtEliteBand: 20 * 22.5 }),
    }),
    xpPacing,
    rewardModel: Object.freeze({
      normalDropChanceAtStart: levelOneRoguelikeDropChance({ elapsedSeconds: 0, rare: false }),
      normalDropChanceAtEliteBand: levelOneRoguelikeDropChance({ elapsedSeconds: 22.5 * 60, rare: false }),
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
  if (snapshot.mode !== 'open-ended-survival') errors.push('Level 1 must be open-ended survival');
  if (snapshot.checkpoints.at(-1).director.maxEnemiesOnMap < 125) errors.push('elite-band pressure needs dense but continuous swarms');
  if (snapshot.xpPacing.swarmFighter.targetLevelAtEliteBand < 18) errors.push('swarm fighter should keep progressing into the elite band');
  if (!snapshot.bossChoreography.finalBoss.onDefeat.continuesSurvival) errors.push('signature boss defeat must continue open-ended survival');
  if (!snapshot.bossChoreography.finalBoss.onDefeat.dropsBossPayout) errors.push('signature boss defeat must drop its payout');
  if (!snapshot.upgradeVariety.mechanicCards.some((card) => card.id === 'grenade-damage')) errors.push('grenade branch upgrade card missing');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
