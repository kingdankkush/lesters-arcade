import assert from 'node:assert/strict';
import test from 'node:test';

import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createMeleeTarget } from '../apps/hmh-reboot/src/melee.mjs';
import {
  FORKED_STANDARD_CONFIG,
  createForkedStandardState,
  getForkedStandardSnapshot,
  resolveForkedStandardPolicy,
  stepForkedStandard,
} from '../apps/hmh-reboot/src/forked-standard.mjs';
import { createForkedStandardEvent } from '../apps/hmh-reboot/src/forked-standard-event.mjs';
import * as progression from '../apps/hmh-reboot/src/run-progression.mjs';

const origin = Object.freeze({ x: 0, y: 0, z: 0 });
const direction = Object.freeze({ x: 1, y: 0 });

function target(id, { x = 60, y = 0, z = 0, previous = null, radius = 6 } = {}) {
  const current = { x, y, z };
  return createMeleeTarget({
    id,
    previousGround: previous ?? current,
    currentGround: current,
    radius,
    minZ: 4,
    maxZ: 60,
  });
}

function strike(state, tick, overrides = {}) {
  return stepForkedStandard(state, {
    tick,
    fire: true,
    origin,
    direction,
    targets: [target('enemy')],
    blockers: [],
    ...overrides,
  });
}

test('W9B primary fire alternates deterministic thrust and sweep with ammo-free cadence and whiff cost', () => {
  const state = createForkedStandardState();
  const thrust = strike(state, 0);
  assert.equal(thrust.attacked, true);
  assert.equal(thrust.strike.form, 'thrust');
  assert.equal(thrust.hits.length, 1);
  assert.equal(thrust.strike.attackId, 'forked-standard:00000000');
  assert.equal(state.nextAttackTick, FORKED_STANDARD_CONFIG.thrust.cooldownTicks);

  assert.equal(strike(state, 1).attacked, false);
  const sweep = strike(state, state.nextAttackTick);
  assert.equal(sweep.strike.form, 'sweep');
  assert.equal(sweep.hits.length, 1);
  assert.equal(state.sequence, 2);

  const whiffTick = state.nextAttackTick;
  const whiff = strike(state, whiffTick, { targets: [] });
  assert.equal(whiff.strike.form, 'thrust');
  assert.equal(whiff.strike.whiff, true);
  assert.equal(
    state.nextAttackTick,
    whiffTick + FORKED_STANDARD_CONFIG.thrust.cooldownTicks + FORKED_STANDARD_CONFIG.whiffPenaltyTicks,
  );
  const snapshot = getForkedStandardSnapshot(state);
  assert.deepEqual(
    { attacks: snapshot.attacks, thrusts: snapshot.thrusts, sweeps: snapshot.sweeps, contacts: snapshot.contacts, whiffs: snapshot.whiffs },
    { attacks: 3, thrusts: 2, sweeps: 1, contacts: 2, whiffs: 1 },
  );
});

test('W9B shared swept melee authority enforces reach, arc, elevation, cover, and authored downward drops', () => {
  const blocker = createStaticBlocker({
    id: 'visible-wall',
    shape: { type: 'circle', x: 36, y: 0, radius: 6 },
    visibleAssetId: 'graybox-visible-wall',
    minZ: 0,
    maxZ: 90,
    combatCover: true,
  });
  const blocked = strike(createForkedStandardState(), 0, { targets: [target('blocked', { x: 70 })], blockers: [blocker] });
  assert.equal(blocked.hits.length, 0);
  assert.equal(blocked.rejections[0].reason, 'cover');

  const high = strike(createForkedStandardState(), 0, { targets: [target('high', { x: 60, z: 96 })] });
  assert.equal(high.rejections[0].reason, 'height');

  const downward = strike(createForkedStandardState(), 0, {
    origin: { x: 0, y: 0, z: 64 },
    targets: [target('ledge-base', { x: 60, z: 0 })],
    downwardDropDirection: direction,
  });
  assert.deepEqual(downward.hits.map((hit) => hit.targetId), ['ledge-base']);

  const unauthored = strike(createForkedStandardState(), 0, {
    origin: { x: 0, y: 0, z: 64 },
    targets: [target('ledge-base', { x: 60, z: 0 })],
  });
  assert.equal(unauthored.rejections[0].reason, 'height');
});

test('W9B candidate work and one-hit contact ordering remain stable and hard-capped', () => {
  const targets = Array.from({ length: 48 }, (_, index) => target(`enemy-${String(index).padStart(2, '0')}`, {
    x: 38 + (index % 4) * 4,
    y: (index % 7) - 3,
  })).reverse();
  const state = createForkedStandardState();
  const thrust = strike(state, 0, { targets });
  assert.ok(thrust.hits.length <= FORKED_STANDARD_CONFIG.thrust.maxContacts);
  assert.ok(thrust.strike.candidatesConsidered <= FORKED_STANDARD_CONFIG.maxCandidates);
  assert.equal(new Set(thrust.hits.map((hit) => hit.targetId)).size, thrust.hits.length);

  const sweep = strike(state, state.nextAttackTick, { targets });
  assert.equal(sweep.hits.length, FORKED_STANDARD_CONFIG.sweep.maxContacts);
  assert.equal(sweep.strike.droppedContacts > 0, true);
  assert.deepEqual(
    sweep.hits.map((hit) => hit.targetId),
    [...sweep.hits].sort((a, b) => a.attackTime - b.attackTime || a.targetTime - b.targetTime || a.targetId.localeCompare(b.targetId)).map((hit) => hit.targetId),
  );
});

test('W9B three branches change distinct bounded mechanics and Canonical Fork empowers only every fourth attack', () => {
  const base = resolveForkedStandardPolicy();
  const reach = resolveForkedStandardPolicy({ branches: { reach: 3 } });
  const force = resolveForkedStandardPolicy({ branches: { force: 3 } });
  const tempo = resolveForkedStandardPolicy({ branches: { tempo: 3 } });
  assert.ok(reach.thrust.range > base.thrust.range && reach.sweep.arcRadians > base.sweep.arcRadians);
  assert.ok(force.thrust.damage > base.thrust.damage && force.sweep.knockback > base.sweep.knockback);
  assert.ok(tempo.thrust.cooldownTicks < base.thrust.cooldownTicks && tempo.whiffPenaltyTicks < base.whiffPenaltyTicks);
  assert.throws(() => resolveForkedStandardPolicy({ capstoneId: 'canonical-fork' }), /requires all three branches/i);

  const policy = resolveForkedStandardPolicy({ branches: { reach: 3, force: 3, tempo: 3 }, capstoneId: 'canonical-fork' });
  const state = createForkedStandardState();
  const frames = [];
  for (let attack = 0; attack < 4; attack += 1) {
    frames.push(strike(state, attack === 0 ? 0 : state.nextAttackTick, { policy }));
  }
  assert.deepEqual(frames.map((frame) => frame.strike.capstone), [false, false, false, true]);
  assert.equal(frames[3].hits[0].damage, Number((policy.sweep.damage * policy.capstoneDamagePermille / 1000).toFixed(6)));
  assert.ok(frames.every((frame) => frame.hits.length <= (frame.strike.form === 'thrust' ? policy.thrust.maxContacts : policy.sweep.maxContacts)));
});

test('W9B fixed-tick Standard state and events are equal across 60, 30, and 20 render partitions', () => {
  function simulate(partition) {
    const state = createForkedStandardState();
    const events = [];
    for (let start = 0; start < 240; start += partition) {
      for (let tick = start; tick < Math.min(240, start + partition); tick += 1) {
        const frame = stepForkedStandard(state, { tick, fire: true, origin, direction, targets: [target('enemy')], blockers: [] });
        events.push(...frame.events);
      }
    }
    return { snapshot: getForkedStandardSnapshot(state), events };
  }
  assert.deepEqual(simulate(1), simulate(2));
  assert.deepEqual(simulate(1), simulate(3));
});

test('W9B acquisition event is seed-stable, schedule-bounded, and fails closed on unsafe placement', () => {
  const candidates = [
    { id: 'b', pointOfInterestId: 'hashwood-shrine', districtId: 'hashwood', x: 200, y: 100 },
    { id: 'a', pointOfInterestId: 'mining-control-room', districtId: 'mining-camp', x: 500, y: 200 },
  ];
  const options = {
    seed: 99,
    candidates,
    protectedPoints: [{ id: 'spawn', x: -1000, y: -1000 }],
    queryGround: () => ({ groundZ: 12, surfaceId: 'packed-earth', walkable: true, deepWater: false }),
    isBlocked: () => false,
    isRouteReachable: () => true,
  };
  const first = createForkedStandardEvent(options);
  assert.deepEqual(first, createForkedStandardEvent({ ...options, candidates: [...candidates].reverse() }));
  assert.ok(first.availableTick >= FORKED_STANDARD_CONFIG.eventMinTick);
  assert.ok(first.availableTick <= FORKED_STANDARD_CONFIG.eventMaxTick);
  assert.equal(first.assetId, 'forked-standard-cache');
  assert.equal(first.hook, 'weapon');
  assert.equal(Object.isFrozen(first), true);
  assert.throws(
    () => createForkedStandardEvent({ ...options, candidates: [candidates[0], { ...candidates[0], x: 900 }] }),
    /duplicate Forked Standard event candidate b/i,
  );
  assert.throws(() => createForkedStandardEvent({ ...options, isRouteReachable: () => false }), /no safe Forked Standard event placement/i);
  assert.throws(() => createForkedStandardEvent({ ...options, queryGround: () => ({ groundZ: 0, surfaceId: 'deep-water', walkable: true, deepWater: true }) }), /no safe Forked Standard event placement/i);
});

test('W9B run upgrades stay hidden until Standard ownership and gate Canonical Fork', () => {
  const state = progression.createRunProgression({ seed: 31 });
  const standardIds = ['standard-reach', 'standard-force', 'standard-tempo'];
  assert.ok(!progression.getEligibleRunUpgradeIds(state).some((id) => id.startsWith('standard-')));
  progression.unlockRunProgressionWeapon(state, 'forked-standard');
  let eligible = progression.getEligibleRunUpgradeIds(state);
  assert.ok(standardIds.every((id) => eligible.includes(id)));
  assert.ok(!eligible.includes('canonical-fork'));
  for (const id of standardIds) state.ranks[id] = 3;
  eligible = progression.getEligibleRunUpgradeIds(state);
  assert.ok(eligible.includes('canonical-fork'));
});
