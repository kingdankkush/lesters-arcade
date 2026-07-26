import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  InputState,
  POINTER_AIM_IDLE_MS,
  normalizeAxisPair,
  mapGamepadSnapshot,
  computeTouchControlLayout,
  createBrowserInputController,
} from '../apps/hmh-reboot/src/input.mjs';
import { computeCombatStatusLayout, computeHudMinimapLayout } from '../apps/hmh-reboot/src/hud-layout.mjs';
import { FIXED_STEP_MS, DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { createCameraState } from '../apps/hmh-reboot/src/world-space.mjs';

const context = {
  actor: { x: 100, y: 100, z: 0, visualLiftZ: 0 },
  camera: createCameraState({ x: 100, y: 100 }),
  viewport: { width: 800, height: 600 },
};

test('keyboard WASD and arrow bindings normalize diagonals into canonical movement actions', () => {
  const input = new InputState();
  input.setKey('KeyW', true, 10);
  input.setKey('KeyD', true, 11);
  const snapshot = input.snapshot({ ...context, nowMs: 20 });
  assert.ok(Math.abs(snapshot.actions.move.x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(snapshot.actions.move.y + Math.SQRT1_2) < 1e-12);
  input.setKey('KeyW', false, 21);
  input.setKey('KeyD', false, 21);
  input.setKey('ArrowLeft', true, 22);
  assert.deepEqual(input.snapshot({ ...context, nowMs: 23 }).actions.move, { x: -1, y: 0 });
});

test('keyboard number keys select retained weapon slots deterministically', () => {
  const input = new InputState();
  input.setKey('Digit3', true, 10);
  const snapshot = input.snapshot({ ...context, nowMs: 11 });
  assert.equal(snapshot.actions.weaponSlot, 3);
  assert.equal(snapshot.actions.weaponNext, false);
});

test('pointer screen aim converts through the canonical camera into a normalized world direction', () => {
  const input = new InputState();
  input.setPointer({ screenX: 500, screenY: 300, fire: true }, 100);
  const snapshot = input.snapshot({ ...context, nowMs: 104 });
  assert.deepEqual(snapshot.actions.aim, { x: 1, y: 0, active: true });
  assert.equal(snapshot.actions.aimAssist, false);
  assert.equal(snapshot.metadata.aimSource, 'pointer');
  assert.equal(snapshot.actions.fire, true);
  assert.equal(snapshot.metadata.lastActiveDevice, 'keyboard-mouse');
  assert.equal(snapshot.metadata.sourceLatencyMs, 4);
});

test('stale pointer aim expires so keyboard auto-target can reacquire enemies', () => {
  const input = new InputState();
  input.setPointer({ screenX: 500, screenY: 300, fire: false }, 100);
  assert.equal(POINTER_AIM_IDLE_MS, 1000);
  const fresh = input.snapshot({ ...context, nowMs: 100 + POINTER_AIM_IDLE_MS });
  assert.equal(fresh.actions.aim.active, true);
  const stale = input.snapshot({ ...context, nowMs: 101 + POINTER_AIM_IDLE_MS });
  assert.deepEqual(stale.actions.aim, { x: 0, y: 0, active: false });
  assert.equal(stale.metadata.aimSource, 'none');
});

test('touch controls support simultaneous independent movement and aim plus every action', () => {
  const input = new InputState();
  input.setTouch({
    moveX: -1, moveY: 0,
    aimX: 0, aimY: 1,
    fire: true, melee: true, grenade: true, dash: true, pause: true, weaponNext: true,
  }, 50);
  const { actions, metadata } = input.snapshot({ ...context, nowMs: 55 });
  assert.deepEqual(actions.move, { x: -1, y: 0 });
  assert.deepEqual(actions.aim, { x: 0, y: 1, active: true });
  assert.equal(actions.aimAssist, true);
  assert.deepEqual({ fire: actions.fire, melee: actions.melee, grenade: actions.grenade, dash: actions.dash, pause: actions.pause }, {
    fire: true, melee: true, grenade: true, dash: true, pause: true,
  });
  assert.equal(actions.weaponNext, true);
  assert.equal(metadata.lastActiveDevice, 'touch');
});

test('gamepad mapping applies radial deadzones and standard action buttons', () => {
  const mapped = mapGamepadSnapshot({
    axes: [0.1, 0.1, 0.8, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: [0, 2, 4, 7, 9, 15].includes(index) })),
  });
  assert.deepEqual(mapped.move, { x: 0, y: 0 });
  assert.ok(mapped.aim.x > 0.7);
  assert.deepEqual(mapped.actions, { fire: true, melee: true, grenade: true, dash: true, pause: true, weaponSlot: 0, weaponNext: true });
});

test('keyboard pointer touch and gamepad produce parity-equivalent canonical actions', () => {
  const keyboard = new InputState();
  keyboard.setKey('KeyD', true, 1);
  keyboard.setPointer({ screenX: 400, screenY: 200, fire: true }, 2);

  const touch = new InputState();
  touch.setTouch({ moveX: 1, moveY: 0, aimX: 0, aimY: -1, fire: true }, 2);

  const gamepad = new InputState();
  gamepad.setGamepad({ moveX: 1, moveY: 0, aimX: 0, aimY: -1, fire: true }, 2);

  const canonical = (state) => state.snapshot({ ...context, nowMs: 3 }).actions;
  const pointerActions = canonical(keyboard);
  const touchActions = canonical(touch);
  const gamepadActions = canonical(gamepad);
  const gameplay = ({ aimAssist, ...actions }) => actions;
  assert.deepEqual(gameplay(pointerActions), gameplay(touchActions));
  assert.deepEqual(gameplay(touchActions), gameplay(gamepadActions));
  assert.equal(pointerActions.aimAssist, false);
  assert.equal(touchActions.aimAssist, true);
  assert.equal(gamepadActions.aimAssist, true);
});

test('last active device follows the newest source without coupling movement and aim channels', () => {
  const input = new InputState();
  input.setKey('KeyA', true, 10);
  input.setGamepad({ moveX: 0, moveY: 0, aimX: 1, aimY: 0 }, 11);
  const snapshot = input.snapshot({ ...context, nowMs: 12 });
  assert.deepEqual(snapshot.actions.move, { x: -1, y: 0 });
  assert.deepEqual(snapshot.actions.aim, { x: 1, y: 0, active: true });
  assert.equal(snapshot.metadata.lastActiveDevice, 'gamepad');
});

test('reset clears sticky movement aim and actions after blur visibility or pointer cancellation', () => {
  const input = new InputState();
  input.setKey('KeyW', true, 1);
  input.setPointer({ screenX: 700, screenY: 300, fire: true }, 1);
  input.setTouch({ moveX: 1, moveY: 0, aimX: 0, aimY: 1, dash: true }, 1);
  input.reset('visibility-hidden', 2);
  const snapshot = input.snapshot({ ...context, nowMs: 3 });
  assert.deepEqual(snapshot.actions.move, { x: 0, y: 0 });
  assert.deepEqual(snapshot.actions.aim, { x: 0, y: 0, active: false });
  assert.equal(snapshot.actions.fire, false);
  assert.equal(snapshot.actions.dash, false);
  assert.equal(snapshot.metadata.resetReason, 'visibility-hidden');
});

test('rapid one-shot combat taps survive a zero-step render frame and are consumed by exactly one fixed tick', () => {
  const bindings = [
    ['Space', 'fire'],
    ['KeyE', 'melee'],
    ['KeyF', 'grenade'],
    ['ShiftLeft', 'dash'],
  ];
  for (const [code, action] of bindings) {
    const input = new InputState();
    const simulation = new DeterministicSimulation();
    const consumed = [];
    simulation.onStep(({ input: tickInput }) => consumed.push(tickInput[action]));
    simulation.start();

    input.setKey(code, true, 1);
    input.setKey(code, false, 2);
    const beforeStep = input.snapshot({ ...context, nowMs: 3 });
    assert.equal(beforeStep.actions[action], true, `${action} tap must remain buffered after release`);
    assert.equal(simulation.update(FIXED_STEP_MS / 2, beforeStep.actions).steps, 0);

    const admitted = input.snapshot({ ...context, nowMs: 4 });
    assert.equal(admitted.actions[action], true, `${action} tap must survive a render frame with no fixed step`);
    assert.equal(simulation.update(FIXED_STEP_MS / 2, admitted.actions).steps, 1);
    input.consumeBufferedActions(admitted.sequence);

    const afterStep = input.snapshot({ ...context, nowMs: 5 });
    assert.equal(afterStep.actions[action], false, `${action} tap must clear after the admitted fixed tick`);
    simulation.update(FIXED_STEP_MS, afterStep.actions);
    assert.deepEqual(consumed, [true, false], `${action} tap must enter replay authority exactly once`);
  }
});

test('unconsumed one-shot combat taps expire after the bounded 100 ms response window', () => {
  const input = new InputState();
  input.setKey('ShiftLeft', true, 0);
  input.setKey('ShiftLeft', false, 1);
  assert.equal(input.snapshot({ ...context, nowMs: 100 }).actions.dash, true);
  assert.equal(input.snapshot({ ...context, nowMs: 101 }).actions.dash, false);
});

test('pointer touch and gamepad rising edges receive the same one-shot action buffering as keyboard', () => {
  const pointer = new InputState();
  pointer.setPointer({ screenX: 500, screenY: 300, fire: true }, 1);
  pointer.setPointer({ screenX: 500, screenY: 300, fire: false }, 2);
  assert.equal(pointer.snapshot({ ...context, nowMs: 3 }).actions.fire, true);

  for (const device of ['touch', 'gamepad']) {
    const input = new InputState();
    const pressed = { fire: true, melee: true, grenade: true, dash: true };
    if (device === 'touch') {
      input.setTouch(pressed, 1);
      input.setTouch({}, 2);
    } else {
      input.setGamepad(pressed, 1);
      input.setGamepad({}, 2);
    }
    const actions = input.snapshot({ ...context, nowMs: 3 }).actions;
    assert.deepEqual(
      { fire: actions.fire, melee: actions.melee, grenade: actions.grenade, dash: actions.dash },
      pressed,
      `${device} taps must retain every buffered combat action`,
    );
  }
});

test('radial normalization removes deadzone drift and caps magnitude at one', () => {
  assert.deepEqual(normalizeAxisPair(0.1, -0.1, 0.2), { x: 0, y: 0 });
  const diagonal = normalizeAxisPair(1, 1, 0);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
  assert.throws(() => normalizeAxisPair(Number.NaN, 0), /finite/i);
});

test('touch layout respects safe areas and adapts to portrait and landscape rotation', () => {
  const safeInsets = { top: 20, right: 10, bottom: 30, left: 15 };
  const portrait = computeTouchControlLayout({ width: 390, height: 844, safeInsets });
  const landscape = computeTouchControlLayout({ width: 844, height: 390, safeInsets });
  for (const layout of [portrait, landscape]) {
    assert.ok(layout.moveStick.x >= safeInsets.left);
    assert.ok(layout.aimStick.x <= layout.viewport.width - safeInsets.right);
    for (const button of Object.values(layout.buttons)) {
      assert.ok(button.x >= safeInsets.left && button.x <= layout.viewport.width - safeInsets.right);
      assert.ok(button.y >= safeInsets.top && button.y <= layout.viewport.height - safeInsets.bottom);
    }
  }
  assert.notDeepEqual(portrait.moveStick, landscape.moveStick);
  const topActionDistance = Math.hypot(
    portrait.buttons.weaponNext.x - portrait.buttons.pause.x,
    portrait.buttons.weaponNext.y - portrait.buttons.pause.y,
  );
  assert.ok(topActionDistance >= portrait.buttons.weaponNext.radius + portrait.buttons.pause.radius + 8);
  assert.ok(portrait.buttons.weaponNext.x > portrait.viewport.width - 100);
});

test('landscape touch utility buttons stay left of the authored minimap exclusion zone', () => {
  for (const viewport of [{ width: 1_024, height: 768 }, { width: 844, height: 390 }]) {
    const touch = computeTouchControlLayout(viewport);
    const minimap = computeHudMinimapLayout({ ...viewport, worldWidth: 10_000, worldHeight: 4_000 });
    for (const action of ['pause', 'weaponNext']) {
      const button = touch.buttons[action];
      assert.ok(
        button.x + button.radius <= minimap.outer.left - 8,
        `${viewport.width}x${viewport.height} ${action} overlaps minimap exclusion`,
      );
    }
    if (viewport.height <= 520) assert.equal(minimap.width, 140);
  }
});

test('touch landscape combat status clears top chrome while desktop and portrait retain their layouts', () => {
  const phoneLandscape = computeCombatStatusLayout({ width: 844, height: 390, touchUiEnabled: true });
  const tabletLandscape = computeCombatStatusLayout({ width: 1_024, height: 768, touchUiEnabled: true });
  const phonePortrait = computeCombatStatusLayout({ width: 390, height: 844, touchUiEnabled: true });
  const desktop = computeCombatStatusLayout({ width: 1_440, height: 900, touchUiEnabled: false });
  assert.deepEqual(
    [phoneLandscape.compact, phoneLandscape.y, tabletLandscape.compact, tabletLandscape.y],
    [true, 76, true, 240],
  );
  assert.deepEqual([phonePortrait.multiline, phonePortrait.y], [true, 202]);
  assert.deepEqual([desktop.compact, desktop.multiline, desktop.y, desktop.fontSize], [false, false, 82, 18]);
});

class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, event = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

test('browser controller prevents gameplay scrolling and resets on blur visibility and cancellation', () => {
  const target = new FakeEventTarget();
  const windowRef = new FakeEventTarget();
  const documentRef = new FakeEventTarget();
  documentRef.visibilityState = 'visible';
  const input = new InputState();
  let prevented = 0;
  let focusCalls = 0;
  target.focus = () => { focusCalls += 1; };
  const controller = createBrowserInputController({ input, target, windowRef, documentRef, now: () => 10 });
  target.emit('pointerdown', { clientX: 400, clientY: 300, button: 0, preventDefault: () => { prevented += 1; } });
  target.emit('keydown', { code: 'ArrowUp', preventDefault: () => { prevented += 1; } });
  target.emit('contextmenu', { preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 3);
  assert.equal(focusCalls, 1);
  windowRef.emit('blur');
  assert.equal(input.snapshot({ ...context, nowMs: 11 }).metadata.resetReason, 'blur');
  documentRef.visibilityState = 'hidden';
  documentRef.emit('visibilitychange');
  target.emit('pointercancel');
  target.emit('touchcancel', { preventDefault: () => { prevented += 1; } });
  assert.equal(input.snapshot({ ...context, nowMs: 12 }).metadata.resetReason, 'touch-cancel');
  controller.destroy();
  assert.equal([...target.listeners.values()].every((listeners) => listeners.size === 0), true);
});

test('runtime canvas is explicitly keyboard-focusable', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /app\.canvas\.tabIndex = 0/);
});
