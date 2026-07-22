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

const scaledCell = (x, y) => [Math.round(x * 149 / 99), Math.round(y * 149 / 99)];

test('Blueprint v5 runtime exports the complete approved 150x150 authored world', () => {
  assert.equal(HMH_LEVEL_ONE_WORLD_V3.id, 'hmh-level-1-world-blueprint-v5');
  assert.equal(HMH_LEVEL_ONE_WORLD_V3.version, 5);
  assert.equal(HMH_LEVEL_ONE_WORLD_V3.status, 'approved-live-runtime');
  assert.deepEqual(HMH_LEVEL_ONE_WORLD_V3.dimensions, { width: 150, height: 150, cellCount: 22500 });
  for (const layer of ['terrain', 'biome', 'elevation', 'groundNav', 'route', 'encounter']) {
    assert.equal(HMH_LEVEL_ONE_WORLD_V3.layers[layer].length, 150, `${layer} row count`);
    assert.ok(HMH_LEVEL_ONE_WORLD_V3.layers[layer].every((row) => row.length === 150), `${layer} row width`);
  }
});

test('Blueprint v3 coordinates round-trip through a spawn-centered live world', () => {
  const spawn = HMH_LEVEL_ONE_WORLD_V3.anchors.spawn;
  assert.deepEqual(authoredCellToWorld(spawn.x, spawn.y), { x: 0, y: 0 });
  assert.deepEqual(worldToAuthoredCell(0, 0), { x: spawn.x, y: spawn.y, inBounds: true });
  for (const [x, y] of [[0, 0], [149, 149], scaledCell(35, 39), scaledCell(87, 35)]) {
    const world = authoredCellToWorld(x, y);
    assert.deepEqual(worldToAuthoredCell(world.x, world.y), { x, y, inBounds: true });
  }
  assert.deepEqual(levelOneWorldV3WorldBounds(), { minX: -12, maxX: 137, minY: -117, maxY: 32, width: 150, height: 150 });
});

test('Blueprint v3 runtime cell metadata controls terrain, traversal, routes, and bridges', () => {
  const spawn = levelOneWorldV3CellAt(0, 0);
  const deepWater = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(...scaledCell(49, 64))));
  const cliff = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(...scaledCell(1, 0))));
  const ford = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(...scaledCell(56, 59))));
  const woodBridge = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(...scaledCell(35, 39))));
  const stoneBridge = levelOneWorldV3CellAt(...Object.values(authoredCellToWorld(...scaledCell(39, 52))));

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
  for (const [authoredX, authoredY] of [[0, 0], scaledCell(24, 65), scaledCell(38, 20), scaledCell(87, 35), [149, 149]]) {
    const { x, y } = authoredCellToWorld(authoredX, authoredY);
    assert.equal(levelOneWorldV3ElevationAt(x, y), Number(levelOneWorldV3CellAt(x, y).elevation));
  }
  const spawn = HMH_LEVEL_ONE_WORLD_V3.anchors.spawn;
  for (let authoredY = 0; authoredY < HMH_LEVEL_ONE_WORLD_V3.dimensions.height; authoredY += 1) {
    for (let authoredX = 0; authoredX < HMH_LEVEL_ONE_WORLD_V3.dimensions.width; authoredX += 1) {
      const elevation = levelOneWorldV3ElevationAt(authoredX - spawn.x, authoredY - spawn.y);
      assert.equal(elevation, Number(HMH_LEVEL_ONE_WORLD_V3.layers.elevation[authoredY][authoredX]));
      assert.ok(elevation >= 0 && elevation <= 3);
    }
  }
  assert.equal(levelOneWorldV3ElevationAt(500, 500), 3);
});

test('Blueprint v3 edge masks are reciprocal and deterministic across every neighbor seam', () => {
  for (let y = 0; y < HMH_LEVEL_ONE_WORLD_V3.dimensions.height; y += 1) {
    for (let x = 0; x < HMH_LEVEL_ONE_WORLD_V3.dimensions.width; x += 1) {
      const world = authoredCellToWorld(x, y);
      const first = levelOneWorldV3NeighborMask(world.x, world.y);
      const second = levelOneWorldV3NeighborMask(world.x, world.y);
      assert.deepEqual(first, second);
      assert.ok(first.sameTerrainMask >= 0 && first.sameTerrainMask <= 15);
      assert.ok(first.walkableMask >= 0 && first.walkableMask <= 15);
      if (x < HMH_LEVEL_ONE_WORLD_V3.dimensions.width - 1) {
        const east = levelOneWorldV3NeighborMask(world.x + 1, world.y);
        assert.equal(Boolean(first.sameTerrainMask & 2), Boolean(east.sameTerrainMask & 8));
        assert.equal(Boolean(first.walkableMask & 2), Boolean(east.walkableMask & 8));
      }
      if (y < HMH_LEVEL_ONE_WORLD_V3.dimensions.height - 1) {
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
  assert.ok(report.reachableGroundCells > 18000);
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
