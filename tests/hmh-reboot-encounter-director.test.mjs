import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DISTRICT_ROLE_GATES,
  ENCOUNTER_BANDS,
  createEncounterDirector,
  getEncounterBand,
  getEncounterSnapshot,
  isEncounterRestWindow,
  selectEncounterArchetype,
  stepEncounterDirector,
  validateEncounterSpawn,
} from '../apps/hmh-reboot/src/encounter-director.mjs';
import { createEnemyPopulation, createEnemyState } from '../apps/hmh-reboot/src/enemy-simulation.mjs';

const CAMERA = { minX: -480, minY: -270, maxX: 480, maxY: 270 };
const PLAYER = { x: 0, y: 0, groundZ: 0 };
const SAFE_POINT = Object.freeze({ id: 'spawn-east', regionId: 'frontier-east', districtId: 'frontier-relay', x: 900, y: 0 });
const FLAT = () => ({ kind: 'ground', groundZ: 0, surfaceId: 'flat' });

function stepAt({
  tick = 0,
  state = createEncounterDirector(),
  population = createEnemyPopulation(),
  spawnPoints = [SAFE_POINT],
  districtId = 'frontier-relay',
  nearRewardPoi = false,
  queryGround = FLAT,
  isBlocked = () => false,
  isRouteReachable = () => true,
} = {}) {
  return stepEncounterDirector({
    state,
    population,
    tick,
    districtId,
    player: PLAYER,
    camera: CAMERA,
    spawnPoints,
    nearRewardPoi,
    queryGround,
    isBlocked,
    isRouteReachable,
    visualMode: 'prototype',
  });
}

test('six immutable pacing bands expose independent fixed budgets and exact boundaries', () => {
  assert.deepEqual(ENCOUNTER_BANDS.map((band) => band.id), ['opening', 'build', 'pressure', 'elite', 'boss', 'endurance']);
  assert.deepEqual([0, 3_600, 18_000, 36_000, 72_000, 75_600].map((tick) => getEncounterBand(tick).id), ['opening', 'build', 'pressure', 'elite', 'boss', 'endurance']);
  for (const band of ENCOUNTER_BANDS) {
    assert.ok(Object.isFrozen(band));
    assert.ok(Number.isInteger(band.budgets.bodyCap) && band.budgets.bodyCap > 0 && band.budgets.bodyCap <= 192);
    for (const key of ['threatCap', 'rangedCap', 'projectileCap', 'effectCap', 'fullAiCap', 'animationCap']) {
      assert.ok(Number.isInteger(band.budgets[key]) && band.budgets[key] >= 0, `${band.id}.${key}`);
    }
    assert.ok(band.budgets.fullAiCap <= band.budgets.bodyCap);
    assert.ok(band.budgets.animationCap <= band.budgets.bodyCap);
    assert.ok(Object.isFrozen(band.budgets.attackTokens));
    assert.deepEqual(Object.keys(band.budgets.attackTokens).sort(), ['area', 'melee', 'ranged', 'support']);
    for (const value of Object.values(band.budgets.attackTokens)) assert.ok(Number.isInteger(value) && value >= 0);
    assert.ok(Number.isInteger(band.spawnIntervalTicks) && band.spawnIntervalTicks > 0);
  }
  assert.ok(getEncounterBand(36_000).budgets.bodyCap >= 100);
});

test('5/10/20/30-minute snapshots are deterministic and preserve elite/boss reservations', () => {
  assert.deepEqual([5, 10, 20, 30].map((minute) => getEncounterSnapshot(minute * 60 * 60)), [
    { tick: 18_000, minute: 5, bandId: 'pressure', bodyCap: 100, ordinaryBodyCap: 96, threatCap: 240, rangedCap: 16, projectileCap: 128, effectCap: 160, fullAiCap: 32, animationCap: 48, attackTokens: { melee: 4, ranged: 3, area: 2, support: 1 }, eliteReserve: 4, bossReserve: 0 },
    { tick: 36_000, minute: 10, bandId: 'elite', bodyCap: 128, ordinaryBodyCap: 120, threatCap: 360, rangedCap: 20, projectileCap: 160, effectCap: 192, fullAiCap: 32, animationCap: 56, attackTokens: { melee: 5, ranged: 4, area: 3, support: 2 }, eliteReserve: 8, bossReserve: 0 },
    { tick: 72_000, minute: 20, bandId: 'boss', bodyCap: 128, ordinaryBodyCap: 111, threatCap: 512, rangedCap: 18, projectileCap: 192, effectCap: 256, fullAiCap: 40, animationCap: 64, attackTokens: { melee: 3, ranged: 3, area: 3, support: 2 }, eliteReserve: 8, bossReserve: 1 },
    { tick: 108_000, minute: 30, bandId: 'endurance', bodyCap: 160, ordinaryBodyCap: 143, threatCap: 640, rangedCap: 28, projectileCap: 220, effectCap: 320, fullAiCap: 32, animationCap: 64, attackTokens: { melee: 6, ranged: 5, area: 4, support: 2 }, eliteReserve: 16, bossReserve: 1 },
  ]);
});

test('district role gates and stable ordinal selection never mislabel fallback roles', () => {
  assert.deepEqual(DISTRICT_ROLE_GATES['frontier-relay'], ['rusher', 'flanker']);
  assert.deepEqual(DISTRICT_ROLE_GATES['liquidation-yard'], ['rusher', 'flanker', 'suppressor', 'heavy', 'demolition', 'support']);
  const a = selectEncounterArchetype({ districtId: 'frontier-relay', bandId: 'opening', spawnOrdinal: 0 });
  const b = selectEncounterArchetype({ districtId: 'frontier-relay', bandId: 'opening', spawnOrdinal: 1 });
  assert.deepEqual([a.archetypeId, a.requestedRole, a.roleApplied], ['bagholder-rusher', 'rusher', true]);
  assert.deepEqual([b.archetypeId, b.requestedRole, b.roleApplied], ['forkrunner', 'flanker', true]);
  const fallback = selectEncounterArchetype({ districtId: 'liquidity-crossing', bandId: 'opening', spawnOrdinal: 2 });
  assert.deepEqual([fallback.archetypeId, fallback.requestedRole, fallback.roleApplied, fallback.fallbackReason], ['bagholder-rusher', 'suppressor', false, 'band-gated-role']);
  assert.throws(() => selectEncounterArchetype({ districtId: 'unknown', bandId: 'opening', spawnOrdinal: 0 }), /districtId/);
});

test('seeded role order is repeatable and different seeds diverge without randomness', () => {
  const sequence = (seed) => Array.from({ length: 6 }, (_, spawnOrdinal) => selectEncounterArchetype({ districtId: 'mining-camp', bandId: 'elite', spawnOrdinal, seed }).archetypeId);
  assert.deepEqual(sequence(42), sequence(42));
  assert.notDeepEqual(sequence(42), sequence(43));
});

test('authored spawn validation rejects camera, hero, blocker, deep-water, elevation, route, and district violations', () => {
  const valid = validateEncounterSpawn({ point: SAFE_POINT, districtId: 'frontier-relay', player: PLAYER, camera: CAMERA, queryGround: FLAT, isBlocked: () => false, isRouteReachable: () => true });
  assert.deepEqual(valid, { allowed: true, reason: null, groundZ: 0 });
  const attempt = (patch = {}, options = {}) => validateEncounterSpawn({ point: { ...SAFE_POINT, ...patch }, districtId: 'frontier-relay', player: PLAYER, camera: CAMERA, queryGround: options.queryGround ?? FLAT, isBlocked: options.isBlocked ?? (() => false), isRouteReachable: options.isRouteReachable ?? (() => true) });
  assert.equal(attempt({ x: 400 }).reason, 'on-camera');
  assert.equal(attempt({ x: 500, y: 0 }).reason, 'protected-hero-radius');
  assert.equal(attempt({}, { isBlocked: () => true }).reason, 'blocked');
  assert.equal(attempt({}, { queryGround: () => ({ kind: 'deep-water', groundZ: -20 }) }).reason, 'deep-water');
  assert.equal(attempt({}, { queryGround: () => ({ kind: 'ground', groundZ: 80 }) }).reason, 'unreachable-elevation');
  assert.equal(attempt({}, { isRouteReachable: () => false }).reason, 'route-unreachable');
  assert.equal(attempt({ districtId: 'hashwood' }).reason, 'wrong-district');
});

test('rejected placement does not burn schedule or IDs; success inserts exact candidate once', () => {
  const state = createEncounterDirector();
  const population = createEnemyPopulation();
  const rejected = stepAt({ state, population, spawnPoints: [{ ...SAFE_POINT, x: 100 }] });
  assert.deepEqual({ inserted: rejected.inserted, reason: rejected.reason, next: state.schedule.nextSpawnTick, ordinal: state.spawnOrdinal, count: population.active.length }, { inserted: false, reason: 'no-valid-spawn', next: 0, ordinal: 0, count: 0 });
  const inserted = stepAt({ state, population });
  assert.equal(inserted.inserted, true);
  assert.deepEqual({ id: population.active[0].id, archetypeId: population.active[0].archetypeId, next: state.schedule.nextSpawnTick, ordinal: state.spawnOrdinal, count: population.active.length }, { id: 'encounter-000000', archetypeId: 'bagholder-rusher', next: 120, ordinal: 1, count: 1 });
  assert.equal(stepAt({ state, population, tick: 1 }).reason, 'not-due');
});

test('successful insertion replenishes one bounded burst for the next fixed interval', () => {
  const state = createEncounterDirector();
  const population = createEnemyPopulation();
  assert.equal(stepAt({ state, population, tick: 0 }).inserted, true);
  assert.equal(state.schedule.burstRemaining, 1);
  assert.equal(stepAt({ state, population, tick: 119 }).reason, 'not-due');
  const second = stepAt({ state, population, tick: 120 });
  assert.equal(second.inserted, true);
  assert.deepEqual(population.active.map((enemy) => enemy.id), ['encounter-000000', 'encounter-000001']);
  assert.equal(state.schedule.burstRemaining, 1);
});

test('ordinary spawns cannot consume reserved elite or boss body capacity', () => {
  const state = createEncounterDirector({ nextSpawnTick: 36_000 });
  const population = createEnemyPopulation({ capacity: 192, threatCapacity: 1024 });
  population.active = Array.from({ length: 120 }, (_, index) => createEnemyState({ archetypeId: 'bagholder-rusher', id: `existing-${String(index).padStart(3, '0')}`, x: -1000 - index, y: 0, visualMode: 'prototype' }));
  population.activeThreat = 240;
  const report = stepAt({ state, population, tick: 36_000, districtId: 'mining-camp', spawnPoints: [{ ...SAFE_POINT, districtId: 'mining-camp' }] });
  assert.deepEqual({ inserted: report.inserted, reason: report.reason, count: population.active.length, next: state.schedule.nextSpawnTick }, { inserted: false, reason: 'reserved-body-cap', count: 120, next: 36_000 });
});

test('POI rest windows suppress ordinary pressure only when the player is near a reward POI', () => {
  assert.equal(isEncounterRestWindow(18_000), true);
  assert.equal(isEncounterRestWindow(18_899), true);
  assert.equal(isEncounterRestWindow(18_900), false);
  const restingState = createEncounterDirector({ nextSpawnTick: 18_000 });
  const restingPopulation = createEnemyPopulation();
  assert.equal(stepAt({ tick: 18_000, state: restingState, population: restingPopulation, nearRewardPoi: true }).reason, 'reward-rest-window');
  assert.equal(restingState.schedule.nextSpawnTick, 18_000);
  const activeState = createEncounterDirector({ nextSpawnTick: 18_000 });
  const activePopulation = createEnemyPopulation();
  assert.equal(stepAt({ tick: 18_000, state: activeState, population: activePopulation, nearRewardPoi: false }).inserted, true);
});

test('runtime consumes the director before enemy movement and exposes bounded telemetry', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /createEncounterDirector/);
  assert.match(source, /createEncounterDirector\(\{[^}]*seed: payload\.session\.seed/s);
  assert.match(source, /stepEncounterDirector/);
  assert.match(source, /budgets: getEncounterSnapshot\(tick\)\.attackTokens/);
  assert.ok(source.indexOf('lastDirectorStep = stepEncounterDirector') < source.indexOf('lastEnemyStep = stepEnemyPopulation'));
  assert.match(source, /dataset\.encounterBand/);
  assert.match(source, /dataset\.directorInsertions/);
});
