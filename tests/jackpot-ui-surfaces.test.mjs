// Chikun Weekly Jackpot, jackpot-ui slice: the SPA placements of design §D.3 (mode-select marquee,
// Ranked entry row, results line, home promo, Scores header and past winners, profile wins with Claim),
// each with fixtures and a fetch spy: nothing is fetched while the flag is off, and a test-only
// override switches a surface on through its loader's deps, never by editing JACKPOT_LIVE.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { ethers } from 'ethers';

import { JACKPOT_LIVE } from '../apps/portal/src/jackpot-config.mjs';
import { jackpotEntryFor, noteJackpotEntry, resetJackpotMemo, weekRangeText } from '../apps/portal/src/jackpot/jackpot-client.mjs';
import renderChikunJackpotPanel, { JACKPOT_MARQUEE_ID } from '../apps/portal/src/jackpot/chikun-jackpot-panel.mjs';
import { LAST_MINUTES_MS, NEXT_WEEK_NOTE, showEntryJackpot } from '../apps/portal/src/jackpot/jackpot-entry-line.mjs';
import { JACKPOT_LEAD_LABEL, JACKPOT_LEAD_TEXT, JACKPOT_TIE_TEXT, createJackpotResultsLine, jackpotStanding } from '../apps/portal/src/jackpot/jackpot-results-line.mjs';
import { renderJackpotHomePromo } from '../apps/portal/src/jackpot/jackpot-home-promo.mjs';
import { JACKPOT_BOARD_NOTE, createJackpotBoardHeader } from '../apps/portal/src/jackpot/jackpot-board-header.mjs';
import { renderJackpotWins } from '../apps/portal/src/jackpot/jackpot-profile-wins.mjs';
import { CLAIM_SELECTOR, UNCLAIMED_NOTICE, claimCall, knownJackpotContracts } from '../apps/portal/src/jackpot/jackpot-profile-claim.mjs';
import { createOfficialPlayRoutes } from '../apps/portal/src/routes/official-play-routes.mjs';
import { createHostedLeaderboardView } from '../apps/portal/src/routes/hosted-leaderboard-view.mjs';
import { createHostedProfileView } from '../apps/portal/src/routes/hosted-profile-view.mjs';
import { openRankedResults } from '../apps/portal/src/ranked-results.mjs';
import { formatResetCountdown } from '../apps/portal/src/leaderboard-view.mjs';
import { fakeDocument, flush, visibleText } from './helpers/jackpot-fake-dom.mjs';

const E18 = 10n ** 18n;
// Week ranges in the host's own date format (the surfaces format with the viewer's locale), so the
// assertions hold on an en-GB or de-DE machine too.
const range = (startsAt, closesAt, year = false) => weekRangeText(startsAt, closesAt, { year });
const W38 = range('2026-09-14T00:00:00.000Z', '2026-09-21T00:00:00.000Z', true);
const W39 = range('2026-09-21T00:00:00.000Z', '2026-09-28T00:00:00.000Z', true);
const W40 = range('2026-09-28T00:00:00.000Z', '2026-10-05T00:00:00.000Z');
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/jackpot/${name}.json`, import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const CLOSE = Date.parse('2026-10-05T00:00:00.000Z');
const now = () => NOW;
const responseOf = (body, { status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (key) => headers[String(key).toLowerCase()] ?? null },
  json: async () => JSON.parse(JSON.stringify(body)),
});
// A fixture answered by the server at `iso` (serverTime), as a fresh answer read at that time.
const answeredAt = (body, iso) => ({ ...body, serverTime: new Date(iso).toISOString() });
const jackpotCalls = (calls) => calls.filter((call) => String(call.url).startsWith('/api/jackpot'));
function spyFetch(body, options) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (body instanceof Error) throw body;
    return responseOf(body, options);
  };
  return { calls, fetchImpl };
}

// Every loader reads globalThis.fetch through fetchJackpot's default; the spy stands in for it.
const realFetch = globalThis.fetch;
function installGlobalFetch(body) {
  const spy = spyFetch(body);
  globalThis.fetch = spy.fetchImpl;
  return spy.calls;
}
afterEach(() => {
  globalThis.fetch = realFetch;
  resetJackpotMemo();
});

// ------------------------------------------------------------------------------------------------
// Harnesses for the real routes and views, on the fake DOM.

function modeSelectHarness({ jackpotLive, gameId = 'chikun' } = {}) {
  const documentRef = fakeDocument();
  const make = (id, tag = 'div') => { const element = documentRef.createElement(tag); element.id = id; return element; };
  const modeSelect = documentRef.body.appendChild(make('officialModeSelect', 'section'));
  const heading = modeSelect.appendChild(documentRef.createElement('div'));
  heading.className = 'mode-select-heading';
  const keys = ['officialModeEyebrow', 'officialModeTitle', 'officialModeCopy', 'officialModeArtNote', 'officialFreeModeButton', 'officialRankedModeButton', 'officialFreeModeBanner', 'officialRankedModeBanner', 'officialFreeModeTitle', 'officialRankedModeTitle', 'officialFreeModeCopy', 'officialRankedModeCopy', 'officialRankedTooltip'];
  const dom = { officialModeSelect: modeSelect, ...Object.fromEntries(keys.map((key) => [key, heading.appendChild(make(key))])) };
  const game = { id: gameId, title: gameId };
  const routes = createOfficialPlayRoutes({
    dom,
    ...(jackpotLive === undefined ? {} : { jackpotLive }),
    getContext: () => ({ connectedWallet: null, walletSignedIn: false }),
    appendText: (parent, tag, text) => { const child = documentRef.createElement(tag); child.textContent = text; parent.append(child); return child; },
    applyGameModeSelectBackground: () => {},
    buildGameModeSelectModel: (id) => ({ gameId: id, artStatus: 'production', eyebrow: 'Mode', title: id, copy: 'Choose', free: { label: 'Free Mode', copy: 'Practice', bannerAsset: '/f.png', bannerAlt: 'Free' }, ranked: { label: 'Ranked', copy: 'Compete', bannerAsset: '/r.png', bannerAlt: 'Ranked' } }),
    el: (tag, props = {}) => Object.assign(documentRef.createElement(tag), props),
    selectedGame: () => game,
    SETTLEMENT_LIVE: true,
  });
  return { documentRef, dom, routes, game };
}

function leaderboardHarness({ jackpotLive, gameId = 'chikun', cadence = 'weekly', resetsAt = '2026-10-05T00:00:00.000Z' } = {}) {
  const documentRef = fakeDocument();
  const grid = documentRef.body.appendChild(documentRef.createElement('div'));
  const routeState = { gameId, cadence, search: '' };
  let view = null;
  const indexApi = {
    leaderboard: async (params) => ({ ok: true, gameId: params.game, period: params.period, periodKey: '2026-W40', resetsAt, page: 1, pageSize: 25, total: 1, rows: [{ rank: 1, wallet: `0x${'11'.repeat(20)}`, walletShort: '0x1111…1111', displayName: 'Board One', score: 99999, stats: {}, explorerUrl: null, confirmedAt: '2026-09-30T00:00:00.000Z' }], you: null }),
  };
  const el = (tag, props = {}) => Object.assign(documentRef.createElement(tag), props);
  const appendText = (parent, tag, text, className = '') => { const child = el(tag, { className }); child.textContent = text; parent.append(child); return child; };
  view = createHostedLeaderboardView({
    appendText,
    documentRef,
    dom: { officialCabinetGrid: grid },
    el,
    getContext: () => ({ connectedWallet: null }),
    getGame: (id) => ({ title: id }),
    humanList: (items) => items.join(', '),
    indexApi,
    now,
    playableCabinetNames: () => ['Chikun'],
    renderArcadeIcon: () => el('i'),
    renderAvatarChip: () => el('img'),
    renderFilterPanel: () => el('div', { className: 'filter-panel' }),
    renderPage: () => { grid.replaceChildren(); view.render([{ gameId: routeState.gameId, title: routeState.gameId }]); },
    rerender: () => {},
    routeState,
    ...(jackpotLive === undefined ? {} : { jackpotLive }),
  });
  const render = () => { grid.replaceChildren(); view.render([{ gameId: routeState.gameId, title: routeState.gameId }]); };
  return { documentRef, grid, view, render, routeState };
}

function profileHarness({ jackpotLive, wins = [], wallet = `0x${'a1'.repeat(20)}`, connected = wallet, provider = null } = {}) {
  const documentRef = fakeDocument();
  const grid = documentRef.body.appendChild(documentRef.createElement('div'));
  const el = (tag, props = {}) => Object.assign(documentRef.createElement(tag), props);
  const appendText = (parent, tag, text, className = '') => { const child = el(tag, { className }); child.textContent = text; parent.append(child); return child; };
  let view = null;
  const response = { ok: true, wallet, walletShort: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`, displayName: 'SkyChikun', games: {}, sessions: [], achievements: [], jackpot: { wins } };
  view = createHostedProfileView({
    appendText,
    dom: { officialCabinetGrid: grid },
    el,
    getContext: () => ({ connectedWallet: connected }),
    indexApi: { profile: async () => response },
    isAuthenticated: () => false,
    now,
    playSfxCue: () => {},
    renderAchievementIcon: () => el('i'),
    renderAvatarChip: () => el('img'),
    renderLocalUsernameEditor: () => {},
    renderPage: () => view.render(),
    routeState: { viewedWallet: wallet },
    walletProviderForAction: async () => provider,
    connectWallet: () => {},
    ...(jackpotLive === undefined ? {} : { jackpotLive }),
  });
  return { documentRef, grid, view };
}

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const mainAst = parse(mainSource, { ecmaVersion: 'latest', sourceType: 'module' });
const mainFunction = (name) => {
  const node = mainAst.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id.name === name);
  assert.ok(node, `main.js declares ${name}`);
  return mainSource.slice(node.start, node.end);
};

// ------------------------------------------------------------------------------------------------

test('no surface fetches the jackpot API while the flag is false', async () => {
  assert.equal(JACKPOT_LIVE, false);
  const calls = installGlobalFetch(fixture('open-funded'));
  // Mode select (default deps = the committed flag).
  const mode = modeSelectHarness();
  mode.routes.renderModeSelect();
  // Scores header, Chikun · Weekly.
  const board = leaderboardHarness();
  await board.view.hydrate();
  board.render();
  // Profile wins.
  const profile = profileHarness({ wins: fixture('claim-pending').history.map(() => ({})) });
  await profile.view.hydrate();
  profile.view.render();
  // Results screen for a Chikun run.
  const results = fakeDocument();
  const handle = { snapshot: { state: 'published', gameId: 'chikun', sessionId32: `0x${'ab'.repeat(32)}`, server: { score: 60000, contract: { survivalSeconds: 600 } }, entry: { status: 'confirmed' } }, subscribe: () => () => {} };
  const screen = openRankedResults({ handle, context: { gameId: 'chikun', sessionId: 'game-session-x', wallet: `0x${'a1'.repeat(20)}` }, documentRef: results, mount: results.body, fetchImpl: async (url) => { calls.push({ url }); return responseOf({ ok: false }); }, windowRef: {} });
  // main.js loaders, VM-executed with the committed flag.
  const imports = [];
  const context = { JACKPOT_LIVE, document: { querySelector: () => ({}) }, import: (path) => { imports.push(path); return Promise.resolve({}); } };
  const row = { hidden: false };
  runInNewContext(`(${mainFunction('showEntryJackpot').replace(/\bimport\(/g, 'globalThis.import(')})`, context)({ row, gameId: 'chikun' });
  runInNewContext(`(${mainFunction('showJackpotPromo').replace(/\bimport\(/g, 'globalThis.import(')})`, context)();
  await flush(10);
  screen.close();
  assert.deepEqual(jackpotCalls(calls), [], 'no request to /api/jackpot');
  assert.deepEqual(imports, [], 'no jackpot chunk downloads');
  assert.equal(row.hidden, true, 'the entry row stays hidden');
  assert.equal(mode.dom.officialModeSelect.querySelector(`#${JACKPOT_MARQUEE_ID}`), null);
  assert.doesNotMatch(visibleText(board.grid) + visibleText(profile.grid), /jackpot/i);
  // The rules module is covered in tests/jackpot-ui-rules-page.test.mjs, the Chikun child in
  // tests/jackpot-ui-chikun-child.test.mjs.

  // The same loaders with the test-only override do ask /api/jackpot, once each thanks to the memo.
  const liveMode = modeSelectHarness({ jackpotLive: true });
  liveMode.routes.renderModeSelect();
  await flush(10);
  assert.equal(jackpotCalls(calls).length, 1);
  assert.equal(jackpotCalls(calls)[0].url, '/api/jackpot?game=chikun');
  assert.ok(liveMode.dom.officialModeSelect.querySelector(`#${JACKPOT_MARQUEE_ID}`));
  const liveContext = { ...context, JACKPOT_LIVE: true };
  runInNewContext(`(${mainFunction('showEntryJackpot').replace(/\bimport\(/g, 'globalThis.import(')})`, liveContext)({ row, gameId: 'chikun' });
  runInNewContext(`(${mainFunction('showEntryJackpot').replace(/\bimport\(/g, 'globalThis.import(')})`, liveContext)({ row, gameId: 'stacked' });
  runInNewContext(`(${mainFunction('showJackpotPromo').replace(/\bimport\(/g, 'globalThis.import(')})`, liveContext)();
  assert.deepEqual(imports, ['./src/jackpot/jackpot-entry-line.mjs', './src/jackpot/jackpot-home-promo.mjs'], 'Chikun only for the entry row');
  // The loaders call each chunk's default export (a shorter glue in dist/main.js): the entry row's is
  // showEntryJackpot, and the promo's renders into the page's own #jackpotPromo.
  const handed = [];
  const loaded = { './src/jackpot/jackpot-entry-line.mjs': { default: (options) => handed.push(['entry', options.gameId]) }, './src/jackpot/jackpot-home-promo.mjs': { default: (...args) => handed.push(['promo', args.length]) } };
  const moduleContext = { ...liveContext, import: (path) => Promise.resolve(loaded[path]) };
  runInNewContext(`(${mainFunction('showEntryJackpot').replace(/\bimport\(/g, 'globalThis.import(')})`, moduleContext)({ row: { hidden: false }, gameId: 'chikun' });
  runInNewContext(`(${mainFunction('showJackpotPromo').replace(/\bimport\(/g, 'globalThis.import(')})`, moduleContext)();
  await flush(5);
  assert.deepEqual(handed, [['entry', 'chikun'], ['promo', 0]]);
  const entryModule = await import('../apps/portal/src/jackpot/jackpot-entry-line.mjs');
  assert.equal(entryModule.default, entryModule.showEntryJackpot);
  const promoDocument = fakeDocument();
  const promoSection = promoDocument.createElement('section');
  promoSection.id = 'jackpotPromo';
  promoDocument.body.append(promoSection);
  const promoFetches = [];
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  globalThis.document = promoDocument;
  globalThis.fetch = async (url) => { promoFetches.push(url); throw new Error('offline'); };
  try {
    resetJackpotMemo();
    assert.equal(await (await import('../apps/portal/src/jackpot/jackpot-home-promo.mjs')).default(), null);
    assert.deepEqual([promoFetches, promoSection.hidden], [['/api/jackpot?game=chikun'], true], 'the default export found #jackpotPromo and kept it hidden on a failed answer');
  } finally {
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
    resetJackpotMemo();
  }
  // The results screen gets the flag from main.js, as it gets `live` and `hosted`: ranked-results.mjs
  // does not import the flag module (its chunk would import esbuild's empty shared flag chunk).
  assert.match(mainSource, /openRankedResults\(\{ \.\.\.event\.detail, [^}]*live: SETTLEMENT_LIVE, hosted: HOSTED_PROFILE_SYNC, jackpotLive: JACKPOT_LIVE,/);
  assert.doesNotMatch(readFileSync(new URL('../apps/portal/src/ranked-results.mjs', import.meta.url), 'utf8'), /jackpot-config/);
  // The wallet splash only wraps the shell's renderer while the flag is on (0 B in the flag-false build).
  assert.match(mainSource, /const renderOfficialWalletSplash = JACKPOT_LIVE \? \(\) => \{ officialShellRoutes\.renderWalletSplash\(\); showJackpotPromo\(\); \} : officialShellRoutes\.renderWalletSplash;/);
});

test('no surface shows an amount for an unfunded, below-minimum or unavailable week', async () => {
  for (const name of ['open-unfunded', 'open-below-min-fund', 'not-live', null]) {
    resetJackpotMemo();
    const body = name ? fixture(name) : new Error('offline');
    const { fetchImpl } = spyFetch(body);
    const documentRef = fakeDocument();
    // Marquee.
    const mount = documentRef.body.appendChild(documentRef.createElement('section'));
    mount.dataset.gameId = 'chikun';
    assert.equal(await renderChikunJackpotPanel(mount, { gameId: 'chikun', documentRef, fetchImpl, now }), null, `${name} marquee`);
    // Entry row.
    const row = documentRef.body.appendChild(documentRef.createElement('div'));
    await showEntryJackpot({ row, gameId: 'chikun', quote: () => '102000000000000000', documentRef, fetchImpl, now, setTimeoutImpl: () => 0 });
    assert.equal(row.hidden, true, `${name} entry row`);
    // Home promo.
    const section = documentRef.body.appendChild(documentRef.createElement('section'));
    section.hidden = true;
    assert.equal(await renderJackpotHomePromo({ section, documentRef, fetchImpl, now }), null);
    assert.equal(section.hidden, true, `${name} promo`);
    // Scores header: "No jackpot funded this week" for a live week, nothing when unavailable.
    let changes = 0;
    const header = createJackpotBoardHeader({ documentRef, fetchImpl, now, onChange: () => { changes += 1; } });
    header.shown('chikun', 'weekly');
    await flush();
    const shown = header.shown('chikun', 'weekly');
    if (name === 'open-unfunded' || name === 'open-below-min-fund') {
      const card = shown.render(documentRef.body);
      assert.match(visibleText(card), /No jackpot funded this week/);
      assert.doesNotMatch(visibleText(card).split('Past winners')[0], /\d[\d,]* tCHIKUN|top score/, `${name}: no amount and no race`);
      assert.equal(changes, 1);
    } else {
      assert.equal(shown, null, `${name}: no header`);
    }
    for (const node of documentRef.body.all()) assert.doesNotMatch(node === mount ? visibleText(node) : '', /tCHIKUN/);
  }
});

test('a week without a rules row shows no amount and no race', async () => {
  const body = fixture('open-funded');
  body.current.rules = null;
  body.current.pot.funded = false;
  const { fetchImpl } = spyFetch(body);
  const documentRef = fakeDocument();
  const mount = documentRef.body.appendChild(documentRef.createElement('section'));
  mount.dataset.gameId = 'chikun';
  assert.equal(await renderChikunJackpotPanel(mount, { gameId: 'chikun', documentRef, fetchImpl, now }), null);
  const row = documentRef.body.appendChild(documentRef.createElement('div'));
  await showEntryJackpot({ row, gameId: 'chikun', quote: () => '102000000000000000', documentRef, fetchImpl, now, setTimeoutImpl: () => 0 });
  assert.equal(row.hidden, true);
  const header = createJackpotBoardHeader({ documentRef, fetchImpl, now });
  header.shown('chikun', 'weekly');
  await flush();
  const card = header.shown('chikun', 'weekly').render(documentRef.body);
  assert.match(visibleText(card), /No jackpot funded this week/);
  assert.doesNotMatch(visibleText(card).split('Past winners')[0], /\d[\d,]* tCHIKUN|top score/);
  assert.equal(jackpotStanding({ api: { ...JSON.parse(JSON.stringify(body)) }, correctedNowMs: NOW, gameId: 'chikun', state: 'published', server: { score: 90000, contract: { survivalSeconds: 60 } }, entry: { session: { entryReceipt: { amountWei: '102000000000000000' } }, seenAtMs: NOW - 60_000 } }), null);
});

test('surfaces show the capped prize and the rollover note', async () => {
  const { fetchImpl } = spyFetch(fixture('open-funded-capped'));
  const documentRef = fakeDocument();
  const mount = documentRef.body.appendChild(documentRef.createElement('section'));
  mount.dataset.gameId = 'chikun';
  const heading = mount.appendChild(documentRef.createElement('div'));
  heading.className = 'mode-select-heading';
  const timers = [];
  const panel = await renderChikunJackpotPanel(mount, { gameId: 'chikun', documentRef, fetchImpl, now, setTimeoutImpl: (callback, ms) => { timers.push(ms); return timers.length; }, clearTimeoutImpl: () => {} });
  assert.equal(panel.parentNode, heading, 'the marquee sits in the mode heading');
  assert.equal(visibleText(panel), 'ŁWeekly Jackpot · 5,000 tCHIKUN (testnet token, no value) · up to 5,000 tCHIKUN; the rest rolls over · closes in 3d 12h · top score 48,213 (provisional) · Rules');
  assert.equal(panel.querySelector('a').href, '/jackpot/chikun');
  assert.deepEqual(timers, [30_000], 'the countdown refreshes while shown');
  assert.equal(documentRef.head.querySelector('link[data-jackpot-css]').href, '/src/styles/jackpot.css?v=jackpot-ui-20260925');
  const header = createJackpotBoardHeader({ documentRef, fetchImpl, now });
  header.shown('chikun', 'weekly');
  await flush();
  const card = header.shown('chikun', 'weekly').render(documentRef.body);
  assert.match(visibleText(card), /5,000 tCHIKUN \(testnet token, no value\) · up to 5,000 tCHIKUN; the rest rolls over/);
  // The entry row and the home promo have no room for the note, but show the capped prize.
  const row = documentRef.body.appendChild(documentRef.createElement('div'));
  await showEntryJackpot({ row, gameId: 'chikun', quote: () => '102000000000000000', documentRef, fetchImpl, now, setTimeoutImpl: () => 0 });
  assert.match(visibleText(row), /5,000 tCHIKUN \(testnet token, no value\)/);
  assert.doesNotMatch(visibleText(row), /12,000|rolls over/);
  const section = documentRef.body.appendChild(documentRef.createElement('section'));
  section.hidden = true;
  await renderJackpotHomePromo({ section, documentRef, fetchImpl, now });
  assert.equal(section.hidden, false);
  assert.equal(visibleText(section), "ŁThis week's Chikun Jackpot5,000 tCHIKUN (testnet token, no value)Play Ranked →Entries don't fund the prize. Rules");
  assert.deepEqual(section.querySelectorAll('a').map((anchor) => anchor.href), ['/games/chikun', '/jackpot/chikun']);
  // The marquee hides for another cabinet, and when the player switched cabinets while it loaded.
  assert.equal(await renderChikunJackpotPanel(mount, { gameId: 'stacked', documentRef, fetchImpl, now }), null);
  assert.equal(panel.hidden, true);
  mount.dataset.gameId = 'stacked';
  assert.equal(await renderChikunJackpotPanel(mount, { gameId: 'chikun', documentRef, fetchImpl, now, setTimeoutImpl: () => 0, clearTimeoutImpl: () => {} }), null);
  // After the close on the corrected clock, the marquee hides although the cached answer says open: the
  // CDN answer was made a minute before the close and held 100 s (Age), so the server time is past it.
  mount.dataset.gameId = 'chikun';
  resetJackpotMemo();
  const stale = spyFetch(answeredAt(fixture('open-funded-capped'), CLOSE - 60_000), { headers: { age: '100' } });
  assert.equal(await renderChikunJackpotPanel(mount, { gameId: 'chikun', documentRef, fetchImpl: stale.fetchImpl, now: () => CLOSE + 40_000 }), null);
});

test('testnet token amounts are labelled as having no value, per week', async () => {
  const { fetchImpl } = spyFetch(fixture('paid-history-two-tokens'));
  const documentRef = fakeDocument();
  const header = createJackpotBoardHeader({ documentRef, fetchImpl, now });
  header.shown('chikun', 'weekly');
  await flush();
  const card = header.shown('chikun', 'weekly').render(documentRef.body);
  const text = visibleText(card);
  assert.match(text, /^ŁWeekly Jackpot10,000 CHIKUN/, 'the current real token carries no testnet note');
  const rows = card.querySelectorAll('li').map((row) => visibleText(row));
  assert.deepEqual(rows.map((row) => row.match(/[\d,]+ t?CHIKUN(?: \(testnet token, no value\))?/)[0]), ['2,500 CHIKUN', '1,500 CHIKUN', '9,000 tCHIKUN (testnet token, no value)']);
});

test('leader wording stays provisional until the week is paid and the open-week leader shows no name', async () => {
  const documentRef = fakeDocument();
  const mount = documentRef.body.appendChild(documentRef.createElement('section'));
  mount.dataset.gameId = 'chikun';
  const panel = await renderChikunJackpotPanel(mount, { gameId: 'chikun', documentRef, fetchImpl: spyFetch(fixture('open-funded')).fetchImpl, now, setTimeoutImpl: () => 0, clearTimeoutImpl: () => {} });
  assert.match(visibleText(panel), /top score 48,213 \(provisional\)/);
  assert.doesNotMatch(visibleText(panel), /SkyChikun|0x|Lester Fan/, 'no name or wallet for the open week');
  resetJackpotMemo();
  const header = createJackpotBoardHeader({ documentRef, fetchImpl: spyFetch(fixture('review-with-candidates')).fetchImpl, now: () => NOW + 7 * 86_400_000 });
  header.shown('chikun', 'weekly');
  await flush();
  const text = visibleText(header.shown('chikun', 'weekly').render(documentRef.body));
  assert.ok(text.includes(`Last week (${W40}): pending review`), 'a reviewed week with a clear leader is still pending, and names nobody');
  assert.doesNotMatch(text, /SkyChikun/);
});

test('entry modal jackpot row never delays the entry, opens rules in a new tab and hides below the minimum or after the close', async () => {
  // main.js glue: the row is found in the modal and the loader is called without await, before the
  // modal shows; a missing row (the entry-flow test fakes) calls nothing.
  const entry = mainFunction('requestRankedEntry');
  assert.match(entry, /const jackpotRow = modal\.querySelector\?\.\('#rankedEntryJackpot'\);\n\s+if \(jackpotRow\) showEntryJackpot\(\{ row: jackpotRow, gameId: requestedGameId, session: pendingSession, quote: \(\) => entryTotalWei, open: \(\) => !closed \}\);/);
  assert.doesNotMatch(entry, /await\s+showEntryJackpot|showEntryJackpot\([^)]*\)\.then/, 'never awaited');
  const index = readFileSync(new URL('../apps/portal/index.html', import.meta.url), 'utf8');
  assert.match(index, /<div class="ranked-entry-rows">[\s\S]*<div id="rankedEntryJackpot" class="ranked-entry-row ranked-entry-jackpot" hidden><\/div>\n\s*<\/div>/, 'one hidden, empty row inside .ranked-entry-rows');

  const documentRef = fakeDocument();
  const row = documentRef.body.appendChild(documentRef.createElement('div'));
  const session = { sessionId: 'game-session-jackpot-1', entryReceipt: null };
  let quote = '0';
  let open = true;
  const ticks = [];
  const { fetchImpl, calls } = spyFetch(fixture('open-funded'));
  let resolveFetch;
  const slow = (url, init) => new Promise((resolve) => { resolveFetch = () => resolve(fetchImpl(url, init)); });
  const pending = showEntryJackpot({ row, gameId: 'chikun', session, quote: () => quote, open: () => open, documentRef, fetchImpl: slow, now, setTimeoutImpl: (callback, ms) => ticks.push({ callback, ms }) });
  assert.equal(row.hidden, true, 'hidden until the API answers; the modal is usable meanwhile');
  resolveFetch();
  await pending;
  assert.equal(row.hidden, true, 'the preview quote of 0 is below minPaidWei');
  quote = '102000000000000000';
  ticks.shift().callback();
  assert.equal(row.hidden, false, 'the contract quote meets the minimum');
  assert.equal(visibleText(row), "This week's jackpot10,000 tCHIKUN (testnet token, no value) · Entries don't fund the prize · Rules ↗");
  const rules = row.querySelector('a');
  assert.deepEqual([rules.href, rules.target, rules.rel], ['/jackpot/chikun', '_blank', 'noopener']);
  quote = '99999999999999999';
  ticks.shift().callback();
  assert.equal(row.hidden, true, 'hidden below minPaidWei (0.1 zkLTC)');
  assert.equal(jackpotEntryFor(session.sessionId).session, session, 'the results line can read this entry');
  assert.equal(calls.length, 1);
  // Last 5 minutes: the next-week note; after the close: hidden.
  resetJackpotMemo();
  let clock = CLOSE - LAST_MINUTES_MS + 1_000;
  const late = documentRef.body.appendChild(documentRef.createElement('div'));
  const lateTicks = [];
  const lateFetch = spyFetch(answeredAt(fixture('open-funded'), clock)).fetchImpl;
  await showEntryJackpot({ row: late, gameId: 'chikun', session, quote: () => '102000000000000000', open: () => open, documentRef, fetchImpl: lateFetch, now: () => clock, setTimeoutImpl: (callback) => lateTicks.push(callback) });
  assert.match(visibleText(late), new RegExp(NEXT_WEEK_NOTE));
  clock = CLOSE;
  lateTicks.shift()();
  assert.equal(late.hidden, true, 'hidden from closesAt on the corrected clock');
  // A closed modal stops refreshing and leaves the row to the next opening.
  open = false;
  assert.equal(lateTicks.length, 1);
  lateTicks.shift()();
  assert.equal(lateTicks.length, 0);
  // A player who confirms the payment before the answer arrives (the modal closes first) still gets
  // the entry noted, with the time the modal was seen open as a lower bound of the payment.
  resetJackpotMemo();
  let modalOpen = true;
  let answer;
  const quick = { sessionId: 'game-session-jackpot-quick', entryReceipt: { amountWei: '102000000000000000' } };
  const pendingAnswer = showEntryJackpot({ row: documentRef.body.appendChild(documentRef.createElement('div')), gameId: 'chikun', session: quick, quote: () => '102000000000000000', open: () => modalOpen, documentRef, fetchImpl: (url, init) => new Promise((resolve) => { answer = () => resolve(fetchImpl(url, init)); }), now, setTimeoutImpl: () => 0 });
  modalOpen = false;
  answer();
  assert.equal(await pendingAnswer, null, 'nothing to show in a closed modal');
  assert.equal(jackpotEntryFor(quick.sessionId)?.seenAtMs, NOW, 'noted for the results line all the same');
  const standing = jackpotStanding({ api: fixture('open-funded'), correctedNowMs: NOW + 600_000, gameId: 'chikun', state: 'published', server: { score: 60000, contract: { survivalSeconds: 600 } }, entry: jackpotEntryFor(quick.sessionId) });
  assert.equal(standing.label, JACKPOT_LEAD_LABEL);
  // A modal already closed when the chunk arrives gives no bound on the payment: nothing is noted.
  const late2 = { sessionId: 'game-session-jackpot-late' };
  await showEntryJackpot({ row: documentRef.body.appendChild(documentRef.createElement('div')), gameId: 'chikun', session: late2, open: () => false, documentRef, fetchImpl, now });
  assert.equal(jackpotEntryFor(late2.sessionId), null);
  // Other games get nothing.
  const hmh = documentRef.body.appendChild(documentRef.createElement('div'));
  assert.equal(await showEntryJackpot({ row: hmh, gameId: 'lester-blaster', documentRef, fetchImpl, now }), null);
  assert.equal(hmh.hidden, true);
});

test('results line compares against the jackpot leader, not the board rank', async () => {
  const api = JSON.parse(JSON.stringify(fixture('open-funded')));
  const week = { startsAt: Date.parse(api.current.startsAt) };
  const entry = (overrides = {}) => ({ session: { entryReceipt: { amountWei: '102000000000000000' } }, seenAtMs: week.startsAt + 86_400_000, ...overrides });
  const server = (score, survivalSeconds = 900) => ({ score, contract: { survivalSeconds } });
  const base = { api, correctedNowMs: NOW, gameId: 'chikun', state: 'published' };
  assert.deepEqual({ ...jackpotStanding({ ...base, server: server(50000), entry: entry() }) }, { text: JACKPOT_LEAD_TEXT, label: JACKPOT_LEAD_LABEL });
  // A tie is not a lead: the earlier on-chain publish wins it, and the open-week leader has no session
  // id, so the client cannot tell this run from an earlier one with the same score (design §D.3 "above").
  assert.deepEqual({ ...jackpotStanding({ ...base, server: server(48213), entry: entry() }) }, { text: JACKPOT_TIE_TEXT, label: null }, 'a tie reads as a tie, with no share label');
  assert.equal(JACKPOT_TIE_TEXT, 'Tied with the jackpot leader (provisional)');
  assert.deepEqual({ ...jackpotStanding({ ...base, server: server(48214), entry: entry() }) }, { text: JACKPOT_LEAD_TEXT, label: JACKPOT_LEAD_LABEL }, 'one point above leads');
  assert.deepEqual({ ...jackpotStanding({ ...base, server: server(40000), entry: entry() }) }, { text: '8,213 points behind the jackpot leader (provisional)', label: null });
  // Ineligible runs get nothing, whatever their board rank.
  assert.equal(jackpotStanding({ ...base, server: server(90000, 3600), entry: entry() }), null, 'over the survival cap');
  assert.equal(jackpotStanding({ ...base, server: server(90000), entry: entry({ session: { entryReceipt: { amountWei: '99999999999999999' } } }) }), null, 'paid below minPaidWei');
  assert.equal(jackpotStanding({ ...base, server: server(90000), entry: null }), null, 'unknown entry');
  assert.equal(jackpotStanding({ ...base, server: server(90000), entry: entry({ seenAtMs: week.startsAt - 1 }) }), null, 'paid in the previous week');
  assert.equal(jackpotStanding({ ...base, state: 'verifying', server: null, entry: entry() }), null, 'not verified yet');
  assert.equal(jackpotStanding({ ...base, state: 'rejected', server: server(90000), entry: entry() }), null);
  assert.equal(jackpotStanding({ ...base, correctedNowMs: CLOSE, server: server(90000), entry: entry() }), null, 'the week closed');
  assert.equal(jackpotStanding({ ...base, gameId: 'stacked', server: server(90000), entry: entry() }), null);
  assert.equal(jackpotStanding({ ...base, api: fixture('open-unfunded'), server: server(90000), entry: entry() }), null, 'no race without a funded prize');
  const noLeader = JSON.parse(JSON.stringify(api));
  noLeader.current.leader = null;
  assert.equal(jackpotStanding({ ...base, api: noLeader, server: server(10), entry: entry() }).label, JACKPOT_LEAD_LABEL, 'the first eligible run leads');
  const source = readFileSync(new URL('../apps/portal/src/jackpot/jackpot-results-line.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\/api\/leaderboard|you\.rank|\.rank/, 'never reads the board rank');
});

test('results line uses the existing share label and leaves share-links unchanged', async () => {
  assert.equal(JACKPOT_LEAD_LABEL.length, 22);
  const shareLinks = readFileSync(new URL('../apps/portal/src/share-links.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(shareLinks, /jackpot/i, 'share-links.mjs knows nothing about the jackpot');
  const sessionId = 'game-session-jackpot-results';
  noteJackpotEntry(sessionId, { session: { entryReceipt: { amountWei: '102000000000000000' } }, seenAtMs: NOW - 3_600_000 });
  const documentRef = fakeDocument();
  const snapshot = { state: 'published', gameId: 'chikun', sessionId32: `0x${'ab'.repeat(32)}`, wallet: `0x${'a1'.repeat(20)}`, localScore: 50000, entry: { status: 'confirmed', txHash: null }, server: { score: 50000, contract: { survivalSeconds: 900 }, stats: {}, achievements: [], status: 'confirmed' } };
  const handle = { snapshot, subscribe: () => () => {} };
  const { fetchImpl, calls } = spyFetch(fixture('open-funded'));
  const standingCalls = [];
  const screen = openRankedResults({
    handle, jackpotLive: true, documentRef, mount: documentRef.body, windowRef: {},
    context: { gameId: 'chikun', sessionId, wallet: `0x${'a1'.repeat(20)}` },
    fetchImpl: async (url, init) => (String(url).startsWith('/api/jackpot') ? fetchImpl(url, init) : (standingCalls.push(url), responseOf({ ok: true, you: null }))),
  });
  await flush(20);
  assert.equal(jackpotCalls(calls).length, 1);
  const line = documentRef.body.querySelector('.rr-jackpot');
  assert.equal(line.hidden, false);
  assert.equal(line.textContent, JACKPOT_LEAD_TEXT);
  assert.match(screen.model.share.text, /50,000 pts · Jackpot lead \(pending\)/);
  screen.close();

  // The run goes straight from verifying to published (POST /api/settle waits for the receipt) after
  // the jackpot answer loaded: the render that reaches 'published' also settles the label, and the share
  // text of that same render carries it (no nested render overwritten by a stale model). Not hosted, so
  // no later standing render could hide a lost label.
  resetJackpotMemo();
  const direct = fakeDocument();
  const run = { ...snapshot, state: 'verifying', server: null };
  let notify = () => {};
  const flipping = { get snapshot() { return run; }, subscribe: (listener) => { notify = listener; return () => {}; } };
  const answered = spyFetch(fixture('open-funded'));
  const directScreen = openRankedResults({
    handle: flipping, jackpotLive: true, hosted: false, documentRef: direct, mount: direct.body, windowRef: {},
    context: { gameId: 'chikun', sessionId, wallet: `0x${'a1'.repeat(20)}` },
    fetchImpl: answered.fetchImpl,
  });
  await flush(20);
  assert.equal(jackpotCalls(answered.calls).length, 1, 'the answer is loaded while the run verifies');
  assert.equal(direct.body.querySelector('.rr-jackpot').hidden, true, 'nothing to say before the run is verified');
  Object.assign(run, { state: 'published', server: snapshot.server });
  notify(run);
  assert.equal(direct.body.querySelector('.rr-jackpot').textContent, JACKPOT_LEAD_TEXT);
  assert.match(directScreen.model.share.text, /50,000 pts · Jackpot lead \(pending\)/, 'the share text of the render that reached published');
  directScreen.close();
  // Another game never loads the line.
  resetJackpotMemo();
  const other = fakeDocument();
  const stacked = openRankedResults({ handle: { snapshot: { ...snapshot, gameId: 'stacked' }, subscribe: () => () => {} }, jackpotLive: true, documentRef: other, mount: other.body, windowRef: {}, context: { gameId: 'stacked', sessionId }, fetchImpl });
  await flush(10);
  assert.equal(other.body.querySelector('.rr-jackpot'), null);
  assert.equal(jackpotCalls(calls).length, 1);
  stacked.close();
});

test('scores header shows history with date ranges, replay and transaction links', async () => {
  const calls = installGlobalFetch(fixture('claim-pending'));
  const board = leaderboardHarness({ jackpotLive: true });
  await board.view.hydrate();
  board.render();
  await flush(20);
  board.render();
  assert.equal(jackpotCalls(calls).length, 1);
  const header = board.grid.querySelector('.jackpot-board-header');
  assert.ok(header, 'the header renders on Chikun · Weekly');
  const text = visibleText(header);
  assert.match(text, /10,000 tCHIKUN \(testnet token, no value\)/);
  assert.ok(text.includes(`${W40} · closes in 3d 12h · closes `), text);
  assert.match(text, /closes in 3d 12h · closes .+ · Mon 00:00 UTC/, 'the local close time next to UTC (the local zone is the machine one)');
  assert.match(text, /top score 48,213 \(provisional\)/);
  assert.match(text, new RegExp(JACKPOT_BOARD_NOTE.replace(/[.()]/g, '\\$&')));
  assert.doesNotMatch(text, /2026-W\d\d/, 'no ISO week keys');
  const rows = header.querySelectorAll('li');
  assert.equal(rows.length, 2);
  assert.equal(visibleText(rows[0]), `${W39} · SkyChikun · 51,022 pts · 8,000 tCHIKUN · Claim pending · Transaction · Watch`, 'the testnet note went with this week\'s prize');
  assert.equal(visibleText(rows[1]), `${W38} · Lester Fan · 50,110 pts · 5,000 tCHIKUN · Claim pending · Transaction · Watch`);
  const links = rows[0].querySelectorAll('a');
  assert.equal(links[0].href, `https://liteforge.explorer.caldera.xyz/tx/0x${'9f'.repeat(32)}`);
  assert.equal(links[1].href, `/chikun/index.html?replay=${encodeURIComponent(`/api/jackpot/replay?session=0x${'a1'.repeat(32)}`)}`);
  // The board's "resets in" runs on the header's corrected clock: a CDN answer 120 s old read by a
  // viewer clock 2 minutes slow.
  resetJackpotMemo();
  globalThis.fetch = async () => responseOf(fixture('open-funded'), { headers: { age: '120' } });
  const skewed = leaderboardHarness({ jackpotLive: true });
  await skewed.view.hydrate();
  skewed.render();
  await flush(20);
  skewed.render();
  const reset = visibleText(skewed.grid);
  const corrected = Date.parse('2026-10-01T12:00:00.000Z') + 120_000;
  assert.ok(reset.includes(`resets ${formatResetCountdown('2026-10-05T00:00:00.000Z', corrected)}`), 'the board countdown uses the corrected clock');
  // Another game or period shows no header and fetches nothing more.
  const before = jackpotCalls(calls).length;
  skewed.routeState.gameId = 'stacked';
  skewed.render();
  skewed.routeState.gameId = 'chikun';
  skewed.routeState.cadence = 'monthly';
  skewed.render();
  assert.equal(skewed.grid.querySelector('.jackpot-board-header'), null);
  assert.equal(jackpotCalls(calls).length, before);
});

test('profile lists jackpot wins and offers claim to a claim-pending winner', async () => {
  const winner = `0x${'a1'.repeat(20)}`;
  const contract = `0x${'1a'.repeat(20)}`;
  const deployment = { status: 'deployed', instances: { chikun: { address: contract, retired: [{ address: `0x${'2b'.repeat(20)}` }] } } };
  const wins = [
    { weekKey: '2026-W39', startsAt: '2026-09-21T00:00:00.000Z', closesAt: '2026-09-28T00:00:00.000Z', prizeWei: (8000n * E18).toString(), unclaimedWei: (8000n * E18).toString(), status: 'claim-pending', token: { symbol: 'tCHIKUN', decimals: 18, testnet: true }, contract, score: 51022, sessionId: `0x${'a1'.repeat(32)}`, finalizeTx: `0x${'9f'.repeat(32)}` },
    { weekKey: '2026-W38', startsAt: '2026-09-14T00:00:00.000Z', closesAt: '2026-09-21T00:00:00.000Z', prizeWei: (5000n * E18).toString(), unclaimedWei: '0', status: 'paid', token: { symbol: 'tCHIKUN', decimals: 18, testnet: true }, contract, score: 50110, sessionId: `0x${'d4'.repeat(32)}`, finalizeTx: `0x${'e5'.repeat(32)}` },
  ];
  // Pure call encoding, checked against the contract ABI.
  const iface = new ethers.Interface(JSON.parse(readFileSync(new URL('../contracts/artifacts/WeeklyJackpot.json', import.meta.url), 'utf8')).abi);
  assert.equal(iface.getFunction('claim').selector, CLAIM_SELECTOR);
  const call = claimCall({ contract, startsAt: wins[0].startsAt, to: `0x${'c3'.repeat(20)}` }, deployment);
  assert.equal(call.week, 2960);
  assert.deepEqual(iface.decodeFunctionData('claim', call.data).map(String), ['2960', ethers.getAddress(`0x${'c3'.repeat(20)}`)]);
  assert.equal(claimCall({ contract: `0x${'ff'.repeat(20)}`, startsAt: wins[0].startsAt, to: winner }, deployment), null, 'never an unknown contract');
  assert.equal(claimCall({ contract, startsAt: wins[0].startsAt, to: 'not-an-address' }, deployment), null);
  assert.deepEqual([...knownJackpotContracts(deployment)], [contract, `0x${'2b'.repeat(20)}`]);
  assert.equal(knownJackpotContracts({ status: 'undeployed' }).size, 0);

  // The view loads the section only with the override, and only for a profile with wins.
  const off = profileHarness({ wins });
  await off.view.hydrate();
  off.view.render();
  await flush(10);
  assert.equal(off.grid.querySelector('.jackpot-wins'), null);

  const sent = [];
  const provider = {
    async request({ method, params }) {
      if (method === 'wallet_switchEthereumChain') return null;
      if (method === 'eth_chainId') return '0x1159';
      if (method === 'eth_getBlockByNumber') return { baseFeePerGas: '0x3b9aca00' };
      if (method === 'eth_sendTransaction') { sent.push(params[0]); return `0x${'77'.repeat(32)}`; }
      throw new Error(`unexpected ${method}`);
    },
  };
  const documentRef = fakeDocument();
  const mount = documentRef.body.appendChild(documentRef.createElement('div'));
  let claimLoads = 0;
  const loadClaimForm = () => { claimLoads += 1; return import('../apps/portal/src/jackpot/jackpot-profile-claim.mjs'); };
  renderJackpotWins({ mount, wins, wallet: winner, own: true, connectedWallet: winner, walletProviderForAction: async () => provider, deployment, documentRef, loadClaimForm });
  await flush(10);
  assert.equal(claimLoads, 1, 'the Claim form downloads only for the claim-pending win of its own winner');
  const card = mount.querySelector('.jackpot-wins');
  assert.match(visibleText(card), /^ŁJackpot Champion/);
  const rows = card.querySelectorAll('li');
  assert.ok(visibleText(rows[0]).startsWith(`${W39} · 8,000 tCHIKUN (testnet token, no value) · 51,022 pts · Claim pending · Transaction`), visibleText(rows[0]));
  assert.equal(visibleText(rows[1]), `${W38} · 5,000 tCHIKUN · 50,110 pts · Transaction`);
  assert.equal(rows[1].querySelector('form'), null, 'a paid win has nothing to claim');
  const input = rows[0].querySelector('input');
  assert.equal(input.value, winner, 'to defaults to the connected wallet');
  assert.match(visibleText(rows[0]), new RegExp(UNCLAIMED_NOTICE.replace(/[.]/g, '\\.')));
  input.value = `0x${'c3'.repeat(20)}`;
  await input.dispatch('input');
  await card.querySelector('button').click();
  await flush(10);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, contract);
  assert.equal(sent[0].from, winner);
  assert.equal(sent[0].chainId, '0x1159');
  assert.equal(sent[0].maxFeePerGas, `0x${(5_000_000_000n * 2n).toString(16)}`, 'ten times the base fee (1 gwei), above the 5 gwei floor');
  assert.equal(sent[0].maxPriorityFeePerGas, '0x0');
  assert.deepEqual(iface.decodeFunctionData('claim', sent[0].data).map(String), ['2960', ethers.getAddress(`0x${'c3'.repeat(20)}`)]);
  const status = mount.querySelector('.jackpot-status');
  assert.match(visibleText(status), /Claim sent/);
  // A wallet that stays on another chain gets plain words and sends nothing.
  const offChain = { async request({ method }) { if (method === 'wallet_switchEthereumChain') throw Object.assign(new Error('rejected'), { code: 4001 }); if (method === 'eth_chainId') return '0x1'; throw new Error(`unexpected ${method}`); } };
  const offDoc = fakeDocument();
  const offMount = offDoc.body.appendChild(offDoc.createElement('div'));
  renderJackpotWins({ mount: offMount, wins: [{ ...wins[0], weekKey: '2026-W39-off' }], wallet: winner, own: true, connectedWallet: winner, walletProviderForAction: async () => offChain, deployment, documentRef: offDoc, loadClaimForm });
  await flush(10);
  await offMount.querySelector('button').click();
  await flush(10);
  assert.match(visibleText(offMount.querySelector('.jackpot-status')), /Switch your wallet to LitVM LiteForge \(chain 4441\), then claim again\./);
  assert.equal(status.querySelector('a').href, `https://liteforge.explorer.caldera.xyz/tx/0x${'77'.repeat(32)}`);

  // Another viewer (or a signed-out visitor) sees the win without a Claim button.
  for (const connectedWallet of [`0x${'b2'.repeat(20)}`, null]) {
    const other = fakeDocument();
    const otherMount = other.body.appendChild(other.createElement('div'));
    let loads = 0;
    renderJackpotWins({ mount: otherMount, wins, wallet: winner, own: connectedWallet === winner, connectedWallet, deployment, documentRef: other, loadClaimForm: () => { loads += 1; return import('../apps/portal/src/jackpot/jackpot-profile-claim.mjs'); } });
    await flush(5);
    assert.equal(loads, 0);
    assert.equal(otherMount.querySelector('form'), null);
    assert.match(visibleText(otherMount), /Claim pending/);
  }
  // The hosted view with the override renders the section from profile.jackpot.wins.
  const on = profileHarness({ jackpotLive: true, wins });
  await on.view.hydrate();
  on.view.render();
  await flush(20);
  assert.ok(on.grid.querySelector('.jackpot-wins'));
});
