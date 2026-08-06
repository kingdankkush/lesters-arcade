import { freezeDeep } from './value-guards.mjs';
import { getEnemyArchetype } from './enemy-archetypes.mjs';
import {
  attemptScheduledEnemyInsertion,
  createEnemySpawnSchedule,
} from './enemy-simulation.mjs';

const TICKS_PER_MINUTE = 3_600;
const REST_INTERVAL_TICKS = 18_000;
const REST_DURATION_TICKS = 900;
const PROTECTED_HERO_RADIUS = 560;
const MAX_SPAWN_ELEVATION_DELTA = 64;


function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

import { finite } from './value-guards.mjs';

const defineBand = (definition) => freezeDeep(definition);
const roleWeights = (rusher, flanker, suppressor = 0, heavy = 0, demolition = 0, support = 0) => ({ rusher, flanker, suppressor, heavy, demolition, support });

export const ENCOUNTER_BANDS = Object.freeze([
  defineBand({ id: 'opening', minTick: 0, maxTick: 3_599, spawnIntervalTicks: 120, allowedRoles: ['rusher', 'flanker'], roleWeights: roleWeights(14, 6), eliteReserve: 0, bossReserve: 0, reservedBossBodies: 0, reservedThreat: 0, budgets: { bodyCap: 32, threatCap: 64, rangedCap: 4, projectileCap: 64, effectCap: 96, fullAiCap: 24, animationCap: 32, attackTokens: { melee: 2, ranged: 1, area: 1, support: 0 } } }),
  defineBand({ id: 'build', minTick: 3_600, maxTick: 17_999, spawnIntervalTicks: 90, allowedRoles: ['rusher', 'flanker', 'suppressor'], roleWeights: roleWeights(11, 6, 3), eliteReserve: 2, bossReserve: 0, reservedBossBodies: 0, reservedThreat: 8, budgets: { bodyCap: 64, threatCap: 128, rangedCap: 8, projectileCap: 96, effectCap: 128, fullAiCap: 28, animationCap: 40, attackTokens: { melee: 3, ranged: 2, area: 1, support: 1 } } }),
  defineBand({ id: 'pressure', minTick: 18_000, maxTick: 35_999, spawnIntervalTicks: 60, allowedRoles: ['rusher', 'flanker', 'suppressor', 'heavy', 'demolition', 'support'], roleWeights: roleWeights(6, 4, 3, 3, 2, 2), eliteReserve: 4, bossReserve: 0, reservedBossBodies: 0, reservedThreat: 16, budgets: { bodyCap: 100, threatCap: 240, rangedCap: 16, projectileCap: 128, effectCap: 160, fullAiCap: 32, animationCap: 48, attackTokens: { melee: 4, ranged: 3, area: 2, support: 1 } } }),
  defineBand({ id: 'elite', minTick: 36_000, maxTick: 71_999, spawnIntervalTicks: 45, allowedRoles: ['rusher', 'flanker', 'suppressor', 'heavy', 'demolition', 'support'], roleWeights: roleWeights(5, 4, 3, 3, 3, 2), eliteReserve: 8, bossReserve: 0, reservedBossBodies: 0, reservedThreat: 48, budgets: { bodyCap: 128, threatCap: 360, rangedCap: 20, projectileCap: 160, effectCap: 192, fullAiCap: 32, animationCap: 56, attackTokens: { melee: 5, ranged: 4, area: 3, support: 2 } } }),
  defineBand({ id: 'boss', minTick: 72_000, maxTick: 75_599, spawnIntervalTicks: 60, allowedRoles: ['rusher', 'flanker', 'suppressor', 'heavy', 'demolition', 'support'], roleWeights: roleWeights(4, 3, 3, 4, 3, 3), eliteReserve: 8, bossReserve: 1, reservedBossBodies: 9, reservedThreat: 128, budgets: { bodyCap: 128, threatCap: 512, rangedCap: 18, projectileCap: 192, effectCap: 256, fullAiCap: 40, animationCap: 64, attackTokens: { melee: 3, ranged: 3, area: 3, support: 2 } } }),
  defineBand({ id: 'endurance', minTick: 75_600, maxTick: Infinity, spawnIntervalTicks: 30, allowedRoles: ['rusher', 'flanker', 'suppressor', 'heavy', 'demolition', 'support'], roleWeights: roleWeights(4, 4, 3, 3, 3, 3), eliteReserve: 16, bossReserve: 1, reservedBossBodies: 1, reservedThreat: 96, budgets: { bodyCap: 160, threatCap: 640, rangedCap: 28, projectileCap: 220, effectCap: 320, fullAiCap: 32, animationCap: 64, attackTokens: { melee: 6, ranged: 5, area: 4, support: 2 } } }),
]);

export const DISTRICT_ROLE_GATES = freezeDeep({
  'frontier-relay': ['rusher', 'flanker'],
  'rugpull-ravine': ['rusher', 'flanker', 'suppressor'],
  'liquidity-crossing': ['rusher', 'flanker', 'suppressor', 'demolition'],
  hashwood: ['rusher', 'flanker', 'demolition', 'support'],
  'mining-camp': ['rusher', 'flanker', 'suppressor', 'heavy', 'demolition', 'support'],
  'liquidation-yard': ['rusher', 'flanker', 'suppressor', 'heavy', 'demolition', 'support'],
});

const ROLE_ARCHETYPES = freezeDeep({
  rusher: ['bagholder-rusher'],
  flanker: ['forkrunner'],
  suppressor: ['liquidator-agent'],
  heavy: ['whale-enforcer'],
  demolition: ['gas-bomber'],
  support: ['validator-cultist'],
});

const RANGED_ROLES = new Set(['suppressor', 'demolition', 'support']);

export function getEncounterBand(tick) {
  nonNegativeInteger(tick, 'tick');
  return ENCOUNTER_BANDS.find((band) => tick >= band.minTick && tick <= band.maxTick) ?? ENCOUNTER_BANDS.at(-1);
}

export function getEncounterSnapshot(tick) {
  const band = getEncounterBand(tick);
  return freezeDeep({
    tick,
    minute: tick / TICKS_PER_MINUTE,
    bandId: band.id,
    bodyCap: band.budgets.bodyCap,
    ordinaryBodyCap: band.budgets.bodyCap - band.eliteReserve - band.reservedBossBodies,
    threatCap: band.budgets.threatCap,
    rangedCap: band.budgets.rangedCap,
    projectileCap: band.budgets.projectileCap,
    effectCap: band.budgets.effectCap,
    fullAiCap: band.budgets.fullAiCap,
    animationCap: band.budgets.animationCap,
    attackTokens: band.budgets.attackTokens,
    eliteReserve: band.eliteReserve,
    bossReserve: band.bossReserve,
  });
}

export function createEncounterDirector({ nextSpawnTick = 0, seed = 0 } = {}) {
  return {
    seed: nonNegativeInteger(seed, 'director seed'),
    spawnOrdinal: 0,
    schedule: createEnemySpawnSchedule({ nextSpawnTick, intervalTicks: ENCOUNTER_BANDS[0].spawnIntervalTicks, burstRemaining: 1 }),
    insertedCount: 0,
    rejectedCount: 0,
    rejectionCounts: Object.create(null),
  };
}

export function selectEncounterArchetype({ districtId, bandId, spawnOrdinal, seed = 0, requestedRole = null } = {}) {
  const districtRoles = DISTRICT_ROLE_GATES[districtId];
  if (!districtRoles) throw new TypeError('districtId must identify an authored district');
  const band = ENCOUNTER_BANDS.find((entry) => entry.id === bandId);
  if (!band) throw new TypeError('bandId must identify an encounter band');
  nonNegativeInteger(spawnOrdinal, 'spawnOrdinal');
  nonNegativeInteger(seed, 'seed');
  const eligibleRoles = districtRoles.filter((role) => band.allowedRoles.includes(role) && ROLE_ARCHETYPES[role]?.length > 0);
  const roles = eligibleRoles.length > 0 ? eligibleRoles : districtRoles.filter((role) => ROLE_ARCHETYPES[role]?.length > 0);
  if (roles.length === 0) throw new Error(`district ${districtId} has no eligible enemy roles`);
  const weightedRoles = roles.flatMap((role) => Array.from({ length: band.roleWeights[role] ?? 1 }, () => role));
  const requestedIsEligible = requestedRole === null || eligibleRoles.includes(requestedRole);
  const selectedRole = requestedRole !== null && requestedIsEligible
    ? requestedRole
    : weightedRoles[(spawnOrdinal + seed) % weightedRoles.length];
  const resolvedRequestedRole = requestedRole ?? selectedRole;
  const candidates = ROLE_ARCHETYPES[selectedRole];
  const archetypeId = candidates[Math.floor(spawnOrdinal / weightedRoles.length) % candidates.length];
  getEnemyArchetype(archetypeId);
  return freezeDeep({ archetypeId, requestedRole: resolvedRequestedRole, roleApplied: requestedIsEligible, fallbackReason: requestedIsEligible ? null : 'band-gated-role' });
}

export function isEncounterRestWindow(tick) {
  nonNegativeInteger(tick, 'tick');
  return tick > 0 && tick % REST_INTERVAL_TICKS < REST_DURATION_TICKS;
}

export function validateEncounterSpawn({
  point,
  districtId,
  player,
  camera,
  queryGround,
  isBlocked,
  isRouteReachable,
  protectedHeroRadius = PROTECTED_HERO_RADIUS,
} = {}) {
  if (!point || typeof point.id !== 'string' || typeof point.regionId !== 'string') throw new TypeError('authored spawn point is required');
  if (point.districtId !== districtId) return freezeDeep({ allowed: false, reason: 'wrong-district', groundZ: null });
  const x = finite(point.x, 'spawn.x');
  const y = finite(point.y, 'spawn.y');
  finite(player?.x, 'player.x');
  finite(player?.y, 'player.y');
  finite(player?.groundZ, 'player.groundZ');
  if (!camera || ![camera.minX, camera.minY, camera.maxX, camera.maxY].every(Number.isFinite)) throw new TypeError('camera bounds are required');
  if (typeof queryGround !== 'function' || typeof isBlocked !== 'function' || typeof isRouteReachable !== 'function') throw new TypeError('spawn safety callbacks are required');
  if (x >= camera.minX && x <= camera.maxX && y >= camera.minY && y <= camera.maxY) return freezeDeep({ allowed: false, reason: 'on-camera', groundZ: null });
  if (Math.hypot(x - player.x, y - player.y) < protectedHeroRadius) return freezeDeep({ allowed: false, reason: 'protected-hero-radius', groundZ: null });
  if (isBlocked(point)) return freezeDeep({ allowed: false, reason: 'blocked', groundZ: null });
  const ground = queryGround(x, y);
  if (!ground || !Number.isFinite(ground.groundZ)) throw new TypeError('queryGround must return authored ground');
  if (ground.kind === 'deep-water') return freezeDeep({ allowed: false, reason: 'deep-water', groundZ: ground.groundZ });
  if (Math.abs(ground.groundZ - player.groundZ) > MAX_SPAWN_ELEVATION_DELTA) return freezeDeep({ allowed: false, reason: 'unreachable-elevation', groundZ: ground.groundZ });
  if (!isRouteReachable(point, ground)) return freezeDeep({ allowed: false, reason: 'route-unreachable', groundZ: ground.groundZ });
  return freezeDeep({ allowed: true, reason: null, groundZ: ground.groundZ });
}

function reject(state, tick, band, reason) {
  state.rejectedCount += 1;
  state.rejectionCounts[reason] = (state.rejectionCounts[reason] ?? 0) + 1;
  return freezeDeep({ inserted: false, reason, tick, bandId: band.id });
}

export function stepEncounterDirector({
  state,
  population,
  tick,
  districtId,
  player,
  camera,
  spawnPoints,
  nearRewardPoi = false,
  queryGround,
  isBlocked,
  isRouteReachable,
  visualMode = 'normal',
} = {}) {
  if (!state?.schedule || !population?.active || !(population.seenIds instanceof Set)) throw new TypeError('director state and enemy population are required');
  nonNegativeInteger(tick, 'tick');
  if (!Array.isArray(spawnPoints)) throw new TypeError('spawnPoints must be an array');
  if (typeof nearRewardPoi !== 'boolean') throw new TypeError('nearRewardPoi must be boolean');
  const band = getEncounterBand(tick);
  const snapshot = getEncounterSnapshot(tick);
  if (tick < state.schedule.nextSpawnTick) return freezeDeep({ inserted: false, reason: 'not-due', tick, bandId: band.id });
  if (nearRewardPoi && isEncounterRestWindow(tick)) return reject(state, tick, band, 'reward-rest-window');
  if (population.active.length >= snapshot.ordinaryBodyCap) return reject(state, tick, band, 'reserved-body-cap');

  const selection = selectEncounterArchetype({ districtId, bandId: band.id, spawnOrdinal: state.spawnOrdinal, seed: state.seed });
  const selectedRole = getEnemyArchetype(selection.archetypeId).role;
  const rangedCount = population.active.reduce((count, enemy) => count + (RANGED_ROLES.has(getEnemyArchetype(enemy.archetypeId).role) ? 1 : 0), 0);
  if (RANGED_ROLES.has(selectedRole) && rangedCount >= band.budgets.rangedCap) {
    // Selection is a pure function of spawnOrdinal, so leaving the ordinal in
    // place would re-pick the same capped role forever and stall every spawn,
    // melee included. Advance past the capped pick; placement-class rejections
    // below still retry the same ordinal.
    state.spawnOrdinal += 1;
    return reject(state, tick, band, 'ranged-cap');
  }

  const orderedPoints = [...spawnPoints].sort((a, b) => String(a.regionId).localeCompare(String(b.regionId)) || String(a.id).localeCompare(String(b.id)));
  let selectedPoint = null;
  let selectedGroundZ = 0;
  for (const point of orderedPoints) {
    const validation = validateEncounterSpawn({ point, districtId, player, camera, queryGround, isBlocked, isRouteReachable });
    if (!validation.allowed) continue;
    selectedPoint = point;
    selectedGroundZ = validation.groundZ;
    break;
  }
  if (!selectedPoint) return reject(state, tick, band, 'no-valid-spawn');

  state.schedule.intervalTicks = band.spawnIntervalTicks;
  const id = `encounter-${String(state.spawnOrdinal).padStart(6, '0')}`;
  const result = attemptScheduledEnemyInsertion({
    population,
    schedule: state.schedule,
    candidate: { archetypeId: selection.archetypeId, id, x: selectedPoint.x, y: selectedPoint.y, groundZ: selectedGroundZ },
    tick,
    placementAllowed: true,
    visualMode,
    threatRemaining: Math.max(0, band.budgets.threatCap - band.reservedThreat - population.activeThreat),
  });
  if (!result.inserted) return reject(state, tick, band, result.reason);
  state.schedule.burstRemaining = 1;
  state.spawnOrdinal += 1;
  state.insertedCount += 1;
  return freezeDeep({ inserted: true, reason: null, tick, bandId: band.id, enemyId: result.enemyId, archetypeId: result.archetypeId, spawnPointId: selectedPoint.id, selection });
}
