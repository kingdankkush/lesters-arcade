import { freezeDeep } from './value-guards.mjs';

export const RUN_UPGRADE_CATALOG = freezeDeep({
  'proof-of-work': {
    id: 'proof-of-work',
    branch: 'power',
    title: 'Proof of Work',
    mechanicalLabel: '+8% damage + Pistol Power',
    description: 'Gain 8% damage and one Pistol Power tier.',
    maxRank: 3,
    effect: 'outgoingDamageMultiplier',
    amount: 0.08,
  },
  'diamond-hands': {
    id: 'diamond-hands',
    branch: 'survival',
    title: 'Diamond Hands',
    mechanicalLabel: '+20 maximum health',
    description: 'Gain 20 max health and restore the added capacity.',
    maxRank: 3,
    effect: 'maxHealthBonus',
    amount: 20,
  },
  'gas-optimization': {
    id: 'gas-optimization',
    branch: 'mobility',
    title: 'Gas Optimization',
    mechanicalLabel: 'Faster Dash cooldown',
    description: 'Shorten Dash cooldown, up to the authored cap.',
    maxRank: 2,
    effect: 'dashCooldownTier',
    amount: 1,
  },
  'cold-storage': {
    id: 'cold-storage',
    branch: 'utility',
    title: 'Cold Storage',
    mechanicalLabel: '+1 Crypto Bomb',
    description: 'Add one hand grenade charge for the current run.',
    maxRank: 3,
    effect: 'bonusGrenadeCharges',
    amount: 1,
  },
  'block-reward': {
    id: 'block-reward',
    branch: 'power',
    title: 'Block Reward',
    mechanicalLabel: '+25% score + Pistol Magazine',
    description: 'Gain 25% score and one Pistol Magazine tier. No wallet value.',
    maxRank: 3,
    effect: 'scoreMultiplier',
    amount: 0.25,
  },
  'validator-training': {
    id: 'validator-training',
    branch: 'utility',
    title: 'Validator Training',
    mechanicalLabel: '+25% XP gain',
    description: 'Gain 25% more XP from every source.',
    maxRank: 3,
    effect: 'xpMultiplier',
    amount: 0.25,
  },
  // Late-run mastery sinks. The six authored upgrades hold 17 total ranks, so
  // without a repeatable tail every level past 18 queued a choice that could
  // never be spent. These are deliberately weaker per rank than the authored
  // picks: they keep long runs growing and preserve the offense/defense
  // decision without out-scaling a focused build.
  'compound-interest': {
    id: 'compound-interest',
    branch: 'power',
    title: 'Compound Interest',
    mechanicalLabel: '+3% outgoing damage',
    description: 'Repeatable: gain 3% outgoing damage.',
    maxRank: 25,
    repeatable: true,
    effect: 'outgoingDamageMultiplier',
    amount: 0.03,
  },
  // Upgrade program S3: the critical machinery already existed in
  // combat-events (seeded, deterministic) and every player hit already
  // carried a base 8% / 1.75x, but nothing let a player invest in it.
  'precision-ledger': {
    id: 'precision-ledger',
    branch: 'power',
    title: 'Precision Ledger',
    mechanicalLabel: '+6% critical chance',
    description: 'Add 6% critical chance, up to the authored cap.',
    maxRank: 3,
    effect: 'criticalChanceBonus',
    amount: 0.06,
  },
  'hard-fork-rounds': {
    id: 'hard-fork-rounds',
    branch: 'power',
    title: 'Hard Fork Rounds',
    mechanicalLabel: '+35% critical damage',
    description: 'Add 35% critical damage for heavier burst hits.',
    maxRank: 3,
    effect: 'criticalDamageBonus',
    amount: 0.35,
  },
  // The mobility branch held a single upgrade capped at two ranks, so a player
  // who wanted a mobility build ran out of anything to pick almost immediately.
  'hot-wallet': {
    id: 'hot-wallet',
    branch: 'mobility',
    title: 'Hot Wallet',
    mechanicalLabel: '+6% speed + Pistol Velocity',
    description: 'Gain 6% speed and one Pistol Velocity tier.',
    maxRank: 3,
    effect: 'moveSpeedMultiplier',
    amount: 0.06,
  },
  'layer-two': {
    id: 'layer-two',
    branch: 'mobility',
    title: 'Layer Two',
    mechanicalLabel: '+2% movement speed',
    description: 'Repeatable: gain 2% movement speed.',
    maxRank: 25,
    repeatable: true,
    effect: 'moveSpeedMultiplier',
    amount: 0.02,
  },
  'hardened-wallet': {
    id: 'hardened-wallet',
    branch: 'survival',
    title: 'Hardened Wallet',
    mechanicalLabel: '+6 maximum health',
    description: 'Repeatable: gain 6 maximum health.',
    maxRank: 25,
    repeatable: true,
    effect: 'maxHealthBonus',
    amount: 6,
  },
  'ledger-conductivity': {
    id: 'ledger-conductivity',
    branch: 'lightning-ledger',
    title: 'Conductivity',
    mechanicalLabel: 'Longer and denser chain mesh',
    description: 'Extend jump range, add bounded arcs, and preserve late-chain damage.',
    maxRank: 3,
    requiresWeaponId: 'lightning-ledger',
    effect: 'ledgerConductivityTier',
    amount: 1,
  },
  'ledger-voltage': {
    id: 'ledger-voltage',
    branch: 'lightning-ledger',
    title: 'Voltage',
    mechanicalLabel: 'Harder contact and faster ramp',
    description: 'Raise contact damage, accelerate ramp, and empower the last arc.',
    maxRank: 3,
    requiresWeaponId: 'lightning-ledger',
    effect: 'ledgerVoltageTier',
    amount: 1,
  },
  'ledger-reconciliation': {
    id: 'ledger-reconciliation',
    branch: 'lightning-ledger',
    title: 'Reconciliation',
    mechanicalLabel: 'Reserve, recovery, and full-chain refund',
    description: 'Carry more cells, reload faster, and refund one bounded full-chain cell.',
    maxRank: 3,
    requiresWeaponId: 'lightning-ledger',
    effect: 'ledgerReconciliationTier',
    amount: 1,
  },
  'proof-of-network': {
    id: 'proof-of-network',
    branch: 'lightning-ledger-capstone',
    title: 'Proof of Network',
    mechanicalLabel: 'Every fifth pulse gains 25% damage',
    description: 'Deterministically amplify every fifth pulse without adding targets.',
    maxRank: 1,
    requiresWeaponId: 'lightning-ledger',
    requiresRanks: { 'ledger-conductivity': 3, 'ledger-voltage': 3, 'ledger-reconciliation': 3 },
    effect: 'ledgerProofOfNetworkTier',
    amount: 1,
  },
  'burner-liquidity': {
    id: 'burner-liquidity', branch: 'bear-market-burner', title: 'Liquidity',
    mechanicalLabel: 'More fuel and faster canister swaps',
    description: 'Increase fuel capacity, improve efficiency, and unlock one emergency refill.',
    maxRank: 3, requiresWeaponId: 'bear-market-burner', effect: 'burnerLiquidityTier', amount: 1,
  },
  'burner-volatility': {
    id: 'burner-volatility', branch: 'bear-market-burner', title: 'Volatility',
    mechanicalLabel: 'Harder flame and longer burn pressure',
    description: 'Raise contact pressure, extend burn duration, and unlock bounded defeat spread.',
    maxRank: 3, requiresWeaponId: 'bear-market-burner', effect: 'burnerVolatilityTier', amount: 1,
  },
  'burner-contagion': {
    id: 'burner-contagion', branch: 'bear-market-burner', title: 'Contagion',
    mechanicalLabel: 'Wider cone, longer reach, and scorch hazard',
    description: 'Expand the cone, preserve edge damage, and add capped deterministic scorch zones.',
    maxRank: 3, requiresWeaponId: 'bear-market-burner', effect: 'burnerContagionTier', amount: 1,
  },
  'total-selloff': {
    id: 'total-selloff', branch: 'bear-market-burner-capstone', title: 'Total Selloff',
    mechanicalLabel: 'Sustained fire triggers one bounded pressure pulse',
    description: 'After a fixed fuel threshold, amplify one pulse and enter a deterministic cooldown.',
    maxRank: 1, requiresWeaponId: 'bear-market-burner',
    requiresRanks: { 'burner-liquidity': 3, 'burner-volatility': 3, 'burner-contagion': 3 },
    effect: 'burnerTotalSelloffTier', amount: 1,
  },
});

const EFFECT_DEFAULTS = Object.freeze({
  outgoingDamageMultiplier: 1,
  maxHealthBonus: 0,
  dashCooldownTier: 0,
  bonusGrenadeCharges: 0,
  scoreMultiplier: 1,
  xpMultiplier: 1,
  moveSpeedMultiplier: 1,
  criticalChanceBonus: 0,
  criticalDamageBonus: 0,
  ledgerConductivityTier: 0,
  ledgerVoltageTier: 0,
  ledgerReconciliationTier: 0,
  ledgerProofOfNetworkTier: 0,
  burnerLiquidityTier: 0,
  burnerVolatilityTier: 0,
  burnerContagionTier: 0,
  burnerTotalSelloffTier: 0,
});

const COMBO_MILESTONE_XP = Object.freeze({ 5: 120, 10: 240, 20: 480, 30: 900 });
export const comboMilestoneXp = (combo) => COMBO_MILESTONE_XP[combo] ?? 0;

function validSeed(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  return value >>> 0;
}

function hashChoice(seed, value) {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function nextLevelThreshold(level) {
  return 150 * level * (level + 1);
}

function resolveEffects(state) {
  const effects = { ...EFFECT_DEFAULTS };
  for (const [id, rank] of Object.entries(state.ranks)) {
    const upgrade = RUN_UPGRADE_CATALOG[id];
    if (!upgrade || rank <= 0) continue;
    if (upgrade.effect === 'dashCooldownTier') effects[upgrade.effect] = Math.min(2, rank);
    else if (upgrade.effect.endsWith('Multiplier')) effects[upgrade.effect] += upgrade.amount * rank;
    else effects[upgrade.effect] += upgrade.amount * rank;
  }
  return freezeDeep(effects);
}

function remainingRankCapacity(state) {
  let capacity = 0;
  for (const upgrade of Object.values(RUN_UPGRADE_CATALOG)) {
    capacity += Math.max(0, upgrade.maxRank - (state.ranks[upgrade.id] ?? 0));
  }
  return capacity;
}

function isUpgradeEligible(state, upgrade) {
  if ((state.ranks[upgrade.id] ?? 0) >= upgrade.maxRank) return false;
  if (upgrade.requiresWeaponId && !state.ownedWeaponIds.has(upgrade.requiresWeaponId)) return false;
  if (upgrade.requiresRanks && Object.entries(upgrade.requiresRanks).some(([id, rank]) => (state.ranks[id] ?? 0) < rank)) return false;
  return true;
}

export function getEligibleRunUpgradeIds(state) {
  if (!state || !(state.ownedWeaponIds instanceof Set)) throw new TypeError('run progression state is required');
  return Object.freeze(Object.values(RUN_UPGRADE_CATALOG)
    .filter((upgrade) => isUpgradeEligible(state, upgrade))
    .map((upgrade) => upgrade.id)
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
}

function resolveChoices(state) {
  if (state.pendingLevels <= 0) return Object.freeze([]);
  const salt = `${state.level}:${state.pendingLevels}:${state.selectionSequence}`;
  const choices = Object.values(RUN_UPGRADE_CATALOG)
    .filter((upgrade) => isUpgradeEligible(state, upgrade))
    .map((upgrade) => ({ upgrade, order: hashChoice(state.seed, `${salt}:${upgrade.id}`) }))
    .sort((a, b) => a.order - b.order || (a.upgrade.id < b.upgrade.id ? -1 : a.upgrade.id > b.upgrade.id ? 1 : 0))
    // Cycle 036 handoff, Priority E: every level-up offers exactly TWO
    // deterministic options. The pair is a pure function of seed, level,
    // ranks and selection sequence.
    .slice(0, 2)
    .map(({ upgrade }) => freezeDeep({
      ...upgrade,
      rank: state.ranks[upgrade.id] ?? 0,
      nextRank: (state.ranks[upgrade.id] ?? 0) + 1,
    }));
  return Object.freeze(choices);
}

export function createRunProgression({ seed = 0, ownedWeaponIds = ['coin-blaster'] } = {}) {
  if (!Array.isArray(ownedWeaponIds) || ownedWeaponIds.length < 1 || ownedWeaponIds.length > 32) throw new TypeError('ownedWeaponIds must be a bounded non-empty array');
  const normalizedWeaponIds = ownedWeaponIds.map((id) => {
    if (typeof id !== 'string' || !id || id.length > 64) throw new TypeError('owned weapon ID must be a bounded string');
    return id;
  });
  return {
    seed: validSeed(seed),
    score: 0,
    xp: 0,
    level: 1,
    pendingLevels: 0,
    selectionSequence: 0,
    ranks: Object.fromEntries(Object.keys(RUN_UPGRADE_CATALOG).map((id) => [id, 0])),
    ownedWeaponIds: new Set(normalizedWeaponIds),
    recordedEnemyIds: new Set(),
    lastEvent: null,
  };
}

export function unlockRunProgressionWeapon(state, weaponId) {
  if (!state || !(state.ownedWeaponIds instanceof Set)) throw new TypeError('run progression state is required');
  if (typeof weaponId !== 'string' || !weaponId || weaponId.length > 64) throw new TypeError('weaponId must be a bounded string');
  const alreadyOwned = state.ownedWeaponIds.has(weaponId);
  state.ownedWeaponIds.add(weaponId);
  return freezeDeep({ weaponId, alreadyOwned, eligibleUpgradeIds: getEligibleRunUpgradeIds(state) });
}

export function getRunProgressionSnapshot(state) {
  if (!state || !(state.recordedEnemyIds instanceof Set) || !(state.ownedWeaponIds instanceof Set)) throw new TypeError('run progression state is required');
  const currentFloor = state.level === 1 ? 0 : nextLevelThreshold(state.level - 1);
  const nextThreshold = nextLevelThreshold(state.level);
  return freezeDeep({
    score: state.score,
    xp: state.xp,
    level: state.level,
    xpCurrentLevel: state.xp - currentFloor,
    xpForNextLevel: nextThreshold - currentFloor,
    xpProgress: Math.max(0, Math.min(1, (state.xp - currentFloor) / (nextThreshold - currentFloor))),
    pendingLevels: state.pendingLevels,
    pendingChoices: resolveChoices(state),
    ranks: { ...state.ranks },
    ownedWeaponIds: [...state.ownedWeaponIds].sort((left, right) => left < right ? -1 : left > right ? 1 : 0),
    effects: resolveEffects(state),
    recordedDefeats: state.recordedEnemyIds.size,
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
  });
}

function applyRunXp(state, baseXp) {
  const xpGain = Math.round(baseXp * resolveEffects(state).xpMultiplier);
  state.xp += xpGain;
  let levelsGained = 0;
  while (state.level < 1000 && state.xp >= nextLevelThreshold(state.level)) {
    state.level += 1;
    if (state.pendingLevels < remainingRankCapacity(state)) state.pendingLevels += 1;
    levelsGained += 1;
  }
  return { xpGain, levelsGained };
}

export function grantRunXp(state, baseXp, tick) {
  if (!Number.isInteger(baseXp) || baseXp <= 0 || baseXp > 1_000_000) throw new TypeError('baseXp must be a positive bounded integer');
  const gained = applyRunXp(state, baseXp);
  state.lastEvent = { tick, ...gained };
  return getRunProgressionSnapshot(state);
}

export function recordRunDefeat(state, { enemyId, threatCost, tick } = {}) {
  if (typeof enemyId !== 'string' || !enemyId || enemyId.length > 128) throw new TypeError('enemyId must be a non-empty bounded string');
  if (!Number.isInteger(threatCost) || threatCost < 0 || threatCost > 1024) throw new TypeError('threatCost must be an integer from 0 to 1024');
  if (!Number.isInteger(tick) || tick < 0 || tick > 1_000_000_000) throw new TypeError('tick must be a non-negative bounded integer');
  if (state.recordedEnemyIds.has(enemyId)) throw new Error(`enemyId ${enemyId} was already recorded`);
  const scoreGain = Math.round((100 + threatCost * 25) * resolveEffects(state).scoreMultiplier);
  state.recordedEnemyIds.add(enemyId);
  state.score += scoreGain;
  const gained = applyRunXp(state, 80 + threatCost * 20);
  state.lastEvent = { sourceId: `enemy:${enemyId}`, enemyId, tick, scoreGain, ...gained };
  return getRunProgressionSnapshot(state);
}

export function selectRunUpgrade(state, upgradeId) {
  if (typeof upgradeId !== 'string' || !Object.hasOwn(RUN_UPGRADE_CATALOG, upgradeId)) {
    throw new TypeError('upgradeId must identify an authored upgrade');
  }
  const choices = resolveChoices(state);
  const selected = choices.find((choice) => choice.id === upgradeId);
  if (!selected) throw new Error(`upgrade ${String(upgradeId)} is not currently offered`);
  state.ranks[upgradeId] += 1;
  state.pendingLevels -= 1;
  state.selectionSequence += 1;
  const snapshot = getRunProgressionSnapshot(state);
  return freezeDeep({
    selected: { ...selected, rank: state.ranks[upgradeId] },
    effects: snapshot.effects,
    snapshot,
  });
}
