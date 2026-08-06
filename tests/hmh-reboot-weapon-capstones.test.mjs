import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HMH_WEAPON_DEFINITIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

/**
 * Tier-three capstones were named but inert: `burst-fire`, `armor-piercing`,
 * `double-barrel`, `explosive` and `tracer-rounds` appeared in the upgrade tree
 * and were collected into `specials`, but nothing downstream read them. A
 * player spent three tiers and got only the numeric bonus.
 *
 * Every assertion here compares the capstone against the same weapon at tier
 * two, so it fails if the capstone stops doing something the tier below does
 * not already do.
 */

const MAX = { rateOfFire: 3, damage: 3, reloadSpeed: 3 };

test('armor-piercing makes pistol rounds punch through a target', () => {
  const tierTwo = applyWeaponProgression('coin-blaster', { branches: { damage: 2 } });
  const capstone = applyWeaponProgression('coin-blaster', { branches: { damage: 3 } });
  assert.ok(capstone.specials.includes('armor-piercing'));
  assert.deepEqual(tierTwo.projectilePolicy, { type: 'ricochet', maxBounces: 1 });
  assert.equal(capstone.projectilePolicy.type, 'pierce');
  assert.ok(capstone.projectilePolicy.maxTargets >= 2);
});

test('explosive shotgun shells detonate, and shaped-charge widens the launcher blast', () => {
  const tierTwo = applyWeaponProgression('scatter-shotgun', { branches: { damage: 2 } });
  const capstone = applyWeaponProgression('scatter-shotgun', { branches: { damage: 3 } });
  assert.equal(tierTwo.projectilePolicy.type, 'pellet');
  assert.equal(capstone.projectilePolicy.type, 'splash');
  assert.ok(capstone.projectilePolicy.radius > 0);

  const launcher = applyWeaponProgression('launcher-rig', { branches: { damage: 3 } });
  assert.equal(launcher.projectilePolicy.type, 'splash');
  assert.ok(
    launcher.projectilePolicy.radius > HMH_WEAPON_DEFINITIONS['launcher-rig'].policy.radius,
    'shaped-charge must widen the blast beyond the base launcher',
  );
});

test('double-barrel puts more pellets in the air, twin-tube more grenades', () => {
  const base = applyWeaponProgression('scatter-shotgun');
  const capstone = applyWeaponProgression('scatter-shotgun', { branches: { rateOfFire: 3 } });
  assert.ok(capstone.pelletCount > base.pelletCount, 'double-barrel must add pellets');

  const launcher = applyWeaponProgression('launcher-rig', { branches: { rateOfFire: 3 } });
  assert.ok(launcher.pelletCount > applyWeaponProgression('launcher-rig').pelletCount);
});

test('tracer rounds fly faster and further and carry a projectile tag', () => {
  const base = applyWeaponProgression('auto-miner');
  const capstone = applyWeaponProgression('auto-miner', { branches: { damage: 3 } });
  assert.ok(capstone.projectileSpeed > base.projectileSpeed, 'tracers must be faster');
  assert.ok(capstone.range > base.range, 'tracers must reach further');
  assert.equal(capstone.projectileTag, 'tracer-round');
});

test('the launcher has an upgrade path at all, and bandolier deepens the tube', () => {
  const base = applyWeaponProgression('launcher-rig');
  for (const branch of Object.keys(MAX)) {
    const upgraded = applyWeaponProgression('launcher-rig', { branches: { [branch]: 1 } });
    const changed = upgraded.cadenceTicks !== base.cadenceTicks
      || upgraded.damage !== base.damage
      || upgraded.reloadTicks !== base.reloadTicks;
    assert.ok(changed, `launcher ${branch} tier one must change something`);
  }
  assert.ok(applyWeaponProgression('launcher-rig', { branches: { reloadSpeed: 3 } }).clipSize > base.clipSize);
});

test('shot payloads carry the upgraded values, not the base definition', () => {
  const progressionByWeapon = { 'auto-miner': { branches: { damage: 3 } } };
  const loadout = createWeaponLoadout({ weaponIds: ['auto-miner'], activeWeaponId: 'auto-miner', seed: 7 });
  const frame = stepWeaponLoadout(loadout, {
    tick: 1, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon,
  });
  const fired = frame.events.find((event) => event.type === 'weapon:fire');
  assert.ok(fired, 'the weapon must fire');
  const definition = HMH_WEAPON_DEFINITIONS['auto-miner'];
  for (const shot of fired.shots) {
    assert.ok(shot.speed > definition.projectileSpeed, 'shot speed must reflect the capstone');
    assert.ok(shot.range > definition.range, 'shot range must reflect the capstone');
    assert.equal(shot.projectileTag, 'tracer-round');
  }
});

test('burst-fire fires a real burst: short gaps inside it, full cadence after', () => {
  const progressionByWeapon = { 'coin-blaster': { branches: { rateOfFire: 3 } } };
  const profile = applyWeaponProgression('coin-blaster', progressionByWeapon['coin-blaster']);
  assert.ok(profile.burstCount > 1, 'burst-fire must configure a burst');

  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster'], activeWeaponId: 'coin-blaster', seed: 3 });
  const fireTicks = [];
  for (let tick = 1; tick <= 200 && fireTicks.length < profile.burstCount + 1; tick += 1) {
    const frame = stepWeaponLoadout(loadout, {
      tick, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon,
    });
    if (frame.events.some((event) => event.type === 'weapon:fire')) fireTicks.push(tick);
  }
  assert.ok(fireTicks.length >= profile.burstCount + 1, `only ${fireTicks.length} shots fired`);

  const inBurstGaps = [];
  for (let index = 1; index < profile.burstCount; index += 1) {
    inBurstGaps.push(fireTicks[index] - fireTicks[index - 1]);
  }
  const afterBurstGap = fireTicks[profile.burstCount] - fireTicks[profile.burstCount - 1];
  for (const gap of inBurstGaps) {
    assert.equal(gap, profile.burstIntervalTicks, 'shots inside a burst use the burst interval');
  }
  assert.ok(
    afterBurstGap > Math.max(...inBurstGaps),
    `the gap after a burst (${afterBurstGap}) must exceed the in-burst gap`,
  );

  // Without the capstone the cadence is uniform, which is what makes the above
  // a real difference rather than a restatement of the base weapon.
  const plain = createWeaponLoadout({ weaponIds: ['coin-blaster'], activeWeaponId: 'coin-blaster', seed: 3 });
  const plainTicks = [];
  for (let tick = 1; tick <= 200 && plainTicks.length < 3; tick += 1) {
    const frame = stepWeaponLoadout(plain, { tick, fire: true, direction: { x: 1, y: 0 } });
    if (frame.events.some((event) => event.type === 'weapon:fire')) plainTicks.push(tick);
  }
  assert.equal(plainTicks[1] - plainTicks[0], plainTicks[2] - plainTicks[1], 'the base pistol cadence is uniform');
});

test('every named capstone in the tree actually resolves to an effect', () => {
  // Guards against adding another inert tag, which is the defect this covers.
  const weapons = ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig'];
  for (const weaponId of weapons) {
    for (const branch of Object.keys(MAX)) {
      const capstone = applyWeaponProgression(weaponId, { branches: { [branch]: 3 } });
      const tierTwo = applyWeaponProgression(weaponId, { branches: { [branch]: 2 } });
      const special = capstone.specials.find((tag) => !tierTwo.specials.includes(tag));
      assert.ok(special, `${weaponId} ${branch} tier three must grant a named capstone`);
      const differs = ['projectilePolicy', 'pelletCount', 'projectileSpeed', 'range', 'clipSize', 'burstCount', 'projectileTag', 'heatPerShot', 'spreadRadians']
        .some((key) => JSON.stringify(capstone[key]) !== JSON.stringify(tierTwo[key]));
      assert.ok(differs, `${weaponId} ${branch} capstone "${special}" changes nothing beyond its numbers`);
    }
  }
});
