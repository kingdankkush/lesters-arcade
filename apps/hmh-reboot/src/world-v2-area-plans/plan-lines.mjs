// Line, bank and woodland-edge placement helpers shared by the Farms, City,
// Coast and Bayou plans. Pure functions over the frozen plan context from
// plan-support.mjs; every placement still passes the placement guard and
// nothing here touches collision, navigation, spawning or rules.
import { pointInPolygon, stableUnit } from '../world-v2-area-art-schema.mjs';

// Evenly spaced stations from `a` to `b` (relative offsets are resolved by the
// caller). `inset` trims both ends; `jitter` is a deterministic lateral wobble.
export function lineStations(a, b, spacing, { inset = 0, jitter = 0, key = 'line' } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  if (!(length > 0) || !(spacing > 0)) return [];
  const ux = dx / length, uy = dy / length, usable = Math.max(0, length - inset * 2), count = Math.max(1, Math.round(usable / spacing));
  const step = count > 1 ? usable / (count - 1) : 0, stations = [];
  for (let i = 0; i < count; i++) {
    const t = inset + (count > 1 ? i * step : usable / 2), side = (stableUnit(key, i, 'j') - 0.5) * 2 * jitter;
    stations.push({ x: a.x + ux * t - uy * side, y: a.y + uy * t + ux * side, index: i, unit: stableUnit(key, i, 'v') });
  }
  return stations;
}

// Rows of standing cards along a line through the guard; returns the placed count.
export function placeLine(context, { key, from, to, spacing, radius = 20, inset = 0, jitter = 0, place }) {
  let placed = 0;
  for (const station of lineStations(from, to, spacing, { inset, jitter, key })) {
    if (!context.insideBounds(station.x, station.y) || !context.guard.clear(station.x, station.y, radius)) continue;
    place(station.x, station.y, station.index, station.unit); placed++;
  }
  return placed;
}

// Trees rooted on an authored bank polygon (a `cliff` piece): a jittered grid
// clipped to the polygon, lifted by the bank height through `groundZ`.
export function placeOnBank(context, bank, { key, stepX = 165, stepY = 150, inset = 65, sources, height, tint = 0xe6e2cc, radius = 0 }) {
  const b = bank.visible.bounds, vertices = bank.blocker.shape.vertices; let n = 0, placed = 0;
  for (let y = b.minY + inset; y < b.maxY; y += stepY) for (let x = b.minX + inset; x < b.maxX; x += stepX) {
    const px = x + Math.sin(n * 2.7) * 39, py = y + Math.cos(n * 1.9) * 30; n++;
    if (!pointInPolygon(px, py, vertices) || !context.insideBounds(px, py)) continue;
    if (radius > 0 && vertices.some((a, i) => { const c = vertices[(i + 1) % vertices.length]; return context.distanceToPolyline(px, py, [a, c]) < radius; })) continue;
    const source = sources[n % sources.length];
    context.prop(source, px, py, height(source, n, stableUnit(key, bank.id, n)), { groundZ: bank.visible.height, flip: n % 3 === 0, tint: typeof tint === 'function' ? tint(source, n) : tint });
    placed++;
  }
  return placed;
}

// Woodland beyond the area edge, rooted only on existing closed world masses
// (never on another area's ground); road mouths stay open because roads are
// not masses. `sides` selects west, east, north, south (0..3).
export function placeEdgeWoodland(context, { key, sources, perSide = 23, drift = 70, sides = [0, 1, 2, 3], height, tint = 0xdcdac4 }) {
  const b = context.area.bounds; let placed = 0;
  for (const side of sides) for (let n = 0; n < perSide; n++) {
    const t = (n + 0.5) / perSide, offset = drift + Math.sin(n * 2.3 + side) * 30;
    const x = side === 0 ? b.minX - offset : side === 1 ? b.maxX + offset : b.minX + t * (b.maxX - b.minX);
    const y = side === 2 ? b.minY - offset : side === 3 ? b.maxY + offset : b.minY + t * (b.maxY - b.minY);
    if (!context.insideWorld(x, y) || !context.insideBounds(x, y)) continue;
    const support = context.supportAt(x, y);
    if (!support || support.visible.areaId) continue;
    const source = sources[(n + side) % sources.length];
    // A footprint that reaches back over the area edge steps outward, deeper into the closed land.
    const seat = side === 0 ? { x: -1, y: 0 } : side === 1 ? { x: 1, y: 0 } : side === 2 ? { x: 0, y: -1 } : { x: 0, y: 1 };
    if (context.prop(source, x, y, height(source, side, n, stableUnit(key, side, n)), { groundZ: support.visible.height, flip: n % 2 === 1, tint, seat })) placed++;
  }
  return placed;
}

// Rubble or reeds just outside a polygon edge (a cliff foot or a water bank):
// stations along each edge pushed `offset` units away from the polygon.
export function placeAlongPolygonEdges(context, vertices, { key, spacing, offset, radius = 16, jitter = 0, place, outward = true }) {
  let placed = 0;
  const n = vertices.length, signed = vertices.reduce((sum, p, i) => { const q = vertices[(i + 1) % n]; return sum + p.x * q.y - p.y * q.x; }, 0);
  const orientation = (signed >= 0 ? 1 : -1) * (outward ? 1 : -1);
  vertices.forEach((a, i) => {
    const b = vertices[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = dy / len * orientation, ny = -dx / len * orientation;
    for (const station of lineStations(a, b, spacing, { inset: spacing * 0.5, jitter, key: `${key}-${i}` })) {
      const px = station.x + nx * offset, py = station.y + ny * offset;
      if (pointInPolygon(px, py, vertices) === outward) continue;
      if (!context.insideBounds(px, py) || !context.guard.clear(px, py, radius)) continue;
      place(px, py, placed, station.unit, i); placed++;
    }
  });
  return placed;
}
