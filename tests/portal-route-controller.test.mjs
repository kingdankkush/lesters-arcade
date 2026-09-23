import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createPortalRouteController } from '../apps/portal/src/routes/portal-route-controller.mjs';

function harness({ pathname = '/', connected = false } = {}) {
  const listeners = new Map();
  const pushes = [];
  const scrolls = [];
  const state = { step: 'wallet-splash', gameId: 'lester-blaster', sessionId: null, viewedWallet: null };
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
    getViewedWallet: () => state.viewedWallet,
    setViewedWallet: (wallet) => { state.viewedWallet = wallet; },
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

const PROFILE_WALLET = `0x${'Ab'.repeat(20)}`;
const profileWallet = PROFILE_WALLET.toLowerCase();

test('deep link to a wallet profile hydrates on load', () => {
  const h = harness({ pathname: `/profile/${PROFILE_WALLET}` });
  h.controller.applyLocation();
  assert.equal(h.state.step, 'profile');
  assert.equal(h.state.viewedWallet, profileWallet, 'the viewed wallet is kept, lowercase');
  assert.equal(h.calls.profile, 1, 'the profile hydrate hook runs on a deep link');
  assert.equal(h.calls.leaderboard, 0);
  assert.deepEqual(h.pushes, [], 'restoring a URL never pushes history');

  const scores = harness({ pathname: '/scores' });
  scores.controller.applyLocation();
  assert.equal(scores.state.step, 'leaderboards');
  assert.equal(scores.calls.leaderboard, 1, 'the Scores hydrate hook runs on a deep link');

  const own = harness({ pathname: '/profile' });
  own.state.viewedWallet = profileWallet;
  own.controller.applyLocation();
  assert.equal(own.state.viewedWallet, null, '/profile is the connected wallet');
  assert.equal(own.calls.profile, 1);

  const bogus = harness({ pathname: '/profile/0x1234' });
  bogus.controller.applyLocation();
  assert.equal(bogus.state.step, 'profile');
  assert.equal(bogus.state.viewedWallet, null, 'an invalid address is not a viewed wallet');

  const popped = harness({ pathname: '/games' });
  popped.controller.attachPopstate();
  popped.windowRef.location.pathname = `/profile/${profileWallet}`;
  popped.listeners.get('popstate')();
  assert.equal(popped.state.viewedWallet, profileWallet);
  assert.equal(popped.calls.profile, 1, 'back/forward to a profile hydrates too');
});

test('setView preserves the viewed wallet', () => {
  const h = harness({ pathname: '/scores' });
  h.controller.setView('profile', { wallet: PROFILE_WALLET });
  assert.equal(h.state.viewedWallet, profileWallet);
  assert.deepEqual(h.pushes.at(-1), [{ step: 'profile', gameSlug: 'hard-money-heroes', sessionId: null, wallet: profileWallet }, '', `/profile/${profileWallet}`]);
  assert.equal(h.calls.profile, 1);

  // Re-entering the profile step without a wallet keeps the one in the URL.
  h.windowRef.location.pathname = `/profile/${profileWallet}`;
  h.controller.setView('profile');
  assert.equal(h.state.viewedWallet, profileWallet);
  assert.equal(h.pushes.length, 1, 'the URL already names the wallet, so no duplicate push');
  h.controller.syncRoute('profile');
  assert.equal(h.pushes.length, 1);

  // An explicit null goes to the connected wallet's own profile.
  h.controller.setView('profile', { wallet: null });
  assert.equal(h.state.viewedWallet, null);
  assert.equal(h.pushes.at(-1)[2], '/profile');

  // Leaving the profile step forgets the wallet.
  h.controller.setView('profile', { wallet: profileWallet });
  h.controller.setView('leaderboards');
  assert.equal(h.state.viewedWallet, null);
  assert.equal(h.pushes.at(-1)[2], '/scores');
  assert.deepEqual(Object.keys(h.pushes.at(-1)[0]), ['step', 'gameSlug', 'sessionId'], 'other routes keep the 3-key history state');
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
