import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  ENEMY_CAPACITY,
  computeEnemySeparation,
  createEnemyState,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';

const roster = Array.from({ length: 128 }, (_, index) => createEnemyState({
  archetypeId: index % 8 === 0 ? 'whale-enforcer' : 'bagholder-rusher',
  id: `bench-enemy-${String(index).padStart(3, '0')}`,
  x: (index % 16) * 72,
  y: Math.floor(index / 16) * 72,
  visualMode: 'prototype',
}));
assert.ok(roster.length >= 100 && roster.length <= ENEMY_CAPACITY);

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
  digest,
}));
