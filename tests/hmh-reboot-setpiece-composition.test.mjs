import test from 'node:test';
import assert from 'node:assert/strict';
import * as atlas from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

const {
  buildAuthoredDistrictLandmarkPlacements,
  buildAuthoredEncampmentPlacements,
  resolveAuthoredLandmarkSignal,
  AUTHORED_CAMP_KIT,
  AUTHORED_TOWN_EXCLUSIONS,
} = atlas;

// W-6 (Cycle 074). Measured on the Cycle 073 layout: five of the six
// set-piece anchors stood on a route corridor or inside a blocker (the relay
// tower 20 units from the player spawn and 76 inside main-route:0, so the
// hero spawned between its legs; the yard tower 50 units inside the
// town-north-tenement polygon), and 11 of 36 satellites sat inside a route
// or blocker. The six fixed +-350/+-420 offsets put every satellite OUTSIDE
// the 300-unit breathing ring, so a "set-piece" was one sprite with six
// unrelated props 500 units away. A set-piece is now composed: anchor plus
// four to seven satellites inside the ring, every one clear of the world
// contract's geometry, deterministic from the world constant.
//
// The geometry here is written independently of the module so the module
// cannot pass by agreeing with itself.

const build = () => buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function pointInPolygon(px, py, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function shapeClearance(shape, x, y) {
  if (shape.type === 'circle') return Math.hypot(x - shape.x, y - shape.y) - shape.radius;
  if (shape.type === 'capsule') return segmentDistance(x, y, shape.a.x, shape.a.y, shape.b.x, shape.b.y) - shape.radius;
  let edge = Infinity;
  for (let i = 0; i < shape.vertices.length; i += 1) {
    const a = shape.vertices[i];
    const b = shape.vertices[(i + 1) % shape.vertices.length];
    edge = Math.min(edge, segmentDistance(x, y, a.x, a.y, b.x, b.y));
  }
  return pointInPolygon(x, y, shape.vertices) ? -edge : edge;
}
const ROUTE_NODES = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
function routeClearance(x, y) {
  let best = Infinity;
  for (const edge of LEVEL_ONE_WORLD.routeGraph.edges) {
    const a = ROUTE_NODES.get(edge.from);
    const b = ROUTE_NODES.get(edge.to);
    best = Math.min(best, segmentDistance(x, y, a.x, a.y, b.x, b.y) - edge.width / 2);
  }
  return best;
}
const river = LEVEL_ONE_WORLD.surfaces.find((surface) => surface.id === 'liquidity-river').area;
const shallows = LEVEL_ONE_WORLD.surfaces.find((surface) => surface.id === 'crossing-shallows').area;
const inArea = (area, x, y) => x >= area.minX && x <= area.maxX && y >= area.minY && y <= area.maxY;

// Every exclusion the dressing generator honours, plus a wider route margin:
// a satellite scaled 1.4-1.9 has a wider base than a dressing prop, so it
// keeps a full player radius off the road edge.
function offences(p, { routeMargin }) {
  const found = [];
  for (const blocker of LEVEL_ONE_WORLD.collisionBlockers) {
    const clearance = shapeClearance(blocker.shape, p.x, p.y);
    if (clearance < 24) found.push(`${p.id} is ${Math.round(clearance)} from ${blocker.id}`);
  }
  const route = routeClearance(p.x, p.y);
  if (route < routeMargin) found.push(`${p.id} is ${Math.round(route)} from a route edge (needs ${routeMargin})`);
  if (inArea(river, p.x, p.y) && !inArea(shallows, p.x, p.y)) found.push(`${p.id} stands in deep water`);
  for (const arena of LEVEL_ONE_WORLD.encounterArenas) {
    if (Math.hypot(p.x - arena.anchor.x, p.y - arena.anchor.y) < arena.radius) found.push(`${p.id} is on ${arena.id}`);
  }
  for (const camp of AUTHORED_CAMP_KIT) {
    const distance = Math.hypot(p.x - camp.x, p.y - camp.y);
    if (distance < camp.radius + 60) found.push(`${p.id} is ${Math.round(distance)} from ${camp.id}`);
  }
  for (const point of LEVEL_ONE_WORLD.pointsOfInterest) {
    if (Math.hypot(p.x - point.anchor.x, p.y - point.anchor.y) < 80) found.push(`${p.id} stands on ${point.id}`);
  }
  for (const [tx, ty] of AUTHORED_TOWN_EXCLUSIONS) {
    if (Math.hypot(p.x - tx, p.y - ty) < 80) found.push(`${p.id} stands in a town prop's stack at ${tx},${ty}`);
  }
  if (p.x < 40 || p.x > 11_960 || p.y < 40 || p.y > 4_760) found.push(`${p.id} hangs off the world edge`);
  return found;
}

const SETPIECE_IDS = new Map([
  ['frontier-relay', 'relay-tower-setpiece'],
  ['rugpull-ravine', 'forked-spire-setpiece'],
  ['liquidity-crossing', 'proof-bridge-setpiece'],
  ['hashwood', 'hashwood-beacon-setpiece'],
  ['mining-camp', 'mining-headframe-setpiece'],
  ['liquidation-yard', 'liquidation-tower-setpiece'],
]);
// Count lock: 6 anchors + [6, 5, 7, 5, 6, 6] satellites. Deliberate, not
// derived, so a composition that silently drops a satellite fails loudly.
const SATELLITE_COUNTS = { 'frontier-relay': 6, 'rugpull-ravine': 5, 'liquidity-crossing': 7, hashwood: 5, 'mining-camp': 6, 'liquidation-yard': 6 };
const anchorsOf = (placements) => placements.filter((p) => p.anchorDistance === 0);

test('W-6 exactly six anchors, one per district, each on open ground clear of every exclusion', () => {
  const anchors = anchorsOf(build());
  assert.equal(anchors.length, 6);
  assert.deepEqual(new Set(anchors.map((p) => p.districtId)).size, 6);
  const offenders = [];
  for (const anchor of anchors) {
    assert.equal(anchor.assetId, SETPIECE_IDS.get(anchor.districtId), `${anchor.districtId} anchors the wrong set-piece`);
    assert.equal(anchor.scale, 1);
    // A set-piece frame is 118-202 px wide at runtime scale 1.7-1.85; half of
    // that plus a prop base is what keeps its legs off a wall or a road.
    offenders.push(...offences(anchor, { routeMargin: 48 }));
  }
  assert.deepEqual(offenders, [], `${offenders.length} anchor defects`);
});

test('W-6 every satellite sits inside the breathing ring, clear of the world, and off its neighbours', () => {
  const placements = build();
  const anchors = new Map(anchorsOf(placements).map((p) => [p.districtId, p]));
  const offenders = [];
  for (const [districtId, expected] of Object.entries(SATELLITE_COUNTS)) {
    const satellites = placements.filter((p) => p.districtId === districtId && p.anchorDistance > 0);
    assert.equal(satellites.length, expected, `${districtId} satellite count`);
    const anchor = anchors.get(districtId);
    for (const p of satellites) {
      const reach = Math.hypot(p.x - anchor.x, p.y - anchor.y);
      assert.ok(Math.abs(reach - p.anchorDistance) < 0.01, `${p.id} misreports its anchor distance`);
      assert.ok(reach >= 100 && reach <= 270, `${p.id} sits ${Math.round(reach)} from its anchor; the composed band is 100-270`);
      assert.ok(p.scale >= 1.4 && p.scale <= 1.9, `${p.id} scale ${p.scale}`);
      assert.equal(p.category, 'district-landmark');
      assert.equal(p.mobileOnly, false);
      assert.equal(p.runtimeAuthority, 'projection-only');
      offenders.push(...offences(p, { routeMargin: 48 }));
    }
    for (let i = 0; i < satellites.length; i += 1) {
      for (let j = i + 1; j < satellites.length; j += 1) {
        const distance = Math.hypot(satellites[i].x - satellites[j].x, satellites[i].y - satellites[j].y);
        if (distance < 48) offenders.push(`${satellites[i].id} and ${satellites[j].id} share a base (${Math.round(distance)})`);
      }
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} satellite defects`);
});

test('W-6 the composition is deterministic and count-locked at 41', () => {
  assert.deepEqual(build(), build());
  const placements = build();
  assert.equal(placements.length, 41);
  assert.equal(atlas.AUTHORED_LANDMARK_TOTAL, 41, 'the count lock is exported so the display tests share one source');
  assert.equal(new Set(placements.map((p) => p.id)).size, 41);
  assert.ok(Object.isFrozen(placements));
});

test('W-6 every district keeps at least two animated signal-kit satellites', () => {
  const placements = build();
  for (const districtId of SETPIECE_IDS.keys()) {
    const signaled = placements.filter((p) => p.districtId === districtId && p.anchorDistance > 0 && resolveAuthoredLandmarkSignal({ placement: p, tick: 0 }) !== null);
    assert.ok(signaled.length >= 2, `${districtId} has ${signaled.length} signal-kit satellites; the visual gate's animated floor needs two so one is always on camera`);
  }
});

// The pinned scene cameras (scripts/hmh-reboot-visual-regression.mjs) gate
// >= 3 landmark placements and >= 1 animated signal on the desktop district
// scenes, >= 1 landmark on the mobile opening frame. Zoom 1: 1440x900 desktop,
// 390x844 portrait, and the on-screen test in the display is strict.
const SIGNAL_KITS = new Set(['relay-console', 'proof-pylon', 'warning-beacon', 'crystal-cluster', 'liquidation-terminal']);
test('W-6 every pinned scene window keeps the visual gate floors', () => {
  const placements = build();
  const windows = {
    'frontier-relay-desktop': [800, 2_400, 720, 450, 3, 1],
    'frontier-relay-mobile': [800, 2_400, 195, 422, 1, 0],
    'ravine-overlook-desktop': [3_050, 1_350, 720, 450, 3, 1],
    'liquidity-bridge-desktop': [4_700, 2_400, 720, 450, 3, 1],
    'hashwood-foliage-desktop': [7_000, 900, 720, 450, 3, 1],
    'mining-camp-desktop': [9_200, 1_420, 720, 450, 3, 1],
    'liquidation-yard-desktop': [11_000, 800, 720, 450, 3, 1],
  };
  for (const [scene, [cx, cy, hw, hh, landmarks, animated]] of Object.entries(windows)) {
    const seen = placements.filter((p) => Math.abs(p.x - cx) <= hw && Math.abs(p.y - cy) <= hh);
    assert.ok(seen.length >= landmarks, `${scene} sees ${seen.length} landmark placements; the gate needs ${landmarks}`);
    const signals = seen.filter((p) => SIGNAL_KITS.has(p.assetId)).length;
    assert.ok(signals >= animated, `${scene} sees ${signals} animated signals; the gate needs ${animated}`);
  }
});

// Where a set-piece can honestly stand where the world contract puts its
// landmark it does; the two exceptions are pinned by id so a later drift is
// loud rather than silent. Relay: the contract anchor (1,350, 1,300) empties
// the opening frame, so the tower stands 150 north of the spawn, looming
// behind the hero; the route's 48 margin forbids anything closer. Hashwood:
// the contract beacon (7,000, 2,000) is on the main route inside the
// clearing arena.
test('W-6 anchors track the world contract landmarks except the two documented exceptions', () => {
  const anchors = new Map(anchorsOf(build()).map((p) => [p.districtId, p]));
  const contract = new Map(LEVEL_ONE_WORLD.landmarks.map((landmark) => [landmark.districtId, landmark.anchor]));
  for (const districtId of ['rugpull-ravine', 'mining-camp', 'liquidation-yard']) {
    const anchor = anchors.get(districtId);
    assert.deepEqual([anchor.x, anchor.y], [contract.get(districtId).x, contract.get(districtId).y], `${districtId} set-piece must stand on the contract landmark`);
  }
  assert.deepEqual([anchors.get('frontier-relay').x, anchors.get('frontier-relay').y], [800, 2_250]);
  assert.deepEqual([anchors.get('hashwood').x, anchors.get('hashwood').y], [7_000, 900]);
  // The crossing truss cannot stand on the bridge deck (the contract anchor
  // is the deck centre), so it marks the east bridgehead.
  assert.deepEqual([anchors.get('liquidity-crossing').x, anchors.get('liquidity-crossing').y], [5_150, 2_150]);
  assert.deepEqual(
    atlas.AUTHORED_SETPIECE_ANCHORS.map((a) => [a.id, a.x, a.y]),
    [...anchors.values()].map((a) => [a.districtId, a.x, a.y]),
    'the exported anchor list (used by the decal bake) must be the composed anchors',
  );
});

test('W-6 the breathing ring keeps every camp prop out', () => {
  const anchors = anchorsOf(build());
  const camps = buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' });
  const offenders = [];
  for (const anchor of anchors) {
    for (const camp of camps) {
      if (Math.hypot(camp.x - anchor.x, camp.y - anchor.y) < 300) offenders.push(`${camp.id} crowds ${anchor.id}`);
    }
  }
  assert.deepEqual(offenders, []);
});
