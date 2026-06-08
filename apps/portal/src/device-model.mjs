// Hard Money Heroes — device / responsive model (pure, testable logic).
//
// Classifies the visitor's device into 'mobile' | 'tablet' | 'desktop' from
// viewport + pointer + touch signals, and derives a UX profile the runtime/CSS
// use to adapt the arcade shell, menus, HUD, and controls. No DOM access here so
// it can be unit-tested in Node; the runtime passes in the signals it reads.

export const DEVICE_CLASSES = Object.freeze(['mobile', 'tablet', 'desktop']);

// Breakpoints (CSS px, shortest viewport side for orientation independence).
const MOBILE_MAX = 600;
const TABLET_MAX = 1024;

export function classifyDevice({
  width = 1280,
  height = 800,
  coarsePointer = false,
  hasTouch = false,
  maxTouchPoints = 0,
} = {}) {
  const shortSide = Math.min(width, height);
  const touchCapable = hasTouch || coarsePointer || maxTouchPoints > 0;

  // A fine pointer + large viewport is unambiguously desktop even with a
  // touchscreen (e.g. touch-enabled laptops should keep keyboard/mouse UX).
  if (!touchCapable && shortSide > TABLET_MAX) return 'desktop';
  if (!touchCapable) return shortSide <= MOBILE_MAX ? 'mobile' : 'desktop';

  if (shortSide <= MOBILE_MAX) return 'mobile';
  if (shortSide <= TABLET_MAX) return 'tablet';
  // Large touch device (e.g. big tablet / touch monitor) -> tablet UX.
  return 'tablet';
}

export function orientationOf({ width = 1280, height = 800 } = {}) {
  return width >= height ? 'landscape' : 'portrait';
}

// The UX profile the rest of the app consumes. One source of truth so CSS
// (via data-attributes) and JS (touch controls, layout) stay in sync.
export function buildDeviceProfile(signals = {}) {
  const deviceClass = classifyDevice(signals);
  const orientation = orientationOf(signals);
  const isTouch = deviceClass !== 'desktop';
  return Object.freeze({
    deviceClass,
    orientation,
    isTouch,
    // Show on-screen touch controls during gameplay for touch devices.
    showTouchControls: isTouch,
    // Mobile collapses the nav into a compact menu and stacks panels.
    compactNav: deviceClass === 'mobile',
    stackPanels: deviceClass !== 'desktop',
    // Mobile portrait gameplay benefits from a "rotate for best experience"
    // hint without blocking play.
    suggestLandscape: deviceClass === 'mobile' && orientation === 'portrait',
    // Larger hit targets on touch.
    minTapTargetPx: isTouch ? 44 : 0,
    // HUD scales up a touch on small screens for readability.
    hudScale: deviceClass === 'mobile' ? 1.15 : 1,
  });
}

// Map an on-screen control id to the keyboard key(s) it injects into the game's
// input set, so touch controls reuse the exact same gameplay code paths as the
// keyboard. Movement keys are held; action keys are momentary (handled by caller).
export const TOUCH_CONTROL_MAP = Object.freeze({
  'move-up': { type: 'hold', keys: ['w'] },
  'move-down': { type: 'hold', keys: ['s'] },
  'move-left': { type: 'hold', keys: ['a'] },
  'move-right': { type: 'hold', keys: ['d'] },
  fire: { type: 'action', action: 'shoot' },
  jump: { type: 'action', action: 'jump' },
  melee: { type: 'action', action: 'melee' },
  grenade: { type: 'action', action: 'grenade' },
  pause: { type: 'action', action: 'pause' },
});

// Convert a virtual-joystick vector (-1..1 each axis, screen space) into the
// set of movement keys to hold. Dead-zone avoids jitter. Returns a Set of keys.
export function joystickToKeys(dx, dy, deadZone = 0.3) {
  const keys = new Set();
  if (Math.hypot(dx, dy) < deadZone) return keys;
  if (dx <= -deadZone) keys.add('a');
  if (dx >= deadZone) keys.add('d');
  if (dy <= -deadZone) keys.add('w');
  if (dy >= deadZone) keys.add('s');
  return keys;
}
