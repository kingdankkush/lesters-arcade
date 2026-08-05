// C2. Impact and death feedback, projection-only.
//
// Two gaps this closes. Firing produced no camera shake at all -- the only
// three shake sites were a grenade blast and two damage events -- so a pistol
// and a grenade launcher carried identical weight on screen. And impact sparks
// fanned at fully random angles, so a hit sprayed backwards into the shooter
// as often as away from the surface.
//
// Nothing here touches collision, damage, AI, spawning, RNG or progression.
// Both outputs are deterministic so a replay draws the identical frame.

// Per-shot camera kick. Ordered by weapon class rather than tuned by feel:
// the launcher is the heaviest thing a player carries, the shotgun sits under
// it, and the minigun's per-shot kick has to stay the LIGHTEST of all because
// it fires far faster than the rest -- a pistol-weight kick at that cadence is
// an unreadable blur rather than weight.
//
// Ceiling is the grenade blast at 10; a weapon must never out-shake ordnance.
export const WEAPON_RECOIL_SHAKE = Object.freeze({
  'coin-blaster': 1.6,
  'scatter-shotgun': 4.2,
  'auto-miner': 0.9,
  'launcher-rig': 7.5,
});

const DEFAULT_RECOIL_SHAKE = 1.6;

// Called from inside the frame loop, so an unrecognised weapon degrades to a
// sensible kick rather than throwing and killing the run.
export function weaponRecoilShake(weaponId) {
  const magnitude = WEAPON_RECOIL_SHAKE[weaponId];
  return Number.isFinite(magnitude) ? magnitude : DEFAULT_RECOIL_SHAKE;
}

// Total spread of the impact spark fan, centred on the reverse of travel.
// Wide enough to read as a burst, narrow enough that the direction is legible.
export const IMPACT_SPRAY_CONE = Math.PI * 0.9;

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

/**
 * Spark angles for one impact, sprayed back along the surface normal.
 *
 * A point-blank hit can resolve with no travel vector, so a zero-length
 * direction falls back to a full circle instead of emitting NaN into the
 * graphics layer.
 */
export function impactSprayAngles({ seed, direction, count }) {
  const total = Math.max(0, Math.trunc(count));
  if (total === 0) return [];
  const length = Math.hypot(direction?.x ?? 0, direction?.y ?? 0);
  const centre = length > 1e-6 ? Math.atan2(-direction.y, -direction.x) : 0;
  const cone = length > 1e-6 ? IMPACT_SPRAY_CONE : Math.PI * 2;
  const angles = [];
  for (let index = 0; index < total; index += 1) {
    // Even spacing plus a seeded jitter inside each slot: an evenly stepped
    // fan alone reads as a mechanical star.
    const slot = (index + 0.5) / total;
    const jitter = (deterministicUnit(`${seed}:${index}`) - 0.5) / total;
    angles.push(centre + (slot + jitter - 0.5) * cone);
  }
  return angles;
}
