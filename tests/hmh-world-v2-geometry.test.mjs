// W3b RED draft. Install at tests/hmh-world-v2-geometry.test.mjs before execution.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { createAuthoredGroundQuery, createElevationSurface, resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import { createCollisionBody, createStaticBlocker, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { compareGatePatch } from '../scripts/lib/hmh-world-size-diagnostics.mjs';

const module = await import('../apps/hmh-reboot/src/world-v2-geometry.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('world-v2-geometry.mjs')) return {};
  throw error;
});
const authored = createGreyboxWorld();
function adapt(source = authored) {
  assert.equal(typeof module.createWorldV2Geometry, 'function', 'dormant world-v2 geometry adapter is required');
  return module.createWorldV2Geometry(source);
}
function mutable(source = authored) {
  const { queryGround, ...data } = source;
  return structuredClone(data);
}
const order = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const rect = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });
const body = createCollisionBody({ id: 'w3b-inspection-human', kind: 'player', radius: 24, minZ: 0, maxZ: 72 });
function sweep(world, start, end) {
  return resolveSweptCircleMotion({ body, start: { ...start, z: world.queryGround(start.x, start.y).groundZ },
    delta: { x: end.x - start.x, y: end.y - start.y }, blockers: world.collisionBlockers,
    bounds: { ...world.bounds, visibleBoundaryId: 'greybox-world-edge' }, stopOnFirstContact: true });
}
function fixture(bounds, surfaces = [], collisionBlockers = []) {
  return { mapId: 'w3b-diagnostic-only', officialRun: false, rankedEligible: false, rulesVersion: null,
    bounds, areas: [{ id: 'room', name: 'Diagnostic room', bounds: { ...bounds } }], roads: [], sites: [],
    spawn: { x: bounds.minX + 30, y: bounds.minY + 30 },
    baseSurface: createElevationSurface({ id: 'diagnostic-floor', area: { type: 'rect', ...bounds }, visibleTerrainId: 'diagnostic-floor' }),
    surfaces, collisionBlockers };
}
function navBytes(grid) {
  assert.ok(grid.walkable instanceof Uint8Array);
  assert.ok(grid.edges instanceof Uint8Array);
  assert.equal(grid.walkable.length, grid.columns * grid.rows);
  assert.equal(grid.edges.length, grid.walkable.length);
  return { columns: grid.columns, rows: grid.rows, cellSize: grid.cellSize, minX: grid.minX, minY: grid.minY,
    walkable: grid.walkable, edges: grid.edges };
}

test('the adapter exposes only dormant geometry, never staged encounters or a new runtime contract', () => {
  const context = adapt();
  assert.deepEqual(Object.keys(context).sort(), ['sourceMapId', 'officialRun', 'rankedEligible', 'rulesVersion', 'bounds', 'baseSurface',
    'surfaces', 'collisionBlockers', 'areas', 'roads', 'roadEntrances', 'inspectionStart', 'queryGround', 'getAreaAt'].sort());
  assert.equal(context.sourceMapId, authored.mapId);
  assert.equal(context.officialRun, false);
  assert.equal(context.rankedEligible, false);
  assert.equal(context.rulesVersion, null);
  assert.ok(authored.arenas.some(arena => arena.bossId));
  assert.ok(authored.sites.some(site => site.kind === 'objective'));
  assert.ok(authored.pieces.some(piece => piece.kind === 'climb-marker' || piece.kind === 'drop-marker'));
  assert.ok(context.areas.every(area => Object.keys(area).sort().join(',') === 'bounds,id,name'));
  assert.ok(context.roadEntrances.every(entry => Object.keys(entry).sort().join(',') === 'areaId,id,roadId,x,y'));
  assert.equal('seedEntries' in context, false);
  assert.equal('spawn' in context, false);
});

test('the adapter preserves exact world bounds and rejects malformed bounds or active inputs', () => {
  assert.deepEqual(adapt().bounds, rect(0, 0, 20000, 14000));
  for (const bounds of [null, rect(0, 0, Infinity, 14000), rect(1, 0, 1, 2), rect(0, NaN, 1, 2)]) {
    assert.throws(() => adapt({ ...authored, bounds }), TypeError);
  }
  for (const update of [{ officialRun: true }, { rankedEligible: true }, { rulesVersion: 2 }, { officialRun: undefined }, { mapId: '' }]) {
    assert.throws(() => adapt({ ...authored, ...update }), TypeError);
  }
});

test('all ten areas use stable two-coordinate lookup with no nearest-area fallback', () => {
  const context = adapt(), reversed = adapt({ ...authored, areas: [...authored.areas].reverse() });
  assert.equal(context.areas.length, 10);
  assert.deepEqual(context.areas, reversed.areas);
  assert.deepEqual(context.areas.map(area => area.id), [...authored.areas].sort(order).map(area => area.id));
  for (const area of authored.areas) {
    assert.equal(context.getAreaAt(area.center.x, area.center.y).id, area.id);
    assert.deepEqual(reversed.getAreaAt(area.center.x, area.center.y), context.getAreaAt(area.center.x, area.center.y));
  }
  assert.equal(context.getAreaAt(7500, 2500).id, 'ledger-ridge');
  assert.equal(context.getAreaAt(7500, 6700).id, 'litecoin-city');
  assert.equal(context.getAreaAt(7500, 11600).id, 'hashwood-river');
  for (const point of [{ x: 10000, y: 6700 }, { x: -1, y: 6700 }, { x: 20001, y: 6700 }, { x: 7500, y: 14001 }]) {
    assert.equal(context.getAreaAt(point.x, point.y), null);
  }
  for (const point of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: '7500', y: 6700 }]) {
    assert.throws(() => context.getAreaAt(point.x, point.y), TypeError);
  }
});

test('ambiguous area geometry fails early while shared-edge ownership remains independent of input order', () => {
  adapt();
  for (const change of [
    source => { source.areas[1].id = source.areas[0].id; },
    source => { source.areas[1].bounds = { ...source.areas[0].bounds }; },
    source => { source.areas[0].bounds.minX = -1; },
  ]) {
    const source = mutable(); change(source); assert.throws(() => adapt(source), TypeError);
  }
  const source = fixture(rect(0, 0, 180, 180));
  source.areas = [{ id: 'west', name: 'West', bounds: rect(0, 0, 90, 180) }, { id: 'east', name: 'East', bounds: rect(90, 0, 180, 180) }];
  assert.equal(adapt(source).getAreaAt(90, 90).id, 'east');
  source.areas.reverse();
  assert.equal(adapt(source).getAreaAt(90, 90).id, 'east');
});

test('shared-edge road entrances must use the same deterministic area owner as lookup', () => {
  const source = fixture(rect(0, 0, 180, 180));
  source.areas = [{ id: 'west', name: 'West', bounds: rect(0, 0, 90, 180) }, { id: 'east', name: 'East', bounds: rect(90, 0, 180, 180) }];
  const connect = (fromAreaId, fromX, toAreaId, toX) => {
    source.roads = [{ id: 'boundary-road', fromAreaId, toAreaId, kind: 'path', width: 60, points: [{ x: fromX, y: 90 }, { x: toX, y: 90 }] }];
    source.sites = [{ id: 'from-entrance', kind: 'entrance', areaId: fromAreaId, roadId: 'boundary-road', x: fromX, y: 90, runtimeEffect: 'none' },
      { id: 'to-entrance', kind: 'entrance', areaId: toAreaId, roadId: 'boundary-road', x: toX, y: 90, runtimeEffect: 'none' }];
  };
  adapt(source);
  connect('west', 90, 'east', 150);
  assert.throws(() => adapt(source), TypeError, 'from endpoint cannot disagree with stable east ownership');
  connect('east', 150, 'west', 90);
  assert.throws(() => adapt(source), TypeError, 'to endpoint cannot disagree with stable east ownership');
  connect('west', 30, 'east', 90);
  const valid = adapt(source);
  assert.equal(valid.roadEntrances.length, 2);
  assert.ok(valid.roadEntrances.every(entry => valid.getAreaAt(entry.x, entry.y).id === entry.areaId));
  source.areas.reverse();
  assert.deepEqual(adapt(source).roadEntrances, valid.roadEntrances);
});

test('caller mutations cannot alter frozen geometry, area ownership, endpoints or ground queries', () => {
  const observe = context => ({ bounds: context.bounds, areas: context.areas, roads: context.roads, entrances: context.roadEntrances,
    inspectionStart: context.inspectionStart, baseSurface: context.baseSurface, surfaces: context.surfaces, blockers: context.collisionBlockers,
    centerGround: context.queryGround(12500, 6700), closedGround: context.queryGround(0, 0) });
  for (const change of [
    source => { source.bounds.maxX = 1; },
    source => { source.areas[0].bounds.minX = 0; },
    source => { source.areas[0].name = 'changed'; },
    source => { source.roads[0].points[0].x = 0; },
    source => { source.sites.find(site => site.kind === 'entrance').x = 0; },
    source => { source.spawn.x = 0; },
    source => { source.baseSurface.groundZ = 99; },
    source => { source.surfaces.find(surface => surface.id === 'mweb-meadows-floor').groundZ = 999; },
    source => { source.surfaces.find(surface => surface.area.type === 'polygon').area.vertices[0].x += 123; },
    source => { source.collisionBlockers[0].solid = false; },
    source => { source.collisionBlockers.find(blocker => blocker.shape.type === 'polygon').shape.vertices[0].y += 321; },
  ]) {
    const source = mutable(), context = adapt(source), expected = structuredClone(observe(context));
    change(source);
    assert.deepEqual(observe(context), expected);
    assert.equal(Object.isFrozen(source), false);
    assert.equal(Object.isFrozen(source.surfaces[0]), false);
  }
  const context = adapt();
  assert.throws(() => { context.bounds.maxX = 1; }, TypeError);
  assert.throws(() => { context.areas[0].bounds.minX = -1; }, TypeError);
  assert.throws(() => { context.roads[0].points[0].x = 1; }, TypeError);
  assert.throws(() => { context.collisionBlockers[0].shape.type = 'circle'; }, TypeError);
  assert.throws(() => { context.surfaces[0].groundZ = 99; }, TypeError);
  assert.throws(() => { context.roadEntrances[0].x = 1; }, TypeError);
});

test('ground edges and collision data exactly match the authored source without retaining its callback', () => {
  const context = adapt({ ...authored, queryGround: () => { throw Error('caller callback must not be retained'); } });
  assert.deepEqual(context.baseSurface, authored.baseSurface);
  assert.deepEqual(context.surfaces, authored.surfaces);
  assert.deepEqual(context.collisionBlockers, authored.collisionBlockers);
  const kinds = new Set(context.surfaces.map(surface => surface.kind));
  for (const kind of ['water', 'bridge', 'ramp', 'ground']) assert.ok(kinds.has(kind), kind);
  for (const surface of [authored.baseSurface, ...authored.surfaces]) {
    const area = surface.area;
    const vertices = area.type === 'polygon' ? area.vertices : [
      { x: area.minX, y: area.minY }, { x: area.maxX, y: area.minY }, { x: area.maxX, y: area.maxY }, { x: area.minX, y: area.maxY }];
    const center = { x: vertices.reduce((sum, p) => sum + p.x, 0) / vertices.length, y: vertices.reduce((sum, p) => sum + p.y, 0) / vertices.length };
    for (const point of [...vertices, center]) for (const offset of [-0.5, 0, 0.5]) {
      const x = point.x + offset, y = point.y + offset;
      assert.deepEqual(context.queryGround(x, y), authored.queryGround(x, y), `${surface.id} at ${x},${y}`);
    }
  }
});

test('real swept body and directed ground traversal retain all authored road and local-route outcomes', () => {
  const context = adapt();
  const routes = [...authored.roads, ...authored.areas.flatMap(area => area.inspectionRoutes)];
  assert.equal(authored.roads.length, 14);
  assert.equal(routes.length, 71);
  for (const route of routes) for (let index = 1; index < route.points.length; index += 1) {
    for (const [start, end] of [[route.points[index - 1], route.points[index]], [route.points[index], route.points[index - 1]]]) {
      const expected = sweep(authored, start, end);
      assert.equal(expected.contacts.length, 0, route.id);
      assert.equal(expected.depenetrations.length, 0, route.id);
      assert.deepEqual(sweep(context, start, end), expected, route.id);
      const original = resolveSweptTraversalPath({ start, end, queryGround: authored.queryGround });
      assert.equal(original.allowed, true, route.id);
      assert.deepEqual(resolveSweptTraversalPath({ start, end, queryGround: context.queryGround }), original, route.id);
    }
  }
});

test('the full ten-area nav lattice and spawn-target flow remain byte-identical', () => {
  const context = adapt();
  const expected = createEnemyNavGrid({ world: authored, queryGround: authored.queryGround });
  const actual = createEnemyNavGrid({ world: context, queryGround: context.queryGround });
  assert.deepEqual(navBytes(actual), navBytes(expected));
  const target = { targetX: authored.spawn.x, targetY: authored.spawn.y };
  const originalFlow = computeEnemyFlowField({ grid: expected, ...target });
  const adaptedFlow = computeEnemyFlowField({ grid: actual, ...target });
  for (const flow of [originalFlow, adaptedFlow]) {
    assert.ok(flow.distance instanceof Int32Array);
    assert.ok(flow.directions instanceof Int8Array);
    assert.equal(flow.distance.length, expected.walkable.length);
    assert.equal(flow.directions.length, expected.walkable.length);
  }
  assert.deepEqual(adaptedFlow.distance, originalFlow.distance);
  assert.deepEqual(adaptedFlow.directions, originalFlow.directions);
});

test('the inspection start and all 28 physical road entrances are preserved without inventing seed entries', () => {
  const context = adapt();
  assert.deepEqual(context.inspectionStart, authored.spawn);
  const expected = authored.sites.filter(site => site.kind === 'entrance')
    .map(({ id, areaId, roadId, x, y }) => ({ id, areaId, roadId, x, y })).sort(order);
  assert.equal(context.roadEntrances.length, 28);
  assert.deepEqual(context.roadEntrances, expected);
  for (const entry of [context.inspectionStart, ...context.roadEntrances]) {
    assert.equal(context.queryGround(entry.x, entry.y).walkable, true);
    const result = sweep(context, entry, entry);
    assert.equal(result.contacts.length, 0);
    assert.equal(result.depenetrations.length, 0);
  }
  for (const road of context.roads) for (const [areaId, point] of [[road.fromAreaId, road.points[0]], [road.toAreaId, road.points.at(-1)]]) {
    const entry = context.roadEntrances.find(item => item.roadId === road.id && item.areaId === areaId);
    assert.deepEqual({ x: entry.x, y: entry.y }, point);
    assert.equal(context.getAreaAt(point.x, point.y).id, areaId);
  }
});

test('unknown road areas, broken entrance bindings and malformed polylines fail instead of gaining guessed semantics', () => {
  adapt();
  for (const change of [
    source => { source.roads[0].fromAreaId = 'unknown-area'; },
    source => { source.roads[0].points = [source.roads[0].points[0]]; },
    source => { source.roads[0].points[0].x = NaN; },
    source => { source.roads[0].points[0].x = source.bounds.maxX + 1; },
    source => { source.roads[0].width = 0; },
    source => { source.roads[1].id = source.roads[0].id; },
    source => { source.sites.find(site => site.kind === 'entrance').roadId = 'unknown-road'; },
    source => { source.sites.find(site => site.kind === 'entrance').x += 1; },
    source => { source.sites.splice(source.sites.findIndex(site => site.kind === 'entrance'), 1); },
    source => { source.sites.push({ ...source.sites.find(site => site.kind === 'entrance') }); },
  ]) {
    const source = mutable(); change(source); assert.throws(() => adapt(source), TypeError);
  }
});

test('roads do not override a directed ledge: forward drop works and reverse climb stays illegal', () => {
  const bounds = rect(0, 0, 180, 180);
  const ledge = createElevationSurface({ id: 'one-way', kind: 'ledge', area: { type: 'rect', ...rect(60, 0, 120, 180) },
    groundZ: 48, oneWayDrop: { x: 1, y: 0 }, visibleTerrainId: 'diagnostic-ledge' });
  const source = fixture(bounds, [ledge]);
  source.areas = [{ id: 'west', name: 'West', bounds: rect(0, 0, 120, 180) }, { id: 'east', name: 'East', bounds: rect(120, 0, 180, 180) }];
  source.roads = [{ id: 'ledge-road', fromAreaId: 'west', toAreaId: 'east', kind: 'path', width: 60, points: [{ x: 90, y: 90 }, { x: 150, y: 90 }] }];
  source.sites = [{ id: 'ledge-west', kind: 'entrance', areaId: 'west', roadId: 'ledge-road', x: 90, y: 90, runtimeEffect: 'none' },
    { id: 'ledge-east', kind: 'entrance', areaId: 'east', roadId: 'ledge-road', x: 150, y: 90, runtimeEffect: 'none' }];
  const context = adapt(source), grid = createEnemyNavGrid({ world: context, queryGround: context.queryGround });
  assert.deepEqual(navBytes(grid), navBytes(createEnemyNavGrid({ world: source, queryGround: createAuthoredGroundQuery(source) })));
  const onLedge = grid.cellAt(90, 90), east = grid.cellAt(150, 90);
  assert.equal(grid.edges[onLedge] & 1, 1);
  assert.equal(grid.edges[onLedge] & 2, 0);
  assert.equal(grid.edges[east] & 2, 0);
  const toEast = computeEnemyFlowField({ grid, targetX: 150, targetY: 90 });
  assert.equal(toEast.distance[onLedge], 1);
  assert.equal(toEast.directions[onLedge], 0);
  assert.equal(computeEnemyFlowField({ grid, targetX: 90, targetY: 90 }).distance[east], -1);
});

test('an interior gate retains actual open/reclose parity and infinite collision heights without mutating the context', () => {
  const gate = createStaticBlocker({ id: 'interior-gate', shape: { type: 'capsule', a: { x: 270, y: 300 }, b: { x: 690, y: 300 }, radius: 18 }, visibleAssetId: 'gate' });
  const source = fixture(rect(0, 0, 960, 720), [], [gate]);
  const context = adapt(source);
  assert.equal(context.collisionBlockers[0].minZ, -Infinity);
  assert.equal(context.collisionBlockers[0].maxZ, Infinity);
  const original = compareGatePatch({ world: source, queryGround: createAuthoredGroundQuery(source) }, gate.id);
  const actual = compareGatePatch({ world: context, queryGround: context.queryGround }, gate.id);
  assert.deepEqual(actual, original);
  assert.equal(actual.open.diffCells, 0);
  assert.equal(actual.reclosed.diffCells, 0);
  assert.ok(actual.changedByOpening > 0);
  assert.ok(actual.patchedCells > 0);
  assert.deepEqual(context.collisionBlockers, [gate]);
  assert.equal(context.collisionBlockers[0].solid, true);
});
