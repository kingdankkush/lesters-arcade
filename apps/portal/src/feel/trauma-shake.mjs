// Shared feel module (2.1, upgrade guide §5.1): trauma-squared screen shake.
//
// Ported from STACKED's render/board-motion.mjs (1.9.0 feel pass) so the
// cabinets stop drifting apart. Presentation only: the caller passes its own
// clock (a frame clock, or a simulation tick converted to ms for a
// replay-stable frame) and applies the offset to a render container. Nothing
// here reads or writes simulation state, RNG streams, evidence or results.
//
// Model:
// - every impulse ADDS trauma (0..1), clamped to 1, so overlapping small hits
//   stack a little while one big hit dominates;
// - trauma decays linearly at `decayPerSecond` (1.5 in STACKED; HMH uses 1.75);
// - the amplitude is trauma SQUARED times `maxPx`, so small trauma stays subtle;
// - reduced flash halves the amplitude; a disabled shake (screen-shake setting
//   off, reduced motion) returns a zero offset;
// - the wobble direction comes from an integer hash of the caller's frame
//   index, never a template string, and offset() writes into one reused
//   object: no per-frame allocation.

export const TRAUMA_DECAY_PER_SECOND = 1.75;

// 32-bit integer finaliser (lowbias32). Pure integer maths: no strings.
export function hashUint32(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

// Signed unit in [-1, 1) from a frame index and a lane (0 = x, 1 = y).
export function hashSignedUnit(frame, lane) {
  return hashUint32(Math.imul(frame | 0, 0x9e3779b1) ^ Math.imul((lane | 0) + 1, 0x85ebca77)) / 0x80000000 - 1;
}

export function createTraumaShake({ maxPx = 7, decayPerSecond = TRAUMA_DECAY_PER_SECOND } = {}) {
  if (!(maxPx > 0) || !Number.isFinite(maxPx)) throw new TypeError('maxPx must be a positive finite number');
  if (!(decayPerSecond > 0) || !Number.isFinite(decayPerSecond)) throw new TypeError('decayPerSecond must be a positive finite number');
  let trauma = 0;
  let traumaAt = 0;
  let adds = 0;
  const out = { x: 0, y: 0, trauma: 0, amplitude: 0 };
  const level = (nowMs) => Math.max(0, trauma - decayPerSecond * Math.max(0, nowMs - traumaAt) / 1000);
  return {
    maxPx,
    decayPerSecond,
    // Adds `amount` (0..1) of trauma at `nowMs`. Non-positive or non-finite
    // amounts are ignored. Returns the new trauma level.
    add(amount, nowMs) {
      if (!(amount > 0) || !Number.isFinite(amount) || !Number.isFinite(nowMs)) return level(nowMs);
      trauma = Math.min(1, level(nowMs) + amount);
      traumaAt = nowMs;
      adds += 1;
      return trauma;
    },
    level,
    // The offset for this frame, written into one reused object. `frame` seeds
    // the wobble direction (HMH passes the simulation tick, so a paused or
    // captured frame is reproducible).
    offset(nowMs, frame, enabled = true, reduceFlash = false) {
      const current = level(nowMs);
      out.trauma = current;
      if (!enabled || current <= 0) {
        out.x = 0; out.y = 0; out.amplitude = 0;
        return out;
      }
      const amplitude = current * current * maxPx * (reduceFlash ? 0.5 : 1);
      out.amplitude = amplitude;
      out.x = hashSignedUnit(frame, 0) * amplitude;
      out.y = hashSignedUnit(frame, 1) * amplitude;
      return out;
    },
    reset() {
      trauma = 0; traumaAt = 0; adds = 0;
      out.x = 0; out.y = 0; out.trauma = 0; out.amplitude = 0;
    },
    get trauma() { return trauma; },
    get adds() { return adds; },
  };
}
