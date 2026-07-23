import { resolveSweptCircleMotion } from './collision.mjs';
import { resolveSweptTraversalPath } from './elevation.mjs';
import { resolveEnemyPressure } from './movement.mjs';

const EPSILON = 1e-9;
const CONTACT_SKIN = 1e-6;

export const DASH_COOLDOWN_TICKS_BY_TIER = Object.freeze([600, 480, 360]);
export const DASH_DURATION_TICKS = 8;
export const DASH_INVULNERABILITY_TICKS = 8;
export const DASH_DISTANCE = 192;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function normalize(value, name) {
  const x = finite(value?.x ?? 0, `${name}.x`);
  const y = finite(value?.y ?? 0, `${name}.y`);
  const magnitude = Math.hypot(x, y);
  return magnitude <= EPSILON ? Object.freeze({ x: 0, y: 0 }) : Object.freeze({ x: x / magnitude, y: y / magnitude });
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function validateTier(cooldownTier) {
  if (!Number.isInteger(cooldownTier) || cooldownTier < 0 || cooldownTier >= DASH_COOLDOWN_TICKS_BY_TIER.length) {
    throw new TypeError('cooldownTier must be 0, 1, or 2');
  }
  return cooldownTier;
}

export function createDashState({
  cooldownTier = 0,
  distance = DASH_DISTANCE,
  durationTicks = DASH_DURATION_TICKS,
  invulnerabilityTicks = DASH_INVULNERABILITY_TICKS,
} = {}) {
  const safeDistance = finite(distance, 'distance');
  if (safeDistance <= 0) throw new TypeError('distance must be positive');
  return {
    cooldownTier: validateTier(cooldownTier),
    distance: safeDistance,
    durationTicks: positiveInteger(durationTicks, 'durationTicks'),
    invulnerabilityTicks: positiveInteger(invulnerabilityTicks, 'invulnerabilityTicks'),
    active: false,
    direction: Object.freeze({ x: 0, y: 0 }),
    remainingTicks: 0,
    startedTick: -1,
    cooldownReadyTick: 0,
    invulnerableUntilTick: -1,
    lastStopReason: null,
  };
}

export function beginDash(state, { tick, direction, fallbackDirection = { x: 0, y: 0 } } = {}) {
  nonNegativeInteger(tick, 'tick');
  if (state.active) return freezeDeep({ started: false, reason: 'active', cooldownReadyTick: state.cooldownReadyTick });
  if (tick < state.cooldownReadyTick) return freezeDeep({ started: false, reason: 'cooldown', cooldownReadyTick: state.cooldownReadyTick });
  let resolvedDirection = normalize(direction, 'direction');
  if (Math.hypot(resolvedDirection.x, resolvedDirection.y) <= EPSILON) resolvedDirection = normalize(fallbackDirection, 'fallbackDirection');
  if (Math.hypot(resolvedDirection.x, resolvedDirection.y) <= EPSILON) {
    return freezeDeep({ started: false, reason: 'no-direction', cooldownReadyTick: state.cooldownReadyTick });
  }
  state.active = true;
  state.direction = resolvedDirection;
  state.remainingTicks = state.durationTicks;
  state.startedTick = tick;
  state.cooldownReadyTick = tick + DASH_COOLDOWN_TICKS_BY_TIER[state.cooldownTier];
  state.invulnerableUntilTick = tick + state.invulnerabilityTicks - 1;
  state.lastStopReason = null;
  return freezeDeep({ started: true, reason: 'started', direction: resolvedDirection, cooldownReadyTick: state.cooldownReadyTick });
}

export function stepDash(state, { tick } = {}) {
  nonNegativeInteger(tick, 'tick');
  if (!state.active || state.remainingTicks <= 0) {
    return freezeDeep({ active: false, delta: { x: 0, y: 0 }, invulnerable: isDashInvulnerable(state, tick), completed: false });
  }
  const distance = state.distance / state.durationTicks;
  const delta = { x: state.direction.x * distance, y: state.direction.y * distance };
  state.remainingTicks -= 1;
  const completed = state.remainingTicks === 0;
  if (completed) state.active = false;
  return freezeDeep({ active: true, delta, invulnerable: isDashInvulnerable(state, tick), completed });
}

export function stopDash(state, reason) {
  if (typeof reason !== 'string' || !reason) throw new TypeError('Dash stop reason must be a non-empty string');
  state.active = false;
  state.remainingTicks = 0;
  state.lastStopReason = reason;
  return state;
}

export function isDashInvulnerable(state, tick) {
  nonNegativeInteger(tick, 'tick');
  return state.startedTick >= 0 && tick >= state.startedTick && tick <= state.invulnerableUntilTick;
}

export function filterDashInvulnerableHits(state, tick, hits) {
  if (!Array.isArray(hits)) throw new TypeError('hits must be an array');
  if (!isDashInvulnerable(state, tick)) return hits;
  return Object.freeze(hits.filter((hit) => hit?.targetId !== 'player'));
}

export function getDashStatus(state, tick) {
  nonNegativeInteger(tick, 'tick');
  const cooldownTicksRemaining = Math.max(0, state.cooldownReadyTick - tick);
  return freezeDeep({
    active: state.active,
    ready: !state.active && cooldownTicksRemaining === 0,
    cooldownTier: state.cooldownTier,
    cooldownTicksRemaining,
    cooldownSecondsRemaining: Math.ceil(cooldownTicksRemaining / 60),
    cooldownReadyTick: state.cooldownReadyTick,
    invulnerable: isDashInvulnerable(state, tick),
    lastStopReason: state.lastStopReason,
  });
}

function rayCircleTime(start, delta, center, radius) {
  const a = delta.x * delta.x + delta.y * delta.y;
  if (a <= EPSILON) return null;
  const offsetX = start.x - center.x;
  const offsetY = start.y - center.y;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c <= 0) return 0;
  const b = 2 * (offsetX * delta.x + offsetY * delta.y);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a);
  return time >= -EPSILON && time <= 1 + EPSILON ? Math.min(1, Math.max(0, time)) : null;
}

function earliestBossHit(start, delta, body, enemies) {
  return enemies
    .filter((enemy) => enemy?.kind === 'boss')
    .map((enemy) => ({
      enemy,
      time: rayCircleTime(start, delta, enemy, finite(enemy.radius, `enemy ${String(enemy.id)} radius`) + body.radius),
    }))
    .filter((hit) => hit.time !== null)
    .sort((a, b) => a.time - b.time || String(a.enemy.id).localeCompare(String(b.enemy.id)))[0] ?? null;
}

export function resolveDashWorldStep({
  state,
  start,
  delta,
  body,
  blockers = [],
  bounds = null,
  queryGround,
  enemies = [],
} = {}) {
  if (!state || !body) throw new TypeError('Dash state and collision body are required');
  if (!Array.isArray(blockers) || !Array.isArray(enemies)) throw new TypeError('Dash blockers and enemies must be arrays');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  const origin = { x: finite(start?.x, 'start.x'), y: finite(start?.y, 'start.y'), z: finite(start?.z ?? 0, 'start.z') };
  const requested = { x: finite(delta?.x, 'delta.x'), y: finite(delta?.y, 'delta.y') };
  const bossHit = earliestBossHit(origin, requested, body, enemies);
  const bossScale = bossHit
    ? Math.max(0, bossHit.time - CONTACT_SKIN / Math.max(EPSILON, Math.hypot(requested.x, requested.y)))
    : 1;
  const bossClippedDelta = { x: requested.x * bossScale, y: requested.y * bossScale };
  const collision = resolveSweptCircleMotion({
    body,
    start: origin,
    delta: bossClippedDelta,
    blockers,
    bounds,
    stopOnFirstContact: true,
  });
  const traversal = resolveSweptTraversalPath({
    start: origin,
    end: collision.position,
    queryGround,
    maxSampleDistance: Math.max(4, body.radius * 0.5),
  });
  let stopReason = null;
  if (!traversal.allowed) stopReason = traversal.reason;
  else if (collision.contacts.length > 0) stopReason = 'hard-blocker';
  else if (bossHit) stopReason = 'boss';
  if (stopReason) stopDash(state, stopReason);

  const position = traversal.position;
  const regularEnemies = enemies.filter((enemy) => enemy?.kind !== 'boss');
  const pressure = resolveEnemyPressure({
    x: position.x,
    y: position.y,
    radius: body.radius,
    velocity: state.direction,
  }, regularEnemies, { regularYield: 1 });
  return freezeDeep({
    position: { x: position.x, y: position.y, z: traversal.ground.groundZ },
    ground: traversal.ground,
    stopReason,
    enemyDeltas: pressure.enemyDeltas,
    collision,
    traversal,
  });
}
