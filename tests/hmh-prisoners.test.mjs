// Prisoners (design package 3.5, build ledger slice 8): the seeded deal from
// the sdk, the six placed cages measured on the shipped map, the kneel
// channel through the mission core, the four kinds' rewards and stations, the
// OG Miner's unmultiplied level span, the v7 prisoners rows, and the dark
// default.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  OG_MINER_XP_PER_LEVEL,
  PRISONERS_LIVE_DEFAULT,
  PRISONER_RULES,
  prisonerMissionRows,
  prisonerRows,
  rescuePrisoner,
  startPrisonerTimedEffect,
  stepPrisonerStations,
} from '../apps/hmh-reboot/src/prisoners.mjs';
import { MISSION_OBJECTIVES, MISSION_RULES, createMissionState, missionPresentation, settleMissionObjective, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { selectMissionTrack } from '../apps/hmh-reboot/src/mission-guidance.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery, getLevelOneDistrictAt } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { WORLD_HAZARD_RULES } from '../apps/hmh-reboot/src/world-hazards.mjs';
import { OBJECTIVE_REWARDS } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { createEnemyNavGrid, computeEnemyFlowField } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { createCollectibleState, getCollectibleSnapshot } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { createRunProgression, grantRunLevelSpan, grantRunXp } from '../apps/hmh-reboot/src/run-progression.mjs';
import { HMH_V7_PRISONER_SLOTS, HMH_V7_RUN_RULES, dealHmhPrisoners } from '../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v7.mjs';

const queryGround = createLevelOneGroundQuery();
const hero = createCollisionBody({ id: 'player', kind: 'player', radius: world.player.radius, minZ: 0, maxZ: 56 });
const SLOTS = HMH_RUN_SUMMARY_CATALOGS_V7.prisonerSlots;
const FIELD = SLOTS.filter((slotId) => !HMH_V7_PRISONER_SLOTS[slotId].heldBy);

test('the deal is the sdk\'s dealHmhPrisoners on the session seed; the six field cages are placed and the held ones wait for their bosses', () => {
  assert.equal(PRISONERS_LIVE_DEFAULT, false);
  for (const seed of [0, 1337, 7, 424242, 0xffffffff]) {
    const rows = prisonerMissionRows(seed);
    const deal = dealHmhPrisoners(seed);
    assert.deepEqual(rows.map((row) => row.id), FIELD, 'field slots in catalogue order');
    for (const row of rows) {
      assert.equal(row.prisonerKind, deal[SLOTS.indexOf(row.id)], `${seed} ${row.id}`);
      assert.equal(row.districtId, HMH_V7_PRISONER_SLOTS[row.id].district);
      assert.deepEqual([row.mode, row.clip, row.fillTicks, row.ringRadius, row.xpPerLevel], ['channel', 'kneel', 90, 64, 0]);
    }
  }
  // The contract's fixed vectors, through the rows.
  assert.deepEqual(prisonerMissionRows(0).map((row) => row.prisonerKind), dealHmhPrisoners(0).slice(2));
  assert.deepEqual(dealHmhPrisoners(1337), ['og-miner', 'field-medic', 'quartermaster', 'field-medic', 'pawnbroker', 'quartermaster', 'og-miner', 'pawnbroker']);
});

test('the cages meet the machines\' placement rules on the shipped map: fit, dry one-height ring, spacing, hazards, district, reach', () => {
  const rows = prisonerMissionRows(0);
  const state = createMissionState(0, { prisoners: rows });
  const item = MISSION_OBJECTIVES.find((row) => row.mode === 'touch');
  const others = [...state.zones.filter((zone) => zone.kind !== 'prisoner').map((zone) => ({ id: zone.id, x: zone.x, y: zone.y })), { id: item.id, ...item.anchor }];
  const hazards = [
    ...world.interactions.hazards.filter((hazard) => WORLD_HAZARD_RULES[hazard.kind] && hazard.kind !== 'area-slow').map((hazard) => ({ id: hazard.id, ...hazard.anchor, radius: WORLD_HAZARD_RULES[hazard.kind].radius ?? WORLD_HAZARD_RULES[hazard.kind].halfLength })),
    ...WORLD_DESIGN_SITES.filter((site) => site.hazard).map((site) => ({ id: `${site.id}:steam`, x: site.hazard.x, y: site.hazard.y, radius: site.hazard.radius })),
  ];
  const grid = createEnemyNavGrid({ world, queryGround });
  const zones = state.zones.filter((zone) => zone.kind === 'prisoner');
  assert.equal(zones.length, 6);
  for (const zone of zones) {
    const row = rows.find((candidate) => candidate.id === zone.id);
    assert.ok(['east', 'west'].includes(zone.facing), zone.id);
    assert.equal(Math.abs(row.anchor.x - zone.x), 46, `${zone.id} cage sits 46 along the facing`);
    const fit = resolveSweptCircleMotion({ body: hero, start: { x: zone.x, y: zone.y, z: queryGround(zone.x, zone.y).groundZ }, delta: { x: 0, y: 0 }, blockers: world.collisionBlockers, bounds: world.bounds });
    assert.equal(fit.depenetrations.length, 0, `${zone.id} operate spot clips ${fit.depenetrations.map((entry) => entry.blockerId)}`);
    const centreZ = queryGround(zone.x, zone.y).groundZ;
    for (let step = 0; step < 24; step += 1) {
      for (const fraction of [0, 0.5, 1]) {
        const ground = queryGround(zone.x + Math.cos(step * Math.PI / 12) * zone.ringRadius * fraction, zone.y + Math.sin(step * Math.PI / 12) * zone.ringRadius * fraction);
        assert.ok(ground.walkable && !ground.deepWater && ground.kind !== 'water', `${zone.id} ring is dry`);
        assert.ok(Math.abs(ground.groundZ - centreZ) <= MISSION_RULES.heightBand, `${zone.id} ring is one height`);
      }
    }
    for (const other of [...others, ...zones.filter((candidate) => candidate !== zone)]) {
      assert.ok(Math.hypot(other.x - zone.x, other.y - zone.y) >= 300, `${zone.id} is 300+ from ${other.id}`);
    }
    for (const hazard of hazards) assert.ok(Math.hypot(hazard.x - zone.x, hazard.y - zone.y) >= hazard.radius + 100, `${zone.id} is clear of ${hazard.id}`);
    for (const reward of OBJECTIVE_REWARDS) assert.ok(Math.hypot(reward.x - zone.x, reward.y - zone.y) >= 120, `${zone.id} is 120+ from ${reward.id}`);
    assert.equal(getLevelOneDistrictAt(zone.x, zone.y)?.id, HMH_V7_PRISONER_SLOTS[zone.id].district, `${zone.id} is in its catalogue district`);
    const field = computeEnemyFlowField({ grid, targetX: zone.x, targetY: zone.y });
    assert.ok(field.distance[grid.cellAt(world.player.spawn.x, world.player.spawn.y)] > 0, `${zone.id} is reachable from the spawn`);
  }
});

function kneel(state, zone, { from = 1, ticks, hitTicks = [], moveTicks = [] }) {
  const events = [];
  for (let tick = from; tick < from + ticks; tick += 1) {
    const frame = stepMissionObjectives(state, {
      tick, player: { x: zone.x, y: zone.y, groundZ: queryGround(zone.x, zone.y).groundZ },
      move: moveTicks.includes(tick) ? { x: 1, y: 0 } : { x: 0, y: 0 },
      lastPlayerHitTick: hitTicks.includes(tick - 1) ? tick - 1 : -1, queryGround,
    });
    events.push(...frame.events);
  }
  return events;
}

test('a cage is a kneel channel of the mission core: 90 still ticks free the prisoner once; a hit pauses it, moving holds it', () => {
  const rows = prisonerMissionRows(1337);
  const state = createMissionState(1337, { prisoners: rows });
  const zone = state.zones.find((candidate) => candidate.id === 'p3-crossing-boathouse');
  let events = kneel(state, zone, { ticks: 89 });
  assert.equal(events.length, 0);
  assert.equal(state.operating.clip, 'kneel');
  assert.equal(state.stowed, true);
  events = kneel(state, zone, { from: 90, ticks: 1 });
  assert.deepEqual(events.map((event) => [event.type, event.slotId, event.prisonerKind, event.tick]), [['prisoner-rescued', 'p3-crossing-boathouse', 'pawnbroker', 90]]);
  assert.equal(state.rescued.get('p3-crossing-boathouse'), 90);
  assert.equal(kneel(state, zone, { from: 91, ticks: 200 }).length, 0, 'once');
  assert.equal(missionPresentation(state).zones.find((candidate) => candidate.zoneId === zone.id).state, 'done');
  // A hit on tick 10 pauses the fill for 12 ticks; a moving tick holds it.
  const paused = createMissionState(1337, { prisoners: rows });
  const events2 = kneel(paused, zone, { ticks: 120, hitTicks: [10], moveTicks: [40, 41] });
  const [rescue] = events2.filter((event) => event.type === 'prisoner-rescued');
  assert.equal(rescue.tick, 90 + 12 + 2);
  // No prisoners: the zones and a run are exactly the machines' (dark default).
  assert.deepEqual(createMissionState(1337).zones.map((candidate) => candidate.id), createMissionState(1337, { prisoners: [] }).zones.map((candidate) => candidate.id));
  assert.equal(createMissionState(1337).zones.some((candidate) => candidate.kind === 'prisoner'), false);
});

test('discovered prisoners are tracked at priority 4; a rescued one is not', () => {
  const rows = prisonerMissionRows(0);
  const state = createMissionState(0, { prisoners: rows });
  const row = rows.find((candidate) => candidate.id === 'p5-mining-bench');
  // Every earlier priority is exhausted in Mining once its chain is done.
  for (const objective of state.objectives) state.completed.set(objective.id, 1);
  const player = { x: row.operate.x + 200, y: row.operate.y };
  assert.equal(selectMissionTrack(state, { player, districtId: 'mining-camp' }), null, 'undiscovered');
  state.discovered.add(row.id);
  assert.equal(selectMissionTrack(state, { player, districtId: 'mining-camp' }).id, row.id);
  state.rescued.set(row.id, 5);
  assert.equal(selectMissionTrack(state, { player, districtId: 'mining-camp' }), null);
});

const rowOfKind = (seed, kind) => {
  const rows = prisonerMissionRows(seed);
  return rows.find((row) => row.prisonerKind === kind);
};

test('Field Medic: a 50-HP pool heals the missing HP; the rest waits in the open cage and is dispensed when the hero is hurt there', () => {
  const mission = createMissionState(0, { prisoners: prisonerMissionRows(0) });
  const row = rowOfKind(0, 'field-medic');
  const needs = { health: 80, maxHealth: 100, grenades: 3, maxGrenades: 3, needsAmmo: false };
  assert.deepEqual(rescuePrisoner(mission, row, { tick: 10, ...needs }), [{ grant: 'heal', amount: 20 }]);
  assert.equal(mission.prisonerStations.get(row.id).heal, 30);
  const at = { x: row.operate.x, y: row.operate.y };
  assert.deepEqual(stepPrisonerStations(mission, { hero: { x: at.x + 200, y: at.y }, ...needs, health: 10 }), [], 'away from the cage');
  assert.deepEqual(stepPrisonerStations(mission, { hero: at, ...needs, health: 100 }), [], 'unhurt');
  assert.deepEqual(stepPrisonerStations(mission, { hero: at, ...needs, health: 90 }), [{ grant: 'heal', amount: 10 }]);
  assert.deepEqual(stepPrisonerStations(mission, { hero: at, ...needs, health: 10 }), [{ grant: 'heal', amount: 20 }]);
  assert.equal(mission.prisonerStations.has(row.id), false, 'emptied');
});

test('Quartermaster: the refill and +3 grenades are each handed over when there is room; he leaves once both are', () => {
  const mission = createMissionState(0, { prisoners: prisonerMissionRows(0) });
  const row = rowOfKind(0, 'quartermaster');
  const full = { health: 100, maxHealth: 100, grenades: 3, maxGrenades: 3, needsAmmo: false };
  assert.deepEqual(rescuePrisoner(mission, row, { tick: 10, ...full, needsAmmo: true }), [{ grant: 'ammo' }]);
  const at = { x: row.operate.x, y: row.operate.y };
  assert.deepEqual(stepPrisonerStations(mission, { hero: at, ...full }), []);
  assert.deepEqual(stepPrisonerStations(mission, { hero: at, ...full, grenades: 1 }), [{ grant: 'grenades', amount: PRISONER_RULES.quartermasterGrenades }]);
  assert.equal(mission.prisonerStations.has(row.id), false);
});

test('Pawnbroker: Berserk and Dilation for 900 ticks each, refreshed to max(remaining, 900), never stacked; they count as active, not collected', () => {
  const mission = createMissionState(0, { prisoners: prisonerMissionRows(0) });
  const row = rowOfKind(0, 'pawnbroker');
  const grants = rescuePrisoner(mission, row, { tick: 10, health: 100, maxHealth: 100, grenades: 3, maxGrenades: 3, needsAmmo: false });
  assert.deepEqual(grants, [{ grant: 'timed', effectId: 'berserk-candle', durationTicks: 900 }, { grant: 'timed', effectId: 'time-dilation', durationTicks: 900 }]);
  assert.equal(mission.prisonerStations.size, 0);
  const placements = world.pointsOfInterest.slice(0, 10).map((poi, index) => ({ id: `p${index}`, assetId: 'coin-blaster', x: 100 + index, y: 100 }));
  const collectibles = createCollectibleState({ placements });
  // An effect already running 1,200 more ticks keeps them; one with 100 left rises to 900.
  collectibles.activeEffects.set('berserk-candle', { effectId: 'berserk-candle', collectedTick: 0, expiresTick: 1_210, damageMultiplier: 2, speedMultiplier: 1, refreshCount: 0 });
  collectibles.activeEffects.set('time-dilation', { effectId: 'time-dilation', collectedTick: 0, expiresTick: 110, damageMultiplier: 1, speedMultiplier: 1.2, refreshCount: 0 });
  for (const grant of grants) startPrisonerTimedEffect(collectibles, { ...grant, tick: 10 });
  const snapshot = getCollectibleSnapshot(collectibles, { tick: 10 });
  assert.deepEqual(snapshot.activeEffects.map((effect) => [effect.effectId, effect.expiresTick]), [['berserk-candle', 1_210], ['time-dilation', 910]]);
  assert.deepEqual([snapshot.damageMultiplier, snapshot.speedMultiplier, snapshot.collectedCount], [2, 1.2, 0]);
  const fresh = createCollectibleState({ placements });
  startPrisonerTimedEffect(fresh, { effectId: 'berserk-candle', durationTicks: 900, tick: 50 });
  assert.equal(fresh.activeEffects.get('berserk-candle').expiresTick, 950);
});

test('OG Miner: exactly one level span, 300 x the current level, never multiplied and with no score', () => {
  const mission = createMissionState(0, { prisoners: prisonerMissionRows(0) });
  const row = rowOfKind(0, 'og-miner');
  assert.deepEqual(rescuePrisoner(mission, row, { tick: 10, health: 100, maxHealth: 100, grenades: 3, maxGrenades: 3, needsAmmo: false }), [{ grant: 'level-span' }]);
  assert.equal(OG_MINER_XP_PER_LEVEL, HMH_V7_RUN_RULES.OG_MINER_XP_PER_LEVEL);
  const progression = createRunProgression({ seed: 3, ownedWeaponIds: ['coin-blaster'] });
  grantRunXp(progression, 900, 1);
  // Validator Training's XP multiplier (x1.75 at rank 3) never touches the span.
  progression.ranks['validator-training'] = 3;
  const before = { xp: progression.xp, level: progression.level, score: progression.score };
  const snapshot = grantRunLevelSpan(progression, OG_MINER_XP_PER_LEVEL, 20);
  assert.equal(progression.xp - before.xp, 300 * before.level);
  assert.equal(progression.level, before.level + 1);
  assert.equal(progression.score, before.score);
  assert.equal(snapshot.pendingLevels >= 1, true);
});

test('the v7 prisoners rows: dense, catalogue order, rescue tick and levelAtRescue; the shared schema accepts them (S3)', () => {
  const rows = prisonerMissionRows(0);
  const state = createMissionState(0, { prisoners: rows });
  const zone = state.zones.find((candidate) => candidate.id === 'p1-relay-barn-yard');
  kneel(state, zone, { ticks: 90 });
  assert.equal(prisonerRows(state)[SLOTS.indexOf('p1-relay-barn-yard')].levelAtRescue, 0, 'unsettled until main records the level');
  settleMissionObjective(state, 'p1-relay-barn-yard', 1);
  const emitted = prisonerRows(state);
  assert.deepEqual(emitted.map((row) => row.slotId), SLOTS);
  assert.deepEqual(emitted.find((row) => row.slotId === 'p1-relay-barn-yard'), { slotId: 'p1-relay-barn-yard', rescued: 1, tick: 90, levelAtRescue: 1 });
  assert.equal(emitted.filter((row) => row.rescued).length, 1);
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/ranked/hmh-v7-districts.json', import.meta.url), 'utf8')).body.evidence.runSummary;
  assert.equal(validateRunSummaryPayload({ ...fixture, prisoners: emitted }), '');
  assert.match(validateRunSummaryPayload({ ...fixture, prisoners: emitted.map((row) => (row.rescued ? { ...row, levelAtRescue: 0 } : row)) }), /prisoner/i);
  assert.deepEqual(prisonerRows(createMissionState(0)).map((row) => row.rescued), SLOTS.map(() => 0));
});

test('main wiring: the flag is dark by default, ?prisoners=1 only under evidenceSafe outside Ranked, and rescues settle their level first', () => {
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const prisonersEnabled = PRISONERS_LIVE_DEFAULT \|\| \(evidenceGameplayEnabled && runtimeParams\.get\('prisoners'\) === '1'\);/);
  assert.match(main, /createMissionState\(payload\.session\.seed,\{prisoners:prisonersEnabled\?prisonerMissionRows\(payload\.session\.seed\):\[\]\}\)/);
  const rescue = main.slice(main.indexOf("if (event.type === 'prisoner-rescued')"));
  assert.ok(rescue.indexOf('settleMissionObjective(missionState, event.slotId, runProgression.level)') < rescue.indexOf('applyPrisonerGrants(rescuePrisoner('));
});
