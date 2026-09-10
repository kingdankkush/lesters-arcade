import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InputState } from '../apps/hmh-reboot/src/input.mjs';
import { createCameraState } from '../apps/hmh-reboot/src/world-space.mjs';
import { HMH_ACTION_MAP } from '../apps/hmh-reboot/src/action-map.mjs';

import {
  TouchControlState,
  computeStickVector,
  createTouchOnboardingGate,
  createTouchControlAdapter,
  isTouchUiEnabled,
  isGameplayControlTarget,
  TOUCH_CONTROL_SPEC,
  touchControlsHintText,
} from '../apps/hmh-reboot/src/touch-controls.mjs';

test('touch mode and first-run onboarding share one bounded authority', () => {
  assert.equal(isTouchUiEnabled({ coarsePointer: true, width: 1_440 }), true);
  assert.equal(isTouchUiEnabled({ coarsePointer: false, width: 900 }), true);
  assert.equal(isTouchUiEnabled({ coarsePointer: false, width: 901 }), false);

  const claimTouchOnboarding = createTouchOnboardingGate(true);
  assert.equal(claimTouchOnboarding(), true, 'first touch run gets the cue');
  assert.equal(claimTouchOnboarding(), false, 'a restart must not replay the cue');
  assert.equal(claimTouchOnboarding(), false);
  assert.equal(createTouchOnboardingGate(false)(), false, 'desktop never claims a touch cue');
});

test('in-game reduced motion consumes the first-run cue without playing it', () => {
  const claim = createTouchOnboardingGate(true);
  assert.equal(claim({ reduceMotion: true }), false, 'game preference suppresses the first cue independently of OS preference');
  assert.equal(claim({ reduceMotion: false }), false, 'turning motion back on must not replay a consumed cue');
  assert.equal(createTouchOnboardingGate(true)({ reduceMotion: false }), true);
});

test('runtime touch cue consults the effective game reduced-motion setting', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /onboardingPulse:\s*claimTouchOnboarding\(\{\s*reduceMotion:\s*settings\.reduceMotion\s*\}\)/);
});

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
  assert.throws(()=>touch.beginAction(44,'dash'),/unknown/);
  assert.throws(()=>touch.beginAction(55,'weaponNext'),/unknown/);
  const snapshot = touch.snapshot();
  assert.ok(snapshot.moveX > 0);
  assert.ok(snapshot.aimY < 0);
  assert.equal(snapshot.grenade, true);
  assert.equal(snapshot.dash, false);
  assert.equal(snapshot.weaponNext, false);
  touch.endPointer(33);
  assert.equal(touch.snapshot().grenade, false);
  assert.ok(touch.snapshot().moveX > 0, 'ending an action pointer must not cancel movement');
});

test('lost pointers and cancel-all clear only owned controls without sticky state', () => {
  const touch = new TouchControlState();
  touch.beginStick(1, 'move', { x: 0, y: 0 });
  touch.movePointer(1, { x: 50, y: 0 });
  touch.beginAction(2, 'grenade');
  touch.endPointer(999);
  assert.equal(touch.snapshot().grenade, true);
  touch.cancelAll();
  assert.deepEqual(touch.snapshot(), {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0,
    fire: false, melee: false, grenade: false, dash: false, pause: false, weaponNext: false,
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
    onboardingPulse: true,
  });
  assert.equal(root.children[0].dataset.hmhTouchOnboarding, 'once');
  windowRef.innerWidth = 844;
  windowRef.innerHeight = 390;
  windowRef.emit('resize');
  assert.ok(Number.parseFloat(adapter.elements.move.style.left) >= 24);
  const event = (pointerId, clientX, clientY) => ({
    pointerId, clientX, clientY,
    preventDefault: () => { prevented += 1; },
    stopPropagation: () => { stopped += 1; },
  });
  // Drag tracking lives on the window surface, not on the stick element: a
  // thumb that leaves the stick radius must keep steering.
  adapter.elements.move.emit('pointerdown', event(1, 100, 300));
  windowRef.emit('pointermove', event(1, 150, 300));
  adapter.elements.aim.emit('pointerdown', event(2, 600, 300));
  windowRef.emit('pointermove', event(2, 600, 240));
  adapter.elements.power.emit('pointerdown', event(3, 0, 0));
  adapter.elements.pause.emit('pointerdown', event(4, 0, 0));
  assert.equal(adapter.elements.weapon,undefined);
  assert.equal(adapter.elements.power.textContent,'GRENADE');
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

function timedTouchAdapterFixture() {
  const documentRef = new FakeElement(null);
  documentRef.createElement = () => new FakeElement(documentRef);
  const root = new FakeElement(documentRef); const windowRef = new FakeElement(documentRef);
  windowRef.innerWidth = 390; windowRef.innerHeight = 844;
  let clock = 0; let id = 0; const timers = new Map(); const snapshots = [];
  windowRef.setTimeout = (callback, delay) => { timers.set(++id, { callback, at: clock + delay }); return id; };
  windowRef.clearTimeout = (key) => timers.delete(key);
  const adapter = createTouchControlAdapter({ input: { setTouch: value => snapshots.push(value) }, root, windowRef, documentRef, now: () => clock, getSafeInsets: () => ({}) });
  const event = (pointerId) => ({ pointerId, clientX: 300, clientY: 700, preventDefault() {}, stopPropagation() {} });
  const at = (value) => {
    clock = value;
    for (let steps = 0; steps < 8; steps += 1) {
      const due = [...timers].find(([, timer]) => timer.at <= clock);
      if (!due) return;
      timers.delete(due[0]); due[1].callback();
    }
    throw new Error('gesture release timer must settle');
  };
  return { adapter, windowRef, snapshots, timers, event, at, tap(pointerId, start) { at(start); adapter.elements.aim.emit('pointerdown', event(pointerId)); at(start + 20); windowRef.emit('pointerup', event(pointerId)); } };
}

test('rapid stick taps and drags never create hidden combat actions or delayed timers',()=>{
  const f=timedTouchAdapterFixture();
  for(let i=0;i<8;i++) f.tap(i+1,100+i*40);
  assert.equal(f.snapshots.at(-1).melee,false);assert.equal(f.snapshots.at(-1).dash,false);
  assert.equal(f.timers.size,0);f.adapter.destroy();
});
test('grenade and sticks release on pointer loss, raw touch cancellation and blur',()=>{
  for(const cancellation of ['pointercancel','lostpointercapture','touchcancel','blur']) {
    const f=timedTouchAdapterFixture();
    f.adapter.elements.power.emit('pointerdown',f.event(1));
    assert.equal(f.snapshots.at(-1).grenade,true);
    if(cancellation==='lostpointercapture') f.adapter.elements.power.emit(cancellation,f.event(1));
    else f.windowRef.emit(cancellation,{...f.event(1),touches:[]});
    assert.equal(f.snapshots.at(-1).grenade,false);
    assert.equal(f.snapshots.at(-1).melee,false);assert.equal(f.timers.size,0);
    f.adapter.destroy();
  }
});
test('missing or distant pointer release clears aim without a gesture or stuck control',()=>{
  for(const missing of [false,true]) {
    const f=timedTouchAdapterFixture();f.adapter.elements.aim.emit('pointerdown',f.event(1));
    f.windowRef.emit('pointermove',{...f.event(1),clientX:360});assert.ok(f.snapshots.at(-1).aimX>0);
    const release={...f.event(1),clientX:500};if(missing){delete release.clientX;delete release.clientY;}
    f.windowRef.emit('pointerup',release);assert.equal(f.snapshots.at(-1).aimX,0);
    assert.equal(f.snapshots.at(-1).melee,false);f.adapter.destroy();
  }
});
