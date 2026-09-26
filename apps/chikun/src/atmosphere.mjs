// Sky, sun, moon, stars, clouds, light shafts, the backdrop grade and the
// region title card. Sprites are generated once per device density. Sharp ones
// (sun disc, moon, the star tile) are drawn 1:1; soft ones (glows, light
// shafts, clouds) are kept at low resolution and drawn scaled, which costs
// nothing visible and keeps the sky under ~10 MB at density 2. Clouds are
// re-graded into a small cache only when the light bucket changes. Everything is a pure function of the
// tick time and the course distance, so replay seeks are stable. Reduced
// motion freezes the day at noon and stops all drift.
import { rgba } from './light-rig.mjs';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const hash01 = n => { let x = Math.imul((n | 0) + 17, 2654435761) >>> 0; x ^= x >>> 13; return (Math.imul(x, 2246822519) >>> 0) / 4294967296; };
const mod = (a, n) => ((a % n) + n) % n;

// Two cloud decks: far (small, slow) and near (big, parallax .03).
export const CLOUDS = Object.freeze(Array.from({ length: 9 }, (_, i) => Object.freeze({
  seed: 31 + i * 7,
  w: i < 5 ? 190 + hash01(i + 5) * 120 : 300 + hash01(i + 9) * 170,
  h: i < 5 ? 62 + hash01(i + 6) * 26 : 96 + hash01(i + 10) * 40,
  y: i < 5 ? 70 + hash01(i + 7) * 190 : 150 + hash01(i + 11) * 170,
  rate: i < 5 ? 0.01 : 0.03,
  wind: i < 5 ? 4 + hash01(i + 8) * 2 : 6 + hash01(i + 12) * 3,
  offset: hash01(i + 13) * 2400,
})));
const CLOUD_SPAN = 2400;
export const CLOUD_RES = 0.5;      // cloud sprites at half the device density
export const STAR_TILE = 512;      // logical width of the repeating star tile
const GLOW_PX = 128;               // every radial glow is a 128 px source
const soft = c => { if (c) c.soft = true; return c; };

function glowSprite(make, stops) {
  const r = GLOW_PX / 2, c = make(GLOW_PX, GLOW_PX);
  if (!c) return null;
  const x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, GLOW_PX, GLOW_PX);
  return soft(c);
}
// Soft sprite drawn centred at (x, y) with a device radius r.
function drawGlow(ctx, img, x, y, r) { ctx.drawImage(img, Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2)); }

function sunDisc(make, r) {
  const size = Math.ceil(r * 2), c = make(size, size);
  if (!c) return null;
  const x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, col] of [[0, 'rgba(255,253,240,1)'], [0.78, 'rgba(255,246,214,1)'], [0.86, 'rgba(255,236,190,.5)'], [1, 'rgba(255,230,180,0)']]) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return c;
}

function moonSprite(make, r) {
  const c = make(Math.ceil(r * 2 + 4), Math.ceil(r * 2 + 4));
  if (!c) return null;
  const x = c.getContext('2d'), cx = r + 2, cy = r + 2;
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#f6f8f2'); g.addColorStop(0.7, '#dfe6e4'); g.addColorStop(1, '#b8c6c9');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  x.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 9; i++) {
    const a = hash01(i + 90) * TAU, d = hash01(i + 91) * r * 0.75, cr = r * (0.08 + hash01(i + 92) * 0.16);
    x.fillStyle = 'rgba(122,146,158,.28)'; x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(cx + Math.cos(a) * d - cr * 0.2, cy + Math.sin(a) * d - cr * 0.2, cr * 0.7, 0, TAU); x.fill();
  }
  return c;
}

function starSprite(make, w, h, d, seed) {
  const c = make(w, h);
  if (!c) return null;
  const x = c.getContext('2d');
  const n = Math.round(w * h / (d * d) / 5200);
  for (let i = 0; i < n; i++) {
    const px = hash01(seed + i * 3) * w, py = hash01(seed + i * 3 + 1) * h * (0.35 + 0.65 * hash01(seed + i * 3 + 2));
    const b = hash01(seed + i * 5 + 7), s = (b > 0.93 ? 2 : 1) * Math.max(1, Math.round(d * 0.8));
    x.fillStyle = `rgba(${220 + Math.round(b * 30)},${232 + Math.round(b * 20)},255,${0.35 + 0.6 * b})`;
    x.fillRect(Math.round(px), Math.round(py), s, s);
  }
  return c;
}

// A lit cumulus: shadowed body, then light from the upper left added on top.
function cloudSprite(make, cloud, d) {
  d *= CLOUD_RES;
  const w = Math.round(cloud.w * d), h = Math.round(cloud.h * d);
  const c = make(w, h);
  if (!c) return null;
  const x = c.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0);
  const W = cloud.w, H = cloud.h, base = H * 0.78, puffs = [];
  const n = 12 + Math.floor(hash01(cloud.seed) * 8);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, bell = Math.sin(Math.PI * t);
    const r = H * (0.16 + 0.26 * bell * (0.6 + 0.4 * hash01(cloud.seed + i)));
    const px = W * (0.08 + 0.84 * t) + (hash01(cloud.seed + i + 40) - 0.5) * W * 0.06;
    const py = base - r * (0.35 + 0.55 * bell * hash01(cloud.seed + i + 80));
    puffs.push([px, py, r]);
  }
  for (const [px, py, r] of puffs) {
    const g = x.createRadialGradient(px, py, r * 0.2, px, py, r);
    g.addColorStop(0, 'rgba(150,160,178,1)'); g.addColorStop(0.72, 'rgba(160,170,186,.92)'); g.addColorStop(1, 'rgba(170,178,192,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  }
  x.globalCompositeOperation = 'source-atop';
  for (const [px, py, r] of puffs) {
    const lx = px - r * 0.28, ly = py - r * 0.34;
    const g = x.createRadialGradient(lx, ly, 0, lx, ly, r * 0.95);
    g.addColorStop(0, 'rgba(255,255,255,.98)'); g.addColorStop(0.6, 'rgba(248,248,250,.75)'); g.addColorStop(1, 'rgba(240,242,246,0)');
    x.fillStyle = g; x.beginPath(); x.arc(lx, ly, r * 0.95, 0, TAU); x.fill();
  }
  // Soften the flat base.
  x.globalCompositeOperation = 'destination-out';
  const fade = x.createLinearGradient(0, base - H * 0.05, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = fade; x.fillRect(0, base - H * 0.05, W, H);
  x.globalCompositeOperation = 'source-over';
  return soft(c);
}

function raySprite(make, d) {
  d *= 0.25;
  const L = 900 * d, c = make(Math.ceil(L), Math.ceil(L * 0.8));
  if (!c) return null;
  const x = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const a = (0.18 + i * 0.1 + hash01(i + 300) * 0.04) * Math.PI / 2, spread = 0.018 + hash01(i + 301) * 0.02;
    const g = x.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    g.addColorStop(0, 'rgba(255,236,196,.55)'); g.addColorStop(1, 'rgba(255,236,196,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0);
    x.lineTo(Math.cos(a - spread) * L, Math.sin(a - spread) * L); x.lineTo(Math.cos(a + spread) * L, Math.sin(a + spread) * L); x.closePath(); x.fill();
  }
  return soft(c);
}

const TIME_LABEL = { noon: 'DAYLIGHT', golden: 'GOLDEN HOUR', night: 'MOONLIGHT', dawn: 'DAWN' };
export function timeOfDayLabel(rig) {
  let best = 'noon', v = -1;
  for (const [k, w] of Object.entries(rig.weights)) if (w > v) { v = w; best = k; }
  return TIME_LABEL[best];
}

export function createAtmosphere({ makeCanvas }) {
  let density = 0, canvasW = 0, canvasH = 0;
  const s = {};
  const cloudCache = []; let cloudBucket = -1;
  let skyGradient = null, skyBucket = -1, vignette = null;
  const veilColour = [0, 0, 0];

  function rebuild(d, cw, ch) {
    density = d; canvasW = cw; canvasH = ch;
    for (const key of Object.keys(s)) { const v = s[key]; for (const c of Array.isArray(v) ? v : [v]) if (c) { c.width = 0; c.height = 0; } delete s[key]; }
    for (const c of cloudCache) if (c) { c.width = 0; c.height = 0; }
    cloudCache.length = 0; cloudBucket = -1; skyGradient = null; skyBucket = -1; vignette = null;
    s.sunGlow = glowSprite(makeCanvas, [[0, 'rgba(255,236,196,.55)'], [0.18, 'rgba(255,220,168,.32)'], [0.5, 'rgba(255,206,150,.10)'], [1, 'rgba(255,200,140,0)']]);
    s.sunGlowWarm = glowSprite(makeCanvas, [[0, 'rgba(255,170,96,.6)'], [0.25, 'rgba(255,140,80,.28)'], [0.6, 'rgba(240,110,80,.08)'], [1, 'rgba(230,100,80,0)']]);
    s.sunDisc = sunDisc(makeCanvas, 40 * d);
    s.moonGlow = glowSprite(makeCanvas, [[0, 'rgba(170,205,235,.30)'], [0.3, 'rgba(140,180,220,.12)'], [1, 'rgba(120,160,210,0)']]);
    s.moon = moonSprite(makeCanvas, 26 * d);
    const sh = Math.round(430 * d), tw = Math.round(STAR_TILE * d);
    s.stars = starSprite(makeCanvas, tw, sh, d, 811);
    s.rays = raySprite(makeCanvas, d);
    s.clouds = CLOUDS.map(c => cloudSprite(makeCanvas, c, d));
  }

  function gradeClouds(rig, bucket) {
    if (bucket === cloudBucket) return;
    cloudBucket = bucket;
    const g = rig.grade;
    for (let i = 0; i < CLOUDS.length; i++) {
      const src = s.clouds[i];
      if (!src) continue;
      let c = cloudCache[i];
      if (!c) { c = cloudCache[i] = soft(makeCanvas(src.width, src.height)); if (!c) continue; }
      const x = c.getContext('2d');
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      // Clouds take the warm light harder than the land and go slate at night.
      x.fillStyle = rgba(g.W, clamp(g.w * 2.4, 0, 0.6)); x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = rgba(g.D, clamp(g.a * 1.15, 0, 0.75)); x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'source-over';
    }
  }

  return {
    // Everything behind the backdrop, drawn opaque onto the main canvas.
    drawSky(ctx, bus, time) {
      const d = bus.density, cw = bus.canvasWidth, ch = bus.canvasHeight, rig = bus.rig, view = bus.view;
      if (d !== density || cw !== canvasW || ch !== canvasH) rebuild(d, cw, ch);
      if (rig.bucket !== skyBucket || !skyGradient) {
        skyBucket = rig.bucket;
        skyGradient = ctx.createLinearGradient(0, 0, 0, 720 * d);
        skyGradient.addColorStop(0, rgba(rig.skyTop));
        skyGradient.addColorStop(0.5, rgba([(rig.skyTop[0] + rig.horizon[0]) / 2, (rig.skyTop[1] + rig.horizon[1]) / 2, (rig.skyTop[2] + rig.horizon[2]) / 2]));
        skyGradient.addColorStop(0.72, rgba(rig.horizon));
        skyGradient.addColorStop(1, rgba(rig.skyBottom));
      }
      ctx.fillStyle = skyGradient; ctx.fillRect(0, 0, cw, ch);
      if (rig.stars > 0.02 && s.stars) {
        // One star tile drawn twice, offset, twinkling against itself; it repeats across the view.
        const tw = s.stars.width, dy = Math.round(53 * d);
        ctx.globalAlpha = rig.stars * (0.72 + 0.28 * Math.sin(time * 1.3));
        for (let x = 0; x < cw; x += tw) ctx.drawImage(s.stars, x, 0);
        ctx.globalAlpha = rig.stars * (0.6 + 0.3 * Math.cos(time * 1.7));
        for (let x = -Math.round(tw * 0.37); x < cw; x += tw) ctx.drawImage(s.stars, x, dy);
        ctx.globalAlpha = 1;
      }
      if (rig.moon.alpha > 0.01 && s.moon) {
        const mx = (rig.moon.x - view.left) * d, my = rig.moon.y * d;
        ctx.globalAlpha = rig.moon.alpha;
        ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, s.moonGlow, mx, my, 190 * d); ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(s.moon, Math.round(mx - s.moon.width / 2), Math.round(my - s.moon.height / 2));
        ctx.globalAlpha = 1;
      }
      if (rig.sun.alpha > 0.01 && s.sunDisc) {
        const sx = (rig.sun.x - view.left) * d, sy = rig.sun.y * d;
        const warm = clamp(rig.dusk * 1.4);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = rig.sun.alpha * (1 - 0.6 * warm); drawGlow(ctx, s.sunGlow, sx, sy, 240 * d);
        if (warm > 0.01) { ctx.globalAlpha = rig.sun.alpha * warm; drawGlow(ctx, s.sunGlowWarm, sx, sy, 300 * d); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = rig.sun.alpha; ctx.drawImage(s.sunDisc, Math.round(sx - s.sunDisc.width / 2), Math.round(sy - s.sunDisc.height / 2));
        ctx.globalAlpha = 1;
      }
      gradeClouds(rig, Math.floor(rig.phaseBucket / 4) + 1000 * rig.blendBucket);
      const span = Math.max(CLOUD_SPAN, view.width + 700);
      for (let i = 0; i < CLOUDS.length; i++) {
        const c = CLOUDS[i], img = cloudCache[i];
        if (!img) continue;
        const u = mod(c.offset - time * c.wind - bus.distance * c.rate, span) - 350;
        const x = Math.round(u * d), y = Math.round(c.y * d), w = Math.round(c.w * d), h = Math.round(c.h * d);
        if (x > cw || x + w < 0) continue;
        ctx.globalAlpha = i < 5 ? 0.78 : 0.92;
        ctx.drawImage(img, x, y, w, h);
      }
      ctx.globalAlpha = 1;
    },
    // Light shafts from a low sun, added over the backdrop.
    drawRays(ctx, bus) {
      const rig = bus.rig;
      if (rig.rays <= 0.02 || !s.rays || rig.sun.alpha <= 0.02) return;
      const d = bus.density, x = (rig.sun.x - bus.view.left) * d, y = rig.sun.y * d;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(rig.rays * rig.sun.alpha * 0.16);
      ctx.drawImage(s.rays, Math.round(x), Math.round(y), s.rays.width * 4, s.rays.height * 4);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
    // Time-of-day grade and transition veil on the backdrop canvas.
    grade(bctx, bus, veil, veilTint) {
      const g = bus.rig.grade, w = bctx.canvas.width, h = bctx.canvas.height;
      bctx.globalCompositeOperation = 'source-atop';
      if (g.w > 0.002) { bctx.fillStyle = rgba(g.W, g.w); bctx.fillRect(0, 0, w, h); }
      if (g.a > 0.002) { bctx.fillStyle = rgba(g.D, g.a); bctx.fillRect(0, 0, w, h); }
      if (veil > 0.003) {
        const hz = bus.rig.horizon, t = veilTint;
        if (t) { veilColour[0] = (hz[0] + t[0]) / 2; veilColour[1] = (hz[1] + t[1]) / 2; veilColour[2] = (hz[2] + t[2]) / 2; }
        bctx.fillStyle = rgba(t ? veilColour : hz, veil); bctx.fillRect(0, 0, w, h);
      }
      bctx.globalCompositeOperation = 'source-over';
    },
    // Soft top vignette (keeps the HUD readable) and the region title card.
    drawOverlay(ctx, bus, title) {
      const d = bus.density, cw = bus.canvasWidth;
      if (!vignette) { vignette = ctx.createLinearGradient(0, 0, 0, 70 * d); vignette.addColorStop(0, 'rgba(6,16,30,.34)'); vignette.addColorStop(1, 'rgba(6,16,30,0)'); }
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, cw, Math.ceil(70 * d));
      if (!title || title.alpha <= 0.01) return;
      const cx = Math.round((bus.view.width / 2) * d), y = 116 * d;
      ctx.globalAlpha = title.alpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `800 ${Math.round(30 * d)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(8,18,28,.55)'; ctx.fillText(title.name, cx + Math.round(2 * d), y + Math.round(2 * d));
      ctx.fillStyle = '#f6ecd4'; ctx.fillText(title.name, cx, y);
      ctx.font = `700 ${Math.round(11 * d)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(8,18,28,.5)'; ctx.fillText(title.detail, cx + Math.round(1 * d), y + Math.round(20 * d) + Math.round(1 * d));
      ctx.fillStyle = title.ranked ? '#f0c67f' : '#bfe0d4'; ctx.fillText(title.detail, cx, y + Math.round(20 * d));
      ctx.globalAlpha = 1;
    },
    sprites() { return s; },
    dispose() {
      const free = c => { if (c) { c.width = 0; c.height = 0; } };
      for (const key of Object.keys(s)) { if (Array.isArray(s[key])) s[key].forEach(free); else free(s[key]); delete s[key]; }
      cloudCache.forEach(free); cloudCache.length = 0; density = 0;
    },
  };
}
