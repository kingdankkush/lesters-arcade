// Feel slice (1.8.7): trauma camera shake (B2) and damped springs (B1).
//
// Projection only. Everything here advances on the simulation tick, never on
// wall-clock frame time, so the same replay draws the same offsets at any
// refresh rate. Nothing reads back into collision, damage, AI, spawning, RNG,
// progression, evidence or aim: the runtime applies the camera offset to the
// world container (never camera.shakeX/Y, which screenToGround reads) and the
// springs to display transforms only.

// Trauma. Each event adds sqrt(magnitude / SHAKE_MAX_PX), so an isolated event
// peaks at exactly its authored pixel magnitude (amplitude is trauma^2), while
// overlapping events stack instead of the strongest one overriding the rest.
// The clamp at 1 caps any pile-up at the boss-defeat shake, the authored
// ceiling. Decay is exponential per tick; the amplitude of a lone event is
// under 6% of its peak nine ticks later, the old linear window.
export const SHAKE_MAX_PX = 12;
export const TRAUMA_DECAY_PER_TICK = 0.85;

// Semi-implicit Euler at a fixed 1/120 s sub-step (two per simulation tick),
// the same integrator as Chikun's character springs. A gap longer than two
// seconds settles instead of integrating: every spring here is at rest long
// before then. A spring that has all but stopped snaps to exactly zero (per
// sub-step, so batching still changes nothing), and trauma under 1% reads as
// none: at rest the world container and layer offsets stop being rewritten.
const SUBSTEPS_PER_TICK = 2;
const SUBSTEP_SECONDS = 1 / 120;
const SETTLE_TICKS = 120;

export function createSpring(stiffness, damping) {
  return { x: 0, v: 0, k: stiffness, c: 2 * damping * Math.sqrt(stiffness) };
}

export function stepSpring(spring, ticks) {
  if (!(ticks > 0)) return spring;
  if (ticks > SETTLE_TICKS) {
    spring.x = spring.v = 0;
    return spring;
  }
  for (let n = ticks * SUBSTEPS_PER_TICK; n > 0; n -= 1) {
    spring.v += (-spring.k * spring.x - spring.c * spring.v) * SUBSTEP_SECONDS;
    spring.x += spring.v * SUBSTEP_SECONDS;
    if (Math.abs(spring.x) < 1e-4 && Math.abs(spring.v) < 1e-3) spring.x = spring.v = 0;
  }
  return spring;
}

// Muzzle climb per pixel of weapon pull-back, in radians.
export const RECOIL_CLIMB_PER_PX = 0.012;

/**
 * The per-run feel rig. Simulation events call kick()/addTrauma() with the
 * step tick; the render pass calls advance(simulation.tick) and reads the
 * smoothed values. kick() first advances to its own tick, so the result is
 * the same whether the renderer advanced every tick or once per frame.
 */
export function createFeelRig() {
  const springs = {
    // Held-weapon pull-back in screen pixels at zoom 1.
    recoil: createSpring(900, 0.55),
    // Hero squash: scale x by 1 + x and y by 1 - x.
    squash: createSpring(520, 0.42),
    // Camera kick toward the hit direction, screen pixels.
    kickX: createSpring(260, 0.7),
    kickY: createSpring(260, 0.7),
  };
  const all = Object.values(springs);
  const out = { x: 0, y: 0 };
  let at = null;
  let trauma = 0;
  let traumaTick = 0;
  const settle = () => { for (const spring of all) spring.x = spring.v = 0; };
  const advance = (tick) => {
    if (at !== null && tick < at) settle();
    else if (at !== null) for (const spring of all) stepSpring(spring, tick - at);
    at = tick;
  };
  const traumaAt = (time) => {
    const value = time < traumaTick ? 0 : trauma * TRAUMA_DECAY_PER_TICK ** (time - traumaTick);
    return value < 0.01 ? 0 : value;
  };
  return {
    springs,
    advance,
    traumaAt,
    kick(tick, name, velocity) {
      advance(tick);
      springs[name].v += velocity;
    },
    addTrauma(tick, magnitude) {
      trauma = Math.min(1, traumaAt(tick) + Math.sqrt(Math.max(0, magnitude) / SHAKE_MAX_PX));
      traumaTick = tick;
    },
    shakeAmplitude: (time) => SHAKE_MAX_PX * traumaAt(time) ** 2,
    // Shake from two layered sines per axis, phased by the (fractional) tick,
    // plus the camera-kick springs. Deterministic: no random source at all.
    cameraOffset(time) {
      const amplitude = SHAKE_MAX_PX * traumaAt(time) ** 2;
      out.x = amplitude * (0.62 * Math.sin(time * 1.9) + 0.38 * Math.sin(time * 4.3 + 1.1)) + springs.kickX.x;
      out.y = amplitude * (0.62 * Math.sin(time * 2.3 + 2.4) + 0.38 * Math.sin(time * 3.7 + 0.5)) + springs.kickY.x;
      return out;
    },
    reset() {
      settle();
      at = null;
      trauma = 0;
      traumaTick = 0;
    },
  };
}

/**
 * Folds the recoil pull-back into the held-weapon overlay's reload dip. The
 * overlay mirrors dip rotation so a positive value tilts the muzzle toward
 * the ground; climb is the opposite way. Returns the dip untouched at rest.
 */
export function withRecoilClimb(dip, recoilPx) {
  if (!recoilPx) return dip;
  return { dy: dip?.dy ?? 0, rotation: (dip?.rotation ?? 0) - recoilPx * RECOIL_CLIMB_PER_PX };
}

/**
 * The native weapon layer's offset (hero body units) with the pull-back
 * applied against the aim direction. That layer pivots at the body origin,
 * so it takes the pull-back only, no climb. Returns the base untouched at rest.
 */
export function withRecoilPullback(base, aim, units) {
  if (!units) return base;
  return { x: (base?.x ?? 0) - aim.x * units, y: (base?.y ?? 0) - aim.y * units, rotation: base?.rotation ?? 0 };
}
