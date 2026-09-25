import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// ST-N02 shell guard (menu redesign 2026-09-16, settings simplification
// 2026-09-24): the child JS and browser smokes address the overlay by id, the
// focus trap wraps on the last focusable control, the hero/tiles/settings
// structure holds its groups, 44 px targets and visible focus.
const read = relative => readFile(new URL(relative, import.meta.url), 'utf8');
const [html, css, main] = await Promise.all([read('../apps/portal/stacked/index.html'), read('../apps/portal/stacked/game.css'), read('../apps/stacked/src/main.mjs')]);
const REMOVED = ['sceneSelect', 'sceneNextButton', 'boardPulseToggle', 'boardPulseNote', 'intensityRange', 'intensityValue', 'effectsToggle', 'reactiveToggle', 'soundToggle', 'sceneHint'];

test('every element id the child runtime addresses exists exactly once in the shell', () => {
  const wanted = new Set([...main.matchAll(/\$\('([A-Za-z]+)'\)/g), ...main.matchAll(/\['(stat[A-Za-z]+)',/g)].map(match => match[1]));
  assert.ok(wanted.size >= 40);
  for (const id of ['effectsOff', 'effectsCalm', 'effectsStandard', 'effectsFull', 'effectsHint', 'settingsSaveNote', 'settingsTile', 'preferencePanel', 'volumeRange', 'volumeValue', 'scoresTile', 'freeModeTile', 'rankedModeTile', 'scoreShelf']) assert.ok(wanted.has(id), `the runtime wires #${id}`);
  for (const id of wanted) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1, `#${id} present once`);
  for (const id of ['resultScore', 'statLines', 'statLevel', 'statTime', 'statHalvings', 'statCombo']) assert.ok(wanted.has(id), `results grid fills #${id}`);
});

test('the retired settings controls are gone from the shell and the runtime', () => {
  for (const id of REMOVED) {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), `#${id} left the shell`);
    assert.doesNotMatch(main, new RegExp(`'${id}'`), `the runtime no longer addresses #${id}`);
  }
  assert.doesNotMatch(html, /mobile-effects-note|desktop-reactive|scene-picker/);
  assert.doesNotMatch(main, /stacked-visual-scenes-v1|localStorage\.setItem/, 'the child keeps no settings of its own');
});

test('the game sounds slider stays the last focusable control so the dialog focus trap wraps from it', () => {
  const overlay = html.slice(html.indexOf('id="gameOverlay"'));
  const controls = [...overlay.matchAll(/<(?:button|input|select|summary)\b[^>]*>/g)].map(match => match[0].match(/id="([A-Za-z]+)"/)?.[1]);
  assert.equal(controls.at(-1), 'volumeRange');
  assert.equal(controls[0], 'continueButton');
});

test('settings are four groups on one card, results use a hero score with a stat grid, and the header and footer keep their labels', () => {
  const legends = [...html.matchAll(/<legend>([^<]+)<\/legend>/g)].map(match => match[1]);
  assert.deepEqual(legends, ['Effects', 'Play', 'Accessibility', 'Sound']);
  const group = name => html.slice(html.indexOf(`<legend>${name}</legend>`), html.indexOf('</fieldset>', html.indexOf(`<legend>${name}</legend>`)));
  for (const [name, ids] of [['Effects', ['effectsOff', 'effectsCalm', 'effectsStandard', 'effectsFull', 'effectsHint', 'visualizerSelect', 'visualizerPreview', 'visualizerHint']], ['Play', ['ghostToggle', 'gridToggle', 'leftHandToggle']], ['Accessibility', ['motionToggle', 'flashToggle', 'pieceMarksToggle']], ['Sound', ['volumeRange', 'volumeValue', 'soundNote']]]) for (const id of ids) assert.match(group(name), new RegExp(`id="${id}"`), `${id} sits under ${name}`);
  const controls = [...html.slice(html.indexOf('id="visualPreferences"')).matchAll(/<(?:input|select)\b[^>]*id="([A-Za-z]+)"/g)].map(match => match[1]);
  assert.deepEqual(controls, ['effectsOff', 'effectsCalm', 'effectsStandard', 'effectsFull', 'visualizerSelect', 'ghostToggle', 'gridToggle', 'leftHandToggle', 'motionToggle', 'flashToggle', 'pieceMarksToggle', 'volumeRange'], 'nine settings in DOM (focus) order');
  assert.match(group('Play'), /<label class="mobile-hand-option"><input id="leftHandToggle" type="checkbox">/, 'left-handed buttons show on touch screens only');
  assert.match(html, /<div id="resultStats" class="result-stats" hidden><p class="score-hero"><strong id="resultScore">/);
  const stats = html.slice(html.indexOf('id="resultStats"'), html.indexOf('id="resultCause"'));
  assert.equal((stats.match(/<dt>/g) ?? []).length, 5);
  assert.match(html, /<p id="resultCause" class="result-cause">/);
  assert.match(html, /<span id="modeLabel" class="mode-pill">/);
  assert.equal((html.match(/<kbd>/g) ?? []).length, 9);
  assert.match(html, /id="shareRow"/);
});

test('the effects preset is a labelled four-way radio group with Standard checked by default', () => {
  const radios = [...html.matchAll(/<input id="(effects[A-Za-z]+)" type="radio" name="effectsPreset" value="([a-z]+)"( checked)?>/g)].map(match => [match[1], match[2], !!match[3]]);
  assert.deepEqual(radios, [['effectsOff', 'off', false], ['effectsCalm', 'calm', false], ['effectsStandard', 'standard', true], ['effectsFull', 'full', false]]);
  assert.equal((html.match(/name="effectsPreset"/g) ?? []).length, 4);
  assert.match(html, /<div class="segmented" role="radiogroup" aria-labelledby="effectsLabel" aria-describedby="effectsHint">/);
  assert.match(html, /<span id="effectsLabel" class="pref-label">Visual effects<\/span>/);
  for (const label of ['Off', 'Calm', 'Standard', 'Full']) assert.match(html, new RegExp(`<label class="segment"><input [^>]*><span>${label}</span></label>`));
  assert.match(html, /<input id="flashToggle" type="checkbox" checked>/, 'reduced flashes stays on by default');
  assert.match(html, /<input id="motionToggle" type="checkbox">/);
  assert.match(html, /<input id="volumeRange" type="range" min="0" max="100" step="5" value="35" aria-describedby="soundNote">/);
  assert.match(html, /<p id="settingsSaveNote" class="fine-print">[^<]*allowed in Ranked[^<]*<\/p>/, 'the fine print says every setting is allowed in Ranked');
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
  assert.match(overlay, /id="settingsTile" type="button" class="tile" aria-expanded="false" aria-controls="preferencePanel"/);
  assert.match(overlay, /<span class="tile-label">Settings<\/span><span class="tile-hint">Effects, access, sound<\/span>/);
  assert.match(overlay, /<section id="scoreShelf" class="score-shelf"[^>]*hidden>/);
  for (const id of ['scoreBest', 'scoreRuns', 'scoreMedals']) assert.match(overlay, new RegExp(`id="${id}"`));
  // Order: primary actions, tiles, share, shelves, then the settings disclosure.
  const order = ['id="continueButton"', 'id="menuTiles"', 'id="shareRow"', 'id="freeMedalShelf"', 'id="scoreShelf"', 'id="preferencePanel"', 'id="volumeRange"', 'id="settingsSaveNote"'].map(needle => overlay.indexOf(needle));
  assert.ok(order.every(index => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(overlay, /<details id="preferencePanel"><summary><span>Settings<\/span><span class="summary-hint">Effects · Play · Accessibility · Sound<\/span><\/summary>/, 'the settings card starts closed');
});

test('the runtime toggles the settings card from its tile, reports only failed saves and navigates the card by gamepad', () => {
  assert.match(main, /\$\('preferencePanel'\)\.addEventListener\('toggle', mirrorSettingsTile\)/, 'the tile mirrors the card state in aria-expanded, including summary clicks');
  assert.match(main, /const mirrorSettingsTile = \(\) => \$\('settingsTile'\)\.setAttribute\('aria-expanded', String\(\$\('preferencePanel'\)\.open\)\);/);
  // The details toggle event is queued, not synchronous: code that opens or closes the card itself
  // updates the tile in the same task (the reactive smoke at 390 px read a stale 'false' otherwise).
  assert.match(main, /panel\.open = !panel\.open;\s*mirrorSettingsTile\(\);/, 'the tile click updates aria-expanded in the same task');
  assert.match(main, /\$\('preferencePanel'\)\.open = false; mirrorSettingsTile\(\);/, 'the results screen closes the card and the tile together');
  assert.match(main, /input\[name=effectsPreset\]:checked/, 'opening from the tile lands on the checked effects preset');
  assert.match(main, /import \{ applyMenuAction \} from '\.\/menu-navigation\.mjs';/);
  assert.match(main, /applyMenuAction\(overlay, action, document\.activeElement\)/);
  assert.doesNotMatch(main, /Preferences saved on this device/, 'successful saves are silent');
  assert.match(main, /Couldn’t save on this device\. Your changes still apply to this run\./);
  assert.match(main, /Start right away, or open Settings to choose effects and a music world\./);
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
  // The effects segmented control: 44 px segments, full-size hit area, 2 x 2 on phones, visible focus, not colour alone.
  assert.match(css, /\.segmented\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.segment\{[^}]*min-height:44px/);
  // The generic label rule centres its children; the visible pill must fill the 44 px target, not
  // shrink to its text (the first browser run showed 18 px pills with the inset bar through "Standard").
  assert.match(css, /\.segment\{[^}]*align-items:stretch/);
  assert.match(css, /\.segment input\{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0/);
  assert.match(css, /@media \(max-width:440px\)\{\.segmented\{grid-template-columns:1fr 1fr\}\}/);
  assert.match(css, /\.segment input:checked\+span\{[^}]*font-weight:800/);
  assert.match(css, /\.segment input:focus-visible\+span\{outline:3px solid/);
  assert.match(css, /@media \(forced-colors:active\)\{\.segment input:checked\+span\{border:3px solid Highlight\}\}/);
  assert.match(css, /\.pref-sound\{grid-column:1\/-1\}/);
  assert.match(css, /#settingsSaveNote\{grid-column:1\/-1\}/);
  assert.doesNotMatch(css, /\.scene-row|\.scene-picker|\.mobile-effects-note|#sceneHint/);
});
