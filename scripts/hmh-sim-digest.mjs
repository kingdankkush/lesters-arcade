// Headless same-seed simulation digest for HMH (no browser, no Pixi).
//
// Purpose: a fast bit-identical check for simulation-path changes. It drives
// the real deterministic modules against the real Level 1 world, collision
// set and nav grid, in the order apps/hmh-reboot/src/main.mjs steps them each
// fixed tick, and hashes the exact float bits of every enemy, projectile, the
// hero, weapons, progression, silver and the finalized run-summary evidence.
// Same seed + same modules => same digest; any change to movement, separation,
// navigation, collision, projectile resolution, damage, criticals, AI, attack
// tokens, director spawning, progression or evidence changes it.
//
// Scenarios (both run by default):
//   crowd    - the browser crowd bench's scene: evidenceSafe +
//              endurancePressurePilot (128 endurance-band enemies around an
//              invulnerable auto-firing hero at the Level 1 spawn, endurance
//              encounter snapshot, no respawns).
//   director - an evidenceSafe opening from tick 0 with the live encounter
//              director spawning (opening holds, band ramps, pacing recovery).
//
// Coverage limits (documented, deliberate): no input (the hero stands still,
// auto-aims, auto-fires and auto-melees), so dash, hand grenades and weapon
// swaps never occur; world-design sites, secrets, destructibles/fuel, authored
// collectibles and the Liquidator boss are not stepped. Upgrades take the first
// offered choice on the tick they are earned (the browser applies them at the
// next frame boundary). Changes confined to main.mjs glue or to the omitted
// systems are checked by the browser trace digest instead:
//   node scripts/hmh-perf-crowd-bench.mjs --mode=census --profile=desktop
//
// Usage:
//   node scripts/hmh-sim-digest.mjs                 # 36,000 ticks, both scenarios
//   node scripts/hmh-sim-digest.mjs --ticks=3600 --scenario=crowd

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { createAimState, resolveAimIntent } from '../apps/hmh-reboot/src/aim.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { resolveComboFeedback } from '../apps/hmh-reboot/src/combo-feedback.mjs';
import { resolveSweptTraversalPath, traceHeightAwareLineOfSight, movementSpeedMultiplierForTransition } from '../apps/hmh-reboot/src/elevation.mjs';
import { ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { resolveEnemyAttackAgainstPlayer, stepEnemyAttacks } from '../apps/hmh-reboot/src/enemy-combat.mjs';
import { createOrdinaryEnemyHurtboxProfile } from '../apps/hmh-reboot/src/enemy-hurtboxes.mjs';
import {
  computeEnemyFlowField,
  createEnemyNavGrid,
  navLineBlocked,
  sampleChokepointDirection,
  sampleCoverDirection,
  sampleFlankLaneDirection,
  sampleFlowDirection,
} from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import {
  attemptScheduledEnemyInsertion,
  createEnemyPopulation,
  createEnemyState,
  retireEnemyFromPopulation,
  stepEnemyPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { createEncounterDirector, directorViewBounds, getEncounterSnapshot, stepEncounterDirector } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { buildEnduranceEncounterCandidates } from '../apps/hmh-reboot/src/encounter-endurance-pilot.mjs';
import {
  LEVEL_ONE_WORLD,
  createLevelOneGroundQuery,
  createLevelOneRevealState,
  getLevelOneDistrictAt,
  getLevelOneRevealSnapshot,
  revealLevelOneAt,
} from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createMeleeState, createMeleeTarget, stepMeleeState } from '../apps/hmh-reboot/src/melee.mjs';
import { createMinimapDiscoveryState, discoverMinimapPointsOfInterest } from '../apps/hmh-reboot/src/minimap-model.mjs';
import { applyRecoilImpulse, createPlayerMotionState, resolveEnemyPressure, stepPlayerMovement } from '../apps/hmh-reboot/src/movement.mjs';
import {
  HMH_OPENING_ENEMY_ARCHETYPE_IDS,
  HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE,
  openingEnemyAttacksEnabled,
  openingEnemyMovementEnabled,
} from '../apps/hmh-reboot/src/opening-balance.mjs';
import {
  UniformHurtboxGrid,
  createHurtTarget,
  createProjectileState,
  planProjectileFlightStep,
  resolveProjectileBatch,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';
import {
  comboMilestoneXp,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunSilver,
  grantRunXp,
  recordRunDefeat,
  selectRunUpgrade,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import { MAX_ACTIVE_PROJECTILES } from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { addSilverDrop, createSilverDropState, silverDropAccounting, stepSilverDrops } from '../apps/hmh-reboot/src/silver-drops.mjs';
import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { createWeaponLoadout, laneDamageScale, progressionByWeapon as buildProgressionByWeapon, stepWeaponLoadout } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { createWorldDesignPacing, stepWorldDesignPacing } from '../apps/hmh-reboot/src/world-design-pacing.mjs';
import { WORLD_ENVIRONMENT_WEAPON_IDS, buildWorldHazardHits, withholdLethalHazardHits, worldHazardField } from '../apps/hmh-reboot/src/world-hazards.mjs';
import { createActorSpatialState } from '../apps/hmh-reboot/src/world-space.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunDamage,
  recordRunKill,
  recordRunProjectileContacts,
  recordRunProjectileResolution,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponFire,
  recordRunWeaponLifecycleEvent,
  recordRunWeaponTriggerContact,
} from '../sdk/hmh-run-summary.mjs';
import { runEnemyEnduranceSoak } from './hmh-reboot-enemy-endurance-soak.mjs';

// Constants copied from main.mjs (module-private there). If main changes one,
// this digest must follow; tests/hmh-sim-digest.test.mjs pins them to source.
export const MAIN_CONSTANTS = Object.freeze({
  PROJECTILE_FLIGHT_HEIGHT: 34,
  PROJECTILE_GRID_THRESHOLD: 64,
  CRITICAL_CHANCE_CAP: 0.45,
  BASE_CRITICAL_CHANCE: 0.08,
  BASE_CRITICAL_MULTIPLIER: 1.75,
  ENEMY_FLOW_REFRESH_TICKS: 30,
  ENDURANCE_TICK_OFFSET: 75_600,
});
export const WEAPON_ORDER = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'hash-rail', 'lightning-ledger', 'bear-market-burner', 'forked-standard']);
export const WEAPON_KNOCKBACK = Object.freeze({
  'coin-blaster': 8, 'scatter-shotgun': 18, 'auto-miner': 5, 'launcher-rig': 24,
  'hash-rail': 38, 'lightning-ledger': 4, 'bear-market-burner': 2, 'forked-standard': 18,
});
const OPENING_PREVIEW_SPAWNS = Object.freeze({
  'bagholder-rusher': { x: 1120, y: 2400 },
  forkrunner: { x: 860, y: 2050 },
});
export const STANDALONE_SEED = 0x484d4804;

const {
  PROJECTILE_FLIGHT_HEIGHT, PROJECTILE_GRID_THRESHOLD, CRITICAL_CHANCE_CAP, BASE_CRITICAL_CHANCE,
  BASE_CRITICAL_MULTIPLIER, ENEMY_FLOW_REFRESH_TICKS, ENDURANCE_TICK_OFFSET,
} = MAIN_CONSTANTS;

// ---- exact-bit streaming hash -------------------------------------------------
const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
class BitHasher {
  constructor() { this.a = 0x811c9dc5; this.b = 0x9747b28c; }
  word(value) {
    const v = value >>> 0;
    this.a = Math.imul(this.a ^ v, 0x01000193) >>> 0;
    this.b = Math.imul((this.b ^ v) + 0x9e3779b9 | 0, 0x85ebca6b) >>> 0;
    this.b = (this.b ^ (this.b >>> 13)) >>> 0;
  }
  num(value) {
    if (typeof value === 'boolean') { this.word(value ? 1 : 2); return; }
    if (value === null || value === undefined) { this.word(0xdeadbeef); return; }
    f64[0] = value;
    this.word(u32[0]);
    this.word(u32[1]);
  }
  str(value) {
    const text = String(value);
    this.word(text.length);
    for (let index = 0; index < text.length; index += 1) this.word(text.charCodeAt(index));
  }
  hex() { return `${this.a.toString(16).padStart(8, '0')}${this.b.toString(16).padStart(8, '0')}`; }
}

function jsonReplacer(_key, value) {
  if (value instanceof Map) return { __map: [...value.entries()] };
  if (value instanceof Set) return { __set: [...value.values()] };
  if (typeof value === 'number' && !Number.isFinite(value)) return `__num:${value}`;
  return value;
}
const sha256 = (value) => createHash('sha256').update(JSON.stringify(value, jsonReplacer)).digest('hex');

// ---- world (module scope in main.mjs) ----------------------------------------
const WORLD_BOUNDS = LEVEL_ONE_WORLD.bounds;
const WORLD_BLOCKERS = LEVEL_ONE_WORLD.collisionBlockers;
const queryGround = createLevelOneGroundQuery();
let NAV_GRID = null;
function navGrid() {
  NAV_GRID ??= createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround });
  return NAV_GRID;
}

function spawnPointBlocked(point) {
  return WORLD_BLOCKERS.some((blocker) => {
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
}

const EMPTY_INPUT = Object.freeze({
  move: Object.freeze({ x: 0, y: 0 }),
  aim: Object.freeze({ x: 0, y: 0, active: false }),
  aimAssist: false,
  aimDevice: 'keyboard',
  fire: false, melee: false, grenade: false, dash: false, pause: false, weaponSlot: 0, weaponNext: false,
});

export function runSimDigestScenario({ scenario, seed = STANDALONE_SEED, ticks = 36_000, checkpointEvery = 6_000 } = {}) {
  assert.ok(['crowd', 'director'].includes(scenario), 'scenario must be crowd or director');
  assert.ok(Number.isInteger(ticks) && ticks > 0, 'ticks must be a positive integer');
  const crowd = scenario === 'crowd';
  const grid = navGrid();
  const encounterSnapshot = (tick) => getEncounterSnapshot(tick + (crowd ? ENDURANCE_TICK_OFFSET : 0));
  const spawn = LEVEL_ONE_WORLD.player.spawn;

  // ---- session init (initializeSession) ----
  const simulation = new DeterministicSimulation({ seed });
  const runProgression = createRunProgression({ seed });
  let maxPlayerHealth = 100;
  let playerHealth = maxPlayerHealth;
  const actor = createActorSpatialState({ ...spawn, z: 0 });
  const runSummary = createRunSummaryAccumulator({ seed, buildHash: 'hmh-sim-digest', mode: 'free', heroId: 'lit-commando', startTick: 0, startPosition: actor });
  let lastGround = queryGround(actor.x, actor.y);
  actor.groundZ = lastGround.groundZ;
  actor.z = lastGround.groundZ;
  const motion = createPlayerMotionState({ x: actor.x, y: actor.y, maxSpeed: LEVEL_ONE_WORLD.player.maxSpeed });
  const aimState = createAimState({ autoFireEnabled: true, manualHoldTicks: 8, aimMagnetism: 0 });
  const revealState = createLevelOneRevealState();
  revealLevelOneAt(revealState, spawn);
  let revealSnapshot = getLevelOneRevealSnapshot(revealState);
  const minimapDiscovery = createMinimapDiscoveryState();
  const worldPacingState = createWorldDesignPacing();
  const silverDropState = createSilverDropState();
  const enemyPopulation = createEnemyPopulation({ capacity: 192, threatCapacity: crowd ? encounterSnapshot(0).threatCap : 1024 });
  if (crowd) {
    const candidates = buildEnduranceEncounterCandidates({ count: 128, seed, origin: spawn, bounds: WORLD_BOUNDS, queryGround, isBlocked: spawnPointBlocked });
    for (const candidate of candidates) {
      const result = attemptScheduledEnemyInsertion({
        population: enemyPopulation,
        schedule: { nextSpawnTick: 0, intervalTicks: 1, burstRemaining: 1 },
        candidate,
        tick: 0,
        placementAllowed: true,
        visualMode: 'normal',
        threatRemaining: encounterSnapshot(0).threatCap - enemyPopulation.activeThreat,
      });
      if (!result.inserted) throw new Error(`crowd insertion rejected: ${result.reason}`);
    }
  } else {
    const archetypeIndex = new Map(Object.keys(ENEMY_ARCHETYPES).map((id, index) => [id, index]));
    for (const archetypeId of HMH_OPENING_ENEMY_ARCHETYPE_IDS) {
      const position = { x: spawn.x + OPENING_PREVIEW_SPAWNS[archetypeId].x - 800, y: spawn.y + OPENING_PREVIEW_SPAWNS[archetypeId].y - 2400 };
      const enemy = createEnemyState({
        archetypeId,
        id: `prototype-${String(archetypeIndex.get(archetypeId) + 1).padStart(2, '0')}-${archetypeId}`,
        x: position.x,
        y: position.y,
        groundZ: queryGround(position.x, position.y).groundZ,
        visualMode: 'normal',
      });
      enemy.health = HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE[archetypeId];
      enemy.maxHealth = enemy.health;
      enemyPopulation.active.push(enemy);
      enemyPopulation.activeThreat += ENEMY_ARCHETYPES[archetypeId].costs.threat;
      enemyPopulation.insertedCount += 1;
      enemyPopulation.seenIds.add(enemy.id);
    }
  }
  const enemies = enemyPopulation.active;
  const encounterDirector = createEncounterDirector({ nextSpawnTick: crowd ? Number.MAX_SAFE_INTEGER : 600, seed });
  const weaponLoadout = createWeaponLoadout({ weaponIds: WEAPON_ORDER, activeWeaponId: WEAPON_ORDER[0], seed });
  const meleeState = createMeleeState();
  const playerBody = createCollisionBody({ id: 'player', kind: 'player', radius: LEVEL_ONE_WORLD.player.radius, minZ: 0, maxZ: 56 });
  let activeProjectiles = [];
  let zeroDisplacementFrames = 0;
  let enemyFlowField = null;
  let enemyFlowFieldTick = -1;
  let enemyFlowReplanRequestedTick = -1;
  let runKills = 0;
  let runCombo = 0;
  let maxRunCombo = 0;
  let droppedProjectiles = 0;
  let upgradesTaken = 0;
  const navigation = Object.freeze({
    lineBlocked: (fromX, fromY, toX, toY) => navLineBlocked(grid, fromX, fromY, toX, toY),
    coverDirectionAt: (fromX, fromY, toX, toY, options) => sampleCoverDirection(grid, fromX, fromY, toX, toY, options),
    chokepointDirectionAt: (fromX, fromY, toX, toY, options) => sampleChokepointDirection(grid, fromX, fromY, toX, toY, options),
    flankLaneDirectionAt: (fromX, fromY, toX, toY, options) => sampleFlankLaneDirection(grid, fromX, fromY, toX, toY, options),
    // No burner scorch zones exist without the bear-market burner.
    hazardDirectionAt: () => null,
    requestReplan: (_enemyId, tick) => {
      if (Number.isInteger(tick) && tick >= 0) enemyFlowReplanRequestedTick = Math.max(enemyFlowReplanRequestedTick, tick);
    },
    flowDirectionAt: (x, y) => sampleFlowDirection(grid, enemyFlowField, x, y),
  });
  const awardComboXp = (snapshot, tick) => {
    const feedback = resolveComboFeedback({ previous: runCombo, current: runCombo + 1 });
    runCombo = feedback.current;
    maxRunCombo = Math.max(maxRunCombo, runCombo);
    const baseXp = comboMilestoneXp(feedback.current);
    return baseXp ? grantRunXp(runProgression, baseXp, tick) : snapshot;
  };
  // applySelectedUpgrade with the first offered card, as the bench auto-pick does.
  const takeUpgrades = () => {
    let snapshot = getRunProgressionSnapshot(runProgression);
    if (snapshot.pendingLevels > 0 && snapshot.pendingChoices.length > 0) recordRunUpgradeOffer(runSummary, snapshot.pendingChoices.map((choice) => choice.id));
    while (snapshot.pendingLevels > 0 && snapshot.pendingChoices.length > 0) {
      const upgradeId = snapshot.pendingChoices[0].id;
      const before = snapshot;
      const selection = selectRunUpgrade(runProgression, upgradeId);
      recordRunUpgradeSelection(runSummary, upgradeId);
      const healthGain = selection.effects.maxHealthBonus - before.effects.maxHealthBonus;
      if (healthGain > 0) { maxPlayerHealth += healthGain; playerHealth = Math.min(maxPlayerHealth, playerHealth + healthGain); }
      upgradesTaken += 1;
      snapshot = selection.snapshot;
      if (snapshot.pendingLevels > 0 && snapshot.pendingChoices.length > 0) recordRunUpgradeOffer(runSummary, snapshot.pendingChoices.map((choice) => choice.id));
    }
  };

  const stream = new BitHasher();
  const idHash = new Map();
  const checkpoints = [];
  const counters = { kills: 0, environmentalKills: 0, enemyAttackEvents: 0, projectilesSpawned: 0, directorInsertions: 0, maxEnemies: enemies.length, minEnemies: enemies.length, maxProjectiles: 0 };

  const snapshotState = (tick) => ({
    tick,
    actor: { x: actor.x, y: actor.y, groundZ: actor.groundZ, vx: actor.vx, vy: actor.vy, heading: actor.heading },
    motion,
    aimState,
    enemies: enemies.map(({ collisionBody, ...enemy }) => enemy),
    population: { activeThreat: enemyPopulation.activeThreat, insertedCount: enemyPopulation.insertedCount, retiredCount: enemyPopulation.retiredCount, rejectedCount: enemyPopulation.rejectedCount },
    projectiles: activeProjectiles.map(({ trigger, ...shot }) => shot),
    weaponLoadout,
    meleeState,
    progression: getRunProgressionSnapshot(runProgression),
    silver: silverDropAccounting(silverDropState),
    director: encounterDirector,
    random: { encounters: simulation.getRandomState('encounters'), drops: simulation.getRandomState('drops') },
    runKills, runCombo, maxRunCombo, playerHealth, maxPlayerHealth, droppedProjectiles, upgradesTaken,
  });

  simulation.onStep(({ tick, dtSeconds, input: tickInput }) => {
    const previousActor = { x: actor.x, y: actor.y, groundZ: actor.groundZ };
    for (const enemy of enemies) {
      enemy.previousX = enemy.x;
      enemy.previousY = enemy.y;
      enemy.previousGroundZ = enemy.groundZ;
    }
    const aimIntent = resolveAimIntent(aimState, {
      tick,
      actor: motion,
      input: tickInput,
      targets: enemies,
      device: tickInput.aimDevice ?? 'pointer',
      lineOfSight: (candidate) => traceHeightAwareLineOfSight({
        from: { x: motion.x, y: motion.y, z: actor.groundZ + PROJECTILE_FLIGHT_HEIGHT },
        to: { x: candidate.x, y: candidate.y, z: candidate.groundZ + PROJECTILE_FLIGHT_HEIGHT },
        blockers: WORLD_BLOCKERS,
      }).clear,
    });
    const movementStart = { x: motion.x, y: motion.y, z: actor.groundZ };
    const runEffects = getRunProgressionSnapshot(runProgression).effects;
    const progressionByWeapon = buildProgressionByWeapon(runProgression.ranks);

    // ---- hero movement (non-dash branch) ----
    const currentGround = queryGround(motion.x, motion.y);
    const moveMagnitude = Math.hypot(tickInput.move.x, tickInput.move.y);
    let terrainSpeedMultiplier = 1;
    if (moveMagnitude > 0.001) {
      const probeDistance = Math.max(8, motion.maxSpeed * dtSeconds);
      terrainSpeedMultiplier = movementSpeedMultiplierForTransition(currentGround, queryGround(
        motion.x + tickInput.move.x / moveMagnitude * probeDistance,
        motion.y + tickInput.move.y / moveMagnitude * probeDistance,
      ), probeDistance);
    }
    const playerHazardField = worldHazardField(LEVEL_ONE_WORLD.interactions.hazards, { x: motion.x, y: motion.y, groundZ: currentGround.groundZ });
    stepPlayerMovement(motion, { move: tickInput.move, aim: { ...aimIntent.direction, active: true } }, {
      dtSeconds,
      speedMultiplier: terrainSpeedMultiplier * 1 * runEffects.moveSpeedMultiplier * playerHazardField.speed,
    });
    const pressure = resolveEnemyPressure({ x: motion.x, y: motion.y, radius: 24, velocity: { x: motion.vx, y: motion.vy } }, enemies);
    motion.x += pressure.playerDelta.x;
    motion.y += pressure.playerDelta.y;
    const pressureSpeed = Math.hypot(motion.vx, motion.vy);
    motion.vx = pressure.allowedVelocity.x * pressureSpeed;
    motion.vy = pressure.allowedVelocity.y * pressureSpeed;
    for (const enemy of enemies) {
      const delta = pressure.enemyDeltas.get(enemy.id);
      if (delta) { enemy.x += delta.x; enemy.y += delta.y; }
    }
    motion.x += playerHazardField.drift.x * dtSeconds;
    motion.y += playerHazardField.drift.y * dtSeconds;
    const lastCollision = resolveSweptCircleMotion({
      body: playerBody, start: movementStart, delta: { x: motion.x - movementStart.x, y: motion.y - movementStart.y },
      blockers: WORLD_BLOCKERS, bounds: WORLD_BOUNDS, priorZeroDisplacementFrames: zeroDisplacementFrames,
    });
    motion.x = lastCollision.position.x;
    motion.y = lastCollision.position.y;
    const lastTraversal = resolveSweptTraversalPath({ start: movementStart, end: lastCollision.position, queryGround, maxSampleDistance: Math.max(4, playerBody.radius * 0.5) });
    motion.x = lastTraversal.position.x;
    motion.y = lastTraversal.position.y;
    lastGround = lastTraversal.ground;
    if (!lastTraversal.allowed) { motion.vx = 0; motion.vy = 0; motion.recoilVx = 0; motion.recoilVy = 0; }
    zeroDisplacementFrames = lastCollision.telemetry.zeroDisplacementFrames;
    for (const enemy of enemies) enemy.groundZ = queryGround(enemy.x, enemy.y).groundZ;
    for (const contact of lastCollision.contacts) {
      const inwardVelocity = motion.vx * contact.normal.x + motion.vy * contact.normal.y;
      if (inwardVelocity < 0) { motion.vx -= contact.normal.x * inwardVelocity; motion.vy -= contact.normal.y * inwardVelocity; }
      const inwardRecoil = motion.recoilVx * contact.normal.x + motion.recoilVy * contact.normal.y;
      if (inwardRecoil < 0) { motion.recoilVx -= contact.normal.x * inwardRecoil; motion.recoilVy -= contact.normal.y * inwardRecoil; }
    }
    actor.x = motion.x;
    actor.y = motion.y;
    actor.groundZ = lastGround.groundZ;
    actor.z = lastGround.groundZ;
    actor.vx = motion.vx;
    actor.vy = motion.vy;
    actor.heading = Math.atan2(aimIntent.direction.y, aimIntent.direction.x);
    if (tick % 6 === 0 && revealLevelOneAt(revealState, actor) > 0) revealSnapshot = getLevelOneRevealSnapshot(revealState);

    // ---- pacing + director ----
    const worldPacing = stepWorldDesignPacing(worldPacingState, { tick, player: actor, enemies, arenas: LEVEL_ONE_WORLD.encounterArenas });
    if (!crowd) {
      const step = stepEncounterDirector({
        state: encounterDirector,
        worldRecovery: worldPacing.recovery,
        population: enemyPopulation,
        tick,
        districtId: getLevelOneDistrictAt(actor.x, actor.y)?.id ?? 'frontier-relay',
        player: { x: actor.x, y: actor.y, groundZ: actor.groundZ },
        camera: directorViewBounds({ x: actor.x, y: actor.y }),
        spawnPoints: LEVEL_ONE_WORLD.spawnPoints,
        nearRewardPoi: LEVEL_ONE_WORLD.pointsOfInterest.some((poi) => poi.hook === 'reward' && Math.hypot(actor.x - poi.anchor.x, actor.y - poi.anchor.y) <= 240),
        queryGround,
        isBlocked: spawnPointBlocked,
        isRouteReachable: (point) => point.routeValid === true,
        visualMode: 'normal',
      });
      if (step.inserted) counters.directorInsertions += 1;
    }

    // ---- enemy movement ----
    if (crowd || openingEnemyMovementEnabled(tick)) {
      if (enemyFlowField === null || tick - enemyFlowFieldTick >= ENEMY_FLOW_REFRESH_TICKS || enemyFlowReplanRequestedTick > enemyFlowFieldTick) {
        enemyFlowField = computeEnemyFlowField({ grid, targetX: actor.x, targetY: actor.y });
        enemyFlowFieldTick = tick;
        enemyFlowReplanRequestedTick = -1;
      }
      stepEnemyPopulation({
        population: enemyPopulation,
        player: { x: actor.x, y: actor.y, groundZ: actor.groundZ },
        tick,
        dtSeconds,
        blockers: WORLD_BLOCKERS,
        bounds: WORLD_BOUNDS,
        queryGround,
        preservePrevious: true,
        navigation,
        fullAiCap: encounterSnapshot(tick).fullAiCap,
        fieldAt: (x, y, ground) => worldHazardField(LEVEL_ONE_WORLD.interactions.hazards, { x, y, groundZ: ground.groundZ }),
      });
    }

    // ---- hurt targets ----
    const hurtTargets = [];
    const meleeTargets = [];
    for (const enemy of enemies) {
      if (!enemy.active || enemy.health <= 0) continue;
      const profile = createOrdinaryEnemyHurtboxProfile(enemy.radius);
      hurtTargets.push(createHurtTarget({
        id: enemy.id, bodyShape: profile.bodyShape, hurtShape: profile.projectileShape,
        previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
        currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
        minZ: profile.minZ, maxZ: profile.maxZ, health: enemy.health,
      }));
      meleeTargets.push(createMeleeTarget({
        id: enemy.id,
        previousGround: { x: enemy.previousX, y: enemy.previousY, z: enemy.previousGroundZ },
        currentGround: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
        radius: profile.meleeRadius, minZ: profile.minZ, maxZ: profile.maxZ,
      }));
    }
    const combatHitIntents = [];
    // evidenceSafe: the hero is invulnerable, so hazards only see enemies.
    const bossHazardCap = { targetId: 'boss-liquidator', health: 0 };
    combatHitIntents.push(...withholdLethalHazardHits(buildWorldHazardHits(LEVEL_ONE_WORLD.interactions.hazards, { tick, targets: [...enemies], queryGround }), bossHazardCap));

    const silverCollected = stepSilverDrops(silverDropState, {
      tick,
      player: actor,
      canReach: (p) => Math.abs(queryGround(p.x, p.y).groundZ - actor.groundZ) <= 8 && traceHeightAwareLineOfSight({
        from: { x: actor.x, y: actor.y, z: actor.groundZ + 8 },
        to: { x: p.x, y: p.y, z: queryGround(p.x, p.y).groundZ + 8 },
        blockers: WORLD_BLOCKERS,
      }).clear,
    });
    if (silverCollected > 0) grantRunSilver(runProgression, silverCollected, tick);

    // ---- projectiles ----
    const steppedProjectiles = activeProjectiles.map((shot) => {
      const previous = Object.freeze({ x: shot.previousX ?? shot.x, y: shot.previousY ?? shot.y, z: shot.previousZ ?? shot.z });
      const flight = planProjectileFlightStep({
        previous, velocity: { x: shot.vx, y: shot.vy }, dtSeconds,
        previousGroundZ: shot.groundZ ?? queryGround(previous.x, previous.y).groundZ,
        queryGround, flightHeight: PROJECTILE_FLIGHT_HEIGHT, flightCeilingZ: shot.flightCeilingZ,
      });
      const current = flight.current;
      const pierced = shot.pierceHitIds?.length ?? 0;
      const state = createProjectileState({
        id: shot.id, ownerId: 'player', previous, current, heightTransition: flight.heightTransition,
        radius: shot.radius, damage: shot.damage,
        policy: pierced > 0 ? { ...shot.policy, maxTargets: Math.max(1, shot.policy.maxTargets - pierced) } : shot.policy,
        excludeTargetIds: pierced > 0 ? shot.pierceHitIds : null,
        damageScale: laneDamageScale({ traveled: Math.max(0, (shot.range ?? 0) - shot.remainingRange), range: shot.range ?? 0, falloff: shot.policy?.falloff ?? null }),
      });
      return {
        ...shot, previousX: null, previousY: null, previousZ: null,
        x: current.x, y: current.y, z: current.z, groundZ: flight.groundZ,
        remainingRange: shot.remainingRange - Math.hypot(current.x - previous.x, current.y - previous.y),
        state,
      };
    });
    if (steppedProjectiles.length > 0) {
      const broadphase = hurtTargets.length >= PROJECTILE_GRID_THRESHOLD ? new UniformHurtboxGrid({ targets: hurtTargets, cellSize: 96 }) : null;
      const batch = resolveProjectileBatch({ projectiles: steppedProjectiles.map((shot) => shot.state), targets: hurtTargets, blockers: WORLD_BLOCKERS, broadphase });
      const shotById = new Map(steppedProjectiles.map((shot) => [shot.id, shot]));
      for (const resolution of batch.resolutions) {
        const shot = shotById.get(resolution.projectileId);
        recordRunProjectileResolution(runSummary, shot, resolution.hits);
        for (const hit of resolution.hits) {
          combatHitIntents.push({
            id: `${shot.id}:${hit.targetId}:${hit.kind}`, tick, time: hit.time, targetId: hit.targetId, sourceId: 'player',
            weaponId: shot.weaponId, damage: hit.damage,
            criticalChance: Math.min(CRITICAL_CHANCE_CAP, BASE_CRITICAL_CHANCE + runEffects.criticalChanceBonus),
            criticalMultiplier: BASE_CRITICAL_MULTIPLIER + runEffects.criticalDamageBonus,
            armorPiercing: shot.projectileTag === 'armor-piercing',
            armorPenetration: 0,
            direction: { x: shot.vx, y: shot.vy },
            knockback: (WEAPON_KNOCKBACK[shot.weaponId] ?? 6) * shot.knockbackMultiplier,
            point: hit.point,
          });
        }
      }
      const terminalIds = new Set();
      for (const resolution of batch.resolutions) {
        if (resolution.coverHit) { terminalIds.add(resolution.projectileId); continue; }
        if (resolution.hits.length === 0) continue;
        const shot = shotById.get(resolution.projectileId);
        if (shot?.pierceHitIds && shot.policy?.type === 'pierce') {
          for (const hit of resolution.hits) if (!shot.pierceHitIds.includes(hit.targetId)) shot.pierceHitIds.push(hit.targetId);
          if (shot.pierceHitIds.length < shot.policy.maxTargets) continue;
        }
        terminalIds.add(resolution.projectileId);
      }
      activeProjectiles = steppedProjectiles.filter((shot) => !terminalIds.has(shot.id)
        && shot.remainingRange > 0
        && shot.x >= WORLD_BOUNDS.minX && shot.x <= WORLD_BOUNDS.maxX
        && shot.y >= WORLD_BOUNDS.minY && shot.y <= WORLD_BOUNDS.maxY);
    } else {
      activeProjectiles = [];
    }

    // ---- weapons ----
    const currentAutomaticTargetIds = enemies.filter((enemy) => enemy.active && enemy.health > 0
      && (enemy.disposition !== 'ambient' || enemy.provoked === true || enemy.eventHostile === true)).map((enemy) => enemy.id).sort();
    const weaponFrame = stepWeaponLoadout(weaponLoadout, {
      tick,
      fire: aimIntent.fire,
      releaseCharged: aimState.autoFireEnabled,
      direction: aimIntent.direction,
      progressionByWeapon,
      channelOrigin: { x: actor.x, y: actor.y, z: actor.groundZ + PROJECTILE_FLIGHT_HEIGHT },
      channelTargets: enemies.filter((enemy) => enemy.active),
      channelProvokesAmbient: !aimIntent.automatic,
      currentEligibleTargetIds: currentAutomaticTargetIds,
      channelLineOfSight: (from, to) => traceHeightAwareLineOfSight({
        from: { x: from.x, y: from.y, z: Number.isFinite(from.z) ? from.z : (from.groundZ ?? queryGround(from.x, from.y).groundZ) + PROJECTILE_FLIGHT_HEIGHT },
        to: { x: to.x, y: to.y, z: Number.isFinite(to.z) ? to.z : (to.groundZ ?? queryGround(to.x, to.y).groundZ) + PROJECTILE_FLIGHT_HEIGHT },
        blockers: WORLD_BLOCKERS,
      }).clear,
      channelStopReason: '',
      meleeOrigin: { x: actor.x, y: actor.y, z: actor.groundZ },
      meleeTargets,
      meleeBlockers: WORLD_BLOCKERS,
      meleeDownwardDropDirection: lastGround.oneWayDrop,
    });
    for (const event of weaponFrame.events) recordRunWeaponLifecycleEvent(runSummary, event);
    for (const event of weaponFrame.events.filter((candidate) => candidate.type === 'weapon:fire')) {
      applyRecoilImpulse(motion, { direction: { x: -aimIntent.direction.x, y: -aimIntent.direction.y }, magnitude: event.recoil });
      recordRunWeaponFire(runSummary, { weaponId: event.weaponId, emitted: Math.min(event.shots.length, MAX_ACTIVE_PROJECTILES - activeProjectiles.length), attackId: event.attackId });
      const trigger = { contacted: false };
      for (const shot of event.shots) {
        if (activeProjectiles.length >= MAX_ACTIVE_PROJECTILES) { droppedProjectiles += 1; continue; }
        const muzzle = { x: actor.x + shot.direction.x * 28, y: actor.y + shot.direction.y * 28, z: actor.groundZ + PROJECTILE_FLIGHT_HEIGHT };
        activeProjectiles.push({
          id: shot.id, attackId: event.attackId, trigger, weaponId: event.weaponId,
          previousX: actor.x, previousY: actor.y, previousZ: actor.groundZ + PROJECTILE_FLIGHT_HEIGHT,
          x: muzzle.x, y: muzzle.y, z: muzzle.z, groundZ: actor.groundZ, flightCeilingZ: muzzle.z,
          vx: shot.direction.x * shot.speed, vy: shot.direction.y * shot.speed,
          radius: shot.radius, damage: shot.damage * 1, policy: shot.policy,
          pierceHitIds: shot.policy?.type === 'pierce' ? [] : null,
          projectileTag: shot.projectileTag ?? null, shock: shot.shock, knockbackMultiplier: shot.knockbackMultiplier,
          range: shot.range, remainingRange: shot.range,
        });
        counters.projectilesSpawned += 1;
      }
    }
    const meleeFrame = stepMeleeState(meleeState, {
      tick,
      automatic: weaponLoadout.activeWeaponId !== 'forked-standard',
      origin: { x: actor.x, y: actor.y },
      direction: aimIntent.direction,
      sourceGroundZ: actor.groundZ,
      targets: meleeTargets,
      blockers: WORLD_BLOCKERS,
      downwardDropDirection: lastGround.oneWayDrop,
    });
    combatHitIntents.push(...meleeFrame.hits.map((hit) => ({ ...hit, damage: hit.damage * 1 })));
    if (meleeFrame.attacked) {
      recordRunWeaponFire(runSummary, { weaponId: 'litecoin-knife', emitted: 1 });
      if (meleeFrame.hits.length > 0) {
        recordRunWeaponTriggerContact(runSummary, { weaponId: 'litecoin-knife' });
        recordRunProjectileContacts(runSummary, { weaponId: 'litecoin-knife', count: meleeFrame.hits.length });
      }
    }

    // ---- enemy attacks (resolved against the invulnerable hero) ----
    if (crowd || openingEnemyAttacksEnabled(tick)) {
      const attack = stepEnemyAttacks({
        enemies,
        player: { id: 'player', x: actor.x, y: actor.y, groundZ: actor.groundZ, radius: playerBody.radius },
        tick,
        budgets: encounterSnapshot(tick).attackTokens,
      });
      counters.enemyAttackEvents += attack.events.length;
      for (const event of attack.events) {
        const resolved = resolveEnemyAttackAgainstPlayer(event, {
          player: { id: 'player', x: actor.x, y: actor.y, groundZ: actor.groundZ, radius: playerBody.radius },
          invulnerable: true,
          blockers: WORLD_BLOCKERS,
        });
        if (resolved.hit) throw new Error('an invulnerable evidence hero was hit');
      }
    }

    discoverMinimapPointsOfInterest({ discovery: minimapDiscovery, player: actor, pointsOfInterest: LEVEL_ONE_WORLD.pointsOfInterest });
    recordRunTick(runSummary, {
      tick,
      position: actor,
      activeWeaponId: weaponLoadout.activeWeaponId,
      districtId: getLevelOneDistrictAt(actor.x, actor.y)?.id ?? 'frontier-relay',
      discoveredPoiIds: minimapDiscovery.discoveredPoiIds,
      activeEffectIds: [],
      level: runProgression.level,
      bossEngaged: false,
    });

    // ---- combat resolution ----
    const authoritative = combatHitIntents.map((hit) => (hit.sourceId === 'player' && hit.targetId !== 'player'
      ? { ...hit, damage: hit.damage * runEffects.outgoingDamageMultiplier }
      : hit));
    if (authoritative.length > 0) {
      const combatTargets = enemies.filter((enemy) => enemy.active && enemy.health > 0).map((enemy) => ({
        id: enemy.id, health: enemy.health, maxHealth: enemy.maxHealth, armor: enemy.armor,
        shieldCharges: enemy.shieldCharges, knockbackResistance: enemy.knockbackResistance,
      }));
      combatTargets.push({ id: 'player', health: playerHealth, maxHealth: maxPlayerHealth, armor: 1, shieldCharges: 0, knockbackResistance: 1 });
      const resolution = resolveCombatHits({ sessionSeed: seed, hits: authoritative, targets: combatTargets });
      for (const enemy of enemies) {
        const state = resolution.targets[enemy.id];
        if (!state) continue;
        enemy.health = state.health;
        enemy.shieldCharges = state.shieldCharges;
        if (!state.active || state.health <= 0) { enemy.active = false; enemy.targetable = false; }
      }
      if (resolution.targets.player) playerHealth = resolution.targets.player.health;
      for (const damageEvent of resolution.damageEvents) {
        if (damageEvent.damageApplied <= 0) continue;
        recordRunDamage(runSummary, damageEvent);
        if (damageEvent.targetId === 'player') continue;
        const enemy = enemies.find((candidate) => candidate.id === damageEvent.targetId);
        if (!enemy) continue;
        enemy.hitUntilTick = tick + 6;
        const knockbackCollision = resolveSweptCircleMotion({
          body: enemy.collisionBody, start: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
          delta: damageEvent.knockback, blockers: WORLD_BLOCKERS, bounds: WORLD_BOUNDS,
        });
        const knockbackTraversal = resolveSweptTraversalPath({
          start: { x: enemy.x, y: enemy.y, z: enemy.groundZ }, end: knockbackCollision.position,
          queryGround, maxSampleDistance: Math.max(4, enemy.radius * 0.5),
        });
        enemy.x = knockbackTraversal.position.x;
        enemy.y = knockbackTraversal.position.y;
        enemy.groundZ = knockbackTraversal.ground.groundZ;
      }
      for (const scoreEvent of resolution.scoreEvents) {
        if (WORLD_ENVIRONMENT_WEAPON_IDS.has(scoreEvent.weaponId)) {
          const enemy = enemies.find((candidate) => candidate.id === scoreEvent.enemyId);
          if (enemy) {
            retireEnemyFromPopulation(enemyPopulation, enemy.id, { tick, reason: 'defeated' });
            counters.environmentalKills += 1;
          }
          continue;
        }
        const defeatedEnemy = enemies.find((enemy) => enemy.id === scoreEvent.enemyId);
        if (!defeatedEnemy) continue;
        recordRunKill(runSummary, { enemyRoleId: defeatedEnemy.archetypeId, weaponId: scoreEvent.weaponId, elite: false });
        runKills += 1;
        counters.kills += 1;
        addSilverDrop(silverDropState, { sequence: runKills, tick, x: defeatedEnemy.x, y: defeatedEnemy.y });
        awardComboXp(recordRunDefeat(runProgression, {
          enemyId: defeatedEnemy.id,
          threatCost: ENEMY_ARCHETYPES[defeatedEnemy.archetypeId].costs.threat,
          tick,
        }), tick);
        retireEnemyFromPopulation(enemyPopulation, scoreEvent.enemyId, { tick, reason: 'defeated' });
      }
    }
    takeUpgrades();

    // ---- exact-bit fold of the tick's state ----
    stream.num(tick);
    stream.num(actor.x); stream.num(actor.y); stream.num(actor.groundZ); stream.num(motion.vx); stream.num(motion.vy);
    stream.num(motion.recoilVx); stream.num(motion.recoilVy);
    stream.num(enemies.length);
    for (const enemy of enemies) {
      let hash = idHash.get(enemy.id);
      if (hash === undefined) {
        const h = new BitHasher();
        h.str(enemy.id);
        hash = h.a;
        idHash.set(enemy.id, hash);
      }
      stream.word(hash);
      stream.num(enemy.x); stream.num(enemy.y); stream.num(enemy.groundZ); stream.num(enemy.health);
      stream.num(enemy.shieldCharges); stream.num(enemy.armor); stream.num(enemy.nextDecisionTick);
      stream.num(enemy.attackPhaseUntilTick); stream.num(enemy.velocity?.x ?? 0); stream.num(enemy.velocity?.y ?? 0);
      stream.str(enemy.attackPhase);
    }
    stream.num(activeProjectiles.length);
    for (const shot of activeProjectiles) { stream.str(shot.id); stream.num(shot.x); stream.num(shot.y); stream.num(shot.z); stream.num(shot.remainingRange); }
    stream.num(runProgression.xp ?? 0); stream.num(runProgression.score ?? 0); stream.num(runProgression.level ?? 0);
    stream.num(runKills); stream.num(runCombo); stream.num(silverDropState.dropped); stream.num(silverDropState.collected);
    counters.maxEnemies = Math.max(counters.maxEnemies, enemies.length);
    counters.minEnemies = Math.min(counters.minEnemies, enemies.length);
    counters.maxProjectiles = Math.max(counters.maxProjectiles, activeProjectiles.length);
    if (tick % checkpointEvery === 0 || tick === ticks) {
      checkpoints.push({ tick, stream: stream.hex(), state: sha256(snapshotState(tick)), enemies: enemies.length, kills: runKills, level: runProgression.level });
    }
  });

  simulation.start();
  const started = performance.now();
  while (simulation.tick < ticks) {
    const frame = simulation.update(simulation.fixedStepMs, EMPTY_INPUT);
    assert.equal(frame.steps, 1, 'the digest advances exactly one fixed step per update');
  }
  const elapsedMs = performance.now() - started;
  const snapshot = getRunProgressionSnapshot(runProgression);
  let evidence;
  try {
    evidence = finalizeRunSummary(runSummary, {
      endTick: simulation.tick,
      elapsedMs: simulation.timeMs,
      terminalReason: 'abandoned',
      score: snapshot.score,
      level: snapshot.level,
      xp: snapshot.xp,
      currentCombo: runCombo,
      maxCombo: maxRunCombo,
      revealedCells: revealSnapshot.revealedCellIds.length,
      totalCells: revealSnapshot.totalCells,
    });
  } catch (error) {
    evidence = { finalizeError: error.message };
  }
  const finalState = snapshotState(simulation.tick);
  const evidenceHash = sha256(evidence);
  const digest = sha256({ stream: stream.hex(), checkpoints, finalState: sha256(finalState), evidenceHash });
  return {
    scenario,
    seed,
    ticks: simulation.tick,
    digest,
    streamHash: stream.hex(),
    evidenceHash,
    evidenceFinalized: !evidence.finalizeError,
    evidenceError: evidence.finalizeError ?? null,
    checkpoints,
    counters: { ...counters, finalEnemies: enemies.length, projectilesDropped: droppedProjectiles, upgradesTaken, level: snapshot.level, score: snapshot.score, xp: snapshot.xp, silver: silverDropAccounting(silverDropState) },
    elapsedMs: Number(elapsedMs.toFixed(1)),
    msPerTick: Number((elapsedMs / simulation.tick).toFixed(4)),
  };
}

export function runSimDigest({ seed = STANDALONE_SEED, ticks = 36_000, scenarios = ['crowd', 'director'], checkpointEvery = 6_000 } = {}) {
  const results = scenarios.map((scenario) => runSimDigestScenario({ scenario, seed, ticks, checkpointEvery }));
  // The existing 128-body synthetic-arena soak (enemy-simulation, enemy-combat,
  // projectile-physics, weapon-system) rides along as a cheap second witness.
  const enduranceSoak = runEnemyEnduranceSoak({ seed: 1337, activeEnemies: 128, cycles: 2, ticksPerCycle: 180, fixedStepsPerFrame: 4 }).stateDigest;
  return {
    schema: 'hmh-sim-digest-v1',
    seed,
    ticks,
    combined: sha256({ results: results.map(({ scenario, digest }) => ({ scenario, digest })), enduranceSoak }),
    enduranceSoak,
    scenarios: results,
  };
}

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`unrecognised argument ${arg}`);
    options[match[1]] = match[2] ?? true;
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const ticks = Number(options.ticks ?? 36_000);
  const seed = Number(options.seed ?? STANDALONE_SEED);
  const scenarios = options.scenario ? [String(options.scenario)] : ['crowd', 'director'];
  const result = runSimDigest({ seed, ticks, scenarios, checkpointEvery: Number(options.checkpoint ?? 6_000) });
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`hmh-sim-digest seed=${seed} ticks=${ticks}`);
    for (const scenario of result.scenarios) {
      console.log(`${scenario.scenario.padEnd(8)} ${scenario.digest}  kills=${scenario.counters.kills} enemies=${scenario.counters.finalEnemies} level=${scenario.counters.level} ${scenario.msPerTick} ms/tick`);
    }
    console.log(`endurance-soak ${result.enduranceSoak}`);
    console.log(`combined ${result.combined}`);
  }
}
