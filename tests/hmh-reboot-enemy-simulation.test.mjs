import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createCollisionBody, createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import {
  createAuthoredGroundQuery,
  createElevationSurface,
} from '../apps/hmh-reboot/src/elevation.mjs';
import {
  AI_LOD_BANDS,
  DEFAULT_ATTACK_TOKEN_BUDGET,
  ENEMY_CAPACITY,
  ENEMY_SPATIAL_CELL_SIZE,
  STUCK_PROGRESS_WINDOW_TICKS,
  allocateAttackTokens,
  attemptScheduledEnemyInsertion,
  MAX_ENEMY_SEPARATION_STEP,
  computeEnemySeparation,
  createEnemyPopulation,
  createEnemySpawnSchedule,
  createEnemyState,
  getEnemyFormationBias,
  getEnemyLod,
  planEnemyIntent,
  retireEnemyFromPopulation,
  stepEnemyPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';

const FLAT = createElevationSurface({
  id: 'flat', kind: 'ground', area: { type: 'rect', minX: -2000, minY: -2000, maxX: 4000, maxY: 4000 },
  groundZ: 0, visibleTerrainId: 'flat-visible', priority: 0,
});
const flatGround = createAuthoredGroundQuery({ baseSurface: FLAT });
const bounds = { minX: -1000, minY: -1000, maxX: 2000, maxY: 2000, visibleBoundaryId: 'visible-test-edge' };

function enemy(archetypeId, id, x, y = 0) {
  return createEnemyState({ archetypeId, id, x, y, groundZ: 0, visualMode: 'prototype' });
}

test('AI LOD has explicit near/mid/far cadence and deterministic boundaries', () => {
  assert.deepEqual(AI_LOD_BANDS, [
    { id: 'near', maxDistance: 640, cadenceTicks: 1 },
    { id: 'mid', maxDistance: 1400, cadenceTicks: 3 },
    { id: 'far', maxDistance: Infinity, cadenceTicks: 12 },
  ]);
  assert.deepEqual(getEnemyLod(640), AI_LOD_BANDS[0]);
  assert.deepEqual(getEnemyLod(640.001), AI_LOD_BANDS[1]);
  assert.deepEqual(getEnemyLod(1400), AI_LOD_BANDS[1]);
  assert.deepEqual(getEnemyLod(1400.001), AI_LOD_BANDS[2]);
  assert.throws(() => getEnemyLod(-1), /non-negative/);
});

test('six role planners produce truthful direct, flank, retreat, heavy, area, and support pressure arcs', () => {
  const player = { x: 120, y: 0, groundZ: 0 };
  const ids = [
    'bagholder-rusher', 'forkrunner', 'liquidator-agent',
    'whale-enforcer', 'gas-bomber', 'validator-cultist',
  ];
  const plans = Object.fromEntries(ids.map((id, index) => [id, planEnemyIntent(enemy(id, `e-${index}`, 0), { player, tick: 1 })]));
  assert.ok(plans['bagholder-rusher'].velocity.x > 0);
  assert.ok(Math.abs(plans['bagholder-rusher'].velocity.y) < 1e-9);
  assert.ok(plans.forkrunner.velocity.x > 0 && Math.abs(plans.forkrunner.velocity.y) > 1);
  assert.ok(plans['liquidator-agent'].velocity.x < 0, 'close ranged unit should retreat');
  assert.ok(plans['whale-enforcer'].velocity.x > 0 && Math.abs(plans['whale-enforcer'].velocity.y) < 1e-9);
  assert.ok(plans['gas-bomber'].velocity.x < 0, 'close area unit should retreat');
  assert.ok(plans['validator-cultist'].velocity.x < 0, 'close support unit should retreat');
  for (const plan of Object.values(plans)) {
    assert.ok(Number.isFinite(plan.velocity.x) && Number.isFinite(plan.velocity.y));
    assert.ok(Object.isFrozen(plan));
  }
});

test('bounded formation bias breaks perfect rings without changing attack tells or source-order determinism', () => {
  const roster = Array.from({ length: 8 }, (_, index) => enemy(
    'bagholder-rusher',
    `ring-${String(index).padStart(2, '0')}`,
    Math.cos((index / 8) * Math.PI * 2) * 180,
    Math.sin((index / 8) * Math.PI * 2) * 180,
  ));
  const forward = getEnemyFormationBias(roster, { player: { x: 0, y: 0 } });
  const reverse = getEnemyFormationBias([...roster].reverse(), { player: { x: 0, y: 0 } });
  assert.deepEqual([...forward.entries()], [...reverse.entries()]);
  assert.ok([...forward.values()].some((bias) => Math.abs(bias) > 0), 'ring members must receive a bounded lateral bias');
  assert.ok([...forward.values()].every((bias) => Math.abs(bias) <= 0.18), 'formation bias must stay subordinate to canonical pursuit');

  const player = { x: 0, y: 0, groundZ: 0 };
  const member = roster[0];
  const baseline = planEnemyIntent(member, { player, tick: 1 });
  const biased = planEnemyIntent(member, { player, tick: 1, formationBias: forward.get(member.id) });
  assert.equal(biased.formationAdjusted, true);
  assert.notDeepEqual(biased.facing, baseline.facing);
  member.attackPhase = 'tell';
  const locked = planEnemyIntent(member, { player, tick: 2, formationBias: forward.get(member.id) });
  assert.equal(locked.formationAdjusted, false);
  assert.deepEqual(locked.facing, baseline.facing, 'committed tells must ignore formation steering');

  const simulate = (members) => {
    const population = createEnemyPopulation({ capacity: 12, threatCapacity: 40 });
    population.active.push(...members);
    const report = stepEnemyPopulation({
      population,
      player,
      tick: 1,
      dtSeconds: 1 / 60,
      blockers: [],
      bounds,
      queryGround: flatGround,
      fullAiCap: 12,
    });
    return {
      formationAdjusted: report.formationAdjusted,
      safetySteps: report.safetySteps,
      states: population.active
        .map(({ id, x, y }) => ({ id, x, y }))
        .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    };
  };
  const simulatedForward = simulate(roster.map((entry) => structuredClone(entry)));
  const simulatedReverse = simulate(roster.map((entry) => structuredClone(entry)).reverse());
  assert.deepEqual(simulatedForward, simulatedReverse);
  assert.ok(simulatedForward.formationAdjusted > 0);
  assert.equal(simulatedForward.safetySteps, roster.length);
});

test('attack tokens obey independent family caps, stable ordering, and no distant melee reservation', () => {
  assert.deepEqual(DEFAULT_ATTACK_TOKEN_BUDGET, { melee: 3, ranged: 2, area: 1, support: 1 });
  const enemies = [
    enemy('bagholder-rusher', 'r-b', 110),
    enemy('bagholder-rusher', 'r-a', 110),
    enemy('forkrunner', 'f-a', 120),
    enemy('whale-enforcer', 'w-far', 1200),
    enemy('liquidator-agent', 'l-a', 300),
    enemy('liquidator-agent', 'l-b', 340),
    enemy('liquidator-agent', 'l-c', 360),
    enemy('gas-bomber', 'g-a', 420),
    enemy('gas-bomber', 'g-b', 440),
    enemy('validator-cultist', 'v-a', 460),
  ];
  const player = { x: 0, y: 0 };
  const forward = allocateAttackTokens({ enemies, player });
  const reverse = allocateAttackTokens({ enemies: [...enemies].reverse(), player });
  assert.deepEqual([...forward.entries()], [...reverse.entries()]);
  const counts = { melee: 0, ranged: 0, area: 0, support: 0 };
  for (const family of forward.values()) counts[family] += 1;
  for (const family of Object.keys(counts)) assert.ok(counts[family] <= DEFAULT_ATTACK_TOKEN_BUDGET[family]);
  assert.equal(forward.has('w-far'), false);
  assert.deepEqual([...forward.keys()].filter((id) => /^r-|^f-/.test(id)), ['r-a', 'r-b', 'f-a']);
});

test('stable bounded separation is independent of source order and caps neighbors', () => {
  const enemies = Array.from({ length: 12 }, (_, index) => enemy('bagholder-rusher', `enemy-${String(index).padStart(2, '0')}`, index % 3, Math.floor(index / 3) % 3));
  const a = computeEnemySeparation(enemies, { neighborRadius: 64, maxNeighbors: 4, strength: 0.5 });
  const b = computeEnemySeparation([...enemies].reverse(), { neighborRadius: 64, maxNeighbors: 4, strength: 0.5 });
  assert.deepEqual([...a.deltas.entries()], [...b.deltas.entries()]);
  assert.ok(a.maxNeighborsObserved <= 4);
  assert.ok([...a.deltas.values()].some((delta) => Math.hypot(delta.x, delta.y) > 0));
});

test('spatial separation broadphase prunes distant work while preserving deterministic local pushes', () => {
  assert.equal(ENEMY_SPATIAL_CELL_SIZE, 96);
  const clustered = Array.from({ length: 12 }, (_, index) => enemy(
    'bagholder-rusher',
    `cluster-${String(index).padStart(2, '0')}`,
    index % 4,
    Math.floor(index / 4),
  ));
  const distant = Array.from({ length: 116 }, (_, index) => enemy(
    'bagholder-rusher',
    `distant-${String(index).padStart(3, '0')}`,
    1000 + index * 500,
    (index % 2) * 500,
  ));
  const roster = [...clustered, ...distant];
  const forward = computeEnemySeparation(roster);
  const reverse = computeEnemySeparation([...roster].reverse());
  assert.deepEqual([...forward.deltas.entries()], [...reverse.deltas.entries()]);
  assert.equal(forward.naiveCandidateChecks, roster.length * (roster.length - 1));
  assert.ok(forward.broadphaseCandidateChecks < forward.naiveCandidateChecks / 8);
  assert.ok(clustered.some((member) => Math.hypot(...Object.values(forward.deltas.get(member.id))) > 0));
  const overflow = Array.from({ length: ENEMY_CAPACITY + 1 }, (_, index) => enemy('bagholder-rusher', `overflow-${String(index).padStart(3, '0')}`, -1000 - index * 500));
  assert.throws(() => computeEnemySeparation(overflow), /capacity/i);
});

test('scheduled insertion advances timers and burst counters only after a real exact-candidate insertion', () => {
  assert.equal(ENEMY_CAPACITY >= 128, true);
  const population = createEnemyPopulation({ capacity: 4, threatCapacity: 8 });
  const schedule = createEnemySpawnSchedule({ nextSpawnTick: 10, intervalTicks: 60, burstRemaining: 2 });
  const candidate = { archetypeId: 'bagholder-rusher', id: 'spawn-a', x: 100, y: 100, groundZ: 0 };

  assert.equal(attemptScheduledEnemyInsertion({ population, schedule, candidate, tick: 9, placementAllowed: true, visualMode: 'prototype' }).reason, 'not-due');
  assert.deepEqual({ next: schedule.nextSpawnTick, burst: schedule.burstRemaining, count: population.active.length }, { next: 10, burst: 2, count: 0 });

  assert.equal(attemptScheduledEnemyInsertion({ population, schedule, candidate, tick: 10, placementAllowed: false, visualMode: 'prototype' }).reason, 'placement-rejected');
  assert.deepEqual({ next: schedule.nextSpawnTick, burst: schedule.burstRemaining, count: population.active.length }, { next: 10, burst: 2, count: 0 });

  const productionPopulation = createEnemyPopulation({ capacity: 4, threatCapacity: 8 });
  const productionSchedule = createEnemySpawnSchedule({ nextSpawnTick: 10, intervalTicks: 60, burstRemaining: 2 });
  const productionInsertion = attemptScheduledEnemyInsertion({ population: productionPopulation, schedule: productionSchedule, candidate, tick: 10, placementAllowed: true, visualMode: 'normal' });
  assert.equal(productionInsertion.inserted, true);
  assert.deepEqual({ next: productionSchedule.nextSpawnTick, burst: productionSchedule.burstRemaining, count: productionPopulation.active.length }, { next: 70, burst: 1, count: 1 });

  const tooExpensive = { archetypeId: 'whale-enforcer', id: 'spawn-heavy', x: 140, y: 100, groundZ: 0 };
  assert.equal(attemptScheduledEnemyInsertion({ population, schedule, candidate: tooExpensive, tick: 10, placementAllowed: true, visualMode: 'prototype', threatRemaining: 5 }).reason, 'threat-capacity');
  assert.deepEqual({ next: schedule.nextSpawnTick, burst: schedule.burstRemaining, count: population.active.length }, { next: 10, burst: 2, count: 0 });

  const inserted = attemptScheduledEnemyInsertion({ population, schedule, candidate, tick: 10, placementAllowed: true, visualMode: 'prototype' });
  assert.equal(inserted.inserted, true);
  assert.deepEqual({ next: schedule.nextSpawnTick, burst: schedule.burstRemaining, count: population.active.length }, { next: 70, burst: 1, count: 1 });

  assert.equal(attemptScheduledEnemyInsertion({ population, schedule, candidate, tick: 70, placementAllowed: true, visualMode: 'prototype' }).reason, 'duplicate-id');
  assert.deepEqual({ next: schedule.nextSpawnTick, burst: schedule.burstRemaining, count: population.active.length }, { next: 70, burst: 1, count: 1 });
});

test('retirement releases active body and threat capacity without allowing stable ID reuse', () => {
  const population = createEnemyPopulation({ capacity: 2, threatCapacity: 8 });
  const schedule = createEnemySpawnSchedule({ nextSpawnTick: 0, intervalTicks: 60, burstRemaining: 2 });
  const first = { archetypeId: 'bagholder-rusher', id: 'run-enemy-0001', x: 10, y: 10, groundZ: 0 };
  assert.equal(attemptScheduledEnemyInsertion({ population, schedule, candidate: first, tick: 0, placementAllowed: true, visualMode: 'prototype' }).inserted, true);
  assert.deepEqual({ count: population.active.length, threat: population.activeThreat, inserted: population.insertedCount, retired: population.retiredCount }, { count: 1, threat: 2, inserted: 1, retired: 0 });

  const retired = retireEnemyFromPopulation(population, first.id, { tick: 20, reason: 'defeated' });
  assert.deepEqual(retired, { retired: true, id: first.id, archetypeId: first.archetypeId, tick: 20, reason: 'defeated' });
  assert.deepEqual({ count: population.active.length, threat: population.activeThreat, inserted: population.insertedCount, retired: population.retiredCount }, { count: 0, threat: 0, inserted: 1, retired: 1 });
  assert.equal(retireEnemyFromPopulation(population, first.id, { tick: 21, reason: 'duplicate' }).retired, false);

  assert.equal(attemptScheduledEnemyInsertion({ population, schedule, candidate: first, tick: 60, placementAllowed: true, visualMode: 'prototype' }).reason, 'duplicate-id');
  assert.deepEqual({ next: schedule.nextSpawnTick, burst: schedule.burstRemaining }, { next: 60, burst: 1 });
  const second = { ...first, id: 'run-enemy-0002' };
  assert.equal(attemptScheduledEnemyInsertion({ population, schedule, candidate: second, tick: 60, placementAllowed: true, visualMode: 'prototype' }).inserted, true);
  assert.deepEqual({ count: population.active.length, threat: population.activeThreat, inserted: population.insertedCount, retired: population.retiredCount }, { count: 1, threat: 2, inserted: 2, retired: 1 });
});

test('AI full-decision budget deterministically prioritizes bosses, tells, then distance without skipping safety', () => {
  const population = createEnemyPopulation({ capacity: 8, threatCapacity: 64 });
  const ordinary = [
    enemy('bagholder-rusher', 'near-idle', 100),
    enemy('bagholder-rusher', 'mid-attack', 700),
    enemy('bagholder-rusher', 'mid-tell', 800),
    enemy('bagholder-rusher', 'far-idle', 1_600),
  ];
  ordinary[1].attackPhase = 'attack';
  ordinary[2].attackPhase = 'tell';
  population.active.push(...ordinary);
  const report = stepEnemyPopulation({
    population,
    player: { x: 0, y: 0, groundZ: 0 }, tick: 1, dtSeconds: 1 / 60,
    blockers: [], bounds, queryGround: flatGround, fullAiCap: 1,
  });
  assert.equal(report.decisions, 1);
  assert.equal(report.decisionBudget, 1);
  assert.equal(report.decisionCandidates, 3);
  assert.equal(report.deferredDecisions, 2);
  assert.equal(report.safetySteps, 4);
  assert.equal(ordinary.find((member) => member.id === 'mid-attack').intent?.tick, 1);
  assert.equal(ordinary.find((member) => member.id === 'near-idle').intent, null);
  assert.equal(ordinary.find((member) => member.id === 'mid-tell').intent, null);
  const nextTickReport = stepEnemyPopulation({
    population,
    player: { x: 0, y: 0, groundZ: 0 }, tick: 2, dtSeconds: 1 / 60,
    blockers: [], bounds, queryGround: flatGround, fullAiCap: 1,
  });
  assert.equal(nextTickReport.decisions, 1);
  assert.equal(nextTickReport.deferredDecisions, 1);
  assert.equal(ordinary.find((member) => member.id === 'near-idle').intent?.tick, 2);
  assert.equal(ordinary.find((member) => member.id === 'far-idle').intent, null);
});

test('deferred full-AI decisions age into the bounded budget instead of starving at distance', () => {
  const population = createEnemyPopulation({ capacity: 8, threatCapacity: 64 });
  const near = enemy('bagholder-rusher', 'near', 100);
  const far = enemy('bagholder-rusher', 'far', 1_600);
  population.active.push(near, far);
  for (let tick = 1; tick <= 4; tick += 1) stepEnemyPopulation({
    population,
    player: { x: 0, y: 0, groundZ: 0 }, tick, dtSeconds: 1 / 60,
    blockers: [], bounds, queryGround: flatGround, fullAiCap: 1,
  });
  assert.equal(far.intent?.tick, 2, 'older deferred far work must enter the next available decision slot');
  assert.ok(near.intent?.tick > far.intent.tick, 'near actor continues its cadence after the deferred far refresh');
});

test('blocked cached movement triggers a bounded deterministic replan without teleporting', () => {
  assert.equal(STUCK_PROGRESS_WINDOW_TICKS, 30);
  const makeRun = (reverse = false) => {
    const population = createEnemyPopulation({ capacity: 4, threatCapacity: 20 });
    const members = [enemy('bagholder-rusher', 'stuck-a', 0), enemy('bagholder-rusher', 'stuck-b', 0, 80)];
    population.active.push(...(reverse ? members.reverse() : members));
    const wall = createStaticBlocker({
      id: 'stuck-wall',
      shape: { type: 'polygon', vertices: [{ x: 45, y: -200 }, { x: 60, y: -200 }, { x: 60, y: 200 }, { x: 45, y: 200 }] },
      visibleAssetId: 'visible-stuck-wall', minZ: 0, maxZ: 100,
    });
    const reports = [];
    const replanRequests = [];
    const navigation = { requestReplan: (enemyId, tick) => replanRequests.push(`${tick}:${enemyId}`) };
    for (let tick = 1; tick <= 90; tick += 1) reports.push(stepEnemyPopulation({
      population,
      player: { x: 1_800, y: 0, groundZ: 0 }, tick, dtSeconds: 1 / 60,
      blockers: [wall], bounds, queryGround: flatGround, navigation,
    }));
    return {
      enemies: population.active
        .map(({ id, x, y, nextDecisionTick }) => ({ id, x, y, nextDecisionTick }))
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      replans: reports.reduce((sum, report) => sum + report.routeReplans, 0),
      recoveries: reports.reduce((sum, report) => sum + report.stuckRecoveries, 0),
      replanRequests: [...replanRequests].sort(),
      safetySteps: reports.reduce((sum, report) => sum + report.safetySteps, 0),
    };
  };
  const forward = makeRun(false);
  const reverse = makeRun(true);
  assert.deepEqual(forward, reverse);
  assert.ok(forward.replans >= 2, 'each blocked enemy should request at least one bounded replan');
  assert.equal(forward.replans, forward.recoveries);
  assert.equal(forward.replanRequests.length, forward.replans);
  assert.equal(forward.safetySteps, 180);
  assert.ok(forward.enemies.every((member) => member.x <= 27.001), 'recovery must not teleport through the blocker');
  const nearMissPopulation = createEnemyPopulation({ capacity: 2, threatCapacity: 10 });
  const nearMiss = enemy('bagholder-rusher', 'near-miss', 0);
  nearMissPopulation.active.push(nearMiss);
  for (let tick = 1; tick <= STUCK_PROGRESS_WINDOW_TICKS; tick += 1) stepEnemyPopulation({
    population: nearMissPopulation,
    player: { x: 1_800, y: 0, groundZ: 0 }, tick, dtSeconds: 1 / 60,
    blockers: [], bounds, queryGround: flatGround,
  });
  assert.equal(nearMiss.stuckRecoveries, 0, 'ordinary forward movement must not trigger false stuck recovery');
});

test('cached far decisions still traverse canonical collision every fixed tick without tunneling', () => {
  const population = createEnemyPopulation({ capacity: 4, threatCapacity: 20 });
  population.active.push(enemy('bagholder-rusher', 'runner', 0));
  const wall = createStaticBlocker({
    id: 'wall',
    shape: { type: 'polygon', vertices: [{ x: 50, y: -100 }, { x: 60, y: -100 }, { x: 60, y: 100 }, { x: 50, y: 100 }] },
    visibleAssetId: 'visible-wall', minZ: 0, maxZ: 100,
  });
  let safetySteps = 0;
  let decisions = 0;
  let routeReplans = 0;
  for (let tick = 1; tick <= 240; tick += 1) {
    const report = stepEnemyPopulation({
      population,
      player: { x: 1800, y: 0, groundZ: 0 },
      tick,
      dtSeconds: 1 / 60,
      blockers: [wall],
      bounds,
      queryGround: flatGround,
    });
    safetySteps += report.safetySteps;
    decisions += report.decisions;
    routeReplans += report.routeReplans;
  }
  const runner = population.active[0];
  assert.ok(runner.x <= 32.001, `runner tunneled through wall to x=${runner.x}`);
  assert.equal(safetySteps, 240);
  assert.equal(routeReplans, 7, 'a blocked far enemy replans at most once per thirty-tick progress window');
  assert.equal(decisions, 23, 'far cadence remains bounded while stuck recovery forces only three additional next-tick refreshes');
});

test('locked attack tells stop AI tracking while preserving canonical safety steps', () => {
  const population = createEnemyPopulation({ capacity: 2, threatCapacity: 10 });
  const attacker = enemy('bagholder-rusher', 'locked-rusher', 70);
  attacker.attackPhase = 'tell';
  attacker.attackPhaseUntilTick = 16;
  attacker.telegraphTarget = Object.freeze({ x: 0, y: 0, groundZ: 0 });
  attacker.intent = planEnemyIntent(attacker, { player: { x: 0, y: 0 }, tick: 1 });
  attacker.nextDecisionTick = 2;
  population.active.push(attacker);
  const report = stepEnemyPopulation({
    population,
    player: { x: 300, y: 0, groundZ: 0 },
    tick: 2,
    dtSeconds: 1 / 60,
    blockers: [],
    bounds,
    queryGround: flatGround,
  });
  assert.equal(attacker.x, 70);
  assert.equal(attacker.y, 0);
  assert.equal(report.decisions, 0);
  assert.equal(report.safetySteps, 1);
});

test('enemy movement samples traversal every tick and cannot enter deep water', () => {
  const water = createElevationSurface({
    id: 'deep-water', kind: 'water', area: { type: 'rect', minX: 80, minY: -200, maxX: 400, maxY: 200 },
    groundZ: -20, waterLevel: 0, deepWater: true, visibleTerrainId: 'visible-water', priority: 2,
  });
  const queryGround = createAuthoredGroundQuery({ baseSurface: FLAT, surfaces: [water] });
  const population = createEnemyPopulation({ capacity: 2, threatCapacity: 10 });
  population.active.push(enemy('forkrunner', 'fork', 0));
  let blocked = 0;
  for (let tick = 1; tick <= 180; tick += 1) {
    const report = stepEnemyPopulation({
      population,
      player: { x: 500, y: 0, groundZ: 0 }, tick, dtSeconds: 1 / 60,
      blockers: [], bounds, queryGround,
    });
    blocked += report.traversalBlocks;
  }
  assert.ok(population.active[0].x < 80);
  assert.ok(blocked > 0);
});

test('enemy state validates collision identity and accepts certified production visuals', () => {
  const state = enemy('whale-enforcer', 'human-heavy', 10, 20);
  assert.equal(state.kind, 'regular');
  assert.equal(state.collisionBody.kind, 'regular');
  assert.equal(state.collisionBody.id, 'human-heavy');
  assert.ok(state.collisionBody.radius > 0);
  const productionState = createEnemyState({ archetypeId: 'bagholder-rusher', id: 'production', x: 0, y: 0, visualMode: 'normal' });
  assert.equal(productionState.archetypeId, 'bagholder-rusher');
  assert.throws(() => createEnemyState({ archetypeId: 'bagholder-rusher', id: '', x: 0, y: 0, visualMode: 'prototype' }), /id/);
  assert.throws(() => createCollisionBody({ id: 'wrong', kind: 'regular', radius: -1 }), /radius/);
});

test('runtime integrates six production roles in deterministic movement, hurtbox, attack, then combat-authority order', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const simulationSource = readFileSync(new URL('../apps/hmh-reboot/src/enemy-simulation.mjs', import.meta.url), 'utf8');
  const movement = source.indexOf('lastEnemyStep = stepEnemyPopulation');
  const hurtboxes = source.indexOf('const hurtTargets =');
  const attacks = source.indexOf('lastEnemyAttack = stepEnemyAttacks');
  const authority = source.indexOf('const authoritativeCombatHitIntents = filterDashInvulnerableHits');
  assert.ok(movement >= 0 && movement < hurtboxes);
  assert.ok(hurtboxes < attacks && attacks < authority);
  assert.match(source, /preservePrevious: true/);
  assert.match(source, /ENEMY_ARCHETYPE_IDS\.map/);
  assert.match(source, /visualMode: 'normal'/);
  assert.match(source, /resolveEnemyAttackAgainstPlayer\(event/);
  assert.match(source, /fullAiCap:\s*getEncounterSnapshot\(tick\)\.fullAiCap/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyArchetypes/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyDecisions/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyDecisionBudget/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyDeferredDecisions/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemySafetySteps/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyRouteReplans/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyStuckRecoveries/);
  assert.match(source, /(?:stageElement\.dataset|dataset)\.enemyFormationAdjusted/);
  assert.doesNotMatch(source, /wallet|settlement|contractAddress|localStorage/);
  assert.doesNotMatch(simulationSource, /localeCompare/, 'authoritative ordering must use explicit lexical comparison');
});

test('separation push is bounded so overlapping bodies slide apart instead of popping', () => {
  const heavies = [enemy('whale-enforcer', 'whale-a', 0, 0), enemy('whale-enforcer', 'whale-b', 5, 0)];
  const { deltas } = computeEnemySeparation(heavies, { neighborRadius: 96, maxNeighbors: 8, strength: 0.35 });
  for (const heavy of heavies) {
    const delta = deltas.get(heavy.id);
    const magnitude = Math.hypot(delta.x, delta.y);
    assert.ok(magnitude > 0, 'overlapping bodies must still separate');
    assert.ok(magnitude <= MAX_ENEMY_SEPARATION_STEP + 1e-9, `separation step ${magnitude.toFixed(2)} exceeds the readable per-tick bound`);
  }
});

test('separation stays deterministic and symmetric under the bound', () => {
  const pair = () => [enemy('whale-enforcer', 'whale-a', 0, 0), enemy('whale-enforcer', 'whale-b', 5, 0)];
  const first = computeEnemySeparation(pair(), { neighborRadius: 96, maxNeighbors: 8, strength: 0.35 });
  const second = computeEnemySeparation(pair().reverse(), { neighborRadius: 96, maxNeighbors: 8, strength: 0.35 });
  assert.deepEqual(first.deltas.get('whale-a'), second.deltas.get('whale-a'));
  assert.deepEqual(first.deltas.get('whale-b'), second.deltas.get('whale-b'));
});
