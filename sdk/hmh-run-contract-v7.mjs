// Hard Money Heroes run summary v7: the shared gameplay contract
// (docs/hmh-reboot/design/HMH-RUN-SUMMARY-V7-CONTRACT.md §5).
//
// The server verifier's v7 path reads only this module and
// sdk/hmh-run-summary-schema-v7.mjs, and the child imports the same values, so a
// bound and the behaviour it bounds cannot drift apart. The module is pure: no
// DOM, no clock and no import from apps/**. Values that exist in 1.8.1 equal the
// child's (parity tests in tests/server-verify-hmh-plausibility.test.mjs pin
// them); the others are new in v7.
//
// Every value here is part of the Ranked verifier contract. Changing one
// changes what a v7 summary may claim, so it changes only together with
// server/verify/hmh-plausibility.mjs and its tests.
import {
  HMH_RUN_SUMMARY_CATALOGS_V7 as C7,
  HMH_V7_HELD_PRISONER_BOSSES,
  HMH_V7_PANEL_ONLY_EVOLUTIONS,
  HMH_V7_RESERVED_EVOLUTIONS,
  HMH_V7_START_WEAPON,
  HMH_V7_UPGRADE_WEAPON_GATES,
} from './hmh-run-summary-schema-v7.mjs';

const freezeDeep = (value) => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
  return Object.freeze(value);
};
// A table keyed by a catalogue must cover it exactly, or the module refuses to
// load (the verifier then fails closed instead of reading an undefined row).
const covering = (table, ids, label) => {
  const tableIds = Object.keys(table);
  if (tableIds.length !== ids.length || ids.some((id) => !Object.hasOwn(table, id))) throw new Error(`${label} must cover its catalogue exactly`);
  return freezeDeep(table);
};

export const HMH_RUN_SUMMARY_V7_SCHEMA_VERSION = 7;

// ---------------------------------------------------------------------------
// §2.1 The build that may carry schema 7. The v7 child ships at this game
// version or later, and a 1.8.x child never emits schema 7, so a schema-7
// summary whose identity.buildHash names an older game (or no game version at
// all) cannot come from a v7 child. The build hash is the session's
// (site-X.Y.Z:game-X.Y.Z, bound to the seed ticket), so this reads no clock.
// The converse is not a rule: a portal at this version can host a 1.8.x child
// cached by the service worker, which still emits schema 6 (owner override 2).
export const HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION = '1.9.0';
const GAME_VERSION_IN_BUILD = /(?:^|:)game-(\d{1,9})\.(\d{1,9})\.(\d{1,9})(?=$|:)/;

// → [major, minor, patch], or null when the build hash names no game version.
export function hmhGameVersionOfBuild(buildHash) {
  const match = typeof buildHash === 'string' ? GAME_VERSION_IN_BUILD.exec(buildHash) : null;
  return match ? Object.freeze(match.slice(1, 4).map(Number)) : null;
}

// True when the build hash names a game version at or after the first v7 child.
export function isHmhV7Build(buildHash) {
  const version = hmhGameVersionOfBuild(buildHash);
  if (!version) return false;
  const minimum = HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) if (version[index] !== minimum[index]) return version[index] > minimum[index];
  return true;
}

// ---------------------------------------------------------------------------
// §5.1 Run rules.
export const HMH_V7_RUN_RULES = freezeDeep({
  FIXED_STEP_MS: 1000 / 60,
  MAX_LEVEL: 1000,
  // The only XP and score multipliers: validator-training and block-reward,
  // +0.25 per rank, 3 ranks each. The 12 v7 upgrades and evolution
  // scoreMultiplier grant neither.
  MULTIPLIER_PER_RANK: 0.25,
  MULTIPLIER_MAX_RANK: 3,
  XP_MULTIPLIER_MAX: 1.75,
  SCORE_MULTIPLIER_MAX: 1.75,
  COMBO_MILESTONE_XP: { 5: 120, 10: 240, 20: 480, 30: 900 },
  // Weapon caches that grant XP (collectible effect id → base XP).
  CACHE_XP: { 'hash-rail-core': 160, 'lightning-ledger-cache': 220, 'bear-market-burner-cache': 260, 'forked-standard-cache': 240 },
  SILVER_SCORE_PER_COIN: 10,
  // An ordinary kill drops at most one coin (the HODL Revenant drops none).
  SILVER_PER_ENEMY_KILL_MAX: 1,
  // A found secret grants exactly 20 coins through grantRunSilver.
  SILVER_PER_SECRET: 20,
  OPENING_ENEMIES: 2,
  // Director insertion schedule (ids, ticks and intervals unchanged from 1.8.1).
  ENCOUNTER_BAND_SCHEDULE: [
    { id: 'opening', minTick: 0, maxTick: 3_599, spawnIntervalTicks: 150 },
    { id: 'build', minTick: 3_600, maxTick: 17_999, spawnIntervalTicks: 90 },
    { id: 'pressure', minTick: 18_000, maxTick: 35_999, spawnIntervalTicks: 60 },
    { id: 'elite', minTick: 36_000, maxTick: 71_999, spawnIntervalTicks: 45 },
    { id: 'boss', minTick: 72_000, maxTick: 75_599, spawnIntervalTicks: 60 },
    { id: 'endurance', minTick: 75_600, maxTick: Infinity, spawnIntervalTicks: 30 },
  ],
  // Objective XP: baseXp = OBJECTIVE_XP_PER_LEVEL[class] x level before the
  // node's own grant, through grantRunXp (so multiplied like kill XP). These
  // are k x 300 for k = 0.06 / 0.10 / 0.04 / 0.20. Objectives grant no score.
  OBJECTIVE_XP_PER_LEVEL: { switch: 18, gate: 30, item: 12, secret: 60 },
  // An OG Miner rescue grants exactly 300 x level XP, never multiplied.
  OG_MINER_XP_PER_LEVEL: 300,
});

// §5.1 Collectible pickups (every collectibles row but genesis-seal, whose
// pickups are the Seals of S11 and S12). Pickups come only from authored
// placements: at most 13 world placements (10 authored and 3 scheduled rare)
// and 8 objective-reward placements, and a placement that re-arms does so no
// sooner than 7,200 ticks after its pickup (the 1.8.1 createCollectibleState
// limits; parity test). Prisoner, strongbox, secret and haven grants are not
// pickups (§11).
export const HMH_V7_COLLECTIBLE_RULES = freezeDeep({
  MAX_PLACEMENTS: 13 + 8,
  MIN_REARM_TICKS: 7_200,
});

// At most this many collectible pickups (genesis-seal excluded) by `runTicks`.
export function hmhV7CollectibleCapacity(runTicks) {
  const rules = HMH_V7_COLLECTIBLE_RULES;
  return rules.MAX_PLACEMENTS * (1 + Math.floor(runTicks / rules.MIN_REARM_TICKS));
}

// XP that completes level L; levels run to MAX_LEVEL.
export function hmhV7LevelThreshold(level) {
  return 150 * level * (level + 1);
}

export function hmhV7LevelForXp(xp) {
  let level = 1;
  while (level < HMH_V7_RUN_RULES.MAX_LEVEL && xp >= hmhV7LevelThreshold(level)) level += 1;
  return level;
}

// Kill rewards before multipliers (recordRunDefeat).
export const hmhV7KillXp = (threat) => 80 + 20 * threat;
export const hmhV7KillScore = (threat) => 100 + 25 * threat;

// ---------------------------------------------------------------------------
// §5.2 Threat per summary enemy role (every V7 enemyRoles id).
export const HMH_V7_ROLE_THREAT = covering({
  'bagholder-rusher': 2,
  forkrunner: 3,
  'liquidator-agent': 4,
  'whale-enforcer': 6,
  'gas-bomber': 5,
  'validator-cultist': 5,
  liquidator: 48,
  'rug-puller': 4,
  'pump-and-dump-bloater': 4,
  tollkeeper: 6,
  'hodl-revenant': 5,
  'money-printer': 6,
  'oracle-marksman': 5,
  'rug-pull-baron': 24,
  lockkeeper: 32,
  'fifty-one-percent-foreman': 40,
}, C7.enemyRoles, 'HMH_V7_ROLE_THREAT');

// ---------------------------------------------------------------------------
// §5.3 The shared boss kit, and the obligations it puts on the child. The
// verifier's boss bounds are sound only while the child honours all of them:
//   - Intro: a boss started with an intro (every start but the Dark Pool) takes
//     no damage of any kind (burn, DoT, hazards and the nuke included) at any
//     tick t with t - initiationTick < BOSS_INTRO_MIN_TICKS.
//   - Phases: every v7 boss has exactly BOSS_PHASE_THRESHOLDS HP thresholds.
//     Crossing one at tick t clamps the overshoot to the threshold, and the
//     boss takes no damage at ticks t+1 ... t+BOSS_PHASE_HALT_TICKS.
//   - Retreat: the retreat ring appears only after BOSS_RETREAT_RING_TICKS
//     engaged ticks, its channel takes at least BOSS_RETREAT_CHANNEL_TICKS, and
//     the boss is ready again only BOSS_READY_AGAIN_TICKS after the retreat
//     completes.
//   - Capacity bank: every insertion except the opening enemies, a boss body
//     and the first BOSS_ADDS_FIRST adds a boss slot inserts in the whole run
//     is made only while the number of such insertions so far is below
//     directorSpawnCapacity(tick) over ENCOUNTER_BAND_SCHEDULE. The director's
//     scheduled insertions, scripted bodies (guard crews, secret ambushes,
//     dormant Revenants, champion-arena waves, paired spawns) and every further
//     boss add draw from it; what the bank cannot cover waits or shrinks.
//     While a boss is live the director is suppressed (package 4.1), so a
//     fight refills the bank by at least one slot per 90 ticks (every band
//     from 3,600 on). A retreat never refills a slot's first adds.
//   - A slot inserts no add in the first BOSS_ADD_DELAY_TICKS of an engagement.
//   - At most one boss slot is live at a time: no trigger starts a boss while
//     another is live.
//   - One Genesis Seal per boss id per run, dropped only by a real defeat
//     (never by a champion arena), and the boss's silver burst replaces the
//     1.8.1 boss drop of 10 coins.
export const HMH_V7_BOSS_RULES = (() => {
  const intro = 120;
  const halt = 90;
  const thresholds = 2;
  const ring = 600;
  const channel = 120;
  const readyAgain = 1_800;
  return freezeDeep({
    BOSS_INTRO_MIN_TICKS: intro,
    BOSS_PHASE_HALT_TICKS: halt,
    BOSS_PHASE_THRESHOLDS: thresholds,
    // Intro plus one halt per threshold. An honest defeat is at least
    // intro + 1 + thresholds x (halt + 1) = 302 ticks after the initiation.
    BOSS_MIN_FIGHT_TICKS: intro + thresholds * halt,
    // A start without an intro (the Dark Pool): the halts alone. An honest
    // defeat is at least thresholds x (halt + 1) = 182 ticks after it.
    BOSS_MIN_FIGHT_TICKS_WITHOUT_INTRO: thresholds * halt,
    BOSS_RETREAT_RING_TICKS: ring,
    BOSS_RETREAT_CHANNEL_TICKS: channel,
    BOSS_READY_AGAIN_TICKS: readyAgain,
    // Consecutive initiations of one boss are at least this far apart.
    BOSS_REINITIATION_MIN_TICKS: ring + channel + readyAgain,
    // Adds beyond the capacity bank, once per slot per run.
    BOSS_ADDS_FIRST: 4,
    // No add in the first halt-length of an engagement: the intro bosses are
    // passive for 120 ticks, and the Liquidator's first adds come in phase 2.
    BOSS_ADD_DELAY_TICKS: halt,
    MAX_ACTIVE_BOSSES: 1,
    SEALS_PER_BOSS: 1,
  });
})();

// The four bosses, west to east (V7 bosses catalogue order). Kill XP and score
// come from the threat (hmhV7KillXp / hmhV7KillScore: 560 / 720 / 880 / 1,040
// XP and 700 / 900 / 1,100 / 1,300 score before multipliers). HP thresholds
// are fractions of maximum HP; targetSeconds feeds hmhV7BossHp. minFightTicks
// is the shortest defeat after the last initiation: the Liquidator's allows the
// Dark Pool start, which has no intro (package 4.3).
export const HMH_V7_BOSSES = covering({
  'rug-pull-baron': { district: 'rugpull-ravine', readyTick: 7_200, threat: 24, silverBurst: 15, phaseThresholds: [0.6, 0.25], targetSeconds: 90, minFightTicks: HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS },
  lockkeeper: { district: 'liquidity-crossing', readyTick: 18_000, threat: 32, silverBurst: 20, phaseThresholds: [0.65, 0.3], targetSeconds: 105, minFightTicks: HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS },
  'fifty-one-percent-foreman': { district: 'mining-camp', readyTick: 27_000, threat: 40, silverBurst: 20, phaseThresholds: [0.65, 0.3], targetSeconds: 120, minFightTicks: HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS },
  // One row for both triggers (Closing Bell, with an intro, and the Dark Pool, without).
  liquidator: { district: 'liquidation-yard', readyTick: 36_000, threat: 48, silverBurst: 25, phaseThresholds: [0.66, 0.33], targetSeconds: 150, minFightTicks: HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS_WITHOUT_INTRO },
}, C7.bosses, 'HMH_V7_BOSSES');

// A boss may be initiated at `tick` only once it is ready.
export function isHmhV7BossReady(bossId, tick) {
  const boss = HMH_V7_BOSSES[bossId];
  if (!boss) throw new TypeError(`unknown boss ${String(bossId)}`);
  return Number.isInteger(tick) && tick >= boss.readyTick;
}

// Boss HP, frozen at the trigger: round(targetSeconds x referenceDps(level at
// trigger)). referenceDps is the child's calibrated reference damage per
// second (package 4.1 placeholder min(47, 8 + 2.6 x (L - 1)), recalibrated by
// the S0.3 harness). The verifier never reads HP: the minimum fight comes from
// the kit's structure (intro and phase halts), not from HP over a DPS ceiling.
export function hmhV7BossHp(bossId, referenceDps) {
  const boss = HMH_V7_BOSSES[bossId];
  if (!boss) throw new TypeError(`unknown boss ${String(bossId)}`);
  if (!Number.isFinite(referenceDps) || referenceDps <= 0) throw new TypeError('referenceDps must be a positive finite number');
  return Math.round(boss.targetSeconds * referenceDps);
}

// ---------------------------------------------------------------------------
// §3.2 Objectives: class (fixes the XP constant), district (flag only) and the
// objective that must complete first (flag only; the child wires each gate to
// it or amends this table before it ships).
export const HMH_V7_OBJECTIVES = covering({
  'crossing-behind-the-falls': { class: 'secret', district: 'liquidity-crossing', requires: null },
  'crossing-mill-storeroom': { class: 'gate', district: 'liquidity-crossing', requires: null },
  'crossing-pump': { class: 'switch', district: 'liquidity-crossing', requires: null },
  'farmstead-hidden-supplies': { class: 'secret', district: 'frontier-relay', requires: null },
  'hashwood-beacon': { class: 'switch', district: 'hashwood', requires: 'hashwood-lamp-oil' },
  'hashwood-hollow-grove': { class: 'secret', district: 'hashwood', requires: null },
  'hashwood-lamp-oil': { class: 'item', district: 'hashwood', requires: null },
  'hashwood-log-chute': { class: 'gate', district: 'hashwood', requires: 'hashwood-log-pile' },
  'hashwood-log-pile': { class: 'switch', district: 'hashwood', requires: null },
  'hashwood-lookout': { class: 'switch', district: 'hashwood', requires: null },
  // Re-arming machine: it completes once, on its first use.
  'hashwood-shrine': { class: 'switch', district: 'hashwood', requires: null },
  'mining-collapsed-adit': { class: 'secret', district: 'mining-camp', requires: null },
  'mining-valve': { class: 'switch', district: 'mining-camp', requires: null },
  'ravine-rope-bridge': { class: 'gate', district: 'rugpull-ravine', requires: 'ravine-winch' },
  'ravine-surveyor-cache': { class: 'secret', district: 'rugpull-ravine', requires: null },
  'ravine-winch': { class: 'switch', district: 'rugpull-ravine', requires: 'ravine-winch-handle' },
  'ravine-winch-handle': { class: 'item', district: 'rugpull-ravine', requires: null },
  'relay-barn-doors': { class: 'gate', district: 'frontier-relay', requires: null },
  'relay-power': { class: 'switch', district: 'frontier-relay', requires: null },
  'relay-uplink': { class: 'switch', district: 'frontier-relay', requires: null },
  // The Dark Pool: entering it can also initiate the Liquidator.
  'warehouse-logbook': { class: 'secret', district: 'liquidation-yard', requires: null },
  'yard-bascule-lever': { class: 'switch', district: 'liquidation-yard', requires: null },
  'yard-port-bascule': { class: 'gate', district: 'liquidation-yard', requires: 'yard-bascule-lever' },
  'yard-warehouse': { class: 'switch', district: 'liquidation-yard', requires: null },
  'yard-warehouse-gate': { class: 'gate', district: 'liquidation-yard', requires: 'yard-warehouse' },
}, C7.objectives, 'HMH_V7_OBJECTIVES');

// ---------------------------------------------------------------------------
// §3.4 Prisoner slots. h1 and h2 are held by a boss (schema rule S9).
export const HMH_V7_PRISONER_SLOTS = covering({
  'h1-baron-diggings': { district: 'rugpull-ravine', heldBy: HMH_V7_HELD_PRISONER_BOSSES['h1-baron-diggings'] },
  'h2-foreman-hoist-vault': { district: 'mining-camp', heldBy: HMH_V7_HELD_PRISONER_BOSSES['h2-foreman-hoist-vault'] },
  'p1-relay-barn-yard': { district: 'frontier-relay', heldBy: null },
  'p2-ravine-surveyor-camp': { district: 'rugpull-ravine', heldBy: null },
  'p3-crossing-boathouse': { district: 'liquidity-crossing', heldBy: null },
  'p4-hashwood-logging-camp': { district: 'hashwood', heldBy: null },
  'p5-mining-bench': { district: 'mining-camp', heldBy: null },
  'p6-yard-warehouse-compound': { district: 'liquidation-yard', heldBy: null },
}, C7.prisonerSlots, 'HMH_V7_PRISONER_SLOTS');

export const HMH_PRISONER_KINDS = Object.freeze(['field-medic', 'quartermaster', 'pawnbroker', 'og-miner']);
const PRISONER_DEAL_BASE = Object.freeze(['field-medic', 'field-medic', 'quartermaster', 'quartermaster', 'pawnbroker', 'pawnbroker', 'og-miner', 'og-miner']);
// The districts holding two slots (rugpull-ravine: 0 and 3; mining-camp: 1 and
// 6), in ascending order of their first slot.
const PRISONER_DISTRICT_PAIRS = Object.freeze([Object.freeze([0, 3]), Object.freeze([1, 6])]);

// A byte-for-byte copy of seededUnit in apps/hmh-reboot/src/deterministic-hash.mjs
// (FNV-1a with the seed XORed into the offset basis, prime 0x01000193, then an
// xorshift 13/17/5 finaliser); a parity test pins the copy.
export function seededUnit(seed, key) {
  let hash = ((Number(seed) >>> 0) ^ 0x811c9dc5) >>> 0;
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

// §5.5 The prisoner deal: kinds[i] belongs to prisonerSlots[i]. Each kind is
// dealt twice (Fisher-Yates, descending), and no district holds two of one
// kind. The summary never claims a kind: the verifier recomputes the deal from
// identity.seed, and only the OG Miner changes a ceiling.
export function dealHmhPrisoners(seed) {
  const kinds = [...PRISONER_DEAL_BASE];
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededUnit(seed, `prisoner:${i}`) * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  // A duplicate kind sits only at a and b, so every other slot holds another
  // kind: swapping b with the first other slot k fixes the pair, and k's
  // district partner still differs. A swap for the first pair can clear the
  // second pair's duplicate but never creates one, so one pass is enough.
  for (const [a, b] of PRISONER_DISTRICT_PAIRS) {
    if (kinds[a] !== kinds[b]) continue;
    const k = [0, 1, 2, 3, 4, 5, 6, 7].find((index) => index !== a && index !== b);
    [kinds[b], kinds[k]] = [kinds[k], kinds[b]];
  }
  return Object.freeze(kinds);
}

// ---------------------------------------------------------------------------
// §3.5 Evolutions (V7 evolutions catalogue order = weapon order). Mastery is
// the upgrade ranks the gun needs (flag only). Wave 2 (rows 5-7) stays 0 until
// those weapons' policies accept evolutions (schema rule S10), and the Pistol
// never evolves automatically, only from an evolution panel (package 8.4).
export const HMH_V7_EVOLUTIONS = covering({
  'settler-rail': { weaponId: 'coin-blaster', wave: 1, mastery: { 'proof-of-work': 3, 'hot-wallet': 3, 'block-reward': 3 } },
  'double-spend': { weaponId: 'scatter-shotgun', wave: 1, mastery: { 'scatter-pump': 3, 'scatter-dump': 3, 'scatter-shells': 3 } },
  'hashstorm-overdrive': { weaponId: 'auto-miner', wave: 1, mastery: { 'miner-hashrate': 3, 'miner-asic': 3, 'miner-pool': 3 } },
  'crypto-bomb-orbit': { weaponId: 'launcher-rig', wave: 1, mastery: { 'launcher-airdrop': 3, 'launcher-yield': 3, 'launcher-bandolier': 3 } },
  'crit-candle': { weaponId: 'hash-rail', wave: 1, mastery: { 'rail-blocktime': 3, 'rail-proof': 3, 'rail-mempool': 3 } },
  'lightning-network': { weaponId: 'lightning-ledger', wave: 2, mastery: { 'ledger-conductivity': 3, 'ledger-voltage': 3, 'ledger-reconciliation': 3, 'proof-of-network': 1 } },
  'burn-address': { weaponId: 'bear-market-burner', wave: 2, mastery: { 'burner-liquidity': 3, 'burner-volatility': 3, 'burner-contagion': 3, 'total-selloff': 1 } },
  'chain-split': { weaponId: 'forked-standard', wave: 2, mastery: { 'standard-reach': 3, 'standard-force': 3, 'standard-tempo': 3, 'canonical-fork': 1 } },
}, C7.evolutions, 'HMH_V7_EVOLUTIONS');

// The schema's evolution rules (S10, S18) read these rows through catalogue
// order, the reserved list and the panel-only list, or the module refuses to load.
C7.evolutions.forEach((id, index) => {
  const evolution = HMH_V7_EVOLUTIONS[id];
  if (evolution.weaponId !== C7.weapons[index]
    || (evolution.wave === 2) !== HMH_V7_RESERVED_EVOLUTIONS.includes(id)
    || (evolution.weaponId === HMH_V7_START_WEAPON) !== HMH_V7_PANEL_ONLY_EVOLUTIONS.includes(id)) throw new Error(`HMH_V7_EVOLUTIONS ${id} must match the schema's evolution rules`);
});

// ---------------------------------------------------------------------------
// §5.6 Upgrades: the 24 v6 ids keep their 1.8.1 maxRank and weapon gate; the
// 12 v7 gun-branch ids are rank 3, gated on their gun. None of the 12 grants
// XP or score.
export const HMH_V7_UPGRADES = covering({
  'proof-of-work': { maxRank: 3, requiresWeaponId: null },
  'diamond-hands': { maxRank: 3, requiresWeaponId: null },
  'gas-optimization': { maxRank: 2, requiresWeaponId: null },
  'cold-storage': { maxRank: 3, requiresWeaponId: null },
  'block-reward': { maxRank: 3, requiresWeaponId: null },
  'validator-training': { maxRank: 3, requiresWeaponId: null },
  'compound-interest': { maxRank: 25, requiresWeaponId: null },
  'precision-ledger': { maxRank: 3, requiresWeaponId: null },
  'hard-fork-rounds': { maxRank: 3, requiresWeaponId: null },
  'hot-wallet': { maxRank: 3, requiresWeaponId: null },
  'layer-two': { maxRank: 25, requiresWeaponId: null },
  'hardened-wallet': { maxRank: 25, requiresWeaponId: null },
  'ledger-conductivity': { maxRank: 3, requiresWeaponId: 'lightning-ledger' },
  'ledger-voltage': { maxRank: 3, requiresWeaponId: 'lightning-ledger' },
  'ledger-reconciliation': { maxRank: 3, requiresWeaponId: 'lightning-ledger' },
  'proof-of-network': { maxRank: 1, requiresWeaponId: 'lightning-ledger' },
  'burner-liquidity': { maxRank: 3, requiresWeaponId: 'bear-market-burner' },
  'burner-volatility': { maxRank: 3, requiresWeaponId: 'bear-market-burner' },
  'burner-contagion': { maxRank: 3, requiresWeaponId: 'bear-market-burner' },
  'total-selloff': { maxRank: 1, requiresWeaponId: 'bear-market-burner' },
  'standard-reach': { maxRank: 3, requiresWeaponId: 'forked-standard' },
  'standard-force': { maxRank: 3, requiresWeaponId: 'forked-standard' },
  'standard-tempo': { maxRank: 3, requiresWeaponId: 'forked-standard' },
  'canonical-fork': { maxRank: 1, requiresWeaponId: 'forked-standard' },
  'scatter-pump': { maxRank: 3, requiresWeaponId: 'scatter-shotgun' },
  'scatter-dump': { maxRank: 3, requiresWeaponId: 'scatter-shotgun' },
  'scatter-shells': { maxRank: 3, requiresWeaponId: 'scatter-shotgun' },
  'miner-hashrate': { maxRank: 3, requiresWeaponId: 'auto-miner' },
  'miner-asic': { maxRank: 3, requiresWeaponId: 'auto-miner' },
  'miner-pool': { maxRank: 3, requiresWeaponId: 'auto-miner' },
  'rail-blocktime': { maxRank: 3, requiresWeaponId: 'hash-rail' },
  'rail-proof': { maxRank: 3, requiresWeaponId: 'hash-rail' },
  'rail-mempool': { maxRank: 3, requiresWeaponId: 'hash-rail' },
  'launcher-airdrop': { maxRank: 3, requiresWeaponId: 'launcher-rig' },
  'launcher-yield': { maxRank: 3, requiresWeaponId: 'launcher-rig' },
  'launcher-bandolier': { maxRank: 3, requiresWeaponId: 'launcher-rig' },
}, C7.upgrades, 'HMH_V7_UPGRADES');

// The schema's weapon gates (rule S18) are this table's, or the module refuses to load.
for (const id of C7.upgrades) {
  if (HMH_V7_UPGRADES[id].requiresWeaponId !== (HMH_V7_UPGRADE_WEAPON_GATES[id] ?? null)) throw new Error(`HMH_V7_UPGRADES ${id} must carry the schema's weapon gate`);
}

export const HMH_V7_UPGRADE_MAX_RANKS = Object.freeze(Object.fromEntries(C7.upgrades.map((id) => [id, HMH_V7_UPGRADES[id].maxRank])));
