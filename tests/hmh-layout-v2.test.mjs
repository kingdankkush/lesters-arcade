import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createEnemyNavGrid } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import {
  LAYOUT_V2_BOUNDS,
  buildLayoutV2World,
  layoutV2ShapeDistance,
  layoutV2Vertices,
} from '../apps/hmh-reboot/src/layout-v2-kit.mjs';
import { LAYOUT_V2_MAP } from '../apps/hmh-reboot/src/layout-v2-map.mjs';
import { buildLayoutV2Grids, checkLayoutV2, formatLayoutV2Report } from '../apps/hmh-reboot/src/layout-v2-checker.mjs';

const MAIN_SOURCE = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const SRC = new URL('../apps/hmh-reboot/src/', import.meta.url);
const grids = buildLayoutV2Grids(LAYOUT_V2_MAP);
const report = checkLayoutV2(LAYOUT_V2_MAP, grids);
const clone = () => structuredClone(LAYOUT_V2_MAP);

// S2.0 greybox terrain kit.
test('the kit normalises convex masses to the navgrid winding and rejects concave ones', () => {
  const clockwise = layoutV2Vertices({ id: 'a', poly: [[0, 0], [0, 100], [100, 100], [100, 0]] });
  assert.deepEqual(clockwise[0], { x: 100, y: 0 }, 'a negative-area polygon is reversed');
  const world = buildLayoutV2World({ districts: [], masses: [{ id: 'box', material: 'rock', rect: [100, 100, 300, 300] }] });
  assert.equal(world.collisionBlockers[0].combatCover, true);
  assert.equal(layoutV2ShapeDistance(world.collisionBlockers[0].shape, 200, 200), 0, 'inside the mass');
  assert.equal(layoutV2ShapeDistance(world.collisionBlockers[0].shape, 350, 200), 50);
  assert.throws(() => buildLayoutV2World({ districts: [], masses: [{ id: 'l', material: 'rock', poly: [[0, 0], [200, 0], [200, 200], [100, 50], [0, 200]] }] }), /convex/);
  assert.throws(() => buildLayoutV2World({ districts: [], masses: [{ id: 'x', material: 'rock', rect: [0, 0, 10, 10] }, { id: 'x', material: 'rock', rect: [20, 20, 30, 30] }] }), /duplicate/);
});

test('the kit turns decks, chasms, terraces and gates into surfaces and blockers', () => {
  const layout = {
    districts: [],
    chasms: [{ id: 'gorge', rect: [400, 0, 600, 1_000] }],
    decks: [{ id: 'span', rect: [380, 400, 620, 640], z: 16 }],
    terraces: [{ id: 'hill', rect: [800, 100, 1_000, 300], ramps: [{ id: 'hill-ramp', rect: [850, 300, 950, 450], top: 'north' }] }],
    gates: [{ id: 'door', role: 'reward', a: [100, 100], b: [100, 300] }],
  };
  const closed = buildLayoutV2World(layout);
  const open = buildLayoutV2World(layout, { gates: 'open' });
  const ground = closed.queryGround;
  assert.equal(ground(500, 100).deepWater, true, 'a chasm follows the deep-water rules');
  assert.equal(ground(500, 500).groundZ, 16, 'the raised deck');
  assert.equal(ground(330, 500).kind, 'ramp', 'a raised deck gets 100-unit ramps');
  assert.equal(ground(900, 200).groundZ, 24, 'terraces are capped at z24');
  assert.equal(ground(900, 300).groundZ, 24, 'the ramp top meets the terrace');
  assert.equal(ground(900, 450).groundZ, 0, 'the ramp foot meets the floor');
  assert.deepEqual(closed.collisionBlockers.filter((b) => b.shape.type === 'capsule').map((b) => b.id).sort(), ['door', 'span-north-rail', 'span-south-rail']);
  assert.equal(open.collisionBlockers.some((b) => b.id === 'door'), false, 'an open gate is not solid');
  assert.throws(() => buildLayoutV2World({ districts: [], terraces: [{ id: 'high', rect: [0, 0, 10, 10], z: 48 }] }), /z24/);
});

test('the v2 map keeps the level contract: extents, spawn, districts and surface ids', () => {
  assert.deepEqual({ ...LAYOUT_V2_BOUNDS, visibleBoundaryId: undefined }, { ...LEVEL_ONE_WORLD.bounds, visibleBoundaryId: undefined });
  assert.deepEqual(LAYOUT_V2_MAP.player.spawn, { x: LEVEL_ONE_WORLD.player.spawn.x, y: LEVEL_ONE_WORLD.player.spawn.y });
  assert.deepEqual(LAYOUT_V2_MAP.districts.map(({ id, minX, maxX }) => [id, minX, maxX]), LEVEL_ONE_WORLD.districts.map(({ id, area }) => [id, area.minX, area.maxX]));
  const surfaceIds = new Set(grids.open.surfaces.map((surface) => surface.id));
  for (const id of ['proof-of-work-bridge', 'crossing-shallows']) assert.ok(surfaceIds.has(id), `${id} kept`);
  assert.equal(LAYOUT_V2_MAP.lairs.length, 24);
  for (const district of LAYOUT_V2_MAP.districts) assert.equal(LAYOUT_V2_MAP.lairs.filter((lair) => lair.district === district.id).length, 4, district.id);
  assert.deepEqual(LAYOUT_V2_MAP.entries.map((entry) => entry.id), ['spawn-meadow', 'ravine-approach', 'west-bank', 'hashwood-cut', 'mining-floor']);
  assert.deepEqual(LAYOUT_V2_MAP.decks.map((deck) => deck.id), ['settler-viaduct', 'rugpull-rope-bridge', 'old-mill-bridge', 'proof-of-work-bridge', 'fork-trestle', 'lock-gate-walkway', 'hashwood-run-bridge', 'canal-bascule']);
});

// Layout checker (section 2.9) on the real navgrid.
test('the v2 layout passes every section 2.9 gate the checker runs', () => {
  assert.equal(report.ok, true, formatLayoutV2Report(report, LAYOUT_V2_MAP));
  const greybox = LAYOUT_V2_MAP.districts.filter((district) => district.status === 'greybox').map((district) => district.id);
  assert.deepEqual(greybox, ['frontier-relay', 'rugpull-ravine', 'liquidity-crossing'], 'S2.1 Relay and Crossing plus S2.3 Ravine are greybox');
  for (const id of greybox) {
    const stats = report.districts[id];
    assert.ok(stats.share >= 0.5 && stats.share <= 0.8, `${id} reachable ${stats.share}`);
    assert.equal(stats.sanctuaries, 0, `${id} sanctuaries`);
    assert.ok(stats.lairCoverage >= 0.9, `${id} coverage ${stats.lairCoverage}`);
    assert.ok(stats.emptyTiles.length <= 3, `${id} empty tiles`);
  }
  for (const stats of Object.values(report.districts)) assert.equal(stats.unreachable, 0, 'no stranded walkable cells anywhere');
  assert.ok(report.overallShare > 0.5 && report.overallShare < 0.62, `overall ${report.overallShare} is near the 57% target`);
  const cuts = Object.fromEntries(report.cuts.map((cut) => [cut.id, cut]));
  assert.equal(cuts['liquidity-river'].cutPath, null, 'the river is crossed only on its bridges');
  assert.equal(cuts['toll-lock-island'].cutPath, null, 'Fork Island is reached only by the trestle and the lock walkway');
  assert.ok(cuts['rugpull-gorge-north'].cutPath >= 3 * cuts['rugpull-gorge-north'].baselinePath, 'without the viaduct and rope bridge the gorge is a long detour');
});

test('the checker fails a road blocked by a mass', () => {
  const layout = clone();
  layout.masses.push({ id: 'viaduct-wreck', district: 'rugpull-ravine', material: 'cover', rect: [2_600, 2_320, 2_700, 2_400] });
  const result = checkLayoutV2(layout);
  assert.ok(result.failures.some((failure) => failure.gate === 'road-clearance' && /frontier-highway/.test(failure.detail)));
});

test('the checker fails an unsealed arena and an open reward pocket', () => {
  const layout = clone();
  layout.gates = layout.gates.filter((gate) => gate.id !== 'crossing-trestle-lock' && gate.id !== 'relay-barn-doors');
  const failures = checkLayoutV2(layout).failures;
  assert.ok(failures.some((failure) => failure.gate === 'arena-seal' && /toll-lock/.test(failure.detail)));
  assert.ok(failures.some((failure) => failure.gate === 'pocket' && /relay-barn-yard/.test(failure.detail)));
});

test('the checker fails a spawn sanctuary, an unintended seam crossing and an unbridged river', () => {
  const layout = clone();
  layout.lairs = layout.lairs.filter((lair) => lair.district !== 'frontier-relay');
  layout.masses = layout.masses.filter((mass) => mass.id !== 'relay-seam-woods-south');
  layout.decks.push({ id: 'rogue-ford', district: 'liquidity-crossing', rect: [4_480, 1_800, 5_020, 1_900], span: 'x', z: 0, clear: 100, rails: false });
  const failures = checkLayoutV2(layout).failures;
  assert.ok(failures.some((failure) => failure.gate === 'spawn-sanctuary' && failure.district === 'frontier-relay'));
  assert.ok(failures.some((failure) => failure.gate === 'seam'));
  assert.ok(failures.some((failure) => failure.gate === 'crossing-cut' && /liquidity-river/.test(failure.detail)));
});

test('the v2 navgrid is deterministic and within the build-time budget', () => {
  const again = createEnemyNavGrid({ world: grids.open, queryGround: grids.open.queryGround });
  const hash = (grid) => createHash('sha256').update(grid.walkable).update(grid.edges).digest('hex');
  assert.equal(hash(again), report.openGridHash);
  const queryGround = createLevelOneGroundQuery();
  const best = (build) => Math.min(...[0, 1, 2].map(() => { const start = performance.now(); build(); return performance.now() - start; }));
  const baseline = best(() => createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround }));
  const v2 = best(() => createEnemyNavGrid({ world: grids.start, queryGround: grids.start.queryGround }));
  assert.ok(v2 <= baseline * 1.5 + 25, `v2 navgrid ${v2.toFixed(1)} ms against ${baseline.toFixed(1)} ms today (budget 1.5x)`);
});

// Built dark: the default map never loads layout v2, and Ranked never runs it.
test('no default-map module imports layout v2; main.mjs reaches it only by a lazy import', () => {
  const modules = ['level-one-world.mjs', 'enemy-navgrid.mjs', 'collision.mjs', 'elevation.mjs', 'world-design-layout.mjs', 'world-design-encounters.mjs', 'simulation.mjs'];
  for (const name of modules) assert.doesNotMatch(readFileSync(new URL(name, SRC), 'utf8'), /layout-v2/, name);
  assert.doesNotMatch(MAIN_SOURCE, /^import[^;]*layout-v2/m, 'main.mjs has no static layout-v2 import');
  assert.equal(MAIN_SOURCE.match(/import\('\.\/layout-v2-[a-z-]+\.mjs'\)/g)?.length, 1);
});

test('the layoutV2 pilot is evidenceSafe-gated and refuses a Ranked session', () => {
  assert.match(MAIN_SOURCE, /const layoutV2 = evidenceSafeEnabled && runtimeParams\.get\('layoutV2'\) === '1'\n\s+\? \(await import\('\.\/layout-v2-pilot\.mjs'\)\)\.mountLayoutV2Pilot\(/);
  const init = MAIN_SOURCE.indexOf('const initializeSession = (payload) => {');
  const refusal = MAIN_SOURCE.indexOf("if (layoutV2 && payload.mode === 'ranked') throw new Error('The layoutV2 pilot never runs Ranked');");
  assert.ok(init > 0 && refusal > init, 'the refusal lives in initializeSession');
  assert.ok(refusal < MAIN_SOURCE.indexOf('stopCurrentSession();', init), 'it refuses before any session state changes');
  assert.ok(refusal < MAIN_SOURCE.indexOf("evidenceGameplayEnabled = evidenceSafeEnabled && payload.mode !== 'ranked';"));
  // Off the pilot every consumer sees exactly the default map.
  assert.match(MAIN_SOURCE, /const baseBlockers = layoutV2\?\.world\.collisionBlockers \?\? LEVEL_ONE_WORLD\.collisionBlockers;/);
  assert.match(MAIN_SOURCE, /createEnemyNavGridChunked\(\{ world: layoutV2\?\.world \?\? LEVEL_ONE_WORLD, queryGround, cellsPerSlice: 512 \}\)/);
  assert.match(MAIN_SOURCE, /if \(layoutV2\) \{ queryGround = layoutV2\.queryGround; WORLD_BLOCKERS = baseBlockers;/);
  assert.doesNotMatch(MAIN_SOURCE, /worldDesignActiveBlockers\(worldDesignState,LEVEL_ONE_WORLD\.collisionBlockers\)/);
});
