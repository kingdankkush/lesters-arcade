// The rotating Level 1 art frame (docs/art/HMH-BANNERS-20260926.md 5.4-5.6), shared by the
// portal's Level 1 intro (bundled into a lazy chunk) and the HMH host page's loading panel
// (loaded as its own module; the route CSP allows no inline script and no style attributes,
// so this sets only classes, data attributes, src/srcset and CSSOM custom properties).
// Presentation only: it never touches the canvas, the simulation, the bridge or the startup gate.
import { HMH_HERO_LOADING, HMH_LOADING_POOL } from './generated/hmh-loading-art.mjs';
import {
  HMH_ROTATION_TIMING, clearRotationResume, createBannerRotation, readRotationResume, writeRotationResume,
} from './hmh-banner-rotation.mjs';

function sessionStore(windowRef) {
  try { return windowRef?.sessionStorage ?? null; } catch { return null; }
}

// Tip sentences for the ticker, read from the panel's own tip articles so no second copy
// of the tips exists. Touch-only lines are kept only on touch screens.
export function bannerTipsFrom(root, { coarsePointer = false } = {}) {
  const out = [];
  for (const paragraph of root?.querySelectorAll?.('.hmh-startup-tips article p') ?? []) {
    if (!coarsePointer && paragraph.classList?.contains('hmh-startup-touch')) continue;
    for (const sentence of String(paragraph.textContent ?? '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)) {
      if (sentence.trim().length >= 24) out.push(sentence.trim());
    }
  }
  return out;
}

export function mountBannerStage({
  frame,
  backdropHost = null,
  caption = null,
  ticker = null,
  tips = [],
  heroId,
  reduceMotion = false,
  gate = null,
  sizes = '(min-width: 1024px) 50vw, 100vw',
  source = 'intro',
  resumeFrom = null,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  random,
} = {}) {
  if (!frame || !documentRef) return Object.freeze({ stop() {}, hero: null });
  const storage = sessionStore(windowRef);
  const byId = new Map(HMH_LOADING_POOL.map((entry) => [entry.id, entry]));
  const resume = resumeFrom ? readRotationResume(storage, heroId, { source: resumeFrom }) : null;
  if (resume) clearRotationResume(storage);
  const rotation = createBannerRotation({ pool: HMH_LOADING_POOL, heroLoading: HMH_HERO_LOADING, heroId, resume, ...(random ? { random } : {}) });
  const layers = [0, 1].map(() => {
    const image = documentRef.createElement('img');
    image.className = 'hmh-art-layer';
    image.decoding = 'async';
    image.width = 1280;
    image.height = 720;
    image.setAttribute('sizes', sizes);
    image.dataset.active = 'false';
    image.setAttribute('aria-hidden', 'true');
    image.alt = '';
    frame.prepend(image);
    return image;
  });
  let active = -1;
  let timer = 0;
  let stopped = false;
  let tipIndex = 0;
  frame.dataset.artState = 'loading';
  frame.dataset.artMotion = reduceMotion ? 'reduced' : 'full';

  const setTip = () => {
    if (!ticker || !tips.length) return;
    ticker.textContent = tips[tipIndex % tips.length];
    tipIndex += 1;
  };

  async function present(entry, priority) {
    if (!entry) return false;
    const target = layers[active === 0 ? 1 : 0];
    target.fetchPriority = priority;
    target.style.setProperty('--hmh-art-focal', entry.focal);
    target.setAttribute('srcset', entry.srcset);
    target.src = entry.src;
    try {
      await target.decode();
    } catch {
      return false;
    }
    if (stopped) return false;
    if (active >= 0) {
      layers[active].dataset.active = 'false';
      layers[active].setAttribute('aria-hidden', 'true');
      layers[active].alt = '';
    }
    active = layers.indexOf(target);
    target.alt = entry.alt;
    target.removeAttribute('aria-hidden');
    target.dataset.active = 'true';
    frame.dataset.artState = 'ready';
    frame.dataset.artId = entry.id;
    if (caption) caption.textContent = entry.caption;
    backdropHost?.style?.setProperty('--hmh-art-backdrop', `url("${entry.thumb}")`);
    writeRotationResume(storage, rotation.state(source));
    return true;
  }

  const schedule = (delay = HMH_ROTATION_TIMING.holdMs) => {
    if (stopped || reduceMotion) return;
    timer = windowRef.setTimeout(tick, delay);
  };

  async function tick() {
    if (stopped) return;
    // Never compete with the level's own downloads, and never rotate in a hidden tab.
    if (documentRef.hidden || (gate && !gate())) { schedule(1000); return; }
    let shown = false;
    for (let attempt = 0; attempt < 3 && !shown && !stopped; attempt += 1) shown = await present(byId.get(rotation.next()), 'low');
    setTip();
    schedule();
  }

  setTip();
  present(byId.get(rotation.current()), 'high').then((shown) => {
    if (!shown && !stopped) frame.dataset.artState = 'fallback';
    schedule();
  });

  return Object.freeze({
    hero: rotation.hero,
    stop() {
      if (stopped) return;
      stopped = true;
      windowRef.clearTimeout?.(timer);
      // Release the decoded bitmaps before gameplay.
      for (const image of layers) {
        image.removeAttribute('srcset');
        image.removeAttribute('src');
        image.remove();
      }
      backdropHost?.style?.removeProperty('--hmh-art-backdrop');
      if (caption) caption.textContent = '';
      frame.dataset.artState = 'idle';
      delete frame.dataset.artId;
    },
  });
}
