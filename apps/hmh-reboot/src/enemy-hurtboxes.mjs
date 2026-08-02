// Cycle 045 (MAP-REDO slice 5, F1): swarm-forgiving growth. The vulnerable
// radius reaches full body scale and the capsule lengthens, measured by the
// seeded cross-track harness (+~4pp hit rate over Cycle 033 at 30-unit aim
// error) while a shot at the aim-error edge still misses. Render scale,
// collision bodies, and melee CONTACT bounds are unchanged; this is the
// projectile/melee VULNERABLE core only.
const ORDINARY_ENEMY_HURTBOX_RADIUS_SCALE = 1.0;
const ORDINARY_ENEMY_HURTBOX_MIN_RADIUS = 12;
const ORDINARY_ENEMY_HURTBOX_HALF_LENGTH = 9;

export const ORDINARY_ENEMY_HURTBOX_POLICY = Object.freeze({
  id: 'cycle-045-swarm-forgiving-ordinary-enemy-hurtbox-v2',
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
