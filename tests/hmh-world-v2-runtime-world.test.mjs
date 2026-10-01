// W4a: the ten-area world in the LEVEL_ONE_WORLD contract shape.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { checkGreyboxNavigation } from '../scripts/lib/hmh-greybox-layout-check.mjs';
import { COLLECTIBLE_EFFECTS, createCollectibleState } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { BLOCKER_PRODUCTION_KITS, DISTRICT_PRODUCTION_MATERIALS, INTERACTION_PRODUCTION_KITS, LANDMARK_PRODUCTION_KITS } from '../apps/hmh-reboot/src/world-production-art.mjs';
import { DISTRICT_TERRAIN_MATERIAL } from '../apps/hmh-reboot/src/terrain-tile-atlas.mjs';
import {
  WORLD_V2_RUNTIME_ID,
  auditWorldV2,
  buildWorldV2PointOfInterestPlacements,
  createWorldRevealState,
  createWorldV2GroundQuery,
  createWorldV2RuntimeWorld,
  getWorldRevealSnapshot,
  getWorldV2DistrictAt,
  isWorldV2PointClear,
  revealWorldAt,
} from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';

const world = createWorldV2RuntimeWorld();
const queryGround = createWorldV2GroundQuery(world);
const AREA_IDS = ['mweb-meadows', 'litecoin-city', 'halving-farms', 'silver-coast', 'scrypt-bayou', 'hashwood-river', 'hollow-pines', 'ledger-ridge', 'fork-fortress', 'rugpull-woods'].sort();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const deepFrozen = (value, path = 'world') => {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} is frozen`);
  for (const [key, child] of Object.entries(value)) deepFrozen(child, `${path}.${key}`);
};

test('the ten-area world carries every legacy contract key with the same type', () => {
  for (const [key, legacy] of Object.entries(LEVEL_ONE_WORLD)) {
    assert.ok(Object.hasOwn(world, key), `world.${key} exists`);
    assert.equal(Array.isArray(world[key]), Array.isArray(legacy), `world.${key} array-ness`);
    assert.equal(typeof world[key], typeof legacy, `world.${key} type`);
  }
  for (const nested of ['player', 'reveal', 'interactions', 'routeGraph', 'routeClearance', 'traversalTargetSeconds', 'bounds']) {
    for (const key of Object.keys(LEVEL_ONE_WORLD[nested])) assert.ok(Object.hasOwn(world[nested], key), `world.${nested}.${key}`);
  }
  for (const [collection, sample] of [['districts', ['id', 'name', 'area', 'color', 'landmarkId']], ['routes', ['id', 'kind', 'width', 'nodeIds']],
    ['blockers', ['id', 'districtId', 'anchor', 'visualKind', 'shape', 'maxZ', 'collisionBlockerId', 'visibleAssetId']], ['visibleBarriers', ['id', 'hard', 'collisionBlockerIds']],
    ['landmarks', ['id', 'districtId', 'anchor', 'visualKind']], ['pointsOfInterest', ['id', 'districtId', 'anchor', 'hook']], ['encounterArenas', ['id', 'districtId', 'anchor', 'radius']],
    ['spawnPoints', ['id', 'regionId', 'districtId', 'x', 'y', 'routeValid']], ['seams', ['id', 'x', 'districtIds', 'landmarkId', 'clearWidth']], ['perimeter', ['id', 'length', 'physicalCause', 'segments']],
    ['crossings', ['id', 'entry', 'exit', 'axis', 'clearWidth', 'surfaceIds']], ['legalAscents', ['id', 'entry', 'exit', 'surfaceId']]]) {
    assert.ok(world[collection].length > 0, `${collection} is populated`);
    for (const row of world[collection]) for (const key of sample) assert.ok(Object.hasOwn(row, key), `${collection} row has ${key}`);
  }
  assert.equal(world.id, WORLD_V2_RUNTIME_ID);
  assert.equal(world.version, 2);
  assert.equal(world.officialRun, false);
  assert.equal(world.rankedEligible, false);
  assert.deepEqual(world.bounds, { minX: 0, minY: 0, maxX: 20000, maxY: 14000, visibleBoundaryId: 'ten-area-frontier-perimeter' });
  assert.deepEqual(world.player, { maxSpeed: 240, radius: 24, spawn: { x: 12500, y: 6700 }, protectedSpawnRadius: 560 });
  assert.deepEqual(world.districts.map((district) => district.id), AREA_IDS);
  assert.deepEqual(world.interactions, { destructibles: [], hazards: [], explosiveZones: [] });
  assert.deepEqual(world.groundPaths, []);
  deepFrozen(world);
});

test('the audit passes and only authored local paths are detached from the road network', () => {
  const audit = auditWorldV2(world);
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.ok, true);
  for (const id of audit.detachedRouteIds) assert.equal(world.routes.find((route) => route.id === id).local, true, `${id} is a local path`);
  assert.equal(world.routes.filter((route) => !route.local).length, 14, 'fourteen regional roads');
});

test('at least twelve spawn points cover every area, stand clear for the player body and sit outside the protected disc', () => {
  assert.ok(world.spawnPoints.length >= 12);
  assert.deepEqual([...new Set(world.spawnPoints.map((point) => point.districtId))].sort(), AREA_IDS);
  for (const point of world.spawnPoints) {
    assert.equal(isWorldV2PointClear(world, queryGround, point, 24), true, `${point.id} clear at 24`);
    assert.equal(isWorldV2PointClear(world, queryGround, point, 48), true, `${point.id} clear with the director's margin`);
    assert.ok(Math.hypot(point.x - world.player.spawn.x, point.y - world.player.spawn.y) > world.player.protectedSpawnRadius, `${point.id} outside protected spawn`);
    assert.equal(getWorldV2DistrictAt(world, point.x, point.y)?.id, point.districtId);
    assert.equal(point.regionId, `${point.districtId}-perimeter`);
  }
  assert.equal(isWorldV2PointClear(world, queryGround, world.player.spawn, 24), true);
});

test('every area, cache, arena and spawn point is reachable and returnable on the real conservative nav grid', () => {
  const targets = [
    ...world.districts.map((district) => ({ id: `area:${district.id}`, kind: 'area', x: district.center.x, y: district.center.y })),
    ...world.pointsOfInterest.map((poi) => ({ id: `poi:${poi.id}`, kind: 'secret', x: poi.anchor.x, y: poi.anchor.y })),
    ...world.encounterArenas.map((arena) => ({ id: `arena:${arena.id}`, kind: 'arena', x: arena.anchor.x, y: arena.anchor.y })),
    ...world.spawnPoints.map((point) => ({ id: `spawn:${point.id}`, kind: 'spawn', x: point.x, y: point.y })),
  ];
  const report = checkGreyboxNavigation({ world: { bounds: world.bounds, collisionBlockers: world.collisionBlockers }, queryGround, start: world.player.spawn, targets });
  assert.deepEqual(report.issues, []);
  assert.equal(report.passed, true);
  assert.equal(report.targets.length, targets.length);
  for (const target of report.targets) {
    assert.equal(target.reachable, true, `${target.id} reachable`);
    assert.equal(target.returnable, true, `${target.id} returnable`);
  }
  assert.ok(report.metrics.walkableFraction > 0.45 && report.metrics.walkableFraction < 0.55, `walkable ${report.metrics.walkableFraction}`);
  assert.equal(report.metrics.outsideWalkableCells, 0);
});

test('the frozen world is deterministic across independent builds', () => {
  const first = hash(world);
  assert.equal(hash(createWorldV2RuntimeWorld()), first);
  assert.equal(hash(createWorldV2RuntimeWorld({ authored: createGreyboxWorld() })), first);
  assert.equal(hash(buildWorldV2PointOfInterestPlacements(createWorldV2RuntimeWorld())), hash(buildWorldV2PointOfInterestPlacements(world)));
});

test('the four boss courts are encounter sites in their briefed areas and only the Liquidator is a live boss', () => {
  const bosses = Object.fromEntries(world.encounterArenas.filter((arena) => arena.bossId).map((arena) => [arena.bossId, arena.districtId]));
  assert.deepEqual(bosses, { liquidator: 'litecoin-city', 'rug-pull-baron': 'hashwood-river', lockkeeper: 'scrypt-bayou', '51-percent-foreman': 'fork-fortress' });
  assert.equal(world.encounterArenas.length, 10);
  for (const arena of world.encounterArenas) assert.equal(getWorldV2DistrictAt(world, arena.anchor.x, arena.anchor.y)?.id, arena.districtId);
});

test('presentation hooks resolve to existing production kits and ten valid cache placements', () => {
  for (const district of world.districts) {
    assert.ok(DISTRICT_PRODUCTION_MATERIALS[district.materialId], `${district.id} material kit`);
    assert.ok(DISTRICT_TERRAIN_MATERIAL[district.materialId], `${district.id} terrain material`);
    assert.equal(world.artPlans.districts[district.id].materialId, district.materialId);
    const hook = world.artPlans.districts[district.id].artTarget;
    if (['mweb-meadows', 'rugpull-woods', 'halving-farms'].includes(district.id)) { assert.equal(hook.kind, 'area-art-plan'); assert.equal(hook.planId, district.id); assert.equal(typeof hook.load, 'function'); }
    else assert.equal(hook, null);
    assert.ok(world.districts.filter((other) => other !== district).every((other) => !(district.area.minX < other.area.maxX && other.area.minX < district.area.maxX && district.area.minY < other.area.maxY && other.area.minY < district.area.maxY)));
  }
  assert.equal(world.artPlans.mode, 'greybox-fallback');
  assert.equal(world.artPlans.roads.planId, 'world-roads');
  assert.equal(world.artPlans.authored.mapId, 'visual-overhaul-greybox-v1');
  for (const blocker of world.blockers) assert.ok(BLOCKER_PRODUCTION_KITS[blocker.visualKind], `${blocker.id} ${blocker.visualKind}`);
  for (const landmark of world.landmarks) assert.ok(LANDMARK_PRODUCTION_KITS[landmark.visualKind], landmark.id);
  for (const poi of world.pointsOfInterest) assert.ok(INTERACTION_PRODUCTION_KITS[poi.hook], poi.id);
  const placements = buildWorldV2PointOfInterestPlacements(world);
  assert.equal(placements.length, 10);
  assert.equal(new Set(placements.map((placement) => placement.id)).size, 10);
  for (const placement of placements) {
    assert.ok(COLLECTIBLE_EFFECTS[placement.assetId], placement.assetId);
    assert.equal(isWorldV2PointClear(world, queryGround, placement, 24), true, placement.id);
  }
  const collectibles = createCollectibleState({ placements, objectivePlacements: [] });
  assert.ok(collectibles);
  assert.equal(world.blockers.length, world.collisionBlockers.length);
  assert.deepEqual(world.visibleBarriers.map((barrier) => barrier.collisionBlockerIds[0]), world.collisionBlockers.map((blocker) => blocker.id));
});

test('the world-parameterised reveal and district helpers mirror the legacy ones', () => {
  const state = createWorldRevealState(world);
  assert.equal(state.columns, 84);
  assert.equal(state.rows, 59);
  assert.ok(revealWorldAt(world, state, world.player.spawn) > 0);
  const snapshot = getWorldRevealSnapshot(world, state);
  assert.equal(snapshot.totalCells, 84 * 59);
  assert.equal(snapshot.cellSize, 240);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.deepEqual(snapshot.alwaysVisibleBoundaryIds, world.visibleBarriers.map((barrier) => barrier.id).sort());
  assert.equal(getWorldV2DistrictAt(world, 12500, 6700)?.id, 'mweb-meadows');
  assert.equal(getWorldV2DistrictAt(world, 10000, 6700), null, 'road gaps belong to no district');
  assert.throws(() => getWorldV2DistrictAt(world, Number.NaN, 0), TypeError);
});
