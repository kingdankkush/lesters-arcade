import { PORTAL_COPY } from '../portal-content.mjs';

export function createOfficialAppRoutes({
  dom,
  documentRef = globalThis.document,
  getStep,
  setStep,
  getConnectedWallet,
  // The wallet a /profile/<wallet> link is showing (null: the viewer's own).
  getViewedProfileWallet = () => null,
  portalCopy = PORTAL_COPY,
  isGuestAllowedStep,
  isSimulatedWalletActive,
  playableCabinetNames,
  humanList,
  shellModel,
  applyHardMoneyHeroScreenBackground,
  renderNav,
  renderWalletSplash,
  renderProfile,
  renderLeaderboards,
  renderSettings,
  renderCabinets,
  renderModeSelect,
  renderCharacterSelect,
  renderGameplay,
} = {}) {
  function showPanel(activePanel) {
    for (const panel of [
      dom.officialWalletSplash,
      dom.officialArcadeFloor,
      dom.officialModeSelect,
      dom.officialCharacterSelect,
      dom.officialLevelIntro,
      dom.officialGameplay,
    ]) {
      if (panel) panel.hidden = panel !== activePanel;
    }
  }

  // Another wallet's public profile is on screen: its header describes that
  // wallet, not the viewer's guest session (live UI audit 2026-09-24).
  function publicProfileWallet(connectedWallet) {
    const viewed = String(getViewedProfileWallet() ?? '');
    if (!/^0x[0-9a-fA-F]{40}$/.test(viewed)) return null;
    return viewed.toLowerCase() === String(connectedWallet ?? '').toLowerCase() ? null : viewed.toLowerCase();
  }

  function renderArcadeFloor() {
    const step = getStep();
    const connectedWallet = getConnectedWallet();
    const viewedWallet = step === 'profile' ? publicProfileWallet(connectedWallet) : null;
    if (!['cabinet-select', 'arcade-walk-in'].includes(step)) applyHardMoneyHeroScreenBackground(dom.officialArcadeFloor, step === 'settings' ? 'options' : 'mainMenu');
    dom.officialCabinetGrid.classList.toggle('profile-command-grid', step === 'profile');
    dom.officialCabinetGrid.classList.toggle('leaderboard-command-grid', step === 'leaderboards');
    const walletShort = connectedWallet ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)}` : 'Guest practice';
    const simulatedWallet = isSimulatedWalletActive();
    const cabinetNames = playableCabinetNames();
    const titleByStep = {
      'arcade-walk-in': 'Entering the Arcade...',
      'cabinet-select': 'Pick your cabinet.',
      profile: viewedWallet ? 'Player Profile' : connectedWallet ? 'Wallet Profile' : 'Guest Practice Profile',
      leaderboards: 'Leaderboards',
      settings: 'Settings',
    };
    const copyByStep = {
      'arcade-walk-in': simulatedWallet
        ? `${walletShort} is a simulated local identity, not a real wallet. Neon doors opening; cabinet row loading...`
        : `${walletShort} is active. Neon doors opening; cabinet row loading...`,
      'cabinet-select': connectedWallet
        ? 'A survival shooter, a run through Ground & Sky, and a puzzle with its own rhythm. Your next run starts here.'
        : 'A survival shooter, a run through Ground & Sky, and a puzzle with its own rhythm. Choose a game and play Free.',
      profile: viewedWallet ? portalCopy.profilePublicView : connectedWallet
        ? portalCopy.profileWalletView
        : portalCopy.profileGuestView,
      leaderboards: portalCopy.scoresView,
      settings: 'Controls, audio, accessibility, wallet/network, and sign-out controls live here.',
    };
    dom.officialProfileEyebrow.textContent = viewedWallet
      ? `Public profile · ${viewedWallet.slice(0, 6)}…${viewedWallet.slice(-4)}`
      : simulatedWallet
        ? 'Simulated wallet session'
        : connectedWallet ? 'Wallet profile connected' : 'Guest practice session';
    dom.officialProfileTitle.textContent = titleByStep[step] ?? titleByStep['cabinet-select'];
    dom.officialProfileCopy.textContent = copyByStep[step] ?? copyByStep['cabinet-select'];
    if (step === 'profile') renderProfile();
    else if (step === 'leaderboards') renderLeaderboards();
    else if (step === 'settings') renderSettings();
    else renderCabinets();
  }

  function renderApp() {
    if (!dom.officialApp) return;
    let step = getStep();
    dom.officialApp.dataset.step = step;
    if (dom.arcadeMusicPlayer) dom.arcadeMusicPlayer.hidden = step === 'gameplay';
    documentRef.documentElement.dataset.ingame = step === 'gameplay' ? 'true' : 'false';
    renderNav();
    renderWalletSplash();
    if (!getConnectedWallet() && !isGuestAllowedStep(step)) {
      step = 'wallet-splash';
      setStep(step);
    }
    if (['arcade-walk-in', 'cabinet-select', 'profile', 'leaderboards', 'settings'].includes(step)) {
      showPanel(dom.officialArcadeFloor);
      renderArcadeFloor();
    } else if (step === 'mode-select') {
      showPanel(dom.officialModeSelect);
      renderModeSelect();
    } else if (step === 'character-select') {
      showPanel(dom.officialCharacterSelect);
      renderCharacterSelect();
    } else if (step === 'level-one-intro') {
      showPanel(dom.officialLevelIntro);
    } else if (step === 'gameplay') {
      showPanel(dom.officialGameplay);
      renderGameplay();
    } else {
      showPanel(dom.officialWalletSplash);
    }
  }

  return Object.freeze({ renderApp, renderArcadeFloor, showPanel });
}
