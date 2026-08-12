import assert from 'node:assert/strict';
import test from 'node:test';
import { createChikunBridgeEnvelope, validateChikunParentMessage } from '../apps/portal/src/chikun-bridge-protocol.mjs';
import { createChikunParentBridge } from '../apps/portal/src/chikun-bridge.mjs';

class FakePort {
  constructor() { this.sent = []; this.closed = false; this.started = false; this.onmessage = null; }
  postMessage(message) { this.sent.push(message); }
  start() { this.started = true; }
  close() { this.closed = true; }
  emit(data) { this.onmessage?.({ data }); }
}

function fixture({ src = 'https://arcade.test/chikun/index.html' } = {}) {
  const port1 = new FakePort();
  const port2 = new FakePort();
  const posts = [];
  const iframe = { src, contentWindow: { postMessage(message, targetOrigin, transfer) { posts.push({ message, targetOrigin, transfer }); } } };
  const received = [];
  const errors = [];
  const session = {
    sessionId: 'game-session-000000001', gameId: 'chikun', mode: 'ranked',
    profile: { displayName: 'Player One', locale: 'en-US' },
    session: { seed: 1234567890, buildHash: 'site-1:chikun-1', seasonId: 'chikun-season-1', rankedEligible: true },
    settings: { musicEnabled: true, reduceMotion: false },
  };
  const bridge = createChikunParentBridge({
    iframe, expectedOrigin: 'https://arcade.test', session,
    channelFactory: () => ({ port1, port2 }), nonceFactory: () => 'nonce-1234567890abcdef',
    onMessage: (message) => received.push(message), onProtocolError: (error) => errors.push(error),
  });
  return { bridge, port1, port2, posts, received, errors, session };
}

test('Chikun parent bridge transfers one capability port and sends a validated session-bound init', () => {
  const { bridge, port1, port2, posts } = fixture();
  bridge.connect();
  assert.equal(posts[0].targetOrigin, 'https://arcade.test');
  assert.deepEqual(posts[0].transfer, [port2]);
  assert.equal(port1.started, true);
  assert.equal(validateChikunParentMessage(port1.sent[0]).ok, true);
  assert.equal(port1.sent[0].payload.gameId, 'chikun');
  assert.equal(port1.sent[0].payload.mode, 'ranked');
});

test('Chikun parent bridge rejects wrong origins, child session drift, and replayed message IDs', () => {
  const wrong = fixture({ src: 'https://evil.test/chikun/index.html' });
  assert.throws(() => wrong.bridge.connect(), /origin/i);
  assert.equal(wrong.posts.length, 0);

  const { bridge, port1, received, errors } = fixture();
  bridge.connect();
  const ready = createChikunBridgeEnvelope({
    type: 'game:ready', sessionId: 'game-session-000000001', messageId: 'game-1',
    payload: { runtimeVersion: '0.5.0', renderer: 'canvas-2d', capabilities: ['pause', 'restart', 'score-result', 'fullscreen'] },
  });
  port1.emit(ready);
  port1.emit(ready);
  port1.emit({ ...ready, sessionId: 'game-session-999999999', messageId: 'game-2' });
  assert.equal(received.length, 1);
  assert.match(errors[0].message, /replay/i);
  assert.match(errors[1].message, /session/i);
});

test('Chikun parent bridge validates commands and closes both ports', () => {
  const { bridge, port1, port2 } = fixture();
  bridge.connect();
  bridge.send('portal:pause', {});
  assert.equal(port1.sent.at(-1).type, 'portal:pause');
  assert.throws(() => bridge.send('portal:wallet-secret', { key: 'nope' }), /unsupported/i);
  bridge.destroy();
  assert.equal(port1.sent.at(-1).type, 'portal:dispose');
  assert.equal(port1.closed, true);
  assert.equal(port2.closed, true);
});
