import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OBSTACLE_CELL,
  obstaclesInCell,
  obstaclesNear,
  resolvePlayerCollision,
  obstacleHitAt,
  obstacleHitAlongSegment,
  circleTargetHitAlongSegment,
  drawRectIntersectsViewport,
  isWaterAt,
  resolveWaterCollision,
  findNearestDrySpawn,
  resolveDistantSpawnPosition,
  resolveTrackingAiMove,
} from '../apps/portal/src/world-obstacles.mjs';

// A simple deterministic biome stub so the model is testable without the real one.
const biomeStub = (seed, x, y) => {
  const v = Math.abs((x * 3 + y * 7 + seed) % 4);
  return ['town', 'forest', 'rocky', 'desert'][v];
};

test('obstaclesInCell is deterministic for a given seed + cell', () => {
  const a = obstaclesInCell(1234, 5, -3, biomeStub);
  const b = obstaclesInCell(1234, 5, -3, biomeStub);
  assert.deepEqual(a, b);
});

test('obstacles do NOT change as the player moves (stable by world cell)', () => {
  // Two different player positions that both see the same world cell must yield
  // identical obstacles for that cell — this is the anti-"disappearing" guarantee.
  const seed = 99;
  const cellObs1 = obstaclesInCell(seed, 4, 4, biomeStub);
  const cellObs2 = obstaclesInCell(seed, 4, 4, biomeStub);
  assert.deepEqual(cellObs1, cellObs2);
  // And obstaclesNear from two overlapping windows agree on shared cells.
  const near1 = obstaclesNear(seed, 28, 28, 10, biomeStub);
  const near2 = obstaclesNear(seed, 30, 30, 10, biomeStub);
  const shared = near1.filter((o) => near2.some((p) => p.id === o.id));
  for (const o of shared) {
    const match = near2.find((p) => p.id === o.id);
    assert.deepEqual(o, match);
  }
});

test('every obstacle is solid and has a positive collision radius', () => {
  const obs = obstaclesNear(7, 50, -40, 14, biomeStub);
  assert.ok(obs.length > 0, 'expected some obstacles in a large window');
  for (const o of obs) {
    assert.equal(o.solid, true);
    assert.ok(o.radius > 0);
    assert.ok(['building', 'doodad'].includes(o.kind));
    assert.equal(typeof o.worldX, 'number');
    assert.equal(typeof o.worldY, 'number');
  }
});

test('spawn-safe zone around origin is kept clear of obstacles', () => {
  // No obstacle should sit within the spawn-safe radius of the world origin.
  for (let s = 0; s < 40; s += 1) {
    const obs = obstaclesNear(s, 0, 0, 12, biomeStub, { spawnSafeRadius: 6 });
    for (const o of obs) {
      assert.ok(Math.hypot(o.worldX, o.worldY) >= 6, `obstacle too close to spawn on seed ${s}`);
    }
  }
});

test('resolvePlayerCollision pushes the player out of a solid obstacle', () => {
  const obstacles = [{ worldX: 10, worldY: 0, radius: 1, solid: true }];
  // Player tries to walk INTO the obstacle center.
  const r = resolvePlayerCollision(8, 0, 10, 0, 0.4, obstacles);
  const dist = Math.hypot(r.x - 10, r.y - 0);
  assert.ok(dist >= 1 + 0.4 - 1e-6, `player should be pushed to >= radius+playerRadius, got ${dist}`);
});

test('resolvePlayerCollision lets the player move freely when not overlapping', () => {
  const obstacles = [{ worldX: 100, worldY: 100, radius: 1, solid: true }];
  const r = resolvePlayerCollision(0, 0, 1, 1, 0.4, obstacles);
  assert.equal(r.x, 1);
  assert.equal(r.y, 1);
});

test('terrain swept collision cannot tunnel through a one-tile blocker when the destination is dry', () => {
  const thinWall = (_seed, x) => (x >= 4.5 && x <= 5.5 ? 'water' : 'road');
  const resolved = resolveWaterCollision(1337, 0, 0, 10, 0, thinWall, { radius: 0.4, maxStep: 0.2 });
  assert.ok(resolved.x < 4.2, `actor should stop before the thin blocker, got ${resolved.x}`);
  assert.equal(resolved.y, 0);
});

test('terrain swept collision honors actor radius and slides along blocked banks', () => {
  const eastBank = (_seed, x) => (x >= 5 ? 'water' : 'road');
  const stopped = resolveWaterCollision(1337, 4, 0, 4.9, 0, eastBank, { radius: 0.42, maxStep: 0.1 });
  assert.ok(stopped.x <= 4.5, `actor radius should remain outside the bank, got ${stopped.x}`);
  const slid = resolveWaterCollision(1337, 4, 0, 5.2, 2, eastBank, { radius: 0.42, maxStep: 0.1 });
  assert.ok(slid.x <= 4.5, `slide should not enter the bank, got ${slid.x}`);
  assert.ok(slid.y > 1.5, `slide should preserve the clear axis, got ${slid.y}`);
});

test('obstacleHitAt detects a bullet inside a solid obstacle and misses outside', () => {
  const obstacles = [{ worldX: 5, worldY: 5, radius: 1, solid: true }];
  assert.ok(obstacleHitAt(5, 5, obstacles));
  assert.equal(obstacleHitAt(20, 20, obstacles), null);
});

test('footprint rectangles block the full base of wide buildings instead of only their center', () => {
  const obstacles = [{ worldX: 10, worldY: 5, radius: 0.5, footprintTiles: { w: 6, h: 2 }, solid: true }];
  const resolved = resolvePlayerCollision(5, 5, 7.2, 5, 0.4, obstacles);
  assert.ok(resolved.x <= 6.61, `player should stop at the west building wall, got ${resolved.x}`);
  assert.ok(obstacleHitAt(12.5, 5, obstacles), 'shots should hit the wide end of the building footprint');
});

test('player swept collision cannot tunnel through a wide footprint in one movement step', () => {
  const obstacles = [{ id: 'warehouse', worldX: 5, worldY: 0, radius: 0.5, footprintTiles: { w: 4, h: 2 }, solid: true }];
  const resolved = resolvePlayerCollision(0, 0, 10, 0, 0.4, obstacles);
  assert.ok(resolved.x <= 2.61, `player should stop at the west warehouse wall, got ${resolved.x}`);
  assert.equal(resolved.y, 0);
});

test('tracking AI detours around authored walls instead of remaining stuck on the direct line', () => {
  const wall = [{ id: 'town-wall', worldX: 5, worldY: 0, radius: 0.5, footprintTiles: { w: 2, h: 7 }, solid: true }];
  let position = { x: 0, y: 0 };
  for (let step = 0; step < 80; step += 1) {
    position = resolveTrackingAiMove({
      seed: 1337,
      fromX: position.x,
      fromY: position.y,
      toX: position.x + 0.5,
      toY: position.y,
      targetX: 10,
      targetY: 0,
      detourSide: 1,
      radius: 0.4,
      obstacles: wall,
      biomeAt: () => 'road',
    });
  }
  assert.ok(position.x > 6, `tracking enemy should route beyond the wall, got ${position.x},${position.y}`);
});

test('cached low-FPS AI steps cannot tunnel through narrow walls or water banks', () => {
  const wall = [{ id: 'narrow-wall', worldX: 3, worldY: 0, radius: 0.5, footprintTiles: { w: 1, h: 6 }, solid: true }];
  let wallPosition = { x: 0, y: 0 };
  for (let frame = 0; frame < 12; frame += 1) {
    wallPosition = resolveTrackingAiMove({
      seed: 1337,
      fromX: wallPosition.x,
      fromY: wallPosition.y,
      toX: wallPosition.x + 1.5,
      toY: wallPosition.y,
      targetX: 10,
      targetY: 0,
      detourSide: 1,
      radius: 0.4,
      obstacles: wall,
      biomeAt: () => 'road',
    });
    assert.equal(obstacleHitAt(wallPosition.x, wallPosition.y, wall), null, `frame ${frame} entered the narrow wall`);
  }

  const waterBank = (_seed, x) => (x >= 4 ? 'water' : 'road');
  let bankPosition = { x: 0, y: 8 };
  for (let frame = 0; frame < 12; frame += 1) {
    bankPosition = resolveTrackingAiMove({
      seed: 1337,
      fromX: bankPosition.x,
      fromY: bankPosition.y,
      toX: bankPosition.x + 1.5,
      toY: bankPosition.y,
      targetX: 10,
      targetY: bankPosition.y,
      detourSide: 1,
      radius: 0.4,
      obstacles: [],
      biomeAt: waterBank,
    });
    assert.ok(bankPosition.x <= 3.5, `frame ${frame} crossed the water bank at ${bankPosition.x}`);
  }
});

test('authored footprints replace oversized fallback circles so clear lanes beside buildings stay open', () => {
  const obstacles = [{ worldX: 10, worldY: 5, radius: 5, footprintTiles: { w: 6, h: 2 }, solid: true }];
  const resolved = resolvePlayerCollision(10, 2, 10, 3, 0.4, obstacles);
  assert.deepEqual(resolved, { x: 10, y: 3 });
});

test('swept projectile collision catches fast shots crossing thin props and walls', () => {
  const obstacles = [
    { id: 'tree', worldX: 5, worldY: 0, radius: 0.7, solid: true },
    { id: 'wall', worldX: 12, worldY: 0, radius: 0.4, footprintTiles: { w: 4, h: 1 }, solid: true },
  ];
  assert.equal(obstacleHitAlongSegment(0, 0, 9, 0, obstacles)?.id, 'tree');
  assert.equal(obstacleHitAlongSegment(9, 0, 16, 0, obstacles)?.id, 'wall');
  assert.equal(obstacleHitAlongSegment(0, 5, 16, 5, obstacles), null);
});

test('screen-rectangle culling keeps a large prop until every visible pixel leaves the viewport', () => {
  const viewport = { width: 1280, height: 720 };
  assert.equal(drawRectIntersectsViewport({ x: 1270, y: 300, width: 256, height: 256 }, viewport), true);
  assert.equal(drawRectIntersectsViewport({ x: -250, y: 300, width: 256, height: 256 }, viewport), true);
  assert.equal(drawRectIntersectsViewport({ x: 1281, y: 300, width: 256, height: 256 }, viewport), false);
  assert.equal(drawRectIntersectsViewport({ x: -257, y: 300, width: 256, height: 256 }, viewport), false);
});

test('authored collision polygons trim transparent corners from large prop blockers', () => {
  const irregular = {
    id: 'irregular-megaprop',
    worldX: 10,
    worldY: 5,
    solid: true,
    footprintTiles: { w: 6, h: 4 },
    collisionPolygons: [[
      [1, 0.75],
      [5, 0.75],
      [5, 3.25],
      [1, 3.25],
    ]],
  };
  assert.equal(obstacleHitAt(10, 5, [irregular])?.id, 'irregular-megaprop');
  assert.equal(obstacleHitAt(12.75, 6.75, [irregular]), null, 'transparent footprint corner should remain walkable and shootable');
  const movement = resolvePlayerCollision(6, 6.75, 13, 6.75, 0.2, [irregular]);
  assert.ok(movement.x > 12.5, `movement through trimmed transparent corner should stay open, got ${movement.x}`);
});

test('swept actor hit detection catches fast bullets that cross an enemy between endpoints', () => {
  const enemies = [
    { id: 'near', mapX: 5, mapY: 0, hp: 10, hitRadius: 0.7 },
    { id: 'far', mapX: 9, mapY: 0, hp: 10, hitRadius: 0.7 },
  ];
  assert.equal(circleTargetHitAlongSegment(0, 0, 12, 0, enemies, { defaultRadius: 0.72 })?.id, 'near');
  assert.equal(circleTargetHitAlongSegment(0, 3, 12, 3, enemies, { defaultRadius: 0.72 }), null);
});

test('piercing bullets skip already-hit targets without allocating a filtered target list', () => {
  const enemies = [
    { id: 'already-hit', mapX: 3, mapY: 0, hp: 10, hitRadius: 0.7 },
    { id: 'next-hit', mapX: 6, mapY: 0, hp: 10, hitRadius: 0.7 },
  ];
  const excludedTargets = new Set([enemies[0]]);
  assert.equal(circleTargetHitAlongSegment(0, 0, 10, 0, enemies, {
    defaultRadius: 0.72,
    excludedTargets,
  })?.id, 'next-hit');
  assert.equal(enemies.length, 2, 'the shared enemy list must remain untouched');
});

test('findNearestDrySpawn moves an initial player start off water', () => {
  const waterAtOrigin = (seed, x, y) => (Math.hypot(x, y) < 3 ? 'water' : 'desert');
  const spawn = findNearestDrySpawn(99, 0, 0, waterAtOrigin, { maxRadius: 8, step: 1 });

  assert.equal(isWaterAt(99, spawn.x, spawn.y, waterAtOrigin), false);
  assert.ok(Math.hypot(spawn.x, spawn.y) >= 3, `spawn should leave origin lake, got ${spawn.x},${spawn.y}`);
});

test('resolveDistantSpawnPosition keeps regular enemies far from a moving player', () => {
  const resolved = resolveDistantSpawnPosition({
    seed: 3,
    playerX: 12,
    playerY: -4,
    desiredX: 12,
    desiredY: -4,
    minDistance: 18,
    fallbackAngleRadians: 0,
    fallbackRadiusTiles: 4,
    biomeAt: biomeStub,
  });

  assert.ok(resolved.distance >= 18, `enemy spawn distance should be >= 18, got ${resolved.distance}`);
  assert.notDeepEqual([resolved.x, resolved.y], [12, -4]);
});

test('resolveDistantSpawnPosition pushes authored mini-boss slots out to a safe dry ring', () => {
  const moatEastOfPlayer = (seed, x, y) => {
    const dist = Math.hypot(x, y);
    if (x > 0 && dist >= 20 && dist < 25) return 'water';
    return 'town';
  };
  const resolved = resolveDistantSpawnPosition({
    seed: 4,
    playerX: 0,
    playerY: 0,
    desiredX: 2,
    desiredY: 0,
    minDistance: 24,
    fallbackAngleRadians: 0,
    fallbackRadiusTiles: 4.8,
    biomeAt: moatEastOfPlayer,
  });

  assert.ok(resolved.distance >= 24, `mini-boss spawn distance should be >= 24, got ${resolved.distance}`);
  assert.equal(isWaterAt(4, resolved.x, resolved.y, moatEastOfPlayer), false);
});

test('OBSTACLE_CELL is a sane positive integer', () => {
  assert.ok(Number.isInteger(OBSTACLE_CELL) && OBSTACLE_CELL >= 4);
});
