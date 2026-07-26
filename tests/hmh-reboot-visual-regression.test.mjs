import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SIGNATURE_MAX_CELL_DELTA,
  SIGNATURE_MAX_CHANGED_CELLS,
  SIGNATURE_TOLERANCE,
  VISUAL_SCENES,
  classifyScene,
  compareSignatures,
} from '../scripts/hmh-reboot-visual-regression.mjs';

test('reboot visual gate owns desktop, mobile, combat, and every authored district material pass', () => {
  assert.ok(VISUAL_SCENES.length >= 8);
  const ids = new Set(VISUAL_SCENES.map((scene) => scene.id));
  for (const required of ['frontier-relay-desktop', 'frontier-relay-mobile', 'combat-engaged-desktop', 'ravine-overlook-desktop', 'mining-camp-desktop', 'liquidity-bridge-desktop', 'hashwood-foliage-desktop', 'liquidation-yard-desktop']) {
    assert.ok(ids.has(required), `visual gate is missing ${required}`);
  }
  assert.ok(VISUAL_SCENES.every((scene) => scene.query.includes('evidenceSafe=1') && scene.query.includes('telemetry=1')));
});

test('reboot visual comparison rejects localized and broad regressions', () => {
  const baseline = Array(32 * 18).fill(80);
  assert.deepEqual(compareSignatures(baseline, baseline), { comparable: true, meanDelta: 0, maxDelta: 0, changedCells: 0 });
  const localized = [...baseline];
  localized[40] += SIGNATURE_MAX_CELL_DELTA + 1;
  assert.equal(classifyScene({ baseline, current: localized }).status, 'changed');
  const broad = baseline.map((value, index) => index < SIGNATURE_MAX_CHANGED_CELLS + 1 ? value + SIGNATURE_TOLERANCE + 1 : value);
  assert.equal(classifyScene({ baseline, current: broad }).status, 'changed');
  assert.equal(classifyScene({ baseline: null, current: baseline }).status, 'new');
});
