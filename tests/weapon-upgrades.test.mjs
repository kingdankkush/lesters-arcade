import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAPON_UPGRADE_TREES,
  computeWeaponUpgrades,
  reloadProgress,
  effectiveReloadSeconds,
  hasSpecial,
  validateWeaponUpgrades,
} from '../apps/portal/src/weapon-upgrades.mjs';

describe('weapon-upgrades', () => {
  it('computeWeaponUpgrades returns identity defaults', () => {
    const def = computeWeaponUpgrades('coin-blaster', {});
    assert.equal(def.fireRateMultiplier, 1);
    assert.equal(def.damageFlatBonus, 0);
    assert.equal(def.reloadMultiplier, 1);
    assert.deepEqual(def.specials, []);
  });

  it('tier 1 rateOfFire compounds correctly', () => {
    const u = computeWeaponUpgrades('coin-blaster', { rateOfFire: 1 });
    assert.ok(Math.abs(u.fireRateMultiplier - 1.18) < 0.001);
  });

  it('tier 3 damage unlocks special', () => {
    const u = computeWeaponUpgrades('coin-blaster', { damage: 3 });
    assert.equal(u.damageFlatBonus, 5);
    assert.ok(u.specials.includes('armor-piercing'));
  });

  it('tiering clamps to available tiers (graceful)', () => {
    const u = computeWeaponUpgrades('coin-blaster', { rateOfFire: 99 });
    // Should clamp to tier 3 (max) not crash.
    assert.equal(u.fireRateMultiplier, 1.62);
  });

  it('unknown weapon returns identity defaults', () => {
    const u = computeWeaponUpgrades('nonexistent', { rateOfFire: 2 });
    assert.equal(u.fireRateMultiplier, 1);
    assert.equal(u.damageFlatBonus, 0);
  });

  it('multiple branches compound independently', () => {
    const u = computeWeaponUpgrades('scatter-shotgun', { rateOfFire: 1, damage: 2 });
    assert.ok(Math.abs(u.fireRateMultiplier - 1.10) < 0.001);
    assert.equal(u.damageFlatBonus, 3);
  });

  it('reloadProgress returns 0 at start', () => {
    assert.equal(reloadProgress(0, 1.5), 0);
  });

  it('reloadProgress returns 1 when done', () => {
    const p = reloadProgress(90, 1.5, 60); // 90 frames at 60fps = 1.5s
    assert.equal(p, 1);
  });

  it('reloadProgress clamps at 1', () => {
    const p = reloadProgress(120, 1.5, 60);
    assert.equal(p, 1);
  });

  it('effectiveReloadSeconds respects multiplier', () => {
    const effective = effectiveReloadSeconds(3.0, 1.5);
    assert.equal(effective, 2.0);
  });

  it('hasSpecial returns true when special is unlocked', () => {
    assert.ok(hasSpecial('coin-blaster', { reloadSpeed: 3 }, 'extended-mag'));
  });

  it('hasSpecial returns false when special not chosen', () => {
    assert.ok(!hasSpecial('coin-blaster', { reloadSpeed: 2 }, 'extended-mag'));
  });

  it('every weapon has 3 tiers per branch in the tree', () => {
    for (const [weaponId, tree] of Object.entries(WEAPON_UPGRADE_TREES)) {
      for (const branch of ['rateOfFire', 'damage', 'reloadSpeed']) {
        assert.equal(tree[branch].length, 3, `${weaponId}.${branch} should have 3 tiers`);
      }
    }
  });

  it('validateWeaponUpgrades passes all invariants', () => {
    const result = validateWeaponUpgrades();
    assert.ok(result.ok, result.errors.join(', '));
  });
});
