import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_HD_SPRITE_ATLAS_MANIFEST } from '../apps/portal/assets/generated/hmh-hd-sprite-atlas.mjs';

import {
  ACHIEVEMENTS,
  ARCADE_GAMES,
  DEFAULT_REVENUE_SPLIT_BPS,
  HARD_MONEY_HEROES_CANON,
  LESTER_ARCADE_BRAND_SYSTEM,
  LESTER_ARCADE_BUILD_STACK,
  LESTER_ARCADE_UI_QUALITY_SYSTEM,
  LESTER_ARCADE_WALLET_RAILS,
  LESTERS_ARCADE_V2_APP_SHELL,
  LESTER_BLASTER_ANIMATION_PLAN,
  LITVM_LITEFORGE_NETWORK,
  LESTER_BLASTER_BOSS_SYSTEM,
  LESTER_BLASTER_CHARACTER_ROSTER,
  LESTER_BLASTER_COMBAT_EFFECTS,
  LESTER_BLASTER_CONTROL_SCHEME,
  LESTER_BLASTER_ART_REDO_BRIEF,
  LESTER_BLASTER_AUDIO_ASSET_PLAN,
  LESTER_BLASTER_ENEMY_CATALOG,
  LESTER_BLASTER_ENVIRONMENTS,
  LESTER_BLASTER_GAMEPLAY,
  LESTER_BLASTER_HD_SPRITE_ATLAS,
  LESTER_BLASTER_LEVEL_PLAN,
  LESTER_BLASTER_MENU_OPTIONS,
  LESTER_BLASTER_PERFORMANCE_TARGETS,
  LESTER_BLASTER_SOUND_DESIGN,
  LESTER_BLASTER_TACTICAL_COMBAT_V2,
  LESTER_BLASTER_UNLOCKABLES,
  LESTER_BLASTER_WEAPON_SYSTEM,
  applyPowerUp,
  buildLeaderboardModel,
  buildLesterBlasterControlDisplayModel,
  buildCombatSandboxStatusModel,
  buildLesterBlasterDesignCodex,
  buildLoginMenuModel,
  buildOfficialRunStatusModel,
  buildParentSyncPacket,
  buildPlayerArcadeSnapshot,
  buildRunLoadout,
  buildUiQualityGuideModel,
  buildWalletConnectionModel,
  calculateLesterBlasterScore,
  calculateRevenueSplit,
  chooseEnemySpawn,
  connectPlayerAccount,
  createCombatRunState,
  createInitialArcadeState,
  createPlayerProfile,
  getCartridgeSelectModel,
  getLesterBlasterDifficultyAt,
  recordScore,
  resolveAchievementUnlocksForRun,
  scheduleBossEncounter,
  startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';

test('createPlayerProfile normalizes EVM wallets and creates a Lester profile shell', () => {
  const profile = createPlayerProfile('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD');

  assert.equal(profile.wallet, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(profile.handle, 'Player ABCD');
  assert.equal(profile.creditsLabel, '0.25 USDC paid runs unlock global boards');
  assert.deepEqual(profile.achievements, []);
});

test('connectPlayerAccount creates the parent account system used across every cabinet dapp', () => {
  const state = createInitialArcadeState();
  const wallet = '0x1111111111111111111111111111111111111111';

  const account = connectPlayerAccount(state, wallet, { handle: 'LitecoinRunner' });
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);

  assert.equal(account.profile.handle, 'LitecoinRunner');
  assert.equal(account.systemRole, 'parent-arcade-account');
  assert.equal(snapshot.profile.wallet, wallet);
  assert.equal(snapshot.progress['lester-blaster'].bestPaidScore, 0);
  assert.equal(snapshot.progress['lester-blaster'].bestFreeScore, 0);
  assert.deepEqual(snapshot.transactions, []);
  assert.equal(snapshot.achievements.some((achievement) => achievement.id === ACHIEVEMENTS.CABINET_PIONEER.id && achievement.unlocked), true);
});

test('wallet connection model exposes injected EVM, mock fallback, LitVM LiteForge target, and parent-account sync permissions', () => {
  const guest = buildWalletConnectionModel({ providerAvailable: false });
  const ready = buildWalletConnectionModel({ providerAvailable: true });
  const connectedRightChain = buildWalletConnectionModel({
    providerAvailable: true,
    wallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    chainId: '0x1159',
  });
  const connectedDecimalChain = buildWalletConnectionModel({
    providerAvailable: true,
    wallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    chainId: 4441,
  });
  const connectedWrongChain = buildWalletConnectionModel({
    providerAvailable: true,
    wallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    chainId: '0xaa36a7',
  });

  assert.equal(LITVM_LITEFORGE_NETWORK.name, 'LitVM LiteForge');
  assert.equal(LITVM_LITEFORGE_NETWORK.chainId, 4441);
  assert.equal(LITVM_LITEFORGE_NETWORK.chainIdHex, '0x1159');
  assert.equal(LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol, 'zkLTC');
  assert.equal(LITVM_LITEFORGE_NETWORK.rpcUrls.http, 'https://liteforge.rpc.caldera.xyz/http');
  assert.equal(LITVM_LITEFORGE_NETWORK.rpcUrls.websocket, 'wss://liteforge.rpc.caldera.xyz/ws');
  assert.equal(LITVM_LITEFORGE_NETWORK.explorerUrl, 'https://liteforge.explorer.caldera.xyz');
  assert.equal(LITVM_LITEFORGE_NETWORK.faucetUrl, 'https://liteforge.hub.caldera.xyz');
  assert.equal(LITVM_LITEFORGE_NETWORK.portalUrl, 'https://testnet.litvm.com');
  assert.equal(LESTER_ARCADE_WALLET_RAILS.targetNetwork, 'LitVM LiteForge');
  assert.equal(LESTER_ARCADE_WALLET_RAILS.targetChainId, 4441);
  assert.equal(LESTER_ARCADE_WALLET_RAILS.targetChainIdHex, '0x1159');
  assert.equal(LESTER_ARCADE_WALLET_RAILS.nativeGasToken, 'zkLTC');
  assert.equal(guest.status, 'mock-ready');
  assert.equal(guest.chainGuard.status, 'mock-fallback');
  assert.equal(ready.status, 'ready');
  assert.equal(ready.chainGuard.status, 'needs-wallet-connection');
  assert.equal(guest.connectors.some((connector) => connector.id === 'mock-wallet' && connector.safeForPrototype), true);
  assert.equal(guest.connectors.some((connector) => connector.id === 'injected-evm' && connector.available === false), true);
  assert.equal(ready.connectors.some((connector) => connector.id === 'injected-evm' && connector.recommended), true);
  assert.deepEqual(guest.permissions.writeScopes, ['paid sessions', 'profile progress', 'achievements', 'official scores', 'transaction receipts']);
  assert.equal(connectedRightChain.status, 'connected-valid-chain');
  assert.equal(connectedRightChain.wallet, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(connectedRightChain.walletShort, '0xabcdef…efabcd');
  assert.equal(connectedRightChain.chainGuard.expectedNetwork, 'LitVM LiteForge');
  assert.equal(connectedRightChain.chainGuard.expectedChainId, 4441);
  assert.equal(connectedRightChain.chainGuard.expectedChainIdHex, '0x1159');
  assert.equal(connectedRightChain.chainGuard.currentChainId, '0x1159');
  assert.equal(connectedRightChain.chainGuard.status, 'right-chain');
  assert.equal(connectedRightChain.chainGuard.switchMethod, 'wallet_switchEthereumChain');
  assert.equal(connectedRightChain.chainGuard.addMethod, 'wallet_addEthereumChain');
  assert.deepEqual(connectedRightChain.chainGuard.addEthereumChainParams, {
    chainId: '0x1159',
    chainName: 'LitVM LiteForge',
    nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 },
    rpcUrls: ['https://liteforge.rpc.caldera.xyz/http'],
    blockExplorerUrls: ['https://liteforge.explorer.caldera.xyz'],
  });
  assert.equal(connectedRightChain.chainGuard.faucetUrl, 'https://liteforge.hub.caldera.xyz');
  assert.equal(connectedRightChain.chainGuard.explorerUrl, 'https://liteforge.explorer.caldera.xyz');
  assert.equal(connectedDecimalChain.status, 'connected-valid-chain');
  assert.equal(connectedDecimalChain.chainGuard.currentChainId, '0x1159');
  assert.equal(connectedWrongChain.status, 'connected-wrong-chain');
  assert.equal(connectedWrongChain.chainGuard.status, 'wrong-chain');
  assert.match(connectedWrongChain.chainGuard.copy, /Switch or add LitVM LiteForge/);
  assert.match(connectedWrongChain.chainGuard.copy, /Expected Chain ID 4441 \(0x1159\)/);
});

test('free mode session is playable but not global-leaderboard eligible', () => {
  const session = startPlaySession({ wallet: '0x1111111111111111111111111111111111111111', gameId: 'lester-blaster', mode: 'free' });

  assert.equal(session.isPaid, false);
  assert.equal(session.leaderboardEligible, false);
  assert.equal(session.lives, Infinity);
  assert.equal(session.entryFeeMicroUsdc, 0);
});

test('paid mode session uses quarter-entry economics and leaderboard eligibility', () => {
  const session = startPlaySession({ wallet: '0x2222222222222222222222222222222222222222', gameId: 'lester-blaster', mode: 'paid' });

  assert.equal(session.isPaid, true);
  assert.equal(session.leaderboardEligible, true);
  assert.equal(session.lives, 3);
  assert.equal(session.entryFeeMicroUsdc, 250_000);
});

test('revenue split routes paid-entry funds to arcade, developer, tournaments, and community', () => {
  const split = calculateRevenueSplit(250_000, DEFAULT_REVENUE_SPLIT_BPS);

  assert.deepEqual(split, {
    infrastructure: 100_000,
    developer: 87_500,
    tournament: 37_500,
    community: 25_000,
  });
});

test('paid score submission updates leaderboard, achievements, transactions, and parent progress', () => {
  const state = createInitialArcadeState();
  const session = startPlaySession({ wallet: '0x3333333333333333333333333333333333333333', gameId: 'lester-blaster', mode: 'paid' });

  const result = recordScore(state, session, 1250, { distanceMeters: 810, elapsedSeconds: 316, bossId: 'rug-pull-tank' });
  const snapshot = buildPlayerArcadeSnapshot(state, session.wallet);

  assert.equal(result.acceptedForGlobalLeaderboard, true);
  assert.equal(state.leaderboards['lester-blaster'][0].score, 1250);
  assert.equal(snapshot.progress['lester-blaster'].bestPaidScore, 1250);
  assert.equal(snapshot.progress['lester-blaster'].longestRunSeconds, 316);
  assert.equal(snapshot.progress['lester-blaster'].bossesDefeated.includes('rug-pull-tank'), true);
  assert.equal(snapshot.transactions[0].kind, 'paid-session');
  assert.equal(snapshot.transactions[0].amountMicroUsdc, 250_000);
  assert.equal(snapshot.transactions[0].network, 'LitVM LiteForge testnet simulation');
  assert.equal(snapshot.transactions[0].chainId, 4441);
  assert.equal(snapshot.transactions[0].chainIdHex, '0x1159');
  assert.equal(snapshot.transactions[0].nativeCurrency, 'zkLTC');
  assert.equal(snapshot.transactions[0].explorerUrl, 'https://liteforge.explorer.caldera.xyz');
  assert.match(snapshot.transactions[0].simulatedTxHash, /^0x[a-f0-9]{64}$/);
  assert.equal(snapshot.officialSessions[0].sessionId, session.sessionId);
  assert.equal(snapshot.officialSessions[0].parentSync.writeSets.includes('official scores'), true);
  assert.equal(state.sessions[session.sessionId].status, 'synced-to-parent');
  assert.equal(snapshot.achievements.some((achievement) => achievement.id === ACHIEVEMENTS.FIRST_PAID_RUN.id && achievement.unlocked), true);
  assert.equal(snapshot.achievements.some((achievement) => achievement.id === ACHIEVEMENTS.FIRST_1000_POINTS.id && achievement.unlocked), true);
});

test('child game sync packet describes the exact parent Lester Arcade write sets for Hard Money Heroes paid runs', () => {
  const session = startPlaySession({ wallet: '0x9999999999999999999999999999999999999999', gameId: 'lester-blaster', mode: 'paid' });
  const packet = buildParentSyncPacket(session, {
    score: 4321,
    runStats: { elapsedSeconds: 388, kills: 41, bossId: 'rug-pull-tank' },
    unlockedAchievements: [ACHIEVEMENTS.FIRST_PAID_RUN.id],
  });

  assert.equal(packet.parentSystem, "Lester's Arcade");
  assert.equal(packet.targetNetwork, 'LitVM LiteForge');
  assert.equal(packet.network.chainId, 4441);
  assert.equal(packet.network.chainIdHex, '0x1159');
  assert.equal(packet.network.nativeCurrency.symbol, 'zkLTC');
  assert.equal(packet.network.faucetUrl, 'https://liteforge.hub.caldera.xyz');
  assert.equal(packet.childGame.title, 'Hard Money Heroes');
  assert.equal(packet.mode, 'paid');
  assert.equal(packet.leaderboardEligible, true);
  assert.deepEqual(packet.writeSets, ['profile progress', 'achievements', 'official scores', 'transaction receipts']);
  assert.equal(packet.scoreClaim.score, 4321);
  assert.equal(packet.scoreClaim.runStats.bossId, 'rug-pull-tank');
  assert.equal(packet.verifier.status, 'prototype-local-unverified');
});

test('free score submission remains practice-only and does not track progress, achievements, high scores, or transactions', () => {
  const state = createInitialArcadeState();
  const session = startPlaySession({ wallet: '0x4444444444444444444444444444444444444444', gameId: 'lester-blaster', mode: 'free' });

  const result = recordScore(state, session, 9999, { distanceMeters: 1200, elapsedSeconds: 420 });
  const snapshot = buildPlayerArcadeSnapshot(state, session.wallet);

  assert.equal(result.acceptedForGlobalLeaderboard, false);
  assert.equal(result.trackingDisabled, true);
  assert.equal(result.localScore.ephemeral, true);
  assert.equal(state.leaderboards['lester-blaster'].length, 0);
  assert.equal(state.localScores.length, 0);
  assert.equal(snapshot.progress['lester-blaster'].bestFreeScore, 0);
  assert.equal(snapshot.progress['lester-blaster'].freeRuns, 0);
  assert.equal(snapshot.progress['lester-blaster'].longestRunSeconds, 0);
  assert.equal(snapshot.transactions.length, 0);
});

test('initial arcade state exposes multiple arcade machines with Hard Money Heroes playable now', () => {
  const state = createInitialArcadeState();
  const playable = ARCADE_GAMES.filter((game) => game.status === 'playable');

  assert.equal(playable.length, 1);
  assert.equal(playable[0].id, 'lester-blaster');
  assert.equal(playable[0].title, 'Hard Money Heroes');
  assert.equal(state.games.length >= 4, true);
});

test('Hard Money Heroes canon captures Justin confirmed title, tone, world, economy, audio, and brand direction', () => {
  assert.equal(HARD_MONEY_HEROES_CANON.title, 'Hard Money Heroes');
  assert.equal(HARD_MONEY_HEROES_CANON.workingTitle, true);
  assert.equal(HARD_MONEY_HEROES_CANON.tone, 'goofy arcade mix with gritty Metal Slug-style satire');
  assert.equal(HARD_MONEY_HEROES_CANON.gore.defaultMode, 'sparks-only');
  assert.equal(HARD_MONEY_HEROES_CANON.gore.toggleBeforeRun, true);
  assert.equal(HARD_MONEY_HEROES_CANON.world.name, 'Litecoin City After Dark');
  assert.equal(HARD_MONEY_HEROES_CANON.characters.find((character) => character.id === 'lester').personality.includes('Rambo'), true);
  assert.deepEqual(HARD_MONEY_HEROES_CANON.economy.acceptedPayments, ['USDC', 'ETH', 'LTC']);
  assert.deepEqual(HARD_MONEY_HEROES_CANON.leaderboards.cadences, ['daily', 'weekly', 'monthly', 'yearly', 'all-time']);
  assert.equal(HARD_MONEY_HEROES_CANON.web3.dappitTiming, 'later-after-playable-prototype');
  assert.equal(HARD_MONEY_HEROES_CANON.audio.genreSpine.includes('synthwave'), true);
  assert.equal(HARD_MONEY_HEROES_CANON.brand.litvmPlacement, 'prominent in plumbing, quiet in story');
});

test('game selection model presents arcade cabinets as SNES-style cartridges controlled by the parent portal', () => {
  const cartridges = getCartridgeSelectModel();
  const lesterBlaster = cartridges.find((cartridge) => cartridge.id === 'lester-blaster');

  assert.equal(cartridges.length >= 4, true);
  assert.equal(lesterBlaster.systemRole, 'child-dapp-cartridge');
  assert.equal(lesterBlaster.title, 'Hard Money Heroes');
  assert.equal(lesterBlaster.parentSystem, "Lester's Arcade");
  assert.equal(lesterBlaster.presentation.medium, 'snes-cartridge');
  assert.equal(lesterBlaster.presentation.cabinetAsset.endsWith('cabinet-lester-blaster.svg'), true);
  assert.equal(lesterBlaster.presentation.cartridgeAsset.endsWith('cartridge-lester-blaster.svg'), true);
});

test('Lester Blaster design targets five-minute average runs and 15-20 minute master runs with ten rotating bosses', () => {
  assert.equal(LESTER_BLASTER_GAMEPLAY.targetAverageRunMinutes, 5);
  assert.deepEqual(LESTER_BLASTER_GAMEPLAY.veteranRunMinutes, [15, 20]);
  assert.deepEqual(LESTER_BLASTER_GAMEPLAY.bossIntervalMinutes, [3, 5]);
  assert.equal(LESTER_BLASTER_GAMEPLAY.bossRoster.length, 10);
  assert.equal(LESTER_BLASTER_GAMEPLAY.coreMoves.includes('double-jump'), true);
  assert.equal(LESTER_BLASTER_GAMEPLAY.pickups.includes('grenade-pickup'), true);
  assert.equal(LESTER_BLASTER_GAMEPLAY.weaponUpgrades.length >= 2, true);
});

test('Lester Blaster difficulty scales over time and schedules boss encounters in the 3-5 minute window', () => {
  const opening = getLesterBlasterDifficultyAt(0);
  const averageRun = getLesterBlasterDifficultyAt(5 * 60);
  const masterRun = getLesterBlasterDifficultyAt(18 * 60);
  const boss = scheduleBossEncounter({ elapsedSeconds: 4 * 60, seed: 7 });

  assert.equal(opening.tier < averageRun.tier, true);
  assert.equal(averageRun.tier < masterRun.tier, true);
  assert.equal(opening.enemyAiLevel < masterRun.enemyAiLevel, true);
  assert.equal(masterRun.bossFrequencyMultiplier > opening.bossFrequencyMultiplier, true);
  assert.equal(boss.shouldSpawn, true);
  assert.equal(LESTER_BLASTER_GAMEPLAY.bossRoster.some((candidate) => candidate.id === boss.boss.id), true);
});

test('Lester Blaster design codex covers characters, art, controls, weapons, environments, enemies, sound, menus, and unlockables', () => {
  const codex = buildLesterBlasterDesignCodex();

  assert.equal(LESTER_BLASTER_CHARACTER_ROSTER.length >= 3, true);
  assert.equal(LESTER_BLASTER_CHARACTER_ROSTER.every((character) => character.spriteSheet && character.animations.length >= 5), true);
  assert.equal(LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.length >= 4, true);
  assert.equal(LESTER_BLASTER_WEAPON_SYSTEM.grenades.length >= 2, true);
  assert.equal(LESTER_BLASTER_ENVIRONMENTS.length >= 5, true);
  assert.equal(LESTER_BLASTER_ENVIRONMENTS.every((environment) => environment.props.length >= 3 && environment.hazards.length >= 1), true);
  assert.equal(LESTER_BLASTER_ENEMY_CATALOG.length >= 8, true);
  assert.equal(LESTER_BLASTER_ENEMY_CATALOG.every((enemy) => enemy.aiArchetype && enemy.animationStates.length >= 3), true);
  assert.equal(LESTER_BLASTER_ANIMATION_PLAN.playerStates.includes('double-jump'), true);
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.jump, 'Space');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.shoot, 'Left Click');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.melee, 'E / Right Click');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.grenade, 'F');
  assert.equal(LESTER_BLASTER_MENU_OPTIONS.main.length >= 6, true);
  assert.equal(LESTER_BLASTER_SOUND_DESIGN.musicTracks.length >= 4, true);
  assert.equal(LESTER_BLASTER_UNLOCKABLES.length >= 8, true);
  assert.deepEqual(Object.keys(codex).sort(), ['ai', 'animations', 'architecture', 'bosses', 'characters', 'combatEffects', 'controls', 'environments', 'leaderboard', 'levels', 'login', 'menus', 'performance', 'powerUps', 'sound', 'unlockables', 'weapons'].sort());
});

test('combat run state applies character stats, paid/free health rules, controls, and loadout defaults', () => {
  const freeRun = createCombatRunState({ mode: 'free', characterId: 'lester' });
  const paidRun = createCombatRunState({ mode: 'paid', characterId: 'lilly' });
  const loadout = buildRunLoadout({ characterId: 'max-mempool', weaponId: 'hash-rail', grenadeId: 'chain-cluster' });

  assert.equal(freeRun.mode, 'free');
  assert.equal(freeRun.lives, Infinity);
  assert.equal(freeRun.health.current, freeRun.health.max);
  assert.equal(freeRun.controls.keyboard.jump, 'Space');
  assert.equal(paidRun.mode, 'paid');
  assert.equal(paidRun.lives, 3);
  assert.equal(paidRun.character.id, 'lilly');
  assert.equal(paidRun.loadout.primaryWeapon.id, 'coin-blaster');
  assert.equal(loadout.primaryWeapon.id, 'hash-rail');
  assert.equal(loadout.grenade.id, 'chain-cluster');
});

test('power ups refine health, grenades, score multipliers, lives, shields, ammo, and weapon upgrades', () => {
  const run = createCombatRunState({ mode: 'paid', characterId: 'lester' });
  run.health.current = 42;
  const healed = applyPowerUp(run, 'health-pack');
  const grenades = applyPowerUp(run, 'grenade-crate');
  const spread = applyPowerUp(run, 'spread-ltc-chip');
  const multiplier = applyPowerUp(run, 'score-multiplier');
  const shield = applyPowerUp(run, 'shield-cache');
  const ammo = applyPowerUp(run, 'ammo-cache');
  const life = applyPowerUp(run, 'bonus-life');

  assert.equal(healed.health.current > 42, true);
  assert.equal(grenades.grenades > 3, true);
  assert.equal(spread.loadout.primaryWeapon.id, 'spread-ltc');
  assert.equal(multiplier.scoreMultiplier > 1, true);
  assert.equal(shield.health.shieldCharges > 0, true);
  assert.equal(ammo.ammoReserve > 0, true);
  assert.equal(life.lives, 4);
});

test('enemy spawn selection scales AI behavior, health, attack patterns, death effects, and environment props with survival time', () => {
  const opening = chooseEnemySpawn({ elapsedSeconds: 20, seed: 2 });
  const late = chooseEnemySpawn({ elapsedSeconds: 18 * 60, seed: 2 });

  assert.equal(opening.enemy.id, late.enemy.id);
  assert.equal(late.scaledHealth > opening.scaledHealth, true);
  assert.equal(late.ai.aggression > opening.ai.aggression, true);
  assert.equal(late.environment.props.length >= 3, true);
  assert.equal(late.enemy.spawnAfterSeconds <= 18 * 60, true);
  assert.equal(late.enemy.attackPatterns.length >= 2 && late.enemy.attackPatterns.length <= 3, true);
  assert.equal(Boolean(late.enemy.deathEffect), true);
});

test('login and menu model separates guest, connected, free, paid, settings, and leaderboard states', () => {
  const guest = buildLoginMenuModel({ connected: false, selectedGameId: 'lester-blaster' });
  const connected = buildLoginMenuModel({ connected: true, selectedGameId: 'lester-blaster', wallet: '0x5555555555555555555555555555555555555555' });

  assert.equal(guest.login.primaryAction, 'Connect Wallet');
  assert.equal(guest.menuItems.find((item) => item.id === 'paid-run').disabled, true);
  assert.equal(connected.login.state, 'connected');
  assert.equal(connected.menuItems.find((item) => item.id === 'paid-run').disabled, false);
  assert.equal(connected.menuItems.some((item) => item.id === 'leaderboard'), true);
  assert.equal(connected.menuItems.some((item) => item.id === 'sound-options'), true);
});

test('leaderboard model exposes top scores, player rank, score formula, and season reset notes', () => {
  const state = createInitialArcadeState();
  const walletA = '0x6666666666666666666666666666666666666666';
  const walletB = '0x7777777777777777777777777777777777777777';
  recordScore(state, startPlaySession({ wallet: walletA, gameId: 'lester-blaster', mode: 'paid' }), 5000, { elapsedSeconds: 360, kills: 44, bossId: 'rug-pull-tank' });
  recordScore(state, startPlaySession({ wallet: walletB, gameId: 'lester-blaster', mode: 'paid' }), 8200, { elapsedSeconds: 420, kills: 61, bossId: 'fud-copter' });

  const model = buildLeaderboardModel(state, { gameId: 'lester-blaster', wallet: walletA });

  assert.equal(model.topEntries[0].wallet, walletB);
  assert.equal(model.playerRank, 2);
  assert.equal(model.playerBest.score, 5000);
  assert.equal(model.scoreFormula.includes('survival'), true);
  assert.deepEqual(model.season.cadences, ['daily', 'weekly', 'monthly', 'yearly', 'all-time']);
});

test('achievement resolver adds refined unlockables for bosses, weapon mastery, no-damage, and long runs', () => {
  const unlocks = resolveAchievementUnlocksForRun({
    score: 12_000,
    elapsedSeconds: 16 * 60,
    bossId: 'finality-dragon',
    weaponId: 'hash-rail',
    noDamage: true,
    collectedPowerUps: ['health-pack', 'grenade-crate', 'score-multiplier'],
  });

  assert.equal(unlocks.includes(ACHIEVEMENTS.BOSS_BREAKER.id), true);
  assert.equal(unlocks.includes(ACHIEVEMENTS.MASTER_SURVIVOR.id), true);
  assert.equal(unlocks.includes(ACHIEVEMENTS.HASH_RAIL_SPECIALIST.id), true);
  assert.equal(unlocks.includes(ACHIEVEMENTS.NO_DAMAGE_BOSS.id), true);
  assert.equal(unlocks.includes(ACHIEVEMENTS.POWERUP_COLLECTOR.id), true);
});

test('build stack is web-first dApp, with Godot optional and dappit/LitVM positioned for smart-contract rails', () => {
  assert.equal(LESTER_ARCADE_BUILD_STACK.currentPrototype.engine, 'web-canvas');
  assert.equal(LESTER_ARCADE_BUILD_STACK.currentPrototype.framework, 'vanilla-html-css-js');
  assert.equal(LESTER_ARCADE_BUILD_STACK.recommendedGameEngine.primary, 'phaser-or-custom-canvas');
  assert.equal(LESTER_ARCADE_BUILD_STACK.recommendedGameEngine.optional.includes('godot-html5-export'), true);
  assert.equal(LESTER_ARCADE_BUILD_STACK.web3.smartContractAssistants.includes('dappit.io'), true);
  assert.equal(LESTER_ARCADE_BUILD_STACK.web3.targetNetwork, 'LitVM LiteForge');
  assert.equal(LESTER_ARCADE_BUILD_STACK.web3.chainId, 4441);
  assert.equal(LESTER_ARCADE_BUILD_STACK.web3.nativeGasToken, 'zkLTC');
});

test('60fps performance target models smooth frame budget, fixed-step gameplay, and pixel animation frame rates', () => {
  assert.equal(LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps, 60);
  assert.equal(LESTER_BLASTER_PERFORMANCE_TARGETS.frameBudgetMs <= 16.67, true);
  assert.equal(LESTER_BLASTER_PERFORMANCE_TARGETS.gameplayStep, 'fixed-timestep-logic-variable-render');
  assert.equal(LESTER_BLASTER_ANIMATION_PLAN.frameRate.targetFps, 60);
  assert.equal(LESTER_BLASTER_ANIMATION_PLAN.pixelArtDetail, 'high-detail-16-bit-snes-neo-geo-inspired');
  assert.equal(LESTER_BLASTER_ANIMATION_PLAN.rules.some((rule) => rule.includes('sub-pixel smoothing')), true);
});

test('HD sprite atlas provides high-resolution artwork, dense animation coverage, and clean browser-frame metadata', () => {
  const atlasPath = fileURLToPath(new URL('../apps/portal/assets/generated/hmh-hd-sprite-atlas.png', import.meta.url));
  const previewPath = fileURLToPath(new URL('../apps/portal/assets/generated/hmh-hd-sprite-atlas-preview.png', import.meta.url));

  assert.equal(LESTER_BLASTER_HD_SPRITE_ATLAS.frameSize.width, 128);
  assert.equal(LESTER_BLASTER_HD_SPRITE_ATLAS.frameSize.height, 128);
  assert.equal(LESTER_BLASTER_HD_SPRITE_ATLAS.columns, 16);
  assert.equal(LESTER_BLASTER_HD_SPRITE_ATLAS.totalFrames, HMH_HD_SPRITE_ATLAS_MANIFEST.totalFrames);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.totalFrames >= 800, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.image.width, 2048);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.image.height, HMH_HD_SPRITE_ATLAS_MANIFEST.image.rows * HMH_HD_SPRITE_ATLAS_MANIFEST.image.frameHeight);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['lester.run'].count >= 16, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['lester.melee'].count >= 18, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['lester.shoot'].fps >= 24, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['lester.reload'].count >= 12, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['fud-goblin.attack-tell'].count >= 6, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['slippage-skater.move'].count >= 14, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['rug-pull-baron.super-move'].count >= 16, true);
  assert.equal(HMH_HD_SPRITE_ATLAS_MANIFEST.animations['fx.blade-arc'].count >= 18, true);
  assert.deepEqual(LESTER_BLASTER_HD_SPRITE_ATLAS.playableStates, ['idle', 'run', 'jump', 'double-jump', 'shoot', 'melee', 'grenade', 'reload', 'hurt', 'death', 'victory']);
  assert.equal(existsSync(atlasPath), true);
  assert.equal(existsSync(previewPath), true);
  assert.equal(statSync(atlasPath).size > 25_000, true);
  assert.equal(statSync(previewPath).size > 10_000, true);
});

test('generated sliced asset report covers gameplay art and every PNG is verifiable', () => {
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
  const reportPath = fileURLToPath(new URL('../apps/portal/assets/generated/sliced/asset-slice-report.json', import.meta.url));
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));

  assert.equal(packageJson.scripts['assets:verify'], 'node scripts/verify-generated-assets.mjs');
  assert.equal(report.generatedCount, report.assets.length);
  assert.equal(report.generatedCount >= 70, true);
  assert.equal(report.assets.some((asset) => asset.output.includes('/lester-run-1.png')), true);
  assert.equal(report.assets.some((asset) => asset.output.includes('/enemy-goblin-attack.png')), true);
  assert.equal(report.assets.some((asset) => asset.output.includes('/icon-weapon-settler.png')), true);
  assert.equal(report.assets.some((asset) => asset.output.includes('/badge-first-run.png')), true);
  assert.equal(report.assets.some((asset) => asset.output.includes('/level1-underchain-street.png')), true);

  for (const asset of report.assets) {
    const assetPath = fileURLToPath(new URL(`../${asset.output}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, `${asset.output} exists`);
    assert.equal(statSync(assetPath).size > 0, true, `${asset.output} is non-empty`);
    const png = readFileSync(assetPath);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.deepEqual([width, height], asset.size, `${asset.output} dimensions match report`);
  }
});

test('level plan uses the confirmed ground-outward, vertical-upward, and high-speed-getaway campaign rhythm', () => {
  assert.equal(LESTER_BLASTER_LEVEL_PLAN.length, 3);
  assert.equal(LESTER_BLASTER_LEVEL_PLAN[0].title, 'Level 1: The Slums');
  assert.equal(LESTER_BLASTER_LEVEL_PLAN[1].title, 'Level 2: The Tower');
  assert.equal(LESTER_BLASTER_LEVEL_PLAN[2].title, 'Level 3: The Getaway');
  assert.equal(LESTER_BLASTER_LEVEL_PLAN[0].traversalRhythm, 'ground-outward');
  assert.equal(LESTER_BLASTER_LEVEL_PLAN[1].traversalRhythm, 'vertical-upward');
  assert.equal(LESTER_BLASTER_LEVEL_PLAN[2].traversalRhythm, 'horizontal-high-speed');
  assert.equal(LESTER_BLASTER_LEVEL_PLAN.every((level) => level.parallaxLayers.length >= 4), true);
  assert.equal(LESTER_BLASTER_LEVEL_PLAN.every((level) => level.miniBossScrollLocks.length >= 1), true);
});

test('weapons include the confirmed hybrid Hard Money Heroes kit: Settler, Block Breaker, Hashstorm, Litecoin Blade, Crypto Bombs, and Hard Forks', () => {
  const titles = LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.map((weapon) => weapon.title);
  assert.deepEqual(['The Settler', 'The Block Breaker', 'The Hashstorm'].every((title) => titles.includes(title)), true);
  assert.equal(LESTER_BLASTER_WEAPON_SYSTEM.melee.title, 'The Litecoin Blade');
  assert.equal(LESTER_BLASTER_WEAPON_SYSTEM.melee.signatureMechanic, true);
  assert.equal(LESTER_BLASTER_WEAPON_SYSTEM.grenades.some((grenade) => grenade.title === 'Crypto Bombs'), true);
  assert.equal(LESTER_BLASTER_WEAPON_SYSTEM.grenades.some((grenade) => grenade.title === 'Hard Forks'), true);
  assert.equal(LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.find((weapon) => weapon.id === 'oracle-slayer').rarity, 'super-rare');
  assert.deepEqual([...LESTER_BLASTER_WEAPON_SYSTEM.upgradeStats].sort(), ['damage', 'rateOfFire', 'reloadSpeed'].sort());
});

test('boss system gives each boss two or three stages, six to eight attack patterns, and two or three super moves', () => {
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.bosses.length, 10);
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.bosses.every((boss) => boss.stages.length >= 2 && boss.stages.length <= 3), true);
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.bosses.every((boss) => boss.attackPatterns.length >= 6 && boss.attackPatterns.length <= 8), true);
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.bosses.every((boss) => boss.superMoves.length >= 2 && boss.superMoves.length <= 3), true);
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.bosses.some((boss) => boss.title === 'The Rug Pull Baron'), true);
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.bosses.some((boss) => boss.title === 'The Influencer (Mr. NGMI)'), true);
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.bosses.some((boss) => boss.title === 'The Quantum Hacker'), true);
  assert.equal(LESTER_BLASTER_BOSS_SYSTEM.phaseRules.includes('phase transition pauses side scroll and changes arena hazards'), true);
});

test('score model rewards survival, kills, combos, damage without hits, power-ups, upgrades, and rare weapons', () => {
  const baseline = calculateLesterBlasterScore({ elapsedSeconds: 300, kills: 20 });
  const comboRun = calculateLesterBlasterScore({ elapsedSeconds: 300, kills: 20, maxKillCombo: 12, maxDamageCombo: 90, noDamageSeconds: 180 });
  const poweredRun = calculateLesterBlasterScore({ elapsedSeconds: 300, kills: 20, maxKillCombo: 12, powerUpsCollected: 5, weaponUpgrades: ['damage', 'rateOfFire'], rareWeaponId: 'oracle-slayer' });

  assert.equal(comboRun.total > baseline.total, true);
  assert.equal(poweredRun.total > baseline.total, true);
  assert.equal(baseline.breakdown.survival > 0, true);
  assert.equal(comboRun.breakdown.combo > 0, true);
  assert.equal(poweredRun.breakdown.powerUps > 0, true);
});

test('combat effects specify blood, enemy-specific death effects, shell casings, muzzle flashes, and knife hit sparks', () => {
  assert.equal(LESTER_BLASTER_COMBAT_EFFECTS.sparks.alwaysEnabled, true);
  assert.equal(LESTER_BLASTER_COMBAT_EFFECTS.blood.enabledByDefault, false);
  assert.equal(LESTER_BLASTER_COMBAT_EFFECTS.blood.toggleBeforeRun, true);
  assert.equal(LESTER_BLASTER_COMBAT_EFFECTS.blood.palette.length >= 4, true);
  assert.equal(Object.keys(LESTER_BLASTER_COMBAT_EFFECTS.enemyDeathEffects).length >= 8, true);
  assert.equal(LESTER_BLASTER_COMBAT_EFFECTS.weaponEffects.some((effect) => effect.id === 'knife-hit-sparks'), true);
  assert.equal(LESTER_BLASTER_COMBAT_EFFECTS.weaponEffects.some((effect) => effect.id === 'shell-casings'), true);
});

test('brand system provides arcade palette, patterns, icons, tooltip anchors, and quality rules', () => {
  assert.equal(LESTER_ARCADE_BRAND_SYSTEM.name, "Lester's Arcade");
  assert.equal(LESTER_ARCADE_BRAND_SYSTEM.palette.length >= 7, true);
  assert.equal(LESTER_ARCADE_BRAND_SYSTEM.palette.some((color) => color.token === '--neon-cyan' && color.hex === '#19f7ff'), true);
  assert.equal(LESTER_ARCADE_BRAND_SYSTEM.patterns.some((pattern) => pattern.id === 'crt-scanlines'), true);
  assert.equal(LESTER_ARCADE_BRAND_SYSTEM.icons.some((icon) => icon.id === 'wallet' && icon.symbol), true);
  assert.equal(LESTER_ARCADE_BRAND_SYSTEM.qualityRules.some((rule) => rule.includes('60fps')), true);
});

test('UI quality guide model covers controls, tooltips, instructions, branding, icons, and accessibility', () => {
  const guide = buildUiQualityGuideModel({ connected: true, selectedGameId: 'lester-blaster', activeControl: 'shoot' });

  assert.equal(guide.connected, true);
  assert.equal(guide.selectedGameId, 'lester-blaster');
  assert.equal(guide.quickStart.length >= 6, true);
  assert.equal(guide.tooltips.length >= 10, true);
  assert.equal(guide.tooltips.some((tip) => tip.anchor === 'shootButton' && tip.copy.includes('Left Click')), true);
  assert.equal(guide.controls.keyboard.some((control) => control.action === 'Shoot' && control.key === 'Left Click'), true);
  assert.equal(guide.brand.palette.length >= 7, true);
  assert.equal(guide.iconLegend.some((icon) => icon.label.includes('Official')), true);
  assert.equal(guide.qualityChecklist.every((item) => item.status === 'prototype-pass' || item.status === 'needs-production-pass'), true);
  assert.equal(LESTER_ARCADE_UI_QUALITY_SYSTEM.instructions.some((instruction) => instruction.title.includes('Survive')), true);
});

test('V2 app shell hides prototype chrome behind full-screen wallet profile, cabinet, and leaderboard navigation', () => {
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.layout, 'full-screen-arcade-app');
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.profileRules.walletIsPrimaryKey, true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.profileRules.username.appearsOnLeaderboards, true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.profileRules.avatar.requiredPixels, 150);
  assert.deepEqual(LESTERS_ARCADE_V2_APP_SHELL.leaderboardRules.cadences, ['daily', 'weekly', 'monthly', 'yearly', 'all-time']);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.leaderboardRules.submissionTrigger, 'game-over-score-submit');
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.leaderboardRules.onChainPayload.includes('username'), true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.leaderboardRules.onChainPayload.includes('wallet'), true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.hiddenByDefault.includes('debug-codex'), true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.navigation.some((item) => item.id === 'cabinets'), true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.navigation.some((item) => item.id === 'profile'), true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.navigation.some((item) => item.id === 'leaderboards'), true);
});

test('V2 tactical combat spec slows pacing into staged cover, platform, mini-boss, and boss sections', () => {
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.move, 'WASD / Arrow Keys');
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.shoot, 'Left Click');
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.melee, 'E / Right Click');
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.throwable, 'F');
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.sectionPlan[0].enemyCount[0], 2);
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.sectionPlan.some((section) => section.miniBoss), true);
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.sectionPlan.some((section) => section.boss && section.section >= 8), true);
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.pacingRules.some((rule) => rule.includes('0–4 enemies')), true);
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.pacingRules.some((rule) => rule.includes('Scroll resumes')), true);
});

test('V2 art and audio plans track Justin reference assets, Lester redo, 150x150 profile direction, and free SFX sources', () => {
  const refPaths = LESTER_BLASTER_ART_REDO_BRIEF.referenceAssets.map((asset) => fileURLToPath(new URL(`../apps/portal/${asset.path.replace('./', '')}`, import.meta.url)));
  const musicPath = fileURLToPath(new URL('../apps/portal/assets/audio/music/lester-and-lilly-rap-getting-lit.mp3', import.meta.url));

  assert.equal(LESTER_BLASTER_ART_REDO_BRIEF.priority.includes('Lester'), true);
  assert.equal(LESTER_BLASTER_ART_REDO_BRIEF.requiredHeroStates.includes('crouch'), true);
  assert.equal(LESTER_BLASTER_ART_REDO_BRIEF.requiredHeroStates.includes('melee'), true);
  assert.equal(LESTER_BLASTER_ART_REDO_BRIEF.enemySpriteUpgrade.includes('attack-tell'), true);
  assert.equal(refPaths.every((path) => existsSync(path) && statSync(path).size > 0), true);
  assert.equal(existsSync(musicPath) && statSync(musicPath).size > 0, true);
  assert.equal(LESTER_BLASTER_AUDIO_ASSET_PLAN.prototypeMusic[0].src.includes('lester-and-lilly-rap-getting-lit.mp3'), true);
  assert.equal(LESTER_BLASTER_AUDIO_ASSET_PLAN.sfxNeeds.includes('wallet connect'), true);
  assert.equal(LESTER_BLASTER_AUDIO_ASSET_PLAN.freeLibraries.some((library) => library.name === 'Kenney Audio' && library.license.includes('CC0')), true);
  assert.equal(LESTER_BLASTER_AUDIO_ASSET_PLAN.freeLibraries.some((library) => library.name.includes('Sonniss') && library.license.includes('no AI/ML training')), true);
});

test('control display model does not leak undefined labels into the visible controls guide', () => {
  const controls = buildLesterBlasterControlDisplayModel();
  const move = controls.find((control) => control.label === 'Move');

  assert.equal(controls.length >= 6, true);
  assert.equal(move.key, 'A / ArrowLeft + D / ArrowRight');
  assert.equal(controls.some((control) => control.label === 'Crouch' && control.key.includes('Control')), true);
  assert.equal(controls.some((control) => control.label === 'Shoot' && control.key === 'Left Click'), true);
  assert.equal(controls.some((control) => control.label === 'Blade' && control.key.includes('Right Click')), true);
  assert.equal(controls.some((control) => control.label === 'Throwable' && control.key === 'F'), true);
  assert.equal(controls.every((control) => control.key && !control.key.includes('undefined')), true);
  assert.equal(controls.every((control) => control.label && !control.label.includes('undefined')), true);
});

test('official run and combat sandbox status models stay visually separate', () => {
  const paidSession = startPlaySession({ wallet: '0x8888888888888888888888888888888888888888', gameId: 'lester-blaster', mode: 'paid' });
  const official = buildOfficialRunStatusModel({
    gameTitle: 'Lester Blaster',
    connected: true,
    currentSession: paidSession,
    lastResult: { score: 3668, elapsedSeconds: 316, acceptedForGlobalLeaderboard: true },
  });
  const combat = buildCombatSandboxStatusModel({ running: true, elapsedSeconds: 42, fps: 59, activeMode: 'free' });

  assert.equal(official.heading, 'Official paid result synced');
  assert.equal(official.channel, 'official');
  assert.equal(official.details.includes('leaderboard'), true);
  assert.equal(official.details.includes('Combat test running'), false);
  assert.equal(combat.heading, 'Local combat sandbox running');
  assert.equal(combat.channel, 'sandbox');
  assert.equal(combat.details.includes('does not overwrite official paid-run state'), true);
});
