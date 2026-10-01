// HMH feel layer (2.1). One lazy chunk that owns the projection-only feel
// systems the frame loop consults: the trauma-squared screen shake (shared
// module, upgrade guide §2.2). Everything here is presentation: it consumes
// primitives copied out of events the simulation already produced and moves
// render containers. It never reads or writes simulation state, RNG streams,
// run evidence, bridge messages or results.
import { createTraumaShake } from '../../portal/src/feel/trauma-shake.mjs';

// §2.2: the old impulse ceiling (boss defeat, 12 px) is the trauma ceiling.
export const HMH_SHAKE_MAX_PX = 12;
export const HMH_SHAKE_DECAY_PER_SECOND = 1.75;
export const HMH_TICK_MS = 1000 / 60;
// Trauma reaches zero this many ticks after the last full-strength impulse.
export const HMH_SHAKE_SETTLE_TICKS = Math.ceil(60 / HMH_SHAKE_DECAY_PER_SECOND);

// The existing per-source magnitudes (weapon recoil 0.9..7.5, grenade class
// 2..10+, player hit 5, boss defeat 12) become trauma increments linearly, so
// one impulse still peaks in the old order while the squared response keeps
// recoil and the auto-miner tiny and lets grenades and the boss dominate.
export function hmhShakeTrauma(magnitude) {
  const value = Number(magnitude);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, value / HMH_SHAKE_MAX_PX);
}

export function createHmhFeel() {
  const shake = createTraumaShake({ maxPx: HMH_SHAKE_MAX_PX, decayPerSecond: HMH_SHAKE_DECAY_PER_SECOND });
  return {
    shake,
    // Called from the step callback with the simulation tick of the event.
    addShake(tick, magnitude) {
      shake.add(hmhShakeTrauma(magnitude), tick * HMH_TICK_MS);
    },
    // The container offset for the frame at `tick`. The shake clock is the
    // simulation tick, so a paused or captured frame is reproducible.
    shakeOffset(tick, settings) {
      return shake.offset(tick * HMH_TICK_MS, tick, Boolean(settings.screenShake && !settings.reduceMotion), Boolean(settings.reduceFlash));
    },
    reset() {
      shake.reset();
    },
  };
}
