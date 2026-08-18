import { createChikunRuntime, replayChikunRun } from '../../portal/src/chikun-cabinet.mjs';

function cloneEvidence(evidence) {
  return Object.freeze({
    version: evidence.version,
    seed: evidence.seed,
    fixedStepHz: evidence.fixedStepHz,
    maxTicks: evidence.maxTicks,
    flapSteps: Object.freeze([...(evidence.flapSteps ?? [])]),
  });
}

export function replayPlayheadRatio(tick = 0, durationTicks = 1) {
  const duration = Math.max(1, Math.floor(Number(durationTicks) || 1));
  const at = Math.max(0, Math.floor(Number(tick) || 0));
  return Math.max(0, Math.min(1, at / duration));
}

export function createChikunReplayPlayback(evidence) {
  const canonical = replayChikunRun(evidence);
  const frozenEvidence = cloneEvidence(canonical.evidence);
  const flapSet = new Set(frozenEvidence.flapSteps);
  let runtime = createChikunRuntime({
    seed: canonical.seed,
    maxTicks: frozenEvidence.maxTicks,
  });

  const reset = () => {
    runtime = createChikunRuntime({
      seed: canonical.seed,
      maxTicks: frozenEvidence.maxTicks,
    });
    return runtime.snapshot();
  };

  const seek = (tick) => {
    const target = Math.max(0, Math.min(canonical.survivalTicks, Math.floor(Number(tick) || 0)));
    if (target === 0 || runtime.snapshot().tick > target) reset();
    while (!runtime.terminal && runtime.snapshot().tick < target) {
      runtime.step({ flap: flapSet.has(runtime.snapshot().tick) });
    }
    return runtime.snapshot();
  };

  const step = () => {
    if (runtime.terminal) return runtime.snapshot();
    return runtime.step({ flap: flapSet.has(runtime.snapshot().tick) });
  };

  return Object.freeze({
    seed: canonical.seed,
    durationTicks: canonical.survivalTicks,
    result: canonical,
    evidence: frozenEvidence,
    snapshot: () => runtime.snapshot(),
    seek,
    step,
    reset,
    get terminal() { return runtime.terminal; },
    get tick() { return runtime.snapshot().tick; },
  });
}
