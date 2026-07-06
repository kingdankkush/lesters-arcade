import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildLevelOneExplorationFogModel,
  buildLevelOneMinimapModel,
  buildLevelOneRunWorldDimensions,
  updateLevelOneExplorationTrail,
} from '../apps/portal/src/arcade-core.mjs';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

test('WO-69 exploration fog model reveals only visited cells plus current player radius', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 64, height: 64 });
  const firstTrail = updateLevelOneExplorationTrail({ world, player: { x: 0, y: 0 }, cellSize: 8, revealRadius: 1 });
  const movedTrail = updateLevelOneExplorationTrail({ world, player: { x: 24, y: 0 }, visitedCells: firstTrail, cellSize: 8, revealRadius: 1 });
  const model = buildLevelOneExplorationFogModel({ world, player: { x: 24, y: 0 }, visitedCells: movedTrail, cellSize: 8, revealRadius: 1 });

  assert.equal(model.version, 'wo-69-level-one-exploration-v1');
  assert.equal(model.grid.columns, 8);
  assert.equal(model.grid.rows, 8);
  assert.equal(model.revealedCells.length > firstTrail.length, true, 'moving should accumulate explored cells');
  assert.equal(model.coveragePct > 0 && model.coveragePct < 1, true, `coverage should be partial, got ${model.coveragePct}`);
  assert.equal(model.revealedKeys.has(model.playerCell.key), true, 'player cell is always revealed');
  assert.equal(model.fogCells.some((cell) => cell.key === '0,0'), true, 'far unvisited cells remain fogged');
});

test('WO-69 minimap model includes fog layer and hides unrevealed enemy/POI markers', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 64, height: 64 });
  const visitedCells = updateLevelOneExplorationTrail({ world, player: { x: 0, y: 0 }, cellSize: 8, revealRadius: 1 });
  const model = buildLevelOneMinimapModel({
    world,
    player: { x: 0, y: 0 },
    enemies: [
      { id: 'near-enemy', mapX: 2, mapY: 1 },
      { id: 'far-enemy', mapX: 28, mapY: 28 },
    ],
    pois: [
      { id: 'near-poi', worldX: 1, worldY: 1, label: 'Near POI' },
      { id: 'far-poi', worldX: 30, worldY: 30, label: 'Far POI' },
    ],
    exploration: { visitedCells, cellSize: 8, revealRadius: 1 },
  });

  assert.equal(model.version, 'wo-69-exploration-minimap-v2');
  assert.ok(model.exploration.fogCells.length > 0, 'minimap should carry fog cells for drawing');
  assert.deepEqual(model.enemies.map((enemy) => enemy.id), ['near-enemy']);
  assert.deepEqual(model.pois.map((poi) => poi.id), ['near-poi']);
  assert.match(model.legend.explorationLabel, /explored/i);
});

test('WO-69 runtime wires persistent exploration state into minimap drawing', () => {
  assert.match(mainSource, /combat\.explorationVisitedCells/);
  assert.match(mainSource, /updateLevelOneExplorationTrail/);
  assert.match(mainSource, /model\.exploration\.fogCells/);
});
