import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSeparation, blendSteering, isCatMouseTrackingMode, planCatAndMouseSteering } from '../apps/portal/src/enemy-steering.mjs';

test('no neighbors -> zero separation', () => {
  const s = computeSeparation({ x: 0, y: 0 }, [], {});
  assert.deepEqual(s, { x: 0, y: 0, count: 0 });
});

test('neighbors outside radius are ignored', () => {
  const s = computeSeparation({ x: 0, y: 0 }, [{ x: 5, y: 0 }], { radius: 1.2 });
  assert.equal(s.count, 0);
  assert.equal(s.x, 0);
  assert.equal(s.y, 0);
});

test('a neighbor to the right pushes the agent left', () => {
  const s = computeSeparation({ x: 0, y: 0 }, [{ x: 0.5, y: 0 }], { radius: 1.2 });
  assert.equal(s.count, 1);
  assert.ok(s.x < 0, `expected leftward push, got ${s.x}`);
  // Normalized: roughly unit length.
  assert.ok(Math.abs(Math.hypot(s.x, s.y) - 1) < 1e-9);
});

test('closer neighbors push harder than distant ones (inverse-distance)', () => {
  // Two agents both to the right: separation should still be leftward and unit
  // length; the weighting is internal but the direction must be away from them.
  const near = computeSeparation({ x: 0, y: 0 }, [{ x: 0.3, y: 0 }], { radius: 1.2 });
  const far = computeSeparation({ x: 0, y: 0 }, [{ x: 1.0, y: 0 }], { radius: 1.2 });
  assert.ok(near.x < 0 && far.x < 0);
});

test('selfIndex is skipped', () => {
  const agents = [{ x: 0, y: 0 }, { x: 0.4, y: 0 }];
  const s = computeSeparation(agents[0], agents, { radius: 1.2, selfIndex: 0 });
  assert.equal(s.count, 1); // only the other agent counts
  assert.ok(s.x < 0);
});

test('runtime mapX/mapY entities preserve separation math without position snapshot objects', () => {
  const plain = [{ x: 0, y: 0 }, { x: 0.4, y: 0.2 }, { x: -0.25, y: 0.35 }];
  const runtime = plain.map(({ x, y }) => ({ mapX: x, mapY: y }));
  const expected = computeSeparation(plain[0], plain, { radius: 1.2, selfIndex: 0, maxNeighbors: 10 });
  const actual = computeSeparation(runtime[0], runtime, { radius: 1.2, selfIndex: 0, maxNeighbors: 10 });
  assert.deepEqual(actual, expected);
});

test('exactly overlapping agents still produce a non-zero split', () => {
  const agents = [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }];
  const s0 = computeSeparation(agents[0], agents, { radius: 1.2, selfIndex: 0 });
  assert.ok(s0.count > 0);
  assert.ok(Math.hypot(s0.x, s0.y) > 0, 'stacked agents must push apart');
});

test('maxNeighbors caps the work done', () => {
  const crowd = Array.from({ length: 100 }, (_, i) => ({ x: 0.1 + i * 0.001, y: 0 }));
  const s = computeSeparation({ x: 0, y: 0 }, crowd, { radius: 5, maxNeighbors: 8 });
  assert.equal(s.count, 8);
});

test('computeSeparation is deterministic for identical inputs', () => {
  const self = { x: 2, y: 3 };
  const neighbors = [{ x: 2.2, y: 3 }, { x: 1.9, y: 3.1 }, { x: 2.5, y: 2.8 }];
  const a = computeSeparation(self, neighbors, { radius: 1.2 });
  const b = computeSeparation(self, neighbors, { radius: 1.2 });
  assert.deepEqual(a, b);
});

test('blendSteering keeps homing dominant but shifts toward separation', () => {
  const homing = { x: 1, y: 0 };           // toward player (east)
  const separation = { x: 0, y: 1 };        // neighbors pushing north
  const blended = blendSteering(homing, separation, 0.65);
  assert.ok(Math.abs(Math.hypot(blended.x, blended.y) - 1) < 1e-9, 'result must be unit length');
  assert.ok(blended.x > 0, 'still advancing toward the player');
  assert.ok(blended.y > 0, 'shifted toward the separation push');
  assert.ok(blended.x > blended.y, 'homing should dominate at weight 0.65');
});

test('blendSteering returns homing when separation cancels it out', () => {
  const homing = { x: 1, y: 0 };
  const separation = { x: -1 / 0.65, y: 0 }; // would exactly cancel after weighting
  const blended = blendSteering(homing, separation, 0.65);
  // Degenerate -> falls back to homing rather than NaN.
  assert.ok(Number.isFinite(blended.x) && Number.isFinite(blended.y));
});

test('blendSteering with zero separation equals homing', () => {
  const homing = { x: 0.6, y: 0.8 };
  const blended = blendSteering(homing, { x: 0, y: 0 }, 0.65);
  assert.ok(Math.abs(blended.x - 0.6) < 1e-9);
  assert.ok(Math.abs(blended.y - 0.8) < 1e-9);
});

test('ranged enemies reacquire around cover instead of walking directly into it', () => {
  assert.equal(isCatMouseTrackingMode('reacquire'), true);
  assert.equal(isCatMouseTrackingMode('intercept'), true);
  assert.equal(isCatMouseTrackingMode('orbit'), false);
  const plan = planCatAndMouseSteering({
    ranged: true,
    distanceTiles: 9,
    desiredDistanceTiles: 5.2,
    hasLineOfSight: false,
    homing: { x: 1, y: 0 },
    orbitSide: 1,
  });
  assert.equal(plan.mode, 'reacquire');
  assert.equal(plan.usesCover, true);
  assert.ok(plan.direction.x > 0, 'enemy must still close toward the player');
  assert.ok(plan.direction.y > 0, 'enemy must choose a deterministic lateral detour');
  assert.ok(Math.abs(Math.hypot(plan.direction.x, plan.direction.y) - 1) < 1e-9);
});

test('ranged enemies orbit at firing distance and disengage when crowded', () => {
  const orbit = planCatAndMouseSteering({
    ranged: true,
    distanceTiles: 5.5,
    desiredDistanceTiles: 5.2,
    hasLineOfSight: true,
    homing: { x: 1, y: 0 },
    orbitSide: -1,
  });
  assert.equal(orbit.mode, 'orbit');
  assert.ok(orbit.direction.y < 0);

  const disengage = planCatAndMouseSteering({
    ranged: true,
    distanceTiles: 2,
    desiredDistanceTiles: 5.2,
    hasLineOfSight: true,
    homing: { x: 1, y: 0 },
  });
  assert.equal(disengage.mode, 'disengage');
  assert.ok(disengage.direction.x < 0);
});

test('melee hunters lead a moving player instead of following the old position', () => {
  const plan = planCatAndMouseSteering({
    ranged: false,
    distanceTiles: 8,
    desiredDistanceTiles: 0.72,
    hasLineOfSight: true,
    homing: { x: 1, y: 0 },
    playerVelocity: { x: 0, y: 4 },
  });
  assert.equal(plan.mode, 'intercept');
  assert.ok(plan.direction.x > 0);
  assert.ok(plan.direction.y > 0, 'intercept should lead the moving player');

  const hold = planCatAndMouseSteering({
    ranged: false,
    distanceTiles: 0.6,
    desiredDistanceTiles: 0.72,
    hasLineOfSight: true,
    homing: { x: 1, y: 0 },
  });
  assert.equal(hold.mode, 'hold');
  assert.equal(hold.speedMul, 0);
  assert.deepEqual(hold.direction, { x: 0, y: 0 });
});
