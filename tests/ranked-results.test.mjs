import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { RANKED_RESULTS_STYLESHEET, STANDING_RETRY_DELAYS_MS, openRankedResults } from '../apps/portal/src/ranked-results.mjs';
import { catalogFor, nftAchievementIds } from '../apps/portal/src/achievements/index.mjs';
import { buildHmhShareText, buildShareLinks, shareUrlFor } from '../apps/portal/src/share-links.mjs';
import { startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { applySeedTicket } from '../apps/portal/src/ranked-identity.mjs';
import { RANKED_ENTRY_EVENT, recordEntryBroadcast } from '../apps/portal/src/ranked-entry-flow.mjs';
import { rankedGlueContext, until } from './helpers/ranked-client-vm.mjs';

// Contract §7.3 (openRankedResults), §7.7 (events), guide §3.3 and §5.11.
// A minimal fake DOM stands in for jsdom: createElement, tree operations,
// attributes, focus and bubbling events are all the module uses.

class FakeNode {
  constructor(documentRef, tagName) {
    this.ownerDocument = documentRef;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.ownText = '';
  }
  get textContent() { return this.ownText + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node === this.ownerDocument.root;
  }
  appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  insertBefore(child, reference) {
    child.remove();
    const index = this.children.indexOf(reference);
    child.parentNode = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    return child;
  }
  replaceChildren(...nodes) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...nodes); }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  contains(node) { for (let current = node; current; current = current.parentNode) if (current === this) return true; return false; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'href') this.href = ''; }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== fn)); }
  focus() { this.ownerDocument.activeElement = this; }
  querySelector(selector) {
    if (selector === 'link[data-ranked-results-css]') return this.all().find((node) => node.tagName === 'LINK' && node.dataset.rankedResultsCss) ?? null;
    throw new Error(`fake querySelector does not support ${selector}`);
  }
  all() { return this.children.flatMap((child) => [child, ...child.all()]); }
  // Bubbling dispatch with stopPropagation, like the real DOM.
  async dispatch(type, init = {}) {
    const event = { type, target: this, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...init };
    for (let node = this; node && !event.stopped; node = node.parentNode) {
      for (const fn of node.listeners.get(type) ?? []) await fn(event);
    }
    return event;
  }
}

function fakeDocument() {
  const documentRef = {
    activeElement: null,
    listeners: new Map(),
    createElement: (tag) => new FakeNode(documentRef, tag),
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); },
    removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== fn)); },
  };
  documentRef.root = new FakeNode(documentRef, 'html');
  documentRef.head = documentRef.root.appendChild(new FakeNode(documentRef, 'head'));
  documentRef.body = documentRef.root.appendChild(new FakeNode(documentRef, 'body'));
  documentRef.activeElement = documentRef.body;
  return documentRef;
}

function fakeWindow() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) ?? []), fn]); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== fn)); },
    emit(type, detail) { for (const fn of listeners.get(type) ?? []) fn({ type, detail }); },
    matchMedia: () => ({ matches: false }),
  };
}

const WALLET = `0x${'2b'.repeat(20)}`;
const SESSION_ID32 = `0x${'9c'.repeat(32)}`;
const PUBLISH_TX = `0x${'e1'.repeat(32)}`;
const SESSION_ID = 'game-session-11111111-2222-4333-8444-555555555555';

function fakeHandle(initial) {
  let snapshot = initial;
  const subscribers = new Set();
  const handle = {
    sessionId32: SESSION_ID32,
    gameId: initial.gameId,
    get state() { return snapshot.state; },
    get snapshot() { return snapshot; },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    retries: 0,
    async retry() { handle.retries += 1; },
    dispose() {},
    set(next) { snapshot = { ...snapshot, ...next }; for (const fn of subscribers) fn(snapshot); },
    get subscriberCount() { return subscribers.size; },
  };
  return handle;
}

function snapshotFor(state, extra = {}) {
  const server = ['queued', 'publishing', 'published'].includes(state) ? {
    status: { queued: 'signed', publishing: 'submitted', published: 'confirmed' }[state],
    sessionId32: SESSION_ID32, score: 19475, wallet: WALLET,
    stats: { regionReached: 'farmland', laps: 1, forksPassed: 52, nearMisses: 18, coinsCollected: 41, bestCombo: 9 },
    explorerUrl: state === 'published' ? `https://liteforge.explorer.caldera.xyz/tx/${PUBLISH_TX}` : null,
    achievements: [],
  } : null;
  return {
    state, sessionId32: SESSION_ID32, shareId: SESSION_ID32.slice(2), gameId: 'chikun', wallet: WALLET, localScore: 19000,
    entry: { status: state === 'preview' ? 'none' : 'confirmed', txHash: null }, server, error: null, updatedAt: 1, ...extra,
  };
}

function context(extra = {}) {
  return {
    gameId: 'chikun', gameTitle: "Chikun's Escape", sessionId: SESSION_ID, sessionId32: SESSION_ID32, wallet: WALLET, displayName: 'Lit Pilot',
    localScore: 19000, localStats: { regionReached: 'forest', laps: 0, forksPassed: 30, nearMisses: 8, coinsCollected: 20, bestCombo: 5 },
    previousBest: 15000, entry: { status: 'confirmed', txHash: null }, mode: 'ranked', ...extra,
  };
}

// setTimeout stand-in: nothing runs until the test calls runNext().
function fakeTimers() {
  const pending = new Map();
  let next = 1;
  return {
    pending,
    setTimeoutImpl: (fn, ms) => { const id = next++; pending.set(id, { fn, ms }); return id; },
    clearTimeoutImpl: (id) => { pending.delete(id); },
    get delays() { return [...pending.values()].map((entry) => entry.ms); },
    async runNext() {
      const [id, entry] = [...pending][0] ?? [];
      if (!id) return null;
      pending.delete(id);
      entry.fn();
      await flush();
      return entry.ms;
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup({ snapshot = snapshotFor('published'), hosted = false, live = true, fetchImpl, ctx = context(), actions, patchWindow, onClose } = {}) {
  const documentRef = fakeDocument();
  const windowRef = fakeWindow();
  patchWindow?.(windowRef);
  const mount = documentRef.body.appendChild(documentRef.createElement('section'));
  const opener = documentRef.body.appendChild(documentRef.createElement('button'));
  opener.focus();
  const handle = fakeHandle(snapshot);
  const timers = fakeTimers();
  const calls = [];
  const fetches = [];
  const closed = [];
  const view = openRankedResults({
    handle,
    context: ctx,
    actions: actions ?? {
      playAgainRanked: () => calls.push('playAgainRanked'), practiceFree: () => calls.push('practiceFree'),
      viewProfile: () => calls.push('viewProfile'), backToArcade: () => calls.push('backToArcade'),
    },
    documentRef, windowRef, mount, live, hosted,
    navigatorRef: { clipboard: { writeText: async () => {} } },
    fetchImpl: fetchImpl ?? (async (url, init) => { fetches.push({ url, init }); throw new Error('offline'); }),
    onClose: onClose ?? ((closedView) => { closed.push(closedView); }),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
  });
  return { documentRef, windowRef, mount, opener, handle, view, calls, fetches, closed, timers };
}

const find = (root, predicate) => [root, ...root.all()].find(predicate) ?? null;
const findAll = (root, predicate) => [root, ...root.all()].filter(predicate);
const byClass = (root, className) => find(root, (node) => String(node.className ?? '').split(/\s+/).includes(className));
const buttonNamed = (root, text) => find(root, (node) => node.tagName === 'BUTTON' && node.textContent === text);
const visible = (node, stop) => { for (let current = node; current && current !== stop; current = current.parentNode) if (current.hidden || current.style.display === 'none') return false; return true; };

test('results screen renders timeline, achievements and actions from a snapshot', () => {
  const nftId = nftAchievementIds('chikun')[0];
  const catalogEntry = catalogFor('chikun').find((entry) => entry.id === nftId);
  const snapshot = snapshotFor('published');
  snapshot.server.achievements = [{ id: nftId, gameId: 'chikun', title: 'x', tier: 'platinum', nft: true, image: '/x.png', unlockedAt: 't', tokenId: null }];
  const { documentRef, mount, view } = setup({ snapshot });
  const root = view.element;
  assert.equal(root.parentNode, documentRef.body, 'the overlay stacks above the site chrome, not inside the gameplay view');
  assert.equal(mount.contains(root), false);
  const dialog = find(root, (node) => node.getAttribute('role') === 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(documentRef.activeElement, dialog, 'focus moves into the dialog');
  const title = find(root, (node) => node.id === dialog.getAttribute('aria-labelledby'));
  assert.equal(title.textContent, '19,475pts');
  assert.equal(byClass(root, 'rr-handle').textContent, 'Lit Pilot');
  assert.equal(byClass(root, 'rr-standing').textContent, 'New personal best (+4,475)', 'no standing is fetched without hosted');
  assert.match(byClass(root, 'rr-eyebrow').textContent, /Ranked · Chikun's Escape/);

  const timeline = byClass(root, 'rr-timeline');
  assert.equal(timeline.getAttribute('aria-live'), 'polite');
  const steps = findAll(timeline, (node) => node.tagName === 'LI');
  assert.deepEqual(steps.map((node) => node.dataset.step), ['entry', 'verified', 'publishing', 'published', 'achievements']);
  assert.deepEqual(steps.map((node) => node.dataset.status), ['done', 'done', 'done', 'done', 'done']);
  const publishedLink = find(steps[3], (node) => node.tagName === 'A');
  assert.equal(publishedLink.href, `https://liteforge.explorer.caldera.xyz/tx/${PUBLISH_TX}`);
  assert.equal(publishedLink.rel, 'noopener noreferrer');
  assert.equal(publishedLink.hidden, false);
  assert.match(steps[3].textContent, /^✓Done: Published on LitVMView transaction$/, 'icon (aria-hidden), status words for screen readers, label, link');

  const stats = findAll(byClass(root, 'rr-stats'), (node) => node.tagName === 'DT').map((node) => node.textContent);
  assert.deepEqual(stats, ['Region', 'Laps', 'Forks', 'Near-misses', 'Coins', 'Best combo']);

  const badge = byClass(root, 'rr-badge');
  assert.equal(badge.dataset.tier, catalogEntry.tier);
  assert.equal(byClass(badge, 'rr-badge-title').textContent, catalogEntry.title, 'catalog title (achievementById)');
  assert.equal(find(badge, (node) => node.tagName === 'IMG').src, catalogEntry.image, 'catalog image');
  assert.doesNotMatch(root.textContent, /NFT|soulbound|mint/i, 'no NFT wording in phase 1 (A32)');

  const shareRow = byClass(root, 'rr-share-row');
  const x = find(shareRow, (node) => node.dataset.share === 'x');
  assert.equal(x.textContent, 'Share on X');
  const intent = new URL(x.href);
  assert.equal(intent.searchParams.get('url'), `https://lestersarcade.io/s/${SESSION_ID32.slice(2)}`);
  assert.match(intent.searchParams.get('text'), /⛓ Verified on LitVM/);
  assert.equal(intent.searchParams.get('related'), 'LestersArcade');
  assert.deepEqual(findAll(byClass(shareRow, 'share-menu'), (node) => node.dataset.share).map((node) => node.dataset.share), ['discord', 'facebook']);
  for (const label of ['Play again (Ranked)', 'Practice (Free)', 'View profile', 'Back to arcade']) {
    assert.ok(visible(buttonNamed(root, label), root), label);
  }
  // The stylesheet is injected once, however often the screen opens.
  const links = findAll(documentRef.head, (node) => node.tagName === 'LINK');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, RANKED_RESULTS_STYLESHEET);
  assert.equal(links[0].rel, 'stylesheet');
  view.close();
});

test('focus is trapped and Escape closes', async () => {
  const { documentRef, opener, view, handle, closed, windowRef } = setup({ snapshot: snapshotFor('saved-locally', { error: { code: 'network-error', retryable: true } }) });
  const root = view.element;
  const focusables = findAll(root, (node) => (node.tagName === 'BUTTON' && !node.disabled) || (node.tagName === 'A' && node.href)).filter((node) => visible(node, root));
  const first = focusables[0];
  const last = focusables.at(-1);
  assert.equal(first.getAttribute('aria-label'), 'Close results');
  assert.equal(last.textContent, 'Back to arcade');
  last.focus();
  const forward = await last.dispatch('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(forward.defaultPrevented, true);
  assert.equal(documentRef.activeElement, first, 'Tab from the last control wraps to the first');
  const backward = await first.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(backward.defaultPrevented, true);
  assert.equal(documentRef.activeElement, last, 'Shift+Tab from the first control wraps to the last');
  // Focus that escapes the dialog is pulled back in.
  opener.focus();
  for (const fn of documentRef.listeners.get('focusin') ?? []) fn({ target: opener });
  assert.equal(documentRef.activeElement, first);
  // Escape inside the share menu closes only the menu (not in this state), and
  // Escape anywhere else closes the dialog and returns focus.
  const escape = await first.dispatch('keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(view.isOpen, false);
  assert.equal(root.parentNode, null, 'removed from the page');
  assert.equal(documentRef.activeElement, opener, 'focus returns to where it was');
  assert.deepEqual(closed, [view]);
  assert.equal(handle.subscriberCount, 0, 'unsubscribed from the handle');
  assert.equal((windowRef.listeners.get('lesters:profile-changed') ?? []).length, 0);
  assert.equal((windowRef.listeners.get('popstate') ?? []).length, 0);
  assert.equal((documentRef.listeners.get('focusin') ?? []).length, 0);
  // The HMH summary's "View results" reopens the same screen.
  view.reopen();
  assert.equal(view.isOpen, true);
  assert.equal(handle.subscriberCount, 1);
  view.close();
});

test('Escape inside the share menu closes the menu, not the dialog', async () => {
  const { view, documentRef } = setup({ snapshot: snapshotFor('published') });
  const root = view.element;
  const more = find(root, (node) => node.dataset.share === 'more');
  await more.dispatch('click');
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  const discord = find(root, (node) => node.dataset.share === 'discord');
  await discord.dispatch('keydown', { key: 'Escape' });
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(view.isOpen, true);
  // Right after opening the menu from the keyboard, focus is on the toggle:
  // Escape there closes the menu too, and focus stays on the toggle.
  more.focus();
  await more.dispatch('click');
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  const onToggle = await more.dispatch('keydown', { key: 'Escape' });
  assert.equal(onToggle.stopped, true);
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(view.isOpen, true, 'the dialog stays open');
  assert.equal(documentRef.activeElement, more);
  // With the menu closed, the next Escape closes the dialog.
  await more.dispatch('keydown', { key: 'Escape' });
  assert.equal(view.isOpen, false);
});

test('a companion (the first-Ranked name prompt) stays reachable above the open screen', async () => {
  const { documentRef, view, opener } = setup({ snapshot: snapshotFor('published') });
  const root = view.element;
  assert.equal(documentRef.body.dataset.rankedResultsOpen, 'true', 'the stylesheet lifts companions while this is set');
  // profile-boards appends its toast to <body> after the screen opened.
  const toast = documentRef.createElement('aside');
  toast.className = 'name-claim-toast official-info-card';
  toast.setAttribute('role', 'status');
  const claim = toast.appendChild(documentRef.createElement('button'));
  claim.textContent = 'Claim';
  const later = toast.appendChild(documentRef.createElement('button'));
  later.textContent = 'Not now';
  documentRef.body.appendChild(toast);
  const focusin = (target) => { for (const fn of documentRef.listeners.get('focusin') ?? []) fn({ target }); };
  const documentKeydown = (target, init) => {
    const event = { key: 'Tab', shiftKey: false, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
    for (const fn of documentRef.listeners.get('keydown') ?? []) fn(event);
    return event;
  };
  // Focus moving into the companion is not pulled back into the dialog.
  claim.focus();
  focusin(claim);
  assert.equal(documentRef.activeElement, claim);
  // Tab order: dialog controls, then the companion, then back to the dialog.
  const items = findAll(root, (node) => (node.tagName === 'BUTTON' && !node.disabled) || (node.tagName === 'A' && node.href)).filter((node) => visible(node, root));
  const [first, last] = [items[0], items.at(-1)];
  last.focus();
  assert.equal((await last.dispatch('keydown', { key: 'Tab' })).defaultPrevented, true);
  assert.equal(documentRef.activeElement, claim, 'Tab from the last dialog control reaches the prompt');
  later.focus();
  assert.equal(documentKeydown(later).defaultPrevented, true);
  assert.equal(documentRef.activeElement, first, 'Tab from the last prompt control wraps into the dialog');
  first.focus();
  await first.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(documentRef.activeElement, later, 'Shift+Tab from the first dialog control reaches the prompt');
  claim.focus();
  documentKeydown(claim, { shiftKey: true });
  assert.equal(documentRef.activeElement, last, 'Shift+Tab from the first prompt control returns to the dialog');
  const middle = documentKeydown(claim, { shiftKey: false });
  assert.equal(middle.defaultPrevented, false, 'inside the prompt the browser moves focus itself');
  // Any element marked data-results-companion is treated the same way.
  const other = documentRef.body.appendChild(documentRef.createElement('div'));
  other.dataset.resultsCompanion = '';
  const otherButton = other.appendChild(documentRef.createElement('button'));
  otherButton.focus();
  focusin(otherButton);
  assert.equal(documentRef.activeElement, otherButton);
  // Anything else behind the screen is still pulled back.
  opener.focus();
  focusin(opener);
  assert.equal(documentRef.activeElement, first);
  view.close();
  assert.equal(documentRef.body.dataset.rankedResultsOpen, undefined);
  assert.equal((documentRef.listeners.get('keydown') ?? []).length, 0);
});

test('an in-app navigation that hides the owning view closes the screen (a companion Claim, pushState)', () => {
  const observers = [];
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  }
  const { view, mount, closed } = setup({ snapshot: snapshotFor('published'), patchWindow: (windowRef) => { windowRef.MutationObserver = FakeMutationObserver; } });
  assert.equal(observers.length, 1);
  assert.equal(observers[0].target, mount);
  assert.deepEqual(observers[0].options.attributeFilter, ['hidden', 'class', 'style']);
  observers[0].callback([]);
  assert.equal(view.isOpen, true, 'an attribute change that keeps the view shown changes nothing');
  mount.hidden = true;
  observers[0].callback([]);
  assert.equal(view.isOpen, false);
  assert.deepEqual(closed, [view]);
  assert.equal(observers[0].disconnected, true);
});

test('closing runs onClose first, then focuses its replacement when the opener is gone (HMH View results)', () => {
  const documentRef = fakeDocument();
  const windowRef = fakeWindow();
  const summary = documentRef.body.appendChild(documentRef.createElement('div'));
  let reopen = summary.appendChild(documentRef.createElement('button'));
  const opener = reopen;
  opener.focus();
  const order = [];
  const view = openRankedResults({
    handle: fakeHandle(snapshotFor('published')), context: context(), actions: {}, documentRef, windowRef, mount: summary,
    onClose: () => {
      order.push(`onClose (focus on ${documentRef.activeElement === reopen ? 'opener' : 'dialog'})`);
      summary.replaceChildren();
      reopen = summary.appendChild(documentRef.createElement('button'));
      return reopen;
    },
  });
  assert.notEqual(documentRef.activeElement, opener, 'setup: the dialog took focus from the opener');
  view.close();
  assert.deepEqual(order, ['onClose (focus on dialog)'], 'onClose ran before focus moved');
  assert.equal(opener.isConnected, false, 'onClose re-rendered the summary without the old button');
  assert.equal(documentRef.activeElement, reopen, 'the new View results button has focus, not <body>');
  assert.equal(reopen.isConnected, true);
});

test('retry calls handle.retry', async () => {
  const { view, handle } = setup({ snapshot: snapshotFor('saved-locally', { error: { code: 'network-error', retryable: true } }) });
  const root = view.element;
  const banner = byClass(root, 'rr-banner');
  assert.equal(banner.hidden, false);
  assert.equal(banner.dataset.kind, 'saved-locally');
  assert.equal(byClass(banner, 'rr-banner-text').textContent, 'Saved. Publishing will retry automatically');
  const retry = buttonNamed(root, 'Retry now');
  assert.equal(retry.hidden, false);
  const pending = retry.dispatch('click');
  assert.equal(retry.disabled, true, 'no double submit while retrying');
  assert.equal(retry.textContent, 'Retrying…');
  await pending;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(handle.retries, 1);
  assert.equal(retry.disabled, false);
  // Never a dead end: Play again, Practice and Back stay available.
  for (const label of ['Play again (Ranked)', 'Practice (Free)', 'Back to arcade']) assert.ok(visible(buttonNamed(root, label), root), label);
  // Share stays locked with a reason until the run is published.
  const disabledShare = find(byClass(root, 'rr-share'), (node) => node.tagName === 'BUTTON' && node.textContent === 'Share on X');
  assert.equal(disabledShare.disabled, true);
  assert.match(byClass(root, 'rr-share-note').textContent, /unlocks once the run is published/);
  view.close();
});

test('a retry that rejects re-enables the button and keeps the screen', async () => {
  const { view, handle } = setup({ snapshot: snapshotFor('saved-locally', { error: { code: 'network-error', retryable: true } }) });
  handle.retry = async () => { handle.retries += 1; throw new Error('still offline'); };
  const retry = buttonNamed(view.element, 'Retry now');
  await retry.dispatch('click');
  await flush();
  assert.equal(handle.retries, 1);
  assert.equal(retry.disabled, false);
  assert.equal(retry.textContent, 'Retry now');
  assert.equal(view.isOpen, true);
  assert.equal(byClass(view.element, 'rr-banner').dataset.kind, 'saved-locally', 'the handle, not the rejection, drives the banner');
  await retry.dispatch('click');
  await flush();
  assert.equal(handle.retries, 2, 'the player can retry again');
  view.close();
});

test('the screen follows the handle live and unlocks Ranked sharing only once published', () => {
  const { view, handle } = setup({ snapshot: snapshotFor('verifying', { server: null }) });
  const root = view.element;
  const statusOf = () => findAll(byClass(root, 'rr-timeline'), (node) => node.tagName === 'LI').map((node) => node.dataset.status);
  const stepNodes = findAll(byClass(root, 'rr-timeline'), (node) => node.tagName === 'LI');
  assert.deepEqual(statusOf(), ['done', 'active', 'pending', 'pending', 'pending']);
  assert.equal(byClass(root, 'rr-share-row'), null, 'no share row before publishing');
  handle.set(snapshotFor('publishing'));
  assert.deepEqual(statusOf(), ['done', 'done', 'active', 'pending', 'done']);
  assert.equal(byClass(root, 'rr-share-row'), null);
  assert.equal(find(root, (node) => node.dataset.step === 'published').dataset.status, 'pending');
  handle.set(snapshotFor('published'));
  assert.deepEqual(statusOf(), ['done', 'done', 'done', 'done', 'done']);
  assert.deepEqual(findAll(byClass(root, 'rr-timeline'), (node) => node.tagName === 'LI'), stepNodes, 'steps update in place, so focus never jumps');
  assert.ok(byClass(root, 'rr-share-row'));
  assert.equal(byClass(root, 'rr-score-value').textContent, '19,475', 'the server score replaces the local claim');
  view.close();
});

test('preview fetches nothing and shares the Free template to the site root', async () => {
  const fetches = [];
  const fetchImpl = async (url) => { fetches.push(url); throw new Error('must not fetch'); };
  for (const hosted of [false, true]) {
    const { view } = setup({ snapshot: snapshotFor('preview'), hosted, live: false, fetchImpl });
    const root = view.element;
    assert.equal(byClass(root, 'rr-banner-text').textContent, 'Ranked preview · not published while online settlement is off');
    const x = find(root, (node) => node.dataset.share === 'x');
    const intent = new URL(x.href);
    assert.equal(intent.searchParams.get('url'), 'https://lestersarcade.io');
    assert.match(intent.searchParams.get('text'), /Practising on @LestersArcade$/);
    assert.doesNotMatch(intent.searchParams.get('text'), /Verified|RANKED/);
    view.close();
  }
  const published = setup({ snapshot: snapshotFor('published'), hosted: false, fetchImpl });
  published.view.close();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetches, [], 'HOSTED_PROFILE_SYNC=false: no standing call, ever');
});

test('hosted published runs read the weekly and all-time standing once', async () => {
  const fetches = [];
  const fetchImpl = async (url, init) => {
    fetches.push({ url, init });
    const rank = url.includes('period=weekly') ? 3 : 12;
    return { ok: true, json: async () => ({ ok: true, you: { rank, score: 19475, sessionId32: SESSION_ID32 } }) };
  };
  const { view, handle, timers } = setup({ snapshot: snapshotFor('publishing'), hosted: true, fetchImpl });
  assert.equal(fetches.length, 0, 'nothing before the run is published');
  handle.set(snapshotFor('published'));
  handle.set(snapshotFor('published', { updatedAt: 2 }));
  await flush();
  assert.deepEqual(fetches.map((call) => call.url).sort(), [
    `/api/leaderboard?game=chikun&period=all-time&wallet=${WALLET}`,
    `/api/leaderboard?game=chikun&period=weekly&wallet=${WALLET}`,
  ]);
  assert.ok(fetches.every((call) => call.init.cache === 'no-store'));
  assert.equal(byClass(view.element, 'rr-standing').textContent, '#3 this week · #12 all-time · New personal best (+4,475)');
  const x = find(view.element, (node) => node.dataset.share === 'x');
  assert.match(new URL(x.href).searchParams.get('text'), /19,475 pts · Rank 3 this week/);
  assert.deepEqual(timers.delays, [], 'both periods answered for this run: no retry');
  handle.set(snapshotFor('published', { updatedAt: 3 }));
  await flush();
  assert.equal(fetches.length, 2, 'read once');
  view.close();
});

const OTHER_SESSION = `0x${'77'.repeat(32)}`;
const okJson = (body) => ({ ok: true, json: async () => body });

test('a standing that belongs to another run of the wallet is left out of the screen and the X text', async () => {
  // E5 `you` is the wallet's best row; here another, higher-scoring run holds it.
  const fetches = [];
  const fetchImpl = async (url) => { fetches.push(url); return okJson({ ok: true, you: { rank: 1, score: 99999, sessionId32: OTHER_SESSION, shareId: OTHER_SESSION.slice(2) } }); };
  const { view, timers } = setup({ snapshot: snapshotFor('published'), hosted: true, fetchImpl });
  await flush();
  assert.equal(fetches.length, 2);
  assert.equal(byClass(view.element, 'rr-standing').textContent, 'New personal best (+4,475)', 'no rank from another session');
  const text = new URL(find(view.element, (node) => node.dataset.share === 'x').href).searchParams.get('text');
  assert.doesNotMatch(text, /Rank/);
  assert.match(text, /^🐔 RANKED · Chikun's Escape\n19,475 pts · Lap 2 · Farmland\n/);
  assert.deepEqual(timers.delays, [], 'a higher-scoring best is final: no retry');
  view.close();
});

test('a hosted standing read that fails or lags is retried a bounded number of times, then left out', async () => {
  const replies = [];
  const fetches = [];
  const fetchImpl = async (url) => {
    fetches.push(url);
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  // Round 1: weekly answers 500, all-time throws. Nothing is shown; one retry waits.
  replies.push({ ok: false, status: 500, json: async () => ({ ok: false }) }, new Error('offline'));
  const { view, timers, handle } = setup({ snapshot: snapshotFor('published'), hosted: true, fetchImpl });
  await flush();
  assert.equal(fetches.length, 2);
  assert.equal(byClass(view.element, 'rr-standing').textContent, 'New personal best (+4,475)', 'the screen still renders, without a rank');
  assert.ok(find(view.element, (node) => node.dataset.share === 'x'), 'sharing still works');
  assert.deepEqual(timers.delays, [STANDING_RETRY_DELAYS_MS[0]]);
  // Round 2: weekly is this run; all-time still shows an older, lower run (a
  // lagging index or CDN copy), so only all-time is read again.
  replies.push(okJson({ ok: true, you: { rank: 5, score: 19475, sessionId32: SESSION_ID32 } }), okJson({ ok: true, you: { rank: 40, score: 1000, sessionId32: OTHER_SESSION } }));
  assert.equal(await timers.runNext(), 4_000);
  assert.equal(fetches.length, 4);
  assert.equal(byClass(view.element, 'rr-standing').textContent, '#5 this week · New personal best (+4,475)');
  assert.match(new URL(find(view.element, (node) => node.dataset.share === 'x').href).searchParams.get('text'), /19,475 pts · Rank 5 this week/);
  assert.deepEqual(timers.delays, [STANDING_RETRY_DELAYS_MS[1]]);
  // Rounds 3 and 4 fail too; then it stops for good.
  replies.push(okJson({ ok: true, you: null }));
  assert.equal(await timers.runNext(), 15_000);
  replies.push(new Error('offline'));
  assert.equal(await timers.runNext(), 40_000);
  assert.deepEqual(fetches.slice(4), [`/api/leaderboard?game=chikun&period=all-time&wallet=${WALLET}`, `/api/leaderboard?game=chikun&period=all-time&wallet=${WALLET}`]);
  assert.deepEqual(timers.delays, [], 'no fifth round');
  handle.set(snapshotFor('published', { updatedAt: 9 }));
  await flush();
  assert.equal(fetches.length, 6);
  assert.equal(byClass(view.element, 'rr-standing').textContent, '#5 this week · New personal best (+4,475)');
  view.close();
});

test('closing the screen cancels a pending standing retry', async () => {
  const { view, timers } = setup({ snapshot: snapshotFor('published'), hosted: true });
  await flush();
  assert.deepEqual(timers.delays, [4_000]);
  view.close();
  assert.deepEqual(timers.delays, []);
});

test('the entry chip and handle follow lesters:ranked-entry and lesters:profile-changed', () => {
  const { view, windowRef, handle } = setup({ snapshot: snapshotFor('waiting-entry', { entry: { status: 'pending', txHash: null } }), ctx: context({ entry: { status: 'pending', txHash: null } }) });
  const root = view.element;
  const entryStep = () => find(root, (node) => node.dataset.step === 'entry');
  assert.equal(entryStep().dataset.status, 'active');
  windowRef.emit('lesters:ranked-entry', { sessionId: 'game-session-other', gameId: 'chikun', status: 'confirmed', txHash: `0x${'aa'.repeat(32)}` });
  assert.equal(entryStep().dataset.status, 'active', 'another session is ignored');
  windowRef.emit('lesters:ranked-entry', { sessionId: SESSION_ID, gameId: 'chikun', status: 'confirmed', txHash: `0x${'AA'.repeat(32)}` });
  assert.equal(entryStep().dataset.status, 'done');
  assert.equal(find(entryStep(), (node) => node.tagName === 'A').href, `https://liteforge.explorer.caldera.xyz/tx/0x${'aa'.repeat(32)}`);
  windowRef.emit('lesters:profile-changed', { wallet: `0x${'ff'.repeat(20)}`, displayName: 'Someone Else', avatarUri: null });
  assert.equal(byClass(root, 'rr-handle').textContent, 'Lit Pilot');
  windowRef.emit('lesters:profile-changed', { wallet: WALLET.toUpperCase().replace('0X', '0x'), displayName: 'Chikun King', avatarUri: null });
  assert.equal(byClass(root, 'rr-handle').textContent, 'Chikun King');
  windowRef.emit('lesters:profile-changed', { wallet: WALLET, displayName: null, avatarUri: null });
  assert.equal(byClass(root, 'rr-handle').textContent, '0x2b2b…2b2b', 'a hidden profile falls back to the short wallet');
  assert.equal(handle.subscriberCount, 1);
  view.close();
});

test('actions close the screen, then run; a new run replaces an open screen', async () => {
  const first = setup({ snapshot: snapshotFor('rejected', { server: null, error: { code: 'replay-rejected', retryable: false } }) });
  const root = first.view.element;
  assert.equal(byClass(root, 'rr-banner').dataset.kind, 'rejected');
  assert.match(byClass(root, 'rr-banner-text').textContent, /replayed this run/);
  await buttonNamed(root, 'Play again (Ranked)').dispatch('click');
  assert.deepEqual(first.calls, ['playAgainRanked']);
  assert.equal(first.view.isOpen, false);
  assert.equal(first.documentRef.activeElement === first.opener, false, 'an action does not steal focus back to the opener');

  const again = setup({ snapshot: snapshotFor('practice', { entry: { status: 'failed', txHash: null } }) });
  const replacement = openRankedResults({ handle: fakeHandle(snapshotFor('published')), context: context(), actions: {}, documentRef: again.documentRef, windowRef: again.windowRef, mount: again.mount });
  assert.equal(again.view.isOpen, false, 'only one results screen at a time');
  assert.equal(replacement.isOpen, true);
  assert.equal(buttonNamed(replacement.element, 'View profile').hidden, true, 'no profile action, no button');
  await buttonNamed(replacement.element, 'Back to arcade').dispatch('click');
  assert.equal(replacement.isOpen, false, 'Back always closes, even without an action');
});

test('the keep-this-tab-open notice shows only while an unpersisted body is unsettled', () => {
  const { view, handle } = setup({ snapshot: { ...snapshotFor('verifying', { server: null }), persisted: false } });
  const notice = byClass(view.element, 'rr-notice');
  assert.equal(notice.hidden, false);
  assert.equal(notice.textContent, 'Keep this tab open until publishing finishes');
  assert.equal(notice.getAttribute('role'), 'status');
  handle.set(snapshotFor('queued'));
  assert.equal(notice.hidden, true);
  view.close();
});

test('phase 2 token ids show Minted with a token link', () => {
  const nftId = nftAchievementIds('stacked')[0];
  const snapshot = { ...snapshotFor('published'), gameId: 'stacked' };
  snapshot.server = { ...snapshot.server, stats: { lines: 10, level: 2, quadClears: 1, perfectClears: 0, maxCombo: 2, survivalSeconds: 90 }, achievements: [{ id: nftId, tier: 'platinum', tokenId: '42' }] };
  const { view } = setup({ snapshot, ctx: context({ gameId: 'stacked', gameTitle: 'STACKED' }) });
  const minted = find(view.element, (node) => node.tagName === 'A' && node.textContent === 'Minted');
  assert.ok(minted, 'minted link');
  assert.match(minted.href, /\/token\/0x[0-9a-f]{40}\/instance\/42$/);
  view.close();
});

test('a browser back that hides the owning gameplay view closes the screen', async () => {
  const { view, windowRef, mount } = setup({ snapshot: snapshotFor('published') });
  for (const fn of windowRef.listeners.get('popstate') ?? []) fn({ type: 'popstate' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(view.isOpen, true, 'still open while the gameplay view shows');
  mount.hidden = true;
  for (const fn of windowRef.listeners.get('popstate') ?? []) fn({ type: 'popstate' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(view.isOpen, false, 'closed with its view');
});

test('main.js mounts the screen from exactly one lazy listener', async () => {
  const main = (await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  // Contract §7.7 names two listeners of lesters:ranked-run: results-share
  // (opens this screen) and profile-boards (holdings, stale marks and the
  // hosted-only name prompt). Exactly one of them mounts the screen, and the
  // screen module is imported from nowhere else.
  const starts = [...main.matchAll(/window\.addEventListener\('lesters:ranked-run'/g)].map((match) => match.index);
  assert.equal(starts.length, 2, 'the results-share listener and the profile-boards listener, nothing else');
  const bodies = starts.map((from) => {
    const lineEnd = main.indexOf('\n', from);
    return main.slice(from, main.slice(from, lineEnd).trimEnd().endsWith('});') ? lineEnd : main.indexOf('\n});', from) + 4);
  });
  const mounts = bodies.filter((body) => /ranked-results\.mjs|openRankedResults|showRankedResults/.test(body));
  assert.equal(mounts.length, 1, 'one lazy mount path');
  assert.equal((main.match(/import\('\.\/src\/ranked-results\.mjs'\)/g) ?? []).length, 1, 'the screen module is imported once');
  const [profileListener] = bodies.filter((body) => !mounts.includes(body));
  assert.match(profileListener, /^ {2}if \(!HOSTED_PROFILE_SYNC\) return;$/m, 'the profile listener is inert in preview');
  assert.match(profileListener, /maybePromptNameClaim/);
  const anchor = main.indexOf('// Initial paint honors the URL (deep-link / refresh) instead of always splash.');
  const listener = main.lastIndexOf("window.addEventListener('lesters:ranked-run'", anchor);
  assert.ok(listener > 0 && main.slice(listener, anchor).split('\n').filter(Boolean).length === 1, 'the listener sits immediately before the initial-paint anchor');
  assert.match(main.slice(listener, anchor), /import\('\.\/src\/ranked-results\.mjs'\)\.then\(\(\{ openRankedResults \}\) => showRankedResults\(openRankedResults\(\{ \.\.\.event\.detail, documentRef: document, mount: dom\.officialGameplay \?\? document\.body, live: SETTLEMENT_LIVE, hosted: HOSTED_PROFILE_SYNC/);
  assert.match(main.slice(listener, anchor), /onClose: \(\) => rankedResultsClosed\(\)/, 'onClose hands back a View results button to focus');
  assert.match(main, /function rankedResultsClosed\(\) \{\n {2}return renderGameOverSummary\(\) \?\? syncCabinetResultsButton\(\);\n\}/, 'HMH re-renders its summary; Chikun and STACKED show the cabinet button');
  assert.match(main.slice(listener, anchor), /\.catch\(\(error\) => console\.error\('\[Ranked results\]', error\)\)/);
  assert.doesNotMatch(main, /^import[^\n]*ranked-results/m, 'never a static import: the screen stays lazy');
});

// Runs the real showRankedResults / rankedResultsViewForCurrentRun /
// renderGameOverSummary source from main.js in a vm context with stand-ins
// for the HMH helpers around it.
async function hmhSummaryHost({ mode = 'ranked', sessionId = SESSION_ID, selectedGameId = 'lester-blaster', officialAppStep = 'gameplay', chikunHost = null, stackedHost = null, gameOver = true } = {}) {
  const main = await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const start = main.indexOf('let rankedResultsView = null;');
  const end = main.indexOf('\nfunction recordCurrentSessionEvent(', start);
  assert.ok(start > 0 && end > start, 'the HMH summary block is found');
  const documentRef = fakeDocument();
  const summaryNode = documentRef.body.appendChild(documentRef.createElement('div'));
  const shareRows = [];
  const context = vm.createContext({
    dom: { combatGameOverSummary: summaryNode },
    combat: { gameOver, score: 48210, kills: 312, maxCombo: 42, elapsedGameSeconds: 724, runLevel: 3, bossDefeated: false, clearedCampaignLevelId: null, nextCampaignLevelId: null, killedBy: 'a Bagholder swarm' },
    currentSession: { sessionId, mode },
    lastCompletedSession: null,
    officialSelectedMode: mode,
    hmhRebootActive: true,
    el: (tag, props = {}) => Object.assign(documentRef.createElement(tag), props),
    appendText: (parent, tag, text, className) => {
      const node = documentRef.createElement(tag);
      node.textContent = text;
      if (className) node.className = className;
      parent.append(node);
      return node;
    },
    playSfxCue: () => {},
    currentGameOverSummaryModel: () => ({
      channel: 'defeat', title: 'GAME OVER', trackingCopy: 'Tracked.', metrics: [{ id: 'score', label: 'Score', value: '48,210' }],
      oneMoreRun: { copy: 'One more?', primaryActionId: 'run-it-back', estimatedRestartSeconds: 3 }, streak: { copy: '' }, settlement: { copy: '' },
      actions: [], exitRampCopy: '',
    }),
    getHmhCampaignLevel: () => null,
    isL2CampaignActive: () => false,
    currentHmhRunRecap: () => null,
    renderHmhRunRecap: () => documentRef.createElement('div'),
    buildHmhShareText, buildShareLinks, shareUrlFor,
    createShareRow: (options) => {
      shareRows.push(options);
      const row = documentRef.createElement('div');
      row.className = options.className;
      row.prepend = (child) => row.insertBefore(child, row.children[0] ?? null);
      return row;
    },
    restartCombatRun: () => {},
    continueToCampaignLevel: () => {},
    // The cabinet "View results" button (Chikun and STACKED) reads these.
    officialAppStep,
    selectedGameId,
    chikunHost,
    stackedHost,
    document: documentRef,
  });
  vm.runInContext(main.slice(start, end), context);
  return { context, summaryNode, shareRows, documentRef };
}

// Chikun and STACKED (integration-glue B11): after the results screen is
// dismissed the child's own panel cannot reopen it, so a parent-level button
// floats over the cabinet while it is still open on that run.
for (const gameId of ['chikun', 'stacked']) {
  test(`${gameId}: a parent-level View results reopens a dismissed results screen while the cabinet is open`, async () => {
    const host = await hmhSummaryHost({ selectedGameId: gameId, gameOver: gameId === 'chikun', [gameId === 'chikun' ? 'chikunHost' : 'stackedHost']: {} });
    const { context, documentRef } = host;
    const opened = [];
    let open = true;
    const view = { gameId, sessionId: SESSION_ID, get isOpen() { return open; }, reopen: () => { opened.push('reopen'); open = true; } };
    const floating = () => documentRef.body.children.find((node) => node.className === 'cabinet-results-reopen') ?? null;
    context.showRankedResults(view);
    assert.equal(floating(), null, 'nothing while the screen is open');
    assert.equal(buttonNamed(host.summaryNode, 'View results'), null, 'the HMH summary is untouched');

    // Dismissed: onClose returns the cabinet button, which the screen focuses.
    open = false;
    const button = context.rankedResultsClosed();
    assert.equal(button, floating());
    assert.equal(button.hidden, false);
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.type, 'button', 'a real button: keyboard and touch reachable');
    assert.equal(button.textContent, 'View results');
    assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(button.dataset.gameId, gameId);
    await button.dispatch('click');
    assert.deepEqual(opened, ['reopen']);
    assert.equal(button.hidden, true, 'hidden again while the screen is open');
    open = false;
    context.syncCabinetResultsButton();
    assert.equal(button.hidden, false);
    assert.equal(documentRef.body.children.filter((node) => node.className === 'cabinet-results-reopen').length, 1, 'one button, reused');

    // Another run in the same cabinet, leaving the cabinet, or closing it hides it.
    context.currentSession = { sessionId: 'game-session-next-run', mode: 'ranked' };
    context.syncCabinetResultsButton();
    assert.equal(button.hidden, true, 'a new run is not this screen’s run');
    context.currentSession = { sessionId: SESSION_ID, mode: 'ranked' };
    context.officialAppStep = 'cabinet-select';
    context.syncCabinetResultsButton();
    assert.equal(button.hidden, true, 'left the cabinet');
    context.officialAppStep = 'gameplay';
    context[gameId === 'chikun' ? 'chikunHost' : 'stackedHost'] = null;
    context.syncCabinetResultsButton();
    assert.equal(button.hidden, true, 'the cabinet was torn down');
    await button.dispatch('click');
    assert.deepEqual(opened, ['reopen'], 'a stale button never reopens anything');
  });
}

test('the cabinet View results button is wired into every place its state changes', async () => {
  const main = (await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const body = (name) => {
    const from = main.indexOf(`function ${name}(`);
    assert.ok(from > 0, name);
    return main.slice(from, main.indexOf('\n}', from) + 2);
  };
  assert.match(body('showRankedResults'), /syncCabinetResultsButton\(\);/);
  assert.match(body('render'), /syncCabinetResultsButton\(\);/, 'every view change and new session renders');
  assert.match(body('destroyChikunSession'), /syncCabinetResultsButton\(\);/);
  assert.match(main, /function destroyStackedSession\(\) \{[^\n]*syncCabinetResultsButton\(\); \}/);
  // HMH keeps its own button in the game-over summary.
  assert.match(body('cabinetResultsView'), /view\.gameId !== 'chikun' && view\.gameId !== 'stacked'/);
});

test('HMH shows View results in place of its summary for the Ranked run on screen, and keeps the Free share row', async () => {
  // Free: the full summary with its share row.
  const free = await hmhSummaryHost({ mode: 'free' });
  free.context.renderGameOverSummary();
  assert.equal(free.shareRows.length, 1);
  assert.equal(free.shareRows[0].title, 'Hard Money Heroes');
  assert.equal(new URL(free.shareRows[0].links.x).searchParams.get('url'), `${'https://lestersarcade.io'}/hmh-reboot`);
  assert.ok(byClass(free.summaryNode, 'game-over-share-row'), 'the Free share row is mounted');
  assert.ok(byClass(free.summaryNode, 'run-it-back-button'));

  // Ranked without a results screen yet: the full summary, no share row.
  const ranked = await hmhSummaryHost({ mode: 'ranked' });
  ranked.context.renderGameOverSummary();
  assert.equal(ranked.shareRows.length, 0, 'Ranked HMH shares from the results screen only');
  assert.ok(byClass(ranked.summaryNode, 'run-it-back-button'));

  // The results screen of this run: one "View results" button, kept across re-renders.
  const reopened = [];
  const view = { gameId: 'lester-blaster', sessionId: SESSION_ID, reopen: () => reopened.push('reopen') };
  ranked.context.showRankedResults(view);
  const button = buttonNamed(ranked.summaryNode, 'View results');
  assert.ok(button);
  assert.equal(ranked.summaryNode.dataset.channel, 'ranked-results');
  assert.equal(byClass(ranked.summaryNode, 'run-it-back-button'), null, 'the compact branch replaces the full summary');
  assert.equal(ranked.context.renderGameOverSummary(), button, 'a re-render returns the same node, so focus on it survives');
  assert.equal(ranked.summaryNode.children.includes(button), true);
  await button.dispatch('click');
  assert.deepEqual(reopened, ['reopen']);

  // A results screen from an earlier run never replaces this run's summary.
  const stale = await hmhSummaryHost({ mode: 'ranked', sessionId: 'game-session-another-run' });
  stale.context.showRankedResults(view);
  assert.equal(buttonNamed(stale.summaryNode, 'View results'), null);
  assert.ok(byClass(stale.summaryNode, 'run-it-back-button'));
  const otherGame = await hmhSummaryHost({ mode: 'ranked' });
  otherGame.context.showRankedResults({ ...view, gameId: 'chikun' });
  assert.equal(buttonNamed(otherGame.summaryNode, 'View results'), null, 'a Chikun screen never touches the HMH summary');
});

test('the stylesheet uses the arcade tokens, tier colours, reduced motion and a 320 px-safe layout', async () => {
  const css = await readFile(new URL('../apps/portal/src/styles/ranked-results.css', import.meta.url), 'utf8');
  for (const [tier, colour] of Object.entries({ bronze: '#cd7f32', silver: '#c7d0dc', gold: '#ffd54a', platinum: '#7bf6ff', diamond: '#19f7ff', mythic: '#ff5fa2' })) {
    assert.match(css, new RegExp(`--rr-${tier}: ${colour};`), tier);
    assert.match(css, new RegExp(`\\.rr-badge\\[data-tier="${tier}"\\] \\{ --tier: var\\(--rr-${tier}\\); \\}`), tier);
  }
  // Companions sit above the backdrop while the screen is open (§7.7 name prompt).
  const backdropZ = Number(/\.ranked-results-backdrop \{[^}]*z-index: (\d+);/.exec(css)?.[1]);
  const companionZ = Number(/body\[data-ranked-results-open\] > \[data-results-companion\],\s*body\[data-ranked-results-open\] > \.name-claim-toast \{\s*z-index: (\d+) !important;/.exec(css)?.[1]);
  assert.ok(backdropZ > 0 && companionZ > backdropZ, `companion z-index ${companionZ} above the backdrop ${backdropZ}`);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\[data-reduced-motion="true"\]/);
  assert.match(css, /overflow-x: hidden/);
  assert.match(css, /var\(--font-display/);
  assert.match(css, /var\(--crypto-cyan/);
  assert.match(css, /min-height: 44px/, 'touch targets');
  assert.doesNotMatch(css, /width:\s*(?:[4-9]\d{2}|\d{4,})px(?!\))/, 'no fixed width wider than a phone');
  const module = await readFile(new URL('../apps/portal/src/ranked-results.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(module, /innerHTML|insertAdjacentHTML|eval\(|new Function/);
});

// integration-glue B6 and B10, end to end: the real ranked-client glue of
// main.js (startRankedSettlement, in a VM) and the real settlement client
// produce the lesters:ranked-run detail; signin-entry's real
// recordEntryBroadcast announces the entry; this screen consumes both.
test('the real Ranked glue hands the screen a run it matches by session id, follows through the entry, and releases on close', async () => {
  const STACKED = JSON.parse(await readFile(new URL('./fixtures/ranked/stacked-valid.json', import.meta.url), 'utf8'));
  const { identity, seedTicket } = STACKED.body;
  const session = startPlaySession({ wallet: identity.wallet, gameId: identity.gameId, mode: 'paid', sessionNonce: identity.nonce });
  Object.assign(session, { buildHash: identity.buildHash, seasonId: identity.seasonId });
  session.canonicalContext = Object.freeze({ ...session.canonicalContext, buildHash: identity.buildHash, seasonId: identity.seasonId });
  applySeedTicket(session, { seed: identity.seed, seedTicket });
  // The entry broadcast by signin-entry, confirming later on LitVM.
  const documentRef = fakeDocument();
  const windowRef = fakeWindow();
  const entryTx = `0x${'ab'.repeat(32)}`;
  let confirm;
  recordEntryBroadcast(session, { txHash: entryTx, sessionId32: STACKED.body.sessionId32, amountWei: '102000000000000000', wait: () => new Promise((resolve) => { confirm = resolve; }) }, {
    eventTarget: { dispatchEvent: (event) => { windowRef.emit(event.type, event.detail); return true; } },
    gameId: 'stacked',
  });
  assert.equal(session.entryReceipt.status, 'pending');

  // A live STACKED body too large to keep on the device (§7.2).
  const oversize = { ...STACKED.body, evidence: { ...STACKED.body.evidence, sic1: 'A'.repeat(240_001) } };
  const glue = rankedGlueContext({ session, live: true, clientFetch: async (url, init) => ({ status: 200, headers: { get: () => null }, json: async () => ({ ok: true, view: 'owner', sessionId32: JSON.parse(init.body).sessionId32, status: 'pending', retryable: true, pollAfterMs: 3000, txHash: null }) }) });
  await glue.context.startRankedSettlement({ session, localScore: 1234, localStats: null, buildRequest: () => oversize });
  await until(() => glue.events.length === 1);
  const { detail } = glue.events[0];

  // B6: the context names the session main.js holds, so HMH's "View results"
  // and the cabinet button can match the screen to the run on screen.
  assert.equal(detail.context.sessionId, session.sessionId);
  assert.equal(detail.context.sessionId32, STACKED.body.sessionId32);
  assert.equal(detail.handle.snapshot.persisted, false, 'the snapshot says the body is not stored on the device');
  assert.equal(detail.handle.snapshot.sessionId, session.sessionId);
  const seen = [];
  const unsubscribe = detail.handle.subscribe((snapshot) => seen.push(snapshot.state));
  assert.equal(typeof unsubscribe, 'function', 'subscribe returns its unsubscribe');

  // The real (frozen) handle behind a recorder of the screen's subscriptions.
  const subscriptions = [];
  const real = detail.handle;
  const handle = {
    sessionId32: real.sessionId32,
    gameId: real.gameId,
    get state() { return real.state; },
    get snapshot() { return real.snapshot; },
    subscribe(fn) {
      const release = real.subscribe(fn);
      const entry = { released: false };
      subscriptions.push(entry);
      return () => { entry.released = true; release(); };
    },
    retry: () => real.retry(),
    dispose: () => real.dispose(),
  };
  const view = openRankedResults({ ...detail, handle, documentRef, windowRef, mount: documentRef.body, live: true, hosted: false, navigatorRef: {}, setTimeoutImpl: () => 0, clearTimeoutImpl: () => {} });
  assert.equal(view.sessionId, session.sessionId, 'the view carries the same session id');
  assert.equal(view.gameId, 'stacked');
  assert.equal(detail.handle.state, 'waiting-entry');
  assert.equal(view.model.notice, 'Keep this tab open until publishing finishes');
  // B10: the entry chip reads the receipt, then follows lesters:ranked-entry.
  const entryStep = () => view.model.timeline.find((step) => step.id === 'entry');
  assert.equal(entryStep().status, 'active');
  assert.equal(entryStep().href, `https://liteforge.explorer.caldera.xyz/tx/${entryTx}`);
  confirm({ status: 'confirmed', blockNumber: 7 });
  await until(() => session.entryReceipt.status === 'confirmed');
  await flush();
  assert.equal(entryStep().status, 'done', 'confirmed');
  await until(() => detail.handle.state === 'queued');
  assert.equal(glue.calls.clientFetch.length, 1, 'the body went out once the entry confirmed');
  assert.ok(seen.includes('queued'));

  // Closing the screen releases its subscription; the unsubscribe works.
  view.close({ restoreFocus: false });
  assert.ok(subscriptions.length > 0 && subscriptions.every((entry) => entry.released), 'no subscription outlives the screen');
  unsubscribe();
  const before = seen.length;
  await detail.handle.retry();
  await flush();
  assert.equal(seen.length, before, 'an unsubscribed listener hears nothing');

  // A failed entry turns the chip failed from the same event.
  const failed = openRankedResults({ ...detail, context: { ...detail.context, entry: { status: 'pending', txHash: entryTx } }, handle: { ...fakeHandle(snapshotFor('waiting-entry', { gameId: 'stacked', entry: { status: 'pending', txHash: entryTx } })), sessionId32: STACKED.body.sessionId32 }, documentRef, windowRef, mount: documentRef.body, live: true, hosted: false, navigatorRef: {}, setTimeoutImpl: () => 0, clearTimeoutImpl: () => {} });
  windowRef.emit(RANKED_ENTRY_EVENT, { sessionId: session.sessionId, gameId: 'stacked', status: 'failed', txHash: entryTx });
  assert.equal(failed.model.timeline.find((step) => step.id === 'entry').status, 'failed');
  failed.close({ restoreFocus: false });
});
