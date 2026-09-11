import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildDebugGridOverlay } from '../apps/hmh-reboot/src/debug-grid-overlay.mjs';
import { createAuthoredPropAtlasIndex, buildAuthoredPointOfInterestPlacements } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { createTripoPropAppearance } from '../apps/hmh-reboot/src/tripo-prop-appearance.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
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

test('elevated camera projection retains the same actor framing and exact pointer inverse', () => {
  for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
    for (const groundZ of [-40, 0, 160, 320, 480]) {
      const camera = createCameraState({x:3000,y:1500,groundZ,zoom:1.2});
      const actor = Object.freeze(createActorSpatialState({x:3000,y:1500,z:groundZ,groundZ}));
      const foot = worldToScreen(getGroundContact(actor),camera,viewport);
      assert.ok(Math.abs(foot.y-viewport.height/2)<1e-9, 'terrain elevation must not lift the hero into the HUD');
      assert.deepEqual(screenToGround(foot,camera,viewport,{z:groundZ}),{x:actor.x,y:actor.y});
      const bob = worldToScreen({...getGroundContact(actor),visualLiftZ:12},camera,viewport);
      assert.ok(Math.abs(foot.y-bob.y-14.4)<1e-9,'visual lift stays relative to the supporting ground');
    }
  }
});

test('camera follows interpolated ground height even inside the XY dead zone without following visual bob', () => {
  const viewport={width:390,height:844};
  const camera=createCameraState({x:3000,y:1500,groundZ:0});
  const actor=Object.freeze({x:3000,y:1500,z:240,groundZ:160,visualLiftZ:12});
  followCameraTarget(camera,actor,viewport,{smoothTime:0});
  assert.equal(camera.groundZ,160);
  assert.equal(camera.x,3000);assert.equal(camera.y,1500);
  assert.equal(worldToScreen(getGroundContact(actor),camera,viewport).y,422);
  assert.throws(()=>createCameraState({groundZ:Number.NaN}),/finite/i);
  assert.throws(()=>followCameraTarget(camera,{...actor,groundZ:Infinity},viewport),/finite/i);
});

test('runtime camera is initialized at the authoritative spawn ground height', () => {
  const source=readFileSync(new URL('../apps/hmh-reboot/src/main.mjs',import.meta.url),'utf8');
  const initialization=source.match(/camera = createCameraState\(\{([\s\S]*?)\n    \}\)/)?.[1];
  assert.ok(initialization,'real camera initialization is present');
  assert.match(initialization,/groundZ:\s*actor\.groundZ/);
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

test('opt-in camera dead zone is bounded by the current viewport and zoom without rewriting its authored maximum', () => {
  const bounds = { minX: -10000, minY: -10000, maxX: 10000, maxY: 10000 };
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 3440, height: 1440 }]) {
    for (const zoom of [1, 2.112, 2.8]) {
      for (const direction of [-1, 1]) {
        const camera = createCameraState({ x: 0, y: 0, zoom, bounds, lookAheadSeconds: 0, maxLookAhead: 0 });
        const target = Object.freeze({ x: direction * 200, y: direction * 200, groundZ: 160 });
        followCameraTarget(camera, target, viewport, { smoothTime: 0, maxDeadZoneFraction: 0.12 });
        const screen = worldToScreen({ ...target, z: target.groundZ }, camera, viewport);
        assert.ok(Math.abs(screen.x - viewport.width / 2) <= viewport.width * 0.06 + 1e-8, 'horizontal dead zone must fit the zoomed viewport');
        assert.ok(Math.abs(screen.y - viewport.height / 2) <= viewport.height * 0.06 + 1e-8, 'vertical dead zone must fit the zoomed viewport');
        assert.deepEqual(camera.deadZone, { width: 160, height: 90 });
        const inverse = screenToGround(screen, camera, viewport, { z: 160 });
        assert.ok(Math.abs(inverse.x - target.x) < 1e-9 && Math.abs(inverse.y - target.y) < 1e-9);
      }
    }
  }
});

test('portrait camera shows a nearby pickup before its unchanged collection radius on the ravine approach', () => {
  const viewport = { width: 390, height: 844 };
  const pickup = Object.freeze({ x: 3200, y: 1400, z: 160 });
  for (const dtSeconds of [1 / 60, 1 / 30, 1 / 20]) {
    const camera = createCameraState({ x: 3050, y: 1500, groundZ: 160, zoom: 2.112, smoothTime: 0.1 });
    const speed = 240 / Math.sqrt(2);
    let sawBeforeCollection = false;
    for (let step = 1; step < 120; step += 1) {
      const target = Object.freeze({ x: 3050 + speed * dtSeconds * step, y: 1500 - speed * dtSeconds * step, vx: speed, vy: -speed, groundZ: 160 });
      if (Math.hypot(target.x - pickup.x, target.y - pickup.y) <= 80) break;
      followCameraTarget(camera, target, viewport, { dtSeconds, maxDeadZoneFraction: 0.12 });
      const screen = worldToScreen(pickup, camera, viewport);
      sawBeforeCollection ||= screen.x >= 8 && screen.x <= viewport.width - 8 && screen.y >= 8 && screen.y <= viewport.height - 8;
    }
    assert.equal(sawBeforeCollection, true, `clock must enter the portrait view before collection at dt=${dtSeconds}`);
    assert.equal(camera.zoom, 2.112, 'approved hero scale is unchanged');
  }
});

test('shipped portrait camera reveals the complete native clock silhouette before pickup range', () => {
  const metadata = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props/hmh-tripo-props.json', import.meta.url), 'utf8'));
  const legacy = createAuthoredPropAtlasIndex(JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url), 'utf8')));
  const native = createTripoPropAppearance(metadata, metadata.pages.map(page => ({ source: { width: page.width, height: page.height } })), legacy);
  const frame = native.get('time-dilation').frame;
  const pickup = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest).find(p => p.assetId === 'time-dilation');
  assert.ok(pickup);
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const initialization = source.match(/camera = createCameraState\(\{([\s\S]*?)\n    \}\)/)?.[1];
  const setting = (name, fallback) => Number(initialization.match(new RegExp(`${name}:\\s*([0-9.]+)`))?.[1] ?? fallback);
  const viewport = { width: 390, height: 844 };
  for (const dtSeconds of [1 / 240, 1 / 60, 1 / 30, 1 / 20, 1 / 15]) {
    const camera = createCameraState({ x: 3050, y: 1500, groundZ: 160, zoom: 2.112, smoothTime: setting('smoothTime', 0.18), lookAheadSeconds: setting('lookAheadSeconds', 0.12), maxLookAhead: setting('maxLookAhead', 32) });
    const speed = 240 / Math.sqrt(2);
    let completeSilhouette = false;
    for (let step = 1; step < 240; step += 1) {
      const target = Object.freeze({ x: 3050 + speed * dtSeconds * step, y: 1500 - speed * dtSeconds * step, vx: speed, vy: -speed, groundZ: 160 });
      if (Math.hypot(target.x - pickup.x, target.y - pickup.y) < 90) break;
      followCameraTarget(camera, target, viewport, { dtSeconds, maxDeadZoneFraction: 0.12 });
      const screen = worldToScreen({ ...pickup, z: 160 + 13 }, camera, viewport);
      const scale = frame.runtimeScale * (pickup.scale ?? 1) * camera.zoom;
      const left = screen.x + (frame.alphaBounds.x - frame.anchor.x * frame.frame.w) * scale;
      const top = screen.y + (frame.alphaBounds.y - frame.anchor.y * frame.frame.h) * scale;
      completeSilhouette ||= left >= 12 && left + frame.alphaBounds.w * scale <= viewport.width - 12 && top >= 234 && top + frame.alphaBounds.h * scale < 620;
    }
    assert.ok(completeSilhouette, `native painted bounds must clear viewport, HUD and hint before collection at dt=${dtSeconds}`);
  }
});

test('camera retains bounds and inverse aiming while the same camera is resized and rezoomed', () => {
  const camera = createCameraState({ x: 400, y: 500, bounds: { minX: 0, minY: 0, maxX: 4000, maxY: 4000 } });
  for (const [width, height, zoom, maxDeadZoneFraction] of [[1440, 900, 1, 0.12], [390, 844, 2.112, 0.12], [844, 390, 1, 0], [3440, 1440, 3.603, 1]]) {
    camera.zoom = zoom;
    const viewport = { width, height };
    const target = Object.freeze({ x: 2500, y: 1800, groundZ: 160 });
    followCameraTarget(camera, target, viewport, { smoothTime: 0, maxDeadZoneFraction });
    const screen = worldToScreen({ ...target, z: 160 }, camera, viewport);
    const inverse = screenToGround(screen, camera, viewport, { z: 160 });
    assert.ok(Math.abs(inverse.x - target.x) < 1e-9 && Math.abs(inverse.y - target.y) < 1e-9);
    assert.deepEqual(camera.deadZone, { width: 160, height: 90 });
    assert.ok(camera.x >= camera.bounds.minX && camera.x <= camera.bounds.maxX);
    assert.ok(camera.y >= camera.bounds.minY && camera.y <= camera.bounds.maxY);
  }
});

test('viewport camera dead-zone fraction rejects non-finite and out-of-range inputs', () => {
  for (const maxDeadZoneFraction of [-0.1, 1.1, Number.NaN, Infinity]) {
    assert.throws(() => followCameraTarget(createCameraState(), { x: 500, y: 500 }, { width: 390, height: 844 }, { maxDeadZoneFraction }), /fraction/i);
  }
});

test('runtime enables the viewport-bounded camera follow instead of changing hero or collection authority', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /followCameraTarget\(camera,[\s\S]*?maxDeadZoneFraction:\s*0\.12/);
  const initialization = source.match(/camera = createCameraState\(\{([\s\S]*?)\n    \}\)/)?.[1];
  assert.match(initialization, /smoothTime:\s*0\.1\b/, 'responsive damping must be active in the shipped camera');
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
  for (const zoom of [0.75, 0.9, 0.94, 1, 2]) {
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

test('a render zoom that eases between frames keeps the camera inside bounds on every frame (Cycle 074 V-6)', () => {
  const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
  const viewport = { width: 100, height: 50 };
  const camera = createCameraState({ x: 20, y: 20, zoom: 1, deadZone: { width: 0, height: 0 }, bounds });
  // Ease 1 -> 0.9 -> 1 while the target sits in the corner, so the visible
  // half-extent grows and shrinks against the clamp each frame.
  const zooms = [];
  for (let frame = 0; frame <= 24; frame += 1) zooms.push(1 - 0.1 * (frame / 24));
  for (let frame = 1; frame <= 48; frame += 1) zooms.push(0.9 + 0.1 * (frame / 48));
  for (const zoom of zooms) {
    camera.zoom = zoom;
    followCameraTarget(camera, { x: -1000, y: 1000 }, viewport, { smoothTime: 0 });
    const halfX = viewport.width / (2 * zoom);
    const halfY = viewport.height / (2 * zoom);
    assert.ok(camera.x >= bounds.minX + halfX - 1e-9 && camera.x <= bounds.maxX - halfX + 1e-9, `x ${camera.x} escapes at zoom ${zoom}`);
    assert.ok(camera.y >= bounds.minY + halfY - 1e-9 && camera.y <= bounds.maxY - halfY + 1e-9, `y ${camera.y} escapes at zoom ${zoom}`);
    assert.equal(camera.velocityX, 0, 'a clamped axis carries no spring-back velocity');
  }
  // Back at zoom 1 the camera sits exactly where a zoom-1 camera would.
  const reference = createCameraState({ x: 20, y: 20, zoom: 1, deadZone: { width: 0, height: 0 }, bounds });
  followCameraTarget(reference, { x: -1000, y: 1000 }, viewport, { smoothTime: 0 });
  assert.deepEqual({ x: camera.x, y: camera.y }, { x: reference.x, y: reference.y });
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
