import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import {
  createCollectibleState,
  getCollectibleSnapshot,
  stepCollectibles,
} from '../apps/hmh-reboot/src/collectible-system.mjs';
import { createEnemyState } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { createGrenadeSystem, rechargeHandGrenades } from '../apps/hmh-reboot/src/grenades.mjs';
import { buildTimedEffectPresentation } from '../apps/hmh-reboot/src/hud-layout.mjs';
import { applyLiquidatorDamage, createLiquidatorBoss } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { DeterministicSimulation, FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
import {
  HMH_WEAPON_DEFINITIONS,
  createWeaponLoadout,
  grantWeaponPickup,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunCollectible,
  recordRunHealing,
  recordRunTick,
} from '../sdk/hmh-run-summary.mjs';

const SUPPORTED_ASSETS = Object.freeze([
  'bonus-life',
  'coin-blaster',
  'scatter-shotgun',
  'time-dilation',
  'nuke-liquidation',
  'hash-rail-core',
  'berserk-candle',
  'auto-miner',
  'launcher-rig',
  'lightning-ledger-cache',
]);

function placements(overrides = []) {
  return SUPPORTED_ASSETS.map((assetId, index) => Object.freeze({
    id: `lifecycle-${String(index).padStart(2, '0')}`,
    pointOfInterestId: `lifecycle-poi-${String(index).padStart(2, '0')}`,
    assetId,
    x: 10_000 + index * 500,
    y: 0,
    availableTick: 0,
    ...overrides[index],
  }));
}

function collectibleRow(summary, effectId) {
  return summary.collectibles.find((row) => row.effectId === effectId);
}

function runTimedLifecycle(renderHz) {
  const scheduled = placements([
    { assetId: 'bonus-life', x: 100 },
    { assetId: 'bonus-life', x: 200 },
    { assetId: 'time-dilation', x: 300 },
    { assetId: 'berserk-candle', x: 400 },
    { assetId: 'time-dilation', x: 500 },
  ]);
  const state = createCollectibleState({ placements: scheduled, collectionRadius: 30 });
  const summaryState = createRunSummaryAccumulator({
    seed: 66,
    buildHash: 'cycle-066-power-up-lifecycle',
    mode: 'free',
    heroId: 'lit-commando',
    startTick: 0,
    startPosition: { x: -10_000, y: 0 },
  });
  const collectionAtTick = new Map([[1, 100], [2, 200], [10, 300], [20, 400], [300, 500]]);
  const simulation = new DeterministicSimulation();
  let health = 50;
  simulation.onStep(({ tick }) => {
    const player = { x: collectionAtTick.get(tick) ?? -10_000, y: 0 };
    const frame = stepCollectibles(state, { tick, player });
    for (const event of frame.events) {
      if (event.type !== 'collectible:collected') continue;
      recordRunCollectible(summaryState, { effectId: event.effectId });
      if (event.kind === 'heal') {
        const before = health;
        health = Math.min(100, health + event.amount);
        recordRunHealing(summaryState, health - before);
      }
    }
    recordRunTick(summaryState, {
      tick,
      position: player,
      activeWeaponId: 'coin-blaster',
      districtId: 'frontier-relay',
      activeEffectIds: frame.snapshot.activeEffects.map((effect) => effect.effectId),
    });
  });
  simulation.start();
  while (simulation.tick < 900) {
    const remainingTicks = 900 - simulation.tick;
    simulation.update(Math.min(1000 / renderHz, remainingTicks * FIXED_STEP_MS));
  }
  const final = finalizeRunSummary(summaryState, {
    endTick: 900,
    elapsedMs: 15_000,
    terminalReason: 'completed',
    score: 0,
    level: 1,
    xp: 0,
    currentCombo: 0,
    maxCombo: 0,
    revealedCells: 0,
    totalCells: 1,
  });
  return Object.freeze({
    health,
    healing: final.totals.healing,
    timeDilation: collectibleRow(final, 'time-dilation'),
    berserk: collectibleRow(final, 'berserk-candle'),
    bonusLife: collectibleRow(final, 'bonus-life'),
    finalActiveEffects: getCollectibleSnapshot(state, { tick: 900 }).activeEffects,
  });
}

test('timed power-ups expose an explicit bounded refresh policy and expire on the refreshed boundary', () => {
  const state = createCollectibleState({ placements: placements([
    { assetId: 'time-dilation', x: 0 },
    { assetId: 'time-dilation', x: 1_000 },
  ]), collectionRadius: 40 });

  const first = stepCollectibles(state, { tick: 1, player: { x: 0, y: 0 } });
  const firstEvent = first.events.find((event) => event.type === 'collectible:collected');
  assert.deepEqual({
    refreshed: firstEvent.refreshed,
    previousExpiresTick: firstEvent.previousExpiresTick,
    expiresTick: firstEvent.expiresTick,
    refreshCount: firstEvent.refreshCount,
  }, { refreshed: false, previousExpiresTick: null, expiresTick: 601, refreshCount: 0 });

  const refreshed = stepCollectibles(state, { tick: 300, player: { x: 1_000, y: 0 } });
  const refreshEvent = refreshed.events.find((event) => event.type === 'collectible:collected');
  assert.deepEqual({
    refreshed: refreshEvent.refreshed,
    previousExpiresTick: refreshEvent.previousExpiresTick,
    expiresTick: refreshEvent.expiresTick,
    refreshCount: refreshEvent.refreshCount,
  }, { refreshed: true, previousExpiresTick: 601, expiresTick: 900, refreshCount: 1 });
  assert.deepEqual(refreshed.snapshot.activeEffects[0], {
    effectId: 'time-dilation',
    collectedTick: 300,
    expiresTick: 900,
    damageMultiplier: 1,
    speedMultiplier: 1.2,
    refreshCount: 1,
  });

  assert.equal(stepCollectibles(state, { tick: 899, player: { x: -10_000, y: 0 } }).snapshot.speedMultiplier, 1.2);
  const expired = stepCollectibles(state, { tick: 900, player: { x: -10_000, y: 0 } });
  assert.equal(expired.snapshot.speedMultiplier, 1);
  assert.deepEqual(expired.events.map((event) => event.type), ['collectible:expired']);
});

test('timed-effect presentation shares one fixed-tick countdown and refresh contract across HUD and accessibility', () => {
  const activeEffects = [
    { effectId: 'time-dilation', collectedTick: 300, expiresTick: 900, damageMultiplier: 1, speedMultiplier: 1.2, refreshCount: 1 },
    { effectId: 'berserk-candle', collectedTick: 400, expiresTick: 1_000, damageMultiplier: 2, speedMultiplier: 1, refreshCount: 0 },
  ];
  const presentation = buildTimedEffectPresentation({ tick: 450, activeEffects });
  assert.deepEqual(presentation, {
    active: true,
    hudLabel: 'BERSERK 10S + DILATION 8S R1',
    accessibleLabel: 'Active powerups: Berserk, 10 seconds remaining; Time Dilation, 8 seconds remaining, refreshed 1 time.',
    effects: [
      { effectId: 'berserk-candle', remainingTicks: 550, remainingSeconds: 10, refreshCount: 0 },
      { effectId: 'time-dilation', remainingTicks: 450, remainingSeconds: 8, refreshCount: 1 },
    ],
  });
  assert.ok(Object.isFrozen(presentation));
  assert.ok(Object.isFrozen(presentation.effects));

  assert.deepEqual(buildTimedEffectPresentation({ tick: 899, activeEffects: [activeEffects[0]] }), {
    active: true,
    hudLabel: 'DILATION 1S R1',
    accessibleLabel: 'Active powerups: Time Dilation, 1 second remaining, refreshed 1 time.',
    effects: [{ effectId: 'time-dilation', remainingTicks: 1, remainingSeconds: 1, refreshCount: 1 }],
  });
  assert.deepEqual(buildTimedEffectPresentation({ tick: 900, activeEffects: [activeEffects[0]] }), {
    active: false,
    hudLabel: '',
    accessibleLabel: 'No active powerups.',
    effects: [],
  });
});

test('runtime projects timed-effect refresh and expiry through the shared HUD/accessibility presentation without gaining authority', async () => {
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /buildTimedEffectPresentation\(collectibleSnapshot/);
  assert.match(main, /powerupPresentation\.hudLabel/);
  assert.match(main, /powerupPresentation\.accessibleLabel/);
  assert.match(main, /collectibleRefreshPilotEnabled = evidenceSafeEnabled/);
  assert.match(main, /collectibleRefreshCount = String\(powerupPresentation\.effects/);
});

test('canonical Hash Rail cache events stay bounded through third pickup', () => {
  const collectibleState = createCollectibleState({ placements: placements([
    { assetId: 'hash-rail-core', x: 0 },
  ]), collectionRadius: 40 });
  const collectibleEvent = stepCollectibles(collectibleState, { tick: 1, player: { x: 0, y: 0 } })
    .events.find((event) => event.type === 'collectible:collected');
  assert.deepEqual(
    { kind: collectibleEvent.kind, weaponId: collectibleEvent.weaponId },
    { kind: 'weapon-cache', weaponId: 'hash-rail' },
  );

  const loadout = createWeaponLoadout({
    weaponIds: Object.keys(HMH_WEAPON_DEFINITIONS),
    activeWeaponId: 'coin-blaster',
    seed: 66,
  });
  const grants = [1, 2, 3].map((tick) => grantWeaponPickup(loadout, {
    tick,
    weaponId: collectibleEvent.weaponId,
    select: true,
  }));

  assert.deepEqual(grants.map((grant) => grant.alreadyOwned), [false, true, true]);
  assert.equal(loadout.activeWeaponId, 'hash-rail');
  assert.equal(
    loadout.weapons['hash-rail'].reserveAmmo,
    HMH_WEAPON_DEFINITIONS['hash-rail'].pickupReserveAmmo * 2,
  );
});

test('screen nuke retires ordinary targets but cannot delete a healthy Liquidator or bypass boss authority', () => {
  const state = createCollectibleState({ placements: placements([
    { assetId: 'nuke-liquidation', x: 0 },
  ]), collectionRadius: 40 });
  const frame = stepCollectibles(state, { tick: 1, player: { x: 0, y: 0 } });
  const event = frame.events.find((candidate) => candidate.effectId === 'nuke-liquidation');
  const enemies = [
    createEnemyState({ archetypeId: 'bagholder-rusher', id: 'nuke-rusher', x: 10, y: 0 }),
    createEnemyState({ archetypeId: 'forkrunner', id: 'nuke-forkrunner', x: 20, y: 0 }),
  ];
  const boss = createLiquidatorBoss({ id: 'boss-liquidator', x: 30, y: 0 });
  const targets = [
    ...enemies.map((enemy) => ({
      id: enemy.id,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      armor: enemy.armor,
      shieldCharges: enemy.shieldCharges,
      knockbackResistance: enemy.knockbackResistance,
    })),
    { id: boss.id, health: boss.health, maxHealth: boss.maxHealth, armor: 1, shieldCharges: 0, knockbackResistance: 0.92 },
  ];
  const hits = targets.map((target) => ({
    id: `${event.id}:${target.id}`,
    tick: 1,
    time: 0,
    targetId: target.id,
    sourceId: 'player',
    weaponId: 'nuke-liquidation',
    damage: event.damage,
    criticalChance: 0,
    criticalMultiplier: 1,
    armorPiercing: true,
    direction: { x: 1, y: 0 },
    knockback: 0,
    point: { x: 0, y: 0, z: 0 },
  }));
  const resolved = resolveCombatHits({ sessionSeed: 66, hits, targets });
  const bossDamageEvent = resolved.damageEvents.find((damage) => damage.targetId === boss.id);
  const bossDamage = applyLiquidatorDamage({ boss, amount: bossDamageEvent.damageApplied, tick: 1 });
  const grenades = createGrenadeSystem({ handCharges: 3 });
  const recharge = rechargeHandGrenades(grenades, { tick: 1, amount: 1 });

  assert.deepEqual(resolved.scoreEvents.map((score) => score.enemyId).sort(), ['nuke-forkrunner', 'nuke-rusher']);
  assert.equal(resolved.targets['nuke-rusher'].active, false);
  assert.equal(resolved.targets['nuke-forkrunner'].active, false);
  assert.equal(resolved.targets['boss-liquidator'].active, true);
  assert.equal(bossDamage.damageApplied, 999);
  assert.equal(boss.health, 11_001);
  assert.equal(boss.active, true);
  assert.equal(boss.defeated, false);
  assert.equal(bossDamage.runEvent, null);
  assert.deepEqual(recharge, { type: 'grenade:pickup-refill', tick: 1, amount: 1, handCharges: 4 });
});

test('healing, timed-effect telemetry, refresh, expiry, and reset are 60/30/20 partition invariant', () => {
  const sixty = runTimedLifecycle(60);
  const thirty = runTimedLifecycle(30);
  const twenty = runTimedLifecycle(20);
  assert.deepEqual(sixty, thirty);
  assert.deepEqual(sixty, twenty);
  assert.deepEqual(sixty, {
    health: 100,
    healing: 50,
    timeDilation: { effectId: 'time-dilation', collected: 2, activeTicks: 890 },
    berserk: { effectId: 'berserk-candle', collected: 1, activeTicks: 600 },
    bonusLife: { effectId: 'bonus-life', collected: 2, activeTicks: 0 },
    finalActiveEffects: [],
  });
  assert.deepEqual(runTimedLifecycle(60), sixty, 'a fresh run must not retain collected IDs, health, or timed effects');
});

test('runtime keeps collectibles inside fixed-tick authority and routes nuke hits through normal combat and boss resolution', async () => {
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /simulation\.onStep[\s\S]*stepCollectibles\(collectibleState, \{ tick, player: actor \}\)/);
  assert.match(main, /event\.kind === 'nuke'[\s\S]*combatHitIntents\.push/);
  assert.match(main, /resolveCombatHits\([\s\S]*applyLiquidatorDamage/);
  assert.doesNotMatch(main, /event\.kind === 'nuke'[\s\S]{0,900}liquidatorBoss\.health\s*=/);
});
