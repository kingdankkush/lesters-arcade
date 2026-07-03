import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEVICE_INPUT_QA_CASES,
  TOUCH_CONTROL_MAP,
  buildDeviceInputQaMatrix,
  joystickToKeys,
  shouldMirrorMovementIntoAim,
} from '../apps/portal/src/device-model.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-37 device and input QA matrix covers desktop, mobile, tablet, and edge viewports', () => {
  const matrix = buildDeviceInputQaMatrix();
  assert.equal(matrix.summary.status, 'PASS', JSON.stringify(matrix.rows, null, 2));
  assert.ok(matrix.summary.caseCount >= 6);
  assert.ok(matrix.rows.some((row) => row.id === 'desktop-keyboard-mouse' && row.touchControls === false));
  assert.ok(matrix.rows.some((row) => row.id === 'mobile-portrait-touch' && row.landscapeHint === true));
  assert.ok(matrix.rows.some((row) => row.id === 'tablet-landscape-touch' && row.actualClass === 'tablet'));
});

test('WO-37 touch control map exposes movement and combat actions', () => {
  for (const key of ['move-up', 'move-down', 'move-left', 'move-right', 'fire', 'jump', 'grenade', 'pause']) {
    assert.equal(Object.hasOwn(TOUCH_CONTROL_MAP, key), true, `${key} missing`);
  }
  assert.deepEqual([...joystickToKeys(0.8, -0.8)].sort(), ['d', 'w']);
  assert.equal(shouldMirrorMovementIntoAim({ usingMovementKeys: true, isTouchDevice: true, touchMovementActive: true }), false);
  assert.equal(shouldMirrorMovementIntoAim({ usingMovementKeys: true, isTouchDevice: true, touchMovementActive: false }), true);
});

test('WO-37 runtime still listens for orientation, fullscreen, pointer, touch, and keyboard paths', () => {
  const main = repoText('apps/portal/main.js');
  for (const marker of [
    "window.addEventListener('orientationchange'",
    "document.addEventListener('fullscreenchange'",
    "document.addEventListener('keydown'",
    "document.addEventListener('keyup'",
    'pointermove',
    'touchMovementActive',
    'joystickToKeys',
    'shouldMirrorMovementIntoAim',
  ]) {
    assert.equal(main.includes(marker), true, `${marker} missing`);
  }
});

test('WO-37 syntax gate includes device input QA report', () => {
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(packageJson.includes('design:device-input'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-device-input-qa.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-device-input-qa.test.mjs'), true);
});
