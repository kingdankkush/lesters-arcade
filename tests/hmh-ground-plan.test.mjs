import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HMH_LEVEL_ONE_ID } from '../apps/portal/src/hmh-level-one-ground.mjs';
import { buildGroundPlan } from '../apps/portal/src/hmh-ground-plan.mjs';
import { authoredCellToWorld, HMH_LEVEL_ONE_WORLD_V3 } from '../apps/portal/src/hmh-level-one-world-v3-runtime.mjs';

function sampleTiles(width = 200, height = 200) {
  const tiles = [];
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) tiles.push([x, y]);
  }
  return tiles;
}

const migrateDesignCoordinate = (value) => Math.round(value * 149 / 99);
const migratedAuthoredCellToWorld = (x, y) => authoredCellToWorld(
  migrateDesignCoordinate(x),
  migrateDesignCoordinate(y),
);

test('live Level 1 ground plan is backed by the approved Blueprint v3 cell contract', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  assert.equal(plan.worldContractId, HMH_LEVEL_ONE_WORLD_V3.id);
  assert.equal(plan.width, 150);
  assert.equal(plan.height, 150);
  assert.deepEqual(plan.worldBounds, { minX: -12, maxX: 137, minY: -117, maxY: 32, width: 150, height: 150 });
  assert.deepEqual(plan.spawnWorld, { x: 0, y: 0 });

  const spawn = plan.zoneAt(0, 0);
  assert.equal(spawn.source, 'hmh-level-one-world-v3');
  assert.equal(spawn.groundNav, '.');
  assert.equal(spawn.authoredX, HMH_LEVEL_ONE_WORLD_V3.anchors.spawn.x);
  assert.equal(spawn.authoredY, HMH_LEVEL_ONE_WORLD_V3.anchors.spawn.y);

  const waterWorld = migratedAuthoredCellToWorld(49, 64);
  const water = plan.zoneAt(waterWorld.x, waterWorld.y);
  assert.equal(water.role, 'water');
  assert.equal(water.groundNav, '#');
  assert.equal(plan.traversalAt(waterWorld.x, waterWorld.y).blocked, true);

  const bridgeWorld = migratedAuthoredCellToWorld(35, 39);
  const bridge = plan.zoneAt(bridgeWorld.x, bridgeWorld.y);
  assert.equal(bridge.role, 'bridge');
  assert.equal(bridge.groundNav, '.');
  assert.equal(plan.traversalAt(bridgeWorld.x, bridgeWorld.y).isBridge, true);

  assert.equal(plan.zoneAt(999, 999).groundNav, '#');
  assert.equal(plan.textureKeys().length, 17);
  assert.equal(plan.textureKeys().every((key) => plan.textureForKey(key)?.src), true);
});

test('ground plan assigns every sampled tile to exactly one zone with one texture', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  for (const [x, y] of sampleTiles()) {
    const zone = plan.zoneAt(x, y);
    assert.equal(typeof zone.zoneId, 'string', `missing zone id at ${x},${y}`);
    assert.equal(typeof zone.role, 'string', `missing role at ${x},${y}`);
    assert.equal(typeof zone.textureKey, 'string', `missing texture at ${x},${y}`);
    assert.ok(zone.textureKey.length > 0, `blank texture at ${x},${y}`);
    assert.ok(Array.isArray(zone.borderInfo), `borderInfo must be an array at ${x},${y}`);
  }
});

test('authored terrain families keep one cohesive material across all 22,500 cells', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  const materialByTerrain = new Map();
  for (let authoredY = 0; authoredY < plan.height; authoredY += 1) {
    for (let authoredX = 0; authoredX < plan.width; authoredX += 1) {
      const world = authoredCellToWorld(authoredX, authoredY);
      const here = plan.zoneAt(world.x, world.y);
      if (!materialByTerrain.has(here.terrain)) materialByTerrain.set(here.terrain, new Set());
      materialByTerrain.get(here.terrain).add(here.textureKey);
    }
  }
  assert.equal(materialByTerrain.size, 17);
  assert.equal([...materialByTerrain.values()].every((keys) => keys.size === 1), true);
  const spawnTexture = plan.zoneAt(0, 0).textureKey;
  assert.ok(
    Array.from({ length: 21 }, (_, index) => plan.zoneAt(index - 10, 0))
      .some((cell) => cell.groundNav === '.' && cell.textureKey !== spawnTexture),
    'authored asphalt and shoulder materials stay distinct',
  );
});

test('borderInfo is present exactly on cardinal zone boundaries', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  let boundaryTiles = 0;
  let interiorTiles = 0;
  for (const [x, y] of sampleTiles(120, 120)) {
    const here = plan.zoneAt(x, y);
    const neighbors = [
      plan.zoneAt(x + 1, y),
      plan.zoneAt(x - 1, y),
      plan.zoneAt(x, y + 1),
      plan.zoneAt(x, y - 1),
    ];
    const expectedBoundaryCount = neighbors.filter((neighbor) => neighbor.zoneId !== here.zoneId).length;
    assert.equal(here.borderInfo.length, expectedBoundaryCount, `border mismatch at ${x},${y}`);
    if (expectedBoundaryCount > 0) {
      boundaryTiles += 1;
      for (const border of here.borderInfo) {
        assert.match(border.direction, /^(north|south|east|west)$/);
        assert.equal(typeof border.neighborZoneId, 'string');
        assert.equal(typeof border.neighborRole, 'string');
      }
    } else {
      interiorTiles += 1;
    }
  }
  assert.ok(boundaryTiles > 0, 'expected at least one zone boundary in the sample');
  assert.ok(interiorTiles > boundaryTiles, 'the plan should still have broad zone interiors');
});

test('ground plan references only certified World v3 terrain materials', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  const textureKeys = new Set(plan.zones.map((zone) => zone.textureKey));
  assert.equal(textureKeys.size, 17);
  for (const textureKey of textureKeys) {
    assert.match(textureKey, /^world-v3-material\//);
    const asset = plan.textureForKey(textureKey);
    assert.ok(asset, `${textureKey} should resolve through the plan texture lookup`);
    assert.match(asset.src, /^\.\/assets\/generated\/hmh-level-one-world-v3\/materials\//);
    assert.equal(asset.width, textureKey.endsWith('/forest-floor') ? 128 : 160);
    assert.equal(asset.height, textureKey.endsWith('/forest-floor') ? 64 : 160);
    assert.equal(asset.seamMismatchPixels, 0);
  }
});

test('compact full-map plan exposes all 17 materials while prewarming only the nearby subset', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  const keys = plan.textureKeys();
  assert.equal(keys.length, 17);
  assert.equal(new Set(keys).size, 17);
  const nearby = plan.textureKeysNear(0, 0, 12);
  assert.ok(nearby.length > 0);
  assert.ok(nearby.length <= 12, `opening prewarm should need at most 12 materials, got ${nearby.length}`);
  assert.ok(nearby.length < keys.length, 'startup prewarm should decode nearby terrain instead of every full-map texture');
  assert.ok(nearby.every((key) => plan.textureForKey(key)), 'every nearby texture key should resolve');
});

test('spawn road is authored asphalt with passable shoulders and a clear player start', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  for (const [x, y] of [[0, 0], [0, -2], [0, 2]]) {
    const cell = plan.zoneAt(x, y);
    assert.equal(cell.role, 'road');
    assert.equal(cell.groundNav, '.');
    assert.equal(cell.terrain, 'A');
  }
  const shoulder = Array.from({ length: 21 }, (_, index) => plan.zoneAt(index - 10, 0))
    .find((cell) => cell.groundNav === '.' && cell.textureKey !== plan.zoneAt(0, 0).textureKey);
  assert.ok(shoulder, 'expanded spawn road keeps a passable non-asphalt shoulder');
});

test('critical path, POIs, and bridge crossings resolve through authored passable ground', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  for (const anchor of [...HMH_LEVEL_ONE_WORLD_V3.criticalPath, ...HMH_LEVEL_ONE_WORLD_V3.pointsOfInterest]) {
    const world = authoredCellToWorld(anchor.x, anchor.y);
    assert.notEqual(plan.zoneAt(world.x, world.y).groundNav, '#', `${anchor.id} must be ground reachable`);
  }
  for (const bridge of HMH_LEVEL_ONE_WORLD_V3.bridges) {
    const world = authoredCellToWorld(bridge.x, bridge.y);
    assert.equal(plan.zoneAt(world.x, world.y).role, 'bridge');
    assert.equal(plan.zoneAt(world.x, world.y).route, 'B');
    assert.equal(plan.zoneAt(world.x, world.y).groundNav, '.');
  }
});

test('authored lakes, rapids, and fords are ground-plan water instead of walkable prop cards', () => {
  const plan = buildGroundPlan({ levelId: HMH_LEVEL_ONE_ID, seed: 1337 });
  for (const [authoredX, authoredY, nav, label] of [
    [49, 64, '#', 'Silver Wallet Lake deep water'],
    [88, 92, '#', 'southern sea outlet'],
    [56, 59, '~', 'optional shallow ford'],
  ]) {
    const world = migratedAuthoredCellToWorld(authoredX, authoredY);
    assert.equal(plan.zoneAt(world.x, world.y).role, 'water', `${label} should be collision-backed water terrain`);
    assert.equal(plan.zoneAt(world.x, world.y).groundNav, nav);
  }
});

test('ground plan source and tests are covered by the explicit syntax gate', () => {
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /apps\/portal\/src\/hmh-ground-plan\.mjs/);
  assert.match(syntax, /tests\/hmh-ground-plan\.test\.mjs/);
});
