import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DASH_COOLDOWN_TICKS_BY_TIER,
  DASH_DISTANCE,
  DASH_DURATION_TICKS,
  beginDash,
  createDashState,
  filterDashInvulnerableHits,
  getDashStatus,
  isDashInvulnerable,
  resolveDashWorldStep,
  stepDash,
} from '../apps/hmh-reboot/src/dash.mjs';
import { createCollisionBody, createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';

const BODY = createCollisionBody({ id: 'player', kind: 'player', radius: 12, minZ: 0, maxZ: 48 });
const BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 1000, maxY: 1000, visibleBoundaryId: 'visible-world-edge' });
const BASE = createElevationSurface({
  id: 'base', kind: 'ground', area: { type: 'rect', minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
  groundZ: 0, visibleTerrainId: 'visible-base',
});
const FLAT_GROUND = createAuthoredGroundQuery({ baseSurface: BASE });

function completeDash(state, startTick = 0) {
  const deltas = [];
  for (let tick = startTick; tick < startTick + DASH_DURATION_TICKS; tick += 1) deltas.push(stepDash(state, { tick }).delta);
  return deltas;
}

test('Phase 13 Dash uses the exact base and two-tier 10/8/6 second cooldown contract', () => {
  assert.deepEqual(DASH_COOLDOWN_TICKS_BY_TIER, [600, 480, 360]);
  for (const [tier, cooldownTicks] of DASH_COOLDOWN_TICKS_BY_TIER.entries()) {
    const state = createDashState({ cooldownTier: tier });
    const start = beginDash(state, { tick: 120, direction: { x: 3, y: 4 } });
    assert.equal(start.started, true);
    assert.equal(state.cooldownReadyTick, 120 + cooldownTicks);
    assert.deepEqual(state.direction, { x: 0.6, y: 0.8 });
  }
});

test('Dash distributes 192 units over eight deterministic ticks with eight invulnerable ticks', () => {
  const state = createDashState();
  assert.equal(beginDash(state, { tick: 0, direction: { x: 1, y: 0 } }).started, true);
  const deltas = completeDash(state);
  assert.equal(deltas.length, DASH_DURATION_TICKS);
  assert.equal(deltas.reduce((sum, delta) => sum + delta.x, 0), DASH_DISTANCE);
  assert.equal(deltas.every((delta) => delta.x === DASH_DISTANCE / DASH_DURATION_TICKS && delta.y === 0), true);
  for (let tick = 0; tick < DASH_DURATION_TICKS; tick += 1) assert.equal(isDashInvulnerable(state, tick), true);
  assert.equal(isDashInvulnerable(state, DASH_DURATION_TICKS), false);
  assert.equal(state.active, false);
});

test('Dash falls back to aim direction, rejects zero direction, and cannot restart before cooldown', () => {
  const empty = createDashState();
  assert.equal(beginDash(empty, { tick: 0, direction: { x: 0, y: 0 }, fallbackDirection: { x: 0, y: 0 } }).reason, 'no-direction');
  assert.equal(beginDash(empty, { tick: 0, direction: { x: 0, y: 0 }, fallbackDirection: { x: 0, y: -2 } }).started, true);
  assert.deepEqual(empty.direction, { x: 0, y: -1 });
  completeDash(empty);
  assert.equal(beginDash(empty, { tick: 599, direction: { x: 1, y: 0 } }).reason, 'cooldown');
  assert.equal(getDashStatus(empty, 599).cooldownTicksRemaining, 1);
  assert.equal(beginDash(empty, { tick: 600, direction: { x: 1, y: 0 } }).started, true);
});

test('tick-based Dash cooldown and activity do not advance while simulation is paused', () => {
  const state = createDashState();
  beginDash(state, { tick: 10, direction: { x: 1, y: 0 } });
  stepDash(state, { tick: 10 });
  const beforePause = getDashStatus(state, 11);
  const duringPause = getDashStatus(state, 11);
  assert.deepEqual(duringPause, beforePause);
  assert.equal(state.remainingTicks, DASH_DURATION_TICKS - 1);
});

test('Dash stops at the first hard authored blocker without sliding or tunneling', () => {
  const blocker = createStaticBlocker({
    id: 'wall', shape: { type: 'polygon', vertices: [{ x: 80, y: 0 }, { x: 90, y: 0 }, { x: 90, y: 200 }, { x: 80, y: 200 }] },
    visibleAssetId: 'visible-wall', minZ: 0, maxZ: 100,
  });
  const state = createDashState({ distance: 240, durationTicks: 1 });
  beginDash(state, { tick: 0, direction: { x: 1, y: 0 } });
  const dashStep = stepDash(state, { tick: 0 });
  const result = resolveDashWorldStep({
    state, start: { x: 20, y: 100, z: 0 }, delta: dashStep.delta, body: BODY,
    blockers: [blocker], bounds: BOUNDS, queryGround: FLAT_GROUND,
  });
  assert.equal(result.stopReason, 'hard-blocker');
  assert.ok(result.position.x < 80 - BODY.radius + 0.01);
  assert.equal(result.position.y, 100);
  assert.equal(state.active, false);
});

test('Dash stops at deep water and authored cliff transitions along the complete swept path', () => {
  const water = createElevationSurface({
    id: 'water', kind: 'water', area: { type: 'rect', minX: 100, minY: 0, maxX: 300, maxY: 200 },
    groundZ: -18, waterLevel: 0, deepWater: true, visibleTerrainId: 'visible-water', priority: 2,
  });
  const ledge = createElevationSurface({
    id: 'ledge', kind: 'ledge', area: { type: 'rect', minX: 100, minY: 300, maxX: 300, maxY: 500 },
    groundZ: 64, visibleTerrainId: 'visible-ledge', priority: 2,
  });
  const queryGround = createAuthoredGroundQuery({ baseSurface: BASE, surfaces: [water, ledge] });
  for (const [start, expected] of [[{ x: 20, y: 100, z: 0 }, 'deep-water'], [{ x: 20, y: 400, z: 0 }, 'upward-cliff']]) {
    const state = createDashState({ distance: 240, durationTicks: 1 });
    beginDash(state, { tick: 0, direction: { x: 1, y: 0 } });
    const result = resolveDashWorldStep({ state, start, delta: stepDash(state, { tick: 0 }).delta, body: BODY, blockers: [], bounds: BOUNDS, queryGround });
    assert.equal(result.stopReason, expected);
    assert.ok(result.position.x < 100);
  }
});

test('Dash stops at bosses but yields regular enemies in stable-ID order', () => {
  const bossState = createDashState({ distance: 240, durationTicks: 1 });
  beginDash(bossState, { tick: 0, direction: { x: 1, y: 0 } });
  const bossResult = resolveDashWorldStep({
    state: bossState, start: { x: 20, y: 100, z: 0 }, delta: stepDash(bossState, { tick: 0 }).delta,
    body: BODY, blockers: [], bounds: BOUNDS, queryGround: FLAT_GROUND,
    enemies: [{ id: 'boss', kind: 'boss', x: 120, y: 100, radius: 30 }],
  });
  assert.equal(bossResult.stopReason, 'boss');
  assert.ok(bossResult.position.x < 120 - 30 - BODY.radius + 0.01);

  const regular = [
    { id: 'zeta', kind: 'regular', x: 220, y: 100, radius: 18 },
    { id: 'alpha', kind: 'regular', x: 210, y: 100, radius: 18 },
  ];
  const run = (enemies) => {
    const state = createDashState({ distance: 192, durationTicks: 1 });
    beginDash(state, { tick: 0, direction: { x: 1, y: 0 } });
    return resolveDashWorldStep({
      state, start: { x: 20, y: 100, z: 0 }, delta: stepDash(state, { tick: 0 }).delta,
      body: BODY, blockers: [], bounds: BOUNDS, queryGround: FLAT_GROUND, enemies,
    });
  };
  const forward = run(regular);
  const reverse = run([...regular].reverse());
  assert.equal(forward.stopReason, null);
  assert.equal(forward.position.x, 212);
  assert.deepEqual([...forward.enemyDeltas], [...reverse.enemyDeltas]);
  assert.deepEqual([...forward.enemyDeltas].map(([id]) => id), ['alpha', 'zeta']);
  assert.equal([...forward.enemyDeltas].some(([, delta]) => Math.hypot(delta.x, delta.y) > 0), true);
});

test('Dash inputs fail closed for malformed tiers, ticks, and directions', () => {
  assert.throws(() => createDashState({ cooldownTier: 3 }), /cooldownTier/);
  const state = createDashState();
  assert.throws(() => beginDash(state, { tick: -1, direction: { x: 1, y: 0 } }), /tick/);
  assert.throws(() => beginDash(state, { tick: 0, direction: { x: Number.NaN, y: 0 } }), /direction.x/);
});

test('Dash invulnerability filters only player-targeted hits at the combat authority boundary', () => {
  const state = createDashState();
  beginDash(state, { tick: 10, direction: { x: 1, y: 0 } });
  const hits = [
    { id: 'enemy-a', targetId: 'enemy' },
    { id: 'player-a', targetId: 'player' },
    { id: 'enemy-b', targetId: 'enemy' },
  ];
  assert.deepEqual(filterDashInvulnerableHits(state, 10, hits), [hits[0], hits[2]]);
  assert.deepEqual(filterDashInvulnerableHits(state, 18, hits), hits);
  assert.deepEqual(hits.map((hit) => hit.id), ['enemy-a', 'player-a', 'enemy-b']);
});
