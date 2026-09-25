// Perf step 3 (sim hot path): every optimized simulation function must stay
// bit-identical to the 1.8.1 release modules. The references in
// tests/fixtures/hmh-sim-reference/ are verbatim copies of those modules, so
// each check here runs the live and the release code side by side on the same
// inputs and compares exact float bits (Object.is), key order, Map/Set order
// and frozen state at every node. The headless 36,000-tick digest
// (scripts/hmh-sim-digest.mjs) and the browser census trace remain the
// end-to-end witnesses; these catch a divergence at the function that caused it.
import assert from 'node:assert/strict';
import test from 'node:test';

import * as liveBounds from '../apps/hmh-reboot/src/blocker-bounds.mjs';
import * as liveCollision from '../apps/hmh-reboot/src/collision.mjs';
import * as liveCombat from '../apps/hmh-reboot/src/enemy-combat.mjs';
import * as liveElevation from '../apps/hmh-reboot/src/elevation.mjs';
import * as liveEnemies from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import * as liveMelee from '../apps/hmh-reboot/src/melee.mjs';
import * as liveProjectiles from '../apps/hmh-reboot/src/projectile-physics.mjs';
import * as refBounds from './fixtures/hmh-sim-reference/blocker-bounds.mjs';
import * as refCollision from './fixtures/hmh-sim-reference/collision.mjs';
import * as refCombat from './fixtures/hmh-sim-reference/enemy-combat.mjs';
import * as refElevation from './fixtures/hmh-sim-reference/elevation.mjs';
import * as refEnemies from './fixtures/hmh-sim-reference/enemy-simulation.mjs';
import * as refMelee from './fixtures/hmh-sim-reference/melee.mjs';
import * as refProjectiles from './fixtures/hmh-sim-reference/projectile-physics.mjs';
import { createOrdinaryEnemyHurtboxProfile } from '../apps/hmh-reboot/src/enemy-hurtboxes.mjs';
import {
  computeEnemyFlowField,
  createEnemyNavGrid,
  navLineBlocked,
  sampleChokepointDirection,
  sampleCoverDirection,
  sampleFlankLaneDirection,
  sampleFlowDirection,
} from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { buildEnduranceEncounterCandidates } from '../apps/hmh-reboot/src/encounter-endurance-pilot.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { worldHazardField } from '../apps/hmh-reboot/src/world-hazards.mjs';

const BLOCKERS = LEVEL_ONE_WORLD.collisionBlockers;
const BOUNDS = LEVEL_ONE_WORLD.bounds;
const SPAWN = LEVEL_ONE_WORLD.player.spawn;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Exact structural identity: primitives by Object.is (so -0 !== 0), own keys in
// the same order, Maps and Sets in the same iteration order, the same frozen
// state everywhere, the same prototypes. Functions are skipped (index objects).
function assertBitIdentical(actual, expected, path = '$', seen = new Set()) {
  if (typeof actual === 'function' && typeof expected === 'function') return;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') {
    if (!Object.is(actual, expected)) assert.fail(`${path}: ${String(actual)} !== ${String(expected)}`);
    return;
  }
  if (actual === expected) {
    // Shared input objects (world blockers, surfaces) are identical by definition.
    return;
  }
  if (seen.has(actual)) return;
  seen.add(actual);
  assert.equal(Object.getPrototypeOf(actual), Object.getPrototypeOf(expected), `${path}: prototype`);
  assert.equal(Object.isFrozen(actual), Object.isFrozen(expected), `${path}: frozen state`);
  if (actual instanceof Map) {
    const a = [...actual.entries()];
    const e = [...expected.entries()];
    assert.equal(a.length, e.length, `${path}: map size`);
    a.forEach(([key, value], index) => {
      assertBitIdentical(key, e[index][0], `${path}<key ${index}>`, seen);
      assertBitIdentical(value, e[index][1], `${path}<${String(key)}>`, seen);
    });
    return;
  }
  if (actual instanceof Set) {
    assertBitIdentical([...actual], [...expected], `${path}<set>`, seen);
    return;
  }
  const keys = Reflect.ownKeys(actual);
  assert.deepEqual(keys, Reflect.ownKeys(expected), `${path}: own keys`);
  for (const key of keys) assertBitIdentical(actual[key], expected[key], `${path}.${String(key)}`, seen);
}

function countCalls(owner, name, run) {
  const original = owner[name];
  let calls = 0;
  owner[name] = function counted(...args) {
    calls += 1;
    return original.apply(this, args);
  };
  try {
    run();
  } finally {
    owner[name] = original;
  }
  return calls;
}

const liveGround = liveElevation.createAuthoredGroundQuery({ baseSurface: LEVEL_ONE_WORLD.baseSurface, surfaces: LEVEL_ONE_WORLD.surfaces });
const refGround = refElevation.createAuthoredGroundQuery({ baseSurface: LEVEL_ONE_WORLD.baseSurface, surfaces: LEVEL_ONE_WORLD.surfaces });

function surfaceProbePoints(random, count) {
  const points = [];
  const edges = [];
  for (const surface of LEVEL_ONE_WORLD.surfaces) {
    const area = surface.area;
    if (area.type === 'rect') {
      for (const x of [area.minX, area.maxX, area.minX - 1e-9, area.maxX + 1e-9, area.minX + 1e-10, area.maxX - 2e-9]) {
        edges.push({ x, y: (area.minY + area.maxY) / 2 });
      }
      for (const y of [area.minY, area.maxY, area.minY - 1e-9, area.maxY + 1e-9]) edges.push({ x: (area.minX + area.maxX) / 2, y });
    } else {
      for (const vertex of area.vertices) edges.push({ x: vertex.x, y: vertex.y }, { x: vertex.x + 1e-9, y: vertex.y - 1e-9 });
    }
  }
  points.push(...edges);
  for (let index = 0; index < count; index += 1) {
    const surface = LEVEL_ONE_WORLD.surfaces[index % LEVEL_ONE_WORLD.surfaces.length];
    const area = surface.area.type === 'rect' ? surface.area : null;
    if (area && index % 3 !== 0) {
      points.push({ x: area.minX - 40 + random() * (area.maxX - area.minX + 80), y: area.minY - 40 + random() * (area.maxY - area.minY + 80) });
    } else {
      points.push({ x: -50 + random() * (BOUNDS.maxX + 100), y: -50 + random() * (BOUNDS.maxY + 100) });
    }
  }
  return points;
}

test('Level 1 ground queries return the release sample bit for bit, frozen the same way', () => {
  const random = rng(0x6e0d1);
  for (const point of surfaceProbePoints(random, 6000)) {
    assertBitIdentical(liveGround(point.x, point.y), refGround(point.x, point.y), `ground(${point.x},${point.y})`);
  }
  // Ramps, stairs and one-way ledges on a hand-authored course.
  const surfaces = [
    liveElevation.createElevationSurface({ id: 'ramp-x', kind: 'ramp', area: { type: 'rect', minX: 0, minY: 0, maxX: 200, maxY: 100 }, fromZ: 0, toZ: 48, axis: 'x', visibleTerrainId: 'ramp', priority: 3 }),
    liveElevation.createElevationSurface({ id: 'stairs-y', kind: 'stairs', area: { type: 'polygon', vertices: [{ x: 200, y: 0 }, { x: 320, y: 0 }, { x: 320, y: 180 }, { x: 200, y: 180 }] }, fromZ: 48, toZ: 0, axis: 'y', visibleTerrainId: 'stairs', priority: 2 }),
    liveElevation.createElevationSurface({ id: 'ledge', kind: 'ledge', area: { type: 'rect', minX: -100, minY: 100, maxX: 100, maxY: 220 }, groundZ: 32, visibleTerrainId: 'ledge', oneWayDrop: { x: 0, y: 3 }, visibleStepId: 'lip' }),
    liveElevation.createElevationSurface({ id: 'pool', kind: 'water', area: { type: 'polygon', vertices: [{ x: -200, y: -200 }, { x: -60, y: -220 }, { x: -40, y: -60 }, { x: -210, y: -80 }] }, waterLevel: -8, visibleTerrainId: 'water' }),
  ];
  const base = liveElevation.createElevationSurface({ id: 'base', kind: 'ground', area: { type: 'rect', minX: -400, minY: -400, maxX: 600, maxY: 600 }, visibleTerrainId: 'base' });
  const live = liveElevation.createAuthoredGroundQuery({ baseSurface: base, surfaces });
  const ref = refElevation.createAuthoredGroundQuery({ baseSurface: base, surfaces });
  for (let index = 0; index < 4000; index += 1) {
    const x = -420 + random() * 1040;
    const y = -420 + random() * 1040;
    assertBitIdentical(live(x, y), ref(x, y), `course(${x},${y})`);
  }
  // Points on and around the 256-unit index cell edges of every Level 1 surface.
  for (const surface of LEVEL_ONE_WORLD.surfaces) {
    const area = surface.area;
    const xs = area.type === 'rect' ? [area.minX, area.maxX] : area.vertices.map((vertex) => vertex.x);
    const ys = area.type === 'rect' ? [area.minY, area.maxY] : area.vertices.map((vertex) => vertex.y);
    for (const x of xs) {
      for (const y of ys) {
        for (const cellX of [Math.floor(x / 256) * 256, Math.ceil(x / 256) * 256]) {
          for (const offset of [-1e-7, 0, 1e-7]) {
            assertBitIdentical(liveGround(cellX + offset, y), refGround(cellX + offset, y), `cell edge (${cellX + offset},${y})`);
            assertBitIdentical(liveGround(x, Math.floor(y / 256) * 256 + offset), refGround(x, Math.floor(y / 256) * 256 + offset), `cell edge (${x},${y})`);
          }
        }
      }
    }
  }
  // Hand-built, mutable surfaces (no index) and far-away or huge surfaces keep
  // the release scan and the release deep freeze of a mutable one-way drop.
  const handBuilt = (id, area, extra = {}) => ({ id, kind: 'ledge', area, groundZ: 12, fromZ: 12, toZ: 12, axis: 'x', visibleTerrainId: id, priority: 1, walkable: true, deepWater: false, waterLevel: null, oneWayDrop: { x: 1, y: 0 }, visibleStepId: null, ascentAllowed: false, ...extra });
  for (const variant of [
    [handBuilt('mutable', { type: 'rect', minX: 0, minY: 0, maxX: 90, maxY: 90 })],
    [handBuilt('far', Object.freeze({ type: 'rect', minX: 5e9, minY: -5e9, maxX: 5e9 + 400, maxY: -5e9 + 300 }))],
    [handBuilt('huge', Object.freeze({ type: 'rect', minX: -1e7, minY: -1e7, maxX: 1e7, maxY: 1e7 }))],
  ]) {
    const liveQuery = liveElevation.createAuthoredGroundQuery({ baseSurface: base, surfaces: variant });
    const refVariant = variant.map((surface) => ({ ...surface, oneWayDrop: { ...surface.oneWayDrop } }));
    const refQuery = refElevation.createAuthoredGroundQuery({ baseSurface: base, surfaces: refVariant });
    for (const [x, y] of [[10, 10], [95, 95], [5e9 + 1, -5e9 + 1], [5e9 - 1, -5e9], [-9e6, 9e6], [2e7, 0]]) {
      assertBitIdentical(liveQuery(x, y), refQuery(x, y), `${variant[0].id} (${x},${y})`);
    }
  }
  assert.throws(() => live(Number.NaN, 0), /ground query x must be finite/);
  assert.throws(() => live(0, Infinity), /ground query y must be finite/);
});

test('ground queries freeze their samples without a deep walk of every result', () => {
  const random = rng(0x77);
  const points = surfaceProbePoints(random, 1200);
  const calls = countCalls(Object, 'values', () => {
    for (const point of points) liveGround(point.x, point.y);
  });
  assert.equal(calls, 0, 'a ground sample is built frozen; walking it again is pure overhead on the hottest query');
  const sample = liveGround(SPAWN.x, SPAWN.y);
  assert.ok(Object.isFrozen(sample) && Object.isFrozen(sample.normal));
});

test('swept traversal paths match the release resolver on Level 1 and freeze without a deep walk', () => {
  const random = rng(0x5eed);
  const cases = [];
  for (let index = 0; index < 2500; index += 1) {
    const surface = LEVEL_ONE_WORLD.surfaces[index % LEVEL_ONE_WORLD.surfaces.length];
    const anchor = surface.area.type === 'rect'
      ? { x: surface.area.minX + random() * (surface.area.maxX - surface.area.minX), y: surface.area.minY + random() * (surface.area.maxY - surface.area.minY) }
      : surface.area.vertices[index % surface.area.vertices.length];
    const start = { x: anchor.x + (random() - 0.5) * 160, y: anchor.y + (random() - 0.5) * 160 };
    const length = index % 9 === 0 ? 0 : random() * (index % 4 === 0 ? 220 : 14);
    const angle = random() * Math.PI * 2;
    const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
    const options = index % 5 === 0 ? {} : { maxCurbHeight: [0, 8, 12][index % 3], maxDropHeight: [4, 16, 40][index % 3], maxAuthoredAscent: [0, 32, 64][index % 3] };
    cases.push({ start, end, maxSampleDistance: [4, 7, 11, 24][index % 4], transitionOptions: options });
  }
  for (const input of cases) {
    const live = liveElevation.resolveSweptTraversalPath({ ...input, queryGround: liveGround });
    const ref = refElevation.resolveSweptTraversalPath({ ...input, queryGround: refGround });
    assertBitIdentical(live, ref, `traversal ${JSON.stringify(input)}`);
  }
  const calls = countCalls(Object, 'values', () => {
    for (const input of cases.slice(0, 600)) liveElevation.resolveSweptTraversalPath({ ...input, queryGround: liveGround });
  });
  assert.equal(calls, 0, 'traversal results are assembled from frozen samples and fresh points');
  // A caller-supplied ground query that returns mutable samples still gets them
  // frozen, exactly like the release deep freeze did.
  const mutableGround = (x, y) => ({ x, y, groundZ: 0, kind: 'ground', walkable: true, deepWater: false, normal: { x: 0, y: 0, z: 1 }, oneWayDrop: null, visibleStepId: null });
  const live = liveElevation.resolveSweptTraversalPath({ start: { x: 0, y: 0 }, end: { x: 30, y: 0 }, queryGround: mutableGround });
  const ref = refElevation.resolveSweptTraversalPath({ start: { x: 0, y: 0 }, end: { x: 30, y: 0 }, queryGround: mutableGround });
  assertBitIdentical(live, ref, 'mutable ground');
  assert.ok(Object.isFrozen(live.ground.normal));
});

test('the immutable blocker index returns the release candidate list for every query shape', () => {
  const live = liveBounds.immutableBlockerIndex(BLOCKERS);
  const ref = refBounds.immutableBlockerIndex(BLOCKERS);
  assert.deepEqual(live.ordered, ref.ordered);
  const random = rng(0xb10c);
  for (let index = 0; index < 20000; index += 1) {
    const blocker = BLOCKERS[index % BLOCKERS.length];
    const shape = blocker.shape;
    const anchor = shape.type === 'circle' ? shape : shape.type === 'capsule' ? shape.a : shape.vertices[0];
    const x = index % 3 === 0 ? -600 + random() * (BOUNDS.maxX + 1200) : anchor.x + (random() - 0.5) * 700;
    const y = index % 3 === 0 ? -600 + random() * (BOUNDS.maxY + 1200) : anchor.y + (random() - 0.5) * 700;
    const reach = [0, 1, 25, 300, 4000, 20000][index % 6];
    const dx = index % 7 === 0 ? 0 : (random() - 0.5) * reach;
    const dy = index % 11 === 0 ? 0 : (random() - 0.5) * reach;
    const radius = [0, 1e-9, 12, 22, 42, 128][index % 6];
    const a = live.query(x, y, dx, dy, radius);
    const e = ref.query(x, y, dx, dy, radius);
    assert.equal(a.length, e.length, `query ${index} length`);
    for (let item = 0; item < a.length; item += 1) assert.equal(a[item], e[item], `query ${index} item ${item}`);
  }
  // Cell edges: a query box that ends exactly on a 256-unit cell boundary.
  for (const x of [255.999999, 256, 256.000001, -0.0000001, 0, 511.9999995]) {
    for (const radius of [0, 5]) {
      const a = live.query(x, 1024, 0, 0, radius);
      const e = ref.query(x, 1024, 0, 0, radius);
      assert.deepEqual(a.map((blocker) => blocker.id), e.map((blocker) => blocker.id));
    }
  }
});

test('swept collision and line of sight match the release resolvers bit for bit on Level 1', () => {
  const random = rng(0x48130926);
  const bodies = [12, 22, 42].map((radius) => liveCollision.createCollisionBody({ id: `r${radius}`, radius, minZ: 0, maxZ: 58 }));
  const refBodies = [12, 22, 42].map((radius) => refCollision.createCollisionBody({ id: `r${radius}`, radius, minZ: 0, maxZ: 58 }));
  const mutable = BLOCKERS.slice(0, 40);
  for (let index = 0; index < 5000; index += 1) {
    const blocker = BLOCKERS[index % BLOCKERS.length];
    const shape = blocker.shape;
    const anchor = shape.type === 'circle' ? shape : shape.type === 'capsule' ? shape.a : shape.vertices[0];
    const start = index % 2 ? { x: random() * BOUNDS.maxX, y: random() * BOUNDS.maxY, z: 0 } : { x: anchor.x + (random() - 0.5) * 90, y: anchor.y + (random() - 0.5) * 90, z: 0 };
    start.z = index % 7 === 0 ? 64 : 0;
    const delta = { x: (random() - 0.5) * (index % 5 === 0 ? 1200 : 25), y: (random() - 0.5) * (index % 5 === 0 ? 1200 : 25) };
    const blockers = index % 13 === 0 ? mutable : BLOCKERS;
    const input = { start, delta, blockers, bounds: BOUNDS, stopOnFirstContact: index % 11 === 0, priorZeroDisplacementFrames: index % 4 };
    assertBitIdentical(
      liveCollision.resolveSweptCircleMotion({ ...input, body: bodies[index % 3] }),
      refCollision.resolveSweptCircleMotion({ ...input, body: refBodies[index % 3] }),
      `motion ${index}`,
    );
    const sight = { from: { ...start, z: start.z + 34 }, to: { x: start.x + delta.x * 6, y: start.y + delta.y * 6, z: start.z + 34 }, radius: index % 3, blockers };
    assertBitIdentical(liveElevation.traceHeightAwareLineOfSight(sight), refElevation.traceHeightAwareLineOfSight(sight), `sight ${index}`);
  }
});

function crowd(random, count, spread, { duplicates = false } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: duplicates && index % 9 === 0 ? `enemy-${index - 1}` : `enemy-${index}`,
    active: index % 17 !== 0,
    health: index % 13 === 0 ? 0 : 10,
    x: Math.floor(random() * spread) + (index % 5 === 0 ? 0.5 : 0),
    y: Math.floor(random() * spread) - (index % 7 === 0 ? 0.25 : 0),
    radius: [14, 22, 38][index % 3],
  }));
}

test('crowd separation matches the release broadphase for dense, sparse, off-origin and duplicate-id crowds', () => {
  const random = rng(0x5e9a);
  for (let sample = 0; sample < 160; sample += 1) {
    const spread = [1, 30, 90, 400, 2500, 12000][sample % 6];
    const enemies = crowd(random, [128, 192, 40, 7][sample % 4], spread, { duplicates: sample % 10 === 3 });
    if (sample % 8 === 5) for (const enemy of enemies) { enemy.x -= 5000; enemy.y -= 900; }
    if (sample % 12 === 7) for (const enemy of enemies) { enemy.x = Math.round(enemy.x / 96) * 96; enemy.y = Math.round(enemy.y / 96) * 96; }
    const options = [{}, { maxNeighbors: 1 }, { maxNeighbors: 16, neighborRadius: 180, cellSize: 60 }, { neighborRadius: 40, cellSize: 200, strength: 1, maxStep: 2 }][sample % 4];
    assertBitIdentical(liveEnemies.computeEnemySeparation(enemies, options), refEnemies.computeEnemySeparation(enemies, options), `separation ${sample}`);
    assertBitIdentical(
      liveEnemies.getEnemyFormationBias(enemies.filter((enemy) => enemy.active), { player: { x: spread / 2, y: spread / 3 } }),
      refEnemies.getEnemyFormationBias(enemies.filter((enemy) => enemy.active), { player: { x: spread / 2, y: spread / 3 } }),
      `formation ${sample}`,
    );
  }
  // Coordinates so large that squared distances overflow take the exact fallback.
  const huge = [{ id: 'a', active: true, x: 1e200, y: 0, radius: 10 }, { id: 'b', active: true, x: 1e200, y: 5, radius: 10 }];
  assertBitIdentical(liveEnemies.computeEnemySeparation(huge, { neighborRadius: 1e160, cellSize: 1e159 }), refEnemies.computeEnemySeparation(huge, { neighborRadius: 1e160, cellSize: 1e159 }), 'overflow');
  // Far enough out that cell + 1 === cell: every lookup of a row revisits the
  // same bucket, so one body sees each neighbour many times over.
  const revisited = Array.from({ length: 24 }, (_, index) => ({ id: `far-${String(index).padStart(2, '0')}`, active: true, x: 1e200, y: (index * 7) % 23, radius: 5 + index }));
  for (const options of [{ neighborRadius: 1e160, cellSize: 1e159 }, { neighborRadius: 1e160, cellSize: 1e159, maxNeighbors: 30 }, { neighborRadius: 40, cellSize: 7 }]) {
    assertBitIdentical(liveEnemies.computeEnemySeparation(revisited, options), refEnemies.computeEnemySeparation(revisited, options), `revisited ${JSON.stringify(options)}`);
  }
  for (const bad of [[{ id: 'x', active: true, x: Number.NaN, y: 0, radius: 1 }], [{ id: 'x', active: true, x: 0, y: Infinity, radius: 1 }]]) {
    assert.throws(() => liveEnemies.computeEnemySeparation(bad), /must be finite/);
  }
});

function crowdNavigation(grid, fieldState) {
  return Object.freeze({
    lineBlocked: (fromX, fromY, toX, toY) => navLineBlocked(grid, fromX, fromY, toX, toY),
    coverDirectionAt: (fromX, fromY, toX, toY, options) => sampleCoverDirection(grid, fromX, fromY, toX, toY, options),
    chokepointDirectionAt: (fromX, fromY, toX, toY, options) => sampleChokepointDirection(grid, fromX, fromY, toX, toY, options),
    flankLaneDirectionAt: (fromX, fromY, toX, toY, options) => sampleFlankLaneDirection(grid, fromX, fromY, toX, toY, options),
    hazardDirectionAt: (x, y, direct, options) => ((Math.floor(x / 97) + Math.floor(y / 89)) % 23 === 0
      ? { direction: { x: -direct.y * options.stableSide, y: direct.x * options.stableSide } }
      : null),
    requestReplan: (_id, tick) => { fieldState.replan = Math.max(fieldState.replan, tick); },
    flowDirectionAt: (x, y) => sampleFlowDirection(grid, fieldState.field, x, y),
  });
}

function spawnPointBlocked(point) {
  return BLOCKERS.some((blocker) => {
    const shape = blocker.shape;
    if (shape.type === 'circle') return Math.hypot(point.x - shape.x, point.y - shape.y) <= shape.radius + 24;
    if (shape.type === 'capsule') {
      const dx = shape.b.x - shape.a.x;
      const dy = shape.b.y - shape.a.y;
      const t = Math.max(0, Math.min(1, ((point.x - shape.a.x) * dx + (point.y - shape.a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(point.x - (shape.a.x + dx * t), point.y - (shape.a.y + dy * t)) <= shape.radius + 24;
    }
    let inside = false;
    for (let index = 0, previous = shape.vertices.length - 1; index < shape.vertices.length; previous = index, index += 1) {
      const a = shape.vertices[index];
      const b = shape.vertices[previous];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  });
}

function levelCrowd(module, queryGround, seed) {
  const population = module.createEnemyPopulation({ capacity: 192, threatCapacity: 4096 });
  const candidates = buildEnduranceEncounterCandidates({ count: 128, seed, origin: SPAWN, bounds: BOUNDS, queryGround, isBlocked: spawnPointBlocked });
  for (const candidate of candidates) {
    const result = module.attemptScheduledEnemyInsertion({
      population,
      schedule: { nextSpawnTick: 0, intervalTicks: 1, burstRemaining: 1 },
      candidate,
      tick: 0,
      placementAllowed: true,
      visualMode: 'normal',
    });
    assert.equal(result.inserted, true);
  }
  return population;
}

test('a 128-body Level 1 crowd steps, attacks and resolves melee in lockstep with the release modules', () => {
  const grid = createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround: liveGround });
  const sides = [
    { enemies: liveEnemies, combat: liveCombat, melee: liveMelee, ground: liveGround, collision: liveCollision },
    { enemies: refEnemies, combat: refCombat, melee: refMelee, ground: refGround, collision: refCollision },
  ].map((side) => {
    const fieldState = { field: null, tick: -1, replan: -1 };
    return { ...side, fieldState, population: levelCrowd(side.enemies, side.ground, 0x484d4804), navigation: crowdNavigation(grid, fieldState), meleeState: side.melee.createMeleeState() };
  });
  const [live, ref] = sides;
  assertBitIdentical(live.population, ref.population, 'inserted population');
  const hazards = LEVEL_ONE_WORLD.interactions.hazards;
  for (let tick = 1; tick <= 900; tick += 1) {
    const angle = tick / 180;
    const player = { x: SPAWN.x + Math.cos(angle) * 260, y: SPAWN.y + Math.sin(angle * 1.3) * 180, groundZ: 0 };
    player.groundZ = liveGround(player.x, player.y).groundZ;
    const outputs = sides.map((side) => {
      if (side.fieldState.field === null || tick - side.fieldState.tick >= 30 || side.fieldState.replan > side.fieldState.tick) {
        side.fieldState.field = computeEnemyFlowField({ grid, targetX: player.x, targetY: player.y });
        side.fieldState.tick = tick;
        side.fieldState.replan = -1;
      }
      const step = side.enemies.stepEnemyPopulation({
        population: side.population,
        player,
        tick,
        dtSeconds: 1 / 60,
        blockers: BLOCKERS,
        bounds: BOUNDS,
        queryGround: side.ground,
        preservePrevious: tick % 3 !== 0,
        navigation: side.navigation,
        fullAiCap: tick < 450 ? 48 : 192,
        fieldAt: (x, y, ground) => worldHazardField(hazards, { x, y, groundZ: ground.groundZ }),
      });
      const attacks = side.combat.stepEnemyAttacks({ enemies: side.population.active, player: { id: 'player', ...player, radius: 24 }, tick });
      const targets = side.population.active.filter((enemy) => enemy.active).map((enemy) => side.melee.createMeleeTarget({
        id: enemy.id,
        previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
        currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
        radius: createOrdinaryEnemyHurtboxProfile(enemy.radius).meleeRadius,
      }));
      const melee = side.melee.stepMeleeState(side.meleeState, {
        tick,
        automatic: true,
        origin: { x: player.x, y: player.y },
        sourceGroundZ: player.groundZ,
        direction: { x: Math.cos(angle * 3), y: Math.sin(angle * 3) },
        targets,
        blockers: BLOCKERS,
      });
      if (tick % 150 === 0) {
        const victim = side.population.active[(tick / 150) % side.population.active.length];
        side.enemies.retireEnemyFromPopulation(side.population, victim.id, { tick, reason: 'defeated' });
      }
      return { step, attacks, targets, melee };
    });
    assertBitIdentical(outputs[0], outputs[1], `tick ${tick} outputs`);
    assertBitIdentical(live.population, ref.population, `tick ${tick} population`);
  }
});

test('a population holding repeated ids steps exactly like the release id-keyed separation', () => {
  const build = (module) => {
    const population = module.createEnemyPopulation({ capacity: 64, threatCapacity: 4096 });
    for (let index = 0; index < 40; index += 1) {
      population.active.push(module.createEnemyState({
        archetypeId: ['bagholder-rusher', 'forkrunner', 'whale-enforcer'][index % 3],
        id: `twin-${String(index % 13).padStart(2, '0')}`,
        x: SPAWN.x + (index % 7) * 9,
        y: SPAWN.y + Math.floor(index / 7) * 11,
        groundZ: 0,
        visualMode: 'prototype',
      }));
    }
    return population;
  };
  const live = build(liveEnemies);
  const ref = build(refEnemies);
  for (let tick = 1; tick <= 40; tick += 1) {
    const input = { player: { x: SPAWN.x + 300, y: SPAWN.y - 120, groundZ: 0 }, tick, dtSeconds: 1 / 60, blockers: BLOCKERS, bounds: BOUNDS };
    assertBitIdentical(
      liveEnemies.stepEnemyPopulation({ ...input, population: live, queryGround: liveGround }),
      refEnemies.stepEnemyPopulation({ ...input, population: ref, queryGround: refGround }),
      `twin tick ${tick}`,
    );
    assertBitIdentical(live.active, ref.active, `twin tick ${tick} population`);
  }
});

test('enemy intents keep the release plan and freeze navigation-supplied vectors like the release deep freeze', () => {
  const random = rng(0x1a7e);
  const archetypes = ['bagholder-rusher', 'forkrunner', 'liquidator-agent', 'whale-enforcer', 'gas-bomber', 'validator-cultist'];
  for (let index = 0; index < 3000; index += 1) {
    const archetypeId = archetypes[index % archetypes.length];
    const make = (module) => {
      const enemy = module.createEnemyState({ archetypeId, id: `intent-${index}`, x: random() * 900, y: random() * 900, visualMode: 'prototype' });
      enemy.attackPhase = ['ready', 'tell', 'attack', 'recovery'][index % 4];
      return enemy;
    };
    const liveEnemy = make(liveEnemies);
    const refEnemy = refEnemies.createEnemyState({ archetypeId, id: liveEnemy.id, x: liveEnemy.x, y: liveEnemy.y, visualMode: 'prototype' });
    refEnemy.attackPhase = liveEnemy.attackPhase;
    const player = { x: random() * 900, y: random() * 900 };
    const pick = random();
    const makeNavigation = () => (index % 6 === 0 ? null : {
      lineBlocked: () => pick < 0.3,
      flowDirectionAt: () => (pick < 0.15 ? { x: 0.6, y: -0.8 } : null),
      hazardDirectionAt: () => (pick > 0.9 ? { direction: { x: -1, y: 0.5 } } : null),
      coverDirectionAt: () => (pick > 0.5 && pick < 0.7 ? { direction: { x: 0.3, y: 0.4 }, target: { x: 5, y: 6, nested: { depth: 1 } } } : null),
      chokepointDirectionAt: () => (pick > 0.35 && pick < 0.6 ? { direction: { x: 1, y: 1 }, holding: pick > 0.5, target: { x: 1, y: 2 } } : null),
      flankLaneDirectionAt: () => (pick > 0.2 ? { direction: { x: 0.8, y: 0.6 }, target: { x: 9, y: 9 } } : null),
    });
    const options = { player, tick: index + 1, formationBias: index % 3 === 0 ? 0 : (random() - 0.5) * 0.3 };
    const liveNavigation = makeNavigation();
    const refNavigation = makeNavigation();
    const livePlan = liveEnemies.planEnemyIntent(liveEnemy, { ...options, navigation: liveNavigation });
    const refPlan = refEnemies.planEnemyIntent(refEnemy, { ...options, navigation: refNavigation });
    assertBitIdentical(livePlan, refPlan, `intent ${index}`);
  }
  const quiet = liveEnemies.createEnemyState({ archetypeId: 'bagholder-rusher', id: 'quiet', x: 0, y: 0, visualMode: 'prototype' });
  const calls = countCalls(Object, 'values', () => {
    for (let tick = 1; tick < 400; tick += 1) liveEnemies.planEnemyIntent(quiet, { player: { x: 300, y: tick }, tick, formationBias: 0.1 });
  });
  assert.equal(calls, 0, 'a plain pursuit plan is assembled frozen instead of deep-walked');
});

function makeTargets(module, random, count, center) {
  const targets = [];
  for (let index = 0; index < count; index += 1) {
    const radius = [14, 18, 22, 38][index % 4];
    const profile = createOrdinaryEnemyHurtboxProfile(radius);
    const x = center.x + (random() - 0.5) * 900;
    const y = center.y + (random() - 0.5) * 900;
    const z = index % 11 === 0 ? 40 : 0;
    const moveX = (random() - 0.5) * 8;
    const moveY = (random() - 0.5) * 8;
    const ids = ['Enemy-', 'enemy-', 'énemy-', 'ENEMY_', 'enemy.'];
    targets.push(module.createHurtTarget({
      id: `${ids[index % ids.length]}${String(index % 13 === 0 ? index * 7 : index).padStart(3, '0')}`,
      bodyShape: index % 9 === 0 ? { type: 'circle', radius } : profile.bodyShape,
      hurtShape: index % 9 === 0 ? { type: 'circle', x: 0, y: 0, radius } : profile.projectileShape,
      previousGround: { x: x - moveX, y: y - moveY, z },
      currentGround: { x, y, z },
      minZ: index % 5 === 0 ? 12 : 4,
      maxZ: 60,
      health: index % 23 === 0 ? 0.5 : 20 + index,
      active: index % 29 !== 0,
    }));
  }
  return targets;
}

const POLICIES = [
  { type: 'stop' },
  { type: 'pellet' },
  { type: 'hitscan' },
  { type: 'pierce', maxTargets: 3 },
  { type: 'pierce', maxTargets: 1 },
  { type: 'ricochet', maxBounces: 2 },
  { type: 'ricochet', maxBounces: 0 },
  { type: 'splash', radius: 70 },
];

function makeShots(module, random, count, center, targets) {
  const shots = [];
  for (let index = 0; index < count; index += 1) {
    const policy = POLICIES[(index + Math.floor(random() * 3)) % POLICIES.length];
    const x = center.x + (random() - 0.5) * 700;
    const y = center.y + (random() - 0.5) * 700;
    const angle = random() * Math.PI * 2;
    const length = policy.type === 'hitscan' ? 300 + random() * 900 : 6 + random() * 90;
    const z = 20 + random() * 60;
    const excluded = policy.type === 'pierce' && index % 2 === 0 ? targets.filter((_, t) => (t + index) % 17 === 0).map((target) => target.id) : null;
    shots.push(module.createProjectileState({
      id: `shot-${String(index).padStart(3, '0')}${index % 5 === 0 ? 'B' : 'a'}`,
      ownerId: 'player',
      previous: { x, y, z },
      current: { x: x + Math.cos(angle) * length, y: y + Math.sin(angle) * length, z: index % 4 === 0 ? z - 12 : z },
      heightTransition: index % 6 === 0 ? { time: 0.25 + random() * 0.5 } : null,
      radius: [0, 2, 4, 9][index % 4],
      damage: 5 + (index % 7) * 6,
      policy,
      excludeTargetIds: excluded,
      damageScale: index % 3 === 0 ? 1 : 0.35 + random() * 0.65,
    }));
  }
  return shots;
}

const CUSTOM_BLOCKERS = [
  liveCollision.createStaticBlocker({ id: 'cover-circle', shape: { type: 'circle', x: 0, y: 0, radius: 26 }, visibleAssetId: 'crate', combatCover: true, minZ: 0, maxZ: 64 }),
  liveCollision.createStaticBlocker({ id: 'cover-capsule', shape: { type: 'capsule', a: { x: -120, y: 60 }, b: { x: 140, y: 60 }, radius: 10 }, visibleAssetId: 'wall', combatCover: true, minZ: 0, maxZ: 48 }),
  liveCollision.createStaticBlocker({ id: 'Cover-poly', shape: { type: 'polygon', vertices: [{ x: 200, y: -80 }, { x: 290, y: -80 }, { x: 290, y: 10 }, { x: 200, y: 10 }] }, visibleAssetId: 'block', combatCover: true, minZ: 0, maxZ: 90 }),
  liveCollision.createStaticBlocker({ id: 'no-cover', shape: { type: 'circle', x: -200, y: -200, radius: 40 }, visibleAssetId: 'bush', combatCover: false }),
];

test('projectile batches resolve every policy exactly like the release resolver, with and without the hurtbox grid', () => {
  const random = rng(0xba7c4);
  for (let scene = 0; scene < 260; scene += 1) {
    const anchorBlocker = BLOCKERS[(scene * 7) % BLOCKERS.length].shape;
    const anchor = anchorBlocker.type === 'circle' ? anchorBlocker : anchorBlocker.type === 'capsule' ? anchorBlocker.a : anchorBlocker.vertices[0];
    const center = scene % 5 === 4 ? { x: 0, y: 0 } : { x: anchor.x, y: anchor.y };
    const blockers = scene % 5 === 4 ? CUSTOM_BLOCKERS : scene % 7 === 3 ? BLOCKERS.slice(0, 60) : BLOCKERS;
    const targetCount = [0, 12, 63, 64, 128, 160][scene % 6];
    const seed = Math.floor(random() * 2 ** 31);
    const liveTargets = makeTargets(liveProjectiles, rng(seed), targetCount, center);
    const refTargets = makeTargets(refProjectiles, rng(seed), targetCount, center);
    assertBitIdentical(liveTargets, refTargets, `scene ${scene} targets`);
    const shotSeed = Math.floor(random() * 2 ** 31);
    const shotCount = [1, 3, 8, 24, 60][scene % 5];
    const liveShots = makeShots(liveProjectiles, rng(shotSeed), shotCount, center, liveTargets);
    const refShots = makeShots(refProjectiles, rng(shotSeed), shotCount, center, refTargets);
    assertBitIdentical(liveShots, refShots, `scene ${scene} shots`);
    const useGrid = scene % 3 !== 0 && targetCount > 0;
    const liveGrid = useGrid ? new liveProjectiles.UniformHurtboxGrid({ targets: liveTargets, cellSize: [96, 40, 300][scene % 3] }) : null;
    const refGrid = useGrid ? new refProjectiles.UniformHurtboxGrid({ targets: refTargets, cellSize: [96, 40, 300][scene % 3] }) : null;
    if (useGrid) {
      for (const shot of liveShots.slice(0, 6)) {
        const refShot = refShots[liveShots.indexOf(shot)];
        assertBitIdentical(liveGrid.query(shot), refGrid.query(refShot), `scene ${scene} grid query`);
        assertBitIdentical(
          liveProjectiles.queryProjectileCandidates({ projectile: shot, targets: liveTargets }),
          refProjectiles.queryProjectileCandidates({ projectile: refShot, targets: refTargets }),
          `scene ${scene} linear candidates`,
        );
      }
    }
    const liveBatch = liveProjectiles.resolveProjectileBatch({ projectiles: liveShots, targets: liveTargets, blockers, broadphase: liveGrid });
    const refBatch = refProjectiles.resolveProjectileBatch({ projectiles: refShots, targets: refTargets, blockers, broadphase: refGrid });
    assertBitIdentical(liveBatch, refBatch, `scene ${scene} batch`);
    for (const [index, shot] of liveShots.slice(0, 4).entries()) {
      assertBitIdentical(
        liveProjectiles.resolveProjectilePath({ projectile: shot, targets: liveTargets, blockers, broadphase: liveGrid }),
        refProjectiles.resolveProjectilePath({ projectile: refShots[index], targets: refTargets, blockers, broadphase: refGrid }),
        `scene ${scene} path ${index}`,
      );
    }
  }
});

test('projectile batches keep the release validation errors', () => {
  const target = liveProjectiles.createHurtTarget({ id: 'a', bodyShape: { type: 'circle', radius: 10 }, hurtShape: { type: 'circle', radius: 10 }, previousGround: { x: 0, y: 0, z: 0 }, currentGround: { x: 0, y: 0, z: 0 }, minZ: 0, maxZ: 40, health: 5 });
  const shot = liveProjectiles.createProjectileState({ id: 's', ownerId: 'player', previous: { x: -50, y: 0, z: 20 }, current: { x: 50, y: 0, z: 20 }, damage: 3 });
  for (const module of [liveProjectiles, refProjectiles]) {
    assert.throws(() => module.resolveProjectileBatch({ projectiles: [shot], targets: [target, target] }), /duplicate target id a/);
    assert.throws(() => module.resolveProjectileBatch({ projectiles: [shot, shot], targets: [target] }), /duplicate projectile id s/);
    assert.throws(() => module.resolveProjectileBatch({ projectiles: [shot], targets: [target], blockers: [CUSTOM_BLOCKERS[0], CUSTOM_BLOCKERS[0]] }), /duplicate blocker id cover-circle/);
    assert.throws(() => module.resolveProjectileBatch({ projectiles: [shot], targets: [target], blockers: [{}] }), /blocker id is required/);
    assert.throws(() => module.resolveProjectileBatch({ projectiles: [shot], targets: [target], broadphase: {} }), /broadphase must expose query/);
    assert.throws(() => module.resolveProjectileBatch({ projectiles: [{ ...shot, damage: -1 }], targets: [target] }), /projectile.damage must be positive/);
    // An empty batch never inspects blockers, exactly like the release loop.
    assert.doesNotThrow(() => module.resolveProjectileBatch({ projectiles: [], targets: [target], blockers: [{}] }));
  }
});

test('a projectile never narrow-phases cover that its segment cannot reach', () => {
  let shapeReads = 0;
  const far = Object.freeze(Array.from({ length: 200 }, (_, index) => {
    const blocker = liveCollision.createStaticBlocker({ id: `far-${String(index).padStart(3, '0')}`, shape: { type: 'circle', x: 3000 + (index % 20) * 180, y: 3000 + Math.floor(index / 20) * 180, radius: 30 }, visibleAssetId: 'crate', combatCover: true });
    const shape = blocker.shape;
    return Object.freeze({ ...blocker, get shape() { shapeReads += 1; return shape; } });
  }));
  const near = CUSTOM_BLOCKERS[0];
  const blockers = Object.freeze([...far, near]);
  const target = liveProjectiles.createHurtTarget({ id: 't', bodyShape: { type: 'circle', radius: 10 }, hurtShape: { type: 'circle', radius: 10 }, previousGround: { x: 90, y: 0, z: 0 }, currentGround: { x: 90, y: 0, z: 0 }, minZ: 0, maxZ: 60, health: 50 });
  const shots = Array.from({ length: 12 }, (_, index) => liveProjectiles.createProjectileState({ id: `s-${index}`, ownerId: 'player', previous: { x: -80, y: index * 2 - 12, z: 30 }, current: { x: 120, y: index * 2 - 12, z: 30 }, damage: 1, radius: 2 }));
  liveProjectiles.resolveProjectileBatch({ projectiles: shots.slice(0, 1), targets: [target], blockers });
  shapeReads = 0;
  const batch = liveProjectiles.resolveProjectileBatch({ projectiles: shots, targets: [target], blockers });
  const refBatch = refProjectiles.resolveProjectileBatch({ projectiles: shots, targets: [target], blockers });
  assertBitIdentical(batch, refBatch, 'far-cover batch');
  assert.ok(batch.resolutions.some((resolution) => resolution.coverHit?.blockerId === 'cover-circle'));
  shapeReads = 0;
  liveProjectiles.resolveProjectileBatch({ projectiles: shots, targets: [target], blockers });
  assert.ok(shapeReads < 12, `far cover was swept per shot: ${shapeReads} shape reads for 12 shots`);
});

test('melee targets and attacks match the release melee resolver', () => {
  const random = rng(0x3e1ee);
  for (let index = 0; index < 400; index += 1) {
    const anchor = BLOCKERS[index % BLOCKERS.length].shape;
    const origin = anchor.type === 'circle' ? { x: anchor.x + 40, y: anchor.y } : anchor.type === 'capsule' ? { x: anchor.a.x, y: anchor.a.y + 30 } : { x: anchor.vertices[0].x - 30, y: anchor.vertices[0].y };
    const make = (module, seed) => {
      const local = rng(seed);
      return Array.from({ length: 20 }, (_, t) => module.createMeleeTarget({
        id: `m-${t}`,
        previousGround: { x: origin.x + (local() - 0.5) * 140, y: origin.y + (local() - 0.5) * 140, z: 0 },
        currentGround: { x: origin.x + (local() - 0.5) * 140, y: origin.y + (local() - 0.5) * 140, z: t % 6 === 0 ? 30 : 0 },
        radius: 10 + local() * 20,
        active: t % 7 !== 0,
      }));
    };
    const seed = Math.floor(random() * 2 ** 31);
    const liveTargets = make(liveMelee, seed);
    const refTargets = make(refMelee, seed);
    assertBitIdentical(liveTargets, refTargets, `melee targets ${index}`);
    const input = { attackId: `a-${index}`, tick: index, origin: { ...origin, z: 0 }, direction: { x: Math.cos(index), y: Math.sin(index) }, blockers: index % 4 === 0 ? [] : BLOCKERS, downwardDropDirection: index % 5 === 0 ? { x: 1, y: 0 } : null };
    assertBitIdentical(liveMelee.resolveMeleeAttack({ ...input, targets: liveTargets }), refMelee.resolveMeleeAttack({ ...input, targets: refTargets }), `melee ${index}`);
  }
});
