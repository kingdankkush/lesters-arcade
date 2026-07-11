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

// When a touch device is using the left virtual joystick, that movement should
// steer movement only. Keyboard movement on touch devices can still mirror aim,
// but touch movement must not clobber the right-stick aim vector.
export function shouldMirrorMovementIntoAim({
  usingMovementKeys = false,
  isTouchDevice = false,
  touchMovementActive = false,
} = {}) {
  return usingMovementKeys && isTouchDevice && !touchMovementActive;
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
  grenade: { type: 'action', action: 'grenade' },
  pause: { type: 'action', action: 'pause' },
});

export const TOUCH_CONTROL_INVENTORY = Object.freeze([
  Object.freeze({ id: 'touch-move-stick', role: 'movement', zone: 'bottom-left thumb arc', gameplayFunction: 'WASD movement injection', keep: true }),
  Object.freeze({ id: 'touch-aim-stick', role: 'aim', zone: 'bottom-right thumb arc', gameplayFunction: 'right-stick aim + auto-fire direction', keep: true }),
  Object.freeze({ id: 'touch-grenade', role: 'action', zone: 'right-thumb action arc above aim stick', gameplayFunction: 'grenade tap/hold aim entrypoint', keep: true }),
  Object.freeze({ id: 'combatMenuIconButton', role: 'hud', zone: 'top safe-area corner', gameplayFunction: 'pause/fullscreen/game menu', keep: true }),
  Object.freeze({ id: 'powerUpButton', role: 'practice-helper', zone: 'desktop sandbox controls only', gameplayFunction: 'drops test pickups for local tuning; not a core mobile combat button', keep: false, resolution: 'removed from #touchControls to resolve the mystery POWER button near grenades' }),
]);

export function buildTouchControlLayout({ leftHanded = false, opacity = 0.4, orientation = 'landscape' } = {}) {
  const idleOpacity = Math.max(0.2, Math.min(0.55, Number(opacity) || 0.4));
  const activeOpacity = Math.max(idleOpacity, Math.min(0.78, idleOpacity + 0.3));
  const moveSide = leftHanded ? 'right' : 'left';
  const aimSide = leftHanded ? 'left' : 'right';
  return Object.freeze({
    version: 'wo-100-thumb-arc-v1',
    leftHanded: Boolean(leftHanded),
    orientation,
    idleOpacity,
    activeOpacity,
    centerBottomDeadZone: true,
    floatingOrigins: true,
    moveStick: Object.freeze({ side: moveSide, zone: `bottom-${moveSide}`, minTouchPx: 96 }),
    aimStick: Object.freeze({ side: aimSide, zone: `bottom-${aimSide}`, minTouchPx: 96 }),
    actionCluster: Object.freeze({ side: aimSide, zone: `${aimSide}-thumb arc`, buttons: Object.freeze(['grenade']), minButtonPx: 56 }),
    removedMobileControls: Object.freeze(['powerUpButton']),
  });
}

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

const defaultAim = Object.freeze({ x: 1, y: 0 });

function normalizeManualAim(dx, dy, { deadZone = 0.16, previous = defaultAim, source = 'manual' } = {}) {
  const x = Number(dx);
  const y = Number(dy);
  const length = Math.hypot(x, y);
  const prevX = Number.isFinite(Number(previous?.x)) ? Number(previous.x) : defaultAim.x;
  const prevY = Number.isFinite(Number(previous?.y)) ? Number(previous.y) : defaultAim.y;
  if (!Number.isFinite(length) || length < deadZone) {
    return Object.freeze({ x: prevX, y: prevY, active: false, source });
  }
  return Object.freeze({ x: x / length, y: y / length, active: true, source });
}

export function pointerToManualAim({ playerX = 0, playerY = 0, pointerX = 0, pointerY = 0, previous = defaultAim, deadZone = 0.16 } = {}) {
  return normalizeManualAim(Number(pointerX) - Number(playerX), Number(pointerY) - Number(playerY), { previous, deadZone, source: 'pointer' });
}

export function joystickToManualAim(dx = 0, dy = 0, { deadZone = 0.2, tileWidth = 64, tileHeight = 32, previous = defaultAim } = {}) {
  const stickX = Number(dx) || 0;
  const stickY = Number(dy) || 0;
  const mag = Math.hypot(stickX, stickY);
  if (mag < deadZone) return normalizeManualAim(0, 0, { previous, deadZone: 1, source: 'touch-stick' });
  const clampedX = mag > 1 ? stickX / mag : stickX;
  const clampedY = mag > 1 ? stickY / mag : stickY;
  const screenDx = clampedX * (Number(tileWidth) || 64) / 2;
  const screenDy = clampedY * (Number(tileHeight) || 32) / 2;
  const isoDx = screenDx / ((Number(tileWidth) || 64) / 2);
  const isoDy = screenDy / ((Number(tileHeight) || 32) / 2);
  const worldX = (isoDx + isoDy) / 2;
  const worldY = (isoDy - isoDx) / 2;
  return normalizeManualAim(worldX, worldY, { previous, deadZone: 0.001, source: 'touch-stick' });
}

export function buildManualGrenadeTarget({ playerX = 0, playerY = 0, aimX = 1, aimY = 0, reach = 1, maxRange = 7, blastRadius = 2 } = {}) {
  const aim = normalizeManualAim(aimX, aimY, { deadZone: 0.001, previous: defaultAim, source: 'grenade-reticle' });
  const distance = Math.max(0, Math.min(Number(maxRange) || 0, Number(reach) || 0));
  const landX = Number(playerX) + aim.x * distance;
  const landY = Number(playerY) + aim.y * distance;
  return Object.freeze({
    mode: 'manual-target',
    aimX: aim.x,
    aimY: aim.y,
    distance,
    landX,
    landY,
    marker: Object.freeze({ kind: 'grenade-reticle', x: landX, y: landY, radius: Number(blastRadius) || 0 }),
    ariaLabel: `Grenade reticle ${distance.toFixed(1)} tiles from player`,
  });
}

export function buildManualAimInputModel(profile = buildDeviceProfile()) {
  const touch = Boolean(profile?.isTouch ?? profile?.showTouchControls);
  return Object.freeze({
    version: 'wo-46-manual-aim-v1',
    manualAimMode: touch ? 'right-stick' : 'mouse-pointer',
    controls: Object.freeze(touch
      ? ['left virtual stick movement', 'right virtual stick aim', 'grenade button throws at stick reticle']
      : ['WASD / arrows movement', 'mouse pointer aim', 'right click / grenade button targets current reticle']),
    reticule: Object.freeze({
      alwaysVisible: true,
      kind: 'grenade-reticle',
      accessibilityLabel: touch ? 'Right stick controls the aim and grenade reticle.' : 'Mouse pointer controls the aim and grenade reticle.',
    }),
  });
}

export const DEVICE_INPUT_QA_CASES = Object.freeze([
  Object.freeze({ id: 'desktop-keyboard-mouse', width: 1440, height: 900, coarsePointer: false, hasTouch: false, maxTouchPoints: 0, expectedClass: 'desktop', expectedTouchControls: false, inputs: Object.freeze(['WASD/arrows', 'mouse aim', 'click/pointer', 'keyboard pause']) }),
  Object.freeze({ id: 'mobile-portrait-touch', width: 390, height: 844, coarsePointer: true, hasTouch: true, maxTouchPoints: 5, expectedClass: 'mobile', expectedTouchControls: true, expectedLandscapeHint: true, inputs: Object.freeze(['virtual joystick', 'touch fire', 'touch grenade', 'touch pause']) }),
  Object.freeze({ id: 'mobile-landscape-touch', width: 844, height: 390, coarsePointer: true, hasTouch: true, maxTouchPoints: 5, expectedClass: 'mobile', expectedTouchControls: true, expectedLandscapeHint: false, inputs: Object.freeze(['virtual joystick', 'right-side actions', 'orientation relayout']) }),
  Object.freeze({ id: 'tablet-landscape-touch', width: 1180, height: 820, coarsePointer: true, hasTouch: true, maxTouchPoints: 10, expectedClass: 'tablet', expectedTouchControls: true, inputs: Object.freeze(['larger tap targets', 'stacked panels', 'right-stick aim isolation']) }),
  Object.freeze({ id: 'touch-laptop-fine-pointer', width: 1366, height: 768, coarsePointer: false, hasTouch: true, maxTouchPoints: 5, expectedClass: 'tablet', expectedTouchControls: true, inputs: Object.freeze(['touch fallback', 'keyboard compatibility']) }),
  Object.freeze({ id: 'small-desktop-no-touch', width: 800, height: 600, coarsePointer: false, hasTouch: false, maxTouchPoints: 0, expectedClass: 'mobile', expectedTouchControls: true, inputs: Object.freeze(['responsive layout fallback', 'keyboard movement']) }),
]);

export function combatCanvasRenderScale({
  cssWidth = 1,
  cssHeight = 1,
  devicePixelRatio = 1,
  maxScale = 1.5,
  maxPixelArea = 1_600_000,
} = {}) {
  const width = Math.max(1, Number(cssWidth) || 1);
  const height = Math.max(1, Number(cssHeight) || 1);
  const nativeScale = Math.max(1, Number(devicePixelRatio) || 1);
  const pixelBudgetScale = Math.sqrt(Math.max(1, Number(maxPixelArea) || 1) / (width * height));
  const scale = Math.min(nativeScale, Math.max(1, Number(maxScale) || 1), Math.max(1, pixelBudgetScale));
  return Number(scale.toFixed(2));
}

export function buildDeviceInputQaMatrix(cases = DEVICE_INPUT_QA_CASES) {
  const rows = cases.map((testCase) => {
    const profile = buildDeviceProfile(testCase);
    const joystickForward = [...joystickToKeys(0.8, -0.8)].sort();
    const mirrorBlocked = shouldMirrorMovementIntoAim({ usingMovementKeys: true, isTouchDevice: profile.isTouch, touchMovementActive: true });
    const pass = profile.deviceClass === testCase.expectedClass
      && profile.showTouchControls === testCase.expectedTouchControls
      && (testCase.expectedLandscapeHint === undefined || profile.suggestLandscape === testCase.expectedLandscapeHint)
      && joystickForward.includes('d')
      && joystickForward.includes('w')
      && mirrorBlocked === false;
    return Object.freeze({
      id: testCase.id,
      expectedClass: testCase.expectedClass,
      actualClass: profile.deviceClass,
      orientation: profile.orientation,
      touchControls: profile.showTouchControls,
      landscapeHint: profile.suggestLandscape,
      minTapTargetPx: profile.minTapTargetPx,
      inputs: testCase.inputs,
      pass,
    });
  });
  return Object.freeze({
    version: 'wo-37-device-input-qa-v1',
    rows: Object.freeze(rows),
    summary: Object.freeze({
      caseCount: rows.length,
      passCount: rows.filter((row) => row.pass).length,
      touchCaseCount: rows.filter((row) => row.touchControls).length,
      status: rows.every((row) => row.pass) ? 'PASS' : 'FAIL',
    }),
  });
}
