import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVEL_1_AUTHORED_LAYOUT,
  LEVEL_2_AUTHORED_LAYOUT,
  getAuthoredDistrictLayout,
  getAuthoredSceneObjects,
  getDistrictEdgeTreatment,
} from '../apps/portal/src/authored-world-layout.mjs';

test('LEVEL_1_AUTHORED_LAYOUT has all 5 Level 1 districts with landmarks and prop clusters', () => {
  const districts = Object.keys(LEVEL_1_AUTHORED_LAYOUT);
  assert.equal(districts.length, 5);
  assert.equal(districts.includes('desertApproach'), true);
  assert.equal(districts.includes('ghostTown'), true);
  assert.equal(districts.includes('countryRoad'), true);
  assert.equal(districts.includes('residentialEdge'), true);
  assert.equal(districts.includes('innerCityThreshold'), true);

  for (const district of districts) {
    const layout = LEVEL_1_AUTHORED_LAYOUT[district];
    assert.ok(layout.landmarks.length >= 1, `${district} should have landmarks`);
    assert.ok(layout.propClusters.length >= 1, `${district} should have prop clusters`);
    assert.ok(layout.edgeTreatment, `${district} should have edge treatment`);
  }
});

test('getAuthoredSceneObjects returns placed objects with world coordinates for Desert Approach', () => {
  const objects = getAuthoredSceneObjects('desert-approach', 'level-1-crypto-wasteland');
  assert.ok(objects.length >= 5, 'Desert Approach should have at least 5 placed objects');

  for (const obj of objects) {
    assert.equal(typeof obj.id, 'string');
    assert.equal(typeof obj.assetKey, 'string');
    assert.equal(typeof obj.role, 'string');
    assert.equal(typeof obj.gridX, 'number');
    assert.equal(typeof obj.gridY, 'number');
    assert.equal(typeof obj.solid, 'boolean');
  }

  // Should include the gas station landmark
  const hasGasStation = objects.some((o) => o.assetKey === 'crypto/landmark-gas-station');
  assert.equal(hasGasStation, true);
});

test('getAuthoredSceneObjects returns Ghost Town with saloon and storefront landmarks', () => {
  const objects = getAuthoredSceneObjects('ghost-town', 'level-1-crypto-wasteland');
  const hasSaloon = objects.some((o) => o.assetKey === 'crypto/ghost-saloon-front');
  const hasStorefront = objects.some((o) => o.assetKey === 'crypto/ghost-boarded-storefront');
  assert.equal(hasSaloon, true);
  assert.equal(hasStorefront, true);
});

test('getAuthoredSceneObjects returns Country Road with crossroads and signposts', () => {
  const objects = getAuthoredSceneObjects('country-road', 'level-1-crypto-wasteland');
  const hasSignpost = objects.some((o) => o.role === 'sign' && o.text);
  assert.equal(hasSignpost, true);
});

test('getAuthoredSceneObjects returns Residential Edge with oasis water features', () => {
  const objects = getAuthoredSceneObjects('residential-edge', 'level-1-crypto-wasteland');
  const hasWater = objects.some((o) => o.role === 'water-strip');
  const hasHedge = objects.some((o) => o.role === 'hedge');
  assert.equal(hasWater, true);
  assert.equal(hasHedge, true);
});

test('getAuthoredSceneObjects returns Inner City Threshold with billboard and barricade', () => {
  const objects = getAuthoredSceneObjects('inner-city-threshold', 'level-1-crypto-wasteland');
  const hasBillboard = objects.some((o) => o.role === 'billboard');
  const hasBarricade = objects.some((o) => o.role === 'wall');
  assert.equal(hasBillboard, true);
  assert.equal(hasBarricade, true);
});

test('LEVEL_2_AUTHORED_LAYOUT has all 4 Level 2 districts', () => {
  const districts = Object.keys(LEVEL_2_AUTHORED_LAYOUT);
  assert.equal(districts.length, 4);
  assert.equal(districts.includes('outerBoulevard'), true);
  assert.equal(districts.includes('financialCore'), true);
  assert.equal(districts.includes('luxuryNeighborhoods'), true);
  assert.equal(districts.includes('penthouseRim'), true);
});

test('getAuthoredSceneObjects returns Level 2 Financial Core with plaza and tower', () => {
  const objects = getAuthoredSceneObjects('financial-core', 'level-2-litecoin-city');
  assert.ok(objects.length >= 3);
  const hasBuilding = objects.some((o) => o.role === 'building');
  assert.equal(hasBuilding, true);
});

test('getDistrictEdgeTreatment returns transition cues for Level 1 districts', () => {
  const desert = getDistrictEdgeTreatment('desert-approach', 'level-1-crypto-wasteland');
  const ghost = getDistrictEdgeTreatment('ghost-town', 'level-1-crypto-wasteland');
  assert.equal(desert.transitionTo, 'ghost-town');
  assert.equal(ghost.transitionTo, 'country-road');
  assert.ok(desert.transitionCue.length > 0);
});

test('getAuthoredDistrictLayout returns null for unknown districts', () => {
  const unknown = getAuthoredDistrictLayout('nonexistent-district', 'level-1-crypto-wasteland');
  assert.equal(unknown, null);
});

test('navigation cues include text labels for player guidance', () => {
  const countryRoad = getAuthoredSceneObjects('country-road', 'level-1-crypto-wasteland');
  const signposts = countryRoad.filter((o) => o.role === 'sign' && o.text);
  assert.ok(signposts.length >= 2, 'Country Road should have at least 2 signposts with text');
});
