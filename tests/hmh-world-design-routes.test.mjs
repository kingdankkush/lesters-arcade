import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath } from '../apps/hmh-reboot/src/elevation.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';

const queryGround = createLevelOneGroundQuery();
const nodes = new Map(world.routeGraph.nodes.map(row => [row.id, row]));
const body = createCollisionBody({ id: 'world-route-actor', kind: 'player', radius: world.player.radius, minZ: 0, maxZ: 42 });

function walk(start, end, label) {
  let current = { x: start.x, y: start.y };
  const ticks = Math.ceil(Math.hypot(end.x-start.x,end.y-start.y) / (world.player.maxSpeed / 60));
  for (let tick = 1; tick <= ticks; tick++) {
    const target = { x: start.x + (end.x-start.x)*tick/ticks, y: start.y+(end.y-start.y)*tick/ticks };
    const collision = resolveSweptCircleMotion({ body, start: { ...current, z: queryGround(current.x,current.y).groundZ }, delta: { x: target.x-current.x, y: target.y-current.y }, blockers: world.collisionBlockers, bounds: world.bounds });
    assert.equal(collision.depenetrations.length, 0, `${label}: starts in ${collision.depenetrations[0]?.blockerId}`);
    assert.equal(collision.contacts.length, 0, `${label}: hits ${collision.contacts[0]?.blockerId}`);
    assert.ok(Math.hypot(collision.position.x-target.x,collision.position.y-target.y) < 1e-6, `${label}: failed to reach requested position`);
    const traversal = resolveSweptTraversalPath({ start: current, end: collision.position, queryGround, maxSampleDistance: world.player.radius / 6 });
    assert.ok(traversal.allowed, `${label}: ${traversal.reason} at ${current.x.toFixed(2)}, ${current.y.toFixed(2)}`);
    current = traversal.position;
  }
  assert.ok(Math.hypot(current.x-end.x,current.y-end.y) < 1e-6, `${label}: endpoint not reached`);
}

for (const route of world.routes) {
  test(`${route.id}: radius-24 actor traverses every authored segment at fixed-step walking distance`, () => {
    for (let i = 1; i < route.nodeIds.length; i++) {
      walk(nodes.get(route.nodeIds[i-1]), nodes.get(route.nodeIds[i]), `${route.id}: ${route.nodeIds[i-1]} -> ${route.nodeIds[i]}`);
    }
  });
}

for (const crossing of world.crossings) {
  test(`${crossing.id}: entry and exit remain traversable in both directions`, () => {
    walk(crossing.entry, crossing.exit, `${crossing.id}: outward`);
    walk(crossing.exit, crossing.entry, `${crossing.id}: return`);
  });
}
