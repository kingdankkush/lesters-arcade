// Frame contract for the scenery: 1:1 device blits (no per-frame scaling), no
// shadowBlur or filters, no gradients created per frame once warm, a bounded
// number of draw calls, and the code-drawn painters when art is missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingCanvas, createRecordingContext, drawImageCalls } from './chikun-recording-ctx.mjs';
import { buildChikunViewport } from '../apps/chikun/src/viewport.mjs';
import { createArtLoader } from '../apps/chikun/src/art-loader.mjs';
import { SCENERY_CATALOG } from '../apps/chikun/src/scenery-catalog.mjs';
import { distanceAtTick } from '../apps/portal/src/chikun-ground-course.mjs';

globalThis.document ??= { createElement: () => createRecordingCanvas(1, 1) };
const { createChikunWorld } = await import('../apps/chikun/src/world.mjs');
const { drawGround } = await import('../apps/chikun/src/ground-world.mjs');
const flush = () => new Promise(resolve => setImmediate(resolve));

const VIEWS = { desktop: buildChikunViewport(1920, 1080, 2), portrait: buildChikunViewport(390, 844, 3), landscape: buildChikunViewport(844, 390, 3) };
const canvases = [];
const makeCanvas = (w, h) => { const c = createRecordingCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); canvases.push(c); return c; };

function artLoader({ fail = () => false, clock, make = makeCanvas } = {}) {
  const dims = new Map();
  for (const region of Object.values(SCENERY_CATALOG.regions)) {
    for (const layer of Object.values(region.layers)) { for (const t of Object.values(layer.tiers)) dims.set(t.src, t); for (const t of Object.values(layer.emit?.tiers ?? {})) dims.set(t.src, t); for (const sp of layer.sprites ?? []) for (const t of Object.values(sp.tiers)) dims.set(t.src, t); }
    for (const t of Object.values(region.ground?.tiers ?? {})) dims.set(t.src, t);
  }
  return createArtLoader({ makeCanvas: make, ...(clock ? { clock } : {}), loadImage: url => { const src = url.slice(SCENERY_CATALOG.base.length), d = dims.get(src); return fail(src) || !d ? Promise.reject(new Error('404')) : Promise.resolve({ width: d.w, height: d.h, label: src }); } });
}
const snapshot = tick => ({ tick, distancePixels: distanceAtTick(tick), terrain: 'grass', chikun: { x: 280, y: 690, velocityY: 0, locomotion: 'run' }, forks: [], groundCoins: [] });

function frame(world, view, tick, { idleTime = 0, log } = {}) {
  const canvas = createRecordingCanvas(view.pixelWidth, view.pixelHeight);
  const ctx = createRecordingContext(canvas, { transform: [view.density, 0, 0, view.density, -view.left * view.density, 0], ...(log ? { log } : {}) });
  const mark = canvases.map(c => c.getContext().log.length);
  world.draw(ctx, snapshot(tick), { view, mode: 'ranked', idleTime });
  drawGround(ctx, snapshot(tick), {});
  const offscreen = canvases.flatMap((c, i) => c.getContext().log.slice(mark[i] ?? 0));
  return { main: ctx.log, offscreen, ctx };
}

async function warmWorld(view, loader, tick = 1500, { clock, make = makeCanvas, idleTime = 0 } = {}) {
  const world = createChikunWorld({ loader, makeCanvas: make, ...(clock ? { clock } : {}) });
  for (let i = 0; i < 20; i++) { frame(world, view, tick, { idleTime }); clock?.advance(50); await flush(); }
  return world;
}
// A controllable clock for the loader's settle delay and the art fade-in.
function fakeClock() { let now = 0; const clock = () => now; clock.advance = ms => { now += ms; }; return clock; }

test('with art: every blit is 1:1, no blur or filters, bounded calls, no gradients once warm', async () => {
  // Farmland at noon, and the city at night (the densest lights on the loop).
  for (const [region, start] of [['farmland', 1500], ['city', 7400]]) for (const [name, view] of Object.entries(VIEWS)) {
    const loader = artLoader();
    const world = await warmWorld(view, loader, start);
    assert.equal(loader.ready(region), true, `${name}: ${region} art ready`);
    for (let tick = start; tick < start + 10; tick++) {
      const { main, offscreen } = frame(world, view, tick);
      const all = [...main, ...offscreen];
      assert.equal(all.filter(e => e.op === 'createLinearGradient' || e.op === 'createRadialGradient').length, 0, `${name} tick ${tick}: gradient created per frame`);
      assert.ok(all.every(e => e.shadowBlur === 0 && (e.filter === 'none' || e.filter === undefined)), `${name}: no shadowBlur or filter`);
      const draws = drawImageCalls(all);
      // Lights ('lighter') stay at their 1x source size and are the one scaled draw.
      // Additive lights and soft sprites (glows, shafts, clouds) are kept at low
      // resolution and scaled; every piece of scenery art is drawn 1:1.
      for (const c of draws.filter(c => c.composite !== 'lighter' && !c.image.soft)) assert.ok(Math.abs(c.sw - c.dw) < 1e-6 && Math.abs(c.sh - c.dh) < 1e-6, `${name}: scaled blit ${c.image.label ?? c.image.width + 'x' + c.image.height} ${c.sw}x${c.sh} -> ${c.dw}x${c.dh}`);
      assert.ok(draws.length <= 160, `${name}: ${draws.length} drawImage calls`);
      if (region === 'city') assert.ok(draws.some(c => c.composite === 'lighter'), `${name}: the city's lights are drawn at night`);
      const W = view.pixelWidth, H = view.pixelHeight;
      const big = all.filter(e => e.op === 'fillRect' && Math.abs(e.args[2] * e.args[3]) > W * H * 0.25).length;
      assert.ok(big <= 16, `${name}: ${big} large fills`);
    }
    world.dispose();
  }
});

test('without art the code-drawn painters draw the backdrop and the code strip draws the ground', async () => {
  const view = VIEWS.portrait;
  const loader = artLoader({ fail: () => true });
  const world = await warmWorld(view, loader);
  assert.equal(loader.ready('farmland'), false);
  const { main, offscreen } = frame(world, view, 900);
  const blits = drawImageCalls(offscreen).filter(c => !c.image.label);
  assert.ok(blits.length >= 3, 'painter canvases are blitted into the backdrop');
  assert.ok(main.some(e => e.op === 'fillRect' && e.args[1] === 690), 'the code-drawn strip still paints the running line');
  world.dispose();
});

test('reduced motion: nothing scrolls, the day is frozen at noon', async () => {
  const view = VIEWS.landscape, loader = artLoader();
  const world = await warmWorld(view, loader);
  const log = tick => { const canvas = createRecordingCanvas(view.pixelWidth, view.pixelHeight), ctx = createRecordingContext(canvas, { transform: [view.density, 0, 0, view.density, 0, 0] }); world.draw(ctx, snapshot(tick), { view, reduced: true }); return JSON.stringify(ctx.log.map(e => [e.op, e.args.map(a => typeof a === 'object' ? 'img' : a)])); };
  log(1200); // warm the reduced-motion (noon) gradient
  assert.equal(log(1200), log(1800), 'no drift between frames under reduced motion');
  world.dispose();
});

test('the ground bands cover the full width through a region switch (no holes at the seams)', async () => {
  const { regionSwitchTick, REGION_SCHEDULE } = await import('../apps/portal/src/chikun-course-regions.mjs');
  const view = VIEWS.landscape, loader = artLoader();
  const S = regionSwitchTick(REGION_SCHEDULE[1].startSlot);
  const world = await warmWorld(view, loader, S - 220);
  for (let tick = S - 220; tick <= S + 160; tick += 6) {
    const { offscreen } = frame(world, view, tick);
    await flush(); loader.pump(1e9);
    const rows = new Map();
    let tx = 0, ty = 0;
    for (const e of offscreen) {
      if (e.op === 'setTransform') { tx = e.args[4]; ty = e.args[5]; }
      else if (e.op === 'fillRect' && typeof e.fill === 'object' && e.fill?.kind === 'pattern') {
        const x0 = e.args[0] + tx, x1 = x0 + e.args[2];
        if (!rows.has(ty)) rows.set(ty, []);
        rows.get(ty).push([x0, x1]);
      }
    }
    assert.ok(rows.size >= 20, `tick ${tick}: ${rows.size} band rows drawn`);
    for (const [y, spans] of rows) {
      spans.sort((a, b) => a[0] - b[0]);
      let reach = 0;
      for (const [a, b] of spans) { assert.ok(a <= reach + 1, `tick ${tick} band y ${y}: hole at ${reach}..${a}`); reach = Math.max(reach, b); }
      assert.ok(reach >= view.pixelWidth - 1, `tick ${tick} band y ${y}: covered to ${reach} of ${view.pixelWidth}`);
    }
  }
  world.dispose();
});

test('the sky costs a bounded amount of memory at density 2', async () => {
  const { createAtmosphere } = await import('../apps/chikun/src/atmosphere.mjs');
  const { computeLightRig, chikunSkyState } = await import('../apps/chikun/src/light-rig.mjs');
  const { courseRegionState } = await import('../apps/portal/src/chikun-course-regions.mjs');
  const made = [];
  const atmosphere = createAtmosphere({ makeCanvas: (w, h) => { const c = createRecordingCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); made.push(c); return c; } });
  const view = VIEWS.desktop, state = courseRegionState(5400, {});
  for (const t of [0, 45, 90]) {
    const bus = { density: view.density, canvasWidth: view.pixelWidth, canvasHeight: view.pixelHeight, view, distance: 0, rig: computeLightRig(chikunSkyState(t), state, view) };
    atmosphere.drawSky(createRecordingContext(createRecordingCanvas(view.pixelWidth, view.pixelHeight)), bus, t);
  }
  const bytes = made.filter(c => c.width > 0).reduce((a, c) => a + c.width * c.height * 4, 0);
  assert.equal(view.density, 2);
  assert.ok(bytes <= 12 * 1024 * 1024, `sky sprites use ${(bytes / 1048576).toFixed(1)} MB`);
});

test('after a rotation the previous prescale keeps drawing (scaled) until the new one lands', async () => {
  const clock = fakeClock(), loader = artLoader({ clock });
  const world = await warmWorld(VIEWS.portrait, loader, 1500, { clock });
  const rotated = buildChikunViewport(1280, 720, 1.5);
  assert.equal(loader.tier(rotated.density), loader.tier(VIEWS.portrait.density), 'same tier: a re-prescale, not a reload');
  const { offscreen, main } = frame(world, rotated, 1500);
  const fills = offscreen.filter(e => e.op === 'fillRect' && e.fill?.kind === 'pattern');
  assert.ok(fills.length >= 20, `${fills.length} ground bands still drawn`);
  assert.ok(drawImageCalls(main).some(c => c.image.label === undefined && c.dw !== c.sw), 'the cut face draws the old prescale scaled');
  for (let i = 0; i < 30; i++) { frame(world, rotated, 1500); clock.advance(16); await flush(); loader.pump(1e9); }
  assert.ok(Math.abs(loader.layer('farmland', 'mid').density - rotated.density) < 1e-9, 'the replacement lands');
  world.dispose();
});

test('rotating a phone across the tier line never brings back the code-drawn painters', async () => {
  const clock = fakeClock(), loader = artLoader({ clock });
  const world = await warmWorld(VIEWS.portrait, loader, 1500, { clock });
  // Portrait lands on density 2 (2x art); this landscape lands on ~0.94 (1x art).
  const rotated = buildChikunViewport(844, 340, 3);
  assert.notEqual(loader.tier(rotated.density), loader.tier(VIEWS.portrait.density), 'the rotation crosses the tier line');
  const builds = world.stats().painterBuilds;
  for (let i = 0; i < 40; i++) {
    const { offscreen } = frame(world, rotated, 1500 + i);
    assert.equal(loader.ready('farmland'), true, `frame ${i}: farmland stays art-ready`);
    assert.equal(world.stats().painterBuilds, builds, `frame ${i}: a code-drawn painter was rebuilt`);
    assert.ok(offscreen.filter(e => e.op === 'fillRect' && e.fill?.kind === 'pattern').length >= 20, `frame ${i}: ground bands drawn`);
    clock.advance(16); await flush(); loader.pump(1e9);
  }
  const mid = loader.layer('farmland', 'mid');
  assert.ok(Math.abs(mid.density - rotated.density) < 1e-9 && mid.src.includes('/t1/'), 'the 1x art lands at the landscape density');
  world.dispose();
});

test('the ready screen at tick 0 keeps the first region\'s ground however long the session has idled', async () => {
  const view = VIEWS.landscape, loader = artLoader();
  const world = await warmWorld(view, loader, 0);
  assert.equal(loader.ready('farmland'), true); assert.equal(loader.ready('forest'), true);
  const owner = new Map();
  for (const id of ['farmland', 'forest']) {
    for (const b of loader.ground(id).bands) owner.set(b.canvas, id);
    const face = loader.layer(id, 'front');
    if (face) owner.set(face.canvas, id);
  }
  // idleTime * 40 px of idle scroll passes the farmland -> forest boundary (7926 px) after ~200 s.
  for (const idleTime of [0, 180, 200, 600, 3600]) {
    const { main, offscreen } = frame(world, view, 0, { idleTime });
    const bands = offscreen.filter(e => e.op === 'fillRect' && e.fill?.kind === 'pattern').map(e => owner.get(e.fill.image));
    assert.ok(bands.length >= 20, `idle ${idleTime} s: ${bands.length} band fills`);
    assert.deepEqual([...new Set(bands)], ['farmland'], `idle ${idleTime} s: ground bands from ${[...new Set(bands)]}`);
    const faces = drawImageCalls(main).map(c => owner.get(c.image)).filter(Boolean);
    assert.deepEqual([...new Set(faces)], ['farmland'], `idle ${idleTime} s: cut face from ${[...new Set(faces)]}`);
  }
  world.dispose();
});

test('night lights stay on their own depth: each layer\'s lights are added before any nearer layer is drawn over them', async () => {
  const shared = [];
  const make = (w, h) => createRecordingCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), { log: shared });
  const view = VIEWS.desktop, loader = artLoader({ make });
  const world = await warmWorld(view, loader, 7400, { make });
  assert.equal(loader.ready('city'), true);
  shared.length = 0;
  frame(world, view, 7405, { log: shared });
  const first = img => shared.findIndex(e => e.op === 'drawImage' && e.args[0] === img);
  const lit = img => shared.flatMap((e, i) => e.op === 'drawImage' && e.args[0] === img && e.composite === 'lighter' ? [i] : []);
  const strip = name => loader.layer('city', name).canvas;
  const backdrop = shared.flatMap((e, i) => e.op === 'drawImage' && e.args[0]?.width === view.pixelWidth && e.args[0]?.height === Math.ceil(414 * view.density) ? [i] : []);
  for (const [name, nearer] of [['far', ['mid', 'near']], ['mid', ['near']]]) {
    const em = loader.emit('city', name);
    assert.ok(em, `the city's ${name} layer has lights`);
    const lights = lit(em.canvas);
    assert.ok(lights.length > 0, `${name} lights drawn at night`);
    assert.ok(Math.min(...lights) > first(strip(name)), `${name} lights come after the ${name} strip`);
    for (const n of nearer) {
      const at = first(strip(n));
      assert.ok(at >= 0 && Math.max(...lights) < at, `${name} lights are added before the ${n} strip is drawn`);
      assert.ok(backdrop.some(i => i > at), `the ${n} strip is composited over the ${name} lights`);
    }
  }
  world.dispose();
});
