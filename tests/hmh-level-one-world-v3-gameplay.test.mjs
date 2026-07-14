import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_LAYOUT_V4,
  HMH_LEVEL_ONE_LAYOUT_V4_STAMP_PLACEMENTS,
  HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS,
  levelOneLayoutV4BoundaryPaletteForSide,
  levelOneLayoutV4SpawnRequest,
  levelOneLayoutV4ZoneAt,
  levelOneWorldV3BossPoint,
  levelOneWorldV3DistrictContextAt,
  levelOneWorldV3ExtractionPoint,
  levelOneWorldV3PoiDirectiveAt,
} from '../apps/portal/src/hmh-level-one-world-v3-gameplay.mjs';
import { LEVEL_ONE_AUTHORED_PREFAB_STAMPS } from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';
import {
  authoredCellToWorld,
  HMH_LEVEL_ONE_WORLD_V3,
  levelOneWorldV3CellAt,
} from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';

test('World v3 maps all six campaign POIs onto approved authored anchors', () => {
  assert.equal(HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS.length, 6);
  for (const entry of HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS) {
    assert.deepEqual(entry.world, authoredCellToWorld(entry.blueprint.x, entry.blueprint.y));
    const directive = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x, playerY: entry.world.y });
    assert.equal(directive.id, entry.campaign.id);
    assert.equal(directive.blueprintPoiId, entry.blueprint.id);
    assert.equal(directive.phaseHint, 'poi-arena');
    assert.equal(directive.worldX, entry.world.x);
    assert.equal(directive.worldY, entry.world.y);
    assert.equal(directive.source, 'hmh-level-one-world-v3');
  }
});

test('World v3 POI directives transition from telegraph to approach to arena and honor completion', () => {
  const entry = HMH_LEVEL_ONE_WORLD_V3_GAMEPLAY_POIS.find((poi) => poi.campaign.id === 'rugpull-gulch');
  const telegraph = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x - 20, playerY: entry.world.y });
  const approach = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x - 12, playerY: entry.world.y });
  const arena = levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x - 2, playerY: entry.world.y });
  assert.equal(telegraph.phaseHint, 'poi-telegraph');
  assert.equal(approach.phaseHint, 'poi-approach');
  assert.equal(arena.phaseHint, 'poi-arena');
  assert.notEqual(levelOneWorldV3PoiDirectiveAt({ playerX: entry.world.x, playerY: entry.world.y, completedPoiIds: ['rugpull-gulch'] })?.id, 'rugpull-gulch');
});

test('World v3 district context follows authored biome, route, and POI cells', () => {
  assert.equal(levelOneWorldV3DistrictContextAt(0, 0).districtFamily, 'desert-approach');
  const ghost = authoredCellToWorld(24, 65);
  const context = levelOneWorldV3DistrictContextAt(ghost.x, ghost.y);
  assert.equal(context.districtFamily, 'ghost-town');
  assert.equal(context.poiId, 'rugpull-gulch');
  assert.equal(context.source, 'hmh-level-one-world-v3');
});

test('World v3 final boss and extraction use the approved boss yard and road-out anchors', () => {
  assert.deepEqual(levelOneWorldV3BossPoint(), authoredCellToWorld(87, 35));
  const extraction = levelOneWorldV3ExtractionPoint();
  assert.deepEqual({ x: extraction.worldX, y: extraction.worldY }, authoredCellToWorld(93, 39));
  assert.equal(extraction.source, 'hmh-level-one-world-v3');
  assert.ok(extraction.radiusTiles > 1);
});

test('World v3 gameplay geography is explicitly integrated and syntax-gated', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /levelOneWorldV3PoiDirectiveAt/);
  assert.match(main, /levelOneWorldV3DistrictContextAt/);
  assert.match(main, /levelOneWorldV3BossPoint/);
  assert.match(main, /levelOneWorldV3ExtractionPoint/);
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /hmh-level-one-world-v3-gameplay\.mjs/);
  assert.match(syntax, /hmh-level-one-world-v3-gameplay\.test\.mjs/);
});


const worldAnchorIds = new Set([
  ...Object.keys(HMH_LEVEL_ONE_WORLD_V3.anchors),
  ...HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest.map((poi) => poi.id),
]);
const stampIds = new Set(LEVEL_ONE_AUTHORED_PREFAB_STAMPS.map((stamp) => stamp.id));

function assertPassable(world, label) {
  const cell = levelOneWorldV3CellAt(world.x, world.y);
  assert.equal(cell.inBounds, true, `${label} must stay in bounds`);
  assert.equal(cell.blocked, false, `${label} must stay passable`);
}

test('Level 1 layout v4 exposes a two-loop authored macro graph with one readable convergence', () => {
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.id, 'level-1-crypto-wasteland-layout-v4');
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.routes.mainSpine.length >= 6, true);
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.routes.northRiskLoop.length >= 4, true);
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.routes.southRewardLoop.length >= 4, true);
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.routes.northRiskLoop.at(-1), 'crossroads-trading-post');
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.routes.southRewardLoop.at(-1), 'crossroads-trading-post');
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.routes.finalApproach.at(-1), 'extraction');
  assert.equal(HMH_LEVEL_ONE_LAYOUT_V4.zones.length >= 7, true);
  assert.equal(new Set(HMH_LEVEL_ONE_LAYOUT_V4.zones.map((zone) => zone.id)).size, HMH_LEVEL_ONE_LAYOUT_V4.zones.length);
});

test('layout v4 route anchors and combat-zone centers stay on the certified World v3 navigation grid', () => {
  const routeAnchorIds = Object.values(HMH_LEVEL_ONE_LAYOUT_V4.routes).flat();
  for (const anchorId of routeAnchorIds) {
    assert.equal(worldAnchorIds.has(anchorId), true, `unknown route anchor ${anchorId}`);
  }
  for (const zone of HMH_LEVEL_ONE_LAYOUT_V4.zones) {
    assert.equal(worldAnchorIds.has(zone.anchorId), true, `unknown zone anchor ${zone.anchorId}`);
    assertPassable(authoredCellToWorld(zone.authoredX, zone.authoredY), zone.id);
    assert.ok(zone.clearRadiusTiles >= 5, `${zone.id} needs readable combat negative space`);
    assert.ok(zone.spawnLanes.length >= 2, `${zone.id} needs multiple authored spawn lanes`);
  }
});

test('layout v4 places a dense curated set of shipped prefab stamps without duplicate placement IDs', () => {
  assert.ok(HMH_LEVEL_ONE_LAYOUT_V4_STAMP_PLACEMENTS.length >= 14);
  assert.equal(new Set(HMH_LEVEL_ONE_LAYOUT_V4_STAMP_PLACEMENTS.map((placement) => placement.id)).size, HMH_LEVEL_ONE_LAYOUT_V4_STAMP_PLACEMENTS.length);
  for (const placement of HMH_LEVEL_ONE_LAYOUT_V4_STAMP_PLACEMENTS) {
    assert.equal(stampIds.has(placement.stampId), true, `missing prefab stamp ${placement.stampId}`);
    assert.equal(worldAnchorIds.has(placement.anchorId), true, `missing placement anchor ${placement.anchorId}`);
    assert.ok(['spawn', 'poi', 'route', 'boss', 'extraction'].includes(placement.kind));
  }
});

test('layout v4 spawn lanes are deterministic, safely distant, and vary by authored zone', () => {
  const spawn = authoredCellToWorld(HMH_LEVEL_ONE_WORLD_V3.anchors.spawn.x, HMH_LEVEL_ONE_WORLD_V3.anchors.spawn.y);
  const a = levelOneLayoutV4SpawnRequest({ playerX: spawn.x, playerY: spawn.y, seed: 1337, minDistanceTiles: 18 });
  const b = levelOneLayoutV4SpawnRequest({ playerX: spawn.x, playerY: spawn.y, seed: 1337, minDistanceTiles: 18 });
  assert.deepEqual(a, b);
  assert.ok(a.distanceTiles >= 18);
  assert.ok(a.laneId);
  assert.equal(a.zoneId, 'broken-road-salvage-run');

  const forestWorld = authoredCellToWorld(20, 38);
  const forestZone = levelOneLayoutV4ZoneAt(forestWorld.x, forestWorld.y);
  const forest = levelOneLayoutV4SpawnRequest({ playerX: forestWorld.x, playerY: forestWorld.y, seed: 1337, minDistanceTiles: 18 });
  assert.equal(forestZone.id, 'dry-forest-ridge-loop');
  assert.equal(forest.zoneId, forestZone.id);
  assert.notEqual(forest.laneId, a.laneId);
});

test('layout v4 perimeter palettes are side-specific and use shipped visible blocker families', () => {
  const sides = ['north', 'south', 'west', 'east'];
  for (const side of sides) {
    const samples = [0, 1, 2].map((index) => levelOneLayoutV4BoundaryPaletteForSide(side, index));
    assert.ok(samples.every((sample) => sample && sample.assetKey && sample.footprintTiles.w > 0 && sample.footprintTiles.h > 0));
    assert.ok(samples.every((sample) => sample.solid === true && sample.sceneRole));
    assert.equal(new Set(samples.map((sample) => sample.assetKey)).size >= 2, true, `${side} needs controlled visual variation`);
  }
});

test('all World v3 bridges retain a fully passable 5x5 deck and reachable bank-adjacent exits', () => {
  assert.ok(HMH_LEVEL_ONE_WORLD_V3.bridges.length >= 4);
  for (const bridge of HMH_LEVEL_ONE_WORLD_V3.bridges) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const cell = HMH_LEVEL_ONE_WORLD_V3.layers.groundNav[bridge.y + dy]?.[bridge.x + dx];
        assert.notEqual(cell, '#', `${bridge.id} deck blocked at ${dx},${dy}`);
      }
    }
  }
});
