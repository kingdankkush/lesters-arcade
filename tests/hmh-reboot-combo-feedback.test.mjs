import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  COMBO_MILESTONES,
  resolveComboFeedback,
  resolveComboPresentation,
} from '../apps/hmh-reboot/src/combo-feedback.mjs';
import { HMH_SFX_CUE_REGISTRY } from '../apps/portal/src/hmh-audio-system.mjs';

test('combo presentation exposes authored intensity tiers and reset state', () => {
  assert.deepEqual(COMBO_MILESTONES, [5, 10, 20, 30]);
  assert.deepEqual(resolveComboPresentation(0), { count: 0, text: '×0', tier: 'idle', label: 'Combo reset' });
  assert.equal(resolveComboPresentation(4).tier, 'building');
  assert.equal(resolveComboPresentation(5).tier, 'hot');
  assert.equal(resolveComboPresentation(10).tier, 'surge');
  assert.equal(resolveComboPresentation(20).tier, 'overload');
  assert.equal(resolveComboPresentation(30).tier, 'legend');
});

test('combo feedback distinguishes reset, milestone, and boss-threshold cues', () => {
  assert.equal(resolveComboFeedback({ previous: 4, current: 5 }).cue, 'combo-milestone');
  assert.equal(resolveComboFeedback({ previous: 9, current: 10 }).milestone, 10);
  assert.equal(resolveComboFeedback({ previous: 12, current: 0 }).cue, 'combo-reset');
  assert.equal(resolveComboFeedback({ previous: 19, current: 20, bossDefeated: true }).cue, 'combo-boss-threshold');
  assert.equal(resolveComboFeedback({ previous: 6, current: 7 }).cue, null);
});

test('combo cues are registered and the child shell exposes the live combo readout', () => {
  for (const cue of ['combo-reset', 'combo-milestone', 'combo-boss-threshold']) assert.ok(HMH_SFX_CUE_REGISTRY[cue]);
  const shell = readFileSync(new URL('../apps/portal/hmh-reboot/index.html', import.meta.url), 'utf8');
  const cockpit = readFileSync(new URL('../apps/hmh-reboot/src/cockpit-ui.mjs', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(shell, /id="hmhRunCombo"/);
  assert.match(shell, /id="hmhRunComboLabel"/);
  assert.match(cockpit, /updateCombo\(combo\)/);
  assert.match(main, /resolveComboFeedback/);
  assert.match(main, /cockpit\?\.updateCombo/);
});
