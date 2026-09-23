import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { replayChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';

const v5Fixtures = JSON.parse(readFileSync(new URL('./fixtures/chikun-v5-replays.json', import.meta.url), 'utf8'));

test('v5 fixtures replay through the frozen runtime', () => {
  assert.equal(v5Fixtures.runs.length, 6);
  for (const run of v5Fixtures.runs) {
    assert.equal(run.evidence.version, 'chikun-flap-evidence-v5', `${run.policy} seed ${run.seed}`);
    assert.deepEqual(run.evidence, run.result.evidence);
    assert.deepEqual(replayChikunRun(run.evidence), run.result, `${run.policy} seed ${run.seed} replays exactly`);
  }
});
