import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_LEVEL_ONE_SKETCH_EXISTING_ASSET_COVERAGE,
  HMH_LEVEL_ONE_SKETCH_LAYOUT,
  HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS,
  HMH_LEVEL_ONE_SKETCH_PERIMETER,
  HMH_LEVEL_ONE_SKETCH_POIS,
  HMH_LEVEL_ONE_SKETCH_ROAD_NETWORK,
  HMH_LEVEL_ONE_SKETCH_TOWNS_AND_FARMS,
  HMH_LEVEL_ONE_SKETCH_WATERWAYS,
  levelOneSketchExistingAssetKeys,
  levelOneSketchExistingAssetsForLayer,
  levelOneSketchNewAssetRequestsByPriority,
  levelOneSketchPoiById,
  levelOneSketchRegionForPoint,
} from '../apps/portal/src/hmh-level-one-sketch-layout.mjs';
import { HMH_CAMPAIGN_LEVELS } from '../apps/portal/src/hmh-campaign-levels.mjs';

function coherentAssetExists(assetKey) {
  return existsSync(fileURLToPath(new URL(`../apps/portal/assets/generated/hmh-coherent-world/${assetKey}.png`, import.meta.url)));
}

test('Justin sketch layout is reference-only and attached to Level 1 campaign metadata', () => {
  assert.match(HMH_LEVEL_ONE_SKETCH_LAYOUT.source.referencePolicy, /Reference-only/i);
  assert.match(HMH_LEVEL_ONE_SKETCH_LAYOUT.source.referencePolicy, /do not ship/i);
  assert.equal(HMH_LEVEL_ONE_SKETCH_LAYOUT.levelId, 'level-1-crypto-wasteland');

  const levelOne = HMH_CAMPAIGN_LEVELS.find((level) => level.id === 'level-1-crypto-wasteland');
  assert.ok(levelOne);
  assert.equal(levelOne.sketchMapPlan.source.sourceFileLabel, 'Desktop/IMG_5849.png');
  assert.equal(levelOne.sketchAssetRequests.some((request) => request.id === 'farmstead-kit'), true);
});

test('sketch macro regions cover forest, rivers, towns, desert, farms, perimeter cliffs, and building walls', () => {
  const regionIds = HMH_LEVEL_ONE_SKETCH_LAYOUT.regions.map((region) => region.id);
  for (const expected of [
    'west-forest-lake-belt',
    'central-river-bridge-spine',
    'northeast-town-river-block',
    'main-town-west',
    'central-desert-hills',
    'southeast-farm-second-town',
    'south-rock-tree-border',
    'east-tree-town-building-wall',
  ]) {
    assert.equal(regionIds.includes(expected), true, `${expected} exists`);
  }

  assert.equal(levelOneSketchRegionForPoint(12, 18)?.id, 'west-forest-lake-belt');
  assert.equal(levelOneSketchRegionForPoint(55, 52)?.id, 'central-desert-hills');
  assert.equal(levelOneSketchRegionForPoint(88, 74)?.id, 'southeast-farm-second-town');
});

test('sketch perimeter encodes visible diegetic blockers on all four map edges', () => {
  assert.deepEqual(new Set(HMH_LEVEL_ONE_SKETCH_PERIMETER.map((edge) => edge.side)), new Set(['west', 'north', 'east', 'south']));
  for (const edge of HMH_LEVEL_ONE_SKETCH_PERIMETER) {
    assert.equal(edge.materials.length >= 3, true, `${edge.id} has boundary material language`);
    assert.equal(edge.existingAssets.length >= 3, true, `${edge.id} can start from existing repo assets`);
    assert.equal(edge.newAssetsNeeded.length >= 1, true, `${edge.id} records original asset gaps`);
  }
  assert.equal(HMH_LEVEL_ONE_SKETCH_PERIMETER.some((edge) => edge.materials.includes('town building fronts')), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_PERIMETER.some((edge) => edge.materials.includes('rock cliff')), true);
});

test('sketch waterways and roads capture bridges, lake, pond, town roads, and farm loops', () => {
  assert.equal(HMH_LEVEL_ONE_SKETCH_WATERWAYS.some((water) => water.waterType === 'lake-plus-beach'), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_WATERWAYS.some((water) => water.waterType === 'pond'), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_WATERWAYS.flatMap((water) => [...water.crossings]).length >= 5, true);

  const roadIds = HMH_LEVEL_ONE_SKETCH_ROAD_NETWORK.map((road) => road.id);
  assert.equal(roadIds.includes('west-main-town-to-central-bridge'), true);
  assert.equal(roadIds.includes('north-road-to-town-three'), true);
  assert.equal(roadIds.includes('southeast-farm-road-loop'), true);
  assert.equal(roadIds.includes('second-town-inner-loop'), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_ROAD_NETWORK.every((road) => road.requiredGround.some((ground) => /asphalt|paint|bridge/i.test(ground))), true);
});

test('sketch towns, farms, and POIs preserve Justin-marked miniboss/farm/town beats', () => {
  const townFarmIds = HMH_LEVEL_ONE_SKETCH_TOWNS_AND_FARMS.map((item) => item.id);
  assert.deepEqual(new Set(townFarmIds), new Set(['main-town-square', 'town-three-square', 'second-town-square', 'south-farmstead', 'east-farmstead']));
  assert.equal(HMH_LEVEL_ONE_SKETCH_TOWNS_AND_FARMS.filter((item) => item.type === 'farm').length, 2);
  assert.equal(HMH_LEVEL_ONE_SKETCH_TOWNS_AND_FARMS.filter((item) => item.type === 'town').length, 3);

  assert.equal(levelOneSketchPoiById('forest-miniboss-clearing').encounterRole, 'optional-miniboss');
  assert.equal(levelOneSketchPoiById('main-town-miniboss').setpiecePackIds.includes('town-mainstreet-lived-in'), true);
  assert.equal(levelOneSketchPoiById('farm-ambush').setpiecePackIds.includes('farmstead-crop-road'), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_POIS.filter((poi) => poi.encounterRole.includes('miniboss')).length >= 3, true);
});

test('existing sketch asset coverage references only repo-owned coherent-world assets', () => {
  const keys = levelOneSketchExistingAssetKeys();
  assert.equal(keys.includes('crypto/road-straight'), true);
  assert.equal(keys.includes('construct/wood-bridge'), true);
  assert.equal(keys.includes('crypto/desert-cactus'), true);
  assert.equal(keys.includes('construct/fence-segment'), true);

  for (const key of keys) {
    assert.equal(coherentAssetExists(key), true, `${key} exists under hmh-coherent-world`);
  }

  const hardBoundaries = levelOneSketchExistingAssetsForLayer('hard-boundary');
  assert.equal(hardBoundaries.some((item) => item.assetKey === 'crypto/canyon-cliff-edge'), true);
  assert.equal(hardBoundaries.some((item) => item.assetKey === 'crypto/ghost-boarded-storefront'), true);
});

test('new asset requests prioritize AAA road, water, cliff, town, and farm kits before decorative polish', () => {
  const p0 = levelOneSketchNewAssetRequestsByPriority('P0');
  assert.deepEqual(
    new Set(p0.map((request) => request.id)),
    new Set(['aaa-asphalt-road-kit', 'animated-water-system', 'cliff-elevation-kit', 'modular-town-fronts', 'farmstead-kit']),
  );
  assert.equal(HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS.some((request) => request.animation.includes('4-8 frame')), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS.some((request) => request.deliverables.includes('corn rows')), true);
  assert.equal(HMH_LEVEL_ONE_SKETCH_EXISTING_ASSET_COVERAGE.farm.some((item) => item.notes.includes('proxy')), true, 'farm coverage is explicitly proxy-only until new art lands');
});
