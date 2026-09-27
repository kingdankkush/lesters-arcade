// Design package S1.2: the enemy AI kit is simulation, so the same seed must
// give the same run. scripts/hmh-sim-digest.mjs mirrors main.mjs's tick order
// against the real Level 1 world, collision and navgrid, with the kit wired
// exactly as main wires it (director lairs, intent, poise, hit-stop, leash,
// swept pressure, tell geometry). Also the clearance layers it routes by.
import assert from 'node:assert/strict';
import test from 'node:test';

import { runSimDigestScenario } from '../scripts/hmh-sim-digest.mjs';
import { ENEMY_CLEARANCE_LAYERS, clearanceLayerForRadius, computeEnemyFlowField, createEnemyNavGrid } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';

const TICKS = 4_800;

test('the kit director scenario is same-seed identical, seed sensitive and differs from the pre-kit steps', () => {
  const first = runSimDigestScenario({ scenario: 'director', seed: 20_260_926, ticks: TICKS });
  const second = runSimDigestScenario({ scenario: 'director', seed: 20_260_926, ticks: TICKS });
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.counters, second.counters);
  assert.notEqual(runSimDigestScenario({ scenario: 'director', seed: 20_260_927, ticks: TICKS }).digest, first.digest);
  const legacy = runSimDigestScenario({ scenario: 'director', seed: 20_260_926, ticks: TICKS, enemyKit: false });
  assert.notEqual(legacy.digest, first.digest, 'the kit is live in the mirror');
  assert.ok(first.counters.directorInsertions >= legacy.counters.directorInsertions * 0.8, 'the shipped map keeps its spawn rate under the lair rules');
});

test('the kit crowd scenario is same-seed identical and freezes on kills (hit-stop)', () => {
  const first = runSimDigestScenario({ scenario: 'crowd', seed: 7, ticks: 900 });
  const second = runSimDigestScenario({ scenario: 'crowd', seed: 7, ticks: 900 });
  assert.equal(first.digest, second.digest);
  assert.ok(first.counters.hitStopTicks > 0, 'kills and crits froze the crowd');
  assert.ok(first.counters.hitStopTicks < 900 * 0.25, 'the cooldown keeps the freeze short');
});

test('clearance layers keep the base grid byte-identical and route a large body on a subset of it', () => {
  const grid = createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround: createLevelOneGroundQuery() });
  assert.deepEqual(ENEMY_CLEARANCE_LAYERS, [28, 30, 36]);
  assert.equal(clearanceLayerForRadius(20), 0);
  assert.equal(clearanceLayerForRadius(36), 3);
  let narrow = 0;
  for (let cell = 0; cell < grid.walkable.length; cell += 1) {
    if (!grid.walkable[cell]) assert.equal(grid.clearance[cell], 0);
    else if (grid.clearance[cell] < 3) narrow += 1;
  }
  assert.ok(narrow > 200, `the shipped map has trails a Whale should not scrape (${narrow} cells)`);
  const base = computeEnemyFlowField({ grid, targetX: 800, targetY: 2400 });
  const whale = computeEnemyFlowField({ grid, targetX: 800, targetY: 2400, minClearance: 3 });
  let reached = 0;
  for (let cell = 0; cell < grid.walkable.length; cell += 1) {
    if (whale.distance[cell] < 0) continue;
    reached += 1;
    assert.equal(grid.clearance[cell], 3);
    assert.ok(base.distance[cell] >= 0 && whale.distance[cell] >= base.distance[cell], 'a detour is never shorter');
  }
  assert.ok(reached > grid.walkable.length * 0.5);
});
