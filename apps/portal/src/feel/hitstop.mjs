// Shared feel module (2.1, upgrade guide §2.1 option b): presentation-only
// hitstop. Owner decision for 2.1: the freeze lives in the RENDERER, in every
// mode, so Ranked simulation, evidence and results are untouched.
//
// The renderer holds the last presented pose for N display frames (measured
// as N x 1000/60 ms so a 120 Hz display holds the same wall time) while the
// simulation keeps stepping; when the hold ends the renderer draws the current
// state and has caught up. Nothing here is read by a simulation.
//
// Rules:
// - requests made during one frame collapse to the strongest (request());
//   commit(nowMs) starts the hold after the frame that produced the impact,
//   so the impact pose itself is what freezes;
// - while a hold is active new requests are ignored (swarm cap, part 1);
// - at most `maxPerSecond` holds start in any rolling second (part 2);
// - the caller gates it (own setting, default on; off under reduced motion).
// No per-frame allocation: a fixed ring of start times.

export const HITSTOP_FRAME_MS = 1000 / 60;
export const HITSTOP_MAX_FRAMES = 6;
// Frame clocks jitter; a frame landing within this of the hold's end still holds.
const EDGE_MS = 0.5;

export function createHitstop({ maxPerSecond = 3, maxFrames = HITSTOP_MAX_FRAMES, frameMs = HITSTOP_FRAME_MS } = {}) {
  if (!Number.isInteger(maxPerSecond) || maxPerSecond < 1) throw new TypeError('maxPerSecond must be a positive integer');
  const starts = new Float64Array(maxPerSecond).fill(-Infinity);
  let cursor = 0;
  let pending = 0;
  let holdFrom = -Infinity;
  let holdUntil = -Infinity;
  // peakPerSecond: the most holds that started inside any rolling second.
  const stats = { started: 0, ignoredActive: 0, ignoredRate: 0, heldFrames: 0, lastFrames: 0, peakPerSecond: 0 };
  return {
    stats,
    // Called once per qualifying event (from inside the frame's ticks).
    request(frames) {
      const value = Math.min(maxFrames, Math.max(0, Math.trunc(Number(frames) || 0)));
      if (value > pending) pending = value;
    },
    // Called once per frame after the simulation update. Returns true when a
    // hold started this frame.
    commit(nowMs, enabled = true) {
      const frames = pending;
      pending = 0;
      if (!enabled || frames <= 0) return false;
      if (nowMs <= holdUntil + EDGE_MS) { stats.ignoredActive += 1; return false; }
      // The oldest of the last `maxPerSecond` starts must be a second old.
      if (nowMs - starts[cursor] < 1000) { stats.ignoredRate += 1; return false; }
      starts[cursor] = nowMs;
      cursor = (cursor + 1) % maxPerSecond;
      holdFrom = nowMs;
      holdUntil = nowMs + frames * frameMs;
      stats.started += 1;
      stats.lastFrames = frames;
      let inWindow = 0;
      for (let i = 0; i < maxPerSecond; i += 1) if (nowMs - starts[i] < 1000) inWindow += 1;
      if (inWindow > stats.peakPerSecond) stats.peakPerSecond = inWindow;
      return true;
    },
    // True on the N frames after the impact frame (the impact frame itself
    // renders; the hold keeps that pose up for `frames` x 1000/60 ms).
    holding(nowMs) {
      const held = nowMs > holdFrom && nowMs <= holdUntil + EDGE_MS;
      if (held) stats.heldFrames += 1;
      return held;
    },
    cancel() {
      pending = 0;
      holdUntil = -Infinity;
    },
    reset() {
      pending = 0; holdFrom = -Infinity; holdUntil = -Infinity; cursor = 0; starts.fill(-Infinity);
      stats.started = 0; stats.ignoredActive = 0; stats.ignoredRate = 0; stats.heldFrames = 0; stats.lastFrames = 0; stats.peakPerSecond = 0;
    },
  };
}
