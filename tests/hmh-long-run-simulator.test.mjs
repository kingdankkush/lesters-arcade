import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LONG_RUN_CHECKPOINT_SECONDS,
  HMH_LONG_RUN_ENEMY_IDS,
  HMH_LONG_RUN_HERO_IDS,
  HMH_LONG_RUN_WEAPON_IDS,
  buildHmhCombatMatrixCertification,
  buildHmhLongRunCertification,
  simulateHmhLongRun,
} from '../apps/portal/src/hmh-long-run-simulator.mjs';

function assertFiniteTree(value, path = 'root') {
  if (typeof value === 'number') {
    assert.equal(Number.isFinite(value), true, `${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFiniteTree(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) assertFiniteTree(entry, `${path}.${key}`);
  }
}

test('canonical long-run writer publishes combat matrix and progression telemetry', () => {
  const source = readFileSync(new URL('../scripts/hmh-long-run-certification.mjs', import.meta.url), 'utf8');
  assert.match(source, /buildHmhCombatMatrixCertification/);
  assert.match(source, /Levels per minute/);
  assert.match(source, /Choices seen/);
  assert.match(source, /Dead offers/);
  assert.match(source, /Damage growth/);
  assert.match(source, /Survival/);
  assert.match(source, /Median upgrade interval/);
  assert.match(source, /encounterBandEvidence/);
  assert.match(source, /Spawn \/ min/);
  assert.match(source, /Role weights/);
  assert.match(source, /matrixCertification\.runs\.map/);
});

test('long-run simulator is deterministic for the same hero seed and duration', () => {
  const input = { heroId: 'lit-commando', seed: 1337, durationSeconds: 30 * 60 };
  const first = simulateHmhLongRun(input);
  const second = simulateHmhLongRun(input);

  assert.deepEqual(first, second);
  assert.equal(first.terminalReason, 'time-limit');
  assert.deepEqual(first.checkpoints.map((entry) => entry.elapsedSeconds), HMH_LONG_RUN_CHECKPOINT_SECONDS.filter((seconds) => seconds <= input.durationSeconds));
  assert.ok(first.final.kills > 0);
  assert.ok(first.final.score > first.final.kills);
  assert.ok(first.final.level >= 20 && first.final.level <= 80);
  assert.ok(first.progression.levelsPerMinute > 0);
  assert.ok(first.progression.choicesSeen.length > 0);
  assert.equal(first.progression.draftCount, first.final.upgradesTaken);
  assert.equal(Number.isInteger(first.progression.deadOfferCount), true);
  assert.ok(first.progression.uniqueUpgrades > 0);
  assert.ok(first.progression.damageGrowth.finalExpectedHit >= first.progression.damageGrowth.startExpectedHit);
  assert.ok(first.progression.upgradeTiming.firstUpgradeSecond > 0);
  assert.ok(first.progression.upgradeTiming.medianSecondsBetweenUpgrades >= 0);
  assert.ok(first.survivability.healthRatio >= 0 && first.survivability.healthRatio <= 1);
  assertFiniteTree(first);
});

test('combat matrix covers every authoritative hero weapon and enemy combination', () => {
  const report = buildHmhCombatMatrixCertification({ seeds: [4101], durationSeconds: 5 * 60 });
  assert.equal(report.runs.length, HMH_LONG_RUN_HERO_IDS.length * HMH_LONG_RUN_WEAPON_IDS.length * HMH_LONG_RUN_ENEMY_IDS.length);
  assert.deepEqual(new Set(report.runs.map((run) => run.heroId)), new Set(HMH_LONG_RUN_HERO_IDS));
  assert.deepEqual(new Set(report.runs.map((run) => run.weaponId)), new Set(HMH_LONG_RUN_WEAPON_IDS));
  assert.deepEqual(new Set(report.runs.map((run) => run.enemyArchetypeId)), new Set(HMH_LONG_RUN_ENEMY_IDS));
  assert.equal(report.summary.invalidRuns, 0);
  assert.equal(report.summary.combinations, HMH_LONG_RUN_HERO_IDS.length * HMH_LONG_RUN_WEAPON_IDS.length * HMH_LONG_RUN_ENEMY_IDS.length);
  for (const run of report.runs) {
    assert.ok(run.progression.levelsPerMinute >= 0);
    assert.ok(Array.isArray(run.progression.choicesSeen));
    assert.equal(Number.isInteger(run.progression.deadOfferCount), true);
    assert.ok(run.progression.damageGrowth.finalExpectedHit > 0);
    assert.ok(run.survivability.healthRatio >= 0 && run.survivability.healthRatio <= 1);
  }
  assert.ok(report.runs
    .filter((run) => run.enemyArchetypeId === 'validator-cultist')
    .every((run) => run.survivability.damageTaken === 0));
});

test('different seeds produce distinct but bounded Level 1 runs', () => {
  const first = simulateHmhLongRun({ heroId: 'lester-original', seed: 11, durationSeconds: 20 * 60 });
  const second = simulateHmhLongRun({ heroId: 'lester-original', seed: 12, durationSeconds: 20 * 60 });

  assert.notEqual(first.digest, second.digest);
  assert.notDeepEqual(first.final, second.final);
  for (const run of [first, second]) {
    assert.ok(run.maxima.activeEnemies <= run.limits.maxEnemies);
    assert.ok(run.maxima.looseXpGems <= run.limits.maxLooseXpGems);
    assert.ok(run.maxima.loosePowerUps <= run.limits.maxLoosePowerUps);
    assert.ok(run.maxima.projectiles <= run.limits.maxProjectiles);
  }
});

test('30-minute certification covers ten seeds for all four heroes with viable spread', () => {
  const report = buildHmhLongRunCertification({
    seeds: Array.from({ length: 10 }, (_, index) => 1337 + index),
    durationSeconds: 30 * 60,
  });

  assert.deepEqual(report.heroIds, HMH_LONG_RUN_HERO_IDS);
  assert.equal(report.runs.length, 40);
  assert.equal(report.summary.invalidRuns, 0);
  assert.equal(report.summary.completedRuns, 40);
  assert.ok(report.summary.scoreSpreadPct <= 35, `hero median score spread must stay <=35%, got ${report.summary.scoreSpreadPct}`);
  assert.ok(report.summary.survivalRate >= 0.95, `baseline-player survival rate must be >=95%, got ${report.summary.survivalRate}`);
  assert.ok(report.summary.minimumBossesDefeated >= 4, `every 30-minute run should clear scheduled major bosses, got ${report.summary.minimumBossesDefeated}`);
  assertFiniteTree(report);
});

test('45-minute record-chase simulation remains bounded after level cap', () => {
  const run = simulateHmhLongRun({ heroId: 'lit-valkyrie', seed: 7331, durationSeconds: 45 * 60 });

  assert.equal(run.terminalReason, 'time-limit');
  assert.equal(run.final.elapsedSeconds, 45 * 60);
  assert.ok(run.final.level <= 80);
  if (run.final.level === 80) assert.ok(run.final.postCapScoreBonus > 0);
  assert.ok(run.maxima.activeEnemies <= run.limits.maxEnemies);
  assert.ok(run.maxima.totalTrackedObjects <= run.limits.maxTrackedObjects);
  assertFiniteTree(run);
});
