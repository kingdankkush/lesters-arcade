export const HMH_OPENING_MOVEMENT_HOLD_TICKS = 120;
export const HMH_OPENING_ATTACK_GRACE_TICKS = 480;
export const HMH_OPENING_ENEMY_ARCHETYPE_IDS = Object.freeze(['bagholder-rusher', 'forkrunner']);
export const HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE = Object.freeze({
  'bagholder-rusher': 24,
  forkrunner: 20,
});

function tickValue(tick) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  return tick;
}

export function openingEnemyMovementEnabled(tick) {
  return tickValue(tick) >= HMH_OPENING_MOVEMENT_HOLD_TICKS;
}

export function openingEnemyAttacksEnabled(tick) {
  return tickValue(tick) >= HMH_OPENING_ATTACK_GRACE_TICKS;
}
