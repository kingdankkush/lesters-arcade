import {
  ACHIEVEMENTS,
  HARD_MONEY_HEROES_CANON,
  LESTER_ARCADE_BUILD_STACK,
  LESTER_ARCADE_WALLET_RAILS,
  LESTERS_ARCADE_V2_APP_SHELL,
  LESTER_BLASTER_ANIMATION_PLAN,
  LITVM_LITEFORGE_NETWORK,
  LESTER_BLASTER_BOSS_SYSTEM,
  LESTER_BLASTER_CHARACTER_ROSTER,
  LESTER_BLASTER_COMBAT_EFFECTS,
  LESTER_BLASTER_ENEMY_CATALOG,
  LESTER_BLASTER_ENVIRONMENTS,
  LESTER_BLASTER_GAMEPLAY,
  LESTER_BLASTER_LEVEL_PLAN,
  LESTER_BLASTER_MENU_OPTIONS,
  LESTER_BLASTER_PERFORMANCE_TARGETS,
  LESTER_BLASTER_POWER_UPS,
  LESTER_BLASTER_SOUND_DESIGN,
  LESTER_BLASTER_UNLOCKABLES,
  LESTER_BLASTER_WEAPON_SYSTEM,
  buildLeaderboardModel,
  buildLesterBlasterControlDisplayModel,
  buildCombatSandboxStatusModel,
  buildLoginMenuModel,
  buildOfficialRunStatusModel,
  buildPlayerArcadeSnapshot,
  buildUiQualityGuideModel,
  buildWalletConnectionModel,
  calculateLesterBlasterScore,
  chooseEnemySpawn,
  connectPlayerAccount,
  createInitialArcadeState,
  formatMicroUsdc,
  getCartridgeSelectModel,
  getGame,
  getLesterBlasterDifficultyAt,
  recordScore,
  scheduleBossEncounter,
  simulateLesterBlasterRun,
  startPlaySession,
} from './src/arcade-core.mjs';

const MOCK_WALLET = '0x1e57e21e57e21e57e21e57e21e57e21e57e21e57';
const PLAYER_X = 108;
const GROUND_Y = 276;
const FIXED_STEP_MS = 1000 / LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps;

function loadImageAsset(src) {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image;
}

function imageReady(image) {
  return Boolean(image?.complete && image.naturalWidth > 0);
}

function loadAnimationFrames(pattern, count) {
  return Array.from({ length: count }, (_, index) => loadImageAsset(pattern.replace('{index}', String(index).padStart(2, '0'))));
}

function selectAnimationFrame(frames, frame, fps = 10, loop = true) {
  if (!frames?.length) return null;
  const ticksPerFrame = Math.max(1, Math.round(LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps / fps));
  const rawIndex = Math.floor(frame / ticksPerFrame);
  const index = loop ? rawIndex % frames.length : Math.min(frames.length - 1, rawIndex);
  return frames[index];
}

const combatArt = {
  hero: {
    animations: {
      idle: loadAnimationFrames('./assets/lester-production/frames/idle/lester-idle-{index}.png', 25),
      walk: loadAnimationFrames('./assets/lester-production/frames/walk/lester-walk-{index}.png', 25),
      run: loadAnimationFrames('./assets/lester-production/frames/run/lester-run-{index}.png', 25),
      jump: loadAnimationFrames('./assets/lester-production/frames/jump/lester-jump-{index}.png', 25),
    },
    stills: {
      shoot: loadImageAsset('./assets/lester-production/stills/lester-right-side-shotgun.png'),
      facing: loadImageAsset('./assets/lester-production/stills/lester-facing.png'),
      leftSide: loadImageAsset('./assets/lester-production/stills/lester-left-side-profile.png'),
      rightSide: loadImageAsset('./assets/lester-production/stills/lester-right-side-profile.png'),
    },
    fallback: {
      idle: loadImageAsset('./assets/generated/sliced/lester-idle.png'),
      run1: loadImageAsset('./assets/generated/sliced/lester-run-1.png'),
      run2: loadImageAsset('./assets/generated/sliced/lester-run-2.png'),
      shoot: loadImageAsset('./assets/generated/sliced/lester-shoot.png'),
      blade: loadImageAsset('./assets/generated/sliced/lester-blade.png'),
      jump: loadImageAsset('./assets/generated/sliced/lester-jump.png'),
    },
  },
  enemies: {
    goblin: loadImageAsset('./assets/generated/sliced/enemy-goblin-idle.png'),
    wisp: loadImageAsset('./assets/generated/sliced/enemy-wisp-idle.png'),
    bruiser: loadImageAsset('./assets/generated/sliced/enemy-bruiser-idle.png'),
    scambot: loadImageAsset('./assets/generated/sliced/enemy-scambot-idle.png'),
  },
  icons: {
    health: loadImageAsset('./assets/generated/sliced/icon-weapon-health.png'),
    shield: loadImageAsset('./assets/generated/sliced/icon-weapon-shield.png'),
    ammo: loadImageAsset('./assets/generated/sliced/icon-weapon-ammo.png'),
    oneUp: loadImageAsset('./assets/generated/sliced/icon-weapon-one-up.png'),
    weapon: loadImageAsset('./assets/generated/sliced/icon-weapon-settler.png'),
    score: loadImageAsset('./assets/generated/sliced/icon-weapon-score-multiplier.png'),
  },
  parallax: {
    'level-the-slums': [
      { image: loadImageAsset('./assets/generated/sliced/level1-underchain-sky.png'), y: 0, h: 110, speed: 0.12 },
      { image: loadImageAsset('./assets/generated/sliced/level1-underchain-skyline.png'), y: 58, h: 132, speed: 0.24 },
      { image: loadImageAsset('./assets/generated/sliced/level1-underchain-midground.png'), y: 128, h: 132, speed: 0.46 },
      { image: loadImageAsset('./assets/generated/sliced/level1-underchain-street.png'), y: 206, h: 96, speed: 0.82 },
    ],
    'level-the-tower': [
      { image: loadImageAsset('./assets/generated/sliced/level2-foundry-sky.png'), y: 0, h: 110, speed: 0.1 },
      { image: loadImageAsset('./assets/generated/sliced/level2-foundry-skyline.png'), y: 54, h: 140, speed: 0.22 },
      { image: loadImageAsset('./assets/generated/sliced/level2-foundry-midground.png'), y: 124, h: 144, speed: 0.42 },
      { image: loadImageAsset('./assets/generated/sliced/level2-foundry-street.png'), y: 202, h: 104, speed: 0.72 },
    ],
    'level-the-getaway': [
      { image: loadImageAsset('./assets/generated/sliced/level3-getaway-sky.png'), y: 0, h: 112, speed: 0.18 },
      { image: loadImageAsset('./assets/generated/sliced/level3-getaway-skyline.png'), y: 56, h: 140, speed: 0.38 },
      { image: loadImageAsset('./assets/generated/sliced/level3-getaway-midground.png'), y: 126, h: 144, speed: 0.72 },
      { image: loadImageAsset('./assets/generated/sliced/level3-getaway-street.png'), y: 202, h: 104, speed: 1.12 },
    ],
  },
};

const dom = {
  officialApp: document.querySelector('#officialApp'),
  officialNavTabs: document.querySelector('#officialNavTabs'),
  developerBackstageToggle: document.querySelector('#developerBackstageToggle'),
  developerBackstage: document.querySelector('#developerBackstage'),
  officialWalletSplash: document.querySelector('#officialWalletSplash'),
  officialConnectButton: document.querySelector('#officialConnectButton'),
  officialWalletCopy: document.querySelector('#officialWalletCopy'),
  officialArcadeFloor: document.querySelector('#officialArcadeFloor'),
  officialProfileTitle: document.querySelector('#officialProfileTitle'),
  officialProfileCopy: document.querySelector('#officialProfileCopy'),
  officialCabinetGrid: document.querySelector('#officialCabinetGrid'),
  officialModeSelect: document.querySelector('#officialModeSelect'),
  officialFreeModeButton: document.querySelector('#officialFreeModeButton'),
  officialRankedModeButton: document.querySelector('#officialRankedModeButton'),
  officialRankedTooltip: document.querySelector('#officialRankedTooltip'),
  officialLevelIntro: document.querySelector('#officialLevelIntro'),
  officialBeginLevelButton: document.querySelector('#officialBeginLevelButton'),
  officialGameplay: document.querySelector('#officialGameplay'),
  officialGameModeTitle: document.querySelector('#officialGameModeTitle'),
  officialGameStateCopy: document.querySelector('#officialGameStateCopy'),
  officialCombatMount: document.querySelector('#officialCombatMount'),
  accountFlowSteps: document.querySelector('#accountFlowSteps'),
  walletStatus: document.querySelector('#walletStatus'),
  systemStatus: document.querySelector('#systemStatus'),
  connectWalletButton: document.querySelector('#connectWalletButton'),
  walletRailPanel: document.querySelector('#walletRailPanel'),
  guideIntro: document.querySelector('#guideIntro'),
  quickStartGuide: document.querySelector('#quickStartGuide'),
  instructionPanel: document.querySelector('#instructionPanel'),
  tooltipShelf: document.querySelector('#tooltipShelf'),
  brandPalette: document.querySelector('#brandPalette'),
  patternList: document.querySelector('#patternList'),
  iconLegend: document.querySelector('#iconLegend'),
  qualityChecklist: document.querySelector('#qualityChecklist'),
  playerSummary: document.querySelector('#playerSummary'),
  progressList: document.querySelector('#progressList'),
  achievementList: document.querySelector('#achievementList'),
  transactionList: document.querySelector('#transactionList'),
  highScoreList: document.querySelector('#highScoreList'),
  buildStackPanel: document.querySelector('#buildStackPanel'),
  menuModelPanel: document.querySelector('#menuModelPanel'),
  cabinetStage: document.querySelector('#cabinetStage'),
  cartridgeRack: document.querySelector('#cartridgeRack'),
  selectedGameTitle: document.querySelector('#selectedGameTitle'),
  selectedGameStatus: document.querySelector('#selectedGameStatus'),
  selectedGameTagline: document.querySelector('#selectedGameTagline'),
  freePlayButton: document.querySelector('#freePlayButton'),
  paidPlayButton: document.querySelector('#paidPlayButton'),
  simulateRunButton: document.querySelector('#simulateRunButton'),
  runStatus: document.querySelector('#runStatus'),
  runDetails: document.querySelector('#runDetails'),
  leaderboardPanel: document.querySelector('#leaderboardPanel'),
  combatCanvas: document.querySelector('#combatCanvas'),
  startCombatButton: document.querySelector('#startCombatButton'),
  jumpButton: document.querySelector('#jumpButton'),
  shootButton: document.querySelector('#shootButton'),
  meleeButton: document.querySelector('#meleeButton'),
  grenadeButton: document.querySelector('#grenadeButton'),
  powerUpButton: document.querySelector('#powerUpButton'),
  fpsPill: document.querySelector('#fpsPill'),
  controlSchemePanel: document.querySelector('#controlSchemePanel'),
  combatRunStatus: document.querySelector('#combatRunStatus'),
  combatStatus: document.querySelector('#combatStatus'),
  difficultyPanel: document.querySelector('#difficultyPanel'),
  mechanicList: document.querySelector('#mechanicList'),
  bossRoster: document.querySelector('#bossRoster'),
  codexPanels: document.querySelector('#codexPanels'),
};

const state = createInitialArcadeState();
const cartridges = getCartridgeSelectModel();
let selectedGameId = 'lester-blaster';
let connectedWallet = null;
let connectedChainId = null;
let walletConnector = 'none';
let currentSession = null;
let lastCompletedSession = null;
let lastRunResult = null;
let lastRunScore = 0;
let lastRunElapsedSeconds = 0;
let lastBossId = null;
let officialAppStep = 'wallet-splash';
let officialSelectedMode = null;
let developerBackstageOpen = false;

const combat = {
  active: false,
  startedAt: 0,
  frame: 0,
  elapsedGameSeconds: 0,
  playerX: PLAYER_X,
  playerY: GROUND_Y,
  velocityY: 0,
  velocityX: 0,
  jumpsLeft: 2,
  health: 100,
  lives: 3,
  score: 0,
  kills: 0,
  combo: 0,
  maxCombo: 0,
  damageCombo: 0,
  maxDamageCombo: 0,
  noDamageSeconds: 0,
  invulnerableFrames: 0,
  crouching: false,
  crouchFrames: 0,
  bullets: [],
  enemyShots: [],
  enemies: [],
  particles: [],
  floatingTexts: [],
  powerUps: [],
  powerUpsCollected: 0,
  collectedPowerUpTypes: new Set(),
  grenades: 3,
  ammo: Infinity,
  weaponId: 'coin-blaster',
  shots: 0,
  meleeSwings: 0,
  boss: null,
  miniBossLock: false,
  scrollLockReason: null,
  scroll: 0,
  keys: new Set(),
  lastTimestamp: 0,
  accumulatorMs: 0,
  frameTimes: [],
  fps: 60,
  status: 'Attract mode: choose free or paid, then start the 60fps combat test.',
};

function el(tagName, options = {}) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.textContent !== undefined) node.textContent = options.textContent;
  if (options.alt !== undefined) node.alt = options.alt;
  if (options.src !== undefined) node.src = options.src;
  if (options.type !== undefined) node.type = options.type;
  if (options.href !== undefined) node.href = options.href;
  if (options.target !== undefined) node.target = options.target;
  if (options.rel !== undefined) node.rel = options.rel;
  if (options.title !== undefined) node.title = options.title;
  if (options.ariaLabel !== undefined) node.setAttribute('aria-label', options.ariaLabel);
  if (options.role !== undefined) node.setAttribute('role', options.role);
  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      node.dataset[key] = String(value);
    }
  }
  return node;
}

function appendText(parent, tagName, text, className) {
  const node = el(tagName, { textContent: text, className });
  parent.append(node);
  return node;
}

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function selectedGame() {
  return getGame(selectedGameId);
}

function renderWalletRails() {
  const model = buildWalletConnectionModel({
    providerAvailable: Boolean(detectEthereumProvider()?.request),
    wallet: connectedWallet,
    chainId: connectedChainId,
  });

  dom.walletRailPanel.replaceChildren();
  const status = el('article', { className: `wallet-rail-card ${model.status} ${model.chainGuard.status}` });
  appendText(status, 'strong', `${model.targetNetwork} wallet rail // ${model.status}`);
  appendText(status, 'span', connectedWallet
    ? `${model.walletShort} via ${walletConnector}`
    : 'No wallet connected. Browser wallet will be tried first; mock fallback stays available for local testing.');
  appendText(status, 'small', model.chainGuard.copy);
  dom.walletRailPanel.append(status);

  const network = el('article', { className: 'wallet-rail-card network-card' });
  appendText(network, 'strong', `${model.network.name} // Chain ${model.network.chainId} (${model.network.chainIdHex})`);
  appendText(network, 'span', `Gas token ${model.network.nativeCurrency.symbol} · RPC ${model.network.rpcUrls.http}`);
  appendText(network, 'small', `${model.chainGuard.switchMethod} → ${model.network.chainIdHex}; ${model.chainGuard.addMethod} uses ${model.network.name}, ${model.network.nativeCurrency.symbol}, RPC, and explorer below. ${model.network.safetyNotes.join(' ')}`);
  const links = el('div', { className: 'wallet-link-row' });
  links.append(
    el('a', { className: 'wallet-link', href: model.network.faucetUrl, target: '_blank', rel: 'noreferrer', textContent: 'LiteForge faucet / hub' }),
    el('a', { className: 'wallet-link', href: model.network.explorerUrl, target: '_blank', rel: 'noreferrer', textContent: 'Block explorer' }),
    el('a', { className: 'wallet-link', href: model.network.portalUrl, target: '_blank', rel: 'noreferrer', textContent: 'Official testnet portal' }),
  );
  network.append(links);
  dom.walletRailPanel.append(network);

  const connectors = el('article', { className: 'wallet-rail-card' });
  appendText(connectors, 'strong', 'Connectors');
  appendText(connectors, 'span', model.connectors.map((connector) => `${connector.label}: ${connector.available ? 'ready' : 'not detected'}`).join(' // '));
  dom.walletRailPanel.append(connectors);

  const scopes = el('article', { className: 'wallet-rail-card' });
  appendText(scopes, 'strong', 'Paid-run parent writes');
  appendText(scopes, 'span', model.permissions.writeScopes.join(' // '));
  appendText(scopes, 'small', LESTER_ARCADE_WALLET_RAILS.permissions.freeModeRule);
  dom.walletRailPanel.append(scopes);
}

function renderOfficialRunStatus() {
  const model = buildOfficialRunStatusModel({
    gameTitle: selectedGame().title,
    connected: Boolean(connectedWallet),
    currentSession: currentSession ?? lastCompletedSession,
    lastResult: lastRunResult,
  });
  dom.runStatus.textContent = model.heading;
  dom.runDetails.textContent = model.details;
  dom.runStatus.dataset.state = model.state;
}

function renderCombatSandboxStatus() {
  const model = buildCombatSandboxStatusModel({
    running: combat.active,
    elapsedSeconds: combat.elapsedGameSeconds,
    fps: combat.fps,
    activeMode: currentSession?.mode ?? 'practice',
  });
  dom.combatRunStatus.textContent = model.heading;
  dom.combatStatus.textContent = `${model.details} Controls: WASD/arrows move, Ctrl/S/Down crouch, Space jump, Left Click shoot, E/Right Click melee, F throwable, R reload.`;
  dom.combatRunStatus.dataset.state = model.state;
}

function weaponById(weaponId) {
  return LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.find((weapon) => weapon.id === weaponId)
    ?? LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons[0];
}

function currentLevel() {
  return LESTER_BLASTER_LEVEL_PLAN.find((level) => {
    const [start, end] = level.targetMinutes;
    const minutes = combat.elapsedGameSeconds / 60;
    return minutes >= start && minutes < end;
  }) ?? LESTER_BLASTER_LEVEL_PLAN.at(-1);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerHitbox() {
  const crouching = combat.crouching && combat.playerY >= GROUND_Y - 2;
  return crouching
    ? { x: combat.playerX + 5, y: combat.playerY - 52, w: 42, h: 44 }
    : { x: combat.playerX + 4, y: combat.playerY - 82, w: 42, h: 74 };
}

function enemyHitbox(enemy) {
  const w = enemy.miniBoss ? 70 : enemy.class === 'armored' ? 46 : enemy.class?.includes('flying') ? 38 : 34;
  const h = enemy.miniBoss ? 66 : enemy.class?.includes('flying') ? 34 : 42;
  return { x: enemy.x, y: enemy.y - h, w, h };
}

function bulletHitbox(bullet) {
  return { x: bullet.x, y: bullet.y - 3, w: bullet.weaponId === 'hash-rail' ? 38 : 23, h: bullet.weaponId === 'hash-rail' ? 12 : 10 };
}

function enemyShotHitbox(shot) {
  return { x: shot.x, y: shot.y - 2, w: 16, h: 9 };
}

function bossHitbox() {
  return combat.boss ? { x: combat.boss.x, y: GROUND_Y - 130, w: 96, h: 116 } : null;
}

function powerUpHitbox(power) {
  return { x: power.x, y: power.y - 18, w: 26, h: 28 };
}

function releaseScrollLock(reason = 'arena clear') {
  combat.miniBossLock = false;
  combat.scrollLockReason = null;
  spawnText(`SCROLL RELEASED // ${reason}`, 250, 90, '#45ff8a');
}

function renderFlowSteps() {
  const steps = [
    ['01', 'Wallet login', 'Use an injected EVM wallet when available; fallback to a local mock account for offline QA.'],
    ['02', 'Parent account', 'One Lester profile stores progress, loadout unlocks, badges, transactions, and official high scores.'],
    ['03', 'Cabinet dapp', 'Hard Money Heroes runs as the first child game that reads profile state and writes official paid-run packets back.'],
    ['04', 'LitVM rails', 'dappit.io can help move profile, paid-session, score, achievement, and tournament contracts toward LitVM.'],
  ];
  dom.accountFlowSteps.replaceChildren();
  for (const [number, title, copy] of steps) {
    const card = el('article', { className: 'flow-step' });
    appendText(card, 'strong', `${number} // ${title}`);
    appendText(card, 'span', copy);
    dom.accountFlowSteps.append(card);
  }
}

function setOfficialView(step) {
  officialAppStep = step;
  render();
}

function showOfficialPanel(activePanel) {
  for (const panel of [dom.officialWalletSplash, dom.officialArcadeFloor, dom.officialModeSelect, dom.officialLevelIntro, dom.officialGameplay]) {
    if (panel) panel.hidden = panel !== activePanel;
  }
}

function renderOfficialNav() {
  if (!dom.officialNavTabs) return;
  dom.officialNavTabs.replaceChildren();
  for (const item of LESTERS_ARCADE_V2_APP_SHELL.navigation) {
    const button = el('button', { className: `official-nav-tab ${officialAppStep === item.id ? 'active' : ''}`, textContent: item.label });
    button.type = 'button';
    button.disabled = !connectedWallet && item.id !== 'cabinets';
    button.addEventListener('click', () => {
      if (item.id === 'cabinets') setOfficialView(connectedWallet ? 'cabinet-select' : 'wallet-splash');
      if (item.id === 'profile') setOfficialView('profile');
      if (item.id === 'leaderboards') setOfficialView('leaderboards');
      if (item.id === 'settings') setOfficialView('settings');
    });
    dom.officialNavTabs.append(button);
  }
}

function renderOfficialWalletSplash() {
  if (!dom.officialWalletSplash) return;
  const copy = connectedWallet
    ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)} is active. Enter the arcade to select Hard Money Heroes.`
    : LESTERS_ARCADE_V2_APP_SHELL.profileRules.walletLockCopy;
  dom.officialWalletCopy.textContent = copy;
  dom.officialConnectButton.textContent = connectedWallet ? 'Enter Arcade' : 'Connect Wallet';
}

function renderOfficialCabinets() {
  dom.officialCabinetGrid.replaceChildren();
  for (const cabinet of LESTERS_ARCADE_V2_APP_SHELL.cabinets) {
    const card = el('button', { className: `official-cabinet-card ${cabinet.playable ? 'playable' : 'locked'}` });
    card.type = 'button';
    card.disabled = !cabinet.playable;
    card.addEventListener('click', () => {
      if (!cabinet.playable) return;
      selectedGameId = cabinet.gameId;
      currentSession = null;
      lastCompletedSession = null;
      lastRunResult = null;
      setOfficialView('mode-select');
    });
    appendText(card, 'span', cabinet.playable ? 'PLAYABLE NOW' : 'COMING SOON', 'cabinet-status-label');
    appendText(card, 'strong', cabinet.title);
    appendText(card, 'small', cabinet.description);
    dom.officialCabinetGrid.append(card);
  }
}

function renderOfficialProfile() {
  dom.officialCabinetGrid.replaceChildren();
  const snapshot = connectedWallet ? buildPlayerArcadeSnapshot(state, connectedWallet) : null;
  const profile = snapshot?.profile;
  const card = el('article', { className: 'official-info-card' });
  appendText(card, 'span', 'Wallet Profile', 'cabinet-status-label');
  appendText(card, 'strong', profile?.handle ?? 'Connect wallet to activate profile');
  appendText(card, 'small', connectedWallet ? `${connectedWallet.slice(0, 10)}…${connectedWallet.slice(-8)} // username + 150x150 avatar editor next` : 'Wallet is the locked identity for progress, high scores, achievements, and avatars.');
  dom.officialCabinetGrid.append(card);
}

function renderOfficialLeaderboards() {
  dom.officialCabinetGrid.replaceChildren();
  const model = buildLeaderboardModel(state, { gameId: selectedGameId, wallet: connectedWallet });
  for (const cadence of LESTERS_ARCADE_V2_APP_SHELL.leaderboardRules.cadences) {
    const card = el('article', { className: 'official-info-card leaderboard-cadence-card' });
    appendText(card, 'span', cadence.toUpperCase(), 'cabinet-status-label');
    appendText(card, 'strong', model.topEntries[0] ? `#1 ${model.topEntries[0].score.toLocaleString()}` : 'No ranked scores yet');
    appendText(card, 'small', 'Global board + your wallet placement will appear here after official game-over submissions.');
    dom.officialCabinetGrid.append(card);
  }
}

function renderOfficialSettings() {
  dom.officialCabinetGrid.replaceChildren();
  const settings = [
    ['Controls', LESTERS_ARCADE_V2_APP_SHELL.levelIntro.controlsSummary],
    ['Audio', 'Music and SFX start after user interaction; prototype music is loaded from the local Lester/Lilly rap track.'],
    ['Network', `${LITVM_LITEFORGE_NETWORK.name} // Chain ${LITVM_LITEFORGE_NETWORK.chainId} // gas ${LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol}`],
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

function renderOfficialArcadeFloor() {
  const walletShort = connectedWallet ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)}` : 'No wallet';
  const titleByStep = {
    'arcade-walk-in': 'Entering the Arcade...',
    'cabinet-select': 'Choose Your Cabinet',
    profile: 'Wallet Profile',
    leaderboards: 'Leaderboards',
    settings: 'Settings',
  };
  const copyByStep = {
    'arcade-walk-in': `${walletShort} is active. Neon doors opening; cabinet row loading...`,
    'cabinet-select': 'Select a cabinet. Hard Money Heroes is the only playable option right now; future cabinets remain locked.',
    profile: LESTERS_ARCADE_V2_APP_SHELL.profileRules.walletLockCopy,
    leaderboards: 'Browse daily, weekly, monthly, yearly, and all-time boards. Official scores submit from ranked game-over only.',
    settings: 'Controls, audio, accessibility, wallet/network, and sign-out controls live here.',
  };
  dom.officialProfileTitle.textContent = titleByStep[officialAppStep] ?? titleByStep['cabinet-select'];
  dom.officialProfileCopy.textContent = copyByStep[officialAppStep] ?? copyByStep['cabinet-select'];
  if (officialAppStep === 'profile') renderOfficialProfile();
  else if (officialAppStep === 'leaderboards') renderOfficialLeaderboards();
  else if (officialAppStep === 'settings') renderOfficialSettings();
  else renderOfficialCabinets();
}

function renderOfficialModeSelect() {
  const ranked = LESTERS_ARCADE_V2_APP_SHELL.modeSelect.ranked;
  dom.officialRankedTooltip.replaceChildren();
  appendText(dom.officialRankedTooltip, 'strong', `${ranked.label}: needs testnet ${ranked.token}`);
  appendText(dom.officialRankedTooltip, 'span', ranked.copy);
  const link = el('a', { className: 'wallet-link', textContent: 'Get zkLTC faucet', href: ranked.faucetUrl, target: '_blank', rel: 'noreferrer' });
  dom.officialRankedTooltip.append(link);
}

function renderOfficialGameplay() {
  const modeLabel = officialSelectedMode === 'ranked' ? 'Ranked Testnet' : 'Free Mode';
  dom.officialGameModeTitle.textContent = `Level 1 // ${modeLabel}`;
  dom.officialGameStateCopy.textContent = officialSelectedMode === 'ranked'
    ? 'Ranked testnet run: official score packet is still separated until game-over submission.'
    : 'Free practice: local sandbox only; no official profile, achievement, high-score, or transaction writes.';
  if (dom.officialCombatMount && !dom.officialCombatMount.contains(dom.combatCanvas)) {
    dom.officialCombatMount.append(dom.combatCanvas);
  }
}

function renderOfficialApp() {
  if (!dom.officialApp) return;
  dom.officialApp.dataset.step = officialAppStep;
  dom.developerBackstage.hidden = !developerBackstageOpen;
  dom.developerBackstageToggle.textContent = developerBackstageOpen ? 'Hide Backstage' : 'Dev Backstage';
  renderOfficialNav();
  renderOfficialWalletSplash();
  if (!connectedWallet && officialAppStep !== 'wallet-splash') officialAppStep = 'wallet-splash';
  if (['arcade-walk-in', 'cabinet-select', 'profile', 'leaderboards', 'settings'].includes(officialAppStep)) {
    showOfficialPanel(dom.officialArcadeFloor);
    renderOfficialArcadeFloor();
  } else if (officialAppStep === 'mode-select') {
    showOfficialPanel(dom.officialModeSelect);
    renderOfficialModeSelect();
  } else if (officialAppStep === 'level-one-intro') {
    showOfficialPanel(dom.officialLevelIntro);
  } else if (officialAppStep === 'gameplay') {
    showOfficialPanel(dom.officialGameplay);
    renderOfficialGameplay();
  } else {
    showOfficialPanel(dom.officialWalletSplash);
  }
}

async function connectOfficialWallet() {
  if (!connectedWallet) await connectWallet();
  officialAppStep = 'arcade-walk-in';
  render();
  setTimeout(() => {
    if (officialAppStep === 'arcade-walk-in') setOfficialView('cabinet-select');
  }, 900);
}

async function startOfficialMode(mode) {
  officialSelectedMode = mode;
  await startMode(mode === 'ranked' ? 'paid' : 'free');
  officialAppStep = 'level-one-intro';
  render();
}

async function beginOfficialLevel() {
  if (!currentSession) await startOfficialMode(officialSelectedMode ?? 'free');
  officialAppStep = 'gameplay';
  render();
  await startCombat();
  render();
}

function detectEthereumProvider() {
  return globalThis.ethereum ?? null;
}

function connectMockWallet() {
  connectedWallet = MOCK_WALLET;
  connectedChainId = null;
  walletConnector = 'mock-wallet';
  connectPlayerAccount(state, connectedWallet, { handle: 'Lester Pilot' });
  render();
  return connectedWallet;
}

async function refreshInjectedChainId(provider = detectEthereumProvider()) {
  if (!provider?.request) return null;
  try {
    connectedChainId = await provider.request({ method: 'eth_chainId' });
  } catch {
    connectedChainId = null;
  }
  return connectedChainId;
}

async function requestLiteForgeNetwork(provider = detectEthereumProvider()) {
  if (!provider?.request) return false;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: LITVM_LITEFORGE_NETWORK.chainIdHex }],
    });
    await refreshInjectedChainId(provider);
    return connectedChainId === LITVM_LITEFORGE_NETWORK.chainIdHex;
  } catch (switchError) {
    if (switchError?.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: LITVM_LITEFORGE_NETWORK.chainIdHex,
            chainName: LITVM_LITEFORGE_NETWORK.name,
            nativeCurrency: { ...LITVM_LITEFORGE_NETWORK.nativeCurrency },
            rpcUrls: [LITVM_LITEFORGE_NETWORK.rpcUrls.http],
            blockExplorerUrls: [LITVM_LITEFORGE_NETWORK.explorerUrl],
          }],
        });
        await refreshInjectedChainId(provider);
        return connectedChainId === LITVM_LITEFORGE_NETWORK.chainIdHex;
      } catch (addError) {
        console.warn('LiteForge add-network request declined or failed.', addError);
      }
    } else {
      console.warn('LiteForge switch-network request declined or failed.', switchError);
    }
  }
  await refreshInjectedChainId(provider);
  return false;
}

async function connectWallet() {
  const provider = detectEthereumProvider();
  if (provider?.request) {
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const firstAccount = Array.isArray(accounts) ? accounts[0] : null;
      if (firstAccount) {
        connectedWallet = firstAccount.toLowerCase();
        walletConnector = 'injected-evm';
        await refreshInjectedChainId(provider);
        if (connectedChainId !== LITVM_LITEFORGE_NETWORK.chainIdHex) {
          await requestLiteForgeNetwork(provider);
        }
        connectPlayerAccount(state, connectedWallet, { handle: 'LitVM Pilot' });
        render();
        return connectedWallet;
      }
    } catch (error) {
      console.warn('Injected wallet connection declined or failed; using local mock fallback.', error);
    }
  }
  return connectMockWallet();
}

async function ensureWalletConnected() {
  if (connectedWallet) return connectedWallet;
  return connectWallet();
}

async function startMode(mode) {
  await ensureWalletConnected();
  const game = selectedGame();
  if (game.status !== 'playable') return;

  currentSession = startPlaySession({ wallet: connectedWallet, gameId: selectedGameId, mode });
  lastCompletedSession = null;
  lastRunResult = null;
  render();
}

async function completePrototypeRun() {
  await ensureWalletConnected();
  if (!currentSession) await startMode('free');

  const paidBoost = currentSession.isPaid ? 42 : 0;
  const elapsedSeconds = currentSession.isPaid ? 316 + (lastRunScore % 80) : 242 + (lastRunScore % 90);
  const bossRoll = scheduleBossEncounter({ elapsedSeconds, seed: lastRunScore + paidBoost });
  const score = simulateLesterBlasterRun({
    mode: currentSession.mode,
    entropy: Date.now() + lastRunScore + paidBoost,
    elapsedSeconds,
    kills: combat.kills || undefined,
    bossId: bossRoll.boss?.id,
    weaponId: combat.weaponId,
    scoreMultiplier: currentSession.isPaid ? 1.15 : 1,
  });

  const completedSession = currentSession;
  const result = recordScore(state, completedSession, score, {
    distanceMeters: Math.round(elapsedSeconds * 2.7),
    elapsedSeconds,
    kills: combat.kills,
    maxCombo: combat.maxCombo,
    bossId: bossRoll.boss?.id,
    weaponId: combat.weaponId,
  });

  lastRunScore = score;
  lastRunElapsedSeconds = elapsedSeconds;
  lastBossId = bossRoll.boss?.id ?? null;
  lastCompletedSession = completedSession;
  lastRunResult = {
    score,
    elapsedSeconds,
    acceptedForGlobalLeaderboard: result.acceptedForGlobalLeaderboard,
  };
  currentSession = null;
  render();
}

function renderLogin() {
  renderWalletRails();
  if (!connectedWallet) {
    dom.walletStatus.textContent = 'No wallet connected';
    dom.systemStatus.textContent = 'Connect an injected EVM wallet if available, or use the mock fallback, to create the parent Lester\'s Arcade account used by Hard Money Heroes.';
    return;
  }

  const snapshot = buildPlayerArcadeSnapshot(state, connectedWallet);
  dom.walletStatus.textContent = `${snapshot.profile.wallet.slice(0, 8)}…${snapshot.profile.wallet.slice(-6)}`;
  dom.systemStatus.textContent = `${snapshot.profile.handle} // ${snapshot.profile.rank} // XP ${snapshot.profile.xp} // ${walletConnector}`;
}

function renderParentOps() {
  const snapshot = connectedWallet ? buildPlayerArcadeSnapshot(state, connectedWallet) : null;

  dom.playerSummary.replaceChildren();
  const avatar = el('img', { src: './assets/lester-pilot.svg', alt: 'Pixel Lester pilot avatar' });
  const summaryText = el('div');
  appendText(summaryText, 'strong', snapshot?.profile.handle ?? 'Guest Player');
  appendText(summaryText, 'p', snapshot ? `${snapshot.profile.rank} · XP ${snapshot.profile.xp} · Paid ${snapshot.profile.totalPaidRuns} · Free ${snapshot.profile.totalFreeRuns}` : 'Connect a wallet to activate the parent account layer.');
  appendText(summaryText, 'p', 'Parent system owns: profile, progress, achievements, transactions, high scores, and cross-game routing.', 'tiny-note');
  dom.playerSummary.append(avatar, summaryText);

  dom.progressList.replaceChildren();
  const progressEntries = snapshot ? Object.values(snapshot.progress) : [];
  if (progressEntries.length === 0) {
    dom.progressList.append(emptyMini('No progress yet.'));
  } else {
    for (const progress of progressEntries) {
      const game = getGame(progress.gameId);
      const item = el('article', { className: 'mini-item' });
      appendText(item, 'strong', game.title);
      appendText(item, 'span', `Paid best ${progress.bestPaidScore.toLocaleString()} · Free best ${progress.bestFreeScore.toLocaleString()} · Longest ${formatSeconds(progress.longestRunSeconds)}`);
      dom.progressList.append(item);
    }
  }

  dom.achievementList.replaceChildren();
  const achievements = snapshot?.achievements ?? Object.values(ACHIEVEMENTS).map((achievement) => ({ ...achievement, unlocked: false }));
  for (const achievement of achievements) {
    const item = el('article', { className: `mini-item ${achievement.unlocked ? 'unlocked' : 'locked'}` });
    appendText(item, 'strong', `${achievement.unlocked ? '🏆' : '🔒'} ${achievement.title}`);
    appendText(item, 'span', achievement.description);
    dom.achievementList.append(item);
  }

  dom.transactionList.replaceChildren();
  if (!snapshot || snapshot.transactions.length === 0) {
    dom.transactionList.append(emptyMini('No paid transactions yet.'));
  } else {
    for (const transaction of snapshot.transactions.slice(-4).reverse()) {
      const item = el('article', { className: 'mini-item' });
      appendText(item, 'strong', `${formatMicroUsdc(transaction.amountMicroUsdc)} ${transaction.kind}`);
      appendText(item, 'span', `${getGame(transaction.gameId).title} · ${transaction.network ?? 'local simulation'} · ${transaction.simulatedTxHash ? transaction.simulatedTxHash.slice(0, 10) : 'no tx'}…`);
      appendText(item, 'small', `Parent writes: ${transaction.parentSync?.writeSets?.join(' / ') ?? 'pending'}`);
      dom.transactionList.append(item);
    }
  }

  dom.highScoreList.replaceChildren();
  if (!snapshot || snapshot.highScores.length === 0) {
    dom.highScoreList.append(emptyMini('No official high scores yet.'));
  } else {
    for (const highScore of snapshot.highScores.slice(0, 5)) {
      const item = el('article', { className: 'mini-item' });
      appendText(item, 'strong', `#${highScore.rank} ${highScore.score.toLocaleString()} pts`);
      appendText(item, 'span', `${highScore.gameTitle} · ${formatSeconds(highScore.runStats.elapsedSeconds ?? 0)} run`);
      dom.highScoreList.append(item);
    }
  }
}

function emptyMini(text) {
  const item = el('article', { className: 'mini-item' });
  appendText(item, 'span', text);
  return item;
}

function applyTooltipAttributes(guide) {
  for (const tooltip of guide.tooltips) {
    const target = dom[tooltip.anchor] ?? document.querySelector(`#${tooltip.anchor}`);
    if (!target) continue;
    target.title = `${tooltip.title}: ${tooltip.copy}`;
    target.dataset.tooltip = tooltip.copy;
    target.dataset.tooltipTitle = tooltip.title;
    target.classList.add('has-tooltip');
    if (!target.getAttribute('aria-label')) {
      target.setAttribute('aria-label', tooltip.title);
    }
  }
}

function renderUiQualityGuide() {
  const guide = buildUiQualityGuideModel({
    connected: Boolean(connectedWallet),
    selectedGameId,
    activeControl: combat.active ? 'combat-running' : currentSession?.mode ?? 'attract-mode',
  });

  applyTooltipAttributes(guide);
  dom.guideIntro.textContent = guide.connected
    ? 'Parent account is online. Follow the lit path from cabinet selection into paid/free play, combat controls, scoring, and official run sync.'
    : 'Start here: connect the mock wallet, pick a cabinet, choose free or paid mode, then use the combat guide to practice controls.';

  dom.quickStartGuide.replaceChildren();
  for (const step of guide.quickStart) {
    const card = el('article', { className: `guide-step ${step.state}` });
    appendText(card, 'span', step.iconSymbol, 'guide-icon');
    appendText(card, 'strong', `${step.number} ${step.title}`);
    appendText(card, 'p', step.copy);
    dom.quickStartGuide.append(card);
  }

  dom.instructionPanel.replaceChildren();
  for (const instruction of guide.instructions) {
    const item = el('article', { className: 'instruction-card' });
    appendText(item, 'strong', instruction.title);
    appendText(item, 'span', instruction.body);
    dom.instructionPanel.append(item);
  }

  dom.tooltipShelf.replaceChildren();
  appendText(dom.tooltipShelf, 'strong', 'Hover / focus hints', 'tooltip-heading');
  for (const tooltip of guide.tooltips.slice(0, 8)) {
    const item = el('article', { className: 'tooltip-card' });
    appendText(item, 'span', tooltip.title, 'label');
    appendText(item, 'p', tooltip.copy);
    dom.tooltipShelf.append(item);
  }

  dom.brandPalette.replaceChildren();
  for (const color of guide.brand.palette) {
    const swatch = el('article', { className: 'palette-swatch' });
    swatch.style.setProperty('--swatch', color.hex);
    appendText(swatch, 'span', color.name);
    appendText(swatch, 'strong', color.hex);
    appendText(swatch, 'small', color.usage);
    dom.brandPalette.append(swatch);
  }

  dom.patternList.replaceChildren();
  for (const pattern of guide.brand.patterns) {
    const card = el('article', { className: `pattern-card pattern-${pattern.id}` });
    appendText(card, 'strong', pattern.label);
    appendText(card, 'span', pattern.usage);
    dom.patternList.append(card);
  }

  dom.iconLegend.replaceChildren();
  for (const icon of guide.iconLegend) {
    const card = el('article', { className: 'icon-card' });
    appendText(card, 'strong', icon.symbol);
    appendText(card, 'span', icon.label);
    appendText(card, 'small', icon.tooltip);
    dom.iconLegend.append(card);
  }

  dom.qualityChecklist.replaceChildren();
  for (const item of guide.qualityChecklist) {
    const row = el('article', { className: `quality-row ${item.status}` });
    appendText(row, 'strong', item.badge);
    appendText(row, 'span', item.label);
    dom.qualityChecklist.append(row);
  }
}

function renderBuildStack() {
  const cards = [
    ['Current engine', LESTER_ARCADE_BUILD_STACK.currentPrototype.engine, `${LESTER_ARCADE_BUILD_STACK.currentPrototype.framework} — ${LESTER_ARCADE_BUILD_STACK.currentPrototype.reason}`],
    ['Recommended next', LESTER_ARCADE_BUILD_STACK.recommendedGameEngine.primary, 'Phaser or custom Canvas gives smooth 60fps browser gameplay while keeping wallet UX native to the dApp.'],
    ['Godot status', 'Optional later', LESTER_ARCADE_BUILD_STACK.recommendedGameEngine.note],
    ['Web3 rails', `LitVM + ${LESTER_ARCADE_BUILD_STACK.web3.smartContractAssistants.join(' + ')}`, LESTER_ARCADE_BUILD_STACK.web3.chainRole],
  ];
  dom.buildStackPanel.replaceChildren();
  for (const [label, value, copy] of cards) {
    const card = el('article', { className: 'stack-card' });
    appendText(card, 'span', label, 'label');
    appendText(card, 'strong', value);
    appendText(card, 'p', copy);
    dom.buildStackPanel.append(card);
  }
}

function renderMenuModel() {
  const model = buildLoginMenuModel({ connected: Boolean(connectedWallet), selectedGameId, wallet: connectedWallet });
  dom.menuModelPanel.replaceChildren();
  const login = el('article', { className: `menu-card ${model.login.state}` });
  appendText(login, 'strong', model.login.primaryAction);
  appendText(login, 'span', model.login.walletShort ?? 'Guest Mode');
  appendText(login, 'p', model.login.copy);
  dom.menuModelPanel.append(login);

  for (const item of model.menuItems) {
    const card = el('article', { className: `menu-card ${item.disabled ? 'disabled' : ''} ${item.active ? 'active' : ''}` });
    appendText(card, 'strong', item.title);
    appendText(card, 'p', item.description);
    dom.menuModelPanel.append(card);
  }
}

function selectGame(gameId) {
  selectedGameId = gameId;
  currentSession = null;
  lastCompletedSession = null;
  lastRunResult = null;
  render();
}

function renderCabinetStage() {
  dom.cabinetStage.replaceChildren();
  for (const game of cartridges) {
    const button = el('button', { className: `cabinet-button ${game.id === selectedGameId ? 'active' : ''}` });
    button.type = 'button';
    button.disabled = game.status !== 'playable';
    button.addEventListener('click', () => selectGame(game.id));
    button.append(
      el('img', { src: game.presentation.cabinetAsset, alt: `${game.title} arcade cabinet art` }),
      el('span', { textContent: `${game.cabinet ?? game.title} // ${game.status}` }),
    );
    dom.cabinetStage.append(button);
  }
}

function renderCartridges() {
  dom.cartridgeRack.replaceChildren();
  for (const cartridge of cartridges) {
    const card = el('button', { className: `cartridge-card ${cartridge.id === selectedGameId ? 'active' : ''} ${cartridge.status !== 'playable' ? 'locked' : ''}` });
    card.type = 'button';
    card.disabled = cartridge.status !== 'playable';
    card.addEventListener('click', () => selectGame(cartridge.id));
    card.append(
      el('img', { src: cartridge.presentation.cartridgeAsset, alt: `${cartridge.title} SNES-style cartridge` }),
      el('strong', { textContent: cartridge.title }),
      el('small', { textContent: `${cartridge.genre} · ${cartridge.systemRole}` }),
      el('span', { textContent: cartridge.tagline }),
    );
    dom.cartridgeRack.append(card);
  }
}

function renderSelectedGame() {
  const game = selectedGame();
  dom.selectedGameTitle.textContent = game.title;
  dom.selectedGameStatus.textContent = game.status;
  dom.selectedGameTagline.textContent = `${game.tagline} Parent system: ${game.parentSystem}. Role: ${game.systemRole}.`;
  dom.freePlayButton.disabled = game.status !== 'playable';
  dom.paidPlayButton.disabled = game.status !== 'playable';
  dom.simulateRunButton.disabled = game.status !== 'playable';
}

function renderLeaderboard() {
  const model = buildLeaderboardModel(state, { gameId: selectedGameId, wallet: connectedWallet });
  dom.leaderboardPanel.replaceChildren();
  appendText(dom.leaderboardPanel, 'h3', 'Official Paid Leaderboard');
  appendText(dom.leaderboardPanel, 'p', model.scoreFormula, 'tiny-note');
  if (model.topEntries.length === 0) {
    dom.leaderboardPanel.append(emptyMini('No paid scores yet. Complete a paid prototype run to sync here.'));
  } else {
    for (const entry of model.topEntries.slice(0, 4)) {
      const item = el('article', { className: 'leaderboard-entry' });
      appendText(item, 'strong', `#${entry.rank} ${entry.score.toLocaleString()}`);
      appendText(item, 'span', `${entry.wallet.slice(0, 8)}…${entry.wallet.slice(-6)} · ${formatSeconds(entry.runStats.elapsedSeconds ?? 0)} · boss ${entry.runStats.bossId ?? 'none'}`);
      dom.leaderboardPanel.append(item);
    }
  }
}

function renderDesignPanels() {
  const average = getLesterBlasterDifficultyAt(5 * 60);
  const master = getLesterBlasterDifficultyAt(18 * 60);
  const cards = [
    ['FPS target', `${LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps}`, `${LESTER_BLASTER_PERFORMANCE_TARGETS.frameBudgetMs}ms frame budget with fixed-timestep logic.`],
    ['Average run', `${LESTER_BLASTER_GAMEPLAY.targetAverageRunMinutes} min`, 'Normal players should reach the first major boss loop.'],
    ['Master run', `${LESTER_BLASTER_GAMEPLAY.veteranRunMinutes.join('–')} min`, 'Long-run survival becomes the high-score chase.'],
    ['5-min AI tier', `${average.enemyAiLevel}/10`, `At 18 min AI tier reaches ${master.enemyAiLevel}/10.`],
  ];
  dom.difficultyPanel.replaceChildren();
  for (const [label, value, detail] of cards) {
    const card = el('article', { className: 'stat-card' });
    appendText(card, 'span', label);
    appendText(card, 'strong', value);
    appendText(card, 'span', detail);
    dom.difficultyPanel.append(card);
  }

  dom.mechanicList.replaceChildren();
  const mechanics = [
    ...LESTER_BLASTER_GAMEPLAY.coreMoves,
    ...LESTER_BLASTER_GAMEPLAY.pickups,
    ...LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.map((weapon) => weapon.title),
    LESTER_BLASTER_WEAPON_SYSTEM.melee.title,
  ];
  for (const mechanic of mechanics) {
    dom.mechanicList.append(el('span', { textContent: mechanic }));
  }

  dom.bossRoster.replaceChildren();
  for (const [index, boss] of LESTER_BLASTER_BOSS_SYSTEM.bosses.entries()) {
    const card = el('article', { className: 'boss-card' });
    appendText(card, 'strong', `${String(index + 1).padStart(2, '0')} ${boss.title}`);
    appendText(card, 'span', `${boss.stages.length} stages · ${boss.attackPatterns.length} patterns · ${boss.superMoves.length} supers`);
    appendText(card, 'small', boss.specialty);
    dom.bossRoster.append(card);
  }
}

function renderControlScheme() {
  const controls = buildLesterBlasterControlDisplayModel();
  dom.controlSchemePanel.replaceChildren();
  for (const control of controls) {
    const item = el('article', { className: 'control-card' });
    appendText(item, 'strong', control.key);
    appendText(item, 'span', control.label);
    if (control.hint) appendText(item, 'small', control.hint);
    dom.controlSchemePanel.append(item);
  }
}

function renderCodexPanels() {
  const panels = [
    ['Canon', `${HARD_MONEY_HEROES_CANON.title} in ${HARD_MONEY_HEROES_CANON.world.name}: ${HARD_MONEY_HEROES_CANON.tone}. Lester is the main Rambo-like hero; Lilly is a future same-hitbox alternate.`],
    ['Economy + Modes', `${HARD_MONEY_HEROES_CANON.economy.freeModeRule} Paid entry = $${HARD_MONEY_HEROES_CANON.economy.paidEntryUsd.toFixed(2)}. Leaderboards: ${HARD_MONEY_HEROES_CANON.leaderboards.cadences.join(', ')}.`],
    ['Effects + Brand Guardrails', `Sparks always on. Gore default: ${HARD_MONEY_HEROES_CANON.gore.defaultMode}. Toggle before run: ${HARD_MONEY_HEROES_CANON.gore.toggleBeforeRun}. Litecoin references stay subtle; commercial logo/name-heavy/pay-to-play usage needs written sign-off.`],
    ['Characters', LESTER_BLASTER_CHARACTER_ROSTER.map((character) => `${character.title}: ${character.role}`).join(' // ')],
    ['Weapons', LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.map((weapon) => `${weapon.title} (${weapon.rarity})`).join(' // ')],
    ['Blade + Throwables', `${LESTER_BLASTER_WEAPON_SYSTEM.melee.title}; ${LESTER_BLASTER_WEAPON_SYSTEM.grenades.map((grenade) => grenade.title).join(', ')}`],
    ['Levels', LESTER_BLASTER_LEVEL_PLAN.map((level) => `${level.title} — ${level.mode}, ${level.verticality} verticality`).join(' // ')],
    ['Parallax Props', LESTER_BLASTER_ENVIRONMENTS.map((environment) => `${environment.title}: ${environment.props.slice(0, 3).join(', ')}`).join(' // ')],
    ['Enemies + AI', LESTER_BLASTER_ENEMY_CATALOG.map((enemy) => `${enemy.title}: ${enemy.attackPatterns.join('/')}`).join(' // ')],
    ['Blood + Death FX', `${LESTER_BLASTER_COMBAT_EFFECTS.blood.style}; ${Object.values(LESTER_BLASTER_COMBAT_EFFECTS.enemyDeathEffects).slice(0, 4).join(' // ')}`],
    ['Animations', `${LESTER_BLASTER_ANIMATION_PLAN.pixelArtDetail}; states: ${LESTER_BLASTER_ANIMATION_PLAN.playerStates.join(', ')}`],
    ['Sound + Music', LESTER_BLASTER_SOUND_DESIGN.musicTracks.map((track) => `${track.title} (${track.bpm} BPM)`).join(' // ')],
    ['Unlockables', LESTER_BLASTER_UNLOCKABLES.map((unlockable) => unlockable.title).join(' // ')],
  ];

  dom.codexPanels.replaceChildren();
  for (const [title, body] of panels) {
    const card = el('article', { className: 'codex-card' });
    appendText(card, 'h3', title);
    appendText(card, 'p', body);
    dom.codexPanels.append(card);
  }
}

async function startCombat() {
  combat.active = true;
  combat.startedAt = performance.now();
  combat.frame = 0;
  combat.elapsedGameSeconds = 0;
  combat.playerX = PLAYER_X;
  combat.playerY = GROUND_Y;
  combat.velocityX = 0;
  combat.velocityY = 0;
  combat.jumpsLeft = 2;
  combat.health = 100;
  combat.lives = currentSession?.isPaid ? 3 : 99;
  combat.score = 0;
  combat.kills = 0;
  combat.combo = 0;
  combat.maxCombo = 0;
  combat.damageCombo = 0;
  combat.maxDamageCombo = 0;
  combat.noDamageSeconds = 0;
  combat.invulnerableFrames = 0;
  combat.crouching = false;
  combat.crouchFrames = 0;
  combat.bullets = [];
  combat.enemyShots = [];
  combat.enemies = [];
  combat.particles = [];
  combat.floatingTexts = [];
  combat.powerUps = [];
  combat.powerUpsCollected = 0;
  combat.collectedPowerUpTypes = new Set();
  combat.grenades = currentSession?.isPaid ? 3 : 9;
  combat.ammo = Infinity;
  combat.weaponId = 'coin-blaster';
  combat.shots = 0;
  combat.meleeSwings = 0;
  combat.boss = null;
  combat.miniBossLock = false;
  combat.scrollLockReason = null;
  combat.scroll = 0;
  lastBossId = null;
  renderCombatSandboxStatus();
}

function jump() {
  if (combat.jumpsLeft > 0) {
    combat.velocityY = combat.jumpsLeft === 2 ? -12 : -10;
    combat.jumpsLeft -= 1;
    spawnText('JUMP', combat.playerX, combat.playerY - 70, '#19f7ff');
  }
}

function shoot() {
  const weapon = weaponById(combat.weaponId);
  if (Number.isFinite(combat.ammo)) {
    if (combat.ammo <= 0) {
      spawnText('RELOAD!', combat.playerX + 20, combat.playerY - 80, '#ff476f');
      return;
    }
    combat.ammo -= 1;
  }
  combat.shots += 1;
  const pellets = weapon.pellets ?? 1;
  const spread = pellets > 1 ? pellets : 1;
  for (let i = 0; i < spread; i += 1) {
    const offset = i - (spread - 1) / 2;
    combat.bullets.push({
      x: combat.playerX + 44,
      y: combat.playerY - 42 + offset * 5,
      vx: weapon.id === 'hash-rail' ? 15 : 10,
      vy: offset * 0.28,
      damage: weapon.damage,
      weaponId: weapon.id,
      ttl: weapon.id === 'hash-rail' ? 70 : 90,
    });
  }
  spawnMuzzleFlash(combat.playerX + 64, combat.playerY - 42, weapon.id);
}

function melee() {
  combat.meleeSwings += 1;
  spawnSlash(combat.playerX + 48, combat.playerY - 42);
  const meleeBox = {
    x: combat.playerX + 34,
    y: combat.playerY - 86,
    w: LESTER_BLASTER_WEAPON_SYSTEM.melee.rangePixels,
    h: 84,
  };
  for (const enemy of combat.enemies) {
    if (rectsOverlap(meleeBox, enemyHitbox(enemy))) {
      damageEnemy(enemy, LESTER_BLASTER_WEAPON_SYSTEM.melee.damage, 'knife');
    }
  }
  const bossBox = bossHitbox();
  if (bossBox && rectsOverlap(meleeBox, bossBox)) damageBoss(LESTER_BLASTER_WEAPON_SYSTEM.melee.damage, 'knife');
}

function grenade() {
  if (combat.grenades <= 0) return;
  combat.grenades -= 1;
  const blastBox = { x: combat.playerX + 52, y: GROUND_Y - 154, w: 304, h: 166 };
  for (const enemy of combat.enemies) {
    if (rectsOverlap(blastBox, enemyHitbox(enemy))) damageEnemy(enemy, 18, 'grenade');
  }
  const bossBox = bossHitbox();
  if (bossBox && rectsOverlap(blastBox, bossBox)) damageBoss(24, 'grenade');
  spawnExplosion(combat.playerX + 210, GROUND_Y - 35, '#ff7b2f');
}

function dropPowerUp() {
  const powerUp = LESTER_BLASTER_POWER_UPS[(combat.frame + combat.powerUps.length) % LESTER_BLASTER_POWER_UPS.length];
  combat.powerUps.push({ ...powerUp, x: combat.playerX + 220, y: GROUND_Y - 38, vy: -3, ttl: 480 });
  spawnText(powerUp.title, combat.playerX + 210, GROUND_Y - 74, '#ffe84d');
}

function reload() {
  const weapon = weaponById(combat.weaponId);
  if (weapon.ammo === 'infinite') return;
  combat.ammo = weapon.ammo;
  spawnText('RELOAD', combat.playerX + 20, combat.playerY - 80, '#45ff8a');
}

function updateCombatStep(stepMs) {
  if (!combat.active) return;
  const dt = stepMs / 1000;
  combat.frame += 1;
  combat.elapsedGameSeconds += dt * 18;
  combat.noDamageSeconds += dt * 18;
  combat.invulnerableFrames = Math.max(0, combat.invulnerableFrames - 1);

  combat.crouching = combat.keys.has('control') || combat.keys.has('s') || combat.keys.has('arrowdown');
  combat.crouchFrames = combat.crouching ? combat.crouchFrames + 1 : 0;
  const playerSpeed = combat.crouching ? 1.65 : 3.1;
  if (combat.keys.has('a') || combat.keys.has('arrowleft')) combat.playerX = Math.max(62, combat.playerX - playerSpeed);
  if (combat.keys.has('d') || combat.keys.has('arrowright')) combat.playerX = Math.min(214, combat.playerX + playerSpeed);

  combat.velocityY += 0.72;
  combat.playerY = Math.min(GROUND_Y, combat.playerY + combat.velocityY);
  if (combat.playerY >= GROUND_Y) {
    combat.jumpsLeft = 2;
    combat.velocityY = 0;
  }

  const difficulty = getLesterBlasterDifficultyAt(combat.elapsedGameSeconds);
  if (!combat.miniBossLock) combat.scroll += (2.2 + difficulty.tier * 0.16) * dt * 60;

  const spawnEvery = Math.max(28, Math.floor(80 / difficulty.enemySpawnMultiplier));
  if (combat.frame % spawnEvery === 0) spawnEnemy();
  if (combat.frame % 520 === 0 && combat.elapsedGameSeconds > 120) spawnMiniBoss();

  const bossRoll = scheduleBossEncounter({ elapsedSeconds: combat.elapsedGameSeconds, seed: Math.floor(combat.scroll) + combat.kills });
  if (bossRoll.shouldSpawn && bossRoll.boss && !combat.boss && lastBossId !== bossRoll.boss.id) spawnBoss(bossRoll.boss);

  updateBullets();
  updateEnemies(difficulty);
  updateBoss(difficulty);
  updatePowerUps();
  updateParticles(dt);
  updateFloatingTexts();

  const scoreModel = calculateLesterBlasterScore({
    elapsedSeconds: combat.elapsedGameSeconds,
    kills: combat.kills,
    maxKillCombo: combat.maxCombo,
    maxDamageCombo: combat.maxDamageCombo,
    noDamageSeconds: combat.noDamageSeconds,
    powerUpsCollected: combat.powerUpsCollected,
    weaponUpgrades: combat.weaponId === 'coin-blaster' ? [] : ['damage'],
    rareWeaponId: combat.weaponId === 'oracle-slayer' ? combat.weaponId : null,
    difficultyTier: difficulty.tier,
  });
  combat.score = scoreModel.total;
}

function spawnEnemy() {
  const spawn = chooseEnemySpawn({ elapsedSeconds: combat.elapsedGameSeconds, seed: combat.frame + combat.kills });
  const laneOffset = (combat.frame % 3) * 24;
  combat.enemies.push({
    ...spawn.enemy,
    x: 790,
    y: GROUND_Y - laneOffset,
    hp: spawn.scaledHealth,
    maxHp: spawn.scaledHealth,
    attackTimer: 30 + (combat.frame % 40),
    ai: spawn.ai,
    score: spawn.enemy.score,
    miniBoss: false,
  });
}

function spawnMiniBoss() {
  if (combat.boss || combat.enemies.some((enemy) => enemy.miniBoss)) return;
  combat.miniBossLock = true;
  combat.scrollLockReason = 'SCROLL LOCK // clear Dock Loader Mini-Boss to advance';
  combat.enemies.push({
    id: 'dock-loader-mech',
    title: 'Dock Loader Mini-Boss',
    class: 'mini-boss',
    x: 720,
    y: GROUND_Y,
    hp: 95,
    maxHp: 95,
    attackPatterns: ['forklift-charge', 'crate-lob', 'ground-pound'],
    deathEffect: 'huge orange explosion + loader parts',
    ai: { aggression: 1.7, fairnessTell: 'loader horn flash' },
    score: 900,
    miniBoss: true,
  });
  spawnText('SCROLL LOCK', 330, 110, '#ff476f');
}

function spawnBoss(bossData) {
  const canonicalBoss = LESTER_BLASTER_BOSS_SYSTEM.bosses.find((boss) => boss.id === bossData.id) ?? bossData;
  combat.boss = {
    ...bossData,
    x: 650,
    hp: 240,
    maxHp: 240,
    phase: 1,
    lastPhase: 1,
    attackTimer: 70,
    patterns: canonicalBoss.attackPatterns ?? [],
    superMoves: canonicalBoss.superMoves ?? [],
  };
  combat.miniBossLock = true;
  combat.scrollLockReason = `BOSS LOCK // defeat ${bossData.title}`;
  lastBossId = bossData.id;
  spawnText(`BOSS: ${bossData.title}`, 280, 95, '#ffe84d');
}

function updateBullets() {
  combat.bullets = combat.bullets
    .map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx, y: bullet.y + bullet.vy, ttl: bullet.ttl - 1 }))
    .filter((bullet) => bullet.x < 840 && bullet.ttl > 0);

  combat.enemyShots = combat.enemyShots
    .map((shot) => ({ ...shot, x: shot.x - shot.vx, y: shot.y + shot.vy, ttl: shot.ttl - 1 }))
    .filter((shot) => shot.x > -40 && shot.ttl > 0);

  const bossBox = bossHitbox();
  for (const bullet of combat.bullets) {
    const bulletBox = bulletHitbox(bullet);
    for (const enemy of combat.enemies) {
      if (rectsOverlap(bulletBox, enemyHitbox(enemy))) {
        damageEnemy(enemy, bullet.damage, bullet.weaponId);
        bullet.ttl = 0;
        break;
      }
    }
    if (bullet.ttl > 0 && bossBox && rectsOverlap(bulletBox, bossBox)) {
      damageBoss(bullet.damage, bullet.weaponId);
      bullet.ttl = 0;
    }
  }

  const playerBox = playerHitbox();
  for (const shot of combat.enemyShots) {
    if (combat.invulnerableFrames <= 0 && rectsOverlap(enemyShotHitbox(shot), playerBox)) {
      damagePlayer(shot.damage);
      shot.ttl = 0;
    }
  }
  combat.bullets = combat.bullets.filter((bullet) => bullet.x < 840 && bullet.ttl > 0);
  combat.enemyShots = combat.enemyShots.filter((shot) => shot.x > -40 && shot.ttl > 0);
}

function updateEnemies(difficulty) {
  const playerBox = playerHitbox();
  for (const enemy of combat.enemies) {
    const speed = enemy.miniBoss ? 0.35 : (1.25 + difficulty.enemyAiLevel * 0.1) * (enemy.speed ?? 1);
    enemy.x -= speed;
    enemy.attackTimer -= 1;
    if (combat.invulnerableFrames <= 0 && rectsOverlap(enemyHitbox(enemy), playerBox)) {
      damagePlayer(enemy.damage ?? (enemy.miniBoss ? 18 : 8));
      enemy.attackTimer = Math.max(enemy.attackTimer, 42);
    }
    if (enemy.attackTimer <= 0) {
      const ranged = enemy.attackPatterns?.some((pattern) => pattern.includes('throw') || pattern.includes('burst') || pattern.includes('spit') || pattern.includes('orb'));
      if (ranged) {
        combat.enemyShots.push({ x: enemy.x, y: enemy.y - 35, vx: 3.3 * difficulty.enemyProjectileSpeedMultiplier, vy: enemy.miniBoss ? -0.2 : 0, damage: enemy.damage ?? 9, ttl: 160 });
      } else if (combat.invulnerableFrames <= 0 && rectsOverlap(enemyHitbox(enemy), playerBox)) {
        damagePlayer(enemy.damage ?? 8);
      }
      enemy.attackTimer = Math.max(38, 110 - difficulty.enemyAiLevel * 7);
    }
  }

  for (const enemy of combat.enemies.filter((enemy) => enemy.hp <= 0)) {
    killEnemy(enemy);
  }
  combat.enemies = combat.enemies.filter((enemy) => enemy.hp > 0 && enemy.x > -120);
  if (combat.miniBossLock && !combat.boss && !combat.enemies.some((enemy) => enemy.miniBoss)) releaseScrollLock('arena clear');
}

function updateBoss(difficulty) {
  if (!combat.boss) return;
  combat.boss.x = 620 + Math.sin(combat.frame * 0.018) * (18 + combat.boss.phase * 6);
  const nextPhase = combat.boss.hp < combat.boss.maxHp * 0.33 ? 3 : combat.boss.hp < combat.boss.maxHp * 0.66 ? 2 : 1;
  if (nextPhase !== combat.boss.phase) {
    combat.boss.phase = nextPhase;
    combat.boss.lastPhase = nextPhase;
    combat.boss.attackTimer = 38;
    spawnText(`PHASE ${nextPhase}`, combat.boss.x - 8, GROUND_Y - 148, nextPhase === 3 ? '#ff236d' : '#ff7b2f');
    spawnExplosion(combat.boss.x + 46, GROUND_Y - 65, nextPhase === 3 ? '#ff236d' : '#ff7b2f');
  }
  combat.boss.attackTimer -= 1;
  if (combat.invulnerableFrames <= 0 && rectsOverlap(bossHitbox(), playerHitbox())) damagePlayer(14 + combat.boss.phase * 4);
  if (combat.boss.attackTimer <= 0) {
    const pattern = combat.boss.patterns[(combat.frame + combat.boss.phase) % combat.boss.patterns.length] ?? 'ranged-burst';
    const superMove = combat.boss.phase >= 2 && combat.frame % 3 === 0
      ? combat.boss.superMoves[(combat.frame + combat.boss.phase) % combat.boss.superMoves.length]
      : null;
    const shots = superMove ? 7 + combat.boss.phase : pattern.includes('sweep') || pattern.includes('bullet') ? 5 : 2 + combat.boss.phase;
    for (let i = 0; i < shots; i += 1) {
      combat.enemyShots.push({
        x: combat.boss.x + 8,
        y: GROUND_Y - 82 + (i - shots / 2) * (superMove ? 10 : 13),
        vx: 3.2 + difficulty.enemyProjectileSpeedMultiplier + combat.boss.phase * 0.24,
        vy: (i - shots / 2) * (superMove ? 0.16 : 0.1),
        damage: 10 + combat.boss.phase * 3 + (superMove ? 4 : 0),
        ttl: superMove ? 210 : 180,
      });
    }
    if (superMove) spawnText(`SUPER: ${superMove}`, combat.boss.x - 44, GROUND_Y - 132, '#ffe84d');
    if (combat.boss.phase === 3) spawnExplosion(combat.boss.x + 42, GROUND_Y - 55, '#ff236d');
    combat.boss.attackTimer = Math.max(38, 112 - difficulty.enemyAiLevel * 6);
  }
  if (combat.boss.hp <= 0) {
    const clearedBoss = combat.boss;
    spawnExplosion(combat.boss.x + 40, GROUND_Y - 60, '#ffe84d');
    spawnText('BOSS CLEAR +1500', combat.boss.x - 30, GROUND_Y - 140, '#45ff8a');
    combat.kills += 1;
    combat.combo += 1;
    combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
    combat.boss = null;
    releaseScrollLock(`${clearedBoss.title} defeated`);
    dropPowerUp();
  }
}

function updatePowerUps() {
  const playerBox = playerHitbox();
  for (const power of combat.powerUps) {
    power.vy += 0.18;
    power.y = Math.min(GROUND_Y - 20, power.y + power.vy);
    power.x -= 1.5;
    power.ttl -= 1;
    if (rectsOverlap(powerUpHitbox(power), playerBox)) {
      collectCombatPowerUp(power);
      power.ttl = 0;
    }
  }
  combat.powerUps = combat.powerUps.filter((power) => power.ttl > 0 && power.x > -40);
}

function updateParticles(dt) {
  for (const particle of combat.particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.16;
    particle.life -= dt;
    particle.size *= 0.985;
  }
  combat.particles = combat.particles.filter((particle) => particle.life > 0 && particle.size > 0.5);
}

function updateFloatingTexts() {
  for (const text of combat.floatingTexts) {
    text.y -= 0.7;
    text.life -= 1;
  }
  combat.floatingTexts = combat.floatingTexts.filter((text) => text.life > 0);
}

function damageEnemy(enemy, damage, source) {
  enemy.hp -= damage;
  combat.combo += 1;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  combat.damageCombo += damage;
  combat.maxDamageCombo = Math.max(combat.maxDamageCombo, combat.damageCombo);
  spawnBlood(enemy.x + 12, enemy.y - 30, source === 'knife' ? '#ff1f4f' : '#ff7b2f');
}

function damageBoss(damage, source) {
  combat.boss.hp -= damage;
  combat.combo += 1;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  combat.damageCombo += damage;
  combat.maxDamageCombo = Math.max(combat.maxDamageCombo, combat.damageCombo);
  spawnBlood(combat.boss.x + 40, GROUND_Y - 70, source === 'hash-rail' ? '#19f7ff' : '#ff236d');
}

function damagePlayer(damage) {
  if (combat.invulnerableFrames > 0 || damage <= 0) return false;
  combat.health -= damage;
  combat.combo = 0;
  combat.damageCombo = 0;
  combat.noDamageSeconds = 0;
  combat.invulnerableFrames = 72;
  spawnText(`-${damage} HP`, combat.playerX, combat.playerY - 80, '#ff476f');
  spawnBlood(combat.playerX + 12, combat.playerY - 40, '#ff476f');
  if (combat.health <= 0) {
    combat.lives -= 1;
    if (combat.lives <= 0) {
      combat.active = false;
      dom.combatRunStatus.textContent = 'Local combat sandbox ended';
      dom.combatStatus.textContent = `Practice result: ${combat.score.toLocaleString()} score, ${combat.kills} kills, ${formatSeconds(combat.elapsedGameSeconds)} survived. Official run state above remains unchanged.`;
    } else {
      combat.health = 100;
      combat.invulnerableFrames = 120;
      spawnText(`+LIFE ${combat.lives}`, combat.playerX, combat.playerY - 96, '#45ff8a');
    }
  }
  return true;
}

function killEnemy(enemy) {
  combat.kills += 1;
  combat.combo += 2;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  spawnText(`+${enemy.score ?? 100}`, enemy.x, enemy.y - 70, '#ffe84d');
  spawnExplosion(enemy.x + 12, enemy.y - 28, enemy.miniBoss ? '#ff7b2f' : '#ff476f');
  if (enemy.miniBoss) {
    dropPowerUp();
    releaseScrollLock(`${enemy.title} defeated`);
  }
}

function collectCombatPowerUp(power) {
  combat.powerUpsCollected += 1;
  combat.collectedPowerUpTypes.add(power.id ?? power.effect ?? power.title);
  if (power.effect === 'heal') combat.health = Math.min(100, combat.health + power.amount);
  if (power.effect === 'grenades') combat.grenades += power.amount;
  if (power.effect === 'life') combat.lives += 1;
  if (power.effect === 'weapon') {
    combat.weaponId = power.weaponId;
    const weapon = weaponById(power.weaponId);
    combat.ammo = weapon.ammo === 'infinite' || weapon.ammo === 'timed upgrade' ? Infinity : weapon.ammo;
  }
  if (power.effect === 'ammo') combat.ammo = Number.isFinite(combat.ammo) ? combat.ammo + power.amount : combat.ammo;
  if (power.effect === 'shield') {
    combat.health = Math.min(125, combat.health + power.amount * 15);
    combat.invulnerableFrames = Math.max(combat.invulnerableFrames, 180);
  }
  if (power.effect === 'scoreMultiplier') spawnText('2X SCORE', power.x, power.y - 20, '#ffe84d');
  spawnText(power.title, power.x, power.y - 28, '#45ff8a');
}

function spawnMuzzleFlash(x, y, weaponId) {
  combat.particles.push({ x, y, vx: 1.2, vy: -0.2, color: weaponId === 'hash-rail' ? '#19f7ff' : '#ffe84d', size: weaponId === 'scatter-shotgun' ? 12 : 8, life: 0.22 });
  for (let i = 0; i < 3; i += 1) combat.particles.push({ x: x - 8, y: y + 5, vx: -1 - i * 0.2, vy: 1 + i * 0.15, color: '#c78c48', size: 2, life: 0.55 });
}

function spawnSlash(x, y) {
  for (let i = 0; i < 7; i += 1) combat.particles.push({ x: x + i * 4, y: y - i * 2, vx: 1.4, vy: -0.4, color: i % 2 ? '#f9f7ff' : '#ff7b2f', size: 4, life: 0.25 });
}

function spawnBlood(x, y, color) {
  for (let i = 0; i < 9; i += 1) combat.particles.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3, color, size: 2 + Math.random() * 3, life: 0.65 + Math.random() * 0.3 });
}

function spawnExplosion(x, y, color) {
  for (let i = 0; i < 18; i += 1) combat.particles.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.7) * 5, color: i % 3 ? color : '#f9f7ff', size: 3 + Math.random() * 6, life: 0.8 + Math.random() * 0.35 });
}

function spawnText(text, x, y, color) {
  combat.floatingTexts.push({ text, x, y, color, life: 70 });
}

function drawCombatScene(timestamp = 0) {
  const canvas = dom.combatCanvas;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  if (!combat.lastTimestamp) combat.lastTimestamp = timestamp;
  const delta = Math.min(66, timestamp - combat.lastTimestamp);
  combat.lastTimestamp = timestamp;
  combat.accumulatorMs += delta;
  combat.frameTimes.push(delta || FIXED_STEP_MS);
  if (combat.frameTimes.length > 45) combat.frameTimes.shift();
  const avgFrame = combat.frameTimes.reduce((sum, frame) => sum + frame, 0) / combat.frameTimes.length;
  combat.fps = Math.round(1000 / Math.max(avgFrame, 1));
  if (dom.fpsPill) dom.fpsPill.textContent = `${combat.fps}fps / target ${LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps}`;

  while (combat.accumulatorMs >= FIXED_STEP_MS) {
    updateCombatStep(FIXED_STEP_MS);
    combat.accumulatorMs -= FIXED_STEP_MS;
  }

  drawBackground(ctx, width, height);
  drawProps(ctx);
  drawPowerUps(ctx);
  drawEnemies(ctx);
  drawBoss(ctx);
  drawBullets(ctx);
  drawPlayer(ctx);
  drawParticles(ctx);
  drawFloatingTexts(ctx);
  drawHud(ctx);

  requestAnimationFrame(drawCombatScene);
}

function drawParallaxAssetLayer(ctx, layer, width) {
  if (!imageReady(layer.image)) return false;
  const scaledWidth = width * 1.35;
  const offset = -((combat.scroll * layer.speed) % scaledWidth);
  for (let x = offset - scaledWidth; x < width + scaledWidth; x += scaledWidth) {
    ctx.drawImage(layer.image, x, layer.y, scaledWidth, layer.h);
  }
  return true;
}

function drawBackground(ctx, width, height) {
  const level = currentLevel();
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, level.id.includes('metro') ? '#071a2e' : level.id.includes('finality') ? '#180525' : '#06142e');
  gradient.addColorStop(0.58, '#12072d');
  gradient.addColorStop(1, '#030711');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const generatedLayers = combatArt.parallax[level.id] ?? combatArt.parallax['level-the-slums'];
  const drewGeneratedArt = generatedLayers?.every((layer) => drawParallaxAssetLayer(ctx, layer, width));

  if (!drewGeneratedArt) {
    for (const [index, layer] of level.parallaxLayers.entries()) {
      const y = 56 + index * 46;
      const size = 26 + index * 10;
      ctx.fillStyle = ['rgba(25,247,255,.16)', 'rgba(69,255,138,.18)', 'rgba(255,232,77,.16)', 'rgba(255,71,111,.22)'][index % 4];
      for (let i = -1; i < 12; i += 1) {
        const x = ((i * 112) - combat.scroll * layer.speed) % (width + 140);
        ctx.fillRect(x, y + (i % 2) * 12, size, 14 + index * 3);
        if (index === 2) ctx.fillRect(x + 12, y - 18, 10, 18);
      }
    }
  }

  ctx.fillStyle = '#101827';
  ctx.fillRect(0, GROUND_Y + 34, width, height - GROUND_Y - 34);
  ctx.fillStyle = '#1a2440';
  ctx.fillRect(0, GROUND_Y + 8, width, 34);
  ctx.fillStyle = '#ffe84d';
  for (let x = -80; x < width + 120; x += 80) {
    ctx.fillRect((x - combat.scroll * 1.2) % (width + 80), GROUND_Y + 46, 42, 6);
  }

  ctx.font = '12px monospace';
  ctx.fillStyle = '#19f7ff';
  ctx.fillText(level.title.toUpperCase(), 20, height - 18);
  if (combat.miniBossLock) {
    ctx.fillStyle = 'rgba(255,71,111,.14)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ff476f';
    ctx.fillText(combat.scrollLockReason ?? 'SCROLL LOCK UNTIL MINI-BOSS / BOSS DEFEATED', 230, 28);
  }
}

function drawProps(ctx) {
  const environment = LESTER_BLASTER_ENVIRONMENTS[Math.min(LESTER_BLASTER_ENVIRONMENTS.length - 1, Math.floor((combat.elapsedGameSeconds / 60) / 4))];
  ctx.font = '11px monospace';
  for (let i = 0; i < environment.props.length; i += 1) {
    const x = ((i * 190 + 240) - combat.scroll * 0.96) % 900;
    ctx.fillStyle = i % 2 ? '#24304f' : '#2d1a46';
    ctx.fillRect(x, GROUND_Y - 34 - (i % 3) * 12, 48, 42 + (i % 3) * 12);
    ctx.fillStyle = '#19f7ff';
    ctx.fillText(environment.props[i].slice(0, 9).toUpperCase(), x + 4, GROUND_Y - 10);
  }
}

function selectHeroFrame() {
  const hero = combatArt.hero;
  if (combat.playerY < GROUND_Y - 4) return selectAnimationFrame(hero.animations.jump, combat.frame, 12, false) ?? hero.fallback.jump;
  if (combat.crouching && combat.playerY >= GROUND_Y - 2) return selectAnimationFrame(hero.animations.idle, combat.frame, 8) ?? hero.fallback.idle;
  if (combat.meleeSwings > 0 && combat.frame - combat.meleeSwings < 18) return hero.fallback.blade;
  if (combat.shots > 0 && combat.frame % 36 < 10) return hero.stills.shoot ?? hero.fallback.shoot;
  if (combat.keys.has('a') || combat.keys.has('d') || combat.keys.has('arrowleft') || combat.keys.has('arrowright')) {
    return selectAnimationFrame(hero.animations.run, combat.frame, 14) ?? (combat.frame % 20 < 10 ? hero.fallback.run1 : hero.fallback.run2);
  }
  return selectAnimationFrame(hero.animations.idle, combat.frame, 8) ?? hero.fallback.idle;
}

function playerFacingLeft() {
  const left = combat.keys.has('a') || combat.keys.has('arrowleft');
  const right = combat.keys.has('d') || combat.keys.has('arrowright');
  return left && !right;
}

function drawPlayer(ctx) {
  const x = combat.playerX;
  const y = combat.playerY;
  const bob = combat.active ? Math.sin(combat.frame * 0.28) * 2 : 0;
  const heroFrame = selectHeroFrame();
  const blink = combat.invulnerableFrames > 0 && Math.floor(combat.invulnerableFrames / 6) % 2 === 0;
  ctx.save();
  if (blink) ctx.globalAlpha = 0.54;
  if (imageReady(heroFrame)) {
    const drawWidth = 104;
    const drawHeight = 104;
    const drawX = x - 34;
    const drawY = y - drawHeight + bob;
    if (playerFacingLeft()) {
      ctx.translate(drawX + drawWidth / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(heroFrame, -drawWidth / 2, drawY, drawWidth, drawHeight);
    } else {
      ctx.drawImage(heroFrame, drawX, drawY, drawWidth, drawHeight);
    }
    ctx.fillStyle = '#f9f7ff';
    ctx.fillRect(x + 3, GROUND_Y + 2, 38, 8);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#ff7b2f';
  ctx.fillRect(x, y - 55 + bob, 36, 36);
  ctx.fillStyle = '#ffe84d';
  ctx.fillRect(x + 6, y - 66 + bob, 23, 15);
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 22, y - 62 + bob, 6, 4);
  ctx.fillStyle = '#19f7ff';
  ctx.fillRect(x + 7, y - 42 + bob, 20, 6);
  ctx.fillStyle = combat.weaponId === 'hash-rail' ? '#19f7ff' : combat.weaponId === 'oracle-slayer' ? '#b86cff' : '#45ff8a';
  ctx.fillRect(x + 31, y - 43 + bob, 38, 8);
  ctx.fillStyle = '#f9f7ff';
  ctx.fillRect(x + 3, GROUND_Y + 2, 38, 8);
  ctx.fillStyle = '#ff476f';
  ctx.fillRect(x + 37, y - 34 + bob, 16, 4);
  ctx.restore();
}

function enemyArtFor(enemy) {
  if (enemy.miniBoss) return null;
  if (enemy.id?.includes('goblin')) return combatArt.enemies.goblin;
  if (enemy.id?.includes('wisp') || enemy.class?.includes('flying')) return combatArt.enemies.wisp;
  if (enemy.id?.includes('scam') || enemy.id?.includes('bot')) return combatArt.enemies.scambot;
  if (enemy.class === 'armored' || enemy.id?.includes('bruiser')) return combatArt.enemies.bruiser;
  return combatArt.enemies.goblin;
}

function drawEnemies(ctx) {
  for (const enemy of combat.enemies) {
    const isMini = enemy.miniBoss;
    const w = isMini ? 68 : enemy.class === 'armored' ? 42 : 30;
    const h = isMini ? 62 : enemy.class?.includes('flying') ? 28 : 36;
    const enemyFrame = enemyArtFor(enemy);
    if (imageReady(enemyFrame)) {
      ctx.drawImage(enemyFrame, enemy.x - 20, enemy.y - h - 36, 78, 78);
    } else {
      ctx.fillStyle = isMini ? '#ff7b2f' : enemy.class?.includes('flying') ? '#6d3cff' : enemy.class === 'armored' ? '#aab6d3' : '#ff476f';
      ctx.fillRect(enemy.x, enemy.y - h, w, h);
      ctx.fillStyle = '#080616';
      ctx.fillRect(enemy.x + 6, enemy.y - h + 9, 7, 7);
    }
    ctx.fillStyle = '#45ff8a';
    ctx.fillRect(enemy.x, enemy.y - h - 8, w * Math.max(0, enemy.hp / enemy.maxHp), 4);
    if (enemy.attackTimer < 18) {
      ctx.fillStyle = '#ffe84d';
      ctx.fillRect(enemy.x - 3, enemy.y - h - 15, w + 6, 4);
    }
  }
}

function drawBoss(ctx) {
  if (!combat.boss) return;
  const x = combat.boss.x;
  ctx.fillStyle = combat.boss.phase === 3 ? '#ff236d' : combat.boss.phase === 2 ? '#ff7b2f' : '#7b2fff';
  ctx.fillRect(x, GROUND_Y - 108, 94, 90);
  ctx.fillStyle = '#ffe84d';
  ctx.fillRect(x + 12, GROUND_Y - 130, 68, 18);
  ctx.fillStyle = '#45ff8a';
  ctx.fillRect(x, GROUND_Y - 143, 94 * Math.max(0, combat.boss.hp / combat.boss.maxHp), 6);
  ctx.fillStyle = '#f9f7ff';
  ctx.font = '12px monospace';
  ctx.fillText(`${combat.boss.title} P${combat.boss.phase}`, x - 24, GROUND_Y - 154);
}

function drawBullets(ctx) {
  for (const bullet of combat.bullets) {
    ctx.fillStyle = bullet.weaponId === 'hash-rail' ? '#19f7ff' : bullet.weaponId === 'oracle-slayer' ? '#b86cff' : '#ffe84d';
    ctx.fillRect(bullet.x, bullet.y, bullet.weaponId === 'hash-rail' ? 34 : 20, bullet.weaponId === 'hash-rail' ? 7 : 5);
  }
  ctx.fillStyle = '#ff476f';
  for (const shot of combat.enemyShots) ctx.fillRect(shot.x, shot.y, 14, 5);
}

function powerUpIconFor(power) {
  if (power.effect === 'heal') return combatArt.icons.health;
  if (power.effect === 'shield') return combatArt.icons.shield;
  if (power.effect === 'ammo') return combatArt.icons.ammo;
  if (power.effect === 'life') return combatArt.icons.oneUp;
  if (power.effect === 'weapon') return combatArt.icons.weapon;
  if (power.effect === 'scoreMultiplier') return combatArt.icons.score;
  return null;
}

function drawPowerUps(ctx) {
  for (const power of combat.powerUps) {
    const icon = powerUpIconFor(power);
    if (imageReady(icon)) {
      ctx.drawImage(icon, power.x - 8, power.y - 30, 40, 40);
    } else {
      ctx.fillStyle = power.effect === 'heal' ? '#45ff8a' : power.effect === 'weapon' ? '#19f7ff' : power.effect === 'life' ? '#ffe84d' : '#ff7b2f';
      ctx.fillRect(power.x, power.y - 16, 24, 24);
      ctx.fillStyle = '#080616';
      ctx.fillText(power.title.slice(0, 2).toUpperCase(), power.x + 4, power.y - 1);
    }
  }
}

function drawParticles(ctx) {
  for (const particle of combat.particles) {
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
}

function drawFloatingTexts(ctx) {
  ctx.font = '12px monospace';
  for (const text of combat.floatingTexts) {
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
}

function drawHud(ctx) {
  const difficulty = getLesterBlasterDifficultyAt(combat.elapsedGameSeconds);
  const weapon = weaponById(combat.weaponId);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#19f7ff';
  ctx.fillText(`RUN ${formatSeconds(combat.elapsedGameSeconds)} // AI ${difficulty.enemyAiLevel}/10 // TIER ${difficulty.tier} // ${combat.fps}FPS`, 20, 28);
  ctx.fillStyle = '#ffe84d';
  ctx.fillText(`HP ${Math.max(0, Math.round(combat.health))} // LIVES ${combat.lives} // SCORE ${combat.score.toLocaleString()} // COMBO ${combat.combo}`, 20, 52);
  ctx.fillStyle = '#45ff8a';
  ctx.fillText(`${weapon.title.toUpperCase()} // AMMO ${combat.ammo === Infinity ? '∞' : combat.ammo} // GRENADES ${combat.grenades}`, 20, 76);
  ctx.fillStyle = '#ff7b2f';
  ctx.fillText(`DMG CHAIN ${combat.maxDamageCombo} // PICKUPS ${combat.powerUpsCollected} // I-FRAMES ${combat.invulnerableFrames}`, 20, 100);
}

function render() {
  renderFlowSteps();
  renderLogin();
  renderUiQualityGuide();
  renderParentOps();
  renderBuildStack();
  renderMenuModel();
  renderCabinetStage();
  renderCartridges();
  renderSelectedGame();
  renderOfficialRunStatus();
  renderCombatSandboxStatus();
  renderLeaderboard();
  renderDesignPanels();
  renderControlScheme();
  renderCodexPanels();
  renderOfficialApp();
}

dom.officialConnectButton.addEventListener('click', connectOfficialWallet);
dom.developerBackstageToggle.addEventListener('click', () => {
  developerBackstageOpen = !developerBackstageOpen;
  renderOfficialApp();
});
dom.officialFreeModeButton.addEventListener('click', () => startOfficialMode('free'));
dom.officialRankedModeButton.addEventListener('click', () => startOfficialMode('ranked'));
dom.officialBeginLevelButton.addEventListener('click', beginOfficialLevel);

dom.connectWalletButton.addEventListener('click', connectWallet);
dom.freePlayButton.addEventListener('click', () => startMode('free'));
dom.paidPlayButton.addEventListener('click', () => startMode('paid'));
dom.simulateRunButton.addEventListener('click', completePrototypeRun);
dom.startCombatButton.addEventListener('click', startCombat);
dom.jumpButton.addEventListener('click', jump);
dom.shootButton.addEventListener('click', shoot);
dom.meleeButton.addEventListener('click', melee);
dom.grenadeButton.addEventListener('click', grenade);
dom.powerUpButton.addEventListener('click', dropPowerUp);

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (event.code === 'Space') {
    event.preventDefault();
    jump();
  }
  if (key === 'e') melee();
  if (key === 'f') grenade();
  if (key === 'r') reload();
  if (['a', 'd', 's', 'arrowleft', 'arrowright', 'arrowdown', 'control'].includes(key)) {
    event.preventDefault();
    combat.keys.add(key);
  }
});

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (['a', 'd', 's', 'arrowleft', 'arrowright', 'arrowdown', 'control'].includes(key)) combat.keys.delete(key);
});

dom.combatCanvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

dom.combatCanvas.addEventListener('mousedown', (event) => {
  if (event.button === 0) shoot();
  if (event.button === 2) {
    event.preventDefault();
    melee();
  }
});

const injectedProvider = detectEthereumProvider();
if (injectedProvider?.on) {
  injectedProvider.on('chainChanged', (chainId) => {
    if (walletConnector === 'injected-evm') {
      connectedChainId = chainId;
      render();
    }
  });
  injectedProvider.on('accountsChanged', (accounts = []) => {
    const nextWallet = Array.isArray(accounts) ? accounts[0] : null;
    if (nextWallet) {
      connectedWallet = nextWallet.toLowerCase();
      walletConnector = 'injected-evm';
      connectPlayerAccount(state, connectedWallet, { handle: 'LitVM Pilot' });
    } else if (walletConnector === 'injected-evm') {
      connectedWallet = null;
      connectedChainId = null;
      walletConnector = 'none';
    }
    render();
  });
}

render();
requestAnimationFrame(drawCombatScene);
