import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const visualScript = readFileSync(new URL('../scripts/visual-regression.mjs', import.meta.url), 'utf8');

test('WO-65 visual regression harness is command-wired and captures real HMH canvas frames', () => {
  assert.equal(packageJson.scripts['visual:regression'], 'node scripts/visual-regression.mjs');
  assert.equal(packageJson.scripts['visual:accept'], 'node scripts/visual-regression.mjs --accept');
  assert.match(visualScript, /remote-debugging-port/);
  assert.match(visualScript, /Page\.captureScreenshot/);
  assert.match(visualScript, /appearDeadline/);
  assert.match(visualScript, /removeDeadline/);
  assert.match(visualScript, /seed-1337-spawn/);
  assert.match(visualScript, /seed-1337-stationary-repeat/);
  assert.doesNotMatch(visualScript, /seed-1337-east-walk/);
  assert.match(visualScript, /Date\.now = \(\) => 1337/);
  assert.match(visualScript, /comparePngWithPillow/);
  assert.match(visualScript, /visualDiffPasses/);
  assert.match(visualScript, /changedPct <= 1/);
  assert.match(visualScript, /meanAbsPerChannel <= 0\.25/);
  assert.match(visualScript, /WO-65 smoke captures live canvas frames/);
  assert.match(visualScript, /docs\/testing\/VISUAL_BASELINES/);
});
