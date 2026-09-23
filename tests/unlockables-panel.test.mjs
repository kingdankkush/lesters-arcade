import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  UNLOCKABLES_PANEL_ID,
  UNLOCKABLES_PANEL_STYLESHEET,
  buildUnlockablesPanelModel,
  renderUnlockablesPanel,
  unlockablesNotice,
} from '../apps/portal/src/routes/unlockables-panel.mjs';
import { COSMETIC_SLOTS, UNLOCKABLES, emptyUnlocks, unlocksFromProfileResponse } from '../apps/portal/src/unlockables.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

// A minimal DOM: element tree, attributes, dataset, events and lookups.
class FakeNode {
  constructor(documentRef, tag) {
    this.ownerDocument = documentRef;
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.hidden = false;
    this.textValue = '';
  }
  get id() { return this.attributes.get('id') ?? ''; }
  set id(value) { this.attributes.set('id', String(value)); }
  get className() { return this.attributes.get('class') ?? ''; }
  set className(value) { this.attributes.set('class', String(value)); }
  get textContent() { return this.textValue + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.textValue = String(value); this.children = []; }
  get nextSibling() { const siblings = this.parentNode?.children ?? []; return siblings[siblings.indexOf(this) + 1] ?? null; }
  get previousElementSibling() { const siblings = this.parentNode?.children ?? []; return siblings[siblings.indexOf(this) - 1] ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { node.parentNode?.removeChild?.(node); node.parentNode = this; this.children.push(node); return node; }
  removeChild(node) { this.children = this.children.filter((child) => child !== node); node.parentNode = null; }
  insertBefore(node, reference) {
    node.parentNode?.removeChild?.(node);
    node.parentNode = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
    return node;
  }
  replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.textValue = ''; this.append(...nodes); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
  dispatch(type, init = {}) {
    const event = { type, target: this, defaultPrevented: false, button: 0, preventDefault() { this.defaultPrevented = true; }, ...init };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() { this.scrolled = true; }
  walk(visit) { visit(this); for (const child of this.children) child.walk?.(visit); }
  all(predicate) { const found = []; this.walk((node) => { if (predicate(node)) found.push(node); }); return found; }
  querySelector(selector) {
    if (selector === 'link[data-unlockables-css]') return this.all((node) => node.tagName === 'LINK' && node.dataset.unlockablesCss)[0] ?? null;
    const achievement = /^\[data-achievement="(.+)"\]$/.exec(selector);
    if (achievement) return this.all((node) => node.dataset.achievement === achievement[1])[0] ?? null;
    if (selector === '.achievements-card') return this.all((node) => node.className.split(' ').includes('achievements-card'))[0] ?? null;
    return null;
  }
}
class FakeText extends FakeNode {
  constructor(documentRef, text) { super(documentRef, '#text'); this.textValue = String(text); }
}

function fakeDocument() {
  const documentRef = {
    activeElement: null,
    createElement: (tag) => new FakeNode(documentRef, tag),
    createTextNode: (text) => new FakeText(documentRef, text),
    getElementById: (id) => documentRef.body.all((node) => node.id === id)[0] ?? null,
    querySelector: (selector) => documentRef.body.querySelector(selector),
  };
  documentRef.head = new FakeNode(documentRef, 'head');
  documentRef.body = new FakeNode(documentRef, 'body');
  const app = new FakeNode(documentRef, 'section');
  app.id = 'officialApp';
  app.dataset.step = 'settings';
  const floor = new FakeNode(documentRef, 'section');
  const grid = new FakeNode(documentRef, 'div');
  grid.id = 'officialCabinetGrid';
  const after = new FakeNode(documentRef, 'section');
  floor.append(grid, after);
  app.append(floor);
  documentRef.body.append(app);
  return { documentRef, app, floor, grid };
}

function fakeStore(snapshot) {
  const listeners = new Set();
  const selects = [];
  let current = snapshot;
  return {
    selects,
    snapshot: () => current,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    select: async (gameId, slot, id) => { selects.push([gameId, slot, id]); current = { ...current, selection: { ...current.selection, [gameId]: { ...(current.selection[gameId] ?? {}), [slot]: id } } }; return { ok: true, saved: current.authenticated ? 'wallet' : 'device' }; },
    emit(next) { current = next; for (const fn of [...listeners]) fn(current); },
    get listeners() { return listeners.size; },
  };
}

const previewSnapshot = { hosted: false, wallet: WALLET, authenticated: true, source: 'none', savedAt: null, unlocks: emptyUnlocks(), selection: {} };
function hostedSnapshot(selection = {}) {
  return {
    hosted: true, wallet: WALLET, authenticated: true, source: 'server', savedAt: 1,
    unlocks: unlocksFromProfileResponse({ achievements: [{ id: 'chikun-reach-coast', gameId: 'chikun', tokenId: null }, { id: 'stacked-first-line', gameId: 'stacked', tokenId: null }], games: { 'lester-blaster': { confirmedRuns: 6 } } }),
    selection,
  };
}

test('preview shows the default looks equipped and every other look locked with its achievement', () => {
  const model = buildUnlockablesPanelModel(previewSnapshot);
  assert.match(model.notice, /^Preview · this device\. Only the default looks are available/);
  assert.deepEqual(model.games.map((game) => game.gameId), Object.keys(COSMETIC_SLOTS));
  for (const game of model.games) {
    assert.deepEqual(game.slots.map((slot) => slot.slot), COSMETIC_SLOTS[game.gameId]);
    for (const slot of game.slots) {
      const [first, ...rest] = slot.options;
      assert.equal(first.id, null);
      assert.equal(first.status, 'selected', `${game.gameId} ${slot.slot} default is equipped`);
      assert.ok(rest.length >= 3);
      for (const option of rest) {
        assert.equal(option.status, 'locked', option.id);
        assert.match(option.requirement, /^(Earn .+|Finish \d+ verified Ranked runs)$/);
      }
    }
  }
  const glacier = model.games.find((game) => game.gameId === 'chikun').slots.find((slot) => slot.slot === 'coat').options.find((option) => option.id === 'chikun-coat-glacier');
  assert.deepEqual([glacier.requirement, glacier.achievementId, glacier.achievementTitle], ['Earn Coastal Escape', 'chikun-reach-coast', 'Coastal Escape']);
  const heroes = model.games[0].heroes;
  assert.deepEqual(heroes.map((hero) => [hero.title, hero.status, hero.progress]), [['Lester', 'locked', { current: 0, required: 5 }], ['Lilly', 'locked', { current: 0, required: 10 }]]);
});

test('hosted unlocks show unlocked and equipped looks, and a locked pick is not honoured', () => {
  const model = buildUnlockablesPanelModel(hostedSnapshot({ chikun: { coat: 'chikun-coat-glacier', hat: 'chikun-hat-crown' } }));
  const chikun = model.games.find((game) => game.gameId === 'chikun');
  const coat = chikun.slots.find((slot) => slot.slot === 'coat');
  assert.equal(coat.selectedId, 'chikun-coat-glacier');
  assert.deepEqual(coat.options.map((option) => [option.id, option.status]), [[null, 'unlocked'], ['chikun-coat-golden', 'locked'], ['chikun-coat-glacier', 'selected'], ['chikun-coat-emerald', 'locked'], ['chikun-coat-royal', 'locked']]);
  const hat = chikun.slots.find((slot) => slot.slot === 'hat');
  assert.equal(hat.selectedId, null, 'the locked crown is not honoured');
  assert.equal(hat.options[0].status, 'selected');
  assert.equal(model.games.find((game) => game.gameId === 'stacked').slots[0].options.find((option) => option.id === 'stacked-pieces-silver').status, 'unlocked');
  assert.deepEqual(model.games[0].heroes.map((hero) => hero.status), ['unlocked', 'locked']);
  // Notices by mode.
  assert.match(unlockablesNotice({ hosted: true, wallet: null }), /^Sign in with a wallet/);
  assert.match(unlockablesNotice({ hosted: true, wallet: WALLET, authenticated: false, source: 'cache' }), /Sign in to save your picks to your wallet; until then they stay on this device\. Showing the unlocks saved on this device\./);
  assert.match(unlockablesNotice({ hosted: true, wallet: WALLET, authenticated: true, source: 'server' }), /Your picks save to your wallet\.$/);
});

test('the panel renders an accessible radio group per slot after the route grid', async () => {
  const { documentRef, app, floor, grid } = fakeDocument();
  const store = fakeStore(hostedSnapshot({}));
  const opened = [];
  const frames = [];
  const host = renderUnlockablesPanel({ store, view: 'settings', documentRef, after: grid, app, openAchievements: (detail) => opened.push(detail), requestFrame: (fn) => frames.push(fn) });
  assert.equal(host.id, UNLOCKABLES_PANEL_ID);
  assert.equal(floor.children[1], host, 'the panel sits right after the grid, outside it');
  assert.equal(host.getAttribute('aria-labelledby'), `${UNLOCKABLES_PANEL_ID}Title`);
  assert.equal(host.hidden, false);
  const links = documentRef.head.all((node) => node.tagName === 'LINK');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, UNLOCKABLES_PANEL_STYLESHEET);
  assert.equal(links[0].rel, 'stylesheet');

  const title = host.all((node) => node.tagName === 'H2')[0];
  assert.equal(title.id, `${UNLOCKABLES_PANEL_ID}Title`);
  const sections = host.all((node) => node.tagName === 'SECTION' && node.dataset.game);
  assert.deepEqual(sections.map((section) => section.dataset.game), ['lester-blaster', 'chikun', 'stacked']);
  for (const section of sections) {
    const heading = section.children.find((child) => child.tagName === 'H3');
    assert.equal(section.getAttribute('aria-labelledby'), heading.id);
  }
  const fieldsets = host.all((node) => node.tagName === 'FIELDSET');
  assert.equal(fieldsets.length, Object.values(COSMETIC_SLOTS).flat().length);
  for (const fieldset of fieldsets) {
    assert.equal(fieldset.children[0].tagName, 'LEGEND');
    const radios = fieldset.all((node) => node.tagName === 'INPUT');
    assert.ok(radios.every((radio) => radio.type === 'radio' && radio.name === radios[0].name), 'one native radio group per slot');
    assert.equal(radios.filter((radio) => radio.checked).length, 1, 'exactly one look is equipped');
    for (const radio of radios) {
      const label = radio.parentNode.children.find((child) => child.tagName === 'LABEL');
      assert.equal(label.htmlFor, radio.id, 'every radio has its label');
      assert.equal(radio.disabled, radio.parentNode.dataset.state === 'locked' || radio.parentNode.dataset.state === 'coming-soon');
    }
  }
  // Locked looks name their achievement, linked to the profile achievement list.
  const link = host.all((node) => node.tagName === 'A' && node.dataset.achievementId === 'chikun-coins-60')[0];
  assert.equal(link.textContent, 'Coin Collector');
  assert.equal(link.href, '/profile');
  assert.equal(link.parentNode.textContent, 'Earn Coin Collector');
  const badge = new FakeNode(documentRef, 'article');
  badge.dataset.achievement = 'chikun-coins-60';
  const click = link.dispatch('click');
  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(opened, [{ gameId: 'chikun', achievementId: 'chikun-coins-60' }]);
  grid.append(badge); // the profile renders its achievement list
  frames.shift()();
  assert.equal(badge.scrolled, true);
  assert.equal(documentRef.activeElement, badge, 'focus lands on the achievement badge');
  const modified = link.dispatch('click', { ctrlKey: true });
  assert.equal(modified.defaultPrevented, false, 'a modified click keeps the browser default');
  // Run gates show progress.
  assert.match(host.textContent, /Finish 25 verified Ranked runs \(6\/25\)/);
  assert.match(host.textContent, /Lilly.*Locked · Finish 10 verified Ranked runs \(6\/10\)/);

  // Choosing an unlocked look saves through the store and announces it.
  const silver = host.all((node) => node.tagName === 'INPUT' && node.value === 'stacked-pieces-silver')[0];
  assert.equal(silver.disabled, false);
  silver.checked = true;
  silver.dispatch('change');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(store.selects, [['stacked', 'piece-skin', 'stacked-pieces-silver']]);
  const status = host.all((node) => node.getAttribute('role') === 'status')[0];
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.textContent, 'Piece skin: Litecoin Silver saved to your wallet.');
  const equipped = host.all((node) => node.tagName === 'INPUT' && node.value === 'stacked-pieces-silver')[0];
  assert.equal(equipped.checked, true);
  assert.equal(documentRef.activeElement, equipped, 'focus stays on the chosen look after the repaint');

  // A store update repaints; a second render reuses the host and the stylesheet.
  store.emit(hostedSnapshot({ stacked: { 'piece-skin': 'stacked-pieces-silver' } }));
  const again = renderUnlockablesPanel({ store, view: 'profile', own: true, documentRef, after: grid, app, openAchievements: () => {} });
  assert.equal(again, host);
  assert.equal(documentRef.head.all((node) => node.tagName === 'LINK').length, 1);
  assert.equal(store.listeners, 1, 'one store subscription per panel');
  // Another wallet's profile hides it.
  app.dataset.step = 'profile';
  renderUnlockablesPanel({ store, view: 'profile', own: false, documentRef, after: grid, app });
  assert.equal(host.hidden, true);
});

test('the panel hides itself when the route leaves Settings or the own profile', () => {
  const observers = [];
  const original = globalThis.MutationObserver;
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; observers.push(this); } observe(target, options) { this.target = target; this.options = options; } };
  try {
    const { documentRef, app, grid } = fakeDocument();
    const host = renderUnlockablesPanel({ store: fakeStore(previewSnapshot), view: 'settings', documentRef, after: grid, app });
    assert.equal(observers.length, 1);
    assert.deepEqual(observers[0].options, { attributes: true, attributeFilter: ['data-step'] });
    app.dataset.step = 'leaderboards';
    observers[0].callback();
    assert.equal(host.hidden, true);
    app.dataset.step = 'settings';
    observers[0].callback();
    assert.equal(host.hidden, false);
    app.dataset.step = 'profile';
    observers[0].callback();
    assert.equal(host.hidden, true, 'the Settings panel does not follow onto the profile until the profile renders it');
    renderUnlockablesPanel({ store: fakeStore(previewSnapshot), view: 'profile', documentRef, after: grid, app });
    assert.equal(host.hidden, false);
    assert.equal(observers.length, 1, 'one observer per panel');
    // Preview: every non-default look is disabled.
    const enabled = host.all((node) => node.tagName === 'INPUT' && !node.disabled);
    assert.ok(enabled.every((radio) => radio.value === ''), 'only the default looks can be chosen in preview');
  } finally {
    globalThis.MutationObserver = original;
  }
});

test('the panel ships lazily, builds DOM safely, reads at 320 px and keeps phase 1 copy', () => {
  const panel = read('apps/portal/src/routes/unlockables-panel.mjs');
  assert.doesNotMatch(panel, /innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function/);
  const main = read('apps/portal/main.js');
  assert.match(main, /import\('\.\/src\/routes\/unlockables-panel\.mjs'\)/, 'the panel loads with import()');
  assert.match(main, /import\('\.\/src\/unlockables-store\.mjs'\)/, 'the store loads with import()');
  assert.doesNotMatch(main, /^import .*unlockables/m, 'no static import of the new modules');
  assert.match(main, /const renderOfficialSettings = \(\) => \{ officialShellRoutes\.renderSettings\(\); showUnlockablesPanel\('settings'\); \};/);
  assert.match(main, /const renderOfficialProfile = \(\) => \{ officialProfileRoute\.renderProfile\(\); showUnlockablesPanel\('profile'\); \};/);
  for (const [game, needle] of [['chikun', /reduceMotion: Boolean\(gameSettings\.reduceMotion\),\n\s+\.\.\.childCosmetics\('chikun'\),/], ['stacked', /\.\.\.childCosmetics\('stacked'\) \}, music:/], ['lester-blaster', /settings: \{ \.\.\.hmhRebootSettings\(\), \.\.\.childCosmetics\('lester-blaster'\) \},/]]) {
    assert.match(main, needle, `${game} receives its looks through its settings channel`);
  }
  const css = read('apps/portal/src/styles/unlockables-panel.css');
  assert.match(css, /@media \(max-width: 380px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\.unlockables-panel\[hidden\]/);
  assert.match(css, /minmax\(min\(100%, 136px\), 1fr\)/, 'options wrap instead of scrolling sideways');
  assert.match(css, /\.unlockables-radio:focus-visible \+ \.unlockables-card/);
  const rendered = [previewSnapshot, hostedSnapshot({})].map((snapshot) => {
    const { documentRef, app, grid } = fakeDocument();
    return renderUnlockablesPanel({ store: fakeStore(snapshot), documentRef, after: grid, app }).textContent;
  });
  assert.match(rendered[0], /Earn Coastal Escape/);
  const copy = JSON.stringify([buildUnlockablesPanelModel(previewSnapshot), buildUnlockablesPanelModel(hostedSnapshot({})), unlockablesNotice({ hosted: true, wallet: null }), rendered]);
  assert.doesNotMatch(copy, /\bnft\b|soulbound|minting|minted/i);
  assert.ok(UNLOCKABLES.length >= 26);
});
