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

function fixture({ runtimeSearch = '', readyTimeoutMs = 5000 } = {}) {
  const mount = { children: [], replaceChildren(...children) { this.children = children; for (const child of children) child.contentWindow = {}; } };
  const bridges = [];
  const ready = [];
  const states = [];
  const errors = [];
  const exits = [];
  const runEvents = [];
  const runSummaries = [];
  const scoreResults = [];
  const achievements = [];
  const settingEvents = [];
  const timers = [];
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
    runtimeSearch,
    bridgeFactory,
    onReady: (message) => ready.push(message),
    onState: (message) => states.push(message),
    onError: (error) => errors.push(error),
    onExit: (message) => exits.push(message),
    onRunEvent: (message) => runEvents.push(message),
    onRunSummary: (message) => runSummaries.push(message),
    onScoreResult: (message) => scoreResults.push(message),
    onAchievement: (message) => achievements.push(message),
    onSettings: (message) => settingEvents.push(message),
    readyTimeoutMs: readyTimeoutMs ?? undefined,
    setTimeoutRef(callback, delay) {
      const timer = { callback, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutRef(timer) { timer.cleared = true; },
  });
  const session = {
    sessionId: 'game-session-000000001',
    gameId: 'lester-blaster',
    mode: 'free',
    heroId: 'male-commando',
    profile: { displayName: 'Guest', locale: 'en' },
    session: { seed: 1234567890, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: false },
    settings: { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false },
  };
  return { host, mount, bridges, ready, states, errors, exits, runEvents, runSummaries, scoreResults, achievements, settingEvents, timers, session };
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

test('host only forwards the explicitly gated terminal evidence query to the child', () => {
  const gated = fixture({ runtimeSearch: '?evidenceSafe=1&terminalPilot=1&walletKey=secret' });
  assert.equal(gated.host.mountSession(gated.session).src, 'https://arcade.test/hmh-reboot/index.html?evidenceSafe=1&terminalPilot=1');
  const ungated = fixture({ runtimeSearch: '?terminalPilot=1' });
  assert.equal(ungated.host.mountSession(ungated.session).src, 'https://arcade.test/hmh-reboot/index.html');
});

// New Frontier (preview): the ten-area world is a host request for one
// unranked Free session, never a portal URL, never Ranked.
test('host requests the ten-area world only for an explicitly unranked Free session', () => {
  const free = fixture();
  const frame = free.host.mountSession(free.session, { world: 'ten-area' });
  assert.equal(frame.src, 'https://arcade.test/hmh-reboot/index.html?mode=free&world=ten-area');
  assert.equal(frame.dataset.world, 'ten-area');
  const params = new URL(frame.src).searchParams;
  assert.deepEqual(params.getAll('mode'), ['free']);
  assert.deepEqual(params.getAll('world'), ['ten-area']);
  // Without the explicit request a Free session plays the legacy world.
  const plain = fixture();
  const plainFrame = plain.host.mountSession(plain.session);
  assert.equal(plainFrame.src, 'https://arcade.test/hmh-reboot/index.html');
  assert.equal(plainFrame.dataset.world, undefined);
  // The gated evidence flags and the world request compose.
  const gated = fixture({ runtimeSearch: '?evidenceSafe=1' });
  assert.equal(gated.host.mountSession(gated.session, { world: 'ten-area' }).src, 'https://arcade.test/hmh-reboot/index.html?evidenceSafe=1&mode=free&world=ten-area');
  // An unknown world request is ignored.
  const unknown = fixture();
  assert.equal(unknown.host.mountSession(unknown.session, { world: 'forked-frontier' }).src, 'https://arcade.test/hmh-reboot/index.html');
});

test('host never requests the ten-area world for a Ranked or rankedEligible session', () => {
  for (const [label, override] of [
    ['ranked', { mode: 'ranked', session: { seed: 1, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: true } }],
    ['free but rankedEligible', { session: { seed: 1, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: true } }],
    ['free with rankedEligible missing', { session: { seed: 1, buildHash: 'site-48:game-48', seasonId: 'season-1' } }],
  ]) {
    const { host, session } = fixture({ runtimeSearch: '?evidenceSafe=1' });
    const frame = host.mountSession({ ...session, ...override }, { world: 'ten-area' });
    assert.equal(frame.src, 'https://arcade.test/hmh-reboot/index.html?evidenceSafe=1', label);
    assert.equal(frame.dataset.world, undefined, label);
  }
});

test('a world or mode on the portal URL is never forwarded to the child', () => {
  for (const runtimeSearch of ['?world=ten-area', '?mode=free&world=ten-area', '?world=ten-area&mode=free&evidenceSafe=1']) {
    const ranked = fixture({ runtimeSearch });
    const rankedFrame = ranked.host.mountSession({ ...ranked.session, mode: 'ranked', session: { ...ranked.session.session, rankedEligible: true } });
    const rankedParams = new URL(rankedFrame.src).searchParams;
    assert.equal(rankedParams.get('world'), null, runtimeSearch);
    assert.equal(rankedParams.get('mode'), null, runtimeSearch);
    const free = fixture({ runtimeSearch });
    const freeParams = new URL(free.host.mountSession(free.session).src).searchParams;
    assert.equal(freeParams.get('world'), null, runtimeSearch);
    assert.equal(freeParams.get('mode'), null, runtimeSearch);
    // Even with the explicit request, the URL contributes nothing extra.
    const requested = fixture({ runtimeSearch });
    const requestedParams = new URL(requested.host.mountSession(requested.session, { world: 'ten-area' }).src).searchParams;
    assert.deepEqual(requestedParams.getAll('world'), ['ten-area'], runtimeSearch);
    assert.deepEqual(requestedParams.getAll('mode'), ['free'], runtimeSearch);
  }
});

test('host routes only recognized child message types to portal callbacks', () => {
  const { host, bridges, ready, states, errors, exits, runEvents, runSummaries, scoreResults, achievements, settingEvents, session } = fixture();
  const iframe = host.mountSession(session);
  bridges[0].options.onMessage({ type: 'game:ready' });
  bridges[0].options.onMessage({ type: 'game:state' });
  bridges[0].options.onMessage({ type: 'game:pause' });
  bridges[0].options.onMessage({ type: 'game:exit' });
  bridges[0].options.onMessage({ type: 'game:run-event' });
  bridges[0].options.onMessage({
    type: 'game:run-summary',
    payload: {
      identity: {
        seed: session.session.seed,
        buildHash: session.session.buildHash,
        mode: session.mode,
        heroId: session.heroId,
      },
    },
  });
  bridges[0].options.onMessage({ type: 'game:score-result' });
  bridges[0].options.onMessage({ type: 'game:achievement' });
  bridges[0].options.onMessage({ type: 'game:settings' });
  assert.equal(ready.length, 1);
  assert.equal(states.length, 2);
  assert.equal(exits.length, 1);
  assert.equal(runEvents.length, 1);
  assert.equal(runSummaries.length, 1);
  assert.equal(iframe.dataset.runSummaryCount, '1');
  assert.equal(scoreResults.length, 1);
  assert.equal(achievements.length, 1);
  assert.equal(settingEvents.length, 1);
  assert.equal(errors.length, 0);
});

test('host fails closed when canonical run-summary identity differs from the mounted session', () => {
  const { host, mount, bridges, errors, runSummaries, session } = fixture();
  host.mountSession(session);
  bridges[0].options.onMessage({
    type: 'game:run-summary',
    payload: {
      identity: {
        seed: session.session.seed + 1,
        buildHash: session.session.buildHash,
        mode: session.mode,
        heroId: session.heroId,
      },
    },
  });
  assert.equal(runSummaries.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /identity/i);
  assert.equal(bridges[0].destroyed, true);
  assert.deepEqual(mount.children, []);
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

test('host destroys the child and reports an error when READY times out', () => {
  const { host, mount, bridges, errors, timers, session } = fixture();
  host.mountSession(session);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 5000);
  timers[0].callback();
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /timed out/i);
  assert.equal(bridges[0].destroyed, true);
  assert.deepEqual(mount.children, []);
});

test('default READY budget covers deterministic navigation boot on slower devices', () => {
  const { host, timers, session } = fixture({ readyTimeoutMs: null });
  host.mountSession(session);
  assert.equal(timers[0].delay, 45_000);
});

test('game ready clears the startup timeout', () => {
  const { host, bridges, timers, session } = fixture();
  host.mountSession(session);
  bridges[0].options.onMessage({ type: 'game:ready' });
  assert.equal(timers[0].cleared, true);
});

test('runtime and protocol errors fail closed by destroying the active child', () => {
  for (const reportError of [
    (bridge) => bridge.options.onMessage({ type: 'game:error', payload: { code: 'renderer-init-failed', message: 'Failed.' } }),
    (bridge) => bridge.options.onProtocolError(new Error('replay rejected')),
  ]) {
    const { host, mount, bridges, errors, timers, session } = fixture();
    host.mountSession(session);
    reportError(bridges[0]);
    assert.equal(errors.length, 1);
    assert.equal(bridges[0].destroyed, true);
    assert.equal(timers[0].cleared, true);
    assert.deepEqual(mount.children, []);
  }
});
