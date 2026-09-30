// Shared helpers for authoring per-area art plans from the authored world.
// Pure functions over frozen design data; nothing here mutates the world.
import { createPlacementGuard, pointInPolygon, stableUnit, createAreaArtPlanShell, distanceToPolyline } from '../world-v2-area-art-schema.mjs';

export function createAreaPlanContext(world, areaId, { pages, margin = 0, routeClearance = 64, siteClearance = 140 } = {}) {
  const area = world.areas.find(entry => entry.id === areaId);
  if (!area) return null;
  const { x: cx, y: cy } = area.center;
  const point = (x, y) => ({ x: cx + x, y: cy + y });
  const bounds = { minX: area.bounds.minX - margin, minY: area.bounds.minY - margin, maxX: area.bounds.maxX + margin, maxY: area.bounds.maxY + margin };
  const plan = createAreaArtPlanShell({ areaId, bounds, pages });
  const pieces = world.pieces.filter(piece => piece.visible.areaId === areaId);
  const solids = world.pieces.filter(piece => piece.blocker);
  const guard = createPlacementGuard({ world, areaId, routeClearance, siteClearance });
  const piece = name => pieces.find(entry => entry.id === `${areaId}-${name}`) ?? null;
  // Unique inspection route segments, longest first, for worn trail painting.
  const routeSegments = [];
  const seen = new Set();
  for (const route of area.inspectionRoutes ?? []) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], key = [`${a.x},${a.y}`, `${b.x},${b.y}`].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key); routeSegments.push({ a: { ...a }, b: { ...b }, kind: route.kind, routeId: route.id });
  }
  const insideWorld = (x, y) => x >= world.bounds.minX && x <= world.bounds.maxX && y >= world.bounds.minY && y <= world.bounds.maxY;
  const insideBounds = (x, y) => x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  const supportAt = (x, y) => solids.find(entry => pointInPolygon(x, y, entry.blocker.shape.vertices)) ?? null;
  let counter = 0;
  const prop = (source, x, y, height, extra = {}) => { const row = { id: `${areaId}-art-${counter++}`, source, x, y, height, ...extra }; plan.props.push(row); return row; };
  const solid = (name, style, extra = {}) => { const target = piece(name); if (!target) throw new Error(`${areaId} plan requires authored piece ${name}`); plan.solids.push({ pieceId: target.id, style, ...extra }); return target; };
  // Deterministic scatter inside an ellipse; only clear, in-bounds points survive.
  function scatter({ key, x, y, rx, ry, count, radius = 20, place }) {
    let placed = 0;
    for (let n = 0; n < count; n++) {
      const a = n * 2.399963 + stableUnit(key, 'a') * 6.28, r = Math.sqrt((n + 0.5) / count) * (0.82 + 0.18 * stableUnit(key, n));
      const px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
      if (!insideBounds(px, py) || !guard.clear(px, py, radius)) continue;
      place(px, py, n, stableUnit(key, n, 'v')); placed++;
    }
    return placed;
  }
  return Object.freeze({ area, center: area.center, bounds, point, plan, pieces, solids, guard, piece, routeSegments, insideWorld, insideBounds, supportAt, prop, solid, scatter, distanceToPolyline });
}

export const CANOPY_HEIGHTS = Object.freeze({ 'b1-03': 380, 'b1-50': 330, 'b1-55': 300, 'b1-53': 250, 'b2-70': 260, 'b2-71': 340, 'b2-72': 390 });
