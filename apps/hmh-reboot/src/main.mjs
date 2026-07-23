import { Application, Container, Graphics, Text } from 'pixi.js';
import { createAimState, resolveAimIntent } from './aim.mjs';
import { createHmhChildBridge } from './bridge.mjs';
import {
  auditCollisionWorld,
  createCollisionBody,
  createStaticBlocker,
  resolveSweptCircleMotion,
} from './collision.mjs';
import {
  createAuthoredGroundQuery,
  createElevationSurface,
  movementSpeedMultiplierForTransition,
  resolveSweptTraversalPath,
} from './elevation.mjs';
import { InputState, createBrowserInputController, mapGamepadSnapshot } from './input.mjs';
import {
  applyRecoilImpulse,
  createPlayerMotionState,
  resolveEnemyPressure,
  stepPlayerMovement,
} from './movement.mjs';
import { DeterministicSimulation } from './simulation.mjs';
import { createStandaloneInitPayload } from './standalone-session.mjs';
import { createTouchControlAdapter } from './touch-controls.mjs';
import {
  buildDebugGridOverlay,
  createActorSpatialState,
  createCameraState,
  followCameraTarget,
  getGroundContact,
  interpolateSpatialState,
  worldToScreen,
} from './world-space.mjs';

const RUNTIME_VERSION = '0.3.0';
const WORLD_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 2048, maxY: 2048, visibleBoundaryId: 'graybox-cliff-ring' });
const BASE_SURFACE = createElevationSurface({
  id: 'foundation', kind: 'ground', area: { type: 'rect', ...WORLD_BOUNDS },
  groundZ: 0, visibleTerrainId: 'graybox-foundation', priority: 0,
});
const GRAYBOX_SURFACES = Object.freeze([
  createElevationSurface({
    id: 'south-river', kind: 'water', area: { type: 'rect', minX: 650, minY: 1260, maxX: 1600, maxY: 1440 },
    groundZ: -18, waterLevel: 6, deepWater: true, visibleTerrainId: 'graybox-south-river', priority: 1,
  }),
  createElevationSurface({
    id: 'south-shallows', kind: 'shallow-water', area: { type: 'rect', minX: 650, minY: 1220, maxX: 820, maxY: 1260 },
    groundZ: 0, waterLevel: 4, deepWater: false, visibleTerrainId: 'graybox-south-shallows', priority: 2,
  }),
  createElevationSurface({
    id: 'river-bridge-north-ramp', kind: 'ramp', area: { type: 'rect', minX: 1000, minY: 1235, maxX: 1120, maxY: 1265 },
    fromZ: 0, toZ: 16, axis: 'y', visibleTerrainId: 'graybox-river-bridge-north-ramp', priority: 5,
  }),
  createElevationSurface({
    id: 'river-bridge', kind: 'bridge', area: { type: 'rect', minX: 1000, minY: 1265, maxX: 1120, maxY: 1435 },
    groundZ: 16, visibleTerrainId: 'graybox-river-bridge', priority: 4,
  }),
  createElevationSurface({
    id: 'river-bridge-south-ramp', kind: 'ramp', area: { type: 'rect', minX: 1000, minY: 1435, maxX: 1120, maxY: 1465 },
    fromZ: 16, toZ: 0, axis: 'y', visibleTerrainId: 'graybox-river-bridge-south-ramp', priority: 5,
  }),
  createElevationSurface({
    id: 'east-ramp', kind: 'ramp', area: { type: 'rect', minX: 1320, minY: 900, maxX: 1440, maxY: 1100 },
    fromZ: 0, toZ: 64, axis: 'x', visibleTerrainId: 'graybox-east-ramp', priority: 4,
  }),
  createElevationSurface({
    id: 'east-ledge', kind: 'ledge', area: { type: 'rect', minX: 1440, minY: 850, maxX: 1700, maxY: 1150 },
    groundZ: 64, oneWayDrop: { x: 0, y: 1 }, visibleTerrainId: 'graybox-east-ledge', priority: 3,
  }),
]);
const queryGround = createAuthoredGroundQuery({ baseSurface: BASE_SURFACE, surfaces: GRAYBOX_SURFACES });
const GRAYBOX_BLOCKERS = Object.freeze([
  createStaticBlocker({
    id: 'concrete-divider',
    shape: { type: 'polygon', vertices: [{ x: 1160, y: 880 }, { x: 1192, y: 880 }, { x: 1192, y: 1120 }, { x: 1160, y: 1120 }] },
    visibleAssetId: 'graybox-concrete-divider',
    minZ: 0,
    maxZ: 96,
  }),
  createStaticBlocker({
    id: 'south-boulder',
    shape: { type: 'circle', x: 1000, y: 1230, radius: 52 },
    visibleAssetId: 'graybox-south-boulder',
    minZ: 0,
    maxZ: 72,
  }),
  createStaticBlocker({
    id: 'north-rail',
    shape: { type: 'capsule', a: { x: 860, y: 850 }, b: { x: 1120, y: 850 }, radius: 8 },
    visibleAssetId: 'graybox-north-rail',
    minZ: 0,
    maxZ: 54,
  }),
]);
const COLLISION_AUDIT = auditCollisionWorld({
  blockers: GRAYBOX_BLOCKERS,
  visibleBarriers: GRAYBOX_BLOCKERS.map((blocker) => ({ id: blocker.visibleAssetId, hard: true, collisionBlockerIds: [blocker.id] })),
});
if (!COLLISION_AUDIT.ok) throw new Error(`Invalid authored collision world: ${COLLISION_AUDIT.errors.join('; ')}`);
const stageElement = document.querySelector('#hmhRebootStage');
const statusElement = document.querySelector('#hmhRebootStatus');
const sessionElement = document.querySelector('#hmhRebootSession');

function setStatus(status, detail = '') {
  if (statusElement) statusElement.textContent = status;
  if (sessionElement) sessionElement.textContent = detail;
}

async function boot() {
  if (!stageElement) throw new Error('HMH reboot stage is missing');
  const app = new Application();
  await app.init({
    resizeTo: stageElement,
    background: '#071522',
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
    powerPreference: 'high-performance',
  });
  app.ticker.stop();
  app.canvas.tabIndex = 0;
  app.canvas.setAttribute('aria-label', 'Hard Money Heroes gameplay canvas');
  stageElement.replaceChildren(app.canvas);

  const world = new Container();
  const backdrop = new Graphics();
  const terrainGeometry = new Graphics();
  const grid = new Graphics();
  const collisionGeometry = new Graphics();
  const collisionDebug = new Graphics();
  const debugLabels = new Container();
  const shadow = new Graphics().ellipse(0, 0, 30, 12).fill({ color: 0x000000, alpha: 0.4 });
  const aimLine = new Graphics();
  const targetMarker = new Graphics().circle(0, 0, 30).fill({ color: 0xff5c7a, alpha: 0.28 }).stroke({ color: 0xff8ca1, width: 3 });
  const marker = new Graphics().circle(0, 0, 24).fill({ color: 0x49ddff }).stroke({ color: 0xffffff, width: 3 });
  const label = new Text({ text: 'DETERMINISTIC RUNTIME', style: { fill: 0xe9fbff, fontFamily: 'system-ui', fontSize: 18, fontWeight: '700' } });
  label.anchor.set(0.5);
  world.addChild(backdrop, terrainGeometry, grid, collisionGeometry, debugLabels, shadow, targetMarker, aimLine, marker, collisionDebug, label);
  app.stage.addChild(world);

  const debugGridEnabled = new URLSearchParams(window.location.search).get('debugGrid') === '1';
  const debugOverlay = debugGridEnabled
    ? buildDebugGridOverlay({ bounds: WORLD_BOUNDS, spacing: 512, queryGround })
    : null;

  let settings = { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false };
  let elapsedMs = 0;
  let bridge = null;
  let sessionPayload = null;
  let simulation = null;
  let actor = null;
  let motion = null;
  let aimState = null;
  let aimIntent = null;
  let grayboxEnemies = [];
  let playerBody = null;
  let lastCollision = null;
  let lastTraversal = null;
  let lastGround = null;
  let zeroDisplacementFrames = 0;
  let previousGrenade = false;
  let previousActor = null;
  let renderActor = null;
  let camera = null;
  let input = new InputState();
  let inputController = null;
  let touchController = null;
  let gamepadWasActive = false;

  if (debugOverlay) {
    for (const descriptor of debugOverlay.labels) {
      const debugLabel = new Text({
        text: descriptor.text,
        style: { fill: 0x74b8cc, fontFamily: 'ui-monospace, monospace', fontSize: 10 },
      });
      debugLabel.alpha = 0.72;
      debugLabels.addChild(debugLabel);
    }
  }

  const viewport = () => ({ width: app.screen.width, height: app.screen.height });

  const renderAuthoredTerrain = (view) => {
    terrainGeometry.clear();
    const colors = { water: 0x176b8a, 'shallow-water': 0x248aa5, bridge: 0x9a774d, ramp: 0x536f56, ledge: 0x415744 };
    for (const surface of GRAYBOX_SURFACES) {
      const area = surface.area;
      const vertices = area.type === 'rect'
        ? [{ x: area.minX, y: area.minY }, { x: area.maxX, y: area.minY }, { x: area.maxX, y: area.maxY }, { x: area.minX, y: area.maxY }]
        : area.vertices;
      const points = vertices.map((vertex) => {
        const sampled = queryGround(vertex.x, vertex.y);
        const z = surface.waterLevel ?? sampled.groundZ;
        return worldToScreen({ ...vertex, z }, camera, view);
      });
      terrainGeometry.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) terrainGeometry.lineTo(point.x, point.y);
      terrainGeometry.closePath().fill({ color: colors[surface.kind] ?? 0x415744, alpha: surface.kind === 'water' ? 0.82 : 0.94 })
        .stroke({ color: 0xb4d6c1, width: 2, alpha: 0.72 });
    }
  };

  const renderAuthoredCollision = (view) => {
    collisionGeometry.clear();
    for (const blocker of GRAYBOX_BLOCKERS) {
      const shape = blocker.shape;
      if (shape.type === 'circle') {
        const center = worldToScreen({ x: shape.x, y: shape.y, z: 0 }, camera, view);
        collisionGeometry.circle(center.x, center.y, shape.radius * camera.zoom).fill({ color: 0x314f61, alpha: 0.95 }).stroke({ color: 0x8dc6d8, width: 2 });
      } else if (shape.type === 'capsule') {
        const a = worldToScreen({ ...shape.a, z: 0 }, camera, view);
        const b = worldToScreen({ ...shape.b, z: 0 }, camera, view);
        collisionGeometry.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x8dc6d8, width: shape.radius * 2 * camera.zoom, cap: 'round' });
      } else {
        const points = shape.vertices.map((vertex) => worldToScreen({ ...vertex, z: 0 }, camera, view));
        collisionGeometry.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) collisionGeometry.lineTo(point.x, point.y);
        collisionGeometry.closePath().fill({ color: 0x314f61, alpha: 0.95 }).stroke({ color: 0x8dc6d8, width: 2 });
      }
    }
    const topLeft = worldToScreen({ x: WORLD_BOUNDS.minX, y: WORLD_BOUNDS.minY, z: 0 }, camera, view);
    const bottomRight = worldToScreen({ x: WORLD_BOUNDS.maxX, y: WORLD_BOUNDS.maxY, z: 0 }, camera, view);
    collisionGeometry.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y).stroke({ color: 0x49ddff, width: 4, alpha: 0.65 });
  };

  const renderWorld = (renderState = renderActor ?? actor) => {
    const view = viewport();
    backdrop.clear().rect(0, 0, view.width, view.height).fill({ color: 0x071522 });
    terrainGeometry.clear();
    grid.clear();
    collisionGeometry.clear();
    collisionDebug.clear();
    if (debugOverlay && camera) {
      for (const line of debugOverlay.lines) {
        const from = worldToScreen({ ...line.from, z: 0 }, camera, view);
        const to = worldToScreen({ ...line.to, z: 0 }, camera, view);
        grid.moveTo(from.x, from.y).lineTo(to.x, to.y);
      }
      grid.stroke({ color: 0x2d7188, width: 1, alpha: 0.55 });
      for (let index = 0; index < debugOverlay.labels.length; index += 1) {
        const descriptor = debugOverlay.labels[index];
        const screen = worldToScreen({ x: descriptor.x, y: descriptor.y, z: descriptor.height }, camera, view);
        debugLabels.children[index].position.set(screen.x + 4, screen.y + 4);
      }
    } else {
      for (let x = 0; x <= view.width; x += 64) grid.moveTo(x, 0).lineTo(x, view.height);
      for (let y = 0; y <= view.height; y += 64) grid.moveTo(0, y).lineTo(view.width, y);
      grid.stroke({ color: 0x1c5267, width: 1, alpha: 0.42 });
    }
    if (renderState && camera) {
      renderAuthoredTerrain(view);
      renderAuthoredCollision(view);
      const groundScreen = worldToScreen(getGroundContact(renderState), camera, view);
      const screen = worldToScreen(renderState, camera, view);
      const target = grayboxEnemies[0];
      if (target) {
        const targetScreen = worldToScreen({ ...target, z: 0 }, camera, view);
        targetMarker.position.set(targetScreen.x, targetScreen.y);
      }
      aimLine.clear();
      if (aimIntent) {
        const aimEnd = worldToScreen({
          x: renderState.x + aimIntent.direction.x * 96,
          y: renderState.y + aimIntent.direction.y * 96,
          z: renderState.z,
        }, camera, view);
        aimLine.moveTo(screen.x, screen.y).lineTo(aimEnd.x, aimEnd.y).stroke({ color: aimIntent.fire ? 0xffd166 : 0x49ddff, width: 3, alpha: 0.85 });
      }
      shadow.position.set(groundScreen.x, groundScreen.y);
      marker.position.set(screen.x, screen.y);
      marker.rotation = motion ? motion.torsoDirection * (Math.PI / 4) : 0;
      if (debugGridEnabled && playerBody) {
        collisionDebug.circle(groundScreen.x, groundScreen.y, playerBody.radius * camera.zoom).stroke({ color: 0xffd166, width: 2, alpha: 0.9 });
        const contact = lastCollision?.contacts.at(-1);
        if (contact) {
          collisionDebug.moveTo(groundScreen.x, groundScreen.y)
            .lineTo(groundScreen.x + contact.normal.x * 48, groundScreen.y + contact.normal.y * 48)
            .stroke({ color: 0xff5c7a, width: 3, alpha: 0.9 });
        }
      }
      const runtimeMode = `${aimIntent?.source?.toUpperCase() ?? 'NO AIM'} // ${motion?.locomotion?.toUpperCase() ?? 'IDLE'}`;
      const debugContact = lastCollision?.contacts.at(-1)?.blockerId ?? lastTraversal?.reason ?? 'clear';
      const narrowDebug = debugGridEnabled && view.width < 600;
      label.style.fontSize = narrowDebug ? 12 : 18;
      label.style.align = 'center';
      label.text = aimIntent
        ? narrowDebug
          ? `${runtimeMode}\n${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}`
          : `${runtimeMode}${debugGridEnabled ? ` // ${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}` : ''}`
        : 'DETERMINISTIC RUNTIME';
      const halfLabelWidth = label.width * 0.5;
      const clampedLabelX = Math.min(view.width - halfLabelWidth - 8, Math.max(halfLabelWidth + 8, screen.x));
      label.position.set(clampedLabelX, screen.y + (narrowDebug ? 54 : 58));
      if (debugGridEnabled) {
        stageElement.dataset.actorX = renderState.x.toFixed(3);
        stageElement.dataset.actorY = renderState.y.toFixed(3);
        stageElement.dataset.targetX = grayboxEnemies[0]?.x.toFixed(3) ?? '';
        stageElement.dataset.aimSource = aimIntent?.source ?? 'none';
        stageElement.dataset.firing = String(aimIntent?.fire === true);
        stageElement.dataset.collisionBlocker = lastCollision?.contacts.at(-1)?.blockerId ?? '';
        stageElement.dataset.collisionStalls = String(zeroDisplacementFrames);
        stageElement.dataset.surfaceId = lastGround?.surfaceId ?? '';
        stageElement.dataset.groundZ = String(lastGround?.groundZ ?? 0);
        stageElement.dataset.traversal = lastTraversal?.reason ?? '';
      }
    } else {
      marker.position.set(view.width * 0.5, view.height * 0.5);
      label.position.set(view.width * 0.5, view.height * 0.5 + 58);
    }
  };

  const stopCurrentSession = () => {
    touchController?.destroy();
    touchController = null;
    inputController?.destroy();
    inputController = null;
    if (simulation && simulation.state !== 'exit') simulation.exit();
    previousActor = null;
    renderActor = null;
    motion = null;
    aimState = null;
    aimIntent = null;
    grayboxEnemies = [];
    playerBody = null;
    lastCollision = null;
    lastTraversal = null;
    lastGround = null;
    zeroDisplacementFrames = 0;
  };

  const initializeSession = (payload) => {
    stopCurrentSession();
    sessionPayload = payload;
    settings = { ...payload.settings };
    elapsedMs = 0;
    simulation = new DeterministicSimulation({ seed: payload.session.seed });
    actor = createActorSpatialState({ x: 1024, y: 1024, z: 0 });
    lastGround = queryGround(actor.x, actor.y);
    actor.groundZ = lastGround.groundZ;
    actor.z = lastGround.groundZ;
    motion = createPlayerMotionState({ x: actor.x, y: actor.y, maxSpeed: 240 });
    aimState = createAimState({ autoFireEnabled: true, manualHoldTicks: 8 });
    aimIntent = null;
    grayboxEnemies = [{ id: 'graybox-target', x: 1280, y: 1024, radius: 30, kind: 'regular', active: true, targetable: true }];
    playerBody = createCollisionBody({ id: 'player', kind: 'player', radius: 24, minZ: 0, maxZ: 56 });
    previousGrenade = false;
    previousActor = createActorSpatialState({ ...actor });
    renderActor = actor;
    camera = createCameraState({
      x: actor.x,
      y: actor.y,
      zoom: 1,
      deadZone: { width: 160, height: 90 },
      bounds: WORLD_BOUNDS,
    });
    input = new InputState();
    gamepadWasActive = false;
    inputController = createBrowserInputController({ input, target: app.canvas, windowRef: window, documentRef: document });
    touchController = createTouchControlAdapter({
      input,
      root: stageElement,
      windowRef: window,
      documentRef: document,
      onPause: () => {
        if (simulation?.state === 'paused') resumeRuntime('user');
        else pauseRuntime('user');
      },
    });
    simulation.onStep(({ tick, dtSeconds, input: tickInput }) => {
      previousActor = createActorSpatialState({ ...actor });
      aimIntent = resolveAimIntent(aimState, {
        tick,
        actor: motion,
        input: tickInput,
        targets: grayboxEnemies,
        device: tickInput.aimAssist ? 'gamepad' : 'pointer',
      });
      if (tickInput.grenade && !previousGrenade) {
        applyRecoilImpulse(motion, {
          direction: { x: -aimIntent.direction.x, y: -aimIntent.direction.y },
          magnitude: 70,
        });
      }
      previousGrenade = tickInput.grenade;
      const movementStart = { x: motion.x, y: motion.y, z: actor.groundZ };
      const currentGround = queryGround(motion.x, motion.y);
      const moveMagnitude = Math.hypot(tickInput.move.x, tickInput.move.y);
      let terrainSpeedMultiplier = 1;
      if (moveMagnitude > 0.001) {
        const probeDistance = Math.max(8, motion.maxSpeed * dtSeconds);
        const probeGround = queryGround(
          motion.x + tickInput.move.x / moveMagnitude * probeDistance,
          motion.y + tickInput.move.y / moveMagnitude * probeDistance,
        );
        terrainSpeedMultiplier = movementSpeedMultiplierForTransition(currentGround, probeGround, probeDistance);
      }
      stepPlayerMovement(motion, {
        move: tickInput.move,
        aim: { ...aimIntent.direction, active: true },
      }, { dtSeconds, speedMultiplier: terrainSpeedMultiplier });
      const pressure = resolveEnemyPressure({
        x: motion.x,
        y: motion.y,
        radius: 24,
        velocity: { x: motion.vx, y: motion.vy },
      }, grayboxEnemies);
      motion.x += pressure.playerDelta.x;
      motion.y += pressure.playerDelta.y;
      for (const enemy of grayboxEnemies) {
        const delta = pressure.enemyDeltas.get(enemy.id);
        if (delta) { enemy.x += delta.x; enemy.y += delta.y; }
      }
      lastCollision = resolveSweptCircleMotion({
        body: playerBody,
        start: movementStart,
        delta: { x: motion.x - movementStart.x, y: motion.y - movementStart.y },
        blockers: GRAYBOX_BLOCKERS,
        bounds: WORLD_BOUNDS,
        priorZeroDisplacementFrames: zeroDisplacementFrames,
      });
      motion.x = lastCollision.position.x;
      motion.y = lastCollision.position.y;
      lastTraversal = resolveSweptTraversalPath({
        start: movementStart,
        end: lastCollision.position,
        queryGround,
        maxSampleDistance: Math.max(4, playerBody.radius * 0.5),
      });
      motion.x = lastTraversal.position.x;
      motion.y = lastTraversal.position.y;
      lastGround = lastTraversal.ground;
      if (!lastTraversal.allowed) {
        motion.vx = 0;
        motion.vy = 0;
        motion.recoilVx = 0;
        motion.recoilVy = 0;
      }
      zeroDisplacementFrames = lastCollision.telemetry.zeroDisplacementFrames;
      for (const contact of lastCollision.contacts) {
        const inwardVelocity = motion.vx * contact.normal.x + motion.vy * contact.normal.y;
        if (inwardVelocity < 0) {
          motion.vx -= contact.normal.x * inwardVelocity;
          motion.vy -= contact.normal.y * inwardVelocity;
        }
        const inwardRecoil = motion.recoilVx * contact.normal.x + motion.recoilVy * contact.normal.y;
        if (inwardRecoil < 0) {
          motion.recoilVx -= contact.normal.x * inwardRecoil;
          motion.recoilVy -= contact.normal.y * inwardRecoil;
        }
      }
      actor.x = motion.x;
      actor.y = motion.y;
      actor.groundZ = lastGround.groundZ;
      actor.z = lastGround.groundZ;
      actor.vx = motion.vx;
      actor.vy = motion.vy;
      actor.heading = Math.atan2(aimIntent.direction.y, aimIntent.direction.x);
      actor.locomotion = motion.locomotion;
      actor.combat = aimIntent.fire ? 'firing' : 'ready';
    });
    simulation.start();
    app.ticker.start();
    renderWorld();
  };

  const statePayload = (status = simulation?.state === 'active' ? 'running' : 'paused') => ({
    status,
    score: 0,
    kills: 0,
    elapsedMs,
    health: 100,
    maxHealth: 100,
    xp: 0,
    level: 1,
    paused: status === 'paused',
  });

  const pauseRuntime = (source) => {
    if (simulation?.state === 'active' || simulation?.state === 'upgrade') simulation.pause();
    app.ticker.stop();
    if (bridge?.initialized) {
      bridge.send('game:pause', { paused: true, source });
      bridge.send('game:state', statePayload('paused'));
    }
  };

  const resumeRuntime = (source = 'portal') => {
    if (simulation?.state === 'paused') simulation.resume();
    app.ticker.start();
    if (bridge?.initialized) {
      bridge.send('game:pause', { paused: false, source });
      bridge.send('game:state', statePayload('running'));
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') pauseRuntime('visibility');
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const handleResize = () => renderWorld();
  app.canvas.addEventListener('pointerdown', () => app.canvas.focus());
  app.renderer.on('resize', handleResize);
  app.ticker.add((ticker) => {
    if (!simulation || simulation.state !== 'active' || !actor || !camera) return;
    const nowMs = performance.now();
    const gamepad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (gamepad) {
      const mapped = mapGamepadSnapshot(gamepad);
      const active = mapped.move.x !== 0 || mapped.move.y !== 0 || mapped.aim.x !== 0 || mapped.aim.y !== 0
        || Object.values(mapped.actions).some(Boolean);
      if (active || gamepadWasActive) {
        input.setGamepad({
          moveX: mapped.move.x,
          moveY: mapped.move.y,
          aimX: mapped.aim.x,
          aimY: mapped.aim.y,
          ...mapped.actions,
        }, nowMs);
      }
      gamepadWasActive = active;
    } else if (gamepadWasActive) {
      input.setGamepad({}, nowMs);
      gamepadWasActive = false;
    }
    const snapshot = input.snapshot({ actor, camera, viewport: viewport(), nowMs });
    const frame = simulation.update(ticker.deltaMS, snapshot.actions);
    elapsedMs = simulation.timeMs;
    renderActor = interpolateSpatialState(previousActor ?? actor, actor, frame.alpha);
    followCameraTarget(camera, {
      ...actor,
      aimX: aimIntent?.direction.x ?? snapshot.actions.aim.x,
      aimY: aimIntent?.direction.y ?? snapshot.actions.aim.y,
    }, viewport(), { dtSeconds: Math.max(1 / 240, Math.min(ticker.deltaMS / 1000, 1 / 15)) });
    renderWorld(renderActor);
    if (!settings.reduceMotion) marker.scale.set(1 + Math.sin(elapsedMs * 0.004) * 0.08);
    else marker.scale.set(1);
  });

  const handleExitKey = (event) => {
    if (event.key !== 'Escape' || event.repeat) return;
    event.preventDefault();
    if (event.shiftKey && bridge?.initialized) bridge.send('game:exit', { reason: 'menu' });
    else if (simulation?.state === 'paused') resumeRuntime('user');
    else pauseRuntime('user');
  };
  window.addEventListener('keydown', handleExitKey);

  if (window.parent !== window) {
    bridge = createHmhChildBridge({
      windowRef: window,
      expectedParentOrigin: window.location.origin,
      runtimeInfo: { runtimeVersion: RUNTIME_VERSION, renderer: 'pixi.js', capabilities: ['pause', 'settings', 'restart', 'resize', 'exit', 'run-events', 'score-result', 'achievements'] },
      onInit: (payload) => {
        initializeSession(payload);
        setStatus('Portal session connected', `${payload.mode.toUpperCase()} // ${payload.heroId} // seed ${payload.session.seed}`);
        queueMicrotask(() => bridge?.send('game:state', statePayload('running')));
      },
      onMessage: (message) => {
        if (message.type === 'portal:pause') {
          pauseRuntime('portal');
        } else if (message.type === 'portal:resume') {
          resumeRuntime('portal');
        } else if (message.type === 'portal:settings') {
          settings = { ...message.payload.settings };
          bridge.send('game:settings', { settings: { ...settings } });
          bridge.send('game:state', statePayload(simulation?.state === 'active' ? 'running' : 'paused'));
        } else if (message.type === 'portal:restart') {
          initializeSession(sessionPayload);
          marker.scale.set(1);
          bridge.send('game:state', statePayload('running'));
        } else if (message.type === 'portal:dispose') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('keydown', handleExitKey);
          app.renderer.off('resize', handleResize);
          app.ticker.stop();
          stopCurrentSession();
          app.destroy(true);
        }
      },
      onProtocolError: (error) => {
        app.ticker.stop();
        setStatus('Bridge protocol error', error.message);
      },
    });
    bridge.start();
    setStatus('Renderer ready', 'Waiting for portal session…');
  } else {
    const payload = window.parent === window ? createStandaloneInitPayload() : null;
    initializeSession(payload);
    setStatus('Standalone session ready', `${payload.mode.toUpperCase()} // seed ${payload.session.seed} // no portal authority`);
  }
}

boot().catch((error) => {
  setStatus('Renderer initialization failed', error instanceof Error ? error.message : 'Unknown startup error');
});
