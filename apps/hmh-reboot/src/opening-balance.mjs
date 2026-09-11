export const HMH_OPENING_MOVEMENT_HOLD_TICKS = 120;
export const HMH_OPENING_ATTACK_GRACE_TICKS = 480;
export const HMH_OPENING_ENEMY_ARCHETYPE_IDS = Object.freeze(['bagholder-rusher', 'forkrunner']);
export const HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE = Object.freeze({
  'bagholder-rusher': 6,
  forkrunner: 3,
});

function tickValue(tick) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  return tick;
}

// Set once at insertion: early pistol kills teach aiming, then health grows
// continuously until the original ten-minute difficulty. Never rescale a
// living enemy or couple difficulty to rendering, device speed, or XP choices.
export function encounterEnemyHealth(archetypeId, fullHealth, tick) {
  tickValue(tick);
  if (!Number.isInteger(fullHealth) || fullHealth <= 0) throw new TypeError('fullHealth must be a positive integer');
  const openingHealth = Math.min(fullHealth, HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE[archetypeId] ?? Math.max(6, Math.round(fullHealth * 0.075)));
  const progress = Math.min(1, Math.max(0, tick - 3_600) / 32_400);
  return Math.round(openingHealth + (fullHealth - openingHealth) * progress);
}

export function openingEnemyMovementEnabled(tick) {
  return tickValue(tick) >= HMH_OPENING_MOVEMENT_HOLD_TICKS;
}

export function openingEnemyAttacksEnabled(tick) {
  return tickValue(tick) >= HMH_OPENING_ATTACK_GRACE_TICKS;
}
