import { isScreenPointVisible } from './runtime-performance.mjs';
import { createWeaponVfxPool } from './weapon-vfx.mjs';

// Projection-only weather and atmosphere (W-13): drifting low fog banks, one
// kind of airborne mote per district (embers, pollen, dust, river mist) and a
// per-district colour grade. Every position, alpha and colour here is a pure
// function of the district, a world lattice cell, a slot index and the
// simulation tick. Nothing reads the wall clock or any RNG, so a paused frame
// is frozen, two certification anchors match byte for byte and same-seed
// replays draw the same sky.
//
// The layer sits above the ground, props, enemies and the hero and below every
// HUD element. It is capped inside the existing world particle tiers (desktop
// 50 / mobile 30 / reduced-motion 0) and writes nothing back to the run.
export const WORLD_ATMOSPHERE_ART_ID = 'projection-world-atmosphere-v1';
export const MAX_ATMOSPHERE_SPRITES = 64;
export const ATMOSPHERE_TINT_MAX_ALPHA = 0.05;
export const ATMOSPHERE_FOG_MAX_ALPHA = 0.14;
// Half-width of the colour-grade blend either side of a district boundary.
export const ATMOSPHERE_SEAM_UNITS = 300;
// Fog hangs between the camera and the ground, so it slides a little faster
// than the ground when the camera pans: a fixed fraction of the bank's offset
// from the view centre, which depends on nothing but the camera.
const FOG_PARALLAX = 0.06;

const F = Object.freeze;
const TAU = Math.PI * 2;

// fog: colour, ceiling alpha, lattice cell [w, h], ellipse radii [rx, ry] in
// world units, drift speed (units / tick) along `axis` (0 = x, 1 = y), lift
// above the ground plane, optional anchor rect [minX, minY, maxX, maxY] that
// must lie inside the district.
const fog = (color, alpha, cell, size, speed, axis, lift, area = null) => F({ color, alpha, cell: F(cell), size: F(size), speed, axis, lift, area: area && F(area) });
// mote: birth colour, optional colour it cools toward, ceiling alpha, square
// lattice cell, motes per cell, radius in px at zoom 1 (the ceiling; a slot
// draws at 70 to 100 percent of it), drift (units / tick; negative vy rises),
// sway amplitude and period, lifecycle period in ticks, fade shape (0
// symmetric, 1 ember: fast in, linear out with height), lift.
const mote = (color, color2, alpha, cell, perCell, size, vx, vy, sway, swayPeriod, period, fade, lift) => F({ color, color2, alpha, cell, perCell, size, vx, vy, sway, swayPeriod, period, fade, lift });
const tint = (color, alpha) => F({ color, alpha });

// Per-district identity from ART-DIRECTION-GAMEWORLD.md: fog colour stays
// within the ground band so actors remain the brightest saturated thing; the
// grade is the district accent mixed toward its ground colour at a whisper.
// Motes are additive, so they can only ever add light: they brighten a few
// pixels and can never mask an enemy, a pickup or the route.
export const DISTRICT_ATMOSPHERE = F({
  'frontier-relay': F({ fog: fog(0x6f9c96, 0.12, [960, 720], [340, 110], 0.25, 0, 8), mote: null, tint: tint(0x25869a, 0.03) }),
  'rugpull-ravine': F({ fog: null, mote: mote(0xf0c8a0, null, 0.55, 320, 2, 2.8, 0.35, 0.02, 8, 160, 420, 0, 18), tint: tint(0x9d6c3a, 0.035) }),
  'liquidity-crossing': F({ fog: fog(0xbfd3e6, 0.14, [500, 640], [230, 90], 0.45, 1, 12, [4_500, 0, 5_000, 4_800]), mote: null, tint: tint(0x678698, 0.03) }),
  hashwood: F({ fog: fog(0x5c8f6a, 0.10, [960, 720], [380, 130], 0.18, 0, 20), mote: mote(0xe6ffb0, null, 0.6, 320, 2, 3, 0.02, 0.12, 26, 200, 600, 0, 30), tint: tint(0x4a9675, 0.03) }),
  'mining-camp': F({ fog: fog(0x8e8a80, 0.11, [960, 720], [320, 96], 0.35, 0, 6), mote: mote(0xd0ccc0, null, 0.5, 320, 2, 2.6, 0.25, 0.01, 10, 140, 420, 0, 14), tint: tint(0x927242, 0.025) }),
  'liquidation-yard': F({ fog: fog(0x4a2536, 0.12, [960, 720], [300, 120], 0.2, 0, 30), mote: mote(0xffa060, 0xff5a80, 0.6, 320, 2, 3, 0.15, -0.9, 14, 90, 240, 1, 10), tint: tint(0x9e3757, 0.035) }),
});

function int(value, min = -Infinity) {
  if (!Number.isInteger(value) || value < min) throw new TypeError('integer required');
  return value;
}

// FNV-1a over the district id (same form as the runtime's deterministicUnit),
// cached per id; a murmur3 finaliser mixes it with the cell and slot so
// neighbouring cells are decorrelated instead of shifted copies.
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
const cellSeed = (id, col, row, index) => finalizeMurmur(districtSeed(id) ^ finalizeMurmur(col * 0x9e3779b1 + row * 0x85ebca6b + index * 0xc2b2ae35 + 0x2545f491));
const unit = (seed, lane) => finalizeMurmur(seed + lane * 0x9e3779b9) / 0x1_0000_0000;
const frac = (value) => value - Math.floor(value);
const channel = (color, shift) => (color >> shift) & 0xff;
const lerpChannel = (from, to, t, shift) => Math.round(channel(from, shift) + (channel(to, shift) - channel(from, shift)) * t) << shift;
const lerpColor = (from, to, t) => lerpChannel(from, to, t, 16) | lerpChannel(from, to, t, 8) | lerpChannel(from, to, t, 0);

/**
 * One fog bank per lattice cell. It is born at one edge of its cell, drifts
 * across along the district axis and dissolves before it wraps, so the wrap
 * never pops; the cross-axis position and the phase are per-cell.
 */
export function resolveFogBank({ districtId, spec, col, row, tick } = {}) {
  const seed = cellSeed(districtId, int(col), int(row), 0);
  int(tick, 0);
  const span = spec.cell[spec.axis];
  const cross = spec.cell[1 - spec.axis];
  const phase = frac(unit(seed, 0) + (tick * spec.speed) / span);
  const along = ((spec.axis === 0 ? col : row) + phase) * span;
  const across = ((spec.axis === 0 ? row : col) + 0.25 + 0.5 * unit(seed, 1)) * cross
    + Math.sin(TAU * (tick / (420 + 180 * unit(seed, 2)) + unit(seed, 3))) * 10;
  return F({
    x: spec.axis === 0 ? along : across,
    y: spec.axis === 0 ? across : along,
    z: spec.lift,
    rx: spec.size[0] * (0.8 + 0.4 * unit(seed, 5)),
    ry: spec.size[1] * (0.8 + 0.4 * unit(seed, 6)),
    alpha: spec.alpha * Math.sin(Math.PI * phase) * (0.8 + 0.2 * unit(seed, 4)),
    color: spec.color,
  });
}

/**
 * One mote per (cell, slot). Each lives on its own repeating lifecycle: born
 * at a per-slot point in the cell, carried by the district drift and sway,
 * fading in and out (embers fade with height and flicker).
 */
export function resolveMote({ districtId, spec, col, row, index, tick } = {}) {
  const seed = cellSeed(districtId, int(col), int(row), int(index, 0));
  int(tick, 0);
  const phase = frac(unit(seed, 0) + tick / spec.period);
  const age = phase * spec.period;
  const envelope = spec.fade === 1
    ? (1 - phase) * Math.min(1, phase * 8) * (0.75 + 0.25 * Math.sin(tick * 0.31 + unit(seed, 4) * TAU))
    : Math.sin(Math.PI * phase);
  return F({
    x: (col + unit(seed, 1)) * spec.cell + spec.vx * age + Math.sin(TAU * (tick / spec.swayPeriod + unit(seed, 3))) * spec.sway,
    y: (row + unit(seed, 2)) * spec.cell + spec.vy * age,
    z: spec.lift,
    size: spec.size * (0.7 + 0.3 * unit(seed, 5)),
    alpha: spec.alpha * envelope,
    color: spec.color2 === null ? spec.color : lerpColor(spec.color, spec.color2, phase),
  });
}

/**
 * Fog banks per frame follow the hazard particle tier and motes get three
 * times that, so the layer lives inside the budget the perf smoke already
 * asserts (desktop 10 + 30 of 50, mobile 6 + 18 of 30) and the reduced-motion
 * tier yields nothing without a special case.
 */
export function resolveAtmosphereBudget(profile) {
  const tier = int(profile?.particlesPerHazard, 0);
  return F({ fog: Math.min(tier, 16), motes: Math.min(tier * 3, MAX_ATMOSPHERE_SPRITES - 16) });
}

/**
 * The district colour grade at a world x. Weights ramp linearly across a
 * 600-unit window centred on each boundary (50/50 on the boundary itself), so
 * walking between districts never pops the grade.
 */
export function resolveAtmosphereTint({ districts, x } = {}) {
  if (!Array.isArray(districts) || !Number.isFinite(x)) throw new TypeError('districts and finite x required');
  const sum = [0, 0, 0, 0, 0];
  for (const district of districts) {
    const spec = DISTRICT_ATMOSPHERE[district.id]?.tint;
    const weight = spec ? Math.min(1, Math.max(0, Math.min(x - district.area.minX + ATMOSPHERE_SEAM_UNITS, district.area.maxX + ATMOSPHERE_SEAM_UNITS - x) / (2 * ATMOSPHERE_SEAM_UNITS))) : 0;
    if (weight <= 0) continue;
    for (let lane = 0; lane < 3; lane += 1) sum[lane] += channel(spec.color, 16 - 8 * lane) * weight;
    sum[3] += spec.alpha * weight;
    sum[4] += weight;
  }
  const total = sum[4];
  return F({
    color: total > 0 ? (Math.round(sum[0] / total) << 16) | (Math.round(sum[1] / total) << 8) | Math.round(sum[2] / total) : 0,
    alpha: sum[3],
  });
}

/**
 * Bake the two white textures once, after the renderer exists: a soft haze
 * ellipse and a mote disc with a dense core so a 4 to 6 px sprite still reads
 * as a speck. Per-sprite tint colours them. The vendor export has no gradient
 * fill, so concentric rings are the available way.
 */
export function createAtmosphereTextures({ renderer, GraphicsClass } = {}) {
  if (typeof renderer?.generateTexture !== 'function') throw new TypeError('renderer required');
  if (typeof GraphicsClass !== 'function') throw new TypeError('GraphicsClass required');
  const bake = (rings, draw) => {
    const graphic = new GraphicsClass();
    for (let ring = 0; ring < rings; ring += 1) draw(graphic, 1 - ring / rings, ring === rings - 1);
    const texture = renderer.generateTexture({ target: graphic, resolution: 2, antialias: true });
    graphic.destroy();
    return texture;
  };
  return F({
    haze: bake(12, (graphic, scale) => graphic.ellipse(0, 0, 64 * scale, 24 * scale).fill({ color: 0xffffff, alpha: 0.12 })),
    mote: bake(8, (graphic, scale, core) => graphic.circle(0, 0, 6 * scale).fill({ color: 0xffffff, alpha: core ? 1 : 0.3 })),
  });
}

/**
 * A frame-scoped pool in two banks, normal-blended fog under additive motes.
 * The two-bank sprite pool already shipped for the weapon VFX is the engine;
 * this only binds the atmosphere textures and names. `begin()` opens a frame,
 * `place()` claims a sprite, `finish()` hides what the frame did not claim.
 */
export function createAtmospherePool({ ContainerClass, SpriteClass, textures, max = MAX_ATMOSPHERE_SPRITES } = {}) {
  if (!textures?.haze || !textures?.mote) throw new TypeError('atmosphere textures required');
  const pool = createWeaponVfxPool({ ContainerClass, SpriteClass, textures: { core: textures.mote, puff: textures.haze, shell: textures.haze }, max });
  pool.container.label = 'world-atmosphere';
  return F({
    artId: WORLD_ATMOSPHERE_ART_ID,
    runtimeAuthority: 'projection-only',
    container: pool.container,
    begin: pool.begin,
    finish: pool.finish,
    place: ({ mote: airborne = false, x, y, width, height, tint: color, alpha } = {}) => alpha > 0.002
      && pool.place({ texture: airborne ? 'core' : 'puff', x, y, width, height, tint: color, alpha, additive: airborne }),
    get placed() { return pool.placed; },
    get dropped() { return pool.dropped; },
  });
}

// Visit the lattice cells of `area` that the padded camera window touches,
// nearest the camera first (Chebyshev rings), so a budget that runs out drops
// the far ring in the cull margin rather than a corner of the screen. A cell
// belongs to the area whose half-open range holds its centre, so two
// districts never both dress one seam cell.
function visitLattice(area, cellW, cellH, camera, spanX, spanY, visit) {
  const minX = Math.max(area.minX, camera.x - spanX);
  const maxX = Math.min(area.maxX, camera.x + spanX);
  const minY = Math.max(area.minY, camera.y - spanY);
  const maxY = Math.min(area.maxY, camera.y + spanY);
  if (minX >= maxX || minY >= maxY) return;
  const minCol = Math.floor(minX / cellW);
  const maxCol = Math.ceil(maxX / cellW) - 1;
  const minRow = Math.floor(minY / cellH);
  const maxRow = Math.ceil(maxY / cellH) - 1;
  const centreCol = Math.min(Math.max(Math.floor(camera.x / cellW), minCol), maxCol);
  const centreRow = Math.min(Math.max(Math.floor(camera.y / cellH), minRow), maxRow);
  const radius = Math.max(centreCol - minCol, maxCol - centreCol, centreRow - minRow, maxRow - centreRow);
  for (let ring = 0; ring <= radius; ring += 1) {
    for (let col = Math.max(minCol, centreCol - ring); col <= Math.min(maxCol, centreCol + ring); col += 1) {
      for (let row = Math.max(minRow, centreRow - ring); row <= Math.min(maxRow, centreRow + ring); row += 1) {
        if (Math.max(Math.abs(col - centreCol), Math.abs(row - centreRow)) !== ring) continue;
        const centreX = (col + 0.5) * cellW;
        const centreY = (row + 0.5) * cellH;
        if (centreX < area.minX || centreX >= area.maxX || centreY < area.minY || centreY >= area.maxY) continue;
        if (visit(col, row) === false) return;
      }
    }
  }
}

/**
 * The per-frame pass. Places fog banks and motes for every district the
 * padded camera window touches, culls each to the screen, and reports what
 * it placed and what the pool dropped. Disabled (reduce motion) places
 * nothing; the caller's begin/finish then hides every pooled sprite.
 */
export function renderWorldAtmosphere({ pool, districts, camera, view, tick, worldToScreen, budget, cullMargin = 0, enabled = true } = {}) {
  const report = { fog: 0, motes: 0, dropped: 0 };
  if (!enabled || !pool || !camera || !budget || (budget.fog <= 0 && budget.motes <= 0)) return F(report);
  int(tick, 0);
  const zoom = camera.zoom;
  const halfW = view.width / (2 * zoom);
  const halfH = view.height / (2 * zoom);
  // One placement routine for both kinds. The lattice window is padded by the
  // profile cull margin plus the sprite reach so every cell that could touch
  // the frame is visited, but each sprite is then culled by its own screen
  // half-extent after the parallax shift: a bank is placed exactly when some
  // part of it is on screen, so nothing pops at the edge and no budget is
  // spent on a bank or a mote the player cannot see.
  const scatter = (area, cellW, cellH, padX, padY, key, perCell, resolve) => {
    const airborne = key === 'motes';
    visitLattice(area, cellW, cellH, camera, halfW + padX, halfH + padY, (col, row) => {
      for (let index = 0; index < perCell; index += 1) {
        if (report[key] >= budget[key]) return false;
        const body = resolve(col, row, index);
        const screen = worldToScreen(body, camera, view);
        if (!airborne) {
          screen.x += (screen.x - view.width / 2) * FOG_PARALLAX;
          screen.y += (screen.y - view.height / 2) * FOG_PARALLAX;
        }
        const half = airborne ? body.size : body.rx;
        if (!isScreenPointVisible(screen, view, half * zoom)) continue;
        if (pool.place({ mote: airborne, x: screen.x, y: screen.y, width: half * 2 * zoom, height: (airborne ? body.size : body.ry) * 2 * zoom, tint: body.color, alpha: body.alpha })) report[key] += 1;
      }
      return true;
    });
  };
  for (const district of districts) {
    const spec = DISTRICT_ATMOSPHERE[district.id];
    if (!spec) continue;
    const area = district.area;
    if (spec.fog && report.fog < budget.fog) {
      const bankSpec = spec.fog;
      const reach = Math.max(bankSpec.size[0], bankSpec.size[1]) * 1.2;
      const pad = cullMargin / zoom + reach;
      // An authored anchor (the river rect) lies inside its district by
      // construction, so it replaces the district area outright.
      const anchor = bankSpec.area ? { minX: bankSpec.area[0], minY: bankSpec.area[1], maxX: bankSpec.area[2], maxY: bankSpec.area[3] } : area;
      scatter(anchor, bankSpec.cell[0], bankSpec.cell[1], pad, pad, 'fog', 1, (col, row) => resolveFogBank({ districtId: district.id, spec: bankSpec, col, row, tick }));
    }
    if (spec.mote && report.motes < budget.motes) {
      const moteSpec = spec.mote;
      const reach = moteSpec.size * 2;
      scatter(area, moteSpec.cell, moteSpec.cell, reach + moteSpec.sway + Math.abs(moteSpec.vx) * moteSpec.period, reach + Math.abs(moteSpec.vy) * moteSpec.period, 'motes', moteSpec.perCell,
        (col, row, index) => resolveMote({ districtId: district.id, spec: moteSpec, col, row, index, tick }));
    }
  }
  report.dropped = pool.dropped;
  return F(report);
}
