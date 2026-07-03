import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_CURATED_LEVEL_KIT, curatedLevelKitAssetByKey } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';
import {
  HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT,
  HMH_LEVEL_ONE_NOIR_ZONE_PLAN,
  HMH_LEVEL_ONE_SPAWN_GATE_REDRESS,
  curatedLevelOneAssetKeys,
  curatedLevelOneAssetRefsForZone,
  curatedLevelOneCriticalPath,
  curatedLevelOneMissingAssetRequests,
  curatedLevelOnePoiById,
  validateCuratedLevelOneWorldContract,
} from '../apps/portal/src/hmh-level-one-curated-world-contract.mjs';
import { HMH_CAMPAIGN_LEVELS } from '../apps/portal/src/hmh-campaign-levels.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

function assetRecordFor(ref) {
  return curatedLevelKitAssetByKey(ref.assetKey);
}

test('curated Level 1 world contract is attached to campaign metadata and uses the curated kit manifest', () => {
  assert.equal(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.id, 'level-1-curated-aaa-world-v1');
  assert.equal(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.levelId, 'level-1-crypto-wasteland');
  assert.equal(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.assetSource.manifestId, HMH_CURATED_LEVEL_KIT.id);
  assert.match(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.qualityBar, /AAA/i);
  assert.match(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.qualityBar, /roguelike shooter/i);

  const levelOne = HMH_CAMPAIGN_LEVELS.find((level) => level.id === 'level-1-crypto-wasteland');
  assert.ok(levelOne);
  assert.equal(levelOne.curatedWorldContract.id, HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.id);
});

test('curated Level 1 world contract defines authored boundaries and safe traversal rules', () => {
  const { boundaries, traversal } = HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT;
  assert.deepEqual(new Set(boundaries.map((boundary) => boundary.side)), new Set(['west', 'north', 'east', 'south']));
  assert.equal(traversal.mainRoute.minClearTiles >= 5, true);
  assert.equal(traversal.arena.minDiameterTiles >= 18, true);
  assert.equal(traversal.boundaryPolicy, 'diegetic-blockers-only');

  for (const boundary of boundaries) {
    assert.equal(boundary.assetRefs.length >= 4, true, `${boundary.id} has curated boundary assets`);
    assert.equal(boundary.materials.length >= 3, true, `${boundary.id} has material language`);
    assert.equal(boundary.gameplayRead.length > 0, true, `${boundary.id} explains gameplay read`);
    assert.equal(boundary.blocksTraversal, true, `${boundary.id} blocks traversal`);
  }
});

test('curated Level 1 critical path has spawn, route, setpiece, mini-boss, boss, and extraction beats', () => {
  const path = curatedLevelOneCriticalPath();
  assert.equal(path[0].beat, 'safe-spawn');
  assert.equal(path.at(-1).beat, 'extraction');
  assert.deepEqual(path.map((node) => node.order), path.map((_, index) => index));
  assert.equal(path.some((node) => node.beat === 'open-arena'), true);
  assert.equal(path.filter((node) => node.beat === 'mini-boss-arena').length >= 3, true);
  assert.equal(path.some((node) => node.beat === 'boss-arena'), true);
  assert.equal(path.every((node) => node.assetRefs.length >= 3), true, 'every route beat has curated visual anchors');
});

test('curated Level 1 POIs and arenas are authored with encounter, camera, and asset grammar', () => {
  const pois = HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.pointsOfInterest;
  assert.equal(pois.length >= 7, true);
  for (const id of ['ghost-saloon-mainstreet', 'dead-forest-mushroom-grove', 'shoreline-ford', 'desert-bone-camp', 'warehouse-gas-station-yard', 'rugpull-gulch-boss-yard', 'ltc-road-extraction']) {
    const poi = curatedLevelOnePoiById(id);
    assert.ok(poi, `${id} exists`);
    assert.equal(poi.assetRefs.length >= 4, true, `${id} uses curated assets`);
    assert.equal(poi.enemyFamilies.length >= 1, true, `${id} has encounter families`);
    assert.equal(poi.arena.cameraFraming.length > 0, true, `${id} has camera framing`);
    assert.equal(poi.arena.negativeSpacePct >= 25, true, `${id} preserves readable negative space`);
    assert.equal(poi.arena.boundaryAssetRoles.length >= 2, true, `${id} has boundary role language`);
  }

  const boss = curatedLevelOnePoiById('rugpull-gulch-boss-yard');
  assert.equal(boss.arena.kind, 'boss-arena');
  assert.equal(boss.enemyFamilies.includes('claim-jumper'), true);
  assert.equal(boss.phasePlan.length >= 3, true);
});

test('WO-48 noir Level 1 zone plan redresses the existing route without starting a full art batch', () => {
  const criticalPathIds = curatedLevelOneCriticalPath().map((zone) => zone.id);
  assert.equal(HMH_LEVEL_ONE_NOIR_ZONE_PLAN.id, 'level-1-noir-zone-plan-v1');
  assert.equal(HMH_LEVEL_ONE_NOIR_ZONE_PLAN.assetPolicy, 'redress-existing-curated-assets-only');
  assert.deepEqual(HMH_LEVEL_ONE_NOIR_ZONE_PLAN.zones.map((zone) => zone.criticalPathZoneId), criticalPathIds);
  assert.equal(HMH_LEVEL_ONE_NOIR_ZONE_PLAN.zones.every((zone) => zone.noirRead && zone.silhouetteRule && zone.groundTreatment), true);
  assert.equal(HMH_LEVEL_ONE_NOIR_ZONE_PLAN.zones.some((zone) => /rain|wet|slick|lamp|shadow/i.test(zone.noirRead)), true);

  assert.equal(HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.zoneId, 'spawn-broken-road');
  assert.equal(HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.safeRadiusTiles >= 10, true);
  assert.equal(HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.firstEnemySpawnMinDistanceTiles >= 16, true);
  assert.equal(HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.holdEnemySeconds >= 6, true);
  assert.equal(HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.forbiddenInsideGate.includes('water'), true);
  assert.equal(HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.forbiddenInsideGate.includes('tall-solid-props'), true);
  assert.equal(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.noirZonePlan.id, HMH_LEVEL_ONE_NOIR_ZONE_PLAN.id);
  assert.equal(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.spawnGateRedress.id, HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.id);
});

test('every curated Level 1 asset reference resolves to a real generated/source file', () => {
  const keys = curatedLevelOneAssetKeys();
  assert.equal(keys.length >= 45, true, `expected many curated asset keys, got ${keys.length}`);
  assert.equal(new Set(keys).size, keys.length, 'asset keys are unique');

  const validation = validateCuratedLevelOneWorldContract();
  assert.deepEqual(validation.missingAssetKeys, []);
  assert.deepEqual(validation.missingFiles, []);
  assert.equal(validation.totalAssetRefs >= keys.length, true);

  for (const ref of HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.assetRefs) {
    const record = assetRecordFor(ref);
    assert.ok(record, `${ref.assetKey} is in curated manifest`);
    assert.equal(existsSync(repoPath(`apps/portal/${record.src.replace(/^\.\//, '')}`)), true, `${record.src} exists`);
    assert.equal(['landmark', 'boundary', 'route', 'arena', 'dressing', 'terrain', 'water', 'enemy', 'hero', 'vfx'].includes(ref.use), true, `${ref.assetKey} has use`);
  }
});

test('zone asset helper returns role-filtered curated assets for runtime/layout tooling', () => {
  const ghostTownLandmarks = curatedLevelOneAssetRefsForZone('ghost-saloon-mainstreet', { use: 'landmark' });
  assert.equal(ghostTownLandmarks.some((ref) => ref.assetKey === 'level-1/building/ghost-saloon-front'), true);

  const shorelineWater = curatedLevelOneAssetRefsForZone('shoreline-ford', { category: 'water' });
  assert.equal(shorelineWater.length >= 3, true);
  assert.equal(shorelineWater.every((ref) => curatedLevelKitAssetByKey(ref.assetKey)?.category === 'water' || ref.use === 'water'), true);

  const bossBoundaries = curatedLevelOneAssetRefsForZone('rugpull-gulch-boss-yard', { use: 'boundary' });
  assert.equal(bossBoundaries.length >= 3, true);
});

test('curated Level 1 missing asset requests are specific tie-together gaps, not a new giant library', () => {
  const requests = curatedLevelOneMissingAssetRequests();
  assert.equal(requests.length >= 6, true);
  assert.equal(requests.every((request) => request.priority === 'P0' || request.priority === 'P1'), true);
  assert.equal(requests.every((request) => request.generatedOnlyAfterLayoutLock === true), true);
  assert.equal(requests.some((request) => request.id === 'road-to-town-transition-corners'), true);
  assert.equal(requests.some((request) => request.id === 'boss-yard-boundary-caps'), true);
  assert.equal(requests.some((request) => request.id === 'shoreline-ford-edge-set'), true);
});

test('curated Level 1 world contract is covered by syntax check gate and design doc', () => {
  const syntaxCheckRunner = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.equal(syntaxCheckRunner.includes('apps/portal/src/hmh-level-one-curated-world-contract.mjs'), true);
  assert.equal(syntaxCheckRunner.includes('tests/hmh-level-one-curated-world-contract.test.mjs'), true);
  assert.equal(existsSync(repoPath('docs/game-design/hard-money-heroes-level-1-curated-world-contract.md')), true);
});
