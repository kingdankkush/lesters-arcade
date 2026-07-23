import { computeTouchControlLayout } from './input.mjs';

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

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

const ACTIONS = new Set(['fire', 'melee', 'grenade', 'dash', 'pause']);

export class TouchControlState {
  constructor({ stickRadius = 72, deadZone = 0.12, sensitivity = 1 } = {}) {
    if (!(stickRadius > 0)) throw new TypeError('stickRadius must be positive');
    this.config = Object.freeze({ stickRadius, deadZone, sensitivity });
    this.pointers = new Map();
  }

  #assertAvailable(pointerId) {
    if (this.pointers.has(pointerId)) throw new TypeError('pointer is already assigned');
  }

  beginStick(pointerId, role, origin) {
    this.#assertAvailable(pointerId);
    if (role !== 'move' && role !== 'aim') throw new TypeError('stick role must be move or aim');
    const start = point(origin, 'origin');
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

  cancelAll() {
    this.pointers.clear();
  }

  snapshot() {
    let move = { x: 0, y: 0 };
    let aim = { x: 0, y: 0 };
    const actions = { fire: false, melee: false, grenade: false, dash: false, pause: false };
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

  const state = new TouchControlState({ stickRadius, deadZone, sensitivity });
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
  const sync = () => {
    const snapshot = state.snapshot();
    if (knobs.move) knobs.move.style.transform = `translate(${snapshot.moveX * 55}%, ${snapshot.moveY * 55}%)`;
    if (knobs.aim) knobs.aim.style.transform = `translate(${snapshot.aimX * 55}%, ${snapshot.aimY * 55}%)`;
    input.setTouch(snapshot, now());
  };
  const makeControl = (name, label, className) => {
    const element = documentRef.createElement('div');
    element.className = className;
    element.dataset.hmhControl = name;
    element.textContent = label;
    overlay.appendChild(element);
    elements[name] = element;
    return element;
  };

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
    listen(element, 'pointermove', (event) => {
      if (!state.movePointer(event.pointerId, { x: event.clientX, y: event.clientY })) return;
      own(event);
      sync();
    });
    const end = (event) => {
      if (!state.endPointer(event.pointerId)) return;
      own(event);
      sync();
    };
    listen(element, 'pointerup', end);
    listen(element, 'pointercancel', end);
    listen(element, 'lostpointercapture', end);
  }

  const labels = { fire: 'FIRE', melee: 'MELEE', grenade: 'GRENADE', dash: 'DASH', pause: 'II' };
  for (const action of Object.keys(labels)) {
    const element = makeControl(action, labels[action], `hmh-touch-button hmh-touch-button--${action}`);
    listen(element, 'pointerdown', (event) => {
      own(event);
      try { element.setPointerCapture?.(event.pointerId); } catch { /* synthetic or detached pointer */ }
      state.beginAction(event.pointerId, action);
      sync();
      if (action === 'pause') onPause?.();
    });
    const end = (event) => {
      if (!state.endPointer(event.pointerId)) return;
      own(event);
      sync();
    };
    listen(element, 'pointerup', end);
    listen(element, 'pointercancel', end);
    listen(element, 'lostpointercapture', end);
  }

  const endOwnedPointer = (event) => {
    if (!state.endPointer(event.pointerId)) return;
    own(event);
    sync();
  };
  listen(windowRef, 'pointerup', endOwnedPointer);
  listen(windowRef, 'pointercancel', endOwnedPointer);

  const applyLayout = () => {
    const safeInsets = typeof getSafeInsets === 'function'
      ? getSafeInsets()
      : readSafeAreaInsets(documentRef, windowRef);
    const width = Math.max(1, Number(windowRef.innerWidth) || Number(root.clientWidth) || Number(documentRef.documentElement?.clientWidth) || 1);
    const height = Math.max(1, Number(windowRef.innerHeight) || Number(root.clientHeight) || Number(documentRef.documentElement?.clientHeight) || 1);
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
      state.cancelAll();
      sync();
      overlay.remove();
    },
  });
}
