import { buildTerrainBlobCell } from './hmh-terrain-blob-map.mjs';
import { HMH_LEVEL_ONE_CURATED_ROUTE } from './hmh-level-one-curated-world-contract.mjs';
import {
  HMH_LEVEL_ONE_ID,
  LEVEL_1_PIXELLAB_SURFACE_ZONES,
  levelOnePixellabSurfaceAssetByKey,
} from './hmh-level-one-ground.mjs';
import {
  HMH_LEVEL_ONE_FINAL_PAINT_GROUND,
  finalPaintGroundAssetByKey,
} from '../assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.mjs';
import {
  HMH_WO103_CONTINUOUS_GROUND,
  wo103ContinuousGroundAssetByKey,
} from '../assets/generated/hmh-level-one-ground/wo103-continuous/wo103-continuous-ground-manifest.mjs';
import {
  HMH_LEVEL_ONE_SBS_GROUND,
  sbsGroundAssetByKey,
} from '../assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs';
import {
  HMH_CURATED_GROUND_RUNTIME,
} from '../assets/generated/hmh-curated-level-art/hmh-curated-ground-runtime.mjs';

const CONNECTIVE_ZONE_ID = 'connective-scrub';

const ROLE_ALIASES = Object.freeze({
  bridge: 'road',
  scrub: 'dirt',
  route: 'road',
  pavement: 'road',
  rocky: 'rocky',
});

const WO103_ROLE_PREFERENCES = Object.freeze({
  grass: 'wo103-continuous/grass',
  dirt: 'wo103-continuous/dirt',
  sand: 'wo103-continuous/sand',
  rocky: 'wo103-continuous/rocky',
  road: 'wo103-continuous/asphalt',
  shore: 'wo103-continuous/shore-grass-water',
  water: 'wo103-continuous/water-ripple',
  'grass-to-dirt': 'wo103-continuous/grass-dirt-transition',
  'dirt-to-sand': 'wo103-continuous/dirt-sand-transition',
});

const CHATGPT_TERRAIN_ROLE_PREFERENCES = Object.freeze({
  grass: 'chatgpt-terrain/jul9-park-path-plaza-a-r1-c2',
  dirt: 'chatgpt-terrain/jul9-master-ground-terrain-a-r2-c2',
  sand: 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c3',
  rocky: 'chatgpt-terrain/jul9-master-ground-terrain-a-r3-c3',
  road: 'chatgpt-terrain/jul9-road-transition-a-r1-c2',
  bridge: 'chatgpt-terrain/jul9-road-transition-a-r3-c3',
  shore: 'chatgpt-terrain/jul9-lakeside-pond-a-r2-c3',
  water: 'chatgpt-terrain/jul9-lakeside-pond-a-r1-c2',
  'grass-to-dirt': 'chatgpt-terrain/jul9-transition-ground-edges-a-r1-c3',
  'dirt-to-sand': 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c2',
  'grass-to-road': 'chatgpt-terrain/jul9-neighborhood-ground-a-r3-c5',
});

const CURATED_RADIUS_BY_BEAT = Object.freeze({
  'safe-spawn': Object.freeze({ x: 10, y: 8 }),
  'mini-boss-arena': Object.freeze({ x: 12, y: 10 }),
  chokepoint: Object.freeze({ x: 10, y: 8 }),
  'open-arena': Object.freeze({ x: 14, y: 12 }),
  'boss-arena': Object.freeze({ x: 15, y: 12 }),
  extraction: Object.freeze({ x: 10, y: 8 }),
});

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

function normalizeRole(role) {
  const key = String(role || 'dirt').toLowerCase();
  return ROLE_ALIASES[key] ?? key;
}

const CURATED_GROUND_LABELS = Object.freeze(String(HMH_CURATED_GROUND_RUNTIME.groundLabels ?? '').split('|'));
const CURATED_GROUND_ROLE_CODES = Object.freeze(HMH_CURATED_GROUND_RUNTIME.roleCodes ?? {});
function decodeCuratedGroundRoles(serialized) {
  return Object.freeze(String(serialized || '').split(',').filter(Boolean).map((code) => CURATED_GROUND_ROLE_CODES[code] ?? code));
}
const CURATED_GROUND_SHEETS = Object.freeze((HMH_CURATED_GROUND_RUNTIME.sheets ?? []).map(([slug, primaryCode, rowCodes, rows = 5, cols = 5]) => Object.freeze({
  slug,
  primaryRole: CURATED_GROUND_ROLE_CODES[primaryCode] ?? primaryCode,
  roleRows: Object.freeze(String(rowCodes || '').split('|').map(decodeCuratedGroundRoles)),
  rows,
  cols,
})));
const CURATED_GROUND_SHEET_BY_SLUG = new Map(CURATED_GROUND_SHEETS.map((sheet) => [sheet.slug, sheet]));

function curatedGroundTextureKey(sheetSlug, row, col) {
  return `chatgpt-terrain/${sheetSlug}-r${row}-c${col}`;
}

function curatedTerrainTextureAssetByKey(key) {
  const match = String(key || '').match(/^chatgpt-terrain\/(.+)-r(\d+)-c(\d+)$/);
  if (!match) return null;
  const [, sheetSlug, rowRaw, colRaw] = match;
  const sheet = CURATED_GROUND_SHEET_BY_SLUG.get(sheetSlug);
  if (!sheet) return null;
  const row = Number(rowRaw);
  const col = Number(colRaw);
  if (row < 1 || row > sheet.rows || col < 1 || col > sheet.cols) return null;
  const label = sheet.rows === 5 && sheet.cols === 5
    ? CURATED_GROUND_LABELS[(row - 1) * 5 + (col - 1)] ?? `tile-${row}-${col}`
    : `tile-r${row}-c${col}`;
  const materialRoles = Object.freeze(sheet.roleRows?.[row - 1] ?? [sheet.primaryRole ?? 'dirt']);
  return Object.freeze({
    key,
    slug: `${sheetSlug}-r${row}-c${col}`,
    sheet: sheetSlug,
    label,
    grid: Object.freeze({ row, col }),
    src: `./assets/generated/hmh-curated-level-art/terrain-textures/${sheetSlug}/${row}-${col}-${label}.png`,
    width: HMH_CURATED_GROUND_RUNTIME.tileSize ?? 160,
    height: HMH_CURATED_GROUND_RUNTIME.tileSize ?? 160,
    role: sheet.primaryRole ?? 'dirt',
    materialRoles,
    preferred: (row === col),
    source: 'justin-chatgpt-map-tile-sheet',
    notes: 'Justin-approved ChatGPT Image map tile sheet, sliced into an opaque runtime terrain texture.',
  });
}

function curatedTextureKeysForRole(role) {
  const normalized = normalizeRole(role);
  const keys = [];
  for (const sheet of CURATED_GROUND_SHEETS) {
    for (let row = 1; row <= sheet.rows; row += 1) {
      const roles = sheet.roleRows?.[row - 1] ?? [sheet.primaryRole ?? 'dirt'];
      if (!roles.includes(normalized)) continue;
      for (let col = 1; col <= sheet.cols; col += 1) keys.push(curatedGroundTextureKey(sheet.slug, row, col));
    }
  }
  return keys;
}

function curatedTextureKeysForSheet(sheetSlug) {
  const sheet = CURATED_GROUND_SHEET_BY_SLUG.get(sheetSlug);
  if (!sheet) return [];
  const keys = [];
  for (let row = 1; row <= sheet.rows; row += 1) {
    for (let col = 1; col <= sheet.cols; col += 1) keys.push(curatedGroundTextureKey(sheet.slug, row, col));
  }
  return keys;
}

function manifestKeysForRole(role) {
  const normalized = normalizeRole(role);
  const curatedKeys = curatedTextureKeysForRole(normalized);
  if (curatedKeys.length) return { keys: curatedKeys, lookup: curatedTerrainTextureAssetByKey };
  const continuousKeys = HMH_WO103_CONTINUOUS_GROUND.roles?.[normalized] ?? [];
  if (continuousKeys.length) return { keys: continuousKeys, lookup: wo103ContinuousGroundAssetByKey };
  const finalKeys = HMH_LEVEL_ONE_FINAL_PAINT_GROUND.roles?.[normalized] ?? [];
  if (finalKeys.length) return { keys: finalKeys, lookup: finalPaintGroundAssetByKey };
  const sbsKeys = HMH_LEVEL_ONE_SBS_GROUND.roles?.[normalized] ?? [];
  if (sbsKeys.length) return { keys: sbsKeys, lookup: sbsGroundAssetByKey };
  const fallbackKeys = HMH_LEVEL_ONE_FINAL_PAINT_GROUND.roles?.dirt ?? HMH_LEVEL_ONE_SBS_GROUND.roles?.dirt ?? [];
  return { keys: fallbackKeys, lookup: finalPaintGroundAssetByKey };
}

function preferredTextureKeyForRole(role) {
  const normalized = normalizeRole(role);
  if (curatedTerrainTextureAssetByKey(CHATGPT_TERRAIN_ROLE_PREFERENCES[normalized])) return CHATGPT_TERRAIN_ROLE_PREFERENCES[normalized];
  if (wo103ContinuousGroundAssetByKey(WO103_ROLE_PREFERENCES[normalized])) return WO103_ROLE_PREFERENCES[normalized];
  const { keys, lookup } = manifestKeysForRole(role);
  if (!keys.length) return 'final-paint/dirt-handpaint-01';
  return keys.find((key) => lookup(key)?.preferred) ?? keys[0];
}

function wo103TextureKeyForLegacySurface(asset, role) {
  const key = String(asset?.key ?? '').toLowerCase();
  if (key.includes('asphalt') || key.includes('cobble')) return preferredTextureKeyForRole('road');
  if (key.includes('scorched') || key.includes('boss')) return preferredTextureKeyForRole('rocky');
  if (key.includes('field') || key.includes('stubble')) return preferredTextureKeyForRole('grass');
  if (key.includes('forest')) return preferredTextureKeyForRole('grass');
  if (key.includes('sand')) return preferredTextureKeyForRole('sand');
  if (key.includes('water')) return preferredTextureKeyForRole('water');
  return preferredTextureKeyForRole(role);
}

function roleFromAssetKey(assetKey) {
  const key = String(assetKey || '').toLowerCase();
  if (key.includes('water') || key.includes('river')) return 'water';
  if (key.includes('shore')) return 'shore';
  if (key.includes('road') || key.includes('street') || key.includes('highway')) return 'road';
  if (key.includes('grass') || key.includes('forest') || key.includes('flora') || key.includes('mushroom')) return 'grass';
  if (key.includes('sand') || key.includes('desert') || key.includes('cactus')) return 'sand';
  if (key.includes('rock') || key.includes('ruin') || key.includes('bone') || key.includes('scorched')) return 'rocky';
  if (key.includes('dirt') || key.includes('ground')) return 'dirt';
  return null;
}

function roleFromCuratedZone(zone) {
  const routeOrWater = zone.assetRefs?.find((asset) => asset.use === 'water' || asset.use === 'route');
  const terrain = zone.assetRefs?.find((asset) => asset.use === 'terrain');
  const explicit = roleFromAssetKey(routeOrWater?.assetKey) ?? roleFromAssetKey(terrain?.assetKey);
  if (explicit) return normalizeRole(explicit);
  if (String(zone.id).includes('forest')) return 'grass';
  if (String(zone.id).includes('shore')) return 'shore';
  if (String(zone.id).includes('desert')) return 'sand';
  if (String(zone.id).includes('boss')) return 'rocky';
  if (String(zone.id).includes('road') || String(zone.id).includes('saloon') || String(zone.id).includes('warehouse')) return 'road';
  return 'dirt';
}

function curatedZoneBounds(zone) {
  const radius = CURATED_RADIUS_BY_BEAT[zone.beat] ?? Object.freeze({ x: 10, y: 8 });
  const cx = Math.round(Number(zone.xPct) || 0);
  const cy = Math.round(Number(zone.yPct) || 0);
  return Object.freeze({
    xMin: cx - radius.x,
    xMax: cx + radius.x,
    yMin: cy - radius.y,
    yMax: cy + radius.y,
  });
}

function contains(zone, x, y) {
  return x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax;
}

function buildCuratedZones() {
  return HMH_LEVEL_ONE_CURATED_ROUTE.map((zone) => {
    const role = roleFromCuratedZone(zone);
    return freezeRecord({
      source: 'curated-world-contract',
      zoneId: zone.id,
      title: zone.title,
      role,
      textureKey: preferredTextureKeyForRole(role),
      priority: 1000 + (zone.order ?? 0),
      ...curatedZoneBounds(zone),
    });
  });
}

function buildPixellabZones() {
  return LEVEL_1_PIXELLAB_SURFACE_ZONES.map((zone) => {
    const asset = levelOnePixellabSurfaceAssetByKey(zone.assetKey);
    const role = normalizeRole(asset?.role ?? 'dirt');
    return freezeRecord({
      source: 'pixellab-surface-zones',
      zoneId: zone.id,
      role,
      textureKey: wo103TextureKeyForLegacySurface(asset, role),
      priority: 2000 + (zone.priority ?? 0),
      xMin: zone.xMin,
      xMax: zone.xMax,
      yMin: zone.yMin,
      yMax: zone.yMax,
    });
  });
}

function terrainZone(zoneId, role, textureKey, xMin, xMax, yMin, yMax, priority) {
  return freezeRecord({
    source: 'justin-chatgpt-terrain-layout-v2',
    zoneId,
    role,
    textureKey,
    priority,
    xMin,
    xMax,
    yMin,
    yMax,
  });
}

function textureVariantKeysForZone(zone) {
  const preferredSheet = String(zone.textureKey || '').match(/^chatgpt-terrain\/(.+)-r\d+-c\d+$/)?.[1] ?? null;
  const sheetKeys = preferredSheet
    ? curatedTextureKeysForSheet(preferredSheet)
    : curatedTextureKeysForRole(zone.role).slice(0, 9);
  return [zone.textureKey, ...sheetKeys]
    .filter((key, index, keys) => key?.startsWith('chatgpt-terrain/') && keys.indexOf(key) === index);
}

function textureKeyForZoneCell(zone, worldX, worldY, seed) {
  // A zone is an authored material field, not a sampler for every tile on its
  // source sheet. Repeating the chosen source continuously lets grass, asphalt,
  // sand, and water read as places; transitions and detail belong in explicit
  // neighboring zones rather than randomized two-tile checkerboards.
  return zone.textureKey;
}

function buildChatgptTerrainZones() {
  return Object.freeze([
    // Compact-map macro districts cover the entire 263x225 footprint. Narrow
    // route/POI zones below override these broad authored biome fields.
    terrainZone('compact-northwest-forest-field', 'grass', 'chatgpt-terrain/jul9-master-ground-terrain-a-r1-c1', -131, -41, -112, -26, 120),
    terrainZone('compact-north-town-field', 'grass', 'chatgpt-terrain/jul9-neighborhood-ground-a-r1-c1', -40, 19, -112, -26, 120),
    terrainZone('compact-northeast-lakeside-field', 'shore', 'chatgpt-terrain/jul9-lakeside-pond-a-r2-c2', 20, 131, -112, -26, 120),
    terrainZone('compact-west-desert-field', 'dirt', 'chatgpt-terrain/jul9-transition-ground-edges-a-r3-c2', -131, -41, -25, 44, 120),
    terrainZone('compact-center-town-field', 'road', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r1-c1', -40, 39, -25, 44, 120),
    terrainZone('compact-east-park-field', 'grass-to-road', 'chatgpt-terrain/jul9-park-path-plaza-a-r3-c2', 40, 131, -25, 44, 120),
    terrainZone('compact-southwest-road-field', 'road', 'chatgpt-terrain/jul9-road-transition-a-r1-c1', -131, -41, 45, 112, 120),
    terrainZone('compact-south-waterfront-field', 'shore', 'chatgpt-terrain/jul9-water-shore-mud-a-r2-c1', -40, 39, 45, 112, 120),
    terrainZone('compact-southeast-extraction-field', 'road', 'chatgpt-terrain/jul9-extraction-plaza-b-r1-c1', 40, 131, 45, 112, 120),
    terrainZone('compact-riverbank-spine', 'shore', 'chatgpt-terrain/jul9-riverbank-slabs-b-r1-c1', 20, 38, -112, 112, 160),
    terrainZone('compact-rapid-water-spine', 'water', 'chatgpt-terrain/jul9-rapid-water-b-r1-c1', 26, 32, -112, 112, 170),
    // Secondary authored water bodies. These replace pasted water prop cards so
    // every visible lake/rapid/ford is represented by collision-backed terrain.
    terrainZone('north-riverfront-shore', 'shore', 'chatgpt-terrain/jul9-riverbank-slabs-b-r2-c2', 35, 49, -82, -72, 3170),
    terrainZone('north-riverfront-deep-rapid-pool', 'water', 'chatgpt-terrain/jul9-rapid-water-b-r2-c2', 37, 47, -77, -74, 3180),
    terrainZone('lakeside-park-shore', 'shore', 'chatgpt-terrain/jul9-lakeside-pond-a-r2-c3', 79, 89, 7, 12, 3170),
    terrainZone('lakeside-park-deep-water', 'water', 'chatgpt-terrain/jul9-lakeside-pond-a-r1-c2', 81, 87, 8, 11, 3180),
    terrainZone('east-town-shallow-ford', 'water', 'chatgpt-terrain/jul9-water-shore-mud-a-r1-c4', 39, 45, 2, 4, 3200),
    terrainZone('southeast-glow-bank-shore', 'shore', 'chatgpt-terrain/jul9-water-shore-mud-a-r2-c1', 88, 104, 67, 74, 3170),
    terrainZone('southeast-glow-bank-deep-pool', 'water', 'chatgpt-terrain/jul9-rapid-water-b-r3-c2', 90, 102, 69, 72, 3180),
    // Authored connective network. Broad roads join the two towns and extraction
    // yard; narrower dirt trails branch into forests, desert, and waterfront POIs.
    // Three explicit bridge decks are the only hard-road crossings of the rapid
    // spine, keeping the visible water and traversal rules in agreement.
    terrainZone('compact-west-east-town-road', 'road', 'chatgpt-terrain/jul9-road-transition-a-r1-c1', -110, 108, 2, 6, 3090),
    terrainZone('compact-north-town-road', 'road', 'chatgpt-terrain/jul9-neighborhood-ground-a-r1-c2', -40, 108, -73, -69, 3090),
    terrainZone('compact-northeast-neighborhood-road', 'road', 'chatgpt-terrain/jul9-road-transition-a-r2-c2', 101, 107, -69, 6, 3090),
    terrainZone('compact-east-farmstead-yard', 'rocky', 'chatgpt-terrain/jul9-master-ground-terrain-a-r2-c2', 72, 86, 16, 25, 3070),
    terrainZone('compact-east-farmstead-path', 'dirt', 'chatgpt-terrain/jul9-park-path-plaza-a-r2-c2', 76, 80, 5, 20, 3080),
    terrainZone('compact-northwest-desert-path', 'dirt', 'chatgpt-terrain/jul9-master-ground-terrain-a-r2-c2', -109, -103, -79, 3, 3050),
    terrainZone('compact-north-forest-path', 'dirt', 'chatgpt-terrain/jul9-park-path-plaza-a-r2-c2', -39, -33, -82, 3, 3050),
    terrainZone('compact-center-south-path', 'road', 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c2', -3, 3, 5, 81, 3050),
    terrainZone('compact-southern-waterfront-trail', 'dirt', 'chatgpt-terrain/jul9-park-path-plaza-a-r2-c3', -99, 99, 77, 81, 3050),
    terrainZone('compact-central-river-bridge', 'road', 'chatgpt-terrain/jul9-road-transition-a-r3-c3', 26, 32, 2, 6, 3250),
    terrainZone('compact-north-river-bridge', 'road', 'chatgpt-terrain/jul9-road-transition-a-r3-c3', 26, 32, -73, -69, 3250),
    terrainZone('compact-south-river-bridge', 'road', 'chatgpt-terrain/jul9-road-transition-a-r3-c3', 26, 32, 77, 81, 3250),
    terrainZone('spawn-clear-blacktop-centerline', 'road', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r1-c2', -16, 22, 4, 6, 3100),
    terrainZone('spawn-grass-road-north-shoulder', 'grass-to-road', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r2-c4', -12, 24, 2, 3, 3095),
    terrainZone('spawn-muddy-road-south-shoulder', 'dirt', 'chatgpt-terrain/jul9-water-shore-mud-a-r2-c2', -12, 26, 7, 9, 3095),
    terrainZone('spawn-dirt-scrub-outfield', 'dirt', 'chatgpt-terrain/jul9-master-ground-terrain-a-r2-c2', -18, 30, -4, 12, 3000),
    terrainZone('ghost-town-cracked-asphalt-core', 'road', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r3-c4', 28, 54, -1, 12, 3120),
    terrainZone('ghost-town-mossy-curb-edge', 'grass-to-road', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r2-c2', 28, 54, 11, 14, 3110),
    terrainZone('country-grass-megapath', 'grass', 'chatgpt-terrain/jul9-master-ground-terrain-a-r1-c1', 50, 88, -2, 13, 3080),
    terrainZone('country-puddle-lowlands', 'shore', 'chatgpt-terrain/jul9-water-shore-mud-a-r3-c1', 55, 74, 9, 13, 3090),
    terrainZone('river-bridge-planks', 'road', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r3-c2', 60, 64, 5, 6, 3165),
    terrainZone('blackwater-ford-water-ribbon', 'water', 'chatgpt-terrain/jul9-water-shore-mud-a-r1-c4', 60, 64, 6, 9, 3150),
    terrainZone('blackwater-ford-grass-shore', 'shore', 'chatgpt-terrain/jul9-water-shore-mud-a-r4-c2', 58, 66, 4, 10, 3140),
    terrainZone('bone-camp-open-sand', 'sand', 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c3', 68, 92, -2, 12, 3070),
    terrainZone('bone-camp-rocky-rim', 'rocky', 'chatgpt-terrain/jul9-master-ground-terrain-a-r3-c3', 70, 94, 10, 15, 3080),
    terrainZone('warehouse-oil-asphalt', 'road', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r5-c4', 88, 104, 2, 9, 3130),
    terrainZone('warehouse-sand-asphalt-edge', 'dirt', 'chatgpt-terrain/jul9-street-asphalt-parking-a-r4-c2', 86, 106, 9, 13, 3110),
  ]);
}

function connectiveZone() {
  return freezeRecord({
    source: 'connective-fill',
    zoneId: CONNECTIVE_ZONE_ID,
    title: 'Connective Scrub',
    role: 'scrub',
    textureKey: preferredTextureKeyForRole('dirt'),
    priority: 0,
    xMin: Number.NEGATIVE_INFINITY,
    xMax: Number.POSITIVE_INFINITY,
    yMin: Number.NEGATIVE_INFINITY,
    yMax: Number.POSITIVE_INFINITY,
  });
}

function textureAssetByKey(textureKey) {
  return curatedTerrainTextureAssetByKey(textureKey)
    ?? wo103ContinuousGroundAssetByKey(textureKey)
    ?? levelOnePixellabSurfaceAssetByKey(textureKey)
    ?? finalPaintGroundAssetByKey(textureKey)
    ?? sbsGroundAssetByKey(textureKey)
    ?? null;
}

export function buildGroundPlan({ levelId = HMH_LEVEL_ONE_ID, seed = 0 } = {}) {
  const safeLevelId = levelId || HMH_LEVEL_ONE_ID;
  const zones = safeLevelId === HMH_LEVEL_ONE_ID
    ? Object.freeze([...buildChatgptTerrainZones(), ...buildCuratedZones(), ...buildPixellabZones(), connectiveZone()])
    : Object.freeze([connectiveZone()]);
  const ordered = [...zones].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const zoneAtBare = (worldX, worldY) => {
    const x = Math.round(Number(worldX) || 0);
    const y = Math.round(Number(worldY) || 0);
    return ordered.find((zone) => contains(zone, x, y)) ?? ordered[ordered.length - 1];
  };

  const borderInfoFor = (worldX, worldY, zone) => {
    const x = Math.round(Number(worldX) || 0);
    const y = Math.round(Number(worldY) || 0);
    return Object.freeze([
      ['east', x + 1, y],
      ['west', x - 1, y],
      ['south', x, y + 1],
      ['north', x, y - 1],
    ].map(([direction, nx, ny]) => {
      const neighbor = zoneAtBare(nx, ny);
      return neighbor.zoneId === zone.zoneId ? null : Object.freeze({
        direction,
        neighborZoneId: neighbor.zoneId,
        neighborRole: neighbor.role,
      });
    }).filter(Boolean));
  };

  const terrainCellCache = new Map();
  let terrainCellCacheHits = 0;
  let terrainCellCacheMisses = 0;
  const terrainCellKey = (worldX, worldY) => `${Math.round(Number(worldX) || 0)}|${Math.round(Number(worldY) || 0)}`;

  const plan = {
    levelId: safeLevelId,
    seed: Number(seed) || 0,
    zones,
    textureForKey: textureAssetByKey,
    textureKeys() {
      return Object.freeze([...new Set(zones.flatMap((zone) => textureVariantKeysForZone(zone)).filter(Boolean))]);
    },
    textureKeysNear(centerX = 0, centerY = 0, radius = 18) {
      const safeRadius = Math.max(1, Math.floor(Number(radius) || 18));
      const minX = Math.floor(Number(centerX) || 0) - safeRadius;
      const maxX = Math.ceil(Number(centerX) || 0) + safeRadius;
      const minY = Math.floor(Number(centerY) || 0) - safeRadius;
      const maxY = Math.ceil(Number(centerY) || 0) + safeRadius;
      const keys = new Set();
      for (let x = minX; x <= maxX; x += 2) {
        for (let y = minY; y <= maxY; y += 2) {
          const zone = zoneAtBare(x, y);
          keys.add(textureKeyForZoneCell(zone, x, y, seed));
        }
      }
      keys.add(textureKeyForZoneCell(zoneAtBare(centerX, centerY), centerX, centerY, seed));
      return Object.freeze([...keys].filter(Boolean));
    },
    zoneAt(worldX, worldY) {
      const zone = zoneAtBare(worldX, worldY);
      return Object.freeze({
        zoneId: zone.zoneId,
        role: zone.role,
        textureKey: textureKeyForZoneCell(zone, worldX, worldY, seed),
        borderInfo: borderInfoFor(worldX, worldY, zone),
      });
    },
    cellAt(worldX, worldY) {
      const key = terrainCellKey(worldX, worldY);
      const cached = terrainCellCache.get(key);
      if (cached) {
        terrainCellCacheHits += 1;
        return cached;
      }
      terrainCellCacheMisses += 1;
      const cell = buildTerrainBlobCell(plan, worldX, worldY);
      terrainCellCache.set(key, cell);
      return cell;
    },
    terrainCellCacheStats() {
      return Object.freeze({ size: terrainCellCache.size, hits: terrainCellCacheHits, misses: terrainCellCacheMisses });
    },
  };

  return Object.freeze(plan);
}

export function validateGroundPlanSample({ levelId = HMH_LEVEL_ONE_ID, seed = 0, width = 200, height = 200 } = {}) {
  const plan = buildGroundPlan({ levelId, seed });
  const errors = [];
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const zone = plan.zoneAt(x, y);
      if (!zone.zoneId || !zone.role || !zone.textureKey) errors.push(`missing zone data at ${x},${y}`);
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}
