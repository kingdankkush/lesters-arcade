import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  HMH_VFX_UI_CHROME_PACK,
  vfxUiChromeAssetByKey,
} from '../apps/portal/assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs';
import { buildArtRedoQueue } from '../scripts/art-redo-queue.mjs';

const REQUIRED_VFX = Object.freeze([
  'achievement-unlock-burst',
  'pickup-rarity-beams',
  'ui-confirm-spark',
]);
const REQUIRED_UI = Object.freeze([
  'combat-hud-frame',
  'level-up-card-frame',
  'achievement-toast-frame',
  'minimap-frame',
  'wallet-ranked-badges',
  'mobile-control-chrome',
]);

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

function repoText(relativePath) {
  return readFileSync(repoPath(relativePath), 'utf8');
}

test('VFX/UI chrome pack covers all art-redo missing VFX and UI chrome runtime ids', () => {
  assert.equal(HMH_VFX_UI_CHROME_PACK.id, 'hmh-vfx-ui-chrome-v1');
  assert.match(HMH_VFX_UI_CHROME_PACK.sourcePolicy, /Original repo-owned/i);
  assert.deepEqual(HMH_VFX_UI_CHROME_PACK.vfx.map((asset) => asset.key), REQUIRED_VFX);
  assert.deepEqual(HMH_VFX_UI_CHROME_PACK.uiChrome.map((asset) => asset.key), REQUIRED_UI);
  assert.equal(HMH_VFX_UI_CHROME_PACK.assetCount, REQUIRED_VFX.length + REQUIRED_UI.length);

  for (const key of [...REQUIRED_VFX, ...REQUIRED_UI]) {
    const asset = vfxUiChromeAssetByKey(key);
    assert.ok(asset, `${key} asset exists`);
    assert.equal(existsSync(repoPath(asset.src.replace('./', 'apps/portal/'))), true, `${key} image exists on disk`);
    assert.equal(asset.sourcePolicy.includes('Original repo-owned'), true);
    assert.equal(asset.width > 0, true);
    assert.equal(asset.height > 0, true);
    if (asset.kind === 'vfx') {
      assert.equal(asset.animated, true);
      assert.equal(asset.frames >= 4, true);
      assert.equal(asset.frameWidth > 0, true);
      assert.equal(asset.frameHeight > 0, true);
    }
  }
});

test('VFX/UI chrome pack is wired into HMH loader, runtime production art merge, and syntax gate', () => {
  const loader = repoText('apps/portal/src/games/hmh/loader.mjs');
  const main = repoText('apps/portal/main.js');
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(loader.includes('HMH_VFX_UI_CHROME_PACK'), true);
  assert.equal(loader.includes('hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs'), true);
  assert.equal(main.includes('buildVfxUiChromeSpriteIndex'), true);
  assert.equal(main.includes("hmh('HMH_VFX_UI_CHROME_PACK')?.vfx"), true);
  assert.equal(main.includes("hmh('HMH_VFX_UI_CHROME_PACK')?.uiChrome"), true);
  assert.equal(packageJson.includes('assets:hmh:vfx-ui-chrome'), true);
  assert.equal(syntaxCheck.includes('scripts/generate-hmh-vfx-ui-chrome.py'), true);
  assert.equal(syntaxCheck.includes('apps/portal/assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-vfx-ui-chrome.test.mjs'), true);
});

test('art redo queue marks VFX and UI chrome items manifest-backed from the chrome pack', () => {
  const queue = buildArtRedoQueue();
  const vfx = queue.categories.find((category) => category.id === 'vfx');
  const ui = queue.categories.find((category) => category.id === 'ui-chrome');

  for (const key of REQUIRED_VFX) {
    const item = vfx.items.find((entry) => entry.runtimeId === key);
    assert.ok(item, `${key} queue item exists`);
    assert.equal(/manifest-backed/.test(item.status), true, `${key} should be manifest-backed`);
    assert.match(item.iconSrc ?? item.src ?? '', /hmh-vfx-ui-chrome/);
  }
  for (const key of REQUIRED_UI) {
    const item = ui.items.find((entry) => entry.runtimeId === key);
    assert.ok(item, `${key} queue item exists`);
    assert.equal(/manifest-backed/.test(item.status), true, `${key} should be manifest-backed`);
    assert.match(item.iconSrc ?? item.src ?? '', /hmh-vfx-ui-chrome/);
  }
});
