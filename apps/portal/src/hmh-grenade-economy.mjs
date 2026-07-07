import { planGrenadeThrow } from './combat-physics.mjs';

const freeze = (value) => Object.freeze(value);

export const HMH_GRENADE_TYPES = freeze({
  'satoshi-frag': freeze({
    id: 'satoshi-frag',
    title: 'Crypto Bombs',
    role: 'baseline area denial',
    cost: 1,
    maxRange: 7,
    blastRadius: 2,
    fuseFrames: 42,
    damage: 34,
    reach: 2.5,
    label: 'CRYPTO BOMB',
  }),
  'launcher-rig': freeze({
    id: 'launcher-rig',
    title: 'Launcher Rig',
    role: 'long-range skill shot',
    cost: 1,
    maxRange: 11,
    blastRadius: 1.65,
    fuseFrames: 32,
    damage: 42,
    reach: 3,
    label: 'LAUNCHER',
  }),
  'homing-cluster': freeze({
    id: 'homing-cluster',
    title: 'Homing Cluster',
    role: 'cluster-control seeker',
    cost: 1,
    maxRange: 6.5,
    blastRadius: 2.35,
    fuseFrames: 48,
    damage: 30,
    reach: 1.3,
    homing: true,
    clusterCount: 3,
    label: 'HOMING CLUSTER',
  }),
  'block-buster': freeze({
    id: 'block-buster',
    title: 'Block Buster',
    role: 'heavy room clear',
    cost: 2,
    maxRange: 6,
    blastRadius: 3.25,
    fuseFrames: 56,
    damage: 62,
    reach: 2.5,
    label: 'BLOCK BUSTER',
  }),
});

const TYPE_PRIORITY = freeze(['block-buster', 'homing-cluster', 'launcher-rig', 'satoshi-frag']);

function clampInteger(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function grenadeCapacityForRun(run = {}) {
  const capacityRanks = clampInteger(run?.skills?.['grenade-capacity'] ?? 0, 0, 4);
  return 3 + capacityRanks;
}

export function resolveGrenadeTypeForRun(run = {}) {
  const explicit = run?.stats?.grenadeType;
  if (explicit && HMH_GRENADE_TYPES[explicit]) return HMH_GRENADE_TYPES[explicit];
  for (const typeId of TYPE_PRIORITY) {
    if (typeId !== 'satoshi-frag' && run?.unlocks?.[typeId]) return HMH_GRENADE_TYPES[typeId];
  }
  return HMH_GRENADE_TYPES['satoshi-frag'];
}

export function grenadeRefillForPickup({ current = 0, run = {}, amount = 2 } = {}) {
  const capacity = grenadeCapacityForRun(run);
  const before = clampInteger(current, 0, capacity);
  const after = Math.min(capacity, before + Math.max(0, Math.floor(Number(amount) || 0)));
  return freeze({ before, after, gained: after - before, capacity });
}

export function planLevelOneGrenadeThrow({
  run = {},
  currentGrenades = 0,
  originX = 0,
  originY = 0,
  aimX = 1,
  aimY = 0,
  reach = null,
  maxRange = null,
  blastRadius = null,
  damageMultiplier = 1,
} = {}) {
  const type = resolveGrenadeTypeForRun(run);
  const available = clampInteger(currentGrenades, 0, 99);
  if (available < type.cost) {
    return freeze({ throwAllowed: false, reason: 'insufficient-grenades', type, cost: type.cost, available });
  }
  const effectiveReach = Number.isFinite(Number(reach)) ? Number(reach) : type.reach;
  const effectiveMaxRange = Number.isFinite(Number(maxRange)) ? Number(maxRange) : type.maxRange;
  const effectiveBlastRadius = Number.isFinite(Number(blastRadius)) ? Number(blastRadius) : type.blastRadius;
  const plan = planGrenadeThrow({
    originX,
    originY,
    aimX,
    aimY,
    reach: effectiveReach,
    maxRange: effectiveMaxRange,
    blastRadius: effectiveBlastRadius,
    fuseFrames: type.fuseFrames,
  });
  return freeze({
    throwAllowed: true,
    type,
    typeId: type.id,
    cost: type.cost,
    remaining: available - type.cost,
    damage: Math.round(type.damage * Math.max(0.1, Number(damageMultiplier) || 1)),
    label: type.label,
    plan: freeze({ ...plan, maxRange: type.maxRange }),
  });
}
