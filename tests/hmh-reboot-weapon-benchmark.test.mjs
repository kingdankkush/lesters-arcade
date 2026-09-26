import assert from 'node:assert/strict';
import test from 'node:test';

import { runBenchmark, runOutput60Benchmark, runSwarmBenchmark } from '../scripts/hmh-reboot-weapon-benchmark.mjs';

test('S5 shotgun remains close-range dominant without collapsing at mid-range', () => {
  const rows = runBenchmark();
  const row = (weaponId, range) => rows.find((entry) => entry.weaponId === weaponId && entry.tier === 'base' && entry.range === range);
  const shotgunClose = row('scatter-shotgun', 'close');
  const shotgunMid = row('scatter-shotgun', 'mid');
  const shotgunLong = row('scatter-shotgun', 'long');
  const coinClose = row('coin-blaster', 'close');
  const coinMid = row('coin-blaster', 'mid');
  const shotgunMaxedMid = rows.find((entry) => entry.weaponId === 'scatter-shotgun' && entry.tier === 'maxed' && entry.range === 'mid');
  const launcherMaxedMid = rows.find((entry) => entry.weaponId === 'launcher-rig' && entry.tier === 'maxed' && entry.range === 'mid');
  const shotgunSwarm = runSwarmBenchmark().find((entry) => entry.weaponId === 'scatter-shotgun' && entry.tier === 'base' && entry.packSize === 8);

  assert.ok(shotgunClose.sustainedDps > coinClose.sustainedDps, `${shotgunClose.sustainedDps} must beat ${coinClose.sustainedDps}`);
  assert.ok(shotgunMid.sustainedDps >= coinMid.sustainedDps * 0.85, `${shotgunMid.sustainedDps} must reach 85% of ${coinMid.sustainedDps}`);
  assert.ok(shotgunLong.sustainedDps <= shotgunMid.sustainedDps * 0.25, `${shotgunLong.sustainedDps} must remain a fraction of ${shotgunMid.sustainedDps}`);
  assert.ok(shotgunMaxedMid.sustainedDps <= launcherMaxedMid.sustainedDps * 1.1, `${shotgunMaxedMid.sustainedDps} must not eclipse launcher ${launcherMaxedMid.sustainedDps}`);
  assert.equal(shotgunSwarm.killed, 8);
  assert.notEqual(shotgunSwarm.clearSeconds, null);
});

test('S4 maxed pistol gains authored long-range and crowd-clear identity', () => {
  const rows = runBenchmark();
  const find = (tier, range) => rows.find((entry) => entry.weaponId === 'coin-blaster' && entry.tier === tier && entry.range === range);
  const baseMid = find('base', 'mid');
  const maxedMid = find('maxed', 'mid');
  const baseLong = find('base', 'long');
  const maxedLong = find('maxed', 'long');
  const swarm = runSwarmBenchmark().find((entry) => entry.weaponId === 'coin-blaster' && entry.tier === 'maxed' && entry.packSize === 8);

  assert.ok(maxedMid.sustainedDps > baseMid.sustainedDps);
  assert.ok(maxedLong.contacts > baseLong.contacts);
  assert.ok(maxedLong.sustainedDps > baseLong.sustainedDps);
  assert.equal(swarm.killed, 8);
  assert.notEqual(swarm.clearSeconds, null);
});

// Package 8.2 (S0.3): the Railgun rows and the output60 column (build ledger
// slice 6 review). output60 is the damage landed on living bodies in 60 s
// from a full clip and a full reserve cap against the 8-body pack, replaced
// the tick after it is cleared; the package's acceptance is that every maxed
// finite gun reaches at least the maxed Pistol's figure.
test('the Railgun has static, moving and swarm rows, and a held trigger releases its charge', () => {
  const rows = runBenchmark().filter((entry) => entry.weaponId === 'hash-rail');
  assert.deepEqual(rows.map((entry) => [entry.tier, entry.range]), [['base', 'close'], ['base', 'mid'], ['base', 'long'], ['maxed', 'close'], ['maxed', 'mid'], ['maxed', 'long']]);
  for (const row of rows) {
    assert.ok(row.shotsFired > 0, `${row.tier} ${row.range} fires`);
    assert.equal(row.shotsFired, row.projectilesEmitted, 'one slug per shot');
    assert.ok(row.contacts > 0);
  }
  const base = rows.find((entry) => entry.tier === 'base' && entry.range === 'mid');
  const maxed = rows.find((entry) => entry.tier === 'maxed' && entry.range === 'mid');
  assert.ok(maxed.shotsFired > base.shotsFired, 'Charge Speed and Capacitor Bank fire more slugs in the window');
  assert.ok(runSwarmBenchmark().some((entry) => entry.weaponId === 'hash-rail' && entry.tier === 'maxed' && entry.killed === 8));
});

test('output60 is deterministic and reports the package acceptance per maxed finite gun', () => {
  const rows = runOutput60Benchmark();
  assert.deepEqual(rows, runOutput60Benchmark(), 'same-seed output60 rows');
  assert.deepEqual(rows.map((entry) => `${entry.weaponId}:${entry.tier}`), [
    'coin-blaster:base', 'coin-blaster:maxed', 'scatter-shotgun:base', 'scatter-shotgun:maxed', 'auto-miner:base', 'auto-miner:maxed',
    'launcher-rig:base', 'launcher-rig:maxed', 'hash-rail:base', 'hash-rail:maxed',
  ]);
  for (const row of rows) {
    assert.equal(row.windowSeconds, 60);
    assert.equal(row.packSize, 8);
    assert.ok(Number.isFinite(row.output60) && row.output60 > 0, `${row.weaponId} ${row.tier} lands damage`);
    assert.ok(row.output60 <= row.damageApplied, 'overkill never counts');
    assert.ok(row.output60 + row.overkillDamage - row.damageApplied < 0.01 && row.output60 + row.overkillDamage - row.damageApplied > -0.01);
    assert.equal(row.killed, row.packsCleared * 8 + (row.killed % 8), 'kills are whole packs plus the open one');
  }
  const pistol = rows.find((entry) => entry.weaponId === 'coin-blaster' && entry.tier === 'maxed').output60;
  const acceptance = Object.fromEntries(rows.filter((entry) => entry.tier === 'maxed' && entry.weaponId !== 'coin-blaster').map((entry) => [entry.weaponId, entry.output60 >= pistol]));
  // The finding recorded in the build ledger (slice 6 review): the Shotgun and
  // the Launcher clear the bar; the Machine Gun (heat-bound, 900 rounds left)
  // and the Railgun (charge-bound, 60 slugs left) fall short with ammo to
  // spare, so no Magazine & Salvage number can lift them. Their trees are the
  // package's to retune; this pin makes that decision visible.
  assert.deepEqual(acceptance, { 'scatter-shotgun': true, 'auto-miner': false, 'launcher-rig': true, 'hash-rail': false });
  const miner = rows.find((entry) => entry.weaponId === 'auto-miner' && entry.tier === 'maxed');
  const rail = rows.find((entry) => entry.weaponId === 'hash-rail' && entry.tier === 'maxed');
  assert.ok(miner.reserveRemaining > 0 && miner.emptySeconds === 0, 'the Machine Gun never runs dry');
  assert.ok(rail.reserveRemaining > 0 && rail.emptySeconds === 0, 'the Railgun never runs dry');
});
