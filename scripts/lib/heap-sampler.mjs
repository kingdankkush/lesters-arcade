// Heap sampling for the reboot performance gate.
//
// The gate used to read performance.memory.usedJSHeapSize once before and once
// after the measurement window. That number counts garbage that has not been
// collected yet, so whether a GC happened to land inside the window decided the
// result: cycles 041-049 observed the same assertion swing from -32 MB to
// +38 MB on near-identical builds. A gate that noisy teaches you to rerun it,
// which is how a real leak ships.
//
// Two changes make the number mean something. Chromium is launched with
// --js-flags=--expose-gc so a full collection can be forced immediately before
// every read, which makes each sample retained heap rather than retained heap
// plus whatever garbage happened to be pending. Then several samples are taken
// at each end and the median is used, so one stray collection cannot decide the
// gate on its own.

export const HEAP_SAMPLE_COUNT = 7;

export function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('median needs at least one sample');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function spread(values) {
  return Math.max(...values) - Math.min(...values);
}

export function summarizeHeapSamples({ before, after }) {
  const heapBefore = median(before);
  const heapAfter = median(after);
  return {
    heapBefore,
    heapAfter,
    heapDelta: heapAfter - heapBefore,
    beforeSpread: spread(before),
    afterSpread: spread(after),
    beforeSamples: [...before],
    afterSamples: [...after],
  };
}

// Forces a collection and reads the retained heap, HEAP_SAMPLE_COUNT times.
// Runs inside the page. Throws if --expose-gc is missing: degrading quietly to
// the old unforced read would leave the gate looking green while measuring the
// same noise it was built to remove.
export async function sampleRetainedHeap(page) {
  return page.evaluate(async (sampleCount) => {
    const collect = globalThis.gc;
    if (typeof collect !== 'function') {
      throw new Error('heap sampling needs --js-flags=--expose-gc; refusing to measure unforced heap');
    }
    if (typeof performance.memory?.usedJSHeapSize !== 'number') {
      throw new Error('heap sampling needs --enable-precise-memory-info');
    }
    // Plain gc() is not guaranteed to be a full mark-compact -- V8 may service
    // it with a minor collection or finish it incrementally, which is why the
    // first pass at this left an 8 MB run-to-run swing. Ask for a synchronous
    // major collection where the option is supported, and fall back to
    // repeated plain calls on older V8.
    const forceMajor = () => {
      try {
        collect({ type: 'major', execution: 'synchronous' });
      } catch {
        collect();
        collect();
      }
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      forceMajor();
      await settle();
      // A second pass collects anything the first pass only made unreachable
      // (finalizers, weak refs held one cycle longer).
      forceMajor();
      await settle();
      samples.push(performance.memory.usedJSHeapSize);
    }
    return samples;
  }, HEAP_SAMPLE_COUNT);
}
