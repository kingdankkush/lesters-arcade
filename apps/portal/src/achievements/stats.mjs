// Per-game stats mappers (contract §6.3). Their output is the only input to
// achievement criteria, verified_sessions.stats and the results screen, so each
// mapper returns exactly the documented keys and every numeric value is finite.
// Malformed input throws. The server runs these only on a replayed result or
// tuple, or on an HMH summary that already passed the schema and plausibility
// checks, so a throw there is a server-side inconsistency, not the player's
// fault: it propagates and settle answers a retryable 500, never a 422 that
// rejects the paid run (verify's policy, server/verify/verified-run.mjs).
import { HMH_RUN_SUMMARY_CATALOGS } from '../../../../sdk/hmh-run-summary-schema.mjs';
import { distanceAtTick } from '../chikun-ground-course.mjs';
import { CHIKUN_REGIONS } from '../chikun-course-regions.mjs';
import { zoneForTick } from '../stacked-sim.mjs';
import { HMH_DISTRICT_STAGES, HMH_FAMILY_IDS, HMH_LEGACY_FAMILY_ENEMY_IDS, HMH_ROLE_FAMILIES } from './hmh.mjs';

const round = (value, places) => Number(value.toFixed(places));
function num(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  return value;
}
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer`);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}
const bits = (mask) => { let total = 0; for (let rest = count(mask, 'mask'); rest > 0; rest = Math.floor(rest / 2)) total += rest % 2; return total; };

// ---------------------------------------------------------------------------
// Chikun's Escape: a replayed v6 result (chikun-ground-runtime.mjs result()).
export function statsFromChikunResult(result) {
  if (!result || typeof result !== 'object') throw new TypeError('Chikun result must be an object');
  const evidence = result.evidence;
  const flaps = Array.isArray(evidence?.flapDeltas) ? evidence.flapDeltas : evidence?.flapSteps;
  if (!Array.isArray(flaps)) throw new TypeError('Chikun result evidence must list its flaps');
  const survivalTicks = count(result.survivalTicks, 'survivalTicks');
  const regionIndexReached = count(result.regionIndexReached, 'regionIndexReached');
  if (regionIndexReached >= CHIKUN_REGIONS.length || result.regionReached !== CHIKUN_REGIONS[regionIndexReached].id) {
    throw new TypeError('Chikun regionReached does not match regionIndexReached');
  }
  return {
    score: count(result.score, 'score'),
    survivalTicks,
    survivalSeconds: round(survivalTicks / 60, 3),
    coinsCollected: count(result.coinsCollected, 'coinsCollected'),
    forksPassed: count(result.forksPassed, 'forksPassed'),
    nearMisses: count(result.nearMisses, 'nearMisses'),
    bestCombo: count(result.bestCombo, 'bestCombo'),
    nearMissStreakBest: count(result.nearMissStreakBest, 'nearMissStreakBest'),
    flawlessRegions: count(result.flawlessRegions, 'flawlessRegions'),
    flapCount: flaps.length,
    distanceMeters: Math.floor(distanceAtTick(survivalTicks) / 10),
    regionIndexReached,
    regionReached: result.regionReached,
    laps: count(result.laps, 'laps'),
    speedMultiplierReached: round(num(result.speedMultiplierReached, 'speedMultiplierReached'), 2),
    terminalReason: text(result.finalState?.terminalReason, 'terminalReason'),
    evidenceVersion: text(evidence.version, 'evidenceVersion'),
  };
}

// ---------------------------------------------------------------------------
// STACKED: the replayed result tuple (stacked-result-v1).
export function statsFromStackedTuple(tuple) {
  if (!tuple || typeof tuple !== 'object' || tuple.v !== 'stacked-result-v1') throw new TypeError('STACKED tuple must be a stacked-result-v1 object');
  const ticks = count(tuple.ticks, 'ticks');
  return {
    score: count(tuple.score, 'score'),
    lines: count(tuple.lines, 'lines'),
    level: count(tuple.level, 'level'),
    quadClears: count(tuple.quadClears, 'quadClears'),
    spins: count(tuple.spins, 'spins'),
    perfectClears: count(tuple.perfectClears, 'perfectClears'),
    maxCombo: count(tuple.maxCombo, 'maxCombo'),
    maxBackToBack: count(tuple.maxBackToBack, 'maxBackToBack'),
    garbageRowsReceived: count(tuple.garbageRowsReceived, 'garbageRowsReceived'),
    garbageRowsCleared: count(tuple.garbageRowsCleared, 'garbageRowsCleared'),
    pieces: count(tuple.pieces, 'pieces'),
    holdsUsed: count(tuple.holdsUsed, 'holdsUsed'),
    ticks,
    survivalSeconds: round(ticks / 60, 3),
    zone: zoneForTick(ticks),
    terminalReason: text(tuple.terminalReason, 'terminalReason'),
    boardHash: text(tuple.boardHash, 'boardHash'),
  };
}

// ---------------------------------------------------------------------------
// Hard Money Heroes: the canonical run summary (sdk/hmh-run-summary.mjs).
const C = HMH_RUN_SUMMARY_CATALOGS;
const MELEE_WEAPONS = Object.freeze(['litecoin-knife', 'forked-standard']);
const NOT_POWER_UPS = Object.freeze(['litecoin-token']);

function rowsById(rows, ids, idKey, label) {
  if (!Array.isArray(rows)) throw new TypeError(`${label} must be an array`);
  const out = {};
  for (const row of rows) {
    if (!ids.includes(row?.[idKey])) throw new TypeError(`${label} has an unknown id`);
    out[row[idKey]] = row;
  }
  return out;
}

function hmhParts(summary) {
  if (!summary || typeof summary !== 'object') throw new TypeError('HMH run summary must be an object');
  const { identity, totals, kills, weapons, grenades, collectibles, exploration } = summary;
  if (!identity || !totals || !kills || !grenades || !exploration) throw new TypeError('HMH run summary is incomplete');
  const byRole = rowsById(kills.byEnemyRole, C.enemyRoles, 'enemyRoleId', 'kills.byEnemyRole');
  const byWeapon = rowsById(kills.byWeapon, C.weapons, 'weaponId', 'kills.byWeapon');
  const weaponRows = rowsById(weapons, C.weapons, 'weaponId', 'weapons');
  const collectibleRows = rowsById(collectibles, C.collectibles, 'effectId', 'collectibles');
  const killsByRole = Object.fromEntries(C.enemyRoles.map((id) => [id, count(byRole[id]?.count ?? 0, `kills of ${id}`)]));
  const familyKills = Object.fromEntries(HMH_FAMILY_IDS.map((family) => [family, 0]));
  for (const [role, family] of Object.entries(HMH_ROLE_FAMILIES)) familyKills[family] += killsByRole[role];
  const weaponsUsed = C.weapons.filter((id) => count(weaponRows[id]?.equippedTicks ?? 0, `${id} equippedTicks`) > 0).sort();
  const powerUps = C.collectibles.filter((id) => !NOT_POWER_UPS.includes(id));
  const uniquePowerUps = powerUps.filter((id) => count(collectibleRows[id]?.collected ?? 0, `${id} collected`) > 0).sort();
  const powerUpsCollected = powerUps.reduce((sum, id) => sum + (collectibleRows[id]?.collected ?? 0), 0);
  const meleeKills = MELEE_WEAPONS.reduce((sum, id) => sum + count(byWeapon[id]?.count ?? 0, `kills with ${id}`), 0);
  const bossKills = count(kills.boss, 'kills.boss');
  const damageTaken = num(totals.damageTaken, 'totals.damageTaken');
  return { identity, totals, kills, grenades, exploration, summary, killsByRole, familyKills, weaponsUsed, uniquePowerUps, powerUpsCollected, meleeKills, bossKills, damageTaken };
}

export function statsFromHmhRunSummary(runSummary) {
  const p = hmhParts(runSummary);
  const elapsedMs = num(p.totals.elapsedMs, 'totals.elapsedMs');
  const noDamage = p.damageTaken === 0 ? 1 : 0;
  const bossEngagedTick = p.summary.milestones?.bossEngagedTick;
  return {
    score: count(p.totals.score, 'totals.score'),
    kills: count(p.kills.total, 'kills.total'),
    bossKills: p.bossKills,
    eliteKills: count(p.kills.elite, 'kills.elite'),
    maxCombo: count(p.totals.maxCombo, 'totals.maxCombo'),
    level: count(p.totals.level, 'totals.level'),
    xp: count(p.totals.xp, 'totals.xp'),
    survivalTicks: count(p.totals.survivalTicks, 'totals.survivalTicks'),
    elapsedMs,
    survivalSeconds: round(elapsedMs / 1000, 3),
    damageTaken: p.damageTaken,
    damageDealt: num(p.totals.damageDealt, 'totals.damageDealt'),
    healing: num(p.totals.healing, 'totals.healing'),
    litecoin: count(p.totals.litecoin, 'totals.litecoin'),
    grenadeKills: count(p.grenades.kills, 'grenades.kills'),
    meleeKills: p.meleeKills,
    weaponsUsed: p.weaponsUsed,
    uniqueWeaponCount: p.weaponsUsed.length,
    powerUpsCollected: p.powerUpsCollected,
    uniquePowerUps: p.uniquePowerUps,
    districtsVisited: bits(p.exploration.visitedDistrictMask),
    poisDiscovered: bits(p.exploration.discoveredPoiMask),
    revealedPermille: count(p.exploration.revealedPermille, 'exploration.revealedPermille'),
    killsByRole: p.killsByRole,
    familyKills: p.familyKills,
    noDamage,
    perfectBossKill: p.bossKills > 0 && noDamage === 1 ? 1 : 0,
    bossEngaged: Number.isInteger(bossEngagedTick) ? (bossEngagedTick > 0 ? 1 : 0) : (p.bossKills > 0 ? 1 : 0),
    heroId: text(p.identity.heroId, 'identity.heroId'),
    terminalReason: text(p.identity.terminalReason, 'identity.terminalReason'),
  };
}

// The legacy resolver inputs (arcade-core resolveAchievementUnlocksForRun) for
// the same summary, with the exact keys of contract §6.4, so the browser
// resolver and the server catalog agree.
export function hmhResolverInputsFromRunSummary(runSummary) {
  const p = hmhParts(runSummary);
  const districts = bits(p.exploration.visitedDistrictMask);
  const stage = HMH_DISTRICT_STAGES.find(([minimum]) => districts >= minimum);
  return {
    enemyKillsByType: Object.fromEntries(Object.entries(HMH_LEGACY_FAMILY_ENEMY_IDS).map(([family, legacyId]) => [legacyId, p.familyKills[family]])),
    stageIndexReached: stage ? stage[1] : 1,
    grenadeKills: count(p.grenades.kills, 'grenades.kills'),
    meleeKills: p.meleeKills,
    bossId: p.bossKills > 0 ? 'boss-liquidator' : null,
    noDamage: p.damageTaken === 0,
    maxCombo: count(p.totals.maxCombo, 'totals.maxCombo'),
    weaponIds: p.weaponsUsed,
    collectedPowerUps: p.uniquePowerUps,
  };
}

// Both arguments the device-local arcade-core recordScore(state, session, score,
// runStats) needs for an HMH Ranked run, from the same summary: the §6.4 resolver
// inputs plus the run totals the resolver also reads (survival time, kills,
// pickups, damage dealt). With them the browser unlocks the same HMH ids as the
// server catalog; the §6.4 mapper alone leaves those totals at 0.
export function hmhRecordScoreInputsFromRunSummary(runSummary) {
  const stats = statsFromHmhRunSummary(runSummary);
  return {
    score: stats.score,
    runStats: {
      ...hmhResolverInputsFromRunSummary(runSummary),
      elapsedSeconds: stats.survivalSeconds,
      kills: stats.kills,
      powerUpsCollected: stats.powerUpsCollected,
      damageDealt: stats.damageDealt,
    },
  };
}
