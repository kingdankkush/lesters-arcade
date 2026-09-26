import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_DESIGN_SITES } from '../apps/hmh-reboot/src/world-design-encounters.mjs';
import { worldDesignHazardPhase, buildWorldDesignHazardHits, refreshWorldDesignGateNavigation } from '../apps/hmh-reboot/src/world-design-interactions.mjs';
import { MISSION_OBJECTIVES, createMissionState, stepMissionObjectives, missionActiveBlockers } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createEnemyNavGrid } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { BOSS_LOCK_BLOCKERS, LIQUIDATOR_MARGIN_FLOOR } from '../apps/hmh-reboot/src/boss-arenas.mjs';

// Mission core v2 (S1.4) owns the machinery; these checks keep the world side:
// the valve's steam trap, gate colliders and the navgrid patch and reset.
const flat = () => ({ groundZ: 0 });
const handle = MISSION_OBJECTIVES.find((row) => row.id === 'ravine-winch-handle');
// Stands still on the site's operate spot until it completes (carrying the
// Winch Handle first where the machine needs it); returns the completion tick.
function operate(state, site) {
  const step = (player) => stepMissionObjectives(state, { tick: state.lastTick + 1, player: { ...player, groundZ: 0 }, move: { x: 0, y: 0 }, queryGround: flat }).events;
  if (site.id === 'ravine-winch' && !state.completed.has(handle.id)) step(handle.anchor);
  for (let guard = 0; guard < 400; guard += 1) {
    step(site);
    if (state.completed.has(site.id)) return state.completed.get(site.id);
  }
  throw new Error(`${site.id} never completed`);
}

test('opened gates remove only their own blocker and reset with a new session', () => {
  const site = WORLD_DESIGN_SITES[0], state = createMissionState(1);
  const blockers = [{ id: site.gateId }, { id: 'other-wall' }];
  assert.equal(missionActiveBlockers(state, blockers).length, 2);
  operate(state, site);
  assert.deepEqual(missionActiveBlockers(state, blockers), [blockers[1]]);
  assert.equal(missionActiveBlockers(createMissionState(1), blockers).length, 2);
});

test('steam warns before becoming dangerous, ends and cannot be farmed by repeating the valve', () => {
  const site = WORLD_DESIGN_SITES.find((s) => s.kind === 'vent'), state = createMissionState(1);
  const complete = operate(state, site);
  assert.equal(complete, site.holdTicks - 1);
  assert.equal(worldDesignHazardPhase(state, site, complete).phase, 'warning');
  assert.equal(worldDesignHazardPhase(state, site, complete + site.hazard.warningTicks - 1).phase, 'warning');
  assert.equal(worldDesignHazardPhase(state, site, complete + site.hazard.warningTicks).phase, 'active');
  assert.equal(worldDesignHazardPhase(state, site, complete + site.hazard.warningTicks + site.hazard.durationTicks).phase, 'spent');
  // Standing on the spent valve never completes it again.
  for (let index = 0; index < 200; index += 1) stepMissionObjectives(state, { tick: state.lastTick + 1, player: { ...site, groundZ: 0 }, queryGround: flat });
  assert.equal(state.completed.get(site.id), complete);
});

test('steam uses real combat resolution, respects walls and height, and retains environmental attribution', () => {
  const site = WORLD_DESIGN_SITES.find((s) => s.kind === 'vent'), state = createMissionState(1);
  const complete = operate(state, site);
  const target = { id: 'enemy', x: site.hazard.x, y: site.hazard.y, groundZ: 0 };
  const tick = Math.ceil((complete + site.hazard.warningTicks + 1) / 30) * 30;
  const args = { tick, targets: [target], queryGround: flat };
  const hits = buildWorldDesignHazardHits(state, args);
  const result = resolveCombatHits({ sessionSeed: 7, hits, targets: [{ id: 'enemy', health: 4, maxHealth: 20, armor: 1, shieldCharges: 0 }] });
  assert.equal(result.targets.enemy.health, 0);
  assert.equal(result.scoreEvents[0].weaponId, 'world-steam');
  assert.notEqual(result.scoreEvents[0].sourceId, 'player');
  assert.equal(buildWorldDesignHazardHits(state, { ...args, lineClear: () => false }).length, 0);
  assert.equal(buildWorldDesignHazardHits(state, { ...args, targets: [{ ...target, groundZ: 64 }] }).length, 0);
  assert.equal(buildWorldDesignHazardHits(state, { ...args, tick: tick + 1 }).length, 0);
});

test('the exact runtime restart loop recloses previously opened gate navigation', () => {
  const queryGround = createLevelOneGroundQuery();
  const navGrid = createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround });
  const arrays = grid => Object.fromEntries(Object.entries(grid).filter(([,v]) => ArrayBuffer.isView(v)).map(([k,v]) => [k,Array.from(v)]));
  const closed = arrays(navGrid);
  const state = createMissionState(1);
  for (const site of WORLD_DESIGN_SITES) operate(state, site);
  assert.ok(state.openGates.size > 0);
  const active = missionActiveBlockers(state, LEVEL_ONE_WORLD.collisionBlockers);
  for (const gateId of state.openGates) refreshWorldDesignGateNavigation(navGrid, LEVEL_ONE_WORLD, queryGround, gateId, active);
  assert.notDeepEqual(arrays(navGrid), closed, 'opening actual gates must change navigation');
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  // S1.5: a restart also reopens the previous run's boss locks.
  const locks = LIQUIDATOR_MARGIN_FLOOR.walls;
  const lockWorld = { collisionBlockers: BOSS_LOCK_BLOCKERS };
  for (const wall of locks) refreshWorldDesignGateNavigation(navGrid, lockWorld, queryGround, wall.id, [...active, ...locks]);
  const restart = source.match(/for\(const gateId of missionState\.openGates\)[^\n]+\n(?:\s*\/\/[^\n]*\n)*\s*for\(const wallId of bossSlots[^\n]+\n\s*WORLD_BLOCKERS=[^\n]+\n\s*missionState=[^\n]+;/)?.[0];
  assert.ok(restart, 'inspect the actual runtime reset, not a copied implementation');
  const bossSlots = { slots: { liquidator: { closedWalls: locks.map((wall) => wall.id) } } };
  const context = { missionState: state, bossSlots, BOSS_LOCK_WORLD: lockWorld, navGrid, LEVEL_ONE_WORLD, queryGround, refreshWorldDesignGateNavigation, createMissionState, payload: { session: { seed: 9 } } };
  runInNewContext(restart, context);
  assert.deepEqual(arrays(navGrid), closed, 'gates and boss locks both reopen');
  assert.equal(context.missionState.openGates.size, 0);
  assert.equal(context.missionState.seed, 9, 'the new run is seeded from its session');
  assert.equal(context.WORLD_BLOCKERS, LEVEL_ONE_WORLD.collisionBlockers);
});

test('every site opens exactly its own court gate once, and the gate ids are unique real colliders', () => {
  const state = createMissionState(1), opened = [];
  for (const site of WORLD_DESIGN_SITES) {
    const before = state.openGates.size;
    operate(state, site);
    assert.equal(state.openGates.size, before + 1, `${site.id} opens one gate`);
    assert.ok(state.openGates.has(site.gateId), site.id);
    opened.push(site.gateId);
    assert.ok(LEVEL_ONE_WORLD.collisionBlockers.some(b => b.id === site.gateId), site.gateId);
  }
  assert.equal(new Set(opened).size, WORLD_DESIGN_SITES.length);
  assert.equal(missionActiveBlockers(state, LEVEL_ONE_WORLD.collisionBlockers).length, LEVEL_ONE_WORLD.collisionBlockers.length - WORLD_DESIGN_SITES.length);
});
