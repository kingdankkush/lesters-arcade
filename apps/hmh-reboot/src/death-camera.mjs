import { FIXED_STEP_MS } from './simulation.mjs';

// Design package 7.2 #1 and S1.1: the death camera. On the defeat tick the
// simulation freezes ('game-over') and main.mjs builds the run's result there,
// unchanged. The renderer keeps drawing for 72 presentation ticks (1.2 s) so
// the hero's death clip plays, and only then does the child hand the result to
// the parent and stop the ticker. The parent sees the results screen 1.2 s
// later; score submission and Ranked finalisation are untouched.
//
// Projection only. The clock is the render loop's wall time (a 120 Hz display
// or a stalled phone still takes 1.2 s) and never reaches the simulation, the
// score or the evidence. A flush releases at once (tab hidden, exit, session
// end) and a backstop timer releases when no frame is drawn at all, so a
// result can never be held back indefinitely.
export const DEATH_CAMERA_TICKS = 72;
export const DEATH_CAMERA_BACKSTOP_MS = 2_000;

export function createDeathCamera({ release, setTimer = null, clearTimer = null, backstopMs = DEATH_CAMERA_BACKSTOP_MS } = {}) {
  if (typeof release !== 'function') throw new TypeError('death camera release must be a function');
  let pending = null;
  let ticks = 0;
  const cancelTimer = () => {
    if (pending?.timer != null && clearTimer) clearTimer(pending.timer);
  };
  const releaseNow = (reason) => {
    if (!pending) return false;
    cancelTimer();
    const { messages } = pending;
    pending = null;
    // A released camera shows the final pose, whatever cut it short.
    ticks = DEATH_CAMERA_TICKS;
    release(messages, reason);
    return true;
  };
  return Object.freeze({
    begin({ messages = null } = {}) {
      if (pending) throw new Error('death camera is already running');
      ticks = 0;
      pending = { messages, elapsedMs: 0, timer: null };
      if (setTimer) pending.timer = setTimer(() => releaseNow('backstop'), backstopMs);
    },
    // Called once per drawn frame with the frame's wall time.
    advance(deltaMs) {
      if (!pending) return ticks;
      if (Number.isFinite(deltaMs) && deltaMs > 0) pending.elapsedMs += deltaMs;
      ticks = Math.min(DEATH_CAMERA_TICKS, Math.floor(pending.elapsedMs / FIXED_STEP_MS + 1e-9));
      if (ticks >= DEATH_CAMERA_TICKS) releaseNow('complete');
      return ticks;
    },
    flush(reason = 'flush') {
      return releaseNow(reason);
    },
    // A new session starts clean. Never releases: flush first when a held
    // result must still reach the parent.
    reset() {
      cancelTimer();
      pending = null;
      ticks = 0;
    },
    get active() {
      return pending !== null;
    },
    // Presentation ticks since the defeat tick (0-72): the death clip's clock.
    get ticks() {
      return ticks;
    },
  });
}
