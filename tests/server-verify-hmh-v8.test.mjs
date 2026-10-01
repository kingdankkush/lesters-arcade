// Ranked verification of run summary schema 8 (the ten-area Level 1 of game
// 2.1.0; docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md): the map context, the
// schema and build gates, every v8 reject on forged summaries built from real
// honest ten-area runs, the boss result, and the HMH achievements on schema-8
// rows. The real runs are the committed ten-area corpus
// (tests/server-verify-hmh-v8-corpus.test.mjs pins it).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { HMH_BOSS_ID, hmhBossResult, hmhRankedSchemaError, verifyHmhRun } from '../server/verify/hmh.mjs';
import { resolveHmhMapContext } from '../server/verify/hmh-map-context.mjs';
import { HMH_V8_REJECTS, hmhV8DistrictTravel, hmhV8MinTicksForTravel, validateV8RunPlausibility } from '../server/verify/hmh-plausibility-v8.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V8 as C8, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v8.mjs';
import { HMH_V8_TRAVEL } from '../sdk/hmh-run-contract-v8.mjs';
import { RANKED_GAMES } from '../apps/portal/src/ranked-identity.mjs';
import { createInitialArcadeState, recordScore, startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { deriveEarnedAchievements, emptyHistory, pendingReviewAchievements } from '../apps/portal/src/achievements/index.mjs';
import { achievementById } from '../apps/portal/src/achievements/index.mjs';
import { HMH_BOSS_ROLE_IDS } from '../apps/portal/src/achievements/hmh.mjs';
import { hmhRecordScoreInputsFromRunSummary, statsFromHmhRunSummary } from '../apps/portal/src/achievements/stats.mjs';
import { FIXTURE_WALLET } from './fixtures/ranked/build-fixtures.mjs';
import { rankedBodyFor, readV8Corpus } from './fixtures/ranked/hmh-v8-bodies.mjs';

const corpus = readV8Corpus();
const BUILD = corpus.child.buildHash;
const clone = (value) => structuredClone(value);
const row = (list, key, id) => list.find((entry) => entry[key] === id);
const ids = (verdict) => verdict.flags.filter((flag) => flag.severity === 'reject').map((flag) => flag.id);
const bit = (id) => 2 ** C8.districts.indexOf(id);
const mostAreas = corpus.runs.reduce((best, run) => (!best || bitsOf(run) > bitsOf(best) ? run : best), null);
function bitsOf(run) { let n = 0; for (let m = run.runSummary.exploration.visitedDistrictMask; m > 0; m = Math.floor(m / 2)) n += m % 2; return n; }
const baronRun = corpus.runs.find((run) => row(run.runSummary.bosses, 'bossId', 'rug-pull-baron').defeatedTick > 0);

test('schema 8 resolves the ten-area v2 context only from a 2.1.0 build, and the gate precedes plausibility', async () => {
  const identity = (buildHash) => ({ gameId: 'lester-blaster', buildHash });
  assert.equal(resolveHmhMapContext({ identity: identity(BUILD), schemaVersion: 8 }).validatePlausibility, validateV8RunPlausibility);
  for (const buildHash of ['site-2.0.0:game-2.0.0:cabinet-0.6.0', 'site-1.9.0:game-1.9.0', 'site-1.8.4:game-1.8.4']) {
    assert.equal(resolveHmhMapContext({ identity: identity(buildHash), schemaVersion: 8 }), null, buildHash);
  }
  const summary = mostAreas.runSummary;
  assert.equal(hmhRankedSchemaError(summary), '');
  assert.equal(hmhRankedSchemaError({ ...summary, identity: { ...summary.identity, buildHash: 'site-2.0.0:game-2.0.0:cabinet-0.6.0' } }), 'run summary schema 8 requires game 2.1.0 or later');
  assert.equal(hmhRankedSchemaError({ ...summary, schemaVersion: 9 }), 'Ranked requires run summary schema 6, 7 or 8');
  // A v8 summary labelled with an older game: refused before plausibility.
  const { body, options } = await rankedBodyFor(mostAreas);
  assert.equal((await verifyRankedRun(body, options)).ok, true);
  const old = clone(summary);
  old.identity.buildHash = 'site-2.0.0:game-2.0.0:cabinet-0.6.0';
  assert.deepEqual(validateV8RunPlausibility(old).flags.find((flag) => flag.id === 'build-predates-schema-8'), { id: 'build-predates-schema-8', severity: 'reject', value: '2.0.0', limit: '2.1.0' });
  const evidence = { encoding: RANKED_GAMES['lester-blaster'].evidenceEncoding, runSummary: old, sessionEnvelope: body.evidence.sessionEnvelope };
  assert.deepEqual(await verifyHmhRun({ identity: { ...body.identity, buildHash: old.identity.buildHash }, evidence, nowMs: options.nowMs }), { ok: false, status: 400, error: 'run-summary-invalid', detail: 'run summary schema 8 requires game 2.1.0 or later' });
});

test('district teleport: a visited set the travel graph cannot connect from the Meadows is refused', () => {
  const summary = clone(mostAreas.runSummary);
  for (const [mask, why] of [
    [bit('mweb-meadows') + bit('scrypt-bayou'), 'the Bayou is reached only through the Coast or the River'],
    [bit('mweb-meadows') + bit('silver-coast'), 'the Coast is reached only through the City or the Bayou'],
    [bit('mweb-meadows') + bit('ledger-ridge'), 'the Ridge is reached only through the City or the Fortress'],
    [bit('litecoin-city'), 'a run always starts in the Meadows'],
    [2 ** C8.districts.length, 'an eleventh area'],
  ]) {
    summary.exploration.visitedDistrictMask = mask;
    const verdict = validateV8RunPlausibility(summary);
    assert.ok(ids(verdict).includes('district-path-invalid'), why);
  }
  // Every edge is one step of a connected path from the Meadows.
  for (const [a, b] of HMH_V8_TRAVEL.edges) {
    const via = [a, b].includes('mweb-meadows') ? [] : ['mweb-meadows'];
    const path = hmhV8DistrictTravel([a, b, ...via].reduce((sum, id) => sum + bit(id), 0));
    if ([a, b].includes('mweb-meadows')) assert.equal(path.pathValid, true, `${a} - ${b}`);
  }
  assert.equal(hmhV8DistrictTravel(0).pathValid, true, 'a run with no recorded tick');
});

test('impossible travel: more areas than the run had ticks to reach is refused', () => {
  const all = (2 ** C8.districts.length) - 1;
  const travel = hmhV8DistrictTravel(all);
  assert.equal(travel.pathValid, true);
  const minimum = hmhV8MinTicksForTravel(travel.travelPx);
  assert.ok(minimum > 300, `all ten areas need ${minimum} ticks`);
  const summary = clone(mostAreas.runSummary);
  summary.exploration.visitedDistrictMask = all;
  summary.identity.endTick = minimum - 1;
  summary.totals.survivalTicks = minimum - 1;
  summary.totals.elapsedMs = (minimum - 1) * (1000 / 60);
  assert.ok(ids(validateV8RunPlausibility(summary)).includes('districts-before-travel-time'));
  // The honest run that saw the most areas clears its bound by a wide margin.
  const honest = hmhV8DistrictTravel(mostAreas.runSummary.exploration.visitedDistrictMask);
  assert.ok(mostAreas.runSummary.totals.survivalTicks > 10 * hmhV8MinTicksForTravel(honest.travelPx));
});

test('kills of a role no visited area, opening enemy or started boss can spawn are refused', () => {
  // The forge: relabel a Meadows-only run's Bagholder kills as Tollkeepers
  // (threat 6 for 2), which spawn only in the River and the Fortress.
  const meadowsOnly = corpus.runs.find((run) => run.runSummary.exploration.visitedDistrictMask === bit('mweb-meadows') && run.runSummary.kills.total > 20);
  assert.ok(meadowsOnly);
  assert.notEqual(validateV8RunPlausibility(meadowsOnly.runSummary).verdict, 'rejected');
  const forged = clone(meadowsOnly.runSummary);
  const rushers = row(forged.kills.byEnemyRole, 'enemyRoleId', 'bagholder-rusher');
  row(forged.kills.byEnemyRole, 'enemyRoleId', 'tollkeeper').count += rushers.count;
  const moved = rushers.count;
  rushers.count = 0;
  assert.equal(validateRunSummaryPayload(forged), '');
  assert.deepEqual(validateV8RunPlausibility(forged).flags.find((flag) => flag.id === 'enemy-role-not-in-visited-areas'), { id: 'enemy-role-not-in-visited-areas', severity: 'reject', value: moved, limit: 0 });
  // Claiming the River makes Tollkeepers possible (that forgery then needs
  // the River's travel, which this run's ticks easily cover).
  const river = clone(forged);
  river.exploration.visitedDistrictMask += bit('hashwood-river');
  assert.ok(!ids(validateV8RunPlausibility(river)).includes('enemy-role-not-in-visited-areas'));
  // Liquidator Agents in a Meadows-only run need the Liquidator's adds.
  const agents = clone(meadowsOnly.runSummary);
  row(agents.kills.byEnemyRole, 'enemyRoleId', 'bagholder-rusher').count -= 1;
  row(agents.kills.byEnemyRole, 'enemyRoleId', 'liquidator-agent').count += 1;
  assert.ok(ids(validateV8RunPlausibility(agents)).includes('enemy-role-not-in-visited-areas'));
  // Every honest run passes it.
  for (const run of corpus.runs) assert.ok(!ids(validateV8RunPlausibility(run.runSummary)).includes('enemy-role-not-in-visited-areas'), run.label);
});

test('a boss killed without visiting its court’s area is refused', () => {
  assert.ok(baronRun, 'the corpus holds an honest Rug Pull Baron defeat');
  const summary = clone(baronRun.runSummary);
  assert.equal(validateV8RunPlausibility(summary).verdict === 'rejected', false);
  summary.exploration.visitedDistrictMask -= bit('hashwood-river');
  assert.ok(ids(validateV8RunPlausibility(summary)).includes('node-in-unvisited-district'));
  // A Foreman kill claimed on the Baron run, without the Fortress: the schema
  // needs the row, and the row needs the area (and his ready tick).
  const foreman = clone(baronRun.runSummary);
  row(foreman.kills.byEnemyRole, 'enemyRoleId', 'fifty-one-percent-foreman').count += 1;
  assert.match(validateRunSummaryPayload(foreman), /boss kills do not match the bosses rows|kill totals are inconsistent/);
  const end = foreman.identity.endTick;
  Object.assign(row(foreman.bosses, 'bossId', 'fifty-one-percent-foreman'), { initiations: 1, firstInitiatedTick: end - 400, lastInitiatedTick: end - 400, defeatedTick: end - 1 });
  foreman.kills.total += 1;
  row(foreman.kills.byWeapon, 'weaponId', 'coin-blaster').count += 1;
  row(foreman.weapons, 'weaponId', 'coin-blaster').kills += 1;
  assert.equal(validateRunSummaryPayload(foreman), '');
  const rejects = ids(validateV8RunPlausibility(foreman));
  assert.ok(rejects.includes('node-in-unvisited-district'));
  assert.ok(rejects.includes('boss-before-ready'));
});

test('boss timing: a fight shorter than the intro and halts, a start before the ready tick, and a revive are refused', () => {
  const short = clone(baronRun.runSummary);
  const baron = row(short.bosses, 'bossId', 'rug-pull-baron');
  baron.defeatedTick = baron.lastInitiatedTick + 120;
  assert.deepEqual(validateV8RunPlausibility(short).flags.find((flag) => flag.id === 'boss-fight-too-short'), { id: 'boss-fight-too-short', severity: 'reject', value: 120, limit: 300 });
  const early = clone(baronRun.runSummary);
  const row2 = row(early.bosses, 'bossId', 'rug-pull-baron');
  row2.firstInitiatedTick = row2.lastInitiatedTick = 7_199;
  assert.ok(ids(validateV8RunPlausibility(early)).includes('boss-before-ready'));
  const revive = clone(baronRun.runSummary);
  revive.progression.revivesUsed = 1;
  assert.equal(validateRunSummaryPayload(revive), 'game:run-summary the revive has no Golden Parachute');
});

test('unknown or missing roles are schema errors, and verification stops there', async () => {
  const unknown = clone(mostAreas.runSummary);
  unknown.kills.byEnemyRole[0].enemyRoleId = 'mystery-raider';
  assert.match(validateRunSummaryPayload(unknown), /byEnemyRole\[0\] id is invalid/);
  const extra = clone(mostAreas.runSummary);
  extra.kills.byEnemyRole.push({ enemyRoleId: 'mystery-raider', count: 1 });
  assert.match(validateRunSummaryPayload(extra), /byEnemyRole rows are invalid/);
  const missing = clone(mostAreas.runSummary);
  missing.kills.byEnemyRole = missing.kills.byEnemyRole.filter((entry) => entry.enemyRoleId !== 'rug-puller');
  assert.match(validateRunSummaryPayload(missing), /byEnemyRole rows are invalid/);
  const { body, options } = await rankedBodyFor(mostAreas, unknown);
  const verified = await verifyRankedRun(body, options);
  assert.equal(verified.ok, false);
  assert.equal(verified.error, 'run-summary-invalid');
  // Legacy-map catalogues are not schema 8's: a schema-7 district or objective id is unknown here.
  const legacyIds = clone(mostAreas.runSummary);
  legacyIds.objectives[0].objectiveId = 'relay-power';
  assert.match(validateRunSummaryPayload(legacyIds), /objectives\[0\] id is invalid/);
});

test('an inflated score or XP is refused at its ceiling; the honest run is not', async () => {
  const honest = await rankedBodyFor(mostAreas);
  const ok = await verifyRankedRun(honest.body, honest.options);
  assert.equal(ok.ok, true);
  const inflated = clone(mostAreas.runSummary);
  inflated.totals.score *= 10;
  const verdict = validateV8RunPlausibility(inflated);
  assert.ok(ids(verdict).includes('score-above-ceiling'));
  const { body, options } = await rankedBodyFor(mostAreas, inflated);
  const refused = await verifyRankedRun(body, options);
  assert.equal(refused.ok, false);
  assert.equal(refused.error, 'implausible-run');
  assert.ok(refused.flags.some((flag) => flag.id === 'score-above-ceiling'));
  const xp = clone(mostAreas.runSummary);
  xp.totals.xp *= 20;
  assert.ok(ids(validateV8RunPlausibility(xp)).some((id) => id === 'xp-above-ceiling' || id === 'level-xp-mismatch'));
});

test('the movement row: a foreign rules version, cover kills with no cover, too many enters and a short mantle are refused', () => {
  const base = mostAreas.runSummary;
  const forge = (patch) => { const summary = clone(base); Object.assign(summary.movement, patch); return summary; };
  const cases = [
    [{ rulesVersion: 'cover-v2+traversal-v1' }, 'movement-rules-mismatch'],
    [{ coverTicks: 0, coverEnters: 0, coverLeaves: 0, coverKills: 1 }, 'cover-without-cover-ticks'],
    [{ coverTicks: 0, coverEnters: 0, coverLeaves: 0, coverDamageReduced: 40 }, 'cover-without-cover-ticks'],
    [{ coverTicks: base.totals.survivalTicks, coverEnters: base.totals.survivalTicks, coverLeaves: 0 }, 'cover-enters-above-cadence'],
    [{ mantles: 3, mantleTicks: 18 }, 'mantle-ticks-mismatch'],
    [{ mantles: 1, mantleTicks: 19 }, 'mantle-ticks-mismatch'],
    [{ drops: 4, landTicks: 6 }, 'land-ticks-below-drops'],
  ];
  for (const [patch, id] of cases) {
    const summary = forge(patch);
    assert.equal(validateRunSummaryPayload(summary), '', JSON.stringify(patch));
    assert.ok(ids(validateV8RunPlausibility(summary)).includes(id), `${JSON.stringify(patch)} -> ${id}`);
  }
  // The schema's own identities: an enter is a cover tick, a leave follows an enter.
  assert.match(validateRunSummaryPayload(forge({ coverEnters: 2, coverTicks: 1 })), /movement totals are inconsistent/);
  assert.match(validateRunSummaryPayload(forge({ coverLeaves: base.movement.coverEnters + 1 })), /movement totals are inconsistent/);
  assert.match(validateRunSummaryPayload(forge({ coverKills: base.kills.total + 1, coverTicks: Math.max(1, base.movement.coverTicks) })), /movement totals are inconsistent/);
  const noRow = clone(base);
  delete noRow.movement;
  assert.match(validateRunSummaryPayload(noRow), /payload must contain exact fields/);
  // Every v8 reject has an id in the published list.
  assert.ok(cases.every(([, id]) => HMH_V8_REJECTS.includes(id)));
});

test('the boss result keeps the on-chain id the Liquidator’s and names every boss a run defeated', async () => {
  assert.deepEqual(hmhBossResult(baronRun.runSummary), { bossId: null, bossesDefeated: ['rug-pull-baron'] });
  const { body, options } = await rankedBodyFor(baronRun);
  const verified = await verifyRankedRun(body, options);
  assert.equal(verified.ok, true);
  assert.equal(verified.contract.bossId, null, 'a district boss has no on-chain boss id');
  const legacyLiquidator = JSON.parse(readFileSync(new URL('./fixtures/ranked/hmh-v7-liquidator.json', import.meta.url), 'utf8')).body.evidence.runSummary;
  assert.equal(hmhBossResult(legacyLiquidator).bossId, legacyLiquidator.kills.boss > 0 ? HMH_BOSS_ID : null);
  const legacy6 = JSON.parse(readFileSync(new URL('./fixtures/ranked/hmh-level-90.json', import.meta.url), 'utf8')).body.evidence.runSummary;
  assert.deepEqual(hmhBossResult(legacy6), { bossId: HMH_BOSS_ID, bossesDefeated: ['liquidator'] });
});

// A schema-8 run that defeated all four bosses, from an honest run: its
// summary is schema-valid (the plausibility of its timing is not the point).
function fourBossSummary() {
  const summary = clone(baronRun.runSummary);
  const end = 60_000;
  summary.identity.endTick = end;
  summary.totals.survivalTicks = end;
  summary.totals.elapsedMs = end * (1000 / 60);
  let tick = 37_000;
  for (const bossId of C8.bosses) {
    const boss = row(summary.bosses, 'bossId', bossId);
    if (boss.defeatedTick > 0) continue;
    Object.assign(boss, { initiations: 1, firstInitiatedTick: tick, lastInitiatedTick: tick, defeatedTick: tick + 400 });
    row(summary.kills.byEnemyRole, 'enemyRoleId', bossId).count += 1;
    summary.kills.total += 1;
    row(summary.kills.byWeapon, 'weaponId', 'coin-blaster').count += 1;
    row(summary.weapons, 'weaponId', 'coin-blaster').kills += 1;
    tick += 3_000;
  }
  summary.kills.boss = row(summary.kills.byEnemyRole, 'enemyRoleId', 'liquidator').count;
  summary.milestones.bossEngagedTick = row(summary.bosses, 'bossId', 'liquidator').firstInitiatedTick;
  summary.exploration.visitedDistrictMask = (2 ** C8.districts.length) - 1;
  return summary;
}

test('achievements read schema-8 rows: boss kills, enemy roles and areas; Full Roster Run needs all four bosses', () => {
  const four = fourBossSummary();
  assert.equal(validateRunSummaryPayload(four), '');
  const stats = statsFromHmhRunSummary(four);
  assert.equal(Object.keys(stats.killsByRole).length, C8.enemyRoles.length);
  for (const bossId of HMH_BOSS_ROLE_IDS) assert.equal(stats.killsByRole[bossId], 1, bossId);
  assert.equal(stats.bossKills, 1, 'bossKills is the Liquidator, as on schema 6 and 7');
  assert.equal(stats.districtsVisited, 10);
  assert.ok(stats.killsByRole['rug-puller'] + stats.killsByRole['hodl-revenant'] > 0, 'the 2.0 enemies reach killsByRole');
  const earned = (summary) => deriveEarnedAchievements('lester-blaster', { gameId: 'lester-blaster', wallet: FIXTURE_WALLET, score: summary.totals.score, stats: statsFromHmhRunSummary(summary) }, emptyHistory(FIXTURE_WALLET, 'lester-blaster')).map((entry) => entry.id);
  // Full Roster Run criteria are met, but it is always held for review (verifier review hardening).
  assert.ok(!earned(four).includes('full-roster-run'));
  const pendingIds = pendingReviewAchievements('lester-blaster', { gameId: 'lester-blaster', wallet: FIXTURE_WALLET, score: four.totals.score, stats: statsFromHmhRunSummary(four) }, emptyHistory(FIXTURE_WALLET, 'lester-blaster')).map((entry) => entry.id);
  assert.deepEqual(pendingIds, ['full-roster-run']);
  assert.ok(earned(four).includes('beat-level-1-boss'));
  assert.ok(earned(four).includes('getaway-clear'), 'six or more Level 1 areas and the Liquidator');
  const baronOnly = earned(baronRun.runSummary);
  assert.ok(!baronOnly.includes('full-roster-run'));
  assert.ok(!baronOnly.includes('beat-level-1-boss'), 'a district boss is not the Level 1 boss');
  // The device-local resolver reads the same schema-8 summary.
  const { score, runStats } = hmhRecordScoreInputsFromRunSummary(four);
  const local = recordScore(createInitialArcadeState(), startPlaySession({ wallet: FIXTURE_WALLET, gameId: 'lester-blaster', mode: 'paid' }), score, runStats).unlockedAchievements;
  assert.ok(local.includes('beat-level-1-boss'));
  assert.ok(!local.includes('full-roster-run'), 'the 2.0 trophies stay server-derived');
});

test('World Escape stays unavailable: no schema has an escape state and every verified HMH run ends defeated', async () => {
  const escape = achievementById('lester-blaster', 'world-escape');
  assert.equal(escape.available, false);
  const four = fourBossSummary();
  const stats = statsFromHmhRunSummary(four);
  assert.ok(!Object.keys(stats).some((key) => /escape/i.test(key)));
  const earned = deriveEarnedAchievements('lester-blaster', { gameId: 'lester-blaster', wallet: FIXTURE_WALLET, score: four.totals.score, stats }, emptyHistory(FIXTURE_WALLET, 'lester-blaster')).map((entry) => entry.id);
  assert.ok(!earned.includes('world-escape'));
  // A 'completed' run (the only terminal that could stand for an escape) never verifies.
  const completed = clone(mostAreas.runSummary);
  completed.identity.terminalReason = 'completed';
  completed.defeat = { kind: 'none', causeId: 'none', tick: 0, damage: 0 };
  assert.equal(validateRunSummaryPayload(completed), '');
  const { body, options } = await rankedBodyFor(mostAreas, completed);
  const verified = await verifyRankedRun(body, options);
  assert.equal(verified.ok, false);
  assert.equal(verified.error, 'run-summary-not-terminal');
});
