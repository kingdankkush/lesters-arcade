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

// → { verdict: 'ok'|'flagged'|'rejected', flags: [{ id, severity: 'reject'|'flag', value, limit }] }
// Expects a summary that already passed validateRunSummaryPayload (schema 1-6).
export function validateV6RunPlausibility(runSummary) {
  const { reject, flag, done } = verdictCollector();
  const { identity, totals, kills, milestones, upgrades } = runSummary ?? {};
  if (!identity || !totals || !kills || !Array.isArray(kills.byEnemyRole) || !milestones || !Array.isArray(upgrades)) {
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
    || !Array.isArray(collectibles) || !exploration || !Array.isArray(objectives) || !Array.isArray(prisoners) || !Array.isArray(bosses) || !Array.isArray(evolutions)) {
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
