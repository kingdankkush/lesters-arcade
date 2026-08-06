import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_KEYBOARD_BINDINGS,
  HMH_ACTION_MAP,
  normalizeKeyboardBindings,
  rebindKeyboardAction,
} from '../apps/hmh-reboot/src/action-map.mjs';
import { InputState } from '../apps/hmh-reboot/src/input.mjs';

test('M3 one canonical action map names keyboard, gamepad, touch, and help text', () => {
  assert.deepEqual(Object.keys(HMH_ACTION_MAP), [
    'moveUp', 'moveDown', 'moveLeft', 'moveRight', 'fire', 'melee', 'grenade', 'dash', 'pause',
    'weaponNext', 'weaponSlot1', 'weaponSlot2', 'weaponSlot3', 'weaponSlot4',
  ]);
  for (const action of Object.values(HMH_ACTION_MAP)) {
    assert.ok(action.label);
    assert.ok(action.keyboard);
    assert.ok(action.gamepad || action.touch || action.id.startsWith('move') || action.id.startsWith('weaponSlot'));
    assert.ok(action.help);
  }
});

test('M4 keyboard remapping resolves conflicts deterministically and locks ranked runs', () => {
  const conflicted = normalizeKeyboardBindings({ fire: 'KeyR', grenade: 'KeyR', dash: 'KeyR' });
  assert.equal(conflicted.fire, 'KeyR');
  assert.equal(conflicted.grenade, DEFAULT_KEYBOARD_BINDINGS.grenade);
  assert.equal(conflicted.dash, DEFAULT_KEYBOARD_BINDINGS.dash);
  assert.equal(new Set(Object.values(conflicted)).size, Object.keys(conflicted).length);

  const rebound = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'fire', 'KeyR');
  assert.equal(rebound.fire, 'KeyR');
  const swapped = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'grenade', 'Space');
  assert.equal(swapped.grenade, 'Space');
  assert.equal(swapped.fire, 'KeyF');
  assert.throws(() => rebindKeyboardAction(rebound, 'fire', 'KeyT', { rankedActive: true }), /locked during an active ranked run/i);
  assert.throws(() => rebindKeyboardAction(rebound, 'fire', 'F13'), /unsupported keyboard code/i);
});

test('M4 live input rebinding resets held keys and fails closed during ranked authority', () => {
  const input = new InputState();
  input.setKey('Space', true, 1);
  input.setKeyboardBindings(rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'fire', 'KeyR'));
  assert.equal(input.keys.size, 0);
  assert.equal(input.gameplayKeys.has('KeyR'), true);
  assert.throws(() => input.setKeyboardBindings(DEFAULT_KEYBOARD_BINDINGS, { rankedActive: true }), /locked during an active ranked run/i);
});

test('M3 InputState consumes remapped bindings instead of hard-coded keyboard actions', () => {
  const bindings = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'fire', 'KeyR');
  const input = new InputState({ keyboardBindings: bindings });
  input.setKey('Space', true, 1);
  input.setKey('KeyR', true, 2);
  const snapshot = input.snapshot({
    actor: { x: 0, y: 0, z: 0, visualLiftZ: 0 },
    camera: { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 },
    viewport: { width: 800, height: 450 },
    nowMs: 2,
  });
  assert.equal(snapshot.actions.fire, true);
  input.setKey('KeyR', false, 3);
  input.consumeBufferedActions(snapshot.sequence);
  const released = input.snapshot({
    actor: { x: 0, y: 0, z: 0, visualLiftZ: 0 },
    camera: { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 },
    viewport: { width: 800, height: 450 },
    nowMs: 200,
  });
  assert.equal(released.actions.fire, false);
});
