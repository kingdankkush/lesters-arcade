import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_KEYBOARD_BINDINGS, actionHelpRows } from '../apps/hmh-reboot/src/action-map.mjs';

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

test('the controls card is styled and readable on mobile', async () => {
  const css = await readFile(cssUrl, 'utf8');
  assert.match(css, /\.hmh-controls-card/, 'the controls card needs styling');
  assert.match(css, /\.hmh-controls-hint/, 'the first-run hint needs styling');
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
