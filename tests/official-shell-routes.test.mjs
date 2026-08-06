import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createOfficialShellRoutes } from '../apps/portal/src/routes/official-shell-routes.mjs';

function node(tag = 'div', props = {}) {
  return {
    tag,
    children: [],
    dataset: {},
    classList: { values: [], add(value) { this.values.push(value); } },
    attributes: {},
    listeners: {},
    ...props,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
}

function harness({ connectedWallet = null } = {}) {
  const dom = {
    officialApp: node(),
    officialNavTabs: node(),
    officialWalletSplash: node(),
    splashFeaturedCabinet: node(),
    officialWalletCopy: node(),
    officialConnectButton: node(),
    officialCabinetGrid: node(),
  };
  const calls = { views: [], sfx: [], backgrounds: [], signedOut: 0 };
  const routes = createOfficialShellRoutes({
    dom,
    documentRef: { createTextNode: (text) => ({ text }) },
    getStep: () => 'settings',
    getConnectedWallet: () => connectedWallet,
    getSelectedGameId: () => 'lester-blaster',
    getSessionId: () => null,
    getState: () => ({ profiles: {} }),
    setView: (step) => calls.views.push(step),
    playSfxCue: (cue) => calls.sfx.push(cue),
    signOutWallet: () => { calls.signedOut += 1; },
    buildPlatformShellModel: () => ({
      step: 'settings',
      breadcrumbs: [{ label: 'Arcade' }, { label: 'Settings' }],
      backTarget: { step: 'cabinet-select', label: 'Back to Arcade' },
      nav: [{ id: 'settings', step: 'settings', label: 'Settings', href: '/settings', active: true }],
    }),
    gameSlugFor: () => 'hard-money-heroes',
    el: (tag, props = {}) => node(tag, props),
    appendText: (parent, tag, text, className = '') => parent.append(node(tag, { textContent: text, className })),
    renderArcadeIcon: (id, label) => node('icon', { id, label }),
    buildPlayerArcadeSnapshot: () => ({ profile: { displayName: 'Satslinger' } }),
    renderAvatarChip: () => node('avatar'),
    applyHardMoneyHeroScreenBackground: (target, screen) => calls.backgrounds.push([target, screen]),
    shellModel: {
      cabinets: [{ id: 'hard-money-heroes', desktopCabinetSprite: { src: '/cabinet.png' } }],
      profileRules: { walletLockCopy: 'Connect wallet to save progress.' },
      levelIntro: { controlsSummary: 'Move, aim, fire, dash.' },
    },
    networkModel: { name: 'LitVM LiteForge', chainId: 504, nativeCurrency: { symbol: 'LIT' } },
    productionCabinetSprite: () => ({ src: '/fallback.png' }),
    renderRotatingCabinetSprite: (sprite, variant) => node('cabinet', { sprite, variant }),
  });
  return { routes, dom, calls };
}

test('shell nav renders a routable guest tab and delegates its transition', () => {
  const h = harness();
  h.routes.renderNav();
  assert.equal(h.dom.officialNavTabs.children.length, 1);
  const button = h.dom.officialNavTabs.children[0];
  assert.equal(button.dataset.route, '/settings');
  assert.equal(button.disabled, false);
  assert.ok(button.classList.values.includes('nav-tab-guest'));
  button.listeners.click();
  assert.deepEqual(h.calls.views, ['settings']);
  assert.deepEqual(h.calls.sfx, ['menu-click']);
  assert.equal(h.dom.officialApp.dataset.shellBreadcrumb, 'Arcade / Settings');
});

test('wallet splash renders the featured cabinet and connection state', () => {
  const guest = harness();
  guest.routes.renderWalletSplash();
  assert.equal(guest.dom.officialWalletCopy.textContent, 'Connect wallet to save progress.');
  assert.equal(guest.dom.officialConnectButton.textContent, 'Connect Wallet');
  assert.equal(guest.dom.splashFeaturedCabinet.children[0].variant, 'splash');
  assert.equal(guest.calls.backgrounds[0][1], 'splash');

  const connected = harness({ connectedWallet: '0x1234567890abcdef1234567890abcdef12345678' });
  connected.routes.renderWalletSplash();
  assert.match(connected.dom.officialWalletCopy.textContent, /0x123456…345678 is active/);
  assert.equal(connected.dom.officialConnectButton.textContent, 'Enter Arcade');
});

test('settings route renders the four authored platform settings cards', () => {
  const h = harness();
  h.routes.renderSettings();
  assert.equal(h.dom.officialCabinetGrid.children.length, 4);
  const text = h.dom.officialCabinetGrid.children.flatMap((card) => card.children.map((child) => child.textContent));
  assert.ok(text.includes('Controls'));
  assert.ok(text.includes('Audio'));
  assert.ok(text.includes('Network'));
  assert.ok(text.includes('Sign out'));
  assert.ok(text.some((value) => value?.includes('LitVM LiteForge // Chain 504 // gas LIT')));
});

test('main delegates shell-owned rendering to the route module', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createOfficialShellRoutes/);
  assert.doesNotMatch(main, /function renderOfficialNav\(/);
  assert.doesNotMatch(main, /function renderOfficialWalletSplash\(/);
  assert.doesNotMatch(main, /function renderOfficialSettings\(/);
});
