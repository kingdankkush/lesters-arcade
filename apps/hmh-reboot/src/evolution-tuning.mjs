// Wave-1 evolution tuning. Pure data shared by weapon-system.mjs (the weapon
// step) and the lazy evolution-effects.mjs (bomblets, the vent ring, Crit
// Candle's crit); it lives on its own so the lazy chunk imports no simulation
// tables.
import { freezeDeep } from './value-guards.mjs';

// Wave-1 evolution mechanics (design package 8.5, S1.7; build ledger slice 7).
// An evolution is applied by a Genesis Seal (boss-drops.mjs) and reaches the
// weapon through progressionByWeapon's evolutions map. No rule reads RNG
// beyond the existing seeded spread.
//   settler-rail: the Pistol's opt-in sidegrade. Pierce 8 with the rail's lane
//     falloff, armour ignored, the burst off, round damage x damageScale.
//   double-spend: every Shotgun shot queues a free volley delayTicks later,
//     along the aim of that tick, at damageScale pellet damage; no ammo, it
//     ignores the trigger, the clip and a reload, and nextFireTick is
//     unchanged. A switch away, the dry-gun fallback or a stow cancels it.
//   hashstorm-overdrive: no damage bonus. A round fired at heat pierceHeat or
//     more pierces pierceTargets bodies (stamped at fire). Reaching maxHeat
//     vents instead of overheating: a ring (ventRadius, ventDamage,
//     ventKnockback, never the player), heat set to ventHoldHeat and held there
//     for ventLockTicks with the trigger locked.
//   crit-candle ("Moonshot"): +chanceBonus crit chance under the run's cap; a
//     slug whose first body crits crits every body it pierces; each crit kill
//     takes rebateTicksPerKill off the next charge (at most maxKillsPerShot
//     per shot, never below floorTicks). Deep Proof is kept.
//   crypto-bomb-orbit: every blast of the player's grenades (launcher shells
//     and hand grenades) leaves count bomblets orbiting at orbitRadius for
//     lifeTicks; each detonates on first contact or at the end (blastRadius,
//     damageScale of the parent blast, never the player). evolution-effects.mjs
//     runs the pool.
// An evolved finite gun trickles at least a quarter of its grant every 900
// ticks (8.5); its mastered Magazine & Salvage rank already trickles a half.
export const HMH_EVOLUTION_TUNING = freezeDeep({
  'settler-rail': { pierceTargets: 8, damageScale: 1.35 },
  'double-spend': { delayTicks: 8, damageScale: 0.5 },
  'hashstorm-overdrive': { pierceHeat: 60, pierceTargets: 2, ventRadius: 140, ventDamage: 12, ventKnockback: 24, ventHoldHeat: 60, ventLockTicks: 60 },
  'crit-candle': { chanceBonus: 0.15, rebateTicksPerKill: 12, maxKillsPerShot: 3, floorTicks: 36 },
  'crypto-bomb-orbit': { count: 3, orbitRadius: 100, lifeTicks: 45, blastRadius: 64, damageScale: 0.4, poolCap: 12 },
});
