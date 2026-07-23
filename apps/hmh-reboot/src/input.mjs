import { screenToGround } from './world-space.mjs';

const GAMEPLAY_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'Space', 'KeyE', 'KeyF', 'KeyG', 'ShiftLeft', 'ShiftRight', 'Escape',
]);

const ACTION_DEFAULTS = Object.freeze({ fire: false, melee: false, grenade: false, dash: false, pause: false });

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function timestamp(value) {
  finite(value, 'input timestamp');
  if (value < 0) throw new TypeError('input timestamp must be non-negative');
  return value;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function bool(value) {
  return value === true;
}

export function normalizeAxisPair(rawX, rawY, deadzone = 0) {
  const x = finite(rawX, 'axis x');
  const y = finite(rawY, 'axis y');
  finite(deadzone, 'axis deadzone');
  if (deadzone < 0 || deadzone >= 1) throw new TypeError('axis deadzone must be in [0, 1)');
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone || magnitude === 0) return { x: 0, y: 0 };
  const normalizedMagnitude = Math.min(1, (magnitude - deadzone) / (1 - deadzone));
  return {
    x: (x / magnitude) * normalizedMagnitude,
    y: (y / magnitude) * normalizedMagnitude,
  };
}

function normalizeDirection(x, y) {
  return normalizeAxisPair(x, y, 0);
}

function buttonPressed(buttons, index) {
  return buttons?.[index]?.pressed === true || Number(buttons?.[index]?.value ?? 0) > 0.5;
}

export function mapGamepadSnapshot(gamepad, { deadzone = 0.2 } = {}) {
  const axes = gamepad?.axes ?? [];
  const buttons = gamepad?.buttons ?? [];
  return freezeDeep({
    move: normalizeAxisPair(Number(axes[0] ?? 0), Number(axes[1] ?? 0), deadzone),
    aim: normalizeAxisPair(Number(axes[2] ?? 0), Number(axes[3] ?? 0), deadzone),
    actions: {
      fire: buttonPressed(buttons, 7),
      melee: buttonPressed(buttons, 2),
      grenade: buttonPressed(buttons, 4),
      dash: buttonPressed(buttons, 0),
      pause: buttonPressed(buttons, 9),
    },
  });
}

function keyboardMove(keys) {
  const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  return normalizeDirection(x, y);
}

function keyboardActions(keys) {
  return {
    fire: keys.has('Space'),
    melee: keys.has('KeyE'),
    grenade: keys.has('KeyF') || keys.has('KeyG'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    pause: keys.has('Escape'),
  };
}

function hasDirection(direction) {
  return direction.x !== 0 || direction.y !== 0;
}

function actionRecord(value = {}) {
  return {
    fire: bool(value.fire),
    melee: bool(value.melee),
    grenade: bool(value.grenade),
    dash: bool(value.dash),
    pause: bool(value.pause),
  };
}

export class InputState {
  constructor() {
    this.keys = new Set();
    this.keyboardAt = -1;
    this.pointer = null;
    this.pointerAt = -1;
    this.touch = null;
    this.touchAt = -1;
    this.gamepad = null;
    this.gamepadAt = -1;
    this.lastActiveDevice = 'none';
    this.lastInputAtMs = 0;
    this.resetReason = null;
    this.sequence = 0;
  }

  markDevice(device, atMs) {
    const at = timestamp(atMs);
    if (at >= this.lastInputAtMs) {
      this.lastActiveDevice = device;
      this.lastInputAtMs = at;
    }
    this.resetReason = null;
    return at;
  }

  setKey(code, down, atMs) {
    if (!GAMEPLAY_KEYS.has(code)) return false;
    const at = this.markDevice('keyboard-mouse', atMs);
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    this.keyboardAt = at;
    return true;
  }

  setPointer({ screenX, screenY, fire = false } = {}, atMs) {
    const at = this.markDevice('keyboard-mouse', atMs);
    this.pointer = {
      screenX: finite(screenX, 'pointer screenX'),
      screenY: finite(screenY, 'pointer screenY'),
      fire: bool(fire),
    };
    this.pointerAt = at;
  }

  setTouch(value = {}, atMs) {
    const at = this.markDevice('touch', atMs);
    this.touch = {
      move: normalizeDirection(Number(value.moveX ?? 0), Number(value.moveY ?? 0)),
      aim: normalizeDirection(Number(value.aimX ?? 0), Number(value.aimY ?? 0)),
      actions: actionRecord(value),
    };
    this.touchAt = at;
  }

  setGamepad(value = {}, atMs) {
    const at = this.markDevice('gamepad', atMs);
    this.gamepad = {
      move: normalizeDirection(Number(value.moveX ?? value.move?.x ?? 0), Number(value.moveY ?? value.move?.y ?? 0)),
      aim: normalizeDirection(Number(value.aimX ?? value.aim?.x ?? 0), Number(value.aimY ?? value.aim?.y ?? 0)),
      actions: actionRecord(value.actions ?? value),
    };
    this.gamepadAt = at;
  }

  reset(reason = 'reset', atMs = this.lastInputAtMs) {
    const at = timestamp(atMs);
    this.keys.clear();
    this.pointer = null;
    this.touch = null;
    this.gamepad = null;
    this.keyboardAt = -1;
    this.pointerAt = -1;
    this.touchAt = -1;
    this.gamepadAt = -1;
    this.lastActiveDevice = 'none';
    this.lastInputAtMs = at;
    this.resetReason = String(reason);
  }

  snapshot({ actor, camera, viewport, nowMs }) {
    const now = timestamp(nowMs);
    const movementCandidates = [];
    const keyboard = keyboardMove(this.keys);
    if (hasDirection(keyboard)) movementCandidates.push({ value: keyboard, at: this.keyboardAt });
    if (this.touch && hasDirection(this.touch.move)) movementCandidates.push({ value: this.touch.move, at: this.touchAt });
    if (this.gamepad && hasDirection(this.gamepad.move)) movementCandidates.push({ value: this.gamepad.move, at: this.gamepadAt });
    movementCandidates.sort((a, b) => b.at - a.at);
    const move = movementCandidates[0]?.value ?? { x: 0, y: 0 };

    const aimCandidates = [];
    if (this.pointer) {
      const target = screenToGround(
        { x: this.pointer.screenX, y: this.pointer.screenY },
        camera,
        viewport,
        { z: actor?.z ?? 0, visualLiftZ: actor?.visualLiftZ ?? 0 },
      );
      const direction = normalizeDirection(target.x - finite(actor?.x, 'actor.x'), target.y - finite(actor?.y, 'actor.y'));
      if (hasDirection(direction)) aimCandidates.push({ value: direction, at: this.pointerAt, mode: 'pointer' });
    }
    if (this.touch && hasDirection(this.touch.aim)) aimCandidates.push({ value: this.touch.aim, at: this.touchAt, mode: 'direction' });
    if (this.gamepad && hasDirection(this.gamepad.aim)) aimCandidates.push({ value: this.gamepad.aim, at: this.gamepadAt, mode: 'direction' });
    aimCandidates.sort((a, b) => b.at - a.at);
    const selectedAim = aimCandidates[0];
    const aim = selectedAim
      ? { x: selectedAim.value.x, y: selectedAim.value.y, active: true }
      : { x: 0, y: 0, active: false };

    const keyboardActionState = keyboardActions(this.keys);
    const sources = [keyboardActionState, this.pointer ? { ...ACTION_DEFAULTS, fire: this.pointer.fire } : ACTION_DEFAULTS, this.touch?.actions ?? ACTION_DEFAULTS, this.gamepad?.actions ?? ACTION_DEFAULTS];
    const actions = {
      move: { ...move },
      aim,
      aimAssist: selectedAim?.mode === 'direction',
      fire: sources.some((source) => source.fire),
      melee: sources.some((source) => source.melee),
      grenade: sources.some((source) => source.grenade),
      dash: sources.some((source) => source.dash),
      pause: sources.some((source) => source.pause),
    };
    this.sequence += 1;
    return freezeDeep({
      sequence: this.sequence,
      actions,
      metadata: {
        lastActiveDevice: this.lastActiveDevice,
        aimSource: selectedAim?.mode ?? 'none',
        lastInputAtMs: this.lastInputAtMs,
        sourceLatencyMs: Math.max(0, now - this.lastInputAtMs),
        resetReason: this.resetReason,
      },
    });
  }
}

export function computeTouchControlLayout({ width, height, safeInsets = {} }) {
  const viewportWidth = finite(width, 'touch viewport width');
  const viewportHeight = finite(height, 'touch viewport height');
  if (viewportWidth <= 0 || viewportHeight <= 0) throw new TypeError('touch viewport dimensions must be positive');
  const safe = {
    top: Math.max(0, finite(safeInsets.top ?? 0, 'safe top')),
    right: Math.max(0, finite(safeInsets.right ?? 0, 'safe right')),
    bottom: Math.max(0, finite(safeInsets.bottom ?? 0, 'safe bottom')),
    left: Math.max(0, finite(safeInsets.left ?? 0, 'safe left')),
  };
  const shortEdge = Math.min(viewportWidth, viewportHeight);
  const radius = Math.max(36, Math.min(64, shortEdge * 0.12));
  const margin = Math.max(12, radius * 0.35);
  const floorY = viewportHeight - safe.bottom - margin - radius;
  const moveStick = { x: safe.left + margin + radius, y: floorY, radius };
  const aimStick = { x: viewportWidth - safe.right - margin - radius, y: floorY, radius };
  const buttonRadius = Math.max(22, radius * 0.42);
  const buttonStep = buttonRadius * 2.25;
  const buttonBaseY = Math.max(safe.top + buttonRadius, aimStick.y - radius - margin - buttonRadius);
  const buttonBaseX = Math.min(viewportWidth - safe.right - buttonRadius, aimStick.x + radius * 0.55);
  const buttons = {
    fire: { x: buttonBaseX, y: buttonBaseY, radius: buttonRadius },
    melee: { x: Math.max(safe.left + buttonRadius, buttonBaseX - buttonStep), y: buttonBaseY, radius: buttonRadius },
    grenade: { x: buttonBaseX, y: Math.max(safe.top + buttonRadius, buttonBaseY - buttonStep), radius: buttonRadius },
    dash: { x: Math.max(safe.left + buttonRadius, buttonBaseX - buttonStep), y: Math.max(safe.top + buttonRadius, buttonBaseY - buttonStep), radius: buttonRadius },
    pause: { x: viewportWidth - safe.right - buttonRadius, y: safe.top + buttonRadius, radius: buttonRadius },
  };
  return freezeDeep({ viewport: { width: viewportWidth, height: viewportHeight }, safeInsets: safe, moveStick, aimStick, buttons });
}

export function createBrowserInputController({ input, target, windowRef = globalThis.window, documentRef = globalThis.document, now = () => performance.now() }) {
  if (!(input instanceof InputState)) throw new TypeError('input must be an InputState');
  for (const [name, value] of Object.entries({ target, windowRef, documentRef })) {
    if (!value?.addEventListener || !value?.removeEventListener) throw new TypeError(`${name} must be an EventTarget`);
  }
  const listeners = [];
  const listen = (source, type, callback, options) => {
    source.addEventListener(type, callback, options);
    listeners.push(() => source.removeEventListener(type, callback, options));
  };
  const key = (down) => (event) => {
    if (!GAMEPLAY_KEYS.has(event.code)) return;
    event.preventDefault?.();
    input.setKey(event.code, down, now());
  };
  listen(target, 'keydown', key(true));
  listen(target, 'keyup', key(false));
  listen(target, 'pointermove', (event) => input.setPointer({ screenX: event.clientX, screenY: event.clientY, fire: (event.buttons & 1) === 1 }, now()));
  listen(target, 'pointerdown', (event) => { event.preventDefault?.(); input.setPointer({ screenX: event.clientX, screenY: event.clientY, fire: event.button === 0 }, now()); });
  listen(target, 'pointerup', (event) => input.setPointer({ screenX: event.clientX, screenY: event.clientY, fire: false }, now()));
  listen(target, 'pointercancel', () => input.reset('pointer-cancel', now()));
  listen(target, 'touchcancel', (event) => { event.preventDefault?.(); input.reset('touch-cancel', now()); }, { passive: false });
  listen(target, 'contextmenu', (event) => event.preventDefault?.());
  listen(windowRef, 'blur', () => input.reset('blur', now()));
  listen(documentRef, 'visibilitychange', () => {
    if (documentRef.visibilityState === 'hidden') input.reset('visibility-hidden', now());
  });
  return Object.freeze({
    destroy() {
      for (const remove of listeners.splice(0)) remove();
      input.reset('controller-destroyed', now());
    },
  });
}
