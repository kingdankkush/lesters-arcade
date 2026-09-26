// Reboot-calibrated plausibility for Hard Money Heroes Ranked runs (contract
// §5.3, A9; feasibility review F1). Server only.
//
// HMH is plausibility-checked, not replayed. This validator rejects only hard
// impossibilities and flags everything else near a ceiling for owner review.
// The summary's schemaVersion picks the rules, and neither path reads a clock
// (run summary v7 contract, docs/hmh-reboot/design/HMH-RUN-SUMMARY-V7-CONTRACT.md):
//
//   - schema 1-6 (the 1.8.x children): the v6 rules, with the literal 1.8.1
//     constants of HMH_V6_RULES, indefinitely. Parity tests pin every literal
//     against the 1.8.1 child modules; from here on the literal, not the live
//     child, is the v6 authority, so a later child change cannot move a v6
//     bound (§9).
//   - schema 7: the v7 rules (§7), computed only from the schema's V7
//     catalogues and sdk/hmh-run-contract-v7.mjs, which the child imports too.
//
// v6 rules
//   reject  start-tick-invalid       identity.startTick is not 0 (the reboot
//                                    starts every run at simulation tick 0)
//           progress-without-time    progress with zero elapsed time
//           elapsed-time-mismatch    elapsedMs is not the fixed-step time of the
//                                    run's ticks (the reboot reports
//                                    simulation.timeMs = tick x FIXED_STEP_MS);
//                                    the A26 wall-clock bound relies on it
//           boss-before-band         a boss kill before the boss band (72,000)
//           level-xp-mismatch        totals.level is not the level of totals.xp
//                                    under 150 x L x (L + 1), levels to 1000
//           xp-above-ceiling         XP above kills by role and threat, combo
//                                    milestones and weapon caches, all at the
//                                    maximum multiplier ranks
//           kills-above-capacity     more kills than the encounter director,
//                                    the opening enemies and the Liquidator (and
//                                    its adds) can spawn in the run's ticks, or
//                                    more than one Liquidator kill
//           score-above-ceiling      score above kills by role and threat,
//                                    silver coins and objective rewards at the
//                                    maximum score multiplier
//           grenade-kills-above-weapon-kills, pickups-above-capacity,
//           district-path-invalid, districts-before-travel-time,
//           activity-without-time, equipped-ticks-above-run,
//           weapon-without-source, grenade-kills-above-contacts,
//           grenade-detonations-above-launches, grenades-thrown-above-supply,
//           damage-dealt-mismatch, combo-above-kills
//                                    the 1.8.4 consistency rules for the fields
//                                    the achievement stats read directly (see
//                                    HMH_V6_CONSISTENCY_RULES): grenadeKills,
//                                    powerUpsCollected, districtsVisited,
//                                    weaponsUsed, damageDealt, maxCombo
//           knife-kills-above-contacts, melee-contacts-without-trigger,
//           knife-triggers-above-cadence, standard-triggers-above-cadence
//                                    the round-3 melee-trail rules for the last
//                                    such field, meleeKills (kills.byWeapon for
//                                    litecoin-knife and forked-standard)
//   flag    anything within 10% of a ceiling, and cross-field inconsistencies
//           an honest client never produces but that do not raise a ceiling.
//
// v7 rules: the same time, level, capacity and ceiling rejects with the v7
// formulas, and per-boss timing in place of the 72,000-tick boss band:
//   reject  build-predates-schema-7  identity.buildHash names a game older
//                                    than the first v7 child (1.9.0), or none
//           boss-before-ready        a boss initiated before its readyTick
//                                    (one entry per boss)
//           boss-fight-too-short     a defeat sooner after the boss's last
//                                    initiation than its minimum fight (300
//                                    ticks: the invulnerable intro and two
//                                    phase halts; 180 for the Liquidator, whose
//                                    Dark Pool start has no intro)
//           boss-reinitiation-too-soon  initiations of one boss less than
//                                    2,520 ticks apart on average (retreat)
//           boss-fights-overlap      two bosses live at once: two initiated on
//                                    one tick, or one initiated during another's
//                                    final fight
//           collectibles-above-capacity  more collectible pickups than the
//                                    authored placements can give in the run
//           node-xp-above-level      node XP claimed at a level that the level
//                                    cannot hold (the level's own 300 x L, or
//                                    the XP gained at the final level)
//           grenade-kills-above-weapon-kills  as on the v6 path: grenades.kills
//                                    above the grenade weapons' kills (contract
//                                    §15.1; the v7 child keeps the v6 count)
//   flag    near-ceiling and claimed-rank checks as in v6, plus
//           upgrade-rank-above-max, evolution-without-mastery,
//           node-level-inconsistent, objective-prerequisite-missing and
//           node-in-unvisited-district. Those five cannot raise a ceiling (the
//           hard ceilings use maximum ranks, node-xp-above-level bounds the
//           node levels, and districts and prerequisites are free to claim);
//           each is one entry whose value is the number of offending rows and
//           whose limit is 0.
// Flags have the shape { id, severity, value, limit } on both paths.
import { HMH_RUN_SUMMARY_CATALOGS_V6 } from '../../sdk/hmh-run-summary-schema.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../../sdk/hmh-run-summary-schema-v7.mjs';
import {
  HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION,
  HMH_V7_BOSSES,
  HMH_V7_BOSS_RULES,
  HMH_V7_EVOLUTIONS,
  HMH_V7_OBJECTIVES,
  HMH_V7_PRISONER_SLOTS,
  HMH_V7_ROLE_THREAT,
  HMH_V7_RUN_RULES,
  HMH_V7_UPGRADE_MAX_RANKS,
  dealHmhPrisoners,
  hmhGameVersionOfBuild,
  hmhV7CollectibleCapacity,
  hmhV7KillScore,
  hmhV7KillXp,
  hmhV7LevelForXp,
  hmhV7LevelThreshold,
  isHmhV7Build,
} from '../../sdk/hmh-run-contract-v7.mjs';

const freezeDeep = (value) => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
  return Object.freeze(value);
};

// ---------------------------------------------------------------------------
// The v6 path: literal 1.8.1 constants. Each is pinned by a parity test in
// tests/server-verify-hmh-plausibility.test.mjs against the module it was
// read from:
//   bands, openingEnemies     encounter-director ENCOUNTER_BANDS, opening-balance
//   roleThreat                enemy-archetypes costs.threat; main.mjs
//                             LIQUIDATOR_THREAT_COST for the boss
//   multiplierPerRank,        run-progression RUN_UPGRADE_CATALOG
//   maxUpgradeRanks
//   comboMilestones           run-progression comboMilestoneXp
//   cacheXp                   collectible-system COLLECTIBLE_EFFECTS xpGain
//   silver*                   run-progression SILVER_SCORE_PER_COIN; main.mjs
//                             boss drop value:10; silver-drops default value 1
//   objectiveReward*          objective-rewards placements (xpGain 0)
//   bossStartTick             the boss band; main.mjs startTick 72_000
//   liquidatorAdds            liquidator-boss attack plan, endless cycle and
//                             readability budget (activeAdds)
//   fixedStepMs, maxLevel     simulation FIXED_STEP_MS; run-progression applyRunXp
export const HMH_V6_RULES = freezeDeep({
  fixedStepMs: 1000 / 60,
  maxLevel: 1000,
  bands: [
    { id: 'opening', minTick: 0, maxTick: 3_599, spawnIntervalTicks: 150 },
    { id: 'build', minTick: 3_600, maxTick: 17_999, spawnIntervalTicks: 90 },
    { id: 'pressure', minTick: 18_000, maxTick: 35_999, spawnIntervalTicks: 60 },
    { id: 'elite', minTick: 36_000, maxTick: 71_999, spawnIntervalTicks: 45 },
    { id: 'boss', minTick: 72_000, maxTick: 75_599, spawnIntervalTicks: 60 },
    { id: 'endurance', minTick: 75_600, maxTick: Infinity, spawnIntervalTicks: 30 },
  ],
  openingEnemies: 2,
  roleThreat: {
    'bagholder-rusher': 2,
    forkrunner: 3,
    'liquidator-agent': 4,
    'whale-enforcer': 6,
    'gas-bomber': 5,
    'validator-cultist': 5,
    liquidator: 48,
  },
  // validator-training (xpMultiplier) and block-reward (scoreMultiplier) add
  // this per rank; no other upgrade touches XP or score.
  multiplierPerRank: 0.25,
  maxUpgradeRanks: {
    'proof-of-work': 3,
    'diamond-hands': 3,
    'gas-optimization': 2,
    'cold-storage': 3,
    'block-reward': 3,
    'validator-training': 3,
    'compound-interest': 25,
    'precision-ledger': 3,
    'hard-fork-rounds': 3,
    'hot-wallet': 3,
    'layer-two': 25,
    'hardened-wallet': 25,
    'ledger-conductivity': 3,
    'ledger-voltage': 3,
    'ledger-reconciliation': 3,
    'proof-of-network': 1,
    'burner-liquidity': 3,
    'burner-volatility': 3,
    'burner-contagion': 3,
    'total-selloff': 1,
    'standard-reach': 3,
    'standard-force': 3,
    'standard-tempo': 3,
    'canonical-fork': 1,
  },
  comboMilestones: [[5, 120], [10, 240], [20, 480], [30, 900]],
  cacheXp: { 'hash-rail-core': 160, 'lightning-ledger-cache': 220, 'bear-market-burner-cache': 260, 'forked-standard-cache': 240 },
  silverScorePerCoin: 10,
  silverPerBossKill: 10,
  silverPerEnemyKill: 1,
  objectiveRewardXp: 0,
  objectiveRewardScore: 0,
  bossStartTick: 72_000,
  // Bad-debt summons by boss-elapsed tick: two in the authored plan (before the
  // endless loop), then one per endless cycle at its offset; each inserts at
  // most addsPerSummon adds.
  liquidatorAdds: { summonTicks: [1_800, 2_820], endlessLoopStartTick: 3_600, endlessCycleTicks: 1_440, endlessCycleSummonOffsets: [1_020], addsPerSummon: 6 },
});
const V6 = HMH_V6_RULES;

export const LIQUIDATOR_THREAT_COST = V6.roleThreat.liquidator;
export const SILVER_PER_BOSS_KILL = V6.silverPerBossKill;
export const SILVER_PER_ENEMY_KILL = V6.silverPerEnemyKill;

export const HMH_BOSS_ROLE_ID = 'liquidator';
export const HMH_MAX_LEVEL = V6.maxLevel;
export const NEAR_CEILING_FRACTION = 0.9;
const ELAPSED_TOLERANCE_MS = 1;

// The Liquidator starts at the boss band (v6 only: a v7 boss has its own
// readyTick in sdk/hmh-run-contract-v7.mjs).
export const HMH_BOSS_START_TICK = V6.bossStartTick;

// Threat per v6 summary enemy role: the archetype's costs.threat, and the boss's.
export const HMH_ROLE_THREAT = Object.freeze(Object.fromEntries(HMH_RUN_SUMMARY_CATALOGS_V6.enemyRoles.map((role) => {
  if (!Number.isInteger(V6.roleThreat[role])) throw new Error(`enemy role ${role} has no v6 threat`);
  return [role, V6.roleThreat[role]];
})));

// Objective rewards grant items only (the 1.8.1 placements carry xpGain 0).
// Kept as terms of the ceilings.
export const OBJECTIVE_REWARD_XP = V6.objectiveRewardXp;
export const OBJECTIVE_REWARD_SCORE = V6.objectiveRewardScore;

export const COMBO_MILESTONES = Object.freeze(V6.comboMilestones.map(([combo, baseXp]) => Object.freeze({ combo, baseXp })));

export const MAX_UPGRADE_RANKS = V6.maxUpgradeRanks;

// A claimed rank as run-progression applies it: clamped to [0, maxRank], and a
// multiplier of 1 + 0.25 x rank for a positive rank, 1 otherwise.
const clampedRank = (ranks, id, maxRanks) => (Object.hasOwn(ranks, id) ? Math.max(0, Math.min(maxRanks[id], ranks[id])) : 0);
const multiplierAt = (rank, perRank) => (rank <= 0 ? 1 : 1 + perRank * rank);

// Per-event gains at the given ranks, by the 1.8.1 run-progression formulas:
// kill XP round((80 + 20t) x xm), kill score round((100 + 25t) x sm), a grant
// round(base x xm), and one silver grant of c coins round(c x 10 x sm), which is
// at most c x (10 x sm + 0.5) for c >= 1.
function measureGains(ranks) {
  const xm = multiplierAt(clampedRank(ranks, 'validator-training', MAX_UPGRADE_RANKS), V6.multiplierPerRank);
  const sm = multiplierAt(clampedRank(ranks, 'block-reward', MAX_UPGRADE_RANKS), V6.multiplierPerRank);
  const killXp = {};
  const killScore = {};
  for (const [role, threat] of Object.entries(HMH_ROLE_THREAT)) {
    killXp[role] = Math.round((80 + threat * 20) * xm);
    killScore[role] = Math.round((100 + threat * 25) * sm);
  }
  let comboXp = 0;
  let comboRate = 0;
  for (const { combo, baseXp } of COMBO_MILESTONES) {
    comboXp += Math.round(baseXp * xm);
    comboRate = Math.max(comboRate, comboXp / combo);
  }
  const cacheXp = Object.fromEntries(Object.entries(V6.cacheXp).map(([effectId, baseXp]) => [effectId, Math.round(baseXp * xm)]));
  const silverScorePerCoin = V6.silverScorePerCoin * sm + 0.5;
  return Object.freeze({ killXp: Object.freeze(killXp), killScore: Object.freeze(killScore), comboRate, cacheXp: Object.freeze(cacheXp), silverScorePerCoin });
}

export const MAX_GAINS = measureGains(MAX_UPGRADE_RANKS);

// 150 x L x (L + 1) XP completes level L (run-progression.mjs nextLevelThreshold;
// parity test).
export function rebootLevelThreshold(level) {
  return 150 * level * (level + 1);
}

export function rebootLevelForXp(xp) {
  let level = 1;
  while (level < HMH_MAX_LEVEL && xp >= rebootLevelThreshold(level)) level += 1;
  return level;
}

// Upper bound on encounter-director insertions by `endTick`: after an insertion
// at tick t in band b the next one is due at t + b.spawnIntervalTicks, so a band
// spanning s ticks holds at most floor(s / interval) + 1 of them. The v7 path
// passes its own, identical, HMH_V7_RUN_RULES.ENCOUNTER_BAND_SCHEDULE.
export function directorSpawnCapacity(endTick, bands = V6.bands) {
  let total = 0;
  for (const band of bands) {
    if (endTick < band.minTick) break;
    const last = Math.min(endTick, band.maxTick);
    total += Math.floor((last - band.minTick) / band.spawnIntervalTicks) + 1;
  }
  return total;
}

// Liquidator bad-debt summons up to `bossElapsed` boss ticks, each inserting at
// most addsPerSummon adds.
export function liquidatorAddCapacity(bossElapsed) {
  if (bossElapsed < 0) return 0;
  const plan = V6.liquidatorAdds;
  let summons = plan.summonTicks.filter((tick) => tick <= Math.min(bossElapsed, plan.endlessLoopStartTick - 1)).length;
  if (bossElapsed >= plan.endlessLoopStartTick) {
    const loopTick = bossElapsed - plan.endlessLoopStartTick;
    summons += Math.floor(loopTick / plan.endlessCycleTicks) * plan.endlessCycleSummonOffsets.length
      + plan.endlessCycleSummonOffsets.filter((offset) => offset <= loopTick % plan.endlessCycleTicks).length;
  }
  return summons * plan.addsPerSummon;
}

export function spawnCapacity(endTick) {
  const bossPresent = endTick >= HMH_BOSS_START_TICK;
  return V6.openingEnemies
    + directorSpawnCapacity(endTick)
    + (bossPresent ? 1 + liquidatorAddCapacity(endTick - HMH_BOSS_START_TICK) : 0);
}

function rowCounts(rows, idKey, valueKey) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) out[row?.[idKey]] = row?.[valueKey] ?? 0;
  return out;
}

function ceilings(summary, gains) {
  const killsByRole = rowCounts(summary.kills.byEnemyRole, 'enemyRoleId', 'count');
  const collected = rowCounts(summary.collectibles, 'effectId', 'collected');
  const bossKills = Math.max(summary.kills.boss, killsByRole[HMH_BOSS_ROLE_ID] ?? 0);
  let killXp = 0;
  let killScore = 0;
  for (const role of Object.keys(HMH_ROLE_THREAT)) {
    killXp += (killsByRole[role] ?? 0) * gains.killXp[role];
    killScore += (killsByRole[role] ?? 0) * gains.killScore[role];
  }
  const comboXp = Math.ceil(summary.kills.total * gains.comboRate);
  const cacheXp = Object.entries(gains.cacheXp).reduce((sum, [effectId, xp]) => sum + (collected[effectId] ?? 0) * xp, 0);
  const silverCoins = Math.max(0, summary.kills.total - bossKills) * SILVER_PER_ENEMY_KILL + bossKills * SILVER_PER_BOSS_KILL;
  return {
    xp: killXp + comboXp + cacheXp + OBJECTIVE_REWARD_XP,
    score: killScore + Math.ceil(silverCoins * gains.silverScorePerCoin) + OBJECTIVE_REWARD_SCORE,
  };
}

function verdictCollector() {
  const flags = [];
  return {
    reject: (id, value, limit) => flags.push(Object.freeze({ id, severity: 'reject', value, limit })),
    flag: (id, value, limit) => flags.push(Object.freeze({ id, severity: 'flag', value, limit })),
    done: () => Object.freeze({
      verdict: flags.some((entry) => entry.severity === 'reject') ? 'rejected' : flags.length ? 'flagged' : 'ok',
      flags: Object.freeze(flags),
    }),
  };
}

// The run-time rejects, in their original order. → the run's elapsed ticks.
function checkRunTime(identity, totals, kills, fixedStepMs, reject) {
  // The reboot creates the accumulator with startTick: 0 on a fresh
  // DeterministicSimulation for every run (main.mjs; parity test), so a
  // non-zero start is fabricated: it would let a summary claim the end tick
  // (spawn capacity, boss timing) of a long run with the elapsed time of a
  // short one. Every tick bound uses the run's elapsed ticks, never endTick.
  if (identity.startTick !== 0) reject('start-tick-invalid', identity.startTick, 0);
  const runTicks = totals.survivalTicks;
  const progress = kills.total > 0 || totals.score > 0 || totals.xp > 0 || totals.level > 1 || totals.litecoin > 0;
  if (progress && (runTicks === 0 || totals.elapsedMs === 0)) reject('progress-without-time', totals.elapsedMs, 0);
  const expectedMs = runTicks * fixedStepMs;
  if (Math.abs(totals.elapsedMs - expectedMs) > ELAPSED_TOLERANCE_MS) reject('elapsed-time-mismatch', totals.elapsedMs, expectedMs);
  return runTicks;
}

// ---------------------------------------------------------------------------
// v6 consistency rules (added for 1.8.4). Summary fields reach the achievement
// stats directly (statsFromHmhRunSummary: grenadeKills, powerUpsCollected,
// districtsVisited, weaponsUsed, damageDealt, maxCombo), and no v6 ceiling
// bounded them: a paid 1.8.2 run of 36 kills verified with 250 grenade kills,
// 250 bonus lives and all six districts, and a second red team (against
// a9663a09) earned the same achievements from zero-tick runs, locked pickups,
// weapons never picked up, grenade kills with nothing thrown or launched, one
// damage field and a combo above the kills. Each rule is a hard impossibility
// for the 1.8.x child (apps/hmh-reboot/src and sdk/hmh-run-summary.mjs are
// identical from 1.8.0 to 1.8.3; 1.8.4 leaves the accumulator alone and only
// makes a Ranked session ignore evidenceSafe's spawn and invulnerability),
// states why every honest run meets it, and carries its margin. tests/server-verify-hmh-plausibility.test.mjs pins each literal
// against the child and runs the honest pilot corpus (tests/fixtures/ranked/
// hmh-honest-corpus.mjs) through them.
//
//   reject  grenade-kills-above-weapon-kills  grenades.kills above the kills of
//                                    the two grenade weapons. recordRunKill adds
//                                    a grenade kill exactly when the killing
//                                    weapon is satoshi-frag or launcher-rig, and
//                                    nothing else writes the count, so an honest
//                                    summary has equality. Only the excess
//                                    rejects, so no margin is needed.
//           pickups-above-capacity   more pickups of an effect than its
//                                    placements can give by the run's last tick
//                                    (value and limit: the offending effects'
//                                    pickups and their capacity). A pickup is
//                                    only a collectible:collected event of
//                                    stepCollectibles, from tick 1, which gives a
//                                    placement once it is available and unlocked,
//                                    and again only after its re-arm ticks. An
//                                    objective reward unlocks in the step that
//                                    records its site's milestone (the site's
//                                    operated tick), the Liquidator vault with
//                                    the Liquidator kill (never before the boss
//                                    band), and a seeded event is available no
//                                    sooner than its minimum tick. Margin: every
//                                    placement counts from its earliest tick and
//                                    re-arms at the first possible tick, with no
//                                    travel between.
//           district-path-invalid    the visited districts are not one
//                                    contiguous run of strips that contains the
//                                    seed's entry strip (value: the mask; limit:
//                                    the entry's bit). The strips tile the world
//                                    along x, every entry lies 250 units or more
//                                    inside its strip, and a tick moves the
//                                    player far less than a strip is wide, so
//                                    the first recorded tick is in the entry
//                                    strip and each later strip is entered from
//                                    a neighbour. A mask of 0 (no tick recorded)
//                                    passes. From 1.8.4 a Ranked session spawns
//                                    at the seed's entry even under evidenceSafe
//                                    (main.mjs initializeSession).
//           districts-before-travel-time  fewer ticks than the travel from the
//                                    entry to the far ends of the visited strips
//                                    needs at travel.maxStepPx a tick after a
//                                    one-off travel.allowancePx (value: the
//                                    run's ticks; limit: the fewest ticks that
//                                    cover it). Margin: 48 px a tick is twice a
//                                    dash tick (192 px over 8 ticks) and over
//                                    five times the fastest running tick
//                                    (240 px/s x 1.68 at the maximum movement
//                                    ranks x 1.2 time dilation x 1.04 downhill =
//                                    8.4 px); a maximum recoil impulse (74 px/s,
//                                    8.9 px in all) and the one conveyor
//                                    (150 px/s along 320 px) keep a running tick
//                                    under 20 px.
//           activity-without-time    a run of zero ticks that visited a district
//                                    or dealt damage (value: how many of the two;
//                                    limit 0). The simulation's first tick is 1:
//                                    recordRunTick sets the district bit and
//                                    recordRunDamage runs inside a step, so a run
//                                    that never stepped records neither.
//           equipped-ticks-above-run the weapons' equippedTicks add up to more
//                                    than the run's ticks. recordRunTick adds one
//                                    to the active weapon's row on each recorded
//                                    tick, and recorded ticks rise strictly from
//                                    tick 1 to at most the end tick.
//           weapon-without-source    weapon rows used without their source
//                                    (value: how many rows; limit 0): equipped
//                                    though never an active weapon (only the
//                                    eight of main.mjs WEAPON_ORDER can be);
//                                    equipped or credited a kill without a pickup
//                                    (every active weapon but the starting Coin
//                                    Blaster is owned only through a weapon-cache
//                                    pickup); more pickups than its cache effect's
//                                    collections, or any pickup of a weapon with
//                                    no cache; Satoshi Frag kills with no hand
//                                    grenade thrown; Nuke Liquidation kills with
//                                    no nuke collected.
//           grenade-kills-above-contacts  grenades.kills above grenades.contacts.
//                                    A grenade weapon's kill comes only from a
//                                    blast hit, and every non-player blast hit is
//                                    one contact, so kills never pass contacts.
//           grenade-detonations-above-launches  grenades.detonated above the hand
//                                    grenades thrown plus the Launcher Rig's
//                                    triggers. A grenade exists only through
//                                    throwGrenade: a hand throw records thrown
//                                    when it spawns, and every launcher shot
//                                    records a trigger, spawned or not.
//           grenades-thrown-above-supply  more hand grenades thrown than the run
//                                    had: three at the start, one per Extra
//                                    Grenade rank (at most three) and one per
//                                    nuke-liquidation collection (the Nuke and
//                                    the Scrypt Cache recharge one each). Margin:
//                                    the charge cap is ignored.
//           damage-dealt-mismatch    totals.damageDealt is not the sum of the
//                                    weapons' damage. recordRunDamage adds the
//                                    same whole amount (combat-events rounds it)
//                                    to both, so an honest summary has equality.
//           combo-above-kills        totals.maxCombo above kills.total. The combo
//                                    rises by exactly one per recorded kill
//                                    (awardComboXp follows each recordRunKill),
//                                    so the best combo never passes the kills.
//                                    The 1.8.1 flag combo-exceeds-kills stays as
//                                    it was, beside this reject.
//
// Round 3 (item 1, the melee trail) adds four rules for the last stats field
// with no bound, meleeKills (kills.byWeapon for litecoin-knife and
// forked-standard; blade-master and blade-samurai read it). Against 4f947386,
// 100 knife kills with no swing in a 20,000-tick run verified ok. The knife
// (main.mjs stepMeleeState, melee.mjs) swings only automatically and only when
// the swing hits, at most once every HMH_MELEE_DEFINITION.cooldownTicks, and
// each swing records one trigger and, when it hits, one trigger contact and one
// projectile contact per hit; a knife kill is a kill by one of those hits
// (combat-events stamps the kill with the hit's weapon). The Forked Standard
// (weapon-system melee-alternating, forked-standard.mjs) strikes only while it
// is the active weapon and only after its cooldown (thrust 24, sweep 28, each
// less 2 per Attack Speed rank, three ranks at most, so 18 at the least), and
// each strike records the same trail per hit. The real-child corpus holds ten
// knife-heavy and twenty Standard runs of the 1.8.4 child for these rules
// (tests/fixtures/hmh-honest-corpus/real-child-1.8.4.json).
//
//   reject  knife-kills-above-contacts  the knife's kills above its
//                                    projectileContacts. Every knife hit is one
//                                    contact and a kill needs a hit, so kills
//                                    never pass contacts (the real corpus: 47
//                                    kills of 71 contacts at most).
//           melee-contacts-without-trigger  a melee weapon row (the knife or the
//                                    Standard) with projectileContacts but no
//                                    triggerContacts (value: how many of the two
//                                    rows; limit 0). A swing that hits records
//                                    its trigger contact in the same statement
//                                    as its contacts, and the schema already
//                                    keeps triggerContacts within triggers.
//           knife-triggers-above-cadence  more knife triggers than ceil(T / 20)
//                                    for a run of T ticks: the knife is stepped
//                                    once a tick from tick 1, and a swing sets
//                                    the next one 20 ticks later. Honest play
//                                    stays far under it (the real corpus: 12.3% of
//                                    the bound at most, point-blank play
//                                    included), since the knife swings only with
//                                    a target inside 58 px.
//           standard-triggers-above-cadence  more Standard strikes than
//                                    ceil(T / 18), read from the weapon row's
//                                    triggers and the forkedStandard block's
//                                    attacks (whichever claims more): the
//                                    Standard is stepped once a tick and a strike
//                                    sets the next one at least 18 ticks later
//                                    (plus a whiff penalty). Honest play stays
//                                    far under it (the real corpus: 12.4% at most,
//                                    whiffs included).
//   The Standard's kills against its contacts is the same impossibility as the
//   knife's, but it stays a documented residual in this round: the committed
//   hmh-realistic fixture and the scripted model credit Standard kills with no
//   contacts, and neither may change here (HMH-VERIFIER-R3-HANDOFF.md, item 1).
// Every rule reads only the summary and the literals below, never a clock.
export const HMH_V6_CONSISTENCY_RULES = freezeDeep({
  grenadeWeapons: ['satoshi-frag', 'launcher-rig'],
  // The simulation's first tick (DeterministicSimulation steps from tick 1).
  firstTick: 1,
  // Per collectible effect, one [rearmTicks, unlock] per placement that gives
  // it: rearmTicks is 0 for a one-shot placement; unlock is the placement's
  // earliest available tick (0 for an authored point of interest, the minimum
  // tick of a seeded event), or the objective that unlocks it (a machinery
  // site, or the Liquidator vault's 'liquidator-defeated'). The 21 placements
  // are the ten authored points of interest (authored-prop-layout
  // POINT_OF_INTEREST_ASSET_BY_ID; main.mjs re-arms six of their assets every
  // 10,800 ticks), the three seeded weapon events (one-shot; lightning-ledger-
  // event MIN_EVENT_TICK, BEAR_MARKET_BURNER_EVENT_BOUNDS.minTick and
  // FORKED_STANDARD_CONFIG.eventMinTick) and the eight objective rewards
  // (objective-rewards OBJECTIVE_REWARDS).
  pickupPlacements: {
    'bonus-life': [[0, 0], [0, 0], [7_200, 'hashwood-shrine']],
    'coin-blaster-cache': [[7_200, 'crossing-pump'], [10_800, 0]],
    'scatter-shotgun-cache': [[0, 'relay-power'], [10_800, 0]],
    'auto-miner-cache': [[10_800, 0]],
    'launcher-rig-cache': [[10_800, 0]],
    'litecoin-token': [],
    'hash-rail-core': [[0, 'ravine-winch'], [0, 0]],
    'lightning-ledger-cache': [[0, 'liquidator-defeated'], [0, 3_600]],
    'bear-market-burner-cache': [[0, 'yard-warehouse'], [0, 7_200]],
    'forked-standard-cache': [[0, 10_800]],
    'time-dilation': [[10_800, 0]],
    'berserk-candle': [[10_800, 'mining-valve'], [10_800, 0]],
    'nuke-liquidation': [[0, 0], [7_200, 'hashwood-shrine']],
  },
  // The objective the Liquidator kill unlocks (main.mjs), and the earliest tick
  // of that kill: the boss band (HMH_V6_RULES.bossStartTick).
  vaultObjective: 'liquidator-defeated',
  // level-one-world DISTRICTS as [id, minX, maxX], each the full world height;
  // getLevelOneDistrictAt returns the first strip with minX <= x <= maxX.
  districtStrips: [
    ['frontier-relay', 0, 1_800],
    ['rugpull-ravine', 1_800, 3_800],
    ['liquidity-crossing', 3_800, 6_000],
    ['hashwood', 6_000, 8_000],
    ['mining-camp', 8_000, 10_000],
    ['liquidation-yard', 10_000, 12_000],
  ],
  // level-entry LEVEL_ONE_ENTRIES as [id, x, y]; selectLevelEntry(seed) picks one.
  levelEntries: [
    ['relay', 800, 2_400],
    ['ravine', 2_100, 2_300],
    ['hashwood', 6_900, 2_250],
    ['mining', 8_250, 2_350],
    ['yard', 10_400, 2_450],
  ],
  travel: { maxStepPx: 48, allowancePx: 480 },
  // main.mjs WEAPON_ORDER: the only weapons the loadout can make active (and so
  // the only rows recordRunTick can give equipped ticks); the first is the
  // starting weapon, owned from the start.
  activeWeapons: ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard'],
  // collectible-system COLLECTIBLE_EFFECTS: the weapon-cache effect that grants
  // each active weapon (the only source of a weapon pickup in a run).
  weaponCaches: {
    'coin-blaster': 'coin-blaster-cache',
    'scatter-shotgun': 'scatter-shotgun-cache',
    'auto-miner': 'auto-miner-cache',
    'launcher-rig': 'launcher-rig-cache',
    'hash-rail': 'hash-rail-core',
    'lightning-ledger': 'lightning-ledger-cache',
    'bear-market-burner': 'bear-market-burner-cache',
    'forked-standard': 'forked-standard-cache',
  },
  // Hand grenades (main.mjs createGrenadeSystem handCharges, run-progression
  // cold-storage, and the two rechargeHandGrenades calls of the nuke-liquidation
  // effect's 'nuke' and 'grenade-supply' kinds).
  handGrenades: { weaponId: 'satoshi-frag', startCharges: 3, rankUpgradeId: 'cold-storage', chargesPerRank: 1, maxRanks: 3, refillEffectId: 'nuke-liquidation' },
  launcherWeapon: 'launcher-rig',
  nuke: { weaponId: 'nuke-liquidation', effectId: 'nuke-liquidation' },
  // The melee trail (round 3, item 1): melee.mjs HMH_MELEE_DEFINITION (id,
  // cooldownTicks) and forked-standard.mjs FORKED_STANDARD_CONFIG (id; the
  // thrust cooldown of 24 less 2 per standard-tempo rank at its three ranks).
  melee: {
    weapons: ['litecoin-knife', 'forked-standard'],
    knifeWeapon: 'litecoin-knife',
    knifeCooldownTicks: 20,
    standardWeapon: 'forked-standard',
    standardCooldownTicks: 18,
  },
});
const V6C = HMH_V6_CONSISTENCY_RULES;

export const HMH_V6_CONSISTENCY_REJECTS = Object.freeze([
  'grenade-kills-above-weapon-kills',
  'pickups-above-capacity',
  'district-path-invalid',
  'districts-before-travel-time',
  'activity-without-time',
  'equipped-ticks-above-run',
  'weapon-without-source',
  'grenade-kills-above-contacts',
  'grenade-detonations-above-launches',
  'grenades-thrown-above-supply',
  'damage-dealt-mismatch',
  'combo-above-kills',
  // Round 3, item 1: the melee trail.
  'knife-kills-above-contacts',
  'melee-contacts-without-trigger',
  'knife-triggers-above-cadence',
  'standard-triggers-above-cadence',
]);

// The most swings a melee weapon stepped once a tick from tick 1 can make in a
// run of `runTicks` ticks when each swing sets the next `cooldownTicks` later:
// ticks 1, 1 + c, 1 + 2c, ... up to runTicks, so ceil(runTicks / c); 0 for a
// run of no ticks.
export function hmhV6MeleeCadenceLimit(runTicks, cooldownTicks) {
  return Math.ceil(Math.max(0, runTicks) / cooldownTicks);
}

// The tick each objective reward's objective unlocked at, read from the
// summary; a missing key is still locked. A machinery site unlocks at its
// operated tick (main.mjs unlocks the reward in the step that records the
// milestone); the Liquidator vault at the boss band once the run claims a
// Liquidator kill (the kill unlocks it, and boss-before-band rejects one
// before the band).
export function hmhV6ObjectiveUnlocks(summary) {
  const unlocks = {};
  for (const row of summary?.milestones?.sites ?? []) if (row?.operated === 1) unlocks[row.siteId] = row.tick;
  const liquidatorKills = rowCounts(summary?.kills?.byEnemyRole, 'enemyRoleId', 'count')[HMH_BOSS_ROLE_ID] ?? 0;
  if (Math.max(summary?.kills?.boss ?? 0, liquidatorKills) > 0) unlocks[V6C.vaultObjective] = HMH_BOSS_START_TICK;
  return unlocks;
}

// A placement gives nothing before its first tick (its unlock or availability,
// and never before the simulation's first tick), then one pickup, and one more
// per full re-arm period of the rest of the run.
function placementCapacity([rearmTicks, unlock], runTicks, unlocks) {
  const from = typeof unlock === 'number' ? unlock : (Object.hasOwn(unlocks, unlock) ? unlocks[unlock] : null);
  if (!Number.isFinite(from)) return 0;
  const first = Math.max(V6C.firstTick, from);
  if (runTicks < first) return 0;
  return 1 + (rearmTicks > 0 ? Math.floor((runTicks - first) / rearmTicks) : 0);
}

// The most pickups of `effectId` a run of `runTicks` ticks can make, with its
// objectives unlocked at `unlocks` (hmhV6ObjectiveUnlocks; {} keeps every
// objective reward locked).
export function hmhV6PickupCapacity(effectId, runTicks, unlocks = {}) {
  const placements = V6C.pickupPlacements[effectId] ?? [];
  return placements.reduce((sum, placement) => sum + placementCapacity(placement, runTicks, unlocks), 0);
}

// → { value, limit } summed over the effects above their capacity, or null.
export function hmhV6PickupExcess(collectibles, runTicks, unlocks = {}) {
  let value = 0;
  let limit = 0;
  for (const row of collectibles) {
    const capacity = hmhV6PickupCapacity(row?.effectId, runTicks, unlocks);
    if (row?.collected > capacity) {
      value += row.collected;
      limit += capacity;
    }
  }
  return value > 0 ? { value, limit } : null;
}

// The hand grenades a run can have thrown: the starting charges, one per Extra
// Grenade rank and one per nuke-liquidation collection.
export function hmhV6HandGrenadeSupply(summary) {
  const hand = V6C.handGrenades;
  const ranks = rowCounts(summary.upgrades, 'upgradeId', 'selected')[hand.rankUpgradeId] ?? 0;
  const refills = rowCounts(summary.collectibles, 'effectId', 'collected')[hand.refillEffectId] ?? 0;
  return hand.startCharges + hand.chargesPerRank * Math.min(hand.maxRanks, Math.max(0, ranks)) + refills;
}

// → the weapon rows used without their source (see weapon-without-source).
export function hmhV6WeaponsWithoutSource(summary) {
  const collected = rowCounts(summary.collectibles, 'effectId', 'collected');
  const [startingWeapon] = V6C.activeWeapons;
  const offending = [];
  for (const row of summary.weapons) {
    const weaponId = row?.weaponId;
    const cache = Object.hasOwn(V6C.weaponCaches, weaponId) ? V6C.weaponCaches[weaponId] : null;
    const equipped = row.equippedTicks > 0;
    const killed = row.kills > 0;
    const unsourced = (equipped && !V6C.activeWeapons.includes(weaponId))
      || (cache === null ? row.pickups > 0 : row.pickups > (collected[cache] ?? 0))
      || (cache !== null && weaponId !== startingWeapon && (equipped || killed) && row.pickups === 0)
      || (weaponId === V6C.handGrenades.weaponId && killed && !(summary.grenades.thrown > 0))
      || (weaponId === V6C.nuke.weaponId && killed && !((collected[V6C.nuke.effectId] ?? 0) > 0));
    if (unsourced) offending.push(weaponId);
  }
  return offending;
}

// level-entry selectLevelEntry: FNV-1a over `level-1-entry:${seed}`, and the
// strip the entry lies in.
export function hmhV6LevelEntry(seed) {
  let hash = 2166136261;
  for (const character of `level-1-entry:${seed}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  const [id, x, y] = V6C.levelEntries[hash % V6C.levelEntries.length];
  return Object.freeze({ id, x, y, strip: V6C.districtStrips.findIndex(([, minX, maxX]) => x >= minX && x <= maxX) });
}

// The visited mask against the seed's entry → { pathValid, entryBit, travelPx }.
// travelPx is the shortest travel from the entry that reaches both ends of the
// visited run of strips: a strip left of the entry is reached at its maxX, one
// right of it at its minX, and the nearer end is walked twice.
export function hmhV6DistrictTravel(seed, visitedDistrictMask) {
  const entry = hmhV6LevelEntry(seed);
  const entryBit = 2 ** entry.strip;
  if (visitedDistrictMask === 0) return { pathValid: true, entryBit, travelPx: 0 };
  const strips = V6C.districtStrips;
  const visited = strips.map((_, index) => Math.floor(visitedDistrictMask / 2 ** index) % 2 === 1);
  const first = visited.indexOf(true);
  const last = visited.lastIndexOf(true);
  const contiguous = Number.isSafeInteger(visitedDistrictMask) && visitedDistrictMask > 0 && visitedDistrictMask < 2 ** strips.length
    && visited.slice(first, last + 1).every(Boolean);
  if (!contiguous || first > entry.strip || last < entry.strip) return { pathValid: false, entryBit, travelPx: 0 };
  const left = first < entry.strip ? entry.x - strips[first][2] : 0;
  const right = last > entry.strip ? strips[last][1] - entry.x : 0;
  return { pathValid: true, entryBit, travelPx: left + right + Math.min(left, right) };
}

// The fewest ticks in which the travel budget covers `travelPx`.
export function hmhV6MinTicksForTravel(travelPx) {
  return Math.max(0, Math.ceil((travelPx - V6C.travel.allowancePx) / V6C.travel.maxStepPx));
}

function checkV6Consistency(runSummary, runTicks, reject) {
  const { identity, totals, kills, weapons, grenades, collectibles, exploration } = runSummary;
  const weaponKills = rowCounts(kills.byWeapon, 'weaponId', 'count');
  const grenadeWeaponKills = V6C.grenadeWeapons.reduce((sum, weaponId) => sum + (weaponKills[weaponId] ?? 0), 0);
  if (grenades.kills > grenadeWeaponKills) reject('grenade-kills-above-weapon-kills', grenades.kills, grenadeWeaponKills);

  const pickups = hmhV6PickupExcess(collectibles, runTicks, hmhV6ObjectiveUnlocks(runSummary));
  if (pickups) reject('pickups-above-capacity', pickups.value, pickups.limit);

  const districts = hmhV6DistrictTravel(identity.seed, exploration.visitedDistrictMask);
  const minTicks = hmhV6MinTicksForTravel(districts.travelPx);
  if (!districts.pathValid) reject('district-path-invalid', exploration.visitedDistrictMask, districts.entryBit);
  else if (runTicks < minTicks) reject('districts-before-travel-time', runTicks, minTicks);

  const timeless = runTicks === 0 ? Number(exploration.visitedDistrictMask !== 0) + Number(totals.damageDealt > 0) : 0;
  if (timeless) reject('activity-without-time', timeless, 0);

  const equippedTicks = weapons.reduce((sum, row) => sum + row.equippedTicks, 0);
  if (equippedTicks > runTicks) reject('equipped-ticks-above-run', equippedTicks, runTicks);

  const unsourced = hmhV6WeaponsWithoutSource(runSummary);
  if (unsourced.length) reject('weapon-without-source', unsourced.length, 0);

  if (grenades.kills > grenades.contacts) reject('grenade-kills-above-contacts', grenades.kills, grenades.contacts);
  const launches = grenades.thrown + (weapons.find((row) => row.weaponId === V6C.launcherWeapon)?.triggers ?? 0);
  if (grenades.detonated > launches) reject('grenade-detonations-above-launches', grenades.detonated, launches);
  const supply = hmhV6HandGrenadeSupply(runSummary);
  if (grenades.thrown > supply) reject('grenades-thrown-above-supply', grenades.thrown, supply);

  const weaponDamage = weapons.reduce((sum, row) => sum + row.damage, 0);
  if (totals.damageDealt !== weaponDamage) reject('damage-dealt-mismatch', totals.damageDealt, weaponDamage);

  if (totals.maxCombo > kills.total) reject('combo-above-kills', totals.maxCombo, kills.total);

  // The melee trail (round 3, item 1).
  const knife = weapons.find((row) => row.weaponId === V6C.melee.knifeWeapon);
  const standard = weapons.find((row) => row.weaponId === V6C.melee.standardWeapon);
  if (knife.kills > knife.projectileContacts) reject('knife-kills-above-contacts', knife.kills, knife.projectileContacts);
  const contactsWithoutTrigger = [knife, standard].filter((row) => row.projectileContacts > 0 && row.triggerContacts === 0).length;
  if (contactsWithoutTrigger) reject('melee-contacts-without-trigger', contactsWithoutTrigger, 0);
  const knifeSwings = hmhV6MeleeCadenceLimit(runTicks, V6C.melee.knifeCooldownTicks);
  if (knife.triggers > knifeSwings) reject('knife-triggers-above-cadence', knife.triggers, knifeSwings);
  const standardStrikes = hmhV6MeleeCadenceLimit(runTicks, V6C.melee.standardCooldownTicks);
  const standardClaimed = Math.max(standard.triggers, runSummary.forkedStandard?.attacks ?? 0);
  if (standardClaimed > standardStrikes) reject('standard-triggers-above-cadence', standardClaimed, standardStrikes);
}

// → { verdict: 'ok'|'flagged'|'rejected', flags: [{ id, severity: 'reject'|'flag', value, limit }] }
// Expects a summary that already passed validateRunSummaryPayload (schema 1-6).
export function validateV6RunPlausibility(runSummary) {
  const { reject, flag, done } = verdictCollector();
  const { identity, totals, kills, milestones, upgrades } = runSummary ?? {};
  if (!identity || !totals || !kills || !Array.isArray(kills.byEnemyRole) || !milestones || !Array.isArray(upgrades)
    || !Array.isArray(kills.byWeapon) || !runSummary.grenades || !Array.isArray(runSummary.collectibles) || !runSummary.exploration
    || !Array.isArray(runSummary.weapons)) {
    reject('summary-unreadable', null, null);
    return done();
  }
  const killsByRole = rowCounts(kills.byEnemyRole, 'enemyRoleId', 'count');
  const bossRoleKills = killsByRole[HMH_BOSS_ROLE_ID] ?? 0;
  const runTicks = checkRunTime(identity, totals, kills, V6.fixedStepMs, reject);

  if ((kills.boss > 0 || bossRoleKills > 0) && runTicks < HMH_BOSS_START_TICK) reject('boss-before-band', runTicks, HMH_BOSS_START_TICK);

  const expectedLevel = rebootLevelForXp(totals.xp);
  if (totals.level !== expectedLevel) reject('level-xp-mismatch', totals.level, expectedLevel);

  const capacity = spawnCapacity(runTicks);
  const bossCapacity = runTicks >= HMH_BOSS_START_TICK ? 1 : 0;
  if (kills.total > capacity) reject('kills-above-capacity', kills.total, capacity);
  else if (Math.max(kills.boss, bossRoleKills) > bossCapacity && runTicks >= HMH_BOSS_START_TICK) reject('kills-above-capacity', Math.max(kills.boss, bossRoleKills), bossCapacity);
  else if (kills.total > NEAR_CEILING_FRACTION * capacity) flag('kills-near-capacity', kills.total, capacity);

  const hard = ceilings(runSummary, MAX_GAINS);
  if (totals.xp > hard.xp) reject('xp-above-ceiling', totals.xp, hard.xp);
  else if (totals.xp > NEAR_CEILING_FRACTION * hard.xp) flag('xp-near-ceiling', totals.xp, hard.xp);
  if (totals.score > hard.score) reject('score-above-ceiling', totals.score, hard.score);
  else if (totals.score > NEAR_CEILING_FRACTION * hard.score) flag('score-near-ceiling', totals.score, hard.score);

  // Soft cross-checks against the run's own claimed upgrade picks.
  const selectedRanks = Object.fromEntries(upgrades.map((row) => [row.upgradeId, row.selected]));
  const selections = upgrades.reduce((sum, row) => sum + (row.selected ?? 0), 0);
  if (selections > totals.level - 1) flag('upgrades-exceed-levels', selections, totals.level - 1);
  const claimed = ceilings(runSummary, measureGains(selectedRanks));
  if (totals.xp > claimed.xp && totals.xp <= hard.xp) flag('xp-above-selected-upgrades', totals.xp, claimed.xp);
  if (totals.score > claimed.score && totals.score <= hard.score) flag('score-above-selected-upgrades', totals.score, claimed.score);
  if (totals.maxCombo > kills.total) flag('combo-exceeds-kills', totals.maxCombo, kills.total);
  if (kills.boss !== bossRoleKills) flag('boss-count-mismatch', kills.boss, bossRoleKills);
  if (milestones.bossEngagedTick > 0 && milestones.bossEngagedTick < HMH_BOSS_START_TICK) flag('boss-engaged-before-band', milestones.bossEngagedTick, HMH_BOSS_START_TICK);
  if (kills.boss > 0 && milestones.bossEngagedTick === 0) flag('boss-kill-without-engagement', kills.boss, 0);
  checkV6Consistency(runSummary, runTicks, reject);
  return done();
}

// ---------------------------------------------------------------------------
// The v7 path (contract §7). Inputs: the V7 catalogues and
// sdk/hmh-run-contract-v7.mjs only.
const V7 = HMH_V7_RUN_RULES;
const C7 = HMH_RUN_SUMMARY_CATALOGS_V7;
const BOSS = HMH_V7_BOSS_RULES;

// Per-event gains at the given claimed ranks. `xm` also multiplies objective
// XP, which depends on the node's level and is computed per row.
function measureV7Gains(ranks) {
  const xm = multiplierAt(clampedRank(ranks, 'validator-training', HMH_V7_UPGRADE_MAX_RANKS), V7.MULTIPLIER_PER_RANK);
  const sm = multiplierAt(clampedRank(ranks, 'block-reward', HMH_V7_UPGRADE_MAX_RANKS), V7.MULTIPLIER_PER_RANK);
  const killXp = {};
  const killScore = {};
  for (const [role, threat] of Object.entries(HMH_V7_ROLE_THREAT)) {
    killXp[role] = Math.round(hmhV7KillXp(threat) * xm);
    killScore[role] = Math.round(hmhV7KillScore(threat) * sm);
  }
  let comboXp = 0;
  let comboRate = 0;
  for (const [combo, baseXp] of Object.entries(V7.COMBO_MILESTONE_XP).map(([key, value]) => [Number(key), value]).sort(([a], [b]) => a - b)) {
    comboXp += Math.round(baseXp * xm);
    comboRate = Math.max(comboRate, comboXp / combo);
  }
  const cacheXp = Object.fromEntries(Object.entries(V7.CACHE_XP).map(([effectId, baseXp]) => [effectId, Math.round(baseXp * xm)]));
  const silverScorePerCoin = V7.SILVER_SCORE_PER_COIN * sm + 0.5;
  return Object.freeze({ xm, sm, killXp: Object.freeze(killXp), killScore: Object.freeze(killScore), comboRate, cacheXp: Object.freeze(cacheXp), silverScorePerCoin });
}

export const V7_MAX_GAINS = measureV7Gains(HMH_V7_UPGRADE_MAX_RANKS);

// The initiation ticks the row records (its first and last).
const initiationTicks = (row) => (row.initiations > 0 ? [...new Set([row.firstInitiatedTick, row.lastInitiatedTick])] : []);

// Whether boss slot `row` could insert its first adds (contract §5.3: none in
// the first BOSS_ADD_DELAY_TICKS of an engagement). A defeat or a retreat
// (a second initiation) means an engagement lasted at least the minimum fight
// or the retreat ring; one undefeated engagement lasts until the run ends or,
// at the latest, until another boss is initiated (one boss is live at a time).
export function hmhV7BossCouldSummon(row, bosses, runTicks) {
  if (!(row?.initiations > 0)) return false;
  if (row.initiations >= 2 || row.defeatedTick > 0) return true;
  let end = runTicks;
  for (const other of bosses) {
    if (other === row) continue;
    for (const tick of initiationTicks(other)) if (tick > row.lastInitiatedTick) end = Math.min(end, tick);
  }
  return end - row.lastInitiatedTick >= BOSS.BOSS_ADD_DELAY_TICKS;
}

// Kill capacity (contract §7.3): the opening enemies, every director schedule
// slot, one body per defeated boss, and the first BOSS_ADDS_FIRST adds of each
// boss slot that could summon. Every other body (scripted bodies and every
// further boss add) draws from the director's capacity bank, so no claimed
// boss timing, overlap or initiation count adds anything beyond these.
export function hmhV7KillCapacity(summary) {
  const runTicks = summary.totals.survivalTicks;
  let capacity = V7.OPENING_ENEMIES + directorSpawnCapacity(runTicks, V7.ENCOUNTER_BAND_SCHEDULE);
  for (const row of summary.bosses) {
    if (row.defeatedTick > 0) capacity += 1;
    if (hmhV7BossCouldSummon(row, summary.bosses, runTicks)) capacity += BOSS.BOSS_ADDS_FIRST;
  }
  return capacity;
}

// Pairs of bosses live at once (contract §5.3, one boss at a time): initiated
// on one tick, or one initiated during the other's final fight, which runs
// without a break from its last initiation to its defeat.
export function hmhV7BossOverlaps(bosses) {
  const initiated = bosses.filter((row) => row.initiations > 0);
  const inFight = (row, tick) => row.defeatedTick > 0 && row.lastInitiatedTick < tick && tick < row.defeatedTick;
  let pairs = 0;
  for (let a = 0; a < initiated.length; a += 1) {
    for (let b = a + 1; b < initiated.length; b += 1) {
      const [left, right] = [initiated[a], initiated[b]];
      const leftTicks = initiationTicks(left);
      const rightTicks = initiationTicks(right);
      if (leftTicks.some((tick) => rightTicks.includes(tick) || inFight(right, tick)) || rightTicks.some((tick) => inFight(left, tick))) pairs += 1;
    }
  }
  return pairs;
}

// The XP that completes level l: 150 x l x (l + 1) - 150 x (l - 1) x l = 300 x l.
const levelSpan = (level) => hmhV7LevelThreshold(level) - hmhV7LevelThreshold(level - 1);

// Node grants by the level each was claimed at → Map(level → { sum, max }). An
// objective grants its class's XP per level x that level through grantRunXp,
// so it is multiplied by xm; an OG Miner grants exactly 300 x level, never
// multiplied. The deal comes from the seed, never from the summary, so a rescue
// in a slot the deal gives another kind grants nothing.
function nodeGrantsByLevel(summary, xm) {
  const deal = dealHmhPrisoners(summary.identity.seed);
  const byLevel = new Map();
  const add = (level, xp) => {
    const entry = byLevel.get(level) ?? { sum: 0, max: 0 };
    entry.sum += xp;
    entry.max = Math.max(entry.max, xp);
    byLevel.set(level, entry);
  };
  for (const row of summary.objectives) {
    const node = HMH_V7_OBJECTIVES[row.objectiveId];
    if (row.completed === 1 && node) add(row.levelAtCompletion, Math.round(V7.OBJECTIVE_XP_PER_LEVEL[node.class] * row.levelAtCompletion * xm));
  }
  for (const row of summary.prisoners) {
    if (row.rescued === 1 && deal[C7.prisonerSlots.indexOf(row.slotId)] === 'og-miner') add(row.levelAtRescue, V7.OG_MINER_XP_PER_LEVEL * row.levelAtRescue);
  }
  return byLevel;
}

// Node XP against the levels it was claimed at (contract §7.4). A node is
// received at the level it claims and grants at least its x1 value (the
// multiplier is at least 1). At a level l below the final level L, every grant
// but the one that completes l fits in l's span of 300 x l XP; at L, every
// grant fits in the XP gained since reaching L. → the first level whose node
// XP does not fit, as { level, value, limit }, or null.
export function hmhV7NodeLevelExcess(summary) {
  const byLevel = nodeGrantsByLevel(summary, 1);
  const finalLevel = summary.totals.level;
  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const { sum, max } = byLevel.get(level);
    if (level < finalLevel) {
      if (sum - max > levelSpan(level) - 1) return { level, value: sum - max, limit: levelSpan(level) - 1 };
    } else if (sum > summary.totals.xp - hmhV7LevelThreshold(level - 1)) {
      return { level, value: sum, limit: summary.totals.xp - hmhV7LevelThreshold(level - 1) };
    }
  }
  return null;
}

// XP and score ceilings at the given gains (contract §7.4, §7.5).
export function hmhV7Ceilings(summary, gains) {
  const killsByRole = rowCounts(summary.kills.byEnemyRole, 'enemyRoleId', 'count');
  const collected = rowCounts(summary.collectibles, 'effectId', 'collected');
  let killXp = 0;
  let killScore = 0;
  for (const role of Object.keys(HMH_V7_ROLE_THREAT)) {
    killXp += (killsByRole[role] ?? 0) * gains.killXp[role];
    killScore += (killsByRole[role] ?? 0) * gains.killScore[role];
  }
  const comboXp = Math.ceil(summary.kills.total * gains.comboRate);
  const cacheXp = Object.entries(gains.cacheXp).reduce((sum, [effectId, xp]) => sum + (collected[effectId] ?? 0) * xp, 0);
  // Nodes (objectives, and OG Miners from the seeded deal), level by level: at
  // a level below the final one, the grants received there are at most the
  // level's own span less one, plus the grant that completes it.
  let nodeXp = 0;
  for (const [level, { sum, max }] of nodeGrantsByLevel(summary, gains.xm)) {
    nodeXp += level < summary.totals.level ? Math.min(sum, levelSpan(level) - 1 + max) : sum;
  }
  // Silver: at most one coin per ordinary kill, each defeated boss's burst (in
  // place of the 1.8.1 10-coin boss drop), and 20 per found secret.
  let bossKills = 0;
  let bossBursts = 0;
  for (const row of summary.bosses) {
    bossKills += killsByRole[row.bossId] ?? 0;
    if (row.defeatedTick > 0) bossBursts += HMH_V7_BOSSES[row.bossId]?.silverBurst ?? 0;
  }
  const secretsFound = summary.milestones.secrets.reduce((sum, row) => sum + (row.found === 1 ? 1 : 0), 0);
  const silverCoins = Math.max(0, summary.kills.total - bossKills) * V7.SILVER_PER_ENEMY_KILL_MAX + bossBursts + V7.SILVER_PER_SECRET * secretsFound;
  return {
    xp: killXp + comboXp + cacheXp + nodeXp,
    score: killScore + Math.ceil(silverCoins * gains.silverScorePerCoin),
  };
}

const bitSet = (mask, bit) => bit >= 0 && Math.floor(mask / 2 ** bit) % 2 === 1;

// → the same verdict shape as the v6 path. Expects a summary that already
// passed validateRunSummaryPayload (schema 7).
export function validateV7RunPlausibility(runSummary) {
  const { reject, flag, done } = verdictCollector();
  const { identity, totals, kills, milestones, upgrades, collectibles, exploration, objectives, prisoners, bosses, evolutions } = runSummary ?? {};
  if (!identity || !totals || !kills || !Array.isArray(kills.byEnemyRole) || !milestones || !Array.isArray(milestones.secrets) || !Array.isArray(upgrades)
    || !Array.isArray(collectibles) || !exploration || !Array.isArray(objectives) || !Array.isArray(prisoners) || !Array.isArray(bosses) || !Array.isArray(evolutions)
    || !Array.isArray(kills.byWeapon) || !runSummary.grenades) {
    reject('summary-unreadable', null, null);
    return done();
  }
  // Schema 7 comes only from a v7 child, which ships at game version 1.9.0 or
  // later: the session's build hash (bound to the seed ticket) labels the run,
  // so a 1.8.x-labelled run keeps the 1.8.x bounds. No clock is read.
  if (!isHmhV7Build(identity.buildHash)) reject('build-predates-schema-7', hmhGameVersionOfBuild(identity.buildHash)?.join('.') ?? null, HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION);
  const runTicks = checkRunTime(identity, totals, kills, V7.FIXED_STEP_MS, reject);

  const expectedLevel = hmhV7LevelForXp(totals.xp);
  if (totals.level !== expectedLevel) reject('level-xp-mismatch', totals.level, expectedLevel);

  // Per-boss timing replaces the 72,000-tick boss band: a boss exists from its
  // readyTick, a fight lasts at least the kit's invulnerable intro (if its
  // start has one) and phase halts, a retreat keeps a boss away for 2,520
  // ticks, and only one boss is live at a time.
  for (const row of bosses) {
    const readyTick = HMH_V7_BOSSES[row.bossId]?.readyTick ?? Infinity;
    if (row.initiations > 0 && row.firstInitiatedTick < readyTick) reject('boss-before-ready', row.firstInitiatedTick, readyTick);
  }
  for (const row of bosses) {
    const fight = row.defeatedTick - row.lastInitiatedTick;
    const minimum = HMH_V7_BOSSES[row.bossId]?.minFightTicks ?? Infinity;
    if (row.defeatedTick > 0 && fight < minimum) reject('boss-fight-too-short', fight, minimum);
  }
  for (const row of bosses) {
    const bound = (row.initiations - 1) * BOSS.BOSS_REINITIATION_MIN_TICKS;
    const span = row.lastInitiatedTick - row.firstInitiatedTick;
    if (row.initiations >= 2 && span < bound) reject('boss-reinitiation-too-soon', span, bound);
  }
  const overlaps = hmhV7BossOverlaps(bosses);
  if (overlaps) reject('boss-fights-overlap', overlaps, 0);

  const capacity = hmhV7KillCapacity(runSummary);
  if (kills.total > capacity) reject('kills-above-capacity', kills.total, capacity);
  else if (kills.total > NEAR_CEILING_FRACTION * capacity) flag('kills-near-capacity', kills.total, capacity);

  // A grenade kill is a kill of a grenade weapon (the v6 accumulator's rule,
  // which the v7 child keeps; HMH_V6_CONSISTENCY_RULES.grenadeWeapons).
  const weaponKills = rowCounts(kills.byWeapon, 'weaponId', 'count');
  const grenadeWeaponKills = V6C.grenadeWeapons.reduce((sum, weaponId) => sum + (weaponKills[weaponId] ?? 0), 0);
  if (runSummary.grenades.kills > grenadeWeaponKills) reject('grenade-kills-above-weapon-kills', runSummary.grenades.kills, grenadeWeaponKills);

  // Pickups come from at most 21 authored placements, re-armed no sooner than
  // every 7,200 ticks; the Genesis Seal's pickups are the Seals (schema S12).
  const pickups = collectibles.reduce((sum, row) => sum + (row.effectId === 'genesis-seal' ? 0 : row.collected), 0);
  const pickupCapacity = hmhV7CollectibleCapacity(runTicks);
  if (pickups > pickupCapacity) reject('collectibles-above-capacity', pickups, pickupCapacity);

  const excess = hmhV7NodeLevelExcess(runSummary);
  if (excess) reject('node-xp-above-level', excess.value, excess.limit);

  const hard = hmhV7Ceilings(runSummary, V7_MAX_GAINS);
  if (totals.xp > hard.xp) reject('xp-above-ceiling', totals.xp, hard.xp);
  else if (totals.xp > NEAR_CEILING_FRACTION * hard.xp) flag('xp-near-ceiling', totals.xp, hard.xp);
  if (totals.score > hard.score) reject('score-above-ceiling', totals.score, hard.score);
  else if (totals.score > NEAR_CEILING_FRACTION * hard.score) flag('score-near-ceiling', totals.score, hard.score);

  // Soft cross-checks: they flag honest-client bugs for owner review and never
  // reject, because none of them can raise a ceiling.
  const selected = Object.fromEntries(upgrades.map((row) => [row.upgradeId, row.selected]));
  const claimed = hmhV7Ceilings(runSummary, measureV7Gains(selected));
  if (totals.xp > claimed.xp && totals.xp <= hard.xp) flag('xp-above-selected-upgrades', totals.xp, claimed.xp);
  if (totals.score > claimed.score && totals.score <= hard.score) flag('score-above-selected-upgrades', totals.score, claimed.score);
  if (totals.maxCombo > kills.total) flag('combo-exceeds-kills', totals.maxCombo, kills.total);

  const aboveMaxRank = upgrades.filter((row) => row.selected > (HMH_V7_UPGRADE_MAX_RANKS[row.upgradeId] ?? Infinity)).length;
  if (aboveMaxRank) flag('upgrade-rank-above-max', aboveMaxRank, 0);

  const withoutMastery = evolutions.filter((row) => row.applied === 1
    && Object.entries(HMH_V7_EVOLUTIONS[row.evolutionId]?.mastery ?? {}).some(([upgradeId, rank]) => !((selected[upgradeId] ?? 0) >= rank))).length;
  if (withoutMastery) flag('evolution-without-mastery', withoutMastery, 0);

  // Node levels (the level before each node's own grant) never fall as ticks
  // rise, exceed 1 only from the first level-up, and stay below the final
  // level only up to the last level-up.
  const nodes = [
    ...objectives.filter((row) => row.completed === 1).map((row) => ({ tick: row.tick, level: row.levelAtCompletion })),
    ...prisoners.filter((row) => row.rescued === 1).map((row) => ({ tick: row.tick, level: row.levelAtRescue })),
  ].sort((a, b) => a.tick - b.tick || a.level - b.level);
  let levelBefore = 0;
  let levelAtTick = 0;
  let tick = -1;
  let outOfOrder = 0;
  for (const node of nodes) {
    if (node.tick !== tick) {
      levelBefore = Math.max(levelBefore, levelAtTick);
      levelAtTick = 0;
      tick = node.tick;
    }
    levelAtTick = Math.max(levelAtTick, node.level);
    if (node.level < levelBefore
      || (node.level >= 2 && node.tick < milestones.firstLevelUpTick)
      || (node.level < totals.level && node.tick > milestones.lastLevelUpTick)) outOfOrder += 1;
  }
  if (outOfOrder) flag('node-level-inconsistent', outOfOrder, 0);

  const objectiveRows = Object.fromEntries(objectives.map((row) => [row.objectiveId, row]));
  const prerequisiteMissing = objectives.filter((row) => {
    const requires = HMH_V7_OBJECTIVES[row.objectiveId]?.requires;
    const before = requires ? objectiveRows[requires] : null;
    return row.completed === 1 && requires && !(before?.completed === 1 && before.tick <= row.tick);
  }).length;
  if (prerequisiteMissing) flag('objective-prerequisite-missing', prerequisiteMissing, 0);

  const visited = (district) => bitSet(exploration.visitedDistrictMask, C7.districts.indexOf(district));
  const unvisited = objectives.filter((row) => row.completed === 1 && !visited(HMH_V7_OBJECTIVES[row.objectiveId]?.district)).length
    + prisoners.filter((row) => row.rescued === 1 && !visited(HMH_V7_PRISONER_SLOTS[row.slotId]?.district)).length
    + bosses.filter((row) => row.initiations > 0 && !visited(HMH_V7_BOSSES[row.bossId]?.district)).length;
  if (unvisited) flag('node-in-unvisited-district', unvisited, 0);
  return done();
}

// The summary's schemaVersion picks the rules: 7 runs the v7 path, anything
// else the frozen v6 path.
export function validateRebootRunPlausibility(runSummary) {
  return runSummary?.schemaVersion === 7 ? validateV7RunPlausibility(runSummary) : validateV6RunPlausibility(runSummary);
}
