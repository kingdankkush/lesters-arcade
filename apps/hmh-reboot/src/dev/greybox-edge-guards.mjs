// Edge guards for the ten-area world's deep water and bridge crossings (2.1
// collision-art lane, docs/2.0/slices/WORLD-COLLISION-ART.md).
//
// Deep water and a deck's side drop are refused by the traversal pass, which
// stops a body dead instead of letting it slide: a hero or an enemy walking
// diagonally into a bank or a bridge side stood still for as long as the input
// held ("pinned"). A thin, low collider along each such edge lets the swept
// collision slide the body along it first, so the traversal pass never meets
// the water or the drop:
// - a bank guard along every deep-water edge, lying just inside the water,
//   cut where a bridge crosses;
// - a rail along both long sides of every bridge and its two ramps, just
//   outside the walked surface, from ramp foot to ramp foot (decks and ramps
//   are entered at their ends only).
// Guards are low (bank 8, rail 40 units) so shots and sight lines pass over,
// never cover, carry no area id (no layout budget) and are drawn by the water
// and deck edges they follow (the area-art binding claims them). Pure data
// derived from the authored water and bridge pieces; deterministic.
import { createGreyboxPiece } from './greybox-kit.mjs';

// The bank guard starts BANK_GUARD_GAP inside the water: the smallest body
// (an 18-radius enemy) still stops 2 units short of the bank, while the
// enemy nav grid gives up as few shore cells as possible.
export const BANK_GUARD_GAP = 16;
export const BANK_GUARD_DEPTH = 12;
export const BANK_GUARD_HEIGHT = 8;
export const RAIL_GUARD_DEPTH = 12;
export const RAIL_GUARD_HEIGHT = 40;

const round = value => Math.round(value * 100) / 100;
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const signedArea = v => v.reduce((sum, p, i) => { const q = v[(i + 1) % v.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;

// The crossing corridor of a bridge with its ramps: the union bounds and the
// axis the deck runs along ('x': walked east-west, sides are north/south).
function crossings(pieces) {
  const bridges = pieces.filter(piece => piece.kind === 'bridge');
  // The walked axis is where the ramps abut the deck (a flat deck's own
  // surface axis says nothing about the crossing direction).
  const rampsAlong = (bridge, axis) => {
    const b = bridge.visible.bounds;
    return pieces.filter(piece => piece.kind === 'ramp' && piece.visible.areaId === bridge.visible.areaId && (axis === 'x'
      ? piece.visible.bounds.minY === b.minY && piece.visible.bounds.maxY === b.maxY && (piece.visible.bounds.maxX === b.minX || piece.visible.bounds.minX === b.maxX)
      : piece.visible.bounds.minX === b.minX && piece.visible.bounds.maxX === b.maxX && (piece.visible.bounds.maxY === b.minY || piece.visible.bounds.minY === b.maxY)));
  };
  return bridges.map(bridge => {
    const axis = rampsAlong(bridge, 'x').length >= rampsAlong(bridge, 'y').length ? 'x' : 'y', ramps = rampsAlong(bridge, axis);
    if (ramps.length !== 2) throw new TypeError(`bridge ${bridge.id} needs a ramp at each end`);
    const all = [bridge, ...ramps].map(piece => piece.visible.bounds);
    const span = { minX: Math.min(...all.map(r => r.minX)), minY: Math.min(...all.map(r => r.minY)), maxX: Math.max(...all.map(r => r.maxX)), maxY: Math.max(...all.map(r => r.maxY)) };
    return { bridge, ramps, axis, span };
  });
}

// Pieces of segment a-b outside every corridor (parametric clipping against
// axis-aligned rectangles).
function clipOutside(a, b, rects) {
  let pieces = [[0, 1]];
  for (const r of rects) {
    const next = [];
    for (const [t0, t1] of pieces) {
      // Entry/exit of the segment through r (Liang-Barsky).
      let enter = t0, leave = t1;
      const dx = b.x - a.x, dy = b.y - a.y;
      let inside = true;
      for (const [p, q] of [[-dx, a.x - r.minX], [dx, r.maxX - a.x], [-dy, a.y - r.minY], [dy, r.maxY - a.y]]) {
        if (p === 0) { if (q < 0) { inside = false; break; } continue; }
        const t = q / p;
        if (p < 0) enter = Math.max(enter, t); else leave = Math.min(leave, t);
      }
      if (!inside || enter >= leave) { next.push([t0, t1]); continue; }
      if (enter > t0) next.push([t0, enter]);
      if (leave < t1) next.push([leave, t1]);
    }
    pieces = next;
  }
  return pieces.filter(([t0, t1]) => (t1 - t0) * Math.hypot(b.x - a.x, b.y - a.y) > 1);
}

// Sub-runs [t0, t1] of a bank edge whose landward side is walkable (a bank
// against closed land needs no guard: nothing reaches it).
function landwardRuns(a, b, outward, queryGround) {
  const length = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(2, Math.ceil(length / 20)), runs = [];
  let start = null;
  for (let i = 0; i <= steps; i++) {
    const p = lerp(a, b, i / steps), g = queryGround(p.x + outward.x * 30, p.y + outward.y * 30), open = g.walkable;
    if (open && start === null) start = Math.max(0, (i - 1) / steps);
    if (!open && start !== null) { runs.push([start, i / steps]); start = null; }
  }
  if (start !== null) runs.push([start, 1]);
  return runs;
}

export function authorEdgeGuards(pieces, queryGround) {
  const corridors = crossings(pieces);
  const guards = [];
  for (const water of pieces.filter(piece => piece.kind === 'water')) {
    const vertices = water.visible.vertices ?? [{ x: water.visible.bounds.minX, y: water.visible.bounds.minY }, { x: water.visible.bounds.maxX, y: water.visible.bounds.minY }, { x: water.visible.bounds.maxX, y: water.visible.bounds.maxY }, { x: water.visible.bounds.minX, y: water.visible.bounds.maxY }];
    const ccw = signedArea(vertices) > 0;
    // Cut where any crossing corridor (the deck and its ramps) passes.
    const cuts = corridors.map(c => c.span);
    vertices.forEach((a, i) => {
      const b = vertices[(i + 1) % vertices.length], len = Math.hypot(b.x - a.x, b.y - a.y);
      // Inward normal (into the water).
      let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      if (!ccw) { nx = -nx; ny = -ny; }
      let k = 0;
      for (const [r0, r1] of landwardRuns(a, b, { x: -nx, y: -ny }, queryGround)) {
        const runA = lerp(a, b, r0), runB = lerp(a, b, r1);
        for (const [t0, t1] of clipOutside(runA, runB, cuts)) {
          const p = lerp(runA, runB, t0), q = lerp(runA, runB, t1), near = BANK_GUARD_GAP, far = BANK_GUARD_GAP + BANK_GUARD_DEPTH;
          const quad = [{ x: p.x + nx * near, y: p.y + ny * near }, { x: q.x + nx * near, y: q.y + ny * near }, { x: q.x + nx * far, y: q.y + ny * far }, { x: p.x + nx * far, y: p.y + ny * far }].map(v => ({ x: round(v.x), y: round(v.y) }));
          guards.push({ id: `${water.id}-bank-${i}-${k++}`, vertices: quad, height: BANK_GUARD_HEIGHT, guardOf: water.id });
        }
      }
    });
  }
  for (const { bridge, axis, span: fullSpan } of corridors) {
    // Rails run along the deck and the upper half of each ramp, where a side
    // step off would drop more than an enemy may (12); lower down the ramp
    // side is an ordinary walk-off.
    const b = bridge.visible.bounds, half = axis === 'x' ? (b.minX - fullSpan.minX) / 2 : (b.minY - fullSpan.minY) / 2;
    const span = axis === 'x' ? { ...fullSpan, minX: b.minX - half, maxX: b.maxX + half } : { ...fullSpan, minY: b.minY - half, maxY: b.maxY + half };
    const sides = axis === 'x'
      ? [{ minX: span.minX, maxX: span.maxX, minY: span.minY - RAIL_GUARD_DEPTH, maxY: span.minY }, { minX: span.minX, maxX: span.maxX, minY: span.maxY, maxY: span.maxY + RAIL_GUARD_DEPTH }]
      : [{ minX: span.minX - RAIL_GUARD_DEPTH, maxX: span.minX, minY: span.minY, maxY: span.maxY }, { minX: span.maxX, maxX: span.maxX + RAIL_GUARD_DEPTH, minY: span.minY, maxY: span.maxY }];
    sides.forEach((r, k) => guards.push({ id: `${bridge.id}-rail-${k}`, vertices: [{ x: r.minX, y: r.minY }, { x: r.maxX, y: r.minY }, { x: r.maxX, y: r.maxY }, { x: r.minX, y: r.maxY }], height: RAIL_GUARD_HEIGHT, guardOf: bridge.id }));
  }
  for (const guard of guards) {
    const xs = guard.vertices.map(v => v.x), ys = guard.vertices.map(v => v.y);
    pieces.push(createGreyboxPiece({ id: guard.id, kind: 'edge-guard', bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }, vertices: guard.vertices, height: guard.height, guardOf: guard.guardOf }));
  }
  return guards.length;
}
