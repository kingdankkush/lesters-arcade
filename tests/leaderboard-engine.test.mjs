import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEADERBOARD_CADENCES,
  periodKeyFor,
  periodKeys,
  recordCadenceScore,
  getLeaderboard,
  getAllCadenceLeaderboards,
} from '../apps/portal/src/leaderboard-engine.mjs';

const GAME = 'lester-blaster';
const W1 = '0x' + '1'.repeat(40);
const W2 = '0x' + '2'.repeat(40);
const W3 = '0x' + '3'.repeat(40);

test('exposes the five required cadences', () => {
  assert.deepEqual([...LEADERBOARD_CADENCES], ['daily', 'weekly', 'monthly', 'yearly', 'all-time']);
});

test('period keys derive correctly per cadence (UTC)', () => {
  const d = '2026-03-15T12:00:00.000Z'; // Sunday
  assert.equal(periodKeyFor('daily', d), '2026-03-15');
  assert.equal(periodKeyFor('monthly', d), '2026-03');
  assert.equal(periodKeyFor('yearly', d), '2026');
  assert.equal(periodKeyFor('all-time', d), 'all-time');
  assert.match(periodKeyFor('weekly', d), /^2026-W\d{2}$/);
});

test('a recorded run files into all five buckets', () => {
  const state = {};
  const keys = recordCadenceScore(state, GAME, { wallet: W1, score: 500, recordedAt: '2026-03-15T12:00:00Z' });
  assert.equal(Object.keys(keys).length, 5);
  for (const cadence of LEADERBOARD_CADENCES) {
    const board = getLeaderboard(state, GAME, cadence, { now: '2026-03-15T13:00:00Z' });
    assert.equal(board.topEntries.length, 1);
    assert.equal(board.topEntries[0].score, 500);
  }
});

test('daily board only shows scores from the current day', () => {
  const state = {};
  recordCadenceScore(state, GAME, { wallet: W1, score: 100, recordedAt: '2026-03-14T10:00:00Z' });
  recordCadenceScore(state, GAME, { wallet: W2, score: 900, recordedAt: '2026-03-15T10:00:00Z' });

  const today = getLeaderboard(state, GAME, 'daily', { now: '2026-03-15T20:00:00Z' });
  assert.equal(today.topEntries.length, 1);
  assert.equal(today.topEntries[0].score, 900);

  // all-time sees both
  const allTime = getLeaderboard(state, GAME, 'all-time', { now: '2026-03-15T20:00:00Z' });
  assert.equal(allTime.topEntries.length, 2);
  assert.equal(allTime.topEntries[0].score, 900);
  assert.equal(allTime.topEntries[1].score, 100);
});

test('entries are ranked high-to-low with rank numbers', () => {
  const state = {};
  const t = '2026-03-15T10:00:00Z';
  recordCadenceScore(state, GAME, { wallet: W1, score: 300, recordedAt: t });
  recordCadenceScore(state, GAME, { wallet: W2, score: 700, recordedAt: t });
  recordCadenceScore(state, GAME, { wallet: W3, score: 500, recordedAt: t });
  const board = getLeaderboard(state, GAME, 'all-time', { now: t });
  assert.deepEqual(board.topEntries.map((e) => e.rank), [1, 2, 3]);
  assert.deepEqual(board.topEntries.map((e) => e.score), [700, 500, 300]);
});

test('display name resolves via callback; current player highlighted', () => {
  const state = {};
  const t = '2026-03-15T10:00:00Z';
  recordCadenceScore(state, GAME, { wallet: W1, score: 300, recordedAt: t });
  recordCadenceScore(state, GAME, { wallet: W2, score: 700, recordedAt: t });
  const names = { [W1]: 'Alice', [W2]: 'Bob' };
  const board = getLeaderboard(state, GAME, 'all-time', {
    now: t, wallet: W1, displayNameFor: (w) => names[w] ?? w,
  });
  assert.equal(board.topEntries[0].displayName, 'Bob');
  assert.equal(board.topEntries[1].displayName, 'Alice');
  assert.equal(board.topEntries[1].isCurrentPlayer, true);
  assert.equal(board.playerRank, 2);
  assert.equal(board.playerEntry.score, 300);
});

test('getAllCadenceLeaderboards returns one board per cadence', () => {
  const state = {};
  recordCadenceScore(state, GAME, { wallet: W1, score: 100, recordedAt: '2026-03-15T10:00:00Z' });
  const boards = getAllCadenceLeaderboards(state, GAME, { now: '2026-03-15T11:00:00Z' });
  assert.equal(boards.length, 5);
  assert.deepEqual(boards.map((b) => b.cadence), [...LEADERBOARD_CADENCES]);
});

test('invalid cadence throws', () => {
  assert.throws(() => periodKeyFor('hourly', Date.now()));
  assert.throws(() => getLeaderboard({}, GAME, 'hourly'));
});
