import { createProjectileState, resolveProjectilePath } from './projectile-physics.mjs';

const EPSILON = 1e-9;

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
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

function normalize(value) {
  const x = finite(value?.x, 'direction.x');
  const y = finite(value?.y, 'direction.y');
  const magnitude = Math.hypot(x, y);
  if (magnitude <= EPSILON) throw new TypeError('direction must be non-zero');
  return { x: x / magnitude, y: y / magnitude };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function addScaled(a, b, scale) {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale };
}

function closestPointOnSegment(point, a, b) {
  const delta = subtract(b, a);
  const lengthSquared = dot(delta, delta);
  const time = lengthSquared <= EPSILON ? 0 : clamp(dot(subtract(point, a), delta) / lengthSquared, 0, 1);
  return { point: addScaled(a, delta, time), time };
}

function closestSegmentPair(a0, a1, b0, b1) {
  const u = subtract(a1, a0);
  const v = subtract(b1, b0);
  const w = subtract(a0, b0);
  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const d = dot(u, w);
  const e = dot(v, w);
  if (a <= EPSILON && c <= EPSILON) return { attackTime: 0, targetTime: 0, attackPoint: a0, targetPoint: b0, distance: Math.hypot(a0.x - b0.x, a0.y - b0.y) };
  if (c <= EPSILON) {
    const closest = closestPointOnSegment(b0, a0, a1);
    return { attackTime: closest.time, targetTime: 0, attackPoint: closest.point, targetPoint: b0, distance: Math.hypot(closest.point.x - b0.x, closest.point.y - b0.y) };
  }
  if (a <= EPSILON) {
    const closest = closestPointOnSegment(a0, b0, b1);
    return { attackTime: 0, targetTime: closest.time, attackPoint: a0, targetPoint: closest.point, distance: Math.hypot(a0.x - closest.point.x, a0.y - closest.point.y) };
  }

  const denominator = a * c - b * b;
  let attackTime = denominator <= EPSILON ? 0 : clamp((b * e - c * d) / denominator, 0, 1);
  let targetTime = clamp((b * attackTime + e) / c, 0, 1);
  attackTime = clamp((b * targetTime - d) / a, 0, 1);
  targetTime = clamp((b * attackTime + e) / c, 0, 1);
  const attackPoint = addScaled(a0, u, attackTime);
  const targetPoint = addScaled(b0, v, targetTime);
  return {
    attackTime,
    targetTime,
    attackPoint,
    targetPoint,
    distance: Math.hypot(attackPoint.x - targetPoint.x, attackPoint.y - targetPoint.y),
  };
}

export const HMH_MELEE_DEFINITION = freezeDeep({
  id: 'litecoin-knife',
  title: 'The Litecoin Blade',
  damage: 8,
  range: 58,
  cooldownTicks: 20,
  arcRadians: Math.PI * 80 / 180,
  sweepRadius: 18,
  minZ: 4,
  maxZ: 60,
  knockback: 18,
});

export function createMeleeTarget({
  id,
  previousGround,
  currentGround,
  radius,
  minZ = 4,
  maxZ = 60,
  active = true,
} = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('melee target id must be a non-empty string');
  const lower = finite(minZ, 'melee target minZ');
  const upper = finite(maxZ, 'melee target maxZ');
  if (upper <= lower) throw new TypeError('melee target height range must be positive');
  if (typeof active !== 'boolean') throw new TypeError('melee target active must be boolean');
  return freezeDeep({
    id,
    previousGround: point3(previousGround, 'melee target previousGround'),
    currentGround: point3(currentGround, 'melee target currentGround'),
    radius: positive(radius, 'melee target radius'),
    minZ: lower,
    maxZ: upper,
    active,
  });
}

function targetGroundAt(target, time) {
  return {
    x: target.previousGround.x + (target.currentGround.x - target.previousGround.x) * time,
    y: target.previousGround.y + (target.currentGround.y - target.previousGround.y) * time,
    z: target.previousGround.z + (target.currentGround.z - target.previousGround.z) * time,
  };
}

function coverBetween({ attackId, origin, contact, blockers }) {
  if (blockers.length === 0) return null;
  const start = { x: origin.x, y: origin.y, z: origin.z + 32 };
  const end = { x: contact.x, y: contact.y, z: contact.z + 32 };
  const resolution = resolveProjectilePath({
    projectile: createProjectileState({
      id: `${attackId}:cover`,
      ownerId: 'player',
      previous: start,
      current: end,
      radius: 0,
      damage: 1,
      policy: { type: 'hitscan' },
    }),
    targets: [],
    blockers,
  });
  return resolution.coverHit;
}

function stableContactOrder(a, b) {
  return a.attackTime - b.attackTime || a.targetTime - b.targetTime || a.targetId.localeCompare(b.targetId);
}

export function resolveMeleeAttack({
  attackId,
  tick,
  origin,
  direction,
  targets = [],
  blockers = [],
  definition = HMH_MELEE_DEFINITION,
} = {}) {
  if (typeof attackId !== 'string' || !attackId) throw new TypeError('attackId must be a non-empty string');
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  if (!Array.isArray(targets) || !Array.isArray(blockers)) throw new TypeError('targets and blockers must be arrays');
  const start = point3(origin, 'melee origin');
  const forward = normalize(direction);
  const end = { x: start.x + forward.x * definition.range, y: start.y + forward.y * definition.range };
  const attackStart = { x: start.x, y: start.y };
  const seen = new Set();
  const hits = [];
  const rejections = [];

  for (const target of [...targets].sort((a, b) => String(a?.id).localeCompare(String(b?.id)))) {
    if (!target?.id) throw new TypeError('melee target id is required');
    if (seen.has(target.id)) throw new TypeError(`duplicate melee target ${target.id}`);
    seen.add(target.id);
    if (target.active === false) continue;
    const closest = closestSegmentPair(
      attackStart,
      end,
      { x: target.previousGround.x, y: target.previousGround.y },
      { x: target.currentGround.x, y: target.currentGround.y },
    );
    const contactGround = targetGroundAt(target, closest.targetTime);
    const fromOrigin = { x: contactGround.x - start.x, y: contactGround.y - start.y };
    const centerDistance = Math.hypot(fromOrigin.x, fromOrigin.y);
    const forwardDistance = dot(fromOrigin, forward);
    const angularPadding = centerDistance <= EPSILON ? 0 : Math.asin(Math.min(1, target.radius / centerDistance));
    const angle = centerDistance <= EPSILON ? 0 : Math.acos(clamp(forwardDistance / centerDistance, -1, 1));
    const inRange = centerDistance <= definition.range + target.radius + EPSILON;
    const inArc = forwardDistance > EPSILON && angle <= definition.arcRadians * 0.5 + angularPadding + EPSILON;
    const inSweep = closest.distance <= definition.sweepRadius + target.radius + EPSILON;
    if (!inRange || !inArc || !inSweep) {
      rejections.push(freezeDeep({ targetId: target.id, reason: !inRange ? 'range' : !inArc ? 'angle' : 'volume' }));
      continue;
    }
    const attackMinZ = start.z + definition.minZ;
    const attackMaxZ = start.z + definition.maxZ;
    const targetMinZ = contactGround.z + target.minZ;
    const targetMaxZ = contactGround.z + target.maxZ;
    if (!(attackMaxZ > targetMinZ + EPSILON && attackMinZ < targetMaxZ - EPSILON)) {
      rejections.push(freezeDeep({ targetId: target.id, reason: 'height' }));
      continue;
    }
    const cover = coverBetween({ attackId: `${attackId}:${target.id}`, origin: start, contact: contactGround, blockers });
    if (cover) {
      rejections.push(freezeDeep({ targetId: target.id, reason: 'cover', blockerId: cover.blockerId }));
      continue;
    }
    hits.push(freezeDeep({
      id: `${attackId}:${target.id}`,
      attackId,
      tick,
      time: closest.attackTime,
      targetTime: closest.targetTime,
      targetId: target.id,
      sourceId: 'player',
      weaponId: definition.id,
      damage: definition.damage,
      criticalChance: 0.08,
      direction: freezeDeep({ ...forward }),
      knockback: definition.knockback,
      point: freezeDeep({ x: closest.targetPoint.x, y: closest.targetPoint.y, z: contactGround.z + (target.minZ + target.maxZ) * 0.5 }),
      attackTime: closest.attackTime,
    }));
  }
  hits.sort(stableContactOrder);
  rejections.sort((a, b) => a.targetId.localeCompare(b.targetId));
  return freezeDeep({ attackId, tick, hits, rejections });
}

export function createMeleeState() {
  return { lastTick: -1, nextAttackTick: 0, sequence: 0 };
}

export function stepMeleeState(state, {
  tick,
  trigger = false,
  origin,
  sourceGroundZ = origin?.z,
  direction,
  targets = [],
  blockers = [],
} = {}) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  if (tick <= state.lastTick) throw new TypeError('tick must be monotonic');
  state.lastTick = tick;
  if (!trigger || tick < state.nextAttackTick) return freezeDeep({ tick, attacked: false, attack: null, hits: [], rejections: [] });
  const attackId = `${HMH_MELEE_DEFINITION.id}:${String(state.sequence).padStart(8, '0')}`;
  state.sequence += 1;
  state.nextAttackTick = tick + HMH_MELEE_DEFINITION.cooldownTicks;
  const attack = resolveMeleeAttack({
    attackId,
    tick,
    origin: { ...origin, z: sourceGroundZ },
    direction,
    targets,
    blockers,
  });
  return freezeDeep({ tick, attacked: true, attack, hits: attack.hits, rejections: attack.rejections });
}
