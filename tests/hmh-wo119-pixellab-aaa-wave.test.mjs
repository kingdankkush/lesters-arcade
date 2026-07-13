import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION,
  WO119_REQUIRED_DIRECTIONS,
  WO119_REQUIRED_STATES,
} from '../apps/portal/src/hmh-wo119-pixellab-aaa-wave.mjs';
import { repairRuntimeActorKey } from '../apps/portal/src/hmh-art-repair.mjs';
import { buildRosterCoverageReport } from '../scripts/roster-coverage-report.mjs';

function repoUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

function readText(path) {
  return readFileSync(repoUrl(path), 'utf8');
}

test('WO-119 promotes Paper Hand to a complete PixelLab AAA 8-direction runtime replacement', () => {
  const cert = HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION;
  assert.equal(cert.id, 'hmh-wo119-pixellab-aaa-wave-v1');
  assert.equal(cert.enemyReplacement.actorKey, 'paper-hand');
  assert.equal(cert.enemyReplacement.source, 'pixellab-aaa-quality-wave-v1');
  assert.equal(cert.gates.paperHandSourceIsPixellabAaaWave, true);
  assert.equal(cert.gates.fullPaperHandMatrix, true);
  assert.equal(cert.enemyReplacement.frameCount, WO119_REQUIRED_STATES.length * WO119_REQUIRED_DIRECTIONS.length * 7);

  for (const row of cert.enemyReplacement.matrix) {
    assert.ok(WO119_REQUIRED_STATES.includes(row.state), `${row.state} is a required runtime state`);
    assert.ok(WO119_REQUIRED_DIRECTIONS.includes(row.direction), `${row.direction} is a required direction`);
    assert.equal(row.exists, true, `${row.actorKey}/${row.state}/${row.direction} frames exist`);
    assert.equal(row.firstFrame.startsWith('./assets/generated/hmh-animated-roster-atlas/paper-hand/'), true);
  }

  const repair = repairRuntimeActorKey('paper-hand');
  assert.equal(repair.repaired, false, 'paper-hand should use its direct PixelLab runtime kit, not repair fallback');

  const report = buildRosterCoverageReport();
  const paper = report.actors['paper-hand'];
  assert.equal(paper?.summary?.status, 'complete');
});

test('WO-119 Level 1 PixelLab world assets are present, alpha-clean, and route-integrated', () => {
  const cert = HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION;
  assert.equal(cert.gates.worldAssetsExist, true);
  assert.equal(cert.gates.worldAssetsRuntimeIntegrated, true);
  assert.equal(cert.gates.allLevelOneDistrictsHavePixellabRuntimeObjects, true);
  assert.equal(cert.levelDesign.runtimeAssetCount >= 20, true, 'expected broad Level 1 PixelLab runtime asset set');

  for (const row of cert.levelDesign.worldRows) {
    assert.equal(row.runtimeKey.startsWith('level1-reference-style/candidates/'), true);
    assert.equal(row.exists, true, `${row.runtimeKey} exists`);
    assert.equal(row.alphaClean, true, `${row.runtimeKey} alpha-clean`);
    assert.equal(row.runtimeIntegrated, true, `${row.runtimeKey} runtime-integrated`);
  }

  for (const [district, count] of Object.entries(cert.levelDesign.districtSceneObjectCounts)) {
    assert.equal(count > 0, true, `${district} has PixelLab runtime scene objects`);
  }
});

test('WO-119 docs, proof, syntax gate, and PixelLab generator are wired', () => {
  const cert = HMH_WO119_PIXELLAB_AAA_WAVE_CERTIFICATION;
  for (const path of Object.values(cert.docs)) {
    assert.equal(existsSync(repoUrl(path)), true, `${path} exists`);
  }
  const json = JSON.parse(readText(cert.docs.certificationJson));
  assert.equal(json.enemyReplacement.frameCount, 448);
  assert.equal(json.gates.paperHandFull8DirectionStateMatrix, true);

  const syntax = readText('scripts/syntax-check.mjs');
  assert.equal(syntax.includes('apps/portal/src/hmh-wo119-pixellab-aaa-wave.mjs'), true);
  assert.equal(syntax.includes('tests/hmh-wo119-pixellab-aaa-wave.test.mjs'), true);
  assert.equal(syntax.includes('scripts/pixellab-hmh-aaa-quality-wave.py'), true);
  assert.equal(syntax.includes('scripts/write-wo119-pixellab-aaa-wave.py'), true);

  assert.equal(existsSync(repoUrl('scripts/pixellab-hmh-aaa-quality-wave.py')), true);
  assert.equal(existsSync(repoUrl('apps/portal/assets/generated/hmh-aaa-pixellab-quality-wave/aaa-quality-wave-ledger.json')), true);
});
