// The Chikun light rig: one pure function from the day clock and the region
// state to every lighting value the renderer needs (sky, fog per depth, the
// time-of-day grade, emissive lights, sun and moon). No obstacle data enters,
// nothing here allocates on the hot path (callers pass `out`), and the result
// is quantised into buckets so gradients and colour strings are cached.
//
// The scenery is rendered in neutral daylight; the grade supplies the time of
// day: G(C) = lerp(lerp(C, W, w), D, a), applied as two 'source-atop' fills.
// The key light is fixed at the upper left (sun and moon live in the left third
// of the view), matching the character's baked lighting.

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
// Day-clock altitudes (see chikunSkyState) where the sun is fully gone and the
// moon starts to show; the gap between them keeps the two out of the sky together.
export const SUN_GONE = -0.20, MOON_SHOWS = -0.24;

// The 180 s day clock (unchanged from 1.8.2): noon at t = 0, pinned by tests.
const mixC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export function chikunSkyState(seconds = 0, reduced = false) {
  const t = reduced ? 0 : (Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  const phase = (t % 180) / 180;
  const altitude = Math.cos(phase * TAU);
  const d = clamp((altitude + .32) / .84); const day = d * d * (3 - 2 * d); const night = 1 - day;
  const dusk = Math.exp(-altitude * altitude * 14);
  return { phase, day, night, dusk, altitude, top: mixC([10, 18, 48], [48, 119, 155], day), horizon: mixC(mixC([42, 59, 105], [249, 215, 167], day), [231, 136, 139], dusk * .7) };
}

// Starting values tuned on the farmland review plates.
export const RIG_KEYS = Object.freeze({
  noon: Object.freeze({ W: [255, 244, 222], w: 0.0, D: [40, 48, 70], a: 0.0, fog: null, fogScale: 1.0, lightsOn: 0.0, rim: [255, 255, 255], rimAlpha: 0.18, shadowAlpha: 0.28, stars: 0, rays: 0.0 }),
  golden: Object.freeze({ W: [236, 142, 66], w: 0.30, D: [40, 24, 52], a: 0.10, fog: [238, 170, 112], fogScale: 0.85, lightsOn: 0.2, rim: [255, 190, 120], rimAlpha: 0.55, shadowAlpha: 0.18, stars: 0, rays: 1.0 }),
  night: Object.freeze({ W: [120, 150, 220], w: 0.08, D: [16, 24, 58], a: 0.52, fog: [30, 44, 86], fogScale: 0.8, lightsOn: 1.0, rim: [170, 200, 255], rimAlpha: 0.45, shadowAlpha: 0.10, stars: 1, rays: 0.0 }),
  dawn: Object.freeze({ W: [255, 184, 160], w: 0.18, D: [70, 50, 90], a: 0.12, fog: [240, 190, 186], fogScale: 1.1, lightsOn: 0.3, rim: [255, 200, 180], rimAlpha: 0.45, shadowAlpha: 0.18, stars: 0.15, rays: 0.6 }),
});
export const RIG_KEY_NAMES = Object.freeze(['noon', 'golden', 'night', 'dawn']);
// Per-depth fog by day; the fills accumulate (far gets far + mid + near).
export const FOG_BY_DEPTH = Object.freeze({ far: 0.30, mid: 0.18, near: 0.08 });
export const REGION_FOG = Object.freeze({ farmland: 1.0, forest: 1.12, town: 0.8, city: 1.0, industrial: 1.15, suburbs: 0.8, coast: 1.1 });
export const PHASE_BUCKETS = 720;   // 0.25 s of a 180 s day
export const BLEND_BUCKETS = 32;

const mix = (a, b, t) => a + (b - a) * t;
function mix3(out, a, b, t) { out[0] = mix(a[0], b[0], t); out[1] = mix(a[1], b[1], t); out[2] = mix(a[2], b[2], t); return out; }

export function createLightRig() {
  return {
    bucket: -1, phaseBucket: 0, blendBucket: 0,
    weights: { noon: 1, golden: 0, night: 0, dawn: 0 },
    grade: { W: [0, 0, 0], w: 0, D: [0, 0, 0], a: 0 },
    fogColor: [0, 0, 0], fog: { far: 0, mid: 0, near: 0 },
    horizon: [0, 0, 0], skyTop: [0, 0, 0], skyBottom: [0, 0, 0],
    lightsOn: 0, rim: [0, 0, 0], rimAlpha: 0, shadowAlpha: 0, stars: 0, rays: 0, night: 0, day: 1, dusk: 0,
    sun: { x: 0, y: 0, alpha: 0 }, moon: { x: 0, y: 0, alpha: 0 },
  };
}

const SKY_BOTTOM_DAY = [85, 139, 154], SKY_BOTTOM_NIGHT = [15, 35, 62];
const noonFog = [0, 0, 0];
// Noon aerial perspective: the horizon pulled toward a pale blue-grey.
const NOON_FOG = h => { noonFog[0] = mix(h[0], 196, 0.4); noonFog[1] = mix(h[1], 212, 0.4); noonFog[2] = mix(h[2], 226, 0.4); return noonFog; };
const scratch = { W: [0, 0, 0], D: [0, 0, 0], fog: [0, 0, 0], rim: [0, 0, 0] };
// sky: chikunSkyState(); region: courseRegionState(); view: {left,width}.
export function computeLightRig(sky, region, view, out = createLightRig()) {
  const rising = Math.sin(sky.phase * TAU) < 0;
  const dusk = clamp(sky.dusk), rest = 1 - dusk;
  const wts = out.weights;
  wts.golden = rising ? 0 : dusk; wts.dawn = rising ? dusk : 0;
  wts.noon = rest * sky.day; wts.night = rest * (1 - sky.day);
  // Horizon: the day sky mixed with the region's ambience (cross-fades with the scenery).
  const blend = region?.blend ?? 0;
  const amb = region?.region?.ambience, nextAmb = region?.next?.ambience;
  let hr = sky.horizon[0], hg = sky.horizon[1], hb = sky.horizon[2];
  if (amb) {
    const sr = mix(amb.sky[0], nextAmb.sky[0], blend), sg = mix(amb.sky[1], nextAmb.sky[1], blend), sb = mix(amb.sky[2], nextAmb.sky[2], blend);
    const dr = mix(amb.dusk[0], nextAmb.dusk[0], blend), dg = mix(amb.dusk[1], nextAmb.dusk[1], blend), db = mix(amb.dusk[2], nextAmb.dusk[2], blend);
    hr = mix(mix(hr, sr, 0.32 * sky.day), dr, sky.dusk * 0.35); hg = mix(mix(hg, sg, 0.32 * sky.day), dg, sky.dusk * 0.35); hb = mix(mix(hb, sb, 0.32 * sky.day), db, sky.dusk * 0.35);
  }
  // Daylight haze reads blue-grey, golden hour glows, dawn blushes.
  const tn = 0.35 * wts.noon, tg = 0.35 * wts.golden, td = 0.25 * wts.dawn;
  hr = mix(mix(mix(hr, 205, tn), 255, tg), 255, td); hg = mix(mix(mix(hg, 222, tn), 176, tg), 190, td); hb = mix(mix(mix(hb, 234, tn), 112, tg), 170, td);
  out.horizon[0] = hr; out.horizon[1] = hg; out.horizon[2] = hb;
  out.skyTop[0] = sky.top[0]; out.skyTop[1] = sky.top[1]; out.skyTop[2] = sky.top[2];
  mix3(out.skyBottom, SKY_BOTTOM_DAY, SKY_BOTTOM_NIGHT, sky.night);
  // Blend the keys.
  let wSum = 0, aSum = 0, fSum = 0;
  const W = scratch.W, D = scratch.D, F = scratch.fog, R = scratch.rim;
  W[0] = W[1] = W[2] = D[0] = D[1] = D[2] = F[0] = F[1] = F[2] = R[0] = R[1] = R[2] = 0;
  let lights = 0, rimAlpha = 0, shadowAlpha = 0, stars = 0, rays = 0, fogScale = 0;
  for (const name of RIG_KEY_NAMES) {
    const k = RIG_KEYS[name], x = wts[name];
    if (x <= 0) continue;
    const ww = x * k.w, aa = x * k.a;
    W[0] += ww * k.W[0]; W[1] += ww * k.W[1]; W[2] += ww * k.W[2]; wSum += ww;
    D[0] += aa * k.D[0]; D[1] += aa * k.D[1]; D[2] += aa * k.D[2]; aSum += aa;
    const fc = k.fog ?? NOON_FOG(out.horizon);
    F[0] += x * fc[0]; F[1] += x * fc[1]; F[2] += x * fc[2]; fSum += x;
    R[0] += x * k.rim[0]; R[1] += x * k.rim[1]; R[2] += x * k.rim[2];
    lights += x * k.lightsOn; rimAlpha += x * k.rimAlpha; shadowAlpha += x * k.shadowAlpha; stars += x * k.stars; rays += x * k.rays; fogScale += x * k.fogScale;
  }
  const g = out.grade;
  if (wSum > 1e-6) { g.W[0] = W[0] / wSum; g.W[1] = W[1] / wSum; g.W[2] = W[2] / wSum; } else { g.W[0] = g.W[1] = g.W[2] = 255; }
  if (aSum > 1e-6) { g.D[0] = D[0] / aSum; g.D[1] = D[1] / aSum; g.D[2] = D[2] / aSum; } else { g.D[0] = g.D[1] = g.D[2] = 0; }
  g.w = wSum; g.a = aSum;
  const fs = fSum || 1;
  out.fogColor[0] = F[0] / fs; out.fogColor[1] = F[1] / fs; out.fogColor[2] = F[2] / fs;
  out.rim[0] = R[0] / fs; out.rim[1] = R[1] / fs; out.rim[2] = R[2] / fs;
  const regionFog = mix(REGION_FOG[region?.region?.id] ?? 1, REGION_FOG[region?.next?.id] ?? 1, blend) * (fogScale / fs);
  out.fog.far = clamp(FOG_BY_DEPTH.far * regionFog, 0, 0.8); out.fog.mid = clamp(FOG_BY_DEPTH.mid * regionFog, 0, 0.6); out.fog.near = clamp(FOG_BY_DEPTH.near * regionFog, 0, 0.4);
  out.lightsOn = clamp(lights / fs); out.rimAlpha = rimAlpha / fs; out.shadowAlpha = shadowAlpha / fs; out.stars = clamp(stars / fs); out.rays = clamp(rays / fs);
  out.night = sky.night; out.day = sky.day; out.dusk = sky.dusk;
  // Sun and moon arc through the upper-left third of the view. They never
  // share the sky: the sun has faded out (altitude SUN_GONE) before the moon
  // starts to show (MOON_SHOWS), and it returns only after the moon has gone,
  // so dawn and dusk never read as two suns side by side at the same height.
  const left = view?.left ?? 0, width = view?.width ?? 1280, s = Math.sin(sky.phase * TAU);
  out.sun.x = left + width * (0.20 + 0.12 * s); out.sun.y = 390 - sky.altitude * 217; out.sun.alpha = Math.min(clamp(sky.day * 1.25), smoothstep(SUN_GONE, 0.06, sky.altitude));
  out.moon.x = left + width * (0.20 - 0.12 * s); out.moon.y = 390 + sky.altitude * 225; out.moon.alpha = Math.min(clamp(sky.night * 1.25), smoothstep(MOON_SHOWS, -0.50, sky.altitude));
  // Buckets: gradients and colour strings are rebuilt only when these change.
  out.phaseBucket = Math.floor(clamp(sky.phase, 0, 0.999999) * PHASE_BUCKETS);
  out.blendBucket = Math.round(blend * BLEND_BUCKETS);
  out.bucket = out.phaseBucket + PHASE_BUCKETS * (out.blendBucket + (BLEND_BUCKETS + 1) * ((region?.index ?? 0) * 7 + (region?.nextIndex ?? 0)));
  return out;
}

// CSS colour helpers with a tiny cache keyed by the quantised value.
const colourCache = new Map();
export function rgba(c, alpha = 1) {
  const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]), a = Math.round(clamp(alpha) * 1000);
  const key = ((r * 256 + g) * 256 + b) * 1001 + a;
  let s = colourCache.get(key);
  if (s === undefined) { s = `rgba(${r},${g},${b},${a / 1000})`; if (colourCache.size > 4096) colourCache.clear(); colourCache.set(key, s); }
  return s;
}

// Relative luminance (WCAG) of an sRGB triplet.
export function luminance(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

// The grade operator on one colour (for tests, plates and code-drawn art).
export function applyGrade(c, grade, strength = 1, out = [0, 0, 0]) {
  const w = grade.w * strength, a = grade.a * strength;
  for (let i = 0; i < 3; i++) out[i] = mix(mix(c[i], grade.W[i], w), grade.D[i], a);
  return out;
}
