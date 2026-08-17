import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIQUIDATOR_PUNISH_WINDOW_MULTIPLIER,
  LIQUIDATOR_ROLE_CHECK_MULTIPLIER,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import {
  LIQUIDATOR_BUILD_PROFILES,
  runLiquidatorBuildMatrix,
} from '../apps/hmh-reboot/src/liquidator-build-matrix.mjs';

function digest(report) {
  return JSON.stringify(report);
}

test('build profiles stay frozen and reuse existing weapon identities', () => {
  assert.deepEqual(Object.keys(LIQUIDATOR_BUILD_PROFILES), ['no-hit', 'baseline', 'high-dps', 'low-dps']);
  assert.ok(Object.isFrozen(LIQUIDATOR_BUILD_PROFILES));
  assert.equal(LIQUIDATOR_BUILD_PROFILES.baseline.weaponId, 'coin-blaster');
  assert.equal(LIQUIDATOR_BUILD_PROFILES['high-dps'].weaponId, 'hash-rail');
  assert.equal(LIQUIDATOR_BUILD_PROFILES['high-dps'].distance, 480);
  assert.equal(LIQUIDATOR_BUILD_PROFILES.baseline.damagePerTick, 4);
  assert.equal(LIQUIDATOR_BUILD_PROFILES['high-dps'].damagePerTick, 20);
  assert.equal(LIQUIDATOR_BUILD_PROFILES['low-dps'].damagePerTick, 2);
});

test('unknown build, partition, and seed fail closed', () => {
  assert.throws(() => runLiquidatorBuildMatrix({ buildId: 'melee-heavy' }), /unknown liquidator build/);
  assert.throws(() => runLiquidatorBuildMatrix({ buildId: 'baseline', partition: 2 }), /partition must be 1 or 4/);
  assert.throws(() => runLiquidatorBuildMatrix({ buildId: 'baseline', seed: -1 }), /non-negative/);
});

test('no-hit, baseline, high-dps, and low-dps produce distinct Liquidator outcomes', () => {
  const none = runLiquidatorBuildMatrix({ buildId: 'no-hit', seed: 1337 });
  const baseline = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337 });
  const high = runLiquidatorBuildMatrix({ buildId: 'high-dps', seed: 1337 });
  const low = runLiquidatorBuildMatrix({ buildId: 'low-dps', seed: 1337 });

  assert.equal(none.defeated, false);
  assert.equal(none.defeatTick, null);
  assert.equal(none.remainingHealth, 12_000);
  assert.equal(none.punishContacts, 0);
  assert.equal(none.perPhaseDamage['market-open'], 0);

  assert.equal(baseline.defeated, true);
  assert.equal(baseline.defeatTick, 2_994);
  assert.equal(baseline.remainingHealth, 0);
  assert.equal(baseline.roleMultiplier, 1);
  assert.ok(baseline.punishContacts > 0);
  assert.ok(baseline.addCount >= 3);
  assert.ok(baseline.perPhaseDamage['market-open'] > 0);
  assert.ok(baseline.perPhaseDamage['margin-call'] > 0);
  assert.ok(baseline.perPhaseDamage['total-liquidation'] > 0);

  assert.equal(high.defeated, true);
  assert.equal(high.defeatTick, 522);
  assert.equal(high.roleMultiplier, LIQUIDATOR_ROLE_CHECK_MULTIPLIER);
  assert.equal(high.punishContacts, 0);
  assert.equal(high.addCount, 0);
  assert.equal(high.perPhaseDamage['margin-call'], 0);
  assert.ok(high.defeatTick < baseline.defeatTick);

  assert.equal(low.defeated, false);
  assert.equal(low.defeatTick, null);
  assert.equal(low.remainingHealth, 4_788);
  assert.ok(low.punishContacts > 0);
  assert.ok(low.addCount >= 3);
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

test('phase timeline records entry, exit, and damage without rewriting boss authority', () => {
  const baseline = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337 });
  assert.deepEqual(baseline.phases.map((phase) => [phase.id, phase.entryTick]), [
    ['market-open', 1],
    ['margin-call', 1_200],
    ['total-liquidation', 2_400],
  ]);
  assert.equal(baseline.phases[0].exitTick, 1_199);
  assert.equal(baseline.phases[1].exitTick, 2_399);
  assert.equal(baseline.phases[2].exitTick, 2_994);
  assert.equal(baseline.phases[0].damage, baseline.perPhaseDamage['market-open']);
  assert.equal(baseline.phases[1].damage, baseline.perPhaseDamage['margin-call']);
  assert.equal(baseline.phases[2].damage, baseline.perPhaseDamage['total-liquidation']);
  assert.equal(
    baseline.perPhaseDamage['market-open']
      + baseline.perPhaseDamage['margin-call']
      + baseline.perPhaseDamage['total-liquidation'],
    12_000,
  );
});

test('punish window stays 1.1 on ticks 0-59 and role check stays 1.15', () => {
  assert.equal(LIQUIDATOR_PUNISH_WINDOW_MULTIPLIER, 1.1);
  assert.equal(LIQUIDATOR_ROLE_CHECK_MULTIPLIER, 1.15);
  const high = runLiquidatorBuildMatrix({ buildId: 'high-dps', seed: 1337 });
  assert.equal(high.roleMultiplier, 1.15);
  const baseline = runLiquidatorBuildMatrix({ buildId: 'baseline', seed: 1337 });
  assert.equal(baseline.punishContacts, 60);
});
