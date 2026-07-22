import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_WORLD_V3_OBJECTS,
  buildLevelOneWorldV3VisibleObjects,
  levelOneWorldV3ObjectReport,
} from '../apps/portal/src/hmh-level-one-world-v3-objects.mjs';
import {
  authoredCellToWorld,
  HMH_LEVEL_ONE_WORLD_V3,
  levelOneWorldV3CellAt,
  levelOneWorldV3WorldBounds,
} from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';
import { levelOneCuratedAssetSrc } from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';
import { HMH_LEVEL_ONE_WORLD_V3_LANDMARKS } from '../apps/portal/assets/generated/hmh-level-one-world-v3/hmh-level-one-world-v3-landmarks.mjs';

test('World v3 builds a bounded deterministic authored object layer with explicit collision truth', () => {
  const objects = HMH_LEVEL_ONE_WORLD_V3_OBJECTS;
  const report = levelOneWorldV3ObjectReport();
  assert.ok(objects.length >= 300 && objects.length <= 400, `expected a dense but bounded 150x150 object layer, got ${objects.length}`);
  assert.equal(report.total, objects.length);
  assert.ok(report.solid >= 120);
  assert.equal(new Set(objects.map((object) => object.id)).size, objects.length);

  for (const object of objects) {
    assert.equal(levelOneWorldV3CellAt(object.gridX, object.gridY).inBounds, true, `${object.id} must stay inside the finite world`);
    assert.ok(levelOneCuratedAssetSrc(object.assetKey), `${object.assetKey} must resolve to shipped art`);
    if (!object.solid) continue;
    assert.ok(object.footprintTiles?.w > 0 && object.footprintTiles?.h > 0, `${object.id} needs a footprint`);
    assert.ok(object.collisionPolygons?.length > 0, `${object.id} needs collision polygons`);
    const cell = levelOneWorldV3CellAt(object.gridX, object.gridY);
    assert.equal(cell.blocked, false, `${object.id} should not duplicate blocked terrain collision`);
    assert.equal(cell.route, '.', `${object.id} must not obstruct authored roads or bridges`);
    assert.ok(Math.hypot(object.gridX, object.gridY) >= 5, `${object.id} must keep the spawn combat lane clear`);
  }
});

test('World v3 includes every POI, boss, extraction, bridge-bank, and natural terrain family', () => {
  const report = levelOneWorldV3ObjectReport();
  for (const stampId of [
    'desert-road-salvage-wall',
    'roadside-fuel-stop-cache',
    'ruined-camp-bone-yard',
    'compact-southeast-glow-bank',
    'world-v3-pine-creek-timber-bridge',
  ]) assert.ok(report.byStamp[stampId] > 0, `missing authored stamp ${stampId}`);

  for (const retiredStampId of [
    'roadside-arcade-cache',
    'ghost-town-frontage-pocket',
    'forest-mushroom-ring',
    'ghost-town-facade-row-pocket',
    'wo104-forest-canopy-cliff-checkpoint',
    'compact-northwest-desert-outcrop',
    'wo105-second-town-road-checkpoint',
    'wo104-lakeside-firefly-bank-checkpoint',
    'litecoin-extraction-beacon-pad',
    'shoreline-ford-bank',
    'innercity-gate-barricade',
    'industrial-power-yard-extraction-pocket',
  ]) assert.equal(report.byStamp[retiredStampId], undefined, `legacy placeholder stamp ${retiredStampId} must stay retired`);
  for (const terrain of ['terrain-F', 'terrain-G', 'terrain-R', 'terrain-S']) {
    assert.ok(report.byTerrain[terrain] > 0, `missing authored natural family ${terrain}`);
  }
  const lighthouse = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.find((object) => object.id === 'world-v3-wrecked-lighthouse-landmark');
  assert.ok(lighthouse, 'wrecked lighthouse must use its own original runtime landmark');
  assert.equal(lighthouse.assetKey, 'world-v3-landmark/wrecked-litecoin-lighthouse');
  assert.equal(lighthouse.solid, true);
  assert.equal(lighthouse.interactive, true);
  assert.ok(levelOneCuratedAssetSrc(lighthouse.assetKey));
  const lighthouseObjects = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((object) => object.sourceZoneId === 'wrecked-lighthouse');
  assert.equal(lighthouseObjects.filter((object) => object.role === 'landmark').length, 1, 'the canonical wrecked lighthouse should be the only lighthouse landmark');
  assert.equal(lighthouseObjects.some((object) => object.assetKey.includes('ltc-beacon-pad')), false, 'an extraction beacon must not compete with the lighthouse');
  const glowBank = lighthouseObjects.filter((object) => object.prefabStampId === 'compact-southeast-glow-bank');
  assert.equal(glowBank.length, 7, 'the lighter glow bank should retain four sparks, two rapid strips, and one broken marker');
  assert.equal(glowBank.filter((object) => object.assetKey.includes('water-spark')).length, 4);
  assert.equal(glowBank.filter((object) => object.assetKey.includes('rapid-strip')).length, 2);
  assert.equal(glowBank.filter((object) => object.assetKey.includes('broken-floor-marker')).length, 1);

  const originalLandmarks = [
    ['world-v3-ghost-saloon-landmark', 'world-v3-landmark/ghost-saloon-square', true],
    ['world-v3-dry-forest-cave-landmark', 'world-v3-landmark/dry-forest-cave-mouth', true],
    ['world-v3-mesa-overlook-landmark', 'world-v3-landmark/mesa-overlook-outcrop', true],
    ['world-v3-frontier-town-hall-landmark', 'world-v3-landmark/frontier-town-exchange-hall', true],
    ['world-v3-crossroads-trading-post-landmark', 'world-v3-infrastructure/crossroads-wagon-trading-post', true],
    ['world-v3-rugpull-gulch-landmark', 'world-v3-infrastructure/rugpull-gulch-sheriff-water-tower', true],
    ['world-v3-litecoin-city-threshold-landmark', 'world-v3-landmark/litecoin-city-threshold-gate', false],
  ];
  for (const [id, assetKey, solid] of originalLandmarks) {
    const landmark = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.find((object) => object.id === id);
    assert.ok(landmark, `${id} must use original World v3 landmark art`);
    assert.equal(landmark.assetKey, assetKey);
    assert.equal(landmark.solid, solid);
    assert.equal(landmark.interactive, true);
    assert.ok(levelOneCuratedAssetSrc(assetKey), `${assetKey} must resolve to shipped art`);
  }

  const rugpullLandmark = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.find((object) => object.id === 'world-v3-rugpull-gulch-landmark');
  assert.deepEqual(rugpullLandmark?.footprintTiles, { w: 6.2, h: 4.2 });
  assert.deepEqual(rugpullLandmark?.drawFootprintTiles, { w: 5.0, h: 3.4 });

  const pineBridge = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.find((object) => object.id === 'world-v3-pine-creek-timber-bridge');
  assert.ok(pineBridge, 'Pine Creek semantic bridge must have one authored visual overlay');
  assert.equal(pineBridge.assetKey, 'world-v3-infrastructure/pine-creek-timber-bridge');
  const pineBridgeBlueprint = HMH_LEVEL_ONE_WORLD_V3.bridges.find((bridge) => bridge.id === 'pine-creek-wood-bridge');
  const pineBridgeWorld = authoredCellToWorld(pineBridgeBlueprint.x, pineBridgeBlueprint.y);
  assert.equal(pineBridge.gridX, pineBridgeWorld.x);
  assert.equal(pineBridge.gridY, pineBridgeWorld.y);
  assert.equal(pineBridge.solid, false, 'bridge overlay must not alter semantic bridge traversal');
  assert.equal(pineBridge.interactive, false);
  assert.equal(pineBridge.role, 'bridge');
  assert.ok(levelOneCuratedAssetSrc(pineBridge.assetKey));
  const pineBridgeAsset = HMH_LEVEL_ONE_WORLD_V3_LANDMARKS.assets.find((asset) => asset.key === pineBridge.assetKey);
  assert.match(pineBridgeAsset?.provenance?.processing ?? '', /horizontal mirror to authored crossing axis/);

  for (const poi of HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest) {
    const center = authoredCellToWorld(poi.x, poi.y);
    const intruders = HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((object) => (
      object.solid
      && object.role !== 'boundary'
      && object.sourceZoneId === poi.id
      && Math.hypot(object.gridX - center.x, object.gridY - center.y) < poi.arenaRadius
    ));
    assert.deepEqual(intruders.map((object) => object.id), [], `${poi.id} solid landmarks must stay on the arena perimeter`);
  }
});

test('World v3 landmark manifest records immutable per-asset source provenance without private paths', () => {
  const sourceArtifacts = new Set();
  const sourceHashes = new Set();
  for (const asset of HMH_LEVEL_ONE_WORLD_V3_LANDMARKS.assets) {
    assert.ok(['fal.ai', 'pixellab.ai'].includes(asset.provenance?.provider));
    assert.ok(['flux-2-klein-9b', 'create-map-object'].includes(asset.provenance?.model));
    assert.match(asset.provenance?.sourceArtifact ?? '', /^[a-z0-9-]+-source\.png$/);
    assert.match(asset.provenance?.sourceSha256 ?? '', /^[a-f0-9]{64}$/);
    assert.doesNotMatch(asset.provenance?.sourceArtifact ?? '', /[\\/]|Users|vault/i);
    assert.ok(asset.provenance?.processing?.includes('normalization'));
    sourceArtifacts.add(asset.provenance.sourceArtifact);
    sourceHashes.add(asset.provenance.sourceSha256);
  }
  assert.equal(sourceArtifacts.size, HMH_LEVEL_ONE_WORLD_V3_LANDMARKS.assets.length);
  assert.equal(sourceHashes.size, HMH_LEVEL_ONE_WORLD_V3_LANDMARKS.assets.length);
});

test('solid World v3 object footprints preserve routes to all critical and optional anchors', () => {
  const bounds = levelOneWorldV3WorldBounds();
  const blocked = new Set();
  const key = (x, y) => `${x}|${y}`;
  for (const object of HMH_LEVEL_ONE_WORLD_V3_OBJECTS.filter((entry) => entry.solid)) {
    const halfW = Math.max(0, Math.floor((object.footprintTiles.w - 0.01) / 2));
    const halfH = Math.max(0, Math.floor((object.footprintTiles.h - 0.01) / 2));
    for (let y = Math.round(object.gridY) - halfH; y <= Math.round(object.gridY) + halfH; y += 1) {
      for (let x = Math.round(object.gridX) - halfW; x <= Math.round(object.gridX) + halfW; x += 1) blocked.add(key(x, y));
    }
  }
  const queue = [[0, 0]];
  const visited = new Set([key(0, 0)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const nextKey = key(nx, ny);
      if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) continue;
      if (visited.has(nextKey) || blocked.has(nextKey) || levelOneWorldV3CellAt(nx, ny).blocked) continue;
      visited.add(nextKey);
      queue.push([nx, ny]);
    }
  }
  for (const anchor of [...HMH_LEVEL_ONE_WORLD_V3.criticalPath, ...HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest]) {
    const world = authoredCellToWorld(anchor.x, anchor.y);
    assert.ok(visited.has(key(world.x, world.y)), `${anchor.id} must remain reachable around object footprints`);
  }
  for (const bridge of HMH_LEVEL_ONE_WORLD_V3.bridges) {
    const world = authoredCellToWorld(bridge.x, bridge.y);
    assert.ok(visited.has(key(world.x, world.y)), `${bridge.id} must remain reachable`);
  }
});

test('World v3 boss-yard camera keeps one warehouse landmark while preserving extraction cover', () => {
  const bossAnchor = HMH_LEVEL_ONE_WORLD_V3.anchors.finalBoss;
  const bossWorld = authoredCellToWorld(bossAnchor.x, bossAnchor.y);
  const bossYard = buildLevelOneWorldV3VisibleObjects({ playerX: bossWorld.x, playerY: bossWorld.y, window: 18 });
  const warehouses = bossYard.filter((object) => object.assetKey === 'wo105-world/extraction-yard-warehouse');
  const containerCover = bossYard.filter((object) => object.assetKey === 'wo105-world/container-cover-line');

  assert.equal(warehouses.length, 1, 'nearby boss and extraction anchors must not render duplicate warehouse facades in one combat camera');
  assert.equal(warehouses[0].layoutPlacementId, 'v4-gulch-container-yard', 'the boss-yard perimeter owns the single warehouse landmark');
  assert.equal(containerCover.length, 2, 'both anchors retain low tactical container cover after landmark deduplication');
});

test('World v3 visibility queries are deterministic, local, and runtime-gated', () => {
  const first = buildLevelOneWorldV3VisibleObjects({ playerX: 16, playerY: -13, window: 18 });
  const second = buildLevelOneWorldV3VisibleObjects({ playerX: 16, playerY: -13, window: 18 });
  assert.deepEqual(first, second);
  assert.ok(first.length > 0 && first.length < HMH_LEVEL_ONE_WORLD_V3_OBJECTS.length);
  assert.equal(first.every((object) => Math.abs(object.gridX - 16) <= 26 && Math.abs(object.gridY + 13) <= 26), true);

  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /hmh-level-one-world-v3-objects\.mjs/);
  assert.match(syntax, /hmh-level-one-world-v3-objects\.test\.mjs/);
});
