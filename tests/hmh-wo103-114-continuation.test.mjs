import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_WO103_114_CONTINUATION_CERTIFICATION,
  buildWo103114ContinuationCertification,
  renderWo103114ContinuationMarkdown,
} from '../apps/portal/src/hmh-wo103-114-continuation.mjs';

function repoPath(path) {
  return fileURLToPath(new URL(`../${path}`, import.meta.url));
}

test('WO-103 through WO-114 continuation certificate covers every preserved remaining work order', () => {
  const cert = buildWo103114ContinuationCertification();
  assert.equal(cert.id, 'hmh-wo103-114-continuation-cert-v1');
  assert.deepEqual(cert.workOrders.map((row) => row.id), [
    'WO-103', 'WO-105', 'WO-106', 'WO-107', 'WO-108', 'WO-109', 'WO-110', 'WO-111', 'WO-112', 'WO-113', 'WO-114',
  ]);
  assert.equal(cert.summary.totalWorkOrders, 11);
  assert.equal(cert.summary.certifiedEvidenceCount >= 11, true);
  assert.equal(cert.summary.openDebtCount >= 1, true, 'certificate must not over-claim Justin verdict / live capture debt');
});

test('WO-103/105/106 world artwork evidence is backed by real runtime manifests and proof sheets', () => {
  const cert = HMH_WO103_114_CONTINUATION_CERTIFICATION;
  const wo103 = cert.byId['WO-103'];
  const wo105 = cert.byId['WO-105'];
  const wo106 = cert.byId['WO-106'];

  assert.equal(wo103.evidence.some((row) => row.kind === 'manifest' && row.assetCount >= 16), true);
  assert.equal(wo103.evidence.some((row) => row.kind === 'animated-water' && row.assetCount >= 2), true);
  assert.equal(wo105.evidence.some((row) => row.kind === 'arena-road-building-kit' && row.assetCount >= 3), true);
  assert.equal(wo106.evidence.some((row) => row.kind === 'vehicle-microscene-life-kit' && row.assetCount >= 3), true);

  for (const path of [
    'docs/game-design/assets/hmh-wo103-continuous-ground-contact-sheet.png',
    'docs/game-design/wo104-106-world-kit-proof/wo104-106-checkpoint-proof-sheet.png',
  ]) {
    assert.equal(existsSync(repoPath(path)), true, `${path} exists`);
  }
});

test('WO-108/109/110 actor evidence includes hurtbox truth, animated roster, and true-scale boss pack', () => {
  const cert = HMH_WO103_114_CONTINUATION_CERTIFICATION;
  assert.equal(cert.byId['WO-108'].evidence.some((row) => row.kind === 'hurtbox-policy' && row.status === 'implemented'), true);
  assert.equal(cert.byId['WO-108'].evidence.some((row) => row.kind === 'boss-multi-capsules' && row.status === 'implemented'), true);
  assert.equal(cert.byId['WO-109'].evidence.some((row) => row.kind === 'animated-roster' && row.actorCount >= 5), true);
  assert.equal(cert.byId['WO-110'].evidence.some((row) => row.kind === 'true-scale-boss-pack' && row.actorCount >= 10 && row.stateCount >= 6), true);
});

test('WO-111/112/113/114 ship-candidate evidence covers VFX, audio sync, UI skin, and coherence gates', () => {
  const cert = HMH_WO103_114_CONTINUATION_CERTIFICATION;
  assert.equal(cert.byId['WO-111'].evidence.some((row) => row.kind === 'combat-vfx-pack' && row.assetCount >= 10 && row.excludesNormalBulletSprites === true), true);
  assert.equal(cert.byId['WO-112'].evidence.some((row) => row.kind === 'audio-av-certification' && row.status.includes('certified')), true);
  assert.equal(cert.byId['WO-113'].evidence.some((row) => row.kind === 'ui-skin-pack' && row.assetCount >= 9), true);
  assert.equal(cert.byId['WO-113'].evidence.some((row) => row.kind === 'pickup-and-achievement-icons' && row.assetCount >= 60), true);
  assert.equal(cert.byId['WO-114'].evidence.some((row) => row.kind === 'coherence-baseline' && row.visualBaselineCommand === 'npm run visual:regression'), true);
});

test('WO-103 through WO-114 markdown renders checkpoint gates and remaining debt without claiming a final verdict', () => {
  const markdown = renderWo103114ContinuationMarkdown(HMH_WO103_114_CONTINUATION_CERTIFICATION);
  assert.match(markdown, /# HMH WO-103–WO-114 Continuation Certification/);
  assert.match(markdown, /Playtest Checkpoint 2/);
  assert.match(markdown, /Playtest Checkpoint 3/);
  assert.match(markdown, /Playtest Checkpoint 4/);
  assert.match(markdown, /Justin verdict gate remains open/);
  assert.match(markdown, /WO-108/);
  assert.match(markdown, /debugHitboxes/);
});
