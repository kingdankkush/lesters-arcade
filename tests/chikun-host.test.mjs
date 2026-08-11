import assert from 'node:assert/strict';
import test from 'node:test';
import { createChikunHost } from '../apps/portal/src/chikun-host.mjs';

class FakeIframe {
  constructor() { this.attributes = new Map(); this.listeners = new Map(); this.dataset = {}; this.contentWindow = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(type, listener, options) { this.listeners.set(type, { listener, options }); }
  emit(type) { this.listeners.get(type)?.listener(); }
  focus() {}
}
class FakeDocument {
  constructor() { this.documentElement = { dataset: {} }; }
  createElement(tag) { assert.equal(tag, 'iframe'); return new FakeIframe(); }
}

function fixture() {
  const documentRef = new FakeDocument();
  const mount = { children: [], replaceChildren(...children) { this.children = children; for (const child of children) child.contentWindow = { focus() {} }; } };
  const bridges = [];
  const ready = []; const states = []; const results = []; const restarts = []; const errors = [];
  const timers = [];
  const host = createChikunHost({
    mount, documentRef, expectedOrigin: 'https://arcade.test',
    bridgeFactory(options) {
      const bridge = { options, connects: 0, sent: [], destroyed: false, connect() { this.connects += 1; }, send(type, payload) { this.sent.push({ type, payload }); }, destroy() { this.destroyed = true; } };
      bridges.push(bridge); return bridge;
    },
    onReady: (message) => ready.push(message), onState: (message) => states.push(message),
    onResult: (message) => results.push(message), onRestartRequest: (message) => restarts.push(message), onError: (error) => errors.push(error),
    readyTimeoutMs: 5000,
    setTimeoutRef(callback, delay) { const timer = { callback, delay, cleared: false }; timers.push(timer); return timer; },
    clearTimeoutRef(timer) { timer.cleared = true; },
  });
  const session = {
    sessionId: 'game-session-000000001', gameId: 'chikun', mode: 'free',
    profile: { displayName: 'Guest', locale: 'en-US' },
    session: { seed: 1234, buildHash: 'site-1:chikun-1', seasonId: 'chikun-season-1', rankedEligible: false },
    settings: { musicEnabled: true, reduceMotion: false },
  };
  return { host, mount, documentRef, bridges, ready, states, results, restarts, errors, timers, session };
}

test('Chikun host mounts an input-owning same-origin sandbox with no navigation capability', () => {
  const { host, mount, documentRef, bridges, session } = fixture();
  const iframe = host.mountSession(session);
  assert.equal(mount.children[0], iframe);
  assert.equal(iframe.src, 'https://arcade.test/chikun/index.html');
  assert.equal(iframe.title, "Chikun's Escape runtime");
  assert.equal(iframe.attributes.get('sandbox'), 'allow-scripts allow-same-origin');
  assert.equal(iframe.attributes.get('allow'), 'fullscreen');
  assert.equal(iframe.attributes.get('sandbox').includes('allow-top-navigation'), false);
  assert.equal(documentRef.documentElement.dataset.embeddedCabinet, 'chikun');
  iframe.emit('load');
  assert.equal(bridges[0].connects, 1);
});

test('Chikun host routes result/restart messages and fails closed on unknown child messages', () => {
  const { host, mount, bridges, results, restarts, errors, session } = fixture();
  host.mountSession(session);
  bridges[0].options.onMessage({ type: 'game:result', payload: { score: 1 } });
  bridges[0].options.onMessage({ type: 'game:restart-request', payload: {} });
  assert.equal(results.length, 1);
  assert.equal(restarts.length, 1);
  bridges[0].options.onMessage({ type: 'game:wallet-export', payload: {} });
  assert.equal(errors.length, 1);
  assert.equal(bridges[0].destroyed, true);
  assert.deepEqual(mount.children, []);
});

test('Chikun host queues pause/resume until load and destroys on ready timeout', () => {
  const first = fixture();
  const iframe = first.host.mountSession(first.session);
  first.host.pause(); first.host.resume(); first.host.restart();
  assert.deepEqual(first.bridges[0].sent, []);
  iframe.emit('load');
  assert.deepEqual(first.bridges[0].sent.map((entry) => entry.type), ['portal:pause', 'portal:resume', 'portal:restart']);

  const timed = fixture();
  timed.host.mountSession(timed.session);
  timed.timers[0].callback();
  assert.match(timed.errors[0].message, /timed out/i);
  assert.equal(timed.bridges[0].destroyed, true);
  assert.deepEqual(timed.mount.children, []);
  assert.equal(timed.documentRef.documentElement.dataset.embeddedCabinet, undefined);
});
