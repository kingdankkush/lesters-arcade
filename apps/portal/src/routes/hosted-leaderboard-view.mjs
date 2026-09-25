// The hosted Scores page (HOSTED_PROFILE_SYNC; guide §3.5, §5.8, contract
// §4.3.5): Weekly, Monthly and All-time boards from GET /api/leaderboard, 25
// rows a page, server-side search, jump to my rank and a verified transaction
// link per row. official-leaderboard-route.mjs loads this module on demand
// only when the portal is hosted, so preview visitors never download it
// (contract §11 rule 5). Rendering is synchronous; hydrate() fetches and
// renders again.

import { arcadeAvatarForUri } from '../arcade-avatars.mjs';
import { renderKeepingFocus } from '../focus-keeper.mjs';
import {
  HOSTED_LEADERBOARD_NOTICE,
  HOSTED_LEADERBOARD_PAGE_SIZE,
  LEADERBOARD_SEARCH_DEBOUNCE_MS,
  formatPostedDate,
  formatResetCountdown,
  hostedLeaderboardEntry,
  hostedLeaderboardPeriod,
  hostedLeaderboardStatusCopy,
  hostedPageForRank,
  leaderboardColumnsFor,
  leaderboardEmptyState,
  leaderboardPeriodTab,
  leaderboardPeriodTabs,
} from '../leaderboard-view.mjs';

// A loaded board is re-read on the next visit once it is this old, once its
// period has reset (resetsAt), or when a Ranked run or a published saved run
// marks it stale (markStale).
export const HOSTED_BOARD_TTL_MS = 60_000;

export function createHostedLeaderboardView({
  appendText,
  clearTimeoutImpl = (id) => globalThis.clearTimeout(id),
  documentRef = globalThis.document,
  dom,
  el,
  getContext,
  getGame,
  humanList,
  indexApi = null,
  isActive = () => true,
  now = () => Date.now(),
  playableCabinetNames,
  playRanked = null,
  renderArcadeIcon,
  renderAvatarChip,
  renderFilterPanel,
  renderPage,
  rerender,
  routeState,
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  viewProfile = null,
} = {}) {
  // Boards, keyed by game, period, search and viewer.
  const hostedBoards = new Map();
  let searchTimer = null;

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

  // Renders that rebuild the board keep keyboard focus on the control that had
  // it (the search box while its results arrive, a period or cabinet tab).
  // When it is gone, focus lands on a stable target: Try again once it is
  // back, else the state card (Loading…, empty), else the row count (Show
  // more ran out, Back to the top left with page 1).
  function keepingFocus(render) {
    return renderKeepingFocus(dom.officialCabinetGrid, render, { documentRef, fallback: ['.leaderboard-retry', '.leaderboard-empty-state', '.leaderboard-table-count'] });
  }

  function rerenderIfShown() {
    if (isActive()) keepingFocus(renderPage);
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
    if (!indexApi?.leaderboard) return board;
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
    for (const board of hostedBoards.values()) {
      if (!gameId || board.gameId === gameId) board.stale = true;
    }
    if (isActive()) void hydrate();
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
    card.setAttribute('tabindex', '-1');
    appendText(card, 'strong', copy.title, 'leaderboard-empty-title');
    appendText(card, 'span', copy.copy, 'leaderboard-empty-copy');
    if (copy.action === 'retry' && onRetry) {
      const retry = el('button', { className: 'pixel-button leaderboard-empty-action leaderboard-retry', type: 'button', textContent: 'Try again' });
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
      appendText(you, 'small', 'Sign in with a wallet to see your placement highlighted on this board.', 'leaderboard-you-detail');
    }
    card.append(you);

    // --- Loading, failure and empty states -----------------------------------
    const statusCopy = board.rows.length === 0 ? hostedLeaderboardStatusCopy(board.status === 'idle' ? 'loading' : board.status) : null;
    if (statusCopy) {
      renderStateCard(card, statusCopy, { onRetry: () => { board.status = 'idle'; keepingFocus(() => rerender()); void hydrate(); } });
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
    const count = appendText(footer, 'span', spec.q
      ? `Showing ${board.rows.length} of ${board.total.toLocaleString()} matching player${board.total === 1 ? '' : 's'}`
      : `Showing ranks ${firstRank}–${lastRank} of ${board.total.toLocaleString()} player${board.total === 1 ? '' : 's'}`, 'leaderboard-table-count');
    count.setAttribute('tabindex', '-1');
    if (board.nextPage) {
      const shown = (board.firstPage - 1) * board.pageSize + board.rows.length;
      const remaining = Math.max(1, Math.min(board.pageSize, board.total - shown));
      const label = board.loadingMore ? 'Loading…' : board.moreFailed ? 'Could not load more. Try again' : `Show ${remaining} more`;
      const more = el('button', { className: 'pixel-button leaderboard-show-more', type: 'button', textContent: label });
      // aria-disabled, not disabled: a disabled button cannot hold focus, so
      // a keyboard press would drop focus to the page while the page loads.
      more.setAttribute('aria-disabled', board.loadingMore ? 'true' : 'false');
      more.addEventListener('click', () => {
        if (board.loadingMore || !board.nextPage) return;
        // The last page removes the button: keepingFocus hands focus to the
        // row count ("Showing ranks 1–30 of 30") instead of the page.
        void loadHostedPage(board, board.nextPage);
        keepingFocus(() => rerender());
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

  return Object.freeze({ render: renderHostedLeaderboard, hydrate, invalidate, markStale });
}
