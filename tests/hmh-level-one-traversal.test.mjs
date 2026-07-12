import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';
import {
  buildLevelOneRoadTileIndex,
  classifyLevelOneTraversal,
  levelOneRoadTileKey,
} from '../apps/portal/src/hmh-level-one-traversal.mjs';
import {
  authoredCellToWorld,
  HMH_LEVEL_ONE_WORLD_V3,
  levelOneWorldV3WorldBounds,
} from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';

const seed = 1337;
const plan = buildGroundPlan({ levelId: 'level-1-crypto-wasteland', seed });

function path(...points) {
  return [{ path: points.map(([x, y]) => ({ x, y })) }];
}

test('Level 1 terrain traversal follows the rendered ground plan instead of unrelated procedural biomes', () => {
  const roads = buildLevelOneRoadTileIndex({ roadNetwork: [], groundPlan: plan });
  const riverPoint = authoredCellToWorld(49, 64);
  const shorePoint = authoredCellToWorld(50, 76);
  const river = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: riverPoint.x, worldY: riverPoint.y });
  const shore = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: shorePoint.x, worldY: shorePoint.y });
  const townRoad = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: 0, worldY: 0 });

  assert.equal(river.role, 'water');
  assert.equal(river.blocked, true, 'visible deep water must be impassable');
  assert.equal(shore.blocked, false, 'beaches and shore tiles remain walkable');
  assert.equal(townRoad.blocked, false, 'authored roads remain walkable');
});

test('bridges and authored roads cross otherwise impassable water', () => {
  const point = authoredCellToWorld(35, 39);
  const roads = buildLevelOneRoadTileIndex({ roadNetwork: [], groundPlan: plan });
  const crossing = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: point.x, worldY: point.y });

  assert.equal(crossing.crossing, 'bridge');
  assert.equal(crossing.blocked, false);
  assert.equal(crossing.groundNav, '.');
});

test('named fords and shallow creek tiles are crossable without making deep water walkable', () => {
  const roads = buildLevelOneRoadTileIndex({ roadNetwork: [], groundPlan: plan });
  const fordPoint = authoredCellToWorld(56, 59);
  const deepPoint = authoredCellToWorld(49, 64);
  const ford = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: fordPoint.x, worldY: fordPoint.y });
  const deep = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: deepPoint.x, worldY: deepPoint.y });

  assert.equal(ford.role, 'water');
  assert.equal(ford.crossing, 'shallow');
  assert.equal(ford.blocked, false);
  assert.equal(deep.blocked, true);
});

test('road index classifies crossings from rendered terrain roles, not biome noise', () => {
  const fakePlan = {
    zoneAt(x) {
      return { zoneId: x === 2 ? 'rendered-river' : 'rendered-grass', role: x === 2 ? 'water' : 'grass' };
    },
  };
  const roads = buildLevelOneRoadTileIndex({
    roadNetwork: path([1, 0], [2, 0], [3, 0]),
    groundPlan: fakePlan,
  });

  assert.equal(roads.get(levelOneRoadTileKey(1, 0)).type, 'road');
  assert.equal(roads.get(levelOneRoadTileKey(2, 0)).type, 'bridge');
  assert.equal(roads.get(levelOneRoadTileKey(3, 0)).type, 'road');
});

test('live player, enemy, spawn, road, and projectile paths consume traversal and swept-collision helpers', () => {
  const source = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(source, /buildLevelOneRoadTileIndex\(\{/);
  assert.match(source, /function currentTerrainBiomeAt\(/);
  assert.match(source, /resolveWaterCollision\([^;]+currentTerrainBiomeAt[^;]+radius:\s*0\.42/s);
  assert.ok((source.match(/biomeAt: currentTerrainBiomeAt/g) ?? []).length >= 3, 'spawn and both AI move branches should use rendered-terrain collision');
  assert.ok((source.match(/obstacleHitAlongSegment\(/g) ?? []).length >= 2, 'player and enemy shots should use swept prop collision');
});

test('seed 1337 traversal playtest reaches every Blueprint v3 POI without walking through blocked terrain', () => {
  const roads = buildLevelOneRoadTileIndex({ roadNetwork: [], groundPlan: plan });
  const { minX, maxX, minY, maxY } = levelOneWorldV3WorldBounds();
  const key = (x, y) => `${x}|${y}`;
  const queue = [[0, 0]];
  const visited = new Set([key(0, 0)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, y] = queue[cursor];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < minX || nx > maxX || ny < minY || ny > maxY || visited.has(key(nx, ny))) continue;
      const traversal = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: nx, worldY: ny });
      if (traversal.blocked) continue;
      visited.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }

  for (const anchor of [...HMH_LEVEL_ONE_WORLD_V3.criticalPath, ...HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest]) {
    const world = authoredCellToWorld(anchor.x, anchor.y);
    assert.ok(visited.has(key(world.x, world.y)), `${anchor.id} should be reachable from spawn`);
  }
  const deep = authoredCellToWorld(49, 64);
  assert.equal(visited.has(key(deep.x, deep.y)), false, 'deep water must not be traversed during the reachability playtest');
  for (const bridge of HMH_LEVEL_ONE_WORLD_V3.bridges) {
    const world = authoredCellToWorld(bridge.x, bridge.y);
    assert.ok(visited.has(key(world.x, world.y)), `${bridge.id} should connect its authored crossing`);
  }
});
