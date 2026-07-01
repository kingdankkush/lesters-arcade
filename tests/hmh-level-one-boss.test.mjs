import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveLevelOneBossPhase,
  buildLevelOneBossDirective,
  computeBossVolleyVectors,
  LEVEL_ONE_BOSS_PHASE_COMBAT,
  resolveLevelOneMiniBossPhase,
  buildLevelOneMiniBossDirective,
} from '../apps/portal/src/hmh-level-one-boss.mjs';
import { buildLevelOneBossChoreographyPlan } from '../apps/portal/src/hmh-level-one-balance-pass.mjs';

// --- phase resolution maps HP fraction to the choreography plan -------------

test('full HP resolves to the first phase (gate-warning)', () => {
  const p = resolveLevelOneBossPhase(1.0);
  assert.equal(p.id, 'gate-warning');
  assert.equal(p.phaseNumber, 1);
  assert.equal(p.phaseCount, 3);
  assert.equal(p.addWaveSuppression, true); // gate-warning suppresses adds
});

test('mid HP (50%) resolves to panic-crossfire', () => {
  const p = resolveLevelOneBossPhase(0.5);
  assert.equal(p.id, 'panic-crossfire');
  assert.equal(p.phaseNumber, 2);
  assert.equal(p.addWaveSuppression, false);
});

test('low HP (20%) resolves to the final extraction-break phase', () => {
  const p = resolveLevelOneBossPhase(0.2);
  assert.equal(p.id, 'extraction-break');
  assert.equal(p.isFinalPhase, true);
  assert.equal(p.addWaveSuppression, true); // finale is a clean duel
});

test('zero HP still maps cleanly to the final phase', () => {
  const p = resolveLevelOneBossPhase(0);
  assert.equal(p.id, 'extraction-break');
});

test('phase thresholds align with the choreography plan hpPct bands', () => {
  const plan = buildLevelOneBossChoreographyPlan();
  for (const planPhase of plan.finalBoss.phases) {
    const [high, low] = planPhase.hpPct;
    // sample just inside the top of each band
    const midFraction = ((high + low) / 2) / 100;
    const resolved = resolveLevelOneBossPhase(midFraction);
    assert.equal(resolved.id, planPhase.id, `hp ${midFraction} should map to ${planPhase.id}`);
  }
});

test('every choreography phase id has a combat table entry', () => {
  const plan = buildLevelOneBossChoreographyPlan();
  for (const planPhase of plan.finalBoss.phases) {
    assert.ok(LEVEL_ONE_BOSS_PHASE_COMBAT[planPhase.id], `missing combat entry for ${planPhase.id}`);
  }
});

// --- combat directives escalate across phases -------------------------------

test('fan shot count strictly escalates gate -> panic -> extraction', () => {
  const gate = resolveLevelOneBossPhase(0.9);
  const panic = resolveLevelOneBossPhase(0.5);
  const ext = resolveLevelOneBossPhase(0.15);
  assert.ok(gate.fanShots < panic.fanShots, 'panic fires more shots than gate');
  assert.ok(panic.fanShots < ext.fanShots, 'extraction fires the most shots');
  assert.ok(ext.shotSpeedMul >= panic.shotSpeedMul, 'shots get faster in the finale');
});

// --- transition detection: banner + one-time add wave -----------------------

test('buildLevelOneBossDirective flags a phase change and emits a banner', () => {
  // boss drops from full (gate-warning) to 50% (panic-crossfire)
  const d = buildLevelOneBossDirective({ hp: 50, maxHp: 100, lastPhaseId: 'gate-warning' });
  assert.equal(d.phase.id, 'panic-crossfire');
  assert.equal(d.phaseChanged, true);
  assert.ok(d.banner && d.banner.length > 0);
  assert.equal(d.summonAdds, LEVEL_ONE_BOSS_PHASE_COMBAT['panic-crossfire'].summonAddsOnEntry);
  assert.equal(d.nextLastPhaseId, 'panic-crossfire');
});

test('no phase change means no banner and no adds', () => {
  const d = buildLevelOneBossDirective({ hp: 90, maxHp: 100, lastPhaseId: 'gate-warning' });
  assert.equal(d.phaseChanged, false);
  assert.equal(d.banner, null);
  assert.equal(d.summonAdds, 0);
});

test('entering an add-suppressed phase spawns no adds even on transition', () => {
  // drop into extraction-break (addWaveSuppression: true) from panic-crossfire
  const d = buildLevelOneBossDirective({ hp: 10, maxHp: 100, lastPhaseId: 'panic-crossfire' });
  assert.equal(d.phase.id, 'extraction-break');
  assert.equal(d.phaseChanged, true);
  assert.equal(d.summonAdds, 0, 'finale suppresses adds');
});

test('first evaluation (lastPhaseId null) counts as a phase entry', () => {
  const d = buildLevelOneBossDirective({ hp: 100, maxHp: 100, lastPhaseId: null });
  assert.equal(d.phaseChanged, true);
  assert.equal(d.phase.id, 'gate-warning');
});

// --- volley geometry --------------------------------------------------------

test('computeBossVolleyVectors returns fanShots vectors at the phase speed', () => {
  const phase = resolveLevelOneBossPhase(0.5); // panic-crossfire, 5 shots
  const vectors = computeBossVolleyVectors({ dirX: 1, dirY: 0, baseSpeed: 5, phase });
  assert.equal(vectors.length, phase.fanShots);
  // each vector magnitude equals baseSpeed * shotSpeedMul
  const expectedSpeed = 5 * phase.shotSpeedMul;
  for (const v of vectors) {
    const mag = Math.hypot(v.vx, v.vy);
    assert.ok(Math.abs(mag - expectedSpeed) < 1e-6, `vector speed ${mag} != ${expectedSpeed}`);
  }
});

test('a single-shot fan aims straight at the target', () => {
  const phase = { fanShots: 1, fanSpreadRad: 0, shotSpeedMul: 1 };
  const [v] = computeBossVolleyVectors({ dirX: 0, dirY: 1, baseSpeed: 4, phase });
  assert.ok(Math.abs(v.vx) < 1e-6);
  assert.ok(Math.abs(v.vy - 4) < 1e-6);
});

test('fan is centered: outer vectors are symmetric about the aim direction', () => {
  const phase = { fanShots: 3, fanSpreadRad: 1.0, shotSpeedMul: 1 };
  const vectors = computeBossVolleyVectors({ dirX: 1, dirY: 0, baseSpeed: 10, phase });
  // middle vector should aim straight (vy ~ 0); outer two symmetric in vy
  assert.ok(Math.abs(vectors[1].vy) < 1e-6);
  assert.ok(Math.abs(vectors[0].vy + vectors[2].vy) < 1e-6, 'outer shots symmetric');
});

test('directive output objects are frozen', () => {
  const d = buildLevelOneBossDirective({ hp: 50, maxHp: 100, lastPhaseId: null });
  assert.ok(Object.isFrozen(d));
  assert.ok(Object.isFrozen(d.phase));
});

// --- runtime wiring: main.js must actually CONSUME the controller ----------
// (guards against the "module exists but isn't live" gap).

test('main.js imports and wires the boss phase controller into the enemy loop', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { join } = await import('node:path');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const mainJs = readFileSync(join(root, 'apps', 'portal', 'main.js'), 'utf8');

  assert.ok(mainJs.includes("from './src/hmh-level-one-boss.mjs'"), 'main.js must import the boss controller');
  assert.ok(mainJs.includes('buildLevelOneBossDirective('), 'main.js must call buildLevelOneBossDirective');
  assert.ok(mainJs.includes('computeBossVolleyVectors('), 'main.js must fire phase-driven volleys');
  // the phase-driven volley must be gated behind the finalBossProxy flag
  assert.ok(/finalBossProxy[\s\S]{0,900}computeBossVolleyVectors/.test(mainJs), 'volley must be gated behind finalBossProxy');
  assert.ok(mainJs.includes('buildLevelOneMiniBossDirective('), 'main.js must drive mini-boss phases');
});

// --- mini-boss 2-phase enrage ----------------------------------------------

test('resolveLevelOneMiniBossPhase returns base above 50% HP for a known POI', () => {
  const poiId = buildLevelOneBossChoreographyPlan().miniBosses[0].poiId;
  const phase = resolveLevelOneMiniBossPhase(poiId, 0.8);
  assert.ok(phase, 'a known mini-boss POI must resolve a phase');
  assert.equal(phase.id, 'base');
  assert.equal(phase.enraged, false);
  assert.equal(phase.phaseNumber, 1);
});

test('resolveLevelOneMiniBossPhase enrages at or below 50% HP', () => {
  const poiId = buildLevelOneBossChoreographyPlan().miniBosses[0].poiId;
  const phase = resolveLevelOneMiniBossPhase(poiId, 0.4);
  assert.equal(phase.id, 'enraged');
  assert.equal(phase.enraged, true);
  assert.ok(phase.attackResetMul < 1, 'enraged cadence is tighter');
  assert.ok(phase.fanShots >= 3, 'enraged ranged mini-boss gains a fan');
});

test('resolveLevelOneMiniBossPhase returns null for a POI with no mini-boss plan', () => {
  assert.equal(resolveLevelOneMiniBossPhase('not-a-real-poi', 0.4), null);
  assert.equal(resolveLevelOneMiniBossPhase(null, 0.4), null);
});

test('buildLevelOneMiniBossDirective emits an ENRAGED banner on entry only', () => {
  const poiId = buildLevelOneBossChoreographyPlan().miniBosses[0].poiId;
  // drop from base (80%) to enraged (40%)
  const d = buildLevelOneMiniBossDirective({ poiId, hp: 40, maxHp: 100, lastPhaseId: 'base' });
  assert.equal(d.phase.enraged, true);
  assert.equal(d.phaseChanged, true);
  assert.ok(d.banner && /ENRAGED/.test(d.banner));
  // staying enraged does not re-emit the banner
  const d2 = buildLevelOneMiniBossDirective({ poiId, hp: 30, maxHp: 100, lastPhaseId: 'enraged' });
  assert.equal(d2.phaseChanged, false);
  assert.equal(d2.banner, null);
});

test('buildLevelOneMiniBossDirective returns null for non-mini-boss POIs', () => {
  assert.equal(buildLevelOneMiniBossDirective({ poiId: 'nope', hp: 10, maxHp: 100 }), null);
});


