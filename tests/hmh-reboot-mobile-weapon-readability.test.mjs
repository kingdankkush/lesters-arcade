import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('mobile weapon browser evidence uses the visible touch path and observes deterministic reload status', () => {
  const smoke = repoText('scripts/hmh-reboot-combat-browser-smoke.mjs');
  const mobile = smoke.slice(smoke.indexOf('async function mobileSmoke()'), smoke.indexOf('async function worldTourSmoke()'));
  assert.match(mobile, /tapTouchControl\(page, 'weapon'/);
  assert.match(mobile, /dataset\.weaponStatus === 'reloading'/);
  assert.match(mobile, /weaponReloadTicksRemaining/);
  assert.match(mobile, /assert\.equal\(await page\.locator\('\[data-hmh-control\]'\)\.count\(\), 5\)/);
  assert.doesNotMatch(mobile, /await holdKey\(page, 'Digit2'\)/);
});

test('mobile combat HUD names the selected weapon, magazine capacity, and actionable state', () => {
  const runtime = repoText('apps/hmh-reboot/src/main.mjs');
  assert.match(runtime, /weaponStatus\?\.hudLabel/);
  assert.match(runtime, /weaponStatus\?\.accessibleLabel/);
  assert.match(runtime, /(?:stageElement\.dataset|dataset)\.weaponClipSize/);
  assert.match(runtime, /(?:stageElement\.dataset|dataset)\.weaponStatus/);
  assert.match(runtime, /(?:stageElement\.dataset|dataset)\.weaponReloadTicksRemaining/);
});

test('touch styles preserve a distinct readable weapon switch control', () => {
  const css = repoText('apps/portal/hmh-reboot/styles.css');
  assert.match(css, /\.hmh-touch-button--weapon/);
  assert.match(css, /\.hmh-touch-button--power/);
});

test('all-device mobile certification requires the compact five-control set', () => {
  const mobileSmoke = repoText('scripts/hmh-reboot-mobile-controls-browser-smoke.mjs');
  assert.match(mobileSmoke, /EXPECTED_CONTROLS = \['aim', 'move', 'pause', 'power', 'weapon'\]/);
});