import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildChikunDifficulty,
  createChikunRuntime,
  replayChikunRun,
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

test('Chikun difficulty rises smoothly from canonical fork progress', () => {
  const opening = createChikunRuntime({ seed: 77, maxTicks: 3_000 }).snapshot();
  const later = buildChikunDifficulty(2_900);

  assert.equal(opening.difficulty.level, 1);
  assert.equal(later.level, 7);
  assert.ok(later.scrollPixelsPerTick >= opening.difficulty.scrollPixelsPerTick);
  assert.ok(later.safeGapHeight <= opening.difficulty.safeGapHeight);
  assert.ok(later.safeGapHeight >= 238);
  assert.ok(later.scrollPixelsPerTick <= 3.35);
  assert.equal(Object.isFrozen(later), true);
});

test('near-miss scoring is deterministic, bounded, and included in terminal results', () => {
  const runtime = createChikunRuntime({ seed: 1, maxTicks: 1_560 });
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    const nextFork = snapshot.forks.find((fork) => !fork.passed && fork.x + fork.width > snapshot.chikun.x);
    const targetY = nextFork?.gapCenter ?? 360;
    runtime.step({ flap: snapshot.chikun.y > targetY + 12 || (snapshot.chikun.velocityY > 2.2 && snapshot.chikun.y > targetY - 20) });
  }
  const a = runtime.result();
  const b = replayChikunRun(a.evidence);

  assert.deepEqual(a, b);
  assert.equal(Number.isInteger(a.nearMisses), true);
  assert.ok(a.nearMisses >= 1);
  assert.ok(a.nearMisses <= a.forksPassed);
  assert.equal(a.finalState.nearMisses, a.nearMisses);
  assert.equal(a.finalState.bestCombo, a.bestCombo);
});
