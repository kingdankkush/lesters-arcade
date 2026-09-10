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
import { AUTHORED_SETPIECE_ANCHORS } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

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

// W-6 (Cycle 074): the bake receives the composed set-piece anchors so each
// landmark stands on a worn ring rather than on untouched ground.
const build = () => buildWorldDecals({ world: LEVEL_ONE_WORLD, seed: 0x484d4432, landmarks: AUTHORED_SETPIECE_ANCHORS });
const vertices = area => area.type === 'rect'
  ? [{x:area.minX,y:area.minY},{x:area.maxX,y:area.minY},{x:area.maxX,y:area.maxY},{x:area.minX,y:area.maxY}]
  : area.vertices;
const distanceToEdge = (point, a, b) => {
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  const t=d===0?0:Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/d));
  return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
};
const inArea = (point, area) => {
  const points=vertices(area);let result=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[j],b=points[i];
    if(distanceToEdge(point,a,b)<1e-8)return true;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
};

test('polygon water excludes route wear and ruts without deleting dry-side wear', () => {
  const area={type:'polygon',vertices:[{x:300,y:200},{x:1300,y:200},{x:1300,y:800},{x:300,y:800}]};
  const world={...LEVEL_ONE_WORLD,surfaces:[{id:'test-lake',kind:'water',area}],routeGraph:{nodes:[{id:'west',x:100,y:500},{id:'east',x:1500,y:500}],edges:[{from:'west',to:'east'}]}};
  const generated=buildWorldDecals({world,seed:0x484d4432});
  const wear=generated.filter(row=>row.kind==='route-wear'||row.kind==='tire-rut');
  assert.ok(wear.some(row=>!inArea(row,area)),'dry-side wear remains');
  assert.deepEqual(wear.filter(row=>inArea(row,area)).map(row=>row.id),[]);
});

test('every decal kind is authored', () => {
  for (const kind of ['route-wear', 'tire-rut', 'scorch', 'arena-stain', 'shore-crack', 'landmark-ring']) {
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
      const points=vertices(surface.area);
      return points.some((point,index)=>distanceToEdge(decal,point,points[(index+1)%points.length])<=180);
    });
    assert.ok(nearEdge, `${decal.id} is not on a shoreline`);
    assert.equal(water.some(surface=>inArea(decal,surface.area)),false,`${decal.id} floats on water`);
  }
});

// W-6: one ground ring per composed set-piece anchor, centred exactly on it,
// inside the decal radius cap, and only when anchors are handed in (the
// builder with no landmarks stays byte-identical for the other kinds).
test('W-6 every set-piece anchor stands on one landmark ring', () => {
  const rings = build().filter((entry) => entry.kind === 'landmark-ring');
  assert.equal(AUTHORED_SETPIECE_ANCHORS.length, 6);
  assert.equal(rings.length, 6);
  for (const anchor of AUTHORED_SETPIECE_ANCHORS) {
    const ring = rings.find((entry) => entry.anchorId === anchor.id);
    assert.ok(ring, `${anchor.id} has no ring`);
    assert.equal(ring.x, anchor.x);
    assert.equal(ring.y, anchor.y);
    assert.ok(ring.radius >= 150 && ring.radius <= 220, `${ring.id} radius ${ring.radius}`);
    assert.equal(ring.districtId, anchor.id);
  }
  assert.equal(DECAL_KINDS['landmark-ring'].shape, 'ring');
  const withoutAnchors = buildWorldDecals({ world: LEVEL_ONE_WORLD, seed: 0x484d4432 });
  assert.equal(withoutAnchors.filter((entry) => entry.kind === 'landmark-ring').length, 0);
  const withAnchors = build();
  const withoutCounts = {};
  for (const entry of withoutAnchors) withoutCounts[entry.kind] = (withoutCounts[entry.kind] ?? 0) + 1;
  const withCounts = {};
  for (const entry of withAnchors) withCounts[entry.kind] = (withCounts[entry.kind] ?? 0) + 1;
  const displaced = Math.max(0, withoutAnchors.length + rings.length - MAX_WORLD_DECALS);
  assert.equal(withAnchors.length, Math.min(MAX_WORLD_DECALS, withoutAnchors.length + rings.length), 'rings stay inside the decal budget');
  assert.equal(withCounts['shore-crack'], withoutCounts['shore-crack'] - displaced, 'rings displace only expendable shoreline cracks when the budget is saturated');
  for (const kind of ['route-wear', 'tire-rut', 'arena-stain', 'scorch']) {
    assert.equal(withCounts[kind], withoutCounts[kind], `${kind} count changed while adding rings`);
    assert.deepEqual(withAnchors.filter(entry => entry.kind === kind), withoutAnchors.filter(entry => entry.kind === kind), `${kind} placements changed while adding rings`);
  }
});

// W-4: the Cycle 073 bake carried 12 wear and rut decals whose centres sat in
// the river column (8 over the ford, 4 over deep water at the bridge), drawn
// ABOVE the water in the layer order so mud wear floated on the surface.
test('W-4 no route wear or tire rut is centred on water', () => {
  const water = LEVEL_ONE_WORLD.surfaces.filter((surface) => surface.kind === 'water' || surface.kind === 'shallow-water');
  const offenders = build()
    .filter((entry) => entry.kind === 'route-wear' || entry.kind === 'tire-rut')
    .filter((entry) => water.some(({ area }) => inArea(entry, area)))
    .map((entry) => entry.id);
  assert.deepEqual(offenders, []);
  // The integrated route graph includes the repaired optional loops and the
  // reservoir path; polygon shores replace the old rectangle-only bake.
  // Keep an exact current-world composition check in addition to the geometry
  // assertions above and the independent polygon/dry-side regression fixture.
  const counts = {};
  for (const entry of build()) counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  assert.deepEqual(counts, { 'route-wear': 148, 'tire-rut': 18, 'arena-stain': 24, scorch: 12, 'shore-crack': 12, 'landmark-ring': 6 });
});

test('every district gets some ground history', () => {
  const districts = new Set(build().map((decal) => decal.districtId).filter(Boolean));
  assert.ok(districts.size >= 4, `decals only reached ${districts.size} districts`);
});

// The handoff's explicit acceptance: decals must not occlude actors, which
// means drawing below every actor and prop layer.
for (const area of [
  { type: 'rect', minX: 500, minY: 500, maxX: 2500, maxY: 2500 },
  { type: 'polygon', vertices: [{x:500,y:500},{x:2500,y:500},{x:2500,y:2500},{x:500,y:2500}] },
]) test(`all ground-decal families reject ${area.type} water, not only road wear`, () => {
  const world = {
    ...LEVEL_ONE_WORLD, bounds:{minX:0,minY:0,maxX:3000,maxY:3000},
    districts:[{id:'fixture',minX:0,maxX:3000}],
    routeGraph:{nodes:[{id:'a',x:1000,y:1400},{id:'b',x:2000,y:1400}],edges:[{from:'a',to:'b'}]},
    encounterArenas:[{id:'arena',districtId:'fixture',anchor:{x:1500,y:1500},radius:100}],
    pointsOfInterest:[{id:'hazard',hook:'hazard',anchor:{x:1500,y:1500}},{id:'reward',hook:'reward',anchor:{x:1600,y:1500}}],
    surfaces:[],
  };
  const landmarks=[{id:'landmark',x:1500,y:1600}];
  const dry=buildWorldDecals({world,landmarks});
  assert.deepEqual([...new Set(dry.map(d=>d.kind))].sort(),['arena-stain','landmark-ring','route-wear','scorch','tire-rut'],'every affected family has a dry witness');
  const wet=buildWorldDecals({world:{...world,surfaces:[{id:'fixture-water',kind:'water',area}]},landmarks});
  assert.ok(wet.length>0,'dry shoreline cracking remains present');
  assert.equal(wet.filter(d=>d.kind!=='shore-crack').length,0,'stains, scorch and landmark rings may not float on water either');
  assert.ok(wet.every(d=>!inArea(d,area)),'all emitted centres must be outside water');
});

test('water exclusion does not mask malformed landmark coordinates', () => {
  const world={...LEVEL_ONE_WORLD,routeGraph:{nodes:[],edges:[]},encounterArenas:[],pointsOfInterest:[],surfaces:[{id:'origin-water',kind:'water',area:{type:'rect',minX:0,minY:0,maxX:100,maxY:100}}]};
  assert.throws(()=>buildWorldDecals({world,landmarks:[{id:'invalid',x:null,y:10}]}),/invalid world decal/);
});

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
