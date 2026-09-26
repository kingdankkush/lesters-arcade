// Design package 4.1 and 4.7 item 3 (slice S1.5): the shared boss geometry
// kit. Every danger shape is tested against the player's disk (radius 24),
// never a point, and the walk-escape distance is measured on the same shapes
// the simulation resolves.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOSS_GEOMETRY_KIT,
  BOSS_PLAYER_RADIUS,
  BOSS_WALK_UNITS_PER_TICK,
  BOSS_WALK_REACTION_TICKS,
  bossShapeHits,
  bossShapeClearDistance,
  bossShapeDodgeDanger,
  bossWalkBudgetTicks,
  createBossShape,
} from '../apps/hmh-reboot/src/boss-geometry.mjs';

const P = (x, y) => ({ x, y });

test('the kit names every package 4.7 shape plus the union used by multi-lane tells', () => {
  assert.deepEqual([...BOSS_GEOMETRY_KIT].sort(), [
    'chain-link', 'charge-lane', 'circle', 'drift-rect', 'half-plane', 'lane', 'panels', 'ring', 'rotating-bar', 'safe-zones', 'union',
  ]);
  assert.equal(BOSS_PLAYER_RADIUS, 24);
  assert.equal(BOSS_WALK_UNITS_PER_TICK, 4);
  assert.equal(BOSS_WALK_REACTION_TICKS, 12);
  // tellTicks >= ceil((escape distance + 24) / 4) + 12, with the + 24 already
  // inside the clear distance (the whole disk has to be out).
  assert.equal(bossWalkBudgetTicks(0), 12);
  assert.equal(bossWalkBudgetTicks(128), 44);
  assert.equal(bossWalkBudgetTicks(129), 45);
  assert.throws(() => createBossShape({ type: 'cone' }), /unknown boss shape/);
  assert.ok(Object.isFrozen(createBossShape({ type: 'circle', center: P(0, 0), radius: 10 })));
});

test('filled shapes hit the player disk, not just its centre', () => {
  const circle = createBossShape({ type: 'circle', center: P(0, 0), radius: 112 });
  assert.equal(bossShapeHits(circle, P(136, 0)), true, 'the rim touches the disk edge');
  assert.equal(bossShapeHits(circle, P(136.001, 0)), false);
  assert.equal(bossShapeHits(circle, P(120, 0), 0), false, 'a point test would miss this');

  const lane = createBossShape({ type: 'lane', origin: P(0, 0), target: P(400, 0), width: 54 });
  assert.equal(bossShapeHits(lane, P(200, 51)), true);
  assert.equal(bossShapeHits(lane, P(200, 51.01)), false);
  assert.equal(bossShapeHits(lane, P(451, 0)), true, 'the lane end is rounded by its half width and the disk');
  assert.equal(bossShapeHits(lane, P(451.01, 0)), false);
  const charge = createBossShape({ type: 'charge-lane', origin: P(0, 0), target: P(0, 600), width: 76 });
  assert.equal(bossShapeHits(charge, P(62, 300)), true);
  assert.equal(bossShapeHits(charge, P(62.01, 300)), false);
  const chain = createBossShape({ type: 'chain-link', a: P(0, 0), b: P(100, 100), width: 20 });
  assert.equal(bossShapeHits(chain, P(50 + 20, 50 - 20)), true);

  const ring = createBossShape({ type: 'ring', center: P(0, 0), innerRadius: 100, outerRadius: 180 });
  assert.equal(bossShapeHits(ring, P(0, 0)), false);
  assert.equal(bossShapeHits(ring, P(76, 0)), true, 'the inner edge reaches the disk');
  assert.equal(bossShapeHits(ring, P(75.99, 0)), false);
  assert.equal(bossShapeHits(ring, P(204, 0)), true);
  assert.equal(bossShapeHits(ring, P(204.01, 0)), false);

  const half = createBossShape({ type: 'half-plane', point: P(0, 0), normal: P(1, 0) });
  assert.equal(bossShapeHits(half, P(-24, 50)), true);
  assert.equal(bossShapeHits(half, P(-24.01, 50)), false);
  assert.throws(() => createBossShape({ type: 'half-plane', point: P(0, 0), normal: P(2, 0) }), /unit normal/);

  const drift = createBossShape({ type: 'drift-rect', rect: { minX: 0, minY: 0, maxX: 100, maxY: 50 }, drift: P(40, 0) });
  assert.equal(bossShapeHits(drift, P(16, 25)), true, 'the drifted rect starts at x 40');
  assert.equal(bossShapeHits(drift, P(15.99, 25)), false);
  assert.equal(bossShapeHits(drift, P(140 + 16.9, 50 + 16.9)), true, 'a corner is rounded by the disk');
  assert.equal(bossShapeHits(drift, P(140 + 17, 50 + 17)), false);

  const bar = createBossShape({ type: 'rotating-bar', center: P(0, 0), length: 400, width: 40, angle: Math.PI / 2 });
  assert.equal(bossShapeHits(bar, P(44, 150)), true);
  assert.equal(bossShapeHits(bar, P(44.01, 150)), false);
  assert.equal(bossShapeHits(bar, P(150, 0)), false, 'the bar has turned off the x axis');

  const panels = createBossShape({ type: 'panels', cells: [{ minX: 0, minY: 0, maxX: 200, maxY: 150 }] });
  assert.equal(bossShapeHits(panels, P(100, 174)), true);
  assert.equal(bossShapeHits(panels, P(100, 174.01)), false);
});

test('safe zones hit everywhere the whole disk is not inside a zone', () => {
  const safe = createBossShape({ type: 'safe-zones', zones: [P(-150, 0), P(150, 0)], radius: 76 });
  assert.equal(bossShapeHits(safe, P(150, 0)), false);
  assert.equal(bossShapeHits(safe, P(150 + 52, 0)), false, 'the disk just fits inside');
  assert.equal(bossShapeHits(safe, P(150 + 52.01, 0)), true);
  assert.equal(bossShapeHits(safe, P(0, 0)), true);
  const union = createBossShape({ type: 'union', shapes: [
    { type: 'lane', origin: P(0, 0), target: P(400, 100), width: 54 },
    { type: 'lane', origin: P(0, 0), target: P(400, -100), width: 54 },
  ] });
  assert.equal(bossShapeHits(union, P(400, 100)), true);
  assert.equal(bossShapeHits(union, P(400, -100)), true);
  assert.equal(bossShapeHits(union, P(400, 0)), false, 'the V leaves its middle open at range');
});

test('the clear distance is the walk to the nearest point where the whole disk is out', () => {
  const circle = createBossShape({ type: 'circle', center: P(0, 0), radius: 104 });
  const fromCentre = bossShapeClearDistance(circle, P(0, 0));
  assert.ok(fromCentre >= 128 && fromCentre <= 132, `centre escape ${fromCentre}`);
  assert.equal(bossShapeClearDistance(circle, P(300, 0)), 0, 'already clear');
  // A wall behind the hero lengthens the walk: the interior refuses candidates.
  // Unwalled, 60 units west of the centre the walk is 128 - 60 = 68; with a
  // wall at x = -60 the hero has to go round, to (-60, +-113).
  const open = bossShapeClearDistance(circle, P(-60, 0));
  assert.ok(open >= 68 && open <= 70, `open escape ${open}`);
  const cornered = bossShapeClearDistance(circle, P(-60, 0), { interior: { minX: -60, minY: -1000, maxX: 1000, maxY: 1000 } });
  assert.ok(cornered >= 113 && cornered <= 116, `cornered escape ${cornered}`);
  const safe = createBossShape({ type: 'safe-zones', zones: [P(0, 0)], radius: 76 });
  const toZone = bossShapeClearDistance(safe, P(300, 0));
  assert.ok(toZone >= 300 - 52 && toZone <= 300 - 52 + 4, `zone walk ${toZone}`);
  assert.equal(bossShapeClearDistance(safe, P(5000, 0), { maxDistance: 400 }), Infinity);
});

test('auto-dodge reads the same shapes through a danger predicate on its body radius', () => {
  const lane = createBossShape({ type: 'lane', origin: P(0, 0), target: P(400, 0), width: 54 });
  const danger = bossShapeDodgeDanger(lane, 24);
  assert.equal(danger(P(200, 50)), true);
  assert.equal(danger(P(200, 52)), false);
  assert.equal(bossShapeDodgeDanger(lane, 0)(P(200, 30)), false);
});
