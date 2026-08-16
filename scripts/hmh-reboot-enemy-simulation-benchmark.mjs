import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
import {
  ENEMY_CAPACITY,
  computeEnemySeparation,
  createEnemyPopulation,
  createEnemyState,
  stepEnemyPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';

const roster = Array.from({ length: 128 }, (_, index) => createEnemyState({
  archetypeId: index % 8 === 0 ? 'whale-enforcer' : 'bagholder-rusher',
  id: `bench-enemy-${String(index).padStart(3, '0')}`,
  x: (index % 16) * 72,
  y: Math.floor(index / 16) * 72,
  visualMode: 'prototype',
}));
assert.ok(roster.length >= 100 && roster.length <= ENEMY_CAPACITY);

const flatGround = createAuthoredGroundQuery({
  baseSurface: createElevationSurface({
    id: 'benchmark-flat',
    kind: 'ground',
    area: { type: 'rect', minX: -2_000, minY: -2_000, maxX: 12_000, maxY: 6_000 },
    groundZ: 0,
    visibleTerrainId: 'benchmark-flat-visible',
    priority: 0,
  }),
});
const runBudgetedSimulation = (members) => {
  const population = createEnemyPopulation({ capacity: ENEMY_CAPACITY, threatCapacity: 512 });
  population.active.push(...members);
  const totals = { decisions: 0, safetySteps: 0, deferredDecisions: 0, routeReplans: 0 };
  for (let tick = 1; tick <= 120; tick += 1) {
    const report = stepEnemyPopulation({
      population,
      player: { x: 6_000, y: 0, groundZ: 0 },
      tick,
      dtSeconds: 1 / 60,
      blockers: [],
      bounds: { minX: -1_000, minY: -1_000, maxX: 12_000, maxY: 6_000, visibleBoundaryId: 'benchmark-bounds' },
      queryGround: flatGround,
      fullAiCap: 32,
    });
    totals.decisions += report.decisions;
    totals.safetySteps += report.safetySteps;
    totals.deferredDecisions += report.deferredDecisions;
    totals.routeReplans += report.routeReplans;
  }
  return { totals, states: population.active.map(({ id, x, y, nextDecisionTick }) => ({ id, x, y, nextDecisionTick })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
};
const budgetedForward = runBudgetedSimulation(roster.map((member) => structuredClone(member)));
const budgetedReverse = runBudgetedSimulation(roster.map((member) => structuredClone(member)).reverse());
assert.deepEqual(budgetedForward, budgetedReverse);
assert.equal(budgetedForward.totals.safetySteps, roster.length * 120);
assert.ok(budgetedForward.totals.deferredDecisions > 0, '128-body benchmark must exercise the full-AI cap');

const runHeavyChokepointFixture = (members) => {
  const population = createEnemyPopulation({ capacity: 4, threatCapacity: 20 });
  population.active.push(...members);
  const report = stepEnemyPopulation({
    population,
    player: { x: 300, y: 0, groundZ: 0 },
    tick: 1,
    dtSeconds: 1 / 60,
    blockers: [],
    bounds: { minX: -1_000, minY: -1_000, maxX: 1_000, maxY: 1_000, visibleBoundaryId: 'benchmark-bounds' },
    queryGround: flatGround,
    fullAiCap: 4,
    navigation: {
      lineBlocked: () => false,
      chokepointDirectionAt: (x, y) => Object.freeze({
        direction: Object.freeze({ x: 1, y: 0 }),
        target: Object.freeze({ x: x + 60, y }),
        holding: false,
        openSides: 2,
      }),
    },
  });
  return {
    chokepointSeeking: report.chokepointSeeking,
    chokepointHolding: report.chokepointHolding,
    safetySteps: report.safetySteps,
    states: population.active.map(({ id, x, y }) => ({ id, x, y })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  };
};
const heavyFixture = [
  createEnemyState({ archetypeId: 'whale-enforcer', id: 'bench-heavy-b', x: 0, y: 80, visualMode: 'prototype' }),
  createEnemyState({ archetypeId: 'whale-enforcer', id: 'bench-heavy-a', x: 0, y: -80, visualMode: 'prototype' }),
];
const heavyChokepointForward = runHeavyChokepointFixture(heavyFixture.map((member) => structuredClone(member)));
const heavyChokepointReverse = runHeavyChokepointFixture(heavyFixture.map((member) => structuredClone(member)).reverse());
assert.deepEqual(heavyChokepointForward, heavyChokepointReverse);
assert.equal(heavyChokepointForward.chokepointSeeking, 2);
assert.equal(heavyChokepointForward.chokepointHolding, 0);
assert.equal(heavyChokepointForward.safetySteps, 2);
assert.ok(
  heavyChokepointForward.states.every((member) => member.x > 0 && member.x <= 96 / 60 + 1e-9),
  'heavy chokepoint fixture must exercise canonical fixed-step movement instead of a traversal-blocked intent-only path',
);

const forward = computeEnemySeparation(roster);
const reverse = computeEnemySeparation([...roster].reverse());
assert.deepEqual([...forward.deltas.entries()], [...reverse.deltas.entries()]);
assert.equal(forward.naiveCandidateChecks, roster.length * (roster.length - 1));
assert.ok(
  forward.broadphaseCandidateChecks < forward.naiveCandidateChecks / 4,
  `spatial broadphase did not prune enough work: ${forward.broadphaseCandidateChecks}/${forward.naiveCandidateChecks}`,
);

const iterations = 2_000;
const started = performance.now();
let digest = 0;
for (let iteration = 0; iteration < iterations; iteration += 1) {
  const frame = computeEnemySeparation(iteration % 2 === 0 ? roster : [...roster].reverse());
  digest += frame.broadphaseCandidateChecks + frame.maxNeighborsObserved;
}
const elapsedMs = performance.now() - started;
assert.ok(elapsedMs < 5_000, `128-enemy spatial separation benchmark exceeded 5s: ${elapsedMs.toFixed(3)}ms`);

console.log(JSON.stringify({
  status: 'pass',
  benchmark: 'hmh-enemy-spatial-separation-v1',
  activeEnemies: roster.length,
  iterations,
  elapsedMs: Number(elapsedMs.toFixed(3)),
  microsecondsPerIteration: Number((elapsedMs * 1000 / iterations).toFixed(3)),
  broadphaseCandidateChecks: forward.broadphaseCandidateChecks,
  naiveCandidateChecks: forward.naiveCandidateChecks,
  candidateReductionPct: Number(((1 - forward.broadphaseCandidateChecks / forward.naiveCandidateChecks) * 100).toFixed(2)),
  maxNeighborsObserved: forward.maxNeighborsObserved,
  budgetedSimulation: budgetedForward.totals,
  heavyChokepointSimulation: heavyChokepointForward,
  digest,
}));
