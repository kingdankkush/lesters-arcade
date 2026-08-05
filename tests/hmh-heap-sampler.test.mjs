import test from 'node:test';
import assert from 'node:assert/strict';
import { median, summarizeHeapSamples, HEAP_SAMPLE_COUNT } from '../scripts/lib/heap-sampler.mjs';

test('median returns the middle value of an odd-length set', () => {
  assert.equal(median([5, 1, 3]), 3);
});

test('median averages the two middle values of an even-length set', () => {
  assert.equal(median([1, 3, 5, 7]), 4);
});

test('median does not mutate the caller array', () => {
  const values = [9, 2, 7];
  median(values);
  assert.deepEqual(values, [9, 2, 7]);
});

test('median rejects an empty sample set rather than returning a silent zero', () => {
  assert.throws(() => median([]), /at least one sample/);
});

test('summarizeHeapSamples reports the delta between the two medians', () => {
  const summary = summarizeHeapSamples({
    before: [10, 12, 11, 10, 11],
    after: [30, 31, 30, 32, 30],
  });
  assert.equal(summary.heapBefore, 11);
  assert.equal(summary.heapAfter, 30);
  assert.equal(summary.heapDelta, 19);
});

// This is the actual variance fix. A single uncollected-garbage sample used to
// decide the gate outright: the old smoke read usedJSHeapSize once at each end,
// so one late GC could swing the reported delta by tens of megabytes. The
// median has to absorb an outlier that large without moving.
test('a single outlier sample cannot move the reported delta', () => {
  const clean = { before: [40, 41, 40, 41, 40], after: [44, 45, 44, 45, 44] };
  // One sample balloons: the highest reading goes 45 -> 82 because a collection
  // did not land before that read. Every other sample is unchanged.
  const withOutlier = {
    before: [40, 41, 40, 41, 40],
    after: [44, 82, 44, 45, 44],
  };
  const baseline = summarizeHeapSamples(clean);
  const perturbed = summarizeHeapSamples(withOutlier);
  assert.equal(baseline.heapDelta, 4);
  assert.equal(perturbed.heapDelta, 4);
  // The mean would have moved by (82-45)/5 = 7.4 -- larger than the delta itself.
  const meanDelta = (samples) => samples.reduce((sum, value) => sum + value, 0) / samples.length;
  assert.ok(meanDelta(withOutlier.after) - meanDelta(clean.after) > 7);
});

test('summarizeHeapSamples surfaces the spread so a noisy run is visible, not hidden', () => {
  const summary = summarizeHeapSamples({
    before: [10, 10, 10, 10, 10],
    after: [20, 26, 22, 60, 21],
  });
  assert.equal(summary.heapAfter, 22);
  assert.equal(summary.afterSpread, 40);
  assert.equal(summary.beforeSpread, 0);
});

test('summarizeHeapSamples keeps the raw samples for the evidence record', () => {
  const summary = summarizeHeapSamples({ before: [1, 2, 3], after: [4, 5, 6] });
  assert.deepEqual(summary.beforeSamples, [1, 2, 3]);
  assert.deepEqual(summary.afterSamples, [4, 5, 6]);
});

test('the sample count is odd so the median is a real observation', () => {
  assert.equal(HEAP_SAMPLE_COUNT % 2, 1);
  assert.ok(HEAP_SAMPLE_COUNT >= 5, 'need enough samples for the median to absorb an outlier');
});
