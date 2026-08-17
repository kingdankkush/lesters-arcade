import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CRITICAL_LIQUIDATOR_BUILD_IDS,
  runCriticalLiquidatorBenchmark,
} from '../apps/hmh-reboot/src/critical-liquidator-benchmark.mjs';

const CANONICAL_SEED = 1337;
const SECOND_LEGAL_SEED = 10;

function comparable(report) {
  const { partition: _partition, ...rest } = report;
  return rest;
}

test('critical Liquidator builds select opposite cards from one canonical first-level offer', () => {
  assert.deepEqual(CRITICAL_LIQUIDATOR_BUILD_IDS, ['mobility-control', 'precision-ledger']);
  const control = runCriticalLiquidatorBenchmark({ buildId: 'mobility-control', seed: CANONICAL_SEED });
  const critical = runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: CANONICAL_SEED });

  assert.deepEqual(control.offeredUpgradeIds, ['precision-ledger', 'gas-optimization']);
  assert.deepEqual(critical.offeredUpgradeIds, control.offeredUpgradeIds);
  assert.equal(control.selectedUpgradeId, 'gas-optimization');
  assert.equal(critical.selectedUpgradeId, 'precision-ledger');
  assert.equal(control.selectedRank, 1);
  assert.equal(critical.selectedRank, 1);
  assert.equal(control.criticalChance, 0.08);
  assert.equal(critical.criticalChance, 0.14);
  assert.equal(control.criticalMultiplier, 1.75);
  assert.equal(critical.criticalMultiplier, 1.75);
});

test('Precision Ledger gives a bounded real-cadence uplift through combat and Liquidator authority', () => {
  const control = runCriticalLiquidatorBenchmark({ buildId: 'mobility-control', seed: CANONICAL_SEED });
  const critical = runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: CANONICAL_SEED });

  assert.equal(control.weaponId, 'coin-blaster');
  assert.ok(control.shotsFired > 0);
  assert.ok(control.shotsFired < control.durationTicks / 2, 'the benchmark must use weapon cadence, not inject a hit every tick');
  assert.equal(control.shotsFired, control.contactHits);
  assert.equal(critical.shotsFired, control.shotsFired);
  assert.equal(critical.reloadStarts, control.reloadStarts);
  assert.equal(critical.reloadCompletes, control.reloadCompletes);
  assert.ok(control.reloadStarts > 0);
  assert.ok(critical.criticalHits > control.criticalHits);
  assert.ok(critical.totalDamage > control.totalDamage);
  assert.ok(critical.totalDamage < control.totalDamage * 1.15, 'one crit rank must remain a bounded spike');
  assert.ok(control.totalDamage > 0, 'ordinary pistol must remain non-vacuously viable');
  assert.equal(control.defeated, false);
  assert.equal(critical.defeated, false);
  assert.equal(control.totalDamage, 12_000 - control.remainingHealth);
  assert.equal(critical.totalDamage, 12_000 - critical.remainingHealth);
  assert.equal(control.roleMultiplier, 1);
  assert.equal(critical.roleMultiplier, 1);
  assert.ok(control.punishContacts > 0, 'the final-phase recovery window must be exercised');
  assert.equal(critical.punishContacts, control.punishContacts);
  assert.ok(control.punishDamage > 0);
  assert.equal(control.addCount, critical.addCount);
});

test('critical Liquidator benchmark is same-seed equal and 60/30/20 partition invariant', () => {
  for (const buildId of CRITICAL_LIQUIDATOR_BUILD_IDS) {
    const sixty = runCriticalLiquidatorBenchmark({ buildId, seed: CANONICAL_SEED, partition: 1 });
    const again = runCriticalLiquidatorBenchmark({ buildId, seed: CANONICAL_SEED, partition: 1 });
    const thirty = runCriticalLiquidatorBenchmark({ buildId, seed: CANONICAL_SEED, partition: 2 });
    const twenty = runCriticalLiquidatorBenchmark({ buildId, seed: CANONICAL_SEED, partition: 3 });
    assert.deepEqual(sixty, again);
    assert.deepEqual(comparable(sixty), comparable(thirty));
    assert.deepEqual(comparable(sixty), comparable(twenty));
  }
});

test('different legal seeds diverge while retaining the same canonical offer', () => {
  const first = runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: CANONICAL_SEED });
  const second = runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: SECOND_LEGAL_SEED });
  assert.deepEqual(first.offeredUpgradeIds, second.offeredUpgradeIds);
  assert.notEqual(first.criticalHits, second.criticalHits);
  assert.notEqual(first.totalDamage, second.totalDamage);
});

test('critical Liquidator benchmark fails closed for malformed or noncanonical requests', () => {
  assert.throws(() => runCriticalLiquidatorBenchmark({ buildId: 'guaranteed-crit', seed: CANONICAL_SEED }), /unknown critical Liquidator build/);
  assert.throws(() => runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: 0 }), /canonical first-level offer/);
  assert.throws(() => runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: -1 }), /non-negative integer/);
  assert.throws(() => runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: CANONICAL_SEED, partition: 0 }), /partition must be 1, 2, 3, or 4/);
  assert.throws(() => runCriticalLiquidatorBenchmark({ buildId: 'precision-ledger', seed: CANONICAL_SEED, durationTicks: 0 }), /durationTicks/);
});

test('benchmark source composes canonical progression, weapon, combat, punish, and boss seams only', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/critical-liquidator-benchmark.mjs', import.meta.url), 'utf8');
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /selectRunUpgrade/);
  assert.match(source, /stepWeaponLoadout/);
  assert.match(source, /resolveCombatHits/);
  assert.match(source, /getLiquidatorRoleCheck/);
  assert.match(source, /getLiquidatorPunishWindow/);
  assert.match(source, /applyLiquidatorDamage/);
  assert.doesNotMatch(source, /from '\.\/main\.mjs'/);
  assert.doesNotMatch(main, /critical-liquidator-benchmark/);
});
