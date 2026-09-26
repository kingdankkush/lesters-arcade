// Verifies the runs of a batch as Ranked would: verifyRankedRun on a full §5.1
// body (the plan's seed ticket, the identity, and a session envelope built
// from the child's own run events) and validateRebootRunPlausibility on the
// summary alone, plus how close each run came to every v6 rule.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RANKED_GAMES, RANKED_SETTLE_VERSION } from '../../apps/portal/src/ranked-identity.mjs';
import { createSessionEvidenceState, finalizeSessionEvidence, recordSessionEvent, recordSessionInput } from '../../apps/portal/src/session-integrity.mjs';
import { verifyRankedRun } from '../../server/verify/index.mjs';
import {
  HMH_V6_CONSISTENCY_RULES,
  HMH_ROLE_THREAT,
  MAX_GAINS,
  SILVER_PER_BOSS_KILL,
  SILVER_PER_ENEMY_KILL,
  hmhV6DistrictTravel,
  hmhV6HandGrenadeSupply,
  hmhV6LevelEntry,
  hmhV6MinTicksForTravel,
  hmhV6ObjectiveUnlocks,
  hmhV6PickupCapacity,
  hmhV6WeaponsWithoutSource,
  spawnCapacity,
  validateRebootRunPlausibility,
} from '../../server/verify/hmh-plausibility.mjs';
import { validateRunSummaryPayload } from '../../sdk/hmh-run-summary-schema.mjs';
import { FIXTURE_CHAIN_ID, FIXTURE_ISSUED_AT, FIXTURE_REGISTRY, FIXTURE_SEED_SECRET, FIXTURE_WALLET, GAME_ID } from './identity.mjs';

const rows = (list, key, value) => Object.fromEntries((list ?? []).map((row) => [row[key], row[value]]));
const plain = (value) => JSON.parse(JSON.stringify(value));
export const DISTRICT_IDS = Object.freeze(['frontier-relay', 'rugpull-ravine', 'liquidity-crossing', 'hashwood', 'mining-camp', 'liquidation-yard']);

// Hard XP / score ceilings exactly as hmh-plausibility.mjs ceilings() (not exported).
export function hardCeilings(summary) {
  const killsByRole = rows(summary.kills.byEnemyRole, 'enemyRoleId', 'count');
  const collected = rows(summary.collectibles, 'effectId', 'collected');
  const bossKills = Math.max(summary.kills.boss, killsByRole.liquidator ?? 0);
  let killXp = 0;
  let killScore = 0;
  for (const role of Object.keys(HMH_ROLE_THREAT)) {
    killXp += (killsByRole[role] ?? 0) * MAX_GAINS.killXp[role];
    killScore += (killsByRole[role] ?? 0) * MAX_GAINS.killScore[role];
  }
  const comboXp = Math.ceil(summary.kills.total * MAX_GAINS.comboRate);
  const cacheXp = Object.entries(MAX_GAINS.cacheXp).reduce((sum, [effectId, xp]) => sum + (collected[effectId] ?? 0) * xp, 0);
  const silverCoins = Math.max(0, summary.kills.total - bossKills) * SILVER_PER_ENEMY_KILL + bossKills * SILVER_PER_BOSS_KILL;
  return { xp: killXp + comboXp + cacheXp, score: killScore + Math.ceil(silverCoins * MAX_GAINS.silverScorePerCoin) };
}

// How close the run came to each v6 consistency rule (and the older ceilings).
export function margins(summary) {
  const V6C = HMH_V6_CONSISTENCY_RULES;
  const runTicks = summary.totals.survivalTicks;
  const weaponKills = rows(summary.kills.byWeapon, 'weaponId', 'count');
  const grenadeWeaponKills = V6C.grenadeWeapons.reduce((sum, id) => sum + (weaponKills[id] ?? 0), 0);
  const unlocks = hmhV6ObjectiveUnlocks(summary);
  const pickups = summary.collectibles.filter((row) => row.collected > 0).map((row) => {
    const capacity = hmhV6PickupCapacity(row.effectId, runTicks, unlocks);
    return { effectId: row.effectId, collected: row.collected, capacity, slack: capacity - row.collected, ratio: capacity ? Number((row.collected / capacity).toFixed(3)) : null };
  });
  const travel = hmhV6DistrictTravel(summary.identity.seed, summary.exploration.visitedDistrictMask);
  const minTicks = hmhV6MinTicksForTravel(travel.travelPx);
  const equipped = summary.weapons.reduce((sum, row) => sum + row.equippedTicks, 0);
  const launcherTriggers = summary.weapons.find((row) => row.weaponId === 'launcher-rig')?.triggers ?? 0;
  const supply = hmhV6HandGrenadeSupply(summary);
  const weaponDamage = summary.weapons.reduce((sum, row) => sum + row.damage, 0);
  const capacity = spawnCapacity(runTicks);
  const ceilings = hardCeilings(summary);
  const collected = rows(summary.collectibles, 'effectId', 'collected');
  const weaponSource = summary.weapons.filter((row) => row.pickups > 0 || row.equippedTicks > 0 || row.kills > 0).map((row) => ({
    weaponId: row.weaponId, pickups: row.pickups, cacheCollected: V6C.weaponCaches[row.weaponId] ? (collected[V6C.weaponCaches[row.weaponId]] ?? 0) : null, equippedTicks: row.equippedTicks, kills: row.kills,
  }));
  return {
    runTicks,
    grenadeKillsVsWeaponKills: { grenadeKills: summary.grenades.kills, grenadeWeaponKills },
    pickups,
    pickupTightest: pickups.reduce((best, row) => (best === null || row.slack < best.slack ? row : best), null),
    district: { entry: hmhV6LevelEntry(summary.identity.seed).id, mask: summary.exploration.visitedDistrictMask, pathValid: travel.pathValid, travelPx: travel.travelPx, minTicks, runTicks, ratio: runTicks ? Number((minTicks / runTicks).toFixed(4)) : null },
    equippedTicks: { equipped, runTicks, slack: runTicks - equipped },
    weaponsWithoutSource: hmhV6WeaponsWithoutSource(summary),
    weaponSource,
    grenadeContacts: { kills: summary.grenades.kills, contacts: summary.grenades.contacts },
    grenadeLaunches: { detonated: summary.grenades.detonated, thrown: summary.grenades.thrown, launcherTriggers, launches: summary.grenades.thrown + launcherTriggers },
    grenadeSupply: { thrown: summary.grenades.thrown, supply, slack: supply - summary.grenades.thrown },
    damage: { damageDealt: summary.totals.damageDealt, weaponDamage, diff: summary.totals.damageDealt - weaponDamage },
    combo: { maxCombo: summary.totals.maxCombo, kills: summary.kills.total },
    killsCapacity: { kills: summary.kills.total, capacity, ratio: Number((summary.kills.total / capacity).toFixed(4)) },
    xpCeiling: { xp: summary.totals.xp, ceiling: ceilings.xp, ratio: ceilings.xp ? Number((summary.totals.xp / ceilings.xp).toFixed(4)) : null },
    scoreCeiling: { score: summary.totals.score, ceiling: ceilings.score, ratio: ceilings.score ? Number((summary.totals.score / ceilings.score).toFixed(4)) : null },
  };
}

// The compact statistics the report prints for one summary.
export function summaryStats(summary) {
  return {
    survivalTicks: summary.totals.survivalTicks, kills: summary.kills.total, boss: summary.kills.boss, level: summary.totals.level, xp: summary.totals.xp, score: summary.totals.score,
    maxCombo: summary.totals.maxCombo, damageDealt: summary.totals.damageDealt, damageTaken: summary.totals.damageTaken, healing: summary.totals.healing,
    defeat: summary.defeat, bossEngagedTick: summary.milestones.bossEngagedTick,
    killsByRole: Object.fromEntries(summary.kills.byEnemyRole.filter((row) => row.count).map((row) => [row.enemyRoleId, row.count])),
    killsByWeapon: Object.fromEntries(summary.kills.byWeapon.filter((row) => row.count).map((row) => [row.weaponId, row.count])),
    grenades: summary.grenades,
    pickupsByEffect: Object.fromEntries(summary.collectibles.filter((row) => row.collected).map((row) => [row.effectId, row.collected])),
    visitedDistrictMask: summary.exploration.visitedDistrictMask,
    districts: DISTRICT_IDS.filter((_, i) => (summary.exploration.visitedDistrictMask >> i) & 1),
    sitesOperated: summary.milestones.sites.filter((row) => row.operated).map((row) => `${row.siteId}@${row.tick}`),
    secretsFound: summary.milestones.secrets.filter((row) => row.found).map((row) => `${row.secretId}@${row.tick}`),
    weaponPickups: Object.fromEntries(summary.weapons.filter((row) => row.pickups).map((row) => [row.weaponId, row.pickups])),
    weaponSwaps: summary.weapons.reduce((sum, row) => sum + row.swaps, 0),
  };
}

// How a run ended, from run-one.mjs's output.
export function endedByOf(out) {
  if (!out.runSummary) return `no-summary(${out.finalState})`;
  const surrenderedAt = out.pilotStats?.surrenderedAt;
  return surrenderedAt !== null && surrenderedAt !== undefined ? 'death-after-surrender' : 'death';
}

// Reads `<runsDir>/<label>.identity.json` and `.run.json`; null when either is missing.
export function readRun(runsDir, label) {
  const idFile = path.join(runsDir, `${label}.identity.json`);
  const runFile = path.join(runsDir, `${label}.run.json`);
  if (!existsSync(idFile) || !existsSync(runFile)) return null;
  return { id: JSON.parse(readFileSync(idFile, 'utf8')), out: JSON.parse(readFileSync(runFile, 'utf8')) };
}

// One run through the verifier: the record verifyAll writes for it.
export async function verifyRun(run, { id, out }) {
  const record = {
    label: run.label, style: run.style, entry: run.entry, heroId: run.heroId, tickCap: run.tickCap, seed: id.seed, salt: id.salt,
    finalTick: out.finalTick, endedBy: endedByOf(out),
    childErrors: out.errors.length, childErrorSamples: out.errors.slice(0, 3), crash: out.crash, invalidChildMessages: out.invalidChildMessages,
    wallMs: out.wallMs, pilotStats: out.pilotStats, upgrades: out.upgradeLog.map((entry) => entry.chosen),
  };
  const summary = out.runSummary;
  if (!summary) return record;
  record.schemaError = validateRunSummaryPayload(summary) || null;
  record.stats = summaryStats(summary);
  record.plausibility = validateRebootRunPlausibility(summary);
  record.margins = margins(summary);
  // Full §5.1 body: the ticket, the ticket seed, and a session envelope built
  // from the child's own run events.
  const evidence = createSessionEvidenceState({ sessionId: id.identity.sessionId });
  recordSessionInput(evidence, { step: 1, moveX: 0, aimX: 0, shoot: false });
  for (const event of out.runEvents.slice(0, 200)) recordSessionEvent(evidence, { step: event.tick, type: event.eventType, payload: { value: event.value } });
  const sessionEnvelope = plain(await finalizeSessionEvidence({
    identity: id.identity, evidence,
    finalState: { score: summary.totals.score, kills: summary.kills.total, level: summary.totals.level, elapsedMs: summary.totals.elapsedMs },
  }));
  const body = {
    v: RANKED_SETTLE_VERSION, gameId: GAME_ID, sessionId32: id.sessionId32, identity: id.identity, seedTicket: id.seedTicket, entryTxHash: null,
    evidence: { encoding: RANKED_GAMES[GAME_ID].evidenceEncoding, runSummary: summary, sessionEnvelope },
    claim: { score: summary.totals.score },
  };
  const nowMs = FIXTURE_ISSUED_AT * 1000 + Math.ceil(summary.totals.elapsedMs) + 120_000;
  const verified = await verifyRankedRun(body, { chainId: FIXTURE_CHAIN_ID, scoreRegistryAddress: FIXTURE_REGISTRY, wallet: FIXTURE_WALLET, nowMs, seedSecret: FIXTURE_SEED_SECRET });
  record.verifyRankedRun = verified.ok
    ? { ok: true, score: verified.score, verdict: verified.plausibility?.verdict, flags: verified.plausibility?.flags ?? [] }
    : { ok: false, status: verified.status, error: verified.error, detail: verified.detail ?? null, flags: verified.flags ?? [] };
  return record;
}

// Every plan row present in runsDir → its record; absent rows → { label, missing }.
export async function verifyAll(plan, runsDir) {
  const results = [];
  for (const run of plan) {
    const files = readRun(runsDir, run.label);
    results.push(files ? await verifyRun(run, files) : { label: run.label, missing: true });
  }
  return results;
}
