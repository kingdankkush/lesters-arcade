import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveReloadPose, resolveReloadHeroAction, resolveReloadLayerOffset } from '../apps/hmh-reboot/src/reload-presentation.mjs';

test('the reload pose is level at both ends of the window and frozen', () => {
  for (const progress of [0, 1, -0.5, 1.5, Number.NaN, undefined]) {
    const pose = resolveReloadPose({ progress });
    assert.deepEqual(pose, { dy: 0, rotation: 0 });
    assert.equal(Object.isFrozen(pose), true);
  }
  assert.equal(Object.isFrozen(resolveReloadPose({ progress: 0.5 })), true);
});

test('the hold window lowers the muzzle: positive dy, negative rotation', () => {
  for (const progress of [0.25, 0.5, 0.84]) {
    const pose = resolveReloadPose({ progress });
    assert.equal(pose.dy, 6);
    assert.equal(pose.rotation, -0.22);
  }
});

test('the dip eases down monotonically and the snap-back returns monotonically to level', () => {
  let previous = resolveReloadPose({ progress: 0 });
  for (let step = 1; step <= 25; step += 1) {
    const pose = resolveReloadPose({ progress: step / 100 });
    assert.ok(pose.dy >= previous.dy, `dy must not rise back at ${step}%`);
    assert.ok(pose.rotation <= previous.rotation, `rotation must keep tilting at ${step}%`);
    previous = pose;
  }
  assert.equal(previous.dy, 6);
  previous = resolveReloadPose({ progress: 0.85 });
  for (let step = 86; step <= 100; step += 1) {
    const pose = resolveReloadPose({ progress: step / 100 });
    assert.ok(pose.dy <= previous.dy, `dy must keep returning at ${step}%`);
    assert.ok(pose.rotation >= previous.rotation, `rotation must keep levelling at ${step}%`);
    previous = pose;
  }
  assert.deepEqual(previous, { dy: 0, rotation: 0 });
  // The first snap-back step is the fastest so the return reads as a rack.
  const early = resolveReloadPose({ progress: 0.85 }).dy - resolveReloadPose({ progress: 0.9 }).dy;
  const late = resolveReloadPose({ progress: 0.95 }).dy - resolveReloadPose({ progress: 1 }).dy;
  assert.ok(early > late);
});

test('identical inputs produce byte-identical poses and reduceMotion yields zeros throughout', () => {
  for (const progress of [0.1, 0.33, 0.5, 0.9]) {
    assert.equal(JSON.stringify(resolveReloadPose({ progress })), JSON.stringify(resolveReloadPose({ progress })));
    assert.deepEqual(resolveReloadPose({ progress, reduceMotion: true }), { dy: 0, rotation: 0 });
  }
});

test('only the aim and hurt poses may carry the reload bob', () => {
  assert.equal(resolveReloadHeroAction({ action: 'aim' }), true);
  assert.equal(resolveReloadHeroAction({ action: 'hurt' }), true);
  for (const action of ['pistol-fire', 'melee', 'grenade', 'dash', 'death', 'interact', '', undefined]) {
    assert.equal(resolveReloadHeroAction({ action }), false, String(action));
  }
});

test('the hero layer offset mirrors the tilt by facing and cancels the swing about the feet', () => {
  assert.deepEqual(resolveReloadLayerOffset({ pose: { dy: 0, rotation: 0 } }), { x: 0, y: 0, rotation: 0 });
  assert.deepEqual(resolveReloadLayerOffset({ pose: null }), { x: 0, y: 0, rotation: 0 });
  const pose = resolveReloadPose({ progress: 0.5 });
  const east = resolveReloadLayerOffset({ pose, facingWest: false });
  const west = resolveReloadLayerOffset({ pose, facingWest: true });
  assert.equal(east.y, 6);
  assert.equal(west.y, 6);
  // Pixi rotates clockwise for positive radians, so a muzzle that points
  // screen-right dips with a positive rotation and vice versa.
  assert.ok(east.rotation > 0);
  assert.ok(west.rotation < 0);
  assert.equal(east.rotation, -west.rotation);
  assert.ok(east.x < 0 && west.x > 0, 'the x term opposes the direction the rotation would swing the grip');
  assert.equal(east.x, -west.x);
  assert.equal(Object.isFrozen(east), true);
});
