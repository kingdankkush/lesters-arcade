// Perf step 8: the lazy runtime extras. main.mjs has about a kilobyte of
// initial-JS headroom, so everything perf step 8 adds lives behind this one
// dynamic import and main keeps a handful of optional calls:
//
//   extras?.govern({ quality, profile })  (re)start the graphics governor
//   extras?.sample(deltaMs)               feed it one frame
//   extras?.atmosphere(budget)            the atmosphere budget on its rung
//   extras?.warm(textures)                hidden warm-up renders
//   extras?.pulse(name, intensity)        cabinet haptics
//
// It also starts the rotating control tips, installs the QA frame waiter and,
// only for ?perf=1, fetches the overlay. All of it is projection or tooling:
// none of it is read by the simulation, and none of it can change a tick, a
// hit, a spawn or a result.

import { createCabinetHaptics } from '../../portal/src/cabinet-haptics.mjs';
import { createGraphicsGovernor, createRungApplier } from './graphics-governor.mjs';
import { warmRenderer } from './render-warmup.mjs';
import { startStartupTips } from './startup-tips.mjs';

// window.__HMH.waitFrames(n): resolves after n animation frames, so a smoke
// can wait for rendered frames instead of sleeping. It only waits; it reads
// and writes no game state.
export function createFrameWaiter(requestFrame = globalThis.requestAnimationFrame) {
  return (count = 1) => new Promise((resolve) => {
    let remaining = Math.max(1, Math.floor(Number(count)) || 1);
    const step = () => (--remaining > 0 ? requestFrame(step) : resolve());
    requestFrame(step);
  });
}

export function installRuntimeExtras({
  app,
  dataset = {},
  params = new URLSearchParams(),
  embedded = false,
  ContainerClass,
  SpriteClass,
  vfxPool = null,
  panel = null,
  anchor = null,
  touch = false,
  settings = () => ({}),
  stats = () => ({}),
  windowRef = globalThis.window,
  documentRef = globalThis.document,
} = {}) {
  const evidence = params.get('evidenceSafe') === '1';
  const osReducedMotion = () => Boolean(windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  // Rumble follows the screen-shake setting and stays still under reduced
  // motion, the player's or the OS's.
  const haptics = createCabinetHaptics({
    enabled: () => settings()?.screenShake !== false,
    reducedMotion: () => Boolean(settings()?.reduceMotion) || osReducedMotion(),
  });
  // Evidence runs keep the briefing still.
  if (!evidence) startStartupTips({ documentRef, panel, anchor, touch });
  // A standalone page has no parent (never Ranked); an embedded child gets
  // the waiter only in evidence mode.
  if (windowRef && (!embedded || evidence)) windowRef.__HMH = { ...windowRef.__HMH, waitFrames: createFrameWaiter(windowRef.requestAnimationFrame?.bind(windowRef)) };
  let governor = null;
  const applyRung = createRungApplier({ app, vfxPool, dataset });
  if (params.get('perf') === '1') {
    import('./perf-overlay.mjs').then(({ mountPerfOverlay }) => mountPerfOverlay({
      documentRef,
      stats: () => ({ ...stats(), effects: governor?.effects ?? 'full', resolution: app?.renderer?.resolution, canvas: app?.canvas ? `${app.canvas.width}x${app.canvas.height}` : '' }),
    })).catch(() => {});
  }
  return Object.freeze({
    get governor() { return governor; },
    govern({ quality, profile }) {
      governor = createGraphicsGovernor({ quality, profile, devicePixelRatio: windowRef?.devicePixelRatio || 1, viewport: () => app.screen, onRung: applyRung });
      return governor;
    },
    sample: (deltaMs) => governor?.sample(deltaMs) ?? null,
    atmosphere: (budget) => (governor ? governor.atmosphereBudget(budget) : budget),
    warm: (textures) => warmRenderer({ renderer: app?.renderer, ContainerClass, SpriteClass, textures }),
    pulse: (name, intensity) => haptics.pulse(name, intensity),
  });
}
