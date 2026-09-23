import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { RANKED_RESULTS_STYLESHEET, openRankedResults } from '../apps/portal/src/ranked-results.mjs';
import { catalogFor, nftAchievementIds } from '../apps/portal/src/achievements/index.mjs';

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

function setup({ snapshot = snapshotFor('published'), hosted = false, live = true, fetchImpl, ctx = context(), actions } = {}) {
  const documentRef = fakeDocument();
  const windowRef = fakeWindow();
  const mount = documentRef.body.appendChild(documentRef.createElement('section'));
  const opener = documentRef.body.appendChild(documentRef.createElement('button'));
  opener.focus();
  const handle = fakeHandle(snapshot);
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
    onClose: (closedView) => closed.push(closedView),
  });
  return { documentRef, windowRef, mount, opener, handle, view, calls, fetches, closed };
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
  const { view } = setup({ snapshot: snapshotFor('published') });
  const root = view.element;
  const more = find(root, (node) => node.dataset.share === 'more');
  await more.dispatch('click');
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  const discord = find(root, (node) => node.dataset.share === 'discord');
  await discord.dispatch('keydown', { key: 'Escape' });
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(view.isOpen, true);
  view.close();
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
  const { view, handle } = setup({ snapshot: snapshotFor('publishing'), hosted: true, fetchImpl });
  assert.equal(fetches.length, 0, 'nothing before the run is published');
  handle.set(snapshotFor('published'));
  handle.set(snapshotFor('published', { updatedAt: 2 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetches.map((call) => call.url).sort(), [
    `/api/leaderboard?game=chikun&period=all-time&wallet=${WALLET}`,
    `/api/leaderboard?game=chikun&period=weekly&wallet=${WALLET}`,
  ]);
  assert.ok(fetches.every((call) => call.init.cache === 'no-store'));
  assert.equal(byClass(view.element, 'rr-standing').textContent, '#3 this week · #12 all-time · New personal best (+4,475)');
  const x = find(view.element, (node) => node.dataset.share === 'x');
  assert.match(new URL(x.href).searchParams.get('text'), /19,475 pts · Rank 3 this week/);
  view.close();
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

test('main.js mounts the screen from exactly one lazy listener and HMH shows View results in place of its summary', async () => {
  const main = await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const listeners = main.match(/window\.addEventListener\('lesters:ranked-run'/g) ?? [];
  assert.equal(listeners.length, 1);
  const anchor = main.indexOf('// Initial paint honors the URL (deep-link / refresh) instead of always splash.');
  const listener = main.lastIndexOf("window.addEventListener('lesters:ranked-run'", anchor);
  assert.ok(listener > 0 && main.slice(listener, anchor).split('\n').filter(Boolean).length === 1, 'the listener sits immediately before the initial-paint anchor');
  assert.match(main.slice(listener, anchor), /import\('\.\/src\/ranked-results\.mjs'\)\.then\(\(\{ openRankedResults \}\) => showRankedResults\(openRankedResults\(\{ \.\.\.event\.detail, documentRef: document, mount: dom\.officialGameplay \?\? document\.body, live: SETTLEMENT_LIVE, hosted: HOSTED_PROFILE_SYNC/);
  assert.match(main.slice(listener, anchor), /\.catch\(\(error\) => console\.error\('\[Ranked results\]', error\)\)/);
  assert.doesNotMatch(main, /^import[^\n]*ranked-results/m, 'never a static import: the screen stays lazy');
  const summaryStart = main.indexOf('function renderGameOverSummary()');
  const summary = main.slice(summaryStart, main.indexOf('\nfunction ', summaryStart + 10));
  assert.match(summary, /const rankedView = rankedResultsViewForCurrentRun\(\);\s*if \(rankedView\) \{/);
  assert.match(summary, /textContent: 'View results'/);
  assert.match(summary, /rankedView\.reopen\(\)/);
  assert.ok(summary.indexOf('rankedResultsViewForCurrentRun()') < summary.indexOf('currentGameOverSummaryModel()'), 'the compact branch replaces the full summary');
  assert.match(main, /rankedResultsView\?\.gameId === 'lester-blaster' && sessionId && rankedResultsView\.sessionId === sessionId/);
});

test('the stylesheet uses the arcade tokens, tier colours, reduced motion and a 320 px-safe layout', async () => {
  const css = await readFile(new URL('../apps/portal/src/styles/ranked-results.css', import.meta.url), 'utf8');
  for (const [tier, colour] of Object.entries({ bronze: '#cd7f32', silver: '#c7d0dc', gold: '#ffd54a', platinum: '#7bf6ff', diamond: '#19f7ff', mythic: '#ff5fa2' })) {
    assert.match(css, new RegExp(`--rr-${tier}: ${colour};`), tier);
    assert.match(css, new RegExp(`\\.rr-badge\\[data-tier="${tier}"\\] \\{ --tier: var\\(--rr-${tier}\\); \\}`), tier);
  }
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
