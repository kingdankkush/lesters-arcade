import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIXED_STEP_MS,
  MAX_CATCH_UP_STEPS,
  DeterministicSimulation,
} from '../apps/hmh-reboot/src/simulation.mjs';

function activeSimulation(options = {}) {
  const simulation = new DeterministicSimulation(options);
  simulation.start();
  return simulation;
}

test('kernel advances only in fixed 60 Hz ticks and reports interpolation separately', () => {
  const simulation = activeSimulation();
  const steps = [];
  simulation.onStep((step) => steps.push(step));

  const first = simulation.update(FIXED_STEP_MS / 2, { moveX: 1 });
  assert.equal(first.steps, 0);
  assert.equal(first.alpha, 0.5);
  assert.equal(simulation.tick, 0);

  const second = simulation.update(FIXED_STEP_MS / 2, { moveX: 1 });
  assert.equal(second.steps, 1);
  assert.equal(second.alpha, 0);
  assert.equal(simulation.tick, 1);
  assert.deepEqual(steps[0], {
    tick: 1,
    dtMs: FIXED_STEP_MS,
    dtSeconds: 1 / 60,
    input: { moveX: 1 },
  });
});

test('kernel admits at most four normal fixed steps and tracks overflow exactly once', () => {
  const simulation = activeSimulation({ maxFrameDeltaMs: 200 });
  let normalStepCalls = 0;
  simulation.onStep(({ dtSeconds }) => {
    assert.equal(dtSeconds, 1 / 60);
    normalStepCalls += 1;
  });

  const frame = simulation.update(FIXED_STEP_MS * 6);
  assert.equal(frame.steps, MAX_CATCH_UP_STEPS);
  assert.equal(normalStepCalls, MAX_CATCH_UP_STEPS);
  assert.ok(Math.abs(frame.accumulatorOverflowMs - FIXED_STEP_MS * 2) < 1e-9);
  assert.equal(frame.rawWallClockLossMs, 0);
  assert.ok(frame.alpha >= 0 && frame.alpha < 1);
});

test('kernel clamps raw wall time before accumulation and keeps loss categories separate', () => {
  const simulation = activeSimulation({ maxFrameDeltaMs: 100, maxCatchUpSteps: 4 });
  const frame = simulation.update(250);
  assert.equal(frame.steps, 4);
  assert.equal(frame.rawWallClockLossMs, 150);
  assert.ok(Math.abs(frame.accumulatorOverflowMs - (100 - 4 * FIXED_STEP_MS)) < 1e-9);
  assert.ok(Math.abs(frame.totalDroppedMs - (250 - 4 * FIXED_STEP_MS)) < 1e-9);
});

test('loss metrics accumulate until an explicit certified measurement boundary', () => {
  const simulation = activeSimulation({ maxFrameDeltaMs: 50 });
  simulation.update(100);
  simulation.update(100);
  const measured = simulation.takeLossMetrics();
  assert.equal(measured.rawWallClockLossMs, 100);
  assert.ok(measured.accumulatorOverflowMs >= 0);
  assert.equal(measured.totalDroppedMs, measured.rawWallClockLossMs + measured.accumulatorOverflowMs);
  assert.deepEqual(simulation.getLossMetrics(), {
    rawWallClockLossMs: 0,
    accumulatorOverflowMs: 0,
    totalDroppedMs: 0,
  });
});

test('pause upgrade game-over and exit states never accumulate hidden-frame catch-up', () => {
  const simulation = activeSimulation();
  simulation.update(FIXED_STEP_MS / 2);
  simulation.pause();
  simulation.update(10_000);
  assert.equal(simulation.tick, 0);
  assert.equal(simulation.interpolationAlpha, 0);
  simulation.resume();
  assert.equal(simulation.update(FIXED_STEP_MS).steps, 1);

  simulation.enterUpgrade();
  simulation.update(10_000);
  assert.equal(simulation.tick, 1);
  simulation.leaveUpgrade();
  assert.equal(simulation.update(FIXED_STEP_MS).steps, 1);

  simulation.gameOver();
  simulation.update(10_000);
  assert.equal(simulation.tick, 2);
  simulation.exit();
  assert.equal(simulation.state, 'exit');
});

test('lifecycle transitions are explicit and terminal exit cannot restart', () => {
  const simulation = new DeterministicSimulation();
  assert.equal(simulation.state, 'start');
  assert.equal(simulation.update(FIXED_STEP_MS).steps, 0);
  simulation.start();
  assert.equal(simulation.state, 'active');
  simulation.enterUpgrade();
  assert.equal(simulation.state, 'upgrade');
  simulation.leaveUpgrade();
  simulation.pause();
  simulation.resume();
  simulation.gameOver();
  assert.equal(simulation.state, 'game-over');
  simulation.exit();
  assert.equal(simulation.state, 'exit');
  assert.throws(() => simulation.start(), /exit/i);
});

test('encounter and drop RNG streams are deterministic and consumption-independent', () => {
  const a = new DeterministicSimulation({ seed: 0x12345678 });
  const b = new DeterministicSimulation({ seed: 0x12345678 });
  assert.equal(a.nextRandom('encounters'), b.nextRandom('encounters'));
  a.nextRandom('encounters');
  a.nextRandom('encounters');
  assert.equal(a.nextRandom('drops'), b.nextRandom('drops'));
  assert.notEqual(a.getRandomState('encounters'), b.getRandomState('encounters'));
  assert.equal(a.getRandomState('drops'), b.getRandomState('drops'));
});

test('same seed and input sequence produce identical replay tick events across frame partitions', () => {
  const first = activeSimulation({ seed: 77, maxFrameDeltaMs: 100 });
  const second = activeSimulation({ seed: 77, maxFrameDeltaMs: 100 });
  const firstEvents = [];
  const secondEvents = [];
  first.onReplayEvent((event) => firstEvents.push(event));
  second.onReplayEvent((event) => secondEvents.push(event));

  first.update(FIXED_STEP_MS * 2, { moveX: 1, fire: false });
  second.update(FIXED_STEP_MS, { moveX: 1, fire: false });
  second.update(FIXED_STEP_MS, { moveX: 1, fire: false });

  assert.deepEqual(firstEvents, secondEvents);
  assert.deepEqual(firstEvents.map(({ tick }) => tick), [1, 2]);
  assert.equal(Object.isFrozen(firstEvents[0]), true);
  assert.equal(Object.isFrozen(firstEvents[0].input), true);
});

test('low-FPS catch-up invokes movement and collision once per admitted step without stride multiplication', () => {
  const simulation = activeSimulation({ maxFrameDeltaMs: 100 });
  let x = 0;
  let collisionCalls = 0;
  simulation.onStep(({ dtSeconds }) => {
    x += 120 * dtSeconds;
    collisionCalls += 1;
  });

  const frame = simulation.update(100);
  assert.equal(frame.steps, 4);
  assert.equal(collisionCalls, 4);
  assert.equal(x, 8);
});

test('invalid timing seed stream and callback inputs fail closed', () => {
  assert.throws(() => new DeterministicSimulation({ fixedStepMs: 0 }), /fixedStepMs/);
  assert.throws(() => new DeterministicSimulation({ maxCatchUpSteps: 5 }), /maxCatchUpSteps/);
  assert.throws(() => new DeterministicSimulation({ seed: -1 }), /seed/);
  const simulation = activeSimulation();
  assert.throws(() => simulation.update(-1), /delta/i);
  assert.throws(() => simulation.update(Number.NaN), /delta/i);
  assert.throws(() => simulation.nextRandom('combat'), /stream/i);
  assert.throws(() => simulation.onStep(null), /callback/i);
});
