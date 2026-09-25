// Reboot-calibrated plausibility for Hard Money Heroes Ranked runs (contract
// §5.3, A9; feasibility review F1). Server only.
//
// HMH is plausibility-checked, not replayed. This validator rejects only hard
// impossibilities and flags everything else near a ceiling for owner review.
// It reads no clock.
//
// The v6 rules verify the 1.8.x children (run summary schema 1-6) with the
// literal 1.8.1 constants of HMH_V6_RULES, indefinitely. Parity tests pin
// every literal against the 1.8.1 child modules; from here on the literal, not
// the live child, is the v6 authority, so a later child change cannot move a
// v6 bound (run summary v7 contract, docs/hmh-reboot/design/
// HMH-RUN-SUMMARY-V7-CONTRACT.md §9).
//
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
// Flags have the shape { id, severity, value, limit }.
import { HMH_RUN_SUMMARY_CATALOGS_V6 } from '../../sdk/hmh-run-summary-schema.mjs';

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

// The Liquidator starts at the boss band.
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
// spanning s ticks holds at most floor(s / interval) + 1 of them.
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

// → the verdict of the rules for the summary's schema version.
export function validateRebootRunPlausibility(runSummary) {
  return validateV6RunPlausibility(runSummary);
}
