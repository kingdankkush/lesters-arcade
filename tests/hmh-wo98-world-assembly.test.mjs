import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { levelOneWo97WorldAssetByKey } from '../apps/portal/assets/generated/hmh-coherent-world/level1-wo97-six-biome/level1-wo97-six-biome-manifest.mjs';
import {
  LEVEL_1_WO98_ACCEPTANCE_SEED,
  LEVEL_1_WO98_BIOME_BY_CODE,
  LEVEL_1_WO98_CONNECTORS,
  LEVEL_1_WO98_CRITICAL_PATH,
  LEVEL_1_WO98_MACRO_ROWS,
  LEVEL_1_WO98_MICRO_SCENES,
  LEVEL_1_WO98_WORLD_ASSEMBLY,
  buildLevelOneWo98AcceptanceTour,
  buildLevelOneWo98MacroCells,
  buildLevelOneWo98PlacedAssets,
} from '../apps/portal/src/hmh-wo98-world-assembly.mjs';

function assetPath(asset) {
  return fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url));
}

test('WO-98 assembly preserves the approved 12x7 macro grid and six-biome critical path', () => {
  assert.equal(LEVEL_1_WO98_WORLD_ASSEMBLY.id, 'level1-wo98-six-biome-world-assembly-v1');
  assert.equal(LEVEL_1_WO98_WORLD_ASSEMBLY.status, 'runtime-assembly-ready');
  assert.equal(LEVEL_1_WO98_ACCEPTANCE_SEED, 1337);
  assert.equal(LEVEL_1_WO98_MACRO_ROWS.length, 7);
  assert.equal(LEVEL_1_WO98_MACRO_ROWS.every((row) => row.length === 12), true);
  assert.deepEqual(Object.values(LEVEL_1_WO98_BIOME_BY_CODE), [
    'neon-city-core',
    'industrial-yard',
    'old-canal-riverfront',
    'farmstead-outskirts',
    'lakeside-park-old-growth',
    'extraction-plaza',
  ]);
  assert.deepEqual(LEVEL_1_WO98_CRITICAL_PATH, [
    'neon-city-core',
    'industrial-yard',
    'old-canal-riverfront',
    'lakeside-park-old-growth',
    'farmstead-outskirts',
    'extraction-plaza',
  ]);
});

test('WO-98 macro cells cover every critical-path biome and produce deterministic seed offsets', () => {
  const a = buildLevelOneWo98MacroCells({ seed: 1337 });
  const b = buildLevelOneWo98MacroCells({ seed: 1337 });
  assert.deepEqual(a, b);
  assert.equal(a.length > 30, true, 'assembly should include many occupied macro cells');
  const biomeIds = new Set(a.map((cell) => cell.biomeId));
  for (const biome of LEVEL_1_WO98_CRITICAL_PATH) {
    assert.equal(biomeIds.has(biome), true, `${biome} appears in macro cells`);
  }
  assert.equal(a.every((cell) => Number.isInteger(cell.seedOffset)), true);
  assert.equal(a.every((cell) => cell.groundAssetKey === `level1-wo97-six-biome/${cell.biomeId}-ground`), true);
});

test('WO-98 placed objects only reference approved WO-97 assets that exist on disk', () => {
  const objects = buildLevelOneWo98PlacedAssets({ seed: 1337 });
  assert.equal(objects.length > 50, true, 'assembly should place ground plus authored scene objects');
  for (const object of objects) {
    const asset = levelOneWo97WorldAssetByKey(object.assetKey);
    assert.ok(asset, `${object.assetKey} exists in WO-97 manifest`);
    assert.equal(asset.biomeId, object.biomeId);
    assert.equal(asset.family, object.family);
    assert.equal(existsSync(assetPath(asset)), true, `${asset.src} exists`);
    assert.equal(Number.isFinite(object.worldX), true);
    assert.equal(Number.isFinite(object.worldY), true);
  }
});

test('WO-98 connector network includes road, trail, and water routes across known biomes', () => {
  const connectorTypes = [...new Set(LEVEL_1_WO98_CONNECTORS.map((connector) => connector.type))].sort();
  assert.deepEqual(connectorTypes, ['road', 'trail', 'water']);
  const knownBiomes = new Set(LEVEL_1_WO98_CRITICAL_PATH);
  for (const connector of LEVEL_1_WO98_CONNECTORS) {
    assert.equal(knownBiomes.has(connector.from), true, `${connector.from} known`);
    assert.equal(knownBiomes.has(connector.to), true, `${connector.to} known`);
    assert.equal(connector.cells.length >= 2, true, `${connector.lane} has cell path`);
  }
  const waterLanes = LEVEL_1_WO98_CONNECTORS.filter((connector) => connector.type === 'water').map((connector) => connector.lane);
  assert.deepEqual(waterLanes, ['neon-canal-feed', 'canal-lake-band']);
});

test('WO-98 micro-scenes provide authored POI/prefab coverage instead of random scatter', () => {
  assert.equal(LEVEL_1_WO98_MICRO_SCENES.length, 12);
  const scenesByBiome = new Map();
  for (const scene of LEVEL_1_WO98_MICRO_SCENES) {
    if (!scenesByBiome.has(scene.biomeId)) scenesByBiome.set(scene.biomeId, []);
    scenesByBiome.get(scene.biomeId).push(scene);
    assert.equal(scene.assetFamilies.length >= 3, true, `${scene.id} has family coverage`);
    assert.equal(Boolean(scene.acceptance), true, `${scene.id} has acceptance copy`);
  }
  for (const biome of LEVEL_1_WO98_CRITICAL_PATH) {
    assert.equal((scenesByBiome.get(biome) ?? []).length >= 2, true, `${biome} has multiple micro-scenes`);
  }
});

test('WO-98 seed-1337 acceptance tour follows the full critical path and exposes expected objects', () => {
  const tour = buildLevelOneWo98AcceptanceTour({ seed: 1337 });
  assert.equal(tour.id, 'level1-wo98-seed-1337-acceptance-tour-v1');
  assert.equal(tour.seed, 1337);
  assert.deepEqual(tour.criticalPath, LEVEL_1_WO98_CRITICAL_PATH);
  assert.deepEqual(tour.steps.map((step) => step.biomeId), LEVEL_1_WO98_CRITICAL_PATH);
  assert.equal(tour.summary.connectorTypes.join(','), 'road,trail,water');
  assert.equal(tour.summary.microSceneCount, LEVEL_1_WO98_MICRO_SCENES.length);
  for (const step of tour.steps) {
    assert.equal(step.expectedFamilies.includes('ground'), true, `${step.biomeId} includes ground`);
    assert.equal(step.expectedObjects.length > 0, true, `${step.biomeId} lists representative objects`);
    assert.equal(step.acceptance.every((rule) => /macro|connector|micro/i.test(rule)), true);
  }
});
