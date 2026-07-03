import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  classifyDevice,
  orientationOf,
  buildDeviceProfile,
  joystickToKeys,
  joystickToManualAim,
  pointerToManualAim,
  buildManualGrenadeTarget,
  buildManualAimInputModel,
  TOUCH_CONTROL_MAP,
  shouldMirrorMovementIntoAim,
} from '../apps/portal/src/device-model.mjs';

test('classifyDevice: phone-sized touch viewport => mobile', () => {
  assert.equal(classifyDevice({ width: 390, height: 844, hasTouch: true, coarsePointer: true, maxTouchPoints: 5 }), 'mobile');
});

test('classifyDevice: tablet-sized touch viewport => tablet', () => {
  assert.equal(classifyDevice({ width: 820, height: 1180, hasTouch: true, coarsePointer: true, maxTouchPoints: 5 }), 'tablet');
});

test('classifyDevice: large fine-pointer viewport => desktop', () => {
  assert.equal(classifyDevice({ width: 1920, height: 1080, hasTouch: false, coarsePointer: false }), 'desktop');
});

test('classifyDevice: touch laptop with fine pointer stays desktop', () => {
  // No coarse pointer, no touch flag, big screen => desktop UX even if hybrid.
  assert.equal(classifyDevice({ width: 1536, height: 960, hasTouch: false, coarsePointer: false }), 'desktop');
});

test('classifyDevice: small non-touch window => mobile layout', () => {
  assert.equal(classifyDevice({ width: 500, height: 700, hasTouch: false }), 'mobile');
});

test('orientationOf detects portrait and landscape', () => {
  assert.equal(orientationOf({ width: 390, height: 844 }), 'portrait');
  assert.equal(orientationOf({ width: 844, height: 390 }), 'landscape');
});

test('buildDeviceProfile: mobile portrait suggests landscape and shows touch controls', () => {
  const p = buildDeviceProfile({ width: 390, height: 844, hasTouch: true, coarsePointer: true, maxTouchPoints: 5 });
  assert.equal(p.deviceClass, 'mobile');
  assert.equal(p.isTouch, true);
  assert.equal(p.showTouchControls, true);
  assert.equal(p.compactNav, true);
  assert.equal(p.suggestLandscape, true);
  assert.ok(p.minTapTargetPx >= 44);
});

test('buildDeviceProfile: desktop has no touch controls and full nav', () => {
  const p = buildDeviceProfile({ width: 1920, height: 1080 });
  assert.equal(p.deviceClass, 'desktop');
  assert.equal(p.showTouchControls, false);
  assert.equal(p.compactNav, false);
  assert.equal(p.stackPanels, false);
});

test('buildDeviceProfile: tablet stacks panels but keeps full nav', () => {
  const p = buildDeviceProfile({ width: 820, height: 1180, hasTouch: true, coarsePointer: true, maxTouchPoints: 5 });
  assert.equal(p.deviceClass, 'tablet');
  assert.equal(p.stackPanels, true);
  assert.equal(p.compactNav, false);
});

test('joystickToKeys respects dead-zone and maps directions', () => {
  assert.equal(joystickToKeys(0, 0).size, 0); // centered => no keys
  assert.equal(joystickToKeys(0.1, 0.1).size, 0); // inside dead-zone
  assert.deepEqual([...joystickToKeys(1, 0)], ['d']);
  assert.deepEqual([...joystickToKeys(-1, 0)], ['a']);
  assert.deepEqual([...joystickToKeys(0, -1)], ['w']);
  const diag = joystickToKeys(0.8, 0.8);
  assert.ok(diag.has('d') && diag.has('s'));
});

test('shouldMirrorMovementIntoAim only mirrors keyboard movement on touch devices', () => {
  assert.equal(shouldMirrorMovementIntoAim({ usingMovementKeys: true, isTouchDevice: false, touchMovementActive: false }), false);
  assert.equal(shouldMirrorMovementIntoAim({ usingMovementKeys: true, isTouchDevice: true, touchMovementActive: false }), true);
  assert.equal(shouldMirrorMovementIntoAim({ usingMovementKeys: true, isTouchDevice: true, touchMovementActive: true }), false);
  assert.equal(shouldMirrorMovementIntoAim({ usingMovementKeys: false, isTouchDevice: true, touchMovementActive: false }), false);
});

test('TOUCH_CONTROL_MAP covers movement and core actions', () => {
  for (const id of ['move-up', 'move-down', 'move-left', 'move-right', 'fire', 'jump', 'grenade', 'pause']) {
    assert.ok(TOUCH_CONTROL_MAP[id], `missing touch control ${id}`);
  }
  assert.equal(TOUCH_CONTROL_MAP.melee, undefined); // melee removed from simplified controls
  assert.equal(TOUCH_CONTROL_MAP['move-left'].type, 'hold');
  assert.equal(TOUCH_CONTROL_MAP.fire.type, 'action');
});

test('WO-46 pointerToManualAim normalizes desktop pointer aim without movement drift', () => {
  const aim = pointerToManualAim({ playerX: 4, playerY: -2, pointerX: 7, pointerY: 2, previous: { x: 1, y: 0 } });
  assert.equal(aim.active, true);
  assert.equal(aim.source, 'pointer');
  assert.ok(Math.abs(aim.x - 0.6) < 0.001);
  assert.ok(Math.abs(aim.y - 0.8) < 0.001);

  const dead = pointerToManualAim({ playerX: 4, playerY: -2, pointerX: 4.01, pointerY: -2.01, previous: { x: -1, y: 0 } });
  assert.equal(dead.active, false);
  assert.equal(dead.x, -1);
  assert.equal(dead.y, 0);
});

test('WO-46 joystickToManualAim maps touch right-stick screen input into isometric aim', () => {
  const right = joystickToManualAim(1, 0, { tileWidth: 64, tileHeight: 32, previous: { x: 0, y: 1 } });
  assert.equal(right.active, true);
  assert.equal(right.source, 'touch-stick');
  assert.ok(right.x > 0.7, `expected right-stick to aim positive world x, got ${right.x}`);
  assert.ok(right.y < -0.7, `expected right-stick to aim negative world y, got ${right.y}`);

  const centered = joystickToManualAim(0.04, 0.03, { previous: { x: 0, y: -1 } });
  assert.equal(centered.active, false);
  assert.deepEqual({ x: centered.x, y: centered.y }, { x: 0, y: -1 });
});

test('WO-46 buildManualGrenadeTarget previews targeted grenades across pointer and stick aim', () => {
  const target = buildManualGrenadeTarget({ playerX: 10, playerY: 10, aimX: 1, aimY: 0, reach: 99, maxRange: 7, blastRadius: 2.5 });
  assert.equal(target.mode, 'manual-target');
  assert.equal(target.landX, 17);
  assert.equal(target.landY, 10);
  assert.equal(target.marker.kind, 'grenade-reticle');
  assert.equal(target.marker.radius, 2.5);
  assert.ok(target.ariaLabel.includes('7.0 tiles'));
});

test('WO-46 manual aim input model documents desktop and mobile controls', () => {
  const desktop = buildManualAimInputModel(buildDeviceProfile({ width: 1440, height: 900 }));
  assert.equal(desktop.manualAimMode, 'mouse-pointer');
  assert.ok(desktop.controls.includes('mouse pointer aim'));
  assert.ok(desktop.controls.includes('right click / grenade button targets current reticle'));

  const mobile = buildManualAimInputModel(buildDeviceProfile({ width: 844, height: 390, hasTouch: true, coarsePointer: true, maxTouchPoints: 5 }));
  assert.equal(mobile.manualAimMode, 'right-stick');
  assert.ok(mobile.controls.includes('right virtual stick aim'));
  assert.ok(mobile.controls.includes('grenade button throws at stick reticle'));
  assert.equal(mobile.reticule.alwaysVisible, true);
});

test('WO-46 runtime wires manual aim helpers into pointer, touch, and grenade paths', () => {
  const source = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(source, /pointerToManualAim/);
  assert.match(source, /joystickToManualAim/);
  assert.match(source, /buildManualGrenadeTarget/);
  assert.match(source, /combat\.manualAim/);
  assert.match(source, /grenade-reticle/);
});
