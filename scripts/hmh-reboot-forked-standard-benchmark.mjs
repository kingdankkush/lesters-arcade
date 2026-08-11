import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { createMeleeTarget } from '../apps/hmh-reboot/src/melee.mjs';
import { createForkedStandardState, getForkedStandardSnapshot, stepForkedStandard } from '../apps/hmh-reboot/src/forked-standard.mjs';

function targets(count) {
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 4);
    const lane = index % 4;
    const point = { x: 40 + row * 8, y: (lane - 1.5) * 10, z: 0 };
    return createMeleeTarget({ id: `target-${String(index).padStart(3, '0')}`, ...point, radius: 12, height: 58, health: 100, previousGround: point, currentGround: point });
  });
}

function run(targetCount, iterations) {
  const state = createForkedStandardState();
  const roster = targets(targetCount);
  const startedAt = performance.now();
  let maxEvents = 0;
  let maxContacts = 0;
  for (let index = 0; index < iterations; index += 1) {
    const tick = state.nextAttackTick;
    const frame = stepForkedStandard(state, { tick, fire: true, origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0 }, targets: roster });
    maxEvents = Math.max(maxEvents, frame.events.length);
    maxContacts = Math.max(maxContacts, frame.events[0]?.hits.length ?? 0);
  }
  const elapsedMs = performance.now() - startedAt;
  const snapshot = getForkedStandardSnapshot(state);
  assert.equal(snapshot.attacks, iterations);
  assert.ok(maxEvents <= 1);
  assert.ok(maxContacts <= 6);
  return { targetCount, iterations, elapsedMs: Number(elapsedMs.toFixed(3)), microsecondsPerAttack: Number((elapsedMs * 1000 / iterations).toFixed(3)), maxEvents, maxContacts, attacks: snapshot.attacks, contacts: snapshot.contacts, whiffs: snapshot.whiffs };
}

const rows = [4, 8, 12].map((count) => run(count, 10_000));
assert.ok(rows.every((row) => row.elapsedMs < 2500), `Forked Standard benchmark exceeded bounded budget: ${JSON.stringify(rows)}`);
console.log(JSON.stringify({ status: 'pass', rows }, null, 2));
