function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

export function createRecorder(engine, counts, onComplete) {
  const params = new URLSearchParams(location.search);
  const warmupMs = Number(params.get('warmup') || 2000);
  const sampleMs = Number(params.get('duration') || 8000);
  const bootAt = performance.now();
  let firstFrameAt = null;
  let sampleStart = null;
  let previousFrame = null;
  const frames = [];
  let fixedSteps = 0;
  let cappedFrames = 0;
  let completed = false;

  return {
    markFixedSteps(count, capped) {
      fixedSteps += count;
      if (capped) cappedFrames += 1;
    },
    frame(now, extra = {}) {
      if (completed) return true;
      if (firstFrameAt === null) firstFrameAt = now;
      if (now - bootAt < warmupMs) {
        previousFrame = now;
        return false;
      }
      if (sampleStart === null) {
        sampleStart = now;
        previousFrame = now;
        return false;
      }
      frames.push(now - previousFrame);
      previousFrame = now;
      if (now - sampleStart < sampleMs) return false;
      completed = true;
      const sorted = [...frames].sort((a, b) => a - b);
      const totalMs = frames.reduce((sum, value) => sum + value, 0);
      const result = {
        engine,
        counts,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        userAgent: navigator.userAgent,
        startupMs: firstFrameAt - bootAt,
        sampleMs: now - sampleStart,
        frameCount: frames.length,
        averageFps: totalMs > 0 ? frames.length * 1000 / totalMs : 0,
        averageFrameMs: frames.length ? totalMs / frames.length : 0,
        p95FrameMs: percentile(sorted, 0.95),
        p99FrameMs: percentile(sorted, 0.99),
        maxFrameMs: sorted.at(-1) || 0,
        framesOver16_7: frames.filter((value) => value > 16.7).length,
        framesOver33_3: frames.filter((value) => value > 33.3).length,
        fixedSteps,
        cappedFrames,
        heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
        ...extra,
      };
      window.__HMH_BENCH_RESULT__ = result;
      document.body.dataset.complete = 'true';
      onComplete?.(result);
      return true;
    },
  };
}

export function installResultPanel(title) {
  const panel = document.createElement('pre');
  panel.id = 'result';
  panel.textContent = `${title}\nWarming up...`;
  document.body.append(panel);
  return (result) => { panel.textContent = `${title}\n${JSON.stringify(result, null, 2)}`; };
}
