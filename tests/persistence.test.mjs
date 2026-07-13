import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARCADE_PERSIST_KEY,
  ARCADE_PERSIST_VERSION,
  RUN_HISTORY_LIMIT,
  snapshotArcadeState,
  restoreArcadeState,
  saveArcadeState,
  loadArcadeState,
  appendRunRecord,
  saveActiveSessionCheckpoint,
  clearActiveSessionCheckpoint,
  isSessionSubmitted,
} from '../apps/portal/src/persistence.mjs';
import { createInitialArcadeState, connectPlayerAccount, setArcadeUsername } from '../apps/portal/src/arcade-core.mjs';
import { recordCadenceScore } from '../apps/portal/src/leaderboard-engine.mjs';

const WALLET = '0x' + 'a'.repeat(40);

// In-memory localStorage mock with optional simulated quota.
function makeStorage({ quotaBytes = Infinity } = {}) {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) {
      if (String(value).length > quotaBytes) throw new Error('QuotaExceededError');
      store.set(key, String(value));
    },
    removeItem(key) { store.delete(key); },
    _store: store,
  };
}

test('snapshot + restore round-trips profiles, usernames, leaderboards, and run history', () => {
  const state = createInitialArcadeState();
  connectPlayerAccount(state, WALLET, { handle: 'Tester' });
  setArcadeUsername(state, WALLET, 'HardMoneyHero');
  recordCadenceScore(state, 'lester-blaster', { wallet: WALLET, score: 9000 });
  appendRunRecord(state, { gameId: 'lester-blaster', wallet: WALLET, score: 9000, elapsedSeconds: 240 });
  state.__seededLeaderboard = true;

  const snapshot = snapshotArcadeState(state);
  assert.equal(snapshot.version, ARCADE_PERSIST_VERSION);
  assert.equal(snapshot.seeded, true);

  const fresh = createInitialArcadeState();
  const restored = restoreArcadeState(fresh, snapshot);
  assert.equal(restored, true);
  assert.equal(fresh.profiles[WALLET].handle, 'HardMoneyHero');
  assert.equal(fresh.profiles[WALLET].usernameSet, true);
  assert.equal(fresh.__seededLeaderboard, true);
  assert.equal(fresh.runHistory.length, 1);
  assert.equal(fresh.runHistory[0].score, 9000);
  const buckets = fresh.cadenceLeaderboards['lester-blaster']['all-time']['all-time'];
  assert.equal(buckets.some((row) => row.wallet === WALLET && row.score === 9000), true);
});

test('save + load through a storage backend works end to end', () => {
  const state = createInitialArcadeState();
  connectPlayerAccount(state, WALLET, { handle: 'Saver' });
  const storage = makeStorage();
  const result = saveArcadeState(state, storage);
  assert.equal(result.ok, true);
  assert.equal(result.dropped.length, 0);
  assert.equal(storage._store.has(ARCADE_PERSIST_KEY), true);

  const fresh = createInitialArcadeState();
  assert.equal(loadArcadeState(fresh, storage), true);
  assert.equal(Boolean(fresh.profiles[WALLET]), true);
});

test('quota pressure degrades gracefully: avatars are dropped before failing', () => {
  const state = createInitialArcadeState();
  connectPlayerAccount(state, WALLET, { handle: 'BigAvatar' });
  // A fat avatar payload that busts the simulated quota on the full snapshot.
  state.profiles[WALLET].avatarDataUrl = 'data:image/png;base64,' + 'x'.repeat(8000);
  const storage = makeStorage({ quotaBytes: 6000 });
  const result = saveArcadeState(state, storage);
  assert.equal(result.ok, true);
  assert.equal(result.dropped.includes('avatars'), true);
  const fresh = createInitialArcadeState();
  loadArcadeState(fresh, storage);
  assert.equal(fresh.profiles[WALLET].avatarDataUrl, undefined);
  assert.equal(fresh.profiles[WALLET].handle, 'BigAvatar');
});

test('corrupt saves are cleared and ignored instead of crashing', () => {
  const storage = makeStorage();
  storage.setItem(ARCADE_PERSIST_KEY, '{not json!!!');
  const state = createInitialArcadeState();
  assert.equal(loadArcadeState(state, storage), false);
  assert.equal(storage.getItem(ARCADE_PERSIST_KEY), null);
});

test('unknown snapshot versions are ignored (fresh start beats crash loop)', () => {
  const state = createInitialArcadeState();
  assert.equal(restoreArcadeState(state, { version: 999, profiles: { [WALLET]: { handle: 'Future' } } }), false);
  assert.equal(state.profiles[WALLET], undefined);
});

test('run history is newest-first and capped', () => {
  const state = createInitialArcadeState();
  for (let i = 0; i < RUN_HISTORY_LIMIT + 10; i += 1) {
    appendRunRecord(state, { gameId: 'lester-blaster', wallet: WALLET, score: i });
  }
  assert.equal(state.runHistory.length, RUN_HISTORY_LIMIT);
  assert.equal(state.runHistory[0].score, RUN_HISTORY_LIMIT + 9);
});

test('missing storage backend is a no-op, not a crash', () => {
  const state = createInitialArcadeState();
  assert.equal(saveArcadeState(state, null).ok, false);
  assert.equal(loadArcadeState(state, null), false);
});

test('active ranked-session checkpoints survive save and restore', () => {
  const state = createInitialArcadeState();
  const checkpoint = saveActiveSessionCheckpoint(state, {
    sessionId: 'game-session-123e4567-e89b-42d3-a456-426614174000',
    stepIndex: 420,
    inputHash: `0x${'1'.repeat(64)}`,
    eventHash: `0x${'2'.repeat(64)}`,
    stateHash: `0x${'3'.repeat(64)}`,
    score: 9000,
    kills: 44,
    survivalSeconds: 240,
  });
  assert.equal(checkpoint.status, 'active');

  const snapshot = snapshotArcadeState(state);
  const fresh = createInitialArcadeState();
  assert.equal(restoreArcadeState(fresh, snapshot), true);
  assert.equal(fresh.activeSessionCheckpoint.sessionId, checkpoint.sessionId);
  assert.equal(fresh.activeSessionCheckpoint.stepIndex, 420);
});

test('submitted sessions are idempotent and clear matching crash checkpoints', () => {
  const state = createInitialArcadeState();
  const sessionId = 'game-session-123e4567-e89b-42d3-a456-426614174000';
  saveActiveSessionCheckpoint(state, { sessionId, stepIndex: 10 });
  assert.equal(clearActiveSessionCheckpoint(state, sessionId, { submitted: true }), true);
  assert.equal(state.activeSessionCheckpoint, null);
  assert.equal(isSessionSubmitted(state, sessionId), true);
  assert.equal(clearActiveSessionCheckpoint(state, sessionId, { submitted: true }), false);

  const snapshot = snapshotArcadeState(state);
  const fresh = createInitialArcadeState();
  restoreArcadeState(fresh, snapshot);
  assert.equal(isSessionSubmitted(fresh, sessionId), true);
});

test('v1 persistence snapshots migrate without canonical session fields', () => {
  const state = createInitialArcadeState();
  assert.equal(restoreArcadeState(state, { version: 1, profiles: {}, usernames: {}, runHistory: [] }), true);
  assert.equal(state.activeSessionCheckpoint, null);
  assert.deepEqual(state.submittedSessionIds, []);
});
