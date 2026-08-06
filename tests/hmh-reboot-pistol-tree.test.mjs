import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyWeaponProgression,
  createWeaponLoadout,
  pistolProgressionByWeapon,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

test('authored run ranks route into the live three-branch pistol tree', () => {
  assert.deepEqual(pistolProgressionByWeapon({
    'proof-of-work': 3,
    'hot-wallet': 2,
    'block-reward': 1,
  }), {
    'coin-blaster': {
      branches: { damage: 3, rateOfFire: 2, reloadSpeed: 1 },
    },
  });
});

test('pistol tiers cover velocity, range, magazine, ricochet, and penetration', () => {
  const base = applyWeaponProgression('coin-blaster');
  const velocity = applyWeaponProgression('coin-blaster', { branches: { rateOfFire: 2 } });
  const ricochet = applyWeaponProgression('coin-blaster', { branches: { damage: 2 } });
  const pierce = applyWeaponProgression('coin-blaster', { branches: { damage: 3 } });
  const magazine = applyWeaponProgression('coin-blaster', { branches: { reloadSpeed: 3 } });

  assert.ok(velocity.projectileSpeed > base.projectileSpeed);
  assert.ok(velocity.range > base.range);
  assert.ok(magazine.clipSize > base.clipSize);
  assert.deepEqual(ricochet.projectilePolicy, { type: 'ricochet', maxBounces: 1 });
  assert.deepEqual(pierce.projectilePolicy, { type: 'pierce', maxTargets: 3 });
});

test('pistol shock proc is deterministic and the full-tree crowd capstone is bounded', () => {
  const progressionByWeapon = pistolProgressionByWeapon({
    'proof-of-work': 3,
    'hot-wallet': 3,
    'block-reward': 3,
  });
  const profile = applyWeaponProgression('coin-blaster', progressionByWeapon['coin-blaster']);
  assert.deepEqual(profile.shock, [0.25, 3]);

  const sample = () => {
    const state = createWeaponLoadout({ seed: 0x5eed });
    const pattern = [];
    for (let tick = 1; tick <= 180; tick += 1) {
      const frame = stepWeaponLoadout(state, {
        tick,
        fire: true,
        direction: { x: 1, y: 0 },
        progressionByWeapon,
      });
      for (const event of frame.events) {
        if (event.type !== 'weapon:fire') continue;
        pattern.push(...event.shots.map((shot) => [shot.shock, shot.knockbackMultiplier]));
      }
    }
    return pattern;
  };

  const first = sample();
  const replay = sample();
  assert.deepEqual(replay, first);
  assert.ok(first.some(([shock, multiplier]) => shock && multiplier === 3));
  assert.ok(first.some(([shock, multiplier]) => !shock && multiplier === 1));
});
