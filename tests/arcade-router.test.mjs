import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  routeForView,
  viewForPath,
  gameSlugFor,
  isInGameStep,
  isGuestAllowedStep,
  buildPlatformShellModel,
  DEFAULT_GAME_SLUG,
  gameIdForSlug,
} from '../apps/portal/src/arcade-router.mjs';

test('routeForView maps each view step to the canonical URL path', () => {
  assert.equal(routeForView('wallet-splash'), '/');
  assert.equal(routeForView('cabinet-select'), '/games');
  assert.equal(routeForView('arcade-walk-in'), '/games');
  assert.equal(routeForView('mode-select', { gameSlug: 'hard-money-heroes' }), '/games/hard-money-heroes');
  assert.equal(routeForView('character-select', { gameSlug: 'hard-money-heroes' }), '/games/hard-money-heroes');
  assert.equal(routeForView('level-one-intro', { gameSlug: 'hard-money-heroes' }), '/games/hard-money-heroes');
  assert.equal(
    routeForView('gameplay', { gameSlug: 'hard-money-heroes', sessionId: 'game-session-000000001' }),
    '/games/hard-money-heroes/game-session-000000001',
  );
  // Gameplay with no session id (free mode) falls back to the game page.
  assert.equal(routeForView('gameplay', { gameSlug: 'hard-money-heroes' }), '/games/hard-money-heroes');
  assert.equal(routeForView('mode-select', { gameSlug: 'chikun', routeBase: 'play' }), '/play/chikun');
  assert.equal(routeForView('gameplay', { gameSlug: 'chikun', routeBase: 'play' }), '/play/chikun');
  assert.equal(
    routeForView('gameplay', { gameSlug: 'chikun', sessionId: 'game-session-000000056', routeBase: 'play' }),
    '/play/chikun/game-session-000000056',
  );
  assert.equal(routeForView('profile'), '/profile');
  assert.equal(routeForView('leaderboards'), '/scores');
  assert.equal(routeForView('settings'), '/settings');
});

test('viewForPath parses URLs back into view intents (connected)', () => {
  assert.deepEqual(viewForPath('/', { connected: true }), { step: 'wallet-splash', gameSlug: null, sessionId: null });
  assert.deepEqual(viewForPath('/games', { connected: true }), { step: 'cabinet-select', gameSlug: null, sessionId: null });
  assert.deepEqual(viewForPath('/games/hard-money-heroes', { connected: true }), { step: 'mode-select', gameSlug: 'hard-money-heroes', sessionId: null });
  assert.deepEqual(viewForPath('/play/chikun', { connected: true }), { step: 'mode-select', gameSlug: 'chikun', sessionId: null });
  assert.deepEqual(
    viewForPath('/play/chikun/game-session-000000056', { connected: true }),
    { step: 'gameplay', gameSlug: 'chikun', sessionId: 'game-session-000000056' },
  );
  assert.deepEqual(
    viewForPath('/games/hard-money-heroes/game-session-000000001', { connected: true }),
    { step: 'gameplay', gameSlug: 'hard-money-heroes', sessionId: 'game-session-000000001' },
  );
  assert.deepEqual(viewForPath('/profile', { connected: true }), { step: 'profile', gameSlug: null, sessionId: null });
  assert.deepEqual(viewForPath('/scores', { connected: true }), { step: 'leaderboards', gameSlug: null, sessionId: null });
  assert.deepEqual(viewForPath('/leaderboards', { connected: true }), { step: 'leaderboards', gameSlug: null, sessionId: null });
  assert.deepEqual(viewForPath('/settings', { connected: true }), { step: 'settings', gameSlug: null, sessionId: null });
});

test('viewForPath is guest-first: arcade + free game entry reachable without a wallet', () => {
  // Guests can browse the arcade floor and enter a cabinet to reach Free mode.
  assert.equal(viewForPath('/games', { connected: false }).step, 'cabinet-select');
  assert.equal(viewForPath('/games/hard-money-heroes', { connected: false }).step, 'mode-select');
  assert.equal(viewForPath('/games/hard-money-heroes', { connected: false }).gameSlug, 'hard-money-heroes');
  assert.equal(viewForPath('/play/chikun', { connected: false }).step, 'mode-select');
  assert.equal(viewForPath('/play/chikun', { connected: false }).gameSlug, 'chikun');
});

test('viewForPath gates ranked sessions but lets guests browse profile/scores/settings', () => {
  // Ranked sessions are wallet-bound and stay gated to the homepage.
  assert.equal(viewForPath('/games/hard-money-heroes/game-session-000000001', { connected: false }).step, 'wallet-splash');
  // Guest-first: profile / leaderboards / settings resolve directly (they render
  // a "connect to save" state) so the nav never dead-ends.
  assert.equal(viewForPath('/profile', { connected: false }).step, 'profile');
  assert.equal(viewForPath('/scores', { connected: false }).step, 'leaderboards');
  assert.equal(viewForPath('/leaderboards', { connected: false }).step, 'leaderboards');
  assert.equal(viewForPath('/settings', { connected: false }).step, 'settings');
  // Connected resolves them too.
  assert.equal(viewForPath('/profile', { connected: true }).step, 'profile');
  // The homepage itself is always reachable.
  assert.equal(viewForPath('/', { connected: false }).step, 'wallet-splash');
});

test('isGuestAllowedStep marks browse/play-free steps and now also profile/scores/settings (guest-first)', () => {
  for (const step of ['wallet-splash', 'cabinet-select', 'mode-select', 'character-select', 'level-one-intro', 'gameplay']) {
    assert.equal(isGuestAllowedStep(step), true, `${step} should be guest-allowed`);
  }
  // Guest-first nav: Profile / Scores / Settings are browsable without a wallet
  // (they render a "connect to save" state) so the nav never dead-ends.
  for (const step of ['profile', 'leaderboards', 'settings']) {
    assert.equal(isGuestAllowedStep(step), true, `${step} should be guest-browsable`);
  }
  // A truly unknown step is still not guest-allowed.
  assert.equal(isGuestAllowedStep('ranked-session-secret'), false);
});

test('viewForPath ignores query/hash and trailing junk', () => {
  assert.equal(viewForPath('/games?ref=x#top', { connected: true }).step, 'cabinet-select');
  assert.equal(viewForPath('/games/hard-money-heroes/', { connected: true }).step, 'mode-select');
  // A non-session deep path falls back to the game entry.
  assert.equal(viewForPath('/games/hard-money-heroes/nonsense', { connected: true }).step, 'mode-select');
});

test('round-trip: routeForView -> viewForPath is stable for key views', () => {
  const cases = [
    ['cabinet-select', {}],
    ['mode-select', { gameSlug: 'hard-money-heroes' }],
    ['gameplay', { gameSlug: 'hard-money-heroes', sessionId: 'game-session-000000042' }],
    ['mode-select', { gameSlug: 'chikun', routeBase: 'play' }],
    ['gameplay', { gameSlug: 'chikun', sessionId: 'game-session-000000056', routeBase: 'play' }],
  ];
  for (const [step, ctx] of cases) {
    const path = routeForView(step, ctx);
    const back = viewForPath(path, { connected: true });
    assert.equal(back.step, step, `round-trip step for ${path}`);
    if (ctx.sessionId) assert.equal(back.sessionId, ctx.sessionId, `round-trip session for ${path}`);
  }
});

test('gameSlugFor resolves internal engine ids to the public slug', () => {
  assert.equal(gameSlugFor('hard-money-heroes'), 'hard-money-heroes');
  assert.equal(gameSlugFor('hmh'), 'hard-money-heroes');
  assert.equal(gameSlugFor('lester-blaster'), 'hard-money-heroes');
  assert.equal(gameSlugFor('chikun'), 'chikun');
  assert.equal(gameIdForSlug('hard-money-heroes'), 'lester-blaster');
  assert.equal(gameIdForSlug('chikun'), 'chikun');
  assert.equal(gameIdForSlug('mystery'), 'lester-blaster');
  assert.equal(gameSlugFor('unknown-game'), DEFAULT_GAME_SLUG);
});

test('platform shell model gives guest-first persistent nav, canonical scores route, breadcrumbs, and back targets', () => {
  const profileShell = buildPlatformShellModel('profile', { connected: false });
  assert.deepEqual(profileShell.nav.map((item) => item.id), ['cabinets', 'profile', 'leaderboards', 'settings']);
  assert.equal(profileShell.nav.find((item) => item.id === 'leaderboards').href, '/scores');
  assert.equal(profileShell.nav.find((item) => item.id === 'profile').active, true);
  assert.equal(profileShell.nav.every((item) => item.guestBrowsable), true);
  assert.deepEqual(profileShell.breadcrumbs.map((crumb) => crumb.label), ['Arcade', 'Profile']);
  assert.deepEqual(profileShell.backTarget, { step: 'cabinet-select', href: '/games', label: 'Back to Arcade' });

  const introShell = buildPlatformShellModel('level-one-intro', { gameSlug: 'hard-money-heroes' });
  assert.equal(introShell.nav.find((item) => item.id === 'cabinets').active, true);
  assert.deepEqual(introShell.breadcrumbs.map((crumb) => crumb.label), ['Arcade', 'Hard Money Heroes', 'Level Intro']);
  assert.equal(introShell.backTarget.step, 'character-select');
  assert.equal(introShell.backTarget.href, '/games/hard-money-heroes');
});

test('runtime platform shell nav is wired through the shared model', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const shellRoutes = readFileSync(new URL('../apps/portal/src/routes/official-shell-routes.mjs', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../apps/portal/src/arcade-core.mjs', import.meta.url), 'utf8');

  assert.equal(main.includes('createOfficialShellRoutes'), true);
  assert.equal(shellRoutes.includes('buildPlatformShellModel'), true);
  assert.equal(shellRoutes.includes('button.dataset.route = item.href'), true);
  assert.equal(shellRoutes.includes("button.setAttribute('aria-current'"), true);
  assert.equal(shellRoutes.includes('dataset.shellBreadcrumb'), true);
  assert.equal(core.includes("Object.freeze({ id: 'settings', label: 'Settings'"), true);
});

test('isInGameStep flags the in-game sub-views', () => {
  assert.equal(isInGameStep('mode-select'), true);
  assert.equal(isInGameStep('character-select'), true);
  assert.equal(isInGameStep('level-one-intro'), true);
  assert.equal(isInGameStep('cabinet-select'), false);
  assert.equal(isInGameStep('gameplay'), false);
});
