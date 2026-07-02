import { HMH_LEVEL_ONE_SBS_GROUND, sbsGroundAssetByKey } from '../assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs';
import { HMH_LEVEL_ONE_FINAL_PAINT_GROUND, finalPaintGroundAssetByKey } from '../assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.mjs';

export const HMH_LEVEL_ONE_ID = 'level-1-crypto-wasteland';

const PIXELLAB_SURFACE_PREFIX = './assets/generated/hmh-coherent-world/level1-reference-style/candidates';

function pixellabSurface(key, manifestKey, role, data = {}) {
  return Object.freeze({
    key: `pixellab-surface/${key}`,
    manifestKey,
    src: `${PIXELLAB_SURFACE_PREFIX}/${manifestKey}.png`,
    width: data.width ?? 128,
    height: data.height ?? 128,
    role,
    source: 'pixellab-candidate-runtime-surface',
    notes: data.notes ?? 'PixelLab candidate terrain/path asset wired into authored Level 1 surface zoning.',
  });
}

export const LEVEL_1_PIXELLAB_SURFACE_ASSETS = Object.freeze([
  pixellabSurface('broken-highway-lane', 'roads-and-paths/roads-and-paths__broken-highway-lane', 'road', { width: 128, height: 128 }),
  pixellabSurface('gas-station-forecourt-concrete', 'roads-and-paths/roads-and-paths__gas-station-forecourt-concrete', 'road', { width: 128, height: 128 }),
  pixellabSurface('ghost-town-cobble-dirt', 'roads-and-paths/roads-and-paths__ghost-town-main-street-cobble-dirt-blend', 'road', { width: 128, height: 128 }),
  pixellabSurface('farm-road-spur', 'roads-and-paths/roads-and-paths__farm-road-spur', 'road', { width: 128, height: 128 }),
  pixellabSurface('bridge-planks-regenerated', 'regenerated-terrain/bridge-planks-regenerated', 'bridge', { width: 128, height: 128 }),
  pixellabSurface('extraction-flare-road-regenerated', 'regenerated-terrain/extraction-flare-road-regenerated', 'road', { width: 128, height: 128 }),
  pixellabSurface('boss-yard-scorched-ground', 'ground-textures/ground-textures__boss-yard-scorched-ground', 'rocky', { width: 128, height: 128 }),
  pixellabSurface('worn-grass-clean', 'regenerated-terrain/worn-grass-clean-regenerated', 'grass', { width: 128, height: 128 }),
  pixellabSurface('animated-river-strip', 'water-and-shorelines/water-and-shorelines__animated-river-strip', 'water', { width: 128, height: 128 }),
  pixellabSurface('rocky-bank', 'water-and-shorelines/water-and-shorelines__rocky-bank', 'shore', { width: 128, height: 128 }),
]);

const PIXELLAB_SURFACE_ASSET_BY_KEY = new Map(LEVEL_1_PIXELLAB_SURFACE_ASSETS.map((asset) => [asset.key, asset]));

function surfaceZone(id, assetKey, xMin, xMax, yMin, yMax, data = {}) {
  return Object.freeze({
    id,
    assetKey,
    xMin,
    xMax,
    yMin,
    yMax,
    districtId: data.districtId,
    routeBeat: data.routeBeat,
    priority: data.priority ?? 0,
  });
}

export const LEVEL_1_PIXELLAB_SURFACE_ZONES = Object.freeze([
  surfaceZone('spawn-broken-highway-patch', 'pixellab-surface/broken-highway-lane', 4, 7, 4, 6, { districtId: 'desert-approach', routeBeat: 'spawn', priority: 20 }),
  surfaceZone('gas-station-forecourt-pad', 'pixellab-surface/gas-station-forecourt-concrete', 8, 13, 4, 7, { districtId: 'desert-approach', routeBeat: 'arena', priority: 18 }),
  surfaceZone('ghost-town-mainstreet-cobble', 'pixellab-surface/ghost-town-cobble-dirt', 37, 44, 5, 7, { districtId: 'ghost-town', routeBeat: 'arena', priority: 18 }),
  surfaceZone('river-bridge-planks', 'pixellab-surface/bridge-planks-regenerated', 60, 63, 5, 6, { districtId: 'country-road', routeBeat: 'chokepoint', priority: 25 }),
  surfaceZone('river-water-strip', 'pixellab-surface/animated-river-strip', 60, 64, 7, 8, { districtId: 'country-road', routeBeat: 'chokepoint', priority: 24 }),
  surfaceZone('river-rocky-bank', 'pixellab-surface/rocky-bank', 59, 65, 4, 5, { districtId: 'country-road', routeBeat: 'chokepoint', priority: 16 }),
  surfaceZone('farm-road-spur', 'pixellab-surface/farm-road-spur', 76, 80, 5, 7, { districtId: 'residential-edge', routeBeat: 'loop', priority: 17 }),
  surfaceZone('farm-worn-grass', 'pixellab-surface/worn-grass-clean', 81, 86, 5, 8, { districtId: 'residential-edge', routeBeat: 'loop', priority: 16 }),
  surfaceZone('boss-yard-scorched-pad', 'pixellab-surface/boss-yard-scorched-ground', 89, 94, 5, 7, { districtId: 'inner-city-threshold', routeBeat: 'boss', priority: 22 }),
  surfaceZone('extraction-flare-road-pad', 'pixellab-surface/extraction-flare-road-regenerated', 96, 100, 4, 6, { districtId: 'inner-city-threshold', routeBeat: 'extract', priority: 23 }),
]);

const THEME_ROLE = Object.freeze({
  pavement: 'road',
  carpet: 'road',
  grass: 'grass',
  sand: 'sand',
});

const BIOME_ROLE = Object.freeze({
  town: 'road',
  road: 'road',
  pavement: 'road',
  desert: 'sand',
  sand: 'sand',
  forest: 'grass',
  grass: 'grass',
  rocky: 'rocky',
  water: 'water',
});

function stableIndex(seed, worldX, worldY, count) {
  if (!count) return 0;
  let h = (Math.round(worldX) * 374761393) ^ (Math.round(worldY) * 668265263) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return Math.abs(h) % count;
}

function roleKeysFrom(manifest, role) {
  return manifest.roles?.[role] ?? [];
}

function finalPaintRoleKeys(role) {
  return roleKeysFrom(HMH_LEVEL_ONE_FINAL_PAINT_GROUND, role);
}

function sbsRoleKeys(role) {
  return roleKeysFrom(HMH_LEVEL_ONE_SBS_GROUND, role);
}

function preferredKey(keys, lookup) {
  const preferred = keys.find((key) => lookup(key)?.preferred);
  return preferred ?? keys[0] ?? null;
}

export function levelOnePixellabSurfaceAssetByKey(key) {
  return PIXELLAB_SURFACE_ASSET_BY_KEY.get(key) ?? null;
}

export function levelOnePixellabSurfaceAssetForTile({ worldX = 0, worldY = 0 } = {}) {
  const x = Math.round(worldX);
  const y = Math.round(worldY);
  const zone = LEVEL_1_PIXELLAB_SURFACE_ZONES
    .filter((item) => x >= item.xMin && x <= item.xMax && y >= item.yMin && y <= item.yMax)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  if (!zone) return null;
  const asset = levelOnePixellabSurfaceAssetByKey(zone.assetKey);
  return asset ? Object.freeze({ ...asset, zoneId: zone.id, districtId: zone.districtId, routeBeat: zone.routeBeat }) : null;
}

export function levelOneGroundRoleForTile({ biome, theme = null, neighbors = [] } = {}) {
  const neighborSet = new Set((neighbors ?? []).filter(Boolean));
  if (biome === 'water') return 'water';

  if (neighborSet.has('water')) {
    if (biome === 'desert' || theme === 'sand') return 'shore';
    if (biome === 'forest' || theme === 'grass') return 'shore';
    if (biome === 'rocky') return 'shore';
    return 'shore';
  }

  const base = THEME_ROLE[theme] ?? BIOME_ROLE[biome] ?? 'dirt';
  if ((base === 'grass' && (neighborSet.has('desert') || neighborSet.has('sand')))
    || (base === 'sand' && (neighborSet.has('forest') || neighborSet.has('grass')))) {
    return 'grass-to-sand';
  }
  if ((base === 'grass' && (neighborSet.has('road') || neighborSet.has('town')))
    || (base === 'road' && (neighborSet.has('forest') || neighborSet.has('grass')))) {
    return 'grass-to-dirt';
  }
  if ((base === 'sand' && (neighborSet.has('road') || neighborSet.has('town') || neighborSet.has('rocky')))
    || (base === 'road' && (neighborSet.has('desert') || neighborSet.has('sand')))) {
    return 'dirt-to-sand';
  }
  return base;
}

export function selectLevelOneGroundTile({
  levelId = HMH_LEVEL_ONE_ID,
  seed = 0,
  worldX = 0,
  worldY = 0,
  biome = 'town',
  theme = null,
  neighbors = [],
} = {}) {
  if (levelId !== HMH_LEVEL_ONE_ID) return null;
  const pixellabSurface = levelOnePixellabSurfaceAssetForTile({ worldX, worldY });
  if (pixellabSurface) return pixellabSurface;

  const role = levelOneGroundRoleForTile({ biome, theme, neighbors });
  const finalKeys = finalPaintRoleKeys(role);
  const fallbackKeys = sbsRoleKeys(role);
  const keys = finalKeys.length ? finalKeys : fallbackKeys;
  const lookup = finalKeys.length ? finalPaintGroundAssetByKey : sbsGroundAssetByKey;
  if (!keys.length) return null;

  // Keep the preferred art dominant. Accent variants appear in broad patches so
  // the terrain reads hand-authored, not checkerboard-noisy.
  const patchX = Math.floor(worldX / 5);
  const patchY = Math.floor(worldY / 5);
  const accent = keys.length > 1 && stableIndex(seed, patchX, patchY, 100) < 18;
  const key = accent ? keys[stableIndex(seed + 17, patchX, patchY, keys.length)] : preferredKey(keys, lookup);
  const asset = lookup(key) ?? lookup(preferredKey(keys, lookup));
  if (asset) return Object.freeze({ ...asset, role, fallback: finalKeys.length ? 'sbs-cc0' : null });

  const fallbackKey = preferredKey(fallbackKeys, sbsGroundAssetByKey);
  const fallbackAsset = sbsGroundAssetByKey(fallbackKey);
  return fallbackAsset ? Object.freeze({ ...fallbackAsset, role, fallback: null }) : null;
}

export function requiredLevelOneGroundRoles() {
  return Object.freeze(['grass', 'dirt', 'sand', 'rocky', 'water', 'shore', 'grass-to-dirt', 'dirt-to-sand']);
}
