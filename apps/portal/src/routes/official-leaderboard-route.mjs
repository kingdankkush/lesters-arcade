import { filterLeaderboardEntriesBySource } from '../leaderboard-seed.mjs';
import { stackedInputLabel } from '../stacked-profile.mjs';
import {
  DEFAULT_LEADERBOARD_PERIOD,
  LEADERBOARD_DEVICE_LOCAL_NOTICE,
  LEADERBOARD_GAME_PREFERENCE_KEY,
  LEADERBOARD_MAX_ROWS,
  LEADERBOARD_PAGE_SIZE,
  LEADERBOARD_PREVIEW_LABEL,
  STACKED_LOCAL_NOTICE,
  defaultSortDirFor,
  describeLeaderboardWindow,
  filterLeaderboardRows,
  formatPostedDate,
  leaderboardBannerFor,
  leaderboardColumnsFor,
  leaderboardEmptyState,
  leaderboardScoresPath,
  leaderboardSortOptionsFor,
  paginateLeaderboardRows,
  resolveLeaderboardGameId,
  sortLeaderboardRows,
  summarizeLeaderboardRun,
  visibleLimitForRank,
} from '../leaderboard-view.mjs';

const SCORES_PATH_PATTERN = /^\/(scores|leaderboards)\/?$/;
const BANNER_NAV_KEYS = Object.freeze(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
// Preview boards show only this device's own Ranked runs (A22): no House Demo,
// no source tabs.
const PREVIEW_SOURCE = 'local';

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// The Scores page. Hosted (HOSTED_PROFILE_SYNC): Weekly, Monthly and All-time
// boards from GET /api/leaderboard, 25 rows a page, server-side search, jump to
// my rank and a verified transaction link per row (hosted-leaderboard-view.mjs,
// loaded on demand so preview visitors never download it; contract §11 rule
// 5). Preview: this device's Ranked runs only, labelled "Preview · this
// device", with no request of any kind. Rendering is always synchronous;
// hydrate() fetches and renders again.
export function createOfficialLeaderboardRoute({
  appendText,
  buildLeaderboardExperienceV2Model,
  documentRef = globalThis.document,
  dom,
  el,
  getAllCadenceLeaderboards,
  getContext,
  getGame,
  humanList,
  leaderboardEntryProvenance,
  playableCabinetNames,
  publicLeaderboardCabinets,
  renderArcadeIcon,
  renderAvatarChip,
  resolveDisplayName,
  routeState,
  storage = safeStorage(),
  windowRef = globalThis.window,
  hosted = false,
  indexApi = null,
  playRanked = null,
  viewProfile = null,
  isActive = () => true,
  now = () => Date.now(),
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeoutImpl = (id) => globalThis.clearTimeout(id),
  loadHostedView = () => import('./hosted-leaderboard-view.mjs'),
} = {}) {
  // Pagination is view state that resets whenever the standing changes.
  let visibleLimit = LEADERBOARD_PAGE_SIZE;
  // The URL / stored preference only wins over routeState until the player
  // makes a choice in this session.
  let selectionSettled = false;
  // The hosted view (hosted-leaderboard-view.mjs) once it has loaded.
  let hostedView = null;
  let hostedViewRequest = null;
  let hostedViewFailed = false;

  function readStoredGame() {
    try {
      return storage?.getItem?.(LEADERBOARD_GAME_PREFERENCE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  function syncGameLocation(gameId) {
    try {
      storage?.setItem?.(LEADERBOARD_GAME_PREFERENCE_KEY, String(gameId));
    } catch { /* storage unavailable */ }
    try {
      const location = windowRef?.location;
      const history = windowRef?.history;
      if (!location || typeof history?.replaceState !== 'function') return;
      if (!SCORES_PATH_PATTERN.test(location.pathname ?? '')) return;
      const next = leaderboardScoresPath(gameId, location.pathname);
      if (`${location.pathname}${location.search ?? ''}` !== next) history.replaceState(history.state, '', next);
    } catch { /* history unavailable */ }
  }

  function resetView() {
    visibleLimit = LEADERBOARD_PAGE_SIZE;
  }

  function rerender(focusSelector = null, { caret = false } = {}) {
    renderOfficialLeaderboards();
    if (!focusSelector) return;
    const next = documentRef?.querySelector?.(focusSelector);
    if (!next?.focus) return;
    next.focus({ preventScroll: true });
    if (caret && typeof next.setSelectionRange === 'function') {
      const end = String(next.value ?? '').length;
      next.setSelectionRange(end, end);
    }
  }

  // ---------------------------------------------------------------------------
  // Hosted view, loaded on demand (contract §11 rule 5)
  // ---------------------------------------------------------------------------

  function rerenderIfShown() {
    if (isActive()) renderOfficialLeaderboards();
  }

  function createHostedView(module) {
    return module.createHostedLeaderboardView({
      appendText,
      clearTimeoutImpl,
      documentRef,
      dom,
      el,
      getContext,
      getGame,
      humanList,
      indexApi,
      isActive,
      now,
      playableCabinetNames,
      playRanked,
      renderArcadeIcon,
      renderAvatarChip,
      renderFilterPanel,
      renderPage: () => renderOfficialLeaderboards(),
      rerender,
      routeState,
      setTimeoutImpl,
      viewProfile,
    });
  }

  // The hosted view, or null while it loads. A loader that returns the module
  // itself (tests) creates the view at once. After a failed download only
  // hydrate() (a visit, or Try again) loads it again; a render never does, so
  // a broken chunk cannot loop.
  function ensureHostedView({ retry = false } = {}) {
    if (!hosted || hostedView) return hostedView;
    if (hostedViewRequest || (hostedViewFailed && !retry)) return null;
    hostedViewFailed = false;
    let loaded;
    try {
      loaded = loadHostedView();
    } catch (error) {
      loaded = Promise.reject(error);
    }
    if (loaded && typeof loaded.then !== 'function') {
      hostedView = createHostedView(loaded);
      hostedViewRequest = Promise.resolve(hostedView);
      return hostedView;
    }
    hostedViewRequest = Promise.resolve(loaded)
      .then((module) => {
        hostedView = createHostedView(module);
        rerenderIfShown();
        return hostedView;
      })
      .catch((error) => {
        console.warn('[Scores] verified board could not load:', error?.message || error);
        hostedViewRequest = null;
        hostedViewFailed = true;
        rerenderIfShown();
        return null;
      });
    return null;
  }

  // The hydrate hook: fetch the board on screen (hosted only).
  function hydrate() {
    if (!hosted) return Promise.resolve(null);
    const view = ensureHostedView({ retry: true });
    if (view) return view.hydrate();
    return (hostedViewRequest ?? Promise.resolve(null)).then((loaded) => (loaded ? loaded.hydrate() : null));
  }

  // Drops every cached board (the viewer changed).
  function invalidate() {
    hostedView?.invalidate();
  }

  // Marks cached boards (every game, or one) out of date: see the view.
  function markStale(gameId = null) {
    hostedView?.markStale(gameId);
  }

  // Shown while the hosted view downloads, or if it failed to.
  function renderHostedLoading() {
    const card = el('article', { className: 'official-info-card leaderboard-board-card leaderboard-board-hosted' });
    const state = el('div', { className: `leaderboard-empty-state leaderboard-state-${hostedViewFailed ? 'error' : 'loading'}` });
    state.setAttribute('role', 'status');
    if (hostedViewFailed) {
      appendText(state, 'strong', 'Scores are unavailable right now', 'leaderboard-empty-title');
      appendText(state, 'span', 'The verified board could not load. Try again in a moment.', 'leaderboard-empty-copy');
      const retry = el('button', { className: 'pixel-button leaderboard-empty-action', type: 'button', textContent: 'Try again' });
      retry.addEventListener('click', () => { void hydrate(); rerender(); });
      state.append(retry);
    } else {
      appendText(state, 'strong', 'Loading verified scores…', 'leaderboard-empty-title');
    }
    card.append(state);
    dom.officialCabinetGrid.append(card);
  }

  // ---------------------------------------------------------------------------
  // Shared pieces
  // ---------------------------------------------------------------------------

  function renderFilterPanel({ cabinets, heading, detail, standingFor, onSelectGame }) {
    const filterPanel = el('section', { className: 'official-info-card leaderboard-filter-panel leaderboard-filter-shell leaderboard-command-v10' });
    filterPanel.setAttribute('aria-label', 'Leaderboard filters');
    const filterHead = el('div', { className: 'leaderboard-filter-head' });
    const filterCopy = el('div', { className: 'leaderboard-filter-copy' });
    appendText(filterCopy, 'span', 'Leaderboard Filters', 'cabinet-status-label');
    appendText(filterCopy, 'strong', heading);
    appendText(filterCopy, 'small', detail);
    filterHead.append(filterCopy);
    filterPanel.append(filterHead);

    // --- Game banners (tablist; arrow keys move, Enter/Space selects) -------
    const gameGroup = el('div', { className: 'leaderboard-filter-group leaderboard-game-filter leaderboard-game-banner-group' });
    appendText(gameGroup, 'span', 'Game', 'leaderboard-filter-label');
    const gameBar = el('div', { className: 'leaderboard-game-tabs leaderboard-filter-buttons leaderboard-game-banners', role: 'tablist' });
    gameBar.setAttribute('aria-label', 'Choose a game leaderboard');
    const bannerButtons = [];
    for (const cabinet of cabinets) {
      const isActiveGame = cabinet.gameId === routeState.gameId;
      const banner = leaderboardBannerFor(cabinet.gameId, cabinet);
      const tab = el('button', {
        className: `pixel-button leaderboard-game-tab leaderboard-game-filter leaderboard-filter-button leaderboard-game-banner${isActiveGame ? ' is-active' : ''}`,
        type: 'button',
        role: 'tab',
      });
      tab.dataset.game = cabinet.gameId;
      tab.setAttribute('aria-selected', isActiveGame ? 'true' : 'false');
      tab.setAttribute('tabindex', isActiveGame ? '0' : '-1');
      tab.setAttribute('aria-label', `${banner.title} leaderboard${isActiveGame ? ', selected' : ''}`);
      const art = el('span', { className: 'leaderboard-game-banner-art' });
      art.setAttribute('aria-hidden', 'true');
      tab.append(art);
      if (banner.cabinet) {
        const cabinetArt = el('img', { className: 'leaderboard-game-banner-cabinet', src: banner.cabinet, alt: '' });
        cabinetArt.loading = 'lazy';
        cabinetArt.decoding = 'async';
        tab.append(cabinetArt);
      }
      const copy = el('div', { className: 'leaderboard-game-banner-copy' });
      appendText(copy, 'span', banner.kicker, 'leaderboard-game-banner-kicker');
      appendText(copy, 'span', cabinet.title, 'leaderboard-game-tab-title leaderboard-game-banner-title');
      appendText(copy, 'small', banner.tagline, 'leaderboard-game-banner-tagline');
      appendText(copy, 'span', standingFor(cabinet.gameId, isActiveGame), 'leaderboard-game-banner-meta');
      tab.append(copy);
      appendText(tab, 'span', isActiveGame ? 'Viewing' : 'View board', 'leaderboard-game-banner-state');
      tab.addEventListener('click', () => {
        if (routeState.gameId === cabinet.gameId) return;
        routeState.gameId = cabinet.gameId;
        routeState.search = '';
        routeState.sortKey = 'score';
        routeState.sortDir = 'desc';
        resetView();
        // Write the URL/preference first so the re-render resolves the new game
        // instead of the stale ?game= query.
        syncGameLocation(cabinet.gameId);
        rerender(`.leaderboard-game-banner[data-game="${cabinet.gameId}"]`);
        onSelectGame?.();
      });
      bannerButtons.push(tab);
      gameBar.append(tab);
    }
    gameBar.addEventListener('keydown', (event) => {
      if (!BANNER_NAV_KEYS.includes(event.key) || bannerButtons.length === 0) return;
      const current = bannerButtons.findIndex((button) => button === event.target || button.contains?.(event.target));
      const index = current === -1 ? 0 : current;
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % bannerButtons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + bannerButtons.length) % bannerButtons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = bannerButtons.length - 1;
      event.preventDefault();
      for (const [i, button] of bannerButtons.entries()) button.setAttribute('tabindex', i === next ? '0' : '-1');
      bannerButtons[next].focus?.();
    });
    gameGroup.append(gameBar);
    filterPanel.append(gameGroup);
    return filterPanel;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function renderOfficialLeaderboards() {
    dom.officialCabinetGrid.replaceChildren();

    // --- Game selection (URL query > session choice > stored preference) ----
    const leaderboardGameFilters = publicLeaderboardCabinets();
    const onScoresPath = SCORES_PATH_PATTERN.test(windowRef?.location?.pathname ?? '');
    routeState.gameId = resolveLeaderboardGameId({
      search: onScoresPath ? (windowRef?.location?.search ?? '') : '',
      stored: readStoredGame(),
      current: routeState.gameId,
      settled: selectionSettled,
      cabinets: leaderboardGameFilters,
    });
    selectionSettled = true;
    routeState.cadence ??= DEFAULT_LEADERBOARD_PERIOD;
    routeState.search ??= '';
    routeState.sortKey ??= 'score';
    routeState.sortDir ??= 'desc';
    syncGameLocation(routeState.gameId);
    if (!hosted) {
      renderPreviewLeaderboard(leaderboardGameFilters);
      return;
    }
    const view = ensureHostedView();
    if (view) view.render(leaderboardGameFilters);
    else renderHostedLoading();
  }

  function renderPreviewLeaderboard(leaderboardGameFilters) {
    const { connectedWallet, state } = getContext();
    const displayNameFor = (wallet) => resolveDisplayName(state.profiles?.[wallet], wallet);
    const buildStanding = (gameId) => {
      const model = buildLeaderboardExperienceV2Model(state, {
        gameId,
        cadence: routeState.cadence,
        wallet: connectedWallet,
        displayNameFor,
        source: PREVIEW_SOURCE,
        // Partition before best-per-wallet aggregation as well as truncation.
        limit: 5000,
      });
      return { model, board: filterLeaderboardEntriesBySource(model.topEntries, state.profiles, PREVIEW_SOURCE) };
    };
    const { model: unfiltered, board: sourceBoard } = buildStanding(routeState.gameId);
    const active = {
      ...unfiltered,
      total: sourceBoard.total,
      topEntries: sourceBoard.rows.slice(0, LEADERBOARD_MAX_ROWS),
      playerRank: sourceBoard.playerRank,
      playerEntry: sourceBoard.playerEntry,
    };
    const activeLeaderboardCabinet = leaderboardGameFilters.find((cabinet) => cabinet.gameId === routeState.gameId);
    const activeLeaderboardTitle = activeLeaderboardCabinet?.title ?? getGame(routeState.gameId).title;
    const timeWindow = describeLeaderboardWindow(active.cadence ?? routeState.cadence, active.periodKey);

    const filterPanel = renderFilterPanel({
      cabinets: leaderboardGameFilters,
      heading: leaderboardGameFilters.length > 1 ? 'Pick a cabinet, then a score window' : 'Pick a score window',
      detail: `${LEADERBOARD_PREVIEW_LABEL}: ${humanList(playableCabinetNames())} Ranked runs recorded in this browser. Verified boards open when Ranked publishing goes live.`,
      standingFor: (gameId, isActiveGame) => {
        const standing = isActiveGame
          ? { total: active.total, topScore: active.topEntries[0]?.score ?? null }
          : (({ board }) => ({ total: board.total, topScore: board.rows[0]?.score ?? null }))(buildStanding(gameId));
        return standing.total > 0
          ? `${standing.total.toLocaleString()} player${standing.total === 1 ? '' : 's'} · top ${Number(standing.topScore ?? 0).toLocaleString()}`
          : `No scores yet · ${timeWindow.label.toLowerCase()}`;
      },
    });

    // --- Time window + search/sort ----------------------------------------
    const filterGrid = el('div', { className: 'leaderboard-filter-grid leaderboard-filter-grid-v10' });
    const timeGroup = el('div', { className: 'leaderboard-filter-group leaderboard-time-filter' });
    appendText(timeGroup, 'span', 'Time window', 'leaderboard-filter-label');
    const tabBar = el('div', { className: 'leaderboard-cadence-tabs leaderboard-filter-buttons', role: 'group' });
    tabBar.setAttribute('aria-label', 'Time window');
    for (const cadenceBoard of getAllCadenceLeaderboards(state, routeState.gameId, { wallet: connectedWallet, displayNameFor })) {
      const isActiveCadence = cadenceBoard.cadence === routeState.cadence;
      const tab = el('button', {
        className: `pixel-button leaderboard-cadence-tab leaderboard-time-filter leaderboard-filter-button${isActiveCadence ? ' is-active' : ''}`,
        textContent: cadenceBoard.cadence.replace('-', ' ').toUpperCase(),
        type: 'button',
      });
      tab.dataset.cadence = cadenceBoard.cadence;
      tab.setAttribute('aria-pressed', isActiveCadence ? 'true' : 'false');
      tab.addEventListener('click', () => {
        if (routeState.cadence === cadenceBoard.cadence) return;
        routeState.cadence = cadenceBoard.cadence;
        resetView();
        rerender(`.leaderboard-cadence-tab[data-cadence="${cadenceBoard.cadence}"]`);
      });
      tabBar.append(tab);
    }
    timeGroup.append(tabBar);

    const findGroup = el('div', { className: 'leaderboard-filter-group leaderboard-find-filter' });
    appendText(findGroup, 'span', 'Find & sort', 'leaderboard-filter-label');
    const controls = el('div', { className: 'leaderboard-controls leaderboard-controls-v10' });
    const searchWrap = el('label', { className: 'leaderboard-search-field' });
    appendText(searchWrap, 'span', 'Search', 'visually-hidden');
    const searchInput = el('input', { className: 'leaderboard-search', type: 'search' });
    searchInput.placeholder = 'Search player or wallet prefix…';
    searchInput.value = routeState.search;
    searchInput.autocomplete = 'off';
    searchInput.setAttribute('aria-label', 'Search leaderboard by display name or wallet prefix');
    searchInput.addEventListener('input', () => {
      routeState.search = searchInput.value;
      resetView();
      rerender('.leaderboard-search', { caret: true });
    });
    searchWrap.append(searchInput);
    controls.append(searchWrap);

    const sortWrap = el('label', { className: 'leaderboard-sort-field' });
    appendText(sortWrap, 'span', 'Sort by', 'leaderboard-sort-label');
    const sortSelect = el('select', { className: 'leaderboard-sort-select' });
    sortSelect.setAttribute('aria-label', 'Sort leaderboard by');
    for (const option of leaderboardSortOptionsFor(routeState.gameId)) {
      const node = el('option', { textContent: option.label });
      node.value = option.key;
      node.selected = option.key === routeState.sortKey;
      sortSelect.append(node);
    }
    sortSelect.addEventListener('change', () => {
      routeState.sortKey = sortSelect.value;
      routeState.sortDir = defaultSortDirFor(sortSelect.value);
      resetView();
      rerender('.leaderboard-sort-select');
    });
    sortWrap.append(sortSelect);
    controls.append(sortWrap);

    const isNameSort = routeState.sortKey === 'name';
    const dirButton = el('button', {
      className: 'pixel-button leaderboard-sort-dir',
      type: 'button',
      textContent: routeState.sortDir === 'asc' ? (isNameSort ? 'A → Z' : 'Low → High') : (isNameSort ? 'Z → A' : 'High → Low'),
    });
    dirButton.setAttribute('aria-label', `Sort direction: ${routeState.sortDir === 'asc' ? 'ascending' : 'descending'}. Activate to flip.`);
    dirButton.addEventListener('click', () => {
      routeState.sortDir = routeState.sortDir === 'asc' ? 'desc' : 'asc';
      resetView();
      rerender('.leaderboard-sort-dir');
    });
    controls.append(dirButton);

    const resetButton = el('button', { className: 'pixel-button leaderboard-reset-button', type: 'button', textContent: 'Reset' });
    resetButton.disabled = !routeState.search && routeState.sortKey === 'score' && routeState.sortDir === 'desc';
    resetButton.addEventListener('click', () => {
      routeState.search = '';
      routeState.sortKey = 'score';
      routeState.sortDir = 'desc';
      resetView();
      rerender('.leaderboard-search');
    });
    controls.append(resetButton);
    findGroup.append(controls);

    filterGrid.append(timeGroup, findGroup);
    filterPanel.append(filterGrid);

    const filterSummary = el('p', { className: 'leaderboard-filter-summary leaderboard-filter-summary-v10' });
    filterSummary.setAttribute('role', 'status');
    filterSummary.setAttribute('aria-live', 'polite');
    appendText(filterSummary, 'span', activeLeaderboardTitle, 'leaderboard-filter-summary-game');
    appendText(filterSummary, 'strong', `${timeWindow.label}${timeWindow.detail ? ` (${timeWindow.detail})` : ''} · ${LEADERBOARD_PREVIEW_LABEL}`);
    appendText(filterSummary, 'small', `Showing ${active.topEntries.length} of ${active.total} player${active.total === 1 ? '' : 's'} recorded on this device`);
    filterPanel.append(filterSummary);
    dom.officialCabinetGrid.append(filterPanel);

    // =======================================================================
    // Board card
    // =======================================================================
    const board = el('article', { className: `official-info-card leaderboard-board-card leaderboard-board-v9 leaderboard-board-v10 leaderboard-board-preview leaderboard-board-${routeState.gameId} hmh-visual-polish-v12` });
    board.dataset.game = routeState.gameId;
    board.setAttribute('aria-label', `${activeLeaderboardTitle} leaderboard`);
    const header = el('div', { className: 'leaderboard-header leaderboard-header-v9' });
    const headerCopy = el('div', { className: 'leaderboard-header-copy' });
    const leaderboardTitle = el('h3', { className: 'leaderboard-title' });
    leaderboardTitle.append(renderArcadeIcon('trophy'), documentRef.createTextNode(activeLeaderboardTitle.toUpperCase()));
    headerCopy.append(leaderboardTitle);
    appendText(headerCopy, 'span', `${timeWindow.tab}${timeWindow.detail ? ` · ${timeWindow.detail}` : ''} · ${LEADERBOARD_PREVIEW_LABEL}`, 'cabinet-status-label');
    const headerStats = el('div', { className: 'leaderboard-header-stats' });
    const topScore = active.topEntries[0]?.score ?? 0;
    for (const [label, value, tone] of [
      ['Top Score', topScore.toLocaleString(), 'score'],
      ['Players', active.total.toLocaleString(), 'muted'],
      ['You', connectedWallet && active.playerRank ? `#${active.playerRank}` : 'Unranked', connectedWallet && active.playerRank ? 'you' : 'muted'],
    ]) {
      const stat = el('div', { className: `leaderboard-header-stat leaderboard-header-stat-${tone}` });
      appendText(stat, 'span', label);
      appendText(stat, 'strong', value);
      headerStats.append(stat);
    }
    header.append(headerCopy, headerStats);
    board.append(header);

    const notice = el('p', { className: 'leaderboard-local-notice' });
    appendText(notice, 'strong', LEADERBOARD_PREVIEW_LABEL, 'leaderboard-preview-label');
    appendText(notice, 'span', LEADERBOARD_DEVICE_LOCAL_NOTICE);
    if (routeState.gameId === 'stacked') appendText(notice, 'span', STACKED_LOCAL_NOTICE);
    board.append(notice);

    // --- Your placement strip -------------------------------------------------
    const you = el('div', { className: `leaderboard-you-card leaderboard-you-card-v10${connectedWallet && active.playerEntry ? ' is-ranked' : ''}` });
    if (connectedWallet && active.playerEntry) {
      you.append(renderAvatarChip(connectedWallet, active.playerEntry.displayName, 'leaderboard-row-avatar'));
      const youCopy = el('div', { className: 'leaderboard-you-copy' });
      appendText(youCopy, 'span', `YOUR RANK #${active.playerRank}`, 'leaderboard-you-rank');
      appendText(youCopy, 'strong', `${active.playerEntry.score.toLocaleString()} pts`, 'leaderboard-you-score');
      appendText(youCopy, 'small', `${summarizeLeaderboardRun(routeState.gameId, active.playerEntry)}${routeState.gameId === 'stacked' ? ` · ${stackedInputLabel(active.playerEntry.runStats?.inputDevice)}` : ''}`, 'leaderboard-you-detail');
      you.append(youCopy);
      const jump = el('button', { className: 'pixel-button leaderboard-jump-button', type: 'button', textContent: 'Jump to my rank' });
      jump.addEventListener('click', () => {
        routeState.search = '';
        routeState.sortKey = 'score';
        routeState.sortDir = 'desc';
        visibleLimit = Math.max(LEADERBOARD_PAGE_SIZE, visibleLimitForRank(active.playerRank));
        renderOfficialLeaderboards();
        const row = documentRef?.querySelector?.('#leaderboardYourRow');
        row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        row?.focus?.({ preventScroll: true });
      });
      you.append(jump);
    } else if (connectedWallet) {
      appendText(you, 'small', 'You have no Ranked score on this device in this period yet.', 'leaderboard-you-detail');
    } else {
      appendText(you, 'small', 'Connect a wallet to see your placement highlighted on this board.', 'leaderboard-you-detail');
    }
    board.append(you);

    // --- Empty standing ------------------------------------------------------
    if (active.topEntries.length === 0) {
      const empty = leaderboardEmptyState({ hosted: false, gameTitle: activeLeaderboardTitle });
      const emptyCard = el('div', { className: 'leaderboard-empty-state' });
      appendText(emptyCard, 'small', empty.title, 'leaderboard-empty-title');
      appendText(emptyCard, 'span', empty.copy, 'leaderboard-empty-copy');
      board.append(emptyCard);
      dom.officialCabinetGrid.append(board);
      return;
    }

    // --- Podium for the top 3 (always by score) ------------------------------
    const podiumEntries = active.topEntries.slice(0, 3);
    if (podiumEntries.length >= 1) {
      const podium = el('div', { className: 'leaderboard-podium' });
      podium.setAttribute('aria-label', 'Top three');
      const order = [podiumEntries[1], podiumEntries[0], podiumEntries[2]].filter(Boolean);
      const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
      for (const entry of order) {
        const wallet = entry.wallet ?? entry.address ?? null;
        const col = el('div', { className: `podium-slot podium-rank-${entry.rank}${entry.isCurrentPlayer ? ' is-current-player' : ''}` });
        appendText(col, 'span', medals[entry.rank] ?? `#${entry.rank}`, 'podium-medal');
        col.append(renderAvatarChip(wallet, entry.displayName, 'podium-avatar'));
        appendText(col, 'strong', entry.displayName, 'podium-name');
        appendText(col, 'span', entry.score.toLocaleString(), 'podium-score');
        const stand = el('div', { className: 'podium-stand' });
        appendText(stand, 'span', `#${entry.rank}`, 'podium-stand-rank');
        col.append(stand);
        podium.append(col);
      }
      board.append(podium);
    }

    // --- Searchable, sortable, paginated standing ----------------------------
    // Each row keeps its TRUE rank-by-score (the standing); sorting/searching
    // only changes display order/visibility, never the rank number.
    const ranked = active.topEntries.map((entry) => ({ ...entry, trueRank: entry.rank }));
    const matched = filterLeaderboardRows(ranked, routeState.search);
    const sorted = sortLeaderboardRows(matched, { sortKey: routeState.sortKey, sortDir: routeState.sortDir, gameId: routeState.gameId });
    const page = paginateLeaderboardRows(sorted, visibleLimit);
    const columns = leaderboardColumnsFor(routeState.gameId);

    const table = el('div', { className: 'leaderboard-table leaderboard-table-v10', role: 'table' });
    table.dataset.game = routeState.gameId;
    table.setAttribute('aria-label', `${activeLeaderboardTitle} ${timeWindow.label.toLowerCase()} standing`);
    const headRow = el('div', { className: 'leaderboard-table-head', role: 'row' });
    for (const column of columns) {
      const isSorted = column.sortKey && routeState.sortKey === column.sortKey;
      const cell = el('div', { className: `leaderboard-th-cell th-cell-${column.key} lb-priority-${column.priority} lb-align-${column.align}`, role: 'columnheader' });
      if (column.sortKey) {
        cell.setAttribute('aria-sort', isSorted ? (routeState.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
        const arrow = isSorted ? (routeState.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
        const th = el('button', { className: `leaderboard-th th-${column.key}${isSorted ? ' is-sorted' : ''}`, type: 'button', textContent: column.label.toUpperCase() + arrow });
        if (column.title && column.title !== column.label) th.title = column.title;
        th.setAttribute('aria-label', `Sort by ${column.title ?? column.label}`);
        th.addEventListener('click', () => {
          if (routeState.sortKey === column.sortKey) {
            routeState.sortDir = routeState.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            routeState.sortKey = column.sortKey;
            routeState.sortDir = defaultSortDirFor(column.sortKey);
          }
          resetView();
          rerender(`.leaderboard-th.th-${column.key}`);
        });
        cell.append(th);
      } else {
        appendText(cell, 'span', column.label.toUpperCase(), `leaderboard-th th-${column.key} is-static`);
      }
      headRow.append(cell);
    }
    table.append(headRow);

    if (page.total === 0) {
      const empty = leaderboardEmptyState({ hosted: false, search: routeState.search });
      const emptyRow = el('div', { className: 'leaderboard-empty', role: 'row' });
      const emptyCell = el('div', { className: 'leaderboard-empty-cell', role: 'cell' });
      appendText(emptyCell, 'strong', empty.title, 'leaderboard-empty-title');
      appendText(emptyCell, 'span', empty.copy, 'leaderboard-empty-copy');
      const clear = el('button', { className: 'pixel-button leaderboard-empty-action', type: 'button', textContent: 'Clear search' });
      clear.addEventListener('click', () => {
        routeState.search = '';
        resetView();
        rerender('.leaderboard-search');
      });
      emptyCell.append(clear);
      emptyRow.append(emptyCell);
      table.append(emptyRow);
    }

    const stackedBoard = routeState.gameId === 'stacked';
    const clock = now();
    for (const entry of page.visible) {
      const wallet = entry.wallet ?? entry.address ?? null;
      const medalClass = entry.trueRank === 1 ? ' rank-gold' : entry.trueRank === 2 ? ' rank-silver' : entry.trueRank === 3 ? ' rank-bronze' : '';
      const row = el('div', { className: `leaderboard-trow${entry.isCurrentPlayer ? ' is-current-player' : ''}${medalClass ? ' top-3' + medalClass : ''}`, role: 'row' });
      if (entry.isCurrentPlayer) {
        row.id = 'leaderboardYourRow';
        row.setAttribute('tabindex', '-1');
      }
      const provenance = leaderboardEntryProvenance(entry, state.profiles?.[wallet]);
      for (const column of columns) {
        const cell = el('div', { className: `leaderboard-td lt-cell-${column.key} lb-priority-${column.priority} lb-align-${column.align}`, role: 'cell' });
        if (column.kind === 'rank') {
          appendText(cell, 'span', `#${entry.trueRank}`, `leaderboard-rank lt-rank${medalClass}`);
        } else if (column.kind === 'player') {
          const nameCell = el('span', { className: 'lt-name' });
          nameCell.append(renderAvatarChip(wallet, entry.displayName, 'leaderboard-row-avatar'));
          const nameStack = el('span', { className: 'lt-name-stack' });
          appendText(nameStack, 'span', entry.displayName, 'lt-name-text');
          const nameMeta = el('span', { className: 'lt-name-meta' });
          if (entry.isCurrentPlayer) appendText(nameMeta, 'span', 'YOU', 'lt-you-chip');
          if (stackedBoard) appendText(nameMeta, 'small', stackedInputLabel(entry.runStats?.inputDevice), 'lt-input-device');
          appendText(nameMeta, 'span', provenance.label, 'lt-house-score');
          if (entry.sessionDetail?.detailHref) {
            nameMeta.append(el('a', { className: 'lt-session-detail', href: entry.sessionDetail.detailHref, textContent: 'Open run ↗' }));
          }
          nameStack.append(nameMeta);
          nameCell.append(nameStack);
          cell.append(nameCell);
        } else if (column.kind === 'score') {
          appendText(cell, 'strong', column.format(entry), 'lt-score');
        } else if (column.kind === 'stat') {
          appendText(cell, 'span', column.label, 'lt-cell-label');
          const value = appendText(cell, 'span', column.format(entry), `lt-stat lt-${column.key}`);
          if (column.title && column.title !== column.label) value.title = column.title;
        } else if (column.kind === 'trust') {
          const trustBadge = el('span', { className: 'lt-trust lt-trust-muted' });
          trustBadge.textContent = 'This device';
          appendText(cell, 'span', 'Source', 'lt-cell-label');
          cell.append(trustBadge);
        } else if (column.kind === 'posted') {
          appendText(cell, 'span', 'Posted', 'lt-cell-label');
          const posted = appendText(cell, 'span', formatPostedDate(entry.recordedAt, clock), 'lt-date');
          if (entry.recordedAt) posted.title = String(entry.recordedAt);
        }
        row.append(cell);
      }
      table.append(row);
    }
    board.append(table);

    // --- Pagination footer ---------------------------------------------------
    const footer = el('div', { className: 'leaderboard-table-footer' });
    appendText(footer, 'span', page.total === 0
      ? 'Showing 0 players'
      : `Showing ${page.shown} of ${page.total} player${page.total === 1 ? '' : 's'}${active.total > page.total && !routeState.search ? ` · top ${LEADERBOARD_MAX_ROWS} of ${active.total.toLocaleString()} ranked` : ''}`, 'leaderboard-table-count');
    if (page.hasMore) {
      const more = el('button', { className: 'pixel-button leaderboard-show-more', type: 'button', textContent: `Show ${Math.min(LEADERBOARD_PAGE_SIZE, page.hiddenCount)} more` });
      more.addEventListener('click', () => {
        visibleLimit = page.nextLimit;
        rerender('.leaderboard-show-more, .leaderboard-show-less');
      });
      footer.append(more);
      if (page.hiddenCount > LEADERBOARD_PAGE_SIZE) {
        const all = el('button', { className: 'pixel-button leaderboard-show-all', type: 'button', textContent: `Show all ${page.total}` });
        all.addEventListener('click', () => {
          visibleLimit = page.total;
          rerender('.leaderboard-show-less');
        });
        footer.append(all);
      }
    } else if (page.total > LEADERBOARD_PAGE_SIZE) {
      const collapse = el('button', { className: 'pixel-button leaderboard-show-less', type: 'button', textContent: `Show top ${LEADERBOARD_PAGE_SIZE}` });
      collapse.addEventListener('click', () => {
        resetView();
        rerender('.leaderboard-show-more');
      });
      footer.append(collapse);
    }
    board.append(footer);
    dom.officialCabinetGrid.append(board);
  }

  return Object.freeze({ renderLeaderboards: renderOfficialLeaderboards, hydrate, invalidate, markStale });
}
