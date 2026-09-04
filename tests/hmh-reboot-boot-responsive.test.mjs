import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { computeEnemyFlowField, createEnemyNavGrid, createEnemyNavGridChunked, createNavGridAuthority } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
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

test('K-7 navgrid authority refuses to serve a grid while the idle-sliced build is in flight, then serves the byte-identical grid', async () => {
  const world = LEVEL_ONE_WORLD;
  const queryGround = createLevelOneGroundQuery();
  const authority = createNavGridAuthority();
  assert.equal(authority.ready, false);
  assert.equal(authority.grid, null);
  assert.throws(() => authority.require(), /navgrid not ready/);

  let release;
  const parked = new Promise((resolve) => { release = resolve; });
  let yields = 0;
  const building = authority.build({
    world,
    queryGround,
    cellsPerSlice: 512,
    scheduleYield: () => { yields += 1; return parked; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  // The build is parked on its first idle yield with a partially filled grid:
  // no consumer may observe it, and the flow field cannot be computed.
  assert.equal(yields, 1, 'the build must be parked on its first idle yield');
  assert.equal(authority.ready, false);
  assert.equal(authority.grid, null);
  assert.throws(() => authority.require(), /navgrid not ready/);
  assert.throws(() => computeEnemyFlowField({ grid: authority.grid, targetX: 0, targetY: 0 }), /grid is required/);

  release();
  const grid = await building;
  assert.equal(authority.ready, true);
  assert.equal(authority.require(), grid);
  assert.equal(authority.grid, grid);
  assert.ok(Object.isFrozen(grid));
  const expected = createEnemyNavGrid({ world, queryGround });
  assert.deepEqual(grid.walkable, expected.walkable);
  assert.deepEqual(grid.edges, expected.edges);
  assert.equal(grid.columns, expected.columns);
  assert.equal(grid.rows, expected.rows);
  // Adopting a partial object is refused: only a complete frozen grid counts.
  assert.throws(() => createNavGridAuthority().adopt({ columns: 1 }), /complete navgrid/);
});

test('K-7 time-budgeted slices end within sliceBudgetMs plus one cell under a fake clock and stay byte-identical', async () => {
  const world = LEVEL_ONE_WORLD;
  const baseQuery = createLevelOneGroundQuery();
  // The clock advances one unit per ground query, so slice cost is exact and
  // independent of the host's wall clock.
  let clock = 0;
  const queryGround = (x, y) => { clock += 1; return baseQuery(x, y); };
  const now = () => clock;

  // Per-cell cost: one cell per slice. The last cell of pass one merges with the
  // first cell of pass two (no yield between passes), so the maximum measured
  // here is conservative by at most one cell.
  let sliceStartedAt = 0;
  const cellCosts = [];
  const perCell = await createEnemyNavGridChunked({
    world, queryGround, cellsPerSlice: 1, sliceBudgetMs: Infinity, now,
    scheduleYield: async () => { cellCosts.push(clock - sliceStartedAt); sliceStartedAt = clock; },
  });
  const maxCellCost = Math.max(...cellCosts);
  assert.ok(maxCellCost >= 1, 'every cell costs at least one ground query');

  const sliceBudgetMs = 4;
  clock = 0;
  sliceStartedAt = 0;
  const sliceCosts = [];
  const budgeted = await createEnemyNavGridChunked({
    world, queryGround, cellsPerSlice: 512, sliceBudgetMs, now,
    scheduleYield: async () => { sliceCosts.push(clock - sliceStartedAt); sliceStartedAt = clock; },
  });
  assert.ok(sliceCosts.length > 62, `the budget must cut slices shorter than 512 cells (${sliceCosts.length} yields)`);
  for (const cost of sliceCosts) {
    assert.ok(cost <= sliceBudgetMs + maxCellCost, `slice cost ${cost} exceeded budget ${sliceBudgetMs} + one cell (${maxCellCost})`);
  }
  assert.ok(sliceCosts.some((cost) => cost >= sliceBudgetMs), 'the budget must actually bound the slice, not the cell count');

  const expected = createEnemyNavGrid({ world, queryGround: baseQuery });
  for (const grid of [perCell, budgeted]) {
    assert.deepEqual(grid.walkable, expected.walkable);
    assert.deepEqual(grid.edges, expected.edges);
    assert.equal(grid.columns, expected.columns);
    assert.equal(grid.rows, expected.rows);
  }
  await assert.rejects(createEnemyNavGridChunked({ world, queryGround, sliceBudgetMs: 0 }), /sliceBudgetMs/);
  await assert.rejects(createEnemyNavGridChunked({ world, queryGround, now: 5 }), /now must be a function/);
});

test('K-7 initializeSession requires navigation authority before it creates a simulation, and the flow field reads the required grid', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /const navGridAuthority = createNavGridAuthority\(\);/);
  const init = source.indexOf('const initializeSession = (payload) => {');
  const required = source.indexOf('const navGrid = navGridAuthority.require();', init);
  const stop = source.indexOf('stopCurrentSession();', init);
  const simulationCreated = source.indexOf('simulation = new DeterministicSimulation', init);
  assert.ok(init > 0, 'initializeSession not found');
  assert.ok(required > init && required < stop, 'the authority must be required as the first statement of initializeSession');
  assert.ok(stop < simulationCreated, 'no simulation may be created before the authority has served a grid');
  assert.match(source, /computeEnemyFlowField\(\{ grid: navGrid, targetX: actor\.x, targetY: actor\.y \}\)/);
  // The pinned build line stays literal; the authority adopts its result before
  // the child advertises readiness.
  const navBuild = source.indexOf('ENEMY_NAV_GRID = await createEnemyNavGridChunked');
  const adopt = source.indexOf('navGridAuthority.adopt(ENEMY_NAV_GRID);');
  const bridgeActivate = source.indexOf('bridge.activate()', navBuild);
  assert.ok(navBuild > 0 && adopt > navBuild && adopt < bridgeActivate, 'the authority must adopt the completed grid before bridge.activate()');
  const navGridReady = source.indexOf("dataset.navGridReady = 'true'");
  assert.ok(adopt < navGridReady, 'navGridReady must not be advertised before the authority holds the grid');
});
