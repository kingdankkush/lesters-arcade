import test from 'node:test';
import assert from 'node:assert/strict';

import {
  browserFullscreenCapability,
  computeCombatViewportFit,
  snapViewportZoom,
} from '../apps/portal/src/hmh-viewport-fit.mjs';

test('viewport fit caps DPR, preserves CSS size, and computes the backing store', () => {
  const fit = computeCombatViewportFit({ cssWidth: 844, cssHeight: 390, devicePixelRatio: 3 });
  assert.deepEqual(fit.css, { width: 844, height: 390 });
  assert.deepEqual(fit.backingStore, { width: 1688, height: 780 });
  assert.equal(fit.renderDpr, 2);
  assert.equal(fit.orientation, 'landscape');
  assert.equal(fit.pixelArt.imageRendering, 'pixelated');
});

test('viewport fit subtracts notch safe areas and remains stable in portrait', () => {
  const fit = computeCombatViewportFit({
    cssWidth: 390,
    cssHeight: 844,
    devicePixelRatio: 2,
    safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
  });
  assert.deepEqual(fit.availableCss, { width: 390, height: 763 });
  assert.equal(fit.orientation, 'portrait');
  assert.equal(fit.worldZoom % 0.25, 0);
});

test('viewport zoom snaps to quarter steps and clamps extreme screens', () => {
  assert.equal(snapViewportZoom(1.13), 1.25);
  assert.equal(computeCombatViewportFit({ cssWidth: 320, cssHeight: 200 }).worldZoom, 0.75);
  assert.equal(computeCombatViewportFit({ cssWidth: 2560, cssHeight: 1440 }).worldZoom, 1.5);
});

test('fullscreen capability distinguishes browser API, PWA, and iOS fallback', () => {
  assert.deepEqual(browserFullscreenCapability({ hasRequestFullscreen: true }), {
    mode: 'browser-api', canEnter: true, showInstallTip: false,
  });
  assert.deepEqual(browserFullscreenCapability({ standalone: true, isIos: true }), {
    mode: 'standalone', canEnter: false, showInstallTip: false,
  });
  assert.deepEqual(browserFullscreenCapability({ isIos: true }), {
    mode: 'ios-visible-viewport', canEnter: false, showInstallTip: true,
  });
});
