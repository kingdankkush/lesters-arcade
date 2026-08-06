import { computeTouchControlLayout } from './input.mjs';

import { finite } from './value-guards.mjs';

function point(value, name) {
  return { x: finite(value?.x, `${name}.x`), y: finite(value?.y, `${name}.y`) };
}

export function computeStickVector(origin, current, {
  radius = 72,
  deadZone = 0.12,
  sensitivity = 1,
} = {}) {
  if (!(radius > 0)) throw new TypeError('radius must be positive');
  if (!(deadZone >= 0 && deadZone < 1)) throw new TypeError('deadZone must be in [0, 1)');
  if (!(sensitivity > 0)) throw new TypeError('sensitivity must be positive');
  const start = point(origin, 'origin');
  const end = point(current, 'current');
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const normalizedMagnitude = Math.min(1, distance / radius);
  if (distance === 0 || normalizedMagnitude <= deadZone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, ((normalizedMagnitude - deadZone) / (1 - deadZone)) * sensitivity);
  return { x: dx / distance * magnitude, y: dy / distance * magnitude };
}

const ACTIONS = new Set(['fire', 'melee', 'grenade', 'dash', 'pause', 'weaponNext']);

// Double-tapping the movement stick dashes, the standard mobile idiom. The
// simplified control set has no room for a dash button, but dash is a core
// movement mechanic with i-frames, so losing it on touch would be a downgrade.
// This costs no screen space and adds no control.
export const DOUBLE_TAP_DASH_WINDOW_MS = 280;
// How long the resulting dash stays true in the snapshot. The simulation reads
// a rising edge, so this only has to span a frame or two.
export const DOUBLE_TAP_DASH_HOLD_MS = 90;

export class TouchControlState {
  constructor({ stickRadius = 72, deadZone = 0.12, sensitivity = 1, now = () => 0 } = {}) {
    if (!(stickRadius > 0)) throw new TypeError('stickRadius must be positive');
    if (typeof now !== 'function') throw new TypeError('now must be a function');
    this.config = Object.freeze({ stickRadius, deadZone, sensitivity });
    this.pointers = new Map();
    this.now = now;
    this.lastMoveTapAt = null;
    this.dashUntil = null;
  }

  #assertAvailable(pointerId) {
    if (this.pointers.has(pointerId)) throw new TypeError('pointer is already assigned');
  }

  beginStick(pointerId, role, origin) {
    this.#assertAvailable(pointerId);
    if (role !== 'move' && role !== 'aim') throw new TypeError('stick role must be move or aim');
    const start = point(origin, 'origin');
    if (role === 'move') {
      const at = this.now();
      if (this.lastMoveTapAt !== null && at - this.lastMoveTapAt <= DOUBLE_TAP_DASH_WINDOW_MS) {
        this.dashUntil = at + DOUBLE_TAP_DASH_HOLD_MS;
        // Consume the pair so a third tap does not chain another dash.
        this.lastMoveTapAt = null;
      } else {
        this.lastMoveTapAt = at;
      }
    }
    this.pointers.set(pointerId, { type: 'stick', role, origin: start, current: { ...start } });
  }

  beginAction(pointerId, action) {
    this.#assertAvailable(pointerId);
    if (!ACTIONS.has(action)) throw new TypeError('unknown touch action');
    this.pointers.set(pointerId, { type: 'action', action });
  }

  movePointer(pointerId, position) {
    const pointer = this.pointers.get(pointerId);
    if (!pointer || pointer.type !== 'stick') return false;
    pointer.current = point(position, 'position');
    return true;
  }

  endPointer(pointerId) {
    return this.pointers.delete(pointerId);
  }

  // Ground-truth release: when the platform reports no remaining touches, no
  // control may stay engaged, regardless of which pointer events got lost on
  // the way. Unlike cancelAll this keeps tap bookkeeping so a dash pair
  // completed just before the release still lands.
  endAllPointers() {
    if (this.pointers.size === 0) return false;
    this.pointers.clear();
    return true;
  }

  cancelAll() {
    this.pointers.clear();
    this.lastMoveTapAt = null;
    this.dashUntil = null;
  }

  snapshot() {
    let move = { x: 0, y: 0 };
    let aim = { x: 0, y: 0 };
    const actions = { fire: false, melee: false, grenade: false, dash: false, pause: false, weaponNext: false };
    if (this.dashUntil !== null) {
      if (this.now() <= this.dashUntil) actions.dash = true;
      else this.dashUntil = null;
    }
    for (const pointer of this.pointers.values()) {
      if (pointer.type === 'action') actions[pointer.action] = true;
      else {
        const vector = computeStickVector(pointer.origin, pointer.current, {
          radius: this.config.stickRadius,
          deadZone: this.config.deadZone,
          sensitivity: this.config.sensitivity,
        });
        if (pointer.role === 'move') move = vector;
        else aim = vector;
      }
    }
    return {
      moveX: move.x, moveY: move.y,
      aimX: aim.x, aimY: aim.y,
      ...actions,
    };
  }
}

export function isGameplayControlTarget(target) {
  return Boolean(target && typeof target.closest === 'function' && target.closest('[data-hmh-control]'));
}

export function readSafeAreaInsets(documentRef = globalThis.document, windowRef = globalThis.window) {
  if (!documentRef?.createElement || !documentRef?.body?.appendChild || !windowRef?.getComputedStyle) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const probe = documentRef.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  documentRef.body.appendChild(probe);
  const style = windowRef.getComputedStyle(probe);
  const value = (name) => Math.max(0, Number.parseFloat(style[name]) || 0);
  const insets = { top: value('paddingTop'), right: value('paddingRight'), bottom: value('paddingBottom'), left: value('paddingLeft') };
  probe.remove();
  return insets;
}

export function createTouchControlAdapter({
  input,
  root,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  now = () => performance.now(),
  stickRadius = 72,
  deadZone = 0.12,
  sensitivity = 1,
  getSafeInsets = null,
  onPause = null,
} = {}) {
  if (!input || typeof input.setTouch !== 'function') throw new TypeError('input must expose setTouch');
  if (!root?.appendChild || !documentRef?.createElement) throw new TypeError('root and documentRef must support DOM construction');
  if (!windowRef?.addEventListener || !windowRef?.removeEventListener) throw new TypeError('windowRef must be an EventTarget');
  if (onPause !== null && typeof onPause !== 'function') throw new TypeError('onPause must be a function');

  const state = new TouchControlState({ stickRadius, deadZone, sensitivity, now });
  const overlay = documentRef.createElement('div');
  overlay.className = 'hmh-touch-controls';
  overlay.dataset.hmhTouchControls = 'true';
  const elements = {};
  const knobs = {};
  const listeners = [];
  const listen = (source, type, callback, options) => {
    source.addEventListener(type, callback, options);
    listeners.push(() => source.removeEventListener(type, callback, options));
  };
  const own = (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
  };
  // A double-tap dash is time-boxed rather than pointer-held, so without a
  // trailing sync the dash flag would stay latched true in the last published
  // snapshot until some unrelated pointer event happened to refresh it.
  let dashReleaseTimer = null;
  const sync = () => {
    const snapshot = state.snapshot();
    if (knobs.move) knobs.move.style.transform = `translate(${snapshot.moveX * 55}%, ${snapshot.moveY * 55}%)`;
    if (knobs.aim) knobs.aim.style.transform = `translate(${snapshot.aimX * 55}%, ${snapshot.aimY * 55}%)`;
    input.setTouch(snapshot, now());
    if (snapshot.dash && state.dashUntil !== null && dashReleaseTimer === null) {
      const delay = Math.max(0, state.dashUntil - now()) + 1;
      dashReleaseTimer = windowRef.setTimeout?.(() => {
        dashReleaseTimer = null;
        sync();
      }, delay) ?? null;
    }
  };
  // Stick tracking must span the screen, not the control, so dragging off the
  // stick keeps working where pointer capture is unavailable.
  const surfaceListen = (type, handler) => listen(windowRef, type, handler);
  const makeControl = (name, label, className) => {
    const element = documentRef.createElement('div');
    element.className = className;
    element.dataset.hmhControl = name;
    element.textContent = label;
    overlay.appendChild(element);
    elements[name] = element;
    return element;
  };

  // Drag tracking and release are surface-level and identical for every
  // control, so they are registered ONCE here rather than per control.
  // Registering them inside the loops below produced five duplicate window
  // listeners and fired setTouch twice for a single pointermove.
  const endOwnedPointer = (event) => {
    if (!state.endPointer(event.pointerId)) return;
    own(event);
    sync();
  };
  // Tracked on the window so a thumb dragged beyond a stick keeps steering.
  surfaceListen('pointermove', (event) => {
    if (!state.movePointer(event.pointerId, { x: event.clientX, y: event.clientY })) return;
    own(event);
    sync();
  });
  surfaceListen('pointerup', endOwnedPointer);
  surfaceListen('pointercancel', endOwnedPointer);
  // Owner playtest follow-through (2026-08-02): the mobile smoke proved a
  // dropped synthesized pointerup can latch a stick ("hero kept moving after
  // the touch ended"). Raw touch events are the ground truth the pointer
  // stream sometimes loses: zero remaining touches releases everything.
  const releaseWhenNoTouchesRemain = (event) => {
    if (event.touches && event.touches.length === 0 && state.endAllPointers()) {
      own(event);
      sync();
    }
  };
  surfaceListen('touchend', releaseWhenNoTouchesRemain);
  surfaceListen('touchcancel', releaseWhenNoTouchesRemain);

  for (const role of ['move', 'aim']) {
    const element = makeControl(role, '', `hmh-touch-stick hmh-touch-stick--${role}`);
    const knob = documentRef.createElement('div');
    knob.className = 'hmh-touch-stick__knob';
    knobs[role] = knob;
    element.appendChild(knob);
    listen(element, 'pointerdown', (event) => {
      own(event);
      try { element.setPointerCapture?.(event.pointerId); } catch { /* synthetic or detached pointer */ }
      state.beginStick(event.pointerId, role, { x: event.clientX, y: event.clientY });
      sync();
    });
    listen(element, 'lostpointercapture', endOwnedPointer);
  }

  // Simplified mobile control set: power, weapon swap, and pause. Firing is
  // automatic when a target is in range.
  const labels = { power: 'POWER', weapon: 'SWAP', pause: 'II' };
  // The on-screen control maps onto the existing action vocabulary rather than
  // extending it, so the snapshot contract consumed by the simulation is
  // unchanged: POWER throws the grenade.
  const ACTION_BY_CONTROL = { power: 'grenade', weapon: 'weaponNext', pause: 'pause' };
  for (const control of Object.keys(labels)) {
    const action = ACTION_BY_CONTROL[control];
    const element = makeControl(control, labels[control], `hmh-touch-button hmh-touch-button--${control}`);
    listen(element, 'pointerdown', (event) => {
      own(event);
      try { element.setPointerCapture?.(event.pointerId); } catch { /* synthetic or detached pointer */ }
      state.beginAction(event.pointerId, action);
      sync();
      if (action === 'pause') onPause?.();
    });
    listen(element, 'lostpointercapture', endOwnedPointer);
  }

  const applyLayout = () => {
    const safeInsets = typeof getSafeInsets === 'function'
      ? getSafeInsets()
      : readSafeAreaInsets(documentRef, windowRef);
    // The visual viewport is the part actually on screen; the layout viewport
    // extends behind mobile browser chrome. Anchoring controls to the layout
    // viewport put the movement stick under the URL bar on a real phone.
    const visual = windowRef.visualViewport ?? null;
    const width = Math.max(1, Number(visual?.width) || Number(windowRef.innerWidth) || Number(root.clientWidth) || Number(documentRef.documentElement?.clientWidth) || 1);
    const height = Math.max(1, Number(visual?.height) || Number(windowRef.innerHeight) || Number(root.clientHeight) || Number(documentRef.documentElement?.clientHeight) || 1);
    const layout = computeTouchControlLayout({ width, height, safeInsets });
    for (const role of ['move', 'aim']) {
      const descriptor = layout[`${role}Stick`];
      Object.assign(elements[role].style, {
        left: `${descriptor.x - descriptor.radius}px`,
        top: `${descriptor.y - descriptor.radius}px`,
        width: `${descriptor.radius * 2}px`,
        height: `${descriptor.radius * 2}px`,
      });
    }
    for (const [action, descriptor] of Object.entries(layout.buttons)) {
      Object.assign(elements[action].style, {
        left: `${descriptor.x - descriptor.radius}px`,
        top: `${descriptor.y - descriptor.radius}px`,
        width: `${descriptor.radius * 2}px`,
        height: `${descriptor.radius * 2}px`,
      });
    }
  };

  root.appendChild(overlay);
  applyLayout();
  listen(windowRef, 'resize', applyLayout);
  listen(windowRef, 'orientationchange', applyLayout);
  // The visual viewport changes as mobile browser chrome collapses or the
  // keyboard opens; without these the controls stay where they were first laid
  // out and drift out of reach.
  if (windowRef.visualViewport?.addEventListener) {
    listen(windowRef.visualViewport, 'resize', applyLayout);
    listen(windowRef.visualViewport, 'scroll', applyLayout);
  }
  listen(windowRef, 'blur', () => { state.cancelAll(); sync(); });
  if (documentRef?.addEventListener && documentRef?.removeEventListener) {
    listen(documentRef, 'visibilitychange', () => {
      if (documentRef.visibilityState === 'hidden') { state.cancelAll(); sync(); }
    });
  }

  return Object.freeze({
    elements: Object.freeze(elements),
    relayout: applyLayout,
    destroy() {
      for (const remove of listeners.splice(0)) remove();
      if (dashReleaseTimer !== null) {
        windowRef.clearTimeout?.(dashReleaseTimer);
        dashReleaseTimer = null;
      }
      state.cancelAll();
      sync();
      overlay.remove();
    },
  });
}
