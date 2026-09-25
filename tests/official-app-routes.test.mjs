import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { createOfficialAppRoutes } from '../apps/portal/src/routes/official-app-routes.mjs';
import { PORTAL_COPY, portalCopyFor } from '../apps/portal/src/portal-content.mjs';

function panel() {
  return { hidden: false, dataset: {}, style: {} };
}

const launchCopy = portalCopyFor({ settlementLive: true, hostedProfileSync: true });

function harness({ step = 'settings', connectedWallet = null, guestAllowed = true, portalCopy, viewedWallet = null } = {}) {
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
    getViewedProfileWallet: () => viewedWallet,
    ...(portalCopy ? { portalCopy } : {}),
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

test('guest profile header does not promise available permanent history or Ranked publishing', () => {
  const h = harness({ step: 'profile' });
  h.routes.renderApp();
  // The header follows the settlement flags (contract A33); the preview wording
  // never promises history or publishing that the preview does not have.
  assert.equal(h.dom.officialProfileCopy.textContent, PORTAL_COPY.profileGuestView);
  const copy = portalCopyFor({ settlementLive: false, hostedProfileSync: false }).profileGuestView;
  assert.match(copy, /browser|device/i);
  assert.match(copy, /not.*available|not.*provide/i);
  assert.doesNotMatch(copy, /connect.*if you want.*publishing/i);
  assert.match(portalCopyFor({ settlementLive: false, hostedProfileSync: true }).profileGuestView, /Verified Ranked publishing is not available yet/);
  assert.ok(h.calls.includes('profile'));
});

test('connected profile header follows the settlement flags', () => {
  const h = harness({ step: 'profile', connectedWallet: '0x1234567890abcdef' });
  h.routes.renderApp();
  assert.equal(h.dom.officialProfileCopy.textContent, PORTAL_COPY.profileWalletView);
  assert.match(portalCopyFor({ settlementLive: false, hostedProfileSync: false }).profileWalletView, /No score transaction is sent while verified settlement is disabled/);
  assert.match(portalCopyFor({ settlementLive: true, hostedProfileSync: true }).profileWalletView, /verified Ranked runs, achievements, and on-chain name are tied to this wallet/);
});

test('scores header never names a board period the Scores page does not offer', () => {
  const h = harness({ step: 'leaderboards', connectedWallet: '0x1234567890abcdef' });
  h.routes.renderApp();
  assert.equal(h.dom.officialProfileCopy.textContent, PORTAL_COPY.scoresView);
  // The preview Scores page still has other time windows until profile-boards
  // drops its tabs, so the preview header names no period at all.
  const preview = portalCopyFor({ settlementLive: false, hostedProfileSync: false }).scoresView;
  assert.doesNotMatch(preview, /daily|weekly|monthly|yearly|all-time/i);
  assert.match(preview, /device-local Ranked preview records/);
  assert.match(launchCopy.scoresView, /^Global Weekly, Monthly, and All-time leaderboards of verified Ranked runs/);
  assert.doesNotMatch(launchCopy.scoresView, /daily|yearly/i);
  assert.ok(h.calls.includes('leaderboards'));
});

test('the Scores and Profile headers render the launch copy once the flags flip', () => {
  const scores = harness({ step: 'leaderboards', connectedWallet: '0x1234567890abcdef', portalCopy: launchCopy });
  scores.routes.renderApp();
  assert.equal(scores.dom.officialProfileCopy.textContent, launchCopy.scoresView);
  const wallet = harness({ step: 'profile', connectedWallet: '0x1234567890abcdef', portalCopy: launchCopy });
  wallet.routes.renderApp();
  assert.equal(wallet.dom.officialProfileCopy.textContent, launchCopy.profileWalletView);
  const guest = harness({ step: 'profile', portalCopy: launchCopy });
  guest.routes.renderApp();
  assert.equal(guest.dom.officialProfileCopy.textContent, launchCopy.profileGuestView);
  for (const h of [scores, wallet, guest]) assert.doesNotMatch(h.dom.officialProfileCopy.textContent, /device-local|preview|No score transaction/i);
});

// Live UI audit 2026-09-24: /profile/<wallet> for someone else's wallet was
// headed "Guest Practice Profile" with the guest sign-in lead.
test('another wallet’s public profile is headed as that player, not a guest session', () => {
  const other = '0x8841ae6244dba71f620de450e71b0ef7e0cce824';
  for (const connectedWallet of [null, '0x1234567890abcdef1234567890abcdef12345678']) {
    const h = harness({ step: 'profile', connectedWallet, viewedWallet: other.toUpperCase().replace('0X', '0x'), portalCopy: launchCopy });
    h.routes.renderApp();
    assert.equal(h.dom.officialProfileTitle.textContent, 'Player Profile');
    assert.equal(h.dom.officialProfileEyebrow.textContent, 'Public profile · 0x8841…e824');
    assert.equal(h.dom.officialProfileCopy.textContent, launchCopy.profilePublicView);
    assert.doesNotMatch(h.dom.officialProfileTitle.textContent + h.dom.officialProfileEyebrow.textContent + h.dom.officialProfileCopy.textContent, /guest|practice|sign in/i);
    assert.ok(h.calls.includes('profile'));
  }
  // The viewer's own wallet (any case), or no wallet, keeps the usual header.
  const own = harness({ step: 'profile', connectedWallet: other, viewedWallet: other.toUpperCase().replace('0X', '0x'), portalCopy: launchCopy });
  own.routes.renderApp();
  assert.equal(own.dom.officialProfileTitle.textContent, 'Wallet Profile');
  assert.equal(own.dom.officialProfileCopy.textContent, launchCopy.profileWalletView);
  const guest = harness({ step: 'profile', viewedWallet: 'not-a-wallet', portalCopy: launchCopy });
  guest.routes.renderApp();
  assert.equal(guest.dom.officialProfileTitle.textContent, 'Guest Practice Profile');
  // Other pages never take the profile header.
  const scores = harness({ step: 'leaderboards', viewedWallet: other, portalCopy: launchCopy });
  scores.routes.renderApp();
  assert.equal(scores.dom.officialProfileTitle.textContent, 'Leaderboards');
  assert.equal(scores.dom.officialProfileEyebrow.textContent, 'Guest practice session');
  // The copy follows the flags (contract A33).
  assert.match(launchCopy.profilePublicView, /public profile: its best scores, verified Ranked runs published on LitVM/);
  assert.match(portalCopyFor({ settlementLive: false, hostedProfileSync: true }).profilePublicView, /Verified Ranked publishing is not available yet/);
  assert.match(portalCopyFor({ settlementLive: false, hostedProfileSync: false }).profilePublicView, /this device/);
});

test('main passes the viewed profile wallet to the app routes', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /createOfficialAppRoutes\(\{[\s\S]*?getViewedProfileWallet: \(\) => profileRouteState\.viewedWallet \?\? null,/);
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
