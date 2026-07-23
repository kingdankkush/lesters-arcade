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
  allocateAttackTokens,
  attemptScheduledEnemyInsertion,
  computeEnemySeparation,
  createEnemyPopulation,
  createEnemySpawnSchedule,
  createEnemyState,
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
  }
  const runner = population.active[0];
  assert.ok(runner.x <= 32.001, `runner tunneled through wall to x=${runner.x}`);
  assert.equal(safetySteps, 240);
  assert.equal(decisions, 20, 'far cadence should refresh every 12 ticks while collision still runs every tick');
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
  assert.match(source, /stageElement\.dataset\.enemyArchetypes/);
  assert.match(source, /stageElement\.dataset\.enemySafetySteps/);
  assert.doesNotMatch(source, /wallet|settlement|contractAddress|localStorage/);
});
