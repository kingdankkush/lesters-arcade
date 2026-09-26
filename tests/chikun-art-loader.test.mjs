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
  assert.ok(h.requested.every(u => u.startsWith(SCENERY_CATALOG.base + id + '/t2/') || u === SCENERY_CATALOG.base + id + '/t1/far.webp'), 'only this region, only its t2 tier (the hazy far layer ships t1 only)');
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

test('rotation re-prescales from cached sources, keeping the old canvas until the new one lands', async () => {
  const id = regions[0], h = harness();
  h.loader.request(id, 1.5); await settle(h);
  const old = h.loader.layer(id, 'near');
  h.loader.request(id, 1.8);
  assert.equal(h.loader.layer(id, 'near'), old, 'old prescale still drawable');
  await settle(h);
  const fresh = h.loader.layer(id, 'near');
  assert.notEqual(fresh, old); assert.equal(old.canvas.width, 0);
  assert.equal(fresh.canvas.width, Math.round(SCENERY_CATALOG.regions[id].layers.near.width * 1.8));
  // Crossing the tier boundary reloads the other tier.
  h.loader.request(id, 1.1); await settle(h);
  assert.ok(h.requested.some(u => u.includes(`${id}/t1/near.webp`)));
});

test('prescaling draws each source exactly once, scaled only at load time', async () => {
  const id = regions[0], h = harness();
  h.loader.request(id, 2); await settle(h);
  const draws = h.canvases.flatMap(c => drawImageCalls(c.getContext().log));
  const strips = draws.filter(c => /\/(far|mid|near|front)\.webp$/.test(c.image.label ?? ''));
  assert.equal(strips.length, Object.keys(SCENERY_CATALOG.regions[id].layers).length);
});
