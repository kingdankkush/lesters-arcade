import assert from 'node:assert/strict';
import test from 'node:test';

import { runBenchmark, runSwarmBenchmark } from '../scripts/hmh-reboot-weapon-benchmark.mjs';

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
