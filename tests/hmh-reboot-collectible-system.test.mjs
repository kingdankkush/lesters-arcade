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

test('all nine authored POIs map to deterministic collectible effects', () => {
  assert.equal(placements.length, 9);
  assert.deepEqual(Object.keys(COLLECTIBLE_EFFECTS).sort(), placements.map((placement) => placement.assetId).sort());
  const state = createCollectibleState({ placements });
  const snapshot = getCollectibleSnapshot(state, { tick: 0 });
  assert.equal(snapshot.collectedCount, 0);
  assert.equal(snapshot.remainingCount, 9);
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

test('collectible events and expiries are identical at 60, 30, and 20 render schedules', () => {
  const results = [60, 30, 20].map(runSchedule);
  const hashes = results.map(digest);
  assert.equal(new Set(hashes).size, 1);
  assert.equal(results[0].snapshot.collectedCount, 9);
  assert.equal(results[0].snapshot.remainingCount, 0);
  assert.equal(results[0].snapshot.activeEffects.length, 0);
  assert.deepEqual(results[0].events.map((event) => event.type).filter((type) => type === 'collectible:collected').length, 9);
});
