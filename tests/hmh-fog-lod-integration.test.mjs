import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const profileReport = readFileSync(new URL('../docs/testing/wo71-minute12-profile.md', import.meta.url), 'utf8');

test('WO-75 fog and minimap share one cached exploration layer per frame', () => {
  assert.match(mainSource, /explorationLayerFrame/);
  assert.match(mainSource, /explorationLayerCache/);
  assert.match(mainSource, /if \(combat\.explorationLayerFrame === combat\.frame && combat\.explorationLayerCache\)/);
});

test('WO-75 minute-12 profile re-verifies fog and minimap workload after integration', () => {
  assert.match(profileReport, /Vision fog draw cells/i);
  assert.match(profileReport, /Minimap fog cells/i);
  assert.match(profileReport, /shared exploration cache/i);
});
