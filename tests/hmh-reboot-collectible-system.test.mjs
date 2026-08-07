import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { buildAuthoredPointOfInterestPlacements } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import {
  COLLECTIBLE_EFFECTS,
  createCollectibleState,
  getCollectibleSnapshot,
  stepCollectibles,
} from '../apps/hmh-reboot/src/collectible-system.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { DeterministicSimulation, FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';

const placements = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('all ten authored POIs map to deterministic collectible effects', () => {
  assert.equal(placements.length, 10);
  assert.ok(placements.every((placement) => COLLECTIBLE_EFFECTS[placement.assetId]));
  assert.deepEqual(COLLECTIBLE_EFFECTS['lightning-ledger-cache'], {
    effectId: 'lightning-ledger-cache', kind: 'weapon-cache', weaponId: 'lightning-ledger', xpGain: 220,
  });
  assert.deepEqual(COLLECTIBLE_EFFECTS['bear-market-burner-cache'], {
    effectId: 'bear-market-burner-cache', kind: 'weapon-cache', weaponId: 'bear-market-burner', xpGain: 260,
  });
  const state = createCollectibleState({ placements });
  const snapshot = getCollectibleSnapshot(state, { tick: 0 });
  assert.equal(snapshot.collectedCount, 0);
  assert.equal(snapshot.remainingCount, 10);
  assert.equal(snapshot.damageMultiplier, 1);
  assert.equal(snapshot.speedMultiplier, 1);
});

test('collections are stable, single-use, and timed effects expire on fixed ticks', () => {
  const state = createCollectibleState({ placements, collectionRadius: 80 });
  const target = placements.find((placement) => placement.assetId === 'berserk-candle');
  const first = stepCollectibles(state, { tick: 1, player: target });
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].type, 'collectible:collected');
  assert.equal(first.snapshot.damageMultiplier, 2);
  assert.equal(first.snapshot.activeEffects[0].expiresTick, 601);
  const duplicate = stepCollectibles(state, { tick: 2, player: target });
  assert.equal(duplicate.events.length, 0);
  const beforeExpiry = stepCollectibles(state, { tick: 600, player: { x: 0, y: 0 } });
  assert.equal(beforeExpiry.snapshot.damageMultiplier, 2);
  const expired = stepCollectibles(state, { tick: 601, player: { x: 0, y: 0 } });
  assert.deepEqual(expired.events.map((event) => event.type), ['collectible:expired']);
  assert.equal(expired.snapshot.damageMultiplier, 1);
});

function runSchedule(renderHz) {
  const state = createCollectibleState({ placements, collectionRadius: 80 });
  const simulation = new DeterministicSimulation();
  const events = [];
  simulation.onStep(({ tick }) => {
    const player = tick <= placements.length ? placements[tick - 1] : { x: 0, y: 0 };
    events.push(...stepCollectibles(state, { tick, player }).events);
  });
  simulation.start();
  while (simulation.tick < 780) {
    const remainingTicks = 780 - simulation.tick;
    simulation.update(Math.min(1000 / renderHz, remainingTicks * FIXED_STEP_MS));
  }
  return { events, snapshot: getCollectibleSnapshot(state, { tick: simulation.tick }) };
}

test('scheduled rare collectible is unavailable before its fixed tick and collectible exactly once after it', () => {
  const rare = {
    id: 'rare-ledger:0000002a',
    pointOfInterestId: 'hashwood-shrine',
    assetId: 'lightning-ledger-cache',
    districtId: 'hashwood',
    x: 6880,
    y: 3200,
    availableTick: 3600,
  };
  const state = createCollectibleState({ placements: [...placements, rare], collectionRadius: 80 });
  const before = stepCollectibles(state, { tick: 3599, player: rare });
  assert.equal(before.events.length, 0);
  assert.equal(before.snapshot.remainingCount, 11);
  const collected = stepCollectibles(state, { tick: 3600, player: rare });
  assert.equal(collected.events.length, 1);
  assert.equal(collected.events[0].weaponId, 'lightning-ledger');
  assert.equal(collected.events[0].availableTick, 3600);
  assert.equal(stepCollectibles(state, { tick: 3601, player: rare }).events.length, 0);
});

test('two scheduled weapon events remain independently unavailable and collectible', () => {
  const ledger = { id: 'rare-ledger:a', pointOfInterestId: 'hashwood', assetId: 'lightning-ledger-cache', districtId: 'hashwood', x: 100, y: 100, availableTick: 3_600 };
  const burner = { id: 'rare-burner:a', pointOfInterestId: 'yard', assetId: 'bear-market-burner-cache', districtId: 'liquidation-yard', x: 500, y: 500, availableTick: 32_400 };
  const state = createCollectibleState({ placements: [...placements, ledger, burner], collectionRadius: 80 });
  assert.equal(stepCollectibles(state, { tick: 3_600, player: ledger }).events[0].weaponId, 'lightning-ledger');
  assert.equal(stepCollectibles(state, { tick: 32_399, player: burner }).events.length, 0);
  assert.equal(stepCollectibles(state, { tick: 32_400, player: burner }).events[0].weaponId, 'bear-market-burner');
});

test('collectible events and expiries are identical at 60, 30, and 20 render schedules', () => {
  const results = [60, 30, 20].map(runSchedule);
  const hashes = results.map(digest);
  assert.equal(new Set(hashes).size, 1);
  assert.equal(results[0].snapshot.collectedCount, 10);
  assert.equal(results[0].snapshot.remainingCount, 0);
  assert.equal(results[0].snapshot.activeEffects.length, 0);
  assert.deepEqual(results[0].events.map((event) => event.type).filter((type) => type === 'collectible:collected').length, 10);
});
