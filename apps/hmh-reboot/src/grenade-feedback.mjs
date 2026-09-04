import { clamp, finite } from './value-guards.mjs';

// V-3. Grenade feedback set, projection-only.
//
// Before this a thrown grenade was a coloured circle with a monotonic fuse
// ring, a blast was one expanding circle, every bounce the simulation already
// reported was thrown away, and both classes shook the camera by the same
// flat 10. Everything here is art: pure resolvers that read simulation output
// (mode, radius, ticks, points) and return frozen geometry for the renderer.
// Nothing writes back, so none of it can reach collision, damage, AI,
// spawning, RNG, progression or results.
//
// Only two grenade classes exist at runtime: 'hand' (satoshi-frag:*) and
// 'launcher' (launcher-rig:*). The shaped-charge capstone in weapon-system.mjs
// is a splash-210 policy that main.mjs never plumbs into throwGrenade, so every
// live blast is 150. The builders below key on `mode` for character and on the
// detonation's own `radius` for size, so a future radius plumb scales the ring,
// the fragment reach and the shake without a render change.
export const GRENADE_FEEDBACK_ART_ID = 'projection-grenade-feedback-v1';

// The radius every class currently detonates at; shake scales above it.
export const GRENADE_BLAST_REFERENCE_RADIUS = 150;

// Per-class character. `shake` for the hand frag stays at 10: combat-feedback
// documents the grenade blast as the recoil ceiling and the c2 test pins every
// weapon under it. Boss defeat (12) must remain the loudest thing in a run.
export const GRENADE_FEEDBACK_CLASSES = Object.freeze({
  hand: Object.freeze({ shake: 10, fragments: 14, puffFootprint: 9, shadowFootprint: 13, ringWidth: 6, coreFlashTicks: 3 }),
  launcher: Object.freeze({ shake: 8.5, fragments: 10, puffFootprint: 7, shadowFootprint: 10, ringWidth: 5, coreFlashTicks: 2 }),
});

// Hard ceilings. Sixteen live grenades (MAX_ACTIVE_GRENADES) detonating inside
// one lifetime would otherwise stroke 224 fragment segments on desktop.
export const MAX_GRENADE_FX_PARTICLES = 64;
export const MAX_GRENADE_FX_EVENTS = 32;
// Matches the combat visual event lifetime (12 ticks, 200 ms) so a blast ring
// and its fragments retire together with the existing 'blast' event.
export const GRENADE_FX_LIFETIME_TICKS = 12;
export const BOUNCE_PUFF_LIFETIME_TICKS = 10;

// Radius scaling of the shake is capped so an unplumbed wider class can never
// out-shake the boss defeat.
const SHAKE_RADIUS_SCALE_CAP = 1.2;
// The pool's lift fade saturates at 2.5x the footprint (~22 px). A hand throw
// apexes ~40 units up, so the raw lift saturated almost at once and the shadow
// read as a fixed blob. Halving the lift spreads the fade across the arc.
const ARC_SHADOW_LIFT_SCALE = 0.5;
const ARC_SHADOW_LIFT_RATIO_CAP = 0.5;
// Much darker than the actor shadows (0.48): a 9 px blob under the danger-ring
// tint measured only a 15-20% luminance dip at 0.42 and 20-25% at 0.62, both
// lost in the ground texture. At apex (lift ratio capped at 0.5) this lands
// near 0.39; grounded it reads as a hard drop shadow under a stopped grenade.
const ARC_SHADOW_ALPHA = 0.78;
const ARC_SHADOW_MIN_ALPHA = 0.08;
const ARC_SHADOW_REACH = 2.5;
// A hand throw apexes ~40 units above its release; the body reaches full
// growth (+40%) at 60 so a launcher shell (apex ~4) barely changes.
const BODY_LIFT_REACH = 60;
const BODY_LIFT_SCALE = 0.4;
// Fragments end on 0.85R: inside the danger boundary, so the ring is the thing
// that lands exactly on it.
const FRAGMENT_REACH_RATIO = 0.85;
const RING_START_RATIO = 0.2;

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

// Same seeded FNV-1a + xorshift as combat-feedback.mjs: a stable 0..1 from a
// string key so a replay draws the identical fan without touching sim RNG.
function deterministicUnit(key) {
  let hash = 0x811c9dc5;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

// Called inside the frame loop: an unknown mode degrades to the hand class
// rather than throwing and killing the run (mirrors weaponRecoilShake).
export function grenadeFeedbackClass(mode) {
  return GRENADE_FEEDBACK_CLASSES[mode] ?? GRENADE_FEEDBACK_CLASSES.hand;
}

// Detonation records carry the grenade id, not its mode; the id prefix is the
// same discriminator the run summary uses for launcher attribution.
export function grenadeModeFromId(grenadeId) {
  return typeof grenadeId === 'string' && grenadeId.startsWith('launcher-rig:') ? 'launcher' : 'hand';
}

export function grenadeBlastShake({ mode, radius } = {}) {
  const entry = grenadeFeedbackClass(mode);
  const scale = Number.isFinite(radius) && radius > 0
    ? clamp(radius / GRENADE_BLAST_REFERENCE_RADIUS, 1, SHAKE_RADIUS_SCALE_CAP)
    : 1;
  return entry.shake * scale;
}

/**
 * Fuse blink. Period 12 ticks while more than 24 remain, 6 down to 12, then 3
 * for the last 12 (the same threshold the danger ring calls urgent), so the
 * strobe doubles twice on the way in. Under reduced flash the outer ring is
 * simply always on: the intensity ramp still tells the player the fuse is
 * short, but nothing strobes.
 */
export function resolveGrenadeFuseBlink({ tick, spawnTick, detonateTick, reduceFlash = false } = {}) {
  nonNegativeInteger(tick, 'tick');
  nonNegativeInteger(spawnTick, 'spawnTick');
  nonNegativeInteger(detonateTick, 'detonateTick');
  if (detonateTick <= spawnTick) throw new TypeError('detonateTick must follow spawnTick');
  const remainingTicks = Math.max(0, detonateTick - tick);
  const fuseTicks = detonateTick - spawnTick;
  const progress = clamp(1 - remainingTicks / fuseTicks, 0, 1);
  const periodTicks = remainingTicks > 24 ? 12 : remainingTicks > 12 ? 6 : 3;
  const phase = Math.max(0, tick - spawnTick) % periodTicks;
  return Object.freeze({
    on: reduceFlash ? true : phase < periodTicks / 2,
    periodTicks,
    intensity: 0.35 + progress * progress * 0.6,
    remainingTicks,
  });
}

/**
 * Arc shadow tuning for the shared contact-shadow pool. The pool already
 * shrinks and fades with lift; this resolves the footprint per class and
 * scales the lift so the fade spans the throw instead of saturating at once.
 * `alpha` here is the resolved on-screen alpha for callers without the pool.
 */
export function resolveGrenadeArcShadow({ mode, lift = 0, zoom = 1 } = {}) {
  finite(lift, 'lift');
  finite(zoom, 'zoom');
  const entry = grenadeFeedbackClass(mode);
  // Wider than the 4-unit body on purpose: a blob no wider than the ball
  // vanished in the road texture at 1440x900 even at a 40% luminance dip.
  const footprintPx = entry.shadowFootprint * zoom;
  const reach = Math.max(1, footprintPx * ARC_SHADOW_REACH);
  // Capped below the pool's saturation so the resolved alpha never falls to
  // the pool floor: evidence showed a 0.06 shadow vanish under the
  // danger-ring tint, leaving the arc with no ground cue at apex.
  const scaledLift = Math.min(Math.max(0, lift) * ARC_SHADOW_LIFT_SCALE, reach * ARC_SHADOW_LIFT_RATIO_CAP);
  const liftRatio = clamp(scaledLift / reach, 0, 1);
  return Object.freeze({
    footprintPx,
    lift: scaledLift,
    baseAlpha: ARC_SHADOW_ALPHA,
    alpha: Math.max(ARC_SHADOW_MIN_ALPHA, ARC_SHADOW_ALPHA * (1 - liftRatio)),
    // The ball grows a little as it rises toward the camera, so the arc reads
    // from the body leaving its shadow even where the shadow fade is subtle.
    bodyScale: 1 + clamp(Math.max(0, lift) / BODY_LIFT_REACH, 0, 1) * BODY_LIFT_SCALE,
  });
}

/**
 * One dust puff for a bounce the simulation reported. Ground puffs lie flat
 * on the plane; a wall (blocker) puff is narrower and climbs. Life is 10
 * ticks; past that alpha is 0 so the renderer can skip it.
 */
export function buildBouncePuff({ seed, kind = 'ground', age, zoom = 1 } = {}) {
  nonNegativeInteger(age, 'age');
  finite(zoom, 'zoom');
  const t = clamp(age / BOUNCE_PUFF_LIFETIME_TICKS, 0, 1);
  const expired = age >= BOUNCE_PUFF_LIFETIME_TICKS;
  const wall = kind === 'blocker';
  const jitter = 0.9 + deterministicUnit(`${seed}:puff`) * 0.2;
  // Opens from ~10 px to ~34 px: evidence at 1440x900 showed an 11 px ellipse
  // reading as a smudge rather than kicked-up dust.
  const spread = (10 + easeOutCubic(t) * 24) * jitter * zoom;
  const fade = expired ? 0 : (1 - t) ** 1.3;
  const lobes = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3 + deterministicUnit(`${seed}:lobe:${index}`) * 0.25) * Math.PI * 2;
    const drift = 0.35 + deterministicUnit(`${seed}:drift:${index}`) * 0.3;
    lobes.push(Object.freeze({
      dx: Math.cos(angle) * spread * drift * (wall ? 0.5 : 1),
      dy: Math.sin(angle) * spread * drift * (wall ? 0.7 : 0.32) - (wall ? spread * 0.3 : 0),
      radius: (3 + easeOutCubic(t) * 6) * zoom,
    }));
  }
  return Object.freeze({
    spreadX: wall ? spread * 0.55 : spread,
    spreadY: wall ? spread * 0.75 : Math.max(2, spread * 0.32),
    offsetY: wall ? -spread * 0.35 : 3 * zoom,
    alpha: fade * 0.34,
    strokeAlpha: fade * 0.7,
    lobeAlpha: fade * 0.5,
    lobes: Object.freeze(lobes),
  });
}

// Fragment count follows the performance tier exactly like impact sparks:
// desktop (10) full, mobile (6) scaled, reduced-motion (0) none.
export function grenadeFragmentCount({ mode, particleScale } = {}) {
  if (!Number.isFinite(particleScale) || particleScale <= 0) return 0;
  return Math.round(grenadeFeedbackClass(mode).fragments * particleScale / 10);
}

/**
 * Radial fragment fan for one detonation. Evenly slotted with a seeded jitter
 * so it reads as a burst, not a star; reach grows to 0.85R by end of life.
 */
export function buildFragmentBurst({ seed, mode, radius, age, zoom = 1, particleScale, maxCount = Number.POSITIVE_INFINITY } = {}) {
  positive(radius, 'radius');
  nonNegativeInteger(age, 'age');
  finite(zoom, 'zoom');
  const count = Math.min(grenadeFragmentCount({ mode, particleScale }), Math.max(0, Math.trunc(maxCount)));
  if (count === 0) return Object.freeze([]);
  const t = clamp(age / GRENADE_FX_LIFETIME_TICKS, 0, 1);
  const reach = radius * zoom * FRAGMENT_REACH_RATIO;
  const travel = easeOutCubic(t);
  const fragments = [];
  for (let index = 0; index < count; index += 1) {
    const slot = (index + 0.5) / count;
    const jitter = (deterministicUnit(`${seed}:frag:${index}`) - 0.5) / count;
    const speed = 0.72 + deterministicUnit(`${seed}:speed:${index}`) * 0.28;
    const outer = Math.max(2 * zoom, reach * travel * speed);
    const length = (6 + (1 - t) * 14) * zoom;
    fragments.push(Object.freeze({
      inner: Math.max(0, outer - length),
      outer,
      angle: (slot + jitter) * Math.PI * 2,
      width: 1 + (1 - t) * 2,
      alpha: 0.15 + (1 - t) * 0.8,
    }));
  }
  // The longest fragment lands exactly on 0.85R at end of life so the reach
  // is a hard, testable contract rather than a feel.
  if (t >= 1) {
    const longest = fragments.reduce((best, fragment, index) => (fragment.outer > fragments[best].outer ? index : best), 0);
    fragments[longest] = Object.freeze({ ...fragments[longest], outer: reach, inner: Math.max(0, reach - 6 * zoom) });
  }
  return Object.freeze(fragments);
}

/**
 * Per-frame fragment budget. Given every live burst as { tick, count }, return
 * the count each may draw so the total never exceeds `cap`; the newest bursts
 * keep their full fan and the oldest are trimmed first. Same-tick bursts
 * resolve later-in-array-first so a replay draws the identical frame.
 */
export function capGrenadeFxParticles(bursts, cap = MAX_GRENADE_FX_PARTICLES) {
  if (!Array.isArray(bursts)) throw new TypeError('bursts must be an array');
  const order = bursts.map((burst, index) => index)
    .sort((a, b) => (bursts[b].tick - bursts[a].tick) || (b - a));
  const allowance = new Array(bursts.length).fill(0);
  let remaining = Math.max(0, Math.trunc(cap));
  for (const index of order) {
    const wanted = Math.max(0, Math.trunc(bursts[index].count ?? 0));
    const granted = Math.min(wanted, remaining);
    allowance[index] = granted;
    remaining -= granted;
  }
  return Object.freeze(allowance);
}

/**
 * Shockwave ring. Eased from 0.2R to exactly R over the lifetime so the ring
 * ends on the danger boundary the player was shown; the stroke thins to a
 * hairline. The core flash is a few ticks of bright fill and is the only thing
 * reduced flash removes.
 */
export function buildShockwaveRing({ radius, age, lifetimeTicks = GRENADE_FX_LIFETIME_TICKS, zoom = 1, mode, reduceFlash = false } = {}) {
  positive(radius, 'radius');
  nonNegativeInteger(age, 'age');
  positive(lifetimeTicks, 'lifetimeTicks');
  finite(zoom, 'zoom');
  const entry = grenadeFeedbackClass(mode);
  const t = clamp(age / lifetimeTicks, 0, 1);
  const grow = easeOutCubic(t);
  const screenRadius = radius * zoom;
  const coreFlash = !reduceFlash && age < entry.coreFlashTicks;
  return Object.freeze({
    radius: screenRadius * (RING_START_RATIO + (1 - RING_START_RATIO) * grow),
    width: entry.ringWidth * (1 - t) + 1,
    alpha: (1 - t) * 0.9,
    fillAlpha: (1 - t) * (reduceFlash ? 0.1 : 0.16),
    coreFlash,
    coreRadius: screenRadius * 0.3 * (1 - t * 0.5),
    coreAlpha: coreFlash ? 0.85 * (1 - age / Math.max(1, entry.coreFlashTicks)) + 0.15 : 0,
  });
}
