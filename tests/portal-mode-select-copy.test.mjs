import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { PORTAL_AST, PORTAL_MAIN, portalCallback, portalFunctionSource } from './helpers/ranked-client-vm.mjs';
import { createOfficialPlayRoutes } from '../apps/portal/src/routes/official-play-routes.mjs';
import { buildGameModeSelectModel } from '../apps/portal/src/arcade-core.mjs';
import { PORTAL_COPY, PORTAL_FLAGS, PORTAL_GAMES, escapeHtml, portalCopyFor } from '../apps/portal/src/portal-content.mjs';
import { buildPortalPages } from '../scripts/build-portal-pages.mjs';

// Contract A33: the mode-select cards are what a player reads just before
// choosing Ranked. The SPA route and the prerendered pages must say the same
// thing, and both must follow SETTLEMENT_LIVE and HOSTED_PROFILE_SYNC.
const portal = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false });
const hostedPreview = portalCopyFor({ settlementLive: false, hostedProfileSync: true });
const launch = portalCopyFor({ settlementLive: true, hostedProfileSync: true });
const SITE_COPY_GAMES = ['lester-blaster', 'chikun', 'stacked'];

function node(tag = 'div', props = {}) {
  return {
    tag, children: [], dataset: {}, style: {}, attrs: {}, hidden: false, textContent: '',
    ...props,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name] ?? null; },
  };
}

function mountModeSelect({ gameId, getContext, portalCopy } = {}) {
  const keys = ['officialModeSelect', 'officialModeEyebrow', 'officialModeTitle', 'officialModeCopy', 'officialModeArtNote', 'officialFreeModeButton', 'officialRankedModeButton', 'officialFreeModeBanner', 'officialRankedModeBanner', 'officialFreeModeTitle', 'officialRankedModeTitle', 'officialFreeModeCopy', 'officialRankedModeCopy', 'officialRankedTooltip'];
  const dom = Object.fromEntries(keys.map(key => [key, node(key)]));
  const routes = createOfficialPlayRoutes({
    dom,
    getContext,
    selectedGame: () => ({ id: gameId }),
    buildGameModeSelectModel,
    applyGameModeSelectBackground: () => {},
    appendText: (parent, tag, text) => parent.append(node(tag, { textContent: text })),
    el: (tag, props = {}) => node(tag, props),
    SETTLEMENT_LIVE: false,
    ...(portalCopy ? { portalCopy } : {}),
  });
  const read = () => ({ mode: dom.officialModeCopy.textContent, ranked: dom.officialRankedModeCopy.textContent, free: dom.officialFreeModeCopy.textContent, tooltip: dom.officialRankedTooltip.children.map(child => child.textContent) });
  return { routes, read };
}

function renderModeSelect({ gameId, connectedWallet = '0xabc', walletSignedIn, portalCopy } = {}) {
  const { routes, read } = mountModeSelect({ gameId, portalCopy, getContext: () => ({ connectedWallet, ...(walletSignedIn === undefined ? {} : { walletSignedIn }) }) });
  routes.renderModeSelect();
  return read();
}

const block = (html, key) => html.match(new RegExp(`<!-- copy:${key}:start -->([\\s\\S]*?)<!-- copy:${key}:end -->`))?.[1];
const slugOf = gameId => PORTAL_GAMES.find(game => game.id === gameId).slug;

test('every game’s mode-select cards show the site copy for every flag state', () => {
  for (const [name, copy] of Object.entries({ preview, hostedPreview, launch })) {
    for (const gameId of SITE_COPY_GAMES) {
      const descriptor = buildGameModeSelectModel(gameId);
      const view = renderModeSelect({ gameId, portalCopy: copy });
      assert.equal(view.mode, copy.modeSelect[gameId].copy, `${name} ${gameId} mode line`);
      assert.equal(view.ranked, copy.modeSelect[gameId].ranked, `${name} ${gameId} Ranked card`);
      assert.deepEqual(view.tooltip, [`${descriptor.ranked.label}: ${copy.modeRankedTooltip}`, copy.modeSelect[gameId].ranked], `${name} ${gameId} Ranked tooltip`);
      assert.equal(view.free, descriptor.free.copy, 'the Free card keeps its descriptor copy, true in both states');
    }
  }
});

test('without an injected copy the route uses the committed flags', () => {
  for (const gameId of SITE_COPY_GAMES) {
    const view = renderModeSelect({ gameId });
    assert.equal(view.mode, PORTAL_COPY.modeSelect[gameId].copy);
    assert.equal(view.ranked, PORTAL_COPY.modeSelect[gameId].ranked);
  }
  assert.deepEqual(PORTAL_COPY.modeSelect, portalCopyFor(PORTAL_FLAGS).modeSelect);
});

test('the preview cards promise no publishing and the launch cards state the fee and the check', () => {
  for (const gameId of SITE_COPY_GAMES) {
    const now = renderModeSelect({ gameId, portalCopy: preview });
    const text = [now.mode, now.ranked, ...now.tooltip].join(' ');
    assert.match(now.ranked, /nothing is published on chain yet/);
    assert.doesNotMatch(text, /Publish your score|zkLTC|LiteForge|0\.102|replayed/i, `${gameId} preview`);
  }
  const hmh = renderModeSelect({ gameId: 'lester-blaster', portalCopy: launch });
  assert.match(hmh.ranked, /^0\.102 testnet zkLTC per run\. The arcade server plausibility-checks your run \(it is not replayed\) and publishes it on LitVM\.$/);
  const chikun = renderModeSelect({ gameId: 'chikun', portalCopy: launch });
  assert.match(chikun.ranked, /^0\.102 testnet zkLTC per run\. The arcade server replays your run from its inputs and publishes it on LitVM\.$/);
  const stacked = renderModeSelect({ gameId: 'stacked', portalCopy: launch });
  assert.match(stacked.ranked, /^0\.102 testnet zkLTC per run\. The arcade server replays your run from its inputs and publishes it on LitVM\.$/);
  assert.match(stacked.mode, /Ranked starts at level 1 with no undo/);
  for (const view of [hmh, chikun, stacked]) {
    const text = [view.mode, view.ranked, ...view.tooltip].join(' ');
    assert.match(text, /LitVM testnet/);
    assert.doesNotMatch(text, /preview|Free on testnet|safely gated|canonical|temporarily disabled|device|local/i, 'no preview statement survives the flip');
  }
  assert.equal(hmh.tooltip[0], 'Play Ranked: verified and published on LitVM');
});

// Live UI audit 2026-09-24: STACKED's live Ranked card kept its descriptor
// ("Wallet-bound Ranked run…") with no price, unlike the other two games and
// its own prerendered page; the guest line said "Connect a wallet when you
// want Play Ranked." while the site's action is Sign in.
test('the guest line says Sign in once hosted, and STACKED no longer falls back to its descriptor', () => {
  const hmh = buildGameModeSelectModel('lester-blaster');
  for (const [copy, line] of [[launch, 'Sign in with a wallet when you want to play Ranked.'], [hostedPreview, 'Sign in with a wallet when you want to play Ranked.'], [preview, 'Connect a wallet when you want to play Ranked.']]) {
    const guest = renderModeSelect({ gameId: 'lester-blaster', connectedWallet: null, portalCopy: copy });
    assert.equal(guest.tooltip[0], `${hmh.free.label} is open to guests`);
    assert.equal(guest.tooltip[1], `${hmh.free.copy} ${line}`);
  }
  const stacked = buildGameModeSelectModel('stacked');
  for (const copy of [preview, hostedPreview, launch]) {
    const view = renderModeSelect({ gameId: 'stacked', portalCopy: copy });
    assert.notEqual(view.ranked, stacked.ranked.copy);
    assert.equal(view.ranked, copy.modeSelect.stacked.ranked);
    assert.equal(view.tooltip[0], `${stacked.ranked.label}: ${copy.modeRankedTooltip}`);
    assert.equal(view.free, stacked.free.copy, 'the Free card keeps its descriptor');
  }
  assert.ok(PORTAL_COPY.modeSelect.stacked);
});

// Live UI audit review 2026-09-24: HMH's mode line opened with 'Your Lester’s
// Arcade session is active.' for signed-out visitors too.
test('no mode line tells a signed-out visitor a session is active', () => {
  for (const [name, copy] of Object.entries({ preview, hostedPreview, launch })) {
    for (const gameId of SITE_COPY_GAMES) {
      const guest = renderModeSelect({ gameId, connectedWallet: null, portalCopy: copy });
      assert.doesNotMatch(guest.mode, /session is active|already active/i, `${name} ${gameId}`);
      assert.match(guest.mode, /^Choose Free Mode|^Public beta\./, `${name} ${gameId} starts with the choice`);
    }
  }
  assert.equal(launch.modeSelect['lester-blaster'].copy, 'Choose Free Mode to play without a wallet, or sign in and choose Play Ranked to compete on the LitVM testnet.');
  const index = readFileSync(join(portal, 'index.html'), 'utf8');
  assert.doesNotMatch(block(index, 'mode-copy'), /session is active/);
});

test('the prerendered mode-select blocks match what the SPA shows', () => {
  const index = readFileSync(join(portal, 'index.html'), 'utf8');
  assert.equal(block(index, 'mode-copy'), escapeHtml(PORTAL_COPY.modeSelect['lester-blaster'].copy));
  assert.equal(block(index, 'mode-ranked'), escapeHtml(PORTAL_COPY.modeSelect['lester-blaster'].ranked));
  const dir = mkdtempSync(join(tmpdir(), 'portal-mode-select-'));
  try {
    buildPortalPages({ flags: 'live', outDir: dir });
    for (const [pages, copy] of [[portal, PORTAL_COPY], [dir, launch]]) {
      for (const game of PORTAL_GAMES) {
        const html = readFileSync(join(pages, `discover/${game.slug}.html`), 'utf8');
        const expected = copy.modeSelect[game.id]?.ranked ?? copy.modeRanked;
        assert.equal(block(html, 'mode-ranked'), escapeHtml(expected), `${game.slug} Ranked card (${copy.state})`);
        if (copy.modeSelect[game.id]) assert.equal(renderModeSelect({ gameId: game.id, portalCopy: copy }).ranked, expected);
      }
    }
    assert.equal(block(readFileSync(join(dir, 'index.html'), 'utf8'), 'mode-ranked'), escapeHtml(launch.modeSelect['lester-blaster'].ranked));
    assert.match(readFileSync(join(dir, `discover/${slugOf('stacked')}.html`), 'utf8'), /<!-- copy:mode-ranked:start -->0\.102 testnet zkLTC per run\. The arcade server replays your run from its inputs and publishes it on LitVM\.<!-- copy:mode-ranked:end -->/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// polish-2 (live UI audit follow-up): a signed-in player was told to sign in,
// and Chikun's line offered "endless guest practice" to everyone. Each line
// now has a signed-out form (prerendered) and a signed-in form.
const main = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

test('a signed-in player reads a mode line with no guest or sign-in wording', () => {
  for (const [name, copy] of Object.entries({ preview, hostedPreview, launch })) {
    for (const gameId of SITE_COPY_GAMES) {
      const entry = copy.modeSelect[gameId];
      const signedIn = renderModeSelect({ gameId, walletSignedIn: true, portalCopy: copy });
      assert.equal(signedIn.mode, entry.copySignedIn, `${name} ${gameId}`);
      assert.doesNotMatch(signedIn.mode, /sign in|connect|guest|without a wallet|endless|session is active/i, `${name} ${gameId}`);
      assert.match(signedIn.mode, /^Choose Free Mode|^Public beta\./);
      assert.match(signedIn.mode, /Play Ranked/);
      // The Free card under it is shown to everyone: no guest wording there either.
      assert.doesNotMatch(signedIn.free, /guest|sign in|without a wallet/i, `${name} ${gameId} Free card`);
      // A wallet that is connected but not signed in still reads the
      // signed-out line: Ranked asks it to sign in first.
      assert.equal(renderModeSelect({ gameId, walletSignedIn: false, portalCopy: copy }).mode, entry.copy, `${name} ${gameId} connected, not signed in`);
      assert.equal(renderModeSelect({ gameId, connectedWallet: null, portalCopy: copy }).mode, entry.copy, `${name} ${gameId} signed out`);
    }
  }
  assert.equal(launch.modeSelect['lester-blaster'].copySignedIn, 'Choose Free Mode for practice, or Play Ranked to compete on the LitVM testnet.');
  assert.equal(launch.modeSelect.chikun.copySignedIn, 'Choose Free Mode for practice, or Play Ranked to compete on the LitVM testnet.');
  assert.equal(launch.modeSelect.stacked.copySignedIn, 'Public beta. Free Mode lets you pick your starting level. Ranked starts at level 1 with no undo: choose Play Ranked to compete on the LitVM testnet.');
  assert.match(hostedPreview.modeSelect.chikun.copySignedIn, /for a replay-verified Ranked preview\.$/);
  assert.match(preview.modeSelect['lester-blaster'].copySignedIn, /^Choose Free Mode for local practice/);
});

test('no mode line offers endless guest practice, and the signed-out lines stay truthful', () => {
  for (const [name, copy] of Object.entries({ preview, hostedPreview, launch })) {
    for (const gameId of SITE_COPY_GAMES) {
      const entry = copy.modeSelect[gameId];
      for (const line of [entry.copy, entry.copySignedIn]) assert.doesNotMatch(line, /endless/i, `${name} ${gameId}`);
      const action = copy === launch ? /sign in and choose Play Ranked/ : copy === hostedPreview ? /sign in with a wallet and choose Play Ranked/ : /connect a wallet and choose Play Ranked/;
      assert.match(entry.copy, action, `${name} ${gameId}`);
    }
  }
  assert.equal(launch.modeSelect.chikun.copy, 'Choose Free Mode to practice without a wallet, or sign in and choose Play Ranked to compete on the LitVM testnet.');
  assert.equal(hostedPreview.modeSelect.chikun.copy, 'Choose Free Mode for local guest practice, or sign in with a wallet and choose Play Ranked for a replay-verified Ranked preview.');
});

test('main.js tells the mode-select route whether the wallet is signed in', () => {
  const from = main.indexOf('const officialPlayRoutes = createOfficialPlayRoutes({');
  assert.ok(from > 0);
  const call = main.slice(from, main.indexOf('\n});', from));
  // Hosted: a live session for this wallet. The local preview: a connected wallet.
  assert.match(call, /\n {4}walletSignedIn: Boolean\(connectedWallet\) && \(!HOSTED_PROFILE_SYNC \|\| walletSessionAuthenticated\(connectedWallet\)\),\n/);
  // Without the flag the route shows the signed-out line (never claims a sign-in).
  for (const gameId of SITE_COPY_GAMES) assert.equal(renderModeSelect({ gameId, portalCopy: launch }).mode, launch.modeSelect[gameId].copy);
});

// polish-2 review: the pages prerender the signed-out line in every flag
// state; the signed-in form exists only in the SPA.
test('the prerendered mode line is the signed-out one, never the signed-in one', () => {
  const pages = [['committed', portal, PORTAL_COPY]];
  const dirs = [];
  try {
    for (const [name, flags, copy] of [['preview', { settlementLive: false, hostedProfileSync: false }, preview], ['hostedPreview', { settlementLive: false, hostedProfileSync: true }, hostedPreview], ['launch', 'live', launch]]) {
      const dir = mkdtempSync(join(tmpdir(), 'portal-mode-line-'));
      dirs.push(dir);
      buildPortalPages({ flags, outDir: dir });
      pages.push([name, dir, copy]);
    }
    for (const [name, dir, copy] of pages) {
      const entry = copy.modeSelect['lester-blaster'];
      assert.notEqual(entry.copy, entry.copySignedIn);
      for (const file of ['index.html', 'discover/games.html']) {
        const line = block(readFileSync(join(dir, file), 'utf8'), 'mode-copy');
        assert.equal(line, escapeHtml(entry.copy), `${name} ${file}`);
        assert.notEqual(line, escapeHtml(entry.copySignedIn), `${name} ${file}`);
      }
    }
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});

// polish-2 review: the line was right on the first render only. A sign-in
// from the Ranked entry modal's own button, or a dropped session (a 401),
// announces lesters:wallet-session while the mode select stays on screen.
// main.js's own listener, getContext and walletSessionAuthenticated run here
// in a VM against the real route.
function hostedModeSelectPage({ gameId, portalCopy, step = 'mode-select' }) {
  const wallet = `0x${'ab'.repeat(20)}`;
  const session = { authenticated: false };
  const timers = [];
  const context = vm.createContext({
    HOSTED_PROFILE_SYNC: true,
    officialAppStep: step,
    connectedWallet: wallet,
    walletSession: { isAuthenticated: address => session.authenticated && address === wallet },
    combat: {}, hmhRebootActive: false, officialSelectedMode: null, state: {},
    officialProfileRoute: { invalidate() {} },
    officialLeaderboardRoute: { invalidate() {} },
    hydrateProfileFromIndex() {},
    hydrateLeaderboardFromIndex() {},
    setTimeout: fn => { timers.push(fn); return timers.length; },
    window: new EventTarget(),
  });
  vm.runInContext(portalFunctionSource('walletSessionAuthenticated'), context);
  const view = mountModeSelect({ gameId, portalCopy, getContext: portalCallback('createOfficialPlayRoutes', 'getContext', context) });
  context.officialPlayRoutes = view.routes;
  const listener = PORTAL_AST.body.find(entry => entry.type === 'ExpressionStatement'
    && PORTAL_MAIN.slice(entry.start, entry.end).startsWith("window.addEventListener('lesters:wallet-session'"));
  assert.ok(listener, 'main.js registers the wallet-session listener at the top level');
  vm.runInContext(PORTAL_MAIN.slice(listener.start, listener.end), context);
  const announce = authenticated => {
    session.authenticated = authenticated;
    context.window.dispatchEvent(new Event('lesters:wallet-session'));
    while (timers.length) timers.shift()();
  };
  return { view, announce };
}

test('an in-page sign-in or a dropped session re-renders the mode line', () => {
  for (const [name, copy] of Object.entries({ hostedPreview, launch })) {
    for (const gameId of SITE_COPY_GAMES) {
      const entry = copy.modeSelect[gameId];
      const page = hostedModeSelectPage({ gameId, portalCopy: copy });
      page.view.routes.renderModeSelect();
      assert.equal(page.view.read().mode, entry.copy, `${name} ${gameId}: connected, not signed in`);
      page.announce(true); // signed in from the entry modal, which is then cancelled
      assert.equal(page.view.read().mode, entry.copySignedIn, `${name} ${gameId}: signed in`);
      page.announce(false); // a 401 drops the token; the wallet stays connected
      assert.equal(page.view.read().mode, entry.copy, `${name} ${gameId}: session dropped`);
    }
  }
  // Off the mode-select step the listener leaves the (hidden) line alone.
  const away = hostedModeSelectPage({ gameId: 'chikun', portalCopy: launch, step: 'profile' });
  away.view.routes.renderModeSelect();
  away.announce(true);
  assert.equal(away.view.read().mode, launch.modeSelect.chikun.copy);
});
