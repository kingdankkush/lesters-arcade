import { filterLeaderboardEntriesBySource } from '../leaderboard-seed.mjs';
import { stackedInputLabel } from '../stacked-profile.mjs';
import { arcadeAvatarForUri } from '../arcade-avatars.mjs';
import {
  DEFAULT_LEADERBOARD_PERIOD,
  HOSTED_LEADERBOARD_NOTICE,
  HOSTED_LEADERBOARD_PAGE_SIZE,
  LEADERBOARD_DEVICE_LOCAL_NOTICE,
  LEADERBOARD_GAME_PREFERENCE_KEY,
  LEADERBOARD_MAX_ROWS,
  LEADERBOARD_PAGE_SIZE,
  LEADERBOARD_PREVIEW_LABEL,
  LEADERBOARD_SEARCH_DEBOUNCE_MS,
  STACKED_LOCAL_NOTICE,
  defaultSortDirFor,
  describeLeaderboardWindow,
  filterLeaderboardRows,
  formatPostedDate,
  formatResetCountdown,
  hostedLeaderboardEntry,
  hostedLeaderboardPeriod,
  hostedLeaderboardStatusCopy,
  hostedPageForRank,
  leaderboardBannerFor,
  leaderboardColumnsFor,
  leaderboardEmptyState,
  leaderboardPeriodTab,
  leaderboardPeriodTabs,
  leaderboardScoresPath,
  leaderboardSortOptionsFor,
  paginateLeaderboardRows,
  resolveLeaderboardGameId,
  sortLeaderboardRows,
  summarizeLeaderboardRun,
  visibleLimitForRank,
} from '../leaderboard-view.mjs';

const SCORES_PATH_PATTERN = /^\/(scores|leaderboards)\/?$/;
// A loaded hosted board is re-read on the next visit once it is this old, once
// its period has reset (resetsAt), or when a Ranked run or a published saved
// run marks it stale (markStale).
export const HOSTED_BOARD_TTL_MS = 60_000;
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
// my rank and a verified transaction link per row. Preview: this device's
// Ranked runs only, labelled "Preview · this device", with no request of any
// kind. Rendering is always synchronous; hydrate() fetches and renders again.
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
} = {}) {
  // Pagination is view state that resets whenever the standing changes.
  let visibleLimit = LEADERBOARD_PAGE_SIZE;
  // The URL / stored preference only wins over routeState until the player
  // makes a choice in this session.
  let selectionSettled = false;
  // Hosted boards, keyed by game, period, search and viewer.
  const hostedBoards = new Map();
  let searchTimer = null;

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
  // Hosted board data (E5)
  // ---------------------------------------------------------------------------

  function hostedKey(gameId = routeState.gameId, { search = routeState.search } = {}) {
    const { connectedWallet } = getContext();
    const period = hostedLeaderboardPeriod(routeState.cadence);
    const q = String(search ?? '').trim();
    return { key: `${gameId}|${period}|${q}|${connectedWallet ?? ''}`, gameId, period, q, wallet: connectedWallet ?? null };
  }

  function hostedBoard(spec) {
    if (!hostedBoards.has(spec.key)) {
      hostedBoards.set(spec.key, {
        ...spec,
        status: 'idle',
        rows: [],
        firstPage: 1,
        nextPage: null,
        total: 0,
        pageSize: HOSTED_LEADERBOARD_PAGE_SIZE,
        resetsAt: null,
        periodKey: null,
        you: null,
        loadingMore: false,
        request: null,
        loadedAt: null,
        stale: false,
      });
    }
    return hostedBoards.get(spec.key);
  }

  function rerenderIfShown() {
    if (isActive()) renderOfficialLeaderboards();
  }

  // Whether a loaded board can be shown without asking E5 again.
  function boardIsFresh(board) {
    if (board.status !== 'ready' || board.stale) return false;
    const clock = now();
    if (!Number.isFinite(board.loadedAt) || clock - board.loadedAt >= HOSTED_BOARD_TTL_MS) return false;
    const resetsAt = Date.parse(String(board.resetsAt ?? ''));
    return !(Number.isFinite(resetsAt) && clock >= resetsAt);
  }

  // Loads one page. `replace` starts a new window at that page (jump to my
  // rank); otherwise rows are appended (Show more). A page-1 reload of a board
  // that already shows rows keeps them on screen until the answer arrives, and
  // keeps them if the reload fails.
  async function loadHostedPage(board, page, { replace = false } = {}) {
    if (!hosted || !indexApi?.leaderboard) return board;
    const appending = !replace && page > 1;
    const refreshing = !appending && board.status === 'ready' && board.rows.length > 0;
    if (appending) board.loadingMore = true;
    else {
      board.stale = false;
      if (!board.rows.length) board.status = 'loading';
    }
    board.moreFailed = false;
    const request = indexApi.leaderboard({ game: board.gameId, period: board.period, page, q: board.q, wallet: board.wallet });
    board.request = request;
    const answer = await request;
    board.request = null;
    board.loadingMore = false;
    if (!answer?.ok) {
      // A failed "Show more" keeps the rows already shown and offers a retry;
      // so does a failed background reload.
      if (appending) board.moreFailed = true;
      else if (refreshing) board.loadedAt = now();
      else {
        board.status = answer?.error === 'network' ? 'offline' : 'error';
        board.rows = [];
      }
      rerenderIfShown();
      return board;
    }
    const rows = (Array.isArray(answer.rows) ? answer.rows : []).map((row) => hostedLeaderboardEntry(row, { connectedWallet: board.wallet }));
    if (replace || page === 1) {
      board.rows = rows;
      board.firstPage = page;
    } else {
      const known = new Set(board.rows.map((row) => row.rank));
      board.rows = [...board.rows, ...rows.filter((row) => !known.has(row.rank))];
    }
    board.pageSize = Number(answer.pageSize) || HOSTED_LEADERBOARD_PAGE_SIZE;
    board.total = Number(answer.total) || 0;
    board.resetsAt = answer.resetsAt ?? null;
    board.periodKey = answer.periodKey ?? null;
    board.you = answer.you ?? null;
    board.nextPage = page * board.pageSize < board.total ? page + 1 : null;
    board.status = 'ready';
    if (!appending) board.loadedAt = now();
    rerenderIfShown();
    return board;
  }

  // The hydrate hook: fetch the board on screen unless it is loading, or
  // loaded and still fresh (boardIsFresh).
  function hydrate() {
    if (!hosted) return Promise.resolve(null);
    const board = hostedBoard(hostedKey());
    if (board.request) return board.request.then(() => board);
    if (boardIsFresh(board)) return Promise.resolve(board);
    return loadHostedPage(board, 1);
  }

  // Drops every cached board (the viewer changed).
  function invalidate() {
    hostedBoards.clear();
  }

  // Marks cached boards out of date (every game, or one) so the next visit
  // reads E5 again: a Ranked run finished, a saved run published, a name
  // changed. The board on screen reloads now, keeping its rows meanwhile.
  function markStale(gameId = null) {
    if (!hosted) return;
    for (const board of hostedBoards.values()) {
      if (!gameId || board.gameId === gameId) board.stale = true;
    }
    if (isActive()) void hydrate();
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

  function hostedAvatar(entry, sizeClass) {
    const avatar = arcadeAvatarForUri(entry.avatarUri);
    if (!avatar) return renderAvatarChip(null, entry.displayName, sizeClass);
    const img = el('img', { className: `avatar-chip-img ${sizeClass}`, src: avatar.src, alt: `${avatar.label} avatar` });
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  }

  function profileLink(entry, className) {
    const link = el('a', { className, href: `/profile/${entry.wallet}`, textContent: entry.displayName });
    link.title = `Open ${entry.displayName}'s profile`;
    link.addEventListener('click', (event) => {
      if (typeof viewProfile !== 'function') return;
      if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey || event?.button > 0) return;
      event?.preventDefault?.();
      viewProfile(entry.wallet);
    });
    return link;
  }

  function verifiedLink(entry) {
    if (!entry.explorerUrl) return el('span', { className: 'lt-verified-pending', textContent: 'Publishing…' });
    const link = el('a', { className: 'lt-verified-link', href: entry.explorerUrl, target: '_blank', rel: 'noopener noreferrer', textContent: '⛓ verified' });
    link.title = 'Open this run’s transaction on the LiteForge explorer';
    return link;
  }

  function renderStateCard(board, copy, { onRetry = null, onPlay = null, onClear = null } = {}) {
    const card = el('div', { className: `leaderboard-empty-state leaderboard-state-${copy.kind}` });
    card.setAttribute('role', copy.kind === 'loading' ? 'status' : 'note');
    appendText(card, 'strong', copy.title, 'leaderboard-empty-title');
    appendText(card, 'span', copy.copy, 'leaderboard-empty-copy');
    if (copy.action === 'retry' && onRetry) {
      const retry = el('button', { className: 'pixel-button leaderboard-empty-action', type: 'button', textContent: 'Try again' });
      retry.addEventListener('click', onRetry);
      card.append(retry);
    }
    if (copy.action === 'play-ranked' && onPlay) {
      const play = el('button', { className: 'pixel-button profile-action-primary leaderboard-empty-action leaderboard-play-ranked', type: 'button', textContent: 'Play Ranked' });
      play.addEventListener('click', onPlay);
      card.append(play);
    }
    if (copy.action === 'clear-search' && onClear) {
      const clear = el('button', { className: 'pixel-button leaderboard-empty-action', type: 'button', textContent: 'Clear search' });
      clear.addEventListener('click', onClear);
      card.append(clear);
    }
    board.append(card);
    return card;
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
    if (hosted) renderHostedLeaderboard(leaderboardGameFilters);
    else renderPreviewLeaderboard(leaderboardGameFilters);
  }

  function renderHostedLeaderboard(cabinets) {
    const { connectedWallet } = getContext();
    const spec = hostedKey();
    const board = hostedBoard(spec);
    // A board nobody fetched yet (a new wallet, search or period reached
    // through any render path) starts its own request, so "Loading…" always
    // has one in flight.
    if (board.status === 'idle') void hydrate();
    const periodTab = leaderboardPeriodTab(spec.period);
    const activeCabinet = cabinets.find((cabinet) => cabinet.gameId === routeState.gameId);
    const title = activeCabinet?.title ?? getGame(routeState.gameId).title;
    const clock = now();

    const filterPanel = renderFilterPanel({
      cabinets,
      heading: cabinets.length > 1 ? 'Pick a cabinet, then a period' : 'Pick a period',
      detail: `${humanList(playableCabinetNames())} ${cabinets.length === 1 ? 'has a verified board' : 'have verified boards'}. Weekly, Monthly and All-time rank the best verified Ranked run per wallet.`,
      standingFor: (gameId) => {
        const cached = hostedBoards.get(hostedKey(gameId, { search: '' }).key);
        if (cached?.status !== 'ready') return `Verified · ${periodTab.label}`;
        return cached.total > 0
          ? `${cached.total.toLocaleString()} player${cached.total === 1 ? '' : 's'} · top ${Number(cached.rows[0]?.score ?? 0).toLocaleString()}`
          : `No scores yet · ${periodTab.label.toLowerCase()}`;
      },
      onSelectGame: () => { void hydrate(); },
    });

    const filterGrid = el('div', { className: 'leaderboard-filter-grid leaderboard-filter-grid-v10' });
    const timeGroup = el('div', { className: 'leaderboard-filter-group leaderboard-time-filter' });
    appendText(timeGroup, 'span', 'Period', 'leaderboard-filter-label');
    const tabBar = el('div', { className: 'leaderboard-cadence-tabs leaderboard-filter-buttons', role: 'group' });
    tabBar.setAttribute('aria-label', 'Leaderboard period');
    for (const tab of leaderboardPeriodTabs()) {
      const isActivePeriod = tab.id === spec.period;
      const button = el('button', {
        className: `pixel-button leaderboard-cadence-tab leaderboard-time-filter leaderboard-filter-button${isActivePeriod ? ' is-active' : ''}`,
        textContent: tab.label.toUpperCase(),
        type: 'button',
      });
      button.dataset.cadence = tab.id;
      button.setAttribute('aria-pressed', isActivePeriod ? 'true' : 'false');
      button.addEventListener('click', () => {
        if (routeState.cadence === tab.id) return;
        routeState.cadence = tab.id;
        rerender(`.leaderboard-cadence-tab[data-cadence="${tab.id}"]`);
        void hydrate();
      });
      tabBar.append(button);
    }
    timeGroup.append(tabBar);
    const countdown = formatResetCountdown(board.resetsAt, clock);
    appendText(timeGroup, 'small', periodTab.resets
      ? `${periodTab.resets}${countdown ? ` · resets ${countdown}` : ''}`
      : 'All-time never resets.', 'leaderboard-reset-copy');

    const findGroup = el('div', { className: 'leaderboard-filter-group leaderboard-find-filter' });
    appendText(findGroup, 'span', 'Find', 'leaderboard-filter-label');
    const controls = el('div', { className: 'leaderboard-controls leaderboard-controls-v10' });
    const searchWrap = el('label', { className: 'leaderboard-search-field' });
    appendText(searchWrap, 'span', 'Search', 'visually-hidden');
    const searchInput = el('input', { className: 'leaderboard-search', type: 'search' });
    searchInput.placeholder = 'Search a name or wallet (0x1234…)';
    searchInput.value = routeState.search;
    searchInput.autocomplete = 'off';
    searchInput.maxLength = 32;
    searchInput.setAttribute('aria-label', 'Search this board by display name or wallet prefix');
    searchInput.addEventListener('input', () => {
      routeState.search = searchInput.value;
      if (searchTimer) clearTimeoutImpl(searchTimer);
      // Server-side search: one request after the player stops typing.
      searchTimer = setTimeoutImpl(() => {
        searchTimer = null;
        rerender('.leaderboard-search', { caret: true });
        void hydrate();
      }, LEADERBOARD_SEARCH_DEBOUNCE_MS);
    });
    searchWrap.append(searchInput);
    controls.append(searchWrap);
    const resetButton = el('button', { className: 'pixel-button leaderboard-reset-button', type: 'button', textContent: 'Clear' });
    resetButton.disabled = !String(routeState.search ?? '').trim();
    resetButton.addEventListener('click', () => {
      routeState.search = '';
      rerender('.leaderboard-search');
      void hydrate();
    });
    controls.append(resetButton);
    findGroup.append(controls);
    filterGrid.append(timeGroup, findGroup);
    filterPanel.append(filterGrid);

    const filterSummary = el('p', { className: 'leaderboard-filter-summary leaderboard-filter-summary-v10' });
    filterSummary.setAttribute('role', 'status');
    filterSummary.setAttribute('aria-live', 'polite');
    appendText(filterSummary, 'span', title, 'leaderboard-filter-summary-game');
    appendText(filterSummary, 'strong', `${periodTab.label}${board.periodKey && board.periodKey !== 'all-time' ? ` (${board.periodKey})` : ''} · Verified Ranked`);
    appendText(filterSummary, 'small', board.status === 'ready'
      ? `${board.total.toLocaleString()} player${board.total === 1 ? '' : 's'}${spec.q ? ` matching "${spec.q}"` : ''}`
      : 'Loading the board');
    filterPanel.append(filterSummary);
    dom.officialCabinetGrid.append(filterPanel);

    // --- Board card ------------------------------------------------------------
    const card = el('article', { className: `official-info-card leaderboard-board-card leaderboard-board-v9 leaderboard-board-v10 leaderboard-board-hosted leaderboard-board-${routeState.gameId} hmh-visual-polish-v12` });
    card.dataset.game = routeState.gameId;
    card.setAttribute('aria-label', `${title} leaderboard`);
    const header = el('div', { className: 'leaderboard-header leaderboard-header-v9' });
    const headerCopy = el('div', { className: 'leaderboard-header-copy' });
    const heading = el('h3', { className: 'leaderboard-title' });
    heading.append(renderArcadeIcon('trophy'), documentRef.createTextNode(title.toUpperCase()));
    headerCopy.append(heading);
    appendText(headerCopy, 'span', `${periodTab.label.toUpperCase()}${board.periodKey && board.periodKey !== 'all-time' ? ` · ${board.periodKey}` : ''} · Verified Ranked`, 'cabinet-status-label');
    const headerStats = el('div', { className: 'leaderboard-header-stats' });
    const top = board.firstPage === 1 ? board.rows[0] : null;
    for (const [label, value, tone] of [
      ['Top Score', top ? top.score.toLocaleString() : '—', 'score'],
      ['Players', board.status === 'ready' ? board.total.toLocaleString() : '—', 'official'],
      ['You', connectedWallet && board.you ? `#${board.you.rank}` : 'Unranked', connectedWallet && board.you ? 'you' : 'muted'],
    ]) {
      const stat = el('div', { className: `leaderboard-header-stat leaderboard-header-stat-${tone}` });
      appendText(stat, 'span', label);
      appendText(stat, 'strong', value);
      headerStats.append(stat);
    }
    header.append(headerCopy, headerStats);
    card.append(header);
    const notice = el('p', { className: 'leaderboard-local-notice leaderboard-verified-notice' });
    appendText(notice, 'span', HOSTED_LEADERBOARD_NOTICE);
    card.append(notice);

    // --- Your placement --------------------------------------------------------
    const you = el('div', { className: `leaderboard-you-card leaderboard-you-card-v10${connectedWallet && board.you ? ' is-ranked' : ''}` });
    if (connectedWallet && board.you) {
      const youCopy = el('div', { className: 'leaderboard-you-copy' });
      appendText(youCopy, 'span', `YOUR RANK #${board.you.rank}`, 'leaderboard-you-rank');
      appendText(youCopy, 'strong', `${Number(board.you.score).toLocaleString()} pts`, 'leaderboard-you-score');
      appendText(youCopy, 'small', `Your best verified run on ${periodTab.board}.`, 'leaderboard-you-detail');
      you.append(youCopy);
      const jump = el('button', { className: 'pixel-button leaderboard-jump-button', type: 'button', textContent: 'Jump to my rank' });
      jump.addEventListener('click', () => { void jumpToMyRank(); });
      you.append(jump);
    } else if (connectedWallet) {
      appendText(you, 'small', board.status === 'ready' ? `No verified run on ${periodTab.board} yet. Play Ranked to post one.` : 'Looking for your verified runs…', 'leaderboard-you-detail');
    } else {
      appendText(you, 'small', 'Connect a wallet to see your placement highlighted on this board.', 'leaderboard-you-detail');
    }
    card.append(you);

    // --- Loading, failure and empty states -----------------------------------
    const statusCopy = board.rows.length === 0 ? hostedLeaderboardStatusCopy(board.status === 'idle' ? 'loading' : board.status) : null;
    if (statusCopy) {
      renderStateCard(card, statusCopy, { onRetry: () => { board.status = 'idle'; rerender(); void hydrate(); } });
      dom.officialCabinetGrid.append(card);
      return;
    }
    if (board.rows.length === 0) {
      const empty = leaderboardEmptyState({ hosted: true, period: spec.period, search: spec.q, gameTitle: title });
      renderStateCard(card, empty, {
        onPlay: () => playRanked?.(routeState.gameId),
        onClear: () => { routeState.search = ''; rerender('.leaderboard-search'); void hydrate(); },
      });
      dom.officialCabinetGrid.append(card);
      return;
    }

    // --- Podium (the top three, when the window starts at rank 1) ------------
    if (board.firstPage === 1 && !spec.q) {
      const podium = el('div', { className: 'leaderboard-podium' });
      podium.setAttribute('aria-label', 'Top three');
      const podiumEntries = board.rows.slice(0, 3);
      const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
      for (const entry of [podiumEntries[1], podiumEntries[0], podiumEntries[2]].filter(Boolean)) {
        const col = el('div', { className: `podium-slot podium-rank-${entry.rank}${entry.isCurrentPlayer ? ' is-current-player' : ''}` });
        appendText(col, 'span', medals[entry.rank] ?? `#${entry.rank}`, 'podium-medal');
        col.append(hostedAvatar(entry, 'podium-avatar'));
        const name = profileLink(entry, 'podium-name');
        col.append(name);
        appendText(col, 'span', entry.score.toLocaleString(), 'podium-score');
        const stand = el('div', { className: 'podium-stand' });
        appendText(stand, 'span', `#${entry.rank}`, 'podium-stand-rank');
        col.append(stand);
        podium.append(col);
      }
      card.append(podium);
    }

    // --- Rows ------------------------------------------------------------------
    const columns = leaderboardColumnsFor(routeState.gameId);
    const table = el('div', { className: 'leaderboard-table leaderboard-table-v10', role: 'table' });
    table.dataset.game = routeState.gameId;
    table.setAttribute('aria-label', `${title} ${periodTab.label.toLowerCase()} verified standing`);
    const headRow = el('div', { className: 'leaderboard-table-head', role: 'row' });
    for (const column of columns) {
      const label = column.kind === 'trust' ? 'Proof' : column.kind === 'posted' ? 'Published' : column.label;
      const cell = el('div', { className: `leaderboard-th-cell th-cell-${column.key} lb-priority-${column.priority} lb-align-${column.align}`, role: 'columnheader' });
      appendText(cell, 'span', label.toUpperCase(), `leaderboard-th th-${column.key} is-static`);
      headRow.append(cell);
    }
    table.append(headRow);
    for (const entry of board.rows) {
      const medalClass = entry.rank === 1 ? ' rank-gold' : entry.rank === 2 ? ' rank-silver' : entry.rank === 3 ? ' rank-bronze' : '';
      const row = el('div', { className: `leaderboard-trow${entry.isCurrentPlayer ? ' is-current-player' : ''}${medalClass ? ' top-3' + medalClass : ''}`, role: 'row' });
      if (entry.isCurrentPlayer) {
        row.id = 'leaderboardYourRow';
        row.setAttribute('tabindex', '-1');
      }
      for (const column of columns) {
        const cell = el('div', { className: `leaderboard-td lt-cell-${column.key} lb-priority-${column.priority} lb-align-${column.align}`, role: 'cell' });
        if (column.kind === 'rank') {
          appendText(cell, 'span', `#${entry.rank}`, `leaderboard-rank lt-rank${medalClass}`);
        } else if (column.kind === 'player') {
          const nameCell = el('span', { className: 'lt-name' });
          nameCell.append(hostedAvatar(entry, 'leaderboard-row-avatar'));
          const nameStack = el('span', { className: 'lt-name-stack' });
          nameStack.append(profileLink(entry, 'lt-name-text lt-profile-link'));
          const nameMeta = el('span', { className: 'lt-name-meta' });
          if (entry.isCurrentPlayer) appendText(nameMeta, 'span', 'YOU', 'lt-you-chip');
          if (entry.named) appendText(nameMeta, 'small', entry.walletShort, 'lt-wallet-short');
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
          appendText(cell, 'span', 'Proof', 'lt-cell-label');
          cell.append(verifiedLink(entry));
        } else if (column.kind === 'posted') {
          appendText(cell, 'span', 'Published', 'lt-cell-label');
          const posted = appendText(cell, 'span', formatPostedDate(entry.recordedAt, clock), 'lt-date');
          if (entry.recordedAt) posted.title = String(entry.recordedAt);
        }
        row.append(cell);
      }
      table.append(row);
    }
    card.append(table);

    // --- Footer: Show more fetches page + 1 ------------------------------------
    const footer = el('div', { className: 'leaderboard-table-footer' });
    const firstRank = board.rows[0]?.rank ?? 1;
    const lastRank = board.rows.at(-1)?.rank ?? 0;
    appendText(footer, 'span', spec.q
      ? `Showing ${board.rows.length} of ${board.total.toLocaleString()} matching player${board.total === 1 ? '' : 's'}`
      : `Showing ranks ${firstRank}–${lastRank} of ${board.total.toLocaleString()} player${board.total === 1 ? '' : 's'}`, 'leaderboard-table-count');
    if (board.nextPage) {
      const shown = (board.firstPage - 1) * board.pageSize + board.rows.length;
      const remaining = Math.max(1, Math.min(board.pageSize, board.total - shown));
      const label = board.loadingMore ? 'Loading…' : board.moreFailed ? 'Could not load more. Try again' : `Show ${remaining} more`;
      const more = el('button', { className: 'pixel-button leaderboard-show-more', type: 'button', textContent: label });
      more.disabled = board.loadingMore;
      more.addEventListener('click', () => {
        if (board.loadingMore || !board.nextPage) return;
        void loadHostedPage(board, board.nextPage);
        rerender();
      });
      footer.append(more);
    }
    if (board.firstPage > 1) {
      const back = el('button', { className: 'pixel-button leaderboard-show-less', type: 'button', textContent: 'Back to the top' });
      back.addEventListener('click', () => { void loadHostedPage(board, 1, { replace: true }); });
      footer.append(back);
    }
    card.append(footer);
    dom.officialCabinetGrid.append(card);
  }

  // Jump to my rank: E5 `you` names the rank, so the page that holds it is
  // fetched directly (search cleared: a filtered list is not ranked by page).
  async function jumpToMyRank() {
    routeState.search = '';
    const board = hostedBoard(hostedKey());
    if (board.status !== 'ready') await loadHostedPage(board, 1);
    const target = board.you;
    if (!target) return;
    if (!board.rows.some((row) => row.rank === target.rank)) {
      await loadHostedPage(board, hostedPageForRank(target.rank, board.pageSize), { replace: true });
    } else {
      rerenderIfShown();
    }
    const row = documentRef?.querySelector?.('#leaderboardYourRow');
    row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    row?.focus?.({ preventScroll: true });
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
