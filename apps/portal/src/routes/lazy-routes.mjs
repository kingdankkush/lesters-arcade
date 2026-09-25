// The Scores and Profile routes, downloaded on the first visit.
//
// Neither page is the portal's usual first paint, so main.js no longer imports
// routes/official-profile-route.mjs or routes/official-leaderboard-route.mjs
// statically (contract §11 rule 5). The objects built here stand in for those
// routes with the same methods: the first render or hydrate downloads the route
// module through the `load` it is given (main.js passes a dynamic import()),
// and from then on every call goes straight to the route, which renders the
// same DOM it always has. Until the module arrives the page shows the loading
// card the route itself shows while its hosted view downloads.
//
// In hosted mode the hosted view downloads beside the route and the page waits
// for both, so the two chunks never queue and a failure of either lands here.
// A failed download shows Try again instead of a blank page. Try again imports
// again, and reloads the page when that fails too while the page is still on
// screen: browsers keep a failed module fetch in their module map, so only a
// reload fetches it afresh (and a tab left open across a deploy needs the new
// main.js anyway). A player who left meanwhile (to start a run) is never
// reloaded; the next visit shows Try again.

export const LAZY_ROUTE_COPY = Object.freeze({
  profile: Object.freeze({
    hosted: Object.freeze({
      loading: 'Loading verified profile…',
      failedTitle: 'This profile is unavailable right now.',
      failedDetail: 'The verified profile could not load. Try again in a moment.',
    }),
    preview: Object.freeze({
      loading: 'Loading profile…',
      failedTitle: 'This profile is unavailable right now.',
      failedDetail: 'The profile could not load. Try again in a moment.',
    }),
  }),
  scores: Object.freeze({
    hosted: Object.freeze({
      loading: 'Loading verified scores…',
      failedTitle: 'Scores are unavailable right now',
      failedDetail: 'The verified board could not load. Try again in a moment.',
    }),
    preview: Object.freeze({
      loading: 'Loading scores…',
      failedTitle: 'Scores are unavailable right now',
      failedDetail: 'The board could not load. Try again in a moment.',
    }),
  }),
  retry: 'Try again',
});

const defaultWarn = (...args) => globalThis.console?.warn?.(...args);
const defaultReload = () => globalThis.location?.reload?.();

// Loads a route module once. `ensure()` answers the route, or null while it
// downloads (the first call starts the download). After a failed download only
// `ensure({ retry: true })` (a hydrate, or Try again) loads it again; a render
// never does, so a broken chunk cannot loop. A loader that returns the module
// itself (tests) creates the route at once.
export function createLazyRouteLoader({
  load,
  create,
  isActive = () => true,
  rerender = () => {},
  // Called with the new route before it is first shown. Returns true when it
  // already rendered the page, so the loader does not render it twice.
  onLoaded = () => false,
  label = 'Route',
  warn = defaultWarn,
} = {}) {
  if (typeof load !== 'function') throw new TypeError('lazy route requires load');
  if (typeof create !== 'function') throw new TypeError('lazy route requires create');
  let route = null;
  let request = null;
  let failed = false;

  function fail(error) {
    warn(`[${label}] page could not load:`, error?.message || error);
    request = null;
    failed = true;
    if (isActive()) rerender();
    return null;
  }

  function ensure({ retry = false } = {}) {
    if (route) return route;
    if (request || (failed && !retry)) return null;
    failed = false;
    let loaded;
    try {
      loaded = load();
    } catch (error) {
      loaded = Promise.reject(error);
    }
    if (loaded && typeof loaded.then !== 'function') {
      route = create(loaded);
      request = Promise.resolve(route);
      onLoaded(route);
      return route;
    }
    request = Promise.resolve(loaded)
      .then((module) => {
        route = create(module);
      })
      .then(() => {
        if (!onLoaded(route) && isActive()) rerender();
        return route;
      }, fail);
    return null;
  }

  // The route once it has loaded, or null when the download failed.
  function whenLoaded({ retry = false } = {}) {
    const current = ensure({ retry });
    return current ? Promise.resolve(current) : (request ?? Promise.resolve(null));
  }

  return Object.freeze({
    ensure,
    whenLoaded,
    current: () => route,
    failed: () => failed,
  });
}

// The route module, and in hosted mode the hosted view with it: both download
// at once and the route is created only when both have arrived.
function routeLoader({ hosted, load, loadHostedView }) {
  if (!hosted || typeof loadHostedView !== 'function') return load;
  return () => Promise.all([load(), loadHostedView()]).then(([module]) => module);
}

// The same card the route shows while its own hosted view downloads.
function renderPendingCard({ dom, el, appendText }, { className, failed, copy, onRetry, titleClass, detailTag = 'small', detailClass, buttonClass = 'pixel-button' }) {
  const card = el('article', { className: `official-info-card ${className.card}` });
  const holder = className.state ? el('div', { className: className.state }) : card;
  holder.setAttribute('role', 'status');
  if (failed) {
    appendText(holder, 'strong', copy.failedTitle, titleClass);
    appendText(holder, detailTag, copy.failedDetail, detailClass);
    const retry = el('button', { className: buttonClass, type: 'button', textContent: LAZY_ROUTE_COPY.retry });
    retry.addEventListener('click', onRetry);
    holder.append(retry);
  } else {
    appendText(holder, 'strong', copy.loading, titleClass);
  }
  if (holder !== card) card.append(holder);
  dom.officialCabinetGrid.append(card);
}

// Try again: import again (and read the page when hosted), and reload when the
// import fails again, only if this page still owns the screen: a slow retry
// that fails after the player moved on (a run, a Ranked session) must not
// reload the portal under them.
function retryHandler({ loader, hydrate, render, reload, warn, label, isActive }) {
  return () => {
    hydrate()
      .then(() => { if (loader.failed() && isActive()) reload(); })
      .catch((error) => warn(`[${label}] page could not load:`, error?.message || error));
    render();
  };
}

// The Profile route: `deps` are exactly what createOfficialProfileRoute takes.
export function createLazyProfileRoute(deps = {}, { load, loadHostedView = null, warn = defaultWarn, reload = defaultReload } = {}) {
  const { hosted = false, isActive = () => true } = deps;
  const copy = LAZY_ROUTE_COPY.profile[hosted ? 'hosted' : 'preview'];
  // lesters:ranked-pending can arrive before the route: keep the count.
  let pendingSavedRuns = 0;

  const loader = createLazyRouteLoader({
    load: routeLoader({ hosted, load, loadHostedView }),
    create: (module) => module.createOfficialProfileRoute(deps),
    isActive,
    rerender: () => renderProfile(),
    onLoaded: (route) => pendingSavedRuns > 0 && route.setPendingSavedRuns(pendingSavedRuns) === true,
    label: 'Profile',
    warn,
  });

  function hydrate(options = {}) {
    return loader.whenLoaded({ retry: true }).then((route) => (route ? route.hydrate(options) : null));
  }

  function renderPending() {
    const { dom } = deps;
    dom.officialCabinetGrid.replaceChildren();
    dom.officialCabinetGrid.classList.add('profile-command-grid');
    const failed = loader.failed();
    renderPendingCard(deps, {
      className: { card: `profile-state-card profile-state-${failed ? 'error' : 'loading'}` },
      failed,
      copy,
      onRetry: retryHandler({ loader, hydrate, render: () => renderProfile(), reload, warn, label: 'Profile', isActive }),
    });
  }

  function renderProfile() {
    const route = loader.ensure();
    if (route) return route.renderProfile();
    return renderPending();
  }

  function setPendingSavedRuns(count) {
    const next = Math.max(0, Math.floor(Number(count) || 0));
    const route = loader.current();
    if (route) {
      pendingSavedRuns = next;
      return route.setPendingSavedRuns(count);
    }
    if (next === pendingSavedRuns) return false;
    pendingSavedRuns = next;
    return true;
  }

  return Object.freeze({
    renderProfile,
    hydrate,
    // Before the route loads there is no cache to drop or mark.
    invalidate: (wallet = null) => loader.current()?.invalidate(wallet),
    markStale: (wallet = null) => loader.current()?.markStale(wallet),
    setPendingSavedRuns,
    cachedSelfProfile: (wallet) => loader.current()?.cachedSelfProfile(wallet) ?? null,
  });
}

// The Scores route: `deps` are exactly what createOfficialLeaderboardRoute takes.
export function createLazyLeaderboardRoute(deps = {}, { load, loadHostedView = null, warn = defaultWarn, reload = defaultReload } = {}) {
  const { hosted = false, isActive = () => true } = deps;
  const copy = LAZY_ROUTE_COPY.scores[hosted ? 'hosted' : 'preview'];

  const loader = createLazyRouteLoader({
    load: routeLoader({ hosted, load, loadHostedView }),
    create: (module) => module.createOfficialLeaderboardRoute(deps),
    isActive,
    rerender: () => renderLeaderboards(),
    label: 'Scores',
    warn,
  });

  function hydrate(...args) {
    return loader.whenLoaded({ retry: true }).then((route) => (route ? route.hydrate(...args) : null));
  }

  function renderPending() {
    const { dom } = deps;
    dom.officialCabinetGrid.replaceChildren();
    const failed = loader.failed();
    renderPendingCard(deps, {
      className: {
        card: `leaderboard-board-card leaderboard-board-${hosted ? 'hosted' : 'preview'}`,
        state: `leaderboard-empty-state leaderboard-state-${failed ? 'error' : 'loading'}`,
      },
      failed,
      copy,
      titleClass: 'leaderboard-empty-title',
      detailTag: 'span',
      detailClass: 'leaderboard-empty-copy',
      buttonClass: 'pixel-button leaderboard-empty-action',
      onRetry: retryHandler({ loader, hydrate, render: () => renderLeaderboards(), reload, warn, label: 'Scores', isActive }),
    });
  }

  function renderLeaderboards() {
    const route = loader.ensure();
    if (route) return route.renderLeaderboards();
    return renderPending();
  }

  return Object.freeze({
    renderLeaderboards,
    hydrate,
    invalidate: () => loader.current()?.invalidate(),
    markStale: (gameId = null) => loader.current()?.markStale(gameId),
  });
}
