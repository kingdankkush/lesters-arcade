// Reboot-calibrated plausibility for Hard Money Heroes Ranked runs (contract
// §5.3, A9; feasibility review F1). Server only.
//
// HMH is plausibility-checked, not replayed. This validator rejects only hard
// impossibilities and flags everything else near a ceiling for owner review:
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
//
// Every ceiling is computed by the pure reboot modules themselves: the per-kill,
// combo, cache and silver gains are measured by running recordRunDefeat,
// grantRunXp and grantRunSilver on a progression state whose upgrade ranks are
// all at maxRank. The few constants that live only in the reboot's main.mjs (a
// Pixi/DOM module) are copied below and pinned by parity tests.
import {
  RUN_UPGRADE_CATALOG,
  SILVER_SCORE_PER_COIN,
  comboMilestoneXp,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunXp,
  recordRunDefeat,
} from '../../apps/hmh-reboot/src/run-progression.mjs';
import { ENEMY_ARCHETYPES } from '../../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { COLLECTIBLE_EFFECTS } from '../../apps/hmh-reboot/src/collectible-system.mjs';
import { ENCOUNTER_BANDS } from '../../apps/hmh-reboot/src/encounter-director.mjs';
import { objectiveRewardPlacements } from '../../apps/hmh-reboot/src/objective-rewards.mjs';
import { HMH_OPENING_ENEMY_ARCHETYPE_IDS } from '../../apps/hmh-reboot/src/opening-balance.mjs';
import {
  LIQUIDATOR_ATTACK_PLAN,
  LIQUIDATOR_ENDLESS_CYCLE,
  LIQUIDATOR_ENDLESS_CYCLE_TICKS,
  LIQUIDATOR_ENDLESS_LOOP_START_TICK,
  LIQUIDATOR_READABILITY_BUDGET,
} from '../../apps/hmh-reboot/src/liquidator-boss.mjs';
import { FIXED_STEP_MS } from '../../apps/hmh-reboot/src/simulation.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../../sdk/hmh-run-summary-schema.mjs';

// Copied from apps/hmh-reboot/src/main.mjs (parity tests read that source):
// `const LIQUIDATOR_THREAT_COST = 48;`, the boss silver drop `value:10`, and the
// enemy drop that uses addSilverDrop's default value of 1 (silver-drops.mjs).
export const LIQUIDATOR_THREAT_COST = 48;
export const SILVER_PER_BOSS_KILL = 10;
export const SILVER_PER_ENEMY_KILL = 1;

export const HMH_BOSS_ROLE_ID = 'liquidator';
export const HMH_MAX_LEVEL = 1000;
export const NEAR_CEILING_FRACTION = 0.9;
const ELAPSED_TOLERANCE_MS = 1;

const BOSS_BAND = ENCOUNTER_BANDS.find((band) => band.id === 'boss');
if (!BOSS_BAND) throw new Error('encounter-director has no boss band');
// The Liquidator starts at the boss band (main.mjs createLiquidatorBoss startTick 72_000; parity test).
export const HMH_BOSS_START_TICK = BOSS_BAND.minTick;

// Threat per summary enemy role: the archetype's costs.threat, and the boss's.
export const HMH_ROLE_THREAT = Object.freeze(Object.fromEntries(HMH_RUN_SUMMARY_CATALOGS.enemyRoles.map((role) => {
  if (role === HMH_BOSS_ROLE_ID) return [role, LIQUIDATOR_THREAT_COST];
  const archetype = ENEMY_ARCHETYPES[role];
  if (!Number.isInteger(archetype?.costs?.threat)) throw new Error(`enemy role ${role} has no archetype threat`);
  return [role, archetype.costs.threat];
})));

// XP-granting caches by summary effect id (objective placements grant 0; this
// bound counts every collection, which is generous).
const CACHE_XP_BASE = Object.freeze(Object.fromEntries(Object.values(COLLECTIBLE_EFFECTS)
  .filter((effect) => Number.isInteger(effect.xpGain) && effect.xpGain > 0)
  .map((effect) => [effect.effectId, effect.xpGain])));
// Objective rewards grant items only: objectiveRewardPlacements() carries xpGain 0
// and nothing in the reboot turns an objective into score. Kept as a term so a
// future grant shows up in the parity test.
export const OBJECTIVE_REWARD_XP = Math.max(0, ...objectiveRewardPlacements().map((placement) => placement.xpGain ?? 0));
export const OBJECTIVE_REWARD_SCORE = 0;

// Combo milestones: every combo value with a non-zero comboMilestoneXp.
const COMBO_SCAN_LIMIT = 10_000;
export const COMBO_MILESTONES = Object.freeze(Array.from({ length: COMBO_SCAN_LIMIT }, (_, index) => index + 1)
  .filter((combo) => comboMilestoneXp(combo) > 0)
  .map((combo) => Object.freeze({ combo, baseXp: comboMilestoneXp(combo) })));

export const MAX_UPGRADE_RANKS = Object.freeze(Object.fromEntries(Object.values(RUN_UPGRADE_CATALOG).map((upgrade) => [upgrade.id, upgrade.maxRank])));

function progressionWithRanks(ranks) {
  const state = createRunProgression({ seed: 0 });
  for (const [id, rank] of Object.entries(ranks)) {
    if (Object.hasOwn(state.ranks, id)) state.ranks[id] = Math.max(0, Math.min(MAX_UPGRADE_RANKS[id], rank));
  }
  return state;
}

// Per-event gains measured with the reboot's own functions at the given ranks.
function measureGains(ranks) {
  const killXp = {};
  const killScore = {};
  for (const [role, threat] of Object.entries(HMH_ROLE_THREAT)) {
    const snapshot = recordRunDefeat(progressionWithRanks(ranks), { enemyId: 'plausibility-probe', threatCost: threat, tick: 0 });
    killXp[role] = snapshot.xp;
    killScore[role] = snapshot.score;
  }
  let comboXp = 0;
  let comboRate = 0;
  for (const { combo, baseXp } of COMBO_MILESTONES) {
    comboXp += grantRunXp(progressionWithRanks(ranks), baseXp, 0).xp;
    comboRate = Math.max(comboRate, comboXp / combo);
  }
  const cacheXp = Object.fromEntries(Object.entries(CACHE_XP_BASE).map(([effectId, baseXp]) => [effectId, grantRunXp(progressionWithRanks(ranks), baseXp, 0).xp]));
  const { scoreMultiplier } = getRunProgressionSnapshot(progressionWithRanks(ranks)).effects;
  // One silver grant of c coins is round(c x SILVER_SCORE_PER_COIN x multiplier),
  // at most c x (SILVER_SCORE_PER_COIN x multiplier + 0.5) for c >= 1.
  const silverScorePerCoin = SILVER_SCORE_PER_COIN * scoreMultiplier + 0.5;
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
export function directorSpawnCapacity(endTick) {
  let total = 0;
  for (const band of ENCOUNTER_BANDS) {
    if (endTick < band.minTick) break;
    const last = Math.min(endTick, band.maxTick);
    total += Math.floor((last - band.minTick) / band.spawnIntervalTicks) + 1;
  }
  return total;
}

// Liquidator bad-debt summons up to `bossElapsed` boss ticks, each inserting at
// most LIQUIDATOR_READABILITY_BUDGET.activeAdds adds.
export function liquidatorAddCapacity(bossElapsed) {
  if (bossElapsed < 0) return 0;
  const isSummon = (entry) => entry.attackId === 'bad-debt-summon';
  let summons = LIQUIDATOR_ATTACK_PLAN.filter((entry) => isSummon(entry) && entry.startTick <= Math.min(bossElapsed, LIQUIDATOR_ENDLESS_LOOP_START_TICK - 1)).length;
  if (bossElapsed >= LIQUIDATOR_ENDLESS_LOOP_START_TICK) {
    const loopTick = bossElapsed - LIQUIDATOR_ENDLESS_LOOP_START_TICK;
    const perCycle = LIQUIDATOR_ENDLESS_CYCLE.filter(isSummon);
    summons += Math.floor(loopTick / LIQUIDATOR_ENDLESS_CYCLE_TICKS) * perCycle.length
      + perCycle.filter((entry) => entry.offset <= loopTick % LIQUIDATOR_ENDLESS_CYCLE_TICKS).length;
  }
  return summons * LIQUIDATOR_READABILITY_BUDGET.activeAdds;
}

export function spawnCapacity(endTick) {
  const bossPresent = endTick >= HMH_BOSS_START_TICK;
  return HMH_OPENING_ENEMY_ARCHETYPE_IDS.length
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

// → { verdict: 'ok'|'flagged'|'rejected', flags: [{ id, severity: 'reject'|'flag', value, limit }] }
// Expects a summary that already passed validateRunSummaryPayload (schema 6).
export function validateRebootRunPlausibility(runSummary) {
  const flags = [];
  const reject = (id, value, limit) => flags.push(Object.freeze({ id, severity: 'reject', value, limit }));
  const flag = (id, value, limit) => flags.push(Object.freeze({ id, severity: 'flag', value, limit }));
  const done = () => Object.freeze({
    verdict: flags.some((entry) => entry.severity === 'reject') ? 'rejected' : flags.length ? 'flagged' : 'ok',
    flags: Object.freeze(flags),
  });
  const { identity, totals, kills, milestones, upgrades } = runSummary ?? {};
  if (!identity || !totals || !kills || !Array.isArray(kills.byEnemyRole) || !milestones || !Array.isArray(upgrades)) {
    reject('summary-unreadable', null, null);
    return done();
  }
  const killsByRole = rowCounts(kills.byEnemyRole, 'enemyRoleId', 'count');
  const bossRoleKills = killsByRole[HMH_BOSS_ROLE_ID] ?? 0;

  // The reboot creates the accumulator with startTick: 0 on a fresh
  // DeterministicSimulation for every run (main.mjs; parity test), so a
  // non-zero start is fabricated: it would let a summary claim the end tick
  // (spawn capacity, boss band) of a long run with the elapsed time of a short
  // one. Every tick bound below uses the run's elapsed ticks, never endTick.
  if (identity.startTick !== 0) reject('start-tick-invalid', identity.startTick, 0);
  const runTicks = totals.survivalTicks;

  const progress = kills.total > 0 || totals.score > 0 || totals.xp > 0 || totals.level > 1 || totals.litecoin > 0;
  if (progress && (runTicks === 0 || totals.elapsedMs === 0)) reject('progress-without-time', totals.elapsedMs, 0);

  const expectedMs = runTicks * FIXED_STEP_MS;
  if (Math.abs(totals.elapsedMs - expectedMs) > ELAPSED_TOLERANCE_MS) reject('elapsed-time-mismatch', totals.elapsedMs, expectedMs);

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
