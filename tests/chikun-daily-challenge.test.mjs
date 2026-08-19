import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHIKUN_DAILY_CHALLENGE_VERSION,
  bindChikunDailyChallenge,
  buildChikunDailyChallenge,
  buildChikunGhostTrack,
  chikunDailyChallengeForSeed,
  compareChikunGhost,
  createChikunGhostRecord,
  deriveChikunDailySeed,
  ghostYAt,
  matchesChikunDailyChallenge,
  readChikunGhostRecord,
  selectChikunGhostRecord,
  utcDayKey,
  writeChikunGhostRecord,
} from '../apps/portal/src/chikun-daily-challenge.mjs';
import {
  buildChikunReplayClaim,
  simulateChikunRun,
  verifyChikunReplayClaim,
} from '../apps/portal/src/chikun-cabinet.mjs';
import { startPlaySession } from '../apps/portal/src/arcade-core.mjs';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const DAY = '2026-08-17T15:26:01.000Z';
const NEXT_DAY = '2026-08-18T00:00:00.000Z';
const BEFORE_MIDNIGHT = '2026-08-17T23:59:59.999Z';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(String(key), String(value)); },
  };
}

test('UTC day key and daily seed are stable inside a day and change at the UTC boundary', () => {
  assert.equal(utcDayKey(DAY), '2026-08-17');
  assert.equal(utcDayKey(BEFORE_MIDNIGHT), '2026-08-17');
  assert.equal(utcDayKey(NEXT_DAY), '2026-08-18');

  const morning = buildChikunDailyChallenge({ now: Date.parse(DAY) });
  const night = buildChikunDailyChallenge({ now: Date.parse(BEFORE_MIDNIGHT) });
  const next = buildChikunDailyChallenge({ now: Date.parse(NEXT_DAY) });

  assert.equal(morning.version, CHIKUN_DAILY_CHALLENGE_VERSION);
  assert.equal(morning.dayKey, '2026-08-17');
  assert.equal(morning.seed, deriveChikunDailySeed('2026-08-17'));
  assert.equal(morning.seed, 713_180_973);
  assert.equal(morning.seed, night.seed);
  assert.notEqual(morning.seed, next.seed);
  assert.equal(morning.label, 'Daily 2026-08-17');
  assert.equal(Object.isFrozen(morning), true);
});

test('same-day Free sessions bind to the parent daily seed; Ranked stays unique', () => {
  const first = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'free',
    sessionNonce: 'free-a',
  });
  const second = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'free',
    sessionNonce: 'free-b',
  });
  assert.notEqual(first.seed, second.seed);

  const boundA = bindChikunDailyChallenge(first, { now: Date.parse(DAY) });
  const boundB = bindChikunDailyChallenge(second, { now: Date.parse(DAY) });
  const expected = deriveChikunDailySeed('2026-08-17');

  assert.equal(boundA.seed, expected);
  assert.equal(boundB.seed, expected);
  assert.equal(boundA.sessionId, first.sessionId);
  assert.equal(boundA.canonicalContext.seed, expected);
  assert.equal(boundA.dailyChallenge.dayKey, '2026-08-17');
  assert.equal(first.seed !== expected, true, 'bind must not mutate the original session');
  assert.equal(matchesChikunDailyChallenge(boundA.seed, Date.parse(DAY)), true);
  assert.equal(chikunDailyChallengeForSeed(boundA.seed, { now: Date.parse(DAY) }).dayKey, '2026-08-17');

  const ranked = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'paid',
    urlSessionId: 'game-session-000000077',
    sequenceNumber: 77,
    sessionNonce: 'ranked-a',
    allowDevCabinet: true,
  });
  const rankedBound = bindChikunDailyChallenge(ranked, { now: Date.parse(DAY) });
  assert.equal(rankedBound.seed, ranked.seed);
  assert.equal(rankedBound.dailyChallenge, null);
  assert.notEqual(ranked.seed, expected);
});

test('daily-bound Free replay still verifies against the bound seed', () => {
  const session = bindChikunDailyChallenge(startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'free',
    sessionNonce: 'daily-verify',
  }), { now: Date.parse(DAY) });
  const result = simulateChikunRun({ seed: session.seed, taps: [3, 18, 42, 70], maxTicks: 120 });
  const replayClaim = buildChikunReplayClaim({
    buildHash: session.buildHash,
    seasonId: session.seasonId,
    result,
  });
  const verified = verifyChikunReplayClaim({
    expectedSeed: session.seed,
    expectedBuildHash: session.buildHash,
    expectedSeasonId: session.seasonId,
    score: result.score,
    runStats: {
      survivalTime: result.survivalTime,
      survivalTicks: result.survivalTicks,
      coinsCollected: result.coinsCollected,
      forksPassed: result.forksPassed,
      nearMisses: result.nearMisses,
      bestCombo: result.bestCombo,
      achievements: result.achievements,
    },
    replayClaim,
  });
  assert.equal(verified.seed, session.seed);
  assert.equal(verified.score, result.score);
});

test('ghost track is projection-only, same-seed comparable, and storage keeps the better flight', () => {
  const seed = deriveChikunDailySeed('2026-08-17');
  const weak = simulateChikunRun({ seed, taps: [], maxTicks: 20 });
  const strong = simulateChikunRun({ seed, taps: [4, 40], maxTicks: 180 });
  const other = simulateChikunRun({ seed: seed ^ 1, taps: [], maxTicks: 20 });

  const weakTrack = buildChikunGhostTrack(weak.evidence);
  assert.equal(weakTrack.seed, seed);
  assert.equal(weakTrack.score, weak.score);
  assert.ok(weakTrack.samples.length >= 2);
  assert.ok(weakTrack.samples.length <= 720);
  assert.equal(ghostYAt(weakTrack, 0), weakTrack.samples[0].y);
  assert.equal(ghostYAt(weakTrack, weakTrack.terminalTick + 1), null);
  assert.equal(Number.isFinite(ghostYAt(weakTrack, Math.floor(weakTrack.terminalTick / 2))), true);

  const comparison = compareChikunGhost({ run: strong, ghost: weak });
  assert.equal(comparison.beatGhost, true);
  assert.ok(comparison.scoreDelta > 0);
  assert.throws(() => compareChikunGhost({ run: strong, ghost: other }), /same seed/);

  const storage = memoryStorage();
  const weakRecord = createChikunGhostRecord(weak);
  const strongRecord = createChikunGhostRecord(strong);
  writeChikunGhostRecord(storage, strongRecord);
  writeChikunGhostRecord(storage, weakRecord);
  const kept = readChikunGhostRecord(storage, seed);
  assert.equal(kept.score, strong.score);
  assert.equal(kept.survivalTicks, strong.survivalTicks);
  assert.equal(selectChikunGhostRecord(strongRecord, weakRecord), strongRecord);
});
