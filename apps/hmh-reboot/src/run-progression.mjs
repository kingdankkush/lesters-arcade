import { freezeDeep } from './value-guards.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../../../sdk/hmh-run-summary-schema.mjs';

function gunBranchCards(weaponId, ids) {
  return Object.fromEntries(ids.map((id) => [id, { id, branch: weaponId, maxRank: 3, requiresWeaponId: weaponId, effect: 'gunBranchTier', amount: 1 }]));
}

// Upgrade mechanics only. The card text (title, mechanical label, description)
// lives in progression-content.mjs, a lazy chunk (design package S0.2), so
// offers, selections and the run summary carry ids and numbers, never words.
export const RUN_UPGRADE_CATALOG = freezeDeep({
  'proof-of-work': {
    id: 'proof-of-work',
    branch: 'power',
    maxRank: 3,
    effect: 'outgoingDamageMultiplier',
    amount: 0.08,
  },
  'diamond-hands': {
    id: 'diamond-hands',
    branch: 'survival',
    maxRank: 3,
    effect: 'maxHealthBonus',
    amount: 20,
  },
  'gas-optimization': {
    id: 'gas-optimization',
    branch: 'mobility',
    maxRank: 2,
    effect: 'dashCooldownTier',
    amount: 1,
  },
  'cold-storage': {
    id: 'cold-storage',
    branch: 'utility',
    maxRank: 3,
    effect: 'bonusGrenadeCharges',
    amount: 1,
  },
  'block-reward': {
    id: 'block-reward',
    branch: 'power',
    maxRank: 3,
    effect: 'scoreMultiplier',
    amount: 0.25,
  },
  'validator-training': {
    id: 'validator-training',
    branch: 'utility',
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
    maxRank: 3,
    effect: 'criticalChanceBonus',
    amount: 0.06,
  },
  'hard-fork-rounds': {
    id: 'hard-fork-rounds',
    branch: 'power',
    maxRank: 3,
    effect: 'criticalDamageBonus',
    amount: 0.35,
  },
  // The mobility branch held a single upgrade capped at two ranks, so a player
  // who wanted a mobility build ran out of anything to pick almost immediately.
  'hot-wallet': {
    id: 'hot-wallet',
    branch: 'mobility',
    maxRank: 3,
    effect: 'moveSpeedMultiplier',
    amount: 0.06,
  },
  'layer-two': {
    id: 'layer-two',
    branch: 'mobility',
    maxRank: 25,
    repeatable: true,
    effect: 'moveSpeedMultiplier',
    amount: 0.02,
  },
  'hardened-wallet': {
    id: 'hardened-wallet',
    branch: 'survival',
    maxRank: 25,
    repeatable: true,
    effect: 'maxHealthBonus',
    amount: 6,
  },
  'ledger-conductivity': {
    id: 'ledger-conductivity',
    branch: 'lightning-ledger',
    maxRank: 3,
    requiresWeaponId: 'lightning-ledger',
    effect: 'ledgerConductivityTier',
    amount: 1,
  },
  'ledger-voltage': {
    id: 'ledger-voltage',
    branch: 'lightning-ledger',
    maxRank: 3,
    requiresWeaponId: 'lightning-ledger',
    effect: 'ledgerVoltageTier',
    amount: 1,
  },
  'ledger-reconciliation': {
    id: 'ledger-reconciliation',
    branch: 'lightning-ledger',
    maxRank: 3,
    requiresWeaponId: 'lightning-ledger',
    effect: 'ledgerReconciliationTier',
    amount: 1,
  },
  'proof-of-network': {
    id: 'proof-of-network',
    branch: 'lightning-ledger-capstone',
    maxRank: 1,
    requiresWeaponId: 'lightning-ledger',
    requiresRanks: { 'ledger-conductivity': 3, 'ledger-voltage': 3, 'ledger-reconciliation': 3 },
    effect: 'ledgerProofOfNetworkTier',
    amount: 1,
  },
  'burner-liquidity': {
    id: 'burner-liquidity', branch: 'bear-market-burner',
    maxRank: 3, requiresWeaponId: 'bear-market-burner', effect: 'burnerLiquidityTier', amount: 1,
  },
  'burner-volatility': {
    id: 'burner-volatility', branch: 'bear-market-burner',
    maxRank: 3, requiresWeaponId: 'bear-market-burner', effect: 'burnerVolatilityTier', amount: 1,
  },
  'burner-contagion': {
    id: 'burner-contagion', branch: 'bear-market-burner',
    maxRank: 3, requiresWeaponId: 'bear-market-burner', effect: 'burnerContagionTier', amount: 1,
  },
  'total-selloff': {
    id: 'total-selloff', branch: 'bear-market-burner-capstone',
    maxRank: 1, requiresWeaponId: 'bear-market-burner',
    requiresRanks: { 'burner-liquidity': 3, 'burner-volatility': 3, 'burner-contagion': 3 },
    effect: 'burnerTotalSelloffTier', amount: 1,
  },
  'standard-reach': {
    id: 'standard-reach', branch: 'forked-standard',
    maxRank: 3, requiresWeaponId: 'forked-standard', effect: 'standardReachTier', amount: 1,
  },
  'standard-force': {
    id: 'standard-force', branch: 'forked-standard',
    maxRank: 3, requiresWeaponId: 'forked-standard', effect: 'standardForceTier', amount: 1,
  },
  'standard-tempo': {
    id: 'standard-tempo', branch: 'forked-standard',
    maxRank: 3, requiresWeaponId: 'forked-standard', effect: 'standardTempoTier', amount: 1,
  },
  'canonical-fork': {
    id: 'canonical-fork', branch: 'forked-standard-capstone',
    maxRank: 1, requiresWeaponId: 'forked-standard',
    requiresRanks: { 'standard-reach': 3, 'standard-force': 3, 'standard-tempo': 3 },
    effect: 'standardCanonicalForkTier', amount: 1,
  },
  // Design package 8.2: the four dead gun trees as twelve rank-3 cards, in the
  // v7 upgrades catalogue order (rate of fire, damage, Magazine & Salvage per
  // gun). progressionByWeapon (weapon-system.mjs) turns their ranks into the
  // guns' branch tiers; none of them touches XP or score (contract 5.6).
  ...gunBranchCards('scatter-shotgun', ['scatter-pump', 'scatter-dump', 'scatter-shells']),
  ...gunBranchCards('auto-miner', ['miner-hashrate', 'miner-asic', 'miner-pool']),
  ...gunBranchCards('hash-rail', ['rail-blocktime', 'rail-proof', 'rail-mempool']),
  ...gunBranchCards('launcher-rig', ['launcher-airdrop', 'launcher-yield', 'launcher-bandolier']),
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
  standardReachTier: 0,
  standardForceTier: 0,
  standardTempoTier: 0,
  standardCanonicalForkTier: 0,
  gunBranchTier: 0,
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

// Design package 8.3: the level-up offer. Card 1 (slot 0) is a general draw;
// card 2 (slot 1) is "your gun": the first candidate gun with a card left,
// else a second general draw. Each card re-rolls once per offer, and a card
// shown in an offer never comes back in it. Every draw is the pure FNV
// hashChoice over the salt below, never the simulation RNG, so opening,
// re-rolling or picking can never move a drop or a spawn.
//
// HMH_CARD_TWO_INTERVAL is the agreed fallback switch: 2 draws card 2 from the
// focus gun on every second offer only (package 8.3, "the harness gate").
export const HMH_CARD_TWO_INTERVAL = 1;
const OFFER_SLOTS = 2;
const PISTOL_ID = 'coin-blaster';
// Card 2's gun order after the focus gun: the guns that own cards, in the
// run-summary weapon catalogue order, which is HMH_WEAPON_ORDER (weapon-system
// .mjs) without the Pistol; a test pins the two. Read from the catalogue so
// this module does not pull the weapon tables into its chunk.
export const CARD_TWO_GUN_ORDER = Object.freeze(HMH_RUN_SUMMARY_CATALOGS.weapons
  .filter((id) => Object.values(RUN_UPGRADE_CATALOG).some((upgrade) => upgrade.requiresWeaponId === id)));

function eligibleUpgrades(state, shown) {
  return Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => !shown.has(upgrade.id) && isUpgradeEligible(state, upgrade));
}

function pickUpgrade(state, key, slot, draw, pool) {
  let best = null;
  let bestOrder = 0;
  for (const upgrade of pool) {
    const order = hashChoice(state.seed, `offer:${key}:s${slot}:d${draw}:${upgrade.id}`);
    if (best === null || order < bestOrder || (order === bestOrder && upgrade.id < best.id)) {
      best = upgrade;
      bestOrder = order;
    }
  }
  return best?.id ?? null;
}

// One card for a slot. Card 2 walks its candidate guns in order (the same
// gun's other cards, then the next gun) before the general pool.
function drawSlot(state, key, slot, draw, shown, candidates) {
  const pool = eligibleUpgrades(state, shown);
  for (const weaponId of slot === 1 ? candidates : []) {
    const gunPool = pool.filter((upgrade) => upgrade.requiresWeaponId === weaponId);
    if (gunPool.length > 0) return { id: pickUpgrade(state, key, slot, draw, gunPool), weaponId };
  }
  return pool.length > 0 ? { id: pickUpgrade(state, key, slot, draw, pool), weaponId: null } : null;
}

// Card 2's candidates, captured when the offer opens: the focus gun, then the
// weapon order; owned non-Pistol guns with ammo (the runtime passes which) and
// a card left. Never the Pistol.
function cardTwoCandidates(state, armedWeaponIds) {
  if (state.offersOpened % state.cardTwoInterval !== 0) return [];
  const armed = armedWeaponIds === null ? state.ownedWeaponIds : new Set(armedWeaponIds);
  const candidates = [];
  for (const weaponId of [state.focusWeaponId, ...CARD_TWO_GUN_ORDER]) {
    if (!weaponId || weaponId === PISTOL_ID || candidates.includes(weaponId)) continue;
    if (state.ownedWeaponIds.has(weaponId) && armed.has(weaponId)) candidates.push(weaponId);
  }
  return candidates;
}

function drawOffer(state, armedWeaponIds) {
  const key = `level:${state.level}:${state.pendingLevels}:${state.selectionSequence}`;
  const candidates = cardTwoCandidates(state, armedWeaponIds);
  const shown = new Set();
  const slots = Array.from({ length: OFFER_SLOTS }, () => ({ id: null, draw: 0, rerolled: false, weaponId: null }));
  // Card 2 draws first so "your gun" holds whenever a candidate has a card.
  for (const slot of [1, 0]) {
    const card = drawSlot(state, key, slot, 0, shown, candidates);
    if (!card) continue;
    slots[slot] = { id: card.id, draw: 0, rerolled: false, weaponId: card.weaponId };
    shown.add(card.id);
  }
  return { kind: 'level', key, candidates, slots, shown: [...shown] };
}

function rerollState(state, offer, slot) {
  const card = offer.slots[slot];
  if (card.rerolled) return 'used';
  return drawSlot(state, offer.key, slot, card.draw + 1, new Set(offer.shown), offer.candidates) ? 'ready' : 'none';
}

function offerChoices(state, offer) {
  const choices = [];
  for (const [slot, card] of offer.slots.entries()) {
    if (card.id === null) continue;
    const upgrade = RUN_UPGRADE_CATALOG[card.id];
    const rank = state.ranks[card.id] ?? 0;
    choices.push(freezeDeep({
      ...upgrade, rank, nextRank: rank + 1, slot, weaponId: card.weaponId, rerollState: rerollState(state, offer, slot),
      // Card 2's gun chip numbers (the panel names the gun).
      mastery: card.weaponId ? runWeaponMastery(state.ranks, card.weaponId) : null,
    }));
  }
  return Object.freeze(choices);
}

// The choices of the open offer or, with none open, the offer the runtime
// would open with every owned gun armed (a pure preview; it opens nothing).
function resolveChoices(state) {
  if (state.offer) return offerChoices(state, state.offer);
  if (state.pendingLevels <= 0) return Object.freeze([]);
  return offerChoices(state, drawOffer(state, null));
}

export function createRunProgression({ seed = 0, ownedWeaponIds = ['coin-blaster'], cardTwoInterval = HMH_CARD_TWO_INTERVAL } = {}) {
  if (!Array.isArray(ownedWeaponIds) || ownedWeaponIds.length < 1 || ownedWeaponIds.length > 32) throw new TypeError('ownedWeaponIds must be a bounded non-empty array');
  if (!Number.isInteger(cardTwoInterval) || cardTwoInterval < 1 || cardTwoInterval > 2) throw new TypeError('cardTwoInterval must be 1 or 2');
  const normalizedWeaponIds = ownedWeaponIds.map((id) => {
    if (typeof id !== 'string' || !id || id.length > 64) throw new TypeError('owned weapon ID must be a bounded string');
    return id;
  });
  const zeros = () => Object.fromEntries(Object.keys(RUN_UPGRADE_CATALOG).map((id) => [id, 0]));
  return {
    seed: validSeed(seed),
    score: 0,
    silverCollected: 0,
    xp: 0,
    level: 1,
    pendingLevels: 0,
    selectionSequence: 0,
    ranks: zeros(),
    ownedWeaponIds: new Set(normalizedWeaponIds),
    recordedEnemyIds: new Set(),
    lastEvent: null,
    // Package 8.3 offer state and the v7 run-summary counters.
    cardTwoInterval,
    focusWeaponId: null,
    offer: null,
    offersOpened: 0,
    rerolls: 0,
    offered: zeros(),
    selected: zeros(),
  };
}

// The focus gun: the last non-Pistol gun the player selected by hand or newly
// picked up. The automatic fallback to the Pistol never changes it.
export function setRunUpgradeFocus(state, weaponId) {
  if (!state || !(state.ownedWeaponIds instanceof Set)) throw new TypeError('run progression state is required');
  if (typeof weaponId === 'string' && weaponId !== PISTOL_ID && state.ownedWeaponIds.has(weaponId)) state.focusWeaponId = weaponId;
  return state.focusWeaponId;
}

export function unlockRunProgressionWeapon(state, weaponId) {
  if (!state || !(state.ownedWeaponIds instanceof Set)) throw new TypeError('run progression state is required');
  if (typeof weaponId !== 'string' || !weaponId || weaponId.length > 64) throw new TypeError('weaponId must be a bounded string');
  const alreadyOwned = state.ownedWeaponIds.has(weaponId);
  state.ownedWeaponIds.add(weaponId);
  if (!alreadyOwned) setRunUpgradeFocus(state, weaponId);
  return freezeDeep({ weaponId, alreadyOwned, eligibleUpgradeIds: getEligibleRunUpgradeIds(state) });
}

// Opens the offer for the next pending level (once: an open offer is never
// re-opened, so the counters count one offer per pending level that shows
// cards). armedWeaponIds are the guns that have ammo on the offer's tick;
// null arms every owned gun. Returns the choices, or null when nothing opened.
export function openRunUpgradeOffer(state, { armedWeaponIds = null } = {}) {
  if (!state || !(state.ownedWeaponIds instanceof Set)) throw new TypeError('run progression state is required');
  if (armedWeaponIds !== null && (!Array.isArray(armedWeaponIds) || armedWeaponIds.length > 32)) throw new TypeError('armedWeaponIds must be a bounded array');
  if (state.offer || state.pendingLevels <= 0) return null;
  const offer = drawOffer(state, armedWeaponIds);
  if (offer.slots.every((card) => card.id === null)) return null;
  state.offer = offer;
  state.offersOpened += 1;
  for (const id of offer.shown) state.offered[id] += 1;
  return offerChoices(state, offer);
}

// One re-roll for a card of the open offer. It never selects, closes the
// offer or advances a tick. Returns the new card, or null when the card was
// already re-rolled or nothing is left to show ("No other upgrades").
export function rerollRunUpgradeSlot(state, slot) {
  const offer = state?.offer;
  if (!offer) throw new Error('no upgrade offer is open');
  if (!Number.isInteger(slot) || slot < 0 || slot >= OFFER_SLOTS) throw new TypeError('slot must be 0 or 1');
  const current = offer.slots[slot];
  if (current.id === null || current.rerolled) return null;
  const card = drawSlot(state, offer.key, slot, current.draw + 1, new Set(offer.shown), offer.candidates);
  if (!card) return null;
  offer.slots[slot] = { id: card.id, draw: current.draw + 1, rerolled: true, weaponId: card.weaponId };
  offer.shown.push(card.id);
  state.rerolls += 1;
  state.offered[card.id] += 1;
  return offerChoices(state, offer).find((choice) => choice.slot === slot);
}

// A gun's branch chip ("SHOTGUN 4/9"; a gun with a capstone counts 10).
export function runWeaponMastery(ranks, weaponId) {
  let invested = 0;
  let total = 0;
  for (const upgrade of Object.values(RUN_UPGRADE_CATALOG)) {
    if (upgrade.requiresWeaponId !== weaponId) continue;
    invested += Math.min(upgrade.maxRank, ranks?.[upgrade.id] ?? 0);
    total += upgrade.maxRank;
  }
  return freezeDeep({ ranks: invested, total });
}

// The dense v7 upgrades rows (contract 4): times each card was shown,
// re-rolls included, and times it was picked, in catalogue order.
export function runUpgradeRows(state, upgradeIds = Object.keys(RUN_UPGRADE_CATALOG)) {
  return Object.freeze(upgradeIds.map((upgradeId) => Object.freeze({
    upgradeId,
    offered: state.offered[upgradeId] ?? 0,
    selected: state.selected[upgradeId] ?? 0,
  })));
}

// The v7 progression row. Evolutions and Genesis Seals arrive with S1.7; the
// Golden Parachute count comes from the boss slots.
export function runProgressionRow(state, { revivesUsed = 0 } = {}) {
  if (!Number.isInteger(revivesUsed) || revivesUsed < 0 || revivesUsed > 1) throw new TypeError('revivesUsed must be 0 or 1');
  return Object.freeze({
    offersOpened: state.offersOpened,
    evolutionOffersOpened: 0,
    rerolls: state.rerolls,
    sealsFound: 0,
    sealsBanked: 0,
    evolutionsApplied: 0,
    revivesUsed,
  });
}

export function getRunProgressionSnapshot(state) {
  if (!state || !(state.recordedEnemyIds instanceof Set) || !(state.ownedWeaponIds instanceof Set)) throw new TypeError('run progression state is required');
  const currentFloor = state.level === 1 ? 0 : nextLevelThreshold(state.level - 1);
  const nextThreshold = nextLevelThreshold(state.level);
  return freezeDeep({
    score: state.score,
    silverCollected: state.silverCollected ?? 0,
    xp: state.xp,
    level: state.level,
    xpCurrentLevel: state.xp - currentFloor,
    xpForNextLevel: nextThreshold - currentFloor,
    xpProgress: Math.max(0, Math.min(1, (state.xp - currentFloor) / (nextThreshold - currentFloor))),
    pendingLevels: state.pendingLevels,
    pendingChoices: resolveChoices(state),
    offersOpened: state.offersOpened,
    rerolls: state.rerolls,
    focusWeaponId: state.focusWeaponId,
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

// Owner decision 2026-09-16: silver Litecoin coins count toward the run
// score. Each coin is worth a flat SILVER_SCORE_PER_COIN before the run's
// score multiplier; coins never grant XP or levels.
export const SILVER_SCORE_PER_COIN = 10;

export function grantRunSilver(state, coins, tick) {
  if (!state || !(state.recordedEnemyIds instanceof Set)) throw new TypeError('run progression state is required');
  if (!Number.isInteger(coins) || coins <= 0 || coins > 100_000) throw new TypeError('coins must be a positive bounded integer');
  if (!Number.isInteger(tick) || tick < 0 || tick > 1_000_000_000) throw new TypeError('tick must be a non-negative bounded integer');
  const scoreGain = Math.round(coins * SILVER_SCORE_PER_COIN * resolveEffects(state).scoreMultiplier);
  state.silverCollected = (state.silverCollected ?? 0) + coins;
  state.score += scoreGain;
  state.lastEvent = { sourceId: 'silver', coins, tick, scoreGain, xpGain: 0, levelsGained: 0 };
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
  // A caller that never opened the offer (tests, benchmarks) opens it here,
  // with every owned gun armed, exactly as the preview showed it.
  if (!state.offer) openRunUpgradeOffer(state);
  const selected = state.offer ? offerChoices(state, state.offer).find((choice) => choice.id === upgradeId) : null;
  if (!selected) throw new Error(`upgrade ${String(upgradeId)} is not currently offered`);
  state.ranks[upgradeId] += 1;
  state.selected[upgradeId] += 1;
  state.pendingLevels -= 1;
  state.selectionSequence += 1;
  state.offer = null;
  const snapshot = getRunProgressionSnapshot(state);
  return freezeDeep({
    selected: { ...selected, rank: state.ranks[upgradeId] },
    effects: snapshot.effects,
    snapshot,
  });
}
