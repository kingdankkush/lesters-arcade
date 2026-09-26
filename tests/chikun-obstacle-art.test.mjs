// Slice 2 of the Chikun visual upgrade: the rendered obstacle art.
//
// The collision is the truth. These tests prove, from the packer's coverage
// masks (tests/chikun-obstacle-masks.json) and the pure layoutObstacleArt(),
// that every obstacle kind's art covers its collision shapes, does not run
// ahead of them, and leaves no large empty hole inside them, across seeds,
// regions, laps (the difficulty ramp) and animation frames. They also pin the
// shipped files (bytes, SHA-256, dimensions), the download and memory budgets,
// the loader (tiers, residency, 1:1 prescaled blits, per-sprite fallback) and
// the look-ahead guard (nothing drawn for an obstacle beyond the view).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRecordingCanvas, createRecordingContext, drawImageCalls } from './chikun-recording-ctx.mjs';
import { measure, MASKS, maskAt, MASK_CELL, shapeDistance } from './chikun-obstacle-coverage.mjs';
import { buildCourseObstacle, GROUND_SKY_KINDS } from '../apps/portal/src/chikun-ground-course.mjs';
import { buildChikunObstacle } from '../apps/portal/src/chikun-obstacles.mjs';
import { CHIKUN_REGIONS, REGION_START_SLOTS } from '../apps/portal/src/chikun-course-regions.mjs';
import { OBSTACLE_CATALOG } from '../apps/chikun/src/obstacle-catalog.mjs';
import { SCENERY_CATALOG } from '../apps/chikun/src/scenery-catalog.mjs';
import { buildChikunViewport } from '../apps/chikun/src/viewport.mjs';

globalThis.document ??= { createElement: () => createRecordingCanvas(1, 1) };
const art = await import('../apps/chikun/src/obstacle-art.mjs');
const { layoutObstacleArt, createObstacleArt, setObstacleArt, drawObstacleArt, OBSTACLE_VARIANTS, BUILDING_STYLES, spriteDesc, scheduleObstacleArt, tintRects } = art;
const { drawGroundObstacle } = await import('../apps/chikun/src/ground-world.mjs');
const { sceneBus } = await import('../apps/chikun/src/scene-bus.mjs');

const ROOT = new URL('../apps/portal/assets/generated/chikun-obstacles-v2/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));
const KB = 1024;
const flush = () => new Promise(resolve => setImmediate(resolve));

function webpSize(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
}
function files(kit) {
  const out = [];
  for (const sp of Object.values(kit.sprites)) {
    for (const [tier, t] of Object.entries(sp.tiers)) out.push([tier, t, sp]);
    if (sp.emit) out.push(['emit', sp.emit, sp]);
  }
  return out;
}

// ---------------------------------------------------------------- shipped files and budgets

test('the catalog matches the manifest and only references versioned v2 files', () => {
  assert.equal(OBSTACLE_CATALOG.version, 'chikun-obstacles-v2');
  assert.equal(OBSTACLE_CATALOG.base, '/assets/generated/chikun-obstacles-v2/');
  assert.deepEqual(Object.keys(OBSTACLE_CATALOG.kits).sort(), ['city', 'coast', 'common', 'farmland', 'forest', 'industrial', 'suburbs', 'town']);
  assert.deepEqual(JSON.parse(JSON.stringify(OBSTACLE_CATALOG.kits)), JSON.parse(JSON.stringify(manifest.kits)));
  for (const [id, kit] of Object.entries(OBSTACLE_CATALOG.kits)) for (const [, t] of files(kit)) assert.match(t.src, new RegExp(`^${id}/t[12]/[a-z0-9-]+\\.webp$`));
  assert.equal(existsSync(new URL('masks.json', ROOT)), false, 'coverage masks are a test fixture, not a shipped asset');
});

test('every file exists with its recorded bytes, SHA-256 and dimensions; strips hold whole frames', () => {
  for (const kit of Object.values(OBSTACLE_CATALOG.kits)) for (const [tier, t, sp] of files(kit)) {
    const buf = readFileSync(new URL(t.src, ROOT));
    assert.equal(buf.length, t.bytes, `${t.src} bytes`);
    assert.equal(createHash('sha256').update(buf).digest('hex'), t.sha256, `${t.src} sha256`);
    assert.deepEqual(webpSize(buf), [t.w, t.h], `${t.src} dimensions`);
    const s = tier === 't2' ? 2 : 1;
    assert.equal(t.w, (sp.frames * sp.w + (sp.frames - 1) * sp.gap) * s, `${t.src}: frames laid out on whole logical pixels`);
    assert.equal(t.h, sp.h * s, `${t.src} height`);
  }
});

test('download and decoded-memory budgets', () => {
  const kits = OBSTACLE_CATALOG.kits;
  assert.ok(kits.common.bytes.t2 <= 620 * KB, `common kit ${kits.common.bytes.t2} B at t2`);
  assert.ok(kits.common.bytes.t1 <= 300 * KB, `common kit ${kits.common.bytes.t1} B at t1`);
  assert.ok(kits.common.logicalPx <= 1_000_000, `common kit ${kits.common.logicalPx} logical px`);
  for (const r of CHIKUN_REGIONS) {
    const k = kits[r.id], scenery = SCENERY_CATALOG.regions[r.id];
    assert.ok(k, `${r.id} has a kit`);
    // the forest's three foliage walls (forest columns, bough canopy) are the heaviest kit
    assert.ok(k.bytes.t2 <= 420 * KB, `${r.id} kit ${k.bytes.t2} B at t2`);
    assert.ok(k.bytes.t1 <= 150 * KB, `${r.id} kit ${k.bytes.t1} B at t1`);
    assert.ok(k.logicalPx <= 520_000, `${r.id} kit ${k.logicalPx} logical px`);
    // the whole region (backdrop + obstacle kit) stays under the 1.5 MB hard cap at t2
    const sceneryBytes = scenery ? JSON.stringify(scenery).match(/"bytes":\d+/g).map(s => Number(s.slice(8))).reduce((a, b) => a + b, 0) : 0;
    assert.ok(sceneryBytes / 2 + k.bytes.t2 <= 1.5 * 1024 * KB, `${r.id} backdrop + kit`);
    // decoded at density 2: 16 B per logical px
    assert.ok(k.logicalPx * 16 <= 8.5 * 1024 * KB, `${r.id} kit decoded at density 2`);
  }
});

// ---------------------------------------------------------------- alignment with the collision shapes

// Per kind: minimum coverage of every collision shape's visible area (y < 690),
// the most art may lead the leftmost collision point, the largest empty hole
// inside a shape (distance to the nearest art) and the farthest art may reach
// outside the shapes. Solid props lead by at most the 7 px collider inset;
// foliage and cloud fringes may reach 12 px; tree roots spread on the ground
// inside the trunk's own reach (Chikun's radius is 30); flyer wingtips flap
// outside their capsule. Stadium-shaped flyer hitboxes are generous, so their
// art fills the core and the hole limit (< Chikun's radius) is what matters.
const RULES = {
  rock: [0.95, 8, 6, 16], log: [0.85, 8, 10, 12], thorn: [0.95, 8, 6, 8], hurdle: [0.85, 8, 10, 8], crate: [0.94, 8, 6, 8], shiba: [0.72, 8, 18, 10],
  willow: [0.88, 8, 18, 32], cherry: [0.88, 8, 18, 32], maple: [0.88, 8, 18, 32], oak: [0.88, 8, 18, 32],
  drone: [0.66, 8, 12, 10], hawk: [0.66, 8, 18, 22], eagle: [0.66, 8, 18, 22], pelican: [0.72, 10, 18, 22], plane: [0.72, 8, 18, 16],
  storm: [0.98, 12, 16, 18], pipe: [0.92, 8, 12, 8], forest: [0.98, 12, 4, 12], town: [0.97, 8, 4, 16], canopy: [0.99, 12, 4, 18],
};

function* samples(kind) {
  for (const seed of [1, 42, 9001]) for (let r = 0; r < CHIKUN_REGIONS.length; r++) for (const lap of [0, 1]) for (const tick of [0, 37, 131, 244]) {
    const index = REGION_START_SLOTS[r] + lap * 48 + (seed % 5);
    yield { seed, index, tick, o: buildCourseObstacle({ seed, index, tick, x: 300, kind }) };
  }
}

test('every obstacle kind is covered by its art, without leading art or holes (seeds x regions x laps x frames)', () => {
  const report = [];
  for (const kind of GROUND_SKY_KINDS) {
    if (kind === 'pit' || kind === 'waterfall') continue;
    const rule = RULES[kind];
    assert.ok(rule, `${kind} has an alignment rule`);
    const [minCov, lead, hole, over] = rule;
    let worst = { coverage: 1 };
    for (const { seed, index, tick, o } of samples(kind)) {
      const ops = layoutObstacleArt(o, { tick: tick * 7 + seed });
      assert.equal(ops.missing, false, `${kind} #${index}: every sprite is catalogued`);
      const m = measure(o, ops);
      const where = `${kind} seed ${seed} #${index} tick ${tick} (${ops.map(p => p.name + ':' + p.frame).join(' ')})`;
      assert.ok(m.coverage >= minCov, `${where}: coverage ${m.coverage.toFixed(3)} < ${minCov}`);
      assert.ok(m.leadingOverhang <= lead, `${where}: art leads the collision by ${m.leadingOverhang} px`);
      assert.ok(m.maxHole <= hole, `${where}: an empty hole of ${m.maxHole} px inside the collision`);
      assert.ok(m.maxOverhang <= over, `${where}: art reaches ${m.maxOverhang.toFixed(1)} px outside the collision`);
      if (m.coverage < worst.coverage) worst = m;
    }
    report.push(`${kind} ${worst.coverage.toFixed(3)}`);
  }
  assert.ok(report.length >= 20);
});

test('waterfall: the rock column is covered; pits and waterfalls sit on their gap exactly', () => {
  for (const { o, tick } of samples('waterfall')) {
    const ops = layoutObstacleArt(o, { tick });
    const column = o.shapes[1];
    const m = measure(o, ops, { shapes: [column] });
    assert.ok(m.coverage >= 0.98, `waterfall #${o.index}: column coverage ${m.coverage}`);
    assert.ok(m.maxHole <= 4);
    // the scrolling sheet stays on the curtain, inside the column
    for (const p of ops.filter(p => p.name.startsWith('waterfall-sheet'))) {
      assert.ok(p.x + p.sx0 >= column.x && p.x + p.sx1 <= column.x + column.width, 'sheet inside the column');
      assert.ok(p.y + p.sy0 >= column.y && p.y + p.sy1 <= 700, 'sheet rows inside the column');
    }
  }
  for (const { o } of samples('pit')) {
    const [p] = layoutObstacleArt(o, {});
    const d = spriteDesc(p.name);
    // the pit sprite's hole spans x 0..420 of its template: the lips land on o.x and o.x + 420
    assert.equal(p.x, o.x + d.x);
    assert.equal(p.y, 690 + d.y);
    assert.ok(p.x <= o.x - 12 && p.x + d.w >= o.x + o.width + 12, 'rims fade out beyond both lips');
  }
});

test('the legacy open-air tree and drone sprites (obstacle-shapes.json) cover their collision', () => {
  // v1 sprites (chikun-open-air-v1) are drawn stretched over o.render; the masks
  // sample them on a reference box, so map collision points into that box.
  const check = (o, mask, frame) => {
    const r = o.render, [bw, bh] = mask.box;
    let inside = 0, covered = 0;
    for (const s of o.shapes) {
      const x0 = s.type === 'circle' ? s.x - s.radius : Math.min(s.ax, s.bx) - s.radius, x1 = s.type === 'circle' ? s.x + s.radius : Math.max(s.ax, s.bx) + s.radius;
      const y0 = s.type === 'circle' ? s.y - s.radius : Math.min(s.ay, s.by) - s.radius, y1 = s.type === 'circle' ? s.y + s.radius : Math.max(s.ay, s.by) + s.radius;
      for (let y = y0 + 1; y < Math.min(y1, 690); y += 2) for (let x = x0 + 1; x < x1; x += 2) {
        if (shapeDistance(s, x, y) > 0) continue;
        inside++;
        const u = (x - r.x) / r.width * bw, v = (y - r.y) / r.height * bh;
        if (maskAt({ cols: mask.cols, frames: mask.frames }, frame, u, v)) covered++;
      }
    }
    return covered / inside;
  };
  const legacy = MASKS.legacy;
  for (let index = 0; index < 60; index++) {
    const o = buildChikunObstacle({ seed: 7, index, tick: index * 11, x: 400 });
    // measured 2026-09-25: tree 0.979-0.988; drone 0.568-0.595 (its capsule is wider
    // than the rotor sprite; legacy flight only replays old evidence, so it is recorded, not redrawn)
    if (o.kind === 'tree') assert.ok(check(o, legacy.tree, 0) >= 0.95, `legacy tree #${index}: ${check(o, legacy.tree, 0).toFixed(3)}`);
    if (o.kind === 'drone') for (let f = 0; f < 8; f++) assert.ok(check(o, legacy.drone, f) >= 0.55, `legacy drone #${index} frame ${f}: ${check(o, legacy.drone, f).toFixed(3)}`);
  }
});

// ---------------------------------------------------------------- layout purity, variants, animation

test('the layout is a pure function of the obstacle and the tick; reduced motion parks animations', () => {
  for (const kind of GROUND_SKY_KINDS) {
    const o = buildCourseObstacle({ seed: 5, index: 17, tick: 90, x: 420, kind });
    const a = JSON.stringify(layoutObstacleArt(o, { tick: 500 })), b = JSON.stringify(layoutObstacleArt(o, { tick: 500 }));
    assert.equal(a, b, `${kind}: same inputs, same draws`);
    for (const p of layoutObstacleArt(o, { tick: 777, reduced: true })) assert.equal(p.frame, 0, `${kind}: reduced motion on frame 0`);
  }
  const bird = buildCourseObstacle({ seed: 5, index: 17, x: 420, kind: 'eagle' });
  const frames = new Set(Array.from({ length: 40 }, (_, t) => layoutObstacleArt(bird, { tick: t * 5 })[0].frame));
  assert.equal(frames.size, 8, 'the eagle flaps through all 8 frames');
  const shiba = buildCourseObstacle({ seed: 5, index: 17, x: 420, kind: 'shiba' });
  assert.equal(new Set(Array.from({ length: 60 }, (_, t) => layoutObstacleArt(shiba, { tick: t * 5 })[0].frame)).size, 12);
});

test('every kind resolves to catalogued art in every region, and every sprite is used', () => {
  const used = new Set();
  for (const r of CHIKUN_REGIONS) for (const kind of GROUND_SKY_KINDS) {
    const index = REGION_START_SLOTS[CHIKUN_REGIONS.indexOf(r)];
    const o = buildCourseObstacle({ seed: 3, index, x: 200, kind });
    const ops = layoutObstacleArt(o, { tick: 999 });
    assert.equal(ops.missing, false, `${kind} in ${r.id}`);
    for (const p of ops) used.add(p.name);
  }
  for (const kind of ['town']) for (const styles of Object.values(BUILDING_STYLES)) for (const s of styles) { used.add('facade-' + s); used.add('cap-' + s); }
  used.add('coin');
  for (const kit of Object.values(OBSTACLE_CATALOG.kits)) for (const name of Object.keys(kit.sprites)) assert.ok(used.has(name), `${name} is drawn somewhere`);
  // region variants read the obstacle's own region, so a variant never flips when the scenery changes
  for (const [kind, map] of Object.entries(OBSTACLE_VARIANTS)) for (const r of CHIKUN_REGIONS) assert.ok(spriteDesc(map[r.id]), `${kind}/${r.id}`);
});

// ---------------------------------------------------------------- loader and drawing

function fakeImages({ fail = () => false } = {}) {
  const dims = new Map(), requested = [];
  for (const kit of Object.values(OBSTACLE_CATALOG.kits)) for (const [, t] of files(kit)) dims.set(t.src, t);
  const loadImage = url => { requested.push(url); const src = url.slice(OBSTACLE_CATALOG.base.length), d = dims.get(src); return fail(src) || !d ? Promise.reject(new Error('404')) : Promise.resolve({ width: d.w, height: d.h, label: src }); };
  return { loadImage, requested };
}
const makeCanvas = (w, h) => createRecordingCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
async function settle(a, rounds = 30) { for (let i = 0; i < rounds; i++) { await flush(); a.pump(1e9); } }
let clockNow = 0;
const clock = () => clockNow;

test('the loader picks the tier by density, prescales once into whole device slots and keeps only nearby region kits', async () => {
  const imgs = fakeImages();
  const a = createObstacleArt({ loadImage: imgs.loadImage, makeCanvas, clock });
  setObstacleArt(a);
  scheduleObstacleArt(1500, 1.93);   // farmland, early in the loop
  await settle(a);
  const kitsRequested = new Set(imgs.requested.map(u => u.slice(OBSTACLE_CATALOG.base.length).split('/')[0]));
  assert.deepEqual([...kitsRequested].sort(), ['common', 'farmland', 'forest'], 'common, the current and the next region only');
  assert.ok(imgs.requested.every(u => /\/t2\//.test(u) || /-emit\.webp$/.test(u)), 't2 art at density 1.93 (lights ship 1x)');
  const d = 1.93, crown = a.prepared('crown-oak'), sp = spriteDesc('crown-oak');
  assert.equal(crown.slot, Math.round(sp.w * d)); assert.equal(crown.dh, Math.round(sp.h * d));
  const shiba = a.prepared('shiba'), ss = spriteDesc('shiba');
  assert.equal(shiba.canvas.width, ss.frames * (Math.round(ss.w * d) + 2) - 2, 'frames in integer device slots');
  const before = imgs.requested.length;
  scheduleObstacleArt(1510, 1.93); await settle(a);
  assert.equal(imgs.requested.length, before, 'no re-download at the same density');
  // later in the loop: forest is current, farmland drops out after the handover window
  const { REGION_SCHEDULE } = await import('../apps/portal/src/chikun-course-regions.mjs');
  scheduleObstacleArt(REGION_SCHEDULE[2].startTick + 1100, 1.93); await settle(a);
  assert.deepEqual(a.resident().sort(), ['city', 'common', 'town'].sort(), 'town current, city next');
  assert.ok(!a.resident().includes('farmland'));
  // landscape phone density: t1
  const imgs1 = fakeImages(), b = createObstacleArt({ loadImage: imgs1.loadImage, makeCanvas, clock });
  b.request('common', 1.08); await settle(b);
  assert.ok(imgs1.requested.every(u => /\/t1\//.test(u)));
  a.dispose(); b.dispose();
});

function drawLog(o, view, tick = 900, grade = null) {
  const canvas = createRecordingCanvas(view.pixelWidth, view.pixelHeight);
  const ctx = createRecordingContext(canvas, { transform: [view.density, 0, 0, view.density, -view.left * view.density, 0] });
  sceneBus.view = view; sceneBus.rig = grade ? { grade, lightsOn: 1, shadowAlpha: 0.1 } : null;
  drawGroundObstacle(ctx, o, tick, false);
  return ctx.log;
}

test('art draws are 1:1 device blits (shadows and lights excepted); a missing sprite keeps the code fallback', async () => {
  const view = buildChikunViewport(390, 844, 3), d = view.density;
  const imgs = fakeImages({ fail: src => src.includes('hurdle-hay') });
  const a = createObstacleArt({ loadImage: imgs.loadImage, makeCanvas, clock });
  setObstacleArt(a);
  scheduleObstacleArt(1500, d); await settle(a);
  const inView = x => view.left + 40 + x;
  for (const kind of ['crate', 'oak', 'eagle', 'drone', 'plane', 'shiba', 'storm', 'pit', 'rock', 'log']) {
    const o = buildCourseObstacle({ seed: 2, index: 3, x: inView(0), kind });
    const log = drawLog(o, view);
    const draws = drawImageCalls(log);
    assert.ok(draws.length >= 1, `${kind} drew art`);
    for (const c of draws.filter(c => c.composite !== 'lighter' && !c.image.soft)) assert.ok(Math.abs(c.sw - c.dw) < 1e-6 && Math.abs(c.sh - c.dh) < 1e-6, `${kind}: scaled blit ${c.sw}x${c.sh} -> ${c.dw}x${c.dh}`);
    assert.ok(log.every(e => e.shadowBlur === 0 && (e.filter === 'none' || e.filter === undefined)), `${kind}: no blur or filter`);
    assert.equal(log.filter(e => e.op === 'fillText').length, 0, `${kind}: no text labels on the art`);
  }
  // the farmland hurdle failed to load: that obstacle falls back to the code-drawn path
  const hurdle = buildCourseObstacle({ seed: 2, index: 0, x: inView(0), kind: 'hurdle' });
  assert.equal(drawObstacleArt(createRecordingContext(createRecordingCanvas(10, 10)), hurdle, 0, false), false);
  assert.ok(a.failed('hurdle-hay'));
  a.dispose();
});

test('at night sprites use graded copies and facades get the grade over their own collision rects', async () => {
  const view = buildChikunViewport(1280, 720, 1);
  const imgs = fakeImages();
  const a = createObstacleArt({ loadImage: imgs.loadImage, makeCanvas, clock });
  setObstacleArt(a);
  const { REGION_SCHEDULE } = await import('../apps/portal/src/chikun-course-regions.mjs');
  const tick = REGION_SCHEDULE[2].startTick + 1200;   // town
  scheduleObstacleArt(tick, 1); await settle(a);
  const night = { W: [120, 150, 220], w: 0.08, D: [16, 24, 58], a: 0.52 };
  const index = REGION_START_SLOTS[2];
  const town = buildCourseObstacle({ seed: 1, index, x: 300, kind: 'town' });
  const log = drawLog(town, view, tick, night);
  const fills = log.filter(e => e.op === 'fillRect' && typeof e.fill === 'string' && e.fill.startsWith('rgba'));
  assert.ok(fills.length >= 3, 'grade fills over the facades');
  for (const f of fills) {
    const [x, y, w, h] = f.args;
    // inside a facade's collision rect, below its (separately graded) cap
    assert.ok(town.shapes.some(r => Math.abs(r.x - x) < 1 && Math.abs(r.width - w) < 1 && y >= r.y && y + h <= 698 + 1), `grade fill ${x},${y} ${w}x${h} stays on a facade rect`);
  }
  assert.ok(log.some(e => e.op === 'drawImage' && e.composite === 'lighter'), 'lit windows added at night');
  const crate = buildCourseObstacle({ seed: 1, index: 2, x: 300, kind: 'crate' });
  a.beginFrame();
  const clog = drawLog(crate, view, tick, night);
  const img = drawImageCalls(clog).find(c => c.composite === 'source-over' && !c.image.soft)?.image;
  assert.ok(img && img !== a.prepared('crate-wood')?.canvas, 'the crate draws from its graded copy');
  a.dispose();
});

test('nothing is drawn for an obstacle beyond either edge of the view (portrait and landscape)', async () => {
  const imgs = fakeImages();
  const a = createObstacleArt({ loadImage: imgs.loadImage, makeCanvas, clock });
  setObstacleArt(a);
  scheduleObstacleArt(1500, 1); await settle(a);
  for (const view of [buildChikunViewport(1280, 720, 1), buildChikunViewport(390, 693, 3)]) {
    const right = view.left + view.width;
    for (const kind of ['storm', 'town', 'forest', 'crate', 'eagle', 'waterfall']) {
      const o = buildCourseObstacle({ seed: 4, index: 9, x: right + 60, kind });
      assert.equal(drawLog(o, view).filter(e => ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText'].includes(e.op)).length, 0, `${kind} beyond the right edge`);
      const gone = buildCourseObstacle({ seed: 4, index: 9, x: view.left - 60 - 600, kind });
      assert.equal(drawLog(gone, view).filter(e => ['drawImage', 'fillRect', 'fill', 'stroke'].includes(e.op)).length, 0, `${kind} past the left edge`);
    }
  }
  a.dispose();
  setObstacleArt(null);
});
