// Wall-clock loading is outside the fixed-step run. Readiness never alters a
// simulation tick, RNG stream, collision shape, or replay input.
export function createStartupArtGate(startedAt, { minimumMs = 0, requireEntry = false } = {}) {
  let acceptedFallback = false;
  let entered = false;
  return {
    continue() { acceptedFallback = true; },
    enter() { entered = true; },
    check({ ready, failed = false, now }) {
      return {
        ready: (ready && (entered || (!requireEntry && now - startedAt >= minimumMs))) || acceptedFallback,
        canContinue: !ready && (failed || now - startedAt >= 20000),
      };
    },
  };
}
