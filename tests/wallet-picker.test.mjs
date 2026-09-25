import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildWalletPickerModel, WALLET_PICKER_STYLESHEET } from '../apps/portal/src/wallet-picker.mjs';
import { WALLET_CONNECTOR_STORAGE_KEY } from '../apps/portal/src/wallet-session.mjs';
import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';
import {
  FEATURED_WALLET_RDNS,
  REOWN_ALLOWED_HOSTS,
  REOWN_PROJECT_ID,
  WALLET_DEEP_LINKS,
  WALLET_INSTALL_LINKS,
  LITEFORGE_FAUCET_URL,
} from '../apps/portal/src/wallet-config.mjs';

const provider = { request: async () => null };
const announce = (uuid, name, rdns, icon = null) => ({ uuid, name, rdns, icon, provider });

test('wallet config carries the contract constants (§7.6)', () => {
  assert.equal(REOWN_PROJECT_ID, 'eedf4ae26a379df793b7f4eef223a0c9');
  assert.deepEqual([...REOWN_ALLOWED_HOSTS], ['lestersarcade.io', 'www.lestersarcade.io']);
  assert.deepEqual([...FEATURED_WALLET_RDNS], ['io.metamask', 'io.rabby']);
  assert.deepEqual({ ...WALLET_INSTALL_LINKS }, { 'io.metamask': 'https://metamask.io/download/', 'io.rabby': 'https://rabby.io/' });
  assert.deepEqual({ ...WALLET_DEEP_LINKS }, {
    metamask: 'https://metamask.app.link/dapp/lestersarcade.io',
    trust: 'https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Flestersarcade.io',
  });
  assert.equal(LITEFORGE_FAUCET_URL, 'https://liteforge.hub.caldera.xyz');
  // The security sweep reads *_API_KEY literals as credentials; the id is public.
  const source = readFileSync(new URL('../apps/portal/src/wallet-config.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /export const \w*API_KEY/);
});

test('MetaMask and Rabby are featured first', () => {
  const model = buildWalletPickerModel({
    providers: [
      announce('u-1', 'Coinbase Wallet', 'com.coinbase.wallet'),
      announce('u-2', 'Rabby Wallet', 'io.rabby', 'data:image/svg+xml;base64,PHN2Zy8+'),
      announce('u-3', 'Phantom', 'app.phantom'),
      announce('u-4', 'MetaMask', 'io.metamask'),
    ],
    isMobile: false,
    host: 'localhost',
    remembered: { kind: 'eip6963', rdns: 'io.rabby', wallet: `0x${'12'.repeat(20)}` },
  });
  assert.deepEqual(model.entries.map((entry) => entry.name), ['MetaMask', 'Rabby Wallet', 'Coinbase Wallet', 'Phantom']);
  assert.deepEqual(model.entries.map((entry) => entry.featured), [true, true, false, false]);
  assert.equal(model.entries.find((entry) => entry.rdns === 'io.rabby').lastUsed, true);
  assert.equal(model.entries.find((entry) => entry.rdns === 'io.rabby').icon, 'data:image/svg+xml;base64,PHN2Zy8+');
  assert.deepEqual(model.installLinks, [], 'no install links while a featured wallet is installed');
  assert.equal(model.simulated, false);
  // Only data: image icons are rendered (a wallet cannot point the page at a remote URL).
  const remote = buildWalletPickerModel({ providers: [announce('u-9', 'Odd', 'x.odd', 'https://evil.invalid/i.png')], host: 'localhost' });
  assert.equal(remote.entries[0].icon, null);
});

test('install and deep links appear when no wallet is present on mobile', () => {
  const phone = buildWalletPickerModel({ providers: [], isMobile: true, host: 'lestersarcade.io', remembered: null });
  assert.deepEqual(phone.installLinks.map((link) => link.href), ['https://metamask.io/download/', 'https://rabby.io/']);
  assert.deepEqual(phone.deepLinks.map((link) => [link.name, link.href]), [
    ['MetaMask', 'https://metamask.app.link/dapp/lestersarcade.io'],
    ['Trust Wallet', 'https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Flestersarcade.io'],
  ]);
  assert.equal(phone.deepLinks.some((link) => /rabby/i.test(link.href)), false, 'no undocumented Rabby mobile link');
  assert.deepEqual(phone.entries.map((entry) => entry.kind), ['walletconnect']);
  assert.equal(phone.simulated, false);

  // Desktop with an unfeatured wallet only: install links, no deep links.
  const desktop = buildWalletPickerModel({ providers: [announce('u-1', 'Phantom', 'app.phantom')], isMobile: false, host: 'lestersarcade.io' });
  assert.equal(desktop.installLinks.length, 2);
  assert.deepEqual(desktop.deepLinks, []);
  // A phone already inside a wallet's browser (an injected wallet) needs no deep link.
  const inWallet = buildWalletPickerModel({ providers: [{ kind: 'legacy', name: 'Browser wallet' }], isMobile: true, host: 'lestersarcade.io' });
  assert.deepEqual(inWallet.deepLinks, []);
});

test('WalletConnect only on allowed hosts', () => {
  for (const host of REOWN_ALLOWED_HOSTS) {
    const model = buildWalletPickerModel({ providers: [announce('u-4', 'MetaMask', 'io.metamask')], host });
    assert.equal(model.walletConnect, true);
    assert.deepEqual(model.entries.map((entry) => entry.kind), ['eip6963', 'walletconnect']);
  }
  for (const host of ['localhost', '127.0.0.1', 'lesters-arcade-git-branch.vercel.app', 'evil-lestersarcade.io', '']) {
    const model = buildWalletPickerModel({ providers: [announce('u-4', 'MetaMask', 'io.metamask')], host });
    assert.equal(model.walletConnect, false, host);
    assert.equal(model.entries.some((entry) => entry.kind === 'walletconnect'), false, host);
  }
});

test('simulated fallback only when nothing is available', () => {
  assert.equal(buildWalletPickerModel({ providers: [], host: 'localhost' }).simulated, true, 'no wallet, no WalletConnect: the local QA identity');
  assert.equal(buildWalletPickerModel({ providers: [], host: 'lestersarcade.io' }).simulated, false, 'WalletConnect is available');
  assert.equal(buildWalletPickerModel({ providers: [{ kind: 'legacy', name: 'Browser wallet' }], host: 'localhost' }).simulated, false, 'an injected provider');
  assert.equal(buildWalletPickerModel({ providers: [announce('u-1', 'MetaMask', 'io.metamask')], host: 'localhost' }).simulated, false, 'an EIP-6963 announcement');
  // The legacy slot is listed only when no wallet announced itself.
  const both = buildWalletPickerModel({ providers: [announce('u-1', 'MetaMask', 'io.metamask'), { kind: 'legacy', name: 'Browser wallet' }], host: 'localhost' });
  assert.deepEqual(both.entries.map((entry) => entry.kind), ['eip6963']);
  const legacyOnly = buildWalletPickerModel({ providers: [{ kind: 'legacy', name: 'MetaMask' }], host: 'localhost', remembered: { kind: 'legacy', rdns: null, wallet: `0x${'12'.repeat(20)}` } });
  assert.deepEqual(legacyOnly.entries.map((entry) => [entry.kind, entry.name, entry.lastUsed]), [['legacy', 'MetaMask', true]]);
});

// A minimal DOM for the dialog: enough to prove focus trapping, Escape, the
// stylesheet link and the 44 px touch targets in the stylesheet.
function fakeDocument() {
  const listeners = new Map();
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.attributes = {}; this.listeners = {}; this.textContent = ''; this.className = ''; this.dataset = {}; this.style = {}; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); this.parent = null; }
    setAttribute(key, value) { this.attributes[key] = value; if (key === 'id') this.id = value; }
    removeAttribute(key) { delete this.attributes[key]; if (key === 'style') this.style = {}; }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    click() { this.listeners.click?.({ target: this }); }
    focus() { doc.activeElement = this; }
    contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
    all() { return this.children.flatMap((child) => [child, ...child.all()]); }
    querySelectorAll(selector) {
      if (selector.startsWith('a[href]')) return this.all().filter((n) => (n.tagName === 'A' && n.attributes.href) || n.tagName === 'BUTTON');
      return [];
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }
  const doc = {
    head: new Node('head'),
    body: new Node('body'),
    activeElement: null,
    createElement: (tag) => new Node(tag),
    getElementById(id) { return [...this.head.all(), ...this.body.all()].find((n) => n.id === id) ?? null; },
    querySelector() { return null; },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    key(key, shiftKey = false) { listeners.get('keydown')?.({ key, shiftKey, preventDefault() {} }); },
  };
  return doc;
}

test('the picker sits over the page, traps focus and closes on Escape', async () => {
  const { openWalletPicker, openChainExplainer } = await import('../apps/portal/src/wallet-picker.mjs');
  const doc = fakeDocument();
  const model = buildWalletPickerModel({ providers: [announce('u-4', 'MetaMask', 'io.metamask')], host: 'lestersarcade.io' });
  let picked;
  const pending = openWalletPicker({ documentRef: doc, model, onPick: (value) => { picked = value; } });
  const overlay = doc.body.children[0];
  assert.match(overlay.className, /wallet-sheet-overlay/);
  const sheet = overlay.children[0];
  assert.equal(sheet.attributes.role, 'dialog');
  assert.equal(sheet.attributes['aria-modal'], 'true');
  assert.equal(doc.head.children[0].href, WALLET_PICKER_STYLESHEET, 'the picker injects its stylesheet as a <link>');
  const buttons = sheet.querySelectorAll('a[href], button');
  assert.equal(doc.activeElement, buttons[0], 'focus starts inside the dialog');
  doc.activeElement = buttons.at(-1);
  doc.key('Tab');
  assert.equal(doc.activeElement, buttons[0], 'Tab wraps from the last control to the first');
  doc.key('Tab', true);
  assert.equal(doc.activeElement, buttons.at(-1), 'Shift+Tab wraps back');
  doc.key('Escape');
  assert.equal(await pending, null);
  assert.equal(picked, null);
  assert.equal(doc.body.children.length, 0, 'Escape removes the dialog');

  // Choosing an entry resolves it.
  const again = openWalletPicker({ documentRef: doc, model });
  doc.body.children[0].children[0].querySelectorAll('a[href], button')[1].click();
  assert.equal((await again).kind, 'walletconnect');

  // The chain explainer resolves true only on its Switch button.
  const explainer = openChainExplainer({ documentRef: doc });
  const [switchButton] = doc.body.children[0].children[0].querySelectorAll('a[href], button');
  assert.equal(switchButton.textContent, 'Switch network');
  switchButton.click();
  assert.equal(await explainer, true);
  const declined = openChainExplainer({ documentRef: doc });
  doc.key('Escape');
  assert.equal(await declined, false);
});

// Live UI audit 2026-09-24: on a phone with a cold cache the picker painted
// unstyled under the page footer until wallet-picker.css arrived.
test('until its stylesheet applies the picker dims the page and keeps the sheet hidden', async () => {
  const { openWalletPicker, showWalletToast, walletPickerStylesPending, WALLET_FALLBACK_STYLES, WALLET_STYLES_TIMEOUT_MS } = await import('../apps/portal/src/wallet-picker.mjs');
  assert.equal(WALLET_STYLES_TIMEOUT_MS, 3000);
  assert.match(WALLET_FALLBACK_STYLES.overlay, /^position:fixed;inset:0;/, 'the fallback is an overlay, never page content');
  assert.match(WALLET_FALLBACK_STYLES.sheet, /visibility:hidden$/);
  const doc = fakeDocument();
  const createElement = doc.createElement;
  doc.createElement = (tag) => {
    const node = createElement(tag);
    if (tag === 'link') node.sheet = null; // a browser <link> before its CSS loads
    return node;
  };
  const opener = createElement('button');
  doc.body.append(opener);
  opener.focus();
  const model = buildWalletPickerModel({ providers: [announce('u-4', 'MetaMask', 'io.metamask')], host: 'lestersarcade.io' });
  const pending = openWalletPicker({ documentRef: doc, model });
  const link = doc.head.children[0];
  const overlay = doc.body.children.at(-1);
  const sheet = overlay.children[0];
  assert.equal(overlay.style.cssText, WALLET_FALLBACK_STYLES.overlay, 'the backdrop dims the page at once');
  assert.equal(sheet.style.cssText, WALLET_FALLBACK_STYLES.sheet, 'the sheet waits, hidden');
  assert.equal(doc.activeElement, opener, 'focus waits for the sheet to show');
  link.sheet = {};
  link.listeners.load();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual([overlay.style, sheet.style], [{}, {}], 'the stylesheet takes over: inline styles dropped');
  assert.equal(doc.activeElement, sheet.querySelectorAll('a[href], button')[0], 'focus moves into the dialog');
  doc.key('Escape');
  assert.equal(await pending, null);

  // Once loaded, later sheets and toasts carry no inline styles at all.
  const again = openWalletPicker({ documentRef: doc, model });
  assert.equal(doc.body.children.at(-1).style.cssText, undefined);
  doc.key('Escape');
  await again;
  const toast = showWalletToast({ documentRef: doc, message: 'Signed in', timeoutMs: 0 });
  assert.equal(toast.style.cssText, undefined);

  // A stylesheet that stalls or fails never keeps a sheet hidden for good.
  assert.equal(walletPickerStylesPending(null), null);
  assert.equal(walletPickerStylesPending({ sheet: {} }), null);
  const stalled = { sheet: null, addEventListener() {} };
  const started = Date.now();
  await walletPickerStylesPending(stalled, { timeoutMs: 20 });
  assert.ok(Date.now() - started >= 15, 'a stalled stylesheet resolves after the timeout');
  const failed = { sheet: null, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
  const waiting = walletPickerStylesPending(failed, { timeoutMs: 60_000 });
  failed.listeners.error();
  await waiting;

  // A failed stylesheet: the toast shows on its legible fallback.
  const failing = fakeDocument();
  const make = failing.createElement;
  failing.createElement = (tag) => { const node = make(tag); if (tag === 'link') node.sheet = null; return node; };
  const shown = showWalletToast({ documentRef: failing, message: 'Sign-in declined', timeoutMs: 0 });
  assert.match(shown.style.cssText, /visibility:hidden/);
  failing.head.children[0].listeners.error();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(shown.style.visibility, '', 'shown on the fallback styles');
  assert.match(shown.style.cssText, /^position:fixed;/);
  // A stylesheet that arrives after the fallback showed still takes over.
  const failedLink = failing.head.children[0];
  const next = showWalletToast({ documentRef: failing, message: 'Try again', timeoutMs: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(next.style.visibility, '', 'after one miss, later toasts use the fallback at once (a failed link fires no more events)');
  failedLink.listeners.load();
  assert.deepEqual(next.style, {});
});

test('the picker stylesheet keeps 44 px touch targets, thumb reach and a 320 px layout', () => {
  const css = readFileSync(new URL('../apps/portal/src/styles/wallet-picker.css', import.meta.url), 'utf8');
  assert.match(css, /\.wallet-picker-option \{[^}]*min-height: 56px/);
  assert.match(css, /\.wallet-picker-link \{[^}]*min-height: 44px/);
  assert.match(css, /\.wallet-sheet-primary,\s*\.wallet-sheet-secondary \{[^}]*min-height: 48px/);
  assert.match(css, /@media \(max-width: 640px\) \{\s*\.wallet-sheet-overlay \{ align-items: flex-end;/, 'phones get a bottom sheet');
  assert.match(css, /\.wallet-sheet \{[^}]*width: min\(420px, 100%\)/, 'never wider than the viewport');
  assert.match(css, /@media \(max-width: 400px\)[\s\S]*\.ranked-entry-row \{ flex-wrap: wrap;/, 'the Ranked modal rows wrap at 320 px');
  assert.doesNotMatch(css, /:root\s*\{/, 'tokens stay in design-tokens.css');
});

test('the WalletConnect provider is lazy, host-gated and configured for LiteForge', async () => {
  const { buildAppKitOptions, createWalletConnectProvider, LITEFORGE_APPKIT_NETWORK, WALLETCONNECT_FEATURES } = await import('../apps/portal/src/walletconnect-provider.mjs');
  assert.equal(LITEFORGE_APPKIT_NETWORK.id, 4441);
  assert.equal(LITEFORGE_APPKIT_NETWORK.caipNetworkId, 'eip155:4441');
  assert.deepEqual([...LITEFORGE_APPKIT_NETWORK.rpcUrls.default.http], ['https://liteforge.rpc.caldera.xyz/http']);
  assert.equal(LITEFORGE_APPKIT_NETWORK.blockExplorers.default.url, 'https://liteforge.explorer.caldera.xyz');
  assert.deepEqual({ ...WALLETCONNECT_FEATURES }, { analytics: false, email: false, socials: false });
  const adapter = { name: 'fixture-adapter' };
  const options = buildAppKitOptions({ origin: 'https://lestersarcade.io', adapter });
  assert.equal(options.projectId, REOWN_PROJECT_ID);
  assert.deepEqual(options.features, { analytics: false, email: false, socials: false });
  assert.deepEqual(options.adapters, [adapter]);
  assert.equal(options.networks[0], LITEFORGE_APPKIT_NETWORK);
  assert.equal(options.metadata.url, 'https://lestersarcade.io');

  // Refused off the allowed hosts before AppKit is ever loaded.
  let loads = 0;
  const loadAppKit = async () => { loads += 1; throw new Error('must not load'); };
  await assert.rejects(createWalletConnectProvider({ host: 'localhost', loadAppKit }), /not available/);
  assert.equal(loads, 0);

  // On an allowed host it opens the modal and resolves the connected provider.
  const walletProvider = { request: async () => ['0x'] };
  let connected = false;
  const subscribers = [];
  const appKit = {
    getIsConnectedState: () => connected,
    getProvider: () => (connected ? walletProvider : undefined),
    subscribeProviders: (fn) => { subscribers.push(fn); return () => {}; },
    subscribeAccount: (fn) => { subscribers.push(fn); return () => {}; },
    subscribeState: () => () => {},
    open: async () => { connected = true; for (const fn of subscribers) fn(); },
  };
  let created = null;
  const provider = await createWalletConnectProvider({
    host: 'lestersarcade.io', origin: 'https://lestersarcade.io',
    loadAppKit: async () => ({ createAppKit: (opts) => { created = opts; return appKit; }, EthersAdapter: class { constructor() { this.kind = 'ethers'; } } }),
  });
  assert.equal(provider, walletProvider);
  assert.equal(created.projectId, REOWN_PROJECT_ID);
  assert.equal(created.adapters[0].kind, 'ethers');

  // Reown is imported only inside the vendor entry, which only this module
  // loads, and only with import().
  const source = readFileSync(new URL('../apps/portal/src/walletconnect-provider.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^import[^\n]*@reown/m);
  assert.match(source, /await import\('\.\/reown-appkit-vendor\.mjs'\)/);
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /^import[^\n]*(?:walletconnect-provider|reown-appkit-vendor|@reown)/m, 'AppKit is never statically reachable from main.js');
  // ranked-identity is left out: ranked-client may import it statically for
  // its own sites. wallet-config has no import of its own in main.js: the
  // lazy modules carry it (brief acceptance 1).
  for (const lazy of ['wallet-picker', 'wallet-chips', 'walletconnect-provider', 'ranked-preflight', 'wallet-session']) {
    assert.doesNotMatch(main, new RegExp(`^import[^\\n]*\\./src/${lazy}\\.mjs`, 'm'), `${lazy} loads with import()`);
    assert.match(main, new RegExp(`import\\('\\./src/${lazy}\\.mjs'\\)`), `${lazy} has a dynamic import`);
  }
  assert.doesNotMatch(main, /^import[^\n]*\.\/src\/wallet-config\.mjs/m, 'wallet-config is never a static import of main.js');
  // The boot peek at the remembered connector uses the module's own key.
  assert.ok(main.includes(`const WALLET_CONNECTOR_STORAGE_KEY = '${WALLET_CONNECTOR_STORAGE_KEY}';`));
  // The faucet link the Ranked modal renders is the configured faucet.
  assert.equal(LITVM_LITEFORGE_NETWORK.faucetUrl, LITEFORGE_FAUCET_URL);
});

test('sign-out ends a WalletConnect session restored at boot, and only then creates AppKit', async () => {
  // A fresh module instance: no AppKit has been created in it yet.
  const fresh = await import(`../apps/portal/src/walletconnect-provider.mjs?signout=${Date.now()}`);
  let loads = 0;
  const refuse = async () => { loads += 1; throw new Error('must not load'); };
  // A plain disconnect never creates AppKit.
  await fresh.disconnectWalletConnect({ loadAppKit: refuse });
  // Off the Reown-allowed hosts there is nothing to end.
  await fresh.disconnectWalletConnect({ restoreFirst: true, host: 'localhost', loadAppKit: refuse });
  assert.equal(loads, 0);

  // A restored session (no provider yet): AppKit is created on the sign-out
  // click, reconnects the stored relay session without its modal, then
  // disconnects it, so the next WalletConnect pick asks again.
  const calls = [];
  let connected = false;
  const appKit = {
    getIsConnectedState: () => connected,
    getProvider: () => (connected ? { request: async () => [] } : undefined),
    subscribeProviders: (fn) => { setTimeout(() => { connected = true; fn(); }, 1); return () => {}; },
    subscribeAccount: () => () => {},
    subscribeState: () => () => {},
    open: async () => { calls.push('open'); },
    disconnect: async () => { calls.push('disconnect'); connected = false; },
  };
  await fresh.disconnectWalletConnect({
    restoreFirst: true, host: 'lestersarcade.io', origin: 'https://lestersarcade.io', reconnectWaitMs: 200,
    loadAppKit: async () => ({ createAppKit: () => { calls.push('create'); return appKit; }, EthersAdapter: class {} }),
  });
  assert.deepEqual(calls, ['create', 'disconnect'], 'no connect modal, and the stored session is ended');

  // main.js ends it on sign-out whether or not the provider was ever created.
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("if (walletPickKind === 'walletconnect') void endWalletConnectSession({ restoreFirst: !connectedProvider });"));
  assert.ok(main.includes('disconnectWalletConnect({ restoreFirst })'));
});
