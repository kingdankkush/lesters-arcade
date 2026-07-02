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

test('WO-22 boundary obstacle query only returns nearby edge segments for render/collision budget', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 1000, height: 800 });
  const center = buildLevelOneBoundaryObstaclesNear({ world, playerX: 0, playerY: 0, window: 30 });
  const west = buildLevelOneBoundaryObstaclesNear({ world, playerX: world.minX + 2, playerY: 0, window: 30 });

  assert.equal(center.length, 0, 'center traversal should not allocate far-away boundary segments');
  assert.ok(west.length > 0, 'edge traversal should expose collision/dressing segments');
  assert.ok(west.every((edge) => Math.abs(edge.worldX - (world.minX)) <= 2 || Math.abs(edge.worldY) <= 35));
});

test('WO-22 runtime includes boundary edges in obstacle collision/render path', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('buildLevelOneBoundaryObstaclesNear'), 'main.js should import/use boundary edge obstacles');
  assert.ok(main.includes('boundaryObstacles'), 'currentObstacles should include boundary obstacles');
  assert.ok(main.includes('naturalEdgeType'), 'boundary edges should carry natural edge type metadata for renderer follow-up');
});
