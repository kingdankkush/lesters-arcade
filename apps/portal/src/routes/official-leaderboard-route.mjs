import { LEADERBOARD_SOURCE_TABS, filterLeaderboardEntriesBySource } from '../leaderboard-seed.mjs';
import { stackedInputLabel } from '../stacked-profile.mjs';
import {
  LEADERBOARD_DEVICE_LOCAL_NOTICE,
  LEADERBOARD_GAME_PREFERENCE_KEY,
  LEADERBOARD_MAX_ROWS,
  LEADERBOARD_PAGE_SIZE,
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

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

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
  summarizeVisibleLeaderboardProvenance,
  windowRef = globalThis.window,
} = {}) {
  // Pagination is view state that resets whenever the standing changes.
  let visibleLimit = LEADERBOARD_PAGE_SIZE;
  // The URL / stored preference only wins over routeState until the player
  // makes a choice in this session.
  let selectionSettled = false;

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

  function sourceForGame(gameId, source = routeState.source) {
    // Verified on-chain standings only exist for Hard Money Heroes today; the
    // other cabinets fall back to this device's Local Preview standing.
    return ['chikun', 'stacked'].includes(gameId) && source === 'official' ? 'local' : source;
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

  function renderOfficialLeaderboards() {
    const { connectedWallet, state } = getContext();
    dom.officialCabinetGrid.replaceChildren();
    const displayNameFor = (wallet) => resolveDisplayName(state.profiles?.[wallet], wallet);

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

    routeState.source ??= 'official';
    routeState.search ??= '';
    routeState.sortKey ??= 'score';
    routeState.sortDir ??= 'desc';
    const buildStanding = (gameId, source) => {
      const model = buildLeaderboardExperienceV2Model(state, {
        gameId,
        cadence: routeState.cadence,
        wallet: connectedWallet,
        displayNameFor,
        source,
        // Partition before best-per-wallet aggregation as well as truncation.
        // A higher local score must not erase this wallet's verified score.
        limit: 5000,
      });
      return { model, board: filterLeaderboardEntriesBySource(model.topEntries, state.profiles, source) };
    };
    const { model: unfiltered, board: sourceBoard } = buildStanding(routeState.gameId, routeState.source);
    routeState.source = sourceBoard.source;
    const active = {
      ...unfiltered,
      total: sourceBoard.total,
      topEntries: sourceBoard.rows.slice(0, LEADERBOARD_MAX_ROWS),
      rows: sourceBoard.rows.slice(0, LEADERBOARD_MAX_ROWS),
      playerRank: sourceBoard.playerRank,
      playerEntry: sourceBoard.playerEntry,
      trustSummary: {
        totalRankedRuns: sourceBoard.total,
        settledRuns: sourceBoard.rows.filter((row) => row.trust?.verdict === 'settled' || row.settlementTxHash).length,
        flaggedRuns: sourceBoard.rows.filter((row) => ['suspicious', 'rejected'].includes(row.trust?.verdict)).length,
        prototypeRuns: sourceBoard.rows.filter((row) => row.trust?.verdict === 'prototype').length,
      },
    };
    const scoreSourceSummary = summarizeVisibleLeaderboardProvenance(
      active.topEntries,
      state.profiles,
      active.total,
    );
    const { houseScoreCount, officialCount: officialScoreCount } = scoreSourceSummary;
    const activeLeaderboardCabinet = leaderboardGameFilters.find((cabinet) => cabinet.gameId === routeState.gameId);
    const activeLeaderboardTitle = activeLeaderboardCabinet?.title ?? getGame(routeState.gameId).title;
    const timeWindow = describeLeaderboardWindow(active.cadence ?? routeState.cadence, active.periodKey);
    const sourceTab = LEADERBOARD_SOURCE_TABS.find((tab) => tab.id === routeState.source) ?? LEADERBOARD_SOURCE_TABS[0];
    syncGameLocation(routeState.gameId);

    // =======================================================================
    // Command panel: game banners + filters
    // =======================================================================
    const filterPanel = el('section', { className: 'official-info-card leaderboard-filter-panel leaderboard-filter-shell leaderboard-command-v10' });
    filterPanel.setAttribute('aria-label', 'Leaderboard filters');
    const filterHead = el('div', { className: 'leaderboard-filter-head' });
    const filterCopy = el('div', { className: 'leaderboard-filter-copy' });
    appendText(filterCopy, 'span', 'Leaderboard Filters', 'cabinet-status-label');
    appendText(filterCopy, 'strong', leaderboardGameFilters.length > 1 ? 'Pick a cabinet, then a score window' : 'Pick a score window');
    appendText(filterCopy, 'small', `${humanList(playableCabinetNames())} ${leaderboardGameFilters.length === 1 ? 'has a public board' : 'have public boards'}. Daily, weekly, monthly, yearly, and all-time are time windows on the same standing.`);
    filterHead.append(filterCopy);
    filterPanel.append(filterHead);

    // --- Game banners (tablist; arrow keys move, Enter/Space selects) -------
    const gameGroup = el('div', { className: 'leaderboard-filter-group leaderboard-game-filter leaderboard-game-banner-group' });
    appendText(gameGroup, 'span', 'Game', 'leaderboard-filter-label');
    const gameBar = el('div', { className: 'leaderboard-game-tabs leaderboard-filter-buttons leaderboard-game-banners', role: 'tablist' });
    gameBar.setAttribute('aria-label', 'Choose a game leaderboard');
    const bannerButtons = [];
    for (const cabinet of leaderboardGameFilters) {
      const isActive = cabinet.gameId === routeState.gameId;
      const banner = leaderboardBannerFor(cabinet.gameId, cabinet);
      let standing;
      if (isActive) {
        standing = { total: active.total, topScore: active.topEntries[0]?.score ?? null };
      } else {
        const { board: otherBoard } = buildStanding(cabinet.gameId, sourceForGame(cabinet.gameId));
        standing = { total: otherBoard.total, topScore: otherBoard.rows[0]?.score ?? null };
      }
      const tab = el('button', {
        className: `pixel-button leaderboard-game-tab leaderboard-game-filter leaderboard-filter-button leaderboard-game-banner${isActive ? ' is-active' : ''}`,
        type: 'button',
        role: 'tab',
      });
      tab.dataset.game = cabinet.gameId;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
      tab.setAttribute('aria-label', `${banner.title} leaderboard${isActive ? ', selected' : ''}`);
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
      appendText(copy, 'span', standing.total > 0
        ? `${standing.total.toLocaleString()} player${standing.total === 1 ? '' : 's'} · top ${Number(standing.topScore ?? 0).toLocaleString()}`
        : `No scores yet · ${timeWindow.label.toLowerCase()}`, 'leaderboard-game-banner-meta');
      tab.append(copy);
      appendText(tab, 'span', isActive ? 'Viewing' : 'View board', 'leaderboard-game-banner-state');
      tab.addEventListener('click', () => {
        if (routeState.gameId === cabinet.gameId) return;
        routeState.gameId = cabinet.gameId;
        routeState.source = sourceForGame(cabinet.gameId);
        routeState.search = '';
        routeState.sortKey = 'score';
        routeState.sortDir = 'desc';
        resetView();
        // Write the URL/preference first so the re-render resolves the new game
        // instead of the stale ?game= query.
        syncGameLocation(cabinet.gameId);
        rerender(`.leaderboard-game-banner[data-game="${cabinet.gameId}"]`);
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

    // --- Time window + source + search/sort ---------------------------------
    const filterGrid = el('div', { className: 'leaderboard-filter-grid leaderboard-filter-grid-v10' });

    const timeGroup = el('div', { className: 'leaderboard-filter-group leaderboard-time-filter' });
    appendText(timeGroup, 'span', 'Time window', 'leaderboard-filter-label');
    const tabBar = el('div', { className: 'leaderboard-cadence-tabs leaderboard-filter-buttons', role: 'group' });
    tabBar.setAttribute('aria-label', 'Time window');
    for (const cadenceBoard of getAllCadenceLeaderboards(state, routeState.gameId, { wallet: connectedWallet, displayNameFor })) {
      const isActive = cadenceBoard.cadence === routeState.cadence;
      const tab = el('button', {
        className: `pixel-button leaderboard-cadence-tab leaderboard-time-filter leaderboard-filter-button${isActive ? ' is-active' : ''}`,
        textContent: cadenceBoard.cadence.replace('-', ' ').toUpperCase(),
        type: 'button',
      });
      tab.dataset.cadence = cadenceBoard.cadence;
      tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      tab.addEventListener('click', () => {
        if (routeState.cadence === cadenceBoard.cadence) return;
        routeState.cadence = cadenceBoard.cadence;
        resetView();
        rerender(`.leaderboard-cadence-tab[data-cadence="${cadenceBoard.cadence}"]`);
      });
      tabBar.append(tab);
    }
    timeGroup.append(tabBar);

    const sourceGroup = el('div', { className: 'leaderboard-filter-group leaderboard-source-filter' });
    appendText(sourceGroup, 'span', 'Standing', 'leaderboard-filter-label');
    const sourceBar = el('div', { className: 'leaderboard-source-tabs leaderboard-filter-buttons', role: 'group' });
    sourceBar.setAttribute('aria-label', 'Score source');
    for (const source of LEADERBOARD_SOURCE_TABS) {
      const isActive = source.id === routeState.source;
      const tab = el('button', {
        className: `pixel-button leaderboard-filter-button leaderboard-source-tab${isActive ? ' is-active' : ''}`,
        type: 'button',
      });
      tab.dataset.source = source.id;
      appendText(tab, 'span', source.label, 'leaderboard-game-tab-title');
      tab.title = source.copy;
      tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      tab.addEventListener('click', () => {
        if (routeState.source === source.id) return;
        routeState.source = source.id;
        routeState.search = '';
        routeState.sortKey = 'score';
        routeState.sortDir = 'desc';
        resetView();
        rerender(`.leaderboard-source-tab[data-source="${source.id}"]`);
      });
      sourceBar.append(tab);
    }
    sourceGroup.append(sourceBar);

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

    filterGrid.append(timeGroup, sourceGroup, findGroup);
    filterPanel.append(filterGrid);

    const filterSummary = el('p', { className: 'leaderboard-filter-summary leaderboard-filter-summary-v10' });
    filterSummary.setAttribute('role', 'status');
    filterSummary.setAttribute('aria-live', 'polite');
    appendText(filterSummary, 'span', activeLeaderboardTitle, 'leaderboard-filter-summary-game');
    appendText(filterSummary, 'strong', `${timeWindow.label}${timeWindow.detail ? ` (${timeWindow.detail})` : ''} · ${sourceBoard.label}`);
    appendText(filterSummary, 'small', scoreSourceSummary.label);
    filterPanel.append(filterSummary);
    dom.officialCabinetGrid.append(filterPanel);

    // =======================================================================
    // Board card
    // =======================================================================
    const board = el('article', { className: `official-info-card leaderboard-board-card leaderboard-board-v9 leaderboard-board-v10 leaderboard-board-${routeState.gameId} hmh-visual-polish-v12` });
    board.dataset.game = routeState.gameId;
    board.setAttribute('aria-label', `${activeLeaderboardTitle} leaderboard`);
    const header = el('div', { className: 'leaderboard-header leaderboard-header-v9' });
    const headerCopy = el('div', { className: 'leaderboard-header-copy' });
    const leaderboardTitle = el('h3', { className: 'leaderboard-title' });
    leaderboardTitle.append(renderArcadeIcon('trophy'), documentRef.createTextNode(activeLeaderboardTitle.toUpperCase()));
    headerCopy.append(leaderboardTitle);
    appendText(headerCopy, 'span', `${timeWindow.tab}${timeWindow.detail ? ` · ${timeWindow.detail}` : ''} · ${sourceBoard.label} · ${scoreSourceSummary.label}`, 'cabinet-status-label');
    appendText(headerCopy, 'small', sourceTab.copy, 'leaderboard-source-copy');
    const headerStats = el('div', { className: 'leaderboard-header-stats' });
    const topScore = active.topEntries[0]?.score ?? 0;
    for (const [label, value, tone] of [
      ['Top Score', topScore.toLocaleString(), 'score'],
      ['Official shown', officialScoreCount.toLocaleString(), 'official'],
      ['House shown', houseScoreCount.toLocaleString(), 'house'],
      ['Review', `${active.trustSummary.flaggedRuns} flagged`, active.trustSummary.flaggedRuns > 0 ? 'warn' : 'muted'],
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
      appendText(you, 'small', 'You have no ranked score in this period yet. Play Ranked and submit at game over.', 'leaderboard-you-detail');
    } else {
      appendText(you, 'small', 'Connect a wallet to see your placement highlighted on this board.', 'leaderboard-you-detail');
    }
    board.append(you);

    // --- Empty standing ------------------------------------------------------
    if (active.topEntries.length === 0) {
      const empty = leaderboardEmptyState({ gameId: routeState.gameId, source: routeState.source, gameTitle: activeLeaderboardTitle });
      const emptyCard = el('div', { className: 'leaderboard-empty-state' });
      appendText(emptyCard, 'small', empty.title, 'leaderboard-empty-title');
      appendText(emptyCard, 'span', empty.copy, 'leaderboard-empty-copy');
      if (empty.action === 'show-local' && routeState.source !== 'local') {
        const showLocal = el('button', { className: 'pixel-button leaderboard-empty-action', type: 'button', textContent: 'Show Local Preview' });
        showLocal.addEventListener('click', () => {
          routeState.source = 'local';
          resetView();
          rerender('.leaderboard-source-tab[data-source="local"]');
        });
        emptyCard.append(showLocal);
      }
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
        const provenance = leaderboardEntryProvenance(entry, state.profiles?.[wallet]);
        if (!provenance.official) appendText(col, 'span', provenance.label, 'podium-provenance');
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
      const empty = leaderboardEmptyState({ gameId: routeState.gameId, source: routeState.source, search: routeState.search });
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
    const now = Date.now();
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
          if (provenance.official) appendText(nameMeta, 'span', '⛓ ON-CHAIN', 'lt-settled');
          else appendText(nameMeta, 'span', provenance.label, 'lt-house-score');
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
          const trustBadge = el('span', { className: `lt-trust lt-trust-${entry.trust?.tone ?? 'muted'}` });
          trustBadge.textContent = provenance.official ? (entry.trust?.label ?? 'Pending') : provenance.label.replace('HOUSE SCORE', 'House Score');
          if (entry.trust?.flags?.length) {
            trustBadge.title = entry.trust.flags.map((flag) => `${flag.code ?? 'flag'}: ${flag.detail ?? flag.severity ?? ''}`).join(' | ');
          }
          appendText(cell, 'span', 'Source', 'lt-cell-label');
          cell.append(trustBadge);
        } else if (column.kind === 'posted') {
          appendText(cell, 'span', 'Posted', 'lt-cell-label');
          const posted = appendText(cell, 'span', formatPostedDate(entry.recordedAt, now), 'lt-date');
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

  return Object.freeze({ renderLeaderboards: renderOfficialLeaderboards });
}
