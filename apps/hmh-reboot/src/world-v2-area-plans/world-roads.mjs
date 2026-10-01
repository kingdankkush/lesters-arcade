// World-wide road dressing: ribbons for all fourteen authored roads by kind,
// cracked-asphalt patches and road-side props along the paved highway spine.
// Props stand only on the walkable road surface outside the travel clearance
// (the central 60% of the ribbon), never inside a blocker, water, spawn or
// objective clearance. Frozen data only; no surface or rule is added.
import { freezeDeep } from '../value-guards.mjs';
import { createAreaArtPlanShell, createPlacementGuard, distanceToPolyline, stableUnit, WORLD_ROADS_PLAN_ID } from '../world-v2-area-art-schema.mjs';
import { createBlockingCardGuard } from './plan-support.mjs';

export const WORLD_ROADS_PAGES = Object.freeze(['tripo-props-hd-props-00.webp']);
export const ROAD_KIND_BY_AUTHORED = Object.freeze({ paved: 'paved', gravel: 'gravel', path: 'dirt', dirt: 'dirt' });
export const ROAD_CLEARANCE_FRACTION = 0.6;
const WRECKS = [['b2-54', 74], ['b2-58', 62], ['b2-56', 88], ['b2-61', 46], ['b2-55', 96], ['b2-58', 60], ['b2-54', 72]];

// Point at distance `along` from the start of a polyline plus a signed lateral
// offset (positive = left of travel).
function alongPolyline(points, along, lateral) {
  let remaining = along;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    if (remaining <= len || i === points.length - 1) { const t = Math.min(remaining, len); return { x: a.x + ux * t - uy * lateral, y: a.y + uy * t + ux * lateral, ux, uy }; }
    remaining -= len;
  }
  return null;
}
const polylineLength = points => points.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

export function createWorldRoadsArtPlan(world) {
  if (!world?.roads?.length) return null;
  const plan = createAreaArtPlanShell({ areaId: WORLD_ROADS_PLAN_ID, bounds: world.bounds, pages: WORLD_ROADS_PAGES });
  const guard = createPlacementGuard({ world, roadClearance: 0, routeClearance: 40, siteClearance: 160 });
  const blockingGuard = createBlockingCardGuard(world);
  let counter = 0;
  const prop = (source, x, y, height, extra = {}) => { if (blockingGuard.clear(source, x, y, height, extra.flip === true)) plan.props.push({ id: `road-art-${counter++}`, source, x, y, height, ...extra }); };
  // Shoulder placement: within the ribbon, outside the clearance corridor, on
  // clear ground, and not overlapping another road's corridor.
  const shoulderClear = (road, x, y, radius) => {
    const d = distanceToPolyline(x, y, road.points);
    if (d < road.width / 2 * ROAD_CLEARANCE_FRACTION + radius * 0.5 || d > road.width / 2 - 8) return false;
    for (const other of world.roads) if (other !== road && distanceToPolyline(x, y, other.points) < other.width / 2 * ROAD_CLEARANCE_FRACTION + radius) return false;
    return guard.clear(x, y, radius);
  };
  for (const road of world.roads) {
    const kind = ROAD_KIND_BY_AUTHORED[road.kind];
    if (!kind) throw new Error(`road ${road.id} has an unknown authored kind ${road.kind}`);
    const surfaceIds = [...road.points.slice(1).map((_, i) => `${road.id}-segment-${i + 1}`), ...road.points.slice(1, -1).map((_, i) => `${road.id}-join-${i}`)];
    const length = polylineLength(road.points), cracks = [];
    if (kind === 'paved') for (let along = 420, n = 0; along < length - 300; along += 640 + (n % 3) * 140, n++) {
      const at = alongPolyline(road.points, along, (n % 2 ? 1 : -1) * road.width * 0.14);
      if (at && guard.clear(at.x, at.y, 0)) cracks.push({ x: at.x, y: at.y, scale: 0.85 + 0.3 * stableUnit(road.id, 'crack', n), flip: n % 2 === 1 });
    }
    plan.roads.push({ id: `road-${road.id}`, roadId: road.id, kind, points: road.points.map(p => ({ x: p.x, y: p.y })), width: road.width, surfaceIds, cracks });
    if (kind !== 'paved') {
      // Gravel access roads get an occasional wreck pulled onto the verge.
      if (kind === 'gravel') for (let along = 700, n = 0; along < length - 500; along += 1500, n++) {
        const side = n % 2 ? 1 : -1, at = alongPolyline(road.points, along, side * road.width * 0.41);
        const [source, height] = WRECKS[(n + road.id.length) % WRECKS.length];
        if (at && shoulderClear(road, at.x, at.y, height * 0.6)) prop(source, at.x, at.y, height, { flip: side > 0, tint: 0xd6d2c8, fade: false });
      }
      continue;
    }
    const half = road.width / 2, edge = half - 12;
    // Guardrail runs on both verges with gaps, jersey barriers as a chicane at
    // each end, a sign gantry and traffic mast at the city ends, wrecks between.
    for (const side of [-1, 1]) for (let run = 0; run < 3; run++) {
      const start = 260 + run * (length - 520) / 3, count = 4;
      for (let i = 0; i < count; i++) {
        const at = alongPolyline(road.points, start + i * 206, side * edge);
        if (at && shoulderClear(road, at.x, at.y, 8)) prop('b2-48', at.x, at.y, 40, { flip: side > 0, tint: 0xd8dad6, shadow: false, fade: false });
      }
    }
    for (const [along, side] of [[150, -1], [330, 1], [length - 150, 1], [length - 330, -1]]) {
      const at = alongPolyline(road.points, along, side * (half - 60));
      if (at && shoulderClear(road, at.x, at.y, 20)) prop('b2-49', at.x, at.y, 34, { flip: side > 0, tint: 0xd4d2cc, fade: false });
    }
    for (const [along, side, source, height] of [[length * 0.5, 1, 'b2-51', 300], [length * 0.2, -1, 'b2-52', 150], [length * 0.8, 1, 'b2-52', 150]]) {
      const at = alongPolyline(road.points, along, side * (half - 40));
      if (at && shoulderClear(road, at.x, at.y, 16)) prop(source, at.x, at.y, height, { flip: side > 0, tint: source === 'b2-51' ? 0xd6d8d4 : 0xffffff, fade: source === 'b2-51' });
    }
    for (let along = 520, n = 0; along < length - 420; along += 780 + (n % 2) * 260, n++) {
      const side = n % 2 ? 1 : -1, at = alongPolyline(road.points, along, side * (half - 96));
      const [source, height] = WRECKS[(n + road.id.length) % WRECKS.length];
      if (at && shoulderClear(road, at.x, at.y, height * 0.7)) prop(source, at.x, at.y, height, { flip: n % 3 === 0, tint: 0xd8d4cc, fade: false });
    }
  }
  return freezeDeep(plan);
}
