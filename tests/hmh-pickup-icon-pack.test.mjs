import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { LESTER_BLASTER_POWER_UPS } from '../apps/portal/src/arcade-core.mjs';
import {
  HMH_PICKUP_ICON_PACK,
  pickupIconAssetById,
} from '../apps/portal/assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs';

const P0_PICKUP_IDS = Object.freeze([
  'bonus-life',
  'hash-rail-core',
  'time-dilation',
  'berserk-candle',
  'nuke-liquidation',
]);

function repoPath(relativePath) {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

function repoText(relativePath) {
  return readFileSync(repoPath(relativePath), 'utf8');
}

test('P0 pickup icon pack contains disk-real manifest-backed runtime ids', () => {
  const powerUpsById = new Map(LESTER_BLASTER_POWER_UPS.map((powerUp) => [powerUp.id, powerUp]));

  assert.equal(HMH_PICKUP_ICON_PACK.id, 'hmh-pickup-icons-p0-v1');
  assert.equal(HMH_PICKUP_ICON_PACK.assetCount, P0_PICKUP_IDS.length);
  assert.match(HMH_PICKUP_ICON_PACK.sourcePolicy, /Original repo-owned/i);
  assert.deepEqual(HMH_PICKUP_ICON_PACK.p0RuntimeIds, P0_PICKUP_IDS);

  for (const id of P0_PICKUP_IDS) {
    const core = powerUpsById.get(id);
    const asset = pickupIconAssetById(id);
    assert.ok(core, `${id} must remain a core power-up`);
    assert.ok(asset, `${id} must have a generated icon asset`);
    assert.equal(asset.runtimeId, id);
    assert.equal(asset.effect, core.effect);
    assert.equal(asset.rarity, core.rarity);
    assert.equal(asset.width, 64);
    assert.equal(asset.height, 64);
    assert.equal(asset.frameCount, 1);
    assert.match(asset.src, /^\.\/assets\/generated\/hmh-pickup-icons\//);
    assert.equal(existsSync(repoPath(asset.src.replace('./', 'apps/portal/'))), true, `${id} PNG should exist on disk`);
  }
});

test('P0 pickup icon pack is exposed through HMH lazy loader and preferred by main runtime before older fallbacks', () => {
  const loader = repoText('apps/portal/src/games/hmh/loader.mjs');
  const main = repoText('apps/portal/main.js');
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(loader.includes('HMH_PICKUP_ICON_PACK'), true, 'lazy loader must expose the pickup icon manifest');
  assert.equal(loader.includes('hmh-pickup-icons/hmh-pickup-icons-manifest.mjs'), true, 'lazy loader must import the generated manifest');
  assert.equal(packageJson.includes('assets:hmh:pickup-icons'), true, 'generator command must be available');
  assert.equal(syntaxCheck.includes('apps/portal/assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs'), true, 'manifest must be syntax checked');
  assert.equal(syntaxCheck.includes('tests/hmh-pickup-icon-pack.test.mjs'), true, 'test must be syntax checked');
  assert.equal(syntaxCheck.includes('scripts/generate-hmh-pickup-icons.py'), true, 'generator must be py_compile checked');

  const p0ResolverIndex = main.indexOf("hmh('HMH_PICKUP_ICON_PACK')");
  const oldFxIndex = main.indexOf("hmh('HMH_FX_POWERUPS_WAVE')");
  assert.ok(p0ResolverIndex >= 0, 'main.js should resolve the new P0 pickup icon pack');
  assert.ok(oldFxIndex >= 0, 'main.js should retain older FX pickup fallback');
  assert.ok(p0ResolverIndex < oldFxIndex, 'new P0 pickup icon pack should be preferred before old FX wave fallbacks');
  for (const id of P0_PICKUP_IDS) {
    assert.equal(main.includes(`'${id}'`), true, `main.js should keep ${id} routable`);
  }
});
