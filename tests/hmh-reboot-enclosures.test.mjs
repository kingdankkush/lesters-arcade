import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as atlas from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

const {
  AUTHORED_ENCLOSURES,
  AUTHORED_CAMP_KIT,
  AUTHORED_TOWN_EXCLUSIONS,
  AUTHORED_DRESSING_SEED,
  buildAuthoredEnclosurePlacements,
  buildAuthoredWorldPropPlacements,
  buildAuthoredEncampmentPlacements,
} = atlas;

const propAtlas = JSON.parse(readFileSync(
  fileURLToPath(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url)),
  'utf8',
));
const frameById = new Map(propAtlas.frames.map((frame) => [frame.assetId, frame]));
const spriteWidth = (assetId) => frameById.get(assetId).frame.w * frameById.get(assetId).runtimeScale;

// W-10 (Cycle 074). The world had no enclosed space: fences existed only as
// single dressing pieces and as collision capsules. A roofless enclosure is a
// fence or wall yard with an authored entrance, wrapped around a blocker the
// world contract already has, so one side of the illusion is backed by real
// collision. Dressing only: the pieces carry no collision, and the player can
// walk through the fence line. The display cannot rotate a sprite, so
// north-south runs are posts at a tight pitch rather than rotated fence
// panels, which would leave 35 px pieces every 92 units.

const build = () => buildAuthoredEnclosurePlacements({ worldId: 'forked-frontier' });

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

const EXPECTED_YARDS = [
  { id: 'yard:relay-depot', districtId: 'frontier-relay', rect: [1_380, 3_585, 1_720, 3_815], wraps: 'relay-depot-shed', side: 'west' },
  { id: 'yard:crossing-fuel', districtId: 'liquidity-crossing', rect: [5_225, 3_255, 5_655, 3_525], wraps: 'crossing-fuel-tanks', side: 'north' },
  { id: 'yard:mining-shack', districtId: 'mining-camp', rect: [8_640, 3_625, 9_160, 3_805], wraps: 'mining-shack-row', side: 'north' },
];
const TALL = new Set(['watch-platform', 'streetlamp', 'handrail-post']);
const POSTS = new Set(['handrail-post', 'dock-post']);

const perimeterDistance = (yard, x, y) => Math.min(
  Math.abs(x - yard.minX), Math.abs(x - yard.maxX), Math.abs(y - yard.minY), Math.abs(y - yard.maxY),
);
const onEdge = (yard, side, p) => (side === 'north' ? Math.abs(p.y - yard.minY) < 1 : side === 'south' ? Math.abs(p.y - yard.maxY) < 1 : side === 'west' ? Math.abs(p.x - yard.minX) < 1 : Math.abs(p.x - yard.maxX) < 1);
const along = (side, p) => (side === 'north' || side === 'south' ? p.x : p.y);

test('W-10 three yards wrap real blockers, outside the route corridor band, with a declared entrance side', () => {
  assert.equal(AUTHORED_ENCLOSURES.length, 3);
  for (const expected of EXPECTED_YARDS) {
    const yard = AUTHORED_ENCLOSURES.find((entry) => entry.id === expected.id);
    assert.ok(yard, `${expected.id} missing`);
    assert.equal(yard.districtId, expected.districtId);
    assert.deepEqual([yard.minX, yard.minY, yard.maxX, yard.maxY], expected.rect);
    assert.equal(yard.wraps, expected.wraps);
    assert.equal(yard.entrance.side, expected.side);
    assert.ok(yard.entrance.width >= 96 && yard.entrance.width <= 124, `${yard.id} entrance width ${yard.entrance.width}`);
    assert.ok(yard.minY > 3_100 || yard.maxY < 1_700, `${yard.id} sits in the central route corridor band`);
    const blocker = LEVEL_ONE_WORLD.collisionBlockers.find((entry) => entry.id === expected.wraps);
    assert.ok(blocker, `${expected.wraps} is not a collision blocker`);
    // Sample the perimeter: every point keeps a prop base off the blocker, and
    // the nearest point is within 60 so the fence reads as the blocker's yard.
    let nearest = Infinity;
    for (let t = 0; t <= 1; t += 1 / 64) {
      for (const [x, y] of [
        [yard.minX + (yard.maxX - yard.minX) * t, yard.minY], [yard.minX + (yard.maxX - yard.minX) * t, yard.maxY],
        [yard.minX, yard.minY + (yard.maxY - yard.minY) * t], [yard.maxX, yard.minY + (yard.maxY - yard.minY) * t],
      ]) {
        const clearance = shapeClearance(blocker.shape, x, y);
        assert.ok(clearance >= 24, `${yard.id} perimeter is ${Math.round(clearance)} from ${blocker.id} at ${Math.round(x)},${Math.round(y)}`);
        nearest = Math.min(nearest, clearance);
      }
    }
    assert.ok(nearest <= 60, `${yard.id} is ${Math.round(nearest)} from ${blocker.id}; a yard that far away does not read as its yard`);
  }
});

test('W-10 every piece stands on the perimeter, walls at sprite pitch, posts at a tight pitch', () => {
  const placements = build();
  assert.deepEqual(placements, build(), 'enclosures must be deterministic');
  assert.equal(new Set(placements.map((p) => p.id)).size, placements.length);
  for (const yard of AUTHORED_ENCLOSURES) {
    const pieces = placements.filter((p) => p.enclosureId === yard.id);
    assert.ok(pieces.length >= 12, `${yard.id} has ${pieces.length} pieces`);
    for (const p of pieces) {
      assert.ok(perimeterDistance(yard, p.x, p.y) < 1, `${p.id} is off the fence line`);
      assert.equal(p.category, 'enclosure');
      assert.equal(p.districtId, yard.districtId);
      assert.equal(p.runtimeAuthority, 'projection-only');
      assert.ok(frameById.has(p.assetId), `${p.id} uses unknown prop ${p.assetId}`);
    }
    for (const side of ['north', 'south']) {
      const walls = pieces.filter((p) => onEdge(yard, side, p) && p.role === 'wall');
      assert.ok(walls.every((p) => p.assetId === yard.pieceId), `${yard.id} ${side} run mixes pieces`);
      const positions = pieces.filter((p) => onEdge(yard, side, p)).map((p) => p.x).sort((a, b) => a - b);
      assert.equal(positions[0], yard.minX, `${yard.id} ${side} run must start at the corner`);
      assert.equal(positions.at(-1), yard.maxX, `${yard.id} ${side} run must end at the corner`);
      if (side !== yard.entrance.side) {
        for (let i = 1; i < positions.length; i += 1) {
          assert.ok(positions[i] - positions[i - 1] <= spriteWidth(yard.pieceId) + 0.5, `${yard.id} ${side} run has a ${Math.round(positions[i] - positions[i - 1])} gap; the ${yard.pieceId} sprite is ${Math.round(spriteWidth(yard.pieceId))} wide`);
        }
      }
    }
    for (const side of ['west', 'east']) {
      const posts = pieces.filter((p) => onEdge(yard, side, p) && p.role === 'post');
      assert.ok(POSTS.has(yard.postId), `${yard.id} post ${yard.postId} is not a post`);
      assert.ok(posts.every((p) => p.assetId === yard.postId), `${yard.id} ${side} run mixes posts`);
      if (side !== yard.entrance.side) {
        assert.ok(posts.length >= 2, `${yard.id} ${side} side has ${posts.length} posts`);
        const positions = pieces.filter((p) => onEdge(yard, side, p)).map((p) => p.y).sort((a, b) => a - b);
        for (let i = 1; i < positions.length; i += 1) {
          assert.ok(positions[i] - positions[i - 1] <= 72, `${yard.id} ${side} posts are ${Math.round(positions[i] - positions[i - 1])} apart; a fence line needs <= 72`);
        }
      }
    }
  }
});

test('W-10 each yard has exactly one entrance gap, flanked by two tall gateposts', () => {
  const placements = build();
  for (const yard of AUTHORED_ENCLOSURES) {
    const side = yard.entrance.side;
    const onSide = placements.filter((p) => p.enclosureId === yard.id && onEdge(yard, side, p)).sort((a, b) => along(side, a) - along(side, b));
    const gaps = [];
    for (let i = 1; i < onSide.length; i += 1) gaps.push({ size: along(side, onSide[i]) - along(side, onSide[i - 1]), a: onSide[i - 1], b: onSide[i] });
    // The entrance is the gap between the two gateposts: they must be
    // adjacent along the edge (nothing stands in the opening), the opening is
    // a player-and-a-half wide, and it is centred where the table says.
    assert.equal(placements.filter((p) => p.enclosureId === yard.id && p.role === 'gatepost').length, 2, `${yard.id} gatepost count`);
    const entrances = gaps.filter((gap) => gap.a.role === 'gatepost' && gap.b.role === 'gatepost');
    assert.equal(entrances.length, 1, `${yard.id} gateposts are not adjacent on its ${side} side: ${gaps.map((g) => `${g.a.role}-${Math.round(g.size)}-${g.b.role}`).join(' ')}`);
    const [entrance] = entrances;
    assert.ok(entrance.size >= 96 && entrance.size <= 140, `${yard.id} entrance is ${Math.round(entrance.size)} wide`);
    assert.ok(Math.abs((along(side, entrance.a) + along(side, entrance.b)) / 2 - yard.entrance.at) < 1, `${yard.id} entrance is not centred on ${yard.entrance.at}`);
    for (const post of [entrance.a, entrance.b]) {
      assert.equal(post.assetId, yard.gateId);
      assert.ok(TALL.has(post.assetId), `${post.id} (${post.assetId}) is not tall enough to mark an entrance from the 55-degree camera`);
    }
    // Every other gap on that side is closed by a sprite: no second opening.
    for (const gap of gaps) {
      if (gap === entrance) continue;
      assert.ok(gap.size <= spriteWidth(yard.pieceId) + 0.5, `${yard.id} ${side} side has a stray ${Math.round(gap.size)} gap between ${gap.a.id} and ${gap.b.id}`);
    }
  }
});

test('W-10 every piece clears blockers, routes, water, arenas, camps, pickups and the town kit', () => {
  const offenders = [];
  const river = LEVEL_ONE_WORLD.surfaces.find((surface) => surface.id === 'liquidity-river').area;
  const shallows = LEVEL_ONE_WORLD.surfaces.find((surface) => surface.id === 'crossing-shallows').area;
  const inArea = (area, p) => p.x >= area.minX && p.x <= area.maxX && p.y >= area.minY && p.y <= area.maxY;
  for (const p of build()) {
    for (const blocker of LEVEL_ONE_WORLD.collisionBlockers) {
      const clearance = shapeClearance(blocker.shape, p.x, p.y);
      if (clearance < 24) offenders.push(`${p.id} is ${Math.round(clearance)} from ${blocker.id}`);
    }
    const route = routeClearance(p.x, p.y);
    if (route < 24) offenders.push(`${p.id} is ${Math.round(route)} inside a route`);
    if (inArea(river, p) && !inArea(shallows, p)) offenders.push(`${p.id} stands in deep water`);
    for (const arena of LEVEL_ONE_WORLD.encounterArenas) {
      if (Math.hypot(p.x - arena.anchor.x, p.y - arena.anchor.y) < arena.radius) offenders.push(`${p.id} is on ${arena.id}`);
    }
    for (const camp of AUTHORED_CAMP_KIT) {
      if (Math.hypot(p.x - camp.x, p.y - camp.y) < camp.radius + 60) offenders.push(`${p.id} is inside ${camp.id}`);
    }
    for (const point of LEVEL_ONE_WORLD.pointsOfInterest) {
      if (Math.hypot(p.x - point.anchor.x, p.y - point.anchor.y) < 80) offenders.push(`${p.id} stands on ${point.id}`);
    }
    for (const [tx, ty] of AUTHORED_TOWN_EXCLUSIONS) {
      if (Math.hypot(p.x - tx, p.y - ty) < 80) offenders.push(`${p.id} stands in a town prop's stack`);
    }
    if (p.x < 40 || p.x > 11_960 || p.y < 40 || p.y > 4_760) offenders.push(`${p.id} hangs off the world edge`);
  }
  assert.deepEqual(offenders, [], `${offenders.length} enclosure placement defects`);
});

// An enclosure piece that shares a base with a dressing or camp prop reads as
// one broken sprite. The generator treats every yard (plus a margin) as an
// exclusion, so the three dressing placements that stood on the yards are
// re-rolled rather than left under a fence.
test('W-10 no enclosure piece shares a base with any dressing or camp prop', () => {
  const others = [
    ...buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: AUTHORED_DRESSING_SEED }),
    ...buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' }),
  ];
  const offenders = [];
  for (const piece of build()) {
    for (const other of others) {
      const distance = Math.hypot(piece.x - other.x, piece.y - other.y);
      if (distance < 48) offenders.push(`${piece.id} and ${other.id} are ${Math.round(distance)} apart`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('W-10 enclosures are wired into the runtime placement list and refuse another world', () => {
  const source = readFileSync(fileURLToPath(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url)), 'utf8');
  assert.match(source, /buildAuthoredEnclosurePlacements\(\{ worldId: LEVEL_ONE_WORLD\.id \}\)/);
  assert.throws(() => buildAuthoredEnclosurePlacements({ worldId: 'elsewhere' }), /unsupported authored enclosure world/);
});
