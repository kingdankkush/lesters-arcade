// Obstacle value separation (obstacle-contrast slice of the Chikun visual upgrade).
//
// Obstacles separate from the scenery by value: each draw is graded darker than
// the backdrop band it sits in (deepen) or lighter, towards the key light's
// colour (lift), whichever needs less change to reach the target luminance
// contrast. Everything here is projection-only: the inputs are a sprite's
// catalogued tone, the obstacle's own region, the light rig and the rows the
// draw covers; nothing reads or writes gameplay.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRecordingCanvas, createRecordingContext, drawImageCalls } from './chikun-recording-ctx.mjs';
import { OBSTACLE_CATALOG } from '../apps/chikun/src/obstacle-catalog.mjs';
import { BACKDROP_PROFILE } from '../apps/chikun/src/obstacle-backdrop-profile.mjs';
import { CHIKUN_REGIONS, REGION_START_SLOTS } from '../apps/portal/src/chikun-course-regions.mjs';
import { buildCourseObstacle } from '../apps/portal/src/chikun-ground-course.mjs';
import { buildChikunViewport } from '../apps/chikun/src/viewport.mjs';
import { RIG_KEYS } from '../apps/chikun/src/light-rig.mjs';

globalThis.document ??= { createElement: () => createRecordingCanvas(1, 1) };
const sep = await import('../apps/chikun/src/obstacle-separation.mjs');
const { backdropLuminance, separationFor, contrastRatio, toneLuminance, SEPARATION } = sep;
const art = await import('../apps/chikun/src/obstacle-art.mjs');
const { createObstacleArt, setObstacleArt, scheduleObstacleArt, drawObstacleArt, layoutObstacleArt, spriteDesc } = art;
const { sceneBus } = await import('../apps/chikun/src/scene-bus.mjs');

const NOON = { noon: 1, golden: 0, night: 0, dawn: 0 };
const NIGHT = { noon: 0, golden: 0, night: 1, dawn: 0 };
const rigFor = (weights, key) => ({ weights, night: weights.night, grade: { W: RIG_KEYS[key].W, w: RIG_KEYS[key].w, D: RIG_KEYS[key].D, a: RIG_KEYS[key].a }, rim: RIG_KEYS[key].rim, lightsOn: RIG_KEYS[key].lightsOn, shadowAlpha: 0.2 });

test('the backdrop profile covers every region at the four keys in 24 px bands (mean and quartiles)', () => {
  assert.equal(BACKDROP_PROFILE.band, 24);
  assert.deepEqual([...BACKDROP_PROFILE.keys], ['noon', 'golden', 'night', 'dawn']);
  for (const r of CHIKUN_REGIONS) {
    const { mean, low, high } = BACKDROP_PROFILE.regions[r.id];
    for (const rows of [mean, low, high]) {
      assert.equal(rows.length, 4, r.id);
      for (const row of rows) { assert.equal(row.length, 30); for (const v of row) assert.ok(Number.isInteger(v) && v >= 0 && v <= 1000); }
    }
    for (let k = 0; k < 4; k++) for (let i = 0; i < 30; i++) assert.ok(low[k][i] <= high[k][i], `${r.id} quartiles ordered`);
  }
  assert.ok(Object.isFrozen(BACKDROP_PROFILE.regions.farmland.mean[0]));
});

test('every catalogued sprite carries its body tone (mean sRGB and linear luminance x 1000)', () => {
  for (const kit of Object.values(OBSTACLE_CATALOG.kits)) for (const [name, sp] of Object.entries(kit.sprites)) {
    assert.equal(sp.tone?.length, 4, name);
    for (const v of sp.tone.slice(0, 3)) assert.ok(v >= 0 && v <= 255, name);
    assert.ok(sp.tone[3] >= 0 && sp.tone[3] <= 1000, name);
    // the stored mean luminance is at least the luminance of the mean colour (the transfer curve is convex)
    assert.ok(sp.tone[3] / 1000 >= toneLuminance(sp.tone.slice(0, 3)) - 0.01, name);
  }
});

test('backdropLuminance averages the bands a draw covers and blends the keys by the rig weights', () => {
  const rows = BACKDROP_PROFILE.regions.forest.mean;
  const noon = backdropLuminance('forest', NOON, 600, 648);
  assert.ok(Math.abs(noon - (rows[0][25] + rows[0][26]) / 2000) < 1e-9, `noon ${noon}`);
  const low = BACKDROP_PROFILE.regions.forest.low;
  assert.ok(Math.abs(backdropLuminance('forest', NOON, 600, 648, 'low') - (low[0][25] + low[0][26]) / 2000) < 1e-9);
  const half = backdropLuminance('forest', { noon: 0.5, golden: 0, night: 0.5, dawn: 0 }, 600, 648);
  const night = backdropLuminance('forest', NIGHT, 600, 648);
  assert.ok(Math.abs(half - (noon + night) / 2) < 1e-9);
  // rows outside the canvas clamp; an unknown region or missing weights fall back to noon farmland
  assert.ok(Number.isFinite(backdropLuminance('forest', NOON, -300, 20)));
  assert.ok(Number.isFinite(backdropLuminance('forest', NOON, 700, 900)));
  assert.equal(backdropLuminance('nowhere', null, 600, 648), backdropLuminance('farmland', NOON, 600, 648));
});

test('separationFor deepens over a bright band, lifts over a dark one and reaches the target contrast', () => {
  const out = {};
  const noon = rigFor(NOON, 'noon');
  // a mid-value crate in front of a bright sky band
  separationFor([160, 120, 80, 220], 0.45, noon, out);
  assert.equal(out.mode, 'deepen');
  assert.ok(out.s > 0 && out.s <= SEPARATION.maxDeepen);
  assert.ok(out.ratio >= SEPARATION.day - 1e-6, `deepen ratio ${out.ratio}`);
  // a mossy log on the dark forest floor: brighter than the floor, it lifts (to the floor ratio when the target needs more)
  separationFor([110, 95, 60, 120], 0.06, noon, out);
  assert.equal(out.mode, 'lift');
  assert.ok(out.ratio >= SEPARATION.dayFloor - 1e-6, `lift ratio ${out.ratio}`);
  assert.ok(out.s <= SEPARATION.maxLift);
  // a light hay bale on a mid-value field lifts (exposure) rather than being crushed dark
  separationFor([200, 170, 90, 420], 0.16, noon, out);
  assert.equal(out.mode, 'lift');
  // pits are holes: never lifted
  separationFor([70, 55, 40, 50], 0.06, noon, out, 0.72, true);
  assert.notEqual(out.mode, 'lift');
  // a band whose dark quartile is darker makes a flyer deepen further
  const plain = separationFor([150, 110, 80, 200], 0.4, noon, {}).s;
  const varied = separationFor([150, 110, 80, 200], 0.4, noon, {}, 0.72, false, false, 0.15, 0.6).s;
  assert.ok(varied >= plain, `${varied} >= ${plain}`);
  const lifted = separationFor([110, 95, 60, 120], 0.06, noon, {});
  assert.deepEqual(lifted.colour, [...RIG_KEYS.noon.rim], 'lifts towards the key light colour');
  assert.ok(lifted.exposure > 0 && lifted.exposure <= 1 && lifted.fill > 0 && lifted.fill < lifted.s, 'a lift is mostly exposure, a little wash');
  // a sprite as dark as its dark band cannot reach the floor either way: the gentle deepen, nothing wilder
  separationFor([70, 55, 40, 50], 0.06, noon, out);
  assert.ok(out.s <= SEPARATION.gentleDeepen + 1e-9 || out.mode === 'lift');
  // already separated: nothing to do
  separationFor([20, 20, 24, 8], 0.6, noon, out);
  assert.equal(out.mode, 'none'); assert.equal(out.s, 0);
  // amounts are quantised (stable cache keys) and capped
  for (const L of [0.02, 0.08, 0.15, 0.3, 0.5, 0.7]) for (const tone of [[40, 40, 40, 25], [128, 128, 128, 216], [230, 230, 230, 790]]) {
    separationFor(tone, L, noon, out);
    assert.ok(Math.abs(out.s * 20 - Math.round(out.s * 20)) < 1e-9, `quantised ${out.s}`);
    assert.ok(out.s <= Math.max(SEPARATION.maxDeepen, SEPARATION.maxLift) + 1e-9);
  }
});

test('the night target is lower and lifts use the moonlight colour', () => {
  const out = {};
  const night = rigFor(NIGHT, 'night');
  separationFor([90, 80, 70, 90], 0.05, night, out);
  assert.equal(out.mode, 'lift');
  assert.deepEqual(out.colour, [...RIG_KEYS.night.rim]);
  assert.ok(out.ratio >= SEPARATION.nightFloor - 1e-6, `night ratio ${out.ratio}`);
  assert.ok(SEPARATION.night < SEPARATION.day);
  assert.equal(contrastRatio(0.2, 0.05), (0.25 / 0.1));
});

// ---------------------------------------------------------------- runtime wiring

function fakeImages() {
  const dims = new Map();
  for (const kit of Object.values(OBSTACLE_CATALOG.kits)) for (const sp of Object.values(kit.sprites)) {
    for (const t of Object.values(sp.tiers)) dims.set(t.src, t);
    if (sp.emit) dims.set(sp.emit.src, sp.emit);
  }
  return url => { const d = dims.get(url.slice(OBSTACLE_CATALOG.base.length)); return d ? Promise.resolve({ width: d.w, height: d.h, label: d.src }) : Promise.reject(new Error('404')); };
}
const makeCanvas = (w, h) => createRecordingCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
const flush = () => new Promise(resolve => setImmediate(resolve));
async function settle(a) { for (let i = 0; i < 30; i++) { await flush(); a.pump(1e9); } }

function draw(o, view, rig, tick = 900) {
  const ctx = createRecordingContext(createRecordingCanvas(view.pixelWidth, view.pixelHeight), { transform: [view.density, 0, 0, view.density, -view.left * view.density, 0] });
  sceneBus.view = view; sceneBus.rig = rig;
  drawObstacleArt(ctx, o, tick, false);
  return ctx.log;
}

test('at noon a separated sprite draws from a copy graded towards its separation colour', async () => {
  const view = buildChikunViewport(1280, 720, 1);
  const a = createObstacleArt({ loadImage: fakeImages(), makeCanvas, clock: () => 0 });
  setObstacleArt(a);
  scheduleObstacleArt(1500, 1); await settle(a);
  const rig = rigFor(NOON, 'noon');
  const hawk = buildCourseObstacle({ seed: 1, index: 5, x: 500, kind: 'hawk' });
  a.beginFrame();
  const log = draw(hawk, view, rig);
  const img = drawImageCalls(log).find(c => c.composite === 'source-over' && !c.image.soft)?.image;
  const raw = a.prepared('bird-hawk').canvas;
  const [p] = layoutObstacleArt(hawk, { tick: 900 });
  const s = separationFor(spriteDesc('bird-hawk').tone, backdropLuminance('farmland', NOON, p.y + p.sy0 - 12, p.y + p.sy1 + 12), rig, {});
  if (s.mode === 'none') assert.equal(img, raw);
  else {
    assert.notEqual(img, raw, 'the hawk draws from its separated copy');
    const fills = img.getContext('2d').log.filter(e => e.op === 'fillRect');
    assert.ok(fills.some(f => f.composite === 'source-atop'), 'the separation is a source-atop fill (the silhouette is kept)');
  }
  a.dispose(); setObstacleArt(null);
});

test('the same sprite at two separations keeps both copies (no regrade every frame)', async () => {
  const view = buildChikunViewport(1280, 720, 1);
  const a = createObstacleArt({ loadImage: fakeImages(), makeCanvas, clock: () => 0 });
  setObstacleArt(a);
  scheduleObstacleArt(1500, 1); await settle(a);
  const rig = rigFor(NOON, 'noon');
  const high = buildCourseObstacle({ seed: 1, index: 5, x: 500, kind: 'hawk' });
  const low = { ...high, y: 560, shapes: high.shapes };
  const images = [];
  for (let f = 0; f < 6; f++) {
    a.beginFrame();
    for (const o of [high, low]) images.push(drawImageCalls(draw(o, view, rig)).find(c => !c.image.soft)?.image);
  }
  const before = a.stats().regraded;
  for (let f = 0; f < 10; f++) { a.beginFrame(); draw(high, view, rig); draw(low, view, rig); }
  assert.equal(a.stats().regraded, before, 'no regrades once both copies exist');
  a.dispose(); setObstacleArt(null);
});

test('facades take the separation over their collision rects like the grade', async () => {
  const view = buildChikunViewport(1280, 720, 1);
  const a = createObstacleArt({ loadImage: fakeImages(), makeCanvas, clock: () => 0 });
  setObstacleArt(a);
  const { REGION_SCHEDULE } = await import('../apps/portal/src/chikun-course-regions.mjs');
  const tick = REGION_SCHEDULE[2].startTick + 1200;
  scheduleObstacleArt(tick, 1); await settle(a);
  const town = buildCourseObstacle({ seed: 1, index: REGION_START_SLOTS[2], x: 300, kind: 'town' });
  const log = draw(town, view, rigFor(NOON, 'noon'), tick);
  for (const f of log.filter(e => e.op === 'fillRect')) {
    const [x, y, w, h] = f.args;
    assert.ok(town.shapes.some(r => Math.abs(r.x - x) < 1 && Math.abs(r.width - w) < 1 && y >= r.y && y + h <= 698 + 1), `fill ${x},${y} ${w}x${h} stays on a facade rect`);
  }
  a.dispose(); setObstacleArt(null);
});

// ---------------------------------------------------------------- through the day

const { separationOf, separationDirection, obstacleRegion } = art;
const { chikunSkyState, computeLightRig } = await import('../apps/chikun/src/light-rig.mjs');
const landscape = buildChikunViewport(1280, 720, 1);
function dayRig(seconds, r) {
  const state = { index: r, nextIndex: (r + 1) % 7, region: CHIKUN_REGIONS[r], next: CHIKUN_REGIONS[(r + 1) % 7], blend: 0 };
  return computeLightRig(chikunSkyState(seconds), state, landscape);
}

test('the separation is solved per light key and blended by the rig weights', () => {
  const o = buildCourseObstacle({ seed: 3, index: REGION_START_SLOTS[1] + 2, x: 400, kind: 'log' });
  const [p] = layoutObstacleArt(o, { tick: 0 });
  const region = obstacleRegion(o);
  const one = w => separationOf(p, region, { ...rigFor(w, 'noon'), rim: [255, 255, 255] }, {});
  const noon = one(NOON), golden = one({ noon: 0, golden: 1, night: 0, dawn: 0 }), half = one({ noon: 0.5, golden: 0.5, night: 0, dawn: 0 });
  const q = v => Math.round(v * 20) / 20;
  assert.equal(half.deepen, q((noon.deepen + golden.deepen) / 2));
  assert.equal(half.lift, q((noon.lift + golden.lift) / 2));
  assert.ok(Math.abs(half.ratio - (noon.ratio + golden.ratio) / 2) < 1e-9);
});

test('through a whole day an obstacle\'s separation moves in small steps (no flip between light and dark)', () => {
  for (let r = 0; r < CHIKUN_REGIONS.length; r++) for (const kind of ['log', 'crate', 'hurdle', 'shiba', 'hawk', 'storm']) {
    const o = buildCourseObstacle({ seed: 3, index: REGION_START_SLOTS[r] + 1, x: 400, kind });
    const ops = layoutObstacleArt(o, { tick: 0 }).map(p => ({ ...p }));
    const region = obstacleRegion(o);
    let prev = null;
    for (let t = 0; t <= 180; t += 0.25) {
      const rig = dayRig(t, r), dirs = [...separationDirection(ops, region, rig)];
      const s = separationOf(ops[0], region, rig, {}, dirs);
      if (prev) {
        assert.ok(Math.abs(s.deepen - prev.deepen) <= 0.1 + 1e-9 && Math.abs(s.lift - prev.lift) <= 0.1 + 1e-9,
          `${kind} in ${region} at ${t}s: deepen ${prev.deepen}->${s.deepen}, lift ${prev.lift}->${s.lift}`);
      }
      prev = s;
    }
  }
});

test('at each light key every part of a multi-part obstacle goes the same way', () => {
  for (let r = 0; r < CHIKUN_REGIONS.length; r++) for (const kind of ['tree', 'town', 'forest', 'pipe', 'waterfall']) {
    const o = buildCourseObstacle({ seed: 5, index: REGION_START_SLOTS[r] + 3, x: 400, kind });
    const ops = layoutObstacleArt(o, { tick: 0 }).map(p => ({ ...p }));
    if (ops.missing || ops.length < 2) continue;
    const region = obstacleRegion(o);
    for (const key of ['noon', 'golden', 'night', 'dawn']) {
      const w = { noon: 0, golden: 0, night: 0, dawn: 0, [key]: 1 };
      const rig = { ...rigFor(w, key), rim: RIG_KEYS[key].rim };
      const dirs = [...separationDirection(ops, region, rig)];
      const modes = new Set(ops.map(p => separationOf(p, region, rig, {}, dirs).mode).filter(m => m !== 'none'));
      assert.ok(!(modes.has('deepen') && modes.has('lift')), `${kind} in ${region} at ${key}: parts split ${[...modes]}`);
    }
  }
});

test('per-key solves are memoised: redrawing an obstacle adds no new solves', () => {
  const { separationCacheSize, SEPARATION_KEY_SECONDS } = art;
  const o = buildCourseObstacle({ seed: 9, index: REGION_START_SLOTS[2] + 1, x: 400, kind: 'town' });
  const ops = layoutObstacleArt(o, { tick: 0 }).map(p => ({ ...p }));
  const region = obstacleRegion(o), rig = dayRig(39, 2);
  const first = ops.map(p => ({ ...separationOf(p, region, rig, {}, [...separationDirection(ops, region, rig)]) }));
  const size = separationCacheSize();
  for (let f = 0; f < 5; f++) {
    const again = ops.map(p => ({ ...separationOf(p, region, rig, {}, [...separationDirection(ops, region, rig)]) }));
    assert.deepEqual(again, first);
  }
  assert.equal(separationCacheSize(), size);
  // the key moments match the rig dump the backdrop profiles were measured at
  const dump = readFileSync(new URL('../scripts/chikun-blender/chikun-rig-dump.mjs', import.meta.url), 'utf8');
  const { noon, golden, night, dawn } = SEPARATION_KEY_SECONDS;
  assert.ok(dump.includes(`PURE_KEYS = Object.freeze({ noon: ${noon}, golden: ${golden}, night: ${night}, dawn: ${dawn} })`), 'rig dump --pure uses the separation key moments');
});

test('a multi-part obstacle coming into view is graded in its first frame (no ungraded pop)', async () => {
  const view = buildChikunViewport(1280, 720, 1);
  const a = createObstacleArt({ loadImage: fakeImages(), makeCanvas, clock: () => 0 });
  setObstacleArt(a);
  const { REGION_SCHEDULE } = await import('../apps/portal/src/chikun-course-regions.mjs');
  const tick = REGION_SCHEDULE[1].startTick + 1200;   // forest
  scheduleObstacleArt(tick, 1); await settle(a);
  const rig = rigFor(NOON, 'noon');
  for (const kind of ['forest', 'tree', 'crate']) {
    const o = buildCourseObstacle({ seed: 2, index: REGION_START_SLOTS[1] + 2, x: 700, kind });
    a.beginFrame();
    const draws = drawImageCalls(draw(o, view, rig, tick)).filter(c => c.composite === 'source-over' && !c.image.soft);
    const region = obstacleRegion(o), ops = layoutObstacleArt(o, { tick });
    const dirs = [...separationDirection(ops, region, rig)];
    for (const [i, p] of ops.entries()) {
      const sep = separationOf(p, region, rig, {}, dirs);
      if (sep.mode === 'none' || p.name.startsWith('facade-')) continue;
      assert.notEqual(draws[i]?.image, a.prepared(p.name).canvas, `${kind}: ${p.name} drew ungraded in its first frame`);
    }
  }
  a.dispose(); setObstacleArt(null);
});
