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
  HMH_LEVEL_ONE_SBS_GROUND,
  sbsGroundAssetByKey,
} from '../assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs';

const CONNECTIVE_ZONE_ID = 'connective-scrub';

const ROLE_ALIASES = Object.freeze({
  bridge: 'road',
  scrub: 'dirt',
  route: 'road',
  pavement: 'road',
  rocky: 'rocky',
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

function manifestKeysForRole(role) {
  const normalized = normalizeRole(role);
  const finalKeys = HMH_LEVEL_ONE_FINAL_PAINT_GROUND.roles?.[normalized] ?? [];
  if (finalKeys.length) return { keys: finalKeys, lookup: finalPaintGroundAssetByKey };
  const sbsKeys = HMH_LEVEL_ONE_SBS_GROUND.roles?.[normalized] ?? [];
  if (sbsKeys.length) return { keys: sbsKeys, lookup: sbsGroundAssetByKey };
  const fallbackKeys = HMH_LEVEL_ONE_FINAL_PAINT_GROUND.roles?.dirt ?? HMH_LEVEL_ONE_SBS_GROUND.roles?.dirt ?? [];
  return { keys: fallbackKeys, lookup: finalPaintGroundAssetByKey };
}

function preferredTextureKeyForRole(role) {
  const { keys, lookup } = manifestKeysForRole(role);
  if (!keys.length) return 'final-paint/dirt-handpaint-01';
  return keys.find((key) => lookup(key)?.preferred) ?? keys[0];
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
      textureKey: asset?.key ?? preferredTextureKeyForRole(role),
      priority: 500 + (zone.priority ?? 0),
      xMin: zone.xMin,
      xMax: zone.xMax,
      yMin: zone.yMin,
      yMax: zone.yMax,
    });
  });
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
  return levelOnePixellabSurfaceAssetByKey(textureKey)
    ?? finalPaintGroundAssetByKey(textureKey)
    ?? sbsGroundAssetByKey(textureKey)
    ?? null;
}

export function buildGroundPlan({ levelId = HMH_LEVEL_ONE_ID, seed = 0 } = {}) {
  const safeLevelId = levelId || HMH_LEVEL_ONE_ID;
  const zones = safeLevelId === HMH_LEVEL_ONE_ID
    ? Object.freeze([...buildCuratedZones(), ...buildPixellabZones(), connectiveZone()])
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

  return Object.freeze({
    levelId: safeLevelId,
    seed: Number(seed) || 0,
    zones,
    textureForKey: textureAssetByKey,
    zoneAt(worldX, worldY) {
      const zone = zoneAtBare(worldX, worldY);
      return Object.freeze({
        zoneId: zone.zoneId,
        role: zone.role,
        textureKey: zone.textureKey,
        borderInfo: borderInfoFor(worldX, worldY, zone),
      });
    },
  });
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
