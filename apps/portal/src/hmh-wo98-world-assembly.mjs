import { HMH_LEVEL_ONE_WO97_WORLD_ASSETS, levelOneWo97WorldAssetByKey } from '../assets/generated/hmh-coherent-world/level1-wo97-six-biome/level1-wo97-six-biome-manifest.mjs';

export const LEVEL_1_WO98_ACCEPTANCE_SEED = 1337;

export const LEVEL_1_WO98_MACRO_ROWS = Object.freeze([
  '....CCC.....',
  '..IIICFFF...',
  'NNIIICFFF.EE',
  'NNIII.FFF.EE',
  'NNIII.FFFFEE',
  '.......FFF..',
  '............',
]);

export const LEVEL_1_WO98_BIOME_BY_CODE = Object.freeze({
  N: 'neon-city-core',
  I: 'industrial-yard',
  C: 'old-canal-riverfront',
  F: 'farmstead-outskirts',
  P: 'lakeside-park-old-growth',
  E: 'extraction-plaza',
});

// Lakeside Park uses the same visible code family as the farm/forest seam in the
// approved macro sketch, so explicit cells promote the upper/eastern F band into
// the park/old-growth biome while the lower/eastern band remains farmstead.
const PARK_CELL_KEYS = new Set(['6,1', '7,1', '8,1', '6,2', '7,2', '8,2', '6,3', '7,3', '8,3']);

export const LEVEL_1_WO98_CRITICAL_PATH = Object.freeze([
  'neon-city-core',
  'industrial-yard',
  'old-canal-riverfront',
  'lakeside-park-old-growth',
  'farmstead-outskirts',
  'extraction-plaza',
]);

export const LEVEL_1_WO98_ROUTE_BEATS = Object.freeze({
  'neon-city-core': Object.freeze(['spawn', 'first-arena']),
  'industrial-yard': Object.freeze(['arena', 'pressure']),
  'old-canal-riverfront': Object.freeze(['chokepoint']),
  'lakeside-park-old-growth': Object.freeze(['loop', 'breather']),
  'farmstead-outskirts': Object.freeze(['loop', 'pressure']),
  'extraction-plaza': Object.freeze(['boss', 'extract']),
});

export const LEVEL_1_WO98_CONNECTORS = Object.freeze([
  Object.freeze({ type: 'road', from: 'neon-city-core', to: 'industrial-yard', lane: 'spawn-road', cells: Object.freeze([[1, 3], [2, 3], [3, 3]]) }),
  Object.freeze({ type: 'road', from: 'industrial-yard', to: 'old-canal-riverfront', lane: 'yard-canal-service-road', cells: Object.freeze([[4, 2], [5, 2]]) }),
  Object.freeze({ type: 'water', from: 'neon-city-core', to: 'old-canal-riverfront', lane: 'neon-canal-feed', cells: Object.freeze([[1, 2], [3, 1], [5, 0]]) }),
  Object.freeze({ type: 'water', from: 'old-canal-riverfront', to: 'lakeside-park-old-growth', lane: 'canal-lake-band', cells: Object.freeze([[5, 1], [6, 1], [7, 1], [8, 1]]) }),
  Object.freeze({ type: 'trail', from: 'industrial-yard', to: 'farmstead-outskirts', lane: 'service-trail-to-fields', cells: Object.freeze([[4, 4], [6, 4], [7, 4]]) }),
  Object.freeze({ type: 'trail', from: 'lakeside-park-old-growth', to: 'farmstead-outskirts', lane: 'forest-farm-loop', cells: Object.freeze([[8, 3], [8, 4], [8, 5]]) }),
  Object.freeze({ type: 'road', from: 'farmstead-outskirts', to: 'extraction-plaza', lane: 'farm-extraction-road', cells: Object.freeze([[9, 4], [10, 4], [11, 4]]) }),
  Object.freeze({ type: 'trail', from: 'lakeside-park-old-growth', to: 'extraction-plaza', lane: 'park-boss-shortcut', cells: Object.freeze([[8, 2], [10, 2], [11, 2]]) }),
]);

const FAMILY_ROLE = Object.freeze({
  ground: 'ground-tile',
  water: 'water-strip',
  vegetation: 'tree',
  buildings: 'building',
  vehicles: 'vehicle',
  critters: 'critter',
  poi: 'landmark',
});

function freezeArray(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

function hashU32(seed, x, y, salt = 0) {
  let h = (Number(seed) >>> 0) ^ Math.imul((x + 101) | 0, 0x9e3779b1) ^ Math.imul((y + 211) | 0, 0x85ebca6b) ^ Math.imul((salt + 1) | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function jitter(seed, x, y, salt, scale = 0.34) {
  return Number((((hashU32(seed, x, y, salt) / 0xffffffff) - 0.5) * scale).toFixed(3));
}

function biomeForMacroCell(code, x, y) {
  if (code === '.') return null;
  if (code === 'F' && PARK_CELL_KEYS.has(`${x},${y}`)) return 'lakeside-park-old-growth';
  return LEVEL_1_WO98_BIOME_BY_CODE[code] ?? null;
}

function assetKeyFor(biomeId, family) {
  return `level1-wo97-six-biome/${biomeId}-${family}`;
}

function placedAsset({ seed, biomeId, family, x, y, ordinal = 0, role = FAMILY_ROLE[family], place = 'scatter', solid = true, routeBeat = null }) {
  const assetKey = assetKeyFor(biomeId, family);
  const asset = levelOneWo97WorldAssetByKey(assetKey);
  return Object.freeze({
    id: `wo98-${biomeId}-${family}-${x}-${y}-${ordinal}`,
    assetKey,
    src: asset?.src ?? null,
    biomeId,
    family,
    role,
    macroX: x,
    macroY: y,
    worldX: Number((x * 7 + 3.5 + jitter(seed, x, y, ordinal)).toFixed(3)),
    worldY: Number((y * 7 + 3.5 + jitter(seed, x, y, ordinal + 31)).toFixed(3)),
    solid,
    place,
    routeBeat,
    zHeight: family === 'buildings' || family === 'poi' ? 4 : family === 'vegetation' ? 2 : 0,
  });
}

export function buildLevelOneWo98MacroCells({ seed = LEVEL_1_WO98_ACCEPTANCE_SEED } = {}) {
  const cells = [];
  LEVEL_1_WO98_MACRO_ROWS.forEach((row, y) => {
    [...row].forEach((code, x) => {
      const biomeId = biomeForMacroCell(code, x, y);
      if (!biomeId) return;
      cells.push(Object.freeze({
        id: `wo98-cell-${x}-${y}`,
        x,
        y,
        code,
        biomeId,
        routeBeats: LEVEL_1_WO98_ROUTE_BEATS[biomeId],
        groundAssetKey: assetKeyFor(biomeId, 'ground'),
        seedOffset: hashU32(seed, x, y, 97),
      }));
    });
  });
  return freezeArray(cells);
}

function connectorCellKeys() {
  const result = new Map();
  for (const connector of LEVEL_1_WO98_CONNECTORS) {
    for (const [x, y] of connector.cells) {
      result.set(`${x},${y}`, connector);
    }
  }
  return result;
}

function cellHasPrimaryPoi(cell) {
  const beats = LEVEL_1_WO98_ROUTE_BEATS[cell.biomeId] ?? [];
  if (beats.includes('spawn')) return cell.x <= 1 && cell.y >= 2;
  if (beats.includes('boss')) return cell.x >= 10 && cell.y >= 2;
  if (beats.includes('chokepoint')) return cell.biomeId === 'old-canal-riverfront' && cell.x === 5;
  if (beats.includes('breather')) return cell.biomeId === 'lakeside-park-old-growth' && cell.x === 7 && cell.y === 2;
  if (beats.includes('pressure')) return cell.biomeId === 'industrial-yard' ? cell.x === 3 && cell.y === 3 : cell.x === 8 && cell.y === 4;
  return false;
}

export function buildLevelOneWo98PlacedAssets({ seed = LEVEL_1_WO98_ACCEPTANCE_SEED } = {}) {
  const cells = buildLevelOneWo98MacroCells({ seed });
  const connectorByCell = connectorCellKeys();
  const placed = [];
  for (const cell of cells) {
    const connector = connectorByCell.get(`${cell.x},${cell.y}`);
    placed.push(placedAsset({ seed, biomeId: cell.biomeId, family: 'ground', x: cell.x, y: cell.y, ordinal: 0, place: 'ground', solid: false }));
    if (connector?.type === 'water' || cell.biomeId === 'old-canal-riverfront') {
      placed.push(placedAsset({ seed, biomeId: cell.biomeId, family: 'water', x: cell.x, y: cell.y, ordinal: 1, place: connector?.type === 'water' ? 'connector' : 'waterfront', solid: false, routeBeat: 'water-route' }));
    }
    if ((cell.x + cell.y + (cell.seedOffset % 3)) % 2 === 0) {
      placed.push(placedAsset({ seed, biomeId: cell.biomeId, family: 'vegetation', x: cell.x, y: cell.y, ordinal: 2, place: 'edge-dressing', solid: true }));
    }
    if (cellHasPrimaryPoi(cell)) {
      placed.push(placedAsset({ seed, biomeId: cell.biomeId, family: 'poi', x: cell.x, y: cell.y, ordinal: 3, place: 'micro-scene-anchor', solid: true, routeBeat: LEVEL_1_WO98_ROUTE_BEATS[cell.biomeId]?.at(0) ?? null }));
      placed.push(placedAsset({ seed, biomeId: cell.biomeId, family: 'buildings', x: cell.x, y: cell.y, ordinal: 4, place: 'prefab-support', solid: true }));
    }
    if ((hashU32(seed, cell.x, cell.y, 5) % 5) === 0) {
      placed.push(placedAsset({ seed, biomeId: cell.biomeId, family: 'vehicles', x: cell.x, y: cell.y, ordinal: 5, place: 'roadside-prop', solid: true }));
    }
    if ((hashU32(seed, cell.x, cell.y, 7) % 4) === 0) {
      placed.push(placedAsset({ seed, biomeId: cell.biomeId, family: 'critters', x: cell.x, y: cell.y, ordinal: 6, place: 'ambient-life', solid: false }));
    }
  }
  return freezeArray(placed);
}

export const LEVEL_1_WO98_MICRO_SCENES = freezeArray([
  { id: 'ltc-bus-stop-spawn', biomeId: 'neon-city-core', routeBeat: 'spawn', assetFamilies: ['ground', 'poi', 'vehicles', 'critters'], acceptance: 'spawn reads as a neon LTC bus-stop plaza with clear road east' },
  { id: 'neon-fountain-first-arena', biomeId: 'neon-city-core', routeBeat: 'first-arena', assetFamilies: ['ground', 'vegetation', 'poi'], acceptance: 'first arena has bright sign/fountain anchor but leaves combat negative space' },
  { id: 'dock-crane-yard', biomeId: 'industrial-yard', routeBeat: 'arena', assetFamilies: ['ground', 'buildings', 'vehicles', 'poi'], acceptance: 'industrial yard uses crane/warehouse language and solid cover silhouettes' },
  { id: 'container-maze-pressure', biomeId: 'industrial-yard', routeBeat: 'pressure', assetFamilies: ['ground', 'buildings', 'vehicles', 'critters'], acceptance: 'pressure pocket adds props without random scatter' },
  { id: 'lock-bridge-chokepoint', biomeId: 'old-canal-riverfront', routeBeat: 'chokepoint', assetFamilies: ['ground', 'water', 'buildings', 'poi'], acceptance: 'canal bridge reads as the water chokepoint' },
  { id: 'boathouse-dock', biomeId: 'old-canal-riverfront', routeBeat: 'chokepoint', assetFamilies: ['water', 'vegetation', 'vehicles'], acceptance: 'waterfront support props align to the canal band' },
  { id: 'lookout-tower-breather', biomeId: 'lakeside-park-old-growth', routeBeat: 'breather', assetFamilies: ['ground', 'vegetation', 'poi', 'critters'], acceptance: 'park loop has calm green silhouette and ambient life' },
  { id: 'moonlit-lake-band', biomeId: 'lakeside-park-old-growth', routeBeat: 'loop', assetFamilies: ['water', 'vegetation', 'critters'], acceptance: 'lake band connects from canal without decorative puddle scatter' },
  { id: 'windmill-field-loop', biomeId: 'farmstead-outskirts', routeBeat: 'loop', assetFamilies: ['ground', 'vegetation', 'poi', 'critters'], acceptance: 'farm loop has windmill/crop identity and readable return trail' },
  { id: 'barn-silo-pressure', biomeId: 'farmstead-outskirts', routeBeat: 'pressure', assetFamilies: ['ground', 'buildings', 'vehicles'], acceptance: 'barn/silo pressure pocket gives strong authored landmark cover' },
  { id: 'boss-gate-roundabout', biomeId: 'extraction-plaza', routeBeat: 'boss', assetFamilies: ['ground', 'buildings', 'vehicles', 'poi'], acceptance: 'boss gate roundabout pulls focus without hiding enemies' },
  { id: 'ltc-beacon-pad-extract', biomeId: 'extraction-plaza', routeBeat: 'extract', assetFamilies: ['ground', 'poi', 'critters'], acceptance: 'extract pad reads as the final LTC beacon' },
]);

export function buildLevelOneWo98AcceptanceTour({ seed = LEVEL_1_WO98_ACCEPTANCE_SEED } = {}) {
  const placed = buildLevelOneWo98PlacedAssets({ seed });
  const byBiome = new Map();
  for (const object of placed) {
    if (!byBiome.has(object.biomeId)) byBiome.set(object.biomeId, []);
    byBiome.get(object.biomeId).push(object);
  }
  const steps = LEVEL_1_WO98_CRITICAL_PATH.map((biomeId, index) => {
    const objects = byBiome.get(biomeId) ?? [];
    const families = [...new Set(objects.map((object) => object.family))].sort();
    return Object.freeze({
      index,
      seed,
      biomeId,
      routeBeats: LEVEL_1_WO98_ROUTE_BEATS[biomeId],
      expectedFamilies: families,
      expectedObjects: objects.slice(0, 8).map((object) => object.assetKey),
      acceptance: [
        'macro biome identity is readable from ground + landmark silhouette',
        'connectors preserve authored west-to-east pressure curve',
        'micro-scenes use approved WO-97 assets instead of random scatter',
      ],
    });
  });
  return Object.freeze({
    id: 'level1-wo98-seed-1337-acceptance-tour-v1',
    seed,
    criticalPath: LEVEL_1_WO98_CRITICAL_PATH,
    steps: Object.freeze(steps),
    summary: Object.freeze({
      macroRows: LEVEL_1_WO98_MACRO_ROWS.length,
      macroColumns: LEVEL_1_WO98_MACRO_ROWS[0].length,
      placedObjectCount: placed.length,
      microSceneCount: LEVEL_1_WO98_MICRO_SCENES.length,
      connectorTypes: Object.freeze([...new Set(LEVEL_1_WO98_CONNECTORS.map((connector) => connector.type))].sort()),
    }),
  });
}

export const LEVEL_1_WO98_WORLD_ASSEMBLY = Object.freeze({
  id: 'level1-wo98-six-biome-world-assembly-v1',
  status: 'runtime-assembly-ready',
  sourceManifestId: HMH_LEVEL_ONE_WO97_WORLD_ASSETS.id,
  seed: LEVEL_1_WO98_ACCEPTANCE_SEED,
  macroRows: LEVEL_1_WO98_MACRO_ROWS,
  criticalPath: LEVEL_1_WO98_CRITICAL_PATH,
  connectors: LEVEL_1_WO98_CONNECTORS,
  microScenes: LEVEL_1_WO98_MICRO_SCENES,
});
