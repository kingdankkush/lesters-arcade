// Parallax backdrop: the Blender scenery layers (far, mid, near), the
// perspective ground bands between the horizon and the running line, and the
// region transitions. Drawn at device resolution into a transparent offscreen
// canvas, so fog, the time-of-day grade and the transition veil ('source-atop'
// fills) touch backdrop pixels only; world.mjs composites it over the sky.
//
// Depth model: horizon y = 560, running line y = 690. A layer with scroll rate r
// stands on y = 560 + 130 r and shows strip column u = x + D r at screen x (D =
// course distance). A region boundary at distance Db reaches Chikun (x = 280)
// on every layer at the same moment: its seam sits at x = 280 + (Db - D) r.
//
// Look-ahead: nothing here reads the obstacle list.
import { CHIKUN_REGIONS, REGION_START_SLOTS, REGION_LOOP_SLOTS, COURSE_CADENCE, regionSwitchTick } from '../../portal/src/chikun-course-regions.mjs';
import { distanceAtTick } from '../../portal/src/chikun-ground-course.mjs';
import { REGION_LAYERS, paintRegionLayer } from './painters.mjs';
import { blitPeriodic, fillPeriodicBand } from './device-blit.mjs';
import { rgba } from './light-rig.mjs';
import { SCENERY_CATALOG } from './scenery-catalog.mjs';

export const BACKDROP_TOP = 280;
export const BACKDROP_BOTTOM = 694;
export const STRIP_LAYERS = Object.freeze(['far', 'mid', 'near']);
const PAINTER_DEPTH = { far: 0, mid: 1, near: 2 };
// Distant lights read smaller and softer; the near street keeps full strength.
export const EMIT_GAIN = Object.freeze({ far: 0.6, mid: 0.8, near: 1.0 });
// Transition window, in scenery ticks around the switch (negative = before).
export const TRANSITION = Object.freeze({ start: -300, end: 60, swapTicks: 30, swap: Object.freeze({ far: -210, mid: -160, near: -110, bands: -70 }), seamRate: 0.6, veil: 0.7 });
// Signature veils between regions (tint mixed into the horizon colour).
const VEIL_TINT = { 'farmland>forest': [255, 204, 150], 'suburbs>coast': [255, 204, 150], 'coast>farmland': [222, 234, 242], 'city>industrial': [196, 184, 162], 'industrial>suburbs': [240, 222, 196] };
const DEFAULT_LAYER = { far: { top: 330, height: 236, rate: 0.03 }, mid: { top: 320, height: 260, rate: 0.12 }, near: { top: 440, height: 162, rate: 0.30 } };
export const HORIZON_Y = SCENERY_CATALOG.spec?.horizonY ?? 560;
export const RUN_Y = SCENERY_CATALOG.spec?.runY ?? 690;
export const rateAtY = y => (y - HORIZON_Y) / (RUN_Y - HORIZON_Y);

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- transitions
const boundaryCache = new Map();
// Course distance at which the scenery of absolute obstacle slot `slot` takes over.
export function boundaryDistance(slot) {
  if (slot <= 0) return -Infinity;
  let d = boundaryCache.get(slot);
  if (d === undefined) {
    d = distanceAtTick(regionSwitchTick(slot));
    if (boundaryCache.size > 64) boundaryCache.clear();
    boundaryCache.set(slot, d);
  }
  return d;
}

export function createTransition() {
  return { cur: 0, next: 1, prev: 6, s: -1e9, after: 0, veil: 0, veilTint: null, seams: false, Dprev: -Infinity, Dnext: Infinity, mix: { far: 0, mid: 0, near: 0, bands: 0 } };
}

// Pure function of the region state and the distance, so replay seeks are safe.
export function transitionState(state, distance, reduced, out = createTransition()) {
  const n = CHIKUN_REGIONS.length;
  out.cur = state.index; out.next = state.nextIndex; out.prev = (state.index + n - 1) % n;
  const slots = state.region.slots;
  out.s = state.localTick - slots * COURSE_CADENCE;
  out.after = state.localTick;
  const startSlot = state.loop * REGION_LOOP_SLOTS + REGION_START_SLOTS[state.index];
  out.Dprev = boundaryDistance(startSlot);
  out.Dnext = boundaryDistance(startSlot + slots);
  if (reduced) {
    out.seams = false; out.veil = 0; out.veilTint = null;
    out.mix.far = out.mix.mid = out.mix.near = out.mix.bands = state.blend;
    return out;
  }
  out.seams = true;
  const { swap, swapTicks } = TRANSITION;
  out.mix.far = smooth(swap.far, swap.far + swapTicks, out.s);
  out.mix.mid = smooth(swap.mid, swap.mid + swapTicks, out.s);
  out.mix.near = smooth(swap.near, swap.near + swapTicks, out.s);
  out.mix.bands = smooth(swap.bands, swap.bands + swapTicks, out.s);
  const span = TRANSITION.end - TRANSITION.start;
  let sigma = null, from = out.cur, to = out.next;
  if (out.s >= TRANSITION.start) sigma = out.s;
  else if (out.after <= TRANSITION.end && Number.isFinite(out.Dprev)) { sigma = out.after; from = out.prev; to = out.cur; }
  out.veil = sigma === null ? 0 : TRANSITION.veil * Math.pow(Math.max(0, Math.sin(Math.PI * (sigma - TRANSITION.start) / span)), 0.8);
  out.veilTint = sigma === null ? null : VEIL_TINT[CHIKUN_REGIONS[from].id + '>' + CHIKUN_REGIONS[to].id] ?? null;
  return out;
}

// Screen x (logical) of a region seam on a layer scrolling at `rate`.
export const seamX = (boundary, distance, rate) => 280 + (boundary - distance) * rate;

// ---------------------------------------------------------------- the backdrop
export function createParallax({ loader, makeCanvas, clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) } = {}) {
  const painterCache = new Map(); // `${regionIndex}:${depth}` -> {canvas, density}
  const painterOrder = [];
  const readyAt = new Map();      // region id -> clock ms when art became ready
  const emitQueue = Array.from({ length: 12 }, () => ({ region: '', layer: '', alpha: 0, scroll: 0, y: 0, period: 0, anchors: null }));
  let beam = null, beamDensity = 0;
  let emitCount = 0;
  const stats = { painterBuilds: 0, bandFills: 0, blits: 0 };

  function painter(regionIndex, depth, density) {
    const key = regionIndex + ':' + depth;
    let p = painterCache.get(key);
    if (p && Math.abs(p.density - density) < 1e-3) return p;
    if (p) { p.canvas.width = 0; p.canvas.height = 0; }
    const size = REGION_LAYERS[depth];
    const canvas = makeCanvas(Math.round(size.width * density), Math.round(size.height * density));
    if (!canvas) return null;
    const cx = canvas.getContext('2d');
    cx.setTransform(density, 0, 0, density, 0, 0);
    paintRegionLayer(cx, CHIKUN_REGIONS[regionIndex].id, depth, false, size);
    p = { canvas, density, key };
    painterCache.set(key, p);
    const at = painterOrder.indexOf(key); if (at >= 0) painterOrder.splice(at, 1); painterOrder.push(key);
    while (painterOrder.length > 9) { const old = painterCache.get(painterOrder.shift()); if (old) { old.canvas.width = 0; old.canvas.height = 0; painterCache.delete(old.key); } }
    stats.painterBuilds++;
    return p;
  }

  function freePainters(regionIndex) {
    for (let depth = 0; depth < 3; depth++) {
      const key = regionIndex + ':' + depth, p = painterCache.get(key);
      if (p) { p.canvas.width = 0; p.canvas.height = 0; painterCache.delete(key); const at = painterOrder.indexOf(key); if (at >= 0) painterOrder.splice(at, 1); }
    }
  }

  // 0..1: how much of the region's backdrop is art (fades in over 0.4 s once ready).
  function artLevel(id, reduced) {
    if (!loader || !loader.ready(id)) { readyAt.delete(id); return 0; }
    let t = readyAt.get(id);
    if (t === undefined) { t = clock(); readyAt.set(id, t); }
    return reduced ? 1 : clamp((clock() - t) / 400);
  }

  function layerGeometry(id, name) {
    return SCENERY_CATALOG.regions?.[id]?.layers?.[name] ?? DEFAULT_LAYER[name];
  }

  function drawStrip(ctx, bus, regionIndex, name, alpha, art) {
    if (alpha <= 0.003) return;
    const id = CHIKUN_REGIONS[regionIndex].id, d = bus.density, cw = bus.canvasWidth;
    const shakeK = bus.reduced ? 0 : 1;
    if (art > 0) {
      const g = layerGeometry(id, name), strip = loader.layer(id, name);
      const k = Math.max(g.rate, 0.2) * shakeK;
      const scroll = (bus.distance * g.rate + bus.view.left - bus.shakeX * k) * d;
      const y = Math.round((g.top - BACKDROP_TOP + bus.shakeY * k) * d);
      ctx.globalAlpha = alpha * art;
      if (Math.abs(strip.density - d) < 1e-3) stats.blits += blitPeriodic(ctx, strip.canvas, strip.w, scroll, y, 0, cw, g.rate >= 0.2);
      else {
        // Transient after a rotation: the old prescale drawn scaled until the new one lands.
        const s = d / strip.density, period = strip.w * s;
        for (let x = -((scroll % period) + period) % period; x < cw; x += period) ctx.drawImage(strip.canvas, x, y, period, strip.h * s);
      }
      if (g.sprites) drawSprites(ctx, bus, id, name, g, scroll, y, strip.w);
      if (emitCount < emitQueue.length && (loader.emit(id, name) || g.anchors)) {
        const e = emitQueue[emitCount++];
        e.region = id; e.layer = name; e.alpha = alpha * art; e.scroll = scroll; e.y = y + Math.round(BACKDROP_TOP * d); e.period = strip.w; e.anchors = g.anchors ?? null;
      }
    }
    if (art < 1) {
      const depth = PAINTER_DEPTH[name], size = REGION_LAYERS[depth], p = painter(regionIndex, depth, d);
      if (p) {
        const k = Math.max(size.rate, 0.2) * shakeK;
        const scroll = (bus.distance * size.rate + bus.view.left - bus.shakeX * k) * d;
        ctx.globalAlpha = alpha * (1 - art);
        stats.blits += blitPeriodic(ctx, p.canvas, p.canvas.width, scroll, Math.round((size.top - BACKDROP_TOP + bus.shakeY * k) * d), 0, cw, true);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Animated landmark parts (the windmill rotor), drawn on their strip's copies.
  function drawSprites(ctx, bus, id, name, g, scroll, y, period) {
    const d = bus.density, cw = bus.canvasWidth;
    for (const sp of g.sprites) {
      const img = loader.sprite(id, name, sp.id);
      if (!img) continue;
      const k = d / img.density; // 1 except briefly after a rotation
      const angle = sp.motion === 'spin' && !bus.reduced ? (bus.time * sp.speed * Math.PI * 2) % (Math.PI * 2) : 0;
      const r = Math.hypot(Math.max(sp.px, sp.w - sp.px), Math.max(sp.py, sp.h - sp.py)) * d;
      let x = Math.round(sp.u * d) - (((scroll % period) + period) % period);
      while (x + r > 0) x -= period;
      x += period;
      for (; x - r < cw; x += period) {
        ctx.save();
        ctx.translate(x, y + sp.y * d); ctx.rotate(angle);
        if (k === 1) ctx.drawImage(img.canvas, -sp.px * d, -sp.py * d);
        else ctx.drawImage(img.canvas, -sp.px * d, -sp.py * d, img.w * k, img.h * k);
        ctx.restore();
        stats.blits++;
      }
    }
  }

  // A lighthouse beam sweeping round: from the side it reads as a light cone
  // that lengthens, shortens and flips, with a flash as it faces the camera.
  function beamSprite(d) {
    if (beam && beamDensity === d) return beam;
    const L = Math.round(460 * d), H = Math.round(44 * d);
    const c = makeCanvas(L, H);
    if (!c) return null;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, 'rgba(255,236,190,.9)'); g.addColorStop(0.35, 'rgba(255,226,170,.35)'); g.addColorStop(1, 'rgba(255,220,160,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, H / 2 - 2 * d); x.lineTo(L, 0); x.lineTo(L, H); x.lineTo(0, H / 2 + 2 * d); x.closePath(); x.fill();
    if (beam) { beam.width = 0; beam.height = 0; }
    beam = c; beamDensity = d;
    return c;
  }

  function drawBeams(ctx, bus, e, on) {
    let calls = 0;
    const d = bus.density, cw = bus.canvasWidth;
    for (const a of e.anchors) {
      if (a.kind !== 'beam' || on < 0.1) continue;
      const img = beamSprite(d);
      if (!img) continue;
      const theta = bus.reduced ? Math.PI / 2 : bus.time * 0.9;
      const facing = Math.max(0, Math.sin(theta)), sweep = Math.cos(theta);
      let x = Math.round(a.u * d) - (((e.scroll % e.period) + e.period) % e.period);
      while (x + img.width > 0) x -= e.period;
      x += e.period;
      for (; x - img.width < cw; x += e.period) {
        const y = e.y + a.y * d;
        ctx.globalAlpha = clamp(on * e.alpha * 0.18);
        ctx.save(); ctx.translate(x, y); ctx.scale(sweep, 1);
        ctx.drawImage(img, 0, -img.height / 2);
        ctx.restore();
        // Lamp flash: the beam's bright root, drawn small around the lamp.
        ctx.globalAlpha = clamp(on * e.alpha * (0.25 + 0.6 * facing));
        const glowR = Math.round(18 * d);
        ctx.drawImage(img, 0, 0, Math.round(img.height / 2), img.height, x - glowR, y - glowR, glowR * 2, glowR * 2);
        calls += 2;
      }
    }
    return calls;
  }

  function bandPattern(ctx, band) {
    if (!band.pattern) band.pattern = ctx.createPattern(band.canvas, 'repeat-x');
    return band.pattern;
  }

  // Bands [i0, i1) of one region between device x0 and x1. A region whose art
  // is not ready (a seek, a slow network) borrows a neighbour's ground so the
  // seam never opens a hole; with no art at all the painters cover the ground.
  function drawBands(ctx, bus, regionIndex, i0, i1, alpha, x0, x1, t = null) {
    if (alpha <= 0.003 || x1 <= x0) return;
    let id = CHIKUN_REGIONS[regionIndex].id, ground = loader?.ground(id);
    if ((!ground || artLevel(id, bus.reduced) <= 0) && t && regionIndex !== t.cur && artLevel(CHIKUN_REGIONS[t.cur].id, bus.reduced) > 0) {
      for (const other of [t.cur, t.next, t.prev]) {
        const oid = CHIKUN_REGIONS[other].id, g = loader?.ground(oid);
        if (g && artLevel(oid, bus.reduced) > 0) { id = oid; ground = g; break; }
      }
    }
    if (!ground || artLevel(id, bus.reduced) <= 0) return;
    const d = bus.density, k = bus.reduced ? 0 : 1;
    ctx.globalAlpha = alpha * artLevel(id, bus.reduced);
    const drift = SCENERY_CATALOG.regions?.[id]?.ground?.drift;
    for (let i = i0; i < i1 && i < ground.bands.length; i++) {
      const b = ground.bands[i];
      const kk = Math.max(b.rate, 0.2) * k;
      // Sea bands also drift slowly with the tick clock (frozen under reduced motion).
      const scroll = (bus.distance * b.rate + bus.view.left - bus.shakeX * kk - (drift ? drift[i] * bus.time * b.rate : 0)) * d;
      const y = Math.round((b.y0 - BACKDROP_TOP + bus.shakeY * kk) * d), y2 = Math.round((b.y1 - BACKDROP_TOP + bus.shakeY * kk) * d);
      // After a rotation the old bands draw scaled until the re-prescale lands (never a hole).
      const s = Math.abs(ground.density - d) > 1e-3 ? d / ground.density : 1;
      stats.bandFills += fillPeriodicBand(ctx, bandPattern(ctx, b), b.w, scroll, y, y2 - y, Math.max(0, Math.floor(x0)), Math.min(bus.canvasWidth, Math.ceil(x1)), s);
    }
    ctx.globalAlpha = 1;
  }

  function bandsFor(ctx, bus, t, i0, i1) {
    const edges = SCENERY_CATALOG.spec?.groundEdges ?? [];
    const cw = bus.canvasWidth, d = bus.density;
    for (let i = i0; i < i1; i++) {
      const rate = rateAtY((edges[i] + edges[i + 1]) / 2);
      if (t.seams && rate >= TRANSITION.seamRate) {
        // Spatial seams: previous | current | next region along x.
        const toDev = x => (x - bus.view.left + bus.shakeX * Math.max(rate, 0.2)) * d;
        const xp = Number.isFinite(t.Dprev) ? toDev(seamX(t.Dprev, bus.distance, rate)) : -Infinity;
        const xn = toDev(seamX(t.Dnext, bus.distance, rate));
        const a = clamp(xp, 0, cw), b = clamp(xn, 0, cw);
        if (a > 0) drawBands(ctx, bus, t.prev, i, i + 1, 1, 0, a, t);
        drawBands(ctx, bus, t.cur, i, i + 1, 1, a, b, t);
        if (b < cw) drawBands(ctx, bus, t.next, i, i + 1, 1, b, cw, t);
      } else {
        const m = t.mix.bands;
        if (m < 1) drawBands(ctx, bus, t.cur, i, i + 1, 1, 0, cw); // opaque: next fades in over it
        if (m > 0) drawBands(ctx, bus, t.next, i, i + 1, m, 0, cw);
      }
    }
  }

  function fog(ctx, bus, alpha, h) {
    if (alpha <= 0.002) return;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgba(bus.rig.fogColor, alpha);
    ctx.fillRect(0, 0, bus.canvasWidth, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  return {
    stats,
    emits() { return emitCount; },
    // Keep the right regions requested/resident for the transition state.
    schedule(bus, t) {
      if (!loader) return;
      const ids = CHIKUN_REGIONS.map(r => r.id);
      const seamPrevVisible = Number.isFinite(t.Dprev) && bus.distance - t.Dprev < 420 + (280 - bus.view.left);
      const keep = seamPrevVisible ? [ids[t.prev], ids[t.cur]] : [ids[t.cur], ids[t.next]];
      for (const id of keep) if (loader.has(id)) loader.request(id, bus.density);
      loader.retain(keep);
      for (let i = 0; i < CHIKUN_REGIONS.length; i++) if (loader.ready(ids[i]) && artLevel(ids[i], bus.reduced) >= 1) freePainters(i);
    },
    draw(ctx, bus, t) {
      emitCount = 0;
      const h = ctx.canvas.height;
      const edges = SCENERY_CATALOG.spec?.groundEdges ?? [];
      const artCur = artLevel(CHIKUN_REGIONS[t.cur].id, bus.reduced), artNext = t.mix.far > 0 || t.mix.near > 0 ? artLevel(CHIKUN_REGIONS[t.next].id, bus.reduced) : 0;
      let band = 0;
      const nb = Math.max(0, edges.length - 1);
      for (const name of STRIP_LAYERS) {
        const g = layerGeometry(CHIKUN_REGIONS[t.cur].id, name);
        const baseline = HORIZON_Y + (RUN_Y - HORIZON_Y) * g.rate;
        let upto = band;
        while (upto < nb && edges[upto] < baseline) upto++;
        if (upto > band) { bandsFor(ctx, bus, t, band, upto); band = upto; }
        const m = t.mix[name];
        if (m < 1) drawStrip(ctx, bus, t.cur, name, 1 - m, artCur);
        if (m > 0) drawStrip(ctx, bus, t.next, name, m, artNext);
        fog(ctx, bus, bus.rig.fog[name], h);
      }
      if (band < nb) bandsFor(ctx, bus, t, band, nb);
    },
    // Lit windows and lamps, added onto the main canvas after the backdrop.
    drawEmissive(ctx, bus) {
      const on = bus.rig.lightsOn;
      if (on <= 0.01 || !loader) return 0;
      let calls = 0;
      const cw = bus.canvasWidth;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < emitCount; i++) {
        const e = emitQueue[i], em = loader.emit(e.region, e.layer);
        if (e.anchors) calls += drawBeams(ctx, bus, e, on);
        if (!em) continue;
        const fogLeft = e.layer === 'far' ? 1 - bus.rig.fog.far - bus.rig.fog.mid : e.layer === 'mid' ? 1 - bus.rig.fog.mid - bus.rig.fog.near * 0.5 : 1 - bus.rig.fog.near;
        ctx.globalAlpha = clamp(on * e.alpha * EMIT_GAIN[e.layer] * clamp(fogLeft, 0.2, 1) * (1 - 0.6 * (bus.transition?.veil ?? 0)));
        // Lights are kept at their 1x source size and scaled here (see art-loader).
        const d = bus.density;
        for (const c of em.chunks) {
          const cx = Math.round(c[0] * d), cy = e.y + Math.round(c[1] * d), dw = Math.round(c[2] * d), dh = Math.round(c[3] * d);
          let x = cx - (((e.scroll % e.period) + e.period) % e.period);
          while (x + dw > 0) x -= e.period;
          x += e.period;
          for (; x < cw; x += e.period) { ctx.drawImage(em.canvas, c[4], c[5], c[6], c[7], x, cy, dw, dh); calls++; }
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      return calls;
    },
    dispose() {
      for (const p of painterCache.values()) { p.canvas.width = 0; p.canvas.height = 0; }
      painterCache.clear(); painterOrder.length = 0; readyAt.clear();
    },
  };
}
