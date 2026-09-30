import assert from 'node:assert/strict';
import test from 'node:test';
import { createStaticBlocker, createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
const kit = await import('../apps/hmh-reboot/src/dev/greybox-kit.mjs').catch(() => ({}));
const layout = await import('../apps/hmh-reboot/src/dev/greybox-world-v1.mjs').catch(() => ({}));
const checker = await import('../scripts/lib/hmh-greybox-world-check.mjs').catch(() => ({}));
const requiredAreas = ['mweb-meadows', 'litecoin-city', 'halving-farms', 'silver-coast', 'scrypt-bayou', 'hashwood-river', 'hollow-pines', 'ledger-ridge', 'fork-fortress', 'rugpull-woods'];
const make = () => { assert.equal(typeof layout.createGreyboxWorld, 'function'); return layout.createGreyboxWorld(); };
const inspect = world => { assert.equal(typeof checker.checkGreyboxWorld, 'function'); return checker.checkGreyboxWorld(world); };
const mutable = () => { const original = make(); return { ...original, areas: structuredClone(original.areas), roads: structuredClone(original.roads), sites: structuredClone(original.sites), arenas: structuredClone(original.arenas), pieces: structuredClone(original.pieces), collisionBlockers: [...original.collisionBlockers] }; };

test('authored ten-area world has exact bounds and explicitly cannot become an official or Ranked run', () => {
  const world = make();
  assert.deepEqual(world.bounds, { minX: 0, minY: 0, maxX: 20000, maxY: 14000 });
  assert.deepEqual(world.areas.map(area => area.id).sort(), [...requiredAreas].sort());
  assert.equal(world.rankedEligible, false); assert.equal(world.officialRun, false);
  assert.equal(world.rulesVersion, null); assert.equal(world.mapId, 'visual-overhaul-greybox-v1');
  assert.ok(world.sites.every(site => site.runtimeEffect === 'none'));
  const first = world.areas[0].bounds.minX;
  assert.throws(() => { world.areas[0].bounds.minX = first + 1; }, TypeError);
  assert.equal(make().areas[0].bounds.minX, first);
});

test('kit surfaces and visible blockers use real collision/elevation rather than decorative-only walls', () => {
  assert.equal(typeof kit.createGreyboxPiece, 'function');
  const piece = kit.createGreyboxPiece({ id: 'wall', kind: 'mass', bounds: { minX: 100, minY: 0, maxX: 200, maxY: 200 }, height: 100 });
  const body = createCollisionBody({ id: 'human', kind: 'player', radius: 24, minZ: 0, maxZ: 72 });
  const move = resolveSweptCircleMotion({ body, start: { x: 40, y: 100, z: 0 }, delta: { x: 150, y: 0 }, blockers: [piece.blocker], bounds: { minX: 0, minY: 0, maxX: 300, maxY: 300, visibleBoundaryId: 'inspection-edge' } });
  assert.ok(move.position.x <= 76.001, 'actual player-radius sweep stops before the visible wall');
  assert.equal(piece.blocker.visibleAssetId, piece.visible.id);
  const deck = kit.createGreyboxPiece({ id: 'flush', kind: 'deck', bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 }, height: 0 });
  assert.equal(deck.surface.groundZ, 0); assert.equal(deck.blocker, null);
  const source = { id: 'short', kind: 'cover-short', bounds: { minX: 10, minY: 10, maxX: 90, maxY: 40 }, height: 48 };
  const cover = kit.createGreyboxPiece(source); source.bounds.maxX = 999;
  assert.equal(cover.visible.bounds.maxX, 90); assert.equal(cover.blocker.combatCover, true);
  assert.throws(() => kit.createGreyboxPiece({ ...source, kind: 'magic-climb' }), /kind/);
  assert.throws(() => kit.createGreyboxPiece({ ...source, bounds: { minX: 100, minY: 0, maxX: 0, maxY: 20 } }), /bounds/);
});

test('a sloped closed mass preserves its visible polygon instead of blocking its whole bounding box', () => {
  assert.equal(typeof kit.createGreyboxPiece, 'function');
  const vertices=[{x:0,y:0},{x:100,y:100},{x:100,y:0}];
  const piece=kit.createGreyboxPiece({id:'triangle',kind:'mass',bounds:{minX:0,minY:0,maxX:100,maxY:100},vertices,height:180});
  const body=createCollisionBody({id:'human',kind:'player',radius:2,minZ:0,maxZ:72});
  const move=resolveSweptCircleMotion({body,start:{x:30,y:90,z:0},delta:{x:20,y:0},blockers:[piece.blocker],bounds:{minX:-100,minY:-100,maxX:200,maxY:200,visibleBoundaryId:'inspection'},stopOnFirstContact:true});
  assert.equal(move.contacts.length,0);assert.equal(move.depenetrations.length,0);assert.equal(move.position.x,50);
  assert.deepEqual(piece.visible.vertices,piece.blocker.shape.vertices);
  vertices[0].x=500;assert.equal(piece.visible.vertices.some(p=>p.x===500),false);
  assert.throws(()=>kit.createGreyboxPiece({id:'wrong-floor',kind:'deck',bounds:{minX:0,minY:0,maxX:100,maxY:100},vertices,height:0}),/polygon/);
});

test('real nav, authored approaches, roads, spawn and combat-space diagnostics inspect the actual first layout', () => {
  const report = inspect(make());
  assert.equal(report.passed, true, JSON.stringify(report.issues));
  assert.equal(report.navigation.metrics.outsideWalkableCells, 0);
  assert.ok(report.navigation.metrics.walkableFraction >= 0.45 && report.navigation.metrics.walkableFraction <= 0.55);
  assert.ok(report.navigation.targets.every(target => target.reachable && target.returnable));
  assert.equal(report.areas.length, 10);
  assert.ok(report.areas.every(area => area.distinctEntrances >= 2));
  assert.ok(report.roadJourneys.every(road => road.actualSweepClear && road.groundContinuous));
  assert.ok(report.spawn.playerRadiusClear && report.spawn.protectedRadiusClear);
  assert.equal(report.scope.includes('not mission'), true);
});

test('one claimed entrance repeated twice cannot satisfy branch access', () => {
  const world = mutable(), area = world.areas.find(area => area.id === 'hollow-pines');
  area.entranceIds = [area.entranceIds[0], area.entranceIds[0]];
  const report = inspect(world);
  assert.ok(report.issues.some(issue => issue.code === 'AREA_ENTRANCE_COUNT' && issue.id === area.id));
});

test('a disconnected declaration and an entrance outside its claimed area are visible errors', () => {
  const world = mutable(), road = world.roads[0];
  road.fromAreaId = 'nonexistent';
  world.areas[0].entranceIds = ['nonexistent-road', 'also-nonexistent'];
  const report = inspect(world);
  assert.ok(report.issues.some(issue => issue.code === 'UNKNOWN_ROAD_AREA'));
  assert.ok(report.issues.some(issue => issue.code === 'UNKNOWN_ENTRANCE'));
  const other = mutable(), entry = other.sites.find(site => site.kind === 'entrance'); entry.x = 19990; entry.y = 13990;
  assert.ok(inspect(other).issues.some(issue => issue.code === 'SITE_OUTSIDE_AREA' && issue.id === entry.id));
});

test('real barrier across a road must fail the path even when graph labels still connect areas', () => {
  const world = mutable(), road = world.roads.find(road => road.id === 'coast-city');
  const midpoint = road.points[Math.floor(road.points.length / 2)];
  world.collisionBlockers.push(createStaticBlocker({ id: 'review-partition', visibleAssetId: 'review-partition-visible', shape: { type: 'capsule', a: { x: midpoint.x, y: midpoint.y - 600 }, b: { x: midpoint.x, y: midpoint.y + 600 }, radius: 30 }, minZ: 0, maxZ: 150 }));
  const report = inspect(world);
  assert.ok(report.issues.some(issue => issue.code === 'ROAD_SWEEP_BLOCKED' && issue.id === road.id));
});

test('actual blockers reject false spawn-clearance and objective-sightline claims', () => {
  const world = mutable();
  world.collisionBlockers.push(createStaticBlocker({ id: 'spawn-collision', visibleAssetId: 'spawn-collision-visible', shape: { type: 'circle', x: world.spawn.x + 80, y: world.spawn.y, radius: 60 }, minZ: 0, maxZ: 140 }));
  assert.ok(inspect(world).issues.some(issue => issue.code === 'SPAWN_CLEARANCE'));
  const other = mutable(), target = other.sites.find(site => site.kind === 'objective');
  const x = (target.x + target.approach.x) / 2, y = (target.y + target.approach.y) / 2;
  other.collisionBlockers.push(createStaticBlocker({ id: 'objective-occluder', visibleAssetId: 'objective-occluder-visible', shape: { type: 'circle', x, y, radius: 60 }, minZ: 0, maxZ: 200 }));
  assert.ok(inspect(other).issues.some(issue => issue.code === 'STAGED_SIGHTLINE' && issue.id === target.id));
});

test('arena floor and genuinely separate exits cannot be replaced by size labels alone', () => {
  const world = mutable(), arena = world.arenas[0];
  arena.exits[1] = { ...arena.exits[0] };
  assert.ok(inspect(world).issues.some(issue => issue.code === 'ARENA_EXITS' && issue.id === arena.id));
  const other = mutable(), stage = other.arenas[0];
  other.collisionBlockers.push(createStaticBlocker({ id: 'filled-arena', visibleAssetId: 'filled-arena-visible', shape: { type: 'circle', x: stage.center.x, y: stage.center.y, radius: 850 }, minZ: 0, maxZ: 180 }));
  assert.ok(inspect(other).issues.some(issue => issue.code === 'ARENA_FLOOR' && issue.id === stage.id));
});

test('arena cover cannot borrow unrelated far-away cover from its area', () => {
  const world = mutable(), arena = world.arenas[0];
  for (const piece of world.pieces.filter(piece => piece.visible.areaId === arena.areaId && piece.kind.startsWith('cover-'))) {
    const bounds = piece.visible.bounds;
    for (const key of ['minX', 'maxX']) bounds[key] += 5000;
    const replacement = createStaticBlocker({ id: piece.blocker.id, visibleAssetId: piece.visible.id, combatCover: true, minZ: piece.blocker.minZ, maxZ: piece.blocker.maxZ, shape: { type: 'polygon', vertices: [ { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY } ] } });
    world.collisionBlockers = world.collisionBlockers.map(blocker => blocker.id === piece.blocker.id ? replacement : blocker);
    piece.blocker = replacement;
  }
  assert.ok(inspect(world).issues.some(issue => issue.code === 'ARENA_COVER_HEIGHTS' && issue.id === arena.id));
});

test('arena exits cannot be falsely assigned from another court', () => {
  const world = mutable(), arena = world.arenas[0];
  arena.exits[0] = { ...world.arenas[1].exits[1] };
  assert.ok(inspect(world).issues.some(issue => issue.code === 'ARENA_EXITS' && issue.id === arena.id));
});
