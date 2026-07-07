import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_WO81_82_79_ANIMATION_POLISH_CERTIFICATION,
  buildWo818279AnimationPolishCertification,
} from '../apps/portal/src/hmh-wo81-82-79-animation-polish.mjs';

const DOC = fileURLToPath(new URL('../docs/game-design/hmh-wo81-82-79-animation-polish.md', import.meta.url));

test('WO-81/82/79 animation polish certification passes runtime gates', () => {
  const cert = buildWo818279AnimationPolishCertification();
  assert.equal(cert.id, 'hmh-wo81-82-79-animation-polish-cert-v1');
  assert.deepEqual(cert.workOrders, ['WO-81', 'WO-82', 'WO-79']);
  assert.equal(cert.status, 'certified-runtime-polish-gates');
  assert.equal(cert.gates.every((gate) => gate.status === 'pass'), true);
});

test('WO-81 animation principles retain all required readability gates', () => {
  const gates = HMH_WO81_82_79_ANIMATION_POLISH_CERTIFICATION.wo81Principles;
  assert.deepEqual(gates.map((row) => row.gate), ['anticipation', 'smear', 'impact', 'follow-through', 'loop-bob']);
  assert.equal(gates.every((row) => row.acceptance.length > 20), true);
});

test('WO-82 Lit Commando and Lit Valkyrie are certified with no missing direction cells', () => {
  const cert = HMH_WO81_82_79_ANIMATION_POLISH_CERTIFICATION;
  assert.equal(cert.litHeroSummary.certified, true);
  assert.equal(cert.litHeroSummary.missingDirectionCells, 0);
  assert.equal(cert.litHeroSummary.rowCount, 16);
});

test('WO-79 ambient motion rules are reduced-motion-safe and textless', () => {
  const cert = HMH_WO81_82_79_ANIMATION_POLISH_CERTIFICATION;
  assert.equal(cert.wo79AmbientMotion.quotas.length, 4);
  assert.match(cert.wo79AmbientMotion.reducedMotion, /disable non-critical loops/);
  assert.equal(cert.ambientMotionRuntimeRules.some((row) => row.rule === 'blank-signage-only'), true);
});

test('WO-81/82/79 docs exist', () => {
  assert.equal(existsSync(DOC), true);
});
