import { Application, Container, Graphics, Text } from 'pixi.js';
import { createAimState, resolveAimIntent } from './aim.mjs';
import { createHmhChildBridge } from './bridge.mjs';
import { createCombatAudio } from './combat-audio.mjs';
import { createPlayerDefeatController } from './combat-lifecycle.mjs';
import { resolveCombatHits } from './combat-events.mjs';
import {
  auditCollisionWorld,
  createCollisionBody,
  createStaticBlocker,
  resolveSweptCircleMotion,
} from './collision.mjs';
import {
  createAuthoredGroundQuery,
  createElevationSurface,
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
const WORLD_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 2048, maxY: 2048, visibleBoundaryId: 'graybox-cliff-ring' });
const BASE_SURFACE = createElevationSurface({
  id: 'foundation', kind: 'ground', area: { type: 'rect', ...WORLD_BOUNDS },
  groundZ: 0, visibleTerrainId: 'graybox-foundation', priority: 0,
});
const GRAYBOX_SURFACES = Object.freeze([
  createElevationSurface({
    id: 'south-river', kind: 'water', area: { type: 'rect', minX: 650, minY: 1260, maxX: 1600, maxY: 1440 },
    groundZ: -18, waterLevel: 6, deepWater: true, visibleTerrainId: 'graybox-south-river', priority: 1,
  }),
  createElevationSurface({
    id: 'south-shallows', kind: 'shallow-water', area: { type: 'rect', minX: 650, minY: 1220, maxX: 820, maxY: 1260 },
    groundZ: 0, waterLevel: 4, deepWater: false, visibleTerrainId: 'graybox-south-shallows', priority: 2,
  }),
  createElevationSurface({
    id: 'river-bridge-north-ramp', kind: 'ramp', area: { type: 'rect', minX: 1000, minY: 1235, maxX: 1120, maxY: 1265 },
    fromZ: 0, toZ: 16, axis: 'y', visibleTerrainId: 'graybox-river-bridge-north-ramp', priority: 5,
  }),
  createElevationSurface({
    id: 'river-bridge', kind: 'bridge', area: { type: 'rect', minX: 1000, minY: 1265, maxX: 1120, maxY: 1435 },
    groundZ: 16, visibleTerrainId: 'graybox-river-bridge', priority: 4,
  }),
  createElevationSurface({
    id: 'river-bridge-south-ramp', kind: 'ramp', area: { type: 'rect', minX: 1000, minY: 1435, maxX: 1120, maxY: 1465 },
    fromZ: 16, toZ: 0, axis: 'y', visibleTerrainId: 'graybox-river-bridge-south-ramp', priority: 5,
  }),
  createElevationSurface({
    id: 'east-ramp', kind: 'ramp', area: { type: 'rect', minX: 1320, minY: 900, maxX: 1440, maxY: 1100 },
    fromZ: 0, toZ: 64, axis: 'x', visibleTerrainId: 'graybox-east-ramp', priority: 4,
  }),
  createElevationSurface({
    id: 'east-ledge', kind: 'ledge', area: { type: 'rect', minX: 1440, minY: 850, maxX: 1700, maxY: 1150 },
    groundZ: 64, oneWayDrop: { x: 0, y: 1 }, visibleTerrainId: 'graybox-east-ledge', priority: 3,
  }),
]);
const queryGround = createAuthoredGroundQuery({ baseSurface: BASE_SURFACE, surfaces: GRAYBOX_SURFACES });
const GRAYBOX_BLOCKERS = Object.freeze([
  createStaticBlocker({
    id: 'concrete-divider',
    shape: { type: 'polygon', vertices: [{ x: 1160, y: 880 }, { x: 1192, y: 880 }, { x: 1192, y: 1120 }, { x: 1160, y: 1120 }] },
    visibleAssetId: 'graybox-concrete-divider',
    minZ: 0,
    maxZ: 96,
    combatCover: true,
  }),
  createStaticBlocker({
    id: 'south-boulder',
    shape: { type: 'circle', x: 1000, y: 1230, radius: 52 },
    visibleAssetId: 'graybox-south-boulder',
    minZ: 0,
    maxZ: 72,
    combatCover: true,
  }),
  createStaticBlocker({
    id: 'north-rail',
    shape: { type: 'capsule', a: { x: 860, y: 850 }, b: { x: 1120, y: 850 }, radius: 8 },
    visibleAssetId: 'graybox-north-rail',
    minZ: 0,
    maxZ: 54,
    combatCover: true,
  }),
]);
const COLLISION_AUDIT = auditCollisionWorld({
  blockers: GRAYBOX_BLOCKERS,
  visibleBarriers: GRAYBOX_BLOCKERS.map((blocker) => ({ id: blocker.visibleAssetId, hard: true, collisionBlockerIds: [blocker.id] })),
});
if (!COLLISION_AUDIT.ok) throw new Error(`Invalid authored collision world: ${COLLISION_AUDIT.errors.join('; ')}`);
const stageElement = document.querySelector('#hmhRebootStage');
const statusElement = document.querySelector('#hmhRebootStatus');
const sessionElement = document.querySelector('#hmhRebootSession');
const combatStatusElement = document.querySelector('#hmhRebootCombatStatus');

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
  const targetMarker = new Graphics().circle(0, 0, 30).fill({ color: 0xff5c7a, alpha: 0.28 }).stroke({ color: 0xff8ca1, width: 3 });
  const marker = new Graphics().circle(0, 0, 24).fill({ color: 0x49ddff }).stroke({ color: 0xffffff, width: 3 });
  const label = new Text({ text: 'DETERMINISTIC RUNTIME', style: { fill: 0xe9fbff, fontFamily: 'system-ui', fontSize: 18, fontWeight: '700' } });
  label.anchor.set(0.5);
  world.addChild(backdrop, terrainGeometry, grid, collisionGeometry, debugLabels, shadow, targetMarker, aimLine, projectileTrails, grenadeVisuals, combatVisuals, projectileImpacts, marker, collisionDebug, label);
  app.stage.addChild(world);

  const debugGridEnabled = new URLSearchParams(window.location.search).get('debugGrid') === '1';
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
  let playerBody = null;
  let lastCollision = null;
  let lastTraversal = null;
  let lastGround = null;
  let zeroDisplacementFrames = 0;
  let previousGrenade = false;
  let previousWeaponNext = false;
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
    for (const surface of GRAYBOX_SURFACES) {
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
  };

  const renderAuthoredCollision = (view) => {
    collisionGeometry.clear();
    for (const blocker of GRAYBOX_BLOCKERS) {
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
      const target = grayboxEnemies[0];
      if (target) {
        const targetScreen = worldToScreen({ ...target, z: target.groundZ ?? 0 }, camera, view);
        targetMarker.position.set(targetScreen.x, targetScreen.y);
        targetMarker.alpha = target.active ? Math.max(0.35, target.health / target.maxHealth) : 0;
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
      marker.position.set(screen.x, screen.y);
      marker.rotation = motion ? motion.torsoDirection * (Math.PI / 4) : 0;
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
      const combatHud = `${weaponName} ${activeWeapon?.ammoInClip ?? 0}${heatHud} // FRAG ${grenadeSystem?.handCharges ?? 0} // HP ${playerHealth} // K ${runKills}`;
      const accessibleCombatStatus = `${weaponName}, ${activeWeapon?.ammoInClip ?? 0} rounds, heat ${Math.round(activeWeapon?.heat ?? 0)}${activeWeapon?.overheated ? ' overheated' : ''}, ${grenadeSystem?.handCharges ?? 0} grenades, health ${playerHealth}, ${runKills} defeats`;
      if (combatStatusElement && accessibleCombatStatus !== lastAccessibleCombatStatus) {
        combatStatusElement.value = accessibleCombatStatus;
        lastAccessibleCombatStatus = accessibleCombatStatus;
      }
      label.text = debugGridEnabled
        ? narrowDebug
          ? `${combatHud}\n${runtimeMode}\n${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}`
          : `${combatHud} // ${runtimeMode} // ${lastGround?.surfaceId ?? 'none'} z=${lastGround?.groundZ ?? 0} // ${debugContact}`
        : combatHud;
      const halfLabelWidth = label.width * 0.5;
      const clampedLabelX = Math.min(view.width - halfLabelWidth - 8, Math.max(halfLabelWidth + 8, screen.x));
      label.position.set(clampedLabelX, screen.y + (narrowDebug ? 54 : 58));
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
        stageElement.dataset.weaponAmmo = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).ammoInClip) : '';
        stageElement.dataset.weaponHeat = weaponLoadout ? String(getActiveWeaponState(weaponLoadout).heat) : '';
        stageElement.dataset.weaponOverheated = String(weaponLoadout ? getActiveWeaponState(weaponLoadout).overheated : false);
        stageElement.dataset.grenadeCount = String(grenadeSystem?.active.length ?? 0);
        stageElement.dataset.handGrenades = String(grenadeSystem?.handCharges ?? 0);
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
      }
    } else {
      marker.position.set(view.width * 0.5, view.height * 0.5);
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
    playerBody = null;
    lastCollision = null;
    lastTraversal = null;
    lastGround = null;
    zeroDisplacementFrames = 0;
    activeProjectiles = [];
    weaponLoadout = null;
    meleeState = null;
    grenadeSystem = null;
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
    previousWeaponNext = false;
  };

  const initializeSession = (payload) => {
    stopCurrentSession();
    sessionPayload = payload;
    settings = { ...payload.settings };
    elapsedMs = 0;
    simulation = new DeterministicSimulation({ seed: payload.session.seed });
    actor = createActorSpatialState({ x: 1024, y: 1024, z: 0 });
    lastGround = queryGround(actor.x, actor.y);
    actor.groundZ = lastGround.groundZ;
    actor.z = lastGround.groundZ;
    motion = createPlayerMotionState({ x: actor.x, y: actor.y, maxSpeed: 240 });
    aimState = createAimState({ autoFireEnabled: true, manualHoldTicks: 8 });
    aimIntent = null;
    grayboxEnemies = [{
      id: 'graybox-target',
      x: 1280,
      y: 1024,
      previousX: 1280,
      previousY: 1024,
      groundZ: queryGround(1280, 1024).groundZ,
      previousGroundZ: queryGround(1280, 1024).groundZ,
      radius: 30,
      kind: 'regular',
      active: true,
      targetable: true,
      health: 120,
      maxHealth: 120,
      armor: 1,
      shieldCharges: 0,
      knockbackResistance: 1,
      collisionBody: createCollisionBody({ id: 'graybox-target', kind: 'regular', radius: 30, minZ: 4, maxZ: 60 }),
    }];
    playerBody = createCollisionBody({ id: 'player', kind: 'player', radius: 24, minZ: 0, maxZ: 56 });
    previousGrenade = false;
    previousWeaponNext = false;
    weaponLoadout = createWeaponLoadout({ weaponIds: WEAPON_ORDER, activeWeaponId: WEAPON_ORDER[0], seed: payload.session.seed });
    meleeState = createMeleeState();
    grenadeSystem = createGrenadeSystem({ capacity: MAX_ACTIVE_GRENADES, handCharges: 3 });
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
      const pressure = resolveEnemyPressure({
        x: motion.x,
        y: motion.y,
        radius: 24,
        velocity: { x: motion.vx, y: motion.vy },
      }, grayboxEnemies);
      motion.x += pressure.playerDelta.x;
      motion.y += pressure.playerDelta.y;
      for (const enemy of grayboxEnemies) {
        const delta = pressure.enemyDeltas.get(enemy.id);
        if (delta) { enemy.x += delta.x; enemy.y += delta.y; }
        enemy.groundZ = queryGround(enemy.x, enemy.y).groundZ;
      }
      lastCollision = resolveSweptCircleMotion({
        body: playerBody,
        start: movementStart,
        delta: { x: motion.x - movementStart.x, y: motion.y - movementStart.y },
        blockers: GRAYBOX_BLOCKERS,
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
      actor.locomotion = motion.locomotion;
      actor.combat = aimIntent.fire ? 'firing' : 'ready';

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
      const meleeTargets = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0).map((enemy) => createMeleeTarget({
        id: enemy.id,
        previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
        currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
        radius: Math.max(8, enemy.radius * 0.72),
        minZ: 4,
        maxZ: 60,
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
          blockers: GRAYBOX_BLOCKERS,
          broadphase,
        });
        lastProjectileResolution = batch;
        const shotById = new Map(steppedProjectiles.map((shot) => [shot.id, shot]));
        for (const resolution of batch.resolutions) {
          const shot = shotById.get(resolution.projectileId);
          for (const hit of resolution.hits) {
            combatHitIntents.push({
              id: `${shot.attackId}:${hit.targetId}:${hit.kind}`,
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
        blockers: GRAYBOX_BLOCKERS,
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
      const playerHurtTarget = playerHealth > 0 ? createHurtTarget({
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
        blockers: GRAYBOX_BLOCKERS,
        targets: playerHurtTarget ? [...hurtTargets, playerHurtTarget] : hurtTargets,
      });
      for (const detonation of grenadeFrame.detonations) {
        lastGrenadeDetonation = { tick, reason: detonation.reason, grenadeId: detonation.grenadeId };
        combatAudio.play('grenade-boom', { volume: 0.16 });
        pushCombatVisualEvent({ type: 'blast', tick, point: detonation.point, radius: detonation.radius });
        for (const hit of detonation.hits) combatHitIntents.push({ ...hit, tick });
      }

      if (combatHitIntents.length > 0) {
        const combatTargets = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0).map((enemy) => ({
          id: enemy.id,
          health: enemy.health,
          maxHealth: enemy.maxHealth,
          armor: enemy.armor,
          shieldCharges: enemy.shieldCharges,
          knockbackResistance: enemy.knockbackResistance,
        }));
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
          hits: combatHitIntents,
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
          const enemy = grayboxEnemies.find((candidate) => candidate.id === damageEvent.targetId);
          if (!enemy) continue;
          const knockbackCollision = resolveSweptCircleMotion({
            body: enemy.collisionBody,
            start: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
            delta: damageEvent.knockback,
            blockers: GRAYBOX_BLOCKERS,
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
        for (const scoreEvent of lastCombatResolution.scoreEvents) {
          if (!grayboxEnemies.some((enemy) => enemy.id === scoreEvent.enemyId)) continue;
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
        }
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
    const frame = simulation.update(ticker.deltaMS, snapshot.actions);
    elapsedMs = simulation.timeMs;
    renderActor = interpolateSpatialState(previousActor ?? actor, actor, frame.alpha);
    followCameraTarget(camera, {
      ...actor,
      aimX: aimIntent?.direction.x ?? snapshot.actions.aim.x,
      aimY: aimIntent?.direction.y ?? snapshot.actions.aim.y,
    }, viewport(), { dtSeconds: Math.max(1 / 240, Math.min(ticker.deltaMS / 1000, 1 / 15)) });
    renderWorld(renderActor);
    const locomotionPulse = motion?.locomotion === 'run' ? Math.sin(elapsedMs * 0.012) * 0.07 : 0;
    const combatStretch = actor.combat === 'melee' ? 0.18 : actor.combat === 'firing' ? 0.1 : 0;
    if (!settings.reduceMotion) marker.scale.set(1 + locomotionPulse + combatStretch, 1 - combatStretch * 0.45);
    else marker.scale.set(1);
    marker.tint = actor.combat === 'melee' ? 0xd7fbff : actor.combat === 'firing' ? 0xffd166 : 0xffffff;
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
    const payload = window.parent === window ? createStandaloneInitPayload() : null;
    initializeSession(payload);
    setStatus('Standalone session ready', `${payload.mode.toUpperCase()} // seed ${payload.session.seed} // no portal authority`);
  }
}

boot().catch((error) => {
  setStatus('Renderer initialization failed', error instanceof Error ? error.message : 'Unknown startup error');
});
