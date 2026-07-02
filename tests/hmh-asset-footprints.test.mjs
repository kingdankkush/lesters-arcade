import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../apps/portal/assets/hmh-asset-footprints.json', import.meta.url), 'utf8'));

test('WO-8 footprint manifest covers all current runtime placement sources', () => {
  assert.equal(manifest.generatedBy, 'scripts/build-asset-footprints.mjs');
  assert.equal(manifest.worldScale.tileW, 64);
  assert.equal(manifest.worldScale.texelDensity, 1);
  assert.ok(manifest.summary.assetCount > 800, 'expected curated kit + coherent-world + demo-wave footprint coverage');
  assert.equal(manifest.summary.bySource['demo-wave'], 70);
  assert.ok(manifest.summary.bySource['curated-level-kit'] > 600);
  assert.ok(manifest.summary.bySource['coherent-world'] >= 50);
  assert.ok(manifest.summary.bySource['coherent-world-scene-template'] >= 70);
});

test('every placeable asset has native pixels, computed footprint, and a recorded override field', () => {
  for (const asset of manifest.assets) {
    assert.ok(asset.key, 'asset key required');
    assert.ok(asset.runtimeKey, `${asset.key} needs runtimeKey`);
    assert.ok(asset.src, `${asset.key} needs src`);
    assert.ok(asset.nativePx.w > 0 && asset.nativePx.h > 0, `${asset.key} needs native dimensions`);
    assert.ok(asset.footprintTiles.w >= 0.5 && asset.footprintTiles.h >= 0.5, `${asset.key} needs tile footprint`);
    assert.equal(Number.isInteger(asset.footprintTiles.w * 2), true, `${asset.key} width footprint must be rounded to 0.5 tile`);
    assert.equal(Object.hasOwn(asset, 'override'), true, `${asset.key} needs override field`);
    if (asset.withinTolerance) {
      assert.equal(asset.override, null, `${asset.key} needs no override when density is in tolerance`);
    } else {
      assert.ok(asset.override?.footprintTiles?.w > 0, `${asset.key} needs approved manual footprint override`);
      assert.equal(asset.resolution, 'manual-footprint-override');
    }
  }
});

test('misfit section mirrors assets outside the WO-7 density tolerance', () => {
  assert.ok(Array.isArray(manifest.MISFITS), 'MISFITS section required');
  assert.equal(manifest.MISFITS.length, manifest.summary.misfitCount);
  assert.ok(manifest.MISFITS.length > 0, 'WO-8 should present non-empty misfit list for approval');
  const misfitKeys = new Set(manifest.MISFITS.map((asset) => asset.key));
  for (const asset of manifest.assets) {
    const outside = asset.impliedDensity < manifest.toleranceDensityRange.min || asset.impliedDensity > manifest.toleranceDensityRange.max;
    assert.equal(misfitKeys.has(asset.key), outside, `${asset.key} misfit classification should match density tolerance`);
  }
});

test('generator, report, package script, and syntax gate are wired', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['assets:footprints'], 'node scripts/build-asset-footprints.mjs');
  const report = readFileSync(new URL('../docs/art/HMH_ASSET_FOOTPRINT_MISFITS.md', import.meta.url), 'utf8');
  assert.match(report, /## MISFITS/);
  assert.match(report, /manual-footprint-override/);
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(syntax, /scripts\/build-asset-footprints\.mjs/);
  assert.match(syntax, /tests\/hmh-asset-footprints\.test\.mjs/);
});
