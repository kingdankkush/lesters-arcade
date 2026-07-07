import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION,
  HMH_WO86_89_SHOWCASE_REEL_SHOTLIST,
  buildWo8689AudioAvCertification,
} from '../apps/portal/src/hmh-wo86-89-audio-av.mjs';
import { HMH_SFX_CUE_REGISTRY } from '../apps/portal/src/hmh-audio-system.mjs';

const DOC = fileURLToPath(new URL('../docs/game-design/hmh-wo86-89-audio-av.md', import.meta.url));

test('WO-86/87/88/89 audio AV certification passes all gates', () => {
  const cert = buildWo8689AudioAvCertification();
  assert.equal(cert.id, 'hmh-wo86-87-88-89-audio-av-cert-v1');
  assert.deepEqual(cert.workOrders, ['WO-86', 'WO-87', 'WO-88', 'WO-89']);
  assert.equal(cert.status, 'certified-runtime-audio-av-plan');
  assert.equal(cert.gates.every((gate) => gate.status === 'pass'), true);
});

test('WO-87 SFX inventory maps to central runtime cue registry', () => {
  const cert = HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION;
  assert.equal(cert.wo87SfxInventory.length >= 8, true);
  for (const row of cert.inventoryCueCoverage.filter((entry) => entry.registryCue)) {
    assert.ok(HMH_SFX_CUE_REGISTRY[row.registryCue], `${row.cue} maps to ${row.registryCue}`);
  }
});

test('WO-88 pressure layered score has required stem concepts', () => {
  const stems = HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION.wo88ScorePlan.stems;
  assert.deepEqual(stems, ['base rain pulse', 'combat arpeggio', 'boss brass hit layer', 'low-health filtered layer', 'victory release sting']);
});

test('WO-89 showcase reel covers 60 seconds and sync moments', () => {
  const cert = HMH_WO86_87_88_89_AUDIO_AV_CERTIFICATION;
  assert.equal(HMH_WO86_89_SHOWCASE_REEL_SHOTLIST.length, 6);
  assert.equal(cert.wo89AvSync.syncMoments.length >= 5, true);
  assert.equal(cert.wo89AvSync.acceptance.includes('balanced SFX/music'), true);
});

test('WO-86/89 docs exist', () => {
  assert.equal(existsSync(DOC), true);
});
