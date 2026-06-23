import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BESPOKE_ENEMY_VISUAL_KITS,
  bespokeEnemyVisualKitFor,
  buildEncounterEnemyBehaviorProfile,
  buildEncounterSceneObjects,
  buildEncounterTemplateContext,
  buildEncounterTerrainPressure,
  buildEncounterVisualPlan,
  enemyProxyRenderProfile,
} from '../apps/portal/src/hmh-encounter-visuals.mjs';

test('enemyProxyRenderProfile gives authored animal and human POI enemies bespoke proxy-readability treatment', () => {
  const coyote = enemyProxyRenderProfile({ id: 'coyote-pack-runner', state: 'melee-tell' });
  const scorpion = enemyProxyRenderProfile({ id: 'scorpion-ambusher', burrowing: true });
  const caveGoblin = enemyProxyRenderProfile({ id: 'fud-goblin-cave' });
  const captain = enemyProxyRenderProfile({ id: 'bandit-captain' });

  assert.equal(coyote.proxyFamily, 'trenchDegen');
  assert.equal(coyote.scaleMul > 1, true);
  assert.equal(coyote.telegraphStyle, 'dust-lunge-line');
  assert.equal(coyote.anchorBiasY < 0, true);

  assert.equal(scorpion.proxyFamily, 'gasBeast');
  assert.equal(scorpion.telegraphStyle, 'burrow-ring');
  assert.equal(typeof scorpion.accentColor, 'string');

  assert.equal(caveGoblin.proxyFamily, 'trenchDegen');
  assert.equal(caveGoblin.telegraphStyle, 'torch-pop');
  assert.equal(caveGoblin.scaleMul < coyote.scaleMul, true);

  assert.equal(captain.proxyFamily, 'evilBanker');
  assert.equal(captain.scaleMul > 1, true);
});

test('buildEncounterVisualPlan gives authored Dry Forest Cave, Oasis Lakeside, Crossroads, and Mesa visual staging', () => {
  const dryForest = buildEncounterVisualPlan({ poiId: 'dry-forest-cave', arenaLayout: 'cave-mouth-funnel' });
  const oasis = buildEncounterVisualPlan({ poiId: 'oasis-lakeside', arenaLayout: 'sandbar-ring' });
  const crossroads = buildEncounterVisualPlan({ poiId: 'crossroads-trading-post', arenaLayout: 'wagon-circle-crossfire' });
  const mesa = buildEncounterVisualPlan({ poiId: 'mesa-overlook', arenaLayout: 'switchback-sniper-lane' });

  assert.equal(dryForest.telegraphCue.includes('cave mouth'), true);
  assert.equal(dryForest.propClusters.some((cluster) => cluster.id === 'cave-mouth-rocks'), true);
  assert.equal(dryForest.terrainHazards.includes('narrow-bottleneck'), true);

  assert.equal(oasis.telegraphCue.includes('waterline'), true);
  assert.equal(oasis.propClusters.some((cluster) => cluster.id === 'reed-bank-ring'), true);
  assert.equal(oasis.terrainHazards.includes('shallow-water-slow'), true);

  assert.equal(crossroads.propClusters.some((cluster) => cluster.id === 'wagon-circle'), true);
  assert.equal(mesa.propClusters.some((cluster) => cluster.id === 'cliff-switchback'), true);
});


test('buildEncounterSceneObjects turns authored visual plans into stable in-scene prop placements for Dry Forest and Oasis arenas', () => {
  const dryForest = buildEncounterSceneObjects({
    poiId: 'dry-forest-cave',
    arenaLayout: 'cave-mouth-funnel',
    centerX: 42,
    centerY: -18,
  });
  const oasis = buildEncounterSceneObjects({
    poiId: 'oasis-lakeside',
    arenaLayout: 'sandbar-ring',
    centerX: 84,
    centerY: 16,
  });

  assert.equal(dryForest.some((obj) => obj.sceneAssetKey === 'crypto/canyon-cliff-edge' && obj.sceneRole === 'wall'), true);
  assert.equal(dryForest.some((obj) => obj.sceneAssetKey === 'crypto/forest-tree-line' && obj.sceneRole === 'tree'), true);
  assert.equal(dryForest.some((obj) => obj.sceneAssetKey === 'street/street-lamp' && obj.sceneRole === 'lamp'), true);

  assert.equal(oasis.some((obj) => obj.sceneAssetKey === 'construct/river-straight' && obj.sceneRole === 'water-strip' && obj.solid === false), true);
  assert.equal(oasis.some((obj) => obj.sceneAssetKey === 'nature/fallen-log' && obj.sceneRole === 'smallprop'), true);
  assert.equal(oasis.some((obj) => obj.sceneAssetKey === 'street/park-bench' && obj.sceneRole === 'bench'), true);

  for (const obj of [...dryForest, ...oasis]) {
    assert.equal(typeof obj.worldX, 'number');
    assert.equal(typeof obj.worldY, 'number');
    assert.equal(typeof obj.sceneAssetKey, 'string');
    assert.equal(typeof obj.sceneRole, 'string');
  }
});


test('buildEncounterTemplateContext forces the Dry Forest and Oasis authored scene templates at encounter centers and biases nearby cells', () => {
  const dryCenter = buildEncounterTemplateContext({
    poiId: 'dry-forest-cave',
    centerCellX: 20,
    centerCellY: 30,
    cellX: 20,
    cellY: 30,
  });
  const dryNear = buildEncounterTemplateContext({
    poiId: 'dry-forest-cave',
    centerCellX: 20,
    centerCellY: 30,
    cellX: 21,
    cellY: 30,
  });
  const oasisCenter = buildEncounterTemplateContext({
    poiId: 'oasis-lakeside',
    centerCellX: 48,
    centerCellY: 12,
    cellX: 48,
    cellY: 12,
  });

  assert.equal(dryCenter.forceTemplateId, 'crypto_dry_forest_cave');
  assert.equal(dryCenter.templatePoolIds.includes('crypto_dry_forest_cave'), true);
  assert.equal(dryNear.forceTemplateId, null);
  assert.equal(dryNear.preferredTemplateIds.includes('crypto_dry_forest_cave'), true);

  assert.equal(oasisCenter.forceTemplateId, 'crypto_oasis_lakeside');
  assert.equal(oasisCenter.templatePoolIds.includes('crypto_oasis_lakeside'), true);
});

test('buildEncounterTerrainPressure adds authored movement pressure for Dry Forest bottlenecks and Oasis shallow water', () => {
  const dryForest = buildEncounterTerrainPressure({
    poiId: 'dry-forest-cave',
    centerX: 42,
    centerY: -18,
    playerX: 42,
    playerY: -18,
  });
  const oasis = buildEncounterTerrainPressure({
    poiId: 'oasis-lakeside',
    centerX: 84,
    centerY: 16,
    playerX: 84,
    playerY: 18,
  });
  const outside = buildEncounterTerrainPressure({
    poiId: 'oasis-lakeside',
    centerX: 84,
    centerY: 16,
    playerX: 96,
    playerY: 2,
  });

  assert.equal(dryForest.moveSpeedMul < 1, true);
  assert.equal(dryForest.hazardId, 'narrow-bottleneck');
  assert.equal(oasis.moveSpeedMul < dryForest.moveSpeedMul, true);
  assert.equal(oasis.hazardId, 'shallow-water-slow');
  assert.equal(outside.moveSpeedMul, 1);
});


test('buildEncounterEnemyBehaviorProfile gives coyote and scorpion authored arena behavior responses', () => {
  const coyote = buildEncounterEnemyBehaviorProfile({ poiId: 'dry-forest-cave', enemyId: 'coyote-pack-runner' });
  const caveGoblin = buildEncounterEnemyBehaviorProfile({ poiId: 'dry-forest-cave', enemyId: 'fud-goblin-cave' });
  const scorpion = buildEncounterEnemyBehaviorProfile({ poiId: 'oasis-lakeside', enemyId: 'scorpion-ambusher' });
  const wisp = buildEncounterEnemyBehaviorProfile({ poiId: 'oasis-lakeside', enemyId: 'gas-fee-wisp' });
  const neutral = buildEncounterEnemyBehaviorProfile({ poiId: 'crossroads-trading-post', enemyId: 'claim-jumper' });

  assert.equal(coyote.speedMul < 1, true);
  assert.equal(coyote.desiredDistanceMul >= 0.9, true);
  assert.equal(coyote.telegraphBonusFrames >= 5, true);
  assert.equal(coyote.attackResetFrames >= 72, true);

  assert.equal(caveGoblin.speedMul < 1, true);
  assert.equal(caveGoblin.desiredDistanceMul > 1, true);
  assert.equal(caveGoblin.attackResetFrames >= 72, true);

  assert.equal(scorpion.speedMul < 1, true);
  assert.equal(scorpion.attackResetFrames >= 72, true);
  assert.equal(scorpion.telegraphBonusFrames >= 5, true);

  assert.equal(wisp.desiredDistanceMul > 1, true);
  assert.equal(wisp.attackResetFrames < 92, true);

  assert.deepEqual(neutral, { speedMul: 1, desiredDistanceMul: 1, telegraphBonusFrames: 0, attackResetFrames: null });
});


test('buildEncounterEnemyBehaviorProfile extends authored responses into Crossroads, Mesa, and Rugpull arenas', () => {
  const crossroadsBoar = buildEncounterEnemyBehaviorProfile({ poiId: 'crossroads-trading-post', enemyId: 'wild-boar' });
  const crossroadsTurret = buildEncounterEnemyBehaviorProfile({ poiId: 'crossroads-trading-post', enemyId: 'honeypot-turret' });
  const crossroadsCaptain = buildEncounterEnemyBehaviorProfile({ poiId: 'crossroads-trading-post', enemyId: 'bandit-captain' });
  const mesaJumper = buildEncounterEnemyBehaviorProfile({ poiId: 'mesa-overlook', enemyId: 'claim-jumper' });
  const mesaAngler = buildEncounterEnemyBehaviorProfile({ poiId: 'mesa-overlook', enemyId: 'phishing-angler' });
  const mesaRaider = buildEncounterEnemyBehaviorProfile({ poiId: 'mesa-overlook', enemyId: 'ridge-raider' });
  const rugpullSheriff = buildEncounterEnemyBehaviorProfile({ poiId: 'rugpull-gulch', enemyId: 'claim-jumper-sheriff' });
  const rugpullZealot = buildEncounterEnemyBehaviorProfile({ poiId: 'rugpull-gulch', enemyId: 'scam-cult-zealot' });

  assert.equal(crossroadsBoar.speedMul < 1, true);
  assert.equal(crossroadsBoar.attackResetFrames >= 72, true);
  assert.equal(crossroadsTurret.desiredDistanceMul > 1, true);
  assert.equal(crossroadsCaptain.telegraphBonusFrames >= 3, true);
  assert.equal(mesaJumper.desiredDistanceMul > 1, true);
  assert.equal(mesaAngler.telegraphBonusFrames >= 2, true);
  assert.equal(mesaRaider.desiredDistanceMul > 1, true);
  assert.equal(rugpullSheriff.telegraphBonusFrames >= 3, true);
  assert.equal(rugpullZealot.attackResetFrames < 92, true);
});

test('bespoke authored enemy visual kits are registered with roster-key references for 8-dir animated sprites', () => {
  const coyote = bespokeEnemyVisualKitFor({ id: 'coyote-pack-runner' });
  const scorpion = bespokeEnemyVisualKitFor({ id: 'scorpion-ambusher' });
  const captain = bespokeEnemyVisualKitFor({ id: 'bandit-captain' });
  const boar = bespokeEnemyVisualKitFor({ id: 'wild-boar' });
  const buzzard = bespokeEnemyVisualKitFor({ id: 'buzzard' });
  const rattlesnake = bespokeEnemyVisualKitFor({ id: 'rattlesnake' });

  assert.equal(BESPOKE_ENEMY_VISUAL_KITS['coyote-pack-runner'].states.length >= 3, true);
  assert.equal(BESPOKE_ENEMY_VISUAL_KITS['scorpion-ambusher'].states.length >= 3, true);
  assert.equal(BESPOKE_ENEMY_VISUAL_KITS['bandit-captain'].states.length >= 3, true);
  assert.equal(coyote.id, 'coyote-pack-runner');
  assert.equal(scorpion.id, 'scorpion-ambusher');
  assert.equal(captain.id, 'bandit-captain');
  assert.equal(boar.id, 'wild-boar');
  assert.equal(buzzard.id, 'buzzard');
  assert.equal(rattlesnake.id, 'rattlesnake');
  // Each kit now has a rosterKey pointing to the animated roster directory
  assert.equal(typeof coyote.rosterKey, 'string');
  assert.equal(typeof scorpion.rosterKey, 'string');
  assert.equal(typeof captain.rosterKey, 'string');
  assert.equal(typeof coyote.drawScaleMul, 'number');
  assert.equal(typeof coyote.anchorBiasY, 'number');
  // States include the full animation set
  assert.equal(coyote.states.includes('idle'), true);
  assert.equal(coyote.states.includes('attack'), true);
  assert.equal(coyote.states.includes('death'), true);
});
