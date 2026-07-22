import assert from 'node:assert/strict';
import test from 'node:test';
import { createSimulation, simulationChecksum, stepSimulation } from './simulation.mjs';

function advance(simulation, steps = 600) {
  for (let index = 0; index < steps; index += 1) stepSimulation(simulation, 1 / 60);
  return simulationChecksum(simulation);
}

test('same seed and step count produce the same checksum', () => {
  assert.equal(advance(createSimulation(1987)), advance(createSimulation(1987)));
});

test('different seeds produce different checksums', () => {
  assert.notEqual(advance(createSimulation(1987)), advance(createSimulation(1988)));
});

test('stress scale multiplies every workload count', () => {
  assert.deepEqual(createSimulation(1987, 4).counts, {
    enemies: 600,
    projectiles: 2000,
    particles: 6000,
    props: 1200,
  });
});

test('moving pools remain inside normalized world bounds', () => {
  const simulation = createSimulation(1987, 2);
  advance(simulation, 1200);
  for (const pool of [simulation.enemies, simulation.projectiles, simulation.particles]) {
    for (let index = 0; index < pool.count; index += 1) {
      assert.ok(pool.x[index] >= 0 && pool.x[index] <= 1);
      assert.ok(pool.y[index] >= 0 && pool.y[index] <= 1);
    }
  }
});
