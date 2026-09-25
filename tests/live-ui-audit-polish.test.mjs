// Live UI audit 2026-09-24 (docs/qa/live-ui-audit-20260924.json): the style
// defects found on production, pinned so they do not come back.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createHostedProfileView } from '../apps/portal/src/routes/hosted-profile-view.mjs';
import { renderSharePage } from '../server/share/render-page.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const css = ['apps/portal/styles.css', 'apps/portal/styles-arcade-polish.css', 'apps/portal/portal-discovery.css', 'apps/portal/src/styles/wallet-picker.css'].map(read).join('\n');
const polish = read('apps/portal/styles-arcade-polish.css');

// The declarations of the first rule whose selector list contains `selector`.
function ruleFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|[},])\\s*[^{}]*${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`, 'm').exec(source);
  return match ? match[1] : null;
}
const channel = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const luminance = (hex) => { const [r, g, b] = channel(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('generic pixel buttons get the arcade style with readable text (was browser grey, 3.8:1)', () => {
  const rule = ruleFor(polish, 'button[class="pixel-button"]');
  assert.ok(rule, 'a rule for buttons that carry only pixel-button');
  assert.match(polish, /a\[class="pixel-button"\],/, 'links too (the Ranked guard faucet link)');
  const color = /(?:^|;)\s*color:\s*(#[0-9a-f]{6})/i.exec(rule)?.[1];
  const base = /background:[^;]*\)\s*,\s*(#[0-9a-f]{6})/i.exec(rule)?.[1];
  assert.ok(color && base, 'a text colour and an opaque base colour');
  assert.ok(contrast(color, base) >= 7, `text contrast ${contrast(color, base).toFixed(2)} is at least 7:1`);
  assert.match(rule, /min-height:\s*44px/, '44 px touch target');
  assert.match(polish, /button\[class="pixel-button"\]:focus-visible[^{]*\{[^}]*outline: 2px solid/);

  // Every pixel-button variant in the portal UI has a style of its own or is in the generic list.
  const sources = ['apps/portal/main.js',
    ...readdirSync(path.join(root, 'apps/portal/src')).map((file) => `apps/portal/src/${file}`),
    ...readdirSync(path.join(root, 'apps/portal/src/routes')).map((file) => `apps/portal/src/routes/${file}`)]
    .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'));
  const variants = new Set();
  const add = (classes) => variants.add(classes.trim().split(/\s+/).filter((name) => name && name !== 'is-active').join(' '));
  for (const file of sources) {
    const source = read(file);
    for (const [, classes] of source.matchAll(/className: [`'"]pixel-button([^`'"$]*)/g)) add(classes);
    // name-claim-prompt.mjs builds its buttons through button(documentRef, '<classes>', …).
    if (source.includes('className = `pixel-button ${className}`')) for (const [, classes] of source.matchAll(/button\(documentRef, '([^']+)'/g)) add(classes);
  }
  assert.ok(variants.has('name-claim-later'), 'the name toast buttons are scanned');
  assert.ok(variants.has(''), 'plain pixel-button buttons exist');
  for (const variant of variants) {
    if (!variant) continue;
    const styled = variant.split(' ').some((name) => new RegExp(`\\.${name}(?![\\w-])`).test(css));
    assert.ok(styled, `pixel-button ${variant} has a style`);
  }
});

test('Show more keeps a busy look while it stays focusable', () => {
  assert.match(polish, /\.leaderboard-show-more\[aria-disabled="true"\] \{[^}]*cursor: progress/);
});

test('wallet addresses keep their hex case on the profile and the boards', () => {
  assert.match(ruleFor(polish, '.profile-hero-name.profile-hero-name-wallet'), /text-transform: none/);
  assert.match(ruleFor(polish, '.leaderboard-table .lt-name-meta > .lt-wallet-short'), /text-transform: none/);
});

test('recent runs start at the top of their card and wrap on phones', () => {
  assert.match(ruleFor(polish, '.profile-command-grid > .profile-recent-sessions-card'), /justify-content: flex-start/);
  const row = ruleFor(polish, '.game-history-row.profile-session-row');
  assert.match(row, /flex-wrap: wrap/);
  assert.match(ruleFor(polish, '.profile-session-row > .game-history-detail'), /min-width: 0/);
  const link = ruleFor(polish, '.profile-session-row > .game-history-link');
  assert.match(link, /white-space: nowrap/);
  // Review 2026-09-24: the run links ('⛓ verified', 'Run page') were 32 px,
  // under the 44 px the share page links got in this same audit.
  assert.match(link, /min-height: 44px/, '44 px touch targets for the run links');
});

test('achievement titles lead their card and phones get two columns', () => {
  const size = Number(/font-size: ([\d.]+)rem/.exec(ruleFor(polish, '.profile-achievement-card .achievement-name'))?.[1]);
  assert.ok(size >= 0.8, `achievement title ${size}rem (was 0.64rem, smaller than its tier line)`);
  assert.match(polish, /@media \(max-width: 560px\) \{\s*\.achievements-grid\.profile-achievement-grid \{ grid-template-columns: repeat\(auto-fill, minmax\(140px, 1fr\)\);/);
});

test('the board title spaces its trophy from the text', () => {
  assert.match(polish, /\.leaderboard-title \{ display: flex; align-items: center; gap: 0\.45em; \}/);
});

// A tiny double, enough for the profile hero.
function node(tag, props = {}) {
  return {
    tag, children: [], attributes: {}, listeners: {}, dataset: {}, ...props,
    classList: { add() {}, toggle() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
}
const find = (rootNode, predicate, hits = []) => { if (predicate(rootNode)) hits.push(rootNode); for (const child of rootNode.children ?? []) find(child, predicate, hits); return hits; };

test('the profile hero marks a wallet shown in place of a display name', async () => {
  const wallet = `0x${'8841'.padEnd(40, 'a')}`;
  for (const displayName of [null, 'Pilot One']) {
    const grid = node('div');
    const routeState = { gameId: 'lester-blaster', viewedWallet: wallet };
    let view = null;
    view = createHostedProfileView({
      appendText: (parent, tag, content, className = '') => { const child = node(tag, { textContent: content, className }); parent.append(child); return child; },
      el: (tag, props = {}) => node(tag, props),
      dom: { officialCabinetGrid: grid },
      getContext: () => ({ connectedWallet: null }),
      indexApi: { profile: async () => ({ ok: true, wallet, profile: { displayName, avatarUri: null }, games: {}, recentSessions: [], achievements: [] }) },
      playSfxCue: () => {},
      renderAvatarChip: () => node('img'),
      renderAchievementIcon: () => node('img'),
      renderPage: () => view.render(),
      routeState,
      setView: () => {},
    });
    view.render();
    await view.hydrate();
    const name = find(grid, (candidate) => String(candidate.className ?? '').includes('profile-hero-name'))[0];
    assert.equal(name.textContent, displayName ?? '0x8841…aaaa');
    assert.equal(name.className, displayName ? 'profile-hero-name' : 'profile-hero-name profile-hero-name-wallet');
  }
});

// At 320 px the share page's header links were 15 and 23 px tall.
test('the share page header links are 44 px touch targets', () => {
  const { html } = renderSharePage({ session: null, status: 404 });
  assert.match(html, /\.top a\{display:inline-flex;align-items:center;min-height:44px\}/);
  assert.match(html, /<div class="top"><a class="brand" href="\/">/);
});
