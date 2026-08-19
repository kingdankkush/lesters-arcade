import test from 'node:test';
import assert from 'node:assert/strict';

import { createChikunRuntime, simulateChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';
import { createChikunReplayPlayback, replayPlayheadRatio } from '../apps/chikun/src/replay-viewer.mjs';

const taps = [3, 18, 42, 70];

test('replay playback terminal state matches canonical simulation and does not mutate evidence', () => {
  const run = simulateChikunRun({ seed: 20260818, taps, maxTicks: 160 });
  const originalSteps = [...run.evidence.flapSteps];
  const playback = createChikunReplayPlayback(run.evidence);
  const terminal = playback.seek(playback.durationTicks);

  assert.equal(playback.seed, run.seed);
  assert.equal(playback.durationTicks, run.survivalTicks);
  assert.equal(playback.terminal, true);
  assert.equal(terminal.score, run.score);
  assert.equal(terminal.coinsCollected, run.coinsCollected);
  assert.equal(terminal.forksPassed, run.forksPassed);
  assert.equal(terminal.nearMisses, run.nearMisses);
  assert.equal(terminal.bestCombo, run.bestCombo);
  assert.equal(terminal.chikun.y, run.finalState.y);
  assert.deepEqual(run.evidence.flapSteps, originalSteps);
  assert.notEqual(playback.evidence.flapSteps, run.evidence.flapSteps);
  assert.throws(() => { playback.evidence.flapSteps.push(99); }, /object is not extensible|Cannot add property/i);
});

test('seek is identical to stepping and 1-step equals 4 catch-up at the same tick', () => {
  const run = simulateChikunRun({ seed: 77, taps, maxTicks: 120 });
  const stepped = createChikunReplayPlayback(run.evidence);
  const sought = createChikunReplayPlayback(run.evidence);
  const catchUp = createChikunReplayPlayback(run.evidence);

  while (!stepped.terminal) stepped.step();
  const atEnd = sought.seek(run.survivalTicks);
  assert.equal(atEnd.tick, stepped.snapshot().tick);
  assert.equal(atEnd.chikun.y, stepped.snapshot().chikun.y);
  assert.equal(atEnd.score, stepped.snapshot().score);

  const mid = Math.floor(run.survivalTicks / 2);
  const oneByOne = createChikunReplayPlayback(run.evidence);
  for (let index = 0; index < mid; index += 1) oneByOne.step();
  const fourAtATime = catchUp;
  let remaining = mid;
  while (remaining > 0) {
    const burst = Math.min(4, remaining);
    for (let index = 0; index < burst; index += 1) fourAtATime.step();
    remaining -= burst;
  }
  assert.deepEqual(oneByOne.snapshot().chikun, fourAtATime.snapshot().chikun);
  assert.equal(oneByOne.snapshot().score, fourAtATime.snapshot().score);
  assert.equal(oneByOne.snapshot().tick, mid);
});

test('rewinding rebuilds from tick zero and playhead stays bounded', () => {
  const run = simulateChikunRun({ seed: 11, taps: [4, 40], maxTicks: 180 });
  const playback = createChikunReplayPlayback(run.evidence);
  playback.seek(run.survivalTicks);
  const opening = playback.seek(0);
  const live = createChikunRuntime({ seed: run.seed, maxTicks: run.evidence.maxTicks }).snapshot();

  assert.equal(opening.tick, 0);
  assert.equal(opening.chikun.y, live.chikun.y);
  assert.equal(playback.terminal, false);
  assert.equal(replayPlayheadRatio(0, run.survivalTicks), 0);
  assert.equal(replayPlayheadRatio(run.survivalTicks, run.survivalTicks), 1);
  assert.equal(replayPlayheadRatio(-4, run.survivalTicks), 0);
  assert.equal(replayPlayheadRatio(run.survivalTicks + 40, run.survivalTicks), 1);
});
