// Wall time is diagnostic/forfeit policy only; it never enters canonical scoring.
export function createStackedPauseClock() {
  let pausedAt = null, total = 0, resumeAt = null;
  return Object.freeze({
    pause(now) { resumeAt = null; if (pausedAt === null) pausedAt = now; },
    requestResume(now, ranked) {
      if (resumeAt !== null) return;
      resumeAt = now + (ranked ? 3000 : 0);
    },
    complete(now) {
      if (resumeAt === null || now < resumeAt) return false;
      if (pausedAt !== null) total += Math.max(0, now - pausedAt);
      pausedAt = null; resumeAt = null; return true;
    },
    elapsed(now) { return total + (pausedAt === null ? 0 : Math.max(0, now - pausedAt)); },
    remaining(now) { return resumeAt === null ? 0 : Math.max(0, resumeAt - now); },
    get countingDown() { return resumeAt !== null; },
  });
}
