// W4a: world-keyed gameplay tables for the ten-area Free world.
//
// The legacy tables (DISTRICT_ROLE_GATES, MISSION_OBJECTIVES, MISSION_BOSS_ZONES,
// BOSS_DEFINITIONS, LEVEL_ONE_ENTRIES, LEVEL_ONE_BRIEFING) stay untouched; this
// module builds the ten-area equivalents in the exact row shapes those systems
// consume and main.mjs passes them through the existing option seams
// (createMissionState objectives/bossZones, createBossSlots definitions,
// stepEncounterDirector roleGates, resolveLevelBriefing briefing).
//
// All four bosses are registered (slice HMH-BOSSES-2-4): the Liquidator on his
// exchange floor, and the Rug Pull Baron, the Lockkeeper and the 51% Foreman on
// district courts placed on the world's own arena anchors
// (boss-courts-world-v1.mjs). A district boss starts when the hero crosses its
// court threshold at or after its contract ready tick; main.mjs still steps
// only the Liquidator slot's boss, so binding the district engine into the
// runtime tick is the next slice.
import { freezeDeep } from './value-guards.mjs';
import { createStaticBlocker } from './collision.mjs';
import { BOSS_DEFINITIONS, DISTRICT_BOSS_KITS, createDistrictBossDefinition } from './boss-slots.mjs';
import { createDistrictCourt } from './boss-courts-world-v1.mjs';
import { MISSION_RULES } from './mission-objectives.mjs';
import { HMH_V7_BOSSES, HMH_V7_BOSS_RULES, HMH_V7_RUN_RULES } from '../../../sdk/hmh-run-contract-v7.mjs';
import { WORLD_V2_RUNTIME_ID } from './world-v2-runtime-world.mjs';
import { WORLD_V2_DISTRICT_ARCHETYPES, WORLD_V2_EXTRA_ROLES } from './world-v2-combat.mjs';

export const WORLD_V2_DEFAULT_DISTRICT_ID = 'mweb-meadows';

// Conservative role gates from each area's authored difficulty tier (1-5).
const TIER_ROLES = freezeDeep({
  1: ['rusher', 'flanker'],
  2: ['rusher', 'flanker', 'suppressor'],
  3: ['rusher', 'flanker', 'suppressor', 'demolition'],
  4: ['rusher', 'flanker', 'suppressor', 'bruiser', 'demolition'],
  5: ['rusher', 'flanker', 'suppressor', 'bruiser', 'demolition', 'support'],
});

const XP_PER_LEVEL = HMH_V7_RUN_RULES.OBJECTIVE_XP_PER_LEVEL;
const BOSS_LOCK_RADIUS = 16;
const byId = (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
const point = (x, y) => ({ x, y });

function requireBlocker(world, id) {
  const blocker = world.blockers.find((row) => row.id === id);
  if (!blocker?.bounds) throw new TypeError(`ten-area gameplay requires authored blocker ${id}`);
  return blocker;
}

// Operate spots sit east of their equipment facing west: the actor's interact
// pose only distinguishes east from west.
function machineRow(world, { id, blockerId, districtId, name, task, kind, mode, clip, fillTicks, effects }) {
  const blocker = requireBlocker(world, blockerId);
  const operate = point(blocker.bounds.maxX + 64, (blocker.bounds.minY + blocker.bounds.maxY) / 2);
  return {
    id, objectiveClass: 'switch', districtId, name, task, kind, mode, clip, fillTicks,
    ringRadius: MISSION_RULES[mode].ringRadius,
    anchor: { ...operate }, operate: { ...operate, facing: 'west' },
    propBlockerId: blockerId, requires: null, xpPerLevel: XP_PER_LEVEL.switch, effects,
  };
}

function lockWalls(id, bounds) {
  const r = BOSS_LOCK_RADIUS;
  const west = bounds.minX - r, east = bounds.maxX + r, north = bounds.minY - r, south = bounds.maxY + r;
  const xs = [west, west + (east - west) / 4, west + (east - west) / 2, west + (3 * (east - west)) / 4, east];
  const ys = [north, (north + south) / 2, south];
  const wall = (wallId, a, b) => createStaticBlocker({ id: wallId, shape: { type: 'capsule', a, b, radius: r }, visibleAssetId: `boss-lock-${wallId}`, minZ: 0, maxZ: 140, combatCover: true });
  const walls = [];
  for (let index = 0; index < 4; index += 1) {
    walls.push(wall(`${id}-lock-n${index + 1}`, point(xs[index], north), point(xs[index + 1], north)));
    walls.push(wall(`${id}-lock-s${index + 1}`, point(xs[index], south), point(xs[index + 1], south)));
  }
  for (let index = 0; index < 2; index += 1) {
    walls.push(wall(`${id}-lock-w${index + 1}`, point(west, ys[index]), point(west, ys[index + 1])));
    walls.push(wall(`${id}-lock-e${index + 1}`, point(east, ys[index]), point(east, ys[index + 1])));
  }
  return walls.sort(byId);
}

// The Liquidator's floor in Litecoin City: the legacy Margin Floor's exact
// 1,050 x 460 dimensions (the Candle Chart rows fit the walk-escape rule)
// centred on the authored exchange court, bell at the east edge.
export function createWorldV2LiquidatorFloor(world) {
  const court = world.encounterArenas.find((arena) => arena.bossId === 'liquidator');
  if (!court) throw new TypeError('ten-area world has no Liquidator court');
  const { x, y } = court.anchor;
  const bounds = { minX: x - 525, minY: y - 230, maxX: x + 525, maxY: y + 230 };
  const id = 'ten-area-exchange-floor';
  return freezeDeep({
    id,
    trigger: 'bell',
    districtId: court.districtId,
    bounds,
    centre: point(x, y),
    spawn: point(x, y - 140),
    podiums: [
      { id: 'podium-1', x: x - 300, y: y - 110 },
      { id: 'podium-2', x: x + 300, y: y - 110 },
      { id: 'podium-3', x: x - 300, y: y + 110 },
      { id: 'podium-4', x: x + 300, y: y + 110 },
    ],
    chart: { columns: 5, rows: 3, axis: 'x' },
    edgeSites: [
      point(x - 440, y - 160), point(x + 440, y - 160), point(x - 440, y + 160), point(x + 440, y + 160), point(x, y + 180),
    ],
    walls: lockWalls(id, bounds),
    bell: { x: x + 380, y, facing: 'east' },
    retreat: { x: x - 440, y, facing: 'west' },
  });
}

// The greybox arenas name the Foreman by his area label; the v7 contract id
// is the boss id everywhere else.
const WORLD_ARENA_BOSS_IDS = freezeDeep({ 'rug-pull-baron': 'rug-pull-baron', lockkeeper: 'lockkeeper', '51-percent-foreman': 'fifty-one-percent-foreman' });

export function createWorldV2DistrictCourts(world) {
  const courts = {};
  for (const arena of world.encounterArenas) {
    const bossId = WORLD_ARENA_BOSS_IDS[arena.bossId];
    if (!bossId) continue;
    courts[bossId] = createDistrictCourt(bossId, { centre: arena.anchor, id: arena.id });
  }
  for (const bossId of Object.values(WORLD_ARENA_BOSS_IDS)) if (!courts[bossId]) throw new TypeError('ten-area world has no ' + bossId + ' court');
  return freezeDeep(courts);
}

function bossZoneRow({ id, kind, arena, position, mode, clip, fillTicks, readyTick, name, task, bossId = 'liquidator' }) {
  return {
    id, objectiveClass: kind === 'trigger' ? 'boss-trigger' : 'boss-retreat', districtId: arena.districtId, name, task, kind: 'boss-zone',
    mode, clip, fillTicks, ringRadius: MISSION_RULES[mode].ringRadius, readyTick,
    anchor: point(position.x, position.y), operate: { x: position.x, y: position.y, facing: position.facing },
    propBlockerId: null, requires: null, xpPerLevel: 0, effects: [],
    bossZone: kind === 'trigger' ? { bossId, kind, trigger: arena.trigger } : { bossId, kind, arena: arena.id },
  };
}

export function createWorldV2Gameplay(world) {
  // The unofficial 2.0.x preview (both false) or the 2.1.0 Level 1 (both true).
  if (world?.id !== WORLD_V2_RUNTIME_ID || typeof world.officialRun !== 'boolean' || world.rankedEligible !== world.officialRun) throw new TypeError('ten-area gameplay requires the ten-area world');
  const official = world.officialRun;
  // Slice HMH-TEN-AREA-GAMEPLAY-WIRING: an area hosting a 2.0 enemy whose
  // role its tier lacks gains that role; the bands still gate it by time.
  const roleGates = Object.fromEntries(world.districts.map((district) => {
    const roles = TIER_ROLES[district.tier] ?? TIER_ROLES[5];
    const extra = (WORLD_V2_EXTRA_ROLES[district.id] ?? []).filter((role) => !roles.includes(role));
    return [district.id, [...roles, ...extra]];
  }));
  if (!roleGates[WORLD_V2_DEFAULT_DISTRICT_ID]) throw new TypeError('ten-area default district has no role gate');

  const floor = createWorldV2LiquidatorFloor(world);
  const legacy = BOSS_DEFINITIONS.liquidator;
  const bossDefinitions = {
    liquidator: {
      ...legacy,
      districtId: floor.districtId,
      arenas: { bell: floor },
      retreatZones: { [floor.id]: `liquidator-retreat-${floor.id}` },
      // No Dark Pool on this map: the objective id is never authored, so the
      // secret entry can never initiate him.
      darkPoolObjective: 'ten-area-dark-pool-unavailable',
    },
  };
  const districtCourts = createWorldV2DistrictCourts(world);
  for (const [bossId, court] of Object.entries(districtCourts)) bossDefinitions[bossId] = createDistrictBossDefinition(DISTRICT_BOSS_KITS[bossId], court);

  const missionObjectives = [
    machineRow(world, {
      id: 'ten-area-meadows-relay', blockerId: 'mweb-meadows-relay-equipment', districtId: 'mweb-meadows',
      name: 'Meadows relay', task: 'Press the relay switch', kind: 'generator', mode: 'quick', clip: 'press', fillTicks: 30,
      effects: [{ type: 'grant', grant: 'heal', amount: 30 }],
    }),
    // Stand-in for a camp-clear rule: holding the crank under camp pressure.
    machineRow(world, {
      id: 'ten-area-woods-camp', blockerId: 'rugpull-woods-supply-tent', districtId: 'rugpull-woods',
      name: 'Rugpull camp supplies', task: 'Hold the camp and crank the supply winch', kind: 'winch', mode: 'channel', clip: 'crank', fillTicks: 90,
      effects: [{ type: 'grant', grant: 'ammo' }],
    }),
  ].sort(byId);

  const missionBossZones = [
    bossZoneRow({ id: legacy.triggerZone, kind: 'trigger', arena: floor, position: floor.bell, mode: 'seal', clip: 'press',
      fillTicks: 90, readyTick: HMH_V7_BOSSES.liquidator.readyTick, name: 'The Closing Bell', task: 'Ring the Closing Bell' }),
    bossZoneRow({ id: bossDefinitions.liquidator.retreatZones[floor.id], kind: 'retreat', arena: floor, position: floor.retreat, mode: 'channel', clip: 'crank',
      fillTicks: HMH_V7_BOSS_RULES.BOSS_RETREAT_CHANNEL_TICKS, readyTick: 0, name: 'Retreat', task: 'Hold to retreat' }),
    // District bosses trigger on their court threshold, not a mission zone;
    // each court keeps one retreat ring.
    ...Object.entries(districtCourts).map(([bossId, court]) => bossZoneRow({ id: bossDefinitions[bossId].retreatZones[court.id], kind: 'retreat', arena: court, position: court.retreat, mode: 'channel', clip: 'crank',
      fillTicks: HMH_V7_BOSS_RULES.BOSS_RETREAT_CHANNEL_TICKS, readyTick: 0, name: 'Retreat', task: 'Hold to retreat', bossId })),
  ].sort(byId);

  const entry = { id: 'meadows', name: 'MWEB Meadows', x: world.player.spawn.x, y: world.player.spawn.y };
  const briefing = {
    levelId: world.id,
    entries: {
      meadows: {
        objective: 'Press the relay switch east of the entry green, then take the paved road west into Litecoin City.',
        watch: 'Enemies arrive from the road ends of every area. The Closing Bell waits in the City exchange court; the Rug Pull Baron, the Lockkeeper and the 51% Foreman hold the River, Bayou and Fortress courts.',
        supply: 'A bonus life waits in the Meadows garden loop. Each area hides one cache: weapons in the City, Farms, Bayou, Ridge and Woods.',
        features: [
          { kind: 'objective', id: 'ten-area-meadows-relay', bearing: 'east' },
          { kind: 'poi', id: 'mweb-meadows-cache', bearing: 'west', asset: 'bonus-life' },
          { kind: 'arena', id: 'litecoin-city-court', bearing: 'west' },
        ],
      },
    },
    tips: [
      official
        ? 'Level 1 is the ten-area world. Ranked runs here are verified and count; Free runs keep their own result and share card.'
        : 'This is the unranked ten-area Free world: no score is submitted and nothing you do here counts toward Ranked.',
      'Roads connect the ten areas. Danger rises with distance from the Meadows; the Fortress service road is the long way round.',
      'Stand still in a machine’s ring to crank it; buttons start as you pass. Progress is never lost.',
    ],
  };

  return freezeDeep({
    worldId: world.id,
    officialRun: official,
    rankedEligible: official,
    defaultDistrictId: WORLD_V2_DEFAULT_DISTRICT_ID,
    roleGates,
    districtArchetypes: WORLD_V2_DISTRICT_ARCHETYPES,
    missionObjectives,
    missionBossZones,
    bossDefinitions,
    bossLockBlockers: [...floor.walls, ...Object.values(districtCourts).flatMap((court) => court.walls)],
    liquidatorFloor: floor,
    districtCourts,
    entries: [entry],
    briefing,
    stubbedBosses: world.encounterArenas.filter((arena) => arena.bossId && arena.bossId !== 'liquidator' && !WORLD_ARENA_BOSS_IDS[arena.bossId]).map((arena) => ({ arenaId: arena.id, bossId: arena.bossId, districtId: arena.districtId })),
  });
}

export function selectWorldV2Entry(gameplay) {
  return gameplay.entries[0];
}
