import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createPortalRouteController } from '../apps/portal/src/routes/portal-route-controller.mjs';

function harness({ pathname = '/', connected = false } = {}) {
  const listeners = new Map();
  const pushes = [];
  const scrolls = [];
  const state = { step: 'wallet-splash', gameId: 'lester-blaster', sessionId: null };
  const characterPanel = { scrollIntoView: (options) => scrolls.push(['panel', options]) };
  const documentRef = {
    documentElement: { style: {} },
    activeElement: { blur: () => scrolls.push(['blur']) },
  };
  const windowRef = {
    location: { pathname },
    history: { pushState: (...args) => pushes.push(args) },
    scrollTo: (...args) => scrolls.push(['window', ...args]),
    requestAnimationFrame: (callback) => callback(),
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
  };
  const calls = { render: 0, leaderboard: 0, profile: 0 };
  const controller = createPortalRouteController({
    windowRef,
    documentRef,
    getConnected: () => connected,
    getStep: () => state.step,
    setStep: (step) => { state.step = step; },
    getSelectedGameId: () => state.gameId,
    setSelectedGameId: (gameId) => { state.gameId = gameId; },
    getSessionId: () => state.sessionId,
    getCharacterPanel: () => characterPanel,
    render: () => { calls.render += 1; },
    hydrateLeaderboard: () => { calls.leaderboard += 1; },
    hydrateProfile: () => { calls.profile += 1; },
    isHtmlElement: () => true,
  });
  return { controller, windowRef, documentRef, listeners, pushes, scrolls, state, calls };
}

test('route controller writes canonical play paths and owns view transition effects', () => {
  const h = harness({ pathname: '/games' });
  h.controller.setView('character-select');
  assert.equal(h.state.step, 'character-select');
  assert.deepEqual(h.pushes, [[{ step: 'character-select', gameSlug: 'hard-money-heroes', sessionId: null }, '', '/play/hard-money-heroes']]);
  assert.equal(h.calls.render, 1);
  assert.equal(h.documentRef.documentElement.style.overflowAnchor, 'none');
  assert.equal(h.documentRef.documentElement.style.scrollBehavior, 'auto');
  assert.ok(h.scrolls.some(([type]) => type === 'panel'));

  h.controller.setView('leaderboards');
  h.controller.setView('profile');
  assert.equal(h.calls.leaderboard, 1);
  assert.equal(h.calls.profile, 1);
});

test('route controller restores deep links without pushing duplicate history', () => {
  const h = harness({ pathname: '/play/chikun' });
  h.controller.applyLocation();
  assert.equal(h.state.step, 'mode-select');
  assert.equal(h.state.gameId, 'chikun');
  assert.equal(h.calls.render, 1);
  assert.deepEqual(h.pushes, []);
});

test('ranked session deep links remain wallet-gated and popstate is detachable', () => {
  const h = harness({ pathname: '/play/hard-money-heroes/game-session-000000001', connected: false });
  const detach = h.controller.attachPopstate();
  assert.equal(typeof h.listeners.get('popstate'), 'function');
  h.listeners.get('popstate')();
  assert.equal(h.state.step, 'wallet-splash');
  assert.equal(h.calls.render, 1);
  detach();
  assert.equal(h.listeners.has('popstate'), false);
});

test('portal entry delegates transition and popstate ownership to the route controller', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createPortalRouteController/);
  assert.match(main, /portalRouteController\.attachPopstate\(\)/);
  assert.match(main, /portalRouteController\.applyLocation\(\)/);
  assert.doesNotMatch(main, /function setOfficialView\(/);
  assert.doesNotMatch(main, /function applyRouteFromLocation\(/);
  assert.doesNotMatch(main, /let suppressRouteSync\s*=/);
});
