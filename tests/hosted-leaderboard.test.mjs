// Hosted Scores page (brief acceptance 6): E5 rows only, Weekly/Monthly/All-time
// with reset times, 25 a page, server-side search, jump to my rank, verified
// links, inviting empty boards, loading and offline states. Driven by an E5
// fixture and a small DOM double; no network.
import assert from 'node:assert/strict';
import test from 'node:test';

import { createOfficialLeaderboardRoute } from '../apps/portal/src/routes/official-leaderboard-route.mjs';
import {
  LEADERBOARD_PERIODS,
  formatResetCountdown,
  hostedLeaderboardEntry,
  hostedPageForRank,
  leaderboardPeriodTabs,
} from '../apps/portal/src/leaderboard-view.mjs';

const CABINETS = [
  { gameId: 'lester-blaster', id: 'hard-money-heroes', title: 'Hard Money Heroes' },
  { gameId: 'chikun', id: 'chikun', title: "Chikun's Escape" },
  { gameId: 'stacked', id: 'stacked', title: 'STACKED' },
];
const NOW = Date.parse('2026-09-23T22:00:00.000Z');
const WEEK_RESET = '2026-09-28T00:00:00.000Z';
const MONTH_RESET = '2026-10-01T00:00:00.000Z';
const walletFor = (rank) => `0x${rank.toString(16).padStart(4, '0')}${'ab'.repeat(18)}`;
const hex64 = (rank) => rank.toString(16).padStart(64, '0');

function e5Row(rank, gameId) {
  const wallet = walletFor(rank);
  const stats = {
    'lester-blaster': { kills: 100 - rank, survivalSeconds: 300, maxCombo: 12, level: 4, bossKills: rank === 1 ? 1 : 0 },
    chikun: { forksPassed: 40, nearMisses: 7, coinsCollected: 12, bestCombo: 5, survivalSeconds: 210.5, regionReached: 'coast', laps: 1 },
    stacked: { lines: 80, level: 9, quadClears: 3, perfectClears: 0, maxCombo: 6, survivalSeconds: 900 },
  }[gameId];
  return {
    rank,
    wallet,
    walletShort: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
    displayName: rank % 5 === 2 ? null : `Pilot ${rank}`, // hidden or blocked names arrive as null
    avatarUri: rank === 1 ? 'lestersarcade:avatar/lilly' : null,
    score: 100_000 - rank * 100,
    stats,
    sessionId32: `0x${hex64(rank)}`,
    shareId: hex64(rank),
    txHash: `0x${hex64(rank + 7)}`,
    explorerUrl: `https://liteforge.explorer.caldera.xyz/tx/0x${hex64(rank + 7)}`,
    confirmedAt: '2026-09-22T12:00:00.000Z',
  };
}

// E5 answers for a board of `total` players (25 a page), with `you` for the viewer.
function e5Fixture({ total = 30, youRank = null, match = null } = {}) {
  const calls = [];
  const leaderboard = async (params) => {
    calls.push({ ...params });
    const page = params.page ?? 1;
    let ranks = Array.from({ length: total }, (_, index) => index + 1);
    if (params.q) ranks = ranks.filter((rank) => (match ? match(rank, params.q) : String(`Pilot ${rank}`).toLowerCase().includes(params.q.toLowerCase())));
    const slice = ranks.slice((page - 1) * 25, page * 25);
    return {
      ok: true,
      gameId: params.game,
      period: params.period,
      periodKey: params.period === 'weekly' ? '2026-W39' : params.period === 'monthly' ? '2026-09' : 'all-time',
      resetsAt: params.period === 'weekly' ? WEEK_RESET : params.period === 'monthly' ? MONTH_RESET : null,
      page,
      pageSize: 25,
      total: ranks.length,
      rows: slice.map((rank) => e5Row(rank, params.game)),
      you: youRank ? { rank: youRank, score: 100_000 - youRank * 100, sessionId32: `0x${hex64(youRank)}`, shareId: hex64(youRank) } : null,
    };
  };
  return { calls, indexApi: { leaderboard } };
}

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
const walk = (root, visit) => { visit(root); for (const child of root.children ?? []) walk(child, visit); };
const find = (root, predicate) => { const hits = []; walk(root, (candidate) => { if (predicate(candidate)) hits.push(candidate); }); return hits; };
const text = (root) => { const parts = []; walk(root, (candidate) => { if (candidate.textContent) parts.push(candidate.textContent); if (candidate.text) parts.push(candidate.text); }); return parts.join(' '); };
const byClass = (root, className) => find(root, (candidate) => String(candidate.className ?? '').split(/\s+/).includes(className));

function hostedRoute({ indexApi, connectedWallet = null, routeState = { gameId: 'lester-blaster' }, playRanked = () => {}, viewProfile = () => {}, timers = null } = {}) {
  const grid = node('grid');
  let localReads = 0;
  const route = createOfficialLeaderboardRoute({
    hosted: true,
    indexApi,
    playRanked,
    viewProfile,
    now: () => NOW,
    dom: { officialCabinetGrid: grid },
    routeState,
    storage: null,
    windowRef: { location: { pathname: '/scores', search: '' }, history: { state: null, replaceState() {} } },
    getContext: () => ({ connectedWallet, state: { profiles: {} } }),
    appendText: (parent, tag, content, className = '') => { const child = node(tag, { textContent: content, className }); parent.append(child); return child; },
    buildLeaderboardExperienceV2Model: () => { localReads += 1; throw new Error('hosted boards never read local rows'); },
    getAllCadenceLeaderboards: () => { localReads += 1; return []; },
    documentRef: { createTextNode: (content) => ({ text: content }), querySelector: () => null },
    el: (tag, props = {}) => node(tag, props),
    getGame: (gameId) => ({ title: CABINETS.find((cabinet) => cabinet.gameId === gameId)?.title ?? gameId }),
    humanList: (items) => items.join(', '),
    leaderboardEntryProvenance: () => { throw new Error('hosted rows are verified by the index'); },
    playableCabinetNames: () => CABINETS.map((cabinet) => cabinet.title),
    publicLeaderboardCabinets: () => CABINETS,
    renderArcadeIcon: () => node('icon'),
    renderAvatarChip: (wallet, name, className) => node('img', { className: `avatar-chip-img avatar-chip-default ${className}`, src: 'default.jpg', dataset: { wallet: String(wallet) } }),
    resolveDisplayName: (_profile, wallet) => wallet,
    ...(timers ? {
      setTimeoutImpl: (callback, ms) => { timers.push({ callback, ms, cleared: false }); return timers.length; },
      clearTimeoutImpl: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    } : {}),
  });
  return { grid, route, routeState, localReads: () => localReads };
}

const rowsOf = (grid) => find(grid, (candidate) => String(candidate.className ?? '').startsWith('leaderboard-trow'));

test('the hosted leaderboard renders E5 rows with verified links', async () => {
  const { calls, indexApi } = e5Fixture({ total: 30 });
  const viewed = [];
  const h = hostedRoute({ indexApi, viewProfile: (wallet) => viewed.push(wallet) });
  h.route.renderLeaderboards();
  assert.match(text(h.grid.children[1]), /Loading verified scores…/, 'the first render is synchronous and says it is loading');
  await h.route.hydrate();
  assert.deepEqual(calls, [{ game: 'lester-blaster', period: 'weekly', page: 1, q: '', wallet: null }]);
  const board = h.grid.children[1];
  const rows = rowsOf(board);
  assert.equal(rows.length, 25, '25 rows a page');
  assert.match(text(board), /Verified Ranked runs published on LitVM/);
  assert.match(text(board), /Showing ranks 1–25 of 30 players/);
  assert.doesNotMatch(text(h.grid), /House|Local Preview|Preview · this device/);

  const links = byClass(board, 'lt-verified-link');
  assert.equal(links.length, 25, 'every row links to its transaction');
  assert.equal(links[0].textContent, '⛓ verified');
  assert.equal(links[0].href, e5Row(1, 'lester-blaster').explorerUrl);
  assert.equal(links[0].target, '_blank');
  assert.equal(links[0].rel, 'noopener noreferrer');
  const headers = find(board, (candidate) => candidate.role === 'columnheader').map((cell) => text(cell));
  assert.ok(headers.includes('PROOF') && headers.includes('KILLS') && headers.includes('BOSS'));

  // Names are the index's sanitized values; a hidden or blocked name shows the short wallet.
  assert.match(text(rows[0]), /Pilot 1/);
  assert.match(text(rows[1]), new RegExp(e5Row(2, 'lester-blaster').walletShort));
  assert.doesNotMatch(text(rows[1]), /Pilot 2/);
  const avatar = find(rows[0], (candidate) => candidate.tag === 'img')[0];
  assert.equal(avatar.src, './assets/generated/hmh-hero-portraits/lilly.webp', 'avatars resolve from ARCADE_AVATARS');
  const fallback = find(rows[2], (candidate) => candidate.tag === 'img')[0];
  assert.equal(fallback.dataset.wallet, 'null', 'no local avatar is ever shown for an index row');

  const profile = byClass(rows[0], 'lt-profile-link')[0];
  assert.equal(profile.href, `/profile/${walletFor(1)}`);
  let prevented = false;
  profile.listeners.click({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(viewed, [walletFor(1)]);
  assert.equal(h.localReads(), 0);
});

test('Weekly, Monthly and All-time tabs show their reset times', async () => {
  assert.deepEqual(leaderboardPeriodTabs().map((tab) => tab.id), ['weekly', 'monthly', 'all-time']);
  assert.equal(LEADERBOARD_PERIODS.daily, false, 'Daily is switched off until it returns as the headline board');
  assert.deepEqual(leaderboardPeriodTabs({ ...LEADERBOARD_PERIODS, daily: true }).map((tab) => tab.id), ['daily', 'weekly', 'monthly', 'all-time']);
  assert.equal(formatResetCountdown(WEEK_RESET, NOW), 'in 4d 2h');
  assert.equal(formatResetCountdown('2026-09-23T22:09:30.000Z', NOW), 'in 9m');
  assert.equal(formatResetCountdown(null, NOW), null);

  const { calls, indexApi } = e5Fixture({ total: 3 });
  const h = hostedRoute({ indexApi, routeState: { gameId: 'chikun', cadence: 'yearly' } });
  h.route.renderLeaderboards();
  await h.route.hydrate();
  const panel = h.grid.children[0];
  const tabs = byClass(panel, 'leaderboard-cadence-tab');
  assert.deepEqual(tabs.map((tab) => tab.textContent), ['WEEKLY', 'MONTHLY', 'ALL-TIME'], 'no Daily and no Yearly');
  assert.equal(tabs[0].attributes['aria-pressed'], 'true', 'a stale yearly cadence falls back to Weekly');
  assert.match(text(panel), /Resets Monday 00:00 UTC · resets in 4d 2h/);
  assert.equal(calls[0].period, 'weekly');

  tabs[1].listeners.click();
  await h.route.hydrate();
  assert.equal(h.routeState.cadence, 'monthly');
  assert.equal(calls.at(-1).period, 'monthly');
  assert.match(text(h.grid.children[0]), /Resets on the 1st, 00:00 UTC · resets in 7d 2h/);
  assert.match(text(h.grid.children[1]), /MONTHLY · 2026-09/);

  byClass(h.grid.children[0], 'leaderboard-cadence-tab')[2].listeners.click();
  await h.route.hydrate();
  assert.equal(calls.at(-1).period, 'all-time');
  assert.match(text(h.grid.children[0]), /All-time never resets/);
});

test('an empty board invites a Ranked run', async () => {
  for (const gameId of ['lester-blaster', 'chikun', 'stacked']) {
    const { indexApi } = e5Fixture({ total: 0 });
    const played = [];
    const h = hostedRoute({ indexApi, routeState: { gameId }, playRanked: (game) => played.push(game), connectedWallet: walletFor(99) });
    h.route.renderLeaderboards();
    await h.route.hydrate();
    const board = h.grid.children[1];
    assert.match(text(board), /Be the first on this week’s board/);
    assert.doesNotMatch(text(board), /not available|Local Preview/, `${gameId} gets the generic inviting state`);
    const play = byClass(board, 'leaderboard-play-ranked')[0];
    assert.equal(play.textContent, 'Play Ranked');
    play.listeners.click();
    assert.deepEqual(played, [gameId], 'Play Ranked opens mode select for that game');
    assert.match(text(board), /No verified run on this week’s board yet/);
  }
});

test('Show more fetches the next page', async () => {
  const { calls, indexApi } = e5Fixture({ total: 60 });
  const h = hostedRoute({ indexApi });
  h.route.renderLeaderboards();
  await h.route.hydrate();
  let more = byClass(h.grid.children[1], 'leaderboard-show-more')[0];
  assert.equal(more.textContent, 'Show 25 more');
  more.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.at(-1), { game: 'lester-blaster', period: 'weekly', page: 2, q: '', wallet: null });
  assert.equal(rowsOf(h.grid.children[1]).length, 50);
  more = byClass(h.grid.children[1], 'leaderboard-show-more')[0];
  assert.equal(more.textContent, 'Show 10 more');
  more.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1).page, 3);
  assert.equal(rowsOf(h.grid.children[1]).length, 60);
  assert.equal(byClass(h.grid.children[1], 'leaderboard-show-more').length, 0, 'no more pages');
  assert.match(text(h.grid.children[1]), /Showing ranks 1–60 of 60 players/);
});

test('search is debounced and server-side', async () => {
  const timers = [];
  // The server matched rank 7 by wallet prefix, so its name does not contain the query.
  const { calls, indexApi } = e5Fixture({ total: 40, match: (rank, q) => (q === '0x0007' ? rank === 7 : `pilot ${rank}`.includes(q.toLowerCase())) });
  const h = hostedRoute({ indexApi, timers });
  h.route.renderLeaderboards();
  await h.route.hydrate();
  assert.equal(calls.length, 1);
  const search = byClass(h.grid.children[0], 'leaderboard-search')[0];
  search.value = '0x';
  search.listeners.input();
  search.value = '0x0007';
  search.listeners.input();
  assert.equal(calls.length, 1, 'no request while the player is typing');
  assert.equal(timers.length, 2);
  assert.equal(timers[0].cleared, true, 'each keystroke restarts the wait');
  assert.equal(timers[1].ms, 300);
  timers[1].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.at(-1), { game: 'lester-blaster', period: 'weekly', page: 1, q: '0x0007', wallet: null });
  const rows = rowsOf(h.grid.children[1]);
  assert.equal(rows.length, 1, 'the rows are the server’s matches, not a client-side filter');
  assert.match(text(rows[0]), /#7/);
  assert.match(text(h.grid.children[1]), /Showing 1 of 1 matching player/);

  const miss = byClass(h.grid.children[0], 'leaderboard-search')[0];
  miss.value = 'nobody';
  miss.listeners.input();
  timers.at(-1).callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(text(h.grid.children[1]), /No players match "nobody"/);
  byClass(h.grid.children[1], 'leaderboard-empty-action').find((button) => button.textContent === 'Clear search').listeners.click();
  assert.equal(h.routeState.search, '');
  assert.equal(rowsOf(h.grid.children[1]).length, 25, 'clearing the search shows the cached board again');
});

test('jump to my rank uses you', async () => {
  const me = walletFor(57);
  const { calls, indexApi } = e5Fixture({ total: 60, youRank: 57 });
  const h = hostedRoute({ indexApi, connectedWallet: me, routeState: { gameId: 'stacked', search: 'pilot' } });
  h.route.renderLeaderboards();
  await h.route.hydrate();
  assert.equal(calls[0].wallet, me, 'E5 is asked for this wallet’s standing');
  const board = h.grid.children[1];
  assert.match(text(board), /YOUR RANK #57/);
  const jump = byClass(board, 'leaderboard-jump-button')[0];
  await jump.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.routeState.search, '', 'ranks are pages of the unfiltered board');
  assert.equal(calls.at(-1).page, hostedPageForRank(57));
  assert.equal(calls.at(-1).q, '');
  const rows = rowsOf(h.grid.children[1]);
  assert.deepEqual([rows[0].children[0].children[0].textContent, rows.at(-1).children[0].children[0].textContent], ['#51', '#60']);
  const mine = rows.find((row) => row.id === 'leaderboardYourRow');
  assert.ok(mine, 'the viewer’s row is marked for focus');
  assert.match(text(mine), /YOU/);
  const back = byClass(h.grid.children[1], 'leaderboard-show-less')[0];
  assert.equal(back.textContent, 'Back to the top');
  back.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(text(rowsOf(h.grid.children[1])[0]), /#1/);
});

test('loading, offline and failure states offer a retry', async () => {
  let answer = { ok: false, error: 'network', retryable: true };
  let calls = 0;
  const indexApi = { leaderboard: async () => { calls += 1; return answer; } };
  const h = hostedRoute({ indexApi });
  h.route.renderLeaderboards();
  await h.route.hydrate();
  assert.match(text(h.grid.children[1]), /You appear to be offline/);
  answer = { ok: false, status: 503, error: 'index-not-configured' };
  byClass(h.grid.children[1], 'leaderboard-empty-action')[0].listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.match(text(h.grid.children[1]), /Scores are unavailable right now/);
  answer = (await e5Fixture({ total: 2 }).indexApi.leaderboard({ game: 'lester-blaster', period: 'weekly', page: 1, q: '' }));
  byClass(h.grid.children[1], 'leaderboard-empty-action')[0].listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rowsOf(h.grid.children[1]).length, 2);
});

test('preview never fetches and hosted entries keep only index fields', async () => {
  let calls = 0;
  const route = createOfficialLeaderboardRoute({ hosted: false, indexApi: { leaderboard: async () => { calls += 1; return { ok: true }; } } });
  assert.equal(await route.hydrate(), null);
  assert.equal(calls, 0);
  const entry = hostedLeaderboardEntry({ ...e5Row(3, 'chikun'), explorerUrl: 'javascript:alert(1)' }, { connectedWallet: walletFor(3).toUpperCase().replace('0X', '0x') });
  assert.equal(entry.explorerUrl, null, 'only LiteForge explorer transaction links are rendered');
  assert.equal(entry.isCurrentPlayer, true);
  assert.equal(entry.runStats.forksPassed, 40);
});
