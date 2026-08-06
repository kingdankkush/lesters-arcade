import assert from 'node:assert/strict';
import test from 'node:test';
import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createHurtTarget } from '../apps/hmh-reboot/src/projectile-physics.mjs';
import {
  HMH_GRENADE_DEFINITION,
  createGrenadeState,
  createGrenadeSystem,
  rechargeHandGrenades,
  resolveGrenadeBlast,
  stepGrenadeSystem,
  throwGrenade,
} from '../apps/hmh-reboot/src/grenades.mjs';
import { LESTER_BLASTER_WEAPON_SYSTEM } from '../apps/portal/src/arcade-core.mjs';

const flatGround = (x, y) => ({ x, y, groundZ: 0, surfaceId: 'foundation', visibleTerrainId: 'graybox-foundation' });

function hurt(id, { x, y, z = 0, radius = 6, health = 100 } = {}) {
  return createHurtTarget({
    id,
    bodyShape: { type: 'circle', radius },
    hurtShape: { type: 'circle', radius },
    previousGround: { x, y, z },
    currentGround: { x, y, z },
    minZ: 4,
    maxZ: 60,
    health,
  });
}

function visibleBlocker({ id = 'crate', x = 20, y = 0, radius = 5 } = {}) {
  return createStaticBlocker({
    id,
    shape: { type: 'circle', x, y, radius },
    visibleAssetId: `graybox-${id}`,
    minZ: 0,
    maxZ: 80,
    combatCover: true,
  });
}

test('grenade definition preserves retained Satoshi Frag values at 60 Hz', () => {
  const legacy = LESTER_BLASTER_WEAPON_SYSTEM.grenades.find(({ id }) => id === 'satoshi-frag');
  assert.equal(HMH_GRENADE_DEFINITION.id, legacy.id);
  assert.equal(HMH_GRENADE_DEFINITION.damage, legacy.damage);
  assert.equal(HMH_GRENADE_DEFINITION.blastRadius, legacy.radiusPixels);
  assert.equal(HMH_GRENADE_DEFINITION.fuseTicks, 39);
  assert.equal(HMH_GRENADE_DEFINITION.friendlyFire, 'self-damage');
  assert.equal(Object.isFrozen(HMH_GRENADE_DEFINITION), true);
});

test('hand grenade follows a deterministic authored arc, bounces, and detonates on its fuse', () => {
  const system = createGrenadeSystem({ capacity: 4, handCharges: 3 });
  const spawn = throwGrenade(system, {
    tick: 0,
    mode: 'hand',
    origin: { x: 0, y: 0, z: 24 },
    direction: { x: 1, y: 0 },
  });
  assert.equal(spawn.spawned, true);
  assert.equal(system.handCharges, 2);
  let sawBounce = false;
  let detonation = null;
  for (let tick = 1; tick <= HMH_GRENADE_DEFINITION.fuseTicks; tick += 1) {
    const frame = stepGrenadeSystem(system, { tick, queryGround: flatGround, blockers: [], targets: [] });
    sawBounce ||= frame.bounces.length > 0;
    detonation ??= frame.detonations[0] ?? null;
  }
  assert.equal(sawBounce, true);
  assert.equal(detonation.tick, 39);
  assert.equal(detonation.reason, 'fuse');
  assert.equal(system.active.length, 0);
});

test('launcher-rig grenade detonates on a complete swept blocker impact instead of tunneling', () => {
  const system = createGrenadeSystem({ capacity: 4, handCharges: 0 });
  throwGrenade(system, {
    tick: 0,
    mode: 'launcher',
    origin: { x: 0, y: 0, z: 32 },
    direction: { x: 1, y: 0 },
  });
  const blocker = visibleBlocker({ x: 22, radius: 2 });
  let detonation = null;
  for (let tick = 1; tick <= 5; tick += 1) {
    const frame = stepGrenadeSystem(system, { tick, queryGround: flatGround, blockers: [blocker], targets: [] });
    detonation ??= frame.detonations[0] ?? null;
  }
  assert.ok(detonation);
  assert.equal(detonation.reason, 'impact');
  assert.equal(detonation.blockerId, 'crate');
  assert.ok(detonation.point.x < 22);
});

test('hand grenade bounces from authored cover using the public swept collision normal', () => {
  const system = createGrenadeSystem();
  const blocker = visibleBlocker({ id: 'bounce-wall', x: 16, radius: 4 });
  throwGrenade(system, { tick: 0, mode: 'hand', origin: { x: 0, y: 0, z: 12 }, direction: { x: 1, y: 0 } });
  let blockerBounce = null;
  for (let tick = 1; tick <= 4; tick += 1) {
    const frame = stepGrenadeSystem(system, {
      tick,
      queryGround: (x, y) => ({ x, y, groundZ: -100, surfaceId: 'void-test', visibleTerrainId: 'graybox-void-test' }),
      blockers: [blocker],
    });
    blockerBounce ??= frame.bounces.find((bounce) => bounce.kind === 'blocker') ?? null;
  }
  assert.equal(blockerBounce?.blockerId, 'bounce-wall');
  assert.ok(system.active[0].velocity.x < 0);
});

test('blast applies stable radial falloff, self-damage, height legality, and authored cover', () => {
  const grenade = createGrenadeState({
    id: 'satoshi-frag:0001',
    ownerId: 'player',
    mode: 'hand',
    position: { x: 0, y: 0, z: 4 },
    velocity: { x: 0, y: 0, z: 0 },
    spawnTick: 0,
    detonateTick: 39,
  });
  const targets = [
    hurt('far', { x: 75, y: 35 }),
    hurt('blocked', { x: 45, y: 0 }),
    hurt('near', { x: 18, y: 28 }),
    hurt('player', { x: 5, y: 0 }),
    hurt('high', { x: 8, y: 0, z: 180 }),
  ];
  const blast = resolveGrenadeBlast({ grenade, targets, blockers: [visibleBlocker()] });
  assert.deepEqual(blast.hits.map((hit) => hit.targetId), ['player', 'near', 'far']);
  assert.ok(blast.hits[0].damage > blast.hits[1].damage);
  assert.ok(blast.hits[1].damage > blast.hits[2].damage);
  assert.ok(blast.hits.every((hit) => hit.weaponId === 'satoshi-frag'));
  assert.ok(blast.rejections.some((entry) => entry.targetId === 'blocked' && entry.reason === 'cover'));
  assert.ok(!blast.hits.some((hit) => hit.targetId === 'high'));
});

test('launcher grenade hits retain launcher-rig attribution for canonical weapon statistics', () => {
  const grenade = createGrenadeState({
    id: 'launcher-rig:0001',
    ownerId: 'player',
    mode: 'launcher',
    position: { x: 0, y: 0, z: 4 },
    velocity: { x: 0, y: 0, z: 0 },
    spawnTick: 0,
    detonateTick: 1,
  });
  const blast = resolveGrenadeBlast({ grenade, targets: [hurt('target', { x: 8, y: 0 })] });
  assert.equal(blast.hits[0].weaponId, 'launcher-rig');
});

test('blast-edge hurtbox overlap clamps combat ordering time to the canonical unit interval', () => {
  const grenade = createGrenadeState({
    id: 'satoshi-frag:edge',
    ownerId: 'player',
    mode: 'hand',
    position: { x: 0, y: 0, z: 4 },
    velocity: { x: 0, y: 0, z: 0 },
    spawnTick: 0,
    detonateTick: 39,
  });
  const blast = resolveGrenadeBlast({ grenade, targets: [hurt('edge', { x: HMH_GRENADE_DEFINITION.blastRadius + 4, y: 0 })] });
  assert.equal(blast.hits.length, 1);
  assert.equal(blast.hits[0].time, 1);
});

test('grenade cap is fixed, dropped spawns do not grow storage or consume hand charges', () => {
  const system = createGrenadeSystem({ capacity: 2, handCharges: 4 });
  assert.equal(throwGrenade(system, { tick: 0, mode: 'hand', origin: { x: 0, y: 0, z: 20 }, direction: { x: 1, y: 0 } }).spawned, true);
  assert.equal(throwGrenade(system, { tick: 0, mode: 'hand', origin: { x: 0, y: 0, z: 20 }, direction: { x: 1, y: 0 } }).spawned, true);
  const chargesBeforeDrop = system.handCharges;
  const dropped = throwGrenade(system, { tick: 0, mode: 'hand', origin: { x: 0, y: 0, z: 20 }, direction: { x: 1, y: 0 } });
  assert.equal(dropped.spawned, false);
  assert.equal(dropped.reason, 'capacity');
  assert.equal(system.active.length, 2);
  assert.equal(system.droppedSpawns, 1);
  assert.equal(system.handCharges, chargesBeforeDrop);
});

test('hand grenade inventory is explicit while launcher rounds do not consume hand charges', () => {
  const system = createGrenadeSystem({ capacity: 4, handCharges: 1 });
  assert.equal(throwGrenade(system, { tick: 0, mode: 'hand', origin: { x: 0, y: 0, z: 20 }, direction: { x: 1, y: 0 } }).spawned, true);
  const empty = throwGrenade(system, { tick: 0, mode: 'hand', origin: { x: 0, y: 0, z: 20 }, direction: { x: 1, y: 0 } });
  assert.equal(empty.reason, 'out-of-grenades');
  assert.equal(throwGrenade(system, { tick: 0, mode: 'launcher', origin: { x: 0, y: 0, z: 20 }, direction: { x: 1, y: 0 } }).spawned, true);
  assert.equal(system.handCharges, 0);
});

test('grenade stepping is deterministic across equivalent systems and fails closed on invalid state', () => {
  const make = () => {
    const system = createGrenadeSystem({ capacity: 4, handCharges: 1 });
    throwGrenade(system, { tick: 0, mode: 'hand', origin: { x: 2, y: 3, z: 24 }, direction: { x: 0.8, y: 0.2 } });
    return system;
  };
  const a = make();
  const b = make();
  for (let tick = 1; tick <= 20; tick += 1) {
    assert.deepEqual(
      stepGrenadeSystem(a, { tick, queryGround: flatGround, blockers: [], targets: [] }),
      stepGrenadeSystem(b, { tick, queryGround: flatGround, blockers: [], targets: [] }),
    );
  }
  assert.throws(() => stepGrenadeSystem(a, { tick: 20, queryGround: flatGround }), /monotonic/i);
  assert.throws(() => throwGrenade(a, { tick: 21, mode: 'invalid', origin: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 0 } }), /mode/i);
  assert.throws(() => createGrenadeSystem({ capacity: 0 }), /capacity/i);
});

test('pickup recharge is capped and grenade damage multiplier snapshots at spawn', () => {
  const system = createGrenadeSystem({ capacity: 4, handCharges: 1, maxHandCharges: 2 });
  const recharge = rechargeHandGrenades(system, { tick: 0, amount: 4 });
  assert.equal(recharge.amount, 1);
  assert.equal(system.handCharges, 2);
  const result = throwGrenade(system, {
    tick: 0,
    mode: 'hand',
    origin: { x: 0, y: 0, z: 20 },
    direction: { x: 1, y: 0 },
    damageMultiplier: 2,
  });
  assert.equal(result.spawned, true);
  assert.equal(system.active[0].damage, HMH_GRENADE_DEFINITION.damage * 2);
});
