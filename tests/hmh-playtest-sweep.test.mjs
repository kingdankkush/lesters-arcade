import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_BUG_SWEEP_AREAS,
  HMH_PLAYTEST_SCENARIOS,
  buildStructuredPlaytestSweep,
  validateStructuredPlaytestSweep,
} from '../apps/portal/src/hmh-playtest-sweep.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-34 structured playtest sweep covers the full portal to combat path', () => {
  const sweep = buildStructuredPlaytestSweep();
  const validation = validateStructuredPlaytestSweep(sweep);

  assert.equal(validation.ok, true, validation.gaps.join('\n'));
  assert.equal(sweep.summary.status, 'PASS');
  assert.ok(sweep.summary.scenarioCount >= 6);
  assert.ok(sweep.summary.p0ScenarioCount >= 4);
});

test('WO-34 playtest scenarios include ranked, free, combat, audio, and mobile flows', () => {
  const ids = HMH_PLAYTEST_SCENARIOS.map((scenario) => scenario.id);
  for (const id of ['guest-arcade-entry', 'free-mode-ready-gate', 'ranked-submit-path', 'level-one-combat-loop', 'audio-accessibility', 'mobile-input-smoke']) {
    assert.equal(ids.includes(id), true, `${id} missing`);
  }
});

test('WO-34 bug sweep protects blocker and major risk areas with named guards', () => {
  for (const area of HMH_BUG_SWEEP_AREAS) {
    assert.equal(area.status, 'covered', `${area.id} status`);
    assert.ok(area.guard.includes('.test.mjs') || area.guard.includes('contracts:check'), `${area.id} guard`);
  }
  assert.ok(HMH_BUG_SWEEP_AREAS.some((area) => area.id === 'on-chain-abi-mismatch'));
  assert.ok(HMH_BUG_SWEEP_AREAS.some((area) => area.id === 'spawn-on-player'));
});

test('WO-34 syntax and report generation include playtest sweep files', () => {
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(packageJson.includes('design:playtest-sweep'), true);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-playtest-sweep.mjs'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-playtest-sweep.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-playtest-sweep.test.mjs'), true);
});
