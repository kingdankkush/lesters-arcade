import assert from 'node:assert/strict';
import test from 'node:test';

import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import {
  LEVEL_ONE_PLAYER_RADIUS,
  LEVEL_ONE_WORLD,
  createLevelOneGroundQuery,
  getLevelOneRouteLength,
} from '../apps/hmh-reboot/src/level-one-world.mjs';

// Owner playtest 2026-07-31: the level read as colored bands with scattered
// props, not as places. These invariants encode the MAP-REDO-BRIEF slice 1
// composition bar: every district is a composed place with interior structure,
// the main route winds instead of running flat, seams read as gates, and
// arenas carry cover. They are measured against the authored world contract
// so collision/elevation stay authoritative and projection follows.

const INTERIOR_MIN_Y = 1_000;
const INTERIOR_MAX_Y = 3_800;
const SUPPORTED_BLOCKER_KINDS = new Set(['fence', 'cliff', 'bridge-rail', 'dense-trees', 'machinery', 'building', 'containers']);
const RECOVERY_HOOKS = new Set(['reward', 'upgrade', 'weapon']);

function blockerFootprint(blocker) {
  const shape = blocker.shape;
  if (shape.type === 'capsule') {
    return {
      minX: Math.min(shape.a.x, shape.b.x) - shape.radius,
      maxX: Math.max(shape.a.x, shape.b.x) + shape.radius,
      minY: Math.min(shape.a.y, shape.b.y) - shape.radius,
      maxY: Math.max(shape.a.y, shape.b.y) + shape.radius,
    };
  }
  if (shape.type === 'circle') {
    return { minX: shape.x - shape.radius, maxX: shape.x + shape.radius, minY: shape.y - shape.radius, maxY: shape.y + shape.radius };
  }
  const xs = shape.vertices.map((vertex) => vertex.x);
  const ys = shape.vertices.map((vertex) => vertex.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function footprintCenter(footprint) {
  return { x: (footprint.minX + footprint.maxX) / 2, y: (footprint.minY + footprint.maxY) / 2 };
}

function mainRouteNodes() {
  const byId = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
  const route = LEVEL_ONE_WORLD.routes.find((candidate) => candidate.kind === 'main');
  return route.nodeIds.map((id) => byId.get(id));
}

function mainRouteYAt(x) {
  const nodes = mainRouteNodes();
  for (let index = 1; index < nodes.length; index += 1) {
    const from = nodes[index - 1];
    const to = nodes[index];
    const minX = Math.min(from.x, to.x);
    const maxX = Math.max(from.x, to.x);
    if (x < minX || x > maxX || minX === maxX) continue;
    const t = (x - from.x) / (to.x - from.x);
    if (t < 0 || t > 1) continue;
    return from.y + t * (to.y - from.y);
  }
  const nearest = [...nodes].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  return nearest.y;
}

test('every blocker uses a production-supported visual kind', () => {
  for (const blocker of LEVEL_ONE_WORLD.blockers) {
    assert.ok(SUPPORTED_BLOCKER_KINDS.has(blocker.visualKind), `blocker ${blocker.id} uses unsupported visualKind ${blocker.visualKind}`);
  }
});

test('every district composes interior structure instead of edge framing', () => {
  for (const district of LEVEL_ONE_WORLD.districts) {
    const interior = LEVEL_ONE_WORLD.blockers.filter((blocker) => {
      const footprint = blockerFootprint(blocker);
      return footprint.minX >= district.area.minX
        && footprint.maxX <= district.area.maxX
        && footprint.minY >= INTERIOR_MIN_Y
        && footprint.maxY <= INTERIOR_MAX_Y;
    });
    assert.ok(interior.length >= 3, `district ${district.id} has ${interior.length} interior blockers; a composed place needs at least 3`);
  }
});

test('the world carries enough authored structure to read as places', () => {
  assert.ok(LEVEL_ONE_WORLD.blockers.length >= 26, `only ${LEVEL_ONE_WORLD.blockers.length} blockers authored; composition floor is 26`);
});

test('the main route winds through the terrain instead of running flat', () => {
  const nodes = mainRouteNodes();
  const distinctY = new Set(nodes.map((node) => node.y));
  assert.ok(distinctY.size >= 7, `main route has ${distinctY.size} distinct y values; a winding route needs at least 7`);
  const first = nodes[0];
  const last = nodes.at(-1);
  const straight = Math.hypot(last.x - first.x, last.y - first.y);
  const length = getLevelOneRouteLength('main-route');
  assert.ok(length >= straight * 1.08, `main route length ${Math.round(length)} is under 1.08x the straight line ${Math.round(straight)}`);
});

test('district seams read as gates with structure on both sides of the route', () => {
  for (const seam of LEVEL_ONE_WORLD.seams) {
    const routeY = mainRouteYAt(seam.x);
    const near = LEVEL_ONE_WORLD.blockers
      .map((blocker) => ({ blocker, footprint: blockerFootprint(blocker) }))
      .filter(({ footprint }) => {
        const center = footprintCenter(footprint);
        return Math.abs(center.x - seam.x) <= 420;
      });
    const north = near.filter(({ footprint }) => footprint.maxY < routeY);
    const south = near.filter(({ footprint }) => footprint.minY > routeY);
    assert.ok(north.length >= 1, `seam ${seam.id} has no gate structure north of the route`);
    assert.ok(south.length >= 1, `seam ${seam.id} has no gate structure south of the route`);
    const northEdge = Math.max(...north.map(({ footprint }) => footprint.maxY));
    const southEdge = Math.min(...south.map(({ footprint }) => footprint.minY));
    const gap = southEdge - northEdge;
    assert.ok(gap >= seam.clearWidth + 60, `seam ${seam.id} gate gap ${Math.round(gap)} is tighter than clearance`);
    assert.ok(gap <= 1_200, `seam ${seam.id} gate gap ${Math.round(gap)} is too wide to read as a gate`);
  }
});

test('every encounter arena has combat cover in or beside the fight space', () => {
  for (const arena of LEVEL_ONE_WORLD.encounterArenas) {
    const covered = LEVEL_ONE_WORLD.blockers.some((blocker) => {
      const collisionBlocker = LEVEL_ONE_WORLD.collisionBlockers.find((candidate) => candidate.id === blocker.collisionBlockerId);
      if (!collisionBlocker?.combatCover) return false;
      const center = footprintCenter(blockerFootprint(blocker));
      return Math.hypot(center.x - arena.anchor.x, center.y - arena.anchor.y) <= arena.radius + 240;
    });
    assert.ok(covered, `arena ${arena.id} has no combat cover within reach of the fight`);
  }
});

test('every loop-route segment is traversable through canonical collision', () => {
  // The main route is swept in hmh-reboot-level-one-world.test.mjs. Loops are
  // drawn as full-width roads and minimap paths, so a blocker severing a loop
  // corridor is a world-contract defect even though nothing forces the player
  // down it. Cycle 041 review caught exactly that class of bug.
  const body = createCollisionBody({ id: 'loop-probe', kind: 'player', radius: LEVEL_ONE_PLAYER_RADIUS, minZ: 0, maxZ: 42 });
  const queryGround = createLevelOneGroundQuery();
  const nodes = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
  for (const route of LEVEL_ONE_WORLD.routes.filter((candidate) => candidate.kind === 'loop')) {
    for (let index = 1; index < route.nodeIds.length; index += 1) {
      const start = nodes.get(route.nodeIds[index - 1]);
      const end = nodes.get(route.nodeIds[index]);
      const collision = resolveSweptCircleMotion({
        body,
        start: { ...start, z: queryGround(start.x, start.y).groundZ },
        delta: { x: end.x - start.x, y: end.y - start.y },
        blockers: LEVEL_ONE_WORLD.collisionBlockers,
        bounds: LEVEL_ONE_WORLD.bounds,
      });
      assert.equal(collision.contacts.length, 0, `${route.id} ${start.id} -> ${end.id} hit ${collision.contacts[0]?.blockerId}`);
    }
  }
});

test('every district keeps a complete place kit: landmark, arena, recovery pocket', () => {
  for (const district of LEVEL_ONE_WORLD.districts) {
    const landmark = LEVEL_ONE_WORLD.landmarks.some((candidate) => candidate.districtId === district.id);
    const arena = LEVEL_ONE_WORLD.encounterArenas.some((candidate) => candidate.districtId === district.id);
    const recovery = LEVEL_ONE_WORLD.pointsOfInterest.some((candidate) => candidate.districtId === district.id && RECOVERY_HOOKS.has(candidate.hook));
    assert.ok(landmark, `district ${district.id} has no landmark`);
    assert.ok(arena, `district ${district.id} has no encounter arena`);
    assert.ok(recovery, `district ${district.id} has no recovery pocket`);
  }
});
