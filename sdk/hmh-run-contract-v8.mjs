// Hard Money Heroes run summary v8: the shared gameplay contract of the
// ten-area Level 1 (`ten-area-frontier`, map version 2) from game 2.1.0
// (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md).
//
// The server verifier's v8 path reads only this module, the v8 schema module
// and what they import (the v7 contract and schema, which stay frozen). The
// child never imports this module: every value below that the child also
// holds is a frozen copy, and tests/hmh-ranked-v8-contract.test.mjs pins each
// copy against the 2.1.0 child (the world, its gameplay tables, the 2.0
// archetypes, the collectible placements, the cover and traversal rules).
// Changing a value changes what a schema-8 summary may claim, so it changes
// only together with server/verify/hmh-plausibility-v8.mjs and its tests.
import { HMH_RUN_SUMMARY_CATALOGS_V8 as C8, HMH_V8_MOVEMENT_FIELDS } from './hmh-run-summary-schema-v8.mjs';
import {
  HMH_V7_BOSS_RULES,
  HMH_V7_BOSSES,
  HMH_V7_CONSISTENCY_RULES,
  HMH_V7_EVOLUTIONS,
  HMH_V7_ROLE_THREAT,
  HMH_V7_RUN_RULES,
  HMH_V7_UPGRADE_MAX_RANKS,
  hmhV7KillScore,
  hmhV7KillXp,
  hmhV7LevelForXp,
  hmhV7LevelThreshold,
} from './hmh-run-contract-v7.mjs';

export {
  HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION,
  HMH_RUN_SUMMARY_V8_SCHEMA_VERSION,
  isHmhV8Build,
  isHmhV8GameVersion,
} from './hmh-run-v8-build.mjs';

const freezeDeep = (value) => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
  return Object.freeze(value);
};
const covering = (table, ids, label) => {
  const tableIds = Object.keys(table);
  if (tableIds.length !== ids.length || ids.some((id) => !Object.hasOwn(table, id))) throw new Error(`${label} must cover its catalogue exactly`);
  return freezeDeep(table);
};

// The map a schema-8 summary describes.
export const HMH_V8_MAP = Object.freeze({ mapId: 'ten-area-frontier', mapVersion: 2 });

// ---------------------------------------------------------------------------
// Run rules: the 2.1.0 child keeps every v7 run rule (fixed step, level
// curve, multipliers, combo milestones, weapon-cache XP, silver, opening
// enemies, the director's band schedule, objective XP per level).
export const HMH_V8_RUN_RULES = HMH_V7_RUN_RULES;
export const hmhV8LevelThreshold = hmhV7LevelThreshold;
export const hmhV8LevelForXp = hmhV7LevelForXp;
export const hmhV8KillXp = hmhV7KillXp;
export const hmhV8KillScore = hmhV7KillScore;
export const HMH_V8_UPGRADE_MAX_RANKS = HMH_V7_UPGRADE_MAX_RANKS;
export const HMH_V8_EVOLUTIONS = HMH_V7_EVOLUTIONS;

// Threat per role as the 2.1.0 child grants it (recordRunDefeat's threatCost):
// the six legacy roles as in v7; the six 2.0 enemies at their runtime rows'
// costs.threat (world-v2-combat.mjs WORLD_V2_NEW_ENEMY_RUNTIME, which are the
// declared balance sources' stats, not the v7 contract's planning values);
// every boss, the district bosses included, at main.mjs LIQUIDATOR_THREAT_COST
// (48): the one boss defeat path awards the Liquidator's threat to whichever
// boss is live. Kill XP and score of a boss are therefore 1,040 and 1,300.
export const HMH_V8_ROLE_THREAT = covering({
  'bagholder-rusher': HMH_V7_ROLE_THREAT['bagholder-rusher'],
  forkrunner: HMH_V7_ROLE_THREAT.forkrunner,
  'liquidator-agent': HMH_V7_ROLE_THREAT['liquidator-agent'],
  'whale-enforcer': HMH_V7_ROLE_THREAT['whale-enforcer'],
  'gas-bomber': HMH_V7_ROLE_THREAT['gas-bomber'],
  'validator-cultist': HMH_V7_ROLE_THREAT['validator-cultist'],
  liquidator: HMH_V7_ROLE_THREAT.liquidator,
  'rug-puller': 3,
  'pump-and-dump-bloater': 6,
  tollkeeper: 6,
  'hodl-revenant': 2,
  'money-printer': 5,
  'oracle-marksman': 4,
  'rug-pull-baron': 48,
  lockkeeper: 48,
  'fifty-one-percent-foreman': 48,
}, C8.enemyRoles, 'HMH_V8_ROLE_THREAT');

// ---------------------------------------------------------------------------
// Bosses. The shared boss kit of v7 (intro, two phase halts, retreat ring,
// capacity bank, one live boss, one Seal per boss) holds for all four on the
// ten-area map: the district kits use the v7 halt and thresholds and an intro
// of at least 120 ticks (Baron 120, Lockkeeper 120, Foreman 150), and the
// Liquidator starts only from his Closing Bell, with its intro: the map has
// no Dark Pool, so every fight's minimum is BOSS_MIN_FIGHT_TICKS (300).
export const HMH_V8_BOSS_RULES = HMH_V7_BOSS_RULES;
// The court each boss is fought in on the ten-area map (its district), its
// contract ready tick and silver burst (unchanged from v7).
const bossRow = (bossId, district) => ({
  district,
  readyTick: HMH_V7_BOSSES[bossId].readyTick,
  silverBurst: HMH_V7_BOSSES[bossId].silverBurst,
  minFightTicks: HMH_V7_BOSS_RULES.BOSS_MIN_FIGHT_TICKS,
});
export const HMH_V8_BOSSES = covering({
  'rug-pull-baron': bossRow('rug-pull-baron', 'hashwood-river'),
  lockkeeper: bossRow('lockkeeper', 'scrypt-bayou'),
  'fifty-one-percent-foreman': bossRow('fifty-one-percent-foreman', 'fork-fortress'),
  liquidator: bossRow('liquidator', 'litecoin-city'),
}, C8.bosses, 'HMH_V8_BOSSES');

// ---------------------------------------------------------------------------
// Spawn sources. On this map an ordinary enemy enters the run only as one of
// the two opening enemies, as a director insertion, or as a live boss's add.
// The director picks from the area the hero stands in (the Meadows when the
// hero is on a road between areas), through that area's role gate and role
// pools (world-v2-gameplay.mjs roleGates, world-v2-combat.mjs
// WORLD_V2_DISTRICT_ARCHETYPES, the director's ROLE_ARCHETYPES), so every
// director spawn's area is a visited area. Only the Liquidator brings adds
// (his Enforcement Orders); the district bosses bring none. The test
// enumerates the child's own selector over every band, ordinal and requested
// role and pins these sets.
export const HMH_V8_OPENING_ROLES = Object.freeze(['bagholder-rusher', 'forkrunner']);
export const HMH_V8_AREA_SPAWN_ROLES = covering({
  'fork-fortress': ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'liquidator-agent', 'tollkeeper', 'validator-cultist', 'whale-enforcer'],
  'halving-farms': ['bagholder-rusher', 'forkrunner', 'liquidator-agent', 'pump-and-dump-bloater'],
  'hashwood-river': ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'liquidator-agent', 'tollkeeper'],
  'hollow-pines': ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'hodl-revenant', 'liquidator-agent', 'whale-enforcer'],
  'ledger-ridge': ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'liquidator-agent', 'oracle-marksman', 'whale-enforcer'],
  'litecoin-city': ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'liquidator-agent', 'money-printer', 'rug-puller'],
  'mweb-meadows': ['bagholder-rusher', 'forkrunner'],
  'rugpull-woods': ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'liquidator-agent', 'rug-puller'],
  'scrypt-bayou': ['bagholder-rusher', 'forkrunner', 'gas-bomber', 'liquidator-agent', 'pump-and-dump-bloater', 'whale-enforcer'],
  'silver-coast': ['bagholder-rusher', 'forkrunner', 'liquidator-agent'],
}, C8.districts, 'HMH_V8_AREA_SPAWN_ROLES');
export const HMH_V8_BOSS_ADD_ROLES = covering({
  'rug-pull-baron': [],
  lockkeeper: [],
  'fifty-one-percent-foreman': [],
  liquidator: ['gas-bomber', 'liquidator-agent'],
}, C8.bosses, 'HMH_V8_BOSS_ADD_ROLES');

// ---------------------------------------------------------------------------
// Objectives: the two ten-area machines (world-v2-gameplay.mjs), switch class.
export const HMH_V8_OBJECTIVES = covering({
  'ten-area-meadows-relay': { class: 'switch', district: 'mweb-meadows', requires: null },
  'ten-area-woods-camp': { class: 'switch', district: 'rugpull-woods', requires: null },
}, C8.objectives, 'HMH_V8_OBJECTIVES');

// ---------------------------------------------------------------------------
// Travel. The hero enters at the one ten-area entry (the authored Meadows
// inspection start), and moves between areas only over walkable ground. The
// graph below has an edge for every pair of areas that one walkable region
// outside all areas touches, after merging regions less than 100 units apart
// (a tick moves the hero at most 96: a drop's landing; a dash tick is 24).
// It is the fourteen authored roads plus the Meadows-River pair (the Meadows
// woods path and the River woods path share their junction south of the
// Meadows). tests/hmh-ranked-v8-contract.test.mjs re-derives the graph from
// the child's ground query and pins it, so a world edit that opens a new
// passage fails there before an honest run could be refused.
export const HMH_V8_TRAVEL = freezeDeep({
  entry: { id: 'meadows', district: 'mweb-meadows', x: 12_500, y: 6_700 },
  edges: [
    ['fork-fortress', 'ledger-ridge'],
    ['fork-fortress', 'mweb-meadows'],
    ['halving-farms', 'mweb-meadows'],
    ['halving-farms', 'rugpull-woods'],
    ['hashwood-river', 'hollow-pines'],
    ['hashwood-river', 'litecoin-city'],
    ['hashwood-river', 'mweb-meadows'],
    ['hashwood-river', 'rugpull-woods'],
    ['hashwood-river', 'scrypt-bayou'],
    ['hollow-pines', 'rugpull-woods'],
    ['ledger-ridge', 'litecoin-city'],
    ['litecoin-city', 'mweb-meadows'],
    ['litecoin-city', 'silver-coast'],
    ['mweb-meadows', 'rugpull-woods'],
    ['scrypt-bayou', 'silver-coast'],
  ],
  // As on v6 and v7: twice a dash tick (24) a tick after a one-off 480. A
  // drop moves 96 in one tick and then locks the hero for six (13.7 a tick),
  // a mantle 96 over 18, and the 2.1.0 child adds no faster mover.
  maxStepPx: 48,
  allowancePx: 480,
});
for (const [a, b] of HMH_V8_TRAVEL.edges) if (!C8.districts.includes(a) || !C8.districts.includes(b) || a >= b) throw new Error('HMH_V8_TRAVEL edges must name catalogue districts in order');
if (C8.districts[hmhV8AreaIndexOf(HMH_V8_TRAVEL.entry)] !== HMH_V8_TRAVEL.entry.district) throw new Error('HMH_V8_TRAVEL entry must lie in its district');

function hmhV8AreaIndexOf({ x, y }) {
  return C8.districtAreas.findIndex(([minX, minY, maxX, maxY]) => x >= minX && x <= maxX && y >= minY && y <= maxY);
}

// Straight-line distance from a point to an area, and between two areas: no
// walk between them is shorter.
export function hmhV8PointAreaDistance({ x, y }, [minX, minY, maxX, maxY]) {
  return Math.hypot(Math.max(minX - x, 0, x - maxX), Math.max(minY - y, 0, y - maxY));
}
export function hmhV8AreaAreaDistance([aMinX, aMinY, aMaxX, aMaxY], [bMinX, bMinY, bMaxX, bMaxY]) {
  return Math.hypot(Math.max(bMinX - aMaxX, 0, aMinX - bMaxX), Math.max(bMinY - aMaxY, 0, aMinY - bMaxY));
}

// ---------------------------------------------------------------------------
// Consistency rules: the v7 mirrors (contract 16.8/16.9) with the 2.1.0
// child's ten-area tables. What is new against v7:
//   pickupPlacements  the child's placements on the ten-area map: the ten
//                     area caches (six re-arm every 10,800 ticks, as on the
//                     legacy map), the three seeded weapon events (offered at
//                     the area caches, from the same minimum ticks) and the
//                     eight objective rewards, which keep their legacy
//                     objectives (none of which the ten-area map completes)
//                     and the Liquidator vault. The per-effect table is the
//                     v7 one, and the parity test derives it from the child.
//   vault             the Liquidator's defeat, as v7
//   travel            HMH_V8_TRAVEL in place of the legacy strips and entries
// The weapon, grenade, launcher, nuke and melee tables are v7's: the 2.1.0
// child keeps every weapon rule on both maps.
export const HMH_V8_CONSISTENCY_RULES = freezeDeep({
  grenadeWeapons: [...HMH_V7_CONSISTENCY_RULES.grenadeWeapons],
  firstTick: HMH_V7_CONSISTENCY_RULES.firstTick,
  pickupPlacements: covering({
    'bonus-life': [[0, 0], [0, 0], [7_200, 'hashwood-shrine']],
    'coin-blaster-cache': [[7_200, 'crossing-pump'], [10_800, 0]],
    'scatter-shotgun-cache': [[0, 'relay-power'], [10_800, 0]],
    'auto-miner-cache': [[10_800, 0]],
    'launcher-rig-cache': [[10_800, 0]],
    'litecoin-token': [],
    'hash-rail-core': [[0, 'ravine-winch'], [0, 0]],
    'lightning-ledger-cache': [[0, 'liquidator-defeated'], [0, 3_600]],
    'bear-market-burner-cache': [[0, 'yard-warehouse'], [0, 7_200]],
    'forked-standard-cache': [[0, 10_800]],
    'time-dilation': [[10_800, 0]],
    'berserk-candle': [[10_800, 'mining-valve'], [10_800, 0]],
    'nuke-liquidation': [[0, 0], [7_200, 'hashwood-shrine']],
  }, C8.collectibles.filter((id) => id !== 'genesis-seal'), 'HMH_V8_CONSISTENCY_RULES.pickupPlacements'),
  vault: { ...HMH_V7_CONSISTENCY_RULES.vault },
  activeWeapons: [...HMH_V7_CONSISTENCY_RULES.activeWeapons],
  weaponCaches: { ...HMH_V7_CONSISTENCY_RULES.weaponCaches },
  handGrenades: { ...HMH_V7_CONSISTENCY_RULES.handGrenades },
  launcherWeapon: HMH_V7_CONSISTENCY_RULES.launcherWeapon,
  nuke: { ...HMH_V7_CONSISTENCY_RULES.nuke },
  melee: { ...HMH_V7_CONSISTENCY_RULES.melee, weapons: [...HMH_V7_CONSISTENCY_RULES.melee.weapons] },
});

// At most 13 world placements and 8 objective rewards, re-armed no sooner
// than every 7,200 ticks: the v7 bound, which the ten-area child keeps.
export const HMH_V8_COLLECTIBLE_RULES = freezeDeep({ MAX_PLACEMENTS: 13 + 8, MIN_REARM_TICKS: 7_200 });
export function hmhV8CollectibleCapacity(runTicks) {
  const rules = HMH_V8_COLLECTIBLE_RULES;
  return rules.MAX_PLACEMENTS * (1 + Math.floor(runTicks / rules.MIN_REARM_TICKS));
}

// ---------------------------------------------------------------------------
// The movement row (HMH-COVER-TRAVERSAL-V1 section 6): a frozen copy of the
// rule constants the counters depend on (cover-system.mjs COVER_RULES_V1,
// traversal-system.mjs TRAVERSAL_RULES_V1), so the verifier never imports
// the child. A later rule change bumps rulesVersion; a run verifies against
// its own version.
export const HMH_V8_MOVEMENT_RULES = freezeDeep({
  fields: [...HMH_V8_MOVEMENT_FIELDS],
  rulesVersion: 'cover-v1+traversal-v1',
  coverEnterTicks: 6,
  mantleTicks: 18,
  landRecoveryTicks: 6,
});
