// 1.9.0 world pass (A4 mood, H4 CSS mirror, C1b weather, C2 water, C4
// ambient life, A2b prop fade, D2 micro-life). Every piece is projection-only:
// these tests pin purity (same inputs, same output; no clock, no RNG), the
// caps, the lazy boundary and the scene-graph placement.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DISTRICT_MOOD, MICRO_LIFE_PERIODS, MOOD_KEYS, MOOD_RATE_PER_TICK, MOOD_SEAM_UNITS, MOOD_SNAP_UNITS, MOOD_TINT_MAX_ALPHA, WEATHER,
  buildWetSparkleAnchors, createMoodState, microLifeBlink, microLifeBob, moodCssProperties, moodTintColor, renderWeather,
  renderWetSparkle, resolveAshFleck, resolveMicroLife, resolveMoodGrade, resolveMoodTarget, resolveRainStreak, resolveWeatherBudget, stepMood,
} from '../apps/hmh-reboot/src/world-mood.mjs';
import {
  DEEP_UNITS, FOAM_BANDS, SHALLOWS_UNITS, buildShoreField, buildShoreSegments, createWaterFx, exposedShoreEdges, fieldRects,
  foamSpan, resolveFoamBand, waterContains, waterCoverRects, waterSparkleAnchors,
} from '../apps/hmh-reboot/src/world-water-fx.mjs';
import {
  AMBIENT_STEP_TICKS, SCORCH_FULL_KILLS, buildAmbientSources, buildScorchMarks, createAmbientFx, createKillTracker, createSpritePool,
  resolveAmbientBudget, resolveSmokePuff, selectNearestLamps, signageFrame,
} from '../apps/hmh-reboot/src/world-ambient-fx.mjs';
import { causticPixels, glowPixels, scorchPixels, vignettePixels } from '../apps/hmh-reboot/src/world-fx-textures.mjs';
import { createWorldFx } from '../apps/hmh-reboot/src/world-fx.mjs';
import { PROP_FADE_ALPHA, PROP_FADE_FRAMES, bannerFlutter, propFadeAlpha, propHidesFocus, stepPropFade } from '../apps/hmh-reboot/src/authored-prop-display.mjs';
import { exposedWaterEdges, waterAreaContains } from '../apps/hmh-reboot/src/world-design-water.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { RUNTIME_PERFORMANCE_PROFILES } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';

const districts = LEVEL_ONE_WORLD.districts;
const DESKTOP = Object.freeze({ width: 1440, height: 900 });
const MOBILE = Object.freeze({ width: 390, height: 844 });
const camera = (x, y, zoom = 1) => ({ x, y, zoom, shakeX: 0, shakeY: 0 });
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
const src = (name) => new URL(`../apps/hmh-reboot/src/${name}`, import.meta.url);

class FakePoint { constructor() { this.x = 0; this.y = 0; } set(x, y = x) { this.x = x; this.y = y; } }
class FakeContainer {
  constructor() { this.children = []; this.visible = true; this.label = ''; this.blendMode = 'normal'; this.position = new FakePoint(); this.scale = new FakePoint(); this.scale.set(1); this.parent = null; }
  addChild(...children) { for (const child of children) { child.parent = this; this.children.push(child); } return children.at(-1); }
  addChildAt(child, index) { child.parent = this; this.children.splice(index, 0, child); return child; }
  getChildIndex(child) { return this.children.indexOf(child); }
}
class FakeSprite extends FakeContainer {
  constructor({ texture } = {}) { super(); this.texture = texture; this.anchor = new FakePoint(); this.alpha = 1; this.width = 0; this.height = 0; this.tint = 0xffffff; this.rotation = 0; }
}
class FakeGraphics extends FakeContainer {
  constructor() { super(); this.ops = []; }
  rect(...args) { this.ops.push(['rect', ...args]); return this; }
  moveTo(...args) { this.ops.push(['moveTo', ...args]); return this; }
  lineTo(...args) { this.ops.push(['lineTo', ...args]); return this; }
  fill(options) { this.ops.push(['fill', options]); return this; }
  stroke(options) { this.ops.push(['stroke', options]); return this; }
  clear() { this.ops.length = 0; return this; }
}
class FakeTiling extends FakeSprite {
  constructor(options) { super(options); this.width = options.width; this.height = options.height; this.tilePosition = new FakePoint(); this.tileScale = new FakePoint(); }
}
const fakeTexture = (id) => ({ id });
class FakeTexture { static from(canvas) { return { id: `canvas-${canvas.width}x${canvas.height}` }; } }
const fakeDocument = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }),
};
globalThis.ImageData ??= class { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } };

const recordingPool = (max = 64) => {
  const placed = [];
  return {
    placedList: placed,
    get placed() { return placed.length; },
    place(entry) { if (placed.length >= max || !(entry.alpha > 0.002)) return false; placed.push(entry); return true; },
  };
};

test('the mood table covers every district, caps the multiply grade at 0.18 and has a neon-noir night east', () => {
  assert.deepEqual(Object.keys(DISTRICT_MOOD).sort(), districts.map((district) => district.id).sort());
  assert.equal(MOOD_TINT_MAX_ALPHA, 0.18);
  assert.equal(Object.isFrozen(DISTRICT_MOOD), true);
  for (const [id, spec] of Object.entries(DISTRICT_MOOD)) {
    assert.equal(Object.isFrozen(spec), true);
    assert.ok(spec.tintAlpha > 0 && spec.tintAlpha <= MOOD_TINT_MAX_ALPHA, `${id} tint alpha`);
    for (const key of ['vignette', 'glow', 'rain', 'ash', 'bright', 'night']) assert.ok(spec[key] >= 0 && spec[key] <= 1, `${id} ${key}`);
  }
  const nights = Object.entries(DISTRICT_MOOD).filter(([, spec]) => spec.night === 1).map(([id]) => id);
  assert.ok(nights.length >= 2, 'at least two districts fall into the neon-noir night palette');
  for (const id of nights) {
    assert.ok(DISTRICT_MOOD[id].glow >= 0.9 && DISTRICT_MOOD[id].vignette >= 0.4, `${id} night carries full lamp glow and a heavy vignette`);
    const tint = DISTRICT_MOOD[id].tint;
    assert.ok((tint & 0xff) > ((tint >> 16) & 0xff), `${id} night grade leans blue/violet`);
  }
  assert.ok(Object.values(DISTRICT_MOOD).some((spec) => spec.rain > 0) && Object.values(DISTRICT_MOOD).some((spec) => spec.ash > 0));
});

test('the positional mood target is pure, exact inside a district and 50/50 on a boundary', () => {
  const inside = resolveMoodTarget({ districts, x: 11_000 });
  assert.deepEqual(inside, resolveMoodTarget({ districts, x: 11_000 }));
  assert.equal(Object.isFrozen(inside), true);
  assert.equal(moodTintColor(inside), DISTRICT_MOOD['liquidation-yard'].tint);
  assert.equal(inside.tintAlpha, DISTRICT_MOOD['liquidation-yard'].tintAlpha);
  const seam = resolveMoodTarget({ districts, x: 10_000 });
  assert.ok(Math.abs(seam.night - 1) < 1e-9, 'both sides of the camp/yard seam are night');
  const dusk = resolveMoodTarget({ districts, x: 8_000 });
  assert.ok(Math.abs(dusk.night - 0.5) < 1e-9, 'the hashwood/camp boundary is half night');
  assert.ok(Math.abs(dusk.rain - DISTRICT_MOOD.hashwood.rain / 2) < 1e-9);
  assert.deepEqual(resolveMoodTarget({ districts, x: 8_000 + MOOD_SEAM_UNITS }).night, 1);
  let previous = resolveMoodTarget({ districts, x: 0 });
  for (let x = 4; x <= 12_000; x += 4) {
    const current = resolveMoodTarget({ districts, x });
    for (const key of MOOD_KEYS) assert.ok(Math.abs(current[key] - previous[key]) < (key.length === 1 ? 1.5 : 0.01), `${key} jumped at x ${x}`);
    previous = current;
  }
  assert.throws(() => resolveMoodTarget({ districts, x: Number.NaN }), TypeError);
});

test('the displayed mood approaches the target exponentially per tick, holds while paused and snaps on a jump or new run', () => {
  const state = createMoodState();
  const day = resolveMoodTarget({ districts, x: 7_000 });
  const night = resolveMoodTarget({ districts, x: 9_000 });
  assert.deepEqual(stepMood(state, day, { tick: 10, x: 7_000 }), { ...day }, 'the first frame snaps');
  const one = stepMood(state, night, { tick: 11, x: 7_500 }).night;
  assert.ok(Math.abs(one - MOOD_RATE_PER_TICK) < 1e-9, `one tick moves one rate step (${one})`);
  assert.equal(stepMood(state, night, { tick: 11, x: 7_500 }).night, one, 'a paused frame (same tick) holds');
  const five = stepMood(state, night, { tick: 16, x: 7_500 }).night;
  assert.ok(Math.abs(five - (1 - (1 - MOOD_RATE_PER_TICK) ** 6)) < 1e-9, 'skipped ticks compound exactly');
  const later = stepMood(state, night, { tick: 200, x: 7_500 }).night;
  assert.ok(later > 0.999, 'it converges');
  assert.equal(stepMood(state, day, { tick: 201, x: 7_500 + MOOD_SNAP_UNITS }).night, 0, 'a long camera jump snaps');
  stepMood(state, night, { tick: 202, x: 7_500 + MOOD_SNAP_UNITS });
  assert.equal(stepMood(state, day, { tick: 3, x: 7_500 + MOOD_SNAP_UNITS }).night, 0, 'a new run (tick going back) snaps');
});

test('the grade is a multiply quad under the cap and the cockpit mirror is --hmh-mood-* custom properties', () => {
  const night = resolveMoodTarget({ districts, x: 11_000 });
  const grade = resolveMoodGrade(night);
  assert.equal(grade.blendMode, 'multiply');
  assert.equal(grade.color, DISTRICT_MOOD['liquidation-yard'].tint);
  assert.ok(grade.alpha <= MOOD_TINT_MAX_ALPHA);
  const css = moodCssProperties(night);
  assert.deepEqual(css.map(([name]) => name), ['--hmh-mood-tint', '--hmh-mood-tint-alpha', '--hmh-mood-vignette', '--hmh-mood-glow', '--hmh-mood-rain', '--hmh-mood-ash', '--hmh-mood-night']);
  assert.equal(css[0][1], '#6a28c8');
  assert.equal(css[6][1], '1.00');
});

test('rain streaks fall straight, ash drifts on two incommensurate sines; both are pure in district, cell, slot and tick', async () => {
  const at = (tick) => resolveRainStreak({ districtId: 'liquidation-yard', col: 110, row: 8, index: 0, tick });
  assert.deepEqual(at(40), at(40));
  assert.equal(Object.isFrozen(at(40)), true);
  const xs = new Set(), zs = [];
  for (let tick = 0; tick < WEATHER.rain.period; tick += 1) { xs.add(at(tick).x); zs.push(at(tick).z); }
  assert.equal(xs.size, 1, 'rain has no sway');
  assert.ok(Math.max(...zs) - Math.min(...zs) > WEATHER.rain.fall * 0.9, 'a streak falls its whole height in one period');
  assert.notEqual(resolveRainStreak({ districtId: 'liquidation-yard', col: 111, row: 8, index: 0, tick: 40 }).x - WEATHER.rain.cell, at(40).x, 'cells are decorrelated');
  const ash = (tick) => resolveAshFleck({ districtId: 'mining-camp', col: 60, row: 10, index: 0, tick });
  assert.deepEqual(ash(500), ash(500));
  const drift = [];
  for (let tick = 0; tick < 700; tick += 1) drift.push(ash(tick + 1).x - ash(tick).x);
  assert.ok(drift.filter((step) => Math.abs(step) >= 1).length <= 1, 'ash is slow (one lifecycle wrap at most)');
  const source = stripComments(await readFile(src('world-mood.mjs'), 'utf8'));
  assert.match(source, /Math\.SQRT2/u, 'the second sway period is the first times sqrt 2');
  assert.throws(() => resolveRainStreak({ districtId: 'x', col: 0.5, row: 0, index: 0, tick: 0 }), TypeError);
  assert.throws(() => resolveAshFleck({ districtId: 'x', col: 0, row: 0, index: 0, tick: -1 }), TypeError);
});

test('weather lives inside the particle tiers, is deterministic, spread over the whole frame and off under reduced motion', () => {
  assert.deepEqual(resolveWeatherBudget(RUNTIME_PERFORMANCE_PROFILES.desktop), { weather: 40, sparkle: 10 });
  assert.deepEqual(resolveWeatherBudget(RUNTIME_PERFORMANCE_PROFILES.mobile), { weather: 16, sparkle: 4 });
  assert.deepEqual(resolveWeatherBudget(RUNTIME_PERFORMANCE_PROFILES.reducedMotion), { weather: 0, sparkle: 0 });
  const run = (options) => {
    const pool = recordingPool();
    const report = renderWeather({ pool, districts, worldToScreen, tick: 300, ...options });
    return { pool, report };
  };
  const yard = resolveMoodTarget({ districts, x: 11_000 });
  const a = run({ camera: camera(11_000, 2_000), view: DESKTOP, current: yard, budget: { weather: 40 } });
  const b = run({ camera: camera(11_000, 2_000), view: DESKTOP, current: yard, budget: { weather: 40 } });
  assert.deepEqual(a.pool.placedList, b.pool.placedList);
  assert.ok(a.report.rain > 12 && a.report.rain <= 40, `yard rain ${a.report.rain}`);
  assert.equal(a.report.ash, 0);
  const ys = a.pool.placedList.map((entry) => entry.y);
  assert.ok(ys.some((y) => y < DESKTOP.height / 3) && ys.some((y) => y > (DESKTOP.height * 2) / 3), 'streaks cover the top and the bottom of the frame');
  for (const entry of a.pool.placedList) {
    assert.equal(entry.mote, false, 'rain draws in the normal bank');
    assert.ok(entry.height > entry.width * 4, 'a streak is tall and thin');
  }
  const camp = run({ camera: camera(9_000, 2_000), view: MOBILE, current: resolveMoodTarget({ districts, x: 9_000 }), budget: { weather: 16 } });
  assert.ok(camp.report.ash > 0 && camp.report.ash <= 16 && camp.report.rain === 0);
  assert.ok(camp.pool.placedList.every((entry) => entry.mote === true), 'ash flecks are additive specks');
  const day = run({ camera: camera(900, 2_000), view: DESKTOP, current: resolveMoodTarget({ districts, x: 900 }), budget: { weather: 40 } });
  assert.deepEqual(day.report, { rain: 0, ash: 0 }, 'a dry district draws no weather');
  const off = run({ camera: camera(11_000, 2_000), view: DESKTOP, current: yard, budget: { weather: 40 }, enabled: false });
  assert.deepEqual(off.report, { rain: 0, ash: 0 });
  const full = recordingPool(3);
  renderWeather({ pool: full, districts, worldToScreen, tick: 300, camera: camera(11_000, 2_000), view: DESKTOP, current: yard, budget: { weather: 40 } });
  assert.equal(full.placed, 3, 'the shared pool cap binds');
});

test('wet-ground sparkle anchors lie on the routes and roofs and only twinkle while it rains', () => {
  const anchors = buildWetSparkleAnchors({ world: LEVEL_ONE_WORLD, placements: [{ id: 'shack', assetId: 'miners-shack', x: 9_000, y: 2_000 }] });
  assert.ok(anchors.count > 200);
  assert.equal(anchors.z.at(-1) > 0, true, 'roof anchors are lifted');
  const draw = (current) => {
    const pool = recordingPool();
    const count = renderWetSparkle({ pool, anchors, camera: camera(11_000, 1_200), view: DESKTOP, tick: 77, worldToScreen, current, budget: { sparkle: 10 } });
    return { pool, count };
  };
  const wet = draw(resolveMoodTarget({ districts, x: 11_000 }));
  assert.ok(wet.count > 0 && wet.count <= 10);
  assert.ok(wet.pool.placedList.every((entry) => entry.mote === true && entry.width <= 5));
  assert.equal(draw(resolveMoodTarget({ districts, x: 3_000 })).count, 0, 'dry ground never sparkles');
});

test('micro-life uses the co-prime 22/34/57 cycles with a per-id phase and no RNG', async () => {
  assert.deepEqual([...MICRO_LIFE_PERIODS], [22, 34, 57]);
  const cycle = 22 * 34 * 57;
  for (const id of ['enemy-1', 'enemy-2', 'rusher:14']) {
    let ups = 0, blinks = 0;
    for (let tick = 0; tick < cycle; tick += 1) {
      const bob = microLifeBob(id, tick);
      assert.ok(bob === 0 || bob === 1);
      assert.equal(microLifeBob(id, tick + cycle), bob, 'the pattern repeats only after the full co-prime cycle');
      ups += bob;
      blinks += microLifeBlink(id, tick) ? 1 : 0;
    }
    assert.ok(ups > cycle * 0.3 && ups < cycle * 0.7, `${id} bobs about half the time`);
    assert.ok(blinks > 0 && blinks < cycle * 0.05, `${id} blinks rarely (${blinks})`);
  }
  const series = (id) => Array.from({ length: 200 }, (_, tick) => microLifeBob(id, tick)).join('');
  assert.notEqual(series('enemy-1'), series('enemy-2'), 'each id has its own phase');
  assert.deepEqual(resolveMicroLife('enemy-1', 99), resolveMicroLife('enemy-1', 99));
});

test('the lazy world modules read no clock and no RNG and import nothing from the simulation', async () => {
  for (const name of ['world-mood.mjs', 'world-water-fx.mjs', 'world-ambient-fx.mjs', 'world-fx.mjs', 'world-fx-textures.mjs']) {
    const source = stripComments(await readFile(src(name), 'utf8'));
    assert.doesNotMatch(source, /Math\.random|Date\.now|performance\.now|requestAnimationFrame/u, name);
    assert.doesNotMatch(source, /from '\.\/(enemy-simulation|movement|collision|elevation|grenades|weapon-system|liquidator-boss|encounter-director|simulation|run-progression|bridge|main)\.mjs'/u, name);
    assert.doesNotMatch(source, /from 'pixi\.js'/u, name);
    assert.doesNotMatch(source, /wallet|settlement|jackpot/iu, name);
  }
  const main = await readFile(src('main.mjs'), 'utf8');
  assert.doesNotMatch(main, /^import[^;]*world-(fx|mood|water-fx|ambient-fx)/mu, 'the world pass is never a static import of the entry');
  assert.match(main, /import\('\.\/world-fx\.mjs'\)/u);
});

test('the water pass builds its shore field once from the authored polygons and cuts the decks out', () => {
  // The restated polygon helpers answer exactly like world-design-water.mjs.
  const mine = exposedShoreEdges(LEVEL_ONE_WORLD.surfaces).map((edge) => [edge.surfaceId, edge.a.x, edge.a.y, edge.b.x, edge.b.y]);
  const theirs = exposedWaterEdges(LEVEL_ONE_WORLD.surfaces).map((edge) => [edge.surfaceId, edge.a.x, edge.a.y, edge.b.x, edge.b.y]);
  assert.deepEqual(mine, theirs);
  for (const surface of LEVEL_ONE_WORLD.surfaces.filter((entry) => entry.kind === 'water')) {
    for (const [x, y] of [[4_510, 100], [4_700, 3_000], [5_300, 4_000], [4_200, 4_000], [5_000, 2_000], [4_300, 3_930]]) {
      assert.equal(waterContains(surface.area, x, y), waterAreaContains(surface.area, x, y), `${surface.id} ${x},${y}`);
    }
  }
  const cover = waterCoverRects(LEVEL_ONE_WORLD.surfaces);
  assert.equal(cover.length, 2, 'the ford deck and the proof-of-work bridge');
  const segments = buildShoreSegments({ surfaces: LEVEL_ONE_WORLD.surfaces, bounds: LEVEL_ONE_WORLD.bounds });
  assert.ok(segments.length >= 10);
  for (const segment of segments) {
    assert.ok(Math.abs(Math.hypot(segment.nx, segment.ny) - 1) < 1e-9);
    for (const t of [0.1, 0.5, 0.9]) {
      const x = segment.ax + (segment.bx - segment.ax) * t + segment.nx * 10, y = segment.ay + (segment.by - segment.ay) * t + segment.ny * 10;
      assert.ok(!cover.some((rect) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY), 'no foam under a deck');
      assert.ok(LEVEL_ONE_WORLD.surfaces.some((surface) => surface.kind === 'water' && waterContains(surface.area, x, y)), 'the normal points into the water');
    }
    assert.ok(segment.ay > LEVEL_ONE_WORLD.bounds.minY || segment.by > LEVEL_ONE_WORLD.bounds.minY, 'no beach on the map edge');
  }
  const field = buildShoreField({ surfaces: LEVEL_ONE_WORLD.surfaces, segments });
  assert.equal(field.distance[field.cols * Math.floor((2_400 - field.minY) / field.cell) + Math.floor((4_750 - field.minX) / field.cell)], -1, 'the bridge deck is cut out of the field');
  const mid = field.distance[field.cols * Math.floor((1_600 - field.minY) / field.cell) + Math.floor((4_750 - field.minX) / field.cell)];
  assert.ok(mid > 230 && mid < 260, `the river centre is ~250 units from both banks (${mid})`);
  const shallow = fieldRects(field, (value) => value <= SHALLOWS_UNITS);
  const deep = fieldRects(field, (value) => value > DEEP_UNITS);
  assert.ok(shallow.length > 0 && deep.length > 0);
  const area = (rects) => rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
  const cells = (accept) => Array.from(field.distance).filter((value) => value >= 0 && accept(value)).length * field.cell ** 2;
  assert.equal(area(shallow), cells((value) => value <= SHALLOWS_UNITS), 'the merged rects cover exactly the shallow cells');
  assert.equal(area(deep), cells((value) => value > DEEP_UNITS));
  const glints = waterSparkleAnchors(field);
  assert.ok(glints.length > 20 && glints.length <= 240);
});

test('foam bands crawl to the shore, fade before they wrap and hold still under reduced motion', () => {
  for (let band = 0; band < FOAM_BANDS; band += 1) {
    assert.deepEqual(resolveFoamBand(band, 90), resolveFoamBand(band, 90));
    const start = resolveFoamBand(band, 0), later = resolveFoamBand(band, 30);
    assert.ok(start.offset >= 0 && start.alpha >= 0 && start.alpha <= 0.42);
    if (later.offset < start.offset + 1) assert.ok(later.offset < start.offset, 'bands move toward the shore');
  }
  assert.ok(resolveFoamBand(0, 0).alpha < 0.02 && resolveFoamBand(0, 149).alpha < 0.02, 'a band is invisible at its wrap');
  assert.deepEqual(resolveFoamBand(1, 10, true), resolveFoamBand(1, 999, true));
  // Foam dashes are only generated for the stretch of a bank inside the view.
  assert.deepEqual(foamSpan(0, 0, 0, 1, 0, 4_800, -10, 10, 1_000, 1_500), [1_000, 1_500]);
  assert.equal(foamSpan(0, 0, 0, 1, 0, 4_800, 20, 30, 1_000, 1_500), null, 'a bank beside the view draws nothing');
  assert.deepEqual(foamSpan(100, 0, -1, 0, 5, 95, 0, 50, -1, 1), [50, 95]);
});

test('the water container is one world-space transform with a deep tint, masked caustics and foam', () => {
  const fx = createWaterFx({ ContainerClass: FakeContainer, GraphicsClass: FakeGraphics, TilingSpriteClass: FakeTiling, causticTexture: fakeTexture('caustic'), world: LEVEL_ONE_WORLD, profile: RUNTIME_PERFORMANCE_PROFILES.desktop });
  const [deep, mask, caustics, foam] = fx.container.children;
  assert.equal(caustics.blendMode, 'add');
  assert.equal(caustics.mask, mask);
  assert.equal(caustics.children.length, 2, 'two scrolling TilingSprites');
  assert.ok(caustics.children.every((tile) => tile.alpha <= 0.15));
  assert.ok(deep.ops.some(([op]) => op === 'fill'));
  const glints = [];
  const render = (tick, reduceMotion = false) => fx.render({ camera: camera(4_750, 1_600), view: DESKTOP, tick, worldToScreen, current: resolveMoodTarget({ districts, x: 4_750 }), reduceMotion, sparkleBudget: 10, place: (...args) => { glints.push(args); return true; } });
  const report = render(120);
  assert.equal(report.visible, true);
  assert.ok(report.foamSegments > 0);
  const origin = worldToScreen({ x: 0, y: 0, z: 4 }, camera(4_750, 1_600), DESKTOP);
  assert.deepEqual([fx.container.position.x, fx.container.position.y], [origin.x, origin.y]);
  const tile = caustics.children[0].tilePosition.x;
  render(121);
  assert.notEqual(caustics.children[0].tilePosition.x, tile, 'caustics scroll with the tick');
  const opsAt121 = JSON.stringify(foam.ops);
  render(121);
  assert.equal(JSON.stringify(foam.ops), opsAt121, 'same tick, same foam');
  render(122, true);
  assert.equal(caustics.children[0].tilePosition.x, 0, 'reduced motion stills the caustics');
  const far = fx.render({ camera: camera(900, 1_600), view: DESKTOP, tick: 5, worldToScreen, current: resolveMoodTarget({ districts, x: 900 }) });
  assert.equal(far.visible, false);
  assert.equal(fx.container.visible, false, 'off-screen water costs nothing');
  glints.length = 0;
  fx.render({ camera: camera(4_750, 1_600), view: DESKTOP, tick: 200, worldToScreen, current: { ...resolveMoodTarget({ districts, x: 4_750 }), bright: 0 }, sparkleBudget: 10, place: (...args) => { glints.push(args); return true; } });
  assert.equal(glints.length, 0, 'no sun glints once the mood is dark');
});

test('ambient life: lamps, smoke and signage are stepped at 7.5 Hz and the scorch wear follows kills per district', () => {
  const placements = [
    { id: 'lamp-a', assetId: 'streetlamp', x: 100, y: 100 },
    { id: 'term-a', assetId: 'liquidation-terminal', x: 400, y: 100 },
    { id: 'fire-a', assetId: 'campfire-ring', x: 200, y: 300 },
    { id: 'bush', assetId: 'scrub-bush', x: 0, y: 0 },
  ];
  const sources = buildAmbientSources(placements);
  assert.deepEqual(sources.lamps.map((lamp) => lamp.id), ['lamp-a', 'term-a']);
  assert.deepEqual(sources.smoke.map((source) => source.id), ['fire-a']);
  const out = [], distances = [];
  const lamps = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 10, y: 0 }, { x: 90, y: 90 }, { x: 20, y: 20 }];
  assert.deepEqual(selectNearestLamps(lamps, 0, 0, 3, out, distances), [0, 2, 4]);
  assert.deepEqual(selectNearestLamps(lamps, 100, 100, 2, out, distances), [3, 1]);
  for (let tick = 0; tick < 64; tick += 1) {
    const base = Math.floor(tick / AMBIENT_STEP_TICKS) * AMBIENT_STEP_TICKS;
    assert.deepEqual(signageFrame('term-a', tick), signageFrame('term-a', base), 'signage holds for a whole 8-tick cel');
    assert.deepEqual(resolveSmokePuff(sources.smoke[0], 1, tick), resolveSmokePuff(sources.smoke[0], 1, base), 'smoke holds for a whole cel');
  }
  assert.notDeepEqual(resolveSmokePuff(sources.smoke[0], 0, 0), resolveSmokePuff(sources.smoke[0], 0, 8));
  const marks = buildScorchMarks(LEVEL_ONE_WORLD);
  assert.equal(marks.length, districts.length * 36);
  for (const mark of marks) {
    const district = districts.find((entry) => entry.id === mark.districtId);
    assert.ok(mark.x >= district.area.minX && mark.x < district.area.maxX, 'a mark stays in its district');
    assert.ok(mark.threshold > 0 && mark.threshold <= 1);
  }
  const tracker = createKillTracker(districts);
  const deaths = new Map([['e1', { x: 900, y: 10 }], ['e2', { x: 950, y: 10 }], ['e3', { x: 11_000, y: 10 }]]);
  tracker.observe(deaths, 10);
  tracker.observe(deaths, 11);
  assert.equal(tracker.counts.get('frontier-relay'), 2, 'a corpse is counted once');
  assert.equal(tracker.counts.get('liquidation-yard'), 1);
  assert.equal(tracker.progress('frontier-relay'), 2 / SCORCH_FULL_KILLS);
  tracker.observe(new Map(), 3);
  assert.equal(tracker.counts.get('frontier-relay'), 0, 'a new run starts clean');
  const budget = resolveAmbientBudget(RUNTIME_PERFORMANCE_PROFILES.mobile);
  assert.ok(budget.glows <= 6 && budget.smoke <= 6);
  assert.equal(resolveAmbientBudget(RUNTIME_PERFORMANCE_PROFILES.reducedMotion).smoke, 0);
});

test('the ambient pass reveals more scorch as kills rise, reuses its fixed pools and ignores the RNG', () => {
  const textures = { glow: fakeTexture('glow'), puff: fakeTexture('puff'), scorch: fakeTexture('scorch'), debris: fakeTexture('debris') };
  const placements = [{ id: 'lamp', assetId: 'streetlamp', x: 900, y: 3_400 }, { id: 'fire', assetId: 'campfire-ring', x: 950, y: 3_450 }];
  const fx = createAmbientFx({ ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures, world: LEVEL_ONE_WORLD, placements, profile: RUNTIME_PERFORMANCE_PROFILES.desktop });
  const frame = (tick, deaths) => fx.render({ camera: camera(900, 3_450), view: DESKTOP, tick, worldToScreen, queryGround: () => ({ groundZ: 0 }), current: resolveMoodTarget({ districts, x: 900 }), deaths });
  const none = frame(100, new Map());
  assert.equal(none.scorch, 0, 'an untouched district is clean');
  assert.equal(none.glows, 1);
  assert.ok(none.smoke > 0);
  const deaths = new Map(Array.from({ length: SCORCH_FULL_KILLS }, (_, index) => [`e${index}`, { x: 900, y: 3_400 }]));
  const some = frame(101, new Map([...deaths].slice(0, 12)));
  const all = frame(102, deaths);
  assert.ok(some.scorch > 0 && all.scorch >= some.scorch, `scorch grows with kills (${some.scorch} -> ${all.scorch})`);
  const sprites = fx.ground.children[0].children.length;
  frame(103, deaths);
  assert.equal(fx.ground.children[0].children.length, sprites, 'a steady frame allocates nothing');
  const pool = createSpritePool({ ContainerClass: FakeContainer, SpriteClass: FakeSprite, label: 'x', max: 2 });
  pool.begin();
  assert.equal(pool.place(fakeTexture('a'), 0, 0, 4, 4, 0, 0xffffff, 0.5), true);
  assert.equal(pool.place(fakeTexture('a'), 0, 0, 4, 4, 0, 0xffffff, 0.5, true), true);
  assert.equal(pool.place(fakeTexture('a'), 0, 0, 4, 4, 0, 0xffffff, 0.5), false, 'the cap binds');
  pool.finish();
  assert.equal(pool.container.children[1].blendMode, 'add');
});

test('A2b: a tall prop the hero stands behind eases to 0.55 over six frames and back; banners flutter at 7.5 Hz', () => {
  assert.equal(PROP_FADE_ALPHA, 0.55);
  assert.equal(PROP_FADE_FRAMES, 6);
  let frame = 0;
  const alphas = [];
  for (let index = 0; index < 8; index += 1) { frame = stepPropFade(frame, true); alphas.push(propFadeAlpha(frame)); }
  assert.ok(alphas[0] < 1 && alphas[0] > 0.9, 'the first frame only starts the fade');
  assert.equal(alphas[5], 0.55, 'six frames reach 0.55');
  assert.equal(alphas[7], 0.55, 'and hold there');
  for (let index = 1; index < 6; index += 1) assert.ok(alphas[index] < alphas[index - 1], 'monotonic');
  for (let index = 0; index < 6; index += 1) frame = stepPropFade(frame, false);
  assert.equal(propFadeAlpha(frame), 1, 'six frames back to opaque');
  const bounds = { left: 0, right: 100, top: 0, bottom: 200 };
  assert.equal(propHidesFocus(bounds, 190, [{ x: 50, y: 120 }], 1), true, 'hero north of the base, inside the paint');
  assert.equal(propHidesFocus(bounds, 190, [{ x: 50, y: 170 }], 1), false, 'hero in front of the base is drawn over the prop');
  assert.equal(propHidesFocus(bounds, 190, [{ x: 150, y: 120 }], 1), false);
  const banner = { id: 'b1', assetId: 'faction-banner' };
  assert.equal(bannerFlutter(banner, 16), bannerFlutter(banner, 23), 'one cel per 8 ticks');
  assert.notEqual(bannerFlutter(banner, 16), bannerFlutter(banner, 24));
  assert.equal(bannerFlutter(banner, 16, true), 0);
  assert.equal(bannerFlutter({ id: 'x', assetId: 'streetlamp' }, 16), 0);
});

test('generated textures: clear vignette centre, tileable caustics, soft glow and irregular scorch', () => {
  const vignette = vignettePixels(64);
  const alphaAt = (image, x, y) => image.pixels[(y * image.width + x) * 4 + 3];
  assert.equal(alphaAt(vignette, 32, 32), 0);
  assert.ok(alphaAt(vignette, 0, 0) > 200);
  const caustic = causticPixels(64);
  // Across the wrap, neighbouring columns differ no more than neighbours do
  // anywhere inside the tile: no visible seam when it repeats.
  let seam = 0, interior = 0;
  for (let y = 0; y < 64; y += 1) {
    seam = Math.max(seam, Math.abs(alphaAt(caustic, 0, y) - alphaAt(caustic, 63, y)), Math.abs(alphaAt(caustic, y, 0) - alphaAt(caustic, y, 63)));
    for (let x = 1; x < 64; x += 1) interior = Math.max(interior, Math.abs(alphaAt(caustic, x, y) - alphaAt(caustic, x - 1, y)), Math.abs(alphaAt(caustic, y, x) - alphaAt(caustic, y, x - 1)));
  }
  assert.ok(seam <= interior, `caustic tile wraps without a seam (${seam} vs ${interior})`);
  assert.deepEqual(causticPixels(64).pixels, caustic.pixels, 'generation is deterministic');
  const glow = glowPixels(32);
  assert.ok(alphaAt(glow, 16, 16) > 200 && alphaAt(glow, 0, 0) === 0);
  const scorch = scorchPixels(64, 0);
  assert.ok(alphaAt(scorch, 32, 32) > 60 && alphaAt(scorch, 0, 0) === 0);
});

test('createWorldFx wires layers, switches the grade to multiply, mirrors CSS and bobs idle bodies through the pivot', () => {
  const world = new FakeContainer();
  const decals = new FakeContainer(), shadows = new FakeContainer(), atmosphere = new FakeContainer();
  world.addChild(new FakeContainer(), decals, shadows, new FakeContainer(), atmosphere, new FakeContainer());
  const stage = new FakeContainer();
  const grade = new FakeSprite({ texture: fakeTexture('white') });
  stage.addChild(world, grade, new FakeContainer());
  const properties = new Map();
  const hud = { style: { setProperty: (name, value) => properties.set(name, value) } };
  const pool = recordingPool();
  const fx = createWorldFx({
    app: { stage }, world, Container: FakeContainer, Sprite: FakeSprite, Texture: FakeTexture, TilingSprite: FakeTiling, Graphics: FakeGraphics,
    level: LEVEL_ONE_WORLD, placements: [{ id: 'lamp', assetId: 'streetlamp', x: 11_000, y: 1_200 }], profile: RUNTIME_PERFORMANCE_PROFILES.desktop,
    atmospherePool: pool, grade, hud, layers: { water: decals, ground: shadows, air: atmosphere }, documentRef: fakeDocument,
  });
  assert.equal(world.children[world.getChildIndex(decals) - 1].label, 'world-water-fx', 'water sits under the decals');
  assert.equal(world.children[world.getChildIndex(shadows) - 1].label, 'world-ambient-ground', 'scorch sits under the contact shadows');
  assert.equal(world.children[world.getChildIndex(atmosphere) - 1].label, 'world-ambient-air', 'glows and smoke sit under the atmosphere');
  assert.equal(stage.children[stage.getChildIndex(grade) + 1], fx.vignette, 'the vignette sits right above the grade');
  const idle = { visible: true, visualState: 'idle', pivot: new FakePoint(), scale: new FakePoint() };
  idle.scale.set(0.5);
  const striking = { visible: true, visualState: 'attack', pivot: new FakePoint(), scale: new FakePoint() };
  striking.scale.set(0.5);
  const markers = new Map([['idle-one', idle], ['striking', striking]]);
  const dataset = {};
  let bobbed = false;
  for (let tick = 1; tick < 60; tick += 1) {
    pool.placedList.length = 0;
    fx.render({ camera: camera(11_000, 1_200), view: DESKTOP, tick, worldToScreen, queryGround: () => ({ groundZ: 0 }), markers, dataset });
    if (idle.pivot.y !== 0) { bobbed = true; assert.equal(idle.pivot.y, 2, '1 px on screen at scale 0.5'); }
    assert.equal(striking.pivot.y, 0, 'an attack read never moves');
  }
  assert.ok(bobbed, 'the idle body bobs within a second');
  assert.equal(grade.blendMode, 'multiply');
  assert.equal(grade.tint, DISTRICT_MOOD['liquidation-yard'].tint);
  assert.ok(fx.vignette.visible && fx.vignette.alpha >= 0.4);
  assert.equal(properties.get('--hmh-mood-night'), '1.00');
  assert.match(dataset.worldWeather, /^rain:\d+ ash:0 sparkle:\d+$/u);
  assert.ok(pool.placedList.length > 0, 'rain landed in the shared atmosphere pool');
  pool.placedList.length = 0;
  fx.render({ camera: camera(11_000, 1_200), view: DESKTOP, tick: 61, worldToScreen, queryGround: () => ({ groundZ: 0 }), markers, reduceMotion: true, dataset });
  assert.equal(pool.placedList.length, 0, 'reduced motion places no weather');
  assert.equal(idle.pivot.y, 0, 'reduced motion stills the bob');
  assert.equal(grade.blendMode, 'multiply', 'the grade is static and stays on');
});
