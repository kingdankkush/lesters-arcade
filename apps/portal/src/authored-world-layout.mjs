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

// World tile size in pixels (matches renderer's tile size)
const TILE_SIZE = 30;
const CELL_SIZE = SCENE_CELL ?? 7; // scene cells per macro-cell

// Helper: create a placed object with world coordinates
function placed(id, assetKey, role, gridX, gridY, { solid = true, zHeight = 0, variant = 0 } = {}) {
  return Object.freeze({ id, assetKey, role, gridX, gridY, solid, zHeight, variant });
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
      { id: 'da-signpost', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 6, gridY: 5, text: 'GHOST TOWN →' },
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
      { id: 'gt-signpost', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 35, gridY: 6, text: 'CROSSROADS →' },
      { id: 'gt-signpost2', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 35, gridY: 3, text: '← RUGPULL GULCH' },
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
      { id: 'cr-signpost-n', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 60, gridY: 3, text: '↑ DRY FOREST CAVE' },
      { id: 'cr-signpost-s', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 60, gridY: 8, text: '↓ CROSSROADS POST' },
      { id: 'cr-signpost-e', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 63, gridY: 5, text: '→ OASIS / CITY' },
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
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'mesa-cliff-line',
      southBorder: 'water-to-asphalt-transition',
      transitionTo: 'inner-city-threshold',
      transitionCue: 'sand and grass give way to cracked asphalt and neon skyline grows',
    }),
    navigationCues: Object.freeze([
      { id: 're-signpost', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 76, gridY: 5, text: '→ LITECOIN CITY' },
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
      { id: 'ic-signpost', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 88, gridY: 5, text: '→ ENTERING LITECOIN CITY' },
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
    navigationCues: Object.freeze([]),
  }),

  financialCore: Object.freeze({
    districtId: 'financial-core',
    landmarks: Object.freeze([
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
      ]),
    ]),
    edgeTreatment: Object.freeze({
      northBorder: 'glass-tower-skyline',
      southBorder: 'plaza-to-street',
      transitionTo: 'luxury-neighborhoods',
      transitionCue: 'towers give way to gated drives and manicured lawns',
    }),
    navigationCues: Object.freeze([]),
  }),

  luxuryNeighborhoods: Object.freeze({
    districtId: 'luxury-neighborhoods',
    landmarks: Object.freeze([
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
    navigationCues: Object.freeze([]),
  }),

  penthouseRim: Object.freeze({
    districtId: 'penthouse-rim',
    landmarks: Object.freeze([
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
    navigationCues: Object.freeze([]),
  }),
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

export function getAuthoredDistrictLayout(districtId, levelId = 'level-1-crypto-wasteland') {
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
