import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { HMH_HD_SPRITE_ATLAS_MANIFEST } from '../apps/portal/assets/generated/hmh-hd-sprite-atlas.mjs';

import {
  ACHIEVEMENTS,
  ARCADE_GAMES,
  DEFAULT_REVENUE_SPLIT_BPS,
  HARD_MONEY_HEROES_ASSET_MANIFEST,
  HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST,
  HARD_MONEY_HEROES_CANON,
  LESTER_ARCADE_BRAND_SYSTEM,
  LESTER_BLASTER_HUD_OVERLAY_MODEL,
  LESTER_BLASTER_ISOMETRIC_ROGUELIKE,
  LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY,
  LESTER_BLASTER_TACTICAL_CAMERA_MODEL,
  LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS,
  LESTER_BLASTER_DEV_BALANCE_OVERLAY,
  LESTER_ARCADE_BUILD_STACK,
  LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP,
  LESTER_ARCADE_UI_QUALITY_SYSTEM,
  LESTER_ARCADE_WALLET_RAILS,
  LESTER_ARCADE_WORKFLOW_AUTOMATION,
  LESTERS_ARCADE_V2_APP_SHELL,
  LESTER_BLASTER_ANIMATION_PLAN,
  LESTER_BLASTER_ENEMY_AI_STATE_MACHINE,
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
  advanceTacticalCameraModel,
  applyPowerUp,
  buildLeaderboardModel,
  buildLesterBlasterControlDisplayModel,
  buildCombatHudOverlayModel,
  buildCombatOptionsMenuModel,
  buildHardMoneyHeroesAnimationProductionBriefs,
  buildTacticalBalanceDebugOverlayModel,
  buildCombatSandboxStatusModel,
  buildFullscreenViewportModel,
  buildIsometricRoguelikeRunConfig,
  buildLesterBlasterDesignCodex,
  buildLoginMenuModel,
  buildOfficialRunStatusModel,
  chooseArcadeMusicNextIndex,
  buildGameOverSummaryModel,
  buildParentSyncPacket,
  buildHardMoneyHeroesAnimationCoverageReport,
  buildPlayerArcadeSnapshot,
  buildHardMoneyHeroesStatsModule,
  achievementRarityPct,
  LESTER_BLASTER_POWER_UPS,
  buildRunLoadout,
  buildUiQualityGuideModel,
  buildWalletConnectionModel,
  calculateLesterBlasterScore,
  calculateRevenueSplit,
  chooseEnemySpawn,
  chooseRoguelikeUpgradeOptions,
  connectPlayerAccount,
  createCombatRunState,
  createInitialArcadeState,
  createPlayerProfile,
  createRoguelikeRunState,
  getCartridgeSelectModel,
  getLesterBlasterDifficultyAt,
  getRoguelikeSpawnDirectorAt,
  grantRoguelikeXp,
  applyRoguelikeSkillUpgrade,

  recordScore,
  resolveAchievementUnlocksForRun,
  scheduleBossEncounter,
  startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';

function readRgbaPng(path) {
  const png = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    offset += length + 12;
  }
  assert.equal(bitDepth, 8, `${path} uses 8-bit PNG channels`);
  assert.equal(colorType, 6, `${path} is saved as RGBA so alpha can be verified`);
  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const previous = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    const decoded = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? decoded[x - 4] : 0;
      const up = previous ? previous[x] : 0;
      const upLeft = previous && x >= 4 ? previous[x - 4] : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 0xff;
      else if (filter === 2) value = (value + up) & 0xff;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 0xff;
      } else {
        assert.equal(filter, 0, `${path} uses a supported PNG filter`);
      }
      decoded[x] = value;
    }
  }
  return { width, height, pixels };
}

function alphaComponentMetrics(path) {
  const { width, height, pixels } = readRgbaPng(path);
  const seen = new Uint8Array(width * height);
  const queue = [];
  const components = [];
  let opaquePixelCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start]) continue;
      seen[start] = 1;
      if (pixels[start * 4 + 3] <= 32) continue;
      let size = 0;
      queue.push(start);
      while (queue.length) {
        const current = queue.pop();
        size += 1;
        const cx = current % width;
        const cy = Math.floor(current / width);
        for (const neighbor of [current - 1, current + 1, current - width, current + width]) {
          const nx = neighbor % width;
          const ny = Math.floor(neighbor / width);
          if (neighbor < 0 || neighbor >= seen.length || Math.abs(nx - cx) + Math.abs(ny - cy) !== 1 || seen[neighbor]) continue;
          seen[neighbor] = 1;
          if (pixels[neighbor * 4 + 3] > 32) queue.push(neighbor);
        }
      }
      opaquePixelCount += size;
      if (size >= 4) components.push(size);
    }
  }
  components.sort((a, b) => b - a);
  return {
    componentCount: components.length,
    opaquePixelCount,
    largestComponentRatio: components.length ? components[0] / opaquePixelCount : 0,
  };
}

test('createPlayerProfile normalizes EVM wallets and creates a Lester profile shell', () => {
  const profile = createPlayerProfile('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD');

  assert.equal(profile.wallet, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(profile.handle, 'Player ABCD');
  assert.equal(profile.creditsLabel, 'Ranked runs publish on-chain to LitVM (testnet: zkLTC gas only)');
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

test('revenue split reserves settlement gas and routes the rest (dev wallet biggest share)', () => {
  const split = calculateRevenueSplit(250_000, DEFAULT_REVENUE_SPLIT_BPS);

  assert.deepEqual(split, {
    settlement: 37_500,   // 15% reserved for on-chain settlement gas
    dev: 137_500,         // 55% -> dev wallet (biggest share)
    tournament: 45_000,   // 18% -> tournament pools
    community: 30_000,    // 12% -> community building
  });
  // dev is the largest bucket
  assert.ok(split.dev > split.settlement && split.dev > split.tournament && split.dev > split.community);
  // total is preserved
  assert.equal(split.settlement + split.dev + split.tournament + split.community, 250_000);
});

test('unused settlement-gas reserve rolls into the dev wallet', () => {
  // actual gas costs only 10,000 micro-units; settlement bucket is 37,500.
  const split = calculateRevenueSplit(250_000, DEFAULT_REVENUE_SPLIT_BPS, { settlementGasMicroUnits: 10_000 });
  assert.equal(split.settlement, 10_000);             // only actual gas reserved
  assert.equal(split.settlementRemainderToDev, 27_500); // leftover
  assert.equal(split.dev, 137_500 + 27_500);          // remainder rolled into dev
  assert.equal(split.gasShortfall, 0);
  // total still preserved
  assert.equal(split.settlement + split.dev + split.tournament + split.community, 250_000);
});

test('settlement plan routes the dev share to the dev wallet', async () => {
  const { buildSettlementPlan } = await import('../apps/portal/src/settlement.mjs');
  const plan = buildSettlementPlan({
    wallet: '0x' + '7'.repeat(40),
    gameId: 'lester-blaster',
    sessionId: 'sess-dev-1',
    score: 1000,
    entryFeeMicroUnits: 250_000,
    paymentToken: 'zkLTC',
    devWalletAddress: '0x' + 'd'.repeat(40),
  });
  const route = plan.calls.find((c) => c.method === 'routeRevenueSplit');
  assert.ok(route, 'plan should include a revenue-routing call');
  assert.equal(route.args.devWallet, '0x' + 'd'.repeat(40));
  assert.equal(route.args.devAmountMicroUnits, 137_500);
  assert.equal(route.args.paymentToken, 'zkLTC');
  assert.equal(plan.revenueSplit.dev, 137_500);
  assert.equal(plan.devWallet, '0x' + 'd'.repeat(40));
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

test('ranked run unlocks the in-combat gameplay achievements (kills, combo, survival) and they persist into the profile snapshot', () => {
  // Guards the user-reported concern: achievements must actually unlock when
  // EARNED through Ranked gameplay (not just the paid-run/score ones). A run
  // with 10+ kills, a 5-hit combo, a grenade kill, a power-up, and 5+ minutes
  // survived should flip the matching badges to unlocked in the snapshot that
  // the Profile achievements grid renders from.
  const state = createInitialArcadeState();
  const wallet = '0x5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a';
  const session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });

  const result = recordScore(state, session, 3200, {
    elapsedSeconds: 316,
    kills: 12,
    maxCombo: 6,
    grenadeKills: 1,
    powerUpsCollected: 1,
    collectedPowerUps: ['magnet'],
    bossId: 'rug-pull-tank',
  });
  assert.equal(result.acceptedForGlobalLeaderboard, true);

  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  const unlocked = new Set(snapshot.achievements.filter((a) => a.unlocked).map((a) => a.id));
  // The gameplay-earned badges the run qualifies for:
  for (const id of [
    ACHIEVEMENTS.FIRST_BLOOD.id,
    ACHIEVEMENTS.TEN_ENEMY_KILLS.id,
    ACHIEVEMENTS.FIRST_GRENADE_KILL.id,
    ACHIEVEMENTS.FIRST_POWERUP.id,
    ACHIEVEMENTS.FIVE_MINUTE_RUN.id,
    ACHIEVEMENTS.COMBO_STARTER.id,
  ]) {
    assert.equal(unlocked.has(id), true, `expected ${id} to be unlocked after the ranked run`);
  }
});

test('ranked score is filed into all five cadence boards and returns a settlement input', async () => {
  const { getLeaderboard, applySettlement } = await import('../apps/portal/src/arcade-core.mjs');
  const { buildSettlementPlan, settleRun } = await import('../apps/portal/src/settlement.mjs');
  const state = createInitialArcadeState();
  const wallet = '0x4444444444444444444444444444444444444444';
  const session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
  const result = recordScore(state, session, 2500, { elapsedSeconds: 120, bossId: 'rug-pull-tank' });

  assert.ok(result.cadenceKeys.daily);
  assert.ok(result.settlementInput);
  assert.equal(result.settlementInput.score, 2500);

  for (const cadence of ['daily', 'weekly', 'monthly', 'yearly', 'all-time']) {
    const board = getLeaderboard(state, 'lester-blaster', cadence, { wallet });
    assert.equal(board.topEntries[0].score, 2500);
    assert.equal(board.topEntries[0].isCurrentPlayer, true);
  }

  // settle (simulated) and confirm the tx hash is stamped + recorded
  const plan = buildSettlementPlan(result.settlementInput);
  const settlement = await settleRun(plan);
  applySettlement(state, settlement);
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  assert.equal(snapshot.settlements[0].mode, 'simulated');
  assert.ok(snapshot.settlements[0].primaryTxHash.startsWith('0x'));
  assert.equal(state.leaderboards['lester-blaster'][0].settlementTxHash, settlement.primaryTxHash);
});

test('setArcadeUsername sets a unique display name shown on leaderboards', async () => {
  const { setArcadeUsername, getLeaderboard, resolveDisplayName } = await import('../apps/portal/src/arcade-core.mjs');
  const state = createInitialArcadeState();
  const wallet = '0x5555555555555555555555555555555555555555';
  connectPlayerAccount(state, wallet);

  const ok = setArcadeUsername(state, wallet, 'HardMoneyKing');
  assert.equal(ok.ok, true);

  // duplicate (case-insensitive) from another wallet is rejected
  const other = '0x6666666666666666666666666666666666666666';
  connectPlayerAccount(state, other);
  const dup = setArcadeUsername(state, other, 'hardmoneyking');
  assert.equal(dup.ok, false);
  assert.equal(dup.error, 'name-taken');

  // vulgar name rejected
  const bad = setArcadeUsername(state, other, 'fuckface');
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'blocked-term');

  // the set username appears on the leaderboard for that wallet
  const session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(state, session, 999, { elapsedSeconds: 30 });
  const board = getLeaderboard(state, 'lester-blaster', 'all-time', {
    displayNameFor: (w) => resolveDisplayName(state.profiles[w], w),
  });
  assert.equal(board.topEntries[0].displayName, 'HardMoneyKing');
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

test('Hard Money Heroes pivot is codified as an isometric run-and-gun roguelike survival loop', () => {
  const config = buildIsometricRoguelikeRunConfig({ seed: 42 });

  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.genre, 'isometric-run-and-gun-roguelike');
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.camera.projection, 'isometric');
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.movement.directions.length, 8);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.runPacing.targetSurvivalMinutes, 20);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.mapGeneration.procedural, true);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.pausesGame, true);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.choicesPerLevel, 2);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.rerollsPerLevel, 1);
  assert.equal(config.seed, 42);
  assert.equal(config.map.tilesetPerspective, 'isometric');
  assert.equal(config.player.startWorld.x, 0);
  assert.equal(config.spawnDirector.targetPressureCurveMinutes.at(-1), 20);
});

test('roguelike skill library exposes forty five-rank upgrades and deterministic two-choice level-up offers', () => {
  const run = createRoguelikeRunState({ seed: 11, mode: 'free' });
  const leveled = grantRoguelikeXp(run, 125);
  const offered = chooseRoguelikeUpgradeOptions(leveled, { seed: 5 });
  const upgraded = applyRoguelikeSkillUpgrade(leveled, offered.options[0].id);

  assert.equal(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.length, 40);
  assert.equal(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.every((skill) => skill.maxLevel === 5), true);
  assert.equal(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.every((skill) => skill.perLevelPercent === 5), true);
  assert.equal(leveled.level, 2);
  assert.equal(leveled.pausedForLevelUp, true);
  assert.equal(leveled.pendingUpgradeChoices, 2);
  assert.equal(leveled.rerollsRemaining, 1);
  assert.equal(offered.options.length, 2);
  assert.equal(new Set(offered.options.map((option) => option.id)).size, 2);
  assert.equal(upgraded.pausedForLevelUp, false);
  assert.equal(upgraded.skills[offered.options[0].id], 1);
  assert.equal(upgraded.stats[offered.options[0].stat] > leveled.stats[offered.options[0].stat], true);
});

test('roguelike spawn director escalates enemy pressure toward a twenty minute survival wall', () => {
  const opening = getRoguelikeSpawnDirectorAt(30);
  const mid = getRoguelikeSpawnDirectorAt(10 * 60);
  const endgame = getRoguelikeSpawnDirectorAt(20 * 60);

  assert.equal(opening.elapsedMinutes < mid.elapsedMinutes, true);
  assert.equal(mid.spawnIntervalSeconds < opening.spawnIntervalSeconds, true);
  assert.equal(endgame.spawnIntervalSeconds < mid.spawnIntervalSeconds, true);
  assert.equal(endgame.maxEnemiesOnMap > mid.maxEnemiesOnMap, true);
  assert.equal(endgame.rangedEnemyShare > opening.rangedEnemyShare, true);
  assert.equal(endgame.eliteEnemyShare > mid.eliteEnemyShare, true);
  assert.equal(endgame.difficultyLabel, 'survival-wall');
});

test('fullscreen viewport model requires real browser fullscreen for expanded monitor/device play', () => {
  const windowed = buildFullscreenViewportModel({ mode: 'windowed', fullscreenElementActive: false });
  const expanded = buildFullscreenViewportModel({ mode: 'expanded-fullscreen', fullscreenElementActive: false });
  const active = buildFullscreenViewportModel({ mode: 'expanded-fullscreen', fullscreenElementActive: true, screenWidth: 2560, screenHeight: 1440 });

  assert.equal(windowed.browserApiAction, 'none');
  assert.equal(windowed.canvasCss.width, 'min(100%, 660px)');
  assert.equal(expanded.browserApiAction, 'requestFullscreen');
  assert.equal(expanded.targetElement, 'officialCombatMount');
  assert.equal(active.isRealFullscreen, true);
  assert.equal(active.canvasCss.width, '100vw');
  assert.equal(active.canvasCss.height, '100vh');
  assert.equal(active.devicePixels.width, 2560);
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
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.move, 'WASD / Arrow Keys');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.melee, 'Left Click');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.throw, 'Right Click');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.grenade, 'F');
  assert.equal(LESTER_BLASTER_MENU_OPTIONS.main.length >= 6, true);
  assert.equal(LESTER_BLASTER_SOUND_DESIGN.musicTracks.length >= 4, true);
  assert.equal(LESTER_BLASTER_UNLOCKABLES.length >= 8, true);
  assert.deepEqual(Object.keys(codex).sort(), ['ai', 'animations', 'architecture', 'bosses', 'characters', 'combatEffects', 'controls', 'environments', 'leaderboard', 'levels', 'login', 'menus', 'performance', 'powerUps', 'sound', 'unlockables', 'weapons'].sort());
});

test('combat run state applies character stats, paid/free health rules, controls, and loadout defaults', () => {
  const freeRun = createCombatRunState({ mode: 'free', characterId: 'lit-commando' });
  const paidRun = createCombatRunState({ mode: 'paid', characterId: 'lit-valkyrie' });
  const loadout = buildRunLoadout({ characterId: 'max-mempool', weaponId: 'hash-rail', grenadeId: 'chain-cluster' });

  assert.equal(freeRun.mode, 'free');
  assert.equal(freeRun.lives, Infinity);
  assert.equal(freeRun.health.current, freeRun.health.max);
  assert.equal(freeRun.controls.keyboard.move, 'WASD / Arrow Keys');
  assert.equal(paidRun.mode, 'paid');
  assert.equal(paidRun.lives, 3);
  assert.equal(paidRun.character.id, 'lit-valkyrie');
  // Legacy id still resolves to the renamed hero (backward compat).
  assert.equal(createCombatRunState({ mode: 'free', characterId: 'lilly' }).character.id, 'lit-valkyrie');
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

test('production Lester sprite manifest slices Justin-provided animation sheets into runtime frames', () => {
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
  const manifestPath = fileURLToPath(new URL('../apps/portal/assets/lester-production/lester-production-sprite-manifest.json', import.meta.url));
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  assert.equal(packageJson.scripts['assets:lester'], 'python scripts/slice-lester-production-sprites.py');
  assert.equal(manifest.character, 'Lester');
  assert.equal(manifest.source, 'Justin-provided production sprite sheets');
  assert.equal(manifest.frameGrid.columns, 5);
  assert.equal(manifest.frameGrid.rows, 5);
  assert.equal(manifest.frameGrid.sourceFrameSize.width, 256);
  assert.equal(manifest.frameGrid.sourceFrameSize.height, 256);

  for (const state of ['idle', 'walk', 'run', 'jump']) {
    assert.equal(manifest.animations[state].frames.length, 25, `${state} has 25 frames`);
    assert.equal(manifest.animations[state].loop, state !== 'jump');
    assert.equal(existsSync(fileURLToPath(new URL(`../${manifest.animations[state].source}`, import.meta.url))), true, `${state} source exists`);
    for (const frame of manifest.animations[state].frames) {
      const framePath = fileURLToPath(new URL(`../${frame.src}`, import.meta.url));
      assert.equal(existsSync(framePath), true, `${frame.src} exists`);
      assert.equal(statSync(framePath).size > 0, true, `${frame.src} non-empty`);
      const png = readFileSync(framePath);
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], frame.size, `${frame.src} dimensions match`);
    }
  }

  for (const pose of ['facing', 'leftSideProfile', 'rightSideProfile', 'facingShotgun', 'leftSideShotgun', 'rightSideShotgun']) {
    assert.equal(existsSync(fileURLToPath(new URL(`../${manifest.stills[pose].src}`, import.meta.url))), true, `${pose} still exists`);
  }
});

test('production Lester runtime art uses cropped per-frame cells instead of drawing whole sprite sheets', () => {
  const manifestPath = fileURLToPath(new URL('../apps/portal/assets/lester-production/lester-production-sprite-manifest.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const lester = HARD_MONEY_HEROES_ASSET_MANIFEST.playableCharacters.lester;

  assert.equal(lester.animations.idle.frameSource, 'cropped-production-sprite-cells');
  assert.equal(lester.animations.walk.frameSource, 'cropped-production-sprite-cells');
  assert.equal(lester.animations.run.frameSource, 'cropped-production-sprite-cells');
  assert.equal(lester.animations.jump.frameSource, 'cropped-production-sprite-cells');
  assert.equal(lester.animations.idle.frames.length, 25);
  assert.equal(lester.animations.run.frames.length, 25);
  assert.equal(lester.animations.idle.frames[0].src.includes('./assets/lester-production/frames/idle/lester-idle-00.png'), true);

  for (const state of ['idle', 'walk', 'run', 'jump']) {
    for (const frame of [manifest.animations[state].frames[0], manifest.animations[state].frames[7], manifest.animations[state].frames[14], manifest.animations[state].frames[21]]) {
      const framePath = fileURLToPath(new URL(`../${frame.src}`, import.meta.url));
      const metrics = alphaComponentMetrics(framePath);
      assert.deepEqual(frame.size, [128, 128], `${frame.src} is browser-sized`);
      assert.equal(metrics.opaquePixelCount > 350, true, `${frame.src} contains visible character pixels`);
      assert.equal(metrics.largestComponentRatio > 0.35, true, `${frame.src} is a single cropped pose, not a full multi-pose sheet`);
    }
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
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.productionDomain, 'lestersarcade.io');
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
  assert.deepEqual(LESTERS_ARCADE_V2_APP_SHELL.officialFlow, ['wallet-splash', 'arcade-walk-in', 'cabinet-select', 'hard-money-heroes-intro', 'mode-select', 'level-one-intro', 'begin-level']);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.gameIntro.videoSrc, './assets/video/hard-money-heroes-intro.mp4');
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.gameIntro.skipAllowed, true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.gameIntro.targetStep, 'mode-select');
  const hardMoneyHeroesCabinet = LESTERS_ARCADE_V2_APP_SHELL.cabinets.find((cabinet) => cabinet.id === 'hard-money-heroes');
  assert.equal(hardMoneyHeroesCabinet.playable, true);
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.id, 'hard-money-heroes-arcade-cabinet-rotation');
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.generatedFrom.includes('C:'), false);
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.frames.length >= 6, true);
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.frames.every((frame) => frame.src.endsWith('.png') && frame.width > 0 && frame.height > 0), true);
  for (const frame of hardMoneyHeroesCabinet.desktopCabinetSprite.frames) {
    const framePath = fileURLToPath(new URL(`../apps/portal/${frame.src.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(framePath) && statSync(framePath).size > 0, true, `${frame.src} exists`);
  }
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.cabinets.filter((cabinet) => cabinet.playable).length, 1);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.modeSelect.ranked.requiresZkLtc, true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.modeSelect.ranked.faucetUrl, LITVM_LITEFORGE_NETWORK.faucetUrl);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.levelIntro.durationSeconds, 8);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.levelIntro.hasBeginButton, true);
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

test('deeper combat spec codifies staged waves, health, pause menu, fullscreen modes, and paid restart gates', () => {
  const { levelOne, health, enemyAi, gameplayMenu, viewportModes, runStateSeparation } = LESTER_BLASTER_TACTICAL_COMBAT_V2;

  assert.deepEqual(levelOne.stageCountRange, [12, 14]);
  assert.deepEqual(levelOne.wavesPerPauseRange, [1, 3]);
  assert.deepEqual(levelOne.normalEnemiesOnScreenRange, [2, 3]);
  assert.deepEqual(levelOne.miniBossEnemiesOnScreenRange, [4, 5]);
  assert.equal(levelOne.miniBossEveryStages.includes(3), true);
  assert.equal(levelOne.miniBossEveryStages.includes(4), true);
  assert.equal(levelOne.finalBoss, 'randomized-from-boss-pool');
  assert.equal(levelOne.platformingSections.includes('timed gap jumps'), true);
  assert.equal(levelOne.platformingSections.includes('power-up pickup lanes'), true);

  assert.equal(health.playerMaxPercent, 100);
  assert.equal(health.damagePerNormalHitPercent, 5);
  assert.equal(health.deathAtPercent, 0);
  assert.equal(health.gameOverActions.includes('Play Again'), true);

  assert.equal(enemyAi.roles.includes('cover-shooter'), true);
  assert.equal(enemyAi.roles.includes('aggressive-melee-rusher'), true);
  assert.equal(enemyAi.rateOfFire, 'reduced-readable');
  assert.equal(enemyAi.coverDecision.includes('defensive'), true);
  assert.equal(enemyAi.readableTells.includes('attack-windup-bar'), true);

  assert.deepEqual(gameplayMenu.actions, ['Resume', 'Restart', 'Toggle Music On/Off', 'Swap Characters', 'Windowed / Fullscreen', 'Return to Game Menu', 'Exit Game']);
  assert.equal(gameplayMenu.screens.pause.title, 'Paused');
  assert.equal(gameplayMenu.screens.gameOver.title, 'Game Over');
  assert.equal(gameplayMenu.exitGameTarget, 'cabinet-select');
  assert.equal(gameplayMenu.restart.freeModeCost, 'free-restart-from-level-start');
  assert.equal(gameplayMenu.restart.paidModeCost, 'requires-new-paid-credit');
  assert.equal(viewportModes.default, 'fullscreen');
  assert.equal(viewportModes.available.includes('windowed'), true);
  assert.equal(viewportModes.available.includes('expanded-fullscreen'), true);
  assert.equal(runStateSeparation.freeMode, 'local-sandbox-only');
  assert.equal(runStateSeparation.paidMode, 'official-sync-only-at-game-over');
});

test('streamlined Lester arcade UX keeps public flow simple while preserving hidden tools and audio/gameplay polish hooks', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const indexSource = readFileSync(fileURLToPath(new URL('../apps/portal/index.html', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');

  assert.deepEqual(LESTERS_ARCADE_V2_APP_SHELL.publicFlow, ['connect-wallet', 'select-game', 'watch-or-skip-intro', 'choose-mode', 'begin-level', 'play']);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.primaryNav.length, 3);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.hiddenByDefault.includes('developer-backstage'), true);
  assert.equal(mainSource.includes('manifestEnemyArtFor'), true);
  assert.equal(mainSource.includes('ensureCombatMusic'), true);
  assert.equal(mainSource.includes('playSfxCue'), true);
  assert.equal(mainSource.includes("officialAppStep = 'wallet-splash'"), true);
  assert.equal(mainSource.includes('enterOfficialArcadeFromSplash'), true);
  assert.equal(mainSource.includes("officialAppStep = connectedWallet ? 'cabinet-select' : 'wallet-splash'"), true);
  assert.equal(mainSource.includes('clearInactiveCombatOverlay'), true);
  assert.equal(mainSource.includes("dom.officialGameStateCopy.textContent = ''"), true);
  assert.equal(mainSource.includes("setOfficialView('cabinet-select')"), true);
  assert.equal(mainSource.includes('renderArcadeIcon'), true);
  assert.equal(indexSource.includes('combatMenuActionGrid'), true);
  assert.equal(indexSource.includes('splashFeaturedCabinet'), true);
  assert.equal(indexSource.includes('./main.js?v=hmh-gamespecific-v23'), true);
  assert.equal(mainSource.includes('hardMoneyHeroScreenBackgroundProfile'), true);
  assert.equal(mainSource.includes('renderRotatingCabinetSprite'), true);
  assert.equal(mainSource.includes('desktopCabinetSprite'), true);
  assert.equal(mainSource.includes("node.style.backgroundSize = profile.backgroundSize"), true);
  assert.equal(styleSource.includes('.official-simplified-nav'), true);
  assert.equal(styleSource.includes('.hmh-cabinet-rotator'), true);
  assert.equal(styleSource.includes('object-fit: contain'), true);
  assert.equal(styleSource.includes('@keyframes hmhCabinetFloat'), true);
  assert.equal(styleSource.includes('@keyframes arcadePulse'), true);
});

test('Lester Arcade custom MP3 playlist manifest drives a global minimal music player and Hard Money Heroes queue', async () => {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(packageJson.scripts['assets:playlist'], 'python scripts/ingest-arcade-playlist-music.py');
  assert.equal(packageJson.scripts['assets:verify'].includes('verify-generated-assets'), true);
  assert.equal(packageJson.scripts.check.includes('scripts/ingest-arcade-playlist-music.py'), true);

  const manifestPath = fileURLToPath(new URL('../apps/portal/assets/audio/playlist/arcade-playlist-manifest.json', import.meta.url));
  const manifestModulePath = fileURLToPath(new URL('../apps/portal/src/arcade-playlist-manifest.mjs', import.meta.url));
  assert.equal(existsSync(manifestPath), true, 'playlist JSON manifest exists');
  assert.equal(existsSync(manifestModulePath), true, 'playlist ESM manifest exists');

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.id, 'lesters-arcade-custom-mp3-playlist-v1');
  assert.equal(manifest.tracks.length, 26);
  assert.equal(manifest.defaultQueue.length, 26);
  assert.deepEqual(manifest.gameQueues.hardMoneyHeroes.slice(0, 2), ['hard-money-heroes-16-bit-arcade-music', 'hard-money-heroes-16-bit-arcade-music-alt']);
  assert.equal(manifest.tracks.every((track) => track.src.startsWith('./assets/audio/playlist/') && track.src.endsWith('.mp3')), true);
  assert.equal(manifest.tracks.every((track) => track.durationSeconds > 30 && track.durationLabel.includes(':')), true);
  for (const track of manifest.tracks) {
    const trackPath = fileURLToPath(new URL(`../apps/portal/${track.src.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(trackPath) && statSync(trackPath).size > 0, true, `${track.src} exists`);
  }

  const core = await import('../apps/portal/src/arcade-core.mjs');
  assert.equal(core.LESTER_ARCADE_MUSIC_LIBRARY.tracks.length, 26);
  assert.equal(core.LESTER_ARCADE_MUSIC_LIBRARY.playerUi.position, 'global-overlay');
  assert.deepEqual(core.buildArcadeMusicQueueForContext('hard-money-heroes').slice(0, 2).map((track) => track.id), ['hard-money-heroes-16-bit-arcade-music', 'hard-money-heroes-16-bit-arcade-music-alt']);
  const player = core.buildArcadeMusicPlayerModel({ context: 'hard-money-heroes', currentTrackId: 'hard-money-heroes-16-bit-arcade-music', currentTimeSeconds: 67, playing: true, muted: false, expanded: false, shuffle: true });
  assert.equal(player.title, 'Hard Money Heroes — Main Theme');
  assert.equal(player.shuffle, true);
  assert.equal(player.controls.map((control) => control.id).join(','), 'previous,play-pause,mute,next,shuffle,expand');
  assert.equal(player.controls.find((control) => control.id === 'shuffle').active, true);
  assert.equal(player.progress.percent > 40 && player.progress.percent < 60, true);
  assert.equal(player.progress.label.includes('/'), true);
  assert.equal(core.chooseArcadeMusicNextIndex({ currentIndex: 0, queueLength: 4, shuffle: false }), 1);
  assert.equal(core.chooseArcadeMusicNextIndex({ currentIndex: 3, queueLength: 4, shuffle: false }), 0);
  assert.equal(core.chooseArcadeMusicNextIndex({ currentIndex: 1, queueLength: 4, shuffle: true, random: () => 0 }), 0);
  assert.equal(core.chooseArcadeMusicNextIndex({ currentIndex: 1, queueLength: 4, shuffle: true, random: () => 0.5 }), 2);
  assert.notEqual(core.chooseArcadeMusicNextIndex({ currentIndex: 1, queueLength: 4, shuffle: true, random: () => 0.99 }), 1);
  assert.equal(core.chooseArcadeMusicNextIndex({ currentIndex: -1, queueLength: 4, shuffle: false }), 0);
});

test('Lester Arcade music player overlay is wired into the public UI without forcing individual game music', () => {
  const indexSource = readFileSync(fileURLToPath(new URL('../apps/portal/index.html', import.meta.url)), 'utf8');
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');
  const smokeScript = readFileSync(fileURLToPath(new URL('../scripts/smoke-portal-flow.mjs', import.meta.url)), 'utf8');

  assert.equal(indexSource.includes('arcadeMusicPlayer'), true);
  assert.equal(indexSource.includes('arcadeMusicProgressFill'), true);
  assert.equal(indexSource.includes('arcadeMusicPreviousButton'), true);
  assert.equal(indexSource.includes('arcadeMusicNextButton'), true);
  assert.equal(indexSource.includes('arcadeMusicMuteButton'), true);
  assert.equal(indexSource.includes('arcadeMusicShuffleButton'), true);
  assert.equal(indexSource.includes('aria-pressed="false"'), true);
  assert.equal(mainSource.includes('buildArcadeMusicPlayerModel'), true);
  assert.equal(mainSource.includes('ensureArcadeMusicPlayer'), true);
  assert.equal(mainSource.includes('startArcadeMusicForGame'), true);
  assert.equal(mainSource.includes("startArcadeMusicForGame('hard-money-heroes')"), true);
  assert.equal(mainSource.includes('arcadeMusicAudio'), true);
  assert.equal(mainSource.includes('toggleArcadeMusicShuffle'), true);
  assert.equal(mainSource.includes('chooseArcadeMusicNextIndex'), true);
  assert.equal(mainSource.includes('normalizedIndex'), true);
  assert.equal(styleSource.includes('.arcade-music-player'), true);
  assert.equal(styleSource.includes('.arcade-music-progress-fill'), true);
  assert.equal(styleSource.includes('[data-expanded="true"]'), true);
  assert.equal(styleSource.includes('[data-shuffle="true"]'), true);
  assert.equal(smokeScript.includes('arcadeMusicPlayer'), true);
  assert.equal(smokeScript.includes('arcadeMusicShuffleButton'), true);
  assert.equal(smokeScript.includes('Hard Money Heroes 16-BIT Arcade Music'), true);
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

test('Hard Money Heroes manifest ingests Lester/Lilly weapon frames, first enemies, menu screens, and prototype music', () => {
  const manifest = HARD_MONEY_HEROES_ASSET_MANIFEST;
  assert.equal(manifest.id, 'hard-money-heroes-justin-assets-v1');
  assert.equal(manifest.generatedFrom.includes('source path redacted') || manifest.generatedFrom.includes('C:'), false);
  assert.equal(manifest.generatedFrom.includes('user-provided Hard Money Heroes art assets'), true);

  for (const actorId of ['lester', 'lilly']) {
    const actor = manifest.playableCharacters[actorId];
    assert.equal(actor.weapons.machineGun.available, true, `${actorId} machine gun still available`);
    assert.equal(actor.weapons.knife.available, true, `${actorId} knife/melee still available`);
    assert.equal(actor.weapons.grenade.available, true, `${actorId} grenade still available`);
    for (const state of ['idle', 'walk', 'run', 'jump', 'attack']) {
      assert.equal(actor.animations[state].frames.length >= 8, true, `${actorId} ${state} has selected frames`);
      assert.equal(actor.animations[state].selectedFrom.endsWith('.png'), true, `${actorId} ${state} tracks source sheet`);
      for (const frame of actor.animations[state].frames.slice(0, 4)) {
        const framePath = fileURLToPath(new URL(`../apps/portal/${frame.src.replace('./', '')}`, import.meta.url));
        assert.equal(existsSync(framePath) && statSync(framePath).size > 0, true, `${frame.src} exists`);
        const png = readFileSync(framePath);
        assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], frame.size, `${frame.src} dimensions match`);
      }
    }
  }

  assert.equal(manifest.playableCharacters.lester.weapons.pistol.preservedFromPreviousPass, true);
  assert.equal(manifest.playableCharacters.lester.weapons.shotgun.preservedFromPreviousPass, true);
  assert.equal(manifest.playableCharacters.lester.weapons.knife.stabAnimation.selectedFrom, 'Lester-stab.png');
  assert.equal(manifest.playableCharacters.lester.weapons.knife.stabAnimation.frames.length >= 8, true);
  for (const frame of manifest.playableCharacters.lester.weapons.knife.stabAnimation.frames.slice(0, 4)) {
    const framePath = fileURLToPath(new URL(`../apps/portal/${frame.src.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(framePath) && statSync(framePath).size > 0, true, `${frame.src} exists`);
    const png = readFileSync(framePath);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], frame.size, `${frame.src} dimensions match`);
  }

  assert.equal(manifest.enemies.trenchDegen.behavior.primary, 'slow-readable-melee');
  assert.equal(manifest.enemies.trenchDegen.behavior.secondary, 'occasional-low-rate-pistol');
  assert.equal(manifest.enemies.evilBanker.behavior.primary, 'fast-briefcase-melee-rusher');
  assert.equal(manifest.enemies.warrenSpearRider.behavior.spearThrowAccuracy, 0.6);
  assert.equal(manifest.enemies.warrenSpearRider.behavior.dodgeRequired, true);

  for (const screen of ['splash', 'mainMenu', 'options', 'modeSelect']) {
    const screenPath = fileURLToPath(new URL(`../apps/portal/${manifest.screens[screen].src.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(screenPath) && statSync(screenPath).size > 0, true, `${screen} screen exists`);
  }

  assert.equal(manifest.audio.musicTracks.length >= 4, true);
  assert.equal(manifest.audio.sfxPlan.weaponFire.includes('machine-gun'), true);
  assert.equal(manifest.audio.sfxPlan.enemyBarks.includes('warren-spear-rider-horse'), true);
});

test('Hard Money Heroes adds Crypto Bro and Gas Beast enemies plus extra Warren boss frames from the new art drop', () => {
  const manifest = HARD_MONEY_HEROES_ASSET_MANIFEST;
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');

  // New enemies present in the canonical manifest with readable behaviors.
  assert.equal(manifest.enemies.cryptoBro.id, 'crypto-bro');
  assert.equal(manifest.enemies.cryptoBro.title, 'Crypto Bro');
  assert.equal(typeof manifest.enemies.cryptoBro.behavior.primary, 'string');
  assert.equal(manifest.enemies.gasBeast.id, 'gas-beast');
  assert.equal(manifest.enemies.gasBeast.title, 'Gas Beast');
  assert.equal(typeof manifest.enemies.gasBeast.behavior.primary, 'string');

  // Every animation state for the two new enemies must resolve to real PNG frames on disk.
  for (const enemyKey of ['cryptoBro', 'gasBeast']) {
    const animations = manifest.enemies[enemyKey].art.animations;
    for (const state of ['idle', 'walk', 'run', 'jump', 'attack']) {
      assert.equal(animations[state].frames.length >= 8, true, `${enemyKey} ${state} has frames`);
      for (const frame of animations[state].frames.slice(0, 4)) {
        const framePath = fileURLToPath(new URL(`../apps/portal/${frame.src.replace('./', '')}`, import.meta.url));
        assert.equal(existsSync(framePath) && statSync(framePath).size > 0, true, `${frame.src} exists`);
        const png = readFileSync(framePath);
        assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], frame.size, `${frame.src} dimensions match`);
      }
    }
    for (const still of manifest.enemies[enemyKey].art.stills) {
      const stillPath = fileURLToPath(new URL(`../apps/portal/${still.src.replace('./', '')}`, import.meta.url));
      assert.equal(existsSync(stillPath) && statSync(stillPath).size > 0, true, `${still.src} exists`);
    }
  }

  // The extra Warren Spear Rider boss frames must be folded into the boss animation set.
  const bossAnimations = manifest.enemies.warrenSpearRider.art.animations;
  for (const state of ['idle', 'walk', 'run', 'jump']) {
    assert.equal(bossAnimations[state].frames.length >= 8, true, `warren ${state} retains frames`);
    const firstFrame = bossAnimations[state].frames[0];
    const framePath = fileURLToPath(new URL(`../apps/portal/${firstFrame.src.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(framePath) && statSync(framePath).size > 0, true, `warren ${state} frame exists`);
  }
  assert.equal(manifest.enemies.warrenSpearRider.extraFramesIngested, true);

  // Runtime must build art for the two new enemies and route them via the manifest key resolver.
  assert.equal(mainSource.includes("buildEnemyArtFromManifest('cryptoBro')"), true);
  assert.equal(mainSource.includes("buildEnemyArtFromManifest('gasBeast')"), true);
  assert.equal(mainSource.includes("'cryptoBro'"), true);
  assert.equal(mainSource.includes("'gasBeast'"), true);
});

test('Hard Money Heroes Level 1 environment manifest ingests the desert-to-city source trove for runtime staging', () => {
  const manifest = HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST;
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');

  assert.equal(manifest.id, 'hard-money-heroes-level1-environment-assets-v1');
  assert.equal(manifest.assetCount, 148);
  assert.equal(manifest.runtimeAssetCount, 148);
  assert.deepEqual(manifest.stageOrder, ['desert_approach', 'ghost_town', 'country_road', 'residential_edge', 'inner_city']);
  assert.equal(manifest.levelOneStages.length, 5);
  assert.equal(manifest.levelOneStages.every((stage) => stage.layers.length >= 4), true);
  assert.equal(manifest.levelOneStages.every((stage) => stage.props.length >= 3), true);
  assert.equal(manifest.levelOneStages.some((stage) => stage.ambient.includes('tree-wind-sway')), true);
  assert.equal(manifest.levelOneStages.some((stage) => stage.ambient.includes('neon-flicker')), true);

  for (const asset of manifest.assets.slice(0, 12)) {
    const assetPath = fileURLToPath(new URL(`../apps/portal/${asset.runtimeSrc.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(assetPath) && statSync(assetPath).size > 0, true, `${asset.id} runtime PNG exists`);
  }

  assert.equal(mainSource.includes('currentLevelOneEnvironmentStage'), true);
  assert.equal(mainSource.includes('drawAmbientEnvironmentProps'), true);
  assert.equal(mainSource.includes('drawEnvironmentLayer'), true);
  assert.equal(mainSource.includes('drawableEnvironmentProps'), true);
  assert.equal(mainSource.includes("scenic-prop-card"), true);
});

test('Hard Money Heroes runtime wires manifest art into official menus, hero switching, first enemy visuals, and gameplay controls', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const indexSource = readFileSync(fileURLToPath(new URL('../apps/portal/index.html', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');

  assert.equal(mainSource.includes('HARD_MONEY_HEROES_ASSET_MANIFEST'), true);
  assert.equal(mainSource.includes('buildCharacterArtFromManifest'), true);
  assert.equal(mainSource.includes('weaponAssets.knife?.stabAnimation'), true);
  assert.equal(mainSource.includes('hero.animations.knifeStab'), true);
  assert.equal(mainSource.includes('lastMeleeFrame'), true);
  assert.equal(mainSource.includes('combatArt.characters'), true);
  assert.equal(mainSource.includes('hardMoneyHeroScreenStyle'), true);
  assert.equal(mainSource.includes('manifestEnemyArtFor'), true);
  assert.equal(mainSource.includes('ctx.imageSmoothingEnabled = false'), true);
  assert.equal(mainSource.includes("if (!src) return null"), true);
  assert.equal(mainSource.includes('warrenSpearRider'), true);
  assert.equal(mainSource.includes('combat.characterId'), true);
  // Both heroes are now playable — the old "Lilly locked" teaser was replaced
  // with a Switch Hero action that returns to character-select.
  assert.equal(mainSource.includes('function switchHero'), true);
  assert.equal(mainSource.includes('showLillyTeaser'), false);
  assert.equal(mainSource.includes('function swapCombatCharacter'), false);
  assert.equal(mainSource.includes("combat.characterId = combat.characterId === 'lester' ? 'lilly' : 'lester'"), false);
  assert.equal(indexSource.includes('Lilly Locked'), false);
  assert.equal(indexSource.includes('Switch Hero'), true);
  assert.equal(indexSource.includes('officialGameplayControls'), true);
  assert.equal(styleSource.includes('.gameplay-control-bar'), true);
});

test('control display model does not leak undefined labels into the visible controls guide', () => {
  const controls = buildLesterBlasterControlDisplayModel();
  const move = controls.find((control) => control.label === 'Move');

  assert.equal(controls.length >= 6, true);
  assert.equal(move.key, 'WASD / Arrow Keys');
  assert.equal(controls.some((control) => control.label === 'Aim & Fire' && control.key.toLowerCase().includes('mouse')), true);
  assert.equal(controls.some((control) => control.label === 'Melee' && control.key === 'Left Click'), true);
  assert.equal(controls.some((control) => control.label === 'Throw' && control.key === 'Right Click'), true);
  assert.equal(controls.some((control) => control.label === 'Grenade' && control.key === 'F'), true);
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

test('public experience loop gives players a clean arcade entry, game over, and exit path without hidden Web3 writes', () => {
  assert.equal(LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.name, "Lester's Arcade public player loop");
  assert.deepEqual(
    LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.stageOrder,
    ['wallet-splash', 'arcade-entry', 'cabinet-select', 'game-intro-splash', 'mode-select', 'level-intro', 'gameplay', 'game-over-summary', 'return-to-arcade'],
  );
  assert.equal(LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.playerPromise.includes('under 45 seconds'), true);
  assert.equal(LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.modeBoundaries.free.tracks, false);
  assert.equal(LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.modeBoundaries.ranked.submissionTrigger, 'explicit-game-over-submit');
  assert.equal(LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.exitRamps.some((ramp) => ramp.id === 'return-to-arcade' && ramp.target === 'cabinet-select'), true);
  assert.equal(LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.exitRamps.some((ramp) => ramp.copy.includes('No hidden paid-run sync')), true);
});

test('game-over summary model separates free practice from ranked submit, replay, and arcade-exit actions', () => {
  const freeSession = startPlaySession({ wallet: '0x9999999999999999999999999999999999999999', gameId: 'lester-blaster', mode: 'free' });
  const paidSession = startPlaySession({ wallet: '0x9999999999999999999999999999999999999999', gameId: 'lester-blaster', mode: 'paid' });

  const freeSummary = buildGameOverSummaryModel({
    session: freeSession,
    score: 2440,
    elapsedSeconds: 184,
    kills: 14,
    bossesDefeated: 0,
    acceptedForGlobalLeaderboard: false,
  });
  const rankedSummary = buildGameOverSummaryModel({
    session: paidSession,
    score: 12840,
    elapsedSeconds: 402,
    kills: 37,
    bossesDefeated: 1,
    acceptedForGlobalLeaderboard: false,
  });
  const syncedSummary = buildGameOverSummaryModel({
    session: paidSession,
    score: 12840,
    elapsedSeconds: 402,
    kills: 37,
    bossesDefeated: 1,
    acceptedForGlobalLeaderboard: true,
  });

  assert.equal(freeSummary.channel, 'practice');
  assert.equal(freeSummary.trackingCopy.includes('not tracked'), true);
  assert.equal(freeSummary.actions.some((action) => action.id === 'submit-official-score'), false);
  assert.equal(freeSummary.actions.some((action) => action.id === 'play-again-free' && action.cost === 'free'), true);
  assert.equal(freeSummary.actions.some((action) => action.id === 'return-to-arcade' && action.target === 'cabinet-select'), true);

  assert.equal(rankedSummary.channel, 'official');
  assert.equal(rankedSummary.trackingCopy.includes('Submit Official Score'), true);
  assert.equal(rankedSummary.actions.some((action) => action.id === 'submit-official-score' && action.enabled), true);
  assert.equal(rankedSummary.actions.some((action) => action.id === 'play-again-ranked' && action.cost.includes('new testnet credit')), true);

  assert.equal(syncedSummary.actions.find((action) => action.id === 'submit-official-score').enabled, false);
  assert.equal(syncedSummary.trackingCopy.includes('synced'), true);
});

test('enemy AI state machine formalizes readable tells, cover choices, role caps, and recovery windows', () => {
  const ai = LESTER_BLASTER_ENEMY_AI_STATE_MACHINE;

  assert.deepEqual(ai.requiredStates, ['spawn', 'seek', 'telegraph', 'attack', 'recover', 'reposition', 'defeated']);
  assert.equal(ai.globalFairness.maxActiveAttackers, 2);
  assert.equal(ai.globalFairness.minTelegraphFrames >= 22, true);
  assert.equal(ai.globalFairness.recoveryFramesAfterAttack >= 18, true);
  assert.equal(ai.roles.coverShooter.transitions.some((transition) => transition.from === 'seek' && transition.to === 'take-cover'), true);
  assert.equal(ai.roles.meleeRusher.transitions.some((transition) => transition.to === 'telegraph'), true);
  assert.equal(ai.roles.flyerHarasser.safeLaneRule.includes('never overlap'), true);
  assert.equal(ai.roles.armoredPressure.counters.includes('Hash Rail'), true);

  const spawn = chooseEnemySpawn({ elapsedSeconds: 260, seed: 6 });
  assert.equal(spawn.ai.stateMachineRole in ai.roles, true);
  assert.equal(spawn.ai.telegraphFrames >= ai.globalFairness.minTelegraphFrames, true);
  assert.equal(spawn.ai.recoveryFrames >= ai.globalFairness.recoveryFramesAfterAttack, true);
});

test('workflow automation model turns future game-design improvements into repeatable research, asset, balance, and smoke-test gates', () => {
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.goal.includes('repeatable improvement pipeline'), true);
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.gates.some((gate) => gate.command === 'npm test'), true);
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.gates.some((gate) => gate.command === 'npm run check'), true);
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.gates.some((gate) => gate.command === 'npm run assets:verify'), true);
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.gates.some((gate) => gate.command === 'npm run contracts:check'), true);
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.loops.some((loop) => loop.id === 'research-to-canon' && loop.output.includes('docs/game-design')), true);
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.loops.some((loop) => loop.id === 'asset-ingestion' && loop.automation.includes('manifest')), true);
  assert.equal(LESTER_ARCADE_WORKFLOW_AUTOMATION.loops.some((loop) => loop.id === 'browser-smoke' && loop.automation.includes('public flow')), true);
});

test('player-led tactical camera advances only with rightward player pressure and limits backward travel', () => {
  const camera = LESTER_BLASTER_TACTICAL_CAMERA_MODEL;

  assert.equal(camera.mode, 'player-led-rightward-scroll');
  assert.equal(camera.autoScrollWhenIdle, false);
  assert.equal(camera.playerMaxScreenX >= 380, true);
  assert.equal(camera.engagementArenaWidthPixels >= 1000, true);
  assert.equal(camera.backwardAllowancePixels <= 160, true);

  const idle = advanceTacticalCameraModel({
    playerX: camera.cameraLeadStartX,
    scroll: 120,
    furthestScroll: 120,
    inputDirection: 0,
    stagePhase: 'travel',
  });
  assert.equal(idle.scrollDelta, 0);
  assert.equal(idle.scroll, 120);

  const advancing = advanceTacticalCameraModel({
    playerX: camera.cameraLeadStartX + 16,
    scroll: 120,
    furthestScroll: 120,
    inputDirection: 1,
    stagePhase: 'travel',
  });
  assert.equal(advancing.scroll > 120, true);
  assert.equal(advancing.scrollDelta > 0, true);
  assert.equal(advancing.playerX <= camera.cameraLeadStartX + 1, true);
  assert.equal(advancing.movementMode, 'camera-advance');

  const locked = advanceTacticalCameraModel({
    playerX: camera.cameraLeadStartX + 40,
    scroll: 240,
    furthestScroll: 260,
    inputDirection: 1,
    stagePhase: 'engagement',
    scrollLocked: true,
  });
  assert.equal(locked.scrollDelta, 0);
  assert.equal(locked.scroll, 240);
  assert.equal(locked.playerX <= camera.engagementPlayerMaxScreenX, true);

  const backingUp = advanceTacticalCameraModel({
    playerX: camera.backtrackFloorScreenX - 24,
    scroll: 260,
    furthestScroll: 520,
    inputDirection: -1,
    stagePhase: 'travel',
  });
  assert.equal(backingUp.playerX, camera.backtrackFloorScreenX);
  assert.equal(backingUp.scroll, 260);
  assert.equal(backingUp.furthestScroll, 520);
});

test('combat HUD and options models expose health, score, timer, power-ups, pause, audio, fullscreen, restart, and exit controls', () => {
  assert.deepEqual(LESTER_BLASTER_HUD_OVERLAY_MODEL.requiredWidgets, ['health', 'score', 'timer', 'power-ups', 'weapon', 'stage', 'status']);

  const hud = buildCombatHudOverlayModel({
    health: 73,
    score: 2450,
    elapsedSeconds: 95,
    grenades: 2,
    ammo: Infinity,
    weaponTitle: 'The Settler',
    powerUpsCollected: 3,
    stageIndex: 2,
    stageCount: 13,
    status: 'SCROLL LOCK // clear Stage 2 engagement',
  });

  assert.equal(hud.widgets.find((widget) => widget.id === 'health').value, '73%');
  assert.equal(hud.widgets.find((widget) => widget.id === 'score').value, '2,450');
  assert.equal(hud.widgets.find((widget) => widget.id === 'timer').value, '1:35');
  assert.equal(hud.widgets.find((widget) => widget.id === 'power-ups').value, 'THROW 2 // PICKUPS 3');
  assert.equal(hud.widgets.find((widget) => widget.id === 'weapon').value, 'THE SETTLER // AMMO ∞');
  assert.equal(hud.widgets.find((widget) => widget.id === 'status').value.includes('SCROLL LOCK'), true);

  const menu = buildCombatOptionsMenuModel({
    paused: true,
    gameOver: false,
    musicEnabled: false,
    viewportMode: 'windowed',
    currentMode: 'free',
  });
  const actionIds = menu.actions.map((action) => action.id);
  assert.equal(menu.title, 'Paused');
  assert.equal(actionIds.includes('resume'), true);
  assert.equal(actionIds.includes('restart'), true);
  assert.equal(actionIds.includes('toggle-music'), true);
  assert.equal(actionIds.includes('toggle-fullscreen'), true);
  assert.equal(actionIds.includes('return-to-game-menu'), true);
  assert.equal(actionIds.includes('exit-to-arcade'), true);
  assert.equal(menu.actions.find((action) => action.id === 'toggle-music').label, 'Music Off');
  assert.equal(menu.actions.find((action) => action.id === 'toggle-fullscreen').label, 'Full Screen');
});

test('asset coverage report identifies which playable and enemy animation states still need production art', () => {
  const report = buildHardMoneyHeroesAnimationCoverageReport(HARD_MONEY_HEROES_ASSET_MANIFEST);

  assert.deepEqual(report.requiredHeroStates, LESTER_BLASTER_ART_REDO_BRIEF.requiredHeroStates);
  assert.equal(report.characters.lester.availableAnimatedStates.includes('idle'), true);
  assert.equal(report.characters.lester.availableAnimatedStates.includes('run'), true);
  assert.equal(report.characters.lester.availableAnimatedStates.includes('jump'), true);
  assert.equal(report.characters.lester.coveredByStillStates.includes('shoot'), true);
  assert.equal(report.characters.lester.coveredByStillStates.includes('melee'), true);
  assert.equal(report.characters.lester.coveredByStillStates.includes('throw'), true);
  assert.equal(report.characters.lester.missingAnimatedStates.includes('crouch'), true);
  assert.equal(report.characters.lester.missingAnimatedStates.includes('hurt'), true);
  assert.equal(report.characters.lester.missingAnimatedStates.includes('death'), true);
  assert.equal(report.characters.lilly.missingAnimatedStates.includes('victory'), true);

  assert.equal(Object.keys(report.enemies).length >= 3, true);
  assert.equal(report.enemies.trenchDegen.availableAnimatedStates.includes('attack'), true);
  assert.equal(report.enemies.trenchDegen.missingAnimatedStates.includes('attack-tell'), true);
  assert.equal(report.enemies.evilBanker.missingAnimatedStates.includes('death'), true);
  assert.equal(report.recommendations.some((item) => item.includes('Aseprite')), true);
});

test('runtime exposes tactical HUD overlay, options popup, player-led camera, and animation coverage audit in the public app', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const indexSource = readFileSync(fileURLToPath(new URL('../apps/portal/index.html', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');

  assert.equal(mainSource.includes('buildGameOverSummaryModel'), true);
  assert.equal(mainSource.includes('submitCombatGameOver'), true);
  assert.equal(mainSource.includes('renderGameOverSummary'), true);
  assert.equal(mainSource.includes('No hidden paid-run sync'), true);
  assert.equal(mainSource.includes('advanceTacticalCameraModel'), true);
  assert.equal(mainSource.includes('applyPlayerLedCameraMovement'), true);
  assert.equal(mainSource.includes('isoToScreen'), true);
  assert.equal(mainSource.includes('playerMapX'), true);
  assert.equal(mainSource.includes('playerMapY'), true);
  assert.equal(mainSource.includes('levelUpChoices'), true);
  assert.equal(mainSource.includes('openLevelUpMenu'), true);
  assert.equal(mainSource.includes('requestCombatFullscreen'), true);
  assert.equal(mainSource.includes('document.fullscreenElement'), true);
  assert.equal(mainSource.includes('renderCombatHudOverlay'), true);
  assert.equal(mainSource.includes('buildHardMoneyHeroesAnimationCoverageReport'), true);
  assert.equal(indexSource.includes('combatGameOverSummary'), true);
  assert.equal(indexSource.includes('combatHudOverlay'), true);
  assert.equal(styleSource.includes('.game-over-summary-grid'), true);
  assert.equal(styleSource.includes('.summary-metric-card'), true);
  assert.equal(styleSource.includes('.combat-hud-overlay'), true);
  assert.equal(styleSource.includes('.hud-widget'), true);
  assert.equal(styleSource.includes(':fullscreen'), true);
  assert.equal(styleSource.includes('100vw'), true);
  assert.equal(styleSource.includes('100vh'), true);
});

test('tactical level tuning expands rooms with cover lanes, prop spacing, and slower readable enemy pacing', () => {
  const tuning = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning;
  assert.equal(tuning.engagementArenaWidthPixels >= 1320, true);
  assert.equal(tuning.playerStrafeLanePixels >= 360, true);
  assert.equal(tuning.minCoverSpacingPixels >= 120, true);
  assert.deepEqual(tuning.requiredCoverKinds, ['player-cover', 'enemy-cover', 'destructible-crate', 'explosive-barrel', 'vertical-platform']);
  assert.equal(tuning.enemySpawnDelayFrames >= 50, true);
  assert.equal(tuning.rangedShotCooldownFrames >= 120, true);
  assert.equal(LESTER_BLASTER_TACTICAL_CAMERA_MODEL.engagementArenaWidthPixels, tuning.engagementArenaWidthPixels);

  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.equal(mainSource.includes('tacticalRoomTuning.coverPlacements'), true);
  assert.equal(mainSource.includes('tacticalRoomTuning.platformPlacements'), true);
  assert.equal(mainSource.includes('tacticalRoomTuning.enemySpawnDelayFrames'), true);
});

test('animation production briefs convert missing coverage into no-placeholder art requests', () => {
  const coverage = buildHardMoneyHeroesAnimationCoverageReport();
  const briefs = buildHardMoneyHeroesAnimationProductionBriefs(coverage);

  assert.equal(LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.placeholderPolicy, 'briefs-only-no-shipping-placeholder-sprites');
  assert.deepEqual(LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.heroPriorityStates.slice(0, 5), ['crouch', 'hurt', 'death', 'victory', 'fall']);
  assert.equal(briefs.placeholderPolicy, 'No placeholder production sprites are generated by this tool; it emits art-direction briefs and manifest requirements only.');
  assert.equal(briefs.heroes.lester.requests.some((request) => request.state === 'crouch' && request.frameCount >= 6), true);
  assert.equal(briefs.heroes.lilly.requests.some((request) => request.state === 'hurt' && request.readabilityGoal.includes('damage')), true);
  assert.equal(briefs.enemies.trenchDegen.requests.some((request) => request.state === 'attack-tell' && request.aiPurpose.includes('telegraph')), true);
  assert.equal(briefs.enemies.evilBanker.requests.some((request) => request.state === 'death' && request.manifestState === 'death'), true);
  assert.equal(briefs.summary.heroRequestCount >= 10, true);
  assert.equal(briefs.summary.enemyRequestCount >= 12, true);
  assert.equal(briefs.pipeline.some((step) => step.command === 'npm run design:audit'), true);
  assert.equal(briefs.pipeline.some((step) => step.command === 'npm run assets:verify'), true);
});

test('dev tactical balance overlay exposes camera, cover, and enemy AI diagnostics without leaking into default public UI', () => {
  assert.equal(LESTER_BLASTER_DEV_BALANCE_OVERLAY.enabledByDefault, false);
  assert.equal(LESTER_BLASTER_DEV_BALANCE_OVERLAY.queryParam, 'hmhDebug');
  assert.deepEqual(LESTER_BLASTER_DEV_BALANCE_OVERLAY.layers.map((layer) => layer.id), ['camera-bounds', 'player-lanes', 'arena-locks', 'enemy-ai', 'cover-props']);

  const overlay = buildTacticalBalanceDebugOverlayModel({
    debugEnabled: true,
    playerX: 318,
    scroll: 144,
    furthestScroll: 200,
    stagePhase: 'travel',
    scrollLocked: false,
    stageTravel: 73,
    stageTravelGoal: 254,
    enemies: [
      { role: 'cover-shooter', state: 'telegraph', x: 520, attackTimer: 44 },
      { role: 'aggressive-melee-rusher', state: 'seek', x: 390, attackTimer: 91 },
    ],
    props: [
      { kind: 'crate', cover: true, x: 180, w: 54 },
      { kind: 'barrel', explosive: true, x: 340, w: 34 },
    ],
  });

  assert.equal(overlay.enabled, true);
  assert.equal(overlay.publicUiDefault, 'hidden');
  assert.equal(overlay.metrics.camera.mode, 'player-led-rightward-scroll');
  assert.equal(overlay.metrics.camera.backtrackLimit, '128px');
  assert.equal(overlay.metrics.stage.progress, '73/254M');
  assert.equal(overlay.metrics.enemies.count, 2);
  assert.equal(overlay.metrics.enemies.telegraphing, 1);
  assert.equal(overlay.metrics.cover.coverCount, 1);
  assert.equal(overlay.metrics.cover.explosiveCount, 1);
  assert.equal(overlay.layers.some((layer) => layer.id === 'enemy-ai' && layer.items.some((item) => item.includes('telegraph'))), true);
});

test('next-move workflow automation includes interaction smoke and weekly design review outputs', () => {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(packageJson.scripts['smoke:portal:interactions'], 'node scripts/smoke-portal-interactions.mjs');
  assert.equal(packageJson.scripts['design:weekly'], 'node scripts/write-hmh-weekly-design-review.mjs');
  assert.equal(packageJson.scripts['verify:full'].includes('npm run smoke:portal:interactions'), true);
  assert.equal(packageJson.scripts['verify:full'].includes('npm run design:weekly'), true);

  const interactionSmokeScript = readFileSync(fileURLToPath(new URL('../scripts/smoke-portal-interactions.mjs', import.meta.url)), 'utf8');
  const weeklyScript = readFileSync(fileURLToPath(new URL('../scripts/write-hmh-weekly-design-review.mjs', import.meta.url)), 'utf8');
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const indexSource = readFileSync(fileURLToPath(new URL('../apps/portal/index.html', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');

  assert.equal(interactionSmokeScript.includes('wallet-profile-free-ranked-exit'), true);
  assert.equal(interactionSmokeScript.includes('combatHudOverlay'), true);
  assert.equal(interactionSmokeScript.includes('clearInactiveCombatOverlay'), true);
  assert.equal(interactionSmokeScript.includes('buildTacticalBalanceDebugOverlayModel'), true);
  assert.equal(weeklyScript.includes('hard-money-heroes-weekly-design-review.md'), true);
  assert.equal(weeklyScript.includes('animation-coverage-action-plan'), true);
  assert.equal(weeklyScript.includes('tactical-balance-snapshot'), true);
  assert.equal(mainSource.includes('renderTacticalBalanceDebugOverlay'), true);
  assert.equal(mainSource.includes('hmhDebug=balance'), true);
  assert.equal(mainSource.includes('playerX: combat.playerX'), true);
  assert.equal(mainSource.includes('combat.player.x'), false);
  assert.equal(indexSource.includes('tacticalBalanceDebugOverlay'), true);
  assert.equal(styleSource.includes('.tactical-debug-overlay'), true);
});

test('animation production prompt generator writes per-character and per-enemy request docs', () => {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(packageJson.scripts['design:animation-prompts'], 'node scripts/write-hmh-animation-production-requests.mjs');
  assert.equal(packageJson.scripts['verify:full'].includes('npm run design:animation-prompts'), true);
  assert.equal(packageJson.scripts.check.includes('scripts/write-hmh-animation-production-requests.mjs'), true);

  const promptScript = readFileSync(fileURLToPath(new URL('../scripts/write-hmh-animation-production-requests.mjs', import.meta.url)), 'utf8');
  assert.equal(promptScript.includes('buildHardMoneyHeroesAnimationProductionBriefs'), true);
  assert.equal(promptScript.includes('hard-money-heroes-animation-production-requests.md'), true);
  for (const actor of ['lester', 'lilly', 'trenchDegen', 'evilBanker', 'warrenSpearRider']) {
    assert.equal(promptScript.includes(actor), true);
  }
  assert.equal(promptScript.includes('negativePrompt'), true);
  assert.equal(promptScript.includes('transparent PNG frames'), true);
  assert.equal(promptScript.includes('Do not generate shipping placeholder sprites'), true);
});

test('workflow automation scripts emit animation coverage, balance snapshots, and public smoke gates', () => {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(packageJson.scripts['design:audit'], 'node scripts/report-hmh-animation-coverage.mjs');
  assert.equal(packageJson.scripts['design:balance'], 'node scripts/write-hmh-balance-snapshot.mjs');
  assert.equal(packageJson.scripts['smoke:portal'], 'node scripts/smoke-portal-flow.mjs');
  assert.equal(packageJson.scripts['verify:full'].includes('npm run design:audit'), true);
  assert.equal(packageJson.scripts['verify:full'].includes('npm run smoke:portal'), true);

  const animationScript = readFileSync(fileURLToPath(new URL('../scripts/report-hmh-animation-coverage.mjs', import.meta.url)), 'utf8');
  const balanceScript = readFileSync(fileURLToPath(new URL('../scripts/write-hmh-balance-snapshot.mjs', import.meta.url)), 'utf8');
  const smokeScript = readFileSync(fileURLToPath(new URL('../scripts/smoke-portal-flow.mjs', import.meta.url)), 'utf8');
  assert.equal(animationScript.includes('buildHardMoneyHeroesAnimationCoverageReport'), true);
  assert.equal(balanceScript.includes('LESTER_BLASTER_TACTICAL_COMBAT_V2'), true);
  assert.equal(smokeScript.includes('officialConnectButton'), true);
  assert.equal(smokeScript.includes('hmh-visual-polish-v9'), true);
  assert.equal(smokeScript.includes('findOpenSmokePort'), true);
  assert.equal(smokeScript.includes('splashFeaturedCabinet'), true);
  assert.equal(smokeScript.includes("officialAppStep = connectedWallet ? 'cabinet-select' : 'wallet-splash'"), true);
  assert.equal(smokeScript.includes('combatHudOverlay'), true);
});

test('buildHardMoneyHeroesStatsModule returns a game-specific breakdown', () => {
  const state = createInitialArcadeState();
  const wallet = '0xabc0000000000000000000000000000000000abc';
  // Seed a ranked run with per-enemy-type kills, power-ups, and survival time.
  const profile = createPlayerProfile(wallet);
  state.profiles[profile.wallet] = profile;
  const progress = profile.progress['lester-blaster'];
  progress.enemyKillsByType = { 'fud-goblin': 40, 'gas-beast': 9, 'boss:any': 2 };
  progress.bossKills = 2;
  progress.cumulativePowerUps = 17;
  progress.longestRunSeconds = 372; // 6:12
  progress.totalKills = 51;

  const mod = buildHardMoneyHeroesStatsModule(state, wallet);
  assert.equal(mod.gameTitle, 'Hard Money Heroes');
  assert.equal(mod.powerUpsGrabbed, 17);
  assert.equal(mod.longestSurvivalLabel, '6:12');
  assert.equal(mod.bossKills, 2);
  // Enemy breakdown is sorted by kills desc and resolves readable titles.
  assert.equal(mod.enemyBreakdown[0].title, 'FUD Goblin');
  assert.equal(mod.enemyBreakdown[0].kills, 40);
  // Boss-prefixed keys are separated out.
  assert.ok(mod.bossBreakdown.some((b) => b.kills === 2));
  // Top achievement is the rarest unlocked (login achievement on fresh profile).
  assert.ok(mod.topAchievement === null || typeof mod.topAchievement.rarityPct === 'number');
  assert.equal(mod.achievementsTotal, Object.values(ACHIEVEMENTS).length);
});

test('achievementRarityPct orders rarer tiers lower', () => {
  const bronze = achievementRarityPct({ tier: 'bronze', difficulty: 'easy' });
  const platinum = achievementRarityPct({ tier: 'platinum', difficulty: 'expert' });
  assert.ok(platinum < bronze, 'platinum should be rarer (lower %) than bronze');
  assert.ok(bronze <= 99 && platinum >= 1);
});

test('roguelike power-ups expose the effect contract the runtime depends on', () => {
  // main.js applyRoguelikePowerUp() switches on `effect` and reads `durationSeconds`
  // for timed buffs. These assertions lock the data contract so a rename/removal
  // in core fails loudly instead of silently breaking the in-game power-ups.
  const byId = Object.fromEntries(LESTER_BLASTER_POWER_UPS.map((p) => [p.id, p]));

  const magnet = byId['magnet-surge'];
  assert.ok(magnet, 'magnet-surge power-up must exist');
  assert.equal(magnet.effect, 'magnet');
  assert.ok(magnet.durationSeconds > 0, 'magnet is a timed buff');

  const slow = byId['time-dilation'];
  assert.ok(slow, 'time-dilation power-up must exist');
  assert.equal(slow.effect, 'slowEnemies');
  assert.ok(slow.durationSeconds > 0, 'slow is a timed buff');

  const berserk = byId['berserk-candle'];
  assert.ok(berserk, 'berserk-candle power-up must exist');
  assert.equal(berserk.effect, 'berserk');
  assert.ok(berserk.durationSeconds > 0, 'berserk is a timed buff');

  const nuke = byId['nuke-liquidation'];
  assert.ok(nuke, 'nuke-liquidation power-up must exist');
  assert.equal(nuke.effect, 'screenNuke');
  // The nuke is instantaneous (no duration) — clears the screen on pickup.
  assert.equal(nuke.durationSeconds, undefined);

  // Every power-up carries the fields the icon resolver + collector rely on.
  for (const p of LESTER_BLASTER_POWER_UPS) {
    assert.equal(typeof p.id, 'string');
    assert.equal(typeof p.title, 'string');
    assert.equal(typeof p.effect, 'string');
  }
});


