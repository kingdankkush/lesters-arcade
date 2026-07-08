import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION } from '../apps/portal/src/hmh-wo111-114-ship-candidate.mjs';

function repoUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

function readJson(path) {
  return JSON.parse(readFileSync(repoUrl(path), 'utf8'));
}

test('WO-111 final VFX timing locks weapon enemy boss and minute-8 density evidence', () => {
  const cert = HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION;
  assert.equal(cert.wo111.status, 'final-vfx-timing-locked');
  assert.equal(cert.wo111.assetCount >= 10, true);
  assert.equal(cert.wo111.excludesNormalBulletSprites, true);
  assert.equal(cert.wo111.minute8DensityCapture.elapsedSeconds, 480);
  assert.equal(cert.wo111.minute8DensityCapture.command, 'npm run visual:regression');
  const events = cert.wo111.timingRows.map((row) => row.event);
  for (const expected of ['weapon-fire', 'impact-armored', 'enemy-death', 'grenade-impact', 'level-up']) {
    assert.equal(events.includes(expected), true, `${expected} VFX timing exists`);
  }
  assert.equal(cert.wo111.timingRows.every((row) => row.durationMs > 0 && row.event !== 'unbound'), true);
});

test('WO-112 audio sync refresh locks cue HALTs and mix-density limits', () => {
  const cert = HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION;
  assert.equal(cert.wo112.status, 'audio-sync-mix-density-locked');
  assert.equal(cert.wo112.gatesPass, true);
  assert.equal(cert.wo112.syncRows.length >= 6, true);
  assert.equal(cert.wo112.mixDensity.haltCount, cert.wo112.syncRows.length);
  assert.equal(cert.wo112.mixDensity.bossWarningExclusive, true);
  for (const cue of ['weapon-fire', 'enemy-hit', 'enemy-death', 'boss-warning', 'pickup', 'level-up']) {
    assert.equal(cert.wo112.syncRows.some((row) => row.cue === cue && row.haltIfMissing), true, `${cue} HALT row exists`);
  }
});

test('WO-113 final UI skin covers HUD cards minimap badges pickup and checkpoint 4 notice', () => {
  const cert = HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION;
  assert.equal(cert.wo113.status, 'ship-candidate-ui-skin-locked');
  assert.equal(cert.wo113.uiChromeAssetCount >= 9, true);
  assert.equal(cert.wo113.pickupIconCount >= 5, true);
  assert.equal(cert.wo113.achievementIconCount >= 50, true);
  for (const key of ['combat-hud-frame', 'level-up-card-frame', 'achievement-toast-frame', 'minimap-frame', 'wallet-ranked-badges', 'mobile-control-chrome']) {
    assert.equal(cert.wo113.skinRows.some((row) => row.key === key), true, `${key} UI skin row exists`);
  }
  assert.equal(existsSync(repoUrl(cert.wo113.checkpoint4.noticePath)), true);
});

test('WO-114 SHIP_ART_CENSUS lock points at real seed-1337 census with no unresolved runtime placeholders', () => {
  const cert = HMH_WO111_114_SHIP_CANDIDATE_CERTIFICATION;
  assert.equal(cert.wo114.status, 'ship-art-census-baseline-locked');
  assert.equal(cert.wo114.seed, 1337);
  assert.equal(existsSync(repoUrl(cert.wo114.artCensusPath)), true);
  assert.equal(existsSync(repoUrl(cert.wo114.artCensusMarkdownPath)), true);
  const census = readJson(cert.wo114.artCensusPath);
  assert.equal(census.generatedBy, 'scripts/global-art-census.mjs');
  assert.equal(census.summary.runtimeUnresolvedZeroAnimationActorCount, 0);
  assert.equal(census.summary.runtimeStrictRenderableActorCount >= 30, true);
  assert.equal(census.summary.totalAssets >= 9000, true);
  assert.equal(census.summary.complianceScore >= 60, true);
});
