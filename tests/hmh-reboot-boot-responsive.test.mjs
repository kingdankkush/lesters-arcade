import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createEnemyNavGrid, createEnemyNavGridChunked } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { createLevelOneGroundQuery, LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

test('M2 renders one interactive frame before building the full deterministic navgrid', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /let ENEMY_NAV_GRID = null/);
  const appInit = source.indexOf('await app.init');
  const frameAwait = source.indexOf('await firstInteractiveFrame()');
  const navBuild = source.indexOf('ENEMY_NAV_GRID = await createEnemyNavGridChunked');
  const bridgeStart = source.indexOf('bridge.start()');
  const bridgeActivate = source.indexOf('bridge.activate()', navBuild);
  assert.ok(bridgeStart > 0 && bridgeStart < appInit, 'the child must capture the parent handshake before its first asynchronous boot yield');
  assert.ok(frameAwait > appInit && navBuild > frameAwait, 'first frame must precede full navgrid construction');
  assert.ok(bridgeActivate > navBuild, 'the child must not advertise readiness before gameplay navigation is authoritative');
  assert.match(source, /dataset\.bootFirstFrame = 'true'/);
  assert.match(source, /dataset\.navGridReady = 'true'/);
});

test('early bridge protocol errors do not access runtime services before initialization', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const fallback = source.indexOf('let handleBridgeProtocolError =');
  const bridgeStart = source.indexOf('bridge.start()');
  const audioReady = source.indexOf('const combatAudio = createCombatAudio');
  const upgraded = source.indexOf('handleBridgeProtocolError = (error)', audioReady);
  assert.ok(fallback > 0 && fallback < bridgeStart);
  assert.match(source, /onProtocolError: \(error\) => handleBridgeProtocolError\(error\)/);
  assert.ok(upgraded > audioReady);
});

test('M6 idle-sliced navgrid is byte-identical to synchronous authority and yields repeatedly', async () => {
  const world = LEVEL_ONE_WORLD;
  const queryGround = createLevelOneGroundQuery();
  const expected = createEnemyNavGrid({ world, queryGround });
  let yields = 0;
  const actual = await createEnemyNavGridChunked({
    world,
    queryGround,
    cellsPerSlice: 127,
    scheduleYield: async () => { yields += 1; },
  });
  assert.ok(yields > 2, `expected repeated idle yields, received ${yields}`);
  assert.deepEqual(actual.walkable, expected.walkable);
  assert.deepEqual(actual.edges, expected.edges);
  assert.equal(actual.columns, expected.columns);
  assert.equal(actual.rows, expected.rows);
});

test('M2 full Level 1 navgrid remains bounded under the 1.5 second local target', () => {
  const started = performance.now();
  const grid = createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround: createLevelOneGroundQuery() });
  const elapsedMs = performance.now() - started;
  assert.equal(grid.walkable.length, grid.columns * grid.rows);
  assert.equal(grid.edges.length, grid.walkable.length);
  assert.ok(elapsedMs <= 1500, `navgrid build ${elapsedMs.toFixed(1)}ms exceeded 1500ms`);
});
