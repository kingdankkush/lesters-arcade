import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OBSTACLE_CELL,
  obstaclesInCell,
  obstaclesNear,
  resolvePlayerCollision,
  obstacleHitAt,
  isWaterAt,
  resolveWaterCollision,
  findNearestDrySpawn,
  resolveDistantSpawnPosition,
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

test('obstacleHitAt detects a bullet inside a solid obstacle and misses outside', () => {
  const obstacles = [{ worldX: 5, worldY: 5, radius: 1, solid: true }];
  assert.ok(obstacleHitAt(5, 5, obstacles));
  assert.equal(obstacleHitAt(20, 20, obstacles), null);
});

test('findNearestDrySpawn moves an initial player start off water', () => {
  const waterAtOrigin = (seed, x, y) => (Math.hypot(x, y) < 3 ? 'water' : 'desert');
  const spawn = findNearestDrySpawn(99, 0, 0, waterAtOrigin, { maxRadius: 8, step: 1 });

  assert.equal(isWaterAt(99, spawn.x, spawn.y, waterAtOrigin), false);
  assert.ok(Math.hypot(spawn.x, spawn.y) >= 3, `spawn should leave origin lake, got ${spawn.x},${spawn.y}`);
});

test('resolveDistantSpawnPosition never allows enemies to spawn on top of the player', () => {
  const resolved = resolveDistantSpawnPosition({
    seed: 3,
    playerX: 12,
    playerY: -4,
    desiredX: 12,
    desiredY: -4,
    minDistance: 9,
    fallbackAngleRadians: 0,
    fallbackRadiusTiles: 4,
    biomeAt: biomeStub,
  });

  assert.ok(resolved.distance >= 9, `enemy spawn distance should be >= 9, got ${resolved.distance}`);
  assert.notDeepEqual([resolved.x, resolved.y], [12, -4]);
});

test('resolveDistantSpawnPosition pushes authored mini-boss slots out to a safe dry ring', () => {
  const moatEastOfPlayer = (seed, x, y) => {
    const dist = Math.hypot(x, y);
    if (x > 0 && dist >= 9 && dist < 12) return 'water';
    return 'town';
  };
  const resolved = resolveDistantSpawnPosition({
    seed: 4,
    playerX: 0,
    playerY: 0,
    desiredX: 2,
    desiredY: 0,
    minDistance: 11,
    fallbackAngleRadians: 0,
    fallbackRadiusTiles: 4.8,
    biomeAt: moatEastOfPlayer,
  });

  assert.ok(resolved.distance >= 11, `mini-boss spawn distance should be >= 11, got ${resolved.distance}`);
  assert.equal(isWaterAt(4, resolved.x, resolved.y, moatEastOfPlayer), false);
});

test('OBSTACLE_CELL is a sane positive integer', () => {
  assert.ok(Number.isInteger(OBSTACLE_CELL) && OBSTACLE_CELL >= 4);
});
