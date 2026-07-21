import { ambientLifeCueForVisibleObject } from './hmh-ambient-life.mjs';
import {
  HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT,
  HMH_LEVEL_ONE_SPAWN_GATE_REDRESS,
  curatedLevelOneCriticalPath,
} from './hmh-level-one-curated-world-contract.mjs';
import { curatedLevelKitAssetByKey } from '../assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs';
import { authoredStampAssetByKey } from '../assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-manifest.mjs';
import {
  HMH_WO104_106_WORLD_KIT,
  wo104106WorldKitAssetByKey,
} from '../assets/generated/hmh-wo104-106-world-kit/hmh-wo104-106-world-kit-manifest.mjs';
import { levelOneWorldV3LandmarkAssetByKey } from '../assets/generated/hmh-level-one-world-v3/hmh-level-one-world-v3-landmarks.mjs';

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
  vehicle: true,
  plaza: true,
  container: true,
});

const SUBSTANTIAL_DRESSING_PATTERN = /(?:gas-pump|generator|cable-spool|battery-cabinet|arcade-cabinet|transformer|mining-rig|satellite-dish|stone-well|trash-can|barrel-stack|supply-crate|workbench)/;

function curatedLevelArtPropByKey(assetKey) {
  const match = (assetKey || '').match(/^curated\/(jul9-[a-z-]+)-(\d\d-.+)$/);
  return match ? { src: `./assets/generated/hmh-curated-level-art/props/environment/${match[1]}/${match[2]}.png` } : null;
}

function curatedTreeAnimationAssetByKey(assetKey) {
  const match = (assetKey || '').match(/^curated-tree\/(jul9-[a-z-]+)-idle-(\d\d)$/);
  return match ? { src: `./assets/generated/hmh-curated-level-art/props/trees/${match[1]}/idle/${match[2]}.png` } : null;
}

function inferredSolidFootprint(assetKey, use) {
  const key = String(assetKey || '').toLowerCase();
  if (SUBSTANTIAL_DRESSING_PATTERN.test(key)) return Object.freeze({ w: 2.0, h: 1.25 });
  if (use === 'vehicle') return Object.freeze({ w: 3.2, h: 1.6 });
  if (use === 'container') return Object.freeze({ w: 4.0, h: 1.4 });
  if (use === 'plaza') return Object.freeze({ w: 3.2, h: 2.2 });
  if (use === 'canopy' || /(?:tree|flora|sapling|bush|cactus|stump)/.test(key)) return Object.freeze({ w: 1.6, h: 1.4 });
  if (/(?:fence|wall|barricade|gate|sandbag|log|roadblock)/.test(key)) return Object.freeze({ w: 3.2, h: 1.0 });
  if (/(?:rock|boulder|rubble|ruins|bones)/.test(key)) return Object.freeze({ w: 2.2, h: 1.5 });
  if (use === 'landmark') {
    if (/(?:microscene|shrine|beacon|dish|rig|culvert)/.test(key)) return Object.freeze({ w: 2.8, h: 1.8 });
    return Object.freeze({ w: 4.8, h: 2.8 });
  }
  if (use === 'boundary') return Object.freeze({ w: 2.2, h: 1.4 });
  return null;
}

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
  openingSpec('west-storefront-shoulder-anchor', 'curated/jul9-roadside-buildings-large-02-roadside-convenience-store', 'landmark', -14, 1, {
    notes: 'large roadside convenience-store silhouette anchors the opening shoulder without covering spawn',
  }),
  openingSpec('boarded-storefront-telegraph', 'curated/jul9-main-street-storefronts-large-02-bank-loan-office-front', 'landmark', 21, 1, {
    notes: 'large bank/loan-office facade telegraphs ghost-town main street ahead',
  }),
  openingSpec('saloon-silhouette-telegraph', 'curated/jul9-roadside-buildings-large-00-motel-office-front', 'landmark', 32, 2, {
    notes: 'distant motel-office mass frames the next combat beat',
  }),
  openingSpec('fuel-stop-kiosk-anchor', 'curated/jul9-buildings-landmarks-01-gas-station-kiosk', 'landmark', 10, 11, {
    notes: 'small gas-station kiosk, pump pair, and wrecks establish a coherent roadside fuel-stop pocket outside the spawn-safe radius',
  }),
  openingSpec('route-broken-arcade-cache', 'curated/jul9-landmark-microscene-09-broken-arcade-cabinet', 'dressing', 12, 8, {
    solid: false,
    notes: 'small damaged Lester cabinet rewards the first detour without reading as a building-scale portal prop',
  }),
]);

const OPENING_BOUNDARIES = Object.freeze([
  openingSpec('north-tree-0', 'curated/jul9-tree-brush-00-small-dead-tree', 'boundary', -14, 2, { solid: true }),
  openingSpec('north-roadside-fence-0', 'curated/jul9-fences-barricades-00-wood-fence-straight', 'boundary', -6, 2, { solid: true }),
  openingSpec('north-roadside-fence-1', 'curated/jul9-fences-barricades-03-wood-fence-corner', 'boundary', 5, 2, { solid: true }),
  openingSpec('north-tree-1', 'curated/jul9-tree-brush-06-crooked-pine', 'boundary', 12, 1, { solid: true }),
  openingSpec('north-boulder-0', 'curated/jul9-rocks-boulders-14-jagged-wasteland-rock', 'boundary', 18, 2, { solid: true }),
  openingSpec('north-tree-2', 'curated/jul9-tree-brush-03-burnt-sapling', 'boundary', 26, 2, { solid: true }),
  openingSpec('north-roadblock-line-0', 'curated/jul9-fences-barricades-14-roadblock-cluster', 'boundary', 36, 2, { solid: true }),
  openingSpec('south-rock-0', 'curated/jul9-rocks-boulders-05-round-boulder', 'boundary', -12, 10, { solid: true }),
  openingSpec('south-bush-0', 'curated/jul9-tree-brush-10-dense-bush', 'boundary', 2, 11, { solid: true }),
  openingSpec('south-chainlink-gate', 'curated/jul9-fences-barricades-08-open-chainlink-gate', 'boundary', 22, 11, { solid: true }),
  openingSpec('south-sandbag-line', 'curated/jul9-fences-barricades-12-sandbag-barrier', 'boundary', 36, 10, { solid: true }),
]);

const OPENING_SET_DRESSING = Object.freeze([
  openingSpec('route-arrow-sign', 'level1-authored-stamp/river-bridge-arrow-sign', 'dressing', 14, 2, { solid: false, notes: 'route cue' }),
  openingSpec('coin-shrine-foreground', 'curated/jul9-landmark-microscene-08-coin-pile-shrine', 'dressing', -16, 6, { solid: false }),
  openingSpec('small-rock-cluster-0', 'curated/jul9-rocks-boulders-03-cracked-stone', 'dressing', 4, 9, { solid: false }),
  openingSpec('small-rock-cluster-1', 'curated/jul9-rocks-boulders-11-two-boulder-cover', 'dressing', 20, 8, { solid: false }),
  openingSpec('roadside-cable-spool', 'curated/jul9-industrial-mining-04-cable-spool', 'dressing', 11, 8, { solid: true }),
  openingSpec('opening-abandoned-pickup', 'curated/jul9-vehicles-street-junk-02-pickup-wreck', 'vehicle', 17, 9, { solid: true, notes: 'solid roadside vehicle outside the clear lane' }),
  openingSpec('opening-delivery-cache', 'curated/jul9-vehicles-street-junk-03-armored-cash-van-wreck', 'vehicle', 29, 8, { solid: true, notes: 'solid cache van outside the clear lane' }),
  openingSpec('opening-forecourt-cache', 'curated/jul9-vehicles-street-junk-12-gas-pump-pair', 'dressing', 9, 8, { solid: true, notes: 'forecourt cache outside the protected spawn lane' }),
  openingSpec('route-generator-cache', 'curated/jul9-industrial-mining-03-small-generator', 'dressing', 27, 6, { solid: true }),
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

function curatedSheetKeys(sheetSlug, labels) {
  return Object.freeze(labels.map((label, index) => `curated/${sheetSlug}-${String(index).padStart(2, '0')}-${label}`));
}

function stampObjectsForKeys(keys, use, options = {}) {
  const columns = options.columns ?? 4;
  const spacingX = options.spacingX ?? 3;
  const spacingY = options.spacingY ?? 3;
  const startX = options.startX ?? -5;
  const startY = options.startY ?? -4;
  return keys.map((assetKey, index) => ({
    assetKey,
    use,
    dx: startX + (index % columns) * spacingX,
    dy: startY + Math.floor(index / columns) * spacingY,
    solid: options.solid,
  }));
}

const JUL9_B_ASSETS = Object.freeze({
  extraction: curatedSheetKeys('jul9-extraction-monuments-b', ['extraction-arch', 'closed-boss-gate', 'open-boss-gate', 'ltc-beacon-pad']),
  neighborhood: curatedSheetKeys('jul9-neighborhood-small-props-b', ['weathered-picket-fence', 'trash-can-bags', 'mailbox-weeds', 'stone-well']),
  forest: curatedSheetKeys('jul9-forest-obstacles-b', ['mossy-fallen-log', 'rooted-tree-stump', 'forest-boulder-cluster', 'rotting-log-pile']),
  river: curatedSheetKeys('jul9-river-obstacles-b', ['waterlogged-log', 'concrete-river-block', 'submerged-stone-slab', 'broken-spillway', 'river-boulder-cluster', 'submerged-cart-wreck', 'shallow-rapid-strip', 'deep-rapid-strip']),
  signals: curatedSheetKeys('jul9-route-signs-beacons-b', [
    'amber-hanging-lamp', 'amber-lantern-sign', 'green-hanging-sign', 'green-double-sign',
    'amber-route-sign', 'green-route-sign', 'green-crossroad-sign', 'green-town-sign',
    'amber-short-lamp', 'cyan-short-lamp', 'cyan-beacon-post', 'cyan-square-beacon',
    'low-rock-marker', 'mossy-rock-marker', 'broken-log-marker', 'low-stone-marker',
    'amber-bollard', 'cyan-bollard', 'amber-pylon', 'cyan-pylon',
    'green-floor-marker', 'stone-floor-marker', 'cyan-floor-marker', 'broken-floor-marker',
  ]),
  desert: curatedSheetKeys('jul9-desert-props-b', ['desert-brush-cluster', 'bone-pile', 'rusted-buried-barrel', 'sandstone-rubble']),
  rocks: curatedSheetKeys('jul9-desert-rock-formations-b', ['sandstone-arch', 'hollow-skull-rock', 'cracked-flat-rock', 'sandstone-spire', 'cracked-flat-rock-alt', 'sandstone-spire-alt']),
  ambient: curatedSheetKeys('jul9-ambient-water-glow-b', [
    'firefly-drift-01', 'firefly-drift-02', 'firefly-drift-03', 'firefly-drift-04',
    'moss-glow-01', 'moss-glow-02', 'moss-glow-03', 'moss-glow-04',
    'water-glint-01', 'water-glint-02', 'water-glint-03', 'water-glint-04',
    'water-spark-01', 'water-spark-02', 'water-spark-03', 'water-spark-04',
  ]),
});

export const LEVEL_ONE_AUTHORED_PREFAB_STAMPS = Object.freeze([
  prefabStamp('compact-northwest-desert-outcrop', 'compact-northwest', [
    ...stampObjectsForKeys(JUL9_B_ASSETS.desert, 'dressing', { startX: -6, startY: 1 }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.rocks.slice(0, 3), 'boundary', { startX: -7, startY: -6, spacingX: 6, solid: true }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.signals.slice(0, 4), 'dressing', { startX: -5, startY: -2 }),
    { assetKey: 'curated-tree/jul9-desert-acacia-idle-00', use: 'canopy', dx: -8, dy: -2, solid: true },
    { assetKey: 'curated-tree/jul9-desert-mesquite-idle-00', use: 'canopy', dx: 7, dy: -2, solid: true },
    { assetKey: 'curated-tree/jul9-desert-joshua-idle-00', use: 'canopy', dx: 6, dy: 5, solid: true },
  ], { label: 'Northwest desert outcrop', routeBeat: 'exploration', anchor: { x: -108, y: -78 }, routeRead: 'desert trees, rocks, bones, and lamps define a complete outer-map POI' }),
  prefabStamp('compact-north-forest-grove', 'compact-north', [
    ...stampObjectsForKeys(JUL9_B_ASSETS.forest, 'boundary', { startX: -7, startY: -7, spacingX: 5, solid: true }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.ambient.slice(0, 8), 'ambient', { startX: -6, startY: 1 }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.signals.slice(4, 7), 'dressing', { startX: -4, startY: 5, spacingX: 4 }),
    { assetKey: 'curated-tree/jul9-riparian-juniper-idle-00', use: 'canopy', dx: -8, dy: -6, solid: true },
    { assetKey: 'curated-tree/jul9-riparian-dead-tree-idle-00', use: 'canopy', dx: 0, dy: -7, solid: true },
    { assetKey: 'curated-tree/jul9-riparian-cottonwood-idle-00', use: 'canopy', dx: 8, dy: -5, solid: true },
  ], { label: 'North forest grove', routeBeat: 'forest', anchor: { x: -36, y: -82 }, routeRead: 'tree canopy, log cover, boulders, and fireflies fill the northern forest' }),
  prefabStamp('compact-north-riverfront', 'compact-river', [
    ...JUL9_B_ASSETS.river.map((assetKey, index) => {
      const positions = [[-8, -5], [-3, -7], [3, -7], [8, -5], [-8, 3], [8, 3], [-4, 1], [4, 1]];
      return { assetKey, use: index >= 6 ? 'water' : 'boundary', dx: positions[index][0], dy: positions[index][1], solid: index < 6 };
    }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.ambient.slice(8, 12), 'ambient', { startX: -5, startY: 4 }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.signals.slice(7, 10), 'dressing', { startX: -4, startY: -7, spacingX: 4 }),
  ], { label: 'North riverfront crossing', routeBeat: 'waterfront', anchor: { x: 42, y: -78 }, routeRead: 'rapids, submerged wreckage, boulders, glints, and route lamps create a readable riverfront' }),
  prefabStamp('compact-northeast-neighborhood', 'compact-northeast', [
    { assetKey: JUL9_B_ASSETS.neighborhood[0], use: 'boundary', dx: -5, dy: 1, solid: true },
    { assetKey: JUL9_B_ASSETS.neighborhood[1], use: 'boundary', dx: -1, dy: 1, solid: true },
    { assetKey: JUL9_B_ASSETS.neighborhood[2], use: 'dressing', dx: 3, dy: 1, solid: false },
    { assetKey: JUL9_B_ASSETS.neighborhood[3], use: 'boundary', dx: 7, dy: 1, solid: true },
    ...stampObjectsForKeys(JUL9_B_ASSETS.signals.slice(10, 13), 'dressing', { startX: -4, startY: -3, spacingX: 4 }),
    { assetKey: 'curated/jul9-residential-house-facades-large-00-boarded-ranch-house', use: 'landmark', dx: -7, dy: -7, solid: true },
    { assetKey: 'curated/jul9-garages-sheds-large-00-detached-garage', use: 'landmark', dx: 5, dy: -7, solid: true },
  ], { label: 'Northeast neighborhood block', routeBeat: 'town', anchor: { x: 104, y: -66 }, routeRead: 'house, garage, yard props, fence, mailbox, and signals build a full neighborhood scene' }),
  prefabStamp('compact-west-route-town', 'compact-west', [
    ...stampObjectsForKeys(JUL9_B_ASSETS.signals.slice(13, 16), 'dressing', { startX: -4, startY: 1, spacingX: 4 }),
    { assetKey: 'curated/jul9-roadside-buildings-large-02-roadside-convenience-store', use: 'landmark', dx: -7, dy: -6, solid: true },
    { assetKey: 'wo102-megaprop/noodle-bar-storefront', use: 'landmark', dx: 4, dy: -6, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-00-wood-fence-straight', use: 'boundary', dx: -5, dy: 5, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-01-short-wood-fence', use: 'boundary', dx: 5, dy: 5, solid: true },
  ], { label: 'West route town', routeBeat: 'town', anchor: { x: -106, y: 2 }, routeRead: 'storefronts and signal furniture establish a western town instead of empty outfield' }),
  prefabStamp('compact-east-extraction-yard', 'compact-east', [
    ...JUL9_B_ASSETS.extraction.map((assetKey, index) => {
      const positions = [[-8, -6], [7, -6], [-8, 3], [4, 2]];
      return { assetKey, use: index === 3 ? 'dressing' : 'landmark', dx: positions[index][0], dy: positions[index][1], solid: index !== 3 };
    }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.signals.slice(16, 20), 'dressing', { startX: -5, startY: 5 }),
    { assetKey: 'curated/jul9-industrial-buildings-large-03-crypto-mining-service-shed', use: 'landmark', dx: -7, dy: -9, solid: true },
    { assetKey: 'wo105-world/container-cover-line', use: 'boundary', dx: 6, dy: 7, solid: true, metadata: { footprintTiles: { w: 4.2, h: 1.4 } } },
    { assetKey: 'curated/jul9-fences-barricades-22-rubble-barricade', use: 'boundary', dx: -3, dy: 8, solid: true, metadata: { footprintTiles: { w: 2.8, h: 1.1 } } },
  ], { label: 'East extraction yard', routeBeat: 'boss', anchor: { x: 104, y: 4 }, routeRead: 'boss gates, extraction pad, pylons, and industrial shed form a complete east-side objective' }),
  prefabStamp('compact-southwest-rock-camp', 'compact-southwest', [
    ...stampObjectsForKeys(JUL9_B_ASSETS.rocks.slice(3), 'boundary', { startX: -7, startY: -7, spacingX: 7, solid: true }),
    ...stampObjectsForKeys(JUL9_B_ASSETS.signals.slice(20, 22), 'dressing', { startX: -3, startY: 3, spacingX: 6 }),
    { assetKey: 'curated/jul9-landmark-microscene-01-ruined-camp', use: 'landmark', dx: 0, dy: 0, solid: false },
    { assetKey: 'curated/jul9-fences-barricades-22-rubble-barricade', use: 'boundary', dx: 0, dy: 6, solid: true },
  ], { label: 'Southwest rock camp', routeBeat: 'exploration', anchor: { x: -96, y: 78 }, routeRead: 'large rock silhouettes, camp, and floor markers fill the southwest corner' }),
  prefabStamp('compact-south-forest-waterfront', 'compact-south', [
    { assetKey: JUL9_B_ASSETS.signals[22], use: 'dressing', dx: 0, dy: 4, solid: false },
    { assetKey: JUL9_B_ASSETS.forest[0], use: 'boundary', dx: -7, dy: -3, solid: true },
    { assetKey: JUL9_B_ASSETS.forest[1], use: 'boundary', dx: 7, dy: -3, solid: true },
    { assetKey: JUL9_B_ASSETS.river[0], use: 'boundary', dx: -4, dy: 5, solid: true },
    { assetKey: JUL9_B_ASSETS.river[4], use: 'boundary', dx: 4, dy: 5, solid: true },
    { assetKey: 'curated-tree/jul9-riparian-cottonwood-idle-00', use: 'canopy', dx: 0, dy: -7, solid: true },
  ], { label: 'South forest waterfront', routeBeat: 'waterfront', anchor: { x: -20, y: 82 }, routeRead: 'logs, boulders, cottonwood, and marker light shape the southern river loop' }),
  prefabStamp('compact-southeast-glow-bank', 'compact-southeast', [
    ...stampObjectsForKeys(JUL9_B_ASSETS.ambient.slice(12), 'ambient', { startX: -5, startY: 1 }),
    { assetKey: JUL9_B_ASSETS.signals[23], use: 'dressing', dx: 0, dy: 5, solid: false },
    { assetKey: JUL9_B_ASSETS.river[6], use: 'water', dx: -5, dy: -3, solid: false },
    { assetKey: JUL9_B_ASSETS.river[7], use: 'water', dx: 5, dy: -3, solid: false },
  ], { label: 'Southeast glow bank', routeBeat: 'poi', anchor: { x: 96, y: 78 }, routeRead: 'water sparks, rapid strips, and the broken marker frame the lighthouse approach without duplicating its landmark' }),
  prefabStamp('desert-road-salvage-wall', 'desert-approach', [
    { assetKey: 'curated/jul9-fences-barricades-10-concrete-barrier', use: 'boundary', dx: -5, dy: -3, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-12-sandbag-barrier', use: 'boundary', dx: 3, dy: -3, solid: true },
    { assetKey: 'level-1/prop/dragon-bones-body-ground-shadow', use: 'landmark', dx: -3, dy: 3, solid: false },
    { assetKey: 'level-1/prop/oval-rock4-ground-shadow', use: 'boundary', dx: 5, dy: 2, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-14-roadblock-cluster', use: 'dressing', dx: 0, dy: -1, solid: false },
  ], { label: 'Broken road salvage wall', routeBeat: 'spawn', anchor: { x: 18, y: 5 }, routeRead: 'salvage edge' }),
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
  ], { label: 'WO-102 forest cliff proof', routeBeat: 'loop', anchor: { x: -50, y: -82 }, routeRead: 'one composed cliff wall reads as authored forest boundary' }),
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
    { assetKey: 'curated/jul9-landmark-microscene-12-drainage-culvert', use: 'landmark', dx: 4, dy: -2, solid: true },
    { assetKey: 'level-1/prop/oval-rock5-ground-shadow', use: 'boundary', dx: -5, dy: 3, solid: true },
    { assetKey: 'curated/jul9-landmark-microscene-13-ditch-bridge-crossing', use: 'dressing', dx: 2, dy: 3, solid: false },
    { assetKey: 'level1-authored-stamp/river-bridge-arrow-sign', use: 'dressing', dx: 1, dy: -2, solid: false, notes: 'bridge cue' },
  ], { label: 'Shoreline ford bank', routeBeat: 'chokepoint', anchor: { x: 64, y: 7 }, routeRead: 'ford edge' }),
  prefabStamp('farmstead-fence-pocket', 'residential-edge', [
    { assetKey: 'wo102-megaprop/farm-barn-silo-cluster', use: 'landmark', dx: 0, dy: -2, solid: true, notes: 'WO-102 farm' },
    { assetKey: 'curated/jul9-fences-barricades-04-wood-gate', use: 'dressing', dx: 3, dy: -1, solid: false },
    { assetKey: 'level-1/flora/oak-tree', use: 'boundary', dx: 5, dy: 2, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-01-short-wood-fence', use: 'dressing', dx: -2, dy: 3, solid: false },
    { assetKey: 'curated/jul9-fences-barricades-03-wood-fence-corner', use: 'boundary', dx: -5, dy: 2, solid: true },
  ], { label: 'Farmstead fence pocket', routeBeat: 'pressure', anchor: { x: 78, y: 20 }, routeRead: 'farm edge' }),
  prefabStamp('wo104-forest-canopy-cliff-checkpoint', 'dead-forest-loop', [
    { assetKey: 'wo104-world/forest-canopy-sway', use: 'canopy', dx: -4, dy: -4, solid: true, notes: 'WO-104: swaying canopy occluder frames the dry forest loop without random scatter' },
    { assetKey: 'wo104-world/mossy-cliff-wall', use: 'boundary', dx: 5, dy: -5, solid: true, notes: 'WO-104: mossy cliff wall turns the forest/cave edge into an authored blocker while staying outside the immediate fight lane' },
    { assetKey: 'level-1/prop/orange-mushrooms1-ground-shadow', use: 'dressing', dx: -1, dy: 1, solid: false },
    { assetKey: 'level-1/flora/broken-tree2', use: 'boundary', dx: 5, dy: 2, solid: true },
  ], { label: 'WO-104 forest canopy/cliff checkpoint', routeBeat: 'forest', anchor: { x: -22, y: -84 }, routeRead: 'canopy, cliff, and mushroom accents make the northern forest read authored' }),
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
  ], { label: 'WO-105 bank plaza arena', routeBeat: 'arena', anchor: { x: -90, y: 4 }, routeRead: 'bank kiosk, new frontage, junction plate, road apron, and container cover define the western town arena' }),
  prefabStamp('wo105-second-town-road-checkpoint', 'residential-edge', [
    { assetKey: 'wo105-world/second-town-building-row', use: 'landmark', dx: -4, dy: -5, solid: true, notes: 'WO-105: second-town facade row replaces generic building cards at the extraction approach' },
    { assetKey: 'wo105-world/cracked-road-junction', use: 'route', dx: 0, dy: 1, solid: false, notes: 'WO-105: junction plate makes the road split into second-town and extraction-yard lanes' },
    { assetKey: 'wo105-world/cracked-road-barricade', use: 'route', dx: 5, dy: 2, solid: false, notes: 'WO-105: barricade narrows the lane into a deliberate arena threshold' },
    { assetKey: 'wo104-world/park-tree-bench-cluster', use: 'landmark', dx: 6, dy: -4, solid: true, notes: 'WO-105: park edge keeps the second-town road from reading as bare asphalt' },
  ], { label: 'WO-105 second-town road checkpoint', routeBeat: 'road', anchor: { x: 94, y: -58 }, routeRead: 'second-town facade, park edge, and cracked junction make the northeast road transition sensible' }),
  prefabStamp('wo105-container-extraction-yard-checkpoint', 'inner-city-threshold', [
    { assetKey: 'wo105-world/container-cover-line', use: 'container', dx: -6, dy: 4, solid: true, notes: 'WO-105: container wall stages the extraction-yard arena edge without blocking the center lane' },
    { assetKey: 'wo105-world/cracked-road-barricade', use: 'route', dx: 2, dy: 1, solid: false, notes: 'WO-105: road barricade points the lane toward the extraction pad' },
    { assetKey: 'wo105-world/extraction-yard-warehouse', use: 'landmark', dx: -6, dy: -4, solid: true, notes: 'WO-105: new warehouse art replaces old generic industrial-warehouse building art in the extraction arena' },
    { assetKey: 'level1-authored-stamp/boss-yard-warning-pylon', use: 'dressing', dx: 4, dy: -2, solid: false },
  ], { label: 'WO-105 container extraction yard', routeBeat: 'boss', anchor: { x: 104, y: 18 }, routeRead: 'new warehouse silhouette, containers, and cracked road describe the south extraction arena' }),
  prefabStamp('wo106-roadside-vehicle-micro-scenes', 'residential-edge', [
    { assetKey: 'wo106-world/abandoned-pickup', use: 'vehicle', dx: -4, dy: 1, solid: true, notes: 'WO-106: abandoned pickup is solid cover outside the center lane' },
    { assetKey: 'wo106-world/delivery-van-cache', use: 'vehicle', dx: 3, dy: 2, solid: true, notes: 'WO-106: delivery van is solid cover beside the loot route' },
    { assetKey: 'wo106-world/critter-dust-burrow', use: 'ambient', dx: 0, dy: -2, solid: false, notes: 'WO-106: burrow/dust puffs telegraph critter life before flee AI ships' },
    { assetKey: 'level-1/prop/bus-stop-sign', use: 'dressing', dx: -1, dy: 3, solid: false },
  ], { label: 'WO-106 roadside vehicle micro-scenes', routeBeat: 'micro-scene', anchor: { x: 74, y: 8 }, routeRead: 'vehicles, cache, and critter burrow make the route feel inhabited' }),
  prefabStamp('civic-park-town-pocket', 'ghost-town', [
    { assetKey: 'curated/jul9-civic-buildings-large-00-town-hall-front', use: 'landmark', dx: -7, dy: -6, solid: true, metadata: { footprintTiles: { w: 5.5, h: 3.2 } } },
    { assetKey: 'curated/jul9-main-street-storefronts-large-00-boarded-general-store', use: 'landmark', dx: 1, dy: -6, solid: true, metadata: { footprintTiles: { w: 5.4, h: 3.0 } } },
    { assetKey: 'curated/jul9-park-rest-area-00-park-bench', use: 'dressing', dx: -3, dy: 0, solid: false },
    { assetKey: 'curated/jul9-park-rest-area-02-picnic-table', use: 'dressing', dx: 4, dy: 0, solid: false },
    { assetKey: 'curated/jul9-small-cover-loot-07-glowing-pickup-pedestal', use: 'dressing', dx: 0, dy: 3, solid: false },
  ], { label: 'Civic park town pocket', routeBeat: 'arena', anchor: { x: 48, y: 8 }, routeRead: 'civic frontage, park furniture, and loot cue define the town plaza' }),
  prefabStamp('neighborhood-house-yard-pocket', 'residential-edge', [
    { assetKey: 'curated/jul9-residential-house-facades-large-00-boarded-ranch-house', use: 'landmark', dx: -7, dy: -5, solid: true, metadata: { footprintTiles: { w: 5.8, h: 3.2 } } },
    { assetKey: 'curated/jul9-garages-sheds-large-00-detached-garage', use: 'landmark', dx: 4, dy: -6, solid: true, metadata: { footprintTiles: { w: 5.0, h: 2.8 } } },
    { assetKey: 'curated/jul9-neighborhood-fences-hedges-15-hedge-segment', use: 'boundary', dx: -8, dy: 2, solid: true },
    { assetKey: 'curated/jul9-neighborhood-yard-clutter-20-mailbox-weeds', use: 'dressing', dx: -2, dy: 3, solid: false },
    { assetKey: 'curated/jul9-neighborhood-combo-21-yard-chair-cluster', use: 'dressing', dx: 5, dy: 2, solid: false },
  ], { label: 'Neighborhood house yard pocket', routeBeat: 'road', anchor: { x: 88, y: -66 }, routeRead: 'house, garage, hedge, and yard clutter make the northeast residential edge readable' }),
  prefabStamp('residential-block-backlot-pocket', 'residential-edge', [
    { assetKey: 'curated/jul9-residential-block-buildings-large-01-worn-duplex-building', use: 'landmark', dx: -6, dy: -5, solid: true, metadata: { footprintTiles: { w: 5.8, h: 3.2 } } },
    { assetKey: 'curated/jul9-garages-sheds-large-02-torn-carport-frame', use: 'landmark', dx: 3, dy: -4, solid: true, metadata: { footprintTiles: { w: 4.8, h: 2.8 } } },
    { assetKey: 'curated/jul9-neighborhood-fences-hedges-06-broken-privacy-fence', use: 'boundary', dx: -4, dy: 2, solid: true },
    { assetKey: 'curated/jul9-neighborhood-yard-clutter-12-garden-hose-coil', use: 'dressing', dx: 1, dy: 3, solid: false },
    { assetKey: 'curated/jul9-vegetation-crop-edge-20-weeds-around-stump', use: 'dressing', dx: 5, dy: 3, solid: false },
  ], { label: 'Residential block backlot pocket', routeBeat: 'pressure', anchor: { x: 106, y: -54 }, routeRead: 'duplex, carport, privacy fence, and weeds build the second-neighborhood read' }),
  prefabStamp('canal-park-ford-pocket', 'country-road', [
    { assetKey: 'curated/jul9-creek-canal-culvert-00-concrete-culvert-mouth', use: 'landmark', dx: -5, dy: -2, solid: true },
    { assetKey: 'curated/jul9-creek-canal-culvert-04-small-footbridge', use: 'dressing', dx: 0, dy: 1, solid: false },
    { assetKey: 'curated/jul9-cliff-ditch-boundary-09-timber-bank-wall', use: 'boundary', dx: 7, dy: -4, solid: true },
    { assetKey: 'curated/jul9-vegetation-crop-edge-21-reeds-around-puddle', use: 'dressing', dx: -2, dy: 3, solid: false },
    { assetKey: 'curated/jul9-park-rest-area-20-bench-trash-cluster', use: 'dressing', dx: 5, dy: 3, solid: false },
  ], { label: 'Canal park ford pocket', routeBeat: 'chokepoint', anchor: { x: 66, y: 7 }, routeRead: 'culvert, footbridge, bank wall, reeds, and bench clarify the water crossing' }),
  prefabStamp('ghost-town-facade-row-pocket', 'ghost-town', [
    { assetKey: 'curated/jul9-ghost-town-facade-modules-00-boarded-storefront-front', use: 'landmark', dx: -5, dy: -4, solid: true },
    { assetKey: 'curated/jul9-ghost-town-facade-modules-06-roofline-awning-module', use: 'landmark', dx: 2, dy: -4, solid: true },
    { assetKey: 'curated/jul9-roadside-buildings-large-01-gas-station-service-canopy', use: 'landmark', dx: 8, dy: -3, solid: true, metadata: { footprintTiles: { w: 5.8, h: 3.0 } } },
    { assetKey: 'curated/jul9-neighborhood-fences-hedges-10-chainlink-residential-fence', use: 'boundary', dx: -3, dy: 2, solid: true },
    { assetKey: 'curated/jul9-small-cover-loot-20-crate-barrel-cover', use: 'dressing', dx: 4, dy: 3, solid: false },
  ], { label: 'Ghost town facade row pocket', routeBeat: 'arena', anchor: { x: 42, y: 6 }, routeRead: 'facade row, gas canopy, fence, and cover shape the town fight' }),
  prefabStamp('industrial-power-yard-extraction-pocket', 'finale-extraction', [
    { assetKey: 'curated/jul9-power-yard-extraction-00-lit-extraction-beacon', use: 'landmark', dx: 1, dy: -2, solid: false },
    { assetKey: 'curated/jul9-power-yard-extraction-05-battery-cabinet', use: 'dressing', dx: 5, dy: -1, solid: false },
    { assetKey: 'curated/jul9-power-yard-extraction-13-power-yard-barricade', use: 'boundary', dx: -4, dy: 3, solid: true },
    { assetKey: 'curated/jul9-small-cover-loot-13-small-fire-barrel', use: 'dressing', dx: 4, dy: 3, solid: false },
  ], { label: 'Industrial power-yard extraction pocket', routeBeat: 'extract', anchor: { x: 100, y: 6 }, routeRead: 'mining shed, beacon, battery, barricade, and hazard props sell extraction' }),
  prefabStamp('innercity-gate-barricade', 'inner-city-threshold', [
    { assetKey: 'curated/jul9-industrial-mining-00-mining-rig-rack', use: 'landmark', dx: -5, dy: -4, solid: true },
    { assetKey: 'curated/jul9-industrial-mining-14-satellite-dish', use: 'landmark', dx: 4, dy: -4, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-18-retaining-wall', use: 'boundary', dx: -4, dy: 3, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-21-barrel-barricade-cluster', use: 'boundary', dx: 4, dy: 3, solid: true },
    { assetKey: 'curated/jul9-industrial-mining-06-transformer-box', use: 'dressing', dx: 0, dy: 1, solid: false },
    { assetKey: 'level1-authored-stamp/boss-yard-warning-pylon', use: 'dressing', dx: 1, dy: -2, solid: false, notes: 'boss cue' },
  ], { label: 'Inner-city gate barricade', routeBeat: 'boss', anchor: { x: 94, y: 6 }, routeRead: 'boss gate' }),
  prefabStamp('ruined-camp-bone-yard', 'desert-bone-camp', [
    { assetKey: 'curated/jul9-landmark-microscene-01-ruined-camp', use: 'landmark', dx: -2, dy: -2, solid: false },
    { assetKey: 'curated/jul9-landmark-microscene-02-roadside-checkpoint', use: 'boundary', dx: 5, dy: -2, solid: true },
    { assetKey: 'curated/jul9-fences-barricades-22-rubble-barricade', use: 'boundary', dx: -5, dy: 3, solid: true },
    { assetKey: 'level-1/prop/desert-14', use: 'dressing', dx: 2, dy: 3, solid: false },
    { assetKey: 'level-1/prop/rocky-05', use: 'boundary', dx: 0, dy: 5, solid: true },
  ], { label: 'Ruined camp bone yard', routeBeat: 'pressure', anchor: { x: 28, y: -8 }, routeRead: 'ruined camp' }),
  prefabStamp('roadside-fuel-stop-cache', 'desert-approach', [
    { assetKey: 'curated/jul9-buildings-landmarks-01-gas-station-kiosk', use: 'landmark', dx: 6, dy: 6, solid: true, metadata: { footprintTiles: { w: 3.2, h: 2.0 } } },
    { assetKey: 'curated/jul9-vehicles-street-junk-12-gas-pump-pair', use: 'dressing', dx: 2, dy: 5, solid: true, metadata: { footprintTiles: { w: 1.8, h: 1.0 } } },
    { assetKey: 'curated/jul9-landmark-microscene-09-broken-arcade-cabinet', use: 'dressing', dx: 7, dy: 2, solid: false },
    { assetKey: 'curated/jul9-vehicles-street-junk-10-metal-barricade', use: 'boundary', dx: -5, dy: -4, solid: true },
    { assetKey: 'curated/jul9-small-cover-loot-07-glowing-pickup-pedestal', use: 'dressing', dx: 4, dy: 2, solid: false },
  ], { label: 'Roadside fuel-stop cache', routeBeat: 'spawn', anchor: { x: 10, y: 8 }, routeRead: 'kiosk, pumps, barricade, and a damaged Lester cabinet create one coherent first-detour reward pocket' }),
  prefabStamp('litecoin-extraction-beacon-pad', 'finale-extraction', [
    { assetKey: 'level1-authored-stamp/extraction-pad-litcoin-beacon', use: 'landmark', dx: 1, dy: -2, solid: false, notes: 'new generated beacon makes the extraction pad read as the final route target' },
    { assetKey: 'level-1/building/town-10', use: 'landmark', dx: 5, dy: -4, solid: true },
    { assetKey: 'level-1/prop/park-bench', use: 'dressing', dx: -5, dy: 2, solid: false },
    { assetKey: 'level-1/flora/oak-tree', use: 'boundary', dx: 5, dy: 3, solid: true },
  ], { label: 'Litecoin extraction beacon pad', routeBeat: 'extract', anchor: { x: 116, y: 6 }, routeRead: 'blue-gold beacon and flare road mark the final extraction read' }),
]);

const RETIRED_OVERLAPPING_PREFAB_STAMP_IDS = new Set([
  'ghost-town-frontage-pocket',
  'forest-mushroom-ring',
  'roadside-arcade-cache',
]);

export const LEVEL_ONE_ACTIVE_PREFAB_STAMPS = Object.freeze(
  LEVEL_ONE_AUTHORED_PREFAB_STAMPS.filter((stamp) => !RETIRED_OVERLAPPING_PREFAB_STAMP_IDS.has(stamp.id)),
);

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
    ?? curatedLevelArtPropByKey(assetKey)?.src
    ?? curatedTreeAnimationAssetByKey(assetKey)?.src
    ?? levelOneAuthoredStampAssetSrc(assetKey)
    ?? wo102MegaPropAssetByKey(assetKey)?.src
    ?? wo104106WorldKitAssetSrc(assetKey)
    ?? levelOneWorldV3LandmarkAssetByKey(assetKey)?.src
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
  // Terrain and routes belong to the ground renderer, not the prop renderer.
  // Old road/path/water sheets and newer route plates must not sit on top of the
  // Jul 9 terrain textures as pasted scene objects. Water visibility and
  // collision are both owned by hmh-ground-plan.
  if (use === 'terrain' || use === 'route' || use === 'water') return null;
  const record = curatedLevelKitAssetByKey(assetKey)
    ?? curatedLevelArtPropByKey(assetKey)
    ?? curatedTreeAnimationAssetByKey(assetKey)
    ?? authoredStampAssetByKey(assetKey)
    ?? wo102MegaPropAssetByKey(assetKey)
    ?? wo104106WorldKitAssetByKey(assetKey);
  if (!record) return null;
  const sceneRole = ROLE_FOR_USE[use] ?? 'smallprop';
  const isSubstantialDressing = use === 'dressing' && SUBSTANTIAL_DRESSING_PATTERN.test(String(assetKey || '').toLowerCase());
  const isSolid = solid ?? Boolean(SOLID_FOR_USE[use] || isSubstantialDressing);
  const authoredFootprint = metadata.footprintTiles ?? record.footprintTiles ?? null;
  const collisionFootprint = authoredFootprint ?? (isSolid ? inferredSolidFootprint(assetKey, use) : null);
  return {
    id,
    assetKey,
    sceneRole,
    use,
    gridX: x,
    gridY: y,
    solid: isSolid,
    zHeight: use === 'landmark' ? 4 : use === 'boundary' ? 2 : 0,
    drawOrderBias: use === 'landmark' ? 16 : use === 'boundary' ? 8 : 0,
    text: notes,
    sourceZoneId: zoneId,
    propIndex: index,
    footprintTiles: collisionFootprint,
    ...(isSubstantialDressing ? { drawFootprintTiles: authoredFootprint } : {}),
    collisionPolygons: record.collisionPolygons ?? metadata.collisionPolygons ?? null,
    overSlice: record.overSlice ?? metadata.overSlice ?? null,
    r1Observation: record.r1Observation ?? metadata.r1Observation ?? null,
    ...metadata,
  };
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
  for (const stamp of LEVEL_ONE_ACTIVE_PREFAB_STAMPS) {
    const anchorX = stamp.anchor.x;
    const anchorY = stamp.anchor.y;
    if (Math.abs(anchorX - playerX) > window + pad || Math.abs(anchorY - playerY) > window + pad) continue;
    stamp.objects.forEach((spec, index) => {
      const x = anchorX + spec.dx;
      const y = anchorY + spec.dy;
      // Stamps are authored with permanent clear lanes. Never remove a solid
      // object based on the moving player position or its art/collision will pop.
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
  const objects = [...openingObjects(), ...worldDressingObjects({ playerX, playerY, window, frame })];
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
