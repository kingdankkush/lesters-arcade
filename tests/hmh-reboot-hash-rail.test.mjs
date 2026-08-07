import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { COLLECTIBLE_EFFECTS } from '../apps/hmh-reboot/src/collectible-system.mjs';
import {
  HMH_WEAPON_DEFINITIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  grantWeaponPickup,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { HMH_WEAPON_SFX, weaponFireCueId } from '../apps/hmh-reboot/src/weapon-audio.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';

const direction = Object.freeze({ x: 1, y: 0 });

test('W8 Hash Rail is a bounded deterministic piercing weapon', () => {
  const definition = HMH_WEAPON_DEFINITIONS['hash-rail'];
  assert.deepEqual({
    damage: definition.damage,
    fireRatePerSecond: definition.fireRatePerSecond,
    reloadSeconds: definition.reloadSeconds,
    clipSize: definition.clipSize,
    reserve: definition.pickupReserveAmmo,
    chargeTicks: definition.chargeTicks,
    policy: definition.policy,
  }, {
    damage: 54,
    fireRatePerSecond: 0.7,
    reloadSeconds: 2.6,
    clipSize: 3,
    reserve: 15,
    chargeTicks: 72,
    policy: { type: 'pierce', maxTargets: 2 },
  });
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster', 'hash-rail'], seed: 71 });
  const pickup = grantWeaponPickup(state, { tick: 1, weaponId: 'hash-rail', select: true });
  const started = stepWeaponLoadout(state, { tick: pickup.readyTick, fire: true, direction });
  assert.equal(started.events[0].type, 'weapon:charge-start');
  const cancelled = stepWeaponLoadout(state, { tick: pickup.readyTick + 40, fire: false, direction });
  assert.equal(cancelled.events[0].type, 'weapon:charge-cancel');
  const restarted = pickup.readyTick + 41;
  stepWeaponLoadout(state, { tick: restarted, fire: true, direction });
  const ready = stepWeaponLoadout(state, { tick: restarted + 72, fire: true, direction });
  assert.equal(ready.events[0].type, 'weapon:charge-ready');
  const releaseDirection = Object.freeze({ x: 0, y: 1 });
  const fired = stepWeaponLoadout(state, { tick: restarted + 73, fire: false, direction: releaseDirection });
  assert.equal(fired.events[0].weaponId, 'hash-rail');
  assert.deepEqual(fired.events[0].shots[0].direction, releaseDirection);
  assert.equal(fired.events[0].shots[0].policy.maxTargets, 2);
  assert.equal(state.weapons['hash-rail'].ammoInClip, 2);
  const deepProof = applyWeaponProgression('hash-rail', { branches: { damage: 3 } });
  assert.equal(deepProof.projectilePolicy.maxTargets, 3, 'Deep Proof must add one bounded body instead of reducing base penetration');
  assert.equal(deepProof.projectileTag, 'deep-proof');
});

test('W8 Hash Rail pickup, audio, tracking, HUD, and VFX are wired as one slice', async () => {
  assert.deepEqual(COLLECTIBLE_EFFECTS['hash-rail-core'], {
    effectId: 'hash-rail-core',
    kind: 'weapon-cache',
    weaponId: 'hash-rail',
    xpGain: 160,
  });
  assert.equal(weaponFireCueId('hash-rail'), 'hmh-fire-hash-rail');
  assert.ok(HMH_RUN_SUMMARY_CATALOGS.weapons.includes('hash-rail'));
  assert.ok(HMH_RUN_SUMMARY_CATALOGS.collectibles.includes('hash-rail-core'));
  assert.match(HMH_WEAPON_SFX['hmh-fire-hash-rail'].src, /hmh-fire-hash-rail\.wav$/);
  assert.match(HMH_WEAPON_SFX['hmh-hash-rail-charge'].src, /hmh-hash-rail-charge\.wav$/);
  const main = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const atlas = await readFile(new URL('../apps/hmh-reboot/src/authored-prop-atlas.mjs', import.meta.url), 'utf8');
  const authoredManifest = JSON.parse(await readFile(new URL('../apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', import.meta.url), 'utf8'));
  assert.match(main, /WEAPON_ORDER[^\n]*'hash-rail'/);
  assert.match(main, /'hash-rail': 0x8ff3ff/);
  assert.match(main, /'hash-rail': 38/);
  assert.match(main, /weapon:charge-start[\s\S]*hmh-hash-rail-charge/);
  assert.match(main, /recordRunWeaponFire\([^)]*weaponId/s);
  assert.match(main, /getWeaponReadabilityStatus/);
  assert.match(atlas, /weapons: Object\.freeze\([^\n]*hash-rail/);
  assert.doesNotMatch(atlas, /'hash-rail': 'hash-rail-core'/);
  assert.deepEqual(
    authoredManifest.assets.find((asset) => asset.assetId === 'hash-rail'),
    {
      assetId: 'hash-rail', category: 'weapon', shape: 'railgun',
      palette: { primary: '#cbd5df', secondary: '#25303c', accent: '#58d8ff' }, runtimeScale: 0.68,
    },
  );
});
