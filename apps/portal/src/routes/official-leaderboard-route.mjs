import { LEADERBOARD_SOURCE_TABS, filterLeaderboardEntriesBySource } from '../leaderboard-seed.mjs';

export function createOfficialLeaderboardRoute({
  appendText,
  buildLeaderboardExperienceV2Model,
  documentRef = globalThis.document,
  dom,
  el,
  formatSurvive,
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
  summarizeVisibleLeaderboardProvenance,
} = {}) {
  function renderOfficialLeaderboards() {
    const { connectedWallet, state } = getContext();
    dom.officialCabinetGrid.replaceChildren();
    const displayNameFor = (wallet) => resolveDisplayName(state.profiles?.[wallet], wallet);

    // --- Filter bar ----------------------------------------------------------
    // Games and time windows are filters for ONE primary leaderboard, not separate
    // page cards. Keep them compact above the board so the ranked table remains
    // the focus of the page.
    const leaderboardGameFilters = publicLeaderboardCabinets();
    if (!leaderboardGameFilters.some((cabinet) => cabinet.gameId === routeState.gameId)) {
      routeState.gameId = leaderboardGameFilters[0]?.gameId ?? 'lester-blaster';
    }

    routeState.source ??= 'official';
    const unfiltered = buildLeaderboardExperienceV2Model(state, {
      gameId: routeState.gameId,
      cadence: routeState.cadence,
      wallet: connectedWallet,
      displayNameFor,
      // Filter provenance before truncating. The public seed board currently
      // occupies the first 50 aggregate rows; limiting first would hide every
      // legitimate score ranked below the demo data.
      limit: 5000,
    });
    const sourceBoard = filterLeaderboardEntriesBySource(unfiltered.topEntries, state.profiles, routeState.source);
    routeState.source = sourceBoard.source;
    const active = {
      ...unfiltered,
      total: sourceBoard.total,
      topEntries: sourceBoard.rows.slice(0, 50),
      rows: sourceBoard.rows.slice(0, 50),
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

    const filterPanel = el('section', { className: 'official-info-card leaderboard-filter-panel leaderboard-filter-shell' });
    const filterHead = el('div', { className: 'leaderboard-filter-head' });
    const filterCopy = el('div', { className: 'leaderboard-filter-copy' });
    appendText(filterCopy, 'span', 'Leaderboard Filters', 'cabinet-status-label');
    appendText(filterCopy, 'strong', leaderboardGameFilters.length > 1 ? 'Choose a game and score window' : 'Choose a score window');
    appendText(filterCopy, 'small', `${humanList(playableCabinetNames())} ${leaderboardGameFilters.length === 1 ? 'is the current public score filter' : 'are the current public score filters'}. Daily, weekly, monthly, yearly, and all-time are time filters for the same ranked board below.`);
    const filterSummary = el('div', { className: 'leaderboard-filter-summary' });
    appendText(filterSummary, 'span', activeLeaderboardTitle, 'leaderboard-filter-summary-game');
    appendText(filterSummary, 'strong', `${sourceBoard.label} · ${scoreSourceSummary.label}`);
    appendText(filterSummary, 'small', routeState.cadence.replace('-', ' ').toUpperCase());
    filterHead.append(filterCopy, filterSummary);
    filterPanel.append(filterHead);

    const filterGrid = el('div', { className: 'leaderboard-filter-grid' });
    const gameGroup = el('div', { className: 'leaderboard-filter-group leaderboard-game-filter' });
    appendText(gameGroup, 'span', 'Game', 'leaderboard-filter-label');
    const gameBar = el('div', { className: 'leaderboard-game-tabs leaderboard-filter-buttons' });
    for (const cabinet of leaderboardGameFilters) {
      const isActive = cabinet.gameId === routeState.gameId;
      const tab = el('button', {
        className: `pixel-button leaderboard-game-tab leaderboard-game-filter leaderboard-filter-button${isActive ? ' is-active' : ''}`,
        type: 'button',
      });
      appendText(tab, 'span', cabinet.title, 'leaderboard-game-tab-title');
      tab.addEventListener('click', () => {
        if (routeState.gameId === cabinet.gameId) return;
        routeState.gameId = cabinet.gameId;
        routeState.search = '';
        routeState.sortKey = 'score';
        routeState.sortDir = 'desc';
        renderOfficialLeaderboards();
      });
      gameBar.append(tab);
    }
    gameGroup.append(gameBar);

    const timeGroup = el('div', { className: 'leaderboard-filter-group leaderboard-time-filter' });
    appendText(timeGroup, 'span', 'Time', 'leaderboard-filter-label');
    const tabBar = el('div', { className: 'leaderboard-cadence-tabs leaderboard-filter-buttons' });
    for (const board of getAllCadenceLeaderboards(state, routeState.gameId, { wallet: connectedWallet, displayNameFor })) {
      const tab = el('button', {
        className: `pixel-button leaderboard-cadence-tab leaderboard-time-filter leaderboard-filter-button${board.cadence === routeState.cadence ? ' is-active' : ''}`,
        textContent: board.cadence.replace('-', ' ').toUpperCase(),
        type: 'button',
      });
      tab.dataset.cadence = board.cadence;
      tab.addEventListener('click', () => {
        routeState.cadence = board.cadence;
        renderOfficialLeaderboards();
      });
      tabBar.append(tab);
    }
    timeGroup.append(tabBar);

    const sourceGroup = el('div', { className: 'leaderboard-filter-group leaderboard-source-filter' });
    appendText(sourceGroup, 'span', 'Source', 'leaderboard-filter-label');
    const sourceBar = el('div', { className: 'leaderboard-source-tabs leaderboard-filter-buttons' });
    for (const source of LEADERBOARD_SOURCE_TABS) {
      const tab = el('button', {
        className: `pixel-button leaderboard-filter-button leaderboard-source-tab${source.id === routeState.source ? ' is-active' : ''}`,
        type: 'button',
      });
      appendText(tab, 'span', source.label, 'leaderboard-game-tab-title');
      tab.title = source.copy;
      tab.addEventListener('click', () => {
        if (routeState.source === source.id) return;
        routeState.source = source.id;
        routeState.search = '';
        routeState.sortKey = 'score';
        routeState.sortDir = 'desc';
        renderOfficialLeaderboards();
      });
      sourceBar.append(tab);
    }
    sourceGroup.append(sourceBar);
    filterGrid.append(gameGroup, timeGroup, sourceGroup);
    filterPanel.append(filterGrid);
    dom.officialCabinetGrid.append(filterPanel);

    const board = el('article', { className: 'official-info-card leaderboard-board-card leaderboard-board-v9 hmh-visual-polish-v12' });
    const header = el('div', { className: 'leaderboard-header leaderboard-header-v9' });
    const headerCopy = el('div', { className: 'leaderboard-header-copy' });
    const leaderboardTitle = el('h3', { className: 'leaderboard-title' });
    leaderboardTitle.append(renderArcadeIcon('trophy'), documentRef.createTextNode(activeLeaderboardTitle.toUpperCase()));
    headerCopy.append(leaderboardTitle);
    appendText(headerCopy, 'span', `${active.cadence.toUpperCase()} · ${active.periodKey} · ${sourceBoard.label} · ${scoreSourceSummary.label}`, 'cabinet-status-label');
    const headerStats = el('div', { className: 'leaderboard-header-stats' });
    const topScore = active.topEntries[0]?.score ?? 0;
    for (const [label, value] of [
      ['Top Score', topScore.toLocaleString()],
      ['Official shown', officialScoreCount.toLocaleString()],
      ['House shown', houseScoreCount.toLocaleString()],
      ['Review', `${active.trustSummary.flaggedRuns} flagged`],
      ['You', connectedWallet && active.playerRank ? `#${active.playerRank}` : 'Unranked'],
    ]) {
      const stat = el('div', { className: 'leaderboard-header-stat' });
      appendText(stat, 'span', label);
      appendText(stat, 'strong', value);
      headerStats.append(stat);
    }
    header.append(headerCopy, headerStats);
    board.append(header);

    if (active.topEntries.length === 0) {
      appendText(board, 'small', routeState.source === 'demo'
        ? 'No synthetic house scores are available for this period.'
        : routeState.source === 'local'
          ? 'No unpublished local ranked scores are available in this period.'
          : 'No verified ranked scores in this period yet. Play Ranked and publish a settled score to claim the top spot.');
      dom.officialCabinetGrid.append(board);
      return;
    }

    // --- Podium for the top 3 (medals + avatars + glow) — always by score ---
    const podiumEntries = active.topEntries.slice(0, 3);
    if (podiumEntries.length >= 1) {
      const podium = el('div', { className: 'leaderboard-podium' });
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

    // --- Search + sort controls --------------------------------------------
    const controls = el('div', { className: 'leaderboard-controls' });
    const searchInput = el('input', { className: 'leaderboard-search', type: 'search' });
    searchInput.placeholder = 'Search display name…';
    searchInput.value = routeState.search;
    searchInput.setAttribute('aria-label', 'Search leaderboard by display name');
    searchInput.addEventListener('input', () => {
      routeState.search = searchInput.value;
      renderOfficialLeaderboards();
      // keep focus + caret after re-render
      const next = documentRef.querySelector('.leaderboard-search');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });
    controls.append(searchInput);
    const resetButton = el('button', { className: 'pixel-button leaderboard-reset-button', type: 'button', textContent: 'Reset' });
    resetButton.disabled = !routeState.search && routeState.sortKey === 'score' && routeState.sortDir === 'desc';
    resetButton.addEventListener('click', () => {
      routeState.search = '';
      routeState.sortKey = 'score';
      routeState.sortDir = 'desc';
      renderOfficialLeaderboards();
    });
    controls.append(resetButton);
    board.append(controls);

    // --- Sortable, searchable Top-50 table ---------------------------------
    // Each row keeps its TRUE rank-by-score (the leaderboard standing); sorting/
    // searching only changes the display order/visibility, not the rank number.
    const ranked = active.topEntries.map((e) => ({ ...e, trueRank: e.rank }));
    const term = routeState.search.trim().toLowerCase();
    let rows = term ? ranked.filter((e) => (e.displayName || '').toLowerCase().includes(term)) : ranked.slice();
    const dir = routeState.sortDir === 'asc' ? 1 : -1;
    const getVal = (e, key) => {
      switch (key) {
        case 'name': return (e.displayName || '').toLowerCase();
        case 'date': return e.recordedAt || '';
        case 'kills': return e.runStats?.kills ?? 0;
        case 'survive': return e.runStats?.surviveSeconds ?? e.runStats?.elapsedSeconds ?? 0;
        case 'level': return e.runStats?.level ?? 0;
        case 'combo': return e.runStats?.maxCombo ?? 0;
        case 'powerups': return (e.runStats?.collectedPowerUps?.length ?? e.runStats?.powerUpsCollected ?? 0);
        default: return e.score;
      }
    };
    rows.sort((a, b) => {
      const va = getVal(a, routeState.sortKey);
      const vb = getVal(b, routeState.sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return a.trueRank - b.trueRank;
    });

    const table = el('div', { className: 'leaderboard-table', role: 'table' });
    const headRow = el('div', { className: 'leaderboard-table-head', role: 'row' });
    const cols = [
      ['rank', '#', 'rank'],
      ['name', 'DISPLAY NAME', 'name'],
      ['score', 'SCORE', 'score'],
      ['kills', 'KILLS', 'kills'],
      ['survive', 'SURVIVED', 'survive'],
      ['level', 'LVL', 'level'],
      ['combo', 'COMBO', 'combo'],
      ['powerups', 'PWR', 'powerups'],
      ['trust', 'TRUST', 'trust'],
      ['detail', 'RUN', 'date'],
      ['date', 'POSTED', 'date'],
    ];
    for (const [key, label, sortKey] of cols) {
      const arrow = routeState.sortKey === sortKey ? (routeState.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const th = el('button', { className: `leaderboard-th th-${key}${routeState.sortKey === sortKey ? ' is-sorted' : ''}`, type: 'button', textContent: label + arrow });
      th.addEventListener('click', () => {
        if (routeState.sortKey === sortKey) {
          routeState.sortDir = routeState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          routeState.sortKey = sortKey;
          routeState.sortDir = sortKey === 'name' ? 'asc' : 'desc';
        }
        renderOfficialLeaderboards();
      });
      headRow.append(th);
    }
    table.append(headRow);

    const fmtDate = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (days <= 0) return 'today';
      if (days === 1) return 'yesterday';
      if (days < 30) return `${days}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    if (rows.length === 0) {
      appendText(table, 'div', `No display names match "${routeState.search}".`, 'leaderboard-empty');
    }
    for (const entry of rows) {
      const wallet = entry.wallet ?? entry.address ?? null;
      const medalClass = entry.trueRank === 1 ? ' rank-gold' : entry.trueRank === 2 ? ' rank-silver' : entry.trueRank === 3 ? ' rank-bronze' : '';
      const row = el('div', { className: `leaderboard-trow${entry.isCurrentPlayer ? ' is-current-player' : ''}${medalClass ? ' top-3' + medalClass : ''}`, role: 'row' });
      appendText(row, 'span', `#${entry.trueRank}`, `leaderboard-rank${medalClass}`);
      const nameCell = el('span', { className: 'lt-name' });
      nameCell.append(renderAvatarChip(wallet, entry.displayName, 'leaderboard-row-avatar'));
      appendText(nameCell, 'span', entry.displayName, 'lt-name-text');
      const provenance = leaderboardEntryProvenance(entry, state.profiles?.[wallet]);
      if (provenance.official) appendText(nameCell, 'span', '⛓ ON-CHAIN', 'lt-settled');
      else appendText(nameCell, 'span', provenance.label, 'lt-house-score');
      row.append(nameCell);
      appendText(row, 'strong', entry.score.toLocaleString(), 'lt-score');
      appendText(row, 'span', String(entry.runStats?.kills ?? '—'), 'lt-kills');
      appendText(row, 'span', formatSurvive(entry.runStats?.surviveSeconds ?? entry.runStats?.elapsedSeconds ?? 0), 'lt-survive');
      appendText(row, 'span', `L${entry.runStats?.level ?? 1}`, 'lt-level');
      appendText(row, 'span', `×${entry.runStats?.maxCombo ?? 0}`, 'lt-combo');
      appendText(row, 'span', String(entry.runStats?.collectedPowerUps?.length ?? entry.runStats?.powerUpsCollected ?? 0), 'lt-powerups');
      const trustBadge = el('span', { className: `lt-trust lt-trust-${entry.trust?.tone ?? 'muted'}` });
      trustBadge.textContent = provenance.official ? (entry.trust?.label ?? 'Pending') : provenance.label.replace('HOUSE SCORE', 'House Score');
      if (entry.trust?.flags?.length) {
        trustBadge.title = entry.trust.flags.map((flag) => `${flag.code ?? 'flag'}: ${flag.detail ?? flag.severity ?? ''}`).join(' | ');
      }
      row.append(trustBadge);
      if (entry.sessionDetail?.detailHref) {
        const detailLink = el('a', { className: 'lt-session-detail', href: entry.sessionDetail.detailHref, textContent: entry.sessionDetail.urlSessionId ?? 'Open run' });
        row.append(detailLink);
      } else {
        appendText(row, 'span', '—', 'lt-session-detail');
      }
      appendText(row, 'span', fmtDate(entry.recordedAt), 'lt-date');
      table.append(row);
    }
    board.append(table);

    // --- Sticky "your placement" card ---
    if (connectedWallet && active.playerEntry) {
      const you = el('div', { className: 'leaderboard-you-card' });
      you.append(renderAvatarChip(connectedWallet, active.playerEntry.displayName, 'leaderboard-row-avatar'));
      appendText(you, 'span', `YOUR RANK #${active.playerRank}`, 'leaderboard-you-rank');
      appendText(you, 'strong', `${active.playerEntry.score.toLocaleString()} pts`, 'leaderboard-you-score');
      appendText(you, 'small', `${active.playerEntry.runStats?.kills ?? 0} kills · ${formatSurvive(active.playerEntry.runStats?.surviveSeconds ?? active.playerEntry.runStats?.elapsedSeconds ?? 0)} survived`, 'leaderboard-you-detail');
      board.append(you);
    } else if (connectedWallet) {
      appendText(board, 'small', 'You have no ranked score in this period yet. Play Ranked and submit at game over.');
    }
    dom.officialCabinetGrid.append(board);
  }

  return Object.freeze({ renderLeaderboards: renderOfficialLeaderboards });
}
