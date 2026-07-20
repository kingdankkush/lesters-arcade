import { HMH_LEVEL_ONE_WASTELAND_POIS } from './hmh-campaign-levels.mjs';
import {
  authoredCellToWorld,
  HMH_LEVEL_ONE_WORLD_V3,
  levelOneWorldV3CellAt,
  levelOneWorldV3ElevationAt,
} from './hmh-level-one-world-v3-runtime.mjs';

const CAMPAIGN_POI_BY_ID = new Map(HMH_LEVEL_ONE_WASTELAND_POIS.map((poi) => [poi.id, poi]));
const BLUEPRINT_POI_BY_ID = new Map(HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest.map((poi) => [poi.id, poi]));
const CAMPAIGN_TO_BLUEPRINT_POI = Object.freeze({
  'rugpull-gulch': 'ghost-saloon-square',
  'dry-forest-cave': 'dry-forest-cave',
  'old-hashrate-camp': 'old-hashrate-camp',
  'oasis-lakeside': 'oasis-lakeside',
  'mesa-overlook': 'mesa-overlook',
  'crossroads-trading-post': 'crossroads-trading-post',
});

const DISTRICT_BY_BIOME = Object.freeze({
  M: 'mesa-overlook',
  F: 'country-road',
  D: 'desert-approach',
  G: 'ghost-town',
  P: 'country-road',
  T: 'inner-city-threshold',
  A: 'residential-edge',
  L: 'oasis-lakeside',
  C: 'residential-edge',
  S: 'residential-edge',
});

export const LEVEL_ONE_ELEVATION_TACTICAL_BANDS = Object.freeze([
  Object.freeze({ elevation: 0, id: 'riverbed', label: 'RIVERBED', traversal: 'basin' }),
  Object.freeze({ elevation: 1, id: 'lowland', label: 'LOWLAND', traversal: 'flat' }),
  Object.freeze({ elevation: 2, id: 'bench', label: 'MESA BENCH', traversal: 'rise' }),
  Object.freeze({ elevation: 3, id: 'ridge', label: 'RIDGELINE', traversal: 'high-ground' }),
  Object.freeze({ elevation: 4, id: 'summit', label: 'SUMMIT SHELF', traversal: 'cliff-edge' }),
]);

const ELEVATION_BAND_BY_VALUE = new Map(LEVEL_ONE_ELEVATION_TACTICAL_BANDS.map((band) => [band.elevation, band]));

export function levelOneElevationBandAt(worldX = 0, worldY = 0) {
  const cell = levelOneWorldV3CellAt(worldX, worldY);
  const elevation = Math.max(0, Math.min(4, Math.round(Number(cell.elevation) || 0)));
  const band = ELEVATION_BAND_BY_VALUE.get(elevation) ?? LEVEL_ONE_ELEVATION_TACTICAL_BANDS[1];
  return Object.freeze({ ...band, elevation, blocked: Boolean(cell.blocked), biome: cell.biome, terrain: cell.terrain });
}

export function levelOneElevationTraversalSpeedMultiplier(fromX = 0, fromY = 0, toX = fromX, toY = fromY) {
  const fromElevation = levelOneWorldV3ElevationAt(fromX, fromY);
  const toElevation = levelOneWorldV3ElevationAt(toX, toY);
  const elevationDelta = toElevation - fromElevation;
  if (!elevationDelta) return 1;
  if (elevationDelta > 0) return Math.max(0.78, 1 - Math.min(3, elevationDelta) * 0.08);
  return Math.min(1.08, 1 + Math.min(2, Math.abs(elevationDelta)) * 0.04);
}

export function levelOneElevationTraversalProfile({ fromX = 0, fromY = 0, toX = fromX, toY = fromY } = {}) {
  const from = levelOneElevationBandAt(fromX, fromY);
  const to = levelOneElevationBandAt(toX, toY);
  const elevationDelta = to.elevation - from.elevation;
  if (!elevationDelta) return Object.freeze({ from, to, elevationDelta: 0, transition: 'flat', moveSpeedMul: 1 });
  if (elevationDelta > 0) {
    return Object.freeze({
      from,
      to,
      elevationDelta,
      transition: 'climb',
      moveSpeedMul: levelOneElevationTraversalSpeedMultiplier(fromX, fromY, toX, toY),
    });
  }
  return Object.freeze({
    from,
    to,
    elevationDelta,
    transition: 'descent',
    moveSpeedMul: levelOneElevationTraversalSpeedMultiplier(fromX, fromY, toX, toY),
  });
}

function headingFor(dx, dy) {
  const horizontal = dx < -1 ? 'W' : dx > 1 ? 'E' : '';
  const vertical = dy < -1 ? 'N' : dy > 1 ? 'S' : '';
  return `${vertical}${horizontal}` || 'HERE';
}

function poiWorldRecord(campaignId) {
  const blueprintId = CAMPAIGN_TO_BLUEPRINT_POI[campaignId];
  const blueprint = BLUEPRINT_POI_BY_ID.get(blueprintId);
  const campaign = CAMPAIGN_POI_BY_ID.get(campaignId);
  if (!blueprint || !campaign) return null;
  const world = authoredCellToWorld(blueprint.x, blueprint.y);
  return Object.freeze({ campaign, blueprint, world });
}

export const HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS = Object.freeze(
  Object.keys(CAMPAIGN_TO_BLUEPRINT_POI).map(poiWorldRecord).filter(Boolean),
);

export function levelOneWorldV3DistrictContextAt(worldX = 0, worldY = 0) {
  const cell = levelOneWorldV3CellAt(worldX, worldY);
  const districtFamily = DISTRICT_BY_BIOME[cell.biome] ?? 'desert-approach';
  let poiId = null;
  let poiApproachId = null;
  let nearestDistance = Infinity;
  for (const entry of HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS) {
    const distance = Math.hypot(worldX - entry.world.x, worldY - entry.world.y);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    if (distance <= entry.blueprint.arenaRadius + 1) {
      poiId = entry.campaign.id;
      poiApproachId = null;
    } else if (distance <= entry.blueprint.arenaRadius + 10) {
      poiId = null;
      poiApproachId = entry.campaign.id;
    } else {
      poiId = null;
      poiApproachId = null;
    }
  }
  return Object.freeze({
    districtFamily,
    biomeCode: cell.biome,
    terrainCode: cell.terrain,
    poiId,
    poiApproachId,
    macroRole: cell.route === 'M' ? 'critical-spine' : cell.route === '.' ? 'exploration' : 'authored-route',
    source: 'hmh-level-one-world-v3',
  });
}

export function levelOneWorldV3PoiDirectiveAt({ playerX = 0, playerY = 0, completedPoiIds = [] } = {}) {
  const completed = new Set(completedPoiIds);
  let chosen = null;
  for (const entry of HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS) {
    if (completed.has(entry.campaign.id)) continue;
    const dx = entry.world.x - playerX;
    const dy = entry.world.y - playerY;
    const distance = Math.hypot(dx, dy);
    if (distance > 24 || (chosen && distance >= chosen.distance)) continue;
    chosen = { ...entry, dx, dy, distance };
  }
  if (!chosen) return null;
  const arenaThreshold = chosen.blueprint.arenaRadius + 1;
  const approachThreshold = chosen.blueprint.arenaRadius + 10;
  const phaseHint = chosen.distance <= arenaThreshold
    ? 'poi-arena'
    : chosen.distance <= approachThreshold
      ? 'poi-approach'
      : 'poi-telegraph';
  const heading = headingFor(chosen.dx, chosen.dy);
  const distanceTiles = Number(chosen.distance.toFixed(1));
  return Object.freeze({
    id: chosen.campaign.id,
    blueprintPoiId: chosen.blueprint.id,
    title: chosen.campaign.title,
    districtId: chosen.campaign.districtId,
    lane: chosen.campaign.lane,
    phaseHint,
    telegraph: chosen.campaign.telegraph,
    riskRewardRead: chosen.campaign.riskRewardRead,
    rewardType: chosen.campaign.reward?.type ?? null,
    rewardExamples: chosen.campaign.reward?.examples ?? [],
    miniBossId: chosen.campaign.miniBoss?.id ?? null,
    miniBossTitle: chosen.campaign.miniBoss?.title ?? null,
    counterplay: chosen.campaign.miniBoss?.counterplay ?? null,
    worldX: chosen.world.x,
    worldY: chosen.world.y,
    heading,
    distanceTiles,
    label: `${chosen.campaign.title.toUpperCase()} · ${heading} ${Math.max(0, Math.round(distanceTiles))}T`,
    source: 'hmh-level-one-world-v3',
  });
}

const ROUTE_PACING_BY_PHASE = Object.freeze({
  travel: Object.freeze({ spawnIntervalMul: 1.18, maxEnemyMul: 0.72, rangedShareDelta: 0, eliteChanceMul: 0.7, minSpawnDistanceBonus: 4, genericSpawnSuppression: false, respite: false }),
  warning: Object.freeze({ spawnIntervalMul: 1.08, maxEnemyMul: 0.84, rangedShareDelta: 0.01, eliteChanceMul: 0.8, minSpawnDistanceBonus: 3, genericSpawnSuppression: false, respite: false }),
  pressure: Object.freeze({ spawnIntervalMul: 0.88, maxEnemyMul: 1, rangedShareDelta: 0.04, eliteChanceMul: 1, minSpawnDistanceBonus: 0, genericSpawnSuppression: false, respite: false }),
  arena: Object.freeze({ spawnIntervalMul: 0.8, maxEnemyMul: 1, rangedShareDelta: 0.06, eliteChanceMul: 1.08, minSpawnDistanceBonus: 2, genericSpawnSuppression: false, respite: false }),
  clear: Object.freeze({ spawnIntervalMul: 1.75, maxEnemyMul: 0.5, rangedShareDelta: -0.05, eliteChanceMul: 0, minSpawnDistanceBonus: 6, genericSpawnSuppression: true, respite: true }),
});

export function levelOneRouteEncounterPacingAt({ playerX = 0, playerY = 0, completedPoiIds = [], respitePoiId = null } = {}) {
  const completed = new Set(completedPoiIds);
  const respiteEntry = respitePoiId && completed.has(respitePoiId)
    ? HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS.find((entry) => entry.campaign.id === respitePoiId) ?? null
    : null;
  const respiteDistance = respiteEntry
    ? Math.hypot(respiteEntry.world.x - playerX, respiteEntry.world.y - playerY)
    : Infinity;
  const respiteThreshold = respiteEntry ? respiteEntry.blueprint.arenaRadius + 10 : 0;
  const inRespiteRange = Boolean(respiteEntry && respiteDistance <= respiteThreshold);

  let nearest = null;
  for (const entry of HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS) {
    if (completed.has(entry.campaign.id)) continue;
    const distanceTiles = Math.hypot(entry.world.x - playerX, entry.world.y - playerY);
    if (!nearest || distanceTiles < nearest.distanceTiles) nearest = { entry, distanceTiles };
  }

  const inRouteBeatRange = nearest && nearest.distanceTiles <= 24;
  let phase = inRespiteRange ? 'clear' : 'travel';
  if (!inRespiteRange && inRouteBeatRange) {
    const arenaThreshold = nearest.entry.blueprint.arenaRadius + 1;
    const approachThreshold = nearest.entry.blueprint.arenaRadius + 10;
    if (nearest.distanceTiles <= arenaThreshold) phase = 'arena';
    else if (nearest.distanceTiles <= approachThreshold) phase = 'pressure';
    else phase = 'warning';
  }
  const focus = inRespiteRange ? { entry: respiteEntry, distanceTiles: respiteDistance } : inRouteBeatRange ? nearest : null;

  const pressureTier = Math.min(3, Math.floor(completed.size / 2));
  const base = ROUTE_PACING_BY_PHASE[phase];
  const tierApplies = phase === 'warning' || phase === 'pressure' || phase === 'arena';
  const spawnIntervalMul = tierApplies
    ? Math.max(0.75, Number((base.spawnIntervalMul * (1 - pressureTier * 0.04)).toFixed(3)))
    : base.spawnIntervalMul;
  const rangedShareDelta = tierApplies
    ? Math.min(0.12, Number((base.rangedShareDelta + pressureTier * 0.02).toFixed(3)))
    : base.rangedShareDelta;
  const eliteChanceMul = tierApplies
    ? Math.min(1.25, Number((base.eliteChanceMul + pressureTier * 0.08).toFixed(3)))
    : base.eliteChanceMul;

  return Object.freeze({
    phase,
    pressureTier,
    poiId: focus ? focus.entry.campaign.id : null,
    distanceTiles: focus ? Number(focus.distanceTiles.toFixed(1)) : null,
    spawnIntervalMul,
    maxEnemyMul: base.maxEnemyMul,
    rangedShareDelta,
    eliteChanceMul,
    minSpawnDistanceBonus: base.minSpawnDistanceBonus,
    genericSpawnSuppression: base.genericSpawnSuppression,
    respite: base.respite,
    source: 'hmh-level-one-route-pacing-v1',
  });
}

export function levelOneRouteObjectiveHudState({
  routePacing = null,
  poiDirective = null,
  fallbackLabel = 'LEVEL 1 ROUTE',
  fallbackTone = 'cyan',
} = {}) {
  const phase = routePacing?.phase ?? 'travel';
  const directional = Boolean(
    poiDirective
    && routePacing?.poiId
    && poiDirective.id === routePacing.poiId
    && (phase === 'warning' || phase === 'pressure'),
  );
  return Object.freeze({
    label: directional ? poiDirective.label : fallbackLabel,
    tone: directional && phase === 'pressure' ? 'orange' : fallbackTone,
    directional,
    phase,
    poiId: directional ? poiDirective.id : null,
    source: 'hmh-level-one-route-objective-hud-v1',
  });
}

export function levelOneWorldV3BossPoint() {
  return authoredCellToWorld(HMH_LEVEL_ONE_WORLD_V3.anchors.finalBoss.x, HMH_LEVEL_ONE_WORLD_V3.anchors.finalBoss.y);
}

export function levelOneWorldV3ExtractionPoint() {
  const world = authoredCellToWorld(HMH_LEVEL_ONE_WORLD_V3.anchors.extraction.x, HMH_LEVEL_ONE_WORLD_V3.anchors.extraction.y);
  return Object.freeze({
    levelId: HMH_LEVEL_ONE_WORLD_V3.levelId,
    districtFamily: 'inner-city-threshold',
    templateId: 'litecoin-extraction-beacon-pad',
    worldX: world.x,
    worldY: world.y,
    radiusTiles: 1.6,
    label: 'LITECOIN CITY ROAD OUT',
    detail: 'Reach the authored road-out beacon after clearing the Rugpull Gulch boss yard.',
    source: 'hmh-level-one-world-v3',
  });
}


// Layout v4 authored encounter, art, boundary, and spawn-lane contract.
const freeze = (value) => Object.freeze(value);
const freezeArray = (value) => freeze(value.map((item) => freeze(item)));

const ANCHOR_BY_ID = new Map([
  ...Object.entries(HMH_LEVEL_ONE_WORLD_V3.anchors).map(([id, anchor]) => [id, { id, ...anchor }]),
  ...HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest.map((anchor) => [anchor.id, anchor]),
]);

function zone(id, title, anchorId, options = {}) {
  const anchor = ANCHOR_BY_ID.get(anchorId);
  if (!anchor) throw new Error(`Level 1 layout v4 references unknown anchor: ${anchorId}`);
  return freeze({
    id,
    title,
    anchorId,
    authoredX: anchor.x,
    authoredY: anchor.y,
    clearRadiusTiles: options.clearRadiusTiles ?? Math.max(5, Number(anchor.arenaRadius) || 0),
    influenceRadiusTiles: options.influenceRadiusTiles ?? 19,
    combatRole: options.combatRole ?? 'pressure',
    coverProfile: options.coverProfile ?? 'medium-edge-cover',
    artPalette: freeze([...(options.artPalette ?? [])]),
    spawnLanes: freezeArray(options.spawnLanes ?? []),
  });
}

const ZONES = freeze([
  zone('broken-road-salvage-run', 'Broken Road Salvage Run', 'spawn', {
    clearRadiusTiles: 7,
    influenceRadiusTiles: 18,
    combatRole: 'orientation-and-first-packs',
    coverProfile: 'open-center-roadside-cover',
    artPalette: ['packed-dirt', 'wasteland-sand', 'salvage', 'roadside-storefront'],
    spawnLanes: [
      { id: 'spawn-north-shoulder', angleDeg: 215, role: 'chaser' },
      { id: 'spawn-south-shoulder', angleDeg: 125, role: 'chaser' },
      { id: 'spawn-road-rear', angleDeg: 180, role: 'ranged' },
    ],
  }),
  zone('ghost-town-mainstreet-loop', 'Ghost Town Main Street Loop', 'ghost-saloon-square', {
    clearRadiusTiles: 7,
    combatRole: 'cover-duel-and-miniboss',
    coverProfile: 'facade-edges-open-crossroad',
    artPalette: ['cobblestone', 'cracked-asphalt', 'storefronts', 'bank-plaza'],
    spawnLanes: [
      { id: 'ghost-west-porch', angleDeg: 180, role: 'ranged' },
      { id: 'ghost-east-mainstreet', angleDeg: 0, role: 'chaser' },
      { id: 'ghost-north-alley', angleDeg: 270, role: 'flanker' },
    ],
  }),
  zone('dry-forest-ridge-loop', 'Dry Forest Ridge Loop', 'dry-forest-cave', {
    clearRadiusTiles: 6,
    influenceRadiusTiles: 22,
    combatRole: 'risk-loop-and-ambush-read',
    coverProfile: 'tree-wall-gaps-log-cover',
    artPalette: ['forest-floor', 'mossy-cliff', 'fallen-logs', 'mushrooms'],
    spawnLanes: [
      { id: 'forest-west-tree-gap', angleDeg: 190, role: 'rusher' },
      { id: 'forest-north-ridge', angleDeg: 270, role: 'elite' },
      { id: 'forest-east-cave-mouth', angleDeg: 20, role: 'ranged' },
    ],
  }),
  zone('old-hashrate-salvage-loop', 'Old Hashrate Salvage Loop', 'old-hashrate-camp', {
    clearRadiusTiles: 8,
    influenceRadiusTiles: 20,
    combatRole: 'reward-loop-swarm-arena',
    coverProfile: 'bone-yard-perimeter-open-core',
    artPalette: ['wasteland-sand', 'dragon-bones', 'mining-salvage', 'roadblock'],
    spawnLanes: [
      { id: 'hashrate-west-bone-line', angleDeg: 180, role: 'chaser' },
      { id: 'hashrate-south-rubble', angleDeg: 90, role: 'elite' },
      { id: 'hashrate-east-cache', angleDeg: 0, role: 'ranged' },
    ],
  }),
  zone('silver-wallet-lakeside-loop', 'Silver Wallet Lakeside Loop', 'oasis-lakeside', {
    clearRadiusTiles: 6,
    influenceRadiusTiles: 19,
    combatRole: 'recovery-and-ford-pressure',
    coverProfile: 'shoreline-edge-open-ford',
    artPalette: ['lush-grass', 'mud-reeds', 'shallow-ford', 'firefly-bank'],
    spawnLanes: [
      { id: 'lakeside-north-reeds', angleDeg: 270, role: 'ranged' },
      { id: 'lakeside-east-bank', angleDeg: 0, role: 'chaser' },
      { id: 'lakeside-south-trail', angleDeg: 90, role: 'flanker' },
    ],
  }),
  zone('crossroads-convergence', 'Crossroads Convergence', 'crossroads-trading-post', {
    clearRadiusTiles: 7,
    influenceRadiusTiles: 18,
    combatRole: 'dual-loop-convergence-and-rest',
    coverProfile: 'wagon-edge-four-open-lanes',
    artPalette: ['packed-dirt', 'trading-post', 'route-signals', 'roadside-vehicles'],
    spawnLanes: [
      { id: 'crossroads-north-return', angleDeg: 270, role: 'mixed' },
      { id: 'crossroads-south-return', angleDeg: 90, role: 'mixed' },
      { id: 'crossroads-east-advance', angleDeg: 0, role: 'elite' },
    ],
  }),
  zone('frontier-town-pressure-ring', 'Frontier Town Pressure Ring', 'frontier-town-square', {
    clearRadiusTiles: 7,
    influenceRadiusTiles: 20,
    combatRole: 'late-swarm-town-arena',
    coverProfile: 'building-perimeter-cross-shaped-lanes',
    artPalette: ['cracked-asphalt', 'cobblestone', 'farmstead', 'neighborhood'],
    spawnLanes: [
      { id: 'frontier-west-road', angleDeg: 180, role: 'chaser' },
      { id: 'frontier-north-block', angleDeg: 270, role: 'ranged' },
      { id: 'frontier-south-farm', angleDeg: 90, role: 'flanker' },
    ],
  }),
  zone('rugpull-gulch-final-ring', 'Rugpull Gulch Final Ring', 'rugpull-gulch-boss-yard', {
    clearRadiusTiles: 9,
    influenceRadiusTiles: 22,
    combatRole: 'boss-and-rematch-arena',
    coverProfile: 'clear-telegraph-core-four-edge-caps',
    artPalette: ['packed-dirt', 'ruins', 'industrial-power-yard', 'extraction-gate'],
    spawnLanes: [
      { id: 'gulch-west-gate', angleDeg: 180, role: 'boss-add' },
      { id: 'gulch-south-yard', angleDeg: 90, role: 'boss-add' },
      { id: 'gulch-east-road-out', angleDeg: 0, role: 'boss' },
    ],
  }),
]);

export const HMH_LEVEL_ONE_LAYOUT_V4_STAMP_PLACEMENTS = freezeArray([
  { id: 'v4-spawn-salvage-wall', stampId: 'desert-road-salvage-wall', anchorId: 'spawn', kind: 'spawn' },
  { id: 'v4-spawn-fuel-stop-cache', stampId: 'roadside-fuel-stop-cache', anchorId: 'spawn', kind: 'spawn' },
  { id: 'v4-ghost-frontage-row', stampId: 'ghost-town-frontage-pocket', anchorId: 'ghost-saloon-square', kind: 'poi' },
  { id: 'v4-ghost-bank-plaza', stampId: 'wo105-bank-plaza-arena-checkpoint', anchorId: 'ghost-saloon-square', kind: 'poi' },
  { id: 'v4-ghost-civic-pocket', stampId: 'civic-park-town-pocket', anchorId: 'ghost-saloon-square', kind: 'poi' },
  { id: 'v4-forest-cliff-proof', stampId: 'wo102-forest-cliff-proof', anchorId: 'dry-forest-cave', kind: 'poi' },
  { id: 'v4-forest-log-arena', stampId: 'wo105-forest-log-arena-checkpoint', anchorId: 'dry-forest-cave', kind: 'poi' },
  { id: 'v4-forest-mushroom-ring', stampId: 'forest-mushroom-ring', anchorId: 'dry-forest-cave', kind: 'poi' },
  { id: 'v4-hashrate-bone-yard', stampId: 'ruined-camp-bone-yard', anchorId: 'old-hashrate-camp', kind: 'poi' },
  { id: 'v4-lakeside-canal-ford', stampId: 'canal-park-ford-pocket', anchorId: 'oasis-lakeside', kind: 'poi' },
  { id: 'v4-lakeside-waterfront', stampId: 'compact-south-forest-waterfront', anchorId: 'oasis-lakeside', kind: 'poi' },
  { id: 'v4-crossroads-vehicle-scene', stampId: 'wo106-roadside-vehicle-micro-scenes', anchorId: 'crossroads-trading-post', kind: 'route' },
  { id: 'v4-frontier-farmstead', stampId: 'farmstead-fence-pocket', anchorId: 'frontier-town-square', kind: 'poi' },
  { id: 'v4-frontier-neighborhood', stampId: 'neighborhood-house-yard-pocket', anchorId: 'frontier-town-square', kind: 'poi' },
  { id: 'v4-gulch-route-town', stampId: 'compact-west-route-town', anchorId: 'rugpull-gulch-boss-yard', kind: 'boss' },
  { id: 'v4-gulch-container-yard', stampId: 'wo105-container-extraction-yard-checkpoint', anchorId: 'rugpull-gulch-boss-yard', kind: 'boss' },
  { id: 'v4-gulch-rock-camp', stampId: 'compact-southwest-rock-camp', anchorId: 'rugpull-gulch-boss-yard', kind: 'boss' },
  { id: 'v4-lighthouse-glow-bank', stampId: 'compact-southeast-glow-bank', anchorId: 'wrecked-lighthouse', kind: 'poi' },
  { id: 'v4-extraction-yard', stampId: 'compact-east-extraction-yard', anchorId: 'extraction', kind: 'extraction' },
]);

const BOUNDARY_PALETTES = freeze({
  north: freezeArray([
    { assetKey: 'wo102-megaprop/forest-rock-outcrop', sceneRole: 'wall', footprintTiles: freeze({ w: 5.2, h: 2.8 }), drawOrderBias: -4, solid: true },
    { assetKey: 'world-v3-infrastructure/canyon-boundary-straight', sceneRole: 'wall', footprintTiles: freeze({ w: 5.6, h: 2.4 }), drawOrderBias: -3, solid: true },
    { assetKey: 'world-v3-infrastructure/canyon-boundary-buttress', sceneRole: 'wall', footprintTiles: freeze({ w: 5.6, h: 2.4 }), drawOrderBias: -3, solid: true },
  ]),
  south: freezeArray([
    { assetKey: 'level-1/prop/dragon-bones-body-ground-shadow', sceneRole: 'wall', footprintTiles: freeze({ w: 2.8, h: 1.5 }), drawOrderBias: 3, solid: true },
    { assetKey: 'level-1/prop/oval-rock5-ground-shadow', sceneRole: 'wall', footprintTiles: freeze({ w: 2.8, h: 1.5 }), drawOrderBias: 3, solid: true },
    { assetKey: 'level-1/prop/brown-ruins2', sceneRole: 'wall', footprintTiles: freeze({ w: 2.8, h: 1.5 }), drawOrderBias: 3, solid: true },
  ]),
  west: freezeArray([
    { assetKey: 'world-v3-infrastructure/canyon-boundary-straight', sceneRole: 'wall', footprintTiles: freeze({ w: 5.6, h: 2.4 }), drawOrderBias: 2, solid: true },
    { assetKey: 'world-v3-infrastructure/canyon-boundary-bend', sceneRole: 'wall', footprintTiles: freeze({ w: 5.6, h: 2.4 }), drawOrderBias: 2, solid: true },
    { assetKey: 'world-v3-infrastructure/canyon-boundary-buttress', sceneRole: 'wall', footprintTiles: freeze({ w: 5.6, h: 2.4 }), drawOrderBias: 2, solid: true },
  ]),
  east: freezeArray([
    { assetKey: 'wo105-world/container-cover-line', sceneRole: 'container', footprintTiles: freeze({ w: 3.6, h: 1.6 }), drawOrderBias: 3, solid: true },
    { assetKey: 'level-1/prop/blue-gray-ruins1', sceneRole: 'wall', footprintTiles: freeze({ w: 2.6, h: 1.5 }), drawOrderBias: 3, solid: true },
    { assetKey: 'level-1/prop/brown-ruins2', sceneRole: 'wall', footprintTiles: freeze({ w: 2.6, h: 1.5 }), drawOrderBias: 3, solid: true },
  ]),
});

export const HMH_LEVEL_ONE_LAYOUT_V4 = freeze({
  id: 'level-1-crypto-wasteland-layout-v4',
  title: 'Crypto Wasteland Dual-Loop Pressure Layout',
  baseNavigation: 'hmh-level-1-world-blueprint-v3',
  intent: 'Keep the certified terrain grid while replacing sparse placement and radial spawn noise with authored combat loops, convergence, and consistent asset families.',
  routes: freeze({
    mainSpine: freeze(['spawn', 'ghost-saloon-square', 'crossroads-trading-post', 'frontier-town-square', 'rugpull-gulch-boss-yard', 'extraction']),
    northRiskLoop: freeze(['ghost-saloon-square', 'dry-forest-cave', 'mesa-overlook', 'crossroads-trading-post']),
    southRewardLoop: freeze(['ghost-saloon-square', 'old-hashrate-camp', 'oasis-lakeside', 'crossroads-trading-post']),
    finalApproach: freeze(['crossroads-trading-post', 'frontier-town-square', 'rugpull-gulch-boss-yard', 'extraction']),
  }),
  zones: ZONES,
  traversal: freeze({
    mainClearTiles: 5,
    loopClearTiles: 4,
    bridgeClearTiles: 5,
    spawnSafeRadiusTiles: 7,
    boundaryPolicy: 'visible-side-specific-overlapping-strips',
  }),
  performance: freeze({
    visibleEnemyTarget: 60,
    attackTokenTarget: 5,
    intent: 'late pressure comes from role mix, elites, formations, and threat beats rather than 100+ independently simulated bodies',
  }),
});

export function levelOneLayoutV4ZoneAt(worldX = 0, worldY = 0) {
  let selected = null;
  for (const candidate of ZONES) {
    const world = authoredCellToWorld(candidate.authoredX, candidate.authoredY);
    const distanceTiles = Math.hypot((Number(worldX) || 0) - world.x, (Number(worldY) || 0) - world.y);
    if (!selected || distanceTiles < selected.distanceTiles) selected = { zone: candidate, distanceTiles };
  }
  return selected ? freeze({ ...selected.zone, distanceTiles: Number(selected.distanceTiles.toFixed(3)) }) : null;
}

function stableLaneIndex(seed, zoneId, laneCount) {
  let hash = (Number(seed) || 0) >>> 0;
  for (let i = 0; i < zoneId.length; i += 1) hash = Math.imul(hash ^ zoneId.charCodeAt(i), 16777619) >>> 0;
  return laneCount ? hash % laneCount : 0;
}

function normalizedLaneRole(value = '') {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const LANE_ROLE_TELEGRAPH_PLANS = Object.freeze({
  ranged: Object.freeze({ color: '#ff5ce1', fillColor: 'rgba(255, 92, 225, 0.12)', marker: 'diamond', lineDash: Object.freeze([7, 4]) }),
  rusher: Object.freeze({ color: '#ffe84d', fillColor: 'rgba(255, 232, 77, 0.12)', marker: 'forward-chevron', lineDash: Object.freeze([]) }),
  flanker: Object.freeze({ color: '#19f7ff', fillColor: 'rgba(25, 247, 255, 0.11)', marker: 'split-chevron', lineDash: Object.freeze([4, 3]) }),
  elite: Object.freeze({ color: '#ff476f', fillColor: 'rgba(255, 71, 111, 0.14)', marker: 'double-ring', lineDash: Object.freeze([]) }),
  'boss-add': Object.freeze({ color: '#ff9a3d', fillColor: 'rgba(255, 154, 61, 0.13)', marker: 'guard-brackets', lineDash: Object.freeze([9, 3]) }),
});

export function levelOneSpawnLaneTelegraphForRole(laneRole = null) {
  const role = normalizedLaneRole(laneRole);
  if (role === 'chaser') return LANE_ROLE_TELEGRAPH_PLANS.rusher;
  if (role === 'boss') return LANE_ROLE_TELEGRAPH_PLANS['boss-add'];
  return LANE_ROLE_TELEGRAPH_PLANS[role] ?? null;
}

export function levelOneEnemyMatchesSpawnLaneRole(enemy = {}, laneRole = 'mixed') {
  const role = normalizedLaneRole(laneRole);
  if (role === 'mixed' || role === 'support') return !enemy?.boss;
  if (enemy?.boss) return false;

  const preferredRangeMode = normalizedLaneRole(enemy?.preferredRangeMode);
  const signature = normalizedLaneRole(`${enemy?.id ?? ''} ${enemy?.class ?? ''} ${enemy?.aiArchetype ?? ''}`);
  const ranged = preferredRangeMode === 'ranged';
  const melee = preferredRangeMode === 'melee' || (!preferredRangeMode && !ranged);
  const rusher = melee && /(swarm|shambler|panic|charge|lunge|rusher|chaser|pack|skater|yanker|burrow|strike)/.test(signature);
  const flanker = /(flank|pincer|ambush|circle|overshoot|dash|yanker|hook|reaper|angler|zealot)/.test(signature);
  const elite = /(elite|captain|commander|mini-boss|miniboss|armored|bruiser|zealot|sheriff|reaper|golem)/.test(signature);

  if (role === 'ranged') return ranged;
  if (role === 'chaser' || role === 'rusher') return rusher;
  if (role === 'flanker') return flanker;
  if (role === 'elite') return elite;
  if (role === 'boss-add' || role === 'boss') return elite || ranged;
  return false;
}

export function levelOneSpawnLaneForcesElite(laneRole = null) {
  return normalizedLaneRole(laneRole) === 'elite';
}

export function levelOneLayoutV4SpawnRequest({ playerX = 0, playerY = 0, seed = 0, minDistanceTiles = 18 } = {}) {
  const zoneRecord = levelOneLayoutV4ZoneAt(playerX, playerY);
  const lanes = zoneRecord?.spawnLanes?.length ? zoneRecord.spawnLanes : [{ id: 'fallback-east', angleDeg: 0, role: 'mixed' }];
  const lane = lanes[stableLaneIndex(seed, zoneRecord?.id ?? 'fallback', lanes.length)];
  const angleRadians = ((Number(lane.angleDeg) || 0) * Math.PI) / 180;
  const distanceTiles = Math.max(18, Number(minDistanceTiles) || 18);
  return freeze({
    zoneId: zoneRecord?.id ?? 'fallback',
    laneId: lane.id,
    laneRole: lane.role,
    angleRadians: Number(angleRadians.toFixed(6)),
    distanceTiles: Number(distanceTiles.toFixed(3)),
    desiredX: Number(((Number(playerX) || 0) + Math.cos(angleRadians) * distanceTiles).toFixed(3)),
    desiredY: Number(((Number(playerY) || 0) + Math.sin(angleRadians) * distanceTiles).toFixed(3)),
  });
}

export function levelOneLayoutV4BoundaryPaletteForSide(side = 'north', index = 0) {
  const palette = BOUNDARY_PALETTES[side] ?? BOUNDARY_PALETTES.north;
  return palette[Math.abs(Math.round(Number(index) || 0)) % palette.length];
}
