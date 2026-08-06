import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createOfficialAppRoutes } from '../apps/portal/src/routes/official-app-routes.mjs';

function panel() {
  return { hidden: false, dataset: {}, style: {} };
}

function harness({ step = 'settings', connectedWallet = null, guestAllowed = true } = {}) {
  const state = { step };
  const calls = [];
  const toggles = [];
  const documentRef = { documentElement: { dataset: {} } };
  const dom = {
    officialApp: panel(),
    arcadeMusicPlayer: panel(),
    officialWalletSplash: panel(),
    officialArcadeFloor: panel(),
    officialModeSelect: panel(),
    officialCharacterSelect: panel(),
    officialLevelIntro: panel(),
    officialGameplay: panel(),
    officialCabinetGrid: { classList: { toggle: (...args) => toggles.push(args) } },
    officialProfileEyebrow: {},
    officialProfileTitle: {},
    officialProfileCopy: {},
  };
  const routes = createOfficialAppRoutes({
    dom,
    documentRef,
    getStep: () => state.step,
    setStep: (next) => { state.step = next; },
    getConnectedWallet: () => connectedWallet,
    isGuestAllowedStep: () => guestAllowed,
    isSimulatedWalletActive: () => false,
    playableCabinetNames: () => ['Hard Money Heroes'],
    humanList: (items) => items.join(', '),
    shellModel: { profileRules: { walletLockCopy: 'Wallet profile rules.' } },
    applyHardMoneyHeroScreenBackground: (_target, screen) => calls.push(`background:${screen}`),
    renderNav: () => calls.push('nav'),
    renderWalletSplash: () => calls.push('wallet'),
    renderProfile: () => calls.push('profile'),
    renderLeaderboards: () => calls.push('leaderboards'),
    renderSettings: () => calls.push('settings'),
    renderCabinets: () => calls.push('cabinets'),
    renderModeSelect: () => calls.push('mode-select'),
    renderCharacterSelect: () => calls.push('character-select'),
    renderGameplay: () => calls.push('gameplay'),
  });
  return { routes, state, calls, toggles, dom, documentRef };
}

test('app dispatcher owns shell rendering and the settings arcade-floor route', () => {
  const h = harness({ step: 'settings' });
  h.routes.renderApp();
  assert.deepEqual(h.calls, ['nav', 'wallet', 'background:options', 'settings']);
  assert.equal(h.dom.officialArcadeFloor.hidden, false);
  assert.equal(h.dom.officialWalletSplash.hidden, true);
  assert.equal(h.dom.officialProfileTitle.textContent, 'Settings');
  assert.match(h.dom.officialProfileCopy.textContent, /Controls, audio, accessibility/);
  assert.deepEqual(h.toggles, [
    ['profile-command-grid', false],
    ['leaderboard-command-grid', false],
  ]);
});

test('app dispatcher applies guest gating before route selection', () => {
  const h = harness({ step: 'ranked-only', connectedWallet: null, guestAllowed: false });
  h.routes.renderApp();
  assert.equal(h.state.step, 'wallet-splash');
  assert.equal(h.dom.officialWalletSplash.hidden, false);
  assert.equal(h.dom.officialArcadeFloor.hidden, true);
});

test('gameplay route owns ingame dataset, music visibility, and gameplay delegation', () => {
  const h = harness({ step: 'gameplay', connectedWallet: '0x1234567890abcdef' });
  h.routes.renderApp();
  assert.equal(h.dom.arcadeMusicPlayer.hidden, true);
  assert.equal(h.documentRef.documentElement.dataset.ingame, 'true');
  assert.ok(h.calls.includes('gameplay'));
  assert.equal(h.dom.officialGameplay.hidden, false);
});

test('main delegates app and arcade-floor route ownership', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createOfficialAppRoutes/);
  assert.doesNotMatch(main, /function showOfficialPanel\(/);
  assert.doesNotMatch(main, /function renderOfficialArcadeFloor\(/);
  assert.doesNotMatch(main, /function renderOfficialApp\(/);
  assert.match(main, /function render\(\)[\s\S]*?renderOfficialApp\(\);/);
});
