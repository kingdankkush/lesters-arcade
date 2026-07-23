import assert from 'node:assert/strict';
import test from 'node:test';
import { createBridgeEnvelope, validateParentMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { createHmhParentBridge } from '../apps/portal/src/hmh-reboot-bridge.mjs';

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

function fixture({ src = 'https://arcade.test/hmh-reboot/index.html' } = {}) {
  const port1 = new FakePort();
  const port2 = new FakePort();
  const posts = [];
  const iframe = {
    src,
    contentWindow: {
      postMessage(message, targetOrigin, transfer) { posts.push({ message, targetOrigin, transfer }); },
    },
  };
  const received = [];
  const errors = [];
  const bridge = createHmhParentBridge({
    iframe,
    expectedOrigin: 'https://arcade.test',
    session: {
      sessionId: 'game-session-000000001',
      gameId: 'lester-blaster',
      mode: 'free',
      heroId: 'male-commando',
      profile: { displayName: 'Guest', locale: 'en' },
      session: { seed: 1234567890, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: false },
      settings: { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false },
    },
    channelFactory: () => ({ port1, port2 }),
    nonceFactory: () => 'nonce-1234567890abcdef',
    onMessage: (message) => received.push(message),
    onProtocolError: (error) => errors.push(error),
  });
  return { bridge, iframe, port1, port2, posts, received, errors };
}

test('parent connects with an exact target origin and transfers one port', () => {
  const { bridge, port1, port2, posts } = fixture();
  bridge.connect();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].targetOrigin, 'https://arcade.test');
  assert.deepEqual(posts[0].transfer, [port2]);
  assert.equal(posts[0].message.type, 'portal:connect');
  assert.equal(posts[0].message.nonce, 'nonce-1234567890abcdef');
  assert.equal(port1.started, true);
  assert.equal(port1.sent.length, 1);
  assert.equal(validateParentMessage(port1.sent[0]).ok, true);
  assert.equal(port1.sent[0].type, 'portal:init');
  assert.equal(port1.sent[0].payload.gameId, 'lester-blaster');
  assert.equal(port1.sent[0].payload.session.seed, 1234567890);
});

test('parent refuses iframe URLs outside the expected origin', () => {
  const { bridge, posts } = fixture({ src: 'https://evil.test/hmh-reboot/index.html' });
  assert.throws(() => bridge.connect(), /origin/i);
  assert.equal(posts.length, 0);
});

test('parent accepts valid child messages only for the bound session', () => {
  const { bridge, port1, received, errors } = fixture();
  bridge.connect();
  const ready = createBridgeEnvelope({
    type: 'game:ready',
    sessionId: 'game-session-000000001',
    messageId: 'game-1',
    payload: { runtimeVersion: '0.1.0', renderer: 'pixi.js', capabilities: ['pause', 'settings', 'restart'] },
  });
  port1.emit(ready);
  assert.equal(received.length, 1);
  port1.emit(ready);
  assert.equal(received.length, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /replay/i);
  port1.emit({ ...ready, sessionId: 'game-session-999999999', messageId: 'game-2' });
  assert.equal(received.length, 1);
  assert.equal(errors.length, 2);
  assert.match(errors[1].message, /session/i);
});

test('parent validates outbound commands and closes the capability channel', () => {
  const { bridge, port1, port2 } = fixture();
  bridge.connect();
  bridge.send('portal:pause', {});
  assert.equal(port1.sent.at(-1).type, 'portal:pause');
  assert.throws(() => bridge.send('portal:wallet-secret', { key: 'nope' }), /unsupported/i);
  bridge.destroy();
  assert.equal(port1.sent.at(-1).type, 'portal:dispose');
  assert.equal(port1.closed, true);
  assert.equal(port2.closed, true);
  assert.throws(() => bridge.send('portal:resume', {}), /closed/i);
});
