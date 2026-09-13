import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStackedResultTuple, createStackedInputRecorder, createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS } from '../apps/portal/src/stacked-contracts.mjs';
import { handleStackedVerificationRequest } from '../apps/stacked/src/verify-worker.mjs';

let evidence;
function request() {
  if (!evidence) {
    const runtime = createStackedRuntime({ seed: 1 });
    const recorder = createStackedInputRecorder({ seed: 1 });
    for (let tick = 1; !runtime.terminal; tick += 1) {
      recorder.sample(tick, 0); runtime.step(recorder.commit());
    }
    assert.equal(runtime.result().terminalReason, 'lock-out');
    evidence = recorder.encode();
  }
  return { requestId: 'boundary-1', evidence, expectedSeed: 1, maxTicks: STACKED_MAX_TICKS, config: {} };
}
test('canonical result builder rejects more transitions than elapsed ticks', () => {
  const runtime = createStackedRuntime({ seed: 1, maxTicks: 1 });
  runtime.step(0);
  const state = runtime.snapshot();
  assert.throws(() => buildStackedResultTuple({ ...state, transitionCount: state.tick + 1 }), /transition/i);
});
test('worker accepts the bounded, data-only lock-out control request', () => {
  assert.equal(handleStackedVerificationRequest(request()).ok, true);
});
for (const maxTicks of [undefined, null, 0, -1, 1.5, NaN, Infinity, STACKED_MAX_TICKS + 1]) {
  test(`worker rejects an explicitly invalid maxTicks: ${String(maxTicks)}`, () => {
    assert.equal(handleStackedVerificationRequest({ ...request(), maxTicks }).ok, false);
  });
}
test('worker rejects a nonenumerable request field', () => {
  const value = request(); Object.defineProperty(value, 'maxTicks', { enumerable: false });
  assert.equal(handleStackedVerificationRequest(value).ok, false);
});
test('worker rejects a nonenumerable config field', () => {
  const value = request(); Object.defineProperty(value.config, 'startLevel', { value: 1, enumerable: false });
  assert.equal(handleStackedVerificationRequest(value).ok, false);
});
test('worker rejects an accessor without invoking it', () => {
  const value = request(); let reads = 0;
  Object.defineProperty(value, 'maxTicks', { enumerable: true, get() { reads += 1; return STACKED_MAX_TICKS; } });
  assert.equal(handleStackedVerificationRequest(value).ok, false);
  assert.equal(reads, 0);
});
test('worker handles a throwing request-id accessor as invalid input', () => {
  const value = request(); let reads = 0;
  Object.defineProperty(value, 'requestId', { enumerable: true, get() { reads += 1; throw new Error('must not read accessor'); } });
  assert.deepEqual(handleStackedVerificationRequest(value), { requestId: null, ok: false, error: 'invalid-evidence' });
  assert.equal(reads, 0);
});
