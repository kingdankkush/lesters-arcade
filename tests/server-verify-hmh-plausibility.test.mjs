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
import { ENCOUNTER_BANDS, createEncounterDirector, directorViewBounds, stepEncounterDirector } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { createEnemyPopulation, retireEnemyFromPopulation } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
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
// A summary whose identity claims it started `span` ticks before its end tick.
const shiftedStart = (summary, span) => clone(summary, (s) => {
  s.identity.startTick = s.identity.endTick - span;
  s.totals.survivalTicks = span;
  s.totals.elapsedMs = span * FIXED_STEP_MS;
});

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
  // Every run starts at tick 0: one accumulator, created with startTick 0 right
  // after a fresh DeterministicSimulation (whose tick starts at 0).
  assert.equal(MAIN_SOURCE.match(/createRunSummaryAccumulator\(/g).length, 1);
  const accumulatorCall = MAIN_SOURCE.match(/runSummaryAccumulator = createRunSummaryAccumulator\(\{[^}]*\}\);/)?.[0] ?? '';
  assert.match(accumulatorCall, /\bstartTick: 0,/);
  const freshSimulation = MAIN_SOURCE.indexOf('simulation = new DeterministicSimulation({ seed: payload.session.seed });');
  assert.ok(freshSimulation > 0 && freshSimulation < MAIN_SOURCE.indexOf(accumulatorCall), 'the accumulator is created after the fresh simulation');
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

test('spawn capacity bounds the real encounter director', () => {
  // The real stepEncounterDirector with permissive callbacks: one valid spawn
  // point far off camera, open ground, and every enemy retired as soon as it is
  // inserted, so no cap ever holds an insertion back.
  const player = { x: 0, y: 0, groundZ: 0 };
  const spawnPoints = [{ id: 'probe-point', regionId: 'probe-region', districtId: 'mining-camp', x: 5_000, y: 5_000 }];
  const drive = (nextSpawnTick, lastTick, checkpoints = []) => {
    const state = createEncounterDirector({ nextSpawnTick, seed: 1337 });
    const population = createEnemyPopulation();
    const inserted = new Map();
    for (let tick = 0; tick <= lastTick; tick += 1) {
      const step = stepEncounterDirector({
        state, population, tick, districtId: 'mining-camp', player, camera: directorViewBounds(player), spawnPoints,
        queryGround: () => ({ groundZ: 0, kind: 'ground' }), isBlocked: () => false, isRouteReachable: () => true,
      });
      if (step.inserted) retireEnemyFromPopulation(population, step.enemyId, { tick });
      if (state.insertedCount > directorSpawnCapacity(tick)) assert.fail(`tick ${tick}: ${state.insertedCount} insertions > capacity ${directorSpawnCapacity(tick)}`);
      if (checkpoints.includes(tick)) inserted.set(tick, state.insertedCount);
    }
    assert.equal(state.rejectedCount, 0, 'nothing held an insertion back');
    return inserted;
  };
  // From nextSpawnTick 0 the director inserts exactly the capacity: the bound is tight.
  const checkpoints = [0, 3_599, 3_600, 17_999, 35_999, 71_999, 72_000, 75_599, 100_000, 150_000];
  const fromZero = drive(0, 150_000, checkpoints);
  for (const tick of checkpoints) assert.equal(fromZero.get(tick), directorSpawnCapacity(tick), `tick ${tick}`);
  // The game's own start (nextSpawnTick 600) stays under it.
  const fromGameStart = drive(600, 80_000, [80_000]);
  assert.ok(fromGameStart.get(80_000) <= directorSpawnCapacity(80_000));
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

test('a run that does not start at tick 0 is rejected, and every tick bound uses the elapsed ticks', () => {
  // A start tick other than 0 is fabricated, even with consistent totals.
  assert.deepEqual(rejects(validateRebootRunPlausibility(shiftedStart(valid, valid.identity.endTick - 1))), ['start-tick-invalid']);
  // Moving the start without the time: the elapsed time no longer matches the run's ticks.
  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(valid, (s) => { s.identity.startTick = 1; s.totals.survivalTicks -= 1; }))), ['start-tick-invalid', 'elapsed-time-mismatch']);
  // The level-90 boss run squeezed into one second: a far end tick buys neither
  // the kill capacity nor the boss band.
  const squeezed = validateRebootRunPlausibility(shiftedStart(level90, 60));
  assert.deepEqual(rejects(squeezed), ['start-tick-invalid', 'boss-before-band', 'kills-above-capacity']);
  assert.deepEqual(squeezed.flags.find((flag) => flag.id === 'kills-above-capacity').limit, spawnCapacity(60));
  // The realistic run claimed as 20 seconds.
  assert.deepEqual(rejects(validateRebootRunPlausibility(shiftedStart(realistic, 1_200))), ['start-tick-invalid', 'kills-above-capacity']);
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
