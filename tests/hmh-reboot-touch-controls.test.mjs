import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TouchControlState,
  computeStickVector,
  createTouchControlAdapter,
  isGameplayControlTarget,
} from '../apps/hmh-reboot/src/touch-controls.mjs';

test('stick vectors apply configurable radius dead zone and sensitivity', () => {
  assert.deepEqual(computeStickVector({ x: 0, y: 0 }, { x: 10, y: 0 }, { radius: 100, deadZone: 0.2, sensitivity: 1 }), { x: 0, y: 0 });
  const full = computeStickVector({ x: 0, y: 0 }, { x: 100, y: 0 }, { radius: 100, deadZone: 0.2, sensitivity: 1 });
  assert.deepEqual(full, { x: 1, y: 0 });
  const sensitive = computeStickVector({ x: 0, y: 0 }, { x: 50, y: 0 }, { radius: 100, deadZone: 0, sensitivity: 2 });
  assert.deepEqual(sensitive, { x: 1, y: 0 });
});

test('independent pointer ids preserve simultaneous movement aim and actions', () => {
  const touch = new TouchControlState({ stickRadius: 80, deadZone: 0.1 });
  touch.beginStick(11, 'move', { x: 100, y: 300 });
  touch.beginStick(22, 'aim', { x: 500, y: 300 });
  touch.movePointer(11, { x: 140, y: 300 });
  touch.movePointer(22, { x: 500, y: 240 });
  touch.beginAction(33, 'grenade');
  touch.beginAction(44, 'dash');
  const snapshot = touch.snapshot();
  assert.ok(snapshot.moveX > 0);
  assert.ok(snapshot.aimY < 0);
  assert.equal(snapshot.grenade, true);
  assert.equal(snapshot.dash, true);
  touch.endPointer(33);
  assert.equal(touch.snapshot().grenade, false);
  assert.ok(touch.snapshot().moveX > 0, 'ending an action pointer must not cancel movement');
});

test('lost pointers and cancel-all clear only owned controls without sticky state', () => {
  const touch = new TouchControlState();
  touch.beginStick(1, 'move', { x: 0, y: 0 });
  touch.movePointer(1, { x: 50, y: 0 });
  touch.beginAction(2, 'fire');
  touch.endPointer(999);
  assert.equal(touch.snapshot().fire, true);
  touch.cancelAll();
  assert.deepEqual(touch.snapshot(), {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0,
    fire: false, melee: false, grenade: false, dash: false, pause: false,
  });
});

test('only explicit control descendants are treated as gameplay controls', () => {
  const control = { closest: (selector) => selector === '[data-hmh-control]' ? { dataset: { hmhControl: 'move' } } : null };
  const hud = { closest: () => null };
  assert.equal(isGameplayControlTarget(control), true);
  assert.equal(isGameplayControlTarget(hud), false);
  assert.equal(isGameplayControlTarget(null), false);
});

test('invalid pointer reuse roles and stick settings fail closed', () => {
  const touch = new TouchControlState();
  touch.beginStick(1, 'move', { x: 0, y: 0 });
  assert.throws(() => touch.beginStick(1, 'aim', { x: 0, y: 0 }), /pointer/);
  assert.throws(() => touch.beginStick(2, 'other', { x: 0, y: 0 }), /role/);
  assert.throws(() => computeStickVector({ x: 0, y: 0 }, { x: 1, y: 1 }, { radius: 0 }), /radius/);
});

class FakeElement {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.listeners = new Map();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
  }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  remove() { this.removed = true; }
  setPointerCapture(pointerId) { this.captured = pointerId; }
  emit(type, event = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

test('browser touch adapter owns UI pointers relayouts and clears state on teardown', () => {
  const documentRef = { createElement: () => new FakeElement(documentRef) };
  const root = new FakeElement(documentRef);
  const windowRef = new FakeElement(documentRef);
  windowRef.innerWidth = 0;
  windowRef.innerHeight = 0;
  const snapshots = [];
  const input = { setTouch: (value) => snapshots.push(value) };
  let prevented = 0;
  let stopped = 0;
  let pauseToggles = 0;
  const adapter = createTouchControlAdapter({
    input, root, windowRef, documentRef, now: () => 25,
    getSafeInsets: () => ({ top: 20, right: 10, bottom: 30, left: 24 }),
    onPause: () => { pauseToggles += 1; },
  });
  windowRef.innerWidth = 844;
  windowRef.innerHeight = 390;
  windowRef.emit('resize');
  assert.ok(Number.parseFloat(adapter.elements.move.style.left) >= 24);
  const event = (pointerId, clientX, clientY) => ({
    pointerId, clientX, clientY,
    preventDefault: () => { prevented += 1; },
    stopPropagation: () => { stopped += 1; },
  });
  adapter.elements.move.emit('pointerdown', event(1, 100, 300));
  adapter.elements.move.emit('pointermove', event(1, 150, 300));
  adapter.elements.aim.emit('pointerdown', event(2, 600, 300));
  adapter.elements.aim.emit('pointermove', event(2, 600, 240));
  adapter.elements.grenade.emit('pointerdown', event(3, 0, 0));
  adapter.elements.pause.emit('pointerdown', event(4, 0, 0));
  assert.equal(pauseToggles, 1);
  adapter.elements.pause.emit('pointerup', event(4, 0, 0));
  assert.ok(snapshots.at(-1).moveX > 0);
  assert.ok(snapshots.at(-1).aimY < 0);
  assert.equal(snapshots.at(-1).grenade, true);
  windowRef.emit('pointerup', event(3, 0, 0));
  assert.equal(snapshots.at(-1).grenade, false, 'window release must clear an owned pointer when capture is unavailable');
  assert.ok(prevented >= 5 && stopped >= 5);
  const priorTop = adapter.elements.move.style.top;
  windowRef.innerWidth = 390;
  windowRef.innerHeight = 844;
  windowRef.emit('resize');
  assert.notEqual(adapter.elements.move.style.top, priorTop);
  adapter.destroy();
  assert.equal(root.children[0].removed, true);
  assert.equal(snapshots.at(-1).moveX, 0);
  assert.equal(snapshots.at(-1).grenade, false);
});
