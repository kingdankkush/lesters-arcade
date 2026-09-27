// All scenery is seeded, cached and cosmetic. No scene data enters the replay.
// The backdrop follows the seven-region loop (farmland → forest → town → city →
// industrial → suburbs → coast → farmland) from chikun-course-regions.mjs.
//
// Frame pipeline (main.mjs calls draw() first each frame, on an opaque canvas):
//   1. sky, stars, sun or moon and clouds, straight onto the canvas;
//   2. the parallax backdrop (Blender layers, perspective ground bands) into a
//      transparent offscreen canvas, with per-depth fog, the time-of-day grade
//      and the region-transition veil applied as 'source-atop' fills;
//   3. that canvas composited over the sky in depth groups: a layer with lit
//      windows or lamps closes a group, whose lights are added ('lighter')
//      right after it is composited, so nearer layers cover them (parallax.mjs);
//   4. light shafts, a soft top vignette and the region title card.
// Everything draws at the device resolution with an identity transform; the
// art is prescaled once per density (art-loader.mjs). The code-drawn painters
// (painters.mjs) remain the fallback while art loads or if it fails.
// The backdrop never reads the obstacle list (look-ahead guard).
import { courseRegionState } from '../../portal/src/chikun-course-regions.mjs';
import { REGION_LAYERS, paintRegionLayer } from './painters.mjs';
import { chikunSkyState, computeLightRig, createLightRig } from './light-rig.mjs';
import { sceneBus } from './scene-bus.mjs';
import { readDeviceFrame } from './device-blit.mjs';
import { createArtLoader } from './art-loader.mjs';
import { createParallax, createTransition, transitionState, BACKDROP_TOP, BACKDROP_BOTTOM } from './parallax.mjs';
import { createAtmosphere, timeOfDayLabel } from './atmosphere.mjs';

export { chikunSkyState, REGION_LAYERS, paintRegionLayer };
const TAU = Math.PI * 2;
const TITLE_TICKS = 150;

const propArt = new Map();
function loadPropArt() {
  if (propArt.size || typeof Image === 'undefined') return;
  for (const kind of ['tree', 'drone']) {
    const img = new Image(); img.src = '/assets/generated/chikun-open-air-v1/' + kind + '.webp';
    propArt.set(kind, img); img.decode().catch(() => {});
  }
}
function drawProp(ctx, obstacle, tick, reduced) {
  const r = obstacle.render, img = propArt.get(obstacle.kind);
  if (img?.complete && img.naturalWidth) {
    if (obstacle.kind === 'tree') ctx.drawImage(img, r.x, r.y, r.width, r.height);
    else { const frame = reduced ? 0 : Math.floor(tick * 24 / 60) % 8; ctx.drawImage(img, frame % 4 * 256, Math.floor(frame / 4) * 128, 256, 128, r.x, r.y, r.width, r.height); }
    return;
  }
  // The bounded silhouette remains legible if a sprite fails to load.
  for (const shape of obstacle.shapes) {
    ctx.fillStyle = obstacle.kind === 'tree' ? '#3b7250' : '#c3cecc';
    if (shape.type === 'circle') { ctx.beginPath(); ctx.arc(shape.x, shape.y, shape.radius, 0, TAU); ctx.fill(); }
    else if (shape.type === 'capsule') { ctx.strokeStyle = obstacle.kind === 'tree' ? '#846347' : '#bdc9c9'; ctx.lineWidth = shape.radius * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(shape.ax, shape.ay); ctx.lineTo(shape.bx, shape.by); ctx.stroke(); ctx.lineCap = 'butt'; }
  }
}
const rgb = (a, alpha = 1) => `rgba(${a.join(',')},${alpha})`;
function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgb(color, alpha)); g.addColorStop(1, rgb(color, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function polygon(ctx, points, fill) { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); }

function defaultMakeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

// Debug (?chikunDebug=art): expose loader statistics for the Verify phase.
function debugFlag(name) {
  try { return typeof location !== 'undefined' && Boolean(new URLSearchParams(location.search).get('chikunDebug')?.split(',').includes(name)); } catch { return false; }
}

export function createChikunWorld({ loader = null, makeCanvas = defaultMakeCanvas, clock = null } = {}) {
  loadPropArt();
  const art = loader ?? createArtLoader({ makeCanvas });
  const parallax = createParallax({ loader: art, makeCanvas, ...(clock ? { clock } : {}) });
  const atmosphere = createAtmosphere({ makeCanvas });
  const state = {}, rig = createLightRig(), transition = createTransition();
  const bus = sceneBus;
  let backdrop = null, bctx = null;
  const title = { alpha: 0, name: '', detail: '', ranked: false, key: '' };
  const debugArt = debugFlag('art');
  let frameCtx = null;

  // One depth group of the backdrop (parallax.draw): grade and veil rows
  // [y0, y1), composite them 1:1 onto the frame, clear them for the next
  // group, then add the lights of strip layers lo..hi on top.
  function compose(y0, y1, lo, hi) {
    const bus = sceneBus, t = bus.transition;
    if (y1 > y0) {
      atmosphere.grade(bctx, bus, t.veil, t.veilTint, y0, y1);
      frameCtx.drawImage(backdrop, 0, y0, backdrop.width, y1 - y0, 0, Math.round(BACKDROP_TOP * bus.density) + y0, backdrop.width, y1 - y0);
      bctx.clearRect(0, y0, backdrop.width, y1 - y0);
    }
    parallax.drawEmissive(frameCtx, bus, lo, hi);
  }

  function backdropCanvas(cw, d) {
    const h = Math.ceil((BACKDROP_BOTTOM - BACKDROP_TOP) * d);
    if (!backdrop) { backdrop = makeCanvas(cw, h); bctx = backdrop?.getContext('2d') ?? null; }
    if (backdrop && (backdrop.width !== cw || backdrop.height !== h)) { backdrop.width = cw; backdrop.height = h; }
    return bctx;
  }

  function updateTitle(mode) {
    const local = state.localTick;
    if (local >= TITLE_TICKS) { title.alpha = 0; return null; }
    title.alpha = Math.min(1, local / 12 + 0.35, (TITLE_TICKS - local) / 30);
    const detail = timeOfDayLabel(rig) + '  ·  ' + (mode === 'ranked' ? 'RANKED FLIGHT' : 'FREE FLIGHT') + (state.loop > 0 ? '  ·  LAP ' + (state.loop + 1) : '');
    const key = state.region.id + detail;
    if (title.key !== key) { title.key = key; title.name = state.region.name.toUpperCase(); title.detail = detail; }
    title.ranked = mode === 'ranked';
    return title;
  }

  return {
    draw(ctx, snapshot, { reduced = false, mode = 'free', idleTime = 0, view = { left: 0, width: 1280, height: 720, density: 1 } } = {}) {
      const tick = snapshot?.tick ?? 0;
      const time = reduced ? 0 : tick / 60 + (tick === 0 ? idleTime * .3 : 0);
      const sky = chikunSkyState(time, reduced);
      courseRegionState(tick, state);
      // Parallax follows the canonical distance so the scenery speeds up with the run.
      // On the ready screen (tick 0) it drifts with the idle clock, but region
      // seams always follow the course distance: the menu keeps the first region.
      const course = reduced ? 0 : (snapshot?.distancePixels ?? tick * 2.4);
      const distance = course + (!reduced && tick === 0 ? idleTime * 40 : 0);
      bus.frame++;
      bus.view = view; bus.tick = tick; bus.time = time; bus.distance = distance; bus.seamDistance = course; bus.reduced = reduced; bus.region = state; bus.art = art;
      readDeviceFrame(ctx, view, bus);
      if (reduced) { bus.shakeX = 0; bus.shakeY = 0; }
      bus.tier = art.tier(bus.density);
      bus.rig = computeLightRig(sky, state, view, rig);
      bus.transition = transitionState(state, course, reduced, transition);
      parallax.schedule(bus, transition);
      art.pump(2);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      atmosphere.drawSky(ctx, bus, time);
      const b = backdropCanvas(bus.canvasWidth, bus.density);
      if (b) {
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
        b.clearRect(0, 0, backdrop.width, backdrop.height);
        frameCtx = ctx;
        parallax.draw(b, bus, transition, compose);
        frameCtx = null;
      }
      atmosphere.drawRays(ctx, bus);
      if (!snapshot?.chikun?.locomotion) {
        // Floor for legacy flight snapshots; ground-world paints the canonical strip.
        const y = Math.round(690 * bus.density);
        ctx.fillStyle = '#203c32'; ctx.fillRect(0, y, bus.canvasWidth, bus.canvasHeight - y);
        ctx.fillStyle = '#a1b798'; ctx.fillRect(0, y, bus.canvasWidth, Math.max(1, Math.round(3 * bus.density)));
      }
      atmosphere.drawOverlay(ctx, bus, updateTitle(mode));
      ctx.restore();
      if (debugArt && typeof window !== 'undefined') window.__chikunArtStats = { ...art.stats(), tier: bus.tier, density: bus.density, parallax: { ...parallax.stats } };
    },
    regionState() { return state; },
    // Renderer counters (painter rebuilds, blits, band fills, depth groups).
    stats() { return { ...parallax.stats }; },
    art,
    dispose() { art.dispose(); parallax.dispose(); atmosphere.dispose(); if (backdrop) { backdrop.width = 0; backdrop.height = 0; } backdrop = null; bctx = null; },
  };
}

export function drawChikunObstacle(ctx, fork, tick = 0, reduced = false) {
  const { x, width: w, gapTop: top, gapBottom: bottom } = fork;
  const metal = ctx.createLinearGradient(x, 0, x + w, 0); metal.addColorStop(0, '#142a3a'); metal.addColorStop(.12, '#5f7a85'); metal.addColorStop(.20, '#263f51'); metal.addColorStop(.72, '#192f40'); metal.addColorStop(.87, '#456879'); metal.addColorStop(1, '#102534');
  function column(y, h, edge, upper) {
    ctx.fillStyle = metal; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#0b1c2a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y, w - 2, h);
    ctx.fillStyle = 'rgba(171,209,213,.23)'; ctx.fillRect(x + 9, y, 2, h); ctx.fillStyle = '#0d2334'; ctx.fillRect(x + w - 13, y, 5, h);
    // Inset ribs and rivets fit within the collision rectangle.
    for (let yy = y + 25; yy < y + h - 18; yy += 48) {
      ctx.fillStyle = '#153143'; ctx.fillRect(x + 15, yy, w - 31, 22); ctx.fillStyle = 'rgba(165,197,199,.16)'; ctx.fillRect(x + 16, yy, w - 32, 1);
      ctx.fillStyle = '#91a9ab'; for (const xx of [x + 7, x + w - 8]) { ctx.beginPath(); ctx.arc(xx, yy + 7, 1.7, 0, TAU); ctx.fill(); }
    }
    const capY = upper ? edge - 24 : edge;
    const cap = ctx.createLinearGradient(0, capY, 0, capY + 24); cap.addColorStop(0, '#9caca5'); cap.addColorStop(.16, '#344e5d'); cap.addColorStop(.8, '#1c3547'); cap.addColorStop(1, '#a0b8b4'); ctx.fillStyle = cap; ctx.fillRect(x, capY, w, 24);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 5, capY + 5, w - 10, 9); ctx.clip(); ctx.fillStyle = '#cdb47e'; ctx.fillRect(x + 5, capY + 5, w - 10, 9); ctx.fillStyle = '#2a3a42';
    for (let sx = x - 10; sx < x + w; sx += 19) polygon(ctx, [[sx, capY + 5], [sx + 9, capY + 5], [sx + 19, capY + 14], [sx + 10, capY + 14]], '#2a3a42'); ctx.restore();
    ctx.fillStyle = '#72ead3'; ctx.shadowColor = '#69e9d3'; ctx.shadowBlur = 9; ctx.fillRect(x + 3, upper ? edge - 2 : edge, w - 6, 2); ctx.shadowBlur = 0;
    const lampY = upper ? edge - 39 : edge + 38; ctx.fillStyle = '#f3a27a'; ctx.beginPath(); ctx.arc(x + w / 2, lampY, 3, 0, TAU); ctx.fill();
    if (!reduced) glow(ctx, x + w / 2, lampY, 14, [246, 151, 104], .12 + .06 * Math.sin(tick * .04));
  }
  const gate = !fork.kind || fork.kind === 'gate';
  if (gate) { column(0, top, top, true); column(bottom, 720 - bottom, bottom, false); }
  else drawProp(ctx, fork, tick, reduced);
  if (gate && top > 125) {
    ctx.save(); ctx.translate(x + w / 2, Math.max(55, top * .45)); ctx.fillStyle = '#111f2b'; ctx.fillRect(-43, -22, 86, 44); ctx.strokeStyle = '#617784'; ctx.lineWidth = 1; ctx.strokeRect(-43, -22, 86, 44); ctx.font = '800 12px system-ui'; ctx.fillStyle = '#b7c6c6'; ctx.textAlign = 'center'; ctx.fillText('BIG CORP', 0, -3); ctx.font = '8px system-ui'; ctx.fillStyle = '#7899a2'; ctx.fillText('AIRSPACE CONTROL', 0, 11); ctx.restore();
  }
  if (!fork.coin.collected) {
    const c = fork.coin; ctx.save(); ctx.translate(c.x, c.y); const spin = reduced ? 1 : .77 + .23 * Math.cos(tick * .05 + fork.index); glow(ctx, 0, 0, 46, [249, 220, 158], .16); ctx.scale(spin, 1);
    const coin = ctx.createLinearGradient(-24, -24, 24, 24); coin.addColorStop(0, '#fff5d7'); coin.addColorStop(.5, '#e7c786'); coin.addColorStop(1, '#ad793d'); ctx.fillStyle = coin; ctx.beginPath(); ctx.arc(0, 0, c.radius, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff2c7'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = '#a67a42'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, c.radius - 5, 0, TAU); ctx.stroke(); ctx.font = 'bold 31px Georgia'; ctx.fillStyle = '#79542f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Ł', 0, 2); ctx.restore();
  }
}
