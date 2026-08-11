import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { createMeleeTarget } from '../apps/hmh-reboot/src/melee.mjs';
import { mapGamepadSnapshot } from '../apps/hmh-reboot/src/input.mjs';
import {
  HMH_WEAPON_DEFINITIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  getWeaponReadabilityStatus,
  grantWeaponPickup,
  progressionByWeapon,
  selectWeapon,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

const target = createMeleeTarget({
  id: 'enemy',
  previousGround: { x: 64, y: 0, z: 0 },
  currentGround: { x: 64, y: 0, z: 0 },
  radius: 6,
  minZ: 4,
  maxZ: 60,
});

function frame(state, tick, fire = true) {
  return stepWeaponLoadout(state, {
    tick,
    fire,
    direction: { x: 1, y: 0 },
    meleeOrigin: { x: 0, y: 0, z: 0 },
    meleeTargets: [target],
    meleeBlockers: [],
  });
}

test('W9B Forked Standard is an ammo-free authoritative loadout weapon with alternating wrapped melee strikes', () => {
  const definition = HMH_WEAPON_DEFINITIONS['forked-standard'];
  assert.equal(definition.kind, 'melee-alternating');
  assert.equal(definition.ammoModel, 'none');
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster', 'forked-standard'], activeWeaponId: 'forked-standard', seed: 7 });
  const beforeAmmo = state.weapons['forked-standard'].ammoInClip;
  const thrust = frame(state, 0);
  const thrustEvent = thrust.events.find((event) => event.type === 'weapon:melee-strike');
  assert.equal(thrustEvent.form, 'thrust');
  assert.equal(thrustEvent.hits.length, 1);
  assert.equal(thrustEvent.hits[0].weaponId, 'forked-standard');
  assert.equal(state.weapons['forked-standard'].ammoInClip, beforeAmmo);
  const nextTick = state.weapons['forked-standard'].standardState.nextAttackTick;
  const sweep = frame(state, nextTick);
  assert.equal(sweep.events.find((event) => event.type === 'weapon:melee-strike').form, 'sweep');
  assert.equal(state.weapons['forked-standard'].ammoInClip, beforeAmmo);
});

test('W9B cache ownership, selection, progression, and HUD remain in the shared weapon authority', () => {
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster', 'forked-standard'], activeWeaponId: 'coin-blaster', seed: 9 });
  assert.equal(state.weapons['forked-standard'].owned, false);
  grantWeaponPickup(state, { tick: 0, weaponId: 'forked-standard', select: true });
  assert.equal(state.activeWeaponId, 'forked-standard');
  assert.equal(state.weapons['forked-standard'].owned, true);
  const policy = progressionByWeapon({ 'standard-reach': 3, 'standard-force': 3, 'standard-tempo': 3, 'canonical-fork': 1 });
  const profile = applyWeaponProgression('forked-standard', policy['forked-standard']);
  assert.equal(profile.standardPolicy.capstoneId, 'canonical-fork');
  const status = getWeaponReadabilityStatus(state, { tick: state.switchReadyTick, progressionByWeapon: policy });
  assert.match(status.hudLabel, /FORKED STANDARD/);
  assert.match(status.accessibleLabel, /ammo-free/i);
  selectWeapon(state, 'coin-blaster', { tick: state.switchReadyTick + 1 });
  assert.equal(state.activeWeaponId, 'coin-blaster');
});

test('W9B primary and secondary actions preserve keyboard-touch-controller authority roles', async () => {
  const gamepad = mapGamepadSnapshot({
    axes: [0, 0, 1, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: [2, 7].includes(index), value: [2, 7].includes(index) ? 1 : 0 })),
  });
  assert.equal(gamepad.actions.fire, true, 'right trigger remains primary weapon fire');
  assert.equal(gamepad.actions.melee, true, 'face button remains the tested secondary blade action');

  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /fire:\s*aimIntent\.fire/);
  assert.match(source, /trigger:\s*tickInput\.melee/);
  assert.match(source, /meleeTargets/);
  assert.match(source, /weapon:melee-strike/);
  assert.match(source, /type:\s*'forked-standard'/);
});
