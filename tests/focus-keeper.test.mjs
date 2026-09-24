// Live UI audit 2026-09-24: the hosted Scores and Profile views rebuild their
// DOM on every render, and before focus-keeper.mjs each render dropped
// keyboard focus to <body>. On production the /scores search box lost focus
// as soon as its results arrived (the next keys typed went nowhere), and the
// period, cabinet and profile game tabs lost it when pressed. A small DOM
// double with real parent links, focus and selector matching proves the fix.
import assert from 'node:assert/strict';
import test from 'node:test';

import { focusKeyFor, focusSelectorFor, renderKeepingFocus, restoreFocus } from '../apps/portal/src/focus-keeper.mjs';
import { createOfficialLeaderboardRoute } from '../apps/portal/src/routes/official-leaderboard-route.mjs';
import * as hostedLeaderboardView from '../apps/portal/src/routes/hosted-leaderboard-view.mjs';
import { createHostedProfileView } from '../apps/portal/src/routes/hosted-profile-view.mjs';

// --- A DOM double: parents, focus, className/dataset selectors --------------
function miniDom() {
  const doc = { activeElement: null, createTextNode: (text) => ({ text, children: [], parent: null }) };
  const matches = (node, selector) => {
    const parsed = /^([a-z][a-z0-9-]*)?((?:\.[\w-]+)*)((?:\[data-[a-z-]+="[^"]*"\])*)$/.exec(selector);
    if (!parsed || (parsed[1] && String(node.tagName ?? '').toLowerCase() !== parsed[1])) return false;
    const classes = String(node.className ?? '').split(/\s+/);
    if (!parsed[2].split('.').filter(Boolean).every((name) => classes.includes(name))) return false;
    for (const [, key, value] of parsed[3].matchAll(/\[data-([a-z-]+)="([^"]*)"\]/g)) {
      const prop = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      if (String(node.dataset?.[prop]) !== value) return false;
    }
    return true;
  };
  class Node {
    constructor(tag, props = {}) {
      const { dataset, ...rest } = props;
      Object.assign(this, { tagName: tag.toUpperCase(), children: [], parent: null, attributes: {}, listeners: {}, className: '', dataset: { ...(dataset ?? {}) }, style: {} }, rest);
      this.ownerDocument = doc;
      const classes = () => String(this.className ?? '').split(/\s+/).filter(Boolean);
      this.classList = {
        add: (...names) => { this.className = [...new Set([...classes(), ...names])].join(' '); },
        remove: (...names) => { this.className = classes().filter((name) => !names.includes(name)).join(' '); },
        toggle: (name, force) => { const on = force ?? !classes().includes(name); if (on) this.classList.add(name); else this.classList.remove(name); return on; },
        contains: (name) => classes().includes(name),
      };
    }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    // Like a browser, removing the focused element moves focus to <body>.
    replaceChildren(...nodes) {
      for (const child of this.children) {
        if (child.contains?.(doc.activeElement)) doc.activeElement = doc.body;
        child.parent = null;
      }
      this.children = [];
      this.append(...nodes);
    }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    focus() { doc.activeElement = this; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    contains(node) { for (let cursor = node; cursor; cursor = cursor.parent) if (cursor === this) return true; return false; }
    querySelectorAll(selector) {
      const found = [];
      const walk = (node) => { for (const child of node.children ?? []) { if (child.tagName && matches(child, selector)) found.push(child); walk(child); } };
      walk(this);
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }
  const body = new Node('body');
  doc.body = body;
  doc.querySelector = (selector) => body.querySelector(selector);
  const el = (tag, props = {}) => new Node(tag, props);
  const appendText = (parent, tag, content, className = '') => { const child = el(tag, { textContent: content, className }); parent.append(child); return child; };
  return { doc, body, el, appendText, Node };
}
const walk = (root, visit) => { visit(root); for (const child of root.children ?? []) walk(child, visit); };
const byClass = (root, className) => { const hits = []; walk(root, (node) => { if (String(node.className ?? '').split(/\s+/).includes(className)) hits.push(node); }); return hits; };
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('a focus key names the control by tag, stable classes and data attributes', () => {
  const { el } = miniDom();
  const tab = el('button', { className: 'pixel-button leaderboard-cadence-tab is-active', dataset: { cadence: 'monthly' } });
  assert.equal(focusSelectorFor(tab), 'button.pixel-button.leaderboard-cadence-tab[data-cadence="monthly"]', 'state classes are not part of the identity');
  const odd = el('li', { className: 'row', dataset: { note: 'a"b', game: 'chikun' } });
  assert.equal(focusSelectorFor(odd), 'li.row[data-game="chikun"]', 'values that could break the selector are left out');
  assert.equal(focusSelectorFor(null), null);
});

test('restoreFocus finds the same control, keeps the caret and skips disabled ones', () => {
  const { doc, el, body } = miniDom();
  const grid = el('div');
  body.append(grid);
  const first = [el('button', { className: 'pixel-button' }), el('button', { className: 'pixel-button' })];
  const search = el('input', { className: 'leaderboard-search', value: '0x88', selectionStart: 2, selectionEnd: 4 });
  grid.append(...first, search);
  first[1].focus();
  const buttonKey = focusKeyFor(doc.activeElement, grid);
  assert.deepEqual(buttonKey, { selector: 'button.pixel-button', index: 1, selection: null });
  const searchKey = focusKeyFor(search, grid);
  assert.deepEqual(searchKey.selection, { start: 2, end: 4 });
  assert.equal(focusKeyFor(el('button'), grid), null, 'focus outside the view is not tracked');

  const next = [el('button', { className: 'pixel-button' }), el('button', { className: 'pixel-button' })];
  const nextSearch = el('input', { className: 'leaderboard-search', value: '0x88' });
  grid.replaceChildren(...next, nextSearch);
  assert.equal(restoreFocus(buttonKey, grid), true);
  assert.equal(doc.activeElement, next[1], 'the second of two matching buttons, by index');
  assert.equal(restoreFocus(searchKey, grid), true);
  assert.equal(doc.activeElement, nextSearch);
  assert.deepEqual([nextSearch.selectionStart, nextSearch.selectionEnd], [2, 4], 'the caret stays where the player was typing');
  next[0].disabled = true;
  assert.equal(restoreFocus({ selector: 'button.pixel-button', index: 0, selection: null }, grid), false);
  assert.equal(restoreFocus({ selector: 'button.gone', index: 0, selection: null }, grid), false);
});

test('renderKeepingFocus puts focus back after the render rebuilt the view', () => {
  const { doc, el, body } = miniDom();
  const grid = el('div');
  body.append(grid);
  const build = (active) => ['weekly', 'monthly'].map((cadence) => el('button', { className: `pixel-button leaderboard-cadence-tab${cadence === active ? ' is-active' : ''}`, dataset: { cadence } }));
  grid.replaceChildren(...build('weekly'));
  grid.children[1].focus();
  renderKeepingFocus(grid, () => grid.replaceChildren(...build('monthly')));
  assert.equal(doc.activeElement, grid.children[1], 'Monthly keeps focus after it becomes the active tab');
  // A render that moved focus itself is left alone.
  const other = el('input', { className: 'elsewhere' });
  renderKeepingFocus(grid, () => { grid.replaceChildren(...build('weekly'), other); other.focus(); });
  assert.equal(doc.activeElement, other);
  // No document (the node test doubles of other suites): a plain render.
  let rendered = 0;
  renderKeepingFocus({ children: [] }, () => { rendered += 1; });
  assert.equal(rendered, 1);
});

// --- The hosted Scores page -------------------------------------------------
function hostedScores({ answers }) {
  const { doc, body, el, appendText } = miniDom();
  const grid = el('div', { className: 'official-cabinet-grid' });
  body.append(grid);
  const timers = [];
  const pending = [];
  const indexApi = {
    leaderboard: (params) => new Promise((resolve) => { pending.push(() => resolve(answers(params))); }),
  };
  const routeState = { gameId: 'lester-blaster', search: '' };
  const route = createOfficialLeaderboardRoute({
    hosted: true,
    indexApi,
    loadHostedView: () => hostedLeaderboardView,
    dom: { officialCabinetGrid: grid },
    documentRef: doc,
    routeState,
    storage: null,
    windowRef: { location: { pathname: '/scores', search: '' }, history: { state: null, replaceState() {} } },
    getContext: () => ({ connectedWallet: null, state: { profiles: {} } }),
    appendText,
    el,
    now: () => Date.parse('2026-09-24T12:00:00.000Z'),
    getGame: (gameId) => ({ title: gameId }),
    humanList: (items) => items.join(', '),
    playableCabinetNames: () => ['Hard Money Heroes'],
    publicLeaderboardCabinets: () => [{ gameId: 'lester-blaster', id: 'hard-money-heroes', title: 'Hard Money Heroes' }, { gameId: 'chikun', id: 'chikun', title: "Chikun's Escape" }],
    renderArcadeIcon: () => el('span'),
    renderAvatarChip: () => el('img'),
    setTimeoutImpl: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    clearTimeoutImpl: () => {},
  });
  const answerAll = async () => { while (pending.length) pending.shift()(); await settle(); await settle(); };
  return { doc, grid, route, routeState, timers, answerAll };
}

const emptyBoard = (params) => ({ ok: true, gameId: params.game, period: params.period, periodKey: '2026-W39', resetsAt: '2026-09-28T00:00:00.000Z', page: 1, pageSize: 25, total: 0, rows: [], you: null });

test('Scores: the search box keeps focus and caret when its results arrive', async () => {
  const h = hostedScores({ answers: emptyBoard });
  h.route.renderLeaderboards();
  await h.answerAll();
  const search = byClass(h.grid, 'leaderboard-search')[0];
  search.focus();
  search.value = '0x88';
  search.selectionStart = 4;
  search.selectionEnd = 4;
  search.listeners.input();
  h.timers.at(-1).callback(); // the debounce fires: re-render and ask E5
  assert.equal(h.doc.activeElement?.className, 'leaderboard-search', 'focus stays while the request is out');
  await h.answerAll(); // the answer re-renders the whole view
  const after = h.doc.activeElement;
  assert.equal(after?.className, 'leaderboard-search', 'still typing into the search box after the results render');
  assert.notEqual(after, search, 'it is the new input of the re-rendered view');
  assert.equal(after.value, '0x88');
  assert.deepEqual([after.selectionStart, after.selectionEnd], [4, 4]);
});

test('Scores: period and cabinet tabs keep focus after their board loads', async () => {
  const h = hostedScores({ answers: emptyBoard });
  h.route.renderLeaderboards();
  await h.answerAll();
  const monthly = h.grid.querySelector('button.pixel-button.leaderboard-cadence-tab.leaderboard-time-filter.leaderboard-filter-button[data-cadence="monthly"]');
  monthly.focus();
  monthly.listeners.click();
  await h.answerAll();
  assert.equal(h.doc.activeElement?.dataset?.cadence, 'monthly');
  assert.equal(h.doc.activeElement.attributes['aria-pressed'], 'true');

  const chikun = byClass(h.grid, 'leaderboard-game-banner').find((tab) => tab.dataset.game === 'chikun');
  chikun.focus();
  chikun.listeners.click();
  await h.answerAll();
  assert.equal(h.doc.activeElement?.dataset?.game, 'chikun', 'the cabinet tab pressed keeps focus');
  assert.equal(h.doc.activeElement.attributes['aria-selected'], 'true');
});

test('Scores: Show more keeps focus while the next page loads', async () => {
  const rows = (page) => Array.from({ length: 25 }, (_, index) => {
    const rank = (page - 1) * 25 + index + 1;
    const hex = rank.toString(16).padStart(64, '0');
    return { rank, wallet: `0x${rank.toString(16).padStart(40, '0')}`, walletShort: '0x…', displayName: `Pilot ${rank}`, avatarUri: null, score: 100_000 - rank, stats: {}, sessionId32: `0x${hex}`, shareId: hex, txHash: `0x${hex}`, explorerUrl: `https://liteforge.explorer.caldera.xyz/tx/0x${hex}`, confirmedAt: '2026-09-24T10:00:00.000Z' };
  });
  const h = hostedScores({ answers: (params) => ({ ...emptyBoard(params), page: params.page, total: 60, rows: rows(params.page ?? 1) }) });
  h.route.renderLeaderboards();
  await h.answerAll();
  const more = byClass(h.grid, 'leaderboard-show-more')[0];
  more.focus();
  more.listeners.click();
  const loading = h.doc.activeElement;
  assert.equal(loading?.className, 'pixel-button leaderboard-show-more', 'focus survives the loading render');
  assert.equal(loading.attributes['aria-disabled'], 'true', 'marked busy without losing focusability');
  assert.equal(loading.disabled, undefined);
  await h.answerAll();
  assert.equal(h.doc.activeElement?.className, 'pixel-button leaderboard-show-more');
  assert.equal(h.doc.activeElement.textContent, 'Show 10 more');
});

// --- The hosted Profile page ------------------------------------------------
test('Profile: a game tab keeps focus and reports its pressed state', async () => {
  const { doc, body, el, appendText } = miniDom();
  const grid = el('div');
  body.append(grid);
  const wallet = `0x${'ab'.repeat(20)}`;
  const routeState = { gameId: 'lester-blaster', viewedWallet: wallet };
  let view = null;
  view = createHostedProfileView({
    appendText,
    el,
    dom: { officialCabinetGrid: grid },
    getContext: () => ({ connectedWallet: null }),
    indexApi: { profile: async () => ({ ok: true, wallet, profile: { displayName: null, avatarUri: null }, games: {}, recentSessions: [], achievements: [] }) },
    playSfxCue: () => {},
    renderAvatarChip: () => el('img'),
    renderAchievementIcon: () => el('img'),
    renderPage: () => view.render(),
    routeState,
    setView: () => {},
  });
  view.render();
  await view.hydrate();
  const tabs = () => byClass(grid, 'profile-game-tabs')[0].children;
  assert.deepEqual(tabs().map((tab) => tab.attributes['aria-pressed']), ['true', 'false', 'false']);
  assert.equal(byClass(grid, 'profile-game-tabs')[0].attributes['aria-label'], 'Verified stats by game');
  tabs()[2].focus();
  tabs()[2].listeners.click();
  assert.equal(routeState.gameId, 'stacked');
  assert.equal(doc.activeElement, tabs()[2], 'the pressed tab still has focus after the profile re-rendered');
  assert.equal(doc.activeElement.dataset.game, 'stacked');
  assert.deepEqual(tabs().map((tab) => tab.attributes['aria-pressed']), ['false', 'false', 'true']);
});
