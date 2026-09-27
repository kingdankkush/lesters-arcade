// The shared boss geometry kit (design package 4.1 "Readability" and 4.7 item
// 3, slice S1.5). Every boss tell locks one of these shapes at its start; the
// simulation resolves the strike on the same frozen shape, the renderer draws
// it, and the automatic dodge reads it through bossShapeDodgeDanger.
//
// Hit tests take the player's disk (radius 24), never a point. A danger shape
// hits when the disk overlaps it; a safe-zones shape hits unless the whole
// disk is inside one of its zones.
//
// The walk-escape rule (4.1): every tell satisfies
//   tellTicks >= ceil((escape distance + 24) / 4) + 12,
// the player walking at 4 units a tick after a 12-tick reaction. The clear
// distance below already includes the disk (it is the walk until the whole
// disk is out), so the budget is ceil(clearDistance / 4) + 12.
//
// Pure: no clock, no random draws, no DOM. Loaded lazily with the boss modules.
import { freezeDeep } from './value-guards.mjs';

export const BOSS_PLAYER_RADIUS = 24;
export const BOSS_WALK_UNITS_PER_TICK = 4;
export const BOSS_WALK_REACTION_TICKS = 12;
export const BOSS_GEOMETRY_KIT = Object.freeze([
  'lane', 'charge-lane', 'chain-link', 'circle', 'ring', 'safe-zones', 'panels', 'half-plane', 'drift-rect', 'rotating-bar', 'union',
]);

const EPSILON = 1e-9;

export function bossWalkBudgetTicks(clearDistance) {
  if (!Number.isFinite(clearDistance) || clearDistance < 0) throw new TypeError('clear distance must be a finite non-negative number');
  return Math.ceil(clearDistance / BOSS_WALK_UNITS_PER_TICK - EPSILON) + BOSS_WALK_REACTION_TICKS;
}

const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};
const point = (value, name) => ({ x: finite(value?.x, `${name}.x`), y: finite(value?.y, `${name}.y`) });
const positive = (value, name) => {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
};
const rect = (value, name) => {
  const out = { minX: finite(value?.minX, `${name}.minX`), minY: finite(value?.minY, `${name}.minY`), maxX: finite(value?.maxX, `${name}.maxX`), maxY: finite(value?.maxY, `${name}.maxY`) };
  if (out.maxX < out.minX || out.maxY < out.minY) throw new TypeError(`${name} must be ordered`);
  return out;
};

function normalizeShape(spec) {
  switch (spec?.type) {
    case 'lane':
    case 'charge-lane':
      return { type: spec.type, origin: point(spec.origin, 'origin'), target: point(spec.target, 'target'), width: positive(spec.width, 'width') };
    case 'chain-link':
      return { type: 'chain-link', a: point(spec.a, 'a'), b: point(spec.b, 'b'), width: positive(spec.width, 'width') };
    case 'circle':
      return { type: 'circle', center: point(spec.center, 'center'), radius: positive(spec.radius, 'radius') };
    case 'ring': {
      const innerRadius = finite(spec.innerRadius, 'innerRadius');
      const outerRadius = positive(spec.outerRadius, 'outerRadius');
      if (innerRadius < 0 || innerRadius >= outerRadius) throw new TypeError('ring radii must be ordered');
      return { type: 'ring', center: point(spec.center, 'center'), innerRadius, outerRadius };
    }
    case 'safe-zones':
      if (!Array.isArray(spec.zones) || spec.zones.length === 0) throw new TypeError('safe zones need at least one zone');
      return { type: 'safe-zones', zones: spec.zones.map((zone, index) => point(zone, `zones[${index}]`)), radius: positive(spec.radius, 'radius') };
    case 'panels':
      if (!Array.isArray(spec.cells) || spec.cells.length === 0) throw new TypeError('panels need at least one cell');
      return { type: 'panels', cells: spec.cells.map((cell, index) => rect(cell, `cells[${index}]`)), ...(spec.meta ? { meta: spec.meta } : {}) };
    case 'half-plane': {
      const normal = point(spec.normal, 'normal');
      if (Math.abs(Math.hypot(normal.x, normal.y) - 1) > 1e-6) throw new TypeError('half-plane needs a unit normal');
      return { type: 'half-plane', point: point(spec.point, 'point'), normal };
    }
    case 'drift-rect':
      return { type: 'drift-rect', rect: rect(spec.rect, 'rect'), drift: point(spec.drift ?? { x: 0, y: 0 }, 'drift') };
    case 'rotating-bar':
      return { type: 'rotating-bar', center: point(spec.center, 'center'), length: positive(spec.length, 'length'), width: positive(spec.width, 'width'), angle: finite(spec.angle, 'angle') };
    case 'union':
      if (!Array.isArray(spec.shapes) || spec.shapes.length === 0) throw new TypeError('a union needs shapes');
      return { type: 'union', shapes: spec.shapes.map(normalizeShape) };
    default:
      throw new TypeError(`unknown boss shape ${String(spec?.type)}`);
  }
}

export function createBossShape(spec) {
  return freezeDeep(normalizeShape(spec));
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function diskOverlapsRect(p, radius, r) {
  const nx = Math.max(r.minX, Math.min(p.x, r.maxX));
  const ny = Math.max(r.minY, Math.min(p.y, r.maxY));
  return Math.hypot(p.x - nx, p.y - ny) <= radius;
}

// True when the player's disk (centre p, radius) is struck by the shape.
export function bossShapeHits(shape, p, radius = BOSS_PLAYER_RADIUS) {
  switch (shape.type) {
    case 'lane':
    case 'charge-lane':
      return distanceToSegment(p, shape.origin, shape.target) <= shape.width / 2 + radius;
    case 'chain-link':
      return distanceToSegment(p, shape.a, shape.b) <= shape.width / 2 + radius;
    case 'circle':
      return Math.hypot(p.x - shape.center.x, p.y - shape.center.y) <= shape.radius + radius;
    case 'ring': {
      const distance = Math.hypot(p.x - shape.center.x, p.y - shape.center.y);
      return distance >= shape.innerRadius - radius && distance <= shape.outerRadius + radius;
    }
    case 'safe-zones':
      return !shape.zones.some((zone) => Math.hypot(p.x - zone.x, p.y - zone.y) <= shape.radius - radius);
    case 'panels':
      return shape.cells.some((cell) => diskOverlapsRect(p, radius, cell));
    case 'half-plane':
      return (p.x - shape.point.x) * shape.normal.x + (p.y - shape.point.y) * shape.normal.y >= -radius;
    case 'drift-rect': {
      const { rect: r, drift } = shape;
      return diskOverlapsRect(p, radius, { minX: r.minX + drift.x, minY: r.minY + drift.y, maxX: r.maxX + drift.x, maxY: r.maxY + drift.y });
    }
    case 'rotating-bar': {
      const hx = Math.cos(shape.angle) * shape.length / 2;
      const hy = Math.sin(shape.angle) * shape.length / 2;
      return distanceToSegment(p, { x: shape.center.x - hx, y: shape.center.y - hy }, { x: shape.center.x + hx, y: shape.center.y + hy }) <= shape.width / 2 + radius;
    }
    case 'union':
      return shape.shapes.some((part) => bossShapeHits(part, p, radius));
    default:
      throw new TypeError(`unknown boss shape ${String(shape?.type)}`);
  }
}

// The shortest straight walk from `from` to a point where the disk is clear,
// searched on rings `step` apart with `angles` bearings each. Candidates must
// lie in `interior` (the region the disk's centre may occupy), so a wall
// behind the hero lengthens the walk. The search rounds up by at most one
// step, which only makes a budget check stricter. Infinity when nothing within
// maxDistance is clear.
export function bossShapeClearDistance(shape, from, {
  interior = null,
  radius = BOSS_PLAYER_RADIUS,
  maxDistance = 1_200,
  step = 2,
  angles = 128,
} = {}) {
  const start = point(from, 'from');
  const inside = (q) => !interior || (q.x >= interior.minX && q.x <= interior.maxX && q.y >= interior.minY && q.y <= interior.maxY);
  if (inside(start) && !bossShapeHits(shape, start, radius)) return 0;
  for (let distance = step; distance <= maxDistance + EPSILON; distance += step) {
    for (let index = 0; index < angles; index += 1) {
      const angle = (index / angles) * Math.PI * 2;
      const candidate = { x: start.x + Math.cos(angle) * distance, y: start.y + Math.sin(angle) * distance };
      if (inside(candidate) && !bossShapeHits(shape, candidate, radius)) return distance;
    }
  }
  return Infinity;
}

// A predicate for the automatic dodge (automatic-actions.mjs): true where a
// body of `radius` at p would be struck.
export function bossShapeDodgeDanger(shape, radius = BOSS_PLAYER_RADIUS) {
  return (p) => bossShapeHits(shape, p, radius);
}
