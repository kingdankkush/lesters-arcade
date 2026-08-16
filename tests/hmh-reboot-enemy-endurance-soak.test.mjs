import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  runEnemyEnduranceSoak,
} from '../scripts/hmh-reboot-enemy-endurance-soak.mjs';
import {
  RUNTIME_PRESSURE_LIMITS,
} from '../apps/hmh-reboot/src/runtime-performance.mjs';
import {
  buildEnduranceEncounterCandidates,
} from '../apps/hmh-reboot/src/encounter-director.mjs';

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

test('browser endurance candidates are deterministic, production-role complete, bounded, and placement-safe', () => {
  const options = {
    count: 128,
    seed: 424242,
    origin: { x: 800, y: 2_400 },
    bounds: { minX: 0, minY: 0, maxX: 12_000, maxY: 4_800 },
    queryGround: (x, y) => ({ kind: x > 1_720 && x < 1_780 ? 'deep-water' : 'ground', groundZ: y > 3_000 ? 16 : 0 }),
    isBlocked: ({ x, y }) => x > 1_400 && x < 1_520 && y > 2_200 && y < 2_600,
  };
  const first = buildEnduranceEncounterCandidates(options);
  const repeat = buildEnduranceEncounterCandidates(options);

  assert.deepEqual(repeat, first);
  assert.equal(first.length, 128);
  assert.equal(new Set(first.map((candidate) => candidate.id)).size, 128);
  assert.deepEqual(
    new Set(first.slice(0, 17).map((candidate) => candidate.requestedRole)),
    new Set(['rusher', 'suppressor', 'demolition', 'support']),
  );
  assert.ok(first.every((candidate) => candidate.x >= options.bounds.minX && candidate.x <= options.bounds.maxX));
  assert.ok(first.every((candidate) => candidate.y >= options.bounds.minY && candidate.y <= options.bounds.maxY));
  assert.ok(first.every((candidate) => options.queryGround(candidate.x, candidate.y).kind !== 'deep-water'));
  assert.ok(first.every((candidate) => !options.isBlocked(candidate)));
  assert.throws(() => buildEnduranceEncounterCandidates({ ...options, count: 193 }), /count/);
});

test('browser endurance gate exercises serial desktop/mobile real-time pressure and fails closed on runtime evidence', () => {
  const source = readFileSync(new URL('../scripts/hmh-reboot-enemy-endurance-browser-smoke.mjs', import.meta.url), 'utf8');
  assert.match(source, /id: 'desktop'/);
  assert.match(source, /id: 'mobile'/);
  assert.match(source, /endurancePressurePilot=1/);
  assert.match(source, /TARGET_ENEMIES = 128/);
  assert.match(source, /MAX_P95_FRAME_MS = 28/);
  assert.match(source, /MIN_MEDIAN_FPS = 45/);
  assert.match(source, /enemyAttackTokensSupport/);
  assert.match(source, /simulationCatchUpSaturationFrames/);
  assert.match(source, /consoleIssues\.length/);
  assert.match(source, /networkIssues\.length/);
  assert.match(source, /page\.screenshot/);
});
