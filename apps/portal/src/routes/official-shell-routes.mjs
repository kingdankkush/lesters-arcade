export function createOfficialShellRoutes({
  dom,
  documentRef = globalThis.document,
  getStep,
  getConnectedWallet,
  getSelectedGameId,
  getSessionId,
  getState,
  setView,
  playSfxCue,
  signOutWallet,
  buildPlatformShellModel,
  gameSlugFor,
  el,
  appendText,
  renderArcadeIcon,
  buildPlayerArcadeSnapshot,
  renderAvatarChip,
  applyHardMoneyHeroScreenBackground,
  shellModel,
  networkModel,
  productionCabinetSprite,
  renderRotatingCabinetSprite,
} = {}) {
  function renderNav() {
    if (!dom.officialNavTabs) return;
    dom.officialNavTabs.replaceChildren();
    const connectedWallet = getConnectedWallet();
    const iconById = { cabinets: 'arcade', profile: 'profile', leaderboards: 'trophy', settings: 'settings' };
    const shell = buildPlatformShellModel(getStep(), {
      connected: Boolean(connectedWallet),
      gameSlug: gameSlugFor(getSelectedGameId()),
      sessionId: getSessionId() ?? null,
    });
    if (dom.officialApp) {
      dom.officialApp.dataset.shellStep = shell.step;
      dom.officialApp.dataset.shellBreadcrumb = shell.breadcrumbs.map((crumb) => crumb.label).join(' / ');
      if (shell.backTarget) {
        dom.officialApp.dataset.shellBackStep = shell.backTarget.step;
        dom.officialApp.dataset.shellBackLabel = shell.backTarget.label;
      } else {
        delete dom.officialApp.dataset.shellBackStep;
        delete dom.officialApp.dataset.shellBackLabel;
      }
    }
    for (const item of shell.nav) {
      const button = el('button', { className: `official-nav-tab ${item.active ? 'active' : ''}` });
      button.type = 'button';
      button.dataset.route = item.href;
      button.setAttribute('aria-current', item.active ? 'page' : 'false');
      button.disabled = false;
      if (!connectedWallet && item.id !== 'cabinets') {
        button.classList.add('nav-tab-guest');
        button.title = 'Browse as guest — connect a wallet to save progress here';
      }
      button.append(renderArcadeIcon(iconById[item.id] ?? 'star', item.label), documentRef.createTextNode(item.label));
      button.addEventListener('click', () => {
        playSfxCue('menu-click');
        setView(item.step);
      });
      dom.officialNavTabs.append(button);
    }
    if (connectedWallet) {
      const snapshot = buildPlayerArcadeSnapshot(getState(), connectedWallet);
      const displayName = snapshot?.profile?.displayName ?? connectedWallet;
      const account = el('div', { className: 'official-nav-account' });
      const avatar = renderAvatarChip(connectedWallet, displayName, 'nav-avatar');
      avatar.title = displayName;
      const avatarBtn = el('button', { className: 'nav-avatar-button', type: 'button', ariaLabel: 'Open profile' });
      avatarBtn.append(avatar);
      avatarBtn.addEventListener('click', () => {
        playSfxCue('menu-click');
        setView('profile');
      });
      const signOut = el('button', { className: 'nav-signout-button', type: 'button', textContent: 'Sign Out' });
      signOut.addEventListener('click', signOutWallet);
      account.append(avatarBtn, signOut);
      dom.officialNavTabs.append(account);
    }
  }

  function renderWalletSplash() {
    if (!dom.officialWalletSplash) return;
    const connectedWallet = getConnectedWallet();
    applyHardMoneyHeroScreenBackground(dom.officialWalletSplash, 'splash');
    const featuredCabinet = shellModel.cabinets.find((cabinet) => cabinet.id === 'hard-money-heroes');
    const featuredSprite = featuredCabinet?.desktopCabinetSprite ?? productionCabinetSprite();
    if (dom.splashFeaturedCabinet && featuredSprite) {
      dom.splashFeaturedCabinet.replaceChildren(renderRotatingCabinetSprite(featuredSprite, 'splash'));
    }
    dom.officialWalletCopy.textContent = connectedWallet
      ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)} is active. Enter the arcade to select Hard Money Heroes.`
      : shellModel.profileRules.walletLockCopy;
    dom.officialConnectButton.textContent = connectedWallet ? 'Enter Arcade' : 'Connect Wallet';
  }

  function renderSettings() {
    dom.officialCabinetGrid.replaceChildren();
    const settings = [
      ['Controls', shellModel.levelIntro.controlsSummary],
      ['Audio', 'Music and SFX start after user interaction; prototype music is loaded from the local Lester/Lilly rap track.'],
      ['Network', `${networkModel.name} // Chain ${networkModel.chainId} // gas ${networkModel.nativeCurrency.symbol}`],
      ['Sign out', 'Coming next: clear active wallet and sign in with another wallet profile.'],
    ];
    for (const [title, copy] of settings) {
      const card = el('article', { className: 'official-info-card' });
      appendText(card, 'span', 'SETTING', 'cabinet-status-label');
      appendText(card, 'strong', title);
      appendText(card, 'small', copy);
      dom.officialCabinetGrid.append(card);
    }
  }

  return Object.freeze({ renderNav, renderSettings, renderWalletSplash });
}
