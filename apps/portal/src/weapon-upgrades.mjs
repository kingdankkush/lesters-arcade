// Hard Money Heroes — weapon upgrade trees + reload mechanics (pure, testable).
//
// Each weapon has a branching upgrade tree with multiple tiers. Players pick ONE
// branch per upgrade (rateOfFire, damage, reloadSpeed) and it compounds. Higher
// tiers unlock special modifiers (piercing shots, explosive rounds, extended mags).
//
// Reload mechanics provide visual/UX feedback: animated reload bar, shell-chambering
// frames for shotgun, belt-feed animation for MG. The runtime calls reloadProgress()
// each frame to get a 0..1 value for the HUD bar.
//
// This module owns no state — it takes weapon stats + upgrade choices and returns
// computed results. The runtime tracks reloadStartFrame and currentAmmo separately.

// Weapon upgrade tree: each branch has tiers with compounding effects.
// Tier 1: baseline stat improvement
// Tier 2: enhanced stat + minor modifier
// Tier 3: maxed stat + unlock special ability
export const WEAPON_UPGRADE_TREES = Object.freeze({
  'coin-blaster': {
    rateOfFire: [
      { tier: 1, effect: '+18% fire rate', multiplier: 1.18 },
      { tier: 2, effect: '+38% fire rate (compounded)', multiplier: 1.38 },
      { tier: 3, effect: '+62% fire rate + rapid-fire burst', multiplier: 1.62, special: 'burst-fire' },
    ],
    damage: [
      { tier: 1, effect: '+1 damage per shot', flatBonus: 1 },
      { tier: 2, effect: '+3 damage per shot', flatBonus: 3 },
      { tier: 3, effect: '+5 damage + armor-piercing rounds', flatBonus: 5, special: 'armor-piercing' },
    ],
    reloadSpeed: [
      { tier: 1, effect: '+22% reload speed', multiplier: 1.22 },
      { tier: 2, effect: '+48% reload speed (compounded)', multiplier: 1.48 },
      { tier: 3, effect: '+78% reload speed + extended mag (12 rounds)', multiplier: 1.78, special: 'extended-mag' },
    ],
  },
  'scatter-shotgun': {
    rateOfFire: [
      { tier: 1, effect: '+10% fire rate', multiplier: 1.10 },
      { tier: 2, effect: '+22% fire rate', multiplier: 1.22 },
      { tier: 3, effect: '+36% fire rate + double-barrel burst', multiplier: 1.36, special: 'double-barrel' },
    ],
    damage: [
      { tier: 1, effect: '+1 pellet damage', flatBonus: 1 },
      { tier: 2, effect: '+3 pellet damage', flatBonus: 3 },
      { tier: 3, effect: '+5 pellet damage + explosive shells', flatBonus: 5, special: 'explosive' },
    ],
    reloadSpeed: [
      { tier: 1, effect: '+18% reload speed', multiplier: 1.18 },
      { tier: 2, effect: '+40% reload speed', multiplier: 1.40 },
      { tier: 3, effect: '+66% reload speed + quad-shell clip (4 rounds)', multiplier: 1.66, special: 'quad-shell' },
    ],
  },
  'auto-miner': {
    rateOfFire: [
      { tier: 1, effect: '+20% fire rate', multiplier: 1.20 },
      { tier: 2, effect: '+44% fire rate', multiplier: 1.44 },
      { tier: 3, effect: '+72% fire rate + overheat cooldown reduction', multiplier: 1.72, special: 'overheat-reduction' },
    ],
    damage: [
      { tier: 1, effect: '+1 damage every 2 tiers', flatBonus: 0.5 },
      { tier: 2, effect: '+1 damage per shot', flatBonus: 1 },
      { tier: 3, effect: '+2 damage + tracer rounds (ignores armor)', flatBonus: 2, special: 'tracer-rounds' },
    ],
    reloadSpeed: [
      { tier: 1, effect: '+25% reload speed', multiplier: 1.25 },
      { tier: 2, effect: '+56% reload speed', multiplier: 1.56 },
      { tier: 3, effect: '+95% reload speed + drum mag (180 rounds)', multiplier: 1.95, special: 'drum-mag' },
    ],
  },
  'spread-ltc': {
    rateOfFire: [
      { tier: 1, effect: '+12% fire rate', multiplier: 1.12 },
      { tier: 2, effect: '+26% fire rate', multiplier: 1.26 },
      { tier: 3, effect: '+42% fire rate + ricochet rounds', multiplier: 1.42, special: 'ricochet' },
    ],
    damage: [
      { tier: 1, effect: '+1 pellet damage', flatBonus: 1 },
      { tier: 2, effect: '+2 pellet damage + wider spread', flatBonus: 2 },
      { tier: 3, effect: '+4 pellet damage + homing coins', flatBonus: 4, special: 'homing' },
    ],
    reloadSpeed: [
      { tier: 1, effect: '+15% reload speed', multiplier: 1.15 },
      { tier: 2, effect: '+33% reload speed', multiplier: 1.33 },
      { tier: 3, effect: '+54% reload speed + auto-reload on empty', multiplier: 1.54, special: 'auto-reload' },
    ],
  },
  'hash-rail': {
    rateOfFire: [
      { tier: 1, effect: '+8% fire rate', multiplier: 1.08 },
      { tier: 2, effect: '+18% fire rate', multiplier: 1.18 },
      { tier: 3, effect: '+30% fire rate + piercing beam', multiplier: 1.30, special: 'piercing-beam' },
    ],
    damage: [
      { tier: 1, effect: '+2 damage per shot', flatBonus: 2 },
      { tier: 2, effect: '+5 damage per shot', flatBonus: 5 },
      { tier: 3, effect: '+9 damage + rail-piercing (hits 2 enemies)', flatBonus: 9, special: 'rail-piercing' },
    ],
    reloadSpeed: [
      { tier: 1, effect: '+20% reload speed', multiplier: 1.20 },
      { tier: 2, effect: '+44% reload speed', multiplier: 1.44 },
      { tier: 3, effect: '+72% reload speed + quick-charge capacitor', multiplier: 1.72, special: 'quick-charge' },
    ],
  },
});

// Compute upgraded weapon stats given a weapon ID and upgrade choices.
// Returns { fireRateMultiplier, damageFlatBonus, reloadMultiplier, specials[] }.
export function computeWeaponUpgrades(weaponId, upgradeChoices = {}) {
  const tree = WEAPON_UPGRADE_TREES[weaponId];
  if (!tree) return { fireRateMultiplier: 1, damageFlatBonus: 0, reloadMultiplier: 1, specials: [] };

  let fireRateMultiplier = 1;
  let damageFlatBonus = 0;
  let reloadMultiplier = 1;
  const specials = [];

  for (const branch of ['rateOfFire', 'damage', 'reloadSpeed']) {
    const choice = upgradeChoices[branch];
    if (!choice || !tree[branch]) continue;
    const tier = Math.min(choice, tree[branch].length);
    const node = tree[branch][tier - 1];
    if (node) {
      if (branch === 'rateOfFire') fireRateMultiplier *= node.multiplier ?? 1;
      if (branch === 'damage') damageFlatBonus += node.flatBonus ?? 0;
      if (branch === 'reloadSpeed') reloadMultiplier *= node.multiplier ?? 1;
      if (node.special) specials.push(node.special);
    }
  }

  return Object.freeze({ fireRateMultiplier, damageFlatBonus, reloadMultiplier, specials });
}

// Reload progress: 0..1 value for HUD bar. Takes elapsed frames since reload started
// and the weapon's reloadSeconds (affected by upgrade multiplier).
export function reloadProgress(framesSinceReload, reloadSeconds, framesPerSecond = 60) {
  if (framesSinceReload <= 0) return 0;
  const progress = (framesSinceReload / framesPerSecond) / reloadSeconds;
  return Math.min(1, progress);
}

// Compute effective reload time after upgrades.
export function effectiveReloadSeconds(baseReloadSeconds, reloadMultiplier) {
  return baseReloadSeconds / (reloadMultiplier || 1);
}

// Check if weapon has a special ability active.
export function hasSpecial(weaponId, upgradeChoices, specialName) {
  const upgrades = computeWeaponUpgrades(weaponId, upgradeChoices);
  return upgrades.specials.includes(specialName);
}

// Validate weapon upgrade tree consistency (called during npm test).
export function validateWeaponUpgrades() {
  const errors = [];
  for (const [weaponId, tree] of Object.entries(WEAPON_UPGRADE_TREES)) {
    for (const branch of ['rateOfFire', 'damage', 'reloadSpeed']) {
      if (!tree[branch]) {
        errors.push(`${weaponId} missing ${branch} branch`);
        continue;
      }
      if (tree[branch].length !== 3) {
        errors.push(`${weaponId}.${branch} should have 3 tiers, got ${tree[branch].length}`);
      }
      for (let i = 0; i < tree[branch].length; i++) {
        const node = tree[branch][i];
        if (node.tier !== i + 1) errors.push(`${weaponId}.${branch} tier ${i} has wrong tier number`);
        if (!node.effect) errors.push(`${weaponId}.${branch} tier ${i} missing effect description`);
      }
    }
  }
  // Verify computeWeaponUpgrades returns sensible defaults.
  const defaultUpgrades = computeWeaponUpgrades('coin-blaster', {});
  if (defaultUpgrades.fireRateMultiplier !== 1) errors.push('default fireRate multiplier should be 1');
  if (defaultUpgrades.damageFlatBonus !== 0) errors.push('default damage bonus should be 0');
  if (defaultUpgrades.reloadMultiplier !== 1) errors.push('default reload multiplier should be 1');
  if (defaultUpgrades.specials.length !== 0) errors.push('default specials should be empty');

  // Verify tier 1 upgrades compound correctly.
  const tier1 = computeWeaponUpgrades('coin-blaster', { rateOfFire: 1 });
  if (tier1.fireRateMultiplier < 1.17 || tier1.fireRateMultiplier > 1.19) {
    errors.push(`coin-blaster tier1 rateOfFire should be ~1.18, got ${tier1.fireRateMultiplier}`);
  }

  return { ok: errors.length === 0, errors };
}
