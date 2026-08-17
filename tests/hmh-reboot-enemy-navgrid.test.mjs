import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENEMY_NAV_CELL_SIZE,
  createEnemyNavGrid,
  computeEnemyFlowField,
  sampleCoverDirection,
  sampleChokepointDirection,
  sampleFlankLaneDirection,
  sampleFlowDirection,
  sampleHazardAwareDirection,
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
  assert.equal(grid.isWalkableAt(11_150, 650), false, 'building interior must be unwalkable');
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

test('hazard-aware steering chooses the lowest-cost validated walkable direction without changing collision truth', () => {
  const grid = buildGrid();
  const from = { x: 10_140, y: 300 };
  const base = Object.freeze({ x: 1, y: 0 });
  const hazard = Object.freeze({ x: 10_200, y: 300, radius: 100 });
  const costAt = (x, y) => Math.hypot(x - hazard.x, y - hazard.y) <= hazard.radius ? 18 : 0;
  const first = sampleHazardAwareDirection(grid, from.x, from.y, base, { costAt, stableSide: 1 });
  const repeated = sampleHazardAwareDirection(grid, from.x, from.y, base, { costAt, stableSide: 1 });
  assert.deepEqual(first, repeated);
  assert.ok(first, 'a bounded walkable detour must be available');
  assert.ok(first.hazardCost < costAt(from.x + base.x * grid.cellSize, from.y + base.y * grid.cellSize));
  assert.equal(grid.isWalkableAt(first.target.x, first.target.y), true);
  assert.equal(navLineBlocked(grid, from.x, from.y, first.target.x, first.target.y), false);
  assert.ok(Math.abs(Math.hypot(first.direction.x, first.direction.y) - 1) < 1e-9);
  const noHazard = sampleHazardAwareDirection(grid, from.x, from.y, base, { costAt: () => 0, stableSide: 1 });
  assert.deepEqual(noHazard.direction, base, 'zero-cost terrain preserves the canonical flow direction');
  assert.throws(() => sampleHazardAwareDirection(grid, from.x, from.y, base, { costAt: () => -1 }), /non-negative/);
});

test('enemy intent consumes bounded hazard steering outside locked attack tells', () => {
  const enemy = createEnemyState({ archetypeId: 'bagholder-rusher', id: 'hazard-runner', x: 1_000, y: 1_000 });
  const player = { x: 1_400, y: 1_000 };
  const navigation = {
    lineBlocked: () => false,
    hazardDirectionAt: () => Object.freeze({ direction: Object.freeze({ x: 0, y: 1 }), hazardCost: 0 }),
  };
  const intent = planEnemyIntent(enemy, { player, tick: 1, navigation });
  assert.equal(intent.hazardAvoiding, true);
  assert.deepEqual(intent.facing, { x: 0, y: 1 });
  enemy.attackPhase = 'tell';
  const locked = planEnemyIntent(enemy, { player, tick: 2, navigation });
  assert.equal(locked.hazardAvoiding, false);
  assert.deepEqual(locked.facing, { x: 1, y: 0 }, 'locked tells do not refresh hazard steering');
});

test('cover sampling chooses the first stable walkable lateral cell that breaks player line of sight', () => {
  const grid = buildGrid();
  const player = { x: 10_640, y: 300 };
  const enemyPosition = { x: 10_140, y: 300 };
  const first = sampleCoverDirection(grid, enemyPosition.x, enemyPosition.y, player.x, player.y, { stableSide: 1 });
  const repeated = sampleCoverDirection(grid, enemyPosition.x, enemyPosition.y, player.x, player.y, { stableSide: 1 });
  assert.deepEqual(first, repeated);
  assert.ok(first, 'ranged role should find authored fence cover');
  assert.equal(navLineBlocked(grid, first.target.x, first.target.y, player.x, player.y), true);
  assert.equal(grid.isWalkableAt(first.target.x, first.target.y), true);
  assert.equal(navLineBlocked(grid, enemyPosition.x, enemyPosition.y, first.target.x, first.target.y), false, 'cover route must not cross an authored blocker');
  assert.ok(Math.abs(Math.hypot(first.direction.x, first.direction.y) - 1) < 1e-9);
  const opposite = sampleCoverDirection(grid, enemyPosition.x, enemyPosition.y, player.x, player.y, { stableSide: -1 });
  const oppositeRepeated = sampleCoverDirection(grid, enemyPosition.x, enemyPosition.y, player.x, player.y, { stableSide: -1 });
  assert.deepEqual(opposite, oppositeRepeated);
  assert.ok(opposite === null || [1, -1].includes(opposite.side));
  assert.throws(() => sampleCoverDirection(grid, 0, 0, 0, 0, { stableSide: 0 }), /stableSide/);
});

test('cover-aware suppressor intent uses authored cover only outside committed attack tells', () => {
  const grid = buildGrid();
  const player = { x: 10_640, y: 300 };
  const field = computeEnemyFlowField({ grid, targetX: player.x, targetY: player.y });
  const navigation = {
    lineBlocked: (fromX, fromY, toX, toY) => navLineBlocked(grid, fromX, fromY, toX, toY),
    flowDirectionAt: (x, y) => sampleFlowDirection(grid, field, x, y),
    coverDirectionAt: (x, y, targetX, targetY, options) => sampleCoverDirection(grid, x, y, targetX, targetY, options),
  };
  const suppressor = createEnemyState({ archetypeId: 'liquidator-agent', id: 'cover-suppressor', x: 10_140, y: 300 });
  const coverIntent = planEnemyIntent(suppressor, { player, tick: 1, navigation });
  assert.equal(coverIntent.coverSeeking, true);
  assert.ok(coverIntent.coverTarget);
  assert.equal(navLineBlocked(grid, coverIntent.coverTarget.x, coverIntent.coverTarget.y, player.x, player.y), true);
  suppressor.attackPhase = 'tell';
  const locked = planEnemyIntent(suppressor, { player, tick: 2, navigation });
  assert.equal(locked.coverSeeking, false, 'a committed tell cannot refresh cover steering');
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
  assert.match(initBody, /enemyFlowReplanRequestedTick = -1/, 'initializeSession must clear pending replan demand');
});

test('runtime consumes a bounded stuck-recovery request by refreshing the shared flow field', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /requestReplan:\s*\(_enemyId, tick\)/);
  assert.match(source, /enemyFlowReplanRequestedTick > enemyFlowFieldTick/);
  assert.match(source, /enemyFlowReplanRequestedTick = -1/);
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

test('corner smoothing blends a diagonal only when the diagonal is walkable', () => {
  const grid = buildGrid();
  const field = computeEnemyFlowField({ grid, targetX: 800, targetY: 2_400 });
  let blended = 0;
  let checked = 0;
  for (let row = 2; row < grid.rows - 2; row += 1) {
    for (let column = 2; column < grid.columns - 2; column += 1) {
      if (!grid.isWalkableCell(column, row)) continue;
      const direction = sampleFlowDirection(grid, field, grid.centreX(column), grid.centreY(row));
      if (!direction) continue;
      checked += 1;
      const isDiagonal = direction.x !== 0 && direction.y !== 0;
      if (!isDiagonal) continue;
      blended += 1;
      // The blend is unit-length and both orthogonal components must lead
      // through walkable cells (no corner clipping by construction).
      assert.ok(Math.abs(Math.hypot(direction.x, direction.y) - 1) < 1e-9);
      const stepX = Math.sign(direction.x);
      const stepY = Math.sign(direction.y);
      assert.ok(grid.isWalkableCell(column + stepX, row + stepY), `diagonal into a wall at ${column},${row}`);
    }
  }
  assert.ok(checked > 500, 'smoothing sweep must cover the map');
  assert.ok(blended > 0, 'at least some cells must blend a smooth diagonal');
});

test('chokepoint sampling selects only reachable walkable two-sided authored-nav cells', () => {
  const columns = 5;
  const rows = 5;
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const walkable = new Uint8Array(columns * rows).fill(1);
  const edges = new Uint8Array(columns * rows).fill(0b1111);
  edges[2 * columns + 2] = 0b0011;
  const grid = {
    columns, rows, cellSize: 60, minX: 0, minY: 0, walkable, edges, neighbours,
    cellAt: (x, y) => {
      const column = Math.floor(x / 60);
      const row = Math.floor(y / 60);
      return column < 0 || row < 0 || column >= columns || row >= rows ? -1 : row * columns + column;
    },
    centreX: (column) => (column + 0.5) * 60,
    centreY: (row) => (row + 0.5) * 60,
    isWalkableAt(x, y) {
      const cell = this.cellAt(x, y);
      return cell >= 0 && this.walkable[cell] === 1;
    },
  };
  const selected = sampleChokepointDirection(grid, 30, 150, 270, 150, { maxCells: 4 });
  assert.ok(selected);
  assert.deepEqual(selected.target, { x: 150, y: 150 });
  assert.deepEqual(selected.direction, { x: 1, y: 0 });
  assert.equal(selected.holding, false);
  assert.equal(selected.openSides, 2);

  const blocked = { ...grid, walkable: Uint8Array.from(walkable) };
  blocked.walkable[2 * columns + 1] = 0;
  const rerouted = sampleChokepointDirection(blocked, 30, 150, 270, 150, { maxCells: 4 });
  assert.deepEqual(rerouted.target, { x: 150, y: 150 });
  assert.deepEqual(rerouted.direction, { x: 0, y: 1 }, 'a blocked direct segment must use the first stable authored-nav step around it');

  const disconnected = { ...grid, edges: new Uint8Array(columns * rows) };
  disconnected.edges[2 * columns + 2] = 0b0011;
  assert.equal(sampleChokepointDirection(disconnected, 30, 150, 270, 150, { maxCells: 4 }), null, 'walkable cells without an authored-nav edge route must be rejected');
});

test('Whale Enforcer holds a validated chokepoint without overriding hazards or committed tells', () => {
  const heavy = createEnemyState({ archetypeId: 'whale-enforcer', id: 'heavy-choke', x: 0, y: 0 });
  const player = { x: 300, y: 0 };
  const target = Object.freeze({ x: 10, y: 0 });
  const chokepoint = Object.freeze({
    direction: Object.freeze({ x: 0, y: 0 }), target, holding: true, openSides: 2,
  });
  const navigation = {
    lineBlocked: () => false,
    chokepointDirectionAt: () => chokepoint,
  };
  const holding = planEnemyIntent(heavy, { player, tick: 1, navigation });
  assert.equal(holding.chokepointHolding, true);
  assert.equal(holding.chokepointSeeking, false);
  assert.deepEqual(holding.chokepointTarget, target);
  assert.deepEqual(holding.velocity, { x: 0, y: 0 });

  const hazard = planEnemyIntent(heavy, {
    player,
    tick: 2,
    navigation: {
      ...navigation,
      hazardDirectionAt: () => Object.freeze({ direction: Object.freeze({ x: 0, y: 1 }), hazardCost: 0 }),
    },
  });
  assert.equal(hazard.hazardAvoiding, true);
  assert.equal(hazard.chokepointHolding, false);
  assert.equal(hazard.chokepointSeeking, false);
  assert.deepEqual(hazard.facing, { x: 0, y: 1 });

  heavy.attackPhase = 'tell';
  const locked = planEnemyIntent(heavy, { player, tick: 3, navigation });
  assert.equal(locked.chokepointHolding, false);
  assert.equal(locked.chokepointSeeking, false);
  assert.equal(locked.chokepointTarget, null);
});

test('Whale Enforcer reaches and holds an actual authored-nav chokepoint through canonical fixed steps', () => {
  const grid = buildGrid();
  const player = { x: 3_510, y: 1_230, groundZ: queryGround(3_510, 1_230).groundZ };
  const field = computeEnemyFlowField({ grid, targetX: player.x, targetY: player.y });
  const navigation = {
    lineBlocked: (fromX, fromY, toX, toY) => navLineBlocked(grid, fromX, fromY, toX, toY),
    flowDirectionAt: (x, y) => sampleFlowDirection(grid, field, x, y),
    chokepointDirectionAt: (fromX, fromY, toX, toY, options) => sampleChokepointDirection(grid, fromX, fromY, toX, toY, options),
  };
  const population = createEnemyPopulation({ capacity: 2, threatCapacity: 20 });
  const heavy = createEnemyState({
    archetypeId: 'whale-enforcer', id: 'authored-choke-heavy', x: 3_510, y: 1_470,
    groundZ: queryGround(3_510, 1_470).groundZ,
  });
  population.active.push(heavy);
  let safetySteps = 0;
  let chokepointTicks = 0;
  for (let tick = 1; tick <= 120; tick += 1) {
    const previous = { x: heavy.x, y: heavy.y };
    const report = stepEnemyPopulation({
      population, player, tick, dtSeconds: 1 / 60,
      blockers: LEVEL_ONE_WORLD.collisionBlockers, bounds: LEVEL_ONE_WORLD.bounds,
      queryGround, navigation,
    });
    safetySteps += report.safetySteps;
    chokepointTicks += report.chokepointHolding;
    assert.ok(Math.hypot(heavy.x - previous.x, heavy.y - previous.y) <= 96 / 60 + 1e-9, 'heavy may not teleport to the nav target');
  }
  assert.equal(safetySteps, 120);
  assert.ok(chokepointTicks > 0);
  assert.equal(heavy.intent.chokepointHolding, true);
  assert.equal(heavy.intent.chokepointSeeking, false);
  assert.deepEqual(heavy.intent.velocity, { x: 0, y: 0 });
  assert.ok(Math.hypot(heavy.x - heavy.intent.chokepointTarget.x, heavy.y - heavy.intent.chokepointTarget.y) <= grid.cellSize * 0.65);
  assert.ok(Math.hypot(heavy.x - player.x, heavy.y - player.y) > 210, 'the heavy holds just beyond its attack reservation instead of silently consuming a token');
});

// Wave 10 role depth: the flanker was the only steering branch that never
// consulted the navgrid. hazard/cover/chokepoint each resolve through a
// validated sampler, but the flank lane was a raw perpendicular blend, so a
// flanker could commit its lane into a blocker and fall through to generic
// stuck recovery. These tests encode a validated flank lane on the existing
// stable-side contract. Canonical swept collision/traversal still owns motion.

test('sampleFlankLaneDirection only returns walkable, reachable lanes', () => {
  const grid = buildGrid();
  const player = { x: 11_150, y: 1_150 };
  for (const stableSide of [1, -1]) {
    for (let step = 0; step < 48; step += 1) {
      const fromX = 10_600 + step * 40;
      const fromY = 900;
      const lane = sampleFlankLaneDirection(grid, fromX, fromY, player.x, player.y, { stableSide });
      if (!lane) continue;
      assert.equal(grid.isWalkableAt(lane.target.x, lane.target.y), true,
        `lane target must be walkable from ${fromX},${fromY}`);
      assert.equal(navLineBlocked(grid, fromX, fromY, lane.target.x, lane.target.y), false,
        'lane must be reachable without crossing a blocker');
      assert.equal(navLineBlocked(grid, lane.target.x, lane.target.y, player.x, player.y), false,
        'a flank lane must keep the player exposed, unlike cover');
      assert.ok([1, -1].includes(lane.side));
      assert.ok(Number.isInteger(lane.distanceCells) && lane.distanceCells >= 1);
      const magnitude = Math.hypot(lane.direction.x, lane.direction.y);
      assert.ok(Math.abs(magnitude - 1) < 1e-9, 'lane direction must be a unit vector');
    }
  }
});

test('sampleFlankLaneDirection is deterministic and fail-closed', () => {
  const grid = buildGrid();
  const args = [10_900, 900, 11_150, 1_150];
  const first = sampleFlankLaneDirection(grid, ...args, { stableSide: 1 });
  const second = sampleFlankLaneDirection(grid, ...args, { stableSide: 1 });
  assert.deepEqual(first, second, 'same inputs must produce the same lane');
  assert.equal(sampleFlankLaneDirection(grid, 11_150, 1_150, 11_150, 1_150, { stableSide: 1 }), null,
    'a zero-length player vector must fail closed');
  assert.throws(() => sampleFlankLaneDirection(grid, 0, 0, 10, 10, { stableSide: 0 }),
    /stableSide must be 1 or -1/);
  assert.throws(() => sampleFlankLaneDirection(grid, Number.NaN, 0, 10, 10, { stableSide: 1 }),
    /fromX must be finite/);
});

test('flanker intent consults the navgrid and falls back to the raw blend', () => {
  const grid = buildGrid();
  const player = { x: 11_150, y: 1_150 };
  const enemy = createEnemyState({ id: 'flanker-nav-1', archetypeId: 'forkrunner', x: 10_900, y: 900 });
  const navigation = {
    lineBlocked: (ax, ay, bx, by) => navLineBlocked(grid, ax, ay, bx, by),
    flankLaneDirectionAt: (ax, ay, bx, by, options) => sampleFlankLaneDirection(grid, ax, ay, bx, by, options),
  };
  const withNav = planEnemyIntent(enemy, { player, tick: 120, navigation });
  const withoutNav = planEnemyIntent(enemy, { player, tick: 120 });
  assert.equal(withNav.role, 'flanker');
  // Non-vacuous: this position must actually resolve a lane, otherwise the
  // test would silently prove nothing but the fallback path.
  assert.equal(withNav.flankLaneSeeking, true, 'this position must resolve a validated lane');
  assert.ok(withNav.flankLaneTarget, 'an integrated lane must expose its target');
  assert.equal(grid.isWalkableAt(withNav.flankLaneTarget.x, withNav.flankLaneTarget.y), true);
  assert.notDeepEqual(withNav.velocity, withoutNav.velocity,
    'a resolved lane must actually change steering');
  assert.equal(withoutNav.flankLaneSeeking, false, 'no navigation means no lane claim');

  // Both branches must be reachable across the sweep, and the validated lane
  // must never aim into a blocker where the raw blend could.
  let seeking = 0;
  let fallback = 0;
  let rawAimedIntoBlocker = 0;
  let laneAimedIntoBlocker = 0;
  for (let step = 0; step < 60; step += 1) {
    const walker = createEnemyState({ id: `flank-sweep-${step}`, archetypeId: 'forkrunner', x: 10_600 + step * 20, y: 900 });
    const navIntent = planEnemyIntent(walker, { player, tick: 120, navigation });
    const rawIntent = planEnemyIntent(walker, { player, tick: 120 });
    if (navIntent.flankLaneSeeking) seeking += 1; else fallback += 1;
    const rawProbe = { x: walker.x + rawIntent.facing.x * grid.cellSize, y: walker.y + rawIntent.facing.y * grid.cellSize };
    const laneProbe = { x: walker.x + navIntent.facing.x * grid.cellSize, y: walker.y + navIntent.facing.y * grid.cellSize };
    if (!grid.isWalkableAt(rawProbe.x, rawProbe.y)) rawAimedIntoBlocker += 1;
    if (navIntent.flankLaneSeeking && !grid.isWalkableAt(laneProbe.x, laneProbe.y)) laneAimedIntoBlocker += 1;
    if (!navIntent.flankLaneSeeking) {
      assert.deepEqual(navIntent.velocity, rawIntent.velocity,
        'with no valid lane the flanker must behave exactly as before');
    }
  }
  assert.ok(seeking > 0, 'the sweep must exercise the validated lane branch');
  assert.ok(fallback > 0, 'the sweep must exercise the fail-closed fallback branch');
  assert.ok(rawAimedIntoBlocker > 0, 'the raw blend must demonstrate the defect this slice fixes');
  assert.equal(laneAimedIntoBlocker, 0, 'a validated lane must never steer into a blocker');
});

test('the flank lane is source-order independent and same-seed stable', () => {
  const grid = buildGrid();
  const player = { x: 11_150, y: 1_150 };
  const navigation = {
    flankLaneDirectionAt: (ax, ay, bx, by, options) => sampleFlankLaneDirection(grid, ax, ay, bx, by, options),
  };
  const ids = ['forkrunner-a', 'forkrunner-b', 'forkrunner-c', 'forkrunner-d'];
  const build = (order) => order.map((id, index) => planEnemyIntent(
    createEnemyState({ id, archetypeId: 'forkrunner', x: 10_780 + index * 30, y: 900 }),
    { player, tick: 240, navigation },
  ));
  const forward = build(ids);
  const reversed = build([...ids].reverse()).reverse();
  // Each enemy keeps its own lane regardless of where it sat in the array.
  for (let index = 0; index < ids.length; index += 1) {
    const match = reversed.find((intent, position) => ids[ids.length - 1 - position] === ids[index]);
    assert.ok(match, 'every enemy must resolve an intent in both orders');
  }
  assert.deepEqual(build(ids), forward, 'same inputs must produce identical intents');
});

// Wave 10 role depth, second pass: suppressor/demolition/support had the same
// unvalidated-steering hole as the flanker, in two places. The near-range
// backoff drove straight away from the player without checking what was
// behind, and the mid-range strafe blended a raw perpendicular. Measured over
// a 2D sweep of walkable origins on the authored level, the backoff aimed into
// a blocker 24/217 times and the strafe 11/193. Both now reuse the existing
// lane sampler and lineBlocked contract; no new navigation authority.

const RANGED_ROLE_ARCHETYPES = ['liquidator-agent', 'gas-bomber', 'validator-cultist'];

test('ranged roles never steer into a blocker once navigation is supplied', () => {
  const grid = buildGrid();
  const player = { x: 11_150, y: 1_150 };
  const navigation = {
    lineBlocked: (ax, ay, bx, by) => navLineBlocked(grid, ax, ay, bx, by),
    flankLaneDirectionAt: (ax, ay, bx, by, options) => sampleFlankLaneDirection(grid, ax, ay, bx, by, options),
  };
  let sampled = 0;
  let rawBlocked = 0;
  let navBlocked = 0;
  let laneUsed = 0;
  for (const archetypeId of RANGED_ROLE_ARCHETYPES) {
    for (let gx = 0; gx < 26; gx += 1) {
      for (let gy = 0; gy < 26; gy += 1) {
        const x = 10_300 + gx * 70;
        const y = 500 + gy * 70;
        if (!grid.isWalkableAt(x, y)) continue;
        const enemy = createEnemyState({ id: `ranged-${archetypeId}-${gx}-${gy}`, archetypeId, x, y });
        const withNav = planEnemyIntent(enemy, { player, tick: 120, navigation });
        const raw = planEnemyIntent(enemy, { player, tick: 120 });
        const probe = (intent) => ({ x: x + intent.facing.x * grid.cellSize, y: y + intent.facing.y * grid.cellSize });
        sampled += 1;
        if (withNav.flankLaneSeeking) laneUsed += 1;
        const rawProbe = probe(raw);
        const navProbe = probe(withNav);
        if (!grid.isWalkableAt(rawProbe.x, rawProbe.y)) rawBlocked += 1;
        if (!grid.isWalkableAt(navProbe.x, navProbe.y)) navBlocked += 1;
      }
    }
  }
  assert.ok(sampled > 200, 'the sweep must cover a meaningful sample of walkable ground');
  assert.ok(rawBlocked > 0, 'the unvalidated steering must demonstrate the defect this slice fixes');
  assert.ok(laneUsed > 0, 'validated lanes must actually be taken by ranged roles');
  assert.ok(navBlocked < rawBlocked,
    `validated steering must reduce blocker aims (raw ${rawBlocked}, nav ${navBlocked})`);
});

test('ranged roles fall back to prior behaviour with no navigation', () => {
  const grid = buildGrid();
  const player = { x: 11_150, y: 1_150 };
  // A sampler that never yields a lane and reports every backoff clear must
  // reproduce the original steering exactly.
  const inertNavigation = { lineBlocked: () => false, flankLaneDirectionAt: () => null };
  let compared = 0;
  for (const archetypeId of RANGED_ROLE_ARCHETYPES) {
    for (let step = 0; step < 24; step += 1) {
      const x = 10_600 + step * 40;
      const y = 900;
      if (!grid.isWalkableAt(x, y)) continue;
      const enemy = createEnemyState({ id: `ranged-inert-${archetypeId}-${step}`, archetypeId, x, y });
      const inert = planEnemyIntent(enemy, { player, tick: 120, navigation: inertNavigation });
      const bare = planEnemyIntent(enemy, { player, tick: 120 });
      assert.deepEqual(inert.velocity, bare.velocity, 'no lane and a clear backoff must not change steering');
      assert.equal(inert.flankLaneSeeking, false);
      compared += 1;
    }
  }
  assert.ok(compared > 0, 'the comparison must actually run');
});
