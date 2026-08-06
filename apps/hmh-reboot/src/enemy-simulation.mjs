import { freezeDeep } from './value-guards.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from './collision.mjs';
import { resolveSweptTraversalPath } from './elevation.mjs';
import { getEnemyArchetype } from './enemy-archetypes.mjs';

const EPSILON = 1e-9;
export const ENEMY_CAPACITY = 192;
export const AI_LOD_BANDS = Object.freeze([
  Object.freeze({ id: 'near', maxDistance: 640, cadenceTicks: 1 }),
  Object.freeze({ id: 'mid', maxDistance: 1400, cadenceTicks: 3 }),
  Object.freeze({ id: 'far', maxDistance: Infinity, cadenceTicks: 12 }),
]);
export const DEFAULT_ATTACK_TOKEN_BUDGET = Object.freeze({ melee: 3, ranged: 2, area: 1, support: 1 });

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function validId(value, name = 'enemy id') {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}


function normalize(x, y, fallback = { x: 1, y: 0 }) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= EPSILON) return { ...fallback };
  return { x: x / magnitude, y: y / magnitude };
}

function stableSign(id) {
  let hash = 2166136261;
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (hash & 1) === 0 ? 1 : -1;
}

function stableNormal(idA, idB = '') {
  let hash = 2166136261;
  for (const char of `${idA}:${idB}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const angle = (hash / 0x1_0000_0000) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function getEnemyLod(distance) {
  finite(distance, 'distance');
  if (distance < 0) throw new TypeError('distance must be non-negative');
  return AI_LOD_BANDS.find((band) => distance <= band.maxDistance) ?? AI_LOD_BANDS.at(-1);
}

export function createEnemyState({
  archetypeId,
  id,
  x,
  y,
  groundZ = 0,
  visualMode = 'normal',
} = {}) {
  const archetype = getEnemyArchetype(archetypeId);
  const enemyId = validId(id);
  if (!['normal', 'prototype'].includes(visualMode)) throw new TypeError('visualMode must be normal or prototype');
  if (visualMode === 'normal' && !archetype.visual.productionComplete) {
    throw new Error(`${archetype.id} is missing production visual coverage`);
  }
  if (visualMode === 'prototype' && !archetype.visual.prototypeComplete) {
    throw new Error(`${archetype.id} is missing prototype visual coverage`);
  }
  const positionX = finite(x, 'enemy.x');
  const positionY = finite(y, 'enemy.y');
  const z = finite(groundZ, 'enemy.groundZ');
  return {
    id: enemyId,
    archetypeId: archetype.id,
    visualMode,
    kind: 'regular',
    active: true,
    targetable: true,
    x: positionX,
    y: positionY,
    previousX: positionX,
    previousY: positionY,
    groundZ: z,
    previousGroundZ: z,
    radius: archetype.radius,
    health: archetype.maxHealth,
    maxHealth: archetype.maxHealth,
    baseArmor: archetype.armor,
    armor: archetype.armor,
    supportArmorUntilTick: 0,
    shieldCharges: 0,
    knockbackResistance: archetype.knockbackResistance,
    velocity: { x: 0, y: 0 },
    intent: null,
    nextDecisionTick: 1,
    attackPhase: 'ready',
    attackPhaseUntilTick: 0,
    attackRecoveryUntilTick: 0,
    collisionBody: createCollisionBody({
      id: enemyId,
      kind: 'regular',
      radius: archetype.radius,
      minZ: 4,
      maxZ: Math.max(48, archetype.radius * 2),
    }),
  };
}

export function createEnemyPopulation({ capacity = ENEMY_CAPACITY, threatCapacity = 512 } = {}) {
  positiveInteger(capacity, 'population capacity');
  if (capacity > ENEMY_CAPACITY) throw new TypeError(`population capacity cannot exceed ${ENEMY_CAPACITY}`);
  positiveInteger(threatCapacity, 'population threatCapacity');
  return {
    capacity,
    threatCapacity,
    activeThreat: 0,
    active: [],
    seenIds: new Set(),
    insertedCount: 0,
    retiredCount: 0,
    rejectedCount: 0,
  };
}

export function createEnemySpawnSchedule({ nextSpawnTick = 0, intervalTicks = 60, burstRemaining = 1 } = {}) {
  return {
    nextSpawnTick: nonNegativeInteger(nextSpawnTick, 'nextSpawnTick'),
    intervalTicks: positiveInteger(intervalTicks, 'intervalTicks'),
    burstRemaining: nonNegativeInteger(burstRemaining, 'burstRemaining'),
  };
}

export function attemptScheduledEnemyInsertion({
  population,
  schedule,
  candidate,
  tick,
  placementAllowed,
  visualMode = 'normal',
  threatRemaining = null,
} = {}) {
  nonNegativeInteger(tick, 'tick');
  if (!population || !Array.isArray(population.active) || !(population.seenIds instanceof Set)) throw new TypeError('population is required');
  if (!schedule) throw new TypeError('schedule is required');
  if (typeof placementAllowed !== 'boolean') throw new TypeError('placementAllowed must be boolean');
  const reject = (reason) => {
    population.rejectedCount += 1;
    return freezeDeep({ inserted: false, reason, tick });
  };
  if (tick < schedule.nextSpawnTick) return freezeDeep({ inserted: false, reason: 'not-due', tick });
  if (schedule.burstRemaining <= 0) return freezeDeep({ inserted: false, reason: 'burst-complete', tick });
  if (!placementAllowed) return reject('placement-rejected');
  const archetype = getEnemyArchetype(candidate?.archetypeId);
  const id = validId(candidate?.id, 'candidate id');
  if (population.seenIds.has(id) || population.active.some((enemy) => enemy.id === id)) return reject('duplicate-id');
  if (visualMode === 'normal' && !archetype.visual.productionComplete) return reject('visual-incomplete');
  if (visualMode === 'prototype' && !archetype.visual.prototypeComplete) return reject('visual-incomplete');
  if (population.active.length >= population.capacity) return reject('body-capacity');
  const remaining = threatRemaining === null ? population.threatCapacity - population.activeThreat : finite(threatRemaining, 'threatRemaining');
  if (archetype.costs.threat > remaining || population.activeThreat + archetype.costs.threat > population.threatCapacity) return reject('threat-capacity');

  const state = createEnemyState({ ...candidate, visualMode });
  population.active.push(state);
  population.active.sort((a, b) => a.id.localeCompare(b.id));
  population.seenIds.add(state.id);
  population.activeThreat += archetype.costs.threat;
  population.insertedCount += 1;
  schedule.nextSpawnTick = tick + schedule.intervalTicks;
  schedule.burstRemaining -= 1;
  return freezeDeep({ inserted: true, reason: null, tick, enemyId: state.id, archetypeId: state.archetypeId });
}

export function retireEnemyFromPopulation(population, id, { tick, reason = 'retired' } = {}) {
  if (!population || !Array.isArray(population.active) || !(population.seenIds instanceof Set)) throw new TypeError('population is required');
  const enemyId = validId(id, 'enemy id');
  nonNegativeInteger(tick, 'tick');
  if (typeof reason !== 'string' || reason.trim().length === 0) throw new TypeError('retirement reason must be a non-empty string');
  const index = population.active.findIndex((enemy) => enemy.id === enemyId);
  if (index < 0) return freezeDeep({ retired: false, id: enemyId, tick, reason: 'not-active' });
  const [enemy] = population.active.splice(index, 1);
  const archetype = getEnemyArchetype(enemy.archetypeId);
  population.seenIds.add(enemy.id);
  population.activeThreat = Math.max(0, population.activeThreat - archetype.costs.threat);
  population.retiredCount += 1;
  return freezeDeep({ retired: true, id: enemy.id, archetypeId: enemy.archetypeId, tick, reason: reason.trim() });
}

export function planEnemyIntent(enemy, { player, tick, navigation = null } = {}) {
  const archetype = getEnemyArchetype(enemy?.archetypeId);
  nonNegativeInteger(tick, 'tick');
  const dx = finite(player?.x, 'player.x') - finite(enemy?.x, 'enemy.x');
  const dy = finite(player?.y, 'player.y') - finite(enemy?.y, 'enemy.y');
  const distance = Math.hypot(dx, dy);
  let direct = normalize(dx, dy);
  // When authored structure blocks the straight line, pursue along the world
  // flow field instead of pressing into the wall. The field is deterministic
  // simulation state; role modifiers below still shape the final heading.
  if (navigation && typeof navigation.lineBlocked === 'function'
    && navigation.lineBlocked(enemy.x, enemy.y, player.x, player.y)) {
    const flow = navigation.flowDirectionAt?.(enemy.x, enemy.y) ?? null;
    if (flow) direct = normalize(flow.x, flow.y);
  }
  const tangent = { x: -direct.y * stableSign(enemy.id), y: direct.x * stableSign(enemy.id) };
  let direction = direct;
  if (archetype.role === 'flanker') {
    direction = normalize(direct.x * 0.55 + tangent.x * 0.9, direct.y * 0.55 + tangent.y * 0.9);
  } else if (['suppressor', 'demolition', 'support'].includes(archetype.role)) {
    const near = distance < archetype.preferredDistance - 70;
    const far = distance > archetype.preferredDistance + 90;
    if (near) direction = { x: -direct.x, y: -direct.y };
    else if (!far) direction = normalize(tangent.x * 0.82 + direct.x * 0.18, tangent.y * 0.82 + direct.y * 0.18);
  }
  const velocity = { x: direction.x * archetype.speed, y: direction.y * archetype.speed };
  return freezeDeep({
    tick,
    role: archetype.role,
    velocity,
    facing: direction,
    distance,
    lod: getEnemyLod(distance).id,
  });
}

export function allocateAttackTokens({
  enemies,
  player,
  budgets = DEFAULT_ATTACK_TOKEN_BUDGET,
} = {}) {
  if (!Array.isArray(enemies)) throw new TypeError('enemies must be an array');
  const remaining = {};
  for (const family of Object.keys(DEFAULT_ATTACK_TOKEN_BUDGET)) {
    const value = budgets[family];
    nonNegativeInteger(value, `${family} token budget`);
    remaining[family] = value;
  }
  const candidates = enemies
    .filter((enemy) => enemy?.active && enemy.health > 0)
    .map((enemy) => {
      const archetype = getEnemyArchetype(enemy.archetypeId);
      const distance = Math.hypot(finite(enemy.x, 'enemy.x') - finite(player?.x, 'player.x'), finite(enemy.y, 'enemy.y') - finite(player?.y, 'player.y'));
      return { enemy, archetype, distance };
    })
    .filter(({ archetype, distance }) => distance <= archetype.attack.reserveRange)
    // An enemy in recovery cannot act on a token, so holding one starves a
    // ready attacker in range and creates dead air in the encounter.
    .filter(({ enemy }) => enemy.attackPhase !== 'recovery')
    .sort((a, b) => {
      const aReserved = a.enemy.attackPhase === 'tell' || a.enemy.attackPhase === 'attack' ? 0 : 1;
      const bReserved = b.enemy.attackPhase === 'tell' || b.enemy.attackPhase === 'attack' ? 0 : 1;
      return aReserved - bReserved || a.distance - b.distance || a.enemy.id.localeCompare(b.enemy.id);
    });
  const tokens = new Map();
  for (const candidate of candidates) {
    const family = candidate.archetype.attack.tokenFamily;
    if (remaining[family] <= 0) continue;
    tokens.set(candidate.enemy.id, family);
    remaining[family] -= 1;
  }
  return tokens;
}

// Separation is an overlap correction applied on top of locomotion. Deeply
// overlapped heavy bodies used to resolve in one tick with a delta ~15x the
// per-tick walk distance, which reads as a pop rather than a push. The bound
// keeps the correction convergent but visually continuous; the authoritative
// simulation always steps at a fixed 1/60, so this stays deterministic.
export const MAX_ENEMY_SEPARATION_STEP = 6;

export function computeEnemySeparation(enemies, {
  neighborRadius = 96,
  maxNeighbors = 8,
  strength = 0.35,
  maxStep = MAX_ENEMY_SEPARATION_STEP,
} = {}) {
  if (!Array.isArray(enemies)) throw new TypeError('enemies must be an array');
  finite(neighborRadius, 'neighborRadius');
  if (neighborRadius <= 0) throw new TypeError('neighborRadius must be positive');
  positiveInteger(maxNeighbors, 'maxNeighbors');
  finite(strength, 'strength');
  finite(maxStep, 'maxStep');
  if (maxStep <= 0) throw new TypeError('maxStep must be positive');
  if (strength < 0 || strength > 1) throw new TypeError('strength must be in [0, 1]');
  const ordered = enemies.filter((enemy) => enemy?.active).sort((a, b) => a.id.localeCompare(b.id));
  const deltas = new Map();
  let maxNeighborsObserved = 0;
  for (const enemy of ordered) {
    const neighbors = ordered
      .filter((other) => other !== enemy)
      .map((other) => ({
        other,
        dx: enemy.x - other.x,
        dy: enemy.y - other.y,
        distance: Math.hypot(enemy.x - other.x, enemy.y - other.y),
      }))
      .filter((candidate) => candidate.distance <= neighborRadius)
      .sort((a, b) => a.distance - b.distance || a.other.id.localeCompare(b.other.id))
      .slice(0, maxNeighbors);
    maxNeighborsObserved = Math.max(maxNeighborsObserved, neighbors.length);
    let x = 0;
    let y = 0;
    for (const neighbor of neighbors) {
      const required = enemy.radius + neighbor.other.radius;
      const overlap = Math.max(0, required - neighbor.distance);
      if (overlap <= 0) continue;
      const normal = neighbor.distance > EPSILON
        ? { x: neighbor.dx / neighbor.distance, y: neighbor.dy / neighbor.distance }
        : stableNormal(enemy.id, neighbor.other.id);
      x += normal.x * overlap * strength;
      y += normal.y * overlap * strength;
    }
    const magnitude = Math.hypot(x, y);
    if (magnitude > maxStep && magnitude > EPSILON) {
      const scale = maxStep / magnitude;
      x *= scale;
      y *= scale;
    }
    deltas.set(enemy.id, Object.freeze({ x, y }));
  }
  return Object.freeze({ deltas, maxNeighborsObserved });
}

export function stepEnemyPopulation({
  population,
  player,
  tick,
  dtSeconds,
  blockers = [],
  bounds = null,
  queryGround,
  preservePrevious = false,
  navigation = null,
} = {}) {
  if (!population || !Array.isArray(population.active)) throw new TypeError('population is required');
  nonNegativeInteger(tick, 'tick');
  finite(dtSeconds, 'dtSeconds');
  if (dtSeconds <= 0 || dtSeconds > 1 / 15) throw new TypeError('dtSeconds must be in (0, 1/15]');
  if (!Array.isArray(blockers)) throw new TypeError('blockers must be an array');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  if (typeof preservePrevious !== 'boolean') throw new TypeError('preservePrevious must be boolean');

  const ordered = population.active.filter((enemy) => enemy.active && enemy.health > 0).sort((a, b) => a.id.localeCompare(b.id));
  const separation = computeEnemySeparation(ordered);
  let decisions = 0;
  let safetySteps = 0;
  let collisionContacts = 0;
  let traversalBlocks = 0;

  for (const enemy of ordered) {
    if (!preservePrevious) {
      enemy.previousX = enemy.x;
      enemy.previousY = enemy.y;
      enemy.previousGroundZ = enemy.groundZ;
    }
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const lod = getEnemyLod(distance);
    const movementLocked = enemy.attackPhase === 'tell';
    if (!movementLocked && (!enemy.intent || tick >= enemy.nextDecisionTick)) {
      enemy.intent = planEnemyIntent(enemy, { player, tick, navigation });
      enemy.velocity = { ...enemy.intent.velocity };
      enemy.nextDecisionTick = tick + lod.cadenceTicks;
      decisions += 1;
    }

    const currentGround = queryGround(enemy.x, enemy.y);
    const archetype = getEnemyArchetype(enemy.archetypeId);
    const waterMultiplier = currentGround.kind === 'shallow-water' ? archetype.movement.shallowWaterMultiplier : 1;
    const separationDelta = separation.deltas.get(enemy.id) ?? { x: 0, y: 0 };
    const requested = movementLocked ? { x: 0, y: 0 } : {
      x: enemy.velocity.x * dtSeconds * waterMultiplier + separationDelta.x,
      y: enemy.velocity.y * dtSeconds * waterMultiplier + separationDelta.y,
    };
    const collision = resolveSweptCircleMotion({
      body: enemy.collisionBody,
      start: { x: enemy.x, y: enemy.y, z: enemy.groundZ },
      delta: requested,
      blockers,
      bounds,
    });
    safetySteps += 1;
    collisionContacts += collision.contacts.length;
    const traversal = resolveSweptTraversalPath({
      start: { x: enemy.x, y: enemy.y },
      end: collision.position,
      queryGround,
      maxSampleDistance: Math.max(4, enemy.radius * 0.5),
      transitionOptions: {
        maxCurbHeight: archetype.movement.maxCurbHeight,
        maxDropHeight: archetype.movement.maxDropHeight,
        maxAuthoredAscent: archetype.movement.maxAuthoredAscent,
      },
    });
    if (!traversal.allowed) traversalBlocks += 1;
    enemy.x = traversal.position.x;
    enemy.y = traversal.position.y;
    enemy.groundZ = traversal.ground.groundZ;
  }

  return freezeDeep({
    tick,
    activeCount: ordered.length,
    decisions,
    safetySteps,
    collisionContacts,
    traversalBlocks,
    maxNeighborsObserved: separation.maxNeighborsObserved,
  });
}
