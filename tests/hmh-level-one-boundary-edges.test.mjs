import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildLevelOneBoundaryObstaclesNear,
  buildLevelOneRunWorldDimensions,
} from '../apps/portal/src/arcade-core.mjs';

test('WO-22 boundary obstacles form solid natural edges around the finite Level 1 map', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 120, height: 80 });
  const edges = buildLevelOneBoundaryObstaclesNear({ world, playerX: 0, playerY: 0, window: 100, segmentSpacingTiles: 20 });
  const sides = new Set(edges.map((edge) => edge.boundarySide));

  assert.deepEqual([...sides].sort(), ['east', 'north', 'south', 'west']);
  assert.ok(edges.length >= 20, `expected a perimeter, got ${edges.length}`);
  assert.ok(edges.every((edge) => edge.solid === true));
  assert.ok(edges.every((edge) => edge.kind === 'boundary-edge'));
  assert.ok(edges.every((edge) => ['ridge', 'ravine', 'fence', 'riverbank'].includes(edge.naturalEdgeType)));
  assert.ok(edges.some((edge) => edge.worldX === world.minX && edge.boundarySide === 'west'));
  assert.ok(edges.some((edge) => edge.worldY === world.maxY && edge.boundarySide === 'south'));
});

test('boundary collision strips match visible segment direction and leave no pass-through gaps', () => {
  const spacing = 6;
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 100 });
  const edges = buildLevelOneBoundaryObstaclesNear({ world, playerX: world.minX, playerY: 0, window: 80, segmentSpacingTiles: spacing });
  assert.ok(edges.every((edge) => edge.collisionPolygons?.length === 1));

  for (const side of ['north', 'south', 'west', 'east']) {
    const alongAxis = side === 'north' || side === 'south' ? 'worldX' : 'worldY';
    const localAxis = side === 'north' || side === 'south' ? 0 : 1;
    const segments = edges.filter((edge) => edge.boundarySide === side).sort((a, b) => a[alongAxis] - b[alongAxis]);
    for (const edge of segments) {
      const values = edge.collisionPolygons[0].map((point) => point[localAxis]);
      assert.ok(Math.max(...values) - Math.min(...values) >= spacing, `${edge.id} collider must span to its neighbor`);
    }
  }
});

test('WO-22 boundary obstacle query only returns nearby edge segments for render/collision budget', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 1000, height: 800 });
  const center = buildLevelOneBoundaryObstaclesNear({ world, playerX: 0, playerY: 0, window: 30 });
  const west = buildLevelOneBoundaryObstaclesNear({ world, playerX: world.minX + 2, playerY: 0, window: 30 });

  assert.equal(center.length, 0, 'center traversal should not allocate far-away boundary segments');
  assert.ok(west.length > 0, 'edge traversal should expose collision/dressing segments');
  assert.ok(west.every((edge) => Math.abs(edge.worldX - (world.minX)) <= 2 || Math.abs(edge.worldY) <= 35));
});

test('World v3 west edge uses a coherent canyon kit instead of repeated water pools and ruin pillars', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 100 });
  const edges = buildLevelOneBoundaryObstaclesNear({ world, playerX: world.minX, playerY: 0, window: 80 });
  const westKeys = new Set(edges.filter((edge) => edge.boundarySide === 'west').map((edge) => edge.curatedAssetKey));
  assert.deepEqual([...westKeys].sort(), [
    'world-v3-infrastructure/canyon-boundary-bend',
    'world-v3-infrastructure/canyon-boundary-buttress',
    'world-v3-infrastructure/canyon-boundary-straight',
  ]);
  assert.equal(westKeys.has('level-1/water/water-02'), false);
  assert.equal(westKeys.has('level-1/prop/water-ruins2'), false);
});

test('WO-22 runtime includes boundary edges in obstacle collision/render path', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('buildLevelOneBoundaryObstaclesNear'), 'main.js should import/use boundary edge obstacles');
  assert.ok(main.includes('boundaryObstacles'), 'currentObstacles should include boundary obstacles');
  assert.ok(main.includes('naturalEdgeType'), 'boundary edges should carry natural edge type metadata for renderer follow-up');
});
