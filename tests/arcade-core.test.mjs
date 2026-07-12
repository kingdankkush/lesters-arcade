import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { HMH_HD_SPRITE_ATLAS_MANIFEST } from '../apps/portal/assets/generated/hmh-hd-sprite-atlas.mjs';
import { HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG } from '../apps/portal/src/hmh-character-config.mjs';
import {
  buildLevelOneCuratedVisibleSceneObjects,
  levelOneCuratedAssetSrc,
} from '../apps/portal/src/hmh-level-one-visible-runtime.mjs';

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
  HMH_WEAPON_EVOLUTION_LIBRARY,
  buildRoguelikePowerMomentState,
  buildRoguelikeSynergyHudModel,
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
  buildLeaderboardExperienceV2Model,
  buildLesterBlasterControlDisplayModel,
  buildCombatHudOverlayModel,
  buildCombatAccessibilitySettingsModel,
  buildCombatOptionsMenuModel,
  buildCombatPauseGate,
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
  buildProfileExperienceV2Model,
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
  roguelikeXpCostForLevel,
  ROGUELIKE_LEVEL_CAP,
  POST_CAP_XP_TO_SCORE,
  LEVEL_ONE_THREAT_BEAT_TYPES,
  calculateRoguelikeKillXp,
  grantRoguelikeXp,
  applyRoguelikeSkillUpgrade,
  calculateExtractionScore,
  getHmhLevelTarget,
  HMH_LEVEL_TARGETS,
  HMH_LEVEL_ONE_PLAYTEST_BALANCE,
  HMH_LEVEL_ONE_SHIP_FOCUS,
  buildLevelOnePlaytestBalanceModel,
  buildLevelOneRunWorldDimensions,
  buildLevelOneBoundaryObstaclesNear,
  levelOneRoguelikeSpawnDirectorAt,
  levelOneThreatBeatSchedule,
  levelOneRoguelikeDropChance,
  levelOneRoguelikePickupAssistAt,
  levelOneRoguelikePerformanceBudgetAt,
  levelOneRoguelikeBossProxyRoster,

  recordScore,
  applySettlement,
  resolveAchievementUnlocksForRun,
  scheduleBossEncounter,
  startPlaySession,
  nextGlobalSessionId,
  AVATAR_RULES,
  validateAvatarFile,
  computeAvatarResize,
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

test('WO-58 profile v2 model builds trophy room, session feed, achievements, collection, privacy, and editing controls', async () => {
  const state = createInitialArcadeState();
  const wallet = '0x1212121212121212121212121212121212121212';
  connectPlayerAccount(state, wallet, { handle: 'TrophyKing' });
  const hmhHandle = nextGlobalSessionId(state);
  const sessionA = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid', urlSessionId: hmhHandle.urlSessionId, sequenceNumber: hmhHandle.sequence });
  const resultA = recordScore(state, sessionA, 7200, {
    elapsedSeconds: 362,
    kills: 18,
    bossId: 'rug-pull-tank',
    maxCombo: 11,
    collectedPowerUps: ['shield', 'multiplier', 'health'],
    stageIndexReached: 13,
  });
  const chikunHandle = nextGlobalSessionId(state);
  const sessionB = startPlaySession({ wallet, gameId: 'chikun', mode: 'paid', urlSessionId: chikunHandle.urlSessionId, sequenceNumber: chikunHandle.sequence, allowDevCabinet: true });
  recordScore(state, sessionB, 1280, { elapsedSeconds: 94, coins: 17, maxCombo: 4 });
  applySettlement(state, {
    ...resultA.settlementInput,
    mode: 'simulated',
    settled: true,
    primaryTxHash: '0x' + '5'.repeat(64),
    receipts: [],
    settledAt: '2026-07-03T12:00:00.000Z',
  });
  state.profiles[wallet].preferences.profileVisibility = 'unlisted';

  const model = buildProfileExperienceV2Model(state, wallet, { selectedGameId: 'lester-blaster' });

  assert.equal(model.profile.displayName, 'TrophyKing');
  assert.equal(model.privacy.current, 'unlisted');
  assert.deepEqual(model.privacy.options.map((option) => option.id), ['public', 'unlisted', 'private']);
  assert.equal(model.editing.username.enabled, true);
  assert.equal(model.editing.avatar.maxBytes, 2 * 1024 * 1024);
  assert.equal(model.editing.privacy.enabled, true);

  assert.equal(model.trophyRoom.summary.totalRankedRuns, 2);
  assert.equal(model.trophyRoom.summary.settledRuns, 1);
  assert.equal(model.trophyRoom.cards.some((card) => card.id === 'best-score' && card.value === '7,200'), true);
  assert.equal(model.trophyRoom.cards.some((card) => card.id === 'rare-achievement' && card.tier), true);

  assert.equal(model.sessionFeed.rows.length, 2);
  assert.equal(model.sessionFeed.rows[0].gameId, 'chikun');
  assert.match(model.sessionFeed.rows[0].detailHref, /^\/play\/chikun\/game-session-/);
  assert.equal(model.sessionFeed.rows[1].trust.label, 'Settled');

  assert.equal(model.achievements.summary.unlocked >= 4, true);
  assert.equal(model.achievements.groups.some((group) => group.id === 'bronze' && group.unlocked > 0), true);
  assert.equal(model.achievements.recent.length > 0, true);

  assert.equal(model.collection.games.some((game) => game.id === 'lester-blaster' && game.played && game.bestScore === 7200), true);
  assert.equal(model.collection.games.some((game) => game.id === 'chikun' && game.played && game.bestScore === 1280), true);
  assert.equal(model.collection.characters.some((character) => character.id === 'lester-original' && character.unlocked), true);
});

test('player profiles initialize configurable character unlocks and selected-character preference', () => {
  const wallet = '0x' + 'a'.repeat(40);
  const profile = createPlayerProfile(wallet);
  for (const starterId of HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.startersLegacyIds) {
    assert.equal(profile.unlocks.characters[starterId], true);
  }
  assert.equal(profile.preferences.selectedCharacterId, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId);
});

test('WO-95 settled ranked matches unlock Lester at 10 and Lilly at 20 while free runs do not count', () => {
  const state = createInitialArcadeState();
  const wallet = '0x' + 'b'.repeat(40);

  for (let index = 0; index < 30; index += 1) {
    const freeSession = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'free' });
    recordScore(state, freeSession, 900 + index, { elapsedSeconds: 90, bossId: null, stageIndexReached: 1 });
  }
  assert.equal(state.profiles[wallet].unlocks.characters['lester-original'], false);
  assert.equal(state.profiles[wallet].unlocks.characters.lilly, false);

  for (let index = 0; index < 9; index += 1) {
    const session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
    recordScore(state, session, 1000 + index, { elapsedSeconds: 120, bossId: null, stageIndexReached: 2 });
  }
  assert.equal(state.profiles[wallet].unlocks.characters['lester-original'], false);
  assert.equal(state.profiles[wallet].unlocks.characters.lilly, false);

  let session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(state, session, 2000, { elapsedSeconds: 120, bossId: null, stageIndexReached: 2 });
  assert.equal(state.profiles[wallet].unlocks.characters['lester-original'], true);
  assert.equal(state.profiles[wallet].unlocks.characters.lilly, false);

  for (let index = 10; index < 19; index += 1) {
    session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
    recordScore(state, session, 2000 + index, { elapsedSeconds: 120, bossId: null, stageIndexReached: 2 });
  }
  assert.equal(state.profiles[wallet].unlocks.characters.lilly, false);

  session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(state, session, 3000, { elapsedSeconds: 120, bossId: null, stageIndexReached: 2 });
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  assert.equal(snapshot.profile.totalPaidRuns, 20);
  assert.equal(snapshot.profile.unlocks.characters['lester-original'], true);
  assert.equal(snapshot.profile.unlocks.characters.lilly, true);
});

test('WO-95 old Level 1 clear profiles keep Lester unlocked through migration', () => {
  const state = createInitialArcadeState();
  const wallet = '0x' + 'c'.repeat(40);
  const profile = createPlayerProfile(wallet);
  profile.achievements.push('getaway-clear');
  profile.unlocks.characters['lester-original'] = false;
  state.profiles[wallet] = profile;
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  assert.equal(snapshot.profile.unlocks.characters['lester-original'], true);
  assert.equal(snapshot.profile.unlocks.characters.lilly, false);
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
  assert.deepEqual(guest.permissions.writeScopes, ['ranked testnet sessions', 'profile progress', 'achievements', 'official scores', 'transaction receipts']);
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

test('paid mode session uses free-entry (testnet) economics and leaderboard eligibility', () => {
  const session = startPlaySession({ wallet: '0x2222222222222222222222222222222222222222', gameId: 'lester-blaster', mode: 'paid' });

  assert.equal(session.isPaid, true);
  assert.equal(session.leaderboardEligible, true);
  assert.equal(session.lives, 3);
  assert.equal(session.entryFeeMicroUsdc, 0); // free on testnet
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
  const route = plan.calls.find((c) => c.method === 'startPaidSession');
  assert.ok(route, 'plan should include a startPaidSession routing call');
  // Hardened ArcadePaymentRouter derives the dev wallet/splits from GameRegistry;
  // the client plan may not inject routing destinations anymore.
  assert.deepEqual(Object.keys(route.args).sort(), ['amount', 'gameId', 'sessionId']);
  assert.equal(route.args.amount, 250_000);
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
  assert.equal(snapshot.transactions[0].amountMicroUsdc, 0); // free on testnet
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
  const settlement = await settleRun(plan, { live: false });
  applySettlement(state, settlement);
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  assert.equal(snapshot.settlements[0].mode, 'simulated');
  assert.equal(snapshot.settlements[0].primaryTxHash, null);
  assert.ok(snapshot.settlements[0].primarySimulatedTxHash.startsWith('sim:'));
  assert.equal(state.leaderboards['lester-blaster'][0].settlementTxHash, null);
  assert.equal(state.leaderboards['lester-blaster'][0].settlementSimulatedTxHash, settlement.primarySimulatedTxHash);
});

test('applySettlement dedupes settlement retries by sessionId', async () => {
  const { applySettlement } = await import('../apps/portal/src/arcade-core.mjs');
  const { buildSettlementPlan, settleRun } = await import('../apps/portal/src/settlement.mjs');
  const state = createInitialArcadeState();
  const wallet = '0x9999999999999999999999999999999999999999';
  const session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(state, session, 2222, { elapsedSeconds: 99 });

  const settlement = await settleRun(buildSettlementPlan({ wallet, gameId: 'lester-blaster', sessionId: session.sessionId, score: 2222 }), { live: false });
  applySettlement(state, settlement);
  applySettlement(state, settlement);

  assert.equal(state.settlements.filter((row) => row.sessionId === session.sessionId).length, 1);
});

test('applySettlement persists a suspicious integrity verdict onto the session and flaggedSessions', async () => {
  const { applySettlement } = await import('../apps/portal/src/arcade-core.mjs');
  const { buildSettlementPlan, settleRun } = await import('../apps/portal/src/settlement.mjs');
  const state = createInitialArcadeState();
  const wallet = '0x7777777777777777777777777777777777777777';
  const session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(state, session, 4000, { elapsedSeconds: 200, bossId: 'rug-pull-tank' });

  const plan = buildSettlementPlan({ wallet, gameId: 'lester-blaster', sessionId: session.sessionId, score: 4000 });
  const settlement = await settleRun(plan, { live: false });
  // Attach a suspicious verdict the way settleRankedRun() does in main.js.
  settlement.integrity = { verdict: 'suspicious', flags: [{ code: 'score-implausible', severity: 'suspect', detail: 'test' }] };
  applySettlement(state, settlement);

  assert.equal(state.sessions[session.sessionId].integrity.verdict, 'suspicious');
  assert.equal(state.sessions[session.sessionId].integrity.flags[0].code, 'score-implausible');
  assert.ok(Array.isArray(state.flaggedSessions));
  assert.equal(state.flaggedSessions.length, 1);
  assert.equal(state.flaggedSessions[0].sessionId, session.sessionId);
  assert.equal(state.flaggedSessions[0].verdict, 'suspicious');
  assert.equal(state.flaggedSessions[0].wallet, wallet);
});

test('applySettlement does not record an ok integrity verdict as a flag', async () => {
  const { applySettlement } = await import('../apps/portal/src/arcade-core.mjs');
  const { buildSettlementPlan, settleRun } = await import('../apps/portal/src/settlement.mjs');
  const state = createInitialArcadeState();
  const wallet = '0x8888888888888888888888888888888888888888';
  const session = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(state, session, 1500, { elapsedSeconds: 90 });

  const plan = buildSettlementPlan({ wallet, gameId: 'lester-blaster', sessionId: session.sessionId, score: 1500 });
  const settlement = await settleRun(plan, { live: false });
  settlement.integrity = { verdict: 'ok', flags: [] };
  applySettlement(state, settlement);

  assert.equal(state.sessions[session.sessionId].integrity, undefined);
  assert.ok(!state.flaggedSessions || state.flaggedSessions.length === 0);
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

test('WO-57 leaderboard v2 builds cached indexed rows with trust and detail UI metadata', async () => {
  const { applySettlement, resolveDisplayName } = await import('../apps/portal/src/arcade-core.mjs');
  const state = createInitialArcadeState();
  const wallets = ['0x' + 'a'.repeat(40), '0x' + 'b'.repeat(40), '0x' + 'c'.repeat(40)];
  wallets.forEach((wallet) => connectPlayerAccount(state, wallet));

  const sessions = wallets.map((wallet, index) => startPlaySession({
    wallet,
    gameId: 'lester-blaster',
    mode: 'paid',
    sequenceNumber: 570 + index,
    urlSessionId: `game-session-00000057${index}`,
  }));
  recordScore(state, sessions[0], 2200, { elapsedSeconds: 90, kills: 12, bossId: null });
  recordScore(state, sessions[1], 4400, { elapsedSeconds: 140, kills: 33, bossId: 'rug-pull-tank' });
  recordScore(state, sessions[2], 3300, { elapsedSeconds: 100, kills: 20, bossId: null });
  applySettlement(state, {
    mode: 'simulated',
    wallet: wallets[1],
    gameId: 'lester-blaster',
    sessionId: sessions[1].sessionId,
    primaryTxHash: '0x' + '5'.repeat(64),
    settledAt: '2026-07-03T12:00:00.000Z',
    receipts: [],
    integrity: { verdict: 'suspicious', flags: [{ code: 'score-implausible', severity: 'suspect', detail: 'unit test' }] },
  });

  const first = buildLeaderboardExperienceV2Model(state, {
    gameId: 'lester-blaster',
    cadence: 'all-time',
    wallet: wallets[0],
    displayNameFor: (wallet) => resolveDisplayName(state.profiles[wallet], wallet),
  });
  assert.equal(first.cache.status, 'rebuilt');
  assert.match(first.cache.key, /lester-blaster:all-time:all-time/);
  assert.equal(first.trustSummary.totalRankedRuns, 3);
  assert.equal(first.trustSummary.settledRuns, 1);
  assert.equal(first.trustSummary.flaggedRuns, 1);
  assert.equal(first.rows[0].score, 4400);
  assert.equal(first.rows[0].trust.verdict, 'suspicious');
  assert.equal(first.rows[0].trust.label, 'Needs review');
  assert.equal(first.rows[0].sessionDetail.urlSessionId, 'game-session-000000571');
  assert.equal(first.rows[0].sessionDetail.detailHref, '/play/hard-money-heroes/game-session-000000571');
  assert.equal(first.rows[0].sessionDetail.runStats.kills, 33);
  assert.equal(state.leaderboardIndexes.bySessionId[sessions[1].sessionId].rank, 1);
  assert.equal(state.leaderboardIndexes.byUrlSessionId['game-session-000000571'].score, 4400);

  const second = buildLeaderboardExperienceV2Model(state, {
    gameId: 'lester-blaster',
    cadence: 'all-time',
    wallet: wallets[0],
    displayNameFor: (wallet) => resolveDisplayName(state.profiles[wallet], wallet),
  });
  assert.equal(second.cache.status, 'hit');
  assert.deepEqual(second.rows.map((row) => row.sessionId), first.rows.map((row) => row.sessionId));
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

test('initial arcade state exposes only shipped public cabinets as playable', () => {
  const state = createInitialArcadeState();
  const playable = ARCADE_GAMES.filter((game) => game.status === 'playable');
  const playableIds = playable.map((game) => game.id);
  const chikun = ARCADE_GAMES.find((game) => game.id === 'chikun');

  assert.deepEqual(playableIds, ['lester-blaster']);
  assert.equal(playable[0].title, 'Hard Money Heroes');
  assert.equal(chikun.status, 'coming-soon');
  assert.equal(chikun.publicPlayable, false);
  assert.equal(state.games.length >= 4, true);
});

test('public play sessions reject coming-soon cabinets unless the dev harness explicitly opts in', () => {
  const wallet = '0x' + '1'.repeat(40);
  assert.throws(
    () => startPlaySession({ wallet, gameId: 'chikun', mode: 'paid' }),
    /not playable yet/,
  );
  const devSession = startPlaySession({ wallet, gameId: 'chikun', mode: 'free', allowDevCabinet: true });
  assert.equal(devSession.gameId, 'chikun');
  assert.equal(devSession.leaderboardEligible, false);
});

test('Hard Money Heroes canon captures Justin confirmed title, tone, world, economy, audio, and brand direction', () => {
  assert.equal(HARD_MONEY_HEROES_CANON.title, 'Hard Money Heroes');
  assert.equal(HARD_MONEY_HEROES_CANON.workingTitle, true);
  assert.equal(HARD_MONEY_HEROES_CANON.tone, 'goofy arcade mix with gritty Metal Slug-style satire');
  assert.equal(HARD_MONEY_HEROES_CANON.gore.defaultMode, 'sparks-only');
  assert.equal(HARD_MONEY_HEROES_CANON.gore.toggleBeforeRun, true);
  assert.equal(HARD_MONEY_HEROES_CANON.world.name, 'Litecoin City After Dark');
  assert.equal(HARD_MONEY_HEROES_CANON.characters.find((character) => character.id === 'lester-original').personality.includes('Rambo'), true);
  assert.equal(HARD_MONEY_HEROES_CANON.characters.find((character) => character.id === 'lit-commando').role.includes('starter'), true);
  assert.equal(HARD_MONEY_HEROES_CANON.characters.find((character) => character.id === 'lit-valkyrie').role.includes('starter'), true);
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
  assert.equal(lesterBlaster.playable, true);
  assert.equal(lesterBlaster.routePath, '/play/hard-money-heroes');
  const chikun = cartridges.find((cartridge) => cartridge.id === 'chikun');
  assert.equal(chikun.playable, false);
  assert.equal(chikun.status, 'coming-soon');
  assert.equal(chikun.routePath, null);
  assert.equal(chikun.devRoutePath, '/play/chikun?devCabinets=1');
  assert.equal(chikun.discoveryTags.includes('tap'), true);
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
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.runPacing.mode, 'open-ended-survival');
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.mapGeneration.procedural, true);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.pausesGame, true);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.choicesPerLevel, 2);
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.rerollsPerLevel, 1);
  assert.equal(config.seed, 42);
  assert.equal(config.map.tilesetPerspective, 'isometric');
  assert.equal(config.player.startWorld.x, 0);
  assert.equal(config.spawnDirector.pressureCurveMinutes.at(-1), 30);
});

test('roguelike skill library exposes the WO-73 ranked tree with deterministic two-card offers', () => {
  const run = createRoguelikeRunState({ seed: 11, mode: 'free' });
  const leveled = grantRoguelikeXp(run, roguelikeXpCostForLevel(1));
  const offered = chooseRoguelikeUpgradeOptions(leveled, { seed: 5 });
  const upgraded = applyRoguelikeSkillUpgrade(leveled, offered.options[0].id);

  assert.equal(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.length >= 24, true);
  assert.equal(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.length <= 32, true);
  assert.equal(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.every((skill) => skill.maxLevel === skill.maxRank), true);
  assert.equal(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.every((skill) => Array.isArray(skill.ranks) && skill.ranks.length === skill.maxRank), true);
  assert.equal(leveled.level, 2);
  assert.equal(leveled.pausedForLevelUp, true);
  assert.equal(leveled.pendingUpgradeChoices, 2);
  assert.equal(leveled.rerollsRemaining, 1);
  assert.equal(offered.options.length, 2);
  assert.equal(new Set(offered.options.map((option) => option.id)).size, 2);
  assert.equal(upgraded.pausedForLevelUp, false);
  assert.equal(upgraded.skills[offered.options[0].id], 1);
  if (offered.options[0].stat) assert.equal(upgraded.stats[offered.options[0].stat] > leveled.stats[offered.options[0].stat], true);
});

test('WO-45 weapon evolutions unlock from completed synergies and advertise payoff', () => {
  assert.equal(HMH_WEAPON_EVOLUTION_LIBRARY.length >= 4, true);
  assert.equal(HMH_WEAPON_EVOLUTION_LIBRARY.every((evo) => evo.requires.length >= 2), true);

  const run = createRoguelikeRunState({ seed: 45, mode: 'free' });
  let built = { ...run, level: 24, skills: { ...run.skills, 'damage-alpha': 5, pierce: 4, 'rate-of-fire': 3 } };
  built = applyRoguelikeSkillUpgrade(built, 'evolve-settler-rail');

  assert.equal(built.unlocks['evolve-settler-rail'], true);
  assert.equal(built.powerMoments.evolutions.includes('settler-rail'), true);
  assert.equal(built.stats.weaponEvolution, 'settler-rail');
  assert.match(built.powerMoments.lastMoment.banner, /EVOLUTION/i);
});

test('WO-45 golden cards surface as rare payoff choices once prerequisite builds are online', () => {
  const run = createRoguelikeRunState({ seed: 145, mode: 'free' });
  const synergized = { ...run, level: 24, skills: { ...run.skills, 'damage-alpha': 5, pierce: 4, 'rate-of-fire': 3 } };
  const offered = chooseRoguelikeUpgradeOptions(synergized, { seed: 145 });

  assert.equal(offered.options.some((option) => option.rarity === 'golden' && option.kind === 'evolution'), true);
  assert.equal(offered.options.filter((option) => option.rarity === 'golden').length <= 1, true);
  assert.equal(offered.options.find((option) => option.rarity === 'golden').presentation.tone, 'gold');
});

test('WO-45 synergy HUD model explains near-complete builds and max-build payoff', () => {
  const run = createRoguelikeRunState({ seed: 245, mode: 'free' });
  const almost = { ...run, level: 18, skills: { ...run.skills, 'damage-alpha': 5, pierce: 3, 'rate-of-fire': 3, 'critical-chance': 4, 'critical-damage': 2 } };
  const hud = buildRoguelikeSynergyHudModel(almost);

  assert.equal(hud.chips.length >= 2, true);
  assert.ok(hud.chips.some((chip) => chip.status === 'ready' || chip.status === 'near'));
  assert.ok(hud.chips.every((chip) => chip.progressPct >= 0 && chip.progressPct <= 100));
  assert.match(hud.maxBuildPayoff.label, /MAX BUILD/i);
  assert.equal(hud.maxBuildPayoff.reward.scoreMultiplier >= 1.25, true);
});

test('WO-45 runtime HUD and level-up cards expose power moment metadata', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.match(mainSource, /buildRoguelikeSynergyHudModel/);
  assert.match(mainSource, /POWER MOMENT/);
  assert.match(mainSource, /card\.rarity/);
});

test('roguelike XP pacing prevents one enemy pack from chaining multiple level-ups', () => {
  const run = createRoguelikeRunState({ seed: 21, mode: 'free' });
  const gruntXp = calculateRoguelikeKillXp({ score: 80, elite: false });
  const eliteXp = calculateRoguelikeKillXp({ score: 180, elite: true });
  const miniBossXp = calculateRoguelikeKillXp({ score: 900, elite: true, miniBoss: true });
  const packXp = eliteXp + miniBossXp + gruntXp * 5;
  const afterPack = grantRoguelikeXp(run, packXp);
  const afterHugeBurst = grantRoguelikeXp(run, roguelikeXpCostForLevel(1) + roguelikeXpCostForLevel(2) + 500);

  assert.equal(roguelikeXpCostForLevel(1), 45, 'Wave 2 opening level cost should produce ~10-15s early cadence');
  assert.ok(roguelikeXpCostForLevel(3) > roguelikeXpCostForLevel(2));
  assert.ok(gruntXp <= 12, `grunt XP should stay modest, got ${gruntXp}`);
  assert.ok(eliteXp <= 24, `elite XP should stay capped, got ${eliteXp}`);
  assert.ok(miniBossXp <= 80, `mini-boss XP should stay capped, got ${miniBossXp}`);
  assert.equal(afterPack.level <= 2, true, `one pack should not jump several levels, got level ${afterPack.level}`);
  assert.equal(afterHugeBurst.level, 2, 'grantRoguelikeXp should pause after one level-up even with overflow XP');
  assert.equal(afterHugeBurst.pausedForLevelUp, true);
});

test('guided level-up rerolls replace both discarded cards when alternatives exist', () => {
  const run = createRoguelikeRunState({ seed: 91, mode: 'free' });

  for (let seed = 1; seed <= 32; seed += 1) {
    const offered = chooseRoguelikeUpgradeOptions(run, { seed });
    const discardedIds = offered.options.map((option) => option.id);
    const rerolled = chooseRoguelikeUpgradeOptions(run, {
      seed,
      reroll: true,
      excludeSkillIds: discardedIds,
    });
    assert.equal(rerolled.options.length, 2);
    assert.equal(
      rerolled.options.some((option) => discardedIds.includes(option.id)),
      false,
      `seed ${seed} reroll should replace both discarded cards`,
    );
  }
});

test('guided level-up reroll falls back to the only two legal cards when exclusions empty the pool', () => {
  const baseSkills = LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY
    .filter((skill) => !(skill.gate?.requires?.length > 0))
    .slice(0, 2);
  assert.equal(baseSkills.length, 2);
  const keepIds = new Set(baseSkills.map((skill) => skill.id));
  const run = {
    ...createRoguelikeRunState({ seed: 92, mode: 'free' }),
    skills: Object.fromEntries(
      LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY
        .filter((skill) => !keepIds.has(skill.id))
        .map((skill) => [skill.id, skill.maxRank]),
    ),
  };

  const rerolled = chooseRoguelikeUpgradeOptions(run, {
    seed: 92,
    reroll: true,
    excludeSkillIds: [...keepIds],
  });

  assert.equal(rerolled.options.length, 2);
  assert.deepEqual(new Set(rerolled.options.map((option) => option.id)), keepIds);
});

test('Wave 2 max-level XP converts to score instead of overflowing past level 80', () => {
  const run = {
    ...createRoguelikeRunState({ seed: 80, mode: 'free' }),
    level: ROGUELIKE_LEVEL_CAP,
    xp: 0,
    xpToNextLevel: 0,
    maxLevelReached: true,
  };
  const afterCapPickup = grantRoguelikeXp(run, 123);

  assert.equal(afterCapPickup.level, ROGUELIKE_LEVEL_CAP);
  assert.equal(afterCapPickup.xpToNextLevel, 0);
  assert.equal(afterCapPickup.maxLevelReached, true);
  assert.equal(afterCapPickup.postCapScoreBonus, 123 * POST_CAP_XP_TO_SCORE);

  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.match(mainSource, /MAX LEVEL — XP → SCORE/);
  assert.match(mainSource, /postCapScoreBonus/);
});

test('Level 1 open-ended survival pressure climbs continuously into the elite band', () => {
  const balance = buildLevelOnePlaytestBalanceModel();
  const opening = levelOneRoguelikeSpawnDirectorAt(0);
  const oldWall = levelOneRoguelikeSpawnDirectorAt(8 * 60);
  const eliteBand = levelOneRoguelikeSpawnDirectorAt(25 * 60);

  assert.equal(balance.mode, 'open-ended-survival');
  assert.equal(Object.hasOwn(balance, 'targetPressureSeconds'), false);
  assert.equal(opening.difficultyLabel, 'opening');
  assert.ok(oldWall.pressure < 0.75, `8 minutes should not be full pressure, got ${oldWall.pressure}`);
  assert.notEqual(oldWall.difficultyLabel, 'survival-wall');
  assert.ok(eliteBand.pressure > oldWall.pressure, 'pressure should keep climbing after the old 8-minute mark');
  assert.ok(eliteBand.maxEnemiesOnMap >= 125, `elite band needs dense swarms, got ${eliteBand.maxEnemiesOnMap}`);
  assert.ok(eliteBand.spawnIntervalSeconds <= 0.45, `elite spawn cadence should overwhelm weak builds, got ${eliteBand.spawnIntervalSeconds}`);
  assert.ok(eliteBand.chaseEnemyShare >= opening.chaseEnemyShare, 'late game should lean into enemies chasing the player');
  assert.ok(levelOneRoguelikeDropChance({ elapsedSeconds: 0, rare: false }) < levelOneRoguelikeDropChance({ elapsedSeconds: 25 * 60, rare: false }));

  const passive = balance.xpPacing.passiveRun;
  const active = balance.xpPacing.swarmFighterRun;
  assert.ok(active.targetLevelAtEliteBand >= passive.targetLevelAtEliteBand + 3, 'swarm fighting must clearly out-level passive running');
});

test('WO-42 difficulty pressure comes from composition, not HP inflation', () => {
  const opening = levelOneRoguelikeSpawnDirectorAt(0, { seed: 42 });
  const m12 = levelOneRoguelikeSpawnDirectorAt(12 * 60, { seed: 42 });
  const record = levelOneRoguelikeSpawnDirectorAt(60 * 60, { seed: 42 });

  assert.equal(HMH_LEVEL_ONE_PLAYTEST_BALANCE.director.healthMultiplierCap <= 2, true);
  assert.ok(record.healthMultiplier <= 2, `health multiplier must cap at 2x, got ${record.healthMultiplier}`);
  assert.ok(record.damageMultiplier <= 1.35, `damage multiplier should stay seasoning, got ${record.damageMultiplier}`);
  assert.equal(opening.archetypeMixCount, 2);
  assert.ok(m12.archetypeMixCount >= 6, `minute 12 should have 6+ concurrent archetypes, got ${m12.archetypeMixCount}`);
  assert.ok(m12.packCohesion > opening.packCohesion, 'late pressure should increasingly spawn composed packs');
  assert.ok(m12.patternDensity > opening.patternDensity, 'late pressure should scale ranged pattern density instead of HP');
});

test('WO-42 deterministic threat beats rotate five readable event types without random minutes', () => {
  const beatsA = levelOneThreatBeatSchedule({ seed: 1337, minutes: 15 });
  const beatsB = levelOneThreatBeatSchedule({ seed: 1337, minutes: 15 });
  const beatsC = levelOneThreatBeatSchedule({ seed: 7331, minutes: 15 });
  const types = new Set(beatsA.map((beat) => beat.type));

  assert.deepEqual(beatsA, beatsB);
  assert.notDeepEqual(beatsA, beatsC);
  assert.equal(LEVEL_ONE_THREAT_BEAT_TYPES.length, 5);
  assert.ok(types.size >= 5, `15-minute schedule should show all five beat types, got ${[...types].join(', ')}`);
  assert.ok(beatsA.length >= 9, `60-90s beat cadence should produce a varied 15-minute log, got ${beatsA.length}`);
  for (let i = 1; i < beatsA.length; i += 1) {
    const gap = beatsA[i].startSeconds - beatsA[i - 1].startSeconds;
    assert.ok(gap >= 60 && gap <= 90, `beat gap should be 60-90s, got ${gap}`);
  }
  assert.ok(beatsA.every((beat) => beat.telegraphSeconds === 2));
});

test('Level 1 ship focus is open-ended survival with no timer extraction target', () => {
  assert.equal(HMH_LEVEL_ONE_SHIP_FOCUS.mode, 'open-ended-survival');
  assert.equal(HMH_LEVEL_ONE_SHIP_FOCUS.runEndsOnlyOnDeath, true);
  assert.equal(Object.hasOwn(HMH_LEVEL_ONE_SHIP_FOCUS, 'pressureCapSeconds'), false);
  assert.equal(HMH_LEVEL_ONE_SHIP_FOCUS.levelOneOnlyUntilPolished, true);
  assert.deepEqual(HMH_LEVEL_ONE_SHIP_FOCUS.deferredSystems, ['level-2-litecoin-city', 'level-3-the-getaway']);
  assert.equal(HMH_LEVEL_ONE_SHIP_FOCUS.polishPriorities.includes('ground/path/water tiles'), true);
  assert.equal(HMH_LEVEL_ONE_SHIP_FOCUS.polishPriorities.includes('100%-scale enemy hit detection'), true);
});

test('Level 1 world dimensions use Blueprint v3 authored spawn-centered bounds', () => {
  const world = buildLevelOneRunWorldDimensions();

  assert.equal(world.width, HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.width);
  assert.equal(world.height, HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.height);
  assert.equal(world.width, 100);
  assert.equal(world.height, 100);
  assert.equal(world.origin, 'authored-spawn');
  assert.equal(world.minX, -8);
  assert.equal(world.maxX, 91);
  assert.equal(world.minY, -78);
  assert.equal(world.maxY, 21);
  assert.equal(world.targetSessionSeconds, 4 * 60);
  assert.equal(world.traversalTargetPct, 0.8085);
  assert.ok(world.expectedUniqueTraversalPct >= 0.85, `expected most of the compact map to be traversable, got ${world.expectedUniqueTraversalPct}`);
  assert.ok(world.expectedUniqueTraversalPct <= 0.95, `expected authored loops rather than guaranteed full-map sweep, got ${world.expectedUniqueTraversalPct}`);
  assert.ok(world.width <= Math.ceil(525 / 2) && world.height <= 450 / 2, 'user requested another 50% reduction from the 525x450 playtest world');
});

test('Level 1 temporarily assigns curated humanoid enemies as mini-boss and boss proxies', () => {
  const roster = levelOneRoguelikeBossProxyRoster();
  const ids = roster.map((entry) => entry.enemyId);
  const catalogIds = new Set(LESTER_BLASTER_ENEMY_CATALOG.map((enemy) => enemy.id));

  assert.equal(roster.filter((entry) => entry.role === 'mini-boss').length >= 3, true);
  assert.equal(roster.filter((entry) => entry.role === 'boss').length, 1);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => catalogIds.has(id)), `all proxy ids must exist in enemy catalog: ${ids.join(', ')}`);
  assert.ok(roster.every((entry) => entry.animatedCuratedAssetKey?.startsWith('universal/enemy/')));
  assert.ok(roster.every((entry) => entry.humanoid === true), 'temporary boss proxies should be humanoid-ish animated enemies');
});

test('Level 1 late-swarm budget keeps rewards collectible while capping visual spam', () => {
  const openingAssist = levelOneRoguelikePickupAssistAt({ elapsedSeconds: 0, activeEnemies: 12 });
  const wallAssist = levelOneRoguelikePickupAssistAt({ elapsedSeconds: 480, activeEnemies: 100 });
  const openingBudget = levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds: 0, activeEnemies: 12, reduceMotion: false });
  const wallBudget = levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds: 480, activeEnemies: 100, reduceMotion: false });
  const reducedMotionBudget = levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds: 480, activeEnemies: 100, reduceMotion: true });

  assert.ok(wallAssist.xpAttractRadiusMultiplier > openingAssist.xpAttractRadiusMultiplier, 'XP should pull harder during the 8-minute swarm wall');
  assert.ok(wallAssist.xpAttractSpeedMultiplier > openingAssist.xpAttractSpeedMultiplier, 'late XP should drift toward the hero faster while kiting');
  assert.ok(wallAssist.xpTtlFrames >= openingAssist.xpTtlFrames, 'late XP gems should not expire faster than opening gems');
  assert.ok(wallAssist.maxLooseXpGems <= 180, `loose XP cap should prevent unbounded reward arrays, got ${wallAssist.maxLooseXpGems}`);
  assert.ok(wallAssist.maxLoosePowerUps <= 42, `power-up cap should prevent reward spam, got ${wallAssist.maxLoosePowerUps}`);

  assert.ok(wallBudget.maxParticles <= openingBudget.maxParticles, 'late swarm should cap particles at or below opening budget despite more enemies');
  assert.ok(wallBudget.maxFloatingTexts < 100, `floating text cap should stay readable, got ${wallBudget.maxFloatingTexts}`);
  assert.ok(wallBudget.hitSparkEveryNthHit >= openingBudget.hitSparkEveryNthHit, 'late swarm should sample hit sparks rather than emit every hit');
  assert.ok(reducedMotionBudget.maxParticles < wallBudget.maxParticles, 'reduce-motion should further lower particle budget');
});

test('WO-71 minute-12 performance budget applies justified render LOD without touching opening fidelity', () => {
  const openingDirector = levelOneRoguelikeSpawnDirectorAt(0);
  const minute12Director = levelOneRoguelikeSpawnDirectorAt(12 * 60);
  const openingBudget = levelOneRoguelikePerformanceBudgetAt({
    elapsedSeconds: 0,
    activeEnemies: openingDirector.maxEnemiesOnMap,
  });
  const minute12Budget = levelOneRoguelikePerformanceBudgetAt({
    elapsedSeconds: 12 * 60,
    activeEnemies: minute12Director.maxEnemiesOnMap,
  });

  assert.equal(openingBudget.lodStage, 'full-fidelity');
  assert.equal(openingBudget.enemyAnimationFps, 12);
  assert.ok(openingBudget.maxAnimatedEnemies >= openingDirector.maxEnemiesOnMap);
  assert.equal(openingBudget.obstacleRenderRadiusWindowed, 18);
  assert.equal(openingBudget.groundOverscanFullscreenTiles, 20);

  assert.equal(minute12Director.maxEnemiesOnMap >= 110, true, `minute 12 should be a heavy swarm profile, got ${minute12Director.maxEnemiesOnMap}`);
  assert.equal(minute12Budget.lodStage, 'pressure-lod');
  assert.ok(minute12Budget.maxAnimatedEnemies < minute12Director.maxEnemiesOnMap, 'late swarms should animate only the nearest/readable enemies');
  assert.ok(minute12Budget.enemyAnimationFps <= 10, `late enemy animation fps should drop, got ${minute12Budget.enemyAnimationFps}`);
  assert.ok(minute12Budget.obstacleRenderRadiusWindowed <= 16);
  assert.ok(minute12Budget.groundOverscanFullscreenTiles <= 14);
});

test('Level 1 opening keeps the hero lane clear while resolving authored POI props', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 0, playerY: 5, window: 24 });
  const ids = new Set(objects.map((object) => object.id));
  assert.equal([...ids].some((id) => id.includes('spawn-bus-stop-sign')), false, 'old spawn bus-stop clutter should not cover the hero start');
  assert.ok([...ids].some((id) => id.includes('opening-abandoned-pickup')), 'opening should include roadside vehicle staging');
  assert.ok([...ids].some((id) => id.includes('opening-delivery-cache')), 'opening should include delivery/cache micro-scene staging');
  for (const object of objects) {
    const src = levelOneCuratedAssetSrc(object.assetKey);
    assert.ok(src, `${object.id} must resolve ${object.assetKey} through the Level 1 asset manifests`);
    const nearHeroLane = Math.abs(object.gridX) <= 4 && object.gridY >= 3 && object.gridY <= 7;
    assert.equal(nearHeroLane && object.solid, false, `${object.id} should not create a solid blocker over the starting hero lane`);
  }
});

test('substantial Level 1 dressing has physical footprints instead of ghost geometry', () => {
  const objects = buildLevelOneCuratedVisibleSceneObjects({ playerX: 0, playerY: 5, window: 30 });
  const substantialKeys = [
    'curated/jul9-industrial-mining-04-cable-spool',
    'curated/jul9-vehicles-street-junk-12-gas-pump-pair',
    'curated/jul9-industrial-mining-03-small-generator',
  ];
  for (const key of substantialKeys) {
    const object = objects.find((entry) => entry.assetKey === key);
    assert.ok(object, `missing substantial object ${key}`);
    assert.equal(object.solid, true, `${key} should block player and projectile traversal`);
    assert.ok(object.footprintTiles?.w > 0 && object.footprintTiles?.h > 0, `${key} needs an authored collision footprint`);
  }
});

test('Level 1 world-boundary blockers carry visible natural edge art', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 120, height: 64 });
  const boundaries = buildLevelOneBoundaryObstaclesNear({ world, playerX: world.minX, playerY: 0, window: 72, segmentSpacingTiles: 24 });
  assert.ok(boundaries.length > 0, 'boundary obstacles should exist near world edges');
  for (const boundary of boundaries) {
    assert.ok(boundary.curatedAssetKey, `${boundary.id} needs visible art instead of an invisible collision edge`);
    assert.ok(levelOneCuratedAssetSrc(boundary.curatedAssetKey), `${boundary.id} asset ${boundary.curatedAssetKey} must resolve`);
    assert.ok(boundary.footprintTiles?.w > 0 && boundary.footprintTiles?.h > 0, `${boundary.id} needs a visible footprint`);
  }
});

test('Level 1 default natural boundary cadence does not leave twenty-tile visual gaps', () => {
  const world = buildLevelOneRunWorldDimensions({ width: 120, height: 64 });
  const boundaries = buildLevelOneBoundaryObstaclesNear({ world, playerX: world.minX, playerY: world.minY, window: 72 });
  const northXs = boundaries.filter((entry) => entry.boundarySide === 'north').map((entry) => entry.worldX).sort((a, b) => a - b);
  assert.ok(northXs.length > 3);
  for (let i = 1; i < northXs.length; i += 1) {
    assert.ok(northXs[i] - northXs[i - 1] <= 6, `north boundary gap should be <= 6 tiles, got ${northXs[i] - northXs[i - 1]}`);
  }
});

test('main.js routes all roguelike death paths through the final-boss extraction gate', () => {
  const source = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const nukeBlock = source.slice(source.indexOf("case 'screenNuke'"), source.indexOf("case 'screenNuke'") + 1100);

  assert.ok(source.includes('function resolveRoguelikeEnemyDeath('), 'runtime should centralize roguelike enemy death rewards and boss-gate side effects');
  assert.ok(source.includes('enemy.finalBossProxy'), 'death resolver should detect the temporary final boss proxy');
  assert.ok(source.includes('combat.bossDefeated = true'), 'final boss proxy death should unlock extraction progression');
  assert.ok(nukeBlock.includes('resolveRoguelikeEnemyDeath(enemy'), 'screen nuke should use the same death resolver as normal combat kills');
  assert.equal(nukeBlock.includes('combat.enemies = []'), false, 'screen nuke must not bypass final-boss death side effects by wiping the array directly');
});

test('combat accessibility settings model exposes motion flash color and aim toggles', () => {
  const model = buildCombatAccessibilitySettingsModel({
    reduceMotion: true,
    screenShake: false,
    reduceFlash: true,
    colorblindTags: true,
    autoAimAssist: false,
  });

  assert.equal(model.title, 'Accessibility');
  assert.equal(model.actions.length, 5);
  assert.deepEqual(
    model.actions.map((action) => action.id),
    ['toggle-reduce-motion', 'toggle-screen-shake', 'toggle-reduce-flash', 'toggle-colorblind-tags', 'toggle-auto-aim'],
  );
  assert.equal(model.actions[0].label, 'Reduce Motion On');
  assert.equal(model.actions[1].label, 'Screen Shake Off');
  assert.equal(model.actions[2].label, 'Reduce Flash On');
  assert.equal(model.actions[3].label, 'Color Tags On');
  assert.equal(model.actions[4].label, 'Auto Aim Off');
});

test('fullscreen viewport model requires real browser fullscreen for expanded monitor/device play', () => {
  const windowed = buildFullscreenViewportModel({ mode: 'windowed', fullscreenElementActive: false });
  const expanded = buildFullscreenViewportModel({ mode: 'expanded-fullscreen', fullscreenElementActive: false });
  const active = buildFullscreenViewportModel({ mode: 'expanded-fullscreen', fullscreenElementActive: true, screenWidth: 2560, screenHeight: 1440 });
  const portrait = buildFullscreenViewportModel({ mode: 'fullscreen', fullscreenElementActive: true, screenWidth: 1080, screenHeight: 1920 });
  const landscape = buildFullscreenViewportModel({ mode: 'fullscreen', fullscreenElementActive: true, screenWidth: 1920, screenHeight: 1080 });

  assert.equal(windowed.browserApiAction, 'none');
  assert.equal(windowed.canvasCss.width, 'min(100%, 660px)');
  assert.equal(expanded.browserApiAction, 'requestFullscreen');
  assert.equal(expanded.targetElement, 'officialCombatMount');
  assert.equal(active.isRealFullscreen, true);
  assert.equal(active.canvasCss.width, '100vw');
  assert.equal(active.canvasCss.height, '100vh');
  assert.equal(active.devicePixels.width, 2560);
  assert.equal(portrait.devicePixels.width, 1080);
  assert.equal(portrait.devicePixels.height, 1920);
  assert.equal(landscape.devicePixels.width, 1920);
  assert.equal(landscape.devicePixels.height, 1080);
});

test('main.js re-lays out gameplay on fullscreen and orientation changes', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.equal(mainSource.includes('function scheduleCombatViewportRelayout'), true);
  assert.equal(mainSource.includes("document.addEventListener('fullscreenchange'"), true);
  assert.equal(mainSource.includes("window.addEventListener('orientationchange'"), true);
  assert.equal(mainSource.includes('scheduleCombatViewportRelayout(120);'), true);
  assert.equal(mainSource.includes('if (officialAppStep === \'gameplay\') scheduleCombatViewportRelayout(120);'), true);
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
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.fire, 'Left Click (manual fire)');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.grenade, 'Right Click / F');
  assert.equal(LESTER_BLASTER_CONTROL_SCHEME.keyboard.melee, undefined); // melee removed from simplified controls
  assert.equal(LESTER_BLASTER_MENU_OPTIONS.main.length >= 6, true);
  assert.equal(LESTER_BLASTER_SOUND_DESIGN.musicTracks.length >= 4, true);
  assert.equal(LESTER_BLASTER_UNLOCKABLES.length >= 8, true);
  assert.deepEqual(Object.keys(codex).sort(), ['ai', 'animations', 'architecture', 'bosses', 'characters', 'combatEffects', 'controls', 'environments', 'leaderboard', 'levels', 'login', 'menus', 'performance', 'powerUps', 'sound', 'unlockables', 'weapons'].sort());
});

test('combat run state applies character stats, paid/free health rules, controls, and loadout defaults', () => {
  const freeRun = createCombatRunState({ mode: 'free', characterId: 'lit-commando' });
  const paidRun = createCombatRunState({ mode: 'paid', characterId: 'lit-valkyrie' });
  const loadout = buildRunLoadout({ characterId: 'lester-original', weaponId: 'hash-rail', grenadeId: 'chain-cluster' });

  assert.equal(freeRun.mode, 'free');
  assert.equal(freeRun.lives, Infinity);
  assert.equal(freeRun.health.current, freeRun.health.max);
  assert.equal(freeRun.controls.keyboard.move, 'WASD / Arrow Keys');
  assert.equal(paidRun.mode, 'paid');
  assert.equal(paidRun.lives, 3);
  assert.equal(paidRun.character.id, 'lit-valkyrie');
  // Lester/Lilly are now separate unlockable characters rather than aliases for the starters.
  assert.equal(createCombatRunState({ mode: 'free', characterId: 'lester-original' }).character.id, 'lester-original');
  assert.equal(createCombatRunState({ mode: 'free', characterId: 'lilly' }).character.id, 'lilly');
  assert.equal(paidRun.loadout.primaryWeapon.id, 'coin-blaster');
  assert.equal(loadout.primaryWeapon.id, 'hash-rail');
  assert.equal(loadout.grenade.id, 'chain-cluster');
});

test('power ups refine health, grenades, score multipliers, lives, shields, ammo, and weapon upgrades', () => {
  const run = createCombatRunState({ mode: 'paid', characterId: 'lester' });
  run.health.current = 42;
  const healed = applyPowerUp(run, 'health-pack');
  const grenades = applyPowerUp(run, 'grenade-crate');
  const spreadRun = createCombatRunState({ mode: 'paid', characterId: 'lester' });
  const shotgunRun = createCombatRunState({ mode: 'paid', characterId: 'lester' });
  const machineGunRun = createCombatRunState({ mode: 'paid', characterId: 'lester' });
  const spread = applyPowerUp(spreadRun, 'spread-ltc-chip');
  const shotgun = applyPowerUp(shotgunRun, 'block-breaker-shells');
  const machineGun = applyPowerUp(machineGunRun, 'hashstorm-drum');
  const multiplier = applyPowerUp(run, 'score-multiplier');
  const shield = applyPowerUp(run, 'shield-cache');
  const ammo = applyPowerUp(run, 'ammo-cache');
  const life = applyPowerUp(run, 'bonus-life');

  assert.equal(healed.health.current > 42, true);
  assert.equal(grenades.grenades > 3, true);
  assert.equal(spread.loadout.primaryWeapon.id, 'spread-ltc');
  assert.equal(shotgun.loadout.primaryWeapon.id, 'scatter-shotgun');
  assert.equal(machineGun.loadout.primaryWeapon.id, 'auto-miner');
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


test('enemy catalog adds authored Crypto Wasteland regional enemies with explicit animation coverage', () => {
  const byId = Object.fromEntries(LESTER_BLASTER_ENEMY_CATALOG.map((enemy) => [enemy.id, enemy]));
  const claimJumper = byId['claim-jumper'];
  const coyote = byId['coyote-pack-runner'];
  const scorpion = byId['scorpion-ambusher'];

  assert.ok(claimJumper);
  assert.ok(coyote);
  assert.ok(scorpion);
  for (const enemy of [claimJumper, coyote, scorpion]) {
    assert.equal(Array.isArray(enemy.districtFamilies), true);
    assert.equal(enemy.districtFamilies.length >= 1, true);
    assert.equal(enemy.animationStates.includes('attack-tell'), true);
    assert.equal(enemy.animationStates.includes('hit'), true);
    assert.equal(enemy.animationStates.includes('death'), true);
  }
});

test('chooseEnemySpawn biases Level 1 authored districts and POIs toward their local enemy pools', () => {
  const poiSpawn = chooseEnemySpawn({
    elapsedSeconds: 220,
    seed: 0,
    districtFamily: 'ghost_town',
    activePoiId: 'rugpull-gulch',
  });
  assert.equal(poiSpawn.spawnContext.source, 'poi');
  assert.equal(poiSpawn.enemy.poiIds.includes('rugpull-gulch'), true);
  assert.equal(poiSpawn.enemy.districtFamilies.includes('ghost_town'), true);

  const districtSpawn = chooseEnemySpawn({
    elapsedSeconds: 180,
    seed: 1,
    districtFamily: 'desert_approach',
  });
  assert.equal(districtSpawn.spawnContext.source, 'district-family');
  assert.equal(districtSpawn.enemy.districtFamilies.includes('desert_approach'), true);
  assert.equal(districtSpawn.enemy.animationStates.includes('attack-tell'), true);
});


test('chooseEnemySpawn can force authored POI mini-boss and add-pack enemies without losing local context', () => {
  const sheriff = chooseEnemySpawn({
    elapsedSeconds: 220,
    seed: 4,
    districtFamily: 'ghost_town',
    activePoiId: 'rugpull-gulch',
    forceEnemyId: 'claim-jumper-sheriff',
  });
  assert.equal(sheriff.spawnContext.source, 'forced-id');
  assert.equal(sheriff.enemy.id, 'claim-jumper-sheriff');
  assert.equal(sheriff.enemy.districtFamilies.includes('ghost_town'), true);
  assert.equal(sheriff.enemy.animationStates.includes('attack-tell'), true);

  const zealot = chooseEnemySpawn({
    elapsedSeconds: 220,
    seed: 2,
    districtFamily: 'ghost_town',
    activePoiId: 'rugpull-gulch',
    forceEnemyId: 'scam-cult-zealot',
  });
  assert.equal(zealot.enemy.id, 'scam-cult-zealot');
  assert.equal(zealot.enemy.poiIds.includes('rugpull-gulch'), true);
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
  assert.match(model.testnetDisclosure.title, /testnet beta/i);
  assert.match(model.testnetDisclosure.body, /player-submitted/i);
  assert.equal(model.testnetDisclosure.valueAttached, false);
  assert.match(model.resetPolicy, /may reset/i);
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
  assert.equal(LESTER_BLASTER_LEVEL_PLAN[0].title, 'Level 1: Crypto Wasteland');
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
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.generatedFrom, 'Hard-Money-Heroes-ArcadeCabinet-white-bg.png');
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.generatedFrom.includes('C:'), false);
  assert.deepEqual(hardMoneyHeroesCabinet.desktopCabinetSprite.frames.map((frame) => frame.id), ['front', 'front-right', 'right-side', 'back', 'left-side', 'front-left']);
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.frames.length, 6);
  assert.equal(hardMoneyHeroesCabinet.desktopCabinetSprite.frames.every((frame) => frame.src.includes('.png?v=hmh-cabinet-white-bg-v1') && frame.width > 0 && frame.height > 0), true);
  for (const frame of hardMoneyHeroesCabinet.desktopCabinetSprite.frames) {
    const cleanSrc = frame.src.split('?')[0];
    const framePath = fileURLToPath(new URL(`../apps/portal/${cleanSrc.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(framePath) && statSync(framePath).size > 0, true, `${frame.src} exists`);
  }
  const chikunCabinet = LESTERS_ARCADE_V2_APP_SHELL.cabinets.find((cabinet) => cabinet.id === 'chikun');
  assert.equal(chikunCabinet.status, 'coming-soon');
  assert.equal(chikunCabinet.playable, false);
  assert.equal(chikunCabinet.devPlayable, true);
  assert.match(chikunCabinet.description, /In development by Louie/);
  assert.equal(chikunCabinet.desktopCabinetSprite.id, 'chikun-cabinet');
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.cabinets.filter((cabinet) => cabinet.playable).length, 1);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.modeSelect.ranked.requiresZkLtc, true);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.modeSelect.ranked.faucetUrl, LITVM_LITEFORGE_NETWORK.faucetUrl);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.levelIntro.durationSeconds, 8);
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.levelIntro.hasBeginButton, true);
});

test('V2 tactical combat spec slows pacing into staged cover, platform, mini-boss, and boss sections', () => {
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.move, 'WASD / Arrow Keys');
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.shoot, 'Left Click');
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.melee, undefined); // melee removed from simplified controls
  assert.equal(LESTER_BLASTER_TACTICAL_COMBAT_V2.controls.throwable, 'Right Click / F');
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
  assert.deepEqual(
    LESTERS_ARCADE_V2_APP_SHELL.primaryNav.map((item) => [item.id, item.label]),
    [['cabinets', 'Play'], ['profile', 'Profile'], ['leaderboards', 'Scores'], ['settings', 'Settings']],
  );
  assert.equal(LESTERS_ARCADE_V2_APP_SHELL.hiddenByDefault.includes('developer-backstage'), true);
  assert.equal(mainSource.includes('manifestEnemyArtFor'), true);
  assert.equal(mainSource.includes('ensureCombatMusic'), true);
  assert.equal(mainSource.includes('playSfxCue'), true);
  assert.equal(mainSource.includes('LESTERS_ARCADE_V2_APP_SHELL'), true);
  assert.equal(mainSource.includes("officialAppStep = 'wallet-splash'"), true);
  assert.equal(mainSource.includes('enterOfficialArcadeFromSplash'), true);
  assert.equal(mainSource.includes("officialAppStep = connectedWallet ? 'cabinet-select' : 'wallet-splash'"), true);
  assert.equal(mainSource.includes('clearInactiveCombatOverlay'), true);
  assert.equal(mainSource.includes("dom.officialGameStateCopy.textContent = ''"), true);
  assert.equal(mainSource.includes("setOfficialView('cabinet-select')"), true);
  assert.equal(mainSource.includes('renderArcadeIcon'), true);
  assert.equal(indexSource.includes('combatMenuActionGrid'), true);
  assert.equal(indexSource.includes('splashFeaturedCabinet'), true);
  assert.equal(indexSource.includes('./dist/main.js?v=hmh-jul12-landmarks-v2-v38'), true);
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

test('leaderboard page treats games and time windows as compact filters above the board', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');
  const polishSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles-arcade-polish.css', import.meta.url)), 'utf8');
  assert.equal(mainSource.includes('leaderboard-filter-shell'), true);
  assert.equal(mainSource.includes('publicLeaderboardCabinets()'), true);
  assert.match(mainSource, /filter\(\(cabinet\) => cabinet\.playable/);
  assert.equal(mainSource.includes("cabinet.id === 'chikun'"), false, 'Chikun loader should not be hard-wired into public cabinet clicks');
  assert.equal(mainSource.includes("get('devCabinets') === '1'"), true);
  assert.equal(mainSource.includes('leaderboard-game-filter'), true);
  assert.equal(mainSource.includes('leaderboard-time-filter'), true);
  assert.equal(mainSource.includes('leaderboard-coming-soon-banner'), false);
  assert.equal(styleSource.includes('.leaderboard-filter-shell'), true);
  assert.equal(polishSource.includes('.leaderboard-filter-shell'), true);
});

test('public HMH screens use the user-supplied cabinet sheet over the older production placeholder', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.equal(mainSource.includes('featuredCabinet?.desktopCabinetSprite ?? productionCabinetSprite()'), true);
  assert.equal(mainSource.includes('cabinet.desktopCabinetSprite ?? productionCabinetSprite()'), true);
});

test('Lester Arcade custom MP3 playlist manifest drives a global minimal music player and Hard Money Heroes queue', async () => {
  const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(packageJson.scripts['assets:playlist'], 'python scripts/ingest-arcade-playlist-music.py');
  assert.equal(packageJson.scripts['assets:verify'].includes('verify-generated-assets'), true);
  // The syntax gate moved from the giant inline `check` string to a runner
  // script (scripts/syntax-check.mjs) once the inline command hit the Windows
  // 8191-char command-line limit. Assert the file is covered there.
  const syntaxCheckRunner = readFileSync(fileURLToPath(new URL('../scripts/syntax-check.mjs', import.meta.url)), 'utf8');
  assert.equal(syntaxCheckRunner.includes('scripts/ingest-arcade-playlist-music.py'), true);

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
  // chooseArcadeMusicStartIndex: random opening track across the full queue (incl. index 0)
  assert.equal(core.chooseArcadeMusicStartIndex({ queueLength: 26, random: () => 0 }), 0);
  assert.equal(core.chooseArcadeMusicStartIndex({ queueLength: 26, random: () => 0.5 }), 13);
  assert.equal(core.chooseArcadeMusicStartIndex({ queueLength: 26, random: () => 0.999999 }), 25);
  assert.equal(core.chooseArcadeMusicStartIndex({ queueLength: 0 }), 0);
  assert.equal(core.chooseArcadeMusicStartIndex({ queueLength: 1, random: () => 0.99 }), 0);
  for (let i = 0; i < 200; i += 1) {
    const idx = core.chooseArcadeMusicStartIndex({ queueLength: 26 });
    assert.equal(idx >= 0 && idx < 26, true);
  }
});

test('buildCombatPauseGate freezes sim + timer + input + audio together for every interruption', () => {
  // Actively playing: nothing frozen.
  const running = buildCombatPauseGate({ active: true });
  assert.equal(running.simFrozen, false);
  assert.equal(running.timerFrozen, false);
  assert.equal(running.inputCaptured, false);
  assert.equal(running.audioPaused, false);
  assert.equal(running.overlayOpen, false);
  assert.equal(running.reason, 'running');

  // Explicit pause: sim, timer, and input freeze; audio idles; overlay open.
  const paused = buildCombatPauseGate({ active: true, paused: true });
  assert.equal(paused.simFrozen, true);
  assert.equal(paused.timerFrozen, true);
  assert.equal(paused.inputCaptured, true);
  assert.equal(paused.audioPaused, true);
  assert.equal(paused.overlayOpen, true);
  assert.equal(paused.reason, 'paused');

  // Level-up choice open: timer must freeze too (was the drift bug).
  const levelUp = buildCombatPauseGate({ active: true, levelUpPaused: true });
  assert.equal(levelUp.simFrozen, true);
  assert.equal(levelUp.timerFrozen, true);
  assert.equal(levelUp.inputCaptured, true);
  assert.equal(levelUp.audioPaused, true);
  assert.equal(levelUp.reason, 'level-up');

  // Game over: frozen, overlay open, audio idle.
  const over = buildCombatPauseGate({ active: true, gameOver: true });
  assert.equal(over.simFrozen, true);
  assert.equal(over.timerFrozen, true);
  assert.equal(over.reason, 'game-over');

  // Pre-begin window: sim, timer, input, and combat audio stay frozen until
  // loading has fully finished and the player presses/clicks READY.
  const pending = buildCombatPauseGate({ active: true, pendingBegin: true });
  assert.equal(pending.simFrozen, true);
  assert.equal(pending.overlayOpen, false);
  assert.equal(pending.audioPaused, true);
  assert.equal(pending.reason, 'pending-begin');

  // Inactive run: everything frozen regardless of other flags.
  const inactive = buildCombatPauseGate({ active: false });
  assert.equal(inactive.simFrozen, true);
  assert.equal(inactive.inputCaptured, true);
  assert.equal(inactive.reason, 'inactive');

  // Precedence: an explicit pause during a pending-begin still reports paused.
  const both = buildCombatPauseGate({ active: true, paused: true, pendingBegin: true });
  assert.equal(both.reason, 'paused');
  assert.equal(both.interrupted, true);
});

test('main.js wires the unified pause gate into the loop and pause toggle', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.equal(mainSource.includes('buildCombatPauseGate'), true);
  // The loop gate uses the model's simFrozen flag rather than ad-hoc flag checks.
  assert.equal(mainSource.includes('gate.simFrozen'), true);
  // Audio rides the gate on pause toggle.
  assert.equal(mainSource.includes('gate.audioPaused'), true);
});

test('HMH loading gate keeps gameplay pending and uses responsive loading overlays', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const styleSource = readFileSync(new URL('../apps/portal/styles.css', import.meta.url), 'utf8');
  assert.equal(mainSource.includes('startCombat({ levelId: level.id, carryOver: options.carryOver ?? null, startPendingBegin: true })'), true);
  assert.equal(mainSource.includes("overlay.className = 'hmh-loading-overlay'"), true);
  assert.equal(mainSource.includes("titleOverlay.className = 'hmh-loading-title-overlay'"), true);
  assert.equal(styleSource.includes('.hmh-loading-title-card'), true);
  assert.equal(styleSource.includes('max-width: calc(100vw - 24px)'), true);
  assert.equal(styleSource.includes('overflow-wrap: anywhere'), true);
});

test('main.js uses authored composition metadata to keep ambient level props intentional', () => {
  const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.equal(mainSource.includes('sceneContext?.authoredComposition?.ambientChancePct'), true);
  assert.equal(mainSource.includes('sceneContext?.authoredComposition?.ambientAllowed === false'), true);
  assert.equal(mainSource.includes('authored levels keep ambient FX sparse and intentional'), true);
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
  // Level/game start picks a random opening track rather than forcing track 0.
  assert.equal(mainSource.includes('chooseArcadeMusicStartIndex'), true);
  assert.equal(mainSource.includes('normalizedIndex'), true);
  assert.equal(mainSource.includes('dom.arcadeMusicPlayer.hidden = officialAppStep === \'gameplay\''), true, 'global jukebox must be hidden while the HMH canvas is active');
  assert.equal(mainSource.includes('renderOfficialApp()'), true);
  assert.equal(styleSource.includes('html[data-ingame="true"] .arcade-music-player'), true, 'global jukebox must be suppressed while root ingame mode is active');
  assert.equal(styleSource.includes('.arcade-music-player[hidden]'), true, 'hidden music player needs explicit CSS because class display overrides user-agent hidden');
  assert.equal(styleSource.includes('.arcade-music-player'), true);
  assert.equal(styleSource.includes('.arcade-music-progress-fill'), true);
  assert.equal(styleSource.includes('[data-expanded="true"]'), true);
  assert.equal(styleSource.includes('[data-shuffle="true"]'), true);
  assert.equal(styleSource.includes('#officialApp[data-step="officialGameplay"] .arcade-music-player'), true, 'global jukebox must not overlay the HMH spawn/combat canvas');
  assert.equal(smokeScript.includes('arcadeMusicPlayer'), true);
  assert.equal(smokeScript.includes('arcadeMusicShuffleButton'), true);
  assert.equal(smokeScript.includes('Hard Money Heroes — Main Theme'), true);
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

  // The archived side-scroller manifest remains valid, but Level 1 must not
  // eagerly fetch those large still libraries before the lazy animated roster.
  assert.equal(mainSource.includes("buildEnemyArtFromManifest('cryptoBro')"), false);
  assert.equal(mainSource.includes("buildEnemyArtFromManifest('gasBeast')"), false);
  assert.equal(mainSource.includes('roguelikeEnemyAnimatedFrame'), true);
  assert.equal(mainSource.includes('const waveFrame = isLevelOneCuratedRuntime() ? null'), true);
  assert.equal(mainSource.includes('const legacyEnemyFrame = isLevelOneCuratedRuntime() ? null'), true);
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

test('Hard Money Heroes runtime keeps legacy manifest support while Level 1 uses lazy animated art', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const indexSource = readFileSync(fileURLToPath(new URL('../apps/portal/index.html', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');

  assert.equal(mainSource.includes('HARD_MONEY_HEROES_ASSET_MANIFEST'), true);
  assert.equal(mainSource.includes('buildCharacterArtFromManifest'), true);
  assert.equal(mainSource.includes('weaponAssets.knife?.stabAnimation'), true);
  assert.equal(mainSource.includes('hero.animations.knifeStab'), true);
  assert.equal(mainSource.includes('lastMeleeFrame'), true);
  assert.equal(mainSource.includes('const combatArt ='), true);
  assert.equal(mainSource.includes('preloadHeroRoster'), true);
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
  assert.equal(controls.some((control) => control.label === 'Manual Fire' && control.key.includes('Left Click')), true);
  assert.equal(controls.some((control) => control.label === 'Grenade' && control.key === 'Right Click / F'), true);
  // Melee/Throw were removed in the simplified control scheme.
  assert.equal(controls.some((control) => control.label === 'Melee'), false);
  assert.equal(controls.some((control) => control.label === 'Throw'), false);
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

  assert.equal(official.heading, 'Ranked Testnet result synced');
  assert.equal(official.channel, 'official');
  assert.equal(official.details.includes('leaderboard'), true);
  assert.equal(official.details.includes('Combat test running'), false);
  assert.equal(combat.heading, 'Local combat sandbox running');
  assert.equal(combat.channel, 'sandbox');
  assert.equal(combat.details.includes('does not overwrite ranked testnet state'), true);
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
  assert.equal(LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.exitRamps.some((ramp) => ramp.copy.includes('No hidden ranked submit')), true);
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
  const oneMoreRunSummary = buildGameOverSummaryModel({
    session: paidSession,
    score: 15000,
    elapsedSeconds: 388,
    kills: 44,
    bossesDefeated: 1,
    acceptedForGlobalLeaderboard: false,
    previousBestScore: 12840,
    sessionStreak: 4,
    backgroundSettlementQueued: true,
  });

  assert.equal(freeSummary.channel, 'practice');
  assert.equal(freeSummary.trackingCopy.includes('not tracked'), true);
  assert.equal(freeSummary.actions.some((action) => action.id === 'submit-official-score'), false);
  assert.equal(freeSummary.actions.some((action) => action.id === 'play-again-free' && action.cost === 'free'), true);
  assert.equal(freeSummary.actions.some((action) => action.id === 'return-to-arcade' && action.target === 'cabinet-select'), true);

  assert.equal(rankedSummary.channel, 'official');
  assert.equal(rankedSummary.trackingCopy.includes('Retry Publish'), true);
  assert.equal(rankedSummary.actions.some((action) => action.id === 'submit-official-score' && action.enabled), true);
  assert.equal(rankedSummary.actions.some((action) => action.id === 'play-again-ranked' && action.cost.includes('new testnet credit')), true);

  assert.equal(syncedSummary.actions.find((action) => action.id === 'submit-official-score').enabled, false);
  assert.equal(syncedSummary.trackingCopy.includes('published'), true);

  assert.equal(oneMoreRunSummary.oneMoreRun.primaryActionId, 'run-it-back');
  assert.equal(oneMoreRunSummary.oneMoreRun.estimatedRestartSeconds <= 3, true);
  assert.equal(oneMoreRunSummary.actions[0].id, 'run-it-back');
  assert.equal(oneMoreRunSummary.actions[0].enabled, true);
  assert.equal(oneMoreRunSummary.personalBest.isNewBest, true);
  assert.equal(oneMoreRunSummary.personalBest.delta, 2160);
  assert.equal(oneMoreRunSummary.metrics.some((metric) => metric.id === 'personal-best' && metric.value.includes('+2,160')), true);
  assert.equal(oneMoreRunSummary.streak.count, 4);
  assert.equal(oneMoreRunSummary.streak.copy.includes('4-run streak'), true);
  assert.equal(oneMoreRunSummary.settlement.status, 'background-pending');
  assert.equal(oneMoreRunSummary.settlement.copy.includes('background'), true);

  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.match(mainSource, /run-it-back-button/);
  assert.match(mainSource, /summary-metric-card-pb-flash/);
  assert.match(mainSource, /sessionRunStreak/);
  assert.match(mainSource, /lastSettlementQueued/);
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
  assert.equal(actionIds.includes('toggle-settings'), true);
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

test('runtime source wires authored POI visual-plan scene objects into obstacle placement for Level 1 arenas', () => {
  const runtimeSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  assert.equal(runtimeSource.includes('buildEncounterSceneObjects'), true);
  assert.equal(runtimeSource.includes('buildEncounterTemplateContext'), true);
  assert.equal(runtimeSource.includes('buildEncounterTerrainPressure'), true);
  assert.equal(runtimeSource.includes('buildEncounterEnemyBehaviorProfile'), true);
  assert.equal(runtimeSource.includes('bespokeEnemyVisualKitFor'), true);
  assert.equal(runtimeSource.includes('buildEnvironmentState'), true);
  assert.equal(runtimeSource.includes('buildCombatReadabilityProfile'), true);
  assert.equal(runtimeSource.includes('buildAmbientZoneModel'), true);
  assert.equal(runtimeSource.includes('activePoiEncounterCenterX'), true);
  assert.equal(runtimeSource.includes('activePoiEncounterVisualPlan'), true);
});

test('runtime exposes tactical HUD overlay, options popup, player-led camera, and animation coverage audit in the public app', () => {
  const mainSource = readFileSync(fileURLToPath(new URL('../apps/portal/main.js', import.meta.url)), 'utf8');
  const indexSource = readFileSync(fileURLToPath(new URL('../apps/portal/index.html', import.meta.url)), 'utf8');
  const styleSource = readFileSync(fileURLToPath(new URL('../apps/portal/styles.css', import.meta.url)), 'utf8');

  assert.equal(mainSource.includes('buildGameOverSummaryModel'), true);
  assert.equal(mainSource.includes('submitCombatGameOver'), true);
  assert.equal(mainSource.includes('renderGameOverSummary'), true);
  assert.equal(mainSource.includes('No hidden ranked submit'), true);
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
    groundRender: { passMs: 1.72, groupCount: 6, cacheSize: 256, cacheHits: 1400, cacheMisses: 256 },
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
  assert.deepEqual(overlay.metrics.groundRender, { passMs: 1.72, groupCount: 6, cacheSize: 256, cacheHits: 1400, cacheMisses: 256 });
  assert.equal(overlay.layers.some((layer) => layer.id === 'enemy-ai' && layer.items.some((item) => item.includes('telegraph'))), true);
  assert.equal(overlay.layers.some((layer) => layer.id === 'ground-render' && layer.items.some((item) => item.includes('1.72ms'))), true);
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
  const syntaxCheckRunnerAnim = readFileSync(fileURLToPath(new URL('../scripts/syntax-check.mjs', import.meta.url)), 'utf8');
  assert.equal(syntaxCheckRunnerAnim.includes('scripts/write-hmh-animation-production-requests.mjs'), true);

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
  assert.equal(smokeScript.includes('hmh-jul12-landmarks-v2-v38'), true);
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

  const shotgun = byId['block-breaker-shells'];
  assert.ok(shotgun, 'block-breaker-shells shotgun pickup must exist');
  assert.equal(shotgun.effect, 'weapon');
  assert.equal(shotgun.weaponId, 'scatter-shotgun');
  assert.ok(shotgun.durationSeconds > 0, 'shotgun pickup is a timed weapon swap');

  const machineGun = byId['hashstorm-drum'];
  assert.ok(machineGun, 'hashstorm-drum machine-gun pickup must exist');
  assert.equal(machineGun.effect, 'weapon');
  assert.equal(machineGun.weaponId, 'auto-miner');
  assert.ok(machineGun.durationSeconds > 0, 'machine-gun pickup is a timed weapon swap');

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

test('HMH level targets match the 4-level quarter-arcade vision', () => {
  assert.equal(Object.keys(HMH_LEVEL_TARGETS).length, 4);
  assert.equal(HMH_LEVEL_TARGETS[1].targetSeconds, 300); // L1 = 5 min easy complete
  assert.equal(HMH_LEVEL_TARGETS[2].targetSeconds, 360); // L2 = 6 min
  assert.equal(HMH_LEVEL_TARGETS[3].targetSeconds, 480); // L3 = 8 min
  assert.equal(HMH_LEVEL_TARGETS[4].targetSeconds, 600); // L4 = 10 min, near impossible
  for (const target of Object.values(HMH_LEVEL_TARGETS)) {
    assert.ok(target.masterySeconds < target.targetSeconds, 'mastery threshold must be under target');
    assert.equal(typeof target.title, 'string');
  }
  // Clamping: out-of-range levels resolve to the nearest valid target.
  assert.equal(getHmhLevelTarget(0).level, 1);
  assert.equal(getHmhLevelTarget(99).level, 4);
  assert.equal(getHmhLevelTarget().level, 1);
});

test('extraction score rewards clearing under target and grades runs', () => {
  // S-grade: cleared Level 1 well under mastery (4:00 vs 4:30 mastery / 5:00 target).
  const mastery = calculateExtractionScore({ baseScore: 10000, elapsedSeconds: 240, level: 1, cleared: true, noDamageSeconds: 60, maxCombo: 12 });
  assert.equal(mastery.grade, 'S');
  assert.equal(mastery.cleared, true);
  assert.equal(mastery.timeDeltaSeconds, 60);
  assert.equal(mastery.breakdown.timeBonus, 60 * 25);
  assert.equal(mastery.breakdown.survival, 0);

  // A-grade: cleared between mastery and target.
  const cleared = calculateExtractionScore({ baseScore: 10000, elapsedSeconds: 290, level: 1, cleared: true });
  assert.equal(cleared.grade, 'A');

  // B-grade: cleared but over target — zero time bonus.
  const slow = calculateExtractionScore({ baseScore: 10000, elapsedSeconds: 360, level: 1, cleared: true });
  assert.equal(slow.grade, 'B');
  assert.equal(slow.breakdown.timeBonus, 0);

  // Died late = C, died early = D; failed runs earn capped survival credit.
  const diedLate = calculateExtractionScore({ baseScore: 5000, elapsedSeconds: 250, level: 1, cleared: false, deaths: 1 });
  assert.equal(diedLate.grade, 'C');
  assert.equal(diedLate.breakdown.survival, 250 * 4);
  assert.equal(diedLate.breakdown.deathPenalty, -500);
  const diedEarly = calculateExtractionScore({ baseScore: 200, elapsedSeconds: 30, level: 1, cleared: false, deaths: 1 });
  assert.equal(diedEarly.grade, 'D');

  // A clear always beats the same run that died at the wall (survival credit caps at target).
  const clearedRun = calculateExtractionScore({ baseScore: 5000, elapsedSeconds: 295, level: 1, cleared: true });
  const failedRun = calculateExtractionScore({ baseScore: 5000, elapsedSeconds: 295, level: 1, cleared: false, deaths: 1 });
  assert.ok(clearedRun.total > failedRun.total);

  // Assist-on applies the 0.8 multiplier so Assist-Off boards stay meaningful.
  const assistOff = calculateExtractionScore({ baseScore: 10000, elapsedSeconds: 240, level: 1, cleared: true });
  const assistOn = calculateExtractionScore({ baseScore: 10000, elapsedSeconds: 240, level: 1, cleared: true, assistOn: true });
  assert.equal(assistOn.total, Math.floor(assistOff.total * 0.8));

  // Total never goes negative even with heavy death penalties.
  const wipe = calculateExtractionScore({ baseScore: 0, elapsedSeconds: 5, level: 4, cleared: false, deaths: 10 });
  assert.equal(wipe.total >= 0, true);
});

test('game-over summary surfaces death recap + extraction metrics when provided', () => {
  const extraction = calculateExtractionScore({ baseScore: 8000, elapsedSeconds: 270, level: 1, cleared: true });
  const summary = buildGameOverSummaryModel({
    session: null,
    score: 8000,
    elapsedSeconds: 270,
    kills: 30,
    bossesDefeated: 1,
    extraction,
    killedBy: 'FUD Goblin (gunfire)',
    bestUpgrade: 'Damage Alpha (Rank 3)',
  });
  const ids = summary.metrics.map((m) => m.id);
  assert.equal(ids.includes('extraction'), true);
  assert.equal(ids.includes('vs-target'), true);
  assert.equal(ids.includes('killed-by'), true);
  assert.equal(ids.includes('best-upgrade'), true);
  const vsTarget = summary.metrics.find((m) => m.id === 'vs-target');
  assert.equal(vsTarget.value, '0:30 under');
  // Legacy callers without the new fields keep the original 4-metric shape.
  const legacy = buildGameOverSummaryModel({ score: 100, elapsedSeconds: 10, kills: 1 });
  assert.equal(legacy.metrics.length, 4);
});

test('validateAvatarFile enforces type and size policy', () => {
  assert.equal(validateAvatarFile({ type: 'image/png', size: 1024 }).ok, true);
  assert.equal(validateAvatarFile({ type: 'image/jpeg', size: AVATAR_RULES.maxBytes }).ok, true);

  const gif = validateAvatarFile({ type: 'image/gif', size: 1024 });
  assert.equal(gif.ok, false);
  assert.equal(gif.error, 'invalid-type');

  const svg = validateAvatarFile({ type: 'image/svg+xml', size: 1024 });
  assert.equal(svg.ok, false);
  assert.equal(svg.error, 'invalid-type');

  const empty = validateAvatarFile({ type: 'image/png', size: 0 });
  assert.equal(empty.ok, false);
  assert.equal(empty.error, 'empty');

  const tooBig = validateAvatarFile({ type: 'image/png', size: AVATAR_RULES.maxBytes + 1 });
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.error, 'too-large');

  // Missing/garbage input is rejected, never thrown.
  assert.equal(validateAvatarFile().ok, false);
  assert.equal(validateAvatarFile({}).ok, false);
});

test('computeAvatarResize fits inside the square box without upscaling', () => {
  // Landscape source downscaled by its longest edge.
  assert.deepEqual(computeAvatarResize(1024, 512, 256), { width: 256, height: 128 });
  // Portrait source downscaled by its longest edge.
  assert.deepEqual(computeAvatarResize(512, 1024, 256), { width: 128, height: 256 });
  // Square source clamps to the box.
  assert.deepEqual(computeAvatarResize(4000, 4000, 256), { width: 256, height: 256 });
  // Already-small images are never upscaled.
  assert.deepEqual(computeAvatarResize(64, 48, 256), { width: 64, height: 48 });
  // Degenerate inputs collapse to zero rather than throwing.
  assert.deepEqual(computeAvatarResize(0, 100, 256), { width: 0, height: 0 });
  assert.deepEqual(computeAvatarResize('nope', 'nope', 256), { width: 0, height: 0 });
  // Dimensions stay >=1 for tiny-but-nonzero aspect ratios.
  const thin = computeAvatarResize(1000, 1, 256);
  assert.equal(thin.width, 256);
  assert.ok(thin.height >= 1);
});

test('AVATAR_RULES re-encodes to a metadata-stripping raster format', () => {
  // JPEG/PNG re-encode discards EXIF; ensure we target a raster type, not SVG.
  assert.ok(['image/jpeg', 'image/png'].includes(AVATAR_RULES.outputType));
  assert.ok(AVATAR_RULES.maxDimension > 0 && AVATAR_RULES.maxDimension <= 1024);
  assert.ok(AVATAR_RULES.outputQuality > 0 && AVATAR_RULES.outputQuality <= 1);
});


