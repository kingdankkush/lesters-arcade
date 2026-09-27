// Obstacle value separation (projection only).
//
// Obstacles must read against the scenery at every hour. Each obstacle draw is
// graded darker than the backdrop band it sits in (deepen: towards a cool
// near-black, a multiply that keeps the art's texture) or lighter (lift: the
// sprite exposed brighter, then washed with the key light's colour: white sun
// at noon, amber at golden hour, blue moonlight at night) until its body
// reaches the target WCAG luminance contrast against the backdrop around it.
// The amount is quantised so the graded copies it selects are cached and
// rebuilt rarely.
//
// The backdrop luminance comes from BACKDROP_PROFILE (generated offline from
// the shipped scenery at the four light keys, blended by the rig's key
// weights); the obstacle's from its sprite's catalogued tone graded the way
// the runtime grades it. Inputs are the sprite tone, the obstacle's own region,
// the light rig and the rows the draw covers: nothing reads the course ahead
// or any gameplay state, and nothing here allocates.
import { BACKDROP_PROFILE } from './obstacle-backdrop-profile.mjs';

// Two tiers: the target contrast within gentle amounts, else a floor within
// firmer ones, so a mid-value prop on a mid-value band is not washed to a
// ghost or crushed to a silhouette just to reach the target.
export const SEPARATION = Object.freeze({
  day: 3.5,               // target body contrast in daylight (receipts: median >= 3:1 at noon; the model reads ~10 % high)
  night: 2.6,             // target at full night (receipts: median >= 2.5:1)
  dayFloor: 2.6,          // floor when the target needs more than the gentle amounts
  nightFloor: 2.2,
  gentleDeepen: 0.55,
  gentleLift: 0.4,
  maxDeepen: 0.65,
  maxLift: 0.65,
  // lift s = exposure x (1 + liftGain s) (the sprite added onto itself, so its
  // texture and modelling survive), then a (liftWash + liftWashNight x night) s
  // wash of the key colour: sunlit by day, tinted by the blue moon at night
  liftGain: 1.7,
  liftWash: 0.2,
  liftWashNight: 0.15,
  liftClip: 0.75,
  liftHeadroom: 1.15,     // a lift stops where the body's brightest mean channel would pass 115 % (a white barrier is not blown out)         // modelled share of the exposure gain that survives per-pixel clipping (calibrated on the review receipts)
  hole: Object.freeze([0, 0, 0]),
  holeDeepen: 0.9,        // pits are holes: deepened towards black, never lifted
  // the opposite of a sprite's natural relation to its band (a pink blossom
  // crushed dark, a dark trunk bleached) only while that relation is weak
  switchBelow: 1.5,
  steps: 20,              // amounts are multiples of 1 / steps
  ring: 12,               // logical px of backdrop above and below a draw that count as "around" it
  deepen: Object.freeze([14, 16, 26]),
});

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lin = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const toneLuminance = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const lum3 = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrastRatio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const KEYS = BACKDROP_PROFILE.keys;
const NOON_ONLY = Object.freeze({ noon: 1, golden: 0, night: 0, dawn: 0 });

// Backdrop luminance over logical rows [y0, y1) in `region`, blended by the key
// weights: stat 'mean', or the band's lower ('low') or upper ('high') quartile.
export function backdropLuminance(region, weights, y0, y1, stat = 'mean') {
  const rows = (BACKDROP_PROFILE.regions[region] ?? BACKDROP_PROFILE.regions.farmland)[stat];
  const w = weights && region in BACKDROP_PROFILE.regions ? weights : NOON_ONLY;
  const band = BACKDROP_PROFILE.band, n = rows[0].length, H = band * n;
  let a = clamp(Math.min(y0, y1), 0, H), b = clamp(Math.max(y0, y1), 0, H);
  if (b - a < 1) { a = clamp(a - 0.5, 0, H - 1); b = a + 1; }
  let total = 0, weightSum = 0;
  for (let k = 0; k < KEYS.length; k++) {
    const wk = w[KEYS[k]] ?? 0;
    if (wk <= 0) continue;
    const row = rows[k];
    let acc = 0;
    for (let i = Math.floor(a / band); i < n && i * band < b; i++) {
      const lo = Math.max(a, i * band), hi = Math.min(b, (i + 1) * band);
      if (hi > lo) acc += row[i] * (hi - lo);
    }
    total += wk * acc / (b - a); weightSum += wk;
  }
  return weightSum > 0 ? total / weightSum / 1000 : rows[0][Math.min(n - 1, Math.floor(a / band))] / 1000;
}

// The sprite's body luminance after the runtime grade (mean linear luminance,
// from its tone), before any separation.
const graded = [0, 0, 0];
function gradeTone(tone, rig, strength) {
  const g = rig?.grade;
  let r = tone[0], gg = tone[1], b = tone[2];
  if (g) {
    const w = (g.w ?? 0) * strength, al = (g.a ?? 0) * strength;
    r += (g.W[0] - r) * w; gg += (g.W[1] - gg) * w; b += (g.W[2] - b) * w;
    r += (g.D[0] - r) * al; gg += (g.D[1] - gg) * al; b += (g.D[2] - b) * al;
  }
  graded[0] = r; graded[1] = gg; graded[2] = b;
  return graded;
}
const jensenOf = tone => { const base = toneLuminance(tone); return base > 1e-4 ? clamp((tone[3] ?? base * 1000) / 1000 / base, 0.5, 3) : 1; };
export function gradedBodyLuminance(tone, rig, strength = 0.72) {
  const c = gradeTone(tone, rig, strength);
  return jensenOf(tone) * lum3(c[0], c[1], c[2]);
}

// The separation for one draw.
//   tone      [r, g, b, mean linear luminance x 1000] of the sprite (catalogue)
//   ring      backdrop luminance around the draw; ringLow / ringHigh its lower
//             and upper quartiles: a deepen is solved against the mean of ring
//             and ringLow, a lift against ring and ringHigh, so a flyer stays
//             separated as darker or brighter parts of its band pass behind it
//             (the reported ratio is against ring)
//   rig       the light rig (grade, weights, night, rim)
//   hole      art that must stay dark (pits): only deepened, towards black
//   washLift  art lifted by a plain fill (facades, graded over their rects)
//   dir       -1 deepen or +1 lift for every part of a multi-part obstacle
//             (obstacleDirection), 0 to follow the sprite's natural relation
//             to the band, falling back to the other direction
// out = { mode: 'none' | 'deepen' | 'lift', s, colour, exposure, fill, ratio }:
// exposure is the alpha of the copy added onto itself ('lighter'), fill the
// alpha of the colour filled over it ('source-atop'; facades: over their rects).
export function separationFor(tone, ring, rig, out = {}, strength = 0.72, hole = false, washLift = false, ringLow = ring, ringHigh = ring, dir = 0) {
  const c = gradeTone(tone, rig, strength), r = c[0], gg = c[1], b = c[2];
  // mean-of-luminance over luminance-of-mean (the transfer curve is convex); it fades as the fill flattens the sprite
  const jensen = jensenOf(tone);
  const night = clamp(Number.isFinite(rig?.night) ? rig.night : rig?.weights?.night ?? 0);
  const target = SEPARATION.day + (SEPARATION.night - SEPARATION.day) * night;
  const floor = SEPARATION.dayFloor + (SEPARATION.nightFloor - SEPARATION.dayFloor) * night;
  const lift = rig?.rim ?? [255, 255, 255], deep = hole ? SEPARATION.hole : SEPARATION.deepen, steps = SEPARATION.steps;
  const gentleDeepen = hole ? SEPARATION.holeDeepen : SEPARATION.gentleDeepen, maxDeepen = hole ? SEPARATION.holeDeepen : SEPARATION.maxDeepen;
  const canLift = !hole;
  const base0 = jensen * lum3(r, gg, b);
  const washK = SEPARATION.liftWash + SEPARATION.liftWashNight * night;
  const body = (d, s) => {
    const K = d < 0 ? deep : lift;
    if (d < 0 || washLift) return (1 + (jensen - 1) * (1 - s)) * lum3(r + (K[0] - r) * s, gg + (K[1] - gg) * s, b + (K[2] - b) * s);
    const e = 1 + Math.min(1, SEPARATION.liftGain * s), w = washK * s;
    const er = Math.min(255, r * e), eg = Math.min(255, gg * e), eb = Math.min(255, b * e);
    const lifted = (1 + (jensen - 1) * (1 - w)) * lum3(er + (K[0] - er) * w, eg + (K[1] - eg) * w, eb + (K[2] - eb) * w);
    // the brighter pixels clip before the mean does: damp the modelled gain
    return base0 + (lifted - base0) * SEPARATION.liftClip;
  };
  const dRing = (ring + Math.min(ring, ringLow)) / 2, lRing = (ring + Math.max(ring, ringHigh)) / 2;
  const ratioFor = (d, L) => d < 0 ? (L < dRing ? (dRing + 0.05) / (L + 0.05) : 1) : (L > lRing ? (L + 0.05) / (lRing + 0.05) : 1);
  const natural = !canLift || (dir === 0 ? base0 <= ring : dir < 0) ? -1 : 1;
  const set = (d, s) => {
    out.mode = s > 0 ? (d < 0 ? 'deepen' : 'lift') : 'none'; out.s = s > 0 ? s : 0; out.colour = s > 0 ? (d < 0 ? deep : lift) : null;
    out.exposure = s > 0 && d > 0 && !washLift ? Math.min(1, SEPARATION.liftGain * s) : 0;
    out.fill = s > 0 ? (d < 0 || washLift ? s : washK * s) : 0;
    out.ratio = contrastRatio(s > 0 ? body(d, s) : base0, ring);
    return true;
  };
  if (ratioFor(natural, base0) >= target) return set(natural, 0) && out;
  // smallest amount (in steps) reaching `want` in direction d, or -1
  const peak = Math.max(r, gg, b, 1);
  const liftCap = washLift ? SEPARATION.maxLift : Math.max(0, Math.min(SEPARATION.maxLift, (255 * SEPARATION.liftHeadroom / peak - 1) / SEPARATION.liftGain));
  const reach = (d, want, cap) => {
    if (d > 0) cap = Math.min(cap, liftCap);
    for (let i = 1; i <= Math.round(cap * steps); i++) if (ratioFor(d, body(d, i / steps)) >= want) return i / steps;
    return -1;
  };
  // the target within gentle amounts, else the floor within firm ones
  const solve = d => {
    if (d > 0 && !canLift) return false;
    let s = reach(d, target, d < 0 ? gentleDeepen : SEPARATION.gentleLift);
    if (s < 0) s = reach(d, floor, d < 0 ? maxDeepen : SEPARATION.maxLift);
    return s > 0 && set(d, s);
  };
  // the natural direction first (a dark log stays dark, a hay bale stays
  // bright); the other only when no direction was imposed, that one fails and
  // the sprite's own relation to the band is weak (it keeps its identity)
  if (solve(natural) || (dir === 0 && contrastRatio(base0, ring) < SEPARATION.switchBelow && solve(-natural))) return out;
  const s = natural < 0 ? gentleDeepen : Math.floor(Math.min(SEPARATION.gentleLift, liftCap) * steps) / steps;
  set(natural, s > 0 && ratioFor(natural, body(natural, s)) > 1 ? s : 0);
  return out;
}

// One direction for every part of a multi-part obstacle (a row of buildings,
// a tree's trunk and crown, the forest wall's columns), so its parts never
// split into light and dark: the sign of the parts' summed leans, each the
// graded body's luminance above (+) or below (-) its band, times its area.
export function partLean(tone, ring, area, rig, strength = 0.72) { return (gradedBodyLuminance(tone, rig, strength) - ring) * area; }
// The part's own contrast with its band before any separation.
export function partContrast(tone, ring, rig, strength = 0.72) { return contrastRatio(gradedBodyLuminance(tone, rig, strength), ring); }

// A numeric cache key for a blended separation (0 = none): the deepen, lift
// and wash amounts and the wash colour quantised to 4 bits per channel (the
// deep colour is fixed per sprite: black for pits).
export function separationKey(sep) {
  if (!sep || !(sep.deepen > 0 || sep.lift > 0)) return 0;
  const c = sep.colour ?? [0, 0, 0];
  const q = ((c[0] >> 4) * 256) + ((c[1] >> 4) * 16) + (c[2] >> 4);
  return ((Math.round(sep.deepen * SEPARATION.steps) * 21 + Math.round(sep.lift * SEPARATION.steps)) * 41 + Math.round((sep.fill ?? 0) * 40)) * 4096 + q + 1;
}
