const EPSILON = 1e-9;
const CONTACT_EPSILON = 1e-6;
const SHARP_GROUND_DROP = 8;
const GROUND_TRANSITION_SEARCH_STEPS = 16;
const PROJECTILE_POLICIES = new Set(['stop', 'pierce', 'ricochet', 'splash', 'pellet', 'hitscan']);

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegative(value, name) {
  finite(value, name);
  if (value < 0) throw new TypeError(`${name} must be non-negative`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function point3(value, name) {
  return Object.freeze({
    x: finite(value?.x, `${name}.x`),
    y: finite(value?.y, `${name}.y`),
    z: finite(value?.z, `${name}.z`),
  });
}

function point2(value, name) {
  return Object.freeze({ x: finite(value?.x, `${name}.x`), y: finite(value?.y, `${name}.y`) });
}

function validateHeightTransition(value) {
  if (value == null) return null;
  const time = finite(value.time, 'heightTransition.time');
  if (time <= EPSILON || time >= 1 - EPSILON) throw new TypeError('heightTransition.time must be inside the projectile step');
  return Object.freeze({ time });
}

function normalize(vector, fallbackId = 'vector') {
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

function validateLocalShape(shape, name) {
  if (!shape || typeof shape !== 'object') throw new TypeError(`${name} is required`);
  if (shape.type === 'circle') {
    return Object.freeze({
      type: 'circle',
      x: finite(shape.x ?? 0, `${name}.x`),
      y: finite(shape.y ?? 0, `${name}.y`),
      radius: positive(shape.radius, `${name}.radius`),
    });
  }
  if (shape.type === 'capsule') {
    return Object.freeze({
      type: 'capsule',
      a: point2(shape.a, `${name}.a`),
      b: point2(shape.b, `${name}.b`),
      radius: nonNegative(shape.radius ?? 0, `${name}.radius`),
    });
  }
  throw new TypeError(`${name}.type must be circle or capsule`);
}

function validatePolicy(policy = { type: 'stop' }) {
  if (!PROJECTILE_POLICIES.has(policy?.type)) throw new TypeError(`unsupported projectile policy: ${String(policy?.type)}`);
  const result = { type: policy.type };
  if (policy.type === 'pierce') {
    const maxTargets = policy.maxTargets ?? 2;
    if (!Number.isInteger(maxTargets) || maxTargets <= 0) throw new TypeError('pierce policy maxTargets must be a positive integer');
    result.maxTargets = maxTargets;
  }
  if (policy.type === 'ricochet') {
    const maxBounces = policy.maxBounces ?? 1;
    if (!Number.isInteger(maxBounces) || maxBounces < 0 || maxBounces > 4) throw new TypeError('ricochet policy maxBounces must be an integer from zero to four');
    result.maxBounces = maxBounces;
  }
  if (policy.type === 'splash') result.radius = positive(policy.radius, 'splash policy radius');
  return Object.freeze(result);
}

export function createHurtTarget({
  id,
  bodyShape,
  hurtShape,
  previousGround,
  currentGround,
  minZ,
  maxZ,
  health,
  active = true,
} = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('hurt target id must be a non-empty string');
  if (typeof active !== 'boolean') throw new TypeError('hurt target active must be boolean');
  const lower = finite(minZ, 'hurt target minZ');
  const upper = finite(maxZ, 'hurt target maxZ');
  if (upper <= lower) throw new TypeError('hurt target height range must be positive');
  return Object.freeze({
    id,
    bodyShape: validateLocalShape(bodyShape, 'bodyShape'),
    hurtShape: validateLocalShape(hurtShape, 'hurtShape'),
    previousGround: point3(previousGround, 'previousGround'),
    currentGround: point3(currentGround, 'currentGround'),
    minZ: lower,
    maxZ: upper,
    health: positive(health, 'hurt target health'),
    active,
  });
}

export function createProjectileState({ id, ownerId, previous, current, heightTransition = null, radius = 0, damage, policy = { type: 'stop' } } = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('projectile id must be a non-empty string');
  if (typeof ownerId !== 'string' || !ownerId) throw new TypeError('projectile ownerId must be a non-empty string');
  return Object.freeze({
    id,
    ownerId,
    previous: point3(previous, 'projectile.previous'),
    current: point3(current, 'projectile.current'),
    heightTransition: validateHeightTransition(heightTransition),
    radius: nonNegative(radius, 'projectile.radius'),
    damage: positive(damage, 'projectile.damage'),
    policy: validatePolicy(policy),
  });
}

export function planProjectileFlightStep({
  previous,
  velocity,
  dtSeconds,
  previousGroundZ,
  queryGround,
  flightHeight,
} = {}) {
  const start = point3(previous, 'projectile flight previous');
  const speed = point2(velocity, 'projectile flight velocity');
  const dt = positive(dtSeconds, 'projectile flight dtSeconds');
  const groundZ = finite(previousGroundZ, 'projectile flight previousGroundZ');
  const height = positive(flightHeight, 'projectile flight flightHeight');
  if (typeof queryGround !== 'function') throw new TypeError('projectile flight queryGround must be a function');
  const currentX = start.x + speed.x * dt;
  const currentY = start.y + speed.y * dt;
  const nextGroundZ = finite(queryGround(currentX, currentY)?.groundZ, 'projectile flight groundZ');
  const restZ = nextGroundZ + height;
  const currentZ = nextGroundZ < groundZ - EPSILON ? Math.min(start.z, restZ) : start.z;
  let heightTransition = null;

  // A sharp authored ledge is a discontinuous surface, not a long airborne
  // ramp. Locate that boundary deterministically so collision remains high on
  // the platform and low immediately after the edge. Small ramp/step changes
  // keep ordinary linear interpolation; upward terrain never pulls a shot up.
  if (groundZ - nextGroundZ > SHARP_GROUND_DROP + EPSILON && currentZ < start.z - EPSILON) {
    let low = 0;
    let high = 1;
    for (let index = 0; index < GROUND_TRANSITION_SEARCH_STEPS; index += 1) {
      const time = (low + high) * 0.5;
      const sampleX = start.x + (currentX - start.x) * time;
      const sampleY = start.y + (currentY - start.y) * time;
      const sampleGroundZ = finite(queryGround(sampleX, sampleY)?.groundZ, 'projectile flight transition groundZ');
      if (sampleGroundZ < groundZ - SHARP_GROUND_DROP - EPSILON) high = time;
      else low = time;
    }
    if (high > EPSILON && high < 1 - EPSILON) heightTransition = Object.freeze({ time: high });
  }

  return Object.freeze({
    previous: start,
    current: Object.freeze({ x: currentX, y: currentY, z: currentZ }),
    groundZ: nextGroundZ,
    heightTransition,
  });
}

function shapeExtents(shape) {
  if (shape.type === 'circle') {
    return { minX: shape.x - shape.radius, minY: shape.y - shape.radius, maxX: shape.x + shape.radius, maxY: shape.y + shape.radius };
  }
  return {
    minX: Math.min(shape.a.x, shape.b.x) - shape.radius,
    minY: Math.min(shape.a.y, shape.b.y) - shape.radius,
    maxX: Math.max(shape.a.x, shape.b.x) + shape.radius,
    maxY: Math.max(shape.a.y, shape.b.y) + shape.radius,
  };
}

function targetSweptBounds(target) {
  const extents = shapeExtents(target.hurtShape);
  return {
    minX: Math.min(target.previousGround.x, target.currentGround.x) + extents.minX,
    minY: Math.min(target.previousGround.y, target.currentGround.y) + extents.minY,
    maxX: Math.max(target.previousGround.x, target.currentGround.x) + extents.maxX,
    maxY: Math.max(target.previousGround.y, target.currentGround.y) + extents.maxY,
  };
}

function projectileBounds(projectile) {
  return {
    minX: Math.min(projectile.previous.x, projectile.current.x) - projectile.radius,
    minY: Math.min(projectile.previous.y, projectile.current.y) - projectile.radius,
    maxX: Math.max(projectile.previous.x, projectile.current.x) + projectile.radius,
    maxY: Math.max(projectile.previous.y, projectile.current.y) + projectile.radius,
  };
}

function boundsOverlap(a, b) {
  return a.maxX >= b.minX - EPSILON && a.minX <= b.maxX + EPSILON
    && a.maxY >= b.minY - EPSILON && a.minY <= b.maxY + EPSILON;
}

function assertUniqueIds(items, label) {
  if (!Array.isArray(items)) throw new TypeError(`${label}s must be an array`);
  const ids = new Set();
  for (const item of items) {
    if (!item?.id) throw new TypeError(`${label} id is required`);
    if (ids.has(item.id)) throw new TypeError(`duplicate ${label} id ${item.id}`);
    ids.add(item.id);
  }
}

function assertUniqueTargets(targets) {
  assertUniqueIds(targets, 'target');
}

export function queryProjectileCandidates({ projectile, targets = [] } = {}) {
  if (!projectile?.previous || !projectile?.current) throw new TypeError('projectile is required');
  assertUniqueTargets(targets);
  const queryBounds = projectileBounds(projectile);
  return targets
    .filter((target) => target.active && target.health > 0 && boundsOverlap(queryBounds, targetSweptBounds(target)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export class UniformHurtboxGrid {
  constructor({ targets = [], cellSize = 96 } = {}) {
    this.cellSize = positive(cellSize, 'cellSize');
    assertUniqueTargets(targets);
    this.targetsById = new Map(targets.map((target) => [target.id, target]));
    this.cells = new Map();
    for (const target of targets) {
      if (!target.active || target.health <= 0) continue;
      const bounds = targetSweptBounds(target);
      for (const key of this.#keys(bounds)) {
        const ids = this.cells.get(key) ?? [];
        ids.push(target.id);
        this.cells.set(key, ids);
      }
    }
    for (const ids of this.cells.values()) ids.sort();
  }

  #keys(bounds) {
    const keys = [];
    const minCellX = Math.floor(bounds.minX / this.cellSize);
    const minCellY = Math.floor(bounds.minY / this.cellSize);
    const maxCellX = Math.floor(bounds.maxX / this.cellSize);
    const maxCellY = Math.floor(bounds.maxY / this.cellSize);
    for (let y = minCellY; y <= maxCellY; y += 1) {
      for (let x = minCellX; x <= maxCellX; x += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }

  query(projectile) {
    if (!projectile?.previous || !projectile?.current) throw new TypeError('projectile is required');
    const bounds = projectileBounds(projectile);
    const candidateIds = new Set();
    for (const key of this.#keys(bounds)) {
      for (const id of this.cells.get(key) ?? []) candidateIds.add(id);
    }
    return [...candidateIds]
      .sort()
      .map((id) => this.targetsById.get(id))
      .filter((target) => boundsOverlap(bounds, targetSweptBounds(target)));
  }
}

function closestPointOnSegment(position, a, b) {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const lengthSquared = abX ** 2 + abY ** 2;
  const time = lengthSquared <= EPSILON ? 0 : clamp(((position.x - a.x) * abX + (position.y - a.y) * abY) / lengthSquared, 0, 1);
  return { x: a.x + abX * time, y: a.y + abY * time };
}

function rayCircle(start, delta, center, radius, fallbackId) {
  const quadratic = delta.x ** 2 + delta.y ** 2;
  const offset = { x: start.x - center.x, y: start.y - center.y };
  const constant = offset.x ** 2 + offset.y ** 2 - radius ** 2;
  if (constant <= EPSILON) return { time: 0, normal: normalize(offset, fallbackId) };
  if (quadratic <= EPSILON) return null;
  const linear = 2 * (offset.x * delta.x + offset.y * delta.y);
  const discriminant = linear ** 2 - 4 * quadratic * constant;
  if (discriminant < 0) return null;
  const time = (-linear - Math.sqrt(Math.max(0, discriminant))) / (2 * quadratic);
  if (time < -EPSILON || time > 1 + EPSILON) return null;
  const boundedTime = clamp(time, 0, 1);
  const contact = { x: start.x + delta.x * boundedTime, y: start.y + delta.y * boundedTime };
  return { time: boundedTime, normal: normalize({ x: contact.x - center.x, y: contact.y - center.y }, fallbackId) };
}

function earlier(first, second) {
  if (!first) return second;
  if (!second) return first;
  return second.time < first.time - EPSILON ? second : first;
}

function rayCapsule(start, delta, a, b, radius, fallbackId) {
  let best = earlier(rayCircle(start, delta, a, radius, fallbackId), rayCircle(start, delta, b, radius, fallbackId));
  const axis = { x: b.x - a.x, y: b.y - a.y };
  const length = Math.hypot(axis.x, axis.y);
  if (length <= EPSILON) return best;
  const tangent = { x: axis.x / length, y: axis.y / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const startDistance = (start.x - a.x) * normal.x + (start.y - a.y) * normal.y;
  const normalVelocity = delta.x * normal.x + delta.y * normal.y;
  if (Math.abs(normalVelocity) <= EPSILON) return best;
  for (const side of [-1, 1]) {
    const time = (side * radius - startDistance) / normalVelocity;
    if (time < -EPSILON || time > 1 + EPSILON) continue;
    const position = { x: start.x + delta.x * time, y: start.y + delta.y * time };
    const closest = closestPointOnSegment(position, a, b);
    if (Math.hypot(position.x - closest.x, position.y - closest.y) > radius + EPSILON) continue;
    best = earlier(best, { time: clamp(time, 0, 1), normal: { x: normal.x * side, y: normal.y * side } });
  }
  return best;
}

function rayPolygon(start, delta, vertices, radius, fallbackId) {
  let best = null;
  for (let index = 0; index < vertices.length; index += 1) {
    best = earlier(best, rayCapsule(start, delta, vertices[index], vertices[(index + 1) % vertices.length], radius, `${fallbackId}:${index}`));
  }
  return best;
}

function sweepShape(start, delta, radius, shape, fallbackId) {
  if (shape.type === 'circle') return rayCircle(start, delta, shape, radius + shape.radius, fallbackId);
  if (shape.type === 'capsule') return rayCapsule(start, delta, shape.a, shape.b, radius + shape.radius, fallbackId);
  if (shape.type === 'polygon') return rayPolygon(start, delta, shape.vertices, radius, fallbackId);
  throw new TypeError(`unsupported sweep shape ${String(shape.type)}`);
}

function lerp(first, second, time) {
  return first + (second - first) * time;
}

function projectileHeightAt(projectile, time) {
  if (projectile.heightTransition) return time < projectile.heightTransition.time ? projectile.previous.z : projectile.current.z;
  return lerp(projectile.previous.z, projectile.current.z, time);
}

function targetShapeAt(target, time) {
  const ground = {
    x: lerp(target.previousGround.x, target.currentGround.x, time),
    y: lerp(target.previousGround.y, target.currentGround.y, time),
  };
  if (target.hurtShape.type === 'circle') {
    return { type: 'circle', x: ground.x + target.hurtShape.x, y: ground.y + target.hurtShape.y, radius: target.hurtShape.radius };
  }
  return {
    type: 'capsule',
    a: { x: ground.x + target.hurtShape.a.x, y: ground.y + target.hurtShape.a.y },
    b: { x: ground.x + target.hurtShape.b.x, y: ground.y + target.hurtShape.b.y },
    radius: target.hurtShape.radius,
  };
}

function movingTargetHit(projectile, target, timeOffset = 0, timeScale = 1, segmentStart = projectile.previous, segmentEnd = projectile.current) {
  const targetStartGround = {
    x: lerp(target.previousGround.x, target.currentGround.x, timeOffset),
    y: lerp(target.previousGround.y, target.currentGround.y, timeOffset),
  };
  const targetEndTime = timeOffset + timeScale;
  const targetEndGround = {
    x: lerp(target.previousGround.x, target.currentGround.x, targetEndTime),
    y: lerp(target.previousGround.y, target.currentGround.y, targetEndTime),
  };
  const relativeStart = { x: segmentStart.x - targetStartGround.x, y: segmentStart.y - targetStartGround.y };
  const relativeDelta = {
    x: segmentEnd.x - segmentStart.x - (targetEndGround.x - targetStartGround.x),
    y: segmentEnd.y - segmentStart.y - (targetEndGround.y - targetStartGround.y),
  };
  const localShape = target.hurtShape;
  const hit = sweepShape(relativeStart, relativeDelta, projectile.radius, localShape, target.id);
  if (!hit) return null;
  const globalTime = timeOffset + hit.time * timeScale;
  const projectileZ = projectileHeightAt(projectile, globalTime);
  const targetGroundZ = lerp(target.previousGround.z, target.currentGround.z, globalTime);
  if (projectileZ + projectile.radius <= targetGroundZ + target.minZ + EPSILON
    || projectileZ - projectile.radius >= targetGroundZ + target.maxZ - EPSILON) return null;
  return {
    kind: 'target',
    id: target.id,
    targetId: target.id,
    time: globalTime,
    segmentTime: hit.time,
    point: {
      x: lerp(segmentStart.x, segmentEnd.x, hit.time),
      y: lerp(segmentStart.y, segmentEnd.y, hit.time),
      z: projectileZ,
    },
    normal: hit.normal,
  };
}

function coverHit(projectile, blocker, timeOffset = 0, timeScale = 1, segmentStart = projectile.previous, segmentEnd = projectile.current) {
  if (blocker?.solid === false || blocker?.combatCover !== true) return null;
  const start = { x: segmentStart.x, y: segmentStart.y };
  const delta = { x: segmentEnd.x - segmentStart.x, y: segmentEnd.y - segmentStart.y };
  const hit = sweepShape(start, delta, projectile.radius, blocker.shape, blocker.id);
  if (!hit) return null;
  const globalTime = timeOffset + hit.time * timeScale;
  const z = projectileHeightAt(projectile, globalTime);
  if (z + projectile.radius <= blocker.minZ + EPSILON || z - projectile.radius >= blocker.maxZ - EPSILON) return null;
  return {
    kind: 'cover',
    id: blocker.id,
    blockerId: blocker.id,
    time: globalTime,
    segmentTime: hit.time,
    point: {
      x: lerp(segmentStart.x, segmentEnd.x, hit.time),
      y: lerp(segmentStart.y, segmentEnd.y, hit.time),
      z,
    },
    normal: hit.normal,
  };
}

function eventOrder(first, second) {
  if (Math.abs(first.time - second.time) > EPSILON) return first.time - second.time;
  if (first.kind !== second.kind) return first.kind === 'cover' ? -1 : 1;
  return first.id.localeCompare(second.id);
}

function collectSegmentEvents(projectile, targets, blockers, timeOffset, timeScale, segmentStart, segmentEnd) {
  const events = [];
  for (const target of targets) {
    const hit = movingTargetHit(projectile, target, timeOffset, timeScale, segmentStart, segmentEnd);
    if (hit) events.push(hit);
  }
  for (const blocker of blockers) {
    const hit = coverHit(projectile, blocker, timeOffset, timeScale, segmentStart, segmentEnd);
    if (hit) events.push(hit);
  }
  return events.sort(eventOrder);
}

function freezeHit(projectile, event, kind = 'direct') {
  return Object.freeze({
    projectileId: projectile.id,
    targetId: event.targetId,
    time: event.time,
    point: Object.freeze({ ...event.point }),
    damage: projectile.damage,
    kind,
  });
}

function resolveSimplePolicy(projectile, targets, blockers) {
  const events = collectSegmentEvents(projectile, targets, blockers, 0, 1, projectile.previous, projectile.current);
  const cover = events.find((event) => event.kind === 'cover') ?? null;
  const targetsBeforeCover = events.filter((event) => event.kind === 'target' && (!cover || event.time < cover.time - EPSILON));
  const seen = new Set();
  const uniqueTargets = targetsBeforeCover.filter((event) => !seen.has(event.targetId) && seen.add(event.targetId));
  if (projectile.policy.type === 'pierce') return { hits: uniqueTargets.slice(0, projectile.policy.maxTargets).map((event) => freezeHit(projectile, event)), cover };
  const firstEvent = events[0] ?? null;
  return {
    hits: firstEvent?.kind === 'target' ? [freezeHit(projectile, firstEvent)] : [],
    cover: firstEvent?.kind === 'cover' ? firstEvent : null,
  };
}

function resolveSplashPolicy(projectile, targets, blockers) {
  const direct = resolveSimplePolicy({ ...projectile, policy: { type: 'stop' } }, targets, blockers);
  const impact = direct.hits[0]?.point ?? direct.cover?.point ?? projectile.current;
  const impactTime = direct.hits[0]?.time ?? direct.cover?.time ?? 1;
  const directTargetId = direct.hits[0]?.targetId ?? null;
  const candidates = [];
  for (const target of targets) {
    const shape = targetShapeAt(target, impactTime);
    const center = shape.type === 'circle'
      ? { x: shape.x, y: shape.y }
      : closestPointOnSegment(impact, shape.a, shape.b);
    const targetRadius = shape.radius;
    const groundZ = lerp(target.previousGround.z, target.currentGround.z, impactTime);
    if (impact.z < groundZ + target.minZ - projectile.policy.radius || impact.z > groundZ + target.maxZ + projectile.policy.radius) continue;
    const distance = Math.hypot(impact.x - center.x, impact.y - center.y);
    if (distance <= projectile.policy.radius + targetRadius + EPSILON) candidates.push({ target, distance });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.target.id.localeCompare(b.target.id));
  const hits = candidates.map(({ target }) => Object.freeze({
    projectileId: projectile.id,
    targetId: target.id,
    time: impactTime,
    point: Object.freeze({ ...impact }),
    damage: projectile.damage,
    kind: target.id === directTargetId ? 'direct' : 'splash',
  }));
  return { hits, cover: direct.cover };
}

function resolveRicochetPolicy(projectile, targets, blockers) {
  const hits = [];
  const seen = new Set();
  let timeOffset = 0;
  let segmentStart = projectile.previous;
  let segmentEnd = projectile.current;
  let ricochets = 0;
  let finalCover = null;
  for (let bounce = 0; bounce <= projectile.policy.maxBounces; bounce += 1) {
    const timeScale = 1 - timeOffset;
    if (timeScale <= EPSILON) break;
    const events = collectSegmentEvents(projectile, targets, blockers, timeOffset, timeScale, segmentStart, segmentEnd);
    const cover = events.find((event) => event.kind === 'cover') ?? null;
    for (const event of events) {
      if (event.kind !== 'target' || (cover && event.time >= cover.time - EPSILON) || seen.has(event.targetId)) continue;
      seen.add(event.targetId);
      hits.push(freezeHit(projectile, event));
    }
    if (!cover) break;
    finalCover = cover;
    if (bounce >= projectile.policy.maxBounces) break;
    const remainingFraction = Math.max(0, 1 - cover.segmentTime);
    const segmentDelta = { x: segmentEnd.x - segmentStart.x, y: segmentEnd.y - segmentStart.y };
    const incoming = { x: segmentDelta.x * remainingFraction, y: segmentDelta.y * remainingFraction };
    const dot = incoming.x * cover.normal.x + incoming.y * cover.normal.y;
    const reflected = { x: incoming.x - 2 * dot * cover.normal.x, y: incoming.y - 2 * dot * cover.normal.y };
    timeOffset = cover.time;
    segmentStart = {
      x: cover.point.x + cover.normal.x * CONTACT_EPSILON,
      y: cover.point.y + cover.normal.y * CONTACT_EPSILON,
      z: cover.point.z,
    };
    segmentEnd = {
      x: segmentStart.x + reflected.x,
      y: segmentStart.y + reflected.y,
      z: projectile.current.z,
    };
    ricochets += 1;
  }
  hits.sort((a, b) => a.time - b.time || a.targetId.localeCompare(b.targetId));
  return { hits, cover: finalCover, ricochets };
}

export function resolveProjectilePath({ projectile, targets = [], blockers = [], broadphase = null } = {}) {
  projectile = createProjectileState(projectile);
  assertUniqueIds(targets, 'target');
  assertUniqueIds(blockers, 'blocker');
  if (broadphase !== null && typeof broadphase?.query !== 'function') {
    throw new TypeError('broadphase must expose query(projectile)');
  }
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const queriedTargets = broadphase
    ? broadphase.query(projectile).map((candidate) => targetById.get(candidate.id)).filter(Boolean)
    : queryProjectileCandidates({ projectile, targets });
  const activeTargets = ['splash', 'ricochet'].includes(projectile.policy.type)
    ? targets.filter((target) => target.active && target.health > 0).sort((a, b) => a.id.localeCompare(b.id))
    : queriedTargets;
  let resolution;
  if (projectile.policy.type === 'splash') resolution = resolveSplashPolicy(projectile, activeTargets, blockers);
  else if (projectile.policy.type === 'ricochet') resolution = resolveRicochetPolicy(projectile, activeTargets, blockers);
  else resolution = resolveSimplePolicy(projectile, activeTargets, blockers);
  return Object.freeze({
    projectileId: projectile.id,
    policyType: projectile.policy.type,
    hits: Object.freeze(resolution.hits),
    coverHit: resolution.cover ? Object.freeze({
      blockerId: resolution.cover.blockerId,
      time: resolution.cover.time,
      point: Object.freeze({ ...resolution.cover.point }),
      normal: Object.freeze({ ...resolution.cover.normal }),
    }) : null,
    ricochets: resolution.ricochets ?? 0,
    previous: projectile.previous,
    current: projectile.current,
  });
}

export function resolveProjectileBatch({ projectiles = [], targets = [], blockers = [], broadphase = null } = {}) {
  if (!Array.isArray(projectiles)) throw new TypeError('projectiles must be an array');
  assertUniqueTargets(targets);
  const projectileIds = new Set();
  for (const shot of projectiles) {
    if (projectileIds.has(shot.id)) throw new TypeError(`duplicate projectile id ${shot.id}`);
    projectileIds.add(shot.id);
  }
  const health = new Map(targets.map((target) => [target.id, target.health]));
  const damageEvents = [];
  const resolutions = [];
  for (const shot of [...projectiles].sort((a, b) => a.id.localeCompare(b.id))) {
    const liveTargets = targets.filter((target) => target.active && health.get(target.id) > 0);
    const resolution = resolveProjectilePath({ projectile: shot, targets: liveTargets, blockers, broadphase });
    resolutions.push(resolution);
    for (const hit of resolution.hits) {
      const currentHealth = health.get(hit.targetId) ?? 0;
      if (currentHealth <= 0) continue;
      const nextHealth = Math.max(0, currentHealth - hit.damage);
      health.set(hit.targetId, nextHealth);
      damageEvents.push(Object.freeze({ ...hit, healthBefore: currentHealth, healthAfter: nextHealth, killed: nextHealth === 0 }));
    }
  }
  return Object.freeze({
    resolutions: Object.freeze(resolutions),
    damageEvents: Object.freeze(damageEvents),
    remainingHealth: Object.freeze(Object.fromEntries([...health.entries()].sort(([a], [b]) => a.localeCompare(b)))),
  });
}

export function correctMuzzleAim({ muzzle, target, requestedDirection, maxCorrectionRadians = Math.PI / 6 } = {}) {
  const origin = point3(muzzle, 'muzzle');
  const destination = point3(target, 'target');
  const requested = normalize(point2(requestedDirection, 'requestedDirection'), 'requested-aim');
  const targetVector = { x: destination.x - origin.x, y: destination.y - origin.y };
  const distance = Math.hypot(targetVector.x, targetVector.y);
  const desired = normalize(targetVector, 'muzzle-target');
  const maximum = nonNegative(maxCorrectionRadians, 'maxCorrectionRadians');
  const requestedAngle = Math.atan2(requested.y, requested.x);
  let deltaAngle = Math.atan2(desired.y, desired.x) - requestedAngle;
  while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
  while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
  const correction = clamp(deltaAngle, -maximum, maximum);
  const angle = requestedAngle + correction;
  const direction = Object.freeze({ x: Math.cos(angle), y: Math.sin(angle) });
  return Object.freeze({
    origin,
    direction,
    end: Object.freeze({ x: origin.x + direction.x * distance, y: origin.y + direction.y * distance, z: destination.z }),
  });
}
