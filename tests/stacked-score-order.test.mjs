import test from 'node:test';
import assert from 'node:assert/strict';
import { recordCadenceScore, getLeaderboard } from '../apps/portal/src/leaderboard-engine.mjs';
test('STACKED tie-breaks apply both to storage and best-per-wallet selection', () => {
  const state = {}, date = '2026-09-12T00:00:00Z';
  const add = (wallet, lines, ticks, quads, minute) => recordCadenceScore(state, 'stacked', {
    wallet, score: 100, sessionId: wallet + minute, recordedAt: date.replace('00:00:', '00:' + String(minute).padStart(2, '0') + ':'),
    runStats: { linesCleared: lines, survivalTicks: ticks, quadClears: quads },
  });
  add('a', 1, 100, 0, 0); add('a', 2, 100, 0, 1);
  add('b', 2, 200, 0, 2); add('c', 2, 200, 1, 3); add('d', 2, 200, 1, 4);
  const board = getLeaderboard(state, 'stacked', 'all-time');
  assert.deepEqual(board.topEntries.map(r => r.wallet), ['c', 'd', 'b', 'a']);
  assert.equal(board.topEntries[3].runStats.linesCleared, 2);
  assert.equal(state.cadenceLeaderboards.stacked['all-time']['all-time'][0].wallet, 'c');
});
test('other cabinets retain earlier-run ties', () => {
  const state = {};
  for (const [wallet, time, lines] of [['a', '2026-01-01', 0], ['b', '2026-02-01', 900]]) recordCadenceScore(state, 'chikun-escape', {wallet, score: 10, recordedAt: time, runStats:{linesCleared: lines}});
  assert.equal(getLeaderboard(state, 'chikun-escape', 'all-time').topEntries[0].wallet, 'a');
});
