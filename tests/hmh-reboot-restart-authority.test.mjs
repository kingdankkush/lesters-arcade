import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const childSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const portalSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const parseModule = source => parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const childAst = parseModule(childSource);
const portalAst = parseModule(portalSource);

function findNode(root, predicate) {
  if (!root || typeof root !== 'object') return null;
  if (predicate(root)) return root;
  for (const value of Object.values(root)) {
    if (!value || typeof value !== 'object') continue;
    const found = findNode(value, predicate);
    if (found) return found;
  }
  return null;
}

function runtimeCallback(source, ast, factory, property, context) {
  const call = findNode(ast, node => node.type === 'CallExpression' && node.callee.name === factory);
  const callback = call?.arguments[0]?.properties.find(node => node.key.name === property)?.value;
  assert.ok(callback, `${factory}.${property} must remain a runtime callback`);
  return vm.runInNewContext(`(${source.slice(callback.start, callback.end)})`, context);
}

function parentFixture() {
  const events = [];
  const context = {
    hmhRebootActive: true,
    currentSession: { sessionId: 'old-parent-session', isPaid: false },
    officialSelectedMode: 'free', combat: {}, gameAdapter: { teardown: () => events.push('teardown') },
    playSfxCue: () => {}, startArcadeMusicForGame: () => Promise.resolve(true),
    beginTrackedSession: ({ mode }) => {
      events.push(['new-session', mode]);
      return { sessionId: 'fresh-parent-session', isPaid: false };
    },
    createInProcessGameAdapter: ({ sessionId }) => ({ start: () => events.push(['adapter', sessionId]) }),
    hmhRebootHeroId: () => 'lit-commando',
    mountHmhRebootSession: () => events.push(['mount', context.currentSession.sessionId]),
    renderOfficialRunStatus: () => {}, syncCombatOverlay: () => {},
    returnToOfficialGameMenu: () => events.push('menu'),
  };
  const restart = portalAst.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'restartCombatRun');
  assert.ok(restart, 'the parent restart flow must exist');
  context.restartCombatRun = vm.runInNewContext(`(${portalSource.slice(restart.start, restart.end)})`, context);
  const onExit = runtimeCallback(portalSource, portalAst, 'createHmhRebootHost', 'onExit', context);
  return { context, events, onExit };
}

function childRestart({ bridge = null, embedded = false, sessionPayload = { sessionId: 'old-parent-session' } } = {}) {
  const events = [];
  const windowRef = {};
  windowRef.parent = embedded ? {} : windowRef;
  const onRestart = runtimeCallback(childSource, childAst, 'createCockpitUi', 'onRestart', {
    bridge, sessionPayload, window: windowRef,
    initializeSession: payload => events.push(['initialize', payload]),
    marker: { scale: { set: scale => events.push(['scale', scale]) } },
    statePayload: state => ({ state }),
  });
  return { events, onRestart };
}

test('embedded cockpit restart asks the parent to replace the session instead of reusing its identity', () => {
  const messages = [];
  const child = childRestart({ embedded: true, bridge: { initialized: true, send: (type, payload) => messages.push({ type, payload: { ...payload } }) } });
  child.onRestart();
  assert.deepEqual(messages, [{ type: 'game:exit', payload: { reason: 'restart' } }]);
  assert.deepEqual(child.events, [], 'the old child must not initialize another run under the old parent identity');
});

test('parent handles a child restart request by mounting a fresh parent-owned session', async () => {
  const parent = parentFixture();
  await parent.onExit({ type: 'game:exit', payload: { reason: 'restart' } });
  assert.equal(parent.context.currentSession.sessionId, 'fresh-parent-session');
  assert.deepEqual(parent.events, [['new-session', 'free'], 'teardown', ['adapter', 'fresh-parent-session'], ['mount', 'fresh-parent-session']]);
});

test('ordinary child exit still returns to the menu without creating a run', async () => {
  const parent = parentFixture();
  await parent.onExit({ type: 'game:exit', payload: { reason: 'menu' } });
  assert.deepEqual(parent.events, ['menu']);
  assert.equal(parent.context.currentSession.sessionId, 'old-parent-session');
});

test('standalone cockpit restart remains playable without a parent bridge', () => {
  const payload = { sessionId: 'standalone-local' };
  const child = childRestart({ sessionPayload: payload });
  child.onRestart();
  assert.deepEqual(child.events, [['initialize', payload], ['scale', 1]]);
});

test('restart cannot initialize a run before a session payload exists', () => {
  const child = childRestart({ sessionPayload: null });
  child.onRestart();
  assert.deepEqual(child.events, []);
});
