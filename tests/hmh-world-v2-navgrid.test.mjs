// W4a follow-up: the ten-area nav grid is built once in the lazy world chunk
// with a bucket index and adopted by the runtime's chunked builder; the arrays
// stay byte-identical to the unindexed walk on both worlds, and every
// production-art palette read resolves for both worlds.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createEnemyNavGrid, createEnemyNavGridChunked } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { createWorldV2GroundQuery, createWorldV2RuntimeWorld } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createWorldV2NavGrid } from '../apps/hmh-reboot/src/world-v2-navgrid.mjs';
import { createWorldV2RuntimeContext } from '../apps/hmh-reboot/src/world-v2-runtime-context.mjs';
import { resolveHmhWorldSelection } from '../apps/hmh-reboot/src/world-context.mjs';
import { BLOCKER_PRODUCTION_KITS, DISTRICT_PRODUCTION_MATERIALS, INTERACTION_PRODUCTION_KITS, LANDMARK_PRODUCTION_KITS, resolveWorldShaderState, resolveWorldSurfaceBase } from '../apps/hmh-reboot/src/world-production-art.mjs';

const digest = (grid) => createHash('sha256').update(grid.walkable).update(grid.edges).digest('hex');
const tenArea = createWorldV2RuntimeWorld();
const tenAreaQuery = createWorldV2GroundQuery(tenArea);

test('the bucket-indexed walk is byte-identical to the unindexed walk on the ten-area world and the legacy world', () => {
  for (const [label, world, queryGround] of [['ten-area', tenArea, tenAreaQuery], ['legacy', LEVEL_ONE_WORLD, createLevelOneGroundQuery()]]) {
    const reference = createEnemyNavGrid({ world, queryGround });
    const started = performance.now();
    const indexed = createWorldV2NavGrid({ world, queryGround });
    const elapsed = performance.now() - started;
    assert.deepEqual(Array.from(indexed.walkable), Array.from(reference.walkable), `${label} walkable`);
    assert.deepEqual(Array.from(indexed.edges), Array.from(reference.edges), `${label} edges`);
    assert.equal(digest(indexed), digest(reference), `${label} digest`);
    for (const key of ['columns', 'rows', 'cellSize', 'minX', 'minY']) assert.equal(indexed[key], reference[key], `${label}.${key}`);
    assert.deepEqual(indexed.neighbours, reference.neighbours);
    assert.equal(indexed.cellAt(world.player.spawn.x, world.player.spawn.y), reference.cellAt(world.player.spawn.x, world.player.spawn.y));
    assert.equal(indexed.isWalkableAt(world.player.spawn.x, world.player.spawn.y), true);
    assert.equal(Object.isFrozen(indexed), true);
    assert.ok(elapsed < 5_000, `${label} indexed build took ${elapsed.toFixed(0)} ms`);
  }
  assert.equal(digest(createWorldV2NavGrid({ world: LEVEL_ONE_WORLD, queryGround: createLevelOneGroundQuery() })), '403a19d27a20a6deca79d9ec9db8bf43ea91de57048961bfa1e6122f62491cb2', 'the pinned legacy witness');
});

test('the ten-area context carries its precomputed grid and the chunked builder adopts it without slicing; the legacy world still walks', async () => {
  const context = createWorldV2RuntimeContext({ selection: resolveHmhWorldSelection({ params: 'mode=free&world=ten-area' }) });
  assert.ok(context.world.navGrid, 'the world hands main its grid');
  assert.equal(digest(context.world.navGrid), digest(createEnemyNavGrid({ world: tenArea, queryGround: tenAreaQuery })));
  assert.equal(Object.isFrozen(context.world), true);
  for (const key of Object.keys(tenArea)) assert.equal(context.world[key], tenArea[key] === undefined ? undefined : context.world[key], key);
  let yields = 0;
  const started = performance.now();
  const adopted = await createEnemyNavGridChunked({ world: context.world, queryGround: context.createGroundQuery(), cellsPerSlice: 512, scheduleYield: async () => { yields += 1; } });
  assert.equal(adopted, context.world.navGrid, 'the same frozen grid, not a copy');
  assert.equal(yields, 0);
  assert.ok(performance.now() - started < 200);
  // A mismatched precomputed grid is ignored, never trusted.
  const stale = { ...tenArea, navGrid: { ...context.world.navGrid, cellSize: 30 } };
  let staleYields = 0;
  const rebuilt = await createEnemyNavGridChunked({ world: stale, queryGround: tenAreaQuery, cellsPerSlice: 4096, scheduleYield: async () => { staleYields += 1; } });
  assert.notEqual(rebuilt, stale.navGrid);
  assert.ok(staleYields > 0);
  assert.equal(digest(rebuilt), digest(context.world.navGrid));
  let legacyYields = 0;
  const legacy = await createEnemyNavGridChunked({ world: LEVEL_ONE_WORLD, queryGround: createLevelOneGroundQuery(), cellsPerSlice: 512, scheduleYield: async () => { legacyYields += 1; } });
  assert.ok(legacyYields > 0, 'the legacy world has no precomputed grid and slices as before');
  assert.equal(digest(legacy), '403a19d27a20a6deca79d9ec9db8bf43ea91de57048961bfa1e6122f62491cb2');
  assert.equal(LEVEL_ONE_WORLD.navGrid, undefined);
});

test('every production-art palette read resolves for both worlds (district, route start, surface vertex, blocker, landmark, interaction)', () => {
  const materialKey = (district) => district.materialId ?? district.id;
  const districtAt = (world, x, y) => world.districts.find((district) => x >= district.area.minX && x <= district.area.maxX && y >= district.area.minY && y <= district.area.maxY)
    ?? world.districts.find((district) => x >= district.area.minX && x <= district.area.maxX) ?? world.districts[0];
  for (const world of [LEVEL_ONE_WORLD, tenArea]) {
    for (const district of world.districts) {
      assert.ok(DISTRICT_PRODUCTION_MATERIALS[materialKey(district)]?.routeColor, `${world.id} ${district.id} kit`);
      assert.ok(resolveWorldShaderState({ tick: 0, districtId: materialKey(district) }));
      assert.equal(typeof district.color, 'number');
    }
    const nodes = new Map(world.routeGraph.nodes.map((node) => [node.id, node]));
    for (const route of world.routes) {
      const first = nodes.get(route.nodeIds[0]);
      assert.ok(first, `${world.id} ${route.id} first node`);
      const kit = DISTRICT_PRODUCTION_MATERIALS[materialKey(districtAt(world, first.x, first.y))];
      assert.equal(typeof kit?.routeColor, 'number', `${world.id} ${route.id} routeColor`);
    }
    for (const surface of world.surfaces) {
      const vertex = surface.area.type === 'rect' ? { x: surface.area.minX, y: surface.area.minY } : surface.area.vertices[0];
      const district = districtAt(world, vertex.x, vertex.y);
      assert.ok(resolveWorldSurfaceBase({ kind: surface.kind, districtId: materialKey(district) }), `${world.id} ${surface.id}`);
    }
    for (const blocker of world.blockers) assert.ok(BLOCKER_PRODUCTION_KITS[blocker.visualKind], `${world.id} ${blocker.id}`);
    for (const landmark of world.landmarks) {
      assert.ok(LANDMARK_PRODUCTION_KITS[landmark.visualKind], `${world.id} ${landmark.id}`);
      assert.ok(world.districts.some((district) => district.id === landmark.districtId), `${world.id} ${landmark.id} district`);
    }
    for (const poi of world.pointsOfInterest) assert.ok(INTERACTION_PRODUCTION_KITS[poi.hook], `${world.id} ${poi.id}`);
    for (const hazard of world.interactions.hazards) assert.ok(INTERACTION_PRODUCTION_KITS[hazard.kind] && world.districts.some((district) => district.id === hazard.districtId), hazard.id);
  }
  const art = readFileSync(new URL('../apps/hmh-reboot/src/world-production-art.mjs', import.meta.url), 'utf8');
  const raw = art.match(/DISTRICT_PRODUCTION_MATERIALS\[([^\]]+)\]/g).map((match) => match.slice('DISTRICT_PRODUCTION_MATERIALS['.length, -1));
  assert.deepEqual(raw.filter((expression) => !/^districtId$|^materialKey\(/.test(expression)), [], 'every district kit read goes through the material key');
  assert.doesNotMatch(art, /districtAt\(\w+\.x\)\.id/, 'no x-only district id palette read remains');
});

test('main.mjs skips the legacy native barrier load on an unofficial world instead of leaving it loading', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /dataset\.nativeBarrierStatus = HMH_WORLD_CONTEXT\.legacy \? 'loading' : 'skipped';/);
  assert.match(main, /const barrierPromise = !HMH_WORLD_CONTEXT\.legacy \? Promise\.resolve\(null\) : import\('\.\/native-barriers\.mjs'\)/);
  assert.match(main, /if\(barrierResult&&HMH_WORLD_CONTEXT\.legacy\)\{/);
  assert.match(main, /ENEMY_NAV_GRID = await createEnemyNavGridChunked\(\{ world: LEVEL_ONE_WORLD, queryGround, cellsPerSlice: 512 \}\);/, 'the runtime call is unchanged; the world carries the grid');
});
