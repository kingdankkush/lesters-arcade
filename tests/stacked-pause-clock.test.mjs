import test from 'node:test';
import assert from 'node:assert/strict';
import { createStackedPauseClock } from '../apps/stacked/src/pause-clock.mjs';
test('repeated resume cannot extend a countdown or hide paused time', () => {
  const clock = createStackedPauseClock();
  clock.pause(0); clock.requestResume(100, true); clock.requestResume(2000, true);
  assert.equal(clock.remaining(3000), 100);
  assert.equal(clock.elapsed(3000), 3000);
  assert.equal(clock.complete(3100), true);
  assert.equal(clock.elapsed(6000), 3100);
});
test('blur during countdown cancels resume and preserves cumulative allowance', () => {
  const clock = createStackedPauseClock();
  clock.pause(10); clock.requestResume(100, true); clock.pause(500);
  assert.equal(clock.countingDown, false);
  assert.equal(clock.complete(4000), false);
  assert.equal(clock.elapsed(4000), 3990);
  clock.requestResume(5000, true);
  assert.equal(clock.complete(8000), true);
  clock.pause(9000);
  assert.equal(clock.elapsed(10000), 8990);
});
