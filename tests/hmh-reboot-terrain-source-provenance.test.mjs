import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decodePng } from '../scripts/hmh-reboot-visual-regression.mjs';

const root = new URL('../', import.meta.url);
const directory = 'apps/portal/assets/generated/hmh-terrain-tiles/';
const sourceDirectory = 'apps/hmh-reboot/assets/source/terrain/';
const ids = ['packed-earth', 'red-rock', 'wet-bank', 'forest-floor', 'crushed-ore', 'industrial-slab', 'road'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = path => readFile(new URL(path, root));
const manifest = async () => JSON.parse(await bytes(`${directory}hmh-terrain-tiles.json`));

test('terrain v4 binds the original Blender recipe, native scene and repeat-render receipt', async () => {
  const m = await manifest();
  assert.equal(m.pipelineId, 'hmh-terrain-tiles-v4');
  assert.equal(m.materialAuthoring, 'blender-ground-and-retained-surface-bakes');
  const source = m.nativeGround;
  assert.equal(source.receipt, `${sourceDirectory}ground-source.json`);
  const receiptBytes = await bytes(source.receipt);
  assert.equal(sha(receiptBytes), source.receiptSha256);
  const receipt = JSON.parse(receiptBytes);
  assert.equal(receipt.pipeline, 'hmh-blender-ground-v1');
  assert.equal(receipt.repeatVerified, true);
  assert.equal(receipt.engine, 'CYCLES');
  assert.equal(sha(await bytes(source.recipe)), source.recipeSha256);
  assert.equal(source.recipeSha256, receipt.sourceScriptSha256);
  assert.equal(sha(await bytes(source.blend)), source.blendSha256);
  assert.equal(source.blendSha256, receipt.nativeSourceSha256);
  assert.deepEqual(source.materialIds, ids);
  for (const oldClaim of ['districtPatches', 'intraDistrictPatches', 'paintedLayering', 'litMicroTerrain']) {
    assert.equal(Object.hasOwn(m, oldClaim), false, `${oldClaim} belonged to the replaced v3 bake`);
  }
});

test('all seven shipped land materials preserve their verified Blender pixels and ground fringes', async () => {
  const m = await manifest();
  assert.ok(m.nativeGround, 'native Blender source binding missing');
  const receipt = JSON.parse(await bytes(m.nativeGround.receipt));
  for (const id of ids) {
    const entry = m.materials.find(p => p.id === id);
    const rendered = receipt.materials.find(p => p.id === id);
    assert.equal(entry.source.kind, 'blender-cycles');
    assert.equal(entry.source.file, `${sourceDirectory}${id}.png`);
    const originalBytes = await bytes(entry.source.file);
    assert.equal(sha(originalBytes), rendered.sha256, id);
    assert.equal(entry.source.sha256, rendered.sha256, id);
    assert.equal(rendered.repeatPixelExact, true, id);
    assert.equal(rendered.repeatFileExact, true, id);
    const original = decodePng(originalBytes), shipped = decodePng(await bytes(`${directory}${id}.png`));
    assert.equal(original.width, 512); assert.equal(original.height, 512); assert.equal(original.channels, 4);
    assert.equal(shipped.channels, 4);
    assert.deepEqual(shipped.pixels, original.pixels, `${id} source pixels changed during packing`);
    assert.equal(sha(shipped.pixels), entry.source.decodedRgbaSha256);
    const fringe = decodePng(await bytes(`${directory}${id}-fringe.png`));
    for (let i = 0; i < fringe.width * fringe.height; i++) {
      for (let c = 0; c < 3; c++) assert.equal(fringe.pixels[i * 4 + c], shipped.pixels[i * 4 + c], `${id} fringe color`);
    }
  }
});

test('ground palettes stay distinct and wrap seams remain normal neighboring texel variation', async () => {
  const m = await manifest();
  const means = new Map();
  for (const id of ids) {
    const png = decodePng(await bytes(`${directory}${id}.png`));
    const sums = [0, 0, 0];
    for (let i = 0; i < png.width * png.height; i++) {
      for (let c = 0; c < 3; c++) sums[c] += png.pixels[i * 4 + c];
      assert.equal(png.pixels[i * 4 + 3], 255, `${id} ground must be opaque`);
    }
    means.set(id, sums.map(sum => sum / (png.width * png.height)));
    const seam = m.seamStatistics[id];
    for (const axis of ['X', 'Y']) assert.ok(seam[`wrap${axis}`] <= Math.max(2, seam[`interior${axis}`] * 3), `${id} ${axis} seam`);
  }
  assert.ok(means.get('packed-earth')[0] > means.get('packed-earth')[2] + 30, 'relay earth should read warm ochre');
  assert.ok(means.get('red-rock')[0] > means.get('red-rock')[1] + 25, 'ravine should read rust red');
  assert.ok(means.get('forest-floor')[1] > means.get('forest-floor')[2] + 12, 'woodland should carry olive leaf litter');
  assert.ok(Math.max(...means.get('industrial-slab')) - Math.min(...means.get('industrial-slab')) < 25, 'concrete should be neutral');
  assert.ok(means.get('road')[0] < means.get('industrial-slab')[0] - 25, 'asphalt should separate from concrete');
});
