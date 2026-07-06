import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const playerSurfaceFiles = [
  'apps/portal/index.html',
  'apps/portal/main.js',
];

const forbiddenPlayerCopy = [
  /official paid/i,
  /paid mode/i,
  /paid scores/i,
  /paid prototype/i,
  /Complete Prototype Run/i,
  /prototype result/i,
  /Start Combat Test/i,
  /combat prototype/i,
];

test('WO-74 player-facing copy no longer uses stale paid/prototype/test-lab framing', () => {
  for (const file of playerSurfaceFiles) {
    const text = repoText(file);
    for (const pattern of forbiddenPlayerCopy) {
      assert.equal(pattern.test(text), false, `${file} still matches ${pattern}`);
    }
  }
});

test('WO-74 selected cabinet renderer derives playable/locked labels from registry state', () => {
  const main = repoText('apps/portal/main.js');
  assert.match(main, /selectedGameStatus\.textContent = game\.status === 'playable' \? 'Playable now' : 'Coming soon'/);
  assert.match(main, /selectedGameTagline\.textContent = .*game\.status === 'playable'/s);
});

test('WO-74 has a 390px portrait overflow guard for mode and gameplay controls', () => {
  const css = repoText('apps/portal/styles.css');
  assert.match(css, /@media \(max-width: 390px\) and \(orientation: portrait\)/);
  assert.match(css, /\.official-mode-grid/);
  assert.match(css, /\.mode-card/);
  assert.match(css, /\.gameplay-control-bar/);
  assert.match(css, /\.roguelike-stat-bar/);
  assert.match(css, /overflow-wrap: anywhere/);
});
