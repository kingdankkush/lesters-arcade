import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT } from '../apps/portal/src/hmh-level-one-curated-world-contract.mjs';
import { getAllAuthoredSceneObjects } from '../apps/portal/src/authored-world-layout.mjs';
import { HMH_FINAL_SETPIECE_KIT, finalSetpieceAssetByKey } from '../apps/portal/assets/generated/hmh-final-setpiece-kit/hmh-final-setpiece-kit-manifest.mjs';
import {
  HMH_LEVEL_ONE_AAA_ART_DIRECTION,
  HMH_LEVEL_ONE_AAA_ROUTE_ACTS,
  HMH_LEVEL_ONE_POI_INTERACTIVES,
  HMH_LEVEL_ONE_REPLACEMENT_ASSET_KEYS,
  aaaLevelOneRouteActs,
  aaaLevelOnePoiInteractivesForZone,
  aaaLevelOneReplacementAssetForRole,
  validateLevelOneAaaSlicePlan,
} from '../apps/portal/src/hmh-level-one-aaa-slices.mjs';

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

test('Level 1 AAA route acts turn the 8-minute survival run into authored campaign beats', () => {
  assert.equal(HMH_LEVEL_ONE_AAA_ART_DIRECTION.styleId, 'level1-crypto-wasteland-cohesive-aaa-v1');
  assert.match(HMH_LEVEL_ONE_AAA_ART_DIRECTION.paletteRead, /dust/i);
  assert.match(HMH_LEVEL_ONE_AAA_ART_DIRECTION.paletteRead, /cyan/i);
  assert.equal(HMH_LEVEL_ONE_AAA_ART_DIRECTION.badAssetPolicy.includes('replace generic placeholder'), true);

  const acts = aaaLevelOneRouteActs();
  assert.deepEqual(acts.map((act) => act.id), [
    'act-00-safe-road',
    'act-01-saloon-duel',
    'act-02-forest-ford-loop',
    'act-03-desert-gas-yard',
    'act-04-rugpull-boss-extract',
  ]);
  assert.equal(acts[0].timeWindowSeconds[0], 0);
  assert.equal(acts.at(-1).timeWindowSeconds[1], 480);
  assert.equal(acts.every((act) => act.routeZoneIds.length >= 1), true);
  assert.equal(acts.every((act) => act.cameraGoal.length > 0 && act.playerPromise.length > 0), true);
  assert.equal(acts.some((act) => act.lockPolicy === 'boss-yard-lock'), true);
  assert.equal(acts.flatMap((act) => act.routeZoneIds).includes('rugpull-gulch-boss-yard'), true);
});

test('Level 1 POI interactives give every high-visibility beat a tactical object and reward hook', () => {
  const requiredZones = [
    'ghost-saloon-mainstreet',
    'dead-forest-mushroom-grove',
    'shoreline-ford',
    'desert-bone-camp',
    'warehouse-gas-station-yard',
    'rugpull-gulch-boss-yard',
    'ltc-road-extraction',
  ];

  for (const zoneId of requiredZones) {
    const interactives = aaaLevelOnePoiInteractivesForZone(zoneId);
    assert.equal(interactives.length >= 1, true, `${zoneId} has at least one interactive`);
    assert.equal(interactives.every((item) => item.assetKey.startsWith('level-final-setpiece/')), true, `${zoneId} interactives use cohesive final setpiece assets`);
    assert.equal(interactives.every((item) => ['destructible', 'hazard', 'reward-cache', 'gate', 'extraction-cue', 'cover'].includes(item.interactionKind)), true, `${zoneId} has gameplay interaction kinds`);
    assert.equal(interactives.every((item) => item.runtimeHook.length > 0), true, `${zoneId} documents runtime hook`);
  }

  const gasYard = aaaLevelOnePoiInteractivesForZone('warehouse-gas-station-yard');
  assert.equal(gasYard.some((item) => item.interactionKind === 'hazard' && item.chainDetonation === true), true);
  const extraction = aaaLevelOnePoiInteractivesForZone('ltc-road-extraction');
  assert.equal(extraction.some((item) => item.interactionKind === 'extraction-cue'), true);
});

test('cohesive Level 1 replacement assets exist, follow the theme palette, and replace weak generic roles', () => {
  assert.equal(HMH_FINAL_SETPIECE_KIT.assetCount >= 25, true, `expected expanded setpiece kit, got ${HMH_FINAL_SETPIECE_KIT.assetCount}`);

  const requiredKeys = [
    'level-final-setpiece/cohesive-saloon-cover-barrel',
    'level-final-setpiece/cohesive-ghost-road-sign',
    'level-final-setpiece/cohesive-mushroom-spore-ring',
    'level-final-setpiece/cohesive-shoreline-ford-planks',
    'level-final-setpiece/cohesive-desert-cache-crate',
    'level-final-setpiece/cohesive-gas-pump-explosive',
    'level-final-setpiece/cohesive-warehouse-crate-stack',
    'level-final-setpiece/cohesive-boss-yard-gate',
    'level-final-setpiece/cohesive-extraction-flare-road',
  ];

  for (const key of requiredKeys) {
    const asset = finalSetpieceAssetByKey(key);
    assert.ok(asset, `${key} exists`);
    assert.match(asset.notes, /cohesive|palette|replacement|interactive/i);
    assert.equal(asset.src.endsWith('.png'), true);
    assert.equal(existsSync(repoPath(`apps/portal/${asset.src.replace(/^\.\//, '')}`)), true, `${asset.src} exists`);
  }

  assert.equal(HMH_LEVEL_ONE_REPLACEMENT_ASSET_KEYS.every((key) => finalSetpieceAssetByKey(key)), true);
  assert.equal(aaaLevelOneReplacementAssetForRole('ghost-saloon-mainstreet', 'crate-cover'), 'level-final-setpiece/cohesive-saloon-cover-barrel');
  assert.equal(aaaLevelOneReplacementAssetForRole('warehouse-gas-station-yard', 'explosive-hazard'), 'level-final-setpiece/cohesive-gas-pump-explosive');
});

test('authored scene objects consume cohesive replacement assets in live Level 1 districts', () => {
  const ghostTown = getAllAuthoredSceneObjects('ghost-town', 'level-1-crypto-wasteland');
  const countryRoad = getAllAuthoredSceneObjects('country-road', 'level-1-crypto-wasteland');
  const desertApproach = getAllAuthoredSceneObjects('desert-approach', 'level-1-crypto-wasteland');
  const innerCity = getAllAuthoredSceneObjects('inner-city-threshold', 'level-1-crypto-wasteland');

  assert.equal(ghostTown.some((obj) => obj.assetKey === 'level-final-setpiece/cohesive-saloon-cover-barrel' && obj.interactive?.kind === 'destructible'), true);
  assert.equal(countryRoad.some((obj) => obj.assetKey === 'level-final-setpiece/cohesive-mushroom-spore-ring' && obj.interactive?.kind === 'hazard'), true);
  assert.equal(desertApproach.some((obj) => obj.assetKey === 'level-final-setpiece/cohesive-desert-cache-crate' && obj.interactive?.kind === 'reward-cache'), true);
  assert.equal(innerCity.some((obj) => obj.assetKey === 'level-final-setpiece/cohesive-extraction-flare-road' && obj.interactive?.kind === 'extraction-cue'), true);
});

test('main runtime preserves authored interactive metadata when converting scene objects to obstacles', () => {
  const source = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  const mapper = source.slice(source.indexOf('function _buildAuthoredObstaclesForLevel'), source.indexOf('const LEVEL_1_AUTHORED_LAYOUT_KEYS'));
  assert.equal(mapper.includes('interactive: obj.interactive'), true, 'authored obstacle mapper should preserve interactive metadata');
  assert.equal(mapper.includes('hp: obj.hp'), true, 'authored obstacle mapper should preserve destructible/reward-cache hp metadata');
  assert.equal(mapper.includes('sourceZoneId: obj.interactive?.zoneId'), true, 'authored obstacles should carry source POI zone ids for future runtime hooks');
});

test('AAA slice plan is attached to curated world contract and covered by syntax check', () => {
  const validation = validateLevelOneAaaSlicePlan({ curatedWorldContract: HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT });
  assert.deepEqual(validation.missingRouteZones, []);
  assert.deepEqual(validation.missingAssetKeys, []);
  assert.deepEqual(validation.zonesWithoutInteractives, []);
  assert.equal(validation.valid, true);

  assert.equal(HMH_LEVEL_ONE_AAA_ROUTE_ACTS.length, 5);
  assert.equal(HMH_LEVEL_ONE_POI_INTERACTIVES.length >= 9, true);
  assert.equal(HMH_LEVEL_ONE_CURATED_WORLD_CONTRACT.aaaSlicePlan.id, 'level1-aaa-route-interactivity-art-v1');

  const packageJson = JSON.parse(readFileSync(repoPath('package.json'), 'utf8'));
  assert.equal(packageJson.scripts.check.includes('apps/portal/src/hmh-level-one-aaa-slices.mjs'), true);
  assert.equal(packageJson.scripts.check.includes('tests/hmh-level-one-aaa-slices.test.mjs'), true);
  assert.equal(existsSync(repoPath('docs/game-design/hard-money-heroes-level-1-aaa-slices.md')), true);
});
