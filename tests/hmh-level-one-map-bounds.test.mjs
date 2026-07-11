import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildLevelOneMinimapModel,
  buildLevelOneRunWorldDimensions,
  clampLevelOneWorldPoint,
  pointWithinLevelOneBounds,
} from '../apps/portal/src/arcade-core.mjs';

test('WO-21 Level 1 world dimensions expose finite centered map bounds', () => {
  const world = buildLevelOneRunWorldDimensions();
  assert.equal(world.finite, true);
  assert.equal(world.origin, 'center');
  assert.equal(world.minX, -world.width / 2);
  assert.equal(world.maxX, world.width / 2);
  assert.equal(world.minY, -world.height / 2);
  assert.equal(world.maxY, world.height / 2);
  assert.ok(world.boundaryInsetTiles >= 3, 'bounds need an inset for future walls/natural edges');
});

test('WO-21 clamps players to the finite Level 1 map rectangle', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 80 });
  assert.deepEqual(clampLevelOneWorldPoint({ x: 0, y: 0, world }), { x: 0, y: 0, clamped: false });
  assert.deepEqual(clampLevelOneWorldPoint({ x: 999, y: -999, world }), { x: 50, y: -40, clamped: true });
  assert.equal(pointWithinLevelOneBounds({ x: 49.99, y: -39.99, world }), true);
  assert.equal(pointWithinLevelOneBounds({ x: 50.1, y: 0, world }), false);
});

test('Level 1 edge clamp keeps the complete player footprint inside the world', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 80 });
  assert.deepEqual(
    clampLevelOneWorldPoint({ x: 50, y: -40, world, padding: 0.42 }),
    { x: 49.58, y: -39.58, clamped: true },
  );
});

test('WO-21 minimap model normalizes player, enemy, POI, and extraction markers', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 100, height: 80 });
  const model = buildLevelOneMinimapModel({
    world,
    player: { x: 0, y: 0 },
    enemies: [
      { id: 'near', mapX: 10, mapY: 8, elite: false },
      { id: 'boss', mapX: 1000, mapY: 1000, elite: true, miniBoss: true },
    ],
    pois: [{ id: 'town', label: 'TOWN', worldX: -40, worldY: 20 }],
    extractionPoint: { worldX: 45, worldY: -35 },
  });

  assert.equal(model.version, 'wo-21-finite-level-one-minimap-v1');
  assert.equal(model.bounds.width, 100);
  assert.equal(model.player.x, 0.5);
  assert.equal(model.player.y, 0.5);
  assert.equal(model.enemies.length, 2);
  assert.equal(model.enemies[1].x, 1, 'off-map marker should clamp to the edge');
  assert.equal(model.enemies[1].tone, 'orange');
  assert.equal(model.pois[0].x, 0.1);
  assert.equal(model.pois[0].y, 0.75);
  assert.equal(model.extraction.x, 0.95);
  assert.equal(model.extraction.y, 0.063);
});

test('WO-21 runtime clamps movement to finite bounds and paints the minimap', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('clampLevelOneWorldPoint'), 'movement should call the Level 1 bounds clamp');
  assert.match(main, /clampLevelOneWorldPoint\(\{[^}]*padding:\s*0\.42/s, 'runtime clamp should include the player collision radius');
  assert.ok(main.includes('function drawRoguelikeMinimap('), 'runtime needs a minimap draw function');
  assert.ok(main.includes('buildLevelOneMinimapModel({'), 'minimap should be driven by the pure model');
  assert.ok(main.includes('drawRoguelikeMinimap(ctx, width, height);'), 'roguelike scene should paint minimap after gameplay');
});
