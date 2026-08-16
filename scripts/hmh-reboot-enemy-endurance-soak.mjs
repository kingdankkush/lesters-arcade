import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
import { getEnemyArchetype } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { stepEnemyAttacks } from '../apps/hmh-reboot/src/enemy-combat.mjs';
import {
  ENCOUNTER_BANDS,
  getEncounterSnapshot,
  selectEncounterArchetype,
} from '../apps/hmh-reboot/src/encounter-director.mjs';
import {
  ENEMY_CAPACITY,
  MAX_ENEMY_SEPARATION_STEP,
  createEnemyPopulation,
  createEnemyState,
  stepEnemyPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import {
  createProjectileState,
  planProjectileFlightStep,
  resolveProjectileBatch,
} from '../apps/hmh-reboot/src/projectile-physics.mjs';
import {
  MAX_ACTIVE_PROJECTILES,
  MAX_COMBAT_VISUAL_EVENTS,
  RUNTIME_PRESSURE_LIMITS,
  compactExpiredEventsInPlace,
} from '../apps/hmh-reboot/src/runtime-performance.mjs';
import {
  createWeaponLoadout,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

const TICKS_PER_SECOND = 60;
const ENDURANCE_START_TICK = ENCOUNTER_BANDS.find((band) => band.id === 'endurance').minTick;
const PLAYER = Object.freeze({ id: 'benchmark-player', x: 0, y: 0, groundZ: 0, radius: 24 });
const BOUNDS = Object.freeze({
  minX: -1_200,
  minY: -1_200,
  maxX: 1_200,
  maxY: 1_200,
  visibleBoundaryId: 'endurance-soak-bounds',
});
const BLOCKERS = Object.freeze([createStaticBlocker({
  id: 'endurance-soak-visible-wall',
  shape: {
    type: 'polygon',
    vertices: [
      { x: 120, y: -180 },
      { x: 144, y: -180 },
      { x: 144, y: 180 },
      { x: 120, y: 180 },
    ],
  },
  visibleAssetId: 'endurance-soak-visible-wall-art',
  minZ: 0,
  maxZ: 96,
})]);
const GROUND = createAuthoredGroundQuery({
  baseSurface: createElevationSurface({
    id: 'endurance-soak-ground',
    kind: 'ground',
    area: { type: 'rect', ...BOUNDS },
    groundZ: 0,
    visibleTerrainId: 'endurance-soak-ground-art',
    priority: 0,
  }),
});

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function unsignedSeed(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  return value >>> 0;
}

function hashInt(hash, value) {
  return Math.imul(hash ^ (value >>> 0), 16777619) >>> 0;
}

function hashString(hash, value) {
  let next = hash;
  for (const character of String(value)) next = hashInt(next, character.charCodeAt(0));
  return next;
}

function updateDigest(hash, value, scale = 1) {
  return hashInt(hash, Math.round(Number(value) * scale));
}

function createRoster({ activeEnemies, seed }) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: activeEnemies }, (_, index) => {
    const forcedBlockerPilot = index < 8;
    const archetypeId = forcedBlockerPilot
      ? 'bagholder-rusher'
      : selectEncounterArchetype({
        districtId: 'mining-camp',
        bandId: 'endurance',
        spawnOrdinal: index - 8,
        seed,
      }).archetypeId;
    const archetype = getEnemyArchetype(archetypeId);
    const phase = (seed % 997) / 997 * Math.PI * 2;
    const angle = phase + index * goldenAngle;
    const attackDistance = Math.max(archetype.radius + PLAYER.radius + 8, Math.min(
      archetype.preferredDistance,
      archetype.attack.range - 8,
    ));
    const radialJitter = ((Math.imul(index + 1, 1103515245) + seed) >>> 28) - 8;
    const radius = Math.max(archetype.radius + PLAYER.radius + 8, attackDistance + radialJitter);
    const x = forcedBlockerPilot ? 260 + (index % 2) * 8 : Math.cos(angle) * radius;
    const y = forcedBlockerPilot ? -140 + index * 40 : Math.sin(angle) * radius;
    return createEnemyState({
      archetypeId,
      id: `soak-${String(index).padStart(3, '0')}`,
      x,
      y,
      groundZ: 0,
      visualMode: 'prototype',
    });
  });
}

function stepProjectilePressure(activeProjectiles, tick) {
  const stepped = activeProjectiles.map((shot) => {
    const previous = Object.freeze({ x: shot.x, y: shot.y, z: shot.z });
    const flight = planProjectileFlightStep({
      previous,
      velocity: { x: shot.vx, y: shot.vy },
      dtSeconds: 1 / TICKS_PER_SECOND,
      previousGroundZ: shot.groundZ,
      queryGround: GROUND,
      flightHeight: 34,
      flightCeilingZ: shot.flightCeilingZ,
    });
    return {
      ...shot,
      x: flight.current.x,
      y: flight.current.y,
      z: flight.current.z,
      groundZ: flight.groundZ,
      remainingRange: shot.remainingRange - Math.hypot(flight.current.x - previous.x, flight.current.y - previous.y),
      state: createProjectileState({
        id: shot.id,
        ownerId: PLAYER.id,
        previous,
        current: flight.current,
        heightTransition: flight.heightTransition,
        radius: shot.radius,
        damage: shot.damage,
        policy: shot.policy,
      }),
    };
  });
  if (stepped.length === 0) return [];
  const batch = resolveProjectileBatch({ projectiles: stepped.map((shot) => shot.state), targets: [], blockers: [] });
  const terminalIds = new Set(batch.resolutions
    .filter((resolution) => resolution.hits.length > 0 || resolution.coverHit)
    .map((resolution) => resolution.projectileId));
  return stepped.filter((shot) => !terminalIds.has(shot.id)
    && shot.remainingRange > 0
    && shot.x >= BOUNDS.minX && shot.x <= BOUNDS.maxX
    && shot.y >= BOUNDS.minY && shot.y <= BOUNDS.maxY)
    .map(({ state: _state, ...shot }) => shot);
}

function appendWeaponProjectiles(activeProjectiles, weaponFrame, totals) {
  for (const event of weaponFrame.events) {
    if (event.type !== 'weapon:fire') continue;
    for (const shot of event.shots) {
      if (activeProjectiles.length >= MAX_ACTIVE_PROJECTILES) {
        totals.projectileDrops += 1;
        continue;
      }
      activeProjectiles.push({
        id: shot.id,
        x: PLAYER.x,
        y: PLAYER.y,
        z: 34,
        groundZ: 0,
        flightCeilingZ: 34,
        vx: shot.direction.x * shot.speed,
        vy: shot.direction.y * shot.speed,
        remainingRange: shot.range,
        radius: shot.radius,
        damage: shot.damage,
        policy: shot.policy,
      });
      totals.projectileSpawns += 1;
    }
  }
}

function pushEffect(effects, event, totals) {
  if (effects.length >= MAX_COMBAT_VISUAL_EVENTS) {
    effects.shift();
    totals.effectDrops += 1;
  }
  effects.push(Object.freeze(event));
  totals.effectInsertions += 1;
}

export function runEnemyEnduranceSoak({
  seed = 0,
  activeEnemies = 128,
  cycles = 2,
  ticksPerCycle = 180,
  fixedStepsPerFrame = 1,
} = {}) {
  const normalizedSeed = unsignedSeed(seed);
  positiveInteger(activeEnemies, 'activeEnemies');
  positiveInteger(cycles, 'cycles');
  positiveInteger(ticksPerCycle, 'ticksPerCycle');
  positiveInteger(fixedStepsPerFrame, 'fixedStepsPerFrame');
  if (activeEnemies < 100 || activeEnemies > ENEMY_CAPACITY) throw new TypeError(`activeEnemies must be between 100 and ${ENEMY_CAPACITY}`);
  if (fixedStepsPerFrame > 4) throw new TypeError('fixedStepsPerFrame cannot exceed the four-step catch-up cap');

  const roster = createRoster({ activeEnemies, seed: normalizedSeed });
  const snapshot = getEncounterSnapshot(ENDURANCE_START_TICK);
  const population = createEnemyPopulation({ capacity: ENEMY_CAPACITY, threatCapacity: snapshot.threatCap });
  population.active.push(...roster);
  population.activeThreat = roster.reduce((sum, enemy) => sum + getEnemyArchetype(enemy.archetypeId).costs.threat, 0);
  const weaponLoadout = createWeaponLoadout({ weaponIds: ['auto-miner'], activeWeaponId: 'auto-miner', seed: normalizedSeed, switchTicks: 0 });
  let activeProjectiles = [];
  const effects = [];
  const cycleRows = Array.from({ length: cycles }, (_, index) => ({
    cycle: index + 1,
    attackEvents: 0,
    projectilePeak: 0,
    effectPeak: 0,
  }));
  const totals = {
    safetySteps: 0,
    collisionContacts: 0,
    traversalBlocks: 0,
    attackEvents: 0,
    projectileSpawns: 0,
    projectileDrops: 0,
    effectInsertions: 0,
    effectDrops: 0,
    teleportViolations: 0,
  };
  const maxima = {
    bodies: population.active.length,
    threat: population.activeThreat,
    attackTokens: 0,
    attackTokensByFamily: { melee: 0, ranged: 0, area: 0, support: 0 },
    projectiles: 0,
    effects: 0,
    enemyStepDistance: 0,
  };
  const attackTokenLimit = Object.values(snapshot.attackTokens).reduce((sum, value) => sum + value, 0);
  const fastestEnemySpeed = Math.max(...roster.map((enemy) => getEnemyArchetype(enemy.archetypeId).speed));
  const maxEnemyStepDistance = MAX_ENEMY_SEPARATION_STEP + fastestEnemySpeed / TICKS_PER_SECOND;
  const totalTicks = cycles * ticksPerCycle;
  let stateDigest = 2166136261;

  for (let frameStart = 0; frameStart < totalTicks; frameStart += fixedStepsPerFrame) {
    const frameSteps = Math.min(fixedStepsPerFrame, totalTicks - frameStart);
    for (let fixedStep = 0; fixedStep < frameSteps; fixedStep += 1) {
      const elapsedTick = frameStart + fixedStep;
      const tick = ENDURANCE_START_TICK + elapsedTick;
      const cycleIndex = Math.floor(elapsedTick / ticksPerCycle);
      const before = new Map(population.active.map((enemy) => [enemy.id, { x: enemy.x, y: enemy.y }]));
      const movement = stepEnemyPopulation({
        population,
        player: PLAYER,
        tick,
        dtSeconds: 1 / TICKS_PER_SECOND,
        blockers: BLOCKERS,
        bounds: BOUNDS,
        queryGround: GROUND,
        fullAiCap: snapshot.fullAiCap,
      });
      totals.safetySteps += movement.safetySteps;
      totals.collisionContacts += movement.collisionContacts;
      totals.traversalBlocks += movement.traversalBlocks;
      for (const enemy of population.active) {
        const previous = before.get(enemy.id);
        const displacement = Math.hypot(enemy.x - previous.x, enemy.y - previous.y);
        maxima.enemyStepDistance = Math.max(maxima.enemyStepDistance, displacement);
        if (displacement > maxEnemyStepDistance + 1e-9) totals.teleportViolations += 1;
      }

      const attack = stepEnemyAttacks({
        enemies: population.active,
        player: PLAYER,
        tick,
        budgets: snapshot.attackTokens,
      });
      maxima.attackTokens = Math.max(maxima.attackTokens, attack.tokens.length);
      const occupiedByFamily = { melee: 0, ranged: 0, area: 0, support: 0 };
      for (const token of attack.tokens) occupiedByFamily[token.family] += 1;
      for (const family of Object.keys(occupiedByFamily)) {
        maxima.attackTokensByFamily[family] = Math.max(maxima.attackTokensByFamily[family], occupiedByFamily[family]);
      }
      totals.attackEvents += attack.events.length;
      cycleRows[cycleIndex].attackEvents += attack.events.length;

      compactExpiredEventsInPlace(effects, tick, RUNTIME_PRESSURE_LIMITS.visualEventLifetimeTicks);
      for (const event of attack.events) {
        pushEffect(effects, { type: 'enemy-attack', tick, point: event.target }, totals);
      }

      activeProjectiles = stepProjectilePressure(activeProjectiles, tick);
      const weaponFrame = stepWeaponLoadout(weaponLoadout, {
        tick,
        fire: true,
        direction: { x: 0, y: -1 },
      });
      appendWeaponProjectiles(activeProjectiles, weaponFrame, totals);

      maxima.projectiles = Math.max(maxima.projectiles, activeProjectiles.length);
      maxima.effects = Math.max(maxima.effects, effects.length);
      cycleRows[cycleIndex].projectilePeak = Math.max(cycleRows[cycleIndex].projectilePeak, activeProjectiles.length);
      cycleRows[cycleIndex].effectPeak = Math.max(cycleRows[cycleIndex].effectPeak, effects.length);

      stateDigest = hashInt(stateDigest, attack.tokens.length);
      stateDigest = hashInt(stateDigest, attack.events.length);
      stateDigest = hashInt(stateDigest, activeProjectiles.length);
      stateDigest = hashInt(stateDigest, effects.length);
      for (const enemy of population.active) {
        stateDigest = hashString(stateDigest, enemy.archetypeId);
        stateDigest = updateDigest(stateDigest, enemy.x, 1_000);
        stateDigest = updateDigest(stateDigest, enemy.y, 1_000);
        stateDigest = hashString(stateDigest, enemy.attackPhase);
      }
      for (const shot of activeProjectiles) {
        stateDigest = hashString(stateDigest, shot.id);
        stateDigest = updateDigest(stateDigest, shot.x, 1_000);
        stateDigest = updateDigest(stateDigest, shot.y, 1_000);
      }
    }
  }

  const seedSignature = roster.slice(8, 32).map((enemy) => enemy.archetypeId);
  return Object.freeze({
    benchmark: 'hmh-enemy-endurance-soak-v1',
    seed: normalizedSeed,
    seedSignature: Object.freeze(seedSignature),
    activeEnemies,
    cyclesCompleted: cycles,
    ticksSimulated: totalTicks,
    limits: Object.freeze({
      bodies: ENEMY_CAPACITY,
      threat: snapshot.threatCap,
      directorProjectiles: snapshot.projectileCap,
      directorEffects: snapshot.effectCap,
      attackTokens: attackTokenLimit,
      attackTokensByFamily: snapshot.attackTokens,
      projectiles: MAX_ACTIVE_PROJECTILES,
      effects: MAX_COMBAT_VISUAL_EVENTS,
      maxEnemyStepDistance,
    }),
    maxima: Object.freeze({
      ...maxima,
      attackTokensByFamily: Object.freeze({ ...maxima.attackTokensByFamily }),
    }),
    totals: Object.freeze({ ...totals }),
    cycles: Object.freeze(cycleRows.map((row) => Object.freeze({ ...row }))),
    stateDigest: stateDigest.toString(16).padStart(8, '0'),
  });
}
