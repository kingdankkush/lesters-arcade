import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { auditCollisionWorld, createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import {
  LEVEL_ONE_PLAYER_RADIUS,
  LEVEL_ONE_PROTECTED_SPAWN_RADIUS,
  LEVEL_ONE_WORLD,
  buildLevelOneMinimapGeometry,
  createLevelOneGroundQuery,
  createLevelOneRevealState,
  getLevelOneDistrictAt,
  getLevelOneRevealSnapshot,
  getLevelOneRouteLength,
  revealLevelOneAt,
  auditLevelOneWorld,
} from '../apps/hmh-reboot/src/level-one-world.mjs';

const EXPECTED_DISTRICTS = [
  'frontier-relay',
  'rugpull-ravine',
  'liquidity-crossing',
  'hashwood',
  'mining-camp',
  'liquidation-yard',
];

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test('world dimensions are authored in world units from a bounded traversal-time target', () => {
  assert.deepEqual(LEVEL_ONE_WORLD.bounds, {
    minX: 0,
    minY: 0,
    maxX: 12_000,
    maxY: 4_800,
    visibleBoundaryId: 'forked-frontier-perimeter',
  });
  assert.equal(LEVEL_ONE_WORLD.player.maxSpeed, 240);
  const routeLength = getLevelOneRouteLength('main-route');
  const traversalSeconds = routeLength / LEVEL_ONE_WORLD.player.maxSpeed;
  assert.ok(traversalSeconds >= 40 && traversalSeconds <= 70, `unopposed traversal ${traversalSeconds}s`);
  assert.deepEqual(LEVEL_ONE_WORLD.traversalTargetSeconds, { minimum: 40, maximum: 70 });
  assert.equal(Object.isFrozen(LEVEL_ONE_WORLD), true);
});

test('six ordered districts cover the world and resolve deterministic seams', () => {
  assert.deepEqual(LEVEL_ONE_WORLD.districts.map((district) => district.id), EXPECTED_DISTRICTS);
  assert.equal(getLevelOneDistrictAt(800, 2_400).id, 'frontier-relay');
  assert.equal(getLevelOneDistrictAt(11_000, 2_400).id, 'liquidation-yard');
  for (let index = 1; index < LEVEL_ONE_WORLD.districts.length; index += 1) {
    const left = LEVEL_ONE_WORLD.districts[index - 1];
    const right = LEVEL_ONE_WORLD.districts[index];
    assert.equal(left.area.maxX, right.area.minX);
    assert.equal(LEVEL_ONE_WORLD.seams[index - 1].districtIds.join('>'), `${left.id}>${right.id}`);
  }
  assert.equal(getLevelOneDistrictAt(-1, 0), null);
});

test('macro route graph is connected and every optional loop converges back to the main route', () => {
  const audit = auditLevelOneWorld();
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.ok, true);
  assert.equal(audit.reachableNodeIds.length, LEVEL_ONE_WORLD.routeGraph.nodes.length);
  assert.ok(LEVEL_ONE_WORLD.routes.some((route) => route.id === 'main-route' && route.kind === 'main'));
  assert.ok(LEVEL_ONE_WORLD.routes.filter((route) => route.kind === 'loop').length >= 6);
  for (const route of LEVEL_ONE_WORLD.routes.filter((route) => route.kind === 'loop')) {
    assert.equal(route.nodeIds.length >= 3, true);
    assert.equal(route.nodeIds[0], route.nodeIds.at(-1));
  }
});

test('spawn protection excludes every solid, hazard, landmark, and encounter region', () => {
  assert.equal(LEVEL_ONE_PLAYER_RADIUS, 24);
  assert.equal(LEVEL_ONE_PROTECTED_SPAWN_RADIUS, 560);
  const spawn = LEVEL_ONE_WORLD.player.spawn;
  const protectedFeatures = [
    ...LEVEL_ONE_WORLD.blockers.map((feature) => ({ id: feature.id, anchor: feature.anchor })),
    ...LEVEL_ONE_WORLD.landmarks,
    ...LEVEL_ONE_WORLD.interactions.hazards,
    ...LEVEL_ONE_WORLD.encounterArenas,
  ];
  for (const feature of protectedFeatures) {
    assert.ok(pointDistance(spawn, feature.anchor) >= LEVEL_ONE_PROTECTED_SPAWN_RADIUS, `${feature.id} overlaps spawn protection`);
  }
});

test('main routes and bridge crossing preserve player-radius swept clearance', () => {
  assert.ok(LEVEL_ONE_WORLD.routeClearance.main >= LEVEL_ONE_PLAYER_RADIUS * 2 + 96);
  assert.ok(LEVEL_ONE_WORLD.routeClearance.bridge >= LEVEL_ONE_PLAYER_RADIUS * 2 + 64);
  const crossing = LEVEL_ONE_WORLD.crossings.find((candidate) => candidate.id === 'proof-of-work-bridge');
  assert.ok(crossing);
  assert.ok(crossing.clearWidth >= LEVEL_ONE_WORLD.routeClearance.bridge);
  const body = createCollisionBody({ id: 'player', kind: 'player', radius: LEVEL_ONE_PLAYER_RADIUS, minZ: 0, maxZ: 42 });
  const collision = resolveSweptCircleMotion({
    body,
    start: { ...crossing.entry, z: 0 },
    delta: { x: crossing.exit.x - crossing.entry.x, y: crossing.exit.y - crossing.entry.y },
    blockers: LEVEL_ONE_WORLD.collisionBlockers,
    bounds: LEVEL_ONE_WORLD.bounds,
  });
  assert.equal(collision.contacts.length, 0);
  assert.ok(pointDistance(collision.position, crossing.exit) < 1e-6);
  const traversal = resolveSweptTraversalPath({
    start: crossing.entry,
    end: crossing.exit,
    queryGround: createLevelOneGroundQuery(),
    maxSampleDistance: LEVEL_ONE_PLAYER_RADIUS * 0.25,
  });
  assert.equal(traversal.allowed, true);
  assert.equal(traversal.position.x, crossing.exit.x);
});

test('every main-route segment is traversable through canonical collision and elevation', () => {
  const body = createCollisionBody({ id: 'route-probe', kind: 'player', radius: LEVEL_ONE_PLAYER_RADIUS, minZ: 0, maxZ: 42 });
  const queryGround = createLevelOneGroundQuery();
  const nodes = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
  const mainRoute = LEVEL_ONE_WORLD.routes.find((route) => route.id === 'main-route');
  for (let index = 1; index < mainRoute.nodeIds.length; index += 1) {
    const start = nodes.get(mainRoute.nodeIds[index - 1]);
    const end = nodes.get(mainRoute.nodeIds[index]);
    const collision = resolveSweptCircleMotion({
      body,
      start: { ...start, z: queryGround(start.x, start.y).groundZ },
      delta: { x: end.x - start.x, y: end.y - start.y },
      blockers: LEVEL_ONE_WORLD.collisionBlockers,
      bounds: LEVEL_ONE_WORLD.bounds,
    });
    assert.equal(collision.contacts.length, 0, `${start.id} -> ${end.id} hit ${collision.contacts[0]?.blockerId}`);
    const traversal = resolveSweptTraversalPath({ start, end, queryGround, maxSampleDistance: 6 });
    assert.equal(traversal.allowed, true, `${start.id} -> ${end.id} blocked by ${traversal.reason}`);
  }
});

test('waterway, bridge, ramps, ledges, and legal ascents share the authored ground query', () => {
  const queryGround = createLevelOneGroundQuery();
  assert.equal(queryGround(4_700, 1_700).deepWater, true);
  assert.equal(queryGround(4_700, 2_400).kind, 'bridge');
  assert.equal(queryGround(4_420, 2_400).kind, 'ramp');
  assert.equal(queryGround(2_950, 1_350).kind, 'ledge');
  const ravineRamp = LEVEL_ONE_WORLD.legalAscents.find((ascent) => ascent.id === 'ravine-switchback-ramp');
  const ascent = resolveSweptTraversalPath({ start: ravineRamp.entry, end: ravineRamp.exit, queryGround, maxSampleDistance: 6 });
  assert.equal(ascent.allowed, true);
  assert.ok(ascent.ground.groundZ > 0);
  const illegalCliff = resolveSweptTraversalPath({ start: { x: 2_900, y: 1_800 }, end: { x: 2_900, y: 1_350 }, queryGround, maxSampleDistance: 6 });
  assert.equal(illegalCliff.allowed, false);
});

test('POIs, rewards, arenas, destructibles, and explosive zones have unique authored IDs and district ownership', () => {
  assert.ok(LEVEL_ONE_WORLD.pointsOfInterest.length >= 9);
  assert.ok(LEVEL_ONE_WORLD.encounterArenas.length >= 6);
  assert.ok(LEVEL_ONE_WORLD.interactions.destructibles.length >= 8);
  assert.ok(LEVEL_ONE_WORLD.interactions.explosiveZones.length >= 3);
  const all = [
    ...LEVEL_ONE_WORLD.pointsOfInterest,
    ...LEVEL_ONE_WORLD.encounterArenas,
    ...LEVEL_ONE_WORLD.interactions.destructibles,
    ...LEVEL_ONE_WORLD.interactions.explosiveZones,
  ];
  assert.equal(new Set(all.map((entry) => entry.id)).size, all.length);
  for (const entry of all) assert.ok(EXPECTED_DISTRICTS.includes(entry.districtId), `${entry.id} has invalid district`);
  assert.equal(LEVEL_ONE_WORLD.encounterArenas.at(-1).id, 'liquidator-arena');
});

test('every solid and perimeter boundary has visible physical metadata and continuous coverage', () => {
  const collisionAudit = auditCollisionWorld({
    blockers: LEVEL_ONE_WORLD.collisionBlockers,
    visibleBarriers: LEVEL_ONE_WORLD.visibleBarriers,
  });
  assert.deepEqual(collisionAudit.errors, []);
  assert.equal(collisionAudit.ok, true);
  assert.deepEqual(LEVEL_ONE_WORLD.perimeter.map((edge) => edge.physicalCause), ['cliffs', 'wrecks-and-fence', 'deep-water-and-cliffs', 'fence-and-buildings']);
  for (const edge of LEVEL_ONE_WORLD.perimeter) {
    assert.equal(edge.segments[0].start, 0);
    assert.equal(edge.segments.at(-1).end, edge.length);
    for (let index = 1; index < edge.segments.length; index += 1) assert.ok(edge.segments[index - 1].end >= edge.segments[index].start);
  }
});

test('minimap geometry is normalized from the same route, district, surface, and blocker IDs', () => {
  const minimap = buildLevelOneMinimapGeometry();
  assert.deepEqual(minimap.bounds, LEVEL_ONE_WORLD.bounds);
  assert.deepEqual(minimap.routes.map((route) => route.id), LEVEL_ONE_WORLD.routes.map((route) => route.id));
  assert.deepEqual(minimap.districts.map((district) => district.id), EXPECTED_DISTRICTS);
  assert.deepEqual(minimap.surfaces.map((surface) => surface.id), LEVEL_ONE_WORLD.surfaces.map((surface) => surface.id));
  assert.deepEqual(minimap.hardBoundaries.map((barrier) => barrier.id), LEVEL_ONE_WORLD.visibleBarriers.map((barrier) => barrier.id));
  for (const point of minimap.routes.flatMap((route) => route.points)) {
    assert.ok(point.x >= 0 && point.x <= 1);
    assert.ok(point.y >= 0 && point.y <= 1);
  }
});

test('fog reveal is deterministic, monotonic, bounded, and never hides collision truth', () => {
  const first = createLevelOneRevealState();
  const second = createLevelOneRevealState();
  revealLevelOneAt(first, LEVEL_ONE_WORLD.player.spawn, 420);
  revealLevelOneAt(second, LEVEL_ONE_WORLD.player.spawn, 420);
  const initial = getLevelOneRevealSnapshot(first);
  assert.deepEqual(initial, getLevelOneRevealSnapshot(second));
  assert.ok(initial.revealedCellIds.length > 0);
  revealLevelOneAt(first, { x: 2_400, y: 2_400 }, 420);
  const expanded = getLevelOneRevealSnapshot(first);
  assert.ok(expanded.revealedCellIds.length > initial.revealedCellIds.length);
  assert.equal(expanded.totalCells, initial.totalCells);
  assert.deepEqual(expanded.alwaysVisibleBoundaryIds, LEVEL_ONE_WORLD.visibleBarriers.map((barrier) => barrier.id).sort());
  assert.equal(Object.isFrozen(expanded), true);
});

test('runtime imports the world contract instead of retaining an inline parallel graybox', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /from '.\/level-one-world\.mjs'/);
  assert.match(source, /LEVEL_ONE_WORLD/);
  assert.match(source, /createLevelOneGroundQuery/);
  assert.match(source, /buildLevelOneMinimapGeometry/);
  assert.match(source, /revealLevelOneAt/);
  assert.match(source, /runtimeParams\.get\('evidenceSafe'\) === '1'/);
  assert.match(source, /evidenceSafeEnabled \|\| isDashInvulnerable/);
  assert.doesNotMatch(source, /const GRAYBOX_SURFACES/);
  assert.doesNotMatch(source, /const GRAYBOX_BLOCKERS/);
  assert.doesNotMatch(source, /Math\.random|Date\.now/);
});
