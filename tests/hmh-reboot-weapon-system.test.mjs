import assert from 'node:assert/strict';
import test from 'node:test';
import {
  grantWeaponPickup,
  HMH_WEAPON_DEFINITIONS,
  HMH_WEAPON_EVOLUTIONS,
  applyWeaponProgression,
  createWeaponLoadout,
  getWeaponReadabilityStatus,
  refillWeaponLoadout,
  selectWeapon,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { expectedCombatHitDamage, resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { LESTER_BLASTER_WEAPON_SYSTEM } from '../apps/portal/src/arcade-core.mjs';
import { computeWeaponUpgrades } from '../apps/portal/src/weapon-upgrades.mjs';

const direction = Object.freeze({ x: 1, y: 0 });

test('expected hit damage mirrors rounded combat branches and caps critical chance', () => {
  assert.equal(expectedCombatHitDamage({ damage: 10, armor: 2, criticalChance: 0 }), 5);
  assert.equal(expectedCombatHitDamage({ damage: 10, armor: 2, criticalChance: 0.25, criticalMultiplier: 2 }), 6.25);
  assert.equal(expectedCombatHitDamage({ damage: 10, armor: 2, criticalChance: 2, criticalMultiplier: 2 }), 10);
  assert.equal(expectedCombatHitDamage({ damage: 10, armor: 4, armorPiercing: true, critChance: 0.5, critMultiplier: 2 }), 15);
});

function fireAt(state, tick, options = {}) {
  return stepWeaponLoadout(state, { tick, fire: true, direction, ...options });
}

function weaponState(state, id = state.activeWeaponId) {
  return state.weapons[id];
}

test('weapon definitions preserve retained IDs and exact approved numeric values', () => {
  const legacyById = Object.fromEntries(LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.map((weapon) => [weapon.id, weapon]));
  assert.deepEqual(Object.keys(HMH_WEAPON_DEFINITIONS).sort(), ['auto-miner', 'coin-blaster', 'launcher-rig', 'scatter-shotgun']);
  for (const id of ['coin-blaster', 'scatter-shotgun', 'auto-miner']) {
    const actual = HMH_WEAPON_DEFINITIONS[id];
    const legacy = legacyById[id];
    assert.equal(actual.damage, legacy.damage, `${id} damage drifted`);
    assert.equal(actual.fireRatePerSecond, legacy.fireRatePerSecond, `${id} fire rate drifted`);
    assert.equal(actual.reloadSeconds, legacy.reloadSeconds, `${id} reload drifted`);
    assert.equal(actual.clipSize, legacy.clip, `${id} clip drifted`);
    assert.ok(actual.recoil > 0, `${id} recoil must be explicit`);
  }
  assert.equal(HMH_WEAPON_DEFINITIONS['scatter-shotgun'].pelletCount, 8);
  assert.equal(HMH_WEAPON_DEFINITIONS['launcher-rig'].grenadeId, 'satoshi-frag');
  assert.equal(HMH_WEAPON_DEFINITIONS['launcher-rig'].compatibilityId, 'launcher-rig');
  assert.equal(Object.isFrozen(HMH_WEAPON_DEFINITIONS), true);
  assert.equal(Object.isFrozen(HMH_WEAPON_DEFINITIONS['coin-blaster']), true);
});

test('retained weapon evolution IDs and parent-owned score multipliers stay connected', () => {
  assert.deepEqual(HMH_WEAPON_EVOLUTIONS, {
    'coin-blaster': { id: 'settler-rail', projectileTag: 'rail-dividend', scoreMultiplier: 1.35 },
    'auto-miner': { id: 'hashstorm-overdrive', projectileTag: 'overdrive-barrage', scoreMultiplier: 1.3 },
    'hash-rail': { id: 'crit-candle', projectileTag: 'gold-crit', scoreMultiplier: 1.4 },
    'crypto-bombs': { id: 'crypto-bomb-orbit', projectileTag: 'orbit-bomb', scoreMultiplier: 1.25 },
  });
});

test('pistol cadence ammo and timed automatic reload are deterministic at 60 Hz', () => {
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster'], seed: 17 });
  const first = fireAt(state, 1);
  assert.equal(first.events[0].type, 'weapon:fire');
  assert.equal(first.events[0].weaponId, 'coin-blaster');
  assert.equal(first.events[0].shots.length, 1);
  assert.equal(first.events[0].recoil, HMH_WEAPON_DEFINITIONS['coin-blaster'].recoil);
  assert.equal(weaponState(state).ammoInClip, 7);
  // Cycle 049 cadence: 3.0/s at 60 Hz = a 20-tick interval.
  assert.equal(fireAt(state, 2).events.length, 0);
  assert.equal(fireAt(state, 20).events.length, 0);
  assert.equal(fireAt(state, 21).events[0].type, 'weapon:fire');

  for (let tick = 41; weaponState(state).ammoInClip > 0; tick += 20) fireAt(state, tick);
  assert.equal(weaponState(state).ammoInClip, 0);
  const reloadStart = weaponState(state).reloadStartedTick;
  const reloadComplete = weaponState(state).reloadCompleteTick;
  assert.equal(reloadComplete - reloadStart, 90);
  assert.equal(fireAt(state, reloadComplete - 1).events.length, 0);
  const completed = fireAt(state, reloadComplete);
  assert.ok(completed.events.some((event) => event.type === 'weapon:reload-complete'));
  assert.ok(completed.events.some((event) => event.type === 'weapon:fire'));
  assert.equal(weaponState(state).ammoInClip, 7);
});

test('weapon readability reports deterministic reload timing and clip context without changing authority', () => {
  const state = createWeaponLoadout({ weaponIds: ['scatter-shotgun'], activeWeaponId: 'scatter-shotgun', seed: 17 });
  fireAt(state, 0);
  fireAt(state, 64);
  const before = structuredClone(state);
  const status = getWeaponReadabilityStatus(state, { tick: 64 });
  assert.deepEqual(status, {
    weaponId: 'scatter-shotgun',
    displayName: 'Shotgun',
    mode: 'reloading',
    owned: true,
    reserveAmmo: 12,
    ammoInClip: 0,
    clipSize: 2,
    heat: 0,
    ticksRemaining: 120,
    secondsRemaining: 2,
    hudLabel: 'SHOTGUN 0/2 // RELOAD 2.0S',
    accessibleLabel: 'Shotgun, 0 of 2 rounds, reloading, 2.0 seconds remaining',
  });
  assert.deepEqual(state, before, 'projection status must not mutate deterministic weapon state');
  assert.equal(Object.isFrozen(status), true);
  assert.throws(() => getWeaponReadabilityStatus(state, { tick: 63 }), /monotonic|tick/i);
});

test('shotgun produces stable seeded pellet ordering and seed-sensitive spread', () => {
  const a = createWeaponLoadout({ weaponIds: ['scatter-shotgun'], activeWeaponId: 'scatter-shotgun', seed: 0x1234 });
  const b = createWeaponLoadout({ weaponIds: ['scatter-shotgun'], activeWeaponId: 'scatter-shotgun', seed: 0x1234 });
  const c = createWeaponLoadout({ weaponIds: ['scatter-shotgun'], activeWeaponId: 'scatter-shotgun', seed: 0x5678 });
  const aShots = fireAt(a, 1).events[0].shots;
  const bShots = fireAt(b, 1).events[0].shots;
  const cShots = fireAt(c, 1).events[0].shots;
  assert.equal(aShots.length, 8);
  assert.deepEqual(aShots, bShots);
  assert.notDeepEqual(aShots.map((shot) => shot.angleOffset), cShots.map((shot) => shot.angleOffset));
  assert.deepEqual(aShots.map((shot) => shot.pelletIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(aShots.every((shot) => shot.policy.type === 'pellet'));
});

test('machine gun sustains deterministic automatic fire, then observes the retained slow reload', () => {
  const state = createWeaponLoadout({ weaponIds: ['auto-miner'], activeWeaponId: 'auto-miner', seed: 99 });
  let shots = 0;
  let reloadStarts = 0;
  let reloadCompletes = 0;
  let overheats = 0;
  let heatReady = 0;
  for (let tick = 1; tick <= 3_600; tick += 1) {
    for (const event of fireAt(state, tick).events) {
      if (event.type === 'weapon:fire') shots += 1;
      if (event.type === 'weapon:reload-start') reloadStarts += 1;
      if (event.type === 'weapon:reload-complete') reloadCompletes += 1;
      if (event.type === 'weapon:overheat') overheats += 1;
      if (event.type === 'weapon:heat-ready') heatReady += 1;
    }
  }
  assert.ok(shots > 0 && shots < 580);
  assert.ok(reloadStarts > 0 && reloadCompletes > 0);
  assert.ok(overheats > 0);
  assert.ok(heatReady > 0);
  assert.ok(Number.isFinite(weaponState(state).heat));
  assert.ok(weaponState(state).heat >= 0 && weaponState(state).heat <= HMH_WEAPON_DEFINITIONS['auto-miner'].maxHeat);
});

test('weapon switching preserves each magazine and applies an explicit deterministic switch lockout', () => {
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster', 'scatter-shotgun'], seed: 8 });
  // Cycle 036 Priority D: pickups start unowned; grant before switching.
  grantWeaponPickup(state, { tick: 1, weaponId: 'scatter-shotgun', select: false });
  fireAt(state, 1);
  assert.equal(weaponState(state, 'coin-blaster').ammoInClip, 7);
  const switched = selectWeapon(state, 'scatter-shotgun', { tick: 2 });
  assert.equal(switched.type, 'weapon:switch');
  assert.equal(state.activeWeaponId, 'scatter-shotgun');
  assert.equal(fireAt(state, switched.readyTick - 1).events.length, 0);
  assert.equal(fireAt(state, switched.readyTick).events[0].weaponId, 'scatter-shotgun');
  selectWeapon(state, 'coin-blaster', { tick: switched.readyTick + 1 });
  assert.equal(weaponState(state, 'coin-blaster').ammoInClip, 7);
  assert.throws(() => selectWeapon(state, 'missing', { tick: 99 }), /unknown weapon/i);
});

test('grenade launcher uses the retained launcher-rig and satoshi-frag compatibility IDs', () => {
  const state = createWeaponLoadout({ weaponIds: ['launcher-rig'], activeWeaponId: 'launcher-rig', seed: 7 });
  const event = fireAt(state, 1).events[0];
  assert.equal(event.type, 'weapon:fire');
  assert.equal(event.weaponId, 'launcher-rig');
  assert.equal(event.shots.length, 1);
  assert.equal(event.shots[0].kind, 'grenade-launch');
  assert.equal(event.shots[0].grenadeId, 'satoshi-frag');
  assert.equal(event.shots[0].policy.type, 'splash');
});

test('weapon upgrade branches match the retained upgrade tree and evolution tags do not calculate score', () => {
  const branches = { rateOfFire: 2, damage: 3, reloadSpeed: 1 };
  const expected = computeWeaponUpgrades('coin-blaster', branches);
  const actual = applyWeaponProgression('coin-blaster', { branches, evolutionId: 'settler-rail' });
  assert.equal(actual.fireRateMultiplier, expected.fireRateMultiplier);
  assert.equal(actual.damageFlatBonus, expected.damageFlatBonus);
  assert.equal(actual.reloadMultiplier, expected.reloadMultiplier);
  assert.deepEqual(actual.specials, expected.specials);
  assert.equal(actual.damage, 8);
  assert.equal(actual.clipSize, 8);
  assert.equal(actual.projectileTag, 'rail-dividend');
  assert.equal('score' in actual, false);
  assert.throws(() => applyWeaponProgression('coin-blaster', { evolutionId: 'hashstorm-overdrive' }), /evolution/i);
});

test('combat events resolve stable hit order, seeded criticals, shields, armor, knockback, death, and parent score interface', () => {
  const hits = [
    { id: 'hit-b', tick: 2, time: 0.2, targetId: 'enemy-b', sourceId: 'player', weaponId: 'coin-blaster', damage: 9, criticalChance: 0, direction: { x: 1, y: 0 }, knockback: 12 },
    { id: 'hit-a', tick: 2, time: 0.1, targetId: 'enemy-a', sourceId: 'player', weaponId: 'scatter-shotgun', damage: 12, criticalChance: 1, criticalMultiplier: 2, direction: { x: 0, y: 1 }, knockback: 20 },
    { id: 'hit-c', tick: 3, time: 0, targetId: 'enemy-b', sourceId: 'player', weaponId: 'coin-blaster', damage: 9, criticalChance: 0, armorPiercing: true, direction: { x: 1, y: 0 }, knockback: 12 },
  ];
  const targets = [
    { id: 'enemy-b', health: 8, maxHealth: 8, armor: 3, shieldCharges: 1, knockbackResistance: 0.5 },
    { id: 'enemy-a', health: 20, maxHealth: 20, armor: 2, shieldCharges: 0, knockbackResistance: 1 },
  ];
  const first = resolveCombatHits({ sessionSeed: 0xabcdef01, hits, targets });
  const second = resolveCombatHits({ sessionSeed: 0xabcdef01, hits: [...hits].reverse(), targets: [...targets].reverse() });
  assert.deepEqual(first, second);
  assert.deepEqual(first.damageEvents.map((event) => event.hitId), ['hit-a', 'hit-b', 'hit-c']);
  assert.equal(first.damageEvents[0].critical, true);
  assert.equal(first.damageEvents[0].damageApplied, 12);
  assert.deepEqual(first.damageEvents[0].knockback, { x: 0, y: 20 });
  assert.equal(first.damageEvents[1].shielded, true);
  assert.equal(first.damageEvents[1].damageApplied, 0);
  assert.equal(first.damageEvents[2].damageApplied, 9);
  assert.equal(first.targets['enemy-b'].health, 0);
  assert.equal(first.deathEvents.length, 1);
  assert.equal(first.scoreEvents.length, 1);
  assert.deepEqual(first.scoreEvents[0], {
    type: 'enemy:defeated',
    eventId: 'defeat:hit-c:enemy-b',
    enemyId: 'enemy-b',
    sourceId: 'player',
    weaponId: 'coin-blaster',
    critical: false,
  });
  assert.equal('score' in first.scoreEvents[0], false);
  assert.equal('scoreDelta' in first.scoreEvents[0], false);
});

test('invalid weapon and combat inputs fail closed', () => {
  assert.throws(() => createWeaponLoadout({ weaponIds: ['unknown'] }), /unknown weapon/i);
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster'] });
  assert.throws(() => fireAt(state, 1, { direction: { x: 0, y: 0 } }), /direction/i);
  fireAt(state, 2);
  assert.throws(() => fireAt(state, 2), /monotonic/i);
  assert.throws(() => resolveCombatHits({ sessionSeed: -1, hits: [], targets: [] }), /seed/i);
  assert.throws(() => resolveCombatHits({
    sessionSeed: 1,
    hits: [{ id: 'x', targetId: 'missing', sourceId: 'player', weaponId: 'coin-blaster', damage: 1 }],
    targets: [],
  }), /target/i);
});

test('knockback resistance reduces knockback instead of amplifying it', async () => {
  const { resolveCombatHits } = await import('../apps/hmh-reboot/src/combat-events.mjs');
  const hitFor = (targetId) => ({
    id: `hit-${targetId}`, targetId, sourceId: 'player', weaponId: 'settler-pistol',
    tick: 1, damage: 20, criticalChance: 0, knockback: 10,
    direction: { x: 1, y: 0 }, point: { x: 0, y: 0, z: 0 },
  });
  const resolution = resolveCombatHits({
    sessionSeed: 3,
    hits: [hitFor('light'), hitFor('heavy')],
    targets: [
      { id: 'light', health: 100, maxHealth: 100, armor: 1, shieldCharges: 0, knockbackResistance: 0.5 },
      { id: 'heavy', health: 100, maxHealth: 100, armor: 1, shieldCharges: 0, knockbackResistance: 2 },
    ],
  });
  const magnitude = (id) => {
    const event = resolution.damageEvents.find((candidate) => candidate.targetId === id);
    return Math.hypot(event.knockback.x, event.knockback.y);
  };
  assert.ok(magnitude('light') > magnitude('heavy'), `resistant target must move less (light=${magnitude('light')} heavy=${magnitude('heavy')})`);
});

test('zero knockback resistance is rejected rather than launching the target', () => {
  assert.throws(() => resolveCombatHits({
    sessionSeed: 1,
    hits: [{
      id: 'h', targetId: 'zero', sourceId: 'player', weaponId: 'settler-pistol',
      tick: 1, damage: 10, criticalChance: 0, knockback: 10,
      direction: { x: 1, y: 0 }, point: { x: 0, y: 0, z: 0 },
    }],
    targets: [{ id: 'zero', health: 50, maxHealth: 50, armor: 1, shieldCharges: 0, knockbackResistance: 0 }],
  }), /knockbackResistance/);
});

test('weapon-cache refill restores bounded state and can select without consuming the fixed tick', () => {
  const state = createWeaponLoadout({ weaponIds: ['coin-blaster', 'auto-miner'], activeWeaponId: 'coin-blaster' });
  grantWeaponPickup(state, { tick: 0, weaponId: 'auto-miner', select: false });
  fireAt(state, 0);
  const auto = state.weapons['auto-miner'];
  auto.ammoInClip = 0;
  auto.heat = 80;
  auto.overheated = true;
  auto.reloadStartedTick = 0;
  auto.reloadCompleteTick = 99;
  const event = refillWeaponLoadout(state, { tick: 1, weaponId: 'auto-miner', select: true });
  assert.equal(event.type, 'weapon:pickup-refill');
  assert.equal(state.activeWeaponId, 'auto-miner');
  assert.equal(auto.ammoInClip, HMH_WEAPON_DEFINITIONS['auto-miner'].clipSize);
  assert.equal(auto.heat, 0);
  assert.equal(auto.overheated, false);
  assert.equal(auto.reloadStartedTick, null);
  assert.equal(state.lastTick, 0);
  assert.doesNotThrow(() => stepWeaponLoadout(state, { tick: 1, fire: false, direction }));
});
