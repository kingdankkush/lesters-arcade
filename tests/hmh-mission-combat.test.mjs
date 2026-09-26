// Mission core v2 on the combat side (package §3.2 and §3.3, slice S1.4):
// breakables are the lowest-priority auto-aim target; a stowed weapon never
// fires and cancels a charge instead of releasing it; the knife and every
// weapon still hit breakables, which the nuke, world hazards and enemies never
// touch. The main.mjs checks read the real runtime wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAimState, resolveAimIntent } from '../apps/hmh-reboot/src/aim.mjs';
import { createWeaponLoadout, grantWeaponPickup, refillWeaponLoadout, stepWeaponLoadout } from '../apps/hmh-reboot/src/weapon-system.mjs';

const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const idle = { aim: { x: 0, y: 0, active: false }, fire: false };
const crate = { id: 'crate', x: 150, y: 0, active: true };

test('a breakable is auto-aimed only within 200, in sight, and only while no enemy can be targeted', () => {
  const aim = (tick, options) => resolveAimIntent(options.state, { tick, actor: { x: 0, y: 0 }, input: idle, targets: [], fallbackTargets: [crate], ...options });
  const state = createAimState();
  const locked = aim(1, { state });
  assert.deepEqual([locked.source, locked.targetId, locked.fire], ['autofire', 'crate', true]);
  assert.deepEqual(locked.direction, { x: 1, y: 0 });
  assert.equal(aim(2, { state, fallbackTargets: [{ ...crate, x: 201 }] }).targetId, null, 'beyond 200');
  assert.equal(aim(3, { state, fallbackTargets: [crate], fallbackLineOfSight: () => false }).fire, false, 'out of sight');
  const enemy = { id: 'enemy', x: -600, y: 0, active: true };
  assert.equal(aim(4, { state, targets: [enemy] }).targetId, 'enemy', 'any targetable enemy outranks the crate');
  // Manual aim and its hold window are never pulled toward a breakable.
  const manual = createAimState({ manualHoldTicks: 4 });
  const held = resolveAimIntent(manual, { tick: 1, actor: { x: 0, y: 0 }, input: { aim: { x: 0, y: 1, active: true }, fire: false }, targets: [], fallbackTargets: [crate] });
  assert.deepEqual([held.source, held.targetId], ['manual', null]);
  assert.equal(resolveAimIntent(manual, { tick: 2, actor: { x: 0, y: 0 }, input: idle, targets: [], fallbackTargets: [crate] }).source, 'manual-hold');
});

test('without breakables the aim resolves exactly as before', () => {
  const a = createAimState();
  const b = createAimState();
  const targets = [{ id: 'enemy', x: 300, y: 40, active: true }];
  for (let tick = 0; tick < 20; tick += 1) {
    const input = tick % 7 === 0 ? { aim: { x: 1, y: 0, active: true }, fire: false } : idle;
    assert.deepEqual(resolveAimIntent(a, { tick, actor: { x: 0, y: 0 }, input, targets }), resolveAimIntent(b, { tick, actor: { x: 0, y: 0 }, input, targets, fallbackTargets: [] }));
  }
});

test('a stowed weapon never fires, and a charged Railgun is cancelled rather than released', () => {
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'hash-rail'] });
  const direction = { x: 1, y: 0 };
  for (let tick = 0; tick < 30; tick += 1) {
    const frame = stepWeaponLoadout(loadout, { tick, fire: true, direction, stowed: true });
    assert.equal(frame.events.some((event) => event.type === 'weapon:fire'), false);
  }
  grantWeaponPickup(loadout, { tick: 30, weaponId: 'hash-rail', select: true });
  let tick = 40;
  for (; tick < 40 + 80; tick += 1) stepWeaponLoadout(loadout, { tick, fire: true, releaseCharged: false, direction });
  assert.notEqual(loadout.weapons['hash-rail'].chargeStartedTick, null, 'fully charged and held');
  const stowed = stepWeaponLoadout(loadout, { tick, fire: false, releaseCharged: true, direction, stowed: true });
  assert.deepEqual(stowed.events.map((event) => event.type), ['weapon:charge-cancel']);
  assert.equal(loadout.weapons['hash-rail'].ammoInClip, 3, 'no slug left the rail');
  assert.equal(loadout.weapons['hash-rail'].chargeStartedTick, null);
});

test('an ammo grant during an Arc Rifle channel tops up the reserve instead of throwing inside the tick', () => {
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', 'lightning-ledger'] });
  grantWeaponPickup(loadout, { tick: 1, weaponId: 'lightning-ledger', select: true });
  const target = { id: 'enemy', x: 100, y: 0, groundZ: 0, active: true };
  for (let tick = 10; tick < 16; tick += 1) {
    stepWeaponLoadout(loadout, { tick, fire: true, direction: { x: 1, y: 0 }, channelOrigin: { x: 0, y: 0, z: 34 }, channelTargets: [target], currentEligibleTargetIds: ['enemy'] });
  }
  const ledger = loadout.weapons['lightning-ledger'];
  assert.equal(ledger.channelState.active, true);
  const reserveBefore = ledger.reserveAmmo;
  assert.doesNotThrow(() => refillWeaponLoadout(loadout, { tick: 16 }));
  assert.ok(ledger.reserveAmmo >= reserveBefore);
  assert.equal(ledger.channelState.active, true, 'the channel keeps running');
});

test('the runtime suspends auto-fire and the auto-knife while the mission stows the weapon', () => {
  assert.match(source, /fire: aimIntent\.fire,\n\s+stowed: missionState\.stowed,/);
  assert.match(source, /automatic: !rosterPreviewEnabled && !dashFrame\.active && !missionState\.stowed && weaponLoadout\.activeWeaponId !== 'forked-standard',/);
  assert.match(source, /fallbackTargets: breakableAimTargets\(\),/);
});

test('breakables take the knife and weapons but never the nuke, world hazards or enemy strikes', () => {
  // The knife and projectiles keep the breakables in their target lists.
  assert.match(source, /for \(const enemy of \[\.\.\.grayboxEnemies,\.\.\.missionSealTargets\(missionState\),\.\.\.worldDestructibleTargets\(worldDestructibleState\)\]\)/);
  // The nuke skips them.
  assert.match(source, /for \(const target of hurtTargets\) \{\n\s+if \(isBreakableTargetId\(target\.id\)\) continue;/);
  // Fuel blasts chain through drums only.
  assert.match(source, /targets:\[\.\.\.hazardTargets,\.\.\.worldDestructibleTargets\(worldDestructibleState\)\.filter\(target=>FUEL_DRUM_IDS\.has\(target\.id\)\)\]/);
  // Steam, rockfall and the grid hit hazardTargets, which hold no breakable,
  // and every enemy and boss strike names the player.
  assert.doesNotMatch(source.slice(source.indexOf('const hazardTargets = ['), source.indexOf('const bossHazardCap')), /Destructible|missionSealTargets/);
  for (const match of source.matchAll(/targetId: '([^']+)',\n\s+sourceId: (event\.enemyId|liquidatorBoss\.id)/g)) assert.equal(match[1], 'player');
});

test('the mission step runs after movement and before the director, and completion plays no chime', () => {
  const step = source.indexOf('stepMissionObjectives(missionState,');
  assert.ok(step > source.indexOf("actor.locomotion = dashFrame.active ? 'dash' : motion.locomotion;"));
  assert.ok(step < source.indexOf('stepEncounterDirector({'));
  assert.ok(step < source.indexOf('stepLiquidatorBoss({'));
  assert.equal(source.includes("combatAudio.play('objective-complete'"), false);
  assert.match(source, /lastPlayerHitTick: lastPlayerHit\?\.tick \?\? -1,/);
  assert.match(source, /logicalView: directorViewBounds\(\{ x: actor\.x, y: actor\.y \}\),/);
});
