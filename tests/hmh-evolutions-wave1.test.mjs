// Wave-1 evolutions (design package 8.5, build ledger slice 7): the weapon
// mechanics behind the Genesis Seal. Each gun is mastered (every branch at
// rank 3) and evolved through progressionByWeapon's evolutions map, exactly as
// main.mjs builds it from run progression.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HMH_CHILD_EVOLUTIONS,
  HMH_EVOLUTION_TUNING,
  HMH_RESERVE_TRICKLE_INTERVAL_TICKS,
  applyWeaponProgression,
  createWeaponLoadout,
  creditCritCandleKills,
  effectiveChargeTicks,
  grantWeaponPickup,
  progressionByWeapon,
  stepWeaponLoadout,
  switchWeapon,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { HMH_V7_EVOLUTIONS } from '../sdk/hmh-run-contract-v7.mjs';

const MAXED = { rateOfFire: 3, damage: 3, reloadSpeed: 3 };
const RIGHT = { x: 1, y: 0 };
const mastered = (weaponId, evolutionId = null) => ({ [weaponId]: { branches: MAXED, ...(evolutionId ? { evolutionId } : {}) } });

function armed(weaponId, byWeapon) {
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'hash-rail', 'launcher-rig'], activeWeaponId: 'coin-blaster', seed: 77, switchTicks: 0 });
  if (weaponId !== 'coin-blaster') grantWeaponPickup(loadout, { tick: 0, weaponId, select: true, progressionByWeapon: byWeapon });
  return loadout;
}

test('progressionByWeapon carries the run\'s evolutions and nothing else changes without them', () => {
  const ranks = { 'scatter-pump': 3, 'scatter-dump': 3, 'scatter-shells': 3 };
  assert.deepEqual(progressionByWeapon(ranks), progressionByWeapon(ranks, {}));
  const evolved = progressionByWeapon(ranks, { 'scatter-shotgun': 'double-spend' });
  assert.equal(evolved['scatter-shotgun'].evolutionId, 'double-spend');
  assert.deepEqual(evolved['scatter-shotgun'].branches, progressionByWeapon(ranks)['scatter-shotgun'].branches);
  assert.equal(evolved['coin-blaster'].evolutionId, undefined);
  // The wave-1 tuning covers exactly the five wave-1 evolutions of the v7 catalogue.
  assert.deepEqual(Object.keys(HMH_EVOLUTION_TUNING).sort(),
    Object.entries(HMH_V7_EVOLUTIONS).filter(([, row]) => row.wave === 1).map(([id]) => id).sort());
  for (const [weaponId, evolution] of Object.entries(HMH_CHILD_EVOLUTIONS)) {
    if (HMH_V7_EVOLUTIONS[evolution.id].wave === 2) {
      assert.throws(() => applyWeaponProgression(weaponId, { evolutionId: evolution.id }), /does not use projectile evolutions/, `${weaponId} (wave 2) still refuses`);
    }
  }
});

test('Settler Rail: pierce 8 with the lane falloff, armour ignored, the burst off, heavier rounds', () => {
  const maxed = applyWeaponProgression('coin-blaster', { branches: MAXED });
  const rail = applyWeaponProgression('coin-blaster', { branches: MAXED, evolutionId: 'settler-rail' });
  assert.equal(maxed.burstCount, 3);
  assert.equal(rail.burstCount, 1);
  assert.equal(rail.burstIntervalTicks, 0);
  assert.equal(rail.projectilePolicy.type, 'pierce');
  assert.equal(rail.projectilePolicy.maxTargets, 8);
  assert.ok(rail.projectilePolicy.falloff);
  assert.equal(rail.armorPiercing, true);
  assert.equal(rail.damage, maxed.damage * HMH_EVOLUTION_TUNING['settler-rail'].damageScale);
  assert.equal(rail.cadenceTicks, maxed.cadenceTicks, 'the cadence is the maxed Pistol\'s');
  assert.equal(rail.evolutionTag, 'rail-dividend');
  assert.equal(rail.projectileTag, maxed.projectileTag, 'tags are additive');
});

test('Double Spend: a free half-damage volley 8 ticks after every shot, along that tick\'s aim, with no ammo', () => {
  const byWeapon = mastered('scatter-shotgun', 'double-spend');
  const loadout = armed('scatter-shotgun', byWeapon);
  const fires = [];
  let ammoAtVolley = null;
  for (let tick = 1; tick <= 60; tick += 1) {
    // The trigger is released after the first shot: the volley ignores it.
    const direction = tick >= 9 ? { x: 0, y: 1 } : RIGHT;
    const frame = stepWeaponLoadout(loadout, { tick, fire: tick <= 6, direction, progressionByWeapon: byWeapon });
    for (const event of frame.events.filter((candidate) => candidate.type === 'weapon:fire')) {
      fires.push(event);
      if (event.volley) ammoAtVolley = loadout.weapons['scatter-shotgun'].ammoInClip;
    }
  }
  assert.equal(fires.length, 2, 'one shot and its volley');
  const [shot, volley] = fires;
  assert.equal(volley.tick, shot.tick + 8);
  assert.equal(volley.volley, true);
  assert.equal(volley.attackId, `${shot.attackId}:volley`);
  assert.equal(volley.shots.length, shot.shots.length);
  for (const [index, pellet] of volley.shots.entries()) assert.equal(pellet.damage, shot.shots[index].damage * 0.5);
  assert.ok(volley.shots.every((pellet) => pellet.direction.y > 0.9), 'the volley flies along the aim of its own tick');
  assert.equal(ammoAtVolley, shot.ammoInClip, 'the volley spends no ammo');
  assert.equal(loadout.weapons['scatter-shotgun'].nextFireTick, shot.tick + applyWeaponProgression('scatter-shotgun', byWeapon['scatter-shotgun']).cadenceTicks, 'nextFireTick unchanged');
});

test('Double Spend: a swap or a stow cancels the queued volley; an unevolved Shotgun queues none', () => {
  const byWeapon = mastered('scatter-shotgun', 'double-spend');
  const swapped = armed('scatter-shotgun', byWeapon);
  stepWeaponLoadout(swapped, { tick: 1, fire: true, direction: RIGHT, progressionByWeapon: byWeapon });
  assert.ok(swapped.weapons['scatter-shotgun'].pendingVolley);
  switchWeapon(swapped, 'coin-blaster', { tick: 3 });
  assert.equal(swapped.weapons['scatter-shotgun'].pendingVolley, null);
  switchWeapon(swapped, 'scatter-shotgun', { tick: 5 });
  for (let tick = 5; tick <= 20; tick += 1) {
    const frame = stepWeaponLoadout(swapped, { tick, fire: false, direction: RIGHT, progressionByWeapon: byWeapon });
    assert.ok(!frame.events.some((event) => event.volley), `no volley after a swap (tick ${tick})`);
  }
  const stowed = armed('scatter-shotgun', byWeapon);
  stepWeaponLoadout(stowed, { tick: 1, fire: true, direction: RIGHT, progressionByWeapon: byWeapon });
  for (let tick = 2; tick <= 20; tick += 1) {
    const frame = stepWeaponLoadout(stowed, { tick, fire: false, stowed: tick === 4, direction: RIGHT, progressionByWeapon: byWeapon });
    assert.ok(!frame.events.some((event) => event.volley), `no volley after a stow (tick ${tick})`);
  }
  const plain = armed('scatter-shotgun', mastered('scatter-shotgun'));
  stepWeaponLoadout(plain, { tick: 1, fire: true, direction: RIGHT, progressionByWeapon: mastered('scatter-shotgun') });
  assert.equal(plain.weapons['scatter-shotgun'].pendingVolley, null);
});

test('Hashstorm Overdrive: hot rounds pierce 2 (stamped at fire) and heat 100 vents a ring instead of overheating', () => {
  const byWeapon = mastered('auto-miner', 'hashstorm-overdrive');
  const loadout = armed('auto-miner', byWeapon);
  const progression = applyWeaponProgression('auto-miner', byWeapon['auto-miner']);
  assert.equal(progression.damage, applyWeaponProgression('auto-miner', { branches: MAXED }).damage, 'no damage bonus');
  const fires = [];
  const vents = [];
  let overheats = 0;
  for (let tick = 1; tick <= 400; tick += 1) {
    const frame = stepWeaponLoadout(loadout, { tick, fire: true, direction: RIGHT, progressionByWeapon: byWeapon });
    for (const event of frame.events) {
      if (event.type === 'weapon:fire') fires.push({ event, heatBefore: event.heat - progression.heatPerShot });
      if (event.type === 'weapon:vent') vents.push(event);
      if (event.type === 'weapon:overheat') overheats += 1;
    }
  }
  assert.equal(overheats, 0, 'Overdrive never overheats');
  assert.ok(vents.length >= 1, 'it vents');
  const vent = vents[0];
  assert.deepEqual([vent.radius, vent.damage, vent.knockback], [140, 12, 24]);
  assert.equal(vent.lockUntilTick, vent.tick + 60);
  assert.ok(!fires.some(({ event }) => event.tick > vent.tick && event.tick < vent.lockUntilTick), 'the trigger is locked for 60 ticks');
  for (const { event, heatBefore } of fires) {
    const hot = heatBefore >= 60 - 1e-9;
    assert.equal(event.shots[0].policy.type, hot ? 'pierce' : 'stop', `tick ${event.tick} heat ${heatBefore}`);
    if (hot) assert.equal(event.shots[0].policy.maxTargets, 2);
  }
  // The vented heat is held at 60 through the lock, then cools as usual.
  const probe = armed('auto-miner', byWeapon);
  let lockTick = null;
  for (let tick = 1; lockTick === null && tick <= 400; tick += 1) {
    const frame = stepWeaponLoadout(probe, { tick, fire: true, direction: RIGHT, progressionByWeapon: byWeapon });
    if (frame.events.some((event) => event.type === 'weapon:vent')) lockTick = tick;
  }
  stepWeaponLoadout(probe, { tick: lockTick + 30, fire: false, direction: RIGHT, progressionByWeapon: byWeapon });
  assert.equal(probe.weapons['auto-miner'].heat, 60);
  stepWeaponLoadout(probe, { tick: lockTick + 80, fire: false, direction: RIGHT, progressionByWeapon: byWeapon });
  assert.equal(probe.weapons['auto-miner'].heat, 60 - 20 * progression.heatRecoveryPerTick);
});

test('Crit Candle: each crit kill takes 12 ticks off the next charge, at most 3 per shot, never below 36; a charged slug spends it', () => {
  const byWeapon = mastered('hash-rail', 'crit-candle');
  const loadout = armed('hash-rail', byWeapon);
  const rail = loadout.weapons['hash-rail'];
  const progression = applyWeaponProgression('hash-rail', byWeapon['hash-rail']);
  assert.equal(progression.evolutionTag, 'gold-crit');
  assert.ok(progression.specials.includes('deep-proof'), 'Deep Proof is kept');
  assert.equal(progression.bossArmorPenetration, 0.6);
  assert.equal(effectiveChargeTicks(rail, progression), 56);
  assert.equal(creditCritCandleKills(loadout, { tick: 0, count: 1, progressionByWeapon: byWeapon }).chargeTicks, 44);
  assert.equal(creditCritCandleKills(loadout, { tick: 0, count: 5, progressionByWeapon: byWeapon }).kills, 3);
  assert.equal(effectiveChargeTicks(rail, progression), 36, 'the floor holds');
  assert.equal(creditCritCandleKills(loadout, { tick: 0, count: 1, progressionByWeapon: mastered('hash-rail') }), null, 'an unevolved Railgun takes no credit');
  // The rebated charge fires at 36 ticks, then the next one is back to 56.
  const releases = [];
  for (let tick = 1; tick <= 200 && releases.length < 2; tick += 1) {
    const frame = stepWeaponLoadout(loadout, { tick, fire: true, releaseCharged: true, direction: RIGHT, progressionByWeapon: byWeapon });
    for (const event of frame.events) if (event.type === 'weapon:charge-start' || event.type === 'weapon:fire') releases.push([event.type, event.tick, event.readyTick ?? null]);
  }
  assert.deepEqual(releases[0], ['weapon:charge-start', 1, 37]);
  assert.deepEqual(releases[1], ['weapon:fire', 37, null]);
  assert.equal(rail.candleKills, 0);
});

test('evolved finite guns trickle at least a quarter of the grant every 900 ticks', () => {
  for (const [weaponId, evolutionId] of [['scatter-shotgun', 'double-spend'], ['auto-miner', 'hashstorm-overdrive'], ['hash-rail', 'crit-candle'], ['launcher-rig', 'crypto-bomb-orbit']]) {
    const evolved = applyWeaponProgression(weaponId, { branches: MAXED, evolutionId });
    assert.ok(evolved.reserveTrickleRounds >= Math.ceil(evolved.reserveAmmoGrant / 4), weaponId);
    assert.equal(evolved.reserveTrickleRounds, applyWeaponProgression(weaponId, { branches: MAXED }).reserveTrickleRounds, `${weaponId}: mastery's half already covers it`);
  }
  assert.equal(HMH_RESERVE_TRICKLE_INTERVAL_TICKS, 900);
  assert.equal(applyWeaponProgression('coin-blaster', { branches: MAXED, evolutionId: 'settler-rail' }).reserveTrickleRounds, 0, 'never the Pistol');
});
