import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENEMY_NAV_CELL_SIZE,
  createEnemyNavGrid,
  computeEnemyFlowField,
  sampleFlowDirection,
  navLineBlocked,
} from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { readFileSync } from 'node:fs';

import {
  createEnemyPopulation,
  createEnemyState,
  planEnemyIntent,
  stepEnemyPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';

// Owner playtest 2026-07-31: "Enemy AI behaviors and pathing is terrible not
// knowing how to move around walls." These tests encode MAP-REDO slice 3: a
// deterministic navgrid + flow field over the world contract so enemies route
// around blockers instead of pressing into them.

const queryGround = createLevelOneGroundQuery();

function buildGrid() {
  return createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround });
}

test('the navgrid marks blocker interiors unwalkable and open ground walkable', () => {
  const grid = buildGrid();
  assert.ok(grid.columns > 0 && grid.rows > 0);
  // Inside the yard-north-building footprint.
  assert.equal(grid.isWalkableAt(10_900, 620), false, 'building interior must be unwalkable');
  // Deep river water.
  assert.equal(grid.isWalkableAt(4_700, 1_700), false, 'deep water must be unwalkable');
  // Open relay ground near spawn.
  assert.equal(grid.isWalkableAt(800, 2_400), true, 'spawn ground must be walkable');
  // The proof-of-work bridge deck must be walkable so enemies can cross.
  assert.equal(grid.isWalkableAt(4_750, 2_400), true, 'bridge deck must be walkable');
});

test('navgrid construction and flow fields are deterministic', () => {
  const first = buildGrid();
  const second = buildGrid();
  assert.deepEqual([...first.walkable], [...second.walkable]);
  const fieldA = computeEnemyFlowField({ grid: first, targetX: 800, targetY: 2_400 });
  const fieldB = computeEnemyFlowField({ grid: second, targetX: 800, targetY: 2_400 });
  assert.deepEqual([...fieldA.directions], [...fieldB.directions]);
});

test('the flow field routes around a wall instead of pointing through it', () => {
  const grid = buildGrid();
  // Player west of the relay gate fence run; enemy directly east of it. The
  // straight line crosses relay-gate-north, so the flow must divert.
  const player = { x: 1_450, y: 1_940 };
  const enemy = { x: 1_950, y: 1_940 };
  assert.equal(navLineBlocked(grid, enemy.x, enemy.y, player.x, player.y), true, 'test setup: the straight line must cross the gate fence');
  const field = computeEnemyFlowField({ grid, targetX: player.x, targetY: player.y });
  // Greedy-follow the field; it must reach the player's cell without ever
  // entering an unwalkable cell, which proves the field routes around.
  let x = enemy.x;
  let y = enemy.y;
  let arrived = false;
  for (let step = 0; step < 400; step += 1) {
    const direction = sampleFlowDirection(grid, field, x, y);
    if (!direction) break;
    x += direction.x * ENEMY_NAV_CELL_SIZE * 0.5;
    y += direction.y * ENEMY_NAV_CELL_SIZE * 0.5;
    assert.equal(grid.isWalkableAt(x, y), true, `flow led into a wall at ${Math.round(x)},${Math.round(y)}`);
    if (Math.hypot(x - player.x, y - player.y) <= ENEMY_NAV_CELL_SIZE) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived, 'greedy flow-field following must reach the player around the wall');
});

test('diagonal flow never cuts a blocked corner', () => {
  const grid = buildGrid();
  const field = computeEnemyFlowField({ grid, targetX: 800, targetY: 2_400 });
  for (let row = 1; row < grid.rows - 1; row += 1) {
    for (let column = 1; column < grid.columns - 1; column += 1) {
      const direction = field.directionAtCell(column, row);
      if (!direction || direction.x === 0 || direction.y === 0) continue;
      const horizontalOpen = grid.isWalkableCell(column + direction.x, row);
      const verticalOpen = grid.isWalkableCell(column, row + direction.y);
      assert.ok(horizontalOpen && verticalOpen, `corner cut at cell ${column},${row}`);
    }
  }
});

test('planEnemyIntent uses the flow direction only when the direct line is blocked', () => {
  const grid = buildGrid();
  const player = { x: 1_450, y: 1_940 };
  const field = computeEnemyFlowField({ grid, targetX: player.x, targetY: player.y });
  const navigation = {
    lineBlocked: (fromX, fromY, toX, toY) => navLineBlocked(grid, fromX, fromY, toX, toY),
    flowDirectionAt: (x, y) => sampleFlowDirection(grid, field, x, y),
  };
  const blockedEnemy = createEnemyState({ archetypeId: 'bagholder-rusher', id: 'nav-blocked', x: 1_950, y: 1_940 });
  const blockedIntent = planEnemyIntent(blockedEnemy, { player, tick: 0, navigation });
  const direct = { x: -1, y: 0 };
  const dot = blockedIntent.facing.x * direct.x + blockedIntent.facing.y * direct.y;
  assert.ok(dot < 0.98, 'blocked enemy must not head straight into the fence');
  const openEnemy = createEnemyState({ archetypeId: 'bagholder-rusher', id: 'nav-open', x: 900, y: 2_500 });
  const openIntent = planEnemyIntent(openEnemy, { player: { x: 800, y: 2_400 }, tick: 0, navigation });
  assert.ok(openIntent.facing.x < 0 && openIntent.facing.y < 0, 'open-field enemy keeps direct pursuit');
});

test('a session restart resets the flow field so runs cannot inherit stale state', () => {
  // Review finding (Cycle 043): the field lived in module state across
  // initializeSession, steering a restarted run with the previous run's data
  // and breaking same-seed determinism fresh-load vs post-restart. Source
  // guard, matching the repo's main.mjs source-text precedent.
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const initBody = source.slice(source.indexOf('const initializeSession = (payload) => {'), source.indexOf('const sessionHeroSelection'));
  assert.match(initBody, /enemyFlowField = null/, 'initializeSession must clear the flow field');
  assert.match(initBody, /enemyFlowFieldTick = -1/, 'initializeSession must reset the flow field tick');
});

test('a walled-off enemy makes real progress toward the player with navigation', () => {
  const player = { x: 1_450, y: 1_940 };
  const grid = buildGrid();
  const field = computeEnemyFlowField({ grid, targetX: player.x, targetY: player.y });
  const navigation = {
    lineBlocked: (fromX, fromY, toX, toY) => navLineBlocked(grid, fromX, fromY, toX, toY),
    flowDirectionAt: (x, y) => sampleFlowDirection(grid, field, x, y),
  };
  const run = (nav) => {
    const population = createEnemyPopulation({ capacity: 8, threatCapacity: 64 });
    const enemy = createEnemyState({ archetypeId: 'bagholder-rusher', id: 'nav-runner', x: 1_950, y: 1_940 });
    population.active = [enemy];
    for (let tick = 1; tick <= 600; tick += 1) {
      stepEnemyPopulation({
        population,
        player,
        tick,
        dtSeconds: 1 / 60,
        blockers: LEVEL_ONE_WORLD.collisionBlockers,
        bounds: LEVEL_ONE_WORLD.bounds,
        queryGround,
        navigation: nav,
      });
    }
    return Math.hypot(enemy.x - player.x, enemy.y - player.y);
  };
  const withNav = run(navigation);
  const withoutNav = run(null);
  // Wall-sliding alone rounds the fence slowly; the field must do materially
  // better and actually close to melee range inside the same time window.
  assert.ok(withNav < 120, `with navigation the enemy must round the fence and close in (ended ${Math.round(withNav)} away)`);
  assert.ok(withoutNav - withNav > 100, `navigation must beat wall-sliding by a clear margin (nav ${Math.round(withNav)} vs slide ${Math.round(withoutNav)})`);
});
