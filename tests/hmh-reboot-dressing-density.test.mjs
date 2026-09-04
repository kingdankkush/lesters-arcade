import test from 'node:test';
import assert from 'node:assert/strict';
import * as atlas from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

const {
  buildAuthoredWorldPropPlacements,
  buildAuthoredDistrictLandmarkPlacements,
  buildAuthoredEncampmentPlacements,
  AUTHORED_DRESSING_DENSITY,
  AUTHORED_CAMP_KIT,
} = atlas;

// W1. Waves A1-A4 took the authored prop library from 26 world props to 49,
// but every one of those waves deliberately held district counts flat, so the
// world still placed 75 dressing items. This is where the library actually
// gets used.
//
// Two changes: higher per-district counts, and clustered placement. Scattered
// singles read as noise however many you add -- the art direction's rule is
// anchor plus satellites, so a few visual groups rather than confetti.

const build = (seed = 0x484d4807) => buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed });

test('the density table is exported so counts are reviewable in one place', () => {
  assert.ok(AUTHORED_DRESSING_DENSITY, 'density table must be exported');
  const total = Object.values(AUTHORED_DRESSING_DENSITY).reduce((sum, count) => sum + count, 0);
  assert.equal(Object.keys(AUTHORED_DRESSING_DENSITY).length, 6);
  // W-7 (Cycle 073): 20+20+20+24+22+22 = 128 becomes 32+32+30+40+34+32 = 200.
  // Deliberate: the shoulder bands are 1,340 units deep and the landmark ring
  // plus anchor spacing leave no room for a blind 2x; the spawn camps add the
  // rest of the "roughly double" on top of this table.
  assert.equal(total, 200);
  assert.equal(AUTHORED_DRESSING_DENSITY.hashwood, Math.max(...Object.values(AUTHORED_DRESSING_DENSITY)), 'hashwood leads the map per the art direction');
});

// The runtime seed is a world constant, never the run seed and never
// Math.random. Exporting it means main.mjs and the tests share one source.
test('the dressing seed is exported as the world constant', () => {
  assert.equal(atlas.AUTHORED_DRESSING_SEED, 0x484d4807);
});

test('dressing density rises across every district', () => {
  const placements = build();
  const byDistrict = new Map();
  for (const placement of placements) {
    byDistrict.set(placement.districtId, (byDistrict.get(placement.districtId) ?? 0) + 1);
  }
  assert.equal(placements.length, 200);
  assert.equal(byDistrict.size, 6);
  for (const [districtId, count] of byDistrict) {
    assert.equal(count, AUTHORED_DRESSING_DENSITY[districtId], `${districtId} count`);
    // The placement helper caps a district at 40; going over it would silently
    // truncate rather than fail.
    assert.ok(count <= 40, `${districtId} exceeds the placement cap`);
  }
});

test('placement stays deterministic and inside world bounds', () => {
  assert.deepEqual(build(), build());
  const placements = build();
  assert.ok(placements.every((p) => p.x >= 0 && p.x <= 12_000 && p.y >= 0 && p.y <= 4_800));
  assert.equal(new Set(placements.map((p) => p.id)).size, placements.length);
  assert.ok(placements.every((p) => p.runtimeAuthority === 'projection-only'));
});

// The route runs through the middle of the map. Dressing has always lived
// toward the district shoulders to keep it readable; more dressing must not
// start creeping into the corridor.
test('denser dressing still clears the central route corridor', () => {
  const placements = build();
  const inCorridor = placements.filter((p) => p.y > 1_700 && p.y < 3_100);
  assert.equal(
    inCorridor.length,
    0,
    `${inCorridor.length} dressing placements sit in the central route corridor`,
  );
});

// Anchor-plus-satellite is the point of the pass. Every placement carries the
// cluster it belongs to, so the grouping is inspectable rather than implied.
test('dressing is composed into clusters, not scattered singles', () => {
  const placements = build();
  assert.ok(
    placements.every((p) => typeof p.clusterId === 'string' && p.clusterId.length > 0),
    'every placement must name its cluster',
  );
  const clusters = new Map();
  for (const placement of placements) {
    const members = clusters.get(placement.clusterId) ?? [];
    members.push(placement);
    clusters.set(placement.clusterId, members);
  }
  // Clusters of one are allowed -- a lone tree is legitimate -- but most
  // dressing has to be grouped or nothing has changed.
  const grouped = [...clusters.values()].filter((members) => members.length > 1);
  const groupedCount = grouped.reduce((sum, members) => sum + members.length, 0);
  assert.ok(
    groupedCount / placements.length >= 0.6,
    `only ${groupedCount}/${placements.length} placements are in a group`,
  );
  assert.ok(clusters.size >= 24, `only ${clusters.size} clusters across six districts`);
});

test('satellites sit close to their anchor', () => {
  const placements = build();
  const anchors = new Map();
  for (const placement of placements) {
    if (placement.clusterRole === 'anchor') anchors.set(placement.clusterId, placement);
  }
  assert.ok(anchors.size > 0, 'no anchors found');
  for (const placement of placements) {
    if (placement.clusterRole !== 'satellite') continue;
    const anchor = anchors.get(placement.clusterId);
    assert.ok(anchor, `satellite ${placement.id} has no anchor`);
    const distance = Math.hypot(placement.x - anchor.x, placement.y - anchor.y);
    // Close enough to read as one group at gameplay zoom, far enough not to
    // overlap into a single blob.
    assert.ok(distance >= 40 && distance <= 320, `${placement.id} sits ${Math.round(distance)} from its anchor`);
  }
});

test('every cluster has exactly one anchor', () => {
  const placements = build();
  const roles = new Map();
  for (const placement of placements) {
    const counts = roles.get(placement.clusterId) ?? { anchor: 0, satellite: 0 };
    counts[placement.clusterRole] += 1;
    roles.set(placement.clusterId, counts);
  }
  for (const [clusterId, counts] of roles) {
    assert.equal(counts.anchor, 1, `${clusterId} has ${counts.anchor} anchors`);
  }
});

test('clusters do not collapse a district onto one prop', () => {
  const placements = build();
  const byDistrict = new Map();
  for (const placement of placements) {
    const list = byDistrict.get(placement.districtId) ?? [];
    list.push(placement.assetId);
    byDistrict.set(placement.districtId, list);
  }
  for (const [districtId, assetIds] of byDistrict) {
    const distinct = new Set(assetIds).size;
    assert.ok(distinct >= 6, `${districtId} draws on only ${distinct} distinct props`);
  }
});

// ---------------------------------------------------------------------------
// W-7 generator exclusions (Cycle 073). Measured on the Cycle 072 production
// layout with the real modules: 15 dressing items sat strictly inside a
// collision-blocker footprint (27 within 24 units), 3 stood in the deep river
// column, 8 sat inside a set-piece's 300-unit breathing ring, 5 stood on a
// loop-route corridor, and 18 anchor pairs in one district were closer than
// 300 so their clusters merged into blobs. Each of those is a rule below.
// The geometry here is written independently of the module so the module
// cannot pass by agreeing with itself.
// ---------------------------------------------------------------------------

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

// Signed distance from a point to a collision shape: negative means inside.
function shapeClearance(shape, x, y) {
  if (shape.type === 'circle') return Math.hypot(x - shape.x, y - shape.y) - shape.radius;
  if (shape.type === 'capsule') return segmentDistance(x, y, shape.a.x, shape.a.y, shape.b.x, shape.b.y) - shape.radius;
  if (shape.type === 'polygon') {
    let edge = Infinity;
    const vertices = shape.vertices;
    for (let i = 0; i < vertices.length; i += 1) {
      const a = vertices[i];
      const b = vertices[(i + 1) % vertices.length];
      edge = Math.min(edge, segmentDistance(x, y, a.x, a.y, b.x, b.y));
    }
    return pointInPolygon(x, y, vertices) ? -edge : edge;
  }
  throw new Error(`unknown shape ${shape.type}`);
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

// A prop base is roughly the player's radius; 24 keeps a sprite's ground
// contact visibly outside a cliff, fence or wall it would otherwise clip.
const BLOCKER_CLEARANCE = 24;

test('dressing never stands inside or against a collision blocker', () => {
  const offenders = [];
  for (const placement of build()) {
    for (const blocker of LEVEL_ONE_WORLD.collisionBlockers) {
      const clearance = shapeClearance(blocker.shape, placement.x, placement.y);
      if (clearance < BLOCKER_CLEARANCE) offenders.push(`${placement.id} is ${Math.round(clearance)} from ${blocker.id}`);
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} dressing placements clip a blocker`);
});

test('dressing never stands in the deep river outside the shallows', () => {
  const river = LEVEL_ONE_WORLD.surfaces.find((surface) => surface.id === 'liquidity-river');
  const shallows = LEVEL_ONE_WORLD.surfaces.find((surface) => surface.id === 'crossing-shallows');
  assert.ok(river && shallows, 'world contract must still carry the river and the shallows');
  const inside = (area, p) => p.x >= area.minX && p.x <= area.maxX && p.y >= area.minY && p.y <= area.maxY;
  const offenders = build().filter((p) => inside(river.area, p) && !inside(shallows.area, p)).map((p) => p.id);
  assert.deepEqual(offenders, [], `${offenders.length} dressing placements stand in deep water`);
});

// ART-DIRECTION-GAMEWORLD.md: every set-piece breathes inside a ~300-unit
// dressing-free ring (Death's Door / Tunic negative space).
test('dressing leaves every set-piece its 300-unit breathing ring', () => {
  const setpieces = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' }).filter((p) => p.anchorDistance === 0);
  assert.equal(setpieces.length, 6);
  const offenders = [];
  for (const placement of build()) {
    for (const setpiece of setpieces) {
      const distance = Math.hypot(placement.x - setpiece.x, placement.y - setpiece.y);
      if (distance < 300) offenders.push(`${placement.id} is ${Math.round(distance)} from ${setpiece.id}`);
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} dressing placements crowd a set-piece`);
});

// Routes are surfaces the player runs on. A prop standing on one reads as a
// collision the player then walks through, and hides bullets. Every route
// edge, main and loop, keeps its half-width plus a prop base clear.
test('dressing never stands on any route corridor, loops included', () => {
  const offenders = build()
    .map((p) => [p, routeClearance(p.x, p.y)])
    .filter(([, clearance]) => clearance < BLOCKER_CLEARANCE)
    .map(([p, clearance]) => `${p.id} is ${Math.round(clearance)} inside a route`);
  assert.deepEqual(offenders, [], `${offenders.length} dressing placements stand on a route`);
});

test('dressing never stands on an encounter arena floor', () => {
  const offenders = [];
  for (const placement of build()) {
    for (const arena of LEVEL_ONE_WORLD.encounterArenas) {
      if (Math.hypot(placement.x - arena.anchor.x, placement.y - arena.anchor.y) < arena.radius) offenders.push(`${placement.id} on ${arena.id}`);
    }
  }
  assert.deepEqual(offenders, []);
});

// Camps are their own composition. Dressing that drifts into a camp's disc
// turns two authored groups into one blob, so the generator treats every camp
// (arena and spawn) as an exclusion.
test('dressing stays out of every encampment disc', () => {
  assert.ok(AUTHORED_CAMP_KIT.length >= 17, `only ${AUTHORED_CAMP_KIT.length} camps declared; the 12 spawn camps are missing`);
  const offenders = [];
  for (const placement of build()) {
    for (const camp of AUTHORED_CAMP_KIT) {
      const distance = Math.hypot(placement.x - camp.x, placement.y - camp.y);
      if (distance < camp.radius + 60) offenders.push(`${placement.id} is ${Math.round(distance)} from ${camp.id}`);
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} dressing placements sit inside a camp disc`);
});

// Anchor spacing is what keeps "clusters" from reading as one smear. 220 is
// the satellite reach (300) less the overlap the eye forgives at zoom 1.
const ANCHOR_SPACING = 220;
test('cluster anchors in one district keep their distance', () => {
  const anchors = build().filter((p) => p.clusterRole === 'anchor');
  const offenders = [];
  for (let i = 0; i < anchors.length; i += 1) {
    for (let j = i + 1; j < anchors.length; j += 1) {
      if (anchors[i].districtId !== anchors[j].districtId) continue;
      const distance = Math.hypot(anchors[i].x - anchors[j].x, anchors[i].y - anchors[j].y);
      if (distance < ANCHOR_SPACING) offenders.push(`${anchors[i].id} and ${anchors[j].id} are ${Math.round(distance)} apart`);
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} anchor pairs merge their clusters`);
});

// No two prop bases overlap: dressing and camp props alike.
const BASE_SEPARATION = 48;
test('no two world props share a base', () => {
  const props = [...build(), ...buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' })];
  const offenders = [];
  for (let i = 0; i < props.length; i += 1) {
    for (let j = i + 1; j < props.length; j += 1) {
      const distance = Math.hypot(props[i].x - props[j].x, props[i].y - props[j].y);
      if (distance < BASE_SEPARATION) offenders.push(`${props[i].id} and ${props[j].id} are ${Math.round(distance)} apart`);
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} prop pairs overlap at the base`);
});

// The World bar (AAA-ROADMAP.md section 2): no screen at gameplay zoom more
// than 50 percent undressed flat ground. The shoulder-band scene windows are
// the ones this pass exists for; each must carry a real world-prop count
// (dressing plus camp props) at zoom 1 (1440x900 plus the desktop cull margin
// of 192). Cycle 072 production saw ravine 4, hashwood 13, mining 8, yard 11,
// crossing 12 dressing and no camps in these windows; the mining window is the
// tight one (landmark ring, route, spawn-camp disc and the machinery line all
// sit in its north band) and lands at 9 + 2.
test('every shoulder-band scene window sees the density pass', () => {
  const windows = {
    ravine: [3_050, 1_500],
    hashwood: [7_000, 900],
    mining: [9_200, 1_600],
    yard: [11_000, 800],
    'crossing-water': [4_900, 1_050],
  };
  const props = [...build(), ...buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' })];
  for (const [tour, [cx, cy]] of Object.entries(windows)) {
    const seen = props.filter((p) => Math.abs(p.x - cx) <= 720 + 192 && Math.abs(p.y - cy) <= 450 + 192).length;
    assert.ok(seen >= 10, `worldTour=${tour} sees only ${seen} world props`);
  }
});
