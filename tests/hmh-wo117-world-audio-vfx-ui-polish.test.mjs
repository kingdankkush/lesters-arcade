import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { HMH_SFX_CUE_REGISTRY } from '../apps/portal/src/hmh-audio-system.mjs';
import { HMH_WO117_POLISH_CERTIFICATION } from '../apps/portal/src/hmh-wo117-polish-pack.mjs';

function repoUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

function readText(path) {
  return readFileSync(repoUrl(path), 'utf8');
}

test('WO-117 polish pack ships generated artwork for world, VFX, and UI polish', () => {
  const cert = HMH_WO117_POLISH_CERTIFICATION;
  assert.equal(cert.id, 'hmh-wo117-world-audio-vfx-ui-polish-v1');
  assert.equal(cert.generatedPack.id, 'hmh-wo117-polish-pack-v1');
  assert.equal(cert.generatedPack.assetCount >= 6, true);
  assert.equal(cert.generatedPack.sourcePolicy.includes('repo-owned'), true);

  for (const asset of cert.generatedPack.assets) {
    assert.match(asset.src, /^\.\/assets\/generated\/hmh-wo117-polish-pack\//);
    assert.equal(existsSync(repoUrl(`apps/portal/${asset.src.replace(/^\.\//, '')}`)), true, `${asset.key} exists on disk`);
    assert.equal(asset.width > 0 && asset.height > 0, true, `${asset.key} has dimensions`);
  }

  for (const required of ['route-beacon-chevron', 'district-risk-chip', 'minimap-objective-pip', 'audio-vfx-sync-ring', 'boss-gate-warning-sigil', 'pickup-lane-glint']) {
    assert.equal(cert.generatedPack.assets.some((asset) => asset.key === required), true, `${required} is present`);
  }
});

test('WO-117 binds authored Level 1 route beats to sound cues, coded VFX, and UI surfaces', () => {
  const cert = HMH_WO117_POLISH_CERTIFICATION;
  assert.equal(cert.routeCueRows.length >= 8, true);
  assert.deepEqual([...new Set(cert.routeCueRows.map((row) => row.beat))], ['spawn', 'arena', 'loop', 'chokepoint', 'pressure', 'boss', 'extract']);

  for (const row of cert.routeCueRows) {
    assert.ok(row.routeId, 'route row has id');
    assert.ok(row.districtId, 'route row has district');
    assert.ok(HMH_SFX_CUE_REGISTRY[row.sfxCue], `${row.sfxCue} cue exists in central SFX registry`);
    assert.match(row.vfxKey, /^(route-beacon-chevron|audio-vfx-sync-ring|boss-gate-warning-sigil|pickup-lane-glint)$/);
    assert.match(row.uiSurface, /^(hud-objective-chip|minimap-route-pip|boss-warning-card|extraction-banner)$/);
    assert.equal(row.levelDesignPurpose.length > 24, true);
  }
});

test('WO-117 has accessibility-safe UI polish and audio mix-density limits', () => {
  const cert = HMH_WO117_POLISH_CERTIFICATION;
  assert.equal(cert.gates.audioCuesAllRegistered, true);
  assert.equal(cert.gates.noNormalBulletSprites, true);
  assert.equal(cert.gates.uiSurfacesCovered, true);
  assert.equal(cert.gates.reduceMotionSafe, true);
  assert.equal(cert.mixDensity.maxWorldCueVoices <= 4, true);
  assert.equal(cert.mixDensity.bossWarningExclusive, true);
  assert.equal(cert.uiPolishRows.some((row) => row.surface === 'hud-objective-chip' && row.assetKey === 'district-risk-chip'), true);
  assert.equal(cert.uiPolishRows.some((row) => row.surface === 'minimap-route-pip' && row.assetKey === 'minimap-objective-pip'), true);
  assert.equal(cert.specialEffectRows.every((row) => row.kind === 'coded-vfx' && row.usesSpriteBullets === false), true);
});

test('WO-117 runtime loader, docs, and proof handles are wired', () => {
  const loader = readText('apps/portal/src/games/hmh/loader.mjs');
  assert.equal(loader.includes('HMH_WO117_POLISH_PACK'), true);
  assert.equal(loader.includes('hmh-wo117-polish-pack-manifest.mjs'), true);

  const syntax = readText('scripts/syntax-check.mjs');
  assert.equal(syntax.includes('apps/portal/src/hmh-wo117-polish-pack.mjs'), true);
  assert.equal(syntax.includes('tests/hmh-wo117-world-audio-vfx-ui-polish.test.mjs'), true);
  assert.equal(syntax.includes('scripts/generate-wo117-polish-pack.py'), true);

  assert.equal(existsSync(repoUrl('scripts/generate-wo117-polish-pack.py')), true);
  assert.equal(existsSync(repoUrl('docs/game-design/wo117-world-audio-vfx-ui-polish/README.md')), true);
  assert.equal(existsSync(repoUrl('docs/game-design/wo117-world-audio-vfx-ui-polish/wo117-polish-proof.png')), true);
  assert.equal(existsSync(repoUrl('docs/game-design/wo117-world-audio-vfx-ui-polish/wo117-polish-certification.json')), true);
});
