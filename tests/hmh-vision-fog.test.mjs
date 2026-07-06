import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildLevelOneRunWorldDimensions,
  buildLevelOneVisionFogModel,
  levelOneVisionFogStateForPoint,
  updateLevelOneExplorationTrail,
} from '../apps/portal/src/arcade-core.mjs';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

test('WO-70 vision fog model separates visible, explored, and hidden world cells', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 64, height: 64 });
  const spawnTrail = updateLevelOneExplorationTrail({ world, player: { x: 0, y: 0 }, cellSize: 8, revealRadius: 1 });
  const model = buildLevelOneVisionFogModel({
    world,
    player: { x: 24, y: 0 },
    visitedCells: spawnTrail,
    cellSize: 8,
    visibleRadius: 1,
  });

  assert.equal(model.version, 'wo-70-level-one-vision-fog-v1');
  assert.equal(model.states.visible.length > 0, true);
  assert.equal(model.states.explored.length > 0, true, 'previously visited cells should downgrade to explored haze');
  assert.equal(model.states.hidden.length > 0, true, 'unvisited cells should remain hidden');
  assert.equal(model.playerCell.state, 'visible');
  assert.equal(model.layers.map((layer) => layer.state).join(','), 'hidden,explored');
});

test('WO-70 vision fog fairness keeps player and near threats visible while far threats stay hidden', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 64, height: 64 });
  const visitedCells = updateLevelOneExplorationTrail({ world, player: { x: 0, y: 0 }, cellSize: 8, revealRadius: 1 });
  const model = buildLevelOneVisionFogModel({ world, player: { x: 0, y: 0 }, visitedCells, cellSize: 8, visibleRadius: 1 });

  assert.equal(levelOneVisionFogStateForPoint(model, { x: 0, y: 0 }), 'visible');
  assert.equal(levelOneVisionFogStateForPoint(model, { x: 5, y: 5 }), 'visible', 'close melee threats should not be obscured');
  assert.equal(levelOneVisionFogStateForPoint(model, { x: 30, y: 30 }), 'hidden');
  assert.equal(model.fairness.playerSafeRadiusCells >= 1, true);
});

test('WO-70 runtime draws the vision fog pass after world sprites and before HUD', () => {
  assert.match(mainSource, /buildLevelOneVisionFogModel/);
  assert.match(mainSource, /function drawLevelOneVisionFog/);
  assert.match(mainSource, /visionFogModel\.layers/);
  assert.match(mainSource, /drawLevelOneVisionFog\(ctx, width, height\);\r?\n\s*drawBullets\(ctx\);/);
});
