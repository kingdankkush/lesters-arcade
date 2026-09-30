import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
const checker = await import('../scripts/lib/hmh-greybox-layout-check.mjs').catch(() => ({}));
const flat = (x, y) => ({ kind: y < 600 ? 'ground' : 'water', deepWater: y >= 600,
  walkable: y < 600, groundZ: 0, ascentAllowed: false, surfaceId: 'fixture-ground' });
const fixture = (extra = {}) => ({ world: { bounds: { minX: 0, minY: 0, maxX: 1200, maxY: 1200 }, collisionBlockers: [] },
  queryGround: flat, start: { x: 90, y: 90 }, targets: [{ id: 'area-east', kind: 'area', x: 1050, y: 450 },
    { id: 'garden-secret', kind: 'secret', x: 450, y: 450 }], ...extra });
function inspect(options) { assert.equal(typeof checker.checkGreyboxNavigation, 'function'); return checker.checkGreyboxNavigation(options); }

test('real nav-grid checker measures half-walkable ground and both target journeys', () => {
  const report = inspect(fixture());
  assert.equal(report.passed, true); assert.equal(report.metrics.inBoundsCells, 400);
  assert.equal(report.metrics.walkableCells, 200); assert.equal(report.metrics.walkableFraction, 0.5);
  assert.equal(report.metrics.outsideWalkableCells, 0);
  assert.deepEqual(report.issues, []);
  for (const target of report.targets) {
    assert.equal(target.reachable, true); assert.equal(target.returnable, true);
    assert.ok(target.pathDistanceUnits >= Math.hypot(target.x - 90, target.y - 90));
  }
});

test('rounded perimeter cells are a reported failure, without silently patching the grid', () => {
  const options = fixture(); options.world.bounds.maxX = 1220;
  const report = inspect(options);
  assert.equal(report.passed, false); assert.ok(report.metrics.outsideWalkableCells > 0);
  assert.ok(report.issues.some(issue => issue.code === 'OUTSIDE_WALKABLE_CELLS'));
});

test('canonical one-way drop reaches a secret but correctly rejects its return route', () => {
  const report = inspect(fixture({ queryGround: (x, y) => ({ ...flat(x, y), groundZ: x < 600 ? 12 : 0 }) }));
  const east = report.targets.find(target => target.id === 'area-east');
  assert.equal(east.reachable, true); assert.equal(east.returnable, false);
  assert.ok(report.issues.some(issue => issue.code === 'NO_RETURN_ROUTE' && issue.id === 'area-east'));
});

test('an actual thin barrier disconnects a target instead of being replaced by centre-point proximity', () => {
  const options = fixture(); options.world.collisionBlockers.push({ id: 'partition', shape: {
    type: 'capsule', a: { x: 600, y: 0 }, b: { x: 600, y: 600 }, radius: 18 } });
  const report = inspect(options), east = report.targets.find(target => target.id === 'area-east');
  assert.equal(east.reachable, false); assert.equal(east.pathDistanceUnits, null);
  assert.ok(report.issues.some(issue => issue.code === 'UNREACHABLE_TARGET' && issue.id === 'area-east'));
});

test('blocked, outside and duplicate declared points fail explicitly', () => {
  const report = inspect(fixture({ targets: [{ id: 'blocked', kind: 'secret', x: 450, y: 900 },
    { id: 'outside', kind: 'area', x: 1230, y: 90 }] }));
  assert.ok(report.issues.some(issue => issue.code === 'BLOCKED_TARGET' && issue.id === 'blocked'));
  assert.ok(report.issues.some(issue => issue.code === 'OUTSIDE_TARGET' && issue.id === 'outside'));
  assert.throws(() => inspect(fixture({ targets: [{ id: 'same', x: 90, y: 90 }, { id: 'same', x: 150, y: 90 }] })), /duplicate/);
  assert.throws(() => inspect(fixture({ start: { x: NaN, y: 90 } })), /finite/);
});

test('a blocked start cannot make reachable-site or density checks appear passing', () => {
  const report = inspect(fixture({ start: { x: 90, y: 900 } }));
  assert.equal(report.passed, false); assert.ok(report.issues.some(issue => issue.code === 'BLOCKED_START'));
  assert.ok(report.targets.every(target => !target.reachable && target.pathDistanceUnits === null));
  const dense = inspect(fixture({ queryGround: (x, y) => ({ ...flat(x, 0), kind: 'ground' }) }));
  assert.equal(dense.metrics.walkableFraction, 1);
  assert.ok(dense.issues.some(issue => issue.code === 'WALKABLE_FRACTION'));
});

test('checker leaves authored data untouched and returns detached repeatable metrics', () => {
  const options = fixture(), before = JSON.stringify({ world: options.world, start: options.start, targets: options.targets });
  const first = inspect(options), second = inspect(options);
  assert.equal(JSON.stringify({ world: options.world, start: options.start, targets: options.targets }), before);
  assert.deepEqual(first, second);
  const digest = createHash('sha256').update(JSON.stringify(first)).digest('hex');
  options.targets[0].x = 990;
  assert.equal(createHash('sha256').update(JSON.stringify(first)).digest('hex'), digest);
});

// Tiny schemas keep these two independent review REDs below any heavy grid.
const tiny = () => ({ world: { bounds: { minX: 0, minY: 0, maxX: 60, maxY: 60 }, collisionBlockers: [] },
  queryGround: flat, start: { x: 30, y: 30 }, targets: [{ id: 'site', kind: 'area', x: 30, y: 30 }] });
test('target labels cannot alias nested author input', () => {
  const options = tiny(); options.targets[0].kind = { label: 'secret' };
  assert.throws(() => inspect(options), /kind.*string/);
});
test('bounds retain exactly the four numeric coordinates and detach extra author metadata', () => {
  const options = tiny(); options.world.bounds.author = { name: 'draft' };
  const report = inspect(options);
  assert.deepEqual(Object.keys(report.bounds), ['minX', 'minY', 'maxX', 'maxY']);
  options.world.bounds.author.name = 'changed';
  assert.equal(Object.hasOwn(report.bounds, 'author'), false);
});
test('outside starts and invalid bounds cannot pass the checker', () => {
  const outside = inspect(fixture({ start: { x: 1230, y: 90 } }));
  assert.equal(outside.passed, false); assert.ok(outside.issues.some(issue => issue.code === 'OUTSIDE_START'));
  for (const broken of [{ minX: 0, minY: 0, maxX: Infinity, maxY: 60 }, { minX: 60, minY: 0, maxX: 0, maxY: 60 }]) {
    const options = tiny(); options.world.bounds = broken;
    assert.throws(() => inspect(options), /positive world bounds/);
  }
});
