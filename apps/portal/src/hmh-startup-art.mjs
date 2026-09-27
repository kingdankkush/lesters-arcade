// Host-page controller for the Level 1 loading panel art (docs/art/HMH-BANNERS-20260926.md 5.5).
// build.mjs bundles it as its own entry, dist/hmh-reboot/startup-art.js, which
// apps/portal/hmh-reboot/index.html loads with its own <script type="module" src>, so it never
// enters game.js or the child's initial-JS budget. It reads only the DOM the child already
// writes (#hmhStartup[hidden], #hmhRebootStage[data-startup-art], #hmhHudHero[data-hero]) and
// never touches the canvas, the simulation, the bridge or the startup gate.
import { bannerTipsFrom, mountBannerStage } from './hmh-banner-stage.mjs';
import { HMH_ROTATION_TIMING } from './hmh-banner-rotation.mjs';

export function startStartupArt({ documentRef = globalThis.document, windowRef = globalThis.window, now = () => globalThis.performance.now() } = {}) {
  const panel = documentRef?.querySelector?.('#hmhStartup');
  const stage = documentRef?.querySelector?.('#hmhRebootStage');
  const frame = panel?.querySelector?.('.hmh-startup-art');
  if (!panel || !stage || !frame || typeof windowRef?.MutationObserver !== 'function') return null;
  const caption = panel.querySelector('.hmh-startup-art-caption');
  const ticker = panel.querySelector('.hmh-startup-ticker');
  const heroCrest = documentRef.querySelector('#hmhHudHero');
  const media = (query) => { try { return Boolean(windowRef.matchMedia?.(query).matches); } catch { return false; } };
  let mounted = null;
  let mountedHero = null;
  let pending = 0;
  let mountedAt = 0;

  const showing = () => !panel.hidden && stage.dataset.startupArt === 'loading';
  const stop = () => {
    if (pending) windowRef.cancelAnimationFrame?.(pending);
    pending = 0;
    mounted?.stop();
    mounted = null;
    mountedHero = null;
  };
  // The child unhides the panel, marks the stage 'loading' and sets the hero crest in one task;
  // reading on the next frame gets the selected hero, never the markup's default.
  const mount = () => {
    pending = 0;
    if (!showing()) return;
    const heroId = heroCrest?.dataset?.hero ?? '';
    if (mounted && mountedHero === heroId) return;
    mounted?.stop();
    mountedHero = heroId;
    mountedAt = now();
    mounted = mountBannerStage({
      frame,
      backdropHost: panel,
      caption,
      ticker,
      tips: bannerTipsFrom(panel, { coarsePointer: media('(pointer: coarse)') }),
      heroId,
      reduceMotion: media('(prefers-reduced-motion: reduce)') || stage.dataset.settingReduceMotion === 'true',
      // No second image until the level's own assets are in, or 4 s have passed.
      gate: () => panel.getAttribute('aria-busy') === 'false' || now() - mountedAt >= HMH_ROTATION_TIMING.gateMs,
      sizes: '(min-width: 1024px) and (min-height: 700px) 520px, (max-height: 600px) and (min-width: 601px) 38vw, 100vw',
      source: 'loading',
      resumeFrom: 'intro',
      windowRef,
      documentRef,
    });
  };
  const sync = () => {
    if (!showing()) { stop(); return; }
    if (!pending) pending = windowRef.requestAnimationFrame(mount);
  };
  const observers = [
    [panel, ['hidden']],
    [stage, ['data-startup-art', 'data-setting-reduce-motion']],
    ...(heroCrest ? [[heroCrest, ['data-hero']]] : []),
  ].map(([node, attributeFilter]) => {
    const observer = new windowRef.MutationObserver(sync);
    observer.observe(node, { attributes: true, attributeFilter });
    return observer;
  });
  sync();
  return Object.freeze({
    stop() { for (const observer of observers) observer.disconnect(); stop(); },
    get hero() { return mounted?.hero ?? null; },
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') startStartupArt();
