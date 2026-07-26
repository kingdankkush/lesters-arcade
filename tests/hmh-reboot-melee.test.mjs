import assert from 'node:assert/strict';
import test from 'node:test';
import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import {
  HMH_MELEE_DEFINITION,
  createMeleeState,
  createMeleeTarget,
  resolveMeleeAttack,
  stepMeleeState,
} from '../apps/hmh-reboot/src/melee.mjs';
import { LESTER_BLASTER_WEAPON_SYSTEM } from '../apps/portal/src/arcade-core.mjs';

function target(id, {
  previous = { x: 40, y: 0, z: 0 },
  current = previous,
  radius = 6,
  minZ = 4,
  maxZ = 60,
} = {}) {
  return createMeleeTarget({ id, previousGround: previous, currentGround: current, radius, minZ, maxZ });
}

function attack(overrides = {}) {
  return resolveMeleeAttack({
    attackId: 'melee:0001',
    tick: 1,
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 1, y: 0 },
    targets: [target('enemy')],
    blockers: [],
    ...overrides,
  });
}

test('melee definition preserves retained Litecoin Blade values at 60 Hz', () => {
  assert.equal(HMH_MELEE_DEFINITION.id, LESTER_BLASTER_WEAPON_SYSTEM.melee.id);
  assert.equal(HMH_MELEE_DEFINITION.damage, LESTER_BLASTER_WEAPON_SYSTEM.melee.damage);
  assert.equal(HMH_MELEE_DEFINITION.range, LESTER_BLASTER_WEAPON_SYSTEM.melee.rangePixels);
  assert.equal(HMH_MELEE_DEFINITION.cooldownTicks, 20);
  assert.equal(Object.isFrozen(HMH_MELEE_DEFINITION), true);
});

test('swept melee catches a target crossing the attack volume between fixed-step endpoints', () => {
  const crossing = target('crossing', {
    previous: { x: 42, y: -48, z: 0 },
    current: { x: 42, y: 48, z: 0 },
    radius: 5,
  });
  const result = attack({ targets: [crossing] });
  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].targetId, 'crossing');
  assert.ok(result.hits[0].targetTime > 0 && result.hits[0].targetTime < 1);
  assert.equal(result.hits[0].damage, 8);
});

test('melee angular coverage hits a forward flank but rejects targets behind or beyond range', () => {
  const flank = target('flank', { previous: { x: 36, y: 18, z: 0 }, radius: 5 });
  const behind = target('behind', { previous: { x: -8, y: 0, z: 0 }, radius: 5 });
  const distant = target('distant', { previous: { x: 80, y: 0, z: 0 }, radius: 5 });
  const result = attack({ targets: [distant, behind, flank] });
  assert.deepEqual(result.hits.map((hit) => hit.targetId), ['flank']);
});

test('melee hit order is stable by contact time then target ID and each target is hit once', () => {
  const result = attack({
    targets: [
      target('zeta', { previous: { x: 44, y: 0, z: 0 } }),
      target('alpha', { previous: { x: 44, y: 0, z: 0 } }),
      target('near', { previous: { x: 24, y: 0, z: 0 } }),
    ],
  });
  assert.deepEqual(result.hits.map((hit) => hit.targetId), ['near', 'alpha', 'zeta']);
  assert.equal(new Set(result.hits.map((hit) => hit.targetId)).size, result.hits.length);
});

test('authored visible cover and elevation bands make melee legality agree with world geometry', () => {
  const blocker = createStaticBlocker({
    id: 'visible-crate',
    shape: { type: 'circle', x: 25, y: 0, radius: 5 },
    visibleAssetId: 'graybox-visible-crate',
    minZ: 0,
    maxZ: 80,
    combatCover: true,
  });
  const blocked = attack({ targets: [target('blocked', { previous: { x: 44, y: 0, z: 0 } })], blockers: [blocker] });
  assert.equal(blocked.hits.length, 0);
  assert.equal(blocked.rejections[0].reason, 'cover');
  assert.equal(blocked.rejections[0].blockerId, 'visible-crate');

  const elevated = attack({ targets: [target('high', { previous: { x: 40, y: 0, z: 96 } })] });
  assert.equal(elevated.hits.length, 0);
  assert.equal(elevated.rejections[0].reason, 'height');
});

test('authored one-way ledges permit only a bounded downward melee strike through the drop direction', () => {
  const lowTarget = target('ledge-base', { previous: { x: 40, y: 0, z: 0 } });
  const downward = attack({
    origin: { x: 0, y: 0, z: 64 },
    targets: [lowTarget],
    downwardDropDirection: { x: 1, y: 0 },
  });
  assert.deepEqual(downward.hits.map((hit) => hit.targetId), ['ledge-base']);

  const noAuthoredDrop = attack({ origin: { x: 0, y: 0, z: 64 }, targets: [lowTarget] });
  assert.equal(noAuthoredDrop.rejections[0].reason, 'height');

  const againstDrop = attack({
    origin: { x: 0, y: 0, z: 64 },
    targets: [lowTarget],
    downwardDropDirection: { x: -1, y: 0 },
  });
  assert.equal(againstDrop.rejections[0].reason, 'height');

  const uphill = attack({
    origin: { x: 0, y: 0, z: 0 },
    targets: [target('high-ground', { previous: { x: 40, y: 0, z: 64 } })],
    downwardDropDirection: { x: 1, y: 0 },
  });
  assert.equal(uphill.rejections[0].reason, 'height');
});

test('main derives downward melee permission from the current authored surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /downwardDropDirection:\s*lastGround\.oneWayDrop/);
});

test('melee cooldown is deterministic and emits combat-ready hit intents only on legal attack ticks', () => {
  const state = createMeleeState();
  const args = {
    trigger: true,
    origin: { x: 0, y: 0, z: 0 },
    direction: { x: 1, y: 0 },
    targets: [target('enemy')],
    blockers: [],
  };
  const first = stepMeleeState(state, { tick: 1, ...args });
  assert.equal(first.attacked, true);
  assert.equal(first.attack.hits.length, 1);
  assert.equal(first.hits.length, 1);
  assert.equal(state.nextAttackTick, 21);
  const coolingDown = stepMeleeState(state, { tick: 2, ...args });
  assert.equal(coolingDown.attacked, false);
  assert.deepEqual(coolingDown.hits, []);
  assert.equal(stepMeleeState(state, { tick: 20, ...args }).attacked, false);
  assert.equal(stepMeleeState(state, { tick: 21, ...args }).attacked, true);
});

test('melee state wrapper preserves explicit authored source elevation', () => {
  const state = createMeleeState();
  const frame = stepMeleeState(state, {
    tick: 1,
    trigger: true,
    origin: { x: 0, y: 0 },
    sourceGroundZ: 64,
    direction: { x: 1, y: 0 },
    targets: [target('ledge-enemy', { previous: { x: 40, y: 0, z: 64 } })],
  });
  assert.equal(frame.hits.length, 1);
});

test('invalid and duplicate melee data fail closed', () => {
  assert.throws(() => createMeleeTarget({ id: '', previousGround: { x: 0, y: 0, z: 0 }, currentGround: { x: 0, y: 0, z: 0 }, radius: 1 }), /id/i);
  assert.throws(() => attack({ direction: { x: 0, y: 0 } }), /direction/i);
  const duplicate = target('duplicate');
  assert.throws(() => attack({ targets: [duplicate, duplicate] }), /duplicate/i);
  const state = createMeleeState();
  stepMeleeState(state, { tick: 1, trigger: false });
  assert.throws(() => stepMeleeState(state, { tick: 1, trigger: false }), /monotonic/i);
});
