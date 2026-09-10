import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { computeTouchControlLayout } from '../apps/hmh-reboot/src/input.mjs';
import {
  TouchControlState,
} from '../apps/hmh-reboot/src/touch-controls.mjs';

/**
 * Device playtest, 2026-07-27:
 *   "Controls on mobile need to be simplified to just movement, aim, and power
 *    ... When I tried playing on my phone, the movement controls didn't even
 *    work."
 *
 * Two separate defects are covered here: the layout placed controls in the
 * layout viewport (which on a phone extends behind the browser URL bar), and
 * the control set was too dense for a phone screen. Cycle 036 restores one
 * bounded SWAP action because the four-control version made three retained
 * weapons unreachable on touch-only devices.
 */

const PHONE = { width: 390, height: 844 };

test('the compact mobile layout exposes movement, aim, grenade and pause', () => {
  const layout = computeTouchControlLayout(PHONE);
  assert.ok(layout.moveStick, 'movement stick is required');
  assert.ok(layout.aimStick, 'aim stick is required');
  const buttons = Object.keys(layout.buttons).sort();
  assert.deepEqual(buttons, ['pause', 'power'], 'only grenade and pause are buttons');
});

test('every control sits fully inside the visible viewport', () => {
  for (const viewport of [PHONE, { width: 844, height: 390 }, { width: 360, height: 640 }]) {
    const layout = computeTouchControlLayout(viewport);
    const controls = [
      ['moveStick', layout.moveStick],
      ['aimStick', layout.aimStick],
      ...Object.entries(layout.buttons),
    ];
    for (const [name, control] of controls) {
      assert.ok(control.x - control.radius >= 0, `${name} overflows the left edge at ${viewport.width}x${viewport.height}`);
      assert.ok(control.y - control.radius >= 0, `${name} overflows the top edge at ${viewport.width}x${viewport.height}`);
      assert.ok(control.x + control.radius <= viewport.width, `${name} overflows the right edge at ${viewport.width}x${viewport.height}`);
      assert.ok(control.y + control.radius <= viewport.height, `${name} overflows the bottom edge at ${viewport.width}x${viewport.height}`);
    }
  }
});

test('safe-area insets keep controls clear of browser and notch chrome', () => {
  // A phone URL bar is reported through the inset, not by shrinking width.
  const layout = computeTouchControlLayout({ ...PHONE, safeInsets: { top: 48, bottom: 96, left: 12, right: 12 } });
  assert.ok(layout.moveStick.y + layout.moveStick.radius <= PHONE.height - 96,
    'the movement stick must sit above the bottom inset, not under the browser bar');
  assert.ok(layout.moveStick.x - layout.moveStick.radius >= 12);
  assert.ok(layout.aimStick.x + layout.aimStick.radius <= PHONE.width - 12);
  assert.ok(layout.buttons.pause.y - layout.buttons.pause.radius >= 48);
});

test('the sticks are far enough apart and large enough for thumbs', () => {
  const layout = computeTouchControlLayout(PHONE);
  const gap = (layout.aimStick.x - layout.aimStick.radius) - (layout.moveStick.x + layout.moveStick.radius);
  assert.ok(gap > 40, `sticks are only ${Math.round(gap)}px apart`);
  // Apple and Android both recommend a ~44px minimum touch target.
  for (const [name, control] of [['move', layout.moveStick], ['aim', layout.aimStick], ...Object.entries(layout.buttons)]) {
    assert.ok(control.radius * 2 >= 44, `${name} target is ${Math.round(control.radius * 2)}px, below the 44px minimum`);
  }
});

test('the touch layout measures the visual viewport, not the layout viewport', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/touch-controls.mjs', import.meta.url), 'utf8');
  // window.innerHeight on a phone includes the strip behind the URL bar, so
  // controls anchored to it render below the visible area and cannot be
  // touched — which is exactly what the device playtest hit.
  assert.match(source, /Number\(visual\?\.width\)/, 'width must come from the visual viewport first');
  assert.match(source, /Number\(visual\?\.height\)/, 'height must come from the visual viewport first');
  // It must also relayout when that viewport changes, or the controls stay
  // where they were laid out as the browser chrome collapses.
  assert.match(source, /visualViewport,\s*'resize'/, 'must relayout on visual viewport resize');
  assert.match(source, /visualViewport,\s*'scroll'/, 'must relayout on visual viewport scroll');
});

test('stick dragging survives a thumb leaving the control, without pointer capture', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/touch-controls.mjs', import.meta.url), 'utf8');
  // Binding pointermove to the small stick element means a thumb dragged
  // beyond its radius stops delivering events wherever setPointerCapture is
  // unavailable. Tracking on the shared surface is what makes a virtual
  // joystick behave like a joystick.
  assert.match(source, /surfaceListen|listen\(\s*(windowRef|overlay)\s*,\s*'pointermove'/,
    'pointermove must be tracked on a surface that spans the screen');
});

test('repeated movement taps only steer and never manually activate a dodge',()=>{
  const state=new TouchControlState({stickRadius:60});
  for(let i=0;i<8;i++) {
    state.beginStick(i,'move',{x:100,y:300});state.movePointer(i,{x:160,y:300});
    assert.equal(state.snapshot().moveX,1);assert.equal(state.snapshot().dash,false);state.endPointer(i);
  }
});
test('double-tapping the AIM stick never dashes', () => {
  let clock = 0;
  const state = new TouchControlState({ stickRadius: 60, now: () => clock });
  state.beginStick(1, 'aim', { x: 500, y: 300 });
  state.endPointer(1);
  clock += 100;
  state.beginStick(2, 'aim', { x: 500, y: 300 });
  assert.equal(state.snapshot().dash, false, 'aim taps only control aim');
});

test('the real-browser smoke rejects keyboard copy and verifies the touch hint exclusion band', async () => {
  const source = await readFile(new URL('../scripts/hmh-reboot-mobile-controls-browser-smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /hmhControlsHint/);
  assert.match(source, /WASD\|mouse\|right\.\?click/i, 'smoke must reject desktop-only touch copy');
  assert.match(source, /hmhHud/);
  assert.match(source, /hint.*stick|stick.*hint/is, 'smoke must compare the hint with the touch-control band');
  assert.match(source, /viewport.*(?:centre|center)|(?:centre|center).*viewport/is, 'smoke must keep the hint out of the hero-centre band');
});
