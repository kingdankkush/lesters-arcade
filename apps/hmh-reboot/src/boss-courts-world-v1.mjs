// The ten-area world's boss courts (slice HMH-BOSSES-2-4): the greybox-world-v1
// arena rectangles of apps/hmh-reboot/src/dev/greybox-{river,bayou,fortress}.mjs
// expressed as boss floors in the Liquidator floor shape, plus the marks the
// boss walks between, the sites the arena hook geometry anchors to (marquee
// posts, quarry presses, lock decks), the exit locks and a reward pedestal.
// Only the ten-area registry (boss-slots.mjs WORLD_V1_BOSS_DEFINITIONS) reads
// this module; the shipped Level 1 map, boss-arenas.mjs and boss-drops.mjs are
// untouched, and it loads lazily with the boss modules.
import { freezeDeep } from './value-guards.mjs';
import { createStaticBlocker } from './collision.mjs';
import { BOSS_LOCK_RADIUS, insideBossArena } from './boss-arenas.mjs';
import { GENESIS_SEAL_RULES } from './boss-drops.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../../../sdk/hmh-run-summary-schema-v7.mjs';

const lockBlocker = (id, a, b) => createStaticBlocker({
  id,
  shape: { type: 'capsule', a, b, radius: BOSS_LOCK_RADIUS },
  visibleAssetId: `boss-lock-${id}`,
  minZ: 0,
  maxZ: 140,
  combatCover: true,
});

function exitLock(id, bounds, exit) {
  // One capsule across the court edge nearest the exit, 240 wide.
  const r = BOSS_LOCK_RADIUS;
  const edges = [
    ['n', Math.abs(exit.y - bounds.minY), (x) => ({ x, y: bounds.minY - r })],
    ['s', Math.abs(exit.y - bounds.maxY), (x) => ({ x, y: bounds.maxY + r })],
    ['w', Math.abs(exit.x - bounds.minX), (y) => ({ x: bounds.minX - r, y })],
    ['e', Math.abs(exit.x - bounds.maxX), (y) => ({ x: bounds.maxX + r, y })],
  ].sort((left, right) => left[1] - right[1]);
  const [edge, , point] = edges[0];
  const along = edge === 'n' || edge === 's' ? exit.x : exit.y;
  return lockBlocker(id, point(along - 120), point(along + 120));
}

function court({ id, bossId, districtId, areaId, centre, size, spawn, marks, hookSites, exits, pedestal, retreat, threshold }) {
  const half = size / 2;
  const bounds = { minX: centre.x - half, minY: centre.y - half, maxX: centre.x + half, maxY: centre.y + half };
  return freezeDeep({
    id, trigger: 'threshold', bossId, districtId, areaId, bounds, centre, spawn,
    marks: marks.map((offset, index) => ({ id: `mark-${index + 1}`, x: centre.x + offset.x, y: centre.y + offset.y })),
    hookSites: hookSites.map((site, index) => ({ id: `hook-${index + 1}`, ...site })),
    exits,
    walls: exits.map((exit, index) => exitLock(`${bossId}-lock-exit-${index}`, bounds, exit)),
    pedestal, retreat, threshold,
  });
}

const STANDARD_MARKS = [{ x: -520, y: -420 }, { x: 520, y: -420 }, { x: -520, y: 420 }, { x: 520, y: 420 }];

// Each court's layout relative to its centre (the greybox kits' local
// geometry: marquee posts and backing, lock decks, quarry presses), so the
// ten-area gameplay table can place the same court on the world's own arena
// anchor. Districts are the v7 contract districts of each boss.
export const DISTRICT_COURT_LAYOUTS = freezeDeep({
  'rug-pull-baron': {
    // He enters from the marquee mouth, clear of the backing mass behind it.
    id: 'hashwood-river-court', areaId: 'hashwood-river', districtId: 'rugpull-ravine', size: 1_800, spawn: { x: 0, y: 380 }, marks: STANDARD_MARKS,
    hookSites: [{ x: 350, y: -450 }, { x: 850, y: -450 }, { x: -100, y: 600 }],
    exits: [{ x: 0, y: -800 }, { x: 800, y: 0 }], pedestal: { x: 0, y: 0 }, retreat: { x: 0, y: -850, facing: 'north' }, threshold: { x: 600, y: -450, radius: 120 },
  },
  lockkeeper: {
    // The north-east mark steps off the control house and wheel tower.
    id: 'scrypt-bayou-court', areaId: 'scrypt-bayou', districtId: 'liquidity-crossing', size: 1_800, spawn: { x: 0, y: 650 }, marks: [{ x: -520, y: -420 }, { x: 300, y: -560 }, { x: -520, y: 420 }, { x: 520, y: 420 }],
    hookSites: [{ x: 600, y: -300 }, { x: -550, y: 650 }],
    exits: [{ x: 0, y: -800 }, { x: 850, y: 0 }], pedestal: { x: 0, y: 0 }, retreat: { x: 0, y: -850, facing: 'north' }, threshold: { x: 750, y: 0, radius: 120 },
  },
  'fifty-one-percent-foreman': {
    id: 'fork-fortress-court', areaId: 'fork-fortress', districtId: 'mining-camp', size: 1_800, spawn: { x: 0, y: -750 }, marks: STANDARD_MARKS,
    hookSites: [{ x: -675, y: 0 }, { x: -225, y: 0 }, { x: 225, y: 0 }, { x: 675, y: 0 }],
    exits: [{ x: -850, y: 250 }, { x: 850, y: 250 }], pedestal: { x: 0, y: 0 }, retreat: { x: -880, y: 250, facing: 'west' }, threshold: { x: 0, y: -850, radius: 140 },
  },
});

// A district court placed on `centre` (a world arena anchor). `id` overrides
// the greybox court id when a world names its arenas differently.
export function createDistrictCourt(bossId, { centre, id = DISTRICT_COURT_LAYOUTS[bossId]?.id, districtId } = {}) {
  const layout = DISTRICT_COURT_LAYOUTS[bossId];
  if (!layout) throw new TypeError('no district court layout for ' + String(bossId));
  const at = (offset) => ({ x: centre.x + offset.x, y: centre.y + offset.y });
  return court({
    id, bossId, districtId: districtId ?? layout.districtId, areaId: layout.areaId, centre: { x: centre.x, y: centre.y }, size: layout.size,
    spawn: at(layout.spawn), marks: layout.marks, hookSites: layout.hookSites.map(at), exits: layout.exits.map(at), pedestal: at(layout.pedestal),
    retreat: { ...at(layout.retreat), facing: layout.retreat.facing }, threshold: { ...at(layout.threshold), radius: layout.threshold.radius },
  });
}

// The greybox-world-v1 centres: area centre + the kit's local court offset.
export const WORLD_V1_RIVER_COURT = createDistrictCourt('rug-pull-baron', { centre: { x: 6_600, y: 12_650 } });
export const WORLD_V1_BAYOU_COURT = createDistrictCourt('lockkeeper', { centre: { x: 1_550, y: 12_250 } });
export const WORLD_V1_FORTRESS_COURT = createDistrictCourt('fifty-one-percent-foreman', { centre: { x: 12_600, y: 2_250 } });

export const WORLD_V1_DISTRICT_COURTS = freezeDeep({
  'rug-pull-baron': WORLD_V1_RIVER_COURT,
  lockkeeper: WORLD_V1_BAYOU_COURT,
  'fifty-one-percent-foreman': WORLD_V1_FORTRESS_COURT,
});
export const WORLD_V1_BOSS_LOCK_BLOCKERS = Object.freeze(Object.values(WORLD_V1_DISTRICT_COURTS).flatMap((arena) => arena.walls));

// The threshold trigger: the hero's centre inside the court and within the
// threshold disk (the marquee posts, the lock bridge mouth, the keep gate).
export function pastCourtThreshold(arena, point) {
  return insideBossArena(arena, point) && Math.hypot(point.x - arena.threshold.x, point.y - arena.threshold.y) <= arena.threshold.radius;
}

// A court's Genesis Seal (boss-drops.mjs rules, unchanged): one per boss id per
// run at the court pedestal, banked like any other Seal by the run progression.
const COURT_BOSS_IDS = new Set(HMH_RUN_SUMMARY_CATALOGS_V7.bosses);
export function dropCourtGenesisSeal(drops, { bossId, tick, arena }) {
  if (!COURT_BOSS_IDS.has(bossId)) throw new TypeError(`unknown boss ${String(bossId)}`);
  const pedestal = arena?.pedestal ?? null;
  if (!pedestal) return null;
  if (drops.droppedBossIds.includes(bossId) || drops.drops >= GENESIS_SEAL_RULES.bankCap) return null;
  drops.droppedBossIds.push(bossId);
  const seal = { id: `genesis-seal:${bossId}`, bossId, tick, x: pedestal.x, y: pedestal.y, arenaId: arena.id, first: drops.drops === 0, collectedTick: -1 };
  drops.drops += 1;
  drops.seals.push(seal);
  return freezeDeep({ ...seal });
}
