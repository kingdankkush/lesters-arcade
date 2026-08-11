import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChikunRuntime,
  simulateChikunRun,
} from '../apps/portal/src/chikun-cabinet.mjs';

const taps = [1, 18, 42, 68, 94, 120, 146, 172, 198, 224, 250];

test('incremental Chikun runtime and canonical replay produce the same terminal result', () => {
  const runtime = createChikunRuntime({ seed: 20260807, maxTicks: 300 });
  for (let tick = 0; tick < 300 && !runtime.terminal; tick += 1) {
    runtime.step({ flap: taps.includes(tick) });
  }
  const incremental = runtime.result();
  const replay = simulateChikunRun({ seed: 20260807, taps, maxTicks: 300 });

  assert.deepEqual(incremental, replay);
  assert.equal(incremental.evidence.flapSteps.length > 0, true);
  assert.deepEqual(incremental.evidence.flapSteps, replay.evidence.flapSteps);
  assert.equal(runtime.snapshot().terminal, true);
});

test('runtime snapshots expose bounded render geometry without leaking mutable canonical state', () => {
  const runtime = createChikunRuntime({ seed: 77, maxTicks: 900 });
  runtime.step({ flap: true });
  for (let index = 0; index < 30; index += 1) runtime.step({ flap: index === 17 });

  const snapshot = runtime.snapshot();
  assert.equal(snapshot.canvas.width, 1280);
  assert.equal(snapshot.canvas.height, 720);
  assert.equal(Number.isFinite(snapshot.chikun.y), true);
  assert.equal(Number.isFinite(snapshot.chikun.velocityY), true);
  assert.equal(Array.isArray(snapshot.forks), true);
  assert.equal(snapshot.forks.length > 0, true);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.throws(() => runtime.step({ flap: 'yes' }), /flap must be boolean/);
});

test('terminal runtime is immutable and ignores post-terminal input', () => {
  const runtime = createChikunRuntime({ seed: 99, maxTicks: 4 });
  while (!runtime.terminal) runtime.step({ flap: false });
  const before = runtime.result();
  assert.throws(() => runtime.step({ flap: true }), /already terminal/);
  assert.deepEqual(runtime.result(), before);
});
