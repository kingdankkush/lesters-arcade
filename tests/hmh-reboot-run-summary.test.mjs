import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunCollectible,
  recordRunDamage,
  recordRunGrenade,
  recordRunGrenadeDetonation,
  recordRunHealing,
  recordRunKill,
  recordRunProjectileContacts,
  recordRunProjectileResolution,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponEvent,
  recordRunWeaponFire,
  recordRunWeaponLifecycleEvent,
  recordRunWeaponTriggerContact,
} from '../sdk/hmh-run-summary.mjs';

function exerciseAccumulator() {
  const state = createRunSummaryAccumulator({
    seed: 42,
    buildHash: 'site-106:hmh-wave-6a',
    mode: 'ranked',
    heroId: 'lit-commando',
    startTick: 0,
    startPosition: { x: 0, y: 0 },
  });
  recordRunTick(state, {
    tick: 1,
    position: { x: 3, y: 4 },
    activeWeaponId: 'scatter-shotgun',
    districtId: 'frontier-relay',
    discoveredPoiIds: ['relay-cache'],
    activeEffectIds: ['time-dilation'],
  });
  recordRunWeaponEvent(state, { type: 'pickup', weaponId: 'scatter-shotgun' });
  recordRunWeaponEvent(state, { type: 'swap', weaponId: 'scatter-shotgun' });
  recordRunWeaponEvent(state, { type: 'reload-start', weaponId: 'scatter-shotgun' });
  recordRunWeaponEvent(state, { type: 'reload-complete', weaponId: 'scatter-shotgun' });
  recordRunWeaponEvent(state, { type: 'empty', weaponId: 'scatter-shotgun' });
  recordRunWeaponFire(state, { weaponId: 'scatter-shotgun', emitted: 6 });
  recordRunWeaponTriggerContact(state, { weaponId: 'scatter-shotgun' });
  recordRunProjectileContacts(state, { weaponId: 'scatter-shotgun', count: 2 });
  recordRunDamage(state, {
    sourceId: 'player',
    targetId: 'enemy-1',
    weaponId: 'scatter-shotgun',
    damageApplied: 17,
    healthBefore: 15,
    critical: true,
  });
  recordRunDamage(state, {
    sourceId: 'enemy-2',
    targetId: 'player',
    weaponId: 'enemy-gas-bomber',
    damageApplied: 9,
    healthBefore: 100,
    critical: false,
  });
  recordRunHealing(state, 10);
  recordRunKill(state, {
    enemyRoleId: 'gas-bomber',
    weaponId: 'scatter-shotgun',
    elite: true,
    boss: false,
  });
  recordRunKill(state, {
    enemyRoleId: 'validator-cultist',
    weaponId: 'launcher-rig',
  });
  recordRunGrenade(state, { type: 'thrown' });
  recordRunGrenade(state, { type: 'detonated', contacts: 2 });
  recordRunGrenade(state, { type: 'self-damage', amount: 3 });
  recordRunGrenade(state, { type: 'overflow' });
  recordRunCollectible(state, { effectId: 'bonus-life' });
  recordRunCollectible(state, { effectId: 'litecoin-token' });
  recordRunUpgradeOffer(state, ['proof-of-work', 'diamond-hands']);
  recordRunUpgradeSelection(state, 'proof-of-work');
  return finalizeRunSummary(state, {
    endTick: 61,
    elapsedMs: 1016.667,
    terminalReason: 'defeated',
    score: 4200,
    level: 3,
    xp: 900,
    currentCombo: 2,
    maxCombo: 4,
    revealedCells: 12,
    totalCells: 40,
  });
}

test('canonical run summary records real bounded authority values and finalizes once', () => {
  const summary = exerciseAccumulator();
  assert.equal(summary.schemaVersion, 2);
  assert.deepEqual(summary.identity, {
    seed: 42,
    buildHash: 'site-106:hmh-wave-6a',
    mode: 'ranked',
    heroId: 'lit-commando',
    terminalReason: 'defeated',
    startTick: 0,
    endTick: 61,
  });
  assert.equal(summary.totals.survivalTicks, 61);
  assert.equal(summary.totals.elapsedMs, 1016.667);
  assert.equal(summary.totals.score, 4200);
  assert.equal(summary.totals.level, 3);
  assert.equal(summary.totals.xp, 900);
  assert.equal(summary.totals.litecoin, 1);
  assert.equal(summary.totals.currentCombo, 2);
  assert.equal(summary.totals.maxCombo, 4);
  assert.equal(summary.totals.damageDealt, 17);
  assert.equal(summary.totals.damageTaken, 9);
  assert.equal(summary.totals.healing, 10);
  assert.equal(summary.totals.distanceMilli, 5000);

  assert.equal(summary.kills.total, 2);
  assert.equal(summary.kills.elite, 1);
  assert.equal(summary.kills.boss, 0);
  assert.deepEqual(summary.kills.byEnemyRole.find((row) => row.enemyRoleId === 'gas-bomber'), {
    enemyRoleId: 'gas-bomber',
    count: 1,
  });
  assert.deepEqual(summary.kills.byWeapon.find((row) => row.weaponId === 'scatter-shotgun'), {
    weaponId: 'scatter-shotgun',
    count: 1,
  });
  assert.deepEqual(summary.kills.byWeapon.find((row) => row.weaponId === 'launcher-rig'), {
    weaponId: 'launcher-rig',
    count: 1,
  });

  const shotgun = summary.weapons.find((row) => row.weaponId === 'scatter-shotgun');
  assert.deepEqual(shotgun, {
    weaponId: 'scatter-shotgun',
    pickups: 1,
    swaps: 1,
    triggers: 1,
    triggerContacts: 1,
    projectilesEmitted: 6,
    projectileContacts: 2,
    reloadStarts: 1,
    reloadCompletes: 1,
    emptyAttempts: 1,
    equippedTicks: 1,
    damage: 17,
    kills: 1,
    criticalHits: 1,
    overkill: 2,
    chargesStarted: 0,
    chargesCancelled: 0,
    chargedShots: 0,
    cancelledChargeTicks: 0,
    zeroHitShots: 0,
    oneHitShots: 0,
    twoHitShots: 0,
    threePlusHitShots: 0,
    bossHits: 0,
    damageTakenWhileEquipped: 0,
  });
  assert.deepEqual(summary.grenades, {
    thrown: 1,
    detonated: 1,
    contacts: 2,
    kills: 1,
    selfDamage: 3,
    overflows: 1,
  });
  assert.deepEqual(summary.collectibles.find((row) => row.effectId === 'litecoin-token'), {
    effectId: 'litecoin-token',
    collected: 1,
    activeTicks: 0,
  });
  assert.deepEqual(summary.collectibles.find((row) => row.effectId === 'time-dilation'), {
    effectId: 'time-dilation',
    collected: 0,
    activeTicks: 1,
  });
  assert.deepEqual(summary.upgrades.find((row) => row.upgradeId === 'proof-of-work'), {
    upgradeId: 'proof-of-work',
    offered: 1,
    selected: 1,
  });
  assert.equal(summary.exploration.visitedDistrictMask, 1);
  assert.equal(summary.exploration.discoveredPoiMask, 1);
  assert.equal(summary.exploration.revealedCells, 12);
  assert.equal(summary.exploration.totalCells, 40);
  assert.equal(summary.exploration.revealedPermille, 300);
  assert.equal(summary.exploration.distanceMilli, 5000);
  assert.equal(Object.isFrozen(summary), true);
});

test('Hash Rail run telemetry records charge outcomes, hit histogram, boss hits, and equipped damage', () => {
  const state = createRunSummaryAccumulator({ seed: 9, buildHash: 'wave8-hash-rail', mode: 'free', heroId: 'lit-commando', startPosition: { x: 0, y: 0 } });
  recordRunWeaponLifecycleEvent(state, { type: 'weapon:charge-start', weaponId: 'hash-rail' });
  recordRunWeaponLifecycleEvent(state, { type: 'weapon:charge-cancel', weaponId: 'hash-rail', chargeTicks: 24 });
  recordRunWeaponLifecycleEvent(state, { type: 'weapon:charge-start', weaponId: 'hash-rail' });
  recordRunWeaponFire(state, { weaponId: 'hash-rail', emitted: 1, attackId: 'hash-rail:00000000' });
  recordRunProjectileResolution(state, { weaponId: 'hash-rail', attackId: 'hash-rail:00000000', trigger: { contacted: false } }, [
    { targetId: 'enemy-1' }, { targetId: 'boss-liquidator' },
  ]);
  recordRunDamage(state, { targetId: 'player', sourceId: 'enemy-1', weaponId: 'enemy-rifle', equippedWeaponId: 'hash-rail', damageApplied: 7 });
  const summary = finalizeRunSummary(state, { endTick: 120, elapsedMs: 2000, terminalReason: 'completed', score: 100, level: 1, xp: 0, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1 });
  const rail = summary.weapons.find((row) => row.weaponId === 'hash-rail');
  assert.deepEqual({
    chargesStarted: rail.chargesStarted,
    chargesCancelled: rail.chargesCancelled,
    chargedShots: rail.chargedShots,
    cancelledChargeTicks: rail.cancelledChargeTicks,
    zeroHitShots: rail.zeroHitShots,
    oneHitShots: rail.oneHitShots,
    twoHitShots: rail.twoHitShots,
    threePlusHitShots: rail.threePlusHitShots,
    bossHits: rail.bossHits,
    damageTakenWhileEquipped: rail.damageTakenWhileEquipped,
  }, { chargesStarted: 2, chargesCancelled: 1, chargedShots: 1, cancelledChargeTicks: 24, zeroHitShots: 0, oneHitShots: 0, twoHitShots: 1, threePlusHitShots: 0, bossHits: 1, damageTakenWhileEquipped: 7 });
});

test('runtime adapters preserve lifecycle metrics and exclude self-hits from launcher accuracy', () => {
  const state = createRunSummaryAccumulator({
    seed: 7,
    buildHash: 'site-106:hmh-wave-6a',
    mode: 'free',
    heroId: 'lit-valkyrie',
    startPosition: { x: 0, y: 0 },
  });
  recordRunWeaponFire(state, { weaponId: 'scatter-shotgun', emitted: 1 });
  recordRunProjectileResolution(state, {
    weaponId: 'scatter-shotgun',
    trigger: { contacted: false },
  }, [{ targetId: 'enemy-a' }]);
  recordRunWeaponLifecycleEvent(state, { type: 'weapon:reload-start', weaponId: 'scatter-shotgun' });
  recordRunWeaponLifecycleEvent(state, { type: 'weapon:reload-complete', weaponId: 'scatter-shotgun' });
  recordRunWeaponFire(state, { weaponId: 'launcher-rig', emitted: 1 });
  recordRunGrenadeDetonation(state, {
    grenadeId: 'launcher-rig:7:1',
    hits: [{ targetId: 'enemy-b' }, { targetId: 'player' }],
  });
  const summary = finalizeRunSummary(state, {
    endTick: 1,
    elapsedMs: 1000 / 60,
    terminalReason: 'defeated',
    score: 0,
    level: 1,
    xp: 0,
    currentCombo: 0,
    maxCombo: 0,
    revealedCells: 0,
    totalCells: 0,
  });
  const shotgun = summary.weapons.find((row) => row.weaponId === 'scatter-shotgun');
  const launcher = summary.weapons.find((row) => row.weaponId === 'launcher-rig');
  assert.equal(shotgun.triggerContacts, 1);
  assert.equal(shotgun.reloadCompletes, 1);
  assert.equal(launcher.triggerContacts, 1);
  assert.equal(launcher.projectileContacts, 1);
  assert.equal(summary.grenades.contacts, 1);
});

test('same fixed-tick authority produces the same summary across 60/30/20 render partitions', () => {
  const runPartition = (partitionSize) => {
    const state = createRunSummaryAccumulator({
      seed: 7,
      buildHash: 'partition-build',
      mode: 'free',
      heroId: 'lilly',
      startTick: 0,
      startPosition: { x: 0, y: 0 },
    });
    const fixedTicks = Array.from({ length: 60 }, (_, index) => index + 1);
    for (let offset = 0; offset < fixedTicks.length; offset += partitionSize) {
      for (const tick of fixedTicks.slice(offset, offset + partitionSize)) {
        recordRunTick(state, {
          tick,
          position: { x: tick, y: tick % 2 },
          activeWeaponId: 'coin-blaster',
          districtId: tick < 31 ? 'frontier-relay' : 'rugpull-ravine',
          discoveredPoiIds: tick < 31 ? [] : ['ravine-salvage'],
          activeEffectIds: [],
        });
      }
    }
    return finalizeRunSummary(state, {
      endTick: 60,
      elapsedMs: 1000,
      terminalReason: 'completed',
      score: 100,
      level: 1,
      xp: 0,
      currentCombo: 0,
      maxCombo: 0,
      revealedCells: 8,
      totalCells: 40,
    });
  };
  assert.deepEqual(runPartition(1), runPartition(2));
  assert.deepEqual(runPartition(1), runPartition(3));
});

test('run summary rejects a second finalization instead of emitting a duplicate final', () => {
  const state = createRunSummaryAccumulator({
    seed: 1,
    buildHash: 'duplicate-final-build',
    mode: 'free',
    heroId: 'lester-original',
    startTick: 0,
    startPosition: { x: 0, y: 0 },
  });
  const final = {
    endTick: 1,
    elapsedMs: 16.667,
    terminalReason: 'abandoned',
    score: 0,
    level: 1,
    xp: 0,
    currentCombo: 0,
    maxCombo: 0,
    revealedCells: 1,
    totalCells: 40,
  };
  finalizeRunSummary(state, final);
  assert.throws(() => finalizeRunSummary(state, final), /already finalized/i);
});
