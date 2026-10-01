// Shared helpers for authoring per-area art plans from the authored world.
// Pure functions over frozen design data; nothing here mutates the world.
import { createPlacementGuard, pointInPolygon, stableUnit, createAreaArtPlanShell, distanceToPolyline } from '../world-v2-area-art-schema.mjs';
import { cardBlockingFootprint } from './card-footprints.mjs';

// A blocking card now stands on its own collider (dev/greybox-prop-blockers.mjs),
// so on open ground it must also keep the walked lines clear: every inspection
// route, every court centre-to-exit line and every court centre-to-cover line,
// with a player body (radius 24) of room, and a boss court's fighting floor
// (its spawn, marks and floor within BOSS_FLOOR_RADIUS of the centre) stays
// open. Returns `clear(source, x, y, height, flip)`.
export const BLOCKING_CARD_CLEARANCE = 30;
export const BOSS_FLOOR_RADIUS = 720;
const segmentRectDistance = (a, b, r) => {
  const inside = p => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
  if (inside(a) || inside(b)) return 0;
  const corners = [{ x: r.minX, y: r.minY }, { x: r.maxX, y: r.minY }, { x: r.maxX, y: r.maxY }, { x: r.minX, y: r.maxY }];
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  for (let i = 0; i < 4; i++) { const c = corners[i], d = corners[(i + 1) % 4]; if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return 0; }
  const toRect = p => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minY - p.y, 0, p.y - r.maxY));
  return Math.min(toRect(a), toRect(b), ...corners.map(c => distanceToPolyline(c.x, c.y, [a, b])));
};
export function createBlockingCardGuard(world, clearance = BLOCKING_CARD_CLEARANCE) {
  const segments = [];
  for (const area of world.areas) for (const route of area.inspectionRoutes ?? []) for (let i = 1; i < route.points.length; i++) segments.push([route.points[i - 1], route.points[i]]);
  for (const arena of world.arenas ?? []) {
    for (const exit of arena.exits ?? []) segments.push([arena.center, exit]);
    const court = { minX: arena.center.x - arena.width / 2 - 120, minY: arena.center.y - arena.depth / 2 - 120, maxX: arena.center.x + arena.width / 2 + 120, maxY: arena.center.y + arena.depth / 2 + 120 };
    for (const cover of world.pieces) {
      if (cover.visible.areaId !== arena.areaId || !['cover-short', 'cover-tall'].includes(cover.kind)) continue;
      const b = cover.visible.bounds, c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
      if (c.x >= court.minX && c.x <= court.maxX && c.y >= court.minY && c.y <= court.maxY) segments.push([arena.center, c]);
    }
  }
  // Boss floors: the Liquidator's exchange floor (1,050 x 460 about the court
  // centre, world-v2-gameplay.mjs) plus a body's room; a district court's
  // spawn and marks within BOSS_FLOOR_RADIUS of its centre.
  const gap = (f, c) => Math.hypot(Math.max(f.minX - c.x, 0, c.x - f.maxX), Math.max(f.minY - c.y, 0, c.y - f.maxY));
  const floors = (world.arenas ?? []).filter(arena => arena.bossId).map(arena => arena.bossId === 'liquidator'
    ? f => !(f.maxX > arena.center.x - 525 - clearance && f.minX < arena.center.x + 525 + clearance && f.maxY > arena.center.y - 230 - clearance && f.minY < arena.center.y + 230 + clearance)
    : f => gap(f, arena.center) >= BOSS_FLOOR_RADIUS);
  const clear = (source, x, y, height, flip = false) => {
    const f = cardBlockingFootprint(source, x, y, height, flip);
    return !f || (segments.every(([a, b]) => segmentRectDistance(a, b, f) >= clearance) && floors.every(open => open(f)));
  };
  return Object.freeze({ clear, segments: segments.length });
}

export function createAreaPlanContext(world, areaId, { pages, margin = 0, routeClearance = 64, siteClearance = 140 } = {}) {
  const area = world.areas.find(entry => entry.id === areaId);
  if (!area) return null;
  const { x: cx, y: cy } = area.center;
  const point = (x, y) => ({ x: cx + x, y: cy + y });
  const bounds = { minX: area.bounds.minX - margin, minY: area.bounds.minY - margin, maxX: area.bounds.maxX + margin, maxY: area.bounds.maxY + margin };
  const plan = createAreaArtPlanShell({ areaId, bounds, pages });
  const pieces = world.pieces.filter(piece => piece.visible.areaId === areaId);
  // Prop blockers (pieces authored under a plan's own cards) are collision for
  // those cards, never a support or obstacle for placing them.
  const solids = world.pieces.filter(piece => piece.blocker && !piece.visible.artPlanId);
  const guard = createPlacementGuard({ world, areaId, routeClearance, siteClearance });
  const blockingGuard = createBlockingCardGuard(world);
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
  // An elevated blocking card (roof tower, skyline row, bank rock or tree)
  // must stand wholly on solids of its own height: the anchor moves to the
  // nearest spot where its blocking footprint fits, else it is left out.
  function seatOnSupport(source, x, y, height, flip, groundZ, direction = null) {
    const fits = (px, py) => { const f = cardBlockingFootprint(source, px, py, height, flip); return !f || [[f.minX, f.minY], [f.maxX, f.minY], [f.maxX, f.maxY], [f.minX, f.maxY]].every(([cx2, cy2]) => supportAt(cx2, cy2)?.visible.height === groundZ); };
    if (fits(x, y)) return { x, y };
    const support = supportAt(x, y);
    if (!support) return null;
    // Nearest fitting anchor: the preferred direction first (an edge row steps
    // outward), then rings of 16 headings out to 240 units.
    if (direction) for (let step = 1; step <= 20; step++) { const px = x + direction.x * 12 * step, py = y + direction.y * 12 * step; if (insideBounds(px, py) && fits(px, py)) return { x: px, y: py }; }
    for (let step = 1; step <= 20; step++) for (let k = 0; k < 16; k++) {
      const px = x + Math.cos(k * Math.PI / 8) * 12 * step, py = y + Math.sin(k * Math.PI / 8) * 12 * step;
      if (insideBounds(px, py) && fits(px, py)) return { x: px, y: py };
    }
    return null;
  }
  let counter = 0;
  const prop = (source, x, y, height, extra = {}) => {
    const { seat = null, ...rest } = extra;
    if ((rest.groundZ ?? 0) > 0) { const at = seatOnSupport(source, x, y, height, rest.flip === true, rest.groundZ, seat); if (!at) return null; ({ x, y } = at); }
    else if (!blockingGuard.clear(source, x, y, height, rest.flip === true)) return null;
    const row = { id: `${areaId}-art-${counter++}`, source, x, y, height, ...rest }; plan.props.push(row); return row;
  };
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
  return Object.freeze({ area, center: area.center, bounds, point, plan, pieces, solids, guard, blockingGuard, piece, routeSegments, insideWorld, insideBounds, supportAt, seatOnSupport, prop, solid, scatter, distanceToPolyline });
}

export const CANOPY_HEIGHTS = Object.freeze({ 'b1-03': 380, 'b1-50': 330, 'b1-55': 300, 'b1-53': 250, 'b2-70': 260, 'b2-71': 340, 'b2-72': 390 });
