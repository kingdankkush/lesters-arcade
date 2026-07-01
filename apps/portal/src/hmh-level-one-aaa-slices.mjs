export const HMH_LEVEL_ONE_AAA_ART_DIRECTION = Object.freeze({
  styleId: 'level1-crypto-wasteland-cohesive-aaa-v1',
  title: 'Level 1 cohesive AAA art/interactivity pass',
  paletteRead: 'Dusty ochre roads, warm weathered timber, burnt umber shadows, Litecoin gold accents, toxic mushroom orange, and cool cyan neon/extraction highlights.',
  silhouetteRule: 'Every replacement asset needs a chunky dark arcade outline, readable isometric footprint, and one strong material identity before decorative noise.',
  badAssetPolicy: 'replace generic placeholder crates, signs, hazards, and road cues in high-visibility POIs with cohesive palette-matched final setpiece assets before adding more random scatter.',
  runtimeGoal: 'Authored route beats, tactical interactives, and cohesive final-setpiece replacements should all be visible through the existing scene-object runtime path.',
});

const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
const uniq = (items) => Object.freeze(Array.from(new Set(items.filter(Boolean))));

function routeAct(id, title, timeWindowSeconds, routeZoneIds, data = {}) {
  return Object.freeze({
    id,
    title,
    timeWindowSeconds: Object.freeze(timeWindowSeconds),
    routeZoneIds: Object.freeze(routeZoneIds),
    lockPolicy: data.lockPolicy ?? 'open-route',
    cameraGoal: data.cameraGoal,
    playerPromise: data.playerPromise,
    artFocus: Object.freeze(data.artFocus ?? []),
    interactivityFocus: Object.freeze(data.interactivityFocus ?? []),
  });
}

export const HMH_LEVEL_ONE_AAA_ROUTE_ACTS = freeze([
  routeAct('act-00-safe-road', 'Safe Road / Controls Read', [0, 90], ['spawn-broken-road'], {
    cameraGoal: 'low-clutter road with first sign and cache visible before enemies crowd the lane',
    playerPromise: 'learn movement, shooting lane width, first XP pull, and the gold/cyan reward language',
    artFocus: ['cohesive-ghost-road-sign', 'cohesive-desert-cache-crate'],
    interactivityFocus: ['first reward cache', 'route sign'],
  }),
  routeAct('act-01-saloon-duel', 'Ghost Saloon Main Street Duel', [90, 180], ['ghost-saloon-mainstreet'], {
    lockPolicy: 'soft-mini-boss-lock',
    cameraGoal: 'false-front saloon/backdrop stays on the top edge with barrel cover framing the street lane',
    playerPromise: 'commit to first authored shootout and learn destructible cover before open swarms begin',
    artFocus: ['cohesive-saloon-cover-barrel', 'cohesive-ghost-road-sign'],
    interactivityFocus: ['destructible barrel cover', 'saloon signpost'],
  }),
  routeAct('act-02-forest-ford-loop', 'Forest Grove / Shoreline Ford Loop', [180, 300], ['dead-forest-mushroom-grove', 'shoreline-ford'], {
    lockPolicy: 'optional-loop-pressure',
    cameraGoal: 'green/orange mushroom glow and cyan water edge contrast against the dusty main route',
    playerPromise: 'choose a tighter hazard loop for better rewards, then cross a readable ford chokepoint',
    artFocus: ['cohesive-mushroom-spore-ring', 'cohesive-shoreline-ford-planks'],
    interactivityFocus: ['spore hazard', 'ford planks slow-water read'],
  }),
  routeAct('act-03-desert-gas-yard', 'Desert Cache / Gas Yard Pressure', [300, 435], ['desert-bone-camp', 'warehouse-gas-station-yard'], {
    lockPolicy: 'mini-boss-yard-lock',
    cameraGoal: 'large negative-space sand field feeds into a dense gas-station/warehouse yard without prop soup',
    playerPromise: 'use reward caches, explosive gas pump hazards, and crate cover while enemy pressure peaks',
    artFocus: ['cohesive-desert-cache-crate', 'cohesive-gas-pump-explosive', 'cohesive-warehouse-crate-stack'],
    interactivityFocus: ['reward cache', 'chain explosive hazard', 'destructible crate cover'],
  }),
  routeAct('act-04-rugpull-boss-extract', 'Rugpull Boss Yard / Extraction Reveal', [435, 480], ['rugpull-gulch-boss-yard', 'ltc-road-extraction'], {
    lockPolicy: 'boss-yard-lock',
    cameraGoal: 'boss gate and extraction flares are unmistakable; road out is blocked until the boss proxy dies',
    playerPromise: 'survive final lock, kill the boss, then follow cyan/gold flares to the extraction pad',
    artFocus: ['cohesive-boss-yard-gate', 'cohesive-extraction-flare-road'],
    interactivityFocus: ['boss gate', 'extraction cue'],
  }),
]);

function interactive(id, zoneId, assetKey, interactionKind, runtimeHook, data = {}) {
  return Object.freeze({
    id,
    zoneId,
    assetKey,
    interactionKind,
    runtimeHook,
    role: data.role ?? interactionKind,
    districtId: data.districtId,
    gridX: data.gridX,
    gridY: data.gridY,
    solid: data.solid ?? true,
    zHeight: data.zHeight ?? 1,
    radius: data.radius ?? 0.55,
    hp: data.hp ?? (interactionKind === 'destructible' ? 24 : null),
    chainDetonation: Boolean(data.chainDetonation),
    reward: data.reward ?? null,
    telegraph: data.telegraph ?? '',
  });
}

export const HMH_LEVEL_ONE_POI_INTERACTIVES = freeze([
  interactive('saloon-barrel-cover-a', 'ghost-saloon-mainstreet', 'level-final-setpiece/cohesive-saloon-cover-barrel', 'destructible', 'damageProp -> destructible cover break; future barrel debris/gold coin burst', { districtId: 'ghost-town', gridX: 39, gridY: 6, role: 'crate', hp: 22, telegraph: 'warm timber barrel with Litecoin-gold rim reads as breakable cover' }),
  interactive('saloon-road-sign', 'ghost-saloon-mainstreet', 'level-final-setpiece/cohesive-ghost-road-sign', 'cover', 'scene-object guidepost and low collision cover beside saloon duel lane', { districtId: 'ghost-town', gridX: 42, gridY: 5, role: 'sign', solid: false, radius: 0.25 }),
  interactive('mushroom-spore-ring', 'dead-forest-mushroom-grove', 'level-final-setpiece/cohesive-mushroom-spore-ring', 'hazard', 'environmental hazard telegraph; future pulse applies slow/poison only inside ring', { districtId: 'country-road', gridX: 57, gridY: 5, role: 'hazard', solid: false, radius: 0.9, telegraph: 'orange mushroom ring pulses before hazard' }),
  interactive('shoreline-ford-planks', 'shoreline-ford', 'level-final-setpiece/cohesive-shoreline-ford-planks', 'cover', 'ford readability marker; non-solid crossing plank art keeps water edge legible', { districtId: 'country-road', gridX: 62, gridY: 6, role: 'bridge', solid: false, radius: 0.4 }),
  interactive('desert-cache-crate-a', 'desert-bone-camp', 'level-final-setpiece/cohesive-desert-cache-crate', 'reward-cache', 'damageProp/open-cache path should spawn Litecoin/XP reward pickup', { districtId: 'desert-approach', gridX: 22, gridY: 6, role: 'crate', hp: 18, reward: 'litecoin-cache' }),
  interactive('gas-pump-explosive-a', 'warehouse-gas-station-yard', 'level-final-setpiece/cohesive-gas-pump-explosive', 'hazard', 'computeChainDetonation explosive-prop hook; future explosion damages enemies and breaks nearby crates', { districtId: 'ghost-town', gridX: 48, gridY: 7, role: 'barrel', hp: 16, chainDetonation: true, telegraph: 'red pump + cyan spark reads explosive' }),
  interactive('warehouse-crate-stack-a', 'warehouse-gas-station-yard', 'level-final-setpiece/cohesive-warehouse-crate-stack', 'destructible', 'damageProp -> cover break and possible ammo drop; frames ranged lane', { districtId: 'ghost-town', gridX: 50, gridY: 5, role: 'crate', hp: 30 }),
  interactive('boss-yard-gate', 'rugpull-gulch-boss-yard', 'level-final-setpiece/cohesive-boss-yard-gate', 'gate', 'boss-yard-lock visual gate; extraction remains blocked until combat.bossDefeated', { districtId: 'inner-city-threshold', gridX: 91, gridY: 6, role: 'gate', hp: 64, telegraph: 'RUGPULL gate silhouette tells player this is the final lock' }),
  interactive('boss-yard-warning-sign', 'rugpull-gulch-boss-yard', 'level-final-setpiece/cohesive-rugpull-warning-sign', 'cover', 'diegetic warning sign and boss-yard boundary read', { districtId: 'inner-city-threshold', gridX: 88, gridY: 5, role: 'sign', solid: false, radius: 0.25 }),
  interactive('extraction-flare-road', 'ltc-road-extraction', 'level-final-setpiece/cohesive-extraction-flare-road', 'extraction-cue', 'post-boss extraction cue; cyan/gold flares guide player to extractionPoint', { districtId: 'inner-city-threshold', gridX: 97, gridY: 5, role: 'sign', solid: false, radius: 0.3, telegraph: 'cyan road flares and Litecoin arrows mean leave now' }),
]);

export const HMH_LEVEL_ONE_REPLACEMENT_ASSET_KEYS = Object.freeze([
  'level-final-setpiece/cohesive-saloon-cover-barrel',
  'level-final-setpiece/cohesive-ghost-road-sign',
  'level-final-setpiece/cohesive-mushroom-spore-ring',
  'level-final-setpiece/cohesive-shoreline-ford-planks',
  'level-final-setpiece/cohesive-desert-cache-crate',
  'level-final-setpiece/cohesive-gas-pump-explosive',
  'level-final-setpiece/cohesive-warehouse-crate-stack',
  'level-final-setpiece/cohesive-boss-yard-gate',
  'level-final-setpiece/cohesive-rugpull-warning-sign',
  'level-final-setpiece/cohesive-extraction-flare-road',
]);

const ROLE_REPLACEMENTS = Object.freeze({
  'ghost-saloon-mainstreet': Object.freeze({
    'crate-cover': 'level-final-setpiece/cohesive-saloon-cover-barrel',
    sign: 'level-final-setpiece/cohesive-ghost-road-sign',
  }),
  'dead-forest-mushroom-grove': Object.freeze({
    hazard: 'level-final-setpiece/cohesive-mushroom-spore-ring',
  }),
  'shoreline-ford': Object.freeze({
    bridge: 'level-final-setpiece/cohesive-shoreline-ford-planks',
  }),
  'desert-bone-camp': Object.freeze({
    'reward-cache': 'level-final-setpiece/cohesive-desert-cache-crate',
  }),
  'warehouse-gas-station-yard': Object.freeze({
    'explosive-hazard': 'level-final-setpiece/cohesive-gas-pump-explosive',
    'crate-cover': 'level-final-setpiece/cohesive-warehouse-crate-stack',
  }),
  'rugpull-gulch-boss-yard': Object.freeze({
    gate: 'level-final-setpiece/cohesive-boss-yard-gate',
    sign: 'level-final-setpiece/cohesive-rugpull-warning-sign',
  }),
  'ltc-road-extraction': Object.freeze({
    'extraction-cue': 'level-final-setpiece/cohesive-extraction-flare-road',
  }),
});

export const HMH_LEVEL_ONE_AAA_SLICE_PLAN = Object.freeze({
  id: 'level1-aaa-route-interactivity-art-v1',
  artDirection: HMH_LEVEL_ONE_AAA_ART_DIRECTION,
  routeActs: HMH_LEVEL_ONE_AAA_ROUTE_ACTS,
  poiInteractives: HMH_LEVEL_ONE_POI_INTERACTIVES,
  replacementAssetKeys: HMH_LEVEL_ONE_REPLACEMENT_ASSET_KEYS,
});

export function aaaLevelOneRouteActs() {
  return HMH_LEVEL_ONE_AAA_ROUTE_ACTS;
}

export function aaaLevelOnePoiInteractivesForZone(zoneId) {
  return Object.freeze(HMH_LEVEL_ONE_POI_INTERACTIVES.filter((item) => item.zoneId === zoneId));
}

export function aaaLevelOneReplacementAssetForRole(zoneId, role) {
  return ROLE_REPLACEMENTS[zoneId]?.[role] ?? null;
}

export function aaaLevelOneSceneObjectsForDistrict(districtId) {
  return Object.freeze(HMH_LEVEL_ONE_POI_INTERACTIVES
    .filter((item) => item.districtId === districtId)
    .map((item) => Object.freeze({
      id: `aaa-${item.id}`,
      assetKey: item.assetKey,
      role: item.role,
      gridX: item.gridX,
      gridY: item.gridY,
      solid: item.solid,
      zHeight: item.zHeight,
      variant: 0,
      radius: item.radius,
      hp: item.hp,
      sceneAssetKey: item.assetKey,
      sceneRole: item.role,
      interactive: Object.freeze({
        id: item.id,
        zoneId: item.zoneId,
        kind: item.interactionKind,
        runtimeHook: item.runtimeHook,
        chainDetonation: item.chainDetonation,
        reward: item.reward,
        telegraph: item.telegraph,
      }),
    })));
}

function distanceBetween(a, b) {
  return Math.hypot((a?.worldX ?? 0) - (b?.worldX ?? 0), (a?.worldY ?? 0) - (b?.worldY ?? 0));
}

function isMushroomSporeRing(obstacle) {
  return obstacle?.interactive?.id === 'mushroom-spore-ring'
    || obstacle?.id === 'aaa-mushroom-spore-ring'
    || String(obstacle?.sceneAssetKey ?? obstacle?.assetKey ?? '').includes('cohesive-mushroom-spore-ring');
}

function noHitPlan(obstacle, damage = 0) {
  return Object.freeze({
    obstacleId: obstacle?.id ?? null,
    damage,
    damageable: false,
    destroyed: false,
    nextHp: obstacle?.hp ?? null,
    powerUps: Object.freeze([]),
    xpDrops: Object.freeze([]),
    scoreBonus: 0,
    chainDetonationIds: Object.freeze([]),
    blastZones: Object.freeze([]),
    text: '',
  });
}

export function levelOneInteractiveHitPlan({ obstacle = null, damage = 0, obstacles = [] } = {}) {
  if (!obstacle?.interactive || obstacle.destroyed) return noHitPlan(obstacle, damage);
  const kind = obstacle.interactive.kind;
  const damageable = kind === 'destructible'
    || kind === 'reward-cache'
    || Boolean(obstacle.interactive.chainDetonation);
  if (!damageable) return noHitPlan(obstacle, damage);
  const hp = Math.max(0, Number(obstacle.hp ?? 1));
  const nextHp = Math.max(0, hp - Math.max(0, Number(damage) || 0));
  const destroyed = nextHp <= 0;
  const xpDrops = [];
  const powerUps = [];
  let scoreBonus = 0;
  const chainDetonationIds = [];
  const blastZones = [];

  if (destroyed && kind === 'reward-cache') {
    xpDrops.push(
      Object.freeze({ worldX: obstacle.worldX ?? 0, worldY: obstacle.worldY ?? 0, value: 65 }),
      Object.freeze({ worldX: (obstacle.worldX ?? 0) + 0.35, worldY: (obstacle.worldY ?? 0) - 0.2, value: 35 }),
    );
    powerUps.push('ltc-cache');
    scoreBonus += 275;
  }

  if (destroyed && obstacle.interactive.chainDetonation) {
    const radiusTiles = 3.4;
    blastZones.push(Object.freeze({
      id: obstacle.id ?? 'level-one-interactive-blast',
      worldX: obstacle.worldX ?? 0,
      worldY: obstacle.worldY ?? 0,
      radiusTiles,
      damage: 55,
      source: 'level-one-interactive-explosion',
    }));
    for (const candidate of obstacles) {
      if (!candidate || candidate.id === obstacle.id || candidate.destroyed) continue;
      if (!candidate.interactive) continue;
      const candidateKind = candidate.interactive.kind;
      const canChain = candidate.interactive.chainDetonation || candidateKind === 'destructible' || candidateKind === 'reward-cache';
      if (!canChain) continue;
      if (distanceBetween(obstacle, candidate) <= radiusTiles + Math.max(0, candidate.radius ?? 0)) {
        chainDetonationIds.push(candidate.id);
      }
    }
  }

  return Object.freeze({
    obstacleId: obstacle.id ?? null,
    damage,
    damageable: true,
    destroyed,
    nextHp,
    powerUps: Object.freeze(powerUps),
    xpDrops: Object.freeze(xpDrops),
    scoreBonus,
    chainDetonationIds: Object.freeze(chainDetonationIds),
    blastZones: Object.freeze(blastZones),
    text: destroyed
      ? (kind === 'reward-cache' ? 'CACHE OPEN' : obstacle.interactive.chainDetonation ? 'GAS PUMP DETONATED' : 'COVER BROKEN')
      : `PROP -${Math.max(0, Number(damage) || 0)}`,
  });
}

export function levelOneInteractiveHazardEffectAt({ obstacle = null, playerX = 0, playerY = 0, frame = 0 } = {}) {
  if (!obstacle?.interactive || !isMushroomSporeRing(obstacle) || obstacle.destroyed) {
    return Object.freeze({ active: false, inRange: false, moveSpeedMultiplier: 1, damagePerPulse: 0, label: null });
  }
  const radius = Math.max(0.8, Number(obstacle.radius ?? 0.9) + 0.55);
  const distance = Math.hypot((Number(playerX) || 0) - (obstacle.worldX ?? 0), (Number(playerY) || 0) - (obstacle.worldY ?? 0));
  const inRange = distance <= radius;
  const pulseFrame = ((Math.round(Number(frame) || 0) % 150) + 150) % 150;
  const active = inRange && pulseFrame < 72;
  return Object.freeze({
    active,
    inRange,
    moveSpeedMultiplier: inRange ? 0.72 : 1,
    damagePerPulse: active ? 3 : 0,
    label: inRange ? 'spore ring' : null,
    pulseFrame,
  });
}

export function levelOneInteractiveRuntimeStateForObstacle(obstacle = null, { bossDefeated = false, extractionPoint = null, frame = 0 } = {}) {
  const kind = obstacle?.interactive?.kind ?? null;
  const baseSolid = Boolean(obstacle?.solid);
  if (!kind || obstacle?.destroyed) {
    return Object.freeze({ solid: false, visible: !obstacle?.destroyed, locked: false, unlocked: false, glow: false, pulseActive: false });
  }
  if (kind === 'gate') {
    const unlocked = Boolean(bossDefeated);
    return Object.freeze({
      solid: !unlocked,
      visible: true,
      locked: !unlocked,
      unlocked,
      glow: unlocked,
      pulseActive: !unlocked && (Math.round(Number(frame) || 0) % 90) < 45,
    });
  }
  if (kind === 'extraction-cue') {
    const glow = Boolean(bossDefeated || extractionPoint);
    return Object.freeze({ solid: false, visible: true, locked: false, unlocked: glow, glow, pulseActive: glow && (Math.round(Number(frame) || 0) % 80) < 50 });
  }
  if (kind === 'hazard' && isMushroomSporeRing(obstacle)) {
    return Object.freeze({ solid: false, visible: true, locked: false, unlocked: false, glow: true, pulseActive: (Math.round(Number(frame) || 0) % 150) < 72 });
  }
  return Object.freeze({ solid: baseSolid, visible: true, locked: false, unlocked: false, glow: false, pulseActive: false });
}

export function validateLevelOneAaaSlicePlan({ curatedWorldContract = null, finalSetpieceAssetByKey = null } = {}) {
  const routeZones = new Set(curatedWorldContract?.criticalPath?.map((zone) => zone.id) ?? []);
  const missingRouteZones = uniq(HMH_LEVEL_ONE_AAA_ROUTE_ACTS
    .flatMap((act) => act.routeZoneIds)
    .filter((zoneId) => routeZones.size > 0 && !routeZones.has(zoneId)));
  const interactiveZones = new Set(HMH_LEVEL_ONE_POI_INTERACTIVES.map((item) => item.zoneId));
  const requiredInteractiveZones = (curatedWorldContract?.pointsOfInterest ?? [])
    .map((poi) => poi.id)
    .filter((id) => id !== 'spawn-broken-road');
  const zonesWithoutInteractives = uniq(requiredInteractiveZones.filter((zoneId) => !interactiveZones.has(zoneId)));
  const missingAssetKeys = typeof finalSetpieceAssetByKey === 'function'
    ? uniq(HMH_LEVEL_ONE_REPLACEMENT_ASSET_KEYS.filter((key) => !finalSetpieceAssetByKey(key)))
    : Object.freeze([]);
  return Object.freeze({
    valid: missingRouteZones.length === 0 && zonesWithoutInteractives.length === 0 && missingAssetKeys.length === 0,
    missingRouteZones,
    zonesWithoutInteractives,
    missingAssetKeys,
    routeActCount: HMH_LEVEL_ONE_AAA_ROUTE_ACTS.length,
    interactiveCount: HMH_LEVEL_ONE_POI_INTERACTIVES.length,
    replacementAssetCount: HMH_LEVEL_ONE_REPLACEMENT_ASSET_KEYS.length,
  });
}
