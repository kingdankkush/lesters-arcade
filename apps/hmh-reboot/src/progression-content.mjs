// Player-facing level-up card text (design package S0.2 bundle offset).
//
// run-progression.mjs holds the upgrade mechanics the simulation reads; this
// module holds only the words a card and the pause build list show. It is a
// lazy chunk: main.mjs loads it with the upgrade panel before a run starts, so
// the text never counts against the child's initial-JS cap and can never reach
// the simulation, the run summary or a replay.
import { freezeDeep } from './value-guards.mjs';

export const RUN_UPGRADE_CONTENT = freezeDeep({
  'proof-of-work': {
    title: 'Damage',
    mechanicalLabel: '+8% damage + Pistol Power',
    description: 'Gain 8% damage and one Pistol Power tier.',
  },
  'diamond-hands': {
    title: 'Max Health',
    mechanicalLabel: '+20 maximum health',
    description: 'Gain 20 max health and restore the added capacity.',
  },
  'gas-optimization': {
    title: 'Dash Recharge',
    mechanicalLabel: 'Faster Dash cooldown',
    description: 'Shorten Dash cooldown, up to the authored cap.',
  },
  'cold-storage': {
    title: 'Extra Grenade',
    mechanicalLabel: '+1 Grenade',
    description: 'Add one hand grenade charge for the current run.',
  },
  'block-reward': {
    title: 'Score & Magazine',
    mechanicalLabel: '+25% score + Pistol Magazine',
    description: 'Gain 25% score and one Pistol Magazine tier. No wallet value.',
  },
  'validator-training': {
    title: 'XP Gain',
    mechanicalLabel: '+25% XP gain',
    description: 'Gain 25% more XP from every source.',
  },
  'compound-interest': {
    title: 'Damage Mastery',
    mechanicalLabel: '+3% outgoing damage',
    description: 'Repeatable: gain 3% outgoing damage.',
  },
  'precision-ledger': {
    title: 'Critical Chance',
    mechanicalLabel: '+6% critical chance',
    description: 'Add 6% critical chance, up to the authored cap.',
  },
  'hard-fork-rounds': {
    title: 'Critical Damage',
    mechanicalLabel: '+35% critical damage',
    description: 'Add 35% critical damage for heavier burst hits.',
  },
  'hot-wallet': {
    title: 'Movement Speed',
    mechanicalLabel: '+6% speed + Pistol Velocity',
    description: 'Gain 6% speed and one Pistol Velocity tier.',
  },
  'layer-two': {
    title: 'Speed Mastery',
    mechanicalLabel: '+2% movement speed',
    description: 'Repeatable: gain 2% movement speed.',
  },
  'hardened-wallet': {
    title: 'Health Mastery',
    mechanicalLabel: '+6 maximum health',
    description: 'Repeatable: gain 6 maximum health.',
  },
  'ledger-conductivity': {
    title: 'Arc Range',
    mechanicalLabel: 'Longer and denser chain mesh',
    description: 'Extend jump range, add bounded arcs, and preserve late-chain damage.',
  },
  'ledger-voltage': {
    title: 'Arc Damage',
    mechanicalLabel: 'Harder contact and faster ramp',
    description: 'Raise contact damage, accelerate ramp, and empower the last arc.',
  },
  'ledger-reconciliation': {
    title: 'Energy Reserves',
    mechanicalLabel: 'Reserve, recovery, and full-chain refund',
    description: 'Carry more cells, reload faster, and refund one bounded full-chain cell.',
  },
  'proof-of-network': {
    title: 'Overcharged Pulse',
    mechanicalLabel: 'Every fifth pulse gains 25% damage',
    description: 'Deterministically amplify every fifth pulse without adding targets.',
  },
  'burner-liquidity': {
    title: 'Fuel Capacity',
    mechanicalLabel: 'More fuel and faster canister swaps',
    description: 'Increase fuel capacity, improve efficiency, and unlock one emergency refill.',
  },
  'burner-volatility': {
    title: 'Burn Damage',
    mechanicalLabel: 'Harder flame and longer burn pressure',
    description: 'Raise contact pressure, extend burn duration, and unlock bounded defeat spread.',
  },
  'burner-contagion': {
    title: 'Flame Reach',
    mechanicalLabel: 'Wider cone, longer reach, and scorch hazard',
    description: 'Expand the cone, preserve edge damage, and add capped deterministic scorch zones.',
  },
  'total-selloff': {
    title: 'Flame Surge',
    mechanicalLabel: 'Sustained fire triggers one bounded pressure pulse',
    description: 'After a fixed fuel threshold, amplify one pulse and enter a deterministic cooldown.',
  },
  'standard-reach': {
    title: 'Melee Reach',
    mechanicalLabel: 'Longer reach and wider attack arcs',
    description: 'Extend both attacks while preserving bounded contact caps.',
  },
  'standard-force': {
    title: 'Melee Damage',
    mechanicalLabel: 'More damage and knockback',
    description: 'Increase thrust and sweep pressure without adding contacts.',
  },
  'standard-tempo': {
    title: 'Attack Speed',
    mechanicalLabel: 'Faster cadence and shorter whiff recovery',
    description: 'Shorten fixed-tick recovery while retaining a finite whiff cost.',
  },
  'canonical-fork': {
    title: 'Power Strike',
    mechanicalLabel: 'Every fourth attack gains 25% damage',
    description: 'Deterministically empower every fourth attack without raising target caps.',
  },
});

const MISSING_CONTENT = freezeDeep({ title: '', mechanicalLabel: '', description: '' });

// The text for one upgrade id. An unknown id reads as its own id rather than
// throwing, so a card can never break the level-up panel.
export function runUpgradeContent(id) {
  const content = Object.hasOwn(RUN_UPGRADE_CONTENT, id) ? RUN_UPGRADE_CONTENT[id] : null;
  return content ?? freezeDeep({ ...MISSING_CONTENT, title: String(id ?? '') });
}
