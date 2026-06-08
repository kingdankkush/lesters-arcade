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
  for (const o of obstacles) {
    if (!o.solid) continue;
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

// Does a point (e.g. a bullet) hit any solid obstacle? Returns the obstacle hit,
// or null. Uses a slightly smaller hit radius than the player footprint so
// bullets visually impact the body rather than empty air around it.
export function obstacleHitAt(worldX, worldY, obstacles, hitScale = 0.82) {
  for (const o of obstacles) {
    if (!o.solid) continue;
    if (Math.hypot(worldX - o.worldX, worldY - o.worldY) < o.radius * hitScale) {
      return o;
    }
  }
  return null;
}
