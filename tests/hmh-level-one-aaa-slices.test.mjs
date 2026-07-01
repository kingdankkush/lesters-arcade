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
  levelOneInteractiveDebrisStateForObstacle,
  levelOneInteractiveHitPlan,
  levelOneInteractiveHazardEffectAt,
  levelOneInteractiveRuntimeStateForObstacle,
  levelOneInteractiveSfxCuePlan,
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

test('Level 1 interactive hit plans turn cache, gas pump, and gate props into gameplay events', () => {
  const cache = {
    id: 'aaa-desert-cache-crate-a',
    worldX: 22,
    worldY: 6,
    radius: 0.42,
    hp: 18,
    interactive: { kind: 'reward-cache', reward: 'litecoin-cache', zoneId: 'desert-bone-camp' },
  };
  const cachePlan = levelOneInteractiveHitPlan({ obstacle: cache, damage: 20, obstacles: [cache] });
  assert.equal(cachePlan.damageable, true);
  assert.equal(cachePlan.destroyed, true);
  assert.equal(cachePlan.nextHp, 0);
  assert.deepEqual(cachePlan.powerUps, ['ltc-cache']);
  assert.deepEqual(cachePlan.xpDrops.map((drop) => drop.value), [65, 35]);
  assert.equal(cachePlan.scoreBonus >= 250, true);

  const pump = {
    id: 'aaa-gas-pump-explosive-a',
    worldX: 48,
    worldY: 7,
    radius: 0.42,
    hp: 16,
    interactive: { kind: 'hazard', chainDetonation: true, zoneId: 'warehouse-gas-station-yard' },
  };
  const nearbyCrate = {
    id: 'aaa-warehouse-crate-stack-a',
    worldX: 50,
    worldY: 5,
    radius: 0.42,
    hp: 30,
    interactive: { kind: 'destructible', zoneId: 'warehouse-gas-station-yard' },
  };
  const farPump = {
    id: 'far-gas-pump',
    worldX: 75,
    worldY: 5,
    radius: 0.42,
    hp: 16,
    interactive: { kind: 'hazard', chainDetonation: true },
  };
  const pumpPlan = levelOneInteractiveHitPlan({ obstacle: pump, damage: 99, obstacles: [pump, nearbyCrate, farPump] });
  assert.equal(pumpPlan.destroyed, true);
  assert.equal(pumpPlan.blastZones.length >= 1, true);
  assert.equal(pumpPlan.blastZones[0].damage >= 45, true);
  assert.equal(pumpPlan.chainDetonationIds.includes('aaa-warehouse-crate-stack-a'), true);
  assert.equal(pumpPlan.chainDetonationIds.includes('far-gas-pump'), false);

  const gate = { id: 'aaa-boss-yard-gate', hp: 64, interactive: { kind: 'gate' } };
  const gatePlan = levelOneInteractiveHitPlan({ obstacle: gate, damage: 999, obstacles: [gate] });
  assert.equal(gatePlan.damageable, false, 'boss gate should unlock from boss defeat, not by shooting it open');
});

test('Level 1 interactive runtime states drive mushroom hazard, boss gate unlock, and extraction flare cues', () => {
  const mushroom = {
    id: 'aaa-mushroom-spore-ring',
    worldX: 57,
    worldY: 5,
    radius: 0.9,
    interactive: { kind: 'hazard', zoneId: 'dead-forest-mushroom-grove' },
  };
  const activeHazard = levelOneInteractiveHazardEffectAt({ obstacle: mushroom, playerX: 57.2, playerY: 5.1, frame: 30 });
  assert.equal(activeHazard.inRange, true);
  assert.equal(activeHazard.active, true);
  assert.equal(activeHazard.moveSpeedMultiplier < 1, true);
  assert.equal(activeHazard.damagePerPulse > 0, true);
  assert.match(activeHazard.label, /spore/i);

  const inactiveHazard = levelOneInteractiveHazardEffectAt({ obstacle: mushroom, playerX: 57.2, playerY: 5.1, frame: 120 });
  assert.equal(inactiveHazard.inRange, true);
  assert.equal(inactiveHazard.active, false, 'hazard should visibly pulse instead of dealing constant unavoidable damage');
  assert.equal(inactiveHazard.moveSpeedMultiplier < 1, true, 'ring remains a slow terrain read even between damage pulses');

  const gate = { solid: true, interactive: { kind: 'gate' } };
  assert.equal(levelOneInteractiveRuntimeStateForObstacle(gate, { bossDefeated: false }).solid, true);
  assert.equal(levelOneInteractiveRuntimeStateForObstacle(gate, { bossDefeated: false }).locked, true);
  assert.equal(levelOneInteractiveRuntimeStateForObstacle(gate, { bossDefeated: true }).solid, false);
  assert.equal(levelOneInteractiveRuntimeStateForObstacle(gate, { bossDefeated: true }).unlocked, true);

  const flare = { solid: false, interactive: { kind: 'extraction-cue' } };
  assert.equal(levelOneInteractiveRuntimeStateForObstacle(flare, { bossDefeated: false, extractionPoint: null }).glow, false);
  assert.equal(levelOneInteractiveRuntimeStateForObstacle(flare, { bossDefeated: true, extractionPoint: { worldX: 97, worldY: 5 } }).glow, true);
});

test('main runtime wires Level 1 interactive props into bullet, grenade, hazard, and visual state paths', () => {
  const source = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  assert.equal(source.includes('levelOneInteractiveHitPlan'), true, 'runtime should import the pure hit planner');
  assert.equal(source.includes('function damageLevelOneInteractiveObstacle('), true, 'runtime should have a shared obstacle damage resolver');
  const bulletBlock = source.slice(source.indexOf('function updateRoguelikeBullets'), source.indexOf('function trimLooseRoguelikeRewards'));
  assert.equal(bulletBlock.includes('damageLevelOneInteractiveObstacle(hitObstacle'), true, 'player bullets should damage interactive authored obstacles before disappearing');
  const grenadeBlock = source.slice(source.indexOf('function updateRoguelikeGrenades'), source.indexOf('function updateRoguelikeXpGems'));
  assert.equal(grenadeBlock.includes('damageLevelOneInteractiveObstacle(obstacle'), true, 'grenade blasts should damage interactive authored obstacles');
  const movementBlock = source.slice(source.indexOf('function updateRoguelikeMovement'), source.indexOf('function updateRoguelikeBullets'));
  assert.equal(movementBlock.includes('currentLevelOneInteractiveHazardPressure()'), true, 'movement should consume mushroom spore hazard pressure');
  const obstacleBlock = source.slice(source.indexOf('function _buildAuthoredObstaclesForLevel'), source.indexOf('function buildObstacleRenderEntries'));
  assert.equal(obstacleBlock.includes('refreshLevelOneInteractiveObstacleState'), true, 'authored obstacles should refresh gate/flare state each frame');
  assert.equal(source.includes('interactiveState?.glow'), true, 'renderer should visually pulse unlocked extraction cues');
});

test('Level 1 destroyed interactives leave readable debris instead of disappearing instantly', () => {
  const cache = {
    id: 'aaa-desert-cache-crate-a',
    worldX: 22,
    worldY: 6,
    radius: 0.42,
    hp: 0,
    destroyed: true,
    sceneAssetKey: 'level-final-setpiece/cohesive-desert-cache-crate',
    interactive: { kind: 'reward-cache', reward: 'litecoin-cache', zoneId: 'desert-bone-camp' },
  };
  const debris = levelOneInteractiveDebrisStateForObstacle(cache, { frame: 18 });
  assert.equal(debris.visible, true);
  assert.equal(debris.solid, false);
  assert.equal(debris.drawMode, 'procedural-debris');
  assert.equal(debris.fragmentCount >= 5, true);
  assert.match(debris.label, /cache/i);
  assert.equal(debris.palette.includes('#d9a441'), true, 'debris keeps the dusty/gold Level 1 palette');

  const pump = {
    id: 'aaa-gas-pump-explosive-a',
    worldX: 48,
    worldY: 7,
    radius: 0.42,
    hp: 0,
    destroyed: true,
    sceneAssetKey: 'level-final-setpiece/cohesive-gas-pump-explosive',
    interactive: { kind: 'hazard', chainDetonation: true, zoneId: 'warehouse-gas-station-yard' },
  };
  const pumpDebris = levelOneInteractiveDebrisStateForObstacle(pump, { frame: 24 });
  assert.equal(pumpDebris.visible, true);
  assert.equal(pumpDebris.fragmentCount >= debris.fragmentCount, true, 'explosives leave larger readable debris');
  assert.equal(pumpDebris.palette.includes('#ff7b2f'), true, 'explosive debris carries orange blast color');

  const gate = { destroyed: true, interactive: { kind: 'gate' } };
  assert.equal(levelOneInteractiveDebrisStateForObstacle(gate).visible, false, 'boss gate is stateful, not shot into debris');
});

test('Level 1 POI-specific SFX cue plan names cache, gas, mushroom, gate, and extraction events', () => {
  const cache = { interactive: { kind: 'reward-cache', zoneId: 'desert-bone-camp' } };
  assert.deepEqual(levelOneInteractiveSfxCuePlan({ obstacle: cache, event: 'destroyed' }).map((cue) => cue.id), ['level1-cache-open']);

  const pump = { interactive: { kind: 'hazard', chainDetonation: true, zoneId: 'warehouse-gas-station-yard' } };
  assert.deepEqual(levelOneInteractiveSfxCuePlan({ obstacle: pump, event: 'hit' }).map((cue) => cue.id), ['level1-gas-pump-warning']);
  assert.deepEqual(levelOneInteractiveSfxCuePlan({ obstacle: pump, event: 'destroyed' }).map((cue) => cue.id), ['level1-gas-pump-detonate']);

  const mushroom = { id: 'aaa-mushroom-spore-ring', interactive: { kind: 'hazard', zoneId: 'dead-forest-mushroom-grove' } };
  assert.deepEqual(levelOneInteractiveSfxCuePlan({ obstacle: mushroom, event: 'hazard-pulse' }).map((cue) => cue.id), ['level1-mushroom-pulse']);

  const gate = { interactive: { kind: 'gate', zoneId: 'rugpull-gulch-boss-yard' } };
  assert.deepEqual(levelOneInteractiveSfxCuePlan({ obstacle: gate, event: 'gate-unlock' }).map((cue) => cue.id), ['level1-gate-unlock']);

  const flare = { interactive: { kind: 'extraction-cue', zoneId: 'ltc-road-extraction' } };
  assert.deepEqual(levelOneInteractiveSfxCuePlan({ obstacle: flare, event: 'extraction-ready' }).map((cue) => cue.id), ['level1-extraction-flare']);
});

test('Level 1 hit/runtime plans include debris and SFX metadata for live runtime consumers', () => {
  const barrel = {
    id: 'aaa-saloon-cover-barrel-a',
    worldX: 15,
    worldY: 7,
    radius: 0.42,
    hp: 10,
    sceneAssetKey: 'level-final-setpiece/cohesive-saloon-cover-barrel',
    interactive: { kind: 'destructible', zoneId: 'ghost-saloon-mainstreet' },
  };
  const plan = levelOneInteractiveHitPlan({ obstacle: barrel, damage: 99, obstacles: [barrel] });
  assert.equal(plan.destroyed, true);
  assert.equal(plan.debrisState.visible, true);
  assert.equal(plan.debrisState.drawMode, 'procedural-debris');
  assert.equal(plan.sfxCues.some((cue) => cue.id === 'level1-cover-break'), true);

  const gateLocked = levelOneInteractiveRuntimeStateForObstacle({ solid: true, interactive: { kind: 'gate' } }, { bossDefeated: false });
  assert.equal(gateLocked.sfxCue, null);
  const gateUnlocked = levelOneInteractiveRuntimeStateForObstacle({ solid: true, interactive: { kind: 'gate' } }, { bossDefeated: true });
  assert.equal(gateUnlocked.sfxCue, 'level1-gate-unlock');

  const flareReady = levelOneInteractiveRuntimeStateForObstacle(
    { solid: false, interactive: { kind: 'extraction-cue' } },
    { bossDefeated: true, extractionPoint: { worldX: 97, worldY: 5 } },
  );
  assert.equal(flareReady.sfxCue, 'level1-extraction-flare');
});

test('main runtime wires interactive debris visuals and POI-specific SFX without hiding destroyed props', () => {
  const source = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  assert.equal(source.includes('levelOneInteractiveDebrisStateForObstacle'), true, 'runtime should import debris state helper');
  assert.equal(source.includes('levelOneInteractiveSfxCuePlan'), true, 'runtime should import POI SFX cue planner');
  assert.equal(source.includes('function playLevelOneInteractiveSfxCues('), true, 'runtime should centralize POI SFX playback');
  assert.equal(source.includes('function drawLevelOneInteractiveDebris('), true, 'renderer should draw broken/debris states');
  const damageBlock = source.slice(source.indexOf('function damageLevelOneInteractiveObstacle'), source.indexOf('function updateLevelOneInteractiveHazards'));
  assert.equal(damageBlock.includes('playLevelOneInteractiveSfxCues(plan.sfxCues'), true, 'hit resolver should play cache/gas/cover cues from hit plan');
  assert.equal(damageBlock.includes('hitObstacle.debrisState = plan.debrisState'), true, 'destroyed props should persist debris state');
  assert.equal(damageBlock.includes('hitObstacle.hidden = false'), true, 'destroyed props should not disappear instantly');
  const hazardBlock = source.slice(source.indexOf('function updateLevelOneInteractiveHazards'), source.indexOf('function updateRoguelikeMovement'));
  assert.equal(hazardBlock.includes("levelOneInteractiveSfxCuePlan({ obstacle, event: 'hazard-pulse' })"), true, 'mushroom pulse should emit POI SFX');
  const stateBlock = source.slice(source.indexOf('function refreshLevelOneInteractiveObstacleState'), source.indexOf('function currentLevelOneInteractiveHazardPressure'));
  assert.equal(stateBlock.includes('playLevelOneInteractiveSfxCues'), true, 'gate/extraction state transitions should emit POI SFX');
  const renderBlock = source.slice(source.indexOf('function buildObstacleRenderEntries'), source.indexOf('function drawRoguelikeScene'));
  assert.equal(renderBlock.includes('drawLevelOneInteractiveDebris'), true, 'render path should draw debris over/after destroyed interactives');
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

  const syntaxCheckRunner = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.equal(syntaxCheckRunner.includes('apps/portal/src/hmh-level-one-aaa-slices.mjs'), true);
  assert.equal(syntaxCheckRunner.includes('tests/hmh-level-one-aaa-slices.test.mjs'), true);
  assert.equal(existsSync(repoPath('docs/game-design/hard-money-heroes-level-1-aaa-slices.md')), true);
});
