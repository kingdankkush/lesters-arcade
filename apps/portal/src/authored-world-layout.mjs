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
    navigationCues: Object.freeze([
      { id: 'ob-sign-tram', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 4, gridY: 5, text: 'TRAM STOP / MARKET ROW' },
      { id: 'ob-sign-core', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 15, gridY: 6, text: '→ FINANCIAL CORE' },
    ]),
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
    navigationCues: Object.freeze([
      { id: 'fc-sign-ticker', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 29, gridY: 5, text: 'TICKER PLAZA' },
      { id: 'fc-sign-garden', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 34, gridY: 7, text: '→ GATED DISTRICT' },
    ]),
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
    navigationCues: Object.freeze([
      { id: 'ln-sign-garden', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 42, gridY: 4, text: 'GARDEN COURT LOOP' },
      { id: 'ln-sign-penthouse', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 51, gridY: 6, text: '→ PENTHOUSE RIM' },
    ]),
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
    navigationCues: Object.freeze([
      { id: 'pr-sign-skybridge', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 63, gridY: 5, text: 'SKYBRIDGE CHOKE' },
      { id: 'pr-sign-exit', assetKey: 'street/bus-stop-sign', role: 'sign', gridX: 66, gridY: 3, text: 'VIP EXIT / LEVEL 3 →' },
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
  routeNode('spawn-gas-station', 'desert-approach', 4, 5, 'Salvage Gas Station', 'learn the road spine and pick first cover', { beat: 'spawn' }),
  routeNode('dry-creek-crossing', 'desert-approach', 14, 5, 'Dry Creek Crossing', 'first animal ambush and bridge read', { assetKey: 'construct/wood-bridge', beat: 'ambush' }),
  routeNode('saloon-square', 'ghost-town', 40, 6, 'Ghost Town Main Street', 'cover-heavy shootout around saloon fronts', { beat: 'arena' }),
  routeNode('warehouse-alley', 'ghost-town', 48, 4, 'Warehouse Alley', 'side loop teaches alley cut-throughs', { assetKey: 'street/street-lamp', beat: 'loop' }),
  routeNode('crossroads-post', 'country-road', 60, 6, 'Crossroads Trading Post', 'branching hub with utility-pole sightline', { beat: 'hub' }),
  routeNode('oasis-park', 'residential-edge', 84, 6, 'Oasis Park', 'water landmark and softer residential cover', { assetKey: 'street/park-bench', beat: 'breather' }),
  routeNode('city-checkpoint', 'inner-city-threshold', 90, 6, 'Inner City Checkpoint', 'final barricade pressure before extraction', { beat: 'gate' }),
  routeNode('litecoin-city-gate', 'inner-city-threshold', 98, 5, 'Litecoin City Gate', 'level hand-off to the urban campaign', { assetKey: 'crypto/innercity-billboard-frame', beat: 'extract' }),
]);

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

function routeForLevel(levelId = 'level-1-crypto-wasteland') {
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

export function getAuthoredForegroundSceneObjects(districtId, levelId = 'level-1-crypto-wasteland') {
  const foregrounds = levelId === 'level-2-litecoin-city'
    ? LEVEL_2_FOREGROUND_STAGING
    : LEVEL_1_FOREGROUND_STAGING;
  const foregroundKey = Object.keys(foregrounds).find((k) =>
    k === districtId ||
    k.replace(/-/g, '').toLowerCase() === districtId.replace(/-/g, '').toLowerCase(),
  );
  return Object.freeze(foregroundKey ? foregrounds[foregroundKey] : []);
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

// Get ALL authored objects (base layout + expanded props) for a district
export function getAllAuthoredSceneObjects(districtId, levelId = 'level-1-crypto-wasteland') {
  const base = getAuthoredSceneObjects(districtId, levelId);
  const expanded = levelId === 'level-2-litecoin-city'
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
  return Object.freeze([...base, ...extra, ...routeMarkers, ...foregrounds]);
}
