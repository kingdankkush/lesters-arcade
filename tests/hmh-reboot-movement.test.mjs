import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRecoilImpulse,
  createPlayerMotionState,
  quantizeDirection,
  resolveEnemyPressure,
  stepPlayerMovement,
} from '../apps/hmh-reboot/src/movement.mjs';

const DT = 1 / 60;

function step(state, input, frames, options = {}) {
  for (let index = 0; index < frames; index += 1) stepPlayerMovement(state, input, { dtSeconds: DT, ...options });
  return state;
}

test('player reaches responsive target velocity without diagonal speed gain', () => {
  const cardinal = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0.08 });
  const diagonal = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0.08 });
  step(cardinal, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } }, 6);
  step(diagonal, { move: { x: 1, y: 1 }, aim: { x: 1, y: 0, active: true } }, 6);
  assert.ok(Math.hypot(cardinal.vx, cardinal.vy) > 220);
  assert.ok(Math.abs(Math.hypot(cardinal.vx, cardinal.vy) - Math.hypot(diagonal.vx, diagonal.vy)) < 1e-9);
});

test('cardinal and diagonal input share the same fixed-tick acceleration envelope', () => {
  const cardinal = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0.08 });
  const diagonal = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0.08 });
  const cardinalInput = { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } };
  const diagonalInput = { move: { x: 1, y: 1 }, aim: { x: 1, y: 0, active: true } };
  for (let tick = 0; tick < 4; tick += 1) {
    stepPlayerMovement(cardinal, cardinalInput, { dtSeconds: DT });
    stepPlayerMovement(diagonal, diagonalInput, { dtSeconds: DT });
    assert.ok(
      Math.abs(Math.hypot(cardinal.vx, cardinal.vy) - Math.hypot(diagonal.vx, diagonal.vy)) < 1e-9,
      `tick ${tick + 1} acceleration magnitude must not depend on input direction`,
    );
  }
});

test('direction reversal and release decelerate promptly instead of preserving long momentum', () => {
  const state = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0.08, decelerationTime: 0.06 });
  step(state, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } }, 8);
  step(state, { move: { x: -1, y: 0 }, aim: { x: 1, y: 0, active: true } }, 5);
  assert.ok(state.vx < 0, 'five fixed ticks must reverse direction');
  step(state, { move: { x: 0, y: 0 }, aim: { x: 1, y: 0, active: true } }, 5);
  assert.ok(Math.hypot(state.vx, state.vy) < 1e-9);
});

test('movement velocity legs and torso aim remain independent', () => {
  const state = createPlayerMotionState({ maxSpeed: 240 });
  stepPlayerMovement(state, { move: { x: 0, y: 1 }, aim: { x: -1, y: 0, active: true } }, { dtSeconds: DT });
  assert.deepEqual(state.moveDirection, { x: 0, y: 1 });
  assert.ok(state.velocityDirection.y > 0);
  assert.equal(state.legDirection, 2);
  assert.equal(state.torsoDirection, 4);
  assert.deepEqual(state.aimDirection, { x: -1, y: 0 });
  assert.equal(quantizeDirection({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 8), 7);
});

test('stable leg and aim directions persist below their dead zones', () => {
  const state = createPlayerMotionState({ heading: Math.PI / 2 });
  stepPlayerMovement(state, { move: { x: 1, y: 0 }, aim: { x: 0, y: -1, active: true } }, { dtSeconds: DT });
  const stable = { leg: state.legDirection, torso: state.torsoDirection, aim: { ...state.aimDirection } };
  step(state, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0, active: false } }, 10);
  assert.equal(state.legDirection, stable.leg);
  assert.equal(state.torsoDirection, stable.torso);
  assert.deepEqual(state.aimDirection, stable.aim);
});

test('terrain speed modifiers remain fixed-step deterministic', () => {
  const normal = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0 });
  const slowed = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0 });
  step(normal, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } }, 60);
  step(slowed, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } }, 60, { speedMultiplier: 0.75 });
  assert.equal(normal.x, 240);
  assert.equal(slowed.x, 180);
});

test('regular enemies yield to player pressure and cannot form an immovable ring', () => {
  const enemies = [
    { id: 'east', x: 0.8, y: 0, radius: 0.7, kind: 'regular' },
    { id: 'west', x: -0.8, y: 0, radius: 0.7, kind: 'regular' },
    { id: 'south', x: 0, y: 0.8, radius: 0.7, kind: 'regular' },
    { id: 'north', x: 0, y: -0.8, radius: 0.7, kind: 'regular' },
  ];
  const result = resolveEnemyPressure({ x: 0, y: 0, radius: 0.55, velocity: { x: 1, y: 0 } }, enemies);
  assert.deepEqual(result.playerDelta, { x: 0, y: 0 });
  assert.equal(result.enemyDeltas.size, 4);
  for (const enemy of enemies) {
    const delta = result.enemyDeltas.get(enemy.id);
    assert.ok(Math.hypot(delta.x, delta.y) > 0);
  }
});

test('boss contact blocks inward motion but preserves a deterministic tangent escape', () => {
  const result = resolveEnemyPressure(
    { x: 0, y: 0, radius: 0.5, velocity: { x: 1, y: 0 } },
    [{ id: 'boss', x: 0.8, y: 0, radius: 0.8, kind: 'boss' }],
  );
  assert.ok(result.playerDelta.x < 0);
  assert.equal(result.enemyDeltas.size, 0);
  assert.ok(Math.abs(result.allowedVelocity.x) < 1e-9);
  assert.notEqual(result.allowedVelocity.y, 0, 'direct pin must receive deterministic tangent escape');
});

test('weapon recoil is an explicit impulse while stun suppresses locomotion and recovery remains responsive', () => {
  const state = createPlayerMotionState({ maxSpeed: 240, accelerationTime: 0.08 });
  applyRecoilImpulse(state, { direction: { x: -1, y: 0 }, magnitude: 90 });
  stepPlayerMovement(state, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } }, { dtSeconds: DT });
  assert.ok(state.recoilVx < 0);
  assert.ok(state.vx > 0, 'recoil must not become a generic shooting slowdown');
  stepPlayerMovement(state, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } }, { dtSeconds: DT, stunned: true });
  assert.equal(state.locomotion, 'stunned');
  step(state, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0, active: true } }, 8);
  assert.equal(state.locomotion, 'moving');
  assert.ok(state.vx > 200);
});

test('recoil and knockback impulses produce readable displacement that scales with magnitude', async () => {
  const { createPlayerMotionState, applyRecoilImpulse, stepPlayerMovement } = await import('../apps/hmh-reboot/src/movement.mjs');
  const travel = (magnitude) => {
    const state = createPlayerMotionState({ x: 0, y: 0 });
    applyRecoilImpulse(state, { direction: { x: 1, y: 0 }, magnitude });
    for (let step = 0; step < 60; step += 1) {
      stepPlayerMovement(state, { move: { x: 0, y: 0 } }, { dtSeconds: 1 / 60 });
    }
    return state.x;
  };
  const light = travel(32);
  const heavy = travel(64);
  assert.ok(light >= 3, `a 32-unit impulse must be visible, got ${light.toFixed(3)}px`);
  assert.ok(heavy >= light * 1.8, `impulse response must scale with magnitude (32=${light.toFixed(2)} 64=${heavy.toFixed(2)})`);
});
