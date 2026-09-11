import assert from 'node:assert/strict';
import test from 'node:test';
import { runOpeningCombatBenchmark } from '../scripts/hmh-reboot-opening-balance-benchmark.mjs';

const benchmark = runOpeningCombatBenchmark();

test('spawn, damage and progression measurements repeat exactly for the same seed', () => {
  assert.deepEqual(runOpeningCombatBenchmark(), benchmark);
  assert.equal(benchmark.rows.length, 208);
});

test('a first-minute pistol magazine is enough for at least four ordinary enemies', () => {
  const opening = benchmark.rows.filter((row) => row.spawnMinute === 0 && row.weaponId === 'coin-blaster' && row.tier === 'base');
  assert.equal(opening.length, 2);
  for (const row of opening) {
    assert.ok(row.shots >= 1 && row.shots <= 2, `${row.archetypeId}: ${row.shots}`);
    assert.equal(row.reloadSeconds, 0);
    assert.ok(row.killSeconds > 0 && row.killSeconds <= 0.35);
  }
});

test('first upgrade arrives early while the first minute leaves room for later growth', () => {
  const { current, previous } = benchmark.firstMinute;
  assert.ok(current.firstUpgradeSeconds >= 10 && current.firstUpgradeSeconds < 15);
  assert.ok(current.firstUpgradeSeconds < previous.firstUpgradeSeconds);
  assert.ok(current.level >= 3 && current.level <= 6, `ideal first-minute level ${current.level}`);
  assert.ok(current.kills > previous.kills);
  assert.ok(current.livingEnemies < previous.livingEnemies);
  assert.equal(current.selections.length, current.level - 1);
});

test('role introductions obey the existing time gates even while exploring advanced districts', () => {
  const rolesAt = (minute) => new Set(benchmark.rows.filter((row) => row.spawnMinute === minute).map((row) => row.archetypeId));
  assert.deepEqual([...rolesAt(0)].sort(), ['bagholder-rusher', 'forkrunner']);
  assert.deepEqual([...rolesAt(1)].sort(), ['bagholder-rusher', 'forkrunner', 'liquidator-agent']);
  assert.equal(rolesAt(5).size, 6);
});

test('damage upgrades and close-range heavy weapons provide measured answers to later armor', () => {
  const row = (archetypeId, minute, weaponId, tier) => benchmark.rows.find((entry) => entry.archetypeId === archetypeId && entry.spawnMinute === minute && entry.weaponId === weaponId && entry.tier === tier);
  const basePistol = row('bagholder-rusher', 10, 'coin-blaster', 'base');
  const upgradedPistol = row('bagholder-rusher', 10, 'coin-blaster', 'maxed');
  assert.ok(upgradedPistol.killSeconds < basePistol.killSeconds / 3);
  const whalePistol = row('whale-enforcer', 5, 'coin-blaster', 'base');
  const whaleShotgun = row('whale-enforcer', 5, 'scatter-shotgun', 'base');
  assert.ok(whaleShotgun.killSeconds < whalePistol.killSeconds / 3);
  assert.ok(whaleShotgun.projectiles > whaleShotgun.shots);
});
