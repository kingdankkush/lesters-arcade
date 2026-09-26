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
  hmhV7BossCouldSummon,
  hmhV7BossOverlaps,
  hmhV7Ceilings,
  hmhV7KillCapacity,
  hmhV7NodeLevelExcess,
  spawnCapacity,
  validateRebootRunPlausibility,
  validateV6RunPlausibility,
  HMH_V6_CONSISTENCY_REJECTS,
  HMH_V6_CONSISTENCY_RULES,
  hmhV6DistrictTravel,
  hmhV6LevelEntry,
  hmhV6MinTicksForTravel,
  hmhV6HandGrenadeSupply,
  hmhV6ObjectiveUnlocks,
  hmhV6PickupCapacity,
  hmhV6PickupExcess,
  hmhV6WeaponsWithoutSource,
} from '../server/verify/hmh-plausibility.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V6, HMH_RUN_SUMMARY_CATALOGS_V7, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v7.mjs';
import {
  HMH_PRISONER_KINDS,
  HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION,
  HMH_V7_BOSSES,
  HMH_V7_BOSS_RULES,
  HMH_V7_COLLECTIBLE_RULES,
  HMH_V7_EVOLUTIONS,
  HMH_V7_OBJECTIVES,
  HMH_V7_PRISONER_SLOTS,
  HMH_V7_ROLE_THREAT,
  HMH_V7_RUN_RULES,
  HMH_V7_UPGRADES,
  dealHmhPrisoners,
  hmhV7CollectibleCapacity,
  hmhV7LevelForXp,
  hmhV7LevelThreshold,
  seededUnit,
} from '../sdk/hmh-run-contract-v7.mjs';
import { seededUnit as childSeededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import { HMH_WEAPON_DEFINITIONS, HMH_WEAPON_EVOLUTIONS } from '../apps/hmh-reboot/src/weapon-system.mjs';
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
import { COLLECTIBLE_EFFECTS, createCollectibleState, stepCollectibles } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { objectiveRewardPlacements } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { addSilverDrop, createSilverDropState } from '../apps/hmh-reboot/src/silver-drops.mjs';
import { DeterministicSimulation, FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
import { BEAR_MARKET_BURNER_EVENT_BOUNDS } from '../apps/hmh-reboot/src/bear-market-burner-event.mjs';
import { FORKED_STANDARD_CONFIG } from '../apps/hmh-reboot/src/forked-standard.mjs';
import { createWeaponLoadout, grantWeaponPickup, selectWeapon, switchWeapon } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { resolveComboFeedback } from '../apps/hmh-reboot/src/combo-feedback.mjs';
import { HMH_PLANS, HMH_V7_FIXTURE_BUILD_HASH, HMH_V7_PLANS, buildFixtureBody, buildHmhEvidence, fixtureSalt, readFixture } from './fixtures/ranked/build-fixtures.mjs';
import { HMH_CHILD_REARMED_ASSETS, HMH_CHILD_REARM_TICKS, hmhChildCollectibleState } from './fixtures/ranked/hmh-honest-corpus.mjs';
import { LEVEL_ONE_WORLD, getLevelOneDistrictAt } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { LEVEL_ONE_ENTRIES, selectLevelEntry } from '../apps/hmh-reboot/src/level-entry.mjs';
import { DASH_DISTANCE, DASH_DURATION_TICKS } from '../apps/hmh-reboot/src/dash.mjs';
import { createPlayerMotionState } from '../apps/hmh-reboot/src/movement.mjs';
import { movementSpeedMultiplierForTransition, resolveHeightAdvantage } from '../apps/hmh-reboot/src/elevation.mjs';
import { WORLD_HAZARD_RULES } from '../apps/hmh-reboot/src/world-hazards.mjs';
import { HMH_GRENADE_DEFINITION } from '../apps/hmh-reboot/src/grenades.mjs';
import { createRunSummaryAccumulator, finalizeRunSummary, recordRunDamage, recordRunGrenade, recordRunGrenadeDetonation, recordRunKill, recordRunTick, recordRunWeaponFire } from '../sdk/hmh-run-summary.mjs';

const MAIN_SOURCE = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
// lightning-ledger-event.mjs keeps its minimum tick module-private.
const LIGHTNING_EVENT_MIN_TICK = Number(/const MIN_EVENT_TICK = ([0-9_]+);/.exec(readFileSync(new URL('../apps/hmh-reboot/src/lightning-ledger-event.mjs', import.meta.url), 'utf8'))[1].replaceAll('_', ''));
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
  // the kill capacity nor the boss band (nor, since 1.8.4, the districts, the
  // pickups of a seeded event, or more recorded ticks than the run has).
  const squeezed = validateRebootRunPlausibility(shiftedStart(level90, 60));
  assert.deepEqual(rejects(squeezed), ['start-tick-invalid', 'boss-before-band', 'kills-above-capacity', 'pickups-above-capacity', 'districts-before-travel-time', 'equipped-ticks-above-run']);
  assert.deepEqual(squeezed.flags.find((flag) => flag.id === 'kills-above-capacity').limit, spawnCapacity(60));
  // The realistic run claimed as 20 seconds (and its three seeded weapon events
  // before any of them is available).
  assert.deepEqual(rejects(validateRebootRunPlausibility(shiftedStart(realistic, 1_200))), ['start-tick-invalid', 'kills-above-capacity', 'pickups-above-capacity']);
});

test('soft cross-checks flag without rejecting', () => {
  const flagIds = (summary) => {
    const result = validateRebootRunPlausibility(summary);
    assert.equal(result.verdict, 'flagged');
    return result.flags.map((flag) => flag.id);
  };
  assert.ok(flagIds(clone(valid, (s) => { s.upgrades[0].offered += 20; s.upgrades[0].selected += 20; })).includes('upgrades-exceed-levels'));
  assert.ok(flagIds(clone(level90, (s) => { s.kills.boss = 0; })).includes('boss-count-mismatch'));
  assert.ok(flagIds(clone(valid, (s) => { s.milestones.bossEngagedTick = 600; })).includes('boss-engaged-before-band'));
  assert.ok(flagIds(clone(realistic, (s) => { s.totals.xp = Math.floor(s.totals.xp * 1.3); s.totals.level = rebootLevelForXp(s.totals.xp); })).includes('xp-above-selected-upgrades'));
  // The 1.8.1 flag combo-exceeds-kills is unchanged, but since the second 1.8.4
  // round the same payload also rejects combo-above-kills: the combo rises by
  // exactly one per recorded kill, and max-combo-30 reads it.
  const combo = validateRebootRunPlausibility(clone(valid, (s) => { s.totals.maxCombo = s.kills.total + 5; s.totals.currentCombo = 0; }));
  assert.ok(combo.flags.some((flag) => flag.id === 'combo-exceeds-kills' && flag.severity === 'flag'));
  assert.deepEqual(rejects(combo), ['combo-above-kills']);
});

// ---------------------------------------------------------------------------
// The v6 path is frozen (run summary v7 contract §9): every schema-6 summary
// must get the result it got at 60ea173a (production 1.8.1), before the v7
// rules and the literal v6 table existed. The corpus below covers every rule
// and flag of the v6 path; its results were hashed with the 60ea173a module.
//
// 1.8.4 deliberately changes v6 for fabricated inputs only: the consistency
// rejects of HMH_V6_CONSISTENCY_RULES (four in the first round, eight more in
// the second, contract §16.6). With those flags taken out (and the verdict
// recomputed) the corpus still hashes to the 60ea173a digest, so no 1.8.1
// result moved; with them in, it hashes to V6_CORPUS_DIGEST_1_8_4. Thirteen
// results gained a flag (V6_CORPUS_CHANGED_1_8_4) and five of them changed
// verdict (V6_VERDICTS_CHANGED_1_8_4): tripling every cache pickup claims three
// Hash Rail Cores (two placements, one of them a locked site reward) and, in
// the realistic run, three Forked Standard caches (one event); a best combo
// five above the kills rejects combo-above-kills beside its 1.8.1 flag. The
// other eight were already rejected (no ticks: progress-without-time;
// squeezed: start-tick-invalid) and now also reject what their squeezed time
// cannot hold: districts, recorded ticks, seeded events or dealt damage.
const V6_CORPUS_DIGEST = 'accf51dd54eb915ac643884ca6ab6886158b53531d67aa11461c6c0246faf439';
const V6_CORPUS_DIGEST_1_8_4 = '46883250eed73f4593bfdd7bd2a4bd0a4229bd6da6b041932a6529751d5ba432';
const V6_CORPUS_CHANGED_1_8_4 = Object.freeze([
  'valid no ticks', 'valid combo above kills', 'valid squeezed to 60',
  'realistic no ticks', 'realistic combo above kills', 'realistic squeezed to 60', 'realistic squeezed to 1200', 'realistic caches x3',
  'level-90 no ticks', 'level-90 combo above kills', 'level-90 squeezed to 60', 'level-90 squeezed to 1200', 'level-90 caches x3',
]);
// Each case whose verdict changed, and the one reject it now carries.
const V6_VERDICTS_CHANGED_1_8_4 = Object.freeze({
  'valid combo above kills': 'combo-above-kills',
  'realistic combo above kills': 'combo-above-kills',
  'realistic caches x3': 'pickups-above-capacity',
  'level-90 combo above kills': 'combo-above-kills',
  'level-90 caches x3': 'pickups-above-capacity',
});
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

// A result without the 1.8.4 consistency flags, with its verdict recomputed.
const withoutConsistency = (result) => {
  const flags = result.flags.filter((flag) => !HMH_V6_CONSISTENCY_REJECTS.includes(flag.id));
  return { verdict: flags.some((flag) => flag.severity === 'reject') ? 'rejected' : flags.length ? 'flagged' : 'ok', flags };
};

test('the v6 path gives every schema-6 summary its 1.8.1 result (frozen), apart from the 1.8.4 consistency rejects', () => {
  const results = v6Corpus().map(([name, summary]) => [name, validateRebootRunPlausibility(summary)]);
  const digest = createHash('sha256').update(JSON.stringify(results)).digest('hex');
  assert.equal(digest, V6_CORPUS_DIGEST_1_8_4, `${results.length} cases`);
  const asAt181 = results.map(([name, result]) => [name, withoutConsistency(result)]);
  assert.equal(createHash('sha256').update(JSON.stringify(asAt181)).digest('hex'), V6_CORPUS_DIGEST, 'without the consistency flags, every result is the 1.8.1 result');
  const changed = results.filter(([, result], index) => JSON.stringify(result) !== JSON.stringify(asAt181[index][1])).map(([name]) => name);
  assert.deepEqual(changed, V6_CORPUS_CHANGED_1_8_4);
  const verdictChanged = results.filter(([, result], index) => result.verdict !== asAt181[index][1].verdict).map(([name]) => name);
  assert.deepEqual(verdictChanged, Object.keys(V6_VERDICTS_CHANGED_1_8_4));
  for (const [name, result] of results) {
    if (Object.hasOwn(V6_VERDICTS_CHANGED_1_8_4, name)) assert.deepEqual(result.flags.filter((flag) => flag.severity === 'reject').map((flag) => flag.id), [V6_VERDICTS_CHANGED_1_8_4[name]], name);
  }
});

// ---------------------------------------------------------------------------
// The v6 consistency rules (1.8.4): grenade kills, pickups and districts, and
// (second round, contract §16.6) the ticks, weapons, grenade trail, damage and
// combo that the achievement stats read.
const C6 = HMH_RUN_SUMMARY_CATALOGS_V6;
const V6C = HMH_V6_CONSISTENCY_RULES;
const rowOf = (rows, key, id) => rows.find((entry) => entry[key] === id);
const consistencyRejects = (result) => rejects(result).filter((id) => HMH_V6_CONSISTENCY_REJECTS.includes(id));
// The first seed that enters at each level entry, in LEVEL_ONE_ENTRIES order.
const ENTRY_SEEDS = Object.freeze(LEVEL_ONE_ENTRIES.map(({ id }) => {
  for (let seed = 1; ; seed += 1) if (selectLevelEntry(seed).id === id) return seed;
}));
// A run of `ticks` ticks at `seed` with no progress at all: the Coin Blaster
// held on every tick, no damage dealt.
function idleRun(ticks, { seed = valid.identity.seed, mask = 0 } = {}) {
  return clone(valid, (s) => {
    s.identity.seed = seed;
    s.identity.endTick = ticks;
    Object.assign(s.totals, { survivalTicks: ticks, elapsedMs: ticks * FIXED_STEP_MS, score: 0, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, damageDealt: 0 });
    s.kills.total = 0;
    s.kills.elite = 0;
    s.kills.boss = 0;
    for (const entry of [...s.kills.byEnemyRole, ...s.kills.byWeapon]) entry.count = 0;
    for (const weapon of s.weapons) Object.assign(weapon, { kills: 0, damage: 0, equippedTicks: weapon.weaponId === 'coin-blaster' ? ticks : 0 });
    for (const upgrade of s.upgrades) { upgrade.offered = 0; upgrade.selected = 0; }
    s.grenades.kills = 0;
    s.exploration.visitedDistrictMask = mask;
    Object.assign(s.milestones, { levelUps: 0, firstLevelUpTick: 0, lastLevelUpTick: 0 });
  });
}
const DISTRICT_REJECTS = Object.freeze(['district-path-invalid', 'districts-before-travel-time']);
const districtFlags = (result) => result.flags.filter((flag) => DISTRICT_REJECTS.includes(flag.id));
// Moves `count` of the summary's kills from the Coin Blaster to `weaponId`.
function creditWeapon(summary, weaponId, count) {
  for (const [rows, field] of [[summary.kills.byWeapon, 'count'], [summary.weapons, 'kills']]) {
    rowOf(rows, 'weaponId', 'coin-blaster')[field] -= count;
    rowOf(rows, 'weaponId', weaponId)[field] += count;
  }
}
// Gives the summary's grenade-weapon and nuke kills the least trail the child
// records for them: one hand grenade thrown for Satoshi Frag kills, a Launcher
// Rig cache picked up and one launcher shot for launcher kills, a detonation
// per launch, one blast contact per grenade kill, and a nuke collected for
// Nuke Liquidation kills.
function withGrenadeTrail(summary) {
  const kills = (weaponId) => rowOf(summary.kills.byWeapon, 'weaponId', weaponId).count;
  if (kills('satoshi-frag') > 0) summary.grenades.thrown = Math.max(1, summary.grenades.thrown);
  const launcher = rowOf(summary.weapons, 'weaponId', 'launcher-rig');
  if (kills('launcher-rig') > 0) {
    const cache = rowOf(summary.collectibles, 'effectId', 'launcher-rig-cache');
    cache.collected = Math.max(1, cache.collected);
    Object.assign(launcher, { pickups: Math.max(1, launcher.pickups), triggers: Math.max(1, launcher.triggers) });
  }
  summary.grenades.detonated = summary.grenades.thrown + launcher.triggers;
  summary.grenades.contacts = Math.max(summary.grenades.contacts, summary.grenades.kills);
  if (kills('nuke-liquidation') > 0) {
    const nuke = rowOf(summary.collectibles, 'effectId', 'nuke-liquidation');
    nuke.collected = Math.max(1, nuke.collected);
  }
  return summary;
}

test('the v6 consistency literals equal the 1.8.x child', () => {
  // Grenade kills: recordRunKill counts one exactly when the killing weapon is
  // a grenade weapon, and no other accumulator call writes the count.
  const accumulator = createRunSummaryAccumulator({ seed: 1, buildHash: 'site-1.8.2:game-1.8.2', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 800, y: 2_400 } });
  C6.weapons.forEach((weaponId, index) => {
    for (let kill = 0; kill <= index; kill += 1) recordRunKill(accumulator, { enemyRoleId: 'forkrunner', weaponId });
  });
  const summary = finalizeRunSummary(accumulator, { endTick: 0, elapsedMs: 0, terminalReason: 'defeated', score: 0, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 0 });
  const grenadeWeaponKills = V6C.grenadeWeapons.reduce((sum, weaponId) => sum + rowOf(summary.kills.byWeapon, 'weaponId', weaponId).count, 0);
  assert.equal(summary.grenades.kills, grenadeWeaponKills);
  assert.equal(grenadeWeaponKills, (C6.weapons.indexOf('satoshi-frag') + 1) + (C6.weapons.indexOf('launcher-rig') + 1));
  assert.throws(() => recordRunGrenade(accumulator, { type: 'kills' }), /unknown grenade event/);
  const accumulatorSource = readFileSync(new URL('../sdk/hmh-run-summary.mjs', import.meta.url), 'utf8');
  assert.deepEqual(accumulatorSource.match(/grenades\[3\][^;]*;/g), ['grenades[3] += 1;']);
  assert.match(accumulatorSource, /if \(weaponId === 'satoshi-frag' \|\| weaponId === 'launcher-rig'\) state\.grenades\[3\] \+= 1;/);

  // Pickups: the 21 placements main.mjs gives the collectible system, per
  // effect, with their re-arm ticks, and the one place a pickup is recorded.
  const rearmed = HMH_CHILD_REARMED_ASSETS.map((id) => `'${id}'`).join(',');
  assert.ok(MAIN_SOURCE.includes(`const collectiblePlacements = [...authoredPointOfInterestPlacements.map(p=>[${rearmed}].includes(p.assetId)?Object.freeze({...p,respawnTicks:${HMH_CHILD_REARM_TICKS}}):p), ...scheduledCollectiblePlacements];`));
  assert.ok(MAIN_SOURCE.includes('const scheduledCollectiblePlacements = [lightningLedgerEventPlacement, bearMarketBurnerEventPlacement, forkedStandardEventPlacement];'));
  assert.equal(MAIN_SOURCE.match(/createCollectibleState\(/g).length, 1);
  assert.ok(MAIN_SOURCE.includes('collectibleState = createCollectibleState({ placements: collectiblePlacements, objectivePlacements: objectiveRewardPlacements() });'));
  assert.equal(MAIN_SOURCE.match(/recordRunCollectible\(runSummaryAccumulator/g).length, 1);
  assert.match(MAIN_SOURCE, /if \(event\.type !== 'collectible:collected'\) continue;\s*recordRunCollectible\(runSummaryAccumulator, \{ effectId: event\.effectId \}\);/);
  // Per placement: its re-arm ticks, and its unlock: the objective that gates
  // it, else its availableTick, which for a seeded event is at least the
  // event's minimum (the table holds the minimum; the tick is seeded).
  const eventMinimum = { 'lightning-ledger-cache': LIGHTNING_EVENT_MIN_TICK, 'bear-market-burner-cache': BEAR_MARKET_BURNER_EVENT_BOUNDS.minTick, 'forked-standard-cache': FORKED_STANDARD_CONFIG.eventMinTick };
  const sorted = (table) => Object.fromEntries(Object.entries(table).map(([id, list]) => [id, list.map((entry) => JSON.stringify(entry)).sort()]));
  for (const seed of [1, 123, 0xdead_beef, ...ENTRY_SEEDS]) {
    const table = Object.fromEntries(C6.collectibles.map((effectId) => [effectId, []]));
    for (const { placement, effect } of hmhChildCollectibleState(seed).entries) {
      let unlock = placement.requiredObjective ?? placement.availableTick;
      if (!placement.requiredObjective && placement.availableTick > 0) {
        assert.ok(placement.availableTick >= eventMinimum[effect.effectId], `seed ${seed}: ${placement.id} at ${placement.availableTick}`);
        unlock = eventMinimum[effect.effectId];
      }
      table[effect.effectId].push([placement.respawnTicks ?? 0, unlock]);
    }
    assert.deepEqual(sorted(table), sorted(V6C.pickupPlacements), `seed ${seed}`);
  }
  assert.deepEqual(Object.keys(V6C.pickupPlacements), [...C6.collectibles]);
  // The events' minimum ticks, where each module draws its seeded tick.
  assert.match(readFileSync(new URL('../apps/hmh-reboot/src/lightning-ledger-event.mjs', import.meta.url), 'utf8'), /const availableTick = MIN_EVENT_TICK \+ mix\(/);
  assert.match(readFileSync(new URL('../apps/hmh-reboot/src/bear-market-burner-event.mjs', import.meta.url), 'utf8'), /const availableTick = BEAR_MARKET_BURNER_EVENT_BOUNDS\.minTick\s*\+ mix\(/);
  assert.match(readFileSync(new URL('../apps/hmh-reboot/src/forked-standard-event.mjs', import.meta.url), 'utf8'), /const availableTick = FORKED_STANDARD_CONFIG\.eventMinTick\s*\+ mix\(/);
  // Every objective is a machinery site of the summary's catalogue, or the vault.
  assert.deepEqual([...new Set(objectiveRewardPlacements().map((placement) => placement.requiredObjective))].sort(), [...C6.worldSites, V6C.vaultObjective].sort());
  // A site unlocks its rewards in the step that records its milestone; the
  // vault unlocks only in the Liquidator kill's branch; nothing else unlocks.
  assert.match(MAIN_SOURCE, /recordRunMilestone\(runSummaryAccumulator,\{type:'site-operated',id:event\.siteId,tick\}\);\s*collectibleState\.unlockedObjectives\.add\(event\.siteId\);/);
  assert.match(MAIN_SOURCE, /if \(scoreEvent\.enemyId === liquidatorBoss\.id\) \{\s*if\(liquidatorBoss\.health<=0\)\{collectibleState\.unlockedObjectives\.add\('liquidator-defeated'\);[^\n]*\n\s*recordRunKill\(runSummaryAccumulator, \{\s*enemyRoleId: 'liquidator',\s*weaponId: scoreEvent\.weaponId,\s*boss: true,/);
  assert.equal(MAIN_SOURCE.match(/unlockedObjectives\.add\(/g).length, 2);
  // stepCollectibles never collects before the simulation's first tick.
  assert.equal(V6C.firstTick, 1);
  const simulation = new DeterministicSimulation({ seed: 1 });
  const steppedTicks = [];
  simulation.onStep((step) => steppedTicks.push(step.tick));
  simulation.start();
  simulation.update(FIXED_STEP_MS * 2 + 0.5);
  assert.deepEqual(steppedTicks, [1, 2], 'the first step is tick 1');

  // Districts and entries.
  assert.deepEqual(V6C.districtStrips, LEVEL_ONE_WORLD.districts.map(({ id, area }) => [id, area.minX, area.maxX]));
  assert.ok(LEVEL_ONE_WORLD.districts.every(({ area }) => area.minY === LEVEL_ONE_WORLD.bounds.minY && area.maxY === LEVEL_ONE_WORLD.bounds.maxY));
  assert.deepEqual(V6C.districtStrips.map(([id]) => id), [...C6.districts]);
  assert.equal(getLevelOneDistrictAt(1_800, 2_400).id, 'frontier-relay', 'a seam belongs to the strip west of it');
  assert.deepEqual(V6C.levelEntries, LEVEL_ONE_ENTRIES.map(({ id, x, y }) => [id, x, y]));
  for (let index = 0; index < 20_000; index += 1) {
    const seed = (index * 2_654_435_761) >>> 0;
    assert.equal(hmhV6LevelEntry(seed).id, selectLevelEntry(seed).id, `seed ${seed}`);
  }
  for (const seed of [0, 1, 0xffff_ffff]) assert.equal(hmhV6LevelEntry(seed).id, selectLevelEntry(seed).id);
  // Every entry lies at least 250 units inside its strip, far beyond one tick of travel.
  for (const [, x] of V6C.levelEntries) {
    const [, minX, maxX] = V6C.districtStrips.find(([, low, high]) => x >= low && x <= high);
    assert.ok(Math.min(x - minX, maxX - x) >= 250 && Math.min(x - minX, maxX - x) > V6C.travel.maxStepPx);
  }
  // A Ranked session always starts at the seed's entry (evidenceSafe moves the
  // spawn only outside Ranked; see the evidenceSafe test below).
  assert.ok(MAIN_SOURCE.includes('runtimePlayerSpawn = evidenceGameplayEnabled ? evidencePlayerSpawn : selectLevelEntry(payload.session.seed);'));
  assert.ok(MAIN_SOURCE.includes('actor = createActorSpatialState({ ...runtimePlayerSpawn, z: 0 });'));
  assert.ok(MAIN_SOURCE.includes("districtId: getLevelOneDistrictAt(actor.x, actor.y)?.id ?? 'frontier-relay',"));
  assert.equal(MAIN_SOURCE.match(/recordRunTick\(/g).length, 1);

  // Travel: twice the fastest tick the child allows. A dash tick moves
  // DASH_DISTANCE / DASH_DURATION_TICKS; a running tick moves at most the top
  // speed at the maximum movement ranks, time dilation and the steepest
  // downhill, plus the one conveyor's push, plus a fresh maximum recoil or
  // knockback impulse every tick (whose decaying velocity moves the player
  // impulse x recoilDecayTime in all).
  const moveRanks = 1 + Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => upgrade.effect === 'moveSpeedMultiplier').reduce((sum, upgrade) => sum + upgrade.amount * upgrade.maxRank, 0);
  const downhill = Math.max(...[0.01, 0.5, 1, 10, 1_000].map((drop) => movementSpeedMultiplierForTransition({ groundZ: drop, kind: 'ground' }, { groundZ: 0, kind: 'ground' }, 1)));
  assert.equal(downhill, 1.04);
  const runTick = LEVEL_ONE_WORLD.player.maxSpeed * moveRanks * COLLECTIBLE_EFFECTS['time-dilation'].speedMultiplier * downhill / 60;
  assert.match(MAIN_SOURCE, /magnitude: 70,/);
  assert.match(MAIN_SOURCE, /knockback: event\.role === 'bruiser' \? 32 : 12,/);
  assert.match(MAIN_SOURCE, /knockback: event\.attackId\.includes\('super'\) \? 36 : 20,/);
  const heightBonus = resolveHeightAdvantage({ sourceZ: 1_000, targetZ: 0, baseRange: 1, baseKnockback: 1 }).knockback;
  const impulse = Math.max(...Object.values(HMH_WEAPON_DEFINITIONS).map((weapon) => weapon.recoil ?? 0), 70, 36 * heightBonus, HMH_GRENADE_DEFINITION.knockback);
  assert.equal(impulse, 74);
  const recoilTick = impulse * createPlayerMotionState().recoilDecayTime;
  const conveyorTick = WORLD_HAZARD_RULES['moving-hazard'].push / 60;
  const dashTick = DASH_DISTANCE / DASH_DURATION_TICKS;
  assert.equal(dashTick, 24);
  assert.ok(runTick + recoilTick + conveyorTick < 20, `a running tick moves at most ${runTick + recoilTick + conveyorTick}`);
  assert.equal(V6C.travel.maxStepPx, 2 * Math.max(dashTick, runTick + recoilTick + conveyorTick));
});

test('the second-round consistency literals and the accumulator facts they rest on equal the 1.8.x child', () => {
  const accumulatorSource = readFileSync(new URL('../sdk/hmh-run-summary.mjs', import.meta.url), 'utf8');
  const fresh = () => createRunSummaryAccumulator({ seed: 1, buildHash: 'site-1.8.2:game-1.8.2', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 800, y: 2_400 } });
  const finish = (accumulator, endTick) => finalizeRunSummary(accumulator, { endTick, elapsedMs: endTick * FIXED_STEP_MS, terminalReason: 'defeated', score: 0, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 0 });

  // Recorded ticks: one equipped tick for the active weapon and the district
  // bit on each recordRunTick, ticks strictly rising from after the start, and
  // the end tick at or after the last one.
  const ticks = fresh();
  for (const [tick, weaponId, districtId] of [[1, 'coin-blaster', 'frontier-relay'], [2, 'coin-blaster', 'frontier-relay'], [7, 'hash-rail', 'rugpull-ravine']]) {
    recordRunTick(ticks, { tick, position: { x: 800 + tick, y: 2_400 }, activeWeaponId: weaponId, districtId, level: 1 });
  }
  assert.throws(() => recordRunTick(ticks, { tick: 7, position: { x: 0, y: 0 }, activeWeaponId: 'coin-blaster', districtId: 'frontier-relay' }), /monotonic/);
  assert.throws(() => finish(ticks, 6), /precedes/);
  const recorded = finish(ticks, 7);
  assert.equal(recorded.weapons.reduce((sum, row) => sum + row.equippedTicks, 0), 3);
  assert.equal(recorded.exploration.visitedDistrictMask, 0b11);
  assert.throws(() => recordRunTick(fresh(), { tick: 0, position: { x: 0, y: 0 }, activeWeaponId: 'coin-blaster', districtId: 'frontier-relay' }), /monotonic/, 'no tick at or before the start');

  // Damage: the same whole amount to the total and the weapon, for the
  // player's hits on anything but the player; combat-events rounds it.
  const damage = fresh();
  recordRunDamage(damage, { targetId: 'enemy-1', sourceId: 'player', weaponId: 'coin-blaster', damageApplied: 17, healthBefore: 40 });
  recordRunDamage(damage, { targetId: 'enemy-2', sourceId: 'player', weaponId: 'satoshi-frag', damageApplied: 61, healthBefore: 40 });
  recordRunDamage(damage, { targetId: 'player', sourceId: 'enemy-3', weaponId: 'enemy-gas-bomber', damageApplied: 9, equippedWeaponId: 'coin-blaster' });
  recordRunDamage(damage, { targetId: 'enemy-4', sourceId: 'world-fuel', weaponId: 'world-fuel', damageApplied: 50, healthBefore: 40 });
  const damaged = finish(damage, 1);
  assert.equal(damaged.totals.damageDealt, 78);
  assert.equal(damaged.weapons.reduce((sum, row) => sum + row.damage, 0), 78);
  assert.match(accumulatorSource, /if \(event\.sourceId !== 'player'\) return;\s*state\.totals\[0\] \+= amount;\s*const row = state\.weapons\[index\(C\.weapons, event\.weaponId, 'weapon'\)\];\s*row\[10\] \+= amount;/);
  assert.match(readFileSync(new URL('../apps/hmh-reboot/src/combat-events.mjs', import.meta.url), 'utf8'), /damageApplied = Math\.max\(1, Math\.round\(rawDamage \/ armorDivisor\)\);/);
  assert.equal(MAIN_SOURCE.match(/recordRunDamage\(runSummaryAccumulator/g).length, 1);

  // Grenades: a detonation records one contact per non-player hit; a launcher
  // shot is a trigger; thrown is recorded only for a spawned hand grenade.
  const blasts = fresh();
  recordRunGrenadeDetonation(blasts, { grenadeId: 'satoshi-frag:00000000', hits: [{ targetId: 'enemy-1' }, { targetId: 'player' }, { targetId: 'enemy-2' }] });
  recordRunWeaponFire(blasts, { weaponId: 'launcher-rig', emitted: 0 });
  const blasted = finish(blasts, 1);
  assert.deepEqual([blasted.grenades.detonated, blasted.grenades.contacts, rowOf(blasted.weapons, 'weaponId', 'launcher-rig').triggers], [1, 2, 1]);
  assert.equal(MAIN_SOURCE.match(/throwGrenade\(grenadeSystem/g).length, 2);
  assert.match(MAIN_SOURCE, /if \(event\.weaponId === 'launcher-rig'\) \{\s*const launch = throwGrenade\(grenadeSystem, \{\s*tick,\s*mode: 'launcher',[\s\S]{0,600}?\}\);\s*recordRunWeaponFire\(runSummaryAccumulator, \{ weaponId: event\.weaponId, emitted: launch\.spawned \? 1 : 0, attackId: event\.attackId \}\);/);
  assert.match(MAIN_SOURCE, /const grenadeSpawn = throwGrenade\(grenadeSystem, \{\s*tick,\s*mode: 'hand',[\s\S]{0,600}?\}\);\s*if \(grenadeSpawn\.spawned\) \{\s*recordRunGrenade\(runSummaryAccumulator, \{ type: 'thrown' \}\);/);
  assert.equal(MAIN_SOURCE.match(/type: 'thrown'/g).length, 1);
  assert.match(MAIN_SOURCE, /for \(const detonation of grenadeFrame\.detonations\) \{\s*recordRunGrenadeDetonation\(runSummaryAccumulator, detonation\);/);
  assert.match(MAIN_SOURCE, /for \(const hit of detonation\.hits\) combatHitIntents\.push\(\{ \.\.\.hit, tick \}\);/);
  // Only a blast hit carries a grenade weapon's id: grenades.mjs names each
  // blast hit by its grenade's mode, and main.mjs names neither weapon in a hit.
  assert.equal(HMH_GRENADE_DEFINITION.id, V6C.handGrenades.weaponId);
  assert.match(readFileSync(new URL('../apps/hmh-reboot/src/grenades.mjs', import.meta.url), 'utf8'), /weaponId: grenade\.mode === 'launcher' \? 'launcher-rig' : HMH_GRENADE_DEFINITION\.id,/);
  assert.doesNotMatch(MAIN_SOURCE, /weaponId: '(satoshi-frag|launcher-rig)'/);
  assert.equal(V6C.launcherWeapon, 'launcher-rig');

  // Hand grenade supply: three charges, one per Extra Grenade rank (the only
  // grenade upgrade), and one per recharge; only the nuke-liquidation effect
  // recharges (the Nuke, and the Scrypt Cache's grenade-supply kind).
  assert.ok(MAIN_SOURCE.includes(`grenadeSystem = createGrenadeSystem({ capacity: MAX_ACTIVE_GRENADES, handCharges: ${V6C.handGrenades.startCharges} });`));
  const grenadeUpgrades = Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => upgrade.effect === 'bonusGrenadeCharges');
  assert.deepEqual(grenadeUpgrades.map(({ id, amount, maxRank }) => [id, amount, maxRank]), [[V6C.handGrenades.rankUpgradeId, V6C.handGrenades.chargesPerRank, V6C.handGrenades.maxRanks]]);
  assert.equal(MAIN_SOURCE.match(/handCharges \+=/g).length, 1);
  assert.ok(MAIN_SOURCE.includes('if (grenadeSystem && grenadeGain > 0) grenadeSystem.handCharges += grenadeGain;'));
  assert.equal(MAIN_SOURCE.match(/rechargeHandGrenades\(grenadeSystem/g).length, 2);
  assert.match(MAIN_SOURCE, /\} else if \(event\.kind === 'grenade-supply'\) \{\s*rechargeHandGrenades\(grenadeSystem,\{tick,amount:1\}\);\s*\} else if \(event\.kind === 'nuke'\) \{\s*rechargeHandGrenades\(grenadeSystem, \{ tick, amount: 1 \}\);/);
  const rechargingEffects = new Set([
    ...Object.values(COLLECTIBLE_EFFECTS).filter((effect) => ['nuke', 'grenade-supply'].includes(effect.kind)).map((effect) => effect.effectId),
    ...objectiveRewardPlacements().filter((placement) => ['nuke', 'grenade-supply'].includes(placement.kind)).map((placement) => COLLECTIBLE_EFFECTS[placement.assetId].effectId),
  ]);
  assert.deepEqual([...rechargingEffects], [V6C.handGrenades.refillEffectId]);
  assert.deepEqual(V6C.nuke, { weaponId: 'nuke-liquidation', effectId: 'nuke-liquidation' });
  assert.match(MAIN_SOURCE, /\} else if \(event\.kind === 'nuke'\) \{[\s\S]{0,400}?weaponId: 'nuke-liquidation',/);
  assert.equal(MAIN_SOURCE.match(/'nuke-liquidation'/g).length, 1, 'only the nuke event hits with the nuke');

  // Weapons: WEAPON_ORDER is the loadout, its first weapon the only one owned
  // at the start, and a weapon is owned only through grantWeaponPickup.
  const order = JSON.parse(/const WEAPON_ORDER = Object\.freeze\((\[[^\]]*\])\);/.exec(MAIN_SOURCE)[1].replaceAll("'", '"'));
  assert.deepEqual(order, V6C.activeWeapons);
  assert.ok(MAIN_SOURCE.includes('weaponLoadout = createWeaponLoadout({ weaponIds: WEAPON_ORDER, activeWeaponId: WEAPON_ORDER[0], seed: payload.session.seed });'));
  assert.ok(MAIN_SOURCE.includes('activeWeaponId: weaponLoadout.activeWeaponId,'));
  const newLoadout = () => createWeaponLoadout({ weaponIds: V6C.activeWeapons, activeWeaponId: V6C.activeWeapons[0], seed: 1 });
  const loadout = newLoadout();
  assert.deepEqual(Object.entries(loadout.weapons).filter(([, weapon]) => weapon.owned).map(([id]) => id), [V6C.activeWeapons[0]]);
  for (const weaponId of V6C.activeWeapons.slice(1)) {
    assert.throws(() => selectWeapon(newLoadout(), weaponId, { tick: 1 }), /unowned/, weaponId);
    assert.throws(() => switchWeapon(newLoadout(), weaponId, { tick: 1 }), /unowned/, weaponId);
  }
  grantWeaponPickup(loadout, { tick: 1, weaponId: 'hash-rail', select: true });
  assert.equal(loadout.activeWeaponId, 'hash-rail');
  const weaponSystemSource = readFileSync(new URL('../apps/hmh-reboot/src/weapon-system.mjs', import.meta.url), 'utf8');
  assert.equal(weaponSystemSource.match(/weapon\.owned = true;/g).length, 1, 'grantWeaponPickup is the one grant');
  // Each weapon pickup the summary records comes from a weapon cache of that
  // weapon (or the evidence-only weaponPilot, which the portal never forwards).
  assert.deepEqual(Object.fromEntries(Object.values(COLLECTIBLE_EFFECTS).filter((effect) => effect.kind === 'weapon-cache').map((effect) => [effect.weaponId, effect.effectId])), V6C.weaponCaches);
  assert.ok(Object.values(COLLECTIBLE_EFFECTS).every((effect) => effect.bonusWeaponId === undefined), 'no cache grants a second weapon');
  assert.deepEqual(MAIN_SOURCE.match(/recordRunWeaponEvent\(runSummaryAccumulator, \{ type: 'pickup', weaponId[^}]*\}\);/g), [
    "recordRunWeaponEvent(runSummaryAccumulator, { type: 'pickup', weaponId });",
    "recordRunWeaponEvent(runSummaryAccumulator, { type: 'pickup', weaponId: event.weaponId });",
    "recordRunWeaponEvent(runSummaryAccumulator, { type: 'pickup', weaponId: event.bonusWeaponId });",
  ]);
  assert.match(MAIN_SOURCE, /if \(weaponPilotEnabled\) \{\s*for \(const weaponId of WEAPON_ORDER\) \{\s*if \(weaponId !== weaponLoadout\.activeWeaponId\) \{\s*grantWeaponPickup\(weaponLoadout, \{ tick: 0, weaponId, select: false \}\);/);
  assert.match(MAIN_SOURCE, /\} else if \(event\.kind === 'weapon-cache'\) \{[\s\S]{0,300}?grantWeaponPickup\(weaponLoadout, \{ tick, weaponId: event\.weaponId, select: true, progressionByWeapon \}\);/);

  // The combo: +1 per recorded kill (awardComboXp follows each recordRunKill
  // of a defeat), reset to 0 on a hit, and the best combo is what finalize gets.
  assert.ok(MAIN_SOURCE.includes('const feedback = updateRunCombo(runCombo + 1, { bossDefeated });'));
  assert.ok(MAIN_SOURCE.includes('const updateRunCombo = (nextCombo, { bossDefeated = false, silent = false } = {}) => {'));
  assert.deepEqual(MAIN_SOURCE.match(/updateRunCombo\([^)]*\)/g), ['updateRunCombo(runCombo + 1, { bossDefeated })', 'updateRunCombo(0)']);
  assert.equal(MAIN_SOURCE.match(/awardComboXp\(recordRunDefeat\(/g).length, 2);
  assert.match(MAIN_SOURCE, /recordRunKill\(runSummaryAccumulator, \{\s*enemyRoleId: 'liquidator',[^}]*\}\);\s*runKills \+= 1;\s*const bossSnapshot = awardComboXp\(/);
  assert.match(MAIN_SOURCE, /recordRunKill\(runSummaryAccumulator, \{\s*enemyRoleId: defeatedEnemy\.archetypeId,[^}]*\}\);[\s\S]{0,700}?const progressionSnapshot = awardComboXp\(/);
  assert.equal(MAIN_SOURCE.match(/maxRunCombo = Math\.max\(/g).length, 1);
  assert.ok(MAIN_SOURCE.includes('maxCombo: maxRunCombo,'));
  for (let combo = 0; combo <= 40; combo += 1) assert.equal(resolveComboFeedback({ previous: Math.max(0, combo - 1), current: combo }).current, combo);
});

test("grenade kills above the grenade weapons' kills reject; equality passes", () => {
  for (const base of [valid, realistic, level90]) {
    for (const weaponId of V6C.grenadeWeapons) {
      const credited = Math.min(20, base.kills.total);
      const at = clone(base, (s) => { creditWeapon(s, weaponId, credited); s.grenades.kills = credited; withGrenadeTrail(s); });
      assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(at)), []);
      const above = validateRebootRunPlausibility(clone(at, (s) => { s.grenades.kills += 1; }));
      assert.deepEqual(above.flags.filter((flag) => flag.id === 'grenade-kills-above-weapon-kills'), [{ id: 'grenade-kills-above-weapon-kills', severity: 'reject', value: credited + 1, limit: credited }]);
    }
  }
  // Both grenade weapons count; no other weapon does.
  const both = clone(realistic, (s) => { creditWeapon(s, 'satoshi-frag', 30); creditWeapon(s, 'launcher-rig', 12); creditWeapon(s, 'nuke-liquidation', 40); s.grenades.kills = 42; withGrenadeTrail(s); });
  assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(both)), []);
  assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(clone(both, (s) => { s.grenades.kills = 43; s.grenades.contacts = 43; }))), ['grenade-kills-above-weapon-kills']);
});

test('the 1.8.2 grenade, pickup and district payload rejects', () => {
  // From hmh-valid (36 kills, 3 minutes from the Frontier Relay entry), only
  // these three fields change; the run verified with no flags in 1.8.2. The
  // second 1.8.4 round adds the missing blast contacts.
  const payload = clone(valid, (s) => {
    s.grenades.kills = 250;
    rowOf(s.collectibles, 'effectId', 'bonus-life').collected = 250;
    s.exploration.visitedDistrictMask = 63;
  });
  // The two authored bonus lives; the Litecoin Sanctuary's is locked (no site operated).
  assert.equal(hmhV6PickupCapacity('bonus-life', valid.totals.survivalTicks, hmhV6ObjectiveUnlocks(valid)), 2);
  assert.deepEqual(validateRebootRunPlausibility(payload), {
    verdict: 'rejected',
    flags: [
      { id: 'grenade-kills-above-weapon-kills', severity: 'reject', value: 250, limit: 0 },
      { id: 'pickups-above-capacity', severity: 'reject', value: 250, limit: 2 },
      { id: 'grenade-kills-above-contacts', severity: 'reject', value: 250, limit: 0 },
    ],
  });
  // All six districts in 3 minutes from the relay is honest: the 9,200 units
  // of travel take about 38 s at 240 units/s, so that field alone passes.
  assert.deepEqual(validateRebootRunPlausibility(clone(valid, (s) => { s.exploration.visitedDistrictMask = 63; })), { verdict: 'ok', flags: [] });
});

test('the objectives a summary unlocks: operated sites at their tick, the vault with a Liquidator kill', () => {
  assert.deepEqual(hmhV6ObjectiveUnlocks(valid), {});
  assert.deepEqual(hmhV6ObjectiveUnlocks(realistic), {});
  assert.deepEqual(hmhV6ObjectiveUnlocks(level90), { 'liquidator-defeated': HMH_BOSS_START_TICK });
  const operated = clone(valid, (s) => {
    Object.assign(rowOf(s.milestones.sites, 'siteId', 'hashwood-shrine'), { operated: 1, tick: 4_000 });
    Object.assign(rowOf(s.milestones.sites, 'siteId', 'relay-power'), { operated: 1, tick: 90 });
  });
  assert.deepEqual(hmhV6ObjectiveUnlocks(operated), { 'relay-power': 90, 'hashwood-shrine': 4_000 });
  // Either half of a Liquidator kill claims the vault (the mismatch is v6's
  // boss-count-mismatch flag); boss-before-band holds the kill to the band.
  assert.deepEqual(hmhV6ObjectiveUnlocks(clone(valid, (s) => { s.kills.boss = 1; })), { 'liquidator-defeated': HMH_BOSS_START_TICK });
  assert.deepEqual(hmhV6ObjectiveUnlocks(clone(valid, (s) => { setRoleKills(s, 'liquidator', 1); })), { 'liquidator-defeated': HMH_BOSS_START_TICK });
});

test('pickups above what the unlocked placements can give reject, per effect and at each boundary', () => {
  const every = Object.fromEntries([...C6.worldSites, V6C.vaultObjective].map((id) => [id, 0]));
  const total = (ticks, unlocks) => C6.collectibles.reduce((sum, effectId) => sum + hmhV6PickupCapacity(effectId, ticks, unlocks), 0);
  // Nothing before the simulation's first tick; then each placement once it is
  // available and unlocked, again a full re-arm period after its first tick.
  assert.equal(total(0, every), 0);
  assert.equal(total(1, every), 21 - 3, 'the three seeded events are not yet available');
  assert.equal(total(10_800, every), 21 + 3, 'the three 7,200-tick re-arms once');
  assert.equal(total(10_801, every), 21 + 3 + 7, 'and the seven 10,800-tick re-arms once');
  assert.equal(total(10_800, {}), 10 + 3, 'locked objectives give nothing');
  assert.equal(hmhV6PickupCapacity('litecoin-token', 1_000_000, every), 0);
  assert.equal(hmhV6PickupCapacity('forked-standard-cache', 10_799), 0);
  assert.equal(hmhV6PickupCapacity('forked-standard-cache', 10_800), 1);
  assert.equal(hmhV6PickupCapacity('forked-standard-cache', 1_000_000), 1);
  assert.equal(hmhV6PickupCapacity('lightning-ledger-cache', 3_599), 0);
  assert.equal(hmhV6PickupCapacity('lightning-ledger-cache', 3_600), 1);
  assert.equal(hmhV6PickupCapacity('lightning-ledger-cache', 80_000, { 'liquidator-defeated': HMH_BOSS_START_TICK }), 2);
  assert.equal(hmhV6PickupCapacity('lightning-ledger-cache', HMH_BOSS_START_TICK - 1, { 'liquidator-defeated': HMH_BOSS_START_TICK }), 1);
  const shrine = { 'hashwood-shrine': 500 };
  assert.deepEqual([499, 500, 7_699, 7_700].map((ticks) => hmhV6PickupCapacity('bonus-life', ticks, shrine)), [2, 3, 3, 4]);
  assert.deepEqual([10_800, 10_801].map((ticks) => hmhV6PickupCapacity('berserk-candle', ticks)), [1, 2]);
  assert.equal(hmhV6PickupCapacity('bonus-life', 1_000, { 'hashwood-shrine': null }), 2, 'an objective with no tick stays locked');

  for (const base of [valid, realistic, level90]) {
    const ticks = base.totals.survivalTicks;
    const unlocks = hmhV6ObjectiveUnlocks(base);
    const withPickups = (effectId, collected) => clone(base, (s) => {
      rowOf(s.collectibles, 'effectId', effectId).collected = collected;
      if (effectId === 'litecoin-token') s.totals.litecoin = collected;
    });
    for (const effectId of C6.collectibles) {
      const capacity = hmhV6PickupCapacity(effectId, ticks, unlocks);
      assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(withPickups(effectId, capacity))), [], effectId);
      assert.deepEqual(validateRebootRunPlausibility(withPickups(effectId, capacity + 1)).flags.filter((flag) => flag.id === 'pickups-above-capacity'),
        [{ id: 'pickups-above-capacity', severity: 'reject', value: capacity + 1, limit: capacity }], effectId);
    }
    // Every effect at its capacity at once passes.
    const full = clone(base, (s) => { for (const row of s.collectibles) row.collected = hmhV6PickupCapacity(row.effectId, ticks, unlocks); });
    assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(full)), []);
  }
  // Two effects above capacity: the flag sums both.
  assert.deepEqual(hmhV6PickupExcess(clone(valid, (s) => {
    rowOf(s.collectibles, 'effectId', 'hash-rail-core').collected = 3;
    rowOf(s.collectibles, 'effectId', 'time-dilation').collected = 5;
  }).collectibles, valid.totals.survivalTicks), { value: 8, limit: 1 + 1 });

  // Through the whole verdict. A site's reward counts from the site's operated
  // tick: the Quarry Salvage's Hash Rail Core only once the winch runs.
  const withSite = (run, siteId, tick) => clone(run, (s) => Object.assign(rowOf(s.milestones.sites, 'siteId', siteId), { operated: 1, tick }));
  const cores = (run, collected) => consistencyRejects(validateRebootRunPlausibility(clone(run, (s) => { rowOf(s.collectibles, 'effectId', 'hash-rail-core').collected = collected; })));
  assert.deepEqual(cores(idleRun(20_000), 1), []);
  assert.deepEqual(cores(idleRun(20_000), 2), ['pickups-above-capacity']);
  assert.deepEqual(cores(withSite(idleRun(20_000), 'ravine-winch', 20_000), 2), []);
  // A re-arm boundary: the sanctuary operated at 1,000 gives a third bonus life
  // then and a fourth at 8,200.
  const lives = (ticks, collected) => consistencyRejects(validateRebootRunPlausibility(clone(withSite(idleRun(ticks), 'hashwood-shrine', 1_000), (s) => { rowOf(s.collectibles, 'effectId', 'bonus-life').collected = collected; })));
  assert.deepEqual(lives(8_199, 3), []);
  assert.deepEqual(lives(8_199, 4), ['pickups-above-capacity']);
  assert.deepEqual(lives(8_200, 4), []);
  // The Liquidator vault needs the Liquidator kill.
  const vault = (run) => consistencyRejects(validateRebootRunPlausibility(clone(run, (s) => { rowOf(s.collectibles, 'effectId', 'lightning-ledger-cache').collected = 2; })));
  assert.deepEqual(vault(idleRun(80_000)), ['pickups-above-capacity']);
  assert.deepEqual(vault(clone(idleRun(80_000), (s) => { setRoleKills(s, 'liquidator', 1); s.kills.boss = 1; rowOf(s.kills.byWeapon, 'weaponId', 'coin-blaster').count = 1; rowOf(s.weapons, 'weaponId', 'coin-blaster').kills = 1; })), []);
  // A seeded event from its minimum tick.
  const standard = (ticks) => consistencyRejects(validateRebootRunPlausibility(clone(idleRun(ticks), (s) => { rowOf(s.collectibles, 'effectId', 'forked-standard-cache').collected = 1; })));
  assert.deepEqual(standard(10_799), ['pickups-above-capacity']);
  assert.deepEqual(standard(10_800), []);
});

test('the fastest collector through the real stepCollectibles reaches the pickup capacity and never passes it', () => {
  // For each placement alone: a player standing on it with every objective
  // unlocked, collecting on the first tick each pickup is available (and
  // collecting nothing one tick before). Placements do not interact, so the
  // sum per effect is the most any run can collect.
  const lastTick = 60_000;
  const checkpoints = [1, 3_599, 3_600, 7_199, 7_200, 7_201, 10_799, 10_800, 10_801, 21_600, 21_601, 36_000, 43_200, lastTick];
  const every = Object.fromEntries([...C6.worldSites, V6C.vaultObjective].map((id) => [id, 0]));
  for (const seed of [1, 123, 0xdead_beef]) {
    const ticksByEffect = Object.fromEntries(C6.collectibles.map((effectId) => [effectId, []]));
    const entries = hmhChildCollectibleState(seed).entries;
    for (const { placement } of entries) {
      const state = hmhChildCollectibleState(seed);
      for (const { placement: other } of state.entries) if (other.requiredObjective) state.unlockedObjectives.add(other.requiredObjective);
      const mine = (frame) => frame.events.filter((event) => event.type === 'collectible:collected' && event.placementId === placement.id);
      for (let tick = Math.max(1, placement.availableTick); tick <= lastTick; tick += placement.respawnTicks) {
        if (tick - 1 > Math.max(0, state.lastTick)) assert.deepEqual(mine(stepCollectibles(state, { tick: tick - 1, player: placement })), [], `${placement.id} early at ${tick - 1}`);
        const collected = mine(stepCollectibles(state, { tick, player: placement }));
        assert.equal(collected.length, 1, `${placement.id} at ${tick}`);
        ticksByEffect[collected[0].effectId].push(tick);
        if (!placement.respawnTicks) break;
      }
    }
    // The simulation's first tick is 1, so a placement available from tick a
    // gives 1 + floor((T - max(1, a)) / r) pickups by tick T. The capacity
    // counts the same from its table tick, which for a seeded event is the
    // event's minimum (at or before the seeded tick), so it is exact wherever
    // every placement of the effect is available from tick 0.
    for (const ticks of checkpoints) {
      for (const effectId of C6.collectibles) {
        const most = ticksByEffect[effectId].filter((tick) => tick <= ticks).length;
        const exact = entries.filter(({ effect }) => effect.effectId === effectId).reduce((sum, { placement }) => {
          const first = Math.max(1, placement.availableTick);
          return sum + (ticks < first ? 0 : placement.respawnTicks ? 1 + Math.floor((ticks - first) / placement.respawnTicks) : 1);
        }, 0);
        const capacity = hmhV6PickupCapacity(effectId, ticks, every);
        assert.equal(most, exact, `seed ${seed}, ${effectId} at ${ticks}`);
        assert.ok(exact <= capacity, `seed ${seed}, ${effectId} at ${ticks}`);
        if (entries.every(({ effect, placement }) => effect.effectId !== effectId || placement.availableTick <= 1)) {
          assert.equal(exact, capacity, `tight: seed ${seed}, ${effectId} at ${ticks}`);
        }
      }
    }
  }
});

test("the visited districts must be one run of strips around the seed's entry", () => {
  const contiguousAround = (mask, strip) => mask === 0 || (/^0*1+0*$/.test(mask.toString(2).padStart(6, '0')) && Math.floor(mask / 2 ** strip) % 2 === 1);
  LEVEL_ONE_ENTRIES.forEach((entry, index) => {
    const seed = ENTRY_SEEDS[index];
    const strip = V6C.districtStrips.findIndex(([id]) => id === getLevelOneDistrictAt(entry.x, entry.y).id);
    assert.equal(hmhV6LevelEntry(seed).strip, strip);
    for (let mask = 0; mask < 64; mask += 1) {
      const { pathValid, entryBit } = hmhV6DistrictTravel(seed, mask);
      assert.equal(pathValid, contiguousAround(mask, strip), `${entry.id} mask ${mask}`);
      assert.equal(entryBit, 2 ** strip);
      // Through the verdict, with all the time in the world.
      const result = validateRebootRunPlausibility(idleRun(216_000, { seed, mask }));
      assert.deepEqual(result.flags.filter((flag) => HMH_V6_CONSISTENCY_REJECTS.includes(flag.id)),
        pathValid ? [] : [{ id: 'district-path-invalid', severity: 'reject', value: mask, limit: 2 ** strip }], `${entry.id} mask ${mask}`);
    }
  });
});

test("visited districts farther from the entry than the run's ticks can cover reject, at the boundary", () => {
  const [relay, ravine, hashwood, mining, yard] = ENTRY_SEEDS;
  // The travel to both ends of the run of strips, by hand.
  assert.equal(hmhV6DistrictTravel(relay, 63).travelPx, 10_000 - 800);
  assert.equal(hmhV6DistrictTravel(relay, 1).travelPx, 0);
  assert.equal(hmhV6DistrictTravel(ravine, 3).travelPx, 2_100 - 1_800);
  assert.equal(hmhV6DistrictTravel(hashwood, 63).travelPx, (6_900 - 1_800) + (10_000 - 6_900) + (10_000 - 6_900));
  assert.equal(hmhV6DistrictTravel(mining, 0b111000).travelPx, (8_250 - 8_000) + (10_000 - 8_250) + (8_250 - 8_000));
  assert.equal(hmhV6DistrictTravel(yard, 63).travelPx, 10_400 - 1_800);
  assert.equal(hmhV6MinTicksForTravel(9_200), Math.ceil((9_200 - 480) / 48));
  assert.equal(hmhV6MinTicksForTravel(480), 0);
  for (const seed of ENTRY_SEEDS) {
    for (let mask = 1; mask < 64; mask += 1) {
      const { pathValid, travelPx } = hmhV6DistrictTravel(seed, mask);
      if (!pathValid) continue;
      const minTicks = hmhV6MinTicksForTravel(travelPx);
      const covered = (ticks) => ticks * V6C.travel.maxStepPx + V6C.travel.allowancePx >= travelPx;
      assert.ok(covered(minTicks) && (minTicks === 0 || !covered(minTicks - 1)));
      assert.deepEqual(districtFlags(validateRebootRunPlausibility(idleRun(minTicks, { seed, mask }))), [], `seed ${seed} mask ${mask} at ${minTicks}`);
      // A district needs a recorded tick, so a zero-tick run with one rejects
      // activity-without-time even where the travel budget covers it.
      assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(idleRun(Math.max(1, minTicks), { seed, mask }))), [], `seed ${seed} mask ${mask}`);
      if (minTicks === 0) {
        assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(idleRun(0, { seed, mask }))), ['activity-without-time'], `seed ${seed} mask ${mask}`);
        continue;
      }
      const short = validateRebootRunPlausibility(idleRun(minTicks - 1, { seed, mask }));
      assert.deepEqual(districtFlags(short),
        [{ id: 'districts-before-travel-time', severity: 'reject', value: minTicks - 1, limit: minTicks }], `seed ${seed} mask ${mask}`);
    }
  }
});

test("the committed v6 fixtures and the fixture builder's walk meet the consistency rules", () => {
  for (const summary of [valid, realistic, level90]) assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(summary)), []);
  // The builder walks one strip per 7,200 ticks from the seed's entry; from
  // the Frontier Relay that is the walk the fixtures were built with.
  assert.equal(hmhV6LevelEntry(valid.identity.seed).id, 'relay');
  assert.equal(valid.exploration.visitedDistrictMask, 0b11);
  assert.equal(realistic.exploration.visitedDistrictMask, 63);
  assert.equal(level90.exploration.visitedDistrictMask, 63);
});

// scripts/rehearse-step7-dry-run.mjs and the settle rehearsals build these
// plans at whatever seed the ticket carries, so each must pass every rule from
// every level entry, not only at the committed fixtures' seed.
test('the v6 fixture plans meet every consistency rule from every level entry', async () => {
  for (const plan of Object.keys(HMH_PLANS)) {
    for (const seed of [...ENTRY_SEEDS, 0, 0xffff_ffff]) {
      const identity = { sessionId: `game-session-plan-${seed}`, chainId: 4441, scoreRegistryAddress: `0x${'1'.repeat(40)}`, wallet: `0x${'2'.repeat(40)}`, gameId: 'lester-blaster', seasonId: 1, buildHash: 'site-1.8.3:game-1.8.3', seed, nonce: 'plan' };
      const { runSummary } = await buildHmhEvidence({ seed, buildHash: identity.buildHash, identity, plan });
      assert.deepEqual(rejects(validateRebootRunPlausibility(runSummary)), [], `${plan} at seed ${seed}`);
    }
  }
});

// The portal forwards ?evidenceSafe=1 (and terminalPilot) to the child in any
// mode (hmh-reboot-host.mjs). Until 1.8.4 that made a Ranked hero invulnerable
// to everything but the Liquidator and spawned it at the Frontier Relay for
// every seed; the Ranked e2e's terminal-pilot run then broke
// district-path-invalid for four entries in five. A Ranked session now ignores
// both: evidenceSafe changes gameplay only outside Ranked (red team of
// a9663a09, contract §16.6).
test('evidenceSafe changes neither the spawn nor the hero\'s vulnerability in a Ranked session', () => {
  assert.deepEqual(MAIN_SOURCE.match(/evidenceGameplayEnabled = [^;]*;/g), ['evidenceGameplayEnabled = false;', "evidenceGameplayEnabled = evidenceSafeEnabled && payload.mode !== 'ranked';"]);
  assert.ok(MAIN_SOURCE.includes("evidenceGameplayEnabled = evidenceSafeEnabled && payload.mode !== 'ranked';"));
  assert.ok(MAIN_SOURCE.includes('runtimePlayerSpawn = evidenceGameplayEnabled ? evidencePlayerSpawn : selectLevelEntry(payload.session.seed);'));
  assert.ok(MAIN_SOURCE.includes('const playerInvulnerable = evidenceGameplayEnabled || isDashInvulnerable(dashState, tick);'));
  // The session's gameplay switch is set before the spawn, and nothing else in
  // the step makes the hero invulnerable or moves the spawn.
  const init = MAIN_SOURCE.indexOf('const initializeSession = (payload) => {');
  assert.ok(init > 0 && MAIN_SOURCE.indexOf("evidenceGameplayEnabled = evidenceSafeEnabled && payload.mode !== 'ranked';") > init);
  assert.ok(MAIN_SOURCE.indexOf("evidenceGameplayEnabled = evidenceSafeEnabled && payload.mode !== 'ranked';") < MAIN_SOURCE.indexOf('runtimePlayerSpawn = evidenceGameplayEnabled ? evidencePlayerSpawn'));
  assert.equal(MAIN_SOURCE.match(/playerInvulnerable = /g).length, 1);
  assert.equal(MAIN_SOURCE.match(/runtimePlayerSpawn = /g).length, 2, 'the boot value and the per-session value');
  // The terminal pilot still ends an evidence run (Free or Ranked) on tick 2.
  assert.ok(MAIN_SOURCE.includes("const terminalPilotEnabled = evidenceSafeEnabled && runtimeParams.get('terminalPilot') === '1';"));
  assert.match(MAIN_SOURCE, /if \(terminalPilotEnabled && tick === 2\) \{/);
});

// ---------------------------------------------------------------------------
// Red team of a9663a09 (contract §16.6): fabricated v6 summaries that passed
// the first four 1.8.4 rules and earned achievements. Every payload starts from
// a run that records nothing (blankRun: every counter 0, one final hit) at a
// seed of the named level entry, and changes only the fields listed.
const ENTRY_SEED = Object.freeze(Object.fromEntries(LEVEL_ONE_ENTRIES.map(({ id }, index) => [id, ENTRY_SEEDS[index]])));
function blankRun(ticks, { entry = 'relay' } = {}) {
  return clone(valid, (s) => {
    s.identity.seed = ENTRY_SEED[entry];
    s.identity.endTick = ticks;
    Object.assign(s.totals, { survivalTicks: ticks, elapsedMs: ticks * FIXED_STEP_MS, score: 0, level: 1, xp: 0, litecoin: 0, currentCombo: 0, maxCombo: 0, damageDealt: 0, damageTaken: 25, healing: 0, distanceMilli: 0 });
    Object.assign(s.kills, { total: 0, elite: 0, boss: 0 });
    for (const entry of [...s.kills.byEnemyRole, ...s.kills.byWeapon]) entry.count = 0;
    for (const weapon of s.weapons) for (const key of Object.keys(weapon)) if (key !== 'weaponId') weapon[key] = 0;
    for (const key of Object.keys(s.grenades)) s.grenades[key] = 0;
    for (const entry of s.collectibles) Object.assign(entry, { collected: 0, activeTicks: 0 });
    for (const upgrade of s.upgrades) Object.assign(upgrade, { offered: 0, selected: 0 });
    for (const key of Object.keys(s.lightningLedger)) if (key !== 'interruptions') s.lightningLedger[key] = 0;
    for (const key of Object.keys(s.lightningLedger.interruptions)) s.lightningLedger.interruptions[key] = 0;
    for (const key of Object.keys(s.bearMarketBurner)) s.bearMarketBurner[key] = 0;
    for (const key of Object.keys(s.forkedStandard)) s.forkedStandard[key] = 0;
    Object.assign(s.exploration, { visitedDistrictMask: 0, discoveredPoiMask: 0, revealedCells: 0, revealedPermille: 0, distanceMilli: 0 });
    s.defeat = { kind: 'enemy', causeId: 'enemy-bagholder-rusher', tick: ticks, damage: 25 };
    Object.assign(s.milestones, { levelUps: 0, firstLevelUpTick: 0, lastLevelUpTick: 0, bossEngagedTick: 0 });
    for (const row of [...s.milestones.sites, ...s.milestones.secrets]) for (const key of Object.keys(row)) if (!key.endsWith('Id')) row[key] = 0;
  });
}
// Credits `count` kills of `role` to `weaponId`, keeping the kill rows consistent.
function addWeaponKills(summary, role, count, weaponId) {
  summary.kills.total += count;
  rowOf(summary.kills.byEnemyRole, 'enemyRoleId', role).count += count;
  rowOf(summary.kills.byWeapon, 'weaponId', weaponId).count += count;
  rowOf(summary.weapons, 'weaponId', weaponId).kills += count;
}
// The 1.8.4 (first round) pickup capacity: every placement unlocked and
// available from tick 0, with no gate.
const ungatedCapacity = (effectId, ticks) => V6C.pickupPlacements[effectId].reduce((sum, placement) => {
  const rearm = Array.isArray(placement) ? placement[0] : placement;
  return sum + 1 + (rearm > 0 ? Math.floor(ticks / rearm) : 0);
}, 0);
const withUngatedPickups = (summary) => {
  for (const entry of summary.collectibles) entry.collected = ungatedCapacity(entry.effectId, summary.totals.survivalTicks);
  summary.totals.litecoin = rowOf(summary.collectibles, 'effectId', 'litecoin-token').collected;
};
const schemaValid = (summary) => {
  assert.equal(validateRunSummaryPayload(summary), '', 'the schema accepts the payload');
  return summary;
};
const rejectIds = (summary) => rejects(validateRebootRunPlausibility(schemaValid(summary)));

test('red team: zero-tick runs record nothing (P2, P2b, P3)', () => {
  // P2: a zero-tick "grab bag" from the ravine entry, with every placement once,
  // two districts, 20,000 damage and three weapons equipped for a tick.
  const grabBag = clone(blankRun(0, { entry: 'ravine' }), (s) => {
    withUngatedPickups(s);
    s.exploration.visitedDistrictMask = 0b11;
    s.totals.damageDealt = 20_000;
    for (const weaponId of ['hash-rail', 'scatter-shotgun', 'auto-miner']) rowOf(s.weapons, 'weaponId', weaponId).equippedTicks = 1;
  });
  assert.equal(grabBag.collectibles.reduce((sum, entry) => sum + entry.collected, 0), 21);
  const ids = rejectIds(grabBag);
  for (const id of ['pickups-above-capacity', 'activity-without-time', 'equipped-ticks-above-run', 'weapon-without-source', 'damage-dealt-mismatch']) assert.ok(ids.includes(id), `${id}: ${ids}`);
  // P2b: the same with a 30 combo and no kill.
  assert.ok(rejectIds(clone(grabBag, (s) => { s.totals.maxCombo = 30; })).includes('combo-above-kills'));
  // P3: the 21 pickups alone, from the relay: nothing is collected before tick 1.
  assert.deepEqual(rejectIds(clone(blankRun(0), withUngatedPickups)), ['pickups-above-capacity']);
  // A zero-tick run that records nothing still passes.
  assert.deepEqual(rejectIds(blankRun(0)), []);
});

test('red team: pickups from locked placements reject (P7, P3b)', () => {
  // P7: ten seconds in the relay district, no site operated and no boss kill,
  // claiming the Liquidator vault, every site reward and the three seeded
  // events (available no sooner than ticks 3,600, 7,200 and 10,800).
  const locked = clone(blankRun(600), (s) => {
    s.exploration.visitedDistrictMask = 0b1;
    rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks = 600;
    for (const [effectId, collected] of [['lightning-ledger-cache', 2], ['bear-market-burner-cache', 2], ['forked-standard-cache', 1], ['hash-rail-core', 2], ['nuke-liquidation', 2], ['berserk-candle', 2], ['scatter-shotgun-cache', 2], ['coin-blaster-cache', 2], ['bonus-life', 3]]) {
      assert.ok(collected <= ungatedCapacity(effectId, 600), effectId);
      rowOf(s.collectibles, 'effectId', effectId).collected = collected;
    }
  });
  assert.deepEqual(rejectIds(locked), ['pickups-above-capacity']);
  // P3b: one 60-minute run at the ungated capacity with no site operated.
  const hoard = clone(blankRun(216_000), (s) => {
    withUngatedPickups(s);
    s.exploration.visitedDistrictMask = 0b1;
    rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks = 216_000;
  });
  assert.equal(hoard.collectibles.reduce((sum, entry) => sum + entry.collected, 0), 251);
  assert.ok(rejectIds(hoard).includes('pickups-above-capacity'));
});

test('red team: grenade kills need a grenade trail (P1\', P11)', () => {
  for (const weaponId of V6C.grenadeWeapons) {
    // P1': 250 kills credited to a grenade weapon in 6.5 minutes, with no
    // launcher pickup, launcher shot, throw, detonation or contact.
    const reaper = clone(blankRun(23_460), (s) => {
      addWeaponKills(s, 'bagholder-rusher', 250, weaponId);
      s.grenades.kills = 250;
    });
    const ids = rejectIds(reaper);
    for (const id of ['weapon-without-source', 'grenade-kills-above-contacts']) assert.ok(ids.includes(id), `${weaponId} ${id}: ${ids}`);
  }
  // P11: hard-fork-hero from 20 launcher kills and all six districts in 50 s.
  const hardFork = clone(blankRun(3_000), (s) => {
    addWeaponKills(s, 'bagholder-rusher', 20, 'launcher-rig');
    s.grenades.kills = 20;
    s.exploration.visitedDistrictMask = 63;
    rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks = 3_000;
  });
  assert.deepEqual(rejectIds(hardFork), ['weapon-without-source', 'grenade-kills-above-contacts']);
});

test('red team: weapons never picked up, one damage field and a combo above the kills reject (P8, P8b, P9, P10)', () => {
  // P8: the Hash Rail, Scatter Shotgun and Auto-Miner equipped with no cache collected.
  const unowned = clone(blankRun(180), (s) => {
    s.exploration.visitedDistrictMask = 0b1;
    for (const [weaponId, ticks] of [['coin-blaster', 177], ['hash-rail', 1], ['scatter-shotgun', 1], ['auto-miner', 1]]) rowOf(s.weapons, 'weaponId', weaponId).equippedTicks = ticks;
  });
  assert.deepEqual(rejectIds(unowned), ['weapon-without-source']);
  // P8b: the knife, the hand grenade and the nuke can never be the active weapon.
  const inactive = clone(blankRun(180), (s) => {
    s.exploration.visitedDistrictMask = 0b1;
    rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks = 177;
    for (const weaponId of ['litecoin-knife', 'satoshi-frag', 'nuke-liquidation']) rowOf(s.weapons, 'weaponId', weaponId).equippedTicks = 1;
  });
  assert.deepEqual(rejectIds(inactive), ['weapon-without-source']);
  // P9: damage-chain from totals.damageDealt alone.
  assert.deepEqual(rejectIds(clone(blankRun(60), (s) => { s.totals.damageDealt = 20_000; })), ['damage-dealt-mismatch']);
  // P10: max-combo-30 from five kills.
  const combo = clone(blankRun(1_200), (s) => {
    addWeaponKills(s, 'bagholder-rusher', 5, 'coin-blaster');
    s.totals.maxCombo = 30;
  });
  assert.deepEqual(rejectIds(combo), ['combo-above-kills']);
});

test('each second-round consistency rule at its boundary', () => {
  const only = (summary) => consistencyRejects(validateRebootRunPlausibility(schemaValid(summary)));
  const flagOf = (summary, id) => validateRebootRunPlausibility(summary).flags.filter((flag) => flag.id === id);
  const idle = (ticks) => clone(blankRun(ticks), (s) => { if (ticks > 0) { s.exploration.visitedDistrictMask = 1; rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks = ticks; } });

  // activity-without-time: no district and no damage in a run of zero ticks.
  assert.deepEqual(only(idle(0)), []);
  assert.deepEqual(flagOf(clone(idle(0), (s) => { s.exploration.visitedDistrictMask = 1; }), 'activity-without-time'), [{ id: 'activity-without-time', severity: 'reject', value: 1, limit: 0 }]);
  assert.deepEqual(flagOf(clone(idle(0), (s) => { s.totals.damageDealt = 1; rowOf(s.weapons, 'weaponId', 'coin-blaster').damage = 1; }), 'activity-without-time'), [{ id: 'activity-without-time', severity: 'reject', value: 1, limit: 0 }]);
  assert.deepEqual(only(clone(idle(1), (s) => { s.totals.damageDealt = 1; rowOf(s.weapons, 'weaponId', 'coin-blaster').damage = 1; })), []);

  // equipped-ticks-above-run: one equipped tick per run tick at most.
  assert.deepEqual(only(idle(600)), []);
  assert.deepEqual(flagOf(clone(idle(600), (s) => { rowOf(s.weapons, 'weaponId', 'hash-rail').equippedTicks = 1; }), 'equipped-ticks-above-run'), [{ id: 'equipped-ticks-above-run', severity: 'reject', value: 601, limit: 600 }]);

  // weapon-without-source, clause by clause, each with its source restored
  // (in a run long enough for every cache, the seeded events included).
  const pickedUp = (s, weaponId, cacheId) => { rowOf(s.weapons, 'weaponId', weaponId).pickups = 1; rowOf(s.collectibles, 'effectId', cacheId).collected = 1; };
  const equip = (s, weaponId) => { rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks -= 1; rowOf(s.weapons, 'weaponId', weaponId).equippedTicks = 1; };
  for (const [weaponId, cacheId] of Object.entries(V6C.weaponCaches).slice(1)) {
    assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), (s) => equip(s, weaponId))), [weaponId], `${weaponId} equipped`);
    assert.deepEqual(only(clone(idle(20_000), (s) => { equip(s, weaponId); pickedUp(s, weaponId, cacheId); })), [], `${weaponId} picked up`);
    assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), (s) => addWeaponKills(s, 'forkrunner', 1, weaponId))), [weaponId], `${weaponId} kill`);
    // A pickup needs its cache's collection.
    assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), (s) => { rowOf(s.weapons, 'weaponId', weaponId).pickups = 1; })), [weaponId], `${weaponId} pickup`);
  }
  // The starting weapon needs no pickup, but its pickups still need its cache.
  assert.deepEqual(only(clone(idle(20_000), (s) => addWeaponKills(s, 'forkrunner', 1, 'coin-blaster'))), []);
  assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), (s) => { rowOf(s.weapons, 'weaponId', 'coin-blaster').pickups = 1; })), ['coin-blaster']);
  // The knife, the hand grenade and the nuke are never equipped or picked up.
  for (const weaponId of ['litecoin-knife', 'satoshi-frag', 'nuke-liquidation']) {
    assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), (s) => equip(s, weaponId))), [weaponId], `${weaponId} equipped`);
    assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), (s) => { rowOf(s.weapons, 'weaponId', weaponId).pickups = 1; })), [weaponId], `${weaponId} pickup`);
  }
  assert.deepEqual(only(clone(idle(20_000), (s) => addWeaponKills(s, 'forkrunner', 3, 'litecoin-knife'))), [], 'the knife strikes on its own');
  // Satoshi Frag kills need a throw; Nuke Liquidation kills need a nuke.
  const fragKill = (s) => { addWeaponKills(s, 'forkrunner', 1, 'satoshi-frag'); Object.assign(s.grenades, { kills: 1, contacts: 1 }); };
  assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), fragKill)), ['satoshi-frag']);
  assert.deepEqual(only(clone(idle(20_000), (s) => { fragKill(s); Object.assign(s.grenades, { thrown: 1, detonated: 1 }); })), []);
  assert.deepEqual(hmhV6WeaponsWithoutSource(clone(idle(20_000), (s) => addWeaponKills(s, 'forkrunner', 2, 'nuke-liquidation'))), ['nuke-liquidation']);
  assert.deepEqual(only(clone(idle(20_000), (s) => { addWeaponKills(s, 'forkrunner', 2, 'nuke-liquidation'); rowOf(s.collectibles, 'effectId', 'nuke-liquidation').collected = 1; })), []);
  // The flag counts the offending rows.
  assert.deepEqual(flagOf(clone(idle(20_000), (s) => { equip(s, 'hash-rail'); equip(s, 'auto-miner'); }), 'weapon-without-source'), [{ id: 'weapon-without-source', severity: 'reject', value: 2, limit: 0 }]);

  // grenade-kills-above-contacts, grenade-detonations-above-launches and
  // grenades-thrown-above-supply, each at its bound and one above.
  const trail = (s) => {
    addWeaponKills(s, 'forkrunner', 4, 'satoshi-frag');
    Object.assign(s.grenades, { kills: 4, contacts: 4, thrown: 3, detonated: 3 });
  };
  assert.deepEqual(only(clone(idle(600), trail)), []);
  assert.deepEqual(flagOf(clone(idle(600), (s) => { trail(s); s.grenades.contacts = 3; }), 'grenade-kills-above-contacts'), [{ id: 'grenade-kills-above-contacts', severity: 'reject', value: 4, limit: 3 }]);
  assert.deepEqual(flagOf(clone(idle(600), (s) => { trail(s); s.grenades.detonated = 4; }), 'grenade-detonations-above-launches'), [{ id: 'grenade-detonations-above-launches', severity: 'reject', value: 4, limit: 3 }]);
  assert.deepEqual(only(clone(idle(600), (s) => { trail(s); s.grenades.detonated = 5; Object.assign(rowOf(s.weapons, 'weaponId', 'launcher-rig'), { triggers: 2, pickups: 1, equippedTicks: 1 }); rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks -= 1; rowOf(s.collectibles, 'effectId', 'launcher-rig-cache').collected = 1; })), [], 'launcher shots launch too');
  assert.deepEqual(flagOf(clone(idle(600), (s) => { trail(s); Object.assign(s.grenades, { thrown: 4, detonated: 4 }); }), 'grenades-thrown-above-supply'), [{ id: 'grenades-thrown-above-supply', severity: 'reject', value: 4, limit: 3 }]);
  const supplied = (s) => {
    trail(s);
    Object.assign(rowOf(s.upgrades, 'upgradeId', 'cold-storage'), { offered: 5, selected: 5 });
    rowOf(s.collectibles, 'effectId', 'nuke-liquidation').collected = 1;
    Object.assign(s.grenades, { thrown: 7, detonated: 7 });
  };
  assert.equal(hmhV6HandGrenadeSupply(clone(idle(600), supplied)), 3 + 3 + 1, 'Extra Grenade counts three ranks at most');
  assert.deepEqual(consistencyRejects(validateRebootRunPlausibility(clone(idle(600), supplied))), []);
  assert.deepEqual(flagOf(clone(idle(600), (s) => { supplied(s); Object.assign(s.grenades, { thrown: 8, detonated: 8 }); }), 'grenades-thrown-above-supply'), [{ id: 'grenades-thrown-above-supply', severity: 'reject', value: 8, limit: 7 }]);

  // damage-dealt-mismatch: exact equality, either way.
  const dealt = (total, weapon) => clone(idle(600), (s) => { s.totals.damageDealt = total; rowOf(s.weapons, 'weaponId', 'coin-blaster').damage = weapon; });
  assert.deepEqual(only(dealt(500, 500)), []);
  assert.deepEqual(flagOf(dealt(501, 500), 'damage-dealt-mismatch'), [{ id: 'damage-dealt-mismatch', severity: 'reject', value: 501, limit: 500 }]);
  assert.deepEqual(flagOf(dealt(499, 500), 'damage-dealt-mismatch'), [{ id: 'damage-dealt-mismatch', severity: 'reject', value: 499, limit: 500 }]);

  // combo-above-kills: the best combo is at most the kills.
  const combo = (best) => clone(idle(600), (s) => { addWeaponKills(s, 'forkrunner', 5, 'coin-blaster'); s.totals.maxCombo = best; });
  assert.deepEqual(only(combo(5)), []);
  assert.deepEqual(flagOf(combo(6), 'combo-above-kills'), [{ id: 'combo-above-kills', severity: 'reject', value: 6, limit: 5 }]);
});

// What the second round leaves open (contract §16.6, residuals): a fabricated
// summary that fakes a consistent trail still verifies. P11 with a Launcher Rig
// cache, one launch and one 20-contact blast earns hard-fork-hero in 50 s; the
// 1.8.x summary has no per-blast record, and a blast has no target cap.
test('residual: a consistent fabricated grenade trail still verifies', () => {
  const hardFork = clone(blankRun(3_000), (s) => {
    addWeaponKills(s, 'bagholder-rusher', 20, 'launcher-rig');
    s.exploration.visitedDistrictMask = 63;
    rowOf(s.weapons, 'weaponId', 'coin-blaster').equippedTicks = 2_999;
    Object.assign(rowOf(s.weapons, 'weaponId', 'launcher-rig'), { equippedTicks: 1, pickups: 1, triggers: 1 });
    rowOf(s.collectibles, 'effectId', 'launcher-rig-cache').collected = 1;
    Object.assign(s.grenades, { kills: 20, contacts: 20, detonated: 1 });
  });
  assert.notEqual(validateRebootRunPlausibility(schemaValid(hardFork)).verdict, 'rejected');
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

// Contract §8, nearest-impossible test 2: the minimum fight, 300 ticks for a
// start with an intro and 180 for the Liquidator, whose Dark Pool start has none.
test('v7: a defeat one tick short of the minimum fight rejects; the minimum passes', () => {
  assert.equal(HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS, 300);
  assert.equal(HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS_WITHOUT_INTRO, 180);
  for (const bossId of C7.bosses) {
    const minimum = bossId === 'liquidator' ? 180 : 300;
    assert.equal(HMH_V7_BOSSES[bossId].minFightTicks, minimum, bossId);
    const last = bossRow(fourBosses, bossId).lastInitiatedTick;
    const short = plausible(clone(fourBosses, (s) => { bossRow(s, bossId).defeatedTick = last + minimum - 1; }));
    assert.deepEqual(rejectFlags(short), [{ id: 'boss-fight-too-short', severity: 'reject', value: minimum - 1, limit: minimum }], bossId);
    assert.deepEqual(rejects(plausible(clone(fourBosses, (s) => { bossRow(s, bossId).defeatedTick = last + minimum; }))), [], bossId);
  }
  // Red team (W1): an honest Dark Pool kill needs only its two halts, 182 or 183
  // ticks; the fixture's Dark Pool Liquidator killed 183 ticks in now passes.
  const { lastInitiatedTick: pool } = bossRow(fourBosses, 'liquidator');
  assert.deepEqual(rejects(plausible(clone(fourBosses, (s) => { bossRow(s, 'liquidator').defeatedTick = pool + 183; }))), []);
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

// Contract §8, nearest-impossible test 4: the earliest Liquidator kill is at
// 36,180 (ready at 36,000, then the Dark Pool fight's two halts).
test('v7: a Liquidator kill in a run of 36,179 ticks rejects; at 36,180 it passes', async () => {
  const rush = { ...HMH_V7_PLANS['four-bosses'], endTick: 36_180, caches: [], nodes: [], reviveTick: null, bosses: [{ bossId: 'liquidator', initiations: [36_000], defeatedTick: 36_180, adds: [] }] };
  const { body } = await buildFixtureBody({ gameId: 'lester-blaster', salt: fixtureSalt('hmh-v7-liquidator-rush'), buildHash: HMH_V7_FIXTURE_BUILD_HASH, evidence: { v7Plan: rush } });
  const honest = body.evidence.runSummary;
  assert.deepEqual([honest.identity.endTick, honest.kills.boss, bossRow(honest, 'liquidator').defeatedTick], [36_180, 1, 36_180]);
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
  assert.deepEqual(rejects(plausible(endingAt(36_179))), ['boss-fight-too-short']);
  assert.deepEqual(rejects(plausible(endingAt(36_179, 35_999))), ['boss-before-ready']);
  assert.deepEqual(rejects(plausible(endingAt(36_178, 35_999))), ['boss-before-ready', 'boss-fight-too-short']);
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
// defeated 302 ticks after its ready tick). Beyond the director schedule v7
// counts only the boss bodies and each slot's first four adds; every further
// add draws from the capacity bank.
test('v7 kill capacity reproduces the contract §7.3 table', () => {
  const capacityAt = (runTicks, defeatAfter) => hmhV7KillCapacity({ totals: { survivalTicks: runTicks }, bosses: C7.bosses.map((bossId) => {
    const ready = HMH_V7_BOSSES[bossId].readyTick;
    const initiated = ready <= runTicks;
    const defeated = initiated && defeatAfter !== null && ready + defeatAfter <= runTicks ? ready + defeatAfter : 0;
    return { bossId, initiations: initiated ? 1 : 0, firstInitiatedTick: initiated ? ready : 0, lastInitiatedTick: initiated ? ready : 0, defeatedTick: defeated };
  }) });
  const table = [3_600, 7_200, 7_290, 10_800, 18_000, 36_000, 64_800, 72_000, 108_000].map((runTicks) => [runTicks, spawnCapacity(runTicks), capacityAt(runTicks, null), capacityAt(runTicks, 302)]);
  assert.deepEqual(table, [
    [3_600, 27, 27, 27],
    [7_200, 67, 67, 67],
    [7_290, 68, 72, 72],
    [10_800, 107, 111, 112],
    [18_000, 187, 191, 192],
    [36_000, 487, 499, 502],
    [64_800, 1_127, 1_143, 1_147],
    [72_000, 1_288, 1_303, 1_307],
    [108_000, 2_572, 2_443, 2_447],
  ]);
  // At every run length, v7 is at most 20 kills (four bodies and four slots of
  // four adds) above the director schedule, and so above v6 by at most 20.
  for (let runTicks = 0; runTicks <= 200_000; runTicks += 30) {
    const schedule = HMH_V7_RUN_RULES.OPENING_ENEMIES + directorSpawnCapacity(runTicks, HMH_V7_RUN_RULES.ENCOUNTER_BAND_SCHEDULE);
    assert.ok(capacityAt(runTicks, 302) - schedule <= 20 && capacityAt(runTicks, 302) - spawnCapacity(runTicks) <= 20, `${runTicks}`);
  }
});

// Red team (attack 0, finding 1): a boss never defeated used to add boss-add
// capacity up to the end of the run, on top of the director slots of the same
// ticks; the same claim with the fights nested inside one boss's fight did too.
test('v7: claimed boss time buys no kill capacity beyond the first adds of each slot', () => {
  const T = fourBosses.totals.survivalTicks;
  const inflate = (s, total, score) => {
    addOrdinaryKills(s, 'money-printer', total - s.kills.total);
    s.totals.score = score;
    return s;
  };
  // The Baron initiated at 7,200, never defeated; the other three as in the fixture.
  const killWeapon = fourBosses.kills.byWeapon.find((entry) => entry.count > 0).weaponId;
  const undefeatedBaron = (s) => {
    Object.assign(bossRow(s, 'rug-pull-baron'), { defeatedTick: 0 });
    v7Row(s.kills.byEnemyRole, 'enemyRoleId', 'rug-pull-baron').count = 0;
    s.kills.total -= 1;
    v7Row(s.kills.byWeapon, 'weaponId', killWeapon).count -= 1;
    v7Row(s.weapons, 'weaponId', killWeapon).kills -= 1;
    Object.assign(s.progression, { sealsFound: 3, sealsBanked: 2 });
    v7Row(s.collectibles, 'effectId', 'genesis-seal').collected = 3;
  };
  const baron = clone(fourBosses, undefeatedBaron);
  assert.deepEqual(rejects(plausible(baron)), []);
  const schedule = HMH_V7_RUN_RULES.OPENING_ENEMIES + directorSpawnCapacity(T, HMH_V7_RUN_RULES.ENCOUNTER_BAND_SCHEDULE);
  assert.equal(hmhV7KillCapacity(baron), schedule + 3 + 4 * 4, 'the schedule, three bodies and four slots of first adds');
  // The red-team payload: 1,386 kills and score 602,974 now reject.
  const redTeam = plausible(clone(baron, (s) => inflate(s, 1_386, 602_974)));
  assert.deepEqual(rejectFlags(redTeam).map((flag) => [flag.id, flag.value, flag.limit]), [['kills-above-capacity', 1_386, hmhV7KillCapacity(baron)]]);
  // One kill above the new capacity rejects; at it, it passes.
  assert.deepEqual(rejects(plausible(clone(baron, (s) => addOrdinaryKills(s, 'forkrunner', hmhV7KillCapacity(baron) - s.kills.total)))), []);
  assert.deepEqual(rejects(plausible(clone(baron, (s) => addOrdinaryKills(s, 'forkrunner', hmhV7KillCapacity(baron) - s.kills.total + 1)))), ['kills-above-capacity']);
  // Variant A: the Baron's fight claimed to T - 1, the other three nested inside it
  // (and the Baron's cage opened after it, as schema rule S9 now requires).
  const nested = clone(fourBosses, (s) => {
    bossRow(s, 'rug-pull-baron').defeatedTick = T - 1;
    v7Row(s.prisoners, 'slotId', 'h1-baron-diggings').tick = T - 1;
  });
  assert.equal(hmhV7KillCapacity(nested), hmhV7KillCapacity(fourBosses), 'the fight length adds nothing');
  assert.deepEqual(rejectFlags(plausible(nested)), [{ id: 'boss-fights-overlap', severity: 'reject', value: 3, limit: 0 }]);
  assert.deepEqual(rejects(plausible(clone(nested, (s) => inflate(s, 1_383, 602_645)))), ['boss-fights-overlap', 'kills-above-capacity']);
});

// Red team (attack 0, finding 3): a slot with no time to summon buys no adds.
test('v7: a boss initiated too late to summon adds no first adds', () => {
  const T = districts.totals.survivalTicks;
  const at = (tick) => ({ initiations: 1, firstInitiatedTick: tick, lastInitiatedTick: tick, defeatedTick: 0 });
  const base = hmhV7KillCapacity(districts);
  const withLiquidator = (tick) => clone(districts, (s) => { Object.assign(bossRow(s, 'liquidator'), at(tick)); s.milestones.bossEngagedTick = tick; });
  assert.equal(hmhV7KillCapacity(withLiquidator(T)), base, 'initiated on the last tick');
  assert.equal(hmhV7KillCapacity(withLiquidator(T - 89)), base, '89 ticks before the end');
  assert.equal(hmhV7KillCapacity(withLiquidator(T - 90)), base + 4, 'the add delay fits');
  // Ended by another boss's initiation within the delay: the first boss must
  // have left its fight by then without a retreat, so it summoned nothing.
  const bosses = [{ bossId: 'a', ...at(40_000) }, { bossId: 'b', ...at(40_089) }];
  assert.equal(hmhV7BossCouldSummon(bosses[0], bosses, T), false);
  bosses[1] = { bossId: 'b', ...at(40_090) };
  assert.equal(hmhV7BossCouldSummon(bosses[0], bosses, T), true);
  assert.equal(hmhV7BossCouldSummon({ initiations: 2, firstInitiatedTick: 40_000, lastInitiatedTick: T, defeatedTick: 0 }, [], T), true, 'a retreat means an engagement of 720 ticks or more');
  // The red-team payload: Foreman and Liquidator both initiated at the last tick.
  const both = plausible(clone(districts, (s) => {
    Object.assign(bossRow(s, 'fifty-one-percent-foreman'), at(T));
    Object.assign(bossRow(s, 'liquidator'), at(T));
    s.milestones.bossEngagedTick = T;
    addOrdinaryKills(s, 'forkrunner', base + 8 - s.kills.total);
  }));
  assert.deepEqual(rejects(both), ['boss-fights-overlap', 'kills-above-capacity']);
});

// Red team (attack 0 finding 4, attack 1 finding 2): one boss is live at a time.
test('v7: two bosses live at once reject', () => {
  const overlap = (mutate) => plausible(clone(fourBosses, mutate));
  const logbookAt = (s, tick) => {
    v7Row(s.objectives, 'objectiveId', 'warehouse-logbook').tick = tick;
    v7Row(s.milestones.secrets, 'secretId', 'warehouse-logbook').tick = tick;
  };
  // The Liquidator fought inside the Foreman's fight (27,000 to 40,000), with h2 freed after the Foreman.
  const nested = overlap((s) => {
    retimeBoss(s, 'fifty-one-percent-foreman', { first: 27_000, defeated: 40_000 });
    v7Row(s.prisoners, 'slotId', 'h2-foreman-hoist-vault').tick = 40_000;
    retimeBoss(s, 'liquidator', { first: 36_000, defeated: 36_300 });
    logbookAt(s, 36_000);
  });
  assert.deepEqual(rejectFlags(nested), [{ id: 'boss-fights-overlap', severity: 'reject', value: 1, limit: 0 }]);
  // Every boss fought over the same 300 ticks (attack 1's payload shape): six pairs.
  const together = overlap((s) => {
    for (const bossId of C7.bosses) retimeBoss(s, bossId, { first: 36_000, defeated: 36_300 });
    v7Row(s.prisoners, 'slotId', 'h1-baron-diggings').tick = 36_300;
    v7Row(s.prisoners, 'slotId', 'h2-foreman-hoist-vault').tick = 36_300;
    logbookAt(s, 36_000);
  });
  assert.deepEqual(rejectFlags(together).find((flag) => flag.id === 'boss-fights-overlap'), { id: 'boss-fights-overlap', severity: 'reject', value: 6, limit: 0 });
  // Back to back is not an overlap: a boss may start on the tick another falls.
  assert.equal(hmhV7BossOverlaps([
    { initiations: 1, firstInitiatedTick: 18_000, lastInitiatedTick: 18_000, defeatedTick: 18_300 },
    { initiations: 1, firstInitiatedTick: 18_300, lastInitiatedTick: 18_300, defeatedTick: 18_600 },
  ]), 0);
  assert.equal(hmhV7BossOverlaps([
    { initiations: 1, firstInitiatedTick: 18_000, lastInitiatedTick: 18_000, defeatedTick: 18_300 },
    { initiations: 1, firstInitiatedTick: 18_299, lastInitiatedTick: 18_299, defeatedTick: 18_600 },
  ]), 1, 'one tick inside the fight');
  assert.equal(hmhV7BossOverlaps([
    { initiations: 1, firstInitiatedTick: 18_000, lastInitiatedTick: 18_000, defeatedTick: 0 },
    { initiations: 1, firstInitiatedTick: 18_000, lastInitiatedTick: 18_000, defeatedTick: 0 },
  ]), 1, 'two initiated on one tick');
  // A retreat and a return around another boss's whole fight is honest.
  assert.equal(hmhV7BossOverlaps([
    { initiations: 2, firstInitiatedTick: 18_000, lastInitiatedTick: 30_000, defeatedTick: 30_400 },
    { initiations: 1, firstInitiatedTick: 27_000, lastInitiatedTick: 27_000, defeatedTick: 27_400 },
  ]), 0);
  assert.equal(hmhV7BossOverlaps(districts.bosses), 0);
  assert.equal(hmhV7BossOverlaps(fourBosses.bosses), 0);
});

// Contract §8, nearest-impossible test 7: OG Miner XP comes from the seeded deal only.
test('v7: an OG Miner rescue funds exactly 300 x level XP, and only in an OG Miner slot', () => {
  const deal = dealHmhPrisoners(fourBosses.identity.seed);
  const unheld = (kind) => C7.prisonerSlots.find((slotId, index) => deal[index] === kind && !HMH_V7_PRISONER_SLOTS[slotId].heldBy);
  const ogSlot = unheld('og-miner');
  const medicSlot = unheld('field-medic');
  assert.ok(ogSlot && medicSlot);
  const unrescue = (s, slotId) => Object.assign(v7Row(s.prisoners, 'slotId', slotId), { rescued: 0, tick: 0, levelAtRescue: 0 });
  const base = clone(fourBosses, (s) => { unrescue(s, ogSlot); unrescue(s, medicSlot); });
  // A level below the run's own with no other node: its span completes it.
  const used = new Set([...base.objectives.map((row) => row.levelAtCompletion), ...base.prisoners.map((row) => row.levelAtRescue)]);
  const level = Array.from({ length: base.totals.level - 2 }, (_, index) => base.totals.level - 1 - index).find((candidate) => !used.has(candidate));
  assert.ok(level > 1, 'a free level below the final one');
  const tick = fourBosses.identity.endTick - 60;
  const rescuedIn = (slotId, xp, at = level) => clone(base, (s) => {
    Object.assign(v7Row(s.prisoners, 'slotId', slotId), { rescued: 1, tick, levelAtRescue: at });
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
  // A span always completes the level it is granted at, so no OG Miner is
  // rescued at the run's final level (red team: nodes claimed at the final level).
  const L = fourBosses.totals.level;
  const atFinal = plausible(rescuedIn(ogSlot, fourBosses.totals.xp, L));
  assert.deepEqual(rejects(atFinal), ['node-xp-above-level']);
  const excess = atFinal.flags.find((flag) => flag.id === 'node-xp-above-level');
  assert.ok(excess.value >= 300 * L && excess.limit < 300 * L, JSON.stringify(excess));
});

// Red team (attack 0 finding 5, attack 2 finding 2): node levels are claims, so
// the XP a level can hold bounds them.
test('v7: node XP beyond what its level can hold rejects', () => {
  // The fixtures' own node levels fit.
  assert.equal(hmhV7NodeLevelExcess(districts), null);
  assert.equal(hmhV7NodeLevelExcess(fourBosses), null);
  // Every node claimed at the final level, with XP raised to the new ceiling.
  for (const summary of [districts, fourBosses]) {
    for (const lift of [0, 1, 5, 12]) {
      const claimed = clone(summary, (s) => {
        const L = s.totals.level + lift;
        for (const row of s.objectives) if (row.completed) row.levelAtCompletion = L;
        for (const row of s.prisoners) if (row.rescued) row.levelAtRescue = L;
        setV7Xp(s, Math.min(hmhV7Ceilings(s, V7_MAX_GAINS).xp, hmhV7LevelThreshold(L) - 1));
      });
      if (claimed.totals.level !== summary.totals.level + lift) continue;
      assert.ok(rejects(plausible(claimed)).includes('node-xp-above-level'), `${summary.identity.seed} +${lift}`);
    }
  }
  // Attack 2 K3: every node moved to tick 53,800 at level 24 of the districts run.
  const k3 = plausible(clone(districts, (s) => {
    for (const row of s.objectives) if (row.completed) Object.assign(row, { tick: 53_800, levelAtCompletion: 24 });
    for (const row of s.prisoners) if (row.rescued) Object.assign(row, { tick: 53_800, levelAtRescue: 24 });
    for (const row of s.milestones.sites) if (row.operated) row.tick = 53_800;
    for (const row of s.milestones.secrets) if (row.found) row.tick = 53_800;
    setV7Xp(s, hmhV7LevelThreshold(23));
    s.milestones.lastLevelUpTick = 53_760;
  }));
  assert.ok(rejects(k3).includes('node-xp-above-level'), JSON.stringify(k3.flags));
  // At a level below the final one, all but the node that completes it fit in
  // 300 x level: exactly 300 x level - 1 passes, 300 x level rejects.
  const synthetic = (xps) => ({
    identity: { seed: 0 }, totals: { level: 30, xp: hmhV7LevelThreshold(29) },
    objectives: xps.map((perLevel, index) => ({ objectiveId: ['hashwood-lamp-oil', 'relay-power', 'relay-barn-doors', 'farmstead-hidden-supplies'][index], completed: 1, tick: 100 + index, levelAtCompletion: perLevel })),
    prisoners: [],
  });
  // Level 10: item 120, switch 180, gate 300, secret 600; all but the largest = 600 < 3,000.
  assert.equal(hmhV7NodeLevelExcess(synthetic([10, 10, 10, 10])), null);
  const at = (level, count) => ({
    identity: { seed: 0 }, totals: { level: 30, xp: hmhV7LevelThreshold(29) },
    objectives: C7.objectives.filter((id) => HMH_V7_OBJECTIVES[id].class === 'secret').slice(0, count).map((objectiveId, index) => ({ objectiveId, completed: 1, tick: 100 + index, levelAtCompletion: level })),
    prisoners: [],
  });
  // Six secrets at level 5: five of them are 5 x 300 = 1,500 = 300 x 5 → rejects; five secrets (1,200) pass.
  assert.deepEqual(hmhV7NodeLevelExcess(at(5, 6)), { level: 5, value: 1_500, limit: 1_499 });
  assert.equal(hmhV7NodeLevelExcess(at(5, 5)), null);
  // At the final level every grant fits in the XP gained there.
  const final = (xp) => ({ identity: { seed: 0 }, totals: { level: 5, xp }, objectives: at(5, 2).objectives, prisoners: [] });
  assert.equal(hmhV7NodeLevelExcess(final(hmhV7LevelThreshold(4) + 600)), null);
  assert.deepEqual(hmhV7NodeLevelExcess(final(hmhV7LevelThreshold(4) + 599)), { level: 5, value: 600, limit: 599 });
  // Attack 2 K1: a 10-second, zero-kill run claiming all six secrets at level 1 with 299 XP.
  const k1 = plausible(clone(districts, (s) => {
    const T = 600;
    s.identity.endTick = T;
    s.totals.survivalTicks = T;
    s.totals.elapsedMs = T * FIXED_STEP_MS;
    Object.assign(s.totals, { score: 1_260, xp: 299, level: 1, litecoin: 0, currentCombo: 0, maxCombo: 0 });
    s.kills.total = 0; s.kills.elite = 0; s.kills.boss = 0;
    for (const row of s.kills.byEnemyRole) row.count = 0;
    for (const row of s.kills.byWeapon) row.count = 0;
    for (const row of s.weapons) row.kills = 0;
    s.grenades.kills = 0;
    for (const row of s.collectibles) row.collected = 0;
    for (const row of s.upgrades) Object.assign(row, { offered: 0, selected: 0 });
    for (const row of s.bosses) Object.assign(row, { initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 });
    for (const row of s.prisoners) Object.assign(row, { rescued: 0, tick: 0, levelAtRescue: 0 });
    for (const row of s.evolutions) Object.assign(row, { offered: 0, applied: 0 });
    Object.keys(s.progression).forEach((key) => { s.progression[key] = 0; });
    for (const row of s.objectives) Object.assign(row, HMH_V7_OBJECTIVES[row.objectiveId].class === 'secret' ? { completed: 1, tick: 60, levelAtCompletion: 1 } : { completed: 0, tick: 0, levelAtCompletion: 0 });
    for (const row of s.milestones.sites) Object.assign(row, { operated: 0, tick: 0 });
    for (const row of s.milestones.secrets) Object.assign(row, { found: 1, tick: 60 });
    Object.assign(s.milestones, { levelUps: 0, firstLevelUpTick: 0, lastLevelUpTick: 0, bossEngagedTick: 0 });
    s.defeat = { kind: 'enemy', causeId: 'enemy-bagholder-rusher', tick: T, damage: 10 };
    Object.assign(s.exploration, { visitedDistrictMask: 63, revealedCells: 0, revealedPermille: 0, distanceMilli: 0 });
    s.totals.distanceMilli = 0;
  }));
  assert.ok(rejects(k1).includes('node-xp-above-level'), JSON.stringify(k1.flags));
});

// The XP ceiling holds the same per-level bound: node XP counted at a level
// below the final one is at most the level's span less one plus the grant that
// completes it, so packing x1 node minimums into a level buys no x1.75 XP.
test('v7: the XP ceiling counts at most one level span of node XP per level below the final one', () => {
  const secretsAt = (level, count, finalLevel) => ({
    identity: { seed: 0 }, totals: { level: finalLevel }, kills: { byEnemyRole: [], total: 0 }, collectibles: [], prisoners: [], bosses: [], milestones: { secrets: [] },
    objectives: C7.objectives.filter((id) => HMH_V7_OBJECTIVES[id].class === 'secret').slice(0, count).map((objectiveId) => ({ objectiveId, completed: 1, tick: 100, levelAtCompletion: level })),
  });
  const grant = Math.round(60 * 5 * 1.75);
  assert.equal(grant, 525);
  assert.equal(hmhV7Ceilings(secretsAt(5, 1, 30), V7_MAX_GAINS).xp, grant);
  assert.equal(hmhV7Ceilings(secretsAt(5, 5, 30), V7_MAX_GAINS).xp, 300 * 5 - 1 + grant, 'five at x1.75 would be 2,625');
  assert.equal(hmhV7Ceilings(secretsAt(5, 5, 5), V7_MAX_GAINS).xp, 5 * grant, 'at the final level the reject bounds them');
  // The fixtures' ceilings hold their own XP.
  for (const summary of [districts, fourBosses]) assert.ok(summary.totals.xp <= hmhV7Ceilings(summary, V7_MAX_GAINS).xp);
});

// Red team (attack 0 finding 2, attack 1 finding 1): schema 7 only from a v7 build.
test('v7: a schema-7 summary from a build older than the first v7 child rejects', () => {
  assert.equal(HMH_RUN_SUMMARY_V7_MIN_GAME_VERSION, '1.9.0');
  assert.equal(fourBosses.identity.buildHash, HMH_V7_FIXTURE_BUILD_HASH);
  const built = (buildHash) => plausible(clone(fourBosses, (s) => { s.identity.buildHash = buildHash; }));
  for (const [buildHash, version] of [['site-1.8.1:game-1.8.1', '1.8.1'], ['site-1.9.0:game-1.8.99', '1.8.99'], ['site-1.7.0:game-1.7.0', '1.7.0'], ['dev-build', null]]) {
    const result = built(buildHash);
    assert.deepEqual(rejectFlags(result), [{ id: 'build-predates-schema-7', severity: 'reject', value: version, limit: '1.9.0' }], buildHash);
  }
  for (const buildHash of ['site-1.9.0:game-1.9.0', 'site-1.9.1:game-1.9.1', 'site-2.0.0:game-1.10.0', 'site-2.0.0:game-2.0.0']) assert.deepEqual(rejects(built(buildHash)), [], buildHash);
  // The four-boss run labelled 1.8.1: its Liquidator kill at 56,400, before v6's boss band, no longer reaches a 1.8.x board.
  assert.equal(built('site-1.8.1:game-1.8.1').verdict, 'rejected');
  // A 1.8.x child cached under a newer portal still emits schema 6 with the
  // portal's build hash: the v6 rules stay as they are under any build hash.
  for (const buildHash of ['site-1.9.0:game-1.9.0', 'site-3.0.0:game-3.0.0', 'dev-build']) {
    for (const summary of [valid, realistic, level90]) {
      assert.deepEqual(validateRebootRunPlausibility(clone(summary, (s) => { s.identity.buildHash = buildHash; })), validateRebootRunPlausibility(summary), buildHash);
    }
  }
});

// Red team (attack 0 finding 6): collectible pickups are bounded by the placements.
test('v7: more collectible pickups than the placements can give reject', () => {
  // The 1.8.1 collectible system: at most 13 world placements and 8 objective
  // rewards, and a placement re-arms after 7,200 or 10,800 ticks.
  const placement = (index, extra = {}) => ({ id: `p${index}`, assetId: 'bonus-life', x: index, y: 0, ...extra });
  const world = (count) => Array.from({ length: count }, (_, index) => placement(index));
  const rewards = (count) => Array.from({ length: count }, (_, index) => placement(100 + index, { requiredObjective: `o${index}` }));
  assert.doesNotThrow(() => createCollectibleState({ placements: world(13), objectivePlacements: rewards(8) }));
  assert.throws(() => createCollectibleState({ placements: world(14), objectivePlacements: rewards(8) }));
  assert.throws(() => createCollectibleState({ placements: world(13), objectivePlacements: rewards(9) }));
  assert.throws(() => createCollectibleState({ placements: [placement(0, { respawnTicks: 7_199 }), ...world(12).slice(1)] }));
  assert.doesNotThrow(() => createCollectibleState({ placements: [placement(0, { respawnTicks: 7_200 }), ...world(12).slice(1)] }));
  assert.equal(HMH_V7_COLLECTIBLE_RULES.MAX_PLACEMENTS, 13 + 8);
  assert.equal(HMH_V7_COLLECTIBLE_RULES.MIN_REARM_TICKS, 7_200);
  const T = fourBosses.totals.survivalTicks;
  const capacity = hmhV7CollectibleCapacity(T);
  assert.equal(capacity, 21 * 10);
  const pickups = (s) => s.collectibles.reduce((sum, row) => sum + (row.effectId === 'genesis-seal' ? 0 : row.collected), 0);
  const withCandles = (count) => clone(fourBosses, (s) => { v7Row(s.collectibles, 'effectId', 'berserk-candle').collected += count; });
  const room = capacity - pickups(fourBosses);
  assert.deepEqual(rejects(plausible(withCandles(room))), []);
  assert.deepEqual(rejectFlags(plausible(withCandles(room + 1))), [{ id: 'collectibles-above-capacity', severity: 'reject', value: capacity + 1, limit: capacity }]);
  // The red-team payloads: 250 Berserk Candles, and a million Railgun cores funding level 1,000.
  assert.ok(rejects(plausible(withCandles(250))).includes('collectibles-above-capacity'));
  const cores = plausible(clone(fourBosses, (s) => {
    v7Row(s.collectibles, 'effectId', 'hash-rail-core').collected = 1_000_000;
    setV7Xp(s, 149_850_000);
  }));
  assert.ok(rejects(cores).includes('collectibles-above-capacity'), JSON.stringify(cores.flags));
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
    Object.assign(v7Row(s.evolutions, 'evolutionId', 'crit-candle'), { offered: 1, applied: 1 });
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

// ---------------------------------------------------------------------------
// v7 values pinned independently of hmhV7Ceilings (review: every boundary test
// computed its limit with the function it tested, and the fixtures sit far
// below the XP ceiling, so dropping or doubling a term changed no verdict).
const V7_PINNED = Object.freeze({
  'hmh-v7-districts': Object.freeze({ ceilings: { xp: 143_274, score: 122_348 }, killCapacity: 897 }),
  'hmh-v7-four-bosses': Object.freeze({ ceilings: { xp: 260_219, score: 237_389 }, killCapacity: 1_147 }),
});

test('v7: the ceilings and kill capacity of both fixtures are pinned literals', () => {
  for (const [name, summary] of [['hmh-v7-districts', districts], ['hmh-v7-four-bosses', fourBosses]]) {
    assert.deepEqual(hmhV7Ceilings(summary, V7_MAX_GAINS), V7_PINNED[name].ceilings, name);
    assert.equal(hmhV7KillCapacity(summary), V7_PINNED[name].killCapacity, name);
  }
});

test('v7: one more cache pickup adds exactly its grantRunXp at the maximum ranks to the XP ceiling', () => {
  // The reboot's own grant at the maximum XP rank (the v7 maximum equals 1.8.1's).
  assert.equal(HMH_V7_UPGRADES['validator-training'].maxRank, MAX_UPGRADE_RANKS['validator-training']);
  const atMaximumRanks = () => {
    const state = createRunProgression({ seed: 0 });
    for (const id of Object.keys(state.ranks)) state.ranks[id] = MAX_UPGRADE_RANKS[id];
    return state;
  };
  const rooms = {};
  for (const summary of [districts, fourBosses]) {
    const before = hmhV7Ceilings(summary, V7_MAX_GAINS);
    for (const [effectId, baseXp] of Object.entries(HMH_V7_RUN_RULES.CACHE_XP)) {
      const room = grantRunXp(atMaximumRanks(), baseXp, 0).xp;
      rooms[effectId] = room;
      const after = hmhV7Ceilings(clone(summary, (s) => { v7Row(s.collectibles, 'effectId', effectId).collected += 1; }), V7_MAX_GAINS);
      assert.deepEqual({ xp: after.xp - before.xp, score: after.score - before.score }, { xp: room, score: 0 }, effectId);
    }
  }
  assert.deepEqual(rooms, { 'hash-rail-core': 280, 'lightning-ledger-cache': 385, 'bear-market-burner-cache': 455, 'forked-standard-cache': 420 });
});

test("v7: grenade kills above the grenade weapons' kills reject; equality passes", () => {
  for (const base of [districts, fourBosses]) {
    for (const weaponId of V6C.grenadeWeapons) {
      const at = clone(base, (s) => { creditWeapon(s, weaponId, 25); s.grenades.kills = 25; });
      assert.deepEqual(rejects(plausible(at)), []);
      const above = plausible(clone(at, (s) => { s.grenades.kills = 26; }));
      assert.deepEqual(rejectFlags(above), [{ id: 'grenade-kills-above-weapon-kills', severity: 'reject', value: 26, limit: 25 }]);
    }
  }
  // The review's case: 250 grenade kills claimed with no grenade kill at all.
  assert.deepEqual(rejects(plausible(clone(districts, (s) => { s.grenades.kills = 250; }))), ['grenade-kills-above-weapon-kills']);
});

test('v7: a boss initiated at tick 0 rejects boss-before-ready', () => {
  for (const bossId of C7.bosses) {
    const result = plausible(clone(fourBosses, (s) => retimeBoss(s, bossId, { first: 0 })));
    assert.deepEqual(result.flags.filter((flag) => flag.id === 'boss-before-ready'), [{ id: 'boss-before-ready', severity: 'reject', value: 0, limit: HMH_V7_BOSSES[bossId].readyTick }], bossId);
  }
});

// One case per sub-condition of each soft flag, each with one offending row
// unless stated (districts: level 23, level-ups from 1,860 to 52,440).
test('v7 soft flags: each sub-condition flags on its own and never rejects', () => {
  const only = (summary, id, value) => {
    const result = plausible(summary);
    assert.deepEqual(rejects(result), [], id);
    assert.deepEqual(result.flags.filter((flag) => flag.id === id).map((flag) => [flag.value, flag.limit]), [[value, 0]], `${id}: ${JSON.stringify(result.flags)}`);
  };
  const uncomplete = (s, objectiveId) => {
    Object.assign(v7Row(s.objectives, 'objectiveId', objectiveId), { completed: 0, tick: 0, levelAtCompletion: 0 });
    const site = v7Row(s.milestones.sites, 'siteId', objectiveId);
    if (site) Object.assign(site, { operated: 0, tick: 0 });
    const secret = v7Row(s.milestones.secrets, 'secretId', objectiveId);
    if (secret) Object.assign(secret, { found: 0, tick: 0 });
  };
  const unrescue = (s, slotId) => Object.assign(v7Row(s.prisoners, 'slotId', slotId), { rescued: 0, tick: 0, levelAtRescue: 0 });
  const districtBit = (district) => 2 ** C7.districts.indexOf(district);
  // node-level-inconsistent: a node below an earlier tick's level (the gate at
  // 46,800 claims level 20 after the warehouse at 46,200 claimed 21) ...
  only(clone(districts, (s) => { v7Row(s.objectives, 'objectiveId', 'yard-warehouse-gate').levelAtCompletion = 20; }), 'node-level-inconsistent', 1);
  // ... above level 1 before the first level-up (1,800 < 1,860) ...
  only(clone(districts, (s) => { v7Row(s.objectives, 'objectiveId', 'relay-power').levelAtCompletion = 2; }), 'node-level-inconsistent', 1);
  // ... and below the final level after the last level-up (the run's highest node, level 22, moved to 52,500).
  only(clone(districts, (s) => { v7Row(s.prisoners, 'slotId', 'p6-yard-warehouse-compound').tick = 52_500; }), 'node-level-inconsistent', 1);
  // objective-prerequisite-missing: the prerequisite never completed (the other sub-condition, completed later, is in the test above).
  only(clone(districts, (s) => uncomplete(s, 'ravine-winch-handle')), 'objective-prerequisite-missing', 1);
  // node-in-unvisited-district, per kind of node: Hashwood's seven objectives alone ...
  only(clone(districts, (s) => { unrescue(s, 'p4-hashwood-logging-camp'); s.exploration.visitedDistrictMask -= districtBit('hashwood'); }), 'node-in-unvisited-district', 7);
  // ... its prisoner alone ...
  only(clone(districts, (s) => {
    for (const id of C7.objectives.filter((objectiveId) => HMH_V7_OBJECTIVES[objectiveId].district === 'hashwood')) uncomplete(s, id);
    s.exploration.visitedDistrictMask -= districtBit('hashwood');
  }), 'node-in-unvisited-district', 1);
  // ... and a boss alone (the Baron's ravine, with no ravine objective or prisoner).
  only(clone(fourBosses, (s) => {
    for (const id of C7.objectives.filter((objectiveId) => HMH_V7_OBJECTIVES[objectiveId].district === 'rugpull-ravine')) uncomplete(s, id);
    for (const slotId of C7.prisonerSlots.filter((id) => HMH_V7_PRISONER_SLOTS[id].district === 'rugpull-ravine')) unrescue(s, slotId);
    s.exploration.visitedDistrictMask -= districtBit('rugpull-ravine');
  }), 'node-in-unvisited-district', 1);
});

// The v7 path's results over a mutation corpus of both v7 fixtures, hashed
// like the v6 corpus: a change to any v7 rule or formula moves the digest.
const V7_CORPUS_DIGEST = '0b1e66b431662f446ab301a512daf12d78040f7dcef52bf72a0d975438d44fa1';
function v7Corpus() {
  const cases = [];
  const add = (name, base, mutate = () => {}) => cases.push([name, clone(base, mutate)]);
  const ordinaryRoles = C7.enemyRoles.filter((role) => !C7.bosses.includes(role));
  const rank = (s, id, selected) => { const row = v7Row(s.upgrades, 'upgradeId', id); row.offered = Math.max(row.offered, selected); row.selected = selected; };
  for (const [name, base] of [['districts', districts], ['four-bosses', fourBosses]]) {
    add(name, base);
    add(`${name} elapsed 0`, base, (s) => { s.totals.elapsedMs = 0; });
    add(`${name} no ticks`, base, (s) => { s.identity.endTick = 0; s.totals.survivalTicks = 0; s.totals.elapsedMs = 0; });
    add(`${name} elapsed +1.5 ms`, base, (s) => { s.totals.elapsedMs += 1.5; });
    add(`${name} start 1`, base, (s) => { s.identity.startTick = 1; s.totals.survivalTicks -= 1; });
    add(`${name} squeezed to 600`, base, (s) => { s.identity.startTick = s.identity.endTick - 600; s.totals.survivalTicks = 600; s.totals.elapsedMs = 600 * FIXED_STEP_MS; });
    add(`${name} build 1.8.2`, base, (s) => { s.identity.buildHash = 'site-1.8.2:game-1.8.2'; });
    add(`${name} level +1`, base, (s) => { s.totals.level += 1; });
    for (const role of ordinaryRoles) for (const extra of [1, 60, 400]) add(`${name} +${extra} ${role}`, base, (s) => addOrdinaryKills(s, role, extra));
    for (const factor of [0.5, 0.9, 1.3, 2, 5]) {
      add(`${name} xp x${factor}`, base, (s) => setV7Xp(s, Math.floor(s.totals.xp * factor)));
      add(`${name} score x${factor}`, base, (s) => { s.totals.score = Math.floor(s.totals.score * factor); });
    }
    for (const selected of [0, 3, 4]) {
      add(`${name} validator-training ${selected}`, base, (s) => rank(s, 'validator-training', selected));
      add(`${name} block-reward ${selected}`, base, (s) => rank(s, 'block-reward', selected));
    }
    for (const bossId of C7.bosses) {
      const { readyTick, minFightTicks } = HMH_V7_BOSSES[bossId];
      add(`${name} ${bossId} at ready - 1`, base, (s) => retimeBoss(s, bossId, { first: readyTick - 1 }));
      add(`${name} ${bossId} at 0`, base, (s) => retimeBoss(s, bossId, { first: 0 }));
      add(`${name} ${bossId} short fight`, base, (s) => { const row = bossRow(s, bossId); if (row.initiations > 0 && row.defeatedTick > 0) row.defeatedTick = row.lastInitiatedTick + minFightTicks - 1; });
      add(`${name} ${bossId} quick return`, base, (s) => { const row = bossRow(s, bossId); if (row.initiations > 0) Object.assign(row, { initiations: row.initiations + 1, lastInitiatedTick: row.firstInitiatedTick + 60 }); });
    }
    add(`${name} bosses on one tick`, base, (s) => { for (const row of s.bosses) if (row.initiations > 0) Object.assign(row, { firstInitiatedTick: 40_000, lastInitiatedTick: 40_000 + (row.initiations > 1 ? 2_520 * (row.initiations - 1) : 0) }); });
    add(`${name} caches x3`, base, (s) => { for (const row of s.collectibles) row.collected *= 3; });
    add(`${name} +21 of every pickup`, base, (s) => { for (const row of s.collectibles) if (row.effectId !== 'genesis-seal') row.collected += 21; });
    add(`${name} every node at the final level`, base, (s) => { for (const row of s.objectives) if (row.completed) row.levelAtCompletion = s.totals.level; for (const row of s.prisoners) if (row.rescued) row.levelAtRescue = s.totals.level; });
    add(`${name} every secret found`, base, (s) => { for (const id of C7.secrets) { Object.assign(v7Row(s.objectives, 'objectiveId', id), { completed: 1, tick: 60, levelAtCompletion: 1 }); Object.assign(v7Row(s.milestones.secrets, 'secretId', id), { found: 1, tick: 60 }); } });
    add(`${name} grenade kills +1`, base, (s) => { s.grenades.kills += 1; });
    add(`${name} 30 satoshi-frag kills`, base, (s) => { creditWeapon(s, 'satoshi-frag', 30); s.grenades.kills = 30; });
    add(`${name} no districts`, base, (s) => { s.exploration.visitedDistrictMask = 0; });
    add(`${name} combo above kills`, base, (s) => { s.totals.maxCombo = s.kills.total + 1; s.totals.currentCombo = 0; });
  }
  cases.push(['null', null], ['empty', { schemaVersion: 7 }]);
  return cases;
}

test('the v7 path gives its mutation corpus the pinned results', () => {
  const results = v7Corpus().map(([name, summary]) => [name, validateRebootRunPlausibility(summary)]);
  assert.equal(results.length, 172);
  const digest = createHash('sha256').update(JSON.stringify(results)).digest('hex');
  assert.equal(digest, V7_CORPUS_DIGEST, `${results.length} cases`);
});
