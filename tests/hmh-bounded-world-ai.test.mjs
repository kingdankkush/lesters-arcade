import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildLevelOneRunWorldDimensions } from '../apps/portal/src/arcade-core.mjs';
import { resolveBoundedAiMove } from '../apps/portal/src/world-obstacles.mjs';

const dryBiome = () => 'town';

test('WO-24 bounded AI move clamps enemy chase at finite Level 1 edges', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 80 });
  const moved = resolveBoundedAiMove({
    seed: 24,
    fromX: world.maxX - 1,
    fromY: 0,
    toX: world.maxX + 8,
    toY: 0,
    worldBounds: world,
    biomeAt: dryBiome,
  });

  assert.equal(moved.x, world.maxX);
  assert.equal(moved.y, 0);
  assert.equal(moved.boundsAdjusted, true);
  assert.equal(moved.adjusted, true);
});

test('WO-24 bounded AI move still applies obstacle and water resolution before bounds', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 80 });
  const obstacles = [{ worldX: 3, worldY: 0, radius: 1, solid: true }];
  const moved = resolveBoundedAiMove({
    seed: 24,
    fromX: 0,
    fromY: 0,
    toX: 3,
    toY: 0,
    radius: 0.4,
    obstacles,
    worldBounds: world,
    biomeAt: dryBiome,
  });

  assert.ok(moved.x < 3, `enemy should be pushed out of obstacle, got ${moved.x}`);
  assert.equal(moved.obstacleAdjusted, true);
  assert.equal(moved.boundsAdjusted, false);
});

test('runtime uses obstacle-tracking pursuit for chase and bounded movement for ranged backaway', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const updateBlock = main.slice(main.indexOf('function updateRoguelikeEnemies'), main.indexOf('function dropRoguelikePowerUp'));

  assert.ok(main.includes('resolveTrackingAiMove'), 'main.js should import the obstacle-tracking movement helper');
  assert.ok(updateBlock.includes('resolveTrackingAiMove({'), 'chasing enemies should detour around authored obstacles');
  assert.ok(updateBlock.includes('resolveBoundedAiMove({'), 'ranged backaway should retain bounded movement');
  assert.match(updateBlock, /boss: Boolean\(enemy\.boss \|\| enemy\.miniBoss \|\| enemy\.finalBossProxy\)/, 'bosses should use the persistent catch-up pursuit speed law');
  assert.ok(updateBlock.includes('worldBounds: enemyWorldBounds'), 'enemy AI should receive finite world bounds');
  assert.equal(updateBlock.includes('resolveWaterCollision(runSeed, fromX, fromY, afterObstacles.x, afterObstacles.y, biomeAt)'), false, 'old unbounded inline movement path should be removed');
});
