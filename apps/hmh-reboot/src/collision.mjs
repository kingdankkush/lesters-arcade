const EPSILON = 1e-9;
const CONTACT_SKIN = 1e-6;
const MAX_DEPENETRATION_PASSES = 6;
const MAX_SLIDE_ITERATIONS = 6;

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

function normalize(vector, fallbackId = 'normal') {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude > EPSILON) return { x: vector.x / magnitude, y: vector.y / magnitude };
  let hash = 2166136261;
  for (const character of String(fallbackId)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const angle = hash / 0x1_0000_0000 * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function closestPointOnSegment(position, a, b) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const lengthSquared = abX * abX + abY * abY;
  const t = lengthSquared <= EPSILON ? 0 : clamp(((position.x - a.x) * abX + (position.y - a.y) * abY) / lengthSquared, 0, 1);
  return { x: a.x + abX * t, y: a.y + abY * t };
}

function polygonArea(vertices) {
  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return twiceArea / 2;
}

function validateConvexPolygon(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) throw new TypeError('polygon requires at least three vertices');
  const points = vertices.map((vertex, index) => point(vertex, `polygon.vertices[${index}]`));
  const area = polygonArea(points);
  if (Math.abs(area) <= EPSILON) throw new TypeError('polygon must have non-zero area');
  let direction = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) <= EPSILON) continue;
    const sign = Math.sign(cross);
    if (direction && sign !== direction) throw new TypeError('polygon must be convex');
    direction = sign;
  }
  return Object.freeze(points);
}

function validateShape(shape) {
  if (!shape || typeof shape !== 'object') throw new TypeError('blocker shape is required');
  if (shape.type === 'circle') {
    return Object.freeze({ type: 'circle', x: finite(shape.x, 'circle.x'), y: finite(shape.y, 'circle.y'), radius: positive(shape.radius, 'circle.radius') });
  }
  if (shape.type === 'capsule') {
    return Object.freeze({ type: 'capsule', a: point(shape.a, 'capsule.a'), b: point(shape.b, 'capsule.b'), radius: nonNegative(shape.radius ?? 0, 'capsule.radius') });
  }
  if (shape.type === 'polygon') return Object.freeze({ type: 'polygon', vertices: validateConvexPolygon(shape.vertices) });
  throw new TypeError(`unsupported blocker shape: ${String(shape.type)}`);
}

export function createCollisionBody({ id, kind = 'regular', radius, minZ = 0, maxZ = 1 } = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('body.id must be a non-empty string');
  if (!['player', 'regular', 'boss'].includes(kind)) throw new TypeError('body.kind must be player, regular, or boss');
  const lower = finite(minZ, 'body.minZ');
  const upper = finite(maxZ, 'body.maxZ');
  if (upper <= lower) throw new TypeError('body height range must be positive');
  return Object.freeze({ id, kind, radius: positive(radius, 'body.radius'), minZ: lower, maxZ: upper, response: kind === 'regular' ? 'soft' : 'hard' });
}

export function createStaticBlocker({
  id,
  shape,
  visibleAssetId = null,
  terrainBoundaryId = null,
  minZ = Number.NEGATIVE_INFINITY,
  maxZ = Number.POSITIVE_INFINITY,
  curbHeight = 0,
  solid = true,
} = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('blocker.id must be a non-empty string');
  if (typeof visibleAssetId !== 'string' && typeof terrainBoundaryId !== 'string') throw new TypeError('solid blocker requires visible asset or terrain boundary metadata');
  if (typeof solid !== 'boolean') throw new TypeError('blocker.solid must be boolean');
  if (!(typeof minZ === 'number' && !Number.isNaN(minZ)) || !(typeof maxZ === 'number' && !Number.isNaN(maxZ)) || maxZ <= minZ) {
    throw new TypeError('blocker height range must be ordered numbers');
  }
  return Object.freeze({
    id,
    shape: validateShape(shape),
    visibleAssetId,
    terrainBoundaryId,
    minZ,
    maxZ,
    curbHeight: nonNegative(curbHeight, 'blocker.curbHeight'),
    solid,
  });
}

export function auditCollisionWorld({ blockers = [], visibleBarriers = [] } = {}) {
  if (!Array.isArray(blockers) || !Array.isArray(visibleBarriers)) throw new TypeError('collision audit inputs must be arrays');
  const errors = [];
  const blockerIds = new Set();
  for (const blocker of blockers) {
    if (!blocker?.id) {
      errors.push('collision blocker is missing an id');
      continue;
    }
    if (blockerIds.has(blocker.id)) errors.push(`duplicate collision blocker id ${blocker.id}`);
    blockerIds.add(blocker.id);
    if (blocker.solid !== false && !blocker.visibleAssetId && !blocker.terrainBoundaryId) errors.push(`solid blocker ${blocker.id} has no visible metadata`);
  }
  const visibleBarrierById = new Map(visibleBarriers.map((barrier) => [barrier?.id, barrier]));
  for (const barrier of visibleBarriers) {
    if (!barrier?.hard) continue;
    const references = Array.isArray(barrier.collisionBlockerIds) ? barrier.collisionBlockerIds : [];
    if (references.length === 0) errors.push(`visible hard barrier ${barrier.id} has no collision geometry`);
    for (const blockerId of references) {
      if (!blockerIds.has(blockerId)) errors.push(`visible hard barrier ${barrier.id} references missing blocker ${blockerId}`);
    }
  }
  for (const blocker of blockers) {
    if (!blocker?.id || blocker.solid === false) continue;
    const visibleId = blocker.visibleAssetId ?? blocker.terrainBoundaryId;
    const visibleBarrier = visibleBarrierById.get(visibleId);
    const references = Array.isArray(visibleBarrier?.collisionBlockerIds) ? visibleBarrier.collisionBlockerIds : [];
    if (!visibleBarrier || !references.includes(blocker.id)) errors.push(`solid blocker ${blocker.id} has no matching visible barrier ${visibleId}`);
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) });
}

function heightOverlaps(body, z, blocker) {
  const bodyMinimum = z + body.minZ;
  const bodyMaximum = z + body.maxZ;
  return bodyMaximum > blocker.minZ + EPSILON && bodyMinimum < blocker.maxZ - EPSILON;
}

function pointInsidePolygon(position, vertices) {
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index, index += 1) {
    const a = vertices[index];
    const b = vertices[previous];
    if (((a.y > position.y) !== (b.y > position.y))
      && position.x < (b.x - a.x) * (position.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function closestPolygonBoundary(position, vertices) {
  let best = null;
  for (let index = 0; index < vertices.length; index += 1) {
    const candidate = closestPointOnSegment(position, vertices[index], vertices[(index + 1) % vertices.length]);
    const distanceSquared = (candidate.x - position.x) ** 2 + (candidate.y - position.y) ** 2;
    if (!best || distanceSquared < best.distanceSquared - EPSILON) best = { ...candidate, distanceSquared, edgeIndex: index };
  }
  return best;
}

function penetrationAgainst(position, radius, blocker) {
  let closest;
  let combinedRadius = radius;
  let inside = false;
  if (blocker.shape.type === 'circle') {
    closest = { x: blocker.shape.x, y: blocker.shape.y };
    combinedRadius += blocker.shape.radius;
  } else if (blocker.shape.type === 'capsule') {
    closest = closestPointOnSegment(position, blocker.shape.a, blocker.shape.b);
    combinedRadius += blocker.shape.radius;
  } else {
    const boundary = closestPolygonBoundary(position, blocker.shape.vertices);
    closest = { x: boundary.x, y: boundary.y };
    inside = pointInsidePolygon(position, blocker.shape.vertices);
  }
  const dx = position.x - closest.x;
  const dy = position.y - closest.y;
  const distance = Math.hypot(dx, dy);
  if (blocker.shape.type === 'polygon' && inside) {
    const normal = distance > EPSILON ? { x: -dx / distance, y: -dy / distance } : normalize({ x: 0, y: 0 }, blocker.id);
    return { x: normal.x * (distance + radius + CONTACT_SKIN), y: normal.y * (distance + radius + CONTACT_SKIN), normal };
  }
  if (distance >= combinedRadius - EPSILON) return null;
  const normal = distance > EPSILON ? { x: dx / distance, y: dy / distance } : normalize({ x: 0, y: 0 }, blocker.id);
  const depth = combinedRadius - distance + CONTACT_SKIN;
  return { x: normal.x * depth, y: normal.y * depth, normal };
}

function rayCircle(start, delta, center, radius, fallbackId) {
  const a = delta.x * delta.x + delta.y * delta.y;
  if (a <= EPSILON) return null;
  const offsetX = start.x - center.x;
  const offsetY = start.y - center.y;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c < -EPSILON) return { t: 0, normal: normalize({ x: offsetX, y: offsetY }, fallbackId) };
  const b = 2 * (offsetX * delta.x + offsetY * delta.y);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a);
  if (t < -EPSILON || t > 1 + EPSILON) return null;
  const clampedT = clamp(t, 0, 1);
  const contact = { x: start.x + delta.x * clampedT, y: start.y + delta.y * clampedT };
  return { t: clampedT, normal: normalize({ x: contact.x - center.x, y: contact.y - center.y }, fallbackId) };
}

function earlierHit(first, second) {
  if (!first) return second;
  if (!second) return first;
  if (second.t < first.t - EPSILON) return second;
  return first;
}

function rayCapsule(start, delta, a, b, radius, fallbackId) {
  let best = earlierHit(rayCircle(start, delta, a, radius, fallbackId), rayCircle(start, delta, b, radius, fallbackId));
  const segmentX = b.x - a.x;
  const segmentY = b.y - a.y;
  const length = Math.hypot(segmentX, segmentY);
  if (length <= EPSILON) return best;
  const tangent = { x: segmentX / length, y: segmentY / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const distance = (start.x - a.x) * normal.x + (start.y - a.y) * normal.y;
  const normalVelocity = delta.x * normal.x + delta.y * normal.y;
  if (Math.abs(normalVelocity) > EPSILON) {
    for (const side of [-1, 1]) {
      const t = (side * radius - distance) / normalVelocity;
      if (t < -EPSILON || t > 1 + EPSILON) continue;
      const contactX = start.x + delta.x * t;
      const contactY = start.y + delta.y * t;
      const along = (contactX - a.x) * tangent.x + (contactY - a.y) * tangent.y;
      if (along < -EPSILON || along > length + EPSILON) continue;
      best = earlierHit(best, { t: clamp(t, 0, 1), normal: { x: normal.x * side, y: normal.y * side } });
    }
  }
  return best;
}

function sweepAgainstBlocker(start, delta, radius, blocker) {
  if (blocker.shape.type === 'circle') {
    return rayCircle(start, delta, blocker.shape, radius + blocker.shape.radius, blocker.id);
  }
  if (blocker.shape.type === 'capsule') {
    return rayCapsule(start, delta, blocker.shape.a, blocker.shape.b, radius + blocker.shape.radius, blocker.id);
  }
  let best = null;
  const vertices = blocker.shape.vertices;
  for (let index = 0; index < vertices.length; index += 1) {
    best = earlierHit(best, rayCapsule(start, delta, vertices[index], vertices[(index + 1) % vertices.length], radius, `${blocker.id}:${index}`));
  }
  return best;
}

function boundaryHits(position, delta, radius, bounds) {
  if (!bounds) return [];
  const minX = finite(bounds.minX, 'bounds.minX') + radius;
  const minY = finite(bounds.minY, 'bounds.minY') + radius;
  const maxX = finite(bounds.maxX, 'bounds.maxX') - radius;
  const maxY = finite(bounds.maxY, 'bounds.maxY') - radius;
  if (maxX < minX || maxY < minY) throw new TypeError('bounds must contain the collision body');
  if (typeof bounds.visibleBoundaryId !== 'string' || !bounds.visibleBoundaryId) throw new TypeError('bounds require visibleBoundaryId metadata');
  const hits = [];
  const add = (t, normal, side) => {
    if (t >= -EPSILON && t <= 1 + EPSILON) hits.push({ t: clamp(t, 0, 1), normal, blockerId: `${bounds.visibleBoundaryId}:${side}` });
  };
  if (delta.x < -EPSILON) add((minX - position.x) / delta.x, { x: 1, y: 0 }, 'left');
  if (delta.x > EPSILON) add((maxX - position.x) / delta.x, { x: -1, y: 0 }, 'right');
  if (delta.y < -EPSILON) add((minY - position.y) / delta.y, { x: 0, y: 1 }, 'top');
  if (delta.y > EPSILON) add((maxY - position.y) / delta.y, { x: 0, y: -1 }, 'bottom');
  return hits;
}

function chooseEarliestHit(hits) {
  return hits.filter(Boolean).sort((a, b) => a.t - b.t || String(a.blockerId).localeCompare(String(b.blockerId)))[0] ?? null;
}

export function resolveSweptCircleMotion({
  body,
  start,
  delta,
  blockers = [],
  bounds = null,
  priorZeroDisplacementFrames = 0,
} = {}) {
  if (!body || typeof body.radius !== 'number') throw new TypeError('collision body is required');
  if (!Array.isArray(blockers)) throw new TypeError('blockers must be an array');
  const requested = { x: finite(delta?.x, 'delta.x'), y: finite(delta?.y, 'delta.y') };
  const position = { x: finite(start?.x, 'start.x'), y: finite(start?.y, 'start.y') };
  const z = finite(start?.z ?? 0, 'start.z');
  const activeBlockers = blockers.filter((blocker) => blocker?.solid !== false && heightOverlaps(body, z, blocker)).sort((a, b) => a.id.localeCompare(b.id));
  const depenetrations = [];

  if (bounds) {
    const minX = finite(bounds.minX, 'bounds.minX') + body.radius;
    const minY = finite(bounds.minY, 'bounds.minY') + body.radius;
    const maxX = finite(bounds.maxX, 'bounds.maxX') - body.radius;
    const maxY = finite(bounds.maxY, 'bounds.maxY') - body.radius;
    position.x = clamp(position.x, minX, maxX);
    position.y = clamp(position.y, minY, maxY);
  }

  for (let pass = 0; pass < MAX_DEPENETRATION_PASSES; pass += 1) {
    let changed = false;
    for (const blocker of activeBlockers) {
      const penetration = penetrationAgainst(position, body.radius, blocker);
      if (!penetration) continue;
      position.x += penetration.x;
      position.y += penetration.y;
      depenetrations.push(Object.freeze({ blockerId: blocker.id, x: penetration.x, y: penetration.y, normal: Object.freeze({ ...penetration.normal }) }));
      changed = true;
    }
    if (!changed) break;
  }

  const resolvedStart = { ...position };
  let remaining = { ...requested };
  const contacts = [];
  for (let iteration = 0; iteration < MAX_SLIDE_ITERATIONS; iteration += 1) {
    if (Math.hypot(remaining.x, remaining.y) <= EPSILON) break;
    const hits = [];
    for (const blocker of activeBlockers) {
      const hit = sweepAgainstBlocker(position, remaining, body.radius, blocker);
      if (hit) hits.push({ ...hit, blockerId: blocker.id });
    }
    hits.push(...boundaryHits(position, remaining, body.radius, bounds));
    const hit = chooseEarliestHit(hits);
    if (!hit) {
      position.x += remaining.x;
      position.y += remaining.y;
      remaining = { x: 0, y: 0 };
      break;
    }
    position.x += remaining.x * hit.t + hit.normal.x * CONTACT_SKIN;
    position.y += remaining.y * hit.t + hit.normal.y * CONTACT_SKIN;
    contacts.push(Object.freeze({ blockerId: hit.blockerId, time: hit.t, normal: Object.freeze({ ...hit.normal }) }));
    const leftoverScale = 1 - hit.t;
    remaining = { x: remaining.x * leftoverScale, y: remaining.y * leftoverScale };
    const inward = remaining.x * hit.normal.x + remaining.y * hit.normal.y;
    if (inward < 0) {
      remaining.x -= hit.normal.x * inward;
      remaining.y -= hit.normal.y * inward;
    }
  }

  const actual = { x: position.x - resolvedStart.x, y: position.y - resolvedStart.y };
  const requestedDistance = Math.hypot(requested.x, requested.y);
  const actualDistance = Math.hypot(actual.x, actual.y);
  const stalled = requestedDistance > EPSILON && actualDistance <= Math.max(CONTACT_SKIN * 2, requestedDistance * 1e-4);
  const zeroDisplacementFrames = stalled ? Math.max(0, Math.trunc(priorZeroDisplacementFrames)) + 1 : 0;
  return Object.freeze({
    position: Object.freeze({ x: position.x, y: position.y, z }),
    displacement: Object.freeze(actual),
    remaining: Object.freeze(remaining),
    contacts: Object.freeze(contacts),
    depenetrations: Object.freeze(depenetrations),
    telemetry: Object.freeze({ requestedDistance, actualDistance, stalled, zeroDisplacementFrames }),
  });
}
