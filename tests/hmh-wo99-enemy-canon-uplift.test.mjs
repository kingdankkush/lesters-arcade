import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { HMH_WO99_ENEMY_CANON_UPLIFT, hmhWo99CertifiedEnemyIds } from '../apps/portal/assets/generated/hmh-wo99-enemy-canon-uplift/hmh-wo99-enemy-canon-uplift.mjs';
import { BESPOKE_ENEMY_VISUAL_KITS, buildEnemyVisualRedesignQueue, buildTopEnemyExposureContactSheetPlan } from '../apps/portal/src/hmh-encounter-visuals.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HERO_KEYS = new Set(['lester', 'lilly', 'lit-commando', 'lit-valkyrie']);

function repoPath(rel) {
  return path.resolve(ROOT, rel);
}

test('WO-99 manifest certifies hero-canon-safe enemy roster and records PixelLab availability', () => {
  const manifest = HMH_WO99_ENEMY_CANON_UPLIFT;

  assert.equal(manifest.id, 'hmh-wo99-enemy-canon-uplift-v1');
  assert.equal(manifest.workOrder, 'WO-99');
  assert.equal(manifest.pixellab.generationsRemaining, 10000);
  assert.match(manifest.sourcePolicy, /Repo-local PixelLab-derived/);
  assert.equal(manifest.summary.runtimeEnemyKitCount >= 30, true);
  assert.equal(manifest.summary.certifiedHeroCanonSafeEnemyCount, hmhWo99CertifiedEnemyIds.length);
  assert.equal(hmhWo99CertifiedEnemyIds.length >= 7, true);

  for (const id of hmhWo99CertifiedEnemyIds) {
    const row = manifest.enemyMatrix.find((entry) => entry.enemyId === id);
    assert.ok(row, `${id} exists in WO-99 matrix`);
    assert.equal(row.verdict, 'certified-8dir-runtime');
    assert.equal(row.heroCanonSafe, true);
    assert.equal(HERO_KEYS.has(row.rosterKey), false, `${id} must not use a playable hero roster key`);
    for (const state of manifest.coreEnemyStates) {
      assert.equal(row.stateCoverage[state], 8, `${id}/${state} has 8 directions`);
    }
  }
});

test('WO-99 wires buzzard to the true PixelLab bird kit instead of the old proxy', () => {
  const kit = BESPOKE_ENEMY_VISUAL_KITS.buzzard;
  const row = HMH_WO99_ENEMY_CANON_UPLIFT.enemyMatrix.find((entry) => entry.enemyId === 'buzzard');

  assert.equal(kit.rosterKey, 'buzzard');
  assert.equal(kit.autoRepair, null);
  assert.equal(row.rosterKey, 'buzzard');
  assert.equal(row.verdict, 'certified-8dir-runtime');
  assert.deepEqual(row.coreStatesFull8Dir, HMH_WO99_ENEMY_CANON_UPLIFT.coreEnemyStates);
});

test('WO-99 boss matrix does not over-claim incomplete boss art', () => {
  const manifest = HMH_WO99_ENEMY_CANON_UPLIFT;

  assert.equal(manifest.summary.bossCandidateCount, 4);
  assert.equal(manifest.summary.bossesReadyNow, 0);
  assert.equal(manifest.summary.bossesNeedingPixelLabCompleteKits, 4);
  for (const row of manifest.bossMatrix) {
    assert.notEqual(row.verdict, 'certified-8dir-runtime');
    assert.equal(row.pixelLabAction, 'queue-complete-8dir-boss-kit');
  }
});

test('WO-99 docs, generated manifest, and spectacle sheets exist', () => {
  const manifest = HMH_WO99_ENEMY_CANON_UPLIFT;
  assert.equal(existsSync(repoPath('apps/portal/assets/generated/hmh-wo99-enemy-canon-uplift/hmh-wo99-enemy-canon-uplift.json')), true);
  assert.equal(existsSync(repoPath('docs/game-design/hmh-wo99-enemy-canon-uplift.md')), true);
  assert.equal(existsSync(repoPath(manifest.contactSheets.enemyCanon)), true);
  assert.equal(existsSync(repoPath(manifest.contactSheets.bossDebt)), true);
});

test('WO-52 halt/proxy state is superseded by WO-99 approval and real buzzard kit', () => {
  const queue = buildEnemyVisualRedesignQueue();
  const plan = buildTopEnemyExposureContactSheetPlan();

  assert.equal(queue.approvalState, 'SUPERSEDED_BY_WO99_USER_APPROVED_PIXELLAB_UPLIFT');
  assert.equal(queue.fullBatchAllowed, true);
  assert.equal(queue.topFive.some((item) => item.enemyId === 'buzzard' && item.currentRosterKey === 'buzzard'), true);
  assert.equal(plan.haltCopy.includes('SUPERSEDED'), true);
  assert.equal(plan.rows.some((row) => row.enemyId === 'buzzard' && row.currentActorId === 'buzzard'), true);
});
