import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAimAssist,
  createAimState,
  resolveAimIntent,
  selectNearestValidTarget,
} from '../apps/hmh-reboot/src/aim.mjs';

const targets = [
  { id: 'far', x: 9, y: 0, active: true, targetable: true },
  { id: 'near-b', x: 4, y: 0, active: true, targetable: true },
  { id: 'near-a', x: -4, y: 0, active: true, targetable: true },
  { id: 'dead', x: 1, y: 0, active: false, targetable: true },
];

test('nearest target selection filters invalid targets and breaks distance ties by stable id', () => {
  const target = selectNearestValidTarget({ x: 0, y: 0 }, targets, { maxRange: 8 });
  assert.equal(target.id, 'near-a');
  const visible = selectNearestValidTarget({ x: 0, y: 0 }, targets, { maxRange: 8, lineOfSight: (candidate) => candidate.id === 'near-b' });
  assert.equal(visible.id, 'near-b');
});

test('default autofire aims at the nearest valid target and fires without manual input', () => {
  const state = createAimState({ manualHoldTicks: 6 });
  const result = resolveAimIntent(state, {
    tick: 10,
    actor: { x: 0, y: 0 },
    input: { aim: { x: 0, y: 0, active: false }, fire: false },
    targets,
  });
  assert.equal(result.source, 'autofire');
  assert.equal(result.targetId, 'near-a');
  assert.equal(result.fire, true);
  assert.deepEqual(result.direction, { x: -1, y: 0 });
});

test('manual aim overrides autofire for a deterministic fixed-tick hold window', () => {
  const state = createAimState({ manualHoldTicks: 6 });
  const manual = resolveAimIntent(state, {
    tick: 20,
    actor: { x: 0, y: 0 },
    input: { aim: { x: 0, y: 1, active: true }, fire: false },
    targets,
  });
  assert.equal(manual.source, 'manual');
  assert.equal(manual.fire, true, 'manual aim overrides direction without disabling default autofire');
  for (let tick = 21; tick <= 26; tick += 1) {
    const held = resolveAimIntent(state, { tick, actor: { x: 0, y: 0 }, input: { aim: { x: 0, y: 0, active: false }, fire: false }, targets });
    assert.equal(held.source, 'manual-hold');
    assert.deepEqual(held.direction, { x: 0, y: 1 });
  }
  const resumed = resolveAimIntent(state, { tick: 27, actor: { x: 0, y: 0 }, input: { aim: { x: 0, y: 0, active: false }, fire: false }, targets });
  assert.equal(resumed.source, 'autofire');
});

test('manual fire remains available alongside default autofire', () => {
  const state = createAimState({ autoFireEnabled: false });
  const idle = resolveAimIntent(state, { tick: 1, actor: { x: 0, y: 0 }, input: { aim: { x: 1, y: 0, active: true }, fire: false }, targets });
  const firing = resolveAimIntent(state, { tick: 2, actor: { x: 0, y: 0 }, input: { aim: { x: 1, y: 0, active: true }, fire: true }, targets });
  assert.equal(idle.fire, false);
  assert.equal(firing.fire, true);
  assert.equal(firing.source, 'manual');
});

test('touch/controller aim assist corrects toward a target without exceeding its angular bound', () => {
  const raw = { x: 1, y: 0 };
  const target = { x: Math.cos(Math.PI / 3), y: Math.sin(Math.PI / 3) };
  const corrected = applyAimAssist(raw, target, { magnetism: 1, maxCorrectionRadians: Math.PI / 12 });
  const angle = Math.atan2(corrected.y, corrected.x);
  assert.ok(Math.abs(angle - Math.PI / 12) < 1e-9);
  assert.ok(Math.abs(Math.hypot(corrected.x, corrected.y) - 1) < 1e-9);
});

test('mouse aim remains exact while touch/controller correction is configurable', () => {
  const state = createAimState({ aimMagnetism: 1, maxCorrectionRadians: Math.PI / 8 });
  const mouse = resolveAimIntent(state, {
    tick: 1,
    actor: { x: 0, y: 0 },
    device: 'pointer',
    input: { aim: { x: 1, y: 0, active: true }, fire: false },
    targets: [{ id: 'angled', x: 2, y: 2, active: true, targetable: true }],
  });
  assert.deepEqual(mouse.direction, { x: 1, y: 0 });
  const controller = resolveAimIntent(state, {
    tick: 2,
    actor: { x: 0, y: 0 },
    device: 'gamepad',
    input: { aim: { x: 1, y: 0, active: true }, fire: false },
    targets: [{ id: 'angled', x: 2, y: 2, active: true, targetable: true }],
  });
  assert.ok(controller.direction.y > 0);
});

test('invalid targets inputs and non-monotonic ticks fail closed', () => {
  const state = createAimState();
  assert.throws(() => selectNearestValidTarget({ x: 0, y: 0 }, null), /targets/);
  resolveAimIntent(state, { tick: 5, actor: { x: 0, y: 0 }, input: { aim: { x: 1, y: 0, active: true }, fire: false }, targets: [] });
  assert.throws(() => resolveAimIntent(state, { tick: 4, actor: { x: 0, y: 0 }, input: { aim: { x: 1, y: 0, active: true }, fire: false }, targets: [] }), /monotonic/);
});
