import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  BEAR_MARKET_BURNER_CONFIG,
  createBearMarketBurnerState,
  getBearMarketBurnerSnapshot,
  resolveBearMarketBurnerPolicy,
  stepBearMarketBurner,
} from '../apps/hmh-reboot/src/bear-market-burner.mjs';

const policy = resolveBearMarketBurnerPolicy({
  branches: { liquidity: 3, volatility: 3, contagion: 3 },
  capstoneId: 'total-selloff',
});
const origin = Object.freeze({ x: 0, y: 0 });
const direction = Object.freeze({ x: 1, y: 0 });
const targetCluster = (count) => Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
  id: `enemy-${String(index).padStart(2, '0')}`,
  x: 90 + index * 20,
  y: index % 2 === 0 ? -20 : 20,
  active: true,
  boss: false,
})));

const results = [];
for (const size of [4, 8, 12]) {
  const targets = targetCluster(size);
  const state = createBearMarketBurnerState({ fuel: policy.tankCapacity, reserveFuel: policy.reserveFuel });
  let pulses = 0;
  let contacts = 0;
  let burnTicks = 0;
  let scorchEvents = 0;
  let maxEventsPerTick = 0;
  for (let tick = 1; tick <= 180; tick += 1) {
    const frame = stepBearMarketBurner(state, {
      tick,
      fire: true,
      origin,
      direction,
      targets: tick % 2 === 0 ? [...targets].reverse() : targets,
      lineOfSight: () => true,
      policy,
    });
    maxEventsPerTick = Math.max(maxEventsPerTick, frame.events.length);
    for (const event of frame.events) {
      if (event.type === 'burner:pulse') {
        pulses += 1;
        contacts += event.contacts.length;
        assert.deepEqual(event.contacts.map((contact) => contact.targetId), targets.map((target) => target.id));
      } else if (event.type === 'burner:burn-tick') burnTicks += 1;
      else if (event.type === 'burner:scorch-created') scorchEvents += 1;
    }
  }
  const snapshot = getBearMarketBurnerSnapshot(state);
  assert.equal(contacts, pulses * size);
  assert.ok(pulses > 0);
  assert.ok(burnTicks > 0);
  assert.ok(snapshot.burns.length <= BEAR_MARKET_BURNER_CONFIG.maxActiveBurns);
  assert.ok(snapshot.scorchZones.length <= BEAR_MARKET_BURNER_CONFIG.maxScorchZones);
  assert.ok(maxEventsPerTick <= BEAR_MARKET_BURNER_CONFIG.maxContactsPerPulse + 4);

  const iterations = 10_000;
  const started = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const measured = createBearMarketBurnerState();
    const frame = stepBearMarketBurner(measured, {
      tick: BEAR_MARKET_BURNER_CONFIG.pulseIntervalTicks,
      fire: true,
      origin,
      direction,
      targets,
      lineOfSight: () => true,
      policy,
    });
    assert.equal(frame.events.find((event) => event.type === 'burner:pulse').contacts.length, size);
  }
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs < 2_000, `cluster ${size} benchmark exceeded 2s: ${elapsedMs.toFixed(3)}ms`);
  results.push({
    clusterSize: size,
    iterations,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    pulses,
    contacts,
    burnTicks,
    scorchEvents,
    activeBurns: snapshot.burns.length,
    activeScorchZones: snapshot.scorchZones.length,
    fuelSpent: snapshot.fuelSpent,
    maxEventsPerTick,
  });
}

console.log(JSON.stringify({ status: 'pass', benchmark: 'hmh-bear-market-burner-v1', results }));
