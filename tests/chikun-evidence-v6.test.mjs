import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createChikunRuntime, replayChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';
import { createGroundRuntime as createFrozenV5Runtime, GROUND_EVIDENCE as FROZEN_V5_EVIDENCE } from '../apps/portal/src/chikun-ground-v5-runtime.mjs';
import * as frozenV5Course from '../apps/portal/src/chikun-ground-v5-course.mjs';

const v5Fixtures = JSON.parse(readFileSync(new URL('./fixtures/chikun-v5-replays.json', import.meta.url), 'utf8'));

function driveFrozenV5(evidence) {
  const taps = new Set(evidence.flapSteps);
  const runtime = createFrozenV5Runtime({ seed: evidence.seed, maxTicks: evidence.maxTicks });
  while (!runtime.terminal) runtime.step({ flap: taps.has(runtime.snapshot().tick) });
  return runtime.result();
}

test('v5 fixtures replay through the frozen runtime', () => {
  assert.equal(FROZEN_V5_EVIDENCE, 'chikun-flap-evidence-v5');
  assert.equal(frozenV5Course.COURSE_CADENCE, 340);
  assert.equal(frozenV5Course.speedAtTick(28_800), 2);
  assert.equal(frozenV5Course.CHIKUN_REGIONS.length, 7);
  assert.equal(v5Fixtures.runs.length, 6);
  for (const run of v5Fixtures.runs) {
    const label = `${run.policy} seed ${run.seed}`;
    assert.equal(run.evidence.version, 'chikun-flap-evidence-v5', label);
    assert.deepEqual(run.evidence, run.result.evidence);
    assert.deepEqual(replayChikunRun(run.evidence), run.result, `${label} replays exactly`);
    assert.deepEqual(driveFrozenV5(run.evidence), run.result, `${label} replays on the frozen v5 module`);
  }
  const live = createChikunRuntime({ seed: 7, maxTicks: 900, evidenceVersion: 'chikun-flap-evidence-v5' });
  const frozen = createFrozenV5Runtime({ seed: 7, maxTicks: 900 });
  for (let tick = 0; tick < 400; tick += 1) {
    const flap = tick % 23 === 0;
    assert.deepEqual(live.step({ flap }), frozen.step({ flap }));
  }
});
