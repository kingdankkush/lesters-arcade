import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  BASE_CRITICAL_CHANCE,
  BASE_CRITICAL_MULTIPLIER,
  CANONICAL_CRIT_UPGRADE_ID,
  CRITICAL_CHANCE_CAP,
  offerAndSelectCanonicalCritUpgrade,
  runLiquidatorUpgradeBenchmark,
} from '../apps/hmh-reboot/src/liquidator-upgrade-benchmark.mjs';
import {
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunXp,
  RUN_UPGRADE_CATALOG,
} from '../apps/hmh-reboot/src/run-progression.mjs';

const CANONICAL_SEED = 1337;
const SECOND_SEED = 14;
const UNOFFERED_SEED = 0;

function digest(report) {
  return JSON.stringify(report);
}

test('canonical crit card is precision-ledger and first-level seed 1337 legally offers it', () => {
  assert.equal(CANONICAL_CRIT_UPGRADE_ID, 'precision-ledger');
  assert.equal(RUN_UPGRADE_CATALOG['precision-ledger'].effect, 'criticalChanceBonus');
  assert.equal(RUN_UPGRADE_CATALOG['precision-ledger'].amount, 0.06);
  const state = createRunProgression({ seed: CANONICAL_SEED });
  grantRunXp(state, 300, 0);
  const offered = getRunProgressionSnapshot(state).pendingChoices.map((choice) => choice.id);
  assert.ok(offered.includes('precision-ledger'), `seed ${CANONICAL_SEED} must legally offer precision-ledger, got ${offered.join(',')}`);
});

test('selecting precision-ledger uses the real offer contract and fails closed when it is not offered', () => {
  const selected = offerAndSelectCanonicalCritUpgrade({ seed: CANONICAL_SEED });
  assert.equal(selected.selected.id, 'precision-ledger');
  assert.equal(selected.selected.rank, 1);
  assert.equal(selected.effects.criticalChanceBonus, 0.06);
  assert.equal(selected.effects.criticalDamageBonus, 0);
  assert.throws(() => offerAndSelectCanonicalCritUpgrade({ seed: UNOFFERED_SEED }), /not currently offered/);
  assert.throws(() => offerAndSelectCanonicalCritUpgrade({ seed: -1 }), /non-negative/);
});

test('unknown mode, partition, and seed fail closed', () => {
  assert.throws(() => runLiquidatorUpgradeBenchmark({ mode: 'hard-fork-rounds' }), /mode must be ordinary or precision-ledger/);
  assert.throws(() => runLiquidatorUpgradeBenchmark({ mode: 'ordinary', partition: 2 }), /partition must be 1 or 4/);
  assert.throws(() => runLiquidatorUpgradeBenchmark({ mode: 'ordinary', seed: -1 }), /non-negative/);
  assert.throws(() => runLiquidatorUpgradeBenchmark({ mode: 'precision-ledger', seed: UNOFFERED_SEED }), /not currently offered/);
});

test('ordinary pistol remains viable and precision-ledger is a bounded crit uplift', () => {
  const ordinary = runLiquidatorUpgradeBenchmark({ mode: 'ordinary', seed: CANONICAL_SEED });
  const upgraded = runLiquidatorUpgradeBenchmark({ mode: 'precision-ledger', seed: CANONICAL_SEED });

  assert.equal(ordinary.weaponId, 'coin-blaster');
  assert.equal(upgraded.weaponId, 'coin-blaster');
  assert.equal(ordinary.upgradeId, null);
  assert.equal(upgraded.upgradeId, 'precision-ledger');
  assert.deepEqual(upgraded.offeredIds, ['precision-ledger', 'gas-optimization']);
  assert.equal(ordinary.criticalChance, BASE_CRITICAL_CHANCE);
  assert.equal(ordinary.criticalMultiplier, BASE_CRITICAL_MULTIPLIER);
  assert.equal(upgraded.criticalChance, BASE_CRITICAL_CHANCE + 0.06);
  assert.equal(upgraded.criticalMultiplier, BASE_CRITICAL_MULTIPLIER);
  assert.ok(upgraded.criticalChance < CRITICAL_CHANCE_CAP);

  assert.equal(ordinary.defeated, true);
  assert.equal(upgraded.defeated, true);
  assert.equal(ordinary.remainingHealth, 0);
  assert.equal(upgraded.remainingHealth, 0);
  assert.equal(ordinary.defeatTick, 2_837);
  assert.equal(upgraded.defeatTick, 2_721);
  assert.equal(ordinary.criticalHits, 217);
  assert.equal(upgraded.criticalHits, 371);
  assert.equal(ordinary.punishContacts, 60);
  assert.equal(upgraded.punishContacts, 60);
  assert.ok(upgraded.defeatTick < ordinary.defeatTick, 'one Precision Ledger rank must pull TTK forward');
  assert.ok(upgraded.criticalHits > ordinary.criticalHits);
  assert.ok(upgraded.criticalHits < upgraded.ordinaryHits, 'crits stay a spike, not the baseline');
  assert.equal(ordinary.roleMultiplier, 1);
  assert.equal(upgraded.roleMultiplier, 1);
  assert.equal(ordinary.bossX, 0);
  assert.equal(ordinary.bossY, 0);
  assert.equal(upgraded.bossX, ordinary.bossX);
  assert.equal(upgraded.bossY, ordinary.bossY);
});

test('same seed is equal and one-step matches four-catch-up', () => {
  const a = runLiquidatorUpgradeBenchmark({ mode: 'precision-ledger', seed: CANONICAL_SEED, partition: 1 });
  const b = runLiquidatorUpgradeBenchmark({ mode: 'precision-ledger', seed: CANONICAL_SEED, partition: 1 });
  const four = runLiquidatorUpgradeBenchmark({ mode: 'precision-ledger', seed: CANONICAL_SEED, partition: 4 });
  assert.equal(digest(a), digest(b));
  assert.equal(a.defeatTick, four.defeatTick);
  assert.equal(a.criticalHits, four.criticalHits);
  assert.equal(a.punishContacts, four.punishContacts);
  assert.deepEqual(a.perPhaseDamage, four.perPhaseDamage);
  assert.deepEqual(a.phases, four.phases);
});

test('different legal seeds diverge and source order does not change the offer', () => {
  const first = runLiquidatorUpgradeBenchmark({ mode: 'precision-ledger', seed: CANONICAL_SEED });
  const second = runLiquidatorUpgradeBenchmark({ mode: 'precision-ledger', seed: SECOND_SEED });
  assert.equal(first.upgradeId, 'precision-ledger');
  assert.equal(second.upgradeId, 'precision-ledger');
  assert.notEqual(digest(first), digest(second));
  assert.notEqual(first.criticalHits, second.criticalHits);

  const state = createRunProgression({ seed: CANONICAL_SEED });
  grantRunXp(state, 300, 0);
  const offered = getRunProgressionSnapshot(state).pendingChoices.map((choice) => choice.id);
  assert.deepEqual(offered, first.offeredIds);
});

test('the seam uses the live combat resolver and does not inject ranks or import main', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/liquidator-upgrade-benchmark.mjs', import.meta.url), 'utf8');
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /selectRunUpgrade/);
  assert.match(source, /resolveCombatHits/);
  assert.match(source, /applyLiquidatorDamage/);
  assert.match(source, /stepLiquidatorBoss/);
  assert.doesNotMatch(source, /ranks\[.precision-ledger.\]\s*=/);
  assert.doesNotMatch(source, /from '\.\/main\.mjs'/);
  assert.doesNotMatch(main, /liquidator-upgrade-benchmark/);
  assert.match(main, /CRITICAL_CHANCE_CAP\s*=\s*0\.45/);
  assert.match(main, /BASE_CRITICAL_CHANCE\s*=\s*0\.08/);
  assert.match(main, /BASE_CRITICAL_MULTIPLIER\s*=\s*1\.75/);
  assert.equal(CRITICAL_CHANCE_CAP, 0.45);
  assert.equal(BASE_CRITICAL_CHANCE, 0.08);
  assert.equal(BASE_CRITICAL_MULTIPLIER, 1.75);
});
