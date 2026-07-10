const DEFAULT_ROAD_INDEX_RADIUS = 280;
const WATER_ROLES = new Set(['water', 'deep-water', 'rapid-water']);
const SHALLOW_ZONE_PATTERN = /(?:shallow|ford|wade|creek-crossing)/i;

export function levelOneRoadTileKey(x, y) {
  return (Math.round(Number(x) || 0) + 8192) * 16384 + (Math.round(Number(y) || 0) + 8192);
}

export function buildLevelOneRoadTileIndex({
  roadNetwork = [],
  groundPlan,
  shiftX = 0,
  shiftY = 0,
  radius = DEFAULT_ROAD_INDEX_RADIUS,
} = {}) {
  const index = new Map();
  if (!Array.isArray(roadNetwork) || !groundPlan?.zoneAt) return index;
  const limit = Math.max(1, Number(radius) || DEFAULT_ROAD_INDEX_RADIUS);
  for (const road of roadNetwork) {
    const path = Array.isArray(road?.path) ? road.path : [];
    for (const point of path) {
      const x = Math.round((Number(point?.x) || 0) - (Number(shiftX) || 0));
      const y = Math.round((Number(point?.y) || 0) - (Number(shiftY) || 0));
      if (Math.abs(x) > limit || Math.abs(y) > limit) continue;
      const key = levelOneRoadTileKey(x, y);
      if (index.has(key)) continue;
      const terrain = groundPlan.zoneAt(x, y);
      index.set(key, Object.freeze({
        x,
        y,
        role: terrain?.role ?? 'dirt',
        zoneId: terrain?.zoneId ?? 'unknown',
        type: WATER_ROLES.has(terrain?.role) ? 'bridge' : 'road',
      }));
    }
  }
  return index;
}

export function classifyLevelOneTraversal({ groundPlan, roadTileIndex, worldX = 0, worldY = 0 } = {}) {
  const x = Math.round(Number(worldX) || 0);
  const y = Math.round(Number(worldY) || 0);
  const terrain = groundPlan?.zoneAt?.(x, y) ?? { zoneId: 'unknown', role: 'dirt' };
  const role = String(terrain.role || 'dirt');
  const route = roadTileIndex?.get?.(levelOneRoadTileKey(x, y)) ?? null;
  const shallow = WATER_ROLES.has(role) && SHALLOW_ZONE_PATTERN.test(String(terrain.zoneId || ''));
  const crossing = route ? route.type : shallow ? 'shallow' : null;
  const blocked = WATER_ROLES.has(role) && !crossing;
  return Object.freeze({
    x,
    y,
    zoneId: terrain.zoneId ?? 'unknown',
    role,
    blocked,
    crossing,
    collisionBiome: blocked ? 'water' : role === 'water' ? 'shore' : role,
  });
}

export function createLevelOneCollisionBiomeResolver({ groundPlan, roadTileIndex } = {}) {
  return (_seed, worldX, worldY) => classifyLevelOneTraversal({
    groundPlan,
    roadTileIndex,
    worldX,
    worldY,
  }).collisionBiome;
}
