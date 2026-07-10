import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  LEVEL_1_AUTHORED_LAYOUT,
  LEVEL_2_AUTHORED_LAYOUT,
  LEVEL_1_EXPANDED_PROPS,
  LEVEL_2_EXPANDED_PROPS,
  LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS,
  LEVEL_1_PIXELLAB_RUNTIME_MAP_UPGRADES,
  LEVEL_1_NOIR_CITY_PREFAB_STAMPS,
  LEVEL_1_WO96_MACRO_MAP_PLAN,
  buildLevelOneNoirPlacementAcceptanceTour,
  getAuthoredRouteNodes,
  getAuthoredDistrictRouteNodes,
  getAuthoredEncounterBeats,
  getAuthoredForegroundSceneObjects,
  getAuthoredDistrictLayout,
  getAuthoredSceneObjects,
  getAllAuthoredSceneObjects,
  getDistrictEdgeTreatment,
} from '../apps/portal/src/authored-world-layout.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

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

test('navigation cues include text labels for player guidance in both levels', () => {
  const countryRoad = getAuthoredSceneObjects('country-road', 'level-1-crypto-wasteland');
  const countrySignposts = countryRoad.filter((o) => o.role === 'sign' && o.text);
  assert.ok(countrySignposts.length >= 2, 'Country Road should have at least 2 signposts with text');

  const level2Districts = ['outer-boulevard', 'financial-core', 'luxury-neighborhoods', 'penthouse-rim'];
  for (const districtId of level2Districts) {
    const signs = getAuthoredSceneObjects(districtId, 'level-2-litecoin-city').filter((o) => o.role === 'sign' && o.text);
    assert.ok(signs.length >= 2, `${districtId} should have at least 2 Level 2 navigation signs`);
  }
});

test('LEVEL_1_EXPANDED_PROPS has richer props for all 5 districts', () => {
  const districts = Object.keys(LEVEL_1_EXPANDED_PROPS);
  assert.equal(districts.length, 5);
  for (const district of districts) {
    const props = LEVEL_1_EXPANDED_PROPS[district];
    assert.ok(props.length >= 10, `${district} should have >= 10 expanded props (got ${props.length})`);
    // Every prop has gridX, gridY, assetKey, role
    for (const p of props) {
      assert.ok(typeof p.gridX === 'number');
      assert.ok(typeof p.gridY === 'number');
      assert.ok(typeof p.assetKey === 'string');
      assert.ok(typeof p.role === 'string');
    }
  }
});

test('LEVEL_2_EXPANDED_PROPS has richer props for all 4 districts', () => {
  const districts = Object.keys(LEVEL_2_EXPANDED_PROPS);
  assert.equal(districts.length, 4);
  for (const district of districts) {
    const props = LEVEL_2_EXPANDED_PROPS[district];
    assert.ok(props.length >= 5, `${district} should have >= 5 expanded props (got ${props.length})`);
  }
});

test('getAllAuthoredSceneObjects returns base + expanded objects', () => {
  const base = getAuthoredSceneObjects('desert-approach', 'level-1-crypto-wasteland');
  const all = getAllAuthoredSceneObjects('desert-approach', 'level-1-crypto-wasteland');
  assert.ok(all.length > base.length, 'getAllAuthoredSceneObjects should return more objects than base');
  // Verify no duplicate IDs
  const ids = new Set(all.map((o) => o.id));
  assert.equal(ids.size, all.length, 'No duplicate IDs in combined objects');
});

test('Level 1 PixelLab candidate upgrades replace generic route reads in the authored map contract', () => {
  const assetKeys = Object.values(LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS);
  const manifest = JSON.parse(readFileSync(repoPath('apps/portal/assets/generated/hmh-coherent-world/level1-reference-style/candidates/level1-pixellab-candidates.manifest.json'), 'utf8'));
  const manifestEntries = new Map(manifest.entries.map((entry) => [entry.key, entry]));
  assert.deepEqual(manifest.knownGaps, [], 'regenerated bridge and extraction-road replacements should retire the old processing gap');
  assert.equal(manifest.runtimeIntegrationStatus.candidateRuntimeAssetCount, assetKeys.length);
  assert.equal(manifest.runtimeIntegrationStatus.integratedVia.includes('getAllAuthoredSceneObjects'), true);
  assert.ok(assetKeys.length >= 16, 'expected a curated runtime set of PixelLab candidates');
  for (const key of assetKeys) {
    assert.equal(key.startsWith('level1-reference-style/candidates/'), true, `${key} should stay inside the PixelLab candidate folder`);
    assert.equal(existsSync(repoPath(`apps/portal/assets/generated/hmh-coherent-world/${key}.png`)), true, `${key}.png should exist`);
    const manifestKey = key.replace('level1-reference-style/candidates/', '');
    assert.equal(manifestEntries.get(manifestKey)?.status, 'candidate-runtime-integrated', `${manifestKey} should be flagged as runtime-integrated in the manifest`);
  }

  const districtUpgrades = Object.entries(LEVEL_1_PIXELLAB_RUNTIME_MAP_UPGRADES);
  assert.equal(districtUpgrades.length, 5, 'each Level 1 district should get a PixelLab map-art upgrade set');
  assert.equal(districtUpgrades.every(([, objects]) => objects.length >= 8), true, 'each district should receive dense, route-readable art upgrades instead of barren map scatter');

  const desert = getAllAuthoredSceneObjects('desert-approach', 'level-1-crypto-wasteland');
  assert.equal(desert.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasStationCanopy && obj.pixelLabRuntimeUpgrade), true);
  assert.equal(desert.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.brokenHighwayLane && obj.role === 'road'), true);
  assert.equal(desert.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.mesaBoulders && obj.role === 'rock'), true);

  const ghostTown = getAllAuthoredSceneObjects('ghost-town', 'level-1-crypto-wasteland');
  assert.equal(ghostTown.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.saloonFalseFront && obj.role === 'landmark'), true);
  assert.equal(ghostTown.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.gasPumpExplosive && obj.role === 'crate'), true);

  const countryRoad = getAllAuthoredSceneObjects('country-road', 'level-1-crypto-wasteland');
  assert.equal(countryRoad.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bridgePlanksRegenerated && obj.role === 'bridge'), true);
  assert.equal(countryRoad.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.animatedRiverStrip && obj.solid === false), true);

  const residential = getAllAuthoredSceneObjects('residential-edge', 'level-1-crypto-wasteland');
  assert.equal(residential.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.farmBarnSilo && obj.role === 'barn'), true);
  assert.equal(residential.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.wornGrassClean && obj.role === 'road'), true);

  const innerCity = getAllAuthoredSceneObjects('inner-city-threshold', 'level-1-crypto-wasteland');
  assert.equal(innerCity.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.bossGateMarkers && obj.role === 'gate'), true);
  assert.equal(innerCity.some((obj) => obj.assetKey === LEVEL_1_PIXELLAB_RUNTIME_ASSET_KEYS.extractionFlareRoadRegenerated && obj.routeBeat === 'extract'), true);
});

test('expanded props include road segments for navigation', () => {
  const desertAll = getAllAuthoredSceneObjects('desert-approach', 'level-1-crypto-wasteland');
  const roads = desertAll.filter((o) => o.role === 'road');
  assert.ok(roads.length >= 20, 'Desert approach should have road segments (got ' + roads.length + ')');
});

test('authored routes define a complete critical path for both campaign levels', () => {
  const level1 = getAuthoredRouteNodes('level-1-crypto-wasteland');
  const level2 = getAuthoredRouteNodes('level-2-litecoin-city');
  assert.equal(level1[0].beat, 'spawn');
  assert.equal(level1.at(-1).beat, 'extract');
  assert.equal(level2[0].beat, 'spawn');
  assert.equal(level2.at(-1).beat, 'extract');
  assert.ok(level1.some((node) => node.beat === 'arena'));
  assert.ok(level2.some((node) => node.beat === 'chokepoint'));
});

test('Level 1 authored route matches the AAA artistic-world critical path', () => {
  const level1 = getAuthoredRouteNodes('level-1-crypto-wasteland');
  assert.deepEqual(level1.map((node) => node.id), [
    'spawn-broken-highway',
    'gas-station-forecourt',
    'ghost-town-main-street',
    'farmstead-side-loop',
    'river-bridge-wash-crossing',
    'desert-boulder-road',
    'second-town-extraction-yard',
    'ltc-extraction-pad',
  ]);
  assert.deepEqual(level1.map((node) => node.beat), [
    'spawn',
    'arena',
    'arena',
    'loop',
    'chokepoint',
    'pressure',
    'boss',
    'extract',
  ]);
  assert.equal(level1.every((node) => node.objective.length > 30), true, 'every route beat should carry implementation-facing objective copy');
  assert.equal(level1.some((node) => /farm/i.test(node.label)), true, 'AAA route includes the farmstead side loop');
  assert.equal(level1.some((node) => /river|wash/i.test(node.label)), true, 'AAA route includes the river/wash crossing');
  assert.equal(level1.some((node) => /boulder|mesa/i.test(node.label)), true, 'AAA route includes the desert boulder road');
  assert.equal(level1.some((node) => /extraction yard/i.test(node.label)), true, 'AAA route includes the second-town extraction yard');
});

test('WO-51 city prefab stamps bind noir city-seam objects to authored Level 1 route beats', () => {
  assert.equal(LEVEL_1_NOIR_CITY_PREFAB_STAMPS.id, 'level1-noir-city-prefab-stamps-v1');
  assert.equal(LEVEL_1_NOIR_CITY_PREFAB_STAMPS.assetPolicy, 'reuse-existing-city-and-curated-assets');
  assert.equal(LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.length >= 6, true);
  assert.deepEqual([...new Set(LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.map((stamp) => stamp.districtId))], ['inner-city-threshold']);
  assert.equal(LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.every((stamp) => stamp.routeBeat && stamp.noirPurpose && stamp.silhouetteSafe === true), true);
  assert.equal(LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.some((stamp) => stamp.routeBeat === 'boss' && /billboard|gate/i.test(stamp.noirPurpose)), true);
  assert.equal(LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.some((stamp) => stamp.routeBeat === 'extract' && /neon|exit|city/i.test(stamp.noirPurpose)), true);

  const innerCity = getAllAuthoredSceneObjects('inner-city-threshold', 'level-1-crypto-wasteland');
  const stampObjects = innerCity.filter((object) => object.source === LEVEL_1_NOIR_CITY_PREFAB_STAMPS.id);
  assert.equal(stampObjects.length, LEVEL_1_NOIR_CITY_PREFAB_STAMPS.stamps.length);
  assert.equal(stampObjects.every((object) => object.noirPrefabStamp === true && object.silhouetteSafe === true), true);
  assert.equal(stampObjects.some((object) => object.role === 'backdrop' && object.solid === false), true);
  assert.equal(stampObjects.some((object) => object.role === 'lamp' && object.solid === false), true);
  assert.equal(stampObjects.some((object) => object.role === 'gate' && object.routeBeat === 'boss'), true);
});

test('WO-51 authored noir placement acceptance tour covers spawn-to-exit route beats in order', () => {
  const tour = buildLevelOneNoirPlacementAcceptanceTour();
  assert.equal(tour.id, 'level1-noir-placement-acceptance-tour-v1');
  assert.deepEqual(tour.steps.map((step) => step.routeBeat), ['spawn', 'arena', 'arena', 'loop', 'chokepoint', 'pressure', 'boss', 'extract']);
  assert.equal(tour.steps.every((step) => step.expectedObjects.length >= 2), true);
  assert.equal(tour.steps.every((step) => step.acceptance.some((rule) => /silhouette|negative space|readable/i.test(rule))), true);
  assert.equal(tour.summary.totalSteps, 8);
  assert.equal(tour.summary.noirPrefabStampCount >= 6, true);
  assert.equal(tour.summary.requiresBrowserTour, true);
});

test('every authored district has at least one route marker object in getAllAuthoredSceneObjects', () => {
  const checks = [
    ['level-1-crypto-wasteland', ['desert-approach', 'ghost-town', 'country-road', 'residential-edge', 'inner-city-threshold']],
    ['level-2-litecoin-city', ['outer-boulevard', 'financial-core', 'luxury-neighborhoods', 'penthouse-rim']],
  ];
  for (const [levelId, districts] of checks) {
    for (const districtId of districts) {
      assert.ok(getAuthoredDistrictRouteNodes(districtId, levelId).length >= 1, `${levelId}/${districtId} should have route node data`);
      const objects = getAllAuthoredSceneObjects(districtId, levelId);
      assert.ok(objects.some((o) => o.id.startsWith(`route-${districtId}-`) && o.objective), `${levelId}/${districtId} should render a route marker`);
    }
  }
});

test('authored encounter beats expose ordered labels and objectives for HUD/design tooling', () => {
  const beats = getAuthoredEncounterBeats('level-2-litecoin-city');
  assert.equal(beats.length, 8);
  assert.deepEqual(beats.map((beat) => beat.index), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(beats.every((beat) => beat.label && beat.objective));
});

test('authored foreground staging adds non-solid near-plane animation cues to every district', () => {
  const checks = [
    ['level-1-crypto-wasteland', ['desert-approach', 'ghost-town', 'country-road', 'residential-edge', 'inner-city-threshold']],
    ['level-2-litecoin-city', ['outer-boulevard', 'financial-core', 'luxury-neighborhoods', 'penthouse-rim']],
  ];
  for (const [levelId, districts] of checks) {
    for (const districtId of districts) {
      const foregrounds = getAuthoredForegroundSceneObjects(districtId, levelId);
      assert.ok(foregrounds.length >= 2, `${levelId}/${districtId} should have foreground staging`);
      assert.ok(foregrounds.every((o) => o.solid === false), 'foreground staging should never block traversal');
      assert.ok(foregrounds.every((o) => o.foregroundBand && o.animationCue && o.drawOrderBias > 0));
      const allObjects = getAllAuthoredSceneObjects(districtId, levelId);
      assert.ok(allObjects.some((o) => o.foregroundBand === 'near'), `${levelId}/${districtId} should render near-plane foreground objects`);
    }
  }
});

test('Level 1 districts expose AAA critical-path signposts and farm/river/desert/extraction setpieces', () => {
  const desert = getAllAuthoredSceneObjects('desert-approach', 'level-1-crypto-wasteland');
  const country = getAllAuthoredSceneObjects('country-road', 'level-1-crypto-wasteland');
  const residential = getAllAuthoredSceneObjects('residential-edge', 'level-1-crypto-wasteland');
  const innerCity = getAllAuthoredSceneObjects('inner-city-threshold', 'level-1-crypto-wasteland');
  const all = [...desert, ...country, ...residential, ...innerCity];
  const signText = all.filter((obj) => obj.role === 'sign' && obj.text).map((obj) => obj.text).join(' | ');

  assert.match(signText, /BROKEN HIGHWAY/i);
  assert.match(signText, /GAS STATION/i);
  assert.match(signText, /FARMSTEAD/i);
  assert.match(signText, /RIVER BRIDGE|WASH CROSSING/i);
  assert.match(signText, /BOULDER ROAD|MESA CUT/i);
  assert.match(signText, /EXTRACTION YARD/i);

  assert.equal(residential.some((obj) => ['farm', 'crop', 'silo', 'barn'].includes(obj.role)), true, 'residential-edge should include a farmstead side-loop setpiece');
  assert.equal(country.some((obj) => obj.role === 'bridge' || obj.role === 'water-strip'), true, 'country-road should include river/wash crossing staging');
  assert.equal(desert.some((obj) => obj.id.includes('boulder-road') || obj.role === 'rock'), true, 'desert approach should include boulder/mesa road staging');
  assert.equal(innerCity.some((obj) => obj.role === 'gate' || /extraction/i.test(obj.text ?? '')), true, 'inner-city threshold should include extraction-yard staging');
});

test('WO-96 Level 1 macro map defines six approved-plan biomes and a full critical path', () => {
  const plan = LEVEL_1_WO96_MACRO_MAP_PLAN;
  assert.equal(plan.status, 'approval-required-before-asset-generation');
  assert.equal(plan.approvalGate.includes('Justin must approve'), true);
  assert.equal(plan.acceptanceSeed, 1337);
  assert.deepEqual(plan.criticalPath, [
    'neon-city-core',
    'industrial-yard',
    'old-canal-riverfront',
    'lakeside-park-old-growth',
    'farmstead-outskirts',
    'extraction-plaza',
  ]);
  assert.deepEqual(plan.biomes.map((biome) => biome.id), plan.criticalPath);
  assert.equal(plan.biomes.length, 6);
  assert.equal(new Set(plan.biomes.flatMap((biome) => biome.routeBeats)).has('boss'), true);
  assert.equal(new Set(plan.biomes.flatMap((biome) => biome.routeBeats)).has('extract'), true);
});

test('WO-96 macro map has road trail water connectivity and plan-only POIs', () => {
  const plan = LEVEL_1_WO96_MACRO_MAP_PLAN;
  const connectorTypes = new Set(plan.biomes.flatMap((biome) => biome.connectors.map((connector) => connector.split(':')[0])));
  assert.deepEqual([...connectorTypes].sort(), ['road', 'trail', 'water']);
  const biomeIds = new Set(plan.biomes.map((biome) => biome.id));
  for (const biome of plan.biomes) {
    assert.equal(biome.pois.length >= 3, true, `${biome.id} should include at least three POIs`);
    assert.equal(biome.pois.every((poi) => poi.approval === 'plan-only'), true, `${biome.id} POIs must not imply asset generation approval`);
    assert.equal(biome.connectors.length >= 2, true, `${biome.id} should have multiple readable connectors`);
    for (const connector of biome.connectors) {
      const [, target] = connector.split(':');
      assert.equal(biomeIds.has(target), true, `${connector} should target a known biome`);
    }
  }
  assert.equal(existsSync(repoPath(LEVEL_1_WO96_MACRO_MAP_PLAN.overlayDocument)), true);
});
