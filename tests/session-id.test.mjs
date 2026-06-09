import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatUrlSessionId,
  nextGlobalSessionId,
  createInitialArcadeState,
  getSessionByUrlId,
} from '../apps/portal/src/arcade-core.mjs';

test('formatUrlSessionId zero-pads to the game-session-NNNNNNNNN handle', () => {
  assert.equal(formatUrlSessionId(1), 'game-session-000000001');
  assert.equal(formatUrlSessionId(42), 'game-session-000000042');
  assert.equal(formatUrlSessionId(123456789), 'game-session-123456789');
  // Defensive: non-numbers and negatives clamp to 0.
  assert.equal(formatUrlSessionId(0), 'game-session-000000000');
  assert.equal(formatUrlSessionId(-5), 'game-session-000000000');
  assert.equal(formatUrlSessionId('7'), 'game-session-000000007');
  // Numbers beyond 9 digits are not truncated.
  assert.equal(formatUrlSessionId(1234567890), 'game-session-1234567890');
});

test('nextGlobalSessionId increments monotonically across the whole arcade', () => {
  const state = createInitialArcadeState();
  assert.equal(state.globalSessionSequence, 0);
  const a = nextGlobalSessionId(state);
  const b = nextGlobalSessionId(state);
  const c = nextGlobalSessionId(state);
  assert.deepEqual([a.sequence, b.sequence, c.sequence], [1, 2, 3]);
  assert.equal(a.urlSessionId, 'game-session-000000001');
  assert.equal(c.urlSessionId, 'game-session-000000003');
  assert.equal(state.globalSessionSequence, 3);
});

test('nextGlobalSessionId requires state', () => {
  assert.throws(() => nextGlobalSessionId(null), /state is required/);
});

test('getSessionByUrlId pulls a recorded session by its public handle', () => {
  const state = createInitialArcadeState();
  // Simulate a recorded official session (as recordScore would store it).
  const rec = {
    sessionId: 'lester-blaster-paid-abc',
    urlSessionId: 'game-session-000000001',
    sequenceNumber: 1,
    gameId: 'hard-money-heroes',
    score: 9001,
    runStats: { kills: 120, timeSurvived: 305 },
  };
  state.officialSessions.push(rec);
  state.sessionsByUrlId['game-session-000000001'] = rec;

  const found = getSessionByUrlId(state, 'game-session-000000001');
  assert.equal(found?.score, 9001);
  assert.equal(found?.runStats.kills, 120);
  assert.equal(getSessionByUrlId(state, 'game-session-999999999'), null);
  assert.equal(getSessionByUrlId(state, null), null);
});

test('getSessionByUrlId falls back to linear scan when index is absent', () => {
  const state = createInitialArcadeState();
  const rec = { sessionId: 's1', urlSessionId: 'game-session-000000007', score: 5 };
  state.officialSessions.push(rec);
  // Intentionally do NOT populate sessionsByUrlId.
  delete state.sessionsByUrlId;
  assert.equal(getSessionByUrlId(state, 'game-session-000000007')?.score, 5);
});

test('initial arcade state carries the global session counter + url index', () => {
  const state = createInitialArcadeState();
  assert.equal(state.globalSessionSequence, 0);
  assert.deepEqual(state.sessionsByUrlId, {});
});
