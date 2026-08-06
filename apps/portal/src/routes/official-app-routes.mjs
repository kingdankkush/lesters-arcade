export function createOfficialAppRoutes({
  dom,
  documentRef = globalThis.document,
  getStep,
  setStep,
  getConnectedWallet,
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

  function renderArcadeFloor() {
    const step = getStep();
    const connectedWallet = getConnectedWallet();
    applyHardMoneyHeroScreenBackground(dom.officialArcadeFloor, step === 'settings' ? 'options' : 'mainMenu');
    dom.officialCabinetGrid.classList.toggle('profile-command-grid', step === 'profile');
    dom.officialCabinetGrid.classList.toggle('leaderboard-command-grid', step === 'leaderboards');
    const walletShort = connectedWallet ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)}` : 'Guest practice';
    const simulatedWallet = isSimulatedWalletActive();
    const cabinetNames = playableCabinetNames();
    const titleByStep = {
      'arcade-walk-in': 'Entering the Arcade...',
      'cabinet-select': 'Choose Your Cabinet',
      profile: connectedWallet ? 'Wallet Profile' : 'Guest Practice Profile',
      leaderboards: 'Leaderboards',
      settings: 'Settings',
    };
    const copyByStep = {
      'arcade-walk-in': simulatedWallet
        ? `${walletShort} is a simulated local identity, not a real wallet. Neon doors opening; cabinet row loading...`
        : `${walletShort} is active. Neon doors opening; cabinet row loading...`,
      'cabinet-select': connectedWallet
        ? `Select a cabinet. ${humanList(cabinetNames)} ${cabinetNames.length === 1 ? 'is' : 'are'} playable now; future cabinets remain locked.`
        : `Select a cabinet and play Free as a guest. ${humanList(cabinetNames)} ${cabinetNames.length === 1 ? 'is' : 'are'} playable now. Connect a wallet anytime to save progress and unlock Ranked.`,
      profile: connectedWallet
        ? shellModel.profileRules.walletLockCopy
        : 'Guest Practice Profile saves local settings, scores, and run history on this device. Connect a wallet when you want cross-session identity and Ranked testnet publishing.',
      leaderboards: 'Browse daily, weekly, monthly, yearly, and all-time boards. Official scores submit from ranked game-over only.',
      settings: 'Controls, audio, accessibility, wallet/network, and sign-out controls live here.',
    };
    dom.officialProfileEyebrow.textContent = simulatedWallet
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
