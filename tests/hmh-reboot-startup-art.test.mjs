import assert from 'node:assert/strict';
import test from 'node:test';
import { createStartupArtGate } from '../apps/hmh-reboot/src/startup-art.mjs';
import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';

test('slow artwork cannot spend survival time or damage the player before the first visible frame', () => {
  const gate = createStartupArtGate(0);
  const simulation = new DeterministicSimulation({ seed: 42 });
  let health = 100;
  simulation.onStep(() => { health -= 1; });
  simulation.start();
  for (let frame = 0; frame < 1200; frame += 1) {
    if (gate.check({ ready: false, failed: false, now: frame * 16 }).ready) simulation.update(16);
  }
  assert.equal(simulation.tick, 0);
  assert.equal(health, 100);
  assert.equal(gate.check({ ready: true, now: 20000 }).ready, true);
  simulation.update(1000 / 60);
  assert.equal(simulation.tick, 1);
  assert.equal(health, 99);
});

test('a failed or stalled load offers an explicit fallback without silently starting the run', () => {
  const gate = createStartupArtGate(100);
  assert.deepEqual(gate.check({ ready: false, now: 101 }), { ready: false, canContinue: false });
  assert.deepEqual(gate.check({ ready: false, failed: true, now: 102 }), { ready: false, canContinue: true });
  assert.equal(gate.check({ ready: false, now: 20100 }).canContinue, true);
  gate.continue();
  assert.equal(gate.check({ ready: false, now: 20101 }).ready, true);
  assert.equal(createStartupArtGate(20101).check({ ready: false, now: 20102 }).ready, false);
});
