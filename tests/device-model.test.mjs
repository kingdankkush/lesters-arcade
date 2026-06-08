import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyDevice,
  orientationOf,
  buildDeviceProfile,
  joystickToKeys,
  TOUCH_CONTROL_MAP,
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

test('TOUCH_CONTROL_MAP covers movement and core actions', () => {
  for (const id of ['move-up', 'move-down', 'move-left', 'move-right', 'fire', 'jump', 'melee', 'grenade', 'pause']) {
    assert.ok(TOUCH_CONTROL_MAP[id], `missing touch control ${id}`);
  }
  assert.equal(TOUCH_CONTROL_MAP['move-left'].type, 'hold');
  assert.equal(TOUCH_CONTROL_MAP.fire.type, 'action');
});
