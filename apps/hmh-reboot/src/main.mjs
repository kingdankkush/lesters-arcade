import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { createAimState, resolveAimIntent } from './aim.mjs';
import { createHmhChildBridge } from './bridge.mjs';
import { createCombatAudio } from './combat-audio.mjs';
import { WORLD_DECAL_URL, drawWorldDecals } from './world-decals.mjs';
import { impactSprayAngles, weaponRecoilShake } from './combat-feedback.mjs';
import { HMH_WEAPON_SFX, weaponFireCueId, weaponFireGain } from './weapon-audio.mjs';
import { createCollectibleState, getCollectibleSnapshot, stepCollectibles } from './collectible-system.mjs';
import { createCockpitUi } from './cockpit-ui.mjs';
import { computeCombatStatusLayout, computeHudMinimapLayout } from './hud-layout.mjs';
import { createPlayerDefeatController } from './combat-lifecycle.mjs';
import { resolveCombatHits } from './combat-events.mjs';
import { resolveEnemyAttackAgainstPlayer, stepEnemyAttacks } from './enemy-combat.mjs';
import { projectGasBomberCanister } from './enemy-attack-presentation.mjs';
import { ENEMY_ARCHETYPES, ENEMY_ARCHETYPE_IDS } from './enemy-archetypes.mjs';
import { createOrdinaryEnemyHurtboxProfile } from './enemy-hurtboxes.mjs';
import {
  createLiquidatorProductionDisplay,
  createProductionEnemyDisplay,
  isEliteEnemyProjection,
  resolveEnemyRuntimeVisualState,
} from './enemy-production-art.mjs';
import { createEnemyPopulation, createEnemyState, retireEnemyFromPopulation, stepEnemyPopulation } from './enemy-simulation.mjs';
import { computeEnemyFlowField, createEnemyNavGrid, navLineBlocked, sampleFlowDirection } from './enemy-navgrid.mjs';
import { computeMinimapModel, createMinimapDiscoveryState, discoverMinimapPointsOfInterest } from './minimap-model.mjs';
import {
  TERRAIN_MATERIAL_IDS,
  createTerrainTileRegistry,
  terrainManifestUrl,
  terrainFringeAsset,
  terrainTileAsset,
} from './terrain-tile-atlas.mjs';
import {
  BOSS_ROSTER_RUNTIME_SCALE,
  ENEMY_ROSTER_ACTORS,
  ENEMY_ROSTER_RUNTIME_SCALE,
  createEnemyRosterAtlasIndex,
  createEnemyRosterDisplay,
  enemyRosterAsset,
  resolveEnemyVisualDirection,
} from './enemy-roster-atlas.mjs';

import {
  HMH_OPENING_ENEMY_ARCHETYPE_IDS,
  HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE,
  openingEnemyAttacksEnabled,
  openingEnemyMovementEnabled,
} from './opening-balance.mjs';
import { createEncounterDirector, getEncounterSnapshot, stepEncounterDirector } from './encounter-director.mjs';
import {
  applyLiquidatorDamage,
  createLiquidatorBoss,
  resolveLiquidatorAttack,
  stepLiquidatorBoss,
} from './liquidator-boss.mjs';
import { renderLiquidatorTelegraph } from './liquidator-telegraph-renderer.mjs';
import {
  beginDash,
  createDashState,
  filterDashInvulnerableHits,
  getDashStatus,
  isDashInvulnerable,
  resolveDashWorldStep,
  stepDash,
} from './dash.mjs';
import {
  createCollisionBody,
  resolveSweptCircleMotion,
} from './collision.mjs';
import {
  movementSpeedMultiplierForTransition,
  resolveSweptTraversalPath,
  traceHeightAwareLineOfSight,
} from './elevation.mjs';
import { InputState, createBrowserInputController, mapGamepadSnapshot } from './input.mjs';
import { createGrenadeSystem, rechargeHandGrenades, stepGrenadeSystem, throwGrenade } from './grenades.mjs';
import { buildGrenadeDangerProjection } from './grenade-vfx.mjs';
import { createMeleeState, createMeleeTarget, stepMeleeState } from './melee.mjs';
import {
  applyRecoilImpulse,
  createPlayerMotionState,
  quantizeDirection,
  resolveEnemyPressure,
  stepPlayerMovement,
} from './movement.mjs';
import {
  UniformHurtboxGrid,
  createHurtTarget,
  createProjectileState,
  planProjectileFlightStep,
  resolveProjectileBatch,
} from './projectile-physics.mjs';
import { DeterministicSimulation } from './simulation.mjs';
import { createStandaloneInitPayload } from './standalone-session.mjs';
import {
  comboMilestoneXp,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunXp,
  recordRunDefeat,
  selectRunUpgrade,
} from './run-progression.mjs';
import { resolveComboFeedback } from './combo-feedback.mjs';
import { buildRunResultMessages, getWeb3AdapterStatus } from './run-adapters.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunCollectible,
  recordRunDamage,
  recordRunGrenade,
  recordRunGrenadeDetonation,
  recordRunHealing,
  recordRunKill,
  recordRunProjectileContacts,
  recordRunProjectileResolution,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponEvent,
  recordRunWeaponFire,
  recordRunWeaponLifecycleEvent,
  recordRunWeaponTriggerContact,
} from '../../../sdk/hmh-run-summary.mjs';
import {
  compactExpiredEventsInPlace,
  isScreenPointVisible,
  selectRuntimePerformanceProfile,
} from './runtime-performance.mjs';
import { createTouchControlAdapter } from './touch-controls.mjs';
import { createPrototypeHumanoidDescriptor, drawPrototypeHumanoid } from './prototype-actor-art.mjs';
import {
  MANNEQUIN_ATLAS_IMAGE_URL,
  MANNEQUIN_ATLAS_METADATA_URL,
  MANNEQUIN_RUNTIME_SCALE,
  createMannequinAtlasIndex,
  createMannequinDisplay,
} from './mannequin-atlas.mjs';
import {
  PRODUCTION_HERO_ASSETS,
  PRODUCTION_HERO_RUNTIME_SCALE,
  createProductionHeroAtlasIndex,
  createProductionHeroDisplay,
  productionHeroAsset,
} from './production-hero-atlas.mjs';
import {
  AUTHORED_PROP_ATLAS_IMAGE_URL,
  AUTHORED_PROP_ATLAS_METADATA_URL,
  buildAuthoredDistrictLandmarkPlacements,
  buildAuthoredEncampmentPlacements,
  buildAuthoredPointOfInterestPlacements,
  buildAuthoredTownPlacements,
  buildAuthoredWorldPropPlacements,
  createAuthoredHeldWeaponDisplay,
  createAuthoredPropAtlasIndex,
  createAuthoredPropDisplay,
} from './authored-prop-atlas.mjs';
import {
  LEVEL_ONE_WORLD,
  buildLevelOneMinimapGeometry,
  createLevelOneGroundQuery,
  createLevelOneRevealState,
  getLevelOneDistrictAt,
  getLevelOneRevealSnapshot,
  revealLevelOneAt,
} from './level-one-world.mjs';
import {
  clearWorldProductionLayers,
  createWorldProductionLayers,
  renderWorldProductionArt,
} from './world-production-art.mjs';
import {
  HMH_WEAPON_DEFINITIONS,
  createWeaponLoadout,
  getActiveWeaponState,
  getWeaponReadabilityStatus,
  grantWeaponPickup,
  refillWeaponLoadout,
  pistolProgressionByWeapon,
  selectWeapon,
  stepWeaponLoadout,
} from './weapon-system.mjs';
import {
  buildDebugGridOverlay,
  createActorSpatialState,
  createCameraState,
  followCameraTarget,
  getGroundContact,
  interpolateSpatialState,
  worldToScreen,
} from './world-space.mjs';

const RUNTIME_VERSION = '0.5.0';
const MAX_ACTIVE_PROJECTILES = 128;
// The archetype table tops out at threat 6; the Liquidator is the run's
// capstone kill and gets its own authored score/XP weight.
const LIQUIDATOR_THREAT_COST = 48;
// Bullets fly at chest height above whatever ground is beneath them, so firing
// from an authored ledge still connects with targets on the level below.
const PROJECTILE_FLIGHT_HEIGHT = 34;

// Projection-only helper: a stable 0..1 value from a string key. Combat spark
// and debris fans use it so effects are identical on replay without touching
// simulation RNG.
function deterministicUnit(key) {
  let hash = 2166136261;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 0x1_0000_0000;
}
// How long the authored hurt frames stay up after the player takes a hit.
const PLAYER_HURT_POSE_TICKS = 14;
// Full-screen damage flash duration, and the health fraction below which the
// low-health vignette starts bleeding in.
const PLAYER_DAMAGE_FLASH_TICKS = 10;
const LOW_HEALTH_VIGNETTE_THRESHOLD = 0.35;
// Camera shake is projection-only: it offsets rendering and the inverse
// screen-to-ground transform, never simulation state.
const SHAKE_DECAY_TICKS = 9;
const MAX_ACTIVE_GRENADES = 16;
const MAX_COMBAT_VISUAL_EVENTS = 64;
const PROJECTILE_GRID_THRESHOLD = 64;
const HIT_FEEDBACK_TICKS = 12;
// Criticals stay a spike rather than the baseline: even a full crit-chance
// build tops out here, so the damage curve keeps its shape.
const CRITICAL_CHANCE_CAP = 0.45;
const BASE_CRITICAL_CHANCE = 0.08;
const BASE_CRITICAL_MULTIPLIER = 1.75;

const WEAPON_ORDER = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig']);
const WEAPON_KNOCKBACK = Object.freeze({
  'coin-blaster': 8,
  'scatter-shotgun': 18,
  'auto-miner': 5,
  'launcher-rig': 24,
});
const WEAPON_COLORS = Object.freeze({
  'coin-blaster': 0xffd166,
  'scatter-shotgun': 0xff8c5a,
  'auto-miner': 0x83f28f,
  'launcher-rig': 0xc497ff,
});
const WORLD_BOUNDS = LEVEL_ONE_WORLD.bounds;
const WORLD_BLOCKERS = LEVEL_ONE_WORLD.collisionBlockers;
const queryGround = createLevelOneGroundQuery();
const MINIMAP_GEOMETRY = buildLevelOneMinimapGeometry();
// Deterministic navgrid built once from authored world data; the flow field
// refreshes on a fixed tick cadence inside the simulation step.
const ENEMY_NAV_GRID = createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround });
const ENEMY_FLOW_REFRESH_TICKS = 30;
let enemyFlowField = null;
let enemyFlowFieldTick = -1;
// Minimap discovery is per-run projection bookkeeping (what the player has
// seen); it resets with the session like the flow field does.
const minimapDiscovery = createMinimapDiscoveryState();
// Per-frame allocation caches: the reveal Set only changes when the snapshot
// object does, and markers do not need 60 Hz recomputation. Both exist so
// the minimap stays inside the heap-growth performance budget.
let minimapRevealCache = { snapshot: null, set: null };
let minimapModelCache = { tick: -1, model: null };
const enemyNavigation = Object.freeze({
  lineBlocked: (fromX, fromY, toX, toY) => navLineBlocked(ENEMY_NAV_GRID, fromX, fromY, toX, toY),
  flowDirectionAt: (x, y) => sampleFlowDirection(ENEMY_NAV_GRID, enemyFlowField, x, y),
});
const stageElement = document.querySelector('#hmhRebootStage');
const statusElement = document.querySelector('#hmhRebootStatus');
const sessionElement = document.querySelector('#hmhRebootSession');
const combatStatusElement = document.querySelector('#hmhRebootCombatStatus');
const dashStatusElement = document.querySelector('#hmhRebootDashStatus');

function setStatus(status, detail = '') {
  if (statusElement) statusElement.textContent = status;
  if (sessionElement) sessionElement.textContent = detail;
}

async function boot() {
  if (!stageElement) throw new Error('HMH reboot stage is missing');
  const dataset = stageElement.dataset;
  const performanceProfile = selectRuntimePerformanceProfile({
    width: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  const touchUiEnabled = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
  const app = new Application();
  await app.init({
    resizeTo: stageElement,
    background: '#071522',
    antialias: performanceProfile.antialias,
    autoDensity: true,
    resolution: performanceProfile.resolution,
    preference: 'webgl',
    powerPreference: 'high-performance',
  });
  app.ticker.stop();
  app.canvas.tabIndex = 0;
  app.canvas.setAttribute('aria-label', 'Hard Money Heroes gameplay canvas');
  stageElement.replaceChildren(app.canvas);

  const runtimeParams = new URLSearchParams(window.location.search);
  const pipelinePilotEnabled = runtimeParams.get('pipelinePilot') === '1';
  // The certified four-layer production hero atlas is the shipped player
  // identity. It used to require ?productionPilot=1, which the portal never
  // sets, so every real run rendered the prototype graybox — a placeholder
  // standing in as final production identity. `?graybox=1` keeps the
  // prototype available for regression work, and a failed atlas load falls
  // back to it rather than breaking the run.
  const grayboxRequested = runtimeParams.get('graybox') === '1';
  // Authored enemy/boss sprite atlases. `?vectorEnemies=1` keeps the older
  // vector projection for regression comparison.
  const enemyRosterEnabled = runtimeParams.get('vectorEnemies') !== '1' && !grayboxRequested;
  // Authored terrain materials. `?flatTerrain=1` restores the flat colour
  // fills for regression comparison.
  const terrainTilesEnabled = runtimeParams.get('flatTerrain') !== '1';
  const productionPilotEnabled = !grayboxRequested && !pipelinePilotEnabled;
  const requestedProductionHeroId = runtimeParams.get('productionHero');
  const productionHeroId = Object.hasOwn(PRODUCTION_HERO_ASSETS, requestedProductionHeroId)
    ? requestedProductionHeroId
    : 'lit-commando';
  const productionHeroSelection = productionHeroAsset(productionHeroId);

  const world = new Container();
  const backdrop = new Graphics();
  const worldProduction = createWorldProductionLayers({ ContainerClass: Container, GraphicsClass: Graphics, TilingSpriteClass: TilingSprite });
  // T2: ground decals sit above the terrain material and BELOW every prop and
  // actor layer, so a mark on the floor can never occlude something the player
  // needs to read.
  const worldDecalLayer = new Graphics();
  worldDecalLayer.label = 'world-decals';
  const authoredPropLayer = new Container();
  authoredPropLayer.label = 'authored-prop-layer';
  authoredPropLayer.sortableChildren = true;
  const heldWeaponLayer = new Container();
  heldWeaponLayer.label = 'authored-held-weapon-layer';
  const grid = new Graphics();
  const collisionDebug = new Graphics();
  const debugLabels = new Container();
  const shadow = new Graphics().ellipse(0, 0, 30, 12).fill({ color: 0x000000, alpha: 0.4 });
  const aimLine = new Graphics();
  const projectileTrails = new Graphics();
  const projectileImpacts = new Graphics();
  const grenadeVisuals = new Graphics();
  const combatVisuals = new Graphics();
  const minimap = new Graphics();
  // Screen-space layer for health pips, the boss bar, damage flash, and the
  // low-health vignette. Kept out of `world` so it never scrolls or scales.
  const overlayVisuals = new Graphics();
  const enemyVisuals = new Container();
  // Enemies must sort by screen depth so a southern body draws in front.
  enemyVisuals.sortableChildren = true;
  const enemyDeathVisuals = new Container();
  const enemyTelegraphs = new Graphics();
  const enemyMarkers = new Map();
  // Projection-only facing history. Never attach visual state to deterministic
  // enemy entities or it can leak into replay/evidence serialization.
  const enemyVisualFacing = new Map();
  const enemyDeathMarkers = new Map();
  const bossTelegraphs = new Graphics();
  let bossVisual = createLiquidatorProductionDisplay({ ContainerClass: Container, GraphicsClass: Graphics });
  bossVisual.visible = false;
  const marker = drawPrototypeHumanoid(new Graphics(), createPrototypeHumanoidDescriptor({
    radius: 24,
    bodyColor: 0x49ddff,
    outlineColor: 0xffffff,
    weapon: true,
  }));
  let productionHeroDisplay = null;
  let productionHeroLoadError = null;
  // The hero atlas is a ~650 KB texture plus metadata. Awaiting it before the
  // shell signals READY pushed embedded boot past the parent's 8s bridge
  // timeout, so the run is brought up on the prototype actor immediately and
  // the atlas is swapped in as soon as it decodes. A failure leaves the
  // prototype in place and is reported through evidence dataset.
  const loadProductionHeroAtlas = async (selection) => {
    const [metadataResponse, atlasTexture] = await Promise.all([
      fetch(selection.metadataUrl, { credentials: 'same-origin' }),
      Assets.load(selection.imageUrl),
    ]);
    if (!metadataResponse.ok) throw new Error(`Production hero metadata failed with ${metadataResponse.status}`);
    const metadata = await metadataResponse.json();
    return createProductionHeroDisplay({
      index: createProductionHeroAtlasIndex(metadata, selection),
      atlasTexture,
      ContainerClass: Container,
      SpriteClass: Sprite,
      TextureClass: Texture,
      RectangleClass: Rectangle,
    });
  };
  let mannequinDisplay = null;
  if (pipelinePilotEnabled && !productionPilotEnabled) {
    const [metadataResponse, atlasTexture] = await Promise.all([
      fetch(MANNEQUIN_ATLAS_METADATA_URL, { credentials: 'same-origin' }),
      Assets.load(MANNEQUIN_ATLAS_IMAGE_URL),
    ]);
    if (!metadataResponse.ok) throw new Error(`Mannequin metadata failed with ${metadataResponse.status}`);
    mannequinDisplay = createMannequinDisplay({
      index: createMannequinAtlasIndex(await metadataResponse.json()),
      atlasTexture,
      ContainerClass: Container,
      SpriteClass: Sprite,
      TextureClass: Texture,
      RectangleClass: Rectangle,
    });
  }
  let actorVisual = mannequinDisplay?.container ?? marker;
  let atlasActorEnabled = Boolean(mannequinDisplay);
  shadow.visible = !atlasActorEnabled;
  const label = new Text({ text: 'DETERMINISTIC RUNTIME', style: { fill: 0xe9fbff, fontFamily: 'system-ui', fontSize: 18, fontWeight: '700' } });
  label.anchor.set(0.5);
  const bossLabel = new Text({ text: '', style: { fill: 0xffd8df, fontFamily: 'system-ui', fontSize: 13, fontWeight: '800', letterSpacing: 1 } });
  bossLabel.anchor.set(0.5, 1);
  bossLabel.visible = false;
  // Combat VFX draw above the actor: muzzle flashes spawn 28 units along the
  // aim vector, which lands on top of the sprite when aiming north.
  world.addChild(backdrop, worldProduction.root, worldDecalLayer, authoredPropLayer, grid, debugLabels, shadow, enemyTelegraphs, bossTelegraphs, enemyVisuals, enemyDeathVisuals, bossVisual, aimLine, projectileTrails, grenadeVisuals, actorVisual, heldWeaponLayer, combatVisuals, projectileImpacts, collisionDebug, label);
  app.stage.addChild(world, overlayVisuals, bossLabel, minimap);


  const authoredPointOfInterestPlacements = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
  // Baked at build time and fetched, not computed here. The placement logic
  // costs 4,451 B minified against a bundle that had 3,218 B of headroom, and
  // runtime-fetched assets cost no bundle bytes. Decals are pure decoration,
  // so a failed fetch degrades to an empty layer rather than blocking boot --
  // never block boot on art.
  let worldDecals = [];
  const authoredPropPlacements = Object.freeze([
    ...buildAuthoredWorldPropPlacements({ worldId: LEVEL_ONE_WORLD.id, seed: 0x484d4807, countPerDistrict: 8 }),
    ...buildAuthoredDistrictLandmarkPlacements({ worldId: LEVEL_ONE_WORLD.id }),
    // W3: encampments ring the encounter arenas so enemies come from
    // somewhere. Projection-only, like every other authored placement.
    ...buildAuthoredEncampmentPlacements({ worldId: LEVEL_ONE_WORLD.id }),
    ...authoredPointOfInterestPlacements,
  ]);
  let authoredPropDisplay = null;
  let authoredHeldWeaponDisplay = null;
  let authoredPropLoadError = null;
  // Decals load on their own promise, deliberately NOT inside the prop
  // Promise.all: that array is destructured positionally, so adding an entry
  // shifted atlasTexture to undefined and the prop display never reported
  // ready -- which is the exact signal the visual gate waits on.
  fetch(WORLD_DECAL_URL, { credentials: 'same-origin' })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => { worldDecals = Object.freeze(payload?.decals ?? []); })
    .catch(() => { worldDecals = []; });
  Promise.all([
    fetch(AUTHORED_PROP_ATLAS_METADATA_URL, { credentials: 'same-origin' }),
    Assets.load(AUTHORED_PROP_ATLAS_IMAGE_URL),
  ]).then(async ([metadataResponse, atlasTexture]) => {
    if (!metadataResponse.ok) throw new Error(`Authored prop metadata failed with ${metadataResponse.status}`);
    const propIndex = createAuthoredPropAtlasIndex(await metadataResponse.json());
    const placements = Object.freeze([...authoredPropPlacements, ...buildAuthoredTownPlacements({ worldId: LEVEL_ONE_WORLD.id, index: propIndex })]);
    const display = createAuthoredPropDisplay({
      index: propIndex,
      atlasTexture,
      placements,
      ContainerClass: Container,
      SpriteClass: Sprite,
      TextureClass: Texture,
      RectangleClass: Rectangle,
      GraphicsClass: Graphics,
    });
    const heldWeaponDisplay = createAuthoredHeldWeaponDisplay({
      index: propIndex,
      atlasTexture,
      ContainerClass: Container,
      SpriteClass: Sprite,
      TextureClass: Texture,
      RectangleClass: Rectangle,
    });
    if (app.stage.destroyed || !world.parent) return;
    authoredPropLayer.addChild(display.container);
    heldWeaponLayer.addChild(heldWeaponDisplay.container);
    authoredPropDisplay = display;
    authoredHeldWeaponDisplay = heldWeaponDisplay;
    worldProduction.layers.townBlockers.visible = false;
    worldProduction.layers.landmarks.visible = false;
    dataset.authoredPropStatus = 'ready';
    dataset.authoredPropCount = String(placements.length);
  }).catch((error) => {
    authoredPropLoadError = error;
    dataset.authoredPropStatus = 'fallback';
    dataset.authoredPropError = String(error?.message ?? error);
    // Existing vector POIs and world materials remain live if generated art is
    // unavailable; a visual asset failure must never terminate a run.
    console.warn('[HMH] Authored prop atlas fallback active', error);
  });

  // The portal never puts a hero in the child URL — it sends the player's
  // selection in the session payload — so the atlas is loaded for whichever
  // actor the session actually requests, and re-loaded if a restart changes
  // it. Loading a boot-time guess would either render the wrong character or
  // trip the identity guard in initializeSession.
  let loadedProductionHeroId = null;
  let requestedProductionHeroActorId = null;
  let productionHeroLoadToken = 0;
  const ensureProductionHeroAtlas = (heroId) => {
    if (!productionPilotEnabled) return;
    const selection = productionHeroAsset(heroId);
    if (requestedProductionHeroActorId === selection.actorId) return;
    requestedProductionHeroActorId = selection.actorId;
    const token = (productionHeroLoadToken += 1);
    loadProductionHeroAtlas(selection).then((display) => {
      // Ignore a stale load: the session may have restarted with another hero,
      // or the app may have been disposed, while this atlas was in flight.
      if (!display || token !== productionHeroLoadToken) return;
      if (app.stage.destroyed || !world.parent) return;
      const slot = world.getChildIndex(actorVisual);
      world.removeChild(actorVisual);
      productionHeroDisplay = display;
      actorVisual = display.container;
      atlasActorEnabled = true;
      shadow.visible = false;
      loadedProductionHeroId = selection.actorId;
      world.addChildAt(actorVisual, slot);
    }).catch((error) => {
      if (token !== productionHeroLoadToken) return;
      productionHeroLoadError = String(error?.message ?? error);
      // A failed *switch* must not leave the previous hero's sprite standing
      // in for the actor the session actually requested. Fall back to the
      // prototype, which is identity-neutral.
      if (productionHeroDisplay) {
        const slot = world.getChildIndex(actorVisual);
        world.removeChild(actorVisual);
        productionHeroDisplay = null;
        actorVisual = marker;
        atlasActorEnabled = false;
        shadow.visible = true;
        world.addChildAt(actorVisual, slot);
      }
      loadedProductionHeroId = null;
      requestedProductionHeroActorId = null;
    });
  };

  // Authored Blender roster atlases, loaded once per actor and shared by every
  // body of that archetype. Until an atlas resolves (or if it fails) the
  // existing vector projection renders, so a run never blocks on art.
  const terrainTiles = createTerrainTileRegistry({ TilingSpriteClass: TilingSprite });
  let terrainTileLoadError = null;
  const loadTerrainTiles = () => {
    if (!terrainTilesEnabled) return;
    fetch(terrainManifestUrl(), { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(`terrain manifest ${response.status}`);
        return response.json();
      })
      .then((manifest) => {
        terrainTiles.setManifest(manifest);
        return Promise.all(TERRAIN_MATERIAL_IDS.flatMap((materialId) => [
          Assets
            .load(terrainTileAsset(materialId).imageUrl)
            .then((texture) => terrainTiles.register(materialId, texture))
            .catch((error) => {
              terrainTiles.markFailed(materialId);
              terrainTileLoadError = `${materialId}: ${String(error?.message ?? error)}`;
            }),
          // Fringe strips are optional dressing: a miss leaves the previous
          // hard district edge and never marks the material failed.
          Assets
            .load(terrainFringeAsset(materialId).imageUrl)
            .then((texture) => terrainTiles.registerFringe(materialId, texture))
            .catch(() => {}),
        ]));
      })
      .catch((error) => {
        terrainTileLoadError = String(error?.message ?? error);
      });
  };

  // Terrain materials load independently of the run: the world renders on flat
  // colour until they arrive and keeps rendering if they never do.
  loadTerrainTiles();

  const enemyRosterIndexes = new Map();
  const enemyRosterTextures = new Map();
  const enemyRosterRequested = new Set();
  const enemyRosterFailed = new Set();
  let enemyRosterLoadError = null;

  const requestEnemyRosterAtlas = (archetypeId) => {
    // `enemyRosterFailed` is never cleared: this is reached from the render
    // path, so retrying a 404 would issue a fetch every frame forever.
    if (!enemyRosterEnabled || enemyRosterRequested.has(archetypeId) || enemyRosterFailed.has(archetypeId)) return;
    if (!ENEMY_ROSTER_ACTORS.includes(archetypeId)) return;
    enemyRosterRequested.add(archetypeId);
    const asset = enemyRosterAsset(archetypeId);
    Promise.all([
      fetch(asset.metadataUrl, { credentials: 'same-origin' }).then((response) => {
        if (!response.ok) throw new Error(`roster metadata ${response.status}`);
        return response.json();
      }),
      Assets.load(asset.imageUrl),
    ]).then(([metadata, texture]) => {
      // Validate and build one display before publishing to the shared maps.
      // Publishing first meant a bad atlas threw from inside resetEnemyMarkers
      // after the old markers were already destroyed, leaving every enemy
      // permanently invisible behind a swallowed exception.
      const index = createEnemyRosterAtlasIndex(metadata, archetypeId);
      createEnemyRosterDisplay({
        index,
        atlasTexture: texture,
        ContainerClass: Container,
        SpriteClass: Sprite,
        TextureClass: Texture,
        RectangleClass: Rectangle,
      }).destroy({ children: true });
      enemyRosterIndexes.set(archetypeId, index);
      enemyRosterTextures.set(archetypeId, texture);
      // Rebuild live bodies so the authored art appears without a restart.
      if (grayboxEnemies.length > 0) resetEnemyMarkers(grayboxEnemies);
      if (archetypeId === 'the-liquidator') {
        // The boss previously proxied whale-enforcer poses; it now has its own
        // authored crown-rig silhouette.
        const slot = world.getChildIndex(bossVisual);
        const wasVisible = bossVisual.visible;
        world.removeChild(bossVisual);
        bossVisual.destroy({ children: true });
        bossVisual = createEnemyRosterDisplay({
          index: enemyRosterIndexes.get(archetypeId),
          atlasTexture: texture,
          ContainerClass: Container,
          SpriteClass: Sprite,
          TextureClass: Texture,
          RectangleClass: Rectangle,
          scale: 1,
        });
        bossVisual.rosterScale = BOSS_ROSTER_RUNTIME_SCALE;
        bossVisual.visible = wasVisible;
        world.addChildAt(bossVisual, slot);
      }
    }).catch((error) => {
      enemyRosterLoadError = `${archetypeId}: ${String(error?.message ?? error)}`;
      enemyRosterIndexes.delete(archetypeId);
      enemyRosterTextures.delete(archetypeId);
      enemyRosterFailed.add(archetypeId);
    });
  };

  const createRosterOrVectorDisplay = (archetypeId, eliteProjection) => {
    const index = enemyRosterIndexes.get(archetypeId);
    const texture = enemyRosterTextures.get(archetypeId);
    if (index && texture) {
      const display = createEnemyRosterDisplay({
        index,
        atlasTexture: texture,
        ContainerClass: Container,
        SpriteClass: Sprite,
        TextureClass: Texture,
        RectangleClass: Rectangle,
        scale: 1,
      });
      // The render pass multiplies by camera zoom, so carry the authored
      // runtime scale rather than baking it into the container.
      display.rosterScale = ENEMY_ROSTER_RUNTIME_SCALE;
      return display;
    }
    requestEnemyRosterAtlas(archetypeId);
    return createProductionEnemyDisplay({
      archetypeId,
      elite: eliteProjection,
      ContainerClass: Container,
      GraphicsClass: Graphics,
    });
  };

  const createEnemyMarker = (enemy) => createRosterOrVectorDisplay(enemy.archetypeId, isEliteEnemyProjection(enemy.id));

  const resetEnemyMarkers = (enemies) => {
    for (const child of enemyVisuals.removeChildren()) child.destroy();
    enemyMarkers.clear();
    for (const enemy of enemies) {
      const graphic = createEnemyMarker(enemy);
      enemyMarkers.set(enemy.id, graphic);
      enemyVisuals.addChild(graphic);
    }
  };

  const clearEnemyDeathMarkers = () => {
    for (const child of enemyDeathVisuals.removeChildren()) child.destroy();
    enemyDeathMarkers.clear();
  };

  const queueEnemyDeathVisual = (enemy, tick) => {
    if (!enemy || enemyDeathMarkers.has(enemy.id)) return;
    const eliteProjection = isEliteEnemyProjection(enemy.id);
    pushCombatVisualEvent({
      type: 'kill',
      tick,
      point: { x: enemy.x, y: enemy.y, z: (enemy.groundZ ?? 0) + 24 },
      color: ENEMY_ARCHETYPES[enemy.archetypeId]?.visual.color ?? 0xffffff,
    });
    const graphic = createRosterOrVectorDisplay(enemy.archetypeId, eliteProjection);
    enemyDeathMarkers.set(enemy.id, {
      graphic,
      x: enemy.x,
      y: enemy.y,
      groundZ: enemy.groundZ ?? 0,
      startTick: tick,
      endTick: tick + 30,
      elite: eliteProjection,
      direction: enemyVisualFacing.get(enemy.id)?.direction ?? 0,
    });
    enemyDeathVisuals.addChild(graphic);
  };

  const debugGridEnabled = runtimeParams.get('debugGrid') === '1';
  const directorDebugEnabled = runtimeParams.get('director') === '1';
  const bossDebugEnabled = runtimeParams.get('boss') === '1';
  const evidenceSafeEnabled = runtimeParams.get('evidenceSafe') === '1';
  const rosterPreviewEnabled = evidenceSafeEnabled && runtimeParams.get('rosterPreview') === '1';
  const rosterCombatEnabled = rosterPreviewEnabled && runtimeParams.get('rosterCombat') === '1';
  const progressionPilotEnabled = evidenceSafeEnabled && runtimeParams.get('progressionPilot') === '1';
  const terminalPilotEnabled = evidenceSafeEnabled && runtimeParams.get('terminalPilot') === '1';
  const releaseAnchorEnabled = progressionPilotEnabled && runtimeParams.get('releaseAnchor') === '1';
  const releaseTelemetryEnabled = evidenceSafeEnabled && runtimeParams.get('telemetry') === '1';
  const collectibleHealthPilotEnabled = evidenceSafeEnabled && runtimeParams.get('collectibleHealthPilot') === '1';
  const collectibleAmmoPilotEnabled = evidenceSafeEnabled && runtimeParams.get('collectibleAmmoPilot') === '1';
  // Evidence-only arsenal: pre-grants every pickup weapon so switching and
  // reload evidence does not depend on cache traversal. Gated behind
  // evidenceSafe exactly like the other pilots; a real run starts pistol-only.
  const weaponPilotEnabled = evidenceSafeEnabled && runtimeParams.get('weaponPilot') === '1';
  const worldTourId = runtimeParams.get('worldTour');
  const worldTourSpawns = Object.freeze({
    ravine: Object.freeze({ x: 3_050, y: 1_500 }),
    bridge: Object.freeze({ x: 4_700, y: 2_400 }),
    hazard: Object.freeze({ x: 3_500, y: 3_100 }),
    hashwood: Object.freeze({ x: 7_000, y: 900 }),
    mining: Object.freeze({ x: 9_200, y: 1_600 }),
    yard: Object.freeze({ x: 11_000, y: 800 }),
    // P5: the A1-A7 waves added 29 props that no pinned scene could see, so
    // the regression gate was not watching them. These two tours put the camp
    // kit and the water dressing on camera.
    'camp-hashwood': Object.freeze({ x: 7_150, y: 2_500 }),
    'crossing-water': Object.freeze({ x: 4_900, y: 1_050 }),
    ...Object.fromEntries(authoredPointOfInterestPlacements.map((placement) => [
      `collectible-${placement.pointOfInterestId}`,
      Object.freeze({ x: placement.x, y: placement.y }),
    ])),
  });
  const runtimePlayerSpawn = evidenceSafeEnabled && worldTourSpawns[worldTourId]
    ? worldTourSpawns[worldTourId]
    : LEVEL_ONE_WORLD.player.spawn;
  const authoredSpawnPoints = LEVEL_ONE_WORLD.spawnPoints;
  const spawnPointBlocked = (point) => WORLD_BLOCKERS.some((blocker) => {
    const shape = blocker.shape;
    if (shape.type === 'circle') return Math.hypot(point.x - shape.x, point.y - shape.y) <= shape.radius + 24;
    if (shape.type === 'capsule') {
      const dx = shape.b.x - shape.a.x;
      const dy = shape.b.y - shape.a.y;
      const lengthSquared = dx * dx + dy * dy;
      const projection = lengthSquared > 0 ? Math.max(0, Math.min(1, ((point.x - shape.a.x) * dx + (point.y - shape.a.y) * dy) / lengthSquared)) : 0;
      return Math.hypot(point.x - (shape.a.x + dx * projection), point.y - (shape.a.y + dy * projection)) <= shape.radius + 24;
    }
    let inside = false;
    for (let index = 0, previous = shape.vertices.length - 1; index < shape.vertices.length; previous = index, index += 1) {
      const a = shape.vertices[index];
      const b = shape.vertices[previous];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  });
  const debugOverlay = debugGridEnabled
    ? buildDebugGridOverlay({ bounds: WORLD_BOUNDS, spacing: 512, queryGround })
    : null;

  let settings = { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false };
  const combatAudio = createCombatAudio({
    standalone: window.parent === window,
    musicEnabled: settings.musicEnabled,
    maxVoices: 16,
  });
  const unlockCombatAudio = () => {
    window.removeEventListener('pointerdown', unlockCombatAudio, true);
    window.removeEventListener('keydown', unlockCombatAudio, true);
    void combatAudio.unlock();
  };
  window.addEventListener('pointerdown', unlockCombatAudio, { once: true, capture: true });
  window.addEventListener('keydown', unlockCombatAudio, { once: true, capture: true });
  let elapsedMs = 0;
  let bridge = null;
  let cockpit = null;
  let sessionPayload = null;
  let simulation = null;
  let runProgression = null;
  const PAUSE_SETTING_KEYS = new Set(['musicEnabled', 'screenShake', 'reduceMotion', 'reduceFlash']);
  const syncRuntimeSettings = (nextSettings, { notify = false } = {}) => {
    settings = { ...nextSettings };
    if (sessionPayload) sessionPayload = { ...sessionPayload, settings: { ...settings } };
    combatAudio.setMusicEnabled(settings.musicEnabled);
    cockpit?.setSettings(settings);
    dataset.settingMusic = String(settings.musicEnabled);
    dataset.settingScreenShake = String(settings.screenShake);
    dataset.settingReduceMotion = String(settings.reduceMotion);
    dataset.settingReduceFlash = String(settings.reduceFlash);
    if (notify && bridge?.initialized) {
      bridge.send('game:settings', { settings: { ...settings } });
      bridge.send('game:state', statePayload());
    }
  };
  const applyPauseSetting = (key, enabled) => {
    if (!PAUSE_SETTING_KEYS.has(key)) throw new TypeError(`unsupported pause setting ${String(key)}`);
    syncRuntimeSettings({ ...settings, [key]: Boolean(enabled) }, { notify: true });
  };
  let maxPlayerHealth = 100;
  let upgradePending = false;
  let actor = null;
  let motion = null;
  let aimState = null;
  let aimIntent = null;
  // Render-only cursor tracking for the aim reticle; never feeds simulation.
  let pointerReticleScreen = null;
  window.addEventListener('pointermove', (event) => {
    pointerReticleScreen = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  if (stageElement) stageElement.style.cursor = 'none';
  let grayboxEnemies = [];
  let enemyPopulation = null;
  let encounterDirector = null;
  let lastDirectorStep = null;
  let liquidatorBoss = null;
  let bossHitVisualUntilTick = -1;
  let bossDeathVisualUntilTick = -1;
  let lastBossStep = null;
  let lastEnemyStep = null;
  let lastEnemyAttack = null;
  let playerBody = null;
  let lastCollision = null;
  let lastTraversal = null;
  let lastGround = null;
  let zeroDisplacementFrames = 0;
  let previousGrenade = false;
  let previousDash = false;
  let previousWeaponNext = false;
  let lastInputWeaponSlot = 0;
  let previousActor = null;
  let renderActor = null;
  let camera = null;
  let input = new InputState();
  let inputController = null;
  let touchController = null;
  let gamepadWasActive = false;
  let activeProjectiles = [];
  let weaponLoadout = null;
  let meleeState = null;
  let grenadeSystem = null;
  let dashState = null;
  let lastDashReady = true;
  let droppedProjectiles = 0;
  let lastProjectileResolution = null;
  let lastProjectileHit = null;
  let lastCombatResolution = null;
  let lastWeaponFire = null;
  let lastPlayerHit = null;
  let lastDashDirection = null;
  let shakeStartTick = -1;
  let shakeMagnitude = 0;
  // Combat sparks and debris inherit the active quality tier, so the
  // reduced-motion profile (0 particles per hazard) emits none.
  const particleScale = performanceProfile.particlesPerHazard;
  const triggerCameraShake = (tick, magnitude) => {
    // A stronger impulse overrides a weaker one still decaying.
    if (tick === shakeStartTick && magnitude <= shakeMagnitude) return;
    if (tick - shakeStartTick < SHAKE_DECAY_TICKS && magnitude < shakeMagnitude) return;
    shakeStartTick = tick;
    shakeMagnitude = magnitude;
  };
  let lastMeleeAttack = null;
  let lastGrenadeThrow = null;
  let lastGrenadeDetonation = null;
  let playerDefeatController = null;
  let playerHealth = 100;
  let collectibleState = null;
  let collectibleSnapshot = null;
  let lastCollectibleEvent = null;
  let runKills = 0;
  let runCombo = 0;
  let maxRunCombo = 0;
  let runSummaryAccumulator = null;
  let runEventSequence = 0;
  let lastAccessibleCombatStatus = '';
  let combatVisualEvents = [];
  let revealState = createLevelOneRevealState();
  revealLevelOneAt(revealState, runtimePlayerSpawn);
  let revealSnapshot = getLevelOneRevealSnapshot(revealState);
  const pushCombatVisualEvent = (event) => {
    if (combatVisualEvents.length >= MAX_COMBAT_VISUAL_EVENTS) combatVisualEvents.shift();
    combatVisualEvents.push(Object.freeze({ ...event }));
  };
  const updateRunCombo = (nextCombo, { bossDefeated = false, silent = false } = {}) => {
    const feedback = resolveComboFeedback({ previous: runCombo, current: nextCombo, bossDefeated });
    runCombo = feedback.current;
    maxRunCombo = Math.max(maxRunCombo, runCombo);
    cockpit?.updateCombo(runCombo);
    if (!silent && feedback.cue) combatAudio.play(feedback.cue, { volume: feedback.cue === 'combo-reset' ? 0.06 : 0.11 });
    return feedback;
  };
  const awardComboXp = (snapshot, tick, { bossDefeated = false } = {}) => {
    const feedback = updateRunCombo(runCombo + 1, { bossDefeated });
    const baseXp = comboMilestoneXp(feedback.current);
    return baseXp ? grantRunXp(runProgression, baseXp, tick) : snapshot;
  };

  if (debugOverlay) {
    for (const descriptor of debugOverlay.labels) {
      const debugLabel = new Text({
        text: descriptor.text,
        style: { fill: 0x74b8cc, fontFamily: 'ui-monospace, monospace', fontSize: 10 },
      });
      debugLabel.alpha = 0.72;
      debugLabels.addChild(debugLabel);
    }
  }

  const viewport = () => ({ width: app.screen.width, height: app.screen.height });

  let worldArtReport = null;
  let decalsDrawn = 0;
  const renderAuthoredTerrain = (view) => {
    worldArtReport = renderWorldProductionArt({
      worldProduction,
      world: LEVEL_ONE_WORLD,
      camera,
      view,
      queryGround,
      worldToScreen,
      tick: simulation?.tick ?? 0,
      performanceProfile,
      terrainTiles,
    });
    // Decals draw immediately after the terrain material, into their own layer
    // beneath every prop and actor. Culled to the viewport, so an off-screen
    // mark costs a comparison rather than a path.
    decalsDrawn = drawWorldDecals({
      target: worldDecalLayer,
      decals: worldDecals,
      camera,
      view,
      project: worldToScreen,
    });
    dataset.worldDecalsVisible = String(decalsDrawn);
  };

  const renderAuthoredCollision = (view) => {
    if (!debugGridEnabled) return;
    const topLeft = worldToScreen({ x: WORLD_BOUNDS.minX, y: WORLD_BOUNDS.minY, z: 0 }, camera, view);
    const bottomRight = worldToScreen({ x: WORLD_BOUNDS.maxX, y: WORLD_BOUNDS.maxY, z: 0 }, camera, view);
    collisionDebug.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
      .stroke({ color: 0x49ddff, width: 3, alpha: 0.5 });
  };

  const renderMinimap = (view, renderState) => {
    minimap.clear();
    const minimapLayout = computeHudMinimapLayout({
      width: view.width,
      height: view.height,
      worldWidth: WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX,
      worldHeight: WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY,
    });
    const { width, height, x: originX, y: originY } = minimapLayout;
    if (debugGridEnabled || releaseTelemetryEnabled) {
      dataset.minimapWidth = width.toFixed(3);
      dataset.minimapHeight = height.toFixed(3);
      dataset.minimapX = originX.toFixed(3);
      dataset.minimapY = originY.toFixed(3);
      dataset.minimapCompactLandscape = String(minimapLayout.compactLandscape);
    }
    const mapPoint = (normalized) => ({ x: originX + normalized.x * width, y: originY + normalized.y * height });
    // Neon-noir instrument panel: near-black glass, geometry as dim emissive
    // plates, water as the one saturated fill, routes as lit filaments.
    minimap.roundRect(originX - 6, originY - 6, width + 12, height + 12, 8)
      .fill({ color: 0x04090f, alpha: 0.94 }).stroke({ color: 0x35d0ff, width: 1.5, alpha: 0.55 });
    for (const district of MINIMAP_GEOMETRY.districts) {
      const minimum = mapPoint(district.area.min);
      const maximum = mapPoint(district.area.max);
      minimap.rect(minimum.x, minimum.y, maximum.x - minimum.x, maximum.y - minimum.y).fill({ color: district.color, alpha: 0.3 });
    }
    for (const surface of MINIMAP_GEOMETRY.surfaces.filter((candidate) => ['water', 'shallow-water', 'bridge'].includes(candidate.kind))) {
      if (surface.area.type !== 'rect') continue;
      const minimum = mapPoint(surface.area.min);
      const maximum = mapPoint(surface.area.max);
      minimap.rect(minimum.x, minimum.y, maximum.x - minimum.x, maximum.y - minimum.y)
        .fill({ color: surface.kind === 'bridge' ? 0xc49a63 : 0x1f9fd4, alpha: 0.92 });
    }
    for (const route of MINIMAP_GEOMETRY.routes) {
      const points = route.points.map(mapPoint);
      minimap.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) minimap.lineTo(point.x, point.y);
      minimap.stroke({ color: route.kind === 'main' ? 0xffd166 : 0x8f7f52, width: route.kind === 'main' ? 2 : 1, alpha: 0.85, cap: 'round' });
    }
    for (const boundary of MINIMAP_GEOMETRY.hardBoundaries) {
      if (boundary.shape.type === 'capsule') {
        const a = mapPoint(boundary.shape.a);
        const b = mapPoint(boundary.shape.b);
        minimap.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x9fd8e4, width: 1, alpha: 0.6, cap: 'round' });
      } else if (boundary.shape.type === 'polygon') {
        const points = boundary.shape.points.map(mapPoint);
        minimap.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) minimap.lineTo(point.x, point.y);
        minimap.closePath().stroke({ color: 0x9fd8e4, width: 1, alpha: 0.6 });
      }
    }
    for (const landmark of MINIMAP_GEOMETRY.landmarks) {
      const center = mapPoint(landmark.point);
      minimap.circle(center.x, center.y, 2.2).fill({ color: 0xfff06a, alpha: 0.95 });
    }
    // Fog inversion (handoff §H8-11): geometry only exists where explored.
    // Unrevealed cells paint back to glass; runs merge per row so the void
    // costs one rect per contiguous gap instead of one per cell.
    if (minimapRevealCache.snapshot !== revealSnapshot) {
      minimapRevealCache = { snapshot: revealSnapshot, set: new Set(revealSnapshot.revealedCellIds) };
    }
    const revealedSet = minimapRevealCache.set;
    const cellWidth = width / revealSnapshot.columns;
    const cellHeight = height / revealSnapshot.rows;
    for (let row = 0; row < revealSnapshot.rows; row += 1) {
      let runStart = -1;
      for (let column = 0; column <= revealSnapshot.columns; column += 1) {
        const covered = column < revealSnapshot.columns && !revealedSet.has(`${column}:${row}`);
        if (covered && runStart < 0) runStart = column;
        if (!covered && runStart >= 0) {
          minimap.rect(originX + runStart * cellWidth, originY + row * cellHeight, (column - runStart) * cellWidth + 0.5, cellHeight + 0.5)
            .fill({ color: 0x04090f, alpha: 0.9 });
          runStart = -1;
        }
      }
    }
    // Live markers: enemies exist only inside current visibility, POIs are
    // discovered knowledge, the player is always the brightest thing.
    const modelTick = simulation?.tick ?? 0;
    if (minimapModelCache.model === null || modelTick - minimapModelCache.tick >= 6 || modelTick < minimapModelCache.tick) {
      minimapModelCache = {
        tick: modelTick,
        model: computeMinimapModel({
          bounds: WORLD_BOUNDS,
          player: renderState,
          enemies: grayboxEnemies,
          boss: liquidatorBoss,
          pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest,
          discovery: minimapDiscovery,
        }),
      };
    }
    const minimapModel = minimapModelCache.model;
    // The player marker must stay per-frame accurate (handoff §H9); only
    // enemy/POI/boss markers ride the 6-tick cache.
    const playerMarker = {
      x: (renderState.x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX),
      y: (renderState.y - WORLD_BOUNDS.minY) / (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY),
    };
    for (const poi of minimapModel.pointsOfInterest) {
      const center = mapPoint(poi);
      minimap.poly([center.x, center.y - 3, center.x + 3, center.y, center.x, center.y + 3, center.x - 3, center.y])
        .fill({ color: 0x7ef0c1, alpha: 0.95 });
    }
    for (const enemy of minimapModel.enemies) {
      const center = mapPoint(enemy);
      minimap.circle(center.x, center.y, 1.8).fill({ color: 0xff5257, alpha: 0.95 });
    }
    if (minimapModel.boss) {
      const center = mapPoint(minimapModel.boss);
      minimap.circle(center.x, center.y, 3.4).fill({ color: 0xff527e, alpha: 1 })
        .stroke({ color: 0xffffff, width: 1, alpha: 0.9 });
    }
    const player = mapPoint(playerMarker);
    const headingX = Number.isFinite(motion?.vx) && (Math.abs(motion.vx) + Math.abs(motion.vy) > 1) ? motion.vx : 1;
    const headingY = Number.isFinite(motion?.vy) && (Math.abs(motion.vx) + Math.abs(motion.vy) > 1) ? motion.vy : 0;
    const heading = Math.atan2(headingY, headingX);
    const size = minimapLayout.compactPortrait ? 5 : 6;
    minimap.poly([
      player.x + Math.cos(heading) * size, player.y + Math.sin(heading) * size,
      player.x + Math.cos(heading + 2.5) * size * 0.8, player.y + Math.sin(heading + 2.5) * size * 0.8,
      player.x + Math.cos(heading - 2.5) * size * 0.8, player.y + Math.sin(heading - 2.5) * size * 0.8,
    ]).fill({ color: 0x49ddff, alpha: 1 }).stroke({ color: 0xffffff, width: 1.2, alpha: 1 });
  };

  const renderWorld = (renderState = renderActor ?? actor) => {
    const view = viewport();
    backdrop.clear().rect(0, 0, view.width, view.height).fill({ color: 0x071522 });
    clearWorldProductionLayers(worldProduction);
    worldDecalLayer.clear();
    grid.clear();
    collisionDebug.clear();
    projectileTrails.clear();
    projectileImpacts.clear();
    grenadeVisuals.clear();
    combatVisuals.clear();
    if (debugOverlay && camera) {
      for (const line of debugOverlay.lines) {
        const from = worldToScreen({ ...line.from, z: 0 }, camera, view);
        const to = worldToScreen({ ...line.to, z: 0 }, camera, view);
        grid.moveTo(from.x, from.y).lineTo(to.x, to.y);
      }
      grid.stroke({ color: 0x2d7188, width: 1, alpha: 0.55 });
      for (let index = 0; index < debugOverlay.labels.length; index += 1) {
        const descriptor = debugOverlay.labels[index];
        const screen = worldToScreen({ x: descriptor.x, y: descriptor.y, z: descriptor.height }, camera, view);
        debugLabels.children[index].position.set(screen.x + 4, screen.y + 4);
      }
    }
    if (renderState && camera) {
      renderAuthoredTerrain(view);
      const authoredPropReport = authoredPropDisplay?.render({
        camera,
        view,
        worldToScreen,
        queryGround,
        tick: simulation?.tick ?? 0,
        cullMargin: performanceProfile.worldCullMargin ?? 220,
        hiddenPlacementIds: collectibleState?.collectedIds ?? null,
        reduceMotion: settings.reduceMotion || performanceProfile.particlesPerHazard === 0,
      });
      if (releaseTelemetryEnabled || debugGridEnabled) {
        dataset.authoredPropVisible = String(authoredPropReport?.visibleCount ?? 0);
        dataset.authoredLandmarkVisible = String(authoredPropReport?.onscreenByCategory?.['district-landmark'] ?? 0);
        dataset.authoredLandmarkAnimated = String(authoredPropReport?.animatedSignalOnscreenCount ?? 0);
      }
      renderAuthoredCollision(view);
      const groundScreen = worldToScreen(getGroundContact(renderState), camera, view);
      const screen = worldToScreen(renderState, camera, view);
      enemyTelegraphs.clear();
      bossTelegraphs.clear();
      overlayVisuals.clear();
      bossVisual.visible = false;
      if (releaseTelemetryEnabled) dataset.gasCanisterProgress = '';
      let animatedEnemyCount = 0;
      let bossTelegraphPrimitiveCount = 0;
      const enemyHealthPips = [];
      for (const enemy of grayboxEnemies) {
        const enemyMarker = enemyMarkers.get(enemy.id);
        if (!enemyMarker) continue;
        if (!enemy.active) {
          enemyMarker.visible = false;
          enemyVisualFacing.delete(enemy.id);
          continue;
        }
        const archetype = ENEMY_ARCHETYPES[enemy.archetypeId];
        const enemyScreen = worldToScreen({ ...enemy, z: enemy.groundZ ?? 0 }, camera, view);
        const markerVisible = isScreenPointVisible(enemyScreen, view, performanceProfile.enemyCullMargin)
          && animatedEnemyCount < performanceProfile.maxAnimatedEnemies;
        enemyMarker.visible = markerVisible;
        if (markerVisible) {
          animatedEnemyCount += 1;
          const facingState = enemyVisualFacing.get(enemy.id) ?? { direction: 0 };
          enemyVisualFacing.set(enemy.id, facingState);
          const enemyDirection = resolveEnemyVisualDirection(facingState, enemy.velocity);
          enemyMarker.applyPose({
            state: resolveEnemyRuntimeVisualState(enemy, simulation?.tick ?? 0),
            tick: simulation?.tick ?? 0,
            direction: enemyDirection,
            elite: isEliteEnemyProjection(enemy.id),
          });
          enemyMarker.position.set(enemyScreen.x, enemyScreen.y);
          enemyMarker.scale.set((enemyMarker.rosterScale ?? 1) * camera.zoom);
          enemyMarker.rotation = 0;
          // Health is shown on a pip below the body. It used to drive alpha,
          // which made the highest-priority target the hardest one to see and
          // turned dense fights into overlapping ghosts.
          enemyMarker.alpha = 1;
          // Depth: an enemy standing further south must draw in front.
          enemyMarker.zIndex = enemyScreen.y;
          const healthRatio = Math.max(0, Math.min(1, enemy.health / enemy.maxHealth));
          enemyHealthPips.push({ screen: enemyScreen, ratio: healthRatio, radius: enemy.radius, color: archetype.visual.color });
        }
        if (enemy.attackPhase !== 'tell' || !enemy.telegraphTarget || !simulation) continue;
        const targetScreen = worldToScreen({ ...enemy.telegraphTarget, z: enemy.telegraphTarget.groundZ }, camera, view);
        const tellRatio = Math.max(0, Math.min(1, (enemy.attackPhaseUntilTick - simulation.tick) / archetype.attack.tellTicks));
        const alpha = 0.38 + (1 - tellRatio) * 0.5;
        // Several archetype tell colours sit within a few points of their own
        // district's ground palette (gas-bomber orange on rugpull-ravine, boss
        // red on liquidation-yard). A dark contour under every stroke
        // guarantees the tell separates from whatever it is drawn over.
        const CONTOUR = { color: 0x080d12, alpha: alpha * 0.72 };
        if (archetype.attack.tokenFamily === 'area') {
          enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 96 * camera.zoom)
            .fill({ color: archetype.visual.color, alpha: 0.08 })
            .stroke({ ...CONTOUR, width: 10 })
            .stroke({ color: archetype.visual.color, width: 4, alpha });
          const canister = projectGasBomberCanister({ enemy, tick: simulation.tick });
          if (canister) {
            const canisterScreen = worldToScreen(canister, camera, view);
            const stripeX = Math.cos(canister.rotation) * 6 * camera.zoom;
            const stripeY = Math.sin(canister.rotation) * 6 * camera.zoom;
            enemyTelegraphs.circle(canisterScreen.x, canisterScreen.y, 8 * camera.zoom)
              .fill({ color: archetype.visual.color, alpha: 0.98 })
              .stroke({ color: 0x080d12, width: 3 * camera.zoom, alpha: 1 });
            enemyTelegraphs.moveTo(canisterScreen.x - stripeX, canisterScreen.y - stripeY)
              .lineTo(canisterScreen.x + stripeX, canisterScreen.y + stripeY)
              .stroke({ color: 0xfff4c7, width: 2 * camera.zoom, alpha: 0.92 });
            if (releaseTelemetryEnabled) dataset.gasCanisterProgress = canister.progress.toFixed(3);
          }
        } else if (archetype.attack.tokenFamily === 'support') {
          enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 140 * camera.zoom)
            .stroke({ ...CONTOUR, width: 11 })
            .stroke({ color: archetype.visual.color, width: 5, alpha });
        } else if (archetype.attack.tokenFamily === 'melee') {
          enemyTelegraphs.circle(enemyScreen.x, enemyScreen.y, archetype.attack.range * camera.zoom)
            .stroke({ ...CONTOUR, width: 10 })
            .stroke({ color: archetype.visual.color, width: 4, alpha });
          enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
            .stroke({ ...CONTOUR, width: 9 })
            .stroke({ color: archetype.visual.color, width: 3, alpha });
        } else {
          enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
            .stroke({ color: archetype.visual.color, width: 18 * camera.zoom, alpha: alpha * 0.22, cap: 'round' })
            .stroke({ ...CONTOUR, width: 9, cap: 'round' })
            .stroke({ color: archetype.visual.color, width: 3, alpha, cap: 'round' });
        }
      }
      for (const [enemyId, death] of enemyDeathMarkers) {
        if ((simulation?.tick ?? 0) >= death.endTick) {
          enemyDeathVisuals.removeChild(death.graphic);
          death.graphic.destroy();
          enemyDeathMarkers.delete(enemyId);
          continue;
        }
        const deathScreen = worldToScreen({ x: death.x, y: death.y, z: death.groundZ }, camera, view);
        death.graphic.visible = isScreenPointVisible(deathScreen, view, performanceProfile.enemyCullMargin);
        if (!death.graphic.visible) continue;
        death.graphic.applyPose({ state: 'death', tick: simulation?.tick ?? death.startTick, direction: death.direction, elite: death.elite });
        death.graphic.position.set(deathScreen.x, deathScreen.y);
        death.graphic.scale.set((death.graphic.rosterScale ?? 1) * camera.zoom);
        // Fade the corpse out instead of hard-deleting it mid-frame.
        const deathProgress = Math.max(0, Math.min(1, ((simulation?.tick ?? death.startTick) - death.startTick) / Math.max(1, death.endTick - death.startTick)));
        death.graphic.alpha = 1 - deathProgress * deathProgress;
      }
      const bossVisualTick = simulation?.tick ?? 0;
      if (bossVisualTick >= liquidatorBoss?.startTick - 600) requestEnemyRosterAtlas('the-liquidator');
    if (bossVisualTick >= liquidatorBoss?.startTick && (liquidatorBoss.active || bossVisualTick < bossDeathVisualUntilTick)) {
        const bossScreen = worldToScreen({ x: liquidatorBoss.x, y: liquidatorBoss.y, z: liquidatorBoss.groundZ }, camera, view);
        const bossPhaseTick = lastBossStep?.elapsedTick ?? 45;
        bossVisual.applyPose({
          state: !liquidatorBoss.active ? 'death' : bossVisualTick <= bossHitVisualUntilTick ? 'hit' : liquidatorBoss.pendingAttacks.length > 0 ? 'tell' : 'idle',
          tick: bossVisualTick,
          direction: 0,
          elite: true,
          phase: liquidatorBoss.phaseId,
        });
        bossVisual.visible = true;
        bossVisual.position.set(bossScreen.x, bossScreen.y);
        bossVisual.scale.set((bossVisual.rosterScale ?? 1) * camera.zoom * (1 + (bossPhaseTick < 2_445 && Math.max(0, 45 - (bossPhaseTick % 1_200)) / 250)));
        // Boss health reads from the dedicated bar, never from transparency.
        bossVisual.alpha = liquidatorBoss.active ? 1 : Math.max(0.15, 1 - (bossVisualTick - (bossDeathVisualUntilTick - 45)) / 45);
        const projectBossTelegraph = (point) => worldToScreen(point, camera, view);
        for (const pending of liquidatorBoss.pendingAttacks) {
          const telegraphReport = renderLiquidatorTelegraph({
            graphics: bossTelegraphs,
            pending,
            groundZ: liquidatorBoss.groundZ,
            cameraZoom: camera.zoom,
            worldToScreen: projectBossTelegraph,
          });
          bossTelegraphPrimitiveCount += telegraphReport.primitiveCount;
        }
      }
      for (const shot of activeProjectiles) {
        if (!shot.state) continue;
        const from = worldToScreen(shot.state.previous, camera, view);
        const to = worldToScreen(shot.state.current, camera, view);
        if (!isScreenPointVisible(from, view, 48) && !isScreenPointVisible(to, view, 48)) continue;
        const shotColor = WEAPON_COLORS[shot.weaponId] ?? 0x49ddff;
        // Upgraded rounds must be legible as upgraded. A tracer draws a longer,
        // hotter streak with a leading spark so the tier-three capstone is
        // visible in play rather than only in the upgrade panel.
        if (shot.projectileTag === 'tracer-round') {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const tail = { x: from.x - dx * 0.85, y: from.y - dy * 0.85 };
          projectileTrails.moveTo(tail.x, tail.y).lineTo(to.x, to.y)
            .stroke({ color: 0xffb347, width: 9, alpha: 0.2 });
          projectileTrails.moveTo(from.x, from.y).lineTo(to.x, to.y)
            .stroke({ color: 0xffd166, width: 4, alpha: 0.95 });
          projectileTrails.circle(to.x, to.y, 3.2).fill({ color: 0xfff6d5, alpha: 0.95 });
        } else if (shot.policy?.type === 'pierce') {
          // Piercing rounds read as a hard, bright lance.
          projectileTrails.moveTo(from.x, from.y).lineTo(to.x, to.y)
            .stroke({ color: 0xc497ff, width: 8, alpha: 0.26 });
          projectileTrails.moveTo(from.x, from.y).lineTo(to.x, to.y)
            .stroke({ color: 0xf6ecff, width: 2.5, alpha: 1 });
        } else {
          projectileTrails.moveTo(from.x, from.y).lineTo(to.x, to.y)
            .stroke({ color: shotColor, width: 7, alpha: 0.24 });
          projectileTrails.moveTo(from.x, from.y).lineTo(to.x, to.y)
            .stroke({ color: 0xf4fdff, width: 3, alpha: 0.98 });
        }
      }
      let activeGrenadeWarnings = 0;
      let activeGrenadeWarningRadius = 0;
      let activeGrenadeWarningUrgent = 0;
      for (const grenade of grenadeSystem?.active ?? []) {
        const ground = queryGround(grenade.position.x, grenade.position.y);
        const warning = buildGrenadeDangerProjection({
          grenade,
          tick: simulation?.tick ?? grenade.spawnTick,
          groundZ: ground.groundZ,
          reduceFlash: settings.reduceFlash,
        });
        const warningBoundary = warning.boundary.map((point) => worldToScreen(point, camera, view));
        const warningPoints = warningBoundary.flatMap((point) => [point.x, point.y]);
        const warningColor = grenade.mode === 'launcher' ? WEAPON_COLORS['launcher-rig'] : 0xff5c7a;
        const pulseAlpha = settings.reduceFlash ? 1 : 0.82 + warning.pulseOffset * 0.18;
        grenadeVisuals.poly(warningPoints, true)
          .fill({ color: warningColor, alpha: warning.fillAlpha })
          .stroke({ color: warningColor, width: warning.strokeWidth, alpha: warning.strokeAlpha * pulseAlpha });
        activeGrenadeWarnings += 1;
        activeGrenadeWarningRadius = Math.max(activeGrenadeWarningRadius, warning.blastRadius);
        if (warning.urgent) activeGrenadeWarningUrgent += 1;

        const grenadeGround = worldToScreen({ x: grenade.position.x, y: grenade.position.y, z: ground.groundZ }, camera, view);
        const grenadeScreen = worldToScreen(grenade.position, camera, view);
        const fuseRatio = Math.max(0, Math.min(1, (grenade.detonateTick - (simulation?.tick ?? 0)) / 39));
        grenadeVisuals.ellipse(grenadeGround.x, grenadeGround.y, 9, 4).fill({ color: 0x000000, alpha: 0.35 });
        grenadeVisuals.circle(grenadeScreen.x, grenadeScreen.y, grenade.mode === 'launcher' ? 7 : 6)
          .fill({ color: grenade.mode === 'launcher' ? WEAPON_COLORS['launcher-rig'] : 0xffd166, alpha: 0.98 })
          .stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
        grenadeVisuals.circle(grenadeScreen.x, grenadeScreen.y, 10 + (1 - fuseRatio) * 5)
          .stroke({ color: 0xff5c7a, width: 2, alpha: 0.35 + (1 - fuseRatio) * 0.55 });
      }
      if (simulation) {
        compactExpiredEventsInPlace(combatVisualEvents, simulation.tick, HIT_FEEDBACK_TICKS);
        for (const event of combatVisualEvents) {
          const age = simulation.tick - event.tick;
          const alpha = Math.max(0.08, 1 - age / HIT_FEEDBACK_TICKS);
          const center = worldToScreen(event.point, camera, view);
          if (!isScreenPointVisible(center, view, 128)) continue;
          if (event.type === 'muzzle') {
            // Shrink and brighten: a growing circle read as a smoke puff.
            const flashRadius = Math.max(2, 14 - age * 1.6);
            combatVisuals.circle(center.x, center.y, flashRadius).fill({ color: 0xffffff, alpha: alpha * 0.55 });
            combatVisuals.circle(center.x, center.y, flashRadius * 1.7).fill({ color: event.color, alpha: alpha * 0.4 });
            if (age < 3) {
              for (let spoke = 0; spoke < 4; spoke += 1) {
                const angle = (spoke / 4) * Math.PI * 2 + 0.4;
                combatVisuals.moveTo(center.x, center.y)
                  .lineTo(center.x + Math.cos(angle) * (18 - age * 4), center.y + Math.sin(angle) * (18 - age * 4))
                  .stroke({ color: event.color, width: 2, alpha: alpha * 0.7 });
              }
            }
          } else if (event.type === 'pickup') {
            const ringRadius = 16 + age * 2.6;
            combatVisuals.circle(center.x, center.y, ringRadius)
              .stroke({ color: event.color, width: Math.max(2, 6 - age * 0.4), alpha: alpha * 0.9 });
            combatVisuals.rect(center.x - 7, center.y - 7, 14, 14)
              .stroke({ color: 0xffffff, width: 3, alpha: alpha * 0.8 });
          } else if (event.type === 'kill') {
            // Kill confirmation: an expanding ring plus a deterministic
            // debris fan so a defeat reads instantly in a crowded fight.
            const ringRadius = 10 + age * 3.4;
            combatVisuals.circle(center.x, center.y, ringRadius)
              .stroke({ color: 0xffffff, width: Math.max(1, 5 - age * 0.4), alpha: alpha * 0.9 });
            combatVisuals.circle(center.x, center.y, ringRadius * 0.6)
              .stroke({ color: event.color, width: 3, alpha: alpha * 0.8 });
            const shards = particleScale > 0 ? 8 : 0;
            for (let shard = 0; shard < shards; shard += 1) {
              const angle = deterministicUnit(`${event.tick}:${event.point.x}:${shard}`) * Math.PI * 2;
              const reach = 12 + age * 4.5;
              combatVisuals.moveTo(center.x + Math.cos(angle) * reach * 0.5, center.y + Math.sin(angle) * reach * 0.5)
                .lineTo(center.x + Math.cos(angle) * reach, center.y + Math.sin(angle) * reach)
                .stroke({ color: event.color, width: 2, alpha: alpha * 0.85 });
            }
          } else if (event.type === 'melee') {
            const facing = worldToScreen({ x: event.point.x + event.direction.x, y: event.point.y + event.direction.y, z: event.point.z }, camera, view);
            const angle = Math.atan2(facing.y - center.y, facing.x - center.x);
            combatVisuals.arc(center.x, center.y, 58 * camera.zoom, angle - 0.72, angle + 0.72)
              .stroke({ color: 0xd7fbff, width: 10, alpha: alpha * 0.68 });
          } else if (event.type === 'blast') {
            const radius = event.radius * camera.zoom * (0.38 + age / HIT_FEEDBACK_TICKS * 0.62);
            combatVisuals.circle(center.x, center.y, radius)
              .fill({ color: 0xff8c5a, alpha: alpha * 0.18 })
              .stroke({ color: 0xffd166, width: 6, alpha: alpha * 0.85 });
          } else if (event.type === 'impact') {
            combatVisuals.circle(center.x, center.y, 7 + age * 1.4)
              .stroke({ color: event.color, width: event.critical ? 6 : 3, alpha });
            // Impact sparks. Seeded from the event so the fan is identical on
            // replay, and scaled by the active performance profile.
            const sparks = particleScale > 0 ? (event.critical ? 8 : 4) : 0;
            // Sprayed back along the impact rather than fanned at random
            // angles: a hit used to throw sparks into the shooter as often as
            // away from the surface.
            const sprayAngles = impactSprayAngles({
              seed: `${event.tick}:${event.point.y}`,
              direction: event.direction ?? { x: 0, y: 0 },
              count: sparks,
            });
            for (const angle of sprayAngles) {
              const inner = 6 + age * 2;
              const outer = inner + 7 + age * 1.5;
              combatVisuals.moveTo(center.x + Math.cos(angle) * inner, center.y + Math.sin(angle) * inner)
                .lineTo(center.x + Math.cos(angle) * outer, center.y + Math.sin(angle) * outer)
                .stroke({ color: event.critical ? 0xfff06a : event.color, width: 2, alpha: alpha * 0.9 });
            }
          } else if (event.type === 'enemy-attack') {
            combatVisuals.circle(center.x, center.y, 18 + age * 2.2)
              .fill({ color: event.color, alpha: alpha * 0.12 })
              .stroke({ color: event.color, width: 5, alpha });
          } else if (event.type === 'dash') {
            const end = worldToScreen({
              x: event.point.x - event.direction.x * 78,
              y: event.point.y - event.direction.y * 78,
              z: event.point.z,
            }, camera, view);
            combatVisuals.moveTo(end.x, end.y).lineTo(center.x, center.y)
              .stroke({ color: 0x8ff3ff, width: 12 - age * 0.5, alpha: alpha * 0.58, cap: 'round' });
          } else if (event.type === 'dash-ready') {
            combatVisuals.circle(center.x, center.y, 34 + age * 2.6)
              .stroke({ color: 0x8ff3ff, width: 4, alpha: alpha * 0.8 });
          }
        }
      }
      if (lastProjectileHit && simulation && simulation.tick - lastProjectileHit.tick <= HIT_FEEDBACK_TICKS) {
        const impact = worldToScreen(lastProjectileHit.point, camera, view);
        const age = simulation.tick - lastProjectileHit.tick;
        projectileImpacts.circle(impact.x, impact.y, 10 + age * 1.7)
          .stroke({ color: 0xffd166, width: 4, alpha: Math.max(0.2, 1 - age / HIT_FEEDBACK_TICKS) });
      }
      // Owner playtest 2026-08-02: no more aim line from the hero. Pointer
      // aim shows a crosshair reticle at the cursor; gamepad/touch aim shows
      // the same reticle at the projected aim point. Projection-only.
      aimLine.clear();
      if (aimIntent) {
        const reticleColor = aimIntent.fire ? 0xffd166 : 0x49ddff;
        const reticle = aimIntent.source === 'pointer' && pointerReticleScreen
          ? pointerReticleScreen
          : worldToScreen({
            x: renderState.x + aimIntent.direction.x * 140,
            y: renderState.y + aimIntent.direction.y * 140,
            z: renderState.z,
          }, camera, view);
        const r = 11;
        aimLine.circle(reticle.x, reticle.y, r).stroke({ color: reticleColor, width: 2, alpha: 0.9 });
        aimLine.circle(reticle.x, reticle.y, 1.8).fill({ color: reticleColor, alpha: 0.95 });
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          aimLine.moveTo(reticle.x + dx * (r - 4), reticle.y + dy * (r - 4))
            .lineTo(reticle.x + dx * (r + 5), reticle.y + dy * (r + 5))
            .stroke({ color: reticleColor, width: 2, alpha: 0.9 });
        }
      }
      shadow.position.set(groundScreen.x, groundScreen.y);
      actorVisual.position.set(atlasActorEnabled ? groundScreen.x : screen.x, atlasActorEnabled ? groundScreen.y : screen.y);
      if (authoredHeldWeaponDisplay && weaponLoadout) {
        const heldWeapon = getActiveWeaponState(weaponLoadout);
        const torsoAngle = ((2 - (motion?.torsoDirection ?? 0)) * Math.PI) / 4;
        const heldAim = aimIntent?.direction ?? { x: Math.cos(torsoAngle), y: Math.sin(torsoAngle) };
        const chestScreen = worldToScreen({ x: renderState.x, y: renderState.y, z: renderState.z + 44 }, camera, view);
        const aimScreen = worldToScreen({ x: renderState.x + heldAim.x * 96, y: renderState.y + heldAim.y * 96, z: renderState.z + 44 }, camera, view);
        authoredHeldWeaponDisplay.container.applyWeapon({ weaponId: heldWeapon.id, screen: chestScreen, aimScreen, cameraZoom: camera.zoom });
      }
      if (!productionHeroDisplay && authoredHeldWeaponDisplay) authoredHeldWeaponDisplay.container.visible = false;
      if (productionHeroDisplay && motion) {
        const visualTick = simulation?.tick ?? 0;
        const pistolFireAge = lastWeaponFire?.weaponId === 'coin-blaster' ? visualTick - lastWeaponFire.tick : Number.POSITIVE_INFINITY;
        const playerHitAge = lastPlayerHit ? visualTick - lastPlayerHit.tick : Number.POSITIVE_INFINITY;
        const meleeAge = lastMeleeAttack ? visualTick - lastMeleeAttack.tick : Number.POSITIVE_INFINITY;
        const grenadeAge = lastGrenadeThrow ? visualTick - lastGrenadeThrow.tick : Number.POSITIVE_INFINITY;
        const dashing = actor.locomotion === 'dash';
        // Full-body actions are authored and selected by actual simulation
        // events. Death is terminal; melee and grenade windups outrank fire,
        // and dash uses its own compact silhouette instead of fake run legs.
        const productionAction = playerHealth <= 0
          ? 'death'
          : meleeAge >= 0 && meleeAge < 20
            ? 'melee'
            : grenadeAge >= 0 && grenadeAge < 24
              ? 'grenade'
              : dashing
                ? 'dash'
                : pistolFireAge >= 0 && pistolFireAge < 12
                  ? 'pistol-fire'
                  : playerHitAge >= 0 && playerHitAge < PLAYER_HURT_POSE_TICKS ? 'hurt' : 'aim';
        const productionActionTick = productionAction === 'death'
          ? Math.max(0, visualTick - (lastPlayerHit?.tick ?? visualTick))
          : productionAction === 'melee'
            ? meleeAge
            : productionAction === 'grenade'
              ? grenadeAge
              : productionAction === 'dash'
                ? Math.max(0, dashState?.activeUntilTick ? 18 - Math.max(0, dashState.activeUntilTick - visualTick) : 0)
                : productionAction === 'pistol-fire'
                  ? pistolFireAge
                  : productionAction === 'hurt' ? playerHitAge : visualTick;
        productionHeroDisplay.applyPose({
          simulationTick: visualTick,
          actionTick: productionActionTick,
          locomotion: dashing ? 'moving' : motion.locomotion,
          legDirection: dashing && lastDashDirection ? quantizeDirection(lastDashDirection, 8) : motion.legDirection,
          torsoDirection: motion.torsoDirection,
          action: productionAction,
        });
        const externalWeaponAuthoritative = Boolean(authoredHeldWeaponDisplay)
          && !['melee', 'grenade', 'death'].includes(productionAction);
        productionHeroDisplay.setLayerVisible('weapon', !externalWeaponAuthoritative);
        if (authoredHeldWeaponDisplay) authoredHeldWeaponDisplay.container.visible = externalWeaponAuthoritative;
        actorVisual.scale.set(PRODUCTION_HERO_RUNTIME_SCALE * camera.zoom);
        actorVisual.rotation = 0;
      } else if (mannequinDisplay && motion) {
        mannequinDisplay.applyPose({
          simulationTick: simulation?.tick ?? 0,
          locomotion: motion.locomotion,
          legDirection: motion.legDirection,
          torsoDirection: motion.torsoDirection,
        });
        actorVisual.scale.set(MANNEQUIN_RUNTIME_SCALE * camera.zoom);
        actorVisual.rotation = 0;
      } else {
        marker.rotation = motion ? motion.torsoDirection * (Math.PI / 4) : 0;
      }
      if (debugGridEnabled && playerBody) {
        collisionDebug.circle(groundScreen.x, groundScreen.y, playerBody.radius * camera.zoom).stroke({ color: 0xffd166, width: 2, alpha: 0.9 });
        const contact = lastCollision?.contacts.at(-1);
        if (contact) {
          collisionDebug.moveTo(groundScreen.x, groundScreen.y)
            .lineTo(groundScreen.x + contact.normal.x * 48, groundScreen.y + contact.normal.y * 48)
            .stroke({ color: 0xff5c7a, width: 3, alpha: 0.9 });
        }
      }
      const runtimeMode = `${aimIntent?.source?.toUpperCase() ?? 'NO AIM'} // ${motion?.locomotion?.toUpperCase() ?? 'IDLE'}`;
      const debugContact = lastCollision?.contacts.at(-1)?.blockerId ?? lastTraversal?.reason ?? 'clear';
      const combatStatusLayout = computeCombatStatusLayout({ width: view.width, height: view.height, touchUiEnabled });
      const narrowDebug = debugGridEnabled && combatStatusLayout.multiline;
      label.style.fontSize = combatStatusLayout.fontSize;
      label.style.align = 'center';
      const weaponStatus = weaponLoadout
        ? getWeaponReadabilityStatus(weaponLoadout, {
          tick: simulation?.tick ?? 0,
          progressionByWeapon: runProgression ? pistolProgressionByWeapon(getRunProgressionSnapshot(runProgression).ranks) : {},
        })
        : null;
      const weaponHud = weaponStatus?.hudLabel ?? 'NO WEAPON 0/0';
      const dashStatus = dashState && simulation ? getDashStatus(dashState, simulation.tick) : null;
      const dashHud = dashStatus?.active ? 'DASHING' : dashStatus?.ready ? 'DASH READY' : `DASH ${dashStatus?.cooldownSecondsRemaining ?? 10}s`;
      const dashAccessible = dashStatus?.active ? 'Dash active' : dashStatus?.ready ? 'Dash ready' : `Dash ${dashStatus?.cooldownSecondsRemaining ?? 10} seconds`;
      const activeEnemyCount = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0).length;
      const enemyTellCount = grayboxEnemies.filter((enemy) => enemy.active && enemy.attackPhase === 'tell').length;
      const activePowerupIds = collectibleSnapshot?.activeEffects.map((effect) => effect.effectId) ?? [];
      const activePowerupLabels = collectibleSnapshot?.activeEffects.map((effect) => `${effect.effectId.toUpperCase()} ${Math.max(0, Math.ceil((effect.expiresTick - collectibleSnapshot.tick) / 60))}S`) ?? [];
      const powerupHud = activePowerupLabels.length > 0 ? ` // POWER ${activePowerupLabels.join('+')}` : '';
      const combatHud = `${weaponHud} // ${dashHud} // FRAG ${grenadeSystem?.handCharges ?? 0} // HP ${playerHealth} // E ${activeEnemyCount} // K ${runKills}${powerupHud}`;
      const compactCombatHud = `${weaponHud} // ${dashHud} // HP ${playerHealth}\nFRAG ${grenadeSystem?.handCharges ?? 0} // E ${activeEnemyCount} // K ${runKills}${powerupHud}`;
      const landscapeCombatHud = `HP ${playerHealth} // ${weaponHud} // FRAG ${grenadeSystem?.handCharges ?? 0} // E ${activeEnemyCount} // K ${runKills}${activePowerupLabels.length > 0 ? `\nPOWER ${activePowerupLabels.join('+')}` : ''}`;
      const accessibleCombatStatus = `${weaponStatus?.accessibleLabel ?? 'No weapon'}, ${dashAccessible}, ${grenadeSystem?.handCharges ?? 0} grenades, health ${playerHealth}, ${activeEnemyCount} enemies, ${enemyTellCount} attack tells, ${runKills} defeats${activePowerupIds.length > 0 ? `, active powerups ${activePowerupIds.join(', ')}` : ''}`;
      if (dashStatusElement) {
        dashStatusElement.textContent = dashAccessible;
        dashStatusElement.dataset.ready = String(dashStatus?.ready === true);
      }
      if (combatStatusElement && accessibleCombatStatus !== lastAccessibleCombatStatus) {
        combatStatusElement.value = accessibleCombatStatus;
        lastAccessibleCombatStatus = accessibleCombatStatus;
      }
      label.text = debugGridEnabled
        ? combatStatusLayout.compact
          ? `${landscapeCombatHud}\n${runtimeMode}`
          : narrowDebug
          ? `${compactCombatHud}\n${runtimeMode}\n${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}`
          : `${combatHud} // ${runtimeMode} // ${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}`
        : combatStatusLayout.compact ? landscapeCombatHud : combatStatusLayout.multiline ? compactCombatHud : combatHud;
      const combatStatusX = combatStatusLayout.compact && activePowerupLabels.length > 0
        ? view.width * 0.25
        : combatStatusLayout.x;
      // The narrow debug/evidence view adds two diagnostic rows. Offset that
      // taller block below the cockpit cards so its weapon/reload line cannot
      // hide behind score/level chrome on portrait phones.
      const combatStatusY = combatStatusLayout.y + (narrowDebug ? 32 : 0);
      label.position.set(combatStatusX, combatStatusY);
      // Screen-space overlays: enemy health pips, boss bar, damage flash, and
      // the low-health vignette. All projection-only.
      for (const pip of enemyHealthPips) {
        if (pip.ratio >= 1) continue;
        const width = Math.max(18, pip.radius * 1.9) * camera.zoom;
        // overlayVisuals sits on the stage and is not shake-offset, so carry
        // the world offset across or pips detach from their bodies mid-shake.
        const pipX = pip.screen.x + world.position.x;
        const y = pip.screen.y + world.position.y + Math.max(14, pip.radius * 0.9) * camera.zoom;
        overlayVisuals.roundRect(pipX - width / 2, y, width, 4, 2).fill({ color: 0x0a0f14, alpha: 0.72 });
        overlayVisuals.roundRect(pipX - width / 2, y, width * pip.ratio, 4, 2)
          .fill({ color: pip.ratio > 0.5 ? 0x8ef5a8 : pip.ratio > 0.25 ? 0xffd166 : 0xff5c7a, alpha: 0.96 });
      }
      bossLabel.visible = false;
      if (liquidatorBoss?.active && (simulation?.tick ?? 0) >= liquidatorBoss.startTick) {
        const barWidth = Math.min(420, view.width * 0.52);
        const barX = view.width / 2 - barWidth / 2;
        const bossBarY = view.width < 560 ? 276 : 124;
        const ratio = Math.max(0, Math.min(1, liquidatorBoss.health / liquidatorBoss.maxHealth));
        bossLabel.text = `THE LIQUIDATOR // ${liquidatorBoss.phaseId.replaceAll('-', ' ').toUpperCase()}`;
        bossLabel.position.set(view.width / 2, bossBarY - 5);
        bossLabel.visible = true;
        overlayVisuals.roundRect(barX - 2, bossBarY - 2, barWidth + 4, 14, 7).fill({ color: 0x05090d, alpha: 0.82 });
        overlayVisuals.roundRect(barX, bossBarY, barWidth, 10, 5).fill({ color: 0x1b2733, alpha: 0.95 });
        overlayVisuals.roundRect(barX, bossBarY, barWidth * ratio, 10, 5).fill({ color: 0xff496c, alpha: 0.98 });
        // Phase boundaries so the player can read fight progress.
        for (const marker of [1 / 3, 2 / 3]) {
          overlayVisuals.rect(barX + barWidth * marker, bossBarY, 2, 10).fill({ color: 0x05090d, alpha: 0.9 });
        }
      }
      const damageAge = lastPlayerHit && simulation ? simulation.tick - lastPlayerHit.tick : Number.POSITIVE_INFINITY;
      if (!settings.reduceFlash && damageAge >= 0 && damageAge < PLAYER_DAMAGE_FLASH_TICKS) {
        overlayVisuals.rect(0, 0, view.width, view.height)
          .fill({ color: 0xff3355, alpha: 0.26 * (1 - damageAge / PLAYER_DAMAGE_FLASH_TICKS) });
      }
      const healthRatio = maxPlayerHealth > 0 ? playerHealth / maxPlayerHealth : 1;
      if (healthRatio < LOW_HEALTH_VIGNETTE_THRESHOLD) {
        const intensity = (1 - healthRatio / LOW_HEALTH_VIGNETTE_THRESHOLD) * 0.3;
        const band = Math.max(40, Math.min(view.width, view.height) * 0.16);
        overlayVisuals.rect(0, 0, view.width, band).fill({ color: 0xff2d4f, alpha: intensity * 0.55 });
        overlayVisuals.rect(0, view.height - band, view.width, band).fill({ color: 0xff2d4f, alpha: intensity * 0.55 });
        overlayVisuals.rect(0, 0, band, view.height).fill({ color: 0xff2d4f, alpha: intensity * 0.45 });
        overlayVisuals.rect(view.width - band, 0, band, view.height).fill({ color: 0xff2d4f, alpha: intensity * 0.45 });
      }
      renderMinimap(view, renderState);
      if (debugGridEnabled || releaseTelemetryEnabled) {
        dataset.actorX = renderState.x.toFixed(3);
        dataset.actorY = renderState.y.toFixed(3);
        dataset.targetX = grayboxEnemies[0]?.x.toFixed(3) ?? '';
        dataset.aimSource = aimIntent?.source ?? 'none';
        dataset.firing = String(aimIntent?.fire === true);
        dataset.collisionBlocker = lastCollision?.contacts.at(-1)?.blockerId ?? '';
        dataset.collisionStalls = String(zeroDisplacementFrames);
        dataset.surfaceId = lastGround?.surfaceId ?? '';
        dataset.groundZ = String(lastGround?.groundZ ?? 0);
        dataset.traversal = lastTraversal?.reason ?? '';
        dataset.projectileCount = String(activeProjectiles.length);
        dataset.projectileDrops = String(droppedProjectiles);
        dataset.projectileHit = lastProjectileHit?.targetId ?? '';
        dataset.weaponId = weaponLoadout?.activeWeaponId ?? '';
        dataset.weaponClipSize = String(weaponStatus?.clipSize ?? 0);
        dataset.weaponStatus = weaponStatus?.mode ?? 'unavailable';
        dataset.weaponReloadTicksRemaining = String(weaponStatus?.mode === 'reloading' ? weaponStatus.ticksRemaining : 0);
        dataset.actorArt = actorVisual.label ?? '';
        // Report what actually rendered, not what was requested: a failed
        // atlas load falls back to the prototype and must say so.
        dataset.actorArtSource = productionHeroDisplay ? 'production-blender-atlas-v1' : mannequinDisplay ? 'blender-atlas-v1' : 'pixi-graybox';
        dataset.actorArtActor = productionHeroDisplay && loadedProductionHeroId ? loadedProductionHeroId : mannequinDisplay ? 'neutral-mannequin' : 'prototype-human';
        dataset.actorArtFallbackReason = productionHeroLoadError ?? '';
        dataset.actorArtLayers = productionHeroDisplay?.layerOrder.join(',') ?? mannequinDisplay?.layerOrder.join(',') ?? 'graybox';
        dataset.actorArtFrameIds = actorVisual.frameIds ?? '';
        // Report the art actually in use: the authored roster only applies to
        // archetypes whose atlas has resolved.
        dataset.enemyArt = enemyRosterIndexes.size > 0 ? 'production-roster-atlas-v1' : 'production-vector-enemies-v1';
        dataset.bossArt = enemyRosterIndexes.has('the-liquidator') ? 'production-roster-atlas-v1' : 'production-vector-liquidator-v1';
        dataset.enemyRosterLoaded = [...enemyRosterIndexes.keys()].sort().join(',');
        dataset.enemyRosterError = enemyRosterLoadError ?? '';
        dataset.rosterPreview = String(rosterPreviewEnabled);
        dataset.rosterPreviewAutoFire = String(aimState?.autoFireEnabled === true);
        dataset.terrainTiles = terrainTiles.ready ? 'authored-tiles-v1' : 'flat-colour-fallback';
        dataset.terrainTilesLoaded = terrainTiles.loadedIds.join(',');
        dataset.terrainTilesError = terrainTileLoadError ?? '';
        dataset.worldArt = 'production-vector-world-v1';
        dataset.worldShader = worldArtReport?.shaderIds.join(',') ?? '';
        dataset.worldParticles = String(worldArtReport?.particleCount ?? 0);
        dataset.worldRenderedParticles = String(worldArtReport?.renderedParticleCount ?? 0);
        dataset.worldBlockers = String(worldArtReport?.blockerCount ?? 0);
        dataset.worldLandmarks = String(worldArtReport?.landmarkCount ?? 0);
        dataset.performanceProfile = performanceProfile.id;
        dataset.renderResolution = String(performanceProfile.resolution);
        dataset.animatedEnemies = String(animatedEnemyCount);
        const runSnapshot = runProgression ? getRunProgressionSnapshot(runProgression) : null;
        const audioSnapshot = combatAudio.status();
        dataset.runScore = String(runSnapshot?.score ?? 0);
        dataset.runXp = String(runSnapshot?.xp ?? 0);
        dataset.runLevel = String(runSnapshot?.level ?? 1);
        dataset.runPendingLevels = String(runSnapshot?.pendingLevels ?? 0);
        dataset.musicEnabled = String(audioSnapshot.musicEnabled);
        dataset.musicActive = String(audioSnapshot.musicActive);
        dataset.bossVisualState = bossVisual.visible ? bossVisual.visualState ?? 'idle' : 'hidden';
        dataset.inputWeaponSlot = String(lastInputWeaponSlot);
        dataset.simulationTick = String(simulation?.tick ?? 0);
        dataset.weaponAmmo = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).ammoInClip) : '';
        dataset.weaponHeat = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).heat) : '';
        dataset.weaponOverheated = String(weaponLoadout ? getActiveWeaponState(weaponLoadout).overheated : false);
        dataset.grenadeCount = String(grenadeSystem?.active.length ?? 0);
        dataset.activeGrenadeWarnings = String(activeGrenadeWarnings);
        dataset.activeGrenadeWarningRadius = String(activeGrenadeWarningRadius);
        dataset.activeGrenadeWarningUrgent = String(activeGrenadeWarningUrgent);
        dataset.handGrenades = String(grenadeSystem?.handCharges ?? 0);
        dataset.dashReadyTick = dashState ? String(dashState.cooldownReadyTick) : '';
        dataset.dashActive = String(dashStatus?.active === true);
        dataset.dashInvulnerable = String(dashStatus?.invulnerable === true);
        dataset.dashStopReason = dashStatus?.lastStopReason ?? '';
        dataset.playerHealth = String(playerHealth);
        dataset.collectibleCount = String(collectibleSnapshot?.collectedCount ?? 0);
        dataset.collectibleRemaining = String(collectibleSnapshot?.remainingCount ?? 9);
        dataset.collectibleLast = lastCollectibleEvent?.effectId ?? '';
        dataset.collectibleActive = collectibleSnapshot?.activeEffects.map((effect) => effect.effectId).join(',') ?? '';
        dataset.collectibleDamageMultiplier = String(collectibleSnapshot?.damageMultiplier ?? 1);
        dataset.collectibleSpeedMultiplier = String(collectibleSnapshot?.speedMultiplier ?? 1);
        dataset.audioVoices = String(combatAudio.status().activeVoices);
        dataset.lastWeaponFire = lastWeaponFire?.weaponId ?? '';
        dataset.lastMeleeTick = lastMeleeAttack ? String(lastMeleeAttack.tick) : '';
        dataset.lastMeleeHits = String(lastMeleeAttack?.hits ?? 0);
        dataset.lastGrenadeReason = lastGrenadeDetonation?.reason ?? '';
        dataset.lastGrenadeTick = lastGrenadeDetonation ? String(lastGrenadeDetonation.tick) : '';
        dataset.projectileCover = lastProjectileResolution?.resolutions
          ?.find((resolution) => resolution.coverHit)?.coverHit?.blockerId ?? '';
        dataset.targetHealth = String(grayboxEnemies[0]?.health ?? 0);
        dataset.enemyCount = String(activeEnemyCount);
        dataset.enemyArchetypes = grayboxEnemies.map((enemy) => enemy.archetypeId).join(',');
        dataset.enemyTells = String(enemyTellCount);
        dataset.enemyDecisions = String(lastEnemyStep?.decisions ?? 0);
        dataset.enemySafetySteps = String(lastEnemyStep?.safetySteps ?? 0);
        dataset.enemyAttackDrops = String(lastEnemyAttack?.droppedEvents ?? 0);
        dataset.enemyDeathVisuals = String(enemyDeathMarkers.size);
        dataset.enemyEliteVisuals = String([...enemyMarkers.values()].filter((enemyMarker) => enemyMarker.eliteProjection).length);
        const encounterSnapshot = getEncounterSnapshot(simulation?.tick ?? 0);
        dataset.encounterBand = encounterSnapshot.bandId;
        dataset.directorInsertions = String(encounterDirector?.insertedCount ?? 0);
        dataset.directorRejections = String(encounterDirector?.rejectedCount ?? 0);
        dataset.directorLastReason = lastDirectorStep?.reason ?? '';
        dataset.directorBodyCap = String(encounterSnapshot.bodyCap);
        dataset.directorThreatCap = String(encounterSnapshot.threatCap);
        dataset.bossActive = String(liquidatorBoss?.active === true && (simulation?.tick ?? 0) >= liquidatorBoss.startTick);
        dataset.bossPhase = liquidatorBoss?.phaseId ?? '';
        dataset.bossHealth = String(liquidatorBoss?.health ?? 0);
        dataset.bossPendingTells = String(liquidatorBoss?.pendingAttacks.length ?? 0);
        dataset.bossPendingAttackIds = liquidatorBoss?.pendingAttacks.map((pending) => pending.attackId).join(',') ?? '';
        dataset.bossTelegraphPrimitives = String(bossTelegraphPrimitiveCount);
        dataset.bossAttackDrops = String(liquidatorBoss?.droppedEvents ?? 0);
        dataset.worldId = LEVEL_ONE_WORLD.id;
        dataset.worldWidth = String(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
        dataset.worldHeight = String(WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY);
        dataset.districtId = getLevelOneDistrictAt(renderState.x, renderState.y)?.id ?? '';
        dataset.revealedCells = String(revealSnapshot.revealedCellIds.length);
        dataset.revealTotalCells = String(revealSnapshot.totalCells);
      }
    } else {
      minimap.clear();
      actorVisual.position.set(view.width * 0.5, view.height * 0.5);
      label.position.set(view.width * 0.5, view.height * 0.5 + 58);
    }
  };

  const stopCurrentSession = () => {
    touchController?.destroy();
    touchController = null;
    inputController?.destroy();
    inputController = null;
    if (simulation && simulation.state !== 'exit') simulation.exit();
    previousActor = null;
    renderActor = null;
    motion = null;
    aimState = null;
    aimIntent = null;
    grayboxEnemies = [];
    enemyPopulation = null;
    encounterDirector = null;
    lastDirectorStep = null;
    liquidatorBoss = null;
    bossHitVisualUntilTick = -1;
    bossDeathVisualUntilTick = -1;
    lastBossStep = null;
    lastEnemyStep = null;
    lastEnemyAttack = null;
    resetEnemyMarkers([]);
    clearEnemyDeathMarkers();
    enemyVisualFacing.clear();
    enemyTelegraphs.clear();
    bossTelegraphs.clear();
    bossVisual.visible = false;
    playerBody = null;
    lastCollision = null;
    lastTraversal = null;
    lastGround = null;
    zeroDisplacementFrames = 0;
    activeProjectiles = [];
    weaponLoadout = null;
    meleeState = null;
    grenadeSystem = null;
    dashState = null;
    lastDashReady = true;
    droppedProjectiles = 0;
    lastProjectileResolution = null;
    lastProjectileHit = null;
    lastCombatResolution = null;
    lastWeaponFire = null;
    lastPlayerHit = null;
    lastDashDirection = null;
    shakeStartTick = -1;
    shakeMagnitude = 0;
    world.position.set(0, 0);
    overlayVisuals.clear();
    lastMeleeAttack = null;
    lastGrenadeThrow = null;
    lastGrenadeDetonation = null;
    combatVisualEvents = [];
    lastAccessibleCombatStatus = '';
    playerDefeatController = null;
    playerHealth = 100;
    collectibleState = null;
    collectibleSnapshot = null;
    lastCollectibleEvent = null;
    maxPlayerHealth = 100;
    runProgression = null;
    upgradePending = false;
    cockpit?.hideUpgrade();
    cockpit?.setPaused(false);
    runKills = 0;
    runCombo = 0;
    maxRunCombo = 0;
    cockpit?.updateCombo(0);
    runSummaryAccumulator = null;
    runEventSequence = 0;
    previousGrenade = false;
    previousDash = false;
    previousWeaponNext = false;
    lastInputWeaponSlot = 0;
    revealState = createLevelOneRevealState();
    revealLevelOneAt(revealState, runtimePlayerSpawn);
    revealSnapshot = getLevelOneRevealSnapshot(revealState);
  };

  const initializeSession = (payload) => {
    stopCurrentSession();
    // The flow field is per-run simulation state: a restart resets the tick
    // counter, so carrying the previous run's field would steer blocked
    // pursuit with stale data and break same-seed determinism.
    enemyFlowField = null;
    enemyFlowFieldTick = -1;
    minimapDiscovery.discoveredPoiIds.clear();
    minimapRevealCache = { snapshot: null, set: null };
    minimapModelCache = { tick: -1, model: null };
    // Art selection must never be able to abort a session: this runs inside
    // the bridge onInit handler, and throwing here would skip `game:ready`
    // and strand the parent until its bridge timeout. Request the session's
    // actor instead; it swaps in when it decodes.
    const sessionHeroSelection = productionHeroAsset(payload.heroId);
    ensureProductionHeroAtlas(sessionHeroSelection.actorId);
    sessionPayload = payload;
    syncRuntimeSettings(payload.settings);
    elapsedMs = 0;
    simulation = new DeterministicSimulation({ seed: payload.session.seed });
    runProgression = createRunProgression({ seed: payload.session.seed });
    maxPlayerHealth = 100;
    upgradePending = false;
    cockpit?.setSession(payload, getWeb3AdapterStatus({
      embedded: window.parent !== window,
      rankedEligible: payload.session.rankedEligible,
    }));
    cockpit?.updateRun(getRunProgressionSnapshot(runProgression));
    actor = createActorSpatialState({ ...runtimePlayerSpawn, z: 0 });
    runSummaryAccumulator = createRunSummaryAccumulator({
      seed: payload.session.seed,
      buildHash: payload.session.buildHash,
      mode: payload.mode,
      heroId: payload.heroId,
      startTick: 0,
      startPosition: actor,
    });
    lastGround = queryGround(actor.x, actor.y);
    actor.groundZ = lastGround.groundZ;
    actor.z = lastGround.groundZ;
    motion = createPlayerMotionState({ x: actor.x, y: actor.y, maxSpeed: LEVEL_ONE_WORLD.player.maxSpeed });
    aimState = createAimState({ autoFireEnabled: !rosterPreviewEnabled, manualHoldTicks: 8 });
    aimIntent = null;
    const previewSpawns = Object.freeze({
      'bagholder-rusher': Object.freeze({ x: 1120, y: 2400 }),
      forkrunner: Object.freeze({ x: 860, y: 2050 }),
      'liquidator-agent': Object.freeze({ x: 430, y: 2200 }),
      'whale-enforcer': Object.freeze({ x: 1260, y: 2700 }),
      'gas-bomber': Object.freeze({ x: 520, y: 2720 }),
      'validator-cultist': Object.freeze({ x: 1100, y: 2050 }),
    });
    const rosterPreviewOffsets = Object.freeze({
      'bagholder-rusher': Object.freeze({ x: -120, y: -80 }),
      forkrunner: Object.freeze({ x: 0, y: -100 }),
      'liquidator-agent': Object.freeze({ x: 120, y: -80 }),
      'whale-enforcer': Object.freeze({ x: -120, y: 140 }),
      'gas-bomber': Object.freeze({ x: 0, y: 160 }),
      'validator-cultist': Object.freeze({ x: 120, y: 140 }),
    });
    enemyPopulation = createEnemyPopulation({ capacity: 192, threatCapacity: 1024 });
    const openingEnemyByArchetypeId = new Map(ENEMY_ARCHETYPE_IDS.map((archetypeId, index) => {
      const offset = rosterPreviewOffsets[archetypeId];
      const position = rosterPreviewEnabled
        ? { x: runtimePlayerSpawn.x + offset.x, y: runtimePlayerSpawn.y + offset.y }
        : previewSpawns[archetypeId];
      const enemy = createEnemyState({
        archetypeId,
        id: `prototype-${String(index + 1).padStart(2, '0')}-${archetypeId}`,
        x: position.x,
        y: position.y,
        groundZ: queryGround(position.x, position.y).groundZ,
        visualMode: 'normal',
      });
      return [archetypeId, enemy];
    }));
    const initialEnemyArchetypeIds = rosterPreviewEnabled ? ENEMY_ARCHETYPE_IDS : HMH_OPENING_ENEMY_ARCHETYPE_IDS;
    grayboxEnemies = initialEnemyArchetypeIds.map((archetypeId) => {
      const enemy = openingEnemyByArchetypeId.get(archetypeId);
      const openingHealth = HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE[archetypeId];
      if (Number.isFinite(openingHealth)) {
        enemy.health = openingHealth;
        enemy.maxHealth = openingHealth;
      }
      return enemy;
    });
    enemyPopulation.active = grayboxEnemies;
    enemyPopulation.activeThreat = grayboxEnemies.reduce((sum, enemy) => sum + ENEMY_ARCHETYPES[enemy.archetypeId].costs.threat, 0);
    enemyPopulation.insertedCount = grayboxEnemies.length;
    for (const enemy of grayboxEnemies) enemyPopulation.seenIds.add(enemy.id);
    encounterDirector = createEncounterDirector({
      nextSpawnTick: rosterPreviewEnabled ? Number.MAX_SAFE_INTEGER : directorDebugEnabled ? 1 : 600,
      seed: payload.session.seed,
    });
    const bossSpawn = bossDebugEnabled ? { x: 1380, y: 2400 } : LEVEL_ONE_WORLD.encounterArenas.at(-1).anchor;
    liquidatorBoss = createLiquidatorBoss({
      id: 'boss-liquidator',
      x: bossSpawn.x,
      y: bossSpawn.y,
      groundZ: queryGround(bossSpawn.x, bossSpawn.y).groundZ,
      startTick: bossDebugEnabled ? 1 : 72_000,
    });
    resetEnemyMarkers(grayboxEnemies);
    playerBody = createCollisionBody({ id: 'player', kind: 'player', radius: LEVEL_ONE_WORLD.player.radius, minZ: 0, maxZ: 56 });
    previousGrenade = false;
    previousDash = false;
    previousWeaponNext = false;
    lastInputWeaponSlot = 0;
    weaponLoadout = createWeaponLoadout({ weaponIds: WEAPON_ORDER, activeWeaponId: WEAPON_ORDER[0], seed: payload.session.seed });
    if (weaponPilotEnabled) {
      for (const weaponId of WEAPON_ORDER) {
        if (weaponId !== weaponLoadout.activeWeaponId) {
          grantWeaponPickup(weaponLoadout, { tick: 0, weaponId, select: false });
          recordRunWeaponEvent(runSummaryAccumulator, { type: 'pickup', weaponId });
        }
      }
    }
    if (collectibleAmmoPilotEnabled) weaponLoadout.weapons['coin-blaster'].ammoInClip = 1;
    meleeState = createMeleeState();
    grenadeSystem = createGrenadeSystem({ capacity: MAX_ACTIVE_GRENADES, handCharges: 3 });
    dashState = createDashState({ cooldownTier: 0 });
    collectibleState = createCollectibleState({ placements: authoredPointOfInterestPlacements });
    collectibleSnapshot = getCollectibleSnapshot(collectibleState, { tick: 0 });
    lastCollectibleEvent = null;
    lastDashReady = true;
    playerDefeatController = createPlayerDefeatController({ maxHealth: maxPlayerHealth });
    playerHealth = collectibleHealthPilotEnabled ? 70 : maxPlayerHealth;
    runKills = 0;
    runCombo = 0;
    maxRunCombo = 0;
    cockpit?.updateCombo(0);
    if (progressionPilotEnabled) {
      const pilotSnapshot = recordRunDefeat(runProgression, {
        enemyId: 'evidence-progression-pilot',
        threatCost: 20,
        tick: 0,
      });
      runKills = 1;
      recordRunKill(runSummaryAccumulator, { enemyRoleId: 'bagholder-rusher', weaponId: 'coin-blaster' });
      cockpit?.updateRun(pilotSnapshot);
      upgradePending = pilotSnapshot.pendingLevels > 0;
    }
    runEventSequence = 0;
    previousActor = createActorSpatialState({ ...actor });
    renderActor = actor;
    camera = createCameraState({
      x: actor.x,
      y: actor.y,
      zoom: 1,
      deadZone: { width: 160, height: 90 },
      bounds: WORLD_BOUNDS,
    });
    input = new InputState();
    gamepadWasActive = false;
    inputController = createBrowserInputController({ input, target: app.canvas, windowRef: window, documentRef: document });
    touchController = createTouchControlAdapter({
      input,
      root: stageElement,
      windowRef: window,
      documentRef: document,
      onPause: () => {
        if (simulation?.state === 'paused') resumeRuntime('user');
        else pauseRuntime('user');
      },
    });
    simulation.onStep(({ tick, dtSeconds, input: tickInput }) => {
      lastInputWeaponSlot = tickInput.weaponSlot;
      previousActor = createActorSpatialState({ ...actor });
      for (const enemy of grayboxEnemies) {
        enemy.previousX = enemy.x;
        enemy.previousY = enemy.y;
        enemy.previousGroundZ = enemy.groundZ;
      }
      aimIntent = resolveAimIntent(aimState, {
        tick,
        actor: motion,
        input: tickInput,
        targets: grayboxEnemies,
        device: tickInput.aimAssist ? 'gamepad' : 'pointer',
        // Enemies already respect cover before they may fire; auto-target and
        // auto-fire must honour the same rule instead of locking onto — and
        // emptying a clip into — a target behind a wall.
        lineOfSight: (candidate) => traceHeightAwareLineOfSight({
          from: { x: motion.x, y: motion.y, z: actor.groundZ + PROJECTILE_FLIGHT_HEIGHT },
          to: { x: candidate.x, y: candidate.y, z: candidate.groundZ + PROJECTILE_FLIGHT_HEIGHT },
          blockers: WORLD_BLOCKERS,
        }).clear,
      });
      const movementStart = { x: motion.x, y: motion.y, z: actor.groundZ };
      // Resolved before movement: the mobility upgrades feed the movement step,
      // and this was previously declared further down the same tick.
      const runEffects = getRunProgressionSnapshot(runProgression).effects;
      const progressionByWeapon = pistolProgressionByWeapon(runProgression.ranks);
      const dashPressed = tickInput.dash && !previousDash;
      const dashStart = dashPressed
        ? beginDash(dashState, { tick, direction: tickInput.move, fallbackDirection: aimIntent.direction })
        : null;
      previousDash = tickInput.dash;
      if (dashStart?.started) {
        motion.vx = 0;
        motion.vy = 0;
        motion.recoilVx = 0;
        motion.recoilVy = 0;
        lastDashReady = false;
        lastDashDirection = { ...dashState.direction };
      }
      const dashFrame = stepDash(dashState, { tick });
      if (dashFrame.active) {
        const dashWorld = resolveDashWorldStep({
          state: dashState,
          start: movementStart,
          delta: dashFrame.delta,
          body: playerBody,
          blockers: WORLD_BLOCKERS,
          bounds: WORLD_BOUNDS,
          queryGround,
          enemies: grayboxEnemies.filter((enemy) => enemy.active),
        });
        motion.x = dashWorld.position.x;
        motion.y = dashWorld.position.y;
        lastCollision = dashWorld.collision;
        lastTraversal = dashWorld.traversal;
        lastGround = dashWorld.ground;
        zeroDisplacementFrames = lastCollision.telemetry.zeroDisplacementFrames;
        for (const enemy of grayboxEnemies) {
          const delta = dashWorld.enemyDeltas.get(enemy.id);
          if (delta) { enemy.x += delta.x; enemy.y += delta.y; }
        }
        const dashStopped = dashFrame.completed || dashWorld.stopReason !== null;
        motion.vx = dashStopped ? 0 : (motion.x - movementStart.x) / dtSeconds;
        motion.vy = dashStopped ? 0 : (motion.y - movementStart.y) / dtSeconds;
        pushCombatVisualEvent({
          type: 'dash',
          tick,
          point: { x: motion.x, y: motion.y, z: lastGround.groundZ + 24 },
          direction: { ...dashState.direction },
        });
      } else {
        const currentGround = queryGround(motion.x, motion.y);
        const moveMagnitude = Math.hypot(tickInput.move.x, tickInput.move.y);
        let terrainSpeedMultiplier = 1;
        if (moveMagnitude > 0.001) {
          const probeDistance = Math.max(8, motion.maxSpeed * dtSeconds);
          const probeGround = queryGround(
            motion.x + tickInput.move.x / moveMagnitude * probeDistance,
            motion.y + tickInput.move.y / moveMagnitude * probeDistance,
          );
          terrainSpeedMultiplier = movementSpeedMultiplierForTransition(currentGround, probeGround, probeDistance);
        }
        stepPlayerMovement(motion, {
          move: tickInput.move,
          aim: { ...aimIntent.direction, active: true },
        }, {
          dtSeconds,
          speedMultiplier: terrainSpeedMultiplier
            * (collectibleSnapshot?.speedMultiplier ?? 1)
            * runEffects.moveSpeedMultiplier,
        });
        const pressureEnemies = liquidatorBoss.active && tick >= liquidatorBoss.startTick
          ? [...grayboxEnemies, liquidatorBoss]
          : grayboxEnemies;
        const pressure = resolveEnemyPressure({
          x: motion.x,
          y: motion.y,
          radius: 24,
          velocity: { x: motion.vx, y: motion.vy },
        }, pressureEnemies);
        motion.x += pressure.playerDelta.x;
        motion.y += pressure.playerDelta.y;
        const pressureSpeed = Math.hypot(motion.vx, motion.vy);
        motion.vx = pressure.allowedVelocity.x * pressureSpeed;
        motion.vy = pressure.allowedVelocity.y * pressureSpeed;
        for (const enemy of grayboxEnemies) {
          const delta = pressure.enemyDeltas.get(enemy.id);
          if (delta) { enemy.x += delta.x; enemy.y += delta.y; }
        }
        lastCollision = resolveSweptCircleMotion({
          body: playerBody,
          start: movementStart,
          delta: { x: motion.x - movementStart.x, y: motion.y - movementStart.y },
          blockers: WORLD_BLOCKERS,
          bounds: WORLD_BOUNDS,
          priorZeroDisplacementFrames: zeroDisplacementFrames,
        });
        motion.x = lastCollision.position.x;
        motion.y = lastCollision.position.y;
        lastTraversal = resolveSweptTraversalPath({
          start: movementStart,
          end: lastCollision.position,
          queryGround,
          maxSampleDistance: Math.max(4, playerBody.radius * 0.5),
        });
        motion.x = lastTraversal.position.x;
        motion.y = lastTraversal.position.y;
        lastGround = lastTraversal.ground;
        if (!lastTraversal.allowed) {
          motion.vx = 0;
          motion.vy = 0;
          motion.recoilVx = 0;
          motion.recoilVy = 0;
        }
        zeroDisplacementFrames = lastCollision.telemetry.zeroDisplacementFrames;
      }
      for (const enemy of grayboxEnemies) enemy.groundZ = queryGround(enemy.x, enemy.y).groundZ;
      for (const contact of lastCollision.contacts) {
        const inwardVelocity = motion.vx * contact.normal.x + motion.vy * contact.normal.y;
        if (inwardVelocity < 0) {
          motion.vx -= contact.normal.x * inwardVelocity;
          motion.vy -= contact.normal.y * inwardVelocity;
        }
        const inwardRecoil = motion.recoilVx * contact.normal.x + motion.recoilVy * contact.normal.y;
        if (inwardRecoil < 0) {
          motion.recoilVx -= contact.normal.x * inwardRecoil;
          motion.recoilVy -= contact.normal.y * inwardRecoil;
        }
      }
      actor.x = motion.x;
      actor.y = motion.y;
      actor.groundZ = lastGround.groundZ;
      actor.z = lastGround.groundZ;
      actor.vx = motion.vx;
      actor.vy = motion.vy;
      actor.heading = Math.atan2(aimIntent.direction.y, aimIntent.direction.x);
      actor.locomotion = dashFrame.active ? 'dash' : motion.locomotion;
      actor.combat = aimIntent.fire ? 'firing' : 'ready';
      if (tick % 6 === 0 && revealLevelOneAt(revealState, actor) > 0) revealSnapshot = getLevelOneRevealSnapshot(revealState);

      const viewForDirector = viewport();
      const directorCameraBounds = {
        minX: camera.x - viewForDirector.width * 0.5 / camera.zoom,
        minY: camera.y - viewForDirector.height * 0.5 / camera.zoom,
        maxX: camera.x + viewForDirector.width * 0.5 / camera.zoom,
        maxY: camera.y + viewForDirector.height * 0.5 / camera.zoom,
      };
      lastDirectorStep = rosterPreviewEnabled
        ? Object.freeze({ inserted: false, reason: 'roster-preview', tick, bandId: getEncounterSnapshot(tick).bandId })
        : stepEncounterDirector({
          state: encounterDirector,
          population: enemyPopulation,
          tick,
          districtId: getLevelOneDistrictAt(actor.x, actor.y)?.id ?? 'frontier-relay',
          player: { x: actor.x, y: actor.y, groundZ: actor.groundZ },
          camera: directorCameraBounds,
          spawnPoints: authoredSpawnPoints,
          nearRewardPoi: LEVEL_ONE_WORLD.pointsOfInterest.some((poi) => poi.hook === 'reward' && Math.hypot(actor.x - poi.anchor.x, actor.y - poi.anchor.y) <= 240),
          queryGround,
          isBlocked: spawnPointBlocked,
          isRouteReachable: (point) => point.routeValid === true,
          visualMode: 'normal',
        });
      if (lastDirectorStep.inserted) resetEnemyMarkers(grayboxEnemies);

      lastBossStep = liquidatorBoss.active && tick >= liquidatorBoss.startTick
        ? stepLiquidatorBoss({ boss: liquidatorBoss, tick, player: { x: actor.x, y: actor.y, groundZ: actor.groundZ } })
        : null;

      if (!rosterPreviewEnabled && openingEnemyMovementEnabled(tick)) {
        if (enemyFlowField === null || tick - enemyFlowFieldTick >= ENEMY_FLOW_REFRESH_TICKS) {
          enemyFlowField = computeEnemyFlowField({ grid: ENEMY_NAV_GRID, targetX: actor.x, targetY: actor.y });
          enemyFlowFieldTick = tick;
        }
        lastEnemyStep = stepEnemyPopulation({
          population: enemyPopulation,
          player: { x: actor.x, y: actor.y, groundZ: actor.groundZ },
          tick,
          dtSeconds,
          blockers: WORLD_BLOCKERS,
          bounds: WORLD_BOUNDS,
          queryGround,
          preservePrevious: true,
          navigation: enemyNavigation,
        });
      } else {
        lastEnemyStep = Object.freeze({ decisions: 0, safetySteps: 0 });
      }

      const hurtTargets = [];
      const meleeTargets = [];
      for (const enemy of grayboxEnemies) {
        if (!enemy.active || enemy.health <= 0) continue;
        const profile = createOrdinaryEnemyHurtboxProfile(enemy.radius);
        hurtTargets.push(createHurtTarget({
          id: enemy.id,
          bodyShape: profile.bodyShape,
          hurtShape: profile.projectileShape,
          previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
          currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
          minZ: profile.minZ,
          maxZ: profile.maxZ,
          health: enemy.health,
        }));
        meleeTargets.push(createMeleeTarget({
          id: enemy.id,
          previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
          currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
          radius: profile.meleeRadius,
          minZ: profile.minZ,
          maxZ: profile.maxZ,
        }));
      }
      if (liquidatorBoss.active && tick >= liquidatorBoss.startTick) hurtTargets.push(createHurtTarget({
        id: liquidatorBoss.id,
        bodyShape: { type: 'circle', radius: liquidatorBoss.body.radius },
        hurtShape: { type: 'circle', radius: 48 },
        previousGround: { x: liquidatorBoss.x, y: liquidatorBoss.y, z: liquidatorBoss.groundZ },
        currentGround: { x: liquidatorBoss.x, y: liquidatorBoss.y, z: liquidatorBoss.groundZ },
        minZ: 4,
        maxZ: 92,
        health: liquidatorBoss.health,
      }));
      if (liquidatorBoss.active && tick >= liquidatorBoss.startTick) meleeTargets.push(createMeleeTarget({
        id: liquidatorBoss.id,
        previousGround: { x: liquidatorBoss.x, y: liquidatorBoss.y, z: liquidatorBoss.groundZ },
        currentGround: { x: liquidatorBoss.x, y: liquidatorBoss.y, z: liquidatorBoss.groundZ },
        radius: 48,
        minZ: 4,
        maxZ: 92,
      }));
      const combatHitIntents = [];
      const collectibleFrame = stepCollectibles(collectibleState, { tick, player: actor });
      collectibleSnapshot = collectibleFrame.snapshot;
      for (const event of collectibleFrame.events) {
        lastCollectibleEvent = event;
        if (event.type !== 'collectible:collected') continue;
        recordRunCollectible(runSummaryAccumulator, { effectId: event.effectId });
        const placement = authoredPointOfInterestPlacements.find((candidate) => candidate.id === event.placementId);
        if (event.kind === 'heal') {
          const healthBefore = playerHealth;
          playerHealth = Math.min(maxPlayerHealth, playerHealth + event.amount);
          recordRunHealing(runSummaryAccumulator, playerHealth - healthBefore);
        } else if (event.kind === 'weapon-cache') {
          // A weapon cache grants ownership plus authored finite reserve.
          const previousWeaponId = weaponLoadout.activeWeaponId;
          grantWeaponPickup(weaponLoadout, { tick, weaponId: event.weaponId, select: true, progressionByWeapon });
          recordRunWeaponEvent(runSummaryAccumulator, { type: 'pickup', weaponId: event.weaponId });
          if (weaponLoadout.activeWeaponId !== previousWeaponId) recordRunWeaponEvent(runSummaryAccumulator, { type: 'swap', weaponId: event.weaponId });
        } else if (event.kind === 'ammo-refill') {
          refillWeaponLoadout(weaponLoadout, { tick, progressionByWeapon });
        } else if (event.kind === 'nuke') {
          rechargeHandGrenades(grenadeSystem, { tick, amount: 1 });
          for (const target of hurtTargets) {
            combatHitIntents.push({
              id: `${event.id}:${target.id}`,
              tick,
              time: 0,
              targetId: target.id,
              sourceId: 'player',
              weaponId: 'nuke-liquidation',
              damage: event.damage,
              criticalChance: 0,
              criticalMultiplier: 1,
              armorPiercing: true,
              direction: { x: 1, y: 0 },
              knockback: 0,
              point: { x: target.currentGround.x, y: target.currentGround.y, z: target.currentGround.z + target.minZ },
            });
          }
        }
        if (event.xpGain) {
          const xpSnapshot = grantRunXp(runProgression, event.xpGain, tick);
          cockpit?.updateRun(xpSnapshot);
          if (xpSnapshot.pendingLevels > 0) upgradePending = true;
        }
        combatAudio.play('pickup', { volume: 0.16 });
        if (placement) pushCombatVisualEvent({
          type: 'pickup',
          tick,
          point: { x: placement.x, y: placement.y, z: queryGround(placement.x, placement.y).groundZ + 20 },
          color: event.kind === 'heal' ? 0x83f28f : event.kind === 'nuke' ? 0xff6b86 : 0xfff06a,
        });
      }

      const steppedProjectiles = activeProjectiles.map((shot) => {
        const previous = Object.freeze({
          x: shot.previousX ?? shot.x,
          y: shot.previousY ?? shot.y,
          z: shot.previousZ ?? shot.z,
        });
        const flight = planProjectileFlightStep({
          previous,
          velocity: { x: shot.vx, y: shot.vy },
          dtSeconds,
          previousGroundZ: shot.groundZ ?? queryGround(previous.x, previous.y).groundZ,
          queryGround,
          flightHeight: PROJECTILE_FLIGHT_HEIGHT,
          flightCeilingZ: shot.flightCeilingZ,
        });
        const current = flight.current;
        const state = createProjectileState({
          id: shot.id,
          ownerId: 'player',
          previous: previous,
          current: current,
          heightTransition: flight.heightTransition,
          radius: shot.radius,
          damage: shot.damage,
          policy: shot.policy,
        });
        return {
          ...shot,
          previousX: null,
          previousY: null,
          previousZ: null,
          x: current.x,
          y: current.y,
          z: current.z,
          groundZ: flight.groundZ,
          remainingRange: shot.remainingRange - Math.hypot(current.x - previous.x, current.y - previous.y),
          state,
        };
      });
      if (steppedProjectiles.length > 0) {
        const broadphase = hurtTargets.length >= PROJECTILE_GRID_THRESHOLD
          ? new UniformHurtboxGrid({ targets: hurtTargets, cellSize: 96 })
          : null;
        const batch = resolveProjectileBatch({
          projectiles: steppedProjectiles.map((shot) => shot.state),
          targets: hurtTargets,
          blockers: WORLD_BLOCKERS,
          broadphase,
        });
        lastProjectileResolution = batch;
        const shotById = new Map(steppedProjectiles.map((shot) => [shot.id, shot]));
        for (const resolution of batch.resolutions) {
          const shot = shotById.get(resolution.projectileId);
          recordRunProjectileResolution(runSummaryAccumulator, shot, resolution.hits);
          for (const hit of resolution.hits) {
            combatHitIntents.push({
              id: `${shot.id}:${hit.targetId}:${hit.kind}`,
              tick,
              time: hit.time,
              targetId: hit.targetId,
              sourceId: 'player',
              weaponId: shot.weaponId,
              damage: hit.damage,
              criticalChance: Math.min(CRITICAL_CHANCE_CAP, BASE_CRITICAL_CHANCE + runEffects.criticalChanceBonus),
              criticalMultiplier: BASE_CRITICAL_MULTIPLIER + runEffects.criticalDamageBonus,
              armorPiercing: shot.policy.type === 'pierce',
              direction: { x: shot.vx, y: shot.vy },
              knockback: (WEAPON_KNOCKBACK[shot.weaponId] ?? 6) * shot.knockbackMultiplier,
              point: hit.point,
            });
          }
        }
        const terminalIds = new Set(batch.resolutions
          .filter((resolution) => resolution.hits.length > 0 || resolution.coverHit)
          .map((resolution) => resolution.projectileId));
        activeProjectiles = steppedProjectiles.filter((shot) => !terminalIds.has(shot.id)
          && shot.remainingRange > 0
          && shot.x >= WORLD_BOUNDS.minX && shot.x <= WORLD_BOUNDS.maxX
          && shot.y >= WORLD_BOUNDS.minY && shot.y <= WORLD_BOUNDS.maxY);
      } else {
        activeProjectiles = [];
      }

      // Switching only cycles weapons the player actually owns: the pistol is
      // always owned, everything else is a pickup (Cycle 036 Priority D).
      const ownsWeapon = (id) => weaponLoadout.weapons[id]?.owned === true;
      // Cycle 048 review fix: an exhausted pickup is unselectable — the
      // auto-fallback would bounce it back to the pistol next tick, which on
      // mobile (SWAP only) made every weapon AFTER the exhausted one
      // permanently unreachable. Cycling and direct slots skip dead weapons.
      const weaponSelectable = (id) => {
        if (!ownsWeapon(id)) return false;
        const candidate = weaponLoadout.weapons[id];
        return id === 'coin-blaster' || candidate.ammoInClip > 0 || candidate.reserveAmmo === null || candidate.reserveAmmo > 0;
      };
      const rawDirectWeaponId = tickInput.weaponSlot > 0 ? WEAPON_ORDER[tickInput.weaponSlot - 1] : null;
      const directWeaponId = rawDirectWeaponId && weaponSelectable(rawDirectWeaponId) ? rawDirectWeaponId : null;
      const nextWeaponPressed = tickInput.weaponNext && !previousWeaponNext;
      let nextWeaponId = null;
      if (nextWeaponPressed) {
        const start = WEAPON_ORDER.indexOf(weaponLoadout.activeWeaponId);
        for (let offset = 1; offset <= WEAPON_ORDER.length; offset += 1) {
          const candidate = WEAPON_ORDER[(start + offset) % WEAPON_ORDER.length];
          if (weaponSelectable(candidate)) { nextWeaponId = candidate; break; }
        }
      }
      const requestedWeaponId = directWeaponId ?? nextWeaponId;
      let switchedWeapon = false;
      if (requestedWeaponId && requestedWeaponId !== weaponLoadout.activeWeaponId) {
        selectWeapon(weaponLoadout, requestedWeaponId, { tick });
        recordRunWeaponEvent(runSummaryAccumulator, { type: 'swap', weaponId: requestedWeaponId });
        switchedWeapon = true;
      }
      previousWeaponNext = tickInput.weaponNext;
      const weaponFrame = switchedWeapon
        ? { events: [], activeWeaponId: weaponLoadout.activeWeaponId }
        : stepWeaponLoadout(weaponLoadout, {
          tick,
          fire: aimIntent.fire,
          direction: aimIntent.direction,
          progressionByWeapon,
        });
      // C1: reload and the dry-fire fallback get their own cues. Both events
      // already existed and were silent, so the player learned about an empty
      // weapon only from the HUD -- which is exactly how the exhausted-shotgun
      // trap went unnoticed.
      for (const event of weaponFrame.events) {
        recordRunWeaponLifecycleEvent(runSummaryAccumulator, event);
        if (event.type === 'weapon:reload-start') {
          combatAudio.play('hmh-weapon-reload', { volume: HMH_WEAPON_SFX['hmh-weapon-reload'].gain });
        } else if (event.type === 'weapon:auto-fallback') {
          combatAudio.play('hmh-weapon-empty', { volume: HMH_WEAPON_SFX['hmh-weapon-empty'].gain });
        }
      }
      for (const event of weaponFrame.events.filter((candidate) => candidate.type === 'weapon:fire')) {
        lastWeaponFire = { tick, weaponId: event.weaponId, attackId: event.attackId };
        applyRecoilImpulse(motion, {
          direction: { x: -aimIntent.direction.x, y: -aimIntent.direction.y },
          magnitude: event.recoil,
        });
        combatAudio.play(weaponFireCueId(event.weaponId), { volume: weaponFireGain(event.weaponId) });
        // C2: firing had no camera weight at all, so a pistol and a grenade
        // launcher felt identical. Projection-only, and the existing
        // screenShake/reduceMotion settings still gate whether it is drawn.
        triggerCameraShake(tick, weaponRecoilShake(event.weaponId));
        pushCombatVisualEvent({
          type: 'muzzle',
          tick,
          point: {
            x: actor.x + aimIntent.direction.x * 28,
            y: actor.y + aimIntent.direction.y * 28,
            z: actor.groundZ + 34,
          },
          color: WEAPON_COLORS[event.weaponId] ?? 0x49ddff,
        });
        if (event.weaponId === 'launcher-rig') {
          const launch = throwGrenade(grenadeSystem, {
            tick,
            mode: 'launcher',
            origin: {
              x: actor.x + aimIntent.direction.x * 28,
              y: actor.y + aimIntent.direction.y * 28,
              z: actor.groundZ + 32,
            },
            direction: aimIntent.direction,
            damageMultiplier: collectibleSnapshot?.damageMultiplier ?? 1,
          });
          recordRunWeaponFire(runSummaryAccumulator, { weaponId: event.weaponId, emitted: launch.spawned ? 1 : 0 });
          if (!launch.spawned && launch.reason === 'capacity') recordRunGrenade(runSummaryAccumulator, { type: 'overflow' });
          continue;
        }
        recordRunWeaponFire(runSummaryAccumulator, { weaponId: event.weaponId, emitted: Math.min(event.shots.length, MAX_ACTIVE_PROJECTILES - activeProjectiles.length) });
        const trigger = { contacted: false };
        for (const shot of event.shots) {
          if (activeProjectiles.length >= MAX_ACTIVE_PROJECTILES) {
            droppedProjectiles += 1;
            continue;
          }
          // The muzzle sits at the shooter's own chest height; the projectile
          // settles toward the ground beneath it from there.
          const muzzle = {
            x: actor.x + shot.direction.x * 28,
            y: actor.y + shot.direction.y * 28,
            z: actor.groundZ + PROJECTILE_FLIGHT_HEIGHT,
          };
          activeProjectiles.push({
            id: shot.id,
            attackId: event.attackId,
            trigger,
            weaponId: event.weaponId,
            previousX: actor.x,
            previousY: actor.y,
            previousZ: actor.groundZ + PROJECTILE_FLIGHT_HEIGHT,
            x: muzzle.x,
            y: muzzle.y,
            z: muzzle.z,
            groundZ: actor.groundZ,
            flightCeilingZ: muzzle.z,
            vx: shot.direction.x * shot.speed,
            vy: shot.direction.y * shot.speed,
            radius: shot.radius,
            damage: shot.damage * (collectibleSnapshot?.damageMultiplier ?? 1),
            policy: shot.policy,
            projectileTag: shot.projectileTag ?? null,
            shock: shot.shock,
            knockbackMultiplier: shot.knockbackMultiplier,
            remainingRange: shot.range,
          });
        }
      }

      const meleeFrame = stepMeleeState(meleeState, {
        tick,
        trigger: tickInput.melee,
        origin: { x: actor.x, y: actor.y },
        direction: aimIntent.direction,
        sourceGroundZ: actor.groundZ,
        targets: meleeTargets,
        blockers: WORLD_BLOCKERS,
        downwardDropDirection: lastGround.oneWayDrop,
      });
      combatHitIntents.push(...meleeFrame.hits.map((hit) => ({ ...hit, damage: hit.damage * (collectibleSnapshot?.damageMultiplier ?? 1) })));
      if (meleeFrame.attacked) {
        recordRunWeaponFire(runSummaryAccumulator, { weaponId: 'litecoin-knife', emitted: 1 });
        if (meleeFrame.hits.length > 0) {
          recordRunWeaponTriggerContact(runSummaryAccumulator, { weaponId: 'litecoin-knife' });
          recordRunProjectileContacts(runSummaryAccumulator, { weaponId: 'litecoin-knife', count: meleeFrame.hits.length });
        }
        lastMeleeAttack = { tick, hits: meleeFrame.hits.length };
        combatAudio.play('melee', { volume: 0.12 });
        pushCombatVisualEvent({
          type: 'melee',
          tick,
          point: { x: actor.x, y: actor.y, z: actor.groundZ + 24 },
          direction: { ...aimIntent.direction },
        });
      }

      if (tickInput.grenade && !previousGrenade) {
        const grenadeSpawn = throwGrenade(grenadeSystem, {
          tick,
          mode: 'hand',
          origin: {
            x: actor.x + aimIntent.direction.x * 20,
            y: actor.y + aimIntent.direction.y * 20,
            z: actor.groundZ + 24,
          },
          direction: aimIntent.direction,
          damageMultiplier: collectibleSnapshot?.damageMultiplier ?? 1,
        });
        if (grenadeSpawn.spawned) {
          recordRunGrenade(runSummaryAccumulator, { type: 'thrown' });
          lastGrenadeThrow = { tick, grenadeId: grenadeSpawn.grenade?.id ?? null };
          combatAudio.play('grenade', { volume: 0.12 });
          applyRecoilImpulse(motion, {
            direction: { x: -aimIntent.direction.x, y: -aimIntent.direction.y },
            magnitude: 70,
          });
        } else if (grenadeSpawn.reason === 'capacity') recordRunGrenade(runSummaryAccumulator, { type: 'overflow' });
      }
      previousGrenade = tickInput.grenade;
      const playerInvulnerable = evidenceSafeEnabled || isDashInvulnerable(dashState, tick);
      const playerHurtTarget = playerHealth > 0 && !playerInvulnerable ? createHurtTarget({
        id: 'player',
        bodyShape: { type: 'circle', radius: playerBody.radius },
        hurtShape: { type: 'circle', radius: Math.max(8, playerBody.radius * 0.72) },
        previousGround: { x: previousActor.x, y: previousActor.y, z: previousActor.groundZ },
        currentGround: { x: actor.x, y: actor.y, z: actor.groundZ },
        minZ: playerBody.minZ,
        maxZ: playerBody.maxZ,
        health: playerHealth,
      }) : null;
      const grenadeFrame = stepGrenadeSystem(grenadeSystem, {
        tick,
        dtSeconds,
        queryGround,
        blockers: WORLD_BLOCKERS,
        targets: playerHurtTarget ? [...hurtTargets, playerHurtTarget] : hurtTargets,
      });
      for (const detonation of grenadeFrame.detonations) {
        recordRunGrenadeDetonation(runSummaryAccumulator, detonation);
        lastGrenadeDetonation = { tick, reason: detonation.reason, grenadeId: detonation.grenadeId };
        combatAudio.play('grenade-boom', { volume: 0.16 });
        pushCombatVisualEvent({ type: 'blast', tick, point: detonation.point, radius: detonation.radius });
        triggerCameraShake(tick, 10);
        for (const hit of detonation.hits) combatHitIntents.push({ ...hit, tick });
      }

      if ((!rosterPreviewEnabled || rosterCombatEnabled) && openingEnemyAttacksEnabled(tick)) {
        lastEnemyAttack = stepEnemyAttacks({
          enemies: grayboxEnemies,
          player: { id: 'player', x: actor.x, y: actor.y, groundZ: actor.groundZ, radius: playerBody.radius },
          tick,
          budgets: getEncounterSnapshot(tick).attackTokens,
        });
      } else {
        lastEnemyAttack = Object.freeze({ tick, tokens: Object.freeze([]), events: Object.freeze([]), droppedEvents: 0 });
      }
      for (const event of lastEnemyAttack.events) {
        pushCombatVisualEvent({ type: 'enemy-attack', tick, point: event.target, color: ENEMY_ARCHETYPES[event.archetypeId].visual.color });
        const resolved = resolveEnemyAttackAgainstPlayer(event, {
          player: { id: 'player', x: actor.x, y: actor.y, groundZ: actor.groundZ, radius: playerBody.radius },
          invulnerable: playerInvulnerable,
          blockers: WORLD_BLOCKERS,
        });
        if (!resolved.hit) continue;
        const directionMagnitude = Math.hypot(actor.x - event.origin.x, actor.y - event.origin.y) || 1;
        combatHitIntents.push({
          id: event.attackId,
          tick,
          time: 1,
          targetId: 'player',
          sourceId: event.enemyId,
          weaponId: `enemy-${event.archetypeId}`,
          damage: resolved.damage,
          criticalChance: 0,
          criticalMultiplier: 1,
          armorPiercing: false,
          direction: { x: (actor.x - event.origin.x) / directionMagnitude, y: (actor.y - event.origin.y) / directionMagnitude },
          knockback: event.role === 'bruiser' ? 32 : 12,
          point: { x: actor.x, y: actor.y, z: actor.groundZ + 24 },
        });
      }
      for (const event of lastBossStep?.events ?? []) {
        if (event.type === 'arena-change') combatAudio.play('boss-phase', { volume: 0.14 });
        if (event.type !== 'attack' && event.type !== 'add-wave') continue;
        const resolved = resolveLiquidatorAttack({
          event,
          player: { x: actor.x, y: actor.y, groundZ: actor.groundZ },
        });
        if (!resolved.hit) continue;
        const directionMagnitude = Math.hypot(actor.x - event.origin.x, actor.y - event.origin.y) || 1;
        combatHitIntents.push({
          id: event.telegraphId,
          tick,
          time: 1,
          targetId: 'player',
          sourceId: liquidatorBoss.id,
          weaponId: `boss-${event.attackId}`,
          damage: resolved.damage,
          criticalChance: 0,
          criticalMultiplier: 1,
          armorPiercing: false,
          direction: { x: (actor.x - event.origin.x) / directionMagnitude, y: (actor.y - event.origin.y) / directionMagnitude },
          knockback: event.attackId.includes('super') ? 36 : 20,
          point: { x: actor.x, y: actor.y, z: actor.groundZ + 24 },
        });
      }

      if (terminalPilotEnabled && tick === 2) {
        combatHitIntents.push({
          id: 'evidence-terminal-hit',
          tick,
          time: 1,
          targetId: 'player',
          sourceId: 'evidence-terminal-pilot',
          weaponId: 'enemy-bagholder-rusher',
          damage: maxPlayerHealth + 1,
          criticalChance: 0,
          criticalMultiplier: 1,
          armorPiercing: true,
          direction: { x: 1, y: 0 },
          knockback: 0,
          point: { x: actor.x, y: actor.y, z: actor.groundZ + 24 },
        });
      }

      discoverMinimapPointsOfInterest({
        discovery: minimapDiscovery,
        player: actor,
        pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest,
      });
      recordRunTick(runSummaryAccumulator, {
        tick,
        position: actor,
        activeWeaponId: weaponLoadout.activeWeaponId,
        districtId: getLevelOneDistrictAt(actor.x, actor.y)?.id ?? 'frontier-relay',
        discoveredPoiIds: minimapDiscovery.discoveredPoiIds,
        activeEffectIds: collectibleSnapshot.activeEffects.map((effect) => effect.effectId),
      });

      const authoritativeCombatHitIntents = filterDashInvulnerableHits(dashState, tick, combatHitIntents)
        .map((hit) => hit.sourceId === 'player' && hit.targetId !== 'player'
          ? { ...hit, damage: hit.damage * runEffects.outgoingDamageMultiplier }
          : hit);
      if (authoritativeCombatHitIntents.length > 0) {
        const combatTargets = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0).map((enemy) => ({
          id: enemy.id,
          health: enemy.health,
          maxHealth: enemy.maxHealth,
          armor: enemy.armor,
          shieldCharges: enemy.shieldCharges,
          knockbackResistance: enemy.knockbackResistance,
        }));
        if (liquidatorBoss.active && tick >= liquidatorBoss.startTick) combatTargets.push({
          id: liquidatorBoss.id,
          health: liquidatorBoss.health,
          maxHealth: liquidatorBoss.maxHealth,
          armor: 1,
          shieldCharges: 0,
          knockbackResistance: 0.92,
        });
        if (playerHealth > 0) combatTargets.push({
          id: 'player',
          health: playerHealth,
          maxHealth: maxPlayerHealth,
          armor: 1,
          shieldCharges: 0,
          knockbackResistance: 1,
        });
        lastCombatResolution = resolveCombatHits({
          sessionSeed: payload.session.seed,
          hits: authoritativeCombatHitIntents,
          targets: combatTargets,
        });
        for (const enemy of grayboxEnemies) {
          const state = lastCombatResolution.targets[enemy.id];
          if (!state) continue;
          enemy.health = state.health;
          enemy.shieldCharges = state.shieldCharges;
          if (!state.active || state.health <= 0) {
            enemy.active = false;
            enemy.targetable = false;
          }
        }
        if (lastCombatResolution.targets.player) playerHealth = lastCombatResolution.targets.player.health;
        for (const damageEvent of lastCombatResolution.damageEvents) {
          if (damageEvent.damageApplied <= 0) continue;
          recordRunDamage(runSummaryAccumulator, damageEvent);
          if (damageEvent.targetId === 'player' && damageEvent.weaponId === 'satoshi-frag') {
            recordRunGrenade(runSummaryAccumulator, { type: 'self-damage', amount: damageEvent.damageApplied });
          }
          combatAudio.play(damageEvent.targetId === 'player' ? 'player-hit' : 'enemy-hit', {
            volume: damageEvent.critical ? 0.14 : 0.09,
          });
          pushCombatVisualEvent({
            type: 'impact',
            tick,
            point: damageEvent.point,
            critical: damageEvent.critical,
            // Knockback already points along the impact's travel, so it is the
            // surface normal the spark fan sprays back from. It is zero for a
            // shielded or zero-damage hit, which the spray helper treats as
            // "no direction" and falls back to a full circle.
            direction: damageEvent.knockback,
            color: damageEvent.shielded ? 0x8bb8ff : damageEvent.critical ? 0xfff06a : 0xff8c5a,
          });
          if (damageEvent.targetId === 'player') {
            lastPlayerHit = { tick, sourceId: damageEvent.sourceId };
            updateRunCombo(0);
            triggerCameraShake(tick, 5);
            const magnitude = Math.hypot(damageEvent.knockback.x, damageEvent.knockback.y);
            if (magnitude > 0) applyRecoilImpulse(motion, {
              direction: { x: damageEvent.knockback.x / magnitude, y: damageEvent.knockback.y / magnitude },
              magnitude,
            });
            continue;
          }
          if (damageEvent.targetId === liquidatorBoss.id) {
            const bossDamage = applyLiquidatorDamage({ boss: liquidatorBoss, amount: damageEvent.damageApplied, tick });
            if (bossDamage.runEvent) {
              bossDeathVisualUntilTick = tick + 45;
              triggerCameraShake(tick, 12);
            }
            else bossHitVisualUntilTick = tick + 6;
            if (bossDamage.runEvent && bridge?.initialized) {
              bridge.send('game:run-event', {
                tick,
                sequence: runEventSequence,
                eventType: 'boss-defeated',
                value: 1,
              });
              runEventSequence += 1;
            }
            continue;
          }
          const enemy = grayboxEnemies.find((candidate) => candidate.id === damageEvent.targetId);
          if (!enemy) continue;
          enemy.hitUntilTick = tick + 6;
          const knockbackCollision = resolveSweptCircleMotion({
            body: enemy.collisionBody,
            start: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
            delta: damageEvent.knockback,
            blockers: WORLD_BLOCKERS,
            bounds: WORLD_BOUNDS,
          });
          const knockbackTraversal = resolveSweptTraversalPath({
            start: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
            end: knockbackCollision.position,
            queryGround,
            maxSampleDistance: Math.max(4, enemy.radius * 0.5),
          });
          enemy.x = knockbackTraversal.position.x;
          enemy.y = knockbackTraversal.position.y;
          enemy.groundZ = knockbackTraversal.ground.groundZ;
          if (damageEvent.weaponId !== 'litecoin-knife' && damageEvent.weaponId !== 'satoshi-frag') {
            lastProjectileHit = { tick, targetId: damageEvent.targetId, point: damageEvent.point };
          }
        }
        let retiredEnemies = false;
        for (const scoreEvent of lastCombatResolution.scoreEvents) {
          if (scoreEvent.enemyId === liquidatorBoss.id) {
            recordRunKill(runSummaryAccumulator, {
              enemyRoleId: 'liquidator',
              weaponId: scoreEvent.weaponId,
              boss: true,
            });
            runKills += 1;
            const bossSnapshot = awardComboXp(recordRunDefeat(runProgression, {
              enemyId: scoreEvent.enemyId,
              threatCost: LIQUIDATOR_THREAT_COST,
              tick,
            }), tick, { bossDefeated: true });
            cockpit?.updateRun(bossSnapshot);
            if (bossSnapshot.pendingLevels > 0) upgradePending = true;
            continue;
          }
          const defeatedEnemy = grayboxEnemies.find((enemy) => enemy.id === scoreEvent.enemyId);
          if (!defeatedEnemy) continue;
          recordRunKill(runSummaryAccumulator, {
            enemyRoleId: defeatedEnemy.archetypeId,
            weaponId: scoreEvent.weaponId,
            elite: isEliteEnemyProjection(defeatedEnemy.id),
          });
          queueEnemyDeathVisual(defeatedEnemy, tick);
          runKills += 1;
          const progressionSnapshot = awardComboXp(recordRunDefeat(runProgression, {
            enemyId: defeatedEnemy.id,
            threatCost: ENEMY_ARCHETYPES[defeatedEnemy.archetypeId].costs.threat,
            tick,
          }), tick);
          cockpit?.updateRun(progressionSnapshot);
          if (progressionSnapshot.pendingLevels > 0) upgradePending = true;
          if (bridge?.initialized) {
            bridge.send('game:run-event', {
              tick,
              sequence: runEventSequence,
              eventType: 'enemy-defeated',
              value: 1,
            });
            runEventSequence += 1;
          }
          retiredEnemies = retireEnemyFromPopulation(enemyPopulation, scoreEvent.enemyId, { tick, reason: 'defeated' }).retired || retiredEnemies;
        }
        if (retiredEnemies) resetEnemyMarkers(grayboxEnemies);
        const defeatTransition = playerDefeatController.resolve({
          health: playerHealth,
          kills: runKills,
          elapsedMs: simulation.timeMs,
        });
        if (defeatTransition) {
          simulation.gameOver();
          app.ticker.stop();
          combatAudio.pause();
          setStatus('Run ended', 'Defeated // restart from the portal or reload standalone mode');
          if (bridge?.initialized) {
            const runSnapshot = getRunProgressionSnapshot(runProgression);
            const runSummary = finalizeRunSummary(runSummaryAccumulator, {
              endTick: simulation.tick,
              elapsedMs: simulation.timeMs,
              terminalReason: 'defeated',
              score: runSnapshot.score,
              level: runSnapshot.level,
              xp: runSnapshot.xp,
              currentCombo: runCombo,
              maxCombo: maxRunCombo,
              revealedCells: revealSnapshot.revealedCellIds.length,
              totalCells: revealSnapshot.totalCells,
            });
            const resultMessages = buildRunResultMessages({
              seed: sessionPayload.session.seed,
              score: runSnapshot.score,
              kills: runKills,
              elapsedMs: simulation.timeMs,
              runSummary,
            });
            bridge.send('game:state', statePayload('game-over'));
            bridge.send('game:run-summary', resultMessages.runSummary);
            bridge.send('game:score-result', resultMessages.scoreResult);
            bridge.send('game:game-over', resultMessages.gameOver);
          }
        }
      } else {
        lastCombatResolution = null;
      }
      actor.combat = weaponFrame.events.some((event) => event.type === 'weapon:fire')
        ? 'firing'
        : meleeFrame.attacked ? 'melee' : 'ready';
      const dashStatusAfterStep = getDashStatus(dashState, tick);
      if (dashStatusAfterStep.ready && !lastDashReady && dashState.startedTick >= 0) {
        pushCombatVisualEvent({
          type: 'dash-ready',
          tick,
          point: { x: actor.x, y: actor.y, z: actor.groundZ + 24 },
        });
      }
      lastDashReady = dashStatusAfterStep.ready;
    });
    simulation.start();
    if (releaseAnchorEnabled) {
      const progressionSnapshot = getRunProgressionSnapshot(runProgression);
      upgradePending = false;
      simulation.enterUpgrade();
      recordRunUpgradeOffer(runSummaryAccumulator, progressionSnapshot.pendingChoices.map((choice) => choice.id));
      combatAudio.pause();
      cockpit?.showUpgrade(progressionSnapshot);
      app.ticker.stop();
      renderActor = actor;
      renderWorld(actor);
    } else {
      app.ticker.start();
      renderWorld();
    }
  };

  const runtimeStatus = () => simulation?.state === 'active'
    ? 'running'
    : simulation?.state === 'game-over' ? 'game-over' : 'paused';
  const statePayload = (status = runtimeStatus()) => {
    const runSnapshot = runProgression ? getRunProgressionSnapshot(runProgression) : null;
    return {
      status,
      score: runSnapshot?.score ?? 0,
      kills: runKills,
      elapsedMs,
      health: playerHealth,
      maxHealth: maxPlayerHealth,
      xp: runSnapshot?.xp ?? 0,
      level: runSnapshot?.level ?? 1,
      paused: status === 'paused',
    };
  };

  const pauseRuntime = (source) => {
    if (!simulation || simulation.state !== 'active') return;
    world.position.set(0, 0);
    simulation.pause();
    app.ticker.stop();
    combatAudio.pause();
    cockpit?.setPaused(true);
    setStatus(bridge?.initialized ? 'Portal session paused' : 'Standalone session paused', `Paused by ${source}.`);
    if (bridge?.initialized) {
      bridge.send('game:pause', { paused: true, source });
      bridge.send('game:state', statePayload('paused'));
    }
  };

  const resumeRuntime = (source = 'portal') => {
    if (simulation?.state !== 'paused') return;
    simulation.resume();
    app.ticker.start();
    combatAudio.resume();
    cockpit?.setPaused(false);
    setStatus(bridge?.initialized ? 'Portal session connected' : 'Standalone session ready', `Resumed by ${source}.`);
    if (bridge?.initialized) {
      bridge.send('game:pause', { paused: false, source });
      bridge.send('game:state', statePayload('running'));
    }
  };

  const applySelectedUpgrade = (upgradeId) => {
    if (simulation?.state !== 'upgrade' || !runProgression) return;
    const before = getRunProgressionSnapshot(runProgression);
    const selection = selectRunUpgrade(runProgression, upgradeId);
    recordRunUpgradeSelection(runSummaryAccumulator, upgradeId);
    const healthGain = selection.effects.maxHealthBonus - before.effects.maxHealthBonus;
    const grenadeGain = selection.effects.bonusGrenadeCharges - before.effects.bonusGrenadeCharges;
    if (healthGain > 0) {
      maxPlayerHealth += healthGain;
      playerHealth = Math.min(maxPlayerHealth, playerHealth + healthGain);
      playerDefeatController = createPlayerDefeatController({ maxHealth: maxPlayerHealth });
    }
    if (dashState) dashState.cooldownTier = selection.effects.dashCooldownTier;
    if (grenadeSystem && grenadeGain > 0) grenadeSystem.handCharges += grenadeGain;
    cockpit?.updateRun(selection.snapshot);
    if (selection.snapshot.pendingLevels > 0 && selection.snapshot.pendingChoices.length > 0) {
      recordRunUpgradeOffer(runSummaryAccumulator, selection.snapshot.pendingChoices.map((choice) => choice.id));
      cockpit?.showUpgrade(selection.snapshot);
      return;
    }
    cockpit?.hideUpgrade();
    simulation.leaveUpgrade();
    combatAudio.resume();
    app.ticker.start();
    if (bridge?.initialized) bridge.send('game:state', statePayload('running'));
  };

  cockpit = createCockpitUi({
    documentRef: document,
    onMenuToggle: () => {
      if (simulation?.state === 'paused') resumeRuntime('user');
      else pauseRuntime('user');
    },
    onMusicToggle: (enabled) => applyPauseSetting('musicEnabled', enabled),
    onSettingToggle: (key, enabled) => applyPauseSetting(key, enabled),
    onResume: () => resumeRuntime('user'),
    onRestart: () => {
      if (!sessionPayload) return;
      initializeSession(sessionPayload);
      marker.scale.set(1);
      if (bridge?.initialized) bridge.send('game:state', statePayload('running'));
    },
    onExit: () => {
      if (bridge?.initialized) bridge.send('game:exit', { reason: 'menu' });
    },
    onSelectUpgrade: applySelectedUpgrade,
  });

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') pauseRuntime('visibility');
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const handleResize = () => renderWorld();
  app.canvas.addEventListener('pointerdown', () => app.canvas.focus());
  // Boot focus: a player must be able to move the moment the run starts,
  // without clicking the game first (device playtest, 2026-07-31).
  window.focus?.();
  app.canvas.focus({ preventScroll: true });
  app.renderer.on('resize', handleResize);
  app.ticker.add((ticker) => {
    if (!simulation || simulation.state !== 'active' || !actor || !camera) return;
    const nowMs = performance.now();
    const gamepad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (gamepad) {
      const mapped = mapGamepadSnapshot(gamepad);
      const active = mapped.move.x !== 0 || mapped.move.y !== 0 || mapped.aim.x !== 0 || mapped.aim.y !== 0
        || Object.values(mapped.actions).some(Boolean);
      if (active || gamepadWasActive) {
        input.setGamepad({
          moveX: mapped.move.x,
          moveY: mapped.move.y,
          aimX: mapped.aim.x,
          aimY: mapped.aim.y,
          ...mapped.actions,
        }, nowMs);
      }
      gamepadWasActive = active;
    } else if (gamepadWasActive) {
      input.setGamepad({}, nowMs);
      gamepadWasActive = false;
    }
    const snapshot = input.snapshot({ actor, camera, viewport: viewport(), nowMs });
    if (debugGridEnabled) dataset.snapshotWeaponSlot = String(snapshot.actions.weaponSlot);
    const frame = simulation.update(ticker.deltaMS, snapshot.actions);
    if (frame.steps > 0) input.consumeBufferedActions(snapshot.sequence);
    if (upgradePending && simulation.state === 'active' && (!progressionPilotEnabled || simulation.tick >= 2)) {
      const progressionSnapshot = getRunProgressionSnapshot(runProgression);
      upgradePending = false;
      if (progressionSnapshot.pendingLevels > 0 && progressionSnapshot.pendingChoices.length > 0) {
        recordRunUpgradeOffer(runSummaryAccumulator, progressionSnapshot.pendingChoices.map((choice) => choice.id));
        simulation.enterUpgrade();
        combatAudio.pause();
        cockpit?.showUpgrade(progressionSnapshot);
      }
    }
    elapsedMs = simulation.timeMs;
    renderActor = interpolateSpatialState(previousActor ?? actor, actor, frame.alpha);
    followCameraTarget(camera, {
      ...renderActor,
      aimX: aimIntent?.direction.x ?? snapshot.actions.aim.x,
      aimY: aimIntent?.direction.y ?? snapshot.actions.aim.y,
    }, viewport(), { dtSeconds: Math.max(1 / 240, Math.min(ticker.deltaMS / 1000, 1 / 15)) });
    // Shake offsets the render container only. It deliberately does NOT touch
    // camera.shakeX/Y: those are read back by screenToGround, so shaking the
    // camera would feed a jittered pointer position into aim resolution and
    // let a cosmetic accessibility setting change which shots hit. Offsetting
    // the container keeps the shake strictly in projection.
    const shakeAge = simulation.tick - shakeStartTick;
    if (settings.screenShake && !settings.reduceMotion && shakeMagnitude > 0 && shakeAge >= 0 && shakeAge < SHAKE_DECAY_TICKS) {
      const decay = 1 - shakeAge / SHAKE_DECAY_TICKS;
      const swing = shakeMagnitude * decay;
      world.position.set(
        (deterministicUnit(`shake-x:${simulation.tick}:${shakeStartTick}`) - 0.5) * 2 * swing,
        (deterministicUnit(`shake-y:${simulation.tick}:${shakeStartTick}`) - 0.5) * 2 * swing,
      );
    } else if (world.position.x !== 0 || world.position.y !== 0) {
      world.position.set(0, 0);
    }
    // Telemetry for the shake. Without it the effect is unobservable from
    // outside: the visual gate captures a paused frame and may never land on
    // an active shake, so per-weapon recoil could regress to zero silently.
    dataset.cameraShake = String(Number(Math.hypot(world.position.x, world.position.y).toFixed(3)));
    renderWorld(renderActor);
    const locomotionPulse = actor.locomotion === 'dash'
      ? 0.18
      : motion?.locomotion === 'run' ? Math.sin(elapsedMs * 0.012) * 0.07 : 0;
    const combatStretch = actor.combat === 'melee' ? 0.18 : actor.combat === 'firing' ? 0.1 : 0;
    if (!settings.reduceMotion) marker.scale.set(1 + locomotionPulse + combatStretch, 1 - combatStretch * 0.45);
    else marker.scale.set(1);
    marker.tint = actor.locomotion === 'dash'
      ? 0x8ff3ff
      : actor.combat === 'melee' ? 0xd7fbff : actor.combat === 'firing' ? 0xffd166 : 0xffffff;
  });

  const handleExitKey = (event) => {
    if (event.key !== 'Escape' || event.repeat) return;
    event.preventDefault();
    if (event.shiftKey && bridge?.initialized) bridge.send('game:exit', { reason: 'menu' });
    else if (simulation?.state === 'paused') resumeRuntime('user');
    else pauseRuntime('user');
  };
  window.addEventListener('keydown', handleExitKey);

  if (window.parent !== window) {
    bridge = createHmhChildBridge({
      windowRef: window,
      expectedParentOrigin: window.location.origin,
      runtimeInfo: { runtimeVersion: RUNTIME_VERSION, renderer: 'pixi.js', capabilities: ['pause', 'settings', 'restart', 'resize', 'exit', 'run-events', 'score-result', 'achievements'] },
      onInit: (payload) => {
        initializeSession(payload);
        setStatus('Portal session connected', `${payload.mode.toUpperCase()} // ${payload.heroId} // seed ${payload.session.seed}`);
        queueMicrotask(() => bridge?.send('game:state', statePayload('running')));
      },
      onMessage: (message) => {
        if (message.type === 'portal:pause') {
          pauseRuntime('portal');
        } else if (message.type === 'portal:resume') {
          resumeRuntime('portal');
        } else if (message.type === 'portal:settings') {
          syncRuntimeSettings(message.payload.settings, { notify: true });
        } else if (message.type === 'portal:restart') {
          initializeSession(sessionPayload);
          marker.scale.set(1);
          bridge.send('game:state', statePayload('running'));
        } else if (message.type === 'portal:dispose') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('keydown', handleExitKey);
          window.removeEventListener('pointerdown', unlockCombatAudio, true);
          window.removeEventListener('keydown', unlockCombatAudio, true);
          app.renderer.off('resize', handleResize);
          app.ticker.stop();
          combatAudio.destroy();
          cockpit?.destroy();
          stopCurrentSession();
          app.destroy(true);
        }
      },
      onProtocolError: (error) => {
        app.ticker.stop();
        combatAudio.pause();
        setStatus('Bridge protocol error', error.message);
      },
    });
    bridge.start();
    setStatus('Renderer ready', 'Waiting for portal session…');
  } else {
    const payload = window.parent === window
      ? createStandaloneInitPayload({ heroId: productionHeroSelection.actorId })
      : null;
    initializeSession(payload);
    setStatus('Standalone session ready', `${payload.mode.toUpperCase()} // seed ${payload.session.seed} // no portal authority`);
  }
}

boot().catch((error) => {
  setStatus('Renderer initialization failed', error instanceof Error ? error.message : 'Unknown startup error');
});
