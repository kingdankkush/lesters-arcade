import { cabinetFramePresentation } from './src/cabinet-presentation.mjs';
import { installPortalDiscovery } from './src/portal-discovery.mjs';
import { createChikunRunMusic } from './src/chikun-run-music.mjs';
import { shouldInjectVercelWebAnalytics, injectVercelWebAnalytics } from './src/vercel-analytics.mjs';

if (typeof document !== 'undefined' && shouldInjectVercelWebAnalytics({ hostname: window.location.hostname })) {
  injectVercelWebAnalytics({ documentRef: document, locationRef: window.location });
}

import { loadHMHGame } from './src/games/hmh/loader.mjs';
import { createHmhRebootHost } from './src/hmh-reboot-host.mjs';
import { createHmhRebootPortalLifecycle } from './src/hmh-reboot-portal-lifecycle.mjs';
import { buildHmhRunRecapModel, selectGameOverRecapFields } from './src/hmh-run-recap.mjs';
import { buildHmhShareText, buildShareLinks, createShareRow, shareUrlFor } from './src/share-links.mjs';
import { createChikunHost } from './src/chikun-host.mjs';
import { readStackedSettings } from './src/stacked-player-settings.mjs';
import { createChikunPortalLifecycle } from './src/chikun-portal-lifecycle.mjs';
import { bindChikunDailyChallenge } from './src/chikun-daily-challenge.mjs';
import { mountHmhChallengeUi } from './src/hmh-challenge-ui.mjs';
import { HMH_PLAYER_SETTINGS_DEFAULTS, mergeHmhRuntimeSettings, normalizeHmhPlayerSettings, projectHmhRuntimeSettings } from './src/hmh-player-settings.mjs';
import { arcadeMusicVolume, musicSeekSeconds, shouldShowArcadeMusicPlayer } from './src/arcade-music-transport.mjs';
import { getSharedPlayerProfile, submitGameRun } from './src/game-registry.mjs';
import { createProviderRegistry, classifyWalletError, walletErrorAction } from './src/wallet-auth.mjs';
import { RANKED_ENTRY_FEE_ZKLTC, RANKED_SETTLEMENT_GAS_RESERVE_WEI, rankedEntryTotalWei, formatZkLtcWei } from './src/arcade-core.mjs';
import { ensureLiteForgeAtSignIn, fetchSeedTicket, formatZkLtc4, isRankedPaused, recordEntryBroadcast, seedTicketUsable, RANKED_CLOSED_MESSAGE, RANKED_PAUSED_MESSAGE } from './src/ranked-entry-flow.mjs';
import { sendRankedEntry, fetchWalletBalance, RANKED_ENTRY_GAS_UNITS, RANKED_ENTRY_FALLBACK_FEE_PER_GAS_WEI } from './src/litvm-chain-client.mjs';
import { HMH_SFX_MANIFEST } from './assets/audio/sfx/sfx-manifest.mjs';
import { buildDeviceProfile, joystickToKeys, joystickToManualAim, buildManualGrenadeTarget, buildTouchControlLayout, combatCanvasRenderScale } from './src/device-model.mjs';
import { browserFullscreenCapability, computeCombatViewportFit } from './src/hmh-viewport-fit.mjs';
import { assetSrcForFrameRef, parseAtlasFrameRef } from './src/atlas-frame-ref.mjs';
import { mountCabinetMotionControl } from './src/cabinet-motion.mjs';
import { HMH_HERO_PORTRAITS as HMH_REBOOT_HERO_SELECTOR_ATLAS } from './src/generated/hmh-hero-portraits.mjs';
import { restFrameIndex } from './src/hmh-hero-select-ui.mjs';
import { prewarmSelectedHeroActorRegistry, heroStateFromCombat } from './src/combat-sprite-bridge.mjs';

import { computeDamage } from './src/combat-damage.mjs';
import { runtimeBossHitbox, runtimeEnemyHitbox } from './src/hmh-hurtbox-runtime.mjs';
import { computeGoreDampening } from './src/gore-system.mjs';
import { grenadeCapacityForRun, planLevelOneGrenadeThrow, resolveGrenadeTypeForRun } from './src/hmh-grenade-economy.mjs';
import { buildGrenadeAimPreview, classifyGrenadeRelease, grenadeAimType, isGrenadeAimCancel } from './src/hmh-grenade-aim.mjs';
import {
  buildUpgradeRuntimePolicy,
  upgradedClipSize,
} from './src/hmh-upgrade-runtime.mjs';
import { createInProcessGameAdapter } from './src/game-adapter.mjs';

import { biomeAt, parallaxIndexForBiome, propsForBiome } from './src/biome-model.mjs';
import { drawRectIntersectsViewport, findNearestDrySpawn, resolveDistantSpawnPosition } from './src/world-obstacles.mjs';
import { sceneObjectsNear, SCENE_CELL } from './src/scene-templates.mjs';
import { HMH_LEVEL_ONE_ID } from './src/hmh-ground-selection.mjs';
import { buildGroundPlan } from './src/hmh-ground-plan.mjs';
import { buildLevelOneRoadTileIndex, classifyLevelOneTraversal } from './src/hmh-level-one-traversal.mjs';
import { groundEntityContactPointForProjection } from './src/hmh-ground-plane-rendering.mjs';
import {
  propDrawRectForGroundContact,
  propFrontEdgeDepth,
  propShadowEllipseForGroundContact,
} from './src/hmh-prop-grounding.mjs';
import { HMH_LEVEL_TWO_FINAL_CITY_ASSETS } from './assets/generated/hmh-coherent-world/level2-final-city/level2-final-city-manifest.mjs';
import { HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS } from './assets/generated/hmh-coherent-world/level3-final-getaway/level3-final-getaway-manifest.mjs';
import { HMH_LEVEL_THREE_FINAL_GROUND } from './assets/generated/hmh-level-three-ground/final-getaway/level3-final-getaway-ground-manifest.mjs';
import { gameSlugFor, isGuestAllowedStep, buildPlatformShellModel } from './src/arcade-router.mjs';
import { createPortalRouteController } from './src/routes/portal-route-controller.mjs';
import { createOfficialShellRoutes } from './src/routes/official-shell-routes.mjs';
import { createOfficialAppRoutes } from './src/routes/official-app-routes.mjs';
import { createLazyLeaderboardRoute, createLazyProfileRoute } from './src/routes/lazy-routes.mjs';
import { buildHmhRunDetailsModel, buildHmhRunHistoryModel } from './src/hmh-run-history.mjs';
import { wireHmhFreeQuickplay } from './src/hmh-free-quickplay.mjs';
import { createOfficialPlayRoutes } from './src/routes/official-play-routes.mjs';
import {
  districtTemplateContextForCell,
} from './src/district-generator.mjs';
import {
  getInitialHmhCampaignLevelId,
  getHmhCampaignLevel,
  getNextHmhCampaignLevel,
  formatHmhCampaignLevelBanner,
  buildHmhCampaignObjectiveState,
  buildHmhExtractionGuidance,
} from './src/hmh-campaign-levels.mjs';
import {
  buildCampaignPoiDirective,
  buildCampaignWorldSetup,
} from './src/hmh-campaign-runtime.mjs';
import { buildEncounterSceneObjects, buildEncounterTemplateContext, buildEncounterTerrainPressure } from './src/hmh-encounter-visuals.mjs';
import {
  levelOneInteractiveDebrisStateForObstacle,
  levelOneAaaRouteWorldStateAt,
  levelOneInteractiveHazardEffectAt,
  levelOneInteractiveHitPlan,
  levelOneInteractiveRuntimeStateForObstacle,
  levelOneInteractiveSfxCuePlan,
  levelOnePlayerAnimationPlan,
  nearestLevelOneInteractivePrompt,
} from './src/hmh-level-one-aaa-slices.mjs';
import { buildEnemyBalanceCard, resolveEliteAffixes, summarizeEliteAffixRuntime } from './src/hmh-combat-balance.mjs';
import {
  buildLevelOneBossChoreographyPlan,
  buildLevelOneSpawnCompositionAt,
} from './src/hmh-level-one-balance-pass.mjs';
import {
  levelOneCuratedRuntimeArtPolicy,
  levelOneCuratedAssetSrc,
} from './src/hmh-level-one-visible-runtime.mjs';
import { buildLevelOneWorldV3VisibleObjects } from './src/hmh-level-one-world-v3-objects.mjs';
import {
  levelOneLayoutV4SpawnRequest,
  levelOneRouteEncounterPacingAt,
  levelOneRouteObjectiveHudState,
  levelOneSpawnLaneForcesElite,
  levelOneSpawnLaneTelegraphForRole,
  levelOneWorldV3BossPoint,
  levelOneWorldV3DistrictContextAt,
  levelOneWorldV3PoiDirectiveAt,
} from './src/hmh-level-one-world-v3-gameplay.mjs';
import { buildAmbientZoneModel, buildCombatReadabilityProfile, buildEnvironmentState } from './src/hmh-environment-manager.mjs';
import {
  buildCharacterSelectEntries,
  buildCharacterStatIdentityRoster,
  HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
  playableCharacterStatIdentityFor,
  resolveSelectedCharacterId,
  setCharacterUnlockOptionsProvider,
  setPreferredCharacter,
} from './src/hmh-character-config.mjs';
import { getAllAuthoredSceneObjects } from './src/authored-world-layout.mjs';
import HMH_ASSET_FOOTPRINTS from './assets/hmh-asset-footprints.json' with { type: 'json' };

import { createMuzzleFlash, createShellCasing, createHitSparks, createBulletTrail, createExplosion, getFinalCombatVfxPack, projectPlayerShotScreenPoint } from './src/combat-vfx.mjs';
import {
  buildLevelUpInteractionGate,
  buildLevelUpViewportLayout,
  buildUpgradeMenuPresentation,
  canActivateLevelUpChoice,
  isLevelUpInteractionReady,
} from './src/hmh-upgrade-menu-ui.mjs';
import { buildCombatFeedbackPlan } from './src/hmh-combat-feedback.mjs';
import { HMH_COPY_SHEET } from './src/hmh-copy-sheet.mjs';
import { HMH_AUDIO_MIX, hmhSfxToneFor, resolveHmhSfxCuePlan, resolveHmhSfxVoiceAllocation } from './src/hmh-audio-system.mjs';

import {
  ACHIEVEMENTS,
  HARD_MONEY_HEROES_ASSET_MANIFEST,
  SIMULATED_WALLET_ADDRESS,
  LESTERS_ARCADE_V2_APP_SHELL,
  LITVM_LITEFORGE_NETWORK,
  LESTER_BLASTER_ISOMETRIC_ROGUELIKE,
  LESTER_BLASTER_PERFORMANCE_TARGETS,
  LESTER_BLASTER_POWER_UPS,
  LESTER_BLASTER_TACTICAL_CAMERA_MODEL,
  LESTER_BLASTER_TACTICAL_COMBAT_V2,
  LESTER_BLASTER_WEAPON_SYSTEM,
  buildGameOverSummaryModel,
  buildGameModeSelectModel,
  buildHardMoneyHeroesAnimationCoverageReport,
  buildLeaderboardModel,
  buildLeaderboardExperienceV2Model,
  buildCombatHudOverlayModel,
  buildCombatAccessibilitySettingsModel,
  computeWeaponUpgrades,
  buildRoguelikeSynergyHudModel,
  buildCombatOptionsMenuModel,
  buildCombatPauseGate,
  buildTacticalBalanceDebugOverlayModel,
  buildCombatSandboxStatusModel,
  buildFullscreenViewportModel,
  buildOfficialRunStatusModel,
  buildArcadeMusicPlayerModel,
  buildArcadeMusicQueueForContext,
  buildHardMoneyHeroesStatsModule,
  buildWalletConnectionModel,
  chooseArcadeMusicNextIndex,
  chooseArcadeMusicStartIndex,
  chooseEnemySpawn,
  chooseRoguelikeUpgradeOptions,
  connectPlayerAccount,
  createInitialArcadeState,
  createRoguelikeRunState,
  getGame,
  ARCADE_GAMES,
  getRoguelikeSpawnDirectorAt,
  levelOneRoguelikeSpawnDirectorAt,
  buildLevelOneSpawnBudgetState,
  levelOneRoguelikeSpawnBudgetAllows,
  ROGUELIKE_LEVEL_CAP,
  levelOneRoguelikePickupAssistAt,
  levelOneRoguelikePerformanceBudgetAt,
  applyAdaptivePerformanceBudget,
  createAdaptivePerformanceState,
  levelOneRoguelikeBossRoster,
  buildLevelOneBoundaryObstaclesNear,
  updateLevelOneExplorationTrail,
  buildLevelOneRunWorldDimensions,
  clampLevelOneWorldPoint,
  applyRoguelikeSkillUpgrade,
  calculateExtractionScore,
  hmhCampaignLevelAllowsExtraction,
  LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY,
  recordScore,
  applySettlement,
  setArcadeUsername,
  getAllCadenceLeaderboards,
  resolveDisplayName,
  validateUsername,
  scheduleBossEncounter,
  simulateLesterBlasterRun,
  startPlaySession,
  getPlaySessionIdentity,
  AVATAR_RULES,
  validateAvatarFile,
  computeAvatarResize,
  buildCabinetInitContextFromSession,
  buildPlayerArcadeSnapshot,
  buildProfileExperienceV2Model,
} from './src/arcade-core.mjs';
import { SETTLEMENT_LIVE, HOSTED_PROFILE_SYNC, LITVM_CONTRACT_ADDRESSES } from './src/settlement.mjs';
import { finalizeSessionEvidence, recordSessionEvent } from './src/session-integrity.mjs';
// Namespace imports: other wave-3 slices may import single names from these
// modules at their own anchors, and a second `import { rankedIdentityFor }`
// binding would be a duplicate declaration after the merge.
import * as rankedIdentityModule from './src/ranked-identity.mjs';
import * as achievementStats from './src/achievements/stats.mjs';
import { buildLevelOneBossDirective } from './src/hmh-level-one-boss.mjs';
import { bossBeatHealthMultiplier } from './src/hmh-boss-balance-pass.mjs';
// recordCadenceScore is unused here but stays imported: the 'leaderboard-readback' check of
// scripts/hmh-web3-settlement-audit.mjs reads this file for it. fetchGlobalLeaderboard stays beside it.
import { fetchGlobalLeaderboard, checkRankedReadiness, loadEthers } from './src/litvm-chain-client.mjs';
import { recordCadenceScore } from './src/leaderboard-engine.mjs';
import { formatSurvive, leaderboardEntryProvenance, purgeHouseSeedRows } from './src/leaderboard-seed.mjs';
import { loadArcadeState, saveArcadeState, appendRunRecord, clearActiveSessionCheckpoint } from './src/persistence.mjs';
import { createProfileSync, buildProfileDocument, mergeRemoteProfile } from './src/profile-sync-client.mjs';
import { createIndexApiClient, createRankedRunHoldings } from './src/index-api-client.mjs';

const DEBUG_ARCADE_RUNTIME = typeof window !== 'undefined' && window.localStorage?.getItem('lestersArcadeDebug') === '1';
const DEV_CABINETS_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('devCabinets') === '1';
function cabinetPlayableInCurrentMode(cabinet) {
  return Boolean(cabinet?.playable || (DEV_CABINETS_ENABLED && cabinet?.devPlayable));
}
function publicLeaderboardCabinets() {
  return LESTERS_ARCADE_V2_APP_SHELL.cabinets.filter((cabinet) => cabinet.playable && cabinet.leaderboardEligible !== false);
}
function playableCabinetNames() {
  return publicLeaderboardCabinets().map((cabinet) => cabinet.title);
}
function humanList(items) {
  if (items.length <= 1) return items[0] ?? 'Hard Money Heroes';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}
function debugRuntimeLog(...args) {
  if (DEBUG_ARCADE_RUNTIME) console.log(...args);
}

const MOCK_WALLET = SIMULATED_WALLET_ADDRESS;
const PLAYER_X = LESTER_BLASTER_TACTICAL_CAMERA_MODEL.playerStartScreenX;
const GROUND_Y = 276;
const ROGUELIKE_PLAYER_START_SEARCH_RADIUS_TILES = 56;
const ROGUELIKE_MIN_ENEMY_SPAWN_DISTANCE_TILES = 18;
const ROGUELIKE_MIN_POI_SUPPORT_SPAWN_DISTANCE_TILES = 20;
const ROGUELIKE_MIN_MINIBOSS_SPAWN_DISTANCE_TILES = 24;
const ROGUELIKE_MIN_BOSS_SPAWN_DISTANCE_TILES = 28;
const ROGUELIKE_MIN_SPAWN_ATTACK_DELAY_FRAMES = 96;
const MAX_FIXED_STEPS_PER_FRAME = 4;
function createFixedStepStats() {
  return {
    lastSteps: 0,
    peakSteps: 0,
    maxStepsPerFrame: MAX_FIXED_STEPS_PER_FRAME,
    observedWallClockMs: 0,
    droppedSimulationMs: 0,
    catchUpFrames: 0,
  };
}
const NORMAL_HIT_DAMAGE = LESTER_BLASTER_TACTICAL_COMBAT_V2.health.damagePerNormalHitPercent;
const PLAYER_MAX_HEALTH = LESTER_BLASTER_TACTICAL_COMBAT_V2.health.playerMaxPercent;
const STAGE_COUNT = 13;
const DEFAULT_VIEWPORT_MODE = LESTER_BLASTER_TACTICAL_COMBAT_V2.viewportModes.default;
const DEFAULT_CAMPAIGN_LEVEL_ID = getInitialHmhCampaignLevelId();
const DEBUG_BALANCE_QUERY = 'hmhDebug=balance';
const debugSearchParams = new URLSearchParams(window.location.search);
let tacticalBalanceDebugEnabled = debugSearchParams.get('hmhDebug') === 'balance';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadImageAsset(src) {
  if (!src) return null;
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  return image;
}

function imageReady(image) {
  if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) {
    return image.width > 0 && image.height > 0;
  }
  return Boolean(image?.complete && image.naturalWidth > 0);
}

async function decodeImageAsset(image) {
  if (!image) return false;
  if (imageReady(image)) return true;
  try {
    if (typeof image.decode === 'function') {
      await Promise.race([
        image.decode(),
        new Promise((resolve) => setTimeout(resolve, 1500, 'decode-timeout')),
      ]);
      return imageReady(image);
    }
  } catch {
    return imageReady(image);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(imageReady(image));
    };
    image.addEventListener?.('load', done, { once: true });
    image.addEventListener?.('error', done, { once: true });
    setTimeout(done, 1500);
  });
}

// Level 1 uses the lazy animated roster. Keep the legacy canonical registry
// empty at portal bootstrap so its heavyweight manifests do not enter the
// first-load import closure before the player selects Hard Money Heroes.
const HMH_ACTOR_REGISTRY = new Map();

function selectAnimationFrame(frames, frame, fps = 10, loop = true) {
  if (!frames?.length) return null;
  const ticksPerFrame = Math.max(1, Math.round(LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps / fps));
  const rawIndex = Math.floor(frame / ticksPerFrame);
  const index = loop ? rawIndex % frames.length : Math.min(frames.length - 1, rawIndex);
  return frames[index];
}

function buildProductionSpriteIndex(items = []) {
  return Object.fromEntries(items.map((item) => [item.slug, {
    ...item,
    image: item.src ? loadImageAsset(item.src) : null,
    frames: (item.frames ?? []).map((frame) => ({ ...frame, image: loadImageAsset(frame.src) })),
  }]));
}

function buildVfxUiChromeSpriteIndex(items = []) {
  return Object.fromEntries(items.map((item) => [item.key, {
    slug: item.key,
    ...item,
    image: item.src ? loadImageAsset(item.src) : null,
    frames: (item.frameList ?? []).map((frame) => ({ ...frame, image: loadImageAsset(frame.src) })),
  }]));
}

function buildFinalCombatVfxSpriteIndex(items = []) {
  return Object.fromEntries(items.map((item) => [item.key, {
    slug: item.key,
    ...item,
    frameCount: item.frames ?? item.frameCount ?? 1,
    image: item.src ? loadImageAsset(item.src) : null,
    frames: [],
  }]));
}

function buildProductionArtPass() {
  return {
    sourceAssetCount: hmh('HMH_ISOMETRIC_PIXELLAB_WAVE_1')?.assets?.length ?? 0,
    manifestGeneratedAt: hmh('HMH_PRODUCTION_ART_PASS')?.generatedAt,
    targetFps: hmh('HMH_PRODUCTION_ART_PASS')?.targetFps,
    tiles: buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.tiles),
    props: buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.props),
    rotatingProps: buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.rotatingProps),
    pickups: buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.pickups),
    weapons: buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.weapons),
    vfx: {
      ...buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.vfx),
      ...buildFinalCombatVfxSpriteIndex(getFinalCombatVfxPack()?.assets),
      ...buildVfxUiChromeSpriteIndex(hmh('HMH_VFX_UI_CHROME_PACK')?.vfx),
    },
    ui: {
      ...buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.ui),
      ...buildVfxUiChromeSpriteIndex(hmh('HMH_VFX_UI_CHROME_PACK')?.uiChrome),
    },
    levels: hmh('HMH_PRODUCTION_ART_PASS')?.levels ?? [],
    cabinet: hmh('HMH_PRODUCTION_ART_PASS')?.cabinet,
    animationPass: hmh('HMH_PRODUCTION_ART_PASS')?.animationPass,
  };
}

const wo110BossImageCache = new Map();
function wo110BossImage(asset) {
  if (!asset?.src) return null;
  if (!wo110BossImageCache.has(asset.key)) wo110BossImageCache.set(asset.key, loadImageAsset(asset.src));
  return wo110BossImageCache.get(asset.key);
}
function wo110BossAssetForRuntime({ phase, superMove, deathSpectacle }) {
  const state = deathSpectacle ? 'death-spectacle' : superMove ? 'super-telegraph' : 'phase-form';
  return hmh('HMH_WO110_BOSS_REDO')?.assets?.find((asset) => asset.phase === (deathSpectacle ? 3 : phase) && asset.state === state && (!superMove || asset.superMove === superMove)) ?? null;
}
function wo110BossRuntimeFrame(boss, frame = combat.frame) {
  if (!boss) return null;
  const id = `${boss.id ?? ''} ${boss.title ?? ''}`.toLowerCase();
  if (!id.includes('rug') && !id.includes('baron')) return null;
  const phase = clamp(Math.round(Number(boss.phase) || 1), 1, 3);
  const attackTimer = Number(boss.attackTimer) || 0;
  const hp = Number(boss.hp ?? 1);
  const superMove = attackTimer > 0 && attackTimer < 34
    ? (phase === 3 ? 'liquidation-wave' : phase === 2 ? 'rug-pull-chain' : 'whale-dump')
    : null;
  const asset = wo110BossAssetForRuntime({ phase, superMove, deathSpectacle: hp <= 0 || boss.deathSpectacle });
  const image = wo110BossImage(asset);
  return image ? {
    image,
    img: image,
    ready: Boolean(image.complete && image.naturalWidth > 0),
    src: asset?.src ?? '',
    asset,
  } : null;
}

function productionAnimationFps(art, name, fallback = 12) {
  return art?.animationMeta?.[name]?.fps ?? fallback;
}

function productionCabinetSprite() {
  // The game-selection/splash cabinet should always use the hand-authored
  // six-view user sprite sheet, even after the heavy HMH payload is loaded.
  // The production art pass still carries an older PixelLab 8-direction object;
  // letting that override the app-shell manifest makes the rotating cabinet swap
  // art after the first load. Pull from the app shell so every rotating Hard
  // Money Heroes cabinet stays on the same approved sprite sheet.
  const shellCabinet = LESTERS_ARCADE_V2_APP_SHELL.cabinets
    .find((cabinet) => cabinet.id === 'hard-money-heroes')?.desktopCabinetSprite;
  return shellCabinet?.frames?.length ? shellCabinet : null;
}

// Every post-connect screen (and the splash) uses the SAME clean Hard Money
// Heroes key art as a true full-bleed `cover` background — no menu panels or
// buttons baked into the image (menus are real DOM controls layered on top).
const HMH_KEY_ART_BG = './assets/generated/hmh-key-art/hard-money-heroes-keyart-bg.jpg';
const HMH_LOADING_KEYARTS = Object.freeze([
  './assets/generated/hmh-key-art/hmh-loading-keyart-1.jpg',
  './assets/generated/hmh-key-art/hmh-loading-keyart-2.jpg',
  './assets/generated/hmh-key-art/hmh-loading-keyart-3.jpg',
  './assets/generated/hmh-key-art/hmh-loading-keyart-4.jpg',
]);

// Lazy-loaded HMH game payload. Populated by ensureHMHLoaded() when the user
// picks the Hard Money Heroes cabinet. All gameplay references to the heavy
// HMH manifests (below) read through these bindings so the same code works
// whether the manifest has been loaded or is still pending.
let HMH_PAYLOAD = null;
let HMH_LOAD_PROMISE = null;
async function ensureHMHLoaded() {
  if (HMH_PAYLOAD) return HMH_PAYLOAD;
  if (HMH_LOAD_PROMISE) return HMH_LOAD_PROMISE;
  HMH_LOAD_PROMISE = loadHMHGame().then((payload) => {
    HMH_PAYLOAD = payload;
    refreshHmhCombatArtPayload();
    return payload;
  });
  return HMH_LOAD_PROMISE;
}
function hmh(name) { return HMH_PAYLOAD ? HMH_PAYLOAD[name] : undefined; }

// Lightweight full-screen overlay shown while the heavy HMH manifests download
// (first cabinet selection). The analysis flagged that the 9 dynamic imports
// gave zero feedback on slow connections — this is the "INSERT CARTRIDGE"
// moment, so it gets arcade-flavored copy and an animated bar.
function showCartridgeLoadingOverlay(cabinetTitle = 'Hard Money Heroes') {
  const overlay = document.createElement('div');
  overlay.id = 'cartridgeLoadingOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(3,6,23,0.92);display:flex;align-items:center;justify-content:center;flex-direction:column;backdrop-filter:blur(3px);';
  const title = document.createElement('div');
  title.style.cssText = 'color:#ffe84d;font-family:monospace;font-size:17px;letter-spacing:3px;margin-bottom:18px;text-shadow:0 0 18px rgba(255,232,77,0.6);';
  title.textContent = `INSERTING ${cabinetTitle.toUpperCase()} CARTRIDGE…`;
  const barShell = document.createElement('div');
  barShell.style.cssText = 'width:50%;max-width:420px;height:10px;background:rgba(255,255,255,0.12);border:2px solid #19f7ff;border-radius:999px;overflow:hidden;';
  const bar = document.createElement('div');
  // Indeterminate sweep — import() exposes no byte progress, so honesty over
  // a fake percentage: a looping cyan sweep that reads as "working".
  bar.style.cssText = 'height:100%;width:34%;background:linear-gradient(90deg,transparent,#19f7ff,#fff);animation:cartridgeSweep 1.1s linear infinite;';
  if (!document.getElementById('cartridgeSweepKeyframes')) {
    const style = document.createElement('style');
    style.id = 'cartridgeSweepKeyframes';
    style.textContent = '@keyframes cartridgeSweep { from { transform: translateX(-110%); } to { transform: translateX(330%); } }';
    document.head.appendChild(style);
  }
  barShell.appendChild(bar);
  const hint = document.createElement('div');
  hint.style.cssText = 'color:#9aa6c4;font-family:monospace;font-size:11px;letter-spacing:2px;margin-top:14px;';
  hint.textContent = 'DOWNLOADING SPRITES · ENEMIES · LEVELS (FIRST LOAD ONLY)';
  overlay.append(title, barShell, hint);
  document.body.appendChild(overlay);
  return () => {
    overlay.style.transition = 'opacity 240ms ease';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 260);
  };
}

// Default profile avatar shown when a player hasn't uploaded their own (was a
// green initial chip; now the Litecoin Chad PFP).
const DEFAULT_AVATAR_SRC = './assets/generated/hmh-avatars/litecoin-chad-default.jpg';
// Screens that use the full-bleed key art background.
const HMH_KEY_ART_SCREENS = new Set([
  'splash', 'mainMenu', 'cabinetSelect', 'modeSelect', 'profile', 'leaderboards', 'settings', 'options',
]);

function hardMoneyHeroScreenStyle(screenId) {
  if (HMH_KEY_ART_SCREENS.has(screenId)) {
    // A vertical scrim keeps the art readable behind UI while letting the
    // heroes show through: darker at the very top/bottom (where chrome sits),
    // lighter across the middle band so the key art is clearly visible.
    const scrim = 'linear-gradient(180deg, rgba(3,6,23,0.82) 0%, rgba(3,6,23,0.42) 26%, rgba(3,6,23,0.40) 64%, rgba(3,6,23,0.86) 100%)';
    return `${scrim}, url("${HMH_KEY_ART_BG}")`;
  }
  const screen = HARD_MONEY_HEROES_ASSET_MANIFEST.screens[screenId];
  if (!screen?.src) return '';
  return `linear-gradient(120deg, rgba(4, 11, 26, 0.86), rgba(8, 6, 22, 0.5)), url("${screen.src}")`;
}

function hardMoneyHeroScreenBackgroundProfile(screenId) {
  // Two layers everywhere now (scrim gradient + key art) -> two-value bg props,
  // both sized so the key art covers the whole view. `fixed` attachment keeps
  // the art steady while content scrolls (disabled on mobile via CSS).
  const keyArt = {
    backgroundSize: 'cover, cover',
    backgroundPosition: 'center, center center',
    backgroundRepeat: 'no-repeat, no-repeat',
    backgroundColor: '#030617',
  };
  if (HMH_KEY_ART_SCREENS.has(screenId)) return keyArt;
  return {
    backgroundSize: 'cover, cover',
    backgroundPosition: 'center, center',
    backgroundRepeat: 'no-repeat, no-repeat',
    backgroundColor: '#030617',
  };
}

function applyHardMoneyHeroScreenBackground(node, screenId) {
  if (!node) return;
  const profile = hardMoneyHeroScreenBackgroundProfile(screenId);
  node.style.backgroundImage = hardMoneyHeroScreenStyle(screenId);
  node.style.backgroundSize = profile.backgroundSize;
  node.style.backgroundPosition = profile.backgroundPosition;
  node.style.backgroundRepeat = profile.backgroundRepeat;
  node.style.backgroundColor = profile.backgroundColor;
}

function applyGameModeSelectBackground(node, model) {
  if (!node || !model) return;
  if (model.gameId === 'lester-blaster') {
    applyHardMoneyHeroScreenBackground(node, 'modeSelect');
    return;
  }
  const scrim = 'linear-gradient(180deg, rgba(3,6,23,0.88) 0%, rgba(3,6,23,0.46) 28%, rgba(3,6,23,0.48) 64%, rgba(3,6,23,0.92) 100%)';
  node.style.backgroundImage = `${scrim}, url("${model.backgroundAsset}")`;
  node.style.backgroundSize = 'cover, cover';
  node.style.backgroundPosition = `center, ${model.backgroundPosition}`;
  node.style.backgroundRepeat = 'no-repeat, no-repeat';
  node.style.backgroundColor = '#030617';
}

const arcadeMusic = {
  context: 'arcade',
  queue: buildArcadeMusicQueueForContext('arcade'),
  currentTrackIndex: 0,
  unlocked: false,
  playing: false,
  muted: false,
  volume: 0.7,
  expanded: false,
  shuffle: false,
  renderQueued: false,
};

const combatAudio = {
  sfxEnabled: true,
  audioContext: null,
  activeVoices: new Set(),
  nextVoiceId: 0,
  peakVoices: 0,
  droppedVoices: 0,
  stolenVoices: 0,
  lastSfxAt: new Map(),
  sfxBuffers: new Map(),
  sfxLoading: new Map(),
  sfxLoadAttempted: false,
};

// Versioned HMH preferences persist as bounded controls/gameplay/audio/
// accessibility domains. The flat object remains a compatibility view for the
// legacy parent renderer until that renderer is retired.
let hmhPlayerSettings = HMH_PLAYER_SETTINGS_DEFAULTS;
const gameSettings = {
  screenShake: true,
  gore: true,
  autoEnterFullscreen: true,
  reduceMotion: false,
  reduceFlash: false,
  colorblindTags: false,
  autoAimAssist: true,
  touchLeftHanded: false,
  touchControlOpacity: 0.4,
};
function applyHmhSettingsCompatibilityView(value) {
  Object.assign(gameSettings, value.gameplay, {
    reduceMotion: value.accessibility.reduceMotion,
    reduceFlash: value.accessibility.reduceFlash,
    colorblindTags: value.accessibility.colorblindTags,
    touchLeftHanded: value.controls.touchLeftHanded,
    touchControlOpacity: value.controls.touchOpacity,
  });
}
(function loadGameSettings() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('hmh-settings') : null;
    hmhPlayerSettings = normalizeHmhPlayerSettings(raw ? JSON.parse(raw) : HMH_PLAYER_SETTINGS_DEFAULTS);
  } catch {
    hmhPlayerSettings = HMH_PLAYER_SETTINGS_DEFAULTS;
  }
  arcadeMusic.volume = arcadeMusicVolume(hmhPlayerSettings.audio.musicVolume);
  arcadeMusic.muted = !hmhPlayerSettings.audio.musicEnabled;
  applyHmhSettingsCompatibilityView(hmhPlayerSettings);
})();
function persistHmhPlayerSettings() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('hmh-settings', JSON.stringify(hmhPlayerSettings)); } catch { /* ignore */ }
}
function saveGameSettings() {
  hmhPlayerSettings = normalizeHmhPlayerSettings({
    ...hmhPlayerSettings,
    controls: {
      ...hmhPlayerSettings.controls,
      touchLeftHanded: gameSettings.touchLeftHanded,
      touchOpacity: gameSettings.touchControlOpacity,
    },
    gameplay: {
      ...hmhPlayerSettings.gameplay,
      screenShake: gameSettings.screenShake,
      gore: gameSettings.gore,
      autoEnterFullscreen: gameSettings.autoEnterFullscreen,
      autoAimAssist: gameSettings.autoAimAssist,
    },
    accessibility: {
      ...hmhPlayerSettings.accessibility,
      reduceMotion: gameSettings.reduceMotion,
      reduceFlash: gameSettings.reduceFlash,
      colorblindTags: gameSettings.colorblindTags,
    },
  });
  persistHmhPlayerSettings();
}

function applyGameplayAccessibilitySettings() {
  const root = document.documentElement;
  root.dataset.reduceMotion = gameSettings.reduceMotion ? 'true' : 'false';
  root.dataset.reduceFlash = gameSettings.reduceFlash ? 'true' : 'false';
  root.dataset.colorblindTags = gameSettings.colorblindTags ? 'true' : 'false';
  const touchLayout = buildTouchControlLayout({
    leftHanded: gameSettings.touchLeftHanded,
    opacity: gameSettings.touchControlOpacity,
    orientation: root.dataset.orientation ?? 'landscape',
  });
  root.dataset.touchHandedness = touchLayout.leftHanded ? 'left' : 'right';
  root.style.setProperty('--touch-control-idle-opacity', String(touchLayout.idleOpacity));
  root.style.setProperty('--touch-control-active-opacity', String(touchLayout.activeOpacity));
  if (gameSettings.reduceMotion) combat.shake = 0;
}

function currentArcadeMusicTrack() {
  if (!arcadeMusic.queue.length) return null;
  const normalizedIndex = ((arcadeMusic.currentTrackIndex % arcadeMusic.queue.length) + arcadeMusic.queue.length) % arcadeMusic.queue.length;
  return arcadeMusic.queue[normalizedIndex] ?? arcadeMusic.queue[0];
}

function arcadeMusicAudio() {
  return dom.arcadeMusicAudio ?? null;
}

function loadArcadeMusicTrack(track = currentArcadeMusicTrack()) {
  const audio = arcadeMusicAudio();
  if (!audio || !track) return null;
  if (audio.dataset.trackId !== track.id) {
    audio.pause();
    audio.src = track.src;
    audio.dataset.trackId = track.id;
    audio.preload = 'metadata';
    audio.load();
  }
  audio.loop = false;
  audio.muted = arcadeMusic.muted;
  return audio;
}

function renderArcadeMusicPlayer() {
  if (!dom.arcadeMusicPlayer) return;
  const gameplayPaused = officialAppStep === 'gameplay' && combat.paused;
  const visible = shouldShowArcadeMusicPlayer({
    appStep: officialAppStep,
    gameplayPaused,
    pendingBegin: combat.pendingBegin,
    levelUpPaused: combat.levelUpPaused,
  });
  dom.arcadeMusicPlayer.hidden = !visible;
  dom.arcadeMusicPlayer.dataset.surface = gameplayPaused ? 'pause-menu' : 'global';
  const track = currentArcadeMusicTrack();
  const audio = arcadeMusicAudio();
  if (audio && track && audio.dataset.trackId !== track.id) loadArcadeMusicTrack(track);
  const isCurrentAudio = audio?.dataset.trackId === track?.id;
  const currentTimeSeconds = isCurrentAudio ? audio.currentTime : 0;
  const playing = Boolean(audio && !audio.paused && !audio.ended);
  arcadeMusic.playing = playing;
  const model = buildArcadeMusicPlayerModel({
    context: arcadeMusic.context,
    currentTrackId: track?.id,
    currentTimeSeconds,
    playing,
    muted: arcadeMusic.muted,
    expanded: arcadeMusic.expanded,
    shuffle: arcadeMusic.shuffle,
  });
  dom.arcadeMusicPlayer.dataset.expanded = String(model.expanded);
  dom.arcadeMusicPlayer.dataset.playing = String(model.playing);
  dom.arcadeMusicPlayer.dataset.muted = String(model.muted);
  dom.arcadeMusicPlayer.dataset.shuffle = String(model.shuffle);
  dom.arcadeMusicPlayer.dataset.context = model.context;
  if (dom.arcadeMusicTitle) dom.arcadeMusicTitle.textContent = model.title;
  if (dom.arcadeMusicTime) dom.arcadeMusicTime.textContent = model.progress.label;
  if (dom.arcadeMusicDuration) dom.arcadeMusicDuration.textContent = model.durationLabel;
  if (dom.arcadeMusicProgressFill) dom.arcadeMusicProgressFill.style.width = `${model.progress.percent.toFixed(1)}%`;
  if (dom.arcadeMusicSeek) {
    dom.arcadeMusicSeek.value = String(Math.round(model.progress.percent * 10));
    dom.arcadeMusicSeek.setAttribute('aria-valuetext', model.progress.label);
  }
  if (dom.arcadeMusicVolume) {
    const percent = Math.round(arcadeMusic.volume * 100);
    dom.arcadeMusicVolume.value = String(percent);
    dom.arcadeMusicVolume.setAttribute('aria-valuetext', `${percent}%`);
    if (dom.arcadeMusicVolumeValue) dom.arcadeMusicVolumeValue.textContent = `${percent}%`;
  }
  if (dom.arcadeMusicPlayButton) {
    setButtonIcon(dom.arcadeMusicPlayButton, model.playing ? 'pause' : 'play');
    dom.arcadeMusicPlayButton.setAttribute('aria-label', model.playing ? 'Pause arcade music' : 'Play arcade music');
  }
  if (dom.arcadeMusicMuteButton) {
    setButtonIcon(dom.arcadeMusicMuteButton, model.muted ? 'mute' : 'volume');
    dom.arcadeMusicMuteButton.setAttribute('aria-label', model.muted ? 'Unmute arcade music' : 'Mute arcade music');
  }
  if (dom.arcadeMusicShuffleButton) {
    setButtonIcon(dom.arcadeMusicShuffleButton, 'shuffle');
    dom.arcadeMusicShuffleButton.classList.toggle('active', model.shuffle);
    dom.arcadeMusicShuffleButton.setAttribute('aria-pressed', String(model.shuffle));
    dom.arcadeMusicShuffleButton.setAttribute('aria-label', model.shuffle ? 'Turn shuffle off' : 'Turn shuffle on');
  }
  if (dom.arcadeMusicExpandButton) {
    setButtonIcon(dom.arcadeMusicExpandButton, model.expanded ? 'chevron-up' : 'chevron-down');
    dom.arcadeMusicExpandButton.setAttribute('aria-label', model.expanded ? 'Collapse arcade music player' : 'Expand arcade music player');
  }
  const queueKey = `${model.context}:${model.trackId}`;
  if (dom.arcadeMusicQueueList && dom.arcadeMusicQueueList.dataset.queueKey !== queueKey) {
    // Show full queue with click-to-play, no redundant numbering (tracks have their own order)
    dom.arcadeMusicQueueList.replaceChildren(...model.queue.map((queueTrack, index) => {
      const item = el('li', {
        className: queueTrack.id === model.trackId ? 'active' : '',
        'data-track-id': queueTrack.id,
      });
      item.textContent = `${queueTrack.title} // ${queueTrack.durationLabel}`;
      item.addEventListener('click', async () => {
        playSfxCue('menu-click', 0.05);
        const audio = loadArcadeMusicTrack(queueTrack);
        arcadeMusic.currentTrackIndex = index;
        renderArcadeMusicPlayer();
        if (audio) {
          arcadeMusic.unlocked = true;
          // If track just changed, wait for canplaythrough before playing
          const justSelected = audio.dataset.trackId === queueTrack.id && audio.readyState >= 3;
          const needsReload = !(audio.dataset.trackId === queueTrack.id && audio.readyState >= 3);
          if (needsReload) {
            audio.pause();
            audio.src = queueTrack.src;
            audio.dataset.trackId = queueTrack.id;
            audio.preload = 'auto';
            audio.load();
          }
          if (!justSelected || needsReload) {
            await new Promise((resolve) => {
              const onReady = () => {
                audio.removeEventListener('canplaythrough', onReady);
                resolve();
              };
              audio.addEventListener('canplaythrough', onReady, { once: true });
              // Fallback timeout
              setTimeout(resolve, 2000);
            });
          }
          try {
            await audio.play();
            arcadeMusic.playing = true;
          } catch {
            // Auto-play blocked, user will need to tap play button
            arcadeMusic.playing = false;
          }
        }
      });
      return item;
    }));
    dom.arcadeMusicQueueList.dataset.queueKey = queueKey;
  }
}

function scheduleArcadeMusicRender() {
  if (arcadeMusic.renderQueued) return;
  arcadeMusic.renderQueued = true;
  requestAnimationFrame(() => {
    arcadeMusic.renderQueued = false;
    renderArcadeMusicPlayer();
  });
}

function arcadeMusicContextGain(reason = 'menu') {
  if (reason === 'gameplay') return 0.55;
  if (reason === 'game-over') return 0.26;
  return 0.38;
}

function arcadeMusicRuntimeContext() {
  if (combat.gameOver) return 'game-over';
  if (officialAppStep === 'gameplay') return 'gameplay';
  return 'menu';
}

function applyArcadeMusicVolume(reason = arcadeMusicRuntimeContext()) {
  const audio = arcadeMusicAudio();
  if (!audio) return 0;
  audio.volume = arcadeMusicVolume(arcadeMusic.volume) * arcadeMusicContextGain(reason);
  return audio.volume;
}

async function ensureArcadeMusicPlayer(reason = 'menu', autoplay = false) {
  const audio = loadArcadeMusicTrack();
  if (!audio) {
    renderArcadeMusicPlayer();
    return false;
  }
  applyArcadeMusicVolume(reason);
  audio.muted = arcadeMusic.muted;
  if (!autoplay) {
    renderArcadeMusicPlayer();
    return false;
  }
  arcadeMusic.unlocked = true;
  try {
    await audio.play();
    arcadeMusic.playing = true;
    renderArcadeMusicPlayer();
    return true;
  } catch {
    arcadeMusic.playing = false;
    renderArcadeMusicPlayer();
    return false;
  }
}

function setArcadeMusicContext(context = 'arcade', { reset = false } = {}) {
  const previousTrackId = currentArcadeMusicTrack()?.id;
  arcadeMusic.context = context;
  arcadeMusic.queue = buildArcadeMusicQueueForContext(context);
  const existingIndex = arcadeMusic.queue.findIndex((track) => track.id === previousTrackId);
  arcadeMusic.currentTrackIndex = reset || existingIndex < 0 ? 0 : existingIndex;
  loadArcadeMusicTrack();
  renderArcadeMusicPlayer();
}

async function startArcadeMusicForGame(gameId = 'hard-money-heroes') {
  const previousTrackId=currentArcadeMusicTrack()?.id;
  setArcadeMusicContext(gameId, { reset: true });
  // Begin each run on a random song from the game's queue instead of always
  // opening on the first track (the Hard Money Heroes main theme).
  if (arcadeMusic.queue.length > 1) {
    arcadeMusic.currentTrackIndex = chooseArcadeMusicStartIndex({ queueLength: arcadeMusic.queue.length, previousIndex: arcadeMusic.queue.findIndex(track=>track.id===previousTrackId) });
    loadArcadeMusicTrack();
    renderArcadeMusicPlayer();
  }
  combat.musicEnabled = !arcadeMusic.muted;
  return ensureArcadeMusicPlayer('gameplay', combat.musicEnabled);
}

async function ensureCombatMusic(reason = 'menu') {
  return ensureArcadeMusicPlayer(reason, combat.musicEnabled && (arcadeMusic.playing || reason === 'gameplay' || reason === 'game-over'));
}

function pauseArcadeMusic() {
  const audio = arcadeMusicAudio();
  audio?.pause();
  arcadeMusic.playing = false;
  renderArcadeMusicPlayer();
}

function pauseCombatMusic() {
  pauseArcadeMusic();
}

async function toggleArcadeMusicPlay() {
  const audio = loadArcadeMusicTrack();
  if (!audio) return false;
  if (!audio.paused && !audio.ended) {
    pauseArcadeMusic();
    return false;
  }
  return ensureArcadeMusicPlayer(combat.active ? 'gameplay' : 'menu', true);
}

function setArcadeMusicEnabled(enabled) {
  const musicOn = Boolean(enabled);
  arcadeMusic.muted = !musicOn;
  combat.musicEnabled = musicOn;
  hmhPlayerSettings = normalizeHmhPlayerSettings({
    ...hmhPlayerSettings,
    audio: { ...hmhPlayerSettings.audio, musicEnabled: musicOn },
  });
  persistHmhPlayerSettings();
  const audio = arcadeMusicAudio();
  if (audio) audio.muted = !musicOn;
  renderArcadeMusicPlayer();
  syncCombatOverlay();
  return musicOn;
}

function setArcadeMusicVolume(value) {
  arcadeMusic.volume = arcadeMusicVolume(value, arcadeMusic.volume);
  hmhPlayerSettings = normalizeHmhPlayerSettings({
    ...hmhPlayerSettings,
    audio: { ...hmhPlayerSettings.audio, musicVolume: arcadeMusic.volume },
  });
  persistHmhPlayerSettings();
  applyArcadeMusicVolume();
  pushHmhRebootSettings();
  renderArcadeMusicPlayer();
  return arcadeMusic.volume;
}

function seekArcadeMusic(progressValue) {
  const audio = arcadeMusicAudio();
  const track = currentArcadeMusicTrack();
  if (!audio || !track) return 0;
  const durationSeconds = Number.isFinite(audio.duration) && audio.duration > 0
    ? audio.duration
    : track.durationSeconds;
  const seconds = musicSeekSeconds({ fraction: Number(progressValue) / 1000, durationSeconds });
  try { audio.currentTime = seconds; } catch { return 0; }
  renderArcadeMusicPlayer();
  return seconds;
}

function toggleArcadeMusicMute() {
  return setArcadeMusicEnabled(arcadeMusic.muted);
}

async function nextArcadeMusicTrack({ autoplay = arcadeMusic.playing } = {}) {
  if (!arcadeMusic.queue.length) return null;
  const audio = arcadeMusicAudio();
  audio?.pause();
  arcadeMusic.currentTrackIndex = chooseArcadeMusicNextIndex({
    currentIndex: arcadeMusic.currentTrackIndex,
    queueLength: arcadeMusic.queue.length,
    shuffle: arcadeMusic.shuffle,
  });
  loadArcadeMusicTrack();
  await ensureArcadeMusicPlayer(combat.active ? 'gameplay' : 'menu', autoplay);
  return currentArcadeMusicTrack();
}

async function previousArcadeMusicTrack() {
  if (!arcadeMusic.queue.length) return null;
  const audio = arcadeMusicAudio();
  const autoplay = arcadeMusic.playing;
  audio?.pause();
  arcadeMusic.currentTrackIndex = (arcadeMusic.currentTrackIndex - 1 + arcadeMusic.queue.length) % arcadeMusic.queue.length;
  loadArcadeMusicTrack();
  await ensureArcadeMusicPlayer(combat.active ? 'gameplay' : 'menu', autoplay);
  return currentArcadeMusicTrack();
}

function nextCombatMusicTrack() {
  return nextArcadeMusicTrack();
}

function toggleArcadeMusicExpanded() {
  arcadeMusic.expanded = !arcadeMusic.expanded;
  renderArcadeMusicPlayer();
}

function toggleArcadeMusicShuffle() {
  arcadeMusic.shuffle = !arcadeMusic.shuffle;
  renderArcadeMusicPlayer();
  return arcadeMusic.shuffle;
}

function sfxToneFor(cue) {
  return hmhSfxToneFor(cue);
}

function ensureAudioContext() {
  if (typeof window === 'undefined') return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  combatAudio.audioContext ??= new Context();
  const ctx = combatAudio.audioContext;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function loadSfxSample(cue) {
  const ctx = combatAudio.audioContext;
  if (!ctx) return;
  if (combatAudio.sfxBuffers.has(cue) || combatAudio.sfxLoading.has(cue)) return;
  const src = HMH_SFX_MANIFEST.cues?.[cue];
  if (!src) return;
  const promise = fetch(src)
    .then((res) => {
      if (!res.ok) throw new Error(`sfx fetch ${res.status}`);
      return res.arrayBuffer();
    })
    .then((data) => new Promise((resolve, reject) => {
      // Use the callback form so older Safari decodeAudioData also works.
      ctx.decodeAudioData(data, resolve, reject);
    }))
    .then((buffer) => {
      combatAudio.sfxBuffers.set(cue, buffer);
      combatAudio.sfxLoading.delete(cue);
    })
    .catch(() => {
      // Leave the cue unloaded so playSfxCue falls back to the synth tone.
      combatAudio.sfxLoading.delete(cue);
    });
  combatAudio.sfxLoading.set(cue, promise);
}

function preloadSfxSamples() {
  if (combatAudio.sfxLoadAttempted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  combatAudio.sfxLoadAttempted = true;
  for (const cue of Object.keys(HMH_SFX_MANIFEST.cues ?? {})) {
    loadSfxSample(cue);
  }
}

function releaseSfxVoice(voice) {
  if (!voice || voice.released) return;
  voice.released = true;
  combatAudio.activeVoices.delete(voice);
  for (const node of voice.nodes ?? []) {
    try { node.disconnect(); } catch { /* already disconnected */ }
  }
  try { voice.gain?.disconnect(); } catch { /* already disconnected */ }
  voice.nodes.length = 0;
}

function stopSfxVoice(voice) {
  if (!voice || voice.released) return;
  for (const node of voice.nodes ?? []) {
    try { node.stop(); } catch { /* already stopped */ }
  }
  releaseSfxVoice(voice);
}

function resetCombatAudioVoiceState() {
  for (const voice of [...combatAudio.activeVoices]) stopSfxVoice(voice);
  combatAudio.activeVoices.clear();
  combatAudio.peakVoices = 0;
  combatAudio.droppedVoices = 0;
  combatAudio.stolenVoices = 0;
  combatAudio.lastSfxAt.clear();
}

function allocateSfxVoice(plan, startedAt) {
  const allocation = resolveHmhSfxVoiceAllocation({
    activeVoices: [...combatAudio.activeVoices],
    incoming: plan,
  });
  if (!allocation.allowed) {
    combatAudio.droppedVoices += 1;
    return null;
  }
  if (allocation.stealVoiceId) {
    const stolen = [...combatAudio.activeVoices].find((voice) => voice.id === allocation.stealVoiceId);
    if (stolen) {
      combatAudio.stolenVoices += 1;
      stopSfxVoice(stolen);
    }
  }
  const voice = {
    id: `sfx-${combatAudio.nextVoiceId += 1}`,
    family: plan.family,
    priority: plan.priority,
    startedAt,
    nodes: [],
    gain: null,
    released: false,
  };
  combatAudio.activeVoices.add(voice);
  combatAudio.peakVoices = Math.max(combatAudio.peakVoices, combatAudio.activeVoices.size);
  return voice;
}

function playSfxSample(cue, volume, voice) {
  const ctx = combatAudio.audioContext;
  const buffer = combatAudio.sfxBuffers.get(cue);
  if (!ctx || !buffer) return false;
  const gain = ctx.createGain();
  // Sample SFX are full-range; scale relative to the legacy synth volume curve.
  gain.gain.value = Math.min(1, Math.max(0.02, volume * 8));
  gain.connect(ctx.destination);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  voice.gain = gain;
  voice.nodes.push(source);
  source.onended = () => releaseSfxVoice(voice);
  source.start();
  return true;
}

function playSfxSynth(cue, volume, synth = 'triangle', voice) {
  const ctx = combatAudio.audioContext;
  if (!ctx) return false;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  gain.connect(ctx.destination);
  const tones = sfxToneFor(cue);
  if (!tones.length) return false;
  voice.gain = gain;
  tones.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = ['sine', 'square', 'sawtooth', 'triangle'].includes(synth) ? synth : 'triangle';
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    voice.nodes.push(oscillator);
    if (index === tones.length - 1) oscillator.onended = () => releaseSfxVoice(voice);
    const start = ctx.currentTime + index * 0.045;
    oscillator.start(start);
    oscillator.stop(start + 0.075);
  });
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  return true;
}

function playSfxCue(cue, volume = 0.05) {
  if (typeof window === 'undefined') return false;
  const now = performance.now();
  const plan = resolveHmhSfxCuePlan(cue, {
    requestedVolume: volume,
    now,
    lastPlayedAt: combatAudio.lastSfxAt.get(cue) ?? -Infinity,
    sfxEnabled: combatAudio.sfxEnabled,
    reduceMotion: gameSettings.reduceMotion,
  });
  if (!plan.allowed) return false;
  combatAudio.lastSfxAt.set(cue, now);
  const ctx = ensureAudioContext();
  if (!ctx) return false;
  // Kick off lazy sample loading on first real user-gesture-driven cue.
  preloadSfxSamples();
  // Prefer the real CC0 sample; fall back to the synth tone until it decodes
  // (or permanently, if the sample failed to load).
  const voice = allocateSfxVoice(plan, now);
  if (!voice) return false;
  const busLevel = plan.family === 'ui' ? hmhPlayerSettings.audio.uiVolume : hmhPlayerSettings.audio.sfxVolume;
  const dynamicGain = hmhPlayerSettings.audio.dynamicRange === 'night' ? 0.75 : hmhPlayerSettings.audio.dynamicRange === 'wide' ? 1.08 : 1;
  const mixedVolume = Math.max(0, Math.min(1, plan.volume * busLevel * dynamicGain));
  if (mixedVolume <= 0) { releaseSfxVoice(voice); return false; }
  if (plan.samplePreferred && playSfxSample(cue, mixedVolume, voice)) return true;
  loadSfxSample(cue);
  const played = playSfxSynth(cue, mixedVolume, plan.synth, voice);
  if (!played) releaseSfxVoice(voice);
  return played;
}

function weaponFireCueFor(weaponId) {
  return ({
    'coin-blaster': 'settler-fire',
    'auto-miner': 'auto-miner-fire',
    'hash-rail': 'hash-rail-fire',
    'spread-ltc': 'spread-ltc-fire',
  })[weaponId] ?? 'weapon-fire';
}

const combatArt = {
  production: buildProductionArtPass(),
  characters: {
    lester: null,
    lesterPixelLabCalibration: null,
    lilly: null,
  },
  hero: null,
  enemies: {},
  screens: {},
  icons: {
    health: loadImageAsset('./assets/generated/sliced/icon-weapon-health.png'),
    shield: loadImageAsset('./assets/generated/sliced/icon-weapon-shield.png'),
    ammo: loadImageAsset('./assets/generated/sliced/icon-weapon-ammo.png'),
    oneUp: loadImageAsset('./assets/generated/sliced/icon-weapon-one-up.png'),
    weapon: loadImageAsset('./assets/generated/sliced/icon-weapon-settler.png'),
    score: loadImageAsset('./assets/generated/sliced/icon-weapon-score-multiplier.png'),
  },
  parallax: {},
  environmentStages: {},
};

function refreshHmhCombatArtPayload() {
  combatArt.production = buildProductionArtPass();
}

const dom = {
  officialApp: document.querySelector('#officialApp'),
  arcadeMusicPlayer: document.querySelector('#arcadeMusicPlayer'),
  arcadeMusicAudio: document.querySelector('#arcadeMusicAudio'),
  arcadeMusicTitle: document.querySelector('#arcadeMusicTitle'),
  arcadeMusicTime: document.querySelector('#arcadeMusicTime'),
  arcadeMusicDuration: document.querySelector('#arcadeMusicDuration'),
  arcadeMusicProgressFill: document.querySelector('#arcadeMusicProgressFill'),
  arcadeMusicSeek: document.querySelector('#arcadeMusicSeek'),
  arcadeMusicVolume: document.querySelector('#arcadeMusicVolume'),
  arcadeMusicVolumeValue: document.querySelector('#arcadeMusicVolumeValue'),
  arcadeMusicPreviousButton: document.querySelector('#arcadeMusicPreviousButton'),
  arcadeMusicPlayButton: document.querySelector('#arcadeMusicPlayButton'),
  arcadeMusicMuteButton: document.querySelector('#arcadeMusicMuteButton'),
  arcadeMusicNextButton: document.querySelector('#arcadeMusicNextButton'),
  arcadeMusicShuffleButton: document.querySelector('#arcadeMusicShuffleButton'),
  arcadeMusicExpandButton: document.querySelector('#arcadeMusicExpandButton'),
  arcadeMusicQueueList: document.querySelector('#arcadeMusicQueueList'),
  officialNavTabs: document.querySelector('#officialNavTabs'),
  simulatedWalletBanner: document.querySelector('#simulatedWalletBanner'),

  officialWalletSplash: document.querySelector('#officialWalletSplash'),
  splashFeaturedCabinet: document.querySelector('#splashFeaturedCabinet'),
  officialConnectButton: document.querySelector('#officialConnectButton'),
  officialHmhFreeQuickplayButton: document.querySelector('#officialHmhFreeQuickplayButton'),
  officialGuestEnterButton: document.querySelector('#officialGuestEnterButton'),
  officialGuestQuickplayStatus: document.querySelector('#officialGuestQuickplayStatus'),
  officialWalletCopy: document.querySelector('#officialWalletCopy'),
  officialArcadeFloor: document.querySelector('#officialArcadeFloor'),
  officialProfileEyebrow: document.querySelector('#officialProfileEyebrow'),
  officialProfileTitle: document.querySelector('#officialProfileTitle'),
  officialProfileCopy: document.querySelector('#officialProfileCopy'),
  officialCabinetGrid: document.querySelector('#officialCabinetGrid'),
  officialModeSelect: document.querySelector('#officialModeSelect'),
  officialModeEyebrow: document.querySelector('#officialModeEyebrow'),
  officialModeTitle: document.querySelector('#officialModeTitle'),
  officialModeCopy: document.querySelector('#officialModeCopy'),
  officialModeArtNote: document.querySelector('#officialModeArtNote'),
  officialFreeModeButton: document.querySelector('#officialFreeModeButton'),
  officialFreeModeBanner: document.querySelector('#officialFreeModeBanner'),
  officialFreeModeTitle: document.querySelector('#officialFreeModeTitle'),
  officialFreeModeCopy: document.querySelector('#officialFreeModeCopy'),
  officialRankedModeButton: document.querySelector('#officialRankedModeButton'),
  officialRankedModeBanner: document.querySelector('#officialRankedModeBanner'),
  officialRankedModeTitle: document.querySelector('#officialRankedModeTitle'),
  officialRankedModeCopy: document.querySelector('#officialRankedModeCopy'),
  officialModeBackButton: document.querySelector('#officialModeBackButton'),
  rankedEntryModal: document.querySelector('#rankedEntryModal'),
  rankedEntryFee: document.querySelector('#rankedEntryFee'),
  rankedEntryReserve: document.querySelector('#rankedEntryReserve'),
  rankedEntryTotal: document.querySelector('#rankedEntryTotal'),
  rankedEntryWallet: document.querySelector('#rankedEntryWallet'),
  rankedEntryNetwork: document.querySelector('#rankedEntryNetwork'),
  rankedEntryBalance: document.querySelector('#rankedEntryBalance'),
  rankedEntryChainGuard: document.querySelector('#rankedEntryChainGuard'),
  rankedEntryStatus: document.querySelector('#rankedEntryStatus'),
  rankedEntryApprove: document.querySelector('#rankedEntryApprove'),
  rankedEntryCancel: document.querySelector('#rankedEntryCancel'),
  officialRankedTooltip: document.querySelector('#officialRankedTooltip'),
  officialCharacterSelect: document.querySelector('#officialCharacterSelect'),
  officialCharacterRoster: document.querySelector('#officialCharacterRoster'),
  officialCharacterBackButton: document.querySelector('#officialCharacterBackButton'),
  officialLevelIntro: document.querySelector('#officialLevelIntro'),
  officialBeginLevelButton: document.querySelector('#officialBeginLevelButton'),
  officialLevelBackButton: document.querySelector('#officialLevelBackButton'),
  officialGameplay: document.querySelector('#officialGameplay'),
  officialGameModeTitle: document.querySelector('#officialGameModeTitle'),
  officialGameStateCopy: document.querySelector('#officialGameStateCopy'),
  officialGameplayControls: document.querySelector('#officialGameplayControls'),
  combatPauseButton: document.querySelector('#combatPauseButton'),
  combatMenuIconButton: document.querySelector('#combatMenuIconButton'),
  combatRestartButton: document.querySelector('#combatRestartButton'),
  combatMusicButton: document.querySelector('#combatMusicButton'),
  combatShakeButton: document.querySelector('#combatShakeButton'),
  combatGoreButton: document.querySelector('#combatGoreButton'),
  combatCharacterButton: document.querySelector('#combatCharacterButton'),
  combatViewportButton: document.querySelector('#combatViewportButton'),
  combatReturnMenuButton: document.querySelector('#combatReturnMenuButton'),
  combatExitButton: document.querySelector('#combatExitButton'),
  combatMenuPanel: document.querySelector('#combatMenuPanel'),
  combatMenuTitle: document.querySelector('#combatMenuTitle'),
  combatMenuCopy: document.querySelector('#combatMenuCopy'),
  combatMenuActionGrid: document.querySelector('#combatMenuActionGrid'),
  combatSettingsPanel: document.querySelector('#combatSettingsPanel'),
  combatGameOverSummary: document.querySelector('#combatGameOverSummary'),
  combatHudOverlay: document.querySelector('#combatHudOverlay'),
  roguelikeStatBar: document.querySelector('#roguelikeStatBar'),
  tacticalBalanceDebugOverlay: document.querySelector('#tacticalBalanceDebugOverlay'),
  officialCombatMount: document.querySelector('#officialCombatMount'),
  runStatus: document.querySelector('#runStatus'),
  runDetails: document.querySelector('#runDetails'),
  leaderboardPanel: document.querySelector('#leaderboardPanel'),
  combatCanvas: document.querySelector('#combatCanvas'),
  combatRunStatus: document.querySelector('#combatRunStatus'),
  combatStatus: document.querySelector('#officialGameStateCopy'),
};

const state = createInitialArcadeState();
// P0 persistence (analysis roadmap): restore profiles, usernames, leaderboards,
// and ranked run history from localStorage before seeding, so a returning
// player keeps their identity and scores across reloads. Seeds only apply on a
// genuinely fresh state (the restored snapshot carries the seeded flag).
const ARCADE_STORAGE = (() => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
})();
loadArcadeState(state, ARCADE_STORAGE);
// Clean slate (D4): nothing seeds the boards any more. House Demo rows an older
// build stored in this browser are dropped on load, so they never rank, fill a
// period bucket or show as a player.
purgeHouseSeedRows(state);
// Debounced save so bursts of mutations (run submit -> achievements -> rename)
// produce one write. Also flushed on pagehide/visibilitychange for mobile.
let persistTimer = 0;
function persistArcadeStateSoon() {
  if (!ARCADE_STORAGE) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const result = saveArcadeState(state, ARCADE_STORAGE);
    if (!result.ok) console.warn('[persist] arcade state save failed:', result.reason);
    else if (result.dropped.length) console.warn('[persist] saved without:', result.dropped.join(', '));
    pushProfileToCloudSoon();
  }, 250);
}
try {
  window.addEventListener('pagehide', () => { clearTimeout(persistTimer); saveArcadeState(state, ARCADE_STORAGE); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(persistTimer); saveArcadeState(state, ARCADE_STORAGE); }
  });
} catch { /* non-DOM env */ }
mountCabinetMotionControl({
  button: document.querySelector('#cabinetMotionToggle'),
  grid: dom.officialCabinetGrid,
  motionPreference: window.matchMedia('(prefers-reduced-motion: reduce)'),
});
let selectedGameId = 'lester-blaster';
let connectedWallet = null;
let connectedChainId = null;
let walletConnector = 'none';
let walletAuthenticated = false; // true once a SIWE signature is verified this session
let walletAuthChallenge = null;  // the SIWE challenge we last issued
// The EIP-1193 provider the player picked (EIP-6963, legacy injected or
// WalletConnect); detectEthereumProvider() returns it first (contract §7.6).
let connectedProvider = null;
// The account exactly as the wallet presented it (usually checksummed): the
// SIWE message carries it verbatim and the server rebuilds from that line.
let connectedAddress = null;
// A remembered WalletConnect session restored at boot without creating
// AppKit (guide rule 3); its provider is created on the first action that
// needs the wallet.
let walletProviderPending = false;
let walletPickKind = null; // 'eip6963' | 'legacy' | 'walletconnect'
let walletPickRdns = null; // the picked EIP-6963 wallet's rdns, kept with the remembered connector

// Hosted profile sync + relayed settlement (owner decisions 2026-09-16): the
// wallet is the account and its profile follows it across devices. Every
// call is best-effort; until the Vercel secrets exist the services answer
// 503 and the portal keeps working from local storage exactly as before.
// The server index owns every stat (guide §5.7): the browser syncs only
// preferences, and a pull brings back the on-chain name and the saved hero,
// never xp, run counts, achievements or runs. The v2 Bearer token is minted by
// the wallet session of contract §7.6 (server nonce, then profileSync.login)
// and stored by profileSync. Every Bearer caller (profile PUT and pull,
// profile refresh, settle, seed tickets, the name-claim flow) reads it only
// through the wallet session (walletSessionToken), and a 401 from any of them
// drops it through the wallet session too (invalidateWalletSession, with the
// wallet and the refused token).
const profileSync = createProfileSync({
  storage: ARCADE_STORAGE,
  getToken: (wallet) => walletSessionToken(wallet),
  onUnauthorized: (wallet, refusedToken) => invalidateWalletSession(wallet, refusedToken),
});
let profileSyncPulledFor = null;
let profileSyncLastPushed = null;
// Index reads and profile writes (§7.8). While HOSTED_PROFILE_SYNC is false
// every call answers offline-preview without a request (A22).
const indexApi = createIndexApiClient({
  hosted: HOSTED_PROFILE_SYNC,
  fetchImpl: (...args) => globalThis.fetch(...args),
  getToken: () => walletSessionToken(connectedWallet),
  onUnauthorized: (wallet, refusedToken) => invalidateWalletSession(wallet, refusedToken),
});
function currentProfileDocument() {
  if (!connectedWallet || walletConnector !== 'injected-evm') return null;
  const profile = state.profiles?.[connectedWallet];
  return profile ? buildProfileDocument(profile) : null;
}
function pushProfileToCloudSoon() {
  if (!HOSTED_PROFILE_SYNC || !walletSessionAuthenticated(connectedWallet)) return;
  const document = currentProfileDocument();
  if (!document) return;
  const json = JSON.stringify(document);
  if (json === profileSyncLastPushed) return;
  profileSyncLastPushed = json;
  profileSync.push(document, { wallet: connectedWallet });
}
async function pullProfileFromCloud(wallet) {
  if (!HOSTED_PROFILE_SYNC || !wallet || walletConnector !== 'injected-evm' || profileSyncPulledFor === wallet) return;
  profileSyncPulledFor = wallet;
  const pulled = await profileSync.pull(wallet);
  if (!pulled.ok) return;
  const profile = state.profiles?.[wallet];
  if (!profile) return;
  const merged = mergeRemoteProfile(profile, pulled);
  debugRuntimeLog('[Profile] Hosted profile merged:', { changed: merged.changed, self: pulled.self });
  if (merged.changed) {
    persistArcadeStateSoon();
    render();
  }
}

// SDK adapter: bridges the in-process HMH runtime to the arcade.* event schema.
// Created per game session; emits real events from actual gameplay.
let gameAdapter = null;
// EIP-6963 multi-wallet discovery: collect every wallet that announces itself
// (MetaMask, Rabby, ...) so we can pick one deterministically instead of
// fighting over the single legacy window.ethereum slot.
const eip6963Registry = createProviderRegistry();
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('eip6963:announceProvider', (event) => {
    try { eip6963Registry.add(event?.detail); } catch { /* ignore malformed announce */ }
  });
  // Ask any already-loaded wallets to (re)announce.
  try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch { /* older browsers */ }
}
// Resolves the first announced wallet matching `rdns` (any wallet when null),
// waiting at most `ms` for late EIP-6963 announcements.
function waitForAnnouncedWallet(rdns, ms = 500) {
  const find = () => eip6963Registry.list().find((detail) => (rdns ? detail.rdns === rdns : true)) ?? null;
  const found = find();
  if (found || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return Promise.resolve(found);
  return new Promise((resolve) => {
    const done = (value) => { clearTimeout(timer); window.removeEventListener('eip6963:announceProvider', onAnnounce); resolve(value); };
    const onAnnounce = () => { const next = find(); if (next) done(next); };
    const timer = setTimeout(() => done(find()), ms);
    window.addEventListener('eip6963:announceProvider', onAnnounce);
  });
}
// Wallet sign-in session (contract §7.6): SIWE with the server nonce when
// hosted, the local challenge in preview, silent restore and the remembered
// connector. It announces lesters:wallet-session on every change. Loaded with
// import() (brief acceptance 1): at boot only when a connector is remembered,
// otherwise on the first sign-in. `walletSession` is null until then.
let walletSession = null;
let walletSessionLoading = null;
function loadWalletSession() {
  if (walletSession) return Promise.resolve(walletSession);
  walletSessionLoading ??= import('./src/wallet-session.mjs').then(({ createWalletSession }) => {
    walletSession ??= createWalletSession({
      hosted: HOSTED_PROFILE_SYNC,
      storage: ARCADE_STORAGE,
      profileSync,
      loadEthers,
      domain: (typeof location !== 'undefined' && location.hostname) ? location.hostname : 'lestersarcade.io',
      chainId: LITVM_LITEFORGE_NETWORK.chainId,
    });
    return walletSession;
  }).catch((error) => { walletSessionLoading = null; throw error; });
  return walletSessionLoading;
}
// The Bearer token of `wallet` and whether it is signed in, both only through
// the wallet session (contract §7.6: walletSession.token / isAuthenticated,
// backed by profileSync.tokenFor). Before the session module has loaded
// nothing is signed in, so both answer no.
function walletSessionToken(wallet) {
  if (!walletSession || !wallet) return null;
  try { return walletSession.token(wallet); } catch { return null; }
}
function walletSessionAuthenticated(wallet) {
  if (!walletSession || !wallet) return false;
  try { return walletSession.isAuthenticated(wallet); } catch { return false; }
}
// A 401 from any Bearer call: the token is dead (v2 tokens are audience-bound
// and die at a secret rotation). The wallet session drops it and announces
// lesters:wallet-session, so the profile, boards and Ranked all sign out
// together; the wallet stays connected for Free play. A 401 for a token the
// session no longer holds (a request still in flight from before a wallet
// switch or a fresh sign-in) changes nothing: that token is already gone,
// and the one that replaced it is live.
function invalidateWalletSession(wallet = null, refusedToken = null) {
  if (refusedToken && walletSessionToken(wallet ?? connectedWallet) !== refusedToken) return;
  walletAuthenticated = false;
  if (walletSession) {
    try { walletSession.invalidate(); } catch { /* announce failures never block sign-out */ }
  } else {
    profileSync.logout();
  }
}
// The remembered connector's storage key (wallet-session.mjs
// WALLET_CONNECTOR_STORAGE_KEY, pinned equal by a test): boot peeks at it so a
// first-time visitor never loads the session module.
const WALLET_CONNECTOR_STORAGE_KEY = 'lesters-arcade-wallet-connector-v1';
function hasRememberedWalletConnector() {
  try { return Boolean(ARCADE_STORAGE?.getItem?.(WALLET_CONNECTOR_STORAGE_KEY)); } catch { return false; }
}
let currentSession = null;
const bootRuntimeSearch = window.location.search;
let hmhRebootHost = null;
let hmhRebootLifecycle = null;
let hmhRebootActive = false;
// The canonical summary the lifecycle finalized for the run on screen. Cleared
// on restart and teardown so a Free recap can never surface on a Ranked screen.
let lastHmhRunSummary = null;
let chikunHost = null;
let chikunRunMusic = null;
let stackedHost = null;
let stackedMountGeneration = 0;
function destroyStackedSession() { stackedMountGeneration++; stackedHost?.destroy(); stackedHost = null; syncCabinetResultsButton(); }
async function mountStackedSession() {
  if (!currentSession || currentSession.gameId !== 'stacked') return;
  destroyHmhRebootSession(); destroyChikunSession(); destroyStackedSession();
  const generation = stackedMountGeneration, boundSession = currentSession;
  const { createStackedHost } = await import('./src/stacked-host.mjs');
  if (generation !== stackedMountGeneration || currentSession !== boundSession) return;
  const profile = connectedWallet ? state.profiles?.[connectedWallet] : null;
  const startLevel = boundSession.leaderboardEligible ? 1 : Number(document.querySelector('#stackedStartLevel')?.value ?? 1);
  stackedHost = createStackedHost({
    mount: dom.officialCombatMount, session: boundSession, startLevel, settlementLive: SETTLEMENT_LIVE,
    profile: { displayName: profile ? resolveDisplayName(profile, connectedWallet) : 'Guest', locale: document.documentElement.lang || 'en' },
    settings: { ...readStackedSettings(window.localStorage, Boolean(gameSettings.reduceMotion)), ...childCosmetics('stacked') }, music: arcadeMusicAudio(),
    onReady() { combat.active = true; combat.gameOver = false; combat.paused = false; },
    onState(value) { combat.paused = value.paused; combat.active = ['running', 'paused', 'ready'].includes(value.status); combat.gameOver = value.status === 'terminal'; combat.score = value.score; },
    onResult(result) {
      combat.active = false; combat.gameOver = true;
      if (!dom.officialGameStateCopy) return;
      // A live Ranked run's line follows its settlement handle (trackRankedSettlement).
      if (!result.ok) dom.officialGameStateCopy.textContent = 'STACKED run not saved: ' + result.reason;
      else if (!result.ranked) dom.officialGameStateCopy.textContent = 'STACKED replay verified locally. Free Mode did not write to your profile or score boards.';
      else if (!SETTLEMENT_LIVE) dom.officialGameStateCopy.textContent = 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.';
    },
    // Local archive (persistStackedScore), then for a live run the replay
    // store copy and the settle request, then the results hand-off (§7.7).
    async persistRanked(canonical, evidence, metadata) {
      const { persistStackedRankedRun } = await import('./src/stacked-persistence.mjs');
      if (generation !== stackedMountGeneration || currentSession !== boundSession) throw new Error('cabinet-closed');
      return persistStackedRankedRun({
        state, storage: ARCADE_STORAGE, session: boundSession, evidence, canonical, metadata, live: SETTLEMENT_LIVE,
        settle: () => settleStackedRankedRun(boundSession, canonical, evidence),
      });
    },
    // A16: a finished Ranked run restarts through a fresh paid entry (the
    // Ranked modal; the finished cabinet stays until a new session mounts).
    // Free restarts as before.
    onRestart() { const ranked = boundSession.leaderboardEligible; if (ranked) { void startOfficialMode('ranked'); return; } destroyStackedSession(); void startOfficialMode('free'); },
    onExit: exitToArcade,
    onError(error) { console.error('[STACKED]', error); if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = error.message; },
  });
  void startArcadeMusicForGame('stacked');
}
let chikunLifecycle = null;
let chikunActive = false;
let lastCompletedSession = null;
let lastRunResult = null;
let lastRunScore = 0;
let lastRunElapsedSeconds = 0;
let lastBossId = null;
let officialAppStep = 'wallet-splash';
let officialSelectedMode = null;
// Last Ranked settlement outcome of the run on screen. The results screen
// (lesters:ranked-run) shows the explorer link, so lastSettlementTxUrl stays
// unset here; startCombat still clears it.
let lastSettlementTxUrl = null;
let lastSettlementError = null;
// Retained ranked-run settlement input + stats of the run on screen.
let lastSettlementInput = null;
let lastRunStatsForSettlement = null;
let lastRunPreviousBestScore = 0;
let sessionRunStreak = 0;
let lastSettlementQueued = false;
// True only after the relayer's transaction confirmed on LitVM. Drives the
// game-over "Score Synced" vs "Submit Official Score" state.
let lastSettlementSucceeded = false;
// The settlement handle (contract §7.2) of the latest Ranked run; the
// lastSettlement* flags above follow its state.
let lastSettlementHandle = null;
let lastSettlementUnsubscribe = null;
// §7.2 result context per Ranked session, captured when the run starts.
const rankedResultContexts = new Map();
// Sessions already handed to settlement: one lesters:ranked-run per run (§7.7).
const rankedRunsHandedOff = new WeakSet();
// One lazy settlement client for all three games (ranked-settlement.mjs).
let rankedSettlementClientPromise = null;
function rankedSettlementClient() {
  rankedSettlementClientPromise ??= import('./src/ranked-settlement.mjs').then((module) => ({
    module,
    client: module.createRankedSettlementClient({
      live: SETTLEMENT_LIVE,
      getToken: (wallet) => walletSessionToken(wallet),
      storage: ARCADE_STORAGE,
      onPendingCount: (count) => window.dispatchEvent(new CustomEvent('lesters:ranked-pending', { detail: { count } })),
      onPublished: applyRankedPublication,
      onUnauthorized: (wallet, refusedToken) => invalidateWalletSession(wallet, refusedToken),
    }),
  })).catch((error) => {
    rankedSettlementClientPromise = null;
    throw error;
  });
  return rankedSettlementClientPromise;
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  // §7.7: profile-boards' Retry buttons. Stored bodies exist only when live.
  window.addEventListener('lesters:ranked-retry-request', (event) => {
    if (!SETTLEMENT_LIVE) return;
    void rankedSettlementClient().then(({ client }) => client.handleRetryRequest(event?.detail ?? null)).catch((error) => console.error('[Ranked settlement]', error));
  });
  // Resume stored bodies once per page load, on the first authenticated
  // session; a later sign-in re-drives the runs that stopped for want of one.
  let rankedResumeRequested = false;
  window.addEventListener('lesters:wallet-session', (event) => {
    if (!SETTLEMENT_LIVE || event?.detail?.authenticated !== true) return;
    const first = !rankedResumeRequested;
    rankedResumeRequested = true;
    void rankedSettlementClient().then(({ client }) => (first ? client.resume() : client.retrySignedOut())).catch((error) => console.error('[Ranked settlement]', error));
  });
  // lesters:ranked-pending once after boot: the live client reports its stored
  // count when it loads; preview never stores a body, so its count is 0.
  if (SETTLEMENT_LIVE) void rankedSettlementClient().catch((error) => console.error('[Ranked settlement]', error));
  else setTimeout(() => window.dispatchEvent(new CustomEvent('lesters:ranked-pending', { detail: { count: 0 } })), 0);
}


// Playable hero display names. The in-game roguelike heroes were renamed from
// the old mascot working titles (lester/lilly) to their combat identities. The
// internal ids stay stable so saved data / canon keep working.
const CHARACTER_DISPLAY_NAMES = Object.freeze({
  'lit-commando': 'Lit Commando',
  'lit-valkyrie': 'Lit Valkyrie',
  'lester-original': 'Lester',
  lester: 'Lester',
  lilly: 'Lilly',
});

const combat = {
  active: false,
  paused: false,
  menuSettingsOpen: false,
  gameOver: false,
  gameOverReason: '',
  // Death-recap fields: lastHitBy tracks every hit, killedBy freezes at death.
  lastHitBy: null,
  killedBy: null,
  startedAt: 0,
  frame: 0,
  elapsedGameSeconds: 0,
  playerX: PLAYER_X,
  playerY: GROUND_Y,
  playerMapX: 0,
  playerMapY: 0,
  explorationVisitedCells: [],
  explorationLayerFrame: -1,
  explorationLayerCache: null,
  aimMapX: 1,
  aimMapY: 0,
  manualAim: { x: 1, y: 0, active: false, source: 'initial' },
  grenadeTarget: null,
  grenadeAim: null,
  grenadeTargetKind: 'grenade-reticle',
  velocityY: 0,
  velocityX: 0,
  jumpsLeft: 2,
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  reviveCharges: 0,
  dashCooldownRemaining: 0,
  dashFrames: 0,
  scoreBonus: 0,
  lives: 1,
  score: 0,
  kills: 0,
  combo: 0,
  maxCombo: 0,
  damageCombo: 0,
  _heroMoving: false,
  lastShotFrame: -999,
  maxDamageCombo: 0,
  noDamageSeconds: 0,
  invulnerableFrames: 0,
  crouching: false,
  crouchFrames: 0,
  bullets: [],
  enemyShots: [],
  enemies: [],
  particles: [],
  vfxParticles: [],
  floatingTexts: [],
  feedbackEvents: [],
  playerDamageFlash: 0,
  powerUps: [],
  // Active timed power-up effects (seconds remaining). 0 = inactive.
  powerUpTimers: { magnet: 0, slowEnemies: 0, berserk: 0, weapon: 0 },
  // Per-weapon upgrade tree choices: { weaponId: { rateOfFire: tier, damage: tier, reloadSpeed: tier } }.
  weaponUpgrades: {},
  xpGems: [],
  killsByType: {},
  bossKills: 0,
  longestSurvivalThisRun: 0,
  levelUpChoices: [],
  levelUpLockedPreviews: [],
  levelUpPaused: false,
  roguelikeRun: null,
  roguelikeSpawnTimer: 0,
  props: [],
  hazards: [],
  platforms: [],
  powerUpsCollected: 0,
  collectedPowerUpTypes: new Set(),
  grenades: 3,
  ammo: Infinity,
  weaponId: 'coin-blaster',
  characterId: 'lester',
  currentCampaignLevelId: DEFAULT_CAMPAIGN_LEVEL_ID,
  scriptedBossTriggered: false,
  extractionPoint: null,
  clearedCampaignLevelId: null,
  levelClearSource: null,
  nextCampaignLevelId: null,
  levelClearTitle: '',
  lastFacing: 'south', // Track last movement direction for smooth animation blending
  lastInteractFrame: -999,
  lastGrenadeFrame: -999,
  interactionPrompt: null,
  shots: 0,
  fireFlash: 0,
  meleeSwings: 0,
  lastMeleeFrame: -999,
  boss: null,
  bossDefeated: false,
  bossDeathSpectacle: null,
  miniBossLock: false,
  triggeredBossBeatIds: new Set(),
  activePoiEncounterId: null,
  activePoiEncounterTitle: '',
  scrollLockReason: null,
  scroll: 0,
  furthestScroll: 0,
  scrollSpeed: 0,
  stageIndex: 1,
  stageCount: STAGE_COUNT,
  stagePhase: 'travel',
  stageTravel: 0,
  stageTravelGoal: LESTER_BLASTER_TACTICAL_CAMERA_MODEL.stageTravelGoalBasePixels + LESTER_BLASTER_TACTICAL_CAMERA_MODEL.stageTravelGoalPerStagePixels,
  waveIndex: 0,
  wavesThisStage: 1,
  waveSpawnQueue: 0,
  waveEnemiesSpawned: 0,
  nextWaveSpawnFrame: 0,
  stagedEnemiesDefeated: 0,
  musicEnabled: hmhPlayerSettings.audio.musicEnabled !== false,
  viewportMode: DEFAULT_VIEWPORT_MODE,
  keys: new Set(),
  lastTimestamp: 0,
  accumulatorMs: 0,
  frameTimes: [],
  updateTimes: [],
  renderTimes: [],
  fixedStepStats: createFixedStepStats(),
  fps: 60,
  adaptivePerformance: createAdaptivePerformanceState(),
  enemyRenderStats: { visibleEnemies: 0, animatedEnemies: 0, maxAnimatedEnemies: 0 },
  groundRenderStats: { passMs: 0, groupCount: 0, cacheSize: 0, cacheHits: 0, cacheMisses: 0 },
  status: 'Attract mode: choose free or paid, then start the 60fps combat test.',
  gameOverSubmitted: false,
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

const ARCADE_ICON_SPRITE = './assets/icons/arcade-ui.svg';
const ARCADE_ICON_ALIASES = Object.freeze({
  '▶': 'play', '↻': 'restart', '⚙': 'settings', '★': 'star', '♪': 'volume', '⊘': 'mute',
  '▣': 'fullscreen', '☰': 'menu', '⏏': 'exit', '⚡': 'star', '🔒': 'lock',
});

function renderArcadeIcon(iconId, label = '') {
  const semanticId = ARCADE_ICON_ALIASES[iconId] ?? iconId ?? 'star';
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('class', 'arcade-svg-icon arcade-icon');
  node.setAttribute('aria-hidden', 'true');
  node.setAttribute('focusable', 'false');
  if (label) node.dataset.iconLabel = label;
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `${ARCADE_ICON_SPRITE}#${semanticId}`);
  node.append(use);
  return node;
}

function setButtonIcon(button, iconId) {
  if (!button) return;
  const semanticId = ARCADE_ICON_ALIASES[iconId] ?? iconId ?? 'star';
  const current = button.firstElementChild;
  // Audio time updates must retain unchanged SVGs: replacing an external <use>
  // repeatedly can refetch its sprite and churn the DOM during every game.
  if (button.childNodes.length === 1 && current?.matches('svg.arcade-svg-icon')
    && current.querySelector('use')?.getAttribute('href') === `${ARCADE_ICON_SPRITE}#${semanticId}`) return;
  button.replaceChildren(renderArcadeIcon(iconId));
}

function renderAchievementIcon({ iconSrc = null, icon = '🏅', label = 'Achievement badge' } = {}) {
  if (iconSrc) {
    return el('img', {
      className: 'achievement-icon achievement-icon-image',
      src: iconSrc,
      alt: label,
    });
  }
  return el('span', { className: 'achievement-icon', textContent: icon, ariaLabel: label || icon, role: 'img' });
}

function renderRotatingCabinetSprite(sprite, variant = 'splash') {
  const rotator = el('div', {
    className: `hmh-cabinet-rotator ${variant === 'card' ? 'cabinet-card-rotator' : 'splash-cabinet-rotator'} ${sprite?.className ?? ''}`.trim(),
    ariaLabel: `${sprite?.id ?? 'Hard Money Heroes cabinet'} rotating sprite`,
    role: 'img',
  });
  const frames = sprite?.frames ?? [];
  const frameDuration = Math.max(240, Number(sprite?.frameDurationMs ?? frames[0]?.durationMs ?? 720));
  rotator.style.setProperty('--cabinet-frame-count', String(Math.max(1, frames.length)));
  rotator.style.setProperty('--cabinet-loop-duration', `${frameDuration * Math.max(1, frames.length)}ms`);
  if (Number.isFinite(sprite?.displayScale)) rotator.style.setProperty('--hero-rotation-scale', String(sprite.displayScale));
  if (Number.isFinite(sprite?.displayScaleX)) rotator.style.setProperty('--hero-rotation-scale-x', String(sprite.displayScaleX));
  if (Number.isFinite(sprite?.displayScaleY)) rotator.style.setProperty('--hero-rotation-scale-y', String(sprite.displayScaleY));
  frames.forEach((frame, index) => {
    const region = parseAtlasFrameRef(frame.src);
    let image;
    if (region) {
      image = el('canvas', { className: 'cabinet-rotation-frame', ariaHidden: 'true' });
      image.width = region.width;
      image.height = region.height;
      image.dataset.ready = 'false';
      const atlas = loadImageAsset(region.src);
      const drawRegion = () => {
        image.getContext('2d')?.drawImage(
          atlas,
          region.x, region.y, region.width, region.height,
          0, 0, region.width, region.height,
        );
        image.dataset.ready = 'true';
      };
      if (imageReady(atlas)) drawRegion();
      else atlas.addEventListener('load', drawRegion, { once: true });
    } else {
      image = el('img', {
        className: 'cabinet-rotation-frame',
        src: frame.src,
        alt: '',
      });
      image.loading = 'eager';
      image.decoding = 'async';
    }
    const framing = cabinetFramePresentation(sprite?.id, index);
    if (framing) {
      rotator.classList.add('normalized-cabinet');
      for (const [property, value] of Object.entries(framing)) image.style.setProperty('--cabinet-' + property, value + '%');
    }
    image.style.setProperty('--cabinet-frame-index', String(index));
    image.style.setProperty('--cabinet-frame-delay', `${frameDuration * index}ms`);
    // The frame shown when the viewer prefers reduced motion (CSS stills the
    // spin and reveals only this one).
    if (frame.rest) image.dataset.restFrame = 'true';
    rotator.append(image);
  });
  return rotator;
}

// --- Character-select roster -------------------------------------------------
// Lester is the playable hero; Lilly is a playable hero teaser.
// Build a 360° rotating sprite from the same hero art used during gameplay
// (hmh('HMH_ANIMATED_ROSTER')), so the character select screen matches in-game appearance.
// Order directions clockwise (E → NE → N → NW → W → SW → S → SE) for a natural spin.
const SPIN_DIRECTION_ORDER = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
// Cycle 074: the selector frames are rendered at 384 px from the hero scene
// (hero ~260-294 px tall). Scaling the 180 px card box by 1.4 keeps the on-card
// hero height Cycle 073 shipped (~185 px) while every device pixel up to 2 DPR
// is a downsample of the source instead of a 1.44x upscale of a 160 px frame.
const HERO_SELECTOR_DISPLAY_SCALE = 1;
const HERO_ROTATION_DISPLAY_SCALE = Object.freeze({
  // Per-axis card-only normalization. Lester/Lilly have wider original bounds
  // than Commando/Valkyrie, so uniform scaling made them too wide when height
  // matched. Keep gameplay pixels untouched and fit the picker silhouettes to the
  // same visual card box instead.
  'lit-commando': Object.freeze({ x: 1.1, y: 1.1 }),
  'lit-valkyrie': Object.freeze({ x: 1.1, y: 1.1 }),
  lester: Object.freeze({ x: 0.84, y: 0.96 }),
  'lester-original': Object.freeze({ x: 0.84, y: 0.96 }),
  lilly: Object.freeze({ x: 0.86, y: 0.96 }),
});
function heroRotationSprite(characterId) {
  // USE THE SAME ROSTER KEY AS GAMEPLAY so the character-select spinning sprite
  // matches exactly what the player controls in-game. Gameplay locks the hero
  // art to `HERO_LOCKED_ROSTER[characterId]` via `heroRosterKey()` — using any
  // other key causes the select card to display a DIFFERENT character design than
  // what spawns. Do not fall Lit Valkyrie through to Lilly or any hero through to
  // QA/generated placeholders.
  const rosterKey = HERO_LOCKED_ROSTER[characterId] ?? characterId;
  const production = HMH_REBOOT_HERO_SELECTOR_ATLAS.heroes[characterId]
    ?? HMH_REBOOT_HERO_SELECTOR_ATLAS.heroes[rosterKey];
  if (production) {
    const restIndex = restFrameIndex(HMH_REBOOT_HERO_SELECTOR_ATLAS.directions, HMH_REBOOT_HERO_SELECTOR_ATLAS.restDirection);
    return {
      id: production.actorId,
      animation: 'production-rotation',
      frames: production.frames.map((src, index) => ({
        src,
        direction: HMH_REBOOT_HERO_SELECTOR_ATLAS.directions[index],
        rest: index === restIndex,
      })),
      frameDurationMs: production.frameDurationMs,
      className: `hero-character-rotator hmh-reboot-selector-${production.actorId}`,
      displayScale: HERO_SELECTOR_DISPLAY_SCALE,
    };
  }
  const entry = hmh('HMH_ANIMATED_ROSTER')?.[rosterKey] ?? hmh('HMH_ANIMATED_ROSTER')?.[characterId];
  const animations = entry?.animations ?? {};
  // Prefer walk (best for hero showcase), then idle, then run, then shoot.
  const ordered = ['walk', 'idle', 'run', 'shoot'].filter((a) => animations[a] && Object.keys(animations[a]).length);
  const chosenName = ordered[0] ?? Object.keys(animations)[0];
  const chosen = animations[chosenName];
  if (!chosen) return null;
  // Collect one frame per direction (first frame of each direction's animation),
  // respecting the clockwise spin order. Missing directions are tolerated —
  // the rotator will show as many distinct frames as are available and loop.
  const frames = [];
  const availableDirs = Object.keys(chosen);
  for (const dir of SPIN_DIRECTION_ORDER) {
    const dirFrames = chosen[dir];
    if (Array.isArray(dirFrames) && dirFrames.length) frames.push({ src: dirFrames[0], direction: dir });
  }
  // If the roster only harvested a single direction (e.g. lilly's manifest is
  // south-only until a full Pixellab run fills it out), still show that frame so
  // the character card is not blank. The rotator degrades gracefully to 1 frame.
  if (!frames.length && availableDirs.length) {
    const fallbackDir = availableDirs[0];
    const dirFrames = chosen[fallbackDir];
    if (Array.isArray(dirFrames) && dirFrames.length) {
      frames.push({ src: dirFrames[0], direction: fallbackDir });
    }
  }
  if (!frames.length) return null;
  const frameDurationMs = Math.max(180, Math.round(1000 / (entry?.targetFps ?? 10)));
  const scale = HERO_ROTATION_DISPLAY_SCALE[rosterKey] ?? HERO_ROTATION_DISPLAY_SCALE[characterId] ?? 1;
  const displayScale = typeof scale === 'number' ? scale : 1;
  return {
    id: characterId,
    animation: chosenName,
    frames,
    frameDurationMs,
    className: 'hero-character-rotator',
    displayScale,
    displayScaleX: typeof scale === 'object' ? scale.x : displayScale,
    displayScaleY: typeof scale === 'object' ? scale.y : displayScale,
  };
}
const HERO_ROSTER_BASE = buildCharacterStatIdentityRoster();

// Semantic sprite IDs per hero skill type, shown beside stat labels.
const HERO_STAT_ICON_IDS = Object.freeze({
  Power: 'offense',
  Speed: 'mobility',
  Armor: 'defense',
  Luck: 'economy',
  Damage: 'offense',
  Health: 'defense',
  'Fire Rate': 'weapon',
  Crit: 'control',
});

function renderHeroStatBars(container, stats, decorateRow) {
  for (const [label, value] of stats) {
    const row = el('div', { className: 'hero-stat-row' });
    const labelWrap = el('div', { className: 'hero-stat-label' });
    const iconId = HERO_STAT_ICON_IDS[label] ?? 'augment';
    const iconWrap = el('span', { className: 'hero-stat-icon', ariaHidden: 'true' });
    iconWrap.append(renderArcadeIcon(iconId, label));
    labelWrap.append(iconWrap);
    labelWrap.append(el('span', { className: 'hero-stat-name', textContent: label }));
    row.append(labelWrap);
    const track = el('div', { className: 'hero-stat-track' });
    const fill = el('div', { className: 'hero-stat-fill' });
    fill.style.width = `${(value / 5) * 100}%`;
    track.append(fill);
    row.append(track);
    container.append(row);
    decorateRow?.(row, label, value);
  }
}

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function currentCampaignLevel() {
  return getHmhCampaignLevel(combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID);
}

function currentRoguelikeSpawnDirector(elapsedSeconds = combat.elapsedGameSeconds) {
  const level = currentCampaignLevel();
  return level.id === DEFAULT_CAMPAIGN_LEVEL_ID
    ? levelOneRoguelikeSpawnDirectorAt(elapsedSeconds)
    : getRoguelikeSpawnDirectorAt(elapsedSeconds);
}

function currentLevelOnePickupAssist() {
  const level = currentCampaignLevel();
  if (level.id !== DEFAULT_CAMPAIGN_LEVEL_ID) {
    return {
      xpAttractRadiusMultiplier: 1,
      xpAttractSpeedMultiplier: 1,
      xpTtlFrames: 900,
      powerUpAttractRadiusMultiplier: 1,
      powerUpTtlFrames: 720,
      maxLooseXpGems: 220,
      maxLoosePowerUps: 52,
    };
  }
  return levelOneRoguelikePickupAssistAt({
    elapsedSeconds: combat.elapsedGameSeconds,
    activeEnemies: combat.enemies?.length ?? 0,
  });
}

function currentLevelOnePerformanceBudget() {
  const level = currentCampaignLevel();
  if (level.id !== DEFAULT_CAMPAIGN_LEVEL_ID) {
    return {
      maxParticles: 240,
      maxFloatingTexts: 96,
      hitSparkEveryNthHit: 1,
      deathBurstScale: 1,
      lodPressure: 0,
      lodStage: 'full-fidelity',
      maxAnimatedEnemies: 96,
      enemyAnimationFps: 12,
      obstacleRenderRadiusWindowed: 18,
      obstacleRenderRadiusFullscreen: 45,
      groundOverscanWindowedTiles: 6,
      groundOverscanFullscreenTiles: 20,
    };
  }
  const scheduledBudget = levelOneRoguelikePerformanceBudgetAt({
    elapsedSeconds: combat.elapsedGameSeconds,
    activeEnemies: combat.enemies?.length ?? 0,
    reduceMotion: Boolean(gameSettings.reduceMotion),
  });
  return applyAdaptivePerformanceBudget(scheduledBudget, combat.adaptivePerformance);
}

function currentCampaignPoi() {
  if ((combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) === HMH_LEVEL_ONE_ID) {
    return levelOneWorldV3PoiDirectiveAt({
      playerX: combat.playerMapX,
      playerY: combat.playerMapY,
      completedPoiIds: [...(combat.completedCampaignPoiIds ?? [])],
    });
  }
  if (!combat.roguelikeRun || !Array.isArray(combat.districtGrid) || !combat.districtGrid.length || !combat.macroCellsX) return null;
  return buildCampaignPoiDirective({
    levelId: combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID,
    districtGrid: combat.districtGrid,
    macroCellsX: combat.macroCellsX,
    macroCellsY: combat.macroCellsY,
    playerX: combat.playerMapX,
    playerY: combat.playerMapY,
    worldWidth: combat.worldWidth,
    worldHeight: combat.worldHeight,
    worldOffsetX: Math.floor((combat.worldWidth ?? 0) / 2),
    worldOffsetY: Math.floor((combat.worldHeight ?? 0) / 2),
    completedPoiIds: [...(combat.completedCampaignPoiIds ?? [])],
  });
}

function currentLevelOneRoutePacing() {
  return levelOneRouteEncounterPacingAt({
    playerX: combat.playerMapX,
    playerY: combat.playerMapY,
    completedPoiIds: [...(combat.completedCampaignPoiIds ?? [])],
    respitePoiId: (combat.routePacingRespiteFrames ?? 0) > 0 ? combat.routePacingRespitePoiId : null,
  });
}

function isL2CampaignActive() {
  return (combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) === 'level-2-litecoin-city';
}

function currentCampaignObjective() {
  return buildHmhCampaignObjectiveState({
    levelId: combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID,
    elapsedSeconds: combat.elapsedGameSeconds,
    bossTriggered: Boolean(combat.scriptedBossTriggered),
    extractionSpawned: Boolean(combat.extractionPoint),
    cleared: Boolean(combat.clearedCampaignLevelId),
    nextLevelId: combat.nextCampaignLevelId,
    activePoi: currentCampaignPoi(),
  });
}

function extractionGuidance() {
  if (!combat.extractionPoint) return null;
  return buildHmhExtractionGuidance({
    playerX: combat.playerMapX,
    playerY: combat.playerMapY,
    targetX: combat.extractionPoint.worldX,
    targetY: combat.extractionPoint.worldY,
  });
}

function selectedGame() {
  return getGame(selectedGameId);
}

// U11a. connectWallet() falls back to a local test identity whenever no
// injected provider answers, and until now that produced a UI indistinguishable
// from a real connection. Single predicate so the surfaces below cannot drift
// apart on what counts as simulated.
function isSimulatedWalletActive() {
  return Boolean(connectedWallet)
    && (connectedWallet === SIMULATED_WALLET_ADDRESS || walletConnector === 'mock-wallet');
}

// Every surface that shows a connected wallet renders this notice instead of
// leaving the user to infer the state from a connector string. role=status so a
// screen reader announces it when it appears.
function renderSimulatedWalletNotice(disclosure, extraClass = '') {
  const notice = el('article', {
    className: `wallet-rail-card simulated-wallet-notice ${extraClass}`.trim(),
    role: 'status',
  });
  notice.dataset.simulatedWallet = 'true';
  appendText(notice, 'strong', disclosure.headline);
  appendText(notice, 'span', disclosure.detail);
  appendText(notice, 'small', disclosure.action);
  return notice;
}

// The shell-level banner. The old wallet rail panel lived in the legacy login
// terminal, which was hidden once you were connected -- rendering the disclosure
// only there meant it was in the DOM but invisible, which is worse than useless
// because it looks handled. This one is in the official app shell, so it shows
// on every route for as long as the simulated identity is active. render()
// calls it on every route change, so an unchanged banner is left alone: a
// rebuilt role=status region would be announced again each time.
function renderSimulatedWalletBanner() {
  const banner = dom.simulatedWalletBanner;
  if (!banner) return;
  const simulated = isSimulatedWalletActive();
  if (simulated === !banner.hidden) return;
  banner.hidden = !simulated;
  banner.replaceChildren();
  if (!simulated) return;
  const model = buildWalletConnectionModel({
    providerAvailable: Boolean(detectEthereumProvider()?.request),
    wallet: connectedWallet,
    chainId: connectedChainId,
    connector: walletConnector,
  });
  if (!model.disclosure) return;
  banner.dataset.simulatedWallet = 'true';
  appendText(banner, 'strong', model.disclosure.headline);
  appendText(banner, 'span', model.disclosure.detail);
  appendText(banner, 'small', model.disclosure.action);
}

function renderOfficialRunStatus() {
  if (!dom.runStatus || !dom.runDetails) return;
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
  dom.combatStatus.textContent = `${model.details} Controls: WASD/arrows move, mouse aims (gun auto-fires), Left Click fire, Right Click or F grenade, R reload, Esc pause.`;
  dom.combatRunStatus.dataset.state = model.state;
}

function currentPlayerBestScoreForMode(mode = currentSession?.mode ?? officialSelectedMode) {
  if (!connectedWallet) return 0;
  const snapshot = buildPlayerArcadeSnapshot(state, connectedWallet);
  const progress = snapshot.progress?.['lester-blaster'];
  return mode === 'free'
    ? Math.max(0, Math.round(progress?.bestFreeScore ?? 0))
    : Math.max(0, Math.round(progress?.bestPaidScore ?? 0));
}

function gameplaySyncCopy() {
  const modeCopy = officialSelectedMode === 'ranked'
    ? SETTLEMENT_LIVE
      ? 'Ranked testnet: verified score sync is held until game-over submission; restart creates a new verified session.'
      : 'Ranked preview: canonical evidence is saved locally; no transaction or on-chain leaderboard write occurs.'
    : 'Free practice: local sandbox only; restart is free and never writes profile/leaderboard state.';
  const phase = combat.stagePhase === 'travel'
    ? `player-led advance to Stage ${combat.stageIndex} engagement`
    : combat.stagePhase === 'boss'
      ? 'level boss lock'
      : `Wave ${combat.waveIndex}/${combat.wavesThisStage || 1}`;
  const lockCopy = combat.scrollLockReason ? ` // ${combat.scrollLockReason}` : '';
  const healthCopy = `HP ${Math.max(0, Math.round((combat.health / Math.max(1, combat.maxHealth ?? PLAYER_MAX_HEALTH)) * 100))}%`;
  return `${modeCopy} // ${healthCopy} // Stage ${combat.stageIndex}/${combat.stageCount} // ${phase}${lockCopy}`;
}

function currentGameOverSummaryModel() {
  const session = currentSession ?? lastCompletedSession;
  const level = currentCampaignLevel();
  const extractionAllowed = hmhCampaignLevelAllowsExtraction(level.id);
  const cleared = extractionAllowed && (Boolean(combat.clearedCampaignLevelId) || Boolean(combat.bossDefeated));
  const extraction = extractionAllowed ? calculateExtractionScore({
    baseScore: combat.score || lastRunScore,
    elapsedSeconds: combat.elapsedGameSeconds || lastRunElapsedSeconds,
    level: level.number,
    targetSeconds: level.id === DEFAULT_CAMPAIGN_LEVEL_ID ? null : level.scoring?.targetSeconds,
    masterySeconds: level.id === DEFAULT_CAMPAIGN_LEVEL_ID ? null : level.scoring?.masterySeconds,
    cleared,
    noDamageSeconds: combat.noDamageSeconds,
    maxCombo: combat.maxCombo,
    deaths: combat.gameOver && !cleared ? 1 : 0,
  }) : null;
  // Reboot runs answer from the canonical payload (Bosses, Killed By, Best
  // Augment, Run Seed); the legacy in-portal fields only apply without one.
  const recapFields = selectGameOverRecapFields(lastHmhRunSummary, {
    bossesDefeated: (combat.bossDefeated || combat.scriptedBossTriggered || Boolean(lastBossId)) ? 1 : 0,
    killedBy: cleared ? null : combat.killedBy,
    bestUpgrade: bestRoguelikeUpgradeTitle(),
    runSeed: combat.roguelikeRun?.seed ?? null,
  });
  return buildGameOverSummaryModel({
    session,
    score: combat.score || lastRunScore,
    elapsedSeconds: combat.elapsedGameSeconds || lastRunElapsedSeconds,
    kills: combat.kills,
    ...recapFields,
    acceptedForGlobalLeaderboard: Boolean(lastSettlementSucceeded),
    extraction,
    previousBestScore: lastRunPreviousBestScore || currentPlayerBestScoreForMode(session?.mode),
    sessionStreak: sessionRunStreak || 1,
    backgroundSettlementQueued: Boolean(lastSettlementQueued && !lastSettlementSucceeded),
    settlementLive: SETTLEMENT_LIVE,
  });
}

// The run's defining augment: highest-ranked roguelike skill, for the death
// recap. Ties break toward library order (earlier = more foundational).
function currentHmhRunRecap() {
  return lastHmhRunSummary ? buildHmhRunRecapModel(lastHmhRunSummary) : null;
}

// The reboot lifecycle stores the bridge's terminal reason verbatim
// ('defeated'); the legacy sandbox stores a sentence. Both must read as one.
function gameOverReasonCopy(reason) {
  const REASON_COPY = { defeated: 'Lester was defeated.', completed: 'Run complete.', abandoned: 'Run abandoned.', 'runtime-error': 'The run ended on a runtime error.' };
  return REASON_COPY[reason] ?? (reason || 'Lester was defeated.');
}

// Hades-style death recap rows built from the canonical summary. textContent
// only: every label comes from a fixed map or a validated catalog id.
function renderHmhRunRecap(recap) {
  const section = el('section', { className: 'hmh-run-recap', dataset: { testid: 'hmh-run-recap' } });
  const row = (label, children) => {
    const wrapper = el('div', { className: 'hmh-run-recap-row' });
    appendText(wrapper, 'span', label, 'hmh-run-recap-label');
    const body = el('div', { className: 'hmh-run-recap-body' });
    for (const child of children) body.append(child);
    wrapper.append(body);
    section.append(wrapper);
  };
  const chip = (text) => el('span', { className: 'hmh-run-recap-chip', textContent: text });
  const chips = (items) => {
    const list = el('div', { className: 'hmh-run-recap-chips' });
    for (const item of items) list.append(chip(item));
    return list;
  };
  const defeatCopy = el('p', { className: 'hmh-run-recap-copy', textContent: recap.defeat.detail ? `${recap.defeat.sentence} ${recap.defeat.detail}.` : recap.defeat.sentence });
  row('Cause of defeat', [defeatCopy]);
  const weaponChips = recap.build.weapons.map((weapon) => `${weapon.label} · ${weapon.kills} kills`);
  const upgradeChips = recap.build.upgrades.map((upgrade) => `${upgrade.label} (Rank ${upgrade.rank})`);
  row('Build', [chips(weaponChips.length ? weaponChips : ['No weapon used']), chips(upgradeChips.length ? upgradeChips : ['No augments taken'])]);
  const milestoneChips = recap.milestones.map((milestone) => (milestone.clock ? `${milestone.clock} ${milestone.label}` : milestone.label));
  row('Milestones', [chips(milestoneChips.length ? milestoneChips : ['No milestones reached'])]);
  row('Run', [chips([`Seed ${recap.seed}`, `Max combo ${recap.maxCombo}`, `Level ${recap.level}`, `Survived ${recap.survivalClock}`])]);
  return section;
}

function bestRoguelikeUpgradeTitle() {
  const skills = combat.roguelikeRun?.skills;
  if (!skills) return null;
  let best = null;
  let bestLevel = 0;
  for (const skill of LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY) {
    const level = skills[skill.id] ?? 0;
    if (level > bestLevel) {
      best = skill;
      bestLevel = level;
    }
  }
  return best ? `${best.title} (Rank ${bestLevel})` : null;
}

// Ranked results screen (contract §7.3, §7.7): the lesters:ranked-run
// listener near the end of this file lazy-loads src/ranked-results.mjs and
// hands the open view here. For a Ranked HMH run the results screen replaces
// the game-over summary, which shrinks to one "View results" button while
// the screen is open or after it was dismissed for this session. The button
// node survives re-renders (settlement updates re-render the summary), and
// renderGameOverSummary returns it so closing the screen can focus it.
let rankedResultsView = null;
let rankedResultsReopen = null;
function showRankedResults(view) {
  rankedResultsView = view;
  renderGameOverSummary();
  syncCabinetResultsButton();
}

// The results screen closed (Escape, Close, or its view went away): HMH
// re-renders its summary and Chikun and STACKED show their cabinet button.
// Either "View results" button is where focus goes back to.
function rankedResultsClosed() {
  return renderGameOverSummary() ?? syncCabinetResultsButton();
}

// Chikun and STACKED run in child frames whose result panels cannot reopen
// the parent's results screen. While that cabinet is still open on the run
// the screen belongs to, a small parent-level "View results" button floats
// over it (styled in src/styles/ranked-results.css, which the screen already
// loaded). It hides while the screen is open, and for good once the player
// leaves the cabinet or starts another run.
// It also hides while a Ranked start is under way (the sign-in picker, the
// entry modal, a WalletConnect reconnect), and while the entry modal stays
// open on a paused or closed message: it floats above those dialogs
// (z-index 10040 against 90-130), and reopening the results screen there
// would stack a second dialog on the payment one.
let cabinetResultsButton = null;
let rankedStartsInFlight = 0;
function cabinetResultsView() {
  const view = rankedResultsView;
  if (!view || (view.gameId !== 'chikun' && view.gameId !== 'stacked')) return null;
  if (officialAppStep !== 'gameplay' || selectedGameId !== view.gameId) return null;
  if (rankedStartsInFlight > 0 || dom.rankedEntryModal?.hidden === false) return null;
  const cabinetOpen = view.gameId === 'chikun' ? Boolean(chikunHost) : Boolean(stackedHost);
  const sessionId = (currentSession ?? lastCompletedSession)?.sessionId;
  return cabinetOpen && sessionId && view.sessionId === sessionId ? view : null;
}
function syncCabinetResultsButton() {
  const view = cabinetResultsView();
  if (!view || view.isOpen) {
    if (cabinetResultsButton) cabinetResultsButton.hidden = true;
    return null;
  }
  if (!cabinetResultsButton) {
    cabinetResultsButton = el('button', { className: 'cabinet-results-reopen', type: 'button', textContent: 'View results' });
    cabinetResultsButton.setAttribute('aria-haspopup', 'dialog');
    cabinetResultsButton.addEventListener('click', () => {
      const current = cabinetResultsView();
      if (!current) { syncCabinetResultsButton(); return; }
      playSfxCue('menu-click');
      current.reopen();
      syncCabinetResultsButton();
    });
    document.body.append(cabinetResultsButton);
  }
  cabinetResultsButton.dataset.gameId = view.gameId;
  cabinetResultsButton.hidden = false;
  return cabinetResultsButton;
}

function rankedResultsViewForCurrentRun() {
  const sessionId = (currentSession ?? lastCompletedSession)?.sessionId;
  return rankedResultsView?.gameId === 'lester-blaster' && sessionId && rankedResultsView.sessionId === sessionId ? rankedResultsView : null;
}

function renderGameOverSummary() {
  if (!dom.combatGameOverSummary) return null;
  dom.combatGameOverSummary.hidden = !combat.gameOver;
  if (!combat.gameOver) {
    dom.combatGameOverSummary.replaceChildren();
    return null;
  }
  const rankedView = rankedResultsViewForCurrentRun();
  if (rankedView) {
    if (rankedResultsReopen?.view === rankedView && rankedResultsReopen.button.parentNode === dom.combatGameOverSummary) return rankedResultsReopen.button;
    dom.combatGameOverSummary.dataset.channel = 'ranked-results';
    dom.combatGameOverSummary.replaceChildren();
    appendText(dom.combatGameOverSummary, 'strong', 'RANKED RUN COMPLETE', 'game-over-summary-title');
    const viewResults = el('button', { className: 'combat-action-button combat-action-button-primary ranked-results-reopen', type: 'button', textContent: 'View results' });
    viewResults.addEventListener('click', () => { playSfxCue('menu-click'); rankedView.reopen(); });
    dom.combatGameOverSummary.append(viewResults);
    rankedResultsReopen = { view: rankedView, button: viewResults };
    return viewResults;
  }
  rankedResultsReopen = null;
  const summary = currentGameOverSummaryModel();
  const nextLevel = combat.nextCampaignLevelId ? getHmhCampaignLevel(combat.nextCampaignLevelId) : null;
  const win = Boolean(combat.clearedCampaignLevelId) && isL2CampaignActive();
  dom.combatGameOverSummary.dataset.channel = win ? 'victory' : summary.channel;
  dom.combatGameOverSummary.replaceChildren();
  appendText(dom.combatGameOverSummary, 'strong', win ? 'YOU WIN' : (combat.levelClearTitle || summary.title), 'game-over-summary-title');
  appendText(dom.combatGameOverSummary, 'p', win
    ? 'Litecoin City survived. The final boss is down. Quarter-arcade legend achieved.'
    : summary.trackingCopy, 'game-over-summary-copy');

  const metricGrid = el('div', { className: 'game-over-summary-grid' });
  for (const metric of summary.metrics) {
    const card = el('article', { className: `summary-metric-card ${metric.id === 'personal-best' ? 'summary-metric-card-pb-flash' : ''}` });
    appendText(card, 'span', metric.label, 'summary-metric-label');
    appendText(card, 'strong', metric.value, 'summary-metric-value');
    metricGrid.append(card);
  }
  dom.combatGameOverSummary.append(metricGrid);
  const recap = currentHmhRunRecap();
  if (recap) dom.combatGameOverSummary.append(renderHmhRunRecap(recap));

  // Share row (owner direction 2026-09-16): Share on X first, then Discord
  // copy, Facebook and the native share sheet. Built from the same summary
  // the recap shows; posting is always the player's own click. Free runs
  // only: a Ranked run is shared from the Ranked results screen once it is
  // published on LitVM (contract §7.4).
  if (!win && (currentSession?.mode ?? officialSelectedMode ?? 'free') === 'free') {
    const shareText = buildHmhShareText({
      score: combat.score,
      kills: combat.kills,
      level: (hmhRebootActive ? combat.runLevel : combat.roguelikeRun?.level) ?? 1,
      elapsedSeconds: combat.elapsedGameSeconds ?? 0,
      maxCombo: combat.maxCombo ?? 0,
      killedBy: recap?.defeat?.label ?? combat.killedBy ?? '',
      bossDefeated: Boolean(combat.bossDefeated),
    });
    const shareLabel = el('span', { className: 'share-row-label', textContent: 'Share this run' });
    const shareRow = createShareRow({
      title: 'Hard Money Heroes',
      links: buildShareLinks({ text: shareText, url: shareUrlFor('hmh-reboot') }),
      className: 'share-row game-over-share-row',
      buttonClassName: 'combat-menu-action share-button',
      onStatus: (message) => { shareLabel.textContent = message; },
    });
    shareRow.prepend(shareLabel);
    dom.combatGameOverSummary.append(shareRow);
  }

  const loopNote = el('p', { className: 'game-over-one-more-run-copy' });
  loopNote.textContent = `${summary.oneMoreRun.copy} ${summary.streak.copy} ${summary.settlement.copy}`;
  dom.combatGameOverSummary.append(loopNote);

  const actionNote = el('p', { className: 'game-over-action-copy' });
  const continueCopy = combat.clearedCampaignLevelId && nextLevel
    ? `Next up: ${nextLevel.gameplayTitle}.`
    : '';
  actionNote.textContent = `${summary.actions.map((action) => `${action.label}: ${action.cost}`).join(' // ')}.${continueCopy} ${summary.exitRampCopy}`;
  dom.combatGameOverSummary.append(actionNote);

  const replayButton = el('button', { className: 'combat-action-button combat-action-button-primary run-it-back-button' });
  replayButton.type = 'button';
  replayButton.dataset.action = summary.oneMoreRun.primaryActionId;
  replayButton.textContent = `Run It Back (${summary.oneMoreRun.estimatedRestartSeconds}s)`;
  replayButton.addEventListener('click', () => { playSfxCue('menu-click'); restartCombatRun(); });
  dom.combatGameOverSummary.append(replayButton);

  if (nextLevel && combat.clearedCampaignLevelId && !win) {
    const continueButton = el('button', { className: 'combat-action-button combat-action-button-primary' });
    continueButton.type = 'button';
    continueButton.textContent = `Continue to ${nextLevel.shortTitle}`;
    continueButton.addEventListener('click', () => {
      playSfxCue('menu-click');
      continueToCampaignLevel(nextLevel.id);
    });
    dom.combatGameOverSummary.append(continueButton);
  }
}

function recordCurrentSessionEvent(type, payload = {}) {
  if (!currentSession?.isPaid || !currentSession.evidence) return false;
  return recordSessionEvent(currentSession.evidence, { step: combat.frame, type, payload });
}

// The one Ranked identity (A10): the entry key and the settlement key are both
// rankedIdentityFor(session), with the session's own per-game season and the
// ticket seed once signin-entry applied it (A25).
function currentCanonicalSessionIdentity(session = currentSession) {
  if (!session?.isPaid) return null;
  return rankedIdentityModule.rankedIdentityFor(session, { scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry });
}

// The envelope's final state. A reboot run answers from its canonical summary
// totals; only the legacy in-portal sandbox (no summary) reads combat.*.
function currentCanonicalFinalState(runSummary = lastHmhRunSummary) {
  if (runSummary?.totals && runSummary.kills && runSummary.identity) {
    return {
      hp: 0,
      score: runSummary.totals.score,
      kills: runSummary.kills.total,
      maxCombo: runSummary.totals.maxCombo,
      survivalSeconds: Math.max(0, Number(((Number(runSummary.totals.elapsedMs) || 0) / 1000).toFixed(3))),
      level: runSummary.totals.level,
      bossKills: runSummary.kills.boss,
      characterId: runSummary.identity.heroId,
      killedBy: runSummary.defeat?.causeId ?? null,
    };
  }
  return {
    hp: Math.max(0, Number(combat.health) || 0),
    mapX: Number((Number(combat.playerMapX) || 0).toFixed(4)),
    mapY: Number((Number(combat.playerMapY) || 0).toFixed(4)),
    score: Math.max(0, Math.round(Number(combat.score) || 0)),
    kills: Math.max(0, Math.floor(Number(combat.kills) || 0)),
    maxCombo: Math.max(0, Math.floor(Number(combat.maxCombo) || 0)),
    survivalSeconds: Math.max(0, Number((Number(combat.elapsedGameSeconds) || 0).toFixed(3))),
    level: Math.max(1, Math.floor(Number(combat.roguelikeRun?.level) || 1)),
    bossKills: Math.max(0, Math.floor(Number(combat.bossKills) || 0)),
    characterId: combat.characterId ?? null,
    killedBy: combat.killedBy ?? null,
  };
}

async function finalizeCurrentSessionEvidence(session = currentSession, runSummary = lastHmhRunSummary) {
  const identity = currentCanonicalSessionIdentity(session);
  if (!identity || !session.evidence) return null;
  return finalizeSessionEvidence({ identity, evidence: session.evidence, finalState: currentCanonicalFinalState(runSummary) });
}

// recordScore inputs of a legacy in-portal sandbox run (no canonical summary).
function legacyHmhRecordInputs() {
  return {
    score: Math.max(0, Math.round(combat.score)),
    runStats: {
      distanceMeters: Math.round((combat.elapsedGameSeconds || 0) * 2.7),
      elapsedSeconds: Math.round(combat.elapsedGameSeconds || 0),
      kills: combat.kills,
      enemyKillsByType: { ...(combat.killsByType || {}) },
      maxCombo: combat.maxCombo,
      bossId: combat.bossDefeated ? lastBossId : null,
      weaponId: combat.weaponId,
      noDamage: combat.noDamageSeconds >= combat.elapsedGameSeconds - 1,
      collectedPowerUps: [...(combat.collectedPowerUpTypes ?? [])],
    },
  };
}

// §6.3 stats of a local canonical result, or null when the mapper refuses it.
function rankedLocalStats(map) {
  try {
    return map();
  } catch (error) {
    console.warn('[Ranked settlement] local stats unavailable', error);
    return null;
  }
}

function submitCombatGameOver(runSummary) {
  // syncCombatOverlay re-enters with no argument; only a real payload may
  // replace the recap, and restart/teardown are what clear it.
  if (runSummary) lastHmhRunSummary = runSummary;
  if (!combat.gameOver || !currentSession?.isPaid || combat.gameOverSubmitted) return;
  const session = currentSession;
  const summary = lastHmhRunSummary;
  recordCurrentSessionEvent('run-end', currentCanonicalFinalState(summary));
  lastRunPreviousBestScore = currentPlayerBestScoreForMode(session.mode);
  sessionRunStreak += 1;
  lastSettlementQueued = false;
  combat.gameOverSubmitted = true;
  // Local record inputs come from the canonical run summary (contract §6.4,
  // HMH map §3.6 and G1), never the stale legacy combat.* counters. Only the
  // legacy in-portal sandbox (no summary at all) reads combat.*.
  let local;
  if (summary) {
    try {
      local = achievementStats.hmhRecordScoreInputsFromRunSummary(summary);
    } catch (error) {
      // The server maps the same summary with the same module, so this run can
      // never be ranked: keep it out of the Ranked record rather than record
      // the stale live counters under its session.
      console.error('[HMH] canonical run summary could not be mapped; the Ranked run is not recorded', error);
      lastCompletedSession = session;
      lastRunResult = { score: 0, elapsedSeconds: 0, acceptedForGlobalLeaderboard: false };
      lastRunScore = 0;
      lastRunElapsedSeconds = 0;
      if (dom.combatStatus) dom.combatStatus.textContent = 'This run’s summary could not be read, so it was not recorded or ranked.';
      renderOfficialRunStatus();
      renderGameOverSummary();
      renderCombatMenuActionGrid();
      return;
    }
  } else {
    local = legacyHmhRecordInputs();
  }
  const result = recordScore(state, session, local.score, local.runStats);
  // The run log, the sync packet and the recap read the same run as the record.
  const elapsedSeconds = summary ? local.runStats.elapsedSeconds : combat.elapsedGameSeconds;
  const kills = local.runStats.kills;
  lastCompletedSession = session;
  lastRunResult = {
    score: local.score,
    elapsedSeconds,
    acceptedForGlobalLeaderboard: result.acceptedForGlobalLeaderboard,
  };
  lastRunScore = local.score;
  lastRunElapsedSeconds = elapsedSeconds;
  // Ranked run history (persisted): feeds the profile run log + future
  // cross-game ArcadeProfile aggregation.
  appendRunRecord(state, {
    sessionId: session.sessionId,
    gameId: 'lester-blaster',
    wallet: connectedWallet,
    mode: session.mode ?? 'paid',
    score: local.score,
    elapsedSeconds: Math.round(elapsedSeconds || 0),
    kills,
    characterId: summary?.identity?.heroId ?? combat.characterId,
    killedBy: summary ? (summary.defeat?.causeId ?? null) : (combat.killedBy ?? null),
    bossDefeated: summary ? summary.kills.boss > 0 : Boolean(combat.bossDefeated),
    runSummary: summary,
  });
  persistArcadeStateSoon();
  // GameRegistry: child game -> parent sync packet (local now, LitVM SessionLedger later)
  submitGameRun('hard-money-heroes', {
    sessionId: session.sessionId,
    score: local.score,
    kills,
    survivalTime: Math.round(elapsedSeconds || 0),
  }, connectedWallet);
  renderOfficialRunStatus();
  renderGameOverSummary();
  renderCombatMenuActionGrid();

  // Settlement: the relayer publishes the verified run (A3), so the player
  // never signs a score submission. Preview keeps the local record only.
  if (result.acceptedForGlobalLeaderboard && result.settlementInput) {
    lastSettlementQueued = SETTLEMENT_LIVE;
    lastSettlementInput = result.settlementInput;
    lastRunStatsForSettlement = summary ? rankedLocalStats(() => achievementStats.statsFromHmhRunSummary(summary)) : null;
    renderGameOverSummary();
    renderCombatMenuActionGrid();
    void settleRankedRun({ session, runSummary: summary, localScore: local.score, localStats: lastRunStatsForSettlement });
  }
}

// Retry publishing the finished Ranked run on screen (the combat menu's Submit
// Official Score): its settlement handle re-drives the stored request.
function retryPublishGameOver() {
  if (!lastSettlementHandle) return;
  void lastSettlementHandle.retry();
}

// The manual publish action is offered only where a retry can help.
function rankedPublishRetryAvailable() {
  return ['saved-locally', 'retrying'].includes(lastSettlementHandle?.state);
}

// Hard Money Heroes settlement: the lesters-session-envelope-v1 commits to
// the summary totals, the run summary travels as the evidence (§5.1), and the
// server plausibility-checks it (A9). No player-signed submit and no
// /api/attest call remain (A3).
async function settleRankedRun({ session, runSummary = null, localScore = 0, localStats = null } = {}) {
  let sessionEnvelope = null;
  try {
    sessionEnvelope = await finalizeCurrentSessionEvidence(session, runSummary);
  } catch (error) {
    console.error('[settlement] canonical session evidence could not be finalized', error);
  }
  const persistedRun = sessionEnvelope ? state.runHistory?.find((run) => run.sessionId === session.sessionId) : null;
  if (persistedRun) {
    persistedRun.sessionKey = sessionEnvelope.sessionKey;
    persistedRun.inputHash = sessionEnvelope.inputHash;
    persistedRun.eventHash = sessionEnvelope.eventHash;
    persistedRun.finalStateHash = sessionEnvelope.finalStateHash;
    persistedRun.envelopeHash = sessionEnvelope.envelopeHash;
  }

  if (!SETTLEMENT_LIVE) {
    clearActiveSessionCheckpoint(state, session.sessionId, { submitted: false });
    persistArcadeStateSoon();
    lastSettlementQueued = false;
    lastSettlementSucceeded = false;
    lastSettlementError = null;
    if (dom.combatStatus) {
      dom.combatStatus.textContent = 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.';
    }
    if (officialAppStep === 'leaderboards') renderOfficialLeaderboards();
    if (officialAppStep === 'profile') renderOfficialProfile();
    renderGameOverSummary();
    renderCombatMenuActionGrid();
    await startRankedSettlement({ session, localScore, localStats });
    return;
  }

  if (dom.combatStatus) dom.combatStatus.textContent = 'Publishing your run on LitVM — see the results panel.';
  await startRankedSettlement({
    session,
    localScore,
    localStats,
    buildRequest: (builders) => {
      if (!runSummary || !sessionEnvelope) throw new Error('the canonical run summary or its session envelope is unavailable');
      return builders.buildHmhSettleRequest({ session, scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry, runSummary, sessionEnvelope, claimScore: localScore });
    },
  });
}

// Chikun's Escape: the verified v6 evidence of the replay claim (§5.1).
function settleChikunRankedRun(session, result) {
  return startRankedSettlement({
    session,
    localScore: result.canonical.score,
    localStats: rankedLocalStats(() => achievementStats.statsFromChikunResult(result.canonical)),
    buildRequest: (builders) => builders.buildChikunSettleRequest({ session, scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry, evidence: result.evidence, claimScore: result.canonical.score }),
  });
}

// STACKED: the host-verified SIC1 bytes and tuple (§5.1).
function settleStackedRankedRun(session, canonical, evidence) {
  return startRankedSettlement({
    session,
    localScore: canonical.score,
    localStats: rankedLocalStats(() => achievementStats.statsFromStackedTuple(canonical)),
    buildRequest: (builders) => builders.buildStackedSettleRequest({ session, scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry, sic1Bytes: evidence, claimScore: canonical.score }),
  });
}

function loadRankedRequests() {
  return import('./src/ranked-requests.mjs');
}

// A lazy chunk that failed to load (a network blip at game over) is fetched
// again with backoff before the run is given up on.
async function importWithRetry(load, delaysMs = [1000, 3000]) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      if (attempt >= delaysMs.length) throw error;
      await new Promise((resolve) => { setTimeout(resolve, delaysMs[attempt]); });
    }
  }
}

// One finished Ranked run of any game → its settlement handle (contract
// §7.2) and exactly one lesters:ranked-run event (§7.7) for the results
// screen. Preview (SETTLEMENT_LIVE false) builds no request and sends
// nothing: the handle is a terminal 'preview'.
async function startRankedSettlement({ session, localScore = 0, localStats = null, buildRequest = null }) {
  if (rankedRunsHandedOff.has(session)) return null;
  rankedRunsHandedOff.add(session);
  let settlement;
  try {
    settlement = await importWithRetry(rankedSettlementClient);
  } catch (error) {
    // Without the client nothing can publish or show this run: say so.
    console.error('[Ranked settlement]', error);
    const line = session.gameId === 'lester-blaster' ? dom.combatStatus : dom.officialGameStateCopy;
    if (line && SETTLEMENT_LIVE) line.textContent = 'This Ranked run could not be sent for publishing: part of the page failed to load. Check your connection.';
    return null;
  }
  try {
    const { client, module } = settlement;
    let request = null;
    if (SETTLEMENT_LIVE && buildRequest) {
      // Preloaded when the run started (captureRankedResultContext). If it
      // still cannot load or build, the request stays null and the client
      // shows the run as not prepared instead of dropping it silently.
      try {
        request = await buildRequest(await importWithRetry(loadRankedRequests));
      } catch (error) {
        console.error('[Ranked settlement] the settle request could not be built', error);
      }
    }
    const handle = client.settle(request, {
      entryConfirmed: session.entryConfirmed ?? null,
      entry: session.entryReceipt ?? null,
      localScore,
      gameId: session.gameId,
      wallet: session.wallet,
      sessionId: session.sessionId,
    });
    trackRankedSettlement(handle, session, module);
    const context = await rankedRunContext(session, handle, localScore, localStats);
    window.dispatchEvent(new CustomEvent('lesters:ranked-run', { detail: { handle, context, actions: rankedRunActions() } }));
    return handle;
  } catch (error) {
    console.error('[Ranked settlement]', error);
    return null;
  }
}

// The lastSettlement* flags and the status line follow the latest run's handle.
function trackRankedSettlement(handle, session, settlementModule) {
  lastSettlementUnsubscribe?.();
  lastSettlementHandle = handle;
  const hmh = session.gameId === 'lester-blaster';
  const apply = (snapshot) => {
    if (lastSettlementHandle !== handle) return;
    lastSettlementSucceeded = snapshot.state === 'published';
    lastSettlementQueued = ['waiting-entry', 'verifying', 'queued', 'publishing', 'retrying'].includes(snapshot.state);
    lastSettlementError = ['saved-locally', 'rejected', 'practice'].includes(snapshot.state) ? (snapshot.error?.message ?? null) : null;
    const line = hmh ? dom.combatStatus : dom.officialGameStateCopy;
    if (line && (currentSession === session || lastCompletedSession === session)) line.textContent = settlementModule.rankedSettlementStatusCopy(snapshot);
    if (hmh) {
      renderGameOverSummary();
      renderCombatMenuActionGrid();
    }
  };
  lastSettlementUnsubscribe = handle.subscribe(apply);
  apply(handle.snapshot);
}

// §7.2 result context, captured when a Ranked run starts: hosted reads the
// public index profile once (a device-local best is never used there);
// preview recomputes the device-local best before this run is recorded.
function captureRankedResultContext(session) {
  if (!session?.isPaid || !session.sessionId) return;
  // The request builders load now, not at game over, so a network blip at
  // the end of a paid run cannot lose its settle body.
  if (SETTLEMENT_LIVE) void loadRankedRequests().catch((error) => console.warn('[Ranked settlement] builders will load at game over', error));
  const wallet = session.wallet;
  const profile = state.profiles?.[wallet] ?? null;
  const progress = profile?.progress?.[session.gameId] ?? null;
  const local = {
    displayName: profile ? resolveDisplayName(profile, wallet) : null,
    previousBest: progress && progress.paidRuns > 0 ? Math.max(0, Math.round(progress.bestPaidScore ?? 0)) : null,
  };
  const pending = HOSTED_PROFILE_SYNC
    ? rankedSettlementClient().then(({ module }) => module.fetchRankedResultContext({ hosted: HOSTED_PROFILE_SYNC, fetchImpl: (...args) => fetch(...args), wallet, gameId: session.gameId }))
    : Promise.resolve(local);
  rankedResultContexts.set(session.sessionId, pending.catch(() => ({ displayName: null, previousBest: null })));
}

async function rankedRunContext(session, handle, localScore, localStats) {
  const empty = { displayName: null, previousBest: null };
  const captured = rankedResultContexts.get(session.sessionId);
  rankedResultContexts.delete(session.sessionId);
  let timer = null;
  const known = captured
    ? await Promise.race([captured, new Promise((resolve) => { timer = setTimeout(() => resolve(empty), 4000); })])
    : empty;
  if (timer !== null) clearTimeout(timer);
  const snapshot = handle.snapshot;
  return {
    gameId: session.gameId,
    gameTitle: session.gameTitle ?? session.gameId,
    sessionId: session.sessionId,
    sessionId32: snapshot.sessionId32 ?? null,
    wallet: session.wallet,
    displayName: known?.displayName ?? null,
    localScore,
    localStats,
    previousBest: known?.previousBest ?? null,
    entry: { ...snapshot.entry },
    mode: 'ranked',
  };
}

function rankedRunActions() {
  return Object.freeze({
    playAgainRanked: () => startOfficialMode('ranked'),
    practiceFree: () => startOfficialMode('free'),
    viewProfile: () => setOfficialView('profile'),
    backToArcade: () => exitToArcade(),
  });
}

// A published run (this page's or a resumed one) stamps its local rows with
// the transaction and the session key (its verified record is the index's).
function applyRankedPublication(snapshot) {
  const txHash = snapshot?.server?.txHash;
  if (!snapshot?.sessionId || !snapshot.gameId || typeof txHash !== 'string') return;
  applySettlement(state, {
    mode: 'live',
    settled: true,
    relayed: true,
    wallet: snapshot.wallet,
    gameId: snapshot.gameId,
    sessionId: snapshot.sessionId,
    score: snapshot.server.score ?? snapshot.localScore,
    onChainSessionId32: snapshot.sessionId32,
    receipts: [{ contract: 'scoreSubmissionRegistry', method: 'submitVerifiedSession', txHash, relayer: 'relayer' }],
    primaryTxHash: txHash,
    settledAt: snapshot.server.confirmedAt ?? new Date().toISOString(),
  });
  clearActiveSessionCheckpoint(state, snapshot.sessionId, { submitted: true });
  persistArcadeStateSoon();
  if (officialAppStep === 'leaderboards') renderOfficialLeaderboards();
  if (officialAppStep === 'profile') renderOfficialProfile();
}

// Every run starts from a clean settlement state (the reboot path included).
function resetRankedRunState() {
  lastSettlementUnsubscribe?.();
  lastSettlementUnsubscribe = null;
  lastSettlementHandle = null;
  lastSettlementInput = null;
  lastRunStatsForSettlement = null;
  lastSettlementError = null;
  lastSettlementQueued = false;
  lastSettlementSucceeded = false;
  lastHmhRunSummary = null;
  combat.gameOver = false;
  combat.gameOverSubmitted = false;
}

const activeLevelUpPointerIds = new Set();
let levelUpInteractionGate = null;
let levelUpArmTimer = null;

function levelUpClock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function currentLevelUpViewport() {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
    offsetTop: viewport?.offsetTop ?? 0,
    offsetLeft: viewport?.offsetLeft ?? 0,
  };
}

function levelUpSelectionReady(now = levelUpClock()) {
  return isLevelUpInteractionReady(levelUpInteractionGate, {
    now,
    activePointerIds: activeLevelUpPointerIds,
  });
}

function refreshLevelUpInteractionState() {
  clearTimeout(levelUpArmTimer);
  levelUpArmTimer = null;
  const overlay = document.getElementById('levelUpOverlay');
  if (!overlay || !combat.levelUpPaused) return;
  const now = levelUpClock();
  const ready = levelUpSelectionReady(now);
  overlay.dataset.armed = String(ready);
  const status = overlay.querySelector('.level-up-selection-status');
  if (status) status.textContent = ready ? 'SELECT AN UPGRADE // KEYS 1 OR 2' : 'RELEASE CONTROLS // CHOICES ARMING';
  for (const button of overlay.querySelectorAll('[data-level-up-choice]')) button.disabled = !ready;
  const reroll = overlay.querySelector('[data-action="level-up-reroll"]');
  if (reroll) reroll.disabled = !ready || reroll.dataset.available !== 'true';
  if (!ready && levelUpInteractionGate && now < levelUpInteractionGate.armedAt) {
    levelUpArmTimer = setTimeout(refreshLevelUpInteractionState, Math.max(16, levelUpInteractionGate.armedAt - now + 8));
  }
}

function closeLevelUpInteractionGate() {
  clearTimeout(levelUpArmTimer);
  levelUpArmTimer = null;
  levelUpInteractionGate = null;
  activeLevelUpPointerIds.clear();
  delete document.documentElement.dataset.levelUp;
}

function bindSafeLevelUpAction(button, action, { available = true } = {}) {
  let interactionStartedAt = 0;
  button.dataset.available = String(Boolean(available));
  button.addEventListener('pointerdown', (event) => {
    interactionStartedAt = levelUpClock();
    if (!levelUpSelectionReady(interactionStartedAt)) event.preventDefault();
  });
  button.addEventListener('click', (event) => {
    const now = levelUpClock();
    const startedAt = event.detail === 0 ? now : interactionStartedAt;
    if (!available || !canActivateLevelUpChoice(levelUpInteractionGate, {
      now,
      activePointerIds: activeLevelUpPointerIds,
      interactionStartedAt: startedAt,
    })) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    action();
  });
}

function applyLevelUpOverlayLayout(levelUpContainer) {
  const profile = deviceState.profile ?? buildDeviceProfile(readDeviceSignals());
  const viewport = currentLevelUpViewport();
  const layout = buildLevelUpViewportLayout({
    width: viewport.width,
    height: viewport.height,
    cardCount: combat.levelUpChoices?.length ?? 2,
    isTouch: profile.isTouch,
  });
  levelUpContainer.dataset.layout = layout.mode;
  levelUpContainer.dataset.density = layout.density;
  levelUpContainer.dataset.compact = String(layout.compact);
  levelUpContainer.style.setProperty('--level-up-top', `${Math.round(viewport.offsetTop + layout.insetTop)}px`);
  levelUpContainer.style.setProperty('--level-up-left', `${Math.round(viewport.offsetLeft + viewport.width / 2)}px`);
  levelUpContainer.style.setProperty('--level-up-max-width', `${Math.round(layout.maxWidth)}px`);
  levelUpContainer.style.setProperty('--level-up-max-height', `${Math.round(layout.maxHeight)}px`);
  levelUpContainer.style.setProperty('--level-up-columns', String(layout.columns));
  levelUpContainer.style.setProperty('--level-up-card-min-height', `${Math.round(layout.cardMinHeight)}px`);
  levelUpContainer.style.setProperty('--level-up-description-lines', String(layout.descriptionLines));
  levelUpContainer.classList.add('level-up-overlay');
}

function renderLevelUpActionGrid() {
  if (!dom.combatMenuActionGrid || !combat.levelUpPaused) return false;
  // Keep the sheet at body level in windowed play so transformed/centered game
  // ancestors cannot become its fixed-position containing block. Fullscreen only
  // paints descendants of the fullscreen element, so reparent there while active.
  const levelUpHost = document.fullscreenElement === dom.officialCombatMount
    ? dom.officialCombatMount
    : document.body;
  let levelUpContainer = document.getElementById('levelUpOverlay');
  if (!levelUpContainer) {
    levelUpContainer = document.createElement('div');
    levelUpContainer.id = 'levelUpOverlay';
    levelUpContainer.className = 'level-up-overlay';
    applyLevelUpOverlayLayout(levelUpContainer);
    levelUpHost.appendChild(levelUpContainer);
  } else if (levelUpContainer.parentElement !== levelUpHost) {
    levelUpHost.appendChild(levelUpContainer);
  }
  if (levelUpContainer) applyLevelUpOverlayLayout(levelUpContainer);
  const targetGrid = levelUpContainer || dom.combatMenuActionGrid;
  const choices = combat.levelUpChoices ?? [];
  const presentation = buildUpgradeMenuPresentation({
    choices,
    rerollsRemaining: combat.roguelikeRun?.rerollsRemaining ?? 0,
    colorblindTags: gameSettings.colorblindTags,
    lockedPreviews: combat.levelUpLockedPreviews ?? [],
    level: combat.roguelikeRun?.level ?? null,
    xp: combat.roguelikeRun?.xp ?? 0,
    xpToNextLevel: combat.roguelikeRun?.xpToNextLevel ?? 0,
  });
  const signature = `level-up:${presentation.cards.map((card) => `${card.id}:${card.rankLabel}`).join('|')}:xp-${presentation.xpProgress.current}-${presentation.xpProgress.required}:rerolls-${presentation.reroll.remaining}:cb-${gameSettings.colorblindTags ? 1 : 0}`;
  if (targetGrid.dataset.signature === signature) {
    refreshLevelUpInteractionState();
    return true;
  }
  targetGrid.dataset.signature = signature;
  targetGrid.replaceChildren();

  const shell = el('div', { className: presentation.shell.className ?? 'level-up-shell', dataset: { uiChrome: presentation.shell.chrome?.id ?? 'level-up-card-frame', uiTheme: presentation.shell.theme ?? 'liquid-glass' } });
  const shellHead = el('div', { className: 'level-up-shell-head' });
  appendText(shellHead, 'span', `LEVEL ${combat.roguelikeRun?.level ?? 1} DRAFT`, 'level-up-kicker');
  appendText(shellHead, 'strong', presentation.title, 'level-up-title');
  appendText(shellHead, 'p', presentation.instructions, 'level-up-subtitle');
  shell.append(shellHead);
  const xpProgress = el('div', { className: 'level-up-xp-progress', dataset: { ready: String(presentation.xpProgress.readyAfterDraft) } });
  appendText(xpProgress, 'span', presentation.xpProgress.label, 'level-up-xp-progress-label');
  const xpTrack = el('span', { className: 'level-up-xp-progress-track' });
  const xpFill = el('span', { className: 'level-up-xp-progress-fill' });
  xpFill.style.width = `${presentation.xpProgress.percent}%`;
  xpTrack.append(xpFill);
  xpProgress.append(xpTrack);
  shell.append(xpProgress);
  const selectionStatus = appendText(shell, 'p', 'RELEASE CONTROLS // CHOICES ARMING', 'level-up-selection-status');
  selectionStatus.setAttribute('aria-live', 'polite');

  const cardStack = el('div', { className: 'level-up-card-stack' });
  for (const card of presentation.cards) {
    const cardWrap = el('div', { className: `level-up-slot level-up-slot-${card.slotRole ?? 'draft'}` });
    const slotHead = el('div', { className: 'level-up-slot-head' });
    appendText(slotHead, 'span', card.decisionLabel ?? (card.index === 0 ? 'CONTINUE' : 'DIVERSIFY'), 'level-up-slot-label');
    appendText(slotHead, 'span', `KEY ${card.index + 1}`, 'level-up-shortcut');
    cardWrap.append(slotHead);
    const button = el('button', { className: `combat-menu-action ${card.chrome?.className ?? 'level-up-upgrade-card'} ${card.rarity === 'golden' ? 'is-golden-card' : ''}`, type: 'button', dataset: { ...card.dataset, rarity: card.rarity ?? 'common' } });
    button.dataset.levelUpChoice = card.id;
    const head = el('div', { className: 'upgrade-card-head' });
    const badge = el('span', { className: 'upgrade-card-badge' });
    badge.append(renderArcadeIcon(card.iconId, card.branchLabel));
    badge.setAttribute('aria-hidden', 'true');
    const titleWrap = el('div', { className: 'upgrade-card-titlewrap' });
    const cardTaxonomy = el('div', { className: 'upgrade-card-taxonomy' });
    appendText(cardTaxonomy, 'span', card.branchLabel.toUpperCase(), 'upgrade-card-cat');
    appendText(cardTaxonomy, 'span', card.rarityLabel, 'upgrade-card-rarity');
    titleWrap.append(cardTaxonomy);
    if (card.rarity === 'golden') appendText(titleWrap, 'span', 'POWER MOMENT // GOLDEN CARD', 'upgrade-card-tone-tag');
    if (card.category.colorblindTag) appendText(titleWrap, 'span', card.category.colorblindTag, 'upgrade-card-tone-tag');
    appendText(titleWrap, 'strong', card.title, 'upgrade-card-title');
    head.append(badge, titleWrap);
    const effect = el('div', { className: 'upgrade-card-effect' });
    appendText(effect, 'span', 'EFFECT', 'upgrade-card-effect-label');
    appendText(effect, 'strong', card.effectLabel, 'upgrade-card-gain');
    head.append(effect);
    button.append(head);

    // Mobile-safe card: the upgrade effect must be visible on the card itself.
    // Tooltip/ARIA remains secondary; tapping the info glyph on mobile used to
    // select the card before the player could read the effect.
    if (card.description) appendText(button, 'p', card.description, 'upgrade-card-description');
    const meta = el('div', { className: 'upgrade-card-meta' });
    const progressCopy = el('div', { className: 'upgrade-card-progress-copy' });
    appendText(progressCopy, 'span', card.completionLabel, 'upgrade-card-completion');
    appendText(progressCopy, 'span', card.rankLabel, 'upgrade-card-ranklabel');
    meta.append(progressCopy);
    button.append(meta);

    const ranks = el('div', { className: 'upgrade-card-ranks upgrade-card-meter' });
    for (const pip of card.rankPips) {
      const pipEl = el('span', { className: `upgrade-rank-pip is-${pip.state}`, title: pip.label });
      ranks.append(pipEl);
    }
    button.append(ranks);
    button.setAttribute('title', card.ariaLabel);
    button.setAttribute('aria-label', card.ariaLabel);
    bindSafeLevelUpAction(button, () => selectLevelUpUpgrade(card.id));

    const details = el('details', { className: 'upgrade-card-details' });
    const tooltipId = `upgrade-details-${card.id}`;
    const tooltip = el('summary', { className: 'upgrade-card-tooltip', title: `More information about ${card.title}` });
    tooltip.append(renderArcadeIcon('info', `More information about ${card.title}`));
    tooltip.setAttribute('aria-label', `More information about ${card.title}`);
    tooltip.setAttribute('aria-controls', tooltipId);
    tooltip.setAttribute('aria-expanded', 'false');
    const tooltipPanel = el('div', { className: 'upgrade-card-tooltip-panel', id: tooltipId });
    appendText(tooltipPanel, 'strong', card.title, 'upgrade-card-tooltip-title');
    appendText(tooltipPanel, 'p', card.tooltip || card.ariaLabel, 'upgrade-card-tooltip-copy');
    appendText(tooltipPanel, 'span', `${card.rankLabel} // ${card.rarityLabel}`, 'upgrade-card-tooltip-meta');
    details.append(tooltip, tooltipPanel);
    details.addEventListener('toggle', () => {
      tooltip.setAttribute('aria-expanded', String(details.open));
      if (!details.open) return;
      for (const other of cardStack.querySelectorAll('.upgrade-card-details[open]')) {
        if (other !== details) other.open = false;
      }
    });
    details.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !details.open) return;
      details.open = false;
      tooltip.focus();
    });
    cardWrap.append(button, details);
    cardStack.append(cardWrap);
  }
  shell.append(cardStack);

  // Locked previews remain in the presentation model for future tooltip/help
  // surfaces, but they no longer render as a keyword rail under the cards; that
  // rail made the level-up screen too tall for the gameplay window.

  const reroll = el('button', { className: 'combat-menu-action upgrade-reroll-button', type: 'button', dataset: { action: 'level-up-reroll' } });
  reroll.append(renderArcadeIcon('↻', 'Reroll upgrade choices'), document.createTextNode(presentation.reroll.label));
  bindSafeLevelUpAction(reroll, rerollLevelUpChoices, { available: presentation.reroll.enabled });
  shell.append(reroll);
  targetGrid.append(shell);
  refreshLevelUpInteractionState();
  return true;
}

function renderCombatMenuActionGrid() {
  if (!dom.combatMenuActionGrid) return;
  if (renderLevelUpActionGrid()) return;
  const menu = buildCombatOptionsMenuModel({
    paused: combat.paused,
    gameOver: combat.gameOver,
    musicEnabled: combat.musicEnabled,
    viewportMode: combat.viewportMode,
    currentMode: currentSession?.mode ?? officialSelectedMode ?? 'free',
    officialScoreSubmitted: lastSettlementSucceeded,
    officialSubmissionEnabled: SETTLEMENT_LIVE && (lastSettlementSucceeded || rankedPublishRetryAvailable()),
  });
  const actions = menu.actions.map((action) => {
    if (action.id === 'resume') return { ...action, run: () => toggleCombatPause(false) };
    if (action.id === 'toggle-settings') return { ...action, run: toggleCombatSettingsPanel };
    if (action.id === 'submit-official-score') return { ...action, run: retryPublishGameOver };
    if (action.id === 'restart') return { ...action, run: restartCombatRun };
    if (action.id === 'toggle-music') return { ...action, run: toggleCombatMusic };
    if (action.id === 'toggle-fullscreen') return { ...action, run: cycleCombatViewport };
    if (action.id === 'return-to-game-menu') return { ...action, run: returnToOfficialGameMenu };
    if (action.id === 'exit-to-arcade') return { ...action, run: exitToArcade };
    return { ...action, run: () => {} };
  });
  const elapsedSeconds = Math.max(0, Math.floor(combat.elapsedGameSeconds ?? 0));
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const weaponTitle = weaponById(combat.weaponId)?.title ?? 'The Settler';
  const runLevel = (hmhRebootActive ? combat.runLevel : combat.roguelikeRun?.level) ?? 1;
  const runSignature = `${elapsedLabel}:${runLevel}:${Math.round(combat.health)}:${combat.score}:${weaponTitle}`;
  const signature = `${menu.version}:${menu.state}:${runSignature}:` + actions.map((action) => `${action.id}:${action.label}:${action.enabled}`).join('|');
  if (dom.combatMenuActionGrid.dataset.signature === signature) return;
  dom.combatMenuActionGrid.dataset.signature = signature;
  dom.combatMenuActionGrid.replaceChildren();

  const buildActionButton = (action) => {
    const button = el('button', {
      className: `combat-menu-action pause-console-action ${action.primary ? 'primary-action' : ''} ${action.danger ? 'danger-action' : ''}`,
      type: 'button',
      dataset: { action: action.id, tooltip: action.hint ?? action.label },
    });
    button.disabled = action.enabled === false;
    button.title = action.hint ?? action.label;
    button.setAttribute('aria-label', action.hint ? `${action.label}. ${action.hint}` : action.label);
    button.append(renderArcadeIcon(action.icon, action.label));
    const copy = el('span', { className: 'pause-action-copy' });
    appendText(copy, 'strong', action.label, 'pause-action-label');
    if (action.hint) appendText(copy, 'small', action.hint, 'pause-action-hint');
    button.append(copy);
    button.addEventListener('click', () => {
      if (button.disabled) return;
      playSfxCue('menu-click');
      action.run();
    });
    return button;
  };

  if (menu.state === 'paused') {
    const shell = el('div', { className: 'pause-console-shell', dataset: { ui: menu.version } });
    const snapshot = el('div', { className: 'pause-run-snapshot', ariaLabel: 'Current run snapshot' });
    for (const metric of [
      { label: 'SURVIVED', value: elapsedLabel },
      { label: 'LEVEL', value: String(runLevel) },
      { label: 'HEALTH', value: `${Math.max(0, Math.round(combat.health))} / ${Math.max(1, Math.round(combat.maxHealth ?? PLAYER_MAX_HEALTH))}` },
      { label: 'SCORE', value: Math.max(0, Math.round(combat.score)).toLocaleString() },
      { label: 'WEAPON', value: weaponTitle.toUpperCase(), wide: true },
    ]) {
      const item = el('div', { className: `pause-run-metric ${metric.wide ? 'is-wide' : ''}` });
      appendText(item, 'span', metric.label);
      appendText(item, 'strong', metric.value);
      snapshot.append(item);
    }
    shell.append(snapshot);

    const actionById = new Map(actions.map((action) => [action.id, action]));
    for (const group of menu.groups) {
      const groupActions = group.actionIds.map((id) => actionById.get(id)).filter(Boolean);
      if (!groupActions.length) continue;
      const section = el('section', { className: `pause-action-group pause-action-group-${group.id}` });
      appendText(section, 'p', group.label, 'pause-action-group-label');
      const controls = el('div', { className: 'pause-action-group-controls' });
      for (const action of groupActions) controls.append(buildActionButton(action));
      section.append(controls);
      shell.append(section);
    }
    dom.combatMenuActionGrid.append(shell);
    return;
  }

  for (const action of actions) {
    dom.combatMenuActionGrid.append(buildActionButton(action));
  }
}

function combatHudStatus() {
  if (combat.gameOver) return combat.clearedCampaignLevelId ? 'LEVEL CLEAR' : (combat.bossDefeated ? 'LEVEL CLEAR' : 'GAME OVER');
  if (combat.levelUpPaused) return `LEVEL ${combat.roguelikeRun?.level ?? 1} UP // PICK ONE AUGMENT // REROLLS ${combat.roguelikeRun?.rerollsRemaining ?? 0}`;
  if (combat.roguelikeRun) {
    const director = combat.roguelikeRun.spawnDirector ?? currentRoguelikeSpawnDirector(combat.elapsedGameSeconds);
    const level = currentCampaignLevel();
    const objective = currentCampaignObjective();
    return `${level.gameplayTitle.toUpperCase()} // ${director.difficultyLabel.toUpperCase()} // ${objective.shortLabel}`;
  }
  if (combat.paused) return 'PAUSED // OPTIONS OPEN';
  if (combat.scrollLockReason) return combat.scrollLockReason;
  if (combat.stagePhase === 'travel') {
    return `ADVANCE RIGHT // ${Math.round(combat.stageTravel)}/${Math.round(combat.stageTravelGoal)}M // BACKTRACK LIMIT ${LESTER_BLASTER_TACTICAL_CAMERA_MODEL.backwardAllowancePixels}px`;
  }
  return `STAGE ${combat.stageIndex} ${combat.stagePhase.toUpperCase()}`;
}

function renderCombatHudOverlay() {
  if (!dom.combatHudOverlay) return;
  // Roguelike runs use the single consolidated roguelike stat bar — rendering
  // BOTH bars stacked the same numbers twice and ate vertical space above the
  // game window. The widget grid only serves the legacy sandbox now.
  if (combat.roguelikeRun) {
    if (dom.combatHudOverlay.dataset.signature !== 'roguelike-hidden') {
      dom.combatHudOverlay.dataset.signature = 'roguelike-hidden';
      dom.combatHudOverlay.replaceChildren();
    }
    dom.combatHudOverlay.hidden = true;
    return;
  }
  dom.combatHudOverlay.hidden = false;
  const weapon = weaponById(combat.weaponId);
  const hud = buildCombatHudOverlayModel({
    health: combat.health,
    score: combat.score,
    elapsedSeconds: combat.elapsedGameSeconds,
    grenades: combat.grenades,
    ammo: combat.ammo,
    weaponTitle: weapon.title,
    powerUpsCollected: combat.powerUpsCollected,
    stageIndex: combat.stageIndex,
    stageCount: combat.stageCount,
    status: combatHudStatus(),
    fps: combat.fps,
  });
  const signature = `${hud.chrome.id}:` + hud.widgets.map((widget) => `${widget.id}:${widget.value}`).join('|');
  if (dom.combatHudOverlay.dataset.signature === signature) return;
  dom.combatHudOverlay.dataset.signature = signature;
  dom.combatHudOverlay.className = hud.className;
  dom.combatHudOverlay.dataset.uiChrome = hud.chrome.id;
  dom.combatHudOverlay.replaceChildren();
  for (const widget of hud.widgets) {
    const card = el('article', { className: 'hud-widget', dataset: { tone: widget.tone, widget: widget.id, ...(widget.dataset ?? {}) } });
    appendText(card, 'span', widget.label);
    appendText(card, 'strong', widget.value);
    dom.combatHudOverlay.append(card);
  }
}

// Roguelike run stats live in a DOM bar ABOVE the gameplay canvas (not painted on
// the canvas) so the game window stays fully visible. This replaces the old
// on-canvas drawHud stat panel.
function renderRoguelikeStatBar() {
  const bar = dom.roguelikeStatBar;
  if (!bar) return;
  const run = combat.roguelikeRun;
  const showBar = !!(run && (combat.active || combat.gameOver || combat.levelUpPaused || combat.paused));
  bar.hidden = !showBar;
  if (!showBar) {
    bar.dataset.signature = '';
    bar.replaceChildren();
    return;
  }
  const director = run.spawnDirector ?? currentRoguelikeSpawnDirector(combat.elapsedGameSeconds);
  const augments = Object.values(run.skills).reduce((sum, level) => sum + level, 0);
  const weapon = weaponById(combat.weaponId);
  const isMaxRoguelikeLevel = (run.maxLevelReached === true) || run.level >= ROGUELIKE_LEVEL_CAP;
  const xpToNext = isMaxRoguelikeLevel ? 0 : Math.max(0, Math.round(run.xpToNextLevel - run.xp));
  const xpRatio = isMaxRoguelikeLevel ? 1 : Math.max(0, Math.min(1, run.xp / Math.max(1, run.xpToNextLevel)));
  const heroName = (combat.characterId && CHARACTER_DISPLAY_NAMES[combat.characterId]) || 'Hero';
  const ammoValue = combat.reloading
    ? 'RELOAD…'
    : `${Math.max(0, combat.clip ?? 0)}/${combat.clipSize ?? 0}`;
  const objective = currentCampaignObjective();
  const level = currentCampaignLevel();
  const guidance = extractionGuidance();
  const activePoi = currentCampaignPoi();
  const activeEncounterVisualPlan = combat.activePoiEncounterVisualPlan ?? null;
  const environmentState = currentEnvironmentState();
  const readability = currentReadabilityProfile(environmentState);
  const ambientZone = currentAmbientZoneModel(environmentState);
  const terrainPressure = combat.activePoiEncounterId
    ? buildEncounterTerrainPressure({
        poiId: combat.activePoiEncounterId,
        centerX: combat.activePoiEncounterCenterX ?? combat.playerMapX,
        centerY: combat.activePoiEncounterCenterY ?? combat.playerMapY,
        playerX: combat.playerMapX,
        playerY: combat.playerMapY,
      })
    : { moveSpeedMul: 1, hazardId: null, label: null };
  const routeWorldState = level.id === DEFAULT_CAMPAIGN_LEVEL_ID
    ? levelOneAaaRouteWorldStateAt({
        elapsedSeconds: combat.elapsedGameSeconds,
        bossDefeated: combat.bossDefeated,
        extractionPoint: combat.extractionPoint,
      })
    : null;
  const routePacing = level.id === DEFAULT_CAMPAIGN_LEVEL_ID ? currentLevelOneRoutePacing() : null;
  const objectiveHud = levelOneRouteObjectiveHudState({
    routePacing,
    poiDirective: guidance ? null : activePoi,
    fallbackLabel: guidance?.label ?? routeWorldState?.statusLabel ?? objective.shortLabel,
    fallbackTone: guidance ? 'orange' : (routeWorldState?.tone ?? 'cyan'),
  });
  const threatTone = director.pressure >= 0.8 ? 'red' : director.pressure >= 0.6 ? 'orange' : 'cyan';
  const grenadeType = resolveGrenadeTypeForRun(run);
  const stats = [
    { id: 'survived', label: 'SURVIVED', value: formatSeconds(combat.elapsedGameSeconds), tone: threatTone },
    { id: 'level', label: 'LEVEL', value: `${level.number} · ${director.difficultyLabel.toUpperCase()}`, tone: 'cyan' },
    { id: 'obj', label: 'OBJECTIVE', value: objectiveHud.label, tone: objectiveHud.tone, directional: objectiveHud.directional },
    { id: 'hp', label: 'HP', value: `${Math.max(0, Math.round(combat.health))}/${Math.max(1, Math.round(combat.maxHealth ?? PLAYER_MAX_HEALTH))}`, tone: 'red' },
    { id: 'score', label: 'SCORE', value: Math.round(combat.score).toLocaleString(), tone: 'gold' },
    { id: 'kills', label: 'KILLS', value: `${combat.kills}`, tone: 'gold' },
    { id: 'rank', label: 'RANK', value: `${run.level}`, tone: 'green' },
    { id: 'seed', label: 'SEED', value: `${run.seed}`, tone: 'cyan' },
    { id: 'wpn', label: 'WEAPON', value: (weapon.displayName ?? weapon.title).toUpperCase(), tone: 'green' },
    { id: 'ammo', label: 'AMMO', value: ammoValue, tone: combat.reloading ? 'orange' : 'green' },
    { id: 'thrown', label: 'NADES', value: `💣${combat.grenades}/${grenadeCapacityForRun(run)} ${grenadeType.title.toUpperCase()}`, tone: 'orange' },
    { id: 'aug', label: 'AUG', value: `${augments} · ⟳${run.rerollsRemaining}`, tone: 'orange' },
  ];
  const activeFx = [];
  const synergyHud = buildRoguelikeSynergyHudModel(run);
  if (run.powerMoments?.lastMoment?.banner) activeFx.push(`POWER MOMENT ${run.powerMoments.lastMoment.banner}`);
  for (const chip of synergyHud.chips.filter((candidate) => ['ready', 'evolved', 'near'].includes(candidate.status)).slice(0, 3)) {
    activeFx.push(`${chip.status === 'evolved' ? 'EVOLVED' : chip.status === 'ready' ? 'GOLDEN READY' : 'SYNERGY'} ${chip.title.toUpperCase()}`);
  }
  if (guidance) activeFx.push(`GUIDE ${guidance.label}`);
  else if (activePoi && level.id !== DEFAULT_CAMPAIGN_LEVEL_ID) activeFx.push(`POI ${activePoi.label}`);
  else if (!objectiveHud.directional && objectiveHud.phase === 'travel') activeFx.push(objective.label.toUpperCase());
  if (routeWorldState?.hudChip) activeFx.push(routeWorldState.hudChip);
  if (routeWorldState?.ctaLabel) activeFx.push(routeWorldState.ctaLabel);
  if (activeEncounterVisualPlan?.banner) activeFx.push(`ARENA ${activeEncounterVisualPlan.banner}`);
  if (terrainPressure?.label) activeFx.push(`TERRAIN ${terrainPressure.label}`);
  const levelOneInteractivePressure = currentLevelOneInteractiveHazardPressure();
  if (levelOneInteractivePressure?.label) activeFx.push(`HAZARD ${levelOneInteractivePressure.label.toUpperCase()}`);
  const interactionPrompt = currentLevelOneInteractionPrompt();
  if (interactionPrompt?.label) activeFx.push(interactionPrompt.label.toUpperCase());
  activeFx.push(`WEATHER ${environmentState.weather.label.toUpperCase()}`);
  activeFx.push(`TOD ${environmentState.timeOfDay.phase.toUpperCase()}`);
  if (ambientZone?.poiTensionCue) activeFx.push(`ZONE ${ambientZone.poiTensionCue.toUpperCase()}`);
  if ((combat.powerUpTimers.magnet ?? 0) > 0) activeFx.push(`MAGNET ${Math.ceil(combat.powerUpTimers.magnet)}s`);
  if ((combat.powerUpTimers.slowEnemies ?? 0) > 0) activeFx.push(`SLOW ${Math.ceil(combat.powerUpTimers.slowEnemies)}s`);
  if ((combat.powerUpTimers.berserk ?? 0) > 0) activeFx.push(`BERSERK ${Math.ceil(combat.powerUpTimers.berserk)}s`);
  if ((combat.powerUpTimers.weapon ?? 0) > 0 && combat.weaponId !== 'coin-blaster') activeFx.push(`${(weapon.displayName ?? weapon.title).toUpperCase()} ${Math.ceil(combat.powerUpTimers.weapon)}s`);
  const signature = `${heroName}|${stats.map((s) => s.value).join('|')}|xp${Math.round(xpRatio * 100)}|${activeFx.join(',')}|cb${gameSettings.colorblindTags ? 1 : 0}`;
  if (bar.dataset.signature === signature) return;
  bar.dataset.signature = signature;
  bar.replaceChildren();
  const heroChip = el('span', { className: 'stat-hero', dataset: { uiChrome: 'combat-hud-frame' } });
  heroChip.textContent = heroName;
  bar.append(heroChip);
  const chips = el('div', { className: 'stat-chips' });
  for (const s of stats) {
    const chip = el('div', { className: 'stat-chip', dataset: { tone: s.tone, stat: s.id } });
    if (s.directional) chip.dataset.directional = 'true';
    appendText(chip, 'span', s.label);
    appendText(chip, 'strong', s.value);
    if (gameSettings.colorblindTags) appendText(chip, 'small', `Tone ${String(s.tone).toUpperCase()}`, 'stat-tone-tag');
    chips.append(chip);
  }
  bar.append(chips);

  const xpWrap = el('div', { className: 'stat-xp' });
  appendText(xpWrap, 'span', isMaxRoguelikeLevel
    ? `MAX LEVEL — XP → SCORE +${Math.round(run.postCapScoreBonus ?? 0).toLocaleString()}`
    : `XP ${xpToNext} to LV ${run.level + 1}`);
  const track = el('div', { className: 'stat-xp-track' });
  const fill = el('div', { className: 'stat-xp-fill' });
  fill.style.width = `${Math.round(xpRatio * 100)}%`;
  track.append(fill);
  xpWrap.append(track);
  bar.append(xpWrap);
  if (activeFx.length) {
    const fxWrap = el('div', { className: 'stat-fx' });
    for (const f of activeFx) {
      const chip = el('span', { textContent: f });
      if (gameSettings.colorblindTags) chip.setAttribute('title', 'Colorblind-friendly tag enabled');
      fxWrap.append(chip);
    }
    bar.append(fxWrap);
  }
}

function renderTacticalBalanceDebugOverlay() {
  if (!dom.tacticalBalanceDebugOverlay) return;
  const overlay = buildTacticalBalanceDebugOverlayModel({
    debugEnabled: tacticalBalanceDebugEnabled,
    playerX: combat.playerX,
    scroll: combat.scroll,
    furthestScroll: combat.furthestScroll,
    stagePhase: combat.stagePhase,
    scrollLocked: Boolean(combat.scrollLockReason),
    stageTravel: combat.stageTravel,
    stageTravelGoal: combat.stageTravelGoal,
    enemies: combat.enemies,
    props: [...combat.props, ...combat.hazards, ...combat.platforms],
    groundRender: combat.groundRenderStats,
  });
  dom.tacticalBalanceDebugOverlay.hidden = !(overlay.enabled && (combat.active || combat.gameOver));
  dom.tacticalBalanceDebugOverlay.dataset.enabled = String(overlay.enabled);
  dom.tacticalBalanceDebugOverlay.dataset.query = DEBUG_BALANCE_QUERY;
  if (dom.tacticalBalanceDebugOverlay.hidden) {
    delete dom.tacticalBalanceDebugOverlay.dataset.signature;
    dom.tacticalBalanceDebugOverlay.replaceChildren();
    return;
  }
  const signature = JSON.stringify(overlay.metrics);
  if (dom.tacticalBalanceDebugOverlay.dataset.signature === signature) return;
  dom.tacticalBalanceDebugOverlay.dataset.signature = signature;
  dom.tacticalBalanceDebugOverlay.replaceChildren();
  appendText(dom.tacticalBalanceDebugOverlay, 'strong', 'DEV BALANCE // F10');
  appendText(dom.tacticalBalanceDebugOverlay, 'span', DEBUG_BALANCE_QUERY);
  for (const layer of overlay.layers) {
    const section = el('section', { className: 'debug-layer', dataset: { layer: layer.id } });
    appendText(section, 'b', layer.label);
    const list = el('ul');
    for (const item of layer.items) appendText(list, 'li', item);
    section.append(list);
    dom.tacticalBalanceDebugOverlay.append(section);
  }
}

function clearInactiveCombatOverlay() {
  if (combat.active || combat.gameOver) return false;
  if (dom.combatMenuPanel) {
    dom.combatMenuPanel.hidden = true;
    dom.combatMenuPanel.dataset.state = 'inactive';
  }
  if (dom.combatHudOverlay) {
    delete dom.combatHudOverlay.dataset.signature;
    dom.combatHudOverlay.replaceChildren();
  }
  if (dom.combatMenuActionGrid) {
    delete dom.combatMenuActionGrid.dataset.signature;
    dom.combatMenuActionGrid.replaceChildren();
  }
  if (dom.combatGameOverSummary) {
    dom.combatGameOverSummary.hidden = true;
    dom.combatGameOverSummary.replaceChildren();
  }
  if (dom.tacticalBalanceDebugOverlay) {
    dom.tacticalBalanceDebugOverlay.hidden = true;
    delete dom.tacticalBalanceDebugOverlay.dataset.signature;
    dom.tacticalBalanceDebugOverlay.replaceChildren();
  }
  if (dom.combatMenuTitle) dom.combatMenuTitle.textContent = '';
  if (dom.combatMenuCopy) dom.combatMenuCopy.textContent = '';
  if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = '';
  return true;
}

function syncCombatOverlay() {
  if (combat.levelUpPaused) document.documentElement.dataset.levelUp = 'true';
  else delete document.documentElement.dataset.levelUp;
  const gameplayPauseSurface = officialAppStep === 'gameplay'
    && combat.paused
    && !combat.pendingBegin
    && !combat.levelUpPaused
    && !combat.gameOver;
  if (gameplayPauseSurface) document.documentElement.dataset.gameplayPaused = 'true';
  else delete document.documentElement.dataset.gameplayPaused;
  renderArcadeMusicPlayer();
  const menuOwnsFocus = !combat.pendingBegin && Boolean(combat.paused || combat.gameOver || combat.levelUpPaused);
  document.body.classList.toggle('hide-rotate-hint', menuOwnsFocus);
  // Chikun owns its pause UI and result lifecycle. Shared music controls must
  // not create the legacy combat menu over the child iframe.
  if (chikunActive) {
    if (dom.combatMenuPanel) dom.combatMenuPanel.hidden = true;
    return;
  }
  // Auto-submit a finished ranked run to LitVM the moment the game-over state
  // is reached (no manual "Submit Official Score" step). One wallet confirmation
  // fires automatically. Guarded by gameOverSubmitted so it runs exactly once.
  if (combat.gameOver && currentSession?.isPaid && !combat.gameOverSubmitted) {
    submitCombatGameOver();
  }
  if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = gameplaySyncCopy();
  if (dom.officialCombatMount) {
    dom.officialCombatMount.dataset.viewport = combat.viewportMode;
    dom.officialCombatMount.dataset.paused = String(combat.paused);
    dom.officialCombatMount.dataset.gameOver = String(combat.gameOver);
  }
  if (dom.officialGameplayControls) dom.officialGameplayControls.dataset.mode = currentSession?.mode ?? 'free';
  if (dom.combatPauseButton) dom.combatPauseButton.textContent = combat.paused ? 'Return to Game' : 'Pause';
  if (dom.combatMenuIconButton) {
    setButtonIcon(dom.combatMenuIconButton, combat.paused ? 'play' : 'menu');
    dom.combatMenuIconButton.setAttribute('aria-label', combat.paused ? 'Resume game' : 'Pause and open game menu');
    dom.combatMenuIconButton.setAttribute('aria-expanded', String(Boolean(combat.paused)));
  }
  if (dom.combatRestartButton) dom.combatRestartButton.textContent = currentSession?.isPaid ? 'Restart (New Credit)' : 'Restart Free';
  if (dom.combatMusicButton) dom.combatMusicButton.textContent = combat.musicEnabled ? 'Music On' : 'Music Off';
  if (dom.combatShakeButton) dom.combatShakeButton.textContent = gameSettings.screenShake ? 'Shake On' : 'Shake Off';
  if (dom.combatGoreButton) dom.combatGoreButton.textContent = gameSettings.gore ? 'Gore On' : 'Gore Off';
  if (dom.combatCharacterButton) {
    // Character choice now lives on the dedicated character-select screen.
    dom.combatCharacterButton.hidden = true;
  }
  if (dom.combatViewportButton) {
    let label = 'Fullscreen';
    if (combat.viewportMode === 'fullscreen') {
      label = 'Exit Fullscreen';
    } else if (combat.viewportMode === 'expanded-fullscreen') {
      label = 'Exit Expanded';
    }
    dom.combatViewportButton.textContent = label;
  }
  if (clearInactiveCombatOverlay()) return;
  if (dom.combatMenuPanel) {
    // While the READY pre-start overlay is up (combat.pendingBegin) the run is
    // technically paused, but showing the pause menu UNDER the ready overlay
    // reads as a broken double-menu. Keep it hidden until the player begins.
    dom.combatMenuPanel.hidden = combat.pendingBegin || !(combat.paused || combat.gameOver || combat.levelUpPaused);
    const levelUpEl = document.getElementById('levelUpOverlay');
    if (levelUpEl) levelUpEl.hidden = !combat.levelUpPaused;
    dom.combatMenuPanel.dataset.state = combat.gameOver ? 'game-over' : combat.levelUpPaused ? 'level-up' : 'paused';
  }
  if (combat.pendingBegin || !(combat.paused || combat.gameOver || combat.levelUpPaused)) {
    combat.menuSettingsOpen = false;
  }
  const menu = buildCombatOptionsMenuModel({
    paused: combat.paused,
    gameOver: combat.gameOver,
    musicEnabled: combat.musicEnabled,
    viewportMode: combat.viewportMode,
    currentMode: currentSession?.mode ?? officialSelectedMode ?? 'free',
    officialScoreSubmitted: lastSettlementSucceeded,
    officialSubmissionEnabled: SETTLEMENT_LIVE && (lastSettlementSucceeded || rankedPublishRetryAvailable()),
  });
  const menuEyebrow = dom.combatMenuPanel?.querySelector(':scope > .eyebrow');
  if (menuEyebrow) menuEyebrow.textContent = combat.levelUpPaused ? 'LEVEL UP' : menu.kicker;
  if (dom.combatMenuTitle) dom.combatMenuTitle.textContent = combat.levelUpPaused ? `Level ${combat.roguelikeRun?.level ?? 1} Upgrade` : menu.title;
  if (dom.combatMenuCopy) {
    dom.combatMenuCopy.textContent = combat.gameOver
      ? `${gameOverReasonCopy(combat.gameOverReason)} Score ${combat.score.toLocaleString()} // ${combat.kills} enemies cleared. Play Again starts a fresh ${currentSession?.isPaid ? (SETTLEMENT_LIVE ? 'verified Ranked session' : 'local Ranked preview') : 'Free practice run'}.`
      : combat.levelUpPaused
        ? 'The isometric roguelike run is paused. Pick one of two guided augments: continue your build or start a new tree. Reroll refreshes both slots.'
        : menu.copy;
  }
  renderCombatHudOverlay();
  renderRoguelikeStatBar();
  renderTacticalBalanceDebugOverlay();
  renderGameOverSummary();
  renderCombatMenuActionGrid();
  renderCombatSettingsPanel();
}

async function toggleCombatPause(forcePaused) {
  if (hmhRebootActive) {
    const nextPaused = typeof forcePaused === 'boolean' ? forcePaused : !combat.paused;
    combat.paused = nextPaused;
    if (nextPaused) hmhRebootHost?.pause();
    else hmhRebootHost?.resume();
    if (nextPaused) pauseCombatMusic();
    else {
      combat.menuSettingsOpen = false;
      if (combat.musicEnabled) ensureCombatMusic('gameplay');
    }
    playSfxCue(nextPaused ? 'pause' : 'resume');
    syncCombatOverlay();
    return;
  }
  if (!combat.active && !combat.gameOver) return;
  combat.paused = typeof forcePaused === 'boolean' ? forcePaused : !combat.paused;
  if (!combat.paused) combat.menuSettingsOpen = false;
  playSfxCue(combat.paused ? 'pause' : 'resume');
  // SDK adapter: emit pause/resume lifecycle.
  if (gameAdapter) {
    if (combat.paused) gameAdapter.pause();
    else gameAdapter.resume();
  }
  // Audio rides the unified pause gate: combat music idles while paused and
  // resumes on unpause (respecting the player's music on/off + mute choice).
  const gate = buildCombatPauseGate({
    active: combat.active,
    paused: combat.paused,
    levelUpPaused: combat.levelUpPaused,
    gameOver: combat.gameOver,
    pendingBegin: combat.pendingBegin,
  });
  if (gate.audioPaused) {
    pauseCombatMusic();
  } else if (combat.musicEnabled) {
    ensureCombatMusic('gameplay');
  }
  if (combat.paused) spawnText('PAUSED', 350, 132, '#ffe84d');
  syncCombatOverlay();
}

function toggleCombatShakeSetting() {
  gameSettings.screenShake = !gameSettings.screenShake;
  if (!gameSettings.screenShake) combat.shake = 0;
  saveGameSettings();
  applyGameplayAccessibilitySettings();
  pushHmhRebootSettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function toggleCombatGoreSetting() {
  gameSettings.gore = !gameSettings.gore;
  saveGameSettings();
  pushHmhRebootSettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function toggleCombatReduceMotionSetting() {
  gameSettings.reduceMotion = !gameSettings.reduceMotion;
  if (gameSettings.reduceMotion) combat.shake = 0;
  saveGameSettings();
  applyGameplayAccessibilitySettings();
  pushHmhRebootSettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function toggleCombatReduceFlashSetting() {
  gameSettings.reduceFlash = !gameSettings.reduceFlash;
  saveGameSettings();
  applyGameplayAccessibilitySettings();
  pushHmhRebootSettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function toggleCombatColorblindTagsSetting() {
  gameSettings.colorblindTags = !gameSettings.colorblindTags;
  saveGameSettings();
  applyGameplayAccessibilitySettings();
  pushHmhRebootSettings();
  playSfxCue('menu-click');
  renderRoguelikeStatBar();
  syncCombatOverlay();
}

function toggleCombatAutoAimSetting() {
  gameSettings.autoAimAssist = !gameSettings.autoAimAssist;
  saveGameSettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function toggleAutoEnterFullscreenSetting() {
  gameSettings.autoEnterFullscreen = !gameSettings.autoEnterFullscreen;
  saveGameSettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function toggleTouchHandednessSetting() {
  gameSettings.touchLeftHanded = !gameSettings.touchLeftHanded;
  saveGameSettings();
  applyGameplayAccessibilitySettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function cycleTouchOpacitySetting() {
  const current = Number(gameSettings.touchControlOpacity) || 0.4;
  gameSettings.touchControlOpacity = current < 0.36 ? 0.4 : current < 0.46 ? 0.55 : 0.32;
  saveGameSettings();
  applyGameplayAccessibilitySettings();
  playSfxCue('menu-click');
  syncCombatOverlay();
}

function toggleCombatSettingsPanel() {
  combat.menuSettingsOpen = !combat.menuSettingsOpen;
  syncCombatOverlay();
}

function renderCombatSettingsPanel() {
  if (!dom.combatSettingsPanel) return;
  const shouldShow = combat.menuSettingsOpen && !combat.pendingBegin && (combat.paused || combat.gameOver || combat.levelUpPaused);
  dom.combatSettingsPanel.hidden = !shouldShow;
  if (!shouldShow) {
    dom.combatSettingsPanel.replaceChildren();
    return;
  }
  const quickTitle = el('h4', { className: 'combat-settings-title', textContent: 'Settings' });
  const quickCopy = el('p', { className: 'combat-settings-copy', textContent: 'Quick gameplay toggles plus accessibility controls without leaving the run.' });
  const quickGrid = el('div', { className: 'combat-settings-grid' });
  const quickActions = [
    { id: 'music', icon: combat.musicEnabled ? 'volume' : 'mute', label: combat.musicEnabled ? 'Music On' : 'Music Off', description: 'Toggle the run soundtrack without muting combat feedback.', run: toggleCombatMusic },
    { id: 'gore', icon: 'status', label: gameSettings.gore ? 'Gore On' : 'Gore Off', description: 'Toggle blood and impact debris while preserving hit readability.', run: toggleCombatGoreSetting },
    { id: 'viewport', icon: 'fullscreen', label: combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen' ? 'Windowed Mode' : 'Full Screen', description: 'Switch between the focused game view and the browser window.', run: cycleCombatViewport },
    { id: 'auto-fullscreen', icon: 'settings', label: gameSettings.autoEnterFullscreen ? 'Auto Fullscreen On' : 'Auto Fullscreen Off', description: 'Choose whether READY automatically requests fullscreen.', run: toggleAutoEnterFullscreenSetting },
  ];
  for (const action of quickActions) {
    const button = el('button', { className: 'combat-menu-action combat-settings-action', type: 'button', dataset: { action: action.id, tooltip: action.description } });
    const copy = el('span', { className: 'combat-settings-action-copy' });
    copy.append(el('strong', { textContent: action.label }), el('span', { className: 'combat-settings-action-desc', textContent: action.description }));
    button.append(renderArcadeIcon(action.icon, action.label), copy);
    button.title = action.description;
    button.setAttribute('aria-label', `${action.label}. ${action.description}`);
    button.addEventListener('click', () => action.run());
    quickGrid.append(button);
  }

  const tuningTitle = el('h4', { className: 'combat-settings-title', textContent: 'Audio & Input' });
  const tuningCopy = el('p', { className: 'combat-settings-copy', textContent: 'Bounded runtime controls. Changes persist to this browser and are projected into the active child session.' });
  const tuningGrid = el('div', { className: 'combat-settings-range-grid' });
  const tuningSettings = [
    { domain: 'audio', key: 'musicVolume', label: 'Music', min: 0, max: 1, step: 0.05 },
    { domain: 'audio', key: 'sfxVolume', label: 'SFX', min: 0, max: 1, step: 0.05 },
    { domain: 'audio', key: 'uiVolume', label: 'UI cues', min: 0, max: 1, step: 0.05 },
    { domain: 'controls', key: 'gamepadDeadzone', label: 'Gamepad deadzone', min: 0.05, max: 0.45, step: 0.01 },
    { domain: 'controls', key: 'gamepadSensitivity', label: 'Gamepad sensitivity', min: 0.5, max: 2, step: 0.05 },
    { domain: 'controls', key: 'touchSensitivity', label: 'Touch sensitivity', min: 0.5, max: 2, step: 0.05 },
    { domain: 'controls', key: 'touchScale', label: 'Touch scale', min: 0.75, max: 1.5, step: 0.05 },
    { domain: 'controls', key: 'aimAssistStrength', label: 'Aim assist', min: 0, max: 1, step: 0.05 },
    { domain: 'accessibility', key: 'hudScale', label: 'HUD scale', min: 0.75, max: 1.3, step: 0.05 },
  ];
  for (const setting of tuningSettings) {
    const row = el('label', { className: 'combat-setting-range' });
    const name = el('span', { textContent: setting.label });
    const output = el('output', { textContent: Number(hmhPlayerSettings[setting.domain][setting.key]).toFixed(2) });
    const input = el('input', { type: 'range' });
    input.min = String(setting.min);
    input.max = String(setting.max);
    input.step = String(setting.step);
    input.value = String(hmhPlayerSettings[setting.domain][setting.key]);
    input.setAttribute('aria-label', setting.label);
    input.addEventListener('input', () => {
      hmhPlayerSettings = normalizeHmhPlayerSettings({
        ...hmhPlayerSettings,
        [setting.domain]: { ...hmhPlayerSettings[setting.domain], [setting.key]: Number(input.value) },
      });
      applyHmhSettingsCompatibilityView(hmhPlayerSettings);
      persistHmhPlayerSettings();
      applyHmhAudioSettings();
      applyGameplayAccessibilitySettings();
      pushHmhRebootSettings();
      output.textContent = Number(input.value).toFixed(2);
    });
    row.append(name, output, input);
    tuningGrid.append(row);
  }
  const controlSummary = el('p', {
    className: 'combat-settings-copy combat-control-summary',
    textContent: `Keyboard: ${Object.entries(hmhPlayerSettings.controls.keyboardBindings).map(([action, code]) => `${action} ${code}`).join(' · ')}. Rebind from the in-game pause panel; ranked bindings are locked.`,
  });

  const accessibility = buildCombatAccessibilitySettingsModel({
    reduceMotion: gameSettings.reduceMotion,
    screenShake: gameSettings.screenShake,
    reduceFlash: gameSettings.reduceFlash,
    colorblindTags: gameSettings.colorblindTags,
    autoAimAssist: gameSettings.autoAimAssist,
  });
  const accessibilityTitle = el('h4', { className: 'combat-settings-title', textContent: accessibility.title });
  const accessibilityCopy = el('p', { className: 'combat-settings-copy', textContent: accessibility.copy });
  const accessibilityGrid = el('div', { className: 'combat-settings-grid combat-accessibility-grid' });
  const actionMap = {
    'toggle-reduce-motion': toggleCombatReduceMotionSetting,
    'toggle-screen-shake': toggleCombatShakeSetting,
    'toggle-reduce-flash': toggleCombatReduceFlashSetting,
    'toggle-colorblind-tags': toggleCombatColorblindTagsSetting,
    'toggle-auto-aim': toggleCombatAutoAimSetting,
  };
  for (const action of accessibility.actions) {
    const button = el('button', { className: 'combat-menu-action combat-settings-action combat-accessibility-action', type: 'button', dataset: { action: action.id, tooltip: action.description } });
    const label = el('strong', { textContent: action.label });
    const desc = el('span', { className: 'combat-settings-action-desc', textContent: action.description });
    const copy = el('span', { className: 'combat-settings-action-copy' });
    copy.append(label, desc);
    button.append(renderArcadeIcon('status', action.label), copy);
    button.title = action.description;
    button.setAttribute('aria-label', `${action.label}. ${action.description}`);
    button.addEventListener('click', () => actionMap[action.id]?.());
    accessibilityGrid.append(button);
  }
  const touchTitle = el('h4', { className: 'combat-settings-title', textContent: 'Touch Controls' });
  const touchCopy = el('p', { className: 'combat-settings-copy', textContent: 'Thumb-arc layout options for mobile: mirror the sticks or lower overlay opacity.' });
  const touchGrid = el('div', { className: 'combat-settings-grid combat-touch-settings-grid' });
  const touchLayout = buildTouchControlLayout({ leftHanded: gameSettings.touchLeftHanded, opacity: gameSettings.touchControlOpacity, orientation: deviceState.profile?.orientation ?? 'landscape' });
  const touchActions = [
    { id: 'toggle-touch-handedness', label: touchLayout.leftHanded ? 'Left-Handed On' : 'Left-Handed Off', description: touchLayout.leftHanded ? 'Movement on right, aim/actions on left.' : 'Movement on left, aim/actions on right.', run: toggleTouchHandednessSetting },
    { id: 'cycle-touch-opacity', label: `Opacity ${Math.round(touchLayout.idleOpacity * 100)}%`, description: `Idle ${Math.round(touchLayout.idleOpacity * 100)}%, touched ${Math.round(touchLayout.activeOpacity * 100)}%.`, run: cycleTouchOpacitySetting },
  ];
  for (const action of touchActions) {
    const button = el('button', { className: 'combat-menu-action combat-settings-action combat-touch-setting-action', type: 'button', dataset: { action: action.id, tooltip: action.description } });
    const copy = el('span', { className: 'combat-settings-action-copy' });
    copy.append(el('strong', { textContent: action.label }), el('span', { className: 'combat-settings-action-desc', textContent: action.description }));
    button.append(renderArcadeIcon('control', action.label), copy);
    button.title = action.description;
    button.setAttribute('aria-label', `${action.label}. ${action.description}`);
    button.addEventListener('click', () => action.run());
    touchGrid.append(button);
  }
  dom.combatSettingsPanel.replaceChildren(quickTitle, quickCopy, quickGrid, tuningTitle, tuningCopy, tuningGrid, controlSummary, accessibilityTitle, accessibilityCopy, accessibilityGrid, touchTitle, touchCopy, touchGrid);
}

async function restartCombatRun() {
  playSfxCue('level-start');
  // A16: a Ranked restart always pays a fresh entry. startOfficialMode shows
  // the Ranked modal (preview approves without payment); the finished run
  // stays on screen if the player cancels. Reboot and legacy runs alike.
  if (currentSession?.isPaid || officialSelectedMode === 'ranked') {
    await startOfficialMode('ranked');
    return;
  }
  if (hmhRebootActive) {
    void startArcadeMusicForGame('hard-money-heroes');
    lastHmhRunSummary = null;
    currentSession = beginTrackedSession({ mode: 'free' });
    gameAdapter?.teardown?.();
    gameAdapter = createInProcessGameAdapter({
      gameId: 'hard-money-heroes',
      sessionId: currentSession.sessionId,
      rankedEligible: currentSession.isPaid,
    });
    gameAdapter.start({ mode: currentSession.isPaid ? 'ranked' : 'free', characterId: hmhRebootHeroId() });
    combat.paused = false;
    combat.gameOver = false;
    combat.gameOverSubmitted = false;
    combat.score = 0;
    combat.kills = 0;
    combat.elapsedGameSeconds = 0;
    mountHmhRebootSession();
    renderOfficialRunStatus();
    syncCombatOverlay();
    return;
  }
  dom.combatStatus.textContent = 'Free practice restarted from Level 1 Stage 1. No profile, leaderboard, transaction, or ranked state is written.';
  currentSession = beginTrackedSession({ mode: 'free' });
  await startCombat();
  combat.paused = false;
  renderOfficialRunStatus();
  syncCombatOverlay();
}

function toggleCombatMusic() {
  const musicOn = toggleArcadeMusicMute();
  combat.musicEnabled = musicOn;
  pushHmhRebootSettings();
  playSfxCue('menu-click');
  spawnText(musicOn ? 'MUSIC ON' : 'MUSIC MUTED', combat.playerX + 24, combat.playerY - 92, musicOn ? '#45ff8a' : '#ff476f');
  syncCombatOverlay();
}

function switchHero() {
  // Both heroes are playable now — bounce back to the character-select screen so
  // the player can pick Lit Commando or Lit Valkyrie for their next run.
  playSfxCue('menu-click');
  setOfficialView('character-select');
}

function resizeCombatCanvas() {
  const canvas = dom.combatCanvas;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const performanceDpr = combatCanvasRenderScale({
    cssWidth: rect.width,
    cssHeight: rect.height,
    devicePixelRatio: window.devicePixelRatio || 1,
  });
  const fit = computeCombatViewportFit({
    cssWidth: rect.width,
    cssHeight: rect.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    maxDevicePixelRatio: performanceDpr,
  });
  const targetWidth = fit.backingStore.width;
  const targetHeight = fit.backingStore.height;
  canvas.dataset.orientation = fit.orientation;
  canvas.dataset.worldZoom = String(fit.worldZoom);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
}

function scheduleCombatViewportRelayout(delayMs = 0) {
  const relayout = () => {
    resizeCombatCanvas();
    requestAnimationFrame(() => resizeCombatCanvas());
  };
  relayout();
  if (delayMs > 0) setTimeout(relayout, delayMs);
}

function fullscreenEnvironment() {
  const target = dom.officialGameplay ?? dom.officialCombatMount ?? dom.combatCanvas;
  const standalone = Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator?.standalone,
  );
  const isIos = /iPad|iPhone|iPod/.test(window.navigator?.userAgent ?? '')
    || (window.navigator?.platform === 'MacIntel' && (window.navigator?.maxTouchPoints ?? 0) > 1);
  return {
    target,
    capability: browserFullscreenCapability({
      hasRequestFullscreen: Boolean(target?.requestFullscreen),
      standalone,
      isIos,
    }),
  };
}

function showIosFullscreenInstallTip() {
  const storageKey = 'hmh-ios-fullscreen-tip-dismissed';
  try {
    if (localStorage.getItem(storageKey) === 'true') return;
  } catch { /* storage may be unavailable */ }
  if (document.getElementById('hmhIosFullscreenTip')) return;
  const tip = el('aside', {
    id: 'hmhIosFullscreenTip',
    className: 'fullscreen-install-tip',
    role: 'status',
    ariaLive: 'polite',
  });
  appendText(tip, 'strong', 'Want true fullscreen on iPhone or iPad?');
  appendText(tip, 'span', 'Use Share → Add to Home Screen. Safari play still fills the visible viewport and respects safe areas.');
  const dismiss = el('button', { type: 'button', className: 'ghost-button', textContent: 'Got it' });
  dismiss.addEventListener('click', () => {
    try { localStorage.setItem(storageKey, 'true'); } catch { /* storage may be unavailable */ }
    tip.remove();
  });
  tip.append(dismiss);
  (dom.officialCombatMount ?? document.body).append(tip);
}

async function requestCombatFullscreen() {
  const { target, capability } = fullscreenEnvironment();
  const screenWidth = window.screen?.width ?? window.innerWidth;
  const screenHeight = window.screen?.height ?? window.innerHeight;
  const model = buildFullscreenViewportModel({
    mode: 'fullscreen',
    fullscreenElementActive: Boolean(document.fullscreenElement),
    screenWidth,
    screenHeight,
  });
  combat.viewportMode = 'fullscreen';
  dom.officialCombatMount?.style.setProperty('--combat-fullscreen-width', `${model.devicePixels.width}px`);
  dom.officialCombatMount?.style.setProperty('--combat-fullscreen-height', `${model.devicePixels.height}px`);
  if (!capability.canEnter) {
    combat.viewportMode = 'expanded-fullscreen';
    combat.status = capability.mode === 'standalone'
      ? 'Standalone play is already chromeless. The combat canvas is fitted to the full app viewport.'
      : 'Browser element fullscreen is unavailable. The combat canvas is fitted to the full visible viewport.';
    if (capability.showInstallTip) showIosFullscreenInstallTip();
    scheduleCombatViewportRelayout(120);
    syncCombatOverlay();
    return;
  }
  try {
    if (!document.fullscreenElement && target?.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' });
      // Resize canvas after fullscreen transition completes.
      scheduleCombatViewportRelayout(120);
    }
  } catch (error) {
    combat.viewportMode = 'expanded-fullscreen';
    combat.status = `Browser fullscreen was blocked, so the combat canvas expanded inside the page: ${error?.message ?? 'request failed'}`;
    if (dom.combatStatus) dom.combatStatus.textContent = combat.status;
    spawnText('FULLSCREEN BLOCKED', combat.playerX + 4, combat.playerY - 96, '#ff476f');
    scheduleCombatViewportRelayout(120);
  }
  syncCombatOverlay();
}

async function exitCombatFullscreen() {
  const model = buildFullscreenViewportModel({
    mode: 'windowed',
    fullscreenElementActive: Boolean(document.fullscreenElement),
    screenWidth: window.screen?.width ?? window.innerWidth,
    screenHeight: window.screen?.height ?? window.innerHeight,
  });
  combat.viewportMode = 'windowed';
  try {
    if (model.browserApiAction === 'exitFullscreen' && document.exitFullscreen) await document.exitFullscreen();
  } catch (error) {
    combat.status = `Fullscreen exit failed: ${error?.message ?? 'browser request failed'}`;
    if (dom.combatStatus) dom.combatStatus.textContent = combat.status;
  }
  // Force immediate + settled resize to windowed dimensions using the model.
  scheduleCombatViewportRelayout(120);
  // Apply the windowed model dimensions to the combat mount
  if (dom.officialCombatMount) {
    dom.officialCombatMount.style.setProperty('--combat-fullscreen-width', `${model.devicePixels.width}px`);
    dom.officialCombatMount.style.setProperty('--combat-fullscreen-height', `${model.devicePixels.height}px`);
  }
  syncCombatOverlay();
}

async function cycleCombatViewport() {
  playSfxCue('menu-click');
  if (document.fullscreenElement || combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen') {
    await exitCombatFullscreen();
  } else {
    await requestCombatFullscreen();
  }
}

function returnToOfficialGameMenu() {
  if (chikunActive && combat.active && !combat.gameOver) {
    if (combat.paused) chikunHost?.resume();
    else chikunHost?.pause();
    return;
  }
  if (hmhRebootActive && combat.active && !combat.gameOver) {
    void toggleCombatPause();
    return;
  }
  // If a run is in progress, "Game Menu" must NOT discard it. Just open the
  // in-game pause overlay (or resume if already paused). Progress is preserved.
  if (combat.active && !combat.gameOver) {
    if (!combat.paused) {
      combat.paused = true;
      combat.keys.clear();
      combat.status = HMH_COPY_SHEET.combatStatus.paused;
    } else {
      combat.paused = false;
      combat.status = HMH_COPY_SHEET.combatStatus.resumed;
    }
    syncCombatOverlay();
    return;
  }
  // No active run: behave as a normal return to the pre-match menu.
  destroyHmhRebootSession();
  destroyChikunSession();
  if (document.fullscreenElement) exitCombatFullscreen();
  combat.active = false;
  combat.paused = false;
  combat.gameOver = false;
  combat.keys.clear();
  setArcadeMusicContext('arcade');
  officialAppStep = 'mode-select';
  dom.combatStatus.textContent = currentSession?.isPaid
    ? 'Returned to the pre-match game menu. Ranked restart/payment choices stay explicit.'
    : 'Returned to the pre-match game menu. Free practice state was discarded locally.';
  renderOfficialApp();
  syncCombatOverlay();
}

function exitToArcade() {
  destroyStackedSession();
  destroyHmhRebootSession();
  destroyChikunSession();
  if (document.fullscreenElement) exitCombatFullscreen();
  combat.active = false;
  combat.paused = false;
  combat.gameOver = false;
  combat.keys.clear();
  setArcadeMusicContext('arcade');
  currentSession = null;
  selectedGameId = 'lester-blaster';
  officialAppStep = connectedWallet ? 'cabinet-select' : 'wallet-splash';
  officialSelectedMode = 'free';
  if (dom.combatMenuPanel) dom.combatMenuPanel.hidden = true;
  if (dom.combatHudOverlay) dom.combatHudOverlay.replaceChildren();
  if (dom.combatMenuActionGrid) dom.combatMenuActionGrid.replaceChildren();
  if (dom.combatGameOverSummary) {
    dom.combatGameOverSummary.hidden = true;
    dom.combatGameOverSummary.replaceChildren();
  }
  dom.combatStatus.textContent = connectedWallet
    ? 'Exited the active cabinet back to the Lester’s Arcade cabinet row. No hidden ranked submit occurred.'
    : 'Exited the active cabinet back to the Lester’s Arcade splash. No hidden ranked submit occurred.';
  renderOfficialApp();
  syncCombatOverlay();
}

function weaponById(weaponId) {
  const base = LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.find((weapon) => weapon.id === weaponId)
    ?? LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons[0];
  // Apply weapon-specific upgrade tree if the player has chosen branches.
  // `combat.weaponUpgrades` is a map of { weaponId: { rateOfFire: tier, damage: tier, reloadSpeed: tier } }.
  const choices = combat.weaponUpgrades?.[weaponId] ?? {};
  const u = computeWeaponUpgrades(weaponId, choices);
  return {
    ...base,
    fireRatePerSecond: (base.fireRatePerSecond ?? 3) * u.fireRateMultiplier,
    damage: (base.damage ?? 1) + u.damageFlatBonus,
    reloadSeconds: (base.reloadSeconds ?? 1.2) / u.reloadMultiplier,
    clip: u.specials.includes('extended-mag') ? 12
      : u.specials.includes('quad-shell') ? 4
      : u.specials.includes('drum-mag') ? 180
      : base.clip,
    _upgrades: u,
  };
}

function currentUpgradeRuntimePolicy() {
  return buildUpgradeRuntimePolicy(combat.roguelikeRun?.stats ?? {});
}

function syncUpgradeRuntimeState({ grantMaxHealthIncrease = false } = {}) {
  if (!combat.roguelikeRun) return currentUpgradeRuntimePolicy();
  const policy = currentUpgradeRuntimePolicy();
  const previousMaxHealth = combat.maxHealth ?? PLAYER_MAX_HEALTH;
  const nextMaxHealth = Math.max(1, Math.round(PLAYER_MAX_HEALTH * (combat.roguelikeRun.stats.maxHealth ?? 1)));
  combat.maxHealth = nextMaxHealth;
  if (grantMaxHealthIncrease && nextMaxHealth > previousMaxHealth) {
    combat.health = Math.min(nextMaxHealth, combat.health + (nextMaxHealth - previousMaxHealth));
  } else {
    combat.health = Math.min(combat.health, nextMaxHealth);
  }
  combat.reviveCharges = Math.max(combat.reviveCharges ?? 0, policy.reviveCharges);
  const weapon = weaponById(combat.weaponId);
  combat.clipSize = upgradedClipSize(weapon.clip ?? 8, policy);
  combat.clip = Math.min(combat.clip ?? combat.clipSize, combat.clipSize);
  combat.ammo = combat.clip;
  return policy;
}

function projectileProfileForWeapon(weaponId) {
  // Bullets are coded combat VFX, not sprites. This profile controls the physics
  // object (rate/clip comes from weaponById) and the canvas-only tracer/slug look
  // drawn in drawBullets().
  if (weaponId === 'scatter-shotgun') {
    return {
      color: '#ffb347', coreColor: '#fff4c2', speed: 12.2, ttl: 24,
      spreadRadians: 0.58, hitRadius: 0.46, coreLength: 5.5, coreWidth: 2.1,
      trailAlpha: 0.36, trailWidth: 2.2, casingCount: 1, screenShake: 1.4,
    };
  }
  if (weaponId === 'auto-miner') {
    return {
      color: '#8cf7ff', coreColor: '#ffffff', speed: 16.8, ttl: 58,
      spreadRadians: 0.055, hitRadius: 0.34, coreLength: 6.5, coreWidth: 1.8,
      trailAlpha: 0.42, trailWidth: 1.8, casingCount: 1, screenShake: 0.22,
    };
  }
  if (weaponId === 'spread-ltc') {
    return {
      color: '#74e0d6', coreColor: '#ffffff', speed: 13.8, ttl: 34,
      spreadRadians: 0.48, hitRadius: 0.38, coreLength: 5.8, coreWidth: 1.9,
      trailAlpha: 0.38, trailWidth: 2, casingCount: 1, screenShake: 0.55,
    };
  }
  if (weaponId === 'hash-rail') {
    return {
      color: '#19f7ff', coreColor: '#ffffff', speed: 20.5, ttl: 82,
      spreadRadians: 0.01, hitRadius: 0.52, coreLength: 16, coreWidth: 3.2,
      trailAlpha: 0.72, trailWidth: 3.4, casingCount: 0, screenShake: 1.1,
    };
  }
  return {
    color: '#ffe84d', coreColor: '#ffffff', speed: 14.8, ttl: 68,
    spreadRadians: 0.035, hitRadius: 0.36, coreLength: 6, coreWidth: 2,
    trailAlpha: 0.34, trailWidth: 2, casingCount: 1, screenShake: 0.35,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function enemyHitbox(enemy) {
  return runtimeEnemyHitbox(enemy).collisionBox;
}

function bossHitbox() {
  return combat.boss ? runtimeBossHitbox(combat.boss, { groundY: GROUND_Y }).collisionBox : null;
}

function isFinalBossStage(stageIndex = combat.stageIndex) {
  return stageIndex >= combat.stageCount;
}

function wavesForStage(stageIndex = combat.stageIndex) {
  const [minWaves, maxWaves] = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.wavesPerPauseRange;
  return clamp(minWaves + ((stageIndex + 1) % maxWaves), minWaves, maxWaves);
}

function createTravelHazards(stageIndex) {
  const gapWidth = 48 + (stageIndex % 3) * 10;
  const room = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning;
  return [
    { id: `gap-${stageIndex}`, kind: 'gap', label: 'Gap', x: 690, y: GROUND_Y + 5, w: gapWidth, h: 34, damage: NORMAL_HIT_DAMAGE, active: true },
    { id: `wall-${stageIndex}`, kind: 'wall', label: 'Wall', x: 690 + room.minCoverSpacingPixels + 42, y: GROUND_Y - 44, w: 30, h: 54, hp: 20, maxHp: 20, cover: true, active: true },
  ];
}

function createStageProps(stageIndex, phase = 'travel') {
  const tacticalRoomTuning = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning;
  const enemyCoverShift = (stageIndex % 3) * 22;
  const common = tacticalRoomTuning.coverPlacements.map((placement) => ({
    id: `${placement.id}-${stageIndex}`,
    kind: placement.kind,
    label: placement.label,
    x: placement.x + enemyCoverShift,
    y: GROUND_Y - placement.yOffset,
    w: placement.w,
    h: placement.h,
    hp: placement.hp,
    maxHp: placement.hp,
    cover: placement.cover,
    explosive: placement.explosive,
    active: true,
  }));
  if (phase === 'travel') return [...common.slice(0, 1), ...createTravelHazards(stageIndex)];
  return common;
}

function createStagePlatforms(stageIndex) {
  const tacticalRoomTuning = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning;
  const stageShift = (stageIndex % 2) * 18;
  return tacticalRoomTuning.platformPlacements.map((placement) => ({
    id: `${placement.id}-${stageIndex}`,
    x: placement.x + stageShift,
    y: GROUND_Y - placement.yOffset,
    w: placement.w,
    h: placement.h,
    label: placement.label,
  }));
}

function beginStage(stageIndex = 1) {
  combat.stageIndex = clamp(stageIndex, 1, combat.stageCount);
  combat.stagePhase = 'travel';
  combat.stageTravel = 0;
  combat.stageTravelGoal = LESTER_BLASTER_TACTICAL_CAMERA_MODEL.stageTravelGoalBasePixels
    + combat.stageIndex * LESTER_BLASTER_TACTICAL_CAMERA_MODEL.stageTravelGoalPerStagePixels;
  combat.waveIndex = 0;
  combat.wavesThisStage = isFinalBossStage() ? 0 : wavesForStage();
  combat.waveSpawnQueue = 0;
  combat.waveEnemiesSpawned = 0;
  combat.nextWaveSpawnFrame = combat.frame + 30;
  combat.bossDefeated = false;
  combat.bossDeathSpectacle = null;
  combat.miniBossLock = false;
  combat.scrollLockReason = null;
  combat.props = createStageProps(combat.stageIndex, 'travel');
  combat.hazards = combat.props.filter((prop) => prop.kind === 'gap');
  combat.platforms = createStagePlatforms(combat.stageIndex);
  if (combat.stageIndex % 2 === 1) {
    const powerUp = LESTER_BLASTER_POWER_UPS[combat.stageIndex % LESTER_BLASTER_POWER_UPS.length];
    combat.powerUps.push({ ...powerUp, x: 700, y: GROUND_Y - 48, vy: -1.2, ttl: 620 });
  }
  spawnText(`STAGE ${combat.stageIndex}/${combat.stageCount} // TRAVEL`, 260, 82, '#19f7ff');
  syncCombatOverlay();
}

const portalRouteController = createPortalRouteController({
  windowRef: window,
  documentRef: document,
  getConnected: () => Boolean(connectedWallet),
  setStep: (step) => { officialAppStep = step; },
  getSelectedGameId: () => selectedGameId,
  setSelectedGameId: (gameId) => { selectedGameId = gameId; },
  getSessionId: () => currentSession?.urlSessionId ?? null,
  getViewedWallet: () => profileRouteState.viewedWallet ?? null,
  setViewedWallet: (wallet) => { profileRouteState.viewedWallet = wallet ?? null; },
  getCharacterPanel: () => dom.officialCharacterSelect,
  render,
  // Index-backed fills (guide §5.7-§5.8); both are no-ops in preview, which
  // retires the old 200-session chain scan and its RPC reads.
  hydrateLeaderboard: hydrateLeaderboardFromIndex,
  hydrateProfile: hydrateProfileFromIndex,
  isHtmlElement: (value) => value instanceof HTMLElement,
});
const setOfficialView = portalRouteController.setView;
const syncRouteForView = portalRouteController.syncRoute;

const officialShellRoutes = createOfficialShellRoutes({
  dom,
  documentRef: document,
  getStep: () => officialAppStep,
  getConnectedWallet: () => connectedWallet,
  getSelectedGameId: () => selectedGameId,
  getSessionId: () => currentSession?.urlSessionId ?? null,
  getState: () => state,
  setView: setOfficialView,
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
  shellModel: LESTERS_ARCADE_V2_APP_SHELL,
  networkModel: LITVM_LITEFORGE_NETWORK,
  productionCabinetSprite,
  renderRotatingCabinetSprite,
});
const renderOfficialNav = officialShellRoutes.renderNav;
// Unlockables panel (contract §7.9) under Settings and the player's own profile.
const renderOfficialSettings = () => { officialShellRoutes.renderSettings(); showUnlockablesPanel('settings'); };
const renderOfficialWalletSplash = officialShellRoutes.renderWalletSplash;

// --- verified boards and profiles ------------------------------------------
// The 200-session chain scan and its merge into local state are retired (guide
// §5.8, profile-boards): the Scores and Profile pages read the server index
// instead, and a published local run is stamped by applyRankedPublication.
// Scores page fill (guide §5.8): the verified boards come from GET
// /api/leaderboard. In preview this is a no-op: the page shows this device's
// Ranked runs and makes no request (A22).
function hydrateLeaderboardFromIndex() {
  if (!HOSTED_PROFILE_SYNC) return;
  officialLeaderboardRoute.hydrate().catch((error) => console.warn('[Scores] verified board unavailable:', error?.message || error));
}

// Profile page fill (guide §5.7): the viewed wallet's GET /api/profile (the
// self view for the signed-in owner). A no-op in preview.
function hydrateProfileFromIndex() {
  if (!HOSTED_PROFILE_SYNC) return;
  officialProfileRoute.hydrate().catch((error) => console.warn('[Profile] verified profile unavailable:', error?.message || error));
}

// Integration events (contract §7.7), dispatched on window.
function dispatchPortalEvent(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch { /* no window events: nothing listens */ }
}

// D10 (§7.8): the runs ranked-client holds (a live handle announced by
// lesters:ranked-run, or a body stored on this device). A profile Retry for
// one of them goes to ranked-client; any other run to E3's retry body.
const rankedRunHoldings = createRankedRunHoldings({ live: SETTLEMENT_LIVE, storage: ARCADE_STORAGE });

const profileRouteState = {
  avatarJustSaved: false,
  usernameJustSaved: false,
  gameId: 'lester-blaster',
  historyFilters: { heroId: 'all', weaponId: 'all', mode: 'all', date: 'all', result: 'all' },
  // /profile/<wallet> (A6); null is the connected wallet's own profile.
  viewedWallet: null,
  focusNameEditor: false,
};

// The Profile and Scores routes download on the first visit (contract §11
// rule 5): same factories and deps, behind a loading card until they arrive
// (with the hosted view, when hosted). routes/lazy-routes.mjs.
const createOfficialProfileRoute = (deps) => createLazyProfileRoute(deps, {
  load: () => import('./src/routes/official-profile-route.mjs'),
  loadHostedView: () => import('./src/routes/hosted-profile-view.mjs'),
});
const createOfficialLeaderboardRoute = (deps) => createLazyLeaderboardRoute(deps, {
  load: () => import('./src/routes/official-leaderboard-route.mjs'),
  loadHostedView: () => import('./src/routes/hosted-leaderboard-view.mjs'),
});

const officialProfileRoute = createOfficialProfileRoute({
  ACHIEVEMENTS,
  ARCADE_GAMES,
  appendText,
  buildHardMoneyHeroesStatsModule,
  buildHmhRunDetailsModel,
  buildHmhRunHistoryModel,
  buildPlayerArcadeSnapshot,
  buildProfileExperienceV2Model,
  buildWalletConnectionModel,
  connectWallet: signInFromProfile,
  detectEthereumProvider,
  documentRef: document,
  dom,
  el,
  FileReaderClass: FileReader,
  formatSeconds,
  formatSurvive,
  getContext: () => ({ connectedChainId, connectedWallet, combat, state, walletConnector }),
  getGame,
  isSimulatedWalletActive,
  persistArcadeStateSoon,
  playSfxCue,
  renderAchievementIcon,
  renderAvatarChip,
  renderNav: renderOfficialNav,
  renderSimulatedWalletNotice,
  requestAnimationFrameRef: (callback) => window.requestAnimationFrame(callback),
  routeState: profileRouteState,
  sanitizeAvatarImage,
  setArcadeUsername,
  setPlayerAvatar,
  setView: setOfficialView,
  validateAvatarFile,
  validateUsername,
  hosted: HOSTED_PROFILE_SYNC,
  indexApi,
  isAuthenticated: (wallet) => walletSessionAuthenticated(wallet),
  isActive: () => officialAppStep === 'profile',
  dispatchEvent: dispatchPortalEvent,
  rankedClientHolds: (sessionId32) => rankedRunHoldings.holds(sessionId32),
  loadEthers,
  rpcUrl: LITVM_LITEFORGE_NETWORK.rpcUrls.http,
  playRanked: (gameId) => openModeSelectFor(gameId),
  // On-chain name and avatar writes (§7.8) get their provider from the click:
  // a WalletConnect session restored at boot creates it there.
  walletProviderForAction,
});
const renderOfficialProfile = () => { officialProfileRoute.renderProfile(); showUnlockablesPanel('profile'); };

// D10 and sign-in seams (§7.7). All of them are inert in preview.
window.addEventListener('lesters:ranked-pending', (event) => {
  const changed = officialProfileRoute.setPendingSavedRuns(event?.detail?.count ?? 0);
  // A saved run published (or was dropped): the verified views are out of date.
  if (changed && HOSTED_PROFILE_SYNC) {
    officialProfileRoute.markStale(connectedWallet);
    officialLeaderboardRoute.markStale();
  }
});
// Sign-in, silent restore, sign-out and a 401 all announce the session from
// inside the wallet session, before main.js has applied the new wallet: the
// caches drop at once, and the view on screen reads again once that settled.
window.addEventListener('lesters:wallet-session', () => {
  if (!HOSTED_PROFILE_SYNC) return;
  officialProfileRoute.invalidate();
  officialLeaderboardRoute.invalidate();
  setTimeout(() => {
    if (officialAppStep === 'profile') hydrateProfileFromIndex();
    if (officialAppStep === 'leaderboards') hydrateLeaderboardFromIndex();
  }, 0);
});
window.addEventListener('lesters:profile-changed', (event) => {
  if (!HOSTED_PROFILE_SYNC) return;
  officialLeaderboardRoute.markStale();
  // The nav reads the local handle: follow the confirmed on-chain name (D3).
  const detail = event?.detail ?? {};
  const profile = connectedWallet && String(detail.wallet ?? '').toLowerCase() === connectedWallet ? state.profiles?.[connectedWallet] : null;
  if (profile && mergeRemoteProfile(profile, { profile: { displayName: detail.displayName ?? null } }).changed) {
    persistArcadeStateSoon();
    renderOfficialNav();
  }
});
// First-Ranked name prompt (brief acceptance 5): lazy, hosted only.
window.addEventListener('lesters:ranked-run', (event) => {
  if (!HOSTED_PROFILE_SYNC) return;
  rankedRunHoldings.track(event?.detail);
  // The run changes the player's profile and that game's boards: the next
  // visit reads the index again.
  officialProfileRoute.markStale(event?.detail?.context?.wallet ?? connectedWallet);
  officialLeaderboardRoute.markStale(event?.detail?.context?.gameId ?? null);
  void import('./src/name-claim-prompt.mjs').then(({ maybePromptNameClaim }) => maybePromptNameClaim({
    detail: event?.detail ?? null,
    hosted: HOSTED_PROFILE_SYNC,
    wallet: connectedWallet,
    indexApi,
    getCachedSelfProfile: (wallet) => officialProfileRoute.cachedSelfProfile(wallet),
    documentRef: document,
    mount: document.body,
    onClaim: () => {
      profileRouteState.focusNameEditor = true;
      setOfficialView('profile', { wallet: null });
    },
  })).catch((error) => console.warn('[Profile] name prompt skipped:', error?.message || error));
});

const leaderboardRouteState = {
  cadence: 'weekly',
  gameId: 'lester-blaster',
  search: '',
  sortKey: 'score',
  sortDir: 'desc',
};

// Opens mode select for a game (the Scores empty state's Play Ranked).
function openModeSelectFor(gameId) {
  selectedGameId = gameId;
  currentSession = null;
  lastCompletedSession = null;
  lastRunResult = null;
  setOfficialView('mode-select');
}

const officialLeaderboardRoute = createOfficialLeaderboardRoute({
  appendText,
  buildLeaderboardExperienceV2Model,
  documentRef: document,
  dom,
  el,
  formatSurvive,
  getAllCadenceLeaderboards,
  getContext: () => ({ connectedWallet, state }),
  getGame,
  humanList,
  leaderboardEntryProvenance,
  playableCabinetNames,
  publicLeaderboardCabinets,
  renderArcadeIcon,
  renderAvatarChip,
  resolveDisplayName,
  routeState: leaderboardRouteState,
  hosted: HOSTED_PROFILE_SYNC,
  indexApi,
  playRanked: (gameId) => { playSfxCue('menu-click'); openModeSelectFor(gameId); },
  viewProfile: (wallet) => { playSfxCue('menu-click', 0.05); setOfficialView('profile', { wallet }); },
  isActive: () => officialAppStep === 'leaderboards',
});
const renderOfficialLeaderboards = officialLeaderboardRoute.renderLeaderboards;

const HMH_REBOOT_HERO_IDS = Object.freeze(['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);

function hmhRebootHeroId() {
  return HMH_REBOOT_HERO_IDS.includes(combat.characterId) ? combat.characterId : 'lit-commando';
}

function hmhRebootSettings() {
  return projectHmhRuntimeSettings(normalizeHmhPlayerSettings({
    ...hmhPlayerSettings,
    gameplay: {
      ...hmhPlayerSettings.gameplay,
      screenShake: gameSettings.screenShake,
      gore: gameSettings.gore,
      autoEnterFullscreen: gameSettings.autoEnterFullscreen,
      autoAimAssist: gameSettings.autoAimAssist,
    },
    audio: { ...hmhPlayerSettings.audio, musicEnabled: Boolean(combat.musicEnabled) },
    accessibility: {
      ...hmhPlayerSettings.accessibility,
      reduceMotion: gameSettings.reduceMotion,
      reduceFlash: gameSettings.reduceFlash,
      colorblindTags: gameSettings.colorblindTags,
    },
  }));
}

function applyHmhAudioSettings() {
  combatAudio.sfxEnabled = hmhPlayerSettings.audio.sfxEnabled && hmhPlayerSettings.audio.sfxVolume > 0;
  arcadeMusic.volume = arcadeMusicVolume(hmhPlayerSettings.audio.musicVolume, arcadeMusic.volume);
  const audio = arcadeMusicAudio();
  if (audio) {
    audio.muted = hmhPlayerSettings.audio.musicEnabled === false;
    applyArcadeMusicVolume();
  }
}

function acceptHmhRebootSettings(message) {
  const runtimeSettings = message?.payload?.settings;
  hmhPlayerSettings = mergeHmhRuntimeSettings(hmhPlayerSettings, runtimeSettings, {
    rankedActive: Boolean(hmhRebootActive && currentSession?.mode === 'ranked'),
  });
  applyHmhSettingsCompatibilityView(hmhPlayerSettings);
  persistHmhPlayerSettings();
  if (typeof runtimeSettings?.musicEnabled === 'boolean') setArcadeMusicEnabled(runtimeSettings.musicEnabled);
  applyHmhAudioSettings();
  applyGameplayAccessibilitySettings();
  debugRuntimeLog('[HMH reboot settings]', hmhPlayerSettings);
}

function pushHmhRebootSettings() {
  if (hmhRebootActive) hmhRebootHost?.updateSettings(hmhRebootSettings());
}

function destroyHmhRebootSession() {
  hmhRebootHost?.destroy();
  hmhRebootHost = null;
  hmhRebootLifecycle = null;
  lastHmhRunSummary = null;
  gameAdapter?.teardown?.();
  gameAdapter = null;
  hmhRebootActive = false;
}

function finalizeHmhRebootFreeGameOver(runSummary) {
  lastHmhRunSummary = runSummary;
  const recap = currentHmhRunRecap();
  lastCompletedSession = currentSession;
  lastRunResult = {
    score: combat.score,
    elapsedSeconds: combat.elapsedGameSeconds,
    acceptedForGlobalLeaderboard: false,
  };
  lastRunScore = combat.score;
  lastRunElapsedSeconds = combat.elapsedGameSeconds;
  appendRunRecord(state, {
    sessionId: currentSession.sessionId,
    gameId: 'lester-blaster',
    wallet: connectedWallet,
    mode: 'free',
    score: runSummary.totals.score,
    elapsedSeconds: Math.round(runSummary.totals.elapsedMs / 1000),
    kills: runSummary.kills.total,
    characterId: runSummary.identity.heroId,
    killedBy: recap?.defeat.label ?? null,
    bossDefeated: runSummary.kills.boss > 0,
    runSummary,
  });
  persistArcadeStateSoon();
  renderOfficialRunStatus();
  renderGameOverSummary();
  renderCombatMenuActionGrid();
}

function mountHmhRebootSession() {
  if (!dom.officialCombatMount || !currentSession) return null;
  if (!hmhRebootLifecycle) {
    hmhRebootLifecycle = createHmhRebootPortalLifecycle({
      combat,
      getSession: () => currentSession,
      getAdapter: () => gameAdapter,
      finalizeRanked: ({ runSummary }) => submitCombatGameOver(runSummary),
      finalizeFree: ({ runSummary }) => finalizeHmhRebootFreeGameOver(runSummary),
      syncUi: () => syncCombatOverlay(),
      onError: (error) => {
        console.error('[HMH reboot lifecycle]', error);
        if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = `Reboot lifecycle error: ${error.message}`;
      },
    });
  }
  if (!hmhRebootHost) {
    hmhRebootHost = createHmhRebootHost({
      mount: dom.officialCombatMount,
      expectedOrigin: window.location.origin,
      runtimeSearch: bootRuntimeSearch,
      onReady: () => {
        hmhRebootActive = true;
        combat.active = true;
        combat.paused = false;
        if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = 'Top-down reboot runtime connected. Portal session authority remains active.';
      },
      onState: (message) => hmhRebootLifecycle?.handleState(message),
      onRunSummary: (message) => hmhRebootLifecycle?.handleRunSummary(message),
      onExit: (message) => message.payload.reason === 'restart' ? restartCombatRun() : returnToOfficialGameMenu(),
      onRunEvent: (message) => {
        if (!currentSession?.isPaid || !currentSession.evidence) return;
        // One event per enemy kill would pass the 10,000-event cap on long
        // runs and make finalizeSessionEvidence throw; the server does not
        // verify events (HMH is plausibility-checked from the run summary).
        // Boss defeats and the score result are still recorded.
        if (message.payload.eventType === 'enemy-defeated') return;
        recordSessionEvent(currentSession.evidence, {
          step: message.payload.tick,
          type: `hmh-reboot:${message.payload.eventType}`,
          payload: { sequence: message.payload.sequence, value: message.payload.value },
        });
      },
      onScoreResult: (message) => {
        if (!hmhRebootLifecycle?.handleScoreResult(message)) return;
        if (!currentSession?.isPaid || !currentSession.evidence) return;
        recordSessionEvent(currentSession.evidence, {
          step: Math.floor(message.payload.elapsedMs / (1000 / 60)),
          type: 'hmh-reboot:score-candidate',
          payload: { score: message.payload.score, kills: message.payload.kills, checksum: message.payload.checksum },
        });
      },
      onAchievement: (message) => {
        gameAdapter?.emitAchievement?.(message.payload.achievementId);
        if (!currentSession?.isPaid || !currentSession.evidence) return;
        recordSessionEvent(currentSession.evidence, {
          step: message.payload.tick,
          type: 'hmh-reboot:achievement-candidate',
          payload: { achievementId: message.payload.achievementId },
        });
      },
      onSettings: acceptHmhRebootSettings,
      onError: (error) => {
        console.error('[HMH reboot bridge]', error);
        if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = `Reboot runtime error: ${error.message}`;
      },
    });
  }
  const profile = connectedWallet ? state.profiles?.[connectedWallet] : null;
  const initContext = buildCabinetInitContextFromSession(currentSession, {
    displayName: profile ? resolveDisplayName(profile, connectedWallet) : 'Guest',
    locale: document.documentElement.lang || navigator.language || 'en',
    aspect: 'landscape',
    reducedMotion: Boolean(gameSettings.reduceMotion),
  });
  hmhRebootActive = true;
  return hmhRebootHost.mountSession({
    sessionId: currentSession.urlSessionId ?? currentSession.sessionId,
    gameId: currentSession.gameId,
    mode: initContext.mode,
    heroId: hmhRebootHeroId(),
    profile: {
      displayName: initContext.displayName,
      locale: initContext.locale,
    },
    session: {
      seed: initContext.seed,
      buildHash: initContext.buildHash,
      seasonId: initContext.seasonId,
      rankedEligible: initContext.rankedEligible,
    },
    settings: { ...hmhRebootSettings(), ...childCosmetics('lester-blaster') },
  });
}

function destroyChikunSession() {
  chikunRunMusic?.dispose();
  chikunRunMusic = null;
  delete document.documentElement.dataset.gameplayPaused;
  chikunHost?.destroy();
  chikunHost = null;
  chikunLifecycle = null;
  chikunActive = false;
  syncCabinetResultsButton();
}

async function restartChikunSession({ fromChild = false } = {}) {
  // A16: a finished Ranked run restarts through a fresh paid entry (the
  // Ranked modal; mountChikunSession replaces this cabinet once a new session
  // exists). Free restarts as before.
  if (currentSession?.leaderboardEligible || officialSelectedMode === 'ranked') {
    const finished = currentSession;
    const host = chikunHost;
    try {
      await startOfficialMode('ranked');
    } finally {
      // No wallet, a declined sign-in, or a cancelled or failed entry starts
      // no session. The child's Run Again is disabled ('Requesting new run…')
      // and no message re-enables it, so the finished cabinet gives way to
      // mode select, as STACKED's Ranked restart did before A16.
      if (fromChild && host && chikunHost === host && currentSession === finished) {
        destroyChikunSession();
        setOfficialView('mode-select');
      }
    }
    return;
  }
  destroyChikunSession();
  await startMode('free');
  setOfficialView('gameplay');
  mountChikunSession();
}

function mountChikunSession() {
  if (!dom.officialCombatMount || !currentSession || currentSession.gameId !== 'chikun') return null;
  if (!currentSession.leaderboardEligible) {
    currentSession = bindChikunDailyChallenge(currentSession);
  }
  const boundSession = currentSession;
  destroyHmhRebootSession();
  destroyStackedSession();
  destroyChikunSession();
  const profile = connectedWallet ? state.profiles?.[connectedWallet] : null;
  const initContext = buildCabinetInitContextFromSession(currentSession, {
    displayName: profile ? resolveDisplayName(profile, connectedWallet) : 'Guest Flyer',
    locale: document.documentElement.lang || navigator.language || 'en-US',
    aspect: 'landscape',
    reducedMotion: Boolean(gameSettings.reduceMotion),
  });
  chikunLifecycle = createChikunPortalLifecycle({
    state,
    session: currentSession,
    recordScoreRef: recordScore,
    persist: persistArcadeStateSoon,
    onComplete: (result) => {
      lastCompletedSession = boundSession;
      lastRunResult = result;
      lastRunScore = result.canonical.score;
      lastRunElapsedSeconds = result.canonical.survivalTime;
      combat.active = false;
      combat.gameOver = true;
      combat.paused = false;
      if (!boundSession.leaderboardEligible) {
        if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = `Free score ${result.canonical.score.toLocaleString()} verified locally. No profile or leaderboard write occurred.`;
        return;
      }
      if (dom.officialGameStateCopy) {
        dom.officialGameStateCopy.textContent = SETTLEMENT_LIVE
          ? `Ranked score ${result.canonical.score.toLocaleString()} replay-verified. Publishing your run on LitVM — see the results panel.`
          : 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.';
      }
      // The replay-verified local record exists; settle the same v6 evidence.
      if (result.acceptedForGlobalLeaderboard) void settleChikunRankedRun(boundSession, result);
    },
  });
  chikunRunMusic = createChikunRunMusic(startArcadeMusicForGame);
  chikunHost = createChikunHost({
    mount: dom.officialCombatMount,
    expectedOrigin: window.location.origin,
    onReady: () => {
      chikunActive = true;
      combat.active = true;
      combat.gameOver = false;
      combat.paused = false;
      if (dom.officialGameModeTitle) dom.officialGameModeTitle.textContent = `Chikun’s Escape // ${initContext.mode === 'ranked' ? 'Ranked Mode' : 'Free Mode'}`;
      if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = initContext.mode === 'ranked'
        ? 'Parent-issued Ranked session connected. Final input evidence will be replayed before any profile or score-board write.'
        : 'Free practice connected. No profile, leaderboard, settlement, or chain write can occur.';
    },
    onState: (message) => {
      if (message.payload.status === 'running' && message.payload.survivalTicks === 0) {
        chikunLifecycle?.beginPracticeRun();
      }
      chikunRunMusic?.observe(message.payload);
      combat.paused = Boolean(message.payload.paused);
      if (message.payload.status) {
        combat.active = message.payload.status === 'running' || message.payload.status === 'paused';
        combat.gameOver = message.payload.status === 'game-over';
      }
      if(combat.paused) document.documentElement.dataset.gameplayPaused='true';
      else delete document.documentElement.dataset.gameplayPaused;
      renderArcadeMusicPlayer();
      if (dom.combatPauseButton) dom.combatPauseButton.textContent = combat.paused ? 'Resume' : 'Pause';
    },
    onResult: (message) => {
      chikunRunMusic?.observe({status: 'game-over'});
      const result = chikunLifecycle?.handleResult(message.payload);
      if (!result?.ok) {
        console.error('[Chikun lifecycle]', result?.error ?? result?.reason ?? 'Unknown result failure');
        if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = `Chikun score rejected: ${result?.reason ?? 'verification failed'}`;
      }
    },
    onRestartRequest: () => { void restartChikunSession({ fromChild: true }); },
    onExitRequest: () => exitToArcade(),
    onMusicRequest: () => {
      if(!combat.paused)return;
      arcadeMusic.expanded=true;
      renderArcadeMusicPlayer();
      dom.arcadeMusicPlayButton?.focus();
    },
    onError: (error) => {
      console.error('[Chikun bridge]', error);
      if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = `Chikun runtime error: ${error.message}`;
    },
  });
  chikunActive = true;
  combat.active = true;
  combat.gameOver = false;
  return chikunHost.mountSession({
    sessionId: currentSession.urlSessionId ?? currentSession.sessionId,
    gameId: 'chikun',
    mode: initContext.mode,
    profile: {
      displayName: initContext.displayName,
      locale: initContext.locale,
    },
    session: {
      seed: initContext.seed,
      buildHash: initContext.buildHash,
      seasonId: initContext.seasonId,
      rankedEligible: initContext.rankedEligible,
    },
    settings: {
      musicEnabled: gameSettings.musicEnabled !== false,
      reduceMotion: Boolean(gameSettings.reduceMotion),
      ...childCosmetics('chikun'),
    },
  });
}

const hmhChallengeUi = mountHmhChallengeUi({
  dom: {
    panel: document.querySelector('#hmhChallengePanel'),
    choice: document.querySelector('#hmhChallengeChoice'),
    sharedOption: document.querySelector('#hmhChallengeSharedOption'),
    status: document.querySelector('#hmhChallengeStatus'),
    link: document.querySelector('#hmhChallengeLink'),
    copy: document.querySelector('#hmhChallengeCopy'),
    freeButton: dom.officialFreeModeButton,
  },
  search: bootRuntimeSearch,
  identity: getPlaySessionIdentity('lester-blaster'),
  location: window.location.href,
  copyText: navigator.clipboard?.writeText ? (text) => navigator.clipboard.writeText(text) : null,
});

const officialPlayRoutes = createOfficialPlayRoutes({
  appendText,
  applyGameModeSelectBackground,
  applyHardMoneyHeroScreenBackground,
  buildCharacterSelectEntries,
  buildGameModeSelectModel,
  cabinetPlayableInCurrentMode,
  characterUnlockOptions,
  DEV_CABINETS_ENABLED,
  dom,
  el,
  getContext: () => ({
    combat,
    connectedWallet,
    hmhRebootActive,
    officialSelectedMode,
    state,
  }),
  HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
  HERO_ROSTER_BASE,
  heroRotationSprite,
  LESTERS_ARCADE_V2_APP_SHELL,
  loadChikunGame: () => import('./src/games/chikun/loader.mjs'),
  persistArcadeStateSoon,
  playSfxCue,
  productionCabinetSprite,
  renderArcadeIcon,
  renderHeroStatBars,
  renderRotatingCabinetSprite,
  resolveSelectedCharacterId,
  selectCabinet: (gameId) => {
    selectedGameId = gameId;
    currentSession = null;
    lastCompletedSession = null;
    lastRunResult = null;
  },
  selectedGame,
  SETTLEMENT_LIVE,
  setPreferredCharacter,
  setView: setOfficialView,
  weaponById,
});
const renderOfficialCabinets = officialPlayRoutes.renderCabinets;
const renderOfficialCharacterSelect = officialPlayRoutes.renderCharacterSelect;
const renderOfficialGameplay = () => {
  officialPlayRoutes.renderGameplay();
  if (currentSession?.hmhChallenge) dom.officialGameModeTitle.textContent += ` // ${currentSession.hmhChallenge.label}`;
};
const renderOfficialModeSelect = () => {
  officialPlayRoutes.renderModeSelect();
  hmhChallengeUi.render(selectedGameId);
  startRankedPreflightInBackground();
  let options = document.querySelector('#stackedStartOptions');
  if (!options) {
    options = document.createElement('div'); options.id = 'stackedStartOptions'; options.className = 'stacked-start-options';
    const label = document.createElement('label'); label.textContent = 'Free Mode starting level ';
    const select = document.createElement('select'); select.id = 'stackedStartLevel';
    for (let level = 1; level <= 15; level++) { const option = document.createElement('option'); option.value = String(level); option.textContent = 'Level ' + level; select.append(option); }
    label.append(select); options.append(label); dom.officialModeSelect.append(options);
  }
  options.hidden = selectedGameId !== 'stacked';
};

const officialAppRoutes = createOfficialAppRoutes({
  dom,
  documentRef: document,
  getStep: () => officialAppStep,
  setStep: (step) => { officialAppStep = step; },
  getConnectedWallet: () => connectedWallet,
  getViewedProfileWallet: () => profileRouteState.viewedWallet ?? null,
  isGuestAllowedStep,
  isSimulatedWalletActive,
  playableCabinetNames,
  humanList,
  shellModel: LESTERS_ARCADE_V2_APP_SHELL,
  applyHardMoneyHeroScreenBackground,
  renderNav: renderOfficialNav,
  renderWalletSplash: renderOfficialWalletSplash,
  renderProfile: renderOfficialProfile,
  renderLeaderboards: renderOfficialLeaderboards,
  renderSettings: renderOfficialSettings,
  renderCabinets: renderOfficialCabinets,
  renderModeSelect: renderOfficialModeSelect,
  renderCharacterSelect: renderOfficialCharacterSelect,
  renderGameplay: renderOfficialGameplay,
});
const renderOfficialApp = officialAppRoutes.renderApp;

async function connectOfficialWallet() {
  if (!connectedWallet) {
    await connectWallet();
    if (!connectedWallet) return; // connection failed/declined
  }
  playSfxCue('wallet-connect', 0.055);
  officialAppStep = 'arcade-walk-in';
  render();
  setTimeout(() => {
    if (officialAppStep === 'arcade-walk-in') setOfficialView('cabinet-select');
  }, 900);
}

async function enterOfficialArcadeFromSplash() {
  if (connectedWallet) {
    playSfxCue('menu-click', 0.05);
    setOfficialView('cabinet-select');
    return;
  }
  await connectOfficialWallet();
}

// Guest-first entry: browse the arcade floor and play Free without connecting a
// wallet. Connecting later upgrades the same session to a saved profile and
// unlocks ranked. Distinct from enterOfficialArcadeFromSplash, which connects.
function enterArcadeAsGuest() {
  playSfxCue('menu-click', 0.05);
  setOfficialView('cabinet-select');
}

function showRankedTooltip(title, detail) {
  if (!dom.officialRankedTooltip) return;
  dom.officialRankedTooltip.dataset.state = 'needs-wallet';
  dom.officialRankedTooltip.replaceChildren();
  appendText(dom.officialRankedTooltip, 'strong', title);
  appendText(dom.officialRankedTooltip, 'span', detail);
}

async function startOfficialMode(mode) {
  playSfxCue('menu-click');
  try { hmhChallengeUi.requestFor(selectedGameId, mode); }
  catch { setOfficialView('mode-select'); return; }
  // Ranked is paid/official and wallet-bound. A guest must sign in first.
  if (mode === 'ranked') {
    // One Ranked entry at a time: while its modal is open (a results screen
    // Play again, a child's Run Again, a double click) nothing else starts.
    if (dom.rankedEntryModal?.hidden === false) return;
    // The cabinet "View results" button stays hidden until this settles.
    rankedStartsInFlight += 1;
    syncCabinetResultsButton();
    try {
      if (!connectedWallet) {
        await connectWallet();
        // If the player declined or closed the picker, stay on mode select.
        if (!connectedWallet) {
          showRankedTooltip('Sign in to play Ranked', SETTLEMENT_LIVE
            ? 'Ranked runs publish your score on LitVM, so they need a signed-in wallet. Free Mode needs no wallet.'
            : 'Ranked preview uses your wallet as the run’s identity. Nothing is charged while verified settlement is off. Free Mode needs no wallet.');
          return;
        }
        playSfxCue('wallet-connect', 0.055);
      }
      // A mock wallet (offline QA) can't rank because it can't sign / hold zkLTC.
      if (walletConnector !== 'injected-evm') {
        showRankedTooltip('Sign in with a real wallet to play Ranked', SETTLEMENT_LIVE
          ? 'Ranked needs a real EVM wallet (MetaMask, Rabby or WalletConnect) to pay the entry and sign in. Free Mode is always available.'
          : 'Ranked needs a real EVM wallet (MetaMask, Rabby or WalletConnect). Nothing is charged while verified settlement is off. Free Mode is always available.');
        return;
      }
      // A WalletConnect session restored at boot creates its provider now, on
      // this click, never at boot (guide rule 3).
      if (walletProviderPending && !(await walletProviderForAction())) {
        showRankedTooltip('Reconnect your wallet to play Ranked', 'Your WalletConnect session could not reconnect. Sign in again; Free Mode is always available.');
        return;
      }
      // The canonical Ranked session is created BEFORE the entry modal so the
      // entry (when live) is paid against the same session id the score is
      // later settled under. A player who has not signed the login yet signs
      // from the modal's own button (never from a game input handler).
      const pendingRanked = beginTrackedSession({ mode: 'ranked' });
      const ready = await requestRankedEntry(pendingRanked);
      if (!ready) return; // cancelled, paused, wrong chain unresolved, unfunded, or the entry failed to send
      officialSelectedMode = mode;
      await startMode('paid', { session: pendingRanked });
    } finally {
      rankedStartsInFlight -= 1;
      syncCabinetResultsButton();
    }
  } else {
    officialSelectedMode = mode;
    await startMode('free');
  }
  if (connectedWallet && state.profiles[connectedWallet] && selectedGameId === 'lester-blaster') {
    combat.characterId = resolveSelectedCharacterId(state.profiles[connectedWallet], HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, characterUnlockOptions());
  }
  setOfficialView(selectedGameId === 'lester-blaster' ? 'character-select' : 'gameplay');
  if (selectedGameId === 'chikun') mountChikunSession();
  if (selectedGameId === 'stacked') await mountStackedSession();
}

// Parent-owned Ranked entry modal (guide §3.2, contract A17/A25, §7.6).
// Preview (SETTLEMENT_LIVE false): no network, approval starts the local run.
// Live: the cached background pre-flight shows the quote at once, a fresh
// public-RPC check refreshes it, the seed ticket (E15) is fetched before the
// session key, and one wallet confirmation broadcasts the entry. The run starts
// on broadcast; the entry chip follows the confirmation.
function requestRankedEntry(pendingSession = null) {
  return new Promise((resolve) => {
    const modal = dom.rankedEntryModal;
    if (!modal) { resolve(!SETTLEMENT_LIVE); return; }
    // Re-entry while the modal is open (still deciding, or halted on a paused
    // or closed message) is refused: a second set of listeners on the shared
    // buttons would outlive this request and later pay for its stale session.
    if (modal.hidden === false) { resolve(false); return; }
    ensureWalletStylesheet();
    const requestedGameId = selectedGameId;
    const entryFeeWei = String(pendingSession?.entryFeeWei ?? '0');
    if (dom.rankedEntryFee) dom.rankedEntryFee.textContent = entryFeeWei === '0' ? 'None' : formatZkLtcWei(entryFeeWei);
    // Fee + settlement reserve (owner decisions 2026-09-16 and 2026-09-23).
    // The client constant is shown until the contract's quoteEntry answers.
    let entryTotalWei = entryFeeWei === '0' ? '0' : rankedEntryTotalWei(entryFeeWei);
    const renderEntryTotals = (reserveWei, totalWei) => {
      entryTotalWei = String(totalWei);
      if (dom.rankedEntryReserve) dom.rankedEntryReserve.textContent = entryFeeWei === '0' ? 'None' : formatZkLtcWei(String(reserveWei));
      if (dom.rankedEntryTotal) dom.rankedEntryTotal.textContent = entryFeeWei === '0' ? 'None' : formatZkLtcWei(entryTotalWei);
    };
    renderEntryTotals(RANKED_SETTLEMENT_GAS_RESERVE_WEI, entryTotalWei);
    let closed = false;
    let checkSequence = 0;
    // Set when E15 answers paused or the entry contract quotes nothing: the
    // modal stays open with the message, and nothing may reach the wallet.
    let halted = false;
    let needsSignIn = !walletAuthenticated;
    let readyToPay = false;
    let latestQuote = null;
    let seedTicket = null;
    let prefetchInFlight = null;
    // The amounts the last readiness check read, for a funds error at send.
    let lastFundsAmounts = {};
    const provider = detectEthereumProvider();
    // The session key binds the account the pending session was created for.
    const sessionWallet = String(pendingSession?.canonicalContext?.wallet ?? pendingSession?.wallet ?? '').toLowerCase();
    const accountSwitched = () => Boolean(pendingSession) && String(connectedWallet ?? '').toLowerCase() !== sessionWallet;
    const walletShort = connectedWallet ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)}` : 'No wallet';
    dom.rankedEntryWallet.textContent = walletShort;
    dom.rankedEntryNetwork.textContent = `${LITVM_LITEFORGE_NETWORK.name} · ${LITVM_LITEFORGE_NETWORK.chainId}`;
    dom.rankedEntryStatus.textContent = '';
    dom.rankedEntryStatus.dataset.state = '';
    if (dom.rankedEntryBalance) dom.rankedEntryBalance.textContent = SETTLEMENT_LIVE ? 'Checking…' : 'Not required';
    const guard = dom.rankedEntryChainGuard;
    guard.hidden = true;
    guard.replaceChildren();
    const approveLabel = () => (needsSignIn ? 'Sign in' : (SETTLEMENT_LIVE ? 'Confirm entry' : 'Start Ranked Run'));
    dom.rankedEntryApprove.textContent = approveLabel();
    dom.rankedEntryApprove.disabled = true;
    const copyNode = modal.querySelector?.('#rankedEntryCopy');
    const footnote = modal.querySelector?.('#rankedEntryFootnote');
    if (SETTLEMENT_LIVE) {
      if (copyNode) copyNode.textContent = 'One confirmation in your wallet pays the entry. Your run starts as soon as it is sent, and the relayer publishes your score on LitVM.';
      if (footnote) footnote.textContent = 'The entry contract quotes the exact total. Testnet entries are not refunded.';
    }
    modal.hidden = false;

    const setStatus = (state, text) => {
      dom.rankedEntryStatus.dataset.state = state;
      dom.rankedEntryStatus.textContent = text;
    };
    // Checked after every await of the approve flow: a closed or halted modal
    // never goes on to the key or the wallet.
    const stopped = () => closed || halted;
    const cleanup = () => {
      closed = true;
      dom.rankedEntryApprove.disabled = true;
      modal.hidden = true;
      dom.rankedEntryApprove.removeEventListener('click', onApprove);
      dom.rankedEntryCancel.removeEventListener('click', onCancel);
      freeLink?.removeEventListener('click', onFree);
      // A modal left open on a paused or closed message kept the cabinet
      // "View results" button hidden; it may come back now.
      syncCabinetResultsButton();
    };
    const onCancel = () => { playSfxCue('menu-click', 0.04); cleanup(); resolve(false); };
    const freeLink = modal.querySelector?.('#rankedEntryFreeLink') ?? null;
    const onFree = (event) => {
      event?.preventDefault?.();
      cleanup();
      resolve(false);
      void startOfficialMode('free');
    };
    // Ranked paused (E15 503) or closed (a zero quote, A27): stop before any
    // wallet prompt.
    const showHalted = (message) => {
      halted = true;
      readyToPay = false;
      guard.hidden = true;
      guard.replaceChildren();
      setStatus('error', message);
      dom.rankedEntryApprove.disabled = true;
      resolve(false);
    };
    const showPaused = () => showHalted(RANKED_PAUSED_MESSAGE);
    // The wallet switched accounts after the session was created: that key
    // must not be paid from another account. Start again for the new one.
    const restartForSwitchedAccount = () => {
      cleanup();
      resolve(false);
      if (!connectedWallet) return;
      showWalletNotice('Your wallet switched accounts, so the Ranked entry starts again for the new account.');
      void startOfficialMode('ranked');
    };
    const refreshApprove = () => {
      dom.rankedEntryApprove.textContent = approveLabel();
      dom.rankedEntryApprove.disabled = closed || halted || !(needsSignIn || readyToPay);
    };
    // A failed readiness read: the message plus one Try again.
    const showRetry = (message) => {
      readyToPay = false;
      setStatus('error', message);
      guard.hidden = false;
      guard.replaceChildren();
      const retry = el('button', { className: 'pixel-button', type: 'button', textContent: 'Try again' });
      retry.addEventListener('click', () => { retry.textContent = 'Checking…'; runCheck(); });
      guard.append(retry);
      refreshApprove();
    };
    // One message and one action per wallet error kind (wallet-auth.mjs).
    const showWalletError = (classified, amounts = {}) => {
      const action = walletErrorAction(classified, amounts);
      guard.hidden = true;
      guard.replaceChildren();
      if (action.kind === 'missing-wallet') {
        // The picker, even though the player still looks signed in: the
        // provider behind that session is gone.
        cleanup();
        resolve(false);
        void signInFromPicker({ allowSimulated: false });
        return;
      }
      if (action.kind === 'wrong-network') {
        readyToPay = false;
        guard.hidden = false;
        appendText(guard, 'strong', action.message);
        appendText(guard, 'span', `Ranked runs on ${LITVM_LITEFORGE_NETWORK.name} (${LITVM_LITEFORGE_NETWORK.chainId}).${amounts.chainId ? ` Your wallet is on chain ${amounts.chainId}.` : ''}`);
        const switchBtn = el('button', { className: 'pixel-button', type: 'button', textContent: action.actions[0].label });
        switchBtn.addEventListener('click', async () => {
          switchBtn.textContent = 'Switching…';
          const ok = await requestLiteForgeNetwork(provider);
          if (ok) runCheck();
          else switchBtn.textContent = action.actions[0].label;
        });
        guard.append(switchBtn);
        setStatus('', '');
        refreshApprove();
        return;
      }
      if (action.kind === 'insufficient-funds') {
        readyToPay = false;
        guard.hidden = false;
        appendText(guard, 'strong', action.message);
        const actions = el('div', { className: 'ranked-entry-guard-actions' });
        const faucet = el('a', { className: 'pixel-button', textContent: action.actions[0].label, href: LITVM_LITEFORGE_NETWORK.faucetUrl, target: '_blank', rel: 'noopener noreferrer' });
        const recheck = el('button', { className: 'pixel-button', type: 'button', textContent: action.actions[1].label });
        recheck.addEventListener('click', () => { recheck.textContent = 'Checking…'; runCheck(); });
        actions.append(faucet, recheck);
        guard.append(actions);
        setStatus('', '');
        refreshApprove();
        return;
      }
      // user-cancelled and wallet-error: the approve button is the retry.
      setStatus(action.kind === 'user-cancelled' ? '' : 'error', action.message);
      refreshApprove();
      if (!dom.rankedEntryApprove.disabled) dom.rankedEntryApprove.textContent = action.actions[0].label;
    };

    // E15 seed ticket (A25), fetched before the session key; never a wallet
    // prompt. A 401 re-runs sign-in once (this runs inside the approve click).
    // The Bearer token is the one of the wallet the session is bound to.
    const obtainSeedTicket = async ({ reauth }) => {
      if (seedTicketUsable(seedTicket, { sessionId: pendingSession.sessionId, nowMs: Date.now() })) return seedTicket;
      const session = await loadWalletSession();
      let result = await fetchSeedTicket({ token: session.token(sessionWallet), session: pendingSession });
      if (result.status === 401 && reauth && !stopped()) {
        session.invalidate();
        walletAuthenticated = false;
        if (await authenticateWalletSiwe(provider, connectedAddress ?? connectedWallet)) {
          result = await fetchSeedTicket({ token: session.token(sessionWallet), session: pendingSession });
        }
      }
      if (result.ok) seedTicket = result;
      return result;
    };

    const onApprove = async () => {
      if (closed || dom.rankedEntryApprove.disabled) return;
      playSfxCue('wallet-connect', 0.05);
      if (accountSwitched()) { restartForSwitchedAccount(); return; }
      if (needsSignIn) {
        // Sign-in from this button's click, then a second click pays.
        dom.rankedEntryApprove.disabled = true;
        dom.rankedEntryApprove.textContent = 'Check your wallet…';
        const signed = await authenticateWalletSiwe(provider, connectedAddress ?? connectedWallet);
        if (stopped()) return;
        needsSignIn = !signed;
        if (signed) {
          setStatus('ok', SETTLEMENT_LIVE ? '✓ Signed in.' : '✓ Signed in. Start your Ranked preview run.');
          if (!SETTLEMENT_LIVE) readyToPay = true;
          else prefetchSeedTicket();
        } else {
          setStatus('', 'Ranked runs are bound to a signed wallet login. The signature is free and sends no transaction.');
        }
        refreshApprove();
        return;
      }
      if (!SETTLEMENT_LIVE) {
        cleanup();
        resolve(requestedGameId === selectedGameId);
        return;
      }
      if (requestedGameId !== selectedGameId) { cleanup(); resolve(false); return; }
      // A27: a free Ranked entry cannot settle (402 entry-underpaid), so live
      // Ranked without a fee is closed rather than free.
      if (entryFeeWei === '0' || !pendingSession) { showHalted(RANKED_CLOSED_MESSAGE); return; }
      // Live: seed ticket, then the key, then one wallet confirmation.
      dom.rankedEntryApprove.disabled = true;
      dom.rankedEntryApprove.textContent = 'Preparing…';
      setStatus('pending', 'Preparing your Ranked session…');
      // The ticket prefetched when the modal opened is awaited, never raced:
      // a paused answer arriving now still stops the entry.
      if (prefetchInFlight) await prefetchInFlight;
      if (stopped()) return;
      const ticket = await obtainSeedTicket({ reauth: true }).catch(() => ({ ok: false, status: 0, error: 'network' }));
      if (stopped()) return;
      if (!ticket.ok) {
        if (isRankedPaused(ticket)) { showPaused(); return; }
        setStatus('error', ticket.status === 401 ? 'Sign in again to play Ranked.' : 'Ranked could not start. Try again.');
        needsSignIn = ticket.status === 401 && !walletAuthenticated;
        refreshApprove();
        return;
      }
      try {
        const { applySeedTicket, rankedIdentityFor, rankedSessionKey } = await loadRankedIdentity();
        if (stopped()) return;
        if (accountSwitched()) { restartForSwitchedAccount(); return; }
        applySeedTicket(pendingSession, ticket);
        const identity = rankedIdentityFor(pendingSession, { scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry });
        const sessionKey = await rankedSessionKey(identity);
        if (stopped()) return;
        if (accountSwitched()) { restartForSwitchedAccount(); return; }
        dom.rankedEntryApprove.textContent = 'Confirm in your wallet…';
        setStatus('pending', `Confirm the ${formatZkLtcWei(entryTotalWei)} entry in your wallet.`);
        const sent = await sendRankedEntry(provider, { sessionKey, gameId: requestedGameId, preflight: latestQuote, expectedWallet: sessionWallet });
        recordEntryBroadcast(pendingSession, sent, { eventTarget: window, gameId: requestedGameId });
        showEntryChip(pendingSession);
        pendingSession.entryConfirmed.then(() => refreshWalletBalanceChip()).catch(() => {});
        setStatus('ok', '✓ Entry sent. Your run is starting.');
        cleanup();
        resolve(requestedGameId === selectedGameId);
      } catch (error) {
        if (closed) return;
        // The wallet signs as another account: start again once the page has
        // seen the switch; until then the wallet error (and Try again) shows.
        if (error?.code === 'ACCOUNT_MISMATCH' && accountSwitched()) { restartForSwitchedAccount(); return; }
        if (error?.code === 'RANKED_ENTRY_CLOSED') { showHalted(RANKED_CLOSED_MESSAGE); return; }
        const classified = classifyWalletError(error);
        showWalletError(classified, classified.kind === 'insufficient-funds' ? lastFundsAmounts : {});
      }
    };
    dom.rankedEntryApprove.addEventListener('click', onApprove);
    dom.rankedEntryCancel.addEventListener('click', onCancel);
    freeLink?.addEventListener('click', onFree);

    if (!SETTLEMENT_LIVE) {
      if (needsSignIn) {
        setStatus('', 'Sign in with your wallet to play the Local Ranked Testnet preview. The signature is free and sends no transaction.');
      } else {
        readyToPay = true;
        setStatus('ok', `✓ Local Ranked Testnet preview. The ${RANKED_ENTRY_FEE_ZKLTC} zkLTC entry is not charged until verified settlement is live; canonical evidence is saved locally and no chain transaction will occur.`);
      }
      refreshApprove();
      return;
    }

    // Live: show the cached background pre-flight at once, then refresh.
    const cached = peekRankedPreflight(requestedGameId);
    if (cached?.entryTotalWei !== null && cached?.entryTotalWei !== undefined) renderEntryTotals(cached.settlementGasReserveWei ?? 0n, cached.entryTotalWei);
    if (cached && dom.rankedEntryBalance) dom.rankedEntryBalance.textContent = `${formatZkLtc4(cached.balanceWei ?? 0n)} zkLTC`;
    if (needsSignIn) setStatus('', 'Sign in with your wallet to play Ranked. The signature is free and sends no transaction.');

    // Prefetch the seed ticket (no wallet prompt) so a paused service stops
    // the entry before anything is paid. Refetched at approval if stale.
    function prefetchSeedTicket() {
      if (!pendingSession || entryFeeWei === '0' || halted) return;
      const request = obtainSeedTicket({ reauth: false }).then((result) => {
        if (!closed && !result.ok && isRankedPaused(result)) showPaused();
        return result;
      }).catch(() => null);
      prefetchInFlight = request;
      void request.then(() => { if (prefetchInFlight === request) prefetchInFlight = null; });
    }
    if (!needsSignIn) prefetchSeedTicket();

    // Only the latest check for this still-open modal may change admission.
    const runCheck = async () => {
      if (closed) return;
      const sequence = ++checkSequence;
      readyToPay = false;
      refreshApprove();
      guard.hidden = true;
      guard.replaceChildren();
      const r = await checkRankedReadiness(provider, { gameId: requestedGameId, wallet: connectedWallet });
      if (closed || halted || sequence !== checkSequence) return;
      if (!r.onChain && r.chainId !== null && r.chainId !== undefined) {
        if (dom.rankedEntryBalance) dom.rankedEntryBalance.textContent = '—';
        showWalletError({ kind: 'wrong-network' }, { chainId: r.chainId });
        return;
      }
      if (r.error) {
        if (dom.rankedEntryBalance) dom.rankedEntryBalance.textContent = '—';
        showRetry(r.errorKind === 'contract-gate' ? r.error : walletErrorAction({ kind: 'wallet-error', message: r.error }).message);
        return;
      }
      // Right chain → the contract's exact quote and the balance (rounded
      // down, like every balance; the amount owed rounds up).
      if (r.contractGate?.entryTotalWei !== undefined) renderEntryTotals(r.contractGate.settlementGasReserveWei ?? 0n, r.contractGate.entryTotalWei);
      const balanceText = `${formatZkLtc4(r.balanceWei ?? 0n)} zkLTC`;
      if (dom.rankedEntryBalance) dom.rankedEntryBalance.textContent = balanceText;
      lastFundsAmounts = { totalZkLtc: formatZkLtc4(r.needWei ?? entryTotalWei, { roundUp: true }), balanceZkLtc: balanceText };
      if (!r.hasFunds) {
        showWalletError({ kind: 'insufficient-funds' }, lastFundsAmounts);
        return;
      }
      if (r.ok !== true) {
        showRetry('Ranked prerequisites could not be verified.');
        return;
      }
      latestQuote = r.contractGate ? { ok: true, gameId: requestedGameId, ...r.contractGate } : null;
      if (latestQuote && BigInt(latestQuote.entryTotalWei ?? 0n) === 0n) { showHalted(RANKED_CLOSED_MESSAGE); return; }
      readyToPay = true;
      if (!needsSignIn) setStatus('ok', '✓ Ready. One confirmation in your wallet starts the run.');
      refreshApprove();
    };
    runCheck();
  });
}

async function beginOfficialLevel(levelId = combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID, options = {}) {
  if (selectedGameId === 'lester-blaster') {
    // Start in the player's click turn, before session work can consume the
    // browser's autoplay permission. Playback failure never blocks gameplay.
    void startArcadeMusicForGame('hard-money-heroes');
    combat.currentCampaignLevelId = levelId;
    if (!currentSession) await startOfficialMode(officialSelectedMode ?? 'free');
    setOfficialView('gameplay');
    mountHmhRebootSession();
    gameAdapter = createInProcessGameAdapter({
      gameId: 'hard-money-heroes',
      sessionId: currentSession.sessionId,
      rankedEligible: currentSession.isPaid,
    });
    gameAdapter.start({ mode: officialSelectedMode ?? 'free', characterId: hmhRebootHeroId() });
    return;
  }
  // Cabinet clicks normally load HMH first, but direct/deep-linked free runs can
  // reach this path without that click. Never start combat with an empty roster.
  await ensureHMHLoaded();
  const level = getHmhCampaignLevel(levelId);
  combat.currentCampaignLevelId = level.id;
  if (!currentSession) await startOfficialMode(officialSelectedMode ?? 'free');
  setOfficialView('gameplay');

  // GameRegistry integration for shared profile (parent-account identity)
  const profile = await getSharedPlayerProfile(connectedWallet);
  debugRuntimeLog('[GameRegistry] Profile loaded for run:', profile.displayName);

  // Show cinematic loading screen with keyart + progress + level title.
  // The game world is generated INSIDE the loading callback but kept FROZEN
  // (combat.paused + combat.pendingBegin) until the player confirms ready,
  // so they see the canvas behind the ready overlay before the game starts.
  await showHMHLoadingScreen(async () => {
    await startCombat({ levelId: level.id, carryOver: options.carryOver ?? null, startPendingBegin: true });
    const prewarmedHeroFrames = prewarmSelectedHeroActorRegistry(HMH_ACTOR_REGISTRY, combat.characterId);
    if (DEBUG_ARCADE_RUNTIME && prewarmedHeroFrames > 0) {
      console.info('[HMH] prewarmed selected hero opening frames', combat.characterId, prewarmedHeroFrames);
    }
    // World is generated and painted, but the sim/audio stay frozen until READY.
    render();
  }, level);
  // Wait for the player to press SPACE or click the ready overlay.
  await waitForPlayerReady();
  playSfxCue('level-start');
  await startArcadeMusicForGame('hard-money-heroes');

  // SDK adapter: emit sessionStart now that the player has begun.
  gameAdapter = createInProcessGameAdapter({ gameId: 'hard-money-heroes' });
  gameAdapter.start({ mode: officialSelectedMode ?? 'free', characterId: combat.characterId });
  debugRuntimeLog('[SDK] Game session started:', gameAdapter.gameId, gameAdapter.getState());
}

async function continueToCampaignLevel(levelId) {
  const level = getHmhCampaignLevel(levelId);
  const carryOver = {
    health: combat.health,
    grenades: combat.grenades,
    weaponId: combat.weaponId,
    weaponUpgrades: { ...(combat.weaponUpgrades ?? {}) },
    roguelikeRun: combat.roguelikeRun ? {
      stats: { ...(combat.roguelikeRun.stats ?? {}) },
      skills: { ...(combat.roguelikeRun.skills ?? {}) },
    } : null,
  };
  combat.currentCampaignLevelId = level.id;
  combat.gameOver = false;
  combat.levelClearTitle = '';
  combat.clearedCampaignLevelId = null;
  combat.levelClearSource = null;
  dom.combatGameOverSummary?.replaceChildren();
  await beginOfficialLevel(level.id, { carryOver });
}

// Block until the user presses SPACE / Enter / clicks the ready overlay. The
// overlay is rendered after the HMH loading screen finishes, so the player
// sees the real combat canvas behind a semi-transparent "press to begin"
// message instead of the game already running under a faded keyart.
function waitForPlayerReady() {
  return new Promise((resolve) => {
    // If the user hasn't actually reached gameplay yet (e.g. test env, no
    // combat mount), resolve immediately — nothing to show.
    if (!dom.officialCombatMount) { combat.pendingBegin = false; combat.paused = false; resolve(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'hmhReadyOverlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(6,8,18,0.55);cursor:pointer;backdrop-filter:blur(1.5px);transition:opacity 360ms ease;';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:monospace;font-size:42px;font-weight:900;color:#ffe84d;letter-spacing:6px;text-shadow:0 0 28px rgba(255,232,77,0.65), 3px 3px 0 #000;text-align:center;';
    title.textContent = HMH_COPY_SHEET.readyOverlay.title;

    const hint = document.createElement('div');
    hint.style.cssText = 'font-family:monospace;font-size:14px;font-weight:700;color:#cfefff;letter-spacing:3px;margin-top:18px;text-shadow:0 0 8px rgba(25,247,255,0.5);';
    hint.textContent = HMH_COPY_SHEET.readyOverlay.hint;

    overlay.append(title, hint);
    // Position relative to the combat mount so it sits over the canvas.
    const mount = dom.officialCombatMount;
    const prevPos = getComputedStyle(mount).position;
    if (prevPos === 'static') mount.style.position = 'relative';
    mount.appendChild(overlay);

    const cleanup = () => {
      overlay.removeEventListener('click', onActivate);
      document.removeEventListener('keydown', onKey);
      overlay.style.opacity = '0';
      setTimeout(() => { try { overlay.remove(); } catch {} if (prevPos === 'static') mount.style.position = prevPos; }, 400);
      combat.pendingBegin = false;
      combat.paused = false;
      syncCombatOverlay();
      playSfxCue('menu-click', 0.05);
      resolve();
    };
    let activating = false;
    const onActivate = () => {
      if (activating) return;
      activating = true;
      try {
        if (gameSettings.autoEnterFullscreen && !document.fullscreenElement) {
          void requestCombatFullscreen().catch((error) => {
            debugRuntimeLog('[HMH] fullscreen entry skipped; run continues in current viewport', error);
          });
        }
      } catch (error) {
        debugRuntimeLog('[HMH] fullscreen request unavailable; run continues in current viewport', error);
      } finally {
        cleanup();
      }
    };
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        onActivate();
      }
    };
    overlay.addEventListener('click', onActivate);
    document.addEventListener('keydown', onKey);
  });
}


function hmhLoadingBackgroundForLevel(levelMeta = currentCampaignLevel()) {
  const level = getHmhCampaignLevel(levelMeta?.id ?? levelMeta ?? DEFAULT_CAMPAIGN_LEVEL_ID);
  // Level 1 should not show legacy/key-art enemy hordes during load. The actual
  // authored gameplay canvas appears immediately behind READY after generation.
  if (level.id === HMH_LEVEL_ONE_ID) return null;
  return HMH_LOADING_KEYARTS[Math.floor(Math.random() * HMH_LOADING_KEYARTS.length)] ?? HMH_KEY_ART_BG; // cosmetic-rng-ok loading art rotation only
}

function hmhNeutralLoadingBackground() {
  return 'radial-gradient(circle at 50% 44%, rgba(33, 255, 184, 0.22), rgba(7, 12, 31, 0.18) 28%, rgba(4, 8, 24, 0.96) 72%), linear-gradient(135deg, #06081d 0%, #12113a 44%, #071a24 100%)';
}

async function showHMHLoadingScreen(onComplete, levelMeta = currentCampaignLevel()) {
  const level = getHmhCampaignLevel(levelMeta?.id ?? levelMeta ?? DEFAULT_CAMPAIGN_LEVEL_ID);
  const bgUrl = hmhLoadingBackgroundForLevel(level);
  // Create loading overlay (fully opaque so nothing behind it is visible until
  // we're ready to reveal the freshly-initialized roguelike scene).
  const overlay = document.createElement('div');
  overlay.id = 'hmhLoadingOverlay';
  overlay.className = 'hmh-loading-overlay';
  overlay.style.backgroundImage = bgUrl ? `url(${bgUrl})` : hmhNeutralLoadingBackground();


  // Progress bar container
  const barContainer = document.createElement('div');
  barContainer.className = 'hmh-loading-progress-shell';

  const bar = document.createElement('div');
  bar.className = 'hmh-loading-progress-fill';
  barContainer.appendChild(bar);

  // Status text
  const status = document.createElement('div');
  status.className = 'hmh-loading-status';
  status.textContent = 'INITIALIZING HARD MONEY HEROES...';

  overlay.append(barContainer, status);
  document.body.appendChild(overlay);

  // Progress bar animation
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 4 + 1.5; // cosmetic-rng-ok loading progress shimmer only
    if (progress > 100) progress = 100;
    bar.style.width = progress + '%';
    if (progress > 35) status.textContent = 'RENDERING DISTRICTS & ROAD NETWORK...';
    if (progress > 65) status.textContent = 'LOADING SPRITE SHEETS & ENEMIES...';
    if (progress > 85) status.textContent = level.loadingStatus ?? `PREPARING LEVEL ${level.number}...`;
  }, 85);

  // Run the actual game setup while the keyart + progress bar are showing.
  // This way roguelike world generation happens behind the loading screen,
  // and when the user peeks through the next overlay transition, the
  // roguelike scene is already painted — no flash of the old 2D background.
  try {
    await onComplete();
    await Promise.race([
      prewarmHmhLevelAssets(level, ({ done, total }) => {
        if (total > 0) {
          progress = Math.max(progress, 70 + (done / total) * 25);
          bar.style.width = `${Math.min(99, progress)}%`;
          status.textContent = `DECODING LEVEL ART ${done}/${total}...`;
        }
      }),
      new Promise((resolve) => setTimeout(resolve, 5000, 'prewarm-timeout')),
    ]);
  } catch (err) {
    console.error('[HMH] loading screen onComplete failed:', err);
  }

  // When progress finishes OR onComplete resolves (whichever is later),
  // wait for one render frame so the roguelike scene's first paint lands.
  if (progress < 100) {
    await new Promise((resolve) => {
      const tick = () => {
        if (progress >= 100) resolve();
        else setTimeout(tick, 60);
      };
      tick();
    });
  }
  clearInterval(interval);
  bar.style.width = '100%';
  await new Promise((resolve) => requestAnimationFrame(resolve));

  // Fade out keyart, show level title overlay with an opaque background so
  // the roguelike scene doesn't peek through.
  await new Promise((resolve) => setTimeout(resolve, 180));
  overlay.style.transition = 'opacity 420ms ease';
  overlay.style.opacity = '0';

  const titleOverlay = document.createElement('div');
  titleOverlay.id = 'hmhLoadingTitleOverlay';
  titleOverlay.className = 'hmh-loading-title-overlay';

  const title = document.createElement('div');
  title.className = 'hmh-loading-title-card';
  title.textContent = formatHmhCampaignLevelBanner(level).toUpperCase();
  titleOverlay.appendChild(title);
  document.body.appendChild(titleOverlay);

  requestAnimationFrame(() => {
    title.style.opacity = '1';
    title.style.transform = 'translateY(0)';
  });

  // Hold title for ~2.4s, then cross-fade to the live roguelike scene.
  await new Promise((resolve) => setTimeout(resolve, 2400));
  title.style.transition = 'all 480ms ease';
  title.style.opacity = '0';
  title.style.transform = 'translateY(-40px)';
  // Cross-fade the opaque title overlay to reveal the roguelike scene behind it.
  titleOverlay.style.transition = 'opacity 520ms ease';
  titleOverlay.style.opacity = '0';

  await new Promise((resolve) => setTimeout(resolve, 560));
  try { titleOverlay.remove(); } catch {}
  try { overlay.remove(); } catch {}
}


function detectEthereumProvider() {
  // The provider the player picked (EIP-6963, legacy or WalletConnect) wins.
  // Otherwise prefer an EIP-6963-announced provider (handles MetaMask + Rabby
  // installed together), then the legacy window.ethereum. Some wallet
  // extensions expose `ethereum` as a throwing getter, or multiple wallets race
  // to define it, so never let provider detection itself throw — a throw here
  // would bubble up through the connect handler and blank the app.
  if (connectedProvider?.request) return connectedProvider;
  // A restored WalletConnect session has no provider until the player's next
  // wallet action creates it (ensureWalletProvider); another installed wallet
  // must never stand in for it.
  if (walletProviderPending) return null;
  try {
    const preferred = eip6963Registry.preferred();
    if (preferred?.provider?.request) return preferred.provider;
  } catch { /* registry empty or malformed */ }
  try {
    return globalThis.ethereum ?? null;
  } catch {
    return null;
  }
}

function legacyInjectedProvider() {
  try {
    const legacy = globalThis.ethereum;
    return legacy?.request ? legacy : null;
  } catch {
    return null;
  }
}

function currentWalletHost() {
  try { return location.hostname; } catch { return ''; }
}

function isMobileWalletDevice() {
  try {
    if (navigator.userAgentData?.mobile) return true;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '');
  } catch {
    return false;
  }
}

// Lazy sign-in modules (contract §11 rule 5): nothing loads until the player
// signs in, opens Ranked, or a live chip needs it.
let walletPickerModule = null;
function loadWalletPicker() {
  walletPickerModule ??= import('./src/wallet-picker.mjs');
  return walletPickerModule;
}
let walletChipsModule = null;
let walletChipsLoaded = null;
function loadWalletChips() {
  walletChipsModule ??= import('./src/wallet-chips.mjs').then((module) => { walletChipsLoaded = module; return module; });
  return walletChipsModule;
}
function loadRankedIdentity() {
  return import('./src/ranked-identity.mjs');
}
let rankedPreflight = null;
function loadRankedPreflight() {
  if (rankedPreflight) return Promise.resolve(rankedPreflight);
  return import('./src/ranked-preflight.mjs').then(({ createRankedPreflight }) => {
    rankedPreflight ??= createRankedPreflight({ live: SETTLEMENT_LIVE, loadEthers });
    return rankedPreflight;
  });
}

// The picker's stylesheet also carries the Ranked modal's small-screen rules.
function ensureWalletStylesheet() {
  try {
    if (document.getElementById('walletPickerStyles')) return;
    const link = document.createElement('link');
    link.id = 'walletPickerStyles';
    link.rel = 'stylesheet';
    link.href = 'src/styles/wallet-picker.css';
    document.head.append(link);
  } catch { /* non-DOM env */ }
}

function showWalletNotice(message, { tone = 'info', actions = [] } = {}) {
  if (!message) return;
  void loadWalletPicker()
    .then(({ showWalletToast }) => showWalletToast({ documentRef: document, message, tone, actions }))
    .catch(() => {});
}

// Background Ranked pre-flight (live only): started from mode select so the
// Ranked modal opens with the quote and balance already known.
function startRankedPreflightInBackground() {
  if (!SETTLEMENT_LIVE || !connectedWallet || !walletAuthenticated || walletConnector !== 'injected-evm') return;
  // A WalletConnect session restored at boot has no provider yet; the
  // pre-flight never creates AppKit.
  const walletProvider = walletProviderPending ? null : detectEthereumProvider();
  const gameId = selectedGameId;
  const wallet = connectedWallet;
  void loadRankedPreflight()
    .then((preflight) => preflight.start({ gameId, wallet, walletProvider }))
    .catch(() => {});
}
function peekRankedPreflight(gameId) {
  return rankedPreflight?.peek({ gameId, wallet: connectedWallet }) ?? null;
}

// The "Entry confirming…" chip (lazy): follows lesters:ranked-entry. The
// status is read once the module has loaded, so an entry that settled while
// it loaded (first use, a slow network) is shown settled, not confirming.
function showEntryChip(session) {
  void loadWalletChips()
    .then(({ mountEntryChip }) => {
      const status = session?.entryReceipt?.status === 'pending' ? 'broadcast' : session?.entryReceipt?.status;
      return mountEntryChip({ documentRef: document, eventTarget: window, sessionId: session.sessionId, status });
    })
    .catch(() => {});
}

// The nav balance chip (live only; public RPC). Fetched on sign-in, restore
// and after an entry; render() only re-places the last value.
let walletBalanceState = null;
function refreshWalletBalanceChip() {
  if (!SETTLEMENT_LIVE || !connectedWallet || walletConnector !== 'injected-evm') {
    walletBalanceState = null;
    try { document.querySelector('.wallet-balance-chip')?.remove(); } catch { /* non-DOM env */ }
    return;
  }
  const wallet = connectedWallet;
  void Promise.all([loadWalletChips(), fetchWalletBalance(wallet)]).then(([, balanceWei]) => {
    if (wallet !== connectedWallet || balanceWei === null) return;
    const needWei = BigInt(rankedEntryTotalWei()) + RANKED_ENTRY_GAS_UNITS * RANKED_ENTRY_FALLBACK_FEE_PER_GAS_WEI;
    walletBalanceState = { wallet, balanceWei, needWei };
    placeWalletBalanceChip();
  }).catch(() => {});
}
function placeWalletBalanceChip() {
  try {
    if (!walletBalanceState || !walletChipsLoaded || walletBalanceState.wallet !== connectedWallet) return;
    const container = document.querySelector('.official-nav-account');
    if (container) walletChipsLoaded.renderBalanceChip({ documentRef: document, container, balanceWei: walletBalanceState.balanceWei, needWei: walletBalanceState.needWei });
  } catch { /* before the chip state exists (early boot render) or a non-DOM env */ }
}

// A remembered WalletConnect session gets its provider on the first action
// that needs the wallet (Sign in, the Ranked entry, a profile write), never at
// boot. AppKit reconnects the stored session without a modal when it can.
async function ensureWalletProvider() {
  if (!walletProviderPending) return Boolean(detectEthereumProvider()?.request);
  try {
    const { createWalletConnectProvider } = await import('./src/walletconnect-provider.mjs');
    let provider = await createWalletConnectProvider({ reconnectOnly: true });
    if (!provider) provider = await createWalletConnectProvider({});
    if (!provider?.request) return false;
    let accounts = [];
    try { accounts = await provider.request({ method: 'eth_accounts' }); } catch { accounts = []; }
    const account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account) return false;
    connectedProvider = provider;
    connectedAddress = account;
    walletProviderPending = false;
    bindWalletProviderEvents(provider);
    if (account.toLowerCase() !== connectedWallet) {
      // Another account came back: it has not signed this session, unless it
      // holds a live session of its own. It is remembered from now on.
      connectedWallet = account.toLowerCase();
      syncWalletAuthentication();
      connectPlayerAccount(state, connectedWallet, { handle: 'LitVM Pilot' });
      render();
    }
    await refreshInjectedChainId(provider);
    return true;
  } catch (error) {
    console.warn('[Wallet] WalletConnect could not reconnect:', error?.message ?? error);
    return false;
  }
}

// The provider for a wallet action started by a DOM click (a profile write,
// the Ranked entry): a WalletConnect session restored at boot gets its
// provider here, never at boot. Null when no wallet can act.
async function walletProviderForAction() {
  if (walletProviderPending && !(await ensureWalletProvider())) return null;
  const provider = detectEthereumProvider();
  return provider?.request ? provider : null;
}

// The remembered connector follows the account the picked wallet is on, so a
// reload restores the account the player last signed with.
function rememberPickedWallet(session = walletSession) {
  if (!session || !walletPickKind || !connectedWallet || walletConnector !== 'injected-evm') return;
  session.remember({ kind: walletPickKind, rdns: walletPickRdns, wallet: connectedWallet });
}

// After the connected account changed: signed in only if that account holds a
// live session of its own; announced (lesters:wallet-session) and remembered.
function syncWalletAuthentication() {
  const wallet = connectedWallet;
  const apply = (session) => {
    if (wallet !== connectedWallet) return false;
    walletAuthenticated = Boolean(wallet) && session.isAuthenticated(wallet);
    session.announce({ wallet, authenticated: walletAuthenticated });
    rememberPickedWallet(session);
    return true;
  };
  if (walletSession) { apply(walletSession); return; }
  walletAuthenticated = false;
  void loadWalletSession().then((session) => { if (apply(session)) render(); }).catch(() => {});
}
function announceWalletSignedOut() {
  if (walletSession) { walletSession.announce({ wallet: null, authenticated: false }); return; }
  void loadWalletSession().then((session) => session.announce({ wallet: null, authenticated: false })).catch(() => {});
}

// Sign-In-With-Ethereum (contract §7.6, A13): one plain-language signature
// binds the session to the address. Hosted: server nonce + issuedAt, then
// POST /api/session (24 h Bearer token). Preview: the local challenge checked
// with ethers.verifyMessage, no network. A decline keeps the wallet connected
// (Free Mode works) but leaves walletAuthenticated=false, so Ranked asks
// again from its modal's button. `address` is the account exactly as the
// wallet returned it.
async function authenticateWalletSiwe(provider, address) {
  if (!provider?.request || !address) return false;
  let session = null;
  try {
    session = await loadWalletSession();
  } catch {
    showWalletNotice('Sign-in could not load. Check your connection and try again. Free Mode still works.', { tone: 'warning' });
    return false;
  }
  const result = await session.signIn({ provider, address });
  walletAuthenticated = Boolean(result.ok && result.authenticated);
  if (walletAuthenticated) {
    if (HOSTED_PROFILE_SYNC && result.expiresAt) debugRuntimeLog('[Profile] Hosted session issued until', new Date(result.expiresAt).toISOString());
    // A fresh login is what a reload restores: remember this account.
    rememberPickedWallet(session);
    refreshWalletBalanceChip();
    return true;
  }
  const kind = result.error?.kind ?? 'wallet-error';
  showWalletNotice(kind === 'user-cancelled'
    ? 'You cancelled the sign-in. Free Mode still works; Ranked asks you to sign in.'
    : result.error?.message ?? 'Sign-in did not complete. Try again.', { tone: 'warning' });
  return false;
}

function connectMockWallet() {
  // Reached whenever no injected provider answers. Every surface that shows the
  // resulting identity labels it as simulated (see renderSimulatedWalletNotice);
  // this warning is for anyone reading the console during QA.
  console.warn('[Wallet] No browser wallet answered — signing in with the simulated local identity. Nothing will settle on-chain.');
  connectedWallet = MOCK_WALLET;
  // GameRegistry shared profile (parent-account identity) — fire and forget
  getSharedPlayerProfile(connectedWallet).then((profile) => {
    debugRuntimeLog('[GameRegistry] Loaded shared profile:', profile);
  });

  connectedChainId = null;
  connectedProvider = null;
  connectedAddress = null;
  walletProviderPending = false;
  walletPickKind = null;
  walletPickRdns = null;
  walletConnector = 'mock-wallet';
  connectPlayerAccount(state, connectedWallet, { handle: 'Lester Pilot' });
  persistArcadeStateSoon();
  render();
  return connectedWallet;
}

// Sign out: clear the connected wallet/session and return to the wallet splash.
// Local sandbox only — does not touch on-chain state.
function signOutWallet() {
  showSignOutConfirmModal();
}

function showSignOutConfirmModal() {
  const modal = el('div', { className: 'modal-overlay signout-confirm-modal' });
  const content = el('div', { className: 'modal-content signout-modal' });
  appendText(content, 'h3', 'Sign Out');
  appendText(content, 'p', 'Are you sure you want to sign out? This will disconnect your wallet and return you to the Lester\'s Arcade homepage.');
  const actions = el('div', { className: 'modal-actions' });
  const cancelButton = el('button', { className: 'btn btn-secondary signout-cancel', type: 'button', textContent: 'Cancel' });
  const confirmButton = el('button', { className: 'btn btn-danger signout-confirm', type: 'button', textContent: 'Sign Out' });
  actions.append(cancelButton, confirmButton);
  content.append(actions);
  modal.append(content);
  document.body.appendChild(modal);
  
  modal.querySelector('.signout-cancel').addEventListener('click', () => {
    playSfxCue('menu-click', 0.05);
    modal.remove();
  });
  
  modal.querySelector('.signout-confirm').addEventListener('click', () => {
    playSfxCue('menu-click', 0.05);
    modal.remove();
    executeSignOut();
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      playSfxCue('menu-click', 0.05);
      modal.remove();
    }
  });
  
  // Close on Escape key
  const onEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', onEscape);
    }
  };
  document.addEventListener('keydown', onEscape);
}

// Ends the WalletConnect session on sign-out, including one restored at boot
// whose provider was never created (restoreFirst): AppKit reconnects the
// stored relay session, then disconnects it, so the next WalletConnect pick on
// this device asks again. Sign-out is a click, so creating AppKit here is fine.
function endWalletConnectSession({ restoreFirst = false } = {}) {
  return import('./src/walletconnect-provider.mjs')
    .then(({ disconnectWalletConnect }) => disconnectWalletConnect({ restoreFirst }))
    .catch(() => {});
}

function executeSignOut() {
  profileSync.flush(connectedWallet).catch(() => {});
  // Drops the Bearer token, the preview flag and the remembered connector, and
  // announces lesters:wallet-session. A WalletConnect session is ended too.
  if (walletSession) walletSession.signOut();
  else void loadWalletSession().then((session) => session.signOut()).catch(() => {});
  if (walletPickKind === 'walletconnect') void endWalletConnectSession({ restoreFirst: !connectedProvider });
  profileSyncPulledFor = null;
  profileSyncLastPushed = null;
  resetCombatAudioVoiceState();
  playSfxCue('menu-click', 0.05);

  // 1) Stop any in-progress combat loop so the canvas + game loop don't
  //    continue in the background. Forces the roguelike run to end so the
  //    next sign-in starts fresh on the gameplay screen.
  combat.active = false;
  combat.paused = true;
  combat.gameOver = true;
  combat.gameOverReason = 'signout';
  combat.roguelikeRun = null;
  combat.weaponUpgrades = Object.freeze({});
  combat.lastTimestamp = 0;
  combat.frameTimes.length = 0;
  combat.updateTimes.length = 0;
  combat.renderTimes.length = 0;
  combat.fixedStepStats = createFixedStepStats();

  // 2) Tear down any lingering full-screen or modal overlays that were left
  //    around from the in-progress session (level-up cards, HMH loading,
  //    etc.). Defensive — most are already cleaned up by the caller.
  try {
    document.querySelectorAll('#hmhLoadingOverlay, #hmhLoadingTitleOverlay, #cartridgeLoadingOverlay, #levelUpOverlay, .level-up-overlay')
      .forEach((node) => { try { node.remove(); } catch (_) {} });
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  } catch (_) { /* non-DOM env (Node test) — ignore */ }

  // 3) Clear all per-session wallet/profile/progress state. The render()
  //    call below will recompute every view from these reset values.
  connectedWallet = null;
  connectedChainId = null;
  walletConnector = 'none';
  connectedProvider = null;
  connectedAddress = null;
  walletProviderPending = false;
  walletPickKind = null;
  walletPickRdns = null;
  walletAuthenticated = false;
  walletAuthChallenge = null;
  refreshWalletBalanceChip();
  currentSession = null;
  lastCompletedSession = null;
  lastRunScore = 0;
  lastBossId = null;
  // Force any cached profile reference to drop so the nav/leaderboard/profile
  // views don't keep showing the previous player's identity.
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      // Intentionally do NOT clear localStorage — avatar/name persist across
      // sign-ins. Just make sure our in-memory caches are dropped.
    }
  } catch (_) {}

  // 4) Reset the official app shell back to the wallet-splash step so the
  //    homepage renders in the signed-out state and the URL returns to '/'.
  officialAppStep = 'wallet-splash';
  officialSelectedMode = null;

  // 5) Re-render through the normal route-sync path so the browser history
  //    is also reset to the homepage. Wrapped in try/catch so a render error
  //    here doesn't mask the sign-out itself — the user MUST always land on
  //    the homepage after clicking confirm.
  try {
    setOfficialView('wallet-splash');
  } catch (err) {
    console.error('[signOut] setOfficialView() failed, forcing hard reload:', err);
    try { location.hash = ''; location.reload(); } catch (_) {}
  }
}

// Avatar is stored client-side as a data URL on the player profile object so it
// survives within the session and shows in nav / profile / leaderboards.
function playerAvatarDataUrl(wallet = connectedWallet) {
  if (!wallet) return null;
  return state.profiles?.[wallet]?.avatarDataUrl ?? null;
}
function setPlayerAvatar(wallet, dataUrl) {
  if (!wallet || !state.profiles?.[wallet]) return;
  state.profiles[wallet].avatarDataUrl = dataUrl;
  persistArcadeStateSoon();
}

// Re-encode an uploaded avatar through an off-screen <canvas>: downscale to fit
// AVATAR_RULES.maxDimension and re-emit as JPEG. Drawing to a canvas and reading
// back a data URL inherently strips EXIF/GPS and any embedded metadata, and the
// downscale caps stored size. Returns a sanitized data URL, or rejects on a
// load error (e.g. a non-image masquerading as image/png). Pure box-fit math
// lives in computeAvatarResize() (tested); this is the DOM-bound shell.
function sanitizeAvatarImage(rawDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = computeAvatarResize(
          img.naturalWidth,
          img.naturalHeight,
          AVATAR_RULES.maxDimension,
        );
        if (!width || !height) {
          reject(new Error('avatar-empty-dimensions'));
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('avatar-no-2d-context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // toDataURL re-encodes pixels only — no source metadata survives.
        resolve(canvas.toDataURL(AVATAR_RULES.outputType, AVATAR_RULES.outputQuality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('avatar-decode-failed'));
    img.src = rawDataUrl;
  });
}
// Build a small avatar element: the uploaded image, or a colored initial chip.
function renderAvatarChip(wallet, displayName, sizeClass = '') {
  const url = playerAvatarDataUrl(wallet);
  if (url) {
    const img = el('img', { className: `avatar-chip-img ${sizeClass}`, src: url, alt: 'Player avatar' });
    return img;
  }
  // Default avatar: the Litecoin Chad PFP (replaces the old green initial chip).
  const img = el('img', { className: `avatar-chip-img avatar-chip-default ${sizeClass}`, src: DEFAULT_AVATAR_SRC, alt: 'Default Litecoin Chad avatar' });
  return img;
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

// The wallets this browser can offer: EIP-6963 announcements, the legacy
// window.ethereum slot, and WalletConnect on the Reown-allowed hosts.
async function walletPickerProviders() {
  // A wallet that loaded after the page gets a moment to announce itself.
  if (!eip6963Registry.size()) await waitForAnnouncedWallet(null, 300);
  const providers = eip6963Registry.list();
  const legacy = legacyInjectedProvider();
  return legacy ? [...providers, { kind: 'legacy', name: legacy.isMetaMask ? 'MetaMask' : 'Browser wallet' }] : providers;
}

// Returns the player's choice: a picker entry, { kind:'simulated' } when no
// real wallet exists at all (local QA fallback), or null when dismissed.
async function chooseWallet() {
  const [providers, picker] = await Promise.all([walletPickerProviders(), loadWalletPicker()]);
  const model = picker.buildWalletPickerModel({ providers, isMobile: isMobileWalletDevice(), host: currentWalletHost(), remembered: walletSession?.remembered() ?? null });
  if (model.simulated) return { kind: 'simulated' };
  // One browser wallet and nothing else to offer: connect it directly.
  if (model.entries.length === 1 && !model.walletConnect) return model.entries[0];
  return picker.openWalletPicker({ documentRef: document, model });
}

async function providerForWalletChoice(choice) {
  if (choice.kind === 'eip6963') return eip6963Registry.list().find((detail) => detail.uuid === choice.uuid)?.provider ?? null;
  if (choice.kind === 'legacy') return legacyInjectedProvider();
  if (choice.kind === 'walletconnect') {
    try {
      const { createWalletConnectProvider } = await import('./src/walletconnect-provider.mjs');
      const provider = await createWalletConnectProvider({});
      if (!provider) showWalletNotice('WalletConnect closed before a wallet connected. You are still playing Free.');
      return provider;
    } catch (error) {
      console.warn('[Wallet] WalletConnect unavailable:', error?.message ?? error);
      showWalletNotice('WalletConnect could not open. Try again, or use a browser wallet.', { tone: 'error' });
      return null;
    }
  }
  return null;
}

// Sign in with the chosen provider: accounts (the one account prompt), the
// LiteForge explainer and switch, then the SIWE signature.
async function signInWithWalletProvider(provider, choice) {
  let address = null;
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    address = Array.isArray(accounts) ? (accounts.find((account) => /^0x[0-9a-fA-F]{40}$/.test(String(account ?? ''))) ?? null) : null;
  } catch (error) {
    // A declined connection stays signed out (no simulated fallback).
    const classified = classifyWalletError(error);
    showWalletNotice(classified.kind === 'user-cancelled'
      ? 'You cancelled in your wallet, so you are still signed out. Free Mode needs no wallet.'
      : `Your wallet did not connect: ${walletErrorAction(classified).message}`, { tone: 'warning' });
    return null;
  }
  if (!address) {
    showWalletNotice('Your wallet shared no account. Unlock it and try again.', { tone: 'warning' });
    return null;
  }
  connectedWallet = address.toLowerCase();
  connectedAddress = address;
  connectedProvider = provider;
  walletProviderPending = false;
  walletPickKind = choice.kind;
  walletPickRdns = choice.rdns ?? null;
  walletConnector = 'injected-evm';
  walletAuthenticated = false;
  walletAuthChallenge = null;
  bindWalletProviderEvents(provider);
  // Remembered now; a reload restores it only with a live session (restore()
  // checks the token), so a later sign-in from the Ranked modal counts too.
  try { rememberPickedWallet(await loadWalletSession()); } catch { /* remembered at the SIWE step, or next time */ }
  debugRuntimeLog('[Wallet] Connected:', connectedWallet);
  // One explainer, then switch (or add) LiteForge. A refusal keeps the player
  // signed in for Free play; the Ranked modal offers the switch again.
  const chain = await ensureLiteForgeAtSignIn({
    readChainId: () => refreshInjectedChainId(provider),
    explain: () => loadWalletPicker().then(({ openChainExplainer }) => openChainExplainer({
      documentRef: document, networkName: LITVM_LITEFORGE_NETWORK.name, chainId: LITVM_LITEFORGE_NETWORK.chainId,
    })),
    requestNetwork: () => requestLiteForgeNetwork(provider),
    chainId: LITVM_LITEFORGE_NETWORK.chainId,
  });
  if (chain.declined) showWalletNotice(`Free Mode works on any network. Ranked asks to switch to ${LITVM_LITEFORGE_NETWORK.name} when you start a run.`);
  await authenticateWalletSiwe(provider, address);
  // A throw HERE means the wallet connected fine but a downstream render
  // failed: keep the connection and log.
  try {
    connectPlayerAccount(state, connectedWallet, { handle: 'LitVM Pilot' });
    persistArcadeStateSoon();
    render();
    pullProfileFromCloud(connectedWallet).catch((error) => console.warn('[Profile] Hosted profile pull failed:', error));
  } catch (renderError) {
    console.error('[Wallet] Connected but post-connect render failed:', renderError);
  }
  return connectedWallet;
}

// One sign-in at a time: a double click on Sign in, or a click while the
// picker is still loading, joins the sign-in in progress instead of opening a
// second picker. `allowSimulated: false` (a vanished provider in the Ranked
// modal) never swaps a real identity for the simulated one.
let walletSignInInFlight = null;
function signInFromPicker({ allowSimulated = true } = {}) {
  if (walletSignInInFlight) return walletSignInInFlight;
  const attempt = (async () => {
    const choice = await chooseWallet();
    debugRuntimeLog('[Wallet] Choice:', choice?.kind ?? 'dismissed');
    // The simulated local identity only when no wallet exists at all.
    if (choice?.kind === 'simulated') {
      if (allowSimulated) return connectMockWallet();
      showWalletNotice('No browser wallet answered. Unlock or install your wallet, then sign in again.', { tone: 'warning' });
      return null;
    }
    if (!choice) return null; // picker dismissed: stay signed out, Free Mode stays open
    const provider = await providerForWalletChoice(choice);
    if (!provider?.request) return null;
    return signInWithWalletProvider(provider, choice);
  })();
  walletSignInInFlight = attempt;
  const release = () => { if (walletSignInInFlight === attempt) walletSignInInFlight = null; };
  attempt.then(release, release);
  return attempt;
}

// The profile's Sign in buttons (§7.6): the picker when no wallet is
// connected, one SIWE signature from the connected wallet when it is signed
// out (its token expired, or a 401 dropped it), and nothing when it is signed
// in. A double click joins the sign-in in progress.
let profileSignInInFlight = null;
function signInFromProfile() {
  if (walletSignInInFlight) return walletSignInInFlight;
  if (profileSignInInFlight) return profileSignInInFlight;
  if (!connectedWallet || walletConnector !== 'injected-evm') return connectWallet();
  if (HOSTED_PROFILE_SYNC ? walletSessionAuthenticated(connectedWallet) : walletAuthenticated) return Promise.resolve(connectedWallet);
  const attempt = (async () => {
    const provider = await walletProviderForAction();
    // The provider behind this session is gone: pick a wallet again, never
    // the simulated identity.
    if (!provider) return signInFromPicker({ allowSimulated: false });
    return (await authenticateWalletSiwe(provider, connectedAddress ?? connectedWallet)) ? connectedWallet : null;
  })();
  profileSignInInFlight = attempt;
  const release = () => { if (profileSignInInFlight === attempt) profileSignInInFlight = null; };
  attempt.then(release, release);
  return attempt;
}

async function connectWallet() {
  if (connectedWallet && walletConnector === 'injected-evm') {
    if (walletProviderPending) await ensureWalletProvider();
    return connectedWallet;
  }
  return signInFromPicker();
}

async function ensureWalletConnected() {
  if (connectedWallet) return connectedWallet;
  return connectWallet();
}

// Start a play session, allocating a global game-session-NNNNNNNNN handle for
// ranked/paid (tracked) sessions. Free sessions stay handle-less (their URL
// falls back to the game page). The handle is the blockchain-searchable id and
// the session URL segment.
function beginTrackedSession({ mode }) {
  const normalizedMode = mode === 'ranked' ? 'paid' : mode;
  return startPlaySession({
    wallet: connectedWallet ?? MOCK_WALLET,
    gameId: selectedGameId,
    mode: normalizedMode,
    hmhChallenge: hmhChallengeUi.requestFor(selectedGameId, normalizedMode),
    allowDevCabinet: DEV_CABINETS_ENABLED,
  });
}

async function startMode(mode, { session = null } = {}) {
  // Guest-first: Free mode plays without a wallet (sessions fall back to the
  // mock/guest wallet). Paid/ranked is wallet-bound and already prompts connect
  // upstream in startOfficialMode, but guard here too for any other caller.
  if (mode === 'paid' || mode === 'ranked') {
    await ensureWalletConnected();
  }
  const game = selectedGame();
  if (game.status !== 'playable' && !(DEV_CABINETS_ENABLED && game.devPlayable)) return;

  currentSession = session ?? beginTrackedSession({ mode });
  lastCompletedSession = null;
  lastRunResult = null;
  resetRankedRunState();
  captureRankedResultContext(currentSession);
  // Ranked sessions get a session URL; free stays on the game page.
  if (currentSession?.urlSessionId && officialAppStep === 'gameplay') {
    syncRouteForView('gameplay');
  }
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
    elapsedSeconds: Math.max(elapsedSeconds, Math.round(combat.longestSurvivalThisRun || 0)),
    kills: combat.kills,
    maxCombo: combat.maxCombo,
    maxDamageCombo: combat.maxDamageCombo,
    bossId: bossRoll.boss?.id,
    weaponId: combat.weaponId,
    enemyKillsByType: { ...(combat.killsByType || {}) },
    powerUpsCollected: combat.powerUpsCollected || 0,
    collectedPowerUps: [...(combat.collectedPowerUpTypes || [])],
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
  // A prototype run has no canonical run summary, so it never settles.
  render();
}

function emptyMini(text) {
  const item = el('article', { className: 'mini-item' });
  appendText(item, 'span', text);
  return item;
}

function renderLeaderboard() {
  const model = buildLeaderboardModel(state, { gameId: selectedGameId, wallet: connectedWallet });
  dom.leaderboardPanel.replaceChildren();
  appendText(dom.leaderboardPanel, 'h3', 'Official Ranked Leaderboard');
  appendText(dom.leaderboardPanel, 'p', `${model.testnetDisclosure.title}: ${model.testnetDisclosure.body}`, 'tiny-note');
  appendText(dom.leaderboardPanel, 'p', model.testnetDisclosure.leaderboardResetNotice, 'tiny-note');
  appendText(dom.leaderboardPanel, 'p', model.scoreFormula, 'tiny-note');
  if (model.topEntries.length === 0) {
    dom.leaderboardPanel.append(emptyMini('No ranked scores yet. Finish a Ranked Testnet run to sync here.'));
  } else {
    for (const entry of model.topEntries.slice(0, 4)) {
      const item = el('article', { className: 'leaderboard-entry' });
      appendText(item, 'strong', `#${entry.rank} ${entry.score.toLocaleString()}`);
      appendText(item, 'span', `${entry.displayName ?? `${entry.wallet.slice(0, 6)}…${entry.wallet.slice(-4)}`} · ${formatSeconds(entry.runStats.elapsedSeconds ?? 0)} · boss ${entry.runStats.bossId ?? 'none'}`);
      dom.leaderboardPanel.append(item);
    }
  }
}

async function startCombat(options = {}) {
  resetCombatAudioVoiceState();
  const level = getHmhCampaignLevel(options.levelId ?? combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID);
  const carryOver = options.carryOver ?? null;
  const startPendingBegin = Boolean(options.startPendingBegin);
  combat.currentCampaignLevelId = level.id;
  combat.nextCampaignLevelId = getNextHmhCampaignLevel(level.id)?.id ?? null;
  combat.scriptedBossTriggered = false;
  combat.extractionPoint = null;
  combat.clearedCampaignLevelId = null;
  combat.levelClearSource = null;
  combat.levelClearTitle = '';
  combat.active = true;
  combat.pendingBegin = startPendingBegin;
  combat.paused = startPendingBegin;

  combat.gameOver = false;
  combat.gameOverSubmitted = false;
  // Reset on-chain settlement tracking for the new run.
  lastSettlementSucceeded = false;
  lastSettlementQueued = false;
  lastSettlementInput = null;
  lastRunStatsForSettlement = null;
  lastRunPreviousBestScore = currentPlayerBestScoreForMode(currentSession?.mode);
  lastSettlementError = null;
  lastSettlementTxUrl = null;
  combat.gameOverReason = '';
  combat.lastHitBy = null;
  combat.killedBy = null;
  combat.startedAt = performance.now();

  combat.frame = 0;
  combat.frameTimes.length = 0;
  combat.updateTimes.length = 0;
  combat.renderTimes.length = 0;
  combat.fixedStepStats = createFixedStepStats();
  combat.adaptivePerformance = createAdaptivePerformanceState();
  _obstacleCacheFrame = -1;
  _obstacleCache = [];
  combat.elapsedGameSeconds = 0;
  combat.playerX = PLAYER_X;
  combat.playerY = GROUND_Y;
  combat.playerMapX = 0;
  combat.playerMapY = 0;
  combat.aimMapX = 1;
  combat.aimMapY = 0;
  combat.manualAim = { x: 1, y: 0, active: false, source: 'reset' };
  combat.grenadeTarget = null;
  combat.grenadeAim = null;
  combat.grenadeTargetKind = 'grenade-reticle';
  combat.velocityX = 0;
  combat.velocityY = 0;
  combat.jumpsLeft = 2;
  combat.maxHealth = PLAYER_MAX_HEALTH;
  combat.health = Math.max(1, Math.min(combat.maxHealth, carryOver?.health ?? combat.maxHealth));
  combat.reviveCharges = 0;
  combat.dashCooldownRemaining = 0;
  combat.dashFrames = 0;
  combat.scoreBonus = 0;
  combat.lives = 1;
  combat.score = 0;
  combat.kills = 0;
  combat.killsByType = {};
  combat.bossKills = 0;
  combat.longestSurvivalThisRun = 0;
  combat.combo = 0;
  combat.maxCombo = 0;
  combat.damageCombo = 0;
  combat.maxDamageCombo = 0;
  combat.noDamageSeconds = 0;
  combat.invulnerableFrames = 0;
  combat.crouching = false;
  combat.crouchFrames = 0;
  combat.bullets = [];
  combat.activeGrenades = [];
  combat.enemyShots = [];
  combat.enemies = [];
  combat.particles = [];
  combat.floatingTexts = [];
  combat.feedbackEvents = [];
  combat.playerDamageFlash = 0;
  combat.powerUps = [];
  combat.powerUpTimers = { magnet: 0, slowEnemies: 0, berserk: 0, weapon: 0 };
  // Power-up telegraph and animated spawns
  if (combat.powerUpSpawnTimer && combat.powerUpSpawnTimer < 15) {
    spawnSpriteParticle('powerup-telegraph', combat.nextPowerUpX || combat.playerX + 80, combat.nextPowerUpY || combat.playerY + 80, { color: '#fde047', size: 35, life: 15 });
  }

  combat.xpGems = [];
  combat.levelUpChoices = [];
  combat.levelUpLockedPreviews = [];
  combat.levelUpPaused = false;
  closeLevelUpInteractionGate();
  combat.roguelikeRun = createRoguelikeRunState({
    seed: options.seed ?? Date.now(),
    mode: currentSession?.mode ?? 'free',
    characterId: combat.characterId,
    campaignLevelId: level.id,
    campaignLevelNumber: level.number,
    carryOver: carryOver?.roguelikeRun ?? null,
  });
  recordCurrentSessionEvent('run-start', {
    levelId: level.id,
    seed: combat.roguelikeRun.seed,
    characterId: combat.characterId,
  });
  const heroIdentity = playableCharacterStatIdentityFor(combat.characterId)
    ?? playableCharacterStatIdentityFor('lit-commando');
  combat.maxHealth = Math.round(PLAYER_MAX_HEALTH * (combat.roguelikeRun.stats.maxHealth ?? 1));
  combat.health = clamp(carryOver?.health ?? combat.maxHealth, 1, combat.maxHealth);
  // Dedicated seeded RNG stream for consuming gameplay rolls (crit chance) so a
  // run is fully reproducible from roguelikeRun.seed. The stream lives on the
  // run state beside spawns/drops/boss/draft so replay verifiers can snapshot it.
  combat.critRng = combat.roguelikeRun.rngStreams?.crit ?? null;
  await preloadHeroRoster(combat.characterId); // guarantee a selected-hero frame before READY without decoding the whole roster
  preloadWorldPropImages(); // decode all world-prop art up front (no scroll-in pop-in)
  
  // Generate macro-scale world structure: districts + a road/path network
  // connecting district centers, so the world reads as a planned place
  // (streets between blocks, trails between groves) instead of raw biome noise.
  const seed = combat.roguelikeRun.seed;
  const safePlayerStart = level.id === HMH_LEVEL_ONE_ID
    ? { x: 0, y: 0, adjusted: false, found: true }
    : findNearestDrySpawn(seed, 0, 0, biomeAt, {
        maxRadius: ROGUELIKE_PLAYER_START_SEARCH_RADIUS_TILES,
        step: 1,
      });
  combat.playerMapX = safePlayerStart.x;
  combat.playerMapY = safePlayerStart.y;
  combat.roguelikeRun.player.x = safePlayerStart.x;
  combat.roguelikeRun.player.y = safePlayerStart.y;
  syncProjectedPlayerPosition();
  if (safePlayerStart.adjusted) {
    debugRuntimeLog('[spawn] moved player start off water', safePlayerStart);
  }
  const world = buildLevelOneRunWorldDimensions();
  const worldWidth = level.id === DEFAULT_CAMPAIGN_LEVEL_ID ? world.width : 2000;
  const worldHeight = level.id === DEFAULT_CAMPAIGN_LEVEL_ID ? world.height : 2000;
  const campaignWorld = buildCampaignWorldSetup({
    levelId: level.id,
    seed,
    worldWidth,
    worldHeight,
  });

  // Store in combat for runtime access (rendering, spawning, etc.)
  combat.districtGrid = campaignWorld.grid;
  combat.macroCellsX = campaignWorld.macroCellsX;
  combat.macroCellsY = campaignWorld.macroCellsY;
  // Blueprint v3 bakes every Level 1 road, trail, ford, and bridge into the
  // authoritative terrain/route layers. Do not overlay the retired procedural
  // macro-road network on top of those authored cells.
  combat.roadNetwork = level.id === HMH_LEVEL_ONE_ID ? [] : campaignWorld.roadNetwork;
  combat.worldWidth = worldWidth;
  combat.worldHeight = worldHeight;
  combat.explorationVisitedCells = updateLevelOneExplorationTrail({
    world: buildLevelOneRunWorldDimensions({ width: worldWidth, height: worldHeight }),
    player: { x: combat.playerMapX, y: combat.playerMapY },
    cellSize: 8,
    revealRadius: 1,
  });
  combat.explorationLayerFrame = -1;
  combat.explorationLayerCache = null;
  // Keep the legacy index adapter for later campaign levels. Blueprint v3 Level
  // 1 traversal reads crossing truth directly from its authored cell metadata.
  combat.roadTileIndex = buildLevelOneRoadTileIndex({
    roadNetwork: combat.roadNetwork,
    groundPlan: getCombatGroundPlan(),
    shiftX: worldWidth / 2,
    shiftY: worldHeight / 2,
  });
  combat.roguelikeSpawnTimer = 0;
  combat.props = [];
  combat.hazards = [];
  combat.platforms = [];
  combat.powerUpsCollected = 0;
  combat.collectedPowerUpTypes = new Set();

  // removed from the loadout — grenade is the single manual throwable now.)
  combat.grenades = carryOver?.grenades ?? 3;
  combat.axes = 0;
  combat.completedCampaignPoiIds = new Set();
  combat.routePacingRespitePoiId = null;
  combat.routePacingRespiteFrames = 0;
  combat.triggeredCampaignPoiIds = new Set();
  combat.triggeredBossBeatIds = new Set();
  combat.activePoiEncounterId = null;
  combat.activePoiEncounterTitle = '';
  combat.activePoiEncounterVisualPlan = null;
  combat.activePoiEncounterCenterX = null;
  combat.activePoiEncounterCenterY = null;
  combat.weaponId = carryOver?.weaponId ?? heroIdentity.startingWeaponId ?? 'coin-blaster';
  combat.powerUpTimers.weapon = carryOver?.weaponId ? 0 : heroIdentity.startingWeaponDurationSeconds;
  combat.weaponUpgrades = { ...(carryOver?.weaponUpgrades ?? {}) };
  // Clip/reload model: each weapon has a clip; auto-fire empties it, then a timed
  // auto-reload refills it. The starter pistol begins fully loaded.
  const startWeapon = weaponById(combat.weaponId);
  combat.clipSize = startWeapon.clip ?? 8;
  combat.clip = combat.clipSize;
  combat.ammo = combat.clip; // legacy mirror used by older HUD/snapshot paths
  syncUpgradeRuntimeState();
  combat.reloading = false;
  combat.reloadRemaining = 0;
  combat.shots = 0;
  combat.meleeSwings = 0;
  combat.lastMeleeFrame = -999;
  combat.lastInteractFrame = -999;
  combat.lastGrenadeFrame = -999;
  combat.interactionPrompt = null;
  combat.boss = null;
  combat.bossDefeated = false;
  combat.bossDeathSpectacle = null;
  combat.miniBossLock = false;
  combat.scrollLockReason = null;
  combat.scroll = 0;
  combat.furthestScroll = 0;
  combat.scrollSpeed = 0;
  combat.stageCount = STAGE_COUNT;
  combat.stageIndex = 1;
  combat.stagePhase = 'travel';
  combat.stageTravel = 0;
  combat.stageTravelGoal = LESTER_BLASTER_TACTICAL_CAMERA_MODEL.stageTravelGoalBasePixels + LESTER_BLASTER_TACTICAL_CAMERA_MODEL.stageTravelGoalPerStagePixels;
  combat.waveIndex = 0;
  combat.wavesThisStage = 1;
  combat.waveSpawnQueue = 0;
  combat.waveEnemiesSpawned = 0;
  combat.nextWaveSpawnFrame = 0;
  combat.stagedEnemiesDefeated = 0;
  combat.keys.clear();
  lastBossId = null;
  beginStage(1);

  // Level load screen: decide the biome world up front and warm its art so the
  // map renders coherent and pop-in free. Now includes district/road images.
  if (combat.roguelikeRun && dom.combatCanvas) {
    const ctx = dom.combatCanvas.getContext('2d');
    if (ctx) {
      try {
        const layout = await precomputeBiomeWorld(ctx, dom.combatCanvas.width, dom.combatCanvas.height, {
          districtGrid: combat.districtGrid,
          roadNetwork: combat.roadNetwork,
        });
        combat.biomeLayout = layout;
      } catch (err) {
        console.warn('[biome] precompute skipped:', err);
      }
    }
  }

  combat.status = startPendingBegin
    ? HMH_COPY_SHEET.combatStatus.levelReady
    : HMH_COPY_SHEET.combatStatus.runLive;
  if (!startPendingBegin) {
    playSfxCue('level-start');
    await startArcadeMusicForGame('hard-money-heroes');
  }
  renderCombatSandboxStatus();
  syncCombatOverlay();
}

function jump() {
  if (combat.jumpsLeft > 0) {
    combat.velocityY = combat.jumpsLeft === 2 ? -12 : -10;
    combat.jumpsLeft -= 1;
    playSfxCue('jump');
    spawnText('JUMP', combat.playerX, combat.playerY - 70, '#19f7ff');
  }
}

function shoot() {
  if (combat.roguelikeRun) {
    shootRoguelike();
    return;
  }
  const weapon = weaponById(combat.weaponId);
  if (Number.isFinite(combat.ammo)) {
    if (combat.ammo <= 0) {
      spawnText('RELOAD!', combat.playerX + 20, combat.playerY - 80, '#ff476f');
      playSfxCue('empty-clip', 0.03);
      return;
    }
    combat.ammo -= 1;
  }
  combat.shots += 1;
  playSfxCue(weaponFireCueFor(weapon.id), weapon.id === 'hash-rail' ? 0.045 : 0.035);
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

function grenade(options = {}) {
  // Manual throwable (the player's only manual action in the roguelike).
  // SIMPLIFIED: grenades only — throwing axes were removed from the loadout
  // (they read as broken/unnoticeable in playtests). Grenades are scarce and
  // replenished by map ammo pickups.
  const hasGrenade = (combat.grenades ?? 0) > 0;
  if (!hasGrenade) {
    spawnText('NO GRENADES', combat.playerX + 20, combat.playerY - 80, '#ff476f');
    playSfxCue('error-denied', 0.04);
    return;
  }
  playSfxCue('grenade-throw', 0.075);

  if (combat.roguelikeRun) {
    // Real fused throw (Level Design Bible §6.3): WO-28 routes the single
    // throwable button through the unlocked grenade economy. The plan is still
    // pure/deterministic, but stats can now switch the role between Crypto Bombs,
    // Launcher Rig, Homing Cluster, and Block Buster.
    const type = resolveGrenadeTypeForRun(combat.roguelikeRun);
    const typeAim = grenadeAimType(type.id);
    const grenadeTarget = options.target ?? buildGrenadeAimPreview({
      typeId: type.id,
      heldMs: 0,
      playerX: combat.playerMapX,
      playerY: combat.playerMapY,
      aimX: combat.manualAim?.x ?? combat.aimMapX,
      aimY: combat.manualAim?.y ?? combat.aimMapY,
      blastRadius: type.blastRadius,
      radiusMultiplier: combat.roguelikeRun?.stats.grenadeRadius ?? 1,
      enemies: combat.enemies,
    });
    combat.grenadeTarget = grenadeTarget;
    // Runtime marker contract: renderer/debug tests can identify this as the
    // grenade-reticle path, while deterministic throw planning owns cost/fuse/damage.
    combat.grenadeTargetKind = 'grenade-reticle';
    const throwPlan = planLevelOneGrenadeThrow({
      run: combat.roguelikeRun,
      currentGrenades: combat.grenades,
      originX: combat.playerMapX,
      originY: combat.playerMapY,
      aimX: grenadeTarget.aimX,
      aimY: grenadeTarget.aimY,
      reach: grenadeTarget.distance,
      maxRange: typeAim.maxRange,
      blastRadius: grenadeTarget.marker?.radius ?? type.blastRadius,
      damageMultiplier: combat.roguelikeRun?.stats.grenadeDamage ?? 1,
    });
    if (!throwPlan.throwAllowed) {
      spawnText(`${throwPlan.type.title.toUpperCase()} NEEDS ${throwPlan.cost}`, combat.playerX + 20, combat.playerY - 80, '#ff476f');
      return;
    }
    combat.grenades = throwPlan.remaining;
    combat.lastGrenadeFrame = combat.frame;
    combat.activeGrenades = combat.activeGrenades ?? [];
    combat.activeGrenades.push({
      typeId: throwPlan.typeId,
      x: throwPlan.plan.landX,
      y: throwPlan.plan.landY,
      radius: throwPlan.plan.blastRadius,
      fuse: throwPlan.plan.fuseFrames,
      maxFuse: throwPlan.plan.fuseFrames,
      damage: throwPlan.damage,
      homing: Boolean(throwPlan.type.homing),
      clusterCount: throwPlan.type.clusterCount ?? 1,
    });
    spawnText(throwPlan.label, combat.playerX + 20, combat.playerY - 80, '#ffb347');
    return;
  }

  // Legacy side-scroller fallback.
  combat.grenades -= 1;
  const blastBox = { x: combat.playerX + 52, y: GROUND_Y - 154, w: 304, h: 166 };
  for (const enemy of combat.enemies) {
    if (rectsOverlap(blastBox, enemyHitbox(enemy))) damageEnemy(enemy, 18, 'grenade');
  }
  const bossBox = bossHitbox();
  if (bossBox && rectsOverlap(blastBox, bossBox)) damageBoss(24, 'grenade');
  spawnGrenadeExplosion(combat.playerX + 210, GROUND_Y - 35);
}

function reload() {
  const weapon = weaponById(combat.weaponId);
  if (weapon.ammo === 'infinite') return;
  combat.ammo = weapon.ammo;
  playSfxCue('menu-click', 0.025);
  spawnText('RELOAD', combat.playerX + 20, combat.playerY - 80, '#45ff8a');
}

function roguelikeRngStream(name) {
  return combat.roguelikeRun?.rngStreams?.[name] ?? null;
}

function currentDamageType() {
  // Damage type comes from the active weapon/level-up modifiers when present.
  return combat.roguelikeRun?.stats?.damageType
    ?? combat.activeDamageType
    ?? 'normal';
}

function rollHitPresentation(baseDamage, source) {
  // Roll crit + apply type modifier ON TOP of the already-computed base damage
  // so every existing call site gets crits, types, and a styled number without
  // changing its signature. Uses the shared balance model.
  const stats = combat.roguelikeRun?.stats ?? {};
  const upgradePolicy = buildUpgradeRuntimePolicy(stats);
  const type = currentDamageType();
  const result = computeDamage({
    source: source === 'knife' ? 'melee' : (source ?? 'bullet'),
    type,
    stats: {
      ...stats,
      damage: 1,
      critChanceBonus: upgradePolicy.critChanceBonus,
      critMultiplierBonus: upgradePolicy.critDamageBonus,
    }, // base already scaled by caller; only roll crit/type here
    enemyArmored: false,
    // Seeded crit RNG so crit outcomes (which feed damage -> kills -> score) are
    // reproducible from the run seed. Legacy non-roguelike sandbox falls back to
    // the browser RNG because that path is not replay-ranked.
    rng: combat.critRng ? () => combat.critRng.float() : Math.random, // cosmetic-rng-ok legacy non-roguelike sandbox fallback only
  });
  // Scale the caller's flat damage by crit/type multiplier ratio.
  const finalDamage = Math.max(1, Math.round(baseDamage * (result.crit ? (1.75 + upgradePolicy.critDamageBonus) : 1)));
  return { finalDamage, crit: result.crit, type, color: result.color, label: result.crit ? `${finalDamage}!` : `${finalDamage}` };
}

function damageEnemy(enemy, damage, source, opts = {}) {
  const present = opts.crit !== undefined ? opts : rollHitPresentation(damage, source);
  const applied = present.finalDamage ?? damage;
  enemy.hp -= applied;
  const hitFeedback = applyCombatFeedback('enemy-hit', {
    amount: applied,
    label: present.label,
    color: present.color,
    crit: Boolean(present.crit),
    source,
    spawnTexts: false,
    sfxVolume: 0.035,
  }, { x: enemy.x + 12, y: enemy.y });
  enemy.hitFlash = Math.max(6, hitFeedback.flashFrames); // frames of white flash so EVERY enemy shows hit feedback
  enemy.goreFrames = Math.max(enemy.goreFrames ?? 0, source === 'grenade' ? 14 : 10);
  combat.combo += 1;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  combat.damageCombo += applied;
  combat.maxDamageCombo = Math.max(combat.maxDamageCombo, combat.damageCombo);
  // RED spurt of blood on bullet impacts. Crimson for standard shots, deeper
  // red for knife slashes (visceral), purple for hash-rail plasma.
  const bloodColor =
    source === 'knife' ? '#8b0020' :
    source === 'hash-rail' ? '#7c4dff' :
    source === 'axe' ? '#c62828' :
    '#dc143c'; // crimson — the requested red spurt for bullet-on-enemy
  spawnBlood(enemy.x + 12, enemy.y - 30, bloodColor);
  const budget = currentLevelOnePerformanceBudget();
  const shouldEmitHitSparks = ((combat.frame + combat.combo) % budget.hitSparkEveryNthHit) === 0;
  if (shouldEmitHitSparks) emitCombatVfxParticles(createHitSparks(enemy.x + 12, enemy.y - 32, source === 'hash-rail' ? 14 : 8));
  if (source === 'hash-rail') {
    emitCombatVfxParticles(createBulletTrail(enemy.x - 22, enemy.y - 32, enemy.x + 22, enemy.y - 32, 'rail'));
  }
  spawnDamageNumber(present.label ?? `${Math.round(applied)}`, enemy.x + 12, enemy.y - 40, present.color ?? '#ffe84d', Boolean(present.crit));
}

function damageBoss(damage, source, opts = {}) {
  const present = opts.crit !== undefined ? opts : rollHitPresentation(damage, source);
  const applied = present.finalDamage ?? damage;
  combat.boss.hp -= applied;
  const bossFeedback = applyCombatFeedback('enemy-hit', {
    amount: applied,
    label: present.label,
    color: present.color,
    crit: Boolean(present.crit),
    source,
    spawnTexts: false,
    shakeMul: 1.35,
    sfxCue: 'boss-warning',
    sfxVolume: 0.035,
  }, { x: combat.boss.x + 40, y: GROUND_Y - 44 });
  combat.boss.hitFlash = Math.max(combat.boss.hitFlash ?? 0, bossFeedback.flashFrames);
  combat.boss.goreFrames = Math.max(combat.boss.goreFrames ?? 0, source === 'grenade' ? 16 : 12);
  combat.combo += 1;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  combat.damageCombo += applied;
  combat.maxDamageCombo = Math.max(combat.maxDamageCombo, combat.damageCombo);
  spawnBlood(combat.boss.x + 40, GROUND_Y - 70, source === 'hash-rail' ? '#19f7ff' : '#ff236d');
  emitCombatVfxParticles(createHitSparks(combat.boss.x + 40, GROUND_Y - 72, source === 'grenade' ? 18 : 12));
  spawnDamageNumber(present.label ?? `${Math.round(applied)}`, combat.boss.x + 40, GROUND_Y - 84, present.color ?? '#ffe84d', Boolean(present.crit));
}

// --- Generated FX image overlays (PixelLab demo wave) ---
// Layered impact art on top of the existing particle/blood systems for extra
// juice. Indices map to descriptive FX in the demo-wave manifest order.
const fxImageCache = new Map();
const FX_INDEX = Object.freeze({
  coin: 0, shockwave: 1, muzzle: 2, fireball: 3, toxic: 4, spark: 5,
  blood: 6, smoke: 7, sparkle: 8, ice: 9, void: 10, dust: 11,
  crit: 12, shield: 13, lightning: 14, debris: 15, heal: 16, levelup: 17,
});
function fxImageFor(key) {
  const list = hmh('HMH_LEVEL_ENVIRONMENT')?.demoWaveFx ?? [];
  if (!list.length) return null;
  const idx = Math.min(list.length - 1, FX_INDEX[key] ?? 0);
  const src = list[idx]?.src;
  if (!src) return null;
  if (!fxImageCache.has(src)) fxImageCache.set(src, loadImageAsset(src));
  return fxImageCache.get(src);
}
function spawnFxImage(key, x, y, size = 64, life = 0.4) {
  const img = fxImageFor(key);
  if (!imageReady(img)) return;
  combat.particles.push({ type: 'fxImage', fxImage: img, x, y, size, scaleFrom: 0.6, scaleTo: 1.25, life, maxLife: life });
}

function spawnSpriteParticle(type, x, y, options = {}) {
  const life = options.life ?? 0.45;
  combat.particles.push({
    type,
    x,
    y,
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,
    color: options.color ?? '#ffe84d',
    size: options.size ?? 48,
    scale: options.scale ?? 1,
    rotation: options.rotation ?? 0,
    life,
    maxLife: life,
  });
}

function emitCombatVfxParticles(particles = []) {
  for (const particle of particles) {
    combat.particles.push({
      ...particle,
      // Main-loop particles are frame-updated by updateParticles(), so preserve
      // maxLife for fade math and normalize missing velocity/size fields.
      vx: particle.vx ?? 0,
      vy: particle.vy ?? 0,
      size: particle.size ?? 8,
      life: particle.life ?? 1,
      maxLife: particle.maxLife ?? particle.life ?? 1,
    });
  }
}

function spawnMuzzleFlash(x, y, weaponId) {
  // Coded muzzle flash VFX only: no sprite-sheet flash glued to the character.
  // The projectile itself is a pooled physics object; this is just the brief
  // barrel pop/shell feedback.
  const flashParticles = createMuzzleFlash(x, y, weaponId === 'hash-rail' ? 'rail' : 'east').map((particle) => ({
    ...particle,
    color: weaponId === 'auto-miner' ? '#8cf7ff'
      : weaponId === 'scatter-shotgun' ? '#ffb347'
      : weaponId === 'hash-rail' ? '#19f7ff'
      : particle.color,
    size: (particle.size ?? 3) * (weaponId === 'scatter-shotgun' ? 1.35 : weaponId === 'auto-miner' ? 0.75 : 1),
  }));
  emitCombatVfxParticles(flashParticles);
}

function spawnBlood(x, y, color) {
  if (gameSettings.screenShake && !gameSettings.reduceMotion) combat.shake = Math.min(7, (combat.shake ?? 0) + 1.6);
  if (!gameSettings.gore) return; // gore toggle: skip blood splatter when off
  // Level Design Bible §6.4: dampen cosmetic gore FX at high threat count so
  // telegraphs/pickups/player stay readable. The dampening factor scales the
  // particle count (not the damage — gore is cosmetic-only, never affects the sim).
  const threatCount = combat.enemies?.filter((e) => e.hp > 0).length ?? 0;
  const dampening = computeGoreDampening({ threatCount, goreEnabled: true });
  if (dampening <= 0) return;
  spawnFxImage('blood', x, y, 54, 0.38 * dampening);
  const particleCount = Math.max(2, Math.round(9 * dampening));
  for (let i = 0; i < particleCount; i += 1) combat.particles.push({ type: 'impact-sparks', x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3, color, size: 18 + Math.random() * 18, life: 0.65 + Math.random() * 0.3, maxLife: 0.95 }); // cosmetic-rng-ok visual-only or legacy-non-replay jitter
}

function spawnExplosion(x, y, color) {
  if (gameSettings.screenShake && !gameSettings.reduceMotion) combat.shake = Math.min(12, (combat.shake ?? 0) + 6);
  spawnFxImage('fireball', x, y, 96, 0.5);
  spawnSpriteParticle('level-up-burst', x, y, { color, size: 112, life: 0.72 });
  for (let i = 0; i < 12; i += 1) combat.particles.push({ type: 'impact-sparks', x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.7) * 5, color: i % 3 ? color : '#f9f7ff', size: 22 + Math.random() * 20, life: 0.8 + Math.random() * 0.35, maxLife: 1.15 }); // cosmetic-rng-ok visual-only or legacy-non-replay jitter
}

// Grenade / explosive ordnance detonation: warm YELLOW-AND-RED mix so it reads
// distinctly from the single-color boss/prop explosions. Alternates yellow,
// red-orange, bright red, and a few white-hot core sparks for punch.
function spawnGrenadeExplosion(x, y) {
  if (gameSettings.screenShake && !gameSettings.reduceMotion) combat.shake = Math.min(14, (combat.shake ?? 0) + 8);
  const palette = ['#ffe84d', '#ffb347', '#ff5f1f', '#dc143c', '#fff3a0'];
  // Bright white-hot core flash plus the manifest-backed P0 grenade ring.
  spawnSpriteParticle('explosion-core', x, y, { color: '#fff5cc', size: 200, life: 0.28, scaleFrom: 0.5, scaleTo: 1.4 });
  spawnSpriteParticle('grenade-explosion-ring', x, y, { color: '#ffe84d', size: 148, life: 0.62 });
  // Secondary fireball sprite for punch.
  spawnFxImage('fireball', x, y, 140, 0.55);
  // Main warm-color spray
  for (let i = 0; i < 14; i += 1) {
    const color = palette[i % palette.length];
    combat.particles.push({
      type: 'impact-sparks',
      x, y,
      vx: (Math.random() - 0.5) * 9, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      vy: (Math.random() - 0.55) * 7 - 0.8, // bias upward for plume // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      color,
      size: 24 + Math.random() * 26, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      life: 0.7 + Math.random() * 0.5, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      maxLife: 1.2,
    });
  }
  // Smoke puff that lingers after the blast.
  for (let i = 0; i < 4; i += 1) {
    combat.particles.push({
      type: 'impact-sparks',
      x: x + (Math.random() - 0.5) * 14, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      y: y - 4 + (Math.random() - 0.5) * 10, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      vx: (Math.random() - 0.5) * 0.8, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      vy: -0.45 - Math.random() * 0.3, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      color: '#4a4a55',
      size: 36 + Math.random() * 16, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      life: 1.4 + Math.random() * 0.4, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
      maxLife: 1.8,
    });
  }
}

function applyCombatFeedback(momentId, context = {}, origin = {}) {
  const plan = buildCombatFeedbackPlan(momentId, context, {
    reduceMotion: gameSettings.reduceMotion || !gameSettings.screenShake,
    reduceFlash: gameSettings.reduceFlash,
  });
  combat.feedbackEvents.push({ id: plan.id, frame: combat.frame, channels: plan.channels, stateTags: plan.stateTags });
  if (combat.feedbackEvents.length > 80) combat.feedbackEvents.splice(0, combat.feedbackEvents.length - 80);
  if (plan.shake > 0 && gameSettings.screenShake && !gameSettings.reduceMotion) {
    combat.shake = Math.min(14, (combat.shake ?? 0) + plan.shake);
  }
  if (plan.sfxCue) playSfxCue(plan.sfxCue, plan.sfxVolume);
  const baseX = Number.isFinite(origin.x) ? origin.x : ISO_CENTER_X;
  const baseY = Number.isFinite(origin.y) ? origin.y : ISO_CENTER_Y;
  for (const text of context.spawnTexts === false ? [] : plan.texts) {
    spawnText(text.text, baseX + (text.dx ?? 0), baseY + (text.dy ?? 0), text.color);
  }
  return plan;
}

function spawnText(text, x, y, color) {
  combat.floatingTexts.push({ text, x, y, color, life: 70 });
}

// Floating combat damage number with crit emphasis (bigger, longer-lived).
function spawnDamageNumber(text, x, y, color, crit = false) {
  combat.floatingTexts.push({
    text,
    x: x + (Math.random() - 0.5) * 10, // cosmetic-rng-ok visual-only or legacy-non-replay jitter
    y,
    color,
    life: crit ? 95 : 70,
    size: crit ? 22 : 14,
    crit,
    vy: crit ? -1.1 : -0.7,
  });
}


const ISO_TILE_WIDTH = LESTER_BLASTER_ISOMETRIC_ROGUELIKE.camera.tileWidth;
const ISO_TILE_HEIGHT = LESTER_BLASTER_ISOMETRIC_ROGUELIKE.camera.tileHeight;
const ISO_CENTER_X = LESTER_BLASTER_ISOMETRIC_ROGUELIKE.camera.screenCenter.x;
const ISO_CENTER_Y = LESTER_BLASTER_ISOMETRIC_ROGUELIKE.camera.screenCenter.y;

function isoToScreen(worldX, worldY) {
  const dx = worldX - combat.playerMapX;
  const dy = worldY - combat.playerMapY;
  // Use the live canvas center so the world stays centered on the player at any
  // canvas size (fixes off-center "drifting tiles" after DPR/fullscreen resize).
  const cx = combat.viewCenterX ?? ISO_CENTER_X;
  const cy = combat.viewCenterY ?? ISO_CENTER_Y;
  return {
    x: cx + (dx - dy) * (ISO_TILE_WIDTH / 2),
    y: cy + (dx + dy) * (ISO_TILE_HEIGHT / 2),
  };
}

function syncProjectedPlayerPosition() {
  const projected = isoToScreen(combat.playerMapX, combat.playerMapY);
  const groundContact = groundEntityContactPointForProjection(projected);
  combat.playerX = groundContact.x;
  combat.playerY = groundContact.y;
}

function hmhVisualDebugPerformanceSnapshot() {
  const samples = combat.renderTimes.slice().sort((a, b) => a - b);
  const averageRenderMs = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 0;
  const p95RenderMs = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] ?? 0;
  const frameSamples = combat.frameTimes.slice().sort((a, b) => a - b);
  const averageFrameMs = frameSamples.length ? frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length : 0;
  const p95FrameMs = frameSamples[Math.min(frameSamples.length - 1, Math.floor(frameSamples.length * 0.95))] ?? 0;
  const updateSamples = combat.updateTimes.slice().sort((a, b) => a - b);
  const averageUpdateMs = updateSamples.length ? updateSamples.reduce((sum, value) => sum + value, 0) / updateSamples.length : 0;
  const p95UpdateMs = updateSamples[Math.min(updateSamples.length - 1, Math.floor(updateSamples.length * 0.95))] ?? 0;
  const performanceBudget = currentLevelOnePerformanceBudget();
  const director = currentRoguelikeSpawnDirector(combat.elapsedGameSeconds);
  const occupancy = {
    activeEnemies: combat.enemies.length,
    bossEnemies: combat.enemies.filter((enemy) => enemy.boss || enemy.miniBoss || enemy.signatureBoss).length,
    playerProjectiles: combat.bullets.length + (combat.activeGrenades?.length ?? 0),
    enemyProjectiles: combat.enemyShots.length,
    particles: combat.particles.length,
    vfxParticles: combat.vfxParticles.length,
    floatingTexts: combat.floatingTexts.length,
    xpGems: combat.xpGems.length,
    powerUps: combat.powerUps.length,
  };
  occupancy.totalTrackedObjects = Object.values(occupancy).reduce((sum, value) => sum + value, 0);
  const audioFamilyCounts = [...combatAudio.activeVoices].reduce((counts, voice) => {
    counts[voice.family] = (counts[voice.family] ?? 0) + 1;
    return counts;
  }, {});
  const groundCell = getCombatGroundPlan().cellAt(Math.round(combat.playerMapX), Math.round(combat.playerMapY));
  return {
    fps: combat.fps,
    averageFrameMs,
    p95FrameMs,
    averageUpdateMs,
    p95UpdateMs,
    averageRenderMs,
    p95RenderMs,
    sampleCount: samples.length,
    adaptivePerformance: { ...combat.adaptivePerformance },
    occupancy,
    budgets: {
      maxEnemiesOnMap: director.maxEnemiesOnMap,
      enemyProjectileCap: director.enemyProjectileCap,
      maxParticles: performanceBudget.maxParticles,
      maxFloatingTexts: performanceBudget.maxFloatingTexts,
      maxAudioVoices: HMH_AUDIO_MIX.maxVoices,
    },
    animation: { ...combat.enemyRenderStats },
    audio: {
      activeVoices: combatAudio.activeVoices.size,
      peakVoices: combatAudio.peakVoices,
      droppedVoices: combatAudio.droppedVoices,
      stolenVoices: combatAudio.stolenVoices,
      familyCounts: audioFamilyCounts,
      familyCaps: HMH_AUDIO_MIX.familyCaps,
    },
    simulation: { ...combat.fixedStepStats },
    enemyPursuitModes: combat.enemies.reduce((counts, enemy) => {
      const mode = enemy.pursuitMode ?? 'unplanned';
      counts[mode] = (counts[mode] ?? 0) + 1;
      return counts;
    }, {}),
    canvas: {
      internalWidth: dom.combatCanvas?.width ?? 0,
      internalHeight: dom.combatCanvas?.height ?? 0,
      cssWidth: dom.combatCanvas?.getBoundingClientRect().width ?? 0,
      cssHeight: dom.combatCanvas?.getBoundingClientRect().height ?? 0,
    },
    groundRender: { ...combat.groundRenderStats },
    groundCell: {
      terrainRole: groundCell.terrainRole,
      textureKey: groundCell.textureKey,
      isBridge: groundCell.isBridge,
    },
    obstacleCount: currentObstacles().length,
    player: {
      x: combat.playerMapX,
      y: combat.playerMapY,
      boundaryClamped: combat.worldBoundaryClamped,
    },
  };
}

function setupHmhSoakStressBossSwarm({ targetEnemyCount = 48, elapsedSeconds = 12 * 60 } = {}) {
  if (!combat.active || !combat.roguelikeRun) {
    return { ok: false, reason: 'inactive-run', activeEnemies: combat.enemies.length, bossEnemies: 0 };
  }
  const stressElapsedSeconds = Math.max(12 * 60, Number(elapsedSeconds) || 0);
  combat.elapsedGameSeconds = stressElapsedSeconds;
  const director = currentRoguelikeSpawnDirector(stressElapsedSeconds);
  const target = Math.min(
    Math.max(1, director.maxEnemiesOnMap),
    Math.max(40, Math.round(Number(targetEnemyCount) || 48)),
  );
  combat.enemies = [];
  combat.enemyShots = [];
  combat.particles = [];
  combat.vfxParticles = [];
  combat.floatingTexts = [];
  combat.boss = null;
  combat.activePoiEncounterId = null;
  combat.triggeredBossBeatIds = new Set();
  combat.adaptivePerformance = createAdaptivePerformanceState();
  combatAudio.peakVoices = combatAudio.activeVoices.size;
  combatAudio.droppedVoices = 0;
  combatAudio.stolenVoices = 0;
  combat.fixedStepStats = createFixedStepStats();
  combat.invulnerableFrames = Math.max(combat.invulnerableFrames, 60 * 60 * 60);
  for (let index = 0; index < target - 1; index += 1) {
    spawnRoguelikeEnemy(director, {
      seed: 91000 + index,
      ignoreSpawnBudget: true,
      spawnSource: 'soak-minute12-swarm',
      spawnLaneRole: index % 7 === 0 ? 'elite' : index % 3 === 0 ? 'ranged' : 'rusher',
      ranged: index % 3 === 0,
      elite: index % 7 === 0,
      angleRadians: index * 2.399963229728653,
      radiusTiles: 6 + (index % 4) * 1.1,
      minDistanceTiles: 4,
      attackTimer: 90 + ((index * 37) % 240),
      spawnFrames: 30,
    });
  }
  const stressBeat = Object.freeze({
    id: 'soak-minute12-major-boss',
    type: 'major-boss',
    pressureTier: 2,
    rosterOffset: 0,
  });
  const bossSpawned = spawnLevelOneBossBeat(stressBeat, director);
  const stressDurabilityMultiplier = 20;
  for (const enemy of combat.enemies) {
    enemy.hp = Math.max(enemy.hp, Math.round(enemy.maxHp * stressDurabilityMultiplier));
    enemy.maxHp = enemy.hp;
  }
  const bossEnemies = combat.enemies.filter((enemy) => enemy.boss || enemy.miniBoss || enemy.signatureBoss).length;
  return {
    ok: bossSpawned && combat.enemies.length >= target,
    elapsedSeconds: combat.elapsedGameSeconds,
    targetEnemyCount: target,
    activeEnemies: combat.enemies.length,
    bossEnemies,
    bossSpawned,
    stressDurabilityMultiplier,
    directorMaxEnemies: director.maxEnemiesOnMap,
    adaptiveTier: combat.adaptivePerformance.tier,
  };
}

const hmhSoakMode = debugSearchParams.get('soak') === '1';
if (tacticalBalanceDebugEnabled || hmhSoakMode) {
  Object.defineProperty(globalThis, '__hmhVisualDebugPerformance', {
    configurable: true,
    value: hmhVisualDebugPerformanceSnapshot,
  });
}
if (hmhSoakMode) {
  Object.defineProperty(globalThis, '__hmhSoakStressBossSwarm', {
    configurable: true,
    value: setupHmhSoakStressBossSwarm,
  });
}

if (tacticalBalanceDebugEnabled) {
  Object.defineProperty(globalThis, '__hmhVisualDebugTeleport', {
    configurable: true,
    async value(worldX, worldY) {
      if (!combat.active) return null;
      const bounds = buildLevelOneRunWorldDimensions({ width: combat.worldWidth, height: combat.worldHeight });
      combat.playerMapX = clamp(Number(worldX) || 0, bounds.minX, bounds.maxX);
      combat.playerMapY = clamp(Number(worldY) || 0, bounds.minY, bounds.maxY);
      if (combat.roguelikeRun?.player) {
        combat.roguelikeRun.player.x = combat.playerMapX;
        combat.roguelikeRun.player.y = combat.playerMapY;
      }
      combat.enemies = [];
      combat.velocityX = 0;
      combat.velocityY = 0;
      _obstacleCacheFrame = -1;
      syncProjectedPlayerPosition();
      const visibleObjects = buildLevelOneWorldV3VisibleObjects({
        playerX: combat.playerMapX,
        playerY: combat.playerMapY,
        window: 18,
        frame: combat.frame,
      });
      const visibleImages = visibleObjects.map((object) => curatedLevelOneImage(object.assetKey));
      await Promise.all(visibleImages.map((image) => decodeImageAsset(image)));
      const unresolvedImages = [...new Set(visibleImages.filter((image) => !imageReady(image)))];
      if (unresolvedImages.length) await Promise.all(unresolvedImages.map((image) => decodeImageAsset(image)));
      const decodedCount = visibleImages.filter((image) => imageReady(image)).length;
      _obstacleCacheFrame = -1;
      const obstacles = currentObstacles();
      const obstacleCount = obstacles.length;
      const renderEntryCount = buildObstacleRenderEntries(dom.combatCanvas.getContext('2d')).length;
      return {
        x: combat.playerMapX,
        y: combat.playerMapY,
        objectCount: visibleObjects.length,
        decodedCount,
        obstacleCount,
        renderEntryCount,
        assetKeys: visibleObjects.map((object) => object.assetKey),
        obstacleAssetKeys: obstacles.map((object) => object.curatedAssetKey ?? object.sceneAssetKey ?? null).filter(Boolean),
      };
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugSetPosition', {
    configurable: true,
    value(x, y) {
      combat.playerMapX = Number(x) || 0;
      combat.playerMapY = Number(y) || 0;
      combat.cameraX = combat.playerMapX;
      combat.cameraY = combat.playerMapY;
      combat.enemies = [];
      combat.boss = null;
      _obstacleCacheFrame = -1;
      return { x: combat.playerMapX, y: combat.playerMapY };
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugNudge', {
    configurable: true,
    value(dx, dy) {
      const world = buildLevelOneRunWorldDimensions({ width: combat.worldWidth, height: combat.worldHeight });
      const bounded = clampLevelOneWorldPoint({
        x: combat.playerMapX + (Number(dx) || 0),
        y: combat.playerMapY + (Number(dy) || 0),
        world,
        padding: 0.42,
      });
      combat.playerMapX = bounded.x;
      combat.playerMapY = bounded.y;
      combat.worldBoundaryClamped = bounded.clamped;
      syncProjectedPlayerPosition();
      return { x: bounded.x, y: bounded.y, clamped: bounded.clamped };
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugScene', {
    configurable: true,
    value() {
      _obstacleCacheFrame = -1;
      const obstacles = currentObstacles();
      const entries = buildObstacleRenderEntries(dom.combatCanvas.getContext('2d'));
      const undecodedIds = obstacles
        .filter((obstacle) => obstacle.curatedAssetKey && !imageReady(curatedLevelOneImage(obstacle.curatedAssetKey)))
        .map((obstacle) => obstacle.id);
      return {
        playerX: combat.playerMapX,
        playerY: combat.playerMapY,
        campaignLevelId: combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID,
        routePacing: currentLevelOneRoutePacing(),
        activePoi: currentCampaignPoi(),
        combatActive: Boolean(combat.active),
        gameOver: Boolean(combat.gameOver),
        paused: Boolean(combat.paused),
        levelUpPaused: Boolean(combat.roguelikeRun?.pausedForLevelUp),
        hp: combat.health,
        obstacleIds: obstacles.map((obstacle) => obstacle.id),
        solidObstacles: obstacles
          .filter((obstacle) => obstacle.solid && Number.isFinite(obstacle.worldX) && Number.isFinite(obstacle.worldY))
          .map((obstacle) => ({
            id: obstacle.id,
            worldX: obstacle.worldX,
            worldY: obstacle.worldY,
            footprintTiles: obstacle.footprintTiles ?? null,
            radius: obstacle.radius ?? null,
          })),
        renderedIds: entries.map((entry) => entry.id).filter(Boolean),
        undecodedIds,
      };
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugSpawnLaneRole', {
    configurable: true,
    value(laneRole = 'ranged', dx = 4, dy = 0) {
      if (!combat.active || !combat.roguelikeRun) {
        return {
          error: 'inactive-combat',
          combatActive: Boolean(combat.active),
          hasRoguelikeRun: Boolean(combat.roguelikeRun),
          gameOver: Boolean(combat.gameOver),
        };
      }
      const previousElapsed = combat.elapsedGameSeconds;
      const debugElapsed = Math.max(previousElapsed, 420);
      combat.elapsedGameSeconds = debugElapsed;
      try {
        const director = currentRoguelikeSpawnDirector(debugElapsed);
        const targetMapX = combat.playerMapX + (Number(dx) || 0);
        const targetMapY = combat.playerMapY + (Number(dy) || 0);
        const enemy = spawnRoguelikeEnemy(director, {
          spawnLaneRole: String(laneRole),
          forceEnemyId: String(laneRole) === 'elite' ? 'bandit-captain' : undefined,
          mapX: targetMapX,
          mapY: targetMapY,
          ignoreSpawnBudget: true,
        });
        if (!enemy) return { error: 'debug-spawn-rejected', spawnLaneRole: String(laneRole) };
        enemy.spawnLaneRole = String(laneRole);
        enemy.spawnLaneRoleApplied = true;
        enemy.spawnLaneTelegraph = levelOneSpawnLaneTelegraphForRole(enemy.spawnLaneRole);
        enemy.mapX = targetMapX;
        enemy.mapY = targetMapY;
        const projected = groundEntityContactPointForProjection(isoToScreen(enemy.mapX, enemy.mapY));
        enemy.x = projected.x;
        enemy.y = projected.y;
        enemy.spawnFrames = 120;
        enemy.spawnLaneTelegraphStarted = true;
        enemy.spawnLaneTelegraphFrames = 120;
        enemy.speed = 0;
        return {
          id: enemy.id,
          title: enemy.title,
          spawnLaneRole: enemy.spawnLaneRole,
          spawnLaneRoleApplied: enemy.spawnLaneRoleApplied,
          marker: enemy.spawnLaneTelegraph?.marker ?? null,
          color: enemy.spawnLaneTelegraph?.color ?? null,
          elite: enemy.elite,
        };
      } finally {
        combat.elapsedGameSeconds = previousElapsed;
      }
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugLaneRoleEnemies', {
    configurable: true,
    value() {
      return combat.enemies
        .filter((enemy) => enemy.spawnLaneTelegraph)
        .map((enemy) => ({
          id: enemy.id,
          spawnLaneRole: enemy.spawnLaneRole,
          marker: enemy.spawnLaneTelegraph?.marker ?? null,
          spawnFrames: enemy.spawnFrames ?? 0,
          spawnLaneTelegraphFrames: enemy.spawnLaneTelegraphFrames ?? 0,
          hp: enemy.hp,
          mapX: enemy.mapX,
          mapY: enemy.mapY,
          x: enemy.x,
          y: enemy.y,
        }));
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugBoss', {
    configurable: true,
    value(requestedPhase = 1) {
      if (!combat.active || !combat.roguelikeRun) return null;
      const phase = requestedPhase === 'death' ? 3 : clamp(Math.round(Number(requestedPhase) || 1), 1, 3);
      const director = currentRoguelikeSpawnDirector(combat.elapsedGameSeconds);
      combat.enemies = combat.enemies.filter((enemy) => !enemy.signatureBoss);
      const boss = spawnRoguelikeEnemy(director, {
        boss: true,
        elite: true,
        miniBoss: true,
        signatureBoss: true,
        forceEnemyId: 'rug-pull-baron',
        poiId: 'rugpull-gulch-boss-yard',
        hpMultiplier: 8,
        mapX: combat.playerMapX + 4,
        mapY: combat.playerMapY - 2,
      });
      boss.mapX = combat.playerMapX + 4;
      boss.mapY = combat.playerMapY - 2;
      const projectedBoss = isoToScreen(boss.mapX, boss.mapY);
      boss.x = projectedBoss.x;
      boss.y = projectedBoss.y + 38;
      boss.hp = boss.maxHp * ({ 1: 0.9, 2: 0.5, 3: 0.2 }[phase] ?? 0.9);
      boss.phase = phase;
      boss.lastBossPhaseId = null;
      updateLevelOneSignatureBoss(director);
      if (requestedPhase === 'death') {
        combat.enemies = combat.enemies.filter((enemy) => enemy !== boss);
        combat.bossDeathSpectacle = {
          ...boss,
          hp: 0,
          phase: 3,
          deathSpectacle: true,
          lifeFrames: 90,
          maxLifeFrames: 90,
        };
      }
      const frame = wo110BossRuntimeFrame(requestedPhase === 'death' ? combat.bossDeathSpectacle : boss);
      return {
        id: boss.id,
        title: boss.title,
        phase,
        state: requestedPhase === 'death' ? 'death-spectacle' : frame?.state ?? 'phase-form',
        assetKey: frame?.asset?.key ?? null,
        src: frame?.img?.src ?? null,
        ready: Boolean(frame?.ready),
      };
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugHero', {
    configurable: true,
    value() {
      const frame = selectHeroFrame();
      return {
        characterId: combat.characterId,
        rosterKey: heroRosterKey(combat.characterId),
        availableRosterCount: Object.keys(hmh('HMH_ANIMATED_ROSTER') ?? {}).length,
        ready: imageReady(frame),
        src: frame?.src ?? '',
        naturalWidth: frame?.naturalWidth ?? 0,
        naturalHeight: frame?.naturalHeight ?? 0,
      };
    },
  });
  Object.defineProperty(globalThis, '__hmhVisualDebugOpenLevelUp', {
    configurable: true,
    value() {
      if (!combat.active || !combat.roguelikeRun) return null;
      combat.roguelikeRun = { ...combat.roguelikeRun, pausedForLevelUp: true };
      openLevelUpMenu();
      return {
        level: combat.roguelikeRun.level,
        choices: combat.levelUpChoices.map((choice) => choice.id),
      };
    },
  });
}

function currentGrenadeAimPreview(heldMs = 0) {
  const type = resolveGrenadeTypeForRun(combat.roguelikeRun);
  return buildGrenadeAimPreview({
    typeId: type.id,
    heldMs,
    playerX: combat.playerMapX,
    playerY: combat.playerMapY,
    aimX: combat.manualAim?.x ?? combat.aimMapX,
    aimY: combat.manualAim?.y ?? combat.aimMapY,
    blastRadius: type.blastRadius,
    radiusMultiplier: combat.roguelikeRun?.stats.grenadeRadius ?? 1,
    enemies: combat.enemies,
  });
}

function startGrenadeAimInput({ source = 'touch', pointerId = null, clientX = 0, clientY = 0 } = {}) {
  if (!combat.roguelikeRun || combat.paused || combat.gameOver) {
    grenade();
    return;
  }
  const now = performance.now?.() ?? Date.now();
  combat.grenadeAim = { active: true, source, pointerId, startedAt: now, startX: clientX, startY: clientY, currentX: clientX, currentY: clientY, canceled: false };
  combat.grenadeTarget = currentGrenadeAimPreview(0);
  combat.grenadeTargetKind = 'grenade-reticle';
}

function updateGrenadeAimInput({ clientX = 0, clientY = 0 } = {}) {
  if (!combat.grenadeAim?.active) return;
  combat.grenadeAim.currentX = clientX;
  combat.grenadeAim.currentY = clientY;
  combat.grenadeAim.canceled = combat.grenadeAim.canceled || isGrenadeAimCancel({
    startX: combat.grenadeAim.startX,
    startY: combat.grenadeAim.startY,
    currentX: clientX,
    currentY: clientY,
    cancelZoneY: Math.max(64, combat.grenadeAim.startY - 96),
  });
  const heldMs = (performance.now?.() ?? Date.now()) - combat.grenadeAim.startedAt;
  combat.grenadeTarget = currentGrenadeAimPreview(heldMs);
  combat.grenadeTargetKind = combat.grenadeAim.canceled ? 'grenade-cancel' : 'grenade-reticle';
}

function cancelGrenadeAimInput({ secondFingerTap = false } = {}) {
  if (!combat.grenadeAim?.active) return;
  combat.grenadeAim.canceled = true;
  combat.grenadeTargetKind = 'grenade-cancel';
}

function releaseGrenadeAimInput() {
  if (!combat.grenadeAim?.active) return;
  const heldMs = (performance.now?.() ?? Date.now()) - combat.grenadeAim.startedAt;
  const release = classifyGrenadeRelease({ heldMs, canceled: combat.grenadeAim.canceled });
  const preview = currentGrenadeAimPreview(heldMs);
  combat.grenadeAim = null;
  if (release === 'cancel') {
    spawnText('NADE CANCEL', combat.playerX + 20, combat.playerY - 80, '#8cf7ff');
    combat.grenadeTargetKind = 'grenade-reticle';
    return;
  }
  grenade(release === 'aimed' ? { target: preview } : {});
}

function shootRoguelike() {
  const weapon = weaponById(combat.weaponId);
  const upgradePolicy = currentUpgradeRuntimePolicy();
  // Clip gate: never fire on an empty clip — updateAutoFire schedules the reload.
  if ((combat.clip ?? 0) <= 0) {
    return;
  }
  combat.clip -= 1;
  combat.ammo = combat.clip; // keep legacy mirror in sync
  combat.shots += 1;
  combat.fireFlash = gameSettings.reduceFlash ? 1 : 4; // brief muzzle-flash brightening for the lighting pass
  combat.lastShotFrame = combat.frame; // drives only the actor firing pose; bullets are VFX objects below

  const profile = projectileProfileForWeapon(weapon.id);
  const damageScale = (combat.roguelikeRun?.stats.damage ?? 1) * ((combat.powerUpTimers.berserk ?? 0) > 0 ? 1.5 : 1);
  const speedScale = combat.roguelikeRun?.stats.bulletSpeed ?? 1;
  const baseAng = Math.atan2(combat.aimMapY, combat.aimMapX);
  const aimX = Math.cos(baseAng);
  const aimY = Math.sin(baseAng);
  const sideX = -aimY;
  const sideY = aimX;
  const muzzleWorldX = combat.playerMapX + aimX * 0.72 + sideX * 0.08;
  const muzzleWorldY = combat.playerMapY + aimY * 0.72 + sideY * 0.08;
  const muzzle = projectPlayerShotScreenPoint(isoToScreen(muzzleWorldX, muzzleWorldY));

  // Shotgun/spread weapons emit separate pellet physics objects. Pistol and
  // machine-gun power-up emit one slug per rate-of-fire tick. No bullet sprites or
  // instant full-length rays: drawBullets renders short coded tracer segments from
  // each projectile's previous/current world position.
  const pellets = weapon.pellets ?? 1;
  const spreadBase = pellets > 1 ? profile.spreadRadians : profile.spreadRadians * 0.5;
  const spread = spreadBase * upgradePolicy.spreadMultiplier;
  for (let i = 0; i < pellets; i += 1) {
    const t = pellets === 1 ? 0 : (i / (pellets - 1)) - 0.5;
    const deterministicJitter = pellets === 1 ? ((combat.shots % 3) - 1) * spread : 0;
    const ang = baseAng + t * spread + deterministicJitter;
    const vx = Math.cos(ang) * profile.speed * speedScale;
    const vy = Math.sin(ang) * profile.speed * speedScale;
    const projected = projectPlayerShotScreenPoint(isoToScreen(muzzleWorldX, muzzleWorldY));
    combat.bullets.push({
      worldX: muzzleWorldX,
      worldY: muzzleWorldY,
      prevWorldX: muzzleWorldX - Math.cos(ang) * 0.06,
      prevWorldY: muzzleWorldY - Math.sin(ang) * 0.06,
      vx,
      vy,
      x: projected.x,
      y: projected.y,
      damage: weapon.damage * damageScale,
      weaponId: weapon.id,
      ttl: profile.ttl,
      maxTtl: profile.ttl,
      hitRadius: profile.hitRadius,
      pierceRemaining: upgradePolicy.additionalPierceTargets
        + (upgradePolicy.weaponEvolution === 'settler-rail' && weapon.id === 'coin-blaster' ? 2 : 0),
      hitEnemies: new Set(),
      weaponEvolution: upgradePolicy.weaponEvolution,
      visual: {
        color: profile.color,
        coreColor: profile.coreColor,
        coreLength: profile.coreLength,
        coreWidth: profile.coreWidth,
        trailAlpha: profile.trailAlpha,
        trailWidth: profile.trailWidth,
      },
    });
  }

  spawnMuzzleFlash(muzzle.x, muzzle.y, weapon.id);
  for (let i = 0; i < (profile.casingCount ?? 0); i += 1) {
    emitCombatVfxParticles(createShellCasing(muzzle.x - sideX * 7, muzzle.y - sideY * 4));
  }
  if (gameSettings.screenShake && !gameSettings.reduceMotion) combat.shake = Math.min(8, (combat.shake ?? 0) + profile.screenShake);
  playSfxCue(weaponFireCueFor(weapon.id), weapon.id === 'auto-miner' ? 0.022 : weapon.id === 'hash-rail' ? 0.045 : 0.035);
}

function openLevelUpMenu() {
  if (!combat.roguelikeRun?.pausedForLevelUp) return;
  const draftRng = roguelikeRngStream('draft');
  const offer = chooseRoguelikeUpgradeOptions(combat.roguelikeRun, { rng: draftRng, seed: combat.frame + combat.kills, includeLockedPreviews: true });
  // WO-73: two choices total. The pure draft generator composes one continuation
  // slot and one fresh tree slot; weapon branches remain data in the broader
  // upgrade system but no longer add a third level-up card.
  combat.levelUpChoices = buildLevelUpPair(offer.options);
  combat.levelUpLockedPreviews = offer.lockedPreviews ?? [];
  combat.levelUpPaused = true;
  combat.paused = true;
  combat.keys.clear();
  deviceState.touchKeys = new Set();
  levelUpInteractionGate = buildLevelUpInteractionGate({
    openedAt: levelUpClock(),
    activePointerIds: activeLevelUpPointerIds,
  });
  document.documentElement.dataset.levelUp = 'true';
  combat.status = 'LEVEL UP: choose one upgrade. The roguelike run is paused until you pick.';
  playSfxCue('upgrade-offer', 0.065);
  applyCombatFeedback('level-up', {
    level: combat.roguelikeRun?.level ?? 1,
    rerollsRemaining: combat.roguelikeRun?.rerollsRemaining ?? 0,
    sfxVolume: 0.07,
  }, { x: ISO_CENTER_X, y: ISO_CENTER_Y });
  syncCombatOverlay();
}

function rerollLevelUpChoices() {
  if (!combat.levelUpPaused || !combat.roguelikeRun || combat.roguelikeRun.rerollsRemaining <= 0) return;
  combat.roguelikeRun = { ...combat.roguelikeRun, rerollsRemaining: combat.roguelikeRun.rerollsRemaining - 1 };
  const draftRng = roguelikeRngStream('draft');
  const offer = chooseRoguelikeUpgradeOptions(combat.roguelikeRun, {
    rng: draftRng,
    seed: combat.frame + combat.kills + 999,
    reroll: true,
    includeLockedPreviews: true,
    excludeSkillIds: combat.levelUpChoices.map((choice) => choice.id),
  });
  combat.levelUpChoices = buildLevelUpPair(offer.options);
  combat.levelUpLockedPreviews = offer.lockedPreviews ?? [];
  playSfxCue('upgrade-reroll', 0.05);
  syncCombatOverlay();
}

// Preserve the historical runtime hook name, but WO-73 delegates composition to
// chooseRoguelikeUpgradeOptions: exactly two cards, already labeled by slot.
function buildLevelUpPair(roguelikeOptions) {
  return [...(roguelikeOptions ?? [])].slice(0, LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.choicesPerLevel);
}

function branchLabel(branchKey) {
  return ({ rateOfFire: 'Fire Rate', damage: 'Damage', reloadSpeed: 'Reload Speed' })[branchKey] ?? branchKey;
}

function titleOfWeapon(weaponId) {
  const w = weaponById(weaponId);
  return w.title ?? w.displayName ?? weaponId;
}

function selectLevelUpUpgrade(skillId) {
  if (!combat.levelUpPaused || !combat.roguelikeRun) return;
  const skill = combat.levelUpChoices.find((choice) => choice.id === skillId);

  // Weapon-tree branches: store the tier choice on `combat.weaponUpgrades` keyed
  // by current weapon id + branch, instead of in the roguelike skill library.
  const weaponTreeMatch = skillId.match(/^weapon-tree-(rateOfFire|damage|reloadSpeed)$/);
  if (weaponTreeMatch) {
    const branchKey = weaponTreeMatch[1];
    const weaponId = combat.weaponId;
    combat.weaponUpgrades = { ...(combat.weaponUpgrades ?? {}) };
    const perWeapon = { ...(combat.weaponUpgrades[weaponId] ?? {}) };
    perWeapon[branchKey] = (perWeapon[branchKey] ?? 0) + 1;
    combat.weaponUpgrades[weaponId] = Object.freeze(perWeapon);
    combat.weaponUpgrades = Object.freeze(combat.weaponUpgrades);
    combat.levelUpChoices = [];
    combat.levelUpLockedPreviews = [];
    combat.levelUpPaused = false;
    combat.paused = false;
    closeLevelUpInteractionGate();
    combat.status = `Weapon branch upgraded: ${titleOfWeapon(weaponId)} ${branchLabel(branchKey)} tier ${perWeapon[branchKey]}/3.`;
    spawnText(
      `${titleOfWeapon(weaponId)} ${branchLabel(branchKey)} T${perWeapon[branchKey]}`,
      ISO_CENTER_X - 58, ISO_CENTER_Y - 64, '#ffe84d',
    );
    playSfxCue('upgrade-pick', 0.07);
    syncCombatOverlay();
    return;
  }

  combat.roguelikeRun = applyRoguelikeSkillUpgrade(combat.roguelikeRun, skillId);
  syncUpgradeRuntimeState({ grantMaxHealthIncrease: true });
  combat.levelUpChoices = [];
  combat.levelUpLockedPreviews = [];
  combat.levelUpPaused = false;
  combat.paused = false;
  closeLevelUpInteractionGate();
  combat.status = `${skill?.title ?? 'Upgrade'} applied. Prepare for the next pressure wall.`;
  spawnText(`${skill?.title ?? 'UPGRADE'} APPLIED`, ISO_CENTER_X - 44, ISO_CENTER_Y - 64, '#45ff8a');
  playSfxCue('upgrade-pick', 0.07);
  syncCombatOverlay();
}

function currentEnvironmentState() {
  return buildEnvironmentState({
    seed: combat.roguelikeRun?.seed ?? 0,
    elapsedSeconds: combat.elapsedGameSeconds ?? 0,
    levelId: combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID,
  });
}

function currentReadabilityProfile(environmentState = currentEnvironmentState()) {
  return buildCombatReadabilityProfile({
    enemyCount: combat.enemies?.length ?? 0,
    projectileCount: (combat.enemyShots?.length ?? 0) + (combat.bullets?.length ?? 0),
    weatherId: environmentState?.weather?.id ?? 'clear',
  });
}

function currentAmbientZoneModel(environmentState = currentEnvironmentState()) {
  const district = currentPlayerDistrictContext();
  const poi = currentCampaignPoi();
  return buildAmbientZoneModel({
    districtFamily: district?.districtFamily ?? null,
    poiId: poi?.id ?? combat.activePoiEncounterId ?? null,
    weatherId: environmentState?.weather?.id ?? 'clear',
  });
}

function currentPlayerDistrictContext() {
  if ((combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) === HMH_LEVEL_ONE_ID) {
    return levelOneWorldV3DistrictContextAt(combat.playerMapX, combat.playerMapY);
  }
  const worldOffsetX = Math.floor(combat.worldWidth / 2);
  const worldOffsetY = Math.floor(combat.worldHeight / 2);
  const cellX = Math.floor((combat.playerMapX + worldOffsetX) / SCENE_CELL);
  const cellY = Math.floor((combat.playerMapY + worldOffsetY) / SCENE_CELL);
  return sceneTemplateContextAt(cellX, cellY);
}

function spawnRoguelikeEnemy(director = currentRoguelikeSpawnDirector(combat.elapsedGameSeconds), options = {}) {
  const districtContext = currentPlayerDistrictContext();
  const activePoi = currentCampaignPoi();
  const activeEncounterVisualPlan = combat.activePoiEncounterVisualPlan ?? null;
  const actComposition = buildLevelOneSpawnCompositionAt(combat.elapsedGameSeconds);
  const poiId = options.poiId ?? activePoi?.id ?? districtContext?.poiId ?? districtContext?.poiApproachId ?? null;
  const spawnSeed = options.seed ?? (combat.frame + combat.kills + combat.enemies.length);
  const isLevelOneSpawn = (combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) === DEFAULT_CAMPAIGN_LEVEL_ID;
  const routePacing = isLevelOneSpawn ? currentLevelOneRoutePacing() : null;
  const layoutSpawnRequest = isLevelOneSpawn
    ? levelOneLayoutV4SpawnRequest({
        playerX: combat.playerMapX,
        playerY: combat.playerMapY,
        seed: spawnSeed,
        minDistanceTiles: Math.max(actComposition.minSpawnDistanceTiles + (routePacing?.minSpawnDistanceBonus ?? 0), 18),
      })
    : null;
  const usesAuthoredLayoutPoint = Boolean(
    layoutSpawnRequest
    && options.angleRadians == null
    && options.radiusTiles == null
    && options.mapX == null
    && options.mapY == null
  );
  const spawnLaneRole = options.spawnLaneRole ?? (usesAuthoredLayoutPoint ? layoutSpawnRequest?.laneRole : null) ?? null;
  const spawn = chooseEnemySpawn({
    elapsedSeconds: combat.elapsedGameSeconds,
    seed: spawnSeed,
    districtFamily: options.districtFamily ?? districtContext?.districtFamily ?? null,
    activePoiId: poiId,
    forceEnemyId: options.forceEnemyId ?? null,
    spawnLaneRole,
  });
  const angle = options.angleRadians ?? layoutSpawnRequest?.angleRadians ?? ((((combat.frame * 37) + combat.enemies.length * 71) % 360) * Math.PI / 180);
  const radius = options.radiusTiles ?? Math.max(layoutSpawnRequest?.distanceTiles ?? 0, actComposition.minSpawnDistanceTiles + (routePacing?.minSpawnDistanceBonus ?? 0), 10 + (combat.frame % 5));
  const rangedRoll = ((combat.frame + combat.enemies.length) % 100) / 100;
  const rangedShare = Math.max(0, Math.min(1, Math.min(director.rangedEnemyShare, actComposition.rangedEnemyShare ?? director.rangedEnemyShare) + (routePacing?.rangedShareDelta ?? 0)));
  const ranged = options.ranged ?? (spawn.enemy.preferredRangeMode === 'ranged'
    ? true
    : spawn.enemy.preferredRangeMode === 'melee'
      ? false
      : rangedRoll < rangedShare);
  const elite = options.elite ?? (
    levelOneSpawnLaneForcesElite(spawnLaneRole)
    || ((((combat.frame + combat.kills) % 100) / 100) < Math.min(1, director.eliteEnemyShare * (routePacing?.eliteChanceMul ?? 1)))
  );
  const miniBoss = Boolean(options.miniBoss);
  const useAuthoredLayoutPoint = usesAuthoredLayoutPoint;
  const desiredMapX = options.mapX ?? (useAuthoredLayoutPoint ? layoutSpawnRequest.desiredX : combat.playerMapX + Math.cos(angle) * radius);
  const desiredMapY = options.mapY ?? (useAuthoredLayoutPoint ? layoutSpawnRequest.desiredY : combat.playerMapY + Math.sin(angle) * radius);
  const isPoiSpawn = String(options.spawnSource ?? '').startsWith('poi-');
  const minSpawnDistance = options.minDistanceTiles
    ?? (spawn.enemy.boss
      ? ROGUELIKE_MIN_BOSS_SPAWN_DISTANCE_TILES
      : miniBoss
        ? ROGUELIKE_MIN_MINIBOSS_SPAWN_DISTANCE_TILES
        : isPoiSpawn
          ? ROGUELIKE_MIN_POI_SUPPORT_SPAWN_DISTANCE_TILES
          : Math.max(ROGUELIKE_MIN_ENEMY_SPAWN_DISTANCE_TILES, (actComposition.minSpawnDistanceTiles ?? ROGUELIKE_MIN_ENEMY_SPAWN_DISTANCE_TILES) + (routePacing?.minSpawnDistanceBonus ?? 0)));
  const spawnWorldBounds = (combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) === DEFAULT_CAMPAIGN_LEVEL_ID
    ? buildLevelOneRunWorldDimensions({ width: combat.worldWidth, height: combat.worldHeight })
    : null;
  const safeSpawn = resolveDistantSpawnPosition({
    seed: combat.roguelikeRun?.seed ?? 0,
    playerX: combat.playerMapX,
    playerY: combat.playerMapY,
    desiredX: desiredMapX,
    desiredY: desiredMapY,
    minDistance: minSpawnDistance,
    fallbackAngleRadians: angle,
    fallbackRadiusTiles: Math.max(radius, minSpawnDistance),
    biomeAt: currentTerrainBiomeAt,
    worldBounds: spawnWorldBounds,
  });
  if (safeSpawn.adjusted || safeSpawn.boundsAdjusted) {
    debugRuntimeLog('[spawn] adjusted enemy spawn away from player/water', {
      enemyId: spawn.enemy.id,
      miniBoss,
      requested: { x: desiredMapX, y: desiredMapY },
      resolved: safeSpawn,
    });
  }
  const durabilityScale = options.boss ? 4.2 : miniBoss ? 2.45 : elite ? 1.55 : 0.82;
  const balanceCard = buildEnemyBalanceCard({
    enemy: spawn.enemy,
    elite: elite || miniBoss,
    boss: Boolean(options.boss || spawn.enemy.boss),
    pressure: director.pressure,
    playerMoveSpeed: 4.15 * (combat.roguelikeRun?.stats?.movementSpeed ?? 1),
  });
  const affixes = options.signatureBoss ? [] : resolveEliteAffixes({
    enemyId: spawn.enemy.id,
    elite: elite || miniBoss,
    boss: Boolean(options.boss || spawn.enemy.boss),
    pressure: director.pressure,
    seed: options.affixSeed ?? options.seed ?? ((combat.roguelikeRun?.seed ?? 0) + combat.frame + combat.kills + combat.enemies.length),
    role: balanceCard.role,
    affixWeightByPressure: balanceCard.affixWeightByPressure,
  });
  const affixRuntime = summarizeEliteAffixRuntime(affixes);
  const spawnSpeed = Number((balanceCard.speedLaw.spawnSpeed * affixRuntime.speedMultiplier).toFixed(3));
  const enemy = {
    ...spawn.enemy,
    title: options.title ?? spawn.enemy.title,
    mapX: safeSpawn.x,
    mapY: safeSpawn.y,
    hp: Math.max(8, Math.round(spawn.scaledHealth * durabilityScale)),
    maxHp: Math.max(8, Math.round(spawn.scaledHealth * durabilityScale)),
    speed: spawnSpeed,
    ranged,
    elite: elite || miniBoss || Boolean(options.boss),
    miniBoss,
    boss: Boolean(options.boss || spawn.enemy.boss),
    affixes,
    affixIds: affixes.map((affix) => affix.id),
    nameplateTags: options.signatureBoss ? [(options.title ?? spawn.enemy.title).toUpperCase()] : affixes.map((affix) => affix.nameplateTag),
    affixRuntime,
    immuneToKnockback: Boolean(affixRuntime.immuneToKnockback),
    signatureBoss: Boolean(options.signatureBoss),
    aggroed: Boolean(options.boss || miniBoss || spawn.enemy.boss),
    districtFamily: options.districtFamily ?? districtContext?.districtFamily ?? null,
    poiId,
    poiEncounterId: options.poiEncounterId ?? null,
    macroRole: districtContext?.macroRole ?? null,
    spawnSource: options.spawnSource ?? (spawn.spawnContext?.source ?? 'timeline'),
    spawnLayoutZoneId: useAuthoredLayoutPoint ? layoutSpawnRequest?.zoneId ?? null : null,
    spawnLaneId: useAuthoredLayoutPoint ? layoutSpawnRequest?.laneId ?? null : null,
    spawnLaneRole,
    spawnLaneRoleApplied: Boolean(spawn.spawnContext?.laneRoleApplied),
    spawnLaneTelegraph: spawn.spawnContext?.laneRoleApplied
      ? levelOneSpawnLaneTelegraphForRole(spawnLaneRole)
      : null,
    spawnLaneTelegraphStarted: false,
    spawnLaneTelegraphFrames: 0,
    spawnBoundsAdjusted: Boolean(safeSpawn.boundsAdjusted),
    spawnResolverFound: Boolean(safeSpawn.found),
    balanceCard,
    speedLaw: balanceCard.speedLaw,
    attackTimer: Math.max(options.attackTimer ?? (ranged ? 110 + (combat.frame % 50) : 90), ROGUELIKE_MIN_SPAWN_ATTACK_DELAY_FRAMES),
    attackTokenHeld: false,
    spawnFrames: Math.max(0, options.spawnFrames ?? 18),
    tellFrames: 0,
    recoveryFrames: Math.max(balanceCard.readability.recoveryFrames, miniBoss ? Math.max(spawn.ai?.recoveryFrames ?? 20, 28) : (spawn.ai?.recoveryFrames ?? 20)),
    recoveryFramesRemaining: 0,
    score: spawn.enemy.score + (options.boss ? 900 : miniBoss ? 220 : elite ? 80 : 0),
    state: ranged ? 'ranged-fire' : 'chase-player',
  };
  const scriptedSpawn = Boolean(options.boss || miniBoss || isPoiSpawn || String(enemy.spawnSource).startsWith('boss-beat-'));
  if (isLevelOneSpawn && !scriptedSpawn && options.ignoreSpawnBudget !== true) {
    const spawnBudget = buildLevelOneSpawnBudgetState({
      elapsedSeconds: combat.elapsedGameSeconds,
      enemies: combat.enemies,
      enemyProjectiles: combat.enemyShots.length,
    });
    if (!levelOneRoguelikeSpawnBudgetAllows(spawnBudget, enemy)) return null;
  }
  const projected = groundEntityContactPointForProjection(isoToScreen(enemy.mapX, enemy.mapY));
  enemy.x = projected.x;
  enemy.y = projected.y;
  combat.enemies.push(enemy);
  return enemy;
}

function playLevelOneInteractiveSfxCues(cues = []) {
  if (!Array.isArray(cues) || cues.length === 0) return false;
  let played = false;
  for (const cue of cues) {
    if (!cue?.id) continue;
    played = playSfxCue(cue.id, cue.volume ?? 0.055) || played;
  }
  return played;
}

function refreshLevelOneInteractiveObstacleState(obstacle) {
  if (!obstacle?.interactive) return obstacle;
  const previousCueSignature = obstacle._lastLevelOneInteractiveSfxSignature ?? null;
  const state = levelOneInteractiveRuntimeStateForObstacle(obstacle, {
    bossDefeated: combat.bossDefeated,
    extractionPoint: combat.extractionPoint,
    frame: combat.frame,
  });
  obstacle.interactiveState = state;
  obstacle.debrisState = state.debrisState ?? obstacle.debrisState ?? null;
  obstacle.solid = state.solid;
  obstacle.hidden = state.visible === false;
  if (state.sfxCue && previousCueSignature !== state.sfxCue) {
    const event = state.sfxCue === 'level1-gate-unlock' ? 'gate-unlock' : 'extraction-ready';
    playLevelOneInteractiveSfxCues(levelOneInteractiveSfxCuePlan({ obstacle, event }));
    obstacle._lastLevelOneInteractiveSfxSignature = state.sfxCue;
  }
  return obstacle;
}

function currentLevelOneInteractiveHazardPressure() {
  if ((combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) !== DEFAULT_CAMPAIGN_LEVEL_ID) {
    return { moveSpeedMul: 1, label: null, activeHazards: [] };
  }
  const activeHazards = [];
  let moveSpeedMul = 1;
  for (const obstacle of currentObstacles()) {
    if (!obstacle?.interactive || obstacle.destroyed) continue;
    const effect = levelOneInteractiveHazardEffectAt({
      obstacle,
      playerX: combat.playerMapX,
      playerY: combat.playerMapY,
      frame: combat.frame,
    });
    if (!effect.inRange) continue;
    moveSpeedMul = Math.min(moveSpeedMul, effect.moveSpeedMultiplier ?? 1);
    activeHazards.push({ obstacle, effect });
  }
  return {
    moveSpeedMul,
    label: activeHazards.some((entry) => entry.effect.active) ? 'spore pulse' : activeHazards.length ? 'spore ring' : null,
    activeHazards,
  };
}

function applyLevelOneInteractiveBlastZone(zone) {
  const center = isoToScreen(zone.worldX, zone.worldY);
  spawnExplosion(center.x, center.y, '#ff7b2f');
  emitCombatVfxParticles(createExplosion(center.x, center.y, zone.radiusTiles * 18));
  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0) continue;
    if (Math.hypot(enemy.mapX - zone.worldX, enemy.mapY - zone.worldY) <= zone.radiusTiles) {
      damageEnemy(enemy, zone.damage, zone.source ?? 'level-one-interactive-explosion');
    }
  }
  if (combat.boss && combat.boss.hp > 0) {
    const bossX = combat.boss.mapX ?? zone.worldX;
    const bossY = combat.boss.mapY ?? zone.worldY;
    if (Math.hypot(bossX - zone.worldX, bossY - zone.worldY) <= zone.radiusTiles + 1) {
      damageBoss(Math.max(18, Math.round(zone.damage * 0.65)), zone.source ?? 'level-one-interactive-explosion');
    }
  }
}

function damageLevelOneInteractiveObstacle(hitObstacle, damage, source = 'bullet') {
  if (!hitObstacle?.interactive || hitObstacle.destroyed) return false;
  const obstacles = currentObstacles();
  const plan = levelOneInteractiveHitPlan({ obstacle: hitObstacle, damage, obstacles });
  if (!plan.damageable) return false;
  hitObstacle.hp = plan.nextHp;
  playLevelOneInteractiveSfxCues(plan.sfxCues);
  const hitScreen = isoToScreen(hitObstacle.worldX, hitObstacle.worldY);
  spawnText(plan.text || `PROP -${damage}`, hitScreen.x - 32, hitScreen.y - 32, plan.destroyed ? '#45ff8a' : '#ffe84d');
  if (!plan.destroyed) return true;

  hitObstacle.destroyed = true;
  hitObstacle.solid = false;
  hitObstacle.hidden = false;
  hitObstacle.debrisState = plan.debrisState;
  hitObstacle.destroyedBy = source;
  refreshLevelOneInteractiveObstacleState(hitObstacle);

  for (const drop of plan.xpDrops) {
    const assist = currentLevelOnePickupAssist();
    combat.xpGems.push({ worldX: drop.worldX, worldY: drop.worldY, value: drop.value, ttl: assist.xpTtlFrames });
  }
  for (const powerId of plan.powerUps) {
    const def = powerUpById(powerId);
    if (def) spawnRoguelikePowerUp(def, hitObstacle.worldX, hitObstacle.worldY);
  }
  if (plan.scoreBonus) combat.scoreBonus += plan.scoreBonus;
  for (const zone of plan.blastZones) applyLevelOneInteractiveBlastZone(zone);

  for (const chainedId of plan.chainDetonationIds) {
    const chained = obstacles.find((candidate) => candidate.id === chainedId);
    if (!chained || chained.destroyed) continue;
    chained.hp = 0;
    chained.destroyed = true;
    chained.solid = false;
    chained.hidden = false;
    chained.debrisState = levelOneInteractiveDebrisStateForObstacle(chained, { frame: combat.frame });
    chained.destroyedBy = 'chain-explosion';
    refreshLevelOneInteractiveObstacleState(chained);
    const chainedScreen = isoToScreen(chained.worldX, chained.worldY);
    spawnExplosion(chainedScreen.x, chainedScreen.y, '#ff7b2f');
    spawnText('CHAIN BREAK', chainedScreen.x - 32, chainedScreen.y - 28, '#ff7b2f');
  }

  trimLooseRoguelikeRewards();
  return true;
}

function currentLevelOneInteractionPrompt() {
  if (!combat.roguelikeRun || (combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) !== DEFAULT_CAMPAIGN_LEVEL_ID) {
    combat.interactionPrompt = null;
    return null;
  }
  const prompt = nearestLevelOneInteractivePrompt({
    playerX: combat.playerMapX,
    playerY: combat.playerMapY,
    obstacles: currentObstacles(),
    bossDefeated: combat.bossDefeated,
    extractionPoint: combat.extractionPoint,
  });
  combat.interactionPrompt = prompt.active ? prompt : null;
  return combat.interactionPrompt;
}

function triggerLevelOneInteraction() {
  const prompt = currentLevelOneInteractionPrompt();
  if (!prompt?.active) return false;
  const labelX = combat.playerX + 20;
  const labelY = combat.playerY - 88;
  if (!prompt.actionable) {
    spawnText(prompt.label ?? 'NOT READY', labelX, labelY, prompt.action === 'locked-gate' ? '#ff476f' : '#19f7ff');
    playSfxCue('menu-click', 0.025);
    return false;
  }
  const obstacle = currentObstacles().find((candidate) => candidate.id === prompt.obstacleId);
  if (!obstacle || obstacle.destroyed) return false;
  const damage = prompt.action === 'open-cache' ? Math.max(999, obstacle.hp ?? 1) : Math.max(32, obstacle.hp ?? 1);
  const didInteract = damageLevelOneInteractiveObstacle(obstacle, damage, 'player-interact');
  if (didInteract) {
    combat.lastInteractFrame = combat.frame;
    spawnText(prompt.action === 'open-cache' ? 'CACHE OPENED' : 'COVER BROKEN', labelX, labelY, '#45ff8a');
  }
  return didInteract;
}

function trimLooseRoguelikeRewards() {
  const assist = currentLevelOnePickupAssist();
  if (combat.xpGems.length > assist.maxLooseXpGems) {
    combat.xpGems.splice(0, combat.xpGems.length - assist.maxLooseXpGems);
  }
  if (combat.powerUps.length > assist.maxLoosePowerUps) {
    combat.powerUps.splice(0, combat.powerUps.length - assist.maxLoosePowerUps);
  }
}

function spawnLevelOneBossBeat(beat, director) {
  if (!beat || combat.triggeredBossBeatIds?.has(beat.id)) return false;
  if (combat.activePoiEncounterId || combat.boss || combat.enemies.some((enemy) => enemy.miniBoss || enemy.signatureBoss)) return false;
  const roster = levelOneRoguelikeBossRoster();
  const miniBosses = roster.filter((entry) => entry.role === 'mini-boss');
  const majorBoss = roster.find((entry) => entry.role === 'boss');
  const isMajorBossBeat = beat.type === 'major-boss' || beat.type === 'major-rematch';
  if (beat.type !== 'mini-boss-pair' && !isMajorBossBeat) return false;
  combat.triggeredBossBeatIds ??= new Set();
  combat.triggeredBossBeatIds.add(beat.id);
  if (beat.type === 'mini-boss-pair') {
    for (let i = 0; i < 2; i += 1) {
      const entry = miniBosses[(beat.rosterOffset + i) % miniBosses.length];
      spawnRoguelikeEnemy(director, {
        forceEnemyId: entry.enemyId,
        title: `${entry.title} · T${beat.pressureTier}`,
        elite: true,
        miniBoss: true,
        spawnSource: 'boss-beat-mini-boss',
        poiEncounterId: beat.id,
        radiusTiles: ROGUELIKE_MIN_MINIBOSS_SPAWN_DISTANCE_TILES + 1 + i * 2,
        angleRadians: ((combat.frame * 17 + i * 180) % 360) * Math.PI / 180,
        attackTimer: 150,
      });
    }
    spawnText(`BOSS BEAT // MINI-BOSS PAIR T${beat.pressureTier}`, ISO_CENTER_X - 142, ISO_CENTER_Y - 82, '#ffe84d');
    return true;
  }
  if (isMajorBossBeat && majorBoss) {
    combat.scriptedBossTriggered = true;
    const enemy = spawnRoguelikeEnemy(director, {
      forceEnemyId: majorBoss.enemyId,
      title: `${majorBoss.title} · T${beat.pressureTier}`,
      elite: true,
      miniBoss: true,
      boss: true,
      signatureBoss: true,
      spawnSource: beat.type === 'major-rematch' ? 'boss-beat-major-rematch' : 'boss-beat-major-boss',
      poiEncounterId: beat.id,
      radiusTiles: ROGUELIKE_MIN_BOSS_SPAWN_DISTANCE_TILES,
      attackTimer: 180,
    });
    if (enemy) {
      enemy.hp = Math.round(enemy.hp * bossBeatHealthMultiplier(beat.pressureTier));
      enemy.maxHp = enemy.hp;
    }
    spawnText(`${beat.type === 'major-rematch' ? 'BOSS REMATCH' : 'MAJOR BOSS'} // ${majorBoss.title.toUpperCase()} T${beat.pressureTier}`, ISO_CENTER_X - 154, ISO_CENTER_Y - 88, '#ff476f');
    return true;
  }
  return false;
}

// --- Roguelike world power-ups -------------------------------------------------
// Unlike the legacy side-scroller drops (screen-space, gravity, drift-left), the
// isometric roguelike spawns power-ups at world coordinates.
function powerUpById(id) {
  const normalizedId = id === 'heal-pack' ? 'health-pack' : id;
  return LESTER_BLASTER_POWER_UPS.find((p) => p.id === normalizedId) ?? null;
}

function spawnRoguelikePowerUp(def, worldX, worldY) {
  const projected = isoToScreen(worldX, worldY);
  const assist = currentLevelOnePickupAssist();
  combat.powerUps.push({
    ...def,
    worldX,
    worldY,
    x: projected.x,
    y: projected.y,
    ttl: assist.powerUpTtlFrames,
    bobSeed: (worldX * 17 + worldY * 31) % 360,
  });
  trimLooseRoguelikeRewards();
}

function spawnLevelOneSignatureBoss(director) {
  const choreography = buildLevelOneBossChoreographyPlan();
  const bossEntry = levelOneRoguelikeBossRoster().find((entry) => entry.role === 'boss');
  if (!bossEntry) return null;
  combat.scriptedBossTriggered = true;
  combat.miniBossLock = true;
  combat.scrollLockReason = `BOSS LOCK // ${bossEntry.title}`;
  lastBossId = bossEntry.enemyId;
  playSfxCue('boss-warning', 0.1);
  spawnText(`BOSS: ${bossEntry.title.toUpperCase()}`, ISO_CENTER_X - 98, ISO_CENTER_Y - 112, '#ffe84d');
  spawnText(choreography.finalBoss.phases[0]?.pattern?.toUpperCase() ?? 'BREAK HIM, CLAIM THE PAYOUT, KEEP MOVING', ISO_CENTER_X - 138, ISO_CENTER_Y - 84, '#ff7b2f');
  const bossPoint = levelOneWorldV3BossPoint();
  return spawnRoguelikeEnemy(director, {
    forceEnemyId: bossEntry.enemyId,
    title: bossEntry.title,
    spawnSource: 'level-1-signature-boss',
    poiId: bossEntry.zoneId,
    poiEncounterId: bossEntry.zoneId,
    elite: true,
    miniBoss: true,
    boss: true,
    signatureBoss: true,
    ranged: true,
    phase: 1,
    mapX: bossPoint.x,
    mapY: bossPoint.y,
    angleRadians: Math.PI * 0.15,
    radiusTiles: ROGUELIKE_MIN_MINIBOSS_SPAWN_DISTANCE_TILES + 4,
    minDistanceTiles: ROGUELIKE_MIN_MINIBOSS_SPAWN_DISTANCE_TILES,
    attackTimer: choreography.finalBoss.phases[0]?.telegraphFrames ? Math.max(150, choreography.finalBoss.phases[0].telegraphFrames * 3) : 150,
  });
}

function updateLevelOneSignatureBoss(director) {
  const level = currentCampaignLevel();
  if (level.id !== DEFAULT_CAMPAIGN_LEVEL_ID) return;
  // Drive boss phase-entry FX (banner + one-time add wave) once per frame,
  // independent of the firing cadence, so the escalation reads clearly even
  // between volleys. Keyed off the live signature boss's HP via the phase controller.
  if (combat.scriptedBossTriggered) {
    const bossEnemy = combat.enemies.find((e) => e.signatureBoss && e.hp > 0);
    if (bossEnemy) {
      const directive = buildLevelOneBossDirective({
        hp: bossEnemy.hp,
        maxHp: bossEnemy.maxHp,
        lastPhaseId: bossEnemy.bossPhaseSeenId ?? null,
      });
      bossEnemy.phase = directive.phase.phaseNumber;
      if (directive.phaseChanged) {
        bossEnemy.bossPhaseSeenId = directive.nextLastPhaseId;
        recordCurrentSessionEvent('boss-phase', {
          bossId: bossEnemy.id,
          phaseId: directive.phase.id,
          phase: directive.phase.phaseNumber,
        });
        playSfxCue('boss-phase', 0.075);
        if (directive.banner) {
          spawnText(directive.banner, ISO_CENTER_X - 120, ISO_CENTER_Y - 100, '#ff7b2f');
        }
        // One-time add wave on entering a non-suppressed phase.
        for (let i = 0; i < directive.summonAdds; i += 1) {
          spawnRoguelikeEnemy(director, {
            poiId: bossEnemy.poiId ?? 'rugpull-gulch-boss-yard',
            spawnSource: 'poi-boss-add',
            angleRadians: (i / Math.max(1, directive.summonAdds)) * Math.PI * 2,
            radiusTiles: ROGUELIKE_MIN_POI_SUPPORT_SPAWN_DISTANCE_TILES,
          });
        }
      }
    }
  }
  if (combat.scriptedBossTriggered || combat.bossDefeated) return;
  if (combat.elapsedGameSeconds < (level.timings?.bossSpawnSeconds ?? Infinity)) return;
  const bossPoint = levelOneWorldV3BossPoint();
  if (Math.hypot(combat.playerMapX - bossPoint.x, combat.playerMapY - bossPoint.y) > 12) return;
  spawnLevelOneSignatureBoss(director);
}

const sbsGroundTileImages = new Map();
function sbsGroundTileImage(asset) {
  if (!asset?.src) return null;
  if (!sbsGroundTileImages.has(asset.src)) sbsGroundTileImages.set(asset.src, loadImageAsset(asset.src));
  return sbsGroundTileImages.get(asset.src);
}

function sceneTemplateContextAt(cellX, cellY) {
  if (!Array.isArray(combat.districtGrid) || !combat.districtGrid.length || !combat.macroCellsX) return null;
  const base = districtTemplateContextForCell(cellX, cellY, combat.districtGrid, combat.macroCellsX, {
    macroCellsY: combat.macroCellsY,
    worldOffsetX: Math.floor(combat.worldWidth / 2),
    worldOffsetY: Math.floor(combat.worldHeight / 2),
  }) ?? null;
  if (!combat.activePoiEncounterId || combat.activePoiEncounterCenterX == null || combat.activePoiEncounterCenterY == null) return base;
  const encounter = buildEncounterTemplateContext({
    poiId: combat.activePoiEncounterId,
    centerCellX: Math.floor(combat.activePoiEncounterCenterX / SCENE_CELL),
    centerCellY: Math.floor(combat.activePoiEncounterCenterY / SCENE_CELL),
    cellX,
    cellY,
  });
  if (!encounter) return base;
  return {
    ...(base ?? {}),
    templatePoolIds: Array.from(new Set([...(base?.templatePoolIds ?? []), ...(encounter.templatePoolIds ?? [])])),
    preferredTemplateIds: Array.from(new Set([...(encounter.preferredTemplateIds ?? []), ...(base?.preferredTemplateIds ?? [])])),
    forceTemplateId: encounter.forceTemplateId ?? base?.forceTemplateId ?? null,
    pathOrientation: encounter.pathOrientation ?? base?.pathOrientation ?? null,
    activeEncounterTemplateId: encounter.encounterTemplateId,
  };
}

function getCombatGroundPlan() {
  const levelId = combat.currentCampaignLevelId ?? HMH_LEVEL_ONE_ID;
  const seed = combat.roguelikeRun?.seed ?? 0;
  if (!combat.groundPlan || combat.groundPlan.levelId !== levelId || combat.groundPlan.seed !== seed) {
    combat.groundPlan = buildGroundPlan({ levelId: combat.currentCampaignLevelId ?? HMH_LEVEL_ONE_ID, seed });
  }
  return combat.groundPlan;
}

// --- Road network ------------------------------------------------------------
// The district generator produces a macro road network (streets between urban
// districts, trails between groves, boardwalk crossings over water).
// ROAD_SURFACE_TEXTURE names the road textures prewarmHmhLevelAssets decodes.
function currentTerrainBiomeAt(seed, worldX, worldY) {
  if ((combat.currentCampaignLevelId ?? HMH_LEVEL_ONE_ID) !== HMH_LEVEL_ONE_ID) {
    return biomeAt(seed, worldX, worldY);
  }
  return classifyLevelOneTraversal({
    groundPlan: getCombatGroundPlan(),
    roadTileIndex: combat.roadTileIndex,
    worldX,
    worldY,
  }).collisionBiome;
}

const ROAD_SURFACE_TEXTURE = Object.freeze({
  town: 'wo103-continuous/asphalt',
  pavement: 'wo103-continuous/asphalt',
  road: 'wo103-continuous/asphalt',
  desert: 'wo103-continuous/dirt',
  sand: 'wo103-continuous/sand',
  forest: 'wo103-continuous/dirt',
  grass: 'wo103-continuous/dirt',
  rocky: 'wo103-continuous/rocky',
  default: 'wo103-continuous/dirt',
});

// --- Level load screen + biome world precompute ---
// "Decide everything at level start": warm the biome layout and decode the
// environment images for the starting region behind a load screen, so the world
// is coherent and pop-in free when gameplay begins. Enemies/power-ups stay
// procedural at runtime — only the static environment is precomputed here.
function drawLevelLoadScreen(ctx, width, height, pct, biomeLabel) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#06142e');
  g.addColorStop(1, '#030711');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#19f7ff';
  ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('GENERATING WORLD', width / 2, height / 2 - 40);
  ctx.fillStyle = 'rgba(214,228,255,0.85)';
  ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(biomeLabel, width / 2, height / 2 - 12);
  // progress bar
  const barW = Math.min(420, width - 80);
  const barX = (width - barW) / 2;
  const barY = height / 2 + 14;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(barX, barY, barW, 12);
  ctx.fillStyle = '#45ff8a';
  ctx.fillRect(barX, barY, Math.round(barW * Math.max(0, Math.min(1, pct))), 12);
  ctx.strokeStyle = 'rgba(25,247,255,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.round(pct * 100)}%`, width / 2, barY + 34);
  ctx.restore();
}

// Warm the images the starting region will need, summarize the biome layout,
// and render a brief load screen. Returns a layout summary for status text.
async function precomputeBiomeWorld(ctx, width, height, worldStructure = {}) {
  const loadStart = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const MIN_LOAD_MS = 250;
  const seed = combat.roguelikeRun?.seed ?? 0;
  const isLevelOne = currentCampaignLevel().id === DEFAULT_CAMPAIGN_LEVEL_ID;
  const envManifest = hmh('HMH_LEVEL_ENVIRONMENT') ?? {};
  const worldProps = envManifest.worldProps ?? [];
  const bgs = envManifest.parallaxBackgrounds ?? [];
  const { districtGrid, roadNetwork } = worldStructure;

  const startBiome = biomeAt(seed, 0, 0);
  const toWarm = new Set();
  const regionBiomes = new Set([startBiome]);
  if (!isLevelOne) {
    for (let rx = -2; rx <= 2; rx += 1) {
      for (let ry = -2; ry <= 2; ry += 1) {
        const b = biomeAt(seed, rx * 22, ry * 22);
        regionBiomes.add(b);
        for (const p of propsForBiome(worldProps, b).slice(0, 6)) toWarm.add(p.src);
        if (bgs.length) toWarm.add(bgs[parallaxIndexForBiome(seed, b, bgs.length)].src);
      }
    }
  }
  // Level 1 ground and opening props are already warmed by
  // prewarmHmhLevelAssets. Do not decode other levels or broad fallback catalogs
  // before READY. Later campaign levels warm only their own required manifest.
  const campaignId = currentCampaignLevel().id;
  const levelManifests = campaignId === 'level-2-litecoin-city'
    ? [HMH_LEVEL_TWO_FINAL_CITY_ASSETS]
    : campaignId === 'level-3-getaway'
      ? [HMH_LEVEL_THREE_FINAL_GETAWAY_ASSETS, HMH_LEVEL_THREE_FINAL_GROUND]
      : [];
  for (const manifest of levelManifests) {
    for (const asset of manifest.assets ?? []) {
      if (asset?.src) toWarm.add(asset.src);
    }
  }
  // Bridge cells are batched canvas paths. Their authored overlays enter through
  // the normal visible-object prewarm, so there is no separate bridge decode.
  const srcs = [...toWarm];
  const total = srcs.length || 1;
  let done = 0;
  const label = `Biomes: ${[...regionBiomes].join(' · ')}`;
  drawLevelLoadScreen(ctx, width, height, 0, label);
  for (const src of srcs) {
    const img = canonicalLandmarkImage(src);
    if (!imageReady(img)) {
      // give the browser a tick to decode
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => { if (!settled) { settled = true; resolve(); } };
        if (img && typeof img.decode === 'function') img.decode().then(finish).catch(finish);
        setTimeout(finish, 120);
      });
    }
    done += 1;
    drawLevelLoadScreen(ctx, width, height, done / total, label);
  }
  // Keep a short readable completion beat without masking real load time.
  drawLevelLoadScreen(ctx, width, height, 1, label);
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadStart;
  const remaining = Math.max(0, MIN_LOAD_MS - elapsed);
  await new Promise((resolve) => setTimeout(resolve, remaining));
  return { 
    startBiome, 
    regionBiomes: [...regionBiomes], 
    warmed: total,
    districts: districtGrid?.length ?? 0,
    roads: roadNetwork?.length ?? 0,
  };
}

// Canonical building/prop set dressing placed at deterministic world-grid
// landmark cells, grouped by BIOME. The run seed fixes the biome layout at
// level start (see biome-model.mjs), so towns cluster with town props, deserts
// with cacti/rocks, etc. Non-colliding background flavor (Justin's art).
const landmarkImageCache = new Map();
function canonicalLandmarkImage(src) {
  if (!landmarkImageCache.has(src)) {
    landmarkImageCache.set(src, loadImageAsset(src));
  }
  return landmarkImageCache.get(src);
}
// Preload only the first-camera world props. The old version decoded every
// scene-template and authored-layout asset at run start; with large curated art
// waves that front-loaded hundreds of images and made the game feel slow before
// the player moved. Runtime caches still lazy-load anything outside the opening
// window when it actually scrolls into view.
function preloadWorldPropImages() {
  const wp = hmh('HMH_LEVEL_ENVIRONMENT')?.worldProps ?? [];
  for (const p of wp.slice(0, 24)) {
    if (p?.src) canonicalLandmarkImage(p.src);
  }
  for (const obj of buildLevelOneWorldV3VisibleObjects({ playerX: 0, playerY: 0, window: 16 }).slice(0, 32)) {
    if (obj?.assetKey) curatedLevelOneImage(obj.assetKey);
  }
}
// --- Persistent collidable world obstacles --------------------------------
// Obstacles are derived from (seed, world cell) so a patch of world ALWAYS has
// the same buildings/trees/objects — they no longer pop in/out as the player
// moves. Computed once per frame and shared by movement, bullets, and drawing so
// collision and rendering always agree.
let _obstacleCacheFrame = -1;
let _obstacleCacheKey = '';
let _obstacleCache = [];

function _buildAuthoredObstaclesForLevel(levelId) {
  const allDistricts = levelId === 'level-3-the-getaway'
    ? Object.keys(LEVEL_3_AUTHORED_LAYOUT_KEYS)
    : levelId === 'level-2-litecoin-city'
      ? Object.keys(LEVEL_2_AUTHORED_LAYOUT_KEYS)
      : Object.keys(LEVEL_1_AUTHORED_LAYOUT_KEYS);
  const result = [];
  for (const districtKey of allDistricts) {
    const objects = getAllAuthoredSceneObjects(districtKey, levelId);
    for (const obj of objects) {
      const styleKey = SCENE_ROLE_TO_STYLE[obj.role] ?? 'smallprop';
      const style = PROP_ROLE_STYLE[styleKey] ?? PROP_ROLE_STYLE.smallprop;
      result.push({
        id: obj.id,
        worldX: obj.gridX,
        worldY: obj.gridY,
        radius: style.radius,
        solid: obj.solid,
        kind: obj.role === 'building' || obj.role === 'wall' || obj.role === 'landmark' ? 'building' : 'doodad',
        biome: null,
        sceneAssetKey: obj.assetKey,
        sceneRole: obj.role,
        drawOrderBias: obj.drawOrderBias ?? obj.zHeight ?? 0,
        zHeight: obj.zHeight ?? 0,
        text: obj.text ?? null,
        foregroundBand: obj.foregroundBand ?? null,
        animationCue: obj.animationCue ?? null,
        interactive: obj.interactive ?? null,
        hp: obj.hp ?? null,
        maxHp: obj.hp ?? null,
        sourceZoneId: obj.interactive?.zoneId ?? null,
      });
    }
  }
  return result;
}
const LEVEL_1_AUTHORED_LAYOUT_KEYS = Object.freeze({
  'desert-approach': true,
  'ghost-town': true,
  'country-road': true,
  'residential-edge': true,
  'inner-city-threshold': true,
});
const LEVEL_2_AUTHORED_LAYOUT_KEYS = Object.freeze({
  'outer-boulevard': true,
  'financial-core': true,
  'luxury-neighborhoods': true,
  'penthouse-rim': true,
});
const LEVEL_3_AUTHORED_LAYOUT_KEYS = Object.freeze({
  'penthouse-launch-pad': true,
  'skybridge-breakpoint': true,
  'mainnet-express': true,
  'finale-extraction': true,
});
let _authoredLevelCache = null;
let _authoredLevelCacheId = null;
function authoredObstaclesNear(playerX, playerY, window) {
  const levelId = combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID;
  if (_authoredLevelCacheId !== levelId) {
    _authoredLevelCache = _buildAuthoredObstaclesForLevel(levelId);
    _authoredLevelCacheId = levelId;
  }
  if (!_authoredLevelCache.length) return [];
  // Return authored objects within the render window of the player
  return _authoredLevelCache.filter((o) =>
    Math.abs(o.worldX - playerX) <= window + 5 && Math.abs(o.worldY - playerY) <= window + 5,
  );
}

// Coherent-world asset path + decode cache (scene-template placement).
const coherentWorldImageCache = new Map();
function coherentWorldImage(assetKey) {
  const src = `./assets/generated/hmh-coherent-world/${assetKey}.png`;
  if (!coherentWorldImageCache.has(src)) coherentWorldImageCache.set(src, loadImageAsset(src));
  return coherentWorldImageCache.get(src);
}
const curatedLevelOneImageCache = new Map();
function curatedLevelOneImage(assetKey) {
  const src = levelOneCuratedAssetSrc(assetKey);
  if (!src) return null;
  if (!curatedLevelOneImageCache.has(src)) curatedLevelOneImageCache.set(src, loadImageAsset(src));
  return curatedLevelOneImageCache.get(src);
}

async function prewarmHmhLevelAssets(level, onProgress = () => {}) {
  if (level?.id !== HMH_LEVEL_ONE_ID) return { decoded: 0, total: 0 };
  const plan = combat.groundPlan ?? getCombatGroundPlan();
  const playerX = combat.playerMapX ?? 0;
  const playerY = combat.playerMapY ?? 0;
  const images = [];
  const curatedFallbackAsset = plan.textureForKey('world-v3-material/packed-dirt');
  const curatedFallbackImage = sbsGroundTileImage(curatedFallbackAsset);
  if (curatedFallbackImage) images.push(curatedFallbackImage);
  for (const asset of plan.runtimeAtlasAssets?.() ?? []) {
    const image = sbsGroundTileImage(asset);
    if (image) images.push(image);
  }
  for (const textureKey of plan.textureKeysNear(playerX, playerY, 22)) {
    const asset = plan.textureForKey(textureKey);
    const image = sbsGroundTileImage(asset);
    if (image) images.push(image);
  }
  for (const textureKey of new Set(Object.values(ROAD_SURFACE_TEXTURE))) {
    const asset = plan.textureForKey(textureKey);
    const image = sbsGroundTileImage(asset);
    if (image) images.push(image);
  }
  const curatedObjects = buildLevelOneWorldV3VisibleObjects({
    playerX,
    playerY,
    window: 26,
  });
  for (const object of curatedObjects) {
    const image = curatedLevelOneImage(object.assetKey);
    if (image) images.push(image);
  }
  const uniqueImages = [...new Set(images)];
  let completed = 0;
  const results = await Promise.all(uniqueImages.map((image) => decodeImageAsset(image).then((ok) => {
    completed += 1;
    onProgress({ done: completed, total: uniqueImages.length });
    return ok;
  })));
  return { decoded: results.filter(Boolean).length, total: uniqueImages.length };
}
function isLevelOneCuratedRuntime() {
  const policy = levelOneCuratedRuntimeArtPolicy();
  return Boolean(
    combat.roguelikeRun
    && policy.sceneObjectsNearAllowed === false
    && (combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) === HMH_LEVEL_ONE_ID,
  );
}
// Scene-template role -> PROP_ROLE_STYLE key (draw size + collision footprint).
const SCENE_ROLE_TO_STYLE = Object.freeze({
  building: 'building', bigprop: 'bigprop', fountain: 'bigprop',
  cabinet: 'bigprop', 'soda-machine': 'bigprop',
  tree: 'tree', rock: 'bigprop', boulder: 'bigprop',
  bench: 'smallprop', table: 'smallprop', crate: 'smallprop',
  lamp: 'tree', sign: 'tree', smallprop: 'smallprop', decor: 'smallprop',
  // Constructive pieces: fences/walls are short solid barriers; water strips +
  // bridges are flat ground-level pieces.
  fence: 'smallprop', wall: 'smallprop', bridge: 'smallprop', 'water-strip': 'smallprop',
  // Authored layout landmark roles
  landmark: 'building', billboard: 'building', hedge: 'bigprop',
  cactus: 'tree', pole: 'smallprop', post: 'smallprop',
  gate: 'smallprop', water: 'smallprop', log: 'smallprop',
  edge: 'smallprop', road: 'smallprop', bush: 'smallprop', barn: 'building', crop: 'smallprop',
  vehicle: 'bigprop', 'canopy-occluder': 'tree', 'ambient-hazard': 'smallprop', container: 'bigprop',
});

function currentObstacleCacheKey() {
  return [
    combat.frame,
    combat.playerMapX,
    combat.playerMapY,
    combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID,
    combat.viewportMode,
    combat.activePoiEncounterId ?? '',
  ].join('|');
}

function currentObstacles() {
  const cacheKey = currentObstacleCacheKey();
  if (_obstacleCacheFrame === combat.frame && _obstacleCacheKey === cacheKey && _obstacleCacheFrame !== -1) {
    return _obstacleCache;
  }
  const seed = combat.roguelikeRun?.seed ?? 0;
  // COHERENT placement (scene-template layer): props grouped into believable
  // scenes (street blocks with curb lamps, arcade interiors with a TV on a
  // table, tree groves, rock fields, parks) instead of a random prop per cell.
  // These carry sceneAssetKey so resolveObstacleProp draws the matching art.
  // Window size adapts to viewport: ±45 tiles in fullscreen (2560x1440 = ~±35 visible)
  // for zero pop-in; ±18 tiles in windowed mode.
  const isFullscreen = combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen';
  const sceneWindow = isFullscreen ? 45 : 18;
  const useCuratedLevelOneRuntime = isLevelOneCuratedRuntime();
  let curatedVisibleObjects = [];
  let scene = [];
  if (isLevelOneCuratedRuntime()) {
    curatedVisibleObjects = buildLevelOneWorldV3VisibleObjects({ playerX: combat.playerMapX, playerY: combat.playerMapY, window: sceneWindow, frame: combat.frame });
  } else {
    scene = sceneObjectsNear(seed, combat.playerMapX, combat.playerMapY, sceneWindow, biomeAt, {
      reserveRadius: 6,
      templateContextForCell: (cellX, cellY) => sceneTemplateContextAt(cellX, cellY),
    });
  }
  const sceneObstacles = scene.map((o) => ({
    id: o.id,
    worldX: o.worldX,
    worldY: o.worldY,
    radius: o.radius,
    solid: o.solid,
    kind: o.role === 'building' ? 'building' : 'doodad',
    biome: null,
    sceneAssetKey: o.assetKey,
    sceneRole: o.role,
    drawOrderBias: o.drawOrderBias ?? 0,
  }));
  const curatedObstacles = curatedVisibleObjects.map((o) => ({
    id: o.id,
    worldX: o.gridX,
    worldY: o.gridY,
    radius: o.role === 'landmark' ? 1.65 : o.solid ? 0.72 : 0,
    solid: o.solid,
    kind: o.role === 'landmark' || o.sceneRole === 'wall' ? 'building' : 'doodad',
    biome: null,
    curatedAssetKey: o.assetKey,
    sceneRole: o.sceneRole ?? o.role,
    drawOrderBias: o.drawOrderBias ?? 0,
    zHeight: o.zHeight ?? 0,
    text: o.text ?? null,
    curated: true,
    sourceZoneId: o.sourceZoneId ?? null,
    authoredPrefabStamp: o.authoredPrefabStamp === true,
    prefabStampId: o.prefabStampId ?? null,
    routeBeat: o.routeBeat ?? null,
    exactAssetKey: o.exactAssetKey ?? o.assetKey,
    footprintTiles: o.footprintTiles ?? null,
    ...(Object.hasOwn(o, 'drawFootprintTiles') ? { drawFootprintTiles: o.drawFootprintTiles } : {}),
    collisionPolygons: o.collisionPolygons ?? null,
    overSlice: o.overSlice ?? null,
    generatedWorldKitArt: o.generatedWorldKitArt === true,
    ambientLife: o.ambientLife ?? null,
  }));
  const encounterSceneObjects = combat.activePoiEncounterVisualPlan
    ? buildEncounterSceneObjects({
        poiId: combat.activePoiEncounterId,
        arenaLayout: combat.activePoiEncounterVisualPlan?.banner,
        centerX: combat.activePoiEncounterCenterX ?? combat.playerMapX,
        centerY: combat.activePoiEncounterCenterY ?? combat.playerMapY,
      }).map((o) => ({
        id: o.id,
        worldX: o.worldX,
        worldY: o.worldY,
        radius: o.radius,
        solid: o.solid,
        kind: o.sceneRole === 'wall' || o.sceneRole === 'building' ? 'building' : 'doodad',
        biome: null,
        sceneAssetKey: o.sceneAssetKey,
        curatedAssetKey: o.curatedAssetKey,
        sceneRole: o.sceneRole,
        drawOrderBias: o.drawOrderBias ?? 0,
        footprintTiles: o.footprintTiles ?? null,
      }))
    : [];
  // AUTHORED WORLD LAYOUT: inject handcrafted landmark placements from
  // authored-world-layout.mjs so the world reads as a designed place with
  // readable landmarks (gas station, saloon, crossroads signpost, oasis,
  // billboard) instead of purely procedural scatter. These objects are placed
  // at fixed world coordinates that define each district's visual identity.
  const authoredObjects = (useCuratedLevelOneRuntime ? [] : authoredObstaclesNear(combat.playerMapX, combat.playerMapY, sceneWindow))
    .map((obstacle) => refreshLevelOneInteractiveObstacleState(obstacle))
    .filter((obstacle) => !obstacle.hidden);
  const boundaryObstacles = (combat.currentCampaignLevelId ?? DEFAULT_CAMPAIGN_LEVEL_ID) === DEFAULT_CAMPAIGN_LEVEL_ID
    ? buildLevelOneBoundaryObstaclesNear({
        world: buildLevelOneRunWorldDimensions({ width: combat.worldWidth, height: combat.worldHeight }),
        playerX: combat.playerMapX,
        playerY: combat.playerMapY,
        window: sceneWindow + 8,
      })
        .map((edge) => ({ ...edge, naturalEdgeType: edge.naturalEdgeType }))
    : [];
  _obstacleCache = [...curatedObstacles, ...sceneObstacles, ...encounterSceneObjects, ...authoredObjects, ...boundaryObstacles];

  _obstacleCacheFrame = combat.frame;
  _obstacleCacheKey = cacheKey;
  return _obstacleCache;
}

// Per-role collision/anchor factors for placed obstacles. Draw size now comes
// from the WO-8 asset footprint manifest so every prop preserves native aspect
// ratio and a single texel-density law instead of bucketed target widths.
const PROP_ROLE_STYLE = Object.freeze({
  building:  { radius: 1.7,  ground: 120 },
  bigprop:   { radius: 1.2,  ground: 86 },
  vehicle:   { radius: 1.0,  ground: 48 },
  tree:      { radius: 0.62, ground: 78 },
  smallprop: { radius: 0.42, ground: 30 },
});

const ASSET_FOOTPRINT_BY_KEY = new Map();
for (const footprint of HMH_ASSET_FOOTPRINTS.assets ?? []) {
  for (const key of [footprint.key, footprint.runtimeKey, footprint.src]) {
    if (key && !ASSET_FOOTPRINT_BY_KEY.has(key)) ASSET_FOOTPRINT_BY_KEY.set(key, footprint);
  }
}

function footprintTilesForAssetKey(key) {
  const entry = ASSET_FOOTPRINT_BY_KEY.get(key);
  return entry?.override?.footprintTiles ?? entry?.footprintTiles ?? null;
}

function resolveDrawMetricsForFootprint(img, footprint, style) {
  const footprintW = Math.max(0.5, Number(footprint?.w ?? img.naturalWidth / ISO_TILE_WIDTH));
  const drawWidth = Math.max(8, Math.round(footprintW * ISO_TILE_WIDTH));
  const drawHeight = Math.max(8, Math.round(drawWidth * (img.naturalHeight / Math.max(1, img.naturalWidth))));
  const radius = Math.max(0.1, footprintW * 0.5 * (style.radius ?? 1));
  return { drawWidth, drawHeight, radius };
}

// World props that are valid as discrete, placeable obstacles. Excludes:
//  - "scenery" (wide parallax-style strips that would block the scene), and
//  - the OLD non-isometric art: the realistic/3D-render `prop/` set and the
//    flat orthographic painted `decor/` walls. Only the clean isometric
//    pixel-art `hmh-demo-wave/*` biome sprites are kept so the world is
//    consistently isometric (per user: discard old 2D/painted assets).
function isIsometricPropSrc(src) {
  return typeof src === 'string' && src.includes('/hmh-demo-wave/');
}
function placeableProps(worldProps) {
  return worldProps.filter((p) => p.role !== 'scenery' && isIsometricPropSrc(p.src));
}

// Resolve the stable prop art + role styling for an obstacle from its biome pool,
// keyed by the obstacle's own propIndex so the SAME obstacle always shows the
// SAME art at the SAME size. "building" obstacles bias toward building/bigprop
// art; "doodad" obstacles toward trees/small props, matched to the biome.
function resolveObstacleProp(obstacle, worldProps) {
  if (obstacle.curatedAssetKey) {
    const img = curatedLevelOneImage(obstacle.curatedAssetKey);
    const styleKey = obstacle.sceneRole === 'road' || obstacle.sceneRole === 'water-strip'
      ? 'bigprop'
      : obstacle.sceneRole === 'wall'
        ? 'bigprop'
        : SCENE_ROLE_TO_STYLE[obstacle.sceneRole] ?? 'smallprop';
    const style = PROP_ROLE_STYLE[styleKey] ?? PROP_ROLE_STYLE.smallprop;
    const footprint = Object.hasOwn(obstacle, 'drawFootprintTiles')
      ? obstacle.drawFootprintTiles
      : obstacle.footprintTiles ?? null;
    return { prop: { role: obstacle.sceneRole, src: obstacle.curatedAssetKey, curated: true }, img, style, footprint };
  }
  // Coherent scene-template object: draw the exact art the template chose
  // (street lamp, arcade cabinet, TV-on-table, tree, fountain, etc.) at the
  // size dictated by its role. This is the coherent-placement path.
  if (obstacle.sceneAssetKey) {
    const img = coherentWorldImage(obstacle.sceneAssetKey);
    const styleKey = SCENE_ROLE_TO_STYLE[obstacle.sceneRole] ?? 'smallprop';
    const style = PROP_ROLE_STYLE[styleKey] ?? PROP_ROLE_STYLE.smallprop;
    return { prop: { role: obstacle.sceneRole, src: obstacle.sceneAssetKey }, img, style };
  }
  const biomePool = placeableProps(propsForBiome(worldProps, obstacle.biome));
  if (!biomePool.length) return null;
  // Bias selection by obstacle kind so settlements read as buildings and
  // wilderness clusters as trees/rocks, while still allowing variety.
  const wantBuilding = obstacle.kind === 'building';
  const preferred = biomePool.filter((p) =>
    wantBuilding ? (p.role === 'building' || p.role === 'bigprop') : (p.role !== 'building'));
  const pool = preferred.length ? preferred : biomePool;
  const prop = pool[obstacle.propIndex % pool.length];
  if (!prop) return null;
  const style = PROP_ROLE_STYLE[prop.role] ?? PROP_ROLE_STYLE.smallprop;
  const footprint = footprintTilesForAssetKey(prop.src);
  return { prop, img: canonicalLandmarkImage(prop.src), style, footprint };
}

// Build depth-sorted render entries for the on-screen obstacles. These are
// pushed into the unified render list so the hero/enemies correctly occlude (or
// are occluded by) buildings and trees by screen Y. We also write the role-based
// collision radius back onto the obstacle so movement/bullets use a footprint
// that matches the art that is actually drawn.
function drawLevelOneInteractiveDebris(ctx, obstacle, projected, width, drawHeight) {
  const debris = obstacle.debrisState;
  if (!debris?.visible || debris.drawMode !== 'procedural-debris') return false;
  const palette = debris.palette?.length ? debris.palette : ['#d9a441', '#6b4f2a', '#2b2118'];
  const seed = debris.seed || ((obstacle.propIndex ?? 1) * 2654435761);
  const count = Math.max(3, debris.fragmentCount ?? 5);
  const baseY = projected.y + Math.max(5, drawHeight * 0.08);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < count; i += 1) {
    const a = ((seed >>> ((i % 4) * 8)) & 255) / 255;
    const b = ((seed >>> (((i + 1) % 4) * 8)) & 255) / 255;
    const offsetX = (a - 0.5) * Math.max(18, width * 0.58);
    const offsetY = (b - 0.5) * Math.max(8, drawHeight * 0.18);
    const size = 3 + ((seed + i * 17) % 5);
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(Math.round(projected.x + offsetX), Math.round(baseY + offsetY), size, Math.max(2, Math.round(size * 0.62)));
    if (i % 3 === 0) {
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#19f7ff';
      ctx.fillRect(Math.round(projected.x + offsetX + size), Math.round(baseY + offsetY - 1), 2, 2);
    }
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(projected.x, baseY + 5, Math.max(10, width * 0.22), Math.max(3, drawHeight * 0.04), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return true;
}

function buildObstacleRenderEntries(ctx) {
  const worldProps = hmh('HMH_LEVEL_ENVIRONMENT')?.worldProps ?? [];
  const entries = [];
  const viewport = { width: ctx.canvas.width, height: ctx.canvas.height };
  for (const o of currentObstacles()) {
    // Resolve and decode ahead of the viewport, then cull against the complete
    // projected sprite rectangle. Anchor-radius culling clipped large buildings
    // and pressure LOD could make static scenery disappear while still on screen.
    const resolved = resolveObstacleProp(o, worldProps);
    if (!resolved || !imageReady(resolved.img)) continue;
    const { img, style, footprint } = resolved;
    const motion = o.ambientLife?.motion ?? null;
    const renderWorldX = o.worldX + (Number(motion?.worldOffsetX) || 0);
    const renderWorldY = o.worldY + (Number(motion?.worldOffsetY) || 0);
    const projected = groundEntityContactPointForProjection(isoToScreen(renderWorldX, renderWorldY));
    const { drawWidth: w, drawHeight: drawH, radius } = resolveDrawMetricsForFootprint(img, footprint, style);
    const rect = propDrawRectForGroundContact({
      projected,
      drawWidth: w,
      drawHeight: drawH,
      tileHeight: ISO_TILE_HEIGHT,
    });
    if (!drawRectIntersectsViewport(rect, viewport, 64)) continue;
    const shadow = propShadowEllipseForGroundContact({
      projected,
      drawWidth: w,
      drawHeight: drawH,
      tileHeight: ISO_TILE_HEIGHT,
    });
    entries.push({
      id: o.id,
      depth: propFrontEdgeDepth({
        projected,
        footprint,
        radius,
        drawOrderBias: o.drawOrderBias ?? 0,
        tileHeight: ISO_TILE_HEIGHT,
      }),
      draw: () => {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (!o.debrisState?.visible) {
              ctx.globalAlpha = shadow.alpha;
              ctx.fillStyle = '#000000';
              ctx.beginPath();
              ctx.ellipse(shadow.x, shadow.y, shadow.radiusX, shadow.radiusY, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            if (o.debrisState?.visible) {
              drawLevelOneInteractiveDebris(ctx, o, projected, w, drawH);
              ctx.restore();
              return;
            }
            ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height);
            if (o.interactiveState?.glow || o.interactiveState?.pulseActive) {
              const pulseSeed = o.propIndex ?? o.worldX ?? 0;
              const pulse = 0.5 + 0.5 * Math.sin((combat.frame + pulseSeed * 7) * 0.12);
              const glowColor = o.interactive?.kind === 'extraction-cue'
                ? '#19f7ff'
                : o.interactive?.kind === 'gate'
                  ? '#ffe84d'
                  : '#ff7b2f';
              ctx.globalAlpha = (o.interactiveState?.glow ? 0.22 : 0.12) + pulse * 0.16;
              const glow = ctx.createRadialGradient(
                Math.round(projected.x),
                Math.round(projected.y + 10),
                0,
                Math.round(projected.x),
                Math.round(projected.y + 10),
                Math.max(22, w * 0.42),
              );
              glow.addColorStop(0, glowColor);
              glow.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(projected.x, projected.y + 10, Math.max(22, w * 0.42), 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
            ctx.restore();
          },
        });

    // Preserve authored collision geometry. Draw-footprint overrides affect only
    // visual scale and must never erase a substantial object's physical base.
    if (!o.footprintTiles && footprint) o.footprintTiles = footprint;
    o.drawWidth = w;
    o.drawHeight = drawH;
    o.radius = radius;
  }
  return entries;
}

function selectHeroFrame() {
  // Top priority during a roguelike run: animated PixelLab roster frame
  // (idle/run/shoot/melee/hurt/death motion).
  const animFrame = lesterAnimatedFrame();
  if (imageReady(animFrame)) return animFrame;
  // During a roguelike run we NEVER fall through to the old canonical/production
  // Lester art (that's what surfaced the wrong design when taking damage before a
  // state's frames had decoded). Instead hold an already-decoded frame from the
  // SAME locked roster (idle), so the hero always stays the one chosen design.
  if (combat.roguelikeRun) {
    const held = lesterAnimatedFrameForState(['idle', 'walk', 'run']);
    if (imageReady(held)) return held;
    // Last resort within the roster: any decoded frame of any of its animations.
    const anyRosterFrame = firstReadyRosterFrame(heroRosterKey(combat.characterId));
    if (imageReady(anyRosterFrame)) return anyRosterFrame;
    return null; // draw nothing this frame rather than the wrong character
  }
  // Prefer canonical hand-made hero art (Lester/Lilly) via the durable pipeline.
  const heroActorId = combat.characterId === 'lilly'
    ? 'lilly'
    : combat.characterId === 'lester' || combat.characterId === 'lester-original'
      ? 'lester'
      : null;
  if (heroActorId && HMH_ACTOR_REGISTRY.has(heroActorId)) {
    const actor = HMH_ACTOR_REGISTRY.get(heroActorId);
    const state = heroStateFromCombat(combat, GROUND_Y);
    // Use tracked movement direction for smooth animation blending when transitioning
    // between states (e.g., moving east then shooting should stay facing east).
    const facing = combat.lastFacing || 'south';
    const frame = actor.frame({ state, direction: facing, clock: combat.frame });
    if (frame?.image && imageReady(frame.image)) return frame.image;
  }
  const hero = combatArt.hero;
  if (combat.playerY < GROUND_Y - 4) return selectAnimationFrame(hero.animations.jump, combat.frame, productionAnimationFps(hero, 'run', 16), false) ?? hero.fallback.jump;
  if (combat.crouching && combat.playerY >= GROUND_Y - 2) return selectAnimationFrame(hero.animations.idle, combat.frame, productionAnimationFps(hero, 'idle', 12)) ?? hero.fallback.idle;
  const meleeFrameAge = combat.frame - combat.lastMeleeFrame;
  if (meleeFrameAge >= 0 && meleeFrameAge < 18) {
    return selectAnimationFrame(hero.animations.knifeStab, meleeFrameAge, productionAnimationFps(hero, 'shoot', 18), false) ?? hero.stills.knife ?? hero.fallback.blade;
  }
  if (combat.shots > 0 && combat.frame % 36 < 10) {
    const shootFrameAge = combat.frame % 18;
    return selectAnimationFrame(hero.animations.shoot, shootFrameAge, productionAnimationFps(hero, 'shoot', 18), false) ?? hero.stills.shoot ?? hero.fallback.shoot;
  }
  if (combat.keys.has('a') || combat.keys.has('d') || combat.keys.has('arrowleft') || combat.keys.has('arrowright')) {
    return selectAnimationFrame(hero.animations.run, combat.frame, productionAnimationFps(hero, 'run', 16)) ?? (combat.frame % 20 < 10 ? hero.fallback.run1 : hero.fallback.run2);
  }
  return selectAnimationFrame(hero.animations.idle, combat.frame, productionAnimationFps(hero, 'idle', 12)) ?? hero.fallback.idle;
}

// --- Animated PixelLab roster (idle/walk/run/attack/death animations) ---------
// Harvested 8-dir characters currently expose animated SOUTH frames; we play
// those as the animation layer for heroes/enemies/bosses (a big upgrade over
// static stills). Each game entity is mapped to a roster key, and its live
// combat state is mapped to the best-matching animation name with fallbacks.
const rosterFrameCache = new Map();
function rosterFrame(src) {
  if (!src) return null;
  if (rosterFrameCache.has(src)) return rosterFrameCache.get(src);
  const region = parseAtlasFrameRef(src);
  if (!region) {
    rosterFrameCache.set(src, loadImageAsset(src));
    return rosterFrameCache.get(src);
  }
  const atlas = loadImageAsset(region.src);
  if (!imageReady(atlas)) return null;
  const frame = document.createElement('canvas');
  frame.width = region.width;
  frame.height = region.height;
  frame.dataset.atlasFrame = src;
  frame.getContext('2d')?.drawImage(
    atlas,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height,
  );
  rosterFrameCache.set(src, frame);
  return rosterFrameCache.get(src);
}

// Pick the roster animation name for an entity's current combat state, with
// graceful fallback (e.g. walk -> idle, attack-tell -> attack -> idle).
function rosterAnimName(roster, desired) {
  const anims = roster?.animations ?? {};
  for (const name of desired) {
    if (anims[name]) return name;
  }
  // last resort: any available animation
  const keys = Object.keys(anims);
  return keys.length ? keys[0] : null;
}

// Map an aim/move vector to a PixelLab facing + horizontal flip. PixelLab
// generates south, south-east, east, north-east, north, north-west, west,
// south-west. The west-side facings are mirror images of the east-side ones, so
// we can render all 8 facings from {south, south-east, east, north-east, north}
// by flipping horizontally for the western half. When a direction's frames
// aren't harvested yet, callers fall back through this list, ultimately to
// south, so the sprite still animates (just not perfectly angled).
function facingFromVector(dx, dy) {
  // Screen-space iso: +x = east/right-down, +y = south/down. Use angle buckets.
  const ang = Math.atan2(dy, dx); // -PI..PI, 0 = east, PI/2 = south
  const deg = (ang * 180) / Math.PI;
  // 8 buckets of 45°, centered. Returns {dir, flip} where flip mirrors east->west.
  if (deg >= -22.5 && deg < 22.5) return { dir: 'east', flip: false };
  if (deg >= 22.5 && deg < 67.5) return { dir: 'south-east', flip: false };
  if (deg >= 67.5 && deg < 112.5) return { dir: 'south', flip: false };
  if (deg >= 112.5 && deg < 157.5) return { dir: 'south-east', flip: true }; // south-west
  if (deg >= 157.5 || deg < -157.5) return { dir: 'east', flip: true };       // west
  if (deg >= -157.5 && deg < -112.5) return { dir: 'north-east', flip: true };// north-west
  if (deg >= -112.5 && deg < -67.5) return { dir: 'north', flip: false };
  return { dir: 'north-east', flip: false }; // north-east
}

// Pick the best available direction's frames for an animation, honoring the
// requested facing with graceful fallback + mirror. Returns {frames, flip}.
function directionalFrames(dirs, facing) {
  if (!dirs) return null;
  const { dir, flip } = facing;
  // Preference order: exact dir, its mirror twin, south-east, south, then any.
  const twin = { east: 'west', west: 'east', 'south-east': 'south-west',
    'south-west': 'south-east', 'north-east': 'north-west', 'north-west': 'north-east' }[dir];
  // When we fall back to the head-on south/north frames (the common case while
  // only `south` is harvested), KEEP the requested horizontal flip so a hero or
  // enemy aiming west still mirrors left instead of always facing front-right.
  // This is what makes left-facing work from a south-only sprite set.
  const tryOrder = [
    [dir, flip],
    twin ? [twin, !flip] : null,
    ['south-east', flip], ['east', flip], ['south', flip], ['north', flip],
  ].filter(Boolean);
  for (const [d, f] of tryOrder) {
    if (dirs[d]?.length) return { frames: dirs[d], flip: f };
  }
  const anyKey = Object.keys(dirs)[0];
  return anyKey ? { frames: dirs[anyKey], flip } : null;
}

// Return the current animation frame image for an entity, or null if no
// animated roster art applies. `phase` lets callers offset per-entity so a
// crowd of enemies isn't perfectly synced. `facing` selects the 8-direction
// sprite; result includes a `flip` flag so the caller mirrors west-facings.
function animatedRosterFrame(roster, desiredNames, { fps = 12, loop = true, phase = 0, facing = null } = {}) {
  if (!roster) return null;
  const name = rosterAnimName(roster, desiredNames);
  if (!name) return null;
  const dirs = roster.animations[name];
  const sel = facing
    ? directionalFrames(dirs, facing)
    : { frames: dirs.south ?? dirs[Object.keys(dirs)[0]], flip: false };
  if (!sel?.frames?.length) return null;
  const src = selectAnimationFrame(sel.frames, combat.frame + phase, fps, loop);
  const img = rosterFrame(src);
  if (!img) return null;
  img._flip = sel.flip; // transient hint read by the draw helpers this frame
  return img;
}

// Hero (Lester) animation state -> roster animation name priority.
function heroAnimState() {
  const plan = levelOnePlayerAnimationPlan({
    frame: combat.frame,
    gameOver: combat.gameOver,
    invulnerableFrames: combat.invulnerableFrames,
    lastInteractFrame: combat.lastInteractFrame,
    lastGrenadeFrame: combat.lastGrenadeFrame,
    lastMeleeFrame: combat.lastMeleeFrame,
    lastShotFrame: combat.lastShotFrame,
    fireFlash: combat.fireFlash,
    moving: combat._heroMoving,
    boundaryClamped: combat.worldBoundaryClamped,
    hazardLabel: currentLevelOneInteractiveHazardPressure().label,
  });
  combat.playerAnimationPlan = plan;
  return plan.animationStates;
}

// Resolve the selected hero's characterId to the richest available animated
// roster key, falling through to art we actually have. New heroes (Lit Commando
// / Lit Valkyrie) prefer their own frames, then their legacy art, then Lester.
// Lock each playable hero to EXACTLY ONE animated roster that has the full
// animation kit. We do NOT fall through to partial rosters: mixing rosters per
// animation state (e.g. idle from one design, shoot from another) is what made
// the hero visibly swap between 3-4 different character designs mid-run.
//
// Asset reality (2026-06-24): starters are Lit Commando and Lit Valkyrie.
// Lester and Lilly are separate unlockable characters; each locks to its own
// roster/reference-driven production path so no selected hero swaps designs.
const HERO_LOCKED_ROSTER = Object.freeze({
  'lit-commando': 'lit-commando',
  'lit-valkyrie': 'lit-valkyrie',
  'lester-original': 'lester',
  lester: 'lester',
  lilly: 'lilly',
});

function heroRosterKey(characterId) {
  const locked = HERO_LOCKED_ROSTER[characterId] ?? 'lester';
  const r = hmh('HMH_ANIMATED_ROSTER')?.[locked];
  if (r && r.animations && Object.keys(r.animations).length) return locked;
  return 'lester'; // ultimate fallback (lester always has the complete kit)
}

function lesterAnimatedFrame() {
  if (!combat.roguelikeRun) return null;
  return lesterAnimatedFrameForState(heroAnimState());
}

// Resolve a roster frame for an explicit list of desired animation states from
// the hero's LOCKED roster (used both for the live state and as the safe hold
// frame so we never fall through to the old Lester art mid-run).
function lesterAnimatedFrameForState(desiredStates) {
  if (!combat.roguelikeRun) return null;
  const key = heroRosterKey(combat.characterId);
  const roster = hmh('HMH_ANIMATED_ROSTER')?.[key];
  const death = combat.gameOver;
  const facing = facingFromVector(combat.aimMapX ?? 0, combat.aimMapY ?? 1);
  return animatedRosterFrame(roster, desiredStates, { fps: 14, loop: !death, facing });
}

// First already-decoded frame from ANY animation of a roster (south/first dir).
// Used as the absolute last-resort hold so the hero never blanks to old art.
function firstReadyRosterFrame(key) {
  const roster = hmh('HMH_ANIMATED_ROSTER')?.[key];
  const anims = roster?.animations ?? {};
  const preferredStates = ['idle', 'walk', 'run', 'shoot'];
  const orderedStates = [
    ...preferredStates,
    ...Object.keys(anims).filter((name) => !preferredStates.includes(name)),
  ];
  for (const state of orderedStates) {
    const dirs = anims[state];
    if (!dirs) continue;
    const frames = dirs.south ?? dirs[Object.keys(dirs)[0]] ?? [];
    for (const src of frames) {
      const img = rosterFrame(src);
      if (imageReady(img)) return img;
    }
  }
  return null;
}

// Decode only the first idle frame for each facing before READY. The renderer
// can hold one of these approved frames while later states load on demand.
async function preloadHeroRoster(characterId) {
  const key = heroRosterKey(characterId);
  const roster = hmh('HMH_ANIMATED_ROSTER')?.[key];
  const anims = roster?.animations ?? {};
  const idleDirections = anims.idle ?? anims.walk ?? anims.run ?? {};
  const sources = [...new Set(Object.values(idleDirections).map((frames) => frames?.[0]).filter(Boolean))];
  const atlasImages = [...new Set(sources.map(assetSrcForFrameRef))].map((src) => loadImageAsset(src));
  await Promise.all(atlasImages.map((image) => decodeImageAsset(image)));
  const frames = sources.map((src) => rosterFrame(src)).filter(Boolean);
  return frames.filter((image) => imageReady(image)).length;
}

function render() {
  renderOfficialRunStatus();
  renderOfficialApp();
  // U11a shell banner. Every wallet change (sign-in, the simulated fallback,
  // accountsChanged, restore, sign-out via setView) re-renders through here.
  renderSimulatedWalletBanner();
  renderArcadeMusicPlayer();
  placeWalletBalanceChip();
  syncCabinetResultsButton();
}

dom.officialConnectButton.addEventListener('click', enterOfficialArcadeFromSplash);
dom.officialGuestEnterButton?.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
  event.preventDefault();
  enterArcadeAsGuest();
});
installPortalDiscovery({ connectWallet: enterOfficialArcadeFromSplash });
wireHmhFreeQuickplay({
  button: dom.officialHmhFreeQuickplayButton,
  status: dom.officialGuestQuickplayStatus,
  selectCabinet: (gameId) => {
    selectedGameId = gameId;
    currentSession = null;
    lastCompletedSession = null;
    lastRunResult = null;
  },
  startFreeMode: () => startOfficialMode('free'),
  getStep: () => officialAppStep,
  onError: (error) => console.error('[HMH quick-start]', error),
});

dom.officialFreeModeButton.addEventListener('click', () => startOfficialMode('free'));
dom.officialRankedModeButton.addEventListener('click', () => startOfficialMode('ranked'));
dom.officialModeBackButton?.addEventListener('click', () => { playSfxCue('menu-click', 0.05); setOfficialView('cabinet-select'); });
dom.officialCharacterBackButton?.addEventListener('click', () => { playSfxCue('menu-click', 0.05); setOfficialView('mode-select'); });
dom.officialLevelBackButton?.addEventListener('click', () => { playSfxCue('menu-click', 0.05); setOfficialView('character-select'); });
dom.officialBeginLevelButton.addEventListener('click', beginOfficialLevel);


dom.combatPauseButton?.addEventListener('click', () => {
  if (stackedHost) { if (combat.paused) stackedHost.resume(); else stackedHost.pause(); return; }
  if (chikunActive) {
    if (combat.paused) chikunHost?.resume();
    else chikunHost?.pause();
  } else toggleCombatPause();
});
dom.combatMenuIconButton?.addEventListener('click', () => {
  if (stackedHost) { if (combat.paused) stackedHost.resume(); else stackedHost.pause(); return; }
  if (chikunActive) {
    if (combat.paused) chikunHost?.resume();
    else chikunHost?.pause();
  } else toggleCombatPause();
});
dom.combatRestartButton?.addEventListener('click', () => {
  if (stackedHost) { destroyStackedSession(); setOfficialView('mode-select'); return; }
  if (chikunActive) void restartChikunSession();
  else restartCombatRun();
});
dom.combatMusicButton?.addEventListener('click', toggleCombatMusic);
dom.combatShakeButton?.addEventListener('click', toggleCombatShakeSetting);
dom.combatGoreButton?.addEventListener('click', toggleCombatGoreSetting);
dom.combatCharacterButton?.addEventListener('click', switchHero);
dom.combatViewportButton?.addEventListener('click', cycleCombatViewport);
dom.combatReturnMenuButton?.addEventListener('click', returnToOfficialGameMenu);
dom.combatExitButton?.addEventListener('click', exitToArcade);
dom.arcadeMusicPreviousButton?.addEventListener('click', () => {
  playSfxCue('menu-click');
  previousArcadeMusicTrack();
});
dom.arcadeMusicPlayButton?.addEventListener('click', () => {
  playSfxCue('menu-click');
  toggleArcadeMusicPlay();
});
dom.arcadeMusicMuteButton?.addEventListener('click', () => {
  playSfxCue('menu-click');
  toggleArcadeMusicMute();
});
dom.arcadeMusicNextButton?.addEventListener('click', () => {
  playSfxCue('menu-click');
  nextArcadeMusicTrack();
});
dom.arcadeMusicShuffleButton?.addEventListener('click', () => {
  playSfxCue('menu-click');
  toggleArcadeMusicShuffle();
});
dom.arcadeMusicExpandButton?.addEventListener('click', () => {
  playSfxCue('menu-click');
  toggleArcadeMusicExpanded();
});
dom.arcadeMusicSeek?.addEventListener('input', (event) => {
  seekArcadeMusic(event.currentTarget.value);
});
dom.arcadeMusicVolume?.addEventListener('input', (event) => {
  setArcadeMusicVolume(Number(event.currentTarget.value) / 100);
});
dom.arcadeMusicAudio?.addEventListener('loadedmetadata', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('durationchange', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('timeupdate', scheduleArcadeMusicRender);
dom.arcadeMusicAudio?.addEventListener('play', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('pause', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('ended', () => {
  nextArcadeMusicTrack({ autoplay: true });
});

document.addEventListener('pointerdown', (event) => {
  activeLevelUpPointerIds.add(String(event.pointerId));
}, true);
const releaseLevelUpPointer = (event) => {
  activeLevelUpPointerIds.delete(String(event.pointerId));
  if (combat.levelUpPaused) refreshLevelUpInteractionState();
};
document.addEventListener('pointerup', releaseLevelUpPointer, true);
document.addEventListener('pointercancel', releaseLevelUpPointer, true);
document.addEventListener('lostpointercapture', releaseLevelUpPointer, true);
window.addEventListener('blur', () => {
  activeLevelUpPointerIds.clear();
  if (combat.levelUpPaused) refreshLevelUpInteractionState();
});

document.addEventListener('keydown', (event) => {
  // Never hijack keys while the user is typing in a form field (username, etc.).
  const target = event.target;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
    return;
  }
  const key = event.key.toLowerCase();
  if (officialAppStep === 'gameplay' && event.altKey && key === 'enter') {
    event.preventDefault();
    if (!event.repeat) cycleCombatViewport();
    return;
  }
  if (combat.levelUpPaused) {
    event.preventDefault();
    if (event.repeat || !levelUpSelectionReady()) return;
    if (key === '1' || key === '2') {
      const choice = combat.levelUpChoices[Number(key) - 1];
      if (choice) selectLevelUpUpgrade(choice.id);
    } else if (key === 'r') {
      rerollLevelUpChoices();
    }
    return;
  }
  if (event.key === 'F10') {
    event.preventDefault();
    tacticalBalanceDebugEnabled = !tacticalBalanceDebugEnabled;
    renderTacticalBalanceDebugOverlay();
    return;
  }
  if (key === 'enter' || key === 'escape') {
    // Only the in-game pause toggle should consume Enter/Escape — and only
    // while actually playing, so menus/forms keep normal behavior.
    if (officialAppStep === 'gameplay' && combat.grenadeAim?.active && key === 'escape') {
      event.preventDefault();
      cancelGrenadeAimInput();
      releaseGrenadeAimInput();
      return;
    }
    if (officialAppStep === 'gameplay' && (combat.active || combat.paused)) {
      event.preventDefault();
      toggleCombatPause();
    }
    return;
  }
  if (combat.paused || combat.gameOver) return;
  if (officialAppStep !== 'gameplay') return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (combat.roguelikeRun) shoot();
    else jump();
  }
  if (key === 'f' || key === 'g') {
    event.preventDefault();
    if (!event.repeat && !combat.grenadeAim?.active) startGrenadeAimInput({ source: 'keyboard' });
  }
  if (key === 'e') {
    event.preventDefault();
    triggerLevelOneInteraction();
  }
  if (key === 'r') reload();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown', 'control'].includes(key)) {
    event.preventDefault();
    combat.keys.add(key);
  }
});

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if ((key === 'f' || key === 'g') && combat.grenadeAim?.active) {
    event.preventDefault();
    releaseGrenadeAimInput();
    return;
  }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown', 'control'].includes(key)) combat.keys.delete(key);
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 2 && combat.grenadeAim?.active) {
    event.preventDefault();
    releaseGrenadeAimInput();
  }
});

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement === dom.officialCombatMount) {
    combat.viewportMode = 'fullscreen';
    // The stat bar lives OUTSIDE the mount, so it vanishes when only the mount
    // is fullscreened. Reparent it into the mount as a floating overlay so the
    // player keeps HP/score/ammo/nades visible in fullscreen.
    if (dom.roguelikeStatBar && !dom.officialCombatMount.contains(dom.roguelikeStatBar)) {
      dom.roguelikeStatBar.dataset.homeAnchor = 'true';
      dom.officialCombatMount.prepend(dom.roguelikeStatBar);
    }
    // Resize canvas to match new fullscreen dimensions.
    scheduleCombatViewportRelayout(120);
  } else if (combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen') {
    combat.viewportMode = 'windowed';
    // Return the stat bar to its normal slot above the gameplay controls.
    if (dom.roguelikeStatBar?.dataset.homeAnchor && dom.officialGameplay) {
      delete dom.roguelikeStatBar.dataset.homeAnchor;
      const controls = document.getElementById('officialGameplayControls');
      if (controls?.parentElement === dom.officialGameplay) {
        dom.officialGameplay.insertBefore(dom.roguelikeStatBar, controls);
      } else {
        dom.officialGameplay.append(dom.roguelikeStatBar);
      }
    }
    scheduleCombatViewportRelayout(120);
  }
  if (combat.levelUpPaused) renderLevelUpActionGrid();
  syncCombatOverlay();
});

// Handle window resize to update canvas dimensions in fullscreen/expanded modes
window.addEventListener('resize', () => {
  if (combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen') {
    scheduleCombatViewportRelayout(120);
  }
});

// Wallet provider events are bound to whichever provider actually connected
// (a wallet announced after load included), once per provider. Events from any
// other installed wallet are ignored once the player picked one. An account
// change drops the SIWE authentication unless the new account has a live
// session of its own.
const boundWalletProviders = new WeakSet();
function bindWalletProviderEvents(provider) {
  if (!provider?.on || boundWalletProviders.has(provider)) return;
  boundWalletProviders.add(provider);
  // While a restored WalletConnect session waits for its provider, no other
  // installed wallet may stand in for it (or sign it out).
  const fromPickedWallet = () => (connectedProvider ? connectedProvider === provider : !walletProviderPending);
  provider.on('chainChanged', (chainId) => {
    if (walletConnector === 'injected-evm' && fromPickedWallet()) {
      connectedChainId = chainId;
      render();
    }
  });
  provider.on('accountsChanged', (accounts = []) => {
    if (!fromPickedWallet()) return;
    const nextWallet = Array.isArray(accounts) ? accounts[0] : null;
    if (nextWallet) {
      const changed = connectedWallet !== nextWallet.toLowerCase();
      connectedWallet = nextWallet.toLowerCase();
      connectedAddress = nextWallet;
      walletConnector = 'injected-evm';
      if (changed) {
        walletAuthChallenge = null; profileSyncPulledFor = null; profileSyncLastPushed = null;
        syncWalletAuthentication();
        refreshWalletBalanceChip();
      }
      connectPlayerAccount(state, connectedWallet, { handle: 'LitVM Pilot' });
      if (changed) pullProfileFromCloud(connectedWallet).catch((error) => console.warn('[Profile] Hosted profile pull failed:', error));
    } else if (walletConnector === 'injected-evm') {
      connectedWallet = null;
      connectedAddress = null;
      connectedChainId = null;
      walletConnector = 'none';
      walletAuthenticated = false;
      walletAuthChallenge = null;
      announceWalletSignedOut();
      refreshWalletBalanceChip();
    }
    render();
  });
}
bindWalletProviderEvents(detectEthereumProvider());

// Silent re-auth (contract §7.6, guide §3.1): a returning player whose
// remembered wallet still answers eth_accounts (never eth_requestAccounts)
// with the same account, and who holds a live session (the hosted v2 token, or
// the preview flag), is signed in without any prompt. A remembered
// WalletConnect session is restored from its token alone; AppKit is not
// created here, so Free Mode opens no relay connection (guide rule 3).
async function restoreWalletSession() {
  if (!hasRememberedWalletConnector()) return; // nothing remembered: the session module never loads
  const session = await loadWalletSession();
  const memory = session.remembered();
  if (!memory) return;
  let provider = null;
  if (memory.kind === 'eip6963') provider = (await waitForAnnouncedWallet(memory.rdns, 500))?.provider ?? null;
  else if (memory.kind === 'legacy') provider = legacyInjectedProvider();
  if (connectedWallet) return; // the player signed in while we waited
  const restored = await session.restore({ provider });
  if (!restored.ok || !restored.authenticated || connectedWallet) return;
  connectedWallet = restored.wallet;
  connectedAddress = restored.address ?? restored.wallet;
  connectedProvider = restored.providerPending ? null : provider;
  walletProviderPending = Boolean(restored.providerPending);
  walletPickKind = memory.kind;
  walletPickRdns = memory.rdns;
  walletConnector = 'injected-evm';
  walletAuthenticated = true;
  if (connectedProvider) {
    bindWalletProviderEvents(connectedProvider);
    await refreshInjectedChainId(connectedProvider);
  }
  connectPlayerAccount(state, connectedWallet, { handle: 'LitVM Pilot' });
  persistArcadeStateSoon();
  render();
  pullProfileFromCloud(connectedWallet).catch((error) => console.warn('[Profile] Hosted profile pull failed:', error));
  refreshWalletBalanceChip();
}
restoreWalletSession().catch((error) => console.warn('[Wallet] Silent sign-in skipped:', error?.message ?? error));

// ----- Responsive device detection + mobile/tablet touch controls -----
const deviceState = { profile: null, touchKeys: new Set() };

function readDeviceSignals() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer: window.matchMedia?.('(pointer: coarse)')?.matches ?? false,
    hasTouch: 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

function applyDeviceProfile() {
  const profile = buildDeviceProfile(readDeviceSignals());
  deviceState.profile = profile;
  const root = document.documentElement;
  root.dataset.device = profile.deviceClass;
  root.dataset.orientation = profile.orientation;
  root.dataset.touch = profile.isTouch ? 'true' : 'false';
  root.style.setProperty('--hud-scale', String(profile.hudScale));
  document.body.classList.toggle('show-touch-controls', profile.showTouchControls && !embeddedCabinetOwnsInput());
  document.body.classList.toggle('suggest-landscape', profile.suggestLandscape);
  applyGameplayAccessibilitySettings();
  ensureTouchControls(profile);
  const levelUpOverlay = document.getElementById('levelUpOverlay');
  if (levelUpOverlay && combat.levelUpPaused) applyLevelUpOverlayLayout(levelUpOverlay);
  if (officialAppStep === 'gameplay') scheduleCombatViewportRelayout(120);
  return profile;
}

let touchControlsBuilt = false;
function setFloatingTouchOrigin(base, clientX, clientY) {
  const size = base.getBoundingClientRect().width || 132;
  const half = size / 2;
  const safeX = Math.max(half + 8, Math.min(window.innerWidth - half - 8, clientX));
  const safeY = Math.max(half + 8, Math.min(window.innerHeight - half - 8, clientY));
  base.style.left = `${Math.round(safeX - half)}px`;
  base.style.right = 'auto';
  base.style.top = `${Math.round(safeY - half)}px`;
  base.style.bottom = 'auto';
}

// True while an embedded cabinet iframe is mounted. That runtime renders its
// own controls, so the portal must not render a second set over the top.
function embeddedCabinetOwnsInput() {
  return Boolean(document.documentElement?.dataset?.embeddedCabinet);
}

function ensureTouchControls(profile) {
  if (!profile.showTouchControls || embeddedCabinetOwnsInput()) {
    document.getElementById('touchControls')?.style.setProperty('display', 'none');
    return;
  }
  let layer = document.getElementById('touchControls');
  if (layer) { layer.style.display = ''; return; }
  layer = el('div', { className: 'touch-controls' });
  layer.id = 'touchControls';
  layer.setAttribute('aria-label', 'On-screen touch controls');

  const layout = buildTouchControlLayout({ leftHanded: gameSettings.touchLeftHanded, opacity: gameSettings.touchControlOpacity, orientation: profile.orientation });

  // --- Floating movement joystick: origin snaps to first thumb touch. ---
  const stickBase = el('div', { className: 'touch-stick-base touch-move-base' });
  const stickNub = el('div', { className: 'touch-stick-nub' });
  stickBase.dataset.touchRole = 'move';
  stickBase.append(stickNub);
  layer.append(stickBase);

  let movePointer = null;
  const updateStick = (clientX, clientY) => {
    const rect = stickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (clientX - cx) / (rect.width / 2);
    let dy = (clientY - cy) / (rect.height / 2);
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > 1) { dx /= mag; dy /= mag; }
    stickNub.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
    for (const k of deviceState.touchKeys) combat.keys.delete(k);
    deviceState.touchKeys = joystickToKeys(dx, dy);
    for (const k of deviceState.touchKeys) combat.keys.add(k);
  };
  const releaseStick = () => {
    movePointer = null;
    stickBase.classList.remove('is-active');
    stickNub.style.transform = 'translate(0,0)';
    for (const k of deviceState.touchKeys) combat.keys.delete(k);
    deviceState.touchKeys = new Set();
  };
  stickBase.addEventListener('pointerdown', (e) => {
    movePointer = e.pointerId;
    stickBase.setPointerCapture(e.pointerId);
    setFloatingTouchOrigin(stickBase, e.clientX, e.clientY);
    stickBase.classList.add('is-active');
    updateStick(e.clientX, e.clientY);
    e.preventDefault();
  });
  stickBase.addEventListener('pointermove', (e) => {
    if (movePointer === e.pointerId) updateStick(e.clientX, e.clientY);
  });
  stickBase.addEventListener('pointerup', releaseStick);
  stickBase.addEventListener('pointercancel', releaseStick);

  // --- Floating aim joystick: origin snaps to first thumb touch. ---
  const aimBase = el('div', { className: 'touch-stick-base touch-aim-base' });
  const aimNub = el('div', { className: 'touch-stick-nub touch-aim-nub' });
  aimBase.dataset.touchRole = 'aim';
  aimBase.append(aimNub);
  layer.append(aimBase);

  let aimPointer = null;
  const updateAim = (clientX, clientY) => {
    const rect = aimBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (clientX - cx) / (rect.width / 2);
    let dy = (clientY - cy) / (rect.height / 2);
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > 1) { dx /= mag; dy /= mag; }
    aimNub.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
    if (mag < 0.2) return;
    const manualAim = joystickToManualAim(dx, dy, {
      tileWidth: ISO_TILE_WIDTH,
      tileHeight: ISO_TILE_HEIGHT,
      previous: combat.manualAim ?? { x: combat.aimMapX, y: combat.aimMapY },
    });
    combat.manualAim = manualAim;
    combat.aimMapX = manualAim.x;
    combat.aimMapY = manualAim.y;
    combat.pointerWorldX = null;
    combat.pointerWorldY = null;
    combat.pointerActive = manualAim.active;
    combat.grenadeTarget = buildManualGrenadeTarget({
      playerX: combat.playerMapX,
      playerY: combat.playerMapY,
      aimX: combat.aimMapX,
      aimY: combat.aimMapY,
      reach: 99,
      maxRange: 7,
      blastRadius: 2,
    });
  };
  const releaseAim = () => {
    aimPointer = null;
    aimBase.classList.remove('is-active');
    aimNub.style.transform = 'translate(0,0)';
    combat.pointerWorldX = null;
    combat.pointerWorldY = null;
    combat.pointerActive = false;
  };
  aimBase.addEventListener('pointerdown', (e) => {
    aimPointer = e.pointerId;
    aimBase.setPointerCapture(e.pointerId);
    setFloatingTouchOrigin(aimBase, e.clientX, e.clientY);
    aimBase.classList.add('is-active');
    updateAim(e.clientX, e.clientY);
    e.preventDefault();
  });
  aimBase.addEventListener('pointermove', (e) => {
    if (aimPointer === e.pointerId) updateAim(e.clientX, e.clientY);
  });
  aimBase.addEventListener('pointerup', releaseAim);
  aimBase.addEventListener('pointercancel', releaseAim);

  // --- Action cluster: dash + grenade. POWER remains a desktop-only sandbox helper. ---
  const cluster = el('div', { className: 'touch-action-cluster' });
  cluster.dataset.side = layout.actionCluster.side;
  const dashBtn = el('button', { className: 'touch-action-button touch-dash', textContent: '⚡ DASH' });
  dashBtn.type = 'button';
  dashBtn.setAttribute('aria-label', 'Dash in the current movement direction.');
  const releaseTouchDash = () => {
    combat.keys.delete('control');
    dashBtn.classList.remove('is-active');
  };
  dashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    combat.keys.add('control');
    dashBtn.classList.add('is-active');
    dashBtn.setPointerCapture(e.pointerId);
  });
  dashBtn.addEventListener('pointerup', releaseTouchDash);
  dashBtn.addEventListener('pointercancel', releaseTouchDash);
  const btn = el('button', { className: 'touch-action-button touch-grenade', textContent: '💣 NADE' });
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Grenade. Tap quick throw. Hold to aim.');
  const cancelZone = el('div', { className: 'touch-grenade-cancel-zone', textContent: 'CANCEL' });
  cancelZone.setAttribute('aria-hidden', 'true');
  let grenadePointer = null;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    grenadePointer = e.pointerId;
    btn.setPointerCapture(e.pointerId);
    btn.classList.add('is-active');
    startGrenadeAimInput({ source: 'touch', pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
    playSfxCue('menu-click', 0.02);
  });
  btn.addEventListener('pointermove', (e) => {
    if (grenadePointer === e.pointerId) updateGrenadeAimInput({ clientX: e.clientX, clientY: e.clientY });
  });
  const releaseTouchGrenade = (e) => {
    if (grenadePointer !== e.pointerId) return;
    grenadePointer = null;
    btn.classList.remove('is-active');
    releaseGrenadeAimInput();
  };
  btn.addEventListener('pointerup', releaseTouchGrenade);
  btn.addEventListener('pointercancel', (e) => {
    if (grenadePointer !== e.pointerId) return;
    btn.classList.remove('is-active');
    cancelGrenadeAimInput();
    releaseTouchGrenade(e);
  });
  cluster.append(dashBtn, cancelZone, btn);
  layer.append(cluster);
  layer.addEventListener('pointerdown', (e) => {
    if (combat.grenadeAim?.active && grenadePointer !== null && e.pointerId !== grenadePointer) {
      e.preventDefault();
      cancelGrenadeAimInput({ secondFingerTap: true });
    }
  });

  // NOTE: the persistent top-right pause/menu button (#combatMenuIconButton)
  // lives in the gameplay view markup and is shown on all viewports, so the
  // touch layer no longer needs its own pause button.

  (dom.officialGameplay ?? document.body).append(layer);
  touchControlsBuilt = true;
}

portalRouteController.attachPopstate();

applyDeviceProfile();
let deviceResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(deviceResizeTimer);
  deviceResizeTimer = setTimeout(applyDeviceProfile, 120);
});
window.visualViewport?.addEventListener('resize', () => {
  clearTimeout(deviceResizeTimer);
  deviceResizeTimer = setTimeout(applyDeviceProfile, 80);
});
window.visualViewport?.addEventListener('scroll', () => {
  const levelUpOverlay = document.getElementById('levelUpOverlay');
  if (levelUpOverlay && combat.levelUpPaused) applyLevelUpOverlayLayout(levelUpOverlay);
});
window.addEventListener('orientationchange', () => {
  scheduleCombatViewportRelayout(120);
  setTimeout(() => {
    applyDeviceProfile();
    scheduleCombatViewportRelayout(220);
  }, 200);
});

// Unlockables (contract §7.9, A7): lazy unlock cache and cosmetic picks (the store hears lesters:* itself); `var` reads null early, not a TDZ error.
var unlockables = null;
var unlockablesReady = import('./src/unlockables-store.mjs').then(({ createUnlockablesStore }) => {
  unlockables = createUnlockablesStore({ hosted: HOSTED_PROFILE_SYNC, storage: ARCADE_STORAGE, indexApi, windowRef: window, getWallet: () => connectedWallet, isAuthenticated: (wallet) => walletSessionAuthenticated(wallet), getCachedSelfProfile: (wallet) => officialProfileRoute.cachedSelfProfile(wallet) });
  unlockables.subscribe(() => { if (officialAppStep === 'character-select') renderOfficialCharacterSelect(); });
  return unlockables;
}).catch((error) => { console.warn('[Unlockables]', error?.message || error); return null; });
function characterUnlockOptions() { return { hosted: HOSTED_PROFILE_SYNC, verifiedRuns: unlockables?.verifiedRuns() ?? null }; }
// arcade-core's option-less profile syncs (connect, recorded runs, the arcade snapshot) use the same hero gates.
setCharacterUnlockOptionsProvider((profile) => (connectedWallet && String(profile?.wallet ?? '').toLowerCase() === String(connectedWallet).toLowerCase() ? characterUnlockOptions() : {}), { hosted: HOSTED_PROFILE_SYNC });
function childCosmetics(gameId) { const cosmetics = unlockables?.cosmeticsFor(gameId); return cosmetics ? { cosmetics } : {}; }
function showUnlockablesPanel(view) {
  void Promise.all([unlockablesReady, import('./src/routes/unlockables-panel.mjs')]).then(([store, { renderUnlockablesPanel }]) => store && renderUnlockablesPanel({ store, view, viewedWallet: profileRouteState.viewedWallet ?? null, connectedWallet, heroEntries: () => buildCharacterSelectEntries(HERO_ROSTER_BASE, (connectedWallet && state.profiles[connectedWallet]) || {}, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, characterUnlockOptions()), documentRef: document, after: dom.officialCabinetGrid, app: dom.officialApp, openAchievements: () => setOfficialView('profile', { wallet: null }) })).catch((error) => console.warn('[Unlockables panel]', error?.message || error));
}

// Ranked results screen (results-share slice, contract §7.3, §7.7): lazy-loaded once per finished Ranked run.
window.addEventListener('lesters:ranked-run', (event) => { void import('./src/ranked-results.mjs').then(({ openRankedResults }) => showRankedResults(openRankedResults({ ...event.detail, documentRef: document, mount: dom.officialGameplay ?? document.body, live: SETTLEMENT_LIVE, hosted: HOSTED_PROFILE_SYNC, onClose: () => rankedResultsClosed() }))).catch((error) => console.error('[Ranked results]', error)); });

// Initial paint honors the URL (deep-link / refresh) instead of always splash.
portalRouteController.applyLocation();
