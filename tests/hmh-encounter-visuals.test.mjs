import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_FINAL_SETPIECE_KIT, finalSetpieceAssetByKey } from '../apps/portal/assets/generated/hmh-final-setpiece-kit/hmh-final-setpiece-kit-manifest.mjs';

import {
  BESPOKE_ENEMY_VISUAL_KITS,
  bespokeEnemyVisualKitFor,
  buildEncounterEnemyBehaviorProfile,
  buildEncounterSceneObjects,
  buildEncounterTemplateContext,
  buildEncounterTerrainPressure,
  buildEncounterVisualPlan,
  buildEnemyVisualRedesignQueue,
  buildTopEnemyExposureContactSheetPlan,
  enemyProxyRenderProfile,
  HMH_ENEMY_VISUAL_REDESIGN_QUEUE,
} from '../apps/portal/src/hmh-encounter-visuals.mjs';


test('final setpiece kit ships original POI level-design assets for every authored Level 1 arena', () => {
  assert.equal(HMH_FINAL_SETPIECE_KIT.id, 'hmh-final-setpiece-kit-v1');
  assert.match(HMH_FINAL_SETPIECE_KIT.sourcePolicy, /original repo-owned/i);
  assert.equal(HMH_FINAL_SETPIECE_KIT.assetCount >= 15, true);

  const required = [
    'level-final-setpiece/cave-mouth-rocks',
    'level-final-setpiece/torch-pockets',
    'level-final-setpiece/pine-wall-shadow',
    'level-final-setpiece/reed-bank-ring',
    'level-final-setpiece/driftwood-sandbar',
    'level-final-setpiece/shoreline-ripple-line',
    'level-final-setpiece/wagon-circle',
    'level-final-setpiece/signpost-fork',
    'level-final-setpiece/lantern-string',
    'level-final-setpiece/cliff-switchback',
    'level-final-setpiece/ridge-glint-post',
    'level-final-setpiece/broken-guardrail',
    'level-final-setpiece/false-front-barricade',
    'level-final-setpiece/wagon-ring',
    'level-final-setpiece/vault-signage',
  ];

  for (const key of required) {
    const asset = finalSetpieceAssetByKey(key);
    assert.ok(asset, `${key} exists in manifest`);
    assert.equal(asset.src.endsWith('.png'), true, `${key} png`);
    assert.equal(existsSync(fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url))), true, `${asset.src} exists on disk`);
    assert.equal(asset.width > 0 && asset.height > 0, true, `${key} has dimensions`);
  }
});

test('enemyProxyRenderProfile gives authored animal and human POI enemies bespoke proxy-readability treatment', () => {
  const coyote = enemyProxyRenderProfile({ id: 'coyote-pack-runner', state: 'melee-tell' });
  const scorpion = enemyProxyRenderProfile({ id: 'scorpion-ambusher', burrowing: true });
  const caveGoblin = enemyProxyRenderProfile({ id: 'fud-goblin-cave' });
  const captain = enemyProxyRenderProfile({ id: 'bandit-captain' });

  assert.equal(coyote.proxyFamily, 'trenchDegen');
  assert.equal(coyote.scaleMul, 1);
  assert.equal(coyote.spriteAuthoringScale < 1, true);
  assert.equal(coyote.telegraphStyle, 'dust-lunge-line');
  assert.equal(coyote.anchorBiasY < 0, true);

  assert.equal(scorpion.proxyFamily, 'gasBeast');
  assert.equal(scorpion.scaleMul, 1);
  assert.equal(scorpion.telegraphStyle, 'burrow-ring');
  assert.equal(typeof scorpion.accentColor, 'string');

  assert.equal(caveGoblin.proxyFamily, 'trenchDegen');
  assert.equal(caveGoblin.telegraphStyle, 'torch-pop');
  assert.equal(caveGoblin.scaleMul, 1);
  assert.equal(caveGoblin.spriteAuthoringScale < coyote.spriteAuthoringScale, true);

  assert.equal(captain.proxyFamily, 'evilBanker');
  assert.equal(captain.scaleMul, 1);
  assert.equal(captain.spriteAuthoringScale, 1);
});

test('enemy runtime art stays at 100 percent scale; size differences belong to authored sprite canvases and hit footprints', () => {
  for (const [id, kit] of Object.entries(BESPOKE_ENEMY_VISUAL_KITS)) {
    assert.equal(kit.drawScaleMul, 1, `${id} should not scale sprites at runtime`);
    assert.equal(kit.runtimeScale, 1, `${id} runtime scale must stay 100%`);
    assert.equal(typeof kit.spriteAuthoringScale, 'number', `${id} needs sprite authoring scale metadata`);
    assert.equal(typeof kit.hitFootprintRadius, 'number', `${id} needs hit footprint metadata`);
  }

  const smallIds = ['rug-rat', 'sybil-drone', 'gas-fee-wisp', 'fud-goblin-cave'];
  for (const id of smallIds) {
    assert.equal(BESPOKE_ENEMY_VISUAL_KITS[id].runtimeScale, 1);
    assert.equal(BESPOKE_ENEMY_VISUAL_KITS[id].spriteAuthoringScale < 1, true, `${id} should be generated smaller within its sprite canvas`);
  }
});

test('main runtime no longer randomizes enemy draw size between 50 and 150 percent', () => {
  const source = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.equal(source.includes('Math.random() * 0.75'), false);
  assert.equal(source.includes('Math.random() * 0.7'), false);
  assert.equal(source.includes('enemy.sizeScale'), false);
  assert.equal(source.includes('const drawScaleMul = 1;'), true);
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

  assert.equal(dryForest.some((obj) => obj.sceneAssetKey === 'level-final-setpiece/cave-mouth-rocks' && obj.sceneRole === 'wall'), true);
  assert.equal(dryForest.some((obj) => obj.sceneAssetKey === 'level-final-setpiece/pine-wall-shadow' && obj.sceneRole === 'tree'), true);
  assert.equal(dryForest.some((obj) => obj.sceneAssetKey === 'level-final-setpiece/torch-pockets' && obj.sceneRole === 'lamp'), true);

  assert.equal(oasis.some((obj) => obj.sceneAssetKey === 'level-final-setpiece/shoreline-ripple-line' && obj.sceneRole === 'water-strip' && obj.solid === false), true);
  assert.equal(oasis.some((obj) => obj.sceneAssetKey === 'level-final-setpiece/driftwood-sandbar' && obj.sceneRole === 'smallprop'), true);
  assert.equal(oasis.some((obj) => obj.sceneAssetKey === 'level-final-setpiece/reed-bank-ring' && obj.sceneRole === 'water-strip'), true);

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

test('WO-52 enemy visual redesign queue ranks top-5 exposed Level 1 enemies and halts before generation', () => {
  const queue = buildEnemyVisualRedesignQueue();
  assert.equal(queue.id, 'hmh-enemy-visual-redesign-queue-wo52');
  assert.equal(queue.approvalState, 'HALT_AWAITING_JUSTIN_TOP5_CONTACT_SHEET_APPROVAL');
  assert.equal(queue.fullBatchAllowed, false);
  assert.equal(queue.sourcePolicy, 'current-runtime-art-only-no-new-generation');
  assert.deepEqual(queue.topFive.map((item) => item.enemyId), [
    'claim-jumper',
    'coyote-pack-runner',
    'wild-boar',
    'rattlesnake',
    'buzzard',
  ]);
  assert.deepEqual(queue.topFive.map((item) => item.exposureRank), [1, 2, 3, 4, 5]);
  assert.equal(queue.topFive.every((item) => item.exposureScore > 0 && item.currentRosterKey && item.redesignBrief.length > 40), true);
  assert.equal(queue.topFive.every((item) => item.contactSheetRequired === true && item.approvalState === queue.approvalState), true);
  assert.equal(queue.topFive.some((item) => item.enemyId === 'buzzard' && item.currentRosterKey === 'crypto-bro-rusher' && /proxy/i.test(item.currentArtIssue)), true);
  assert.equal(HMH_ENEMY_VISUAL_REDESIGN_QUEUE, queue);
});

test('WO-52 top-5 exposure contact-sheet plan uses real current-art sources and docs a HALT', () => {
  const plan = buildTopEnemyExposureContactSheetPlan();
  assert.equal(plan.id, 'hmh-wo52-top5-enemy-exposure-contact-sheet');
  assert.equal(plan.outputPath, 'docs/game-design/assets/hmh-wo52-top5-enemy-exposure-contact-sheet.png');
  assert.equal(existsSync(fileURLToPath(new URL('../docs/game-design/assets/hmh-wo52-top5-enemy-exposure-contact-sheet.png', import.meta.url))), true);
  assert.equal(existsSync(fileURLToPath(new URL('../docs/game-design/hmh-wo52-enemy-visual-redesign-queue.md', import.meta.url))), true);
  assert.deepEqual(plan.states, ['idle', 'attack-tell', 'hit', 'death', 'optional-gore-overlay']);
  assert.equal(plan.rows.length, 5);
  assert.equal(plan.rows.every((row) => row.frames.length === plan.states.length), true);
  assert.equal(plan.rows.every((row) => row.frames.every((frame) => frame.src.endsWith('.png'))), true);
  assert.equal(plan.rows.some((row) => row.enemyId === 'buzzard' && row.currentActorId === 'crypto-bro-rusher'), true);
  assert.equal(plan.haltCopy.includes('Justin'), true);
  assert.equal(plan.haltCopy.includes('full enemy art batch'), true);
});
