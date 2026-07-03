import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildLevelOneCuratedVisibleSceneObjects,
  buildLevelOneOpeningComposition,
  LEVEL_ONE_AUTHORED_PREFAB_STAMPS,
  levelOneCuratedRuntimeArtPolicy,
  levelOneCuratedAssetSrc,
  levelOneAuthoredStampAssetSrc,
  levelOneOpeningGroundRoleForTile,
} from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';
import { curatedLevelKitAssetByKey } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';
import { authoredStampAssetByKey, HMH_LEVEL_ONE_AUTHORED_STAMP_ART } from '../apps/portal/assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-manifest.mjs';
import { HMH_LEVEL_ONE_SPAWN_GATE_REDRESS } from '../apps/portal/src/hmh-level-one-curated-world-contract.mjs';

function levelOneVisibleAssetByKey(assetKey) {
  return curatedLevelKitAssetByKey(assetKey) ?? authoredStampAssetByKey(assetKey);
}

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

test('Level 1 visible runtime builds curated authored objects around the actual spawn camera', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 0, playerY: 5, window: 18 });
  assert.equal(objects.length >= 18, true, `expected a dense visible authored spawn slice, got ${objects.length}`);
  assert.equal(objects.some((object) => object.id.includes('spawn-broken-road')), true, 'spawn road beat should be visible immediately');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/building/landmark-gas-station'), true, 'opening should have a strong curated landmark visible at spawn');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/building/ghost-boarded-storefront'), true, 'opening should telegraph the next authored town beat');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/prop/bus-stop-sign'), true, 'spawn should include route signage from the curated folder');
  assert.equal(objects.every((object) => object.curated === true), true, 'all visible-runtime objects should be tagged as curated');
  assert.equal(objects.every((object) => curatedLevelKitAssetByKey(object.assetKey)), true, 'every object should resolve to Justin-curated manifest art');
});

test('WO-48 spawn gate redress keeps the opening safe while preserving route signage', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 0, playerY: 0, window: 18 });
  const gateRadius = HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.safeRadiusTiles;
  const insideGate = objects.filter((object) => Math.hypot(object.gridX, object.gridY) < gateRadius);

  assert.equal(insideGate.length > 0, true, 'spawn gate should still contain readable low route cues');
  assert.equal(insideGate.some((object) => object.assetKey === 'level-1/prop/bus-stop-sign'), true, 'spawn gate keeps the authored route sign');
  assert.equal(insideGate.some((object) => object.sceneRole === 'road'), true, 'spawn gate keeps low road/readability ground props');
  assert.equal(insideGate.some((object) => object.sceneRole === 'water-strip'), false, 'spawn gate should not start on water/noir clutter');
  assert.equal(insideGate.some((object) => object.solid && (object.zHeight >= 2 || ['landmark', 'wall'].includes(object.sceneRole))), false, 'spawn gate should not contain tall solid blockers');
});

test('Level 1 opening composition declares AAA-readable route, boundary, landmark, and negative-space layers', () => {
  const composition = buildLevelOneOpeningComposition();
  assert.equal(composition.id, 'level-one-opening-authored-aaa-v1');
  assert.equal(composition.clearLane.widthTiles >= 7, true, 'opening needs a wide readable player lane');
  assert.equal(composition.routeTiles.length >= 18, true, 'route ground must be authored as a broad road/plaza, not three prop tiles');
  assert.equal(composition.landmarks.length >= 4, true, 'spawn view needs strong landmarks, not scatter');
  assert.equal(composition.boundaries.length >= 8, true, 'route needs visible diegetic boundaries');
  assert.equal(composition.setDressing.length <= 10, true, 'set dressing must stay capped to avoid prop soup');
  assert.equal(composition.objects.every((object) => object.use !== 'terrain'), true, 'terrain must be ground-role metadata, not obstacle props');
  assert.equal(composition.objects.every((object) => curatedLevelKitAssetByKey(object.assetKey)), true, 'all opening objects use approved curated art');
});

test('WO-63 Level 1 far-field dressing uses explicit authored prefab stamps and exact asset keys', () => {
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.length >= 8, true, 'world dressing needs named prefab stamps for town, farm, forest, water, desert, and boss-yard reads');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.authoredPrefabStamp === true), true);
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.anchor && Number.isFinite(stamp.anchor.x) && Number.isFinite(stamp.anchor.y)), true);
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.assetKeys.length === stamp.objects.length), true, 'stamps should expose the exact runtime asset keys they place');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.assetKeys.every((assetKey) => levelOneVisibleAssetByKey(assetKey))), true, 'all stamp asset keys must resolve to curated or generated authored-stamp art');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.some((stamp) => stamp.routeBeat === 'boss' && stamp.id.includes('innercity-gate')), true, 'boss-yard gate prefab must be an authored exact-key stamp');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.some((stamp) => stamp.routeBeat === 'chokepoint' && stamp.assetKeys.includes('level-1/water/water-02')), true, 'shoreline ford prefab must place exact water/bridge keys');

  const farObjects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 94, playerY: 6, window: 18 });
  assert.equal(farObjects.length >= 18, true, `expected dense authored far-field objects around traversal, got ${farObjects.length}`);
  assert.equal(farObjects.some((object) => object.authoredPrefabStamp === true && object.prefabStampId === 'innercity-gate-barricade'), true, 'visible objects should come from the authored boss-yard prefab stamp');
  assert.equal(farObjects.some((object) => object.routeBeat === 'boss' && object.sceneRole === 'landmark'), true, 'far-field traversal needs exact-key landmark silhouettes');
  assert.equal(farObjects.some((object) => object.sceneRole === 'wall' || object.sceneRole === 'tree'), true, 'far-field traversal needs visible boundaries');
  assert.equal(farObjects.every((object) => object.use !== 'terrain'), true, 'far-field terrain must not be drawn as obstacle props');
  assert.equal(farObjects.every((object) => levelOneVisibleAssetByKey(object.assetKey)), true, 'all far-field objects should resolve to curated or generated authored-stamp art');
});

test('Level 1 opening ground roles replace noisy procedural sand/grass with authored road, shoulder, and boundary bands', () => {
  assert.equal(levelOneOpeningGroundRoleForTile({ worldX: 0, worldY: 5 }), 'road', 'player spawn should sit on an authored road/plaza tile');
  assert.equal(levelOneOpeningGroundRoleForTile({ worldX: 10, worldY: 5 }), 'road', 'forward route should stay clear road');
  assert.equal(levelOneOpeningGroundRoleForTile({ worldX: 22, worldY: 3 }), 'rocky', 'north shoulder should read as a rocky boundary band');
  assert.equal(levelOneOpeningGroundRoleForTile({ worldX: 18, worldY: 8 }), 'grass', 'south shoulder can carry authored vegetation contrast');
  assert.equal(levelOneOpeningGroundRoleForTile({ worldX: 60, worldY: 40 }), null, 'override must not repaint the entire level');
});

test('Level 1 curated visible runtime maps approved asset keys to direct runtime image sources', () => {
  const saloon = levelOneCuratedAssetSrc('level-1/building/ghost-saloon-front');
  assert.equal(saloon, './assets/generated/hmh-curated-level-kit/source/level-1-crypto-wasteland/Buildings/ghost-saloon-front.png');
  const road = levelOneCuratedAssetSrc('level-1/road/road1-ground');
  assert.match(road, /hmh-curated-level-kit\/source\/level-1-crypto-wasteland\//);
});

test('generated Level 1 authored stamp art resolves through the live prefab stamp path for exposed tour gaps', () => {
  assert.equal(HMH_LEVEL_ONE_AUTHORED_STAMP_ART.assetCount, 3);
  const requiredKeys = [
    'level1-authored-stamp/river-bridge-arrow-sign',
    'level1-authored-stamp/boss-yard-warning-pylon',
    'level1-authored-stamp/extraction-pad-litcoin-beacon',
  ];
  for (const key of requiredKeys) {
    const record = authoredStampAssetByKey(key);
    assert.ok(record, `${key} should exist in generated authored stamp manifest`);
    assert.equal(levelOneAuthoredStampAssetSrc(key), record.src);
    assert.equal(levelOneCuratedAssetSrc(key), record.src, `${key} should route through the combined visible-runtime resolver`);
    assert.equal(existsSync(repoPath(record.src.replace('./', 'apps/portal/'))), true, `${key} PNG should exist on disk`);
  }

  const gapBeatObjects = [
    ...buildLevelOneCuratedVisibleSceneObjects({ playerX: 64, playerY: 7, window: 10 }),
    ...buildLevelOneCuratedVisibleSceneObjects({ playerX: 94, playerY: 6, window: 10 }),
    ...buildLevelOneCuratedVisibleSceneObjects({ playerX: 100, playerY: 5, window: 10 }),
  ];
  for (const key of requiredKeys) {
    const object = gapBeatObjects.find((item) => item.assetKey === key);
    assert.ok(object, `${key} should be emitted as a visible authored prefab object`);
    assert.equal(object.generatedStampArt, true);
    assert.equal(object.sourcePolicy, 'repo-generated-authored-stamp-art');
    assert.equal(object.authoredPrefabStamp, true);
  }
});

test('Level 1 art policy disables old enemy-wave/combatArt fallbacks and generic procedural scatter', () => {
  const policy = levelOneCuratedRuntimeArtPolicy();
  assert.equal(policy.enemyFallbacksAllowed, false);
  assert.deepEqual(policy.disallowedEnemyFallbacks, ['HMH_ENEMIES_WAVE', 'combatArt.enemies', 'rectangle-fallback']);
  assert.equal(policy.sceneObjectsNearAllowed, false);
  assert.equal(policy.randomWorldDressingAllowed, false);
  assert.equal(policy.worldDressingPlacement, 'authored-prefab-stamps-exact-asset-keys');
  assert.equal(policy.requiredWorldSource, 'hmh-level-one-curated-world-contract');
});

test('main runtime consumes the curated visible runtime before generic sceneObjectsNear and disables Level 1 old enemy art fallbacks', () => {
  const source = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  assert.equal(source.includes('buildLevelOneCuratedVisibleSceneObjects'), true);
  assert.equal(source.includes('levelOneCuratedRuntimeArtPolicy'), true);
  assert.equal(source.includes('curatedLevelOneImage'), true);

  const currentObstacles = source.slice(source.indexOf('function currentObstacles()'), source.indexOf('// Per-role art sizing'));
  assert.equal(currentObstacles.includes('buildLevelOneCuratedVisibleSceneObjects'), true, 'currentObstacles should inject curated visible Level 1 art');
  assert.equal(currentObstacles.includes('if (isLevelOneCuratedRuntime())'), true, 'Level 1 should have an explicit curated-runtime branch');
  assert.equal(currentObstacles.indexOf('buildLevelOneCuratedVisibleSceneObjects') < currentObstacles.indexOf('sceneObjectsNear('), true, 'curated authored objects must be chosen before procedural scatter');

  const visibleRuntimeSource = readFileSync(repoPath('apps/portal/src/hmh-level-one-visible-runtime.mjs'), 'utf8');
  assert.equal(visibleRuntimeSource.includes('LEVEL_ONE_AUTHORED_PREFAB_STAMPS'), true, 'Level 1 visible runtime should expose exact-key authored prefab stamps');
  assert.equal(visibleRuntimeSource.includes('levelOneWorldDressingChunkForCell'), false, 'WO-63 removes old hash-by-cell dressing selection');
  assert.equal(visibleRuntimeSource.includes('chunkHash('), false, 'WO-63 disables random-looking hashed chunk placement');

  const enemyDraw = source.slice(source.indexOf('function drawSingleEnemy'), source.indexOf('function bossArtFor'));
  assert.equal(enemyDraw.includes('const waveFrame = isLevelOneCuratedRuntime() ? null :'), true, 'Level 1 should not use old HMH_ENEMIES_WAVE fallback art');
  assert.equal(enemyDraw.includes('const legacyEnemyFrame = isLevelOneCuratedRuntime() ? null : enemyArtFor(enemy)'), true, 'Level 1 should not fall back to old combatArt enemy sprites');
  assert.equal(enemyDraw.includes('if (isLevelOneCuratedRuntime()) return;'), true, 'Level 1 should suppress rectangle fallback enemies instead of showing bad placeholder art');
});

test('main runtime uses clean Level 1 loading art and authored opening ground roles', () => {
  const source = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  assert.equal(source.includes('hmhLoadingBackgroundForLevel'), true, 'loading art should be selected through a level-aware helper');
  const loadingHelper = source.slice(source.indexOf('function hmhLoadingBackgroundForLevel'), source.indexOf('async function showHMHLoadingScreen'));
  assert.equal(loadingHelper.includes("level.id === HMH_LEVEL_ONE_ID"), true, 'Level 1 should get a dedicated clean loading branch');
  assert.equal(loadingHelper.includes('return null'), true, 'Level 1 loading should avoid all static enemy-horde key art');
  assert.equal(loadingHelper.includes('return HMH_KEY_ART_BG'), false, 'Level 1 loading must not use zombie/goblin key art');

  const loadingScreen = source.slice(source.indexOf('async function showHMHLoadingScreen'), source.indexOf('// Run the actual game setup while the keyart'));
  assert.equal(loadingScreen.includes('hmhLoadingBackgroundForLevel(level)'), true, 'loading screen should not randomly choose legacy loading key art for every level');
  assert.equal(loadingScreen.includes('hmhNeutralLoadingBackground()'), true, 'Level 1 null art branch should render a neutral gradient backdrop');
  assert.equal(loadingScreen.includes('Math.random() * HMH_LOADING_KEYARTS.length'), false, 'random legacy loading-keyart selection must not be inline in showHMHLoadingScreen');

  const tileDraw = source.slice(source.indexOf('function drawGroundPlanPatternTiles'), source.indexOf('function productionPropForIndex'));
  assert.equal(tileDraw.includes('plan.cellAt(tile.worldX, tile.worldY)'), true, 'floor renderer should consume cached authored Level 1 terrain blob metadata instead of per-frame rebuilds or per-tile texture rolls');
  assert.equal(tileDraw.includes('groundPlanPatternForGroup(ctx, group)'), true, 'floor renderer should fill batched zones with cached world-anchored texture patterns');
  assert.equal(tileDraw.includes('drawLevelOneGroundEdgeBreakup'), false, 'WO-3 disables seam-breakup overlays until real border transitions land');
  const enemyDraw = source.slice(source.indexOf('function drawSingleEnemy'), source.indexOf('function bossArtFor'));
  assert.equal(enemyDraw.includes('drawLevelOneEnemyReadabilityAura'), true, 'enemy renderer should add Level 1 readable outlines/glows instead of relying on weak raw sprites only');
});

test('package check gate includes the visible runtime module and regression test', () => {
  // Syntax gate moved to scripts/syntax-check.mjs (inline `check` hit the
  // Windows 8191-char command-line limit). Assert coverage there.
  const syntaxCheckRunner = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.equal(syntaxCheckRunner.includes('apps/portal/src/hmh-level-one-visible-runtime.mjs'), true);
  assert.equal(syntaxCheckRunner.includes('tests/hmh-level-one-visible-runtime.test.mjs'), true);
});
