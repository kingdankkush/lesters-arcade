import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HMH_WEAPON_DEFINITIONS,
  createWeaponLoadout,
  getWeaponReadabilityStatus,
  grantWeaponPickup,
  refillWeaponLoadout,
  selectWeapon,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

/**
 * Cycle 036 handoff, Priority D: the pistol is the always-owned,
 * unlimited-reserve fallback; every other weapon is a true pickup with finite
 * reserve ammunition. Acquiring a pickup grants the weapon plus an authored
 * ammo amount rather than switching to an already-owned infinite weapon.
 */

const ORDER = ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig'];
const newLoadout = () => createWeaponLoadout({ weaponIds: ORDER, activeWeaponId: 'coin-blaster', seed: 4 });

const drainClip = (state, fromTick) => {
  let tick = fromTick;
  for (let guard = 0; guard < 4000; guard += 1) {
    const weapon = state.weapons[state.activeWeaponId];
    if (weapon.ammoInClip <= 0) return tick;
    stepWeaponLoadout(state, { tick, fire: true, direction: { x: 1, y: 0 } });
    tick += 1;
  }
  throw new Error('clip never drained');
};

test('a fresh run owns only the pistol; every pickup weapon starts unowned with zero reserve', () => {
  const state = newLoadout();
  assert.equal(state.weapons['coin-blaster'].owned, true, 'the pistol is always owned');
  assert.equal(state.weapons['coin-blaster'].reserveAmmo, null, 'pistol reserve is unlimited');
  for (const id of ['scatter-shotgun', 'auto-miner', 'launcher-rig']) {
    assert.equal(state.weapons[id].owned, false, `${id} must start unowned`);
    assert.equal(state.weapons[id].reserveAmmo, 0, `${id} must start with zero reserve`);
  }
});

test('every pickup weapon declares an authored positive reserve grant; the pistol declares none', () => {
  assert.equal(HMH_WEAPON_DEFINITIONS['coin-blaster'].pickupReserveAmmo, null);
  for (const id of ['scatter-shotgun', 'auto-miner', 'launcher-rig']) {
    const amount = HMH_WEAPON_DEFINITIONS[id].pickupReserveAmmo;
    assert.ok(Number.isInteger(amount) && amount > 0, `${id} needs an authored pickup reserve`);
  }
});

test('selecting or switching to an unowned weapon is impossible', () => {
  const state = newLoadout();
  assert.throws(() => selectWeapon(state, 'scatter-shotgun', { tick: 1 }), /unowned|owned/i);
  assert.equal(state.activeWeaponId, 'coin-blaster', 'a refused switch must not change the active weapon');
});

test('a weapon cache grants ownership, a loaded clip, and the authored reserve', () => {
  const state = newLoadout();
  const event = grantWeaponPickup(state, { tick: 5, weaponId: 'scatter-shotgun', select: true });
  const weapon = state.weapons['scatter-shotgun'];
  assert.equal(event.type, 'weapon:granted');
  assert.equal(weapon.owned, true);
  assert.ok(weapon.ammoInClip > 0, 'the granted weapon arrives loaded');
  assert.equal(weapon.reserveAmmo, HMH_WEAPON_DEFINITIONS['scatter-shotgun'].pickupReserveAmmo);
  assert.equal(state.activeWeaponId, 'scatter-shotgun');
});

test('picking up an already-owned weapon adds reserve up to a bounded cap', () => {
  const state = newLoadout();
  grantWeaponPickup(state, { tick: 5, weaponId: 'launcher-rig', select: false });
  const authored = HMH_WEAPON_DEFINITIONS['launcher-rig'].pickupReserveAmmo;
  for (let pickup = 0; pickup < 6; pickup += 1) {
    grantWeaponPickup(state, { tick: 6 + pickup, weaponId: 'launcher-rig', select: false });
  }
  const weapon = state.weapons['launcher-rig'];
  assert.ok(weapon.reserveAmmo <= authored * 2, `reserve ${weapon.reserveAmmo} must stay bounded`);
  assert.ok(weapon.reserveAmmo >= authored, 'repeat pickups must still add ammo');
});

test('reloads draw from finite reserve and an exhausted weapon reads EMPTY instead of reloading forever', () => {
  const state = newLoadout();
  grantWeaponPickup(state, { tick: 1, weaponId: 'scatter-shotgun', select: true });
  const definition = HMH_WEAPON_DEFINITIONS['scatter-shotgun'];
  let tick = 10;
  let guard = 0;
  // Burn through clip + entire reserve.
  while (guard < 10000) {
    guard += 1;
    const weapon = state.weapons['scatter-shotgun'];
    if (weapon.ammoInClip <= 0 && weapon.reserveAmmo <= 0 && weapon.reloadCompleteTick === null) break;
    stepWeaponLoadout(state, { tick, fire: true, direction: { x: 1, y: 0 } });
    tick += 1;
  }
  const weapon = state.weapons['scatter-shotgun'];
  assert.equal(weapon.ammoInClip, 0);
  assert.equal(weapon.reserveAmmo, 0);
  assert.equal(weapon.reloadCompleteTick, null, 'no reserve means no reload may start');
  const status = getWeaponReadabilityStatus(state, { tick });
  assert.equal(status.mode, 'empty');
  assert.equal(status.reserveAmmo, 0, 'the HUD status must expose finite reserve');

  // The pistol remains fully functional as the fallback.
  selectWeapon(state, 'coin-blaster', { tick });
  const pistolStatus = getWeaponReadabilityStatus(state, { tick });
  assert.equal(pistolStatus.reserveAmmo, null, 'pistol reserve reads unlimited');
});

test('the pistol reload never consumes reserve and never strands the player', () => {
  const state = newLoadout();
  let tick = drainClip(state, 1);
  // Step forward through the reload.
  for (let i = 0; i < 200; i += 1) {
    stepWeaponLoadout(state, { tick, fire: false, direction: { x: 1, y: 0 } });
    tick += 1;
    if (state.weapons['coin-blaster'].ammoInClip > 0) break;
  }
  assert.ok(state.weapons['coin-blaster'].ammoInClip > 0, 'the pistol must reload from unlimited reserve');
  assert.equal(state.weapons['coin-blaster'].reserveAmmo, null);
});

test('ammo refills top up owned weapons only and never grant ownership', () => {
  const state = newLoadout();
  grantWeaponPickup(state, { tick: 1, weaponId: 'auto-miner', select: false });
  // Spend some reserve first so the refill is observable.
  state.weapons['auto-miner'].reserveAmmo = 10;
  refillWeaponLoadout(state, { tick: 2 });
  assert.ok(state.weapons['auto-miner'].reserveAmmo > 10, 'refill must add reserve to owned finite weapons');
  assert.equal(state.weapons['scatter-shotgun'].owned, false, 'a refill must not grant ownership');
  assert.equal(state.weapons['scatter-shotgun'].reserveAmmo, 0);
});

test('grants and reserve consumption are deterministic across identical runs', () => {
  const run = () => {
    const state = newLoadout();
    grantWeaponPickup(state, { tick: 1, weaponId: 'scatter-shotgun', select: true });
    let tick = 5;
    const trace = [];
    for (let i = 0; i < 400; i += 1) {
      const frame = stepWeaponLoadout(state, { tick, fire: true, direction: { x: 1, y: 0 } });
      for (const event of frame.events) trace.push(`${event.tick}:${event.type}`);
      tick += 1;
    }
    const weapon = state.weapons['scatter-shotgun'];
    return { trace, clip: weapon.ammoInClip, reserve: weapon.reserveAmmo };
  };
  assert.deepEqual(run(), run());
});
