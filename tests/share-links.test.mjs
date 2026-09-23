import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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

function fakeDocument() {
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.style = {}; this.textContent = ''; this.listeners = new Map(); }
    appendChild(child) { this.children.push(child); return child; }
    append(...nodes) { this.children.push(...nodes); }
    prepend(child) { this.children.unshift(child); }
    get lastChild() { return this.children.at(-1); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
    focus() { this.focused = true; }
    async dispatch(type, extra = {}) {
      const event = { preventDefault() {}, stopPropagation() { event.stopped = true; }, ...extra };
      for (const fn of this.listeners.get(type) ?? []) await fn(event);
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
  // closed again by Escape without letting Escape reach an enclosing dialog.
  assert.equal(more.getAttribute('aria-controls'), menu.id);
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.style.display, 'none');
  await more.dispatch('click');
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  assert.equal(menu.style.display, 'contents');
  const escape = await menu.dispatch('keydown', { key: 'Escape' });
  assert.equal(escape.stopped, true);
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(more.focused, true);

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
// Ranked and stay for Free; the HMH summary does the same.
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(open, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('child share rows are hidden for Ranked runs and kept for Free', async () => {
  const [chikunMain, stackedMain, portalMain] = await Promise.all([read('../apps/chikun/src/main.mjs'), read('../apps/stacked/src/main.mjs'), read('../apps/portal/main.js')]);
  const chikun = functionBody(chikunMain, 'renderShareRow');
  assert.match(chikun, /mount\.hidden = shareRunButton\.hidden = mode === 'ranked';\s*if \(mode === 'ranked'\) return;/);
  assert.ok(chikun.indexOf("if (mode === 'ranked') return;") < chikun.indexOf('buildShareLinks('), 'Ranked returns before any share link is built');
  const stacked = functionBody(stackedMain, 'renderShareRow');
  assert.match(stacked, /if \(\(mount\.hidden = init\.mode === 'ranked'\)\) return;/);
  assert.ok(stacked.indexOf("init.mode === 'ranked'") < stacked.indexOf('buildShareLinks('));
  assert.doesNotMatch(stacked, /ranked: init\.mode/, 'the child never builds Ranked share text');
  const summary = functionBody(portalMain, 'renderGameOverSummary');
  assert.match(summary, /if \(!win && \(currentSession\?\.mode \?\? officialSelectedMode \?\? 'free'\) === 'free'\) \{\s*const shareText = buildHmhShareText/);
});
