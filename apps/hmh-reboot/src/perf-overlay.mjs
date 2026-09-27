// Perf step 8: the ?perf=1 overlay (lazy; main.mjs imports it only when the
// URL asks, so normal play never downloads it).
//
// A small fixed panel for device testing (docs/hmh-reboot/MOBILE-PERF-TEST.md):
// fps, frame time average and p95 over the last 2 s, live enemies and
// projectiles, the graphics tier and effects rung, the renderer resolution and
// the texture tier. It measures its own requestAnimationFrame deltas and reads
// a stats() getter; it writes nothing but its own element, so it cannot
// change a tick, a hit or a result.

export const PERF_WINDOW_MS = 2000;
export const PERF_REFRESH_MS = 500;

// Frame deltas within the trailing window -> { fps, avgMs, p95Ms }.
export function summarizeFrames(deltas) {
  const valid = deltas.filter((delta) => Number.isFinite(delta) && delta > 0);
  if (!valid.length) return Object.freeze({ fps: 0, avgMs: 0, p95Ms: 0, frames: 0 });
  const total = valid.reduce((sum, delta) => sum + delta, 0);
  const sorted = [...valid].sort((a, b) => a - b);
  const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return Object.freeze({ fps: 1000 * valid.length / total, avgMs: total / valid.length, p95Ms, frames: valid.length });
}

export function formatPerfLines(summary, stats = {}) {
  return [
    `${summary.fps.toFixed(0)} fps  ${summary.avgMs.toFixed(1)} ms avg  ${summary.p95Ms.toFixed(1)} p95`,
    `enemies ${stats.enemies ?? 0}  shots ${stats.projectiles ?? 0}`,
    `tier ${stats.tier ?? 'auto'}/${stats.profile ?? '?'}  fx ${stats.effects ?? 'full'}`,
    `res ${Number(stats.resolution ?? 1).toFixed(2)}x  ${stats.canvas ?? ''}  tex ${stats.textures ?? 'full'}`,
  ];
}

export function mountPerfOverlay({ documentRef = globalThis.document, mount = documentRef?.body, stats = () => ({}), now = () => performance.now(), requestFrame = globalThis.requestAnimationFrame, cancelFrame = globalThis.cancelAnimationFrame } = {}) {
  const panel = documentRef.createElement('pre');
  panel.className = 'hmh-perf-overlay';
  panel.setAttribute('aria-hidden', 'true');
  panel.dataset.perfOverlay = 'true';
  Object.assign(panel.style, {
    position: 'fixed', top: 'max(6px, env(safe-area-inset-top))', left: 'max(6px, env(safe-area-inset-left))', zIndex: '2147483000',
    margin: '0', padding: '6px 8px', borderRadius: '6px', background: 'rgba(3,10,16,0.78)', color: '#bff8ff',
    font: '600 11px/1.35 ui-monospace, Menlo, Consolas, monospace', pointerEvents: 'none', whiteSpace: 'pre',
  });
  mount.append(panel);
  const frames = [];
  let last = null, lastPaint = 0, handle = 0, stopped = false;
  const tick = () => {
    if (stopped) return;
    const time = now();
    if (last !== null) frames.push({ time, delta: time - last });
    last = time;
    while (frames.length && time - frames[0].time > PERF_WINDOW_MS) frames.shift();
    if (time - lastPaint >= PERF_REFRESH_MS) {
      lastPaint = time;
      const summary = summarizeFrames(frames.map((frame) => frame.delta));
      let snapshot = {};
      try { snapshot = stats() ?? {}; } catch { snapshot = {}; }
      panel.textContent = formatPerfLines(summary, snapshot).join('\n');
      panel.dataset.fps = summary.fps.toFixed(1);
      panel.dataset.p95Ms = summary.p95Ms.toFixed(2);
    }
    handle = requestFrame(tick);
  };
  handle = requestFrame(tick);
  return Object.freeze({
    element: panel,
    destroy() { stopped = true; cancelFrame?.(handle); panel.remove(); },
  });
}
