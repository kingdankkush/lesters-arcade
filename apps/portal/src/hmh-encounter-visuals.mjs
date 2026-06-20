function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function freezePlan(plan) {
  return Object.freeze({
    ...plan,
    propClusters: Object.freeze([...(plan.propClusters ?? [])].map((cluster) => Object.freeze({ ...cluster }))),
    terrainHazards: Object.freeze([...(plan.terrainHazards ?? [])]),
  });
}

const ENCOUNTER_VISUAL_PLANS = Object.freeze({
  'dry-forest-cave': freezePlan({
    banner: 'CAVE MOUTH FUNNEL',
    telegraphCue: 'cave mouth silhouette, torch pops, and pine-wall choke announce the bottleneck before entry',
    propClusters: [
      { id: 'cave-mouth-rocks', label: 'Cave-mouth rocks', role: 'hard-funnel-cover' },
      { id: 'torch-pockets', label: 'Torch pockets', role: 'ambush-lighting' },
      { id: 'pine-wall-shadow', label: 'Pine wall shadow', role: 'sightline-cut' },
    ],
    terrainHazards: ['narrow-bottleneck', 'ambush-shadow', 'torch-arc-overlap'],
  }),
  'oasis-lakeside': freezePlan({
    banner: 'SANDBAR RING',
    telegraphCue: 'waterline shimmer, reed-bank ring, and driftwood sandbars mark the slow-water kill zone',
    propClusters: [
      { id: 'reed-bank-ring', label: 'Reed-bank ring', role: 'soft-boundary-cover' },
      { id: 'driftwood-sandbar', label: 'Driftwood sandbar', role: 'split-lane-anchor' },
      { id: 'shoreline-ripple', label: 'Shoreline ripple line', role: 'water-slow-telegraph' },
    ],
    terrainHazards: ['shallow-water-slow', 'shoreline-exposure', 'ring-flank-collapse'],
  }),
  'crossroads-trading-post': freezePlan({
    banner: 'WAGON CROSSFIRE',
    telegraphCue: 'wagon circle, lantern line, and signpost split tell the player this is a staged crossfire hub',
    propClusters: [
      { id: 'wagon-circle', label: 'Wagon circle', role: 'central-hard-cover' },
      { id: 'signpost-fork', label: 'Signpost fork', role: 'lane-commitment-read' },
      { id: 'lantern-string', label: 'Lantern string', role: 'night-sightline-guide' },
    ],
    terrainHazards: ['cross-lane-exposure', 'wagon-flank', 'hub-overcommitment'],
  }),
  'mesa-overlook': freezePlan({
    banner: 'SWITCHBACK SNIPER LANE',
    telegraphCue: 'cliff switchback, ridge glint, and sparse rail cover tell the player this is a long-lane punishment arena',
    propClusters: [
      { id: 'cliff-switchback', label: 'Cliff switchback', role: 'elevation-lane' },
      { id: 'ridge-glint-post', label: 'Ridge glint post', role: 'sniper-warning' },
      { id: 'broken-guardrail', label: 'Broken guardrail', role: 'partial-cover' },
    ],
    terrainHazards: ['long-sightline', 'elevation-punish', 'volley-gap-dash'],
  }),
  'rugpull-gulch': freezePlan({
    banner: 'FALSE FRONT WAGON RING',
    telegraphCue: 'false fronts, wagon barricades, and a water-tower sightline turn the main street into a sheriff kill box',
    propClusters: [
      { id: 'false-front-barricade', label: 'False-front barricade', role: 'cover-rhythm' },
      { id: 'wagon-ring', label: 'Wagon ring', role: 'arena-core' },
      { id: 'vault-signage', label: 'Vault signage', role: 'sniper-lane-read' },
    ],
    terrainHazards: ['main-street-crossfire', 'cover-hop-lane', 'badge-volley-window'],
  }),
});

export function buildEncounterVisualPlan({ poiId = null, arenaLayout = null } = {}) {
  const key = normalizeId(poiId);
  const exact = ENCOUNTER_VISUAL_PLANS[key];
  if (exact) return exact;
  return freezePlan({
    banner: String(arenaLayout ?? 'AUTHORED ARENA').replace(/-/g, ' ').toUpperCase(),
    telegraphCue: 'authored arena staging active',
    propClusters: [],
    terrainHazards: [],
  });
}


function sceneObj(id, sceneAssetKey, sceneRole, worldX, worldY, { solid = true, radius = 0.5, drawOrderBias = 0 } = {}) {
  return Object.freeze({ id, sceneAssetKey, sceneRole, worldX, worldY, solid, radius, drawOrderBias });
}

export function buildEncounterSceneObjects({ poiId = null, arenaLayout = null, centerX = 0, centerY = 0 } = {}) {
  const key = normalizeId(poiId);
  const layout = normalizeId(arenaLayout);
  const objects = [];

  if (key === 'dry-forest-cave' || layout === 'cave-mouth-funnel') {
    objects.push(
      sceneObj('dry-cave-cliff-west', 'crypto/canyon-cliff-edge', 'wall', centerX - 3, centerY - 2, { radius: 0.8 }),
      sceneObj('dry-cave-cliff-east', 'crypto/canyon-cliff-edge', 'wall', centerX + 3, centerY - 2, { radius: 0.8 }),
      sceneObj('dry-cave-treeline', 'crypto/forest-tree-line', 'tree', centerX + 2, centerY - 4, { radius: 0.72 }),
      sceneObj('dry-cave-lamp', 'street/street-lamp', 'lamp', centerX - 1, centerY + 2, { radius: 0.35 }),
      sceneObj('dry-cave-gate', 'construct/fence-gate', 'fence', centerX, centerY - 1, { radius: 0.32 }),
    );
  }

  if (key === 'oasis-lakeside' || layout === 'sandbar-ring') {
    objects.push(
      sceneObj('oasis-waterline-0', 'construct/river-straight', 'water-strip', centerX - 2, centerY + 2, { solid: false, radius: 0 }),
      sceneObj('oasis-waterline-1', 'construct/river-straight', 'water-strip', centerX, centerY + 2, { solid: false, radius: 0 }),
      sceneObj('oasis-waterline-2', 'construct/river-straight', 'water-strip', centerX + 2, centerY + 2, { solid: false, radius: 0 }),
      sceneObj('oasis-log', 'nature/fallen-log', 'smallprop', centerX + 3, centerY - 1, { solid: true, radius: 0.45 }),
      sceneObj('oasis-bench', 'street/park-bench', 'bench', centerX - 3, centerY - 1, { solid: true, radius: 0.5 }),
      sceneObj('oasis-reedline', 'crypto/forest-tree-line', 'tree', centerX + 1, centerY - 3, { solid: true, radius: 0.72 }),
    );
  }

  if (key === 'crossroads-trading-post' || layout === 'wagon-circle-crossfire') {
    objects.push(
      sceneObj('crossroads-wagon-core', 'interior/stacked-boxes', 'crate', centerX, centerY, { radius: 0.4 }),
      sceneObj('crossroads-signpost', 'street/bus-stop-sign', 'sign', centerX - 2, centerY - 2, { radius: 0.4 }),
      sceneObj('crossroads-fence', 'construct/fence-segment', 'fence', centerX + 2, centerY, { radius: 0.32 }),
    );
  }

  if (key === 'mesa-overlook' || layout === 'switchback-sniper-lane') {
    objects.push(
      sceneObj('mesa-cliff-switchback', 'crypto/canyon-cliff-edge', 'wall', centerX + 3, centerY - 3, { radius: 0.8 }),
      sceneObj('mesa-rail', 'construct/fence-segment', 'fence', centerX - 1, centerY + 1, { radius: 0.32 }),
      sceneObj('mesa-glint-post', 'crypto/utility-pole', 'sign', centerX + 1, centerY - 1, { radius: 0.35 }),
    );
  }

  if (key === 'rugpull-gulch' || layout === 'false-front-wagon-ring') {
    objects.push(
      sceneObj('rugpull-barricade', 'construct/brick-wall-corner', 'wall', centerX - 2, centerY - 1, { radius: 0.4 }),
      sceneObj('rugpull-wagon', 'interior/stacked-boxes', 'crate', centerX + 2, centerY, { radius: 0.4 }),
      sceneObj('rugpull-signage', 'street/bus-stop-sign', 'sign', centerX, centerY - 3, { radius: 0.4 }),
    );
  }

  return Object.freeze(objects);
}


const ENCOUNTER_TEMPLATE_RULES = Object.freeze({
  'dry-forest-cave': Object.freeze({ templateId: 'crypto_dry_forest_cave', radiusCells: 1, pathOrientation: 'vertical' }),
  'oasis-lakeside': Object.freeze({ templateId: 'crypto_oasis_lakeside', radiusCells: 1, pathOrientation: 'horizontal' }),
  'mesa-overlook': Object.freeze({ templateId: 'crypto_mesa_overlook', radiusCells: 1, pathOrientation: 'vertical' }),
  'rugpull-gulch': Object.freeze({ templateId: 'crypto_rugpull_gulch', radiusCells: 1, pathOrientation: 'horizontal' }),
  'crossroads-trading-post': Object.freeze({ templateId: 'crypto_country_bus_turnout', radiusCells: 1, pathOrientation: 'horizontal' }),
});

export function buildEncounterTemplateContext({ poiId = null, centerCellX = 0, centerCellY = 0, cellX = 0, cellY = 0 } = {}) {
  const key = normalizeId(poiId);
  const rule = ENCOUNTER_TEMPLATE_RULES[key] ?? null;
  if (!rule) return null;
  const distance = Math.max(Math.abs(cellX - centerCellX), Math.abs(cellY - centerCellY));
  if (distance > rule.radiusCells) return null;
  return Object.freeze({
    templatePoolIds: Object.freeze([rule.templateId]),
    preferredTemplateIds: Object.freeze([rule.templateId]),
    forceTemplateId: distance == 0 ? rule.templateId : null,
    pathOrientation: rule.pathOrientation,
    encounterTemplateId: rule.templateId,
    encounterDistance: distance,
  });
}

export function buildEncounterTerrainPressure({ poiId = null, centerX = 0, centerY = 0, playerX = 0, playerY = 0 } = {}) {
  const key = normalizeId(poiId);
  const dx = Math.abs(playerX - centerX);
  const dy = Math.abs(playerY - centerY);
  if (key === 'dry-forest-cave' && dx <= 2.25 && dy <= 3.25) {
    return Object.freeze({ moveSpeedMul: 0.88, hazardId: 'narrow-bottleneck', label: 'BOTTLENECK' });
  }
  if (key === 'oasis-lakeside' && dx <= 4.5 && playerY >= centerY - 1 && playerY <= centerY + 3.5) {
    return Object.freeze({ moveSpeedMul: 0.72, hazardId: 'shallow-water-slow', label: 'SHALLOW WATER' });
  }
  return Object.freeze({ moveSpeedMul: 1, hazardId: null, label: null });
}



export const BESPOKE_ENEMY_VISUAL_KITS = Object.freeze({
  'coyote-pack-runner': Object.freeze({
    id: 'coyote-pack-runner',
    layout: Object.freeze({ columns: 4, rows: 2, frameWidth: 96, frameHeight: 96 }),
    states: Object.freeze(['idle', 'run', 'attack']),
    sheets: Object.freeze({
      idle: './assets/generated/hmh-bespoke-enemy-kits/coyote-pack-runner/idle.png',
      run: './assets/generated/hmh-bespoke-enemy-kits/coyote-pack-runner/run.png',
      attack: './assets/generated/hmh-bespoke-enemy-kits/coyote-pack-runner/attack.png',
    }),
    drawScaleMul: 1.08,
    anchorBiasY: -10,
  }),
  'scorpion-ambusher': Object.freeze({
    id: 'scorpion-ambusher',
    layout: Object.freeze({ columns: 4, rows: 2, frameWidth: 96, frameHeight: 96 }),
    states: Object.freeze(['idle', 'run', 'attack']),
    sheets: Object.freeze({
      idle: './assets/generated/hmh-bespoke-enemy-kits/scorpion-ambusher/idle.png',
      run: './assets/generated/hmh-bespoke-enemy-kits/scorpion-ambusher/run.png',
      attack: './assets/generated/hmh-bespoke-enemy-kits/scorpion-ambusher/attack.png',
    }),
    drawScaleMul: 1.12,
    anchorBiasY: -8,
  }),
});

export function bespokeEnemyVisualKitFor(entity = {}) {
  const id = normalizeId(entity?.id ?? entity?.enemyKey ?? '');
  return BESPOKE_ENEMY_VISUAL_KITS[id] ?? null;
}

export function buildEncounterEnemyBehaviorProfile({ poiId = null, enemyId = null } = {}) {
  const poi = normalizeId(poiId);
  const enemy = normalizeId(enemyId);
  if (poi === 'dry-forest-cave' && enemy === 'coyote-pack-runner') {
    return Object.freeze({ speedMul: 1.12, desiredDistanceMul: 0.84, telegraphBonusFrames: 4, attackResetFrames: 40 });
  }
  if (poi === 'dry-forest-cave' && enemy === 'fud-goblin-cave') {
    return Object.freeze({ speedMul: 0.92, desiredDistanceMul: 1.25, telegraphBonusFrames: 3, attackResetFrames: 52 });
  }
  if (poi === 'oasis-lakeside' && enemy === 'scorpion-ambusher') {
    return Object.freeze({ speedMul: 1.16, desiredDistanceMul: 0.82, telegraphBonusFrames: 5, attackResetFrames: 38 });
  }
  if (poi === 'oasis-lakeside' && enemy === 'gas-fee-wisp') {
    return Object.freeze({ speedMul: 1.04, desiredDistanceMul: 1.2, telegraphBonusFrames: 2, attackResetFrames: 78 });
  }
  if (poi === 'crossroads-trading-post' && enemy === 'coyote-pack-runner') {
    return Object.freeze({ speedMul: 1.08, desiredDistanceMul: 0.9, telegraphBonusFrames: 3, attackResetFrames: 42 });
  }
  if (poi === 'crossroads-trading-post' && enemy === 'honeypot-turret') {
    return Object.freeze({ speedMul: 1, desiredDistanceMul: 1.4, telegraphBonusFrames: 4, attackResetFrames: 70 });
  }
  if (poi === 'mesa-overlook' && enemy === 'claim-jumper') {
    return Object.freeze({ speedMul: 0.96, desiredDistanceMul: 1.35, telegraphBonusFrames: 4, attackResetFrames: 66 });
  }
  if (poi === 'mesa-overlook' && enemy === 'phishing-angler') {
    return Object.freeze({ speedMul: 1.02, desiredDistanceMul: 1.3, telegraphBonusFrames: 3, attackResetFrames: 74 });
  }
  if (poi === 'rugpull-gulch' && enemy === 'claim-jumper-sheriff') {
    return Object.freeze({ speedMul: 0.94, desiredDistanceMul: 1.3, telegraphBonusFrames: 5, attackResetFrames: 62 });
  }
  if (poi === 'rugpull-gulch' && enemy === 'scam-cult-zealot') {
    return Object.freeze({ speedMul: 1.03, desiredDistanceMul: 1.1, telegraphBonusFrames: 4, attackResetFrames: 68 });
  }
  if (poi === 'rugpull-gulch' && enemy === 'rug-rat') {
    return Object.freeze({ speedMul: 1.18, desiredDistanceMul: 0.8, telegraphBonusFrames: 2, attackResetFrames: 34 });
  }
  return Object.freeze({ speedMul: 1, desiredDistanceMul: 1, telegraphBonusFrames: 0, attackResetFrames: null });
}

export function enemyProxyRenderProfile(entity = {}) {
  const hay = normalizeId(`${entity?.id ?? ''} ${entity?.title ?? ''} ${entity?.enemyKey ?? ''} ${entity?.class ?? ''}`);
  if (hay.includes('coyote')) {
    return Object.freeze({
      proxyFamily: 'trenchDegen',
      scaleMul: 1.08,
      anchorBiasY: -6,
      accentColor: '#d9a15b',
      telegraphColor: '#ffd27a',
      telegraphStyle: 'dust-lunge-line',
      fallbackColor: '#d98b4d',
    });
  }
  if (hay.includes('scorpion') || hay.includes('rattlesnake') || hay.includes('sandbar-apex')) {
    return Object.freeze({
      proxyFamily: 'gasBeast',
      scaleMul: 1.1,
      anchorBiasY: -4,
      accentColor: '#74e0d6',
      telegraphColor: '#8cf7ff',
      telegraphStyle: 'burrow-ring',
      fallbackColor: '#4fd4c8',
    });
  }
  if (hay.includes('fud-goblin-cave') || (hay.includes('cave') && hay.includes('goblin'))) {
    return Object.freeze({
      proxyFamily: 'trenchDegen',
      scaleMul: 0.94,
      anchorBiasY: -2,
      accentColor: '#ffb24c',
      telegraphColor: '#ffd37d',
      telegraphStyle: 'torch-pop',
      fallbackColor: '#ff9a3d',
    });
  }
  return Object.freeze({
    proxyFamily: null,
    scaleMul: 1,
    anchorBiasY: 0,
    accentColor: '#ffe84d',
    telegraphColor: '#ffe84d',
    telegraphStyle: null,
    fallbackColor: null,
  });
}
