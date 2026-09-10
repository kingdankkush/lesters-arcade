import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';

function assertClearDisc(center, radius, label) {
  const body = createCollisionBody({ id: label, kind: 'player', radius, minZ: 0, maxZ: 42 });
  for (const blocker of world.collisionBlockers) {
    const result = resolveSweptCircleMotion({ body, start: { ...center, z: 0 }, delta: { x: 0, y: 0 }, blockers: [blocker] });
    assert.equal(result.depenetrations.length, 0, `${label} intersects ${blocker.id}`);
  }
}

test('opening retains canonical spawn, actor size and ordered six-district progression', () => {
  assert.deepEqual(world.player, { maxSpeed: 240, radius: 24, spawn: { x: 800, y: 2400 }, protectedSpawnRadius: 560 });
  assert.equal(world.id, 'forked-frontier');
  assert.equal(world.version, 1);
  assert.deepEqual(world.districts.map(row => row.id), ['frontier-relay','rugpull-ravine','liquidity-crossing','hashwood','mining-camp','liquidation-yard']);
  assert.equal(world.bounds.maxX, 12000);
  assert.equal(world.bounds.maxY, 4800);
});

test('whole encounter circles clear the protected spawn disc with one actor radius to spare', () => {
  for (const arena of world.encounterArenas) {
    const clearance = Math.hypot(arena.anchor.x - world.player.spawn.x, arena.anchor.y - world.player.spawn.y)
      - arena.radius - world.player.protectedSpawnRadius;
    assert.ok(clearance >= world.player.radius, `${arena.id}: footprint clearance ${clearance.toFixed(3)} < ${world.player.radius}`);
  }
});

test('solid footprints leave the entire protected opening and its actor-radius margin clear', () => {
  assertClearDisc(world.player.spawn, world.player.protectedSpawnRadius + world.player.radius, 'spawn-disc');
});

test('the opening contains a visible abandoned home and wreck outside its fighting floor', () => {
  for (const id of ['relay-abandoned-farmhouse','relay-abandoned-pickup']) {
    const feature = world.blockers.find(row => row.id === id);
    assert.ok(feature, `${id} establishes a deliberate settlement landmark`);
    assert.equal(feature.districtId, 'frontier-relay');
    const solid = world.collisionBlockers.find(row => row.id === id);
    assert.ok(solid?.solid);
    assert.ok(world.visibleBarriers.some(row => row.id === solid.visibleAssetId && row.collisionBlockerIds.includes(id)));
  }
  const arena = world.encounterArenas.find(row => row.id === 'relay-training-yard');
  assert.equal(arena.radius, 360, 'retain the existing combat floor size');
  assertClearDisc(arena.anchor, arena.radius + world.player.radius, 'training-floor');
});

test('opening side opportunities connect to the orientation loop without collision or elevation tricks', () => {
  const queryGround = createLevelOneGroundQuery();
  const nodes = new Map(world.routeGraph.nodes.map(row => [row.id, row]));
  const poi = new Map(world.pointsOfInterest.map(row => [row.id, row.anchor]));
  const arena = world.encounterArenas.find(row => row.id === 'relay-training-yard');
  const legs = [[nodes.get('relay-loop-north'), poi.get('relay-armory')], [nodes.get('relay-loop-south'), poi.get('relay-cache')], [nodes.get('relay-loop-south'), arena.anchor]];
  const body = createCollisionBody({ id: 'opening-side-route', kind: 'player', radius: 24, minZ: 0, maxZ: 42 });
  for (const [a, b] of legs) for (const [start, end] of [[a,b],[b,a]]) {
    const collision = resolveSweptCircleMotion({ body, start: { ...start, z: 0 }, delta: { x: end.x-start.x, y: end.y-start.y }, blockers: world.collisionBlockers, bounds: world.bounds });
    assert.equal(collision.contacts.length, 0);
    assert.equal(collision.depenetrations.length, 0);
    assert.ok(Math.hypot(collision.position.x-end.x,collision.position.y-end.y) < 1e-6);
    assert.ok(resolveSweptTraversalPath({ start, end, queryGround, maxSampleDistance: 4 }).allowed);
  }
});
