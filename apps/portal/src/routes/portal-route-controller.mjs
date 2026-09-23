import {
  gameIdForSlug,
  gameSlugFor,
  profileWalletFor,
  routeForView,
  viewForPath,
} from '../arcade-router.mjs';

function noop() {}

export function createPortalRouteController({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  getConnected = () => false,
  setStep,
  getSelectedGameId,
  setSelectedGameId,
  getSessionId = () => null,
  // The wallet a /profile/<wallet> URL names (contract A6). null means the
  // connected wallet's own profile at /profile.
  getViewedWallet = () => null,
  setViewedWallet = noop,
  getCharacterPanel = () => null,
  render,
  hydrateLeaderboard = noop,
  hydrateProfile = noop,
  isHtmlElement = (value) => typeof HTMLElement !== 'undefined' && value instanceof HTMLElement,
} = {}) {
  if (typeof setStep !== 'function') throw new TypeError('portal route controller requires setStep');
  if (typeof getSelectedGameId !== 'function') throw new TypeError('portal route controller requires getSelectedGameId');
  if (typeof setSelectedGameId !== 'function') throw new TypeError('portal route controller requires setSelectedGameId');
  if (typeof render !== 'function') throw new TypeError('portal route controller requires render');

  let suppressRouteSync = false;

  function syncRoute(step) {
    if (suppressRouteSync || !windowRef?.history?.pushState) return;
    const gameSlug = gameSlugFor(getSelectedGameId());
    const sessionId = getSessionId() ?? null;
    const wallet = step === 'profile' ? profileWalletFor(getViewedWallet()) : null;
    const path = routeForView(step, { gameSlug, sessionId, routeBase: 'play', wallet });
    if (windowRef.location?.pathname !== path) {
      windowRef.history.pushState(wallet ? { step, gameSlug, sessionId, wallet } : { step, gameSlug, sessionId }, '', path);
    }
  }

  // setView(step, { wallet }): `wallet` (an address or null) picks whose
  // profile the profile step shows. Without the option a profile view keeps
  // the wallet it already shows, so re-entering the step never drops it from
  // the URL; leaving the profile step forgets it.
  function setView(step, options = {}) {
    if (step === 'profile') {
      if (options && Object.hasOwn(options, 'wallet')) setViewedWallet(profileWalletFor(options.wallet));
    } else {
      setViewedWallet(null);
    }
    setStep(step);
    syncRoute(step);
    const rootStyle = documentRef?.documentElement?.style;
    if (rootStyle) {
      rootStyle.overflowAnchor = step === 'character-select' ? 'none' : '';
      rootStyle.scrollBehavior = step === 'character-select' ? 'auto' : '';
    }
    if (isHtmlElement(documentRef?.activeElement)) documentRef.activeElement.blur();
    render();
    windowRef?.scrollTo?.(0, 0);
    windowRef?.requestAnimationFrame?.(() => {
      if (step === 'character-select') {
        getCharacterPanel()?.scrollIntoView?.({ block: 'start', inline: 'nearest' });
      } else {
        windowRef?.scrollTo?.(0, 0);
      }
    });
    if (step === 'leaderboards') hydrateLeaderboard();
    if (step === 'profile') hydrateProfile();
  }

  function applyLocation() {
    if (!windowRef?.location) return;
    const { step, gameSlug, wallet = null } = viewForPath(windowRef.location.pathname, {
      connected: Boolean(getConnected()),
    });
    if (gameSlug) setSelectedGameId(gameIdForSlug(gameSlug));
    setViewedWallet(step === 'profile' ? wallet : null);
    suppressRouteSync = true;
    setStep(step);
    try {
      render();
    } finally {
      suppressRouteSync = false;
    }
    // Deep links and back/forward fill the Scores and Profile pages exactly
    // as a click does (A6); both hooks are no-ops in preview.
    if (step === 'leaderboards') hydrateLeaderboard();
    if (step === 'profile') hydrateProfile();
  }

  function attachPopstate() {
    if (!windowRef?.addEventListener) return noop;
    windowRef.addEventListener('popstate', applyLocation);
    return () => windowRef.removeEventListener?.('popstate', applyLocation);
  }

  return Object.freeze({
    applyLocation,
    attachPopstate,
    setView,
    syncRoute,
  });
}
