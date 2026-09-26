// The scenery loader: tier choice, one-region-ahead loading, prescale-once to
// the exact device size, per-asset failure isolation, bounded residency.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingCanvas, drawImageCalls } from './chikun-recording-ctx.mjs';
import { createArtLoader, tierFor, CORE_LAYERS } from '../apps/chikun/src/art-loader.mjs';
import { SCENERY_CATALOG } from '../apps/chikun/src/scenery-catalog.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
const regions = Object.keys(SCENERY_CATALOG.regions);

function sizes() {
  const out = new Map();
  for (const region of Object.values(SCENERY_CATALOG.regions)) {
    for (const layer of Object.values(region.layers)) {
      for (const t of Object.values(layer.tiers)) out.set(t.src, t);
      for (const t of Object.values(layer.emit?.tiers ?? {})) out.set(t.src, t);
      for (const sp of layer.sprites ?? []) for (const t of Object.values(sp.tiers)) out.set(t.src, t);
    }
    for (const t of Object.values(region.ground?.tiers ?? {})) out.set(t.src, t);
  }
  return out;
}

function harness({ fail = () => false, hold = false } = {}) {
  const dims = sizes(), requested = [], canvases = [];
  let active = 0, peak = 0;
  const pending = [];
  const loadImage = url => {
    requested.push(url); active++; peak = Math.max(peak, active);
    const src = url.slice(SCENERY_CATALOG.base.length), d = dims.get(src);
    return new Promise((resolve, reject) => {
      const settle = () => { active--; if (fail(src) || !d) reject(new Error('404')); else resolve({ width: d.w, height: d.h, src, label: src }); };
      if (hold) pending.push(settle); else queueMicrotask(settle);
    });
  };
  const makeCanvas = (w, h) => { const c = createRecordingCanvas(w, h); canvases.push(c); return c; };
  let now = 0;
  const loader = createArtLoader({ loadImage, makeCanvas, clock: () => now });
  return { loader, requested, canvases, pending, peak: () => peak, tick: ms => { now += ms; } };
}

async function settle(h, rounds = 12) { for (let i = 0; i < rounds; i++) { await flush(); h.loader.pump(1e9); } }

test('tier: 2x art above density 1.3, 1x otherwise', () => {
  assert.equal(tierFor(1), 't1'); assert.equal(tierFor(1.08), 't1'); assert.equal(tierFor(1.3), 't1');
  assert.equal(tierFor(1.31), 't2'); assert.equal(tierFor(1.93), 't2'); assert.equal(tierFor(2), 't2');
});

test('a request loads only that region, two downloads at a time, and prescales once to the exact device size', async () => {
  assert.ok(regions.length >= 1, 'the catalog ships at least one region');
  const id = regions[0], h = harness(), d = 1.93;
  h.loader.request(id, d);
  await settle(h);
  assert.ok(h.requested.length > 0);
  assert.ok(h.requested.every(u => u.startsWith(SCENERY_CATALOG.base + id + '/t2/') || u === SCENERY_CATALOG.base + id + '/t1/far.webp' || /\/t1\/[a-z]+-emit\.webp$/.test(u)), 'only this region, only its t2 tier (hazy far layer and lights ship t1 only)');
  assert.ok(h.peak() <= 2, 'at most two downloads in flight');
  assert.equal(h.loader.ready(id), true);
  const desc = SCENERY_CATALOG.regions[id];
  for (const name of CORE_LAYERS) {
    const p = h.loader.layer(id, name), g = desc.layers[name];
    assert.equal(p.canvas.width, Math.round(g.width * d), `${name} width`);
    assert.equal(p.canvas.height, Math.round(g.height * d), `${name} height`);
  }
  const ground = h.loader.ground(id);
  assert.equal(ground.bands.length, desc.ground.bands.length);
  for (const [i, b] of ground.bands.entries()) assert.equal(b.w, Math.max(1, Math.round(desc.ground.tiers.t2.rects[i][2] / 2 * d)), `band ${i} period`);
  const before = h.canvases.length;
  h.loader.request(id, d); await settle(h);
  assert.equal(h.canvases.length, before, 'no re-prescale at the same density');
});

test('a failed asset only disables its own layer, and the region is not art-ready without every core layer', async () => {
  const id = regions[0], h = harness({ fail: src => src.endsWith('/mid.webp') });
  h.loader.request(id, 1);
  await settle(h);
  assert.equal(h.loader.layer(id, 'mid'), null);
  assert.equal(h.loader.failed(id, 'mid'), true);
  assert.ok(h.loader.layer(id, 'far') && h.loader.layer(id, 'near'), 'other layers still prescale');
  assert.equal(h.loader.ready(id), false, 'the painters stay until the whole backdrop can switch');
  assert.ok(h.loader.stats().failures.some(f => f.includes('mid')));
});

test('at most two regions stay resident and eviction frees their canvases', async () => {
  const h = harness();
  const ids = regions.length >= 3 ? regions.slice(0, 3) : [regions[0], regions[0], regions[0]];
  h.loader.request(ids[0], 1); await settle(h);
  const first = h.loader.layer(ids[0], 'mid').canvas;
  h.loader.retain([]);
  assert.equal(first.width, 0, 'evicted canvas is zeroed');
  assert.deepEqual(h.loader.resident(), []);
  for (const id of ids) h.loader.request(id, 1);
  h.loader.retain(ids.slice(-2));
  assert.ok(h.loader.resident().length <= 2);
});

// Rendered frames: world.draw() requests each kept region once per frame.
async function frames(h, ids, density, n = 30, ms = 16) {
  for (let i = 0; i < n; i++) { for (const id of ids) h.loader.request(id, density); h.tick(ms); await flush(); h.loader.pump(1e9); }
}
function assetCount(id, { lights = true } = {}) {
  const r = SCENERY_CATALOG.regions[id];
  let n = r.ground ? 1 : 0;
  for (const layer of Object.values(r.layers)) n += 1 + (layer.sprites?.length ?? 0) + (layer.emit && lights ? 1 : 0);
  return n;
}

test('rotation re-prescales from cached sources once the density settles, keeping the old canvas until the new one lands', async () => {
  const id = regions[0], h = harness();
  h.loader.request(id, 1.5); await settle(h);
  const old = h.loader.layer(id, 'near'), loads = h.requested.length;
  h.loader.request(id, 1.8); await settle(h);
  assert.equal(h.loader.layer(id, 'near'), old, 'old prescale still drawable');
  assert.equal(h.requested.length, loads, 'nothing reloads until the density has been stable for a moment');
  await frames(h, [id], 1.8, 20);
  const fresh = h.loader.layer(id, 'near');
  assert.notEqual(fresh, old); assert.equal(old.canvas.width, 0);
  assert.equal(fresh.canvas.width, Math.round(SCENERY_CATALOG.regions[id].layers.near.width * 1.8));
  // Lights stay at their 1x source size, so a same-tier density change keeps them.
  assert.equal(h.requested.length - loads, assetCount(id, { lights: false }), 'each strip, sprite and band set is fetched again exactly once');
});

test('a window drag queues at most one job per asset and re-prescales each asset once, at the final density', async () => {
  const ids = regions.slice(0, 2), h = harness();
  for (const id of ids) h.loader.request(id, 1.4);
  await settle(h);
  const loads = h.requested.length, prescaled = h.loader.stats().prescaled;
  const total = ids.reduce((n, id) => n + assetCount(id), 0);
  for (let f = 0; f <= 60; f++) {
    await frames(h, ids, 1.4 + 0.3 * f / 60, 1);
    assert.ok(h.loader.stats().queued + h.loader.stats().active <= total, `frame ${f}: ${h.loader.stats().queued} jobs queued`);
    for (const id of ids) assert.equal(h.loader.ready(id), true, `frame ${f}: ${id} stays art-ready during the drag`);
  }
  await frames(h, ids, 1.7, 40);
  assert.ok(h.requested.length - loads <= total, `${h.requested.length - loads} image loads for ${total} assets`);
  assert.ok(h.loader.stats().prescaled - prescaled <= total, `${h.loader.stats().prescaled - prescaled} prescales for ${total} assets`);
  for (const id of ids) for (const name of CORE_LAYERS) assert.ok(Math.abs(h.loader.layer(id, name).density - 1.7) < 1e-9, `${id}/${name} lands at the final density`);
});

test('rotating across the tier line keeps the old tier drawing (scaled) until the new tier has landed', async () => {
  const id = regions[0], h = harness();
  // A phone in portrait (density 2, 2x art) rotated to landscape (density ~0.94, 1x art).
  h.loader.request(id, 2); await settle(h);
  const old = h.loader.layer(id, 'near');
  for (let f = 0; f < 40; f++) {
    await frames(h, [id], 0.944, 1);
    assert.equal(h.loader.ready(id), true, `frame ${f}: still art-ready, the painters never come back`);
    for (const name of CORE_LAYERS) assert.ok(h.loader.layer(id, name)?.canvas.width > 0, `frame ${f}: ${name} drawable`);
  }
  assert.ok(h.requested.some(u => u.includes(`${id}/t1/near.webp`)), 'the 1x tier is fetched');
  const fresh = h.loader.layer(id, 'near');
  assert.notEqual(fresh, old); assert.equal(old.canvas.width, 0, 'the 2x prescale is freed once replaced');
  assert.ok(Math.abs(fresh.density - 0.944) < 1e-9 && fresh.src.includes('/t1/'));
  assert.equal(h.loader.tier(0.944), 't1');
  assert.deepEqual(h.loader.resident(), [id]);
});

test('prescaling draws each source exactly once, scaled only at load time', async () => {
  const id = regions[0], h = harness();
  h.loader.request(id, 2); await settle(h);
  const draws = h.canvases.flatMap(c => drawImageCalls(c.getContext().log));
  const strips = draws.filter(c => /\/(far|mid|near|front)\.webp$/.test(c.image.label ?? ''));
  assert.equal(strips.length, Object.keys(SCENERY_CATALOG.regions[id].layers).length);
});
