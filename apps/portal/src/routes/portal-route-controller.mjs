import {
  gameIdForSlug,
  gameSlugFor,
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
    const path = routeForView(step, { gameSlug, sessionId, routeBase: 'play' });
    if (windowRef.location?.pathname !== path) {
      windowRef.history.pushState({ step, gameSlug, sessionId }, '', path);
    }
  }

  function setView(step) {
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
    const { step, gameSlug } = viewForPath(windowRef.location.pathname, {
      connected: Boolean(getConnected()),
    });
    if (gameSlug) setSelectedGameId(gameIdForSlug(gameSlug));
    suppressRouteSync = true;
    setStep(step);
    try {
      render();
    } finally {
      suppressRouteSync = false;
    }
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
