import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_KEYBOARD_BINDINGS, actionHelpRows } from '../apps/hmh-reboot/src/action-map.mjs';
import {
  CONTROLS_HINT_LIFETIME_MS,
  resolveControlsHint,
} from '../apps/hmh-reboot/src/cockpit-ui.mjs';

/**
 * Upgrade program M1. Desktop weapon slots (Digit1-4) and several other
 * bindings existed but were undiscoverable — the owner never found them,
 * which is what turned the exhausted-shotgun bug into a fatal one. The pause
 * menu now documents the full action map, and a first-run hint points at it.
 */

const indexUrl = new URL('../apps/portal/hmh-reboot/index.html', import.meta.url);
const cssUrl = new URL('../apps/portal/hmh-reboot/styles.css', import.meta.url);
const cockpitUrl = new URL('../apps/hmh-reboot/src/cockpit-ui.mjs', import.meta.url);

test('the pause menu documents every bound gameplay action', async () => {
  const html = await readFile(indexUrl, 'utf8');
  const panel = html.slice(html.indexOf('hmhPausePanel'), html.indexOf('hmh-menu-actions'));
  assert.ok(panel.includes('hmhControlsTitle'), 'the pause menu needs a controls section');
  // Every binding a player can use must be named. Digit1-4 is the one that
  // actually cost a run.
  for (const binding of ['WASD', 'Space', 'Shift', 'Esc', '1', '4']) {
    assert.ok(panel.includes(binding), `controls card must document ${binding}`);
  }
  for (const label of ['Move', 'Fire', 'Dash', 'Grenade', 'Melee', 'Weapon']) {
    assert.ok(panel.includes(label), `controls card must name the ${label} action`);
  }
  // Touch and mouse are real input paths too.
  assert.match(panel, /right.?click/i, 'right-click grenade must be documented');
  assert.match(panel, /MOVE|AIM|SWAP|POWER/, 'touch controls must be documented');
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
  for (const active of ['MOVE', 'AIM', 'SWAP', 'POWER', 'double-tap MOVE', 'pause']) {
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
  for (const code of ['KeyW', 'Space', 'KeyE', 'KeyF', 'ShiftLeft', 'Escape', 'Digit1', 'Digit4']) {
    assert.ok(documentedCodes.has(code), `${code} must be a canonical documented gameplay key`);
  }
  assert.ok(html.includes('hmhControlsCard'));
  assert.match(cockpit, /actionHelpRows\(currentSettings\.keyboardBindings\)/);
});

test('canonical help names touch gestures and never invents a melee button', () => {
  const help = Object.fromEntries(actionHelpRows(DEFAULT_KEYBOARD_BINDINGS).map((row) => [row.id, row.touch]));
  assert.equal(help.fire, 'AIM stick / auto-fire');
  assert.equal(help.melee, '');
  assert.equal(help.grenade, 'POWER');
  assert.equal(help.dash, 'Double-tap MOVE');
  assert.equal(help.pause, 'Pause button');
  assert.equal(help.weaponNext, 'SWAP');
});

test('the one-shot stick cue uses compositor-only motion and disables movement for reduced motion', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /data-hmh-touch-onboarding="once"[\s\S]*animation:\s*hmh-touch-onboarding-pulse[^;]*\s1\sboth/);
  assert.match(css, /@keyframes hmh-touch-onboarding-pulse[\s\S]*transform:[\s\S]*opacity:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*data-hmh-touch-onboarding="once"[\s\S]*animation:\s*none\s*!important;[\s\S]*transform:\s*none;/);
});
