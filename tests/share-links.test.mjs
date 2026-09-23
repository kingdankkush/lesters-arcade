import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import {
  SHARE_ORIGIN,
  X_MENTION,
  X_RELATED,
  buildFreeShareText,
  buildHmhShareText,
  buildRankedShareText,
  buildShareLinks,
  buildStackedShareText,
  createShareRow,
  safeShareFragment,
  sharePageUrl,
  shareUrlFor,
  xWeightedLength,
} from '../apps/portal/src/share-links.mjs';
import { buildChikunShareText } from '../apps/chikun/src/presentation.mjs';

/**
 * Owner direction 2026-09-16 plus guide §3.4 / §5.12 and contract §7.4: every
 * cabinet can share its run. X is primary, mentions @LestersArcade once and
 * carries no hashtags (D12, D13); Facebook and Discord sit in a secondary
 * menu. Posting is always the player's own click; nothing auto-sends.
 */

const SHARE_ID = 'ab'.repeat(32);
const GAMES = ['lester-blaster', 'chikun', 'stacked'];

// §7.4 invariants for any text that can reach X.
function assertShareInvariants(text, label) {
  assert.ok(xWeightedLength(text) + 1 + 23 <= 280, `${label}: ${xWeightedLength(text)} + 24 must fit 280`);
  assert.equal(text.split(X_MENTION).length - 1, 1, `${label}: @LestersArcade exactly once`);
  assert.doesNotMatch(text, /#/, `${label}: no hashtags or #`);
  assert.doesNotMatch(text, /0x[0-9a-fA-F]{40}/, `${label}: no wallet address`);
  assert.doesNotMatch(text, /session-/, `${label}: no session handle`);
}

test('X intent carries text, url and related without hashtags', () => {
  const links = buildShareLinks({ text: '  🏆 RANKED ·  Hard Money Heroes \r\n48,210 pts\n\nCan you beat it? @LestersArcade ', url: sharePageUrl(`0x${SHARE_ID}`) });
  assert.equal(links.text, '🏆 RANKED · Hard Money Heroes\n48,210 pts\n\nCan you beat it? @LestersArcade', 'newlines survive, each line trimmed');
  assert.equal(links.url, `${SHARE_ORIGIN}/s/${SHARE_ID}`);
  assert.equal(Object.hasOwn(links, 'hashtags'), false);
  assert.ok(links.x.startsWith('https://x.com/intent/post?text='), links.x);
  const x = new URL(links.x);
  assert.deepEqual([...x.searchParams.keys()], ['text', 'url', 'related']);
  assert.equal(x.searchParams.get('text'), links.text);
  assert.equal(x.searchParams.get('url'), links.url);
  assert.equal(x.searchParams.get('related'), X_RELATED);
  assert.equal(x.searchParams.has('hashtags'), false);
  assert.equal(x.searchParams.has('via'), false);
  const facebook = new URL(links.facebook);
  assert.equal(facebook.origin + facebook.pathname, 'https://www.facebook.com/sharer/sharer.php');
  assert.deepEqual([...facebook.searchParams.keys()], ['u']);
  assert.equal(facebook.searchParams.get('u'), links.url);
  assert.equal(links.discord, `${links.text}\n${links.url}`);
  assert.equal(Object.isFrozen(links), true);
  assert.throws(() => buildShareLinks({ text: '   ' }), /share text is required/);
  assert.equal(buildShareLinks({ text: 'hi' }).url, SHARE_ORIGIN, 'the site root by default');
  assert.equal(shareUrlFor(''), SHARE_ORIGIN);
  assert.equal(shareUrlFor('/hmh-reboot'), `${SHARE_ORIGIN}/hmh-reboot`);
  assert.equal(sharePageUrl(SHARE_ID.toUpperCase()), `${SHARE_ORIGIN}/s/${SHARE_ID}`);
  assert.throws(() => sharePageUrl('session-1'), /32-byte session key/);
  const long = buildShareLinks({ text: '🔥'.repeat(400) });
  assert.ok(xWeightedLength(long.text) + 24 <= 280, 'an oversized text is clipped to fit X with its URL');
  assert.match(long.text, /…$/);
});

test('xWeightedLength follows the twitter-text v3 weights', () => {
  assert.equal(xWeightedLength(''), 0);
  assert.equal(xWeightedLength('abc'), 3);
  assert.equal(xWeightedLength('·×é'), 3, 'Latin-1 and Latin Extended weigh 1');
  assert.equal(xWeightedLength('\u10ff'), 1);
  assert.equal(xWeightedLength('\u1100'), 2);
  assert.equal(xWeightedLength('\u2000\u200d\u2010\u201f\u2032\u2037'), 6, 'the punctuation ranges weigh 1');
  assert.equal(xWeightedLength('\u200e\u2020\u2026'), 6, 'between and past the ranges weighs 2');
  assert.equal(xWeightedLength('\u2038\u2100'), 4, 'just past the ranges weighs 2');
  assert.equal(xWeightedLength('⛓🔥🪙'), 6, 'emoji weigh 2 per code point');
  assert.equal(xWeightedLength('\n'), 1);
});

test('ranked templates fit X with one mention and no hashtags or addresses', () => {
  const typical = {
    'lester-blaster': { kills: 312, maxCombo: 42, survivalSeconds: 724, level: 9, bossKills: 1 },
    chikun: { forksPassed: 52, nearMisses: 18, coinsCollected: 41, bestCombo: 9, laps: 1, regionReached: 'farmland' },
    stacked: { lines: 186, level: 14, quadClears: 5, perfectClears: 1, maxCombo: 7, survivalSeconds: 1500 },
  };
  assert.equal(buildRankedShareText('lester-blaster', { score: 48210, standingLabel: 'Rank 3 this week', stats: typical['lester-blaster'] }),
    '🏆 RANKED · Hard Money Heroes\n48,210 pts · Rank 3 this week\n☠ 312 kills · 🔥 ×42 combo · ⏱ 12:04\n⛓ Verified on LitVM\nCan you beat it? @LestersArcade');
  assert.equal(buildRankedShareText('chikun', { score: 19475, stats: typical.chikun }),
    "🐔 RANKED · Chikun's Escape\n19,475 pts · Lap 2 · Farmland\n🌾 52 forks · ⚡ 18 near-misses · 🪙 41 coins\n⛓ Verified on LitVM\nBeat my flight @LestersArcade");
  assert.equal(buildRankedShareText('stacked', { score: 412900, standingLabel: 'Rank 1 this week', stats: typical.stacked, personalBest: true }),
    '🧱 RANKED · STACKED\n412,900 pts · Rank 1 this week\n📈 186 lines · Lv 14 · 5 Halvings\n🔥 New personal best!\n⛓ Verified on LitVM\nStack higher @LestersArcade');
  assert.equal(buildFreeShareText('stacked', { score: 4200, stats: { lines: 40, level: 5, quadClears: 1 } }),
    '🕹 FREE PLAY · STACKED\n4,200 pts\n📈 40 lines · Lv 5 · 1 Halving\nPractising on @LestersArcade');
  assert.match(buildFreeShareText('chikun', { score: 1, stats: {} }), /Practising on @LestersArcade$/);
  assert.throws(() => buildRankedShareText('pinball', {}), /no share template/);

  // Worst case: every counter at its display cap, an oversized region id and a
  // hostile standing label that tries to smuggle mentions, hashes, an address
  // and a session handle into the text.
  const huge = 999_999_999_999;
  const worst = {
    kills: huge, maxCombo: huge, survivalSeconds: huge, forksPassed: huge, nearMisses: huge, coinsCollected: huge,
    laps: huge, regionReached: 'industrial-wasteland-extended-region', lines: huge, level: huge, quadClears: huge,
  };
  const hostile = `#1 @elonmusk 0x${'a'.repeat(40)} session-abc ${'x'.repeat(200)}`;
  for (const gameId of GAMES) {
    for (const personalBest of [false, true]) {
      for (const standingLabel of ['', 'Rank 999,999 this week', hostile]) {
        const ranked = buildRankedShareText(gameId, { score: huge, standingLabel, stats: worst, personalBest });
        assertShareInvariants(ranked, `${gameId} ranked pb=${personalBest}`);
        assert.match(ranked, /⛓ Verified on LitVM/);
        assert.equal(buildShareLinks({ text: ranked }).text, ranked, 'the X text is never clipped');
      }
      const free = buildFreeShareText(gameId, { score: huge, stats: worst });
      assertShareInvariants(free, `${gameId} free`);
      assert.doesNotMatch(free, /Verified/);
      assert.equal(buildShareLinks({ text: free }).text, free);
    }
    assertShareInvariants(buildRankedShareText(gameId, {}), `${gameId} empty stats`);
    assertShareInvariants(buildFreeShareText(gameId, { stats: null }), `${gameId} null stats`);
  }
});

test('HMH, STACKED and Chikun Free share text carry the session stats and one mention, without wallet data', () => {
  const hmh = buildHmhShareText({ score: 12345, kills: 44, level: 6, elapsedSeconds: 252, maxCombo: 12, killedBy: 'a Bagholder swarm' });
  assert.equal(hmh, 'I scored 12,345 points in Hard Money Heroes: 44 enemies down, level 6, 4:12 survived, best combo ×12. Fell to a Bagholder swarm. Free run on @LestersArcade');
  const win = buildHmhShareText({ score: 900, kills: 3, level: 1, elapsedSeconds: 61, maxCombo: 1, killedBy: 'ignored', bossDefeated: true });
  assert.equal(win, 'I scored 900 points in Hard Money Heroes: 3 enemies down, level 1, 1:01 survived, the Liquidator liquidated. Free run on @LestersArcade');
  const stacked = buildStackedShareText({ score: 4200, lines: 40, level: 5, tick: 10920, quadClears: 1, maxCombo: 4 });
  assert.equal(stacked, 'I scored 4,200 points in STACKED: 40 lines, level 5, 3:02, 1 halving, best combo 4. Free practice on @LestersArcade');
  assert.match(buildStackedShareText({ score: 1, ranked: true }), /Ranked run on @LestersArcade$/);
  assert.match(buildStackedShareText({ score: 1, assisted: true }), /Assisted practice/);
  const chikun = buildChikunShareText({ score: 1234, forksPassed: 12, nearMisses: 4, bestCombo: 3, survivalTime: 42.5 }, 'free');
  assert.match(chikun, /Free Practice on @LestersArcade$/);
  const hostile = buildHmhShareText({ score: 1, killedBy: `#rekt @someone 0x${'b'.repeat(40)} session-1` });
  for (const [label, text] of [['hmh', hmh], ['win', win], ['stacked', stacked], ['chikun', chikun], ['hostile', hostile]]) {
    assertShareInvariants(text, label);
  }
});

test('fragment scrubbing cannot splice a mention, hash, address or session handle back together', () => {
  const address = `0x${'c'.repeat(40)}`;
  const spliced = [
    'sess#ion-x', 'se@ssion-', 'sess@#ion-abc @evil', `sess${address}ion-x`, `0x${'d'.repeat(20)}session-${'d'.repeat(20)}`,
    `0x${'e'.repeat(20)}#${'e'.repeat(20)}`, 'sessi＠on-＃tag', 'SESS#ION-', `${address}${address}`,
  ];
  for (const value of spliced) {
    const out = safeShareFragment(value, 200);
    assert.doesNotMatch(out, /session-/i, value);
    assert.doesNotMatch(out, /0x[0-9a-f]{40}/i, value);
    assert.doesNotMatch(out, /[#@＃＠]/, value);
  }
  assert.equal(safeShareFragment('Rank 3 this week'), 'Rank 3 this week', 'ordinary labels pass unchanged');
  assert.equal(safeShareFragment('a Bagholder swarm'), 'a Bagholder swarm');
  // Through every template a caller-supplied fragment reaches.
  for (const gameId of GAMES) {
    for (const fragment of spliced) {
      const ranked = buildRankedShareText(gameId, { score: 1, standingLabel: fragment, stats: { regionReached: fragment, regionName: fragment } });
      assertShareInvariants(ranked, `${gameId} ranked ${fragment}`);
      assertShareInvariants(buildFreeShareText(gameId, { stats: { regionReached: fragment } }), `${gameId} free ${fragment}`);
    }
  }
  for (const fragment of spliced) assertShareInvariants(buildHmhShareText({ killedBy: fragment }), `hmh ${fragment}`);
  assert.equal(buildHmhShareText({ killedBy: 'sess#ion-abc @evil' }).includes('Fell to abc evil.'), true);
});

test('share-links.mjs exports the whole §7.4 surface, the Ranked and Free templates included', async () => {
  // Contract §7.4 names apps/portal/src/share-links.mjs as the one module for
  // every builder, the Ranked and Free templates included; other slices
  // import them from there. The children ship the module but never call the
  // templates: the parent results screen owns Ranked sharing.
  const shareLinks = await import('../apps/portal/src/share-links.mjs');
  assert.equal(shareLinks.SHARE_ORIGIN, 'https://lestersarcade.io');
  assert.equal(shareLinks.X_MENTION, '@LestersArcade');
  assert.equal(shareLinks.X_RELATED, 'LestersArcade');
  for (const name of ['shareUrlFor', 'sharePageUrl', 'xWeightedLength', 'buildRankedShareText', 'buildFreeShareText', 'buildShareLinks', 'createShareRow', 'buildHmhShareText', 'buildStackedShareText']) {
    assert.equal(typeof shareLinks[name], 'function', `share-links.mjs exports ${name}`);
  }
  const [links, model, chikunMain, stackedMain] = await Promise.all([
    read('../apps/portal/src/share-links.mjs'), read('../apps/portal/src/ranked-results-model.mjs'),
    read('../apps/chikun/src/main.mjs'), read('../apps/stacked/src/main.mjs'),
  ]);
  assert.doesNotMatch(links, /^import /m, 'share-links.mjs stays dependency-free');
  assert.match(model, /import \{[^}]*\bbuildFreeShareText\b[^}]*\bbuildRankedShareText\b[^}]*\} from '\.\/share-links\.mjs';/, 'the results model takes the templates from share-links.mjs');
  for (const source of [chikunMain, stackedMain]) assert.doesNotMatch(source, /buildRankedShareText|buildFreeShareText/);
  // A game id is looked up as an own key only.
  for (const gameId of ['toString', '__proto__', 'constructor']) {
    assert.throws(() => buildRankedShareText(gameId, {}), /no share template/, gameId);
    assert.throws(() => buildFreeShareText(gameId, {}), /no share template/, gameId);
  }
});

// A small DOM with parents and bubbling (stopPropagation honoured).
function fakeDocument() {
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.parentNode = null; this.dataset = {}; this.attributes = {}; this.style = {}; this.textContent = ''; this.listeners = new Map(); this.hidden = false; }
    adopt(child) { child.parentNode = this; return child; }
    appendChild(child) { this.children.push(this.adopt(child)); return child; }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    prepend(child) { this.children.unshift(this.adopt(child)); }
    get lastChild() { return this.children.at(-1); }
    replaceChildren(...nodes) { for (const node of this.children) node.parentNode = null; this.children = []; this.append(...nodes); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
    focus() { this.focused = true; }
    async dispatch(type, extra = {}) {
      const event = { target: this, preventDefault() { event.defaultPrevented = true; }, stopPropagation() { event.stopped = true; }, ...extra };
      for (let node = this; node && !event.stopped; node = node.parentNode) {
        for (const fn of node.listeners.get(type) ?? []) await fn(event);
      }
      return event;
    }
  }
  return { createElement: (tag) => new Node(tag) };
}

test('the share row puts Share on X first and Discord, Facebook and the native sheet in a secondary menu', async () => {
  const documentRef = fakeDocument();
  const copied = [];
  const shared = [];
  const statuses = [];
  const links = buildShareLinks({ text: buildFreeShareText('lester-blaster', { score: 5 }), url: shareUrlFor('hmh-reboot') });
  const row = createShareRow({
    documentRef,
    navigatorRef: { share: async (payload) => { shared.push(payload); }, clipboard: { writeText: async (text) => { copied.push(text); } } },
    title: 'Hard Money Heroes',
    links,
    onStatus: (message) => statuses.push(message),
  });
  assert.equal(row.dataset.shareRow, 'true');
  assert.deepEqual(row.children.map((node) => node.dataset.share ?? 'menu'), ['x', 'more', 'menu']);
  const [x, more, menu] = row.children;
  assert.equal(x.tagName, 'a');
  assert.equal(x.textContent, 'Share on X');
  assert.match(x.className, /share-primary/);
  assert.equal(x.rel, 'noopener noreferrer');
  assert.equal(x.target, '_blank');
  assert.equal(x.href, links.x);
  assert.deepEqual(menu.children.map((node) => node.dataset.share), ['discord', 'facebook', 'native']);
  const [discord, facebook, native] = menu.children;
  assert.equal(facebook.href, links.facebook);
  assert.equal(facebook.rel, 'noopener noreferrer');
  assert.equal(discord.tagName, 'button');

  // The secondary menu is a disclosure: closed by default, toggled by More,
  // closed again by Escape without letting Escape reach an enclosing dialog,
  // whether focus is on a menu item or on the More toggle itself.
  assert.equal(more.getAttribute('aria-controls'), menu.id);
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.style.display, 'none');
  const dialogEscapes = [];
  const dialog = documentRef.createElement('section');
  dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') dialogEscapes.push(event.target); });
  dialog.appendChild(row);
  await more.dispatch('click');
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  assert.equal(menu.style.display, 'contents');
  const escape = await discord.dispatch('keydown', { key: 'Escape' });
  assert.equal(escape.stopped, true);
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(more.focused, true);
  more.focused = false;
  await more.dispatch('click');
  const onToggle = await more.dispatch('keydown', { key: 'Escape' });
  assert.equal(onToggle.stopped, true, 'Escape on the toggle closes the open menu first');
  assert.equal(onToggle.defaultPrevented, true);
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(more.focused, true, 'focus stays on the toggle');
  assert.deepEqual(dialogEscapes, [], 'the enclosing dialog never saw those Escapes');
  const closedEscape = await more.dispatch('keydown', { key: 'Escape' });
  assert.equal(closedEscape.stopped, undefined, 'with the menu closed, Escape reaches the dialog');
  assert.deepEqual(dialogEscapes, [more]);

  await discord.dispatch('click');
  assert.deepEqual(copied, [links.discord]);
  assert.equal(discord.textContent, 'Copied');
  await native.dispatch('click');
  assert.deepEqual(shared, [{ title: 'Hard Money Heroes', text: links.text, url: links.url }]);
  assert.deepEqual(statuses, ['Run summary copied. Paste it into Discord.', 'Run shared.']);
  // A second run refreshes the links in place without rebuilding the row.
  const next = buildShareLinks({ text: 'I scored 9 points in Hard Money Heroes', url: shareUrlFor('hmh-reboot') });
  row.refresh(next);
  assert.equal(x.href, next.x);
  assert.equal(facebook.href, next.facebook);
  await discord.dispatch('click');
  assert.equal(copied.at(-1), next.discord);
});

test('without the Web Share API the menu has no native button and a missing clipboard fails soft', async () => {
  const documentRef = fakeDocument();
  const links = buildShareLinks({ text: 'I scored 1 point in STACKED' });
  const row = createShareRow({ documentRef, navigatorRef: {}, links });
  const menu = row.children[2];
  assert.deepEqual(menu.children.map((node) => node.dataset.share), ['discord', 'facebook']);
  await menu.children[0].dispatch('click');
  assert.equal(menu.children[0].textContent, 'Copy unavailable');
  assert.equal(row.dataset.shareStatus, 'Copying is unavailable in this browser.');
  assert.throws(() => createShareRow({ documentRef, links: { text: 'x' } }), /buildShareLinks/);
});

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('all three cabinets mount the share row and the child hosts allow popups, share and clipboard', async () => {
  const [portalMain, chikunMain, stackedMain, chikunHtml, stackedHtml, chikunHost, stackedHost, portalHtml] = await Promise.all([
    read('../apps/portal/main.js'), read('../apps/chikun/src/main.mjs'), read('../apps/stacked/src/main.mjs'),
    read('../apps/portal/chikun/index.html'), read('../apps/portal/stacked/index.html'),
    read('../apps/portal/src/chikun-host.mjs'), read('../apps/portal/src/stacked-host.mjs'), read('../apps/portal/index.html'),
  ]);
  assert.match(portalMain, /createShareRow\(\{\s*title: 'Hard Money Heroes'/);
  assert.match(portalMain, /buildHmhShareText\(\{/);
  assert.doesNotMatch(portalMain, /\.innerHTML\s=/, 'the portal stays innerHTML-free');
  assert.match(chikunMain, /createShareRow\(\{/);
  assert.match(stackedMain, /buildStackedShareText\(\{/);
  assert.match(chikunHtml, /id="shareRow"/);
  assert.match(stackedHtml, /id="shareRow"/);
  for (const [label, source] of [['portal', portalMain], ['chikun', chikunMain], ['stacked', stackedMain]]) {
    assert.doesNotMatch(source, /hashtags\s*:/, `${label} passes no hashtags (D13)`);
  }
  for (const host of [chikunHost, stackedHost]) {
    assert.match(host, /allow-popups allow-popups-to-escape-sandbox/);
    assert.match(host, /web-share; clipboard-write/);
    assert.doesNotMatch(host, /allow-top-navigation/);
  }
  assert.doesNotMatch(portalHtml, /target="_blank"(?![^>]*rel="[^"]*noopener)/);
});

// The children do not know the session key, so the parent results screen owns
// Ranked sharing (contract §7.4, review C14). Their share controls hide for
// Ranked and stay for Free (the HMH summary is covered in
// tests/ranked-results.test.mjs).
//
// Runs the child's own renderShareRow source (sliced from its main.mjs) in a
// vm context with a fake document, so the test drives the real code path in
// both modes instead of pinning its text.
function childShareRow(source, { start, end, globals }) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} … ${end} found`);
  const context = vm.createContext({ ...globals });
  vm.runInContext(source.slice(from, to), context);
  return context;
}

function spy(fn) {
  const calls = [];
  const wrapped = (...args) => { calls.push(args); return fn(...args); };
  wrapped.calls = calls;
  return wrapped;
}

test('child share rows are hidden for Ranked runs and kept for Free', async () => {
  const [chikunMain, stackedMain] = await Promise.all([read('../apps/chikun/src/main.mjs'), read('../apps/stacked/src/main.mjs')]);
  const result = { score: 1234, forksPassed: 12, nearMisses: 4, bestCombo: 3, survivalTime: 42.5 };

  // Chikun: the row and the native Share Run button hide together.
  {
    const documentRef = fakeDocument();
    const mount = documentRef.createElement('div');
    const shareRunButton = documentRef.createElement('button');
    const texts = spy(buildChikunShareText);
    const rows = spy(createShareRow);
    const context = childShareRow(chikunMain, {
      start: 'let shareRow = null;\nfunction renderShareRow(result) {',
      end: "\nshareRunButton.addEventListener('click'",
      globals: {
        document: { ...documentRef, querySelector: (selector) => (selector === '#shareRow' ? mount : null) },
        navigator: { clipboard: { writeText: async () => {} } },
        shareRunButton, mode: 'ranked', dailyChallenge: null, setLive: () => {},
        buildShareLinks, buildChikunShareText: texts, shareUrlFor, createShareRow: rows,
      },
    });
    context.renderShareRow(result);
    assert.equal(mount.hidden, true, 'Chikun Ranked: share row hidden');
    assert.equal(shareRunButton.hidden, true, 'Chikun Ranked: Share Run hidden');
    assert.equal(texts.calls.length + rows.calls.length, 0, 'Ranked builds no share text and no row');
    context.mode = 'free';
    context.renderShareRow(result);
    assert.equal(mount.hidden, false, 'Chikun Free: share row shown');
    assert.equal(shareRunButton.hidden, false, 'Chikun Free: Share Run shown');
    assert.equal(rows.calls.length, 1);
    const row = mount.children[0];
    assert.equal(row.dataset.shareRow, 'true');
    const x = new URL(row.children[0].href);
    assert.equal(x.searchParams.get('url'), `${SHARE_ORIGIN}/chikun`);
    assert.match(x.searchParams.get('text'), /Free Practice on @LestersArcade$/);
    context.renderShareRow({ ...result, score: 99 });
    assert.equal(rows.calls.length, 1, 'a second Free run refreshes the same row');
    assert.match(new URL(row.children[0].href).searchParams.get('text'), /^I scored 99 points/);
    context.mode = 'ranked';
    context.renderShareRow(result);
    assert.equal(mount.hidden, true, 'a Ranked run after a Free one hides the row again');
    assert.equal(shareRunButton.hidden, true);
  }

  // STACKED.
  {
    const documentRef = fakeDocument();
    const mount = documentRef.createElement('div');
    const overlayCopy = documentRef.createElement('p');
    const texts = spy(buildStackedShareText);
    const rows = spy(createShareRow);
    const context = childShareRow(stackedMain, {
      start: 'let shareRow = null;\nfunction renderShareRow(s) {',
      end: '\nasync function finish()',
      globals: {
        document: documentRef, $: (id) => ({ shareRow: mount, overlayCopy }[id] ?? null),
        init: { mode: 'ranked' }, run: { assisted: false },
        buildShareLinks, buildStackedShareText: texts, shareUrlFor, createShareRow: rows,
      },
    });
    const snapshot = { score: 4200, lines: 40, level: 5, tick: 10920, quadClears: 1, maxCombo: 4 };
    context.renderShareRow(snapshot);
    assert.equal(mount.hidden, true, 'STACKED Ranked: share row hidden');
    assert.equal(texts.calls.length + rows.calls.length, 0, 'Ranked builds no share text and no row');
    context.init.mode = 'free';
    context.renderShareRow(snapshot);
    assert.equal(mount.hidden, false, 'STACKED Free: share row shown');
    assert.equal(rows.calls.length, 1);
    assert.equal(texts.calls[0][0].ranked, undefined, 'the child never builds Ranked share text');
    const x = new URL(mount.children[0].children[0].href);
    assert.equal(x.searchParams.get('url'), `${SHARE_ORIGIN}/stacked`);
    assert.match(x.searchParams.get('text'), /Free practice on @LestersArcade$/);
  }
});
