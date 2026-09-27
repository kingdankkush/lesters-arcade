// Projection-only district mood, weather and micro-life (1.9.0 world pass,
// items A4, H4, C1b and D2). A lazy chunk loaded by world-fx.mjs; nothing in
// the initial bundle imports it.
//
// Every value here is a pure function of the district table, a world x, a
// world lattice cell, a slot index, an entity id and the simulation tick. No
// wall clock, no RNG draw: a paused frame is frozen, a replay draws the same
// sky and the simulation never reads any of it.
export const WORLD_MOOD_ART_ID = 'projection-world-mood-v1';
export const MOOD_TINT_MAX_ALPHA = 0.18;
// Half-width of the blend either side of a district boundary: the same
// 600-unit seam window the W-13 colour grade uses.
export const MOOD_SEAM_UNITS = 300;
// Exponential approach per simulation tick toward the positional target: an
// e-fold of about 16 ticks, so a seam crossing eases in over a quarter second
// instead of tracking the camera x linearly. A paused run (no new tick) holds.
export const MOOD_RATE_PER_TICK = 0.06;
// A camera jump this far (respawn, world tour, a new run) snaps the mood.
export const MOOD_SNAP_UNITS = 900;
export const MOOD_KEYS = Object.freeze(['r', 'g', 'b', 'tintAlpha', 'vignette', 'glow', 'rain', 'ash', 'bright', 'night']);

const F = Object.freeze;
const TAU = Math.PI * 2;
const mood = ({ tint, tintAlpha, vignette, glow, rain = 0, ash = 0, bright, night = 0 }) => F({ tint, tintAlpha, vignette, glow, rain, ash, bright, night });

// The grade is applied with blendMode 'multiply' over the whole world, so a
// shadow shifts hue instead of greying: (1 - a) + a * tint per channel. Day
// districts carry a whisper of their accent; the two eastern districts fall
// into a neon-noir night (indigo and violet multiply, heavy vignette, full lamp
// glow) so the run reads as dusk falling as the player pushes east.
export const DISTRICT_MOOD = F({
  'frontier-relay': mood({ tint: 0x9cc4d4, tintAlpha: 0.08, vignette: 0.2, glow: 0.3, bright: 0.8 }),
  'rugpull-ravine': mood({ tint: 0xe4b484, tintAlpha: 0.1, vignette: 0.26, glow: 0.25, bright: 1 }),
  'liquidity-crossing': mood({ tint: 0x94bce4, tintAlpha: 0.08, vignette: 0.22, glow: 0.35, bright: 1 }),
  hashwood: mood({ tint: 0x74ac8c, tintAlpha: 0.12, vignette: 0.32, glow: 0.5, rain: 0.55, bright: 0.25 }),
  'mining-camp': mood({ tint: 0x3050e0, tintAlpha: 0.17, vignette: 0.44, glow: 0.9, ash: 0.85, bright: 0, night: 1 }),
  'liquidation-yard': mood({ tint: 0x6a28c8, tintAlpha: 0.18, vignette: 0.48, glow: 1, rain: 1, bright: 0, night: 1 }),
});

const channel = (color, shift) => (color >> shift) & 0xff;

/**
 * The positional mood target at world x: every district weighted by a linear
 * ramp across its 600-unit seam window (50/50 on the boundary), normalised.
 */
export function resolveMoodTarget({ districts, x } = {}) {
  if (!Array.isArray(districts) || !Number.isFinite(x)) throw new TypeError('districts and finite x required');
  const out = { r: 0, g: 0, b: 0, tintAlpha: 0, vignette: 0, glow: 0, rain: 0, ash: 0, bright: 0, night: 0 };
  let total = 0;
  for (const district of districts) {
    const spec = DISTRICT_MOOD[district.id];
    if (!spec) continue;
    const weight = Math.min(1, Math.max(0, Math.min(x - district.area.minX + MOOD_SEAM_UNITS, district.area.maxX + MOOD_SEAM_UNITS - x) / (2 * MOOD_SEAM_UNITS)));
    if (weight <= 0) continue;
    total += weight;
    out.r += channel(spec.tint, 16) * weight;
    out.g += channel(spec.tint, 8) * weight;
    out.b += channel(spec.tint, 0) * weight;
    for (const key of MOOD_KEYS.slice(3)) out[key] += spec[key] * weight;
  }
  if (total > 0) for (const key of MOOD_KEYS) out[key] /= total;
  return F(out);
}

/**
 * Exponential approach of the displayed mood toward the positional target.
 * State is presentation memory only; it advances by simulation ticks, never
 * by frames or time, and snaps on a new run or a long camera jump.
 */
export function createMoodState() {
  return { current: null, tick: -1, x: 0 };
}

export function stepMood(state, target, { tick, x } = {}) {
  if (!state || !target || !Number.isInteger(tick) || !Number.isFinite(x)) throw new TypeError('mood state, target, tick and x required');
  const snap = state.current === null || tick < state.tick || Math.abs(x - state.x) >= MOOD_SNAP_UNITS;
  if (snap) state.current = { ...target };
  else if (tick > state.tick) {
    const k = 1 - (1 - MOOD_RATE_PER_TICK) ** (tick - state.tick);
    for (const key of MOOD_KEYS) state.current[key] += (target[key] - state.current[key]) * k;
  }
  state.tick = tick;
  state.x = x;
  return state.current;
}

export function moodTintColor(current) {
  const byte = (value) => Math.max(0, Math.min(255, Math.round(value)));
  return (byte(current.r) << 16) | (byte(current.g) << 8) | byte(current.b);
}

/** The multiply grade the stage quad draws. */
export function resolveMoodGrade(current) {
  return F({ color: moodTintColor(current), alpha: Math.min(MOOD_TINT_MAX_ALPHA, Math.max(0, current.tintAlpha)), blendMode: 'multiply' });
}

/**
 * H4: the active mood as CSS custom properties for the DOM cockpit. Values
 * are quantised so the style is only touched when the mood actually moves.
 */
export function moodCssProperties(current) {
  const q = (value) => (Math.round(value * 100) / 100).toFixed(2);
  return F([
    ['--hmh-mood-tint', `#${moodTintColor(current).toString(16).padStart(6, '0')}`],
    ['--hmh-mood-tint-alpha', q(current.tintAlpha)],
    ['--hmh-mood-vignette', q(current.vignette)],
    ['--hmh-mood-glow', q(current.glow)],
    ['--hmh-mood-rain', q(current.rain)],
    ['--hmh-mood-ash', q(current.ash)],
    ['--hmh-mood-night', q(current.night)],
  ].map(F));
}

// ---------------------------------------------------------------------------
// C1b weather. Same hash family as world-atmosphere.mjs: FNV-1a of the
// district id mixed with the cell and slot by a murmur3 finaliser.
const districtSeeds = new Map();
function districtSeed(id) {
  let seed = districtSeeds.get(id);
  if (seed === undefined) {
    seed = 2166136261;
    for (let index = 0; index < id.length; index += 1) seed = Math.imul(seed ^ id.charCodeAt(index), 16777619) >>> 0;
    districtSeeds.set(id, seed);
  }
  return seed;
}
function finalizeMurmur(value) {
  let hash = value | 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}
export const weatherSeed = (id, col, row, index) => finalizeMurmur(districtSeed(id) ^ finalizeMurmur(col * 0x9e3779b1 + row * 0x85ebca6b + index * 0xc2b2ae35 + 0x6a09e667));
export const weatherUnit = (seed, lane) => finalizeMurmur(seed + lane * 0x9e3779b9) / 0x1_0000_0000;
const frac = (value) => value - Math.floor(value);

// rain: short straight streaks, no sway, a fast fall from `fall` world units
// to the ground. ash: slow flecks drifting down with a two-sine sway whose
// periods are incommensurate (ratio sqrt 2), so the path never visibly loops.
export const WEATHER = F({
  rain: F({ cell: 96, perCell: 1, period: 26, fall: 170, length: 19, width: 2.2, color: 0xc8dcff, alpha: 0.55 }),
  ash: F({ cell: 150, perCell: 1, period: 720, fall: 150, vx: 0.05, swayA: 11, swayB: 6, periodA: 173, size: 2.2, color: 0xcfc6bc, color2: 0xff9a70, alpha: 0.5 }),
});

export function resolveRainStreak({ districtId, col, row, index, tick } = {}) {
  if (![col, row, index, tick].every(Number.isInteger) || tick < 0 || index < 0) throw new TypeError('integer cell, slot and tick required');
  const spec = WEATHER.rain;
  const seed = weatherSeed(districtId, col, row, index);
  const phase = frac(weatherUnit(seed, 0) + tick / spec.period);
  return F({
    x: (col + weatherUnit(seed, 1)) * spec.cell,
    y: (row + weatherUnit(seed, 2)) * spec.cell,
    z: spec.fall * (1 - phase),
    gate: weatherUnit(seed, 6),
    alpha: spec.alpha * Math.min(1, phase * 8, (1 - phase) * 12),
  });
}

export function resolveAshFleck({ districtId, col, row, index, tick } = {}) {
  if (![col, row, index, tick].every(Number.isInteger) || tick < 0 || index < 0) throw new TypeError('integer cell, slot and tick required');
  const spec = WEATHER.ash;
  const seed = weatherSeed(districtId, col, row, index);
  const phase = frac(weatherUnit(seed, 0) + tick / spec.period);
  const age = phase * spec.period;
  const sway = spec.swayA * Math.sin(TAU * (tick / spec.periodA + weatherUnit(seed, 3)))
    + spec.swayB * Math.sin(TAU * (tick / (spec.periodA * Math.SQRT2) + weatherUnit(seed, 4)));
  const warm = weatherUnit(seed, 7) < 0.2;
  return F({
    x: (col + weatherUnit(seed, 1)) * spec.cell + spec.vx * age + sway,
    y: (row + weatherUnit(seed, 2)) * spec.cell,
    z: 6 + spec.fall * (1 - phase),
    gate: weatherUnit(seed, 6),
    size: spec.size * (0.6 + 0.4 * weatherUnit(seed, 5)),
    alpha: spec.alpha * Math.sin(Math.PI * phase),
    color: warm ? spec.color2 : spec.color,
  });
}

/**
 * Weather slots per frame, from the existing particle tier (desktop 10,
 * mobile 4, reduced motion 0): streaks/flecks get four times the tier and the
 * wet-ground sparkle one tier. The pool's own 64-sprite cap still binds.
 */
export function resolveWeatherBudget(profile) {
  const tier = profile?.particlesPerHazard;
  if (!Number.isInteger(tier) || tier < 0) throw new TypeError('particle tier required');
  return F({ weather: tier * 4, sparkle: tier });
}

function districtIdAt(districts, x) {
  for (const district of districts) if (x >= district.area.minX && x < district.area.maxX) return district.id;
  return districts.at(-1)?.id ?? '';
}

/**
 * Place rain streaks and ash flecks into the atmosphere pool around the
 * camera. Every slot has a fixed gate; a slot shows only when its gate is
 * under the effective density, which is the district density capped so the
 * expected count over the window fits the budget. Thinning is therefore
 * spread evenly over the frame (never a filled top and an empty bottom), and
 * a density change across a seam thins the weather slot by slot.
 */
export function renderWeather({ pool, districts, camera, view, tick, worldToScreen, current, budget, enabled = true } = {}) {
  const report = { rain: 0, ash: 0 };
  if (!enabled || !pool || !camera || !current || !budget || budget.weather <= 0) return report;
  const zoom = camera.zoom;
  const densityTotal = Math.max(0, current.rain) + Math.max(0, current.ash);
  if (densityTotal <= 0.04) return report;
  let placed = 0;
  for (const kind of ['rain', 'ash']) {
    const density = current[kind];
    if (!(density > 0.02)) continue;
    const spec = WEATHER[kind];
    const share = Math.floor(budget.weather * (density / densityTotal));
    const halfW = view.width / (2 * zoom) + 16;
    const top = view.height / (2 * zoom) + spec.fall + 16;
    const bottom = view.height / (2 * zoom) + 16;
    const minCol = Math.floor((camera.x - halfW) / spec.cell);
    const maxCol = Math.floor((camera.x + halfW) / spec.cell);
    const minRow = Math.floor((camera.y - bottom) / spec.cell);
    const maxRow = Math.floor((camera.y + top) / spec.cell);
    const slots = (maxCol - minCol + 1) * (maxRow - minRow + 1) * spec.perCell;
    const effective = Math.min(density, (0.92 * share) / Math.max(1, slots));
    let placedKind = 0;
    for (let row = minRow; row <= maxRow && placedKind < share; row += 1) {
      for (let col = minCol; col <= maxCol && placedKind < share; col += 1) {
        const districtId = districtIdAt(districts, (col + 0.5) * spec.cell);
        for (let index = 0; index < spec.perCell && placedKind < share; index += 1) {
          const body = kind === 'rain'
            ? resolveRainStreak({ districtId, col, row, index, tick })
            : resolveAshFleck({ districtId, col, row, index, tick });
          if (body.gate >= effective || body.alpha <= 0.01) continue;
          const screen = worldToScreen(body, camera, view);
          if (screen.x < -8 || screen.x > view.width + 8 || screen.y < -20 || screen.y > view.height + 20) continue;
          const ok = kind === 'rain'
            ? pool.place({ mote: false, x: screen.x, y: screen.y, width: spec.width * Math.max(0.75, zoom), height: spec.length * zoom, tint: spec.color, alpha: body.alpha })
            : pool.place({ mote: true, x: screen.x, y: screen.y, width: body.size * 2 * zoom, height: body.size * 2 * zoom, tint: body.color, alpha: body.alpha });
          if (!ok) return report;
          placed += 1;
          placedKind += 1;
          report[kind] += 1;
        }
      }
    }
  }
  return report;
}

// Wet-ground sparkle anchors: sampled once along every authored route (the
// travelled road) and on the roofs of the flat-roofed structures. Each anchor
// twinkles for an eighth of its own cycle while rain is falling.
const ROOF_LIFT = F({ 'miners-shack': 58, 'cargo-container': 44, 'watch-platform': 70, 'liquidation-terminal': 40 });
export function buildWetSparkleAnchors({ world, placements = [], spacing = 64 } = {}) {
  const nodes = new Map((world?.routeGraph?.nodes ?? []).map((node) => [node.id, node]));
  const xs = [], ys = [], zs = [];
  let serial = 0;
  for (const route of world?.routes ?? []) {
    const points = route.nodeIds.map((id) => nodes.get(id)).filter(Boolean);
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1], b = points[index];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!(length > 0)) continue;
      const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
      for (let d = spacing / 2; d < length; d += spacing) {
        const seed = weatherSeed(route.id, index, Math.floor(d), serial++);
        const side = (weatherUnit(seed, 1) - 0.5) * route.width * 0.8;
        xs.push(a.x + (b.x - a.x) * (d / length) + nx * side);
        ys.push(a.y + (b.y - a.y) * (d / length) + ny * side);
        zs.push(0);
      }
    }
  }
  for (const placement of placements) {
    const lift = ROOF_LIFT[placement.assetId];
    if (!lift) continue;
    for (let index = 0; index < 3; index += 1) {
      const seed = weatherSeed(placement.id, index, 0, serial++);
      xs.push(placement.x + (weatherUnit(seed, 1) - 0.5) * 40);
      ys.push(placement.y - 4 - weatherUnit(seed, 2) * 10);
      zs.push(lift);
    }
  }
  return F({ x: Float64Array.from(xs), y: Float64Array.from(ys), z: Float64Array.from(zs), count: xs.length });
}

export function renderWetSparkle({ pool, anchors, camera, view, tick, worldToScreen, current, budget, queryGround = null, enabled = true } = {}) {
  let placed = 0;
  if (!enabled || !pool || !anchors || !current || !budget || budget.sparkle <= 0 || current.rain <= 0.05) return placed;
  const zoom = camera.zoom;
  const halfW = view.width / (2 * zoom), halfH = view.height / (2 * zoom) + 80;
  const point = { x: 0, y: 0, z: 0 };
  for (let index = 0; index < anchors.count; index += 1) {
    const x = anchors.x[index], y = anchors.y[index];
    if (Math.abs(x - camera.x) > halfW || Math.abs(y - camera.y) > halfH) continue;
    const phase = frac(weatherUnit(index * 0x9e37 + 0x51ed, 0) + tick / 53);
    const twinkle = Math.max(0, 1 - Math.abs(phase - 0.5) * 8);
    if (twinkle <= 0) continue;
    point.x = x;
    point.y = y;
    point.z = anchors.z[index] + (queryGround ? queryGround(x, y).groundZ : 0);
    const screen = worldToScreen(point, camera, view);
    const size = (2.4 + 2.2 * twinkle) * zoom;
    if (!pool.place({ mote: true, x: screen.x, y: screen.y, width: size, height: size, tint: 0xdce8ff, alpha: 0.75 * twinkle * Math.min(1, current.rain * 1.4) })) break;
    placed += 1;
    if (placed >= budget.sparkle) break;
  }
  return placed;
}

// ---------------------------------------------------------------------------
// D2 micro-life: blinks and 1 px idle bobs from three co-prime periods with a
// per-entity phase hashed from its id. Zero RNG draws.
export const MICRO_LIFE_PERIODS = F([22, 34, 57]);
const idPhases = new Map();
export function microLifePhase(id) {
  const key = String(id);
  let phase = idPhases.get(key);
  if (phase === undefined) {
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0;
    phase = finalizeMurmur(hash);
    if (idPhases.size > 4096) idPhases.clear();
    idPhases.set(key, phase);
  }
  return phase;
}

export function microLifeBob(id, tick) {
  const phase = microLifePhase(id);
  const [a, b, c] = MICRO_LIFE_PERIODS;
  const up = ((tick + phase) % a < a / 2 ? 1 : 0) + ((tick + (phase >>> 5)) % b < b / 2 ? 1 : 0) + ((tick + (phase >>> 11)) % c < c / 2 ? 1 : 0);
  return up >= 2 ? 1 : 0;
}

// A blink lands where the fast and slow cycles both roll over: rare,
// irregular to the eye, and exactly reproducible.
export function microLifeBlink(id, tick) {
  const phase = microLifePhase(id);
  const [a, , c] = MICRO_LIFE_PERIODS;
  return (tick + phase) % a < 2 && (tick + (phase >>> 11)) % c < 9;
}

export function resolveMicroLife(id, tick) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick required');
  return F({ bob: microLifeBob(id, tick), blink: microLifeBlink(id, tick) });
}
