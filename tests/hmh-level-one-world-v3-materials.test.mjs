import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_WORLD_V3_MATERIALS,
  levelOneWorldV3MaterialByKey,
} from '../apps/portal/assets/generated/hmh-level-one-world-v3/hmh-level-one-world-v3-materials.mjs';
import { HMH_LEVEL_ONE_WORLD_V3 } from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';

const ROOT = new URL('..', import.meta.url);

test('World v3 owns one distinct seam-certified material for every terrain family', () => {
  const manifest = HMH_LEVEL_ONE_WORLD_V3_MATERIALS;
  assert.equal(manifest.status, 'runtime-ready-seam-certified');
  assert.equal(manifest.assetCount, 17);
  assert.equal(manifest.assets.length, 17);
  assert.equal(new Set(manifest.assets.map((asset) => asset.code)).size, 17);
  assert.equal(new Set(manifest.assets.map((asset) => asset.key)).size, 17);
  assert.equal(new Set(manifest.assets.map((asset) => asset.path)).size, 17);
  assert.equal(manifest.assets.every((asset) => asset.width === 160 && asset.height === 160), true);
  assert.equal(manifest.assets.every((asset) => asset.seamMismatchPixels === 0), true);
  assert.equal(manifest.assets.every((asset) => asset.opaque === true), true);
  assert.equal(manifest.assets.every((asset) => asset.sampling === 'nearest-neighbor'), true);
});

test('every runtime terrain family resolves to its own shipped material PNG', () => {
  const materialKeys = HMH_LEVEL_ONE_WORLD_V3.terrainFamilies.map((family) => family.materialKey);
  assert.equal(new Set(materialKeys).size, 17);
  for (const key of materialKeys) {
    const asset = levelOneWorldV3MaterialByKey(key);
    assert.ok(asset, `missing material ${key}`);
    assert.equal(existsSync(new URL(`../apps/portal/${asset.src.replace('./', '')}`, import.meta.url)), true, `missing PNG ${asset.src}`);
  }
});

test('World v3 material assets and generator are explicit syntax-gate inputs', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /hmh-level-one-world-v3-materials\.mjs/);
  assert.match(syntax, /hmh-level-one-world-v3-materials\.test\.mjs/);
  assert.match(syntax, /build-hmh-level-one-world-v3-materials\.py/);
});
