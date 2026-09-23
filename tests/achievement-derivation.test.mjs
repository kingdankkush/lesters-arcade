import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';
import {
  ACHIEVEMENTS, ACHIEVEMENT_LIST, connectPlayerAccount, createInitialArcadeState, recordScore, resolveAchievementUnlocksForRun, startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';
import { buildChikunReplayClaim, replayChikunRun, simulateChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';
import { replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { FREE_MEDALS } from '../apps/stacked/src/free-medals.mjs';
import { HMH_RUN_SUMMARY_CATALOGS, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';
import {
  achievementById, achievementId32, catalogFor, deriveEarnedAchievements, emptyHistory, historyFieldsFor, nftAchievementIds,
} from '../apps/portal/src/achievements/index.mjs';
import { statAt } from '../apps/portal/src/achievements/entry.mjs';
import { HMH_DAMAGE_CHAIN_DAMAGE, HMH_DISTRICT_STAGES } from '../apps/portal/src/achievements/hmh.mjs';
import {
  hmhRecordScoreInputsFromRunSummary, hmhResolverInputsFromRunSummary, statsFromChikunResult, statsFromHmhRunSummary, statsFromStackedTuple,
} from '../apps/portal/src/achievements/stats.mjs';
import { HMH_PLANS, buildHmhSummary } from './fixtures/achievements/build-fixtures.mjs';

const read = (path) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'));
const CATALOG_DOC = readFileSync(fileURLToPath(new URL('../docs/game-design/achievement-catalogs-20260923.md', import.meta.url)), 'utf8');
const HMH = read('./fixtures/achievements/hmh-run-summary.json');
const CHIKUN = read('./fixtures/achievements/chikun-v6-result.json');
const STACKED = read('./fixtures/achievements/stacked-tuple.json');
const HARNESS = read('../docs/qa/chikun-difficulty-harness-20260923.json');
const SKIM = read('./fixtures/achievements/chikun-skim-calibration.json');
const STACKED_CALIBRATION = read('./fixtures/achievements/stacked-calibration.json');
const WALLET = '0x' + 'ab'.repeat(20);

const CHIKUN_KEYS = ['score', 'survivalTicks', 'survivalSeconds', 'coinsCollected', 'forksPassed', 'nearMisses', 'bestCombo', 'nearMissStreakBest', 'flawlessRegions', 'flapCount', 'distanceMeters', 'regionIndexReached', 'regionReached', 'laps', 'speedMultiplierReached', 'terminalReason', 'evidenceVersion'];
const STACKED_KEYS = ['score', 'lines', 'level', 'quadClears', 'spins', 'perfectClears', 'maxCombo', 'maxBackToBack', 'garbageRowsReceived', 'garbageRowsCleared', 'pieces', 'holdsUsed', 'ticks', 'survivalSeconds', 'zone', 'terminalReason', 'boardHash'];
const HMH_KEYS = ['score', 'kills', 'bossKills', 'eliteKills', 'maxCombo', 'level', 'xp', 'survivalTicks', 'elapsedMs', 'survivalSeconds', 'damageTaken', 'damageDealt', 'healing', 'litecoin', 'grenadeKills', 'meleeKills', 'weaponsUsed', 'uniqueWeaponCount', 'powerUpsCollected', 'uniquePowerUps', 'districtsVisited', 'poisDiscovered', 'revealedPermille', 'killsByRole', 'familyKills', 'noDamage', 'perfectBossKill', 'bossEngaged', 'heroId', 'terminalReason'];
const RESOLVER_KEYS = ['enemyKillsByType', 'stageIndexReached', 'grenadeKills', 'meleeKills', 'bossId', 'noDamage', 'maxCombo', 'weaponIds', 'collectedPowerUps'];

const run = (gameId, stats) => ({ gameId, wallet: WALLET, score: stats.score ?? 0, stats });
const ids = (entries) => entries.map((entry) => entry.id);
const hmhRun = (name) => run('lester-blaster', statsFromHmhRunSummary(HMH.runs[name]));
const chikunRun = (name) => run('chikun', statsFromChikunResult(CHIKUN.runs[name].result));
const stackedRun = () => run('stacked', statsFromStackedTuple(STACKED.tuple));
const history = (gameId, overrides = {}) => ({ ...emptyHistory(WALLET, gameId), ...overrides });
const numbersOnly = (stats) => Object.values(stats).every((value) => typeof value !== 'number' || Number.isFinite(value));

test('stats mappers produce the contract shapes from real runs', () => {
  // Chikun: the real v6 evidence replays to the stored result, which maps to the §6.3 shape.
  for (const [name, fixture] of Object.entries(CHIKUN.runs)) {
    const replayed = replayChikunRun(fixture.evidence);
    assert.deepEqual(JSON.parse(JSON.stringify(replayed)), fixture.result, `${name} replays to its stored result`);
    const stats = statsFromChikunResult(replayed);
    assert.deepEqual(Object.keys(stats), CHIKUN_KEYS, name);
    assert.ok(numbersOnly(stats), name);
    assert.equal(stats.evidenceVersion, 'chikun-flap-evidence-v6');
    assert.equal(stats.survivalSeconds, Number((replayed.survivalTicks / 60).toFixed(3)));
    assert.equal(stats.distanceMeters, Math.floor(replayed.distancePixels / 10));
    assert.equal(stats.terminalReason, replayed.finalState.terminalReason);
    assert.equal(stats.flapCount, fixture.evidence.flapDeltas.length);
  }
  const skim = statsFromChikunResult(CHIKUN.runs['expert-skim'].result);
  assert.notEqual(skim.bestCombo, skim.forksPassed, 'v6 bestCombo is not forksPassed');
  assert.ok(skim.nearMissStreakBest >= 7 && skim.nearMisses >= 30);
  const hardcore = statsFromChikunResult(CHIKUN.runs.hardcore.result);
  assert.equal(hardcore.laps, 2);
  assert.equal(hardcore.regionReached, 'forest');
  assert.throws(() => statsFromChikunResult({ ...CHIKUN.runs.hardcore.result, nearMissStreakBest: undefined }), /nearMissStreakBest/);
  assert.throws(() => statsFromChikunResult({ ...CHIKUN.runs.hardcore.result, regionReached: 'coast' }), /regionReached/);

  // STACKED: the SIC1 evidence replays to the stored tuple.
  const bytes = Uint8Array.from(Buffer.from(STACKED.evidenceBase64, 'base64'));
  const tuple = replayStackedRun(bytes, { expectedSeed: STACKED.seed, maxTicks: STACKED.maxTicks, config: STACKED.config });
  assert.deepEqual(JSON.parse(JSON.stringify(tuple)), STACKED.tuple);
  const stacked = statsFromStackedTuple(tuple);
  assert.deepEqual(Object.keys(stacked), STACKED_KEYS);
  assert.ok(numbersOnly(stacked));
  assert.equal(stacked.survivalSeconds, Number((tuple.ticks / 60).toFixed(3)));
  assert.equal(stacked.zone, 1);
  assert.throws(() => statsFromStackedTuple({ ...tuple, v: 'other' }), /stacked-result-v1/);

  // HMH: the committed summaries are what the sdk accumulator builds, and valid.
  for (const [name, summary] of Object.entries(HMH.runs)) {
    assert.equal(validateRunSummaryPayload(summary), '', name);
    assert.equal(summary.identity.mode, 'ranked');
    assert.equal(summary.identity.terminalReason, 'defeated');
    const stats = statsFromHmhRunSummary(summary);
    assert.deepEqual(Object.keys(stats), HMH_KEYS, name);
    assert.ok(numbersOnly(stats), name);
    assert.deepEqual(Object.keys(stats.familyKills), ['goblin', 'drone', 'gasBeast', 'enforcer']);
  }
  const boss = statsFromHmhRunSummary(HMH.runs['boss-run']);
  assert.deepEqual(
    { kills: boss.kills, bossKills: boss.bossKills, grenadeKills: boss.grenadeKills, meleeKills: boss.meleeKills, districtsVisited: boss.districtsVisited, powerUpsCollected: boss.powerUpsCollected, survivalSeconds: boss.survivalSeconds, noDamage: boss.noDamage, bossEngaged: boss.bossEngaged },
    { kills: 378, bossKills: 1, grenadeKills: 24, meleeKills: 12, districtsVisited: 6, powerUpsCollected: 7, survivalSeconds: 1350, noDamage: 0, bossEngaged: 1 },
  );
  assert.deepEqual(boss.weaponsUsed, ['coin-blaster', 'hash-rail', 'litecoin-knife', 'scatter-shotgun']);
  assert.deepEqual(boss.uniquePowerUps, ['berserk-candle', 'bonus-life', 'hash-rail-core', 'scatter-shotgun-cache', 'time-dilation']);
  assert.deepEqual(boss.familyKills, { goblin: 196, drone: 75, gasBeast: 64, enforcer: 42 });
  assert.equal(statsFromHmhRunSummary(HMH.runs['grenade-run']).meleeKills, 18, 'melee = Litecoin Knife + Forked Standard kills');

  // The 0|1 flags. bossEngaged reads the schema-6 milestone tick (0 = never engaged),
  // and falls back to a boss kill without it; perfectBossKill needs a boss kill and no damage.
  assert.equal(HMH.runs['short-run'].milestones.bossEngagedTick, 0);
  assert.equal(statsFromHmhRunSummary(HMH.runs['short-run']).bossEngaged, 0);
  assert.equal(boss.perfectBossKill, 0, 'a boss kill with damage taken');
  const untouched = statsFromHmhRunSummary(HMH.runs['untouched-run']);
  assert.deepEqual([untouched.noDamage, untouched.perfectBossKill, untouched.bossEngaged], [1, 0, 0], 'no damage but no boss kill');
  const flawlessBoss = structuredClone(HMH.runs['boss-run']);
  flawlessBoss.totals.damageTaken = 0;
  const flawless = statsFromHmhRunSummary(flawlessBoss);
  assert.deepEqual([flawless.noDamage, flawless.perfectBossKill, flawless.bossEngaged], [1, 1, 1]);
  const noMilestone = structuredClone(HMH.runs['boss-run']);
  delete noMilestone.milestones.bossEngagedTick;
  assert.equal(statsFromHmhRunSummary(noMilestone).bossEngaged, 1);
  noMilestone.kills.boss = 0;
  assert.equal(statsFromHmhRunSummary(noMilestone).bossEngaged, 0);

  // Chikun speedMultiplierReached keeps 2 decimals (§6.3).
  for (const [name, fixture] of Object.entries(CHIKUN.runs)) {
    const speed = statsFromChikunResult(fixture.result).speedMultiplierReached;
    assert.equal(speed, Number(fixture.result.speedMultiplierReached.toFixed(2)), name);
    assert.equal(speed, Math.round(speed * 100) / 100, name);
  }
  assert.equal(statsFromChikunResult({ ...CHIKUN.runs.hardcore.result, speedMultiplierReached: 1.23456 }).speedMultiplierReached, 1.23);
  assert.equal(statsFromChikunResult({ ...CHIKUN.runs.hardcore.result, speedMultiplierReached: 1.999 }).speedMultiplierReached, 2);
});

test('committed HMH fixtures are rebuilt byte-for-byte by the sdk accumulator', () => {
  assert.deepEqual(Object.keys(HMH_PLANS), Object.keys(HMH.runs));
  for (const [name, plan] of Object.entries(HMH_PLANS)) {
    assert.equal(JSON.stringify(buildHmhSummary(plan)), JSON.stringify(HMH.runs[name]), `${name} matches createRunSummaryAccumulator ... finalizeRunSummary`);
  }
  const source = readFileSync(fileURLToPath(new URL('./fixtures/achievements/build-fixtures.mjs', import.meta.url)), 'utf8');
  assert.match(source, /createRunSummaryAccumulator[\s\S]*recordRunKill[\s\S]*recordRunGrenade[\s\S]*recordRunCollectible[\s\S]*finalizeRunSummary/);
});

test('derivation excludes already-unlocked and unavailable entries', () => {
  // The untouched fixture carries the whole-run no-damage flag a real defeat never has.
  const untouched = hmhRun('untouched-run');
  assert.equal(untouched.stats.noDamage, 1);
  const earned = ids(deriveEarnedAchievements('lester-blaster', untouched, history('lester-blaster')));
  assert.ok(!earned.includes('no-damage-10-minutes') && !earned.includes('no-damage-boss'), 'unavailable ids are never returned');
  assert.ok(deriveEarnedAchievements('lester-blaster', hmhRun('boss-run'), history('lester-blaster')).every((entry) => entry.available));

  const boss = hmhRun('boss-run');
  const all = ids(deriveEarnedAchievements('lester-blaster', boss, history('lester-blaster')));
  assert.ok(all.includes('beat-level-1-boss') && all.includes('getaway-clear') && all.includes('max-combo-30'));
  const again = ids(deriveEarnedAchievements('lester-blaster', boss, history('lester-blaster', { unlockedIds: ['beat-level-1-boss', 'getaway-clear'] })));
  assert.deepEqual(again, all.filter((id) => id !== 'beat-level-1-boss' && id !== 'getaway-clear'));

  // Deterministic, in catalog order, frozen.
  const first = deriveEarnedAchievements('chikun', chikunRun('hardcore'), history('chikun'));
  const second = deriveEarnedAchievements('chikun', chikunRun('hardcore'), history('chikun'));
  assert.deepEqual(ids(first), ids(second));
  const order = catalogFor('chikun').map((entry) => entry.id);
  assert.deepEqual(ids(first), order.filter((id) => ids(first).includes(id)));
  assert.ok(Object.isFrozen(first));
  assert.equal(first[0], achievementById('chikun', first[0].id), 'derivation returns the catalog entries themselves');

  // A finished loop reaches every region: the hardcore run ends in the Forest on
  // its third lap, yet earns every region and both loop ids.
  const hardcore = chikunRun('hardcore');
  assert.deepEqual([hardcore.stats.laps, hardcore.stats.regionIndexReached], [2, 1]);
  for (const id of ['chikun-reach-forest', 'chikun-reach-town', 'chikun-reach-city', 'chikun-reach-industrial', 'chikun-reach-suburbs', 'chikun-reach-coast', 'chikun-loop-1', 'chikun-loop-2']) {
    assert.ok(ids(first).includes(id), `${id} is earned by a two-loop run`);
  }
  const lapless = run('chikun', { ...hardcore.stats, laps: 0 });
  assert.ok(achievementById('chikun', 'chikun-reach-forest').criteria(lapless, history('chikun')));
  assert.ok(!achievementById('chikun', 'chikun-reach-town').criteria(lapless, history('chikun')), 'without a loop only the regions passed count');

  assert.throws(() => deriveEarnedAchievements('stacked', { ...stackedRun(), gameId: 'chikun' }, history('stacked')), /gameId/);
  assert.throws(() => deriveEarnedAchievements('stacked', { gameId: 'stacked' }, history('stacked')), /stats/);
  assert.throws(() => deriveEarnedAchievements('stacked', stackedRun(), history('chikun')), /history gameId/);
});

test('derivation rejects missing or malformed history instead of reading it as empty', () => {
  const stacked = stackedRun();
  const good = history('stacked');
  assert.ok(ids(deriveEarnedAchievements('stacked', stacked, good)).includes('stacked-first-line'));
  const derive = (value) => () => deriveEarnedAchievements('stacked', stacked, value);
  assert.throws(derive(undefined), /history is required/);
  assert.throws(derive(null), /history is required/);
  assert.throws(derive({ ...good, gameId: undefined }), /history gameId must be stacked/);
  assert.throws(derive({ ...good, unlockedIds: 'stacked-first-line' }), /unlockedIds/);
  assert.throws(derive({ ...good, unlockedIds: undefined }), /unlockedIds/);
  assert.throws(derive({ ...good, unlockedIds: [7] }), /unlockedIds/);
  // What the Neon driver returns when the query forgets to cast: count(*) is a
  // bigint string and sum(...::numeric) a numeric string.
  assert.throws(derive({ ...good, runs: '4' }), /runs/);
  assert.throws(derive({ ...good, sums: { ...good.sums, lines: '1000' } }), /sums\.lines/);
  assert.throws(derive({ ...good, maxima: { ...good.maxima, lines: '250' } }), /maxima\.lines/);
  assert.throws(derive({ ...good, runs: -1 }), /runs/);
  assert.throws(derive({ ...good, runs: 1.5 }), /runs/);
  assert.throws(derive({ ...good, maxima: { ...good.maxima, score: Number.NaN } }), /maxima\.score/);
  assert.throws(derive({ ...good, sums: null }), /sums/);
  const { lines, ...withoutLines } = good.sums;
  assert.equal(lines, 0);
  assert.throws(derive({ ...good, sums: withoutLines }), /sums\.lines/, 'every catalog history path must be present');
  // The same values, typed as §6.5 requires, derive normally and skip held ids.
  const typed = { ...good, runs: 4, sums: { ...good.sums, lines: 1000 }, unlockedIds: ['stacked-first-line'] };
  const earned = ids(deriveEarnedAchievements('stacked', stacked, typed));
  assert.ok(!earned.includes('stacked-first-line'));
  assert.ok(earned.includes('stacked-lines-total-100') && earned.includes('stacked-lines-total-1000') && earned.includes('stacked-runs-5'));
});

test('cumulative criteria add history sums to the current run', () => {
  const reaper = achievementById('lester-blaster', 'enemy-reaper-500');
  const boss = hmhRun('boss-run'); // 378 kills
  assert.equal(reaper.criteria(boss, history('lester-blaster')), false);
  assert.equal(reaper.criteria(boss, history('lester-blaster', { sums: { kills: 121 } })), false);
  assert.equal(reaper.criteria(boss, history('lester-blaster', { sums: { kills: 122 } })), true);
  assert.deepEqual(reaper.progress(boss, history('lester-blaster', { sums: { kills: 100 } })), { current: 478, target: 500 });
  assert.deepEqual(reaper.progress(null, history('lester-blaster', { sums: { kills: 100 } })), { current: 100, target: 500 });

  const hunt = achievementById('lester-blaster', 'gas-beast-hunter');
  const short = hmhRun('short-run'); // no gas bombers
  assert.equal(hunt.criteria(short, history('lester-blaster', { sums: { 'familyKills.gasBeast': 49 } })), false);
  assert.equal(hunt.criteria(hmhRun('grenade-run'), history('lester-blaster', { sums: { 'familyKills.gasBeast': 49 } })), true);

  const haul = achievementById('chikun', 'chikun-distance-50km');
  const hard = chikunRun('hardcore');
  assert.equal(haul.criteria(hard, history('chikun')), false);
  assert.equal(haul.criteria(hard, history('chikun', { sums: { distanceMeters: 50_000 - hard.stats.distanceMeters } })), true);
  assert.equal(haul.criteria(hard, history('chikun', { sums: { distanceMeters: 49_999 - hard.stats.distanceMeters } })), false);

  const ledger = achievementById('stacked', 'stacked-lines-total-1000');
  const stacked = stackedRun();
  assert.equal(ledger.criteria(stacked, history('stacked', { sums: { lines: 1000 - stacked.stats.lines } })), true);
  assert.equal(ledger.criteria(stacked, history('stacked', { sums: { lines: 999 - stacked.stats.lines } })), false);

  // Run counts include the current run: history.runs excludes it (§6.5).
  const regular = achievementById('stacked', 'stacked-runs-5');
  assert.equal(regular.criteria(stacked, history('stacked', { runs: 3 })), false);
  assert.equal(regular.criteria(stacked, history('stacked', { runs: 4 })), true);
  assert.deepEqual(regular.progress(null, history('stacked', { runs: 3 })), { current: 3, target: 5 });
  assert.deepEqual(regular.progress(stacked, history('stacked', { runs: 3 })), { current: 4, target: 5 });

  // Best-run progress reads verified maxima; missing or malformed history reads as zero.
  const lines = achievementById('stacked', 'stacked-lines-300');
  assert.deepEqual(lines.progress(null, history('stacked', { maxima: { lines: 250 } })), { current: 250, target: 300 });
  assert.deepEqual(lines.progress(stacked, {}), { current: stacked.stats.lines, target: 300 });
  assert.equal(achievementById('chikun', 'chikun-runs-5').criteria(hard, { runs: 'many' }), false);
  const coast = achievementById('chikun', 'chikun-reach-coast');
  assert.deepEqual(coast.progress(null, history('chikun', { maxima: { laps: 0, regionIndexReached: 4 } })), { current: 4, target: 6 });
  assert.deepEqual(coast.progress(null, history('chikun', { maxima: { laps: 1, regionIndexReached: 1 } })), { current: 6, target: 6 });
});

test('Chikun runs never earn HMH achievements', () => {
  const chikun = chikunRun('hardcore');
  assert.throws(() => deriveEarnedAchievements('lester-blaster', chikun, history('lester-blaster')), /gameId must be lester-blaster/);
  const earned = deriveEarnedAchievements('chikun', chikun, history('chikun'));
  assert.ok(earned.length > 0 && earned.every((entry) => entry.gameId === 'chikun'));
  const hmhIds = new Set(catalogFor('lester-blaster').map((entry) => entry.id));
  assert.ok(ids(earned).every((id) => !hmhIds.has(id)));

  // The browser resolver agrees: a Chikun Ranked record unlocks no HMH achievement.
  const state = createInitialArcadeState();
  connectPlayerAccount(state, WALLET, { handle: 'ChikunOnly' });
  const profile = state.profiles[WALLET];
  const recordChikun = () => {
    const session = startPlaySession({ wallet: WALLET, gameId: 'chikun', mode: 'paid', allowDevCabinet: true });
    const result = simulateChikunRun({ seed: session.seed, taps: [3, 8, 13, 21, 34, 55, 89], maxTicks: 180 });
    const replayClaim = buildChikunReplayClaim({ buildHash: session.buildHash, seasonId: session.seasonId, result });
    return recordScore(state, session, result.score, {
      survivalTime: result.survivalTime, survivalTicks: result.survivalTicks, coinsCollected: result.coinsCollected,
      forksPassed: result.forksPassed, nearMisses: result.nearMisses, bestCombo: result.bestCombo, achievements: result.achievements, replayClaim,
    });
  };
  const before = [...profile.achievements];
  assert.deepEqual(recordChikun().unlockedAchievements, []);
  assert.deepEqual(profile.achievements, before);
  assert.ok(!profile.achievements.includes(ACHIEVEMENTS.FIRST_PAID_RUN.id));
  assert.equal(profile.totalPaidRuns, 1, 'the all-game display counter still counts the run');
  assert.equal(profile.progress['lester-blaster'].paidRuns, 0);

  // Ten Chikun runs fill the all-game counter past ten; none of them count toward
  // the HMH run-count achievements (the resolver reads HMH progress.paidRuns).
  for (let count = 2; count <= 10; count += 1) assert.deepEqual(recordChikun().unlockedAchievements, [], `Chikun run ${count}`);
  assert.deepEqual([profile.totalPaidRuns, profile.progress.chikun.paidRuns, profile.progress['lester-blaster'].paidRuns], [10, 10, 0]);
  assert.deepEqual(profile.achievements, before);

  const recordHmh = () => recordScore(state, startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid' }), 1200, { elapsedSeconds: 90, kills: 3 }).unlockedAchievements;
  const firstHmh = recordHmh();
  assert.ok(firstHmh.includes(ACHIEVEMENTS.FIRST_PAID_RUN.id), 'first-paid-run counts HMH runs only');
  assert.ok(!firstHmh.includes(ACHIEVEMENTS.TEN_PAID_RUNS.id), 'eleven Ranked runs in all, but only one of them HMH');
  assert.equal(profile.totalPaidRuns, 11);
  for (let count = 2; count <= 9; count += 1) assert.ok(!recordHmh().includes(ACHIEVEMENTS.TEN_PAID_RUNS.id), `HMH run ${count}`);
  assert.ok(recordHmh().includes(ACHIEVEMENTS.TEN_PAID_RUNS.id), 'the tenth HMH run unlocks ten-paid-runs');
  assert.deepEqual([profile.totalPaidRuns, profile.progress['lester-blaster'].paidRuns], [20, 10]);
});

test('history field paths are safe SQL identifiers', () => {
  const pattern = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)?$/;
  const samples = { 'lester-blaster': hmhRun('boss-run').stats, chikun: chikunRun('hardcore').stats, stacked: stackedRun().stats };
  for (const [gameId, stats] of Object.entries(samples)) {
    const fields = historyFieldsFor(gameId);
    assert.deepEqual(Object.keys(fields), ['sum', 'max']);
    assert.ok(fields.sum.length > 0 && fields.max.length > 0, gameId);
    for (const path of [...fields.sum, ...fields.max]) {
      assert.match(path, pattern, `${gameId} ${path}`);
      const [head, tail] = path.split('.');
      const value = tail === undefined ? stats[head] : stats[head]?.[tail];
      assert.equal(typeof value, 'number', `${gameId} ${path} is a number in the mapped stats`);
      assert.ok(Number.isFinite(value));
    }
    assert.deepEqual(fields.sum, [...new Set(fields.sum)].sort());
    assert.deepEqual(fields.max, [...new Set(fields.max)].sort());
    const empty = emptyHistory(WALLET, gameId);
    assert.deepEqual(empty, { wallet: WALLET, gameId, runs: 0, sums: Object.fromEntries(fields.sum.map((p) => [p, 0])), maxima: Object.fromEntries(fields.max.map((p) => [p, 0])), unlockedIds: [] });
    // Callers get copies: mutating one never changes the registry.
    fields.sum.push('x; DROP TABLE');
    assert.ok(!historyFieldsFor(gameId).sum.includes('x; DROP TABLE'));
  }
  assert.ok(historyFieldsFor('lester-blaster').sum.includes('familyKills.gasBeast'));
  assert.throws(() => historyFieldsFor('pinball'), /unknown achievement gameId/);
});

// Profiles in the Chikun harness JSON as a v6 stats object, at one percentile.
function chikunProfileStats(profile, percentile, skimProfile = null) {
  const at = (stats, key) => (stats?.[key]?.[percentile] ?? 0);
  const harness = HARNESS.profiles[profile];
  const skim = skimProfile ? SKIM.profiles[skimProfile].stats : null;
  const pick = (key) => Math.max(at(harness.stats, key), at(skim, key));
  const minutes = Math.max(harness.survivalMinutes[percentile], skim?.survivalMinutes?.[percentile] ?? 0);
  const laps = pick('laps');
  return {
    score: pick('score'), survivalTicks: minutes * 3600, survivalSeconds: minutes * 60, coinsCollected: pick('coinsCollected'),
    forksPassed: pick('forksPassed'), nearMisses: pick('nearMisses'), bestCombo: pick('bestCombo'), nearMissStreakBest: pick('nearMissStreakBest'),
    flawlessRegions: pick('flawlessRegions'), distanceMeters: pick('distanceMeters'),
    regionIndexReached: laps >= 1 ? pick('regionIndexReached') : (harness.loop0RegionIndexReached[percentile] ?? pick('regionIndexReached')),
    laps, speedMultiplierReached: pick('speedMultiplierReached'),
  };
}
function stackedProfileStats(profile, percentile) {
  const stats = STACKED_CALIBRATION.profiles[profile].stats;
  const out = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, value[percentile]]));
  return { ...out, survivalSeconds: stats.survivalMinutes[percentile] * 60, ticks: stats.survivalMinutes[percentile] * 3600, holdsUsed: 0 };
}
const lower = (stats) => Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, typeof value === 'number' ? value - 1e-6 : value]));
const sessionOf = (gameId, stats, count) => history(gameId, {
  runs: count,
  sums: Object.fromEntries(historyFieldsFor(gameId).sum.map((path) => [path, statAt(stats, path) * count])),
  maxima: Object.fromEntries(historyFieldsFor(gameId).max.map((path) => [path, statAt(stats, path)])),
});
const TIER_RANK = Object.freeze({ bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4, mythic: 5 });

// The Chikun and STACKED tables of the owner-review doc, one rule per row:
// run count (`history.runs + 1 ≥ N`), cumulative (Σ `path ≥ N`), region reached
// (`laps ≥ 1` or `regionIndexReached ≥ N`) or best single run (`path ≥ N`).
function docCatalog(heading) {
  const start = CATALOG_DOC.indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `the catalog doc has a ${heading} section`);
  const section = CATALOG_DOC.slice(start + 1, CATALOG_DOC.indexOf('\n## ', start + 1));
  const rows = new Map();
  for (const line of section.split('\n').filter((row) => /^\| \d+ \| `/.test(row))) {
    const [, , id, title, tier, category, criterion, available, nft, source] = line.split('|').map((cell) => cell.trim());
    const number = (text) => Number(text.replace(/,/g, ''));
    const runsMatch = criterion.match(/^`history\.runs \+ 1 ≥ ([\d,]+)`/);
    const reachMatch = criterion.match(/^`laps ≥ 1` or `regionIndexReached ≥ (\d+)`/);
    const ruleMatch = criterion.match(/^(Σ )?`([a-zA-Z][a-zA-Z0-9.]*) ≥ ([\d,.]+)`/);
    let rule = null;
    if (runsMatch) rule = { kind: 'runs', path: null, target: number(runsMatch[1]) };
    else if (reachMatch) rule = { kind: 'reach', path: 'regionIndexReached', target: number(reachMatch[1]) };
    else if (ruleMatch) rule = { kind: ruleMatch[1] ? 'total' : 'best', path: ruleMatch[2], target: number(ruleMatch[3]) };
    assert.ok(rule, `${heading} row ${id}: criterion "${criterion}" names one rule`);
    rows.set(id.replace(/`/g, ''), { ...rule, title, tier, category, available, nft, source });
  }
  return rows;
}
const DOC_RULES = { chikun: docCatalog("Chikun's Escape (40)"), stacked: docCatalog('STACKED (40)') };
const statsWith = (path, value) => (path.includes('.') ? { [path.split('.')[0]]: { [path.split('.')[1]]: value } } : { [path]: value });

test('Chikun and STACKED thresholds match the owner-review doc and rise with the tier', () => {
  for (const [gameId, rules] of Object.entries(DOC_RULES)) {
    const entries = catalogFor(gameId);
    assert.deepEqual([...rules.keys()], entries.map((entry) => entry.id), `${gameId}: the doc lists every entry, in catalog order`);
    for (const entry of entries) {
      const rule = rules.get(entry.id);
      assert.deepEqual([rule.title, rule.tier, rule.category, rule.nft.startsWith('**yes**')], [entry.title, entry.tier, entry.category, entry.nft], entry.id);
      const empty = history(gameId);
      const at = (stats, prior = empty) => entry.criteria(run(gameId, stats), prior);
      const below = rule.target - 1e-6;
      assert.equal(entry.progress(null, empty).target, rule.target, `${entry.id} progress target`);
      if (rule.kind === 'runs') {
        assert.equal(at({}, history(gameId, { runs: rule.target - 1 })), true, entry.id);
        if (rule.target > 1) assert.equal(at({}, history(gameId, { runs: rule.target - 2 })), false, entry.id);
      } else if (rule.kind === 'total') {
        assert.equal(at(statsWith(rule.path, 0), history(gameId, { sums: { ...empty.sums, [rule.path]: rule.target } })), true, `${entry.id} counts history`);
        assert.equal(at(statsWith(rule.path, 0), history(gameId, { sums: { ...empty.sums, [rule.path]: below } })), false, entry.id);
        assert.equal(at(statsWith(rule.path, 1), history(gameId, { sums: { ...empty.sums, [rule.path]: rule.target - 1 } })), true, `${entry.id} counts this run`);
      } else if (rule.kind === 'reach') {
        assert.equal(at({ laps: 0, regionIndexReached: rule.target }), true, entry.id);
        assert.equal(at({ laps: 0, regionIndexReached: rule.target - 1 }), false, entry.id);
        assert.equal(at({ laps: 1, regionIndexReached: 0 }), true, `${entry.id} after a finished loop`);
      } else {
        assert.equal(at(statsWith(rule.path, rule.target)), true, `${entry.id} at ${rule.path} ${rule.target}`);
        assert.equal(at(statsWith(rule.path, below)), false, `${entry.id} just below ${rule.target}`);
        const pastRuns = history(gameId, { runs: 99, sums: { ...empty.sums, [rule.path]: rule.target * 99 } });
        assert.equal(at(statsWith(rule.path, 0), pastRuns), false, `${entry.id} is a single-run best, not a total`);
      }
    }
    // Within one stat and rule kind, a rarer tier always needs strictly more.
    const ordered = [...rules].filter(([, rule]) => rule.kind !== 'runs');
    for (const [idA, a] of ordered) {
      for (const [idB, b] of ordered) {
        if (a.kind === b.kind && a.path === b.path && TIER_RANK[a.tier] < TIER_RANK[b.tier]) {
          assert.ok(a.target < b.target, `${idA} (${a.tier} ${a.target}) sits below ${idB} (${b.tier} ${b.target})`);
        }
      }
    }
    const volume = [...rules].filter(([, rule]) => rule.kind === 'runs').sort(([, a], [, b]) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
    for (let i = 1; i < volume.length; i += 1) assert.ok(volume[i - 1][1].target < volume[i][1].target, `${gameId} run counts rise with the tier`);
  }
});

// Chikun ids that sit past their tier's anchor percentile (silver: intermediate
// median; gold: expert or hardcore median), with the harness percentile that
// first reaches them. Each is on the doc's "What to review" list for owner O1.
const CHIKUN_TIER_EDGES = Object.freeze({
  'chikun-speed-2x': ['intermediate', 'p90'],
  'chikun-loop-2': ['hardcore', 'p90'],
  'chikun-survive-10m': ['hardcore', 'p90'],
});
// Platinum entries the owner placed at O1 (2026-09-23) although part of the
// exceptional profile below its p90 reaches them ([profile, percentile] that
// first reaches it). Each must still sit past every gold anchor.
const CHIKUN_PLATINUM_BY_DECISION = Object.freeze({
  'chikun-survive-12m': ['exceptional', 'p90'],
});
// STACKED thresholds the soak pilot reaches only by accident (it plays for
// singles). Seven equal a Free medal threshold ([medal id, stats path]; the
// medal counts spin clears, the tuple only spin locks) ...
const STACKED_MEDAL_ANCHORS = Object.freeze({
  'stacked-first-halving': ['stacked-first-quad', 'quadClears'],
  'stacked-first-spin-lock': ['stacked-first-spin', 'spins'],
  'stacked-first-perfect-clear': ['stacked-perfect-clear', 'perfectClears'],
  'stacked-chain-5': ['stacked-combo-5', 'maxCombo'],
  'stacked-chain-10': ['stacked-combo-10', 'maxCombo'],
  'stacked-halvings-10': ['stacked-quad-10', 'quadClears'],
  'stacked-b2b-streak-10': ['stacked-b2b-10', 'maxBackToBack'],
});
// ... and eight are estimates between medal thresholds on the same stat
// ([stats path, medal it must exceed or null, medal it must stay under or null]).
const STACKED_ESTIMATES = Object.freeze({
  'stacked-halvings-total-5': ['quadClears', 'stacked-first-quad', 'stacked-quad-10'],
  'stacked-first-hold': ['holdsUsed', null, null],
  'stacked-halvings-3': ['quadClears', 'stacked-first-quad', 'stacked-quad-10'],
  'stacked-spins-10': ['spins', 'stacked-first-spin', null],
  'stacked-b2b-streak-2': ['maxBackToBack', null, 'stacked-b2b-10'],
  'stacked-perfect-clears-3': ['perfectClears', 'stacked-perfect-clear', null],
  'stacked-spins-25': ['spins', 'stacked-first-spin', null],
  'stacked-b2b-streak-5': ['maxBackToBack', null, 'stacked-b2b-10'],
});
const WHAT_TO_REVIEW = CATALOG_DOC.slice(CATALOG_DOC.indexOf('## What to review'), CATALOG_DOC.indexOf('## How the catalogs work'));

test('bronze thresholds are reachable at the novice median, platinum sits at or above exceptional p90', () => {
  // Chikun: the harness JSON (plus the near-miss-chasing sample for combo and near misses).
  assert.equal(HARNESS.course.evidenceVersion, 'chikun-flap-evidence-v6');
  const chikunAt = (profile, percentile) => run('chikun', chikunProfileStats(profile, percentile, profile));
  const novice = run('chikun', chikunProfileStats('novice', 'p50'));
  const firstSession = sessionOf('chikun', novice.stats, 4); // a first session: five novice-median runs
  for (const entry of catalogFor('chikun').filter((e) => e.tier === 'bronze')) {
    assert.ok(entry.criteria(novice, firstSession), `${entry.id} is earned in a first session of novice-median runs`);
  }
  const exceptionalP90 = run('chikun', lower(chikunProfileStats('exceptional', 'p90', 'exceptional')));
  const exceptionalP99 = chikunAt('exceptional', 'p99');
  for (const entry of catalogFor('chikun').filter((e) => e.tier === 'platinum')) {
    assert.equal(entry.criteria(exceptionalP99, history('chikun')), true, `${entry.id} is reached by the exceptional p99`);
    const decided = CHIKUN_PLATINUM_BY_DECISION[entry.id];
    if (decided) {
      assert.equal(entry.nft, false, `${entry.id} is platinum by owner decision, not an NFT candidate`);
      for (const [profile, percentile] of [['expert', 'p50'], ['hardcore', 'p50'], ['hardcore', 'p99']]) {
        assert.equal(entry.criteria(chikunAt(profile, percentile), history('chikun')), false, `${entry.id} sits past the ${profile} ${percentile}`);
      }
      assert.ok(entry.criteria(chikunAt(...decided), history('chikun')), `${entry.id} is reached at the ${decided.join(' ')}`);
      continue;
    }
    assert.equal(entry.criteria(exceptionalP90, history('chikun')), false, `${entry.id} is not earned below the exceptional p90`);
  }
  // Silver is reached at the intermediate median and gold at the expert or hardcore
  // median (either strategy), except the listed edges, which the owner reviews.
  const anchors = { silver: [chikunAt('intermediate', 'p50')], gold: [chikunAt('expert', 'p50'), chikunAt('hardcore', 'p50')] };
  for (const entry of catalogFor('chikun').filter((e) => (e.tier === 'silver' || e.tier === 'gold') && !['volume', 'distance'].includes(e.category))) {
    const atAnchor = anchors[entry.tier].some((sample) => entry.criteria(sample, history('chikun')));
    const edge = CHIKUN_TIER_EDGES[entry.id];
    if (!edge) {
      assert.ok(atAnchor, `${entry.id} (${entry.tier}) is reached at its tier's median`);
      continue;
    }
    assert.ok(!atAnchor, `${entry.id} is listed as an edge, so it must sit past its tier's median`);
    assert.ok(entry.criteria(chikunAt(...edge), history('chikun')), `${entry.id} is reached at the ${edge.join(' ')}`);
    assert.match(WHAT_TO_REVIEW, new RegExp(`\`${entry.id}\``), `${entry.id} is on the doc's review list`);
  }
  // The cumulative silver: nine intermediate-median runs fly 50 km.
  const intermediate = chikunAt('intermediate', 'p50');
  const haul = achievementById('chikun', 'chikun-distance-50km');
  assert.ok(haul.criteria(intermediate, sessionOf('chikun', intermediate.stats, 8)));
  assert.ok(!haul.criteria(intermediate, sessionOf('chikun', intermediate.stats, 7)));

  // STACKED: the throttled soak-pilot profiles, for the thresholds they calibrate.
  const anchored = new Set([...Object.keys(STACKED_MEDAL_ANCHORS), ...Object.keys(STACKED_ESTIMATES)]);
  const stackedNovice = run('stacked', stackedProfileStats('novice', 'p50'));
  const stackedSession = sessionOf('stacked', stackedNovice.stats, 4);
  for (const entry of catalogFor('stacked').filter((e) => e.tier === 'bronze' && !anchored.has(e.id))) {
    assert.ok(entry.criteria(stackedNovice, stackedSession), `${entry.id} is earned in a first session of novice-median runs`);
  }
  const stackedP90 = run('stacked', lower(stackedProfileStats('exceptional', 'p90')));
  const stackedP99 = run('stacked', stackedProfileStats('exceptional', 'p99'));
  for (const entry of catalogFor('stacked').filter((e) => e.tier === 'platinum')) {
    assert.equal(entry.criteria(stackedP90, history('stacked')), false, `${entry.id} is not earned below the exceptional p90`);
    // Bot-calibrated platinum is reached at the exceptional p99; the one medal-anchored platinum keeps the medal's threshold.
    if (!anchored.has(entry.id)) assert.equal(entry.criteria(stackedP99, history('stacked')), true, `${entry.id} is reached by the exceptional p99`);
    else assert.ok(STACKED_MEDAL_ANCHORS[entry.id], `${entry.id} platinum rests on a medal, not an estimate`);
  }
  const stackedHardcore = run('stacked', stackedProfileStats('hardcore', 'p50'));
  const stackedIntermediate = run('stacked', stackedProfileStats('intermediate', 'p50'));
  for (const entry of catalogFor('stacked').filter((e) => !anchored.has(e.id) && e.category !== 'volume' && !e.id.includes('total'))) {
    if (entry.tier === 'silver') assert.ok(entry.criteria(stackedIntermediate, history('stacked')), `${entry.id} at the intermediate median`);
    if (entry.tier === 'gold') assert.ok(entry.criteria(stackedHardcore, history('stacked')), `${entry.id} at the hardcore median`);
  }
  assert.ok(achievementById('stacked', 'stacked-lines-total-1000').criteria(stackedIntermediate, sessionOf('stacked', stackedIntermediate.stats, 8)), 'nine intermediate-median runs clear 1,000 rows');

  // Medal anchors keep the medal's threshold on the matching stat; estimates stay
  // between their medals and are marked in the doc.
  const medal = (id) => FREE_MEDALS.find((row) => row.id === id);
  for (const [id, [medalId, path]] of Object.entries(STACKED_MEDAL_ANCHORS)) {
    const rule = DOC_RULES.stacked.get(id);
    assert.deepEqual([rule.path, rule.target], [path, medal(medalId).threshold], `${id} equals medal ${medalId}`);
    assert.ok(medal(medalId).field === path || (medalId === 'stacked-first-spin' && medal(medalId).field === 'spinClears'), id);
    assert.match(rule.source, new RegExp(`Medal \`${medalId.replace('stacked-', '')}\``), `${id} names its medal in the doc`);
  }
  for (const [id, [path, above, under]] of Object.entries(STACKED_ESTIMATES)) {
    const rule = DOC_RULES.stacked.get(id);
    assert.equal(rule.path, path, id);
    if (above) assert.ok(rule.target > medal(above).threshold, `${id} sits above medal ${above}`);
    if (under) assert.ok(rule.target < medal(under).threshold, `${id} sits under medal ${under}`);
    assert.match(rule.source, /\*\*estimate\*\*/, `${id} is marked as an estimate in the doc`);
    assert.match(WHAT_TO_REVIEW, new RegExp(`\`${id}\``), `${id} is on the doc's review list`);
  }
  const marked = [...DOC_RULES.stacked].filter(([, rule]) => /\*\*estimate\*\*/.test(rule.source)).map(([id]) => id);
  assert.deepEqual(marked.sort(), Object.keys(STACKED_ESTIMATES).sort(), 'the doc marks exactly these STACKED estimates');
});

// The legacy requirement of an ACHIEVEMENT_DEFINITIONS entry as the catalog rule
// the server applies to §6.3 stats. Remaps are explicit; see the catalog doc.
const HMH_REMAPS = Object.freeze({
  'cabinet-pioneer': { kind: 'runs', target: 1 }, // legacy { login: true }: settling a run needs a signed-in wallet
  'first-blood': { kind: 'total', path: 'kills', target: 1 }, // the legacy resolver counts the running kill total
  'first-grenade-kill': { kind: 'total', path: 'grenadeKills', target: 1 },
  'first-powerup': { kind: 'total', path: 'powerUpsCollected', target: 1 },
  'spread-ltc-specialist': { kind: 'weapon', weaponId: 'scatter-shotgun' }, // legacy 'spread-ltc'
  'damage-chain': { kind: 'best', path: 'damageDealt', target: HMH_DAMAGE_CHAIN_DAMAGE }, // legacy maxDamageCombo 250
  'weapon-collector': { kind: 'best', path: 'uniqueWeaponCount', target: 3 }, // legacy uniqueWeapons across runs
});
const CUMULATIVE_REQUIREMENTS = Object.freeze({
  cumulativeKills: 'kills', cumulativeGrenadeKills: 'grenadeKills', cumulativeMeleeKills: 'meleeKills', cumulativePowerUps: 'powerUpsCollected',
  cumulativeBossKills: 'bossKills', cumulativeSeconds: 'survivalSeconds',
});
const districtsForStage = (stage) => HMH_DISTRICT_STAGES.find(([, legacyStage]) => legacyStage === stage)[0];
function expectedHmhRule(definition) {
  if (HMH_REMAPS[definition.id]) return HMH_REMAPS[definition.id];
  const r = definition.requirement;
  const keys = Object.keys(r).sort().join(',');
  if (keys === 'paidRuns') return { kind: 'runs', target: r.paidRuns };
  if (keys === 'score') return { kind: 'best', path: 'score', target: r.score };
  if (keys === 'kills') return { kind: 'best', path: 'kills', target: r.kills };
  if (keys === 'bossId') return { kind: 'best', path: 'bossKills', target: 1 };
  if (keys === 'elapsedSeconds') return { kind: 'best', path: 'survivalSeconds', target: r.elapsedSeconds };
  if (keys === 'maxCombo') return { kind: 'best', path: 'maxCombo', target: r.maxCombo };
  if (keys === 'weaponId') return { kind: 'weapon', weaponId: r.weaponId };
  if (keys === 'uniquePowerUps') return { kind: 'uniquePowerUps', target: r.uniquePowerUps };
  if (keys === 'stageIndexReached') return { kind: 'best', path: 'districtsVisited', target: districtsForStage(r.stageIndexReached) };
  if (keys === 'bossId,stageIndexReached') return { kind: 'districtsAnd', districts: districtsForStage(r.stageIndexReached), path: 'bossKills', target: 1 };
  if (keys === 'grenadeKills,stageIndexReached') return { kind: 'districtsAnd', districts: districtsForStage(r.stageIndexReached), path: 'grenadeKills', target: r.grenadeKills };
  if (keys === 'cumulativeKills,enemyId' && r.enemyId === 'gas-beast') return { kind: 'total', path: 'familyKills.gasBeast', target: r.cumulativeKills };
  if (keys === 'cumulativeKills,family') return { kind: 'total', path: `familyKills.${r.family}`, target: r.cumulativeKills };
  if (keys.split(',').length === 1 && CUMULATIVE_REQUIREMENTS[keys]) return { kind: 'total', path: CUMULATIVE_REQUIREMENTS[keys], target: r[keys] };
  return null;
}

test('HMH catalog thresholds match the ACHIEVEMENT_DEFINITIONS requirements', () => {
  // Zeroed §6.3 stats, then one field at a time.
  const zero = JSON.parse(JSON.stringify(hmhRun('short-run').stats, (key, value) => (typeof value === 'number' ? 0 : Array.isArray(value) ? [] : value)));
  const withStats = (changes) => {
    const stats = structuredClone(zero);
    for (const [path, value] of Object.entries(changes)) {
      const [head, tail] = path.split('.');
      if (tail === undefined) stats[head] = value; else stats[head][tail] = value;
    }
    return run('lester-blaster', stats);
  };
  const empty = history('lester-blaster');
  const withSums = (sums, overrides = {}) => history('lester-blaster', { ...overrides, sums: { ...empty.sums, ...sums } });
  let checked = 0;
  for (const definition of ACHIEVEMENT_LIST) {
    const entry = achievementById('lester-blaster', definition.id);
    if (!entry.available) continue;
    const rule = expectedHmhRule(definition);
    assert.ok(rule, `${definition.id}: its requirement maps to a catalog rule`);
    const at = (changes, prior = empty) => entry.criteria(withStats(changes), prior);
    const id = definition.id;
    if (rule.kind === 'runs') {
      assert.equal(at({}, history('lester-blaster', { runs: rule.target - 1 })), true, id);
      if (rule.target > 1) assert.equal(at({}, history('lester-blaster', { runs: rule.target - 2 })), false, id);
      assert.equal(at({ kills: 1e6, score: 1e9, survivalSeconds: 1e6 }, history('lester-blaster', { runs: Math.max(0, rule.target - 2) })), rule.target === 1, `${id} counts runs only`);
    } else if (rule.kind === 'best') {
      assert.equal(at({ [rule.path]: rule.target }), true, `${id} at ${rule.path} ${rule.target}`);
      assert.equal(at({ [rule.path]: rule.target - 1e-6 }), false, `${id} just below ${rule.target}`);
      assert.equal(at({ [rule.path]: 0 }, withSums({ [rule.path]: rule.target * 50 }, { runs: 50 })), false, `${id} is a single-run best`);
    } else if (rule.kind === 'total') {
      assert.equal(at({ [rule.path]: 0 }, withSums({ [rule.path]: rule.target })), true, `${id} counts history`);
      assert.equal(at({ [rule.path]: 0 }, withSums({ [rule.path]: rule.target - 1 })), false, `${id} just below ${rule.target}`);
      assert.equal(at({ [rule.path]: 1 }, withSums({ [rule.path]: rule.target - 1 })), true, `${id} counts this run`);
      assert.equal(at({ [rule.path]: rule.target - 1 }), false, `${id} below ${rule.target} in one run`);
    } else if (rule.kind === 'weapon') {
      assert.equal(at({ weaponsUsed: [rule.weaponId] }), true, id);
      assert.equal(at({ weaponsUsed: HMH_RUN_SUMMARY_CATALOGS.weapons.filter((weaponId) => weaponId !== rule.weaponId) }), false, id);
    } else if (rule.kind === 'uniquePowerUps') {
      const powerUps = HMH_RUN_SUMMARY_CATALOGS.collectibles.filter((effectId) => effectId !== 'litecoin-token');
      assert.equal(at({ uniquePowerUps: powerUps.slice(0, rule.target) }), true, id);
      assert.equal(at({ uniquePowerUps: powerUps.slice(0, rule.target - 1), powerUpsCollected: 99 }), false, id);
    } else if (rule.kind === 'districtsAnd') {
      assert.equal(at({ districtsVisited: rule.districts, [rule.path]: rule.target }), true, id);
      assert.equal(at({ districtsVisited: rule.districts, [rule.path]: rule.target - 1 }), false, `${id} needs ${rule.path} ${rule.target}`);
      assert.equal(at({ districtsVisited: rule.districts - 1, [rule.path]: rule.target }), false, `${id} needs ${rule.districts} districts`);
    }
    if (entry.progress && rule.target !== undefined && rule.kind !== 'districtsAnd') {
      assert.equal(entry.progress(null, empty).target, rule.target, `${id} progress target`);
    }
    checked += 1;
  }
  assert.equal(checked, 44, 'every available HMH id is pinned to its legacy requirement');
  // Six districts without a boss kill are not a getaway (the loop above covers five districts with one).
  const getaway = achievementById('lester-blaster', 'getaway-clear');
  const sixNoBoss = structuredClone(HMH.runs['boss-run']);
  sixNoBoss.kills.boss = 0;
  assert.equal(statsFromHmhRunSummary(sixNoBoss).districtsVisited, 6);
  assert.equal(getaway.criteria(run('lester-blaster', statsFromHmhRunSummary(sixNoBoss)), history('lester-blaster')), false);
  assert.ok(!resolveAchievementUnlocksForRun(hmhResolverInputsFromRunSummary(sixNoBoss)).includes('getaway-clear'), 'the browser resolver agrees');
  // Hard Fork Hero: 20 grenade kills with all six districts, in one run.
  const fork = achievementById('lester-blaster', 'hard-fork-hero');
  const boss = hmhRun('boss-run').stats; // 6 districts, 24 grenade kills
  assert.equal(fork.criteria(run('lester-blaster', { ...boss, grenadeKills: 20 }), history('lester-blaster')), true);
  assert.equal(fork.criteria(run('lester-blaster', { ...boss, grenadeKills: 19 }), withSums({ grenadeKills: 500 })), false, 'history grenade kills do not count');
  assert.equal(fork.criteria(run('lester-blaster', { ...boss, districtsVisited: 5 }), history('lester-blaster')), false);
});

test('HMH resolver inputs use the legacy enemy ids and stage thresholds', () => {
  const summary = HMH.runs['boss-run'];
  const inputs = hmhResolverInputsFromRunSummary(summary);
  assert.deepEqual(Object.keys(inputs), RESOLVER_KEYS);
  assert.deepEqual(inputs.enemyKillsByType, { 'fud-goblin': 196, 'sybil-drone': 75, 'gas-beast': 64 });
  assert.equal(inputs.stageIndexReached, 13);
  assert.equal(inputs.bossId, 'boss-liquidator');
  assert.equal(inputs.noDamage, false);
  assert.deepEqual(inputs.weaponIds, ['coin-blaster', 'hash-rail', 'litecoin-knife', 'scatter-shotgun']);
  assert.deepEqual(inputs.collectedPowerUps, ['berserk-candle', 'bonus-life', 'hash-rail-core', 'scatter-shotgun-cache', 'time-dilation']);
  assert.equal(inputs.grenadeKills, 24);
  assert.equal(inputs.meleeKills, 12);
  assert.equal(inputs.maxCombo, 34);
  assert.equal(hmhResolverInputsFromRunSummary(HMH.runs['short-run']).bossId, null);
  const expected = [1, 1, 4, 4, 8, 8, 13];
  for (let districts = 0; districts <= 6; districts += 1) {
    const clone = structuredClone(summary);
    clone.exploration.visitedDistrictMask = (1 << districts) - 1;
    assert.equal(hmhResolverInputsFromRunSummary(clone).stageIndexReached, expected[districts], `${districts} districts`);
    assert.equal(statsFromHmhRunSummary(clone).districtsVisited, districts);
  }
  // The same districts gate slums, foundry and getaway on both sides.
  for (const [districts, expectIds] of [[2, ['slums-clear']], [4, ['slums-clear', 'foundry-clear']], [6, ['slums-clear', 'foundry-clear', 'getaway-clear']]]) {
    const clone = structuredClone(summary);
    clone.exploration.visitedDistrictMask = (1 << districts) - 1;
    const legacy = resolveAchievementUnlocksForRun(hmhResolverInputsFromRunSummary(clone)).filter((id) => /clear$/.test(id) && id !== 'speed-clear');
    const server = ids(deriveEarnedAchievements('lester-blaster', run('lester-blaster', statsFromHmhRunSummary(clone)), history('lester-blaster'))).filter((id) => /clear$/.test(id));
    assert.deepEqual(legacy, expectIds);
    assert.deepEqual(server, expectIds);
  }
});

// The bare legacy resolver fed by the mapper plus the call-site fields (score,
// time, kills, pickups, damage) and, for the history pass, the cumulative totals
// before this run (cumulativeEnemyKillsByType excludes it, as maybeUnlockRunAchievements
// now passes it). The real recordScore path is the next test's subject.
function legacyIds(summary, prior = history('lester-blaster')) {
  const stats = statsFromHmhRunSummary(summary);
  const sums = prior.sums;
  const inputs = hmhResolverInputsFromRunSummary(summary);
  return resolveAchievementUnlocksForRun({
    ...inputs,
    score: stats.score,
    elapsedSeconds: stats.survivalSeconds,
    kills: stats.kills,
    totalKills: sums.kills + stats.kills,
    cumulativeGrenadeKills: sums.grenadeKills + stats.grenadeKills,
    cumulativeMeleeKills: sums.meleeKills + stats.meleeKills,
    cumulativeEnemyKillsByType: { 'fud-goblin': sums['familyKills.goblin'], 'sybil-drone': sums['familyKills.drone'], 'gas-beast': sums['familyKills.gasBeast'] },
    powerUpsCollected: stats.powerUpsCollected,
    cumulativePowerUps: sums.powerUpsCollected + stats.powerUpsCollected,
    paidRuns: prior.runs + 1,
    cumulativeSeconds: sums.survivalSeconds + stats.survivalSeconds,
    cumulativeBossKills: sums.bossKills + stats.bossKills,
    damageDealt: stats.damageDealt,
  });
}
// Unavailable ids (documented) and cabinet-pioneer (the browser unlocks it at wallet connect, not in the resolver).
const PARITY_EXEMPT = new Set([...catalogFor('lester-blaster').filter((e) => !e.available).map((e) => e.id), 'cabinet-pioneer']);
const serverIds = (summary, prior = history('lester-blaster')) => ids(deriveEarnedAchievements('lester-blaster', run('lester-blaster', statsFromHmhRunSummary(summary)), prior));

test('legacy resolver and server derivation agree on HMH fixtures', () => {
  for (const [name, summary] of Object.entries(HMH.runs)) {
    const legacy = legacyIds(summary).filter((id) => !PARITY_EXEMPT.has(id));
    const server = serverIds(summary).filter((id) => !PARITY_EXEMPT.has(id));
    assert.deepEqual([...legacy].sort(), [...server].sort(), `${name}: same ids with no history`);
    assert.ok(server.length > 0, name);
  }
  assert.ok(serverIds(HMH.runs['boss-run']).includes('cabinet-pioneer'));
  assert.ok(legacyIds(HMH.runs['untouched-run']).includes('no-damage-10-minutes'), 'the legacy flag exists, the server entry is unavailable');
  assert.ok(serverIds(HMH.runs['grenade-run']).includes('damage-chain'));
  assert.ok(!serverIds(HMH.runs['untouched-run']).includes('damage-chain'));
  assert.equal(HMH_DAMAGE_CHAIN_DAMAGE, 20_000);
  // The browser resolver uses the same damage-chain and weapon remaps.
  assert.ok(!resolveAchievementUnlocksForRun({ damageDealt: HMH_DAMAGE_CHAIN_DAMAGE - 1 }).includes('damage-chain'));
  assert.ok(resolveAchievementUnlocksForRun({ damageDealt: HMH_DAMAGE_CHAIN_DAMAGE }).includes('damage-chain'));
  assert.ok(resolveAchievementUnlocksForRun({ weaponIds: ['scatter-shotgun'] }).includes('spread-ltc-specialist'));
  assert.ok(resolveAchievementUnlocksForRun({ weaponIds: ['coin-blaster', 'hash-rail', 'auto-miner'] }).includes('weapon-collector'));

  // With verified history: nine earlier runs of the grenade fixture.
  const grenade = statsFromHmhRunSummary(HMH.runs['grenade-run']);
  const prior = sessionOf('lester-blaster', grenade, 9);
  for (const [name, summary] of Object.entries(HMH.runs)) {
    const legacy = legacyIds(summary, prior).filter((id) => !PARITY_EXEMPT.has(id));
    const server = serverIds(summary, prior).filter((id) => !PARITY_EXEMPT.has(id));
    assert.deepEqual([...legacy].sort(), [...server].sort(), `${name}: same ids after nine runs`);
    assert.ok(server.includes('ten-paid-runs') && server.includes('grenade-century') && server.includes('enemy-reaper-500'), name);
  }
});

// The path the browser really takes: recordScore folds the run into HMH progress
// (updateProgressFromRun), then maybeUnlockRunAchievements resolves the unlocks.
function browserProfile() {
  const state = createInitialArcadeState();
  return (summary, override = null) => {
    const session = startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid' });
    const { score, runStats } = hmhRecordScoreInputsFromRunSummary(summary);
    return recordScore(state, session, score, override ? { ...runStats, ...override } : runStats).unlockedAchievements;
  };
}
// The settle server: derivation over verified history that grows run by run.
function serverProfile() {
  let prior = history('lester-blaster');
  return (summary) => {
    const stats = statsFromHmhRunSummary(summary);
    const earned = ids(deriveEarnedAchievements('lester-blaster', run('lester-blaster', stats), prior));
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
const comparable = (list) => list.filter((id) => !PARITY_EXEMPT.has(id)).sort();

test('device-local recordScore and server derivation unlock the same HMH ids run by run', () => {
  const summary = HMH.runs['boss-run'];
  const stats = statsFromHmhRunSummary(summary);
  const inputs = hmhRecordScoreInputsFromRunSummary(summary);
  assert.deepEqual(Object.keys(inputs), ['score', 'runStats']);
  assert.equal(inputs.score, stats.score);
  assert.deepEqual(inputs.runStats, {
    ...hmhResolverInputsFromRunSummary(summary),
    elapsedSeconds: stats.survivalSeconds, kills: stats.kills, powerUpsCollected: stats.powerUpsCollected, damageDealt: stats.damageDealt,
  });

  const sequences = [
    ...Object.keys(HMH.runs).map((name) => [name]),
    ...Object.keys(HMH.runs).map((name) => [...Array(9).fill('grenade-run'), name]),
    ['short-run', 'short-run', 'grenade-run', 'boss-run', 'untouched-run', 'short-run', 'grenade-run'],
  ];
  for (const sequence of sequences) {
    const browser = browserProfile();
    const server = serverProfile();
    sequence.forEach((name, index) => {
      const local = browser(HMH.runs[name]);
      const remote = server(HMH.runs[name]);
      assert.deepEqual(comparable(local), comparable(remote), `${sequence.slice(0, index + 1).join(' > ')}`);
    });
  }

  // The regression the double count caused: one short run has 38 goblin-family
  // kills, below the 75 of goblin-cleanup; the second one crosses it on both sides.
  const browser = browserProfile();
  const server = serverProfile();
  assert.equal(statsFromHmhRunSummary(HMH.runs['short-run']).familyKills.goblin, 38);
  assert.ok(!browser(HMH.runs['short-run']).includes('goblin-cleanup') && !server(HMH.runs['short-run']).includes('goblin-cleanup'));
  assert.ok(browser(HMH.runs['short-run']).includes('goblin-cleanup') && server(HMH.runs['short-run']).includes('goblin-cleanup'));
  assert.equal(statsFromHmhRunSummary(HMH.runs['grenade-run']).familyKills.drone, 32);
  assert.ok(!browserProfile()(HMH.runs['grenade-run']).includes('drone-swatter'), '32 drone-family kills stay below 60');

  // The canonical weapons and damage reach the resolver through recordScore.
  const bossUnlocks = browserProfile()(summary);
  for (const id of ['hash-rail-specialist', 'spread-ltc-specialist', 'weapon-collector', 'damage-chain', 'getaway-clear', 'master-survivor']) {
    assert.ok(bossUnlocks.includes(id), `boss-run unlocks ${id} on the device`);
  }
  const spread = browserProfile()(HMH.runs['short-run'], { weaponIds: ['scatter-shotgun'], damageDealt: HMH_DAMAGE_CHAIN_DAMAGE });
  assert.ok(spread.includes('spread-ltc-specialist') && spread.includes('damage-chain'));
  const short = browserProfile()(HMH.runs['short-run'], { weaponIds: ['coin-blaster'], damageDealt: HMH_DAMAGE_CHAIN_DAMAGE - 1 });
  assert.ok(!short.includes('spread-ltc-specialist') && !short.includes('damage-chain'));

  // weapon-collector counts one run's weapons, as the server does, not weapons across runs.
  const collector = browserProfile();
  assert.ok(!collector(HMH.runs['short-run'], { weaponIds: ['coin-blaster', 'hash-rail'] }).includes('weapon-collector'));
  assert.ok(!collector(HMH.runs['short-run'], { weaponIds: ['litecoin-knife', 'scatter-shotgun'] }).includes('weapon-collector'));
  for (const weaponId of ['auto-miner', 'hash-rail', 'coin-blaster']) {
    assert.ok(!collector(HMH.runs['short-run'], { weaponIds: [], weaponId }).includes('weapon-collector'), `legacy weaponId ${weaponId}, one per run`);
  }
  assert.ok(collector(HMH.runs['short-run'], { weaponIds: ['coin-blaster', 'hash-rail'], weaponId: 'auto-miner' }).includes('weapon-collector'));

  // The legacy call shape (enemyKillsByType without a summary) no longer counts the run twice either.
  const state = createInitialArcadeState();
  const legacyRun = () => recordScore(state, startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid' }), 900, { elapsedSeconds: 60, kills: 40, enemyKillsByType: { 'fud-goblin': 40 } }).unlockedAchievements;
  assert.ok(!legacyRun().includes('goblin-cleanup'), '40 goblin kills');
  assert.ok(legacyRun().includes('goblin-cleanup'), '80 goblin kills');
  assert.equal(state.profiles[WALLET].progress['lester-blaster'].enemyKillsByType['fud-goblin'], 80);
});

test('HMH NFT candidates are only server-counted run totals', () => {
  const nft = nftAchievementIds('lester-blaster').map((id) => achievementById('lester-blaster', id));
  assert.deepEqual(nft.map((entry) => [entry.id, entry.tier]), [['two-hundred-ranked-runs', 'mythic'], ['two-fifty-ranked-runs', 'mythic'], ['arcade-legend-500', 'mythic']]);
  const empty = run('lester-blaster', {});
  const huge = run('lester-blaster', { ...hmhRun('boss-run').stats, kills: 1e9, survivalSeconds: 1e9, noDamage: 1, perfectBossKill: 1 });
  for (const entry of nft) {
    const target = entry.progress(null, history('lester-blaster')).target;
    for (const runs of [0, target - 2, target - 1, target, target + 5]) {
      const prior = history('lester-blaster', { runs, sums: { kills: 1e9, survivalSeconds: 1e9 } });
      assert.equal(entry.criteria(empty, prior), runs + 1 >= target, `${entry.id} at ${runs} earlier runs`);
      assert.equal(entry.criteria(huge, history('lester-blaster', { runs })), runs + 1 >= target, `${entry.id} ignores the run's claimed stats`);
    }
  }
  // Achievement ids hash like every other on-chain id (keccak256 of the UTF-8 string).
  assert.equal(achievementId32(ethers, 'arcade-legend-500'), ethers.keccak256(ethers.toUtf8Bytes('arcade-legend-500')));
  assert.throws(() => achievementId32(ethers, ''), /non-empty/);
});
