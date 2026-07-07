import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_LEVEL_ONE_WO97_WORLD_ASSETS,
  levelOneWo97WorldAssetByKey,
} from '../apps/portal/assets/generated/hmh-coherent-world/level1-wo97-six-biome/level1-wo97-six-biome-manifest.mjs';

const EXPECTED_BIOMES = [
  'neon-city-core',
  'industrial-yard',
  'old-canal-riverfront',
  'lakeside-park-old-growth',
  'farmstead-outskirts',
  'extraction-plaza',
];

const EXPECTED_FAMILIES = [
  'ground',
  'water',
  'vegetation',
  'buildings',
  'vehicles',
  'critters',
  'poi',
];

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

function assetPath(asset) {
  return fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url));
}

test('WO-97 manifest ships six approved Level 1 biomes and seven required asset families', () => {
  const manifest = HMH_LEVEL_ONE_WO97_WORLD_ASSETS;
  assert.equal(manifest.id, 'hmh-level-one-wo97-six-biome-world-assets-v1');
  assert.equal(manifest.levelId, 'level-1-crypto-wasteland');
  assert.equal(manifest.status, 'approved-generated-runtime-ready');
  assert.match(manifest.sourcePolicy, /original repo-owned/i);
  assert.match(manifest.sourcePolicy, /no third-party pixels copied/i);
  assert.deepEqual(manifest.biomes.map((biome) => biome.id), EXPECTED_BIOMES);
  assert.deepEqual(manifest.families, EXPECTED_FAMILIES);
  assert.equal(manifest.assetCount, EXPECTED_BIOMES.length * EXPECTED_FAMILIES.length);
  assert.equal(manifest.assets.length, manifest.assetCount);
});

test('WO-97 asset matrix has exactly one runtime asset for every biome/family pair', () => {
  const pairs = new Set(HMH_LEVEL_ONE_WO97_WORLD_ASSETS.assets.map((asset) => `${asset.biomeId}/${asset.family}`));
  assert.equal(pairs.size, EXPECTED_BIOMES.length * EXPECTED_FAMILIES.length);
  for (const biome of EXPECTED_BIOMES) {
    for (const family of EXPECTED_FAMILIES) {
      assert.equal(pairs.has(`${biome}/${family}`), true, `${biome}/${family} exists`);
      const key = `level1-wo97-six-biome/${biome}-${family}`;
      const asset = levelOneWo97WorldAssetByKey(key);
      assert.ok(asset, `${key} lookup works`);
      assert.equal(asset.biomeId, biome);
      assert.equal(asset.family, family);
      assert.equal(asset.key, key);
    }
  }
});

test('WO-97 files exist, have stable dimensions, and animated assets expose sprite-sheet metadata', () => {
  for (const asset of HMH_LEVEL_ONE_WO97_WORLD_ASSETS.assets) {
    assert.match(asset.key, /^level1-wo97-six-biome\/[a-z0-9-]+-(ground|water|vegetation|buildings|vehicles|critters|poi)$/);
    assert.equal(existsSync(assetPath(asset)), true, `${asset.src} exists`);
    assert.equal(asset.frameWidth > 0, true, `${asset.key} frameWidth`);
    assert.equal(asset.frameHeight > 0, true, `${asset.key} frameHeight`);
    assert.equal(asset.width > 0, true, `${asset.key} width`);
    assert.equal(asset.height > 0, true, `${asset.key} height`);
    if (asset.animated) {
      assert.equal(['water', 'critters', 'poi'].includes(asset.family), true, `${asset.key} only approved animated families animate`);
      assert.equal(asset.frames >= 4, true, `${asset.key} has enough frames`);
      assert.equal(asset.sheetWidth, asset.frameWidth * asset.frames, `${asset.key} sheet width matches frames`);
      assert.equal(asset.sheetHeight, asset.frameHeight, `${asset.key} sheet height matches frame height`);
      assert.equal(asset.frameMs > 0, true, `${asset.key} frameMs`);
    } else {
      assert.equal(asset.frames, 1, `${asset.key} static frame count`);
      assert.equal(asset.width, asset.frameWidth, `${asset.key} static width`);
      assert.equal(asset.height, asset.frameHeight, `${asset.key} static height`);
    }
  }
});

test('WO-97 contact sheets and documentation exist for approval review', () => {
  const manifest = HMH_LEVEL_ONE_WO97_WORLD_ASSETS;
  for (const family of EXPECTED_FAMILIES) {
    const contactSheet = manifest.contactSheets[family];
    assert.ok(contactSheet, `${family} contact sheet declared`);
    assert.equal(existsSync(repoPath(contactSheet)), true, `${contactSheet} exists`);
  }
  const docPath = repoPath('docs/game-design/hmh-wo97-world-assets.md');
  assert.equal(existsSync(docPath), true);
  const doc = readFileSync(docPath, 'utf8');
  assert.match(doc, /Asset count: 42/);
  for (const biome of HMH_LEVEL_ONE_WO97_WORLD_ASSETS.biomes) {
    assert.match(doc, new RegExp(biome.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
