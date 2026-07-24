function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function sameResult(candidate, gameOver) {
  if (!candidate || !gameOver) return false;
  return candidate.score === gameOver.score
    && candidate.kills === gameOver.kills
    && Math.abs(candidate.elapsedMs - gameOver.elapsedMs) <= 0.001;
}

function normalizeRunStats(payload) {
  return {
    score: payload.score,
    kills: payload.kills,
    survivalTime: payload.elapsedMs / 1000,
  };
}

export function createHmhRebootPortalLifecycle({
  combat,
  getSession = () => null,
  getAdapter = () => null,
  finalizeRanked = () => {},
  finalizeFree = () => {},
  syncUi = () => {},
  onError = () => {},
} = {}) {
  if (!combat || typeof combat !== 'object') throw new TypeError('combat state is required');
  let pendingScoreResult = null;
  const finalizedSessionIds = new Set();

  const report = (value) => {
    const error = value instanceof Error ? value : new Error(String(value));
    onError(error);
    return false;
  };

  const handleScoreResult = (message) => {
    if (message?.type !== 'game:score-result' || !message.payload) return report('expected game:score-result');
    pendingScoreResult = Object.freeze({ ...message.payload });
    return true;
  };

  const finalizeGameOver = (message) => {
    const payload = message?.payload;
    const session = getSession();
    const sessionId = session?.sessionId;
    if (!sessionId) return report('HMH reboot game over has no bound parent session');
    if (finalizedSessionIds.has(sessionId)) return false;

    combat.score = payload.score;
    combat.kills = payload.kills;
    combat.elapsedGameSeconds = payload.elapsedMs / 1000;
    combat.active = false;
    combat.paused = false;
    combat.gameOver = true;
    combat.gameOverReason = payload.reason;

    if (!sameResult(pendingScoreResult, payload)) {
      return report('HMH reboot score candidate does not match game-over summary');
    }

    const adapter = getAdapter();
    const runStats = normalizeRunStats(payload);
    try {
      adapter?.emitStatUpdate?.(runStats);
      if (session.isPaid) {
        adapter?.submitScore?.(payload.score, {
          kills: payload.kills,
          survivalTime: runStats.survivalTime,
          checksum: pendingScoreResult.checksum,
        });
      }
      adapter?.end?.(runStats);
      finalizedSessionIds.add(sessionId);
      if (session.isPaid) finalizeRanked({ message, scoreResult: pendingScoreResult, session });
      else finalizeFree({ message, scoreResult: pendingScoreResult, session });
      pendingScoreResult = null;
      syncUi();
      return true;
    } catch (error) {
      return report(error);
    }
  };

  const handleState = (message) => {
    if (!message?.type || !message.payload) return report('HMH reboot state message is invalid');
    if (message.type === 'game:pause') {
      combat.paused = message.payload.paused;
      syncUi();
      return true;
    }
    if (message.type === 'game:state') {
      const payload = message.payload;
      combat.score = payload.score;
      combat.kills = payload.kills;
      combat.elapsedGameSeconds = payload.elapsedMs / 1000;
      combat.health = payload.health;
      combat.maxHealth = payload.maxHealth;
      combat.paused = payload.paused;
      combat.runXp = payload.xp;
      combat.runLevel = payload.level;
      getAdapter()?.emitStatUpdate?.({
        score: payload.score,
        kills: payload.kills,
        survivalTime: payload.elapsedMs / 1000,
      });
      syncUi();
      return true;
    }
    if (message.type === 'game:game-over') return finalizeGameOver(message);
    return report(`unsupported HMH reboot state message: ${message.type}`);
  };

  return Object.freeze({
    handleState,
    handleScoreResult,
    get pendingScoreResult() { return pendingScoreResult ? { ...pendingScoreResult } : null; },
  });
}
