// Design package S0.2 (8.3, 8.5): HMH_WEAPON_ORDER lives in the simulation,
// and the evolution refactor makes tags additive, keys the child's evolutions
// by weapon id, turns Deep Proof's boss penetration and Settler Rail's armour
// piercing into policy flags, and fences the legacy parent evolution map.
// Nothing here changes a run today: no evolution is reachable until the
// Genesis Seal slice, and the only boss target is the Liquidator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import {
  HMH_CHILD_EVOLUTIONS,
  HMH_WEAPON_DEFINITIONS,
  HMH_WEAPON_EVOLUTIONS,
  HMH_WEAPON_ORDER,
  applyWeaponProgression,
  createWeaponLoadout,
  grantWeaponPickup,
  nextOwnedWeaponId,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { resolveTracer } from '../apps/hmh-reboot/src/weapon-vfx.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { HMH_V7_EVOLUTIONS } from '../sdk/hmh-run-contract-v7.mjs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const mainSource = read('apps/hmh-reboot/src/main.mjs');
const weaponSource = read('apps/hmh-reboot/src/weapon-system.mjs');

// ---------------------------------------------------------------------------
// HMH_WEAPON_ORDER
// ---------------------------------------------------------------------------

test('HMH_WEAPON_ORDER is the simulation weapon order: every carryable gun, in catalogue order', () => {
  assert.equal(Object.isFrozen(HMH_WEAPON_ORDER), true);
  assert.deepEqual([...HMH_WEAPON_ORDER].sort(), Object.keys(HMH_WEAPON_DEFINITIONS).sort());
  assert.deepEqual(HMH_WEAPON_ORDER, HMH_RUN_SUMMARY_CATALOGS.weapons.slice(0, HMH_WEAPON_ORDER.length));
  assert.deepEqual(HMH_WEAPON_ORDER, HMH_RUN_SUMMARY_CATALOGS_V7.weapons.slice(0, HMH_WEAPON_ORDER.length));
  // The v7 evolutions catalogue is in weapon order, one per gun.
  assert.deepEqual(HMH_RUN_SUMMARY_CATALOGS_V7.evolutions.map((id) => HMH_V7_EVOLUTIONS[id].weaponId), [...HMH_WEAPON_ORDER]);
  assert.deepEqual(HMH_WEAPON_ORDER, ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard']);
});

test('the swap cycle uses the simulation order by default and main.mjs keeps no copy', () => {
  const loadout = createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, activeWeaponId: 'coin-blaster', seed: 3 });
  grantWeaponPickup(loadout, { tick: 1, weaponId: 'hash-rail' });
  grantWeaponPickup(loadout, { tick: 1, weaponId: 'scatter-shotgun' });
  assert.equal(nextOwnedWeaponId(loadout), 'scatter-shotgun');
  assert.equal(nextOwnedWeaponId(loadout), nextOwnedWeaponId(loadout, HMH_WEAPON_ORDER));
  assert.match(mainSource, /HMH_WEAPON_ORDER as WEAPON_ORDER/);
  assert.doesNotMatch(mainSource, /Object\.freeze\(\['coin-blaster', 'scatter-shotgun'/, 'no literal weapon order in main.mjs');
});

// ---------------------------------------------------------------------------
// Evolutions
// ---------------------------------------------------------------------------

test('HMH_CHILD_EVOLUTIONS is keyed by weapon id and carries the v7 contract ids', () => {
  assert.deepEqual(Object.keys(HMH_CHILD_EVOLUTIONS), [...HMH_WEAPON_ORDER]);
  for (const [weaponId, evolution] of Object.entries(HMH_CHILD_EVOLUTIONS)) {
    assert.equal(HMH_V7_EVOLUTIONS[evolution.id]?.weaponId, weaponId, `${evolution.id} is ${weaponId}'s contract evolution`);
    assert.equal(typeof evolution.evolutionTag, 'string');
    assert.equal('scoreMultiplier' in evolution, false, 'the parent-owned multiplier stays out of the child map');
  }
  assert.equal(Object.isFrozen(HMH_CHILD_EVOLUTIONS['scatter-shotgun']), true);
  // The legacy ids keep their legacy tags; the Launcher is keyed by its weapon id.
  for (const [family, legacy] of Object.entries(HMH_WEAPON_EVOLUTIONS)) {
    const weaponId = family === 'crypto-bombs' ? 'launcher-rig' : family;
    assert.deepEqual([HMH_CHILD_EVOLUTIONS[weaponId].id, HMH_CHILD_EVOLUTIONS[weaponId].evolutionTag], [legacy.id, legacy.projectileTag]);
  }
  assert.equal(HMH_CHILD_EVOLUTIONS['scatter-shotgun'].id, 'double-spend');
});

test('tags are additive: an evolution keeps the special projectile tag and adds its own evolution tag', () => {
  const deepProofCandle = applyWeaponProgression('hash-rail', { branches: { damage: 3 }, evolutionId: 'crit-candle' });
  assert.equal(deepProofCandle.projectileTag, 'deep-proof');
  assert.equal(deepProofCandle.evolutionTag, 'gold-crit');
  assert.equal(deepProofCandle.evolutionId, 'crit-candle');
  const tracerOverdrive = applyWeaponProgression('auto-miner', { branches: { damage: 3 }, evolutionId: 'hashstorm-overdrive' });
  assert.equal(tracerOverdrive.projectileTag, 'tracer-round');
  assert.equal(tracerOverdrive.evolutionTag, 'overdrive-barrage');
  const plain = applyWeaponProgression('hash-rail', { branches: { damage: 3 } });
  assert.equal(plain.evolutionTag, null);
  assert.equal(plain.evolutionId, null);
  for (const weaponId of HMH_WEAPON_ORDER) {
    const progression = applyWeaponProgression(weaponId);
    assert.equal(progression.evolutionTag, null, weaponId);
    assert.equal(progression.armorPiercing, false, weaponId);
    assert.equal(progression.bossArmorPenetration, 0, weaponId);
    assert.equal('scoreMultiplier' in progression || 'score' in progression, false, weaponId);
  }
});

test('evolutions resolve by weapon id: the Shotgun no longer throws, wave 2 still waits for its policies', () => {
  const orbit = applyWeaponProgression('launcher-rig', { evolutionId: 'crypto-bomb-orbit' });
  assert.equal(orbit.evolutionTag, 'orbit-bomb');
  const doubleSpend = applyWeaponProgression('scatter-shotgun', { branches: { rateOfFire: 3, damage: 3, reloadSpeed: 3 }, evolutionId: 'double-spend' });
  assert.equal(doubleSpend.evolutionTag, 'double-spend');
  assert.equal(doubleSpend.pelletCount, 14, 'the capstones still apply');
  assert.throws(() => applyWeaponProgression('scatter-shotgun', { evolutionId: 'settler-rail' }), /evolution/i);
  assert.throws(() => applyWeaponProgression('lightning-ledger', { evolutionId: 'lightning-network' }), /evolution/i);
  assert.throws(() => applyWeaponProgression('bear-market-burner', { evolutionId: 'burn-address' }), /evolution/i);
  assert.throws(() => applyWeaponProgression('forked-standard', { evolutionId: 'chain-split' }), /evolution/i);
});

test('Settler Rail sets armour piercing and Deep Proof sets a boss armour penetration flag', () => {
  const settler = applyWeaponProgression('coin-blaster', { evolutionId: 'settler-rail' });
  assert.equal(settler.armorPiercing, true);
  assert.deepEqual(settler.projectilePolicy, { type: 'pierce', maxTargets: 8, falloff: { farScale: 0.35 } });
  assert.equal(applyWeaponProgression('coin-blaster', { branches: { damage: 3 } }).armorPiercing, false, 'the armor-piercing capstone pierces bodies, not armour');
  assert.equal(applyWeaponProgression('hash-rail', { branches: { damage: 3 } }).bossArmorPenetration, 0.6);
  assert.equal(applyWeaponProgression('hash-rail', { branches: { damage: 2 } }).bossArmorPenetration, 0);
});

test('shots carry the evolution tag and both armour flags from the progression', () => {
  const loadout = createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, activeWeaponId: 'coin-blaster', seed: 11 });
  grantWeaponPickup(loadout, { tick: 1, weaponId: 'hash-rail', select: true });
  const progressionByWeapon = { 'hash-rail': { branches: { damage: 3 }, evolutionId: 'crit-candle' } };
  let shots = [];
  for (let tick = 1; tick <= 200 && shots.length === 0; tick += 1) {
    const frame = stepWeaponLoadout(loadout, { tick, fire: true, releaseCharged: tick > 90, direction: { x: 1, y: 0 }, progressionByWeapon });
    shots = frame.events.filter((event) => event.type === 'weapon:fire').flatMap((event) => event.shots ?? []);
  }
  assert.ok(shots.length > 0, 'the railgun fires');
  for (const shot of shots) {
    assert.equal(shot.projectileTag, 'deep-proof');
    assert.equal(shot.evolutionTag, 'gold-crit');
    assert.equal(shot.bossArmorPenetration, 0.6);
    assert.equal(shot.armorPiercing, false);
  }
});

test('main.mjs reads the flags: boss penetration applies to any boss target and the dead tag check is gone', () => {
  assert.doesNotMatch(mainSource, /shot\.projectileTag === 'armor-piercing'/);
  assert.doesNotMatch(mainSource, /hit\.targetId === 'boss-liquidator' \? 0\.6/);
  assert.match(mainSource, /armorPiercing: shot\.armorPiercing === true,/);
  assert.match(mainSource, /armorPenetration: isBossTargetId\(hit\.targetId\) \? shot\.bossArmorPenetration : 0,/);
  assert.match(mainSource, /const isBossTargetId = \(targetId\) => typeof targetId === 'string' && targetId\.startsWith\('boss-'\);/);
  // The live projectile keeps the shot's flags and tags.
  assert.match(mainSource, /evolutionTag: shot\.evolutionTag \?\? null,\n\s*armorPiercing: shot\.armorPiercing === true,\n\s*bossArmorPenetration: shot\.bossArmorPenetration \?\? 0,/);
  assert.match(mainSource, /resolveTracer\(\{ weaponId: shot\.weaponId, policyType: shot\.policy\?\.type, projectileTag: shot\.projectileTag, evolutionTag: shot\.evolutionTag,/);
});

test('the tracer reads both tags; an evolved round reads as upgraded without losing a lane identity', () => {
  const plain = resolveTracer({ weaponId: 'scatter-shotgun', policyType: 'pellet' });
  const evolved = resolveTracer({ weaponId: 'scatter-shotgun', policyType: 'pellet', evolutionTag: 'double-spend' });
  assert.notEqual(evolved, plain);
  assert.equal(evolved, resolveTracer({ weaponId: 'coin-blaster', projectileTag: 'tracer-round' }));
  assert.equal(resolveTracer({ weaponId: 'hash-rail', policyType: 'pierce', evolutionTag: 'gold-crit' }), resolveTracer({ weaponId: 'hash-rail', policyType: 'pierce' }));
  assert.equal(resolveTracer({ weaponId: 'coin-blaster', policyType: 'pierce', evolutionTag: 'rail-dividend' }).style, 'lance');
});

test('the legacy parent evolution map is fenced: the simulation never reads it', () => {
  const ast = parse(weaponSource, { sourceType: 'module', ecmaVersion: 'latest' });
  const apply = ast.body.find((node) => node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name === 'applyWeaponProgression');
  const applySource = weaponSource.slice(apply.start, apply.end);
  assert.doesNotMatch(applySource, /HMH_WEAPON_EVOLUTIONS/);
  assert.match(applySource, /HMH_CHILD_EVOLUTIONS\[weaponId\]/);
  assert.doesNotMatch(weaponSource, /evolutionFamilyForWeapon/);
  const uses = weaponSource.match(/HMH_WEAPON_EVOLUTIONS/g) ?? [];
  assert.equal(uses.length, 1, 'declared once, read nowhere in the child');
});
