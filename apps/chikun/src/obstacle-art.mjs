// Rendered obstacle art (slice 2 of the Chikun visual upgrade).
//
// Every obstacle is drawn from Blender sprites that were built against its
// collision shapes (scripts/chikun-blender/obstacles, obstacle-templates.json):
// the collision is the truth and the art is positioned on the same anchors
// (the running line, the obstacle's y, a rect's top or bottom edge, a tree's
// top). Nothing here reads or changes gameplay: layoutObstacleArt() is a pure
// function of the frozen obstacle object and the tick.
//
// * Sprites ship per kit: `common` (props, trees, creatures, drone, plane,
//   coin, storm) and one kit per region (buildings, forest wall, canopies,
//   pipes, pits, waterfalls). Kits load through Image + decode() (cache-first
//   in the service worker), t2 art above density 1.3, and are prescaled once
//   per density into integer device slots, so every draw is a 1:1 blit.
// * Region kits follow the scenery clock: at most two are resident (the
//   previous one briefly after a switch, else the current and the next),
//   nothing further ahead.
// * Missing or failed sprites return false and the caller keeps the
//   code-drawn fallback for that obstacle.
// * Lighting: building facades fill their collision rects, so they take the
//   time-of-day grade as fills over those rects (below the roof line); every
//   other sprite (roofs, props, trees, the forest wall, canopies, storms,
//   creatures) uses a graded copy rebuilt when the quantised grade changes (at
//   most two per frame, LRU-capped), so fringes and translucent edges are
//   graded too and nothing behind them is. Lit windows, lamps and LEDs are
//   added with 'lighter' after the grade.
import { OBSTACLE_CATALOG } from './obstacle-catalog.mjs';
import { CHIKUN_REGIONS, regionForObstacle, courseRegionState } from '../../portal/src/chikun-course-regions.mjs';
import { sceneBus } from './scene-bus.mjs';
import { rgba } from './light-rig.mjs';

export const T2_DENSITY = 1.3;
export const SETTLE_MS = 200;
export const GAMEPLAY_GRADE = 0.72;
export const GROUND_Y = 690;
const TIER_SCALE = { t1: 1, t2: 2 };
const DEVICE_GAP = 2;
const tierFor = density => density > T2_DENSITY ? 't2' : 't1';
const same = (a, b) => Math.abs(a - b) <= 1e-3;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const hash = n => { let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };
const TAU = Math.PI * 2;

// Sprite per kind and region (the obstacle's own region, so an obstacle never
// changes look when the scenery switches around it).
const R = (map, fallback) => Object.freeze(Object.fromEntries(CHIKUN_REGIONS.map(r => [r.id, map[r.id] ?? fallback])));
export const OBSTACLE_VARIANTS = Object.freeze({
  crate: R({ city: 'crate-steel', industrial: 'crate-steel', suburbs: 'crate-boxes' }, 'crate-wood'),
  hurdle: R({ farmland: 'hurdle-hay', forest: 'hurdle-hay', town: 'hurdle-barrels', city: 'hurdle-drums', industrial: 'hurdle-jersey', suburbs: 'hurdle-hedge', coast: 'hurdle-barrels' }, 'hurdle-hay'),
  log: R({ forest: 'log-mossy', city: 'log-timber', industrial: 'log-timber', coast: 'log-drift' }, 'log-oak'),
  rock: R({ coast: 'rock-coastal' }, 'rock-mossy'),
  thorn: R({}, 'thorn-bramble'),
  pit: R({ forest: 'pit-loam', industrial: 'pit-concrete', coast: 'pit-tidal' }, 'pit-soil'),
  waterfall: R({ coast: 'waterfall-basalt' }, 'waterfall-mossy'),
  canopy: R({ city: 'canopy-scaffold', industrial: 'canopy-rack' }, 'canopy-forest'),
  pipe: R({ city: 'pipe-green' }, 'pipe-rust'),
});
export const BUILDING_STYLES = Object.freeze({
  town: Object.freeze(['town-timber', 'town-terracotta', 'town-stone']),
  city: Object.freeze(['city-glass', 'city-brick', 'city-concrete']),
  suburb: Object.freeze(['suburb-mint', 'suburb-butter', 'suburb-blush']),
});
const WATERFALL_SHEET = Object.freeze({ 'waterfall-mossy': 'waterfall-sheet-mossy', 'waterfall-basalt': 'waterfall-sheet-basalt' });
const RECT_TINT = new Set(['town']);
const CAP_ROWS = 46;   // a building cap covers the top 46 px of its rect
const GROUNDED_SHADOW = new Set(['rock', 'log', 'thorn', 'hurdle', 'crate', 'shiba', 'tree', 'pipe']);

// Sprite name -> kit id.
const SPRITE_KIT = new Map();
for (const [kit, k] of Object.entries(OBSTACLE_CATALOG.kits ?? {})) for (const name of Object.keys(k.sprites)) SPRITE_KIT.set(name, kit);
export const spriteKit = name => SPRITE_KIT.get(name) ?? null;
export const spriteDesc = name => { const kit = SPRITE_KIT.get(name); return kit ? OBSTACLE_CATALOG.kits[kit].sprites[name] : null; };
export const obstacleRegion = o => regionForObstacle(o?.index ?? 0).region.id;

// ---------------------------------------------------------------- layout (pure)

// One draw: sprite `name`, animation `frame`, the sprite's top-left at logical
// (x, y), visible rows [sy0, sy1) and columns [sx0, sx1) of the sprite.
function op(out, name, frame, ax, ay, rowFrom = -Infinity, rowTo = Infinity, sx0 = 0, sx1 = Infinity) {
  const d = spriteDesc(name);
  if (!d) { out.missing = true; return; }
  const x = ax + d.x, y = ay + d.y;
  const sy0 = Math.max(0, Math.min(d.h, rowFrom - y)), sy1 = Math.max(0, Math.min(d.h, rowTo - y));
  if (sy1 <= sy0) return;
  out.push({ name, frame: frame % d.frames, x, y, sy0, sy1, sx0: Math.max(0, sx0), sx1: Math.min(d.w, sx1) });
}

// Frames at 12 fps (5 ticks) or 24 fps; reduced motion parks every animation on frame 0.
const frameAt = (tick, ticksPerFrame, phase, reduced) => reduced ? 0 : Math.floor(Math.max(0, tick) / ticksPerFrame + phase);

export function layoutObstacleArt(o, { tick = 0, reduced = false } = {}, out = []) {
  out.length = 0; out.missing = false; out.kind = o.kind;
  const region = obstacleRegion(o);
  const variants = OBSTACLE_VARIANTS[o.kind];
  if (o.family === 'ground' && variants) {
    if (o.kind === 'pipe') {
      const s = o.shapes[0], name = variants[region];
      op(out, name, 0, o.x, GROUND_Y, s.y + 22);
      op(out, name + '-cap', 0, o.x, s.y);
    } else op(out, variants[region], 0, o.x, GROUND_Y);
  } else if (o.kind === 'shiba') {
    op(out, 'shiba', frameAt(tick, 5, (o.index * 5) % 12, reduced), o.x, GROUND_Y);
  } else if (o.kind === 'tree') {
    const species = ['willow', 'cherry', 'maple', 'oak'].includes(o.variant) ? o.variant : 'oak';
    const top = GROUND_Y - o.height;
    op(out, 'trunk-' + species, 0, o.x, GROUND_Y, top + 96);
    op(out, 'crown-' + species, 0, o.x, top);
  } else if (o.family === 'forest') {
    for (let i = 0; i < o.shapes.length; i++) {
      const s = o.shapes[i];
      op(out, (hash(o.index) + i) % 2 ? 'forest-column-b' : 'forest-column-a', 0, s.x, s.y, -Infinity, GROUND_Y + 4);
    }
    for (const s of o.shapes) op(out, 'forest-base', 0, s.x, GROUND_Y);
  } else if (o.family === 'town') {
    const styles = BUILDING_STYLES[o.variant] ?? BUILDING_STYLES.town;
    const base = hash(o.index);
    for (let i = 0; i < o.shapes.length; i++) {
      const s = o.shapes[i], style = styles[(base + i) % styles.length];
      op(out, 'facade-' + style, 0, s.x, GROUND_Y, s.y + 30);
      op(out, 'cap-' + style, 0, s.x, s.y);
    }
  } else if (o.kind === 'canopy' || o.kind === 'storm') {
    op(out, o.kind === 'storm' ? 'storm' : OBSTACLE_VARIANTS.canopy[region], 0, o.x, o.height, 0);
  } else if (o.kind === 'pit' || o.kind === 'waterfall') {
    const name = OBSTACLE_VARIANTS[o.kind][region];
    op(out, name, 0, o.x, GROUND_Y);
    if (o.kind === 'waterfall') {
      // the falling water: a 64 px periodic sheet scrolled down over the curtain
      const sheet = WATERFALL_SHEET[name], d = spriteDesc(sheet);
      if (d) {
        const scroll = reduced ? 0 : (Math.max(0, tick) * 1.5) % 64;
        for (let y = 536 - 64 + scroll; y < GROUND_Y + 8; y += 64) op(out, sheet, 0, o.x + 158 - d.x - 18, y - d.y, 538, GROUND_Y + 8, 18, 222);
      }
    }
  } else if (o.family === 'sky') {
    if (o.kind === 'drone' || o.kind === 'plane') op(out, o.kind, frameAt(tick, 2.5, o.index, reduced), o.x, o.y);
    else if (['hawk', 'eagle', 'pelican'].includes(o.kind)) op(out, 'bird-' + o.kind, frameAt(tick, 5, (o.index * 3) % 8, reduced), o.x, o.y);
    else out.missing = true;
  } else out.missing = true;
  return out;
}

// The rects that receive the rect grade: each facade's collision rect below
// its cap (the cap itself is a graded copy), down to the facade's foot.
export function tintRects(o, out = []) {
  out.length = 0;
  if (!RECT_TINT.has(o.kind) && !RECT_TINT.has(o.family)) return out;
  for (const s of o.shapes) if (s.type === 'rect') out.push([s.x, s.y + CAP_ROWS, s.width, GROUND_Y + 8 - (s.y + CAP_ROWS)]);
  return out;
}

// ---------------------------------------------------------------- loader

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
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

export function createObstacleArt({ catalog = OBSTACLE_CATALOG, loadImage = defaultLoadImage, makeCanvas = defaultMakeCanvas, clock = now, concurrency = 2, timeoutMs = 12000, settleMs = SETTLE_MS, gradedCapPx = 2_500_000 } = {}) {
  const kits = new Map();       // kit id -> entry
  const queue = [];
  let active = 0;
  const stats = { requested: 0, loaded: 0, failed: 0, prescaled: 0, evicted: 0, regraded: 0, failures: [] };
  const graded = new Map();     // prepared -> { canvas, key, used, px }
  let gradedPx = 0, regradeBudget = 2, frameNo = 0;

  const kitDesc = id => catalog?.kits?.[id] ?? null;
  function assetsOf(desc, tier) {
    const out = [];
    for (const [name, sp] of Object.entries(desc.sprites)) {
      const t = sp.tiers[tier] ? tier : 't1';
      out.push({ key: name, name, src: sp.tiers[t].src, scale: TIER_SCALE[t], kind: 'sprite', sp });
      if (sp.emit) out.push({ key: name + ':emit', name, src: sp.emit.src, scale: 1, kind: 'emit', sp });
    }
    return out;
  }
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
      active++; stats.requested++;
      loadImage(catalog.base + job.src, timeoutMs).then(img => {
        active--;
        if (current(job)) { job.img = img; job.entry.tasks.push(job); stats.loaded++; } else release(img);
        pumpDownloads();
      }, error => {
        active--;
        if (current(job)) {
          job.entry.pending.delete(job.key); job.entry.failed.add(job.key); stats.failed++;
          if (stats.failures.length < 32) stats.failures.push(`${job.entry.id}/${job.key}: ${error?.message ?? 'error'}`);
        }
        pumpDownloads();
      });
    }
  }
  function retarget(entry) {
    const tier = tierFor(entry.want);
    if (tier !== entry.tier) { entry.tier = tier; entry.assets = assetsOf(entry.desc, tier); }
    entry.density = entry.want;
    for (const a of entry.assets) {
      const job = entry.pending.get(a.key);
      if (job && job.src === a.src) continue;
      const p = entry.prepared[a.key];
      if (!job && p && p.src === a.src && (a.kind === 'emit' || same(p.density, entry.density))) continue;
      enqueue(entry, a);
    }
    pumpDownloads();
  }
  function request(id, density) {
    const desc = kitDesc(id);
    if (!desc) return null;
    let entry = kits.get(id);
    if (!entry) {
      const at = clock(), tier = tierFor(density);
      entry = { id, desc, tier, density, want: density, wantAt: at, pending: new Map(), tasks: [], failed: new Set(), prepared: {}, evicted: false, assets: assetsOf(desc, tier) };
      kits.set(id, entry);
      for (const a of entry.assets) enqueue(entry, a);
      pumpDownloads();
      return entry;
    }
    if (!same(density, entry.want)) { entry.want = density; entry.wantAt = clock(); }
    if ((!same(entry.want, entry.density) || tierFor(entry.want) !== entry.tier) && clock() - entry.wantAt >= settleMs) retarget(entry);
    return entry;
  }

  // Frames go into integer device slots: slot = round(w * d), stride = slot + 2.
  function prescaleSprite(asset, img, d, k = 1) {
    const sp = asset.sp, s = asset.scale, dd = d * k;
    const slot = Math.max(1, Math.round(sp.w * dd)), dh = Math.max(1, Math.round(sp.h * dd)), stride = slot + DEVICE_GAP;
    const canvas = makeCanvas(stride * sp.frames - DEVICE_GAP, dh);
    if (!canvas) return null;
    const cx = canvas.getContext('2d');
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    for (let i = 0; i < sp.frames; i++) cx.drawImage(img, i * (sp.w + sp.gap) * s, 0, sp.w * s, sp.h * s, i * stride, 0, slot, dh);
    return { canvas, slot, stride, dh, density: d, k, w: sp.w, h: sp.h, bytes: canvas.width * canvas.height * 4 };
  }
  // Lights stay at their 1x source size and are drawn scaled with 'lighter'.
  function prescaleEmit(asset, img) {
    const canvas = makeCanvas(img.width, img.height);
    if (!canvas) return null;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return { canvas, emit: true, w: asset.sp.w, h: asset.sp.h, gap: asset.sp.gap, density: 1, bytes: canvas.width * canvas.height * 4 };
  }
  function freePrepared(p) { if (p?.canvas) { dropGraded(p); p.canvas.width = 0; p.canvas.height = 0; } }

  function pump(budgetMs = 2) {
    const start = clock();
    let done = 0;
    for (const entry of kits.values()) {
      while (entry.tasks.length) {
        if (done > 0 && clock() - start > budgetMs) return done;
        const job = entry.tasks.shift();
        if (!current(job)) { release(job.img); job.img = null; continue; }
        entry.pending.delete(job.key);
        const a = job.asset;
        let prepared = null, extra = null;
        try {
          if (a.kind === 'emit') prepared = prescaleEmit(a, job.img);
          else {
            prepared = prescaleSprite(a, job.img, entry.want);
            // ground coins (radius 17) get their own prescale of the radius-19 coin
            if (a.name === 'coin') extra = prescaleSprite(a, job.img, entry.want, 17 / 19);
          }
        } catch { prepared = null; }
        if (prepared) {
          prepared.src = job.src;
          freePrepared(entry.prepared[job.key]); entry.prepared[job.key] = prepared; stats.prescaled++;
          if (extra) { extra.src = job.src; freePrepared(entry.prepared['coin@17']); entry.prepared['coin@17'] = extra; }
        } else { entry.failed.add(job.key); stats.failed++; }
        release(job.img); job.img = null; done++;
      }
    }
    return done;
  }
  function evict(id) {
    const entry = kits.get(id);
    if (!entry) return;
    entry.evicted = true;
    for (const p of Object.values(entry.prepared)) freePrepared(p);
    entry.prepared = {};
    for (const job of entry.tasks) { release(job.img); job.img = null; }
    entry.tasks.length = 0; entry.pending.clear();
    kits.delete(id); stats.evicted++;
  }
  // `common` always stays; region kits other than `ids` are evicted.
  function retain(ids) { for (const id of [...kits.keys()]) if (id !== 'common' && !ids.includes(id)) evict(id); }

  function prepared(name) {
    const kit = SPRITE_KIT.get(name.replace(/(:emit|@17)$/, ''));
    return kit ? kits.get(kit)?.prepared[name] ?? null : null;
  }

  // Graded copies (sprite obstacles). The grade is quantised so a copy is
  // rebuilt only every few seconds of the day clock, at most two per frame.
  function gradeKey(g, strength) {
    const w = Math.round(g.w * strength * 40), a = Math.round(g.a * strength * 40);
    if (w === 0 && a === 0) return 0;
    const q = c => (c[0] >> 4) * 256 + (c[1] >> 4) * 16 + (c[2] >> 4);
    return 1 + w + 41 * (a + 41 * (q(g.W) + 4096 * q(g.D)));
  }
  function dropGraded(p) { const g = graded.get(p); if (g) { gradedPx -= g.px; g.canvas.width = 0; g.canvas.height = 0; graded.delete(p); } }
  function gradedCanvas(p, grade, strength = GAMEPLAY_GRADE) {
    if (!grade) return p.canvas;
    const key = gradeKey(grade, strength);
    if (key === 0) return p.canvas;
    let g = graded.get(p);
    if (g && g.key === key) { g.used = frameNo; return g.canvas; }
    if (regradeBudget <= 0) { if (g) g.used = frameNo; return g ? g.canvas : p.canvas; }
    regradeBudget--;
    if (!g) {
      const px = p.canvas.width * p.canvas.height;
      while (gradedPx + px > gradedCapPx && graded.size) {
        let oldest = null;
        for (const [k, v] of graded) if (!oldest || v.used < oldest[1].used) oldest = [k, v];
        dropGraded(oldest[0]);
      }
      const canvas = makeCanvas(p.canvas.width, p.canvas.height);
      if (!canvas) return p.canvas;
      g = { canvas, key: -1, used: frameNo, px };
      graded.set(p, g); gradedPx += px;
    }
    const cx = g.canvas.getContext('2d');
    cx.globalCompositeOperation = 'copy'; cx.globalAlpha = 1;
    cx.drawImage(p.canvas, 0, 0);
    cx.globalCompositeOperation = 'source-atop';
    const w = grade.w * strength, a = grade.a * strength;
    if (w > 0.002) { cx.fillStyle = rgba(grade.W, w); cx.fillRect(0, 0, g.canvas.width, g.canvas.height); }
    if (a > 0.002) { cx.fillStyle = rgba(grade.D, a); cx.fillRect(0, 0, g.canvas.width, g.canvas.height); }
    cx.globalCompositeOperation = 'source-over';
    g.key = key; g.used = frameNo; stats.regraded++;
    return g.canvas;
  }

  function residentBytes() {
    let bytes = gradedPx * 4;
    for (const e of kits.values()) for (const p of Object.values(e.prepared)) bytes += p.bytes ?? 0;
    return bytes;
  }
  return {
    request, pump, retain, evict, prepared, gradedCanvas,
    tier: tierFor,
    beginFrame() { frameNo++; regradeBudget = 2; },
    failed(name) { const kit = SPRITE_KIT.get(name); return Boolean(kit && kits.get(kit)?.failed.has(name)); },
    failedAny() { for (const e of kits.values()) if (e.failed.size) return true; return false; },
    resident() { return [...kits.keys()]; },
    stats() { return { ...stats, resident: [...kits.keys()], residentBytes: residentBytes(), gradedPx, queued: queue.filter(current).length, active }; },
    dispose() { for (const id of [...kits.keys()]) evict(id); queue.length = 0; },
  };
}

// ---------------------------------------------------------------- the shared instance and drawing

let art = null;
export function obstacleArt() { if (!art) art = createObstacleArt(); return art; }
// Tests and tools swap the loader (fake images and canvases).
export function setObstacleArt(instance) { art?.dispose?.(); art = instance; }

// A guess of the canvas density before the first frame (main's viewport formula),
// so the common kit can start downloading at boot at the right tier.
export function guessDensity() {
  try {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const h = typeof window !== 'undefined' ? window.innerHeight || 720 : 720;
    return Math.min(2, Math.max(0.5, h / 720 * Math.min(2, dpr)));
  } catch { return 1; }
}
export function prefetchObstacleArt(density = guessDensity()) {
  const a = obstacleArt();
  a.request('common', density);
  a.request(CHIKUN_REGIONS[0].id, density);
}

const regionScratch = {};
// Once per frame (drawGround): keep common plus two region kits. For the first
// 600 ticks of a region the previous kit stays (its last wide obstacles are
// still leaving the screen); after that it is evicted and the next region's
// kit loads, at least 460 ticks before that region's first obstacle appears.
// Nothing further ahead is requested.
export const PREVIOUS_KIT_TICKS = 600;
export function scheduleObstacleArt(tick, density) {
  const a = obstacleArt();
  a.beginFrame();
  const st = courseRegionState(tick, regionScratch), ids = CHIKUN_REGIONS.map(r => r.id);
  const keep = st.localTick < PREVIOUS_KIT_TICKS ? [ids[(st.index + ids.length - 1) % ids.length], ids[st.index]] : [ids[st.index], ids[st.nextIndex]];
  a.request('common', density);
  for (const id of keep) a.request(id, density);
  a.retain(keep);
  a.pump(1.5);
}

// Soft contact shadow blob (a small radial gradient canvas, drawn scaled).
let shadowBlob = null;
function shadowSprite() {
  if (shadowBlob) return shadowBlob;
  const c = defaultMakeCanvas(64, 20) ?? null;
  if (!c) return null;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(32, 10, 0, 32, 10, 32);
  g.addColorStop(0, 'rgba(8,14,12,1)'); g.addColorStop(0.55, 'rgba(8,14,12,0.55)'); g.addColorStop(1, 'rgba(8,14,12,0)');
  cx.setTransform(1, 0, 0, 0.3125, 0, 0); cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
  c.soft = true;
  shadowBlob = c;
  return c;
}

const layoutScratch = [], rectScratch = [];
function device(ctx) {
  const t = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  return t && t.a > 0 ? t : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

// Draw one obstacle from its sprites. Returns false (nothing drawn) while any
// sprite it needs is missing, so the caller draws the code fallback instead.
export function drawObstacleArt(ctx, o, tick = 0, reduced = false) {
  const a = obstacleArt();
  const ops = layoutObstacleArt(o, { tick, reduced }, layoutScratch);
  if (ops.missing || !ops.length) return false;
  for (const p of ops) if (!a.prepared(p.name)) return false;
  const t = device(ctx), d = t.a, ex = t.e, ey = t.f;
  const bus = sceneBus, rig = bus.rig, grade = rig?.grade ?? null;
  const rectTint = RECT_TINT.has(o.kind) || RECT_TINT.has(o.family);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // contact shadow on the trailing (right) side, strength from the light rig
  const shadowK = (rig?.shadowAlpha ?? 0.28) * 1.7;
  const blob = GROUNDED_SHADOW.has(o.kind) || o.family === 'tree' ? shadowSprite() : null;
  if (blob) {
    const w = o.kind === 'tree' ? 96 : Math.max(40, o.width * 1.05), cxl = o.x + o.width / 2 + 7;
    ctx.globalAlpha = Math.min(0.6, shadowK);
    ctx.drawImage(blob, Math.round(d * (cxl - w / 2) + ex), Math.round(d * (GROUND_Y - 5) + ey), Math.round(w * d), Math.round(12 * d));
    ctx.globalAlpha = 1;
  } else if (o.family === 'sky' && o.kind !== 'storm' && o.kind !== 'canopy' && shadowSprite()) {
    const k = Math.max(0, 1 - (GROUND_Y - o.y) / 420) * shadowK * 0.5;
    if (k > 0.01) { ctx.globalAlpha = k; ctx.drawImage(shadowSprite(), Math.round(d * (o.x + 10) + ex), Math.round(d * (GROUND_Y - 4) + ey), Math.round((o.width - 10) * d), Math.round(9 * d)); ctx.globalAlpha = 1; }
  }
  for (const p of ops) {
    const pr = a.prepared(p.name);
    const img = rectTint && p.name.startsWith('facade-') ? pr.canvas : a.gradedCanvas(pr, grade);
    const k = d / pr.density;
    const top = Math.round(d * p.y + ey), left = Math.round(d * p.x + ex);
    const r0 = Math.round(p.sy0 * pr.density), r1 = Math.min(pr.dh, Math.round(p.sy1 * pr.density));
    const c0 = Math.round(p.sx0 * pr.density), c1 = Math.min(pr.slot, Math.round(p.sx1 * pr.density));
    if (r1 <= r0 || c1 <= c0) continue;
    const sx = p.frame * pr.stride + c0;
    if (Math.abs(k - 1) < 1e-3) ctx.drawImage(img, sx, r0, c1 - c0, r1 - r0, left + c0, top + r0, c1 - c0, r1 - r0);
    else ctx.drawImage(img, sx, r0, c1 - c0, r1 - r0, left + c0 * k, top + r0 * k, (c1 - c0) * k, (r1 - r0) * k); // briefly after a density change
  }
  if (rectTint && grade) {
    const w = grade.w * GAMEPLAY_GRADE, al = grade.a * GAMEPLAY_GRADE;
    for (const [x, y, rw, rh] of tintRects(o, rectScratch)) {
      const X = Math.round(d * x + ex), Y = Math.round(d * Math.max(0, y) + ey), W = Math.round(rw * d), H = Math.round((rh - Math.max(0, -y)) * d);
      if (w > 0.002) { ctx.fillStyle = rgba(grade.W, w); ctx.fillRect(X, Y, W, H); }
      if (al > 0.002) { ctx.fillStyle = rgba(grade.D, al); ctx.fillRect(X, Y, W, H); }
    }
  }
  // lights after the grade: windows, lamps, LEDs (1x sources, drawn scaled)
  const lights = rig?.lightsOn ?? 0;
  if (lights > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, lights);
    for (const p of ops) {
      const e = a.prepared(p.name + ':emit');
      if (!e) continue;
      const sx = p.frame * (e.w + e.gap) + p.sx0, sw = p.sx1 - p.sx0, sh = p.sy1 - p.sy0;
      ctx.drawImage(e.canvas, sx, p.sy0, sw, sh, d * (p.x + p.sx0) + ex, d * (p.y + p.sy0) + ey, sw * d, sh * d);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  ctx.restore();
  return true;
}

// The spinning coin (radius 19 obstacle coins, 17 ground coins).
export function drawCoinArt(ctx, c, tick = 0, reduced = false) {
  const a = obstacleArt();
  const small = c.radius < 18;
  const pr = a.prepared(small ? 'coin@17' : 'coin'), sp = spriteDesc('coin');
  if (!pr || !sp) return false;
  const t = device(ctx), d = t.a;
  const frame = reduced ? 0 : Math.floor(Math.max(0, tick) / 5) % sp.frames;
  const img = a.gradedCanvas(pr, sceneBus.rig?.grade ?? null, 0.5);
  const k = small ? 17 / 19 : 1;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const left = Math.round(d * (c.x + sp.x * k) + t.e), top = Math.round(d * (c.y + sp.y * k) + t.f);
  const s = d / pr.density;
  if (Math.abs(s - 1) < 1e-3) ctx.drawImage(img, frame * pr.stride, 0, pr.slot, pr.dh, left, top, pr.slot, pr.dh);
  else ctx.drawImage(img, frame * pr.stride, 0, pr.slot, pr.dh, left, top, pr.slot * s, pr.dh * s);
  ctx.restore();
  return true;
}

// Lap-1 hint for the low passages (storm, canopy): chevrons inside the rect,
// pointing down (go low). Replaces the old "FLY LOW / RUN" text.
export function drawLowPassageHint(ctx, o, tick = 0, reduced = false) {
  if (o.index >= 48 || (o.kind !== 'storm' && o.kind !== 'canopy')) return;
  const x = o.x + o.width / 2, y = o.height - 34 + (reduced ? 0 : Math.sin(tick * 0.08) * 2);
  ctx.save();
  ctx.fillStyle = 'rgba(12,22,30,0.72)';
  ctx.beginPath(); ctx.ellipse(x, y, 24, 17, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffe29a'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const dy of [-6, 4]) { ctx.beginPath(); ctx.moveTo(x - 10, y + dy - 4); ctx.lineTo(x, y + dy + 4); ctx.lineTo(x + 10, y + dy - 4); ctx.stroke(); }
  ctx.restore();
}

// Storm weather inside the cell's own extent: rain streaks in its lower part,
// a light drizzle below it (<= 15% alpha) and at most one lightning flash per
// two seconds, all deterministic from the tick and the obstacle index.
const bolt = [];
export function drawStormWeather(ctx, o, tick = 0, reduced = false) {
  if (o.kind !== 'storm') return;
  const x0 = o.x + 6, w = o.width - 12, h = o.height;
  ctx.save();
  ctx.beginPath(); ctx.rect(o.x, 0, o.width, GROUND_Y); ctx.clip();
  ctx.lineCap = 'round';
  const fall = reduced ? 0 : tick * 9;
  for (let i = 0; i < 26; i++) {
    const hx = hash(o.index * 131 + i), px = x0 + (hx % 1000) / 1000 * w;
    const py = h - 170 + ((hx >>> 10) % 170 + fall) % 170;
    ctx.strokeStyle = i % 3 ? 'rgba(196,222,236,0.30)' : 'rgba(226,240,248,0.42)';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 3, py + 18); ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const hx = hash(o.index * 977 + i), px = x0 + (hx % 1000) / 1000 * w, span = GROUND_Y - h;
    if (span < 20) break;
    const py = h + ((hx >>> 10) % span + fall * 1.1) % span;
    ctx.strokeStyle = 'rgba(200,226,238,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 2.5, py + 14); ctx.stroke();
  }
  if (!reduced) {
    const window = Math.floor(tick / 120), local = tick - window * 120, hs = hash(window * 7919 + o.index);
    const start = 20 + hs % 60;
    if (hs % 3 !== 0 && local >= start && local < start + 9) {
      const flicker = local - start < 3 ? 1 : local - start < 5 ? 0.35 : 0.8;
      let bx = x0 + w * (0.25 + (hs >>> 8) % 50 / 100), by = 60 + (hs >>> 4) % 80;
      bolt.length = 0; bolt.push(bx, by);
      for (let k = 1; k < 9; k++) { const r = hash(hs + k); bx = Math.max(x0, Math.min(x0 + w, bx + ((r % 40) - 20))); by += (h - 60 - by) / (9 - k) * (0.7 + (r >>> 8) % 60 / 100); bolt.push(bx, Math.min(h - 20, by)); }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(150,170,220,${0.10 * flicker})`; ctx.fillRect(o.x, 0, o.width, h);
      for (const [lw, col] of [[7, `rgba(140,170,255,${0.28 * flicker})`], [2.2, `rgba(255,250,235,${0.95 * flicker})`]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(bolt[0], bolt[1]); for (let k = 2; k < bolt.length; k += 2) ctx.lineTo(bolt[k], bolt[k + 1]); ctx.stroke();
      }
    }
  }
  ctx.restore();
}
