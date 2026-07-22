import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmhRebootHost } from '../apps/portal/src/hmh-reboot-host.mjs';

class FakeIframe {
  constructor() {
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.contentWindow = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(type, listener, options) { this.listeners.set(type, { listener, options }); }
  emit(type) { this.listeners.get(type)?.listener(); }
}

class FakeDocument {
  createElement(tag) {
    assert.equal(tag, 'iframe');
    return new FakeIframe();
  }
}

function fixture() {
  const mount = { children: [], replaceChildren(...children) { this.children = children; for (const child of children) child.contentWindow = {}; } };
  const bridges = [];
  const ready = [];
  const states = [];
  const errors = [];
  const bridgeFactory = (options) => {
    assert.ok(options.iframe.contentWindow, 'iframe must be attached before bridge creation');
    const bridge = {
      options,
      connects: 0,
      sent: [],
      destroyed: false,
      connect() { this.connects += 1; },
      send(type, payload) { this.sent.push({ type, payload }); },
      destroy() { this.destroyed = true; },
    };
    bridges.push(bridge);
    return bridge;
  };
  const host = createHmhRebootHost({
    mount,
    documentRef: new FakeDocument(),
    expectedOrigin: 'https://arcade.test',
    bridgeFactory,
    onReady: (message) => ready.push(message),
    onState: (message) => states.push(message),
    onError: (error) => errors.push(error),
  });
  const session = {
    sessionId: 'game-session-000000001',
    mode: 'free',
    heroId: 'male-commando',
    settings: { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false },
  };
  return { host, mount, bridges, ready, states, errors, session };
}

test('host mounts a same-origin sandboxed child frame with no navigation capability', () => {
  const { host, mount, bridges, session } = fixture();
  const iframe = host.mountSession(session);
  assert.equal(mount.children[0], iframe);
  assert.equal(iframe.src, 'https://arcade.test/hmh-reboot/index.html');
  assert.equal(iframe.title, 'Hard Money Heroes reboot runtime');
  assert.equal(iframe.referrerPolicy, 'same-origin');
  assert.equal(iframe.loading, 'eager');
  assert.equal(iframe.attributes.get('sandbox'), 'allow-scripts allow-same-origin allow-pointer-lock');
  assert.equal(iframe.attributes.get('allow'), 'fullscreen; gamepad');
  assert.equal(iframe.attributes.get('allowfullscreen'), '');
  assert.equal(iframe.attributes.get('sandbox').includes('allow-top-navigation'), false);
  assert.equal(bridges.length, 1);
  assert.equal(bridges[0].connects, 0);
  iframe.emit('load');
  assert.equal(bridges[0].connects, 1);
});

test('host routes only recognized child message types to portal callbacks', () => {
  const { host, bridges, ready, states, errors, session } = fixture();
  host.mountSession(session);
  bridges[0].options.onMessage({ type: 'game:ready' });
  bridges[0].options.onMessage({ type: 'game:state' });
  bridges[0].options.onMessage({ type: 'game:error', payload: { code: 'renderer-init-failed', message: 'Failed.' } });
  bridges[0].options.onMessage({ type: 'game:unknown' });
  assert.equal(ready.length, 1);
  assert.equal(states.length, 1);
  assert.equal(errors.length, 2);
  assert.match(errors[1].message, /unsupported/i);
});

test('host queues lifecycle commands until load, then forwards them in order', () => {
  const { host, bridges, session } = fixture();
  const iframe = host.mountSession(session);
  host.pause();
  host.resume();
  host.updateSettings({ ...session.settings, gore: true });
  host.restart();
  assert.deepEqual(bridges[0].sent, []);
  iframe.emit('load');
  assert.deepEqual(bridges[0].sent.map((entry) => entry.type), ['portal:pause', 'portal:resume', 'portal:settings', 'portal:restart']);
  host.mountSession({ ...session, sessionId: 'game-session-000000002' });
  assert.equal(bridges[0].destroyed, true);
  assert.equal(bridges.length, 2);
  host.destroy();
  assert.equal(bridges[1].destroyed, true);
});
