export function createOfficialPlayRoutes({
  appendText,
  applyGameModeSelectBackground,
  applyHardMoneyHeroScreenBackground,
  buildCharacterSelectEntries,
  buildGameModeSelectModel,
  cabinetPlayableInCurrentMode,
  DEV_CABINETS_ENABLED,
  dom,
  el,
  getContext,
  HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
  HERO_ROSTER_BASE,
  heroRotationSprite,
  LESTERS_ARCADE_V2_APP_SHELL,
  loadChikunGame,
  persistArcadeStateSoon,
  playSfxCue,
  productionCabinetSprite,
  renderArcadeIcon,
  renderHeroStatBars,
  renderRotatingCabinetSprite,
  resolveSelectedCharacterId,
  selectCabinet,
  selectedGame,
  SETTLEMENT_LIVE,
  setPreferredCharacter,
  setView,
  weaponById,
} = {}) {
  function renderOfficialCharacterSelect() {
    const { connectedWallet, state, combat } = getContext();
    applyHardMoneyHeroScreenBackground(dom.officialCharacterSelect, 'modeSelect');
    if (!dom.officialCharacterRoster) return;
    dom.officialCharacterRoster.replaceChildren();
    const profile = connectedWallet ? state.profiles[connectedWallet] ?? null : null;
    if (profile) {
      combat.characterId = resolveSelectedCharacterId(profile, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG);
    }
    const heroEntries = buildCharacterSelectEntries(HERO_ROSTER_BASE, profile ?? {}, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG);
    for (const hero of heroEntries) {
      const card = el('button', { className: `hero-card ${hero.locked ? 'locked' : 'active'}${hero.selected ? ' selected' : ''}` });
      card.type = 'button';
      card.disabled = hero.locked;
      const stage = el('div', { className: 'hero-card-stage' });
      const sprite = heroRotationSprite(hero.legacyId ?? hero.id);
      if (sprite) {
        stage.append(renderRotatingCabinetSprite(sprite, 'card'));
      }
      if (hero.locked) {
        appendText(stage, 'span', 'LOCKED', 'hero-locked-badge');
      }
      card.append(stage);
      const info = el('div', { className: 'hero-card-info' });
      appendText(info, 'strong', hero.name, 'hero-name');
      appendText(info, 'span', hero.tagline, 'hero-tagline');
      appendText(info, 'p', hero.bio, 'hero-bio');
      const loadout = el('div', { className: 'hero-loadout', ariaLabel: `${hero.name} starting loadout` });
      const starterWeapon = weaponById(hero.startingWeaponId);
      appendText(loadout, 'span', `STARTER · ${starterWeapon.title.toUpperCase()}`, 'hero-loadout-weapon');
      appendText(loadout, 'span', `${hero.passive.title}: ${hero.passive.description}`, 'hero-loadout-passive');
      info.append(loadout);
      const statBox = el('div', { className: 'hero-stats' });
      renderHeroStatBars(statBox, hero.stats);
      info.append(statBox);
      if (hero.locked && hero.unlockProgress) {
        const progress = hero.unlockProgress;
        const progressWrap = el('div', { className: 'hero-unlock-progress' });
        const label = el('span', { className: 'hero-unlock-progress-label', textContent: progress.meterText });
        const bar = el('div', { className: 'hero-unlock-progress-track' });
        const fill = el('div', { className: 'hero-unlock-progress-fill' });
        fill.style.width = `${Math.max(0, Math.min(100, progress.percent))}%`;
        bar.append(fill);
        const note = el('span', { className: 'hero-unlock-progress-note', textContent: progress.note });
        progressWrap.append(label, bar, note);
        info.append(progressWrap);
      }
      appendText(info, 'span', hero.cta, 'hero-cta');
      card.append(info);
      if (!hero.locked) {
        card.addEventListener('click', () => {
          playSfxCue('hero-select', 0.07);
          if (profile) setPreferredCharacter(profile, hero.legacyId ?? hero.id, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG);
          combat.characterId = hero.legacyId ?? hero.id;
          persistArcadeStateSoon();
          setView('level-one-intro');
        });
      }
      dom.officialCharacterRoster.append(card);
    }
  }

  function renderOfficialCabinets() {
    dom.officialCabinetGrid.replaceChildren();
    for (const cabinet of LESTERS_ARCADE_V2_APP_SHELL.cabinets) {
      const cabinetSprite = cabinet.id === 'hard-money-heroes'
        ? (cabinet.desktopCabinetSprite ?? productionCabinetSprite())
        : cabinet.desktopCabinetSprite;
      const isCabinetPlayable = cabinetPlayableInCurrentMode(cabinet);
      const isDevOnlyCabinet = !cabinet.playable && isCabinetPlayable;
      const card = el('button', { className: `official-cabinet-card ${isCabinetPlayable ? 'playable' : 'locked'} ${isDevOnlyCabinet ? 'dev-cabinet' : ''} ${cabinetSprite ? 'featured-cabinet-card' : ''}` });
      card.type = 'button';
      card.disabled = !isCabinetPlayable;
      card.addEventListener('click', async () => {
        if (!cabinetPlayableInCurrentMode(cabinet)) return;
        // Lazy-load the game's art and data manifests the first time the player
        // selects this cabinet. The heavy HMH bundles live in games/<id>/loader.mjs,
        // fetched over HTTP only on demand, so the portal shell stays small.
        if (cabinet.gameId === 'chikun') {
          card.classList.add('is-loading');
          card.setAttribute('aria-busy', 'true');
          try {
            await loadChikunGame();
          } catch (err) {
            console.error('[Chikun] Failed to load game payload:', err);
          } finally {
            card.classList.remove('is-loading');
            card.removeAttribute('aria-busy');
          }
        }
        selectCabinet(cabinet.gameId);
        setView('mode-select');
      });
      if (cabinetSprite) {
        const media = el('div', { className: 'cabinet-card-media' });
        media.append(renderRotatingCabinetSprite(cabinetSprite, 'card'));
        card.append(media);
      } else if (cabinet.bannerArt) {
        // Coming-soon cabinets render their key art as a cropped, darkened banner
        // behind the title/description (fit width, crop to fill, dark overlay).
        const banner = el('div', { className: 'cabinet-card-banner' });
        banner.style.backgroundImage = `url("${cabinet.bannerArt}")`;
        card.append(banner);
        card.classList.add('banner-cabinet-card');
      }
      const copy = el('div', { className: 'cabinet-card-copy' });
      appendText(copy, 'span', isCabinetPlayable ? (isDevOnlyCabinet ? 'DEV HARNESS' : 'PLAYABLE NOW') : 'COMING SOON', 'cabinet-status-label');
      copy.append(renderArcadeIcon(isCabinetPlayable ? 'star' : 'lock', isCabinetPlayable ? 'Playable' : 'Locked'));
      appendText(copy, 'strong', cabinet.title);
      appendText(copy, 'small', cabinet.description);
      card.append(copy);
      dom.officialCabinetGrid.append(card);
    }
  }

  function renderOfficialModeSelect() {
    const { connectedWallet } = getContext();
    const game = selectedGame();
    const modeSelect = buildGameModeSelectModel(game.id);
    if (!modeSelect) {
      dom.officialModeSelect.dataset.gameId = game.id;
      dom.officialModeSelect.dataset.artStatus = 'unconfigured';
      dom.officialModeSelect.style.backgroundImage = 'linear-gradient(180deg, rgba(3,6,23,0.94), rgba(3,6,23,0.78))';
      dom.officialModeSelect.style.backgroundSize = 'cover';
      dom.officialModeSelect.style.backgroundPosition = 'center';
      dom.officialModeSelect.style.backgroundRepeat = 'no-repeat';
      dom.officialModeSelect.style.backgroundColor = '#030617';
      dom.officialModeEyebrow.textContent = 'Selected Cabinet // Mode Configuration Required';
      dom.officialModeTitle.textContent = game.title;
      dom.officialModeCopy.textContent = 'This cabinet does not have a registered mode-selection presentation yet. Return to the cabinet floor and choose an available game.';
      dom.officialModeArtNote.hidden = false;
      dom.officialModeArtNote.textContent = 'Mode selection is unavailable. No session, profile, leaderboard, wallet, or chain action has started.';
      dom.officialFreeModeButton.disabled = true;
      dom.officialRankedModeButton.disabled = true;
      dom.officialFreeModeButton.dataset.artStatus = 'unconfigured';
      dom.officialRankedModeButton.dataset.artStatus = 'unconfigured';
      dom.officialRankedModeButton.dataset.needsWallet = 'false';
      dom.officialFreeModeBanner.hidden = true;
      dom.officialRankedModeBanner.hidden = true;
      dom.officialFreeModeTitle.textContent = 'Unavailable';
      dom.officialRankedModeTitle.textContent = 'Unavailable';
      dom.officialFreeModeCopy.textContent = 'No Free Mode presentation is registered for this cabinet.';
      dom.officialRankedModeCopy.textContent = 'No Ranked presentation is registered for this cabinet.';
      dom.officialRankedTooltip.replaceChildren();
      appendText(dom.officialRankedTooltip, 'strong', 'Mode selection blocked safely');
      appendText(dom.officialRankedTooltip, 'span', 'Return to Cabinets. This unconfigured game cannot start a session.');
      return;
    }

    dom.officialFreeModeButton.disabled = false;
    dom.officialRankedModeButton.disabled = false;
    dom.officialFreeModeBanner.hidden = false;
    dom.officialRankedModeBanner.hidden = false;
    const ranked = modeSelect.ranked;
    applyGameModeSelectBackground(dom.officialModeSelect, modeSelect);
    dom.officialModeSelect.dataset.gameId = modeSelect.gameId;
    dom.officialModeSelect.dataset.artStatus = modeSelect.artStatus;
    dom.officialModeEyebrow.textContent = modeSelect.eyebrow;
    dom.officialModeTitle.textContent = modeSelect.title;
    dom.officialModeCopy.textContent = modeSelect.copy;
    dom.officialModeArtNote.hidden = modeSelect.artStatus === 'production';
    dom.officialModeArtNote.textContent = modeSelect.artStatus === 'production'
      ? ''
      : 'Temporary derived art is active in the development harness. Final production art is still required before public launch.';

    const syncModeCard = (button, banner, title, copy, model) => {
      button.dataset.artStatus = modeSelect.artStatus;
      if (banner.getAttribute('src') !== model.bannerAsset) banner.src = model.bannerAsset;
      banner.style.objectPosition = model.bannerPosition ?? 'center';
      banner.alt = model.bannerAlt;
      title.textContent = model.label;
      copy.textContent = model.copy;
    };
    syncModeCard(dom.officialFreeModeButton, dom.officialFreeModeBanner, dom.officialFreeModeTitle, dom.officialFreeModeCopy, modeSelect.free);
    syncModeCard(dom.officialRankedModeButton, dom.officialRankedModeBanner, dom.officialRankedModeTitle, dom.officialRankedModeCopy, ranked);

    // Guest-aware ranked card: surface that ranked needs a wallet, but keep it
    // clickable so the tap triggers the connect flow (guest-first).
    dom.officialRankedModeButton.dataset.needsWallet = connectedWallet ? 'false' : 'true';
    dom.officialRankedTooltip.replaceChildren();
    dom.officialRankedTooltip.dataset.state = connectedWallet ? '' : 'guest';
    if (!connectedWallet) {
      appendText(dom.officialRankedTooltip, 'strong', `${modeSelect.free.label} is open to guests`);
      appendText(dom.officialRankedTooltip, 'span', `${modeSelect.free.copy} Connect a wallet when you want ${ranked.label}.`);
    } else {
      appendText(dom.officialRankedTooltip, 'strong', `${ranked.label}: local verified-preview mode`);
      appendText(dom.officialRankedTooltip, 'span', ranked.copy);
    }
    if (SETTLEMENT_LIVE && ranked.requiresZkLtc) {
      const link = el('a', { className: 'wallet-link', textContent: 'Get zkLTC faucet', href: ranked.faucetUrl, target: '_blank', rel: 'noreferrer' });
      dom.officialRankedTooltip.append(link);
    }
  }

  function renderOfficialGameplay() {
    const { officialSelectedMode, hmhRebootActive } = getContext();
    const modeLabel = officialSelectedMode === 'ranked' ? 'Ranked Testnet' : 'Free Mode';
    const game = selectedGame();
    if (dom.officialGameplay) dom.officialGameplay.dataset.gameId = game.id;
    if (game.id === 'chikun') {
      dom.officialGameModeTitle.textContent = `${game.title} // ${modeLabel}`;
      if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = officialSelectedMode === 'ranked'
        ? 'Starting an isolated, parent-issued Ranked flight. Final input evidence must pass deterministic replay before score-board or profile writes.'
        : 'Starting isolated Free practice. No profile, leaderboard, settlement, or chain write can occur.';
      if (dom.combatStatus) {
        dom.combatStatus.textContent = "Chikun's Escape is loading in its sandboxed canvas runtime. Tap, click, or press Space to flap.";
      }
      return;
    }
    if (game.id === 'lester-blaster') {
      dom.officialGameModeTitle.textContent = `Hard Money Heroes: Top-Down Reboot // ${modeLabel}`;
      if (dom.officialGameStateCopy && !hmhRebootActive) dom.officialGameStateCopy.textContent = 'Starting isolated PixiJS child runtime…';
    }
  }

  return Object.freeze({
    renderCabinets: renderOfficialCabinets,
    renderCharacterSelect: renderOfficialCharacterSelect,
    renderGameplay: renderOfficialGameplay,
    renderModeSelect: renderOfficialModeSelect,
  });
}
