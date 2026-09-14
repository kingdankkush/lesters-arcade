import { replayStackedRun } from './stacked-sim.mjs';
import { STACKED_MAX_TICKS } from './stacked-contracts.mjs';

export function createStackedPortalLifecycle({ session, startLevel = 1, verify = async (evidence, options) => replayStackedRun(evidence, options), persistRanked }) {
  const binding = Object.freeze({ seed: session.seed, buildHash: session.buildHash, seasonId: session.seasonId, ranked: Boolean(session.leaderboardEligible) });
  if (binding.ranked && startLevel !== 1) throw new Error('Ranked level skip rejected');
  let inFlight = false, finalized = false, cancelled = false;
  return Object.freeze({
    async finish(evidence, claim, metadata = {}) {
      if (cancelled) return { ok: false, reason: 'cabinet-closed' };
      if (inFlight || finalized) return { ok: false, reason: 'already-finalizing' };
      inFlight = true;
      try {
        const canonical = await verify(evidence, { expectedSeed: binding.seed, maxTicks: STACKED_MAX_TICKS, config: { startLevel, buildHash: binding.buildHash, seasonId: binding.seasonId } });
        if (cancelled) throw new Error('cabinet-closed');
        if (!claim || Object.keys(canonical).length !== Object.keys(claim).length || Object.keys(canonical).some(key => canonical[key] !== claim[key])) throw new Error('Canonical replay does not match the submitted result');
        // Persist only the verifier's own tuple, never untrusted summary counters.
        if (binding.ranked) {
          if (typeof persistRanked !== 'function') throw new Error('Ranked persistence is not available');
          const inputDevice=['keyboard','touch','gamepad','mixed'].includes(metadata.inputDevice)?metadata.inputDevice:null;
          await persistRanked(Object.freeze({ ...canonical }), evidence, Object.freeze({inputDevice}));
        }
        finalized = true;
        return { ok: true, canonical, ranked: binding.ranked };
      } catch (error) { return { ok: false, reason: error.message }; }
      finally { inFlight = false; }
    },
    get finalized() { return finalized; },
    cancel() { cancelled = true; },
  });
}
