const EPSILON = 1e-9;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegative(value, name) {
  finite(value, name);
  if (value < 0) throw new TypeError(`${name} must be non-negative`);
  return value;
}

function normalize(vector) {
  const x = finite(vector?.x ?? 0, 'vector.x');
  const y = finite(vector?.y ?? 0, 'vector.y');
  const magnitude = Math.hypot(x, y);
  if (magnitude <= EPSILON) return { x: 0, y: 0 };
  const scale = 1 / Math.max(1, magnitude);
  return { x: x * scale, y: y * scale };
}

function moveToward(current, target, maximumDelta) {
  if (Math.abs(target - current) <= maximumDelta) return target;
  return current + Math.sign(target - current) * maximumDelta;
}

function moveVectorToward(current, target, maximumDelta) {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= maximumDelta || maximumDelta === Infinity) return { ...target };
  const scale = maximumDelta / distance;
  return { x: current.x + deltaX * scale, y: current.y + deltaY * scale };
}

export function quantizeDirection(direction, segments = 8) {
  if (!Number.isInteger(segments) || segments < 2) throw new TypeError('segments must be an integer >= 2');
  const normalized = normalize(direction);
  if (Math.hypot(normalized.x, normalized.y) <= EPSILON) return 0;
  const turn = Math.PI * 2;
  return ((Math.round(Math.atan2(normalized.y, normalized.x) / turn * segments) % segments) + segments) % segments;
}

export function createPlayerMotionState({
  x = 0,
  y = 0,
  vx = 0,
  vy = 0,
  maxSpeed = 240,
  accelerationTime = 0.08,
  decelerationTime = 0.06,
  heading = 0,
  movementDeadZone = 0.01,
  aimDeadZone = 0.01,
  recoilDecayTime = 0.12,
} = {}) {
  const aimDirection = { x: Math.cos(finite(heading, 'heading')), y: Math.sin(heading) };
  return {
    x: finite(x, 'x'), y: finite(y, 'y'),
    vx: finite(vx, 'vx'), vy: finite(vy, 'vy'),
    recoilVx: 0, recoilVy: 0,
    maxSpeed: nonNegative(maxSpeed, 'maxSpeed'),
    accelerationTime: nonNegative(accelerationTime, 'accelerationTime'),
    decelerationTime: nonNegative(decelerationTime, 'decelerationTime'),
    recoilDecayTime: nonNegative(recoilDecayTime, 'recoilDecayTime'),
    movementDeadZone: nonNegative(movementDeadZone, 'movementDeadZone'),
    aimDeadZone: nonNegative(aimDeadZone, 'aimDeadZone'),
    moveDirection: { x: 0, y: 0 },
    velocityDirection: normalize({ x: vx, y: vy }),
    aimDirection,
    legDirection: quantizeDirection(aimDirection, 8),
    torsoDirection: quantizeDirection(aimDirection, 8),
    locomotion: 'idle',
  };
}

export function applyRecoilImpulse(state, { direction, magnitude }) {
  const normalized = normalize(direction);
  nonNegative(magnitude, 'recoil magnitude');
  state.recoilVx += normalized.x * magnitude;
  state.recoilVy += normalized.y * magnitude;
  return state;
}

export function stepPlayerMovement(state, input, {
  dtSeconds,
  speedMultiplier = 1,
  stunned = false,
} = {}) {
  finite(dtSeconds, 'dtSeconds');
  if (dtSeconds <= 0) throw new TypeError('dtSeconds must be positive');
  nonNegative(speedMultiplier, 'speedMultiplier');

  const requestedMove = stunned ? { x: 0, y: 0 } : normalize(input?.move);
  const moveMagnitude = Math.hypot(requestedMove.x, requestedMove.y);
  const targetSpeed = state.maxSpeed * speedMultiplier;
  const targetVx = requestedMove.x * targetSpeed;
  const targetVy = requestedMove.y * targetSpeed;
  const responseTime = moveMagnitude > state.movementDeadZone ? state.accelerationTime : state.decelerationTime;
  const maximumDelta = responseTime <= 0 ? Infinity : state.maxSpeed / responseTime * dtSeconds;
  const nextVelocity = moveVectorToward(
    { x: state.vx, y: state.vy },
    { x: targetVx, y: targetVy },
    maximumDelta,
  );
  state.vx = nextVelocity.x;
  state.vy = nextVelocity.y;

  state.x += (state.vx + state.recoilVx) * dtSeconds;
  state.y += (state.vy + state.recoilVy) * dtSeconds;

  // Decay proportionally to the remaining impulse rather than at a fixed
  // maxSpeed-derived rate. A flat rate consumed any impulse below ~33 px/s
  // within a single tick, making every weapon recoil and enemy knockback value
  // sub-pixel and effectively dead config.
  const recoilRetention = state.recoilDecayTime <= 0
    ? 0
    : Math.max(0, 1 - dtSeconds / state.recoilDecayTime);
  state.recoilVx = Math.abs(state.recoilVx) <= EPSILON ? 0 : state.recoilVx * recoilRetention;
  state.recoilVy = Math.abs(state.recoilVy) <= EPSILON ? 0 : state.recoilVy * recoilRetention;

  if (moveMagnitude > state.movementDeadZone) state.moveDirection = requestedMove;
  const velocityMagnitude = Math.hypot(state.vx, state.vy);
  if (velocityMagnitude > state.movementDeadZone) {
    state.velocityDirection = normalize({ x: state.vx, y: state.vy });
    state.legDirection = quantizeDirection(state.velocityDirection, 8);
  }
  const requestedAim = input?.aim?.active ? normalize(input.aim) : { x: 0, y: 0 };
  if (Math.hypot(requestedAim.x, requestedAim.y) > state.aimDeadZone) {
    state.aimDirection = requestedAim;
    state.torsoDirection = quantizeDirection(requestedAim, 8);
  }
  state.locomotion = stunned ? 'stunned' : velocityMagnitude > state.movementDeadZone ? 'moving' : 'idle';
  return state;
}

function deterministicNormal(id) {
  let hash = 0;
  for (const character of String(id)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const angle = hash / 0x1_0000_0000 * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function resolveEnemyPressure(player, enemies, { regularYield = 1 } = {}) {
  if (!Array.isArray(enemies)) throw new TypeError('enemies must be an array');
  nonNegative(regularYield, 'regularYield');
  const playerRadius = nonNegative(player?.radius, 'player.radius');
  const velocity = normalize(player?.velocity);
  const playerDelta = { x: 0, y: 0 };
  const allowedVelocity = { ...velocity };
  const enemyDeltas = new Map();

  for (const enemy of [...enemies].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const dx = finite(enemy.x, 'enemy.x') - finite(player.x, 'player.x');
    const dy = finite(enemy.y, 'enemy.y') - finite(player.y, 'player.y');
    const distance = Math.hypot(dx, dy);
    const overlap = playerRadius + nonNegative(enemy.radius, 'enemy.radius') - distance;
    if (overlap <= 0) continue;
    const normal = distance > EPSILON ? { x: dx / distance, y: dy / distance } : deterministicNormal(enemy.id);
    if (enemy.kind !== 'boss') {
      enemyDeltas.set(enemy.id, { x: normal.x * overlap * regularYield, y: normal.y * overlap * regularYield });
      continue;
    }
    playerDelta.x -= normal.x * overlap;
    playerDelta.y -= normal.y * overlap;
    const inward = allowedVelocity.x * normal.x + allowedVelocity.y * normal.y;
    if (inward > 0) {
      allowedVelocity.x -= normal.x * inward;
      allowedVelocity.y -= normal.y * inward;
    }
    if (Math.hypot(allowedVelocity.x, allowedVelocity.y) <= EPSILON) {
      const sign = String(enemy.id).length % 2 === 0 ? 1 : -1;
      allowedVelocity.x = -normal.y * sign;
      allowedVelocity.y = normal.x * sign;
    }
  }
  return { playerDelta, enemyDeltas, allowedVelocity };
}
