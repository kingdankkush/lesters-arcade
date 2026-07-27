import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerMotionState, stepPlayerMovement } from '../apps/hmh-reboot/src/movement.mjs';

const DT = 1 / 60;

const settleMovingRight = () => {
  const state = createPlayerMotionState({ maxSpeed: 240 });
  for (let tick = 0; tick < 60; tick += 1) {
    stepPlayerMovement(state, { move: { x: 1, y: 0 } }, { dtSeconds: DT });
  }
  return state;
};

test('reversing direction resolves faster than accelerating from rest', () => {
  // A full reversal is the case that felt sluggish: it used the same response
  // time as starting from a standstill, so a player at top speed took as long
  // to turn around as to get going in the first place.
  const reversing = settleMovingRight();
  stepPlayerMovement(reversing, { move: { x: -1, y: 0 } }, { dtSeconds: DT });
  const reversalDelta = Math.abs(reversing.vx - 240);

  const fromRest = createPlayerMotionState({ maxSpeed: 240 });
  stepPlayerMovement(fromRest, { move: { x: 1, y: 0 } }, { dtSeconds: DT });
  const restDelta = Math.abs(fromRest.vx);

  assert.ok(reversalDelta > restDelta, `reversal ${reversalDelta.toFixed(2)} must beat rest ${restDelta.toFixed(2)}`);
});

test('holding a straight line is unchanged, so top speed and cruise feel are untouched', () => {
  const straight = settleMovingRight();
  const before = straight.vx;
  stepPlayerMovement(straight, { move: { x: 1, y: 0 } }, { dtSeconds: DT });
  assert.equal(straight.vx, before, 'cruising must not be affected by the turn assist');
  assert.ok(Math.abs(straight.vx - 240) < 1e-6, 'top speed must still be maxSpeed');
});

test('turn assist is opt-out and validated', () => {
  const opted = createPlayerMotionState({ maxSpeed: 240, turnAccelerationTime: 0.08, accelerationTime: 0.08 });
  for (let tick = 0; tick < 60; tick += 1) {
    stepPlayerMovement(opted, { move: { x: 1, y: 0 } }, { dtSeconds: DT });
  }
  stepPlayerMovement(opted, { move: { x: -1, y: 0 } }, { dtSeconds: DT });
  const plain = createPlayerMotionState({ maxSpeed: 240 });
  stepPlayerMovement(plain, { move: { x: 1, y: 0 } }, { dtSeconds: DT });
  assert.ok(Math.abs(Math.abs(opted.vx - 240) - Math.abs(plain.vx)) < 1e-9,
    'equal turn and acceleration times must reproduce the previous behaviour exactly');
  assert.throws(() => createPlayerMotionState({ turnAccelerationTime: -1 }), /turnAccelerationTime/);
});

test('movement stays deterministic across identical input sequences', () => {
  const run = () => {
    const state = createPlayerMotionState({ maxSpeed: 240 });
    const inputs = [[1, 0], [1, 0], [-1, 0], [0, 1], [-1, -1], [1, 0]];
    for (const [x, y] of inputs) {
      for (let tick = 0; tick < 10; tick += 1) stepPlayerMovement(state, { move: { x, y } }, { dtSeconds: DT });
    }
    return [state.x, state.y, state.vx, state.vy];
  };
  assert.deepEqual(run(), run());
});
