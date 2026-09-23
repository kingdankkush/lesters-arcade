import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  HOSTED_LEADERBOARD_NOTICE,
  LEADERBOARD_DEVICE_LOCAL_NOTICE,
  LEADERBOARD_PREVIEW_LABEL,
  hostedLeaderboardStatusCopy,
  LEADERBOARD_GAME_BANNERS,
  LEADERBOARD_GAME_PREFERENCE_KEY,
  LEADERBOARD_PAGE_SIZE,
  STACKED_LOCAL_NOTICE,
  defaultSortDirFor,
  describeLeaderboardWindow,
  filterLeaderboardRows,
  formatPostedDate,
  hmhBossClearedFor,
  leaderboardBannerFor,
  leaderboardColumnsFor,
  leaderboardEmptyState,
  leaderboardGameIdForQuery,
  leaderboardScoresPath,
  leaderboardSortOptionsFor,
  matchesLeaderboardSearch,
  paginateLeaderboardRows,
  resolveLeaderboardGameId,
  runSecondsFor,
  sortLeaderboardRows,
  summarizeLeaderboardRun,
  visibleLimitForRank,
} from '../apps/portal/src/leaderboard-view.mjs';
import { LESTERS_ARCADE_V2_APP_SHELL } from '../apps/portal/src/arcade-core.mjs';
import { createOfficialLeaderboardRoute } from '../apps/portal/src/routes/official-leaderboard-route.mjs';

const CABINETS = [
  { gameId: 'lester-blaster', id: 'hard-money-heroes', title: 'Hard Money Heroes' },
  { gameId: 'chikun', id: 'chikun', title: "Chikun's Escape" },
  { gameId: 'stacked', id: 'stacked', title: 'STACKED' },
];

function row(rank, overrides = {}) {
  return { rank, trueRank: rank, score: 1000 - rank * 10, displayName: `Player${rank}`, wallet: `0x${String(rank).padStart(2, '0')}${'ab'.repeat(19)}`, recordedAt: `2026-09-${String(rank).padStart(2, '0')}T00:00:00.000Z`, runStats: { kills: rank * 3, surviveSeconds: 60 + rank, level: rank, maxCombo: rank * 2 }, ...overrides };
}

test('every public leaderboard cabinet has a banner that reuses shipped cabinet art', () => {
  const publicCabinets = LESTERS_ARCADE_V2_APP_SHELL.cabinets.filter((cabinet) => cabinet.playable && cabinet.leaderboardEligible !== false);
  assert.deepEqual(publicCabinets.map((cabinet) => cabinet.gameId), ['lester-blaster', 'chikun', 'stacked']);
  const polish = readFileSync(new URL('../apps/portal/styles-arcade-polish.css', import.meta.url), 'utf8');
  for (const cabinet of publicCabinets) {
    const banner = leaderboardBannerFor(cabinet.gameId, cabinet);
    assert.equal(banner.title, cabinet.title, `${cabinet.gameId} banner title matches the cabinet`);
    assert.ok(banner.art && banner.cabinet && banner.accent, `${cabinet.gameId} banner declares art, cabinet sprite and accent`);
    assert.ok(polish.includes(`[data-game="${cabinet.gameId}"] .leaderboard-game-banner-art { background-image: url("${banner.art}")`), `${cabinet.gameId} CSS uses the same art path as the module`);
    assert.ok(polish.includes(`.leaderboard-game-banner[data-game="${cabinet.gameId}"] { --lb-accent: ${banner.accent};`), `${cabinet.gameId} CSS accent matches the module`);
  }
  // Art assets exist on disk (the mode-select / cabinet browser already ship them).
  for (const banner of Object.values(LEADERBOARD_GAME_BANNERS)) {
    for (const asset of [banner.art, banner.cabinet]) {
      const path = new URL(`../apps/portal/${asset.replace(/^\.\//, '').split('?')[0]}`, import.meta.url);
      assert.doesNotThrow(() => readFileSync(path), `${asset} exists`);
    }
  }
  const fallback = leaderboardBannerFor('mystery', { id: 'mystery', title: 'Mystery' });
  assert.equal(fallback.title, 'Mystery');
  assert.equal(fallback.art, null);
});

test('per-game columns carry the key run stats the owner asked for', () => {
  const labels = (gameId) => leaderboardColumnsFor(gameId).map((column) => column.label);
  assert.deepEqual(labels('lester-blaster'), ['#', 'Player', 'Score', 'Kills', 'Time', 'Boss', 'Level', 'Combo', 'Source', 'Posted']);
  assert.deepEqual(labels('chikun'), ['#', 'Player', 'Score', 'Cleared', 'Near miss', 'Flight', 'Coins', 'Combo', 'Source', 'Posted']);
  assert.deepEqual(labels('stacked'), ['#', 'Player', 'Score', 'Lines', 'Level', 'Halvings', 'Combo', 'Time', 'Source', 'Posted']);
  assert.deepEqual(labels('unknown-game'), ['#', 'Player', 'Score', 'Time', 'Source', 'Posted']);
  for (const gameId of ['lester-blaster', 'chikun', 'stacked']) {
    assert.equal(leaderboardColumnsFor(gameId).length, 10, `${gameId} keeps a 10-column grid`);
  }
  const hmh = leaderboardColumnsFor('lester-blaster');
  const boss = hmh.find((column) => column.key === 'boss');
  assert.equal(boss.format({ runStats: { bossId: 'ledger-lich' } }), 'Cleared');
  assert.equal(boss.format({ runStats: { bossKills: 0 } }), '—');
  assert.equal(hmhBossClearedFor({ runStats: { bossKills: 2 } }), true);
  const time = hmh.find((column) => column.key === 'survive');
  assert.equal(time.format({ runStats: { elapsedSeconds: 125 } }), '2:05');
  assert.equal(runSecondsFor({ runStats: { survivalSeconds: 9 } }), 9);
  assert.equal(runSecondsFor({ runStats: { survivalTime: 4 } }), 4);
  const chikun = leaderboardColumnsFor('chikun');
  assert.equal(chikun.find((column) => column.key === 'obstacles').format({ runStats: { forksPassed: 12 } }), '12');
  assert.equal(chikun.find((column) => column.key === 'nearMisses').format({ runStats: {} }), '—');
  const stacked = leaderboardColumnsFor('stacked');
  assert.equal(stacked.find((column) => column.key === 'halvings').format({ runStats: { quadClears: 3 } }), '3');
  assert.equal(stacked.find((column) => column.key === 'level').format({ runStats: { level: 7 } }), 'L7');
  assert.equal(summarizeLeaderboardRun('chikun', { runStats: { forksPassed: 4, nearMisses: 1, survivalTime: 61, coinsCollected: 2, bestCombo: 3 } }), '4 cleared · 1 near miss · 1:01 flight · 2 coins · ×3 combo');
});

test('sort options cover score, date, survival and per-game stats with sensible default directions', () => {
  const keys = leaderboardSortOptionsFor('lester-blaster').map((option) => option.key);
  assert.deepEqual(keys, ['name', 'score', 'kills', 'survive', 'boss', 'level', 'combo', 'date']);
  assert.ok(leaderboardSortOptionsFor('chikun').some((option) => option.key === 'nearMisses'));
  assert.ok(leaderboardSortOptionsFor('stacked').some((option) => option.key === 'halvings'));
  assert.equal(defaultSortDirFor('name'), 'asc');
  assert.equal(defaultSortDirFor('score'), 'desc');
});

test('search matches display names and wallet prefixes without touching ranks', () => {
  const rows = [row(1, { displayName: 'TurboRogue', wallet: '0xabc123' }), row(2, { displayName: 'LedgerBandit', wallet: '0xdef456' })];
  assert.deepEqual(filterLeaderboardRows(rows, 'ledger').map((entry) => entry.trueRank), [2]);
  assert.deepEqual(filterLeaderboardRows(rows, '0xAB').map((entry) => entry.trueRank), [1]);
  assert.deepEqual(filterLeaderboardRows(rows, 'def4').map((entry) => entry.trueRank), [2]);
  assert.deepEqual(filterLeaderboardRows(rows, '   ').length, 2);
  assert.equal(matchesLeaderboardSearch({ displayName: 'x', wallet: '0xabc' }, 'z'), false);
  assert.equal(matchesLeaderboardSearch({ displayName: 'x', wallet: '0xabc' }, 'a'), false, 'a single bare hex character is too loose for wallet prefix matching');
});

test('sorting keeps the true rank and breaks ties by standing', () => {
  const rows = [row(1, { runStats: { kills: 5 } }), row(2, { runStats: { kills: 9 } }), row(3, { runStats: { kills: 9 } })];
  const byKills = sortLeaderboardRows(rows, { sortKey: 'kills', sortDir: 'desc', gameId: 'lester-blaster' });
  assert.deepEqual(byKills.map((entry) => entry.trueRank), [2, 3, 1]);
  const byName = sortLeaderboardRows(rows, { sortKey: 'name', sortDir: 'asc', gameId: 'lester-blaster' });
  assert.deepEqual(byName.map((entry) => entry.displayName), ['Player1', 'Player2', 'Player3']);
  const byDate = sortLeaderboardRows(rows, { sortKey: 'date', sortDir: 'desc', gameId: 'lester-blaster' });
  assert.deepEqual(byDate.map((entry) => entry.trueRank), [3, 2, 1]);
  const unknownKey = sortLeaderboardRows(rows, { sortKey: 'nope', sortDir: 'desc', gameId: 'lester-blaster' });
  assert.deepEqual(unknownKey.map((entry) => entry.trueRank), [1, 2, 3], 'unknown keys fall back to score');
  assert.deepEqual(rows.map((entry) => entry.trueRank), [1, 2, 3], 'input is not mutated');
});

test('pagination shows ten at a time and can reveal a specific rank', () => {
  const rows = Array.from({ length: 27 }, (_, index) => row(index + 1));
  const first = paginateLeaderboardRows(rows);
  assert.equal(first.shown, LEADERBOARD_PAGE_SIZE);
  assert.equal(first.hiddenCount, 17);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextLimit, 20);
  const last = paginateLeaderboardRows(rows, 20);
  assert.equal(last.nextLimit, 27);
  assert.equal(paginateLeaderboardRows(rows, 27).hasMore, false);
  assert.equal(paginateLeaderboardRows([], 10).total, 0);
  assert.equal(visibleLimitForRank(1), 10);
  assert.equal(visibleLimitForRank(10), 10);
  assert.equal(visibleLimitForRank(11), 20);
  assert.equal(visibleLimitForRank(37), 40);
});

test('game selection resolves URL query, then session choice, then stored preference', () => {
  assert.equal(leaderboardGameIdForQuery('hard-money-heroes', CABINETS), 'lester-blaster');
  assert.equal(leaderboardGameIdForQuery('STACKED', CABINETS), 'stacked');
  assert.equal(leaderboardGameIdForQuery('mweb-invaders', CABINETS), null, 'non-public cabinets are ignored');
  assert.equal(resolveLeaderboardGameId({ search: '?game=chikun', stored: 'stacked', current: 'lester-blaster', cabinets: CABINETS }), 'chikun');
  assert.equal(resolveLeaderboardGameId({ search: '?game=bogus', stored: 'stacked', current: 'lester-blaster', cabinets: CABINETS }), 'stacked', 'stored preference wins before a session choice exists');
  assert.equal(resolveLeaderboardGameId({ search: '', stored: 'stacked', current: 'chikun', settled: true, cabinets: CABINETS }), 'chikun', 'an in-session choice beats the stored preference');
  assert.equal(resolveLeaderboardGameId({ search: '', stored: null, current: 'nope', cabinets: CABINETS }), 'lester-blaster');
  assert.equal(resolveLeaderboardGameId({ cabinets: [] }), 'lester-blaster');
  assert.equal(leaderboardScoresPath('chikun'), '/scores?game=chikun');
  assert.equal(leaderboardScoresPath('lester-blaster', '/leaderboards'), '/leaderboards?game=hard-money-heroes');
  assert.equal(leaderboardScoresPath('stacked', '/profile'), '/scores?game=stacked');
  assert.equal(LEADERBOARD_GAME_PREFERENCE_KEY, 'lesters-arcade-scores-game-v1');
});

test('window labels and empty states describe hosted and preview boards truthfully', () => {
  assert.deepEqual(describeLeaderboardWindow('weekly', '2026-W38'), { cadence: 'weekly', label: 'This week', tab: 'WEEKLY', detail: '2026-W38' });
  assert.equal(describeLeaderboardWindow('all-time', 'all-time').detail, '');
  // Preview (A22): this device only, labelled as such.
  assert.equal(LEADERBOARD_PREVIEW_LABEL, 'Preview · this device');
  assert.match(LEADERBOARD_DEVICE_LOCAL_NOTICE, /device-local preview/i);
  assert.match(LEADERBOARD_DEVICE_LOCAL_NOTICE, /wiped per game/i);
  assert.match(LEADERBOARD_DEVICE_LOCAL_NOTICE, /reset is at mainnet/i);
  assert.match(STACKED_LOCAL_NOTICE, /No fees, prizes or online ranking/);
  const preview = leaderboardEmptyState({ hosted: false, gameTitle: "Chikun's Escape" });
  assert.equal(preview.title, 'No unpublished local ranked scores are available in this period.');
  assert.equal(preview.copy, "Finish a Ranked run in Chikun's Escape on this device to place here.");
  assert.equal(preview.action, null, 'preview has no source tab to switch to');
  // Hosted: verified rows only, with an inviting empty board per period (guide §5.8).
  assert.match(HOSTED_LEADERBOARD_NOTICE, /Verified Ranked runs published on LitVM/);
  assert.match(HOSTED_LEADERBOARD_NOTICE, /ties go to whoever got there first/);
  assert.equal(leaderboardEmptyState({ hosted: true }).title, 'Be the first on this week’s board');
  assert.equal(leaderboardEmptyState({ hosted: true, period: 'monthly' }).title, 'Be the first on this month’s board');
  assert.equal(leaderboardEmptyState({ hosted: true, period: 'all-time' }).title, 'Be the first on the all-time board');
  assert.equal(leaderboardEmptyState({ hosted: true, gameTitle: 'STACKED' }).action, 'play-ranked', 'STACKED gets the same inviting state as every game');
  for (const hosted of [true, false]) {
    const text = JSON.stringify(leaderboardEmptyState({ hosted }));
    assert.doesNotMatch(text, /House|Local Preview|Switch to|NFT/i);
  }
  assert.equal(hostedLeaderboardStatusCopy('loading').title, 'Loading verified scores…');
  assert.equal(hostedLeaderboardStatusCopy('offline').action, 'retry');
  assert.equal(hostedLeaderboardStatusCopy('error').title, 'Scores are unavailable right now.');
  assert.equal(hostedLeaderboardStatusCopy('ready'), null);
  const searchEmpty = leaderboardEmptyState({ hosted: false, search: ' zed ' });
  assert.equal(searchEmpty.kind, 'search');
  assert.equal(searchEmpty.title, 'No players match "zed".');
  assert.match(leaderboardEmptyState({ hosted: true, search: 'zed' }).copy, /at least four characters/);
  assert.equal(formatPostedDate('nope'), '—');
  assert.equal(formatPostedDate('2026-09-16T00:00:00.000Z', Date.parse('2026-09-16T12:00:00.000Z')), 'today');
  assert.equal(formatPostedDate('2026-09-15T00:00:00.000Z', Date.parse('2026-09-16T12:00:00.000Z')), 'yesterday');
  assert.equal(formatPostedDate('2026-09-10T00:00:00.000Z', Date.parse('2026-09-16T12:00:00.000Z')), '6d ago');
});

// ---------------------------------------------------------------------------
// Route integration with a small DOM double
// ---------------------------------------------------------------------------

function node(tag = 'div', props = {}) {
  return {
    tag,
    children: [],
    dataset: {},
    attributes: {},
    listeners: {},
    ...props,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    contains() { return false; },
  };
}

function walk(root, visit) {
  visit(root);
  for (const child of root.children ?? []) walk(child, visit);
}

function find(root, predicate) {
  const hits = [];
  walk(root, (candidate) => { if (predicate(candidate)) hits.push(candidate); });
  return hits;
}

function text(root) {
  const parts = [];
  walk(root, (candidate) => { if (candidate.textContent) parts.push(candidate.textContent); if (candidate.text) parts.push(candidate.text); });
  return parts.join(' ');
}

function makeRoute({ entries, connectedWallet = null, routeState, windowRef, storage, cabinets = CABINETS } = {}) {
  const grid = node('grid');
  const calls = [];
  const route = createOfficialLeaderboardRoute({
    dom: { officialCabinetGrid: grid },
    routeState,
    windowRef,
    storage,
    getContext: () => ({ connectedWallet, state: { profiles: {} } }),
    appendText: (parent, tag, content, className = '') => { const child = node(tag, { textContent: content, className }); parent.append(child); return child; },
    buildLeaderboardExperienceV2Model: (_state, input) => {
      calls.push(input);
      const rows = (entries[input.gameId] ?? []).map((entry, index) => ({ ...entry, rank: index + 1, isCurrentPlayer: Boolean(connectedWallet) && entry.wallet === connectedWallet }));
      return { cadence: input.cadence, periodKey: input.cadence === 'all-time' ? 'all-time' : '2026-W38', topEntries: rows, total: rows.length, trustSummary: { flaggedRuns: 0 }, playerRank: null, playerEntry: null };
    },
    documentRef: { createTextNode: (content) => ({ text: content }), querySelector: () => null },
    el: (tag, props = {}) => node(tag, props),
    getAllCadenceLeaderboards: () => ['daily', 'weekly', 'monthly', 'yearly', 'all-time'].map((cadence) => ({ cadence })),
    getGame: (gameId) => ({ title: cabinets.find((cabinet) => cabinet.gameId === gameId)?.title ?? gameId }),
    humanList: (items) => items.join(', '),
    leaderboardEntryProvenance: (entry) => (entry.settlementTxHash ? { official: true, label: 'OFFICIAL' } : { official: false, source: 'local-practice', label: 'LOCAL PREVIEW' }),
    playableCabinetNames: () => cabinets.map((cabinet) => cabinet.title),
    publicLeaderboardCabinets: () => cabinets,
    renderArcadeIcon: () => node('icon'),
    renderAvatarChip: () => node('avatar'),
    resolveDisplayName: (_profile, wallet) => wallet,
  });
  return { grid, route, calls };
}

function localEntries(count, { wallet = null } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    wallet: index === 4 && wallet ? wallet : `0x${String(index + 1).padStart(2, '0')}${'cd'.repeat(19)}`,
    displayName: `Local${index + 1}`,
    score: 5000 - index * 100,
    recordedAt: '2026-09-10T00:00:00.000Z',
    runStats: { kills: index, surviveSeconds: 30 + index, level: 1 + index, maxCombo: index },
  }));
}

test('route renders one banner per public cabinet with the active game selected and keyboard-navigable', () => {
  const routeState = { cadence: 'all-time', gameId: 'lester-blaster', source: 'local', search: '', sortKey: 'score', sortDir: 'desc' };
  const { grid, route } = makeRoute({ entries: { 'lester-blaster': localEntries(3), chikun: localEntries(1) }, routeState });
  route.renderLeaderboards();
  assert.equal(grid.children.length, 2);
  const banners = find(grid.children[0], (candidate) => String(candidate.className ?? '').includes('leaderboard-game-banner ') || String(candidate.className ?? '').endsWith('leaderboard-game-banner') || String(candidate.className ?? '').includes('leaderboard-game-banner is-active'));
  assert.equal(banners.length, 3);
  assert.deepEqual(banners.map((banner) => banner.attributes['aria-selected']), ['true', 'false', 'false']);
  assert.deepEqual(banners.map((banner) => banner.attributes.tabindex), ['0', '-1', '-1']);
  assert.deepEqual(banners.map((banner) => banner.dataset.game), ['lester-blaster', 'chikun', 'stacked']);
  assert.ok(banners.every((banner) => String(banner.className).includes('leaderboard-game-tab')), 'banners keep the .leaderboard-game-tab hook the browser smokes click');
  assert.match(text(banners[0]), /3 players · top 5,000/);
  assert.match(text(banners[1]), /1 player · top 5,000/);
  assert.match(text(banners[2]), /No scores yet/);
  const tablist = find(grid.children[0], (candidate) => candidate.role === 'tablist')[0];
  assert.ok(tablist, 'banners live in a tablist');
  let focused = null;
  for (const banner of banners) banner.focus = () => { focused = banner.dataset.game; };
  let prevented = false;
  tablist.listeners.keydown({ key: 'ArrowRight', target: banners[0], preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(focused, 'chikun');
  assert.equal(banners[1].attributes.tabindex, '0');
  tablist.listeners.keydown({ key: 'End', target: banners[1], preventDefault() {} });
  assert.equal(focused, 'stacked');
  tablist.listeners.keydown({ key: 'ArrowLeft', target: banners[0], preventDefault() {} });
  assert.equal(focused, 'stacked', 'arrow navigation wraps');
});

test('route persists the game choice to the URL query and stored preference', () => {
  const routeState = { cadence: 'all-time', gameId: 'lester-blaster', source: 'local', search: '', sortKey: 'score', sortDir: 'desc' };
  const stored = new Map();
  const replaced = [];
  const windowRef = {
    location: { pathname: '/scores', search: '?game=stacked' },
    history: { state: { step: 'leaderboards' }, replaceState: (state, _title, url) => { replaced.push(url); windowRef.location.search = url.split('?')[1] ? `?${url.split('?')[1]}` : ''; } },
  };
  const storage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  const { grid, route } = makeRoute({ entries: { stacked: localEntries(2) }, routeState, windowRef, storage });
  route.renderLeaderboards();
  assert.equal(routeState.gameId, 'stacked', 'the ?game= query selects the board');
  assert.equal(stored.get(LEADERBOARD_GAME_PREFERENCE_KEY), 'stacked');
  assert.deepEqual(replaced, [], 'no history write when the URL already matches');
  assert.match(text(grid.children[1]), /One board across input devices/);
  assert.match(text(grid.children[1]), /Device-local preview/);

  const chikunBanner = find(grid.children[0], (candidate) => candidate.dataset?.game === 'chikun')[0];
  chikunBanner.listeners.click();
  assert.equal(routeState.gameId, 'chikun');
  assert.deepEqual(replaced, ['/scores?game=chikun']);
  assert.equal(stored.get(LEADERBOARD_GAME_PREFERENCE_KEY), 'chikun');

  // A later render without the query keeps the in-session choice.
  windowRef.location.search = '';
  route.renderLeaderboards();
  assert.equal(routeState.gameId, 'chikun');
  assert.deepEqual(replaced, ['/scores?game=chikun', '/scores?game=chikun']);
});

test('route filters, sorts, paginates and highlights the connected wallet', () => {
  const you = `0x${'ee'.repeat(20)}`;
  const routeState = { cadence: 'weekly', gameId: 'lester-blaster', source: 'local', search: '', sortKey: 'score', sortDir: 'desc' };
  const { grid, route } = makeRoute({ entries: { 'lester-blaster': localEntries(23, { wallet: you }) }, routeState, connectedWallet: you });
  route.renderLeaderboards();
  const board = grid.children[1];
  let rows = find(board, (candidate) => String(candidate.className ?? '').startsWith('leaderboard-trow'));
  assert.equal(rows.length, LEADERBOARD_PAGE_SIZE, 'first page shows ten rows');
  assert.equal(rows[4].id, 'leaderboardYourRow');
  assert.match(text(rows[4]), /YOU/);
  assert.match(text(board), /Showing 10 of 23 players/);
  assert.match(text(board), /YOUR RANK #5/);
  assert.match(text(board), /Jump to my rank/);
  assert.match(text(board), /WEEKLY · 2026-W38/);
  const headers = find(board, (candidate) => candidate.role === 'columnheader');
  assert.equal(headers.length, 10);
  assert.equal(headers[2].attributes['aria-sort'], 'descending');
  assert.match(text(headers[3]), /KILLS/);
  assert.match(text(headers[5]), /BOSS/);

  const more = find(board, (candidate) => candidate.className === 'pixel-button leaderboard-show-more')[0];
  assert.match(more.textContent, /Show 10 more/);
  more.listeners.click();
  rows = find(grid.children[1], (candidate) => String(candidate.className ?? '').startsWith('leaderboard-trow'));
  assert.equal(rows.length, 20);
  const all = find(grid.children[1], (candidate) => candidate.className === 'pixel-button leaderboard-show-more')[0];
  assert.match(all.textContent, /Show 3 more/);

  // Sorting by kills flips the order but keeps the true rank labels.
  const killsHeader = find(grid.children[1], (candidate) => String(candidate.className ?? '').includes('th-kills'))[0];
  killsHeader.listeners.click();
  rows = find(grid.children[1], (candidate) => String(candidate.className ?? '').startsWith('leaderboard-trow'));
  assert.equal(rows.length, LEADERBOARD_PAGE_SIZE, 'sorting resets pagination');
  assert.match(text(rows[0]), /#23/);
  assert.equal(routeState.sortKey, 'kills');
  assert.equal(routeState.sortDir, 'desc');

  // Search by wallet prefix narrows to the connected wallet.
  const search = find(grid.children[0], (candidate) => candidate.className === 'leaderboard-search')[0];
  search.value = '0xEE';
  search.listeners.input();
  rows = find(grid.children[1], (candidate) => String(candidate.className ?? '').startsWith('leaderboard-trow'));
  assert.equal(rows.length, 1);
  assert.match(text(rows[0]), /#5/);
  search.value = 'nobody';
  search.listeners.input();
  assert.match(text(grid.children[1]), /No players match "nobody"/);
  const clear = find(grid.children[1], (candidate) => candidate.textContent === 'Clear search')[0];
  clear.listeners.click();
  assert.equal(routeState.search, '');

  // Jump to my rank expands to the page holding the wallet after a sort.
  const jump = find(grid.children[1], (candidate) => candidate.className === 'pixel-button leaderboard-jump-button')[0];
  routeState.sortKey = 'kills';
  jump.listeners.click();
  assert.equal(routeState.sortKey, 'score');
  rows = find(grid.children[1], (candidate) => String(candidate.className ?? '').startsWith('leaderboard-trow'));
  assert.equal(rows.some((candidate) => candidate.id === 'leaderboardYourRow'), true);
});

test('preview shows a truthful empty state with no source tabs and no House rows', () => {
  const routeState = { cadence: 'daily', gameId: 'stacked', search: '', sortKey: 'score', sortDir: 'desc' };
  const { grid, route, calls } = makeRoute({ entries: {}, routeState });
  route.renderLeaderboards();
  const board = grid.children[1];
  assert.match(text(board), /No unpublished local ranked scores are available in this period/);
  assert.match(text(board), /Preview · this device/);
  assert.match(text(board), /Connect a wallet to see your placement/);
  assert.doesNotMatch(text(grid), /Show Local Preview|House Demo|Local Preview|Verified Ranked/);
  assert.equal(find(grid, (candidate) => String(candidate.className ?? '').includes('leaderboard-source-tab')).length, 0, 'no source tabs');
  assert.ok(calls.every((input) => input.source === 'local'), 'preview aggregates only this device’s rows');
});
