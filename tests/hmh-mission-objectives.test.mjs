// Mission core v2 (design package §3.1-3.6 and 3.9, slice S1.4): the pure
// objective module on the shipped map. Quick, channel and seal modes, one
// active zone, held progress, the hit pause, docking, weapon stow, locked
// nodes, items, secrets (break or pry, then enter) and the v7 objective rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_OBJECTIVES,
  MISSION_RULES,
  createMissionState,
  stepMissionObjectives,
  settleMissionObjective,
  missionDockStep,
  missionActiveBlockers,
  missionSealTargets,
  applyMissionSealDamage,
  missionHiddenSecretProps,
  missionObjectiveRows,
  missionPresentation,
  MISSION_BOSS_ZONES,
} from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { LIQUIDATOR_DARK_POOL, LIQUIDATOR_MARGIN_FLOOR } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import { HMH_V7_OBJECTIVES, HMH_V7_RUN_RULES } from '../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';

const flat = () => ({ groundZ: 0, walkable: true });
const row = (id) => MISSION_OBJECTIVES.find((candidate) => candidate.id === id);
const still = { x: 0, y: 0 };
const east = { x: 1, y: 0 };

// Runs `count` ticks from `state.lastTick + 1` with one player position and
// input, collecting events. `extra` overrides step arguments per tick.
function run(state, count, { player, move = still, extra = () => ({}) } = {}) {
  const events = [];
  for (let index = 0; index < count; index += 1) {
    const tick = state.lastTick + 1;
    events.push(...stepMissionObjectives(state, { tick, player, move, queryGround: flat, ...extra(tick) }).events);
  }
  return events;
}
const at = (point, dx = 0, dy = 0) => ({ x: point.x + dx, y: point.y + dy, groundZ: 0 });

test('the objective table is frozen, sorted by id, and every row is a v7 contract objective of the same class and district', () => {
  assert.ok(Object.isFrozen(MISSION_OBJECTIVES));
  const ids = MISSION_OBJECTIVES.map((candidate) => candidate.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(new Set(ids).size, ids.length);
  for (const candidate of MISSION_OBJECTIVES) {
    const contract = HMH_V7_OBJECTIVES[candidate.id];
    assert.ok(contract, `${candidate.id} is a contract objective`);
    assert.equal(candidate.objectiveClass, contract.class, candidate.id);
    assert.equal(candidate.districtId, contract.district, candidate.id);
    assert.equal(candidate.xpPerLevel, HMH_V7_RUN_RULES.OBJECTIVE_XP_PER_LEVEL[contract.class], candidate.id);
    // A contract prerequisite is wired, never silently dropped.
    if (contract.requires) assert.equal(candidate.requires ?? candidate.openedBy, contract.requires, candidate.id);
  }
  // Today's six machines are switches, with the package's modes (§2.6).
  const modes = Object.fromEntries(WORLD_DESIGN_SITES.map((site) => [site.id, [row(site.id).mode, row(site.id).clip, row(site.id).fillTicks]]));
  assert.deepEqual(modes, {
    'relay-power': ['quick', 'press', 30],
    'ravine-winch': ['channel', 'crank', 90],
    'crossing-pump': ['channel', 'crank', 90],
    'hashwood-shrine': ['channel', 'crank', 90],
    'mining-valve': ['channel', 'crank', 90],
    'yard-warehouse': ['quick', 'lever', 45],
  });
  for (const site of WORLD_DESIGN_SITES) {
    assert.equal(row(site.id).operate.x, site.x);
    assert.equal(row(site.id).operate.y, site.y);
    assert.ok(['east', 'west'].includes(row(site.id).operate.facing), site.id);
  }
});

test('a quick node commits after 12 consecutive ticks inside, then finishes even when the hero leaves or is hit', () => {
  const node = row('relay-power');
  const state = createMissionState(7);
  const inside = at(node.operate, 20, 0);
  // Eleven ticks inside, then out: nothing commits and the count resets.
  run(state, MISSION_RULES.quick.commitTicks - 1, { player: inside, move: east });
  run(state, 1, { player: at(node.operate, 400, 0), move: east });
  run(state, MISSION_RULES.quick.commitTicks - 1, { player: inside, move: east });
  assert.equal(state.completed.size, 0);
  assert.equal(missionPresentation(state).zones.find((zone) => zone.zoneId === node.id).progress, 0);
  // The twelfth tick commits; the hero then runs away and takes hits.
  run(state, 1, { player: inside, move: east });
  const away = run(state, node.fillTicks - 2, { player: at(node.operate, 900, 0), move: east, extra: (tick) => ({ lastPlayerHitTick: tick - 1 }) });
  assert.equal(away.length, 0);
  assert.equal(state.stowed, false, 'a quick node committed on the move suspends nothing');
  const [done] = run(state, 1, { player: at(node.operate, 900, 0), move: east });
  assert.equal(done.type, 'objective-completed');
  assert.equal(done.objectiveId, 'relay-power');
});

test('a quick node committed while standing still plays its clip and stows the weapon until the hero moves', () => {
  const node = row('yard-warehouse');
  const state = createMissionState(7);
  run(state, MISSION_RULES.quick.commitTicks, { player: at(node.operate) });
  assert.equal(state.stowed, true);
  assert.equal(state.operating.clip, 'lever');
  run(state, 1, { player: at(node.operate, 4, 0), move: east });
  assert.equal(state.stowed, false, 'moving restores firing at once');
  run(state, 1, { player: at(node.operate, 4, 0) });
  assert.equal(state.stowed, false, 'the clip does not come back after the hero moved');
});

test('a channel fills only while the hero stands still in the ring, holds while moving inside, and holds for 120 ticks outside before draining 2 per tick', () => {
  const node = row('crossing-pump');
  const state = createMissionState(3);
  const zone = () => state.zoneState.get(node.id);
  run(state, 30, { player: at(node.operate, 10, 0) });
  assert.equal(zone().progress, 30);
  assert.equal(state.stowed, true, 'auto-fire and the knife pause while the channel clip plays');
  run(state, 10, { player: at(node.operate, 10, 0), move: east });
  assert.equal(zone().progress, 30, 'moving inside the ring holds the fill');
  assert.equal(state.stowed, false);
  const outside = at(node.operate, 300, 0);
  run(state, MISSION_RULES.channel.holdAfterLeaveTicks, { player: outside, move: east });
  assert.equal(zone().progress, 30, 'held for 120 ticks after leaving');
  run(state, 5, { player: outside, move: east });
  assert.equal(zone().progress, 30 - 5 * MISSION_RULES.channel.drainPerTick);
  // Back in and still: the fill resumes from what is left, never from zero.
  run(state, 1, { player: at(node.operate) });
  assert.equal(zone().progress, 21);
  run(state, node.fillTicks - 22, { player: at(node.operate) });
  assert.equal(state.completed.has(node.id), false);
  const [done] = run(state, 1, { player: at(node.operate) });
  assert.equal(done.objectiveId, node.id);
  assert.equal(state.stowed, false, 'the completion tick hands the weapon back');
});

test('being hit pauses the fill for 12 ticks, never stacks and never removes progress', () => {
  const node = row('mining-valve');
  const state = createMissionState(3);
  const zone = () => state.zoneState.get(node.id);
  run(state, 20, { player: at(node.operate) });
  // Tick 20 reads the hit of tick 19: no fill on ticks 20..31.
  run(state, 1, { player: at(node.operate), extra: () => ({ lastPlayerHitTick: 19 }) });
  assert.equal(zone().pausedUntil, 20 + MISSION_RULES.hitPauseTicks);
  assert.equal(zone().progress, 20);
  const hitTicks = new Set([25, 26]);
  run(state, 20, { player: at(node.operate), extra: (tick) => ({ lastPlayerHitTick: hitTicks.has(tick) ? tick - 1 : -1 }) });
  // Ticks 21..40: the hits read at 25 and 26 move the pause to 37 and then 38
  // (max, never a sum), so only 38, 39 and 40 fill.
  assert.equal(zone().pausedUntil, 26 + MISSION_RULES.hitPauseTicks);
  assert.equal(zone().progress, 23);
  assert.equal(state.stowed, true, 'a hit does not unstow: the hurt plays over the clip');
});

test('only one zone is active: the nearest eligible ring containing the hero, ties broken by id', () => {
  const objectives = Object.freeze([
    { id: 'a-left', objectiveClass: 'switch', districtId: 'frontier-relay', mode: 'channel', clip: 'crank', fillTicks: 10, ringRadius: 64, operate: { x: 0, y: 0, facing: 'east' }, anchor: { x: 0, y: 0 }, effects: [], xpPerLevel: 18 },
    { id: 'b-right', objectiveClass: 'switch', districtId: 'frontier-relay', mode: 'channel', clip: 'crank', fillTicks: 10, ringRadius: 64, operate: { x: 100, y: 0, facing: 'west' }, anchor: { x: 100, y: 0 }, effects: [], xpPerLevel: 18 },
  ]);
  const state = createMissionState(1, { objectives });
  run(state, 3, { player: { x: 60, y: 0, groundZ: 0 } });
  assert.equal(state.activeZoneId, 'b-right');
  assert.equal(state.zoneState.get('a-left').progress, 0);
  const tie = createMissionState(1, { objectives });
  run(tie, 3, { player: { x: 50, y: 0, groundZ: 0 } });
  assert.equal(tie.activeZoneId, 'a-left');
  assert.equal(tie.zoneState.get('b-right').progress, 0);
});

test('a seal ring fills only once its boss is ready and drains 4 per tick as soon as the hero leaves', () => {
  const objectives = Object.freeze([
    { id: 'seal', objectiveClass: 'switch', districtId: 'liquidation-yard', mode: 'seal', clip: 'press', fillTicks: 90, ringRadius: MISSION_RULES.seal.ringRadius, readyTick: 10, operate: { x: 0, y: 0, facing: 'east' }, anchor: { x: 0, y: 0 }, effects: [], xpPerLevel: 0 },
  ]);
  const state = createMissionState(1, { objectives });
  run(state, 10, { player: { x: 80, y: 0, groundZ: 0 } });
  assert.equal(state.zoneState.get('seal').progress, 0, 'not before readyTick');
  run(state, 20, { player: { x: 80, y: 0, groundZ: 0 } });
  assert.equal(state.zoneState.get('seal').progress, 20);
  run(state, 2, { player: { x: 200, y: 0, groundZ: 0 } });
  assert.equal(state.zoneState.get('seal').progress, 20 - 2 * MISSION_RULES.seal.drainPerTick);
});

test('channels need the hero on the ring height and in sight of the operate spot, excluding the node\'s own prop', () => {
  const node = row('ravine-winch');
  const handle = row('ravine-winch-handle');
  const state = createMissionState(2);
  // The winch is locked until the Winch Handle is carried.
  run(state, 20, { player: at(node.operate) });
  assert.equal(state.zoneState.get(node.id).progress, 0);
  assert.equal(missionPresentation(state).zones.find((zone) => zone.zoneId === node.id).state, 'locked');
  const [picked] = run(state, 1, { player: at(handle.anchor, 30, 0) });
  assert.equal(picked.objectiveId, 'ravine-winch-handle');
  assert.deepEqual(picked.effects, [{ type: 'grant', grant: 'item', itemId: 'ravine-winch-handle' }]);
  const excluded = [];
  run(state, 5, { player: { ...at(node.operate), groundZ: 64 } });
  run(state, 5, { player: at(node.operate), extra: () => ({ lineClear: (from, to, exclude) => { excluded.push(exclude); return false; } }) });
  assert.equal(state.zoneState.get(node.id).progress, 0);
  assert.ok(excluded.every((id) => id === node.propBlockerId));
  run(state, 5, { player: at(node.operate) });
  assert.equal(state.zoneState.get(node.id).progress, 5);
});

test('after 6 still ticks the hero docks onto the operate spot at 4 units a tick; move input cancels it', () => {
  const node = row('hashwood-shrine');
  const state = createMissionState(4);
  let player = at(node.operate, 40, 0);
  const glides = [];
  for (let index = 0; index < 30; index += 1) {
    const tick = state.lastTick + 1;
    const glide = missionDockStep(state, { player, move: still });
    if (glide) { glides.push(glide); player = { ...player, x: player.x + glide.x, y: player.y + glide.y }; }
    stepMissionObjectives(state, { tick, player, move: still, queryGround: flat });
  }
  assert.equal(glides.length, 10, '40 units at 4 units per tick');
  assert.ok(glides.every((glide) => Math.hypot(glide.x, glide.y) <= MISSION_RULES.dockStepUnits + 1e-9));
  assert.equal(player.x, node.operate.x);
  assert.equal(state.operating.facing, node.operate.facing);
  assert.equal(missionDockStep(state, { player: at(node.operate, 30, 0), move: east }), null, 'any move input cancels the glide');
  const early = createMissionState(4);
  run(early, MISSION_RULES.dockAfterStillTicks - 1, { player: at(node.operate, 40, 0) });
  assert.equal(missionDockStep(early, { player: at(node.operate, 40, 0), move: still }), null);
});

test('completing a switch opens its gate, completes the gate objective on the same tick after it, and grants in order', () => {
  const node = row('yard-warehouse');
  const state = createMissionState(9);
  const events = run(state, MISSION_RULES.quick.commitTicks + node.fillTicks - 1, { player: at(node.operate, 10, 0), move: east });
  assert.deepEqual(events.map((event) => event.objectiveId), ['yard-warehouse', 'yard-warehouse-gate']);
  assert.equal(events[0].tick, events[1].tick);
  assert.deepEqual(events[0].effects, [{ type: 'open-gate', gateId: 'yard-service-gate' }, { type: 'grant', grant: 'ammo' }]);
  assert.equal(events[0].xpPerLevel, 18);
  assert.equal(events[1].xpPerLevel, 30);
  assert.ok(state.openGates.has('yard-service-gate'));
  const blockers = [{ id: 'yard-service-gate' }, { id: 'other' }];
  assert.deepEqual(missionActiveBlockers(state, blockers), [blockers[1]]);
  // The level is the one just before each node's own grant, one at a time.
  assert.deepEqual(settleMissionObjective(state, 'yard-warehouse', 4), { baseXp: 72 });
  assert.deepEqual(settleMissionObjective(state, 'yard-warehouse-gate', 5), { baseXp: 150 });
  assert.throws(() => settleMissionObjective(state, 'yard-warehouse', 6), /already settled/);
  assert.throws(() => settleMissionObjective(state, 'crossing-pump', 6), /not completed/);
  // The valve toggles its steam trap.
  assert.deepEqual(row('mining-valve').effects.map((effect) => effect.type), ['open-gate', 'toggle-hazard']);
});

test('the farmstead secret opens by breaking its seal or prying it (kneel 60), then by entering the hidden volume', () => {
  const secret = row('farmstead-hidden-supplies');
  const pry = secret.seal.pry;
  assert.equal(pry.fillTicks, 60);
  assert.equal(secret.seal.hitPoints, 60);
  const broken = createMissionState(5);
  assert.equal(missionSealTargets(broken)[0].health, 60);
  run(broken, 3, { player: at(secret.anchor) });
  assert.equal(broken.completed.has(secret.id), false, 'the sealed volume cannot be entered');
  assert.ok(missionHiddenSecretProps(broken).has(`secret-prop:${secret.id}`));
  // Combat resolves after the mission step, so the seal breaks on tick 2 and
  // the volume can be entered from tick 3.
  assert.deepEqual(applyMissionSealDamage(broken, { sealId: secret.seal.id, health: 12, tick: 2 }), []);
  assert.equal(missionSealTargets(broken)[0].health, 12);
  const [opened] = applyMissionSealDamage(broken, { sealId: secret.seal.id, health: 0, tick: 2 });
  assert.deepEqual(opened, { type: 'seal-opened', sealId: secret.seal.id, objectiveId: secret.id, via: 'break', tick: 2 });
  assert.equal(missionSealTargets(broken).length, 0);
  assert.ok(broken.openGates.has(secret.seal.id));
  const [found] = run(broken, 1, { player: at(secret.anchor) });
  assert.equal(found.objectiveId, secret.id);
  assert.equal(found.xpPerLevel, 60);
  assert.deepEqual(found.effects, [{ type: 'grant', grant: 'silver', coins: 20 }, { type: 'grant', grant: 'ammo' }]);
  assert.equal(run(broken, 5, { player: at(secret.anchor) }).length, 0, 'once per run');

  const pried = createMissionState(5);
  const kneel = run(pried, pry.fillTicks, { player: at(pry) });
  assert.deepEqual(kneel.map((event) => [event.type, event.via]), [['seal-opened', 'pry']]);
  assert.equal(pried.seals.get(secret.seal.id), 0);
  assert.equal(pried.stowed, false);
  assert.equal(run(pried, 1, { player: at(pry) })[0].objectiveId, secret.id, 'the kneel spot is inside the hidden volume');
});

test('secrets need the same height and a clear line, and grant 20 silver plus their authored supply', () => {
  const ledge = row('ravine-surveyor-cache');
  const state = createMissionState(6);
  const high = (x, y) => ({ groundZ: Math.hypot(x - ledge.anchor.x, y - ledge.anchor.y) < 200 ? 64 : 0 });
  const step = (player, lineClear = () => true) => stepMissionObjectives(state, { tick: state.lastTick + 1, player, move: still, queryGround: high, lineClear }).events;
  assert.equal(step({ ...at(ledge.anchor), groundZ: 0 }).length, 0);
  assert.equal(step({ ...at(ledge.anchor), groundZ: 64 }, () => false).length, 0);
  const [found] = step({ ...at(ledge.anchor), groundZ: 64 });
  assert.deepEqual(found.effects, [{ type: 'grant', grant: 'silver', coins: 20 }, { type: 'grant', grant: 'heal', amount: 30 }]);
  assert.deepEqual(row('warehouse-logbook').effects, [{ type: 'grant', grant: 'silver', coins: 20 }]);
});

test('discovery uses the logical view of the simulated actor and never marks secrets', () => {
  const state = createMissionState(1);
  const node = row('crossing-pump');
  const view = (x, y) => ({ minX: x - 720, maxX: x + 720, minY: y - 450, maxY: y + 450 });
  run(state, 1, { player: at(node.operate, 800, 0), move: east, extra: () => ({ logicalView: view(node.operate.x + 800, node.operate.y) }) });
  assert.equal(state.discovered.has(node.id), false);
  run(state, 1, { player: at(node.operate, 700, 0), move: east, extra: () => ({ logicalView: view(node.operate.x + 700, node.operate.y) }) });
  assert.equal(state.discovered.has(node.id), true);
  run(state, 1, { player: at(row('warehouse-logbook').anchor, 400, 0), move: east, extra: () => ({ logicalView: view(row('warehouse-logbook').anchor.x, row('warehouse-logbook').anchor.y) }) });
  assert.equal(state.discovered.has('warehouse-logbook'), false);
});

test('v7 objective rows are dense in contract order with the settled level; ticks must be monotonic', () => {
  const state = createMissionState(8);
  const node = row('relay-power');
  const events = run(state, MISSION_RULES.quick.commitTicks + node.fillTicks - 1, { player: at(node.operate, 10, 0), move: east });
  for (const [index, event] of events.entries()) settleMissionObjective(state, event.objectiveId, 3 + index);
  const rows = missionObjectiveRows(state);
  assert.deepEqual(rows.map((entry) => entry.objectiveId), HMH_RUN_SUMMARY_CATALOGS_V7.objectives);
  for (const entry of rows) assert.deepEqual(Object.keys(entry), ['objectiveId', 'completed', 'tick', 'levelAtCompletion']);
  const done = rows.filter((entry) => entry.completed === 1);
  assert.deepEqual(done.map((entry) => [entry.objectiveId, entry.tick, entry.levelAtCompletion]), [
    ['relay-barn-doors', events[1].tick, 4],
    ['relay-power', events[0].tick, 3],
  ]);
  assert.ok(rows.filter((entry) => entry.completed === 0).every((entry) => entry.tick === 0 && entry.levelAtCompletion === 0));
  assert.throws(() => stepMissionObjectives(state, { tick: state.lastTick, player: at(node.operate), queryGround: flat }), /monotonic/);
});

test('the same inputs give the same events and state, and a fresh state holds nothing', () => {
  const script = (state) => {
    const events = [];
    const route = [row('relay-power'), row('crossing-pump'), row('yard-warehouse')];
    for (const node of route) events.push(...run(state, 150, { player: at(node.operate, 8, 0), extra: (tick) => ({ lastPlayerHitTick: tick % 37 === 0 ? tick - 1 : -1 }) }));
    return JSON.stringify({ events, completed: [...state.completed], zones: [...state.zoneState] });
  };
  assert.equal(script(createMissionState(11)), script(createMissionState(11)));
  const fresh = createMissionState(11);
  assert.equal(fresh.completed.size + fresh.openGates.size + fresh.discovered.size, 0);
  assert.equal(fresh.stowed, false);
});

// Slice S1.5: boss zones. The Closing Bell is a seal ring (the package's
// "button 90" as a stand-in-the-ring hold with drain, owner decision) and each
// floor has a retreat ring (channel 120). They re-arm, grant nothing and are
// never contract objectives; the boss slots arm them.
test('the Closing Bell fills only while its boss slot arms it, then re-arms instead of completing', () => {
  const bell = MISSION_BOSS_ZONES.find((zone) => zone.id === 'liquidator-closing-bell');
  assert.deepEqual([bell.mode, bell.fillTicks, bell.readyTick, bell.ringRadius, bell.objectiveClass], ['seal', 90, 36_000, MISSION_RULES.seal.ringRadius, 'boss-trigger']);
  assert.deepEqual(bell.operate, { x: LIQUIDATOR_MARGIN_FLOOR.bell.x, y: LIQUIDATOR_MARGIN_FLOOR.bell.y, facing: 'east' });
  assert.deepEqual(bell.bossZone, { bossId: 'liquidator', kind: 'trigger', trigger: 'bell' });
  const state = createMissionState(1);
  const spot = at(bell.operate);
  state.lastTick = 35_900;
  state.bossZoneArmed.add(bell.id);
  run(state, 99, { player: spot });
  assert.equal(state.zoneState.get(bell.id).progress, 0, 'a ring never fills before its readyTick');
  state.bossZoneArmed.clear();
  run(state, 30, { player: spot });
  assert.equal(state.zoneState.get(bell.id).progress, 0, 'nor while its slot is disarmed');
  state.bossZoneArmed.add(bell.id);
  const events = run(state, 90, { player: spot });
  assert.deepEqual(events.map((event) => [event.type, event.zoneId, event.bossId, event.zoneKind, event.trigger]), [['boss-zone', bell.id, 'liquidator', 'trigger', 'bell']]);
  assert.equal(events[0].tick, state.lastTick);
  assert.equal(state.completed.has(bell.id), false, 'a boss zone is never an objective');
  assert.equal(state.zoneState.get(bell.id).progress, 0, 'it re-arms from empty');
  assert.deepEqual(missionObjectiveRows(state).filter((entry) => entry.completed), []);
  // While it is armed the hero docks and stows the weapon, like any channel.
  run(state, 7, { player: spot });
  assert.equal(state.stowed, true);
  // Leaving drains it at 4 a tick, and disarming empties it.
  run(state, 1, { player: at(bell.operate, 200, 0) });
  assert.equal(state.zoneState.get(bell.id).progress, 7 - MISSION_RULES.seal.drainPerTick);
  run(state, 3, { player: spot });
  state.bossZoneArmed.clear();
  run(state, 1, { player: spot });
  assert.equal(state.zoneState.get(bell.id).progress, 0);
});

test('each floor has a retreat ring that fills in 120 still ticks only while armed', () => {
  const retreats = MISSION_BOSS_ZONES.filter((zone) => zone.bossZone.kind === 'retreat');
  assert.deepEqual(retreats.map((zone) => [zone.id, zone.mode, zone.fillTicks, zone.bossZone.arena]), [
    ['liquidator-retreat-dark-pool', 'channel', 120, 'dark-pool'],
    ['liquidator-retreat-margin-floor', 'channel', 120, 'margin-floor'],
  ]);
  assert.deepEqual(retreats.map((zone) => [zone.operate.x, zone.operate.y]), [
    [LIQUIDATOR_DARK_POOL.retreat.x, LIQUIDATOR_DARK_POOL.retreat.y], [LIQUIDATOR_MARGIN_FLOOR.retreat.x, LIQUIDATOR_MARGIN_FLOOR.retreat.y],
  ]);
  const zone = retreats[1];
  const state = createMissionState(2);
  run(state, 150, { player: at(zone.operate) });
  assert.equal(state.zoneState.get(zone.id).progress, 0);
  state.bossZoneArmed.add(zone.id);
  assert.deepEqual(run(state, 119, { player: at(zone.operate) }), []);
  const [event] = run(state, 1, { player: at(zone.operate) });
  assert.deepEqual([event.type, event.zoneKind, event.arena], ['boss-zone', 'retreat', 'margin-floor']);
  assert.equal(MISSION_BOSS_ZONES.every((entry) => entry.xpPerLevel === 0 && entry.effects.length === 0), true);
});
