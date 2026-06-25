import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_LEVEL_ONE_WASTELAND_POIS,
  HMH_LEVEL_TWO_LITECOIN_CITY_POIS,
} from '../apps/portal/src/hmh-campaign-levels.mjs';
import { getAllAuthoredSceneObjects } from '../apps/portal/src/authored-world-layout.mjs';
import { loadHMHGame } from '../apps/portal/src/games/hmh/loader.mjs';
import {
  HMH_FINAL_BOSS_ANIMATION_PACK,
  finalBossAnimationAssetByActorState,
} from '../apps/portal/assets/generated/hmh-final-boss-animations/hmh-final-boss-animations-manifest.mjs';
import {
  HMH_LEVEL_TWO_FINAL_CITY_ASSETS,
  levelTwoFinalCityAssetByKey,
} from '../apps/portal/assets/generated/hmh-coherent-world/level2-final-city/level2-final-city-manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const states = ['intro', 'idle', 'attack-tell', 'attack', 'hit', 'death'];
const levelOneBossIds = [
  'rug-pull-baron',
  ...HMH_LEVEL_ONE_WASTELAND_POIS.map((poi) => poi.miniBoss.id),
];
const levelTwoBossIds = HMH_LEVEL_TWO_LITECOIN_CITY_POIS.map((poi) => poi.miniBoss.id);
const requiredBossIds = [...new Set([...levelOneBossIds, ...levelTwoBossIds])];

function assertLocalAssetExists(asset) {
  const relative = asset.src.replace(/^\.\//, 'apps/portal/');
  assert.equal(existsSync(new URL(`../${relative}`, import.meta.url)), true, `${asset.key} should exist on disk at ${relative}`);
}

test('final boss animation pack covers authored Level 1 and Level 2 bosses with readable combat states', () => {
  assert.equal(HMH_FINAL_BOSS_ANIMATION_PACK.sourcePolicy.includes('Original repo-owned'), true);
  assert.equal(HMH_FINAL_BOSS_ANIMATION_PACK.actorCount >= requiredBossIds.length, true);
  assert.equal(HMH_FINAL_BOSS_ANIMATION_PACK.states.length >= states.length, true);

  for (const actorId of requiredBossIds) {
    for (const state of states) {
      const asset = finalBossAnimationAssetByActorState(actorId, state);
      assert.ok(asset, `${actorId}/${state} should have a final boss animation sheet`);
      assert.equal(asset.actorId, actorId);
      assert.equal(asset.state, state);
      assert.equal(asset.animated, true);
      assert.equal(asset.directions, 8);
      assert.equal(asset.framesPerDirection >= 4, true);
      assert.equal(asset.frameWidth >= 64, true);
      assert.equal(asset.frameHeight >= 80, true);
      assertLocalAssetExists(asset);
    }
  }
});

test('HMH lazy loader exposes final boss animation pack for runtime/UI consumers', async () => {
  const hmh = await loadHMHGame();
  assert.ok(hmh.HMH_FINAL_BOSS_ANIMATION_PACK);
  assert.equal(hmh.HMH_FINAL_BOSS_ANIMATION_PACK.actorCount, HMH_FINAL_BOSS_ANIMATION_PACK.actorCount);
  assert.ok(hmh.HMH_FINAL_BOSS_ANIMATION_PACK.assetCount >= requiredBossIds.length * states.length);
});

test('Level 2 final city world pack ships authored district props and animated setpieces', () => {
  assert.equal(HMH_LEVEL_TWO_FINAL_CITY_ASSETS.sourcePolicy.includes('Original repo-owned'), true);
  assert.equal(HMH_LEVEL_TWO_FINAL_CITY_ASSETS.assetCount >= 20, true);
  const requiredKeys = [
    'level2-final-city/ltc-monument-fountain',
    'level2-final-city/harbor-crane-swing',
    'level2-final-city/bridge-exploiter-gate',
    'level2-final-city/chrome-tower-facade',
    'level2-final-city/elevator-shaft-glow',
    'level2-final-city/privacy-hedge-wall',
    'level2-final-city/mining-rig-array',
    'level2-final-city/cooling-vent-steam',
    'level2-final-city/artisan-kiln-glow',
    'level2-final-city/park-greenhouse-dome',
    'level2-final-city/rooftop-helipad-lights',
    'level2-final-city/storm-billboard-ngmi',
  ];
  for (const key of requiredKeys) {
    const asset = levelTwoFinalCityAssetByKey(key);
    assert.ok(asset, `${key} should be in the final city manifest`);
    assert.equal(asset.key, key);
    assert.equal(asset.animated, true);
    assert.equal(asset.frameWidth > 0, true);
    assert.equal(asset.frameHeight > 0, true);
    assertLocalAssetExists(asset);
  }
});

test('Level 2 authored layouts consume final city art across all city districts', () => {
  const checks = new Map([
    ['outer-boulevard', ['level2-final-city/ltc-monument-fountain', 'level2-final-city/ticker-billboard-loop']],
    ['financial-core', ['level2-final-city/chrome-tower-facade', 'level2-final-city/elevator-shaft-glow', 'level2-final-city/mining-rig-array']],
    ['luxury-neighborhoods', ['level2-final-city/privacy-hedge-wall', 'level2-final-city/artisan-kiln-glow', 'level2-final-city/park-greenhouse-dome']],
    ['penthouse-rim', ['level2-final-city/rooftop-helipad-lights', 'level2-final-city/storm-billboard-ngmi']],
  ]);
  for (const [districtId, keys] of checks) {
    const objects = getAllAuthoredSceneObjects(districtId, 'level-2-litecoin-city');
    for (const key of keys) {
      assert.equal(objects.some((obj) => obj.assetKey === key), true, `${districtId} should consume ${key}`);
    }
  }
});
