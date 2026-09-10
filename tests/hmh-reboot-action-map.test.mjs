import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_KEYBOARD_BINDINGS,
  HMH_ACTION_MAP,
  HMH_ACTION_IDS,
  actionHelpRows,
  keyboardActionPressed,
  keyboardCodesForBindings,
  normalizeKeyboardBindings,
  rebindKeyboardAction,
} from '../apps/hmh-reboot/src/action-map.mjs';
import { InputState } from '../apps/hmh-reboot/src/input.mjs';

test('M3 one canonical action map names keyboard, gamepad, touch, and help text', () => {
  assert.deepEqual(Object.keys(HMH_ACTION_MAP), [
    'moveUp', 'moveDown', 'moveLeft', 'moveRight', 'grenade', 'pause',
  ]);
  for (const action of Object.values(HMH_ACTION_MAP)) {
    assert.ok(action.label);
    assert.ok(action.keyboard);
    assert.ok(action.gamepad || action.touch || action.id.startsWith('move') || action.id.startsWith('weaponSlot'));
    assert.ok(action.help);
  }
});

test('M4 keyboard remapping resolves conflicts deterministically and locks ranked runs', () => {
  const conflicted = normalizeKeyboardBindings({ moveUp: 'KeyR', grenade: 'KeyR', pause: 'KeyR' });
  assert.equal(conflicted.moveUp, 'KeyR');
  assert.equal(conflicted.grenade, DEFAULT_KEYBOARD_BINDINGS.grenade);
  assert.equal(conflicted.pause, DEFAULT_KEYBOARD_BINDINGS.pause);
  assert.equal(new Set(Object.values(conflicted)).size, Object.keys(conflicted).length);

  const rebound = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'pause', 'KeyR');
  assert.equal(rebound.pause, 'KeyR');
  const swapped = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'grenade', 'Escape');
  assert.equal(swapped.grenade, 'Escape');
  assert.equal(swapped.pause, 'KeyF');
  assert.throws(() => rebindKeyboardAction(rebound, 'pause', 'KeyT', { rankedActive: true }), /locked during an active ranked run/i);
  assert.throws(() => rebindKeyboardAction(rebound, 'pause', 'F13'), /unsupported keyboard code/i);
});

test('M4 live input rebinding resets held keys and fails closed during ranked authority', () => {
  const input = new InputState();
  input.setKey('Space', true, 1);
  input.setKeyboardBindings(rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'pause', 'KeyR'));
  assert.equal(input.keys.size, 0);
  assert.equal(input.gameplayKeys.has('KeyR'), true);
  assert.throws(() => input.setKeyboardBindings(DEFAULT_KEYBOARD_BINDINGS, { rankedActive: true }), /locked during an active ranked run/i);
});

test('K-3 every currently active default binding is present in canonical help', () => {
  const help = actionHelpRows();
  const documented = help.flatMap((row) => [row.keyboard, ...row.keyboardAlternates]);
  assert.deepEqual(new Set(documented), new Set(keyboardCodesForBindings(DEFAULT_KEYBOARD_BINDINGS)));
  for (const row of help) {
    assert.ok(Object.isFrozen(row.keyboardAlternates));
    for (const code of [row.keyboard, ...row.keyboardAlternates]) {
      assert.equal(keyboardActionPressed(new Set([code]), DEFAULT_KEYBOARD_BINDINGS, row.id), true);
    }
  }
  assert.match(help.find((row) => row.id === 'grenade').pointer, /right click/i);
});

test('K-4 rebinding a default alternate gives that key exactly one action owner', () => {
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyG', 'ShiftRight']) {
    for (const target of HMH_ACTION_IDS) {
      const bindings = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, target, code);
      const fired = HMH_ACTION_IDS.filter((id) => keyboardActionPressed(new Set([code]), bindings, id));
      assert.deepEqual(fired, [target], `${code} rebound to ${target} must not trigger an old alternate action`);
      const captured = keyboardCodesForBindings(bindings);
      assert.equal(new Set(captured).size, captured.length, 'capture inventory contains each live code once');
    }
  }
});

test('K-3 help removes displaced alternates and follows restored default ownership', () => {
  let bindings = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'pause', 'KeyG');
  let help = Object.fromEntries(actionHelpRows(bindings).map((row) => [row.id, row]));
  assert.deepEqual(help.grenade.keyboardAlternates, []);
  assert.equal(help.pause.keyboard, 'KeyG');
  bindings = rebindKeyboardAction(bindings, 'pause', 'Escape');
  help = Object.fromEntries(actionHelpRows(bindings).map((row) => [row.id, row]));
  assert.deepEqual(help.grenade.keyboardAlternates, ['KeyG']);
  bindings = rebindKeyboardAction(bindings, 'grenade', 'KeyR');
  help = Object.fromEntries(actionHelpRows(bindings).map((row) => [row.id, row]));
  assert.deepEqual(help.grenade.keyboardAlternates, []);
  assert.equal(keyboardActionPressed(new Set(['KeyG']), bindings, 'grenade'), false);
});

test('K-4 real input does not move or buffer grenade after alternate-key reassignment', () => {
  const context = { actor: { x: 0, y: 0, z: 0 }, camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 800, height: 450 }, nowMs: 2 };
  const input = new InputState({ keyboardBindings: rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'pause', 'ArrowUp') });
  input.setKey('ArrowUp', true, 1);
  let snapshot = input.snapshot(context);
  assert.deepEqual(snapshot.actions.move, { x: 0, y: 0 });
  assert.equal(snapshot.actions.pause, true);
  input.setKeyboardBindings(rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'pause', 'KeyG'));
  input.setKey('KeyG', true, 2);
  snapshot = input.snapshot(context);
  assert.equal(snapshot.actions.pause, true);
  assert.equal(snapshot.actions.grenade, false);
  assert.equal(input.pendingActions.has('grenade'), false);
});

test('M3 InputState consumes remapped bindings instead of hard-coded keyboard actions', () => {
  const bindings = rebindKeyboardAction(DEFAULT_KEYBOARD_BINDINGS, 'pause', 'KeyR');
  const input = new InputState({ keyboardBindings: bindings });
  input.setKey('Space', true, 1);
  input.setKey('KeyR', true, 2);
  const snapshot = input.snapshot({
    actor: { x: 0, y: 0, z: 0, visualLiftZ: 0 },
    camera: { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 },
    viewport: { width: 800, height: 450 },
    nowMs: 2,
  });
  assert.equal(snapshot.actions.pause, true);
  input.setKey('KeyR', false, 3);
  input.consumeBufferedActions(snapshot.sequence);
  const released = input.snapshot({
    actor: { x: 0, y: 0, z: 0, visualLiftZ: 0 },
    camera: { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 },
    viewport: { width: 800, height: 450 },
    nowMs: 200,
  });
  assert.equal(released.actions.pause, false);
});
