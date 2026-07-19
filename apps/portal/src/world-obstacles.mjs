// Persistent, collidable world-obstacle model for Hard Money Heroes (isometric roguelike).
//
// PROBLEM THIS SOLVES: the old set-dressing drew props anchored to the player's
// CURRENT cell every frame, so the same world spot would gain/lose a prop as the
// player walked — props "disappeared" while moving, and nothing was solid (you
// could walk and shoot straight through buildings/trees).
//
// FIX: obstacles are derived deterministically from (seed, world cell) — never
// from the player position — so a given patch of world ALWAYS has the same
// buildings/trees/objects. Each obstacle carries a circular collision footprint
// at its base so the player must walk around it and bullets stop on it.
//
// This module is pure + DOM-free so it is unit-testable. The renderer and the
// movement/bullet code in main.js consume `obstaclesNear()` for both drawing and
// collision, guaranteeing draw and collision use the SAME obstacle set.

// Coarse cell size, in world tiles, for obstacle scenes. One cell hosts at most
// one "scene" (a town block, a tree cluster, a lone landmark). Large enough that
// the world breathes; small enough that a few are always on screen.
export const OBSTACLE_CELL = 7;

// Per-biome footprint radius (world tiles) for the base collision circle, and the
// kind of scene a biome produces. Buildings are big and solid; trees/rocks are
// medium; props (cans, signs, lamps) are small.
const BIOME_SCENE = Object.freeze({
  town:   { scene: 'settlement', radius: 1.15, count: [3, 5] },
  road:   { scene: 'settlement', radius: 1.05, count: [2, 4] },
  forest: { scene: 'cluster',    radius: 0.85, count: [3, 5] },
  rocky:  { scene: 'cluster',    radius: 0.95, count: [2, 4] },
  desert: { scene: 'cluster',    radius: 0.8,  count: [2, 3] },
  water:  { scene: 'cluster',    radius: 0.8,  count: [1, 2] },
});

function hashU32(a, b) {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// Deterministic obstacle list for one coarse cell. Returns [] for "open ground"
// cells so the map has breathing room. Each obstacle:
//   { id, worldX, worldY, radius, solid, kind, biome, propIndex }
// `propIndex` indexes into the biome's prop pool so the renderer can pick stable art.
export function obstaclesInCell(seed, cellX, cellY, biomeAt, opts = {}) {
  const reserveRadius = opts.spawnSafeRadius ?? 6; // keep origin clear for the player spawn
  const h = hashU32((cellX * 73856093) ^ seed, cellY * 19349663);
  // ~62% of cells host a scene; rest stay open.
  if (h % 100 >= 62) return [];
  const anchorX = cellX * OBSTACLE_CELL + (h % 5) - 2;
  const anchorY = cellY * OBSTACLE_CELL + ((h >> 3) % 5) - 2;
  const biome = biomeAt(seed, anchorX, anchorY);
  // Don't place buildings/doodads on water — it makes no sense and we have no
  // water-specific props yet. Water cells stay open (and are impassable, which
  // the movement code enforces separately).
  if (biome === 'water') return [];
  const cfg = BIOME_SCENE[biome] ?? BIOME_SCENE.town;
  const [lo, hi] = cfg.count;
  const count = lo + (h % (hi - lo + 1));
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const hi2 = hashU32((anchorX * 2654435761) ^ ((anchorY + i * 17) | 0), (i * 40503) ^ seed);
    let wx;
    let wy;
    if (cfg.scene === 'settlement') {
      // Buildings line a street: alternate sides, step along.
      const side = i % 2 === 0 ? -2 : 2;
      const along = Math.floor(i / 2) * 3 - 1;
      wx = anchorX + along;
      wy = anchorY + side;
    } else {
      // Natural cluster: tight scatter around the anchor.
      wx = anchorX + ((hi2 % 5) - 2);
      wy = anchorY + (((hi2 >> 4) % 5) - 2);
    }
    // Never place an obstacle inside the player's spawn-safe zone (around origin).
    if (Math.hypot(wx, wy) < reserveRadius) continue;
    // Skip any individual tile that resolves to water (cluster edges can stray
    // across a biome boundary into a lake/river).
    if (biomeAt(seed, wx, wy) === 'water') continue;
    out.push({
      id: `obs-${cellX}-${cellY}-${i}`,
      worldX: wx,
      worldY: wy,
      radius: cfg.radius,
      solid: true,
      kind: cfg.scene === 'settlement' ? 'building' : 'doodad',
      biome,
      propIndex: hi2 >>> 0,
    });
  }
  return out;
}

// All obstacles whose cells overlap a world window centered on (cx, cy) with the
// given half-extent (in world tiles). Used by both renderer and collision so they
// stay in lockstep. Results are stable for a given seed + world position.
export function obstaclesNear(seed, centerX, centerY, halfExtent, biomeAt, opts = {}) {
  const minCellX = Math.floor((centerX - halfExtent) / OBSTACLE_CELL);
  const maxCellX = Math.floor((centerX + halfExtent) / OBSTACLE_CELL);
  const minCellY = Math.floor((centerY - halfExtent) / OBSTACLE_CELL);
  const maxCellY = Math.floor((centerY + halfExtent) / OBSTACLE_CELL);
  const out = [];
  for (let cx = minCellX; cx <= maxCellX; cx += 1) {
    for (let cy = minCellY; cy <= maxCellY; cy += 1) {
      const cell = obstaclesInCell(seed, cx, cy, biomeAt, opts);
      for (const o of cell) out.push(o);
    }
  }
  return out;
}

// Resolve a desired player move against solid obstacles. Returns the corrected
// position so the player slides along / stops at obstacle footprints (circle vs
// circle push-out). `obstacles` should be the nearby solid set.
export function resolvePlayerCollision(fromX, fromY, toX, toY, playerRadius, obstacles) {
  let x = toX;
  let y = toY;
  let earliestFootprintHit = 1;
  for (const obstacle of obstacles) {
    if (!obstacle?.solid) continue;
    const footprint = obstacleFootprintBounds(obstacle, 1, playerRadius);
    if (!footprint) continue;
    const startsInside = fromX >= footprint.minX && fromX <= footprint.maxX
      && fromY >= footprint.minY && fromY <= footprint.maxY;
    if (startsInside) continue;
    const hitT = segmentAabbHitT(fromX, fromY, toX, toY, footprint);
    if (hitT !== null && hitT < earliestFootprintHit) earliestFootprintHit = hitT;
  }
  if (earliestFootprintHit < 1) {
    const safeT = Math.max(0, earliestFootprintHit - 1e-4);
    x = fromX + (toX - fromX) * safeT;
    y = fromY + (toY - fromY) * safeT;
  }
  for (const o of obstacles) {
    if (!o.solid) continue;
    const footprint = obstacleFootprintBounds(o, 1, playerRadius);
    if (footprint && x >= footprint.minX && x <= footprint.maxX && y >= footprint.minY && y <= footprint.maxY) {
      if (fromX < footprint.minX) x = footprint.minX;
      else if (fromX > footprint.maxX) x = footprint.maxX;
      else if (fromY < footprint.minY) y = footprint.minY;
      else if (fromY > footprint.maxY) y = footprint.maxY;
      else {
        const exits = [
          ['x', footprint.minX, Math.abs(x - footprint.minX)],
          ['x', footprint.maxX, Math.abs(footprint.maxX - x)],
          ['y', footprint.minY, Math.abs(y - footprint.minY)],
          ['y', footprint.maxY, Math.abs(footprint.maxY - y)],
        ].sort((a, b) => a[2] - b[2]);
        if (exits[0][0] === 'x') x = exits[0][1];
        else y = exits[0][1];
      }
      continue;
    }
    if (footprint) continue;
    const min = o.radius + playerRadius;
    const dx = x - o.worldX;
    const dy = y - o.worldY;
    const dist = Math.hypot(dx, dy);
    if (dist < min && dist > 1e-6) {
      // Push the player out to the obstacle's edge along the contact normal.
      const nx = dx / dist;
      const ny = dy / dist;
      x = o.worldX + nx * min;
      y = o.worldY + ny * min;
    } else if (dist <= 1e-6) {
      // Degenerate: player exactly on center — push toward the origin of motion.
      const bdx = fromX - o.worldX;
      const bdy = fromY - o.worldY;
      const bl = Math.hypot(bdx, bdy) || 1;
      x = o.worldX + (bdx / bl) * min;
      y = o.worldY + (bdy / bl) * min;
    }
  }
  return { x, y };
}

function obstacleFootprintBounds(obstacle, scale = 1, padding = 0) {
  const width = Number(obstacle?.footprintTiles?.w);
  const height = Number(obstacle?.footprintTiles?.h);
  if (!(width > 0) || !(height > 0)) return null;
  const safeScale = Math.max(0.1, Number(scale) || 1);
  const safePadding = Math.max(0, Number(padding) || 0);
  const polygonPoints = (obstacle?.collisionPolygons ?? [])
    .flatMap((polygon) => Array.isArray(polygon) ? polygon : [])
    .filter((point) => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])));
  if (polygonPoints.length >= 3) {
    const localCenterX = width * 0.5;
    const localCenterY = height * 0.5;
    const xs = polygonPoints.map((point) => localCenterX + (Number(point[0]) - localCenterX) * safeScale);
    const ys = polygonPoints.map((point) => localCenterY + (Number(point[1]) - localCenterY) * safeScale);
    const originX = obstacle.worldX - localCenterX;
    const originY = obstacle.worldY - localCenterY;
    return {
      minX: originX + Math.min(...xs) - safePadding,
      maxX: originX + Math.max(...xs) + safePadding,
      minY: originY + Math.min(...ys) - safePadding,
      maxY: originY + Math.max(...ys) + safePadding,
    };
  }
  const halfW = width * safeScale * 0.5 + safePadding;
  const halfH = height * safeScale * 0.5 + safePadding;
  return {
    minX: obstacle.worldX - halfW,
    maxX: obstacle.worldX + halfW,
    minY: obstacle.worldY - halfH,
    maxY: obstacle.worldY + halfH,
  };
}

function segmentAabbHitT(fromX, fromY, toX, toY, bounds) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  let tMin = 0;
  let tMax = 1;
  for (const [start, delta, min, max] of [
    [fromX, dx, bounds.minX, bounds.maxX],
    [fromY, dy, bounds.minY, bounds.maxY],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    const a = (min - start) / delta;
    const b = (max - start) / delta;
    tMin = Math.max(tMin, Math.min(a, b));
    tMax = Math.min(tMax, Math.max(a, b));
    if (tMin > tMax) return null;
  }
  return tMin;
}

function segmentCircleHitT(fromX, fromY, toX, toY, centerX, centerY, radius) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 1e-9
    ? Math.max(0, Math.min(1, ((centerX - fromX) * dx + (centerY - fromY) * dy) / lengthSq))
    : 0;
  const x = fromX + dx * t;
  const y = fromY + dy * t;
  return Math.hypot(x - centerX, y - centerY) <= radius ? t : null;
}

export function drawRectIntersectsViewport(rect, viewport, overscan = 0) {
  const x = Number(rect?.x) || 0;
  const y = Number(rect?.y) || 0;
  const width = Math.max(0, Number(rect?.width) || 0);
  const height = Math.max(0, Number(rect?.height) || 0);
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const margin = Math.max(0, Number(overscan) || 0);
  return x + width >= -margin
    && y + height >= -margin
    && x <= viewportWidth + margin
    && y <= viewportHeight + margin;
}

export function circleTargetHitAlongSegment(fromX, fromY, toX, toY, targets, { defaultRadius = 0.72, excludedTargets = null } = {}) {
  let nearest = null;
  let nearestT = Infinity;
  for (const target of targets ?? []) {
    if (!target || Number(target.hp) <= 0) continue;
    if (excludedTargets?.has?.(target)) continue;
    const centerX = Number(target.mapX ?? target.worldX ?? target.x);
    const centerY = Number(target.mapY ?? target.worldY ?? target.y);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) continue;
    const radius = Math.max(0.05, Number(target.hitRadius ?? target.radius ?? defaultRadius) || defaultRadius);
    const t = segmentCircleHitT(fromX, fromY, toX, toY, centerX, centerY, radius);
    if (t !== null && t < nearestT) {
      nearest = target;
      nearestT = t;
    }
  }
  return nearest;
}

// Does a point (e.g. a bullet) hit any solid obstacle? Returns the obstacle hit,
// or null. Uses a slightly smaller hit radius than the player footprint so
// bullets visually impact the body rather than empty air around it.
export function obstacleHitAt(worldX, worldY, obstacles, hitScale = 0.82) {
  for (const o of obstacles) {
    if (!o.solid) continue;
    const footprint = obstacleFootprintBounds(o, Math.max(0.9, hitScale));
    if (footprint && worldX >= footprint.minX && worldX <= footprint.maxX && worldY >= footprint.minY && worldY <= footprint.maxY) {
      return o;
    }
    if (Math.hypot(worldX - o.worldX, worldY - o.worldY) < o.radius * hitScale) {
      return o;
    }
  }
  return null;
}

export function obstacleHitAlongSegment(fromX, fromY, toX, toY, obstacles, hitScale = 0.82) {
  let nearest = null;
  let nearestT = Infinity;
  for (const obstacle of obstacles) {
    if (!obstacle?.solid) continue;
    const footprint = obstacleFootprintBounds(obstacle, Math.max(0.9, hitScale));
    const t = footprint
      ? segmentAabbHitT(fromX, fromY, toX, toY, footprint)
      : segmentCircleHitT(fromX, fromY, toX, toY, obstacle.worldX, obstacle.worldY, obstacle.radius * hitScale);
    if (t !== null && t < nearestT) {
      nearest = obstacle;
      nearestT = t;
    }
  }
  return nearest;
}

// Water is impassable. Returns true if the given world tile resolves to a water
// biome, so the movement code can block the player from walking onto it.
export function isWaterAt(seed, worldX, worldY, biomeAt) {
  return biomeAt(seed, Math.round(worldX), Math.round(worldY)) === 'water';
}

function isDryAt(seed, worldX, worldY, biomeAt) {
  return typeof biomeAt !== 'function' || !isWaterAt(seed, worldX, worldY, biomeAt);
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeWorldBounds(worldBounds = null) {
  if (!worldBounds) return null;
  const width = finiteOr(worldBounds.width, null);
  const height = finiteOr(worldBounds.height, null);
  const minX = finiteOr(worldBounds.minX, Number.isFinite(width) ? -width / 2 : -Infinity);
  const maxX = finiteOr(worldBounds.maxX, Number.isFinite(width) ? width / 2 : Infinity);
  const minY = finiteOr(worldBounds.minY, Number.isFinite(height) ? -height / 2 : -Infinity);
  const maxY = finiteOr(worldBounds.maxY, Number.isFinite(height) ? height / 2 : Infinity);
  return { minX, maxX, minY, maxY };
}

function insideWorldBounds(x, y, bounds) {
  if (!bounds) return true;
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

function clampToWorldBounds(x, y, bounds) {
  if (!bounds) return { x, y, boundsAdjusted: false };
  const bx = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const by = Math.max(bounds.minY, Math.min(y, bounds.maxY));
  return { x: bx, y: by, boundsAdjusted: bx !== x || by !== y };
}

// Find the closest dry tile for initial player placement. The runtime can no
// longer assume world origin is land: some seeded campaign layouts put (0,0) in
// water, and water collision intentionally keeps the player stuck if their
// starting point is already wet. This deterministic ring search moves the hero
// to the nearest dry shoreline before the run starts.
export function findNearestDrySpawn(seed, desiredX = 0, desiredY = 0, biomeAt, opts = {}) {
  const startX = finiteOr(desiredX, 0);
  const startY = finiteOr(desiredY, 0);
  if (isDryAt(seed, startX, startY, biomeAt)) {
    return { x: startX, y: startY, distance: 0, adjusted: false, found: true };
  }

  const step = Math.max(0.5, finiteOr(opts.step, 1));
  const maxRadius = Math.max(step, finiteOr(opts.maxRadius, 48));
  const candidateCount = Math.max(8, Math.round(finiteOr(opts.candidateCount, 32)));
  const startIndex = Math.abs(seed | 0) % candidateCount;
  for (let radius = step; radius <= maxRadius + 1e-6; radius += step) {
    for (let i = 0; i < candidateCount; i += 1) {
      const angle = (((i + startIndex) % candidateCount) / candidateCount) * Math.PI * 2;
      const x = startX + Math.cos(angle) * radius;
      const y = startY + Math.sin(angle) * radius;
      if (isDryAt(seed, x, y, biomeAt)) {
        return { x, y, distance: Math.hypot(x - startX, y - startY), adjusted: true, found: true };
      }
    }
  }

  return { x: startX, y: startY, distance: 0, adjusted: false, found: false };
}

// Enemies and mini-bosses must enter from a visible distance, never on the hero.
// If authored slots or caller-provided coordinates are too close/wet, search a
// deterministic dry ring around the player. The hard fallback still preserves
// the minimum distance even in pathological all-water test stubs.
export function resolveDistantSpawnPosition({
  seed = 0,
  playerX = 0,
  playerY = 0,
  desiredX = 0,
  desiredY = 0,
  minDistance = 8,
  fallbackAngleRadians = 0,
  fallbackRadiusTiles = 10,
  biomeAt,
  worldBounds = null,
  maxAttempts = 48,
} = {}) {
  const px = finiteOr(playerX, 0);
  const py = finiteOr(playerY, 0);
  const dx = finiteOr(desiredX, px);
  const dy = finiteOr(desiredY, py);
  const bounds = normalizeWorldBounds(worldBounds);
  const min = Math.max(0, finiteOr(minDistance, 8));
  const desiredDistance = Math.hypot(dx - px, dy - py);
  if (desiredDistance >= min && insideWorldBounds(dx, dy, bounds) && isDryAt(seed, dx, dy, biomeAt)) {
    return { x: dx, y: dy, distance: desiredDistance, adjusted: false, boundsAdjusted: false, found: true };
  }

  const baseAngle = Number.isFinite(fallbackAngleRadians)
    ? fallbackAngleRadians
    : (desiredDistance > 1e-6 ? Math.atan2(dy - py, dx - px) : 0);
  const baseRadius = Math.max(min, finiteOr(fallbackRadiusTiles, min), desiredDistance);
  const attempts = Math.max(1, Math.round(finiteOr(maxAttempts, 48)));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const desiredBoundsAdjusted = bounds ? !insideWorldBounds(dx, dy, bounds) : false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ring = Math.floor(attempt / 16);
    const radius = baseRadius + ring * 2;
    const angle = attempt === 0 ? baseAngle : baseAngle + attempt * goldenAngle;
    const x = px + Math.cos(angle) * radius;
    const y = py + Math.sin(angle) * radius;
    if (!insideWorldBounds(x, y, bounds)) continue;
    const distance = Math.hypot(x - px, y - py);
    if (distance >= min && isDryAt(seed, x, y, biomeAt)) {
      return { x, y, distance, adjusted: true, boundsAdjusted: desiredBoundsAdjusted, found: true };
    }
  }

  const fallback = clampToWorldBounds(px + Math.cos(baseAngle) * min, py + Math.sin(baseAngle) * min, bounds);
  return {
    x: fallback.x,
    y: fallback.y,
    distance: Math.hypot(fallback.x - px, fallback.y - py),
    adjusted: true,
    boundsAdjusted: desiredBoundsAdjusted || fallback.boundsAdjusted,
    found: false,
  };
}

// Resolve a desired move against blocked terrain with a continuous actor sweep.
// The historical name remains for API compatibility, but Blueprint v3 maps every
// blocked terrain class (water, cliffs, mountains, perimeter) to this resolver.
export function resolveWaterCollision(seed, fromX, fromY, toX, toY, biomeAt, { radius = 0, maxStep = 0.2 } = {}) {
  const safeRadius = Math.max(0, finiteOr(radius, 0));
  const safeStep = Math.max(0.05, Math.min(0.5, finiteOr(maxStep, 0.2)));
  const blockedAt = (x, y) => {
    if (isWaterAt(seed, x, y, biomeAt)) return true;
    if (safeRadius <= 0) return false;
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      if (isWaterAt(seed, x + Math.cos(angle) * safeRadius, y + Math.sin(angle) * safeRadius, biomeAt)) return true;
    }
    return false;
  };
  const sweep = (startX, startY, endX, endY) => {
    const dx = endX - startX;
    const dy = endY - startY;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / safeStep));
    let lastSafe = { x: startX, y: startY };
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const point = { x: startX + dx * t, y: startY + dy * t };
      if (blockedAt(point.x, point.y)) return { blocked: true, lastSafe };
      lastSafe = point;
    }
    return { blocked: false, lastSafe: { x: endX, y: endY } };
  };

  const direct = sweep(fromX, fromY, toX, toY);
  if (!direct.blocked) return direct.lastSafe;

  const candidates = [];
  const xOnly = sweep(fromX, fromY, toX, fromY);
  if (!xOnly.blocked && Math.abs(toX - fromX) > 1e-6) candidates.push(xOnly.lastSafe);
  const yOnly = sweep(fromX, fromY, fromX, toY);
  if (!yOnly.blocked && Math.abs(toY - fromY) > 1e-6) candidates.push(yOnly.lastSafe);
  if (!candidates.length) return direct.lastSafe;
  candidates.sort((a, b) => Math.hypot(b.x - fromX, b.y - fromY) - Math.hypot(a.x - fromX, a.y - fromY));
  return candidates[0];
}

export function resolveBoundedAiMove({
  seed = 0,
  fromX = 0,
  fromY = 0,
  toX = 0,
  toY = 0,
  radius = 0.4,
  obstacles = [],
  biomeAt,
  worldBounds = null,
} = {}) {
  const startX = finiteOr(fromX, 0);
  const startY = finiteOr(fromY, 0);
  const desiredX = finiteOr(toX, startX);
  const desiredY = finiteOr(toY, startY);
  const bounds = normalizeWorldBounds(worldBounds);
  const afterObstacles = resolvePlayerCollision(startX, startY, desiredX, desiredY, Math.max(0.1, finiteOr(radius, 0.4)), Array.isArray(obstacles) ? obstacles : []);
  const terrain = resolveWaterCollision(seed, startX, startY, afterObstacles.x, afterObstacles.y, biomeAt, { radius: Math.max(0.1, finiteOr(radius, 0.4)) });
  const bounded = clampToWorldBounds(terrain.x, terrain.y, bounds);
  const obstacleAdjusted = afterObstacles.x !== desiredX || afterObstacles.y !== desiredY;
  const terrainAdjusted = terrain.x !== afterObstacles.x || terrain.y !== afterObstacles.y;
  return {
    x: Number(bounded.x.toFixed(3)),
    y: Number(bounded.y.toFixed(3)),
    obstacleAdjusted,
    terrainAdjusted,
    boundsAdjusted: bounded.boundsAdjusted,
    adjusted: obstacleAdjusted || terrainAdjusted || bounded.boundsAdjusted,
  };
}

export function resolveTrackingAiMove({
  targetX = 0,
  targetY = 0,
  detourSide = 1,
  ...move
} = {}) {
  const startX = finiteOr(move.fromX, 0);
  const startY = finiteOr(move.fromY, 0);
  const desiredX = finiteOr(move.toX, startX);
  const desiredY = finiteOr(move.toY, startY);
  const requestedDistance = Math.hypot(desiredX - startX, desiredY - startY);
  const direct = resolveBoundedAiMove({ ...move, fromX: startX, fromY: startY, toX: desiredX, toY: desiredY });
  const directDistance = Math.hypot(direct.x - startX, direct.y - startY);
  const directProgress = requestedDistance > 1e-6
    ? ((direct.x - startX) * (desiredX - startX) + (direct.y - startY) * (desiredY - startY)) / requestedDistance
    : 0;
  if (requestedDistance <= 1e-6 || directProgress >= requestedDistance * 0.45) return { ...direct, detoured: false };

  const targetDx = finiteOr(targetX, desiredX) - startX;
  const targetDy = finiteOr(targetY, desiredY) - startY;
  const targetLength = Math.hypot(targetDx, targetDy) || 1;
  const forwardX = targetDx / targetLength;
  const forwardY = targetDy / targetLength;
  const preferredSide = detourSide < 0 ? -1 : 1;
  const detourX = forwardX * 0.24 + (-forwardY) * preferredSide * 0.97;
  const detourY = forwardY * 0.24 + forwardX * preferredSide * 0.97;
  const detourLength = Math.hypot(detourX, detourY) || 1;
  const candidate = resolveBoundedAiMove({
    ...move,
    fromX: startX,
    fromY: startY,
    toX: startX + (detourX / detourLength) * requestedDistance,
    toY: startY + (detourY / detourLength) * requestedDistance,
  });
  const moved = Math.hypot(candidate.x - startX, candidate.y - startY);
  return moved >= requestedDistance * 0.2
    ? { ...candidate, detoured: true }
    : { ...direct, detoured: false };
}

