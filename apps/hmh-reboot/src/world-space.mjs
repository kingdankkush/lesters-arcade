import { freezeDeep } from './value-guards.mjs';
export const WORLD_COORDINATES = Object.freeze({
  axes: Object.freeze({ x: 'right', y: 'down', z: 'up' }),
  depthAxis: 'y',
  heightToScreenY: 1,
  visualLiftAffectsCollision: false,
});

export const DEPTH_BANDS = Object.freeze({
  ground: 0,
  lowProps: 100_000,
  actors: 200_000,
  highProps: 300_000,
  projectiles: 400_000,
  canopy: 500_000,
  overlays: 600_000,
});

const DEFAULT_WORLD_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 4096, maxY: 4096 });

import { clamp, finite } from './value-guards.mjs';

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new TypeError(`${name} must be positive`);
  return value;
}

function finiteBounds(bounds = DEFAULT_WORLD_BOUNDS) {
  const result = {
    minX: finite(bounds.minX, 'bounds.minX'),
    minY: finite(bounds.minY, 'bounds.minY'),
    maxX: finite(bounds.maxX, 'bounds.maxX'),
    maxY: finite(bounds.maxY, 'bounds.maxY'),
  };
  if (result.maxX <= result.minX || result.maxY <= result.minY) throw new TypeError('bounds must have positive finite area');
  return Object.freeze(result);
}

function finiteViewport(viewport) {
  return {
    width: positive(viewport?.width, 'viewport.width'),
    height: positive(viewport?.height, 'viewport.height'),
  };
}


export function createActorSpatialState({
  x = 0,
  y = 0,
  z = 0,
  vx = 0,
  vy = 0,
  vz = 0,
  heading = 0,
  groundZ = 0,
  visualLiftZ = 0,
  locomotion = 'idle',
  combat = 'ready',
  depthBias = 0,
} = {}) {
  const actor = {
    x: finite(x, 'actor.x'),
    y: finite(y, 'actor.y'),
    z: finite(z, 'actor.z'),
    vx: finite(vx, 'actor.vx'),
    vy: finite(vy, 'actor.vy'),
    vz: finite(vz, 'actor.vz'),
    heading: finite(heading, 'actor.heading'),
    groundZ: finite(groundZ, 'actor.groundZ'),
    visualLiftZ: finite(visualLiftZ, 'actor.visualLiftZ'),
    locomotion,
    combat,
    depthBias: finite(depthBias, 'actor.depthBias'),
  };
  if (typeof locomotion !== 'string' || !locomotion) throw new TypeError('actor.locomotion must be a non-empty string');
  if (typeof combat !== 'string' || !combat) throw new TypeError('actor.combat must be a non-empty string');
  return actor;
}

export function getGroundContact(actor) {
  return Object.freeze({
    x: finite(actor?.x, 'actor.x'),
    y: finite(actor?.y, 'actor.y'),
    z: finite(actor?.groundZ, 'actor.groundZ'),
  });
}

export function computeDepthKey(actor, band = 'actors') {
  if (!Object.hasOwn(DEPTH_BANDS, band)) throw new TypeError(`Unknown depth band: ${String(band)}`);
  return DEPTH_BANDS[band] + finite(actor?.y, 'actor.y') + finite(actor?.depthBias ?? 0, 'actor.depthBias');
}

function interpolateAngle(previous, current, alpha) {
  const fullTurn = Math.PI * 2;
  let delta = ((current - previous + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  if (Math.abs(delta + Math.PI) < Number.EPSILON && current > previous) delta = Math.PI;
  return previous + delta * alpha;
}

export function interpolateSpatialState(previous, current, alpha) {
  finite(alpha, 'interpolation alpha');
  if (alpha < 0 || alpha > 1) throw new TypeError('interpolation alpha must be in [0, 1]');
  const lerp = (key) => finite(previous?.[key], `previous.${key}`) + (finite(current?.[key], `current.${key}`) - previous[key]) * alpha;
  return Object.freeze({
    x: lerp('x'),
    y: lerp('y'),
    z: lerp('z'),
    vx: lerp('vx'),
    vy: lerp('vy'),
    vz: lerp('vz'),
    groundZ: lerp('groundZ'),
    visualLiftZ: lerp('visualLiftZ'),
    heading: interpolateAngle(finite(previous?.heading, 'previous.heading'), finite(current?.heading, 'current.heading'), alpha),
    depthBias: lerp('depthBias'),
  });
}

export function createFlatGroundQuery({ groundZ = 0, surfaceId = 'ground', walkable = true } = {}) {
  finite(groundZ, 'groundZ');
  if (typeof surfaceId !== 'string' || !surfaceId) throw new TypeError('surfaceId must be a non-empty string');
  if (typeof walkable !== 'boolean') throw new TypeError('walkable must be boolean');
  return (x, y) => {
    finite(x, 'ground query x');
    finite(y, 'ground query y');
    return {
      groundZ,
      surfaceId,
      walkable,
      normal: { x: 0, y: 0, z: 1 },
    };
  };
}

export function createCameraState({
  x = 0,
  y = 0,
  zoom = 1,
  shakeX = 0,
  shakeY = 0,
  deadZone = { width: 160, height: 90 },
  bounds = DEFAULT_WORLD_BOUNDS,
  smoothTime = 0.18,
  lookAheadSeconds = 0.12,
  maxLookAhead = 32,
} = {}) {
  finite(smoothTime, 'camera.smoothTime');
  finite(lookAheadSeconds, 'camera.lookAheadSeconds');
  finite(maxLookAhead, 'camera.maxLookAhead');
  if (smoothTime < 0 || lookAheadSeconds < 0 || maxLookAhead < 0) throw new TypeError('camera smoothing and look-ahead values must be non-negative');
  return {
    x: finite(x, 'camera.x'),
    y: finite(y, 'camera.y'),
    zoom: positive(zoom, 'camera.zoom'),
    shakeX: finite(shakeX, 'camera.shakeX'),
    shakeY: finite(shakeY, 'camera.shakeY'),
    velocityX: 0,
    velocityY: 0,
    lookAheadX: 0,
    lookAheadY: 0,
    smoothTime,
    lookAheadSeconds,
    maxLookAhead,
    deadZone: Object.freeze({
      width: Math.max(0, finite(deadZone?.width, 'camera.deadZone.width')),
      height: Math.max(0, finite(deadZone?.height, 'camera.deadZone.height')),
    }),
    bounds: finiteBounds(bounds),
  };
}

function clampCameraAxis(value, minimum, maximum, visibleHalfExtent) {
  const worldExtent = maximum - minimum;
  if (visibleHalfExtent * 2 >= worldExtent) return minimum + worldExtent / 2;
  return clamp(value, minimum + visibleHalfExtent, maximum - visibleHalfExtent);
}

function smoothDamp(current, target, velocity, smoothTime, deltaTime) {
  if (smoothTime <= 0) return { value: target, velocity: 0 };
  const omega = 2 / Math.max(0.0001, smoothTime);
  const scaledTime = omega * deltaTime;
  const decay = 1 / (1 + scaledTime + 0.48 * scaledTime ** 2 + 0.235 * scaledTime ** 3);
  const change = current - target;
  const temporary = (velocity + omega * change) * deltaTime;
  let nextVelocity = (velocity - omega * temporary) * decay;
  let value = target + (change + temporary) * decay;
  if ((target - current > 0) === (value > target)) {
    value = target;
    nextVelocity = 0;
  }
  return { value, velocity: nextVelocity };
}

export function followCameraTarget(camera, target, viewport, { dtSeconds = 1 / 60, smoothTime = camera.smoothTime } = {}) {
  const view = finiteViewport(viewport);
  const targetX = finite(target?.x, 'camera target.x');
  const targetY = finite(target?.y, 'camera target.y');
  positive(dtSeconds, 'camera dtSeconds');
  finite(smoothTime, 'camera smoothTime');
  if (smoothTime < 0) throw new TypeError('camera smoothTime must be non-negative');

  const desiredLookX = finite(target?.vx ?? 0, 'camera target.vx') * camera.lookAheadSeconds
    + finite(target?.aimX ?? 0, 'camera target.aimX') * camera.maxLookAhead * 0.35;
  const desiredLookY = finite(target?.vy ?? 0, 'camera target.vy') * camera.lookAheadSeconds
    + finite(target?.aimY ?? 0, 'camera target.aimY') * camera.maxLookAhead * 0.35;
  const lookMagnitude = Math.hypot(desiredLookX, desiredLookY);
  const lookScale = lookMagnitude > camera.maxLookAhead && lookMagnitude > 0 ? camera.maxLookAhead / lookMagnitude : 1;
  camera.lookAheadX = desiredLookX * lookScale;
  camera.lookAheadY = desiredLookY * lookScale;

  let focusPullX = 0;
  let focusPullY = 0;
  if (target?.focusX !== undefined && target?.focusY !== undefined) {
    const focusX = finite(target.focusX, 'camera target.focusX');
    const focusY = finite(target.focusY, 'camera target.focusY');
    const focusWeight = clamp(finite(target.focusWeight ?? 0.18, 'camera target.focusWeight'), 0, 0.25);
    const focusDeltaX = focusX - targetX;
    const focusDeltaY = focusY - targetY;
    const focusDistance = Math.hypot(focusDeltaX, focusDeltaY);
    const boundedFocusDistance = Math.min(focusDistance, Math.min(view.width, view.height) * 0.4 / camera.zoom);
    if (focusDistance > 0) {
      focusPullX = focusDeltaX / focusDistance * boundedFocusDistance * focusWeight;
      focusPullY = focusDeltaY / focusDistance * boundedFocusDistance * focusWeight;
    }
  }
  const lookedTargetX = targetX + camera.lookAheadX + focusPullX;
  const lookedTargetY = targetY + camera.lookAheadY + focusPullY;
  const deadHalfX = camera.deadZone.width / 2;
  const deadHalfY = camera.deadZone.height / 2;
  const deltaX = lookedTargetX - camera.x;
  const deltaY = lookedTargetY - camera.y;
  let desiredX = camera.x;
  let desiredY = camera.y;
  if (deltaX > deadHalfX) desiredX = lookedTargetX - deadHalfX;
  else if (deltaX < -deadHalfX) desiredX = lookedTargetX + deadHalfX;
  if (deltaY > deadHalfY) desiredY = lookedTargetY - deadHalfY;
  else if (deltaY < -deadHalfY) desiredY = lookedTargetY + deadHalfY;

  const smoothedX = smoothDamp(camera.x, desiredX, camera.velocityX, smoothTime, dtSeconds);
  const smoothedY = smoothDamp(camera.y, desiredY, camera.velocityY, smoothTime, dtSeconds);
  const unclampedX = smoothedX.value;
  const unclampedY = smoothedY.value;
  camera.x = clampCameraAxis(unclampedX, camera.bounds.minX, camera.bounds.maxX, view.width / (2 * camera.zoom));
  camera.y = clampCameraAxis(unclampedY, camera.bounds.minY, camera.bounds.maxY, view.height / (2 * camera.zoom));
  camera.velocityX = camera.x === unclampedX ? smoothedX.velocity : 0;
  camera.velocityY = camera.y === unclampedY ? smoothedY.velocity : 0;
  return camera;
}

export function setCameraShake(camera, { x = 0, y = 0 } = {}) {
  camera.shakeX = finite(x, 'camera shake x');
  camera.shakeY = finite(y, 'camera shake y');
  return camera;
}

export function worldToScreen(point, camera, viewport) {
  const view = finiteViewport(viewport);
  const x = finite(point?.x, 'world.x');
  const y = finite(point?.y, 'world.y');
  const z = finite(point?.z ?? 0, 'world.z');
  const visualLiftZ = finite(point?.visualLiftZ ?? 0, 'world.visualLiftZ');
  return {
    x: (x - camera.x) * camera.zoom + view.width / 2 + camera.shakeX,
    y: (y - camera.y - (z + visualLiftZ) * WORLD_COORDINATES.heightToScreenY) * camera.zoom + view.height / 2 + camera.shakeY,
  };
}

export function screenToGround(point, camera, viewport, { z = 0, visualLiftZ = 0 } = {}) {
  const view = finiteViewport(viewport);
  finite(point?.x, 'screen.x');
  finite(point?.y, 'screen.y');
  finite(z, 'ground z');
  finite(visualLiftZ, 'ground visualLiftZ');
  return {
    x: (point.x - view.width / 2 - camera.shakeX) / camera.zoom + camera.x,
    y: (point.y - view.height / 2 - camera.shakeY) / camera.zoom + camera.y + (z + visualLiftZ) * WORLD_COORDINATES.heightToScreenY,
  };
}

export function resolveActorSpatialStep(actor, {
  dtSeconds,
  resolveCollision = (candidate) => candidate,
  queryGround = createFlatGroundQuery(),
  resolveElevation = ({ candidateZ, ground }) => Math.max(candidateZ, ground.groundZ),
  updateCamera = () => {},
  transform = (value) => value,
} = {}) {
  positive(dtSeconds, 'dtSeconds');
  for (const [name, callback] of Object.entries({ resolveCollision, queryGround, resolveElevation, updateCamera, transform })) {
    if (typeof callback !== 'function') throw new TypeError(`${name} must be a function`);
  }

  const candidate = {
    x: actor.x + actor.vx * dtSeconds,
    y: actor.y + actor.vy * dtSeconds,
    z: actor.z + actor.vz * dtSeconds,
  };
  const resolved = resolveCollision(Object.freeze({ ...candidate }), actor);
  actor.x = finite(resolved?.x, 'collision x');
  actor.y = finite(resolved?.y, 'collision y');
  const ground = queryGround(actor.x, actor.y, actor);
  actor.groundZ = finite(ground?.groundZ, 'ground contact height');
  actor.z = finite(resolveElevation({ candidateZ: candidate.z, ground, actor }), 'resolved elevation');
  updateCamera(actor, ground);
  const screen = transform(actor, ground);
  return { actor, ground, screen };
}

export function buildDebugGridOverlay({ bounds, spacing, queryGround }) {
  const worldBounds = finiteBounds(bounds);
  positive(spacing, 'grid spacing');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  const lines = [];
  const labels = [];

  for (let x = worldBounds.minX; x <= worldBounds.maxX + Number.EPSILON; x += spacing) {
    lines.push({ axis: 'x', value: x, from: { x, y: worldBounds.minY }, to: { x, y: worldBounds.maxY } });
  }
  for (let y = worldBounds.minY; y <= worldBounds.maxY + Number.EPSILON; y += spacing) {
    lines.push({ axis: 'y', value: y, from: { x: worldBounds.minX, y }, to: { x: worldBounds.maxX, y } });
  }
  for (let y = worldBounds.minY; y <= worldBounds.maxY + Number.EPSILON; y += spacing) {
    for (let x = worldBounds.minX; x <= worldBounds.maxX + Number.EPSILON; x += spacing) {
      const contact = queryGround(x, y);
      const height = finite(contact?.groundZ, 'debug ground height');
      labels.push({ x, y, height, text: `x=${x} y=${y} h=${height}` });
    }
  }
  return freezeDeep({ bounds: worldBounds, spacing, lines, labels });
}
