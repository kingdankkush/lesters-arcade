// Shared by the per-game verifiers (contract §5.3). Server only.
//
// - buildVerifiedRun: the frozen VerifiedRun of §5.3 (A12 clamps, the v2
//   envelope hash of §2.6, the stored evidence text, bytes and digest).
// - invalid / rejected / scoreOutOfBounds: the error shapes (400 and 422).
// - loadRunStatsMappers: the §6.3 stats mappers.
//
// index.mjs imports the per-game modules lazily, so this shared code lives here
// rather than in index.mjs (which would make an import cycle).
//
// Stats: the canonical mappers are statsFromChikunResult, statsFromStackedTuple
// and statsFromHmhRunSummary in apps/portal/src/achievements/stats.mjs
// (achievements slice). loadRunStatsMappers() uses that module whenever it
// exists. The fallback below exists only because the verify slice was branched
// before the achievements slice merged: it mirrors the achievements mappers
// (same keys, same values) so VerifiedRun.stats has the §6.3 shape either way.
// Once the achievements slice is merged the fallback is dead code and can be
// deleted together with the existsSync branch.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HMH_RUN_SUMMARY_CATALOGS } from '../../sdk/hmh-run-summary-schema.mjs';
import { distanceAtTick } from '../../apps/portal/src/chikun-ground-course.mjs';
import { CHIKUN_REGIONS } from '../../apps/portal/src/chikun-course-regions.mjs';
import { zoneForTick } from '../../apps/portal/src/stacked-sim.mjs';
import { RANKED_GAMES, rankedEnvelopeHash } from '../../apps/portal/src/ranked-identity.mjs';

const ACHIEVEMENT_STATS_URL = new URL('../../apps/portal/src/achievements/stats.mjs', import.meta.url);

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

function chikunStats(result) {
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

function stackedStats(tuple) {
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

// The achievements catalog's role → family table (achievements/hmh.mjs).
const HMH_ROLE_FAMILIES = Object.freeze({
  'bagholder-rusher': 'goblin',
  forkrunner: 'goblin',
  'liquidator-agent': 'drone',
  'validator-cultist': 'drone',
  'gas-bomber': 'gasBeast',
  'whale-enforcer': 'enforcer',
});
const HMH_FAMILY_IDS = Object.freeze(['goblin', 'drone', 'gasBeast', 'enforcer']);
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

function hmhStats(summary) {
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
  const elapsedMs = num(totals.elapsedMs, 'totals.elapsedMs');
  const noDamage = damageTaken === 0 ? 1 : 0;
  const bossEngagedTick = summary.milestones?.bossEngagedTick;
  return {
    score: count(totals.score, 'totals.score'),
    kills: count(kills.total, 'kills.total'),
    bossKills,
    eliteKills: count(kills.elite, 'kills.elite'),
    maxCombo: count(totals.maxCombo, 'totals.maxCombo'),
    level: count(totals.level, 'totals.level'),
    xp: count(totals.xp, 'totals.xp'),
    survivalTicks: count(totals.survivalTicks, 'totals.survivalTicks'),
    elapsedMs,
    survivalSeconds: round(elapsedMs / 1000, 3),
    damageTaken,
    damageDealt: num(totals.damageDealt, 'totals.damageDealt'),
    healing: num(totals.healing, 'totals.healing'),
    litecoin: count(totals.litecoin, 'totals.litecoin'),
    grenadeKills: count(grenades.kills, 'grenades.kills'),
    meleeKills,
    weaponsUsed,
    uniqueWeaponCount: weaponsUsed.length,
    powerUpsCollected,
    uniquePowerUps,
    districtsVisited: bits(exploration.visitedDistrictMask),
    poisDiscovered: bits(exploration.discoveredPoiMask),
    revealedPermille: count(exploration.revealedPermille, 'exploration.revealedPermille'),
    killsByRole,
    familyKills,
    noDamage,
    perfectBossKill: bossKills > 0 && noDamage === 1 ? 1 : 0,
    bossEngaged: Number.isInteger(bossEngagedTick) ? (bossEngagedTick > 0 ? 1 : 0) : (bossKills > 0 ? 1 : 0),
    heroId: text(identity.heroId, 'identity.heroId'),
    terminalReason: text(identity.terminalReason, 'identity.terminalReason'),
  };
}

const FALLBACK = Object.freeze({
  source: 'verify-fallback',
  statsFromChikunResult: chikunStats,
  statsFromStackedTuple: stackedStats,
  statsFromHmhRunSummary: hmhStats,
});

let loaded = null;

// → Promise<{ source, statsFromChikunResult, statsFromStackedTuple, statsFromHmhRunSummary }>.
// When the achievements module exists, any error loading it propagates: a
// broken stats module must fail the settle, never fall back silently.
export function loadRunStatsMappers() {
  loaded ??= (async () => {
    if (!existsSync(fileURLToPath(ACHIEVEMENT_STATS_URL))) return FALLBACK;
    const module = await import('../../apps/portal/src/achievements/stats.mjs');
    return Object.freeze({
      source: 'achievements',
      statsFromChikunResult: module.statsFromChikunResult,
      statsFromStackedTuple: module.statsFromStackedTuple,
      statsFromHmhRunSummary: module.statsFromHmhRunSummary,
    });
  })();
  loaded.catch(() => { loaded = null; });
  return loaded;
}

export const ACHIEVEMENT_STATS_PATH = fileURLToPath(ACHIEVEMENT_STATS_URL);

// ---------------------------------------------------------------------------
// Error shapes. Every failure is { ok:false, status, error, detail?, flags? }.

export const MAX_RANKED_SCORE = 10_000_000_000;
// A12 clamps for the contract fields (stats keep the unclamped values).
export const CONTRACT_BOUNDS = Object.freeze({ kills: 100_000, maxCombo: 10_000, survivalSeconds: 86_400 });

export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

export function invalid(error, detail) {
  return Object.freeze({ ok: false, status: 400, error, ...(detail ? { detail: String(detail).slice(0, 240) } : {}) });
}

export function rejected(error, extra = {}) {
  return Object.freeze({ ok: false, status: 422, error, ...extra });
}

export function scoreOutOfBounds(score) {
  return rejected('score-out-of-bounds', { detail: `score ${String(score)} exceeds ${MAX_RANKED_SCORE}` });
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const clampCount = (value, maximum) => Math.min(maximum, Math.max(0, Math.floor(Number(value) || 0)));

// → Promise<VerifiedRun | failure>. `identity` is the canonical identity (with
// version and sessionKey). `stats` receives the loaded mappers and returns the
// §6.3 stats; a mapper that throws turns into `statsError`.
export async function buildVerifiedRun({ identity, nowMs, score, stats, statsError = rejected('replay-rejected', { detail: 'stats' }), contract, evidence, plausibility = null }) {
  if (!Number.isFinite(nowMs)) throw new TypeError('nowMs is required to stamp verifiedAt');
  const game = RANKED_GAMES[identity.gameId];
  if (!game) throw new TypeError(`unknown ranked gameId: ${String(identity.gameId)}`);
  if (!Number.isSafeInteger(score) || score < 0) return rejected('replay-rejected', { detail: 'score' });
  if (score > MAX_RANKED_SCORE) return scoreOutOfBounds(score);
  let runStats;
  try {
    runStats = stats(await loadRunStatsMappers());
  } catch {
    return statsError;
  }
  const bytes = new TextEncoder().encode(evidence.text).length;
  const envelopeHash = await rankedEnvelopeHash({ gameId: identity.gameId, sessionId32: identity.sessionKey, encoding: evidence.encoding, evidenceDigest: evidence.digest });
  return deepFreeze({
    ok: true,
    gameId: identity.gameId,
    sessionId32: identity.sessionKey,
    sessionHandle: identity.sessionId,
    wallet: identity.wallet,
    seasonId: identity.seasonId,
    runtimeId: game.runtimeId,
    buildHash: identity.buildHash,
    seed: identity.seed,
    score,
    contract: {
      kills: clampCount(contract.kills, CONTRACT_BOUNDS.kills),
      maxCombo: clampCount(contract.maxCombo, CONTRACT_BOUNDS.maxCombo),
      survivalSeconds: clampCount(contract.survivalSeconds, CONTRACT_BOUNDS.survivalSeconds),
      bossId: contract.bossId ?? null,
    },
    stats: runStats,
    evidence: { encoding: evidence.encoding, text: evidence.text, bytes, digest: evidence.digest },
    envelopeHash,
    identity: { ...identity },
    plausibility,
    verifiedAt: new Date(nowMs).toISOString(),
  });
}
