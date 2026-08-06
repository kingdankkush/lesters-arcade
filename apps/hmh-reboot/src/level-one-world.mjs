import { auditCollisionWorld, createStaticBlocker } from './collision.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from './elevation.mjs';

export const LEVEL_ONE_PLAYER_RADIUS = 24;
export const LEVEL_ONE_PROTECTED_SPAWN_RADIUS = 560;
const REVEAL_CELL_SIZE = 240;

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function point(x, y) {
  return Object.freeze({ x, y });
}

function rect(minX, minY, maxX, maxY) {
  return Object.freeze({ type: 'rect', minX, minY, maxX, maxY });
}

const BOUNDS = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: 12_000,
  maxY: 4_800,
  visibleBoundaryId: 'forked-frontier-perimeter',
});

const DISTRICTS = [
  ['frontier-relay', 'Frontier Relay', 0, 1_800, 0x2f735d, 'relay-tower'],
  ['rugpull-ravine', 'Rugpull Ravine', 1_800, 3_800, 0x8b593f, 'forked-spire'],
  ['liquidity-crossing', 'Liquidity Crossing', 3_800, 6_000, 0x2a7894, 'proof-of-work-bridge'],
  ['hashwood', 'Hashwood', 6_000, 8_000, 0x3f7f4a, 'hashwood-beacon'],
  ['mining-camp', 'Mining Camp', 8_000, 10_000, 0x6c6a62, 'mining-headframe'],
  ['liquidation-yard', 'Liquidation Yard', 10_000, 12_000, 0x763d58, 'liquidator-arena'],
].map(([id, name, minX, maxX, color, landmarkId]) => freezeDeep({
  id,
  name,
  area: rect(minX, 0, maxX, 4_800),
  color,
  landmarkId,
}));

const ROUTE_NODES = [
  ['relay-spawn', 800, 2_400],
  ['relay-bend', 1_250, 2_750],
  ['relay-gate', 1_700, 2_450],
  ['ravine-entry', 1_950, 2_300],
  ['ravine-ramp-entry', 2_500, 1_500],
  ['ravine-high-road', 3_050, 1_450],
  ['ravine-descent', 3_550, 2_150],
  ['ravine-exit', 3_750, 2_500],
  ['crossing-bend', 4_050, 2_470],
  ['bridge-west', 4_400, 2_400],
  ['bridge-east', 5_100, 2_400],
  ['crossing-exit', 5_800, 2_550],
  ['hashwood-gate', 6_150, 2_750],
  ['hashwood-bend', 6_550, 2_350],
  ['hashwood-clearing', 7_000, 2_000],
  ['hashwood-south-turn', 7_500, 2_650],
  ['hashwood-exit', 7_900, 2_500],
  ['mining-gate', 8_250, 2_350],
  ['mining-ramp-entry', 8_700, 1_600],
  ['mining-yard', 9_200, 1_600],
  ['mining-descent', 9_550, 2_100],
  ['mining-exit', 9_900, 2_550],
  ['yard-gate', 10_250, 2_450],
  ['yard-chicane', 10_600, 2_150],
  ['liquidator-arena-node', 11_000, 2_400],
  ['relay-loop-north', 1_250, 1_600],
  ['relay-loop-south', 1_250, 3_200],
  ['ravine-loop-north', 2_350, 1_100],
  ['ravine-loop-south', 3_250, 3_000],
  ['crossing-shallows-west', 4_350, 950],
  ['crossing-shallows-east', 5_150, 950],
  ['hashwood-loop-north', 6_650, 1_050],
  ['hashwood-loop-south', 7_450, 3_200],
  ['mining-loop-north', 8_650, 1_050],
  ['mining-loop-south', 9_450, 3_200],
  ['yard-loop-north', 10_650, 1_250],
  ['yard-loop-south', 11_350, 3_400],
].map(([id, x, y]) => Object.freeze({ id, x, y }));
const NODE_BY_ID = new Map(ROUTE_NODES.map((node) => [node.id, node]));

const ROUTES = [
  { id: 'main-route', kind: 'main', width: 192, nodeIds: ['relay-spawn', 'relay-bend', 'relay-gate', 'ravine-entry', 'ravine-ramp-entry', 'ravine-high-road', 'ravine-descent', 'ravine-exit', 'crossing-bend', 'bridge-west', 'bridge-east', 'crossing-exit', 'hashwood-gate', 'hashwood-bend', 'hashwood-clearing', 'hashwood-south-turn', 'hashwood-exit', 'mining-gate', 'mining-ramp-entry', 'mining-yard', 'mining-descent', 'mining-exit', 'yard-gate', 'yard-chicane', 'liquidator-arena-node'] },
  { id: 'relay-orientation-loop', kind: 'loop', width: 160, nodeIds: ['relay-gate', 'relay-loop-north', 'relay-loop-south', 'relay-gate'] },
  { id: 'ravine-salvage-loop', kind: 'loop', width: 160, nodeIds: ['ravine-entry', 'ravine-loop-north', 'ravine-loop-south', 'ravine-entry'] },
  // Out-and-back via the shallows: the old triangle's return leg crossed the
  // deep river and the north bridge rail.
  { id: 'crossing-bank-loop', kind: 'loop', width: 144, nodeIds: ['bridge-west', 'crossing-shallows-west', 'crossing-shallows-east', 'crossing-shallows-west', 'bridge-west'] },
  { id: 'hashwood-clearing-loop', kind: 'loop', width: 160, nodeIds: ['hashwood-clearing', 'hashwood-loop-north', 'hashwood-loop-south', 'hashwood-clearing'] },
  { id: 'mining-service-loop', kind: 'loop', width: 160, nodeIds: ['mining-gate', 'mining-loop-north', 'mining-loop-south', 'mining-gate'] },
  { id: 'liquidation-escape-loop', kind: 'loop', width: 176, nodeIds: ['yard-gate', 'yard-loop-north', 'yard-loop-south', 'yard-gate'] },
].map((route) => freezeDeep(route));

const ROUTE_EDGES = [];
for (const route of ROUTES) {
  for (let index = 1; index < route.nodeIds.length; index += 1) {
    ROUTE_EDGES.push(Object.freeze({
      id: `${route.id}:${index - 1}`,
      routeId: route.id,
      from: route.nodeIds[index - 1],
      to: route.nodeIds[index],
      width: route.width,
    }));
  }
}

const SURFACE_SPECS = [
  { id: 'liquidity-river', kind: 'water', area: rect(4_500, 0, 5_000, 4_800), groundZ: -24, waterLevel: 4, deepWater: true, visibleTerrainId: 'water-liquidity-river', priority: 1 },
  { id: 'crossing-shallows', kind: 'shallow-water', area: rect(4_500, 800, 5_000, 1_150), groundZ: 0, waterLevel: 4, deepWater: false, visibleTerrainId: 'water-crossing-shallows', priority: 2 },
  { id: 'bridge-west-ramp', kind: 'ramp', area: rect(4_400, 2_290, 4_500, 2_510), fromZ: 0, toZ: 16, axis: 'x', visibleTerrainId: 'bridge-west-ramp', priority: 5 },
  { id: 'proof-of-work-bridge', kind: 'bridge', area: rect(4_500, 2_290, 5_000, 2_510), groundZ: 16, visibleTerrainId: 'proof-of-work-bridge-deck', visibleStepId: 'proof-of-work-bridge-seam', priority: 4 },
  { id: 'bridge-east-ramp', kind: 'ramp', area: rect(5_000, 2_290, 5_100, 2_510), fromZ: 16, toZ: 0, axis: 'x', visibleTerrainId: 'bridge-east-ramp', priority: 5 },
  { id: 'ravine-switchback-ramp', kind: 'ramp', area: rect(2_500, 1_380, 2_850, 1_620), fromZ: 0, toZ: 64, axis: 'x', visibleTerrainId: 'ravine-switchback-ramp', priority: 5 },
  { id: 'ravine-overlook', kind: 'ledge', area: rect(2_850, 1_180, 3_450, 1_650), groundZ: 64, oneWayDrop: { x: 0, y: 1 }, visibleTerrainId: 'ravine-overlook', visibleStepId: 'ravine-overlook-ramp-seam', priority: 4 },
  { id: 'mining-service-ramp', kind: 'ramp', area: rect(8_700, 1_480, 9_000, 1_720), fromZ: 0, toZ: 48, axis: 'x', visibleTerrainId: 'mining-service-ramp', priority: 5 },
  { id: 'mining-loader-deck', kind: 'ledge', area: rect(9_000, 1_380, 9_550, 1_820), groundZ: 48, oneWayDrop: { x: 0, y: 1 }, visibleTerrainId: 'mining-loader-deck', visibleStepId: 'mining-loader-ramp-seam', priority: 4 },
];
const BASE_SURFACE = createElevationSurface({ id: 'forked-frontier-ground', kind: 'ground', area: rect(0, 0, 12_000, 4_800), groundZ: 0, visibleTerrainId: 'forked-frontier-ground', priority: 0 });
const SURFACES = SURFACE_SPECS.map((spec) => createElevationSurface(spec));

const block = (id, districtId, x, y, width, depth, maxZ, visualKind = 'building') => ({
  id, districtId, anchor: point(x, y), visualKind,
  shape: depth === 0
    ? { type: 'circle', x, y, radius: width }
    : depth < 0
      ? { type: 'capsule', a: point(x - width / 2, y), b: point(x + width / 2, y), radius: -depth }
      : { type: 'polygon', vertices: [point(x - width / 2, y - depth / 2), point(x + width / 2, y - depth / 2), point(x + width / 2, y + depth / 2), point(x - width / 2, y + depth / 2)] },
  maxZ, combatCover: true,
});
const BLOCKER_FEATURES = [
  // Frontier Relay: a fenced compound with a depot shed, an interior fence
  // run, and a true gate at the ravine seam.
  { id: 'relay-orientation-fence', districtId: 'frontier-relay', anchor: point(1_450, 900), visualKind: 'fence', shape: { type: 'capsule', a: point(800, 900), b: point(1_650, 900), radius: 18 }, maxZ: 72 },
  block('relay-depot-shed', 'frontier-relay', 1_550, 3_425, 300, 250, 200),
  { id: 'relay-north-fence-run', districtId: 'frontier-relay', anchor: point(850, 1_400), visualKind: 'fence', shape: { type: 'capsule', a: point(450, 1_450), b: point(1_250, 1_350), radius: 18 }, maxZ: 72 },
  { id: 'relay-gate-north', districtId: 'frontier-relay', anchor: point(1_700, 1_940), visualKind: 'fence', shape: { type: 'capsule', a: point(1_700, 1_750), b: point(1_700, 2_130), radius: 18 }, maxZ: 72 },
  { id: 'relay-gate-south', districtId: 'frontier-relay', anchor: point(1_700, 2_950), visualKind: 'fence', shape: { type: 'capsule', a: point(1_700, 2_760), b: point(1_700, 3_140), radius: 18 }, maxZ: 72 },
  // Rugpull Ravine: canyon walls with interior rock spurs that force the
  // route to wind, and a mid-canyon boulder choke inside the ambush bowl.
  { id: 'ravine-north-cliff', districtId: 'rugpull-ravine', anchor: point(2_800, 650), visualKind: 'cliff', shape: { type: 'capsule', a: point(1_850, 650), b: point(3_750, 650), radius: 48 }, maxZ: 140 },
  { id: 'ravine-south-cliff', districtId: 'rugpull-ravine', anchor: point(2_800, 3_650), visualKind: 'cliff', shape: { type: 'capsule', a: point(1_850, 3_650), b: point(3_750, 3_650), radius: 48 }, maxZ: 140 },
  { id: 'ravine-spur-west', districtId: 'rugpull-ravine', anchor: point(2_150, 3_050), visualKind: 'cliff', shape: { type: 'capsule', a: point(2_150, 3_450), b: point(2_150, 2_650), radius: 48 }, maxZ: 140 },
  { id: 'ravine-spur-east', districtId: 'rugpull-ravine', anchor: point(3_620, 1_440), visualKind: 'cliff', shape: { type: 'capsule', a: point(3_620, 1_050), b: point(3_620, 1_830), radius: 48 }, maxZ: 140 },
  { id: 'ravine-boulder-choke', districtId: 'rugpull-ravine', anchor: point(2_460, 2_360), visualKind: 'cliff', shape: { type: 'capsule', a: point(2_340, 2_330), b: point(2_580, 2_390), radius: 44 }, maxZ: 120, combatCover: true },
  { id: 'ravine-exit-palisade', districtId: 'rugpull-ravine', anchor: point(3_825, 2_975), visualKind: 'fence', shape: { type: 'capsule', a: point(3_700, 2_900), b: point(3_950, 3_050), radius: 20 }, maxZ: 80 },
  // Liquidity Crossing: wetland banks — a west groyne funnels toward the
  // bridge, wreck rows and fuel tanks dress the east bank, and a bank fence
  // plus thicket gate the hashwood seam.
  { id: 'bridge-north-rail', districtId: 'liquidity-crossing', anchor: point(4_750, 2_260), visualKind: 'bridge-rail', shape: { type: 'capsule', a: point(4_510, 2_260), b: point(4_990, 2_260), radius: 14 }, minZ: 0, maxZ: 72 },
  { id: 'bridge-south-rail', districtId: 'liquidity-crossing', anchor: point(4_750, 2_540), visualKind: 'bridge-rail', shape: { type: 'capsule', a: point(4_510, 2_540), b: point(4_990, 2_540), radius: 14 }, minZ: 0, maxZ: 72 },
  { id: 'crossing-west-groyne', districtId: 'liquidity-crossing', anchor: point(4_105, 1_990), visualKind: 'fence', shape: { type: 'capsule', a: point(3_980, 1_900), b: point(4_230, 2_080), radius: 18 }, maxZ: 72 },
  { id: 'crossing-east-wreckrow', districtId: 'liquidity-crossing', anchor: point(5_550, 2_975), visualKind: 'containers', shape: { type: 'capsule', a: point(5_350, 2_900), b: point(5_750, 3_050), radius: 60 }, maxZ: 150, combatCover: true },
  { id: 'crossing-fuel-tanks', districtId: 'liquidity-crossing', anchor: point(5_440, 3_375), visualKind: 'machinery', shape: { type: 'capsule', a: point(5_300, 3_350), b: point(5_580, 3_400), radius: 48 }, maxZ: 150, combatCover: true },
  { id: 'crossing-east-bank-fence', districtId: 'liquidity-crossing', anchor: point(5_975, 2_175), visualKind: 'fence', shape: { type: 'capsule', a: point(5_850, 2_100), b: point(6_100, 2_250), radius: 18 }, maxZ: 72 },
  { id: 'hashwood-gate-thicket', districtId: 'hashwood', anchor: point(6_100, 3_225), visualKind: 'dense-trees', shape: { type: 'capsule', a: point(5_950, 3_150), b: point(6_250, 3_300), radius: 64 }, maxZ: 180 },
  // Hashwood: interior thickets shape a winding forest path into a walled
  // clearing, and fences gate the mining seam.
  { id: 'hashwood-north-tree-line', districtId: 'hashwood', anchor: point(7_000, 620), visualKind: 'dense-trees', shape: { type: 'capsule', a: point(6_050, 620), b: point(7_950, 620), radius: 64 }, maxZ: 180 },
  { id: 'hashwood-south-tree-line', districtId: 'hashwood', anchor: point(7_000, 4_100), visualKind: 'dense-trees', shape: { type: 'capsule', a: point(6_050, 4_100), b: point(7_950, 4_100), radius: 64 }, maxZ: 180 },
  { id: 'hashwood-thicket-nw', districtId: 'hashwood', anchor: point(6_375, 1_440), visualKind: 'dense-trees', shape: { type: 'capsule', a: point(6_200, 1_500), b: point(6_550, 1_380), radius: 64 }, maxZ: 180 },
  { id: 'hashwood-thicket-south', districtId: 'hashwood', anchor: point(6_925, 3_125), visualKind: 'dense-trees', shape: { type: 'capsule', a: point(6_700, 3_050), b: point(7_150, 3_200), radius: 64 }, maxZ: 180 },
  { id: 'hashwood-clearing-edge-west', districtId: 'hashwood', anchor: point(6_755, 2_655), visualKind: 'dense-trees', shape: { type: 'capsule', a: point(6_680, 2_530), b: point(6_830, 2_780), radius: 56 }, maxZ: 180, combatCover: true },
  { id: 'hashwood-clearing-edge-east', districtId: 'hashwood', anchor: point(7_575, 2_275), visualKind: 'dense-trees', shape: { type: 'capsule', a: point(7_500, 2_150), b: point(7_650, 2_400), radius: 56 }, maxZ: 180, combatCover: true },
  { id: 'mining-gate-fence-north', districtId: 'mining-camp', anchor: point(8_075, 1_875), visualKind: 'fence', shape: { type: 'capsule', a: point(7_950, 1_800), b: point(8_200, 1_950), radius: 20 }, maxZ: 80 },
  { id: 'mining-gate-fence-south', districtId: 'mining-camp', anchor: point(8_025, 3_025), visualKind: 'fence', shape: { type: 'capsule', a: point(7_900, 2_950), b: point(8_150, 3_100), radius: 20 }, maxZ: 80 },
  // Mining Camp: a fenced work yard with a shack row south of the loader
  // deck, and container walls gating the liquidation seam.
  { id: 'mining-north-machinery', districtId: 'mining-camp', anchor: point(8_900, 700), visualKind: 'machinery', shape: { type: 'capsule', a: point(8_100, 700), b: point(9_700, 700), radius: 54 }, maxZ: 160, combatCover: true },
  { id: 'mining-south-fence', districtId: 'mining-camp', anchor: point(9_000, 3_850), visualKind: 'fence', shape: { type: 'capsule', a: point(8_050, 3_850), b: point(9_950, 3_850), radius: 20 }, maxZ: 80 },
  { id: 'mining-yard-fence-west', districtId: 'mining-camp', anchor: point(8_500, 3_000), visualKind: 'fence', shape: { type: 'capsule', a: point(8_500, 2_700), b: point(8_500, 3_300), radius: 20 }, maxZ: 80 },
  { id: 'mining-yard-fence-east', districtId: 'mining-camp', anchor: point(9_200, 3_385), visualKind: 'fence', shape: { type: 'capsule', a: point(9_200, 3_210), b: point(9_200, 3_560), radius: 20 }, maxZ: 80 },
  block('mining-shack-row', 'mining-camp', 8_800, 3_475, 300, 250, 220),
  { id: 'yard-gate-wall-north', districtId: 'mining-camp', anchor: point(10_050, 1_900), visualKind: 'containers', shape: { type: 'capsule', a: point(9_900, 1_850), b: point(10_200, 1_950), radius: 60 }, maxZ: 150, combatCover: true },
  { id: 'yard-gate-wall-south', districtId: 'mining-camp', anchor: point(10_000, 3_075), visualKind: 'containers', shape: { type: 'capsule', a: point(9_850, 3_000), b: point(10_150, 3_150), radius: 60 }, maxZ: 150, combatCover: true },
  // Liquidation Yard neighborhood: two north commercial masses, water tower,
  // south market island, east homes and a narrow gate frame streets around the
  // existing chicane/arena instead of filling its combat floor.
  block('town-north-shopfront', 'liquidation-yard', 10_450, 650, 380, 300, 220),
  block('town-north-tenement', 'liquidation-yard', 11_150, 650, 400, 420, 260),
  block('town-water-tower', 'liquidation-yard', 11_550, 1_100, 80, 0, 260, 'machinery'),
  block('town-fuel-island', 'liquidation-yard', 10_800, 3_600, 320, 280, 200, 'machinery'),
  { id: 'yard-wreck-row-north', districtId: 'liquidation-yard', anchor: point(10_650, 1_950), visualKind: 'containers', shape: { type: 'capsule', a: point(10_600, 1_945), b: point(10_700, 1_955), radius: 40 }, maxZ: 150, combatCover: true },
  { id: 'yard-wreck-row-south', districtId: 'liquidation-yard', anchor: point(10_530, 3_075), visualKind: 'containers', shape: { type: 'capsule', a: point(10_380, 3_050), b: point(10_680, 3_100), radius: 56 }, maxZ: 150, combatCover: true },
  block('town-market-gate', 'liquidation-yard', 10_150, 3_400, 300, -18, 90, 'fence'),
  block('town-east-lean-to', 'liquidation-yard', 11_650, 3_050, 300, 300, 180),
  block('town-east-tenement', 'liquidation-yard', 11_350, 3_740, 360, 360, 260),
];

const COLLISION_BLOCKERS = BLOCKER_FEATURES.map((feature) => createStaticBlocker({
  id: feature.id,
  shape: feature.shape,
  visibleAssetId: `graybox-${feature.visualKind}-${feature.id}`,
  minZ: feature.minZ ?? 0,
  maxZ: feature.maxZ ?? 128,
  combatCover: feature.combatCover ?? true,
}));
const VISIBLE_BARRIERS = COLLISION_BLOCKERS.map((blocker) => freezeDeep({
  id: blocker.visibleAssetId,
  hard: true,
  collisionBlockerIds: [blocker.id],
}));
const BLOCKERS = BLOCKER_FEATURES.map((feature, index) => freezeDeep({
  ...feature,
  collisionBlockerId: COLLISION_BLOCKERS[index].id,
  visibleAssetId: COLLISION_BLOCKERS[index].visibleAssetId,
}));

const LANDMARKS = [
  ['relay-tower', 'frontier-relay', 1_350, 1_300, 'signal-tower'],
  ['forked-spire', 'rugpull-ravine', 3_100, 1_250, 'forked-cliff'],
  ['proof-of-work-bridge-landmark', 'liquidity-crossing', 4_750, 2_400, 'bridge'],
  ['hashwood-beacon', 'hashwood', 7_000, 2_000, 'beacon-tree'],
  ['mining-headframe', 'mining-camp', 9_250, 1_250, 'headframe'],
  ['liquidation-tower', 'liquidation-yard', 11_100, 1_250, 'extraction-tower'],
].map(([id, districtId, x, y, visualKind]) => freezeDeep({ id, districtId, anchor: point(x, y), visualKind }));

const POINTS_OF_INTEREST = [
  ['relay-cache', 'frontier-relay', 1_250, 3_100, 'reward'],
  ['relay-armory', 'frontier-relay', 1_550, 1_550, 'weapon'],
  ['ravine-salvage', 'rugpull-ravine', 2_250, 3_000, 'reward'],
  ['ravine-overlook-cache', 'rugpull-ravine', 3_200, 1_400, 'reward'],
  ['crossing-fuel-depot', 'liquidity-crossing', 5_450, 3_000, 'hazard-reward'],
  ['crossing-bank-cache', 'liquidity-crossing', 5_300, 1_000, 'reward'],
  ['hashwood-shrine', 'hashwood', 6_700, 3_200, 'reward'],
  ['mining-control-room', 'mining-camp', 9_350, 1_600, 'upgrade'],
  ['yard-extraction-console', 'liquidation-yard', 10_650, 3_250, 'objective'],
  ['yard-medbay-cache', 'liquidation-yard', 11_480, 3_330, 'reward'],
].map(([id, districtId, x, y, hook]) => freezeDeep({ id, districtId, anchor: point(x, y), hook }));

const ENCOUNTER_ARENAS = [
  ['relay-training-yard', 'frontier-relay', 1_400, 3_000, 360],
  ['ravine-ambush-bowl', 'rugpull-ravine', 2_700, 2_700, 420],
  ['crossing-lockdown', 'liquidity-crossing', 5_450, 2_500, 420],
  ['hashwood-clearing-arena', 'hashwood', 7_150, 2_500, 460],
  ['mining-yard-arena', 'mining-camp', 8_850, 3_050, 500],
  ['liquidator-arena', 'liquidation-yard', 11_000, 2_400, 620],
].map(([id, districtId, x, y, radius]) => freezeDeep({ id, districtId, anchor: point(x, y), radius }));

const DESTRUCTIBLES = [
  ['relay-barricade-a', 'frontier-relay', 1_600, 2_950],
  ['ravine-barricade-a', 'rugpull-ravine', 2_100, 2_600],
  ['ravine-barricade-b', 'rugpull-ravine', 3_400, 2_750],
  ['crossing-crate-a', 'liquidity-crossing', 5_400, 2_850],
  ['hashwood-deadfall-a', 'hashwood', 6_550, 2_700],
  ['hashwood-deadfall-b', 'hashwood', 7_550, 2_850],
  ['mining-pallet-a', 'mining-camp', 8_650, 2_800],
  ['yard-container-lock', 'liquidation-yard', 10_450, 2_950],
].map(([id, districtId, x, y]) => freezeDeep({ id, districtId, anchor: point(x, y), hitPoints: 80, visualKind: 'destructible-cover' }));

const HAZARDS = [
  ['ravine-rockfall', 'rugpull-ravine', 3_500, 3_100, 'rockfall'],
  ['crossing-current', 'liquidity-crossing', 4_750, 1_700, 'deep-water'],
  ['hashwood-spore-bed', 'hashwood', 7_500, 3_500, 'area-slow'],
  ['mining-conveyor', 'mining-camp', 8_700, 3_100, 'moving-hazard'],
  ['yard-liquidation-grid', 'liquidation-yard', 11_200, 3_300, 'damage-zone'],
].map(([id, districtId, x, y, kind]) => freezeDeep({ id, districtId, anchor: point(x, y), kind }));

const EXPLOSIVE_ZONES = [
  ['crossing-fuel-route', 'liquidity-crossing', 5_450, 3_050, 180],
  ['mining-generator-bank', 'mining-camp', 8_550, 1_250, 160],
  ['yard-tanker-row', 'liquidation-yard', 10_450, 3_550, 200],
].map(([id, districtId, x, y, radius]) => freezeDeep({ id, districtId, anchor: point(x, y), radius, chainCap: 4 }));

const SPAWN_POINTS = [
  ['relay-north-spawn', 'frontier-relay', 1_550, 500],
  ['relay-south-spawn', 'frontier-relay', 1_600, 4_200],
  ['ravine-north-spawn', 'rugpull-ravine', 2_200, 900],
  ['ravine-south-spawn', 'rugpull-ravine', 3_350, 3_950],
  ['crossing-west-spawn', 'liquidity-crossing', 4_050, 3_500],
  ['crossing-east-spawn', 'liquidity-crossing', 5_650, 1_500],
  ['hashwood-north-spawn', 'hashwood', 6_350, 950],
  ['hashwood-south-spawn', 'hashwood', 7_650, 3_850],
  ['mining-north-spawn', 'mining-camp', 8_300, 1_150],
  ['mining-south-spawn', 'mining-camp', 9_650, 3_650],
  ['yard-north-spawn', 'liquidation-yard', 10_300, 1_150],
  ['yard-south-spawn', 'liquidation-yard', 11_650, 3_700],
].map(([id, districtId, x, y]) => freezeDeep({ id, regionId: `${districtId}-perimeter`, districtId, x, y, routeValid: true }));

function continuousSegments(length, physicalCause) {
  const third = Math.floor(length / 3);
  return freezeDeep([
    { start: 0, end: third + 24, physicalCause },
    { start: third, end: third * 2 + 24, physicalCause },
    { start: third * 2, end: length, physicalCause },
  ]);
}
const PERIMETER = freezeDeep([
  { id: 'north-perimeter', length: 12_000, physicalCause: 'cliffs', segments: continuousSegments(12_000, 'cliffs') },
  { id: 'east-perimeter', length: 4_800, physicalCause: 'wrecks-and-fence', segments: continuousSegments(4_800, 'wrecks-and-fence') },
  { id: 'south-perimeter', length: 12_000, physicalCause: 'deep-water-and-cliffs', segments: continuousSegments(12_000, 'deep-water-and-cliffs') },
  { id: 'west-perimeter', length: 4_800, physicalCause: 'fence-and-buildings', segments: continuousSegments(4_800, 'fence-and-buildings') },
]);

const SEAMS = DISTRICTS.slice(1).map((district, index) => freezeDeep({
  id: `${DISTRICTS[index].id}-to-${district.id}`,
  x: district.area.minX,
  districtIds: [DISTRICTS[index].id, district.id],
  landmarkId: `${DISTRICTS[index].id}-checkpoint`,
  clearWidth: 192,
}));

const LEGAL_ASCENTS = freezeDeep([
  { id: 'ravine-switchback-ramp', entry: point(2_500, 1_500), exit: point(2_900, 1_500), surfaceId: 'ravine-switchback-ramp' },
  { id: 'bridge-west-ramp', entry: point(4_400, 2_400), exit: point(4_550, 2_400), surfaceId: 'bridge-west-ramp' },
  { id: 'bridge-east-ramp', entry: point(5_100, 2_400), exit: point(4_950, 2_400), surfaceId: 'bridge-east-ramp' },
  { id: 'mining-service-ramp', entry: point(8_700, 1_600), exit: point(9_050, 1_600), surfaceId: 'mining-service-ramp' },
]);

const CROSSINGS = freezeDeep([
  { id: 'proof-of-work-bridge', entry: point(4_350, 2_400), exit: point(5_150, 2_400), axis: 'x', clearWidth: 220, surfaceIds: ['bridge-west-ramp', 'proof-of-work-bridge', 'bridge-east-ramp'] },
  { id: 'crossing-shallows', entry: point(4_350, 975), exit: point(5_150, 975), axis: 'x', clearWidth: 260, surfaceIds: ['crossing-shallows'] },
]);

export const LEVEL_ONE_WORLD = freezeDeep({
  id: 'forked-frontier',
  displayName: 'Crypto Wasteland: Forked Frontier',
  version: 1,
  bounds: BOUNDS,
  traversalTargetSeconds: { minimum: 40, maximum: 70 },
  player: { maxSpeed: 240, radius: LEVEL_ONE_PLAYER_RADIUS, spawn: point(800, 2_400), protectedSpawnRadius: LEVEL_ONE_PROTECTED_SPAWN_RADIUS },
  routeClearance: { main: 192, bridge: 160, secondary: 144 },
  districts: DISTRICTS,
  seams: SEAMS,
  routeGraph: { nodes: ROUTE_NODES, edges: ROUTE_EDGES },
  routes: ROUTES,
  baseSurface: BASE_SURFACE,
  surfaces: SURFACES,
  blockers: BLOCKERS,
  collisionBlockers: COLLISION_BLOCKERS,
  visibleBarriers: VISIBLE_BARRIERS,
  perimeter: PERIMETER,
  crossings: CROSSINGS,
  legalAscents: LEGAL_ASCENTS,
  landmarks: LANDMARKS,
  pointsOfInterest: POINTS_OF_INTEREST,
  encounterArenas: ENCOUNTER_ARENAS,
  interactions: { destructibles: DESTRUCTIBLES, hazards: HAZARDS, explosiveZones: EXPLOSIVE_ZONES },
  spawnPoints: SPAWN_POINTS,
  reveal: { cellSize: REVEAL_CELL_SIZE, radius: 420 },
});

export function createLevelOneGroundQuery() {
  return createAuthoredGroundQuery({ baseSurface: LEVEL_ONE_WORLD.baseSurface, surfaces: LEVEL_ONE_WORLD.surfaces });
}

export function getLevelOneDistrictAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('district query coordinates must be finite');
  return LEVEL_ONE_WORLD.districts.find((district) => x >= district.area.minX && x <= district.area.maxX && y >= district.area.minY && y <= district.area.maxY) ?? null;
}

export function getLevelOneRouteLength(routeId) {
  const route = LEVEL_ONE_WORLD.routes.find((candidate) => candidate.id === routeId);
  if (!route) throw new TypeError(`unknown route ${String(routeId)}`);
  let length = 0;
  for (let index = 1; index < route.nodeIds.length; index += 1) {
    const from = NODE_BY_ID.get(route.nodeIds[index - 1]);
    const to = NODE_BY_ID.get(route.nodeIds[index]);
    length += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return length;
}

function normalizePoint(value) {
  return Object.freeze({
    x: (value.x - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX),
    y: (value.y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY),
  });
}

function normalizeArea(area) {
  if (area.type === 'rect') return freezeDeep({ type: 'rect', min: normalizePoint({ x: area.minX, y: area.minY }), max: normalizePoint({ x: area.maxX, y: area.maxY }) });
  return freezeDeep({ type: 'polygon', points: area.vertices.map(normalizePoint) });
}

function normalizeShape(shape) {
  if (shape.type === 'circle') return freezeDeep({ type: 'circle', center: normalizePoint(shape), radiusX: shape.radius / 12_000, radiusY: shape.radius / 4_800 });
  if (shape.type === 'capsule') return freezeDeep({ type: 'capsule', a: normalizePoint(shape.a), b: normalizePoint(shape.b), radiusX: shape.radius / 12_000, radiusY: shape.radius / 4_800 });
  return freezeDeep({ type: 'polygon', points: shape.vertices.map(normalizePoint) });
}

export function buildLevelOneMinimapGeometry() {
  return freezeDeep({
    bounds: LEVEL_ONE_WORLD.bounds,
    districts: LEVEL_ONE_WORLD.districts.map((district) => ({ id: district.id, area: normalizeArea(district.area), color: district.color })),
    routes: LEVEL_ONE_WORLD.routes.map((route) => ({ id: route.id, kind: route.kind, width: route.width / 12_000, points: route.nodeIds.map((id) => normalizePoint(NODE_BY_ID.get(id))) })),
    surfaces: LEVEL_ONE_WORLD.surfaces.map((surface) => ({ id: surface.id, kind: surface.kind, area: normalizeArea(surface.area) })),
    hardBoundaries: LEVEL_ONE_WORLD.visibleBarriers.map((barrier) => {
      const blocker = LEVEL_ONE_WORLD.collisionBlockers.find((candidate) => candidate.id === barrier.collisionBlockerIds[0]);
      return { id: barrier.id, shape: normalizeShape(blocker.shape) };
    }),
    landmarks: LEVEL_ONE_WORLD.landmarks.map((landmark) => ({ id: landmark.id, districtId: landmark.districtId, point: normalizePoint(landmark.anchor) })),
    pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest.map((poi) => ({ id: poi.id, districtId: poi.districtId, point: normalizePoint(poi.anchor) })),
  });
}

export function createLevelOneRevealState() {
  return {
    revealedCellIds: new Set(),
    columns: Math.ceil((BOUNDS.maxX - BOUNDS.minX) / REVEAL_CELL_SIZE),
    rows: Math.ceil((BOUNDS.maxY - BOUNDS.minY) / REVEAL_CELL_SIZE),
  };
}

export function revealLevelOneAt(state, position, radius = LEVEL_ONE_WORLD.reveal.radius) {
  if (!(state?.revealedCellIds instanceof Set)) throw new TypeError('reveal state is required');
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y) || !Number.isFinite(radius) || radius < 0) throw new TypeError('reveal position and radius must be finite');
  const priorSize = state.revealedCellIds.size;
  const minimumColumn = Math.max(0, Math.floor((position.x - radius - BOUNDS.minX) / REVEAL_CELL_SIZE));
  const maximumColumn = Math.min(state.columns - 1, Math.floor((position.x + radius - BOUNDS.minX) / REVEAL_CELL_SIZE));
  const minimumRow = Math.max(0, Math.floor((position.y - radius - BOUNDS.minY) / REVEAL_CELL_SIZE));
  const maximumRow = Math.min(state.rows - 1, Math.floor((position.y + radius - BOUNDS.minY) / REVEAL_CELL_SIZE));
  for (let row = minimumRow; row <= maximumRow; row += 1) {
    for (let column = minimumColumn; column <= maximumColumn; column += 1) {
      const center = { x: BOUNDS.minX + (column + 0.5) * REVEAL_CELL_SIZE, y: BOUNDS.minY + (row + 0.5) * REVEAL_CELL_SIZE };
      if (Math.hypot(center.x - position.x, center.y - position.y) <= radius + REVEAL_CELL_SIZE * Math.SQRT2 * 0.5) state.revealedCellIds.add(`${column}:${row}`);
    }
  }
  return state.revealedCellIds.size - priorSize;
}

export function getLevelOneRevealSnapshot(state) {
  if (!(state?.revealedCellIds instanceof Set)) throw new TypeError('reveal state is required');
  return freezeDeep({
    revealedCellIds: [...state.revealedCellIds].sort((a, b) => {
      const [aColumn, aRow] = a.split(':').map(Number);
      const [bColumn, bRow] = b.split(':').map(Number);
      return aRow - bRow || aColumn - bColumn;
    }),
    totalCells: state.columns * state.rows,
    columns: state.columns,
    rows: state.rows,
    cellSize: REVEAL_CELL_SIZE,
    alwaysVisibleBoundaryIds: LEVEL_ONE_WORLD.visibleBarriers.map((barrier) => barrier.id).sort(),
  });
}

function inBounds(value) {
  return value.x >= BOUNDS.minX && value.x <= BOUNDS.maxX && value.y >= BOUNDS.minY && value.y <= BOUNDS.maxY;
}

export function auditLevelOneWorld() {
  const errors = [];
  const nodeIds = new Set(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => node.id));
  const adjacency = new Map([...nodeIds].map((id) => [id, []]));
  for (const edge of LEVEL_ONE_WORLD.routeGraph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push(`route edge ${edge.id} references a missing node`);
    else {
      adjacency.get(edge.from).push(edge.to);
      adjacency.get(edge.to).push(edge.from);
    }
  }
  const reachable = new Set(['relay-spawn']);
  const queue = ['relay-spawn'];
  while (queue.length) {
    const current = queue.shift();
    for (const next of [...(adjacency.get(current) ?? [])].sort()) {
      if (reachable.has(next)) continue;
      reachable.add(next);
      queue.push(next);
    }
  }
  if (reachable.size !== nodeIds.size) errors.push('route graph is disconnected');
  for (const node of LEVEL_ONE_WORLD.routeGraph.nodes) if (!inBounds(node)) errors.push(`route node ${node.id} is outside world bounds`);
  for (const route of LEVEL_ONE_WORLD.routes.filter((candidate) => candidate.kind === 'loop')) {
    if (route.nodeIds[0] !== route.nodeIds.at(-1)) errors.push(`loop ${route.id} does not converge`);
  }
  for (let index = 1; index < LEVEL_ONE_WORLD.districts.length; index += 1) {
    if (LEVEL_ONE_WORLD.districts[index - 1].area.maxX !== LEVEL_ONE_WORLD.districts[index].area.minX) errors.push(`district seam ${index} is discontinuous`);
  }
  const collisionAudit = auditCollisionWorld({ blockers: LEVEL_ONE_WORLD.collisionBlockers, visibleBarriers: LEVEL_ONE_WORLD.visibleBarriers });
  errors.push(...collisionAudit.errors);
  const ids = [];
  for (const collection of [LEVEL_ONE_WORLD.pointsOfInterest, LEVEL_ONE_WORLD.encounterArenas, LEVEL_ONE_WORLD.interactions.destructibles, LEVEL_ONE_WORLD.interactions.explosiveZones]) {
    for (const item of collection) ids.push(item.id);
  }
  if (new Set(ids).size !== ids.length) errors.push('authored world feature IDs are not unique');
  return freezeDeep({ ok: errors.length === 0, errors: errors.sort(), reachableNodeIds: [...reachable].sort() });
}
