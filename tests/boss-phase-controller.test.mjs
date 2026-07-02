import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPhaseDirective,
  clamp01,
  computePhaseVolleyVectors,
  computeVolleyVectors,
  phaseFractionFromHp,
  resolvePhaseFromHpFraction,
} from '../apps/portal/src/boss-phase-controller.mjs';

const PHASES = Object.freeze([
  Object.freeze({ id: 'open', hpPct: [100, 60], label: 'Opening read' }),
  Object.freeze({ id: 'pressure', hpPct: [60, 25], label: 'Pressure' }),
  Object.freeze({ id: 'finale', hpPct: [25, 0], label: 'Finale' }),
]);

const COMBAT = Object.freeze({
  open: Object.freeze({ fanShots: 1, fanSpreadRad: 0, shotSpeedMul: 1, summonAddsOnEntry: 0 }),
  pressure: Object.freeze({ fanShots: 3, fanSpreadRad: 0.45, shotSpeedMul: 1.1, summonAddsOnEntry: 2 }),
  finale: Object.freeze({ fanShots: 5, fanSpreadRad: 0.9, shotSpeedMul: 1.25, summonAddsOnEntry: 0, addWaveSuppression: true }),
});

test('clamp01 normalizes bad and out-of-range values', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01('0.25'), 0.25);
  assert.equal(clamp01('not-number'), 0);
});

test('resolvePhaseFromHpFraction maps HP bands in descending order', () => {
  assert.equal(resolvePhaseFromHpFraction(1, PHASES, { combatByPhaseId: COMBAT }).id, 'open');
  assert.equal(resolvePhaseFromHpFraction(0.61, PHASES, { combatByPhaseId: COMBAT }).id, 'open');
  assert.equal(resolvePhaseFromHpFraction(0.6, PHASES, { combatByPhaseId: COMBAT }).id, 'pressure');
  assert.equal(resolvePhaseFromHpFraction(0.59, PHASES, { combatByPhaseId: COMBAT }).id, 'pressure');
  assert.equal(resolvePhaseFromHpFraction(0.24, PHASES, { combatByPhaseId: COMBAT }).id, 'finale');
  assert.equal(resolvePhaseFromHpFraction(0, PHASES, { combatByPhaseId: COMBAT }).id, 'finale');
});

test('resolvePhaseFromHpFraction merges authored metadata with combat table values', () => {
  const phase = resolvePhaseFromHpFraction(0.5, PHASES, { combatByPhaseId: COMBAT });
  assert.equal(phase.id, 'pressure');
  assert.equal(phase.phaseNumber, 2);
  assert.equal(phase.phaseCount, 3);
  assert.equal(phase.label, 'Pressure');
  assert.equal(phase.fanShots, 3);
  assert.equal(phase.isFinalPhase, false);
  assert.ok(Object.isFrozen(phase));
});

test('phaseFractionFromHp handles zero/invalid max HP safely', () => {
  assert.equal(phaseFractionFromHp({ hp: 50, maxHp: 200 }), 0.25);
  assert.equal(phaseFractionFromHp({ hp: 50, maxHp: 0 }), 1);
  assert.equal(phaseFractionFromHp({ hp: -20, maxHp: 100 }), 0);
});

test('buildPhaseDirective emits entry-only banner and summons through callbacks', () => {
  const directive = buildPhaseDirective({
    hp: 50,
    maxHp: 100,
    lastPhaseId: 'open',
    phases: PHASES,
    combatByPhaseId: COMBAT,
    bannerForPhase: (phase) => `${phase.id}!`,
    summonAddsForPhase: (phase) => phase.addWaveSuppression ? 0 : phase.summonAddsOnEntry,
  });

  assert.equal(directive.phase.id, 'pressure');
  assert.equal(directive.phaseChanged, true);
  assert.equal(directive.banner, 'pressure!');
  assert.equal(directive.summonAdds, 2);
  assert.equal(directive.nextLastPhaseId, 'pressure');
  assert.ok(Object.isFrozen(directive));
  assert.ok(Object.isFrozen(directive.phase));

  const same = buildPhaseDirective({
    hp: 50,
    maxHp: 100,
    lastPhaseId: 'pressure',
    phases: PHASES,
    combatByPhaseId: COMBAT,
    bannerForPhase: (phase) => `${phase.id}!`,
    summonAddsForPhase: (phase) => phase.summonAddsOnEntry,
  });
  assert.equal(same.phaseChanged, false);
  assert.equal(same.banner, null);
  assert.equal(same.summonAdds, 0);
});

test('computeVolleyVectors preserves zero direction components and centers fan', () => {
  const straightUp = computeVolleyVectors({ dirX: 0, dirY: 1, baseSpeed: 4, fanShots: 1 });
  assert.equal(straightUp.length, 1);
  assert.ok(Math.abs(straightUp[0].vx) < 1e-6);
  assert.ok(Math.abs(straightUp[0].vy - 4) < 1e-6);

  const fan = computeVolleyVectors({ dirX: 1, dirY: 0, baseSpeed: 10, fanShots: 3, fanSpreadRad: 1 });
  assert.equal(fan.length, 3);
  assert.ok(Math.abs(fan[1].vy) < 1e-6, 'middle shot stays centered');
  assert.ok(Math.abs(fan[0].vy + fan[2].vy) < 1e-6, 'outer shots are symmetric');
  assert.ok(Object.isFrozen(fan));
  assert.ok(Object.isFrozen(fan[0]));
});

test('computePhaseVolleyVectors reads fan numbers from a resolved phase', () => {
  const phase = resolvePhaseFromHpFraction(0.1, PHASES, { combatByPhaseId: COMBAT });
  const vectors = computePhaseVolleyVectors({ dirX: 1, dirY: 0, baseSpeed: 6, phase });
  assert.equal(vectors.length, 5);
  for (const vector of vectors) {
    assert.ok(Math.abs(Math.hypot(vector.vx, vector.vy) - 7.5) < 1e-6);
  }
});

test('resolvePhaseFromHpFraction rejects empty phase arrays', () => {
  assert.throws(() => resolvePhaseFromHpFraction(0.5, []), /non-empty phases array/);
});
