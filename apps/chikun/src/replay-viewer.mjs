import { createChikunRuntime, flapTicksOf, replayChikunRun } from '../../portal/src/chikun-cabinet.mjs';
import {courseV2InputTicks} from '../../portal/src/chikun-course-v2-runtime.mjs';

// v6 evidence keeps its delta-encoded flaps; historical evidence keeps flapSteps.
function cloneEvidence(evidence) {
  const flaps = Array.isArray(evidence.flapDeltas)
    ? { flapDeltas: Object.freeze([...evidence.flapDeltas]) }
    : { flapSteps: Object.freeze([...(evidence.flapSteps ?? [])]) };
  return Object.freeze({
    version: evidence.version,
    seed: evidence.seed,
    fixedStepHz: evidence.fixedStepHz,
    maxTicks: evidence.maxTicks,
    ...flaps,
    ...(Array.isArray(evidence.glideDeltas)?{glideDeltas:Object.freeze([...evidence.glideDeltas])}:{}),
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
  const flapSet = new Set(flapTicksOf(frozenEvidence));
  const holdSet=new Set(courseV2InputTicks(frozenEvidence.glideDeltas??[],frozenEvidence.maxTicks));
  let glide=false;
  let runtime = createChikunRuntime({
    seed: canonical.seed,
    maxTicks: frozenEvidence.maxTicks,
    evidenceVersion: frozenEvidence.version,
  });

  const reset = () => {
    glide=false;
    runtime = createChikunRuntime({
      seed: canonical.seed,
      maxTicks: frozenEvidence.maxTicks,
    evidenceVersion: frozenEvidence.version,
    });
    return runtime.snapshot();
  };

  const seek = (tick) => {
    const target = Math.max(0, Math.min(canonical.survivalTicks, Math.floor(Number(tick) || 0)));
    if (target === 0 || runtime.snapshot().tick > target) reset();
    while (!runtime.terminal && runtime.snapshot().tick < target) {
      advance();
    }
    return runtime.snapshot();
  };

  const advance = () => {
    if (runtime.terminal) return runtime.snapshot();
    const tick=runtime.snapshot().tick;if(holdSet.has(tick))glide=!glide;
    return runtime.step({ flap: flapSet.has(tick),glide });
  };

  return Object.freeze({
    seed: canonical.seed,
    durationTicks: canonical.survivalTicks,
    result: canonical,
    evidence: frozenEvidence,
    snapshot: () => runtime.snapshot(),
    hasFlapAt: (tick) => flapSet.has(tick),
    seek,
    step:advance,
    reset,
    get terminal() { return runtime.terminal; },
    get tick() { return runtime.snapshot().tick; },
  });
}
