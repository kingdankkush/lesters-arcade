import assert from 'node:assert/strict';
import test from 'node:test';

import * as burner from '../apps/hmh-reboot/src/bear-market-burner.mjs';
import { BEAR_MARKET_BURNER_EVENT_BOUNDS, createBearMarketBurnerEvent } from '../apps/hmh-reboot/src/bear-market-burner-event.mjs';
import * as progression from '../apps/hmh-reboot/src/run-progression.mjs';

const targets = Object.freeze([
  Object.freeze({ id: 'near-a', x: 120, y: 0, active: true, boss: false }),
  Object.freeze({ id: 'near-b', x: 180, y: 35, active: true, boss: false }),
  Object.freeze({ id: 'edge', x: 260, y: 150, active: true, boss: false }),
  Object.freeze({ id: 'behind', x: -80, y: 0, active: true, boss: false }),
]);

const step = (state, tick, overrides = {}) => burner.stepBearMarketBurner(state, {
  tick,
  fire: true,
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  targets,
  lineOfSight: () => true,
  policy: burner.resolveBearMarketBurnerPolicy(),
  ...overrides,
});

test('W9A fixed-tick flame pulses are stable, conical, LOS-gated, and bounded', () => {
  assert.equal(typeof burner.stepBearMarketBurner, 'function');
  const state = burner.createBearMarketBurnerState();
  const pulse = step(state, 6);
  const contacts = pulse.events.find((event) => event.type === 'burner:pulse')?.contacts ?? [];
  assert.deepEqual(contacts.map((contact) => contact.targetId), ['near-a', 'near-b']);
  assert.ok(contacts.length <= burner.BEAR_MARKET_BURNER_CONFIG.maxContactsPerPulse);
  const reversed = step(burner.createBearMarketBurnerState(), 6, { targets: [...targets].reverse() });
  assert.deepEqual(reversed.events, pulse.events);
  const blocked = step(burner.createBearMarketBurnerState(), 6, { lineOfSight: (_from, target) => target.id !== 'near-b' });
  assert.deepEqual(blocked.events.find((event) => event.type === 'burner:pulse').contacts.map((contact) => contact.targetId), ['near-a']);
});

test('W9A burn refresh never stacks and boss burn has a finite expiry', () => {
  const state = burner.createBearMarketBurnerState();
  step(state, 6);
  const first = burner.getBearMarketBurnerSnapshot(state);
  assert.equal(first.burns.length, 2);
  step(state, 12);
  const refreshed = burner.getBearMarketBurnerSnapshot(state);
  assert.equal(refreshed.burns.length, 2);
  assert.ok(refreshed.burns.every((entry) => entry.stacks === 1));
  const bossState = burner.createBearMarketBurnerState();
  const boss = [{ id: 'liquidator', x: 140, y: 0, active: true, boss: true }];
  for (let tick = 6; tick <= 300; tick += 6) step(bossState, tick, { targets: boss });
  const bossBurn = burner.getBearMarketBurnerSnapshot(bossState).burns[0];
  assert.ok(bossBurn.expiresTick <= 300 + burner.BEAR_MARKET_BURNER_CONFIG.bossBurnDurationTicks);
});

test('W9A fuel, empty, canister swap, emergency refill, cooldown, and reset are bounded', () => {
  const state = burner.createBearMarketBurnerState({ fuel: 10, reserveFuel: 20 });
  step(state, 1, { targets: [] });
  const empty = step(state, 2, { targets: [] });
  assert.equal(state.fuel, 0);
  assert.ok(empty.events.some((event) => event.type === 'burner:empty'));
  const swapping = burner.beginBearMarketBurnerCanisterSwap(state, { tick: 3, policy: burner.resolveBearMarketBurnerPolicy() });
  assert.equal(swapping.type, 'burner:swap-start');
  const completeTick = swapping.readyTick;
  const complete = burner.completeBearMarketBurnerCanisterSwap(state, { tick: completeTick, policy: burner.resolveBearMarketBurnerPolicy() });
  assert.equal(complete.type, 'burner:swap-complete');
  assert.equal(state.fuel, 20);
  assert.equal(state.reserveFuel, 0);
  const reset = burner.resetBearMarketBurnerState(state);
  assert.deepEqual(reset, burner.getBearMarketBurnerSnapshot(burner.createBearMarketBurnerState()));
});

test('W9A scorch replacement and hazard costs remain capped and deterministic', () => {
  const state = burner.createBearMarketBurnerState();
  for (let index = 0; index < 12; index += 1) {
    burner.addBearMarketBurnerScorch(state, { tick: index, x: index * 100, y: 0, sourceTargetId: `enemy-${index}` });
  }
  const snapshot = burner.getBearMarketBurnerSnapshot(state);
  assert.equal(snapshot.scorchZones.length, burner.BEAR_MARKET_BURNER_CONFIG.maxScorchZones);
  assert.deepEqual(snapshot.scorchZones.map((zone) => zone.sourceTargetId), ['enemy-4', 'enemy-5', 'enemy-6', 'enemy-7', 'enemy-8', 'enemy-9', 'enemy-10', 'enemy-11']);
  assert.equal(burner.bearMarketBurnerHazardCostAt(snapshot.scorchZones, { x: 700, y: 0 }) > 0, true);
  assert.equal(burner.bearMarketBurnerHazardCostAt(snapshot.scorchZones, { x: 9_000, y: 0 }), 0);
});

test('W9A branches and Total Selloff change distinct bounded mechanics', () => {
  const base = burner.resolveBearMarketBurnerPolicy();
  const liquidity = [1, 2, 3].map((tier) => burner.resolveBearMarketBurnerPolicy({ branches: { liquidity: tier } }));
  const volatility = [1, 2, 3].map((tier) => burner.resolveBearMarketBurnerPolicy({ branches: { volatility: tier } }));
  const contagion = [1, 2, 3].map((tier) => burner.resolveBearMarketBurnerPolicy({ branches: { contagion: tier } }));
  assert.ok(liquidity[0].tankCapacity > base.tankCapacity);
  assert.ok(liquidity[1].fuelPerTick < liquidity[0].fuelPerTick);
  assert.equal(liquidity[2].emergencyRefill, true);
  assert.ok(volatility[0].directDamage > base.directDamage);
  assert.ok(volatility[1].burnDurationTicks > volatility[0].burnDurationTicks);
  assert.equal(volatility[2].maxSpreadIgnitions, 2);
  assert.ok(contagion[0].halfAngleDegrees > base.halfAngleDegrees);
  assert.ok(contagion[1].range > contagion[0].range);
  assert.equal(contagion[2].scorchEnabled, true);
  assert.throws(() => burner.resolveBearMarketBurnerPolicy({ branches: { liquidity: 3, volatility: 2, contagion: 3 }, capstoneId: 'total-selloff' }), /requires/);
  const capstone = burner.resolveBearMarketBurnerPolicy({ branches: { liquidity: 3, volatility: 3, contagion: 3 }, capstoneId: 'total-selloff' });
  assert.ok(capstone.totalSelloffThresholdFuel > 0);
  assert.ok(capstone.totalSelloffCooldownTicks > 0);
});

test('W9A sustained contact creates capped scorch and defeat spread stays bounded', () => {
  const state = burner.createBearMarketBurnerState();
  const policy = burner.resolveBearMarketBurnerPolicy({ branches: { contagion: 3, volatility: 3 } });
  let scorchEvents = [];
  for (let tick = 6; tick <= 60; tick += 6) {
    scorchEvents = step(state, tick, { targets: [targets[0]], policy }).events.filter((event) => event.type === 'burner:scorch-created');
  }
  assert.equal(scorchEvents.length, 1);
  assert.equal(burner.getBearMarketBurnerSnapshot(state).scorchZones.length, 1);
  const spread = burner.spreadBearMarketBurnerOnDefeat(state, {
    tick: 61, source: targets[0], policy,
    nearbyTargets: [
      { id: 'spread-b', x: 170, y: 0, active: true },
      { id: 'spread-a', x: 170, y: 0, active: true },
      { id: 'too-far', x: 500, y: 0, active: true },
    ],
  });
  assert.deepEqual(spread.targetIds, ['spread-a', 'spread-b']);
});

test('W9A acquisition event is seed-stable, schedule-bounded, and fails closed on unsafe terrain', () => {
  const candidates = [
    { id: 'yard', pointOfInterestId: 'liquidation-tower', districtId: 'liquidation-yard', x: 10_800, y: 800 },
    { id: 'camp', pointOfInterestId: 'mining-headframe', districtId: 'mining-camp', x: 9_200, y: 1_600 },
  ];
  const create = (overrides = {}) => createBearMarketBurnerEvent({
    seed: 424_242, candidates, protectedPoints: [{ x: 0, y: 0 }],
    queryGround: () => ({ groundZ: 8, kind: 'ground' }), isBlocked: () => false, isRouteReachable: () => true,
    ...overrides,
  });
  assert.deepEqual(create(), create({ candidates: [...candidates].reverse() }));
  assert.equal(create().assetId, 'bear-market-burner-cache');
  assert.ok(create().availableTick >= BEAR_MARKET_BURNER_EVENT_BOUNDS.minTick);
  assert.ok(create().availableTick <= BEAR_MARKET_BURNER_EVENT_BOUNDS.maxTick);
  assert.throws(() => create({ queryGround: () => ({ groundZ: 0, kind: 'deep-water' }) }), /no safe/);
  assert.throws(() => create({ isBlocked: () => true }), /no safe/);
  assert.throws(() => create({ isRouteReachable: () => false }), /no safe/);
});

test('W9A run upgrades stay hidden until Burner ownership and gate Total Selloff', () => {
  const state = progression.createRunProgression({ seed: 29 });
  assert.ok(!progression.getEligibleRunUpgradeIds(state).some((id) => id.startsWith('burner-')));
  progression.unlockRunProgressionWeapon(state, 'bear-market-burner');
  let eligible = progression.getEligibleRunUpgradeIds(state);
  assert.ok(['burner-liquidity', 'burner-volatility', 'burner-contagion'].every((id) => eligible.includes(id)));
  assert.ok(!eligible.includes('total-selloff'));
  state.ranks['burner-liquidity'] = 3;
  state.ranks['burner-volatility'] = 3;
  state.ranks['burner-contagion'] = 3;
  eligible = progression.getEligibleRunUpgradeIds(state);
  assert.ok(eligible.includes('total-selloff'));
});

test('W9A state and events are equal across 60, 30, and 20 render partitions', () => {
  const run = (renderStep) => {
    const state = burner.createBearMarketBurnerState();
    const events = [];
    for (let tick = renderStep; tick <= 180; tick += renderStep) {
      for (let fixed = tick - renderStep + 1; fixed <= tick; fixed += 1) events.push(...step(state, fixed).events);
    }
    return { snapshot: burner.getBearMarketBurnerSnapshot(state), events };
  };
  assert.deepEqual(run(1), run(2));
  assert.deepEqual(run(1), run(3));
});
