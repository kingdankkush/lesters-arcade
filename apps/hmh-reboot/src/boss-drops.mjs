// Boss drops: the Genesis Seal (design package 8.4, S1.7; build ledger slice 7).
//
// A Seal is a runtime boss drop, never an objective-reward placement: one per
// boss id per run, on the boss's first defeat, at its arena's reward pedestal.
// It never expires and is collected by contact within 80, with no button. On
// pickup (inside the tick) it resolves against the evolution candidates C
// (owned, mastered, not yet evolved; wave-1 guns only, non-Pistol guns first):
//   C empty                        -> banked
//   exactly one non-Pistol gun     -> that gun evolves at once, no panel
//   anything else                  -> the evolution panel (main.mjs opens it at
//                                     the end of the tick, before any level
//                                     offer of the same tick)
// A banked Seal evolves a non-Pistol gun the moment a level-up pick completes
// its mastery; the Pistol evolves only from a panel. Evolving never costs a
// pick. The run progression state carries the counters (run-progression.mjs);
// this module is lazy, loaded with the boss modules before a session starts.
import { freezeDeep } from './value-guards.mjs';
import { CARD_TWO_GUN_ORDER, RUN_UPGRADE_CATALOG, runSealsBanked } from './run-progression.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../../../sdk/hmh-run-summary-schema-v7.mjs';

export const GENESIS_SEAL_RULES = freezeDeep({
  pickupRadius: 80,
  // At most 4 banked: one Seal per boss id, and the v7 roster has 4 bosses.
  bankCap: 4,
});

// The arena reward pedestals: inside each floor, on dry walkable ground clear
// of every collider, and at least 120 from every objective reward
// (tests/hmh-genesis-seal.test.mjs measures all three on the shipped map).
export const BOSS_REWARD_PEDESTALS = freezeDeep({
  'margin-floor': { x: 11_000, y: 2_400 },
  'dark-pool': { x: 11_784, y: 2_300 },
});

// The wave-1 evolutions by weapon (contract 3.5 rows 0-4). Wave 2 is not
// built: its policy resolvers still refuse evolutions.
export const HMH_WAVE_ONE_EVOLUTIONS = freezeDeep({
  'coin-blaster': 'settler-rail',
  'scatter-shotgun': 'double-spend',
  'auto-miner': 'hashstorm-overdrive',
  'launcher-rig': 'crypto-bomb-orbit',
  'hash-rail': 'crit-candle',
});
const PISTOL_ID = 'coin-blaster';
const BANK_CARD = 'bank-seal';
const PISTOL_MASTERY = Object.freeze(['proof-of-work', 'hot-wallet', 'block-reward']);
const BOSS_IDS = new Set(HMH_RUN_SUMMARY_CATALOGS_V7.bosses);

export function createBossDrops() {
  return { seals: [], droppedBossIds: [], drops: 0 };
}

// The Seal for a boss's first defeat, at its arena's pedestal; null for a
// boss that already dropped one, and null (no drop, nothing spent) for an
// arena with no pedestal: the ?boss=1 debug fight runs on the open floor
// (liquidator-boss.mjs liquidatorOpenArena, id 'open-floor'), and this runs
// inside the fixed step, where a throw would halt the run.
export function dropGenesisSeal(drops, { bossId, tick, arenaId }) {
  if (!BOSS_IDS.has(bossId)) throw new TypeError(`unknown boss ${String(bossId)}`);
  const pedestal = Object.hasOwn(BOSS_REWARD_PEDESTALS, arenaId) ? BOSS_REWARD_PEDESTALS[arenaId] : null;
  if (!pedestal) return null;
  if (drops.droppedBossIds.includes(bossId) || drops.drops >= GENESIS_SEAL_RULES.bankCap) return null;
  drops.droppedBossIds.push(bossId);
  const seal = { id: `genesis-seal:${bossId}`, bossId, tick, x: pedestal.x, y: pedestal.y, arenaId, first: drops.drops === 0, collectedTick: -1 };
  drops.drops += 1;
  drops.seals.push(seal);
  return freezeDeep({ ...seal });
}

// Contact pickup: every uncollected Seal within 80 of the hero, by id.
export function collectGenesisSeals(drops, { tick, hero }) {
  const collected = [];
  for (const seal of drops.seals) {
    if (seal.collectedTick >= 0 || Math.hypot(seal.x - hero.x, seal.y - hero.y) > GENESIS_SEAL_RULES.pickupRadius) continue;
    seal.collectedTick = tick;
    collected.push(freezeDeep({ ...seal }));
  }
  return collected.sort((left, right) => (left.id < right.id ? -1 : 1));
}

// Mastery (package 8.4): a finite or special gun has every one of its cards at
// maximum rank (capstone included); the Pistol has Damage, Movement Speed and
// Score & Magazine at rank 3.
export function runWeaponMastered(ranks, weaponId) {
  const cards = weaponId === PISTOL_ID
    ? PISTOL_MASTERY.map((id) => RUN_UPGRADE_CATALOG[id])
    : Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => upgrade.requiresWeaponId === weaponId);
  return cards.length > 0 && cards.every((upgrade) => (ranks?.[upgrade.id] ?? 0) >= upgrade.maxRank);
}

// C: owned, mastered, not evolved; the focus gun, then the weapon order, and
// the Pistol last.
export function evolutionCandidates(progression) {
  const order = [progression.focusWeaponId, ...CARD_TWO_GUN_ORDER, PISTOL_ID];
  const candidates = [];
  for (const weaponId of order) {
    if (!weaponId || candidates.includes(weaponId) || !Object.hasOwn(HMH_WAVE_ONE_EVOLUTIONS, weaponId)) continue;
    if (!progression.ownedWeaponIds.has(weaponId) || Object.hasOwn(progression.evolutions, weaponId)) continue;
    if (runWeaponMastered(progression.ranks, weaponId)) candidates.push(weaponId);
  }
  return candidates;
}

function evolve(progression, weaponId) {
  const evolutionId = HMH_WAVE_ONE_EVOLUTIONS[weaponId];
  progression.evolutions[weaponId] = evolutionId;
  return { outcome: 'evolved', weaponId, evolutionId };
}

// A Seal picked up this tick.
export function resolveGenesisSeal(progression, { tick }) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('seal tick must be a non-negative integer');
  progression.sealsFound += 1;
  const candidates = evolutionCandidates(progression);
  if (candidates.length === 0) return { outcome: 'banked', weaponId: null, evolutionId: null };
  if (candidates.length === 1 && candidates[0] !== PISTOL_ID) return evolve(progression, candidates[0]);
  return { outcome: 'panel', weaponId: null, evolutionId: null };
}

function cardChoice(progression, offer, slot) {
  const card = offer.slots[slot];
  const bank = card.id === BANK_CARD;
  return freezeDeep({
    id: card.id,
    kind: 'evolution',
    slot,
    weaponId: bank ? null : card.weaponId,
    branch: bank ? 'genesis-seal' : 'evolution',
    rank: 0,
    nextRank: 1,
    maxRank: 1,
    // The card presentation reads these: a weapon's icon, the capstone tier.
    requiresWeaponId: bank ? undefined : card.weaponId,
    requiresRanks: bank ? undefined : {},
    rerollState: card.rerolled ? 'used' : nextCard(offer) ? 'ready' : 'none',
  });
}

// Re-rolls cycle the candidates not yet shown, then "Bank the Seal".
function nextCard(offer) {
  const weaponId = offer.candidates.find((candidate) => !offer.shown.includes(HMH_WAVE_ONE_EVOLUTIONS[candidate]));
  if (weaponId) return { id: HMH_WAVE_ONE_EVOLUTIONS[weaponId], weaponId };
  return offer.shown.includes(BANK_CARD) ? null : { id: BANK_CARD, weaponId: null };
}

function refreshChoices(progression, offer) {
  offer.choices = Object.freeze(offer.slots.map((_, slot) => cardChoice(progression, offer, slot)));
  return offer.choices;
}

function countShown(progression, id) {
  if (id !== BANK_CARD) progression.evolutionOffered[id] = (progression.evolutionOffered[id] ?? 0) + 1;
}

// Opens the evolution panel for a Seal that resolved to 'panel': the first two
// candidates, or "Bank the Seal" second. Returns the choices, or null when a
// panel is already open or nothing is left to evolve.
export function openRunEvolutionOffer(progression) {
  if (progression.offer) return null;
  const candidates = evolutionCandidates(progression);
  if (candidates.length === 0 || runSealsBanked(progression) <= 0) return null;
  const offer = { kind: 'evolution', key: `evolution:${progression.sealsFound}`, candidates, slots: [], shown: [], choices: [] };
  for (let slot = 0; slot < 2; slot += 1) {
    const card = nextCard(offer);
    offer.slots.push({ id: card.id, weaponId: card.weaponId, rerolled: false });
    offer.shown.push(card.id);
    countShown(progression, card.id);
  }
  progression.offer = offer;
  progression.evolutionOffersOpened += 1;
  return refreshChoices(progression, offer);
}

// One re-roll per card, silent, never selecting or closing the panel.
export function rerollRunEvolutionSlot(progression, slot) {
  const offer = progression?.offer;
  if (offer?.kind !== 'evolution') throw new Error('no evolution panel is open');
  if (!Number.isInteger(slot) || slot < 0 || slot >= offer.slots.length) throw new TypeError('slot must be 0 or 1');
  if (offer.slots[slot].rerolled) return null;
  const card = nextCard(offer);
  if (!card) return null;
  offer.slots[slot] = { id: card.id, weaponId: card.weaponId, rerolled: true };
  offer.shown.push(card.id);
  countShown(progression, card.id);
  progression.rerolls += 1;
  return refreshChoices(progression, offer)[slot];
}

// The player's pick in the panel: an evolution, or "Bank the Seal".
export function selectRunEvolution(progression, cardId) {
  const offer = progression?.offer;
  if (offer?.kind !== 'evolution') throw new Error('no evolution panel is open');
  const card = offer.slots.find((slot) => slot.id === cardId);
  if (!card) throw new Error(`evolution card ${String(cardId)} is not currently offered`);
  progression.offer = null;
  if (card.id === BANK_CARD) return { outcome: 'banked', weaponId: null, evolutionId: null };
  return evolve(progression, card.weaponId);
}

// After a level-up pick: a banked Seal evolves the non-Pistol gun that pick
// just mastered. The Pistol never evolves here.
export function evolveBankedSealOnMastery(progression, upgradeId) {
  const weaponId = RUN_UPGRADE_CATALOG[upgradeId]?.requiresWeaponId ?? null;
  if (!weaponId || weaponId === PISTOL_ID || !Object.hasOwn(HMH_WAVE_ONE_EVOLUTIONS, weaponId)) return null;
  if (runSealsBanked(progression) <= 0 || Object.hasOwn(progression.evolutions, weaponId)) return null;
  if (!runWeaponMastered(progression.ranks, weaponId)) return null;
  const { evolutionId } = evolve(progression, weaponId);
  return { weaponId, evolutionId };
}

// The dense v7 evolutions rows (contract 4): cards shown in evolution panels
// (re-rolls included, "Bank the Seal" never) and whether the gun evolved.
export function runEvolutionRows(progression) {
  const applied = new Set(Object.values(progression.evolutions));
  return Object.freeze(HMH_RUN_SUMMARY_CATALOGS_V7.evolutions.map((evolutionId) => Object.freeze({
    evolutionId,
    offered: progression.evolutionOffered[evolutionId] ?? 0,
    applied: applied.has(evolutionId) ? 1 : 0,
  })));
}
