import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SHARE_ORIGIN,
  buildHmhShareText,
  buildShareLinks,
  buildStackedShareText,
  createShareRow,
  shareUrlFor,
} from '../apps/portal/src/share-links.mjs';

/**
 * Owner direction 2026-09-16: every cabinet's results screen can share the
 * score and session stats to X, Facebook and Discord (plus the native share
 * sheet). Posting is always the player's own click; nothing auto-sends.
 */

test('share links encode text, URL and hashtags for X and Facebook and a copyable Discord message', () => {
  const links = buildShareLinks({ text: '  I scored 1,234 points  in STACKED ', url: shareUrlFor('stacked'), hashtags: ['#LestersArcade', 'STACKED', 'bad tag!', 'STACKED'] });
  assert.equal(links.text, 'I scored 1,234 points in STACKED');
  assert.equal(links.url, `${SHARE_ORIGIN}/stacked`);
  assert.deepEqual(links.hashtags, ['LestersArcade', 'STACKED', 'badtag']);
  const x = new URL(links.x);
  assert.equal(x.origin + x.pathname, 'https://x.com/intent/post');
  assert.equal(x.searchParams.get('text'), 'I scored 1,234 points in STACKED');
  assert.equal(x.searchParams.get('url'), 'https://lestersarcade.io/stacked');
  assert.equal(x.searchParams.get('hashtags'), 'LestersArcade,STACKED,badtag');
  const facebook = new URL(links.facebook);
  assert.equal(facebook.origin + facebook.pathname, 'https://www.facebook.com/sharer/sharer.php');
  assert.equal(facebook.searchParams.get('u'), 'https://lestersarcade.io/stacked');
  assert.equal(links.discord, 'I scored 1,234 points in STACKED #LestersArcade #STACKED #badtag\nhttps://lestersarcade.io/stacked');
  assert.throws(() => buildShareLinks({ text: '   ' }), /share text is required/);
  assert.equal(shareUrlFor(''), SHARE_ORIGIN);
  assert.equal(shareUrlFor('/hmh-reboot'), `${SHARE_ORIGIN}/hmh-reboot`);
  assert.ok(buildShareLinks({ text: 'x'.repeat(400) }).text.length <= 280, 'X-length bound');
});

test('HMH and STACKED share text carry the session stats without wallet data', () => {
  const hmh = buildHmhShareText({ score: 12345, kills: 44, level: 6, elapsedSeconds: 252, maxCombo: 12, killedBy: 'a Bagholder swarm', ranked: true });
  assert.equal(hmh, 'I scored 12,345 points in Hard Money Heroes: 44 enemies down, level 6, 4:12 survived, best combo ×12. Fell to a Bagholder swarm. Ranked run at lestersarcade.io');
  const win = buildHmhShareText({ score: 900, kills: 3, level: 1, elapsedSeconds: 61, maxCombo: 1, killedBy: 'ignored', bossDefeated: true });
  assert.equal(win, 'I scored 900 points in Hard Money Heroes: 3 enemies down, level 1, 1:01 survived, the Liquidator liquidated. Free run at lestersarcade.io');
  const stacked = buildStackedShareText({ score: 4200, lines: 40, level: 5, tick: 10920, quadClears: 1, maxCombo: 4 });
  assert.equal(stacked, 'I scored 4,200 points in STACKED: 40 lines, level 5, 3:02, 1 halving, best combo 4. Free practice at lestersarcade.io');
  assert.match(buildStackedShareText({ score: 1, ranked: true }), /Ranked run/);
  assert.match(buildStackedShareText({ score: 1, assisted: true }), /Assisted practice/);
  for (const text of [hmh, win, stacked]) assert.doesNotMatch(text, /0x[0-9a-f]{6,}/i);
});

function fakeDocument() {
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.listeners = new Map(); }
    appendChild(child) { this.children.push(child); return child; }
    prepend(child) { this.children.unshift(child); }
    get lastChild() { return this.children.at(-1); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
    async dispatch(type) { for (const fn of this.listeners.get(type) ?? []) await fn({ preventDefault() {} }); }
  }
  return { createElement: (tag) => new Node(tag) };
}

test('the share row builds noopener intent links, a Discord copy and a native share when available', async () => {
  const documentRef = fakeDocument();
  const copied = [];
  const shared = [];
  const statuses = [];
  const links = buildShareLinks({ text: 'I scored 5 points in Hard Money Heroes', url: shareUrlFor('hmh-reboot'), hashtags: ['LestersArcade'] });
  const row = createShareRow({
    documentRef,
    navigatorRef: { share: async (payload) => { shared.push(payload); }, clipboard: { writeText: async (text) => { copied.push(text); } } },
    title: 'Hard Money Heroes',
    links,
    onStatus: (message) => statuses.push(message),
  });
  assert.equal(row.dataset.shareRow, 'true');
  assert.deepEqual(row.children.map((node) => node.dataset.share), ['native', 'x', 'facebook', 'discord']);
  const [native, x, facebook, discord] = row.children;
  assert.equal(x.tagName, 'a');
  assert.equal(x.rel, 'noopener noreferrer');
  assert.equal(x.target, '_blank');
  assert.equal(x.href, links.x);
  assert.equal(facebook.href, links.facebook);
  assert.equal(discord.tagName, 'button');
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
  await discord.dispatch('click');
  assert.equal(copied.at(-1), next.discord);
});

test('without the Web Share API the row has no native button and a missing clipboard fails soft', async () => {
  const documentRef = fakeDocument();
  const links = buildShareLinks({ text: 'I scored 1 point in STACKED' });
  const row = createShareRow({ documentRef, navigatorRef: {}, links });
  assert.deepEqual(row.children.map((node) => node.dataset.share), ['x', 'facebook', 'discord']);
  await row.children[2].dispatch('click');
  assert.equal(row.children[2].textContent, 'Copy unavailable');
  assert.equal(row.dataset.shareStatus, 'Copying is unavailable in this browser.');
});

test('all three cabinets mount the share row and the child hosts allow popups, share and clipboard', async () => {
  const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
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
  for (const host of [chikunHost, stackedHost]) {
    assert.match(host, /allow-popups allow-popups-to-escape-sandbox/);
    assert.match(host, /web-share; clipboard-write/);
    assert.doesNotMatch(host, /allow-top-navigation/);
  }
  assert.doesNotMatch(portalHtml, /target="_blank"(?![^>]*rel="[^"]*noopener)/);
});
