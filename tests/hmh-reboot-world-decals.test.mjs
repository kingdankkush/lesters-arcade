import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import {
  DECAL_KINDS,
  buildWorldDecals,
  MAX_WORLD_DECALS,
} from '../apps/hmh-reboot/src/world-decals.mjs';

const mainSource = readFileSync(
  fileURLToPath(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url)),
  'utf8',
);

// T2. The ground carried terrain material and nothing else, so a route that
// 25 nodes of traffic supposedly run along looked identical to untouched
// ground, and an arena where a fight happens looked like a field. Decals are
// the cheapest layer that makes the world look used.
//
// Strictly projection-only: they draw beneath props and actors and never
// become collision, and they are anchored to the world contract rather than
// scattered, so they cannot drift away from what they are marking.

const build = () => buildWorldDecals({ world: LEVEL_ONE_WORLD, seed: 0x484d4432 });

test('every decal kind is authored', () => {
  for (const kind of ['route-wear', 'tire-rut', 'scorch', 'arena-stain', 'shore-crack']) {
    assert.ok(DECAL_KINDS[kind], `${kind} missing from DECAL_KINDS`);
    const spec = DECAL_KINDS[kind];
    assert.match(spec.color, /^#?[0-9a-f]{6}$/i, `${kind} color`);
    assert.ok(spec.alpha > 0 && spec.alpha <= 0.5, `${kind} alpha ${spec.alpha} -- ground marks must stay subtle`);
  }
});

test('decals are deterministic', () => {
  assert.deepEqual(build(), build());
});

test('decals are bounded so the layer cannot grow without limit', () => {
  const decals = build();
  assert.ok(decals.length > 0, 'no decals produced');
  assert.ok(decals.length <= MAX_WORLD_DECALS, `${decals.length} decals exceeds the ${MAX_WORLD_DECALS} cap`);
});

test('every decal is well formed and inside the world', () => {
  for (const decal of build()) {
    assert.ok(DECAL_KINDS[decal.kind], `unknown kind ${decal.kind}`);
    assert.ok(Number.isFinite(decal.x) && Number.isFinite(decal.y), `${decal.id} position`);
    assert.ok(decal.x >= 0 && decal.x <= LEVEL_ONE_WORLD.bounds.maxX, `${decal.id} x out of bounds`);
    assert.ok(decal.y >= 0 && decal.y <= LEVEL_ONE_WORLD.bounds.maxY, `${decal.id} y out of bounds`);
    assert.ok(decal.radius > 0 && decal.radius <= 220, `${decal.id} radius ${decal.radius}`);
    assert.ok(Number.isFinite(decal.rotation), `${decal.id} rotation`);
    assert.equal(decal.runtimeAuthority, 'projection-only');
  }
  const ids = build().map((decal) => decal.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate decal id');
});

// The point of anchoring to the contract: a decal that drifts away from the
// thing it marks is just noise on the ground.
test('route wear hugs the authored route graph', () => {
  // Distance to the route LINE, not to its nodes. Wear placed halfway along a
  // 1,000-unit leg is legitimately ~500 from either endpoint while sitting
  // exactly on the path -- measuring against nodes would reject correct
  // placement and push wear into rings around each waypoint.
  const nodeById = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
  const segments = LEVEL_ONE_WORLD.routeGraph.edges
    .map((edge) => [nodeById.get(edge.from), nodeById.get(edge.to)])
    .filter(([from, to]) => from && to);
  const distanceToSegment = (point, from, to) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y);
    let t = ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
  };
  for (const decal of build().filter((entry) => entry.kind === 'route-wear')) {
    const nearest = Math.min(...segments.map(([from, to]) => distanceToSegment(decal, from, to)));
    assert.ok(nearest <= 80, `${decal.id} sits ${Math.round(nearest)} from the route line`);
  }
});

test('arena stains stay inside their arena', () => {
  const arenas = new Map(LEVEL_ONE_WORLD.encounterArenas.map((arena) => [arena.id, arena]));
  const stains = build().filter((entry) => entry.kind === 'arena-stain');
  assert.ok(stains.length > 0, 'no arena stains');
  for (const decal of stains) {
    const arena = arenas.get(decal.anchorId);
    assert.ok(arena, `${decal.id} names no real arena`);
    const distance = Math.hypot(decal.x - arena.anchor.x, decal.y - arena.anchor.y);
    assert.ok(distance <= arena.radius, `${decal.id} escaped its arena by ${Math.round(distance - arena.radius)}`);
  }
});

test('shore cracks sit near a water edge', () => {
  const water = LEVEL_ONE_WORLD.surfaces.filter((surface) => surface.kind === 'water' || surface.kind === 'shallow-water');
  const cracks = build().filter((entry) => entry.kind === 'shore-crack');
  assert.ok(cracks.length > 0, 'no shore cracks');
  for (const decal of cracks) {
    const nearEdge = water.some((surface) => {
      const { minX, maxX, minY, maxY } = surface.area;
      const withinBand = decal.x >= minX - 180 && decal.x <= maxX + 180 && decal.y >= minY - 180 && decal.y <= maxY + 180;
      const insideCore = decal.x > minX + 40 && decal.x < maxX - 40;
      // Near the water but not floating in the middle of it.
      return withinBand && !insideCore;
    });
    assert.ok(nearEdge, `${decal.id} is not on a shoreline`);
  }
});

test('every district gets some ground history', () => {
  const districts = new Set(build().map((decal) => decal.districtId).filter(Boolean));
  assert.ok(districts.size >= 4, `decals only reached ${districts.size} districts`);
});

// The handoff's explicit acceptance: decals must not occlude actors, which
// means drawing below every actor and prop layer.
test('the decal layer draws beneath props and actors', () => {
  const order = /world\.addChild\(([^)]*)\)/.exec(mainSource);
  assert.ok(order, 'could not read the world layer order');
  const names = order[1].split(',').map((entry) => entry.trim());
  const decalAt = names.indexOf('worldDecalLayer');
  assert.ok(decalAt >= 0, 'worldDecalLayer is not in the world layer order');
  for (const above of ['authoredPropLayer', 'actorVisual', 'enemyVisuals', 'combatVisuals']) {
    const at = names.indexOf(above);
    assert.ok(at > decalAt, `${above} must draw above the decal layer`);
  }
});

// The placements are BAKED at build time and fetched, not computed in the
// child. The derivation costs 4,451 B minified against a bundle that had
// 3,218 B of headroom left, and the upgrade program is explicit that
// runtime-fetched art costs no bundle bytes while code must carry size
// accounting. Keeping the builder out of the child is load-bearing, not a
// style choice, so it is asserted.
test('the child fetches baked decals rather than deriving them', () => {
  assert.match(mainSource, /WORLD_DECAL_URL/, 'child must fetch the baked asset');
  assert.doesNotMatch(
    mainSource,
    /buildWorldDecals\s*\(/,
    'deriving decals in the child puts 4.4 KB of placement logic back in the bundle',
  );
});

// A baked asset can drift from the source that produced it. This is the only
// thing keeping the shipped data honest.
test('the baked asset matches what the builder produces', () => {
  const baked = JSON.parse(readFileSync(
    fileURLToPath(new URL('../apps/portal/assets/generated/hmh-world-decals/hmh-world-decals.json', import.meta.url)),
    'utf8',
  ));
  assert.equal(baked.pipelineId, 'hmh-world-decals-v1');
  assert.equal(baked.runtimeAuthority, 'projection-only');
  assert.deepEqual(
    baked.decals,
    JSON.parse(JSON.stringify(build())),
    'the shipped decals no longer match buildWorldDecals -- re-run assets:hmh:world-decals',
  );
});

// Decoration must never be able to stop a run starting.
test('a failed decal fetch degrades to an empty layer', () => {
  assert.match(mainSource, /catch\(\(\)\s*=>\s*\{\s*worldDecals\s*=\s*\[\];\s*\}\)/);
});
