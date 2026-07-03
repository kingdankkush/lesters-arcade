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
//   /profile                                           -> guest-browsable profile shell
//   /scores                                            -> guest-browsable scores shell
//   /settings                                          -> guest-browsable settings shell
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
  chikun: 'chikun',
  'mweb-invaders': 'mweb-invaders',
  'litvm-legends': 'litvm-legends',
});

export const ARCADE_GAME_IDS_BY_SLUG = Object.freeze({
  'hard-money-heroes': 'lester-blaster',
  chikun: 'chikun',
  'mweb-invaders': 'mweb-invaders',
  'litvm-legends': 'litvm-legends',
});

export const DEFAULT_GAME_SLUG = 'hard-money-heroes';

export const PLATFORM_SHELL_NAV = Object.freeze([
  Object.freeze({ id: 'cabinets', step: 'cabinet-select', label: 'Play' }),
  Object.freeze({ id: 'profile', step: 'profile', label: 'Profile' }),
  Object.freeze({ id: 'leaderboards', step: 'leaderboards', label: 'Scores' }),
  Object.freeze({ id: 'settings', step: 'settings', label: 'Settings' }),
]);

const GAME_TITLE_BY_SLUG = Object.freeze({
  'hard-money-heroes': 'Hard Money Heroes',
  chikun: 'Chikun',
  'mweb-invaders': 'MWEB Invaders',
  'litvm-legends': 'LitVM Legends',
});

// View steps that live "inside" a selected game (mode/character/intro screens).
const IN_GAME_STEPS = Object.freeze(['mode-select', 'character-select', 'level-one-intro']);

// Guest-first: steps a player can reach WITHOUT a connected wallet. Guests can
// browse the arcade floor, enter a cabinet, and play Free mode. Wallet-bound
// routes (profile, leaderboards, settings) and ranked sessions still require a
// connected wallet — those are gated. A ranked session URL carries a
// game-session id; free play has none, so a sessionless gameplay step is
// guest-allowed while a session-carrying one is gated.
const GUEST_ALLOWED_STEPS = Object.freeze([
  'wallet-splash',
  'arcade-walk-in',
  'cabinet-select',
  'mode-select',
  'character-select',
  'level-one-intro',
  'gameplay',
  // Guest-first: Profile / Scores / Settings are browsable without a wallet
  // (they render a "connect to save" state) so the nav never dead-ends.
  'profile',
  'leaderboards',
  'settings',
]);

export function isGuestAllowedStep(step) {
  return GUEST_ALLOWED_STEPS.includes(step);
}

export function gameSlugFor(gameId) {
  return ARCADE_GAME_SLUGS[gameId] ?? DEFAULT_GAME_SLUG;
}

export function gameIdForSlug(gameSlug) {
  return ARCADE_GAME_IDS_BY_SLUG[gameSlug] ?? ARCADE_GAME_IDS_BY_SLUG[DEFAULT_GAME_SLUG];
}

function gameRoutePrefix(routeBase = 'games') {
  return routeBase === 'play' ? '/play' : '/games';
}

// Build the canonical URL path for a given view + context.
export function routeForView(step, { gameSlug = DEFAULT_GAME_SLUG, sessionId = null, routeBase = 'games' } = {}) {
  const gamePrefix = gameRoutePrefix(routeBase);
  switch (step) {
    case 'wallet-splash':
      return '/';
    case 'arcade-walk-in':
    case 'cabinet-select':
      return '/games';
    case 'mode-select':
    case 'character-select':
    case 'level-one-intro':
      return `${gamePrefix}/${gameSlug}`;
    case 'gameplay':
      // Ranked sessions get a session URL; free / no-session falls back to the game page.
      return sessionId ? `${gamePrefix}/${gameSlug}/${sessionId}` : `${gamePrefix}/${gameSlug}`;
    case 'profile':
      return '/profile';
    case 'leaderboards':
      return '/scores';
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
  if (parts[0] === 'profile') return guestGate('profile', connected);
  if (parts[0] === 'scores' || parts[0] === 'leaderboards') return guestGate('leaderboards', connected);
  if (parts[0] === 'settings') return guestGate('settings', connected);

  if (parts[0] === 'games' || parts[0] === 'play') {
    // /games -> cabinet select (guest-allowed: browse before connecting)
    if (parts[0] === 'games' && parts.length === 1) return guestGate('cabinet-select', connected);
    if (parts[0] === 'play' && parts.length === 1) return guestGate('cabinet-select', connected);
    const gameSlug = parts[1];
    // /games/<slug> -> game app entry (mode select). Guest-allowed so guests
    // can reach Free mode; ranked is gated at mode-select in the UI.
    if (parts.length === 2) return guestGate('mode-select', connected, gameSlug);
    // /games/<slug>/game-session-<id> -> active ranked session (gameplay).
    // Ranked sessions are wallet-bound, so this stays wallet-gated.
    if (parts.length >= 3 && /^game-session-\d+$/.test(parts[2])) {
      return gate('gameplay', connected, gameSlug, parts[2]);
    }
    // Unknown deeper path -> game app entry (guest-allowed).
    return guestGate('mode-select', connected, gameSlug);
  }

  // Unknown -> homepage.
  return { step: 'wallet-splash', gameSlug: null, sessionId: null };
}

// Wallet-required gate: bounce to the homepage when not connected.
function gate(step, connected, gameSlug = null, sessionId = null) {
  if (!connected) {
    return { step: 'wallet-splash', gameSlug: null, sessionId: null };
  }
  return { step, gameSlug, sessionId };
}

// Guest-first gate: guest-allowed steps resolve for everyone; anything else
// falls back to the wallet-required gate.
function guestGate(step, connected, gameSlug = null, sessionId = null) {
  if (connected || isGuestAllowedStep(step)) {
    return { step, gameSlug, sessionId };
  }
  return gate(step, connected, gameSlug, sessionId);
}

export function buildPlatformShellModel(step, { connected = false, gameSlug = DEFAULT_GAME_SLUG, sessionId = null } = {}) {
  const normalizedStep = step || 'wallet-splash';
  const activeNavId = ['mode-select', 'character-select', 'level-one-intro', 'gameplay', 'arcade-walk-in', 'cabinet-select'].includes(normalizedStep)
    ? 'cabinets'
    : normalizedStep === 'leaderboards' ? 'leaderboards' : normalizedStep;
  const nav = PLATFORM_SHELL_NAV.map((item) => Object.freeze({
    ...item,
    href: routeForView(item.step, { gameSlug }),
    active: item.id === activeNavId,
    guestBrowsable: isGuestAllowedStep(item.step),
    requiresWallet: !isGuestAllowedStep(item.step),
    connected: Boolean(connected),
  }));
  const gameTitle = GAME_TITLE_BY_SLUG[gameSlug] ?? GAME_TITLE_BY_SLUG[DEFAULT_GAME_SLUG];
  const arcadeCrumb = Object.freeze({ label: 'Arcade', href: '/games', step: 'cabinet-select' });
  const breadcrumbs = [arcadeCrumb];
  if (['mode-select', 'character-select', 'level-one-intro', 'gameplay'].includes(normalizedStep)) {
    breadcrumbs.push(Object.freeze({ label: gameTitle, href: routeForView('mode-select', { gameSlug }), step: 'mode-select' }));
  }
  if (normalizedStep === 'character-select') breadcrumbs.push(Object.freeze({ label: 'Hero Select', href: routeForView('character-select', { gameSlug }), step: 'character-select' }));
  if (normalizedStep === 'level-one-intro') breadcrumbs.push(Object.freeze({ label: 'Level Intro', href: routeForView('level-one-intro', { gameSlug }), step: 'level-one-intro' }));
  if (normalizedStep === 'gameplay') breadcrumbs.push(Object.freeze({ label: 'Run', href: routeForView('gameplay', { gameSlug, sessionId }), step: 'gameplay' }));
  if (normalizedStep === 'profile') breadcrumbs.push(Object.freeze({ label: 'Profile', href: '/profile', step: 'profile' }));
  if (normalizedStep === 'leaderboards') breadcrumbs.push(Object.freeze({ label: 'Scores', href: '/scores', step: 'leaderboards' }));
  if (normalizedStep === 'settings') breadcrumbs.push(Object.freeze({ label: 'Settings', href: '/settings', step: 'settings' }));

  const backMap = Object.freeze({
    profile: Object.freeze({ step: 'cabinet-select', href: '/games', label: 'Back to Arcade' }),
    leaderboards: Object.freeze({ step: 'cabinet-select', href: '/games', label: 'Back to Arcade' }),
    settings: Object.freeze({ step: 'cabinet-select', href: '/games', label: 'Back to Arcade' }),
    'mode-select': Object.freeze({ step: 'cabinet-select', href: '/games', label: 'Back to Cabinets' }),
    'character-select': Object.freeze({ step: 'mode-select', href: routeForView('mode-select', { gameSlug }), label: 'Back to Mode Select' }),
    'level-one-intro': Object.freeze({ step: 'character-select', href: routeForView('character-select', { gameSlug }), label: 'Back to Hero Select' }),
    gameplay: Object.freeze({ step: 'mode-select', href: routeForView('mode-select', { gameSlug }), label: 'Back to Game Menu' }),
  });

  return Object.freeze({
    step: normalizedStep,
    nav: Object.freeze(nav),
    breadcrumbs: Object.freeze(breadcrumbs),
    backTarget: backMap[normalizedStep] ?? null,
  });
}

export function isInGameStep(step) {
  return IN_GAME_STEPS.includes(step);
}
