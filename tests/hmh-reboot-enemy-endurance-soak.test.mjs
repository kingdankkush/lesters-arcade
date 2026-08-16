import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runEnemyEnduranceSoak,
} from '../scripts/hmh-reboot-enemy-endurance-soak.mjs';
import {
  RUNTIME_PRESSURE_LIMITS,
} from '../apps/hmh-reboot/src/runtime-performance.mjs';

const INPUT = Object.freeze({
  seed: 1337,
  activeEnemies: 128,
  cycles: 2,
  ticksPerCycle: 180,
});

test('100+ body endurance soak reports truthful independent pressure maxima and two recurring cycles', () => {
  const report = runEnemyEnduranceSoak(INPUT);

  assert.equal(report.activeEnemies, 128);
  assert.equal(report.cyclesCompleted, 2);
  assert.equal(report.ticksSimulated, 360);
  assert.equal(report.totals.safetySteps, report.activeEnemies * report.ticksSimulated);
  assert.equal(report.maxima.bodies, report.activeEnemies);
  assert.ok(report.maxima.bodies <= report.limits.bodies);
  assert.ok(report.maxima.threat > 0 && report.maxima.threat <= report.limits.threat);
  assert.ok(report.totals.collisionContacts > 0, 'the blocker fixture must be exercised non-vacuously');
  assert.equal(report.totals.teleportViolations, 0);
  assert.ok(report.maxima.enemyStepDistance <= report.limits.maxEnemyStepDistance + 1e-9);

  assert.ok(report.maxima.attackTokens > 0);
  assert.ok(report.maxima.attackTokens <= report.limits.attackTokens);
  for (const family of ['melee', 'ranged', 'area', 'support']) {
    assert.ok(report.maxima.attackTokensByFamily[family] > 0, `${family} token occupancy must be exercised`);
    assert.ok(report.maxima.attackTokensByFamily[family] <= report.limits.attackTokensByFamily[family]);
  }
  assert.ok(report.maxima.projectiles > 0);
  assert.ok(report.maxima.projectiles <= RUNTIME_PRESSURE_LIMITS.projectiles);
  assert.ok(report.maxima.effects > 0);
  assert.ok(report.maxima.effects <= RUNTIME_PRESSURE_LIMITS.combatVisualEvents);
  assert.equal(report.limits.projectiles, RUNTIME_PRESSURE_LIMITS.projectiles);
  assert.equal(report.limits.effects, RUNTIME_PRESSURE_LIMITS.combatVisualEvents);
  assert.ok(report.limits.projectiles <= report.limits.directorProjectiles);
  assert.ok(report.limits.effects <= report.limits.directorEffects);

  assert.equal(report.cycles.length, 2);
  for (const cycle of report.cycles) {
    assert.ok(cycle.attackEvents > 0, `cycle ${cycle.cycle} must contain recurring attacks`);
    assert.ok(cycle.projectilePeak > 0, `cycle ${cycle.cycle} must exercise projectile pressure`);
    assert.ok(cycle.effectPeak > 0, `cycle ${cycle.cycle} must exercise effect pressure`);
  }
});

test('endurance soak is same-seed deterministic, different-seed divergent, and four-catch-up partition invariant', () => {
  const first = runEnemyEnduranceSoak({ ...INPUT, fixedStepsPerFrame: 1 });
  const repeat = runEnemyEnduranceSoak({ ...INPUT, fixedStepsPerFrame: 1 });
  const lowFps = runEnemyEnduranceSoak({ ...INPUT, fixedStepsPerFrame: 4 });
  const differentSeed = runEnemyEnduranceSoak({ ...INPUT, seed: INPUT.seed + 1, fixedStepsPerFrame: 4 });

  assert.deepEqual(repeat, first);
  assert.deepEqual(lowFps, first, 'four fixed-step catch-up frames must not skip blocker or safety authority');
  assert.notEqual(differentSeed.stateDigest, first.stateDigest);
  assert.notDeepEqual(differentSeed.seedSignature, first.seedSignature);
  assert.equal(differentSeed.totals.safetySteps, first.totals.safetySteps);
  assert.equal(differentSeed.totals.teleportViolations, 0);
});

test('endurance soak fails closed outside the certified body, seed, cycle, and catch-up contract', () => {
  assert.throws(() => runEnemyEnduranceSoak({ ...INPUT, activeEnemies: 99 }), /activeEnemies/);
  assert.throws(() => runEnemyEnduranceSoak({ ...INPUT, activeEnemies: 193 }), /activeEnemies/);
  assert.throws(() => runEnemyEnduranceSoak({ ...INPUT, seed: -1 }), /seed/);
  assert.throws(() => runEnemyEnduranceSoak({ ...INPUT, cycles: 0 }), /cycles/);
  assert.throws(() => runEnemyEnduranceSoak({ ...INPUT, fixedStepsPerFrame: 5 }), /four-step catch-up cap/);
});
