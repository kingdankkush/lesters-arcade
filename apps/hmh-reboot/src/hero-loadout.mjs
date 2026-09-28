// Hero loadouts (1.9.2, owner request 2026-09-27): every playable hero starts
// with the Pistol and has four real starting stats on a 1-5 scale plus one
// unique perk. The simulation reads this table; the portal's hero select shows
// the same numbers. Every hero's stats add up to HMH_HERO_STAT_TOTAL, so the
// roster is balanced by trade-offs rather than by power.
//
// Stat 3 is the neutral baseline. Each point above or below it moves:
//   Power  outgoing damage          5% a point
//   Speed  movement speed           4% a point
//   Armor  incoming damage          5% a point (less damage taken)
//   Luck   critical-hit chance      2 percentage points a point
//
// None of these touch XP, score, drops, grenade supply or spawns, so the
// Ranked plausibility ceilings stay hero-independent.

export const HMH_HERO_STAT_MAX = 5;
export const HMH_HERO_STAT_BASELINE = 3;
export const HMH_HERO_STAT_TOTAL = 14;
export const HMH_HERO_STARTING_WEAPON_ID = 'coin-blaster';

const POWER_STEP = 0.05;
const SPEED_STEP = 0.04;
const ARMOR_STEP = 0.05;
const LUCK_STEP = 0.02;

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

export const HMH_HERO_LOADOUTS = freezeDeep({
  'lit-commando': {
    stats: { power: 4, speed: 2, armor: 5, luck: 3 },
    perk: { id: 'reserve-plating', title: 'Reserve Plating', description: 'Starts every run with 20 extra max health (120 HP).', maxHealthBonus: 20 },
  },
  'lit-valkyrie': {
    stats: { power: 3, speed: 5, armor: 2, luck: 4 },
    perk: { id: 'velocity-trigger', title: 'Velocity Trigger', description: 'Moves 10% faster while shooting.', firingMoveSpeedMultiplier: 1.1 },
  },
  'lester-original': {
    stats: { power: 4, speed: 4, armor: 3, luck: 3 },
    perk: { id: 'block-time', title: 'Block Time', description: 'Dash recharges 25% faster. Litecoin blocks are quicker, and so is Lester.', dashCooldownScale: 0.75 },
  },
  lilly: {
    stats: { power: 3, speed: 3, armor: 3, luck: 5 },
    perk: { id: 'zero-knowledge-crits', title: 'Zero-Knowledge Crits', description: 'Critical hits deal 25% more damage. Proven, never revealed.', criticalDamageBonus: 0.25 },
  },
});

const NEUTRAL = freezeDeep({
  heroId: null,
  stats: { power: 3, speed: 3, armor: 3, luck: 3 },
  perkId: null,
  outgoingDamageMultiplier: 1,
  moveSpeedMultiplier: 1,
  incomingDamageMultiplier: 1,
  criticalChanceBonus: 0,
  criticalDamageBonus: 0,
  maxHealthBonus: 0,
  firingMoveSpeedMultiplier: 1,
  dashCooldownScale: 1,
});

function canonicalHeroId(heroId) {
  const id = String(heroId ?? '').trim().toLowerCase();
  return id === 'lester' ? 'lester-original' : id;
}

// The simulation modifiers for a hero; an unknown hero plays neutral.
export function heroModifiersFor(heroId) {
  const id = canonicalHeroId(heroId);
  const loadout = Object.hasOwn(HMH_HERO_LOADOUTS, id) ? HMH_HERO_LOADOUTS[id] : null;
  if (!loadout) return NEUTRAL;
  const { power, speed, armor, luck } = loadout.stats;
  const perk = loadout.perk;
  return freezeDeep({
    heroId: id,
    stats: { ...loadout.stats },
    perkId: perk.id,
    outgoingDamageMultiplier: 1 + POWER_STEP * (power - HMH_HERO_STAT_BASELINE),
    moveSpeedMultiplier: 1 + SPEED_STEP * (speed - HMH_HERO_STAT_BASELINE),
    incomingDamageMultiplier: 1 - ARMOR_STEP * (armor - HMH_HERO_STAT_BASELINE),
    criticalChanceBonus: LUCK_STEP * (luck - HMH_HERO_STAT_BASELINE),
    criticalDamageBonus: perk.criticalDamageBonus ?? 0,
    maxHealthBonus: perk.maxHealthBonus ?? 0,
    firingMoveSpeedMultiplier: perk.firingMoveSpeedMultiplier ?? 1,
    dashCooldownScale: perk.dashCooldownScale ?? 1,
  });
}
