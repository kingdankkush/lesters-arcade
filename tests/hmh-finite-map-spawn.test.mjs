import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildLevelOneRunWorldDimensions } from '../apps/portal/src/arcade-core.mjs';
import { resolveDistantSpawnPosition } from '../apps/portal/src/world-obstacles.mjs';

const dryBiome = () => 'town';

function within(world, point) {
  return point.x >= world.minX
    && point.x <= world.maxX
    && point.y >= world.minY
    && point.y <= world.maxY;
}

test('WO-23 finite spawn resolver keeps edge spawns inside Level 1 bounds while preserving safe distance', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 80 });
  const spawn = resolveDistantSpawnPosition({
    seed: 23,
    playerX: 45,
    playerY: 0,
    desiredX: 74,
    desiredY: 0,
    minDistance: 18,
    fallbackAngleRadians: 0,
    fallbackRadiusTiles: 20,
    biomeAt: dryBiome,
    worldBounds: world,
  });

  assert.equal(within(world, spawn), true, `spawn should stay inside bounds: ${JSON.stringify(spawn)}`);
  assert.ok(spawn.distance >= 18, `spawn distance should stay safe, got ${spawn.distance}`);
  assert.equal(spawn.boundsAdjusted, true);
});

test('WO-23 finite spawn resolver searches legal in-map arc when desired point clamps too close', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 80, height: 80 });
  const spawn = resolveDistantSpawnPosition({
    seed: 29,
    playerX: world.maxX - 1,
    playerY: world.maxY - 1,
    desiredX: world.maxX + 30,
    desiredY: world.maxY + 30,
    minDistance: 16,
    fallbackAngleRadians: Math.PI / 4,
    fallbackRadiusTiles: 20,
    biomeAt: dryBiome,
    worldBounds: world,
  });

  assert.equal(within(world, spawn), true, `corner spawn should stay inside bounds: ${JSON.stringify(spawn)}`);
  assert.ok(spawn.distance >= 16, `corner spawn should find an in-bounds safe arc, got ${spawn.distance}`);
  assert.notEqual(spawn.x, world.maxX, 'should not simply clamp to the nearest boundary point if that is unsafe');
});

test('WO-23 runtime routes roguelike enemy spawns through finite Level 1 bounds', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const spawnBlock = main.slice(main.indexOf('function spawnRoguelikeEnemy'), main.indexOf('function updateCampaignPoiEncounter'));

  assert.ok(spawnBlock.includes('worldBounds:'), 'spawn resolver should receive finite world bounds');
  assert.ok(spawnBlock.includes('buildLevelOneRunWorldDimensions({ width: combat.worldWidth, height: combat.worldHeight })'), 'runtime should derive spawn bounds from live Level 1 dimensions');
  assert.ok(spawnBlock.includes('boundsAdjusted'), 'runtime should preserve/debug bounds-adjusted spawn metadata');
});
