import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scriptPath = path.join(root, 'scripts', 'hmh-reboot-release-browser-certification.mjs');

test('reboot release certification owns deterministic anchors, responsive geometry, interaction, and auth rejection', () => {
  assert.equal(packageJson.scripts['certify:hmh:browser'], 'node scripts/hmh-reboot-release-browser-certification.mjs');
  const source = fs.readFileSync(scriptPath, 'utf8');
  const runtimeSource = fs.readFileSync(path.join(root, 'apps', 'hmh-reboot', 'src', 'main.mjs'), 'utf8');
  assert.match(runtimeSource, /releaseAnchorEnabled = progressionPilotEnabled && runtimeParams\.get\('releaseAnchor'\) === '1'/);
  assert.match(runtimeSource, /releaseTelemetryEnabled = evidenceSafeEnabled && runtimeParams\.get\('telemetry'\) === '1'/);
  for (const viewport of ['desktop', 'ultrawide', 'tablet-landscape', 'mobile-portrait', 'mobile-landscape']) {
    assert.match(source, new RegExp(`name: '${viewport}'`));
  }
  assert.match(source, /seed=424242/);
  assert.match(source, /progressionPilot=1/);
  assert.match(source, /releaseAnchor=1/);
  assert.match(source, /telemetry=1/);
  assert.match(source, /HMH_REBOOT_BROWSER_EXECUTABLE/);
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /comparePngs/);
  assert.match(source, /changedPixels <= 32/);
  assert.match(source, /maxChannelDelta <= 2/);
  assert.match(source, /anchor hashes differ/);
  assert.match(source, /combatPilot=1/);
  assert.match(source, /locator\('#hmhRebootStage canvas'\)/);
  assert.match(source, /target\.tabIndex = 0/);
  assert.match(source, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /keyboard\.down/);
  assert.match(source, /pauseButton\.click/);
  assert.match(source, /resumeButton\.click/);
  assert.match(source, /visualViewport/);
  assert.match(source, /scrollWidth/);
  assert.match(source, /\[data-hmh-control\]/);
  assert.match(source, /touch control count/);
  assert.match(source, /Vercel Authentication/i);
  assert.match(source, /dist\/hmh-reboot\/game\.js/);
  assert.match(source, /sw\.js/);
});
