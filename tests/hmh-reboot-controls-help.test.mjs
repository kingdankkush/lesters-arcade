import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_KEYBOARD_BINDINGS, actionHelpRows } from '../apps/hmh-reboot/src/action-map.mjs';
import { TOUCH_CONTROL_SPEC } from '../apps/hmh-reboot/src/touch-controls.mjs';
import {
  CONTROLS_HINT_LIFETIME_MS,
  resolveControlsHint,
} from '../apps/hmh-reboot/src/cockpit-ui.mjs';

// The pause card and first-run hint describe the current simple controls.

const indexUrl = new URL('../apps/portal/hmh-reboot/index.html', import.meta.url);
const cssUrl = new URL('../apps/portal/hmh-reboot/styles.css', import.meta.url);
const cockpitUrl = new URL('../apps/hmh-reboot/src/cockpit-ui.mjs', import.meta.url);

test('the pause menu documents every bound gameplay action', async () => {
  const html = await readFile(indexUrl, 'utf8');
  const panel = html.slice(html.indexOf('hmhPausePanel'), html.indexOf('hmh-menu-actions'));
  assert.ok(panel.includes('hmhControlsTitle'), 'the pause menu needs a controls section');
  // Every available action must be discoverable in the controls card.
  for (const binding of ['WASD','F','Esc']) {
    assert.ok(panel.includes(binding), `controls card must document ${binding}`);
  }
  for (const label of ['Move','Aim','Grenade','Actions']) {
    assert.ok(panel.includes(label), `controls card must name the ${label} action`);
  }
  // Touch and mouse are real input paths too.
  assert.match(panel, /right.?click/i, 'right-click grenade must be documented');
  for(const control of ['MOVE','AIM','GRENADE'])assert.ok(panel.includes(control),`${control} must be documented`);
});

test('a first-run hint points players at the controls card', async () => {
  const html = await readFile(indexUrl, 'utf8');
  assert.ok(html.includes('hmhControlsHint'), 'a first-run hint element must exist');
  const cockpit = await readFile(cockpitUrl, 'utf8');
  assert.match(cockpit, /controlsHint/, 'the cockpit must own the hint element');
  // It must be dismissible and must not linger forever over gameplay.
  assert.match(cockpit, /dismissControlsHint|hideControlsHint/, 'the hint must be dismissible');
});

test('the first-run hint follows canonical touch mode and only names active touch controls', () => {
  const touch = resolveControlsHint({ touchUiEnabled: true });
  assert.equal(touch.mode, 'touch');
  for (const active of ['MOVE','AIM','GRENADE','pause']) {
    assert.match(touch.text, new RegExp(active, 'i'), `touch hint must name ${active}`);
  }
  assert.doesNotMatch(touch.text, /WASD|mouse|right.?click|\b1\s*[-\u2013]\s*4\b/i);
  assert.equal(touch.lifetimeMs, CONTROLS_HINT_LIFETIME_MS.touch);
  assert.ok(touch.lifetimeMs < CONTROLS_HINT_LIFETIME_MS.desktop);

  const desktop = resolveControlsHint({ touchUiEnabled: false });
  assert.equal(desktop.mode, 'desktop');
  assert.match(desktop.text, /WASD/i);
  assert.equal(desktop.lifetimeMs, CONTROLS_HINT_LIFETIME_MS.desktop);
});

test('the controls card is styled and readable on mobile', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.hmh-controls-card/, 'the controls card needs styling');
  assert.match(css, /\.hmh-controls-hint/, 'the first-run hint needs styling');
  assert.match(css, /\.hmh-controls-hint\[data-mode="touch"\]/, 'touch docking must follow the resolved hint mode');
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.hmh-controls-hint\[data-mode="touch"\][\s\S]*?top:/,
    'phone hint must dock below the compact cockpit instead of over the playfield centre');
});

test('the documented bindings match the real input map', async () => {
  const html = await readFile(indexUrl, 'utf8');
  const cockpit = await readFile(cockpitUrl, 'utf8');
  const documentedCodes = new Set(actionHelpRows(DEFAULT_KEYBOARD_BINDINGS).map((row) => row.keyboard));
  for (const code of ['KeyW','KeyA','KeyS','KeyD','KeyF','Escape']) {
    assert.ok(documentedCodes.has(code), `${code} must be a canonical documented gameplay key`);
  }
  assert.ok(html.includes('hmhControlsCard'));
  assert.match(cockpit, /actionHelpRows\(currentSettings\.keyboardBindings\)/);
});

test('canonical help names grenade and omits automatic combat actions',()=>{
  const help=Object.fromEntries(actionHelpRows().map(row=>[row.id,row.touch]));
  assert.equal(help.grenade,'GRENADE');
  for(const id of ['fire','melee','dash','weaponNext']) assert.equal(help[id],undefined);
  assert.deepEqual(TOUCH_CONTROL_SPEC.buttons.map(b=>b.action),['grenade','pause']);
});
