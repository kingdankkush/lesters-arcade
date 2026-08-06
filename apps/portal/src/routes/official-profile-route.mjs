import { buildHmhRunHistoryModel } from '../hmh-run-history.mjs';

const formatPermille = (value) => `${(Math.max(0, Number(value) || 0) / 10).toFixed(1)}%`;
const titleCase = (value) => String(value ?? '').split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');

export function createOfficialProfileRoute({
  ACHIEVEMENTS,
  ARCADE_GAMES,
  appendText,
  buildHardMoneyHeroesStatsModule,
  buildPlayerArcadeSnapshot,
  buildProfileExperienceV2Model,
  buildWalletConnectionModel,
  connectWallet,
  detectEthereumProvider,
  documentRef = globalThis.document,
  dom,
  el,
  FileReaderClass = globalThis.FileReader,
  formatSeconds,
  formatSurvive,
  getContext,
  getGame,
  isSimulatedWalletActive,
  persistArcadeStateSoon,
  playSfxCue,
  renderAchievementIcon,
  renderAvatarChip,
  renderNav,
  renderSimulatedWalletNotice,
  requestAnimationFrameRef = globalThis.requestAnimationFrame,
  routeState,
  sanitizeAvatarImage,
  setArcadeUsername,
  setPlayerAvatar,
  setView,
  validateAvatarFile,
  validateUsername,
} = {}) {
  function renderOfficialProfile() {
    const { connectedChainId, connectedWallet, combat, state, walletConnector } = getContext();
    dom.officialCabinetGrid.replaceChildren();
    dom.officialCabinetGrid.classList.add('profile-command-grid');
    const snapshot = connectedWallet ? buildPlayerArcadeSnapshot(state, connectedWallet) : null;
    const profileV2 = connectedWallet ? buildProfileExperienceV2Model(state, connectedWallet, { selectedGameId: routeState.gameId }) : null;
    routeState.historyFilters ??= { heroId: 'all', weaponId: 'all', mode: 'all', date: 'all', result: 'all' };
    const hmhRunHistory = connectedWallet ? buildHmhRunHistoryModel(state.runHistory, {
      wallet: connectedWallet,
      filters: routeState.historyFilters,
      settlements: snapshot?.settlements,
    }) : null;
    const profile = snapshot?.profile;

    const profileHero = el('article', { className: 'official-info-card profile-hero-card hmh-visual-polish-v12' });
    appendText(profileHero, 'span', 'Wallet Profile // Parent Account', 'cabinet-status-label');
    const heroTop = el('div', { className: 'profile-hero-topline' });
    heroTop.append(renderAvatarChip(connectedWallet, profile?.displayName, 'profile-hero-avatar'));
    const heroIdentity = el('div', { className: 'profile-hero-identity' });
    appendText(heroIdentity, 'strong', profile?.displayName ?? 'Connect wallet to activate profile', 'profile-hero-name');
    // The "locked identity for settlement" claim is only true of a real wallet.
    // Saying it over the fallback identity is the exact misreading U11a exists to
    // stop, so the simulated case gets its own line.
    const walletIsSimulated = isSimulatedWalletActive();
    appendText(heroIdentity, 'small', connectedWallet
      ? walletIsSimulated
        ? `${connectedWallet.slice(0, 10)}…${connectedWallet.slice(-8)} // simulated wallet // local test identity only — progress here does not settle on-chain or carry over to a real wallet`
        : `${connectedWallet.slice(0, 10)}…${connectedWallet.slice(-8)} // ${walletConnector} // wallet is your locked identity for scores, achievements & settlement`
      : 'Wallet is the locked identity for progress, high scores, achievements, avatars, and LitVM settlement receipts.');
    heroTop.append(heroIdentity);
    profileHero.append(heroTop);

    if (connectedWallet && snapshot) {
      const bestScore = profileV2?.trophyRoom.summary.bestScore ?? Math.max(...Object.values(snapshot.progress ?? {}).map((entry) => Math.max(entry.bestPaidScore ?? 0, entry.bestFreeScore ?? 0)), 0);
      const heroStats = el('div', { className: 'profile-hero-stats' });
      for (const [label, value] of [
        ['Rank', profile.rank],
        ['XP', profile.xp.toLocaleString()],
        ['Best Score', bestScore.toLocaleString()],
        ['Ranked Runs', String(profileV2?.trophyRoom.summary.totalRankedRuns ?? profile.totalPaidRuns)],
        ['Achievements', `${profileV2?.achievements.summary.unlocked ?? snapshot.achievementSummary.unlocked}/${profileV2?.achievements.summary.total ?? snapshot.achievementSummary.total}`],
        ['Settlements', String(profileV2?.trophyRoom.summary.settledRuns ?? snapshot.settlements.length)],
        ['Privacy', profileV2?.privacy.options.find((option) => option.id === profileV2.privacy.current)?.label ?? 'Public'],
      ]) {
        const stat = el('div', { className: 'profile-hero-stat' });
        appendText(stat, 'span', label);
        appendText(stat, 'strong', value);
        heroStats.append(stat);
      }
      profileHero.append(heroStats);

      const quickActions = el('div', { className: 'profile-quick-actions' });
      const playRanked = el('button', { className: 'pixel-button profile-action-primary', type: 'button', textContent: 'Play Ranked' });
      playRanked.addEventListener('click', () => { playSfxCue('menu-click'); setView('mode-select'); });
      const viewBoard = el('button', { className: 'pixel-button', type: 'button', textContent: 'View Leaderboard' });
      viewBoard.addEventListener('click', () => { playSfxCue('menu-click'); setView('leaderboards'); });
      quickActions.append(playRanked, viewBoard);
      profileHero.append(quickActions);
    }
    dom.officialCabinetGrid.append(profileHero);

    if (connectedWallet && profileV2) {
      const trophyCard = el('article', { className: 'official-info-card profile-trophy-room-card' });
      appendText(trophyCard, 'span', 'TROPHY ROOM', 'cabinet-status-label');
      appendText(trophyCard, 'strong', `${profileV2.trophyRoom.summary.achievementsUnlocked}/${profileV2.trophyRoom.summary.achievementsTotal} badges · ${profileV2.trophyRoom.summary.totalRankedRuns} ranked runs`);
      const trophyGrid = el('div', { className: 'profile-hero-stats profile-trophy-grid' });
      for (const card of profileV2.trophyRoom.cards) {
        const cell = el('div', { className: `profile-hero-stat trophy-card-${card.id} trophy-tone-${card.tone ?? card.tier ?? 'muted'}` });
        appendText(cell, 'span', card.label);
        appendText(cell, 'strong', `${card.icon ? `${card.icon} ` : ''}${card.value}`);
        if (card.rarityPct) appendText(cell, 'small', `approx ${card.rarityPct}% unlock rate`);
        trophyGrid.append(cell);
      }
      trophyCard.append(trophyGrid);
      dom.officialCabinetGrid.append(trophyCard);
    }

    // Guest profile: show local play stats so guests feel they have a profile too.
    if (!connectedWallet) {
      const guestCard = el('article', { className: 'official-info-card profile-guest-card' });
      appendText(guestCard, 'span', 'Guest Session // Local Stats', 'cabinet-status-label');
      appendText(guestCard, 'strong', 'Playing as Guest');
      appendText(guestCard, 'small', 'Your free-mode runs are tracked locally on this device. Connect a wallet to save progress permanently, unlock Ranked mode, and appear on global leaderboards.');
      // Pull local stats from the game state if available.
      const localBest = combat?.longestSurvivalThisRun ?? 0;
      const localKills = combat?.kills ?? 0;
      const localScore = combat?.score ?? 0;
      const guestStats = el('div', { className: 'profile-hero-stats' });
      for (const [label, value] of [
        ['Best Score', localScore.toLocaleString()],
        ['Total Kills', localKills.toLocaleString()],
        ['Longest Survival', `${Math.floor(localBest / 60)}:${String(localBest % 60).padStart(2, '0')}`],
        ['Mode', 'Free Practice'],
      ]) {
        const stat = el('div', { className: 'profile-hero-stat' });
        appendText(stat, 'span', label);
        appendText(stat, 'strong', value);
        guestStats.append(stat);
      }
      guestCard.append(guestStats);
      const connectCta = el('button', { className: 'pixel-button profile-action-primary', type: 'button', textContent: 'Connect Wallet to Save Progress' });
      connectCta.addEventListener('click', () => { playSfxCue('menu-click'); connectWallet(); });
      guestCard.append(connectCta);
      dom.officialCabinetGrid.append(guestCard);
      return;
    }

    const walletModel = buildWalletConnectionModel({
      providerAvailable: Boolean(detectEthereumProvider()?.request),
      wallet: connectedWallet,
      chainId: connectedChainId,
      connector: walletConnector,
    });
    const walletCard = el('article', { className: `official-info-card profile-wallet-rail-card ${walletModel.status} ${walletModel.chainGuard.status}` });
    appendText(walletCard, 'span', 'Wallet + Chain Guard', 'cabinet-status-label');
    appendText(walletCard, 'strong', walletModel.simulated
      ? 'Simulated Wallet'
      : walletModel.chainGuard.status === 'right-chain' ? 'LiteForge Ready' : 'Action Needed');
    // The chain-guard copy opens with "Wallet connected", which contradicts the
    // headline above it when the wallet is the local fallback.
    appendText(walletCard, 'small', walletModel.simulated
      ? 'No browser wallet is connected, so there is no chain to guard. Chain checks resume once you connect a real wallet.'
      : walletModel.chainGuard.copy);
    const walletFacts = el('div', { className: 'profile-wallet-facts' });
    for (const [label, value] of [
      ['Network', `${walletModel.network.name} · ${walletModel.network.chainIdHex}`],
      ['Gas', walletModel.network.nativeCurrency.symbol],
      ['Connector', walletModel.simulated ? 'simulated (no real wallet)' : walletConnector],
      ['Writes', walletModel.permissions.writeScopes.join(' · ')],
    ]) {
      const fact = el('span', { className: 'profile-wallet-fact' });
      fact.append(el('em', { textContent: label }), documentRef.createTextNode(value));
      walletFacts.append(fact);
    }
    walletCard.append(walletFacts);
    if (walletModel.disclosure) {
      walletCard.append(renderSimulatedWalletNotice(walletModel.disclosure, 'profile-simulated-wallet-notice'));
    }
    dom.officialCabinetGrid.append(walletCard);

    if (profileV2) {
      const privacyCard = el('article', { className: 'official-info-card profile-privacy-card' });
      appendText(privacyCard, 'span', 'PRIVACY', 'cabinet-status-label');
      appendText(privacyCard, 'strong', 'Profile visibility');
      appendText(privacyCard, 'small', 'Wallet remains the locked identity for scores and receipts. Visibility controls how much of the profile should appear in future public discovery.');
      const privacyOptions = el('div', { className: 'leaderboard-game-tabs profile-privacy-tabs' });
      for (const option of profileV2.privacy.options) {
        const button = el('button', { className: `pixel-button leaderboard-game-tab${option.id === profileV2.privacy.current ? ' is-active' : ''}`, type: 'button' });
        appendText(button, 'span', option.label, 'leaderboard-game-tab-title');
        appendText(button, 'small', option.copy, 'profile-privacy-copy');
        button.addEventListener('click', () => {
          state.profiles[connectedWallet].preferences ??= {};
          state.profiles[connectedWallet].preferences.profileVisibility = option.id;
          persistArcadeStateSoon();
          playSfxCue('menu-click', 0.05);
          renderOfficialProfile();
        });
        privacyOptions.append(button);
      }
      privacyCard.append(privacyOptions);
      dom.officialCabinetGrid.append(privacyCard);
    }

    // --- Username / display-name editor ---
    const editor = el('article', { className: 'official-info-card username-editor-card' });
    appendText(editor, 'span', 'DISPLAY NAME', 'cabinet-status-label');
    appendText(editor, 'small', profile?.usernameSet
      ? 'This name shows on every leaderboard. 3–18 chars, unique, no hate speech.'
      : 'By default leaderboards show your wallet address. Set a username to display instead. 3–18 chars, unique, no hate speech.');

    const form = el('div', { className: 'username-editor-form' });
    const input = el('input', { className: 'username-input', type: 'text' });
    input.maxLength = 18;
    input.placeholder = 'Your display name';
    input.value = profile?.usernameSet ? profile.handle : '';
    input.setAttribute('aria-label', 'Display name');
    const saveBtn = el('button', { className: 'pixel-button username-save-button', textContent: 'Save Username', type: 'button' });
    const feedback = el('p', { className: 'username-feedback tiny-note' });

    // Persistent post-save confirmation: if the profile was just re-rendered as a
    // result of a username save, show "✓ Username saved!" + flash the card so the
    // user gets clear visual proof the save worked (mirrors the avatar save UX).
    if (routeState.usernameJustSaved) {
      routeState.usernameJustSaved = false;
      feedback.textContent = '✓ Display name saved!';
      feedback.dataset.state = 'ok';
      requestAnimationFrameRef(() => {
        editor.classList.add('username-saved-flash');
      });
    }

    // live validation
    input.addEventListener('input', () => {
      const v = validateUsername(input.value);
      feedback.textContent = input.value.trim() ? v.message : '';
      feedback.dataset.state = input.value.trim() ? (v.valid ? 'ok' : 'error') : '';
    });

    saveBtn.addEventListener('click', () => {
      const res = setArcadeUsername(state, connectedWallet, input.value);
      if (res.ok) {
        routeState.usernameJustSaved = true; // surfaced as a persistent note on re-render
        persistArcadeStateSoon();
        playSfxCue('menu-click', 0.06);
        // Refresh the nav (display name) + profile panel in place. Do NOT call the
        // global render() here — it resets officialAppStep and bounces the user off
        // the profile screen (same reason as the avatar save below).
        renderNav();
        renderOfficialProfile();
      } else {
        feedback.textContent = res.message;
        feedback.dataset.state = 'error';
      }
    });

    form.append(input, saveBtn);
    editor.append(form, feedback);
    dom.officialCabinetGrid.append(editor);

    // --- Avatar upload (.jpg/.png, 2MB cap) ---
    const avatarCard = el('article', { className: 'official-info-card avatar-editor-card' });
    appendText(avatarCard, 'span', 'AVATAR', 'cabinet-status-label');
    appendText(avatarCard, 'small', 'Upload a .jpg or .png (max 2MB). Shows in the nav and on leaderboards next to your score.');
    const avatarRow = el('div', { className: 'avatar-editor-row' });
    const preview = el('div', { className: 'profile-avatar avatar-preview-shell' });
    const previewImg = el('img', { className: 'avatar-preview-image', alt: 'Selected avatar preview' });
    const previewFallback = renderAvatarChip(connectedWallet, profile?.displayName, 'profile-avatar');
    const previewHint = el('p', { className: 'avatar-preview-hint tiny-note' });
    // Hint text only appears after a file is chosen — the default preview should
    // show the avatar cleanly without any overlay text or blue-tinted bar.
    previewHint.hidden = true;
    preview.append(previewFallback, previewImg, previewHint);
    previewImg.hidden = true;
    const fileInput = el('input', { className: 'avatar-file-input', type: 'file' });
    fileInput.accept = 'image/png,image/jpeg';
    fileInput.setAttribute('aria-label', 'Choose avatar image');
    const chooseBtn = el('button', { className: 'pixel-button', type: 'button', textContent: 'Choose Image' });
    const avatarSaveBtn = el('button', { className: 'pixel-button', type: 'button', textContent: 'Save Avatar' });
    avatarSaveBtn.disabled = true; // el() ignores `disabled` (not in attr allow-list); set it directly.
    chooseBtn.addEventListener('click', () => fileInput.click());
    const avatarFeedback = el('p', { className: 'avatar-feedback tiny-note' });
    // Persistent post-save confirmation: if the profile was just re-rendered as a
    // result of an avatar save, show "Avatar saved!" + flash the card so the user
    // gets clear visual proof the upload worked.
    if (routeState.avatarJustSaved) {
      routeState.avatarJustSaved = false;
      avatarFeedback.textContent = '✓ Avatar saved!';
      avatarFeedback.dataset.state = 'ok';
      previewHint.textContent = 'Your avatar is now live in the nav and on leaderboards.';
      requestAnimationFrameRef(() => {
        avatarCard.classList.add('avatar-saved-flash');
      });
    }
    let pendingAvatarDataUrl = '';
    let pendingAvatarName = '';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      pendingAvatarDataUrl = '';
      pendingAvatarName = '';
      avatarSaveBtn.disabled = true;
      if (!file) return;
      const fileCheck = validateAvatarFile({ type: file.type, size: file.size });
      if (!fileCheck.ok) {
        avatarFeedback.textContent = fileCheck.message;
        avatarFeedback.dataset.state = 'error';
        return;
      }
      const reader = new FileReaderClass();
      reader.onload = () => {
        pendingAvatarDataUrl = String(reader.result ?? '');
        pendingAvatarName = file.name;
        previewFallback.hidden = true;
        previewImg.hidden = false;
        previewImg.src = pendingAvatarDataUrl;
        previewHint.hidden = false;
        previewHint.textContent = `Preview ready: ${file.name}`;
        avatarFeedback.textContent = 'Preview loaded. Click Save Avatar to upload it.';
        avatarFeedback.dataset.state = 'ok';
        avatarSaveBtn.disabled = false;
      };
      reader.onerror = () => {
        avatarFeedback.textContent = 'Could not read that file. Try another image.';
        avatarFeedback.dataset.state = 'error';
      };
      reader.readAsDataURL(file);
    });
    avatarSaveBtn.addEventListener('click', async () => {
      if (!pendingAvatarDataUrl) return;
      avatarSaveBtn.disabled = true;
      let storedDataUrl = pendingAvatarDataUrl;
      try {
        // Re-encode through a canvas to strip metadata + cap dimensions before
        // persisting. Falls back to the raw preview only if re-encode fails.
        storedDataUrl = await sanitizeAvatarImage(pendingAvatarDataUrl);
      } catch (err) {
        console.error('[avatar] sanitize failed, rejecting upload:', err);
        avatarFeedback.textContent = 'Could not process that image. Try a different .png or .jpg.';
        avatarFeedback.dataset.state = 'error';
        avatarSaveBtn.disabled = false;
        return;
      }
      setPlayerAvatar(connectedWallet, storedDataUrl);
      routeState.avatarJustSaved = true; // surfaced as a persistent note on re-render
      // Refresh only the nav avatar chip + the profile panel in place. Do NOT call
      // the global render() here — it resets officialAppStep and bounces the user
      // off the profile screen back to the cabinet floor.
      renderNav();
      renderOfficialProfile();
    });
    const avatarControls = el('div', { className: 'avatar-editor-controls' });
    avatarControls.append(chooseBtn, avatarSaveBtn, avatarFeedback);
    avatarRow.append(preview, avatarControls);
    avatarCard.append(avatarRow, fileInput);
    dom.officialCabinetGrid.append(avatarCard);

    // --- Game-specific stats + recent run history (game switcher) ---
    // Stats are tracked per game; switch which game's stats/history you're viewing.
    const statsCard = el('article', { className: 'official-info-card game-stats-card' });
    appendText(statsCard, 'span', 'GAME STATS & HISTORY', 'cabinet-status-label');
    const statsGameBar = el('div', { className: 'leaderboard-game-tabs profile-game-tabs' });
    for (const game of ARCADE_GAMES) {
      const playable = game.status === 'playable';
      const tab = el('button', {
        className: `pixel-button leaderboard-game-tab${game.id === routeState.gameId ? ' is-active' : ''}${playable ? '' : ' is-locked'}`,
        type: 'button',
      });
      appendText(tab, 'span', game.title, 'leaderboard-game-tab-title');
      if (!playable) appendText(tab, 'span', 'SOON', 'leaderboard-game-tab-badge');
      tab.disabled = !playable;
      if (playable) {
        tab.addEventListener('click', () => {
          if (routeState.gameId === game.id) return;
          routeState.gameId = game.id;
          renderOfficialProfile();
        });
      }
      statsGameBar.append(tab);
    }
    statsCard.append(statsGameBar);

    const gp = snapshot?.progress?.[routeState.gameId];
    const hmhStats = routeState.gameId === 'lester-blaster'
      ? buildHardMoneyHeroesStatsModule(state, connectedWallet, routeState.gameId)
      : null;
    if (!gp || (gp.paidRuns + gp.freeRuns) === 0) {
      const empty = el('div', { className: 'profile-empty-state' });
      appendText(empty, 'strong', `No runs recorded for ${getGame(routeState.gameId).title} yet.`);
      appendText(empty, 'small', 'Start Free Mode to practice, then publish a Ranked game-over score to fill this card with score, kills, survival, achievements, and LitVM receipts.');
      statsCard.append(empty);
    } else {
      const bestScore = hmhStats?.bestScore ?? Math.max(gp.bestPaidScore ?? 0, gp.bestFreeScore ?? 0);
      const stats = [
        ['Best Score', bestScore.toLocaleString()],
        ['Runs', `${gp.paidRuns + gp.freeRuns} (${gp.paidRuns} ranked)`],
        ['Longest Run', hmhStats?.longestSurvivalLabel ?? formatSeconds(gp.longestRunSeconds ?? 0)],
        ['Leaderboard', hmhStats?.rank ? `#${hmhStats.rank} / ${hmhStats.totalRanked}` : 'Unranked'],
        ['Total Kills', (hmhStats?.totalKills ?? gp.totalKills ?? 0).toLocaleString()],
        ['Power-Ups', (hmhStats?.powerUpsGrabbed ?? gp.cumulativePowerUps ?? 0).toLocaleString()],
        ['Boss Kills', `${hmhStats?.bossKills ?? gp.bossKills ?? 0}`],
        ['Max Combo', `${gp.maxCombo ?? 0}`],
      ];
      const statGrid = el('div', { className: 'game-stats-grid profile-stats-grid-v9' });
      for (const [label, value] of stats) {
        const cell = el('div', { className: 'game-stat-cell' });
        appendText(cell, 'span', value, 'game-stat-value');
        appendText(cell, 'span', label, 'game-stat-label');
        statGrid.append(cell);
      }
      statsCard.append(statGrid);

      if (hmhStats?.topAchievement) {
        const topAchievement = el('div', { className: `profile-top-achievement tier-${hmhStats.topAchievement.tier}` });
        appendText(topAchievement, 'span', 'Rarest unlocked badge', 'cabinet-status-label');
        appendText(topAchievement, 'strong', `${hmhStats.topAchievement.icon ?? '🏅'} ${hmhStats.topAchievement.title}`);
        appendText(topAchievement, 'small', `${hmhStats.topAchievement.description} · approx ${hmhStats.topAchievement.rarityPct}% unlock rate`);
        statsCard.append(topAchievement);
      }

      const breakdown = el('div', { className: 'profile-breakdown-grid' });
      const enemyCard = el('div', { className: 'profile-breakdown-card' });
      appendText(enemyCard, 'span', 'Enemy breakdown', 'cabinet-status-label');
      const enemyCopy = hmhStats?.enemyBreakdown?.length
        ? hmhStats.enemyBreakdown.slice(0, 3).map((enemy) => `${enemy.title}: ${enemy.kills}`).join(' · ')
        : 'No typed enemy kills recorded yet.';
      appendText(enemyCard, 'small', enemyCopy);
      const bossCard = el('div', { className: 'profile-breakdown-card' });
      appendText(bossCard, 'span', 'Boss ledger', 'cabinet-status-label');
      const bossCopy = hmhStats?.bossBreakdown?.length
        ? hmhStats.bossBreakdown.slice(0, 3).map((boss) => `${boss.title}: ${boss.kills}`).join(' · ')
        : `${gp.bossKills ?? 0} boss kill(s) recorded.`;
      appendText(bossCard, 'small', bossCopy);
      breakdown.append(enemyCard, bossCard);
      statsCard.append(breakdown);

      // Recent run history for THIS game (most recent first).
      const sessions = (profileV2?.sessionFeed.rows ?? [])
        .filter((s) => s.gameId === routeState.gameId || s.gameId === 'hmh' && routeState.gameId === 'lester-blaster')
        .slice(0, 5);
      if (sessions.length) {
        appendText(statsCard, 'span', 'RECENT RANKED RUNS', 'cabinet-status-label game-stats-subhead');
        const histList = el('div', { className: 'game-history-list' });
        for (const s of sessions) {
          const row = el('div', { className: 'game-history-row' });
          const rs = s.runStats ?? {};
          appendText(row, 'span', `${(s.score ?? rs.score ?? 0).toLocaleString()} pts`, 'game-history-score');
          appendText(row, 'span', `${s.urlSessionId ?? s.sessionId.slice(0, 12)} · ${rs.kills ?? 0} kills · ${s.survivalLabel ?? formatSurvive(rs.surviveSeconds ?? rs.elapsedSeconds ?? 0)}`, 'game-history-detail');
          appendText(row, 'span', s.trust?.label ?? (s.settlement?.primaryTxHash ? 'Settled' : 'Prototype'), `game-history-chain trust-${s.trust?.tone ?? 'muted'}`);
          if (s.detailHref) {
            const link = el('a', { className: 'game-history-link', href: s.detailHref, textContent: 'Open run' });
            row.append(link);
          }
          histList.append(row);
        }
        statsCard.append(histList);
      }
    }
    dom.officialCabinetGrid.append(statsCard);

    if (hmhRunHistory) {
      const historyCard = el('article', { className: 'official-info-card canonical-run-history-card' });
      appendText(historyCard, 'span', 'CANONICAL RUN HISTORY', 'cabinet-status-label');
      appendText(historyCard, 'strong', `${hmhRunHistory.totalCanonicalRuns} verified-format run${hmhRunHistory.totalCanonicalRuns === 1 ? '' : 's'} on this device`);
      appendText(historyCard, 'small', 'Gameplay facts come from the fixed-step child summary. Ranked settlement status comes from the parent wallet rail; free and unpublished runs stay explicitly local.');

      const filterGrid = el('div', { className: 'hmh-history-filter-grid' });
      const filterSpecs = [
        ['heroId', 'Hero', hmhRunHistory.options.heroes],
        ['weaponId', 'Weapon', hmhRunHistory.options.weapons],
        ['mode', 'Mode', hmhRunHistory.options.modes],
        ['date', 'Date', hmhRunHistory.options.dates],
        ['result', 'Result', hmhRunHistory.options.results],
      ];
      for (const [key, label, options] of filterSpecs) {
        const field = el('label', { className: 'hmh-history-filter' });
        appendText(field, 'span', label, 'hmh-history-filter-label');
        const select = el('select', { className: 'hmh-history-select' });
        select.setAttribute('aria-label', `Filter run history by ${label.toLowerCase()}`);
        for (const option of options) {
          const node = el('option', { textContent: option.label });
          node.value = option.id;
          select.append(node);
        }
        select.value = hmhRunHistory.filters[key];
        select.addEventListener('change', () => {
          routeState.historyFilters = { ...routeState.historyFilters, [key]: select.value };
          renderOfficialProfile();
        });
        field.append(select);
        filterGrid.append(field);
      }
      historyCard.append(filterGrid);

      const pb = hmhRunHistory.personalBests;
      const pbGrid = el('div', { className: 'profile-hero-stats hmh-history-pb-grid' });
      for (const [label, value] of [
        ['Best Score', pb.score.toLocaleString()],
        ['Survival', formatSeconds(pb.survivalTicks / 60)],
        ['Level', String(pb.level)],
        ['Max Combo', `×${pb.maxCombo}`],
        ['Boss Clears', String(pb.bossClears)],
        ['Damage', pb.damage.toLocaleString()],
        ['Trigger Accuracy', formatPermille(pb.triggerAccuracyPermille)],
        ['Projectile Accuracy', formatPermille(pb.projectileAccuracyPermille)],
      ]) {
        const cell = el('div', { className: 'profile-hero-stat' });
        appendText(cell, 'span', label);
        appendText(cell, 'strong', value);
        pbGrid.append(cell);
      }
      historyCard.append(pbGrid);

      const detailsBySessionId = new Map((profileV2?.sessionFeed.rows ?? []).map((row) => [row.sessionId, row.detailHref]));
      const runList = el('div', { className: 'hmh-history-run-list', role: 'table' });
      runList.setAttribute('aria-label', 'Canonical Hard Money Heroes run history');
      const tableHeader = el('div', { className: 'hmh-history-run-row hmh-history-table-header', role: 'row' });
      for (const label of ['Run', 'Performance', 'Build']) tableHeader.append(el('span', { textContent: label, role: 'columnheader' }));
      runList.append(tableHeader);
      if (hmhRunHistory.rows.length === 0) {
        appendText(runList, 'small', hmhRunHistory.emptyMessage, 'profile-empty-state');
      }
      for (const run of hmhRunHistory.rows) {
        const row = el('article', { className: `hmh-history-run-row provenance-${run.provenance.id}`, role: 'row' });
        row.setAttribute('aria-label', `${run.score} points, ${run.heroLabel}, ${run.provenance.label}`);
        const heading = el('div', { className: 'hmh-history-run-heading', role: 'cell' });
        appendText(heading, 'strong', `${run.score.toLocaleString()} pts · ${run.heroLabel}`);
        appendText(heading, 'span', run.provenance.label, `hmh-history-provenance provenance-${run.provenance.id}`);
        row.append(heading);
        const performance = el('div', { className: 'hmh-history-performance', role: 'cell' });
        appendText(performance, 'small', `${titleCase(run.mode)} · ${titleCase(run.result)} · ${formatSeconds(run.survivalTicks / 60)} · ${run.kills} kills · Level ${run.level} · ×${run.maxCombo} combo`);
        appendText(performance, 'small', `${run.primaryWeaponLabels.join(' + ') || 'No weapon activity'} · trigger ${formatPermille(run.triggerAccuracyPermille)} · projectile ${formatPermille(run.projectileAccuracyPermille)}`);
        row.append(performance);
        const buildText = run.build.ranks.length
          ? run.build.ranks.map((rank) => `${titleCase(rank.upgradeId)} ${rank.rank}`).join(' · ')
          : 'No upgrades selected';
        const buildCell = el('div', { className: 'hmh-history-build', role: 'cell' });
        appendText(buildCell, 'small', `Build: ${buildText}`);
        const detailHref = detailsBySessionId.get(run.sessionId);
        if (detailHref) buildCell.append(el('a', { className: 'game-history-link', href: detailHref, textContent: 'Open ranked receipt' }));
        row.append(buildCell);
        runList.append(row);
      }
      historyCard.append(runList);

      if (hmhRunHistory.weapons.length) {
        appendText(historyCard, 'span', 'WEAPON USAGE', 'cabinet-status-label game-stats-subhead');
        const weaponGrid = el('div', { className: 'profile-breakdown-grid hmh-history-weapon-grid' });
        for (const weapon of hmhRunHistory.weapons.slice(0, 6)) {
          const cell = el('div', { className: 'profile-breakdown-card' });
          appendText(cell, 'strong', weapon.label);
          appendText(cell, 'small', `${weapon.runs} run${weapon.runs === 1 ? '' : 's'} · ${weapon.damage.toLocaleString()} damage · ${weapon.kills} kills`);
          appendText(cell, 'small', `Trigger ${formatPermille(weapon.triggerAccuracyPermille)} · projectile ${formatPermille(weapon.projectileAccuracyPermille)} · reload ${formatPermille(weapon.reloadRatePermille)} · empty ${formatPermille(weapon.emptyRatePermille)}`);
          weaponGrid.append(cell);
        }
        historyCard.append(weaponGrid);
      }

      if (hmhRunHistory.heroes.length) {
        appendText(historyCard, 'span', 'HERO EFFECTIVENESS', 'cabinet-status-label game-stats-subhead');
        const heroGrid = el('div', { className: 'profile-breakdown-grid hmh-history-hero-grid' });
        for (const hero of hmhRunHistory.heroes) {
          const cell = el('div', { className: 'profile-breakdown-card' });
          appendText(cell, 'strong', hero.label);
          appendText(cell, 'small', `${hero.runs} run${hero.runs === 1 ? '' : 's'} · ${formatPermille(hero.completionRatePermille)} completed`);
          appendText(cell, 'small', `${hero.averageDamage.toLocaleString()} avg damage · ${hero.averageKills} avg kills · prefers ${hero.preferredWeaponLabel}`);
          heroGrid.append(cell);
        }
        historyCard.append(heroGrid);
      }
      if (hmhRunHistory.legacyRuns > 0) appendText(historyCard, 'small', `${hmhRunHistory.legacyRuns} legacy run${hmhRunHistory.legacyRuns === 1 ? '' : 's'} predate canonical summaries and are excluded from these metrics.`, 'tiny-note');
      dom.officialCabinetGrid.append(historyCard);
    }

    if (profileV2) {
      const collectionCard = el('article', { className: 'official-info-card profile-collection-card' });
      appendText(collectionCard, 'span', 'COLLECTION', 'cabinet-status-label');
      appendText(collectionCard, 'strong', `${profileV2.collection.unlockCounts.gamesPlayed} games played · ${profileV2.collection.unlockCounts.charactersUnlocked} heroes unlocked`);
      const gameRows = el('div', { className: 'game-history-list profile-collection-list' });
      for (const game of profileV2.collection.games.filter((item) => item.playable).slice(0, 4)) {
        const row = el('div', { className: `game-history-row collection-game-row${game.played ? ' is-played' : ' is-empty'}` });
        appendText(row, 'span', game.title, 'game-history-score');
        appendText(row, 'span', `${game.bestScoreLabel} best · ${game.totalRuns} run(s) · ${game.longestRunLabel}`, 'game-history-detail');
        const playLink = el('a', { className: 'game-history-link', href: game.routePath, textContent: game.played ? 'Replay' : 'Play' });
        row.append(playLink);
        gameRows.append(row);
      }
      const characterRows = el('div', { className: 'achievements-grid profile-character-collection' });
      for (const character of profileV2.collection.characters) {
        const chip = el('div', { className: `achievement-badge tier-bronze ${character.unlocked ? 'unlocked' : 'locked'}` });
        appendText(chip, 'span', character.unlocked ? '🧍' : '🔒', 'achievement-icon');
        appendText(chip, 'span', character.title, 'achievement-name');
        appendText(chip, 'small', character.unlocked ? (character.selected ? 'Selected' : 'Unlocked') : character.unlockDescription, 'achievement-tooltip');
        characterRows.append(chip);
      }
      collectionCard.append(gameRows, characterRows);
      dom.officialCabinetGrid.append(collectionCard);
    }

    // --- Achievements module (full-width, below profile cards) ---
    const unlockedByTitle = new Map((snapshot?.achievements ?? []).map((a) => [a.title, a]));
    const achievements = Object.values(ACHIEVEMENTS).map((achievement) => {
      const unlocked = unlockedByTitle.get(achievement.title)?.unlocked ?? false;
      return { ...achievement, unlocked };
    });
    const summary = { total: achievements.length, unlocked: achievements.filter((a) => a.unlocked).length };
    const achCard = el('article', { className: 'official-info-card achievements-card achievements-module' });
    const achHead = el('div', { className: 'achievements-head' });
    appendText(achHead, 'span', 'ACHIEVEMENTS', 'cabinet-status-label');
    appendText(achHead, 'strong', `${summary.unlocked} / ${summary.total} unlocked`, 'achievements-count');
    achCard.append(achHead);
    const grid = el('div', { className: 'achievements-grid' });
    for (const a of achievements) {
      const badge = el('div', {
        className: `${a.uiChrome?.badgeClassName ?? `achievement-badge tier-${a.tier ?? 'bronze'}`} ${a.unlocked ? 'unlocked' : 'locked'}`,
        title: `${a.title} — ${a.description}`,
        dataset: { uiChrome: a.uiChrome?.toastFrameId ?? 'achievement-toast-frame', badgeFrame: a.uiChrome?.badgeFrameId ?? `achievement-tier-${a.tier ?? 'bronze'}` },
      });
      badge.tabIndex = 0;
      badge.setAttribute('aria-label', `${a.title}. ${a.description}`);
      const tooltip = el('span', { className: 'achievement-tooltip', textContent: a.description });
      badge.append(renderAchievementIcon({ iconSrc: a.iconSrc, icon: a.unlocked ? (a.icon ?? '🏅') : '🔒', label: a.title }));
      appendText(badge, 'span', a.title, 'achievement-name');
      badge.append(tooltip);
      grid.append(badge);
    }
    achCard.append(grid);
    dom.officialCabinetGrid.append(achCard);

    // --- Settlement history (score settles to LitVM via zkLTC) ---
    const settlements = snapshot?.settlements ?? [];
    const settleCard = el('article', { className: 'official-info-card settlement-history-card settlement-ledger-v9' });
    appendText(settleCard, 'span', 'LITVM SETTLEMENT', 'cabinet-status-label');
    appendText(settleCard, 'strong', settlements.length ? `${settlements.length} settled run(s)` : 'No settled runs yet');
    appendText(settleCard, 'small', settlements.length
      ? 'Each receipt stamps the matching leaderboard row and parent session with a tx hash. Simulation remains clearly labeled until contracts deploy.'
      : 'Ranked game-over submission settles score, achievements, and username to LitVM; the zkLTC fee covers gas.');
    const settleList = el('div', { className: 'settlement-ledger-list' });
    if (settlements.length === 0) {
      const emptyReceipt = el('div', { className: 'settlement-receipt empty' });
      appendText(emptyReceipt, 'span', 'Awaiting first Ranked receipt', 'settlement-receipt-title');
      appendText(emptyReceipt, 'small', 'Play Ranked → finish run → Submit Official Score to generate a simulated LitVM receipt.');
      settleList.append(emptyReceipt);
    } else {
      for (const s of settlements.slice(-4).reverse()) {
        const receipt = el('div', { className: `settlement-receipt mode-${s.mode}` });
        const tx = s.primaryTxHash ? `${s.primaryTxHash.slice(0, 10)}…${s.primaryTxHash.slice(-6)}` : 'pending';
        appendText(receipt, 'span', `${s.score.toLocaleString()} pts · ${s.mode}`, 'settlement-receipt-title');
        appendText(receipt, 'small', `Session ${s.sessionId.slice(0, 18)}… · tx ${tx}`);
        const receiptMeta = el('div', { className: 'settlement-receipt-meta' });
        appendText(receiptMeta, 'span', s.settledAt ? new Date(s.settledAt).toLocaleString() : 'pending');
        if (s.primaryTxHash) appendText(receiptMeta, 'span', 'leaderboard stamped');
        receipt.append(receiptMeta);
        settleList.append(receipt);
      }
    }
    settleCard.append(settleList);
    dom.officialCabinetGrid.append(settleCard);
  }

  let officialLeaderboardCadence = 'all-time';
  // Leaderboard sort/filter/search UI state (Top-50 board).
  let leaderboardSortKey = 'score'; // 'score' | 'name' | 'date' | 'kills' | 'survive' | 'level'
  let leaderboardSortDir = 'desc';  // 'asc' | 'desc'
  let leaderboardSearch = '';
  // Which game's leaderboard is being viewed. Defaults to the active play target
  // (HMH). Game-specific so future cabinets get their own boards via the switcher.
  let leaderboardGameId = 'lester-blaster';

  return Object.freeze({ renderProfile: renderOfficialProfile });
}
