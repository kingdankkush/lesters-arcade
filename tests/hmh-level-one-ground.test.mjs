import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_LEVEL_ONE_SBS_GROUND, sbsGroundAssetByKey } from '../apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs';
import { HMH_LEVEL_ONE_FINAL_PAINT_GROUND, finalPaintGroundAssetByKey } from '../apps/portal/assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.mjs';
import {
  HMH_LEVEL_ONE_ID,
  levelOneGroundRoleForTile,
  requiredLevelOneGroundRoles,
  selectLevelOneGroundTile,
} from '../apps/portal/src/hmh-level-one-ground.mjs';

function assetPath(asset) {
  return fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url));
}

test('final-paint Level 1 ground manifest ships marketing-quality originals with animated water/shore', () => {
  assert.equal(HMH_LEVEL_ONE_FINAL_PAINT_GROUND.id, 'hmh-level-one-final-paint-ground-v1');
  assert.match(HMH_LEVEL_ONE_FINAL_PAINT_GROUND.sourcePolicy, /original repo-owned/i);
  assert.equal(HMH_LEVEL_ONE_FINAL_PAINT_GROUND.tileWidth, 128);
  assert.equal(HMH_LEVEL_ONE_FINAL_PAINT_GROUND.assetCount >= 18, true);

  for (const role of requiredLevelOneGroundRoles()) {
    assert.equal(Array.isArray(HMH_LEVEL_ONE_FINAL_PAINT_GROUND.roles[role]), true, `${role} role exists`);
    assert.equal(HMH_LEVEL_ONE_FINAL_PAINT_GROUND.roles[role].length > 0, true, `${role} has final paint tiles`);
  }

  const animated = HMH_LEVEL_ONE_FINAL_PAINT_GROUND.assets.filter((asset) => asset.animated);
  assert.equal(animated.some((asset) => asset.role === 'water' && asset.frames >= 6), true, 'water has at least six-frame animation');
  assert.equal(animated.some((asset) => asset.role === 'shore' && asset.frames >= 6), true, 'shore has animated edge detail');

  for (const asset of HMH_LEVEL_ONE_FINAL_PAINT_GROUND.assets) {
    assert.match(asset.key, /^final-paint\/[a-z0-9-]+$/);
    assert.equal(existsSync(assetPath(asset)), true, `${asset.src} exists`);
    assert.equal(asset.width, 128, `${asset.key} width`);
    assert.equal(asset.src.endsWith('.png'), true, `${asset.key} png`);
    if (asset.animated) {
      assert.equal(asset.frameWidth, 128, `${asset.key} frame width`);
      assert.equal(asset.frames >= 4, true, `${asset.key} frame count`);
      assert.equal(asset.sheetWidth, asset.frameWidth * asset.frames, `${asset.key} sheet width`);
    }
  }
});

test('selectLevelOneGroundTile prefers final-paint assets while preserving SBS fallback metadata', () => {
  const grass = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, seed: 7, worldX: 1, worldY: 2, biome: 'forest' });
  assert.equal(grass.key.startsWith('final-paint/'), true);
  assert.equal(grass.role, 'grass');
  assert.equal(finalPaintGroundAssetByKey(grass.key)?.src, grass.src);

  const water = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, seed: 7, worldX: 3, worldY: 4, biome: 'water' });
  assert.equal(water.key.startsWith('final-paint/'), true);
  assert.equal(water.animated, true);
  assert.equal(water.role, 'water');

  assert.equal(selectLevelOneGroundTile({ levelId: 'level-2-litecoin-city', biome: 'water' }), null);
});

test('SBS Level 1 ground manifest preserves CC0 source metadata and required roles', () => {
  assert.equal(HMH_LEVEL_ONE_SBS_GROUND.id, 'hmh-level-one-sbs-ground-v1');
  assert.match(HMH_LEVEL_ONE_SBS_GROUND.license, /CC0|Public Domain/i);
  assert.equal(HMH_LEVEL_ONE_SBS_GROUND.assetCount, 23);

  for (const role of requiredLevelOneGroundRoles()) {
    assert.equal(Array.isArray(HMH_LEVEL_ONE_SBS_GROUND.roles[role]), true, `${role} role exists`);
    assert.equal(HMH_LEVEL_ONE_SBS_GROUND.roles[role].length > 0, true, `${role} has tiles`);
  }
});

test('SBS Level 1 ground assets exist with 128px tile width and cleaned alpha-compatible PNGs', () => {
  for (const asset of HMH_LEVEL_ONE_SBS_GROUND.assets) {
    assert.match(asset.key, /^sbs-cc0\/[a-z0-9-]+$/);
    assert.equal(existsSync(assetPath(asset)), true, `${asset.src} exists`);
    assert.equal(asset.width, 128, `${asset.key} width`);
    assert.equal([64, 72, 88].includes(asset.height), true, `${asset.key} expected height`);
    assert.equal(asset.src.endsWith('.png'), true, `${asset.key} png`);
  }
});

test('levelOneGroundRoleForTile selects water, shore, transitions, and base roles', () => {
  assert.equal(levelOneGroundRoleForTile({ biome: 'water' }), 'water');
  assert.equal(levelOneGroundRoleForTile({ biome: 'desert', neighbors: ['water'] }), 'shore');
  assert.equal(levelOneGroundRoleForTile({ biome: 'forest', neighbors: ['desert'] }), 'grass-to-sand');
  assert.equal(levelOneGroundRoleForTile({ biome: 'road', neighbors: ['forest'] }), 'grass-to-dirt');
  assert.equal(levelOneGroundRoleForTile({ biome: 'road', neighbors: ['desert'] }), 'dirt-to-sand');
  assert.equal(levelOneGroundRoleForTile({ biome: 'rocky' }), 'rocky');
  assert.equal(levelOneGroundRoleForTile({ biome: 'town', theme: 'grass' }), 'grass');
});

test('selectLevelOneGroundTile returns stable Level 1 assets with role metadata', () => {
  const a = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, seed: 42, worldX: 11, worldY: 15, biome: 'forest' });
  const b = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, seed: 42, worldX: 11, worldY: 15, biome: 'forest' });
  assert.deepEqual(a, b);
  assert.equal(a.key.startsWith('final-paint/') || a.key.startsWith('sbs-cc0/'), true);
  assert.equal(a.role, 'grass');
  assert.equal(finalPaintGroundAssetByKey(a.key)?.src ?? sbsGroundAssetByKey(a.key)?.src, a.src);

  const water = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, biome: 'water' });
  assert.equal(water.role, 'water');
  const shore = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, biome: 'desert', neighbors: ['water'] });
  assert.equal(shore.role, 'shore');
  assert.equal(selectLevelOneGroundTile({ levelId: 'level-2-litecoin-city', biome: 'forest' }), null);
});
