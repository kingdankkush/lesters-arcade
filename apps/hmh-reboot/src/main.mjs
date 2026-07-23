import { Application, Container, Graphics, Text } from 'pixi.js';
import { createHmhChildBridge } from './bridge.mjs';
import { InputState, createBrowserInputController, mapGamepadSnapshot } from './input.mjs';
import { DeterministicSimulation } from './simulation.mjs';
import { createStandaloneInitPayload } from './standalone-session.mjs';
import {
  buildDebugGridOverlay,
  createActorSpatialState,
  createCameraState,
  createFlatGroundQuery,
  followCameraTarget,
  getGroundContact,
  interpolateSpatialState,
  worldToScreen,
} from './world-space.mjs';

const RUNTIME_VERSION = '0.2.0';
const WORLD_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 2048, maxY: 2048 });
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
  const grid = new Graphics();
  const debugLabels = new Container();
  const shadow = new Graphics().ellipse(0, 0, 30, 12).fill({ color: 0x000000, alpha: 0.4 });
  const marker = new Graphics().circle(0, 0, 24).fill({ color: 0x49ddff }).stroke({ color: 0xffffff, width: 3 });
  const label = new Text({ text: 'DETERMINISTIC RUNTIME', style: { fill: 0xe9fbff, fontFamily: 'system-ui', fontSize: 18, fontWeight: '700' } });
  label.anchor.set(0.5);
  world.addChild(backdrop, grid, debugLabels, shadow, marker, label);
  app.stage.addChild(world);

  const debugGridEnabled = new URLSearchParams(window.location.search).get('debugGrid') === '1';
  const queryGround = createFlatGroundQuery({ groundZ: 0, surfaceId: 'foundation' });
  const debugOverlay = debugGridEnabled
    ? buildDebugGridOverlay({ bounds: WORLD_BOUNDS, spacing: 512, queryGround })
    : null;

  let settings = { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false };
  let elapsedMs = 0;
  let bridge = null;
  let sessionPayload = null;
  let simulation = null;
  let actor = null;
  let previousActor = null;
  let renderActor = null;
  let camera = null;
  let input = new InputState();
  let inputController = null;
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

  const renderWorld = (renderState = renderActor ?? actor) => {
    const view = viewport();
    backdrop.clear().rect(0, 0, view.width, view.height).fill({ color: 0x071522 });
    grid.clear();
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
      const groundScreen = worldToScreen(getGroundContact(renderState), camera, view);
      const screen = worldToScreen(renderState, camera, view);
      shadow.position.set(groundScreen.x, groundScreen.y);
      marker.position.set(screen.x, screen.y);
      label.position.set(screen.x, screen.y + 58);
    } else {
      marker.position.set(view.width * 0.5, view.height * 0.5);
      label.position.set(view.width * 0.5, view.height * 0.5 + 58);
    }
  };

  const stopCurrentSession = () => {
    inputController?.destroy();
    inputController = null;
    if (simulation && simulation.state !== 'exit') simulation.exit();
    previousActor = null;
    renderActor = null;
  };

  const initializeSession = (payload) => {
    stopCurrentSession();
    sessionPayload = payload;
    settings = { ...payload.settings };
    elapsedMs = 0;
    simulation = new DeterministicSimulation({ seed: payload.session.seed });
    actor = createActorSpatialState({ x: 1024, y: 1024, z: 0 });
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
    simulation.onStep(() => {
      previousActor = createActorSpatialState({ ...actor });
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
      aimX: snapshot.actions.aim.x,
      aimY: snapshot.actions.aim.y,
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
