import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  WORLD_COORDINATES,
  DEPTH_BANDS,
  createActorSpatialState,
  createFlatGroundQuery,
  getGroundContact,
  interpolateSpatialState,
  resolveActorSpatialStep,
  computeDepthKey,
  createCameraState,
  followCameraTarget,
  setCameraShake,
  worldToScreen,
  screenToGround,
  buildDebugGridOverlay,
} from '../apps/hmh-reboot/src/world-space.mjs';

test('world coordinate convention and actor spatial state are explicit and finite', () => {
  assert.deepEqual(WORLD_COORDINATES.axes, { x: 'right', y: 'down', z: 'up' });
  assert.equal(WORLD_COORDINATES.depthAxis, 'y');
  assert.equal(WORLD_COORDINATES.visualLiftAffectsCollision, false);
  const actor = createActorSpatialState({ x: 12, y: 34, z: 5, heading: Math.PI / 2 });
  assert.deepEqual(actor, {
    x: 12, y: 34, z: 5,
    vx: 0, vy: 0, vz: 0,
    heading: Math.PI / 2,
    groundZ: 0,
    visualLiftZ: 0,
    locomotion: 'idle',
    combat: 'ready',
    depthBias: 0,
  });
  assert.throws(() => createActorSpatialState({ x: Number.NaN }), /finite/i);
});

test('depth ordering follows ground y and explicit bias, never physical or visual height', () => {
  const ground = createActorSpatialState({ x: 0, y: 100, z: 0 });
  const airborne = createActorSpatialState({ x: 0, y: 100, z: 40, visualLiftZ: 20 });
  assert.equal(computeDepthKey(ground), computeDepthKey(airborne));
  airborne.y = 101;
  assert.ok(computeDepthKey(airborne) > computeDepthKey(ground));
  airborne.depthBias = -2;
  assert.equal(computeDepthKey(airborne), DEPTH_BANDS.actors + 99);
  assert.ok(computeDepthKey(ground, 'projectiles') > computeDepthKey(ground, 'actors'));
});

test('one ground-contact point and transform interpolation are shared render contracts', () => {
  const previous = createActorSpatialState({ x: 0, y: 10, z: 2, vx: 0, vy: 10, vz: 2, groundZ: 1, heading: 0 });
  const current = createActorSpatialState({ x: 20, y: 30, z: 6, vx: 20, vy: 30, vz: 6, groundZ: 3, heading: Math.PI });
  assert.deepEqual(getGroundContact(current), { x: 20, y: 30, z: 3 });
  assert.deepEqual(interpolateSpatialState(previous, current, 0.25), {
    x: 5,
    y: 15,
    z: 3,
    vx: 5,
    vy: 15,
    vz: 3,
    groundZ: 1.5,
    visualLiftZ: 0,
    heading: Math.PI * 0.25,
    depthBias: 0,
  });
  assert.throws(() => interpolateSpatialState(previous, current, 1.1), /alpha/i);
});

test('runtime camera follows the interpolated render actor rather than stepping ahead on authority state', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /followCameraTarget\(camera,\s*\{\s*\.\.\.renderActor,/);
});

test('world-to-screen and inverse ground-plane transforms share one camera source', () => {
  const camera = createCameraState({ x: 100, y: 200, zoom: 2 });
  const viewport = { width: 800, height: 600 };
  const world = { x: 145, y: 260, z: 12, visualLiftZ: 3 };
  const screen = worldToScreen(world, camera, viewport);
  const inverse = screenToGround(screen, camera, viewport, { z: 12, visualLiftZ: 3 });
  assert.ok(Math.abs(inverse.x - world.x) < 1e-9);
  assert.ok(Math.abs(inverse.y - world.y) < 1e-9);
});

test('physical and visual elevation move screen y monotonically without changing world y or depth', () => {
  const camera = createCameraState();
  const viewport = { width: 320, height: 180 };
  const base = createActorSpatialState({ x: 10, y: 20 });
  const raised = createActorSpatialState({ x: 10, y: 20, z: 5, visualLiftZ: 2 });
  assert.ok(worldToScreen(raised, camera, viewport).y < worldToScreen(base, camera, viewport).y);
  assert.equal(computeDepthKey(raised), computeDepthKey(base));
});

test('spatial step resolves collision, ground, elevation, camera, then render transform in order', () => {
  const order = [];
  const actor = createActorSpatialState({ x: 0, y: 0, vx: 10, vy: 20, z: 0, vz: 5 });
  const camera = createCameraState({ bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 } });
  const result = resolveActorSpatialStep(actor, {
    dtSeconds: 1,
    resolveCollision: (candidate) => { order.push('collision'); return { ...candidate, x: 8, y: 18 }; },
    queryGround: (x, y) => { order.push('ground'); assert.deepEqual([x, y], [8, 18]); return { groundZ: 2, surfaceId: 'ramp', walkable: true }; },
    resolveElevation: ({ candidateZ, ground }) => { order.push('elevation'); return Math.max(candidateZ, ground.groundZ); },
    updateCamera: (target) => { order.push('camera'); camera.x = target.x; camera.y = target.y; },
    transform: (value) => { order.push('transform'); return { x: value.x, y: value.y - value.z }; },
  });
  assert.deepEqual(order, ['collision', 'ground', 'elevation', 'camera', 'transform']);
  assert.deepEqual({ x: actor.x, y: actor.y, z: actor.z, groundZ: actor.groundZ }, { x: 8, y: 18, z: 5, groundZ: 2 });
  assert.deepEqual(result.screen, { x: 8, y: 13 });
});

test('one authoritative flat-ground query returns stable contact metadata', () => {
  const queryGround = createFlatGroundQuery({ groundZ: 7, surfaceId: 'concrete' });
  assert.deepEqual(queryGround(100, 200), {
    groundZ: 7,
    surfaceId: 'concrete',
    walkable: true,
    normal: { x: 0, y: 0, z: 1 },
  });
  assert.throws(() => queryGround(Number.NaN, 0), /finite/i);
});

test('camera follows only outside its world-space dead zone and keeps shake independent', () => {
  const camera = createCameraState({ x: 50, y: 50, deadZone: { width: 20, height: 10 }, zoom: 2 });
  followCameraTarget(camera, { x: 58, y: 54 }, { width: 40, height: 20 }, { smoothTime: 0 });
  assert.deepEqual({ x: camera.x, y: camera.y }, { x: 50, y: 50 });
  followCameraTarget(camera, { x: 80, y: 70 }, { width: 40, height: 20 }, { smoothTime: 0 });
  assert.deepEqual({ x: camera.x, y: camera.y }, { x: 70, y: 65 });
  setCameraShake(camera, { x: 4, y: -3 });
  assert.deepEqual({ x: camera.x, y: camera.y, shakeX: camera.shakeX, shakeY: camera.shakeY }, { x: 70, y: 65, shakeX: 4, shakeY: -3 });
});

test('camera uses critically damped render-time smoothing and bounded velocity/aim look-ahead', () => {
  const camera = createCameraState({ x: 100, y: 100, deadZone: { width: 0, height: 0 }, smoothTime: 0.2, lookAheadSeconds: 0.15, maxLookAhead: 24 });
  let previousX = camera.x;
  for (let frame = 0; frame < 120; frame += 1) {
    followCameraTarget(camera, { x: 200, y: 100, vx: 300, vy: 0, aimX: 1, aimY: 0 }, { width: 100, height: 100 }, { dtSeconds: 1 / 60 });
    assert.ok(camera.x >= previousX, 'critically damped follow must not oscillate backward');
    previousX = camera.x;
  }
  assert.ok(camera.lookAheadX <= 24 && camera.lookAheadX > 0);
  assert.ok(camera.x <= 224);
  assert.ok(Math.abs(camera.velocityY) < 1e-9);
});

test('M7 boss framing adds a bounded focus pull without abandoning the player', () => {
  const viewport = { width: 200, height: 120 };
  const bounds = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
  const baseline = createCameraState({ x: 0, y: 0, bounds, deadZone: { width: 0, height: 0 } });
  const camera = createCameraState({ x: 0, y: 0, bounds, deadZone: { width: 0, height: 0 } });
  followCameraTarget(baseline, { x: 0, y: 0 }, viewport, { smoothTime: 0 });
  followCameraTarget(camera, { x: 0, y: 0, focusX: 1000, focusY: 0, focusWeight: 0.2 }, viewport, { smoothTime: 0 });
  const focusPull = camera.x - baseline.x;
  assert.ok(focusPull > 0, 'boss focus should enter the frame');
  assert.ok(focusPull <= 20, 'focus pull stays bounded so the player remains the anchor');
  assert.equal(camera.y, baseline.y);
});

test('camera clamps to finite authored bounds without boundary drift at every zoom', () => {
  for (const zoom of [0.75, 1, 2]) {
    const camera = createCameraState({ x: 50, y: 50, zoom, deadZone: { width: 0, height: 0 }, bounds: { minX: 0, minY: 0, maxX: 200, maxY: 100 } });
    const viewport = { width: 100, height: 50 };
    for (let index = 0; index < 20; index += 1) followCameraTarget(camera, { x: -1000, y: 1000 }, viewport, { smoothTime: 0 });
    const first = { x: camera.x, y: camera.y };
    followCameraTarget(camera, { x: -1000, y: 1000 }, viewport, { smoothTime: 0 });
    assert.deepEqual({ x: camera.x, y: camera.y }, first);
    assert.ok(camera.x >= camera.bounds.minX && camera.x <= camera.bounds.maxX);
    assert.ok(camera.y >= camera.bounds.minY && camera.y <= camera.bounds.maxY);
  }
});

test('debug grid overlay exposes axis and sampled height labels without mutating world state', () => {
  const queryGround = (x, y) => ({ groundZ: (x + y) / 100, surfaceId: 'debug', walkable: true, normal: { x: 0, y: 0, z: 1 } });
  const overlay = buildDebugGridOverlay({ bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, spacing: 50, queryGround });
  assert.equal(overlay.lines.length, 6);
  assert.equal(overlay.labels.length, 9);
  assert.match(overlay.labels[0].text, /x=0 y=0 h=0/);
  assert.match(overlay.labels.at(-1).text, /x=100 y=100 h=2/);
  assert.equal(Object.isFrozen(overlay), true);
});
