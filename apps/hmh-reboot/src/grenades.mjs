import { freezeDeep } from './value-guards.mjs';
import { createProjectileState, resolveProjectilePath } from './projectile-physics.mjs';

const EPSILON = 1e-9;
const FIXED_STEP_SECONDS = 1 / 60;


import { finite } from './value-guards.mjs';

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

function point3(value, name) {
  return {
    x: finite(value?.x, `${name}.x`),
    y: finite(value?.y, `${name}.y`),
    z: finite(value?.z, `${name}.z`),
  };
}

function normalize(direction) {
  const x = finite(direction?.x, 'direction.x');
  const y = finite(direction?.y, 'direction.y');
  const magnitude = Math.hypot(x, y);
  if (magnitude <= EPSILON) throw new TypeError('direction must be non-zero');
  return { x: x / magnitude, y: y / magnitude };
}

function stableTargetCenter(target) {
  return {
    x: target.currentGround.x,
    y: target.currentGround.y,
    z: target.currentGround.z + (target.minZ + target.maxZ) * 0.5,
  };
}

export const HMH_GRENADE_DEFINITION = freezeDeep({
  id: 'satoshi-frag',
  title: 'Crypto Bombs',
  // Owner playtest 2026-08-02: bigger impact, bigger explosion, much more
  // area damage. One-shots ordinary enemies inside a half-again-wider blast;
  // knockback rises to match the new authority.
  damage: 34,
  blastRadius: 150,
  fuseTicks: 39,
  radius: 4,
  handSpeed: 360,
  handVerticalSpeed: 180,
  launcherSpeed: 560,
  launcherVerticalSpeed: 80,
  gravity: 900,
  bounceCoefficient: 0.42,
  surfaceFriction: 0.72,
  minimumBounceSpeed: 40,
  maxBounces: 4,
  knockback: 56,
  friendlyFire: 'self-damage',
});

export function createGrenadeState({
  id,
  ownerId = 'player',
  mode,
  position,
  velocity,
  spawnTick,
  detonateTick,
  damage = HMH_GRENADE_DEFINITION.damage,
  blastRadius = HMH_GRENADE_DEFINITION.blastRadius,
  radius = HMH_GRENADE_DEFINITION.radius,
} = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('grenade id must be a non-empty string');
  if (typeof ownerId !== 'string' || !ownerId) throw new TypeError('grenade ownerId must be a non-empty string');
  if (!['hand', 'launcher'].includes(mode)) throw new TypeError('grenade mode must be hand or launcher');
  if (!Number.isInteger(spawnTick) || spawnTick < 0) throw new TypeError('grenade spawnTick must be a non-negative integer');
  if (!Number.isInteger(detonateTick) || detonateTick <= spawnTick) throw new TypeError('grenade detonateTick must follow spawnTick');
  return {
    id,
    ownerId,
    mode,
    position: point3(position, 'grenade position'),
    previous: point3(position, 'grenade position'),
    velocity: point3(velocity, 'grenade velocity'),
    spawnTick,
    detonateTick,
    damage: positive(damage, 'grenade damage'),
    blastRadius: positive(blastRadius, 'grenade blastRadius'),
    radius: positive(radius, 'grenade radius'),
    bounceCount: 0,
    stopped: false,
  };
}

export function createGrenadeSystem({ capacity = 16, handCharges = 3, maxHandCharges = 5 } = {}) {
  if (!Number.isInteger(capacity) || capacity <= 0) throw new TypeError('grenade capacity must be a positive integer');
  if (!Number.isInteger(handCharges) || handCharges < 0) throw new TypeError('handCharges must be a non-negative integer');
  if (!Number.isInteger(maxHandCharges) || maxHandCharges < handCharges) throw new TypeError('maxHandCharges must be an integer at or above handCharges');
  return {
    capacity,
    handCharges,
    maxHandCharges,
    active: [],
    sequence: 0,
    droppedSpawns: 0,
    lastStepTick: -1,
  };
}

export function rechargeHandGrenades(system, { tick, amount = 1 } = {}) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  if (!Number.isInteger(amount) || amount <= 0) throw new TypeError('grenade recharge amount must be a positive integer');
  const previousCharges = system.handCharges;
  system.handCharges = Math.min(system.maxHandCharges, system.handCharges + amount);
  return freezeDeep({ type: 'grenade:pickup-refill', tick, amount: system.handCharges - previousCharges, handCharges: system.handCharges });
}

export function throwGrenade(system, {
  tick,
  mode = 'hand',
  origin,
  direction,
  ownerId = 'player',
  damageMultiplier = 1,
} = {}) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  if (tick < system.lastStepTick) throw new TypeError('grenade spawn tick cannot precede the last simulation step');
  if (!['hand', 'launcher'].includes(mode)) throw new TypeError('grenade mode must be hand or launcher');
  positive(damageMultiplier, 'damageMultiplier');
  if (system.active.length >= system.capacity) {
    system.droppedSpawns += 1;
    return freezeDeep({ spawned: false, reason: 'capacity', tick, mode });
  }
  if (mode === 'hand' && system.handCharges <= 0) return freezeDeep({ spawned: false, reason: 'out-of-grenades', tick, mode });
  const start = point3(origin, 'grenade origin');
  const forward = normalize(direction);
  const horizontalSpeed = mode === 'launcher' ? HMH_GRENADE_DEFINITION.launcherSpeed : HMH_GRENADE_DEFINITION.handSpeed;
  const verticalSpeed = mode === 'launcher' ? HMH_GRENADE_DEFINITION.launcherVerticalSpeed : HMH_GRENADE_DEFINITION.handVerticalSpeed;
  const id = `${mode === 'launcher' ? 'launcher-rig' : HMH_GRENADE_DEFINITION.id}:${String(system.sequence).padStart(8, '0')}`;
  system.sequence += 1;
  const grenade = createGrenadeState({
    id,
    ownerId,
    mode,
    position: start,
    velocity: { x: forward.x * horizontalSpeed, y: forward.y * horizontalSpeed, z: verticalSpeed },
    spawnTick: tick,
    detonateTick: tick + HMH_GRENADE_DEFINITION.fuseTicks,
    damage: HMH_GRENADE_DEFINITION.damage * damageMultiplier,
  });
  system.active.push(grenade);
  if (mode === 'hand') system.handCharges -= 1;
  return freezeDeep({ spawned: true, reason: null, tick, mode, grenadeId: id });
}

function collisionBlockers(blockers) {
  return blockers.filter((blocker) => blocker?.solid !== false).map((blocker) => (
    blocker.combatCover === true ? blocker : { ...blocker, combatCover: true }
  ));
}

function sweptBlockerHit(grenade, candidate, blockers) {
  if (blockers.length === 0) return null;
  const result = resolveProjectilePath({
    projectile: createProjectileState({
      id: `${grenade.id}:motion`,
      ownerId: grenade.ownerId,
      previous: grenade.previous,
      current: candidate,
      radius: grenade.radius,
      damage: 1,
      policy: { type: 'hitscan' },
    }),
    targets: [],
    blockers: collisionBlockers(blockers),
  });
  return result.coverHit;
}

function targetHasBlastLineOfSight(grenade, target, blockers) {
  if (blockers.length === 0) return { clear: true, blockerId: null };
  const targetCenter = stableTargetCenter(target);
  const result = resolveProjectilePath({
    projectile: createProjectileState({
      id: `${grenade.id}:los:${target.id}`,
      ownerId: grenade.ownerId,
      previous: grenade.position,
      current: targetCenter,
      radius: 0,
      damage: 1,
      policy: { type: 'hitscan' },
    }),
    targets: [target],
    blockers,
  });
  return { clear: result.coverHit === null, blockerId: result.coverHit?.blockerId ?? null };
}

function radialDamage(baseDamage, distance, radius) {
  const amount = baseDamage * (1 - distance / (radius + 0.5)) + baseDamage * 0.4;
  return Math.max(1, Math.round(amount));
}

export function resolveGrenadeBlast({ grenade, targets = [], blockers = [] } = {}) {
  if (!grenade?.position) throw new TypeError('grenade is required');
  if (!Array.isArray(targets) || !Array.isArray(blockers)) throw new TypeError('targets and blockers must be arrays');
  const targetById = new Map();
  for (const target of targets) {
    if (!target?.id) throw new TypeError('blast target id is required');
    if (targetById.has(target.id)) throw new TypeError(`duplicate blast target ${target.id}`);
    targetById.set(target.id, target);
  }
  const splash = resolveProjectilePath({
    projectile: createProjectileState({
      id: `${grenade.id}:blast`,
      ownerId: grenade.ownerId,
      previous: grenade.position,
      current: grenade.position,
      radius: grenade.radius,
      damage: grenade.damage,
      policy: { type: 'splash', radius: grenade.blastRadius },
    }),
    targets,
    blockers: [],
  });
  const hits = [];
  const rejections = [];
  for (const candidate of splash.hits) {
    const target = targetById.get(candidate.targetId);
    const lineOfSight = targetHasBlastLineOfSight(grenade, target, blockers);
    if (!lineOfSight.clear) {
      rejections.push(freezeDeep({ targetId: target.id, reason: 'cover', blockerId: lineOfSight.blockerId }));
      continue;
    }
    const center = stableTargetCenter(target);
    const distance = Math.hypot(center.x - grenade.position.x, center.y - grenade.position.y);
    const falloff = Math.max(0, 1 - distance / grenade.blastRadius);
    hits.push(freezeDeep({
      id: `${grenade.id}:blast:${target.id}`,
      tick: grenade.detonateTick,
      time: Math.min(1, distance / grenade.blastRadius),
      targetId: target.id,
      sourceId: grenade.ownerId,
      weaponId: HMH_GRENADE_DEFINITION.id,
      damage: radialDamage(grenade.damage, distance, grenade.blastRadius),
      criticalChance: 0,
      direction: freezeDeep({
        x: distance <= EPSILON ? 1 : (center.x - grenade.position.x) / distance,
        y: distance <= EPSILON ? 0 : (center.y - grenade.position.y) / distance,
      }),
      knockback: HMH_GRENADE_DEFINITION.knockback * falloff,
      point: freezeDeep({ ...grenade.position }),
      kind: target.id === grenade.ownerId ? 'self-damage' : 'splash',
    }));
  }
  hits.sort((a, b) => a.time - b.time || a.targetId.localeCompare(b.targetId));
  rejections.sort((a, b) => a.targetId.localeCompare(b.targetId));
  return freezeDeep({ grenadeId: grenade.id, hits, rejections });
}

function bounceFromBlocker(grenade, hit) {
  const inward = grenade.velocity.x * hit.normal.x + grenade.velocity.y * hit.normal.y;
  if (inward < 0) {
    grenade.velocity.x -= (1 + HMH_GRENADE_DEFINITION.bounceCoefficient) * inward * hit.normal.x;
    grenade.velocity.y -= (1 + HMH_GRENADE_DEFINITION.bounceCoefficient) * inward * hit.normal.y;
  }
  grenade.velocity.x *= HMH_GRENADE_DEFINITION.surfaceFriction;
  grenade.velocity.y *= HMH_GRENADE_DEFINITION.surfaceFriction;
  grenade.position = {
    x: hit.point.x + hit.normal.x * EPSILON * 10,
    y: hit.point.y + hit.normal.y * EPSILON * 10,
    z: hit.point.z,
  };
  grenade.bounceCount += 1;
}

function bounceFromGround(grenade, ground) {
  grenade.position.z = ground.groundZ + grenade.radius;
  if (Math.abs(grenade.velocity.z) <= HMH_GRENADE_DEFINITION.minimumBounceSpeed
    || grenade.bounceCount >= HMH_GRENADE_DEFINITION.maxBounces) {
    grenade.velocity = { x: 0, y: 0, z: 0 };
    grenade.stopped = true;
    return false;
  }
  grenade.velocity.z = Math.abs(grenade.velocity.z) * HMH_GRENADE_DEFINITION.bounceCoefficient;
  grenade.velocity.x *= HMH_GRENADE_DEFINITION.surfaceFriction;
  grenade.velocity.y *= HMH_GRENADE_DEFINITION.surfaceFriction;
  grenade.bounceCount += 1;
  return true;
}

export function stepGrenadeSystem(system, {
  tick,
  dtSeconds = FIXED_STEP_SECONDS,
  queryGround,
  blockers = [],
  targets = [],
} = {}) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  if (tick <= system.lastStepTick) throw new TypeError('grenade tick must be monotonic');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  positive(dtSeconds, 'dtSeconds');
  if (!Array.isArray(blockers) || !Array.isArray(targets)) throw new TypeError('blockers and targets must be arrays');
  system.lastStepTick = tick;
  const bounces = [];
  const detonations = [];
  const survivors = [];
  for (const grenade of [...system.active].sort((a, b) => a.id.localeCompare(b.id))) {
    let impact = null;
    grenade.previous = { ...grenade.position };
    if (!grenade.stopped) {
      grenade.velocity.z -= HMH_GRENADE_DEFINITION.gravity * dtSeconds;
      const candidate = {
        x: grenade.position.x + grenade.velocity.x * dtSeconds,
        y: grenade.position.y + grenade.velocity.y * dtSeconds,
        z: grenade.position.z + grenade.velocity.z * dtSeconds,
      };
      const blockerHit = sweptBlockerHit(grenade, candidate, blockers);
      if (blockerHit) {
        grenade.position = { ...blockerHit.point };
        impact = { reason: 'impact', blockerId: blockerHit.blockerId, point: { ...blockerHit.point } };
        if (grenade.mode !== 'launcher') {
          bounceFromBlocker(grenade, blockerHit);
          bounces.push(freezeDeep({ tick, grenadeId: grenade.id, kind: 'blocker', blockerId: blockerHit.blockerId, point: { ...grenade.position } }));
          impact = null;
        }
      } else {
        grenade.position = candidate;
        const ground = queryGround(candidate.x, candidate.y);
        if (candidate.z - grenade.radius <= ground.groundZ + EPSILON) {
          grenade.position.z = ground.groundZ + grenade.radius;
          impact = { reason: 'impact', surfaceId: ground.surfaceId ?? null, point: { ...grenade.position } };
          if (grenade.mode !== 'launcher') {
            const bounced = bounceFromGround(grenade, ground);
            if (bounced) bounces.push(freezeDeep({ tick, grenadeId: grenade.id, kind: 'ground', surfaceId: ground.surfaceId ?? null, point: { ...grenade.position } }));
            impact = null;
          }
        }
      }
    }
    const fuseExpired = tick >= grenade.detonateTick;
    if (impact || fuseExpired) {
      const blast = resolveGrenadeBlast({ grenade, targets, blockers });
      detonations.push(freezeDeep({
        tick,
        grenadeId: grenade.id,
        reason: impact?.reason ?? 'fuse',
        blockerId: impact?.blockerId ?? null,
        surfaceId: impact?.surfaceId ?? null,
        point: freezeDeep({ ...(impact?.point ?? grenade.position) }),
        radius: grenade.blastRadius,
        hits: blast.hits,
        rejections: blast.rejections,
      }));
      continue;
    }
    survivors.push(grenade);
  }
  system.active = survivors;
  return freezeDeep({ tick, bounces, detonations, activeCount: system.active.length, droppedSpawns: system.droppedSpawns });
}
