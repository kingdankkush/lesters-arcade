// Plausibility for Hard Money Heroes run summary schema 8: the ten-area
// Level 1 (`ten-area-frontier`, map version 2) of game 2.1.0 and later.
// Server only. docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md.
//
// HMH is plausibility-checked, not replayed. This path is modelled on the v7
// path of hmh-plausibility.mjs, rule for rule, with the ten-area tables of
// sdk/hmh-run-contract-v8.mjs; the v6 and v7 paths stay byte-identical (this
// module only imports their pure helpers). It reads no clock.
//
// v8 rules
//   reject  build-predates-schema-8  identity.buildHash names a game older
//                                    than 2.1.0, or none
//           start-tick-invalid, progress-without-time, elapsed-time-mismatch,
//           level-xp-mismatch        as on v7
//           boss-before-ready, boss-fight-too-short (300 for every boss: the
//           map has no Dark Pool), boss-reinitiation-too-soon,
//           boss-fights-overlap      as on v7, for all four bosses
//           kills-above-capacity     the v7 capacity (opening enemies, the
//                                    director schedule, boss bodies and each
//                                    slot's first adds)
//           grenade-kills-above-weapon-kills, pickups-above-capacity,
//           activity-without-time, equipped-ticks-above-run,
//           weapon-without-source, grenade-kills-above-contacts,
//           grenade-detonations-above-launches, grenades-thrown-above-supply,
//           damage-dealt-mismatch, combo-above-kills,
//           knife-kills-above-contacts, melee-contacts-without-trigger,
//           knife-triggers-above-cadence, standard-triggers-above-cadence,
//           standard-kills-above-contacts, collectibles-above-capacity,
//           node-xp-above-level      as on v7, with the ten-area placements
//                                    and objectives (no prisoners)
//           district-path-invalid    the visited areas are not one connected
//                                    set of the ten-area travel graph that
//                                    holds the entry's area (Meadows); a mask
//                                    of 0 passes (no tick recorded)
//           districts-before-travel-time  fewer ticks than the straight-line
//                                    travel the visited areas need at 48 a
//                                    tick after a one-off 480: every area is
//                                    at least its distance from the entry
//                                    away, and of any two areas the one
//                                    reached second is at least the distance
//                                    between them beyond the first
//           enemy-role-not-in-visited-areas  kills of an ordinary role that
//                                    no visited area's director pool, the
//                                    opening enemies or an initiated boss's
//                                    adds can spawn (value: those kills)
//           node-in-unvisited-district  a boss initiation or objective
//                                    completion in an area the run never
//                                    visited (the four courts and the two
//                                    machines lie inside their areas)
//           movement-rules-mismatch  movement.rulesVersion is not the 2.1.0
//                                    child's cover-v1+traversal-v1
//           cover-enters-above-cadence  more cover enters than one per six
//                                    run ticks (an enter needs six ticks of
//                                    push)
//           cover-without-cover-ticks  cover kills or cover damage reduction
//                                    with no tick in cover
//           mantle-ticks-mismatch    mantle ticks outside 18 per mantle (the
//                                    last one may be cut by the run's end)
//           land-ticks-below-drops   fewer landing ticks than six per drop
//                                    but the last
//           xp-above-ceiling, score-above-ceiling  as on v7, with the 2.1.0
//                                    threats (HMH_V8_ROLE_THREAT)
//   flag    kills-near-capacity, xp-near-ceiling, score-near-ceiling,
//           xp-above-selected-upgrades, score-above-selected-upgrades,
//           combo-exceeds-kills, upgrade-rank-above-max,
//           evolution-without-mastery, node-level-inconsistent  as on v7
// Flags have the shape { id, severity, value, limit }.
import { HMH_RUN_SUMMARY_CATALOGS_V8 as C8 } from '../../sdk/hmh-run-summary-schema-v8.mjs';
import {
  HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION,
  HMH_V8_AREA_SPAWN_ROLES,
  HMH_V8_BOSS_ADD_ROLES,
  HMH_V8_OPENING_ROLES,
  HMH_V8_BOSS_RULES as BOSS,
  HMH_V8_BOSSES,
  HMH_V8_CONSISTENCY_RULES as C8R,
  HMH_V8_EVOLUTIONS,
  HMH_V8_MOVEMENT_RULES,
  HMH_V8_OBJECTIVES,
  HMH_V8_ROLE_THREAT,
  HMH_V8_RUN_RULES as V8,
  HMH_V8_TRAVEL,
  HMH_V8_UPGRADE_MAX_RANKS,
  hmhV8AreaAreaDistance,
  hmhV8CollectibleCapacity,
  hmhV8KillScore,
  hmhV8KillXp,
  hmhV8LevelForXp,
  hmhV8LevelThreshold,
  hmhV8PointAreaDistance,
  isHmhV8Build,
} from '../../sdk/hmh-run-contract-v8.mjs';
import { hmhGameVersionOfBuild } from '../../sdk/hmh-run-contract-v7.mjs';
import { NEAR_CEILING_FRACTION, directorSpawnCapacity, hmhV6MeleeCadenceLimit, hmhV7BossOverlaps } from './hmh-plausibility.mjs';

const ELAPSED_TOLERANCE_MS = 1;

function rowCounts(rows, idKey, valueKey) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) out[row?.[idKey]] = row?.[valueKey] ?? 0;
  return out;
}
const clampedRank = (ranks, id) => (Object.hasOwn(ranks, id) ? Math.max(0, Math.min(HMH_V8_UPGRADE_MAX_RANKS[id], ranks[id])) : 0);
const multiplierAt = (rank) => (rank <= 0 ? 1 : 1 + V8.MULTIPLIER_PER_RANK * rank);
const bitSet = (mask, bit) => bit >= 0 && Math.floor(mask / 2 ** bit) % 2 === 1;

function verdictCollector() {
  const flags = [];
  return {
    reject: (id, value, limit) => flags.push(Object.freeze({ id, severity: 'reject', value, limit })),
    flag: (id, value, limit) => flags.push(Object.freeze({ id, severity: 'flag', value, limit })),
    done: () => Object.freeze({
      verdict: flags.some((entry) => entry.severity === 'reject') ? 'rejected' : flags.length ? 'flagged' : 'ok',
      flags: Object.freeze(flags),
    }),
  };
}

// ---------------------------------------------------------------------------
// Travel on the ten-area map.
const AREA_INDEX = Object.freeze(Object.fromEntries(C8.districts.map((id, index) => [id, index])));
const ADJACENT = Object.freeze(C8.districts.map((id) => Object.freeze(HMH_V8_TRAVEL.edges
  .filter(([a, b]) => a === id || b === id).map(([a, b]) => AREA_INDEX[a === id ? b : a]))));
const ENTRY_AREA = AREA_INDEX[HMH_V8_TRAVEL.entry.district];

// The visited mask → { pathValid, entryBit, travelPx }. A mask of 0 is a run
// with no recorded tick. Otherwise the visited areas must hold the entry's
// area and be connected through the travel graph's edges among themselves.
export function hmhV8DistrictTravel(visitedDistrictMask) {
  const entryBit = 2 ** ENTRY_AREA;
  if (visitedDistrictMask === 0) return { pathValid: true, entryBit, travelPx: 0 };
  const count = C8.districts.length;
  if (!Number.isSafeInteger(visitedDistrictMask) || visitedDistrictMask < 0 || visitedDistrictMask >= 2 ** count) return { pathValid: false, entryBit, travelPx: 0 };
  const visited = C8.districts.map((_, index) => bitSet(visitedDistrictMask, index));
  if (!visited[ENTRY_AREA]) return { pathValid: false, entryBit, travelPx: 0 };
  const reached = new Set([ENTRY_AREA]);
  const queue = [ENTRY_AREA];
  while (queue.length) {
    const area = queue.shift();
    for (const next of ADJACENT[area]) if (visited[next] && !reached.has(next)) { reached.add(next); queue.push(next); }
  }
  if (reached.size !== visited.filter(Boolean).length) return { pathValid: false, entryBit, travelPx: 0 };
  // Straight-line lower bound: every visited area lies at least its distance
  // from the entry away; of two visited areas, whichever is reached second
  // adds at least the gap between them to the nearer one's distance.
  const areas = C8.districtAreas;
  const indices = visited.map((flag, index) => (flag ? index : -1)).filter((index) => index >= 0);
  const fromEntry = indices.map((index) => hmhV8PointAreaDistance(HMH_V8_TRAVEL.entry, areas[index]));
  let travelPx = Math.max(0, ...fromEntry);
  for (let a = 0; a < indices.length; a += 1) {
    for (let b = a + 1; b < indices.length; b += 1) {
      travelPx = Math.max(travelPx, Math.min(fromEntry[a], fromEntry[b]) + hmhV8AreaAreaDistance(areas[indices[a]], areas[indices[b]]));
    }
  }
  return { pathValid: true, entryBit, travelPx };
}

// The ordinary roles a run could have met: the opening enemies, every
// visited area's director pool and the adds of every boss it started.
export function hmhV8SpawnableRoles(summary) {
  const roles = new Set(HMH_V8_OPENING_ROLES);
  C8.districts.forEach((id, index) => { if (bitSet(summary.exploration.visitedDistrictMask, index)) for (const role of HMH_V8_AREA_SPAWN_ROLES[id]) roles.add(role); });
  for (const row of summary.bosses) if (row.initiations > 0) for (const role of HMH_V8_BOSS_ADD_ROLES[row.bossId] ?? []) roles.add(role);
  return roles;
}

// Kills of ordinary roles no source the run reached could have spawned.
export function hmhV8UnspawnableKills(summary) {
  const roles = hmhV8SpawnableRoles(summary);
  return summary.kills.byEnemyRole.reduce((total, row) => total + (row.count > 0 && !C8.bosses.includes(row.enemyRoleId) && !roles.has(row.enemyRoleId) ? row.count : 0), 0);
}

export function hmhV8MinTicksForTravel(travelPx) {
  return Math.max(0, Math.ceil((travelPx - HMH_V8_TRAVEL.allowancePx) / HMH_V8_TRAVEL.maxStepPx));
}

// ---------------------------------------------------------------------------
// Pickups and grenades (the v7 mirrors with the ten-area tables).
export function hmhV8ObjectiveUnlocks(summary) {
  const unlocks = {};
  for (const row of summary?.objectives ?? []) if (row?.completed === 1) unlocks[row.objectiveId] = row.tick;
  const vault = (summary?.bosses ?? []).find((row) => row?.bossId === C8R.vault.bossId);
  if (vault?.defeatedTick > 0) unlocks[C8R.vault.objective] = vault.defeatedTick;
  return unlocks;
}

function placementCapacity([rearmTicks, unlock], runTicks, unlocks) {
  const from = typeof unlock === 'number' ? unlock : (Object.hasOwn(unlocks, unlock) ? unlocks[unlock] : null);
  if (!Number.isFinite(from)) return 0;
  const first = Math.max(C8R.firstTick, from);
  if (runTicks < first) return 0;
  return 1 + (rearmTicks > 0 ? Math.floor((runTicks - first) / rearmTicks) : 0);
}

export function hmhV8PickupCapacity(effectId, runTicks, unlocks = {}) {
  const placements = Object.hasOwn(C8R.pickupPlacements, effectId) ? C8R.pickupPlacements[effectId] : [];
  return placements.reduce((total, placement) => total + placementCapacity(placement, runTicks, unlocks), 0);
}

export function hmhV8PickupExcess(collectibles, runTicks, unlocks = {}) {
  let value = 0;
  let limit = 0;
  for (const row of collectibles) {
    if (row?.effectId === 'genesis-seal') continue;
    const capacity = hmhV8PickupCapacity(row?.effectId, runTicks, unlocks);
    if (row?.collected > capacity) {
      value += row.collected;
      limit += capacity;
    }
  }
  return value > 0 ? { value, limit } : null;
}

// Three at the start, one per Extra Grenade rank (three at most), one per
// nuke-liquidation collection and a refill to the maximum per defeated boss.
// No prisoner on this map hands any over.
export function hmhV8HandGrenadeSupply(summary) {
  const hand = C8R.handGrenades;
  const ranks = Math.min(hand.maxRanks, Math.max(0, rowCounts(summary.upgrades, 'upgradeId', 'selected')[hand.rankUpgradeId] ?? 0));
  const refills = rowCounts(summary.collectibles, 'effectId', 'collected')[hand.refillEffectId] ?? 0;
  const defeats = (summary.bosses ?? []).filter((row) => row?.defeatedTick > 0).length;
  return hand.startCharges + hand.chargesPerRank * ranks + refills + defeats * (hand.startMaxCharges + hand.chargesPerRank * ranks);
}

export function hmhV8WeaponsWithoutSource(summary) {
  const collected = rowCounts(summary.collectibles, 'effectId', 'collected');
  const [startingWeapon] = C8R.activeWeapons;
  const offending = [];
  for (const row of summary.weapons) {
    const weaponId = row?.weaponId;
    const cache = Object.hasOwn(C8R.weaponCaches, weaponId) ? C8R.weaponCaches[weaponId] : null;
    const equipped = row.equippedTicks > 0;
    const killed = row.kills > 0;
    const unsourced = (equipped && !C8R.activeWeapons.includes(weaponId))
      || (cache === null ? row.pickups > 0 : row.pickups > (collected[cache] ?? 0))
      || (cache !== null && weaponId !== startingWeapon && (equipped || killed) && row.pickups === 0)
      || (weaponId === C8R.handGrenades.weaponId && killed && !(summary.grenades.thrown > 0))
      || (weaponId === C8R.nuke.weaponId && killed && !((collected[C8R.nuke.effectId] ?? 0) > 0));
    if (unsourced) offending.push(weaponId);
  }
  return offending;
}

function checkV8Consistency(runSummary, runTicks, reject) {
  const { totals, kills, weapons, grenades, collectibles, exploration } = runSummary;
  const pickups = hmhV8PickupExcess(collectibles, runTicks, hmhV8ObjectiveUnlocks(runSummary));
  if (pickups) reject('pickups-above-capacity', pickups.value, pickups.limit);

  const districts = hmhV8DistrictTravel(exploration.visitedDistrictMask);
  const minTicks = hmhV8MinTicksForTravel(districts.travelPx);
  if (!districts.pathValid) reject('district-path-invalid', exploration.visitedDistrictMask, districts.entryBit);
  else if (runTicks < minTicks) reject('districts-before-travel-time', runTicks, minTicks);

  const timeless = runTicks === 0 ? Number(exploration.visitedDistrictMask !== 0) + Number(totals.damageDealt > 0) : 0;
  if (timeless) reject('activity-without-time', timeless, 0);

  const equippedTicks = weapons.reduce((total, row) => total + row.equippedTicks, 0);
  if (equippedTicks > runTicks) reject('equipped-ticks-above-run', equippedTicks, runTicks);

  const unsourced = hmhV8WeaponsWithoutSource(runSummary);
  if (unsourced.length) reject('weapon-without-source', unsourced.length, 0);

  if (grenades.kills > grenades.contacts) reject('grenade-kills-above-contacts', grenades.kills, grenades.contacts);
  const launches = grenades.thrown + (weapons.find((row) => row.weaponId === C8R.launcherWeapon)?.projectilesEmitted ?? 0);
  if (grenades.detonated > launches) reject('grenade-detonations-above-launches', grenades.detonated, launches);
  const supply = hmhV8HandGrenadeSupply(runSummary);
  if (grenades.thrown > supply) reject('grenades-thrown-above-supply', grenades.thrown, supply);

  const weaponDamage = weapons.reduce((total, row) => total + row.damage, 0);
  if (totals.damageDealt !== weaponDamage) reject('damage-dealt-mismatch', totals.damageDealt, weaponDamage);

  if (totals.maxCombo > kills.total) reject('combo-above-kills', totals.maxCombo, kills.total);

  const knife = weapons.find((row) => row.weaponId === C8R.melee.knifeWeapon);
  const standard = weapons.find((row) => row.weaponId === C8R.melee.standardWeapon);
  if (knife.kills > knife.projectileContacts) reject('knife-kills-above-contacts', knife.kills, knife.projectileContacts);
  const contactsWithoutTrigger = [knife, standard].filter((row) => row.projectileContacts > 0 && row.triggerContacts === 0).length;
  if (contactsWithoutTrigger) reject('melee-contacts-without-trigger', contactsWithoutTrigger, 0);
  const knifeSwings = hmhV6MeleeCadenceLimit(runTicks, C8R.melee.knifeCooldownTicks);
  if (knife.triggers > knifeSwings) reject('knife-triggers-above-cadence', knife.triggers, knifeSwings);
  const standardStrikes = hmhV6MeleeCadenceLimit(runTicks, C8R.melee.standardCooldownTicks);
  const standardClaimed = Math.max(standard.triggers, runSummary.forkedStandard?.attacks ?? 0);
  if (standardClaimed > standardStrikes) reject('standard-triggers-above-cadence', standardClaimed, standardStrikes);
}

// The movement row against the frozen cover and traversal rules.
export function checkV8Movement(runSummary, runTicks, reject) {
  const movement = runSummary.movement;
  const rules = HMH_V8_MOVEMENT_RULES;
  if (movement.rulesVersion !== rules.rulesVersion) reject('movement-rules-mismatch', movement.rulesVersion, rules.rulesVersion);
  const enters = Math.floor(runTicks / rules.coverEnterTicks);
  if (movement.coverEnters > enters) reject('cover-enters-above-cadence', movement.coverEnters, enters);
  if (movement.coverTicks === 0 && (movement.coverKills > 0 || movement.coverDamageReduced > 0)) reject('cover-without-cover-ticks', movement.coverKills + movement.coverDamageReduced, 0);
  if (movement.mantleTicks > rules.mantleTicks * movement.mantles
    || movement.mantleTicks < rules.mantleTicks * Math.max(0, movement.mantles - 1)) reject('mantle-ticks-mismatch', movement.mantleTicks, rules.mantleTicks * movement.mantles);
  const landTicks = rules.landRecoveryTicks * Math.max(0, movement.drops - 1);
  if (movement.landTicks < landTicks) reject('land-ticks-below-drops', movement.landTicks, landTicks);
}

// ---------------------------------------------------------------------------
// Gains, capacity, ceilings and node XP (the v7 formulas with v8 tables).
function measureV8Gains(ranks) {
  const xm = multiplierAt(clampedRank(ranks, 'validator-training'));
  const sm = multiplierAt(clampedRank(ranks, 'block-reward'));
  const killXp = {};
  const killScore = {};
  for (const [role, threat] of Object.entries(HMH_V8_ROLE_THREAT)) {
    killXp[role] = Math.round(hmhV8KillXp(threat) * xm);
    killScore[role] = Math.round(hmhV8KillScore(threat) * sm);
  }
  let comboXp = 0;
  let comboRate = 0;
  for (const [combo, baseXp] of Object.entries(V8.COMBO_MILESTONE_XP).map(([key, value]) => [Number(key), value]).sort(([a], [b]) => a - b)) {
    comboXp += Math.round(baseXp * xm);
    comboRate = Math.max(comboRate, comboXp / combo);
  }
  const cacheXp = Object.fromEntries(Object.entries(V8.CACHE_XP).map(([effectId, baseXp]) => [effectId, Math.round(baseXp * xm)]));
  const silverScorePerCoin = V8.SILVER_SCORE_PER_COIN * sm + 0.5;
  return Object.freeze({ xm, sm, killXp: Object.freeze(killXp), killScore: Object.freeze(killScore), comboRate, cacheXp: Object.freeze(cacheXp), silverScorePerCoin });
}

export const V8_MAX_GAINS = measureV8Gains(HMH_V8_UPGRADE_MAX_RANKS);

const initiationTicks = (row) => (row.initiations > 0 ? [...new Set([row.firstInitiatedTick, row.lastInitiatedTick])] : []);

export function hmhV8BossCouldSummon(row, bosses, runTicks) {
  if (!(row?.initiations > 0)) return false;
  if (row.initiations >= 2 || row.defeatedTick > 0) return true;
  let end = runTicks;
  for (const other of bosses) {
    if (other === row) continue;
    for (const tick of initiationTicks(other)) if (tick > row.lastInitiatedTick) end = Math.min(end, tick);
  }
  return end - row.lastInitiatedTick >= BOSS.BOSS_ADD_DELAY_TICKS;
}

export function hmhV8KillCapacity(summary) {
  const runTicks = summary.totals.survivalTicks;
  let capacity = V8.OPENING_ENEMIES + directorSpawnCapacity(runTicks, V8.ENCOUNTER_BAND_SCHEDULE);
  for (const row of summary.bosses) {
    if (row.defeatedTick > 0) capacity += 1;
    if (hmhV8BossCouldSummon(row, summary.bosses, runTicks)) capacity += BOSS.BOSS_ADDS_FIRST;
  }
  return capacity;
}

const levelSpan = (level) => hmhV8LevelThreshold(level) - hmhV8LevelThreshold(level - 1);

// Objective grants by the level each was claimed at → Map(level → { sum, max }).
function nodeGrantsByLevel(summary, xm) {
  const byLevel = new Map();
  for (const row of summary.objectives) {
    const node = HMH_V8_OBJECTIVES[row.objectiveId];
    if (row.completed !== 1 || !node) continue;
    const xp = Math.round(V8.OBJECTIVE_XP_PER_LEVEL[node.class] * row.levelAtCompletion * xm);
    const entry = byLevel.get(row.levelAtCompletion) ?? { sum: 0, max: 0 };
    entry.sum += xp;
    entry.max = Math.max(entry.max, xp);
    byLevel.set(row.levelAtCompletion, entry);
  }
  return byLevel;
}

export function hmhV8NodeLevelExcess(summary) {
  const byLevel = nodeGrantsByLevel(summary, 1);
  const finalLevel = summary.totals.level;
  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const { sum, max } = byLevel.get(level);
    if (level < finalLevel) {
      if (sum - max > levelSpan(level) - 1) return { level, value: sum - max, limit: levelSpan(level) - 1 };
    } else if (sum > summary.totals.xp - hmhV8LevelThreshold(level - 1)) {
      return { level, value: sum, limit: summary.totals.xp - hmhV8LevelThreshold(level - 1) };
    }
  }
  return null;
}

export function hmhV8Ceilings(summary, gains) {
  const killsByRole = rowCounts(summary.kills.byEnemyRole, 'enemyRoleId', 'count');
  const collected = rowCounts(summary.collectibles, 'effectId', 'collected');
  let killXp = 0;
  let killScore = 0;
  for (const role of Object.keys(HMH_V8_ROLE_THREAT)) {
    killXp += (killsByRole[role] ?? 0) * gains.killXp[role];
    killScore += (killsByRole[role] ?? 0) * gains.killScore[role];
  }
  const comboXp = Math.ceil(summary.kills.total * gains.comboRate);
  const cacheXp = Object.entries(gains.cacheXp).reduce((total, [effectId, xp]) => total + (collected[effectId] ?? 0) * xp, 0);
  let nodeXp = 0;
  for (const [level, { sum, max }] of nodeGrantsByLevel(summary, gains.xm)) {
    nodeXp += level < summary.totals.level ? Math.min(sum, levelSpan(level) - 1 + max) : sum;
  }
  // Silver: at most one coin per ordinary kill and each defeated boss's
  // burst. The ten-area map has no secrets.
  let bossKills = 0;
  let bossBursts = 0;
  for (const row of summary.bosses) {
    bossKills += killsByRole[row.bossId] ?? 0;
    if (row.defeatedTick > 0) bossBursts += HMH_V8_BOSSES[row.bossId]?.silverBurst ?? 0;
  }
  const silverCoins = Math.max(0, summary.kills.total - bossKills) * V8.SILVER_PER_ENEMY_KILL_MAX + bossBursts;
  return {
    xp: killXp + comboXp + cacheXp + nodeXp,
    score: killScore + Math.ceil(silverCoins * gains.silverScorePerCoin),
  };
}

export const HMH_V8_REJECTS = Object.freeze([
  'build-predates-schema-8',
  'start-tick-invalid',
  'progress-without-time',
  'elapsed-time-mismatch',
  'level-xp-mismatch',
  'boss-before-ready',
  'boss-fight-too-short',
  'boss-reinitiation-too-soon',
  'boss-fights-overlap',
  'kills-above-capacity',
  'grenade-kills-above-weapon-kills',
  'pickups-above-capacity',
  'district-path-invalid',
  'districts-before-travel-time',
  'activity-without-time',
  'equipped-ticks-above-run',
  'weapon-without-source',
  'grenade-kills-above-contacts',
  'grenade-detonations-above-launches',
  'grenades-thrown-above-supply',
  'damage-dealt-mismatch',
  'combo-above-kills',
  'knife-kills-above-contacts',
  'melee-contacts-without-trigger',
  'knife-triggers-above-cadence',
  'standard-triggers-above-cadence',
  'standard-kills-above-contacts',
  'collectibles-above-capacity',
  'node-xp-above-level',
  'node-in-unvisited-district',
  'enemy-role-not-in-visited-areas',
  'movement-rules-mismatch',
  'cover-enters-above-cadence',
  'cover-without-cover-ticks',
  'mantle-ticks-mismatch',
  'land-ticks-below-drops',
  'xp-above-ceiling',
  'score-above-ceiling',
]);

// → { verdict: 'ok'|'flagged'|'rejected', flags }. Expects a summary that
// already passed the schema-8 validator.
export function validateV8RunPlausibility(runSummary) {
  const { reject, flag, done } = verdictCollector();
  const { identity, totals, kills, milestones, upgrades, collectibles, exploration, objectives, bosses, evolutions, movement } = runSummary ?? {};
  if (runSummary?.schemaVersion !== 8 || !identity || !totals || !kills || !Array.isArray(kills.byEnemyRole) || !milestones || !Array.isArray(upgrades)
    || !Array.isArray(collectibles) || !exploration || !Array.isArray(objectives) || !Array.isArray(bosses) || !Array.isArray(evolutions)
    || !Array.isArray(kills.byWeapon) || !runSummary.grenades || !Array.isArray(runSummary.weapons) || !movement) {
    reject('summary-unreadable', null, null);
    return done();
  }
  if (!isHmhV8Build(identity.buildHash)) reject('build-predates-schema-8', hmhGameVersionOfBuild(identity.buildHash)?.join('.') ?? null, HMH_RUN_SUMMARY_V8_MIN_GAME_VERSION);

  // Run time (as v6/v7): a fresh simulation from tick 0, at the fixed step.
  if (identity.startTick !== 0) reject('start-tick-invalid', identity.startTick, 0);
  const runTicks = totals.survivalTicks;
  const progress = kills.total > 0 || totals.score > 0 || totals.xp > 0 || totals.level > 1 || totals.litecoin > 0;
  if (progress && (runTicks === 0 || totals.elapsedMs === 0)) reject('progress-without-time', totals.elapsedMs, 0);
  const expectedMs = runTicks * V8.FIXED_STEP_MS;
  if (Math.abs(totals.elapsedMs - expectedMs) > ELAPSED_TOLERANCE_MS) reject('elapsed-time-mismatch', totals.elapsedMs, expectedMs);

  const expectedLevel = hmhV8LevelForXp(totals.xp);
  if (totals.level !== expectedLevel) reject('level-xp-mismatch', totals.level, expectedLevel);

  for (const row of bosses) {
    const readyTick = HMH_V8_BOSSES[row.bossId]?.readyTick ?? Infinity;
    if (row.initiations > 0 && row.firstInitiatedTick < readyTick) reject('boss-before-ready', row.firstInitiatedTick, readyTick);
  }
  for (const row of bosses) {
    const fight = row.defeatedTick - row.lastInitiatedTick;
    const minimum = HMH_V8_BOSSES[row.bossId]?.minFightTicks ?? Infinity;
    if (row.defeatedTick > 0 && fight < minimum) reject('boss-fight-too-short', fight, minimum);
  }
  for (const row of bosses) {
    const bound = (row.initiations - 1) * BOSS.BOSS_REINITIATION_MIN_TICKS;
    const span = row.lastInitiatedTick - row.firstInitiatedTick;
    if (row.initiations >= 2 && span < bound) reject('boss-reinitiation-too-soon', span, bound);
  }
  const overlaps = hmhV7BossOverlaps(bosses);
  if (overlaps) reject('boss-fights-overlap', overlaps, 0);

  const capacity = hmhV8KillCapacity(runSummary);
  if (kills.total > capacity) reject('kills-above-capacity', kills.total, capacity);
  else if (kills.total > NEAR_CEILING_FRACTION * capacity) flag('kills-near-capacity', kills.total, capacity);

  const weaponKills = rowCounts(kills.byWeapon, 'weaponId', 'count');
  const grenadeWeaponKills = C8R.grenadeWeapons.reduce((total, weaponId) => total + (weaponKills[weaponId] ?? 0), 0);
  if (runSummary.grenades.kills > grenadeWeaponKills) reject('grenade-kills-above-weapon-kills', runSummary.grenades.kills, grenadeWeaponKills);

  checkV8Consistency(runSummary, runTicks, reject);

  const standard = runSummary.weapons.find((row) => row.weaponId === C8R.melee.standardWeapon);
  const standardContacts = Math.max(standard.projectileContacts, runSummary.forkedStandard?.contacts ?? 0);
  if (standard.kills > standardContacts) reject('standard-kills-above-contacts', standard.kills, standardContacts);

  const pickups = collectibles.reduce((total, row) => total + (row.effectId === 'genesis-seal' ? 0 : row.collected), 0);
  const pickupCapacity = hmhV8CollectibleCapacity(runTicks);
  if (pickups > pickupCapacity) reject('collectibles-above-capacity', pickups, pickupCapacity);

  const excess = hmhV8NodeLevelExcess(runSummary);
  if (excess) reject('node-xp-above-level', excess.value, excess.limit);

  // A boss is initiated and an objective completed only by a hero standing
  // in its area (the courts and machines lie inside their areas), and the
  // child marks an area on each tick the hero stands in it.
  const visited = (district) => bitSet(exploration.visitedDistrictMask, C8.districts.indexOf(district));
  const unvisited = objectives.filter((row) => row.completed === 1 && !visited(HMH_V8_OBJECTIVES[row.objectiveId]?.district)).length
    + bosses.filter((row) => row.initiations > 0 && !visited(HMH_V8_BOSSES[row.bossId]?.district)).length;
  if (unvisited) reject('node-in-unvisited-district', unvisited, 0);

  // An ordinary enemy is spawned for the area the hero stands in (or is a
  // boss's add), so its role must be in a visited area's pool.
  const unspawnable = hmhV8UnspawnableKills(runSummary);
  if (unspawnable) reject('enemy-role-not-in-visited-areas', unspawnable, 0);

  checkV8Movement(runSummary, runTicks, reject);

  const hard = hmhV8Ceilings(runSummary, V8_MAX_GAINS);
  if (totals.xp > hard.xp) reject('xp-above-ceiling', totals.xp, hard.xp);
  else if (totals.xp > NEAR_CEILING_FRACTION * hard.xp) flag('xp-near-ceiling', totals.xp, hard.xp);
  if (totals.score > hard.score) reject('score-above-ceiling', totals.score, hard.score);
  else if (totals.score > NEAR_CEILING_FRACTION * hard.score) flag('score-near-ceiling', totals.score, hard.score);

  // Soft cross-checks (never reject; none can raise a ceiling).
  const selected = Object.fromEntries(upgrades.map((row) => [row.upgradeId, row.selected]));
  const claimed = hmhV8Ceilings(runSummary, measureV8Gains(selected));
  if (totals.xp > claimed.xp && totals.xp <= hard.xp) flag('xp-above-selected-upgrades', totals.xp, claimed.xp);
  if (totals.score > claimed.score && totals.score <= hard.score) flag('score-above-selected-upgrades', totals.score, claimed.score);
  if (totals.maxCombo > kills.total) flag('combo-exceeds-kills', totals.maxCombo, kills.total);
  const aboveMaxRank = upgrades.filter((row) => row.selected > (HMH_V8_UPGRADE_MAX_RANKS[row.upgradeId] ?? Infinity)).length;
  if (aboveMaxRank) flag('upgrade-rank-above-max', aboveMaxRank, 0);
  const withoutMastery = evolutions.filter((row) => row.applied === 1
    && Object.entries(HMH_V8_EVOLUTIONS[row.evolutionId]?.mastery ?? {}).some(([upgradeId, rank]) => !((selected[upgradeId] ?? 0) >= rank))).length;
  if (withoutMastery) flag('evolution-without-mastery', withoutMastery, 0);
  const nodes = objectives.filter((row) => row.completed === 1).map((row) => ({ tick: row.tick, level: row.levelAtCompletion })).sort((a, b) => a.tick - b.tick || a.level - b.level);
  let levelBefore = 0;
  let levelAtTick = 0;
  let tick = -1;
  let outOfOrder = 0;
  for (const node of nodes) {
    if (node.tick !== tick) {
      levelBefore = Math.max(levelBefore, levelAtTick);
      levelAtTick = 0;
      tick = node.tick;
    }
    levelAtTick = Math.max(levelAtTick, node.level);
    if (node.level < levelBefore
      || (node.level >= 2 && node.tick < milestones.firstLevelUpTick)
      || (node.level < totals.level && node.tick > milestones.lastLevelUpTick)) outOfOrder += 1;
  }
  if (outOfOrder) flag('node-level-inconsistent', outOfOrder, 0);
  return done();
}
