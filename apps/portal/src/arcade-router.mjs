// Pure URL routing helpers for the Lester's Arcade SPA.
//
// The app is a single-page state machine (officialAppStep). This module maps
// those view steps to/from real URL paths so users get deep-linkable,
// back/forward-able navigation:
//
//   /                                                  -> logged-out homepage (wallet splash)
//   /games                                             -> Choose Your Cabinet
//   /games/hard-money-heroes                           -> HMH game app (mode/character/intro)
//   /games/hard-money-heroes/game-session-000000001    -> an active ranked session
//
// Future games reuse the same shape: /games/<gameSlug>/game-session-<id>.
// These helpers are pure (no DOM/history) so they can be unit-tested; main.js
// wires them to history.pushState + popstate.

// Public game slug used in URLs (stable, human-friendly). The internal engine
// id can differ (e.g. 'lester-blaster'); the slug is what users see + search.
export const ARCADE_GAME_SLUGS = Object.freeze({
  'hard-money-heroes': 'hard-money-heroes',
  hmh: 'hard-money-heroes',
  'lester-blaster': 'hard-money-heroes',
  'mweb-invaders': 'mweb-invaders',
  'litvm-legends': 'litvm-legends',
});

export const DEFAULT_GAME_SLUG = 'hard-money-heroes';

// View steps that live "inside" a selected game (mode/character/intro screens).
const IN_GAME_STEPS = Object.freeze(['mode-select', 'character-select', 'level-one-intro']);

export function gameSlugFor(gameId) {
  return ARCADE_GAME_SLUGS[gameId] ?? DEFAULT_GAME_SLUG;
}

// Build the canonical URL path for a given view + context.
export function routeForView(step, { gameSlug = DEFAULT_GAME_SLUG, sessionId = null } = {}) {
  switch (step) {
    case 'wallet-splash':
      return '/';
    case 'arcade-walk-in':
    case 'cabinet-select':
      return '/games';
    case 'mode-select':
    case 'character-select':
    case 'level-one-intro':
      return `/games/${gameSlug}`;
    case 'gameplay':
      // Ranked sessions get a session URL; free / no-session falls back to the game page.
      return sessionId ? `/games/${gameSlug}/${sessionId}` : `/games/${gameSlug}`;
    case 'profile':
      return '/profile';
    case 'leaderboards':
      return '/leaderboards';
    case 'settings':
      return '/settings';
    default:
      return '/';
  }
}

// Parse a URL path into a view intent. Returns { step, gameSlug, sessionId }.
// `connected` controls the gate: protected routes bounce to wallet-splash when
// no wallet is connected (mirrors the app's existing guard).
export function viewForPath(pathname, { connected = false } = {}) {
  const clean = String(pathname || '/').split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean); // e.g. ['games','hard-money-heroes','game-session-1']

  // Top-level simple routes.
  if (parts.length === 0) {
    return { step: 'wallet-splash', gameSlug: null, sessionId: null };
  }
  if (parts[0] === 'profile') return gate('profile', connected);
  if (parts[0] === 'leaderboards') return gate('leaderboards', connected);
  if (parts[0] === 'settings') return gate('settings', connected);

  if (parts[0] === 'games') {
    // /games -> cabinet select
    if (parts.length === 1) return gate('cabinet-select', connected);
    const gameSlug = parts[1];
    // /games/<slug> -> game app entry (mode select)
    if (parts.length === 2) return gate('mode-select', connected, gameSlug);
    // /games/<slug>/game-session-<id> -> active session (gameplay)
    if (parts.length >= 3 && /^game-session-\d+$/.test(parts[2])) {
      return gate('gameplay', connected, gameSlug, parts[2]);
    }
    // Unknown deeper path -> game app entry.
    return gate('mode-select', connected, gameSlug);
  }

  // Unknown -> homepage.
  return { step: 'wallet-splash', gameSlug: null, sessionId: null };
}

function gate(step, connected, gameSlug = null, sessionId = null) {
  if (!connected) {
    return { step: 'wallet-splash', gameSlug: null, sessionId: null };
  }
  return { step, gameSlug, sessionId };
}

export function isInGameStep(step) {
  return IN_GAME_STEPS.includes(step);
}
