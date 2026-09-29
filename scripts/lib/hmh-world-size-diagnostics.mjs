// Native Node diagnostic probes around the ACTUAL runtime nav/elevation code.
// No edits to navigation, simulation cadence, tie order, RNG or run evidence.
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { createEnemyNavGrid, createEnemyNavGridChunked, ENEMY_NAV_CELL_SIZE } from '../../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { refreshWorldDesignGateNavigation } from '../../apps/hmh-reboot/src/world-design-interactions.mjs';

export function digestNavGrid(grid) {
  return createHash('sha256').update(JSON.stringify([grid.columns, grid.rows, grid.cellSize, grid.minX, grid.minY]))
    .update(grid.walkable).update(grid.edges).digest('hex');
}
export function digestFlowField(field) {
  return createHash('sha256').update(new Uint8Array(field.distance.buffer, field.distance.byteOffset, field.distance.byteLength))
    .update(field.directions).digest('hex');
}

export function inspectNavigationMemory(grid, field) {
  const navArraysBytes = grid.walkable.byteLength + grid.edges.byteLength;
  const flowArraysBytes = field ? field.distance.byteLength + field.directions.byteLength : 0;
  return {
    navArraysBytes, flowArraysBytes, measuredArraysBytes: navArraysBytes + flowArraysBytes,
    arrays: { walkable: grid.walkable.byteLength, directedEdges: grid.edges.byteLength,
      ...(field ? { flowDistance: field.distance.byteLength, flowDirection: field.directions.byteLength } : {}) },
    method: 'byteLength of the actual returned typed arrays; not device/process residency',
    excludes: ['temporary BFS queue', 'previous flow fields pending GC', 'objects/closures/spatial indexes', 'textures/decoded images/sprites', 'GPU/process/phone memory'],
  };
}

export function inspectGridBoundary(grid, bounds, queryGround) {
  const contains = (x, y) => x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  let centresOutsideExactBounds = 0, walkableCentresOutsideExactBounds = 0, walkableCells = 0;
  for (let cell = 0; cell < grid.walkable.length; cell += 1) {
    if (grid.walkable[cell]) walkableCells += 1;
    const column = cell % grid.columns, row = (cell - column) / grid.columns;
    if (!contains(grid.centreX(column), grid.centreY(row))) {
      centresOutsideExactBounds += 1;
      if (grid.walkable[cell]) walkableCentresOutsideExactBounds += 1;
    }
  }
  const points = [
    ['exact-max-corner', bounds.maxX, bounds.maxY], ['past-max-corner', bounds.maxX + 1, bounds.maxY + 1],
    ['past-min-corner', bounds.minX - 1, bounds.minY - 1],
    ['last-cell-centre', grid.centreX(grid.columns - 1), grid.centreY(grid.rows - 1)],
  ];
  return {
    exactBounds: bounds,
    roundedExtent: { maxX: grid.minX + grid.columns * grid.cellSize, maxY: grid.minY + grid.rows * grid.cellSize },
    centresOutsideExactBounds, walkableCentresOutsideExactBounds, walkableCells,
    walkableCellPct: 100 * walkableCells / grid.walkable.length,
    probes: points.map(([id, x, y]) => {
      const sampled = queryGround(x, y);
      return { id, x, y, exactBoundsContains: contains(x, y), navCell: grid.cellAt(x, y), navWalkable: grid.isWalkableAt(x, y),
        groundSurfaceId: sampled.surfaceId, groundKind: sampled.kind, groundWalkable: sampled.walkable };
    }),
  };
}

// The runtime invokes now() once at each slice start and after each cell.
// Observe that contract without replacing the cell work. The hooks add cost:
// report this build separately from uninstrumented synchronous timings.
export async function buildInstrumentedGrid(subject, { cellsPerSlice = 512, sliceBudgetMs = 4 } = {}) {
  const total = Math.ceil((subject.world.bounds.maxX - subject.world.bounds.minX) / ENEMY_NAV_CELL_SIZE)
    * Math.ceil((subject.world.bounds.maxY - subject.world.bounds.minY) / ENEMY_NAV_CELL_SIZE);
  const slices = [];
  let slice = null, phase = 0, phaseCells = 0, yields = 0, groundQueries = 0;
  const finish = () => { if (slice) { slices.push({ pass: slice.pass, cells: slice.cells, groundQueries: slice.groundQueries, workMs: slice.end - slice.start }); slice = null; } };
  const now = () => {
    const time = performance.now();
    if (slice === null) slice = { pass: phase === 0 ? 'walkability' : 'directed-edges', start: time, end: time, cells: 0, groundQueries: 0 };
    else {
      slice.cells += 1; slice.end = time; phaseCells += 1;
      if (phaseCells === total) { finish(); phase += 1; phaseCells = 0; }
    }
    return time;
  };
  const queryGround = (x, y) => { groundQueries += 1; if (slice) slice.groundQueries += 1; return subject.queryGround(x, y); };
  const scheduleYield = async () => { finish(); yields += 1; await new Promise(resolve => setImmediate(resolve)); };
  const start = performance.now();
  const grid = await createEnemyNavGridChunked({ world: subject.world, queryGround, cellsPerSlice, sliceBudgetMs, now, scheduleYield });
  finish();
  return { grid, slices, yields, groundQueries, elapsedMs: performance.now() - start,
    scheduler: 'Node setImmediate; NOT browser requestIdleCallback or physical-phone scheduling',
    instrumentation: 'clock and ground-query hooks add overhead; slice durations are native Node observations' };
}

function compareArrays(actual, expected) {
  let diffCells = 0, walkableDiffCells = 0, directedEdgeDiffCells = 0;
  const firstDifferences = [];
  for (let cell = 0; cell < actual.walkable.length; cell += 1) {
    const walk = actual.walkable[cell] !== expected.walkable[cell], edge = actual.edges[cell] !== expected.edges[cell];
    if (walk) walkableDiffCells += 1;
    if (edge) directedEdgeDiffCells += 1;
    if (walk || edge) {
      diffCells += 1;
      if (firstDifferences.length < 8) firstDifferences.push({ cell, column: cell % actual.columns, row: Math.floor(cell / actual.columns),
        actualWalkable: actual.walkable[cell], expectedWalkable: expected.walkable[cell], actualEdges: actual.edges[cell], expectedEdges: expected.edges[cell] });
    }
  }
  return { diffCells, walkableDiffCells, directedEdgeDiffCells, firstDifferences, actualDigest: digestNavGrid(actual), expectedDigest: digestNavGrid(expected) };
}

export function compareGatePatch(subject, gateId) {
  const original = subject.world.collisionBlockers;
  if (!original.some(blocker => blocker.id === gateId)) throw new TypeError('a real capsule gate id is required');
  const active = Object.freeze(original.filter(blocker => blocker.id !== gateId));
  const grid = createEnemyNavGrid(subject);
  const closed = { ...grid, walkable: grid.walkable.slice(), edges: grid.edges.slice() };
  const expectedOpen = createEnemyNavGrid({ ...subject, world: { ...subject.world, collisionBlockers: active } });
  const changedByOpening = compareArrays(closed, expectedOpen).diffCells;
  const patchedCells = refreshWorldDesignGateNavigation(grid, subject.world, subject.queryGround, gateId, active);
  const open = compareArrays(grid, expectedOpen);
  refreshWorldDesignGateNavigation(grid, subject.world, subject.queryGround, gateId, original);
  return { patchedCells, changedByOpening, open, reclosed: compareArrays(grid, closed) };
}
