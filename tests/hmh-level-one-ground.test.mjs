import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_LEVEL_ONE_SBS_GROUND, sbsGroundAssetByKey } from '../apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs';
import {
  HMH_LEVEL_ONE_ID,
  levelOneGroundRoleForTile,
  requiredLevelOneGroundRoles,
  selectLevelOneGroundTile,
} from '../apps/portal/src/hmh-level-one-ground.mjs';

function assetPath(asset) {
  return fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url));
}

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

test('selectLevelOneGroundTile returns stable SBS assets only for Level 1', () => {
  const a = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, seed: 42, worldX: 11, worldY: 15, biome: 'forest' });
  const b = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, seed: 42, worldX: 11, worldY: 15, biome: 'forest' });
  assert.deepEqual(a, b);
  assert.equal(a.key.startsWith('sbs-cc0/'), true);
  assert.equal(a.role, 'grass');
  assert.equal(sbsGroundAssetByKey(a.key)?.src, a.src);

  const water = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, biome: 'water' });
  assert.equal(water.role, 'water');
  const shore = selectLevelOneGroundTile({ levelId: HMH_LEVEL_ONE_ID, biome: 'desert', neighbors: ['water'] });
  assert.equal(shore.role, 'shore');
  assert.equal(selectLevelOneGroundTile({ levelId: 'level-2-litecoin-city', biome: 'forest' }), null);
});
