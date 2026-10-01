// Deterministic per-area ground control field for the ten-area splat shader.
// Pure data in, RGBA bytes out: R = secondary material weight, G = accent
// material weight, B = broad value variation (128 neutral), A = light
// multiplier (0..255 maps to 0.55..1.2, 176 neutral). Hash noise only; the
// simulation RNG is never touched and nothing here reads or writes collision,
// navigation, spawning or results. Lives in the lazy area-art chunk.
import { pointInPolygon, distanceToSegment, distanceToPolyline, polygonBounds, rectVertices } from './world-v2-area-art-schema.mjs';

export const TERRAIN_FIELD_ID = 'world-v2-terrain-field/v1';
export const TERRAIN_LIGHT_RANGE = Object.freeze({ low: 0.55, high: 1.2 });
const LIGHT_NEUTRAL = (1 - TERRAIN_LIGHT_RANGE.low) / (TERRAIN_LIGHT_RANGE.high - TERRAIN_LIGHT_RANGE.low);

// Integer lattice hash: identical on every machine (Math.imul, 32-bit ops).
export function latticeHash(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = t => t * t * (3 - 2 * t);
export function valueNoise(x, y, cell, seed) {
  const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fade(fx - ix), ty = fade(fy - iy);
  const a = latticeHash(ix, iy, seed), b = latticeHash(ix + 1, iy, seed), c = latticeHash(ix, iy + 1, seed), d = latticeHash(ix + 1, iy + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
export function fbm(x, y, cell, octaves, seed) {
  let sum = 0, amp = 1, norm = 0, size = cell;
  for (let i = 0; i < octaves; i++) { sum += valueNoise(x + i * 311, y - i * 197, size, seed + i * 7919) * amp; norm += amp; amp *= 0.5; size *= 0.5; }
  return sum / norm;
}
export const seedFromString = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; };
const smooth = (edge0, edge1, v) => { const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t); };
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
function signedDistance(x, y, vertices) {
  let best = Infinity;
  for (let i = 0, n = vertices.length; i < n; i++) best = Math.min(best, distanceToSegment(x, y, vertices[i], vertices[(i + 1) % n]));
  return pointInPolygon(x, y, vertices) ? -best : best;
}
const inflated = (b, r) => ({ minX: b.minX - r, minY: b.minY - r, maxX: b.maxX + r, maxY: b.maxY + r });
const contains = (b, x, y) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;

// `summary` is a validated plan summary with `terrain`; `world` the authored
// greybox (pieces/roads). `size` texels across the plan bounds' width.
export function buildTerrainField({ summary, world, size = 512 } = {}) {
  if (!summary?.terrain || !summary.bounds) throw new TypeError('terrain summary required');
  if (!world?.pieces || !world.roads) throw new TypeError('authored world required');
  const { bounds, terrain } = summary, seed = seedFromString(terrain.seed);
  const width = size, unitsPerTexel = (bounds.maxX - bounds.minX) / size, height = Math.max(1, Math.round((bounds.maxY - bounds.minY) / unitsPerTexel));
  const data = new Uint8ClampedArray(width * height * 4);
  const slot = id => { const i = terrain.materials.indexOf(id); return i < 0 ? 1 : i; };
  const reach = inflated(bounds, 320);
  const zones = summary.zones.filter(zone => terrain.materials.includes(zone.material)).map(zone => ({ ...zone, slot: slot(zone.material), box: inflated(polygonBounds(zone.vertices), zone.feather * 2.2) }));
  const trails = summary.trails.map(trail => ({ ...trail, slot: slot(trail.material), box: inflated(polygonBounds(trail.points), trail.width + trail.halo * 2 + 80) }));
  const roads = world.roads.map(road => ({ points: road.points, half: road.width / 2, box: inflated(polygonBounds(road.points), road.width / 2 + 260) }));
  const blockers = world.pieces.filter(piece => piece.blocker && piece.visible.height > 30).map(piece => { const vertices = piece.blocker.shape.vertices, h = piece.visible.height; return { vertices, h, radius: Math.max(24, Math.min(110, h * 0.45)), box: inflated(polygonBounds(vertices), Math.max(140, h * 0.8)) }; }).filter(entry => !(entry.box.maxX < reach.minX || entry.box.minX > reach.maxX || entry.box.maxY < reach.minY || entry.box.minY > reach.maxY));
  const trees = summary.props.filter(prop => prop.height >= 150).map(prop => { const r = prop.height * 0.5, cx = prop.x + prop.height * 0.14, cy = prop.y - prop.groundZ + prop.height * 0.05; return { cx, cy, r, box: { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r } }; });
  const blendEdge = 1 - terrain.blend;
  let o = 0;
  for (let j = 0; j < height; j++) {
    const y = bounds.minY + (j + 0.5) * unitsPerTexel;
    for (let i = 0; i < width; i++, o += 4) {
      const x = bounds.minX + (i + 0.5) * unitsPerTexel;
      const wobble = fbm(x, y, 140, 2, seed + 7) - 0.5;
      const w = [0, 0, 0];
      // Macro patches of the secondary material, organic at the patch scale.
      w[1] = smooth(blendEdge - 0.1, blendEdge + 0.1, fbm(x, y, terrain.patch, 3, seed));
      let value = (fbm(x, y, 1500, 2, seed + 3) - 0.5) * 2 * terrain.value, ao = 0, dust = 0;
      for (const zone of zones) {
        if (!contains(zone.box, x, y)) continue;
        const sd = signedDistance(x, y, zone.vertices), wz = smooth(zone.feather, -zone.feather * 0.4, sd + wobble * zone.feather * 1.6) * zone.alpha;
        if (wz <= 0) continue;
        if (zone.slot === 0) { w[1] *= 1 - wz; w[2] *= 1 - wz; } else w[zone.slot] += (1 - w[zone.slot]) * wz;
      }
      for (const trail of trails) {
        if (!contains(trail.box, x, y)) continue;
        // Authored routes are axis-aligned; a low-frequency meander and a
        // patchy wear factor keep the worn path from reading as a ruled stripe.
        const mx = (fbm(x, y, 460, 2, seed + 11) - 0.5) * 110, my = (fbm(x, y, 460, 2, seed + 13) - 0.5) * 110;
        const d = distanceToPolyline(x + mx, y + my, trail.points), e = trail.width / 2;
        const wear = 0.55 + 0.45 * smooth(0.3, 0.7, fbm(x, y, 260, 2, seed + 17));
        const wt = smooth(e + trail.halo, e * 0.3, d + wobble * e * 2.2) * wear;
        if (wt <= 0) continue;
        if (trail.slot === 0) { w[1] *= 1 - wt; w[2] *= 1 - wt; } else w[trail.slot] += (1 - w[trail.slot]) * wt;
        value -= wt * 0.06;
      }
      for (const road of roads) {
        if (!contains(road.box, x, y)) continue;
        const d = distanceToPolyline(x, y, road.points);
        const verge = smooth(road.half + 150, road.half + 10, d + wobble * 70) * 0.8;
        w[1] += (1 - w[1]) * verge; w[2] *= 1 - verge;
        dust = Math.max(dust, smooth(road.half + 240, road.half, d) * 0.1);
      }
      for (const blocker of blockers) {
        if (!contains(blocker.box, x, y)) continue;
        if (pointInPolygon(x, y, blocker.vertices)) continue;
        const d = signedDistance(x, y, blocker.vertices);
        let cast = 0;
        const sx = x - blocker.h * 0.22, sy = y - blocker.h * 0.42;
        if (pointInPolygon(sx, sy, blocker.vertices)) cast = 1; else cast = Math.exp(-signedDistance(sx, sy, blocker.vertices) / (blocker.h * 0.35));
        ao += 0.5 * Math.exp(-d / blocker.radius) + 0.28 * cast;
      }
      for (const tree of trees) {
        if (!contains(tree.box, x, y)) continue;
        ao += 0.3 * smooth(tree.r, tree.r * 0.25, Math.hypot(x - tree.cx, y - tree.cy));
      }
      ao = Math.min(0.7, ao);
      const light = clamp01((Math.max(0.3, (1 - ao) * (1 + dust)) - TERRAIN_LIGHT_RANGE.low) / (TERRAIN_LIGHT_RANGE.high - TERRAIN_LIGHT_RANGE.low));
      data[o] = Math.round(clamp01(w[1]) * 255);
      data[o + 1] = Math.round(clamp01(w[2]) * 255);
      data[o + 2] = Math.round(clamp01(0.5 + value) * 255);
      data[o + 3] = Math.round(light * 255);
    }
  }
  return Object.freeze({ id: TERRAIN_FIELD_ID, width, height, unitsPerTexel, minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.minY + height * unitsPerTexel, data, neutralLight: Math.round(LIGHT_NEUTRAL * 255), counts: Object.freeze({ zones: zones.length, trails: trails.length, roads: roads.length, blockers: blockers.length, trees: trees.length }) });
}

export { rectVertices };
