import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';
import {
  buildLevelOneRoadTileIndex,
  classifyLevelOneTraversal,
  levelOneRoadTileKey,
} from '../apps/portal/src/hmh-level-one-traversal.mjs';

const seed = 1337;
const plan = buildGroundPlan({ levelId: 'level-1-crypto-wasteland', seed });

function path(...points) {
  return [{ path: points.map(([x, y]) => ({ x, y })) }];
}

test('Level 1 terrain traversal follows the rendered ground plan instead of unrelated procedural biomes', () => {
  const roads = buildLevelOneRoadTileIndex({ roadNetwork: [], groundPlan: plan });
  const river = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: 29, worldY: 20 });
  const shore = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: 24, worldY: 0 });
  const townRoad = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: 0, worldY: 5 });

  assert.equal(river.role, 'water');
  assert.equal(river.blocked, true, 'visible deep water must be impassable');
  assert.equal(shore.blocked, false, 'beaches and shore tiles remain walkable');
  assert.equal(townRoad.blocked, false, 'authored roads remain walkable');
});

test('bridges and authored roads cross otherwise impassable water', () => {
  const roadNetwork = path([29, 20], [0, 5]);
  const roads = buildLevelOneRoadTileIndex({ roadNetwork, groundPlan: plan });
  const bridge = roads.get(levelOneRoadTileKey(29, 20));
  const crossing = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: 29, worldY: 20 });

  assert.equal(bridge.type, 'bridge');
  assert.equal(crossing.crossing, 'bridge');
  assert.equal(crossing.blocked, false);
});

test('named fords and shallow creek tiles are crossable without making deep water walkable', () => {
  const roads = buildLevelOneRoadTileIndex({ roadNetwork: [], groundPlan: plan });
  const ford = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: 62, worldY: 8 });
  const deep = classifyLevelOneTraversal({ groundPlan: plan, roadTileIndex: roads, worldX: 29, worldY: 20 });

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
  assert.match(source, /resolveWaterCollision\([^;]+currentTerrainBiomeAt\)/s);
  assert.ok((source.match(/biomeAt: currentTerrainBiomeAt/g) ?? []).length >= 3, 'spawn and both AI move branches should use rendered-terrain collision');
  assert.ok((source.match(/obstacleHitAlongSegment\(/g) ?? []).length >= 2, 'player and enemy shots should use swept prop collision');
});

test('seed 1337 traversal playtest reaches every remote authored POI without walking through deep water', () => {
  const roads = buildLevelOneRoadTileIndex({ roadNetwork: [], groundPlan: plan });
  const minX = -131;
  const maxX = 131;
  const minY = -112;
  const maxY = 112;
  const key = (x, y) => `${x}|${y}`;
  const queue = [[0, 5]];
  const visited = new Set([key(0, 5)]);
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

  for (const [name, x, y] of [
    ['northwest desert outcrop', -108, -78],
    ['north forest', -36, -82],
    ['north riverfront', 42, -78],
    ['northeast neighborhood', 104, -66],
    ['west town', -106, 2],
    ['east extraction', 104, 4],
    ['southwest rock camp', -96, 78],
    ['south waterfront', -20, 82],
    ['southeast glow bank', 96, 78],
  ]) {
    assert.ok(visited.has(key(x, y)), `${name} should be reachable from spawn`);
  }
  assert.equal(visited.has(key(29, 20)), false, 'deep rapid water must not be traversed during the reachability playtest');
  assert.ok(visited.has(key(29, 4)), 'central bridge deck should connect both banks');
  assert.ok(visited.has(key(29, -71)), 'north bridge deck should connect both banks');
  assert.ok(visited.has(key(29, 79)), 'south bridge deck should connect both banks');
});
