// Run summary v7 end to end, as far as this branch goes
// (docs/hmh-reboot/design/HMH-RUN-SUMMARY-V7-CONTRACT.md §12, §13, §15): the
// committed v7 fixtures bind to their seed tickets, pass the schema and the v7
// plausibility rules, travel over hmh-bridge/v1 once the bridge validates with
// sdk/hmh-run-summary-schema-v7.mjs, and are still refused by the Ranked gate
// in server/verify/hmh.mjs until the integration owner changes it (§15, §16).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindRankedIdentity, computeEvidenceDigest, verifyRankedRun } from '../server/verify/index.mjs';
import { HMH_EVIDENCE_ENCODING } from '../server/verify/hmh.mjs';
import { validateRebootRunPlausibility } from '../server/verify/hmh-plausibility.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { HMH_BRIDGE_PROTOCOL, HMH_MAX_MESSAGE_BYTES, createBridgeEnvelope, validateChildMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { FIXTURE_NAMES, HMH_V7_FIXTURE_NAMES, buildFixture, fixtureVerifyOptions, readFixture } from './fixtures/ranked/build-fixtures.mjs';
import { createInitialArcadeState, recordScore, startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { catalogFor, deriveEarnedAchievements, emptyHistory, historyFieldsFor } from '../apps/portal/src/achievements/index.mjs';
import { statAt } from '../apps/portal/src/achievements/entry.mjs';
import { hmhRecordScoreInputsFromRunSummary, hmhResolverInputsFromRunSummary, statsFromHmhRunSummary } from '../apps/portal/src/achievements/stats.mjs';

const fixtures = Object.fromEntries(HMH_V7_FIXTURE_NAMES.map((name) => [name, readFixture(name)]));

test('the v7 fixtures are listed apart from the end-to-end fixtures', () => {
  assert.deepEqual(HMH_V7_FIXTURE_NAMES, ['hmh-v7-districts', 'hmh-v7-four-bosses']);
  assert.deepEqual(FIXTURE_NAMES, ['chikun-valid', 'chikun-10min', 'stacked-valid', 'stacked-15min', 'hmh-valid', 'hmh-realistic', 'hmh-level-90']);
});

test('the committed v7 fixtures rebuild from build-fixtures.mjs', async () => {
  for (const name of HMH_V7_FIXTURE_NAMES) assert.deepEqual(await buildFixture(name), fixtures[name], name);
});

test('v7 fixtures bind, pass the schema and the v7 rules, and keep the v6 evidence encoding', async () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    const { body, expected } = fixture;
    const summary = body.evidence.runSummary;
    const bound = await bindRankedIdentity(body, fixtureVerifyOptions());
    assert.equal(bound.ok, true, `${name}: ${JSON.stringify(bound)}`);
    assert.equal(summary.identity.seed, body.identity.seed);
    assert.equal(expected.seed, body.identity.seed);
    assert.deepEqual([summary.schemaVersion, summary.identity.mode, summary.identity.terminalReason, summary.identity.startTick], [7, 'ranked', 'defeated', 0], name);
    assert.equal(validateRunSummaryPayload(summary), '', name);
    assert.deepEqual(validateRebootRunPlausibility(summary), expected.plausibility, name);
    assert.notEqual(expected.plausibility.verdict, 'rejected', name);
    assert.equal(expected.score, summary.totals.score);
    assert.equal(body.claim.score, summary.totals.score);
    // The encoding, and so the runtimeId and the Neon constraint, is unchanged: the payload's schemaVersion selects the rules.
    assert.equal(body.evidence.encoding, HMH_EVIDENCE_ENCODING);
    assert.equal(HMH_EVIDENCE_ENCODING, 'hmh-run-summary-v6+json');
    const digest = await computeEvidenceDigest(body);
    assert.deepEqual([digest.ok, digest.digest, digest.bytes], [true, expected.evidenceDigest, expected.evidenceBytes], name);
  }
  const districts = fixtures['hmh-v7-districts'].body.evidence.runSummary;
  const fourBosses = fixtures['hmh-v7-four-bosses'].body.evidence.runSummary;
  // What each fixture exercises.
  assert.deepEqual(districts.bosses.map((row) => [row.bossId, row.initiations, row.defeatedTick > 0]), [['rug-pull-baron', 1, true], ['lockkeeper', 2, true], ['fifty-one-percent-foreman', 0, false], ['liquidator', 0, false]]);
  assert.equal(districts.kills.boss, 0, 'district bosses are not the boss');
  assert.equal(districts.objectives.filter((row) => row.completed).length, 24);
  assert.equal(districts.progression.sealsBanked, 2);
  assert.deepEqual(fourBosses.bosses.map((row) => row.defeatedTick > 0), [true, true, true, true]);
  assert.equal(fourBosses.kills.boss, 1);
  assert.equal(fourBosses.milestones.bossEngagedTick, fourBosses.bosses[3].firstInitiatedTick);
  assert.equal(fourBosses.objectives.filter((row) => row.completed).length, 25);
  assert.equal(fourBosses.prisoners.filter((row) => row.rescued).length, 8);
  assert.deepEqual(fourBosses.progression, { offersOpened: fourBosses.progression.offersOpened, evolutionOffersOpened: 1, rerolls: fourBosses.progression.rerolls, sealsFound: 4, sealsBanked: 3, evolutionsApplied: 1, revivesUsed: 1 });
  assert.ok(fourBosses.progression.rerolls > 0 && districts.progression.rerolls > 0);
  assert.deepEqual(fourBosses.evolutions.filter((row) => row.applied).map((row) => row.evolutionId), ['settler-rail']);
});

test('a Ranked schema-7 body is refused before plausibility until server/verify/hmh.mjs accepts schema 7', async () => {
  // Fail-closed (contract §15, §16): hmh.mjs validates with the base schema
  // module, which accepts schema 1-6, and then requires schema 6. Opening the
  // gate is outside this branch: import validateRunSummaryPayload from
  // sdk/hmh-run-summary-schema-v7.mjs there and accept schemaVersion 6 or 7.
  for (const [name, { body }] of Object.entries(fixtures)) {
    assert.deepEqual(await verifyRankedRun(body, fixtureVerifyOptions()), { ok: false, status: 400, error: 'run-summary-invalid', detail: 'game:run-summary schemaVersion is invalid' }, name);
  }
});

test('v7 fixtures fit hmh-bridge/v1 as game:run-summary messages', () => {
  for (const [name, { body }] of Object.entries(fixtures)) {
    const message = createBridgeEnvelope({ type: 'game:run-summary', sessionId: 'session:hmh-v7-fixture', messageId: 'run-summary-1', payload: body.evidence.runSummary });
    assert.equal(message.protocol, HMH_BRIDGE_PROTOCOL);
    assert.equal(HMH_BRIDGE_PROTOCOL, 'hmh-bridge/v1');
    assert.ok(new TextEncoder().encode(JSON.stringify(message)).byteLength < HMH_MAX_MESSAGE_BYTES / 2, name);
    // The 1.8.x bridge validates with the base schema module, so it refuses
    // schema 7 today; its envelope checks pass, and with the v7 module's
    // validator (what the child branch switches the bridge to) the whole
    // message validates.
    assert.deepEqual(validateChildMessage(message), { ok: false, error: 'game:run-summary schemaVersion is invalid' }, name);
    assert.equal(validateRunSummaryPayload(message.payload), '', name);
    assert.equal(validateChildMessage({ ...message, payload: { ...message.payload, schemaVersion: 6 } }).error, 'game:run-summary payload must contain exact fields', `${name}: only the payload schema stops it`);
  }
});

// ---------------------------------------------------------------------------
// Stats and achievements (contract §10). bossKills is kills.boss, which schema 7
// pins to the Liquidator, so the boss achievements mean the Liquidator on the
// device (arcade-core recordScore) and on the server (catalog derivation) alike.
const WALLET = `0x${'cd'.repeat(20)}`;
const HMH_STATS_KEYS = ['score', 'kills', 'bossKills', 'eliteKills', 'maxCombo', 'level', 'xp', 'survivalTicks', 'elapsedMs', 'survivalSeconds',
  'damageTaken', 'damageDealt', 'healing', 'litecoin', 'grenadeKills', 'meleeKills', 'weaponsUsed', 'uniqueWeaponCount', 'powerUpsCollected',
  'uniquePowerUps', 'districtsVisited', 'poisDiscovered', 'revealedPermille', 'killsByRole', 'familyKills', 'noDamage', 'perfectBossKill',
  'bossEngaged', 'heroId', 'terminalReason'];
const districts = fixtures['hmh-v7-districts'].body.evidence.runSummary;
const fourBosses = fixtures['hmh-v7-four-bosses'].body.evidence.runSummary;
const row = (rows, key, id) => rows.find((entry) => entry[key] === id);
// The districts run without the Lockkeeper: the Baron is its only boss kill.
const baronOnly = structuredClone(districts);
Object.assign(row(baronOnly.bosses, 'bossId', 'lockkeeper'), { initiations: 0, firstInitiatedTick: 0, lastInitiatedTick: 0, defeatedTick: 0 });
row(baronOnly.kills.byEnemyRole, 'enemyRoleId', 'lockkeeper').count = 0;
baronOnly.kills.total -= 1;
row(baronOnly.kills.byWeapon, 'weaponId', 'hash-rail').count -= 1;
row(baronOnly.weapons, 'weaponId', 'hash-rail').kills -= 1;
Object.assign(baronOnly.progression, { sealsFound: 1, sealsBanked: 1 });
row(baronOnly.collectibles, 'effectId', 'genesis-seal').collected = 1;

const BOSS_IDS = ['beat-level-1-boss', 'boss-breaker', 'getaway-clear'];
const PARITY_EXEMPT = new Set([...catalogFor('lester-blaster').filter((entry) => !entry.available).map((entry) => entry.id), 'cabinet-pioneer']);
const comparable = (list) => list.filter((id) => !PARITY_EXEMPT.has(id)).sort();
function browserProfile() {
  const state = createInitialArcadeState();
  return (summary) => {
    const { score, runStats } = hmhRecordScoreInputsFromRunSummary(summary);
    return recordScore(state, startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid' }), score, runStats).unlockedAchievements;
  };
}
function serverProfile() {
  let prior = emptyHistory(WALLET, 'lester-blaster');
  return (summary) => {
    const stats = statsFromHmhRunSummary(summary);
    const earned = deriveEarnedAchievements('lester-blaster', { gameId: 'lester-blaster', wallet: WALLET, score: stats.score, stats }, prior).map((entry) => entry.id);
    const { sum, max } = historyFieldsFor('lester-blaster');
    prior = {
      ...prior,
      runs: prior.runs + 1,
      sums: Object.fromEntries(sum.map((path) => [path, prior.sums[path] + statAt(stats, path)])),
      maxima: Object.fromEntries(max.map((path) => [path, Math.max(prior.maxima[path], statAt(stats, path))])),
      unlockedIds: [...prior.unlockedIds, ...earned],
    };
    return earned;
  };
}

test('schema-7 stats: the contract keys, 16 roles, the Liquidator as the boss, no Genesis Seal power-up', () => {
  assert.equal(validateRunSummaryPayload(baronOnly), '', 'the Baron-only run is a valid schema-7 summary');
  for (const [name, summary] of [['districts', districts], ['four bosses', fourBosses], ['baron only', baronOnly]]) {
    const stats = statsFromHmhRunSummary(summary);
    assert.deepEqual(Object.keys(stats), HMH_STATS_KEYS, name);
    assert.equal(Object.keys(stats.killsByRole).length, 16, name);
    assert.deepEqual(Object.keys(stats.familyKills), ['goblin', 'drone', 'gasBeast', 'enforcer'], name);
    assert.ok(!stats.uniquePowerUps.includes('genesis-seal'), name);
    assert.ok(Object.values(stats).every((value) => typeof value !== 'number' || Number.isFinite(value)), name);
  }
  const districtStats = statsFromHmhRunSummary(districts);
  assert.deepEqual([districtStats.bossKills, districtStats.bossEngaged, districtStats.perfectBossKill, districtStats.districtsVisited], [0, 0, 0, 6]);
  assert.deepEqual([districtStats.killsByRole['rug-pull-baron'], districtStats.killsByRole.lockkeeper], [1, 1], 'district boss kills stay in killsByRole');
  assert.equal(hmhResolverInputsFromRunSummary(districts).bossId, null);
  const fourBossStats = statsFromHmhRunSummary(fourBosses);
  assert.deepEqual([fourBossStats.bossKills, fourBossStats.bossEngaged], [1, 1]);
  assert.equal(hmhResolverInputsFromRunSummary(fourBosses).bossId, 'boss-liquidator');
  // A Genesis Seal pickup is not a power-up pickup.
  const sealsOnly = structuredClone(fourBosses);
  row(sealsOnly.collectibles, 'effectId', 'genesis-seal').collected += 10;
  assert.equal(statsFromHmhRunSummary(sealsOnly).powerUpsCollected, fourBossStats.powerUpsCollected);
});

test('schema 7: district bosses unlock no boss achievement, on the device or the server; the Liquidator unlocks them on both', () => {
  for (const [name, summary, expected] of [['baron only', baronOnly, false], ['districts', districts, false], ['four bosses', fourBosses, true]]) {
    const local = browserProfile()(summary);
    const remote = serverProfile()(summary);
    assert.deepEqual(comparable(local), comparable(remote), `${name}: the same ids`);
    for (const id of BOSS_IDS) {
      assert.equal(local.includes(id), expected, `${name}: ${id} on the device`);
      assert.equal(remote.includes(id), expected, `${name}: ${id} on the server`);
    }
  }
  // All six districts visited without the Liquidator is not a Getaway Clear.
  assert.equal(statsFromHmhRunSummary(districts).districtsVisited, 6);
  // Run by run, district bosses never add to Boss Rush Ten; ten Liquidator runs do, on both sides.
  for (const [summary, unlocksAt] of [[districts, null], [baronOnly, null], [fourBosses, 9]]) {
    const browser = browserProfile();
    const server = serverProfile();
    for (let run = 0; run < 10; run += 1) {
      const local = browser(summary);
      const remote = server(summary);
      assert.deepEqual(comparable(local), comparable(remote), `run ${run + 1}`);
      assert.equal(remote.includes('boss-rush-ten'), run === unlocksAt, `boss-rush-ten at run ${run + 1}`);
    }
  }
});
