import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { generateDistrictGrid } from '../apps/portal/src/district-generator.mjs';
import { buildCampaignWorldSetup, getHmhCampaignLayout } from '../apps/portal/src/hmh-campaign-runtime.mjs';
import { getAllAuthoredSceneObjects } from '../apps/portal/src/authored-world-layout.mjs';
import {
  HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS,
  levelThreeFinalGetawayAssetByKey,
} from '../apps/portal/assets/generated/hmh-coherent-world/level3-final-getaway/level3-final-getaway-manifest.mjs';
import {
  HMH_LEVEL_THREE_FINAL_GROUND,
  levelThreeFinalGroundAssetByKey,
} from '../apps/portal/assets/generated/hmh-level-three-ground/final-getaway/level3-final-getaway-ground-manifest.mjs';
import {
  HMH_LEVEL_THREE_ID,
  requiredLevelThreeGroundRoles,
  selectLevelThreeGroundTile,
} from '../apps/portal/src/hmh-level-three-ground.mjs';

function assetPath(asset) {
  return fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url));
}

test('Level 3 final getaway world pack ships animated authored setpieces for the finale route', () => {
  assert.equal(HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS.id, 'hmh-level-three-final-getaway-v1');
  assert.match(HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS.sourcePolicy, /original repo-owned/i);
  assert.equal(HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS.assetCount >= 24, true);
  const requiredKeys = [
    'level3-final-getaway/penthouse-evac-lane',
    'level3-final-getaway/helipad-evac-chopper',
    'level3-final-getaway/skybridge-fracture-span',
    'level3-final-getaway/warning-rail-blink',
    'level3-final-getaway/mainnet-train-roof-car',
    'level3-final-getaway/armored-conductor-car',
    'level3-final-getaway/speed-line-billboard',
    'level3-final-getaway/finale-storm-clouds',
    'level3-final-getaway/overhead-pursuit-drone',
    'level3-final-getaway/extraction-car-beacon',
  ];
  for (const key of requiredKeys) {
    const asset = levelThreeFinalGetawayAssetByKey(key);
    assert.ok(asset, `${key} should exist in manifest`);
    assert.equal(asset.key, key);
    assert.equal(asset.animated, true);
    assert.equal(asset.frameWidth > 0, true);
    assert.equal(asset.frameHeight > 0, true);
    assert.equal(existsSync(assetPath(asset)), true, `${asset.src} exists`);
  }
});

test('Level 3 final getaway ground pack covers rooftop, glass, train, rail, storm, and speed texture roles', () => {
  assert.equal(HMH_LEVEL_THREE_FINAL_GROUND.id, 'hmh-level-three-final-getaway-ground-v1');
  assert.match(HMH_LEVEL_THREE_FINAL_GROUND.sourcePolicy, /original repo-owned/i);
  assert.equal(HMH_LEVEL_THREE_FINAL_GROUND.tileWidth, 128);
  for (const role of requiredLevelThreeGroundRoles()) {
    assert.equal(Array.isArray(HMH_LEVEL_THREE_FINAL_GROUND.roles[role]), true, `${role} role exists`);
    assert.equal(HMH_LEVEL_THREE_FINAL_GROUND.roles[role].length > 0, true, `${role} has ground tiles`);
  }
  const animated = HMH_LEVEL_THREE_FINAL_GROUND.assets.filter((asset) => asset.animated);
  assert.equal(animated.some((asset) => asset.role === 'speed-lines' && asset.frames >= 6), true);
  assert.equal(animated.some((asset) => asset.role === 'storm-runoff' && asset.frames >= 6), true);
  for (const asset of HMH_LEVEL_THREE_FINAL_GROUND.assets) {
    assert.match(asset.key, /^level3-ground\/[a-z0-9-]+$/);
    assert.equal(asset.width, 128, `${asset.key} width`);
    assert.equal(existsSync(assetPath(asset)), true, `${asset.src} exists`);
  }
});

test('selectLevelThreeGroundTile returns stable final getaway ground and ignores other levels', () => {
  const trainA = selectLevelThreeGroundTile({ levelId: HMH_LEVEL_THREE_ID, seed: 9, worldX: 20, worldY: 3, biome: 'pavement', theme: 'train' });
  const trainB = selectLevelThreeGroundTile({ levelId: HMH_LEVEL_THREE_ID, seed: 9, worldX: 20, worldY: 3, biome: 'pavement', theme: 'train' });
  assert.deepEqual(trainA, trainB);
  assert.equal(trainA.role, 'train-roof');
  assert.equal(levelThreeFinalGroundAssetByKey(trainA.key)?.src, trainA.src);

  const storm = selectLevelThreeGroundTile({ levelId: HMH_LEVEL_THREE_ID, seed: 9, worldX: 31, worldY: 8, biome: 'water', theme: 'storm' });
  assert.equal(storm.role, 'storm-runoff');
  assert.equal(storm.animated, true);

  assert.equal(selectLevelThreeGroundTile({ levelId: 'level-1-crypto-wasteland', biome: 'pavement' }), null);
});

test('Level 3 campaign runtime uses a distinct authored getaway layout and macro families', () => {
  assert.equal(getHmhCampaignLayout('level-3-the-getaway'), 'level3-authored');
  const setup = buildCampaignWorldSetup({ levelId: 'level-3-the-getaway', seed: 12345, worldWidth: 700, worldHeight: 175 });
  const families = new Set(setup.grid.map((cell) => cell.districtFamily));
  assert.equal(setup.layout, 'level3-authored');
  assert.equal(families.has('penthouse_launch_pad'), true);
  assert.equal(families.has('skybridge_breakpoint'), true);
  assert.equal(families.has('mainnet_express'), true);
  assert.equal(families.has('finale_extraction'), true);

  const { grid, macroCellsX, macroCellsY } = generateDistrictGrid(12345, 700, 175, { layout: 'level3-authored' });
  assert.equal(grid.length, macroCellsX * macroCellsY);
  assert.equal(grid.some((cell) => cell.setPieceAnchors?.some((anchor) => /mainnet|train|extraction|skybridge/i.test(anchor.id))), true);
});

test('Level 3 authored layouts consume final getaway setpieces across route districts', () => {
  const checks = new Map([
    ['penthouse-launch-pad', ['level3-final-getaway/penthouse-evac-lane', 'level3-final-getaway/helipad-evac-chopper']],
    ['skybridge-breakpoint', ['level3-final-getaway/skybridge-fracture-span', 'level3-final-getaway/warning-rail-blink']],
    ['mainnet-express', ['level3-final-getaway/mainnet-train-roof-car', 'level3-final-getaway/armored-conductor-car', 'level3-final-getaway/speed-line-billboard']],
    ['finale-extraction', ['level3-final-getaway/extraction-car-beacon', 'level3-final-getaway/finale-storm-clouds']],
  ]);
  for (const [districtId, keys] of checks) {
    const objects = getAllAuthoredSceneObjects(districtId, 'level-3-the-getaway');
    for (const key of keys) {
      assert.equal(objects.some((obj) => obj.assetKey === key), true, `${districtId} should consume ${key}`);
    }
  }
});
