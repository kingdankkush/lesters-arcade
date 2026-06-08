import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDamage,
  rollCritical,
  damageTypeColor,
  validateBalance,
  DAMAGE_BALANCE,
  ENEMY_BALANCE,
} from '../apps/portal/src/combat-damage.mjs';

const noCrit = () => 0.99; // rng above crit chance => never crit
const alwaysCrit = () => 0.0; // rng below crit chance => always crit

test('computeDamage applies level-up damage multiplier', () => {
  const base = computeDamage({ source: 'bullet', stats: { damage: 1 }, rng: noCrit });
  const buffed = computeDamage({ source: 'bullet', stats: { damage: 2 }, rng: noCrit });
  assert.ok(buffed.amount > base.amount, 'damage card should increase damage');
  assert.equal(buffed.crit, false);
});

test('computeDamage crits multiply damage and flag crit', () => {
  const normal = computeDamage({ source: 'bullet', stats: { damage: 1 }, rng: noCrit });
  const crit = computeDamage({ source: 'bullet', stats: { damage: 1 }, rng: alwaysCrit });
  assert.equal(crit.crit, true);
  assert.ok(crit.amount > normal.amount);
  assert.match(crit.label, /!$/); // crit label ends with !
  assert.equal(crit.color, DAMAGE_BALANCE.critColor);
});

test('armor-piercing does more vs armored, less vs unarmored', () => {
  const apArmored = computeDamage({ source: 'bullet', type: 'armor-piercing', enemyArmored: true, rng: noCrit });
  const apUnarmored = computeDamage({ source: 'bullet', type: 'armor-piercing', enemyArmored: false, rng: noCrit });
  assert.ok(apArmored.amount > apUnarmored.amount);
});

test('hollow-point does more vs unarmored, less vs armored', () => {
  const hpArmored = computeDamage({ source: 'bullet', type: 'hollow-point', enemyArmored: true, rng: noCrit });
  const hpUnarmored = computeDamage({ source: 'bullet', type: 'hollow-point', enemyArmored: false, rng: noCrit });
  assert.ok(hpUnarmored.amount > hpArmored.amount);
});

test('damage sources have distinct base power (grenade > bullet)', () => {
  const bullet = computeDamage({ source: 'bullet', rng: noCrit });
  const grenade = computeDamage({ source: 'grenade', rng: noCrit });
  assert.ok(grenade.amount > bullet.amount);
});

test('damage is always at least 1', () => {
  const tiny = computeDamage({ source: 'bullet', type: 'hollow-point', enemyArmored: true, stats: { damage: 0.01 }, rng: noCrit });
  assert.ok(tiny.amount >= 1);
});

test('rollCritical honors crit chance bonus', () => {
  // With a huge bonus, even a high rng roll should crit.
  assert.equal(rollCritical({ critChanceBonus: 0.9 }, () => 0.5), true);
  assert.equal(rollCritical({}, () => 0.5), false);
});

test('damageTypeColor returns a color per type and a default', () => {
  assert.equal(typeof damageTypeColor('armor-piercing'), 'string');
  assert.equal(damageTypeColor('nonexistent'), DAMAGE_BALANCE.types.normal.color);
});

test('validateBalance passes for shipped balance', () => {
  const r = validateBalance();
  assert.equal(r.ok, true, `balance errors: ${r.errors.join('; ')}`);
});

test('boss out-scales normal enemies in balance table', () => {
  const boss = ENEMY_BALANCE['evil-boss'];
  assert.ok(boss.hp > ENEMY_BALANCE['crypto-bro'].hp);
  assert.ok(boss.score > ENEMY_BALANCE['gas-beast'].score);
  assert.equal(boss.boss, true);
});
