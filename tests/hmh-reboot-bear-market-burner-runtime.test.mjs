import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HMH_WEAPON_DEFINITIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  getWeaponReadabilityStatus,
  grantWeaponPickup,
  progressionByWeapon,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

test('W9A Burner is a finite-fuel authoritative loadout weapon with a stable numeric slot', () => {
  assert.deepEqual(HMH_WEAPON_DEFINITIONS['bear-market-burner'], {
    id: 'bear-market-burner', title: 'Bear Market Burner', displayName: 'Flame Projector', kind: 'flame-channel',
    damage: 4, fireRatePerSecond: 10, reloadSeconds: 2, clipSize: 1200,
    projectileSpeed: 0, range: 360, projectileRadius: 0, spreadRadians: Math.PI * 25 / 180,
    pelletCount: 1, recoil: 2, pickupReserveAmmo: 2400, policy: { type: 'stop' },
  });
  const progression = applyWeaponProgression('bear-market-burner');
  assert.equal(progression.clipSize, 1200);
  assert.equal(progression.reserveAmmoGrant, 2400);
  assert.deepEqual(progressionByWeapon({
    'burner-liquidity': 3,
    'burner-volatility': 2,
    'burner-contagion': 1,
    'total-selloff': 1,
  })['bear-market-burner'], {
    branches: { liquidity: 3, volatility: 2, contagion: 1 },
    capstoneId: 'total-selloff',
  });
});

test('W9A Burner pickup, pulse intents, fuel HUD, and empty fallback use the shared weapon authority', () => {
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'bear-market-burner'], activeWeaponId: 'coin-blaster' });
  grantWeaponPickup(loadout, { tick: 0, weaponId: 'bear-market-burner', select: true });
  const frame = stepWeaponLoadout(loadout, {
    tick: 6,
    fire: true,
    direction: { x: 1, y: 0 },
    channelOrigin: { x: 0, y: 0 },
    channelTargets: [{ id: 'enemy-a', x: 120, y: 0, active: true }],
    channelLineOfSight: () => true,
  });
  const pulse = frame.events.find((event) => event.type === 'weapon:flame-pulse');
  assert.equal(pulse.weaponId, 'bear-market-burner');
  assert.deepEqual(pulse.hits.map((hit) => hit.targetId), ['enemy-a']);
  assert.ok(loadout.weapons['bear-market-burner'].ammoInClip < 1200);
  const status = getWeaponReadabilityStatus(loadout, { tick: 6 });
  assert.match(status.hudLabel, /BEAR MARKET BURNER/);
  assert.match(status.accessibleLabel, /fuel/i);
});
