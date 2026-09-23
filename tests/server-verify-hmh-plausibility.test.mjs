import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMBO_MILESTONES,
  HMH_BOSS_START_TICK,
  HMH_ROLE_THREAT,
  LIQUIDATOR_THREAT_COST,
  MAX_GAINS,
  MAX_UPGRADE_RANKS,
  OBJECTIVE_REWARD_XP,
  SILVER_PER_BOSS_KILL,
  SILVER_PER_ENEMY_KILL,
  directorSpawnCapacity,
  liquidatorAddCapacity,
  rebootLevelForXp,
  rebootLevelThreshold,
  spawnCapacity,
  validateRebootRunPlausibility,
} from '../server/verify/hmh-plausibility.mjs';
import { createRunProgression, getRunProgressionSnapshot, grantRunXp } from '../apps/hmh-reboot/src/run-progression.mjs';
import { ENCOUNTER_BANDS } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { COLLECTIBLE_EFFECTS } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { objectiveRewardPlacements } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { addSilverDrop, createSilverDropState } from '../apps/hmh-reboot/src/silver-drops.mjs';
import { FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
import { readFixture } from './fixtures/ranked/build-fixtures.mjs';

const MAIN_SOURCE = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const valid = readFixture('hmh-valid').body.evidence.runSummary;
const realistic = readFixture('hmh-realistic').body.evidence.runSummary;
const level90 = readFixture('hmh-level-90').body.evidence.runSummary;
const clone = (summary, mutate) => {
  const copy = structuredClone(summary);
  mutate(copy);
  return copy;
};
const rejects = (result) => result.flags.filter((flag) => flag.severity === 'reject').map((flag) => flag.id);
const setRoleKills = (summary, role, count) => {
  const entry = summary.kills.byEnemyRole.find((row) => row.enemyRoleId === role);
  summary.kills.total += count - entry.count;
  entry.count = count;
};

test('constants copied from the reboot main module match its source', () => {
  assert.match(MAIN_SOURCE, new RegExp(`const LIQUIDATOR_THREAT_COST = ${LIQUIDATOR_THREAT_COST};`));
  assert.match(MAIN_SOURCE, /startTick: bossDebugEnabled \? 1 : 72_000,/);
  assert.equal(HMH_BOSS_START_TICK, 72_000);
  assert.equal(ENCOUNTER_BANDS.find((band) => band.id === 'boss').minTick, HMH_BOSS_START_TICK);
  // Boss kill: a 10-coin drop. Enemy kill: addSilverDrop's default value.
  assert.match(MAIN_SOURCE, new RegExp(`addSilverDrop\\(silverDropState,\\{sequence:runKills\\+1,tick,x:liquidatorBoss\\.x,y:liquidatorBoss\\.y,value:${SILVER_PER_BOSS_KILL}\\}\\)`));
  assert.match(MAIN_SOURCE, /addSilverDrop\(silverDropState,\{sequence:runKills,tick,x:defeatedEnemy\.x,y:defeatedEnemy\.y\}\)/);
  const drops = createSilverDropState();
  addSilverDrop(drops, { sequence: 1, tick: 0, x: 0, y: 0 });
  assert.equal(drops.dropped, SILVER_PER_ENEMY_KILL);
  // Kill XP and score go through recordRunDefeat with the archetype (or boss) threat.
  assert.match(MAIN_SOURCE, /threatCost: LIQUIDATOR_THREAT_COST,/);
  assert.match(MAIN_SOURCE, /threatCost: ENEMY_ARCHETYPES\[defeatedEnemy\.archetypeId\]\.costs\.threat,/);
  // The summary's elapsedMs is the fixed-step simulation time of its end tick.
  assert.match(MAIN_SOURCE, /endTick: simulation\.tick,\s*elapsedMs: simulation\.timeMs,/);
  assert.match(readFileSync(new URL('../apps/hmh-reboot/src/simulation.mjs', import.meta.url), 'utf8'), /get timeMs\(\) \{\s*return this\.tick \* this\.fixedStepMs;/);
});

test('the level curve matches run-progression', () => {
  const levelViaReboot = (xp) => {
    const state = createRunProgression({ seed: 0 });
    for (let remaining = xp; remaining > 0; remaining -= Math.min(remaining, 1_000_000)) grantRunXp(state, Math.min(remaining, 1_000_000), 0);
    return getRunProgressionSnapshot(state).level;
  };
  for (const level of [1, 2, 3, 10, 23, 79, 80, 81, 90, 200]) {
    const threshold = rebootLevelThreshold(level);
    assert.equal(threshold, 150 * level * (level + 1));
    for (const xp of [threshold - 1, threshold, threshold + 1]) assert.equal(rebootLevelForXp(xp), levelViaReboot(xp), `xp ${xp}`);
  }
  assert.equal(rebootLevelForXp(0), 1);
  assert.equal(rebootLevelForXp(rebootLevelThreshold(999)), 1000);
  assert.equal(rebootLevelForXp(1e12), 1000, 'levels run to 1000');
});

test('ceilings are the reboot gains at the maximum ranks (§5.3 formulas)', () => {
  const xpMultiplier = 1 + 0.25 * MAX_UPGRADE_RANKS['validator-training'];
  const scoreMultiplier = 1 + 0.25 * MAX_UPGRADE_RANKS['block-reward'];
  assert.equal(xpMultiplier, 1.75);
  assert.equal(scoreMultiplier, 1.75);
  for (const [role, threat] of Object.entries(HMH_ROLE_THREAT)) {
    assert.equal(MAX_GAINS.killXp[role], Math.round((80 + 20 * threat) * xpMultiplier), role);
    assert.equal(MAX_GAINS.killScore[role], Math.round((100 + 25 * threat) * scoreMultiplier), role);
  }
  assert.deepEqual(COMBO_MILESTONES.map(({ combo, baseXp }) => [combo, baseXp]), [[5, 120], [10, 240], [20, 480], [30, 900]]);
  assert.equal(MAX_GAINS.comboRate, [120, 240, 480, 900].reduce((sum, xp) => sum + Math.round(xp * xpMultiplier), 0) / 30);
  for (const effect of Object.values(COLLECTIBLE_EFFECTS).filter((entry) => entry.xpGain)) {
    assert.ok(effect.xpGain >= 160 && effect.xpGain <= 260);
    assert.equal(MAX_GAINS.cacheXp[effect.effectId], Math.round(effect.xpGain * xpMultiplier));
  }
  assert.equal(MAX_GAINS.silverScorePerCoin, 10 * scoreMultiplier + 0.5);
});

test('objective rewards grant no XP or score', () => {
  assert.equal(OBJECTIVE_REWARD_XP, 0);
  assert.ok(objectiveRewardPlacements().every((placement) => placement.xpGain === 0));
});

test('spawn capacity bounds the director schedule', () => {
  // The earliest possible insertion schedule: every insertion as soon as it is due.
  const scheduled = (endTick) => {
    let count = 0;
    for (let tick = 0; tick <= endTick;) {
      const band = ENCOUNTER_BANDS.find((entry) => tick >= entry.minTick && tick <= entry.maxTick);
      count += 1;
      tick += band.spawnIntervalTicks;
    }
    return count;
  };
  for (const endTick of [0, 599, 3_599, 3_600, 17_999, 36_000, 71_999, 72_000, 75_599, 75_600, 100_000, 216_000]) {
    assert.ok(scheduled(endTick) <= directorSpawnCapacity(endTick), `tick ${endTick}`);
  }
  assert.equal(liquidatorAddCapacity(-1), 0);
  assert.equal(liquidatorAddCapacity(1_799), 0);
  assert.equal(liquidatorAddCapacity(1_800), 6);
  assert.equal(liquidatorAddCapacity(2_820), 12);
  assert.equal(spawnCapacity(HMH_BOSS_START_TICK) - spawnCapacity(HMH_BOSS_START_TICK - 1), 1 + directorSpawnCapacity(HMH_BOSS_START_TICK) - directorSpawnCapacity(HMH_BOSS_START_TICK - 1), 'the boss adds one body at its start');
});

test('fixtures pass, and each hard impossibility rejects', () => {
  assert.equal(validateRebootRunPlausibility(valid).verdict, 'ok');
  assert.equal(validateRebootRunPlausibility(realistic).verdict, 'ok');
  assert.notEqual(validateRebootRunPlausibility(level90).verdict, 'rejected');

  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(valid, (s) => { s.totals.elapsedMs = 0; }))), ['progress-without-time', 'elapsed-time-mismatch']);
  const noTime = validateRebootRunPlausibility(clone(valid, (s) => { s.identity.endTick = 0; s.totals.survivalTicks = 0; s.totals.elapsedMs = 0; }));
  assert.ok(rejects(noTime).includes('progress-without-time'), JSON.stringify(noTime.flags));
  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(valid, (s) => { s.totals.elapsedMs = s.totals.survivalTicks * FIXED_STEP_MS / 2; }))), ['elapsed-time-mismatch']);
  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(valid, (s) => { s.totals.elapsedMs = s.identity.endTick * FIXED_STEP_MS + 5_000; }))), ['elapsed-time-mismatch']);
  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(valid, (s) => { s.totals.level += 1; }))), ['level-xp-mismatch']);
  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(valid, (s) => { setRoleKills(s, 'liquidator', 1); s.kills.boss = 1; }))), ['boss-before-band']);
  const capacity = spawnCapacity(valid.identity.endTick);
  assert.ok(rejects(validateRebootRunPlausibility(clone(valid, (s) => setRoleKills(s, 'forkrunner', capacity)))).includes('kills-above-capacity'));
  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(level90, (s) => { setRoleKills(s, 'liquidator', 2); s.kills.boss = 2; }))), ['kills-above-capacity']);
  const xpCeiling = validateRebootRunPlausibility(clone(realistic, (s) => { s.totals.xp *= 5; s.totals.level = rebootLevelForXp(s.totals.xp); })).flags.find((flag) => flag.id === 'xp-above-ceiling');
  assert.equal(xpCeiling.severity, 'reject');
  const scoreCeiling = validateRebootRunPlausibility(clone(realistic, (s) => { s.totals.score *= 5; })).flags.find((flag) => flag.id === 'score-above-ceiling');
  assert.equal(scoreCeiling.severity, 'reject');
  // Exactly at a ceiling is not above it.
  const atCeiling = validateRebootRunPlausibility(clone(realistic, (s) => { s.totals.score = scoreCeiling.limit; }));
  assert.equal(atCeiling.verdict, 'flagged');
  assert.deepEqual(rejects(validateRebootRunPlausibility(null)), ['summary-unreadable']);
});

test('soft cross-checks flag without rejecting', () => {
  const flagIds = (summary) => {
    const result = validateRebootRunPlausibility(summary);
    assert.equal(result.verdict, 'flagged');
    return result.flags.map((flag) => flag.id);
  };
  assert.ok(flagIds(clone(valid, (s) => { s.totals.maxCombo = s.kills.total + 5; s.totals.currentCombo = 0; })).includes('combo-exceeds-kills'));
  assert.ok(flagIds(clone(valid, (s) => { s.upgrades[0].offered += 20; s.upgrades[0].selected += 20; })).includes('upgrades-exceed-levels'));
  assert.ok(flagIds(clone(level90, (s) => { s.kills.boss = 0; })).includes('boss-count-mismatch'));
  assert.ok(flagIds(clone(valid, (s) => { s.milestones.bossEngagedTick = 600; })).includes('boss-engaged-before-band'));
  assert.ok(flagIds(clone(realistic, (s) => { s.totals.xp = Math.floor(s.totals.xp * 1.3); s.totals.level = rebootLevelForXp(s.totals.xp); })).includes('xp-above-selected-upgrades'));
});
