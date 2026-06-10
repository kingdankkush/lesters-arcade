import { loadHMHGame } from './src/games/hmh/loader.mjs';
import { registerGame, getSharedPlayerProfile, submitGameRun } from './src/game-registry.mjs';
import { HMH_SFX_MANIFEST } from './assets/audio/sfx/sfx-manifest.mjs';
import { buildDeviceProfile, joystickToKeys } from './src/device-model.mjs';
import { CANONICAL_ACTOR_MANIFESTS, CANONICAL_ACTOR_ROLES } from './src/canonical-actors.mjs';
import { buildActorRegistry, heroStateFromCombat, heroDirectionFromCombat, enemyStateFromEntity, resolveActorFrame } from './src/combat-sprite-bridge.mjs';
import { computeDamage, ENEMY_BALANCE, damageTypeColor } from './src/combat-damage.mjs';
import { HMH_BONUS_FUD_GOBLIN } from './assets/generated/hmh-bonus-enemies/fud-goblin/fud-goblin.mjs';
import { HMH_BONUS_GAS_FEE_WISP } from './assets/generated/hmh-bonus-enemies/gas-fee-wisp/gas-fee-wisp.mjs';
import { HMH_BONUS_WHALE_DUMPER } from './assets/generated/hmh-bonus-enemies/whale-dumper/whale-dumper.mjs';
import { biomeAt, parallaxIndexForBiome, propsForBiome } from './src/biome-model.mjs';
import { obstaclesNear, resolvePlayerCollision, obstacleHitAt, resolveWaterCollision } from './src/world-obstacles.mjs';
import { sceneObjectsNear, SCENE_TEMPLATES, groundThemeForCell, SCENE_CELL } from './src/scene-templates.mjs';
import { routeForView, viewForPath, gameSlugFor } from './src/arcade-router.mjs';
import {
  generateDistrictGrid,
  generateRoadNetwork,
} from './src/district-generator.mjs';
import {
  ACHIEVEMENTS,
  HARD_MONEY_HEROES_ASSET_MANIFEST,
  HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST,
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
  LESTER_BLASTER_ISOMETRIC_ROGUELIKE,
  LESTER_BLASTER_LEVEL_PLAN,
  LESTER_BLASTER_MENU_OPTIONS,
  LESTER_BLASTER_PERFORMANCE_TARGETS,
  LESTER_BLASTER_POWER_UPS,
  LESTER_BLASTER_SOUND_DESIGN,
  LESTER_BLASTER_TACTICAL_CAMERA_MODEL,
  LESTER_BLASTER_TACTICAL_COMBAT_V2,
  LESTER_BLASTER_UNLOCKABLES,
  LESTER_BLASTER_WEAPON_SYSTEM,
  advanceTacticalCameraModel,
  buildGameOverSummaryModel,
  buildHardMoneyHeroesAnimationCoverageReport,
  buildLeaderboardModel,
  buildLesterBlasterControlDisplayModel,
  buildCombatHudOverlayModel,
  buildCombatOptionsMenuModel,
  buildTacticalBalanceDebugOverlayModel,
  buildCombatSandboxStatusModel,
  buildFullscreenViewportModel,
  buildLoginMenuModel,
  buildOfficialRunStatusModel,
  buildArcadeMusicPlayerModel,
  buildArcadeMusicQueueForContext,
  buildPlayerArcadeSnapshot,
  buildHardMoneyHeroesStatsModule,
  buildUiQualityGuideModel,
  buildWalletConnectionModel,
  calculateLesterBlasterScore,
  chooseArcadeMusicNextIndex,
  chooseEnemySpawn,
  chooseRoguelikeUpgradeOptions,
  connectPlayerAccount,
  createInitialArcadeState,
  createRoguelikeRunState,
  formatMicroUsdc,
  getCartridgeSelectModel,
  getGame,
  ARCADE_GAMES,
  getLesterBlasterDifficultyAt,
  getRoguelikeSpawnDirectorAt,
  grantRoguelikeXp,
  applyRoguelikeSkillUpgrade,
  recordScore,
  applySettlement,
  setArcadeUsername,
  getAllCadenceLeaderboards,
  getLeaderboard,
  resolveDisplayName,
  validateUsername,
  scheduleBossEncounter,
  simulateLesterBlasterRun,
  startPlaySession,
  formatUrlSessionId,
  nextGlobalSessionId,
} from './src/arcade-core.mjs';
import { buildSettlementPlan, settleRun, SETTLEMENT_LIVE, estimateSettlementGas } from './src/settlement.mjs';
import { recordCadenceScore } from './src/leaderboard-engine.mjs';
import { applySeedLeaderboard, formatSurvive } from './src/leaderboard-seed.mjs';

const MOCK_WALLET = '0x1e57e21e57e21e57e21e57e21e57e21e57e21e57';
const PLAYER_X = LESTER_BLASTER_TACTICAL_CAMERA_MODEL.playerStartScreenX;
const GROUND_Y = 276;
const FIXED_STEP_MS = 1000 / LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps;
const NORMAL_HIT_DAMAGE = LESTER_BLASTER_TACTICAL_COMBAT_V2.health.damagePerNormalHitPercent;
const PLAYER_MAX_HEALTH = LESTER_BLASTER_TACTICAL_COMBAT_V2.health.playerMaxPercent;
const STAGE_COUNT = 13;
const NORMAL_STAGE_CAP = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.normalEnemiesOnScreenRange[1];
const MINI_BOSS_STAGE_CAP = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.miniBossEnemiesOnScreenRange[1];
const DEFAULT_VIEWPORT_MODE = LESTER_BLASTER_TACTICAL_COMBAT_V2.viewportModes.default;
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
  return Boolean(image?.complete && image.naturalWidth > 0);
}

// --- Durable sprite pipeline: registry of ALL actors ---
// Canonical hand-made art (Justin's): heroes Lester/Lilly + enemies/bosses
// (trench-degen, evil-banker, crypto-bro, gas-beast, evil-boss, warren-boss).
// Bonus PixelLab-generated enemies are kept as ADDITIONAL roster members.
const HMH_ACTOR_REGISTRY = buildActorRegistry({
  ...CANONICAL_ACTOR_MANIFESTS,
  'bonus-fud-goblin': HMH_BONUS_FUD_GOBLIN,
  'bonus-gas-fee-wisp': HMH_BONUS_GAS_FEE_WISP,
  'bonus-whale-dumper': HMH_BONUS_WHALE_DUMPER,
}, loadImageAsset);

// Map a runtime enemy/boss entity to its registry actor id. Canonical art first.
function registryActorIdFor(entity) {
  const id = `${entity?.id ?? ''} ${entity?.title ?? ''}`.toLowerCase();
  if (id.includes('trench') || id.includes('degen')) return 'trench-degen';
  if (id.includes('bank')) return 'evil-banker';
  if (id.includes('crypto') || id.includes('bro') || id.includes('kol')) return 'crypto-bro';
  if (id.includes('gas') && id.includes('beast')) return 'gas-beast';
  if (id.includes('warren') || id.includes('spear')) return 'warren-boss';
  if (id.includes('evil') && id.includes('boss')) return 'evil-boss';
  // Bonus PixelLab enemies (additional roster).
  if (id.includes('fud') || id.includes('goblin')) return 'bonus-fud-goblin';
  if (id.includes('wisp') || (id.includes('gas') && id.includes('fee'))) return 'bonus-gas-fee-wisp';
  if (id.includes('whale') || id.includes('dumper')) return 'bonus-whale-dumper';
  return null;
}

// Pick a health-tier state name if the actor has tiered art for the entity's hp%.
function healthTierState(actor, entity) {
  if (entity.hp === undefined || entity.maxHp === undefined || !entity.maxHp) return null;
  const pct = (entity.hp / entity.maxHp) * 100;
  for (const [tier, threshold] of [['health-25', 25], ['health-50', 50], ['health-75', 75]]) {
    if (pct <= threshold && actor.hasState(tier)) return tier;
  }
  return null;
}

// Resolve a generated/canonical-art frame image for an entity, or null for legacy art.
function pipelineActorFrame(entity, { boss = false } = {}) {
  const actorId = registryActorIdFor(entity);
  if (!actorId || !HMH_ACTOR_REGISTRY.has(actorId)) return null;
  const actor = HMH_ACTOR_REGISTRY.get(actorId);
  const dying = entity.dying || (entity.hp !== undefined && entity.hp <= 0);
  let state = enemyStateFromEntity({
    dying,
    hitFrames: entity.hitFrames ?? ((entity.flashTimer ?? 0) > 0 ? 1 : 0),
    attacking: (entity.attackTimer ?? 99) < 18,
    telegraphing: (entity.attackTimer ?? 99) >= 18 && (entity.attackTimer ?? 99) < 34,
    moving: true,
  });
  // When idle and damaged, prefer the hand-drawn health-tier still if present.
  if (!dying && (state === 'idle' || state === 'walk')) {
    const tier = healthTierState(actor, entity);
    if (tier) state = tier;
  }
  const frame = actor.frame({ state, direction: 'south', clock: combat.frame + Math.floor(entity.x ?? 0) });
  return frame?.image ?? null;
}

function loadAnimationFrames(pattern, count) {
  return Array.from({ length: count }, (_, index) => loadImageAsset(pattern.replace('{index}', String(index).padStart(2, '0'))));
}

function loadManifestFrames(animation) {
  return (animation?.frames ?? []).map((frame) => loadImageAsset(frame.src));
}

function buildEnvironmentStageArt(stage) {
  return {
    ...stage,
    layers: stage.layers.map((layer) => ({
      ...layer,
      image: loadImageAsset(layer.src),
    })),
    props: stage.props.map((prop) => ({
      ...prop,
      image: loadImageAsset(prop.src),
    })),
  };
}

function selectAnimationFrame(frames, frame, fps = 10, loop = true) {
  if (!frames?.length) return null;
  const ticksPerFrame = Math.max(1, Math.round(LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps / fps));
  const rawIndex = Math.floor(frame / ticksPerFrame);
  const index = loop ? rawIndex % frames.length : Math.min(frames.length - 1, rawIndex);
  return frames[index];
}

function loadManifestImage(src, fallbackSrc = null) {
  return loadImageAsset(src ?? fallbackSrc ?? null);
}

function buildCharacterArtFromManifest(characterId) {
  const character = HARD_MONEY_HEROES_ASSET_MANIFEST.playableCharacters[characterId] ?? HARD_MONEY_HEROES_ASSET_MANIFEST.playableCharacters.lester;
  const weaponAssets = character.weapons ?? {};
  return {
    animations: {
      idle: loadManifestFrames(character.animations?.idle),
      walk: loadManifestFrames(character.animations?.walk),
      run: loadManifestFrames(character.animations?.run),
      jump: loadManifestFrames(character.animations?.jump),
      attack: loadManifestFrames(character.animations?.attack),
      knifeStab: loadManifestFrames(weaponAssets.knife?.stabAnimation),
    },
    stills: {
      machineGun: loadManifestImage(weaponAssets.machineGun?.selectedFrom, character.stills?.rightSide),
      knife: loadManifestImage(weaponAssets.knife?.selectedFrom, character.stills?.knife),
      grenade: loadManifestImage(weaponAssets.grenade?.selectedFrom, character.stills?.grenade),
      pistol: loadManifestImage(weaponAssets.pistol?.selectedFrom, character.stills?.rightSide),
      shotgun: loadManifestImage(weaponAssets.shotgun?.selectedFrom, character.stills?.rightSide),
      shoot: loadManifestImage(weaponAssets.machineGun?.selectedFrom, character.stills?.rightSide),
      facing: loadManifestImage(character.stills?.facing),
      leftSide: loadManifestImage(character.stills?.leftSide),
      rightSide: loadManifestImage(character.stills?.rightSide),
    },
    fallback: {
      idle: loadImageAsset('./assets/generated/sliced/lester-idle.png'),
      run1: loadImageAsset('./assets/generated/sliced/lester-run-1.png'),
      run2: loadImageAsset('./assets/generated/sliced/lester-run-2.png'),
      shoot: loadImageAsset('./assets/generated/sliced/lester-shoot.png'),
      blade: loadImageAsset('./assets/generated/sliced/lester-blade.png'),
      jump: loadImageAsset('./assets/generated/sliced/lester-jump.png'),
    },
  };
}

function loadPixelLabCalibrationFrames(animation) {
  return (animation?.frames ?? []).map((src) => loadImageAsset(src));
}

function buildPixelLabLesterCalibrationArt() {
  const manifest = hmh('HMH_PIXELLAB_LESTER_CALIBRATION_MANIFEST');
  // Handle case where manifest isn't loaded yet (lazy load hasn't happened)
  if (!manifest?.animations) {
    return {
      animations: {},
      stills: {},
      fallback: null,
      manifest: null,
    };
  }
  const idleFrames = loadPixelLabCalibrationFrames(manifest.animations.idle);
  const runFrames = loadPixelLabCalibrationFrames(manifest.animations.run);
  const shootFrames = loadPixelLabCalibrationFrames(manifest.animations.shoot);
  const eastStill = loadImageAsset(manifest.rotations.east);
  const westStill = loadImageAsset(manifest.rotations.west);
  const facingStill = loadImageAsset(manifest.rotations.south);

  return {
    manifest,
    animations: {
      idle: idleFrames,
      walk: runFrames,
      run: runFrames,
      jump: [],
      attack: shootFrames,
      shoot: shootFrames,
      knifeStab: [],
    },
    stills: {
      machineGun: eastStill,
      knife: eastStill,
      grenade: eastStill,
      pistol: eastStill,
      shotgun: eastStill,
      shoot: shootFrames[0] ?? eastStill,
      facing: facingStill,
      leftSide: westStill,
      rightSide: eastStill,
    },
    fallback: {
      idle: idleFrames[0] ?? eastStill,
      run1: runFrames[0] ?? eastStill,
      run2: runFrames[1] ?? eastStill,
      shoot: shootFrames[0] ?? eastStill,
      blade: eastStill,
      jump: eastStill,
    },
  };
}

function buildEnemyArtFromManifest(enemyKey) {
  const enemy = HARD_MONEY_HEROES_ASSET_MANIFEST.enemies[enemyKey];
  return {
    animations: {
      idle: loadManifestFrames(enemy?.art?.animations?.idle),
      walk: loadManifestFrames(enemy?.art?.animations?.walk),
      run: loadManifestFrames(enemy?.art?.animations?.run),
      jump: loadManifestFrames(enemy?.art?.animations?.jump),
      attack: loadManifestFrames(enemy?.art?.animations?.attack),
    },
    stills: (enemy?.art?.stills ?? []).map((still) => loadImageAsset(still.src)),
    fallback: loadImageAsset('./assets/generated/sliced/enemy-goblin-idle.png'),
  };
}

function loadProductionAnimation(animation) {
  return (animation?.frames ?? []).map((frame) => loadImageAsset(frame.src));
}

function buildProductionCharacterArt(characterKey, fallbackArt) {
  const character = hmh('HMH_PRODUCTION_ART_PASS')?.characters?.[characterKey];
  if (!character) return fallbackArt;
  const animations = {
    idle: loadProductionAnimation(character.animations?.idle),
    walk: loadProductionAnimation(character.animations?.run),
    run: loadProductionAnimation(character.animations?.run),
    jump: loadProductionAnimation(character.animations?.run),
    attack: loadProductionAnimation(character.animations?.shoot),
    shoot: loadProductionAnimation(character.animations?.shoot),
    knifeStab: loadProductionAnimation(character.animations?.shoot),
    hit: loadProductionAnimation(character.animations?.hit),
    death: loadProductionAnimation(character.animations?.death),
  };
  const stills = Object.fromEntries(Object.entries(character.stills ?? {}).map(([direction, src]) => [direction, loadImageAsset(src)]));
  const eastStill = stills.east ?? stills['south-east'] ?? Object.values(stills)[0] ?? animations.idle[0] ?? null;
  const westStill = stills.west ?? stills['south-west'] ?? eastStill;
  const facingStill = stills.south ?? eastStill;
  const animationMeta = Object.fromEntries(Object.entries(character.animations ?? {}).map(([name, meta]) => [name, {
    fps: meta.fps,
    frameCount: meta.frameCount,
    loop: meta.loop !== false,
  }]));
  return {
    ...fallbackArt,
    productionSlug: character.slug,
    sourceJobKey: character.sourceJobKey,
    animationMeta,
    animations: {
      ...fallbackArt.animations,
      ...Object.fromEntries(Object.entries(animations).filter(([, frames]) => frames.length)),
    },
    stills: Array.isArray(fallbackArt.stills)
      ? [eastStill, westStill, facingStill].filter(Boolean)
      : {
          ...fallbackArt.stills,
          machineGun: eastStill,
          knife: eastStill,
          grenade: eastStill,
          pistol: eastStill,
          shotgun: eastStill,
          shoot: animations.shoot[0] ?? eastStill,
          facing: facingStill,
          leftSide: westStill,
          rightSide: eastStill,
        },
    fallback: fallbackArt.fallback && typeof fallbackArt.fallback === 'object' && !('src' in fallbackArt.fallback)
      ? {
          ...fallbackArt.fallback,
          idle: animations.idle[0] ?? eastStill ?? fallbackArt.fallback.idle,
          run1: animations.run[0] ?? eastStill ?? fallbackArt.fallback.run1,
          run2: animations.run[1] ?? animations.run[0] ?? eastStill ?? fallbackArt.fallback.run2,
          shoot: animations.shoot[0] ?? eastStill ?? fallbackArt.fallback.shoot,
          blade: animations.shoot[0] ?? eastStill ?? fallbackArt.fallback.blade,
          jump: animations.run[0] ?? eastStill ?? fallbackArt.fallback.jump,
        }
      : (animations.idle[0] ?? eastStill ?? fallbackArt.fallback),
  };
}

function buildProductionSpriteIndex(items = []) {
  return Object.fromEntries(items.map((item) => [item.slug, {
    ...item,
    image: item.src ? loadImageAsset(item.src) : null,
    frames: (item.frames ?? []).map((frame) => ({ ...frame, image: loadImageAsset(frame.src) })),
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
    vfx: buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.vfx),
    ui: buildProductionSpriteIndex(hmh('HMH_PRODUCTION_ART_PASS')?.ui),
    levels: hmh('HMH_PRODUCTION_ART_PASS')?.levels ?? [],
    cabinet: hmh('HMH_PRODUCTION_ART_PASS')?.cabinet,
    animationPass: hmh('HMH_PRODUCTION_ART_PASS')?.animationPass,
  };
}

function productionAssetSrc(collection, slug) {
  const list = hmh('HMH_PRODUCTION_ART_PASS')?.[collection] ?? [];
  return list.find((item) => item.slug === slug)?.src ?? '';
}

function productionImage(collection, slug) {
  return combatArt.production?.[collection]?.[slug]?.image ?? null;
}

function productionSpriteFrame(sprite, frame = combat.frame, fpsFallback = 8) {
  const frames = sprite?.frames ?? [];
  if (!frames.length) return sprite?.image ?? null;
  const frameDuration = Number(sprite.frameDurationMs ?? frames[0]?.durationMs ?? 1000 / fpsFallback);
  const fps = Number(sprite.fps ?? (frameDuration > 0 ? 1000 / frameDuration : fpsFallback));
  const ticksPerFrame = Math.max(1, Math.round(LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps / Math.max(1, fps)));
  return frames[Math.floor(frame / ticksPerFrame) % frames.length]?.image ?? sprite.image ?? null;
}

function productionVfxFrame(slug, frame = combat.frame) {
  const vfx = combatArt.production?.vfx?.[slug];
  if (!vfx?.frames?.length) return null;
  const fps = vfx.fps ?? 18;
  const ticksPerFrame = Math.max(1, Math.round(LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps / fps));
  return vfx.frames[Math.floor(frame / ticksPerFrame) % vfx.frames.length]?.image ?? null;
}

function productionAnimationFps(art, name, fallback = 12) {
  return art?.animationMeta?.[name]?.fps ?? fallback;
}

function productionCabinetSprite() {
  return hmh('HMH_PRODUCTION_ART_PASS')?.cabinet?.frames?.length ? hmh('HMH_PRODUCTION_ART_PASS')?.cabinet : null;
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
    return payload;
  });
  return HMH_LOAD_PROMISE;
}
function hmh(name) { return HMH_PAYLOAD ? HMH_PAYLOAD[name] : undefined; }

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

const arcadeMusic = {
  context: 'arcade',
  queue: buildArcadeMusicQueueForContext('arcade'),
  currentTrackIndex: 0,
  unlocked: false,
  playing: false,
  muted: false,
  expanded: false,
  shuffle: false,
  renderQueued: false,
};

const combatAudio = {
  sfxEnabled: true,
  audioContext: null,
  lastSfxAt: new Map(),
  sfxBuffers: new Map(),
  sfxLoading: new Map(),
  sfxLoadAttempted: false,
};

// Player-facing game settings (persisted to localStorage so they survive
// reloads). Wired into the functional Settings screen.
const gameSettings = {
  screenShake: true,
  gore: true,
};
(function loadGameSettings() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('hmh-settings') : null;
    if (raw) Object.assign(gameSettings, JSON.parse(raw));
    if (typeof combatAudio !== 'undefined') {} // no-op guard
  } catch { /* ignore corrupt prefs */ }
})();
function saveGameSettings() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('hmh-settings', JSON.stringify(gameSettings)); } catch { /* ignore */ }
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
  if (dom.arcadeMusicPlayButton) {
    dom.arcadeMusicPlayButton.textContent = model.playing ? '⏸' : '▶';
    dom.arcadeMusicPlayButton.setAttribute('aria-label', model.playing ? 'Pause arcade music' : 'Play arcade music');
  }
  if (dom.arcadeMusicMuteButton) {
    dom.arcadeMusicMuteButton.textContent = model.muted ? '🔇' : '🔊';
    dom.arcadeMusicMuteButton.setAttribute('aria-label', model.muted ? 'Unmute arcade music' : 'Mute arcade music');
  }
  if (dom.arcadeMusicShuffleButton) {
    dom.arcadeMusicShuffleButton.textContent = model.shuffle ? '🔀' : '⇄';
    dom.arcadeMusicShuffleButton.classList.toggle('active', model.shuffle);
    dom.arcadeMusicShuffleButton.setAttribute('aria-pressed', String(model.shuffle));
    dom.arcadeMusicShuffleButton.setAttribute('aria-label', model.shuffle ? 'Turn shuffle off' : 'Turn shuffle on');
  }
  if (dom.arcadeMusicExpandButton) {
    dom.arcadeMusicExpandButton.textContent = model.expanded ? '▴' : '▾';
    dom.arcadeMusicExpandButton.setAttribute('aria-label', model.expanded ? 'Collapse arcade music player' : 'Expand arcade music player');
  }
  if (dom.arcadeMusicQueueList) {
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

async function ensureArcadeMusicPlayer(reason = 'menu', autoplay = false) {
  const audio = loadArcadeMusicTrack();
  if (!audio) {
    renderArcadeMusicPlayer();
    return false;
  }
  audio.volume = reason === 'game-over' ? 0.18 : reason === 'gameplay' ? 0.38 : 0.26;
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
  setArcadeMusicContext(gameId, { reset: true });
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

function toggleArcadeMusicMute() {
  arcadeMusic.muted = !arcadeMusic.muted;
  combat.musicEnabled = !arcadeMusic.muted;
  const audio = arcadeMusicAudio();
  if (audio) audio.muted = arcadeMusic.muted;
  renderArcadeMusicPlayer();
  syncCombatOverlay();
  return !arcadeMusic.muted;
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
  const tones = {
    'wallet-connect': [523, 659, 784],
    'menu-click': [392, 523],
    'hero-select': [523, 659, 784, 1047],
    'level-start': [330, 494, 660],
    jump: [420, 630],
    land: [120],
    'weapon-fire': [180, 900],
    melee: [760, 420],
    grenade: [110, 220],
    pickup: [660, 880, 990],
    'enemy-hit': [220, 165],
    'player-hit': [90, 70],
    'boss-warning': [70, 140, 70],
    'game-over': [196, 146, 98],
  };
  return tones[cue] ?? [440];
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

function playSfxSample(cue, volume) {
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
  source.start();
  return true;
}

function playSfxSynth(cue, volume) {
  const ctx = combatAudio.audioContext;
  if (!ctx) return false;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  gain.connect(ctx.destination);
  sfxToneFor(cue).forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = cue.includes('hit') || cue === 'grenade' ? 'square' : 'triangle';
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    const start = ctx.currentTime + index * 0.045;
    oscillator.start(start);
    oscillator.stop(start + 0.075);
  });
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  return true;
}

function playSfxCue(cue, volume = 0.05) {
  if (!combatAudio.sfxEnabled || typeof window === 'undefined') return false;
  const now = performance.now();
  if ((now - (combatAudio.lastSfxAt.get(cue) ?? 0)) < 55) return false;
  combatAudio.lastSfxAt.set(cue, now);
  const ctx = ensureAudioContext();
  if (!ctx) return false;
  // Kick off lazy sample loading on first real user-gesture-driven cue.
  preloadSfxSamples();
  // Prefer the real CC0 sample; fall back to the synth tone until it decodes
  // (or permanently, if the sample failed to load).
  if (playSfxSample(cue, volume)) return true;
  loadSfxSample(cue);
  return playSfxSynth(cue, volume);
}

const combatArt = {
  production: buildProductionArtPass(),
  characters: {
    lester: buildProductionCharacterArt('lester', buildCharacterArtFromManifest('lester')),
    lesterPixelLabCalibration: buildPixelLabLesterCalibrationArt(),
    lilly: buildProductionCharacterArt('lilly', buildCharacterArtFromManifest('lilly')),
  },
  hero: null,
  enemies: {
    trenchDegen: buildProductionCharacterArt('trenchDegen', buildEnemyArtFromManifest('trenchDegen')),
    evilBanker: buildProductionCharacterArt('evilBanker', buildEnemyArtFromManifest('evilBanker')),
    warrenSpearRider: buildProductionCharacterArt('warrenSpearRider', buildEnemyArtFromManifest('warrenSpearRider')),
    cryptoBro: buildProductionCharacterArt('cryptoBro', buildEnemyArtFromManifest('cryptoBro')),
    gasBeast: buildProductionCharacterArt('gasBeast', buildEnemyArtFromManifest('gasBeast')),
    rugpullSummoner: buildProductionCharacterArt('rugpullSummoner', buildEnemyArtFromManifest('trenchDegen')),
    bitWhale: buildProductionCharacterArt('bitWhale', buildEnemyArtFromManifest('warrenSpearRider')),
    chainReaper: buildProductionCharacterArt('chainReaper', buildEnemyArtFromManifest('warrenSpearRider')),
    goblin: loadImageAsset('./assets/generated/sliced/enemy-goblin-idle.png'),
    wisp: loadImageAsset('./assets/generated/sliced/enemy-wisp-idle.png'),
    bruiser: loadImageAsset('./assets/generated/sliced/enemy-bruiser-idle.png'),
    scambot: loadImageAsset('./assets/generated/sliced/enemy-scambot-idle.png'),
  },
  screens: {
    splash: loadImageAsset(HARD_MONEY_HEROES_ASSET_MANIFEST.screens.splash.src),
    mainMenu: loadImageAsset(HARD_MONEY_HEROES_ASSET_MANIFEST.screens.mainMenu.src),
    options: loadImageAsset(HARD_MONEY_HEROES_ASSET_MANIFEST.screens.options.src),
    modeSelect: loadImageAsset(HARD_MONEY_HEROES_ASSET_MANIFEST.screens.modeSelect.src),
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
  environmentStages: Object.fromEntries(HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST.levelOneStages.map((stage) => [
    stage.id,
    buildEnvironmentStageArt(stage),
  ])),
};
combatArt.hero = combatArt.characters.lester;

const dom = {
  officialApp: document.querySelector('#officialApp'),
  arcadeMusicPlayer: document.querySelector('#arcadeMusicPlayer'),
  arcadeMusicAudio: document.querySelector('#arcadeMusicAudio'),
  arcadeMusicTitle: document.querySelector('#arcadeMusicTitle'),
  arcadeMusicTime: document.querySelector('#arcadeMusicTime'),
  arcadeMusicDuration: document.querySelector('#arcadeMusicDuration'),
  arcadeMusicProgressFill: document.querySelector('#arcadeMusicProgressFill'),
  arcadeMusicPreviousButton: document.querySelector('#arcadeMusicPreviousButton'),
  arcadeMusicPlayButton: document.querySelector('#arcadeMusicPlayButton'),
  arcadeMusicMuteButton: document.querySelector('#arcadeMusicMuteButton'),
  arcadeMusicNextButton: document.querySelector('#arcadeMusicNextButton'),
  arcadeMusicShuffleButton: document.querySelector('#arcadeMusicShuffleButton'),
  arcadeMusicExpandButton: document.querySelector('#arcadeMusicExpandButton'),
  arcadeMusicQueueList: document.querySelector('#arcadeMusicQueueList'),
  officialNavTabs: document.querySelector('#officialNavTabs'),
  developerBackstageToggle: document.querySelector('#developerBackstageToggle'),
  developerBackstage: document.querySelector('#developerBackstage'),
  officialWalletSplash: document.querySelector('#officialWalletSplash'),
  splashFeaturedCabinet: document.querySelector('#splashFeaturedCabinet'),
  officialConnectButton: document.querySelector('#officialConnectButton'),
  officialWalletCopy: document.querySelector('#officialWalletCopy'),
  officialArcadeFloor: document.querySelector('#officialArcadeFloor'),
  officialProfileTitle: document.querySelector('#officialProfileTitle'),
  officialProfileCopy: document.querySelector('#officialProfileCopy'),
  officialCabinetGrid: document.querySelector('#officialCabinetGrid'),
  officialModeSelect: document.querySelector('#officialModeSelect'),
  officialFreeModeButton: document.querySelector('#officialFreeModeButton'),
  officialRankedModeButton: document.querySelector('#officialRankedModeButton'),
  officialModeBackButton: document.querySelector('#officialModeBackButton'),
  rankedEntryModal: document.querySelector('#rankedEntryModal'),
  rankedEntryWallet: document.querySelector('#rankedEntryWallet'),
  rankedEntryNetwork: document.querySelector('#rankedEntryNetwork'),
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
  combatGameOverSummary: document.querySelector('#combatGameOverSummary'),
  combatHudOverlay: document.querySelector('#combatHudOverlay'),
  roguelikeStatBar: document.querySelector('#roguelikeStatBar'),
  tacticalBalanceDebugOverlay: document.querySelector('#tacticalBalanceDebugOverlay'),
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
// Seed the global leaderboard with a believable Top-50 of AI players so the
// leaderboard UI (podium, rows, sort/filter/search, ranked highlights) can be
// evaluated with real-looking data. These are local-only synthetic seeds — they
// never settle on-chain. Idempotent guard so it only seeds once.
if (!state.__seededLeaderboard) {
  applySeedLeaderboard(state, 'lester-blaster', recordCadenceScore, { count: 50 });
  state.__seededLeaderboard = true;
}
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

// Playable hero display names. The in-game roguelike heroes were renamed from
// the old mascot working titles (lester/lilly) to their combat identities. The
// internal ids stay stable so saved data / canon keep working.
const CHARACTER_DISPLAY_NAMES = Object.freeze({
  lester: 'Lit Commando',
  lilly: 'Lit Valkyrie',
});

const combat = {
  active: false,
  paused: false,
  gameOver: false,
  gameOverReason: '',
  startedAt: 0,
  frame: 0,
  elapsedGameSeconds: 0,
  playerX: PLAYER_X,
  playerY: GROUND_Y,
  playerMapX: 0,
  playerMapY: 0,
  aimMapX: 1,
  aimMapY: 0,
  velocityY: 0,
  velocityX: 0,
  jumpsLeft: 2,
  health: PLAYER_MAX_HEALTH,
  lives: 1,
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
  // Active timed power-up effects (seconds remaining). 0 = inactive.
  powerUpTimers: { magnet: 0, slowEnemies: 0, berserk: 0 },
  xpGems: [],
  killsByType: {},
  bossKills: 0,
  longestSurvivalThisRun: 0,
  levelUpChoices: [],
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
  shots: 0,
  fireFlash: 0,
  meleeSwings: 0,
  lastMeleeFrame: -999,
  boss: null,
  bossDefeated: false,
  miniBossLock: false,
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
  musicEnabled: true,
  viewportMode: DEFAULT_VIEWPORT_MODE,
  keys: new Set(),
  lastTimestamp: 0,
  accumulatorMs: 0,
  frameTimes: [],
  fps: 60,
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

function renderArcadeIcon(icon, label = '') {
  const node = el('span', { className: 'arcade-icon', textContent: icon, ariaLabel: label || icon, role: 'img' });
  return node;
}

function renderRotatingCabinetSprite(sprite, variant = 'splash') {
  const rotator = el('div', {
    className: `hmh-cabinet-rotator ${variant === 'card' ? 'cabinet-card-rotator' : 'splash-cabinet-rotator'}`,
    ariaLabel: `${sprite?.id ?? 'Hard Money Heroes cabinet'} rotating sprite`,
    role: 'img',
  });
  const frames = sprite?.frames ?? [];
  const frameDuration = Math.max(240, Number(sprite?.frameDurationMs ?? frames[0]?.durationMs ?? 720));
  rotator.style.setProperty('--cabinet-frame-count', String(Math.max(1, frames.length)));
  rotator.style.setProperty('--cabinet-loop-duration', `${frameDuration * Math.max(1, frames.length)}ms`);
  frames.forEach((frame, index) => {
    const image = el('img', {
      className: 'cabinet-rotation-frame',
      src: frame.src,
      alt: '',
    });
    image.loading = 'eager';
    image.decoding = 'async';
    image.style.setProperty('--cabinet-frame-index', String(index));
    image.style.setProperty('--cabinet-frame-delay', `${frameDuration * index}ms`);
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
function heroRotationSprite(characterId) {
  // Prefer the 'lit-commando' / 'lit-valkyrie' keys when available; they carry the
  // gameplay hero sprites. Fall back to 'lester' / 'lilly' keys.
  const rosterKey = characterId === 'lester' ? 'lit-commando' : characterId === 'lilly' ? 'lit-valkyrie' : characterId;
  const entry = hmh('HMH_ANIMATED_ROSTER')?.[rosterKey] ?? hmh('HMH_ANIMATED_ROSTER')?.[characterId];
  const animations = entry?.animations ?? {};
  // Prefer walk (best for hero showcase), then idle, then any populated animation.
  const ordered = ['walk', 'idle', 'run', 'shoot'].filter((a) => animations[a] && Object.keys(animations[a]).length);
  const chosenName = ordered[0] ?? Object.keys(animations)[0];
  const chosen = animations[chosenName];
  if (!chosen) return null;
  // Collect one frame per direction (first frame of each direction's animation),
  // respecting the clockwise spin order.
  const frames = [];
  for (const dir of SPIN_DIRECTION_ORDER) {
    const dirFrames = chosen[dir];
    if (Array.isArray(dirFrames) && dirFrames.length) frames.push({ src: dirFrames[0], direction: dir });
  }
  if (!frames.length) return null;
  const frameDurationMs = Math.max(180, Math.round(1000 / (entry?.targetFps ?? 10)));
  return { id: characterId, animation: chosenName, frames, frameDurationMs };
}
const HERO_ROSTER = [
  {
    id: 'lester', name: 'Lit Commando', locked: false,
    tagline: 'Tanky Bruiser',
    bio: 'Litecoin-silver tactical commando in cyan-visor combat armor. More HP, armor, and damage — a touch slower. Walks straight into the panic with hard money on his side.',
    stats: [['Power', 5], ['Speed', 3], ['Armor', 5], ['Luck', 3]],
  },
  {
    id: 'lilly', name: 'Lit Valkyrie', locked: false,
    tagline: 'Agile Glass-Cannon',
    bio: 'Teal-plasma energy warrior with short teal hair. Faster movement, higher fire-rate and crit chance — but more fragile. Darts through the panic and punishes mistakes.',
    stats: [['Power', 4], ['Speed', 5], ['Armor', 2], ['Luck', 5]],
  },
];

// Glyph per hero skill type, shown beside the stat label on the hero cards.
const HERO_STAT_ICONS = {
  Power: '💥',
  Speed: '⚡',
  Armor: '🛡️',
  Luck: '🍀',
  Damage: '💥',
  Health: '❤️',
  'Fire Rate': '🔥',
  Crit: '🎯',
};

function renderHeroStatBars(container, stats) {
  for (const [label, value] of stats) {
    const row = el('div', { className: 'hero-stat-row' });
    const labelWrap = el('div', { className: 'hero-stat-label' });
    const icon = HERO_STAT_ICONS[label] || '•';
    labelWrap.append(el('span', { className: 'hero-stat-icon', textContent: icon, ariaHidden: 'true' }));
    labelWrap.append(el('span', { className: 'hero-stat-name', textContent: label }));
    row.append(labelWrap);
    const track = el('div', { className: 'hero-stat-track' });
    const fill = el('div', { className: 'hero-stat-fill' });
    fill.style.width = `${(value / 5) * 100}%`;
    track.append(fill);
    row.append(track);
    container.append(row);
  }
}

function renderOfficialCharacterSelect() {
  applyHardMoneyHeroScreenBackground(dom.officialCharacterSelect, 'modeSelect');
  if (!dom.officialCharacterRoster) return;
  dom.officialCharacterRoster.replaceChildren();
  for (const hero of HERO_ROSTER) {
    const card = el('button', { className: `hero-card ${hero.locked ? 'locked' : 'active'}` });
    card.type = 'button';
    card.disabled = hero.locked;
    const stage = el('div', { className: 'hero-card-stage' });
    const sprite = heroRotationSprite(hero.id);
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
    const statBox = el('div', { className: 'hero-stats' });
    renderHeroStatBars(statBox, hero.stats);
    info.append(statBox);
    appendText(info, 'span', hero.locked ? 'Coming Soon' : 'SELECT — PLAY AS ' + hero.name.toUpperCase(), 'hero-cta');
    card.append(info);
    if (!hero.locked) {
      card.addEventListener('click', () => {
        playSfxCue('hero-select', 0.07);
        combat.characterId = hero.id;
        setOfficialView('level-one-intro');
      });
    }
    dom.officialCharacterRoster.append(card);
  }
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
  dom.combatStatus.textContent = `${model.details} Controls: WASD/arrows move, mouse aims (gun auto-fires), Left Click melee, Right Click throw, F grenade, R reload, Esc pause.`;
  dom.combatRunStatus.dataset.state = model.state;
}

function gameplaySyncCopy() {
  const modeCopy = officialSelectedMode === 'ranked'
    ? 'Ranked testnet: official score sync is held until game-over submission; restart requires a new paid credit.'
    : 'Free practice: local sandbox only; restart is free and never writes profile/leaderboard state.';
  const phase = combat.stagePhase === 'travel'
    ? `player-led advance to Stage ${combat.stageIndex} engagement`
    : combat.stagePhase === 'boss'
      ? 'level boss lock'
      : `Wave ${combat.waveIndex}/${combat.wavesThisStage || 1}`;
  const lockCopy = combat.scrollLockReason ? ` // ${combat.scrollLockReason}` : '';
  const healthCopy = `HP ${Math.max(0, Math.round(combat.health))}%`;
  return `${modeCopy} // ${healthCopy} // Stage ${combat.stageIndex}/${combat.stageCount} // ${phase}${lockCopy}`;
}

function currentGameOverSummaryModel() {
  const session = currentSession ?? lastCompletedSession;
  return buildGameOverSummaryModel({
    session,
    score: combat.score || lastRunScore,
    elapsedSeconds: combat.elapsedGameSeconds || lastRunElapsedSeconds,
    kills: combat.kills,
    bossesDefeated: (combat.bossDefeated || Boolean(lastBossId)) ? 1 : 0,
    acceptedForGlobalLeaderboard: Boolean(combat.gameOverSubmitted || lastRunResult?.acceptedForGlobalLeaderboard),
  });
}

function renderGameOverSummary() {
  if (!dom.combatGameOverSummary) return;
  dom.combatGameOverSummary.hidden = !combat.gameOver;
  if (!combat.gameOver) {
    dom.combatGameOverSummary.replaceChildren();
    return;
  }

  const summary = currentGameOverSummaryModel();
  dom.combatGameOverSummary.dataset.channel = summary.channel;
  dom.combatGameOverSummary.replaceChildren();
  appendText(dom.combatGameOverSummary, 'strong', summary.title, 'game-over-summary-title');
  appendText(dom.combatGameOverSummary, 'p', summary.trackingCopy, 'game-over-summary-copy');

  const metricGrid = el('div', { className: 'game-over-summary-grid' });
  for (const metric of summary.metrics) {
    const card = el('article', { className: 'summary-metric-card' });
    appendText(card, 'span', metric.label);
    appendText(card, 'strong', metric.value);
    metricGrid.append(card);
  }
  dom.combatGameOverSummary.append(metricGrid);

  const actionNote = el('p', { className: 'game-over-action-copy' });
  actionNote.textContent = `${summary.actions.map((action) => `${action.label}: ${action.cost}`).join(' // ')}. ${summary.exitRampCopy}`;
  dom.combatGameOverSummary.append(actionNote);
}

function submitCombatGameOver() {
  if (!combat.gameOver || !currentSession?.isPaid || combat.gameOverSubmitted) return;
  const result = recordScore(state, currentSession, Math.max(0, Math.round(combat.score)), {
    distanceMeters: Math.round((combat.elapsedGameSeconds || 0) * 2.7),
    elapsedSeconds: Math.round(combat.elapsedGameSeconds || 0),
    kills: combat.kills,
    killsByType: { ...(combat.killsByType || {}) },
    maxCombo: combat.maxCombo,
    bossId: lastBossId,
    weaponId: combat.weaponId,
    noDamage: combat.noDamageSeconds >= combat.elapsedGameSeconds - 1,
    collectedPowerUps: [...combat.collectedPowerUpTypes],
  });
  lastCompletedSession = currentSession;
  lastRunResult = {
    score: combat.score,
    elapsedSeconds: combat.elapsedGameSeconds,
    acceptedForGlobalLeaderboard: result.acceptedForGlobalLeaderboard,
  };
  lastRunScore = combat.score;
  lastRunElapsedSeconds = combat.elapsedGameSeconds;
  combat.gameOverSubmitted = true;
  // GameRegistry: child game -> parent sync packet (local now, LitVM SessionLedger later)
  submitGameRun('hard-money-heroes', {
    score: Math.max(0, Math.round(combat.score)),
    kills: combat.kills,
    survivalTime: Math.round(combat.elapsedGameSeconds || 0),
  }, connectedWallet);
  dom.combatStatus.textContent = 'Submit Official Score complete: ranked result synced to parent progress, achievements, leaderboard, and transaction history. No hidden paid-run sync happened before this button.';
  renderOfficialRunStatus();
  renderGameOverSummary();
  renderCombatMenuActionGrid();

  // Settle the tracked run to LitVM. Paid Mode zkLTC funds the gas. The live
  // on-chain send is gated behind SETTLEMENT_LIVE (off until contracts deploy +
  // explicit approval); until then this produces a deterministic simulated tx.
  if (result.acceptedForGlobalLeaderboard && result.settlementInput) {
    settleRankedRun(result.settlementInput);
  }
}

async function settleRankedRun(settlementInput) {
  try {
    const plan = buildSettlementPlan(settlementInput);
    const settlement = await settleRun(plan, { live: SETTLEMENT_LIVE });
    applySettlement(state, settlement);
    const shortTx = settlement.primaryTxHash ? `${settlement.primaryTxHash.slice(0, 10)}…${settlement.primaryTxHash.slice(-6)}` : 'pending';
    const modeLabel = settlement.mode === 'live' ? 'LitVM settlement' : 'LitVM settlement (simulated; enable after contract deploy)';
    if (dom.combatStatus) {
      dom.combatStatus.textContent = `Official score settled to ${modeLabel}. zkLTC fee covered ${plan.calls.length} contract call(s). Tx ${shortTx}. Score history & achievements now read from this settlement.`;
    }
    if (officialAppStep === 'leaderboards') renderOfficialLeaderboards();
    if (officialAppStep === 'profile') renderOfficialProfile();
  } catch (err) {
    if (dom.combatStatus) {
      dom.combatStatus.textContent = `Score recorded, but settlement is pending: ${err.message}`;
    }
    console.warn('[settlement] failed:', err);
  }
}

function renderLevelUpActionGrid() {
  if (!dom.combatMenuActionGrid || !combat.levelUpPaused) return false;
  // FULLSCREEN FIX: render level-up cards inside officialCombatMount so they stay visible in fullscreen
  let levelUpContainer = document.getElementById('levelUpOverlay');
  if (!levelUpContainer && dom.officialCombatMount) {
    levelUpContainer = document.createElement('div');
    levelUpContainer.id = 'levelUpOverlay';
    levelUpContainer.className = 'level-up-overlay';
    levelUpContainer.style.cssText = 'position:absolute;top:12%;left:50%;transform:translateX(-50%);z-index:9999;max-width:86%;max-height:76vh;overflow:auto;background:rgba(12,14,24,0.97);border:3px solid #ffe84d;border-radius:10px;padding:18px 22px;box-shadow:0 0 40px rgba(255,232,77,0.3);';
    dom.officialCombatMount.appendChild(levelUpContainer);
  }
  const targetGrid = levelUpContainer || dom.combatMenuActionGrid;
  const choices = combat.levelUpChoices ?? [];
  const signature = `level-up:${choices.map((choice) => `${choice.id}:${choice.nextLevel}`).join('|')}:rerolls-${combat.roguelikeRun?.rerollsRemaining ?? 0}`;
  if (targetGrid.dataset.signature === signature) return true;
  targetGrid.dataset.signature = signature;
  targetGrid.replaceChildren();
  // Category → icon + tone for the upgrade card badge so each augment reads at a glance.
  const CAT_STYLE = {
    offense: { icon: '⚔', tone: 'red', label: 'Offense' },
    defense: { icon: '🛡', tone: 'cyan', label: 'Defense' },
    mobility: { icon: '🥾', tone: 'green', label: 'Mobility' },
    utility: { icon: '✦', tone: 'gold', label: 'Utility' },
    economy: { icon: '💎', tone: 'gold', label: 'Economy' },
    control: { icon: '🌀', tone: 'cyan', label: 'Control' },
    throwable: { icon: '💣', tone: 'orange', label: 'Throwable' },
    status: { icon: '🔥', tone: 'orange', label: 'Status' },
  };
  for (const choice of choices) {
    const cat = CAT_STYLE[choice.category] ?? { icon: '▲', tone: 'cyan', label: 'Augment' };
    const button = el('button', { className: 'combat-menu-action level-up-upgrade-card', type: 'button', dataset: { skill: choice.id, tone: cat.tone } });
    // Header row: category icon badge + title + per-rank gain chip.
    const head = el('div', { className: 'upgrade-card-head' });
    const badge = el('span', { className: 'upgrade-card-badge', textContent: cat.icon });
    badge.setAttribute('aria-hidden', 'true');
    const titleWrap = el('div', { className: 'upgrade-card-titlewrap' });
    appendText(titleWrap, 'span', cat.label.toUpperCase(), 'upgrade-card-cat');
    appendText(titleWrap, 'strong', choice.title, 'upgrade-card-title');
    head.append(badge, titleWrap);
    appendText(head, 'span', `+${choice.perLevelPercent}%`, 'upgrade-card-gain');
    button.append(head);
    // Rank progression pips: filled up to currentLevel, the next rank highlighted.
    const ranks = el('div', { className: 'upgrade-card-ranks' });
    const maxLevel = choice.maxLevel ?? 5;
    for (let r = 1; r <= maxLevel; r += 1) {
      const pip = el('span', { className: `upgrade-rank-pip${r <= choice.currentLevel ? ' is-filled' : ''}${r === choice.nextLevel ? ' is-next' : ''}` });
      ranks.append(pip);
    }
    const rankLabel = el('span', { className: 'upgrade-card-ranklabel', textContent: `Rank ${choice.currentLevel} → ${choice.nextLevel}` });
    button.append(ranks, rankLabel);
    // Description (contained, wraps within the card).
    appendText(button, 'p', choice.description, 'upgrade-card-desc');
    button.setAttribute('title', `${choice.title} · ${cat.label} · ${choice.description}`);
    button.addEventListener('click', () => selectLevelUpUpgrade(choice.id));
    targetGrid.append(button);
  }
  const reroll = el('button', { className: 'combat-menu-action upgrade-reroll-button', type: 'button', dataset: { action: 'level-up-reroll' } });
  reroll.disabled = (combat.roguelikeRun?.rerollsRemaining ?? 0) <= 0;
  reroll.append(renderArcadeIcon('↻', 'Reroll upgrade choices'), document.createTextNode(`Reroll (${combat.roguelikeRun?.rerollsRemaining ?? 0})`));
  reroll.addEventListener('click', rerollLevelUpChoices);
  targetGrid.append(reroll);
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
    officialScoreSubmitted: combat.gameOverSubmitted,
  });
  const actions = menu.actions.map((action) => {
    if (action.id === 'resume') return { ...action, run: () => toggleCombatPause(false) };
    if (action.id === 'submit-official-score') return { ...action, run: submitCombatGameOver };
    if (action.id === 'restart') return { ...action, run: restartCombatRun };
    if (action.id === 'toggle-music') return { ...action, run: toggleCombatMusic };
    if (action.id === 'toggle-fullscreen') return { ...action, run: cycleCombatViewport };
    if (action.id === 'return-to-game-menu') return { ...action, run: returnToOfficialGameMenu };
    if (action.id === 'exit-to-arcade') return { ...action, run: exitToArcade };
    return { ...action, run: () => {} };
  });
  const signature = actions.map((action) => `${action.id}:${action.label}:${action.enabled}`).join('|');
  if (dom.combatMenuActionGrid.dataset.signature === signature) return;
  dom.combatMenuActionGrid.dataset.signature = signature;
  dom.combatMenuActionGrid.replaceChildren();
  for (const action of actions) {
    const button = el('button', { className: `combat-menu-action ${action.danger ? 'danger-action' : ''}`, type: 'button' });
    button.disabled = action.enabled === false;
    button.append(renderArcadeIcon(action.icon, action.label), document.createTextNode(action.label));
    button.addEventListener('click', () => {
      if (button.disabled) return;
      playSfxCue('menu-click');
      action.run();
    });
    dom.combatMenuActionGrid.append(button);
  }
}

function combatHudStatus() {
  if (combat.gameOver) return combat.bossDefeated ? 'LEVEL CLEAR' : 'GAME OVER';
  if (combat.levelUpPaused) return `LEVEL ${combat.roguelikeRun?.level ?? 1} UP // PICK ONE AUGMENT // REROLLS ${combat.roguelikeRun?.rerollsRemaining ?? 0}`;
  if (combat.roguelikeRun) {
    const director = combat.roguelikeRun.spawnDirector ?? getRoguelikeSpawnDirectorAt(combat.elapsedGameSeconds);
    return `LEVEL 1: THE CRYPTO WASTELAND // ${director.difficultyLabel.toUpperCase()} // ${combat.biomeLayout?.startBiome ? `BIOME ${combat.biomeLayout.startBiome.toUpperCase()}` : 'SURVIVE 20:00'}`;
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
  const signature = hud.widgets.map((widget) => `${widget.id}:${widget.value}`).join('|');
  if (dom.combatHudOverlay.dataset.signature === signature) return;
  dom.combatHudOverlay.dataset.signature = signature;
  dom.combatHudOverlay.replaceChildren();
  for (const widget of hud.widgets) {
    const card = el('article', { className: 'hud-widget', dataset: { tone: widget.tone, widget: widget.id } });
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
  const director = run.spawnDirector ?? getRoguelikeSpawnDirectorAt(combat.elapsedGameSeconds);
  const augments = Object.values(run.skills).reduce((sum, level) => sum + level, 0);
  const weapon = weaponById(combat.weaponId);
  const xpToNext = Math.max(0, Math.round(run.xpToNextLevel - run.xp));
  const xpRatio = Math.max(0, Math.min(1, run.xp / Math.max(1, run.xpToNextLevel)));
  const heroName = (combat.characterId && CHARACTER_DISPLAY_NAMES[combat.characterId]) || 'Hero';
  const ammoValue = combat.reloading
    ? 'RELOAD…'
    : `${Math.max(0, combat.clip ?? 0)}/${combat.clipSize ?? 0}`;
  const stats = [
    { id: 'survive', label: 'SURVIVE', value: `${formatSeconds(combat.elapsedGameSeconds)} / 20:00`, tone: 'cyan' },
    { id: 'level', label: 'LEVEL', value: `1 · ${director.difficultyLabel.toUpperCase()}`, tone: 'cyan' },
    { id: 'hp', label: 'HP', value: `${Math.max(0, Math.round(combat.health))}`, tone: 'red' },
    { id: 'score', label: 'SCORE', value: Math.round(combat.score).toLocaleString(), tone: 'gold' },
    { id: 'kills', label: 'KILLS', value: `${combat.kills}`, tone: 'gold' },
    { id: 'rank', label: 'RANK', value: `${run.level}`, tone: 'green' },
    { id: 'wpn', label: 'WEAPON', value: (weapon.displayName ?? weapon.title).toUpperCase(), tone: 'green' },
    { id: 'ammo', label: 'AMMO', value: ammoValue, tone: combat.reloading ? 'orange' : 'green' },
    { id: 'thrown', label: 'THROW', value: `💣${combat.grenades} · 🪓${combat.axes ?? 0}`, tone: 'orange' },
    { id: 'aug', label: 'AUG', value: `${augments} · ⟳${run.rerollsRemaining}`, tone: 'orange' },
  ];
  const activeFx = [];
  if ((combat.powerUpTimers.magnet ?? 0) > 0) activeFx.push(`MAGNET ${Math.ceil(combat.powerUpTimers.magnet)}s`);
  if ((combat.powerUpTimers.slowEnemies ?? 0) > 0) activeFx.push(`SLOW ${Math.ceil(combat.powerUpTimers.slowEnemies)}s`);
  if ((combat.powerUpTimers.berserk ?? 0) > 0) activeFx.push(`BERSERK ${Math.ceil(combat.powerUpTimers.berserk)}s`);
  const signature = `${heroName}|${stats.map((s) => s.value).join('|')}|xp${Math.round(xpRatio * 100)}|${activeFx.join(',')}`;
  if (bar.dataset.signature === signature) return;
  bar.dataset.signature = signature;
  bar.replaceChildren();
  const heroChip = el('span', { className: 'stat-hero' });
  heroChip.textContent = heroName;
  bar.append(heroChip);
  const chips = el('div', { className: 'stat-chips' });
  for (const s of stats) {
    const chip = el('div', { className: 'stat-chip', dataset: { tone: s.tone } });
    appendText(chip, 'span', s.label);
    appendText(chip, 'strong', s.value);
    chips.append(chip);
  }
  bar.append(chips);
  // XP-to-next bar with explicit remaining number.
  const xpWrap = el('div', { className: 'stat-xp' });
  appendText(xpWrap, 'span', `XP ${xpToNext} to LV ${run.level + 1}`);
  const track = el('div', { className: 'stat-xp-track' });
  const fill = el('div', { className: 'stat-xp-fill' });
  fill.style.width = `${Math.round(xpRatio * 100)}%`;
  track.append(fill);
  xpWrap.append(track);
  bar.append(xpWrap);
  if (activeFx.length) {
    const fxWrap = el('div', { className: 'stat-fx' });
    for (const f of activeFx) appendText(fxWrap, 'span', f);
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
  if (dom.officialGameStateCopy) dom.officialGameStateCopy.textContent = gameplaySyncCopy();
  if (dom.officialCombatMount) {
    dom.officialCombatMount.dataset.viewport = combat.viewportMode;
    dom.officialCombatMount.dataset.paused = String(combat.paused);
    dom.officialCombatMount.dataset.gameOver = String(combat.gameOver);
  }
  if (dom.officialGameplayControls) dom.officialGameplayControls.dataset.mode = currentSession?.mode ?? 'free';
  if (dom.combatPauseButton) dom.combatPauseButton.textContent = combat.paused ? 'Return to Game' : 'Pause';
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
    dom.combatMenuPanel.hidden = !(combat.paused || combat.gameOver || combat.levelUpPaused);
  const levelUpEl = document.getElementById('levelUpOverlay');
  if (levelUpEl) levelUpEl.hidden = !combat.levelUpPaused;
    dom.combatMenuPanel.dataset.state = combat.gameOver ? 'game-over' : combat.levelUpPaused ? 'level-up' : 'paused';
  }
  const menu = buildCombatOptionsMenuModel({
    paused: combat.paused,
    gameOver: combat.gameOver,
    musicEnabled: combat.musicEnabled,
    viewportMode: combat.viewportMode,
    currentMode: currentSession?.mode ?? officialSelectedMode ?? 'free',
    officialScoreSubmitted: combat.gameOverSubmitted,
  });
  if (dom.combatMenuTitle) dom.combatMenuTitle.textContent = combat.levelUpPaused ? `Level ${combat.roguelikeRun?.level ?? 1} Upgrade` : menu.title;
  if (dom.combatMenuCopy) {
    dom.combatMenuCopy.textContent = combat.gameOver
      ? `${combat.gameOverReason || 'Lester was defeated.'} Score ${combat.score.toLocaleString()} // ${combat.kills} enemies cleared. Play Again restarts free mode immediately; ranked mode requires a new paid credit.`
      : combat.levelUpPaused
        ? 'The isometric roguelike run is paused. Pick one of two random +5% skill upgrades, or spend your one reroll for this level.'
        : menu.copy;
  }
  renderCombatHudOverlay();
  renderRoguelikeStatBar();
  renderTacticalBalanceDebugOverlay();
  renderGameOverSummary();
  renderCombatMenuActionGrid();
}

async function toggleCombatPause(forcePaused) {
  if (!combat.active && !combat.gameOver) return;
  combat.paused = typeof forcePaused === 'boolean' ? forcePaused : !combat.paused;
  playSfxCue('menu-click');
  if (combat.paused) spawnText('PAUSED', 350, 132, '#ffe84d');
  syncCombatOverlay();
}

async function restartCombatRun() {
  playSfxCue('level-start');
  const wasPaid = currentSession?.isPaid || officialSelectedMode === 'ranked';
  if (wasPaid) {
    dom.combatStatus.textContent = 'Ranked restart selected: this starts a fresh local ranked attempt and represents a new testnet credit in the official flow. Prior paid-run state is not silently resubmitted.';
    currentSession = beginTrackedSession({ mode: 'paid' });
  } else {
    dom.combatStatus.textContent = 'Free practice restarted from Level 1 Stage 1. No profile, leaderboard, transaction, or paid-run state is written.';
    currentSession = startPlaySession({ wallet: connectedWallet ?? MOCK_WALLET, gameId: selectedGameId, mode: 'free' });
  }
  await startCombat();
  combat.paused = false;
  renderOfficialRunStatus();
  syncCombatOverlay();
}

function toggleCombatMusic() {
  const musicOn = toggleArcadeMusicMute();
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
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(rect.width * dpr));
  const targetHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
}

async function requestCombatFullscreen() {
  const target = dom.officialCombatMount ?? dom.officialGameplay ?? dom.combatCanvas;
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
  try {
    if (!document.fullscreenElement && target?.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: 'hide' });
      // Resize canvas after fullscreen transition completes
      requestAnimationFrame(() => {
        resizeCombatCanvas();
      });
    }
  } catch (error) {
    combat.viewportMode = 'expanded-fullscreen';
    combat.status = `Browser fullscreen was blocked, so the combat canvas expanded inside the page: ${error?.message ?? 'request failed'}`;
    if (dom.combatStatus) dom.combatStatus.textContent = combat.status;
    spawnText('FULLSCREEN BLOCKED', combat.playerX + 4, combat.playerY - 96, '#ff476f');
    resizeCombatCanvas();
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
  // Force immediate resize to windowed dimensions using the model
  resizeCombatCanvas();
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
  // If a run is in progress, "Game Menu" must NOT discard it. Just open the
  // in-game pause overlay (or resume if already paused). Progress is preserved.
  if (combat.active && !combat.gameOver) {
    if (!combat.paused) {
      combat.paused = true;
      combat.keys.clear();
      combat.status = 'Paused. Your run is preserved — resume, or Exit to Arcade to abandon it.';
    } else {
      combat.paused = false;
      combat.status = 'Run resumed.';
    }
    syncCombatOverlay();
    return;
  }
  // No active run: behave as a normal return to the pre-match menu.
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
  if (document.fullscreenElement) exitCombatFullscreen();
  combat.active = false;
  combat.paused = false;
  combat.gameOver = false;
  combat.keys.clear();
  setArcadeMusicContext('arcade');
  currentSession = null;
  selectedGameId = 'hmh';
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
    ? 'Exited Hard Money Heroes back to the Lester’s Arcade cabinet row. No hidden paid-run sync occurred.'
    : 'Exited Hard Money Heroes back to the Lester’s Arcade splash. No hidden paid-run sync occurred.';
  renderOfficialApp();
  syncCombatOverlay();
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

function currentLevelOneEnvironmentStage(stageIndex = combat.stageIndex) {
  if (currentLevel()?.id !== 'level-1-the-slums') return null;
  const manifestStage = HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST.levelOneStages.find((stage) => {
    const [start, end] = stage.stageRange;
    return stageIndex >= start && stageIndex <= end;
  }) ?? HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST.levelOneStages.at(-1);
  return combatArt.environmentStages[manifestStage.id] ?? null;
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

function propHitbox(prop) {
  if (prop.kind === 'gap') return { x: prop.x, y: GROUND_Y + 4, w: prop.w, h: 42 };
  return { x: prop.x, y: prop.y, w: prop.w, h: prop.h };
}

function propBlocksShot(prop) {
  return prop.hp > 0 && ['cover', 'crate', 'wall', 'barrel'].includes(prop.kind);
}

function playerCoverProp() {
  if (!combat.crouching || combat.playerY < GROUND_Y - 2) return null;
  const playerBox = playerHitbox();
  return combat.props.find((prop) => propBlocksShot(prop)
    && prop.cover
    && prop.x < playerBox.x + playerBox.w + 18
    && prop.x + prop.w > playerBox.x - 8);
}

function damageProp(prop, damage, source = 'impact') {
  if (!propBlocksShot(prop)) return false;
  prop.hp -= damage;
  spawnText(`${prop.label ?? prop.kind} -${damage}`, prop.x, prop.y - 10, '#ffe84d');
  if (prop.hp <= 0) {
    spawnExplosion(prop.x + prop.w / 2, prop.y + prop.h / 2, prop.explosive ? '#ff7b2f' : '#aab6d3');
    if (prop.explosive) {
      const blast = { x: prop.x - 70, y: prop.y - 48, w: prop.w + 140, h: prop.h + 96 };
      for (const enemy of combat.enemies) {
        if (rectsOverlap(blast, enemyHitbox(enemy))) damageEnemy(enemy, 16, source);
      }
      const bossBox = bossHitbox();
      if (bossBox && rectsOverlap(blast, bossBox)) damageBoss(18, source);
    }
  }
  return prop.hp <= 0;
}

function releaseScrollLock(reason = 'arena clear') {
  combat.miniBossLock = false;
  combat.scrollLockReason = null;
  spawnText(`SCROLL RELEASED // ${reason}`, 250, 90, '#45ff8a');
}

function isFinalBossStage(stageIndex = combat.stageIndex) {
  return stageIndex >= combat.stageCount;
}

function isMiniBossStage(stageIndex = combat.stageIndex) {
  return !isFinalBossStage(stageIndex) && stageIndex > 1 && stageIndex % 4 === 0;
}

function wavesForStage(stageIndex = combat.stageIndex) {
  const [minWaves, maxWaves] = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.wavesPerPauseRange;
  return clamp(minWaves + ((stageIndex + 1) % maxWaves), minWaves, maxWaves);
}

function enemyCapForStage(stageIndex = combat.stageIndex) {
  return isMiniBossStage(stageIndex) || isFinalBossStage(stageIndex) ? MINI_BOSS_STAGE_CAP : NORMAL_STAGE_CAP;
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

function beginStageEngagement() {
  combat.stagePhase = isFinalBossStage() ? 'boss' : 'engagement';
  combat.miniBossLock = true;
  combat.scrollSpeed = 0;
  combat.props = createStageProps(combat.stageIndex, 'engagement');
  combat.hazards = [];
  combat.platforms = createStagePlatforms(combat.stageIndex);
  if (isFinalBossStage()) {
    const boss = LESTER_BLASTER_BOSS_SYSTEM.bosses[(combat.stageIndex + combat.kills + combat.frame) % LESTER_BLASTER_BOSS_SYSTEM.bosses.length];
    combat.scrollLockReason = `LEVEL BOSS LOCK // defeat ${boss.title}`;
    spawnBoss(boss);
    return;
  }
  combat.scrollLockReason = isMiniBossStage()
    ? `MINI-BOSS LOCK // Stage ${combat.stageIndex} waves + captain`
    : `SCROLL LOCK // clear Stage ${combat.stageIndex} engagement`;
  if (isMiniBossStage()) spawnMiniBoss();
  startNextWave();
  spawnText(`STAGE ${combat.stageIndex} LOCK`, 300, 88, isMiniBossStage() ? '#ff7b2f' : '#ffe84d');
}

function startNextWave() {
  if (combat.waveIndex >= combat.wavesThisStage) return;
  combat.waveIndex += 1;
  const [minEnemies, maxEnemies] = isMiniBossStage()
    ? LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.miniBossEnemiesOnScreenRange
    : LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.normalEnemiesOnScreenRange;
  const target = minEnemies + ((combat.stageIndex + combat.waveIndex) % (maxEnemies - minEnemies + 1));
  combat.waveSpawnQueue = target;
  combat.waveEnemiesSpawned = 0;
  combat.nextWaveSpawnFrame = combat.frame + Math.round(LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning.enemySpawnDelayFrames / 2);
  spawnText(`WAVE ${combat.waveIndex}/${combat.wavesThisStage}`, 330, 112, '#ffe84d');
}

function completeStage() {
  if (isFinalBossStage()) {
    combat.active = false;
    combat.gameOver = true;
    combat.gameOverReason = 'Level 1: The Crypto Wasteland cleared — boss defeated';
    combat.scrollLockReason = 'LEVEL CLEAR';
    spawnText('LEVEL CLEAR', 318, 120, '#45ff8a');
    playSfxCue('game-over', 0.08);
    ensureCombatMusic('game-over');
    syncCombatOverlay();
    return;
  }
  releaseScrollLock(`Stage ${combat.stageIndex} clear`);
  beginStage(combat.stageIndex + 1);
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

// Guard so URL syncing from setOfficialView doesn't fight popstate-driven nav.
let suppressRouteSync = false;

function syncRouteForView(step) {
  if (suppressRouteSync || typeof window === 'undefined' || !window.history?.pushState) return;
  const gameSlug = gameSlugFor(selectedGameId);
  const sessionId = currentSession?.urlSessionId ?? null;
  const path = routeForView(step, { gameSlug, sessionId });
  if (window.location.pathname !== path) {
    window.history.pushState({ step, gameSlug, sessionId }, '', path);
  }
}

function setOfficialView(step) {
  officialAppStep = step;
  syncRouteForView(step);
  render();
}

function showOfficialPanel(activePanel) {
  for (const panel of [dom.officialWalletSplash, dom.officialArcadeFloor, dom.officialModeSelect, dom.officialCharacterSelect, dom.officialLevelIntro, dom.officialGameplay]) {
    if (panel) panel.hidden = panel !== activePanel;
  }
}

function renderOfficialNav() {
  if (!dom.officialNavTabs) return;
  dom.officialNavTabs.replaceChildren();
  const iconById = { cabinets: '🕹️', profile: '👤', leaderboards: '🏆', settings: '⚙️' };
  for (const item of (LESTERS_ARCADE_V2_APP_SHELL.primaryNav ?? LESTERS_ARCADE_V2_APP_SHELL.navigation)) {
    const button = el('button', { className: `official-nav-tab ${officialAppStep === item.id || (item.id === 'cabinets' && ['arcade-walk-in', 'cabinet-select', 'mode-select', 'character-select', 'level-one-intro', 'gameplay'].includes(officialAppStep)) ? 'active' : ''}` });
    button.type = 'button';
    button.disabled = !connectedWallet && item.id !== 'cabinets';
    button.append(renderArcadeIcon(iconById[item.id] ?? '◆', item.label), document.createTextNode(item.label));
    button.addEventListener('click', () => {
      playSfxCue('menu-click');
      if (item.id === 'cabinets') setOfficialView(connectedWallet ? 'cabinet-select' : 'wallet-splash');
      if (item.id === 'profile') setOfficialView('profile');
      if (item.id === 'leaderboards') setOfficialView('leaderboards');
      if (item.id === 'settings') setOfficialView('settings');
    });
    dom.officialNavTabs.append(button);
  }
  // When connected: show the player's avatar chip + a Sign Out button.
  if (connectedWallet) {
    const snapshot = buildPlayerArcadeSnapshot(state, connectedWallet);
    const displayName = snapshot?.profile?.displayName ?? connectedWallet;
    const account = el('div', { className: 'official-nav-account' });
    const avatar = renderAvatarChip(connectedWallet, displayName, 'nav-avatar');
    avatar.title = displayName;
    const avatarBtn = el('button', { className: 'nav-avatar-button', type: 'button', ariaLabel: 'Open profile' });
    avatarBtn.append(avatar);
    avatarBtn.addEventListener('click', () => { playSfxCue('menu-click'); setOfficialView('profile'); });
    const signOut = el('button', { className: 'nav-signout-button', type: 'button', textContent: 'Sign Out' });
    signOut.addEventListener('click', signOutWallet);
    account.append(avatarBtn, signOut);
    dom.officialNavTabs.append(account);
  }
}

function renderOfficialWalletSplash() {
  if (!dom.officialWalletSplash) return;
  applyHardMoneyHeroScreenBackground(dom.officialWalletSplash, 'splash');
  const featuredCabinet = LESTERS_ARCADE_V2_APP_SHELL.cabinets.find((cabinet) => cabinet.id === 'hard-money-heroes');
  const featuredSprite = productionCabinetSprite() ?? featuredCabinet?.desktopCabinetSprite;
  if (dom.splashFeaturedCabinet && featuredSprite) {
    // Show the original 3D rotating cabinet sprite animation (no static banner).
    dom.splashFeaturedCabinet.replaceChildren(renderRotatingCabinetSprite(featuredSprite, 'splash'));
  }
  const copy = connectedWallet
    ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)} is active. Enter the arcade to select Hard Money Heroes.`
    : LESTERS_ARCADE_V2_APP_SHELL.profileRules.walletLockCopy;
  dom.officialWalletCopy.textContent = copy;
  dom.officialConnectButton.textContent = connectedWallet ? 'Enter Arcade' : 'Connect Wallet';
}

function renderOfficialCabinets() {
  dom.officialCabinetGrid.replaceChildren();
  for (const cabinet of LESTERS_ARCADE_V2_APP_SHELL.cabinets) {
    const cabinetSprite = cabinet.id === 'hard-money-heroes'
      ? (productionCabinetSprite() ?? cabinet.desktopCabinetSprite)
      : cabinet.desktopCabinetSprite;
    const card = el('button', { className: `official-cabinet-card ${cabinet.playable ? 'playable' : 'locked'} ${cabinetSprite ? 'featured-cabinet-card' : ''}` });
    card.type = 'button';
    card.disabled = !cabinet.playable;
    card.addEventListener('click', async () => {
      if (!cabinet.playable) return;
      // Lazy-load the game's art and data manifests the first time the player
      // selects this cabinet. The heavy HMH bundles live in games/<id>/loader.mjs,
      // fetched over HTTP only on demand, so the portal shell stays small.
      if (cabinet.id === 'hard-money-heroes') {
        card.classList.add('is-loading');
        card.setAttribute('aria-busy', 'true');
        try {
          await ensureHMHLoaded();
        } catch (err) {
          console.error('[HMH] Failed to load game payload:', err);
        } finally {
          card.classList.remove('is-loading');
          card.removeAttribute('aria-busy');
        }
      }
      selectedGameId = cabinet.gameId;
      currentSession = null;
      lastCompletedSession = null;
      lastRunResult = null;
      setOfficialView('mode-select');
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
    appendText(copy, 'span', cabinet.playable ? 'PLAYABLE NOW' : 'COMING SOON', 'cabinet-status-label');
    copy.append(renderArcadeIcon(cabinet.playable ? '⚡' : '🔒', cabinet.playable ? 'Playable' : 'Locked'));
    appendText(copy, 'strong', cabinet.title);
    appendText(copy, 'small', cabinet.description);
    card.append(copy);
    dom.officialCabinetGrid.append(card);
  }
}

// Set true for one render right after an avatar save so the freshly re-rendered
// profile can surface a persistent "Avatar saved!" confirmation (the previous
// code set the message then immediately re-rendered, wiping it before any human
// could read it).
let profileAvatarJustSaved = false;
// Same pattern for the display-name save so the confirmation survives the
// re-render the save triggers (mirrors the avatar "saved!" toast/flash).
let profileUsernameJustSaved = false;
// Which game's stats/history the profile is showing. Game-specific so future
// cabinets get their own stats view via the same switcher pattern as the board.
let profileGameId = 'lester-blaster';

function renderOfficialProfile() {
  dom.officialCabinetGrid.replaceChildren();
  dom.officialCabinetGrid.classList.add('profile-command-grid');
  const snapshot = connectedWallet ? buildPlayerArcadeSnapshot(state, connectedWallet) : null;
  const profile = snapshot?.profile;

  const profileHero = el('article', { className: 'official-info-card profile-hero-card hmh-visual-polish-v11' });
  appendText(profileHero, 'span', 'Wallet Profile // Parent Account', 'cabinet-status-label');
  const heroTop = el('div', { className: 'profile-hero-topline' });
  heroTop.append(renderAvatarChip(connectedWallet, profile?.displayName, 'profile-hero-avatar'));
  const heroIdentity = el('div', { className: 'profile-hero-identity' });
  appendText(heroIdentity, 'strong', profile?.displayName ?? 'Connect wallet to activate profile', 'profile-hero-name');
  appendText(heroIdentity, 'small', connectedWallet
    ? `${connectedWallet.slice(0, 10)}…${connectedWallet.slice(-8)} // ${walletConnector} // wallet is your locked identity for scores, achievements & settlement`
    : 'Wallet is the locked identity for progress, high scores, achievements, avatars, and LitVM settlement receipts.');
  heroTop.append(heroIdentity);
  profileHero.append(heroTop);

  if (connectedWallet && snapshot) {
    const bestScore = Math.max(...Object.values(snapshot.progress ?? {}).map((entry) => Math.max(entry.bestPaidScore ?? 0, entry.bestFreeScore ?? 0)), 0);
    const heroStats = el('div', { className: 'profile-hero-stats' });
    for (const [label, value] of [
      ['Rank', profile.rank],
      ['XP', profile.xp.toLocaleString()],
      ['Best Score', bestScore.toLocaleString()],
      ['Ranked Runs', profile.totalPaidRuns.toLocaleString()],
      ['Achievements', `${snapshot.achievementSummary.unlocked}/${snapshot.achievementSummary.total}`],
      ['Settlements', String(snapshot.settlements.length)],
    ]) {
      const stat = el('div', { className: 'profile-hero-stat' });
      appendText(stat, 'span', label);
      appendText(stat, 'strong', value);
      heroStats.append(stat);
    }
    profileHero.append(heroStats);

    const quickActions = el('div', { className: 'profile-quick-actions' });
    const playRanked = el('button', { className: 'pixel-button profile-action-primary', type: 'button', textContent: 'Play Ranked' });
    playRanked.addEventListener('click', () => { playSfxCue('menu-click'); setOfficialView('mode-select'); });
    const viewBoard = el('button', { className: 'pixel-button', type: 'button', textContent: 'View Leaderboard' });
    viewBoard.addEventListener('click', () => { playSfxCue('menu-click'); setOfficialView('leaderboards'); });
    quickActions.append(playRanked, viewBoard);
    profileHero.append(quickActions);
  }
  dom.officialCabinetGrid.append(profileHero);

  if (!connectedWallet) return;

  const walletModel = buildWalletConnectionModel({
    providerAvailable: Boolean(detectEthereumProvider()?.request),
    wallet: connectedWallet,
    chainId: connectedChainId,
  });
  const walletCard = el('article', { className: `official-info-card profile-wallet-rail-card ${walletModel.status} ${walletModel.chainGuard.status}` });
  appendText(walletCard, 'span', 'Wallet + Chain Guard', 'cabinet-status-label');
  appendText(walletCard, 'strong', walletModel.chainGuard.status === 'right-chain' ? 'LiteForge Ready' : 'Action Needed');
  appendText(walletCard, 'small', walletModel.chainGuard.copy);
  const walletFacts = el('div', { className: 'profile-wallet-facts' });
  for (const [label, value] of [
    ['Network', `${walletModel.network.name} · ${walletModel.network.chainIdHex}`],
    ['Gas', walletModel.network.nativeCurrency.symbol],
    ['Connector', walletConnector],
    ['Writes', walletModel.permissions.writeScopes.join(' · ')],
  ]) {
    const fact = el('span', { className: 'profile-wallet-fact' });
    fact.append(el('em', { textContent: label }), document.createTextNode(value));
    walletFacts.append(fact);
  }
  walletCard.append(walletFacts);
  dom.officialCabinetGrid.append(walletCard);

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
  if (profileUsernameJustSaved) {
    profileUsernameJustSaved = false;
    feedback.textContent = '✓ Display name saved!';
    feedback.dataset.state = 'ok';
    requestAnimationFrame(() => {
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
      profileUsernameJustSaved = true; // surfaced as a persistent note on re-render
      playSfxCue('menu-click', 0.06);
      // Refresh the nav (display name) + profile panel in place. Do NOT call the
      // global render() here — it resets officialAppStep and bounces the user off
      // the profile screen (same reason as the avatar save below).
      renderOfficialNav();
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
  if (profileAvatarJustSaved) {
    profileAvatarJustSaved = false;
    avatarFeedback.textContent = '✓ Avatar saved!';
    avatarFeedback.dataset.state = 'ok';
    previewHint.textContent = 'Your avatar is now live in the nav and on leaderboards.';
    requestAnimationFrame(() => {
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
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      avatarFeedback.textContent = 'Only .png or .jpg images are allowed.';
      avatarFeedback.dataset.state = 'error';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      avatarFeedback.textContent = `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 2MB.`;
      avatarFeedback.dataset.state = 'error';
      return;
    }
    const reader = new FileReader();
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
  avatarSaveBtn.addEventListener('click', () => {
    if (!pendingAvatarDataUrl) return;
    setPlayerAvatar(connectedWallet, pendingAvatarDataUrl);
    profileAvatarJustSaved = true; // surfaced as a persistent note on re-render
    // Refresh only the nav avatar chip + the profile panel in place. Do NOT call
    // the global render() here — it resets officialAppStep and bounces the user
    // off the profile screen back to the cabinet floor.
    renderOfficialNav();
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
      className: `pixel-button leaderboard-game-tab${game.id === profileGameId ? ' is-active' : ''}${playable ? '' : ' is-locked'}`,
      type: 'button',
    });
    appendText(tab, 'span', game.title, 'leaderboard-game-tab-title');
    if (!playable) appendText(tab, 'span', 'SOON', 'leaderboard-game-tab-badge');
    tab.disabled = !playable;
    if (playable) {
      tab.addEventListener('click', () => {
        if (profileGameId === game.id) return;
        profileGameId = game.id;
        renderOfficialProfile();
      });
    }
    statsGameBar.append(tab);
  }
  statsCard.append(statsGameBar);

  const gp = snapshot?.progress?.[profileGameId];
  const hmhStats = profileGameId === 'lester-blaster'
    ? buildHardMoneyHeroesStatsModule(state, connectedWallet, profileGameId)
    : null;
  if (!gp || (gp.paidRuns + gp.freeRuns) === 0) {
    const empty = el('div', { className: 'profile-empty-state' });
    appendText(empty, 'strong', `No runs recorded for ${getGame(profileGameId).title} yet.`);
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
    const sessions = (snapshot?.officialSessions ?? [])
      .filter((s) => s.gameId === profileGameId || s.gameId === 'hmh' && profileGameId === 'lester-blaster')
      .slice(-5).reverse();
    if (sessions.length) {
      appendText(statsCard, 'span', 'RECENT RANKED RUNS', 'cabinet-status-label game-stats-subhead');
      const histList = el('div', { className: 'game-history-list' });
      for (const s of sessions) {
        const row = el('div', { className: 'game-history-row' });
        const rs = s.runStats ?? {};
        appendText(row, 'span', `${(s.score ?? rs.score ?? 0).toLocaleString()} pts`, 'game-history-score');
        appendText(row, 'span', `${s.urlSessionId ?? s.sessionId.slice(0, 12)} · ${rs.kills ?? 0} kills · ${formatSurvive(rs.surviveSeconds ?? rs.elapsedSeconds ?? 0)}`, 'game-history-detail');
        if (s.settlement?.primaryTxHash) appendText(row, 'span', '⛓ settled', 'game-history-chain');
        histList.append(row);
      }
      statsCard.append(histList);
    }
  }
  dom.officialCabinetGrid.append(statsCard);

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
      className: `achievement-badge tier-${a.tier ?? 'bronze'} ${a.unlocked ? 'unlocked' : 'locked'}`,
      title: `${a.title} — ${a.description}`,
    });
    badge.tabIndex = 0;
    badge.setAttribute('aria-label', `${a.title}. ${a.description}`);
    const tooltip = el('span', { className: 'achievement-tooltip', textContent: a.description });
    appendText(badge, 'span', a.unlocked ? (a.icon ?? '🏅') : '🔒', 'achievement-icon');
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

function renderOfficialLeaderboards() {
  dom.officialCabinetGrid.replaceChildren();
  const displayNameFor = (wallet) => resolveDisplayName(state.profiles?.[wallet], wallet);

  // --- Game switcher: leaderboards are per-game. HMH is the only playable board
  // now; future cabinets appear as locked "SOON" tabs and become selectable once
  // they ship. Keeps the board game-specific so each game owns its own rankings.
  const gameBar = el('div', { className: 'leaderboard-game-tabs' });
  for (const game of ARCADE_GAMES) {
    const playable = game.status === 'playable';
    const isActive = game.id === leaderboardGameId;
    const tab = el('button', {
      className: `pixel-button leaderboard-game-tab${isActive ? ' is-active' : ''}${playable ? '' : ' is-locked'}`,
      type: 'button',
    });
    appendText(tab, 'span', game.title, 'leaderboard-game-tab-title');
    if (!playable) appendText(tab, 'span', 'SOON', 'leaderboard-game-tab-badge');
    tab.disabled = !playable;
    if (playable) {
      tab.addEventListener('click', () => {
        if (leaderboardGameId === game.id) return;
        leaderboardGameId = game.id;
        leaderboardSearch = '';
        renderOfficialLeaderboards();
      });
    }
    gameBar.append(tab);
  }
  dom.officialCabinetGrid.append(gameBar);

  // cadence tab bar
  const tabBar = el('div', { className: 'leaderboard-cadence-tabs' });
  for (const board of getAllCadenceLeaderboards(state, leaderboardGameId, { wallet: connectedWallet, displayNameFor })) {
    const tab = el('button', {
      className: `pixel-button leaderboard-cadence-tab${board.cadence === officialLeaderboardCadence ? ' is-active' : ''}`,
      textContent: board.cadence.toUpperCase(),
      type: 'button',
    });
    tab.dataset.cadence = board.cadence;
    tab.addEventListener('click', () => {
      officialLeaderboardCadence = board.cadence;
      renderOfficialLeaderboards();
    });
    tabBar.append(tab);
  }
  dom.officialCabinetGrid.append(tabBar);

  const active = getLeaderboard(state, leaderboardGameId, officialLeaderboardCadence, {
    wallet: connectedWallet,
    displayNameFor,
    limit: 50,
  });

  const board = el('article', { className: 'official-info-card leaderboard-board-card leaderboard-board-v9 hmh-visual-polish-v11' });
  const header = el('div', { className: 'leaderboard-header leaderboard-header-v9' });
  const headerCopy = el('div', { className: 'leaderboard-header-copy' });
  appendText(headerCopy, 'h3', `🏆 ${getGame(leaderboardGameId).title.toUpperCase()}`, 'leaderboard-title');
  appendText(headerCopy, 'span', `${active.cadence.toUpperCase()} · ${active.periodKey} · ${active.total} ranked runs`, 'cabinet-status-label');
  const headerStats = el('div', { className: 'leaderboard-header-stats' });
  const topScore = active.topEntries[0]?.score ?? 0;
  const settledCount = active.topEntries.filter((entry) => entry.settlementTxHash).length;
  for (const [label, value] of [
    ['Top Score', topScore.toLocaleString()],
    ['Settled', `${settledCount}/${active.topEntries.length}`],
    ['You', connectedWallet && active.playerRank ? `#${active.playerRank}` : 'Unranked'],
  ]) {
    const stat = el('div', { className: 'leaderboard-header-stat' });
    appendText(stat, 'span', label);
    appendText(stat, 'strong', value);
    headerStats.append(stat);
  }
  header.append(headerCopy, headerStats);
  board.append(header);

  if (active.topEntries.length === 0) {
    appendText(board, 'small', 'No ranked scores in this period yet. Play a Ranked run and submit your official score at game over to claim the top spot.');
    dom.officialCabinetGrid.append(board);
    return;
  }

  // --- Podium for the top 3 (medals + avatars + glow) — always by score ---
  const podiumEntries = active.topEntries.slice(0, 3);
  if (podiumEntries.length >= 1) {
    const podium = el('div', { className: 'leaderboard-podium' });
    const order = [podiumEntries[1], podiumEntries[0], podiumEntries[2]].filter(Boolean);
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    for (const entry of order) {
      const wallet = entry.wallet ?? entry.address ?? null;
      const col = el('div', { className: `podium-slot podium-rank-${entry.rank}${entry.isCurrentPlayer ? ' is-current-player' : ''}` });
      appendText(col, 'span', medals[entry.rank] ?? `#${entry.rank}`, 'podium-medal');
      col.append(renderAvatarChip(wallet, entry.displayName, 'podium-avatar'));
      appendText(col, 'strong', entry.displayName, 'podium-name');
      appendText(col, 'span', entry.score.toLocaleString(), 'podium-score');
      const stand = el('div', { className: 'podium-stand' });
      appendText(stand, 'span', `#${entry.rank}`, 'podium-stand-rank');
      col.append(stand);
      podium.append(col);
    }
    board.append(podium);
  }

  // --- Search + sort controls --------------------------------------------
  const controls = el('div', { className: 'leaderboard-controls' });
  const searchInput = el('input', { className: 'leaderboard-search', type: 'search' });
  searchInput.placeholder = 'Search display name…';
  searchInput.value = leaderboardSearch;
  searchInput.setAttribute('aria-label', 'Search leaderboard by display name');
  searchInput.addEventListener('input', () => {
    leaderboardSearch = searchInput.value;
    renderOfficialLeaderboards();
    // keep focus + caret after re-render
    const next = document.querySelector('.leaderboard-search');
    if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
  });
  controls.append(searchInput);
  const resetButton = el('button', { className: 'pixel-button leaderboard-reset-button', type: 'button', textContent: 'Reset' });
  resetButton.disabled = !leaderboardSearch && leaderboardSortKey === 'score' && leaderboardSortDir === 'desc';
  resetButton.addEventListener('click', () => {
    leaderboardSearch = '';
    leaderboardSortKey = 'score';
    leaderboardSortDir = 'desc';
    renderOfficialLeaderboards();
  });
  controls.append(resetButton);
  board.append(controls);

  // --- Sortable, searchable Top-50 table ---------------------------------
  // Each row keeps its TRUE rank-by-score (the leaderboard standing); sorting/
  // searching only changes the display order/visibility, not the rank number.
  const ranked = active.topEntries.map((e) => ({ ...e, trueRank: e.rank }));
  const term = leaderboardSearch.trim().toLowerCase();
  let rows = term ? ranked.filter((e) => (e.displayName || '').toLowerCase().includes(term)) : ranked.slice();
  const dir = leaderboardSortDir === 'asc' ? 1 : -1;
  const getVal = (e, key) => {
    switch (key) {
      case 'name': return (e.displayName || '').toLowerCase();
      case 'date': return e.recordedAt || '';
      case 'kills': return e.runStats?.kills ?? 0;
      case 'survive': return e.runStats?.surviveSeconds ?? e.runStats?.elapsedSeconds ?? 0;
      case 'level': return e.runStats?.level ?? 0;
      case 'combo': return e.runStats?.maxCombo ?? 0;
      case 'powerups': return (e.runStats?.collectedPowerUps?.length ?? e.runStats?.powerUpsCollected ?? 0);
      default: return e.score;
    }
  };
  rows.sort((a, b) => {
    const va = getVal(a, leaderboardSortKey);
    const vb = getVal(b, leaderboardSortKey);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return a.trueRank - b.trueRank;
  });

  const table = el('div', { className: 'leaderboard-table', role: 'table' });
  const headRow = el('div', { className: 'leaderboard-table-head', role: 'row' });
  const cols = [
    ['rank', '#', 'rank'],
    ['name', 'DISPLAY NAME', 'name'],
    ['score', 'SCORE', 'score'],
    ['kills', 'KILLS', 'kills'],
    ['survive', 'SURVIVED', 'survive'],
    ['level', 'LVL', 'level'],
    ['combo', 'COMBO', 'combo'],
    ['powerups', 'PWR', 'powerups'],
    ['date', 'POSTED', 'date'],
  ];
  for (const [key, label, sortKey] of cols) {
    const arrow = leaderboardSortKey === sortKey ? (leaderboardSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const th = el('button', { className: `leaderboard-th th-${key}${leaderboardSortKey === sortKey ? ' is-sorted' : ''}`, type: 'button', textContent: label + arrow });
    th.addEventListener('click', () => {
      if (leaderboardSortKey === sortKey) {
        leaderboardSortDir = leaderboardSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        leaderboardSortKey = sortKey;
        leaderboardSortDir = sortKey === 'name' ? 'asc' : 'desc';
      }
      renderOfficialLeaderboards();
    });
    headRow.append(th);
  }
  table.append(headRow);

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (rows.length === 0) {
    appendText(table, 'div', `No display names match "${leaderboardSearch}".`, 'leaderboard-empty');
  }
  for (const entry of rows) {
    const wallet = entry.wallet ?? entry.address ?? null;
    const medalClass = entry.trueRank === 1 ? ' rank-gold' : entry.trueRank === 2 ? ' rank-silver' : entry.trueRank === 3 ? ' rank-bronze' : '';
    const row = el('div', { className: `leaderboard-trow${entry.isCurrentPlayer ? ' is-current-player' : ''}${medalClass ? ' top-3' + medalClass : ''}`, role: 'row' });
    appendText(row, 'span', `#${entry.trueRank}`, `leaderboard-rank${medalClass}`);
    const nameCell = el('span', { className: 'lt-name' });
    nameCell.append(renderAvatarChip(wallet, entry.displayName, 'leaderboard-row-avatar'));
    appendText(nameCell, 'span', entry.displayName, 'lt-name-text');
    if (entry.settlementTxHash) appendText(nameCell, 'span', '⛓ on-chain', 'lt-settled');
    row.append(nameCell);
    appendText(row, 'strong', entry.score.toLocaleString(), 'lt-score');
    appendText(row, 'span', String(entry.runStats?.kills ?? '—'), 'lt-kills');
    appendText(row, 'span', formatSurvive(entry.runStats?.surviveSeconds ?? entry.runStats?.elapsedSeconds ?? 0), 'lt-survive');
    appendText(row, 'span', `L${entry.runStats?.level ?? 1}`, 'lt-level');
    appendText(row, 'span', `×${entry.runStats?.maxCombo ?? 0}`, 'lt-combo');
    appendText(row, 'span', String(entry.runStats?.collectedPowerUps?.length ?? entry.runStats?.powerUpsCollected ?? 0), 'lt-powerups');
    appendText(row, 'span', fmtDate(entry.recordedAt), 'lt-date');
    table.append(row);
  }
  board.append(table);

  // --- Sticky "your placement" card ---
  if (connectedWallet && active.playerEntry) {
    const you = el('div', { className: 'leaderboard-you-card' });
    you.append(renderAvatarChip(connectedWallet, active.playerEntry.displayName, 'leaderboard-row-avatar'));
    appendText(you, 'span', `YOUR RANK #${active.playerRank}`, 'leaderboard-you-rank');
    appendText(you, 'strong', `${active.playerEntry.score.toLocaleString()} pts`, 'leaderboard-you-score');
    appendText(you, 'small', `${active.playerEntry.runStats?.kills ?? 0} kills · ${formatSurvive(active.playerEntry.runStats?.surviveSeconds ?? active.playerEntry.runStats?.elapsedSeconds ?? 0)} survived`, 'leaderboard-you-detail');
    board.append(you);
  } else if (connectedWallet) {
    appendText(board, 'small', 'You have no ranked score in this period yet. Play Ranked and submit at game over.');
  }
  dom.officialCabinetGrid.append(board);
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
  applyHardMoneyHeroScreenBackground(dom.officialArcadeFloor, officialAppStep === 'settings' ? 'options' : 'mainMenu');
  dom.officialCabinetGrid.classList.toggle('profile-command-grid', officialAppStep === 'profile');
  dom.officialCabinetGrid.classList.toggle('leaderboard-command-grid', officialAppStep === 'leaderboards');
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
  applyHardMoneyHeroScreenBackground(dom.officialModeSelect, 'modeSelect');
  const ranked = LESTERS_ARCADE_V2_APP_SHELL.modeSelect.ranked;
  dom.officialRankedTooltip.replaceChildren();
  appendText(dom.officialRankedTooltip, 'strong', `${ranked.label}: needs testnet ${ranked.token}`);
  appendText(dom.officialRankedTooltip, 'span', ranked.copy);
  const link = el('a', { className: 'wallet-link', textContent: 'Get zkLTC faucet', href: ranked.faucetUrl, target: '_blank', rel: 'noreferrer' });
  dom.officialRankedTooltip.append(link);
}

function renderOfficialGameplay() {
  const modeLabel = officialSelectedMode === 'ranked' ? 'Ranked Testnet' : 'Free Mode';
  dom.officialGameModeTitle.textContent = `Level 1: The Crypto Wasteland // ${modeLabel}`;
  syncCombatOverlay();
  if (dom.officialCombatMount && !dom.officialCombatMount.contains(dom.combatCanvas)) {
    dom.officialCombatMount.append(dom.combatCanvas);
  }
  // CRITICAL: size the canvas to its laid-out box now that it's visible. Without
  // this the canvas keeps a stale/zero size and the scene renders blank until a
  // fullscreen toggle forces a resize. Run after layout settles (two rAFs).
  requestAnimationFrame(() => {
    resizeCombatCanvas();
    requestAnimationFrame(() => resizeCombatCanvas());
  });
}

function renderOfficialApp() {
  if (!dom.officialApp) return;
  dom.officialApp.dataset.step = officialAppStep;
  // Drive the responsive touch-control overlay: only visible during gameplay.
  document.documentElement.dataset.ingame = officialAppStep === 'gameplay' ? 'true' : 'false';
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
  } else if (officialAppStep === 'character-select') {
    showOfficialPanel(dom.officialCharacterSelect);
    renderOfficialCharacterSelect();
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

async function startOfficialMode(mode) {
  playSfxCue('menu-click');
  // Ranked is paid/official: require the entry-fee signature + chain guard first.
  if (mode === 'ranked') {
    const approved = await requestRankedEntry();
    if (!approved) return; // user cancelled or chain guard blocked
  }
  officialSelectedMode = mode;
  await startMode(mode === 'ranked' ? 'paid' : 'free');
  officialAppStep = 'character-select';
  render();
}

// Ranked entry-fee + chain-guard modal. Returns a Promise<boolean> that resolves
// true when the player approves (and the chain guard passes), false on cancel.
// LIVE PATH IS FULLY WIRED but inert: when SETTLEMENT_LIVE is false the approval
// is simulated (no real tx). Flip SETTLEMENT_LIVE + deploy contracts to go live.
function requestRankedEntry() {
  return new Promise((resolve) => {
    const modal = dom.rankedEntryModal;
    if (!modal) { resolve(true); return; }
    const walletShort = connectedWallet ? `${connectedWallet.slice(0, 8)}…${connectedWallet.slice(-6)}` : 'No wallet';
    dom.rankedEntryWallet.textContent = walletShort;
    dom.rankedEntryNetwork.textContent = `${LITVM_LITEFORGE_NETWORK.name} · ${LITVM_LITEFORGE_NETWORK.chainId}`;
    dom.rankedEntryStatus.textContent = '';
    dom.rankedEntryStatus.dataset.state = '';

    // Chain guard: compare the connected chain (normalized) to the expected 4441.
    const expectedHex = LITVM_LITEFORGE_NETWORK.chainIdHex;
    const normalize = (id) => {
      if (id == null) return null;
      return typeof id === 'string' && id.startsWith('0x') ? parseInt(id, 16) : Number(id);
    };
    const onExpectedChain = !connectedChainId || normalize(connectedChainId) === LITVM_LITEFORGE_NETWORK.chainId;
    const guard = dom.rankedEntryChainGuard;
    if (onExpectedChain) {
      guard.hidden = true;
      dom.rankedEntryApprove.disabled = false;
    } else {
      guard.hidden = false;
      guard.replaceChildren();
      appendText(guard, 'strong', '⚠ Wrong network');
      appendText(guard, 'span', `Switch your wallet to ${LITVM_LITEFORGE_NETWORK.name} (${LITVM_LITEFORGE_NETWORK.chainId} / ${expectedHex}) to continue.`);
      const switchBtn = el('button', { className: 'pixel-button', type: 'button', textContent: 'Switch Network' });
      switchBtn.addEventListener('click', async () => {
        switchBtn.textContent = 'Switching…';
        const ok = await requestLiteForgeNetwork();
        if (ok) { guard.hidden = true; dom.rankedEntryApprove.disabled = false; }
        else switchBtn.textContent = 'Switch Network';
      });
      guard.append(switchBtn);
      dom.rankedEntryApprove.disabled = true;
    }

    modal.hidden = false;

    const cleanup = () => {
      modal.hidden = true;
      dom.rankedEntryApprove.removeEventListener('click', onApprove);
      dom.rankedEntryCancel.removeEventListener('click', onCancel);
    };
    const onCancel = () => { playSfxCue('menu-click', 0.04); cleanup(); resolve(false); };
    const onApprove = async () => {
      dom.rankedEntryApprove.disabled = true;
      dom.rankedEntryStatus.dataset.state = 'pending';
      if (SETTLEMENT_LIVE) {
        // LIVE: request the on-chain publish transaction signature here.
        dom.rankedEntryStatus.textContent = 'Confirm the zkLTC-gas transaction in your wallet to publish your run…';
        try {
          const provider = detectEthereumProvider();
          // Real publish tx (score/achievements/name -> ArcadePaymentRouter +
          // registries) would be submitted here. Deploy + wire contract address
          // before enabling SETTLEMENT_LIVE.
          await refreshInjectedChainId(provider);
          dom.rankedEntryStatus.textContent = '✓ Run published on-chain to LitVM.';
          dom.rankedEntryStatus.dataset.state = 'ok';
          setTimeout(() => { cleanup(); resolve(true); }, 500);
        } catch {
          dom.rankedEntryStatus.textContent = 'Signature rejected. Try again or cancel.';
          dom.rankedEntryStatus.dataset.state = 'error';
          dom.rankedEntryApprove.disabled = false;
        }
        return;
      }
      // SIMULATED (default): same UX, no real tx. Short "signing" beat.
      playSfxCue('wallet-connect', 0.05);
      dom.rankedEntryStatus.textContent = 'Signing zkLTC-gas transaction (testnet simulation)…';
      setTimeout(() => {
        dom.rankedEntryStatus.textContent = '✓ Run will publish to LitVM at game over (simulated). Starting ranked run.';
        dom.rankedEntryStatus.dataset.state = 'ok';
        setTimeout(() => { cleanup(); resolve(true); }, 550);
      }, 650);
    };
    dom.rankedEntryApprove.addEventListener('click', onApprove);
    dom.rankedEntryCancel.addEventListener('click', onCancel);
  });
}

async function beginOfficialLevel() {
  playSfxCue('level-start');
  if (!currentSession) await startOfficialMode(officialSelectedMode ?? 'free');
  setOfficialView('gameplay');

  // GameRegistry integration for shared profile (parent-account identity)
  const profile = await getSharedPlayerProfile(connectedWallet);
  console.log('[GameRegistry] Profile loaded for run:', profile.displayName);

  // Show cinematic loading screen with keyart + progress + level title
  await showHMHLoadingScreen(async () => {
    await startCombat();
    render();
  });
}


async function showHMHLoadingScreen(onComplete) {
  const bgUrl = HMH_LOADING_KEYARTS[Math.floor(Math.random() * HMH_LOADING_KEYARTS.length)];
  // Create loading overlay
  const overlay = document.createElement('div');
  overlay.id = 'hmhLoadingOverlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:99999;background:#0a0c14 url(${bgUrl}) center/cover no-repeat;display:flex;align-items:center;justify-content:center;flex-direction:column;`;
  
  // Progress bar container
  const barContainer = document.createElement('div');
  barContainer.style.cssText = 'width:60%;max-width:520px;height:12px;background:rgba(255,255,255,0.15);border:2px solid #ffe84d;border-radius:999px;overflow:hidden;margin-bottom:24px;';
  
  const bar = document.createElement('div');
  bar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#ffe84d,#fff);transition:width 80ms linear;';
  barContainer.appendChild(bar);
  
  // Status text
  const status = document.createElement('div');
  status.style.cssText = 'color:#ffe84d;font-family:monospace;font-size:15px;letter-spacing:2px;margin-bottom:12px;';
  status.textContent = 'INITIALIZING HARD MONEY HEROES...';
  
  overlay.append(barContainer, status);
  document.body.appendChild(overlay);
  
  // Simulate asset loading + world generation (2.5s)
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 4 + 1.5;
    if (progress > 100) progress = 100;
    bar.style.width = progress + '%';
    if (progress > 35) status.textContent = 'RENDERING DISTRICTS & ROAD NETWORK...';
    if (progress > 65) status.textContent = 'LOADING SPRITE SHEETS & ENEMIES...';
    if (progress > 85) status.textContent = 'PREPARING LEVEL 1...';
    if (progress >= 100) {
      clearInterval(interval);
      // Fade out keyart, show level title
      setTimeout(() => {
        overlay.style.transition = 'opacity 420ms ease';
        overlay.style.opacity = '0';
        
        // Create level title overlay
        const titleOverlay = document.createElement('div');
        titleOverlay.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(10,12,20,0.65);';
        
        const title = document.createElement('div');
        title.style.cssText = 'font-size:72px;font-weight:900;color:#fff;text-shadow:0 0 40px rgba(255,232,77,0.9), 4px 4px 0 #000;letter-spacing:4px;opacity:0;transform:translateY(30px);transition:all 520ms cubic-bezier(0.23,1,0.32,1);';
        title.textContent = 'LEVEL 1 — CRYPTO WASTELANDS';
        
        titleOverlay.appendChild(title);
        document.body.appendChild(titleOverlay);
        
        // Animate title in
        requestAnimationFrame(() => {
          title.style.opacity = '1';
          title.style.transform = 'translateY(0)';
        });
        
        // Hold for ~3s then fade out and start game
        setTimeout(() => {
          title.style.transition = 'all 480ms ease';
          title.style.opacity = '0';
          title.style.transform = 'translateY(-40px)';
          
          setTimeout(() => {
            titleOverlay.remove();
            overlay.remove();
            if (typeof onComplete === 'function') onComplete();
          }, 520);
        }, 2850);
      }, 180);
    }
  }, 85);
}


function detectEthereumProvider() {
  return globalThis.ethereum ?? null;
}

function connectMockWallet() {
  connectedWallet = MOCK_WALLET;
  // GameRegistry shared profile (parent-account identity) — fire and forget
  getSharedPlayerProfile(connectedWallet).then((profile) => {
    console.log('[GameRegistry] Loaded shared profile:', profile);
  });

  connectedChainId = null;
  walletConnector = 'mock-wallet';
  connectPlayerAccount(state, connectedWallet, { handle: 'Lester Pilot' });
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
  modal.innerHTML = `
    <div class="modal-content signout-modal">
      <h3>Sign Out</h3>
      <p>Are you sure you want to sign out? This will disconnect your wallet and return you to the Lester's Arcade homepage.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary signout-cancel">Cancel</button>
        <button class="btn btn-danger signout-confirm">Sign Out</button>
      </div>
    </div>
  `;
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

function executeSignOut() {
  playSfxCue('menu-click', 0.05);
  connectedWallet = null;
  connectedChainId = null;
  walletConnector = 'none';
  currentSession = null;
  officialAppStep = 'wallet-splash';
  render();
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
  if (connectedWallet && walletConnector === 'injected-evm') return connectedWallet;
  return connectMockWallet();
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
  const isPaid = mode === 'paid' || mode === 'ranked';
  const normalizedMode = mode === 'ranked' ? 'paid' : mode;
  let urlSessionId = null;
  let sequenceNumber = null;
  if (isPaid) {
    const allocated = nextGlobalSessionId(state);
    urlSessionId = allocated.urlSessionId;
    sequenceNumber = allocated.sequence;
  }
  return startPlaySession({
    wallet: connectedWallet ?? MOCK_WALLET,
    gameId: selectedGameId,
    mode: normalizedMode,
    urlSessionId,
    sequenceNumber,
  });
}

async function startMode(mode) {
  await ensureWalletConnected();
  const game = selectedGame();
  if (game.status !== 'playable') return;

  currentSession = beginTrackedSession({ mode });
  lastCompletedSession = null;
  lastRunResult = null;
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
  if (result.acceptedForGlobalLeaderboard && result.settlementInput) {
    settleRankedRun(result.settlementInput);
  }
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

function menuActionFor(item) {
  // Map each canonical menu option id to the runtime action it should trigger.
  switch (item.id) {
    case 'connect-wallet':
      return connectedWallet ? null : () => connectWallet();
    case 'free-run':
      return () => startOfficialMode('free');
    case 'paid-run':
      return connectedWallet ? () => startOfficialMode('paid') : null;
    case 'loadout':
    case 'leaderboard':
    case 'achievements':
    case 'sound-options':
    case 'accessibility':
      return () => focusMenuSectionPanel(item.id);
    default:
      return null;
  }
}

function focusMenuSectionPanel(itemId) {
  // Lightweight in-page navigation: scroll the matching panel into view and
  // flash it so the menu reads as a real navigation surface, not static cards.
  const anchors = {
    loadout: '#cartridgeRack',
    leaderboard: '#highScoreList',
    achievements: '#achievementList',
    'sound-options': '#arcadeMusicPlayer',
    accessibility: '#menuModelPanel',
  };
  const target = document.querySelector(anchors[itemId] ?? '#menuModelPanel');
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('menu-section-flash');
  window.setTimeout(() => target.classList.remove('menu-section-flash'), 900);
}

function renderMenuModel() {
  const model = buildLoginMenuModel({ connected: Boolean(connectedWallet), selectedGameId, wallet: connectedWallet });
  dom.menuModelPanel.replaceChildren();

  // Login status header card (non-interactive summary of parent account state).
  const login = el('article', { className: `menu-card login-status ${model.login.state}` });
  appendText(login, 'span', model.login.state === 'connected' ? 'PARENT ACCOUNT ONLINE' : 'GUEST MODE', 'menu-card-eyebrow');
  appendText(login, 'strong', model.login.primaryAction);
  appendText(login, 'span', model.login.walletShort ?? 'No wallet connected', 'menu-card-wallet');
  appendText(login, 'p', model.login.copy);
  dom.menuModelPanel.append(login);

  // Interactive, keyboard-navigable arcade menu buttons grouped by section.
  const sectionLabels = {
    login: 'ACCOUNT', play: 'PLAY', prep: 'PREP', scores: 'SCORES', profile: 'PROFILE', options: 'OPTIONS',
  };
  const navItems = model.menuItems.filter((item) => item.id !== 'connect-wallet' || !connectedWallet);
  let lastSection = null;
  for (const item of navItems) {
    if (item.section && item.section !== lastSection) {
      lastSection = item.section;
      appendText(dom.menuModelPanel, 'p', sectionLabels[item.section] ?? item.section.toUpperCase(), 'menu-section-label');
    }
    const action = menuActionFor(item);
    const interactive = Boolean(action) && !item.disabled;
    const card = el(interactive ? 'button' : 'article', {
      className: `menu-card menu-option ${item.disabled ? 'disabled' : ''} ${item.active ? 'active' : ''} ${interactive ? 'interactive' : ''}`.trim(),
    });
    if (interactive) {
      card.type = 'button';
      card.setAttribute('data-menu-action', item.id);
      card.addEventListener('mouseenter', () => playSfxCue('menu-click', 0.02));
      card.addEventListener('click', () => {
        playSfxCue('menu-click');
        action();
      });
    } else {
      card.setAttribute('aria-disabled', 'true');
    }
    appendText(card, 'strong', item.title);
    appendText(card, 'p', item.description);
    if (item.disabled) {
      const reason = item.id === 'paid-run' || (item.section === 'play' && !connectedWallet)
        ? 'Connect a wallet to unlock'
        : 'Available once Hard Money Heroes is playable';
      appendText(card, 'span', reason, 'menu-card-lock');
    } else if (interactive) {
      appendText(card, 'span', '▶', 'menu-card-cue');
    }
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
      appendText(item, 'span', `${entry.displayName ?? `${entry.wallet.slice(0, 6)}…${entry.wallet.slice(-4)}`} · ${formatSeconds(entry.runStats.elapsedSeconds ?? 0)} · boss ${entry.runStats.bossId ?? 'none'}`);
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
  combat.paused = false;
  combat.gameOver = false;
  combat.gameOverSubmitted = false;
  combat.gameOverReason = '';
  combat.startedAt = performance.now();
  combat.frame = 0;
  combat.elapsedGameSeconds = 0;
  combat.playerX = PLAYER_X;
  combat.playerY = GROUND_Y;
  combat.playerMapX = 0;
  combat.playerMapY = 0;
  combat.aimMapX = 1;
  combat.aimMapY = 0;
  combat.velocityX = 0;
  combat.velocityY = 0;
  combat.jumpsLeft = 2;
  combat.health = PLAYER_MAX_HEALTH;
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
  combat.enemyShots = [];
  combat.enemies = [];
  combat.particles = [];
  combat.floatingTexts = [];
  combat.powerUps = [];
  combat.powerUpTimers = { magnet: 0, slowEnemies: 0, berserk: 0 };
  // Power-up telegraph and animated spawns
  if (combat.powerUpSpawnTimer && combat.powerUpSpawnTimer < 15) {
    spawnSpriteParticle('powerup-telegraph', combat.nextPowerUpX || combat.playerX + 80, combat.nextPowerUpY || combat.playerY + 80, { color: '#fde047', size: 35, life: 15 });
  }

  combat.xpGems = [];
  combat.levelUpChoices = [];
  combat.levelUpPaused = false;
  combat.roguelikeRun = createRoguelikeRunState({ seed: Date.now(), mode: currentSession?.mode ?? 'free', characterId: combat.characterId });
  preloadHeroRoster(combat.characterId); // decode hurt/death/melee frames up front (no first-hit art pop)
  preloadWorldPropImages(); // decode all world-prop art up front (no scroll-in pop-in)
  
  // Generate macro-scale world structure: districts + a road/path network
  // connecting district centers, so the world reads as a planned place
  // (streets between blocks, trails between groves) instead of raw biome noise.
  const seed = combat.roguelikeRun.seed;
  const worldWidth = 2000;  // Large world for exploration
  const worldHeight = 2000;
  const districtGrid = generateDistrictGrid(seed, worldWidth, worldHeight);
  const roadNetwork = generateRoadNetwork(districtGrid.grid, districtGrid.macroCellsX, districtGrid.macroCellsY, seed);

  // Store in combat for runtime access (rendering, spawning, etc.)
  combat.districtGrid = districtGrid.grid;
  combat.macroCellsX = districtGrid.macroCellsX;
  combat.macroCellsY = districtGrid.macroCellsY;
  combat.roadNetwork = roadNetwork;
  combat.worldWidth = worldWidth;
  combat.worldHeight = worldHeight;
  // Index road tiles for O(1) per-tile lookups during rendering. The generator
  // anchors its grid at (0,0)..(2000,2000) but the hero spawns at world (0,0),
  // so shift everything by half the world to center the network on the player.
  // Biome (and therefore road style / bridge-vs-road) is re-sampled at the
  // SHIFTED coordinate so the visuals always match the actual ground there.
  combat.roadTileIndex = buildRoadTileIndex(roadNetwork, seed, worldWidth / 2, worldHeight / 2);
  _themeCellCache.clear(); // theme cache key is seed-less; reset per run
  combat.roguelikeSpawnTimer = 0;
  combat.props = [];
  combat.hazards = [];
  combat.platforms = [];
  combat.powerUpsCollected = 0;
  combat.collectedPowerUpTypes = new Set();
  // Throwables start scarce and are found as map pickups: 2 grenades + 6 axes.
  combat.grenades = currentSession?.isPaid ? 2 : 2;
  combat.axes = 6;
  combat.weaponId = 'coin-blaster';
  // Clip/reload model: each weapon has a clip; auto-fire empties it, then a timed
  // auto-reload refills it. The starter pistol begins fully loaded.
  const startWeapon = weaponById(combat.weaponId);
  combat.clipSize = startWeapon.clip ?? 8;
  combat.clip = combat.clipSize;
  combat.ammo = combat.clip; // legacy mirror used by older HUD/snapshot paths
  combat.reloading = false;
  combat.reloadRemaining = 0;
  combat.shots = 0;
  combat.meleeSwings = 0;
  combat.lastMeleeFrame = -999;
  combat.boss = null;
  combat.bossDefeated = false;
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

  combat.status = 'Isometric roguelike run live: survive 20 minutes, kite enemy swarms, collect XP, and pause only for level-up augments.';
  playSfxCue('level-start');
  await startArcadeMusicForGame('hard-money-heroes');
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
      return;
    }
    combat.ammo -= 1;
  }
  combat.shots += 1;
  playSfxCue('weapon-fire', weapon.id === 'hash-rail' ? 0.045 : 0.035);
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
  combat.lastMeleeFrame = combat.frame;
  playSfxCue('melee');
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
  for (const prop of combat.props) {
    if (propBlocksShot(prop) && rectsOverlap(meleeBox, propHitbox(prop))) {
      damageProp(prop, LESTER_BLASTER_WEAPON_SYSTEM.melee.damage, 'knife');
    }
  }
  const bossBox = bossHitbox();
  if (bossBox && rectsOverlap(meleeBox, bossBox)) damageBoss(LESTER_BLASTER_WEAPON_SYSTEM.melee.damage, 'knife');
}

function grenade() {
  // Manual throwable (the player's only manual action in the roguelike). Throws a
  // grenade first (bigger blast), then a throwing axe when grenades run out.
  // Both are scarce and replenished by map ammo pickups.
  const hasGrenade = (combat.grenades ?? 0) > 0;
  const hasAxe = (combat.axes ?? 0) > 0;
  if (!hasGrenade && !hasAxe) {
    spawnText('NO THROWABLES', combat.playerX + 20, combat.playerY - 80, '#ff476f');
    return;
  }
  const throwingAxe = !hasGrenade && hasAxe;
  if (throwingAxe) combat.axes -= 1; else combat.grenades -= 1;
  playSfxCue('grenade', throwingAxe ? 0.05 : 0.075);

  if (combat.roguelikeRun) {
    // Map-space blast centered slightly ahead of the hero along the aim vector.
    const cx = combat.playerMapX + combat.aimMapX * 1.4;
    const cy = combat.playerMapY + combat.aimMapY * 1.4;
    const radius = throwingAxe ? 1.1 : 2.0; // map tiles
    const dmg = (throwingAxe ? 22 : 34) * (combat.roguelikeRun?.stats.grenadeDamage ?? 1);
    for (const enemy of combat.enemies) {
      if (enemy.hp <= 0) continue;
      const d = Math.hypot(enemy.mapX - cx, enemy.mapY - cy);
      if (d <= radius) damageEnemy(enemy, dmg * (throwingAxe ? 1 : (1 - d / (radius + 0.5))) + (throwingAxe ? 0 : dmg * 0.4), throwingAxe ? 'axe' : 'grenade');
    }
    if (combat.boss && combat.boss.hp > 0) {
      const d = Math.hypot((combat.boss.mapX ?? cx) - cx, (combat.boss.mapY ?? cy) - cy);
      if (d <= radius + 1) damageBoss(throwingAxe ? 26 : 40, throwingAxe ? 'axe' : 'grenade');
    }
    const burst = isoToScreen(cx, cy);
    spawnExplosion(burst.x, burst.y, throwingAxe ? '#c9d6ff' : '#ff7b2f');
    spawnText(throwingAxe ? '🪓' : '💥', burst.x, burst.y - 30, throwingAxe ? '#c9d6ff' : '#ff7b2f');
    return;
  }

  // Legacy side-scroller fallback.
  const blastBox = { x: combat.playerX + 52, y: GROUND_Y - 154, w: 304, h: 166 };
  for (const enemy of combat.enemies) {
    if (rectsOverlap(blastBox, enemyHitbox(enemy))) damageEnemy(enemy, throwingAxe ? 14 : 18, throwingAxe ? 'axe' : 'grenade');
  }
  const bossBox = bossHitbox();
  if (bossBox && rectsOverlap(blastBox, bossBox)) damageBoss(throwingAxe ? 18 : 24, throwingAxe ? 'axe' : 'grenade');
  spawnExplosion(combat.playerX + 210, GROUND_Y - 35, throwingAxe ? '#c9d6ff' : '#ff7b2f');
}

function dropPowerUp() {
  const powerUp = LESTER_BLASTER_POWER_UPS[(combat.frame + combat.powerUps.length) % LESTER_BLASTER_POWER_UPS.length];
  combat.powerUps.push({ ...powerUp, x: combat.playerX + 220, y: GROUND_Y - 38, vy: -3, ttl: 480 });
  playSfxCue('pickup', 0.025);
  spawnText(powerUp.title, combat.playerX + 210, GROUND_Y - 74, '#ffe84d');
}

function reload() {
  const weapon = weaponById(combat.weaponId);
  if (weapon.ammo === 'infinite') return;
  combat.ammo = weapon.ammo;
  playSfxCue('menu-click', 0.025);
  spawnText('RELOAD', combat.playerX + 20, combat.playerY - 80, '#45ff8a');
}

function moveStageObjects(scrollDelta) {
  if (!scrollDelta) return;
  const multiplier = LESTER_BLASTER_TACTICAL_CAMERA_MODEL.objectScrollMultiplier;
  for (const prop of combat.props) prop.x -= scrollDelta * multiplier;
  for (const platform of combat.platforms) platform.x -= scrollDelta * multiplier;
  for (const power of combat.powerUps) power.x -= scrollDelta * 0.28;
}

function applyPlayerLedCameraMovement(playerSpeed) {
  const inputDirection = (combat.keys.has('d') || combat.keys.has('arrowright') ? 1 : 0)
    - (combat.keys.has('a') || combat.keys.has('arrowleft') ? 1 : 0);
  if (!inputDirection) {
    combat.scrollSpeed += (0 - combat.scrollSpeed) * 0.22;
    return;
  }

  const previousScroll = combat.scroll;
  const result = advanceTacticalCameraModel({
    playerX: combat.playerX,
    scroll: combat.scroll,
    furthestScroll: combat.furthestScroll,
    inputDirection,
    stagePhase: combat.stagePhase,
    scrollLocked: Boolean(combat.scrollLockReason),
    speed: playerSpeed,
  });
  combat.playerX = result.playerX;
  combat.scroll = result.scroll;
  combat.furthestScroll = result.furthestScroll;
  combat.scrollSpeed = result.scrollDelta;
  if (result.scrollDelta > 0) {
    combat.stageTravel += result.scrollDelta;
    moveStageObjects(result.scrollDelta);
  } else if (result.scroll !== previousScroll) {
    moveStageObjects(result.scroll - previousScroll);
  }
}

function updatePlatformingAndProps() {
  const playerBox = playerHitbox();
  let landedOnPlatform = false;
  for (const platform of combat.platforms) {
    const platformBox = { x: platform.x, y: platform.y - 2, w: platform.w, h: platform.h + 6 };
    const feet = { x: playerBox.x + 4, y: playerBox.y + playerBox.h - 4, w: playerBox.w - 8, h: 10 };
    if (combat.velocityY >= 0 && rectsOverlap(feet, platformBox) && combat.playerY <= platform.y + 8) {
      combat.playerY = platform.y;
      combat.velocityY = 0;
      combat.jumpsLeft = 2;
      landedOnPlatform = true;
    }
  }
  if (!landedOnPlatform && combat.playerY < GROUND_Y) {
    // Gravity in updateCombatStep handles the fall; this branch is intentionally empty for readability.
  }

  for (const prop of combat.props) {
    if (prop.hp !== undefined && prop.hp <= 0) continue;
    const box = propHitbox(prop);
    if (prop.kind === 'gap') {
      const grounded = combat.playerY >= GROUND_Y - 2;
      if (grounded && rectsOverlap({ ...playerBox, y: GROUND_Y + 2, h: 14 }, box)) {
        damagePlayer(prop.damage ?? NORMAL_HIT_DAMAGE, 'gap');
        combat.velocityY = -8;
        combat.playerX = Math.max(62, combat.playerX - 18);
        spawnText('JUMP THE GAP', combat.playerX + 20, combat.playerY - 90, '#ffe84d');
      }
      continue;
    }
    if (['wall', 'barrel'].includes(prop.kind) && rectsOverlap(playerBox, box)) {
      damagePlayer(NORMAL_HIT_DAMAGE, prop.kind);
      combat.playerX = Math.max(62, prop.x - 48);
      damageProp(prop, prop.kind === 'barrel' ? 4 : 1, 'body-check');
    }
  }
  combat.props = combat.props.filter((prop) => prop.kind === 'gap' ? prop.x > -120 : prop.x > -120 && (prop.hp === undefined || prop.hp > 0));
  combat.platforms = combat.platforms.filter((platform) => platform.x + platform.w > -80);
  combat.hazards = combat.props.filter((prop) => prop.kind === 'gap');
}

function updateStageDirector() {
  if (combat.paused || combat.gameOver) return;
  if (combat.stagePhase === 'travel') {
    combat.scrollSpeed += (0 - combat.scrollSpeed) * 0.12;
    if (combat.stageTravel >= combat.stageTravelGoal) beginStageEngagement();
    return;
  }

  combat.scrollSpeed += (0 - combat.scrollSpeed) * 0.18;
  combat.scroll += combat.scrollSpeed;
  moveStageObjects(combat.scrollSpeed);

  if (combat.stagePhase === 'boss') return;

  const cap = enemyCapForStage();
  const liveStageEnemies = combat.enemies.filter((enemy) => enemy.stageIndex === combat.stageIndex).length;
  if (combat.waveSpawnQueue > 0 && liveStageEnemies < cap && combat.frame >= combat.nextWaveSpawnFrame) {
    const role = (combat.stageIndex + combat.waveIndex + combat.waveEnemiesSpawned) % 3 === 0
      ? 'aggressive-melee-rusher'
      : 'cover-shooter';
    const spawned = spawnEnemy({ role, stageIndex: combat.stageIndex });
    if (spawned) {
      combat.waveSpawnQueue -= 1;
      combat.waveEnemiesSpawned += 1;
      combat.nextWaveSpawnFrame = combat.frame + LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning.enemySpawnDelayFrames;
    }
  }

  if (combat.waveSpawnQueue <= 0 && combat.enemies.filter((enemy) => enemy.stageIndex === combat.stageIndex).length === 0) {
    if (combat.waveIndex < combat.wavesThisStage) startNextWave();
    else completeStage();
  }
}

function updateCombatStep(stepMs) {
  if (!combat.active || combat.paused || combat.gameOver) {
    updateParticles(stepMs / 1000);
    updateFloatingTexts();
    return;
  }
  const dt = stepMs / 1000;
  combat.frame += 1;
  combat.elapsedGameSeconds += dt;
  combat.noDamageSeconds += dt;
  combat.invulnerableFrames = Math.max(0, combat.invulnerableFrames - 1);

  combat.crouching = combat.keys.has('control') || combat.keys.has('s') || combat.keys.has('arrowdown');
  combat.crouchFrames = combat.crouching ? combat.crouchFrames + 1 : 0;
  const playerSpeed = combat.crouching ? 1.65 : 3.1;
  applyPlayerLedCameraMovement(playerSpeed);

  combat.velocityY += 0.72;
  combat.playerY = Math.min(GROUND_Y, combat.playerY + combat.velocityY);
  if (combat.playerY >= GROUND_Y) {
    combat.jumpsLeft = 2;
    combat.velocityY = 0;
  }

  const difficulty = getLesterBlasterDifficultyAt(combat.elapsedGameSeconds);
  if (combat.roguelikeRun) {
    updateRoguelikeCombatStep(dt, difficulty);
    if (combat.frame % 30 === 0) {
      renderCombatSandboxStatus();
      syncCombatOverlay();
    }
    return;
  }
  updateStageDirector();
  updatePlatformingAndProps();
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
  combat.score = Math.round(scoreModel.total);
  if (combat.frame % 30 === 0) {
    renderCombatSandboxStatus();
    syncCombatOverlay();
  }
}

function spawnEnemy(options = {}) {
  const cap = enemyCapForStage(options.stageIndex ?? combat.stageIndex);
  const liveStageEnemies = combat.enemies.filter((enemy) => enemy.stageIndex === (options.stageIndex ?? combat.stageIndex)).length;
  if (liveStageEnemies >= cap) return null;
  const spawn = chooseEnemySpawn({ elapsedSeconds: combat.elapsedGameSeconds, seed: combat.frame + combat.kills + combat.waveEnemiesSpawned });
  const tacticalRoomTuning = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning;
  const role = options.role ?? (spawn.ai?.aggression > 1.2 ? 'aggressive-melee-rusher' : 'cover-shooter');
  const flying = spawn.enemy.class?.includes('flying');
  const laneOffset = flying ? 70 : (combat.waveEnemiesSpawned % 3) * 8;
  const targetCover = combat.props.find((prop) => prop.cover && prop.x > 360)?.x ?? (500 + (combat.waveEnemiesSpawned % 2) * 90);
  const enemy = {
    ...spawn.enemy,
    x: 820 + combat.waveEnemiesSpawned * 22,
    y: flying ? GROUND_Y - 52 - laneOffset : GROUND_Y - laneOffset,
    hp: Math.max(12, Math.round(spawn.scaledHealth * 0.72)),
    maxHp: Math.max(12, Math.round(spawn.scaledHealth * 0.72)),
    attackTimer: role === 'aggressive-melee-rusher'
      ? Math.max(82, Math.round(tacticalRoomTuning.rangedShotCooldownFrames * 0.72))
      : tacticalRoomTuning.rangedShotCooldownFrames + (combat.frame % 34),
    tellFrames: 0,
    ai: spawn.ai,
    role,
    state: role === 'cover-shooter' ? 'seeking-cover' : 'rushing',
    targetCoverX: targetCover - 26,
    damage: NORMAL_HIT_DAMAGE,
    score: spawn.enemy.score,
    miniBoss: false,
    stageIndex: options.stageIndex ?? combat.stageIndex,
  };
  combat.enemies.push(enemy);
  return enemy;
}

function spawnMiniBoss() {
  if (combat.boss || combat.enemies.some((enemy) => enemy.miniBoss && enemy.stageIndex === combat.stageIndex)) return null;
  combat.miniBossLock = true;
  combat.scrollLockReason = `MINI-BOSS LOCK // clear Stage ${combat.stageIndex} captain`;
  const enemy = {
    id: 'dock-loader-mech',
    title: 'Dock Loader Mini-Boss',
    class: 'mini-boss',
    x: 735,
    y: GROUND_Y,
    hp: 115 + combat.stageIndex * 4,
    maxHp: 115 + combat.stageIndex * 4,
    attackPatterns: ['forklift-charge', 'crate-lob', 'ground-pound'],
    deathEffect: 'huge orange explosion + loader parts',
    ai: { aggression: 1.7, fairnessTell: 'loader horn flash' },
    role: 'armored-pressure',
    state: 'pressure',
    attackTimer: 122,
    tellFrames: 0,
    damage: NORMAL_HIT_DAMAGE,
    score: 900,
    miniBoss: true,
    stageIndex: combat.stageIndex,
  };
  combat.enemies.push(enemy);
  spawnText('MINI-BOSS LOCK', 300, 110, '#ff476f');
  return enemy;
}

function spawnBoss(bossData) {
  const canonicalBoss = LESTER_BLASTER_BOSS_SYSTEM.bosses.find((boss) => boss.id === bossData.id) ?? bossData;
  combat.boss = {
    ...bossData,
    x: 650,
    hp: 280,
    maxHp: 280,
    phase: 1,
    lastPhase: 1,
    attackTimer: 124,
    patterns: canonicalBoss.attackPatterns ?? [],
    superMoves: canonicalBoss.superMoves ?? [],
    stageIndex: combat.stageIndex,
  };
  combat.stagePhase = 'boss';
  combat.miniBossLock = true;
  combat.scrollLockReason = `BOSS LOCK // defeat ${bossData.title}`;
  lastBossId = bossData.id;
  spawnText(`BOSS: ${bossData.title}`, 280, 95, '#ffe84d');
  syncCombatOverlay();
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
    const blockingProp = combat.props.find((prop) => propBlocksShot(prop) && rectsOverlap(bulletBox, propHitbox(prop)));
    if (blockingProp) {
      damageProp(blockingProp, Math.max(2, bullet.damage), bullet.weaponId);
      bullet.ttl = 0;
      continue;
    }
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
    const shotBox = enemyShotHitbox(shot);
    const coverProp = combat.props.find((prop) => propBlocksShot(prop) && rectsOverlap(shotBox, propHitbox(prop)));
    if (coverProp) {
      damageProp(coverProp, Math.max(1, shot.damage), 'enemy-shot');
      shot.ttl = 0;
      continue;
    }
    const crouchCover = playerCoverProp();
    if (crouchCover && shot.x <= crouchCover.x + crouchCover.w + 8 && shot.x >= crouchCover.x - 18) {
      damageProp(crouchCover, Math.max(1, shot.damage), 'cover-block');
      spawnText('COVER BLOCK', crouchCover.x - 6, crouchCover.y - 16, '#19f7ff');
      shot.ttl = 0;
      continue;
    }
    if (combat.invulnerableFrames <= 0 && rectsOverlap(shotBox, playerBox)) {
      damagePlayer(shot.damage, 'enemy-shot');
      shot.ttl = 0;
    }
  }
  combat.bullets = combat.bullets.filter((bullet) => bullet.x < 840 && bullet.ttl > 0);
  combat.enemyShots = combat.enemyShots.filter((shot) => shot.x > -40 && shot.ttl > 0);
}

function updateEnemies(difficulty) {
  const playerBox = playerHitbox();
  const tacticalRoomTuning = LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning;
  for (const enemy of combat.enemies) {
    if (enemy.hitFlash > 0) enemy.hitFlash -= 1;
    const enemyBox = enemyHitbox(enemy);
    const distanceToPlayer = enemy.x - (combat.playerX + playerBox.w);
    const isFlying = enemy.class?.includes('flying');
    const baseSpeed = enemy.miniBoss ? 0.24 : (enemy.speed ?? 1) * (enemy.role === 'aggressive-melee-rusher' ? 1.18 : 0.55);

    if (enemy.miniBoss) {
      if (enemy.x > 560) enemy.x -= baseSpeed;
      enemy.attackTimer -= 1;
      if (enemy.attackTimer < 24) enemy.tellFrames = 24 - enemy.attackTimer;
      if (enemy.attackTimer <= 0) {
        combat.enemyShots.push({ x: enemy.x - 8, y: enemy.y - 42, vx: 2.3, vy: 0, damage: NORMAL_HIT_DAMAGE, ttl: 180 });
        if (distanceToPlayer < 92 && combat.invulnerableFrames <= 0) damagePlayer(NORMAL_HIT_DAMAGE, 'mini-boss-melee');
        enemy.attackTimer = 150;
        enemy.tellFrames = 0;
      }
    } else if (enemy.role === 'aggressive-melee-rusher') {
      enemy.state = distanceToPlayer > 46 ? 'rushing' : 'melee-tell';
      if (distanceToPlayer > 46) enemy.x -= baseSpeed + difficulty.enemyAiLevel * 0.015;
      enemy.attackTimer -= 1;
      if (distanceToPlayer <= 58 && enemy.attackTimer <= 28) enemy.tellFrames = 28 - enemy.attackTimer;
      if (distanceToPlayer <= 58 && enemy.attackTimer <= 0) {
        if (combat.invulnerableFrames <= 0 && rectsOverlap(enemyBox, playerHitbox())) damagePlayer(NORMAL_HIT_DAMAGE, 'enemy-melee');
        enemy.attackTimer = Math.max(118, Math.round(tacticalRoomTuning.rangedShotCooldownFrames * 0.9));
        enemy.tellFrames = 0;
      }
    } else {
      const targetX = enemy.targetCoverX ?? 520;
      if (enemy.x > targetX) {
        enemy.state = 'seeking-cover';
        enemy.x -= baseSpeed;
      } else {
        enemy.state = 'in-cover';
        enemy.x += Math.sin((combat.frame + enemy.x) * 0.04) * 0.12;
      }
      if (isFlying) enemy.y += Math.sin((combat.frame + enemy.x) * 0.035) * 0.45;
      enemy.attackTimer -= 1;
      if (enemy.attackTimer <= 28) enemy.tellFrames = 28 - enemy.attackTimer;
      if (enemy.attackTimer <= 0) {
        combat.enemyShots.push({
          x: enemy.x - 6,
          y: enemy.y - (isFlying ? 22 : 35),
          vx: 2.15 * Math.max(0.85, difficulty.enemyProjectileSpeedMultiplier),
          vy: isFlying ? 0.08 : 0,
          damage: NORMAL_HIT_DAMAGE,
          ttl: 190,
        });
        enemy.attackTimer = tacticalRoomTuning.rangedShotCooldownFrames + (enemy.stageIndex % 3) * 18;
        enemy.tellFrames = 0;
      }
    }

    if (!enemy.miniBoss && enemy.x < -80) enemy.hp = 0;
  }

  for (const enemy of combat.enemies.filter((enemy) => enemy.hp <= 0)) {
    killEnemy(enemy);
  }
  combat.enemies = combat.enemies.filter((enemy) => enemy.hp > 0 && enemy.x > -120);
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
  if (combat.invulnerableFrames <= 0 && rectsOverlap(bossHitbox(), playerHitbox())) damagePlayer(NORMAL_HIT_DAMAGE, 'boss-contact');
  if (combat.boss.attackTimer <= 0) {
    const pattern = combat.boss.patterns[(combat.frame + combat.boss.phase) % combat.boss.patterns.length] ?? 'ranged-burst';
    const superMove = combat.boss.phase >= 2 && combat.frame % 3 === 0
      ? combat.boss.superMoves[(combat.frame + combat.boss.phase) % combat.boss.superMoves.length]
      : null;
    const shots = superMove ? 5 + combat.boss.phase : pattern.includes('sweep') || pattern.includes('bullet') ? 4 : 2 + combat.boss.phase;
    for (let i = 0; i < shots; i += 1) {
      combat.enemyShots.push({
        x: combat.boss.x + 8,
        y: GROUND_Y - 82 + (i - shots / 2) * (superMove ? 10 : 13),
        vx: 2.35 + combat.boss.phase * 0.18,
        vy: (i - shots / 2) * (superMove ? 0.14 : 0.08),
        damage: NORMAL_HIT_DAMAGE,
        ttl: superMove ? 220 : 190,
      });
    }
    if (superMove) spawnText(`SUPER: ${superMove}`, combat.boss.x - 44, GROUND_Y - 132, '#ffe84d');
    if (combat.boss.phase === 3) spawnExplosion(combat.boss.x + 42, GROUND_Y - 55, '#ff236d');
    combat.boss.attackTimer = Math.max(78, 150 - combat.boss.phase * 14);
  }
  if (combat.boss.hp <= 0) {
    const clearedBoss = combat.boss;
    spawnExplosion(combat.boss.x + 40, GROUND_Y - 60, '#ffe84d');
    spawnText('BOSS CLEAR +1500', combat.boss.x - 30, GROUND_Y - 140, '#45ff8a');
    combat.kills += 1;
    combat.bossKills += 1;
    combat.killsByType[`boss:${clearedBoss.id ?? 'boss'}`] = (combat.killsByType[`boss:${clearedBoss.id ?? 'boss'}`] ?? 0) + 1;
    combat.combo += 1;
    combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
    combat.boss = null;
    combat.bossDefeated = true;
    dropPowerUp();
    if (isFinalBossStage()) completeStage();
    else releaseScrollLock(`${clearedBoss.title} defeated`);
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
    text.y += (text.vy ?? -0.7);
    text.life -= 1;
  }
  combat.floatingTexts = combat.floatingTexts.filter((text) => text.life > 0);
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
  const type = currentDamageType();
  const result = computeDamage({
    source: source === 'knife' ? 'melee' : (source ?? 'bullet'),
    type,
    stats: { ...stats, damage: 1 }, // base already scaled by caller; only roll crit/type here
    enemyArmored: false,
    rng: Math.random,
  });
  // Scale the caller's flat damage by crit/type multiplier ratio.
  const ratio = result.amount / Math.max(1, Math.round(DAMAGE_BASE_FOR(source)));
  const finalDamage = Math.max(1, Math.round(baseDamage * (result.crit ? (1.75 + (stats.critMultiplierBonus ?? 0)) : 1)));
  return { finalDamage, crit: result.crit, type, color: result.color, label: result.crit ? `${finalDamage}!` : `${finalDamage}` };
}

function DAMAGE_BASE_FOR(source) {
  const map = { bullet: 6, 'hash-rail': 9, knife: 11, melee: 11, grenade: 16, axe: 14, explosion: 16 };
  return map[source] ?? 6;
}

function damageEnemy(enemy, damage, source, opts = {}) {
  const present = opts.crit !== undefined ? opts : rollHitPresentation(damage, source);
  const applied = present.finalDamage ?? damage;
  enemy.hp -= applied;
  enemy.hitFlash = 6; // frames of white flash so EVERY enemy shows hit feedback
  combat.combo += 1;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  combat.damageCombo += applied;
  combat.maxDamageCombo = Math.max(combat.maxDamageCombo, combat.damageCombo);
  playSfxCue('enemy-hit', 0.035);
  spawnBlood(enemy.x + 12, enemy.y - 30, source === 'knife' ? '#ff1f4f' : '#ff7b2f');
  spawnDamageNumber(present.label ?? `${Math.round(applied)}`, enemy.x + 12, enemy.y - 40, present.color ?? '#ffe84d', Boolean(present.crit));
}

function damageBoss(damage, source, opts = {}) {
  const present = opts.crit !== undefined ? opts : rollHitPresentation(damage, source);
  const applied = present.finalDamage ?? damage;
  combat.boss.hp -= applied;
  combat.combo += 1;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  combat.damageCombo += applied;
  combat.maxDamageCombo = Math.max(combat.maxDamageCombo, combat.damageCombo);
  playSfxCue('boss-warning', 0.035);
  spawnBlood(combat.boss.x + 40, GROUND_Y - 70, source === 'hash-rail' ? '#19f7ff' : '#ff236d');
  spawnDamageNumber(present.label ?? `${Math.round(applied)}`, combat.boss.x + 40, GROUND_Y - 84, present.color ?? '#ffe84d', Boolean(present.crit));
}

function damagePlayer(damage, source = 'hit') {
  if (combat.invulnerableFrames > 0 || damage <= 0 || combat.gameOver) return false;
  const armorScale = combat.roguelikeRun ? Math.max(1, combat.roguelikeRun.stats.armor ?? 1) : 1;
  const applied = Math.max(1, Math.round((Number(damage) || NORMAL_HIT_DAMAGE) / armorScale));
  combat.health = clamp(combat.health - applied, 0, PLAYER_MAX_HEALTH);
  combat.combo = 0;
  combat.damageCombo = 0;
  combat.noDamageSeconds = 0;
  combat.invulnerableFrames = LESTER_BLASTER_TACTICAL_COMBAT_V2.health.invulnerabilityAfterHitFrames;
  playSfxCue('player-hit', 0.06);
  spawnText(`-${applied}% HP`, combat.playerX, combat.playerY - 80, '#ff476f');
  spawnBlood(combat.playerX + 12, combat.playerY - 40, '#ff476f');
  if (source === 'enemy-melee') spawnText('MELEE HIT', combat.playerX + 24, combat.playerY - 96, '#ffe84d');
  if (combat.health <= LESTER_BLASTER_TACTICAL_COMBAT_V2.health.deathAtPercent) {
    combat.health = 0;
    combat.lives = 0;
    combat.active = false;
    combat.paused = false;
    combat.gameOver = true;
    combat.gameOverReason = currentSession?.isPaid
      ? 'Lester was defeated. Ranked run ended; submit only from game-over, and Play Again requires a new testnet credit.'
      : 'Lester was defeated. Free practice can restart from the beginning at no cost.';
    dom.combatRunStatus.textContent = 'Local combat sandbox game over';
    dom.combatStatus.textContent = `Game Over: ${combat.score.toLocaleString()} score, ${combat.kills} kills, ${formatSeconds(combat.elapsedGameSeconds)} survived. Official paid-run state remains separated until explicit game-over submission.`;
    playSfxCue('game-over', 0.08);
    ensureCombatMusic('game-over');
    syncCombatOverlay();
  }
  return true;
}

function killEnemy(enemy) {
  combat.kills += 1;
  combat.stagedEnemiesDefeated += enemy.stageIndex === combat.stageIndex ? 1 : 0;
  combat.combo += 2;
  combat.maxCombo = Math.max(combat.maxCombo, combat.combo);
  spawnText(`+${enemy.score ?? 100}`, enemy.x, enemy.y - 70, '#ffe84d');
  spawnExplosion(enemy.x + 12, enemy.y - 28, enemy.miniBoss ? '#ff7b2f' : '#ff476f');
  // Legacy side-scroller miniboss drop. In the isometric roguelike, power-up
  // drops are handled by dropRoguelikePowerUp() in updateRoguelikeEnemies()
  // (world-coordinate pickups), so skip the screen-space legacy drop there.
  if (enemy.miniBoss && !combat.roguelikeRun) dropPowerUp();
}

function collectCombatPowerUp(power) {
  combat.powerUpsCollected += 1;
  combat.collectedPowerUpTypes.add(power.id ?? power.effect ?? power.title);
  if (power.effect === 'heal') combat.health = Math.min(PLAYER_MAX_HEALTH, combat.health + power.amount);
  if (power.effect === 'grenades') combat.grenades += power.amount;
  if (power.effect === 'axes') combat.axes = (combat.axes ?? 0) + power.amount;
  if (power.effect === 'life') combat.health = Math.min(PLAYER_MAX_HEALTH, combat.health + 25);
  if (power.effect === 'weapon') {
    combat.weaponId = power.weaponId;
    const weapon = weaponById(power.weaponId);
    // Swapping weapons loads a fresh full clip and cancels any in-progress reload.
    combat.clipSize = weapon.clip ?? (Number.isFinite(weapon.ammo) ? weapon.ammo : 8);
    combat.clip = combat.clipSize;
    combat.ammo = combat.clip;
    combat.reloading = false;
    combat.reloadRemaining = 0;
  }
  // Ammo pickup tops the current clip back up (capped at clip size) and clears reload.
  if (power.effect === 'ammo') {
    combat.clip = Math.min(combat.clipSize ?? combat.clip, (combat.clip ?? 0) + (power.amount ?? combat.clipSize ?? 8));
    combat.ammo = combat.clip;
    combat.reloading = false;
    combat.reloadRemaining = 0;
  }
  if (power.effect === 'shield') {
    combat.health = Math.min(PLAYER_MAX_HEALTH, combat.health + power.amount * 15);
    combat.invulnerableFrames = Math.max(combat.invulnerableFrames, 180);
  }
  if (power.effect === 'scoreMultiplier') spawnText('2X SCORE', power.x, power.y - 20, '#ffe84d');
  playSfxCue('pickup', 0.055);
  spawnText(power.title, power.x, power.y - 28, '#45ff8a');
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

function spawnMuzzleFlash(x, y, weaponId) {
  spawnSpriteParticle('muzzle-flash', x, y, {
    vx: 1.2,
    vy: -0.2,
    color: weaponId === 'hash-rail' ? '#19f7ff' : '#ffe84d',
    size: weaponId === 'scatter-shotgun' ? 68 : 54,
    life: 0.26,
  });
  for (let i = 0; i < 3; i += 1) combat.particles.push({ type: 'impact-sparks', x: x - 8, y: y + 5, vx: -1 - i * 0.2, vy: 1 + i * 0.15, color: '#c78c48', size: 18, life: 0.55, maxLife: 0.55 });
}

function spawnSlash(x, y) {
  for (let i = 0; i < 7; i += 1) combat.particles.push({ type: 'impact-sparks', x: x + i * 4, y: y - i * 2, vx: 1.4, vy: -0.4, color: i % 2 ? '#f9f7ff' : '#ff7b2f', size: 28, life: 0.25, maxLife: 0.25 });
}

function spawnBlood(x, y, color) {
  if (gameSettings.screenShake) combat.shake = Math.min(7, (combat.shake ?? 0) + 1.6);
  if (!gameSettings.gore) return; // gore toggle: skip blood splatter when off
  spawnFxImage('blood', x, y, 54, 0.38);
  for (let i = 0; i < 9; i += 1) combat.particles.push({ type: 'impact-sparks', x, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3, color, size: 18 + Math.random() * 18, life: 0.65 + Math.random() * 0.3, maxLife: 0.95 });
}

function spawnExplosion(x, y, color) {
  if (gameSettings.screenShake) combat.shake = Math.min(12, (combat.shake ?? 0) + 6);
  spawnFxImage('fireball', x, y, 96, 0.5);
  spawnFxImage('shockwave', x, y, 120, 0.42);
  spawnSpriteParticle('level-up-burst', x, y, { color, size: 112, life: 0.72 });
  for (let i = 0; i < 12; i += 1) combat.particles.push({ type: 'impact-sparks', x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.7) * 5, color: i % 3 ? color : '#f9f7ff', size: 22 + Math.random() * 20, life: 0.8 + Math.random() * 0.35, maxLife: 1.15 });
}

function spawnText(text, x, y, color) {
  combat.floatingTexts.push({ text, x, y, color, life: 70 });
}

// Floating combat damage number with crit emphasis (bigger, longer-lived).
function spawnDamageNumber(text, x, y, color, crit = false) {
  combat.floatingTexts.push({
    text,
    x: x + (Math.random() - 0.5) * 10,
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

function screenToIso(screenX, screenY) {
  const cx = combat.viewCenterX ?? ISO_CENTER_X;
  const cy = combat.viewCenterY ?? ISO_CENTER_Y;
  const dx = (screenX - cx) / (ISO_TILE_WIDTH / 2);
  const dy = (screenY - cy) / (ISO_TILE_HEIGHT / 2);
  return {
    x: combat.playerMapX + (dx + dy) / 2,
    y: combat.playerMapY + (dy - dx) / 2,
  };
}

function syncProjectedPlayerPosition() {
  const projected = isoToScreen(combat.playerMapX, combat.playerMapY);
  combat.playerX = projected.x - 18;
  combat.playerY = projected.y + 50;
}

function updateAimFromPointer(event) {
  const rect = dom.combatCanvas.getBoundingClientRect();
  const scaleX = dom.combatCanvas.width / Math.max(1, rect.width);
  const scaleY = dom.combatCanvas.height / Math.max(1, rect.height);
  const aimWorld = screenToIso((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY);
  combat.pointerWorldX = aimWorld.x;
  combat.pointerWorldY = aimWorld.y;
  combat.pointerActive = true;
  const dx = aimWorld.x - combat.playerMapX;
  const dy = aimWorld.y - combat.playerMapY;
  const length = Math.hypot(dx, dy) || 1;
  combat.aimMapX = dx / length;
  combat.aimMapY = dy / length;
}

// Auto-fire: weapons fire on their own cadence (fire rate / reload), aiming in
// the player's facing direction (pointer-driven) or at the nearest enemy when
// idle. The player never manually shoots in the roguelike — only power-ups are
// manual. Cooldown is tracked in seconds.
function updateAutoFire(dt) {
  if (!combat.roguelikeRun || combat.paused || combat.gameOver) return;
  const weapon = weaponById(combat.weaponId);
  const reloadStat = combat.roguelikeRun?.stats.reloadSpeed ?? 1;

  // Handle an in-progress reload first: tick the timer down (faster with the
  // reload-speed stat) and refill the clip when it completes.
  if (combat.reloading) {
    combat.reloadRemaining -= dt;
    if (combat.reloadRemaining <= 0) {
      combat.reloading = false;
      combat.clip = combat.clipSize;
      combat.ammo = combat.clip;
      playSfxCue('pickup', 0.02);
      spawnText('RELOADED', combat.playerX + 20, combat.playerY - 80, '#45ff8a');
    }
    return; // no firing while reloading
  }

  // Out of rounds: kick off a timed auto-reload (slowest for the machine gun).
  if ((combat.clip ?? 0) <= 0) {
    combat.reloading = true;
    combat.reloadRemaining = (weapon.reloadSeconds ?? 1.2) / Math.max(0.4, reloadStat);
    spawnText('RELOAD…', combat.playerX + 20, combat.playerY - 80, '#ffe84d');
    playSfxCue('menu-click', 0.02);
    return;
  }

  const fireStat = combat.roguelikeRun?.stats.fireRate ?? 1;
  const berserkFire = (combat.powerUpTimers.berserk ?? 0) > 0 ? 1.6 : 1;
  const shotsPerSecond = (weapon.fireRatePerSecond ?? 3) * fireStat * berserkFire;
  combat.autoFireCooldown = (combat.autoFireCooldown ?? 0) - dt;
  if (combat.autoFireCooldown > 0) return;
  // If the pointer isn't steering aim, lock onto the nearest live enemy so the
  // hero still defends himself while the player just positions.
  if (!combat.pointerActive && combat.enemies.length) {
    let best = null;
    let bestD = Infinity;
    for (const e of combat.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.mapX - combat.playerMapX, e.mapY - combat.playerMapY);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) {
      const dx = best.mapX - combat.playerMapX;
      const dy = best.mapY - combat.playerMapY;
      const len = Math.hypot(dx, dy) || 1;
      combat.aimMapX = dx / len;
      combat.aimMapY = dy / len;
    }
  }
  shootRoguelike();
  combat.autoFireCooldown = 1 / Math.max(0.5, shotsPerSecond);
}

function shootRoguelike() {
  const weapon = weaponById(combat.weaponId);
  // Clip gate: never fire on an empty clip — updateAutoFire schedules the reload.
  if ((combat.clip ?? 0) <= 0) {
    return;
  }
  combat.clip -= 1;
  combat.ammo = combat.clip; // keep legacy mirror in sync
  combat.shots += 1;
  combat.fireFlash = 4; // brief muzzle-flash brightening for the lighting pass
  combat.lastShotFrame = combat.frame; // drives the animated-roster 'shoot' pose
  const damageScale = (combat.roguelikeRun?.stats.damage ?? 1) * ((combat.powerUpTimers.berserk ?? 0) > 0 ? 1.5 : 1);
  const bulletSpeed = 14 * (combat.roguelikeRun?.stats.bulletSpeed ?? 1);
  // Shotgun fires a spread of pellets; everything else fires a single round.
  const pellets = weapon.pellets ?? 1;
  if (pellets > 1) {
    const baseAng = Math.atan2(combat.aimMapY, combat.aimMapX);
    const spread = 0.42; // total cone in radians
    for (let i = 0; i < pellets; i += 1) {
      const t = pellets === 1 ? 0 : (i / (pellets - 1)) - 0.5;
      const ang = baseAng + t * spread;
      combat.bullets.push({
        worldX: combat.playerMapX + Math.cos(ang) * 0.65,
        worldY: combat.playerMapY + Math.sin(ang) * 0.65,
        vx: Math.cos(ang) * bulletSpeed,
        vy: Math.sin(ang) * bulletSpeed,
        damage: weapon.damage * damageScale,
        weaponId: weapon.id,
        ttl: 60, // shotgun pellets fall off faster (short range)
      });
    }
  } else {
    combat.bullets.push({
      worldX: combat.playerMapX + combat.aimMapX * 0.65,
      worldY: combat.playerMapY + combat.aimMapY * 0.65,
      vx: combat.aimMapX * bulletSpeed,
      vy: combat.aimMapY * bulletSpeed,
      damage: weapon.damage * damageScale,
      weaponId: weapon.id,
      ttl: 92,
    });
  }
  const muzzle = isoToScreen(combat.playerMapX + combat.aimMapX * 0.8, combat.playerMapY + combat.aimMapY * 0.8);
  spawnMuzzleFlash(muzzle.x, muzzle.y, weapon.id);
  playSfxCue('weapon-fire', weapon.id === 'hash-rail' ? 0.045 : 0.035);
}

function openLevelUpMenu() {
  if (!combat.roguelikeRun?.pausedForLevelUp) return;
  const offer = chooseRoguelikeUpgradeOptions(combat.roguelikeRun, { seed: combat.frame + combat.kills });
  combat.levelUpChoices = [...offer.options];
  combat.levelUpPaused = true;
  combat.paused = true;
  combat.status = 'LEVEL UP: choose one of two random augments. The roguelike run is paused until you pick.';
  spawnText('LEVEL UP', ISO_CENTER_X - 28, ISO_CENTER_Y - 72, '#ffe84d');
  syncCombatOverlay();
}

function rerollLevelUpChoices() {
  if (!combat.levelUpPaused || !combat.roguelikeRun || combat.roguelikeRun.rerollsRemaining <= 0) return;
  combat.roguelikeRun = { ...combat.roguelikeRun, rerollsRemaining: combat.roguelikeRun.rerollsRemaining - 1 };
  const offer = chooseRoguelikeUpgradeOptions(combat.roguelikeRun, { seed: combat.frame + combat.kills + 999, reroll: true });
  combat.levelUpChoices = [...offer.options];
  syncCombatOverlay();
}

function selectLevelUpUpgrade(skillId) {
  if (!combat.levelUpPaused || !combat.roguelikeRun) return;
  const skill = combat.levelUpChoices.find((choice) => choice.id === skillId);
  combat.roguelikeRun = applyRoguelikeSkillUpgrade(combat.roguelikeRun, skillId);
  combat.levelUpChoices = [];
  combat.levelUpPaused = false;
  combat.paused = false;
  combat.status = `${skill?.title ?? 'Upgrade'} applied. Survive the 20-minute wall.`;
  spawnText(`${skill?.title ?? 'UPGRADE'} +5%`, ISO_CENTER_X - 44, ISO_CENTER_Y - 64, '#45ff8a');
  syncCombatOverlay();
}

function spawnRoguelikeEnemy(director = getRoguelikeSpawnDirectorAt(combat.elapsedGameSeconds)) {
  const spawn = chooseEnemySpawn({ elapsedSeconds: combat.elapsedGameSeconds, seed: combat.frame + combat.kills + combat.enemies.length });
  const angle = ((combat.frame * 37 + combat.enemies.length * 71) % 360) * Math.PI / 180;
  const radius = 10 + (combat.frame % 5);
  const ranged = ((combat.frame + combat.enemies.length) % 100) / 100 < director.rangedEnemyShare;
  const elite = ((combat.frame + combat.kills) % 100) / 100 < director.eliteEnemyShare;
  // Size scaling: 0.5x to 2.0x player size for variety
  // Grunts: 0.6-1.3x, heavies: 0.9-1.6x, minis/bosses handled separately
  const sizeRoll = Math.random();
  let sizeScale;
  if (spawn.enemy.boss || spawn.enemy.tier === 'heavy') {
    sizeScale = 0.9 + Math.random() * 0.7; // 0.9x - 1.6x for heavies
  } else {
    sizeScale = 0.55 + Math.random() * 0.75; // 0.55x - 1.3x for grunts/flyers
  }
  const enemy = {
    ...spawn.enemy,
    mapX: combat.playerMapX + Math.cos(angle) * radius,
    mapY: combat.playerMapY + Math.sin(angle) * radius,
    hp: Math.max(8, Math.round(spawn.scaledHealth * (elite ? 1.55 : 0.82))),
    maxHp: Math.max(8, Math.round(spawn.scaledHealth * (elite ? 1.55 : 0.82))),
    speed: (spawn.enemy.speed ?? 1) * (elite ? 1.08 : 0.9),
    ranged,
    elite,
    sizeScale, // Visual size multiplier (0.5-2.0x range)
    attackTimer: ranged ? 70 + (combat.frame % 40) : 36,
    tellFrames: 0,
    score: spawn.enemy.score + (elite ? 80 : 0),
    state: ranged ? 'ranged-fire' : 'chase-player',
  };
  const projected = isoToScreen(enemy.mapX, enemy.mapY);
  enemy.x = projected.x;
  enemy.y = projected.y + 38;
  combat.enemies.push(enemy);
  return enemy;
}

function updateRoguelikeMovement(dt) {
  // Twin-stick-lite auto-movement: the hero walks toward the pointer/touch
  // target and faces (and fires) that way. WASD/arrows still work as an optional
  // override for keyboard players. A dead-zone keeps the hero from jittering when
  // the cursor sits right on top of them.
  let mx = (combat.keys.has('d') || combat.keys.has('arrowright') ? 1 : 0)
    - (combat.keys.has('a') || combat.keys.has('arrowleft') ? 1 : 0);
  let my = (combat.keys.has('s') || combat.keys.has('arrowdown') ? 1 : 0)
    - (combat.keys.has('w') || combat.keys.has('arrowup') ? 1 : 0);
  const usingKeys = mx !== 0 || my !== 0;

  // On DESKTOP, the mouse is AIM ONLY — movement is WASD/arrows. On TOUCH (no
  // hover cursor) the hero auto-walks toward the touch point.
  if (!usingKeys && combat.pointerActive && !isDesktopControls()) {
    const pdx = (combat.pointerWorldX ?? combat.playerMapX) - combat.playerMapX;
    const pdy = (combat.pointerWorldY ?? combat.playerMapY) - combat.playerMapY;
    const pdist = Math.hypot(pdx, pdy);
    const DEAD_ZONE = 0.45; // world tiles; stop when basically on the cursor
    if (pdist > DEAD_ZONE) {
      mx = pdx / pdist;
      my = pdy / pdist;
    }
  }

  const length = Math.hypot(mx, my) || 1;
  const speed = 4.15 * (combat.roguelikeRun?.stats.movementSpeed ?? 1);
  if (mx !== 0 || my !== 0) {
    const fromX = combat.playerMapX;
    const fromY = combat.playerMapY;
    const toX = fromX + (mx / length) * speed * dt;
    const toY = fromY + (my / length) * speed * dt;
    // Solid obstacles (buildings/trees/objects) block movement: the player slides
    // along / stops at their footprint instead of walking through them.
    const afterObstacles = resolvePlayerCollision(fromX, fromY, toX, toY, 0.42, currentObstacles());
    // Water is impassable — clamp the move so the player can't walk onto water
    // tiles (slides along the shoreline where possible).
    const seed = combat.roguelikeRun?.seed ?? 0;
    const resolved = resolveWaterCollision(seed, fromX, fromY, afterObstacles.x, afterObstacles.y, biomeAt);
    combat.playerMapX = resolved.x;
    combat.playerMapY = resolved.y;
    combat._heroMoving = true;
  } else {
    combat._heroMoving = false;
  }
  // Facing/aim: on DESKTOP the gun always fires toward the mouse (aim is held by
  // updateAimFromPointer), independent of WASD movement — twin-stick style. On
  // TOUCH there's no hover cursor, so keyboard movers face their movement vector.
  if (usingKeys && !isDesktopControls()) {
    combat.aimMapX = mx / length;
    combat.aimMapY = my / length;
  }
  combat.roguelikeRun.player.x = combat.playerMapX;
  combat.roguelikeRun.player.y = combat.playerMapY;
  syncProjectedPlayerPosition();
}

function updateRoguelikeBullets(dt) {
  const obstacles = currentObstacles();
  for (const bullet of combat.bullets) {
    bullet.worldX += bullet.vx * dt;
    bullet.worldY += bullet.vy * dt;
    bullet.ttl -= 1;
    const projected = isoToScreen(bullet.worldX, bullet.worldY);
    bullet.x = projected.x;
    bullet.y = projected.y;
    // Solid obstacles block bullets (inanimate objects take no damage, but they
    // stop shots — you have to shoot around buildings/trees, not through them).
    if (obstacleHitAt(bullet.worldX, bullet.worldY, obstacles)) {
      for (let i = 0; i < 3; i += 1) {
        combat.particles.push({ type: 'impact-sparks', x: projected.x, y: projected.y + 18, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, color: i % 2 ? '#f9f7ff' : '#9aa7c7', size: 12 + Math.random() * 8, life: 0.3, maxLife: 0.3 });
      }
      bullet.ttl = 0;
      continue;
    }
    for (const enemy of combat.enemies) {
      if (enemy.hp > 0 && Math.hypot(enemy.mapX - bullet.worldX, enemy.mapY - bullet.worldY) < 0.72) {
        damageEnemy(enemy, bullet.damage, bullet.weaponId);
        bullet.ttl = 0;
        break;
      }
    }
  }
  combat.bullets = combat.bullets.filter((bullet) => bullet.ttl > 0);

  for (const shot of combat.enemyShots) {
    shot.worldX += shot.vx * dt;
    shot.worldY += shot.vy * dt;
    shot.ttl -= 1;
    // Enemy shots are also blocked by solid obstacles, so cover protects the player.
    if (obstacleHitAt(shot.worldX, shot.worldY, obstacles)) {
      shot.ttl = 0;
    }
    const projected = isoToScreen(shot.worldX, shot.worldY);
    shot.x = projected.x;
    shot.y = projected.y;
    if (Math.hypot(shot.worldX - combat.playerMapX, shot.worldY - combat.playerMapY) < 0.62) {
      damagePlayer(shot.damage, 'enemy-shot');
      shot.ttl = 0;
    }
  }
  combat.enemyShots = combat.enemyShots.filter((shot) => shot.ttl > 0);
}

function updateRoguelikeEnemies(director, dt) {
  combat.roguelikeSpawnTimer -= dt;
  while (combat.roguelikeSpawnTimer <= 0 && combat.enemies.length < director.maxEnemiesOnMap) {
    spawnRoguelikeEnemy(director);
    combat.roguelikeSpawnTimer += director.spawnIntervalSeconds;
  }

  const slowFactor = (combat.powerUpTimers.slowEnemies ?? 0) > 0 ? 0.4 : 1;
  for (const enemy of combat.enemies) {
    if (enemy.hitFlash > 0) enemy.hitFlash -= 1;
    const dx = combat.playerMapX - enemy.mapX;
    const dy = combat.playerMapY - enemy.mapY;
    const distance = Math.hypot(dx, dy) || 1;
    const desiredDistance = enemy.ranged ? 5.2 : 0.72;
    enemy.state = enemy.ranged ? 'ranged-fire' : 'chase-player';
    if (distance > desiredDistance) {
      const speed = (enemy.speed ?? 1) * (enemy.elite ? 2.15 : 1.65) * (1 + director.pressure * 0.65) * slowFactor;
      enemy.mapX += (dx / distance) * speed * dt;
      enemy.mapY += (dy / distance) * speed * dt;
    } else if (enemy.ranged) {
      enemy.mapX -= (dx / distance) * 0.55 * dt * slowFactor;
      enemy.mapY -= (dy / distance) * 0.55 * dt * slowFactor;
    }
    enemy.attackTimer -= 1;
    enemy.tellFrames = enemy.attackTimer < 18 ? 18 - enemy.attackTimer : 0;
    if (!enemy.ranged && distance < 0.82 && enemy.attackTimer <= 0) {
      damagePlayer(enemy.elite ? NORMAL_HIT_DAMAGE * 1.5 : NORMAL_HIT_DAMAGE, 'enemy-melee');
      enemy.attackTimer = 46;
    }
    if (enemy.ranged && enemy.attackTimer <= 0) {
      const shotSpeed = 5.2 * director.projectileSpeedMultiplier;
      combat.enemyShots.push({
        worldX: enemy.mapX,
        worldY: enemy.mapY,
        vx: (dx / distance) * shotSpeed,
        vy: (dy / distance) * shotSpeed,
        damage: NORMAL_HIT_DAMAGE,
        ttl: 180,
      });
      enemy.attackTimer = Math.max(34, Math.round(92 - director.pressure * 38));
    }
    const projected = isoToScreen(enemy.mapX, enemy.mapY);
    enemy.x = projected.x;
    enemy.y = projected.y + 38;
  }

  for (const enemy of combat.enemies.filter((enemy) => enemy.hp <= 0)) {
    killEnemy(enemy);
    // Per-enemy-type kill tracking (feeds the game-stats module + balanced XP).
    const typeId = enemy.id ?? enemy.enemyKey ?? 'unknown';
    combat.killsByType[typeId] = (combat.killsByType[typeId] ?? 0) + 1;
    // XP scales with the enemy's catalog score value so tougher foes are worth
    // more progression, instead of a flat 14/28. Baseline grunt (~80 score) -> ~12 XP;
    // elites and high-value foes scale up. Elite bonus on top.
    const baseXp = Math.round(8 + (enemy.score ?? 80) * 0.06);
    const xpValue = enemy.elite ? Math.round(baseXp * 1.6) : baseXp;
    combat.xpGems.push({ worldX: enemy.mapX, worldY: enemy.mapY, value: xpValue, ttl: 900 });
    // Power-up drops: elites/mini-bosses always drop a rare run-swinger; normal
    // grunts have a small chance at a standard drop. Deterministic per frame/kill.
    if (enemy.elite || enemy.miniBoss) {
      dropRoguelikePowerUp(enemy.mapX, enemy.mapY, { rare: true });
    } else if ((combat.frame + combat.kills) % 12 === 0) {
      dropRoguelikePowerUp(enemy.mapX, enemy.mapY);
    }
  }
  combat.enemies = combat.enemies.filter((enemy) => enemy.hp > 0);
}

function updateRoguelikeXpGems() {
  const pickupRadius = 1.4 * (combat.roguelikeRun?.stats.pickupRadius ?? 1);
  for (const gem of combat.xpGems) {
    gem.ttl -= 1;
    const dx = combat.playerMapX - gem.worldX;
    const dy = combat.playerMapY - gem.worldY;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < pickupRadius) {
      combat.roguelikeRun = grantRoguelikeXp(combat.roguelikeRun, gem.value);
      gem.ttl = 0;
      spawnText(`XP +${gem.value}`, ISO_CENTER_X + 22, ISO_CENTER_Y - 46, '#19f7ff');
      if (combat.roguelikeRun.pausedForLevelUp) openLevelUpMenu();
    } else if (distance < pickupRadius * 4) {
      gem.worldX += (dx / distance) * 0.08;
      gem.worldY += (dy / distance) * 0.08;
    }
  }
  combat.xpGems = combat.xpGems.filter((gem) => gem.ttl > 0);
}

// --- Roguelike world power-ups -------------------------------------------------
// Unlike the legacy side-scroller drops (screen-space, gravity, drift-left), the
// isometric roguelike spawns power-ups at world coordinates where an enemy died,
// gently attracts them toward the hero, and collects them within a pickup radius
// (boosted while the Magnet Wallet Surge is active). Effects route through
// applyRoguelikePowerUp so the 4 roguelike power-ups (magnet / time-dilation /
// berserk / liquidation-nuke) get real gameplay behavior, not just an icon.
const ROGUELIKE_POWERUP_POOL = Object.freeze([
  'heal-pack', 'shield-cache', 'ammo-cache', 'magnet-surge',
  'time-dilation', 'berserk-candle', 'ltc-cache',
]);
// Rarer, run-swinging drops reserved for elites / mini-bosses.
const ROGUELIKE_POWERUP_RARE = Object.freeze(['nuke-liquidation', 'berserk-candle', 'time-dilation']);

function powerUpById(id) {
  return LESTER_BLASTER_POWER_UPS.find((p) => p.id === id) ?? null;
}

function dropRoguelikePowerUp(worldX, worldY, { rare = false } = {}) {
  const pool = rare ? ROGUELIKE_POWERUP_RARE : ROGUELIKE_POWERUP_POOL;
  const pick = pool[(combat.frame + combat.kills + combat.powerUps.length) % pool.length];
  const def = powerUpById(pick);
  if (!def) return;
  const projected = isoToScreen(worldX, worldY);
  combat.powerUps.push({
    ...def,
    worldX,
    worldY,
    x: projected.x,
    y: projected.y,
    ttl: 720,
    bobSeed: (worldX * 17 + worldY * 31) % 360,
  });
}

function updateRoguelikePowerUps() {
  const magnetActive = (combat.powerUpTimers.magnet ?? 0) > 0;
  const basePickup = 1.1 * (combat.roguelikeRun?.stats?.pickupRadius ?? 1);
  const pickupRadius = magnetActive ? basePickup * 3.2 : basePickup;
  const attractRadius = magnetActive ? pickupRadius * 6 : pickupRadius * 2.4;
  const attractSpeed = magnetActive ? 0.26 : 0.07;
  for (const power of combat.powerUps) {
    power.ttl -= 1;
    const dx = combat.playerMapX - power.worldX;
    const dy = combat.playerMapY - power.worldY;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < pickupRadius) {
      applyRoguelikePowerUp(power);
      power.ttl = 0;
      continue;
    }
    if (distance < attractRadius) {
      power.worldX += (dx / distance) * attractSpeed;
      power.worldY += (dy / distance) * attractSpeed;
    }
    const projected = isoToScreen(power.worldX, power.worldY);
    power.x = projected.x;
    power.y = projected.y;
  }
  combat.powerUps = combat.powerUps.filter((power) => power.ttl > 0);
}

function applyRoguelikePowerUp(power) {
  combat.powerUpsCollected += 1;
  combat.collectedPowerUpTypes.add(power.id ?? power.effect ?? power.title);
  const px = power.x;
  const py = power.y - 28;
  switch (power.effect) {
    case 'heal':
      combat.health = Math.min(PLAYER_MAX_HEALTH, combat.health + (power.amount ?? 25));
      break;
    case 'ammo':
      combat.ammo = Number.isFinite(combat.ammo) ? combat.ammo + (power.amount ?? 30) : combat.ammo;
      break;
    case 'shield':
      combat.health = Math.min(PLAYER_MAX_HEALTH, combat.health + (power.amount ?? 1) * 15);
      combat.invulnerableFrames = Math.max(combat.invulnerableFrames, 180);
      break;
    case 'scoreBonus':
      combat.score += power.score ?? 500;
      spawnText(`+${(power.score ?? 500).toLocaleString()}`, px, py, '#ffe84d');
      break;
    case 'magnet':
      combat.powerUpTimers.magnet = power.durationSeconds ?? 8;
      spawnFxImage('sparkle', px, py, 72, 0.5);
      break;
    case 'slowEnemies':
      combat.powerUpTimers.slowEnemies = power.durationSeconds ?? 6;
      spawnFxImage('ice', px, py, 96, 0.6);
      break;
    case 'berserk':
      combat.powerUpTimers.berserk = power.durationSeconds ?? 7;
      spawnFxImage('crit', px, py, 84, 0.55);
      break;
    case 'screenNuke': {
      // Liquidation Nuke: clear every on-screen enemy and reward the kills.
      const doomed = [...combat.enemies];
      for (const enemy of doomed) {
        enemy.hp = 0;
        spawnExplosion(enemy.x + 12, enemy.y - 28, '#ff476f');
        const typeId = enemy.id ?? enemy.enemyKey ?? 'unknown';
        combat.killsByType[typeId] = (combat.killsByType[typeId] ?? 0) + 1;
        killEnemy(enemy);
        combat.xpGems.push({ worldX: enemy.mapX, worldY: enemy.mapY, value: 6, ttl: 900 });
      }
      combat.enemies = [];
      spawnFxImage('shockwave', ISO_CENTER_X, ISO_CENTER_Y, 220, 0.7);
      spawnText('LIQUIDATED', px, py, '#ff476f');
      break;
    }
    default:
      break;
  }
  playSfxCue('pickup', 0.055);
  spawnText(power.title, px, py - 18, '#45ff8a');
}

function updateRoguelikePowerUpTimers(dt) {
  const t = combat.powerUpTimers;
  t.magnet = Math.max(0, (t.magnet ?? 0) - dt);
  t.slowEnemies = Math.max(0, (t.slowEnemies ?? 0) - dt);
  t.berserk = Math.max(0, (t.berserk ?? 0) - dt);
}

function updateRoguelikeCombatStep(dt, difficulty) {
  if (combat.levelUpPaused) return;
  const director = getRoguelikeSpawnDirectorAt(combat.elapsedGameSeconds);
  combat.roguelikeRun.spawnDirector = director;
  updateRoguelikeMovement(dt);
  updateRoguelikePowerUpTimers(dt);
  updateAutoFire(dt);
  updateRoguelikeEnemies(director, dt);
  updateRoguelikeBullets(dt);
  updateRoguelikeXpGems();
  updateRoguelikePowerUps();
  updateParticles(dt);
  updateFloatingTexts();
  const xpScore = (combat.roguelikeRun.level - 1) * 250 + Math.round((combat.roguelikeRun.xp || 0) * 1.5);
  combat.score = calculateLesterBlasterScore({
    elapsedSeconds: combat.elapsedGameSeconds,
    kills: combat.kills,
    maxKillCombo: combat.maxCombo,
    maxDamageCombo: combat.maxDamageCombo,
    noDamageSeconds: combat.noDamageSeconds,
    powerUpsCollected: combat.powerUpsCollected,
    weaponUpgrades: Object.values(combat.roguelikeRun.skills).some(Boolean) ? ['damage'] : [],
    rareWeaponId: combat.weaponId === 'oracle-slayer' ? combat.weaponId : null,
    difficultyTier: difficulty.tier,
  }).total + xpScore;
  combat.score = Math.round(combat.score); // whole-number score only (no decimals)
  combat.longestSurvivalThisRun = Math.max(combat.longestSurvivalThisRun, combat.elapsedGameSeconds);
  if (combat.elapsedGameSeconds >= LESTER_BLASTER_ISOMETRIC_ROGUELIKE.runPacing.targetSurvivalMinutes * 60 && !combat.gameOver) {
    spawnText('SURVIVAL WALL', ISO_CENTER_X - 54, ISO_CENTER_Y - 92, '#ff476f');
  }
}

// Per-biome floor palette: { top-left lit face, bottom-right shaded face, seam }.
// Replaces the old universal "blue checker" that looked broken in every biome.
const BIOME_FLOOR_PALETTE = {
  town:   { lit: '#3a3f4d', dark: '#23262f', seam: 'rgba(120,140,180,.14)' },
  road:   { lit: '#33373f', dark: '#1d2026', seam: 'rgba(200,200,120,.10)' },
  desert: { lit: '#b9924f', dark: '#7c5e2e', seam: 'rgba(255,225,150,.16)' },
  forest: { lit: '#3f6b3a', dark: '#274324', seam: 'rgba(150,220,140,.14)' },
  rocky:  { lit: '#5a5e66', dark: '#3a3d44', seam: 'rgba(180,190,205,.14)' },
  water:  { lit: '#1f5f8a', dark: '#123c5c', seam: 'rgba(120,210,255,.20)' },
};

// Per-biome palette objects are cached (frozen) so the per-tile hot path does
// zero allocation — the old code object-spread a new palette for EVERY tile of
// EVERY frame (thousands/frame in fullscreen), which churned the GC.
const _biomePaletteCache = new Map();
function biomeFloorPalette(worldX, worldY) {
  const seed = combat.roguelikeRun?.seed ?? 0;
  const biome = biomeAt(seed, Math.round(worldX), Math.round(worldY));
  let p = _biomePaletteCache.get(biome);
  if (!p) {
    p = Object.freeze({ biome, ...(BIOME_FLOOR_PALETTE[biome] ?? BIOME_FLOOR_PALETTE.town) });
    _biomePaletteCache.set(biome, p);
  }
  return p;
}

// Draw an iso tile diamond with a directional-light gradient (lit top-left,
// shaded bottom-right) so the floor reads as 3D instead of flat color.
function drawShadedIsoTile(ctx, cx, cy, palette, shimmer = 0) {
  const grad = ctx.createLinearGradient(
    cx - ISO_TILE_WIDTH / 2, cy - ISO_TILE_HEIGHT / 2,
    cx + ISO_TILE_WIDTH / 2, cy + ISO_TILE_HEIGHT / 2,
  );
  if (shimmer) {
    // Animated water shimmer: blend the lit color in/out along the diamond.
    const t = 0.5 + 0.5 * Math.sin(shimmer);
    grad.addColorStop(0, palette.lit);
    grad.addColorStop(Math.min(0.9, 0.35 + t * 0.4), palette.lit);
    grad.addColorStop(1, palette.dark);
  } else {
    grad.addColorStop(0, palette.lit);
    grad.addColorStop(1, palette.dark);
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy - ISO_TILE_HEIGHT / 2);
  ctx.lineTo(cx + ISO_TILE_WIDTH / 2, cy);
  ctx.lineTo(cx, cy + ISO_TILE_HEIGHT / 2);
  ctx.lineTo(cx - ISO_TILE_WIDTH / 2, cy);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = palette.seam;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawIsoTile(ctx, cx, cy, color, stroke = 'rgba(25,247,255,.12)') {
  ctx.beginPath();
  ctx.moveTo(cx, cy - ISO_TILE_HEIGHT / 2);
  ctx.lineTo(cx + ISO_TILE_WIDTH / 2, cy);
  ctx.lineTo(cx, cy + ISO_TILE_HEIGHT / 2);
  ctx.lineTo(cx - ISO_TILE_WIDTH / 2, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function currentProductionLevel() {
  const levels = combatArt.production?.levels ?? [];
  if (!levels.length) return null;
  const index = Math.min(levels.length - 1, Math.floor(combat.elapsedGameSeconds / 240));
  return levels[index];
}

// --- Wave-2 PixelLab biome ground tiles --------------------------------------
// Real textured isometric ground tiles (sand, gravel, dirt, rock, grass, water,
// pavement) generated in the environment wave. Each biome maps to 1-2 tile slugs
// that read correctly; tiles are lazy-loaded once and cached. When a tile image
// isn't ready yet, drawProductionIsoTile falls back to the biome-shaded gradient
// so the floor is never blank/blue.
const WAVE2_TILE_SRC = (() => {
  const map = {};
  for (const a of hmh('HMH_ENVIRONMENT_PIXELLAB_WAVE_2')?.assets ?? []) {
    if (a.assetType === 'isometric_tile' && a.images?.[0]?.src) map[a.slug] = a.images[0].src;
  }
  return map;
})();
const BIOME_GROUND_TILES = {
  town: ['concrete-road', 'asphalt-road'],
  road: ['asphalt-road', 'asphalt-road-stripe'],
  desert: ['sand', 'gravel'],
  forest: ['flower-grass-ground', 'ground-dirt'],
  rocky: ['ground-rock', 'gravel'],
  water: ['shallow-water', 'river-bank'],
};
const wave2TileImages = new Map();
function wave2TileImage(slug) {
  if (!slug || !WAVE2_TILE_SRC[slug]) return null;
  if (!wave2TileImages.has(slug)) wave2TileImages.set(slug, loadImageAsset(WAVE2_TILE_SRC[slug]));
  return wave2TileImages.get(slug);
}
function biomeGroundTileForWorld(worldX, worldY, biome) {
  const slugs = BIOME_GROUND_TILES[biome] ?? BIOME_GROUND_TILES.town;
  if (!slugs.length) return null;
  // Coherent ground: use the FIRST (dominant) tile almost everywhere, and only
  // sprinkle the secondary variant in small deterministic clusters. The old code
  // alternated the tile every single cell (worldX*7+worldY*11 % n), which made
  // the floor strobe/checkerboard. Cluster the variant on a coarse 3-tile cell
  // so any variation reads as an intentional patch, not per-tile noise.
  if (slugs.length === 1) return wave2TileImage(slugs[0]);
  const cx = Math.floor(worldX / 3);
  const cy = Math.floor(worldY / 3);
  const h = Math.abs(((cx * 374761393) ^ (cy * 668265263)) >>> 0) % 100;
  // ~18% of 3x3 patches use the accent tile; the rest stay the dominant tile.
  const slug = h < 18 ? slugs[1] : slugs[0];
  return wave2TileImage(slug);
}

// Scene-template ground themes -> the wave-2 tile slug that best matches the
// objects placed there (arcade carpet -> dark pavement, park/yard -> grass,
// street/compound -> asphalt, desert scrub -> sand). This makes the FLOOR match
// the arrangement of objects in each scene cell (Justin's "floor tileset theme
// should match the area").
const THEME_GROUND_TILE = {
  pavement: 'concrete-road',
  carpet: 'asphalt-road',     // dark indoor-ish floor for arcade interiors
  grass: 'flower-grass-ground',
  sand: 'sand',
};
// The scene theme for a world tile (rounds into the scene cell). Cached per
// cell so we don't recompute the template pick for every floor tile each frame.
// NUMERIC key (no per-tile string allocation — this runs thousands of times a
// frame). Cache is cleared at run start, so the seed needn't be in the key.
const _themeCellCache = new Map();
function sceneGroundThemeAt(seed, worldX, worldY) {
  const cellX = Math.floor(worldX / SCENE_CELL);
  const cellY = Math.floor(worldY / SCENE_CELL);
  const key = (cellX + 8192) * 16384 + (cellY + 8192);
  if (_themeCellCache.has(key)) return _themeCellCache.get(key);
  const biome = biomeAt(seed, cellX * SCENE_CELL + 3, cellY * SCENE_CELL + 3);
  const theme = groundThemeForCell(seed, cellX, cellY, biome);
  if (_themeCellCache.size > 4000) _themeCellCache.clear(); // bound memory on endless maps
  _themeCellCache.set(key, theme);
  return theme;
}

// --- Wave-2 animated ambient props (wind/water/flicker motion) ---------------
// Index the multi-frame `-ambient` animations by slug, keeping only the real
// frame_NNN images (skip the 000-unknown spritesheet base). Each biome gets a
// set of fitting animated props; placement is deterministic per run seed so the
// world is stable, and frames cycle on combat.frame for live motion.
const WAVE2_ANIM = (() => {
  const bySlug = {};
  for (const a of hmh('HMH_ENVIRONMENT_PIXELLAB_WAVE_2')?.assets ?? []) {
    if (!a.slug.endsWith('-ambient')) continue;
    const frames = (a.images ?? []).filter((im) => /frame_\d+/.test(im.src));
    if (frames.length) bySlug[a.slug.replace('-ambient', '')] = frames.map((im) => im.src);
  }
  return bySlug;
})();
const BIOME_ANIM_PROPS = {
  forest: ['leafy-tree-wind', 'flower-patch-sway'],
  desert: ['cactus-heat-shimmer', 'tumbleweed-roll', 'palm-tree-wind'],
  water: ['water-surface-ripple', 'waterfall-cascade', 'river-rapids-flow'],
  town: ['neon-sign-flicker', 'traffic-light-blink', 'parked-car-blink', 'garbage-can-wobble'],
  road: ['road-sign-sway', 'traffic-light-blink', 'wrecked-car-smoke'],
  rocky: ['tumbleweed-roll', 'leafy-tree-wind'],
};
const wave2AnimImages = new Map();
function wave2AnimFrame(slug, frameIdx) {
  const srcs = WAVE2_ANIM[slug];
  if (!srcs || !srcs.length) return null;
  const i = frameIdx % srcs.length;
  const key = `${slug}#${i}`;
  if (!wave2AnimImages.has(key)) wave2AnimImages.set(key, loadImageAsset(srcs[i]));
  return wave2AnimImages.get(key);
}

// Collect animated ambient props near the player, returning depth-sorted render
// entries. Sparse lattice, biome-matched, kept clear of the player so they never
// block combat. Frames advance ~8fps for smooth wind/flicker/water motion.
function collectAnimatedProps(ctx) {
  if (!Object.keys(WAVE2_ANIM).length) return [];
  const out = [];
  const seed = combat.roguelikeRun?.seed ?? 0;
  const LATTICE = 8;
  const baseX = Math.floor(combat.playerMapX / LATTICE) * LATTICE;
  const baseY = Math.floor(combat.playerMapY / LATTICE) * LATTICE;
  for (let gx = -2; gx <= 2; gx += 1) {
    for (let gy = -2; gy <= 2; gy += 1) {
      const cellX = baseX + gx * LATTICE;
      const cellY = baseY + gy * LATTICE;
      const h = Math.abs(((cellX * 374761393) ^ (cellY * 668265263)) >>> 0);
      if ((h % 100) > 42) continue; // ~42% of lattice cells host an animated prop
      const biome = biomeAt(seed, cellX, cellY);
      const pool = BIOME_ANIM_PROPS[biome] ?? BIOME_ANIM_PROPS.town;
      const slug = pool[h % pool.length];
      if (!WAVE2_ANIM[slug]) continue;
      const worldX = cellX + ((h % 5) - 2);
      const worldY = cellY + (((h >> 4) % 5) - 2);
      if (Math.hypot(worldX - combat.playerMapX, worldY - combat.playerMapY) < 4) continue;
      const projected = isoToScreen(worldX, worldY);
      // Per-prop phase offset so they don't all animate in lockstep.
      const frameIdx = Math.floor((combat.frame + (h % 13)) / 7);
      const img = wave2AnimFrame(slug, frameIdx);
      if (!imageReady(img)) continue;
      // Scale ambient animated props by type so they match the world's scale:
      // trees/waterfalls read tall, signs/flowers/litter small.
      const ANIM_PROP_SIZE = {
        'leafy-tree-wind': 132, 'palm-tree-wind': 138, 'waterfall-cascade': 150,
        'cactus-heat-shimmer': 104, 'neon-sign-flicker': 96, 'traffic-light-blink': 88,
        'wrecked-car-smoke': 120, 'parked-car-blink': 118, 'road-sign-sway': 78,
        'flower-patch-sway': 46, 'garbage-can-wobble': 50, 'tumbleweed-roll': 54,
        'water-surface-ripple': 88, 'river-rapids-flow': 96,
      };
      const size = ANIM_PROP_SIZE[slug] ?? 72;
      out.push({
        depth: projected.y + 40,
        draw: () => {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, Math.round(projected.x - size / 2), Math.round(projected.y + 44 - size), size, size);
          ctx.restore();
        },
      });
    }
  }
  return out;
}

function drawProductionIsoTile(ctx, cx, cy, worldX, worldY) {
  const palette = biomeFloorPalette(worldX, worldY);
  // Prefer the real textured biome ground tile; fall back to the shaded gradient
  // until the image loads (or if a biome has no tile art).
  // Scene-theme override: if this cell belongs to a coherent scene (arcade
  // interior, park, fenced yard, walled compound), use the floor tile that
  // matches that scene's theme so the ground reads as part of the area.
  const seed = combat.roguelikeRun?.seed ?? 0;
  let tileImg = null;
  const theme = sceneGroundThemeAt(seed, worldX, worldY);
  if (theme && THEME_GROUND_TILE[theme]) {
    tileImg = wave2TileImage(THEME_GROUND_TILE[theme]);
  }
  if (!imageReady(tileImg)) tileImg = biomeGroundTileForWorld(worldX, worldY, palette.biome);
  if (!imageReady(tileImg)) {
    const shimmer = palette.biome === 'water'
      ? (combat.frame * 0.06) + (worldX * 0.7 + worldY * 1.3)
      : 0;
    drawShadedIsoTile(ctx, cx, cy, palette, shimmer);
    return;
  }
  // Draw the diamond tile slightly oversized so neighbors overlap with no seams.
  // NOTE: no ctx.save()/restore() here — this runs for THOUSANDS of tiles per
  // frame; the caller (tile pass in drawRoguelikeScene) sets
  // imageSmoothingEnabled=false once for the whole pass.
  const drawWidth = ISO_TILE_WIDTH + 4;
  const drawHeight = ISO_TILE_HEIGHT * 2 + 6; // 56px source art is taller than the 32px diamond
  ctx.drawImage(tileImg, Math.round(cx - drawWidth / 2), Math.round(cy - drawHeight / 2), drawWidth, drawHeight);
}

function productionPropForIndex(index) {
  const level = currentProductionLevel();
  const slugs = level?.props?.length ? level.props : Object.keys(combatArt.production?.props ?? {});
  if (!slugs.length) return null;
  return combatArt.production.props[slugs[index % slugs.length]] ?? null;
}

// --- Road network rendering --------------------------------------------------
// The district generator produces a macro road network (streets between urban
// districts, trails between groves, boardwalk crossings over water). Roads are
// rendered as tinted diamond overlays ON TOP of the ground tiles, so they
// inherit the underlying texture and never depend on art that might not exist.
// Water crossings draw the wood-bridge sprite (with a plank-tint fallback).
const ROAD_INDEX_RADIUS = 280; // only index/draw roads within this tile radius of spawn
// Numeric grid key — the road index is probed for EVERY candidate tile every
// frame, so string keys would allocate megabytes/sec of garbage.
const roadTileKey = (x, y) => (x + 8192) * 16384 + (y + 8192);

function buildRoadTileIndex(roadNetwork, seed, shiftX = 0, shiftY = 0) {
  const index = new Map();
  if (!Array.isArray(roadNetwork)) return index;
  for (const road of roadNetwork) {
    const path = Array.isArray(road?.path) ? road.path : [];
    for (const pt of path) {
      const x = Math.round((pt?.x ?? 0) - shiftX);
      const y = Math.round((pt?.y ?? 0) - shiftY);
      if (Math.abs(x) > ROAD_INDEX_RADIUS || Math.abs(y) > ROAD_INDEX_RADIUS) continue;
      const key = roadTileKey(x, y);
      if (index.has(key)) continue;
      // Re-sample the biome at the SHIFTED coordinate so road style (and
      // bridge-vs-road) always matches the terrain actually rendered there.
      const biome = biomeAt(seed, x, y);
      index.set(key, { x, y, biome, type: biome === 'water' ? 'bridge' : 'road' });
    }
  }
  return index;
}

const ROAD_SURFACE_STYLE = {
  town: { fill: 'rgba(50, 54, 62, 0.60)', edge: 'rgba(220, 226, 238, 0.16)' },
  pavement: { fill: 'rgba(58, 62, 70, 0.58)', edge: 'rgba(220, 226, 238, 0.14)' },
  road: { fill: 'rgba(46, 50, 58, 0.62)', edge: 'rgba(236, 222, 130, 0.18)' },
  desert: { fill: 'rgba(196, 168, 112, 0.45)', edge: 'rgba(120, 96, 58, 0.20)' },
  sand: { fill: 'rgba(196, 168, 112, 0.45)', edge: 'rgba(120, 96, 58, 0.20)' },
  forest: { fill: 'rgba(112, 84, 52, 0.48)', edge: 'rgba(64, 46, 28, 0.22)' },
  grass: { fill: 'rgba(132, 102, 62, 0.42)', edge: 'rgba(70, 52, 30, 0.18)' },
  rocky: { fill: 'rgba(96, 94, 90, 0.46)', edge: 'rgba(50, 48, 46, 0.20)' },
  default: { fill: 'rgba(108, 92, 64, 0.45)', edge: 'rgba(58, 48, 32, 0.18)' },
};

function traceIsoDiamond(ctx, cx, cy, inset = 0) {
  const hw = ISO_TILE_WIDTH / 2 - inset;
  const hh = ISO_TILE_HEIGHT / 2 - inset * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

function drawRoadsAndTransitions(ctx, width, height, cullWidth, cullHeight) {
  const index = combat.roadTileIndex;
  if (!index || index.size === 0) return;
  const corners = [
    screenToIso(0, 0),
    screenToIso(cullWidth, 0),
    screenToIso(0, cullHeight),
    screenToIso(cullWidth, cullHeight),
  ];
  const PAD = 4;
  const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - PAD;
  const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + PAD;
  const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - PAD;
  const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + PAD;
  const bridgeImg = canonicalLandmarkImage('./assets/generated/hmh-coherent-world/construct/wood-bridge.png');
  ctx.save();
  for (let worldX = minX; worldX <= maxX; worldX += 1) {
    for (let worldY = minY; worldY <= maxY; worldY += 1) {
      const tile = index.get(roadTileKey(worldX, worldY));
      if (!tile) continue;
      const projected = isoToScreen(worldX, worldY);
      const cx = projected.x;
      const cy = projected.y + 64; // same ground-plane offset as drawProductionIsoTile
      if (cx < -ISO_TILE_WIDTH || cx > cullWidth + ISO_TILE_WIDTH) continue;
      if (cy < -ISO_TILE_HEIGHT - 80 || cy > cullHeight + ISO_TILE_HEIGHT + 80) continue;
      if (tile.type === 'bridge') {
        if (imageReady(bridgeImg)) {
          const w = ISO_TILE_WIDTH + 6;
          const h = ISO_TILE_HEIGHT * 2 + 8;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(bridgeImg, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
        } else {
          traceIsoDiamond(ctx, cx, cy);
          ctx.fillStyle = 'rgba(122, 86, 48, 0.85)'; // wood plank fallback
          ctx.fill();
        }
        continue;
      }
      const style = ROAD_SURFACE_STYLE[tile.biome] ?? ROAD_SURFACE_STYLE.default;
      traceIsoDiamond(ctx, cx, cy);
      ctx.fillStyle = style.fill;
      ctx.fill();
      // Subtle worn center so long straights read as a travelled path.
      traceIsoDiamond(ctx, cx, cy, 9);
      ctx.fillStyle = style.edge;
      ctx.fill();
    }
  }
  ctx.restore();
}


// Shared ground contact shadow so every world object (obstacles, ambient props,
// pickups) reads as PLANTED on the ground instead of floating. Global light is
// modeled as coming from the upper-left, so shadows pool slightly down-right at
// the object's foot. `footX/footY` is the screen-space ground contact point.
function drawContactShadow(ctx, footX, footY, width, { alpha = 0.28, squash = 0.4 } = {}) {
  const w = Math.max(10, width);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#02040a';
  ctx.beginPath();
  ctx.ellipse(footX + w * 0.06, footY, w, Math.max(5, w * squash), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProductionIsoProp(ctx, prop, x, y, index) {
  // For coherent-world scene props (from scene-templates), use coherentWorldImage
  // which handles the single-frame asset. We add code-driven animations here
  // for fountain (water bob) and arcade-cabinet (screen flicker).
  let frameImage = null;
  let coherentImage = null;

  if (prop.sceneAssetKey) {
    coherentImage = coherentWorldImage(prop.sceneAssetKey);
    if (!imageReady(coherentImage)) return false;
    frameImage = coherentImage;
  } else {
    // Production art pass props (fallback for non-scene props)
    frameImage = productionSpriteFrame(prop, combat.frame + index * 9, prop?.fps ?? 8);
    if (!imageReady(frameImage)) return false;
  }

  const activeFrame = prop?.frames?.length ? prop.frames[Math.floor((combat.frame + index * 9) / Math.max(1, Math.round(LESTER_BLASTER_PERFORMANCE_TARGETS.targetFps / Math.max(1, prop.fps ?? 8)))) % prop.frames.length] : null;
  const baseWidth = activeFrame?.width ?? prop.width ?? 80;
  const baseHeight = activeFrame?.height ?? prop.height ?? 88;
  const scale = prop.role?.includes('pickup_container') ? 0.72 : prop.role?.includes('occluder') ? 1.05 : prop.role?.includes('vehicle') ? 0.78 : 0.86;
  const drawWidth = Math.round(baseWidth * scale);
  const drawHeight = Math.round(baseHeight * scale);
  const sway = prop.role?.includes('occluder') ? Math.sin((combat.frame + index * 17) * 0.045) * 2 : 0;
  let bob = prop.role?.includes('hazard') || prop.role?.includes('pickup_container') ? Math.sin((combat.frame + index * 11) * 0.08) * 1.5 : 0;

  // Custom bob for fountain water
  if (prop.sceneAssetKey === 'nature/fountain') {
    bob = Math.sin((combat.frame + x) * 0.1) * 2.5; // Gentle water bob
  }
  // Custom flicker/pulse for arcade cabinet screen
  if (prop.sceneAssetKey === 'interior/arcade-cabinet') {
    const pulse = 0.5 + 0.5 * Math.sin(combat.frame * 0.25);
    ctx.filter = `brightness(${1 + (pulse * 0.2)})`; // Screen flicker effect
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Ground contact shadow (skip flat ground-decals/decor that sit IN the floor).
  // Plant it at the sprite's true foot line (y) WITHOUT bob/sway so the shadow
  // stays put on the ground while the sprite bobs above it — that reads as
  // grounded, not floating.
  const flatDecor = prop.role?.includes('ground') || prop.role?.includes('decal');
  if (!flatDecor) {
    drawContactShadow(ctx, Math.round(x), Math.round(y), drawWidth * 0.34, {
      alpha: prop.role?.includes('occluder') ? 0.3 : 0.24,
    });
  }
  ctx.globalAlpha = prop.role?.includes('decor') ? 0.92 : 1;
  ctx.drawImage(frameImage, Math.round(x - drawWidth / 2 + sway), Math.round(y - drawHeight + bob), drawWidth, drawHeight);
  ctx.restore();

  // Reset filter after drawing if it was applied
  if (prop.sceneAssetKey === 'interior/arcade-cabinet') {
    ctx.filter = 'none';
  }
  return true;
}

// Canonical parallax background layer (Justin's hand-made level art). Picks a
// stable strip per run and scrolls it horizontally with the camera for depth.
const parallaxBgState = { images: new Map(), currentIdx: null };
// The old hand-painted 2D parallax building strips are RETIRED (the user asked
// to drop the flat painted assets and keep the world purely isometric). In their
// place we draw a cheap biome-tinted atmospheric horizon gradient so the top of
// the scene still has depth/mood without any flat painted card art.
const BIOME_HORIZON = {
  town:   ['#1a1340', '#0a0a1e'], road: ['#191a2e', '#08060f'],
  desert: ['#3a2a1c', '#140d08'], sand: ['#3a2a1c', '#140d08'],
  forest: ['#0e2a1c', '#05120c'], water: ['#0c2740', '#04101c'],
  rocky:  ['#241f2c', '#0c0a12'],
};
function drawParallaxBackground(ctx, width, height) {
  const seed = combat.roguelikeRun?.seed ?? 0;
  const biome = biomeAt(seed, Math.round(combat.playerMapX ?? 0), Math.round(combat.playerMapY ?? 0));
  const horizon = BIOME_HORIZON[biome] ?? BIOME_HORIZON.town;
  const bandH = Math.round(height * 0.5);
  const g = ctx.createLinearGradient(0, 0, 0, bandH);
  g.addColorStop(0, horizon[0]);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, bandH);
  ctx.restore();
}

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
  const MIN_LOAD_MS = 1500; // always show the biome reveal for at least this long
  const seed = combat.roguelikeRun?.seed ?? 0;
  const worldProps = hmh('HMH_LEVEL_ENVIRONMENT')?.worldProps ?? [];
  const { districtGrid, roadNetwork } = worldStructure;
  // Collect a coherent set of images for the spawn region + immediate neighbors.
  const startBiome = biomeAt(seed, 0, 0);
  const toWarm = new Set();
  const regionBiomes = new Set([startBiome]);
  for (let rx = -2; rx <= 2; rx += 1) {
    for (let ry = -2; ry <= 2; ry += 1) {
      const b = biomeAt(seed, rx * 22, ry * 22);
      regionBiomes.add(b);
      for (const p of propsForBiome(worldProps, b).slice(0, 6)) toWarm.add(p.src);
      if (bgs.length) toWarm.add(bgs[parallaxIndexForBiome(seed, b, bgs.length)].src);
    }
  }
  // Warm the one image asset the road network actually uses (water crossings).
  // Road surfaces themselves are tinted procedurally over the ground tiles, so
  // they need no extra art and can never 404.
  if (roadNetwork && combat.roadTileIndex) {
    for (const tile of combat.roadTileIndex.values()) {
      if (tile.type === 'bridge') {
        toWarm.add('./assets/generated/hmh-coherent-world/construct/wood-bridge.png');
        break;
      }
    }
  }
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
  // Hold the finished bar, and enforce a minimum so the biome reveal always shows.
  drawLevelLoadScreen(ctx, width, height, 1, label);
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadStart;
  const remaining = Math.max(280, MIN_LOAD_MS - elapsed);
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
// Preload (decode) every placeable world-prop image at run start so a 300px
// building is already decoded before it scrolls into the generous draw window —
// no first-sight pop-in. Cheap: primes the same cache the renderer reads.
function preloadWorldPropImages() {
  const wp = hmh('HMH_LEVEL_ENVIRONMENT')?.worldProps ?? [];
  for (const p of wp) {
    if (p?.src) canonicalLandmarkImage(p.src);
  }
  // Also decode every coherent-world scene asset up front so scene props (lamps,
  // cabinets, trees, fountains, TVs) are ready before they scroll into the draw
  // window — no first-sight pop-in.
  for (const t of Object.values(SCENE_TEMPLATES)) {
    for (const s of t.slots) coherentWorldImage(s.assetKey);
  }
}
// --- Persistent collidable world obstacles --------------------------------
// Obstacles are derived from (seed, world cell) so a patch of world ALWAYS has
// the same buildings/trees/objects — they no longer pop in/out as the player
// moves. Computed once per frame and shared by movement, bullets, and drawing so
// collision and rendering always agree.
let _obstacleCacheFrame = -1;
let _obstacleCache = [];

// Coherent-world asset path + decode cache (scene-template placement).
const coherentWorldImageCache = new Map();
function coherentWorldImage(assetKey) {
  const src = `./assets/generated/hmh-coherent-world/${assetKey}.png`;
  if (!coherentWorldImageCache.has(src)) coherentWorldImageCache.set(src, loadImageAsset(src));
  return coherentWorldImageCache.get(src);
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
});

function currentObstacles() {
  if (_obstacleCacheFrame === combat.frame && _obstacleCache.length >= 0 && _obstacleCacheFrame !== -1) {
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
  const scene = sceneObjectsNear(seed, combat.playerMapX, combat.playerMapY, sceneWindow, biomeAt, { reserveRadius: 6 });
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
  _obstacleCache = sceneObstacles;
  _obstacleCacheFrame = combat.frame;
  return _obstacleCache;
}

// Per-role art sizing + collision footprint for placed obstacles. Establishes
// real SCALE so the world doesn't read as "everything is the same size": the
// hero draws ~72px, so a building at ~300px towers ~4x over him, vehicles/trees
// sit in between, and small litter is genuinely small. targetW = on-screen draw
// width (px); radius = collision footprint (world tiles); ground = foot offset.
const PROP_ROLE_STYLE = Object.freeze({
  building:  { targetW: 300, radius: 1.7,  ground: 120 },
  bigprop:   { targetW: 188, radius: 1.2,  ground: 86 },
  vehicle:   { targetW: 132, radius: 1.0,  ground: 48 },
  tree:      { targetW: 116, radius: 0.62, ground: 78 },
  smallprop: { targetW: 46,  radius: 0.42, ground: 30 },
});

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
  return { prop, img: canonicalLandmarkImage(prop.src), style };
}

// Build depth-sorted render entries for the on-screen obstacles. These are
// pushed into the unified render list so the hero/enemies correctly occlude (or
// are occluded by) buildings and trees by screen Y. We also write the role-based
// collision radius back onto the obstacle so movement/bullets use a footprint
// that matches the art that is actually drawn.
function buildObstacleRenderEntries(ctx) {
  const worldProps = hmh('HMH_LEVEL_ENVIRONMENT')?.worldProps ?? [];
  if (!worldProps.length) return [];
  const entries = [];
  for (const o of currentObstacles()) {
    // Draw obstacles within a GENEROUS window. In fullscreen (2560x1440), the
    // visible area is ~±35 tiles wide, so render obstacles out to ±45 tiles for
    // zero pop-in. In windowed mode, ±18 tiles is sufficient.
    const isFullscreen = combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen';
    const renderRadius = isFullscreen ? 45 : 18;
    if (Math.abs(o.worldX - combat.playerMapX) > renderRadius || Math.abs(o.worldY - combat.playerMapY) > renderRadius) continue;
    const resolved = resolveObstacleProp(o, worldProps);
    if (!resolved || !imageReady(resolved.img)) continue;
    const { img, style } = resolved;
    const projected = isoToScreen(o.worldX, o.worldY);
    const targetW = style.targetW;
    const scale = targetW / img.naturalWidth;
    const w = Math.round(img.naturalWidth * scale);
    const drawH = Math.round(img.naturalHeight * scale);
    const baseX = Math.round(projected.x - w / 2);
    const baseY = Math.round(projected.y + style.ground - drawH);
    const shadowW = Math.max(14, w * 0.32);
    entries.push({
      depth: projected.y,
      draw: () => {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Soft contact shadow planted at the prop's true foot line so solid
        // objects read as grounded (was -2, which floated them slightly).
        drawContactShadow(ctx, projected.x, projected.y + style.ground, shadowW, { alpha: 0.28 });
        ctx.drawImage(img, baseX, baseY, w, drawH);
        ctx.restore();
      },
    });
    // Keep the obstacle's collision footprint in sync with the art that is
    // actually drawn (role-based radius), so movement/bullets match the visuals.
    o.radius = style.radius;
  }
  return entries;
}


function drawRoguelikeScene(ctx, width, height) {
  const palette = ['#06142e', '#12072d', '#030711'];
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.55, palette[1]);
  gradient.addColorStop(1, palette[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawParallaxBackground(ctx, width, height);

  // Ground tiles: cover the WHOLE canvas plus a GENEROUS overscan margin so
  // the tile field always extends past the viewport/fullscreen edges — the
  // player should never see where the tiles stop, even at 2560x1440 fullscreen.
  // In fullscreen/expanded modes, render a full 2560x1440 world window so distant
  // biome transitions and scene templates are visible far beyond the immediate view.
  const isFullscreen = combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen';
  const renderWidth = isFullscreen ? Math.max(width, 2560) : width;
  const renderHeight = isFullscreen ? Math.max(height, 1440) : height;
  const corners = [
    screenToIso(0, 0),
    screenToIso(renderWidth, 0),
    screenToIso(0, renderHeight),
    screenToIso(renderWidth, renderHeight),
  ];
  // Generous overscan: ~20 tiles (each tile ~36px wide) = ~720px buffer on each side.
  // This covers the full 2560x1440 render distance plus biome transition zones.
  const OVERSCAN = isFullscreen ? 20 : 6;
  const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - OVERSCAN;
  const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + OVERSCAN;
  const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - OVERSCAN;
  const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + OVERSCAN;
  // One smoothing toggle + cull bounds hoisted OUT of the per-tile loop —
  // drawProductionIsoTile no longer save/restores per tile (huge win at
  // thousands of tiles/frame in fullscreen).
  const cullWidth = isFullscreen ? renderWidth : width;
  const cullHeight = isFullscreen ? renderHeight : height;
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  for (let worldX = minX; worldX <= maxX; worldX += 1) {
    for (let worldY = minY; worldY <= maxY; worldY += 1) {
      const projected = isoToScreen(worldX, worldY);
      // Cheap cull: skip tiles fully off the RENDERED canvas (not just viewport).
      // In fullscreen, renderWidth/renderHeight may exceed actual canvas size.
      if (projected.x < -ISO_TILE_WIDTH || projected.x > cullWidth + ISO_TILE_WIDTH) continue;
      if (projected.y < -ISO_TILE_HEIGHT - 80 || projected.y > cullHeight + ISO_TILE_HEIGHT + 80) continue;
      drawProductionIsoTile(ctx, projected.x, projected.y + 64, worldX, worldY);
    }
  }
  ctx.imageSmoothingEnabled = prevSmoothing;

  // Render roads and transition zones (under obstacles, over ground tiles)
  drawRoadsAndTransitions(ctx, width, height, isFullscreen ? renderWidth : width, isFullscreen ? renderHeight : height);

  // NOTE: the old "18 random production props on a /6 grid with colored-box
  // fallbacks" scatter loop was removed here — it placed props (and ugly
  // fallback rectangles) with no spatial logic, which read as random clutter.
  // World props are now persistent COLLIDABLE obstacles (buildings/trees/objects)
  // placed by the world-obstacle model and folded into the depth-sorted render
  // list below, so the hero/enemies occlude correctly against them.

  // --- Depth-sorted world pass (painter's algorithm for isometric) ---------
  // Everything that lives ON the ground plane (obstacles, pickups, XP gems,
  // enemies, boss, and the hero) is collected into one list and drawn
  // back-to-front by screen Y, so a sprite that is "in front" (lower on screen /
  // larger worldX+worldY) correctly overlaps one that is "behind". Previously
  // these drew in fixed layers (all enemies, then always the player on top) which
  // read as broken in an isometric view. Floor tiles stay underneath; bullets,
  // particles, floating text and HUD stay on top as effects/UI.
  const renderList = [];
  // Persistent collidable obstacles (buildings/trees/objects) depth-sorted with
  // everything else so the player walks behind/in-front of them correctly.
  for (const entry of buildObstacleRenderEntries(ctx)) renderList.push(entry);
  // Animated ambient props (trees/flowers swaying, water rippling, neon flicker,
  // traffic lights, tumbleweeds) depth-sorted with everything else.
  for (const entry of collectAnimatedProps(ctx)) renderList.push(entry);
  const xpShard = productionImage('pickups', 'xp-shard') ?? productionImage('pickups', 'xp-shard-fallback');
  for (const gem of combat.xpGems) {
    const projected = isoToScreen(gem.worldX, gem.worldY);
    const bob = Math.sin((combat.frame + gem.worldX * 13 + gem.worldY * 7) * 0.12) * 3;
    const drawY = projected.y + 10 + bob;
    renderList.push({
      depth: projected.y + 26,
      draw: () => {
        if (imageReady(xpShard)) {
          ctx.drawImage(xpShard, Math.round(projected.x - 16), Math.round(drawY), 32, 32);
        } else {
          ctx.fillStyle = '#19f7ff';
          ctx.fillRect(projected.x - 4, projected.y + 26, 8, 8);
        }
      },
    });
  }
  for (const enemy of combat.enemies) {
    renderList.push({ depth: enemy.y, draw: () => drawSingleEnemy(ctx, enemy) });
  }
  if (combat.boss) {
    renderList.push({ depth: (combat.boss.y ?? GROUND_Y) + 200, draw: () => drawBoss(ctx) });
  }
  // Hero depth = his screen Y (feet). Drawn in-order so enemies below him on
  // screen render in front and enemies above render behind.
  renderList.push({ depth: combat.playerY, draw: () => drawPlayer(ctx) });
  renderList.sort((a, b) => a.depth - b.depth);

  drawPowerUps(ctx);
  for (const entry of renderList) entry.draw();

  // --- Dynamic lighting / shadow pass (Litecoin City After Dark mood) --------
  // Multiply a soft night tint over the world, then punch out warm light pools
  // around the player, light-emitting props, and active muzzle/explosion flashes
  // so the scene reads as a lit nocturnal city instead of flat daylight. Drawn
  // after the world but before bullets/HUD so projectiles + UI stay crisp.
  drawSceneLighting(ctx, width, height);

  drawBullets(ctx);
  drawParticles(ctx);
  drawFloatingTexts(ctx);
  drawHud(ctx);

  if (combat.levelUpPaused) {
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillRect(0, 0, width, height);
    const modalFrame = productionImage('ui', 'level-up-modal-frame');
    // Responsive modal sizing: max 90% of canvas, centered
    const maxModalWidth = Math.min(360, width * 0.9);
    const maxModalHeight = Math.min(236, height * 0.85);
    const modalX = Math.round((width - maxModalWidth) / 2);
    const modalY = Math.round((height - maxModalHeight) / 2);
    if (imageReady(modalFrame)) ctx.drawImage(modalFrame, modalX, modalY, maxModalWidth, maxModalHeight);
    // Responsive text
    const titleSize = Math.max(16, Math.min(24, width / 30));
    const bodySize = Math.max(11, Math.min(13, width / 50));
    ctx.fillStyle = '#ffe84d';
    ctx.font = `${titleSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL UP - CHOOSE AUGMENT', Math.round(width / 2), modalY + Math.round(maxModalHeight * 0.16));
    ctx.font = `${bodySize}px monospace`;
    ctx.fillStyle = '#f9f7ff';
    ctx.fillText('Game is paused. Pick one of two random +5% upgrades or use your reroll.', Math.round(width / 2), modalY + Math.round(maxModalHeight * 0.35));
    ctx.textAlign = 'left';
  }
}

// Build the list of active light sources in screen space for this frame: the
// player (cool hard-money glow), light-emitting animated props (lamp/neon/
// traffic), and a brief muzzle flash while firing. Each is {x,y,r,warm}.
function collectLightSources() {
  const lights = [];
  // Player: NO persistent ambient halo (the old always-on cool pool read as a
  // "glowing effect around the player"). Only a brief, small muzzle flash while
  // actually firing, so shots still pop without ringing the hero in blue.
  const firing = (combat.fireFlash ?? 0) > 0;
  if (firing) {
    lights.push({ x: combat.playerX + 14, y: combat.playerY - 14, r: 70, warm: true, muzzle: true });
  }
  // Warm light pools come ONLY from real, drawn obstacles that are plausibly
  // light-emitting (a building's windows, a vehicle's lights) in town/road
  // biomes — never a phantom lattice over bare ground. This kills the old
  // "glow on empty grass / TV-off-but-glowing in 12 random spots" artifact.
  const worldProps = hmh('HMH_LEVEL_ENVIRONMENT')?.worldProps ?? [];
  if (worldProps.length) {
    const LIT_BIOMES = new Set(['town', 'road', 'pavement']);
    let emitted = 0;
    for (const o of currentObstacles()) {
      if (emitted >= 10) break; // cap cost
      if (!LIT_BIOMES.has(o.biome)) continue;
      if (Math.abs(o.worldX - combat.playerMapX) > 12 || Math.abs(o.worldY - combat.playerMapY) > 12) continue;
      const resolved = resolveObstacleProp(o, worldProps);
      if (!resolved || !imageReady(resolved.img)) continue;
      // Only buildings (lit windows) and vehicles (head/tail lights) emit.
      const role = resolved.prop?.role;
      if (role !== 'building' && role !== 'vehicle') continue;
      const projected = isoToScreen(o.worldX, o.worldY);
      const h = Math.abs(((o.worldX * 374761393) ^ (o.worldY * 668265263)) >>> 0);
      const flicker = 0.9 + 0.1 * Math.sin((combat.frame + (h % 17)) * 0.18);
      const r = (role === 'building' ? 96 : 64) * flicker;
      const yOff = role === 'building' ? -40 : 4; // building glow sits up at windows
      lights.push({ x: projected.x, y: projected.y + yOff, r, warm: true });
      emitted += 1;
    }
  }
  return lights;
}

// Night ambient + carved light pools. destination-out erases the dark overlay
// where lights are, leaving soft lit circles over the world.
function drawSceneLighting(ctx, width, height) {
  const lights = collectLightSources();
  ctx.save();
  // 1) Night tint over the whole world (deep indigo). Kept light now that the
  //    player has no carved light pool, so the unlit hero stays clearly visible.
  ctx.fillStyle = 'rgba(6, 10, 28, 0.22)';
  ctx.fillRect(0, 0, width, height);
  // 2) Carve light pools out of the darkness.
  ctx.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    g.addColorStop(0, 'rgba(0,0,0,0.92)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // 3) Additive warm/cool tint inside the light pools for colored glow.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    const tint = l.warm ? 'rgba(255, 176, 64,' : 'rgba(64, 200, 255,';
    g.addColorStop(0, `${tint} 0.18)`);
    g.addColorStop(1, `${tint} 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // 4) Edge vignette + atmospheric fog: darken the screen edges with a soft
  // radial falloff. This hides the abrupt end of the tiled world, focuses the
  // eye on the player at center, and makes the darker ground accents read as
  // intentional nocturnal mood instead of stray glitch patches.
  // The gradient only depends on canvas size, so it's cached and rebuilt only
  // on resize instead of being re-created 60x/second.
  ctx.save();
  if (!drawSceneLighting._vg || drawSceneLighting._vgW !== width || drawSceneLighting._vgH !== height) {
    const vg = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.30,
      width / 2, height / 2, Math.max(width, height) * 0.72,
    );
    vg.addColorStop(0, 'rgba(4, 8, 22, 0)');
    vg.addColorStop(0.7, 'rgba(4, 8, 22, 0.30)');
    vg.addColorStop(1, 'rgba(3, 6, 18, 0.72)');
    drawSceneLighting._vg = vg;
    drawSceneLighting._vgW = width;
    drawSceneLighting._vgH = height;
  }
  ctx.fillStyle = drawSceneLighting._vg;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawCombatScene(timestamp = 0) {
  const canvas = dom.combatCanvas;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  // Keep the isometric world centered on the player for whatever size the canvas
  // currently is (default 760x340, but DPR/fullscreen can change it).
  combat.viewCenterX = width / 2;
  combat.viewCenterY = height / 2;

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

  // --- Screen shake (juice): decays each frame, applied as a small translate. ---
  combat.shake = (combat.shake ?? 0) * 0.82;
  if (combat.fireFlash > 0) combat.fireFlash -= 1;
  if (combat.shake < 0.15) combat.shake = 0;
  const shakeApplied = combat.shake > 0;
  if (shakeApplied) {
    const ang = Math.random() * Math.PI * 2;
    const mag = combat.shake;
    ctx.save();
    ctx.translate(Math.cos(ang) * mag, Math.sin(ang) * mag);
  }

  if (combat.roguelikeRun) {
    drawRoguelikeScene(ctx, width, height);
  } else {
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
  }

  if (shakeApplied) ctx.restore();

  requestAnimationFrame(drawCombatScene);
}

function drawEnvironmentLayer(ctx, layer, width) {
  if (!imageReady(layer.image)) return false;
  const naturalRatio = layer.naturalSize?.[0] && layer.naturalSize?.[1]
    ? layer.naturalSize[0] / layer.naturalSize[1]
    : layer.image.naturalWidth / Math.max(1, layer.image.naturalHeight);
  const scaledWidth = Math.max(width * 1.18, Math.round(layer.h * naturalRatio));
  const scrollSpeed = layer.speed ?? 0.35;
  const drift = layer.animation === 'slow-drift' ? Math.sin(combat.frame * 0.006) * 8 : 0;
  const offset = -((combat.scroll * scrollSpeed + drift) % scaledWidth);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.globalCompositeOperation = layer.role === 'background' ? 'source-over' : 'multiply';
  for (let x = offset - scaledWidth; x < width + scaledWidth; x += scaledWidth) {
    ctx.drawImage(layer.image, Math.round(x), layer.y, scaledWidth, layer.h);
  }
  ctx.restore();
  return true;
}

function drawableEnvironmentProps(props = []) {
  return props.filter((prop) => !prop.role?.includes('scenic-prop-card'));
}

function drawAmbientEnvironmentProps(ctx, width, height, environmentStage) {
  const props = drawableEnvironmentProps(environmentStage?.props);
  if (!props.length) return;
  for (const [index, prop] of props.entries()) {
    const draw = prop.draw ?? {};
    const drawWidth = draw.width ?? 118;
    const drawHeight = draw.height ?? 118;
    const scrollSpeed = draw.scrollSpeed ?? 0.42;
    const wrap = width + (draw.spacing ?? 320);
    const rawX = (draw.slotOffset ?? 140) + index * (draw.spacing ?? 280) - combat.scroll * scrollSpeed;
    const x = ((rawX % wrap) + wrap) % wrap - drawWidth * 0.5;
    const sway = prop.animation?.includes('sway') ? Math.sin((combat.frame + index * 23) * 0.045) * 3 : 0;
    const bob = prop.animation?.includes('heat') ? Math.sin((combat.frame + index * 17) * 0.035) * 1.8 : 0;
    const flicker = prop.animation?.includes('flicker') || prop.animation?.includes('spark')
      ? 0.78 + Math.sin((combat.frame + index * 31) * 0.21) * 0.12
      : 0.86;
    const y = Math.min(height - drawHeight - 6, GROUND_Y - drawHeight + (draw.groundOffset ?? 8) + bob);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = Math.max(0.45, Math.min(1, flicker));
    ctx.globalCompositeOperation = prop.role?.includes('prop-card') || prop.role?.includes('vehicle')
      ? 'multiply'
      : 'source-over';
    if (prop.animation?.includes('sway')) {
      ctx.translate(Math.round(x + drawWidth / 2), Math.round(y + drawHeight));
      ctx.rotate((sway / Math.max(1, drawHeight)) * 0.16);
      if (imageReady(prop.image)) {
        ctx.drawImage(prop.image, Math.round(-drawWidth / 2), -drawHeight, drawWidth, drawHeight);
      } else {
        ctx.fillStyle = environmentStage.palette?.[2] ?? '#8b6a3c';
        ctx.fillRect(Math.round(-drawWidth / 2), -drawHeight, drawWidth, drawHeight);
      }
    } else if (imageReady(prop.image)) {
      ctx.drawImage(prop.image, Math.round(x + sway), Math.round(y), drawWidth, drawHeight);
    } else {
      ctx.fillStyle = environmentStage.palette?.[2] ?? '#8b6a3c';
      ctx.fillRect(Math.round(x + sway), Math.round(y), drawWidth, drawHeight);
    }
    ctx.restore();
  }
}

function drawBackground(ctx, width, height) {
  const level = currentLevel();
  const environmentStage = currentLevelOneEnvironmentStage();
  const palette = environmentStage?.palette ?? ['#06142e', '#12072d', '#030711'];
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette[0] ?? '#06142e');
  gradient.addColorStop(0.58, palette[1] ?? '#12072d');
  gradient.addColorStop(1, '#030711');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const generatedLayers = environmentStage?.layers ?? combatArt.parallax[level.id] ?? combatArt.parallax['level-the-slums'];
  const drewGeneratedArt = generatedLayers?.every((layer) => drawEnvironmentLayer(ctx, layer, width));

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

  const ground = environmentStage?.ground;
  ctx.fillStyle = ground?.roadColor ?? '#101827';
  ctx.fillRect(0, GROUND_Y + 34, width, height - GROUND_Y - 34);
  ctx.fillStyle = environmentStage?.palette?.[0] ?? '#1a2440';
  ctx.fillRect(0, GROUND_Y + 8, width, 34);
  ctx.fillStyle = ground?.stripeColor ?? '#ffe84d';
  for (let x = -80; x < width + 120; x += 80) {
    ctx.fillRect((x - combat.scroll * 1.2) % (width + 80), GROUND_Y + 46, 42, 6);
  }
  drawAmbientEnvironmentProps(ctx, width, height, environmentStage);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#19f7ff';
  const label = environmentStage ? `${level.title} // ${environmentStage.title}` : level.title;
  ctx.fillText(label.toUpperCase(), 20, height - 18);
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
    const x = ((i * 190 + 240) - combat.scroll * 0.36) % 900;
    const propSprite = productionPropForIndex(i);
    if (imageReady(propSprite?.image)) {
      drawProductionIsoProp(ctx, propSprite, x + 30, GROUND_Y + 5, i);
    } else {
      ctx.fillStyle = i % 2 ? 'rgba(36,48,79,.42)' : 'rgba(45,26,70,.38)';
      ctx.fillRect(x, GROUND_Y - 34 - (i % 3) * 12, 48, 42 + (i % 3) * 12);
      ctx.fillStyle = 'rgba(25,247,255,.72)';
      ctx.fillText(environment.props[i].slice(0, 9).toUpperCase(), x + 4, GROUND_Y - 10);
    }
  }

  for (const platform of combat.platforms) {
    ctx.fillStyle = '#1e3358';
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = '#19f7ff';
    ctx.fillRect(platform.x, platform.y, platform.w, 3);
    ctx.fillStyle = 'rgba(255,232,77,.36)';
    for (let x = platform.x + 8; x < platform.x + platform.w - 8; x += 24) ctx.fillRect(x, platform.y + 8, 12, 3);
  }

  for (const prop of combat.props) {
    if (prop.kind === 'gap') {
      ctx.fillStyle = '#02040a';
      ctx.fillRect(prop.x, GROUND_Y + 9, prop.w, 74);
      ctx.fillStyle = '#ff476f';
      ctx.fillRect(prop.x, GROUND_Y + 7, prop.w, 4);
      ctx.fillStyle = '#ffe84d';
      ctx.fillText('GAP', prop.x + 8, GROUND_Y + 31);
      continue;
    }
    const box = propHitbox(prop);
    const hpRatio = Math.max(0, Math.min(1, (prop.hp ?? prop.maxHp ?? 1) / (prop.maxHp ?? prop.hp ?? 1)));
    const propSpriteSlug = prop.kind === 'barrel' ? 'explosive-barrel' : prop.kind === 'wall' ? 'traffic-barricade' : prop.cover ? 'wood-crate' : 'dumpster';
    const propSprite = combatArt.production?.props?.[propSpriteSlug] ?? null;
    if (imageReady(propSprite?.image)) {
      const drawWidth = Math.max(box.w + 24, Math.round((propSprite.width ?? 80) * 0.72));
      const drawHeight = Math.max(box.h + 26, Math.round((propSprite.height ?? 80) * 0.72));
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = prop.hp !== undefined ? 0.86 + hpRatio * 0.14 : 1;
      ctx.drawImage(propSprite.image, Math.round(box.x + box.w / 2 - drawWidth / 2), Math.round(box.y + box.h - drawHeight + 8), drawWidth, drawHeight);
      ctx.restore();
    } else if (prop.kind === 'barrel') {
      ctx.fillStyle = '#ff7b2f';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = '#ffe84d';
      ctx.fillRect(box.x + 4, box.y + 10, box.w - 8, 6);
      ctx.fillStyle = '#080616';
      ctx.fillText('BOOM', box.x + 2, box.y + 26);
    } else if (prop.kind === 'wall') {
      ctx.fillStyle = '#6e7898';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = '#283147';
      for (let y = box.y + 8; y < box.y + box.h; y += 16) ctx.fillRect(box.x, y, box.w, 2);
    } else {
      ctx.fillStyle = prop.cover ? '#79512c' : '#4c365f';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = prop.cover ? '#ffe84d' : '#19f7ff';
      ctx.fillRect(box.x + 6, box.y + 7, box.w - 12, 3);
      ctx.fillText(prop.cover ? 'COVER' : 'CRATE', box.x + 4, box.y + box.h - 7);
    }
    if (prop.hp !== undefined) {
      ctx.fillStyle = '#45ff8a';
      ctx.fillRect(box.x, box.y - 6, box.w * hpRatio, 3);
    }
  }
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
  const heroActorId = combat.characterId === 'lilly' ? 'lilly' : 'lester';
  if (HMH_ACTOR_REGISTRY.has(heroActorId)) {
    const actor = HMH_ACTOR_REGISTRY.get(heroActorId);
    const state = heroStateFromCombat(combat, GROUND_Y);
    const frame = actor.frame({ state, direction: 'south', clock: combat.frame });
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
  const hero = combatArt.hero;
  const shadowY = combat.roguelikeRun ? y + 3 : GROUND_Y + 2;
  const blink = combat.invulnerableFrames > 0 && Math.floor(combat.invulnerableFrames / 6) % 2 === 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (blink) ctx.globalAlpha = 0.54;

  if (imageReady(heroFrame)) {
    const productionHero = Boolean(hero.productionSlug);
    // Scale: in the iso roguelike the hero is deliberately small (~88px) so the
    // 300px buildings tower over him and the world reads with real scale.
    const isoHero = Boolean(combat.roguelikeRun);
    const drawWidth = isoHero ? 88 : (productionHero ? 132 : 104);
    const drawHeight = isoHero ? 88 : (productionHero ? 132 : 104);
    const drawX = x - drawWidth / 2 + (isoHero ? 8 : (productionHero ? 0 : 0));
    const drawY = y - drawHeight + (isoHero ? 10 : (productionHero ? 16 : 0)) + bob;
    // Contact shadow directly under the hero's feet (no glow). The shadow is an
    // ellipse centered on the foot point (x, y) so the character reads as
    // GROUNDED, not floating. Width tracks the draw size; opacity is soft.
    if (combat.roguelikeRun) {
      // Plant the shadow at the sprite's actual foot line (drawY bottom = y+10),
      // and DON'T add bob so the shadow stays put while the sprite bobs — that
      // sells "grounded" instead of "floating".
      drawContactShadow(ctx, x, y + 10, drawWidth * 0.34, { alpha: 0.4, squash: 0.34 });
    } else {
      ctx.fillStyle = 'rgba(249, 247, 255, 0.72)';
      ctx.fillRect(x + 3, shadowY, 38, 8);
    }
    // Mirror when the animated 8-direction frame says so (west-facing aim), else
    // fall back to keyboard side-scroll facing.
    const flip = heroFrame._flip != null ? heroFrame._flip : playerFacingLeft();
    if (flip) {
      ctx.save();
      ctx.translate(drawX + drawWidth / 2, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(heroFrame, -drawWidth / 2, drawY, drawWidth, drawHeight);
      ctx.restore();
    } else {
      ctx.drawImage(heroFrame, drawX, drawY, drawWidth, drawHeight);
    }
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
  ctx.fillRect(x + 3, shadowY, 38, 8);
  ctx.fillStyle = '#ff476f';
  ctx.fillRect(x + 37, y - 34 + bob, 16, 4);
  ctx.restore();
}

function manifestEnemyKeyFor(enemy) {
  if (enemy.enemyKey && combatArt.enemies[enemy.enemyKey]) return enemy.enemyKey;
  const id = enemy.id ?? '';
  const title = enemy.title ?? '';
  if (id.includes('crypto-bro') || id.includes('crypto') || title.includes('Crypto Bro') || title.includes('KOL') || enemy.class === 'kol-ranged-grunt') return 'cryptoBro';
  if (id.includes('gas-beast') || title.includes('Gas Beast') || enemy.class === 'armored-bruiser' || enemy.aiArchetype === 'gas-cloud-area-denial') return 'gasBeast';
  if (id.includes('trench') || title.includes('Degen') || id.includes('fud') || id.includes('paper') || id.includes('rug')) return 'trenchDegen';
  if (id.includes('bank') || title.includes('Banker') || id.includes('sybil') || id.includes('bot') || id.includes('drone')) return 'evilBanker';
  if (id.includes('warren') || id.includes('spear') || id.includes('boss') || enemy.class === 'armored' || enemy.role === 'armored-pressure') return 'warrenSpearRider';
  return null;
}

function manifestEnemyArtFor(enemy) {
  const key = manifestEnemyKeyFor(enemy);
  const art = key ? combatArt.enemies[key] : null;
  if (!art) return null;
  const moving = enemy.state === 'rushing' || enemy.state === 'seeking-cover';
  const attacking = enemy.tellFrames > 0 || enemy.state === 'melee-tell';
  const frames = attacking
    ? art.animations.attack
    : moving
      ? (art.animations.run?.length ? art.animations.run : art.animations.walk)
      : art.animations.idle;
  const animationName = attacking ? 'attack' : moving ? 'run' : 'idle';
  return selectAnimationFrame(frames, combat.frame + Math.floor(enemy.x), productionAnimationFps(art, animationName, attacking ? 15 : 16))
    ?? art.stills[0]
    ?? art.fallback
    ?? null;
}

function enemyArtFor(enemy) {
  const manifestFrame = manifestEnemyArtFor(enemy);
  if (imageReady(manifestFrame)) return manifestFrame;
  if (enemy.miniBoss) return null;
  if (enemy.id?.includes('goblin')) return combatArt.enemies.goblin;
  if (enemy.id?.includes('wisp') || enemy.class?.includes('flying')) return combatArt.enemies.wisp;
  if (enemy.id?.includes('scam') || enemy.id?.includes('bot')) return combatArt.enemies.scambot;
  if (enemy.class === 'armored' || enemy.id?.includes('bruiser')) return combatArt.enemies.bruiser;
  return combatArt.enemies.goblin;
}

function drawEnemies(ctx) {
  for (const enemy of combat.enemies) {
    drawSingleEnemy(ctx, enemy);
  }
}

// --- Animated PixelLab roster (idle/walk/run/attack/death animations) ---------
// Harvested 8-dir characters currently expose animated SOUTH frames; we play
// those as the animation layer for heroes/enemies/bosses (a big upgrade over
// static stills). Each game entity is mapped to a roster key, and its live
// combat state is mapped to the best-matching animation name with fallbacks.
const rosterFrameCache = new Map();
function rosterFrame(src) {
  if (!src) return null;
  if (!rosterFrameCache.has(src)) rosterFrameCache.set(src, loadImageAsset(src));
  return rosterFrameCache.get(src);
}

// Map a game enemy/boss to a roster character key by id/title keywords.
function rosterKeyForEntity(entity, role) {
  const hay = `${entity.id ?? ''} ${entity.title ?? ''} ${entity.enemyKey ?? ''} ${entity.class ?? ''}`.toLowerCase();
  if (role === 'boss') {
    if (hay.includes('whale') || hay.includes('bank') || hay.includes('tycoon')) return 'whale-dumper-boss';
    return 'whale-dumper-boss';
  }
  if (hay.includes('goblin') || hay.includes('fud') || hay.includes('paper') || hay.includes('degen') || hay.includes('rug')) return 'fud-goblin';
  if (hay.includes('wisp') || hay.includes('gas') || hay.includes('cloud') || hay.includes('flying')) return 'gas-fee-wisp';
  // Default grunt animation set.
  return 'fud-goblin';
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

function enemyAnimState(enemy) {
  if (enemy.hp <= 0) return ['death'];
  if (enemy.tellFrames > 0 || enemy.attackTimer < 18) return ['attack', 'attack-tell', 'walk', 'idle'];
  const moving = enemy.state === 'chase-player' || enemy.state === 'rushing';
  return moving ? ['walk', 'idle'] : ['idle', 'walk'];
}

function roguelikeEnemyAnimatedFrame(enemy) {
  if (!combat.roguelikeRun) return null;
  const role = enemy.miniBoss ? 'boss' : 'enemy';
  const key = rosterKeyForEntity(enemy, role);
  const roster = hmh('HMH_ANIMATED_ROSTER')?.[key];
  const phase = Math.round((enemy.mapX ?? 0) * 7 + (enemy.mapY ?? 0) * 13);
  // Enemy faces the player (screen-space iso vector).
  const facing = facingFromVector(
    (combat.playerMapX ?? 0) - (enemy.mapX ?? 0),
    (combat.playerMapY ?? 0) - (enemy.mapY ?? 0),
  );
  return animatedRosterFrame(roster, enemyAnimState(enemy), { fps: 12, phase, facing });
}

// Hero (Lester) animation state -> roster animation name priority.
function heroAnimState() {
  if (combat.gameOver) return ['death', 'hurt', 'idle'];
  if (combat.invulnerableFrames > 14) return ['hurt', 'idle'];
  const recentlyFired = (combat.fireFlash ?? 0) > 0 || (combat.frame - (combat.lastShotFrame ?? -999)) < 10;
  if ((combat.frame - (combat.lastMeleeFrame ?? -999)) < 14) return ['melee', 'shoot', 'idle'];
  if (recentlyFired) return ['shoot', 'idle'];
  const moving = combat._heroMoving;
  if (moving) return ['run', 'walk', 'idle'];
  return ['idle', 'run'];
}

// Resolve the selected hero's characterId to the richest available animated
// roster key, falling through to art we actually have. New heroes (Lit Commando
// / Lit Valkyrie) prefer their own frames, then their legacy art, then Lester.
// Lock each playable hero to EXACTLY ONE animated roster that has the full
// animation kit. We do NOT fall through to partial rosters: mixing rosters per
// animation state (e.g. idle from one design, shoot from another) is what made
// the hero visibly swap between 3-4 different character designs mid-run.
//
// Asset reality: the complete 8-direction kits (idle/walk/run/shoot/melee/throw/
// hurt/death) live under the 'lester' roster (-> Lit Commando design) and the
// 'lilly' roster (-> Lit Valkyrie design). The partial 'lit-commando'/'lit-
// valkyrie' rosters are intentionally NOT used so each hero stays one design.
const HERO_LOCKED_ROSTER = Object.freeze({
  'lit-commando': 'lit-commando',
  lester: 'lester',
  'lit-valkyrie': 'lilly',
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
  for (const dirs of Object.values(anims)) {
    const frames = dirs.south ?? dirs[Object.keys(dirs)[0]] ?? [];
    for (const src of frames) {
      const img = rosterFrame(src);
      if (imageReady(img)) return img;
    }
  }
  return null;
}

// Preload every frame of the hero's locked roster at run start so hurt/death/
// melee/throw are decoded BEFORE they're needed (no first-hit pop to old art,
// no pop-in). Cheap: just primes the rosterFrame cache + browser decode.
function preloadHeroRoster(characterId) {
  const key = heroRosterKey(characterId);
  const roster = hmh('HMH_ANIMATED_ROSTER')?.[key];
  const anims = roster?.animations ?? {};
  for (const dirs of Object.values(anims)) {
    for (const frames of Object.values(dirs)) {
      for (const src of frames) rosterFrame(src);
    }
  }
}

// --- Roguelike biome-themed enemy sprites (hmh-enemies-wave) -------------------
// 6 PixelLab enemies, each tied to a biome, drawn as 4-direction stills. We pick
// the enemy whose biome matches the tile the foe is standing on (so a desert run
// shows maxi-zealots, water shows mempool-bot-runners, etc.), and face it using
// the enemy->player vector so foes visibly turn toward Lester.
const enemyWaveImageCache = new Map();
// biome-model biome -> closest enemies-wave biome bucket.
const ENEMY_WAVE_BIOME_ALIAS = {
  town: 'pavement', road: 'pavement', pavement: 'pavement',
  desert: 'sand', sand: 'sand',
  forest: 'grass', grass: 'grass',
  rocky: 'rock', rock: 'rock',
  gravel: 'gravel',
  water: 'water',
};
const ENEMY_WAVE_BY_BIOME = (() => {
  const byBiome = {};
  for (const e of Object.values(hmh('HMH_ENEMIES_WAVE')?.enemies ?? {})) byBiome[e.biome] = e;
  return byBiome;
})();
const ENEMY_WAVE_LIST_GET = () => Object.values(hmh('HMH_ENEMIES_WAVE')?.enemies ?? {});

function enemyWaveStill(src) {
  if (!src) return null;
  if (!enemyWaveImageCache.has(src)) enemyWaveImageCache.set(src, loadImageAsset(src));
  return enemyWaveImageCache.get(src);
}

// Map an enemy->player vector to one of the 4 generated facings.
function enemyFacingTowardPlayer(enemy) {
  const dx = combat.playerMapX - enemy.mapX;
  const dy = combat.playerMapY - enemy.mapY;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

function roguelikeEnemyWaveArt(enemy) {
  if (!combat.roguelikeRun || !ENEMY_WAVE_LIST_GET().length) return null;
  // Resolve which wave enemy to show: stable per-enemy by its biome tile, with a
  // deterministic fallback so every foe still gets a themed sprite.
  if (!enemy._waveEnemyId) {
    const seed = combat.roguelikeRun?.seed ?? 0;
    const biome = biomeAt(seed, Math.round(enemy.mapX), Math.round(enemy.mapY));
    const aliased = ENEMY_WAVE_BIOME_ALIAS[biome] ?? null;
    const chosen = (aliased && ENEMY_WAVE_BY_BIOME[aliased])
      || ENEMY_WAVE_LIST_GET()[(Math.abs(Math.round(enemy.mapX * 7 + enemy.mapY * 13))) % ENEMY_WAVE_LIST_GET().length];
    enemy._waveEnemyId = chosen?.id ?? null;
  }
  const wave = enemy._waveEnemyId ? hmh('HMH_ENEMIES_WAVE')?.enemies[enemy._waveEnemyId] : null;
  if (!wave) return null;
  const facing = enemyFacingTowardPlayer(enemy);
  const src = wave.stills[facing] ?? wave.stills[wave.defaultDirection] ?? wave.stills.south;
  return enemyWaveStill(src);
}

function drawSingleEnemy(ctx, enemy) {
    const isMini = enemy.miniBoss;
    const w = isMini ? 68 : enemy.class === 'armored' ? 42 : 30;
    const h = isMini ? 62 : enemy.class?.includes('flying') ? 28 : 36;
    // Ground contact shadow so enemies read as planted, not floating. The sprite
    // foot line is at enemy.y + 12 (ey bottom); plant the shadow THERE so it sits
    // under the feet rather than 10px above them (the old +2 floated enemies).
    // Flying foes cast a smaller, fainter shadow a bit lower (they're airborne).
    const flying = Boolean(enemy.class?.includes('flying'));
    const footX = enemy.x + w / 2;
    const sizeMul = enemy.sizeScale ?? 1.0;
    if (flying) {
      drawContactShadow(ctx, footX, enemy.y + 22, Math.round((isMini ? 30 : 18) * sizeMul), { alpha: 0.16, squash: 0.3 });
    } else {
      drawContactShadow(ctx, footX, enemy.y + 12, Math.round((isMini ? 34 : enemy.class === 'armored' ? 24 : 18) * sizeMul), { alpha: 0.34, squash: 0.36 });
    }
    // Priority: animated roster frame (idle/walk/attack/death motion) > biome-themed
    // wave still (directional variety) > pipeline/legacy art. Minis use boss art.
    const animFrame = roguelikeEnemyAnimatedFrame(enemy);
    const waveFrame = isMini ? null : roguelikeEnemyWaveArt(enemy);
    const enemyFrame = (imageReady(animFrame) ? animFrame : null)
      ?? (imageReady(waveFrame) ? waveFrame : null)
      ?? pipelineActorFrame(enemy) ?? enemyArtFor(enemy);
    if (imageReady(enemyFrame)) {
      const isAnim = enemyFrame === animFrame;
      const isWave = enemyFrame === waveFrame;
      const enemyKey = manifestEnemyKeyFor(enemy);
      const productionEnemy = Boolean(enemyKey && combatArt.enemies[enemyKey]?.productionSlug);
      // Apply sizeScale (0.5x-2.0x) for enemy variety
      const sizeMul = enemy.sizeScale ?? 1.0;
      const drawSize = Math.round(((isAnim || isWave) ? (enemy.elite ? 104 : 88) : productionEnemy ? (isMini ? 132 : enemy.class === 'armored' ? 112 : 98) : 78) * sizeMul);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      const ex = Math.round(enemy.x + w / 2 - drawSize / 2);
      const ey = Math.round(enemy.y - drawSize + 12);
      if (enemyFrame._flip) {
        ctx.translate(ex + drawSize / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(enemyFrame, -drawSize / 2, ey, drawSize, drawSize);
      } else {
        ctx.drawImage(enemyFrame, ex, ey, drawSize, drawSize);
      }
      // Universal hit-flash: briefly tint the sprite white on damage so EVERY
      // enemy (even those without a roster 'hurt' animation) shows clear combat
      // feedback. Uses the sprite as a mask via source-atop.
      if ((enemy.hitFlash ?? 0) > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = Math.min(0.8, enemy.hitFlash / 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ex, ey, drawSize, drawSize);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = isMini ? '#ff7b2f' : enemy.class?.includes('flying') ? '#6d3cff' : enemy.class === 'armored' ? '#aab6d3' : '#ff476f';
      ctx.fillRect(enemy.x, enemy.y - h, w, h);
      ctx.fillStyle = '#080616';
      ctx.fillRect(enemy.x + 6, enemy.y - h + 9, 7, 7);
    }
    ctx.fillStyle = '#45ff8a';
    const hpBarW = Math.round(w * sizeMul);
    ctx.fillRect(enemy.x, enemy.y - h - 8, hpBarW * Math.max(0, enemy.hp / enemy.maxHp), 4);
    if (enemy.attackTimer < 18) {
      ctx.fillStyle = '#ffe84d';
      const hpBarW = Math.round(w * sizeMul);
      ctx.fillRect(enemy.x - 3, enemy.y - h - 15, hpBarW + 6, 4);
    }
}

function bossArtFor(boss) {
  if (!boss) return null;
  // Prefer the durable pipeline's generated boss art when available.
  const pipelineFrame = pipelineActorFrame(boss, { boss: true });
  if (pipelineFrame) return pipelineFrame;
  const id = `${boss.id ?? ''} ${boss.title ?? ''}`.toLowerCase();
  const key = id.includes('whale') || id.includes('bank') || id.includes('tycoon')
    ? 'bitWhale'
    : id.includes('chain') || id.includes('reaper')
      ? 'chainReaper'
      : 'warrenSpearRider';
  const art = combatArt.enemies[key];
  if (!art) return null;
  const attacking = boss.attackTimer < 34;
  const animationName = attacking ? 'shoot' : 'idle';
  const frames = attacking ? (art.animations.shoot ?? art.animations.attack) : art.animations.idle;
  return selectAnimationFrame(frames, combat.frame + Math.floor(boss.x), productionAnimationFps(art, animationName, attacking ? 18 : 12))
    ?? art.stills?.[0]
    ?? art.fallback
    ?? null;
}

function drawBoss(ctx) {
  if (!combat.boss) return;
  const x = combat.boss.x;
  const bossFrame = bossArtFor(combat.boss);
  if (imageReady(bossFrame)) {
    const phaseScale = 1 + (combat.boss.phase - 1) * 0.08;
    const drawWidth = Math.round(150 * phaseScale);
    const drawHeight = Math.round(150 * phaseScale);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (combat.boss.attackTimer < 34) {
      const telegraph = productionVfxFrame('boss-telegraph-ring');
      if (imageReady(telegraph)) ctx.drawImage(telegraph, x - 26, GROUND_Y - 92, 178, 112);
    }
    ctx.drawImage(bossFrame, x - 28, GROUND_Y - drawHeight - 2, drawWidth, drawHeight);
    ctx.restore();
  } else {
    ctx.fillStyle = combat.boss.phase === 3 ? '#ff236d' : combat.boss.phase === 2 ? '#ff7b2f' : '#7b2fff';
    ctx.fillRect(x, GROUND_Y - 108, 94, 90);
    ctx.fillStyle = '#ffe84d';
    ctx.fillRect(x + 12, GROUND_Y - 130, 68, 18);
  }
  ctx.fillStyle = '#45ff8a';
  ctx.fillRect(x, GROUND_Y - 143, 94 * Math.max(0, combat.boss.hp / combat.boss.maxHp), 6);
  ctx.fillStyle = '#f9f7ff';
  ctx.font = '12px monospace';
  ctx.fillText(`${combat.boss.title} P${combat.boss.phase}`, x - 24, GROUND_Y - 154);
}

function drawBullets(ctx) {
  for (const bullet of combat.bullets) {
    const trail = productionVfxFrame('projectile-trail', combat.frame + Math.floor(bullet.x));
    const w = bullet.weaponId === 'hash-rail' ? 34 : Math.round(20 * (combat.roguelikeRun?.stats.bulletSize ?? 1));
    const h = bullet.weaponId === 'hash-rail' ? 7 : 5;
    const drawX = bullet.x - (combat.roguelikeRun ? w / 2 : 0);
    const drawY = bullet.y - (combat.roguelikeRun ? h / 2 : 0);
    if (imageReady(trail)) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(trail, Math.round(drawX - 18), Math.round(drawY - 18), bullet.weaponId === 'hash-rail' ? 92 : 70, 36);
      ctx.restore();
    } else {
      ctx.fillStyle = bullet.weaponId === 'hash-rail' ? '#19f7ff' : bullet.weaponId === 'oracle-slayer' ? '#b86cff' : '#ffe84d';
      ctx.fillRect(drawX, drawY, w, h);
    }
  }
  ctx.fillStyle = '#ff476f';
  for (const shot of combat.enemyShots) ctx.fillRect(shot.x - (combat.roguelikeRun ? 7 : 0), shot.y - (combat.roguelikeRun ? 3 : 0), 14, 5);
}

// Maps power-up ids to the PixelLab fx-powerups-wave pickup icons. Falls back to
// the older production pickup art (and finally the vector capsule) when missing.
const fxPowerupIconCache = new Map();
const FX_POWERUP_ICON_BY_ID = Object.freeze({
  // Power-up id (LESTER_BLASTER_POWER_UPS) -> fx-powerups-wave icon slug. The
  // slugs match the ids 1:1 for most; map the few that differ. Complete coverage
  // so every pickup shows its dedicated animated icon, not the vector fallback.
  'health-pack': 'health-pack',
  'grenade-crate': 'grenade-crate',
  'bonus-life': 'bonus-life',
  'spread-ltc-chip': 'spread-ltc-chip',
  'hash-rail-core': 'hash-rail-core',
  'score-multiplier': 'score-multiplier',
  'shield-cache': 'shield-cache',
  'ammo-cache': 'ammo-cache',
  'ltc-cache': 'ltc-cache',
  'magnet-surge': 'magnet-surge',
  'time-dilation': 'time-dilation',
  'berserk-candle': 'berserk-candle',
  'nuke-liquidation': 'nuke-liquidation',
});
function fxPowerupIcon(slug) {
  if (!slug) return null;
  const src = hmh('HMH_FX_POWERUPS_WAVE')?.powerups?.[slug];
  if (!src) return null;
  if (!fxPowerupIconCache.has(src)) fxPowerupIconCache.set(src, loadImageAsset(src));
  return fxPowerupIconCache.get(src);
}

function powerUpIconFor(power) {
  // Prefer the dedicated PixelLab pickup icon for this specific power-up id.
  const fxSlug = FX_POWERUP_ICON_BY_ID[power.id] ?? null;
  const fxIcon = fxPowerupIcon(fxSlug);
  if (imageReady(fxIcon)) return fxIcon;
  if (power.effect === 'heal') return productionImage('pickups', 'health-pack') ?? combatArt.icons.health;
  if (power.effect === 'shield') return productionImage('pickups', 'crypto-bomb') ?? combatArt.icons.shield;
  if (power.effect === 'ammo') return productionImage('pickups', 'ammo-pack') ?? combatArt.icons.ammo;
  if (power.effect === 'life') return productionImage('pickups', 'crypto-bomb') ?? combatArt.icons.oneUp;
  if (power.effect === 'weapon') return productionImage('weapons', combat.weaponId) ?? productionImage('weapons', 'coin-blaster') ?? combatArt.icons.weapon;
  if (power.effect === 'scoreMultiplier' || power.effect === 'scoreBonus') return productionImage('pickups', 'xp-shard') ?? productionImage('pickups', 'xp-shard-fallback') ?? combatArt.icons.score;
  return fxIcon ?? null;
}

function drawPowerUps(ctx) {
  for (const power of combat.powerUps) {
    const icon = powerUpIconFor(power);
    if (imageReady(icon)) {
      // Animate the pickup so it reads as a live, collectible power-up: a gentle
      // vertical bob + a soft pulsing glow halo tinted by effect category.
      const phase = combat.frame * 0.12 + (power.x + power.y) * 0.05;
      const bob = Math.sin(phase) * 3;
      const pulse = 0.5 + 0.5 * Math.sin(phase * 1.3);
      const halo = power.effect === 'heal' || power.effect === 'life' ? '#45ff8a'
        : power.effect === 'weapon' ? '#19f7ff'
        : power.effect === 'shield' ? '#6fb4ff'
        : power.effect === 'scoreMultiplier' || power.effect === 'scoreBonus' ? '#ffe84d'
        : '#ff9b3f';
      const cx = power.x + 12;
      const cy = power.y - 10 + bob;
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.22 * pulse;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22 + 4 * pulse);
      g.addColorStop(0, halo);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 22 + 4 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(icon, power.x - 8, power.y - 30 + bob, 40, 40);
      ctx.restore();
    } else {
      // Clean fallback: a glowing diamond capsule with a symbol (no raw 2-letter
      // text box, which read as a stray "CR" debug marker in playtests).
      const cx = power.x + 12;
      const cy = power.y - 4;
      const color = power.effect === 'heal' ? '#45ff8a' : power.effect === 'weapon' ? '#19f7ff' : power.effect === 'life' ? '#ffe84d' : '#ff7b2f';
      const glyph = power.effect === 'heal' ? '+' : power.effect === 'weapon' ? '⚔' : power.effect === 'life' ? '♥' : '✦';
      const bob = Math.sin(combat.frame * 0.12 + power.x) * 2;
      ctx.save();
      ctx.translate(cx, cy + bob);
      // soft glow
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
      g.addColorStop(0, `${color}`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // diamond capsule
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(11, 0); ctx.lineTo(0, 12); ctx.lineTo(-11, 0); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
      // symbol
      ctx.fillStyle = '#080616';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 0, 1);
      ctx.restore();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }
}

function drawParticleSprite(ctx, particle) {
  // Generated FX image overlay (scale-up + fade).
  if (particle.type === 'fxImage') {
    const img = particle.fxImage;
    if (!imageReady(img)) return false;
    const t = 1 - Math.max(0, Math.min(1, particle.life / Math.max(0.01, particle.maxLife ?? particle.life ?? 1)));
    const scale = (particle.scaleFrom ?? 0.6) + ((particle.scaleTo ?? 1.2) - (particle.scaleFrom ?? 0.6)) * t;
    const size = (particle.size ?? 64) * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / Math.max(0.01, particle.maxLife ?? 1)));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, Math.round(particle.x - size / 2), Math.round(particle.y - size / 2), size, size);
    ctx.restore();
    return true;
  }
  const sprite = combatArt.production?.vfx?.[particle.type];
  if (!sprite?.frames?.length) return false;
  const lifeRatio = 1 - Math.max(0, Math.min(1, particle.life / Math.max(0.01, particle.maxLife ?? particle.life ?? 1)));
  const frameIndex = Math.min(sprite.frames.length - 1, Math.floor(lifeRatio * sprite.frames.length));
  const image = sprite.frames[frameIndex]?.image;
  if (!imageReady(image)) return false;
  const size = particle.size ?? Math.max(sprite.frames[frameIndex]?.width ?? 32, sprite.frames[frameIndex]?.height ?? 32);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = Math.max(0.25, Math.min(1, (particle.life / Math.max(0.01, particle.maxLife ?? particle.life ?? 1)) + 0.1));
  if (particle.rotation) {
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  } else {
    ctx.drawImage(image, Math.round(particle.x - size / 2), Math.round(particle.y - size / 2), size, size);
  }
  ctx.restore();
  return true;
}

function drawParticles(ctx) {
  for (const particle of combat.particles) {
    if (drawParticleSprite(ctx, particle)) continue;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
}

function drawFloatingTexts(ctx) {
  for (const text of combat.floatingTexts) {
    const size = text.size ?? 12;
    const fade = Math.min(1, text.life / 24);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = `${text.crit ? 'bold ' : ''}${size}px monospace`;
    ctx.textAlign = 'center';
    if (text.crit) {
      // Outline crits for punch.
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(text.text, text.x, text.y);
    }
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  }
  ctx.textAlign = 'left';
}

// Readable HUD label/value text with outline + drop shadow so it stays legible
// over the canonical parallax background. `value` is drawn brighter than `label`.
function hudStat(ctx, x, y, label, value, color) {
  ctx.save();
  ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  ctx.shadowBlur = 3;
  // dim label
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(label, x, y);
  ctx.fillStyle = 'rgba(214,228,255,0.92)';
  ctx.fillText(label, x, y);
  const labelW = ctx.measureText(label).width;
  // bright value
  ctx.strokeText(value, x + labelW + 8, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x + labelW + 8, y);
  ctx.restore();
}

function drawHud(ctx) {
  // Roguelike run stats are now rendered in the DOM stat bar ABOVE the canvas
  // (renderRoguelikeStatBar) so the gameplay window stays fully visible. The
  // canvas HUD is intentionally empty for the roguelike path.
  if (combat.roguelikeRun) return;
  // Legacy side-scroller fallback HUD (not used by the iso roguelike path).
  const difficulty = getLesterBlasterDifficultyAt(combat.elapsedGameSeconds);
  const weapon = weaponById(combat.weaponId);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#19f7ff';
  ctx.fillText(`RUN ${formatSeconds(combat.elapsedGameSeconds)} // AI ${difficulty.enemyAiLevel}/10 // TIER ${difficulty.tier} // ${combat.fps}FPS`, 20, 28);
  ctx.fillStyle = '#ffe84d';
  ctx.fillText(`HP ${Math.max(0, Math.round(combat.health))} // LIVES ${combat.lives} // SCORE ${combat.score.toLocaleString()} // COMBO ${combat.combo}`, 20, 52);
  ctx.fillStyle = '#45ff8a';
  ctx.fillText(`${(weapon.displayName ?? weapon.title).toUpperCase()} // AMMO ${combat.ammo === Infinity ? '∞' : combat.ammo} // GRENADES ${combat.grenades}`, 20, 76);
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
  renderArcadeMusicPlayer();
}

dom.officialConnectButton.addEventListener('click', enterOfficialArcadeFromSplash);
dom.developerBackstageToggle.addEventListener('click', () => {
  developerBackstageOpen = !developerBackstageOpen;
  renderOfficialApp();
});
dom.officialFreeModeButton.addEventListener('click', () => startOfficialMode('free'));
dom.officialRankedModeButton.addEventListener('click', () => startOfficialMode('ranked'));
dom.officialModeBackButton?.addEventListener('click', () => { playSfxCue('menu-click', 0.05); setOfficialView('cabinet-select'); });
dom.officialCharacterBackButton?.addEventListener('click', () => { playSfxCue('menu-click', 0.05); setOfficialView('mode-select'); });
dom.officialLevelBackButton?.addEventListener('click', () => { playSfxCue('menu-click', 0.05); setOfficialView('character-select'); });
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
dom.combatPauseButton?.addEventListener('click', () => toggleCombatPause());
dom.combatRestartButton?.addEventListener('click', restartCombatRun);
dom.combatMusicButton?.addEventListener('click', toggleCombatMusic);
dom.combatShakeButton?.addEventListener('click', () => {
  gameSettings.screenShake = !gameSettings.screenShake;
  saveGameSettings();
  if (dom.combatShakeButton) dom.combatShakeButton.textContent = gameSettings.screenShake ? 'Shake On' : 'Shake Off';
  playSfxCue('menu-click');
});
dom.combatGoreButton?.addEventListener('click', () => {
  gameSettings.gore = !gameSettings.gore;
  saveGameSettings();
  if (dom.combatGoreButton) dom.combatGoreButton.textContent = gameSettings.gore ? 'Gore On' : 'Gore Off';
  playSfxCue('menu-click');
});
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
dom.arcadeMusicAudio?.addEventListener('loadedmetadata', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('durationchange', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('timeupdate', scheduleArcadeMusicRender);
dom.arcadeMusicAudio?.addEventListener('play', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('pause', renderArcadeMusicPlayer);
dom.arcadeMusicAudio?.addEventListener('ended', () => {
  nextArcadeMusicTrack({ autoplay: true });
});

document.addEventListener('keydown', (event) => {
  // Never hijack keys while the user is typing in a form field (username, etc.).
  const target = event.target;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
    return;
  }
  const key = event.key.toLowerCase();
  if (event.key === 'F10') {
    event.preventDefault();
    tacticalBalanceDebugEnabled = !tacticalBalanceDebugEnabled;
    renderTacticalBalanceDebugOverlay();
    return;
  }
  if (key === 'enter' || key === 'escape') {
    // Only the in-game pause toggle should consume Enter/Escape — and only
    // while actually playing, so menus/forms keep normal behavior.
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
  if (key === 'e') melee();
  if (key === 'f') grenade();
  if (key === 'r') reload();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown', 'control'].includes(key)) {
    event.preventDefault();
    combat.keys.add(key);
  }
});

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown', 'control'].includes(key)) combat.keys.delete(key);
});

dom.combatCanvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

dom.combatCanvas.addEventListener('pointermove', (event) => {
  if (combat.roguelikeRun) updateAimFromPointer(event);
});

dom.combatCanvas.addEventListener('mousedown', (event) => {
  if (combat.roguelikeRun) updateAimFromPointer(event);
  if (combat.paused || combat.gameOver) return;
  if (combat.roguelikeRun) {
    // Roguelike: the gun AUTO-FIRES toward the mouse, so clicks must NOT also
    // shoot (that double-fired). Left click = melee, right click = throw.
    event.preventDefault();
    if (event.button === 0) melee();
    else if (event.button === 2) grenade();
    return;
  }
  // Legacy sandbox (non-roguelike) keeps click-to-shoot / right-click melee.
  if (event.button === 0) shoot();
  if (event.button === 2) {
    event.preventDefault();
    melee();
  }
});

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement === dom.officialCombatMount) {
    combat.viewportMode = 'fullscreen';
    // Resize canvas to match new fullscreen dimensions
    requestAnimationFrame(() => {
      resizeCombatCanvas();
    });
  } else if (combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen') {
    combat.viewportMode = 'windowed';
    resizeCombatCanvas();
  }
  syncCombatOverlay();
});

// Handle window resize to update canvas dimensions in fullscreen/expanded modes
window.addEventListener('resize', () => {
  if (combat.viewportMode === 'fullscreen' || combat.viewportMode === 'expanded-fullscreen') {
    resizeCombatCanvas();
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

// ----- Responsive device detection + mobile/tablet touch controls -----
const deviceState = { profile: null, touchKeys: new Set() };

// Desktop control scheme: WASD/arrows move, mouse aims + auto-fires toward the
// cursor. True when the device is not touch-primary. Falls back to true when no
// profile is resolved yet (desktop is the safe default for keyboard handlers).
function isDesktopControls() {
  const p = deviceState.profile;
  if (!p) return !(('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0);
  return !p.isTouch;
}

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
  document.body.classList.toggle('show-touch-controls', profile.showTouchControls);
  document.body.classList.toggle('suggest-landscape', profile.suggestLandscape);
  ensureTouchControls(profile);
  return profile;
}

function performTouchAction(action) {
  if (action === 'pause') { toggleCombatPause(); return; }
  if (combat.paused || combat.gameOver) return;
  if (action === 'shoot') { if (combat.roguelikeRun) shoot(); else jump(); }
  else if (action === 'jump') jump();
  else if (action === 'melee') melee();
  else if (action === 'grenade') grenade();
  else if (action === 'powerup') dropPowerUp();
}

let touchControlsBuilt = false;
function ensureTouchControls(profile) {
  if (!profile.showTouchControls) {
    document.getElementById('touchControls')?.style.setProperty('display', 'none');
    return;
  }
  let layer = document.getElementById('touchControls');
  if (layer) { layer.style.display = ''; return; }
  layer = el('div', { className: 'touch-controls' });
  layer.id = 'touchControls';
  layer.setAttribute('aria-label', 'On-screen touch controls');

  // --- LEFT virtual joystick: drag within the base to MOVE. ---
  const stickBase = el('div', { className: 'touch-stick-base' });
  const stickNub = el('div', { className: 'touch-stick-nub' });
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
    stickNub.style.transform = 'translate(0,0)';
    for (const k of deviceState.touchKeys) combat.keys.delete(k);
    deviceState.touchKeys = new Set();
  };
  stickBase.addEventListener('pointerdown', (e) => {
    movePointer = e.pointerId;
    stickBase.setPointerCapture(e.pointerId);
    updateStick(e.clientX, e.clientY);
    e.preventDefault();
  });
  stickBase.addEventListener('pointermove', (e) => {
    if (movePointer === e.pointerId) updateStick(e.clientX, e.clientY);
  });
  stickBase.addEventListener('pointerup', releaseStick);
  stickBase.addEventListener('pointercancel', releaseStick);

  // --- RIGHT virtual joystick: drag to AIM + auto-fire in that direction. ---
  // Twin-stick: the gun auto-fires (updateAutoFire) toward combat.aimMapX/Y while
  // the player steers aim with this stick. No jump (removed) and no manual fire
  // button — holding the aim stick IS firing. Buttons are just Melee + Power-Up.
  const aimBase = el('div', { className: 'touch-stick-base touch-aim-base' });
  const aimNub = el('div', { className: 'touch-stick-nub touch-aim-nub' });
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
    if (mag < 0.2) return; // dead zone: tiny nudges don't redirect fire
    // Convert the screen-space stick vector into an iso world-space aim
    // direction (matching updateAimFromPointer's screenToIso mapping) so fire
    // goes where the thumb points relative to the isometric camera.
    const world = screenToIso(dx * 100, dy * 100);
    const len = Math.hypot(world.x, world.y) || 1;
    combat.aimMapX = world.x / len;
    combat.aimMapY = world.y / len;
    combat.pointerActive = true; // steer auto-fire toward the stick
  };
  const releaseAim = () => {
    aimPointer = null;
    aimNub.style.transform = 'translate(0,0)';
    combat.pointerActive = false; // fall back to nearest-enemy auto-aim
  };
  aimBase.addEventListener('pointerdown', (e) => {
    aimPointer = e.pointerId;
    aimBase.setPointerCapture(e.pointerId);
    updateAim(e.clientX, e.clientY);
    e.preventDefault();
  });
  aimBase.addEventListener('pointermove', (e) => {
    if (aimPointer === e.pointerId) updateAim(e.clientX, e.clientY);
  });
  aimBase.addEventListener('pointerup', releaseAim);
  aimBase.addEventListener('pointercancel', releaseAim);

  // --- Action buttons: ONLY Melee + Power-Up (no jump, no manual fire/nade). ---
  const actions = [
    { id: 'melee', label: 'MELEE', action: 'melee' },
    { id: 'powerup', label: 'POWER', action: 'powerup' },
  ];
  const cluster = el('div', { className: 'touch-action-cluster' });
  for (const a of actions) {
    const btn = el('button', { className: `touch-action-button touch-${a.id}`, textContent: a.label });
    btn.type = 'button';
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      performTouchAction(a.action);
      playSfxCue('menu-click', 0.02);
    });
    cluster.append(btn);
  }
  layer.append(cluster);

  // Pause button (top-right during gameplay).
  const pauseBtn = el('button', { className: 'touch-pause-button', textContent: 'II' });
  pauseBtn.type = 'button';
  pauseBtn.setAttribute('aria-label', 'Pause');
  pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); toggleCombatPause(); });
  layer.append(pauseBtn);

  document.body.append(layer);
  touchControlsBuilt = true;
}

// --- URL routing bootstrap ---------------------------------------------------
// Map the current URL to a view on load + on browser back/forward, layered over
// the existing officialAppStep state machine. Deep-linking into an active ranked
// session URL without a live session lands on the game page (mode-select) since
// the session can't be reconstructed client-side yet.
function applyRouteFromLocation() {
  if (typeof window === 'undefined') return;
  const { step, gameSlug } = viewForPath(window.location.pathname, { connected: Boolean(connectedWallet) });
  if (gameSlug) selectedGameId = 'hmh';
  suppressRouteSync = true;
  officialAppStep = step;
  try {
    render();
  } finally {
    suppressRouteSync = false;
  }
}

window.addEventListener('popstate', applyRouteFromLocation);

applyDeviceProfile();
let deviceResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(deviceResizeTimer);
  deviceResizeTimer = setTimeout(applyDeviceProfile, 120);
});
window.addEventListener('orientationchange', () => setTimeout(applyDeviceProfile, 200));

// Initial paint honors the URL (deep-link / refresh) instead of always splash.
applyRouteFromLocation();
requestAnimationFrame(drawCombatScene);
