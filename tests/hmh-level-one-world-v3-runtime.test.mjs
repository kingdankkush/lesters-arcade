import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_WORLD_V3,
  authoredCellToWorld,
  buildLevelOneWorldV3Reachability,
  levelOneWorldV3CellAt,
  levelOneWorldV3BridgeCrossing,
  levelOneWorldV3ElevationAt,
  levelOneWorldV3NeighborMask,
  levelOneWorldV3WorldBounds,
  worldToAuthoredCell,
} from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';
import { resolveWaterCollision } from '../apps/portal/src/world-obstacles.mjs';

test('Blueprint v3 runtime exports the complete approved 100x100 authored world', () => {
  assert.equal(HMH_LEVEL_ONE_WORLD_V3.id, 'hmh-level-1-world-blueprint-v3');
  assert.equal(HMH_LEVEL_ONE_WORLD_V3.status, 'approved-live-runtime');
  assert.deepEqual(HMH_LEVEL_ONE_WORLD_V3.dimensions, { width: 100, height: 100, cellCount: 10000 });
  for (const layer of ['terrain', 'biome', 'elevation', 'groundNav', 'route', 'encounter']) {
    assert.equal(HMH_LEVEL_ONE_WORLD_V3.layers[layer].length, 100, `${layer} row count`);
    assert.ok(HMH_LEVEL_ONE_WORLD_V3.layers[layer].every((row) => row.length === 100), `${layer} row width`);
  }
});

test('Blueprint v3 coordinates round-trip through a spawn-centered live world', () => {
  const spawn = HMH_LEVEL_ONE_WORLD_V3.anchors.spawn;
  assert.deepEqual(authoredCellToWorld(spawn.x, spawn.y), { x: 0, y: 0 });
  assert.deepEqual(worldToAuthoredCell(0, 0), { x: spawn.x, y: spawn.y, inBounds: true });
  for (const [x, y] of [[0, 0], [99, 99], [35, 39], [87, 35]]) {
    const world = authoredCellToWorld(x, y);
    assert.deepEqual(worldToAuthoredCell(world.x, world.y), { x, y, inBounds: true });
  }
  assert.deepEqual(levelOneWorldV3WorldBounds(), { minX: -8, maxX: 91, minY: -78, maxY: 21, width: 100, height: 100 });
});

test('Blueprint v3 runtime cell metadata controls terrain, traversal, routes, and bridges', () => {
  const spawn = levelOneWorldV3CellAt(0, 0);
  const deepWater = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(49, 64)));
  const cliff = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(1, 0)));
  const ford = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(56, 59)));
  const woodBridge = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(35, 39)));
  const stoneBridge = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(39, 52)));

  assert.equal(spawn.authoredX, HMH_LEVEL_ONE_WORLD_V3.anchors.spawn.x);
  assert.equal(spawn.groundNav, '.');
  assert.equal(deepWater.terrain, 'W');
  assert.equal(deepWater.groundNav, '#');
  assert.equal(cliff.terrain, 'X');
  assert.equal(cliff.groundNav, '#');
  assert.equal(ford.terrain, 'w');
  assert.equal(ford.groundNav, '~');
  assert.equal(woodBridge.terrain, 'H');
  assert.equal(woodBridge.groundNav, '.');
  assert.equal(woodBridge.route, 'B');
  assert.equal(stoneBridge.terrain, 'Q');
  assert.equal(stoneBridge.groundNav, '.');
  assert.equal(levelOneWorldV3CellAt(500, 500).groundNav, '#', 'outside the finite world must be blocked');
});

test('Blueprint v3 scalar elevation lookup matches cell metadata without building runtime cell objects', () => {
  for (const [x, y] of [[0, 0], [16, -13], [30, -58], [79, -43], [91, 21]]) {
    assert.equal(levelOneWorldV3ElevationAt(x, y), Number(levelOneWorldV3CellAt(x, y).elevation));
  }
  const spawn = HMH_LEVEL_ONE_WORLD_V3.anchors.spawn;
  for (let authoredY = 0; authoredY < 100; authoredY += 1) {
    for (let authoredX = 0; authoredX < 100; authoredX += 1) {
      const elevation = levelOneWorldV3ElevationAt(authoredX - spawn.x, authoredY - spawn.y);
      assert.equal(elevation, Number(HMH_LEVEL_ONE_WORLD_V3.layers.elevation[authoredY][authoredX]));
      assert.ok(elevation >= 0 && elevation <= 4);
    }
  }
  assert.equal(levelOneWorldV3ElevationAt(500, 500), 4);
});

test('Blueprint v3 edge masks are reciprocal and deterministic across every neighbor seam', () => {
  for (let y = 0; y < 100; y += 1) {
    for (let x = 0; x < 100; x += 1) {
      const world = authoredCellToWorld(x, y);
      const first = levelOneWorldV3NeighborMask(world.x, world.y);
      const second = levelOneWorldV3NeighborMask(world.x, world.y);
      assert.deepEqual(first, second);
      assert.ok(first.sameTerrainMask >= 0 && first.sameTerrainMask <= 15);
      assert.ok(first.walkableMask >= 0 && first.walkableMask <= 15);
      if (x < 99) {
        const east = levelOneWorldV3NeighborMask(world.x + 1, world.y);
        assert.equal(Boolean(first.sameTerrainMask & 2), Boolean(east.sameTerrainMask & 8));
        assert.equal(Boolean(first.walkableMask & 2), Boolean(east.walkableMask & 8));
      }
      if (y < 99) {
        const south = levelOneWorldV3NeighborMask(world.x, world.y + 1);
        assert.equal(Boolean(first.sameTerrainMask & 4), Boolean(south.sameTerrainMask & 1));
        assert.equal(Boolean(first.walkableMask & 4), Boolean(south.walkableMask & 1));
      }
    }
  }
});

test('Blueprint v3 runtime preserves complete ground reachability and bridge connectivity', () => {
  const report = buildLevelOneWorldV3Reachability();
  assert.equal(report.reachableGroundCells, HMH_LEVEL_ONE_WORLD_V3.metrics.reachableGroundCellsFromSpawn);
  assert.ok(report.reachableGroundCells > 8000);
  assert.equal(report.unreachablePassableCells, 0);
  assert.equal(report.criticalPath.every((anchor) => anchor.reachable), true);
  assert.equal(report.pointsOfInterest.every((anchor) => anchor.reachable), true);
  assert.equal(report.bridges.length, 4);
  assert.equal(report.bridges.every((bridge) => bridge.reachable && bridge.connectsWalkableSides), true);
});

test('every authored bridge supports a player-radius swept entry, deck crossing, and bank exit', () => {
  const blockedTerrainAsWater = (_seed, worldX, worldY) => levelOneWorldV3CellAt(worldX, worldY).blocked ? 'water' : 'road';
  for (const bridge of HMH_LEVEL_ONE_WORLD_V3.bridges) {
    const crossing = levelOneWorldV3BridgeCrossing(bridge.id);
    assert.ok(crossing, `${bridge.id} needs a runtime crossing contract`);
    assert.equal(crossing.id, bridge.id);
    assert.notEqual(levelOneWorldV3CellAt(crossing.entryWorld.x, crossing.entryWorld.y).groundNav, '#');
    assert.notEqual(levelOneWorldV3CellAt(crossing.exitWorld.x, crossing.exitWorld.y).groundNav, '#');
    const resolved = resolveWaterCollision(
      1337,
      crossing.entryWorld.x,
      crossing.entryWorld.y,
      crossing.exitWorld.x,
      crossing.exitWorld.y,
      blockedTerrainAsWater,
      { radius: 0.42, maxStep: 0.1 },
    );
    assert.ok(
      Math.hypot(resolved.x - crossing.exitWorld.x, resolved.y - crossing.exitWorld.y) < 0.05,
      `${bridge.id} blocked the player at ${resolved.x},${resolved.y} before the declared exit bank`,
    );
  }
  assert.equal(levelOneWorldV3BridgeCrossing('missing-bridge'), null);
});

test('Blueprint v3 runtime adapter and tests are included in the explicit syntax gate', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /apps\/portal\/src\/hmh-level-one-world-v3-runtime\.mjs/);
  assert.match(syntax, /tests\/hmh-level-one-world-v3-runtime\.test\.mjs/);
});
