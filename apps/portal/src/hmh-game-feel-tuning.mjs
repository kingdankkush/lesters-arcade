const DEFAULT_PROFILE_ID = 'wave2-game-feel-v1';

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeVector(vector = {}) {
  const x = num(vector.x, 0);
  const y = num(vector.y, 0);
  const mag = Math.hypot(x, y);
  if (mag <= 1e-9) return { x: 0, y: 0, mag: 0 };
  return { x: x / mag, y: y / mag, mag };
}

export const WAVE2_GAME_FEEL_TARGETS = freezeDeep({
  version: DEFAULT_PROFILE_ID,
  maxHitStopFrames: 8,
  minTellFrames: 18,
  movement: {
    maxSpeed: 3.25,
    accelerationSeconds: 0.16,
    decelerationSeconds: 0.12,
    turnResponsivenessMultiplier: 2.5,
    diagonalClamp: 1,
  },
  dash: {
    distance: 4.25,
    durationFrames: 10,
    cooldownSeconds: 1.25,
    invulnerabilityFrames: 8,
  },
  recovery: {
    baseHitStopFrames: 3,
    maxHitStopFrames: 8,
    baseRecoveryFrames: 10,
    maxRecoveryFrames: 24,
    maxScreenShake: 0.65,
  },
  readability: {
    minTellFrames: 18,
    maxSimultaneousHitStopsPerSecond: 4,
  },
});

export function buildWave2GameFeelProfile({ hero = 'lester', accessibility = {} } = {}) {
  const reducedMotion = Boolean(accessibility.reducedMotion);
  const heroSpeedMul = hero === 'lilly' ? 1.06 : hero === 'lester' ? 1 : 0.98;
  return freezeDeep({
    version: DEFAULT_PROFILE_ID,
    hero,
    movement: {
      ...WAVE2_GAME_FEEL_TARGETS.movement,
      maxSpeed: Number((WAVE2_GAME_FEEL_TARGETS.movement.maxSpeed * heroSpeedMul).toFixed(3)),
    },
    dash: {
      ...WAVE2_GAME_FEEL_TARGETS.dash,
      distance: Number((WAVE2_GAME_FEEL_TARGETS.dash.distance * (hero === 'lilly' ? 1.08 : 1)).toFixed(3)),
    },
    recovery: {
      ...WAVE2_GAME_FEEL_TARGETS.recovery,
      hitStopFrames: WAVE2_GAME_FEEL_TARGETS.recovery.maxHitStopFrames,
      maxScreenShake: reducedMotion ? 0.2 : WAVE2_GAME_FEEL_TARGETS.recovery.maxScreenShake,
    },
    readability: WAVE2_GAME_FEEL_TARGETS.readability,
    accessibility: { reducedMotion },
  });
}

export function integrateWave2Movement(velocity = {}, input = {}, { dtSeconds = 1 / 60, profile = buildWave2GameFeelProfile() } = {}) {
  const dt = clamp(num(dtSeconds, 1 / 60), 0, 0.1);
  const v = { vx: num(velocity.vx, 0), vy: num(velocity.vy, 0) };
  const dir = normalizeVector(input);
  const moving = dir.mag > 0;
  const maxSpeed = profile.movement.maxSpeed;
  const targetVx = moving ? dir.x * maxSpeed : 0;
  const targetVy = moving ? dir.y * maxSpeed : 0;
  const currentSpeed = Math.hypot(v.vx, v.vy);
  const alignment = moving && currentSpeed > 1e-6
    ? (v.vx * dir.x + v.vy * dir.y) / currentSpeed
    : 1;
  const reversing = moving && currentSpeed > 0.05 && alignment < -0.2;
  const baseTimeConstant = moving ? profile.movement.accelerationSeconds : profile.movement.decelerationSeconds;
  const timeConstant = reversing
    ? baseTimeConstant / Math.max(1, num(profile.movement.turnResponsivenessMultiplier, 1))
    : baseTimeConstant;
  const blend = clamp(dt / Math.max(0.001, timeConstant), 0, 1);
  const vx = v.vx + (targetVx - v.vx) * blend;
  const vy = v.vy + (targetVy - v.vy) * blend;
  const speed = Math.hypot(vx, vy);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    return Object.freeze({ vx: Number((vx * scale).toFixed(4)), vy: Number((vy * scale).toFixed(4)), speed: Number(maxSpeed.toFixed(4)) });
  }
  return Object.freeze({ vx: Number(vx.toFixed(4)), vy: Number(vy.toFixed(4)), speed: Number(speed.toFixed(4)) });
}

export function advanceWave2AutoFireCadence({
  cooldownSeconds = 0,
  dtSeconds = 1 / 60,
  shotsPerSecond = 1,
  maxCatchUpShots = 3,
} = {}) {
  const interval = 1 / Math.max(0.5, num(shotsPerSecond, 1));
  const remaining = Math.max(0, num(cooldownSeconds, 0)) - clamp(num(dtSeconds, 1 / 60), 0, 2);
  if (remaining > 0) {
    return Object.freeze({ dueShots: 0, cooldownSeconds: Number(remaining.toFixed(4)) });
  }
  const uncappedDue = 1 + Math.floor(Math.abs(remaining) / interval + 1e-9);
  const dueShots = Math.min(Math.max(1, Math.floor(num(maxCatchUpShots, 3))), uncappedDue);
  const cooldown = uncappedDue > dueShots
    ? interval
    : interval - (Math.abs(remaining) - (dueShots - 1) * interval);
  return Object.freeze({
    dueShots,
    cooldownSeconds: Number(Math.max(0.0001, cooldown).toFixed(4)),
  });
}

export function planWave2Dash(origin = {}, input = {}, { profile = buildWave2GameFeelProfile(), elapsedSeconds = 0 } = {}) {
  const dir = normalizeVector(input);
  const fallback = dir.mag > 0 ? dir : { x: 1, y: 0 };
  const distance = profile.dash.distance;
  const startX = num(origin.x, 0);
  const startY = num(origin.y, 0);
  const endX = startX + fallback.x * distance;
  const endY = startY + fallback.y * distance;
  return freezeDeep({
    replayTag: 'wave2-dash-v1',
    start: { x: Number(startX.toFixed(4)), y: Number(startY.toFixed(4)) },
    end: { x: Number(endX.toFixed(4)), y: Number(endY.toFixed(4)) },
    direction: { x: Number(fallback.x.toFixed(4)), y: Number(fallback.y.toFixed(4)) },
    distance: Number(distance.toFixed(4)),
    durationFrames: profile.dash.durationFrames,
    cooldownSeconds: profile.dash.cooldownSeconds,
    invulnerabilityFrames: profile.dash.invulnerabilityFrames,
    elapsedSeconds: Number(num(elapsedSeconds, 0).toFixed(3)),
  });
}

export function planWave2KnockbackRecovery(hit = {}, { profile = buildWave2GameFeelProfile() } = {}) {
  const damage = clamp(num(hit.damage, 0), 0, 100);
  const typeMul = hit.sourceType === 'explosion' ? 1.35 : hit.sourceType === 'melee' ? 1.1 : 0.85;
  const armorMul = hit.armored ? 0.58 : 1;
  const knockbackSpeed = clamp((0.14 * damage + 0.8) * typeMul * armorMul, 0, 7.5);
  const hitStopFrames = Math.min(profile.recovery.maxHitStopFrames, Math.round(profile.recovery.baseHitStopFrames + damage / 8));
  const recoveryFrames = Math.min(profile.recovery.maxRecoveryFrames, Math.round(profile.recovery.baseRecoveryFrames + damage / 3));
  const screenShake = Math.min(profile.recovery.maxScreenShake, Number((damage / 60 * typeMul * (hit.armored ? 0.7 : 1)).toFixed(3)));
  return freezeDeep({
    replayTag: 'wave2-recovery-v1',
    knockbackSpeed: Number(knockbackSpeed.toFixed(3)),
    hitStopFrames,
    recoveryFrames,
    screenShake,
    armored: Boolean(hit.armored),
    sourceType: hit.sourceType ?? 'bullet',
  });
}
