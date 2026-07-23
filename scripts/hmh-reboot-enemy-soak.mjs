import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { ENEMY_ARCHETYPE_IDS, ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { stepEnemyAttacks } from '../apps/hmh-reboot/src/enemy-combat.mjs';
import {
  ENEMY_CAPACITY,
  createEnemyPopulation,
  createEnemyState,
  stepEnemyPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
import { DeterministicSimulation, FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';

const BODY_COUNT = 128;
const TARGET_TICKS = 3600;
const WORLD_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 4096, maxY: 4096, visibleBoundaryId: 'soak-visible-edge' });
const FLAT = createElevationSurface({
  id: 'soak-ground', kind: 'ground', area: { type: 'rect', ...WORLD_BOUNDS }, groundZ: 0,
  visibleTerrainId: 'soak-visible-ground', priority: 0,
});
const queryGround = createAuthoredGroundQuery({ baseSurface: FLAT });
const player = Object.freeze({ id: 'player', x: 2048, y: 2048, groundZ: 0, radius: 24 });

function createPopulation() {
  const population = createEnemyPopulation({ capacity: ENEMY_CAPACITY, threatCapacity: 4096 });
  population.active = Array.from({ length: BODY_COUNT }, (_, index) => {
    const archetypeId = ENEMY_ARCHETYPE_IDS[index % ENEMY_ARCHETYPE_IDS.length];
    const ring = 520 + Math.floor(index / 32) * 150;
    const angle = index / BODY_COUNT * Math.PI * 2;
    return createEnemyState({
      archetypeId,
      id: `soak-${String(index).padStart(3, '0')}-${archetypeId}`,
      x: player.x + Math.cos(angle) * ring,
      y: player.y + Math.sin(angle) * ring,
      groundZ: 0,
      visualMode: 'prototype',
    });
  }).sort((a, b) => a.id.localeCompare(b.id));
  population.activeThreat = population.active.reduce((sum, enemy) => sum + ENEMY_ARCHETYPES[enemy.archetypeId].costs.threat, 0);
  population.insertedCount = population.active.length;
  return population;
}

function stableSnapshot(population) {
  return population.active.map((enemy) => ({
    id: enemy.id,
    archetypeId: enemy.archetypeId,
    x: Number(enemy.x.toFixed(6)),
    y: Number(enemy.y.toFixed(6)),
    groundZ: Number(enemy.groundZ.toFixed(6)),
    health: enemy.health,
    attackPhase: enemy.attackPhase,
    attackPhaseUntilTick: enemy.attackPhaseUntilTick,
    nextDecisionTick: enemy.nextDecisionTick,
  }));
}

function runPartition({ label, stepsPerFrame }) {
  const population = createPopulation();
  const simulation = new DeterministicSimulation({ seed: 0x14e11e5 });
  simulation.start();
  const metrics = {
    label,
    frames: 0,
    decisions: 0,
    safetySteps: 0,
    collisionContacts: 0,
    traversalBlocks: 0,
    attackEvents: 0,
    droppedAttackEvents: 0,
    maxNeighborsObserved: 0,
    maxCatchUpStepsObserved: 0,
  };
  simulation.onStep(({ tick, dtSeconds }) => {
    const movement = stepEnemyPopulation({
      population,
      player,
      tick,
      dtSeconds,
      blockers: [],
      bounds: WORLD_BOUNDS,
      queryGround,
    });
    const attacks = stepEnemyAttacks({ enemies: population.active, player, tick });
    metrics.decisions += movement.decisions;
    metrics.safetySteps += movement.safetySteps;
    metrics.collisionContacts += movement.collisionContacts;
    metrics.traversalBlocks += movement.traversalBlocks;
    metrics.attackEvents += attacks.events.length;
    metrics.droppedAttackEvents += attacks.droppedEvents;
    metrics.maxNeighborsObserved = Math.max(metrics.maxNeighborsObserved, movement.maxNeighborsObserved);
  });

  const started = performance.now();
  while (simulation.tick < TARGET_TICKS) {
    const update = simulation.update(stepsPerFrame * FIXED_STEP_MS, { move: { x: 0, y: 0 } });
    metrics.frames += 1;
    metrics.maxCatchUpStepsObserved = Math.max(metrics.maxCatchUpStepsObserved, update.steps);
  }
  const durationMs = performance.now() - started;
  const snapshot = stableSnapshot(population);
  const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return {
    ...metrics,
    ticks: simulation.tick,
    bodyCount: population.active.length,
    activeThreat: population.activeThreat,
    durationMs: Number(durationMs.toFixed(3)),
    averageTickMs: Number((durationMs / simulation.tick).toFixed(6)),
    finalHash: hash,
  };
}

if (global.gc) global.gc();
const heapBefore = process.memoryUsage().heapUsed;
const partitions = [
  runPartition({ label: '60fps', stepsPerFrame: 1 }),
  runPartition({ label: '30fps', stepsPerFrame: 2 }),
  runPartition({ label: '20fps', stepsPerFrame: 3 }),
];
if (global.gc) global.gc();
const heapAfter = process.memoryUsage().heapUsed;

for (const result of partitions) {
  assert.equal(result.ticks, TARGET_TICKS);
  assert.equal(result.bodyCount, BODY_COUNT);
  assert.equal(result.safetySteps, BODY_COUNT * TARGET_TICKS);
  assert.equal(result.droppedAttackEvents, 0);
  assert.ok(result.maxNeighborsObserved <= 8);
  assert.ok(result.maxCatchUpStepsObserved <= 4);
}
assert.equal(new Set(partitions.map((result) => result.finalHash)).size, 1);
const heapDelta = heapAfter - heapBefore;
assert.ok(heapDelta < 16 * 1024 * 1024, `enemy soak heap grew by ${heapDelta} bytes`);

const report = {
  generatedAt: new Date().toISOString(),
  bodyCount: BODY_COUNT,
  targetTicks: TARGET_TICKS,
  deterministicHash: partitions[0].finalHash,
  partitionEquality: true,
  heap: { before: heapBefore, after: heapAfter, delta: heapDelta, gcExposed: Boolean(global.gc) },
  partitions,
};
console.log(JSON.stringify(report, null, 2));
