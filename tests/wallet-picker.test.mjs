import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildWalletPickerModel, WALLET_PICKER_STYLESHEET } from '../apps/portal/src/wallet-picker.mjs';
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
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.attributes = {}; this.listeners = {}; this.textContent = ''; this.className = ''; this.dataset = {}; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); this.parent = null; }
    setAttribute(key, value) { this.attributes[key] = value; if (key === 'id') this.id = value; }
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
  for (const lazy of ['wallet-picker', 'wallet-chips', 'walletconnect-provider', 'ranked-preflight', 'ranked-identity']) {
    assert.doesNotMatch(main, new RegExp(`^import[^\\n]*\\./src/${lazy}\\.mjs`, 'm'), `${lazy} loads with import()`);
    assert.match(main, new RegExp(`import\\('\\./src/${lazy}\\.mjs'\\)`), `${lazy} has a dynamic import`);
  }
});
