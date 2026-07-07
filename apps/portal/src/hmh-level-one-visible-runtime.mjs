import { ambientLifeCueForVisibleObject } from './hmh-ambient-life.mjs';
import {
  HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT,
  HMH_LEVEL_ONE_SPAWN_GATE_REDRESS,
  curatedLevelOneCriticalPath,
} from './hmh-level-one-curated-world-contract.mjs';
import { curatedLevelKitAssetByKey } from '../assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';
import { authoredStampAssetByKey } from '../assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-manifest.mjs';
import {
  HMH_WO104_106_WORLD_KIT,
  wo104106WorldKitAssetByKey,
} from '../assets/generated/hmh-wo104-106-world-kit/hmh-wo104-106-world-kit-manifest.mjs';

const ROLE_FOR_USE = Object.freeze({
  landmark: 'landmark',
  boundary: 'wall',
  route: 'road',
  arena: 'road',
  dressing: 'smallprop',
  terrain: 'smallprop',
  water: 'water-strip',
  enemy: 'smallprop',
  hero: 'smallprop',
  vfx: 'smallprop',
  canopy: 'canopy-occluder',
  ambient: 'ambient-hazard',
  vehicle: 'vehicle',
  plaza: 'landmark',
  container: 'wall',
});

const SOLID_FOR_USE = Object.freeze({
  landmark: true,
  boundary: true,
  route: false,
  arena: false,
  dressing: false,
  terrain: false,
  water: false,
  enemy: false,
  hero: false,
  vfx: false,
  canopy: true,
  ambient: false,
  vehicle: false,
  plaza: true,
  container: true,
});

export const WO102_MEGA_PROP_ASSETS = Object.freeze([
  Object.freeze({
    id: 'wo102-megaprop/noodle-bar-storefront',
    src: './assets/generated/hmh-wo102-megaprops/processed/wo102-noodle-bar-storefront/candidate-01.png',
    candidate: 'wo102-noodle-bar-storefront/candidate-01',
    bodyKind: 'building',
    canvas: Object.freeze({ w: 384, h: 384 }),
    density: 1,
    groundContactY: 340,
    shadowDirection: 'south-east',
    bakedShadow: true,
    footprintTiles: Object.freeze({ w: 5.8, h: 2.2 }),
    collisionPolygons: Object.freeze([Object.freeze([[0.8, 0.4], [5.1, 0.4], [5.4, 1.8], [0.4, 1.9]])]),
    overSlice: Object.freeze({ x: 0, y: 70, w: 384, h: 110, anchor: 'awning' }),
    r1Observation: 'At seed 1337 near grid 40,2, a neon storefront block with baked wet-ground shadow replaces the old small storefront cluster.',
  }),
  Object.freeze({
    id: 'wo102-megaprop/forest-rock-outcrop',
    src: './assets/generated/hmh-wo102-megaprops/processed/wo102-forest-rock-outcrop/candidate-09.png',
    candidate: 'wo102-forest-rock-outcrop/candidate-09',
    bodyKind: 'cliff',
    canvas: Object.freeze({ w: 384, h: 384 }),
    density: 1,
    groundContactY: 344,
    shadowDirection: 'south-east',
    bakedShadow: true,
    footprintTiles: Object.freeze({ w: 5.2, h: 2.8 }),
    collisionPolygons: Object.freeze([Object.freeze([[0.5, 0.2], [4.8, 0.2], [5.1, 2.4], [0.2, 2.5]])]),
    overSlice: Object.freeze({ x: 0, y: 20, w: 384, h: 130, anchor: 'cliff-lip' }),
    r1Observation: 'At seed 1337 near grid 57,2, the forest boundary reads as one authored cliff wall rather than scattered small rocks.',
  }),
  Object.freeze({
    id: 'wo102-megaprop/farm-barn-silo-cluster',
    src: './assets/generated/hmh-wo102-megaprops/processed/wo102-farm-barn-silo-cluster/candidate-09.png',
    candidate: 'wo102-farm-barn-silo-cluster/candidate-09',
    bodyKind: 'farmstead',
    canvas: Object.freeze({ w: 384, h: 384 }),
    density: 1,
    groundContactY: 344,
    shadowDirection: 'south-east',
    bakedShadow: true,
    footprintTiles: Object.freeze({ w: 6.2, h: 3.0 }),
    collisionPolygons: Object.freeze([Object.freeze([[0.7, 0.5], [5.6, 0.5], [5.9, 2.4], [0.3, 2.5]])]),
    overSlice: null,
    r1Observation: 'At seed 1337 near grid 83,4, a barn and silo cluster with fence apron and SE baked shadow anchors the farm zone.',
  }),
]);

const WO102_MEGA_PROP_ASSETS_BY_KEY = new Map(WO102_MEGA_PROP_ASSETS.map((asset) => [asset.id, asset]));

export const WO104_106_WORLD_KIT_STAMPS = Object.freeze({
  assetPackId: HMH_WO104_106_WORLD_KIT.id,
  acceptance: 'WO-104/105/106 original repo-generated transparent pixel-art assets are wired through exact-key prefab stamps; no random scatter or unresolved placeholders.',
  requiredKeys: Object.freeze(HMH_WO104_106_WORLD_KIT.assets.map((asset) => asset.key)),
});

export function wo102MegaPropAssetByKey(assetKey) {
  return WO102_MEGA_PROP_ASSETS_BY_KEY.get(assetKey) ?? null;
}

export function wo104106WorldKitAssetSrc(assetKey) {
  return wo104106WorldKitAssetByKey(assetKey)?.src ?? null;
}

function routeTile(id, x, y, role = 'road') {
  return Object.freeze({ id, x, y, role, layer: 'ground' });
}

function openingSpec(id, assetKey, use, x, y, options = {}) {
  return Object.freeze({
    id,
    assetKey,
    use,
    x,
    y,
    solid: options.solid ?? SOLID_FOR_USE[use] ?? false,
    notes: options.notes ?? '',
    sourceZoneId: options.sourceZoneId ?? 'opening-broken-road',
  });
}

const OPENING_ROUTE_TILES = Object.freeze([
  ...Array.from({ length: 17 }, (_, i) => routeTile(`main-road-${i}`, -12 + i * 3, 5, 'road')),
  ...Array.from({ length: 5 }, (_, i) => routeTile(`gas-station-apron-${i}`, -4 + i * 2, 7, 'road')),
  ...Array.from({ length: 6 }, (_, i) => routeTile(`town-telegraph-shoulder-${i}`, 18 + i * 3, 4, i < 2 ? 'road' : 'rocky')),
]);

const OPENING_LANDMARKS = Object.freeze([
  openingSpec('gas-station-landmark', 'level-1/building/landmark-gas-station', 'landmark', -9, 8, {
    notes: 'large curated spawn landmark anchors the opening camera',
  }),
  openingSpec('boarded-storefront-telegraph', 'level-1/building/ghost-boarded-storefront', 'landmark', 21, 2, {
    notes: 'telegraphs ghost-town main street ahead instead of random desert scatter',
  }),
  openingSpec('saloon-silhouette-telegraph', 'level-1/building/ghost-saloon-front', 'landmark', 31, 3, {
    notes: 'distant saloon silhouette frames the next combat beat',
  }),
  openingSpec('storefront-side-anchor', 'level-1/building/storefront-0', 'landmark', 9, 2, {
    notes: 'small town-side anchor for the spawn camera composition',
  }),
  openingSpec('route-arcade-cache', 'level-1/building/arcade-cabinet', 'dressing', 12, 8, {
    solid: false,
    notes: 'small Lester arcade landmark rewards the first detour read without blocking the scene',
  }),
]);

const OPENING_BOUNDARIES = Object.freeze([
  openingSpec('north-cactus-0', 'curated-prop/cactus1-1', 'boundary', -14, 2, { solid: true }),
  openingSpec('north-cactus-1', 'curated-prop/cactus2-1', 'boundary', -6, 2, { solid: true }),
  openingSpec('north-rock-0', 'level-1/prop/oval-rock1-grass-shadow', 'boundary', 5, 2, { solid: true }),
  openingSpec('north-rock-1', 'level-1/prop/oval-rock2-ground-shadow', 'boundary', 15, 2, { solid: true }),
  openingSpec('north-desert-line-0', 'level-1/prop/desert-09', 'boundary', 24, 2, { solid: true }),
  openingSpec('north-desert-line-1', 'level-1/prop/desert-10', 'boundary', 35, 2, { solid: true }),
  openingSpec('south-rock-0', 'level-1/prop/oval-rock1-ground-shadow', 'boundary', -12, 10, { solid: true }),
  openingSpec('south-cactus-0', 'curated-prop/cactus1-2', 'boundary', 2, 10, { solid: true }),
  openingSpec('south-broken-tree', 'curated-prop/broken-tree3', 'boundary', 22, 10, { solid: true }),
  openingSpec('south-bush-line', 'curated-prop/autumn-bush2', 'boundary', 36, 9, { solid: true }),
]);

const OPENING_SET_DRESSING = Object.freeze([
  openingSpec('spawn-bus-stop-sign', 'level-1/prop/bus-stop-sign', 'dressing', 6, 3, { solid: false }),
  openingSpec('dragon-bone-foreground', 'level-1/prop/dragon-bones-body-ground-shadow', 'dressing', -16, 6, { solid: false }),
  openingSpec('small-desert-0', 'level-1/prop/desert-13', 'dressing', -1, 8, { solid: false }),
  openingSpec('small-desert-1', 'level-1/prop/desert-14', 'dressing', 18, 7, { solid: false }),
  openingSpec('roadside-crate', 'level-1/building/wooden-crate', 'dressing', 11, 4, { solid: false }),
  openingSpec('route-soda-machine', 'level-1/building/soda-machine', 'dressing', 27, 6, { solid: false }),
]);

const OPENING_COMPOSITION = Object.freeze({
  id: 'level-one-opening-authored-aaa-v1',
  source: 'Justin curated hmh-curated-level-kit',
  clearLane: Object.freeze({ centerY: 5, widthTiles: 7, startX: -16, endX: 38 }),
  routeTiles: OPENING_ROUTE_TILES,
  landmarks: OPENING_LANDMARKS,
  boundaries: OPENING_BOUNDARIES,
  setDressing: OPENING_SET_DRESSING,
  objects: Object.freeze([...OPENING_LANDMARKS, ...OPENING_BOUNDARIES, ...OPENING_SET_DRESSING]),
});

function prefabStamp(id, districtId, objects, data = {}) {
  return Object.freeze({
    id,
    districtId,
    authoredPrefabStamp: true,
    label: data.label ?? id,
    routeBeat: data.routeBeat ?? 'route',
    routeRead: data.routeRead ?? 'authored traversal stamp',
    anchor: Object.freeze({ x: data.anchor?.x ?? 0, y: data.anchor?.y ?? 5 }),
    assetKeys: Object.freeze(objects.map((object) => object.assetKey)),
    objects: Object.freeze(objects.map((object, index) => Object.freeze({
      id: object.id ?? `${id}-${index}`,
      assetKey: object.assetKey,
      use: object.use,
      dx: object.dx ?? 0,
      dy: object.dy ?? 0,
      solid: object.solid,
      notes: object.notes ?? data.routeRead ?? '',
      metadata: object.metadata ?? {},
    }))),
  });
}

export const LEVEL_ONE_AUTHORED_PREFAB_STAMPS = Object.freeze([
  prefabStamp('desert-road-salvage-wall', 'desert-approach', [
    { assetKey: 'level-1/prop/desert-09', use: 'boundary', dx: -5, dy: -3, solid: true },
    { assetKey: 'level-1/prop/desert-10', use: 'boundary', dx: 3, dy: -3, solid: true },
    { assetKey: 'level-1/prop/dragon-bones-body-ground-shadow', use: 'landmark', dx: -3, dy: 3, solid: false },
    { assetKey: 'level-1/prop/oval-rock4-ground-shadow', use: 'boundary', dx: 5, dy: 2, solid: true },
    { assetKey: 'level-1/prop/bus-stop-sign', use: 'dressing', dx: 0, dy: -1, solid: false },
  ], { label: 'Broken road salvage wall', routeBeat: 'spawn', anchor: { x: 18, y: 5 }, routeRead: 'desert road edges and salvage silhouettes break up empty sand' }),
  prefabStamp('ghost-town-frontage-pocket', 'ghost-town', [
    { assetKey: 'wo102-megaprop/noodle-bar-storefront', use: 'landmark', dx: -2, dy: -4, solid: true, notes: 'WO-102 replacement: alpha-clean PixelLab mega-prop storefront replaces small boarded storefront card art' },
    { assetKey: 'level-1/building/ghost-saloon-front', use: 'landmark', dx: 3, dy: -4, solid: true },
    { assetKey: 'level-1/prop/street-lamp', use: 'dressing', dx: -1, dy: -1, solid: false },
    { assetKey: 'level-1/building/wooden-crate', use: 'dressing', dx: 5, dy: 2, solid: false },
    { assetKey: 'level-1/prop/town-01', use: 'boundary', dx: -4, dy: 3, solid: true },
    { assetKey: 'level-1/prop/trash-can', use: 'dressing', dx: 2, dy: 3, solid: false },
  ], { label: 'Ghost town street frontage', routeBeat: 'arena', anchor: { x: 42, y: 6 }, routeRead: 'false-front silhouettes and curb dressing make the street read authored' }),
  prefabStamp('wo102-forest-cliff-proof', 'country-road', [
    { assetKey: 'wo102-megaprop/forest-rock-outcrop', use: 'boundary', dx: 0, dy: 0, solid: true, notes: 'WO-102 proof: selected alpha-clean forest cliff mega-prop replaces scattered small rock/tree boundary art' },
  ], { label: 'WO-102 forest cliff proof', routeBeat: 'loop', anchor: { x: 57, y: 2 }, routeRead: 'one composed cliff wall reads as authored forest boundary' }),
  prefabStamp('forest-mushroom-ring', 'dead-forest-loop', [
    { assetKey: 'level-1/flora/broken-tree3', use: 'boundary', dx: -4, dy: -3, solid: true },
    { assetKey: 'level-1/flora/burned-tree2', use: 'boundary', dx: 5, dy: -2, solid: true },
    { assetKey: 'level-1/prop/orange-mushrooms1-ground-shadow', use: 'landmark', dx: 0, dy: 0, solid: false },
    { assetKey: 'level-1/prop/black-mushrooms2-ground-shadow', use: 'dressing', dx: -3, dy: 3, solid: false },
    { assetKey: 'level-1/prop/oval-rock2-ground-shadow', use: 'boundary', dx: 4, dy: 3, solid: true },
  ], { label: 'Dead forest mushroom ring', routeBeat: 'loop', anchor: { x: 54, y: 12 }, routeRead: 'tree walls and mushroom color accents define forest loops' }),
  prefabStamp('shoreline-ford-bank', 'country-road', [
    { assetKey: 'level-1/water/water-02', use: 'water', dx: -4, dy: 0, solid: false },
    { assetKey: 'level-1/water/water-03', use: 'water', dx: 0, dy: 0, solid: false },
    { assetKey: 'level-1/prop/water-ruins2', use: 'landmark', dx: 4, dy: -2, solid: true },
    { assetKey: 'level-1/prop/oval-rock5-ground-shadow', use: 'boundary', dx: -5, dy: 3, solid: true },
    { assetKey: 'level-1/prop/caury-white1-ground-shadow', use: 'dressing', dx: 2, dy: 3, solid: false },
    { assetKey: 'level1-authored-stamp/river-bridge-arrow-sign', use: 'dressing', dx: 1, dy: -2, solid: false, notes: 'new generated arrow marker clarifies the bridge/ford route direction' },
  ], { label: 'Shoreline ford bank', routeBeat: 'chokepoint', anchor: { x: 64, y: 7 }, routeRead: 'waterline, rocks, and small shore reads make bridge/ford traversal legible' }),
  prefabStamp('farmstead-fence-pocket', 'residential-edge', [
    { assetKey: 'wo102-megaprop/farm-barn-silo-cluster', use: 'landmark', dx: 0, dy: -2, solid: true, notes: 'WO-102 replacement: alpha-clean PixelLab barn and silo mega-prop replaces generic town-10 farm placeholder' },
    { assetKey: 'level-1/prop/park-bench', use: 'dressing', dx: 3, dy: -1, solid: false },
    { assetKey: 'level-1/flora/oak-tree', use: 'boundary', dx: 5, dy: 2, solid: true },
    { assetKey: 'level-1/prop/mailbox', use: 'dressing', dx: -2, dy: 3, solid: false },
    { assetKey: 'level-1/prop/oval-rock1-grass-shadow', use: 'boundary', dx: -5, dy: 2, solid: true },
  ], { label: 'Farmstead fence pocket', routeBeat: 'pressure', anchor: { x: 82, y: 6 }, routeRead: 'farm edge reads as a lived-in loop rather than blank grass' }),
  prefabStamp('wo104-forest-canopy-cliff-checkpoint', 'dead-forest-loop', [
    { assetKey: 'wo104-world/forest-canopy-sway', use: 'canopy', dx: -4, dy: -4, solid: true, notes: 'WO-104: swaying canopy occluder frames the dry forest loop without random scatter' },
    { assetKey: 'wo104-world/mossy-cliff-wall', use: 'boundary', dx: 5, dy: -5, solid: true, notes: 'WO-104: mossy cliff wall turns the forest/cave edge into an authored blocker while staying outside the immediate fight lane' },
    { assetKey: 'level-1/prop/orange-mushrooms1-ground-shadow', use: 'dressing', dx: -1, dy: 1, solid: false },
    { assetKey: 'level-1/flora/broken-tree2', use: 'boundary', dx: 5, dy: 2, solid: true },
  ], { label: 'WO-104 forest canopy/cliff checkpoint', routeBeat: 'forest', anchor: { x: 55, y: 12 }, routeRead: 'canopy, cliff, and mushroom accents make the forest pocket read authored before Checkpoint 1' }),
  prefabStamp('wo104-lakeside-firefly-bank-checkpoint', 'country-road', [
    { assetKey: 'wo104-world/reed-bank-fireflies', use: 'ambient', dx: -4, dy: 1, solid: false, notes: 'WO-104: ambient firefly/reed-bank prop adds life to the lakeside edge' },
    { assetKey: 'level-1/water/water-02', use: 'water', dx: -1, dy: 2, solid: false },
    { assetKey: 'level-1/water/water-03', use: 'water', dx: 2, dy: 2, solid: false },
    { assetKey: 'wo104-world/park-tree-bench-cluster', use: 'landmark', dx: 7, dy: -5, solid: true, notes: 'WO-104: small park/bench cluster differentiates the lakeside rest pocket while staying outside the combat lane' },
  ], { label: 'WO-104 lakeside firefly bank', routeBeat: 'chokepoint', anchor: { x: 84, y: 7 }, routeRead: 'water edge now has reeds, fireflies, and a park read instead of bare shoreline' }),
  prefabStamp('wo105-forest-log-arena-checkpoint', 'dead-forest-loop', [
    { assetKey: 'wo105-world/forest-log-arena-ring', use: 'boundary', dx: -8, dy: 0, solid: true, notes: 'WO-105: fallen-log cover ring defines a forest arena edge without random scatter' },
    { assetKey: 'wo105-world/cracked-road-barricade', use: 'route', dx: 2, dy: 2, solid: false, notes: 'WO-105: broken road apron ties the forest pocket back into the authored route' },
    { assetKey: 'wo104-world/mossy-cliff-wall', use: 'boundary', dx: 6, dy: -4, solid: true, notes: 'WO-105: cliff wall frames the forest arena as a deliberate combat pocket' },
    { assetKey: 'level-1/prop/orange-mushrooms1-ground-shadow', use: 'dressing', dx: 0, dy: 3, solid: false },
  ], { label: 'WO-105 forest log arena', routeBeat: 'arena', anchor: { x: 55, y: 12 }, routeRead: 'fallen logs, cliff edge, and road apron define the forest arena capture beat' }),
  prefabStamp('wo105-bank-plaza-arena-checkpoint', 'ghost-town', [
    { assetKey: 'wo105-world/bank-plaza-kiosk', use: 'plaza', dx: 0, dy: -8, solid: true, notes: 'WO-105: bank/ATM kiosk anchors the plaza arena as a concrete place while staying above the combat lane' },
    { assetKey: 'wo105-world/town-bank-frontage', use: 'landmark', dx: -6, dy: -7, solid: true, notes: 'WO-105: new bank frontage replaces old generic building cards around the ghost-town arena' },
    { assetKey: 'wo105-world/cracked-road-junction', use: 'route', dx: -2, dy: 0, solid: false, notes: 'WO-105: T-junction plate makes the bank plaza road branch readable' },
    { assetKey: 'wo105-world/cracked-road-barricade', use: 'route', dx: -5, dy: 2, solid: false, notes: 'WO-105: cracked asphalt road apron makes the street transition sensible' },
    { assetKey: 'wo105-world/container-cover-line', use: 'container', dx: 7, dy: 3, solid: true, notes: 'WO-105: container cover creates a deliberate arena flank blocker outside the player lane' },
    { assetKey: 'level-1/prop/street-lamp', use: 'dressing', dx: -2, dy: -3, solid: false },
  ], { label: 'WO-105 bank plaza arena', routeBeat: 'arena', anchor: { x: 48, y: 6 }, routeRead: 'bank kiosk, new frontage, junction plate, road apron, and container cover define a readable town arena' }),
  prefabStamp('wo105-second-town-road-checkpoint', 'residential-edge', [
    { assetKey: 'wo105-world/second-town-building-row', use: 'landmark', dx: -4, dy: -5, solid: true, notes: 'WO-105: second-town facade row replaces generic building cards at the extraction approach' },
    { assetKey: 'wo105-world/cracked-road-junction', use: 'route', dx: 0, dy: 1, solid: false, notes: 'WO-105: junction plate makes the road split into second-town and extraction-yard lanes' },
    { assetKey: 'wo105-world/cracked-road-barricade', use: 'route', dx: 5, dy: 2, solid: false, notes: 'WO-105: barricade narrows the lane into a deliberate arena threshold' },
    { assetKey: 'wo104-world/park-tree-bench-cluster', use: 'landmark', dx: 6, dy: -4, solid: true, notes: 'WO-105: park edge keeps the second-town road from reading as bare asphalt' },
  ], { label: 'WO-105 second-town road checkpoint', routeBeat: 'road', anchor: { x: 88, y: 7 }, routeRead: 'second-town facade, park edge, and cracked junction make the road-to-extraction transition sensible' }),
  prefabStamp('wo105-container-extraction-yard-checkpoint', 'inner-city-threshold', [
    { assetKey: 'wo105-world/container-cover-line', use: 'container', dx: -6, dy: 4, solid: true, notes: 'WO-105: container wall stages the extraction-yard arena edge without blocking the center lane' },
    { assetKey: 'wo105-world/cracked-road-barricade', use: 'route', dx: 2, dy: 1, solid: false, notes: 'WO-105: road barricade points the lane toward the extraction pad' },
    { assetKey: 'wo105-world/extraction-yard-warehouse', use: 'landmark', dx: -6, dy: -4, solid: true, notes: 'WO-105: new warehouse art replaces old generic industrial-warehouse building art in the extraction arena' },
    { assetKey: 'level1-authored-stamp/boss-yard-warning-pylon', use: 'dressing', dx: 4, dy: -2, solid: false },
  ], { label: 'WO-105 container extraction yard', routeBeat: 'boss', anchor: { x: 93, y: 8 }, routeRead: 'new warehouse silhouette, containers, and cracked road describe the boss/extraction arena' }),
  prefabStamp('wo106-roadside-vehicle-micro-scenes', 'residential-edge', [
    { assetKey: 'wo106-world/abandoned-pickup', use: 'vehicle', dx: -4, dy: 1, solid: false, notes: 'WO-106: abandoned pickup adds roadside life without becoming a hard blocker' },
    { assetKey: 'wo106-world/delivery-van-cache', use: 'vehicle', dx: 3, dy: 2, solid: false, notes: 'WO-106: delivery van/cache micro-scene reinforces loot-route storytelling' },
    { assetKey: 'wo106-world/critter-dust-burrow', use: 'ambient', dx: 0, dy: -2, solid: false, notes: 'WO-106: burrow/dust puffs telegraph critter life before flee AI ships' },
    { assetKey: 'level-1/prop/bus-stop-sign', use: 'dressing', dx: -1, dy: 3, solid: false },
  ], { label: 'WO-106 roadside vehicle micro-scenes', routeBeat: 'micro-scene', anchor: { x: 74, y: 8 }, routeRead: 'vehicles, cache, and critter burrow make the route feel inhabited' }),
  prefabStamp('innercity-gate-barricade', 'inner-city-threshold', [
    { assetKey: 'level-1/building/industrial-warehouse-facade', use: 'landmark', dx: -5, dy: -4, solid: true },
    { assetKey: 'level-1/building/innercity-billboard-frame', use: 'landmark', dx: 4, dy: -4, solid: true },
    { assetKey: 'level-1/prop/blue-gray-ruins1', use: 'boundary', dx: -4, dy: 3, solid: true },
    { assetKey: 'level-1/prop/brown-ruins2', use: 'boundary', dx: 4, dy: 3, solid: true },
    { assetKey: 'level-1/prop/traffic-cone', use: 'dressing', dx: 0, dy: 1, solid: false },
    { assetKey: 'level1-authored-stamp/boss-yard-warning-pylon', use: 'dressing', dx: 1, dy: -2, solid: false, notes: 'new generated warning pylon telegraphs the boss-yard threshold' },
  ], { label: 'Inner-city gate barricade', routeBeat: 'boss', anchor: { x: 94, y: 6 }, routeRead: 'industrial silhouettes and ruins frame the boss-yard approach' }),
  prefabStamp('ruined-camp-bone-yard', 'desert-bone-camp', [
    { assetKey: 'level-1/prop/dragon-bones-full-ground-shadow', use: 'landmark', dx: -2, dy: -2, solid: false },
    { assetKey: 'level-1/prop/sand-ruins3', use: 'boundary', dx: 5, dy: -2, solid: true },
    { assetKey: 'level-1/prop/brown-gray-ruins4', use: 'boundary', dx: -5, dy: 3, solid: true },
    { assetKey: 'level-1/prop/desert-14', use: 'dressing', dx: 2, dy: 3, solid: false },
    { assetKey: 'level-1/prop/rocky-05', use: 'boundary', dx: 0, dy: 5, solid: true },
  ], { label: 'Ruined camp bone yard', routeBeat: 'pressure', anchor: { x: 28, y: -8 }, routeRead: 'bone and ruin setpieces create desert arena edges' }),
  prefabStamp('roadside-arcade-cache', 'desert-approach', [
    { assetKey: 'level-1/building/arcade-cabinet', use: 'landmark', dx: -3, dy: -1, solid: false },
    { assetKey: 'level-1/building/soda-machine', use: 'dressing', dx: 3, dy: -1, solid: false },
    { assetKey: 'level-1/building/wooden-crate', use: 'dressing', dx: 5, dy: 2, solid: false },
    { assetKey: 'level-1/prop/road-03', use: 'dressing', dx: -5, dy: 2, solid: false },
    { assetKey: 'level-1/prop/desert-08', use: 'boundary', dx: 0, dy: 4, solid: true },
  ], { label: 'Roadside arcade cache', routeBeat: 'spawn', anchor: { x: 10, y: 8 }, routeRead: 'coin-slot fantasy and roadside props create a reward pocket' }),
  prefabStamp('litecoin-extraction-beacon-pad', 'finale-extraction', [
    { assetKey: 'level1-authored-stamp/extraction-pad-litcoin-beacon', use: 'landmark', dx: 1, dy: -2, solid: false, notes: 'new generated beacon makes the extraction pad read as the final route target' },
    { assetKey: 'level-1/building/town-10', use: 'landmark', dx: 5, dy: -4, solid: true },
    { assetKey: 'level-1/prop/park-bench', use: 'dressing', dx: -5, dy: 2, solid: false },
    { assetKey: 'level-1/flora/oak-tree', use: 'boundary', dx: 5, dy: 3, solid: true },
  ], { label: 'Litecoin extraction beacon pad', routeBeat: 'extract', anchor: { x: 100, y: 5 }, routeRead: 'blue-gold beacon and flare road mark the final extraction read' }),
]);

const ZONE_OFFSETS = Object.freeze([
  [-3, -2], [0, -2], [3, -2],
  [-4, 0], [0, 0], [4, 0],
  [-3, 2], [0, 2], [3, 2],
]);

export function levelOneCuratedRuntimeArtPolicy() {
  return Object.freeze({
    id: 'level-one-visible-curated-runtime-v1',
    requiredWorldSource: 'hmh-level-one-curated-world-contract',
    curatedManifestId: HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.assetSource.manifestId,
    sceneObjectsNearAllowed: false,
    randomWorldDressingAllowed: false,
    worldDressingPlacement: 'authored-prefab-stamps-exact-asset-keys',
    enemyFallbacksAllowed: false,
    disallowedEnemyFallbacks: Object.freeze(['HMH_ENEMIES_WAVE', 'combatArt.enemies', 'rectangle-fallback']),
  });
}

export function buildLevelOneOpeningComposition() {
  return OPENING_COMPOSITION;
}

export function levelOneAuthoredStampAssetSrc(assetKey) {
  return authoredStampAssetByKey(assetKey)?.src ?? null;
}

export function levelOneCuratedAssetSrc(assetKey) {
  return curatedLevelKitAssetByKey(assetKey)?.src
    ?? levelOneAuthoredStampAssetSrc(assetKey)
    ?? wo102MegaPropAssetByKey(assetKey)?.src
    ?? wo104106WorldKitAssetSrc(assetKey)
    ?? null;
}

export function levelOneOpeningGroundRoleForTile({ worldX = 0, worldY = 0 } = {}) {
  const x = Math.round(worldX);
  const y = Math.round(worldY);
  if (x < -22 || x > 44 || y < -4 || y > 16) return null;

  // Diegetic shoulder bands first, so the road has visible boundaries instead of
  // infinite flat sand. The playable lane still remains wide at y=4..6.
  if (x >= 12 && x <= 40 && y >= 2 && y <= 3) return 'rocky';
  if (x >= 10 && x <= 40 && y >= 8 && y <= 11) return 'grass';
  if (x >= -18 && x <= 40 && y >= 4 && y <= 6) return 'road';
  if (x >= -8 && x <= 10 && y >= 7 && y <= 8) return 'road';
  if (x < -10 && y >= 1 && y <= 8) return 'rocky';
  if (y >= 9) return 'grass';
  return 'sand';
}

function anchorForZone(zone) {
  // Contract xPct/yPct are map-composition percentages. The live roguelike world
  // uses compact isometric tile coordinates, so keep X as the route progression
  // and compress Y into a readable lane around the player's starting camera.
  return Object.freeze({
    x: Math.round(zone.xPct),
    y: Math.round(5 + ((zone.yPct ?? 50) - 50) / 6),
  });
}

function objectFromAsset({ id, assetKey, use, x, y, notes = '', zoneId = null, index = 0, solid = undefined, metadata = {} }) {
  // Terrain sheets belong to the ground-tile renderer, not the obstacle/prop
  // renderer. Drawing them as props is what made the corrected runtime look like
  // repeated grey block clutter instead of a clean authored route.
  if (use === 'terrain') return null;
  const record = curatedLevelKitAssetByKey(assetKey)
    ?? authoredStampAssetByKey(assetKey)
    ?? wo102MegaPropAssetByKey(assetKey)
    ?? wo104106WorldKitAssetByKey(assetKey);
  if (!record) return null;
  const generatedStampArt = Boolean(authoredStampAssetByKey(assetKey));
  const generatedMegaPropArt = Boolean(wo102MegaPropAssetByKey(assetKey));
  const generatedWorldKitArt = Boolean(wo104106WorldKitAssetByKey(assetKey));
  const sceneRole = ROLE_FOR_USE[use] ?? 'smallprop';
  return Object.freeze({
    id,
    assetKey,
    curatedAssetKey: assetKey,
    imageSrc: record.src,
    curated: !generatedStampArt && !generatedMegaPropArt && !generatedWorldKitArt,
    generatedStampArt,
    generatedMegaPropArt,
    generatedWorldKitArt,
    sourcePolicy: generatedMegaPropArt
      ? 'repo-generated-wo102-megaprop-art'
      : generatedWorldKitArt
        ? 'repo-generated-wo104-106-world-kit-art'
        : generatedStampArt
          ? 'repo-generated-authored-stamp-art'
          : 'Justin-curated-level-kit-only',
    role: sceneRole,
    sceneRole,
    use,
    gridX: x,
    gridY: y,
    solid: solid ?? SOLID_FOR_USE[use] ?? false,
    zHeight: use === 'landmark' ? 4 : use === 'boundary' ? 2 : 0,
    drawOrderBias: use === 'landmark' ? 16 : use === 'boundary' ? 8 : 0,
    text: notes,
    sourceZoneId: zoneId,
    propIndex: index,
    footprintTiles: record.footprintTiles ?? metadata.footprintTiles ?? null,
    collisionPolygons: record.collisionPolygons ?? metadata.collisionPolygons ?? null,
    overSlice: record.overSlice ?? metadata.overSlice ?? null,
    r1Observation: record.r1Observation ?? metadata.r1Observation ?? null,
    ...metadata,
  });
}

function openingObjects() {
  return OPENING_COMPOSITION.objects
    .map((spec, index) => objectFromAsset({
      id: `curated-opening-${spec.id}`,
      assetKey: spec.assetKey,
      use: spec.use,
      x: spec.x,
      y: spec.y,
      solid: spec.solid,
      zoneId: spec.sourceZoneId,
      notes: spec.notes,
      index,
    }))
    .filter(Boolean);
}

function contractZoneObjects() {
  const objects = [];
  for (const zone of curatedLevelOneCriticalPath()) {
    const anchor = anchorForZone(zone);
    zone.assetRefs.forEach((ref, index) => {
      const [dx, dy] = ZONE_OFFSETS[index % ZONE_OFFSETS.length];
      const object = objectFromAsset({
        id: `curated-${zone.id}-${index}-${String(ref.use).replace(/[^a-z0-9-]/gi, '-')}`,
        assetKey: ref.assetKey,
        use: ref.use,
        x: anchor.x + dx,
        y: anchor.y + dy,
        notes: ref.notes,
        zoneId: zone.id,
        index,
      });
      if (object) objects.push(object);
    });
  }
  return objects;
}

function worldDressingObjects({ playerX = 0, playerY = 5, window = 18, frame = 0 } = {}) {
  const pad = 10;
  const objects = [];
  for (const stamp of LEVEL_ONE_AUTHORED_PREFAB_STAMPS) {
    const anchorX = stamp.anchor.x;
    const anchorY = stamp.anchor.y;
    if (Math.abs(anchorX - playerX) > window + pad || Math.abs(anchorY - playerY) > window + pad) continue;
    stamp.objects.forEach((spec, index) => {
      const x = anchorX + spec.dx;
      const y = anchorY + spec.dy;
      // Keep a generous fight lane immediately around the player; silhouettes
      // frame the screen instead of spawning directly underfoot.
      if (Math.hypot(x - playerX, y - playerY) < 5.5 && spec.solid !== false) return;
      const ambientLife = ambientLifeCueForVisibleObject({ assetKey: spec.assetKey, gridX: x, gridY: y }, {
        playerX,
        playerY,
        frame,
        biome: stamp.districtId,
      });
      const object = objectFromAsset({
        id: `curated-prefab-${stamp.id}-${index}`,
        assetKey: spec.assetKey,
        use: spec.use,
        x,
        y,
        solid: spec.solid,
        notes: spec.notes,
        zoneId: `authored-prefab-${stamp.id}`,
        index,
        metadata: {
          authoredPrefabStamp: true,
          prefabStampId: stamp.id,
          districtId: stamp.districtId,
          routeBeat: stamp.routeBeat,
          exactAssetKey: spec.assetKey,
          ...(ambientLife ? { ambientLife } : {}),
        },
      });
      if (object) objects.push(object);
    });
  }
  return objects;
}

function isForbiddenInsideSpawnGate(object) {
  const gate = HMH_LEVEL_ONE_SPAWN_GATE_REDRESS;
  const dist = Math.hypot(Number(object?.gridX) || 0, Number(object?.gridY) || 0);
  if (dist >= gate.safeRadiusTiles) return false;
  const role = String(object?.role ?? object?.sceneRole ?? '');
  const tallSolid = object?.solid && ((object?.zHeight ?? 0) >= 2 || ['landmark', 'wall', 'building'].includes(role));
  const water = role === 'water-strip' || String(object?.assetKey ?? '').includes('/water/');
  return tallSolid || water;
}

export function buildLevelOneCuratedVisibleSceneObjects({ playerX = 0, playerY = 5, window = 18, frame = 0 } = {}) {
  const objects = [...openingObjects(), ...contractZoneObjects(), ...worldDressingObjects({ playerX, playerY, window, frame })];
  const visible = objects.filter((object) =>
    !isForbiddenInsideSpawnGate(object)
    && Math.abs(object.gridX - playerX) <= window + 6
    && Math.abs(object.gridY - playerY) <= window + 6,
  );
  const ids = new Set();
  return Object.freeze(visible.filter((object) => {
    if (ids.has(object.id)) return false;
    ids.add(object.id);
    return true;
  }));
}
