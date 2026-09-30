// W4a: world-keyed gameplay tables for the ten-area Free world, alongside the
// untouched legacy tables.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { DISTRICT_ROLE_GATES, selectEncounterArchetype } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { getEnemyArchetype } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { MISSION_BOSS_ZONES, MISSION_OBJECTIVES, createMissionState, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { BOSS_DEFINITIONS, bossZoneArming, createBossSlots, stepBossSlots } from '../apps/hmh-reboot/src/boss-slots.mjs';
import { auditCollisionWorld } from '../apps/hmh-reboot/src/collision.mjs';
import { resolveLevelBriefing } from '../apps/hmh-reboot/src/level-briefing.mjs';
import { HMH_V7_BOSSES } from '../sdk/hmh-run-contract-v7.mjs';
import { createWorldV2GroundQuery, createWorldV2RuntimeWorld, getWorldV2DistrictAt, isWorldV2PointClear } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createWorldV2Gameplay, selectWorldV2Entry } from '../apps/hmh-reboot/src/world-v2-gameplay.mjs';

const world = createWorldV2RuntimeWorld();
const queryGround = createWorldV2GroundQuery(world);
const gameplay = createWorldV2Gameplay(world);
const LEGACY_ROLES = new Set(Object.values(DISTRICT_ROLE_GATES).flat());
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const still = (state, tick, at) => stepMissionObjectives(state, { tick, player: { x: at.x, y: at.y, groundZ: queryGround(at.x, at.y).groundZ }, move: { x: 0, y: 0 }, queryGround });

test('every ten-area district has a conservative role gate drawn from the legacy roles; the legacy table is untouched', () => {
  assert.deepEqual(Object.keys(gameplay.roleGates).sort(), world.districts.map((district) => district.id));
  assert.ok(gameplay.roleGates[gameplay.defaultDistrictId]);
  assert.deepEqual(gameplay.roleGates['mweb-meadows'], ['rusher', 'flanker']);
  assert.equal(gameplay.roleGates['fork-fortress'].length, 6);
  for (const roles of Object.values(gameplay.roleGates)) for (const role of roles) assert.ok(LEGACY_ROLES.has(role), role);
  const byTier = new Map(world.districts.map((district) => [district.id, district.tier]));
  for (const [id, roles] of Object.entries(gameplay.roleGates)) for (const [otherId, otherRoles] of Object.entries(gameplay.roleGates)) {
    if (byTier.get(id) <= byTier.get(otherId)) assert.ok(roles.length <= otherRoles.length, `${id} <= ${otherId}`);
  }
  assert.deepEqual(Object.keys(DISTRICT_ROLE_GATES), ['frontier-relay', 'rugpull-ravine', 'liquidity-crossing', 'hashwood', 'mining-camp', 'liquidation-yard']);
  const meadows = selectEncounterArchetype({ districtId: 'mweb-meadows', bandId: 'opening', spawnOrdinal: 3, seed: 9, roleGates: gameplay.roleGates });
  assert.ok(['rusher', 'flanker'].includes(getEnemyArchetype(meadows.archetypeId).role));
  assert.throws(() => selectEncounterArchetype({ districtId: 'mweb-meadows', bandId: 'opening', spawnOrdinal: 3, seed: 9 }), /authored district/);
  assert.deepEqual(selectEncounterArchetype({ districtId: 'frontier-relay', bandId: 'opening', spawnOrdinal: 3, seed: 9 }), selectEncounterArchetype({ districtId: 'frontier-relay', bandId: 'opening', spawnOrdinal: 3, seed: 9, roleGates: DISTRICT_ROLE_GATES }));
});

test('the mission rows keep the legacy row shape and complete in the real mission simulation', () => {
  const legacyKeys = Object.keys(MISSION_OBJECTIVES.find((row) => row.mode === 'quick')).sort();
  for (const row of gameplay.missionObjectives) {
    for (const key of legacyKeys) assert.ok(Object.hasOwn(row, key), `${row.id}.${key}`);
    assert.equal(getWorldV2DistrictAt(world, row.operate.x, row.operate.y)?.id, row.districtId);
    assert.equal(isWorldV2PointClear(world, queryGround, row.operate, 24), true, row.id);
    assert.ok(world.collisionBlockers.some((blocker) => blocker.id === row.propBlockerId), row.propBlockerId);
    assert.equal(row.objectiveClass, 'switch');
  }
  assert.deepEqual(gameplay.missionObjectives.map((row) => [row.id, row.districtId]), [['ten-area-meadows-relay', 'mweb-meadows'], ['ten-area-woods-camp', 'rugpull-woods']]);
  const bossKeys = Object.keys(MISSION_BOSS_ZONES[0]).sort();
  for (const row of gameplay.missionBossZones) for (const key of bossKeys) assert.ok(Object.hasOwn(row, key), `${row.id}.${key}`);

  const state = createMissionState(5, { objectives: gameplay.missionObjectives, bossZones: gameplay.missionBossZones });
  const relay = gameplay.missionObjectives.find((row) => row.id === 'ten-area-meadows-relay');
  const events = [];
  for (let tick = 0; tick < 60; tick += 1) events.push(...still(state, tick, relay.operate).events);
  assert.deepEqual(events.map((event) => [event.type, event.objectiveId]), [['objective-completed', 'ten-area-meadows-relay']]);
  assert.deepEqual(events[0].effects, [{ type: 'grant', grant: 'heal', amount: 30 }]);
  const camp = gameplay.missionObjectives.find((row) => row.id === 'ten-area-woods-camp');
  const campEvents = [];
  for (let tick = 60; tick < 60 + camp.fillTicks + 8; tick += 1) campEvents.push(...still(state, tick, camp.operate).events);
  assert.deepEqual(campEvents.map((event) => event.objectiveId), ['ten-area-woods-camp']);
  assert.equal(state.seals.size, 0, 'no seals or prisoners');
  assert.equal(state.prisoners.length, 0);
});

test('the Liquidator fights on an exchange floor inside Litecoin City through the existing boss slots', () => {
  const floor = gameplay.liquidatorFloor;
  assert.equal(floor.districtId, 'litecoin-city');
  assert.equal(floor.bounds.maxX - floor.bounds.minX, 1050);
  assert.equal(floor.bounds.maxY - floor.bounds.minY, 460);
  for (const point of [floor.centre, floor.spawn, floor.bell, floor.retreat, ...floor.podiums, ...floor.edgeSites,
    { x: floor.bounds.minX + 30, y: floor.bounds.minY + 30 }, { x: floor.bounds.maxX - 30, y: floor.bounds.maxY - 30 }, { x: floor.bounds.minX + 30, y: floor.bounds.maxY - 30 }, { x: floor.bounds.maxX - 30, y: floor.bounds.minY + 30 }]) {
    assert.equal(isWorldV2PointClear(world, queryGround, point, 24), true, `${point.x},${point.y}`);
    assert.equal(getWorldV2DistrictAt(world, point.x, point.y)?.id, 'litecoin-city');
  }
  assert.equal(floor.walls.length, 12);
  assert.deepEqual(auditCollisionWorld({ blockers: [...world.collisionBlockers, ...floor.walls], visibleBarriers: [] }).errors.filter((error) => /duplicate/i.test(error)), []);
  assert.deepEqual(gameplay.bossLockBlockers.map((wall) => wall.id), floor.walls.map((wall) => wall.id));
  assert.equal(BOSS_DEFINITIONS.liquidator.arenas.bell.id, 'margin-floor', 'the legacy table is untouched');
  assert.equal(gameplay.bossDefinitions.liquidator.arenas.bell.id, floor.id);
  assert.equal(gameplay.bossDefinitions.liquidator.triggerZone, BOSS_DEFINITIONS.liquidator.triggerZone);
  assert.equal(gameplay.bossDefinitions.liquidator.readyTick, HMH_V7_BOSSES.liquidator.readyTick);

  const slots = createBossSlots({ seed: 11, definitions: gameplay.bossDefinitions });
  const bell = gameplay.missionBossZones.find((row) => row.bossZone.kind === 'trigger');
  assert.equal(bossZoneArming(slots, bell.readyTick - 1).armed.has(bell.id), false);
  assert.equal(bossZoneArming(slots, bell.readyTick).armed.has(bell.id), true);
  const player = { x: floor.bell.x - 40, y: floor.bell.y, groundZ: 0, radius: 24 };
  const frame = stepBossSlots(slots, { tick: bell.readyTick, player, missionEvents: [{ type: 'boss-zone', zoneId: bell.id, ...bell.bossZone, zoneKind: 'trigger', tick: bell.readyTick }], level: 5 });
  // Nothing stands in a lock line, so every capsule closes on the trigger tick
  // and the floor seals at once.
  assert.deepEqual(frame.events.map((event) => event.type), ['boss-initiated', ...frame.closed.map(() => 'lock-closed'), 'boss-locked']);
  assert.equal(frame.closed.length, 12);
  assert.equal(frame.events[0].arenaId, floor.id);
  assert.equal(slots.slots.liquidator.arena.id, floor.id);
  assert.ok(slots.slots.liquidator.boss.x >= floor.bounds.minX && slots.slots.liquidator.boss.x <= floor.bounds.maxX);
  assert.equal(createBossSlots({ seed: 11 }).definitions, BOSS_DEFINITIONS, 'the legacy default is the legacy table');
  assert.deepEqual(gameplay.stubbedBosses.map((row) => row.bossId).sort(), ['51-percent-foreman', 'lockkeeper', 'rug-pull-baron']);
});

test('the entry, briefing and tables are deterministic and unofficial', () => {
  assert.deepEqual(selectWorldV2Entry(gameplay), { id: 'meadows', name: 'MWEB Meadows', x: 12500, y: 6700 });
  const briefing = resolveLevelBriefing({ entryId: 'meadows', seed: 3, briefing: gameplay.briefing });
  assert.equal(briefing.levelId, world.id);
  assert.ok(briefing.objective.length > 0 && briefing.watch.length > 0 && briefing.supply.length > 0 && briefing.tip.length > 0);
  assert.equal(resolveLevelBriefing({ entryId: 'meadows', seed: 3 }), null, 'the legacy briefing has no such entry');
  assert.equal(gameplay.officialRun, false);
  assert.equal(gameplay.rankedEligible, false);
  assert.equal(hash(createWorldV2Gameplay(createWorldV2RuntimeWorld())), hash(gameplay));
  assert.throws(() => createWorldV2Gameplay({ ...world, officialRun: true }), /unofficial/);
});
