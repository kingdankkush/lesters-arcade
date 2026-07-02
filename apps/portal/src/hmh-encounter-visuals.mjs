import { HMH_ANIMATED_ROSTER } from '../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs';
import { repairRuntimeVisualKitSpec } from './hmh-art-repair.mjs';

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
      sceneObj('dry-cave-cliff-west', 'level-final-setpiece/cave-mouth-rocks', 'wall', centerX - 3, centerY - 2, { radius: 0.8 }),
      sceneObj('dry-cave-cliff-east', 'level-final-setpiece/cave-mouth-rocks', 'wall', centerX + 3, centerY - 2, { radius: 0.8 }),
      sceneObj('dry-cave-treeline', 'level-final-setpiece/pine-wall-shadow', 'tree', centerX + 2, centerY - 4, { radius: 0.72 }),
      sceneObj('dry-cave-lamp', 'level-final-setpiece/torch-pockets', 'lamp', centerX - 1, centerY + 2, { radius: 0.35 }),
      sceneObj('dry-cave-gate', 'construct/fence-gate', 'fence', centerX, centerY - 1, { radius: 0.32 }),
    );
  }

  if (key === 'oasis-lakeside' || layout === 'sandbar-ring') {
    objects.push(
      sceneObj('oasis-waterline-0', 'level-final-setpiece/shoreline-ripple-line', 'water-strip', centerX - 2, centerY + 2, { solid: false, radius: 0 }),
      sceneObj('oasis-waterline-1', 'level-final-setpiece/shoreline-ripple-line', 'water-strip', centerX, centerY + 2, { solid: false, radius: 0 }),
      sceneObj('oasis-waterline-2', 'level-final-setpiece/shoreline-ripple-line', 'water-strip', centerX + 2, centerY + 2, { solid: false, radius: 0 }),
      sceneObj('oasis-log', 'level-final-setpiece/driftwood-sandbar', 'smallprop', centerX + 3, centerY - 1, { solid: true, radius: 0.45 }),
      sceneObj('oasis-reeds-west', 'level-final-setpiece/reed-bank-ring', 'water-strip', centerX - 3, centerY - 1, { solid: false, radius: 0 }),
      sceneObj('oasis-reedline', 'level-final-setpiece/reed-bank-ring', 'water-strip', centerX + 1, centerY - 3, { solid: false, radius: 0 }),
    );
  }

  if (key === 'crossroads-trading-post' || layout === 'wagon-circle-crossfire') {
    objects.push(
      sceneObj('crossroads-wagon-core', 'level-final-setpiece/wagon-circle', 'crate', centerX, centerY, { radius: 0.4 }),
      sceneObj('crossroads-signpost', 'level-final-setpiece/signpost-fork', 'sign', centerX - 2, centerY - 2, { radius: 0.4 }),
      sceneObj('crossroads-lanterns', 'level-final-setpiece/lantern-string', 'lamp', centerX + 2, centerY, { radius: 0.32 }),
    );
  }

  if (key === 'mesa-overlook' || layout === 'switchback-sniper-lane') {
    objects.push(
      sceneObj('mesa-cliff-switchback', 'level-final-setpiece/cliff-switchback', 'wall', centerX + 3, centerY - 3, { radius: 0.8 }),
      sceneObj('mesa-rail', 'level-final-setpiece/broken-guardrail', 'fence', centerX - 1, centerY + 1, { radius: 0.32 }),
      sceneObj('mesa-glint-post', 'level-final-setpiece/ridge-glint-post', 'sign', centerX + 1, centerY - 1, { radius: 0.35 }),
    );
  }

  if (key === 'rugpull-gulch' || layout === 'false-front-wagon-ring') {
    objects.push(
      sceneObj('rugpull-barricade', 'level-final-setpiece/false-front-barricade', 'wall', centerX - 2, centerY - 1, { radius: 0.4 }),
      sceneObj('rugpull-wagon', 'level-final-setpiece/wagon-ring', 'crate', centerX + 2, centerY, { radius: 0.4 }),
      sceneObj('rugpull-signage', 'level-final-setpiece/vault-signage', 'sign', centerX, centerY - 3, { radius: 0.4 }),
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

// Animated roster kit references — enemies now use 8-direction PixelLab animated
// sprites from the hmh-animated-roster directory instead of static sprite sheets.
// The roster key maps each enemy to its character directory under
// assets/generated/hmh-animated-roster/<key>/ with idle/walk/run/attack/hit/death
// subdirectories containing per-direction frame PNGs.
const ENEMY_ROSTER_KEYS = Object.freeze({
  'bandit-captain': { rosterKey: 'evil-banker-ranged', drawScaleMul: 1.12, anchorBiasY: -10 },
  buzzard: { rosterKey: 'crypto-bro-rusher', drawScaleMul: 1.06, anchorBiasY: -12 },
  'claim-jumper': { rosterKey: 'claim-jumper', drawScaleMul: 1.04, anchorBiasY: -9 },
  'claim-jumper-sheriff': { rosterKey: 'claim-jumper', drawScaleMul: 1.1, anchorBiasY: -10 },
  'coyote-pack-runner': { rosterKey: 'coyote-pack-runner', drawScaleMul: 1.08, anchorBiasY: -10 },
  'fud-goblin-cave': { rosterKey: 'trench-degen', drawScaleMul: 0.96, anchorBiasY: -4 },
  rattlesnake: { rosterKey: 'rattlesnake', drawScaleMul: 1.08, anchorBiasY: -6 },
  'ridge-raider': { rosterKey: 'evil-banker-ranged', drawScaleMul: 1.08, anchorBiasY: -10 },
  'scam-cult-zealot': { rosterKey: 'scam-cult-zealot', drawScaleMul: 1.08, anchorBiasY: -9 },
  'scorpion-ambusher': { rosterKey: 'scorpion-ambusher', drawScaleMul: 1.12, anchorBiasY: -8 },
  'wild-boar': { rosterKey: 'wild-boar', drawScaleMul: 1.12, anchorBiasY: -7 },
  'paper-hand': { rosterKey: 'paper-hand', drawScaleMul: 1.0, anchorBiasY: -6 },
  'honeypot-turret': { rosterKey: 'honeypot-turret', drawScaleMul: 1.1, anchorBiasY: -4 },
  'slippage-skater': { rosterKey: 'slippage-skater', drawScaleMul: 1.06, anchorBiasY: -8 },
  'phishing-angler': { rosterKey: 'phishing-angler', drawScaleMul: 1.04, anchorBiasY: -8 },
  'mev-reaper': { rosterKey: 'mev-reaper', drawScaleMul: 1.08, anchorBiasY: -10 },
  'liquidation-cascade-golem': { rosterKey: 'liquidation-cascade-golem', drawScaleMul: 1.16, anchorBiasY: -6 },
  'sybil-drone': { rosterKey: 'sybil-drone', drawScaleMul: 0.92, anchorBiasY: -12 },
  'rug-rat': { rosterKey: 'rug-rat', drawScaleMul: 0.88, anchorBiasY: -4 },
  'gas-beast': { rosterKey: 'gas-beast-tank', drawScaleMul: 1.14, anchorBiasY: -4 },
  'crypto-bro': { rosterKey: 'crypto-bro-rusher', drawScaleMul: 1.04, anchorBiasY: -8 },
  'evil-banker': { rosterKey: 'evil-banker-ranged', drawScaleMul: 1.06, anchorBiasY: -8 },
  'fud-goblin': { rosterKey: 'fud-goblin', drawScaleMul: 0.96, anchorBiasY: -4 },
  'gas-fee-wisp': { rosterKey: 'gas-fee-wisp', drawScaleMul: 0.94, anchorBiasY: -12 },
  // Level 2 enemies and minibosses
  'plaza-warden': { rosterKey: 'plaza-warden', drawScaleMul: 1.14, anchorBiasY: -8 },
  'bridge-exploiter': { rosterKey: 'bridge-exploiter', drawScaleMul: 1.18, anchorBiasY: -10 },
  'the-obfuscator': { rosterKey: 'the-obfuscator', drawScaleMul: 1.12, anchorBiasY: -8 },
  'bitcoin-maximalist-riot-cop': { rosterKey: 'bitcoin-maximalist-riot-cop', drawScaleMul: 1.1, anchorBiasY: -8 },
  'dao-lobbyist': { rosterKey: 'dao-lobbyist', drawScaleMul: 1.06, anchorBiasY: -8 },
  'influencer-camera-drone': { rosterKey: 'influencer-camera-drone', drawScaleMul: 0.9, anchorBiasY: -14 },
  'nft-valet': { rosterKey: 'nft-valet', drawScaleMul: 1.04, anchorBiasY: -6 },
  'stablecoin-socialite': { rosterKey: 'stablecoin-socialite', drawScaleMul: 1.06, anchorBiasY: -8 },
});

// BESPOKE_ENEMY_VISUAL_KITS is kept as a backward-compatible export but now returns
// roster-key-based kit descriptors instead of static sheet paths. The renderer uses
// these to look up the animated roster entry for 8-dir frame selection.
export const BESPOKE_ENEMY_VISUAL_KITS = Object.freeze(
  Object.fromEntries(
    Object.entries(ENEMY_ROSTER_KEYS).map(([id, spec]) => [
      id,
      Object.freeze(repairRuntimeVisualKitSpec(Object.freeze({
        id,
        rosterKey: spec.rosterKey,
        states: Object.freeze(['idle', 'walk', 'run', 'attack', 'hit', 'death']),
        drawScaleMul: 1,
        runtimeScale: 1,
        spriteAuthoringScale: spec.drawScaleMul ?? 1,
        hitFootprintRadius: spec.hitFootprintRadius ?? (spec.drawScaleMul && spec.drawScaleMul < 1 ? 0.36 : spec.drawScaleMul && spec.drawScaleMul > 1.12 ? 0.64 : 0.5),
        anchorBiasY: spec.anchorBiasY,
      }), HMH_ANIMATED_ROSTER)),
    ]),
  ),
);

export function bespokeEnemyVisualKitFor(entity = {}) {
  const id = normalizeId(entity?.id ?? entity?.enemyKey ?? '');
  return BESPOKE_ENEMY_VISUAL_KITS[id] ?? null;
}

export function buildEncounterEnemyBehaviorProfile({ poiId = null, enemyId = null } = {}) {
  const poi = normalizeId(poiId);
  const enemy = normalizeId(enemyId);

  if (poi === 'dry-forest-cave' && enemy === 'coyote-pack-runner') {
    return Object.freeze({ speedMul: 0.92, desiredDistanceMul: 0.92, telegraphBonusFrames: 6, attackResetFrames: 78 });
  }
  if (poi === 'dry-forest-cave' && enemy === 'fud-goblin-cave') {
    return Object.freeze({ speedMul: 0.88, desiredDistanceMul: 1.25, telegraphBonusFrames: 4, attackResetFrames: 76 });
  }
  if (poi === 'dry-forest-cave' && enemy === 'wild-boar') {
    return Object.freeze({ speedMul: 0.9, desiredDistanceMul: 0.92, telegraphBonusFrames: 6, attackResetFrames: 82 });
  }

  if (poi === 'oasis-lakeside' && (enemy === 'scorpion-ambusher' || enemy === 'rattlesnake')) {
    return Object.freeze({ speedMul: 0.9, desiredDistanceMul: 0.95, telegraphBonusFrames: 7, attackResetFrames: 82 });
  }
  if (poi === 'oasis-lakeside' && enemy === 'gas-fee-wisp') {
    return Object.freeze({ speedMul: 1.04, desiredDistanceMul: 1.2, telegraphBonusFrames: 2, attackResetFrames: 78 });
  }
  if (poi === 'oasis-lakeside' && enemy === 'buzzard') {
    return Object.freeze({ speedMul: 1.1, desiredDistanceMul: 1.35, telegraphBonusFrames: 3, attackResetFrames: 48 });
  }

  if (poi === 'crossroads-trading-post' && enemy === 'honeypot-turret') {
    return Object.freeze({ speedMul: 1, desiredDistanceMul: 1.4, telegraphBonusFrames: 4, attackResetFrames: 70 });
  }
  if (poi === 'crossroads-trading-post' && enemy === 'wild-boar') {
    return Object.freeze({ speedMul: 0.9, desiredDistanceMul: 0.95, telegraphBonusFrames: 5, attackResetFrames: 82 });
  }
  if (poi === 'crossroads-trading-post' && enemy === 'bandit-captain') {
    return Object.freeze({ speedMul: 1.02, desiredDistanceMul: 1.18, telegraphBonusFrames: 4, attackResetFrames: 60 });
  }

  if (poi === 'mesa-overlook' && enemy === 'claim-jumper') {
    return Object.freeze({ speedMul: 0.96, desiredDistanceMul: 1.35, telegraphBonusFrames: 4, attackResetFrames: 66 });
  }
  if (poi === 'mesa-overlook' && enemy === 'phishing-angler') {
    return Object.freeze({ speedMul: 1.02, desiredDistanceMul: 1.3, telegraphBonusFrames: 3, attackResetFrames: 74 });
  }
  if (poi === 'mesa-overlook' && enemy === 'ridge-raider') {
    return Object.freeze({ speedMul: 0.98, desiredDistanceMul: 1.42, telegraphBonusFrames: 5, attackResetFrames: 62 });
  }

  if (poi === 'rugpull-gulch' && enemy === 'claim-jumper-sheriff') {
    return Object.freeze({ speedMul: 0.94, desiredDistanceMul: 1.3, telegraphBonusFrames: 5, attackResetFrames: 62 });
  }
  if (poi === 'rugpull-gulch' && enemy === 'claim-jumper') {
    return Object.freeze({ speedMul: 1.01, desiredDistanceMul: 1.22, telegraphBonusFrames: 3, attackResetFrames: 66 });
  }
  if (poi === 'rugpull-gulch' && enemy === 'scam-cult-zealot') {
    return Object.freeze({ speedMul: 1.03, desiredDistanceMul: 1.1, telegraphBonusFrames: 4, attackResetFrames: 68 });
  }
  if (poi === 'rugpull-gulch' && enemy === 'rug-rat') {
    return Object.freeze({ speedMul: 0.88, desiredDistanceMul: 0.95, telegraphBonusFrames: 5, attackResetFrames: 78 });
  }

  return Object.freeze({ speedMul: 1, desiredDistanceMul: 1, telegraphBonusFrames: 0, attackResetFrames: null });
}

export function enemyProxyRenderProfile(entity = {}) {
  const hay = normalizeId(`${entity?.id ?? ''} ${entity?.title ?? ''} ${entity?.enemyKey ?? ''} ${entity?.class ?? ''}`);
  if (hay.includes('coyote') || hay.includes('wild-boar')) {
    return Object.freeze({
      proxyFamily: 'trenchDegen',
      scaleMul: 1,
      spriteAuthoringScale: hay.includes('wild-boar') ? 1.12 : 0.92,
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
      scaleMul: 1,
      spriteAuthoringScale: 0.86,
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
      scaleMul: 1,
      spriteAuthoringScale: 0.72,
      anchorBiasY: -2,
      accentColor: '#ffb24c',
      telegraphColor: '#ffd37d',
      telegraphStyle: 'torch-pop',
      fallbackColor: '#ff9a3d',
    });
  }
  if (hay.includes('claim-jumper') || hay.includes('bandit-captain') || hay.includes('ridge-raider') || hay.includes('scam-cult-zealot')) {
    return Object.freeze({
      proxyFamily: 'evilBanker',
      scaleMul: 1,
      spriteAuthoringScale: hay.includes('bandit-captain') ? 1 : 0.96,
      anchorBiasY: -6,
      accentColor: hay.includes('scam-cult-zealot') ? '#ff8f5c' : '#c8d3e8',
      telegraphColor: hay.includes('scam-cult-zealot') ? '#ffd37d' : '#ffe84d',
      telegraphStyle: hay.includes('scam-cult-zealot') ? 'torch-pop' : null,
      fallbackColor: hay.includes('scam-cult-zealot') ? '#ff9a3d' : '#9cb6e9',
    });
  }
  if (hay.includes('buzzard')) {
    return Object.freeze({
      proxyFamily: 'cryptoBro',
      scaleMul: 1,
      spriteAuthoringScale: 0.82,
      anchorBiasY: -10,
      accentColor: '#d6c7a2',
      telegraphColor: '#f5dda3',
      telegraphStyle: null,
      fallbackColor: '#bda97b',
    });
  }
  return Object.freeze({
    proxyFamily: null,
    scaleMul: 1,
    spriteAuthoringScale: 1,
    anchorBiasY: 0,
    accentColor: '#ffe84d',
    telegraphColor: '#ffe84d',
    telegraphStyle: null,
    fallbackColor: null,
  });
}
