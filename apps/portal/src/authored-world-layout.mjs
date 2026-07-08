// Authored World Layout for Level 1: Crypto Wasteland
//
// Instead of random procedural scatter, this module defines explicit landmark
// placements, prop clusters, and visual staging for each district belt.
// The district generator and scene template system use these authored layouts
// to place objects at deterministic world coordinates that create a readable,
// handcrafted-feeling game world.
//
// Each district gets:
// - Landmark placements (the big readable structures that define the area)
// - Prop clusters (organized groups of props that create visual rhythm)
// - Edge treatments (transitions between biomes)
// - Navigation cues (signposts, lights, path markers that guide the player)

import { SCENE_CELL } from './scene-templates.mjs';
import { aaaLevelOneSceneObjectsForDistrict } from './hmh-level-one-aaa-slices.mjs';

// World tile size in pixels (matches renderer's tile size)
const TILE_SIZE = 30;
const CELL_SIZE = SCENE_CELL ?? 7; // scene cells per macro-cell

// Helper: create a placed object with world coordinates
function placed(id, assetKey, role, gridX, gridY, { solid = true, zHeight = 0, variant = 0, ...metadata } = {}) {
  return Object.freeze({ id, assetKey, role, gridX, gridY, solid, zHeight, variant, ...metadata });
}

// Helper: create a prop cluster (group of related props at relative positions)
function cluster(id, centerGridX, centerGridY, props) {
  return Object.freeze({
    id,
    centerGridX,
    centerGridY,
    props: Object.freeze(props.map((p) => placed(
      `${id}-${p.suffix}`,
      p.assetKey,
      p.role,
      centerGridX + (p.dx ?? 0),
      centerGridY + (p.dy ?? 0),
      { solid: p.solid ?? true, zHeight: p.zHeight ?? 0, variant: p.variant ?? 0 },
    ))),
  });
}

const PIXELLAB_LEVEL1_CANDIDATE_PREFIX = 'level1-reference-style/candidates';

export const LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS = Object.freeze({
  brokenHighwayLane: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/roads-and-paths/roads-and-paths__broken-highway-lane`,
  gasStationForecourtConcrete: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/roads-and-paths/roads-and-paths__gas-station-forecourt-concrete`,
  ghostTownCobbleDirt: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/roads-and-paths/roads-and-paths__ghost-town-main-street-cobble-dirt-blend`,
  farmRoadSpur: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/roads-and-paths/roads-and-paths__farm-road-spur`,
  bridgePlanksRegenerated: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/regenerated-terrain/bridge-planks-regenerated`,
  extractionFlareRoadRegenerated: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/regenerated-terrain/extraction-flare-road-regenerated`,
  wornGrassClean: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/regenerated-terrain/worn-grass-clean-regenerated`,
  dockSupportClean: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/regenerated-terrain/dock-support-clean-regenerated`,
  animatedRiverStrip: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/water-and-shorelines/water-and-shorelines__animated-river-strip`,
  rockyBank: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/water-and-shorelines/water-and-shorelines__rocky-bank`,
  gasStationCanopy: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/buildings-and-walls/buildings-and-walls__gas-station-canopy`,
  saloonFalseFront: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/buildings-and-walls/buildings-and-walls__saloon-false-front`,
  farmBarnSilo: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/buildings-and-walls/buildings-and-walls__farm-barn-silo`,
  stoneBrickWallSegments: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/buildings-and-walls/buildings-and-walls__stone-brick-wall-segments`,
  bossYardGate: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/buildings-and-walls/buildings-and-walls__boss-yard-gate`,
  litecoinExtractionArch: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/buildings-and-walls/buildings-and-walls__litecoin-extraction-arch`,
  cactusWalls: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/trees-rocks-and-natural-blockers/trees-rocks-and-natural-blockers__cactus-walls`,
  mesaBoulders: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/trees-rocks-and-natural-blockers/trees-rocks-and-natural-blockers__mesa-boulders`,
  pineOakClusters: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/trees-rocks-and-natural-blockers/trees-rocks-and-natural-blockers__pine-oak-clusters`,
  riverRocks: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/trees-rocks-and-natural-blockers/trees-rocks-and-natural-blockers__river-rocks`,
  cacheCrate: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/combat-readable-props/combat-readable-props__cache-crate`,
  gasPumpExplosive: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/combat-readable-props/combat-readable-props__gas-pump-explosive`,
  bossGateMarkers: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/combat-readable-props/combat-readable-props__boss-gate-markers`,
  pickupResourceGlowDecals: `${PIXELLAB_LEVEL1_CANDIDATE_PREFIX}/combat-readable-props/combat-readable-props__pickup-resource-glow-decals`,
});

function pixellabUpgrade(id, assetKey, role, gridX, gridY, data = {}) {
  return placed(id, assetKey, role, gridX, gridY, {
    solid: data.solid ?? true,
    zHeight: data.zHeight ?? 1,
    variant: data.variant ?? 0,
    pixelLabRuntimeUpgrade: true,
    source: 'hmh-level-one-pixellab-reference-style-candidates-v2',
    routeBeat: data.routeBeat ?? null,
    mapRole: data.mapRole ?? role,
    notes: data.notes ?? 'PixelLab candidate integrated through authored scene-object path; still subject to final atlas/collision cleanup.',
  });
}

export const LEVEL_1_PIXELLAB_RUNTIME_MAP_UPGRADES = Object.freeze({
  desertApproach: Object.freeze([
    pixellabUpgrade('pxl-da-broken-highway-lane', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.brokenHighwayLane, 'road', 4, 5, { solid: false, routeBeat: 'spawn', zHeight: 0 }),
    pixellabUpgrade('pxl-da-broken-highway-shoulder-north', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.brokenHighwayLane, 'road', 4, 3, { solid: false, routeBeat: 'spawn', zHeight: 0, notes: 'north shoulder dressing keeps spawn readable without covering the hero' }),
    pixellabUpgrade('pxl-da-broken-highway-shoulder-south', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.brokenHighwayLane, 'road', 4, 7, { solid: false, routeBeat: 'spawn', zHeight: 0, notes: 'south shoulder dressing frames the entry lane without blocking movement' }),
    pixellabUpgrade('pxl-da-gas-station-forecourt', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasStationForecourtConcrete, 'road', 10, 5, { solid: false, routeBeat: 'arena', zHeight: 0 }),
    pixellabUpgrade('pxl-da-gas-station-apron-north', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasStationForecourtConcrete, 'road', 10, 3, { solid: false, routeBeat: 'arena', zHeight: 0 }),
    pixellabUpgrade('pxl-da-gas-station-apron-south', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasStationForecourtConcrete, 'road', 10, 7, { solid: false, routeBeat: 'arena', zHeight: 0 }),
    pixellabUpgrade('pxl-da-gas-station-canopy', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasStationCanopy, 'landmark', 9, 3, { routeBeat: 'arena', zHeight: 4 }),
    pixellabUpgrade('pxl-da-gas-pump-forecourt', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasPumpExplosive, 'crate', 12, 6, { routeBeat: 'arena', zHeight: 1 }),
    pixellabUpgrade('pxl-da-cache-crate-forecourt', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.cacheCrate, 'crate', 13, 4, { routeBeat: 'arena', zHeight: 1 }),
    pixellabUpgrade('pxl-da-mesa-boulders', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.mesaBoulders, 'rock', 24, 5, { routeBeat: 'pressure', zHeight: 2 }),
    pixellabUpgrade('pxl-da-mesa-boulders-north-edge', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.mesaBoulders, 'rock', 22, 2, { routeBeat: 'pressure', zHeight: 2 }),
    pixellabUpgrade('pxl-da-cactus-wall', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.cactusWalls, 'cactus', 20, 3, { routeBeat: 'pressure', zHeight: 2 }),
    pixellabUpgrade('pxl-da-cactus-wall-south-edge', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.cactusWalls, 'cactus', 20, 8, { routeBeat: 'pressure', zHeight: 2 }),
    pixellabUpgrade('pxl-da-cache-crate', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.cacheCrate, 'crate', 22, 6, { routeBeat: 'pressure', zHeight: 1 }),
  ]),
  ghostTown: Object.freeze([
    pixellabUpgrade('pxl-gt-mainstreet-cobble', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.ghostTownCobbleDirt, 'road', 40, 6, { solid: false, routeBeat: 'arena', zHeight: 0 }),
    pixellabUpgrade('pxl-gt-mainstreet-cobble-west', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.ghostTownCobbleDirt, 'road', 36, 6, { solid: false, routeBeat: 'arena', zHeight: 0 }),
    pixellabUpgrade('pxl-gt-mainstreet-cobble-east', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.ghostTownCobbleDirt, 'road', 44, 6, { solid: false, routeBeat: 'arena', zHeight: 0 }),
    pixellabUpgrade('pxl-gt-saloon-false-front', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.saloonFalseFront, 'landmark', 40, 2, { routeBeat: 'arena', zHeight: 4 }),
    pixellabUpgrade('pxl-gt-saloon-false-front-wing', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.saloonFalseFront, 'landmark', 44, 2, { routeBeat: 'arena', zHeight: 4 }),
    pixellabUpgrade('pxl-gt-stone-wall-segments', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.stoneBrickWallSegments, 'wall', 38, 6, { routeBeat: 'arena', zHeight: 2 }),
    pixellabUpgrade('pxl-gt-stone-wall-east', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.stoneBrickWallSegments, 'wall', 46, 6, { routeBeat: 'arena', zHeight: 2 }),
    pixellabUpgrade('pxl-gt-gas-pump-explosive', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasPumpExplosive, 'crate', 48, 7, { routeBeat: 'pressure', zHeight: 1 }),
    pixellabUpgrade('pxl-gt-cache-crate-alley', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.cacheCrate, 'crate', 42, 8, { routeBeat: 'pressure', zHeight: 1 }),
  ]),
  countryRoad: Object.freeze([
    pixellabUpgrade('pxl-cr-bridge-planks', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bridgePlanksRegenerated, 'bridge', 62, 6, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-cr-bridge-approach-west', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.farmRoadSpur, 'road', 59, 6, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-cr-bridge-approach-east', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.farmRoadSpur, 'road', 65, 6, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-cr-animated-river-strip', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.animatedRiverStrip, 'water-strip', 62, 7, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-cr-animated-river-north', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.animatedRiverStrip, 'water-strip', 62, 4, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-cr-rocky-bank', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.rockyBank, 'edge', 61, 5, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-cr-rocky-bank-south', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.rockyBank, 'edge', 64, 8, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-cr-pine-oak-clusters', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.pineOakClusters, 'tree', 57, 2, { routeBeat: 'loop', zHeight: 3 }),
    pixellabUpgrade('pxl-cr-pine-oak-east-edge', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.pineOakClusters, 'tree', 67, 2, { routeBeat: 'loop', zHeight: 3 }),
    pixellabUpgrade('pxl-cr-river-rocks', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.riverRocks, 'rock', 64, 5, { routeBeat: 'chokepoint', zHeight: 1 }),
  ]),
  residentialEdge: Object.freeze([
    pixellabUpgrade('pxl-re-farm-road-spur', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.farmRoadSpur, 'road', 78, 6, { solid: false, routeBeat: 'loop', zHeight: 0 }),
    pixellabUpgrade('pxl-re-farm-road-spur-west', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.farmRoadSpur, 'road', 75, 6, { solid: false, routeBeat: 'loop', zHeight: 0 }),
    pixellabUpgrade('pxl-re-worn-grass-clean', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.wornGrassClean, 'road', 81, 6, { solid: false, routeBeat: 'loop', zHeight: 0 }),
    pixellabUpgrade('pxl-re-worn-grass-yard', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.wornGrassClean, 'road', 82, 4, { solid: false, routeBeat: 'loop', zHeight: 0 }),
    pixellabUpgrade('pxl-re-farm-barn-silo', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.farmBarnSilo, 'barn', 83, 4, { routeBeat: 'loop', zHeight: 4 }),
    pixellabUpgrade('pxl-re-farm-barn-silo-second', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.farmBarnSilo, 'barn', 86, 3, { routeBeat: 'loop', zHeight: 4 }),
    pixellabUpgrade('pxl-re-dock-support-clean', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.dockSupportClean, 'bridge', 84, 7, { solid: false, routeBeat: 'chokepoint', zHeight: 0 }),
    pixellabUpgrade('pxl-re-river-rocks-yard-edge', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.riverRocks, 'rock', 87, 7, { routeBeat: 'chokepoint', zHeight: 1 }),
    pixellabUpgrade('pxl-re-pickup-glow-yard', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.pickupResourceGlowDecals, 'sign', 80, 7, { solid: false, routeBeat: 'loop', zHeight: 0 }),
  ]),
  innerCityThreshold: Object.freeze([
    pixellabUpgrade('pxl-ic-boss-yard-gate', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bossYardGate, 'gate', 92, 6, { routeBeat: 'boss', zHeight: 3 }),
    pixellabUpgrade('pxl-ic-boss-yard-gate-left', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bossYardGate, 'gate', 89, 6, { routeBeat: 'boss', zHeight: 3 }),
    pixellabUpgrade('pxl-ic-boss-gate-markers', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bossGateMarkers, 'gate', 90, 6, { routeBeat: 'boss', zHeight: 2 }),
    pixellabUpgrade('pxl-ic-boss-gate-markers-right', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bossGateMarkers, 'gate', 94, 6, { routeBeat: 'boss', zHeight: 2 }),
    pixellabUpgrade('pxl-ic-extraction-flare-road', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.extractionFlareRoadRegenerated, 'road', 97, 5, { solid: false, routeBeat: 'extract', zHeight: 0 }),
    pixellabUpgrade('pxl-ic-extraction-flare-approach', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.extractionFlareRoadRegenerated, 'road', 94, 5, { solid: false, routeBeat: 'extract', zHeight: 0 }),
    pixellabUpgrade('pxl-ic-litecoin-extraction-arch', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.litecoinExtractionArch, 'landmark', 99, 4, { routeBeat: 'extract', zHeight: 4 }),
    pixellabUpgrade('pxl-ic-litecoin-extraction-arch-backdrop', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.litecoinExtractionArch, 'landmark', 101, 3, { routeBeat: 'extract', zHeight: 4 }),
    pixellabUpgrade('pxl-ic-pickup-glow-decals', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.pickupResourceGlowDecals, 'sign', 96, 6, { solid: false, routeBeat: 'extract', zHeight: 0 }),
    pixellabUpgrade('pxl-ic-cache-crate-exit', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.cacheCrate, 'crate', 95, 7, { routeBeat: 'extract', zHeight: 1 }),
  ]),
});

function cityPrefabStamp(id, assetKey, role, gridX, gridY, routeBeat, noirPurpose, data = {}) {
  return placed(id, assetKey, role, gridX, gridY, {
    solid: data.solid ?? (role !== 'backdrop' && role !== 'lamp' && role !== 'sign' && role !== 'edge'),
    zHeight: data.zHeight ?? (role === 'backdrop' ? 7 : role === 'billboard' ? 5 : 2),
    variant: data.variant ?? 0,
    districtId: 'inner-city-threshold',
    routeBeat,
    noirPrefabStamp: true,
    silhouetteSafe: true,
    source: 'level1-noir-city-prefab-stamps-v1',
    noirPurpose,
    acceptance: data.acceptance ?? 'anchors the city seam without blocking the combat lane or hiding enemy tells',
  });
}

export const LEVEL_1_NOIR_CITY_PREFAB_STAMPS = Object.freeze({
  id: 'level1-noir-city-prefab-stamps-v1',
  assetPolicy: 'reuse-existing-city-and-curated-assets',
  levelId: 'level-1-crypto-wasteland',
  stamps: Object.freeze([
    cityPrefabStamp('wo51-ic-skyline-backdrop', 'level2-final-city/chrome-tower-facade', 'backdrop', 92, 0, 'boss', 'distant glass-tower skyline backlight behind the boss yard, kept non-solid so it cannot clutter the lane', { solid: false, zHeight: 8 }),
    cityPrefabStamp('wo51-ic-ticker-billboard', 'level2-final-city/ticker-billboard-loop', 'billboard', 91, 2, 'boss', 'billboard glow frames the boss gate and gives BLACKOUT a safe readable backlight', { zHeight: 5 }),
    cityPrefabStamp('wo51-ic-boss-gate-lamps', 'street/street-lamp', 'lamp', 90, 5, 'boss', 'paired sodium lamps mark the boss/add gate silhouettes without becoming blockers', { solid: false, zHeight: 3 }),
    cityPrefabStamp('wo51-ic-boss-gate-marker', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bossGateMarkers, 'gate', 92, 6, 'boss', 'gate marker proves the boss entrance before spawns arrive and keeps the showdown readable', { zHeight: 2 }),
    cityPrefabStamp('wo51-ic-neon-exit-horizon', 'level2-final-city/elevator-shaft-glow', 'backdrop', 98, 1, 'extract', 'vertical neon exit shaft pulls the eye toward Litecoin City after the boss', { solid: false, zHeight: 7 }),
    cityPrefabStamp('wo51-ic-exit-lamp-arrow', 'street/street-lamp', 'lamp', 97, 5, 'extract', 'low cyan/gold exit lamp reads as an extraction arrow while preserving negative space', { solid: false, zHeight: 3 }),
    cityPrefabStamp('wo51-ic-extraction-arch-repeat', LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.litecoinExtractionArch, 'gate', 99, 4, 'extract', 'exit/city arch confirms the road out without starting a new asset batch', { zHeight: 4 }),
  ]),
});

// ============================================================================
// LEVEL 1: CRYPTO WASTELAND — Authored District Layouts
// Each district is a ~35-tile-wide band along the main spine.
// Grid coordinates are in world tiles (30px each).
// ============================================================================

export const LEVEL_1_AUTHORED_LAYOUT = Object.freeze({
  desertApproach: Object.freeze({
    districtId: 'desert-approach',
    // The entry zone: open sand flats with salvage debris and a road spine
    landmarks: Object.freeze([
      placed('da-landmark-salvage', 'crypto/landmark-gas-station', 'landmark', 8, 4, { solid: true, zHeight: 3 }),
      placed('da-landmark-canyon', 'crypto/canyon-cliff-edge', 'wall', 24, 1, { solid: true, zHeight: 4 }),
      placed('da-landmark-canyon2', 'crypto/canyon-cliff-edge', 'wall', 28, 1, { solid: true, zHeight: 4 }),
    ]),
    propClusters: Object.freeze([
      // Roadside salvage scatter near the entrance
      cluster('da-salvage-cluster', 5, 6, [
        { suffix: 'rig', assetKey: 'crypto/desert-boulder', role: 'rock', dx: 0, dy: 0 },
        { suffix: 'debris', assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 2, dy: 1 },
        { suffix: 'barrel', assetKey: 'interior/stacked-boxes', role: 'crate', dx: -1, dy: 2, solid: true },
      ]),
      // Dry creek bed crossing
      cluster('da-creek-crossing', 14, 5, [
        { suffix: 'bed', assetKey: 'construct/river-straight', role: 'water-strip', dx: 0, dy: 0, solid: false },
        { suffix: 'bridge', assetKey: 'construct/wood-bridge', role: 'bridge', dx: 0, dy: 0, solid: true },
        { suffix: 'rock1', assetKey: 'crypto/desert-boulder', role: 'rock', dx: -2, dy: 1 },
        { suffix: 'rock2', assetKey: 'crypto/desert-boulder', role: 'rock', dx: 2, dy: -1 },
      ]),
      // Cactus line along the road
      cluster('da-cactus-line', 18, 3, [
        { suffix: 'c1', assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 0, dy: 0 },
        { suffix: 'c2', assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 3, dy: 0 },
        { suffix: 'c3', assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 6, dy: 1 },
      ]),
      // Utility pole line guiding toward ghost town
      cluster('da-utility-line', 20, 7, [
        { suffix: 'p1', assetKey: 'crypto/utility-pole', role: 'pole', dx: 0, dy: 0, solid: false },
        { suffix: 'p2', assetKey: 'crypto/utility-pole', role: 'pole', dx: 4, dy: 0, solid: false },
        { suffix: 'p3', assetKey: 'crypto/utility-pole', role: 'pole', dx: 8, dy: 0, solid: false },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'canyon-cliff-line',
      southBorder: 'sand-flat-fade',
      transitionTo: 'ghost-town',
      transitionCue: 'false-fronts appear on the horizon, road widens into main street',
    }),
    navigationCues: Object.freeze([
      { id: 'da-sign-bus-stop', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 4, gridY: 5, text: 'BROKEN HIGHWAY / LTC BUS STOP' },
      { id: 'da-sign-gas', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 9, gridY: 6, text: 'GAS STATION FORECOURT ARENA' },
      { id: 'da-sign-mesa', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 24, gridY: 6, text: 'MESA CUT / BOULDER ROAD' },
    ]),
  }),

  ghostTown: Object.freeze({
    districtId: 'ghost-town',
    // The combat knot: abandoned main street with false fronts and a saloon
    landmarks: Object.freeze([
      placed('gt-landmark-saloon', 'crypto/ghost-saloon-front', 'landmark', 40, 2, { solid: true, zHeight: 4 }),
      placed('gt-landmark-storefront', 'crypto/ghost-boarded-storefront', 'landmark', 44, 5, { solid: true, zHeight: 3 }),
      placed('gt-landmark-storefront2', 'crypto/ghost-boarded-storefront', 'landmark', 36, 5, { solid: true, zHeight: 3 }),
      placed('gt-landmark-warehouse', 'crypto/industrial-warehouse-facade', 'landmark', 48, 3, { solid: true, zHeight: 3 }),
    ]),
    propClusters: Object.freeze([
      // Main street wagon barricade
      cluster('gt-wagon-barricade', 42, 7, [
        { suffix: 'wagon', assetKey: 'interior/stacked-boxes', role: 'crate', dx: 0, dy: 0 },
        { suffix: 'crate1', assetKey: 'interior/stacked-boxes', role: 'crate', dx: 1, dy: 1 },
        { suffix: 'crate2', assetKey: 'interior/stacked-boxes', role: 'crate', dx: -1, dy: -1 },
      ]),
      // False-front cover rhythm
      cluster('gt-cover-line', 38, 6, [
        { suffix: 'fence1', assetKey: 'construct/fence-segment', role: 'fence', dx: 0, dy: 0 },
        { suffix: 'fence2', assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 0 },
        { suffix: 'post', assetKey: 'construct/fence-post', role: 'post', dx: 1, dy: 0 },
      ]),
      // Water tower base (sniper nest landmark)
      cluster('gt-water-tower', 46, 2, [
        { suffix: 'base', assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
        { suffix: 'fence', assetKey: 'construct/fence-gate', role: 'fence', dx: 1, dy: 1 },
      ]),
      // Lantern string for night sightline
      cluster('gt-lantern-line', 40, 4, [
        { suffix: 'lamp1', assetKey: 'street/street-lamp', role: 'lamp', dx: 0, dy: 0, solid: false },
        { suffix: 'lamp2', assetKey: 'street/street-lamp', role: 'lamp', dx: 4, dy: 0, solid: false },
        { suffix: 'lamp3', assetKey: 'street/street-lamp', role: 'lamp', dx: 8, dy: 0, solid: false },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'building-facade-line',
      southBorder: 'sand-to-dirt-transition',
      transitionTo: 'country-road',
      transitionCue: 'main street narrows to a dirt road with roadside pull-offs',
    }),
    navigationCues: Object.freeze([
      { id: 'gt-sign-mainstreet', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 35, gridY: 6, text: 'GHOST TOWN MAIN STREET' },
      { id: 'gt-sign-farm', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 45, gridY: 6, text: 'FARMSTEAD LOOP →' },
    ]),
  }),

  countryRoad: Object.freeze({
    districtId: 'country-road',
    // The hub: branching crossroads with trading post and wagon circle
    landmarks: Object.freeze([
      placed('cr-landmark-signpost', 'street/bus-stop-sign', 'sign', 60, 5, { solid: false, zHeight: 2 }),
      placed('cr-landmark-tree-line', 'crypto/forest-tree-line', 'tree', 68, 1, { solid: true, zHeight: 3 }),
      placed('cr-landmark-tree-line2', 'crypto/forest-tree-line', 'tree', 55, 1, { solid: true, zHeight: 3 }),
    ]),
    propClusters: Object.freeze([
      // Crossroads wagon circle (the hub landmark)
      cluster('cr-wagon-circle', 60, 6, [
        { suffix: 'wagon1', assetKey: 'interior/stacked-boxes', role: 'crate', dx: 0, dy: 0 },
        { suffix: 'wagon2', assetKey: 'interior/stacked-boxes', role: 'crate', dx: 2, dy: 1 },
        { suffix: 'wagon3', assetKey: 'interior/stacked-boxes', role: 'crate', dx: -2, dy: 1 },
        { suffix: 'wagon4', assetKey: 'interior/stacked-boxes', role: 'crate', dx: 0, dy: 2 },
      ]),
      // Roadside utility poles
      cluster('cr-utility-line', 58, 7, [
        { suffix: 'p1', assetKey: 'crypto/utility-pole', role: 'pole', dx: 0, dy: 0, solid: false },
        { suffix: 'p2', assetKey: 'crypto/utility-pole', role: 'pole', dx: 5, dy: 0, solid: false },
      ]),
      // Fence line separating road from field
      cluster('cr-fence-line', 62, 3, [
        { suffix: 'f1', assetKey: 'construct/fence-segment', role: 'fence', dx: 0, dy: 0 },
        { suffix: 'f2', assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 0 },
        { suffix: 'f3', assetKey: 'construct/fence-segment', role: 'fence', dx: 4, dy: 0 },
        { suffix: 'f4', assetKey: 'construct/fence-post', role: 'post', dx: 1, dy: 0 },
        { suffix: 'f5', assetKey: 'construct/fence-post', role: 'post', dx: 3, dy: 0 },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'tree-line-to-forest',
      southBorder: 'dirt-to-grass-transition',
      transitionTo: 'residential-edge',
      transitionCue: 'dirt road meets paved road, lawns and hedges appear',
    }),
    navigationCues: Object.freeze([
      { id: 'cr-sign-river', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 60, gridY: 3, text: 'RIVER BRIDGE / WASH CROSSING' },
      { id: 'cr-sign-farm', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 60, gridY: 8, text: '← FARMSTEAD SIDE LOOP' },
      { id: 'cr-sign-mesa', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 63, gridY: 5, text: '→ MESA CUT / EXTRACTION' },
    ]),
  }),

  residentialEdge: Object.freeze({
    districtId: 'residential-edge',
    // The water contrast zone: oasis, mesa, and city seam setup
    landmarks: Object.freeze([
      placed('re-landmark-hedge', 'crypto/residential-hedge-run', 'hedge', 78, 4, { solid: true, zHeight: 2 }),
      placed('re-landmark-shoreline', 'crypto/shoreline-water-edge', 'water', 84, 7, { solid: false, zHeight: 0 }),
      placed('re-landmark-cliff', 'crypto/canyon-cliff-edge', 'wall', 80, 1, { solid: true, zHeight: 4 }),
    ]),
    propClusters: Object.freeze([
      // Oasis lakeside
      cluster('re-oasis', 84, 6, [
        { suffix: 'water1', assetKey: 'construct/river-straight', role: 'water-strip', dx: 0, dy: 0, solid: false },
        { suffix: 'water2', assetKey: 'construct/river-straight', role: 'water-strip', dx: 2, dy: 0, solid: false },
        { suffix: 'water3', assetKey: 'construct/river-straight', role: 'water-strip', dx: -2, dy: 0, solid: false },
        { suffix: 'log', assetKey: 'nature/fallen-log', role: 'log', dx: 1, dy: -1 },
        { suffix: 'reed1', assetKey: 'crypto/forest-tree-line', role: 'tree', dx: 3, dy: -2 },
        { suffix: 'bench', assetKey: 'street/park-bench', role: 'bench', dx: -3, dy: -1 },
      ]),
      // Hedge maze entrance
      cluster('re-hedge-line', 78, 5, [
        { suffix: 'h1', assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 0 },
        { suffix: 'h2', assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 3, dy: 0 },
        { suffix: 'gate', assetKey: 'construct/fence-gate', role: 'gate', dx: 1, dy: 0 },
      ]),
      // Farmstead side-loop: fences/crops/barn-silo silhouettes give the optional
      // spur a readable rural identity instead of another generic hedge pocket.
      cluster('re-farmstead-loop', 78, 6, [
        { suffix: 'gate', assetKey: 'construct/fence-gate', role: 'farm', dx: -2, dy: 0 },
        { suffix: 'fence-a', assetKey: 'construct/fence-segment', role: 'farm', dx: -1, dy: 0 },
        { suffix: 'crop-a', assetKey: 'nature/flower-patch', role: 'crop', dx: 1, dy: 1, solid: false },
        { suffix: 'crop-b', assetKey: 'nature/bush', role: 'crop', dx: 3, dy: 1, solid: false },
        { suffix: 'barn', assetKey: 'crypto/ghost-boarded-storefront', role: 'barn', dx: 5, dy: -2, zHeight: 3 },
        { suffix: 'silo', assetKey: 'crypto/utility-pole', role: 'silo', dx: 7, dy: -1, solid: false, zHeight: 4 },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'mesa-cliff-line',
      southBorder: 'water-to-asphalt-transition',
      transitionTo: 'inner-city-threshold',
      transitionCue: 'sand and grass give way to cracked asphalt and neon skyline grows',
    }),
    navigationCues: Object.freeze([
      { id: 're-sign-farmstead', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 76, gridY: 5, text: 'FARMSTEAD SIDE LOOP' },
      { id: 're-sign-second-town', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 86, gridY: 6, text: 'SECOND TOWN / EXTRACTION YARD →' },
    ]),
  }),

  innerCityThreshold: Object.freeze({
    districtId: 'inner-city-threshold',
    // The Level 2 hand-off: cracked asphalt, barricades, neon growing
    landmarks: Object.freeze([
      placed('ic-landmark-billboard', 'crypto/innercity-billboard-frame', 'billboard', 92, 1, { solid: true, zHeight: 5 }),
      placed('ic-landmark-warehouse', 'crypto/industrial-warehouse-facade', 'landmark', 96, 4, { solid: true, zHeight: 3 }),
    ]),
    propClusters: Object.freeze([
      // Barricade line
      cluster('ic-barricade', 90, 6, [
        { suffix: 'wall1', assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
        { suffix: 'wall2', assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
        { suffix: 'fence', assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 1 },
      ]),
      // Road edge transition (dirt to asphalt)
      cluster('ic-road-edge', 88, 7, [
        { suffix: 'edge1', assetKey: 'crypto/ground-dirt-asphalt-edge', role: 'edge', dx: 0, dy: 0, solid: false },
        { suffix: 'edge2', assetKey: 'crypto/ground-dirt-asphalt-edge', role: 'edge', dx: 2, dy: 0, solid: false },
      ]),
      // Neon sign glow near city entrance
      cluster('ic-neon-glow', 94, 3, [
        { suffix: 'billboard1', assetKey: 'crypto/innercity-billboard-frame', role: 'billboard', dx: 0, dy: 0 },
        { suffix: 'pole', assetKey: 'crypto/utility-pole', role: 'pole', dx: -2, dy: 0, solid: false },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'warehouse-skyline',
      southBorder: 'asphalt-fade-to-city',
      transitionTo: 'level-2-litecoin-city',
      transitionCue: 'neon towers fill the horizon, asphalt meets city grid',
    }),
    navigationCues: Object.freeze([
      { id: 'ic-sign-extraction-yard', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 88, gridY: 5, text: 'SECOND TOWN / EXTRACTION YARD' },
      { id: 'ic-sign-extraction-pad', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 98, gridY: 5, text: 'LTC EXTRACTION PAD →' },
    ]),
  }),
});

// ============================================================================
// LEVEL 2: LITECOIN CITY — Authored District Layouts
// Urban hub-and-spoke with streets, plazas, and buildings.
// ============================================================================

export const LEVEL_2_AUTHORED_LAYOUT = Object.freeze({
  outerBoulevard: Object.freeze({
    districtId: 'outer-boulevard',
    landmarks: Object.freeze([
      placed('ob-landmark-ltc-monument', 'level2-final-city/ltc-monument-fountain', 'landmark', 8, 2, { solid: false, zHeight: 3 }),
      placed('ob-landmark-ticker', 'level2-final-city/ticker-billboard-loop', 'billboard', 14, 5, { solid: true, zHeight: 4 }),
      placed('ob-landmark-shopfront', 'crypto/ghost-boarded-storefront', 'building', 8, 2, { solid: true, zHeight: 4 }),
      placed('ob-landmark-cornerstore', 'crypto/ghost-boarded-storefront', 'building', 14, 5, { solid: true, zHeight: 3 }),
    ]),
    propClusters: Object.freeze([
      cluster('ob-street-clutter', 6, 6, [
        { suffix: 'trash', assetKey: 'interior/stacked-boxes', role: 'crate', dx: 0, dy: 0 },
        { suffix: 'cone', assetKey: 'construct/fence-post', role: 'post', dx: 2, dy: 0 },
        { suffix: 'bench', assetKey: 'street/park-bench', role: 'bench', dx: -1, dy: 1 },
      ]),
      cluster('ob-lamp-line', 5, 4, [
        { suffix: 'l1', assetKey: 'street/street-lamp', role: 'lamp', dx: 0, dy: 0, solid: false },
        { suffix: 'l2', assetKey: 'street/street-lamp', role: 'lamp', dx: 4, dy: 0, solid: false },
        { suffix: 'l3', assetKey: 'street/street-lamp', role: 'lamp', dx: 8, dy: 0, solid: false },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'shopfront-facade-line',
      southBorder: 'sidewalk-to-street',
      transitionTo: 'financial-core',
      transitionCue: 'shopfronts give way to glass towers and plazas',
    }),
    navigationCues: Object.freeze([
      { id: 'ob-sign-tram', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 4, gridY: 5, text: 'TRAM STOP / MARKET ROW' },
      { id: 'ob-sign-core', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 15, gridY: 6, text: '→ FINANCIAL CORE' },
    ]),
  }),

  financialCore: Object.freeze({
    districtId: 'financial-core',
    landmarks: Object.freeze([
      placed('fc-landmark-chrome-tower', 'level2-final-city/chrome-tower-facade', 'building', 28, 1, { solid: true, zHeight: 7 }),
      placed('fc-landmark-elevator', 'level2-final-city/elevator-shaft-glow', 'edge', 32, 2, { solid: false, zHeight: 6 }),
      placed('fc-landmark-server-racks', 'level2-final-city/server-rack-corridor', 'cover', 24, 4, { solid: true, zHeight: 3 }),
      placed('fc-landmark-tower', 'crypto/industrial-warehouse-facade', 'building', 28, 1, { solid: true, zHeight: 6 }),
      placed('fc-landmark-billboard', 'crypto/innercity-billboard-frame', 'billboard', 32, 2, { solid: true, zHeight: 5 }),
      placed('fc-landmark-warehouse', 'crypto/industrial-warehouse-facade', 'building', 24, 4, { solid: true, zHeight: 4 }),
    ]),
    propClusters: Object.freeze([
      cluster('fc-plaza', 30, 6, [
        { suffix: 'fountain', assetKey: 'construct/river-straight', role: 'water-strip', dx: 0, dy: 0, solid: false },
        { suffix: 'bench1', assetKey: 'street/park-bench', role: 'bench', dx: -2, dy: 0 },
        { suffix: 'bench2', assetKey: 'street/park-bench', role: 'bench', dx: 2, dy: 0 },
        { suffix: 'hedge', assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 2 },
      ]),
      cluster('fc-barricade', 26, 7, [
        { suffix: 'wall1', assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
        { suffix: 'wall2', assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
        { suffix: 'rig', assetKey: 'level2-final-city/mining-rig-array', role: 'landmark', dx: 3, dy: -1 },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'glass-tower-skyline',
      southBorder: 'plaza-to-street',
      transitionTo: 'luxury-neighborhoods',
      transitionCue: 'towers give way to gated drives and manicured lawns',
    }),
    navigationCues: Object.freeze([
      { id: 'fc-sign-ticker', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 29, gridY: 5, text: 'TICKER PLAZA' },
      { id: 'fc-sign-garden', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 34, gridY: 7, text: '→ GATED DISTRICT' },
    ]),
  }),

  luxuryNeighborhoods: Object.freeze({
    districtId: 'luxury-neighborhoods',
    landmarks: Object.freeze([
      placed('ln-landmark-privacy-hedge', 'level2-final-city/privacy-hedge-wall', 'hedge', 44, 3, { solid: true, zHeight: 2 }),
      placed('ln-landmark-greenhouse', 'level2-final-city/park-greenhouse-dome', 'landmark', 48, 2, { solid: true, zHeight: 4 }),
      placed('ln-landmark-hedge-maze', 'crypto/residential-hedge-run', 'hedge', 44, 3, { solid: true, zHeight: 2 }),
      placed('ln-landmark-mansion', 'crypto/ghost-saloon-front', 'building', 48, 2, { solid: true, zHeight: 4 }),
    ]),
    propClusters: Object.freeze([
      cluster('ln-garden', 42, 6, [
        { suffix: 'hedge1', assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 0 },
        { suffix: 'hedge2', assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 2, dy: 1 },
        { suffix: 'hedge3', assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 2 },
        { suffix: 'gate', assetKey: 'construct/fence-gate', role: 'gate', dx: 1, dy: 0 },
        { suffix: 'bench', assetKey: 'street/park-bench', role: 'bench', dx: 3, dy: 0 },
        { suffix: 'kiln', assetKey: 'level2-final-city/artisan-kiln-glow', role: 'hazard', dx: 5, dy: 1 },
      ]),
      cluster('ln-pool', 46, 5, [
        { suffix: 'water', assetKey: 'construct/river-straight', role: 'water-strip', dx: 0, dy: 0, solid: false },
        { suffix: 'edge1', assetKey: 'construct/brick-wall-segment', role: 'wall', dx: -1, dy: 0 },
        { suffix: 'edge2', assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'mansion-roofline',
      southBorder: 'lawn-to-boulevard',
      transitionTo: 'penthouse-rim',
      transitionCue: 'mansions shrink as rooftop helipads and skybridges appear',
    }),
    navigationCues: Object.freeze([
      { id: 'ln-sign-garden', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 42, gridY: 4, text: 'GARDEN COURT LOOP' },
      { id: 'ln-sign-penthouse', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 51, gridY: 6, text: '→ PENTHOUSE RIM' },
    ]),
  }),

  penthouseRim: Object.freeze({
    districtId: 'penthouse-rim',
    landmarks: Object.freeze([
      placed('pr-landmark-helipad', 'level2-final-city/rooftop-helipad-lights', 'landmark', 62, 1, { solid: false, zHeight: 3 }),
      placed('pr-landmark-ngmi-billboard', 'level2-final-city/storm-billboard-ngmi', 'billboard', 66, 2, { solid: true, zHeight: 5 }),
      placed('pr-landmark-billboard', 'crypto/innercity-billboard-frame', 'billboard', 62, 1, { solid: true, zHeight: 5 }),
      placed('pr-landmark-antenna', 'crypto/utility-pole', 'pole', 66, 2, { solid: false, zHeight: 4 }),
    ]),
    propClusters: Object.freeze([
      cluster('pr-rooftop', 60, 5, [
        { suffix: 'edge1', assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
        { suffix: 'edge2', assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
        { suffix: 'edge3', assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 2, dy: 0 },
        { suffix: 'vent', assetKey: 'interior/stacked-boxes', role: 'crate', dx: 0, dy: 2 },
      ]),
      cluster('pr-skybridge', 64, 4, [
        { suffix: 'bridge', assetKey: 'construct/wood-bridge', role: 'bridge', dx: 0, dy: 0 },
        { suffix: 'rail1', assetKey: 'construct/fence-segment', role: 'fence', dx: 0, dy: -1 },
        { suffix: 'rail2', assetKey: 'construct/fence-segment', role: 'fence', dx: 0, dy: 1 },
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'skyline-storm',
      southBorder: 'rooftop-edge',
      transitionTo: 'level-3-the-getaway',
      transitionCue: 'storm breaks, helicopter sounds, train visible on adjacent rooftop',
    }),
    navigationCues: Object.freeze([
      { id: 'pr-sign-skybridge', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 63, gridY: 5, text: 'SKYBRIDGE CHOKE' },
      { id: 'pr-sign-exit', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 66, gridY: 3, text: 'VIP EXIT / LEVEL 3 →' },
    ]),
  }),
});


// ============================================================================
// LEVEL 3: THE GETAWAY — authored finale chain
// Penthouse exit → skybridge fracture → Mainnet Express → extraction car.
// ============================================================================

export const LEVEL_3_AUTHORED_LAYOUT = Object.freeze({
  penthouseLaunchPad: Object.freeze({
    districtId: 'penthouse-launch-pad',
    landmarks: Object.freeze([
      placed('l3-pl-landmark-evac-lane', 'level3-final-getaway/penthouse-evac-lane', 'route', 4, 5, { solid: false, zHeight: 1 }),
      placed('l3-pl-landmark-chopper', 'level3-final-getaway/helipad-evac-chopper', 'landmark', 10, 2, { solid: false, zHeight: 4 }),
    ]),
    propClusters: Object.freeze([
      cluster('l3-pl-barricade', 6, 6, [
        { suffix: 'bags', assetKey: 'level3-final-getaway/vip-luggage-barricade', role: 'cover', dx: 0, dy: 0 },
        { suffix: 'garden', assetKey: 'level3-final-getaway/roof-garden-planter-row', role: 'cover', dx: 4, dy: -1 },
        { suffix: 'banner', assetKey: 'level3-final-getaway/wind-torn-banner-line', role: 'sign', dx: 8, dy: -2, solid: false },
        { suffix: 'stair', assetKey: 'level3-final-getaway/emergency-stair-glow', role: 'edge', dx: 11, dy: 1, solid: false, zHeight: 3 },
      ]),
    ]),
    edgeTreatment: Object.freeze({ northBorder: 'storm-roofline', southBorder: 'helipad-drop', transitionTo: 'skybridge-breakpoint', transitionCue: 'evac lane narrows toward a fractured glass skybridge' }),
    navigationCues: Object.freeze([
      { id: 'l3-pl-sign-bridge', assetKey: 'level3-final-getaway/mainnet-exit-sign', role: 'sign', gridX: 14, gridY: 5, text: '→ SKYBRIDGE BREAK' },
    ]),
  }),
  skybridgeBreakpoint: Object.freeze({
    districtId: 'skybridge-breakpoint',
    landmarks: Object.freeze([
      placed('l3-sb-landmark-fracture', 'level3-final-getaway/skybridge-fracture-span', 'bridge', 22, 4, { solid: true, zHeight: 2 }),
      placed('l3-sb-landmark-drop', 'level3-final-getaway/vertical-drop-parallax', 'backdrop', 26, 1, { solid: false, zHeight: 5 }),
    ]),
    propClusters: Object.freeze([
      cluster('l3-sb-warning', 22, 6, [
        { suffix: 'rail', assetKey: 'level3-final-getaway/warning-rail-blink', role: 'edge', dx: 0, dy: 0, solid: false },
        { suffix: 'glass', assetKey: 'level3-final-getaway/glass-floor-crack-web', role: 'hazard', dx: 3, dy: -1, solid: false },
        { suffix: 'ad', assetKey: 'level3-final-getaway/ad-panel-sparking', role: 'decor', dx: 6, dy: 0, solid: false },
        { suffix: 'drone', assetKey: 'level3-final-getaway/overhead-pursuit-drone', role: 'decor', dx: 9, dy: -2, solid: false, zHeight: 4 },
      ]),
    ]),
    edgeTreatment: Object.freeze({ northBorder: 'city-void', southBorder: 'glass-drop', transitionTo: 'mainnet-express', transitionCue: 'broken glass gives way to the train roof rush' }),
    navigationCues: Object.freeze([
      { id: 'l3-sb-sign-train', assetKey: 'level3-final-getaway/mainnet-exit-sign', role: 'sign', gridX: 31, gridY: 5, text: 'BOARD MAINNET EXPRESS →' },
    ]),
  }),
  mainnetExpress: Object.freeze({
    districtId: 'mainnet-express',
    landmarks: Object.freeze([
      placed('l3-me-landmark-roof-car', 'level3-final-getaway/mainnet-train-roof-car', 'train', 42, 4, { solid: true, zHeight: 2 }),
      placed('l3-me-landmark-conductor', 'level3-final-getaway/armored-conductor-car', 'train', 50, 4, { solid: true, zHeight: 3 }),
    ]),
    propClusters: Object.freeze([
      cluster('l3-me-speed-run', 42, 6, [
        { suffix: 'doors', assetKey: 'level3-final-getaway/train-door-seam-lights', role: 'edge', dx: 0, dy: 0, solid: false },
        { suffix: 'conduit', assetKey: 'level3-final-getaway/power-conduit-sparks', role: 'hazard', dx: 4, dy: -1, solid: false },
        { suffix: 'billboard', assetKey: 'level3-final-getaway/speed-line-billboard', role: 'sign', dx: 8, dy: -2, solid: false },
        { suffix: 'gap', assetKey: 'level3-final-getaway/coupler-gap-warning', role: 'hazard', dx: 11, dy: 1, solid: false },
      ]),
    ]),
    edgeTreatment: Object.freeze({ northBorder: 'speed-line-sky', southBorder: 'rail-gap', transitionTo: 'finale-extraction', transitionCue: 'conductor car points toward the extraction beacon' }),
    navigationCues: Object.freeze([
      { id: 'l3-me-sign-final', assetKey: 'level3-final-getaway/mainnet-exit-sign', role: 'sign', gridX: 55, gridY: 5, text: 'FINAL CAR →' },
    ]),
  }),
  finaleExtraction: Object.freeze({
    districtId: 'finale-extraction',
    landmarks: Object.freeze([
      placed('l3-fe-landmark-beacon', 'level3-final-getaway/extraction-car-beacon', 'landmark', 64, 4, { solid: false, zHeight: 4 }),
      placed('l3-fe-landmark-tunnel', 'level3-final-getaway/rail-tunnel-mouth', 'landmark', 70, 3, { solid: true, zHeight: 5 }),
    ]),
    propClusters: Object.freeze([
      cluster('l3-fe-escape', 64, 6, [
        { suffix: 'storm', assetKey: 'level3-final-getaway/finale-storm-clouds', role: 'backdrop', dx: 0, dy: -3, solid: false, zHeight: 5 },
        { suffix: 'sign', assetKey: 'level3-final-getaway/mainnet-exit-sign', role: 'sign', dx: 4, dy: -1, solid: false },
        { suffix: 'ladder', assetKey: 'level3-final-getaway/escape-ladder-drop', role: 'edge', dx: 7, dy: 0, solid: false, zHeight: 3 },
        { suffix: 'cache', assetKey: 'level3-final-getaway/coin-cache-crate', role: 'pickup', dx: 10, dy: 1, solid: true },
      ]),
    ]),
    edgeTreatment: Object.freeze({ northBorder: 'storm-wall', southBorder: 'rail-tunnel', transitionTo: null, transitionCue: 'final beacon and tunnel mouth end the getaway chain' }),
    navigationCues: Object.freeze([
      { id: 'l3-fe-sign-exit', assetKey: 'level3-final-getaway/mainnet-exit-sign', role: 'sign', gridX: 67, gridY: 5, text: 'MAINNET EXIT' },
    ]),
  }),
});

// ============================================================================
// AUTHORED CRITICAL PATH: route nodes + encounter beats
// These are not random decoration. They mark the intended traversal spine,
// arena knots, rest/landmark breaths, and extraction hand-offs for each level.
// The renderer receives them as non-solid sign/marker objects through
// getAllAuthoredSceneObjects(), while tests can assert the level design has a
// complete gameplay route rather than loose prop scatter.
// ============================================================================

function routeNode(id, districtId, gridX, gridY, label, objective, { assetKey = 'street/bus-stop-sign', beat = 'navigate' } = {}) {
  return Object.freeze({ id, districtId, gridX, gridY, label, objective, assetKey, beat });
}

export const LEVEL_1_AUTHORED_ROUTE = Object.freeze([
  routeNode('spawn-broken-highway', 'desert-approach', 4, 5, 'Broken Highway / Litecoin Bus Stop', 'teach movement, shooting direction, lane width, first cache read, and gas-station sightline before combat density rises', { beat: 'spawn' }),
  routeNode('gas-station-forecourt', 'desert-approach', 10, 5, 'Gas Station Forecourt Arena', 'first authored combat bowl with pump hazards, canopy blockers, wrecked-car cover, and clear north/south boundaries', { assetKey: 'crypto/landmark-gas-station', beat: 'arena' }),
  routeNode('ghost-town-main-street', 'ghost-town', 40, 6, 'Ghost Town Main Street', 'wide false-front road spine with saloon cover, porch edges, and alley breaks for the first real shootout', { assetKey: 'crypto/ghost-saloon-front', beat: 'arena' }),
  routeNode('farmstead-side-loop', 'residential-edge', 78, 5, 'Farmstead Side Loop', 'optional risk/reward spur with fence rows, crop lanes, barn/silo reads, and a calmer recovery loop before the finale', { assetKey: 'construct/fence-gate', beat: 'loop' }),
  routeNode('river-bridge-wash-crossing', 'country-road', 62, 6, 'River Bridge / Wash Crossing', 'hard chokepoint with animated-water read, bridge rails, shoreline danger, and space for grenade arcs', { assetKey: 'construct/wood-bridge', beat: 'chokepoint' }),
  routeNode('desert-boulder-road', 'desert-approach', 24, 5, 'Desert Boulder Road / Mesa Cut', 'open survival pressure zone where boulder walls and cliff silhouettes make lanes without random rock scatter', { assetKey: 'crypto/canyon-cliff-edge', beat: 'pressure' }),
  routeNode('second-town-extraction-yard', 'inner-city-threshold', 92, 6, 'Second Town / Extraction Yard', 'final readable arena with boarded buildings, boss gate, barricades, and extraction beacon staging', { assetKey: 'level-final-setpiece/cohesive-boss-yard-gate', beat: 'boss' }),
  routeNode('ltc-extraction-pad', 'inner-city-threshold', 98, 5, 'Litecoin Extraction Pad', 'post-boss cyan/gold flare path that cleanly hands the player to extraction or the next level', { assetKey: 'level-final-setpiece/cohesive-extraction-flare-road', beat: 'extract' }),
]);

function macroBiome(id, label, grid, routeBeats, connectors, pois) {
  return Object.freeze({
    id,
    label,
    grid: Object.freeze(grid),
    routeBeats: Object.freeze(routeBeats),
    connectors: Object.freeze(connectors),
    pois: Object.freeze(pois.map((poi) => Object.freeze(poi))),
  });
}

export const LEVEL_1_WO96_MACRO_MAP_PLAN = Object.freeze({
  id: 'wo96-level1-six-biome-macro-map-v1',
  levelId: 'level-1-crypto-wasteland',
  status: 'approval-required-before-asset-generation',
  approvalGate: 'Justin must approve this macro map/overlay before WO-97 world asset generation or runtime map replacement.',
  overlayDocument: 'docs/game-design/hmh-wo96-level1-macro-map.md',
  acceptanceSeed: 1337,
  dimensions: Object.freeze({ columns: 12, rows: 7, tileScale: 'macro-cell' }),
  criticalPath: Object.freeze(['neon-city-core', 'industrial-yard', 'old-canal-riverfront', 'lakeside-park-old-growth', 'farmstead-outskirts', 'extraction-plaza']),
  connectorTypes: Object.freeze(['road', 'trail', 'water']),
  biomes: Object.freeze([
    macroBiome('neon-city-core', 'Neon City Core', { x: 0, y: 2, w: 2, h: 3 }, ['spawn', 'arena'], ['road:industrial-yard', 'water:old-canal-riverfront'], [
      { id: 'ltc-bus-stop', role: 'spawn', approval: 'plan-only' },
      { id: 'neon-fountain-sign', role: 'animated-poi', approval: 'plan-only' },
      { id: 'market-alley-cache', role: 'cache', approval: 'plan-only' },
    ]),
    macroBiome('industrial-yard', 'Industrial Yard', { x: 2, y: 1, w: 3, h: 4 }, ['arena', 'pressure'], ['road:neon-city-core', 'road:old-canal-riverfront', 'trail:farmstead-outskirts'], [
      { id: 'dock-crane-yard', role: 'animated-poi', approval: 'plan-only' },
      { id: 'container-maze', role: 'cover-arena', approval: 'plan-only' },
      { id: 'breaker-substation', role: 'hazard', approval: 'plan-only' },
    ]),
    macroBiome('old-canal-riverfront', 'Old Canal & Riverfront', { x: 4, y: 0, w: 3, h: 3 }, ['chokepoint'], ['water:neon-city-core', 'road:industrial-yard', 'water:lakeside-park-old-growth'], [
      { id: 'lock-bridge', role: 'bridge-choke', approval: 'plan-only' },
      { id: 'boathouse-dock', role: 'water-poi', approval: 'plan-only' },
      { id: 'canal-sluice-gate', role: 'animated-poi', approval: 'plan-only' },
    ]),
    macroBiome('lakeside-park-old-growth', 'Lakeside Park & Old-Growth Forest', { x: 6, y: 1, w: 3, h: 4 }, ['loop', 'breather'], ['water:old-canal-riverfront', 'trail:farmstead-outskirts', 'trail:extraction-plaza'], [
      { id: 'lookout-tower', role: 'animated-poi', approval: 'plan-only' },
      { id: 'ranger-cabin', role: 'safe-cache', approval: 'plan-only' },
      { id: 'moonlit-lake-band', role: 'water-read', approval: 'plan-only' },
    ]),
    macroBiome('farmstead-outskirts', 'Farmstead Outskirts', { x: 7, y: 4, w: 3, h: 2 }, ['loop', 'pressure'], ['trail:industrial-yard', 'trail:lakeside-park-old-growth', 'road:extraction-plaza'], [
      { id: 'windmill-field', role: 'animated-poi', approval: 'plan-only' },
      { id: 'barn-silo-loop', role: 'risk-reward-loop', approval: 'plan-only' },
      { id: 'irrigation-ditch', role: 'water-obstacle', approval: 'plan-only' },
    ]),
    macroBiome('extraction-plaza', 'Extraction Plaza', { x: 10, y: 2, w: 2, h: 3 }, ['boss', 'extract'], ['road:farmstead-outskirts', 'trail:lakeside-park-old-growth'], [
      { id: 'extraction-arch', role: 'animated-poi', approval: 'plan-only' },
      { id: 'boss-gate-roundabout', role: 'boss-arena', approval: 'plan-only' },
      { id: 'ltc-beacon-pad', role: 'extract', approval: 'plan-only' },
    ]),
  ]),
});

export const LEVEL_2_AUTHORED_ROUTE = Object.freeze([
  routeNode('tram-stop', 'outer-boulevard', 4, 6, 'Outer Boulevard Tram Stop', 're-enter from Level 1 with clear street-grid orientation', { beat: 'spawn' }),
  routeNode('service-yard-cut', 'outer-boulevard', 14, 5, 'Service Yard Cut-through', 'teach alleys and flanking through shop clutter', { assetKey: 'street/street-lamp', beat: 'loop' }),
  routeNode('ticker-plaza', 'financial-core', 30, 6, 'Ticker Plaza', 'wide plaza arena with benches, fountain, and tower sightlines', { assetKey: 'crypto/innercity-billboard-frame', beat: 'arena' }),
  routeNode('bank-barricade', 'financial-core', 26, 7, 'Bank Barricade', 'hard cover knot before luxury district transition', { assetKey: 'construct/brick-wall-corner', beat: 'gate' }),
  routeNode('garden-court', 'luxury-neighborhoods', 42, 5, 'Garden Court', 'hedge-loop and mansion grounds breather', { assetKey: 'nature/flower-patch', beat: 'breather' }),
  routeNode('pool-security', 'luxury-neighborhoods', 46, 4, 'Pool Security Check', 'gated ambush beside water and hedge cover', { assetKey: 'construct/fence-gate', beat: 'ambush' }),
  routeNode('skybridge', 'penthouse-rim', 64, 4, 'Penthouse Skybridge', 'narrow bridge choke point with rooftop falloff read', { assetKey: 'construct/wood-bridge', beat: 'chokepoint' }),
  routeNode('vip-exit', 'penthouse-rim', 66, 2, 'VIP Exit Antenna', 'final rooftop extraction marker', { assetKey: 'crypto/utility-pole', beat: 'extract' }),
]);

export const LEVEL_3_AUTHORED_ROUTE = Object.freeze([
  routeNode('evac-lane', 'penthouse-launch-pad', 4, 5, 'Penthouse Evac Lane', 'escape the rooftop into the getaway chain', { assetKey: 'level3-final-getaway/penthouse-evac-lane', beat: 'spawn' }),
  routeNode('helipad-crosswind', 'penthouse-launch-pad', 10, 3, 'Crosswind Helipad', 'read wind pressure and evac clutter before the bridge', { assetKey: 'level3-final-getaway/helipad-evac-chopper', beat: 'pressure' }),
  routeNode('fracture-span', 'skybridge-breakpoint', 22, 5, 'Skybridge Fracture', 'commit through broken glass and warning rails', { assetKey: 'level3-final-getaway/skybridge-fracture-span', beat: 'chokepoint' }),
  routeNode('train-board', 'mainnet-express', 42, 5, 'Mainnet Train Roof', 'board the armored train route under speed-line pressure', { assetKey: 'level3-final-getaway/mainnet-train-roof-car', beat: 'arena' }),
  routeNode('conductor-car', 'mainnet-express', 50, 5, 'Conductor Car', 'push past armored seams and power conduits', { assetKey: 'level3-final-getaway/armored-conductor-car', beat: 'boss' }),
  routeNode('mainnet-exit', 'finale-extraction', 66, 5, 'Mainnet Exit Beacon', 'reach the extraction car alive', { assetKey: 'level3-final-getaway/extraction-car-beacon', beat: 'extract' }),
]);

function routeForLevel(levelId = 'level-1-crypto-wasteland') {
  if (levelId === 'level-3-the-getaway') return LEVEL_3_AUTHORED_ROUTE;
  return levelId === 'level-2-litecoin-city' ? LEVEL_2_AUTHORED_ROUTE : LEVEL_1_AUTHORED_ROUTE;
}

export function getAuthoredRouteNodes(levelId = 'level-1-crypto-wasteland') {
  return routeForLevel(levelId);
}

export function getAuthoredDistrictRouteNodes(districtId, levelId = 'level-1-crypto-wasteland') {
  return Object.freeze(routeForLevel(levelId).filter((node) => node.districtId === districtId));
}

export function getAuthoredEncounterBeats(levelId = 'level-1-crypto-wasteland') {
  return Object.freeze(routeForLevel(levelId).map((node, index) => Object.freeze({
    index,
    id: node.id,
    districtId: node.districtId,
    beat: node.beat,
    objective: node.objective,
    label: node.label,
  })));
}

export function buildLevelOneNoirPlacementAcceptanceTour() {
  const steps = LEVEL_1_AUTHORED_ROUTE.map((node, index) => {
    const stamps = LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.filter((stamp) => stamp.routeBeat === node.beat && stamp.districtId === node.districtId);
    const expectedObjects = [
      `route-${node.districtId}-${node.id}`,
      node.assetKey,
      ...stamps.map((stamp) => stamp.id),
    ];
    return Object.freeze({
      index,
      routeId: node.id,
      routeBeat: node.beat,
      districtId: node.districtId,
      label: node.label,
      cameraAnchor: Object.freeze({ gridX: node.gridX, gridY: node.gridY }),
      expectedObjects: Object.freeze(expectedObjects),
      acceptance: Object.freeze([
        'silhouette readability survives noir lighting and BLACKOUT haze',
        'negative space remains open through the route lane before decorative props',
        stamps.length > 0 ? 'city prefab stamps are visible as seam/backlight cues, not random scatter' : 'existing authored props remain readable without requiring a new art batch',
      ]),
    });
  });

  return Object.freeze({
    id: 'level1-noir-placement-acceptance-tour-v1',
    levelId: 'level-1-crypto-wasteland',
    purpose: 'camera-by-camera acceptance tour for authored noir placement from spawn to city exit',
    steps: Object.freeze(steps),
    summary: Object.freeze({
      totalSteps: steps.length,
      noirPrefabStampCount: LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.length,
      requiresBrowserTour: true,
      routeCoverage: Object.freeze(steps.map((step) => step.routeId)),
    }),
  });
}

// ============================================================================
// FOREGROUND STAGING: near-plane occluders and ambient motion cues
// These use existing coherent-world sprites now, but carry animationCue +
// foregroundBand metadata so the renderer/art pipeline can later swap in
// PixelLab animated foreground variants without changing level design data.
// ============================================================================

function foreground(id, assetKey, role, gridX, gridY, animationCue, { band = 'near', drawOrderBias = 36, zHeight = 2 } = {}) {
  return placed(id, assetKey, role, gridX, gridY, {
    solid: false,
    zHeight,
    foregroundBand: band,
    drawOrderBias,
    animationCue,
  });
}

export const LEVEL_1_FOREGROUND_STAGING = Object.freeze({
  desertApproach: Object.freeze([
    foreground('fg-da-cactus-near', 'crypto/desert-cactus', 'cactus', 10, 8, 'heat-haze cactus sway at lower screen edge'),
    foreground('fg-da-pole-wire', 'crypto/utility-pole', 'pole', 23, 8, 'subtle wire wobble and dust mote drift', { drawOrderBias: 28 }),
  ]),
  ghostTown: Object.freeze([
    foreground('fg-gt-lantern-left', 'street/street-lamp', 'lamp', 37, 8, 'lantern flicker foreground frame'),
    foreground('fg-gt-store-post', 'construct/fence-post', 'post', 45, 8, 'windy porch-post creak silhouette', { drawOrderBias: 30 }),
  ]),
  countryRoad: Object.freeze([
    foreground('fg-cr-tree-branch', 'crypto/forest-tree-line', 'tree', 57, 8, 'tree-line branch sway over crossroads'),
    foreground('fg-cr-mailbox', 'street/mailbox', 'post', 64, 8, 'mailbox flag rattle near camera', { drawOrderBias: 24 }),
  ]),
  residentialEdge: Object.freeze([
    foreground('fg-re-flowers', 'nature/flower-patch', 'bush', 82, 8, 'flower petals flutter at oasis foreground', { drawOrderBias: 24 }),
    foreground('fg-re-oak-canopy', 'nature/oak-tree', 'tree', 87, 8, 'oak canopy sway framing water landmark'),
  ]),
  innerCityThreshold: Object.freeze([
    foreground('fg-ic-traffic-cone', 'street/traffic-cone', 'post', 91, 8, 'warning cone blink and dust kick'),
    foreground('fg-ic-billboard-frame', 'crypto/innercity-billboard-frame', 'billboard', 97, 8, 'neon billboard foreground shimmer', { drawOrderBias: 44, zHeight: 4 }),
  ]),
});

export const LEVEL_2_FOREGROUND_STAGING = Object.freeze({
  outerBoulevard: Object.freeze([
    foreground('fg-ob-lamp', 'street/street-lamp', 'lamp', 6, 8, 'street-lamp foreground flicker'),
    foreground('fg-ob-hydrant', 'street/fire-hydrant', 'post', 13, 8, 'hydrant steam puff cue', { drawOrderBias: 24 }),
  ]),
  financialCore: Object.freeze([
    foreground('fg-fc-billboard', 'crypto/innercity-billboard-frame', 'billboard', 32, 8, 'ticker billboard cyan pulse', { drawOrderBias: 44, zHeight: 4 }),
    foreground('fg-fc-fountain-spray', 'nature/fountain', 'fountain', 29, 8, 'foreground fountain spray loop', { drawOrderBias: 28 }),
  ]),
  luxuryNeighborhoods: Object.freeze([
    foreground('fg-ln-hedge', 'crypto/residential-hedge-run', 'hedge', 43, 8, 'manicured hedge shimmer and leaf sway'),
    foreground('fg-ln-flowerbed', 'nature/flower-patch', 'bush', 50, 8, 'flowerbed petal flutter', { drawOrderBias: 24 }),
  ]),
  penthouseRim: Object.freeze([
    foreground('fg-pr-antenna', 'crypto/utility-pole', 'pole', 66, 8, 'antenna beacon blink and wind sway', { drawOrderBias: 38, zHeight: 4 }),
    foreground('fg-pr-rail', 'construct/fence-segment', 'fence', 63, 8, 'foreground guardrail rain streak cue', { drawOrderBias: 26 }),
  ]),
});


export const LEVEL_3_FOREGROUND_STAGING = Object.freeze({
  penthouseLaunchPad: Object.freeze([
    foreground('fg-l3-pl-banner', 'level3-final-getaway/wind-torn-banner-line', 'sign', 7, 8, 'foreground banner whipping in storm wind', { drawOrderBias: 42, zHeight: 3 }),
    foreground('fg-l3-pl-stair', 'level3-final-getaway/emergency-stair-glow', 'edge', 13, 8, 'emergency stair light pulse near camera', { drawOrderBias: 36, zHeight: 4 }),
  ]),
  skybridgeBreakpoint: Object.freeze([
    foreground('fg-l3-sb-rail', 'level3-final-getaway/warning-rail-blink', 'edge', 22, 8, 'warning rail blink across glass foreground', { drawOrderBias: 36 }),
    foreground('fg-l3-sb-drop', 'level3-final-getaway/vertical-drop-parallax', 'backdrop', 27, 8, 'city drop speed streaks behind cracked bridge', { drawOrderBias: 46, zHeight: 5 }),
  ]),
  mainnetExpress: Object.freeze([
    foreground('fg-l3-me-speed', 'level3-final-getaway/speed-line-billboard', 'sign', 46, 8, 'speed-line ad parallax near train roof', { drawOrderBias: 44, zHeight: 4 }),
    foreground('fg-l3-me-gap', 'level3-final-getaway/coupler-gap-warning', 'hazard', 53, 8, 'coupler warning flash at lower screen edge', { drawOrderBias: 34 }),
  ]),
  finaleExtraction: Object.freeze([
    foreground('fg-l3-fe-storm', 'level3-final-getaway/finale-storm-clouds', 'backdrop', 63, 8, 'storm clouds and lightning over final car', { drawOrderBias: 48, zHeight: 5 }),
    foreground('fg-l3-fe-beacon', 'level3-final-getaway/extraction-car-beacon', 'landmark', 67, 8, 'final beacon pulse near camera', { drawOrderBias: 42, zHeight: 4 }),
  ]),
});

// ============================================================================
// Helper: Get the authored layout for a district by ID
// ============================================================================

const LEVEL_1_DISTRICT_MAP = Object.freeze({
  'desert-approach': 'desertApproach',
  'ghost-town': 'ghostTown',
  'country-road': 'countryRoad',
  'residential-edge': 'residentialEdge',
  'inner-city-threshold': 'innerCityThreshold',
});

const LEVEL_2_DISTRICT_MAP = Object.freeze({
  'outer-boulevard': 'outerBoulevard',
  'financial-core': 'financialCore',
  'luxury-neighborhoods': 'luxuryNeighborhoods',
  'penthouse-rim': 'penthouseRim',
});

const LEVEL_3_DISTRICT_MAP = Object.freeze({
  'penthouse-launch-pad': 'penthouseLaunchPad',
  'skybridge-breakpoint': 'skybridgeBreakpoint',
  'mainnet-express': 'mainnetExpress',
  'finale-extraction': 'finaleExtraction',
});

export function getAuthoredDistrictLayout(districtId, levelId = 'level-1-crypto-wasteland') {
  if (levelId === 'level-3-the-getaway') {
    const key = LEVEL_3_DISTRICT_MAP[districtId];
    return key ? LEVEL_3_AUTHORED_LAYOUT[key] : null;
  }
  if (levelId === 'level-2-litecoin-city') {
    const key = LEVEL_2_DISTRICT_MAP[districtId];
    return key ? LEVEL_2_AUTHORED_LAYOUT[key] : null;
  }
  const key = LEVEL_1_DISTRICT_MAP[districtId];
  return key ? LEVEL_1_AUTHORED_LAYOUT[key] : null;
}

// Get all placed objects (landmarks + prop clusters + nav cues) for a district
export function getAuthoredSceneObjects(districtId, levelId = 'level-1-crypto-wasteland') {
  const layout = getAuthoredDistrictLayout(districtId, levelId);
  if (!layout) return Object.freeze([]);

  const objects = [];

  // Add landmarks
  for (const landmark of layout.landmarks) {
    objects.push(landmark);
  }

  // Add prop cluster objects
  for (const cluster of layout.propClusters) {
    for (const prop of cluster.props) {
      objects.push(prop);
    }
  }

  // Add navigation cues as non-solid signs
  for (const cue of layout.navigationCues) {
    objects.push(Object.freeze({
      id: cue.id,
      assetKey: cue.assetKey,
      role: cue.role,
      gridX: cue.gridX,
      gridY: cue.gridY,
      solid: false,
      zHeight: 1,
      variant: 0,
      text: cue.text,
    }));
  }

  return Object.freeze(objects);
}

// Get the edge transition treatment for a district
export function getDistrictEdgeTreatment(districtId, levelId = 'level-1-crypto-wasteland') {
  const layout = getAuthoredDistrictLayout(districtId, levelId);
  return layout?.edgeTreatment ?? null;
}

export function getAuthoredForegroundSceneObjects(districtId, levelId = 'level-1-crypto-wasteland') {
  const foregrounds = levelId === 'level-3-the-getaway'
    ? LEVEL_3_FOREGROUND_STAGING
    : levelId === 'level-2-litecoin-city'
      ? LEVEL_2_FOREGROUND_STAGING
      : LEVEL_1_FOREGROUND_STAGING;
  const foregroundKey = Object.keys(foregrounds).find((k) =>
    k === districtId ||
    k.replace(/-/g, '').toLowerCase() === districtId.replace(/-/g, '').toLowerCase(),
  );
  return Object.freeze(foregroundKey ? foregrounds[foregroundKey] : []);
}

export function getLevelOnePixellabRuntimeSceneObjects(districtId) {
  const upgradeKey = Object.keys(LEVEL_1_PIXELLAB_RUNTIME_MAP_UPGRADES).find((k) =>
    k === districtId ||
    k.replace(/-/g, '').toLowerCase() === districtId.replace(/-/g, '').toLowerCase(),
  );
  return Object.freeze(upgradeKey ? LEVEL_1_PIXELLAB_RUNTIME_MAP_UPGRADES[upgradeKey] : []);
}

// ============================================================================
// EXPANDED LAYOUT: Richer prop clusters, road segments, environmental
// storytelling, and POI arena staging. These give each district the density
// and authored feel of a real game world, not just a few landmarks.
// ============================================================================

// Road segment helper: creates a line of road tiles along a direction
function roadLine(id, startX, startY, length, dir = 'horizontal', assetKey = 'crypto/road-straight') {
  const tiles = [];
  for (let i = 0; i < length; i += 1) {
    const x = dir === 'horizontal' ? startX + i : startX;
    const y = dir === 'horizontal' ? startY : startY + i;
    tiles.push(placed(`${id}-r${i}`, assetKey, 'road', x, y, { solid: false, zHeight: 0 }));
  }
  return Object.freeze(tiles);
}

// Scatter helper: creates a naturalistic cluster of props at semi-random offsets
// using a deterministic hash so the same props always appear in the same spots.
function scatter(id, centerX, centerY, specs) {
  return Object.freeze(specs.map((s, i) => placed(
    `${id}-s${i}`,
    s.assetKey,
    s.role,
    centerX + s.dx,
    centerY + s.dy,
    { solid: s.solid ?? true, zHeight: s.zHeight ?? 0 },
  )));
}

// ============================================================================
// LEVEL 1 EXPANSION: Richer district staging
// ============================================================================

export const LEVEL_1_EXPANDED_PROPS = Object.freeze({
  desertApproach: Object.freeze([
    // Main road spine through the desert
    ...roadLine('da-road', 0, 5, 30, 'horizontal'),
    // Salvage yard detail around the gas station
    ...scatter('da-salvage-yard', 8, 4, [
      { assetKey: 'crypto/desert-boulder', role: 'rock', dx: -3, dy: 0 },
      { assetKey: 'crypto/desert-boulder', role: 'rock', dx: -2, dy: 2 },
      { assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 4, dy: -1 },
      { assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 5, dy: 1 },
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: -1, dy: -2 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: 2, dy: -2 },
    ]),
    // Dry creek bed with rocks and crossing
    ...scatter('da-creek-detail', 14, 5, [
      { assetKey: 'nature/boulder', role: 'rock', dx: -3, dy: -1 },
      { assetKey: 'nature/boulder', role: 'rock', dx: 3, dy: 1 },
      { assetKey: 'nature/bush', role: 'bush', dx: -1, dy: 2 },
      { assetKey: 'nature/bush', role: 'bush', dx: 1, dy: -2 },
      { assetKey: 'crypto/desert-cactus', role: 'cactus', dx: -4, dy: 0 },
    ]),
    // Canyon wall detail
    ...scatter('da-canyon', 26, 1, [
      { assetKey: 'crypto/canyon-cliff-edge', role: 'wall', dx: 0, dy: 0, zHeight: 4 },
      { assetKey: 'crypto/canyon-cliff-edge', role: 'wall', dx: 2, dy: 0, zHeight: 4 },
      { assetKey: 'crypto/desert-boulder', role: 'rock', dx: -1, dy: 2 },
      { assetKey: 'crypto/desert-boulder', role: 'rock', dx: 1, dy: 3 },
    ]),
    // Desert flora scatter
    ...scatter('da-flora', 12, 7, [
      { assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 0, dy: 0 },
      { assetKey: 'crypto/desert-cactus', role: 'cactus', dx: 4, dy: 1 },
      { assetKey: 'nature/bush', role: 'bush', dx: 2, dy: -1 },
      { assetKey: 'nature/bush', role: 'bush', dx: -2, dy: 2 },
    ]),
    // Mining rig debris (environmental storytelling)
    ...scatter('da-rig-debris', 20, 3, [
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: 0, dy: 0 },
      { assetKey: 'crypto/utility-pole', role: 'pole', dx: 2, dy: -1, solid: false },
      { assetKey: 'nature/boulder', role: 'rock', dx: -2, dy: 1 },
    ]),
  ]),

  ghostTown: Object.freeze([
    // Main street road
    ...roadLine('gt-mainstreet', 34, 6, 20, 'horizontal'),
    // Saloon square detail
    ...scatter('gt-saloon-square', 40, 3, [
      { assetKey: 'street/park-bench', role: 'bench', dx: -2, dy: 2 },
      { assetKey: 'street/park-bench', role: 'bench', dx: 2, dy: 2 },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: -3, dy: 1, solid: false },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: 3, dy: 1, solid: false },
      { assetKey: 'construct/fence-post', role: 'post', dx: 0, dy: 3 },
    ]),
    // Boarded storefront detail
    ...scatter('gt-storefront', 36, 5, [
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: -2, dy: 1 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: -1, dy: 1 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 0 },
      { assetKey: 'construct/fence-post', role: 'post', dx: 3, dy: 0 },
    ]),
    // Warehouse district
    ...scatter('gt-warehouse', 48, 3, [
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: 2, dy: 2 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: 3, dy: 1 },
      { assetKey: 'construct/brick-wall-corner', role: 'wall', dx: -1, dy: 3 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 0, dy: 3 },
    ]),
    // Wagon barricade detail
    ...scatter('gt-barricade', 42, 7, [
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: 1, dy: 0 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: -1, dy: 0 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: -1 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: -2, dy: -1 },
      { assetKey: 'nature/bush', role: 'bush', dx: 0, dy: 1 },
    ]),
    // Alley detail between buildings
    ...scatter('gt-alley', 44, 4, [
      { assetKey: 'street/trash-can', role: 'crate', dx: 0, dy: 0 },
      { assetKey: 'construct/fence-post', role: 'post', dx: 1, dy: 1 },
      { assetKey: 'nature/bush', role: 'bush', dx: -1, dy: 1 },
    ]),
  ]),

  countryRoad: Object.freeze([
    // Country road spine
    ...roadLine('cr-road', 54, 6, 20, 'horizontal'),
    // Crossroads hub detail
    ...scatter('cr-hub', 60, 5, [
      { assetKey: 'street/park-bench', role: 'bench', dx: -3, dy: 1 },
      { assetKey: 'street/park-bench', role: 'bench', dx: 3, dy: 1 },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: -2, dy: -1, solid: false },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: 2, dy: -1, solid: false },
      { assetKey: 'street/mailbox', role: 'post', dx: 0, dy: 2 },
      { assetKey: 'construct/fence-post', role: 'post', dx: -4, dy: 0 },
      { assetKey: 'construct/fence-post', role: 'post', dx: 4, dy: 0 },
    ]),
    // Tree line detail
    ...scatter('gt-treeline', 55, 1, [
      { assetKey: 'crypto/forest-tree-line', role: 'tree', dx: 0, dy: 0 },
      { assetKey: 'nature/oak-tree', role: 'tree', dx: 3, dy: 1 },
      { assetKey: 'nature/pine-tree', role: 'tree', dx: 6, dy: 0 },
      { assetKey: 'nature/bush', role: 'bush', dx: 2, dy: 2 },
      { assetKey: 'nature/bush', role: 'bush', dx: 5, dy: 2 },
    ]),
    ...scatter('cr-treeline2', 68, 1, [
      { assetKey: 'crypto/forest-tree-line', role: 'tree', dx: 0, dy: 0 },
      { assetKey: 'nature/pine-tree', role: 'tree', dx: -2, dy: 1 },
      { assetKey: 'nature/bush', role: 'bush', dx: 1, dy: 2 },
    ]),
    // Wagon circle detail
    ...scatter('cr-wagon', 60, 7, [
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: 1, dy: 0 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: -1, dy: 0 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: 0, dy: -1 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 1 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: -2, dy: 1 },
    ]),
    // Roadside utility line
    ...scatter('cr-utility', 58, 8, [
      { assetKey: 'crypto/utility-pole', role: 'pole', dx: 0, dy: 0, solid: false },
      { assetKey: 'crypto/utility-pole', role: 'pole', dx: 5, dy: 0, solid: false },
      { assetKey: 'crypto/utility-pole', role: 'pole', dx: 10, dy: 0, solid: false },
    ]),
    // Pasture fence
    ...scatter('cr-pasture', 62, 3, [
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 0, dy: 0 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 0 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 4, dy: 0 },
      { assetKey: 'construct/fence-post', role: 'post', dx: 1, dy: 0 },
      { assetKey: 'construct/fence-post', role: 'post', dx: 3, dy: 0 },
      { assetKey: 'construct/fence-gate', role: 'gate', dx: 5, dy: 0 },
    ]),
  ]),

  residentialEdge: Object.freeze([
    // Road continues
    ...roadLine('re-road', 74, 6, 18, 'horizontal'),
    // Oasis lakeside detail
    ...scatter('re-oasis-detail', 84, 6, [
      { assetKey: 'construct/river-straight', role: 'water', dx: 0, dy: 0, solid: false },
      { assetKey: 'construct/river-straight', role: 'water', dx: 1, dy: 0, solid: false },
      { assetKey: 'construct/river-straight', role: 'water', dx: -1, dy: 0, solid: false },
      { assetKey: 'construct/river-straight', role: 'water', dx: 0, dy: 1, solid: false },
      { assetKey: 'nature/fallen-log', role: 'log', dx: 2, dy: -1 },
      { assetKey: 'nature/bush', role: 'bush', dx: -2, dy: 1 },
      { assetKey: 'nature/bush', role: 'bush', dx: 3, dy: 0 },
      { assetKey: 'nature/flower-patch', role: 'bush', dx: -3, dy: -1, solid: false },
    ]),
    // Hedge maze entrance
    ...scatter('re-hedge-maze', 78, 4, [
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 0 },
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 2 },
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 3, dy: 0 },
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 3, dy: 2 },
      { assetKey: 'construct/fence-gate', role: 'gate', dx: 1, dy: 1 },
      { assetKey: 'street/park-bench', role: 'bench', dx: -2, dy: 1 },
    ]),
    // Mesa cliff base
    ...scatter('re-mesa', 80, 1, [
      { assetKey: 'crypto/canyon-cliff-edge', role: 'wall', dx: 0, dy: 0, zHeight: 4 },
      { assetKey: 'crypto/desert-boulder', role: 'rock', dx: 1, dy: 2 },
      { assetKey: 'crypto/desert-boulder', role: 'rock', dx: 2, dy: 3 },
      { assetKey: 'nature/bush', role: 'bush', dx: 0, dy: 3 },
    ]),
    // Park bench area
    ...scatter('re-park', 82, 5, [
      { assetKey: 'street/park-bench', role: 'bench', dx: 0, dy: 0 },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: 2, dy: -1, solid: false },
      { assetKey: 'nature/flower-patch', role: 'bush', dx: -1, dy: 1, solid: false },
      { assetKey: 'nature/oak-tree', role: 'tree', dx: 3, dy: 0 },
    ]),
  ]),

  innerCityThreshold: Object.freeze([
    // Asphalt road
    ...roadLine('ic-road', 86, 6, 16, 'horizontal'),
    // Billboard plaza
    ...scatter('ic-billboard-plaza', 92, 2, [
      { assetKey: 'crypto/innercity-billboard-frame', role: 'billboard', dx: 0, dy: 0, zHeight: 5 },
      { assetKey: 'crypto/utility-pole', role: 'pole', dx: -2, dy: 0, solid: false },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: 1, dy: 2, solid: false },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: -1, dy: 2, solid: false },
    ]),
    // Warehouse staging
    ...scatter('ic-warehouse', 96, 4, [
      { assetKey: 'crypto/industrial-warehouse-facade', role: 'landmark', dx: 0, dy: 0, zHeight: 3 },
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: 3, dy: 1 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: 4, dy: 0 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: -1, dy: 2 },
    ]),
    // Barricade checkpoint
    ...scatter('ic-checkpoint', 90, 6, [
      { assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 1 },
      { assetKey: 'construct/fence-post', role: 'post', dx: -1, dy: 1 },
      { assetKey: 'street/traffic-cone', role: 'post', dx: 3, dy: 0 },
      { assetKey: 'street/traffic-cone', role: 'post', dx: -2, dy: 0 },
    ]),
    // Road edge transition
    ...scatter('ic-transition', 88, 7, [
      { assetKey: 'crypto/ground-dirt-asphalt-edge', role: 'edge', dx: 0, dy: 0, solid: false },
      { assetKey: 'crypto/ground-dirt-asphalt-edge', role: 'edge', dx: 2, dy: 0, solid: false },
      { assetKey: 'street/trash-can', role: 'crate', dx: 4, dy: -1 },
    ]),
  ]),
});

// ============================================================================
// LEVEL 2 EXPANSION: Richer urban district staging
// ============================================================================

export const LEVEL_2_EXPANDED_PROPS = Object.freeze({
  outerBoulevard: Object.freeze([
    ...roadLine('ob-street', 2, 6, 16, 'horizontal'),
    ...scatter('ob-shopfronts', 8, 3, [
      { assetKey: 'street/street-lamp', role: 'lamp', dx: -2, dy: 1, solid: false },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: 3, dy: 1, solid: false },
      { assetKey: 'street/park-bench', role: 'bench', dx: 0, dy: 2 },
      { assetKey: 'street/mailbox', role: 'post', dx: 2, dy: 2 },
      { assetKey: 'street/trash-can', role: 'crate', dx: -1, dy: 1 },
      { assetKey: 'street/traffic-cone', role: 'post', dx: 4, dy: 0 },
    ]),
    ...scatter('ob-corner', 14, 5, [
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: 0, dy: 1 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 0 },
      { assetKey: 'street/fire-hydrant', role: 'post', dx: -1, dy: 1 },
    ]),
  ]),

  financialCore: Object.freeze([
    ...roadLine('fc-street', 22, 6, 16, 'horizontal'),
    ...scatter('fc-plaza-detail', 30, 6, [
      { assetKey: 'construct/river-straight', role: 'water', dx: 0, dy: 0, solid: false },
      { assetKey: 'construct/river-straight', role: 'water', dx: 1, dy: 0, solid: false },
      { assetKey: 'street/park-bench', role: 'bench', dx: -2, dy: 1 },
      { assetKey: 'street/park-bench', role: 'bench', dx: 3, dy: 1 },
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 2 },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: -3, dy: 0, solid: false },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: 4, dy: 0, solid: false },
      { assetKey: 'nature/flower-patch', role: 'bush', dx: 1, dy: 2, solid: false },
    ]),
    ...scatter('fc-tower-base', 28, 3, [
      { assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
      { assetKey: 'street/traffic-cone', role: 'post', dx: -1, dy: 1 },
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: 2, dy: 1 },
    ]),
    ...scatter('fc-barricade', 26, 7, [
      { assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 2, dy: 0 },
    ]),
  ]),

  luxuryNeighborhoods: Object.freeze([
    ...roadLine('ln-street', 40, 6, 14, 'horizontal'),
    ...scatter('ln-garden-detail', 42, 5, [
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 0 },
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 0, dy: 2 },
      { assetKey: 'crypto/residential-hedge-run', role: 'hedge', dx: 3, dy: 0 },
      { assetKey: 'construct/fence-gate', role: 'gate', dx: 1, dy: 1 },
      { assetKey: 'street/park-bench', role: 'bench', dx: 4, dy: 1 },
      { assetKey: 'nature/flower-patch', role: 'bush', dx: 2, dy: 1, solid: false },
      { assetKey: 'nature/flower-patch', role: 'bush', dx: 4, dy: 2, solid: false },
      { assetKey: 'street/street-lamp', role: 'lamp', dx: -1, dy: 1, solid: false },
    ]),
    ...scatter('ln-pool-area', 46, 4, [
      { assetKey: 'construct/river-straight', role: 'water', dx: 0, dy: 0, solid: false },
      { assetKey: 'construct/river-straight', role: 'water', dx: 1, dy: 0, solid: false },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: -1, dy: 0 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 2, dy: 0 },
      { assetKey: 'street/park-bench', role: 'bench', dx: 0, dy: -1 },
    ]),
    ...scatter('ln-mansion-grounds', 48, 3, [
      { assetKey: 'nature/oak-tree', role: 'tree', dx: 3, dy: 1 },
      { assetKey: 'nature/oak-tree', role: 'tree', dx: -2, dy: 2 },
      { assetKey: 'nature/bush', role: 'bush', dx: 2, dy: 2 },
      { assetKey: 'construct/fence-post', role: 'post', dx: 4, dy: 0 },
    ]),
  ]),

  penthouseRim: Object.freeze([
    ...scatter('pr-rooftop-detail', 60, 5, [
      { assetKey: 'construct/brick-wall-corner', role: 'wall', dx: 0, dy: 0 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 1, dy: 0 },
      { assetKey: 'construct/brick-wall-segment', role: 'wall', dx: 2, dy: 0 },
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: 0, dy: 2 },
      { assetKey: 'interior/wooden-crate', role: 'crate', dx: 3, dy: 1 },
      { assetKey: 'street/traffic-cone', role: 'post', dx: -1, dy: 1 },
    ]),
    ...scatter('pr-skybridge', 64, 4, [
      { assetKey: 'construct/wood-bridge', role: 'bridge', dx: 0, dy: 0 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 0, dy: -1 },
      { assetKey: 'construct/fence-segment', role: 'fence', dx: 0, dy: 1 },
      { assetKey: 'construct/fence-post', role: 'post', dx: 1, dy: 0 },
    ]),
    ...scatter('pr-antenna', 66, 2, [
      { assetKey: 'crypto/utility-pole', role: 'pole', dx: 0, dy: 0, solid: false, zHeight: 4 },
      { assetKey: 'crypto/utility-pole', role: 'pole', dx: 2, dy: 1, solid: false, zHeight: 3 },
      { assetKey: 'interior/stacked-boxes', role: 'crate', dx: -1, dy: 2 },
    ]),
  ]),
});

export const LEVEL_3_EXPANDED_PROPS = Object.freeze({
  penthouseLaunchPad: Object.freeze([]),
  skybridgeBreakpoint: Object.freeze([]),
  mainnetExpress: Object.freeze([]),
  finaleExtraction: Object.freeze([]),
});

function getLevelOneNoirCityPrefabSceneObjects(districtId) {
  return districtId === 'inner-city-threshold' ? LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps : [];
}

// Get ALL authored objects (base layout + expanded props) for a district
export function getAllAuthoredSceneObjects(districtId, levelId = 'level-1-crypto-wasteland') {
  const base = getAuthoredSceneObjects(districtId, levelId);
  const expanded = levelId === 'level-3-the-getaway'
    ? LEVEL_3_EXPANDED_PROPS
    : levelId === 'level-2-litecoin-city'
      ? LEVEL_2_EXPANDED_PROPS
      : LEVEL_1_EXPANDED_PROPS;
  // Normalize district ID: authored-layout uses camelCase keys, expanded uses
  // the hyphenated districtId. Match by trying both case-insensitive and hyphen-stripped.
  const expandedKey = Object.keys(expanded).find((k) =>
    k === districtId ||
    k.replace(/-/g, '').toLowerCase() === districtId.replace(/-/g, '').toLowerCase(),
  );
  const extra = expandedKey ? expanded[expandedKey] : [];
  const routeMarkers = getAuthoredDistrictRouteNodes(districtId, levelId).map((node) => Object.freeze({
    id: `route-${node.districtId}-${node.id}`,
    assetKey: node.assetKey,
    role: 'sign',
    gridX: node.gridX,
    gridY: node.gridY,
    solid: false,
    zHeight: 1,
    variant: 0,
    text: node.label,
    routeBeat: node.beat,
    objective: node.objective,
  }));
  const foregrounds = getAuthoredForegroundSceneObjects(districtId, levelId);
  const pixellabRuntimeObjects = levelId === 'level-1-crypto-wasteland'
    ? getLevelOnePixellabRuntimeSceneObjects(districtId)
    : [];
  const noirCityPrefabStamps = levelId === 'level-1-crypto-wasteland'
    ? getLevelOneNoirCityPrefabSceneObjects(districtId)
    : [];
  const aaaInteractiveObjects = levelId === 'level-1-crypto-wasteland'
    ? aaaLevelOneSceneObjectsForDistrict(districtId)
    : [];
  return Object.freeze([...base, ...extra, ...routeMarkers, ...foregrounds, ...pixellabRuntimeObjects, ...noirCityPrefabStamps, ...aaaInteractiveObjects]);
}
