import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedInputRecorder, decodeSic1 } from '../apps/portal/src/stacked-sim.mjs';

for (const reason of ['pause', 'blur', 'visibility-hidden']) {
  test(`${reason} forces exactly one neutral commit for every uint8 physical chord`, () => {
    for (let mask = 0; mask <= 255; mask += 1) {
      const recorder = createStackedInputRecorder({ seed: 1 });
      recorder.sample(1, mask);
      assert.equal(recorder.commit(), mask);
      const committed = decodeSic1(recorder.encode()).transitions;
      recorder.stop(reason);
      recorder.sample(2, mask ^ 255);
      recorder.sample(2, mask);
      assert.equal(recorder.commit(), 0, `${reason}, mask ${mask}`);
      const released = decodeSic1(recorder.encode());
      assert.deepEqual(released.transitions, mask === 0 ? committed : [...committed, { tick: 2, mask: 0 }]);
      assert.equal(released.totalTicks, 2);
      recorder.sample(3, mask);
      assert.equal(recorder.commit(), mask, 'a new post-release sample may resume the valid chord');
    }
  });
}
