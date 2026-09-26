// Lazy, per-region loader for the Blender scenery (scenery-catalog.mjs).
//
// * Tier: t2 (2x art) when the canvas density is above 1.3, otherwise t1.
// * Images load through Image + decode() so the service worker's cache-first
//   image rule and the HTTP cache apply; two at a time, 12 s timeout, no retry
//   storm. A failure affects only that asset: its layer keeps the code-drawn
//   painter.
// * Each decoded image is prescaled ONCE into a canvas at the exact device size
//   (pump() spends a small time budget per frame on it), then the source image
//   is dropped. Drawing is always 1:1.
// * At most `maxResident` regions stay resident; evicting zeroes the canvases.
import { SCENERY_CATALOG } from './scenery-catalog.mjs';

export const T2_DENSITY = 1.3;
export const tierFor = density => density > T2_DENSITY ? 't2' : 't1';
const TIER_SCALE = { t1: 1, t2: 2 };
export const CORE_LAYERS = Object.freeze(['far', 'mid', 'near']);

function defaultLoadImage(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') { reject(new Error('no Image')); return; }
    const img = new Image();
    img.decoding = 'async';
    try { img.fetchPriority = 'low'; } catch {}
    const timer = setTimeout(() => { img.src = ''; reject(new Error('timeout')); }, timeoutMs);
    img.onerror = () => { clearTimeout(timer); reject(new Error('error')); };
    img.src = url;
    const done = () => { clearTimeout(timer); resolve(img); };
    if (typeof img.decode === 'function') img.decode().then(done, () => { img.onload = done; if (img.complete && img.naturalWidth) done(); });
    else img.onload = done;
  });
}

function defaultMakeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createArtLoader({ catalog = SCENERY_CATALOG, loadImage = defaultLoadImage, makeCanvas = defaultMakeCanvas, maxResident = 2, concurrency = 2, timeoutMs = 12000, clock = now } = {}) {
  const regions = new Map();   // id -> entry
  const queue = [];            // pending downloads: {entry, key, url}
  let active = 0;
  const stats = { requested: 0, loaded: 0, failed: 0, prescaled: 0, evicted: 0, residentBytes: 0, failures: [] };

  function describe(id) {
    return catalog?.regions?.[id] ?? null;
  }

  function assetsOf(desc, tier) {
    const out = [];
    for (const [name, layer] of Object.entries(desc.layers)) {
      const t = layer.tiers[tier] ?? layer.tiers.t1;
      out.push({ key: name, src: t.src, logical: [layer.width, layer.height], scale: TIER_SCALE[layer.tiers[tier] ? tier : 't1'], kind: 'strip' });
      if (layer.emit) {
        const et = layer.emit.tiers[tier] ?? layer.emit.tiers.t1;
        out.push({ key: name + '-emit', src: et.src, kind: 'emit', layer: name, scale: TIER_SCALE[layer.emit.tiers[tier] ? tier : 't1'], w: et.w, h: et.h });
      }
    }
    if (desc.ground) out.push({ key: 'ground', src: desc.ground.tiers[tier].src, kind: 'ground', scale: TIER_SCALE[tier] });
    return out;
  }

  function pumpDownloads() {
    while (active < concurrency && queue.length) {
      const job = queue.shift();
      if (job.entry.evicted) continue;
      active++;
      stats.requested++;
      loadImage(catalog.base + job.src, timeoutMs).then(img => {
        active--;
        if (job.entry.evicted) { pumpDownloads(); return; }
        job.entry.images.set(job.key, img);
        job.entry.tasks.push(job.key);
        stats.loaded++;
        pumpDownloads();
      }, error => {
        active--;
        job.entry.failed.add(job.key);
        stats.failed++;
        if (stats.failures.length < 32) stats.failures.push(`${job.entry.id}/${job.key}: ${error?.message ?? 'error'}`);
        pumpDownloads();
      });
    }
  }

  function request(id, density) {
    const desc = describe(id);
    if (!desc) return null;
    const tier = tierFor(density);
    let entry = regions.get(id);
    if (entry && entry.tier === tier) {
      if (Math.abs(entry.density - density) > 1e-3) {
        // Rotation or zoom: re-prescale from the (HTTP-cached) sources. The old
        // canvases keep drawing, scaled, until each replacement is ready.
        entry.density = density;
        for (const a of entry.assets) queue.push({ entry, key: a.key, src: a.src });
        pumpDownloads();
      }
      return entry;
    }
    if (entry) evict(id);
    entry = { id, desc, tier, density, images: new Map(), tasks: [], failed: new Set(), prepared: {}, evicted: false, requestedAt: clock(), assets: assetsOf(desc, tier) };
    regions.set(id, entry);
    for (const a of entry.assets) queue.push({ entry, key: a.key, src: a.src });
    pumpDownloads();
    return entry;
  }

  function sizeOf(canvas) { return canvas ? canvas.width * canvas.height * 4 : 0; }

  function prescaleStrip(entry, asset, img, d) {
    const [W, H] = asset.logical;
    const w = Math.round(W * d), h = Math.round(H * d);
    const canvas = makeCanvas(w, h);
    if (!canvas) return null;
    const cx = canvas.getContext('2d');
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, w, h);
    return { canvas, w, h, period: w, density: d };
  }

  // Lights stay at their 1x source size: they are small additive glows drawn
  // scaled by the density (a soft upscale reads as bloom), which keeps their
  // memory independent of the device density.
  function prescaleEmit(entry, asset, img, d) {
    const layer = entry.desc.layers[asset.layer];
    const s = asset.scale;
    const canvas = makeCanvas(img.width, img.height);
    if (!canvas) return null;
    canvas.getContext('2d').drawImage(img, 0, 0);
    // [u, y, w, h, ax, ay] logical -> source rects in atlas px.
    const chunks = layer.emit.chunks.map(([u, y, cw, ch, ax, ay]) => [u, y, cw, ch, ax * s, ay * s, cw * s, ch * s]);
    return { canvas, chunks, density: d, sourceScale: s };
  }

  function prescaleGround(entry, asset, img, d) {
    const g = entry.desc.ground, t = g.tiers[entry.tier], s = asset.scale, pad = g.pad;
    const bands = [];
    let bytes = 0;
    for (let i = 0; i < g.bands.length; i++) {
      const [y0, y1, rate] = g.bands[i], [ax, ay, aw, ah] = t.rects[i];
      const w = Math.max(1, Math.round((aw / s) * d));
      const h = Math.ceil((y1 - y0) * d) + 1;
      const canvas = makeCanvas(w, h);
      if (!canvas) return null;
      const cx = canvas.getContext('2d');
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      const k = w / aw, kv = h / ah;
      // The atlas carries wrap padding, so resampling at the tile edges reads
      // the periodic continuation and the band repeats without a seam.
      cx.drawImage(img, ax - pad, ay, aw + 2 * pad, ah, -pad * k, 0, (aw + 2 * pad) * k, ah * kv);
      bands.push({ y0, y1, rate, canvas, w, h, pattern: null });
      bytes += w * h * 4;
    }
    return { bands, density: d, bytes };
  }

  // Prescale decoded images within a time budget (ms). Returns tasks done.
  function pump(budgetMs = 2) {
    const start = clock();
    let done = 0;
    for (const entry of regions.values()) {
      while (entry.tasks.length) {
        if (done > 0 && clock() - start > budgetMs) return done;
        const key = entry.tasks.shift();
        const img = entry.images.get(key);
        const asset = entry.assets.find(a => a.key === key);
        entry.images.delete(key);
        if (!img || !asset) continue;
        let prepared = null;
        try {
          prepared = asset.kind === 'strip' ? prescaleStrip(entry, asset, img, entry.density)
            : asset.kind === 'emit' ? prescaleEmit(entry, asset, img, entry.density)
              : prescaleGround(entry, asset, img, entry.density);
        } catch { prepared = null; }
        if (prepared) { freePrepared(entry.prepared[key]); entry.prepared[key] = prepared; stats.prescaled++; }
        else { entry.failed.add(key); stats.failed++; }
        try { img.src = ''; } catch {}
        done++;
      }
    }
    return done;
  }

  function freePrepared(p) {
    if (!p) return;
    const zero = c => { if (c) { c.width = 0; c.height = 0; } };
    zero(p.canvas);
    if (p.bands) for (const b of p.bands) zero(b.canvas);
  }

  function evict(id) {
    const entry = regions.get(id);
    if (!entry) return;
    entry.evicted = true;
    for (const p of Object.values(entry.prepared)) freePrepared(p);
    entry.prepared = {};
    entry.images.clear();
    regions.delete(id);
    stats.evicted++;
  }

  // Keep only `ids` (plus nothing else) resident, newest last.
  function retain(ids) {
    for (const id of [...regions.keys()]) if (!ids.includes(id)) evict(id);
    while (regions.size > maxResident) evict(regions.keys().next().value);
  }

  function entryFor(id, density) {
    const entry = regions.get(id);
    if (!entry) return null;
    if (density && tierFor(density) !== entry.tier) return null;
    return entry;
  }

  function residentBytes() {
    let bytes = 0;
    for (const entry of regions.values()) for (const p of Object.values(entry.prepared)) bytes += p.bytes ?? sizeOf(p.canvas);
    return bytes;
  }

  return {
    request, pump, evict, retain,
    has: id => Boolean(describe(id)),
    tier: tierFor,
    layer(id, name) { return regions.get(id)?.prepared[name] ?? null; },
    emit(id, name) { return regions.get(id)?.prepared[name + '-emit'] ?? null; },
    ground(id) { return regions.get(id)?.prepared.ground ?? null; },
    failed(id, key) { return regions.get(id)?.failed.has(key) ?? false; },
    // The region's backdrop is art-ready once the three strips and the ground are prescaled.
    ready(id) { const e = regions.get(id); return Boolean(e && CORE_LAYERS.every(k => e.prepared[k]) && (!e.desc.ground || e.prepared.ground)); },
    stale(id, density) { const e = regions.get(id); return Boolean(e && Math.abs(e.density - density) > 1e-3); },
    resident() { return [...regions.keys()]; },
    entryFor,
    stats() { return { ...stats, resident: [...regions.keys()], residentBytes: residentBytes(), queued: queue.length, active }; },
    dispose() { for (const id of [...regions.keys()]) evict(id); queue.length = 0; },
  };
}
