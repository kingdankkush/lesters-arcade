// Progression release (design package S1.3; 8.2 gun branches, 8.6 balance
// fixes): Magazine & Salvage, the Railgun's charge speed and Capacitor Bank,
// the Machine Gun's heat per rank, the Shotgun's centre-pellet blast, the
// Launcher's shots, damage and blast radius, grenade maximums, the held-weapon
// crit list, every Arc and Burn rank adding something, and the nuke radius.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HMH_CRITICAL_HELD_WEAPON_IDS,
  HMH_WEAPON_DEFINITIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  creditWeaponKills,
  grantWeaponPickup,
  stepWeaponLoadout,
  weaponIdsWithAmmo,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import {
  HMH_GRENADE_DEFINITION,
  createGrenadeSystem,
  raiseHandGrenadeMaximum,
  rechargeHandGrenades,
  throwGrenade,
} from '../apps/hmh-reboot/src/grenades.mjs';
import { resolveLightningLedgerUpgradePolicy } from '../apps/hmh-reboot/src/lightning-ledger.mjs';
import { resolveBearMarketBurnerPolicy } from '../apps/hmh-reboot/src/bear-market-burner.mjs';
import { COLLECTIBLE_EFFECTS } from '../apps/hmh-reboot/src/collectible-system.mjs';

const reserveTier = (weaponId, tier) => applyWeaponProgression(weaponId, { branches: { reloadSpeed: tier } });

test('Magazine & Salvage: the reserve grant is ceil(pickup x 1.25 / 1.5 / 2.0) and the cap is twice the grant', () => {
  const table = {
    'scatter-shotgun': [12, 15, 18, 24],
    'auto-miner': [240, 300, 360, 480],
    'hash-rail': [15, 19, 23, 30],
    'launcher-rig': [8, 10, 12, 16],
  };
  for (const [weaponId, grants] of Object.entries(table)) {
    assert.deepEqual([0, 1, 2, 3].map((tier) => reserveTier(weaponId, tier).reserveAmmoGrant), grants, weaponId);
    const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', weaponId], seed: 3 });
    const progressionByWeapon = { [weaponId]: { branches: { reloadSpeed: 3 } } };
    grantWeaponPickup(loadout, { tick: 1, weaponId, progressionByWeapon });
    assert.equal(loadout.weapons[weaponId].reserveAmmo, grants[3]);
    grantWeaponPickup(loadout, { tick: 2, weaponId, progressionByWeapon });
    grantWeaponPickup(loadout, { tick: 3, weaponId, progressionByWeapon });
    assert.equal(loadout.weapons[weaponId].reserveAmmo, grants[3] * 2, `${weaponId} caps at twice the grant`);
  }
  assert.equal(applyWeaponProgression('coin-blaster', { branches: { reloadSpeed: 3 } }).reserveAmmoGrant, null, 'the Pistol keeps its unlimited reserve');
});

test('Salvage: kills credited to a gun refund whole rounds into reserve only, from rank 2, capped, with no RNG', () => {
  assert.deepEqual(['scatter-shotgun', 'auto-miner', 'hash-rail', 'launcher-rig'].map((id) => [1, 2, 3].map((tier) => reserveTier(id, tier).salvagePermille)), [
    [0, 250, 500], [0, 2000, 4000], [0, 150, 250], [0, 150, 250],
  ]);
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun'], seed: 11 });
  const tierTwo = { 'scatter-shotgun': { branches: { reloadSpeed: 2 } } };
  grantWeaponPickup(loadout, { tick: 1, weaponId: 'scatter-shotgun', select: true, progressionByWeapon: tierTwo });
  const shotgun = loadout.weapons['scatter-shotgun'];
  stepWeaponLoadout(loadout, { tick: 10, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon: tierTwo });
  const clip = shotgun.ammoInClip;
  const reserve = shotgun.reserveAmmo;
  // Credited right after the kills of tick 10 resolve, after its weapon step.
  creditWeaponKills(loadout, { tick: 10, weaponId: 'scatter-shotgun', count: 3, progressionByWeapon: tierTwo });
  assert.equal(shotgun.reserveAmmo, reserve, '750 per-mille is not a round yet');
  creditWeaponKills(loadout, { tick: 10, weaponId: 'scatter-shotgun', count: 2, progressionByWeapon: tierTwo });
  assert.equal(shotgun.reserveAmmo, reserve + 1);
  assert.equal(shotgun.salvagePermille, 250);
  assert.equal(shotgun.ammoInClip, clip, 'never the clip');
  assert.throws(() => creditWeaponKills(loadout, { tick: 9, weaponId: 'scatter-shotgun', count: 1, progressionByWeapon: tierTwo }), /tick/);
  // Rank 1 salvages nothing; a gun at its cap keeps its cap.
  const tierOne = { 'scatter-shotgun': { branches: { reloadSpeed: 1 } } };
  creditWeaponKills(loadout, { tick: 10, weaponId: 'scatter-shotgun', count: 40, progressionByWeapon: tierOne });
  assert.equal(shotgun.reserveAmmo, reserve + 1);
  creditWeaponKills(loadout, { tick: 10, weaponId: 'scatter-shotgun', count: 400, progressionByWeapon: tierTwo });
  assert.equal(shotgun.reserveAmmo, 36, 'the tier-2 cap');
  // Kills by the knife, a hand grenade or the Pistol credit nothing.
  for (const weaponId of ['litecoin-knife', 'satoshi-frag', 'coin-blaster', 'nuke-liquidation']) {
    assert.equal(creditWeaponKills(loadout, { tick: 10, weaponId, count: 5, progressionByWeapon: tierTwo }), null, weaponId);
  }
});

test('Railgun: Charge Speed shortens the charge to 67 / 62 / 56 ticks, and Capacitor Bank loads five slugs', () => {
  assert.deepEqual([0, 1, 2, 3].map((tier) => applyWeaponProgression('hash-rail', { branches: { rateOfFire: tier } }).chargeTicks), [72, 67, 62, 56]);
  const fast = { 'hash-rail': { branches: { rateOfFire: 3 } } };
  const loadout = createWeaponLoadout({ weaponIds: ['hash-rail'], activeWeaponId: 'hash-rail', seed: 5 });
  const start = stepWeaponLoadout(loadout, { tick: 1, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon: fast });
  assert.equal(start.events.find((event) => event.type === 'weapon:charge-start').readyTick, 57);
  const early = stepWeaponLoadout(loadout, { tick: 56, fire: true, releaseCharged: true, direction: { x: 1, y: 0 }, progressionByWeapon: fast });
  assert.ok(!early.events.some((event) => event.type === 'weapon:fire'));
  const release = stepWeaponLoadout(loadout, { tick: 57, fire: true, releaseCharged: true, direction: { x: 1, y: 0 }, progressionByWeapon: fast });
  assert.ok(release.events.some((event) => event.type === 'weapon:fire'), 'the slug leaves after 56 ticks');
  const bank = applyWeaponProgression('hash-rail', { branches: { reloadSpeed: 3 } });
  assert.equal(bank.clipSize, 5);
  assert.ok(bank.specials.includes('capacitor-bank'));
  assert.ok(!bank.specials.includes('extended-mag'), 'the Pistol\'s extended-mag no longer rides on the rail');
  assert.equal(bank.shock, null);
  assert.equal(applyWeaponProgression('coin-blaster', { branches: { reloadSpeed: 3 } }).clipSize, 12, 'the Pistol keeps extended-mag');
});

test('Machine Gun: every Fire Rate rank cuts heat per round to x0.90 / 0.80 / 0.72', () => {
  const heat = [0, 1, 2, 3].map((tier) => applyWeaponProgression('auto-miner', { branches: { rateOfFire: tier } }).heatPerShot);
  assert.deepEqual(heat.map((value) => Number(value.toFixed(6))), [6, 5.4, 4.8, 4.32]);
});

test('Shotgun: the explosive capstone makes only the centre pellet a radius-72 blast', () => {
  const capstone = applyWeaponProgression('scatter-shotgun', { branches: { damage: 3 } });
  assert.equal(capstone.projectilePolicy.type, 'pellet');
  for (const rateOfFire of [0, 3]) {
    const progressionByWeapon = { 'scatter-shotgun': { branches: { damage: 3, rateOfFire } } };
    const loadout = createWeaponLoadout({ weaponIds: ['scatter-shotgun'], activeWeaponId: 'scatter-shotgun', seed: 9 });
    const fired = stepWeaponLoadout(loadout, { tick: 1, fire: true, direction: { x: 0, y: 1 }, progressionByWeapon }).events.find((event) => event.type === 'weapon:fire');
    const splash = fired.shots.filter((shot) => shot.policy.type === 'splash');
    assert.equal(splash.length, 1, `one blast pellet of ${fired.shots.length}`);
    assert.equal(splash[0].policy.radius, 72);
    assert.equal(splash[0].pelletIndex, Math.floor((fired.shots.length - 1) / 2), 'the centre pellet');
    assert.ok(fired.shots.filter((shot) => shot !== splash[0]).every((shot) => shot.policy.type === 'pellet'));
  }
});

test('Launcher: one grenade per shot, upgraded damage and blast radius, Twin Tube 7 degrees apart', () => {
  const fire = (branches) => {
    const loadout = createWeaponLoadout({ weaponIds: ['launcher-rig'], activeWeaponId: 'launcher-rig', seed: 4 });
    return stepWeaponLoadout(loadout, { tick: 1, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon: { 'launcher-rig': { branches } } })
      .events.find((event) => event.type === 'weapon:fire');
  };
  const base = fire({});
  assert.equal(base.shots.length, 1);
  assert.equal(base.shots[0].damage, HMH_GRENADE_DEFINITION.damage);
  assert.equal(base.shots[0].blastRadius, HMH_GRENADE_DEFINITION.blastRadius);
  assert.deepEqual([1, 2, 3].map((tier) => fire({ damage: tier }).shots[0].damage), [36, 39, 42]);
  assert.equal(fire({ damage: 3 }).shots[0].blastRadius, 210, 'Shaped Charge');
  const twin = fire({ rateOfFire: 3 });
  assert.equal(twin.shots.length, 2);
  const angle = (shot) => Math.atan2(shot.direction.y, shot.direction.x);
  assert.ok(Math.abs(angle(twin.shots[1]) - angle(twin.shots[0]) - Math.PI * 7 / 180) < 1e-9, 'exactly 7 degrees apart');
  assert.ok(Math.abs(angle(twin.shots[0]) + angle(twin.shots[1])) < 1e-9, 'centred on the aim');
  // throwGrenade carries the shot's damage and radius into the blast.
  const system = createGrenadeSystem({ capacity: 4 });
  for (const shot of twin.shots) {
    const launch = throwGrenade(system, { tick: 1, mode: 'launcher', origin: { x: 0, y: 0, z: 32 }, direction: shot.direction, damage: 42, blastRadius: 210, damageMultiplier: 2 });
    assert.equal(launch.spawned, true);
  }
  assert.deepEqual(system.active.map((grenade) => [grenade.damage, grenade.blastRadius]), [[84, 210], [84, 210]]);
  const hand = createGrenadeSystem();
  throwGrenade(hand, { tick: 1, mode: 'hand', origin: { x: 0, y: 0, z: 24 }, direction: { x: 1, y: 0 } });
  assert.deepEqual([hand.active[0].damage, hand.active[0].blastRadius], [34, 150], 'hand grenades keep the base blast');
});

test('Extra Grenade raises the maximum instead of overflowing it', () => {
  const system = createGrenadeSystem({ handCharges: 5 });
  assert.equal(system.maxHandCharges, 5);
  raiseHandGrenadeMaximum(system, { amount: 1 });
  assert.deepEqual([system.handCharges, system.maxHandCharges], [6, 6]);
  rechargeHandGrenades(system, { tick: 1, amount: 3 });
  assert.equal(system.handCharges, 6);
  const partial = createGrenadeSystem({ handCharges: 2 });
  raiseHandGrenadeMaximum(partial, { amount: 2 });
  assert.deepEqual([partial.handCharges, partial.maxHandCharges], [4, 7]);
  assert.throws(() => raiseHandGrenadeMaximum(partial, { amount: 0 }), /amount/);
});

test('armed guns: owned, with ammo in the clip or reserve; the War Fork always; the Flamethrower while it has fuel', () => {
  const loadout = createWeaponLoadout({ weaponIds: Object.keys(HMH_WEAPON_DEFINITIONS), seed: 1 });
  assert.deepEqual(weaponIdsWithAmmo(loadout), ['coin-blaster']);
  for (const weaponId of ['scatter-shotgun', 'forked-standard', 'bear-market-burner']) grantWeaponPickup(loadout, { tick: 1, weaponId });
  assert.deepEqual(weaponIdsWithAmmo(loadout), ['coin-blaster', 'scatter-shotgun', 'bear-market-burner', 'forked-standard']);
  const shotgun = loadout.weapons['scatter-shotgun'];
  shotgun.ammoInClip = 0;
  shotgun.reserveAmmo = 0;
  const burner = loadout.weapons['bear-market-burner'];
  burner.ammoInClip = 0;
  burner.reserveAmmo = 0;
  assert.deepEqual(weaponIdsWithAmmo(loadout), ['coin-blaster', 'forked-standard']);
});

test('a cache selects its gun only when it is newly owned', () => {
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun', 'auto-miner'], seed: 2 });
  grantWeaponPickup(loadout, { tick: 1, weaponId: 'scatter-shotgun', select: 'if-new' });
  assert.equal(loadout.activeWeaponId, 'scatter-shotgun');
  grantWeaponPickup(loadout, { tick: 2, weaponId: 'auto-miner', select: 'if-new' });
  assert.equal(loadout.activeWeaponId, 'auto-miner');
  const repeat = grantWeaponPickup(loadout, { tick: 3, weaponId: 'scatter-shotgun', select: 'if-new' });
  assert.equal(repeat.alreadyOwned, true);
  assert.equal(loadout.activeWeaponId, 'auto-miner', 'a repeat cache tops up the reserve and keeps the held gun');
  grantWeaponPickup(loadout, { tick: 4, weaponId: 'scatter-shotgun', select: true });
  assert.equal(loadout.activeWeaponId, 'scatter-shotgun', 'select: true still selects');
});

test('crits reach held-weapon direct hits: Arc Rifle, flame contact, launcher blasts and the War Fork', () => {
  assert.deepEqual([...HMH_CRITICAL_HELD_WEAPON_IDS].sort(), ['bear-market-burner', 'forked-standard', 'launcher-rig', 'lightning-ledger']);
});

test('every Arc Damage rank adds contact damage and every other Burn Damage rank adds a point', () => {
  assert.deepEqual([0, 1, 2, 3].map((voltage) => resolveLightningLedgerUpgradePolicy({ branches: { voltage } }).contactDamagePermille), [1000, 1100, 1150, 1200]);
  assert.deepEqual([0, 1, 2, 3].map((volatility) => resolveBearMarketBurnerPolicy({ branches: { volatility } }).directDamage), [4, 5, 5, 6]);
});

test('the nuke reaches about 1,100 around the hero', () => {
  assert.equal(COLLECTIBLE_EFFECTS['nuke-liquidation'].radius, 1_100);
  assert.equal(COLLECTIBLE_EFFECTS['nuke-liquidation'].damage, 999);
});
