import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildLevelOneCuratedVisibleSceneObjects,
  buildLevelOneOpeningComposition,
  LEVEL_ONE_AUTHORED_PREFAB_STAMPS,
  LEVEL_ONE_ACTIVE_PREFAB_STAMPS,
  levelOneCuratedRuntimeArtPolicy,
  levelOneCuratedAssetSrc,
  levelOneAuthoredStampAssetSrc,
  levelOneOpeningGroundRoleForTile,
  WO102_MEGA_PROP_ASSETS,
  WO104_106_WORLD_KIT_STAMPS,
  wo102MegaPropAssetByKey,
  wo104106WorldKitAssetSrc,
} from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';
import { curatedLevelKitAssetByKey } from '../apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs';
import { authoredStampAssetByKey, HMH_LEVEL_ONE_AUTHORED_STAMP_ART } from '../apps/portal/assets/generated/hmh-level-one-authored-stamp-art/hmh-level-one-authored-stamp-art-manifest.mjs';
import { HMH_LEVEL_ONE_SPAWN_GATE_REDRESS } from '../apps/portal/src/hmh-level-one-curated-world-contract.mjs';

function levelOneVisibleAssetByKey(assetKey) {
  return levelOneCuratedAssetSrc(assetKey) ? { src: levelOneCuratedAssetSrc(assetKey) } : null;
}

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

test('Level 1 visible runtime builds curated authored objects around the actual spawn camera', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 0, playerY: 5, window: 18 });
  assert.equal(objects.length >= 18, true, `expected a dense visible authored spawn slice, got ${objects.length}`);
  assert.equal(objects.some((object) => object.prefabStampId === 'desert-road-salvage-wall'), true, 'spawn road boundary beat should be visible immediately');
  assert.equal(objects.some((object) => object.assetKey === 'curated/jul9-roadside-buildings-large-02-roadside-convenience-store'), true, 'opening should have a large roadside building visible at spawn without covering the hero');
  assert.equal(objects.some((object) => object.assetKey === 'curated/jul9-main-street-storefronts-large-02-bank-loan-office-front'), true, 'opening should telegraph the next authored town beat with the large storefront sheet');
  assert.equal(objects.some((object) => object.assetKey.startsWith('curated/jul9-rocks-boulders-')), true, 'opening should use the new rock/boulder prop sheet');
  assert.equal(objects.some((object) => object.assetKey.startsWith('curated/jul9-fences-barricades-')), true, 'opening should use the new fence/barricade sheet for authored route boundaries');
  assert.equal(objects.some((object) => object.assetKey.startsWith('curated/jul9-industrial-mining-')), true, 'opening should use the new crypto-industrial sheet as roadside dressing');
  assert.equal(objects.some((object) => object.assetKey.startsWith('curated/jul9-landmark-microscene-')), true, 'opening should use the new micro-scene sheet for authored POI flavor');
  assert.equal(objects.some((object) => object.assetKey === 'curated/jul9-buildings-landmarks-01-gas-station-kiosk'), true, 'opening should read as an authored roadside fuel stop');
  assert.equal(objects.some((object) => object.assetKey === 'curated/jul9-landmark-microscene-09-broken-arcade-cabinet'), true, 'Lester flavor should use the small broken-cabinet microscene');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/building/arcade-cabinet'), false, 'building-scale arcade cabinet must not overwhelm the opening gameplay view');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/prop/bus-stop-sign' || object.assetKey === 'level1-authored-stamp/river-bridge-arrow-sign'), true, 'opening should include route signage without covering the hero start');
  assert.equal(objects.every((object) => levelOneCuratedAssetSrc(object.assetKey)), true, 'every object should resolve through the Level 1 runtime art policy');
});

test('WO-48 spawn gate redress keeps the opening safe while preserving route signage', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 0, playerY: 0, window: 18 });
  const gateRadius = HMH_LEVEL_ONE_SPAWN_GATE_REDRESS.safeRadiusTiles;
  const insideGate = objects.filter((object) => Math.hypot(object.gridX, object.gridY) < gateRadius);

  assert.equal(insideGate.length > 0, true, 'spawn gate should still contain readable low route cues');
  assert.equal(insideGate.some((object) => object.assetKey === 'level-1/prop/bus-stop-sign' || object.assetKey === 'level1-authored-stamp/river-bridge-arrow-sign'), false, 'route signage must sit outside the safe radius so it does not cover the hero');
  assert.equal(objects.some((object) => object.assetKey === 'level-1/prop/bus-stop-sign' || object.assetKey === 'level1-authored-stamp/river-bridge-arrow-sign'), true, 'opening still preserves authored route signage outside the safe radius');
  assert.equal(levelOneOpeningGroundRoleForTile({ worldX: 0, worldY: 5 }), 'road', 'spawn gate keeps low road/readability ground through ground-role metadata');
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
  assert.equal(composition.objects.every((object) => levelOneCuratedAssetSrc(object.assetKey)), true, 'all opening objects use approved Level 1 runtime art');
});

test('WO-63 Level 1 far-field dressing uses explicit authored prefab stamps and exact asset keys', () => {
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.length >= 8, true, 'world dressing needs named prefab stamps for town, farm, forest, water, desert, and boss-yard reads');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.authoredPrefabStamp === true), true);
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.anchor && Number.isFinite(stamp.anchor.x) && Number.isFinite(stamp.anchor.y)), true);
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.assetKeys.length === stamp.objects.length), true, 'stamps should expose the exact runtime asset keys they place');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.every((stamp) => stamp.assetKeys.every((assetKey) => levelOneVisibleAssetByKey(assetKey))), true, 'all stamp asset keys must resolve to curated or generated authored-stamp art');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.some((stamp) => stamp.routeBeat === 'boss' && stamp.id.includes('innercity-gate')), true, 'boss-yard gate prefab must be an authored exact-key stamp');
  assert.equal(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.some((stamp) => stamp.routeBeat === 'chokepoint' && stamp.assetKeys.includes('level-1/water/water-02')), true, 'shoreline ford source stamp should retain exact water/bridge provenance');

  const farObjects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 94, playerY: 6, window: 18 });
  assert.equal(farObjects.length >= 18, true, `expected dense authored far-field objects around traversal, got ${farObjects.length}`);
  assert.equal(farObjects.some((object) => object.authoredPrefabStamp === true && object.prefabStampId === 'innercity-gate-barricade'), true, 'visible objects should come from the authored boss-yard prefab stamp');
  assert.equal(farObjects.some((object) => object.routeBeat === 'boss' && object.sceneRole === 'landmark'), true, 'far-field traversal needs exact-key landmark silhouettes');
  assert.equal(farObjects.some((object) => object.sceneRole === 'wall' || object.sceneRole === 'tree'), true, 'far-field traversal needs visible boundaries');
  assert.equal(farObjects.every((object) => object.use !== 'terrain'), true, 'far-field terrain must not be drawn as obstacle props');
  assert.equal(farObjects.every((object) => object.use !== 'water'), true, 'water belongs in the collision-backed ground plan, not pasted prop cards');
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
  const jul9Rock = levelOneCuratedAssetSrc('curated/jul9-rocks-boulders-07-stacked-rocks');
  assert.match(jul9Rock, /hmh-curated-level-art\/props\/environment\/jul9-rocks-boulders/);
  const jul9Industrial = levelOneCuratedAssetSrc('curated/jul9-industrial-mining-03-small-generator');
  assert.match(jul9Industrial, /hmh-curated-level-art\/props\/environment\/jul9-industrial-mining/);
  const jul9Fence = levelOneCuratedAssetSrc('curated/jul9-fences-barricades-14-roadblock-cluster');
  assert.match(jul9Fence, /hmh-curated-level-art\/props\/environment\/jul9-fences-barricades/);
  const jul9MicroScene = levelOneCuratedAssetSrc('curated/jul9-landmark-microscene-12-drainage-culvert');
  assert.match(jul9MicroScene, /hmh-curated-level-art\/props\/environment\/jul9-landmark-microscene/);
});

test('Jul 9 10:19 fences, industrial props, and micro-scenes are visible in authored Level 1 route beats', () => {
  const sampleViews = [
    { playerX: 18, playerY: 5, stampId: 'desert-road-salvage-wall', prefixes: ['curated/jul9-fences-barricades-'] },
    { playerX: 64, playerY: 7, stampId: 'shoreline-ford-bank', prefixes: ['curated/jul9-landmark-microscene-'] },
    { playerX: 78, playerY: 20, stampId: 'farmstead-fence-pocket', prefixes: ['curated/jul9-fences-barricades-'] },
    { playerX: 94, playerY: 0, stampId: 'innercity-gate-barricade', prefixes: ['curated/jul9-industrial-mining-', 'curated/jul9-fences-barricades-'] },
  ];

  for (const view of sampleViews) {
    const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: view.playerX, playerY: view.playerY, window: 10 });
    const stampObjects = objects.filter((object) => object.prefabStampId === view.stampId);
    assert.ok(stampObjects.length, `${view.stampId} should emit authored objects`);
    for (const prefix of view.prefixes) {
      assert.ok(stampObjects.some((object) => object.assetKey.startsWith(prefix)), `${view.stampId} should include ${prefix}`);
    }
  }
});

test('Jul 9 11:16 buildings, neighborhoods, park, water, cliffs, cover, and power-yard sheets are authored into Level 1 biome pockets', () => {
  const sampleViews = [
    { playerX: 48, playerY: 8, stampId: 'civic-park-town-pocket', prefixes: ['curated/jul9-civic-buildings-large-', 'curated/jul9-main-street-storefronts-large-', 'curated/jul9-park-rest-area-', 'curated/jul9-small-cover-loot-'] },
    { playerX: 88, playerY: -66, stampId: 'neighborhood-house-yard-pocket', prefixes: ['curated/jul9-residential-house-facades-large-', 'curated/jul9-garages-sheds-large-', 'curated/jul9-neighborhood-fences-hedges-', 'curated/jul9-neighborhood-yard-clutter-', 'curated/jul9-neighborhood-combo-'] },
    { playerX: 106, playerY: -54, stampId: 'residential-block-backlot-pocket', prefixes: ['curated/jul9-residential-block-buildings-large-', 'curated/jul9-vegetation-crop-edge-'] },
    { playerX: 66, playerY: 7, stampId: 'canal-park-ford-pocket', prefixes: ['curated/jul9-creek-canal-culvert-', 'curated/jul9-cliff-ditch-boundary-', 'curated/jul9-vegetation-crop-edge-'] },
    { playerX: 42, playerY: 6, stampId: 'ghost-town-facade-row-pocket', prefixes: ['curated/jul9-ghost-town-facade-modules-', 'curated/jul9-roadside-buildings-large-'] },
    { playerX: 100, playerY: 6, stampId: 'industrial-power-yard-extraction-pocket', prefixes: ['curated/jul9-power-yard-extraction-'] },
  ];

  for (const view of sampleViews) {
    const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: view.playerX, playerY: view.playerY, window: 12 });
    const stampObjects = objects.filter((object) => object.prefabStampId === view.stampId);
    assert.ok(stampObjects.length, `${view.stampId} should emit authored objects`);
    for (const prefix of view.prefixes) {
      assert.ok(stampObjects.some((object) => object.assetKey.startsWith(prefix)), `${view.stampId} should include ${prefix}`);
    }
  }
});

test('compact Level 1 has authored scene coverage across the whole map instead of only the spawn corridor', () => {
  const sampleViews = [
    { playerX: -108, playerY: -78, prefix: 'curated/jul9-desert-' },
    { playerX: -36, playerY: -82, prefix: 'curated-tree/jul9-riparian-' },
    { playerX: 42, playerY: -78, prefix: 'curated/jul9-river-obstacles-b-' },
    { playerX: 104, playerY: -66, prefix: 'curated/jul9-neighborhood-small-props-b-' },
    { playerX: -106, playerY: 2, prefix: 'curated/jul9-route-signs-beacons-b-' },
    { playerX: 104, playerY: 4, prefix: 'curated/jul9-extraction-monuments-b-' },
    { playerX: -96, playerY: 78, prefix: 'curated/jul9-desert-rock-formations-b-' },
    { playerX: -20, playerY: 82, prefix: 'curated/jul9-forest-obstacles-b-' },
    { playerX: 96, playerY: 78, prefix: 'curated/jul9-ambient-water-glow-b-' },
  ];

  for (const view of sampleViews) {
    const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: view.playerX, playerY: view.playerY, window: 18 });
    assert.ok(objects.length >= 4, `expected authored scene coverage near ${view.playerX},${view.playerY}`);
    assert.ok(objects.some((object) => object.assetKey.startsWith(view.prefix)), `${view.prefix} should be visible near ${view.playerX},${view.playerY}`);
    assert.ok(objects.every((object) => levelOneVisibleAssetByKey(object.assetKey)), 'every full-map authored object should resolve to runtime art');
  }
});

test('active prefab composition selects coherent scenes instead of placing every available asset', () => {
  assert.ok(LEVEL_ONE_ACTIVE_PREFAB_STAMPS.length < LEVEL_ONE_AUTHORED_PREFAB_STAMPS.length, 'the asset library must not be treated as a place-everything checklist');
  const activeIds = new Set(LEVEL_ONE_ACTIVE_PREFAB_STAMPS.map((stamp) => stamp.id));
  for (const retired of [
    'ghost-town-frontage-pocket',
    'forest-mushroom-ring',
    'roadside-arcade-cache',
  ]) {
    assert.equal(activeIds.has(retired), false, `${retired} should not overlap its replacement composition`);
  }
  const fuelStop = LEVEL_ONE_ACTIVE_PREFAB_STAMPS.find((stamp) => stamp.id === 'roadside-fuel-stop-cache');
  assert.ok(fuelStop, 'the retired arcade stamp should be replaced by one coherent roadside fuel-stop stamp');
  assert.ok(fuelStop.assetKeys.includes('curated/jul9-buildings-landmarks-01-gas-station-kiosk'));
  assert.ok(fuelStop.assetKeys.includes('curated/jul9-vehicles-street-junk-12-gas-pump-pair'));
  assert.ok(fuelStop.assetKeys.includes('curated/jul9-landmark-microscene-09-broken-arcade-cabinet'));
  const anchorCounts = new Map();
  for (const stamp of LEVEL_ONE_ACTIVE_PREFAB_STAMPS) {
    const key = `${stamp.anchor.x}|${stamp.anchor.y}`;
    anchorCounts.set(key, (anchorCounts.get(key) ?? 0) + 1);
  }
  assert.ok([...anchorCounts.values()].every((count) => count <= 1), 'active authored scenes should not stack multiple prefabs on one anchor');
});

test('boss-yard composition keeps one perimeter service shed and removes the duplicate center blockage', () => {
  const bossYardObjects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 100, playerY: 6, window: 18 });
  const serviceSheds = bossYardObjects.filter((object) => object.assetKey === 'curated/jul9-industrial-buildings-large-03-crypto-mining-service-shed');
  const purposeBuiltWarehouses = bossYardObjects.filter((object) => object.assetKey === 'wo105-world/extraction-yard-warehouse');

  assert.equal(serviceSheds.length, 1, 'boss yard should retain one perimeter service shed, not duplicate the landmark through overlapping stamps');
  assert.equal(serviceSheds[0].prefabStampId, 'compact-east-extraction-yard');
  assert.equal(purposeBuiltWarehouses.length, 1, 'purpose-built warehouse should remain the primary boss-yard industrial landmark');
  const powerYard = LEVEL_ONE_ACTIVE_PREFAB_STAMPS.find((stamp) => stamp.id === 'industrial-power-yard-extraction-pocket');
  assert.ok(powerYard, 'power-yard beacon and cover pocket remains active');
  assert.equal(powerYard.assetKeys.includes('curated/jul9-industrial-buildings-large-03-crypto-mining-service-shed'), false, 'power-yard pocket must not place a second shed into the combat center');
  assert.ok(powerYard.assetKeys.some((assetKey) => assetKey.startsWith('curated/jul9-power-yard-extraction-')), 'power-yard beacon, battery, barricade, and hazard art remain');
});

test('runtime emits only opening and selected prefab compositions, not the compressed legacy contract strip', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 48, playerY: 6, window: 40 });
  assert.ok(objects.length <= 72, `town traversal window should stay readable and performant, got ${objects.length} objects`);
  assert.equal(objects.every((object) => object.id.startsWith('curated-opening-') || object.id.startsWith('curated-prefab-')), true);
});

test('buildings, trees, walls, vehicles, and substantial world props expose solid collision semantics', () => {
  const sampleViews = [
    [0, 5],
    [-36, -82],
    [104, -66],
    [74, 8],
    [104, 4],
  ];
  const objects = sampleViews.flatMap(([playerX, playerY]) => buildLevelOneCuratedVisibleSceneObjects({ playerX, playerY, window: 20 }));
  const vehicles = objects.filter((object) => object.sceneRole === 'vehicle');
  const structures = objects.filter((object) =>
    ['wall', 'tree', 'canopy-occluder'].includes(object.sceneRole)
    || (object.sceneRole === 'landmark' && /(?:house|garage|storefront|shed|warehouse|town-hall|gate|buildings-large)/i.test(object.assetKey)));

  assert.ok(vehicles.length >= 3, 'collision tour should include multiple vehicle blockers');
  assert.equal(vehicles.every((object) => object.solid === true), true, 'cars, trucks, pickups, and vans must block movement and shots');
  assert.equal(vehicles.every((object) => object.footprintTiles?.w > 0 && object.footprintTiles?.h > 0), true, 'vehicles need full authored base footprints, not center-point circles');
  assert.ok(structures.length >= 12, 'collision tour should include buildings, walls, and trees');
  assert.equal(structures.every((object) => object.solid === true), true, 'buildings, walls, and tree boundaries must be solid');
  assert.equal(structures.every((object) => object.footprintTiles?.w > 0 && object.footprintTiles?.h > 0), true, 'buildings, walls, and trees need full collision footprints');

  const northeast = buildLevelOneCuratedVisibleSceneObjects({ playerX: 104, playerY: -66, window: 18 });
  for (const label of ['weathered-picket-fence', 'trash-can-bags', 'stone-well']) {
    const object = northeast.find((item) => item.assetKey.includes(label));
    assert.ok(object, `${label} should be placed in the neighborhood`);
    assert.equal(object.solid, true, `${label} should have sensible collision`);
  }
});

test('authored solid props remain stable as the player approaches instead of disappearing to clear a moving safety bubble', () => {
  const overview = buildLevelOneCuratedVisibleSceneObjects({ playerX: 104, playerY: -66, window: 18 });
  const house = overview.find((object) => object.assetKey.includes('boarded-ranch-house'));
  assert.ok(house, 'neighborhood overview should include the ranch house');
  assert.equal(house.solid, true);

  const approached = buildLevelOneCuratedVisibleSceneObjects({ playerX: house.gridX, playerY: house.gridY, window: 10 });
  assert.ok(approached.some((object) => object.id === house.id), 'solid authored objects must not pop out when the player reaches their collision footprint');
});

test('WO-102 mega-props are real alpha-clean runtime assets and emit visible Level 1 objects', () => {
  assert.equal(WO102_MEGA_PROP_ASSETS.length, 3);
  for (const asset of WO102_MEGA_PROP_ASSETS) {
    const runtimePath = asset.src.replace('./', 'apps/portal/');
    assert.equal(asset.bakedShadow, true, `${asset.id} should carry baked shadow metadata`);
    assert.equal(asset.shadowDirection, 'south-east');
    assert.equal(asset.footprintTiles.w > 5, true, `${asset.id} must be a large footprint mega-prop`);
    assert.equal(levelOneCuratedAssetSrc(asset.id), asset.src, `${asset.id} must resolve through the live image resolver`);
    assert.equal(existsSync(repoPath(runtimePath)), true, `${asset.id} PNG should exist on disk`);
    if (existsSync(repoPath('.git/index'))) {
      const trackedPath = execFileSync('git', ['ls-files', '--error-unmatch', runtimePath], {
        cwd: repoPath(''),
        encoding: 'utf8',
      }).trim();
      assert.equal(trackedPath, runtimePath, `${asset.id} must be a tracked clean-clone deployment input`);
    }
  }

  const proofViews = [
    { key: 'wo102-megaprop/noodle-bar-storefront', playerX: -106, playerY: 2, stampId: 'compact-west-route-town' },
    { key: 'wo102-megaprop/forest-rock-outcrop', playerX: -50, playerY: -82, stampId: 'wo102-forest-cliff-proof' },
    { key: 'wo102-megaprop/farm-barn-silo-cluster', playerX: 78, playerY: 20, stampId: 'farmstead-fence-pocket' },
  ];
  for (const view of proofViews) {
    const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: view.playerX, playerY: view.playerY, window: 10 });
    const object = objects.find((item) => item.assetKey === view.key);
    assert.ok(object, `${view.key} should be visible near its R1 proof coordinate`);
    assert.equal(object.authoredPrefabStamp, true);
    assert.equal(object.prefabStampId, view.stampId);
    assert.ok(object.footprintTiles?.w >= 5, `${view.key} should carry runtime footprint metadata`);
    assert.ok(object.collisionPolygons?.length >= 1, `${view.key} should carry collision metadata`);
    assert.match(object.r1Observation, /seed 1337/);
  }
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
    ...buildLevelOneCuratedVisibleSceneObjects({ playerX: 116, playerY: 6, window: 10 }),
  ];
  for (const key of requiredKeys) {
    const object = gapBeatObjects.find((item) => item.assetKey === key);
    assert.ok(object, `${key} should be emitted as a visible authored prefab object`);
    assert.equal(object.authoredPrefabStamp, true);
  }
});

test('WO-104/105/106 world-kit assets are wired as authored nature, arena, vehicle, and micro-scene stamps', () => {
  assert.equal(WO104_106_WORLD_KIT_STAMPS.assetPackId, 'hmh-wo104-106-world-kit-v1');
  assert.equal(WO104_106_WORLD_KIT_STAMPS.requiredKeys.length >= 15, true, 'WO-105 needs expanded building/road/arena coverage, not only the first three markers');
  for (const key of WO104_106_WORLD_KIT_STAMPS.requiredKeys) {
    const src = wo104106WorldKitAssetSrc(key);
    assert.match(src, /hmh-wo104-106-world-kit\//, `${key} should resolve through the WO-104/105/106 world-kit manifest`);
    assert.equal(levelOneCuratedAssetSrc(key), src, `${key} should route through the combined visible-runtime resolver`);
    assert.equal(existsSync(repoPath(src.replace('./', 'apps/portal/'))), true, `${key} PNG should exist on disk`);
  }

  const wo105Keys = WO104_106_WORLD_KIT_STAMPS.requiredKeys.filter((key) => key.startsWith('wo105-world/'));
  assert.deepEqual(wo105Keys.sort(), [
    'wo105-world/bank-plaza-kiosk',
    'wo105-world/container-cover-line',
    'wo105-world/cracked-road-barricade',
    'wo105-world/cracked-road-junction',
    'wo105-world/extraction-yard-warehouse',
    'wo105-world/forest-log-arena-ring',
    'wo105-world/second-town-building-row',
    'wo105-world/town-bank-frontage',
  ].sort(), 'WO-105 should ship the full building/road/arena replacement set');

  const checkpointViews = [
    { playerX: -22, playerY: -84, stampId: 'wo104-forest-canopy-cliff-checkpoint', keys: ['wo104-world/forest-canopy-sway', 'wo104-world/mossy-cliff-wall'] },
    { playerX: 84, playerY: 7, stampId: 'wo104-lakeside-firefly-bank-checkpoint', keys: ['wo104-world/reed-bank-fireflies', 'wo104-world/park-tree-bench-cluster'] },
    { playerX: -90, playerY: 4, stampId: 'wo105-bank-plaza-arena-checkpoint', keys: ['wo105-world/bank-plaza-kiosk', 'wo105-world/town-bank-frontage'] },
    { playerX: 55, playerY: 12, stampId: 'wo105-forest-log-arena-checkpoint', keys: ['wo105-world/forest-log-arena-ring'] },
    { playerX: 94, playerY: -58, stampId: 'wo105-second-town-road-checkpoint', keys: ['wo105-world/second-town-building-row'] },
    { playerX: 104, playerY: 18, stampId: 'wo105-container-extraction-yard-checkpoint', keys: ['wo105-world/container-cover-line', 'wo105-world/extraction-yard-warehouse'] },
    { playerX: 74, playerY: 8, stampId: 'wo106-roadside-vehicle-micro-scenes', keys: ['wo106-world/abandoned-pickup', 'wo106-world/delivery-van-cache', 'wo106-world/critter-dust-burrow'] },
  ];
  for (const view of checkpointViews) {
    const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: view.playerX, playerY: view.playerY, window: 10 });
    for (const key of view.keys) {
      const object = objects.find((item) => item.assetKey === key && item.prefabStampId === view.stampId);
      assert.ok(object, `${key} should be visible near ${view.stampId}`);
      assert.equal(object.authoredPrefabStamp, true);
      assert.equal(object.prefabStampId, view.stampId);
    }
  }

  const wo105StampObjects = checkpointViews
    .filter((view) => view.stampId.startsWith('wo105-'))
    .flatMap((view) => buildLevelOneCuratedVisibleSceneObjects({ playerX: view.playerX, playerY: view.playerY, window: 10 })
      .filter((object) => object.prefabStampId === view.stampId));
  assert.equal(wo105StampObjects.length >= 12, true, 'WO-105 capture tour should expose dense authored arena objects');
  assert.equal(wo105StampObjects.some((object) => object.assetKey.startsWith('level-1/building/')), false, 'WO-105 stamps should de-reference old generic level-1 building placeholders');

  const visibleRouteOverlays = checkpointViews
    .flatMap((view) => buildLevelOneCuratedVisibleSceneObjects({ playerX: view.playerX, playerY: view.playerY, window: 10 }))
    .filter((object) => object.use === 'route' || /cracked-road|level-1\/road\//.test(object.assetKey));
  assert.deepEqual(visibleRouteOverlays.map((object) => object.assetKey), [], 'route/road plates are ground metadata now, not visible prop overlays');
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
  assert.equal(source.includes('buildLevelOneWorldV3VisibleObjects'), true);
  assert.equal(source.includes('levelOneCuratedRuntimeArtPolicy'), true);
  assert.equal(source.includes('curatedLevelOneImage'), true);

  const currentObstacles = source.slice(source.indexOf('function currentObstacles()'), source.indexOf('// Per-role art sizing'));
  assert.equal(currentObstacles.includes('buildLevelOneWorldV3VisibleObjects'), true, 'currentObstacles should inject Blueprint v3 visible Level 1 art');
  assert.equal(currentObstacles.includes('if (isLevelOneCuratedRuntime())'), true, 'Level 1 should have an explicit curated-runtime branch');
  assert.equal(currentObstacles.indexOf('buildLevelOneWorldV3VisibleObjects') < currentObstacles.indexOf('sceneObjectsNear('), true, 'Blueprint v3 authored objects must be chosen before procedural scatter');
  assert.match(source, /function currentObstacleCacheKey\(\)/, 'obstacle cache should expose a state-aware key');
  const cacheKeySource = source.slice(source.indexOf('function currentObstacleCacheKey()'), source.indexOf('function currentObstacles()'));
  assert.match(cacheKeySource, /combat\.playerMapX/);
  assert.match(cacheKeySource, /combat\.playerMapY/);
  assert.match(cacheKeySource, /combat\.currentCampaignLevelId/);
  assert.match(cacheKeySource, /combat\.viewportMode/);
  assert.match(currentObstacles, /_obstacleCacheKey === cacheKey/, 'same-frame cache reuse must require identical world state');

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

  const packageJson = JSON.parse(readFileSync(repoPath('package.json'), 'utf8'));
  assert.match(packageJson.scripts['visual:regression'], /^npm run build && /, 'visual regression must capture the current dist bundle, never a stale build');
  assert.match(packageJson.scripts['visual:accept'], /^npm run build && /, 'baseline acceptance must also capture the current dist bundle');
});
