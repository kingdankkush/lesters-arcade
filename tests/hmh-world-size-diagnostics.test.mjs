import assert from 'node:assert/strict';
import test from 'node:test';
import { createEnemyNavGrid, createEnemyNavGridChunked, createNavGridAuthority, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createSizingScenarios, createSyntheticSizingWorld, TARGET_WORLD_BOUNDS } from '../scripts/lib/hmh-world-size-fixtures.mjs';
import { inspectGridBoundary, inspectNavigationMemory, compareGatePatch, buildInstrumentedGrid } from '../scripts/lib/hmh-world-size-diagnostics.mjs';

function flatWorld(bounds, blockers = []) {
  const baseSurface = createElevationSurface({ id: 'test-ground', area: { type: 'rect', ...bounds }, visibleTerrainId: 'test-ground' });
  const world = Object.freeze({ bounds: Object.freeze(bounds), baseSurface, surfaces: Object.freeze([]), collisionBlockers: Object.freeze(blockers) });
  return { world, queryGround: createAuthoredGroundQuery(world) };
}
const bytes = grid => [grid.walkable, grid.edges];

test('W0 scenarios identify actual topology, the bounds-only control and representative synthetic topology without changing the active world', () => {
  const before = JSON.stringify(LEVEL_ONE_WORLD);
  const scenarios = createSizingScenarios();
  assert.equal(scenarios.length, 4);
  assert.equal(scenarios[0].world, LEVEL_ONE_WORLD);
  assert.equal(scenarios[0].topologyKind, 'actual-current-map');
  assert.equal(scenarios[1].topologyKind, 'bounds-only-control');
  assert.equal(scenarios[1].world.collisionBlockers, LEVEL_ONE_WORLD.collisionBlockers);
  assert.equal(scenarios[1].world.surfaces, LEVEL_ONE_WORLD.surfaces);
  assert.deepEqual(scenarios.slice(2).map(row => row.topologyKind), ['representative-synthetic', 'representative-synthetic']);
  assert.deepEqual(scenarios[3].world.bounds, TARGET_WORLD_BOUNDS);
  assert.deepEqual(createSyntheticSizingWorld(TARGET_WORLD_BOUNDS), scenarios[3].world);
  assert.equal(JSON.stringify(LEVEL_ONE_WORLD), before);
  assert.ok(Object.isFrozen(scenarios[3].world.collisionBlockers));
  assert.ok(scenarios[3].world.surfaces.some(surface => surface.kind === 'water'));
  assert.ok(scenarios[3].world.surfaces.some(surface => surface.kind === 'ramp'));
  assert.ok(scenarios[3].world.surfaces.some(surface => surface.oneWayDrop));
});

test('boundary diagnostic exposes rounded-cell ground fallback while reporting actual allocated buffers', () => {
  const subject = flatWorld({ minX: 0, minY: 0, maxX: 200, maxY: 140 });
  const grid = createEnemyNavGrid(subject);
  assert.equal(subject.queryGround(210, 150).surfaceId, 'test-ground');
  const boundary = inspectGridBoundary(grid, subject.world.bounds, subject.queryGround);
  assert.deepEqual(boundary.roundedExtent, { maxX: 240, maxY: 180 });
  assert.equal(boundary.centresOutsideExactBounds, 6);
  assert.equal(boundary.walkableCentresOutsideExactBounds, 6);
  assert.equal(boundary.probes.find(row => row.id === 'past-max-corner').exactBoundsContains, false);
  assert.equal(boundary.probes.find(row => row.id === 'past-max-corner').navWalkable, true);
  const field = computeEnemyFlowField({ grid, targetX: 30, targetY: 30 });
  const memory = inspectNavigationMemory(grid, field);
  assert.equal(memory.navArraysBytes, bytes(grid).reduce((sum, array) => sum + array.byteLength, 0));
  assert.equal(memory.flowArraysBytes, field.distance.byteLength + field.directions.byteLength);
  assert.equal(memory.measuredArraysBytes, 84);
  assert.equal(memory.excludes.includes('temporary BFS queue'), true);
});

test('synthetic target perimeter blocks rounded outside centres, while dimensions-only control exposes the inherited perimeter gap', () => {
  const scenarios = createSizingScenarios();
  const control = scenarios[1], synthetic = scenarios[3];
  for (const subject of [control, synthetic]) {
    const grid = createEnemyNavGrid(subject);
    assert.equal(grid.columns, 334);
    assert.equal(grid.rows, 234);
    assert.equal(grid.walkable.byteLength + grid.edges.byteLength, 156312);
    const boundary = inspectGridBoundary(grid, subject.world.bounds, subject.queryGround);
    assert.equal(boundary.centresOutsideExactBounds, 567);
    assert.equal(boundary.walkableCentresOutsideExactBounds, subject === control ? 567 : 0);
  }
});

test('instrumented chunked build retains byte-identical authority and reports both build passes and all processed cells', async () => {
  const subject = flatWorld({ minX: 0, minY: 0, maxX: 180, maxY: 120 });
  const expected = createEnemyNavGrid(subject);
  const result = await buildInstrumentedGrid(subject, { cellsPerSlice: 2, sliceBudgetMs: 4 });
  assert.deepEqual(bytes(result.grid), bytes(expected));
  assert.deepEqual([...new Set(result.slices.map(slice => slice.pass))], ['walkability', 'directed-edges']);
  assert.equal(result.slices.reduce((sum, slice) => sum + slice.cells, 0), 12);
  assert.ok(result.yields > 0);
  assert.ok(result.slices.every(slice => slice.cells <= 2));
  assert.ok(result.groundQueries > 12);
});

test('a rounded-boundary build remains inaccessible until the complete grid is adopted', async () => {
  const subject = flatWorld({ minX: 0, minY: 0, maxX: 200, maxY: 140 });
  const authority = createNavGridAuthority();
  let release;
  const parked = new Promise(resolve => { release = resolve; });
  const pending = authority.build({ ...subject, cellsPerSlice: 2, scheduleYield: () => parked });
  assert.equal(authority.ready, false);
  assert.throws(() => authority.require(), /navgrid not ready/);
  assert.throws(() => computeEnemyFlowField({ grid: authority.grid, targetX: 30, targetY: 30 }), /grid is required/);
  release();
  const grid = await pending;
  assert.equal(authority.require(), grid);
  assert.deepEqual(bytes(grid), bytes(createEnemyNavGrid(subject)));
});

test('an authored one-way ledge retains directed traversal and reverse-flow reachability through chunking', async () => {
  const subject = flatWorld({ minX: 0, minY: 0, maxX: 180, maxY: 180 });
  const ledge = createElevationSurface({ id: 'one-way', kind: 'ledge', area: { type: 'rect', minX: 60, minY: 0, maxX: 120, maxY: 180 }, groundZ: 48, oneWayDrop: { x: 1, y: 0 }, visibleTerrainId: 'one-way' });
  subject.world = Object.freeze({ ...subject.world, surfaces: Object.freeze([ledge]) });
  subject.queryGround = createAuthoredGroundQuery(subject.world);
  const expected = createEnemyNavGrid(subject);
  const grid = await createEnemyNavGridChunked({ ...subject, cellsPerSlice: 2, scheduleYield: async () => {} });
  assert.deepEqual(bytes(grid), bytes(expected));
  const ledgeCell = grid.cellAt(90, 90), eastCell = grid.cellAt(150, 90);
  assert.equal(grid.edges[ledgeCell] & 1, 1, 'rightward drop is legal');
  assert.equal(grid.edges[ledgeCell] & 2, 0, 'leftward drop is illegal');
  assert.equal(grid.edges[eastCell] & 2, 0, 'reverse climb is illegal');
  const toEast = computeEnemyFlowField({ grid, targetX: 150, targetY: 90 });
  assert.equal(toEast.distance[ledgeCell], 1);
  assert.equal(toEast.directions[ledgeCell], 0);
  const toLedge = computeEnemyFlowField({ grid, targetX: 90, targetY: 90 });
  assert.equal(toLedge.distance[eastCell], -1);
});

test('interior capsule gate patch matches a full rebuild including halo edges and closes again', () => {
  const gate = createStaticBlocker({ id: 'interior-gate', shape: { type: 'capsule', a: { x: 270, y: 300 }, b: { x: 690, y: 300 }, radius: 18 }, visibleAssetId: 'gate' });
  const subject = flatWorld({ minX: 0, minY: 0, maxX: 960, maxY: 720 }, [gate]);
  const comparison = compareGatePatch(subject, gate.id);
  assert.equal(comparison.open.diffCells, 0);
  assert.equal(comparison.reclosed.diffCells, 0);
  assert.ok(comparison.changedByOpening > 0);
  assert.ok(comparison.patchedCells > 0);
});

test('sizing fixtures reject invalid dimensions and keep their metadata deterministic', () => {
  for (const bounds of [null, { minX: 0, minY: 0, maxX: Infinity, maxY: 14000 }, { minX: 0, minY: 0, maxX: 0, maxY: 1 }]) {
    assert.throws(() => createSyntheticSizingWorld(bounds), /ordered finite/);
  }
  const first = createSyntheticSizingWorld({ minX: -2000, minY: -2000, maxX: 0, maxY: 0 });
  assert.equal(new Set(first.surfaces.map(row => row.id)).size, first.surfaces.length);
  assert.equal(new Set(first.collisionBlockers.map(row => row.id)).size, first.collisionBlockers.length);
  assert.deepEqual(createSyntheticSizingWorld(first.bounds), first);
});

test('benchmark arguments are bounded and reject ambiguous work without starting a benchmark', async () => {
  const { parseSizingArgs } = await import('../scripts/hmh-world-size-bench.mjs');
  assert.deepEqual(parseSizingArgs([]), { repetitions: 3, warmups: 1, flowRepetitions: 12, output: null });
  assert.deepEqual(parseSizingArgs(['--repetitions=1', '--warmups=0', '--flow-repetitions=2']), { repetitions: 1, warmups: 0, flowRepetitions: 2, output: null });
  for (const arg of ['--repetitions=0', '--repetitions=21', '--warmups=-1', '--flow-repetitions=101', '--unknown=1', '--output=', '--repetitions']) {
    assert.throws(() => parseSizingArgs([arg]), TypeError);
  }
});

test('differential probe exposes the current patch halo omission at global border cells without accepting it as a layout', async () => {
  const { createGatePatchProbes } = await import('../scripts/lib/hmh-world-size-fixtures.mjs');
  const probes = createGatePatchProbes();
  for (const subject of probes) {
    const result = compareGatePatch(subject, subject.gateId);
    assert.equal(result.reclosed.diffCells, 0, `${subject.id}: closed geometry remains reproducible`);
    if (subject.id === 'interior') assert.equal(result.open.diffCells, 0);
    else {
      assert.ok(result.open.diffCells > 0, `${subject.id}: diagnostic must expose the unresolved opening mismatch`);
      assert.ok(result.open.walkableDiffCells > 0);
      assert.notEqual(result.open.actualDigest, result.open.expectedDigest);
      assert.ok(result.open.firstDifferences.every(row => subject.id === 'west-border' ? row.column === 0 : row.row === 0));
    }
  }
});
