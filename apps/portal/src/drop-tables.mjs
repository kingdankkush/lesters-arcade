// Hard Money Heroes — Parameterized drop tables (Level Design Bible §6.5/§10 slice #4).
//
// Drop tables are parameterized by enemy tier × biome × luck/loot-quality, producing
// deterministic picks from a seeded RNG so a replay re-sims the same drops. Also
// provides a placement validator enforcing the bible's "never spawn in collision /
// under death clutter" rule.
//
// All pure functions; no DOM; deterministic for the same seed + inputs.

import { mulberry32 } from './seeded-rng.mjs';

// Seeded PRNG (mulberry32) is imported from the canonical seeded-rng module so
// there is one source of truth for determinism across the codebase.

// Default drop weights by enemy tier. Higher tiers shift toward rarer/more valuable
// drops. Each entry is { id, weight }. The caller can override per-biome.
export const DROP_TABLES = Object.freeze({
  grunt: Object.freeze([
    { id: 'xp-gem', weight: 60 },
    { id: 'ltc-cache', weight: 20 },
    { id: 'grenade-crate', weight: 14 },
    { id: 'ammo-cache', weight: 12 },
    { id: 'heal-pack', weight: 5 },
    { id: 'shield-cache', weight: 3 },
  ]),
  elite: Object.freeze([
    { id: 'xp-gem', weight: 30 },
    { id: 'ltc-cache', weight: 20 },
    { id: 'grenade-crate', weight: 14 },
    { id: 'ammo-cache', weight: 12 },
    { id: 'block-breaker-shells', weight: 8 },
    { id: 'hashstorm-drum', weight: 8 },
    { id: 'heal-pack', weight: 8 },
    { id: 'shield-cache', weight: 7 },
    { id: 'magnet-surge', weight: 4 },
    { id: 'berserk-candle', weight: 3 },
  ]),
  boss: Object.freeze([
    { id: 'xp-gem', weight: 12 },
    { id: 'ltc-cache', weight: 16 },
    { id: 'grenade-crate', weight: 14 },
    { id: 'block-breaker-shells', weight: 12 },
    { id: 'hashstorm-drum', weight: 12 },
    { id: 'nuke-liquidation', weight: 14 },
    { id: 'berserk-candle', weight: 14 },
    { id: 'time-dilation', weight: 12 },
    { id: 'heal-pack', weight: 8 },
    { id: 'shield-cache', weight: 8 },
  ]),
});

// Pick a drop from the appropriate table for the given enemy tier, biome, and luck.
// `luck` shifts the effective table toward rarer drops (luck > 1 favors higher-index
// entries; luck < 1 favors common ones). Returns the picked drop id, or null if the
// roll fails (no drop this kill).
export function rollDrop({
  seed = 0,
  tier = 'grunt',
  luck = 1,
  dropChance = 0.35,
  biome = null,
  tables = DROP_TABLES,
} = {}) {
  const rng = mulberry32(seed);
  // First roll: does this enemy drop anything at all?
  if (rng() > dropChance) return null;
  let table = tables[tier] ?? tables.grunt;
  // Luck adjustment: scale weights so higher-index (rarer) entries get more weight
  // as luck increases. This is deterministic given the same seed.
  if (luck !== 1) {
    table = table.map((entry, i) => ({
      id: entry.id,
      weight: Math.max(0.01, entry.weight * (1 + (i / table.length) * (luck - 1))),
    }));
  }
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return table[table.length - 1].id;
}

// Validate that a candidate pickup spawn position is safe: not inside any collision
// rect and not overlapping any death/debris marker. Returns { ok, reason }.
export function isPickupPlacementSafe({
  x = 0,
  y = 0,
  radius = 8,
  collisionRects = [],
  deathMarkers = [],
} = {}) {
  for (const r of collisionRects) {
    if (!r) continue;
    const closestX = Math.max(r.x, Math.min(x, r.x + (r.w ?? 0)));
    const closestY = Math.max(r.y, Math.min(y, r.y + (r.h ?? 0)));
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy < radius * radius) {
      return { ok: false, reason: 'collision' };
    }
  }
  for (const d of deathMarkers) {
    if (!d) continue;
    const dx = x - (d.x ?? 0);
    const dy = y - (d.y ?? 0);
    const deathRadius = d.radius ?? 16;
    if (dx * dx + dy * dy < (radius + deathRadius) * (radius + deathRadius)) {
      return { ok: false, reason: 'death-clutter' };
    }
  }
  return { ok: true, reason: null };
}

// Validates drop-table invariants (called during npm test).
export function validateDropTables() {
  const errors = [];
  // Basic: grunt should mostly drop xp-gem (highest weight).
  const gruntPick = rollDrop({ seed: 42, tier: 'grunt', dropChance: 1.0 });
  if (!gruntPick) errors.push('grunt should drop something at 100% dropChance');
  // Boss should have access to rare drops.
  const bossPick = rollDrop({ seed: 100, tier: 'boss', dropChance: 1.0 });
  if (!bossPick) errors.push('boss should drop something at 100% dropChance');
  // Determinism: same seed → same pick.
  const a = rollDrop({ seed: 7, tier: 'elite', dropChance: 1.0 });
  const b = rollDrop({ seed: 7, tier: 'elite', dropChance: 1.0 });
  if (a !== b) errors.push('rollDrop should be deterministic for the same seed');
  // Placement: safe spot returns ok.
  const safe = isPickupPlacementSafe({ x: 50, y: 50, radius: 8, collisionRects: [{ x: 0, y: 0, w: 10, h: 10 }], deathMarkers: [] });
  if (!safe.ok) errors.push('pickup at (50,50) should be safe from collision at (0,0,10,10)');
  // Placement: inside collision returns not ok.
  const unsafe = isPickupPlacementSafe({ x: 5, y: 5, radius: 8, collisionRects: [{ x: 0, y: 0, w: 10, h: 10 }], deathMarkers: [] });
  if (unsafe.ok) errors.push('pickup at (5,5) should be inside collision rect');
  // Placement: on death marker returns not ok.
  const cluttered = isPickupPlacementSafe({ x: 10, y: 10, radius: 8, collisionRects: [], deathMarkers: [{ x: 10, y: 10, radius: 16 }] });
  if (cluttered.ok) errors.push('pickup on death marker should not be safe');
  return { ok: errors.length === 0, errors };
}
