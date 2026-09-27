import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIQUIDATOR_BENCHMARK_MAX_HEALTH,
  LIQUIDATOR_ROLE_CHECK_MULTIPLIER,
  LIQUIDATOR_TARGET_FIGHT_TICKS,
  LIQUIDATOR_VULNERABLE_MULTIPLIER,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { referenceDps } from '../apps/hmh-reboot/src/boss-reference-dps.mjs';
import { hmhV7BossHp } from '../sdk/hmh-run-contract-v7.mjs';
import {
  LIQUIDATOR_BUILD_PROFILES,
  runLiquidatorBuildMatrix,
} from '../apps/hmh-reboot/src/liquidator-build-matrix.mjs';

function digest(report) {
  return JSON.stringify(report);
}

test('build profiles stay frozen and reuse existing weapon identities', () => {
  assert.deepEqual(Object.keys(LIQUIDATOR_BUILD_PROFILES), [
    'no-hit', 'baseline', 'high-dps', 'low-dps', 'melee-heavy', 'crowd-control',
  ]);
  assert.ok(Object.isFrozen(LIQUIDATOR_BUILD_PROFILES));
  assert.equal(LIQUIDATOR_BUILD_PROFILES.baseline.weaponId, 'coin-blaster');
  assert.equal(LIQUIDATOR_BUILD_PROFILES['high-dps'].weaponId, 'hash-rail');
  assert.equal(LIQUIDATOR_BUILD_PROFILES['high-dps'].distance, 480);
  assert.equal(LIQUIDATOR_BUILD_PROFILES.baseline.damagePerTick, 4);
  assert.equal(LIQUIDATOR_BUILD_PROFILES['high-dps'].damagePerTick, 20);
  assert.equal(LIQUIDATOR_BUILD_PROFILES['low-dps'].damagePerTick, 2);
});

test('unknown build, partition, and seed fail closed', () => {
  assert.throws(() => runLiquidatorBuildMatrix({ buildId: 'overclocked' }), /unknown liquidator build/);
  assert.throws(() => runLiquidatorBuildMatrix({ buildId: 'baseline', partition: 2 }), /partition must be 1 or 4/);
  assert.throws(() => runLiquidatorBuildMatrix({ buildId: 'baseline', seed: -1 }), /non-negative/);
});

// S1.5: the benchmark fights a Dark Pool start (no intro) at the Level 21 HP
// over the 150 s target; phases change at 66% and 33% HP, with halts.
test('the benchmark boss is the Level 21 Liquidator over the 150-second target', () => {
  assert.equal(LIQUIDATOR_BENCHMARK_MAX_HEALTH, hmhV7BossHp('liquidator', referenceDps(21)));
  assert.equal(LIQUIDATOR_TARGET_FIGHT_TICKS, 9_000);
});

test('no-hit, baseline, high-dps, and low-dps produce distinct Liquidator outcomes', () => {
  const none = runLiquidatorBuildMatrix({ buildId: 'no-hit', seed: 1337 });
  const baseline = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337 });
  const high = runLiquidatorBuildMatrix({ buildId: 'high-dps', seed: 1337 });
  const low = runLiquidatorBuildMatrix({ buildId: 'low-dps', seed: 1337 });

  assert.equal(none.defeated, false);
  assert.equal(none.defeatTick, null);
  assert.equal(none.remainingHealth, LIQUIDATOR_BENCHMARK_MAX_HEALTH);
  assert.equal(none.punishContacts, 0);
  assert.equal(none.perPhaseDamage['market-open'], 0);
  assert.deepEqual(none.phases.map((phase) => phase.id), ['market-open'], 'no damage, no phase change');

  assert.equal(baseline.defeated, true);
  assert.equal(baseline.defeatTick, 1_236);
  assert.equal(baseline.remainingHealth, 0);
  assert.equal(baseline.roleMultiplier, 1);
  assert.ok(baseline.punishContacts > 0);

  assert.equal(high.defeated, true);
  assert.equal(high.defeatTick, 373);
  assert.equal(high.roleMultiplier, LIQUIDATOR_ROLE_CHECK_MULTIPLIER);
  assert.ok(high.defeatTick < baseline.defeatTick);
  // Even an overwhelming build waits out two Trading Halts.
  assert.ok(high.defeatTick >= 2 * 91);

  assert.equal(low.defeated, true);
  assert.equal(low.defeatTick, 2_394);
  assert.ok(low.defeatTick > baseline.defeatTick);
  assert.ok(low.addCount >= 2, 'a long Margin Call brings the Enforcement Order');
  for (const report of [baseline, high, low]) {
    assert.deepEqual(report.phases.map((phase) => phase.id), ['market-open', 'margin-call', 'total-liquidation']);
    assert.equal(report.perPhaseDamage['market-open'] + report.perPhaseDamage['margin-call'] + report.perPhaseDamage['total-liquidation'], LIQUIDATOR_BENCHMARK_MAX_HEALTH);
  }
});

test('same seed is equal and one-step matches four-catch-up', () => {
  const a = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337, partition: 1 });
  const b = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337, partition: 1 });
  const four = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337, partition: 4 });
  assert.equal(digest(a), digest(b));
  assert.equal(a.defeatTick, four.defeatTick);
  assert.equal(a.punishContacts, four.punishContacts);
  assert.equal(a.addCount, four.addCount);
  assert.deepEqual(a.perPhaseDamage, four.perPhaseDamage);
  assert.deepEqual(a.phases, four.phases);
});

test('phase timeline records entry, exit, and damage at the HP thresholds', () => {
  const baseline = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337 });
  assert.deepEqual(baseline.phases.map((phase) => [phase.id, phase.entryTick, phase.exitTick]), [
    ['market-open', 1, 320],
    ['margin-call', 321, 793],
    ['total-liquidation', 794, 1_236],
  ]);
  // The thresholds split 4,635 HP at 66% and 33%: 1,576, 1,529 and 1,530.
  assert.deepEqual(baseline.perPhaseDamage, { 'market-open': 1_576, 'margin-call': 1_529, 'total-liquidation': 1_530 });
  for (const phase of baseline.phases) assert.equal(phase.damage, baseline.perPhaseDamage[phase.id]);
});

test('melee-heavy Forked Standard close-punish beats the pistol baseline', () => {
  const melee = runLiquidatorBuildMatrix({ buildId: 'melee-heavy', seed: 1337 });
  const baseline = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337 });
  assert.equal(melee.weaponId, 'forked-standard');
  assert.equal(melee.roleMultiplier, LIQUIDATOR_ROLE_CHECK_MULTIPLIER);
  assert.equal(melee.defeated, true);
  assert.equal(melee.defeatTick, 1_153);
  assert.ok(melee.defeatTick < baseline.defeatTick);
  assert.equal(melee.addRoleContacts, 0);
  assert.ok(melee.perPhaseDamage['total-liquidation'] > 0);
});

test('crowd-control Ledger applies add-clear only once the Enforcement Order brings adds', () => {
  const crowd = runLiquidatorBuildMatrix({ buildId: 'crowd-control', seed: 1337 });
  const low = runLiquidatorBuildMatrix({ buildId: 'low-dps', seed: 1337 });
  assert.equal(crowd.weaponId, 'lightning-ledger');
  assert.equal(crowd.roleMultiplier, 1);
  assert.equal(crowd.defeated, low.defeated);
  assert.equal(crowd.defeatTick, low.defeatTick);
  assert.equal(crowd.remainingHealth, low.remainingHealth);
  assert.equal(crowd.punishContacts, low.punishContacts);
  assert.ok(crowd.addCount >= 2);
  assert.ok(crowd.addRoleContacts > 0);
  assert.equal(low.addRoleContacts, 0);
  assert.ok(crowd.addRoleContacts < crowd.defeatTick);
});

test('melee-heavy and crowd-control stay partition invariant', () => {
  for (const buildId of ['melee-heavy', 'crowd-control']) {
    const one = runLiquidatorBuildMatrix({ buildId, seed: 1337, partition: 1 });
    const four = runLiquidatorBuildMatrix({ buildId, seed: 1337, partition: 4 });
    assert.equal(one.defeatTick, four.defeatTick);
    assert.equal(one.remainingHealth, four.remainingHealth);
    assert.equal(one.punishContacts, four.punishContacts);
    assert.equal(one.addCount, four.addCount);
    assert.equal(one.addRoleContacts, four.addRoleContacts);
    assert.deepEqual(one.perPhaseDamage, four.perPhaseDamage);
  }
});

test('the vulnerability windows are x1.25 and the role check stays 1.15', () => {
  assert.equal(LIQUIDATOR_VULNERABLE_MULTIPLIER, 1.25);
  assert.equal(LIQUIDATOR_ROLE_CHECK_MULTIPLIER, 1.15);
  const high = runLiquidatorBuildMatrix({ buildId: 'high-dps', seed: 1337 });
  assert.equal(high.roleMultiplier, 1.15);
  const baseline = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337 });
  // 300 Insider Trading ticks, and a 120-tick kneel after the first Total
  // Liquidation super.
  assert.equal(baseline.punishContacts, 420);
});
