const EPSILON = 1e-12;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function normalize(vector) {
  const x = finite(vector?.x ?? 0, 'direction.x');
  const y = finite(vector?.y ?? 0, 'direction.y');
  const magnitude = Math.hypot(x, y);
  return magnitude <= EPSILON ? { x: 0, y: 0 } : { x: x / magnitude, y: y / magnitude };
}

function rotate(direction, radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return { x: direction.x * cosine - direction.y * sine, y: direction.x * sine + direction.y * cosine };
}

export function applyAimAssist(rawDirection, targetDirection, {
  magnetism = 0.25,
  maxCorrectionRadians = Math.PI / 18,
} = {}) {
  finite(magnetism, 'magnetism');
  finite(maxCorrectionRadians, 'maxCorrectionRadians');
  if (magnetism < 0 || magnetism > 1 || maxCorrectionRadians < 0) throw new TypeError('aim assist settings are out of range');
  const raw = normalize(rawDirection);
  const target = normalize(targetDirection);
  if (Math.hypot(raw.x, raw.y) <= EPSILON || Math.hypot(target.x, target.y) <= EPSILON) return raw;
  const rawAngle = Math.atan2(raw.y, raw.x);
  const targetAngle = Math.atan2(target.y, target.x);
  let delta = ((targetAngle - rawAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  delta = Math.max(-maxCorrectionRadians, Math.min(maxCorrectionRadians, delta * magnetism));
  return normalize(rotate(raw, delta));
}

export function selectNearestValidTarget(origin, targets, {
  maxRange = Infinity,
  lineOfSight = () => true,
} = {}) {
  if (!Array.isArray(targets)) throw new TypeError('targets must be an array');
  finite(origin?.x, 'origin.x');
  finite(origin?.y, 'origin.y');
  if (!(maxRange > 0)) throw new TypeError('maxRange must be positive');
  if (typeof lineOfSight !== 'function') throw new TypeError('lineOfSight must be a function');
  const maximumDistanceSquared = maxRange ** 2;
  let best = null;
  let bestDistanceSquared = Infinity;
  for (const candidate of targets) {
    if (!candidate || candidate.active === false || candidate.targetable === false) continue;
    const dx = finite(candidate.x, 'target.x') - origin.x;
    const dy = finite(candidate.y, 'target.y') - origin.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > maximumDistanceSquared || !lineOfSight(candidate)) continue;
    const id = String(candidate.id);
    if (distanceSquared < bestDistanceSquared || (distanceSquared === bestDistanceSquared && id.localeCompare(String(best?.id)) < 0)) {
      best = candidate;
      bestDistanceSquared = distanceSquared;
    }
  }
  return best;
}

export function createAimState({
  autoFireEnabled = true,
  manualHoldTicks = 8,
  maxRange = 720,
  aimMagnetism = 0.25,
  maxCorrectionRadians = Math.PI / 18,
} = {}) {
  if (!Number.isInteger(manualHoldTicks) || manualHoldTicks < 0) throw new TypeError('manualHoldTicks must be a non-negative integer');
  return {
    autoFireEnabled: Boolean(autoFireEnabled),
    manualHoldTicks,
    maxRange: finite(maxRange, 'maxRange'),
    aimMagnetism: finite(aimMagnetism, 'aimMagnetism'),
    maxCorrectionRadians: finite(maxCorrectionRadians, 'maxCorrectionRadians'),
    lastTick: -1,
    manualUntilTick: -1,
    lastManualDirection: { x: 1, y: 0 },
    stableDirection: { x: 1, y: 0 },
  };
}

export function resolveAimIntent(state, {
  tick,
  actor,
  input,
  targets,
  device = 'keyboard',
  lineOfSight,
} = {}) {
  if (!Number.isInteger(tick) || tick < 0) throw new TypeError('tick must be a non-negative integer');
  if (tick <= state.lastTick) throw new TypeError('tick must be monotonic');
  state.lastTick = tick;
  const target = selectNearestValidTarget(actor, targets, { maxRange: state.maxRange, lineOfSight });
  const manualDirection = input?.aim?.active ? normalize(input.aim) : { x: 0, y: 0 };
  const manualActive = Math.hypot(manualDirection.x, manualDirection.y) > EPSILON;
  let source = 'stable';
  let direction = state.stableDirection;
  let targetId = null;

  if (manualActive) {
    direction = manualDirection;
    if ((device === 'touch' || device === 'gamepad') && target) {
      direction = applyAimAssist(direction, { x: target.x - actor.x, y: target.y - actor.y }, {
        magnetism: state.aimMagnetism,
        maxCorrectionRadians: state.maxCorrectionRadians,
      });
    }
    state.lastManualDirection = direction;
    state.manualUntilTick = tick + state.manualHoldTicks;
    source = 'manual';
  } else if (tick <= state.manualUntilTick) {
    direction = state.lastManualDirection;
    source = 'manual-hold';
  } else if (state.autoFireEnabled && target) {
    direction = normalize({ x: target.x - actor.x, y: target.y - actor.y });
    source = 'autofire';
    targetId = String(target.id);
  }

  state.stableDirection = direction;
  return Object.freeze({
    direction: Object.freeze({ ...direction }),
    source,
    targetId,
    fire: Boolean(input?.fire) || (state.autoFireEnabled && Boolean(target)),
  });
}
