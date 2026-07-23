import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { createAimState, resolveAimIntent } from './aim.mjs';
import { createHmhChildBridge } from './bridge.mjs';
import { createCombatAudio } from './combat-audio.mjs';
import { createPlayerDefeatController } from './combat-lifecycle.mjs';
import { resolveCombatHits } from './combat-events.mjs';
import { resolveEnemyAttackAgainstPlayer, stepEnemyAttacks } from './enemy-combat.mjs';
import { ENEMY_ARCHETYPES, ENEMY_ARCHETYPE_IDS } from './enemy-archetypes.mjs';
import {
  createLiquidatorProductionDisplay,
  createProductionEnemyDisplay,
  isEliteEnemyProjection,
  resolveEnemyRuntimeVisualState,
} from './enemy-production-art.mjs';
import { createEnemyPopulation, createEnemyState, retireEnemyFromPopulation, stepEnemyPopulation } from './enemy-simulation.mjs';
import { createEncounterDirector, getEncounterSnapshot, stepEncounterDirector } from './encounter-director.mjs';
import {
  applyLiquidatorDamage,
  createLiquidatorBoss,
  resolveLiquidatorAttack,
  stepLiquidatorBoss,
} from './liquidator-boss.mjs';
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
} from './elevation.mjs';
import { InputState, createBrowserInputController, mapGamepadSnapshot } from './input.mjs';
import { createGrenadeSystem, stepGrenadeSystem, throwGrenade } from './grenades.mjs';
import { createMeleeState, createMeleeTarget, stepMeleeState } from './melee.mjs';
import {
  applyRecoilImpulse,
  createPlayerMotionState,
  resolveEnemyPressure,
  stepPlayerMovement,
} from './movement.mjs';
import {
  UniformHurtboxGrid,
  createHurtTarget,
  createProjectileState,
  resolveProjectileBatch,
} from './projectile-physics.mjs';
import { DeterministicSimulation } from './simulation.mjs';
import { createStandaloneInitPayload } from './standalone-session.mjs';
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
  LEVEL_ONE_WORLD,
  buildLevelOneMinimapGeometry,
  createLevelOneGroundQuery,
  createLevelOneRevealState,
  getLevelOneDistrictAt,
  getLevelOneRevealSnapshot,
  revealLevelOneAt,
} from './level-one-world.mjs';
import {
  HMH_WEAPON_DEFINITIONS,
  createWeaponLoadout,
  getActiveWeaponState,
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
const MAX_ACTIVE_GRENADES = 16;
const MAX_COMBAT_VISUAL_EVENTS = 64;
const PROJECTILE_GRID_THRESHOLD = 64;
const HIT_FEEDBACK_TICKS = 12;
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
const WORLD_SURFACES = LEVEL_ONE_WORLD.surfaces;
const WORLD_BLOCKERS = LEVEL_ONE_WORLD.collisionBlockers;
const queryGround = createLevelOneGroundQuery();
const MINIMAP_GEOMETRY = buildLevelOneMinimapGeometry();
const ROUTE_NODE_BY_ID = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
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
  const app = new Application();
  await app.init({
    resizeTo: stageElement,
    background: '#071522',
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
    powerPreference: 'high-performance',
  });
  app.ticker.stop();
  app.canvas.tabIndex = 0;
  app.canvas.setAttribute('aria-label', 'Hard Money Heroes gameplay canvas');
  stageElement.replaceChildren(app.canvas);

  const runtimeParams = new URLSearchParams(window.location.search);
  const pipelinePilotEnabled = runtimeParams.get('pipelinePilot') === '1';
  const productionPilotEnabled = runtimeParams.get('productionPilot') === '1';
  const requestedProductionHeroId = runtimeParams.get('productionHero');
  const productionHeroId = Object.hasOwn(PRODUCTION_HERO_ASSETS, requestedProductionHeroId)
    ? requestedProductionHeroId
    : 'lit-commando';
  const productionHeroSelection = productionHeroAsset(productionHeroId);

  const world = new Container();
  const backdrop = new Graphics();
  const terrainGeometry = new Graphics();
  const grid = new Graphics();
  const collisionGeometry = new Graphics();
  const collisionDebug = new Graphics();
  const debugLabels = new Container();
  const shadow = new Graphics().ellipse(0, 0, 30, 12).fill({ color: 0x000000, alpha: 0.4 });
  const aimLine = new Graphics();
  const projectileTrails = new Graphics();
  const projectileImpacts = new Graphics();
  const grenadeVisuals = new Graphics();
  const combatVisuals = new Graphics();
  const minimap = new Graphics();
  const enemyVisuals = new Container();
  const enemyDeathVisuals = new Container();
  const enemyTelegraphs = new Graphics();
  const enemyMarkers = new Map();
  const enemyDeathMarkers = new Map();
  const bossTelegraphs = new Graphics();
  const bossVisual = createLiquidatorProductionDisplay({ ContainerClass: Container, GraphicsClass: Graphics });
  bossVisual.visible = false;
  const marker = drawPrototypeHumanoid(new Graphics(), createPrototypeHumanoidDescriptor({
    radius: 24,
    bodyColor: 0x49ddff,
    outlineColor: 0xffffff,
    weapon: true,
  }));
  let productionHeroDisplay = null;
  if (productionPilotEnabled) {
    const [metadataResponse, atlasTexture] = await Promise.all([
      fetch(productionHeroSelection.metadataUrl, { credentials: 'same-origin' }),
      Assets.load(productionHeroSelection.imageUrl),
    ]);
    if (!metadataResponse.ok) throw new Error(`Production hero metadata failed with ${metadataResponse.status}`);
    const metadata = await metadataResponse.json();
    productionHeroDisplay = createProductionHeroDisplay({
      index: createProductionHeroAtlasIndex(metadata, productionHeroSelection),
      atlasTexture,
      ContainerClass: Container,
      SpriteClass: Sprite,
      TextureClass: Texture,
      RectangleClass: Rectangle,
    });
  }
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
  const actorVisual = productionHeroDisplay?.container ?? mannequinDisplay?.container ?? marker;
  const atlasActorEnabled = Boolean(productionHeroDisplay || mannequinDisplay);
  shadow.visible = !atlasActorEnabled;
  const label = new Text({ text: 'DETERMINISTIC RUNTIME', style: { fill: 0xe9fbff, fontFamily: 'system-ui', fontSize: 18, fontWeight: '700' } });
  label.anchor.set(0.5);
  world.addChild(backdrop, terrainGeometry, grid, collisionGeometry, debugLabels, shadow, enemyTelegraphs, bossTelegraphs, enemyVisuals, enemyDeathVisuals, bossVisual, aimLine, projectileTrails, grenadeVisuals, combatVisuals, projectileImpacts, actorVisual, collisionDebug, label);
  app.stage.addChild(world, minimap);

  const createEnemyMarker = (enemy) => {
    const eliteProjection = isEliteEnemyProjection(enemy.id);
    return createProductionEnemyDisplay({
      archetypeId: enemy.archetypeId,
      elite: eliteProjection,
      ContainerClass: Container,
      GraphicsClass: Graphics,
    });
  };

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
    const graphic = createProductionEnemyDisplay({
      archetypeId: enemy.archetypeId,
      elite: eliteProjection,
      ContainerClass: Container,
      GraphicsClass: Graphics,
    });
    enemyDeathMarkers.set(enemy.id, {
      graphic,
      x: enemy.x,
      y: enemy.y,
      groundZ: enemy.groundZ ?? 0,
      startTick: tick,
      endTick: tick + 30,
      elite: eliteProjection,
    });
    enemyDeathVisuals.addChild(graphic);
  };

  const debugGridEnabled = runtimeParams.get('debugGrid') === '1';
  const directorDebugEnabled = runtimeParams.get('director') === '1';
  const bossDebugEnabled = runtimeParams.get('boss') === '1';
  const evidenceSafeEnabled = runtimeParams.get('evidenceSafe') === '1';
  const worldTourId = runtimeParams.get('worldTour');
  const worldTourSpawns = Object.freeze({
    ravine: Object.freeze({ x: 3_050, y: 1_500 }),
    bridge: Object.freeze({ x: 4_700, y: 2_400 }),
    mining: Object.freeze({ x: 9_200, y: 1_600 }),
    yard: Object.freeze({ x: 11_000, y: 2_400 }),
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
  let sessionPayload = null;
  let simulation = null;
  let actor = null;
  let motion = null;
  let aimState = null;
  let aimIntent = null;
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
  let lastMeleeAttack = null;
  let lastGrenadeDetonation = null;
  let playerDefeatController = null;
  let playerHealth = 100;
  let runKills = 0;
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

  const renderAuthoredTerrain = (view) => {
    terrainGeometry.clear();
    const colors = { water: 0x176b8a, 'shallow-water': 0x248aa5, bridge: 0x9a774d, ramp: 0x536f56, ledge: 0x415744 };
    for (const district of LEVEL_ONE_WORLD.districts) {
      const topLeft = worldToScreen({ x: district.area.minX, y: district.area.minY, z: 0 }, camera, view);
      const bottomRight = worldToScreen({ x: district.area.maxX, y: district.area.maxY, z: 0 }, camera, view);
      terrainGeometry.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
        .fill({ color: district.color, alpha: 0.32 });
    }
    for (const route of LEVEL_ONE_WORLD.routes) {
      const routePoints = route.nodeIds.map((id) => {
        const node = ROUTE_NODE_BY_ID.get(id);
        const ground = queryGround(node.x, node.y);
        return worldToScreen({ x: node.x, y: node.y, z: ground.groundZ }, camera, view);
      });
      terrainGeometry.moveTo(routePoints[0].x, routePoints[0].y);
      for (const routePoint of routePoints.slice(1)) terrainGeometry.lineTo(routePoint.x, routePoint.y);
      terrainGeometry.stroke({ color: 0x261c17, width: (route.width + 24) * camera.zoom, alpha: 0.78, cap: 'round', join: 'round' });
      terrainGeometry.moveTo(routePoints[0].x, routePoints[0].y);
      for (const routePoint of routePoints.slice(1)) terrainGeometry.lineTo(routePoint.x, routePoint.y);
      terrainGeometry.stroke({ color: route.kind === 'main' ? 0x9d8152 : 0x6f6545, width: route.width * camera.zoom, alpha: route.kind === 'main' ? 0.92 : 0.76, cap: 'round', join: 'round' });
    }
    for (const surface of WORLD_SURFACES) {
      const area = surface.area;
      const vertices = area.type === 'rect'
        ? [{ x: area.minX, y: area.minY }, { x: area.maxX, y: area.minY }, { x: area.maxX, y: area.maxY }, { x: area.minX, y: area.maxY }]
        : area.vertices;
      const points = vertices.map((vertex) => {
        const sampled = queryGround(vertex.x, vertex.y);
        const z = surface.waterLevel ?? sampled.groundZ;
        return worldToScreen({ ...vertex, z }, camera, view);
      });
      terrainGeometry.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) terrainGeometry.lineTo(point.x, point.y);
      terrainGeometry.closePath().fill({ color: colors[surface.kind] ?? 0x415744, alpha: surface.kind === 'water' ? 0.82 : 0.94 })
        .stroke({ color: 0xb4d6c1, width: 2, alpha: 0.72 });
    }
    for (const landmark of LEVEL_ONE_WORLD.landmarks) {
      const ground = queryGround(landmark.anchor.x, landmark.anchor.y);
      const screen = worldToScreen({ ...landmark.anchor, z: ground.groundZ }, camera, view);
      terrainGeometry.circle(screen.x, screen.y, 30 * camera.zoom)
        .fill({ color: 0xffd166, alpha: 0.82 }).stroke({ color: 0xfff4b8, width: 4, alpha: 0.94 });
    }
    for (const poi of LEVEL_ONE_WORLD.pointsOfInterest) {
      const ground = queryGround(poi.anchor.x, poi.anchor.y);
      const screen = worldToScreen({ ...poi.anchor, z: ground.groundZ }, camera, view);
      terrainGeometry.rect(screen.x - 12 * camera.zoom, screen.y - 12 * camera.zoom, 24 * camera.zoom, 24 * camera.zoom)
        .fill({ color: 0x83f28f, alpha: 0.88 }).stroke({ color: 0xeaffdd, width: 3, alpha: 0.9 });
    }
    for (const hazard of LEVEL_ONE_WORLD.interactions.hazards) {
      const ground = queryGround(hazard.anchor.x, hazard.anchor.y);
      const screen = worldToScreen({ ...hazard.anchor, z: ground.groundZ }, camera, view);
      terrainGeometry.circle(screen.x, screen.y, 52 * camera.zoom)
        .fill({ color: 0xff5c7a, alpha: 0.12 }).stroke({ color: 0xff5c7a, width: 4, alpha: 0.72 });
    }
  };

  const renderAuthoredCollision = (view) => {
    collisionGeometry.clear();
    for (const blocker of WORLD_BLOCKERS) {
      const shape = blocker.shape;
      if (shape.type === 'circle') {
        const center = worldToScreen({ x: shape.x, y: shape.y, z: 0 }, camera, view);
        collisionGeometry.circle(center.x, center.y, shape.radius * camera.zoom).fill({ color: 0x314f61, alpha: 0.95 }).stroke({ color: 0x8dc6d8, width: 2 });
      } else if (shape.type === 'capsule') {
        const a = worldToScreen({ ...shape.a, z: 0 }, camera, view);
        const b = worldToScreen({ ...shape.b, z: 0 }, camera, view);
        collisionGeometry.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x8dc6d8, width: shape.radius * 2 * camera.zoom, cap: 'round' });
      } else {
        const points = shape.vertices.map((vertex) => worldToScreen({ ...vertex, z: 0 }, camera, view));
        collisionGeometry.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) collisionGeometry.lineTo(point.x, point.y);
        collisionGeometry.closePath().fill({ color: 0x314f61, alpha: 0.95 }).stroke({ color: 0x8dc6d8, width: 2 });
      }
    }
    const topLeft = worldToScreen({ x: WORLD_BOUNDS.minX, y: WORLD_BOUNDS.minY, z: 0 }, camera, view);
    const bottomRight = worldToScreen({ x: WORLD_BOUNDS.maxX, y: WORLD_BOUNDS.maxY, z: 0 }, camera, view);
    collisionGeometry.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y).stroke({ color: 0x49ddff, width: 4, alpha: 0.65 });
  };

  const renderMinimap = (view, renderState) => {
    minimap.clear();
    const compact = view.width < 600;
    const width = Math.min(compact ? 120 : 220, view.width * 0.34);
    const height = width * (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
    const originX = view.width - width - 16;
    const originY = compact && view.height >= 700 ? view.height - height - 300 : 16;
    if (debugGridEnabled) {
      stageElement.dataset.minimapWidth = width.toFixed(3);
      stageElement.dataset.minimapHeight = height.toFixed(3);
      stageElement.dataset.minimapX = originX.toFixed(3);
      stageElement.dataset.minimapY = originY.toFixed(3);
    }
    const mapPoint = (normalized) => ({ x: originX + normalized.x * width, y: originY + normalized.y * height });
    minimap.roundRect(originX - 6, originY - 6, width + 12, height + 12, 8)
      .fill({ color: 0x071522, alpha: 0.92 }).stroke({ color: 0x8dc6d8, width: 2, alpha: 0.85 });
    for (const district of MINIMAP_GEOMETRY.districts) {
      const minimum = mapPoint(district.area.min);
      const maximum = mapPoint(district.area.max);
      minimap.rect(minimum.x, minimum.y, maximum.x - minimum.x, maximum.y - minimum.y).fill({ color: district.color, alpha: 0.5 });
    }
    for (const route of MINIMAP_GEOMETRY.routes) {
      const points = route.points.map(mapPoint);
      minimap.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) minimap.lineTo(point.x, point.y);
      minimap.stroke({ color: route.kind === 'main' ? 0xffd166 : 0xb8a36e, width: route.kind === 'main' ? 3 : 1.5, alpha: 0.82, cap: 'round' });
    }
    for (const surface of MINIMAP_GEOMETRY.surfaces.filter((candidate) => ['water', 'shallow-water', 'bridge'].includes(candidate.kind))) {
      if (surface.area.type !== 'rect') continue;
      const minimum = mapPoint(surface.area.min);
      const maximum = mapPoint(surface.area.max);
      minimap.rect(minimum.x, minimum.y, maximum.x - minimum.x, maximum.y - minimum.y)
        .fill({ color: surface.kind === 'bridge' ? 0xc49a63 : 0x2591b3, alpha: 0.9 });
    }
    for (const cellId of revealSnapshot.revealedCellIds) {
      const [column, row] = cellId.split(':').map(Number);
      const cellWidth = width / revealSnapshot.columns;
      const cellHeight = height / revealSnapshot.rows;
      minimap.rect(originX + column * cellWidth, originY + row * cellHeight, cellWidth + 0.5, cellHeight + 0.5)
        .fill({ color: 0xe8f6c9, alpha: 0.08 });
    }
    for (const boundary of MINIMAP_GEOMETRY.hardBoundaries) {
      if (boundary.shape.type === 'capsule') {
        const a = mapPoint(boundary.shape.a);
        const b = mapPoint(boundary.shape.b);
        minimap.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0xd7fbff, width: 1.5, alpha: 0.8, cap: 'round' });
      } else if (boundary.shape.type === 'polygon') {
        const points = boundary.shape.points.map(mapPoint);
        minimap.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1)) minimap.lineTo(point.x, point.y);
        minimap.closePath().stroke({ color: 0xd7fbff, width: 1.5, alpha: 0.8 });
      }
    }
    for (const landmark of MINIMAP_GEOMETRY.landmarks) {
      const center = mapPoint(landmark.point);
      minimap.circle(center.x, center.y, 2.5).fill({ color: 0xfff06a, alpha: 0.95 });
    }
    const normalizedPlayer = {
      x: (renderState.x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX),
      y: (renderState.y - WORLD_BOUNDS.minY) / (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY),
    };
    const player = mapPoint(normalizedPlayer);
    minimap.circle(player.x, player.y, view.width < 600 ? 4 : 5)
      .fill({ color: 0x49ddff, alpha: 1 }).stroke({ color: 0xffffff, width: 1.5, alpha: 1 });
  };

  const renderWorld = (renderState = renderActor ?? actor) => {
    const view = viewport();
    backdrop.clear().rect(0, 0, view.width, view.height).fill({ color: 0x071522 });
    terrainGeometry.clear();
    grid.clear();
    collisionGeometry.clear();
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
    } else {
      for (let x = 0; x <= view.width; x += 64) grid.moveTo(x, 0).lineTo(x, view.height);
      for (let y = 0; y <= view.height; y += 64) grid.moveTo(0, y).lineTo(view.width, y);
      grid.stroke({ color: 0x1c5267, width: 1, alpha: 0.42 });
    }
    if (renderState && camera) {
      renderAuthoredTerrain(view);
      renderAuthoredCollision(view);
      const groundScreen = worldToScreen(getGroundContact(renderState), camera, view);
      const screen = worldToScreen(renderState, camera, view);
      enemyTelegraphs.clear();
      bossTelegraphs.clear();
      bossVisual.visible = false;
      for (const enemy of grayboxEnemies) {
        const enemyMarker = enemyMarkers.get(enemy.id);
        if (!enemyMarker) continue;
        enemyMarker.visible = enemy.active;
        if (!enemy.active) continue;
        const archetype = ENEMY_ARCHETYPES[enemy.archetypeId];
        const enemyScreen = worldToScreen({ ...enemy, z: enemy.groundZ ?? 0 }, camera, view);
        const enemyAngle = Math.atan2(enemy.velocity.y, enemy.velocity.x);
        const enemyDirection = ((Math.round(enemyAngle / (Math.PI / 4)) % 8) + 8) % 8;
        enemyMarker.applyPose({
          state: resolveEnemyRuntimeVisualState(enemy, simulation?.tick ?? 0),
          tick: simulation?.tick ?? 0,
          direction: enemyDirection,
          elite: isEliteEnemyProjection(enemy.id),
        });
        enemyMarker.position.set(enemyScreen.x, enemyScreen.y);
        enemyMarker.scale.set(camera.zoom);
        enemyMarker.rotation = 0;
        enemyMarker.alpha = Math.max(0.35, enemy.health / enemy.maxHealth);
        if (enemy.attackPhase !== 'tell' || !enemy.telegraphTarget || !simulation) continue;
        const targetScreen = worldToScreen({ ...enemy.telegraphTarget, z: enemy.telegraphTarget.groundZ }, camera, view);
        const tellRatio = Math.max(0, Math.min(1, (enemy.attackPhaseUntilTick - simulation.tick) / archetype.attack.tellTicks));
        const alpha = 0.38 + (1 - tellRatio) * 0.5;
        if (archetype.attack.tokenFamily === 'area') {
          enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 96 * camera.zoom)
            .fill({ color: archetype.visual.color, alpha: 0.08 })
            .stroke({ color: archetype.visual.color, width: 4, alpha });
        } else if (archetype.attack.tokenFamily === 'support') {
          enemyTelegraphs.circle(targetScreen.x, targetScreen.y, 140 * camera.zoom)
            .stroke({ color: archetype.visual.color, width: 5, alpha });
        } else if (archetype.attack.tokenFamily === 'melee') {
          enemyTelegraphs.circle(enemyScreen.x, enemyScreen.y, archetype.attack.range * camera.zoom)
            .stroke({ color: archetype.visual.color, width: 4, alpha });
          enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
            .stroke({ color: archetype.visual.color, width: 3, alpha });
        } else {
          enemyTelegraphs.moveTo(enemyScreen.x, enemyScreen.y).lineTo(targetScreen.x, targetScreen.y)
            .stroke({ color: archetype.visual.color, width: 18 * camera.zoom, alpha: alpha * 0.22, cap: 'round' })
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
        death.graphic.applyPose({ state: 'death', tick: simulation?.tick ?? death.startTick, direction: 0, elite: death.elite });
        death.graphic.position.set(deathScreen.x, deathScreen.y);
        death.graphic.scale.set(camera.zoom);
      }
      const bossVisualTick = simulation?.tick ?? 0;
      if (liquidatorBoss && bossVisualTick >= liquidatorBoss.startTick && (liquidatorBoss.active || bossVisualTick < bossDeathVisualUntilTick)) {
        const bossScreen = worldToScreen({ x: liquidatorBoss.x, y: liquidatorBoss.y, z: liquidatorBoss.groundZ }, camera, view);
        bossVisual.applyPose({
          state: !liquidatorBoss.active ? 'death' : bossVisualTick <= bossHitVisualUntilTick ? 'hit' : liquidatorBoss.pendingAttacks.length > 0 ? 'tell' : 'idle',
          tick: bossVisualTick,
          direction: 0,
          elite: true,
        });
        bossVisual.visible = true;
        bossVisual.position.set(bossScreen.x, bossScreen.y);
        bossVisual.scale.set(camera.zoom);
        bossVisual.alpha = Math.max(0.38, liquidatorBoss.health / liquidatorBoss.maxHealth);
        for (const pending of liquidatorBoss.pendingAttacks) {
          const geometry = pending.geometry;
          const color = pending.attackId.includes('super') ? 0xfff06a : 0xff496c;
          if (geometry.type === 'line' || geometry.type === 'dash-line') {
            const from = worldToScreen({ ...geometry.origin, z: liquidatorBoss.groundZ }, camera, view);
            const to = worldToScreen({ ...geometry.target, z: liquidatorBoss.groundZ }, camera, view);
            bossTelegraphs.moveTo(from.x, from.y).lineTo(to.x, to.y)
              .stroke({ color, width: geometry.width * camera.zoom, alpha: 0.18, cap: 'round' })
              .stroke({ color, width: 4, alpha: 0.9, cap: 'round' });
          } else if (geometry.type === 'circle' || geometry.type === 'melee') {
            const center = worldToScreen({ ...geometry.center, z: liquidatorBoss.groundZ }, camera, view);
            bossTelegraphs.circle(center.x, center.y, geometry.radius * camera.zoom)
              .fill({ color, alpha: 0.09 }).stroke({ color, width: 4, alpha: 0.9 });
          } else if (geometry.type === 'ring') {
            const center = worldToScreen({ ...geometry.center, z: liquidatorBoss.groundZ }, camera, view);
            bossTelegraphs.circle(center.x, center.y, geometry.outerRadius * camera.zoom).stroke({ color, width: 5, alpha: 0.9 });
            bossTelegraphs.circle(center.x, center.y, geometry.innerRadius * camera.zoom).stroke({ color, width: 3, alpha: 0.72 });
          } else if (geometry.type === 'safe-circles') {
            for (const zone of geometry.zones) {
              const center = worldToScreen({ ...zone, z: liquidatorBoss.groundZ }, camera, view);
              bossTelegraphs.circle(center.x, center.y, zone.radius * camera.zoom)
                .fill({ color: 0x83f28f, alpha: 0.1 }).stroke({ color: 0x83f28f, width: 5, alpha: 0.95 });
            }
          } else if (geometry.type === 'summon-sites') {
            for (const site of geometry.sites) {
              const center = worldToScreen({ ...site, z: liquidatorBoss.groundZ }, camera, view);
              bossTelegraphs.circle(center.x, center.y, 36 * camera.zoom).stroke({ color, width: 4, alpha: 0.85 });
            }
          }
        }
      }
      for (const shot of activeProjectiles) {
        if (!shot.state) continue;
        const from = worldToScreen(shot.state.previous, camera, view);
        const to = worldToScreen(shot.state.current, camera, view);
        const shotColor = WEAPON_COLORS[shot.weaponId] ?? 0x49ddff;
        projectileTrails.moveTo(from.x, from.y).lineTo(to.x, to.y)
          .stroke({ color: shotColor, width: 7, alpha: 0.24 });
        projectileTrails.moveTo(from.x, from.y).lineTo(to.x, to.y)
          .stroke({ color: 0xf4fdff, width: 3, alpha: 0.98 });
      }
      for (const grenade of grenadeSystem?.active ?? []) {
        const ground = queryGround(grenade.position.x, grenade.position.y);
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
        combatVisualEvents = combatVisualEvents.filter((event) => simulation.tick - event.tick <= HIT_FEEDBACK_TICKS);
        for (const event of combatVisualEvents) {
          const age = simulation.tick - event.tick;
          const alpha = Math.max(0.08, 1 - age / HIT_FEEDBACK_TICKS);
          const center = worldToScreen(event.point, camera, view);
          if (event.type === 'muzzle') {
            combatVisuals.circle(center.x, center.y, 8 + age * 1.2).fill({ color: event.color, alpha: alpha * 0.72 });
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
      aimLine.clear();
      if (aimIntent) {
        const aimEnd = worldToScreen({
          x: renderState.x + aimIntent.direction.x * 96,
          y: renderState.y + aimIntent.direction.y * 96,
          z: renderState.z,
        }, camera, view);
        aimLine.moveTo(screen.x, screen.y).lineTo(aimEnd.x, aimEnd.y).stroke({ color: aimIntent.fire ? 0xffd166 : 0x49ddff, width: 3, alpha: 0.85 });
      }
      shadow.position.set(groundScreen.x, groundScreen.y);
      actorVisual.position.set(atlasActorEnabled ? groundScreen.x : screen.x, atlasActorEnabled ? groundScreen.y : screen.y);
      if (productionHeroDisplay && motion) {
        const visualTick = simulation?.tick ?? 0;
        const pistolFireAge = lastWeaponFire?.weaponId === 'coin-blaster' ? visualTick - lastWeaponFire.tick : Number.POSITIVE_INFINITY;
        const productionAction = pistolFireAge >= 0 && pistolFireAge < 12 ? 'pistol-fire' : 'aim';
        productionHeroDisplay.applyPose({
          simulationTick: visualTick,
          actionTick: productionAction === 'pistol-fire' ? pistolFireAge : visualTick,
          locomotion: motion.locomotion,
          legDirection: motion.legDirection,
          torsoDirection: motion.torsoDirection,
          action: productionAction,
        });
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
      const narrowDebug = debugGridEnabled && view.width < 600;
      label.style.fontSize = narrowDebug ? 12 : 18;
      label.style.align = 'center';
      const activeWeapon = weaponLoadout ? getActiveWeaponState(weaponLoadout) : null;
      const weaponName = activeWeapon ? HMH_WEAPON_DEFINITIONS[activeWeapon.id].displayName : 'NO WEAPON';
      const heatHud = activeWeapon?.heat > 0 ? ` // HEAT ${Math.round(activeWeapon.heat)}${activeWeapon.overheated ? ' HOT' : ''}` : '';
      const dashStatus = dashState && simulation ? getDashStatus(dashState, simulation.tick) : null;
      const dashHud = dashStatus?.active ? 'DASHING' : dashStatus?.ready ? 'DASH READY' : `DASH ${dashStatus?.cooldownSecondsRemaining ?? 10}s`;
      const dashAccessible = dashStatus?.active ? 'Dash active' : dashStatus?.ready ? 'Dash ready' : `Dash ${dashStatus?.cooldownSecondsRemaining ?? 10} seconds`;
      const activeEnemyCount = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0).length;
      const enemyTellCount = grayboxEnemies.filter((enemy) => enemy.active && enemy.attackPhase === 'tell').length;
      const combatHud = `${weaponName} ${activeWeapon?.ammoInClip ?? 0}${heatHud} // ${dashHud} // FRAG ${grenadeSystem?.handCharges ?? 0} // HP ${playerHealth} // E ${activeEnemyCount} // K ${runKills}`;
      const accessibleCombatStatus = `${weaponName}, ${activeWeapon?.ammoInClip ?? 0} rounds, heat ${Math.round(activeWeapon?.heat ?? 0)}${activeWeapon?.overheated ? ' overheated' : ''}, ${dashAccessible}, ${grenadeSystem?.handCharges ?? 0} grenades, health ${playerHealth}, ${activeEnemyCount} enemies, ${enemyTellCount} attack tells, ${runKills} defeats`;
      if (dashStatusElement) {
        dashStatusElement.textContent = dashAccessible;
        dashStatusElement.dataset.ready = String(dashStatus?.ready === true);
      }
      if (combatStatusElement && accessibleCombatStatus !== lastAccessibleCombatStatus) {
        combatStatusElement.value = accessibleCombatStatus;
        lastAccessibleCombatStatus = accessibleCombatStatus;
      }
      label.text = debugGridEnabled
        ? narrowDebug
          ? `${combatHud}\n${runtimeMode}\n${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}`
          : `${combatHud} // ${runtimeMode} // ${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}`
        : combatHud;
      const safeLabelX = view.width * 0.5;
      const safeLabelY = view.width < 600 ? 180 : 32;
      label.position.set(safeLabelX, safeLabelY);
      renderMinimap(view, renderState);
      if (debugGridEnabled) {
        stageElement.dataset.actorX = renderState.x.toFixed(3);
        stageElement.dataset.actorY = renderState.y.toFixed(3);
        stageElement.dataset.targetX = grayboxEnemies[0]?.x.toFixed(3) ?? '';
        stageElement.dataset.aimSource = aimIntent?.source ?? 'none';
        stageElement.dataset.firing = String(aimIntent?.fire === true);
        stageElement.dataset.collisionBlocker = lastCollision?.contacts.at(-1)?.blockerId ?? '';
        stageElement.dataset.collisionStalls = String(zeroDisplacementFrames);
        stageElement.dataset.surfaceId = lastGround?.surfaceId ?? '';
        stageElement.dataset.groundZ = String(lastGround?.groundZ ?? 0);
        stageElement.dataset.traversal = lastTraversal?.reason ?? '';
        stageElement.dataset.projectileCount = String(activeProjectiles.length);
        stageElement.dataset.projectileDrops = String(droppedProjectiles);
        stageElement.dataset.projectileHit = lastProjectileHit?.targetId ?? '';
        stageElement.dataset.weaponId = weaponLoadout?.activeWeaponId ?? '';
        stageElement.dataset.actorArt = actorVisual.label ?? '';
        stageElement.dataset.actorArtSource = productionPilotEnabled ? 'production-blender-atlas-v1' : pipelinePilotEnabled ? 'blender-atlas-v1' : 'pixi-graybox';
        stageElement.dataset.actorArtActor = productionPilotEnabled ? productionHeroSelection.actorId : pipelinePilotEnabled ? 'neutral-mannequin' : 'prototype-human';
        stageElement.dataset.actorArtLayers = productionHeroDisplay?.layerOrder.join(',') ?? mannequinDisplay?.layerOrder.join(',') ?? 'graybox';
        stageElement.dataset.actorArtFrameIds = actorVisual.frameIds ?? '';
        stageElement.dataset.enemyArt = 'production-vector-enemies-v1';
        stageElement.dataset.bossArt = 'production-vector-liquidator-v1';
        stageElement.dataset.bossVisualState = bossVisual.visible ? bossVisual.visualState ?? 'idle' : 'hidden';
        stageElement.dataset.inputWeaponSlot = String(lastInputWeaponSlot);
        stageElement.dataset.simulationTick = String(simulation?.tick ?? 0);
        stageElement.dataset.weaponAmmo = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).ammoInClip) : '';
        stageElement.dataset.weaponHeat = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).heat) : '';
        stageElement.dataset.weaponOverheated = String(weaponLoadout ? getActiveWeaponState(weaponLoadout).overheated : false);
        stageElement.dataset.grenadeCount = String(grenadeSystem?.active.length ?? 0);
        stageElement.dataset.handGrenades = String(grenadeSystem?.handCharges ?? 0);
        stageElement.dataset.dashReadyTick = dashState ? String(dashState.cooldownReadyTick) : '';
        stageElement.dataset.dashActive = String(dashStatus?.active === true);
        stageElement.dataset.dashInvulnerable = String(dashStatus?.invulnerable === true);
        stageElement.dataset.dashStopReason = dashStatus?.lastStopReason ?? '';
        stageElement.dataset.playerHealth = String(playerHealth);
        stageElement.dataset.audioVoices = String(combatAudio.status().activeVoices);
        stageElement.dataset.lastWeaponFire = lastWeaponFire?.weaponId ?? '';
        stageElement.dataset.lastMeleeTick = lastMeleeAttack ? String(lastMeleeAttack.tick) : '';
        stageElement.dataset.lastMeleeHits = String(lastMeleeAttack?.hits ?? 0);
        stageElement.dataset.lastGrenadeReason = lastGrenadeDetonation?.reason ?? '';
        stageElement.dataset.lastGrenadeTick = lastGrenadeDetonation ? String(lastGrenadeDetonation.tick) : '';
        stageElement.dataset.projectileCover = lastProjectileResolution?.resolutions
          ?.find((resolution) => resolution.coverHit)?.coverHit?.blockerId ?? '';
        stageElement.dataset.targetHealth = String(grayboxEnemies[0]?.health ?? 0);
        stageElement.dataset.enemyCount = String(activeEnemyCount);
        stageElement.dataset.enemyArchetypes = grayboxEnemies.map((enemy) => enemy.archetypeId).join(',');
        stageElement.dataset.enemyTells = String(enemyTellCount);
        stageElement.dataset.enemyDecisions = String(lastEnemyStep?.decisions ?? 0);
        stageElement.dataset.enemySafetySteps = String(lastEnemyStep?.safetySteps ?? 0);
        stageElement.dataset.enemyAttackDrops = String(lastEnemyAttack?.droppedEvents ?? 0);
        stageElement.dataset.enemyDeathVisuals = String(enemyDeathMarkers.size);
        stageElement.dataset.enemyEliteVisuals = String([...enemyMarkers.values()].filter((enemyMarker) => enemyMarker.eliteProjection).length);
        const encounterSnapshot = getEncounterSnapshot(simulation?.tick ?? 0);
        stageElement.dataset.encounterBand = encounterSnapshot.bandId;
        stageElement.dataset.directorInsertions = String(encounterDirector?.insertedCount ?? 0);
        stageElement.dataset.directorRejections = String(encounterDirector?.rejectedCount ?? 0);
        stageElement.dataset.directorLastReason = lastDirectorStep?.reason ?? '';
        stageElement.dataset.directorBodyCap = String(encounterSnapshot.bodyCap);
        stageElement.dataset.directorThreatCap = String(encounterSnapshot.threatCap);
        stageElement.dataset.bossActive = String(liquidatorBoss?.active === true && (simulation?.tick ?? 0) >= liquidatorBoss.startTick);
        stageElement.dataset.bossPhase = liquidatorBoss?.phaseId ?? '';
        stageElement.dataset.bossHealth = String(liquidatorBoss?.health ?? 0);
        stageElement.dataset.bossPendingTells = String(liquidatorBoss?.pendingAttacks.length ?? 0);
        stageElement.dataset.bossAttackDrops = String(liquidatorBoss?.droppedEvents ?? 0);
        stageElement.dataset.worldId = LEVEL_ONE_WORLD.id;
        stageElement.dataset.worldWidth = String(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
        stageElement.dataset.worldHeight = String(WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY);
        stageElement.dataset.districtId = getLevelOneDistrictAt(renderState.x, renderState.y)?.id ?? '';
        stageElement.dataset.revealedCells = String(revealSnapshot.revealedCellIds.length);
        stageElement.dataset.revealTotalCells = String(revealSnapshot.totalCells);
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
    lastMeleeAttack = null;
    lastGrenadeDetonation = null;
    combatVisualEvents = [];
    lastAccessibleCombatStatus = '';
    playerDefeatController = null;
    playerHealth = 100;
    runKills = 0;
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
    const sessionHeroSelection = productionHeroAsset(payload.heroId);
    if (productionHeroDisplay && sessionHeroSelection.actorId !== productionHeroSelection.actorId) {
      throw new Error(`Production projection actor mismatch: loaded ${productionHeroSelection.actorId}, session requested ${sessionHeroSelection.actorId}`);
    }
    sessionPayload = payload;
    settings = { ...payload.settings };
    elapsedMs = 0;
    simulation = new DeterministicSimulation({ seed: payload.session.seed });
    actor = createActorSpatialState({ ...runtimePlayerSpawn, z: 0 });
    lastGround = queryGround(actor.x, actor.y);
    actor.groundZ = lastGround.groundZ;
    actor.z = lastGround.groundZ;
    motion = createPlayerMotionState({ x: actor.x, y: actor.y, maxSpeed: LEVEL_ONE_WORLD.player.maxSpeed });
    aimState = createAimState({ autoFireEnabled: true, manualHoldTicks: 8 });
    aimIntent = null;
    const previewSpawns = Object.freeze({
      'bagholder-rusher': Object.freeze({ x: 1120, y: 2400 }),
      forkrunner: Object.freeze({ x: 860, y: 2050 }),
      'liquidator-agent': Object.freeze({ x: 430, y: 2200 }),
      'whale-enforcer': Object.freeze({ x: 1260, y: 2700 }),
      'gas-bomber': Object.freeze({ x: 520, y: 2720 }),
      'validator-cultist': Object.freeze({ x: 1100, y: 2050 }),
    });
    enemyPopulation = createEnemyPopulation({ capacity: 192, threatCapacity: 1024 });
    grayboxEnemies = ENEMY_ARCHETYPE_IDS.map((archetypeId, index) => {
      const position = previewSpawns[archetypeId];
      return createEnemyState({
        archetypeId,
        id: `prototype-${String(index + 1).padStart(2, '0')}-${archetypeId}`,
        x: position.x,
        y: position.y,
        groundZ: queryGround(position.x, position.y).groundZ,
        visualMode: 'normal',
      });
    }).sort((a, b) => a.id.localeCompare(b.id));
    enemyPopulation.active = grayboxEnemies;
    enemyPopulation.activeThreat = grayboxEnemies.reduce((sum, enemy) => sum + ENEMY_ARCHETYPES[enemy.archetypeId].costs.threat, 0);
    enemyPopulation.insertedCount = grayboxEnemies.length;
    for (const enemy of grayboxEnemies) enemyPopulation.seenIds.add(enemy.id);
    encounterDirector = createEncounterDirector({ nextSpawnTick: directorDebugEnabled ? 1 : 600, seed: payload.session.seed });
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
    meleeState = createMeleeState();
    grenadeSystem = createGrenadeSystem({ capacity: MAX_ACTIVE_GRENADES, handCharges: 3 });
    dashState = createDashState({ cooldownTier: 0 });
    lastDashReady = true;
    playerDefeatController = createPlayerDefeatController({ maxHealth: 100 });
    playerHealth = 100;
    runKills = 0;
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
      });
      const movementStart = { x: motion.x, y: motion.y, z: actor.groundZ };
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
        }, { dtSeconds, speedMultiplier: terrainSpeedMultiplier });
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
      lastDirectorStep = stepEncounterDirector({
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

      lastEnemyStep = stepEnemyPopulation({
        population: enemyPopulation,
        player: { x: actor.x, y: actor.y, groundZ: actor.groundZ },
        tick,
        dtSeconds,
        blockers: WORLD_BLOCKERS,
        bounds: WORLD_BOUNDS,
        queryGround,
        preservePrevious: true,
      });

      const hurtTargets = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0).map((enemy) => createHurtTarget({
        id: enemy.id,
        bodyShape: { type: 'circle', radius: enemy.radius },
        hurtShape: { type: 'capsule', a: { x: 0, y: -8 }, b: { x: 0, y: 8 }, radius: Math.max(8, enemy.radius * 0.72) },
        previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
        currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
        minZ: 4,
        maxZ: 60,
        health: enemy.health,
      }));
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
      const meleeTargets = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0).map((enemy) => createMeleeTarget({
        id: enemy.id,
        previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
        currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
        radius: Math.max(8, enemy.radius * 0.72),
        minZ: 4,
        maxZ: 60,
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

      const steppedProjectiles = activeProjectiles.map((shot) => {
        const previous = Object.freeze({ x: shot.x, y: shot.y, z: shot.z });
        const current = Object.freeze({
          x: shot.x + shot.vx * dtSeconds,
          y: shot.y + shot.vy * dtSeconds,
          z: shot.z,
        });
        const state = createProjectileState({
          id: shot.id,
          ownerId: 'player',
          previous: previous,
          current: current,
          radius: shot.radius,
          damage: shot.damage,
          policy: shot.policy,
        });
        return {
          ...shot,
          x: current.x,
          y: current.y,
          z: current.z,
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
          for (const hit of resolution.hits) {
            combatHitIntents.push({
              id: `${shot.id}:${hit.targetId}:${hit.kind}`,
              tick,
              time: hit.time,
              targetId: hit.targetId,
              sourceId: 'player',
              weaponId: shot.weaponId,
              damage: hit.damage,
              criticalChance: 0.08,
              criticalMultiplier: 1.75,
              armorPiercing: false,
              direction: { x: shot.vx, y: shot.vy },
              knockback: WEAPON_KNOCKBACK[shot.weaponId] ?? 6,
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

      const directWeaponId = tickInput.weaponSlot > 0 ? WEAPON_ORDER[tickInput.weaponSlot - 1] : null;
      const nextWeaponPressed = tickInput.weaponNext && !previousWeaponNext;
      const nextWeaponId = nextWeaponPressed
        ? WEAPON_ORDER[(WEAPON_ORDER.indexOf(weaponLoadout.activeWeaponId) + 1) % WEAPON_ORDER.length]
        : null;
      const requestedWeaponId = directWeaponId ?? nextWeaponId;
      let switchedWeapon = false;
      if (requestedWeaponId && requestedWeaponId !== weaponLoadout.activeWeaponId) {
        selectWeapon(weaponLoadout, requestedWeaponId, { tick });
        switchedWeapon = true;
      }
      previousWeaponNext = tickInput.weaponNext;
      const weaponFrame = switchedWeapon
        ? { events: [], activeWeaponId: weaponLoadout.activeWeaponId }
        : stepWeaponLoadout(weaponLoadout, {
          tick,
          fire: aimIntent.fire,
          direction: aimIntent.direction,
        });
      for (const event of weaponFrame.events.filter((candidate) => candidate.type === 'weapon:fire')) {
        lastWeaponFire = { tick, weaponId: event.weaponId, attackId: event.attackId };
        applyRecoilImpulse(motion, {
          direction: { x: -aimIntent.direction.x, y: -aimIntent.direction.y },
          magnitude: event.recoil,
        });
        combatAudio.play(event.weaponId === 'launcher-rig' ? 'grenade' : 'weapon-fire', { volume: event.weaponId === 'scatter-shotgun' ? 0.14 : 0.1 });
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
          throwGrenade(grenadeSystem, {
            tick,
            mode: 'launcher',
            origin: {
              x: actor.x + aimIntent.direction.x * 28,
              y: actor.y + aimIntent.direction.y * 28,
              z: actor.groundZ + 32,
            },
            direction: aimIntent.direction,
          });
          continue;
        }
        for (const shot of event.shots) {
          if (activeProjectiles.length >= MAX_ACTIVE_PROJECTILES) {
            droppedProjectiles += 1;
            continue;
          }
          const muzzle = {
            x: actor.x + shot.direction.x * 28,
            y: actor.y + shot.direction.y * 28,
            z: actor.groundZ + 34,
          };
          activeProjectiles.push({
            id: shot.id,
            attackId: event.attackId,
            weaponId: event.weaponId,
            x: muzzle.x,
            y: muzzle.y,
            z: muzzle.z,
            vx: shot.direction.x * shot.speed,
            vy: shot.direction.y * shot.speed,
            radius: shot.radius,
            damage: shot.damage,
            policy: shot.policy,
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
      });
      combatHitIntents.push(...meleeFrame.hits);
      if (meleeFrame.attacked) {
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
        });
        if (grenadeSpawn.spawned) {
          combatAudio.play('grenade', { volume: 0.12 });
          applyRecoilImpulse(motion, {
            direction: { x: -aimIntent.direction.x, y: -aimIntent.direction.y },
            magnitude: 70,
          });
        }
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
        lastGrenadeDetonation = { tick, reason: detonation.reason, grenadeId: detonation.grenadeId };
        combatAudio.play('grenade-boom', { volume: 0.16 });
        pushCombatVisualEvent({ type: 'blast', tick, point: detonation.point, radius: detonation.radius });
        for (const hit of detonation.hits) combatHitIntents.push({ ...hit, tick });
      }

      lastEnemyAttack = stepEnemyAttacks({
        enemies: grayboxEnemies,
        player: { id: 'player', x: actor.x, y: actor.y, groundZ: actor.groundZ, radius: playerBody.radius },
        tick,
        budgets: getEncounterSnapshot(tick).attackTokens,
      });
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

      const authoritativeCombatHitIntents = filterDashInvulnerableHits(dashState, tick, combatHitIntents);
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
          maxHealth: 100,
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
          if (state.dead) {
            enemy.active = false;
            enemy.targetable = false;
          }
        }
        if (lastCombatResolution.targets.player) playerHealth = lastCombatResolution.targets.player.health;
        for (const damageEvent of lastCombatResolution.damageEvents) {
          if (damageEvent.amount <= 0) continue;
          combatAudio.play(damageEvent.targetId === 'player' ? 'player-hit' : 'enemy-hit', {
            volume: damageEvent.critical ? 0.14 : 0.09,
          });
          pushCombatVisualEvent({
            type: 'impact',
            tick,
            point: damageEvent.point,
            critical: damageEvent.critical,
            color: damageEvent.shielded ? 0x8bb8ff : damageEvent.critical ? 0xfff06a : 0xff8c5a,
          });
          if (damageEvent.targetId === 'player') {
            const magnitude = Math.hypot(damageEvent.knockback.x, damageEvent.knockback.y);
            if (magnitude > 0) applyRecoilImpulse(motion, {
              direction: { x: damageEvent.knockback.x / magnitude, y: damageEvent.knockback.y / magnitude },
              magnitude,
            });
            continue;
          }
          if (damageEvent.targetId === liquidatorBoss.id) {
            const bossDamage = applyLiquidatorDamage({ boss: liquidatorBoss, amount: damageEvent.amount, tick });
            if (bossDamage.runEvent) bossDeathVisualUntilTick = tick + 45;
            else bossHitVisualUntilTick = tick + 6;
            if (bossDamage.runEvent && bridge?.initialized) {
              bridge.send('game:run-event', {
                tick,
                sequence: runEventSequence,
                eventType: 'boss-defeated',
                value: 1,
                bossId: liquidatorBoss.id,
                elapsedTicks: bossDamage.runEvent.data.elapsedTicks,
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
          const defeatedEnemy = grayboxEnemies.find((enemy) => enemy.id === scoreEvent.enemyId);
          if (!defeatedEnemy) continue;
          queueEnemyDeathVisual(defeatedEnemy, tick);
          runKills += 1;
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
            bridge.send('game:state', defeatTransition.statePayload);
            bridge.send('game:game-over', defeatTransition.gameOverPayload);
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
    app.ticker.start();
    renderWorld();
  };

  const runtimeStatus = () => simulation?.state === 'active'
    ? 'running'
    : simulation?.state === 'game-over' ? 'game-over' : 'paused';
  const statePayload = (status = runtimeStatus()) => ({
    status,
    score: 0,
    kills: runKills,
    elapsedMs,
    health: playerHealth,
    maxHealth: 100,
    xp: 0,
    level: 1,
    paused: status === 'paused',
  });

  const pauseRuntime = (source) => {
    if (!simulation || (simulation.state !== 'active' && simulation.state !== 'upgrade')) return;
    if (simulation?.state === 'active' || simulation?.state === 'upgrade') simulation.pause();
    app.ticker.stop();
    combatAudio.pause();
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
    setStatus(bridge?.initialized ? 'Portal session connected' : 'Standalone session ready', `Resumed by ${source}.`);
    if (bridge?.initialized) {
      bridge.send('game:pause', { paused: false, source });
      bridge.send('game:state', statePayload('running'));
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') pauseRuntime('visibility');
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const handleResize = () => renderWorld();
  app.canvas.addEventListener('pointerdown', () => app.canvas.focus());
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
    if (debugGridEnabled) stageElement.dataset.snapshotWeaponSlot = String(snapshot.actions.weaponSlot);
    const frame = simulation.update(ticker.deltaMS, snapshot.actions);
    elapsedMs = simulation.timeMs;
    renderActor = interpolateSpatialState(previousActor ?? actor, actor, frame.alpha);
    followCameraTarget(camera, {
      ...actor,
      aimX: aimIntent?.direction.x ?? snapshot.actions.aim.x,
      aimY: aimIntent?.direction.y ?? snapshot.actions.aim.y,
    }, viewport(), { dtSeconds: Math.max(1 / 240, Math.min(ticker.deltaMS / 1000, 1 / 15)) });
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
          settings = { ...message.payload.settings };
          combatAudio.setMusicEnabled(settings.musicEnabled);
          bridge.send('game:settings', { settings: { ...settings } });
          bridge.send('game:state', statePayload());
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
      ? createStandaloneInitPayload({ heroId: productionPilotEnabled ? productionHeroSelection.actorId : 'lit-commando' })
      : null;
    initializeSession(payload);
    setStatus('Standalone session ready', `${payload.mode.toUpperCase()} // seed ${payload.session.seed} // no portal authority`);
  }
}

boot().catch((error) => {
  setStatus('Renderer initialization failed', error instanceof Error ? error.message : 'Unknown startup error');
});
