// Hard Money Heroes — deeper combat physics (pure, testable).
//
// Handles what the old `rectsOverlap` could not:
//   - Swept AABB collision so fast bullets don't tunnel through thin enemies.
//   - Circle-vs-circle accuracy for contact-damage style checks.
//   - Projectile physics with gravity (grenades, throwing axes, jump arcs).
//   - Momentum tracking for satisfying knockback on heavy hits.
//
// The renderer calls these helpers at collision-check time; the module itself
// owns no state and no DOM so it stays trivially testable.

// Swept AABB test: did a moving box `a` (from (ax0,ay0) to (ax1,ay1) along its
// own width/height) intersect static `b` at any point in the sweep? Returns the
// parametric time `t` in [0, 1] of first contact, or null if no contact.
// Used for bullet-vs-enemy so a fast-moving bullet can't jump through an enemy.
export function sweptAABB(ax0, ay0, ax1, ay1, bx, by, bw, bh) {
  // Broaden the test by treating `a` as a point with b expanded by a's dimensions
  // via Minkowski sum (classic swept-AABB trick).
  const pad = 6; // approximate bullet half-dims; small enough to keep precision
  const expBx = bx - pad;
  const expBy = by - pad;
  const expBw = bw + pad * 2;
  const expBh = bh + pad * 2;

  const dx = ax1 - ax0;
  const dy = ay1 - ay0;

  let tEnter = 0;
  let tExit = 1;

  if (dx !== 0) {
    const tx0 = (expBx - ax0) / dx;
    const tx1 = (expBx + expBw - ax0) / dx;
    const lo = Math.min(tx0, tx1);
    const hi = Math.max(tx0, tx1);
    tEnter = Math.max(tEnter, lo);
    tExit = Math.min(tExit, hi);
    if (tEnter > tExit) return null;
  } else if (ax0 < expBx || ax0 > expBx + expBw) {
    return null;
  }

  if (dy !== 0) {
    const ty0 = (expBy - ay0) / dy;
    const ty1 = (expBy + expBh - ay0) / dy;
    const lo = Math.min(ty0, ty1);
    const hi = Math.max(ty0, ty1);
    tEnter = Math.max(tEnter, lo);
    tExit = Math.min(tExit, hi);
    if (tEnter > tExit) return null;
  } else if (ay0 < expBy || ay0 > expBy + expBh) {
    return null;
  }

  return tEnter;
}

// Circle-vs-circle overlap, used for contact melee and grenades against enemies.
export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  return (dx * dx + dy * dy) < (ar + br) * (ar + br);
}

// Gravity-affected projectile update. Returns the new world position for a
// projectile with position (x, y), velocity (vx, vy), drag, and gravity.
// Grenades use heavier gravity + drag; axes use mild gravity; bullets stay flat.
export function stepProjectile({
  x, y, vx, vy,
  gravity = 0,
  drag = 0,
  groundY = 420,
  floorBounceCoefficient = 0.35,
} = {}) {
  let nvx = vx * (1 - drag);
  let nvy = vy * (1 - drag) + gravity;
  let nx = x + nvx;
  let ny = y + nvy;
  // Floor collision — bounce grenades instead of dying immediately.
  let bounced = false;
  if (ny >= groundY - 6) {
    ny = groundY - 6;
    nvy = -nvy * floorBounceCoefficient;
    nvx *= 0.7; // floor friction
    bounced = Math.abs(nvy) > 0.15;
  }
  return { x: nx, y: ny, vx: nvx, vy: nvy, bounced, stopped: !bounced && ny >= groundY - 7 };
}

// Compute a knockback impulse that the struck target should absorb as a temporary
// velocity override. Heavier sources push further; armored enemies resist more.
export function knockback({ sourceDamage = 6, sourceType = 'bullet', armored = false, dirX = 1, dirY = -0.3 } = {}) {
  const base = Math.min(1.8, (sourceDamage / 30));
  const resist = armored ? 0.45 : 1.0;
  const impulse = base * resist;
  // Impulse scales with damage type: AP is sharp (no knockback), explosive is heavy.
  const typeMult = sourceType === 'explosion' ? 2.4 : sourceType === 'grenade' ? 1.6
    : sourceType === 'axe' ? 1.4 : sourceType === 'armor-piercing' ? 0.6 : 0.9;
  const total = impulse * typeMult;
  return { vx: dirX * total, vy: dirY * total * 0.6, durationFrames: 10 };
}

// Plan a grenade throw in map (tile) space. CODE per the Level Design Bible §6.3:
// arc/fuse/AoE are deterministic (they feed score), so they live here in the sim,
// not the renderer. Given an origin and an aim unit-vector, compute the landing
// point (clamped to max throw range), the blast radius, the fuse delay, and a
// `marker` the renderer draws as the landing-shadow blast-radius telegraph
// (readability!). Pure + seed-independent so a replay re-sims identically.
export function planGrenadeThrow({
  originX = 0,
  originY = 0,
  aimX = 1,
  aimY = 0,
  reach = 1.4,
  maxRange = 6.0,
  blastRadius = 2.0,
  fuseFrames = 42,
} = {}) {
  const len = Math.hypot(aimX, aimY) || 1;
  const ux = aimX / len;
  const uy = aimY / len;
  // Throw distance is the requested reach clamped to the weapon's max range.
  const distance = Math.max(0, Math.min(reach, maxRange));
  const landX = originX + ux * distance;
  const landY = originY + uy * distance;
  return {
    landX,
    landY,
    distance,
    blastRadius,
    fuseFrames,
    // Landing-shadow telegraph: the renderer draws a ring of this radius at the
    // landing point during the fuse so the player can read the danger zone.
    marker: { x: landX, y: landY, radius: blastRadius },
  };
}

// Deterministic radial blast damage with falloff. Full-ish damage at the center,
// tapering toward the edge, zero outside the radius. Preserves the long-standing
// runtime formula (1.4x at center → ~0.6x at the rim for r=2) so extracting it is
// behavior-preserving; now it is a single tested source of truth.
export function grenadeBlastDamageAt({ distance = 0, radius = 2.0, baseDamage = 0 } = {}) {
  if (distance > radius) return 0;
  const dmg = baseDamage * (1 - distance / (radius + 0.5)) + baseDamage * 0.4;
  return Math.max(0, dmg);
}

// Deterministic radial explosion impulse with falloff (the bible's "radial AoE +
// falloff" / "radial explosion impulse with falloff"). Returns the push a target
// at (targetX,targetY) absorbs from a blast at (sourceX,sourceY). Cosmetic debris
// is free elsewhere; this push affects the sim so it is deterministic + pure.
export function explosionImpulseAt({
  sourceX = 0,
  sourceY = 0,
  targetX = 0,
  targetY = 0,
  radius = 2.0,
  power = 1,
} = {}) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.hypot(dx, dy);
  if (dist > radius) return { vx: 0, vy: 0, falloff: 0, inRange: false };
  const falloff = 1 - dist / radius;
  const len = dist || 1;
  return {
    vx: (dx / len) * power * falloff,
    vy: (dy / len) * power * falloff,
    falloff,
    inRange: true,
  };
}

// Validate physics helper invariants (called during npm test).
export function validatePhysics() {
  const errors = [];
  if (sweptAABB(0, 10, 100, 10, 50, 0, 10, 20) === null) errors.push('sweep should detect line through target');
  if (sweptAABB(0, 10, 20, 10, 50, 0, 10, 20) !== null) errors.push('sweep should NOT detect short miss');
  if (!circlesOverlap(0, 0, 5, 8, 0, 5)) errors.push('circles 8 apart w/ r=5 each should overlap');
  if (circlesOverlap(0, 0, 5, 50, 0, 5)) errors.push('circles 50 apart w/ r=5 each should NOT overlap');
  const p = stepProjectile({ x: 0, y: 0, vx: 1, vy: -2, gravity: 0.5 });
  if (!(p.y < 0)) errors.push('projectile with negative vy should rise');
  // Grenade planning: landing marker sits along the aim vector at clamped range.
  const plan = planGrenadeThrow({ originX: 0, originY: 0, aimX: 1, aimY: 0, reach: 99, maxRange: 6 });
  if (plan.landX !== 6) errors.push('grenade throw should clamp to maxRange');
  if (plan.marker.radius !== plan.blastRadius) errors.push('grenade marker radius should equal blastRadius');
  // Blast damage: more at the center than the rim, zero outside the radius.
  const center = grenadeBlastDamageAt({ distance: 0, radius: 2, baseDamage: 30 });
  const rim = grenadeBlastDamageAt({ distance: 2, radius: 2, baseDamage: 30 });
  if (!(center > rim)) errors.push('grenade blast should fall off toward the rim');
  if (grenadeBlastDamageAt({ distance: 3, radius: 2, baseDamage: 30 }) !== 0) errors.push('grenade blast outside radius should be 0');
  // Explosion impulse: pushes outward, zero outside the radius.
  const imp = explosionImpulseAt({ sourceX: 0, sourceY: 0, targetX: 1, targetY: 0, radius: 2, power: 4 });
  if (!(imp.vx > 0 && imp.inRange)) errors.push('explosion should push target outward when in range');
  if (explosionImpulseAt({ sourceX: 0, sourceY: 0, targetX: 5, targetY: 0, radius: 2, power: 4 }).inRange) errors.push('explosion outside radius should not be in range');
  return { ok: errors.length === 0, errors };
}
