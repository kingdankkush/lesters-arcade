import { feedbackUnit } from './deterministic-hash.mjs';

// Projection-only hit reaction for rank-and-file enemies. The simulation's
// only answer to a landed hit is the six-tick hit window plus knockback
// displacement, and the tell / strike poses outrank the hit clip, so a hit
// that lands inside the counterplay windows the archetype copy promises used
// to leave the body untouched. This resolver carries the reaction on the body
// instead (tint flash, knock offset, squash, armour / shield shards) without
// touching pose precedence, so the marker keeps its tell or strike frame and
// the reaction is layered over it.
//
// Pure: a function of the frozen combat:damage fields, the hit age and the
// viewer settings, seeded through feedbackUnit. Nothing here reads an entity,
// so it can never feed back into replays. Loaded by main.mjs through a dynamic
// import so it costs the initial JS budget only its call sites.

const F = Object.freeze;
const TAU = Math.PI * 2;
// Shards fan back along the knock direction inside this cone, the same shape
// the impact spray uses, so the two effects read as one event.
const SHARD_CONE = 1.7;

export const ENEMY_HIT_REACTION = F({
  lifeTicks: 6,
  flashTicks: 2,
  maxOffsetPx: 6,
  squash: 0.08,
  shardsFull: 5,
  shardsReduced: 3,
  flashTint: 0xffd6d6,
  armorShard: 0xb9c6d1,
  shieldShard: 0x8bb8ff,
});

// The same tier rule as game-feel.mjs: the full count at the top quality
// tier, a reduced count on any lower non-zero tier, nothing when particles
// are off.
const tierCount = (particleScale, full, reduced) => (particleScale >= 10 ? full : particleScale > 0 ? reduced : 0);

export function resolveEnemyHitReaction({
  age,
  knockback,
  knockbackResistance = 1,
  damageApplied = 0,
  maxHealth = 1,
  critical = false,
  shielded = false,
  armor = 1,
  supportArmored = false,
  zoom = 1,
  particleScale = 10,
  reduceMotion = false,
  reduceFlash = false,
  seed = '',
} = {}) {
  const table = ENEMY_HIT_REACTION;
  if (!Number.isInteger(age) || age < 0 || age >= table.lifeTicks) return null;
  const kx = knockback?.x ?? 0;
  const ky = knockback?.y ?? 0;
  const magnitude = Math.hypot(kx, ky);
  const life = 1 - age / table.lifeTicks;

  // Knock offset trails against the knockback the simulation already applied,
  // mirroring the hero smear, and decays to zero over the hit window so the
  // body always lands back on its projected point.
  const offset = magnitude > 0 && !reduceMotion ? Math.min(table.maxOffsetPx, magnitude * 0.3) * life * zoom : 0;
  // `+ 0` folds a negative zero back to zero on a straight-axis knock.
  const offsetX = magnitude > 0 ? -kx / magnitude * offset + 0 : 0;
  const offsetY = magnitude > 0 ? -ky / magnitude * offset + 0 : 0;

  // Squash on the first two ticks only: a chunk of the body's health or a
  // critical reads as the full amount; heavy bodies (high knockback
  // resistance) give less. Never more than the table amount either way.
  const severity = critical ? 1 : Math.max(0.5, Math.min(1, maxHealth > 0 ? (damageApplied / maxHealth) * 5 : 1));
  const squashAmount = !reduceMotion && age < table.flashTicks
    ? table.squash * severity / Math.sqrt(Math.max(1, knockbackResistance))
    : 0;

  const flash = age < table.flashTicks && !reduceFlash;
  const armored = armor > 1.05 || shielded || supportArmored;
  const shardColor = shielded ? table.shieldShard : table.armorShard;
  const ringColor = reduceFlash ? 0xffffff : armored ? shardColor : table.flashTint;
  const ring = F({
    radius: (14 - age * 1.5) * zoom,
    alpha: 0.5 * life * (reduceFlash ? 0.5 : 1),
    color: ringColor,
  });

  // Armour / shield shards: only a body that actually resisted the hit sheds
  // them, so plain flesh hits keep the impact burst as their only spray.
  const shards = [];
  const count = armored && !reduceMotion ? tierCount(particleScale, table.shardsFull, table.shardsReduced) : 0;
  const centre = magnitude > 0 ? Math.atan2(-ky, -kx) : 0;
  const cone = magnitude > 0 ? SHARD_CONE : TAU;
  for (let index = 0; index < count; index += 1) {
    const slot = (index + 0.5) / count;
    const jitter = (feedbackUnit(`${seed}:${index}`) - 0.5) / count;
    const angle = centre + (slot + jitter - 0.5) * cone;
    const distance = (7 + age * 3.5 + feedbackUnit(`${seed}:${index}:d`) * 4) * zoom;
    shards.push(F({
      dx: Math.cos(angle) * distance + 0,
      dy: Math.sin(angle) * distance * 0.7 + 0,
      radius: (5 - age * 0.5) * zoom,
      alpha: 0.85 * life * (reduceFlash ? 0.5 : 1),
      color: shardColor,
    }));
  }

  return F({
    // null tells the display to restore its own base tint (the elite tint
    // included) rather than forcing white over it.
    tint: flash ? table.flashTint : null,
    flash,
    offsetX,
    offsetY,
    squashX: 1 + squashAmount,
    squashY: 1 - squashAmount,
    ring,
    shards: F(shards),
  });
}
