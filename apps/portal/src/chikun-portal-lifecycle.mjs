import { verifyChikunReplayClaim } from './chikun-cabinet.mjs';

function normalizeResultPayload(payload = {}) {
  return {
    score: payload.score,
    runStats: {
      elapsedSeconds: payload.survivalTime,
      survivalTime: payload.survivalTime,
      survivalTicks: payload.survivalTicks,
      coinsCollected: payload.coinsCollected,
      forksPassed: payload.forksPassed,
      nearMisses: payload.nearMisses,
      bestCombo: payload.bestCombo,
      flapCount: payload.evidence?.flapSteps?.length ?? 0,
      achievements: payload.achievements,
      replayClaim: payload.replayClaim,
    },
  };
}

export function createChikunPortalLifecycle({
  state,
  session,
  recordScoreRef,
  persist = () => {},
  onComplete = () => {},
} = {}) {
  if (!state || typeof state !== 'object') throw new Error('Chikun lifecycle state is required');
  if (!session || session.gameId !== 'chikun') throw new Error('Chikun lifecycle session is required');
  if (typeof recordScoreRef !== 'function') throw new Error('Chikun lifecycle recordScoreRef is required');
  let finalized = false;
  let finalResult = null;

  const handleResult = (payload = {}) => {
    if (finalized) return Object.freeze({ ok: false, reason: 'already-finalized', result: finalResult });
    try {
      const { score, runStats } = normalizeResultPayload(payload);
      const canonical = verifyChikunReplayClaim({
        expectedSeed: session.seed,
        expectedBuildHash: session.buildHash,
        expectedSeasonId: session.seasonId,
        score,
        runStats,
        replayClaim: payload.replayClaim,
      });

      let scoreResult = { acceptedForGlobalLeaderboard: false, leaderboardEntry: null, scorePacket: null };
      if (session.leaderboardEligible) {
        scoreResult = recordScoreRef(state, session, canonical.score, runStats);
        persist();
      }
      finalized = true;
      finalResult = Object.freeze({
        ok: true,
        acceptedForGlobalLeaderboard: Boolean(scoreResult.acceptedForGlobalLeaderboard),
        leaderboardEntry: scoreResult.leaderboardEntry ?? null,
        scorePacket: scoreResult.scorePacket ?? null,
        canonical,
      });
      onComplete(finalResult);
      return finalResult;
    } catch (error) {
      return Object.freeze({
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        error,
      });
    }
  };

  return Object.freeze({
    handleResult,
    get finalized() { return finalized; },
    get result() { return finalResult; },
  });
}
