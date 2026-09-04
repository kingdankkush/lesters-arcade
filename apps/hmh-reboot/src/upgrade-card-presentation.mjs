// Cycle 073 (U-4): level-up card presentation, derived render-side from the
// frozen RUN_UPGRADE_CATALOG fields. Nothing here is stored on a choice, so
// pendingChoices, the run-summary offer/selection records and replays keep
// their shape. Pure: no DOM, no RNG, no snapshot access.
import { AUTHORED_PROP_ASSETS } from './authored-prop-atlas.mjs';

// "How special is this pick", lowest to highest: a repeatable stat tail, a core
// build pick, a weapon-branch pick, and the single-rank branch capstone.
export const UPGRADE_TIERS = Object.freeze(['mastery', 'core', 'weapon', 'capstone']);
export const UPGRADE_TIER_TOKENS = Object.freeze({
  mastery: '--rarity-common',
  core: '--rarity-uncommon',
  weapon: '--rarity-rare',
  capstone: '--rarity-legendary',
});
export const UPGRADE_TIER_LABELS = Object.freeze({
  mastery: 'Mastery',
  core: 'Core',
  weapon: 'Weapon',
  capstone: 'Capstone',
});
// Level-ups offer exactly two choices (Cycle 037); Digit1/Digit2 are the fixed
// card hotkeys regardless of the player's weapon-slot rebinding.
export const UPGRADE_CARD_HOTKEYS = Object.freeze(['1', '2']);

const PROP_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POWER_UP_ICONS = new Set(AUTHORED_PROP_ASSETS.powerUps);
const WEAPON_ICONS = new Set(AUTHORED_PROP_ASSETS.weapons);

export function resolveUpgradeTier(upgrade) {
  if (!upgrade || typeof upgrade !== 'object') return 'core';
  if (upgrade.repeatable === true) return 'mastery';
  if (upgrade.requiresRanks && Number(upgrade.maxRank) === 1) return 'capstone';
  if (typeof upgrade.requiresWeaponId === 'string') return 'weapon';
  return 'core';
}

// Twelve weapon-branch upgrades have no item PNG of their own; the branch
// weapon's existing icon is the fallback so no card ever paints a 404.
export function resolveUpgradeIconAssetId(upgrade) {
  const id = upgrade?.id;
  if (typeof id === 'string' && PROP_ID.test(id) && POWER_UP_ICONS.has(id)) return id;
  const weaponId = upgrade?.requiresWeaponId;
  if (typeof weaponId === 'string' && PROP_ID.test(weaponId) && WEAPON_ICONS.has(weaponId)) return weaponId;
  return null;
}

export function resolveUpgradeCardPresentation(upgrade, index = 0) {
  const tier = resolveUpgradeTier(upgrade);
  return Object.freeze({
    tier,
    tierToken: UPGRADE_TIER_TOKENS[tier],
    tierLabel: UPGRADE_TIER_LABELS[tier],
    iconAssetId: resolveUpgradeIconAssetId(upgrade),
    hotkey: UPGRADE_CARD_HOTKEYS[index] ?? '',
  });
}
