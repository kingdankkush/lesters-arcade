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
  createNativeShare,
  createShareRow,
  safeShareFragment,
  sharePageUrl,
  shareUrlFor,
  xWeightedLength,
} from '../apps/portal/src/share-links.mjs';
import { decodeFreeShareToken, encodeFreeShareToken, freeShareCardPath, freeSharePageUrl } from '../apps/portal/src/free-share-token.mjs';

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

test('X intent carries the text with the link on its own last line, and related, without hashtags', () => {
  const links = buildShareLinks({ text: '  🏆 RANKED ·  Hard Money Heroes \r\n48,210 pts\n\nCan you beat it? @LestersArcade ', url: sharePageUrl(`0x${SHARE_ID}`) });
  assert.equal(links.text, '🏆 RANKED · Hard Money Heroes\n48,210 pts\n\nCan you beat it? @LestersArcade', 'newlines survive, each line trimmed');
  assert.equal(links.url, `${SHARE_ORIGIN}/s/${SHARE_ID}`);
  assert.equal(Object.hasOwn(links, 'hashtags'), false);
  assert.ok(links.x.startsWith('https://x.com/intent/post?text='), links.x);
  const x = new URL(links.x);
  // 1.9.3: the link sits in the text after a blank line, so X's composer
  // fetches the card image; the separate url parameter never did.
  assert.deepEqual([...x.searchParams.keys()], ['text', 'related']);
  assert.equal(x.searchParams.get('text'), `${links.text}\n\n${links.url}`);
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
    '🏆 RANKED · Hard Money Heroes\n48,210 pts · Rank 3 this week\n☠ 312 kills · 🔥 ×42 combo · ⏱ 12:04\n⛓ Verified on LitVM\nCan you beat it? @LestersArcade 🎮');
  assert.equal(buildRankedShareText('chikun', { score: 19475, stats: typical.chikun }),
    "🐔 RANKED · Chikun's Escape\n19,475 pts · Lap 2 · Farmland\n🌾 52 forks · ⚡ 18 near-misses · 🪙 41 coins\n⛓ Verified on LitVM\nBeat my flight @LestersArcade 🎮");
  assert.equal(buildRankedShareText('stacked', { score: 412900, standingLabel: 'Rank 1 this week', stats: typical.stacked, personalBest: true }),
    '🧱 RANKED · STACKED\n412,900 pts · Rank 1 this week\n📈 186 lines · Lv 14 · 5 Halvings\n🔥 New personal best!\n⛓ Verified on LitVM\nStack higher @LestersArcade 🎮');
  // Free: the Ranked family with the game's own icon, FREE PLAY, the Free
  // detail and extra line, and the Ranked call (plan free-share-20260926 §5).
  assert.equal(buildFreeShareText('lester-blaster', { score: 48210, stats: { heroName: 'Lit Commando', level: 9, kills: 312, maxCombo: 42, survivalSeconds: 724, bossDefeated: true } }),
    '🧟 FREE PLAY · Hard Money Heroes\n48,210 pts · Lit Commando · Lv 9\n☠ 312 kills · 🔥 ×42 combo · ⏱ 12:04\n💀 Liquidator liquidated\nCan you beat it? @LestersArcade 🎮');
  assert.equal(buildFreeShareText('chikun', { score: 19475, stats: { laps: 1, regionName: 'farmland', dailyLabel: 'Daily 2026-09-26', forksPassed: 52, nearMisses: 18, coinsCollected: 41, survivalSeconds: 180, bestCombo: 9 } }),
    "🐔 FREE PLAY · Chikun's Escape\n19,475 pts · Lap 2 · Farmland · Daily 2026-09-26\n🌾 52 forks · ⚡ 18 near-misses · 🪙 41 coins\n⏱ 3:00 flight · 🔥 ×9 combo\nBeat my flight @LestersArcade 🎮");
  assert.equal(buildFreeShareText('stacked', { score: 412900, stats: { survivalSeconds: 1500, maxCombo: 7, lines: 186, level: 14, quadClears: 5 } }),
    '🧱 FREE PLAY · STACKED\n412,900 pts · ⏱ 25:00 · 🔥 ×7 combo\n📈 186 lines · Lv 14 · 5 Halvings\nStack higher @LestersArcade 🎮');
  assert.equal(buildFreeShareText('stacked', { score: 4200, stats: { lines: 40, level: 5, quadClears: 1 } }),
    '🧱 FREE PLAY · STACKED\n4,200 pts\n📈 40 lines · Lv 5 · 1 Halving\nStack higher @LestersArcade 🎮');
  // Optional parts appear only with their stat.
  const bare = buildFreeShareText('lester-blaster', { score: 1, stats: { kills: 1 } });
  assert.equal(bare.split('\n')[1], '1 pts', 'no hero, no level');
  assert.doesNotMatch(bare, /Liquidator/);
  assert.match(buildFreeShareText('lester-blaster', { stats: { bossKills: 1 } }), /💀 Liquidator liquidated/);
  assert.doesNotMatch(buildFreeShareText('chikun', { score: 1, stats: {} }), /flight ·|Daily/);
  assert.match(buildFreeShareText('stacked', { stats: { assisted: true } }), /· Assisted\n/);
  assert.doesNotMatch(buildFreeShareText('stacked', { stats: { assisted: 'yes', maxCombo: 1 } }), /Assisted|combo/);
  for (const gameId of GAMES) {
    const text = buildFreeShareText(gameId, { score: 1, stats: {} });
    assert.match(text.split('\n')[0], /^\S+ FREE PLAY · /, gameId);
    assert.doesNotMatch(text, /🕹|Practising|Verified|RANKED/, gameId);
  }
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
      const free = buildFreeShareText(gameId, { score: huge, stats: { ...worst, heroName: hostile, dailyLabel: hostile, bossDefeated: true, assisted: true, bestCombo: huge } });
      assertShareInvariants(free, `${gameId} free`);
      assert.doesNotMatch(free, /Verified|RANKED/);
      assert.equal(buildShareLinks({ text: free }).text, free, 'the Free X text is never clipped');
    }
    assertShareInvariants(buildRankedShareText(gameId, {}), `${gameId} empty stats`);
    assertShareInvariants(buildFreeShareText(gameId, { stats: null }), `${gameId} null stats`);
  }
  // The Free worst cases (plan §5): every counter at its cap, a 16-char hero or
  // daily label, the clock at its cap, every flag set.
  const C = 9_999_999;
  const worstFree = {
    'lester-blaster': [200, { heroName: 'x'.repeat(40), level: C, kills: C, maxCombo: C, survivalSeconds: huge, bossDefeated: true }],
    chikun: [238, { laps: huge, regionName: 'industrial', dailyLabel: 'y'.repeat(40), forksPassed: C, nearMisses: C, coinsCollected: C, survivalSeconds: huge, bestCombo: C }],
    stacked: [174, { survivalSeconds: huge, maxCombo: C, lines: C, level: C, quadClears: C, assisted: true }],
  };
  for (const [gameId, [weight, stats]] of Object.entries(worstFree)) {
    const text = buildFreeShareText(gameId, { score: huge, stats });
    assert.equal(xWeightedLength(text), weight, `${gameId} worst Free weight`);
    assert.ok(weight <= 255, gameId);
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
  const hostile = buildHmhShareText({ score: 1, killedBy: `#rekt @someone 0x${'b'.repeat(40)} session-1` });
  for (const [label, text] of [['hmh', hmh], ['win', win], ['stacked', stacked], ['hostile', hostile]]) {
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
      assertShareInvariants(buildFreeShareText(gameId, { stats: { regionReached: fragment, heroName: fragment, dailyLabel: fragment } }), `${gameId} free ${fragment}`);
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
  for (const name of ['shareUrlFor', 'sharePageUrl', 'xWeightedLength', 'buildRankedShareText', 'buildFreeShareText', 'buildShareLinks', 'createShareRow', 'createNativeShare', 'buildHmhShareText', 'buildStackedShareText']) {
    assert.equal(typeof shareLinks[name], 'function', `share-links.mjs exports ${name}`);
  }
  const [links, model, chikunMain, stackedMain] = await Promise.all([
    read('../apps/portal/src/share-links.mjs'), read('../apps/portal/src/ranked-results-model.mjs'),
    read('../apps/chikun/src/main.mjs'), read('../apps/stacked/src/main.mjs'),
  ]);
  assert.doesNotMatch(links, /^import /m, 'share-links.mjs stays dependency-free');
  assert.match(model, /import \{[^}]*\bbuildFreeShareText\b[^}]*\bbuildRankedShareText\b[^}]*\} from '\.\/share-links\.mjs';/, 'the results model takes the templates from share-links.mjs');
  // The children build Free text only; Ranked sharing is the parent's.
  for (const source of [chikunMain, stackedMain]) assert.doesNotMatch(source, /buildRankedShareText/);
  assert.match(chikunMain, /buildFreeShareText\('chikun'/);
  assert.match(stackedMain, /buildFreeShareText\('stacked'/);
  // The lazy card-file chunk is a dynamic import, never a static one.
  assert.match(links, /loadShareFile = \(\) => import\('\.\/share-file\.mjs'\)/);
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
  assert.match(portalMain, /buildFreeShareText\('lester-blaster'/);
  assert.match(portalMain, /freeSharePageUrl\('lester-blaster', shareToken\)/);
  assert.doesNotMatch(portalMain, /\.innerHTML\s=/, 'the portal stays innerHTML-free');
  assert.match(chikunMain, /createShareRow\(\{/);
  assert.match(stackedMain, /buildFreeShareText\('stacked'/);
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

test('child share rows are hidden for Ranked runs and link Free runs to their /f/ page and card', async () => {
  const [chikunMain, stackedMain] = await Promise.all([read('../apps/chikun/src/main.mjs'), read('../apps/stacked/src/main.mjs')]);
  const result = { score: 19475, forksPassed: 100, nearMisses: 18, coinsCollected: 41, bestCombo: 9, survivalTime: 180, regionReached: 'coast', laps: 2 };
  const tokenOf = (href, slug) => {
    const url = new URL(href).searchParams.get('text').split('\n').at(-1);
    const match = new RegExp(`^https://lestersarcade\\.io/f/${slug}/([0-9a-z]+)$`).exec(url);
    assert.ok(match, url);
    return match[1];
  };

  // Chikun: the row and the native Share Run button hide together; the Share
  // Run button shares through the row's native path (card file when it can).
  {
    const documentRef = fakeDocument();
    const mount = documentRef.createElement('div');
    const shareRunButton = documentRef.createElement('button');
    const texts = spy(buildFreeShareText);
    const rows = spy(createShareRow);
    const shared = [];
    const copied = [];
    const live = [];
    const navigatorRef = { share: async (payload) => { shared.push(payload); }, clipboard: { writeText: async (text) => { copied.push(text); } } };
    const context = childShareRow(chikunMain, {
      start: 'let shareRow = null;\nfunction renderShareRow(result) {',
      end: '\nwatchReplayButton?.addEventListener',
      globals: {
        document: { ...documentRef, querySelector: (selector) => (selector === '#shareRow' ? mount : null) },
        navigator: navigatorRef, setTimeout,
        shareRunButton, mode: 'ranked', dailyChallenge: null, setLive: (message) => live.push(message),
        buildShareLinks, buildFreeShareText: texts, createShareRow: rows, encodeFreeShareToken, freeSharePageUrl, freeShareCardPath,
      },
    });
    context.renderShareRow(result);
    assert.equal(mount.hidden, true, 'Chikun Ranked: share row hidden');
    assert.equal(shareRunButton.hidden, true, 'Chikun Ranked: Share Run hidden');
    assert.equal(texts.calls.length + rows.calls.length, 0, 'Ranked builds no share text and no row');
    await shareRunButton.dispatch('click');
    assert.deepEqual([shared, copied], [[], []], 'the hidden Ranked Share Run button is inert');
    context.mode = 'free';
    context.dailyChallenge = { label: 'Daily 2026-09-26' };
    context.renderShareRow(result);
    assert.equal(mount.hidden, false, 'Chikun Free: share row shown');
    assert.equal(shareRunButton.hidden, false, 'Chikun Free: Share Run shown');
    assert.equal(rows.calls.length, 1);
    assert.equal(rows.calls[0][0].nativeButton, false, 'the cabinet keeps its own Share Run button');
    const row = mount.children[0];
    assert.equal(row.dataset.shareRow, 'true');
    assert.deepEqual(row.children[2].children.map((node) => node.dataset.share), ['discord', 'facebook'], 'no second native button');
    const x = new URL(row.children[0].href);
    const token = tokenOf(row.children[0].href, 'chikun');
    assert.match(token, /^ac[0-9a-z]{38}$/);
    assert.equal(row.links.card, `/api/free-card/chikun/${token}.png`);
    const [text, link] = x.searchParams.get('text').split('\n\n');
    assert.match(text, /^🐔 FREE PLAY · Chikun's Escape\n19,475 pts · Lap 3 · Coast · Daily 2026-09-26\n/);
    assert.match(text, /Beat my flight @LestersArcade 🎮$/);
    assert.equal(link, `https://lestersarcade.io/f/chikun/${token}`);
    assertShareInvariants(text, 'chikun child');
    const decoded = decodeFreeShareToken('chikun', token);
    assert.equal(decoded.ok, true);
    assert.deepEqual({ ...decoded.values }, { region: 'coast', score: 19475, forksPassed: 100, nearMisses: 18, coinsCollected: 41, bestCombo: 9, survivalSeconds: 180, laps: 2, daily: true });
    // Share Run: the Web Share API with the row's text and /f/ URL.
    await shareRunButton.dispatch('click');
    assert.deepEqual(shared, [{ title: "Chikun's Escape", text: row.links.text, url: row.links.url }]);
    assert.equal(shareRunButton.textContent, 'Shared');
    // Without the Web Share API it copies the Discord text (text + /f/ URL).
    delete navigatorRef.share;
    await shareRunButton.dispatch('click');
    assert.deepEqual(copied, [row.links.discord]);
    assert.match(copied[0], /\nhttps:\/\/lestersarcade\.io\/f\/chikun\/ac[0-9a-z]{38}$/);
    context.renderShareRow({ ...result, score: 99 });
    assert.equal(rows.calls.length, 1, 'a second Free run refreshes the same row');
    assert.match(new URL(row.children[0].href).searchParams.get('text'), /\n99 pts · /);
    assert.equal(decodeFreeShareToken('chikun', tokenOf(row.children[0].href, 'chikun')).values.score, 99);
    context.mode = 'ranked';
    context.renderShareRow(result);
    assert.equal(mount.hidden, true, 'a Ranked run after a Free one hides the row again');
    assert.equal(shareRunButton.hidden, true);
    const before = copied.length;
    await shareRunButton.dispatch('click');
    assert.equal(copied.length, before, 'a Ranked run never shares the previous Free run');
  }

  // STACKED.
  {
    const documentRef = fakeDocument();
    const mount = documentRef.createElement('div');
    const overlayCopy = documentRef.createElement('p');
    const texts = spy(buildFreeShareText);
    const rows = spy(createShareRow);
    const context = childShareRow(stackedMain, {
      start: 'let shareRow = null;\nfunction renderShareRow(s) {',
      end: '\nasync function finish()',
      globals: {
        document: documentRef, $: (id) => ({ shareRow: mount, overlayCopy }[id] ?? null),
        init: { mode: 'ranked' }, run: { assisted: true },
        buildShareLinks, buildFreeShareText: texts, createShareRow: rows, encodeFreeShareToken, freeSharePageUrl, freeShareCardPath,
      },
    });
    const snapshot = { score: 412900, lines: 186, level: 14, tick: 90_000, quadClears: 5, maxCombo: 7 };
    context.renderShareRow(snapshot);
    assert.equal(mount.hidden, true, 'STACKED Ranked: share row hidden');
    assert.equal(texts.calls.length + rows.calls.length, 0, 'Ranked builds no share text and no row');
    context.init.mode = 'free';
    context.renderShareRow(snapshot);
    assert.equal(mount.hidden, false, 'STACKED Free: share row shown');
    assert.equal(rows.calls.length, 1);
    assert.equal(texts.calls[0][0], 'stacked', 'the child builds the Free template only');
    const row = mount.children[0];
    const token = tokenOf(row.children[0].href, 'stacked');
    assert.match(token, /^as[0-9a-z]{32}$/);
    assert.equal(row.links.card, `/api/free-card/stacked/${token}.png`);
    const [text, link] = new URL(row.children[0].href).searchParams.get('text').split('\n\n');
    assert.equal(link, `https://lestersarcade.io/f/stacked/${token}`);
    assert.equal(text, '🧱 FREE PLAY · STACKED\n412,900 pts · ⏱ 25:00 · 🔥 ×7 combo · Assisted\n📈 186 lines · Lv 14 · 5 Halvings\nStack higher @LestersArcade 🎮');
    assert.deepEqual({ ...decodeFreeShareToken('stacked', token).values }, { assisted: true, score: 412900, lines: 186, level: 14, quadClears: 5, maxCombo: 7, survivalSeconds: 1500 });
  }
});

// The native share path (plan free-share-20260926 §10.2): the card as a file
// when the browser can share files, else text + URL, never auto-sent.
function fakeFile(name = 'lesters-arcade-free-run.png') {
  return { name, type: 'image/png', size: 4096 };
}

test('the native share attaches the Free card file when it can and falls back to text otherwise', async () => {
  const links = buildShareLinks({ text: buildFreeShareText('stacked', { score: 4200 }), url: 'https://lestersarcade.io/f/stacked/as0', card: '/api/free-card/stacked/as0.png' });
  assert.equal(links.card, '/api/free-card/stacked/as0.png');
  assert.equal(buildShareLinks({ text: 'x' }).card, null, 'no card unless a Free call site passes one');
  const loader = (file, { canShareFiles = true } = {}) => {
    const calls = [];
    return { calls, load: async () => ({ canShareFiles: () => canShareFiles, fetchShareCardFile: async (path) => { calls.push(path); return file; } }) };
  };
  const text = { title: 'STACKED', text: links.text, url: links.url };

  // Happy path: the tap shares the card with the text and URL.
  {
    const shared = [];
    const file = fakeFile();
    const { calls, load } = loader(file);
    const native = createNativeShare({ navigatorRef: { share: async (payload) => { shared.push(payload); }, canShare: () => true }, title: 'STACKED', links, loadShareFile: load, idleMs: 60_000 });
    assert.equal(await native.share(), 'card');
    assert.deepEqual(shared, [{ ...text, files: [file] }]);
    assert.deepEqual(calls, ['/api/free-card/stacked/as0.png']);
  }
  // No files support, no card, a failed fetch, or canShare(files) false: text.
  for (const [label, options] of [
    ['canShareFiles false', { navigatorRef: { canShare: () => true }, loader: loader(fakeFile(), { canShareFiles: false }) }],
    ['no canShare', { navigatorRef: {}, loader: loader(fakeFile()) }],
    ['fetch null', { navigatorRef: { canShare: () => true }, loader: loader(null) }],
    ['canShare(files) false', { navigatorRef: { canShare: (data) => !data?.files }, loader: loader(fakeFile()) }],
  ]) {
    const shared = [];
    const navigatorRef = { ...options.navigatorRef, share: async (payload) => { shared.push(payload); } };
    const native = createNativeShare({ navigatorRef, title: 'STACKED', links, loadShareFile: options.loader.load, idleMs: 60_000 });
    assert.equal(await native.share(), 'text', label);
    assert.deepEqual(shared, [text], label);
  }
  // A loader that throws is a text share too.
  {
    const shared = [];
    const native = createNativeShare({ navigatorRef: { share: async (p) => { shared.push(p); }, canShare: () => true }, title: 'STACKED', links, loadShareFile: async () => { throw new Error('chunk failed'); }, idleMs: 60_000 });
    assert.equal(await native.share(), 'text');
    assert.deepEqual(shared, [text]);
  }
  // A file share the browser refuses is retried as text; a cancel is final.
  {
    const shared = [];
    const file = fakeFile();
    const navigatorRef = { canShare: () => true, share: async (payload) => { if (payload.files) throw Object.assign(new Error('no files'), { name: 'NotAllowedError' }); shared.push(payload); } };
    const native = createNativeShare({ navigatorRef, title: 'STACKED', links, loadShareFile: loader(file).load, idleMs: 60_000 });
    assert.equal(await native.share(), 'text');
    assert.deepEqual(shared, [text]);
    const cancelled = createNativeShare({ navigatorRef: { canShare: () => true, share: async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); } }, title: 'STACKED', links, loadShareFile: loader(file).load, idleMs: 60_000 });
    await assert.rejects(cancelled.share(), { name: 'AbortError' });
  }
  // The tap waits at most 700 ms for a slow card, then shares text.
  {
    const shared = [];
    const slow = async () => ({ canShareFiles: () => true, fetchShareCardFile: () => new Promise((resolve) => { setTimeout(() => resolve(fakeFile()), 2_000); }) });
    const native = createNativeShare({ navigatorRef: { canShare: () => true, share: async (p) => { shared.push(p); } }, title: 'STACKED', links, loadShareFile: slow, idleMs: 60_000 });
    const started = Date.now();
    assert.equal(await native.share(), 'text');
    assert.ok(Date.now() - started < 1_500, 'the transient activation is kept');
    assert.deepEqual(shared, [text]);
  }
});

test('the card is prefetched only once the results stay on screen, and re-armed per run', async () => {
  const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
  const links = buildShareLinks({ text: 'a @LestersArcade', url: 'https://lestersarcade.io/f/stacked/as1', card: '/api/free-card/stacked/as1.png' });
  const next = buildShareLinks({ text: 'b @LestersArcade', url: 'https://lestersarcade.io/f/stacked/as2', card: '/api/free-card/stacked/as2.png' });
  const fetched = [];
  const loadShareFile = async () => ({ canShareFiles: () => true, fetchShareCardFile: async (path) => { fetched.push(path); return fakeFile(); } });
  const navigatorRef = { canShare: () => true, share: async () => {} };
  let shown = true;
  const native = createNativeShare({ navigatorRef, links, loadShareFile, idleMs: 20, stillShown: () => shown });
  await sleep(60);
  assert.deepEqual(fetched, ['/api/free-card/stacked/as1.png'], 'fetched after the idle delay');
  native.prepare(next);
  shown = false;
  await sleep(60);
  assert.deepEqual(fetched, ['/api/free-card/stacked/as1.png'], 'a panel that is gone downloads nothing');
  assert.equal(await native.share(), 'card', 'the tap still fetches its own card');
  assert.deepEqual(fetched, ['/api/free-card/stacked/as1.png', '/api/free-card/stacked/as2.png']);
  // A quick restart re-arms the timer: only the latest run is ever fetched.
  const quick = [];
  const q = createNativeShare({ navigatorRef, links, loadShareFile: async () => ({ canShareFiles: () => true, fetchShareCardFile: async (path) => { quick.push(path); return null; } }), idleMs: 40 });
  await sleep(10);
  q.prepare(next);
  await sleep(80);
  assert.deepEqual(quick, ['/api/free-card/stacked/as2.png']);
});

test('a row built before its panel appears prefetches once the panel shows (Chikun death animation)', async () => {
  const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
  const links = buildShareLinks({ text: 'a @LestersArcade', url: 'https://lestersarcade.io/f/chikun/ac1', card: '/api/free-card/chikun/ac1.png' });
  const fetched = [];
  const loadShareFile = async () => ({ canShareFiles: () => true, fetchShareCardFile: async (path) => { fetched.push(path); return fakeFile(); } });
  let shown = false;
  createNativeShare({ navigatorRef: { canShare: () => true, share: async () => {} }, links, loadShareFile, idleMs: 15, stillShown: () => shown });
  await sleep(70);
  assert.deepEqual(fetched, [], 'nothing while the results are still hidden');
  shown = true;
  await sleep(60);
  assert.deepEqual(fetched, ['/api/free-card/chikun/ac1.png'], 'fetched once the results are on screen');
  // The checks are bounded: a row that never shows stops checking.
  let calls = 0;
  createNativeShare({ navigatorRef: { canShare: () => true, share: async () => {} }, links, loadShareFile, idleMs: 1, stillShown: () => { calls += 1; return false; } });
  for (let waited = 0; calls < 30 && waited < 3_000; waited += 50) await sleep(50);
  await sleep(100);
  assert.equal(calls, 30);
});

test('the share row wires its native button, refresh and nativeButton: false through the same native share', async () => {
  const documentRef = fakeDocument();
  const shared = [];
  const statuses = [];
  const file = fakeFile();
  const links = buildShareLinks({ text: buildFreeShareText('chikun', { score: 7 }), url: 'https://lestersarcade.io/f/chikun/ac1', card: '/api/free-card/chikun/ac1.png' });
  const fetched = [];
  const loadShareFile = async () => ({ canShareFiles: () => true, fetchShareCardFile: async (path) => { fetched.push(path); return file; } });
  const navigatorRef = { canShare: () => true, share: async (payload) => { shared.push(payload); } };
  const row = createShareRow({ documentRef, navigatorRef, title: "Chikun's Escape", links, loadShareFile, onStatus: (m) => statuses.push(m) });
  assert.equal(row.links, links);
  const native = row.children[2].children.find((node) => node.dataset.share === 'native');
  await native.dispatch('click');
  assert.deepEqual(shared, [{ title: "Chikun's Escape", text: links.text, url: links.url, files: [file] }]);
  assert.deepEqual(statuses, ['Run shared.']);
  const next = buildShareLinks({ text: buildFreeShareText('chikun', { score: 8 }), url: 'https://lestersarcade.io/f/chikun/ac2', card: '/api/free-card/chikun/ac2.png' });
  row.refresh(next);
  assert.equal(row.links, next);
  await native.dispatch('click');
  assert.equal(shared.at(-1).url, next.url);
  assert.equal(fetched.at(-1), '/api/free-card/chikun/ac2.png', 'refresh re-arms the card for the new run');
  // A cancel sets no status.
  navigatorRef.share = async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); };
  await native.dispatch('click');
  assert.deepEqual(statuses, ['Run shared.', 'Run shared.']);
  // nativeButton: false drops the menu button but keeps row.native.
  const bare = createShareRow({ documentRef, navigatorRef: { share: async () => {} }, links, nativeButton: false });
  assert.deepEqual(bare.children[2].children.map((node) => node.dataset.share), ['discord', 'facebook']);
  assert.equal(typeof bare.native.share, 'function');
  assert.equal(await bare.native.share(), 'text');
});
