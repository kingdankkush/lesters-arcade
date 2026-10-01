// HMH feel layer (2.1). One lazy chunk that owns the projection-only feel
// systems the frame loop consults: the trauma-squared screen shake (shared
// module, upgrade guide §2.2) and the presentation-only hitstop (§2.1 b). Everything here is presentation: it consumes
// primitives copied out of events the simulation already produced and moves
// render containers. It never reads or writes simulation state, RNG streams,
// run evidence, bridge messages or results.
import { createTraumaShake } from '../../portal/src/feel/trauma-shake.mjs';
import { createHitstop } from '../../portal/src/feel/hitstop.mjs';

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

// §2.1 freeze values, in 60 Hz frames. A kill by a heavy weapon is the
// 3-frame end of the guide's 2-3 kill range.
export const HMH_HITSTOP_FRAMES = Object.freeze({ crit: 2, kill: 2, heavyKill: 3, heavy: 3, bossHit: 4, bossDeath: 6 });
// Swarm cap: ignored while a hold is active, and at most this many holds start
// in any rolling second (a shotgun into a crowd would otherwise strobe).
export const HMH_HITSTOP_MAX_PER_SECOND = 3;
export const HMH_HEAVY_WEAPON_IDS = Object.freeze(['scatter-shotgun', 'launcher-rig']);

// Frames for one enemy damage event (0 = no hitstop). Primitives only.
export function hmhHitstopFrames(critical, killed, weaponId, boss, bossDeath) {
  const heavy = HMH_HEAVY_WEAPON_IDS.includes(weaponId);
  if (bossDeath) return HMH_HITSTOP_FRAMES.bossDeath;
  if (boss) return HMH_HITSTOP_FRAMES.bossHit;
  if (killed) return heavy ? HMH_HITSTOP_FRAMES.heavyKill : HMH_HITSTOP_FRAMES.kill;
  if (heavy) return HMH_HITSTOP_FRAMES.heavy;
  if (critical) return HMH_HITSTOP_FRAMES.crit;
  return 0;
}

// Own toggle (default on), separate from screen shake; off under reduced motion.
export const hmhHitstopEnabled = (settings) => settings?.hitstop !== false && !settings?.reduceMotion;

export function createHmhFeel() {
  const shake = createTraumaShake({ maxPx: HMH_SHAKE_MAX_PX, decayPerSecond: HMH_SHAKE_DECAY_PER_SECOND });
  const hitstop = createHitstop({ maxPerSecond: HMH_HITSTOP_MAX_PER_SECOND });
  return {
    shake,
    hitstop,
    // One enemy damage event, called from the step callback after the
    // simulation resolved it. Primitive copies only; nothing is written back.
    enemyHit(critical, killed, weaponId, boss, bossDeath) {
      const frames = hmhHitstopFrames(critical, killed, weaponId, boss, bossDeath);
      if (frames > 0) hitstop.request(frames);
    },
    // Once per frame, after simulation.update(): start a hold for the
    // strongest request of the frame (the impact frame itself still renders).
    commitHitstop(nowMs, settings) {
      return hitstop.commit(nowMs, hmhHitstopEnabled(settings));
    },
    // True while the renderer should keep the last presented pose.
    holding(nowMs, settings) {
      return hmhHitstopEnabled(settings) && hitstop.holding(nowMs);
    },
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
      hitstop.reset();
    },
  };
}
