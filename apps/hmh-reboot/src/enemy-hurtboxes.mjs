const ORDINARY_ENEMY_HURTBOX_RADIUS_SCALE = 0.9;
const ORDINARY_ENEMY_HURTBOX_MIN_RADIUS = 10;
const ORDINARY_ENEMY_HURTBOX_HALF_LENGTH = 8;

export const ORDINARY_ENEMY_HURTBOX_POLICY = Object.freeze({
  id: 'cycle-033-forgiving-ordinary-enemy-hurtbox-v1',
  radiusScale: ORDINARY_ENEMY_HURTBOX_RADIUS_SCALE,
  minimumRadius: ORDINARY_ENEMY_HURTBOX_MIN_RADIUS,
  halfLength: ORDINARY_ENEMY_HURTBOX_HALF_LENGTH,
  minZ: 4,
  maxZ: 60,
});

const PROFILE_BY_BODY_RADIUS = new Map();

function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

export function createOrdinaryEnemyHurtboxProfile(bodyRadius) {
  const radius = positive(bodyRadius, 'bodyRadius');
  const cached = PROFILE_BY_BODY_RADIUS.get(radius);
  if (cached) return cached;
  const vulnerableRadius = Math.max(
    ORDINARY_ENEMY_HURTBOX_POLICY.minimumRadius,
    radius * ORDINARY_ENEMY_HURTBOX_POLICY.radiusScale,
  );
  const halfLength = ORDINARY_ENEMY_HURTBOX_POLICY.halfLength;
  const projectileShape = Object.freeze({
    type: 'capsule',
    a: Object.freeze({ x: 0, y: -halfLength }),
    b: Object.freeze({ x: 0, y: halfLength }),
    radius: vulnerableRadius,
  });
  const profile = Object.freeze({
    policyId: ORDINARY_ENEMY_HURTBOX_POLICY.id,
    bodyShape: Object.freeze({ type: 'circle', radius }),
    projectileShape,
    meleeRadius: vulnerableRadius,
    minZ: ORDINARY_ENEMY_HURTBOX_POLICY.minZ,
    maxZ: ORDINARY_ENEMY_HURTBOX_POLICY.maxZ,
  });
  PROFILE_BY_BODY_RADIUS.set(radius, profile);
  return profile;
}
