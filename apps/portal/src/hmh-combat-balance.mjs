// Hard Money Heroes combat balance helpers.
//
// Keep these pure and unit-tested. The runtime can have multiple movement loops
// (older tactical side-scroller + current isometric roguelike), but the fairness
// rules should stay shared: melee enemies may pressure the player, not outrun
// upgraded movement builds or instantly dogpile the player.

export const HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND = 4.15;

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function calculateEnemyChaseSpeed({
  catalogSpeed = 1,
  enemySpeed = catalogSpeed,
  elite = false,
  pressure = 0,
  encounterSpeedMul = 1,
  slowFactor = 1,
  playerMoveSpeed = HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND,
} = {}) {
  const base = clamp(enemySpeed, 0, 6);
  const pressureMul = 1 + clamp(pressure, 0, 1) * 0.18;
  const authoredMul = clamp(encounterSpeedMul, 0.65, 1.08);
  const roleMul = elite ? 0.82 : 0.74;
  const raw = base * roleMul * pressureMul * authoredMul * clamp(slowFactor, 0, 1);
  const capRatio = elite ? 0.92 : 0.86;
  const speedCap = Math.max(0.45, clamp(playerMoveSpeed, 1, 12) * capRatio);
  return Number(Math.max(0, Math.min(raw, speedCap)).toFixed(3));
}

export function calculateSideScrollerEnemySpeed({
  catalogSpeed = 1,
  enemySpeed = catalogSpeed,
  role = 'cover-shooter',
  miniBoss = false,
  difficultyAiLevel = 0,
  playerMoveSpeed = 3.1,
} = {}) {
  if (miniBoss) return 0.24;
  if (role !== 'aggressive-melee-rusher') return Number((clamp(enemySpeed, 0, 6) * 0.55).toFixed(3));
  return calculateEnemyChaseSpeed({
    enemySpeed,
    elite: false,
    pressure: clamp(difficultyAiLevel / 10, 0, 1),
    encounterSpeedMul: 0.9,
    playerMoveSpeed,
  });
}

export function calculateEnemyMeleeDamage({ normalHitDamage = 5, elite = false } = {}) {
  const base = Math.max(1, Number(normalHitDamage) || 5);
  const scaled = elite ? base * 1.18 : base * 0.78;
  return Math.max(1, Math.round(scaled));
}

export function calculateMeleeAttackResetFrames({ preferredResetFrames = null } = {}) {
  const preferred = Number(preferredResetFrames);
  if (!Number.isFinite(preferred)) return 72;
  return Math.max(72, Math.round(preferred));
}
