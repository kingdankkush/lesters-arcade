// Boss arenas on the shipped map (design package 4.3, "Fallback on the shipped
// map (slice S1.5 only)"). Layout v2 (S2.2) moves the Liquidator to the
// Margin Floor proper; until then he fights in one of two places:
//
// - the Margin Floor fallback: the Liquidation Plaza anchor (11,000, 2,400)
//   tightened to a sealed rectangle, with the Closing Bell at its east edge,
//   the side farthest from the street mouths (the main route and the escape
//   loop both enter from the west and north-west);
// - the Dark Pool: the walled court in the east back alley
//   (world-design-encounters.mjs), entered through a cracked container.
//
// The plaza's height is 460 rather than the package's 540 so that the Candle
// Chart's three rows fit the walk-escape rule over the whole floor (a 153-unit
// row, two rows plus the disk in 95 ticks against the 96-tick tell); a taller
// floor would leave an uncovered strip along each wall.
//
// Locks are capsules outside each floor's edge. Every one closes on its own as
// soon as its footprint, inflated by 24, is clear of every body; the navgrid
// patch closes and reopens them one capsule at a time. Pure data and helpers:
// loaded lazily with the boss modules.
import { freezeDeep } from './value-guards.mjs';
import { createStaticBlocker } from './collision.mjs';
import { WORLD_DESIGN_DARK_POOL } from './world-design-encounters.mjs';

export const BOSS_LOCK_RADIUS = 16;
export const BOSS_LOCK_FOOTPRINT_MARGIN = 24;
// Attacks resolve only while the hero is inside the floor, widened by this
// (package 4.1 "Leash", the open front door allowance).
export const BOSS_LEASH_MARGIN = 120;

const lockBlocker = (id, a, b) => createStaticBlocker({
  id,
  shape: { type: 'capsule', a, b, radius: BOSS_LOCK_RADIUS },
  visibleAssetId: `boss-lock-${id}`,
  minZ: 0,
  maxZ: 140,
  combatCover: true,
});

const PLAZA_BOUNDS = Object.freeze({ minX: 10_475, minY: 2_170, maxX: 11_525, maxY: 2_630 });

function plazaWalls() {
  const { minX, minY, maxX, maxY } = PLAZA_BOUNDS;
  const r = BOSS_LOCK_RADIUS;
  const west = minX - r;
  const east = maxX + r;
  const north = minY - r;
  const south = maxY + r;
  const xs = [west, west + (east - west) / 4, west + (east - west) / 2, west + (3 * (east - west)) / 4, east];
  const ys = [north, (north + south) / 2, south];
  const walls = [];
  for (let index = 0; index < 4; index += 1) {
    walls.push(lockBlocker(`liquidator-lock-n${index + 1}`, { x: xs[index], y: north }, { x: xs[index + 1], y: north }));
    walls.push(lockBlocker(`liquidator-lock-s${index + 1}`, { x: xs[index], y: south }, { x: xs[index + 1], y: south }));
  }
  for (let index = 0; index < 2; index += 1) {
    walls.push(lockBlocker(`liquidator-lock-w${index + 1}`, { x: west, y: ys[index] }, { x: west, y: ys[index + 1] }));
    walls.push(lockBlocker(`liquidator-lock-e${index + 1}`, { x: east, y: ys[index] }, { x: east, y: ys[index + 1] }));
  }
  return walls.sort((left, right) => (left.id < right.id ? -1 : 1));
}

export const LIQUIDATOR_MARGIN_FLOOR = freezeDeep({
  id: 'margin-floor',
  trigger: 'bell',
  districtId: 'liquidation-yard',
  bounds: PLAZA_BOUNDS,
  centre: { x: 11_000, y: 2_400 },
  // He rides the tower's freight lift down to the north edge of the floor.
  spawn: { x: 11_000, y: 2_260 },
  podiums: [
    { id: 'podium-1', x: 10_700, y: 2_290 },
    { id: 'podium-2', x: 11_300, y: 2_290 },
    { id: 'podium-3', x: 10_700, y: 2_510 },
    { id: 'podium-4', x: 11_300, y: 2_510 },
  ],
  // Five columns along x, three rows along y, covering the whole floor.
  chart: { columns: 5, rows: 3, axis: 'x' },
  // Floor-edge margin seals for the Enforcement Order.
  edgeSites: [
    { x: 10_560, y: 2_240 }, { x: 11_440, y: 2_240 }, { x: 10_560, y: 2_560 }, { x: 11_440, y: 2_560 }, { x: 11_000, y: 2_580 },
  ],
  walls: plazaWalls(),
  bell: { x: 11_380, y: 2_400, facing: 'east' },
  retreat: { x: 10_560, y: 2_400, facing: 'west' },
});

const DARK_POOL_BOUNDS = WORLD_DESIGN_DARK_POOL.bounds;
export const LIQUIDATOR_DARK_POOL = freezeDeep({
  id: 'dark-pool',
  trigger: 'dark-pool',
  districtId: 'liquidation-yard',
  bounds: DARK_POOL_BOUNDS,
  centre: { x: 11_784, y: 2_300 },
  // Found turned away at a ledger table at the south end.
  spawn: { x: 11_784, y: 2_590 },
  podiums: [
    { id: 'podium-1', x: 11_700, y: 2_150 },
    { id: 'podium-2', x: 11_870, y: 2_150 },
    { id: 'podium-3', x: 11_700, y: 2_450 },
    { id: 'podium-4', x: 11_870, y: 2_450 },
  ],
  // Four columns along y (the court runs north to south), three rows across x.
  chart: { columns: 4, rows: 3, axis: 'y' },
  edgeSites: [
    { x: 11_620, y: 2_120 }, { x: 11_948, y: 2_120 }, { x: 11_620, y: 2_480 }, { x: 11_948, y: 2_480 }, { x: 11_784, y: 2_660 },
  ],
  // The door seals silently behind the hero.
  walls: [lockBlocker('liquidator-lock-dark-pool', WORLD_DESIGN_DARK_POOL.door.a, WORLD_DESIGN_DARK_POOL.door.b)],
  threshold: WORLD_DESIGN_DARK_POOL.threshold,
  retreat: { x: 11_680, y: 1_990, facing: 'west' },
});

export const LIQUIDATOR_ARENAS = freezeDeep({ 'margin-floor': LIQUIDATOR_MARGIN_FLOOR, 'dark-pool': LIQUIDATOR_DARK_POOL });

// The Rug Pull Baron's floor on the shipped map (package 4.4; slice S3.1,
// built dark behind bossesV2). Layout v2 puts his Quarry Bowl at (3,275, 880)
// under a bench; the shipped map has no bowl there (its north cliff runs at
// y 650), so until layout v2 lands he fights in the same corner of the
// Ravine: the flat z0 pocket between the north cliff (face y 698) and the
// Overlook ledge (z64 from y 1,180), west of the east spur. It is sealed like
// the Margin Floor fallback: shutters (here rolled boulders) on its open west,
// south and east sides; the cliff closes the north. The carpet (package: about
// 720 x 440 with a 100 stone margin) is scaled to the pocket: 480 x 280 with
// an 80-90 margin, which keeps every yank's walk-out inside its 72-tick tell
// from anywhere on the carpet. Two crates stand on the carpet (combat cover
// and the yank's slam hazard); they roll in with the boulders and never close
// on a body, so they are props, not locks.
const QUARRY_BOUNDS = Object.freeze({ minX: 2_880, minY: 700, maxX: 3_520, maxY: 1_160 });
const QUARRY_CARPET = Object.freeze({ minX: 2_960, minY: 790, maxX: 3_440, maxY: 1_070 });

function quarryWalls() {
  const { minX, minY, maxX, maxY } = QUARRY_BOUNDS;
  const r = BOSS_LOCK_RADIUS;
  const west = minX - r;
  const east = maxX + r;
  const south = maxY + r;
  const middle = (minY + south) / 2;
  const xs = [west, west + (east - west) / 4, west + (east - west) / 2, west + (3 * (east - west)) / 4, east];
  const walls = [
    lockBlocker('baron-lock-w1', { x: west, y: minY }, { x: west, y: middle }),
    lockBlocker('baron-lock-w2', { x: west, y: middle }, { x: west, y: south }),
    lockBlocker('baron-lock-e1', { x: east, y: minY }, { x: east, y: middle }),
    lockBlocker('baron-lock-e2', { x: east, y: middle }, { x: east, y: south }),
  ];
  for (let index = 0; index < 4; index += 1) walls.push(lockBlocker(`baron-lock-s${index + 1}`, { x: xs[index], y: south }, { x: xs[index + 1], y: south }));
  return walls.sort((left, right) => (left.id < right.id ? -1 : 1));
}

const quarryCrate = (id, x, y) => createStaticBlocker({
  id,
  // A zero-length capsule: a disc the lock helpers, the navgrid patch and the
  // shutter drawing already handle.
  shape: { type: 'capsule', a: { x, y }, b: { x, y }, radius: 28 },
  visibleAssetId: `boss-prop-${id}`,
  minZ: 0,
  maxZ: 56,
  combatCover: true,
});

export const RUG_PULL_BARON_QUARRY = freezeDeep({
  id: 'quarry-pocket',
  trigger: 'welcome-mat',
  districtId: 'rugpull-ravine',
  bounds: QUARRY_BOUNDS,
  centre: { x: 3_200, y: 930 },
  // The carpet's centre medallion lifts like a trapdoor and he climbs out.
  spawn: { x: 3_200, y: 930 },
  carpet: QUARRY_CARPET,
  // Phase 3 tears the carpet into three strips with bare stone between them.
  stripGap: 30,
  // Brass anchor pegs at the carpet corners: a body inside a ring (r50, lit
  // green) never slides.
  pegs: [
    { id: 'peg-nw', x: QUARRY_CARPET.minX, y: QUARRY_CARPET.minY },
    { id: 'peg-ne', x: QUARRY_CARPET.maxX, y: QUARRY_CARPET.minY },
    { id: 'peg-sw', x: QUARRY_CARPET.minX, y: QUARRY_CARPET.maxY },
    { id: 'peg-se', x: QUARRY_CARPET.maxX, y: QUARRY_CARPET.maxY },
  ],
  pegRadius: 50,
  // He struts between eight carpet-edge marks.
  marks: [
    { id: 'mark-1', x: 2_990, y: 820 }, { id: 'mark-2', x: 3_200, y: 820 }, { id: 'mark-3', x: 3_410, y: 820 },
    { id: 'mark-4', x: 3_410, y: 930 }, { id: 'mark-5', x: 3_410, y: 1_040 }, { id: 'mark-6', x: 3_200, y: 1_040 },
    { id: 'mark-7', x: 2_990, y: 1_040 }, { id: 'mark-8', x: 2_990, y: 930 },
  ],
  // Exit Scam's four authored landing marks (the gold top-hat rings).
  scamMarks: [
    { id: 'scam-1', x: 3_010, y: 850 }, { id: 'scam-2', x: 3_390, y: 850 },
    { id: 'scam-3', x: 3_010, y: 1_010 }, { id: 'scam-4', x: 3_390, y: 1_010 },
  ],
  walls: quarryWalls(),
  props: [quarryCrate('baron-crate-1', 3_070, 875), quarryCrate('baron-crate-2', 3_330, 985)],
  // The Welcome Mat, a gold-fringed mat on the back (cliff-side) margin.
  mat: { x: 3_200, y: 748, facing: 'south', radius: 40 },
  retreat: { x: 2_920, y: 1_110, facing: 'west' },
});

export const BOSS_LOCK_BLOCKERS = Object.freeze([
  ...LIQUIDATOR_MARGIN_FLOOR.walls, ...LIQUIDATOR_DARK_POOL.walls, ...RUG_PULL_BARON_QUARRY.walls, ...RUG_PULL_BARON_QUARRY.props,
]);

// The region the player's centre may occupy on a floor.
export function bossArenaInterior(arena, radius = 24) {
  return Object.freeze({ minX: arena.bounds.minX + radius, minY: arena.bounds.minY + radius, maxX: arena.bounds.maxX - radius, maxY: arena.bounds.maxY - radius });
}

export function insideBossArena(arena, point, margin = 0) {
  return point.x >= arena.bounds.minX - margin && point.x <= arena.bounds.maxX + margin
    && point.y >= arena.bounds.minY - margin && point.y <= arena.bounds.maxY + margin;
}

// The Dark Pool trigger: inside the court, 48 units past the threshold.
export function pastDarkPoolThreshold(point) {
  const pool = LIQUIDATOR_DARK_POOL;
  return point.x >= pool.bounds.minX && point.x <= pool.bounds.maxX
    && point.y >= pool.threshold.y + pool.threshold.enterDepth && point.y <= pool.bounds.maxY;
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

// True when a body (centre, radius) overlaps a lock capsule's footprint
// (package 4.1: the capsule inflated by 24).
export function bodyOverlapsLock(wall, body) {
  const { a, b, radius } = wall.shape;
  return distanceToSegment(body, a, b) < radius + BOSS_LOCK_FOOTPRINT_MARGIN + (body.radius ?? 0);
}
