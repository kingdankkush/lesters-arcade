// Package 4.1 walk-escape budget (slice S1.5): every Liquidator tell satisfies
// tellTicks >= ceil((escape distance + 24) / 4) + 12, measured on the shapes
// the simulation resolves, from every point of both shipped-map floors. Mobile
// players have no manual dodge, so walking out must always work.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bossShapeClearDistance, bossWalkBudgetTicks } from '../apps/hmh-reboot/src/boss-geometry.mjs';
import { LIQUIDATOR_DARK_POOL, LIQUIDATOR_MARGIN_FLOOR, bossArenaInterior } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import {
  LIQUIDATOR_ATTACK_DEFINITIONS,
  applyLiquidatorDamage,
  createLiquidatorBoss,
  isLiquidatorTargetable,
  liquidatorStrikes,
  liquidatorStrikesAreFair,
  stepLiquidatorBoss,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';

const FLOORS = [LIQUIDATOR_MARGIN_FLOOR, LIQUIDATOR_DARK_POOL];

function budgetFailure(strikes, player, arena) {
  const interior = bossArenaInterior(arena);
  for (const entry of strikes) {
    if (!entry.shape || entry.damage <= 0) continue;
    const clear = bossShapeClearDistance(entry.shape, player, { interior, maxDistance: 1_000, step: 2, angles: 128 });
    const needed = Number.isFinite(clear) ? bossWalkBudgetTicks(clear) : Infinity;
    if (needed > entry.offset) return { attackId: entry.attackId, offset: entry.offset, needed, clear };
  }
  return null;
}

function grid(arena, step) {
  const interior = bossArenaInterior(arena);
  const points = [];
  for (let x = interior.minX; x <= interior.maxX + 1e-9; x += step) {
    for (let y = interior.minY; y <= interior.maxY + 1e-9; y += step) points.push({ x, y, groundZ: 0, vx: 0, vy: 0 });
  }
  // The four corners, where a wall is closest.
  points.push(...[[interior.minX, interior.minY], [interior.maxX, interior.minY], [interior.minX, interior.maxY], [interior.maxX, interior.maxY]]
    .map(([x, y]) => ({ x, y, groundZ: 0, vx: 0, vy: 0 })));
  return points;
}

function bossSpots(arena) {
  const inset = { minX: arena.bounds.minX + 56, minY: arena.bounds.minY + 56, maxX: arena.bounds.maxX - 56, maxY: arena.bounds.maxY - 56 };
  return [arena.spawn, arena.centre, ...arena.podiums, { x: inset.minX, y: inset.minY }, { x: inset.maxX, y: inset.maxY }];
}

test('the supers and the Candle Chart fit the walk budget from every point of both floors', () => {
  for (const arena of FLOORS) {
    const boss = createLiquidatorBoss({ arena, maxHealth: 4_640, seed: 1337, startTick: 0 });
    for (const player of grid(arena, 48)) {
      for (const circuitCount of [0, 1]) {
        const failure = budgetFailure(liquidatorStrikes('circuit-breaker', { boss, player, circuitCount }), player, arena);
        assert.equal(failure, null, `${arena.id} circuit ${circuitCount} from ${player.x},${player.y}: ${JSON.stringify(failure)}`);
      }
      const failure = budgetFailure(liquidatorStrikes('total-liquidation-super', { boss, player }), player, arena);
      assert.equal(failure, null, `${arena.id} total liquidation from ${player.x},${player.y}: ${JSON.stringify(failure)}`);
    }
    for (let ordinal = 0; ordinal < 6; ordinal += 1) {
      for (const player of grid(arena, 72)) {
        for (const phaseIndex of [0, 2]) {
          const failure = budgetFailure(liquidatorStrikes('candle-chart', { boss, player, ordinal, phaseIndex }), player, arena);
          assert.equal(failure, null, `${arena.id} chart ${ordinal}/${phaseIndex} from ${player.x},${player.y}: ${JSON.stringify(failure)}`);
        }
      }
    }
  }
});

test('lanes, the dash and the seals fit the walk budget for every boss spot and hero point', () => {
  for (const arena of FLOORS) {
    for (const spot of bossSpots(arena)) {
      const boss = createLiquidatorBoss({ arena, maxHealth: 4_640, seed: 1337, startTick: 0, x: spot.x, y: spot.y });
      for (const player of grid(arena, 96)) {
        if (Math.hypot(player.x - spot.x, player.y - spot.y) < 80) continue; // inside his body
        for (const phaseIndex of [0, 1, 2]) {
          for (const attackId of ['crash-lane', 'gavel-stamp', 'margin-call-dash']) {
            const moving = { ...player, vx: 150, vy: -90 };
            const failure = budgetFailure(liquidatorStrikes(attackId, { boss, player: moving, phaseIndex }), moving, arena);
            assert.equal(failure, null, `${arena.id} ${attackId} p${phaseIndex} boss ${spot.x},${spot.y} hero ${player.x},${player.y}: ${JSON.stringify(failure)}`);
          }
        }
      }
    }
  }
});

test('Debt Collection is fair in the open and refused when a wall would trap the hero', () => {
  const arena = LIQUIDATOR_MARGIN_FLOOR;
  const boss = createLiquidatorBoss({ arena, maxHealth: 4_640, seed: 1, startTick: 0, x: 11_000, y: 2_400 });
  for (const angle of [0, 1, 2, 3, 4, 5]) {
    const player = { x: 11_000 + Math.cos(angle) * 120, y: 2_400 + Math.sin(angle) * 120, groundZ: 0 };
    assert.equal(budgetFailure(liquidatorStrikes('debt-collection', { boss, player }), player, arena), null);
    assert.equal(liquidatorStrikesAreFair(liquidatorStrikes('debt-collection', { boss, player }), player, arena), true);
  }
  // Cornered: the hero in the south-west corner with the boss on top of him.
  const corner = { x: arena.bounds.minX + 24, y: arena.bounds.maxY - 24, groundZ: 0 };
  const pinned = createLiquidatorBoss({ arena, maxHealth: 4_640, seed: 1, startTick: 0, x: corner.x + 70, y: corner.y - 70 });
  const strikes = liquidatorStrikes('debt-collection', { boss: pinned, player: corner });
  assert.notEqual(budgetFailure(strikes, corner, arena), null, 'the corner really is a trap');
  assert.equal(liquidatorStrikesAreFair(strikes, corner, arena), false, 'so the tell is never issued');
});

test('every tell a fight actually issues fits the walk budget from where the hero stood', () => {
  let checked = 0;
  for (const [arena, entry] of [[LIQUIDATOR_MARGIN_FLOOR, 'bell'], [LIQUIDATOR_DARK_POOL, 'dark-pool']]) {
    for (const seed of [1, 1337, 90_210]) {
      const boss = createLiquidatorBoss({ arena, maxHealth: 4_640, seed, entry, startTick: 0 });
      const interior = bossArenaInterior(arena);
      for (let tick = 0; tick < 7_000 && boss.active; tick += 1) {
        // A hero who hugs walls and corners as often as the middle.
        const t = tick / 97;
        const player = {
          x: interior.minX + ((Math.sin(t) + 1) / 2) * (interior.maxX - interior.minX),
          y: interior.minY + ((Math.cos(t * 1.7) + 1) / 2) * (interior.maxY - interior.minY),
          groundZ: 0, vx: Math.cos(t) * 200, vy: -Math.sin(t * 1.7) * 200,
        };
        const report = stepLiquidatorBoss({ boss, tick, player, addsAlive: 0 });
        for (const event of report.events) {
          if (event.type !== 'tell') continue;
          const strikes = boss.pendingAttacks.filter((pending) => pending.groupId === event.groupId)
            .map((pending) => ({ attackId: pending.attackId, shape: pending.geometry, damage: pending.damage, offset: pending.resolveTick - tick }));
          const failure = budgetFailure(strikes, player, arena);
          assert.equal(failure, null, `${arena.id} seed ${seed} tick ${tick}: ${JSON.stringify(failure)}`);
          checked += 1;
        }
        if (isLiquidatorTargetable(boss, tick)) applyLiquidatorDamage({ boss, amount: 1.2, tick });
      }
    }
  }
  assert.ok(checked > 100, `checked ${checked} tells`);
  assert.equal(Object.keys(LIQUIDATOR_ATTACK_DEFINITIONS).length, 8);
});
