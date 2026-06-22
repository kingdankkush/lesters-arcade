// Hard Money Heroes — Gore decal pool + density dampening (Level Design Bible §6.4/§10 slice #5).
//
// Cosmetic-only gore system: pooled splat decals that fade, dismember gibs with
// impulse, and explicit density dampening of cosmetic FX at high threat count so
// telegraphs/pickups/player stay readable. Per the bible: gore never affects the sim
// (damage/death already resolved); it is render-side and free. Toggle OFF by default,
// locked pre-run; stylized pixel only.
//
// All pure functions; no DOM; deterministic where it matters (dampening thresholds).

// Maximum decals/gibs kept alive at once — the "pooled + capped" guarantee.
export const GORE_LIMITS = Object.freeze({
  maxDecals: 40,
  maxGibs: 24,
  dampenThreshold: 50, // enemy count at which cosmetic FX start dampening
  fullDampenThreshold: 70, // enemy count at which cosmetic FX are fully dampened
});

// Spawn a blood splat decal. If the pool is at capacity, the oldest decal is
// recycled (FIFO eviction) so we never exceed the cap. Returns the new decal
// and the (possibly evicted) updated decal list.
export function spawnSplatDecal({
  decals = [],
  x = 0,
  y = 0,
  angle = 0,
  size = 12,
  color = '#8b0000',
  maxLife = 240,
  limits = GORE_LIMITS,
} = {}) {
  const newDecal = {
    x, y, angle, size, color,
    life: maxLife,
    maxLife,
    born: 0,
  };
  let next = [...decals, newDecal];
  // FIFO eviction: if over cap, drop the oldest (lowest remaining life).
  if (next.length > limits.maxDecals) {
    next.sort((a, b) => a.life - b.life);
    next = next.slice(next.length - limits.maxDecals);
  }
  return { decal: newDecal, decals: next };
}

// Spawn a dismember gib chunk with physics impulse (for explosive/heavy kills).
// Returns the new gib and the updated gibs list, capped at maxGibs.
export function spawnGib({
  gibs = [],
  x = 0,
  y = 0,
  vx = 0,
  vy = 0,
  spin = 0,
  chunk = 'arm',
  color = '#8b0000',
  maxLife = 90,
  limits = GORE_LIMITS,
} = {}) {
  const newGib = { x, y, vx, vy, spin, chunk, color, life: maxLife, maxLife, rotation: 0 };
  let next = [...gibs, newGib];
  if (next.length > limits.maxGibs) {
    next.sort((a, b) => a.life - b.life);
    next = next.slice(next.length - limits.maxGibs);
  }
  return { gib: newGib, gibs: next };
}

// Compute the cosmetic FX dampening factor based on the current threat count.
// Returns a multiplier in [0, 1]: 1 = full FX, 0 = fully dampened.
// Below dampenThreshold → 1 (full FX). Above fullDampenThreshold → 0.15 (minimal,
// never fully zero so kills still feel responsive). Between → linear ramp.
export function computeGoreDampening({
  threatCount = 0,
  goreEnabled = true,
  limits = GORE_LIMITS,
} = {}) {
  if (!goreEnabled) return 0; // gore toggle off → no gore FX at all
  if (threatCount <= limits.dampenThreshold) return 1;
  if (threatCount >= limits.fullDampenThreshold) return 0.15;
  // Linear ramp from 1 → 0.15 between thresholds.
  const range = limits.fullDampenThreshold - limits.dampenThreshold;
  const t = (threatCount - limits.dampenThreshold) / range;
  return 1 - t * 0.85;
}

// Validates gore system invariants (called during npm test).
export function validateGoreSystem() {
  const errors = [];
  // Decal pool cap: spawning beyond maxDecals should evict, not grow unbounded.
  let decals = [];
  for (let i = 0; i < GORE_LIMITS.maxDecals + 10; i += 1) {
    const r = spawnSplatDecal({ decals, x: i, y: i });
    decals = r.decals;
  }
  if (decals.length > GORE_LIMITS.maxDecals) errors.push(`decals should be capped at maxDecals, got ${decals.length}`);
  // Gib pool cap.
  let gibs = [];
  for (let i = 0; i < GORE_LIMITS.maxGibs + 10; i += 1) {
    const r = spawnGib({ gibs, x: i, y: i });
    gibs = r.gibs;
  }
  if (gibs.length > GORE_LIMITS.maxGibs) errors.push(`gibs should be capped at maxGibs, got ${gibs.length}`);
  // Dampening: full FX at low threat, dampened at high threat.
  const calm = computeGoreDampening({ threatCount: 10, goreEnabled: true });
  const chaos = computeGoreDampening({ threatCount: 80, goreEnabled: true });
  if (calm !== 1) errors.push('dampening should be 1 (full FX) at low threat count');
  if (chaos > 0.2) errors.push('dampening should be near-zero at high threat count');
  // Gore disabled → 0 dampening.
  const off = computeGoreDampening({ threatCount: 10, goreEnabled: false });
  if (off !== 0) errors.push('dampening should be 0 when gore is disabled');
  // Mid-range: between 0.15 and 1.
  const mid = computeGoreDampening({ threatCount: 60, goreEnabled: true });
  if (mid <= 0.15 || mid >= 1) errors.push('mid-range dampening should be between 0.15 and 1');
  return { ok: errors.length === 0, errors };
}
