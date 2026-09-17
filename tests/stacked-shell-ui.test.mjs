import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// ST-N02 shell guard (menu redesign 2026-09-16): the child JS and browser
// smokes address the overlay by id, the focus trap wraps on the last focusable
// control, the hero/tiles/settings structure holds its groups, 44 px targets
// and visible focus.
const read = relative => readFile(new URL(relative, import.meta.url), 'utf8');
const [html, css, main] = await Promise.all([read('../apps/portal/stacked/index.html'), read('../apps/portal/stacked/game.css'), read('../apps/stacked/src/main.mjs')]);

test('every element id the child runtime addresses exists exactly once in the shell', () => {
  const wanted = new Set([...main.matchAll(/\$\('([A-Za-z]+)'\)/g), ...main.matchAll(/\['(stat[A-Za-z]+)',/g)].map(match => match[1]));
  assert.ok(wanted.size >= 40);
  for (const id of ['sceneSelect', 'sceneNextButton', 'boardPulseToggle', 'settingsTile', 'scoresTile', 'freeModeTile', 'rankedModeTile', 'scoreShelf']) assert.ok(wanted.has(id), `the runtime wires #${id}`);
  for (const id of wanted) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1, `#${id} present once`);
  for (const id of ['resultScore', 'statLines', 'statLevel', 'statTime', 'statHalvings', 'statCombo']) assert.ok(wanted.has(id), `results grid fills #${id}`);
});

test('the sound effects toggle stays the last focusable control so the dialog focus trap wraps from it', () => {
  const overlay = html.slice(html.indexOf('id="gameOverlay"'));
  const controls = [...overlay.matchAll(/<(?:button|input|select|summary)\b[^>]*>/g)].map(match => match[0].match(/id="([A-Za-z]+)"/)?.[1]);
  assert.equal(controls.at(-1), 'soundToggle');
  assert.equal(controls[0], 'continueButton');
});

test('settings are grouped, results use a hero score with a stat grid, and the header and footer keep their labels', () => {
  const legends = [...html.matchAll(/<legend>([^<]+)<\/legend>/g)].map(match => match[1]);
  assert.deepEqual(legends, ['Gameplay', 'Visuals', 'Accessibility', 'Audio']);
  const group = name => html.slice(html.indexOf(`<legend>${name}</legend>`), html.indexOf('</fieldset>', html.indexOf(`<legend>${name}</legend>`)));
  for (const [name, ids] of [['Gameplay', ['ghostToggle', 'gridToggle', 'leftHandToggle']], ['Visuals', ['visualizerSelect', 'visualizerPreview', 'sceneSelect', 'sceneNextButton', 'intensityRange', 'effectsToggle', 'reactiveToggle', 'boardPulseToggle']], ['Accessibility', ['motionToggle', 'flashToggle', 'pieceMarksToggle']], ['Audio', ['volumeRange', 'soundToggle']]]) for (const id of ids) assert.match(group(name), new RegExp(`id="${id}"`), `${id} sits under ${name}`);
  assert.match(html, /<div id="resultStats" class="result-stats" hidden><p class="score-hero"><strong id="resultScore">/);
  const stats = html.slice(html.indexOf('id="resultStats"'), html.indexOf('id="resultCause"'));
  assert.equal((stats.match(/<dt>/g) ?? []).length, 5);
  assert.match(html, /<p id="resultCause" class="result-cause">/);
  assert.match(html, /<span id="modeLabel" class="mode-pill">/);
  assert.equal((html.match(/<kbd>/g) ?? []).length, 9);
  assert.match(html, /id="shareRow"/);
});

test('the menu has a hero with inline vector art, four big tiles and a device score shelf, in an order that keeps the trap anchors', () => {
  const overlay = html.slice(html.indexOf('id="gameOverlay"'));
  assert.match(overlay, /<svg class="hero-art" viewBox="0 0 160 120" aria-hidden="true" focusable="false">/);
  assert.ok((overlay.match(/<rect /g) ?? []).length >= 11, 'the hero stacks eleven blocks');
  assert.match(overlay, /<h2 id="overlayTitle">/);
  const tiles = [...overlay.matchAll(/<button id="([a-zA-Z]+Tile)" type="button" class="tile"/g)].map(match => match[1]);
  assert.deepEqual(tiles, ['freeModeTile', 'rankedModeTile', 'settingsTile', 'scoresTile']);
  for (const tile of tiles) assert.match(overlay, new RegExp(`id="${tile}"[^>]*>(?:<svg[^>]*aria-hidden="true">)`), `${tile} carries decorative vector art`);
  assert.match(overlay, /id="scoresTile"[^>]*aria-expanded="false" aria-controls="scoreShelf"/);
  assert.match(overlay, /<section id="scoreShelf" class="score-shelf"[^>]*hidden>/);
  for (const id of ['scoreBest', 'scoreRuns', 'scoreMedals']) assert.match(overlay, new RegExp(`id="${id}"`));
  // Order: primary actions, tiles, share, shelves, then the settings disclosure.
  const order = ['id="continueButton"', 'id="menuTiles"', 'id="shareRow"', 'id="freeMedalShelf"', 'id="scoreShelf"', 'id="preferencePanel"', 'id="soundToggle"'].map(needle => overlay.indexOf(needle));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(overlay, /<details id="preferencePanel" open><summary>/);
  assert.match(overlay, /<select id="sceneSelect"[^>]*>(?:<option value="(auto|tunnel|particles|horizon|off)">[^<]+<\/option>){5}<\/select>/);
  assert.match(overlay, /<input id="boardPulseToggle" type="checkbox" checked>/);
});

test('the stylesheet keeps 44 px targets, visible focus, a 320 px column and reduced-motion respect', () => {
  assert.match(css, /button\{[^}]*min-height:44px[^}]*min-width:44px/);
  assert.match(css, /select\{[^}]*min-height:44px/);
  assert.match(css, /\.panel summary\{[^}]*min-height:44px/);
  assert.match(css, /\.panel label\{min-height:44px\}/);
  assert.match(css, /\.range-control input\{[^}]*height:44px/);
  assert.match(css, /\.share-row \.share-button\{[^}]*min-height:44px/);
  assert.match(css, /button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible\{outline:3px solid/);
  assert.match(css, /@media \(max-width:360px\)\{[^}]*\.overlay\{padding:12px\}/);
  assert.match(css, /\.stat-grid\{display:grid;grid-template-columns:repeat\(5,1fr\)/);
  assert.match(css, /\.stat-grid\{grid-template-columns:1fr 1fr\}\.stat-grid div:last-child\{grid-column:1\/-1\}/);
  assert.match(css, /#visualPreferences\{grid-template-columns:1fr\}/);
  assert.match(css, /\.menu-tiles\{display:grid;grid-template-columns:repeat\(4,1fr\)/);
  assert.match(css, /\.menu-tiles\{grid-template-columns:1fr 1fr\}/, 'tiles fall to two columns on phones');
  assert.match(css, /\.tile\{[^}]*min-height:82px/);
  assert.match(css, /\.tile\[aria-current=true\]/);
  assert.match(css, /\.hero\{display:grid;grid-template-columns:128px minmax\(0,1fr\)/);
  assert.match(css, /@media \(max-width:360px\)\{[^@]*\.hero\{grid-template-columns:64px minmax\(0,1fr\)/);
  assert.match(css, /\.pref-visuals\{grid-column:1\/-1\}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /white-space:pre-line/, 'the old text-only result block is gone');
});
