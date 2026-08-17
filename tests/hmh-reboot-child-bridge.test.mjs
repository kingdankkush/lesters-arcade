import assert from 'node:assert/strict';
import test from 'node:test';
import { HMH_BRIDGE_PROTOCOL, createBridgeEnvelope, validateChildMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { createHmhChildBridge } from '../apps/hmh-reboot/src/bridge.mjs';

class FakePort {
  constructor() {
    this.sent = [];
    this.closed = false;
    this.started = false;
    this.onmessage = null;
  }
  postMessage(message) { this.sent.push(message); }
  start() { this.started = true; }
  close() { this.closed = true; }
  emit(data) { this.onmessage?.({ data }); }
}

class FakeWindow {
  constructor() {
    this.parent = { name: 'portal-window' };
    this.listeners = new Map();
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
  emitMessage(event) { this.listeners.get('message')?.(event); }
}

const settings = { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false };
const init = createBridgeEnvelope({
  type: 'portal:init',
  sessionId: 'game-session-000000001',
  messageId: 'portal-1',
  payload: {
    gameId: 'lester-blaster',
    mode: 'free',
    heroId: 'male-commando',
    profile: { displayName: 'Guest', locale: 'en' },
    session: { seed: 1234567890, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: false },
    settings,
  },
});
const connect = { protocol: HMH_BRIDGE_PROTOCOL, type: 'portal:connect', nonce: 'nonce-1234567890abcdef' };

function fixture({ deferInitialization = false } = {}) {
  const windowRef = new FakeWindow();
  const port = new FakePort();
  const initializations = [];
  const received = [];
  const errors = [];
  const bridge = createHmhChildBridge({
    windowRef,
    expectedParentOrigin: 'https://arcade.test',
    runtimeInfo: { runtimeVersion: '0.1.0', renderer: 'pixi.js', capabilities: ['pause', 'settings', 'restart', 'resize'] },
    deferInitialization,
    onInit: (payload) => initializations.push(payload),
    onMessage: (message) => received.push(message),
    onProtocolError: (error) => errors.push(error),
  });
  bridge.start();
  return { windowRef, port, bridge, initializations, received, errors };
}

function handshake(windowRef, port, overrides = {}) {
  windowRef.emitMessage({
    origin: 'https://arcade.test',
    source: windowRef.parent,
    data: connect,
    ports: [port],
    ...overrides,
  });
}

test('child ignores handshakes from the wrong origin or wrong window source', () => {
  const { windowRef, port, bridge } = fixture();
  handshake(windowRef, port, { origin: 'https://evil.test' });
  assert.equal(bridge.connected, false);
  handshake(windowRef, port, { source: { name: 'lookalike' } });
  assert.equal(bridge.connected, false);
  assert.equal(port.started, false);
});

test('child binds transferred port and sends ready only after validated init', () => {
  const { windowRef, port, bridge, initializations } = fixture();
  handshake(windowRef, port);
  assert.equal(bridge.connected, true);
  assert.equal(port.started, true);
  assert.equal(port.sent.length, 0);
  port.emit(init);
  assert.equal(bridge.initialized, true);
  assert.equal(initializations.length, 1);
  assert.equal(initializations[0].heroId, 'male-commando');
  assert.equal(initializations[0].session.seed, 1234567890);
  assert.equal(port.sent.length, 1);
  assert.equal(validateChildMessage(port.sent[0]).ok, true);
  assert.equal(port.sent[0].type, 'game:ready');
  assert.equal(port.sent[0].sessionId, init.sessionId);
});

test('child can capture an early portal init without advertising READY before runtime activation', () => {
  const { windowRef, port, bridge, initializations, received, errors } = fixture({ deferInitialization: true });
  handshake(windowRef, port);
  port.emit(init);
  const pause = createBridgeEnvelope({ type: 'portal:pause', sessionId: init.sessionId, messageId: 'portal-2', payload: {} });
  port.emit(pause);
  assert.equal(bridge.connected, true);
  assert.equal(bridge.initialized, false);
  assert.equal(initializations.length, 0);
  assert.equal(received.length, 0);
  assert.equal(errors.length, 0);
  assert.equal(port.sent.length, 0);

  bridge.activate();
  assert.equal(bridge.initialized, true);
  assert.equal(initializations.length, 1);
  assert.equal(initializations[0].heroId, 'male-commando');
  assert.equal(received.length, 1);
  assert.equal(received[0].type, 'portal:pause');
  assert.equal(port.sent.length, 1);
  assert.equal(port.sent[0].type, 'game:ready');
});

test('deferred parent dispose still closes the child bridge during activation', () => {
  const { windowRef, port, bridge, received, errors } = fixture({ deferInitialization: true });
  handshake(windowRef, port);
  port.emit(init);
  port.emit(createBridgeEnvelope({ type: 'portal:dispose', sessionId: init.sessionId, messageId: 'portal-2', payload: {} }));
  bridge.activate();
  assert.deepEqual(received.map((message) => message.type), ['portal:dispose']);
  assert.equal(port.closed, true);
  assert.equal(bridge.connected, false);
  assert.equal(errors.length, 0);
});

test('child rejects mismatched sessions and replayed parent message ids', () => {
  const { windowRef, port, received, errors } = fixture();
  handshake(windowRef, port);
  port.emit(init);
  const pause = createBridgeEnvelope({ type: 'portal:pause', sessionId: init.sessionId, messageId: 'portal-2', payload: {} });
  port.emit(pause);
  port.emit(pause);
  port.emit({ ...pause, messageId: 'portal-3', sessionId: 'game-session-999999999' });
  assert.equal(received.length, 1);
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /replay/i);
  assert.match(errors[1].message, /session/i);
});

test('child validates outbound telemetry and removes listeners on stop', () => {
  const { windowRef, port, bridge } = fixture();
  handshake(windowRef, port);
  port.emit(init);
  bridge.send('game:state', { status: 'running', score: 0, kills: 0, elapsedMs: 0, health: 100, maxHealth: 100, xp: 0, level: 1, paused: false });
  assert.equal(port.sent.at(-1).type, 'game:state');
  assert.throws(() => bridge.send('game:wallet', { secret: true }), /unsupported/i);
  bridge.stop();
  assert.equal(port.closed, true);
  assert.equal(windowRef.listeners.has('message'), false);
  assert.throws(() => bridge.send('game:state', {}), /closed/i);
});
