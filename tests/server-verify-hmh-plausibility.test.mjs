import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  COMBO_MILESTONES,
  HMH_BOSS_START_TICK,
  HMH_MAX_LEVEL,
  HMH_ROLE_THREAT,
  HMH_V6_RULES,
  LIQUIDATOR_THREAT_COST,
  MAX_GAINS,
  MAX_UPGRADE_RANKS,
  OBJECTIVE_REWARD_SCORE,
  OBJECTIVE_REWARD_XP,
  SILVER_PER_BOSS_KILL,
  SILVER_PER_ENEMY_KILL,
  directorSpawnCapacity,
  liquidatorAddCapacity,
  rebootLevelForXp,
  rebootLevelThreshold,
  V7_MAX_GAINS,
  hmhV7BossWindowTicks,
  hmhV7Ceilings,
  hmhV7KillCapacity,
  spawnCapacity,
  validateRebootRunPlausibility,
  validateV6RunPlausibility,
} from '../server/verify/hmh-plausibility.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V6, HMH_RUN_SUMMARY_CATALOGS_V7, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v7.mjs';
import {
  HMH_PRISONER_KINDS,
  HMH_V7_BOSSES,
  HMH_V7_BOSS_RULES,
  HMH_V7_EVOLUTIONS,
  HMH_V7_OBJECTIVES,
  HMH_V7_PRISONER_SLOTS,
  HMH_V7_ROLE_THREAT,
  HMH_V7_RUN_RULES,
  HMH_V7_UPGRADES,
  dealHmhPrisoners,
  hmhV7LevelForXp,
  hmhV7LevelThreshold,
  seededUnit,
} from '../sdk/hmh-run-contract-v7.mjs';
import { seededUnit as childSeededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import { HMH_WEAPON_EVOLUTIONS } from '../apps/hmh-reboot/src/weapon-system.mjs';
import {
  RUN_UPGRADE_CATALOG,
  SILVER_SCORE_PER_COIN,
  comboMilestoneXp,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunSilver,
  grantRunXp,
  recordRunDefeat,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import { ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { HMH_OPENING_ENEMY_ARCHETYPE_IDS } from '../apps/hmh-reboot/src/opening-balance.mjs';
import {
  LIQUIDATOR_ATTACK_PLAN,
  LIQUIDATOR_ENDLESS_CYCLE,
  LIQUIDATOR_ENDLESS_CYCLE_TICKS,
  LIQUIDATOR_ENDLESS_LOOP_START_TICK,
  LIQUIDATOR_READABILITY_BUDGET,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { ENCOUNTER_BANDS, createEncounterDirector, directorViewBounds, stepEncounterDirector } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { createEnemyPopulation, retireEnemyFromPopulation } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { COLLECTIBLE_EFFECTS } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { objectiveRewardPlacements } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { addSilverDrop, createSilverDropState } from '../apps/hmh-reboot/src/silver-drops.mjs';
import { FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
import { HMH_V7_PLANS, buildFixtureBody, fixtureSalt, readFixture } from './fixtures/ranked/build-fixtures.mjs';

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

// The v6 path reads literal 1.8.1 values (HMH_V6_RULES), never the live child,
// so a later child change cannot move a v6 bound. These pins hold each literal
// to the 1.8.1 module it was read from. When the child branch legitimately
// changes one of those modules, re-point the pin at the literal (the literal is
// the v6 authority) instead of changing HMH_V6_RULES.
test('the frozen v6 literals equal the 1.8.1 child modules', () => {
  assert.equal(HMH_V6_RULES.fixedStepMs, FIXED_STEP_MS);
  assert.equal(HMH_MAX_LEVEL, 1000);
  assert.match(readFileSync(new URL('../apps/hmh-reboot/src/run-progression.mjs', import.meta.url), 'utf8'), /while \(state\.level < 1000 && state\.xp >= nextLevelThreshold\(state\.level\)\)/);
  assert.deepEqual(HMH_V6_RULES.bands, ENCOUNTER_BANDS.map(({ id, minTick, maxTick, spawnIntervalTicks }) => ({ id, minTick, maxTick, spawnIntervalTicks })));
  assert.equal(HMH_V6_RULES.openingEnemies, HMH_OPENING_ENEMY_ARCHETYPE_IDS.length);
  for (const [role, threat] of Object.entries(HMH_ROLE_THREAT)) {
    assert.equal(threat, role === 'liquidator' ? LIQUIDATOR_THREAT_COST : ENEMY_ARCHETYPES[role].costs.threat, role);
  }
  assert.deepEqual(Object.keys(MAX_UPGRADE_RANKS), Object.keys(RUN_UPGRADE_CATALOG));
  assert.deepEqual(MAX_UPGRADE_RANKS, Object.fromEntries(Object.values(RUN_UPGRADE_CATALOG).map((upgrade) => [upgrade.id, upgrade.maxRank])));
  const multipliers = Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => /^(xp|score)Multiplier$/.test(upgrade.effect));
  assert.deepEqual(multipliers.map(({ id, effect, amount }) => [id, effect, amount]), [['block-reward', 'scoreMultiplier', HMH_V6_RULES.multiplierPerRank], ['validator-training', 'xpMultiplier', HMH_V6_RULES.multiplierPerRank]]);
  const milestones = Array.from({ length: 10_000 }, (_, index) => index + 1).filter((combo) => comboMilestoneXp(combo) > 0).map((combo) => [combo, comboMilestoneXp(combo)]);
  assert.deepEqual(HMH_V6_RULES.comboMilestones, milestones);
  assert.deepEqual(HMH_V6_RULES.cacheXp, Object.fromEntries(Object.values(COLLECTIBLE_EFFECTS).filter((effect) => effect.xpGain > 0).map((effect) => [effect.effectId, effect.xpGain])));
  assert.equal(HMH_V6_RULES.silverScorePerCoin, SILVER_SCORE_PER_COIN);
  assert.equal(OBJECTIVE_REWARD_XP, Math.max(0, ...objectiveRewardPlacements().map((placement) => placement.xpGain ?? 0)));
  assert.equal(OBJECTIVE_REWARD_SCORE, 0);
  const isSummon = (entry) => entry.attackId === 'bad-debt-summon';
  assert.deepEqual(HMH_V6_RULES.liquidatorAdds, {
    summonTicks: LIQUIDATOR_ATTACK_PLAN.filter(isSummon).map((entry) => entry.startTick),
    endlessLoopStartTick: LIQUIDATOR_ENDLESS_LOOP_START_TICK,
    endlessCycleTicks: LIQUIDATOR_ENDLESS_CYCLE_TICKS,
    endlessCycleSummonOffsets: LIQUIDATOR_ENDLESS_CYCLE.filter(isSummon).map((entry) => entry.offset),
    addsPerSummon: LIQUIDATOR_READABILITY_BUDGET.activeAdds,
  });
  assert.ok(LIQUIDATOR_ATTACK_PLAN.every((entry) => entry.startTick < LIQUIDATOR_ENDLESS_LOOP_START_TICK), 'the authored plan ends before the loop');
});

// The 1.8.1 verifier measured its gains by running the reboot's own
// progression functions at the given ranks; the frozen formulas must give the
// same numbers.
function measuredGains(ranks) {
  const progression = () => {
    const state = createRunProgression({ seed: 0 });
    for (const [id, rank] of Object.entries(ranks)) if (Object.hasOwn(state.ranks, id)) state.ranks[id] = Math.max(0, Math.min(MAX_UPGRADE_RANKS[id], rank));
    return state;
  };
  const killXp = {};
  const killScore = {};
  for (const [role, threat] of Object.entries(HMH_ROLE_THREAT)) {
    const snapshot = recordRunDefeat(progression(), { enemyId: 'plausibility-probe', threatCost: threat, tick: 0 });
    killXp[role] = snapshot.xp;
    killScore[role] = snapshot.score;
  }
  let comboXp = 0;
  let comboRate = 0;
  for (const { combo, baseXp } of COMBO_MILESTONES) {
    comboXp += grantRunXp(progression(), baseXp, 0).xp;
    comboRate = Math.max(comboRate, comboXp / combo);
  }
  const cacheXp = Object.fromEntries(Object.entries(HMH_V6_RULES.cacheXp).map(([effectId, baseXp]) => [effectId, grantRunXp(progression(), baseXp, 0).xp]));
  const silver = grantRunSilver(progression(), 1, 0).score;
  return { killXp, killScore, comboRate, cacheXp, silverScorePerCoin: SILVER_SCORE_PER_COIN * getRunProgressionSnapshot(progression()).effects.scoreMultiplier + 0.5, silver };
}

test('the frozen v6 gains equal the gains measured with run-progression', () => {
  const { silver, ...measured } = measuredGains(MAX_UPGRADE_RANKS);
  assert.deepEqual({ ...MAX_GAINS }, measured);
  assert.ok(silver <= MAX_GAINS.silverScorePerCoin);
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
  assert.deepEqual(validateRebootRunPlausibility(valid), { verdict: 'ok', flags: [] });
  assert.deepEqual(validateRebootRunPlausibility(realistic), { verdict: 'ok', flags: [] });
  // The level-90 run's 1.8.1 result, value for value.
  assert.deepEqual(validateRebootRunPlausibility(level90), {
    verdict: 'flagged',
    flags: [
      { id: 'xp-near-ceiling', severity: 'flag', value: 1_204_660, limit: 1_305_994 },
      { id: 'score-near-ceiling', severity: 'flag', value: 1_273_095, limit: 1_279_663 },
    ],
  });

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

// ---------------------------------------------------------------------------
// The v6 path is frozen (run summary v7 contract §9): every schema-6 summary
// must get the result it got at 60ea173a (production 1.8.1), before the v7
// rules and the literal v6 table existed. The corpus below covers every rule
// and flag of the v6 path; its results were hashed with the 60ea173a module.
const V6_CORPUS_DIGEST = 'accf51dd54eb915ac643884ca6ab6886158b53531d67aa11461c6c0246faf439';
function v6Corpus() {
  const cases = [];
  const add = (name, base, mutate = () => {}) => cases.push([name, clone(base, mutate)]);
  const bases = [['valid', valid], ['realistic', realistic], ['level-90', level90]];
  const roles = ['bagholder-rusher', 'forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist', 'liquidator'];
  const withXp = (s, xp) => { s.totals.xp = xp; s.totals.level = rebootLevelForXp(xp); };
  const rank = (s, id, selected) => { const row = s.upgrades.find((entry) => entry.upgradeId === id); row.offered = Math.max(row.offered, selected); row.selected = selected; };
  for (const [name, base] of bases) {
    add(name, base);
    add(`${name} elapsed 0`, base, (s) => { s.totals.elapsedMs = 0; });
    add(`${name} no ticks`, base, (s) => { s.identity.endTick = 0; s.totals.survivalTicks = 0; s.totals.elapsedMs = 0; });
    add(`${name} half elapsed`, base, (s) => { s.totals.elapsedMs = s.totals.survivalTicks * FIXED_STEP_MS / 2; });
    add(`${name} elapsed +5 s`, base, (s) => { s.totals.elapsedMs += 5_000; });
    add(`${name} elapsed +1 ms`, base, (s) => { s.totals.elapsedMs += 1; });
    add(`${name} elapsed +1.5 ms`, base, (s) => { s.totals.elapsedMs += 1.5; });
    add(`${name} level +1`, base, (s) => { s.totals.level += 1; });
    add(`${name} level -1`, base, (s) => { s.totals.level -= 1; });
    add(`${name} one Liquidator kill`, base, (s) => { setRoleKills(s, 'liquidator', 1); s.kills.boss = 1; });
    add(`${name} two Liquidator kills`, base, (s) => { setRoleKills(s, 'liquidator', 2); s.kills.boss = 2; });
    add(`${name} boss flag only`, base, (s) => { s.kills.boss = 1; });
    add(`${name} boss role only`, base, (s) => { setRoleKills(s, 'liquidator', 1); s.kills.boss = 0; });
    for (const role of roles) {
      for (const extra of [1, 50, 65, 400, 750, 2_000]) add(`${name} +${extra} ${role}`, base, (s) => setRoleKills(s, role, s.kills.byEnemyRole.find((row) => row.enemyRoleId === role).count + extra));
    }
    for (const factor of [0.5, 0.9, 1.1, 1.3, 1.6, 2, 3, 5]) {
      add(`${name} xp x${factor}`, base, (s) => withXp(s, Math.floor(s.totals.xp * factor)));
      add(`${name} score x${factor}`, base, (s) => { s.totals.score = Math.floor(s.totals.score * factor); });
    }
    for (const selected of [0, 1, 2, 3, 4, 7]) {
      add(`${name} validator-training ${selected}`, base, (s) => rank(s, 'validator-training', selected));
      add(`${name} block-reward ${selected}`, base, (s) => rank(s, 'block-reward', selected));
    }
    add(`${name} +20 picks`, base, (s) => { s.upgrades[0].offered += 20; s.upgrades[0].selected += 20; });
    add(`${name} combo above kills`, base, (s) => { s.totals.maxCombo = s.kills.total + 5; s.totals.currentCombo = 0; });
    add(`${name} engaged at 600`, base, (s) => { s.milestones.bossEngagedTick = 600; });
    add(`${name} engaged at 72,000`, base, (s) => { s.milestones.bossEngagedTick = Math.min(72_000, s.identity.endTick); });
    add(`${name} boss flag cleared`, base, (s) => { s.kills.boss = 0; });
    add(`${name} engagement cleared`, base, (s) => { s.milestones.bossEngagedTick = 0; });
    for (const span of [60, 1_200, 36_000]) {
      if (span < base.identity.endTick) cases.push([`${name} squeezed to ${span}`, shiftedStart(base, span)]);
    }
    add(`${name} start 1`, base, (s) => { s.identity.startTick = 1; s.totals.survivalTicks -= 1; });
    add(`${name} caches x3`, base, (s) => { for (const row of s.collectibles) row.collected *= 3; });
    add(`${name} litecoin`, base, (s) => { s.totals.litecoin = 3; });
  }
  cases.push(['null', null], ['empty', {}], ['no roles', clone(valid, (s) => { delete s.kills.byEnemyRole; })], ['no upgrades', clone(valid, (s) => { delete s.upgrades; })]);
  return cases;
}

test('the v6 path gives every schema-6 summary its 1.8.1 result (frozen)', () => {
  const results = v6Corpus().map(([name, summary]) => [name, validateRebootRunPlausibility(summary)]);
  const digest = createHash('sha256').update(JSON.stringify(results)).digest('hex');
  assert.equal(digest, V6_CORPUS_DIGEST, `${results.length} cases`);
});

// ---------------------------------------------------------------------------
// Run summary v7 (contract §5, §7 and §8).
const C7 = HMH_RUN_SUMMARY_CATALOGS_V7;
const districts = readFixture('hmh-v7-districts').body.evidence.runSummary;
const fourBosses = readFixture('hmh-v7-four-bosses').body.evidence.runSummary;
const v7Row = (rows, key, id) => rows.find((entry) => entry[key] === id);
const bossRow = (summary, bossId) => v7Row(summary.bosses, 'bossId', bossId);
const flagIds = (result) => result.flags.map((flag) => flag.id);
const rejectFlags = (result) => result.flags.filter((flag) => flag.severity === 'reject');
// The mutation stays schema-valid, so a rejection comes from plausibility.
const plausible = (summary) => {
  assert.equal(validateRunSummaryPayload(summary), '', 'the schema accepts the mutation');
  return validateRebootRunPlausibility(summary);
};
// Moves a boss's initiation; for the Liquidator the milestone, and a Dark Pool
// logbook entered at the initiation, move with it.
function retimeBoss(summary, bossId, { first, last = first, defeated }) {
  const row = bossRow(summary, bossId);
  const previousFirst = row.firstInitiatedTick;
  Object.assign(row, { firstInitiatedTick: first, lastInitiatedTick: last, ...(defeated === undefined ? {} : { defeatedTick: defeated }) });
  if (bossId !== 'liquidator') return;
  summary.milestones.bossEngagedTick = first;
  const logbook = v7Row(summary.objectives, 'objectiveId', 'warehouse-logbook');
  if (logbook.completed === 1 && logbook.tick === previousFirst) {
    logbook.tick = first;
    v7Row(summary.milestones.secrets, 'secretId', 'warehouse-logbook').tick = first;
  }
}
function setV7Xp(summary, xp) {
  summary.totals.xp = xp;
  summary.totals.level = hmhV7LevelForXp(xp);
  summary.milestones.levelUps = summary.totals.level - 1;
}
function addOrdinaryKills(summary, role, count) {
  summary.kills.total += count;
  v7Row(summary.kills.byEnemyRole, 'enemyRoleId', role).count += count;
  v7Row(summary.kills.byWeapon, 'weaponId', 'coin-blaster').count += count;
  v7Row(summary.weapons, 'weaponId', 'coin-blaster').kills += count;
}

test('the v7 contract values equal the 1.8.1 child where they are unchanged', () => {
  const run = HMH_V7_RUN_RULES;
  assert.equal(run.FIXED_STEP_MS, FIXED_STEP_MS);
  assert.equal(run.MAX_LEVEL, HMH_MAX_LEVEL);
  for (const level of [1, 2, 23, 90, 999]) assert.equal(hmhV7LevelThreshold(level), rebootLevelThreshold(level));
  for (const xp of [0, 299, 300, 81_340, 1_204_660, 1e12]) assert.equal(hmhV7LevelForXp(xp), rebootLevelForXp(xp), `xp ${xp}`);
  for (const id of ['validator-training', 'block-reward']) {
    assert.equal(run.MULTIPLIER_MAX_RANK, RUN_UPGRADE_CATALOG[id].maxRank, id);
    assert.equal(run.MULTIPLIER_PER_RANK, RUN_UPGRADE_CATALOG[id].amount, id);
  }
  assert.equal(run.XP_MULTIPLIER_MAX, 1.75);
  assert.equal(run.SCORE_MULTIPLIER_MAX, 1.75);
  assert.deepEqual(Object.entries(run.COMBO_MILESTONE_XP).map(([combo, xp]) => [Number(combo), xp]), HMH_V6_RULES.comboMilestones);
  assert.deepEqual(run.CACHE_XP, HMH_V6_RULES.cacheXp);
  assert.equal(run.SILVER_SCORE_PER_COIN, SILVER_SCORE_PER_COIN);
  const drops = createSilverDropState();
  addSilverDrop(drops, { sequence: 1, tick: 0, x: 0, y: 0 });
  assert.equal(run.SILVER_PER_ENEMY_KILL_MAX, drops.dropped);
  assert.equal(run.OPENING_ENEMIES, HMH_OPENING_ENEMY_ARCHETYPE_IDS.length);
  assert.deepEqual(run.ENCOUNTER_BAND_SCHEDULE, ENCOUNTER_BANDS.map(({ id, minTick, maxTick, spawnIntervalTicks }) => ({ id, minTick, maxTick, spawnIntervalTicks })));
  // The six 1.8.1 archetypes and the Liquidator keep their threat.
  for (const role of HMH_RUN_SUMMARY_CATALOGS_V6.enemyRoles) assert.equal(HMH_V7_ROLE_THREAT[role], role === 'liquidator' ? LIQUIDATOR_THREAT_COST : ENEMY_ARCHETYPES[role].costs.threat, role);
  // Kill rewards before multipliers are recordRunDefeat's 80 + 20t and 100 + 25t.
  for (const threat of new Set(Object.values(HMH_V7_ROLE_THREAT))) {
    const snapshot = recordRunDefeat(createRunProgression({ seed: 0 }), { enemyId: 'contract-probe', threatCost: threat, tick: 0 });
    assert.deepEqual([snapshot.xp, snapshot.score], [80 + 20 * threat, 100 + 25 * threat], `threat ${threat}`);
  }
  // The 24 v6 upgrades keep their maxRank and weapon gate.
  assert.equal(Object.values(RUN_UPGRADE_CATALOG).length, 24);
  for (const upgrade of Object.values(RUN_UPGRADE_CATALOG)) {
    assert.deepEqual(HMH_V7_UPGRADES[upgrade.id], { maxRank: upgrade.maxRank, requiresWeaponId: upgrade.requiresWeaponId ?? null }, upgrade.id);
  }
  // Evolution rows 0, 2, 3 and 4 are today's HMH_WEAPON_EVOLUTIONS ids.
  assert.deepEqual([0, 2, 3, 4].map((index) => C7.evolutions[index]).sort(), Object.values(HMH_WEAPON_EVOLUTIONS).map((evolution) => evolution.id).sort());
  assert.equal(HMH_V7_EVOLUTIONS['settler-rail'].weaponId, 'coin-blaster');
  // A v7 boss's silver burst replaces the 1.8.1 drop of 10 coins, which the v6 path keeps.
  assert.equal(SILVER_PER_BOSS_KILL, 10);
  assert.deepEqual(C7.bosses.map((bossId) => HMH_V7_BOSSES[bossId].silverBurst), [15, 20, 20, 25]);
});

test('the v7 ceilings are the run-progression gains at the maximum ranks', () => {
  const maxed = () => {
    const state = createRunProgression({ seed: 0 });
    state.ranks['validator-training'] = 3;
    state.ranks['block-reward'] = 3;
    return state;
  };
  assert.deepEqual([V7_MAX_GAINS.xm, V7_MAX_GAINS.sm], [getRunProgressionSnapshot(maxed()).effects.xpMultiplier, getRunProgressionSnapshot(maxed()).effects.scoreMultiplier]);
  for (const [role, threat] of Object.entries(HMH_V7_ROLE_THREAT)) {
    const snapshot = recordRunDefeat(maxed(), { enemyId: 'ceiling-probe', threatCost: threat, tick: 0 });
    assert.deepEqual([V7_MAX_GAINS.killXp[role], V7_MAX_GAINS.killScore[role]], [snapshot.xp, snapshot.score], role);
  }
  // Contract table 5.2, the bosses.
  assert.deepEqual(C7.bosses.map((id) => [V7_MAX_GAINS.killXp[id], V7_MAX_GAINS.killScore[id]]), [[980, 1_225], [1_260, 1_575], [1_540, 1_925], [1_820, 2_275]]);
  assert.equal(V7_MAX_GAINS.comboRate, MAX_GAINS.comboRate);
  assert.deepEqual(V7_MAX_GAINS.cacheXp, MAX_GAINS.cacheXp);
  assert.equal(V7_MAX_GAINS.silverScorePerCoin, 18);
  for (const coins of [1, 15, 20, 25]) assert.ok(grantRunSilver(maxed(), coins, 0).score <= coins * V7_MAX_GAINS.silverScorePerCoin, `${coins} coins`);
  // Objective XP is grantRunXp(perLevel x L), multiplied like kill XP.
  for (const [kind, perLevel] of Object.entries(HMH_V7_RUN_RULES.OBJECTIVE_XP_PER_LEVEL)) {
    for (const level of [1, 7, 23, 90, 999]) assert.equal(grantRunXp(maxed(), perLevel * level, 0).xp, Math.round(perLevel * level * 1.75), `${kind} at ${level}`);
  }
  // An OG Miner span granted at validator-training rank 0 is exactly 300 x L.
  for (const level of [1, 17, 999]) assert.equal(grantRunXp(createRunProgression({ seed: 0 }), 300 * level, 0).xp, 300 * level);
});

test('the prisoner deal: vectors, 10,000 seeds and the seededUnit copy', () => {
  assert.deepEqual(dealHmhPrisoners(0), ['pawnbroker', 'field-medic', 'quartermaster', 'field-medic', 'og-miner', 'quartermaster', 'og-miner', 'pawnbroker']);
  assert.deepEqual(dealHmhPrisoners(1337), ['og-miner', 'field-medic', 'quartermaster', 'field-medic', 'pawnbroker', 'quartermaster', 'og-miner', 'pawnbroker']);
  assert.ok(Object.isFrozen(dealHmhPrisoners(0)));
  // The two districts with two slots are exactly the repaired pairs.
  const slotsByDistrict = {};
  C7.prisonerSlots.forEach((slotId, index) => { (slotsByDistrict[HMH_V7_PRISONER_SLOTS[slotId].district] ??= []).push(index); });
  const pairs = Object.values(slotsByDistrict).filter((slots) => slots.length > 1);
  assert.deepEqual(pairs, [[0, 3], [1, 6]]);
  const frequency = Array.from({ length: 8 }, () => Object.fromEntries(HMH_PRISONER_KINDS.map((kind) => [kind, 0])));
  let repaired = 0;
  for (let seed = 0; seed < 10_000; seed += 1) {
    const deal = dealHmhPrisoners(seed);
    for (const kind of HMH_PRISONER_KINDS) assert.equal(deal.filter((entry) => entry === kind).length, 2, `seed ${seed}: ${kind} twice`);
    for (const [a, b] of pairs) assert.notEqual(deal[a], deal[b], `seed ${seed}: no district holds two of one kind`);
    deal.forEach((kind, slot) => { frequency[slot][kind] += 1; });
    // The shuffle before its repair, to count the repaired seeds.
    const kinds = ['field-medic', 'field-medic', 'quartermaster', 'quartermaster', 'pawnbroker', 'pawnbroker', 'og-miner', 'og-miner'];
    for (let i = 7; i > 0; i -= 1) {
      const j = Math.floor(seededUnit(seed, `prisoner:${i}`) * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    if (pairs.some(([a, b]) => kinds[a] === kinds[b])) repaired += 1;
    assert.equal(seededUnit(seed * 7_919, `prisoner:${seed % 8}`), childSeededUnit(seed * 7_919, `prisoner:${seed % 8}`));
  }
  assert.equal(repaired, 2_554);
  const shares = frequency.flatMap((slot) => Object.values(slot)).map((count) => count / 10_000);
  assert.ok(Math.min(...shares) >= 0.188 && Math.max(...shares) <= 0.311, `${Math.min(...shares)} to ${Math.max(...shares)}`);
  for (const [seed, key] of [[0, ''], [0xffff_ffff, 'prisoner:7'], [123_456_789, 'spread:weapon:42'], [-1, 'x'], [2 ** 33 + 5, 'overflow']]) {
    assert.equal(seededUnit(seed, key), childSeededUnit(seed, key), `${seed} ${key}`);
  }
});

test('v7 fixtures are plausible, and the schema version picks the rules', () => {
  assert.deepEqual(validateRebootRunPlausibility(districts), { verdict: 'ok', flags: [] });
  assert.deepEqual(validateRebootRunPlausibility(districts), readFixture('hmh-v7-districts').expected.plausibility);
  assert.deepEqual(validateRebootRunPlausibility(fourBosses), readFixture('hmh-v7-four-bosses').expected.plausibility);
  assert.deepEqual(flagIds(validateRebootRunPlausibility(fourBosses)), ['score-near-ceiling'], 'Block Reward at rank 3 early: flagged, never rejected');
  // The four-boss run kills the Liquidator at 56,400, before the v6 boss band:
  // the v6 rules reject that, the v7 rules (per-boss readiness) accept it.
  assert.ok(fourBosses.identity.endTick < HMH_BOSS_START_TICK);
  assert.ok(flagIds(validateV6RunPlausibility(fourBosses)).includes('boss-before-band'));
  assert.equal(validateRebootRunPlausibility(clone(fourBosses, (s) => { s.schemaVersion = 6; })).verdict, 'rejected', 'the schemaVersion, not the shape, picks the rules');
  // The retired v6 boss flags never appear on the v7 path.
  for (const summary of [districts, fourBosses]) {
    for (const id of ['boss-before-band', 'boss-count-mismatch', 'boss-engaged-before-band', 'boss-kill-without-engagement', 'upgrades-exceed-levels']) {
      assert.ok(!flagIds(validateRebootRunPlausibility(summary)).includes(id), id);
    }
  }
  assert.deepEqual(validateRebootRunPlausibility({ schemaVersion: 7 }), { verdict: 'rejected', flags: [{ id: 'summary-unreadable', severity: 'reject', value: null, limit: null }] });
});

// Contract §8, nearest-impossible test 1: readiness, per boss.
test('v7: a boss initiated one tick before it is ready rejects; at its ready tick it passes', () => {
  for (const bossId of C7.bosses) {
    const { readyTick } = HMH_V7_BOSSES[bossId];
    const early = plausible(clone(fourBosses, (s) => retimeBoss(s, bossId, { first: readyTick - 1 })));
    assert.deepEqual(rejectFlags(early), [{ id: 'boss-before-ready', severity: 'reject', value: readyTick - 1, limit: readyTick }], bossId);
    assert.deepEqual(rejects(plausible(clone(fourBosses, (s) => retimeBoss(s, bossId, { first: readyTick })))), [], bossId);
  }
  // One entry per offending boss, in catalogue order.
  const all = plausible(clone(fourBosses, (s) => { for (const bossId of C7.bosses) retimeBoss(s, bossId, { first: HMH_V7_BOSSES[bossId].readyTick - 1 }); }));
  assert.deepEqual(rejectFlags(all).map((flag) => [flag.id, flag.limit]), [['boss-before-ready', 7_200], ['boss-before-ready', 18_000], ['boss-before-ready', 27_000], ['boss-before-ready', 36_000]]);
});

// Contract §8, nearest-impossible test 2: the minimum fight.
test('v7: a defeat 299 ticks after the last initiation rejects; 300 passes', () => {
  assert.equal(HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS, 300);
  for (const bossId of C7.bosses) {
    const last = bossRow(fourBosses, bossId).lastInitiatedTick;
    const short = plausible(clone(fourBosses, (s) => { bossRow(s, bossId).defeatedTick = last + 299; }));
    assert.deepEqual(rejectFlags(short), [{ id: 'boss-fight-too-short', severity: 'reject', value: 299, limit: 300 }], bossId);
    assert.deepEqual(rejects(plausible(clone(fourBosses, (s) => { bossRow(s, bossId).defeatedTick = last + 300; }))), [], bossId);
  }
  // The fight counts from the last initiation: an earlier engagement before a retreat does not shorten it.
  const { lastInitiatedTick } = bossRow(districts, 'lockkeeper');
  assert.deepEqual(rejects(plausible(clone(districts, (s) => { bossRow(s, 'lockkeeper').defeatedTick = lastInitiatedTick + 299; }))), ['boss-fight-too-short']);
});

// Contract §8, nearest-impossible test 3: re-initiation after a retreat.
test('v7: re-initiations less than 2,520 ticks apart reject', () => {
  const { firstInitiatedTick } = bossRow(districts, 'lockkeeper');
  const retry = (initiations, span, defeated = 24_000) => plausible(clone(districts, (s) => Object.assign(bossRow(s, 'lockkeeper'), { initiations, lastInitiatedTick: firstInitiatedTick + span, defeatedTick: defeated })));
  assert.deepEqual(rejectFlags(retry(2, 2_519)), [{ id: 'boss-reinitiation-too-soon', severity: 'reject', value: 2_519, limit: 2_520 }]);
  assert.deepEqual(rejects(retry(2, 2_520)), []);
  assert.deepEqual(rejectFlags(retry(3, 5_039)), [{ id: 'boss-reinitiation-too-soon', severity: 'reject', value: 5_039, limit: 5_040 }]);
  assert.deepEqual(rejects(retry(3, 5_040)), []);
  // Extra initiations add no kill capacity: the add budget is per slot, once.
  assert.equal(hmhV7KillCapacity(clone(districts, (s) => { bossRow(s, 'lockkeeper').initiations = 1_000; })), hmhV7KillCapacity(districts));
});

// Contract §8, nearest-impossible test 4: the earliest Liquidator kill is at 36,300.
test('v7: a Liquidator kill in a run of 36,299 ticks rejects; at 36,300 it passes', async () => {
  const rush = { ...HMH_V7_PLANS['four-bosses'], endTick: 36_300, caches: [], nodes: [], reviveTick: null, bosses: [{ bossId: 'liquidator', initiations: [36_000], defeatedTick: 36_300, adds: [] }] };
  const { body } = await buildFixtureBody({ gameId: 'lester-blaster', salt: fixtureSalt('hmh-v7-liquidator-rush'), evidence: { v7Plan: rush } });
  const honest = body.evidence.runSummary;
  assert.deepEqual([honest.identity.endTick, honest.kills.boss, bossRow(honest, 'liquidator').defeatedTick], [36_300, 1, 36_300]);
  assert.deepEqual(rejects(plausible(honest)), []);
  const endingAt = (end, first = 36_000) => clone(honest, (s) => {
    s.identity.endTick = end;
    s.totals.survivalTicks = end;
    s.totals.elapsedMs = end * FIXED_STEP_MS;
    s.defeat.tick = Math.min(s.defeat.tick, end);
    s.milestones.lastLevelUpTick = Math.min(s.milestones.lastLevelUpTick, end);
    s.milestones.firstLevelUpTick = Math.min(s.milestones.firstLevelUpTick, s.milestones.lastLevelUpTick);
    retimeBoss(s, 'liquidator', { first, defeated: end });
  });
  assert.deepEqual(rejects(plausible(endingAt(36_299))), ['boss-fight-too-short']);
  assert.deepEqual(rejects(plausible(endingAt(36_299, 35_999))), ['boss-before-ready']);
  assert.deepEqual(rejects(plausible(endingAt(36_298, 35_999))), ['boss-before-ready', 'boss-fight-too-short']);
});

// Contract §8, nearest-impossible test 5: kill capacity.
test('v7: one kill above the kill capacity of a four-boss run rejects', () => {
  const capacity = hmhV7KillCapacity(fourBosses);
  const room = capacity - fourBosses.kills.total;
  assert.ok(room > 0);
  const atCapacity = plausible(clone(fourBosses, (s) => addOrdinaryKills(s, 'forkrunner', room)));
  assert.deepEqual(rejects(atCapacity), []);
  assert.ok(flagIds(atCapacity).includes('kills-near-capacity'));
  const above = plausible(clone(fourBosses, (s) => addOrdinaryKills(s, 'forkrunner', room + 1)));
  assert.deepEqual(rejectFlags(above), [{ id: 'kills-above-capacity', severity: 'reject', value: capacity + 1, limit: capacity }]);
});

// Contract §7.3: v7 capacity against v6 for fabricated boss claims (every boss
// initiated at its ready tick, never defeated) and quick honest kills (each
// defeated 302 ticks after its ready tick).
test('v7 kill capacity reproduces the contract §7.3 table', () => {
  const capacityAt = (runTicks, defeatAfter) => hmhV7KillCapacity({ totals: { survivalTicks: runTicks }, bosses: C7.bosses.map((bossId) => {
    const ready = HMH_V7_BOSSES[bossId].readyTick;
    const initiated = ready <= runTicks;
    const defeated = initiated && defeatAfter !== null && ready + defeatAfter <= runTicks ? ready + defeatAfter : 0;
    return { bossId, initiations: initiated ? 1 : 0, firstInitiatedTick: initiated ? ready : 0, lastInitiatedTick: initiated ? ready : 0, defeatedTick: defeated };
  }) });
  const table = [3_600, 10_800, 18_000, 36_000, 64_800, 108_000].map((runTicks) => [runTicks, spawnCapacity(runTicks), capacityAt(runTicks, null), capacityAt(runTicks, 302)]);
  assert.deepEqual(table, [
    [3_600, 27, 27, 27],
    [10_800, 107, 123, 112],
    [18_000, 187, 239, 196],
    [36_000, 487, 623, 506],
    [64_800, 1_127, 1_383, 1_151],
    [108_000, 2_572, 2_863, 2_451],
  ]);
  // The worst loosening against v6 is under 28%, at 10 minutes.
  for (const [, v6, fabricated] of table) assert.ok(fabricated <= v6 * 1.28, `${fabricated} against ${v6}`);
  // The boss-window union counts overlapping claims once and ignores uninitiated rows.
  assert.equal(hmhV7BossWindowTicks([
    { initiations: 1, firstInitiatedTick: 100, defeatedTick: 400 },
    { initiations: 2, firstInitiatedTick: 300, defeatedTick: 0 },
    { initiations: 0, firstInitiatedTick: 0, defeatedTick: 0 },
  ], 1_000), 900);
});

// Contract §8, nearest-impossible test 7: OG Miner XP comes from the seeded deal only.
test('v7: an OG Miner rescue funds exactly 300 x level XP, and only in an OG Miner slot', () => {
  const deal = dealHmhPrisoners(fourBosses.identity.seed);
  const unheld = (kind) => C7.prisonerSlots.find((slotId, index) => deal[index] === kind && !HMH_V7_PRISONER_SLOTS[slotId].heldBy);
  const ogSlot = unheld('og-miner');
  const medicSlot = unheld('field-medic');
  assert.ok(ogSlot && medicSlot);
  const level = fourBosses.totals.level;
  const tick = fourBosses.identity.endTick - 60;
  const unrescue = (s, slotId) => Object.assign(v7Row(s.prisoners, 'slotId', slotId), { rescued: 0, tick: 0, levelAtRescue: 0 });
  const base = clone(fourBosses, (s) => { unrescue(s, ogSlot); unrescue(s, medicSlot); });
  const rescuedIn = (slotId, xp) => clone(base, (s) => {
    Object.assign(v7Row(s.prisoners, 'slotId', slotId), { rescued: 1, tick, levelAtRescue: level });
    setV7Xp(s, xp);
  });
  const without = hmhV7Ceilings(base, V7_MAX_GAINS).xp;
  const withOgMiner = hmhV7Ceilings(rescuedIn(ogSlot, fourBosses.totals.xp), V7_MAX_GAINS).xp;
  assert.equal(withOgMiner - without, 300 * level, 'the span is 300 x level, unmultiplied');
  assert.deepEqual(rejects(plausible(rescuedIn(ogSlot, withOgMiner))), []);
  assert.deepEqual(rejects(plausible(rescuedIn(ogSlot, withOgMiner + 1))), ['xp-above-ceiling']);
  // The same claim in a slot the deal makes a Field Medic has no XP source.
  assert.equal(hmhV7Ceilings(rescuedIn(medicSlot, fourBosses.totals.xp), V7_MAX_GAINS).xp, without);
  assert.deepEqual(rejects(plausible(rescuedIn(medicSlot, withOgMiner))), ['xp-above-ceiling']);
});

// Contract §8, nearest-impossible test 8: a silver burst needs its defeated row.
test('v7: score from the silver burst of a boss that was not defeated rejects', () => {
  // The Lockkeeper initiated but not defeated: no body, no kill score, no burst, no Seal.
  const undefeated = clone(districts, (s) => {
    bossRow(s, 'lockkeeper').defeatedTick = 0;
    v7Row(s.kills.byEnemyRole, 'enemyRoleId', 'lockkeeper').count = 0;
    s.kills.total -= 1;
    v7Row(s.kills.byWeapon, 'weaponId', 'hash-rail').count -= 1;
    v7Row(s.weapons, 'weaponId', 'hash-rail').kills -= 1;
    Object.assign(s.progression, { sealsFound: 1, sealsBanked: 1 });
    v7Row(s.collectibles, 'effectId', 'genesis-seal').collected = 1;
  });
  const ceiling = hmhV7Ceilings(undefeated, V7_MAX_GAINS).score;
  const burstScore = HMH_V7_BOSSES.lockkeeper.silverBurst * V7_MAX_GAINS.silverScorePerCoin;
  assert.equal(hmhV7Ceilings(districts, V7_MAX_GAINS).score - ceiling, V7_MAX_GAINS.killScore.lockkeeper + burstScore, 'the defeat funds its kill score and its burst');
  assert.deepEqual(rejects(plausible(clone(undefeated, (s) => { s.totals.score = ceiling; }))), []);
  assert.deepEqual(rejects(plausible(clone(undefeated, (s) => { s.totals.score = ceiling + 1; }))), ['score-above-ceiling']);
  assert.deepEqual(rejects(plausible(clone(undefeated, (s) => { s.totals.score = ceiling + burstScore; }))), ['score-above-ceiling']);
  // Each found secret funds 20 coins; an unfound one funds nothing.
  const unfound = clone(districts, (s) => {
    Object.assign(v7Row(s.objectives, 'objectiveId', 'hashwood-hollow-grove'), { completed: 0, tick: 0, levelAtCompletion: 0 });
    Object.assign(v7Row(s.milestones.secrets, 'secretId', 'hashwood-hollow-grove'), { found: 0, tick: 0 });
  });
  assert.equal(hmhV7Ceilings(districts, V7_MAX_GAINS).score - hmhV7Ceilings(unfound, V7_MAX_GAINS).score, HMH_V7_RUN_RULES.SILVER_PER_SECRET * V7_MAX_GAINS.silverScorePerCoin);
});

test('v7: the time, level and ceiling rejects hold at their boundaries', () => {
  const hard = hmhV7Ceilings(districts, V7_MAX_GAINS);
  assert.deepEqual(rejects(plausible(clone(districts, (s) => setV7Xp(s, hard.xp)))), []);
  assert.deepEqual(rejects(plausible(clone(districts, (s) => setV7Xp(s, hard.xp + 1)))), ['xp-above-ceiling']);
  assert.deepEqual(rejects(plausible(clone(districts, (s) => { s.totals.score = hard.score; }))), []);
  assert.deepEqual(rejects(plausible(clone(districts, (s) => { s.totals.score = hard.score + 1; }))), ['score-above-ceiling']);
  assert.deepEqual(rejects(plausible(clone(districts, (s) => { s.totals.level += 1; s.milestones.levelUps += 1; }))), ['level-xp-mismatch']);
  assert.deepEqual(rejects(plausible(clone(districts, (s) => { s.totals.elapsedMs += 1.5; }))), ['elapsed-time-mismatch']);
  assert.deepEqual(rejects(validateRebootRunPlausibility(clone(districts, (s) => { s.identity.startTick = 1; s.totals.survivalTicks -= 1; }))), ['start-tick-invalid', 'elapsed-time-mismatch']);
});

test('v7 soft flags flag and never reject', () => {
  const soft = (summary, id, value) => {
    const result = plausible(summary);
    assert.equal(result.verdict, 'flagged', id);
    assert.deepEqual(rejects(result), [], id);
    const entry = result.flags.find((flag) => flag.id === id);
    assert.ok(entry, `${id}: ${JSON.stringify(result.flags)}`);
    if (value !== undefined) assert.deepEqual([entry.value, entry.limit], [value, 0], id);
  };
  // A fourth rank of a rank-3 upgrade, taken in place of another pick.
  soft(clone(districts, (s) => {
    const to = s.upgrades.find((row) => row.selected === 3 && HMH_V7_UPGRADES[row.upgradeId].maxRank === 3);
    const from = s.upgrades.find((row) => row.selected > 0 && row !== to);
    from.selected -= 1;
    from.offered -= 1;
    to.selected += 1;
    to.offered = Math.max(to.offered, to.selected);
  }), 'upgrade-rank-above-max', 1);
  soft(clone(districts, (s) => {
    Object.assign(v7Row(s.evolutions, 'evolutionId', 'double-spend'), { offered: 1, applied: 1 });
    Object.assign(s.progression, { evolutionOffersOpened: 1, evolutionsApplied: 1, sealsBanked: 1 });
  }), 'evolution-without-mastery', 1);
  soft(clone(districts, (s) => { v7Row(s.objectives, 'objectiveId', 'relay-power').levelAtCompletion = s.totals.level; }), 'node-level-inconsistent');
  soft(clone(districts, (s) => { v7Row(s.objectives, 'objectiveId', 'ravine-winch-handle').tick = v7Row(s.objectives, 'objectiveId', 'ravine-winch').tick + 60; }), 'objective-prerequisite-missing', 1);
  const hashwood = C7.objectives.filter((id) => HMH_V7_OBJECTIVES[id].district === 'hashwood').length + 1; // and the logging-camp prisoner
  soft(clone(districts, (s) => { s.exploration.visitedDistrictMask -= 2 ** C7.districts.indexOf('hashwood'); }), 'node-in-unvisited-district', hashwood);
  soft(clone(districts, (s) => setV7Xp(s, Math.floor(s.totals.xp * 1.3))), 'xp-above-selected-upgrades');
  soft(clone(districts, (s) => { s.totals.score = Math.floor(s.totals.score * 1.3); }), 'score-above-selected-upgrades');
  soft(clone(districts, (s) => { s.totals.maxCombo = s.kills.total + 1; s.totals.currentCombo = 0; }), 'combo-exceeds-kills');
});
