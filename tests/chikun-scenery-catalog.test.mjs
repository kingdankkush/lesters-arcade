// The shipped Blender scenery: every catalogued file exists with the recorded
// bytes, SHA-256 and dimensions, the per-region download and decoded-memory
// budgets hold, the strips wrap (seam receipts), and the layer geometry obeys
// the depth model (baseline = 560 + 130 * rate).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SCENERY_CATALOG } from '../apps/chikun/src/scenery-catalog.mjs';
import { CHIKUN_REGIONS } from '../apps/portal/src/chikun-course-regions.mjs';

const ROOT = new URL('../apps/portal/assets/generated/chikun-scenery-v2/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'));
const MB = 1024 * 1024;

function webpSize(buf) {
  // RIFF....WEBP then VP8 / VP8L / VP8X chunk.
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF'); assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
}

function files(region) {
  const out = [];
  for (const layer of Object.values(region.layers)) {
    for (const [tier, t] of Object.entries(layer.tiers)) out.push([tier, t]);
    for (const [tier, t] of Object.entries(layer.emit?.tiers ?? {})) out.push([tier, t]);
  }
  for (const [tier, t] of Object.entries(region.ground?.tiers ?? {})) out.push([tier, t]);
  return out;
}

test('the catalog is generated from the manifest and only references versioned v2 files', () => {
  assert.equal(SCENERY_CATALOG.version, 'chikun-scenery-v2');
  assert.equal(SCENERY_CATALOG.base, '/assets/generated/chikun-scenery-v2/');
  const ids = CHIKUN_REGIONS.map(r => r.id);
  assert.ok(Object.keys(SCENERY_CATALOG.regions).length >= 1);
  for (const [id, region] of Object.entries(SCENERY_CATALOG.regions)) {
    assert.ok(ids.includes(id), id);
    const m = manifest.regions[id];
    assert.deepEqual(JSON.parse(JSON.stringify(region)), JSON.parse(JSON.stringify(m)), `${id}: catalog matches the manifest`);
    for (const [, t] of files(region)) assert.match(t.src, new RegExp(`^${id}/t[12]/[a-z-]+\\.webp$`));
  }
});

test('every file exists with its recorded bytes, SHA-256 and dimensions', () => {
  for (const [id, region] of Object.entries(SCENERY_CATALOG.regions)) for (const [, t] of files(region)) {
    const url = new URL(t.src, ROOT);
    assert.ok(existsSync(url), t.src);
    const buf = readFileSync(url);
    assert.equal(buf.length, t.bytes, `${t.src} bytes`);
    assert.equal(createHash('sha256').update(buf).digest('hex'), t.sha256, `${t.src} sha256`);
    assert.deepEqual(webpSize(buf), [t.w, t.h], `${t.src} dimensions`);
  }
});

test('download and decoded-memory budgets per region', () => {
  for (const [id, region] of Object.entries(SCENERY_CATALOG.regions)) {
    const t2 = region.bytes.t2, t1 = region.bytes.t1;
    assert.ok(t2 <= 1.5 * MB, `${id}: t2 ${t2} B over the 1.5 MB hard cap`);
    assert.ok(t1 <= 0.5 * MB, `${id}: t1 ${t1} B over 0.5 MB`);
    assert.equal(t2, files(region).filter(([tier, t]) => tier === 't2' || (tier === 't1' && !files(region).some(([k, u]) => k === 't2' && u.src.replace('/t2/', '/t1/') === t.src))).reduce((a, [, t]) => a + t.bytes, 0), `${id}: t2 byte total`);
    // Prescaled to the device: memory = logical px * density^2 * 4 B.
    assert.ok(region.logicalPx <= 1.65e6, `${id}: ${region.logicalPx} logical px`);
    // Lights stay at 1x (drawn scaled), so they do not grow with the density.
    assert.ok(region.logicalPx * 4 * 4 + region.emitPx * 4 <= 28 * MB, `${id}: decoded at density 2`);
  }
});

test('layer geometry follows the depth model and every strip wraps', () => {
  const edges = SCENERY_CATALOG.spec.groundEdges;
  assert.equal(edges[0], 560); assert.equal(edges.at(-1), 690);
  for (let i = 1; i < edges.length; i++) assert.ok(edges[i] - edges[i - 1] <= 7 && edges[i] > edges[i - 1]);
  for (const [id, region] of Object.entries(SCENERY_CATALOG.regions)) {
    for (const [name, layer] of Object.entries(region.layers)) {
      assert.ok(layer.width >= 1280, `${id}/${name} width`);
      if (name !== 'front') {
        assert.ok(Math.abs(layer.baseline - (560 + 130 * layer.rate)) <= 2, `${id}/${name} baseline`);
        assert.ok(layer.top + layer.height >= layer.baseline && layer.top + layer.height <= layer.baseline + 8, `${id}/${name} strip ends at its baseline`);
      }
      const receipt = manifest.receipts[`${id}/${name}`];
      assert.ok(receipt?.seam?.ok, `${id}/${name} seam receipt`);
      assert.ok(receipt.render?.scripts && Object.keys(receipt.render.scripts).length >= 5, `${id}/${name} records the Blender script hashes`);
    }
    for (const name of ['far', 'mid', 'near', 'front']) assert.ok(region.layers[name], `${id} ships ${name}`);
    assert.equal(region.ground.bands.length, edges.length - 1);
    for (const [y0, y1, rate] of region.ground.bands) assert.ok(Math.abs(rate - ((y0 + y1) / 2 - 560) / 130) < 1e-4);
    const order = ['far', 'mid', 'near'].map(n => region.layers[n].rate);
    assert.ok(order[0] < order[1] && order[1] < order[2], `${id}: far < mid < near`);
  }
});
