// Failure safety for the Chikun child's animation loop: nothing one frame does
// may stop the loop. Pure and DOM-free, so tests drive it with a fake clock
// (tests/chikun-evidence-v6.test.mjs); main.mjs wires it to requestAnimationFrame.
export function createGuardedFrameLoop({ step, schedule, isDisposed = () => false, onError = () => {} }) {
  let reported = false;
  // A failure is reported once per run (reset() starts a new run).
  function report(error) {
    if (reported) return;
    reported = true;
    try { onError(error); } catch { /* the reporter itself failed */ }
  }
  function frame(now) {
    if (isDisposed()) return;
    try {
      step(now);
    } catch (error) {
      report(error);
    } finally {
      if (!isDisposed()) schedule(frame);
    }
  }
  return Object.freeze({ frame, report, reset() { reported = false; } });
}

// Finishing a run must leave the player a way out: a throw is reported and
// `recover` puts up a usable result screen instead of the previous run's.
export function finishRunSafely(finish, { report, recover }) {
  try {
    finish();
    return true;
  } catch (error) {
    report(error);
    try { recover(error); } catch { /* the loop keeps running either way */ }
    return false;
  }
}
