import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_HERO_LOADOUTS,
  HMH_HERO_STARTING_WEAPON_ID,
  HMH_HERO_STAT_MAX,
  HMH_HERO_STAT_TOTAL,
  heroModifiersFor,
} from '../apps/hmh-reboot/src/hero-loadout.mjs';
import { createDashState, beginDash } from '../apps/hmh-reboot/src/dash.mjs';
import { playableCharacterStatIdentityFor } from '../apps/portal/src/hmh-character-config.mjs';

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const HEROES = ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly'];

test('every hero has four 1-5 stats with the same total, the Pistol, and one unique perk', () => {
  assert.deepEqual(Object.keys(HMH_HERO_LOADOUTS), HEROES);
  assert.equal(HMH_HERO_STARTING_WEAPON_ID, 'coin-blaster');
  const perks = new Set();
  for (const id of HEROES) {
    const { stats, perk } = HMH_HERO_LOADOUTS[id];
    const values = [stats.power, stats.speed, stats.armor, stats.luck];
    assert.ok(values.every((value) => Number.isInteger(value) && value >= 1 && value <= HMH_HERO_STAT_MAX), id);
    assert.equal(values.reduce((sum, value) => sum + value, 0), HMH_HERO_STAT_TOTAL, `${id} is balanced`);
    perks.add(perk.id);
  }
  assert.equal(perks.size, HEROES.length);
});

test('stats map to simulation modifiers around the 3-point baseline', () => {
  const commando = heroModifiersFor('lit-commando');
  assert.equal(commando.outgoingDamageMultiplier, 1.05);
  assert.equal(commando.moveSpeedMultiplier, 0.96);
  assert.equal(commando.incomingDamageMultiplier, 0.9);
  assert.equal(commando.maxHealthBonus, 20);
  const valkyrie = heroModifiersFor('lit-valkyrie');
  assert.equal(valkyrie.moveSpeedMultiplier, 1.08);
  assert.equal(valkyrie.incomingDamageMultiplier, 1.05);
  assert.equal(valkyrie.firingMoveSpeedMultiplier, 1.1);
  assert.equal(heroModifiersFor('lester').dashCooldownScale, 0.75);
  const lilly = heroModifiersFor('lilly');
  assert.equal(lilly.criticalChanceBonus, 0.04);
  assert.equal(lilly.criticalDamageBonus, 0.25);
  const neutral = heroModifiersFor('nobody');
  assert.equal(neutral.outgoingDamageMultiplier, 1);
  assert.equal(neutral.maxHealthBonus, 0);
});

test('the portal hero select shows the runtime numbers', () => {
  for (const id of HEROES) {
    const identity = playableCharacterStatIdentityFor(id);
    const { stats, perk } = HMH_HERO_LOADOUTS[id];
    assert.deepEqual(identity.stats.map(([label, value]) => [label, value]), [['Power', stats.power], ['Speed', stats.speed], ['Armor', stats.armor], ['Luck', stats.luck]]);
    assert.equal(identity.passive.id, perk.id);
    assert.equal(identity.startingWeaponId, HMH_HERO_STARTING_WEAPON_ID);
  }
});

test('Block Time scales the dash cooldown; the default stays 600 ticks', () => {
  const plain = createDashState();
  const lester = createDashState({ cooldownScale: heroModifiersFor('lester-original').dashCooldownScale });
  const a = beginDash(plain, { tick: 100, direction: { x: 1, y: 0 } });
  const b = beginDash(lester, { tick: 100, direction: { x: 1, y: 0 } });
  assert.equal(a.cooldownReadyTick, 700);
  assert.equal(b.cooldownReadyTick, 550);
});

test('the HMH runtime applies the session hero to health, damage, movement, crits and dash', () => {
  assert.match(mainSource, /heroModifiers = heroModifiersFor\(payload\.heroId\)/);
  assert.match(mainSource, /maxPlayerHealth = 100 \+ heroModifiers\.maxHealthBonus/);
  assert.match(mainSource, /runEffects\.outgoingDamageMultiplier \* heroModifiers\.outgoingDamageMultiplier/);
  assert.match(mainSource, /heroModifiers\.incomingDamageMultiplier/);
  assert.match(mainSource, /\* heroModifiers\.moveSpeedMultiplier/);
  assert.match(mainSource, /aimIntent\.fire \? heroModifiers\.firingMoveSpeedMultiplier : 1/);
  assert.match(mainSource, /heroModifiers\.criticalChanceBonus/);
  assert.match(mainSource, /heroModifiers\.criticalDamageBonus/);
  assert.match(mainSource, /cooldownScale: heroModifiers\.dashCooldownScale/);
});
