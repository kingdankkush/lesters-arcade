import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AREA_ART_MATERIALS, AREA_ART_TILE_MEANS } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { buildTerrainField } from '../apps/hmh-reboot/src/world-v2-terrain-field.mjs';

const root = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/', import.meta.url);
test('all land biomes use authored surface tiles with portable verified full/phone assets', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('world-v2-surfaces.json', root), 'utf8'));
  for (const material of ['meadow', 'earth', 'forest', 'needles', 'soil', 'crop', 'sand', 'wetsand', 'marsh', 'peat', 'paving', 'asphalt', 'gravel', 'rock']) {
    const layer = AREA_ART_MATERIALS[material].grain[0];
    assert.ok(layer.tile.startsWith('surface-'), `${material} retains speckle material`);
    assert.ok(layer.gain <= 1, `${material} amplifies micro grain`);
    const record = manifest.materials.find(row => row.id === layer.tile);
    assert.deepEqual(AREA_ART_TILE_MEANS[layer.tile], record.mean);
    for (const asset of record.assets) {
      const bytes = fs.readFileSync(new URL(asset.file, root));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256);
      assert.equal(bytes.length, asset.bytes);
    }
    assert.ok(record.metrics.neighborLumaDelta < 3, `${material} has high-frequency static`);
    assert.ok(record.metrics.wrapLumaDelta < 3, `${material} breaks at a tile seam`);
  }
});

const summary = { bounds: { minX: 0, minY: 0, maxX: 1024, maxY: 1024 }, terrain: { seed: 'material-test', materials: ['meadow', 'earth'], blend: 0.3, patch: 600, value: 0.14 }, zones: [], trails: [], props: [] };
const emptyWorld = { pieces: [], roads: [] };
test('macro variation is carried once, with a stable authored route spine', () => {
  const open = buildTerrainField({ summary, world: emptyWorld, size: 128 });
  const values = Array.from({ length: 128 * 128 }, (_, i) => open.data[i * 4 + 2]);
  assert.ok(Math.max(...values) - Math.min(...values) > 65, 'macro signal is attenuated twice');
  const routed = buildTerrainField({ summary: { ...summary, trails: [{ points: [{ x: 64, y: 512 }, { x: 960, y: 512 }], material: 'earth', width: 48, halo: 18 }] }, world: emptyWorld, size: 128 });
  for (let x = 128; x < 896; x += 16) {
    const offset = (64 * 128 + Math.floor(x / 8)) * 4;
    assert.ok(routed.data[offset] >= 200, `route disappears at ${x}`);
  }
});
test('contact light fades continuously to zero support instead of rectangular cutoffs', () => {
  const world = { roads: [], pieces: [{ blocker: { shape: { vertices: [{ x: 480, y: 480 }, { x: 544, y: 480 }, { x: 544, y: 544 }, { x: 480, y: 544 }] } }, visible: { height: 100 } }] };
  const field = buildTerrainField({ summary, world, size: 128 });
  const row = y => field.data[(Math.floor(y / 8) * 128 + 64) * 4 + 3];
  let largestStep = 0;
  for (let y = 280; y < 392; y += 8) largestStep = Math.max(largestStep, Math.abs(row(y + 8) - row(y)));
  assert.ok(largestStep <= 5, `a shadow mask cuts by ${largestStep} light levels`);
  assert.equal(row(240), field.neutralLight);
});
