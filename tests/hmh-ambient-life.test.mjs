import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY,
  ambientLifeQuotaForBiome,
  planCritterFleeMotion,
  ambientLifeCueForVisibleObject,
} from '../apps/portal/src/hmh-ambient-life.mjs';
import { buildLevelOneCuratedVisibleSceneObjects } from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';

test('WO-106 ambient life policy defines biome quotas without boss-lock clutter', () => {
  assert.equal(HMH_LEVEL_ONE_AMBIENT_LIFE_POLICY.id, 'wo106-level-one-ambient-life-v1');
  for (const biome of ['desert', 'forest', 'road', 'town', 'water', 'rocky']) {
    const quota = ambientLifeQuotaForBiome(biome);
    assert.equal(quota.maxCritters >= 0 && quota.maxCritters <= 2, true, `${biome} critters capped 0-2`);
    assert.equal(quota.maxVehicles >= 0 && quota.maxVehicles <= 2, true, `${biome} vehicles capped 0-2`);
    assert.equal(quota.allowedInBossLock, false, `${biome} ambient life stays out of boss locks`);
  }
});

test('WO-106 critter flee motion is deterministic and moves away from the player', () => {
  const still = planCritterFleeMotion({ critterX: 74, critterY: 6, playerX: 74, playerY: 15, frame: 120 });
  assert.equal(still.state, 'calm');
  assert.equal(still.offsetX, 0);
  assert.equal(still.offsetY, 0);

  const flee = planCritterFleeMotion({ critterX: 74, critterY: 6, playerX: 74, playerY: 8, frame: 120 });
  const again = planCritterFleeMotion({ critterX: 74, critterY: 6, playerX: 74, playerY: 8, frame: 120 });
  assert.deepEqual(flee, again, 'same inputs should be replay-safe');
  assert.equal(flee.state, 'flee');
  assert.equal(flee.triggered, true);
  assert.equal(flee.offsetY < 0, true, 'critter above player should flee farther upward');
  assert.equal(Math.hypot(flee.offsetX, flee.offsetY) > 0.25, true, 'flee offset should be visible');
});

test('WO-106 visible runtime attaches vehicle and critter ambient-life metadata', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 74, playerY: 8, window: 10, frame: 120 });
  const pickup = objects.find((object) => object.assetKey === 'wo106-world/abandoned-pickup');
  const van = objects.find((object) => object.assetKey === 'wo106-world/delivery-van-cache');
  const critter = objects.find((object) => object.assetKey === 'wo106-world/critter-dust-burrow');
  assert.equal(pickup?.ambientLife?.kind, 'vehicle-micro-scene');
  assert.equal(van?.ambientLife?.kind, 'vehicle-micro-scene');
  assert.equal(critter?.ambientLife?.kind, 'critter-flee-cue');
  assert.equal(critter.ambientLife.motion.state, 'flee');
  assert.equal(critter.ambientLife.motion.triggered, true);

  const cue = ambientLifeCueForVisibleObject(critter, { playerX: 74, playerY: 8, frame: 120 });
  assert.equal(cue.kind, 'critter-flee-cue');
  assert.equal(cue.motion.state, 'flee');
});
