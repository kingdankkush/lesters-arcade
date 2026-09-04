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
  assert.match(source, /touch control set/);
  assert.match(source, /Vercel Authentication/i);
  assert.match(source, /dist\/hmh-reboot\/game\.js/);
  assert.match(source, /sw\.js/);
});

test('Cycle 073 anchor warm-up is a bounded loop that stops on two hash-identical frames, and live runs prove navigation authority preceded the first tick', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  // The Cycle 072 mobile-portrait flake (28,886 antialiased DOM-edge pixels at
  // delta 19) survived a single throwaway screenshot. The warm-up must keep
  // rasterising until two consecutive captures agree, with a hard cap so a
  // frame that never settles still reaches the strict 32 px / delta 2 gate
  // instead of looping forever, and the count must reach the report so the
  // cycle record can quote it.
  assert.match(source, /const MAX_ANCHOR_WARMUP_SCREENSHOTS = 6;/);
  assert.match(source, /async function warmCompositor\(/);
  assert.match(source, /two consecutive/);
  assert.match(source, /warmup:/);
  assert.match(source, /stable/);
  // Exactly one anchor capture remains after the warm-up loop.
  const captureAnchor = source.slice(source.indexOf('async function captureAnchor('), source.indexOf('async function captureLiveInteraction('));
  assert.match(captureAnchor, /await warmCompositor\(page/);
  assert.equal((captureAnchor.match(/page\.screenshot\(/g) ?? []).length, 1, 'captureAnchor must take exactly one screenshot outside warmCompositor');
  // Thresholds and comparators are untouched: the flake is recorded, never widened.
  assert.match(source, /changedPixels <= 32/);
  assert.match(source, /maxChannelDelta <= 2/);
  assert.doesNotMatch(source, /changedPixels <= (?!32\b)\d+/);
  assert.doesNotMatch(source, /maxChannelDelta <= (?!2\b)\d+/);
  // K-7: the live path asserts the navgrid was authoritative before tick 4 and
  // records how long the idle-sliced build took per profile.
  const live = source.slice(source.indexOf('async function captureLiveInteraction('));
  assert.match(live, /dataset\.navGridReady/);
  assert.match(live, /navGridBootMs/);
  assert.match(live, /before navigation authority/);
});
