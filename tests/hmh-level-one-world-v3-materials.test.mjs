import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_WORLD_V3_MATERIALS,
  levelOneWorldV3MaterialByKey,
} from '../apps/portal/assets/generated/hmh-level-one-world-v3/hmh-level-one-world-v3-materials.mjs';
import { HMH_LEVEL_ONE_WORLD_V3 } from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';
import {
  forestRiverRuntimeAtlasAssets,
  forestRiverRuntimeGroundAssetForCell,
} from '../apps/portal/src/hmh-terrain-presentation.mjs';
import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';

const ROOT = new URL('..', import.meta.url);

test('World v3 owns one distinct seam-certified material for every terrain family', () => {
  const manifest = HMH_LEVEL_ONE_WORLD_V3_MATERIALS;
  assert.equal(manifest.status, 'runtime-ready-seam-certified');
  assert.equal(manifest.assetCount, 17);
  assert.equal(manifest.assets.length, 17);
  assert.equal(new Set(manifest.assets.map((asset) => asset.code)).size, 17);
  assert.equal(new Set(manifest.assets.map((asset) => asset.key)).size, 17);
  assert.equal(new Set(manifest.assets.map((asset) => asset.path)).size, 17);
  assert.equal(manifest.assets.filter((asset) => asset.code !== 'F').every((asset) => asset.width === 160 && asset.height === 160), true);
  assert.equal(manifest.assets.every((asset) => asset.seamMismatchPixels === 0), true);
  assert.equal(manifest.assets.filter((asset) => asset.code !== 'F').every((asset) => asset.opaque === true), true);
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

test('World v5 forest-river atlas ships every certified base, transition, and elevation tile in one resource', () => {
  const atlas = HMH_LEVEL_ONE_WORLD_V3_MATERIALS.forestRiverAtlas;
  assert.equal(atlas.status, 'runtime-ready-seam-certified');
  assert.deepEqual(atlas.tileGeometry, [128, 64]);
  assert.deepEqual(atlas.logicalPixelGrid, [64, 32]);
  assert.equal(atlas.width, 2048);
  assert.equal(atlas.height, 928);
  assert.equal(atlas.phaseCount, 4);
  assert.equal(atlas.baseTiles, 16);
  assert.equal(atlas.transitionTiles, 192);
  assert.equal(atlas.elevationMasters, 1);
  assert.equal(atlas.totalTiles, 209);
  assert.deepEqual(atlas.tileColorRange, [5, 15]);
  assert.equal(atlas.seamTopology.samples, 260);
  assert.equal(atlas.seamTopology.mismatches, 0);
  assert.equal(forestRiverRuntimeAtlasAssets().length, 1);
});

test('actual expanded Level 1 uses all certified forest transition families with one render layer', () => {
  const plan = buildGroundPlan({ seed: 7301 });
  const families = new Set();
  const phases = new Set();
  for (let y = plan.worldBounds.minY; y <= plan.worldBounds.maxY; y += 1) {
    for (let x = plan.worldBounds.minX; x <= plan.worldBounds.maxX; x += 1) {
      const cell = plan.traversalAt(x, y);
      const asset = forestRiverRuntimeGroundAssetForCell(cell, { seed: 7301 });
      if (!asset?.transitionFamily) continue;
      families.add(asset.transitionFamily);
      phases.add(asset.phase);
      assert.equal(asset.renderLayers, 1);
      assert.equal(asset.src, HMH_LEVEL_ONE_WORLD_V3_MATERIALS.forestRiverAtlas.src);
      assert.equal(asset.handledDirections.length, 4);
    }
  }
  assert.deepEqual([...families].sort(), ['forest-dirt', 'forest-river', 'meadow-forest']);
  assert.deepEqual([...phases].sort(), [0, 1, 2, 3]);
});

test('World v3 material assets and generator are explicit syntax-gate inputs', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /hmh-level-one-world-v3-materials\.mjs/);
  assert.match(syntax, /hmh-level-one-world-v3-materials\.test\.mjs/);
  assert.match(syntax, /build-hmh-level-one-world-v3-materials\.py/);
});
