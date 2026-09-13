import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_ONE_ENTRIES, selectLevelEntry } from '../apps/hmh-reboot/src/level-entry.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery, LEVEL_ONE_PLAYER_RADIUS, LEVEL_ONE_PROTECTED_SPAWN_RADIUS } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { WORLD_DESIGN_PROP_BLOCKERS } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { WORLD_DESIGN_SECRET_SEAL } from '../apps/hmh-reboot/src/world-design-secrets.mjs';
import { AUTHORED_SETPIECE_ANCHORS } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { validateEncounterSpawn, directorViewBounds } from '../apps/hmh-reboot/src/encounter-director.mjs';

test('five entries vary by seed and replay the same start without consuming RNG', () => {
  assert.equal(LEVEL_ONE_ENTRIES.length, 5);
  const counts = new Map();
  for (let seed = 0; seed < 1000; seed++) {
    const entry = selectLevelEntry(seed);
    assert.deepEqual(selectLevelEntry(seed), entry);
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  assert.equal(counts.size, 5);
  for (const count of counts.values()) assert.ok(count > 120 && count < 280);
});

test('each entry and its opening opponents stand on walkable ground with room to leave', () => {
  const queryGround = createLevelOneGroundQuery();
  const body = createCollisionBody({id:'entry-test',radius:24,minZ:0,maxZ:72});
  for (const entry of LEVEL_ONE_ENTRIES) {
    for (const offset of [{x:0,y:0},{x:320,y:0},{x:60,y:-350}]) {
      const point = {x:entry.x+offset.x,y:entry.y+offset.y};
      const ground = queryGround(point.x,point.y);
      assert.equal(ground.walkable,true,`${entry.id} ${JSON.stringify(offset)} is walkable`);
      let exits = 0;
      for (const [x,y] of [[96,0],[-96,0],[0,96],[0,-96]]) {
        const result = resolveSweptCircleMotion({body,start:{...point,z:ground.groundZ},delta:{x,y},blockers:LEVEL_ONE_WORLD.collisionBlockers});
        if (Math.hypot(result.position.x-point.x,result.position.y-point.y)>90) exits++;
      }
      assert.ok(exits>=2,`${entry.id} ${JSON.stringify(offset)} has ${exits} clear exits`);
    }
  }
});

// --- Spawn-safety coverage for the five randomized insertion points ---------
// The owner asked for four or five randomized starts verified for clearance,
// nearby threats and comparable opening opportunity. These assertions prove
// each authored entry against the same world data and director rules the
// runtime uses, so a moved landmark, prop or blocker fails here first.

const ENTRY_BLOCKERS = [...LEVEL_ONE_WORLD.collisionBlockers, ...WORLD_DESIGN_PROP_BLOCKERS, WORLD_DESIGN_SECRET_SEAL];

function pointToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

function insidePolygon(point, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Mirrors the runtime's spawnPointBlocked margin (player radius + 24) so an
// entry is rejected exactly where a director spawn would be.
function blockerClearance(point, blocker) {
  const shape = blocker.shape;
  if (shape.type === 'circle') return Math.hypot(point.x - shape.x, point.y - shape.y) - shape.radius;
  if (shape.type === 'capsule') return pointToSegment(point, shape.a, shape.b) - shape.radius;
  if (shape.type === 'polygon') {
    if (insidePolygon(point, shape.vertices)) return -Infinity;
    let nearest = Infinity;
    for (let i = 0; i < shape.vertices.length; i++) nearest = Math.min(nearest, pointToSegment(point, shape.vertices[i], shape.vertices[(i + 1) % shape.vertices.length]));
    return nearest;
  }
  throw new TypeError(`unhandled blocker shape ${shape.type}`);
}

test('no insertion point sits inside or against a collision blocker, landmark or set piece', () => {
  const margin = LEVEL_ONE_PLAYER_RADIUS + 24;
  for (const entry of LEVEL_ONE_ENTRIES) {
    for (const blocker of ENTRY_BLOCKERS) {
      const clearance = blockerClearance(entry, blocker);
      assert.ok(clearance > margin, `${entry.id} is ${Math.round(clearance)} from blocker ${blocker.id} (needs > ${margin})`);
    }
    for (const landmark of LEVEL_ONE_WORLD.landmarks) {
      const distance = Math.hypot(landmark.anchor.x - entry.x, landmark.anchor.y - entry.y);
      assert.ok(distance >= 200, `${entry.id} is ${Math.round(distance)} from landmark ${landmark.id}`);
    }
    for (const setpiece of AUTHORED_SETPIECE_ANCHORS) {
      // The relay tower is authored 150 north of the relay start on purpose
      // (it looms behind the hero); anything closer would sit inside the
      // route's 48-unit margin, so 120 is the floor for every entry.
      const distance = Math.hypot(setpiece.x - entry.x, setpiece.y - entry.y);
      assert.ok(distance >= 120, `${entry.id} is ${Math.round(distance)} from set piece ${setpiece.id}`);
    }
  }
});

test('every insertion point lies on the main route and inside its own district', () => {
  const nodes = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
  const mainEdges = LEVEL_ONE_WORLD.routeGraph.edges.filter((edge) => edge.routeId === 'main-route');
  assert.ok(mainEdges.length > 10);
  for (const entry of LEVEL_ONE_ENTRIES) {
    const nearest = Math.min(...mainEdges.map((edge) => pointToSegment(entry, nodes.get(edge.from), nodes.get(edge.to))));
    assert.ok(nearest <= LEVEL_ONE_WORLD.routeClearance.main, `${entry.id} is ${Math.round(nearest)} from the main route`);
    const district = LEVEL_ONE_WORLD.districts.find((item) => entry.x >= item.area.minX && entry.x <= item.area.maxX && entry.y >= item.area.minY && entry.y <= item.area.maxY);
    assert.ok(district, `${entry.id} has a district`);
    assert.equal(LEVEL_ONE_WORLD.spawnPoints.filter((point) => point.districtId === district.id && point.routeValid).length, 2, `${district.id} keeps two route-valid spawn points`);
  }
});

test('the encounter director can open a fight from every insertion point on comparable terms', () => {
  const queryGround = createLevelOneGroundQuery();
  const isBlocked = (point) => ENTRY_BLOCKERS.some((blocker) => blockerClearance(point, blocker) <= 24);
  const isRouteReachable = (point) => point.routeValid === true;
  const distances = [];
  for (const entry of LEVEL_ONE_ENTRIES) {
    const district = LEVEL_ONE_WORLD.districts.find((item) => entry.x >= item.area.minX && entry.x <= item.area.maxX);
    const player = { x: entry.x, y: entry.y, groundZ: queryGround(entry.x, entry.y).groundZ };
    const camera = directorViewBounds(entry);
    const verdicts = LEVEL_ONE_WORLD.spawnPoints
      .filter((point) => point.districtId === district.id)
      .map((point) => ({ point, verdict: validateEncounterSpawn({ point, districtId: district.id, player, camera, queryGround, isBlocked, isRouteReachable }) }));
    const allowed = verdicts.filter(({ verdict }) => verdict.allowed);
    assert.ok(allowed.length >= 1, `${entry.id}: no district spawn is allowed: ${JSON.stringify(verdicts.map(({ point, verdict }) => [point.id, verdict.reason]))}`);
    for (const { point, verdict } of verdicts) {
      assert.notEqual(verdict.reason, 'on-camera', `${entry.id}: ${point.id} would spawn in view`);
      assert.notEqual(verdict.reason, 'protected-hero-radius', `${entry.id}: ${point.id} would spawn on the hero`);
    }
    const nearest = Math.min(...allowed.map(({ point }) => Math.hypot(point.x - entry.x, point.y - entry.y)));
    assert.ok(nearest >= LEVEL_ONE_PROTECTED_SPAWN_RADIUS, `${entry.id}: nearest opening spawn ${Math.round(nearest)} is inside the protected radius`);
    distances.push({ id: entry.id, nearest });
  }
  // Comparable opening opportunity: the first wave arrives from a similar
  // distance whichever start the seed picks (no entry is a free ambush or a
  // long empty walk). Measured 2026-09-11: relay 1,970, ravine 1,404,
  // hashwood 1,412, mining 1,201, yard 1,304 units; the relay start (the
  // training-yard tutorial approach) is the long end of that band.
  for (const { id, nearest } of distances) assert.ok(nearest <= 2200, `${id}: opening spawn ${Math.round(nearest)} is a long empty walk`);
  const spread = Math.max(...distances.map((d) => d.nearest)) / Math.min(...distances.map((d) => d.nearest));
  assert.ok(spread <= 1.75, `opening spawn distance spread ${spread.toFixed(2)}: ${JSON.stringify(distances)}`);
});
