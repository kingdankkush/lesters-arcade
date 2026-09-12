// Reload presentation. None of the four production atlases carries a 'reload'
// clip on any layer, so for the 1.5-3 s a magazine takes the gun simply sat in
// its aim frame. This module turns the authoritative reload window into a
// weapon-layer pose: the muzzle eases toward the ground, holds, and snaps back
// on the completion tick, which is the same tick the 'reload-complete' cue and
// the HUD ring flash land on.
//
// Loaded only through dynamic import() from main.mjs (it is not initial JS),
// so every function here is pure and tolerates being absent: the runtime
// skips the bob until the chunk is resident. Inputs are tick-derived
// progress values; outputs are sprite offsets. Nothing here reads a clock or
// a random source, so the same progress always yields the same pose.

const ZERO_POSE = Object.freeze({ dy: 0, rotation: 0 });
const ZERO_OFFSET = Object.freeze({ x: 0, y: 0, rotation: 0 });

// Atlas body units (the 160-unit hero body). Six units of drop plus a 0.22 rad
// tilt reads as "gun lowered" without pulling the grip out of the hands.
const DIP_DY = 6;
const DIP_ROTATION = -0.22;
// Progress windows: ease down, hold, snap back. The snap is deliberately short
// so the gun is level again exactly when the clip refills.
const DIP_END = 0.25;
const SNAP_START = 0.85;
// Height of the grip above the body origin, used to counter the sideways
// drift a rotation about the feet would otherwise give the gun.
const GRIP_HEIGHT = 92;

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric < 0 ? 0 : numeric > 1 ? 1 : numeric;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// rotation is negative here and means "muzzle toward the ground for a weapon
// whose muzzle points screen-left"; the call sites mirror it for a
// right-pointing weapon (Pixi rotates clockwise for positive radians).
export function resolveReloadPose({ progress, reduceMotion = false } = {}) {
  if (reduceMotion) return ZERO_POSE;
  const p = clamp01(progress);
  if (p <= 0 || p >= 1) return ZERO_POSE;
  let amount;
  if (p < DIP_END) {
    amount = smoothstep(p / DIP_END);
  } else if (p < SNAP_START) {
    amount = 1;
  } else {
    // Fastest at the start of the snap so the return reads as a rack, not a
    // drift; the square keeps it monotone all the way to zero.
    const t = (p - SNAP_START) / (1 - SNAP_START);
    amount = (1 - t) * (1 - t);
  }
  return Object.freeze({ dy: DIP_DY * amount, rotation: DIP_ROTATION * amount });
}

// The bob may only ride the poses that leave the weapon layer idle. The
// 12-tick pistol-fire clip plays out before the dip begins, and the authored
// full-body clips (melee, grenade, dash, death, interact) keep exclusive
// ownership of the layer.
export function resolveReloadHeroAction({ action } = {}) {
  return action === 'aim' || action === 'hurt';
}

// The hero weapon layer rotates about the body origin (its anchor sits at
// the feet), so a bare rotation would swing the gun sideways by roughly
// GRIP_HEIGHT * sin(rotation). The x term cancels that drift so the grip
// stays in the hands and only the muzzle tilts. facingWest mirrors the tilt
// for the simulation directions whose muzzle points screen-left.
export function resolveReloadLayerOffset({ pose, facingWest = false } = {}) {
  if (!pose || (pose.dy === 0 && pose.rotation === 0)) return ZERO_OFFSET;
  const rotation = facingWest ? pose.rotation : -pose.rotation;
  return Object.freeze({ x: -Math.sin(rotation) * GRIP_HEIGHT, y: pose.dy, rotation });
}
