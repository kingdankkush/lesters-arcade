import { freezeDeep } from './value-guards.mjs';
const EPSILON = 1e-9;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function nonNegative(value, name) {
  finite(value, name);
  if (value < 0) throw new TypeError(`${name} must be non-negative`);
  return value;
}

function point(value, name) {
  return Object.freeze({ x: finite(value?.x, `${name}.x`), y: finite(value?.y, `${name}.y`) });
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}


function validateArea(area) {
  if (area?.type === 'rect') {
    const result = {
      type: 'rect',
      minX: finite(area.minX, 'area.minX'), minY: finite(area.minY, 'area.minY'),
      maxX: finite(area.maxX, 'area.maxX'), maxY: finite(area.maxY, 'area.maxY'),
    };
    if (result.maxX <= result.minX || result.maxY <= result.minY) throw new TypeError('surface rectangle must have positive area');
    return Object.freeze(result);
  }
  if (area?.type === 'polygon') {
    if (!Array.isArray(area.vertices) || area.vertices.length < 3) throw new TypeError('surface polygon needs at least three vertices');
    return Object.freeze({ type: 'polygon', vertices: Object.freeze(area.vertices.map((vertex, index) => point(vertex, `area.vertices[${index}]`))) });
  }
  throw new TypeError('surface area must be a rect or polygon');
}

function contains(area, x, y) {
  if (area.type === 'rect') return x >= area.minX - EPSILON && x <= area.maxX + EPSILON && y >= area.minY - EPSILON && y <= area.maxY + EPSILON;
  let inside = false;
  for (let index = 0, previous = area.vertices.length - 1; index < area.vertices.length; previous = index, index += 1) {
    const a = area.vertices[index];
    const b = area.vertices[previous];
    if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function boundsForArea(area) {
  if (area.type === 'rect') return area;
  return {
    minX: Math.min(...area.vertices.map((vertex) => vertex.x)),
    minY: Math.min(...area.vertices.map((vertex) => vertex.y)),
    maxX: Math.max(...area.vertices.map((vertex) => vertex.x)),
    maxY: Math.max(...area.vertices.map((vertex) => vertex.y)),
  };
}

export function createElevationSurface({
  id,
  kind = 'ground',
  area,
  groundZ = 0,
  fromZ = groundZ,
  toZ = groundZ,
  axis = 'x',
  visibleTerrainId,
  priority = 0,
  walkable = kind !== 'water',
  deepWater = kind === 'water',
  waterLevel = null,
  oneWayDrop = null,
  visibleStepId = null,
} = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('surface.id must be a non-empty string');
  if (!['ground', 'ramp', 'stairs', 'ledge', 'water', 'shallow-water', 'bridge'].includes(kind)) throw new TypeError(`unsupported elevation surface kind: ${String(kind)}`);
  if (typeof visibleTerrainId !== 'string' || !visibleTerrainId) throw new TypeError('surface requires visibleTerrainId');
  if (!['x', 'y'].includes(axis)) throw new TypeError('surface axis must be x or y');
  const lower = finite(fromZ, 'surface.fromZ');
  const upper = finite(toZ, 'surface.toZ');
  const base = finite(groundZ, 'surface.groundZ');
  if (typeof walkable !== 'boolean' || typeof deepWater !== 'boolean') throw new TypeError('surface walkability flags must be boolean');
  const drop = oneWayDrop ? point(oneWayDrop, 'surface.oneWayDrop') : null;
  const dropMagnitude = drop ? Math.hypot(drop.x, drop.y) : 0;
  if (drop && dropMagnitude <= EPSILON) throw new TypeError('surface drop direction must be non-zero');
  return freezeDeep({
    id,
    kind,
    area: validateArea(area),
    groundZ: base,
    fromZ: lower,
    toZ: upper,
    axis,
    visibleTerrainId,
    priority: finite(priority, 'surface.priority'),
    walkable,
    deepWater,
    waterLevel: waterLevel === null ? null : finite(waterLevel, 'surface.waterLevel'),
    oneWayDrop: drop ? { x: drop.x / dropMagnitude, y: drop.y / dropMagnitude } : null,
    visibleStepId: typeof visibleStepId === 'string' && visibleStepId ? visibleStepId : null,
    ascentAllowed: kind === 'ramp' || kind === 'stairs',
  });
}

function sampleSurface(surface, x, y) {
  let groundZ = surface.groundZ;
  let normal = { x: 0, y: 0, z: 1 };
  if (surface.kind === 'ramp' || surface.kind === 'stairs') {
    const bounds = boundsForArea(surface.area);
    const minimum = surface.axis === 'x' ? bounds.minX : bounds.minY;
    const maximum = surface.axis === 'x' ? bounds.maxX : bounds.maxY;
    const coordinate = surface.axis === 'x' ? x : y;
    const ratio = clamp((coordinate - minimum) / (maximum - minimum), 0, 1);
    groundZ = surface.fromZ + (surface.toZ - surface.fromZ) * ratio;
    const slope = (surface.toZ - surface.fromZ) / (maximum - minimum);
    const raw = surface.axis === 'x' ? { x: -slope, y: 0, z: 1 } : { x: 0, y: -slope, z: 1 };
    const magnitude = Math.hypot(raw.x, raw.y, raw.z);
    normal = { x: raw.x / magnitude, y: raw.y / magnitude, z: raw.z / magnitude };
  }
  return freezeDeep({
    x,
    y,
    groundZ,
    surfaceId: surface.id,
    kind: surface.kind,
    walkable: surface.walkable && !surface.deepWater,
    deepWater: surface.deepWater,
    waterLevel: surface.waterLevel,
    normal,
    heightLayer: Math.round(groundZ / 24),
    ascentAllowed: surface.ascentAllowed,
    oneWayDrop: surface.oneWayDrop,
    visibleStepId: surface.visibleStepId,
    visibleTerrainId: surface.visibleTerrainId,
  });
}

export function createAuthoredGroundQuery({ baseSurface, surfaces = [] } = {}) {
  if (!baseSurface?.area) throw new TypeError('baseSurface is required');
  if (!Array.isArray(surfaces)) throw new TypeError('surfaces must be an array');
  const ordered = [...surfaces].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  return (x, y) => {
    finite(x, 'ground query x');
    finite(y, 'ground query y');
    const surface = ordered.find((candidate) => contains(candidate.area, x, y)) ?? baseSurface;
    return sampleSurface(surface, x, y);
  };
}

export function resolveTraversalTransition(current, next, movement = { x: 0, y: 0 }, {
  maxCurbHeight = 8,
  maxDropHeight = 16,
  maxAuthoredAscent = 64,
} = {}) {
  const currentZ = finite(current?.groundZ, 'current.groundZ');
  const nextZ = finite(next?.groundZ, 'next.groundZ');
  nonNegative(maxCurbHeight, 'maxCurbHeight');
  nonNegative(maxDropHeight, 'maxDropHeight');
  nonNegative(maxAuthoredAscent, 'maxAuthoredAscent');
  const deltaZ = nextZ - currentZ;
  const blocked = (reason) => Object.freeze({ allowed: false, reason, deltaZ, dropped: false });
  if (!next?.walkable) return blocked(next?.deepWater || next?.kind === 'water' ? 'deep-water' : 'blocked-surface');
  if (deltaZ > EPSILON) {
    if (deltaZ <= maxCurbHeight && next.visibleStepId) return Object.freeze({ allowed: true, reason: 'visible-curb', deltaZ, dropped: false });
    if (next.ascentAllowed && deltaZ <= maxAuthoredAscent) return Object.freeze({ allowed: true, reason: next.kind, deltaZ, dropped: false });
    return blocked('upward-cliff');
  }
  if (deltaZ < -maxDropHeight - EPSILON) {
    const drop = current?.oneWayDrop;
    const dot = drop ? finite(movement?.x ?? 0, 'movement.x') * drop.x + finite(movement?.y ?? 0, 'movement.y') * drop.y : -Infinity;
    if (drop && dot > EPSILON) return Object.freeze({ allowed: true, reason: 'one-way-drop', deltaZ, dropped: true });
    return blocked('downward-ledge');
  }
  return Object.freeze({ allowed: true, reason: 'continuous', deltaZ, dropped: false });
}

export function resolveSweptTraversalPath({
  start,
  end,
  queryGround,
  maxSampleDistance = 8,
  transitionOptions = {},
} = {}) {
  const origin = { x: finite(start?.x, 'start.x'), y: finite(start?.y, 'start.y') };
  const target = { x: finite(end?.x, 'end.x'), y: finite(end?.y, 'end.y') };
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  positive(maxSampleDistance, 'maxSampleDistance');
  const delta = { x: target.x - origin.x, y: target.y - origin.y };
  const distance = Math.hypot(delta.x, delta.y);
  const sampleCount = Math.max(1, Math.ceil(distance / maxSampleDistance));
  let position = origin;
  let ground = queryGround(origin.x, origin.y);
  for (let index = 1; index <= sampleCount; index += 1) {
    const time = index / sampleCount;
    const candidate = { x: origin.x + delta.x * time, y: origin.y + delta.y * time };
    const candidateGround = queryGround(candidate.x, candidate.y);
    const transition = resolveTraversalTransition(ground, candidateGround, {
      x: candidate.x - position.x,
      y: candidate.y - position.y,
    }, transitionOptions);
    if (!transition.allowed) {
      return freezeDeep({
        allowed: false,
        reason: transition.reason,
        position,
        ground,
        attemptedGround: candidateGround,
        time: (index - 1) / sampleCount,
        dropped: false,
      });
    }
    position = candidate;
    ground = candidateGround;
  }
  return freezeDeep({ allowed: true, reason: 'complete', position: target, ground, attemptedGround: ground, time: 1, dropped: false });
}

export function movementSpeedMultiplierForTransition(current, next, horizontalDistance) {
  positive(horizontalDistance, 'horizontalDistance');
  if (next?.kind === 'shallow-water') return 0.72;
  if (next?.kind === 'stairs') return 0.86;
  const slope = (finite(next?.groundZ, 'next.groundZ') - finite(current?.groundZ, 'current.groundZ')) / horizontalDistance;
  if (slope > EPSILON) return Math.max(0.9, 1 - slope * 0.2);
  if (slope < -EPSILON) return Math.min(1.04, 1 + Math.abs(slope) * 0.08);
  return 1;
}

export function resolveHeightAdvantage({ sourceZ, targetZ, baseRange, baseKnockback, layerHeight = 24 } = {}) {
  positive(layerHeight, 'layerHeight');
  nonNegative(baseRange, 'baseRange');
  nonNegative(baseKnockback, 'baseKnockback');
  const layerDelta = Math.trunc((finite(sourceZ, 'sourceZ') - finite(targetZ, 'targetZ')) / layerHeight);
  const bounded = clamp(layerDelta, -2, 2);
  const rangeMultiplier = bounded >= 0 ? 1 + bounded * 0.05 : 1 + bounded * 0.025;
  const knockbackMultiplier = bounded >= 0 ? 1 + bounded * 0.05 : 1 + bounded * 0.025;
  const stable = (value) => Math.round(value * 1e9) / 1e9;
  return Object.freeze({ layerDelta, range: stable(baseRange * rangeMultiplier), knockback: stable(baseKnockback * knockbackMultiplier) });
}

export function projectileHeightBand({ z, radius = 0 } = {}) {
  const center = finite(z, 'projectile.z');
  const halfHeight = nonNegative(radius, 'projectile.radius');
  const band = center < 24 ? 'ground' : center < 64 ? 'torso' : 'high';
  return Object.freeze({ minZ: center - halfHeight, maxZ: center + halfHeight, band });
}

function rayCircle(start, delta, center, radius) {
  const a = delta.x ** 2 + delta.y ** 2;
  if (a <= EPSILON) return null;
  const offsetX = start.x - center.x;
  const offsetY = start.y - center.y;
  const b = 2 * (offsetX * delta.x + offsetY * delta.y);
  const c = offsetX ** 2 + offsetY ** 2 - radius ** 2;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= -EPSILON && t <= 1 + EPSILON ? clamp(t, 0, 1) : null;
}

function closestPointOnSegment(position, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx ** 2 + dy ** 2;
  const t = lengthSquared <= EPSILON ? 0 : clamp(((position.x - a.x) * dx + (position.y - a.y) * dy) / lengthSquared, 0, 1);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function rayCapsule(start, delta, a, b, radius) {
  let best = rayCircle(start, delta, a, radius);
  const endpoint = rayCircle(start, delta, b, radius);
  if (endpoint !== null && (best === null || endpoint < best)) best = endpoint;
  const segmentX = b.x - a.x;
  const segmentY = b.y - a.y;
  const length = Math.hypot(segmentX, segmentY);
  if (length <= EPSILON) return best;
  const tangent = { x: segmentX / length, y: segmentY / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const distance = (start.x - a.x) * normal.x + (start.y - a.y) * normal.y;
  const velocity = delta.x * normal.x + delta.y * normal.y;
  if (Math.abs(velocity) > EPSILON) {
    for (const side of [-1, 1]) {
      const t = (side * radius - distance) / velocity;
      if (t < -EPSILON || t > 1 + EPSILON) continue;
      const position = { x: start.x + delta.x * t, y: start.y + delta.y * t };
      const closest = closestPointOnSegment(position, a, b);
      const alongDistance = Math.hypot(position.x - closest.x, position.y - closest.y);
      if (alongDistance <= radius + EPSILON && (best === null || t < best)) best = clamp(t, 0, 1);
    }
  }
  return best;
}

function sweepShape(start, delta, radius, shape) {
  if (shape.type === 'circle') return rayCircle(start, delta, shape, radius + shape.radius);
  if (shape.type === 'capsule') return rayCapsule(start, delta, shape.a, shape.b, radius + shape.radius);
  if (shape.type === 'polygon') {
    let best = null;
    for (let index = 0; index < shape.vertices.length; index += 1) {
      const t = rayCapsule(start, delta, shape.vertices[index], shape.vertices[(index + 1) % shape.vertices.length], radius);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best;
  }
  return null;
}

export function traceHeightAwareLineOfSight({ from, to, radius = 0, blockers = [] } = {}) {
  const start = { x: finite(from?.x, 'from.x'), y: finite(from?.y, 'from.y') };
  const delta = { x: finite(to?.x, 'to.x') - start.x, y: finite(to?.y, 'to.y') - start.y };
  const fromZ = finite(from?.z, 'from.z');
  const toZ = finite(to?.z, 'to.z');
  nonNegative(radius, 'radius');
  if (!Array.isArray(blockers)) throw new TypeError('blockers must be an array');
  const hits = [];
  for (const blocker of blockers) {
    const time = sweepShape(start, delta, radius, blocker.shape);
    if (time === null) continue;
    const z = fromZ + (toZ - fromZ) * time;
    if (z + radius <= blocker.minZ + EPSILON || z - radius >= blocker.maxZ - EPSILON) continue;
    hits.push({ blockerId: blocker.id, time });
  }
  hits.sort((a, b) => a.time - b.time || String(a.blockerId).localeCompare(String(b.blockerId)));
  return hits.length ? Object.freeze({ clear: false, blockerId: hits[0].blockerId, time: hits[0].time }) : Object.freeze({ clear: true });
}

export function filterLegalTraversalNeighbors(currentGround, candidates, options = {}) {
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
  return candidates.filter((candidate) => resolveTraversalTransition(
    currentGround,
    candidate.ground,
    { x: finite(candidate.x, 'candidate.x'), y: finite(candidate.y, 'candidate.y') },
    options,
  ).allowed);
}

export function buildElevationDebugContours({ bounds, spacing, queryGround } = {}) {
  const minX = finite(bounds?.minX, 'bounds.minX');
  const minY = finite(bounds?.minY, 'bounds.minY');
  const maxX = finite(bounds?.maxX, 'bounds.maxX');
  const maxY = finite(bounds?.maxY, 'bounds.maxY');
  if (maxX < minX || maxY < minY) throw new TypeError('debug contour bounds must be ordered');
  positive(spacing, 'spacing');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  const samples = [];
  for (let y = minY; y <= maxY + EPSILON; y += spacing) {
    for (let x = minX; x <= maxX + EPSILON; x += spacing) {
      const ground = queryGround(x, y);
      samples.push({ x, y, groundZ: finite(ground.groundZ, 'ground.groundZ'), surfaceId: ground.surfaceId, kind: ground.kind, label: `${ground.surfaceId} ${ground.kind} z=${ground.groundZ}` });
    }
  }
  return freezeDeep({ bounds: { minX, minY, maxX, maxY }, spacing, samples });
}
