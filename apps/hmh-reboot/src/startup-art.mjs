// Wall-clock loading is outside the fixed-step run. Readiness never alters a
// simulation tick, RNG stream, collision shape, or replay input.
export function createStartupArtGate(startedAt) {
  let acceptedFallback = false;
  return {
    continue() { acceptedFallback = true; },
    check({ ready, failed = false, now }) {
      return {
        ready: ready || acceptedFallback,
        canContinue: failed || now - startedAt >= 20000,
      };
    },
  };
}
