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
  HMH_CURATED_LEVEL_ART,
} from '../assets/generated/hmh-curated-level-art/hmh-curated-level-art.mjs';

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
  grass: 'chatgpt-terrain/jul9-master-ground-terrain-a-r1-c1',
  dirt: 'chatgpt-terrain/jul9-master-ground-terrain-a-r2-c2',
  sand: 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c3',
  rocky: 'chatgpt-terrain/jul9-master-ground-terrain-a-r3-c3',
  road: 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c2',
  bridge: 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c4',
  shore: 'chatgpt-terrain/jul9-transition-ground-edges-a-r4-c1',
  water: 'chatgpt-terrain/jul9-transition-ground-edges-a-r4-c2',
  'grass-to-dirt': 'chatgpt-terrain/jul9-transition-ground-edges-a-r1-c3',
  'dirt-to-sand': 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c2',
  'grass-to-road': 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c1',
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

const CHATGPT_TERRAIN_ASSET_BY_KEY = new Map((HMH_CURATED_LEVEL_ART.groundTextures ?? []).map((asset) => [asset.key, Object.freeze({
  ...asset,
  source: asset.source ?? 'justin-chatgpt-map-tile-sheet',
  notes: asset.notes ?? 'Justin-approved ChatGPT Image map tile sheet, sliced into an opaque runtime terrain texture.',
})]));

function curatedTerrainTextureAssetByKey(key) {
  return CHATGPT_TERRAIN_ASSET_BY_KEY.get(key) ?? null;
}

function curatedTextureKeysForRole(role) {
  const normalized = normalizeRole(role);
  return HMH_CURATED_LEVEL_ART.terrainRoles?.[normalized] ?? [];
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
  return [zone.textureKey, ...curatedTextureKeysForRole(zone.role)]
    .filter((key, index, keys) => key?.startsWith('chatgpt-terrain/') && keys.indexOf(key) === index)
    .slice(0, 9);
}

function textureKeyForZoneCell(zone, worldX, worldY, seed) {
  const variants = textureVariantKeysForZone(zone);
  if (variants.length <= 1) return zone.textureKey;
  const blockX = Math.floor(Math.round(Number(worldX) || 0) / 2);
  const blockY = Math.floor(Math.round(Number(worldY) || 0) / 2);
  return variants[((blockX * 31 + blockY * 131 + String(zone.zoneId).length * 17 + (Number(seed) || 0)) >>> 0) % variants.length];
}

function buildChatgptTerrainZones() {
  return Object.freeze([
    terrainZone('spawn-clear-blacktop-centerline', 'road', 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c2', -16, 22, 4, 6, 3100),
    terrainZone('spawn-grass-road-north-shoulder', 'grass-to-dirt', 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c1', -12, 24, 2, 3, 3095),
    terrainZone('spawn-sand-road-south-shoulder', 'dirt-to-sand', 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c2', -12, 26, 7, 9, 3095),
    terrainZone('spawn-dirt-scrub-outfield', 'dirt', 'chatgpt-terrain/jul9-master-ground-terrain-a-r2-c2', -18, 30, -4, 12, 3000),
    terrainZone('ghost-town-cracked-asphalt-core', 'road', 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c3', 28, 54, -1, 12, 3120),
    terrainZone('ghost-town-mossy-curb-edge', 'grass-to-dirt', 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c1', 28, 54, 11, 14, 3110),
    terrainZone('country-grass-megapath', 'grass', 'chatgpt-terrain/jul9-master-ground-terrain-a-r1-c1', 50, 88, -2, 13, 3080),
    terrainZone('country-puddle-lowlands', 'shore', 'chatgpt-terrain/jul9-transition-ground-edges-a-r4-c4', 55, 74, 9, 13, 3090),
    terrainZone('river-bridge-planks', 'road', 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c3', 60, 64, 5, 6, 3165),
    terrainZone('blackwater-ford-water-ribbon', 'water', 'chatgpt-terrain/jul9-transition-ground-edges-a-r4-c2', 60, 64, 6, 9, 3150),
    terrainZone('blackwater-ford-grass-shore', 'shore', 'chatgpt-terrain/jul9-transition-ground-edges-a-r4-c1', 58, 66, 4, 10, 3140),
    terrainZone('bone-camp-open-sand', 'sand', 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c3', 68, 92, -2, 12, 3070),
    terrainZone('bone-camp-rocky-rim', 'rocky', 'chatgpt-terrain/jul9-master-ground-terrain-a-r3-c3', 70, 94, 10, 15, 3080),
    terrainZone('warehouse-oil-asphalt', 'road', 'chatgpt-terrain/jul9-transition-ground-edges-a-r2-c4', 88, 104, 2, 9, 3130),
    terrainZone('warehouse-sand-asphalt-edge', 'dirt-to-sand', 'chatgpt-terrain/jul9-master-ground-terrain-a-r4-c2', 86, 106, 9, 13, 3110),
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
