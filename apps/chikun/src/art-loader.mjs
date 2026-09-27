// Lazy, per-region loader for the Blender scenery (scenery-catalog.mjs).
//
// * Tier: t2 (2x art) when the canvas density is above 1.3, otherwise t1.
// * Images load through Image + decode() so the service worker's cache-first
//   image rule and the HTTP cache apply; two at a time, 12 s timeout, no retry
//   storm. A failed sprite or light only loses that piece. The backdrop
//   switches to art as a unit, so a failed far, mid or near strip or ground
//   keeps the whole region on the code-drawn painters (a failed cut face only
//   sends the running line back to the code strip).
// * Each decoded image is prescaled ONCE into a canvas at the exact device size
//   (pump() spends a small time budget per frame on it), then the source image
//   is dropped. Drawing is always 1:1.
// * A density change (rotation, resize, zoom, a mobile address bar) waits
//   until the density has been stable for `settleMs`, then re-prescales asset
//   by asset from the HTTP-cached sources, or switches tier. There is at most
//   one pending job per asset, and a job is prescaled at the latest density
//   when it lands. Until each replacement lands, the old canvas keeps drawing
//   (scaled), so a rotation never drops the region back to the painters.
// * At most `maxResident` regions stay resident; evicting zeroes the canvases.
import { SCENERY_CATALOG } from './scenery-catalog.mjs';

export const T2_DENSITY = 1.3;
export const SETTLE_MS = 200;
export const tierFor = density => density > T2_DENSITY ? 't2' : 't1';
const TIER_SCALE = { t1: 1, t2: 2 };
export const CORE_LAYERS = Object.freeze(['far', 'mid', 'near']);
const same = (a, b) => Math.abs(a - b) <= 1e-3;

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

export function createArtLoader({ catalog = SCENERY_CATALOG, loadImage = defaultLoadImage, makeCanvas = defaultMakeCanvas, maxResident = 2, concurrency = 2, timeoutMs = 12000, clock = now, settleMs = SETTLE_MS } = {}) {
  const regions = new Map();   // id -> entry
  const queue = [];            // jobs waiting for a download slot
  let active = 0;
  const stats = { requested: 0, loaded: 0, failed: 0, prescaled: 0, evicted: 0, retargets: 0, residentBytes: 0, failures: [] };

  function describe(id) {
    return catalog?.regions?.[id] ?? null;
  }

  // Every downloadable piece of a region at a tier; the far layer and the
  // lights ship t1 only, so they fall back to it.
  function assetsOf(desc, tier) {
    const pick = tiers => tiers[tier] ? tier : 't1';
    const out = [];
    for (const [name, layer] of Object.entries(desc.layers)) {
      const lt = pick(layer.tiers);
      out.push({ key: name, src: layer.tiers[lt].src, tier: lt, logical: [layer.width, layer.height], scale: TIER_SCALE[lt], kind: 'strip' });
      for (const sp of layer.sprites ?? []) {
        const st = pick(sp.tiers);
        out.push({ key: name + ':sprite:' + sp.id, src: sp.tiers[st].src, tier: st, logical: [sp.w, sp.h], scale: TIER_SCALE[st], kind: 'strip' });
      }
      if (layer.emit) {
        const et = pick(layer.emit.tiers), t = layer.emit.tiers[et];
        out.push({ key: name + '-emit', src: t.src, tier: et, kind: 'emit', layer: name, scale: TIER_SCALE[et], w: t.w, h: t.h });
      }
    }
    if (desc.ground) {
      const gt = pick(desc.ground.tiers);
      out.push({ key: 'ground', src: desc.ground.tiers[gt].src, tier: gt, kind: 'ground', scale: TIER_SCALE[gt] });
    }
    return out;
  }

  // A job is current while it is the one pending job for its asset; a job
  // superseded by a tier switch (or by its region's eviction) is dropped when it lands.
  const current = job => !job.entry.evicted && job.entry.pending.get(job.key) === job;
  const release = img => { try { if (img) img.src = ''; } catch {} };

  function enqueue(entry, asset) {
    const job = { entry, key: asset.key, src: asset.src, asset, img: null };
    entry.pending.set(asset.key, job);
    entry.failed.delete(asset.key);
    queue.push(job);
  }

  function pumpDownloads() {
    while (active < concurrency && queue.length) {
      const job = queue.shift();
      if (!current(job)) continue;
      active++;
      stats.requested++;
      loadImage(catalog.base + job.src, timeoutMs).then(img => {
        active--;
        if (current(job)) { job.img = img; job.entry.tasks.push(job); stats.loaded++; }
        else release(img);
        pumpDownloads();
      }, error => {
        active--;
        if (current(job)) {
          job.entry.pending.delete(job.key);
          job.entry.failed.add(job.key);
          stats.failed++;
          if (stats.failures.length < 32) stats.failures.push(`${job.entry.id}/${job.key}: ${error?.message ?? 'error'}`);
        }
        pumpDownloads();
      });
    }
  }

  // Bring a resident region to its settled density: switch tier if needed and
  // queue every asset whose canvas does not match, unless its job is pending.
  function retarget(entry) {
    const tier = tierFor(entry.want);
    if (tier !== entry.tier) { entry.tier = tier; entry.assets = assetsOf(entry.desc, tier); }
    entry.density = entry.want;
    stats.retargets++;
    for (const a of entry.assets) {
      const job = entry.pending.get(a.key);
      if (job && job.src === a.src) continue;
      const p = entry.prepared[a.key];
      // Lights stay at their 1x source size whatever the density.
      if (!job && p && p.src === a.src && (a.kind === 'emit' || same(p.density, entry.density))) continue;
      enqueue(entry, a);
    }
    pumpDownloads();
  }

  function request(id, density) {
    const desc = describe(id);
    if (!desc) return null;
    let entry = regions.get(id);
    if (!entry) {
      const tier = tierFor(density), at = clock();
      entry = { id, desc, tier, density, want: density, wantAt: at, pending: new Map(), tasks: [], failed: new Set(), prepared: {}, evicted: false, requestedAt: at, assets: assetsOf(desc, tier) };
      regions.set(id, entry);
      for (const a of entry.assets) enqueue(entry, a);
      pumpDownloads();
      return entry;
    }
    if (!same(density, entry.want)) { entry.want = density; entry.wantAt = clock(); }
    if ((!same(entry.want, entry.density) || tierFor(entry.want) !== entry.tier) && clock() - entry.wantAt >= settleMs) retarget(entry);
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
    const g = entry.desc.ground, t = g.tiers[asset.tier], s = asset.scale, pad = g.pad;
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

  // Prescale landed images within a time budget (ms), each at its region's
  // latest density. Returns tasks done.
  function pump(budgetMs = 2) {
    const start = clock();
    let done = 0;
    for (const entry of regions.values()) {
      while (entry.tasks.length) {
        if (done > 0 && clock() - start > budgetMs) return done;
        const job = entry.tasks.shift();
        if (!current(job)) { release(job.img); job.img = null; continue; }
        entry.pending.delete(job.key);
        const asset = job.asset, img = job.img;
        let prepared = null;
        try {
          prepared = asset.kind === 'strip' ? prescaleStrip(entry, asset, img, entry.want)
            : asset.kind === 'emit' ? prescaleEmit(entry, asset, img, entry.want)
              : prescaleGround(entry, asset, img, entry.want);
        } catch { prepared = null; }
        if (prepared) { prepared.src = job.src; freePrepared(entry.prepared[job.key]); entry.prepared[job.key] = prepared; stats.prescaled++; }
        else { entry.failed.add(job.key); stats.failed++; }
        release(img); job.img = null;
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
    for (const job of entry.tasks) { release(job.img); job.img = null; }
    entry.tasks.length = 0;
    entry.pending.clear();
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
    sprite(id, layer, spriteId) { return regions.get(id)?.prepared[layer + ':sprite:' + spriteId] ?? null; },
    emit(id, name) { return regions.get(id)?.prepared[name + '-emit'] ?? null; },
    ground(id) { return regions.get(id)?.prepared.ground ?? null; },
    failed(id, key) { return regions.get(id)?.failed.has(key) ?? false; },
    // The region's backdrop is art-ready once the three strips and the ground are prescaled.
    ready(id) { const e = regions.get(id); return Boolean(e && CORE_LAYERS.every(k => e.prepared[k]) && (!e.desc.ground || e.prepared.ground)); },
    // True while the region is not yet (re)prescaled for `density`.
    stale(id, density) { const e = regions.get(id); return Boolean(e && (!same(e.density, density) || e.pending.size > 0)); },
    resident() { return [...regions.keys()]; },
    entryFor,
    stats() { return { ...stats, resident: [...regions.keys()], residentBytes: residentBytes(), queued: queue.filter(current).length, active }; },
    dispose() { for (const id of [...regions.keys()]) evict(id); queue.length = 0; },
  };
}
