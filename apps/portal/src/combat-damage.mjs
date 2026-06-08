// Hard Money Heroes — combat damage model + balance constants (pure, testable).
//
// One source of truth for how raw weapon damage becomes a final number:
// applies level-up stat multipliers, damage-type modifiers, and critical hits.
// The renderer/runtime calls computeDamage() and shows the result as a floating
// number; balancing happens here (and in tests) instead of scattered magic.

// ---- Balance constants (tune here; covered by tests) ----
export const DAMAGE_BALANCE = Object.freeze({
  baseCritChance: 0.08,        // 8% before stat bonuses
  baseCritMultiplier: 1.75,    // crits deal 175% damage
  // Damage-type modifiers vs. armored/unarmored enemies.
  types: Object.freeze({
    normal: { armoredMult: 1.0, unarmoredMult: 1.0, color: '#ffe84d' },
    'armor-piercing': { armoredMult: 1.6, unarmoredMult: 0.9, color: '#19f7ff' },
    'hollow-point': { armoredMult: 0.7, unarmoredMult: 1.55, color: '#ff8a3d' },
    incendiary: { armoredMult: 1.1, unarmoredMult: 1.25, color: '#ff5a3c', dot: true },
  }),
  // Per-source base damage (percent-of-enemy-style units used by the game).
  sourceBase: Object.freeze({
    bullet: 6,
    'hash-rail': 9,
    melee: 11,
    knife: 11,
    grenade: 16,
    axe: 14,
    explosion: 16,
  }),
  critColor: '#ff2e6a',
});

export function damageTypeColor(type) {
  return DAMAGE_BALANCE.types[type]?.color ?? DAMAGE_BALANCE.types.normal.color;
}

// rng defaults to Math.random but is injectable for deterministic tests.
export function rollCritical(stats = {}, rng = Math.random) {
  const chance = Math.min(0.95, (DAMAGE_BALANCE.baseCritChance) + (stats.critChanceBonus ?? 0));
  return rng() < chance;
}

// Compute final damage for one hit. Returns a structured result so the runtime
// can both apply hp loss AND render a styled floating number.
export function computeDamage({
  source = 'bullet',
  type = 'normal',
  stats = {},
  enemyArmored = false,
  rng = Math.random,
} = {}) {
  const base = DAMAGE_BALANCE.sourceBase[source] ?? DAMAGE_BALANCE.sourceBase.bullet;
  const typeDef = DAMAGE_BALANCE.types[type] ?? DAMAGE_BALANCE.types.normal;
  const typeMult = enemyArmored ? typeDef.armoredMult : typeDef.unarmoredMult;
  const statMult = stats.damage ?? 1; // level-up damage cards
  const flatBonus = stats.flatDamage ?? 0;

  let amount = (base * statMult * typeMult) + flatBonus;
  const crit = rollCritical(stats, rng);
  if (crit) amount *= (DAMAGE_BALANCE.baseCritMultiplier + (stats.critMultiplierBonus ?? 0));

  const finalAmount = Math.max(1, Math.round(amount));
  return Object.freeze({
    amount: finalAmount,
    crit,
    type,
    color: crit ? DAMAGE_BALANCE.critColor : damageTypeColor(type),
    // Floating-number label, e.g. "12", "21!" (crit), "AP 18" hint via prefix.
    label: crit ? `${finalAmount}!` : `${finalAmount}`,
    dot: Boolean(typeDef.dot),
  });
}

// Enemy archetype balance: base HP / speed / score / spawn pacing, kept here so
// difficulty tuning is one place. Covers the full canonical roster + bonus
// PixelLab enemies. `armored` enemies favor armor-piercing damage types.
export const ENEMY_BALANCE = Object.freeze({
  // --- Canonical hand-made enemies (Justin's art) ---
  'crypto-bro': { hp: 12, speed: 2.0, score: 70, armored: false, contactDamage: 6, tier: 'grunt' },
  'trench-degen': { hp: 16, speed: 1.9, score: 90, armored: false, contactDamage: 7, tier: 'grunt' },
  'gas-beast': { hp: 24, speed: 1.5, score: 150, armored: false, contactDamage: 9, tier: 'heavy' },
  'evil-banker': { hp: 30, speed: 1.4, score: 180, armored: true, contactDamage: 9, tier: 'heavy' },
  // --- Canonical bosses ---
  'warren-boss': { hp: 180, speed: 1.2, score: 900, armored: true, contactDamage: 12, boss: true },
  'evil-boss': { hp: 260, speed: 1.0, score: 1500, armored: true, contactDamage: 15, boss: true },
  // --- Bonus PixelLab enemies (additional roster) ---
  'bonus-fud-goblin': { hp: 14, speed: 1.8, score: 80, armored: false, contactDamage: 7, tier: 'grunt' },
  'bonus-gas-fee-wisp': { hp: 20, speed: 2.2, score: 140, armored: false, contactDamage: 8, tier: 'flyer' },
  'bonus-whale-dumper': { hp: 220, speed: 1.1, score: 1200, armored: true, contactDamage: 14, boss: true },
});

// Validate that the balance curve is sane so a bad tune fails tests rather than
// shipping. Returns { ok, errors[] }.
export function validateBalance() {
  const errors = [];
  const enemies = Object.entries(ENEMY_BALANCE);
  for (const [id, e] of enemies) {
    if (e.hp <= 0) errors.push(`${id} hp must be > 0`);
    if (e.score <= 0) errors.push(`${id} score must be > 0`);
    if (e.contactDamage < 0) errors.push(`${id} contactDamage must be >= 0`);
  }
  // Every boss should out-HP and out-score every non-boss enemy.
  const bosses = enemies.filter(([, e]) => e.boss);
  const grunts = enemies.filter(([, e]) => !e.boss);
  const minBossHp = Math.min(...bosses.map(([, e]) => e.hp));
  const minBossScore = Math.min(...bosses.map(([, e]) => e.score));
  for (const [id, e] of grunts) {
    if (e.hp >= minBossHp) errors.push(`boss hp should exceed ${id}`);
    if (e.score >= minBossScore) errors.push(`boss score should exceed ${id}`);
  }
  return { ok: errors.length === 0, errors };
}
