function positive(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function buildUpgradeRuntimePolicy(stats = {}) {
  const fireRateMultiplier = positive(stats.rateOfFire ?? stats.fireRate);
  const magazineMultiplier = positive(stats.magazineSize);
  const criticalChance = positive(stats.criticalChance);
  const criticalDamage = positive(stats.criticalDamage);
  const spreadControl = positive(stats.spreadControl);
  const dashCooldown = positive(stats.dashCooldown);

  return Object.freeze({
    fireRateMultiplier,
    magazineMultiplier,
    critChanceBonus: round(Math.max(0, criticalChance - 1), 4),
    critDamageBonus: round(Math.max(0, criticalDamage - 1), 4),
    spreadMultiplier: 1 / spreadControl,
    additionalPierceTargets: Math.max(0, Math.floor(nonNegative(stats.pierce))),
    dashCooldownSeconds: round(2.2 / dashCooldown, 2),
    dashDistanceMultiplier: positive(stats.dashDistance),
    healthRegenPerSecond: nonNegative(stats.healthRegen),
    scoreMultiplier: positive(stats.scoreMultiplier),
    comboDecayMultiplier: 1 / positive(stats.comboRetention),
    reviveCharges: Math.max(0, Math.floor(nonNegative(stats.revive))),
    weaponEvolution: typeof stats.weaponEvolution === 'string' ? stats.weaponEvolution : null,
  });
}

export function upgradedClipSize(baseClip = 1, policy = buildUpgradeRuntimePolicy()) {
  return Math.max(1, Math.ceil(positive(baseClip) * positive(policy.magazineMultiplier)));
}

export function applyUpgradeRevive({ health = 0, maxHealth = 100, reviveCharges = 0 } = {}) {
  const safeMaxHealth = Math.max(1, nonNegative(maxHealth, 100));
  const charges = Math.max(0, Math.floor(nonNegative(reviveCharges)));
  if (Number(health) > 0 || charges <= 0) {
    return Object.freeze({ revived: false, health: Math.max(0, Number(health) || 0), reviveCharges: charges });
  }
  return Object.freeze({
    revived: true,
    health: Math.max(1, Math.round(safeMaxHealth * 0.35)),
    reviveCharges: charges - 1,
  });
}

export function evolutionScoreMultiplier(policy = buildUpgradeRuntimePolicy(), weaponId = 'coin-blaster') {
  const evolution = policy.weaponEvolution;
  if (evolution === 'settler-rail' && weaponId === 'coin-blaster') return 1.35;
  if (evolution === 'hashstorm-overdrive' && weaponId === 'auto-miner') return 1.3;
  if (evolution === 'crit-candle' && weaponId === 'hash-rail') return 1.4;
  if (evolution === 'crypto-bomb-orbit' && weaponId === 'crypto-bombs') return 1.25;
  return 1;
}
