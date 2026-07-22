import { Application, Container, Graphics, Text } from 'pixi.js';
import { createHmhChildBridge } from './bridge.mjs';

const RUNTIME_VERSION = '0.1.0';
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
  stageElement.replaceChildren(app.canvas);

  const world = new Container();
  const grid = new Graphics();
  const marker = new Graphics().circle(0, 0, 24).fill({ color: 0x49ddff }).stroke({ color: 0xffffff, width: 3 });
  const label = new Text({ text: 'REBOOT RUNTIME READY', style: { fill: 0xe9fbff, fontFamily: 'system-ui', fontSize: 18, fontWeight: '700' } });
  label.anchor.set(0.5);
  world.addChild(grid, marker, label);
  app.stage.addChild(world);

  let settings = { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false };
  let elapsedMs = 0;
  let bridge = null;

  const redraw = () => {
    const width = app.screen.width;
    const height = app.screen.height;
    grid.clear();
    grid.rect(0, 0, width, height).fill({ color: 0x071522 });
    for (let x = 0; x <= width; x += 64) grid.moveTo(x, 0).lineTo(x, height);
    for (let y = 0; y <= height; y += 64) grid.moveTo(0, y).lineTo(width, y);
    grid.stroke({ color: 0x1c5267, width: 1, alpha: 0.42 });
    marker.position.set(width * 0.5, height * 0.5);
    label.position.set(width * 0.5, height * 0.5 + 58);
  };
  redraw();
  app.renderer.on('resize', redraw);
  app.ticker.add((ticker) => {
    elapsedMs += ticker.deltaMS;
    if (!settings.reduceMotion) marker.scale.set(1 + Math.sin(elapsedMs * 0.004) * 0.08);
    else marker.scale.set(1);
  });

  const statePayload = (status = app.ticker.started ? 'running' : 'paused') => ({
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

  if (window.parent !== window) {
    bridge = createHmhChildBridge({
      windowRef: window,
      expectedParentOrigin: window.location.origin,
      runtimeInfo: { runtimeVersion: RUNTIME_VERSION, renderer: 'pixi.js', capabilities: ['pause', 'settings', 'restart', 'resize'] },
      onInit: (payload) => {
        settings = { ...payload.settings };
        setStatus('Portal session connected', `${payload.mode.toUpperCase()} // ${payload.heroId}`);
        queueMicrotask(() => bridge?.send('game:state', statePayload('running')));
      },
      onMessage: (message) => {
        if (message.type === 'portal:pause') {
          app.ticker.stop();
          bridge.send('game:state', statePayload('paused'));
        } else if (message.type === 'portal:resume') {
          app.ticker.start();
          bridge.send('game:state', statePayload('running'));
        } else if (message.type === 'portal:settings') {
          settings = { ...message.payload.settings };
          bridge.send('game:state', statePayload(app.ticker.started ? 'running' : 'paused'));
        } else if (message.type === 'portal:restart') {
          elapsedMs = 0;
          marker.scale.set(1);
          app.ticker.start();
          bridge.send('game:state', statePayload('running'));
        } else if (message.type === 'portal:dispose') {
          app.ticker.stop();
          app.destroy(true);
        }
      },
      onProtocolError: (error) => setStatus('Bridge protocol error', error.message),
    });
    bridge.start();
    setStatus('Renderer ready', 'Waiting for portal session…');
  } else {
    setStatus('Standalone renderer ready', 'PixiJS 8.19.0 // no portal authority');
  }
}

boot().catch((error) => {
  setStatus('Renderer initialization failed', error instanceof Error ? error.message : 'Unknown startup error');
});
