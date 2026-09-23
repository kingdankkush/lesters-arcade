import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { applySettlement, createInitialArcadeState, recordScore, startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { recordCadenceScore } from '../apps/portal/src/leaderboard-engine.mjs';
import { RANKED_GAMES } from '../apps/portal/src/ranked-identity.mjs';
import { snapshotArcadeState } from '../apps/portal/src/persistence.mjs';
import { portalFunctionSource } from './helpers/ranked-client-vm.mjs';

const WALLET = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const KEY = `0x${'5e'.repeat(32)}`;
const TX = `0x${'7a'.repeat(32)}`;

// The shipped merger, run with only the names its VM test whitelists.
function merger(state) {
  return vm.runInNewContext(`(${portalFunctionSource('mergeChainRecordIntoState')})`, { state, recordCadenceScore });
}

const chainRecord = (overrides = {}) => ({
  sessionId32: KEY, gameId32: `0x${'cd'.repeat(32)}`, player: WALLET, score: 1234, kills: 7, maxCombo: 3, survivalSeconds: 90,
  submittedAt: 1_790_000_000, verified: true, onChain: true, ...overrides,
});

function settledState() {
  const state = createInitialArcadeState();
  const session = startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(state, session, 1234, { kills: 7, elapsedSeconds: 90, maxCombo: 3 });
  applySettlement(state, {
    mode: 'live', settled: true, relayed: true, wallet: WALLET, gameId: 'lester-blaster', sessionId: session.sessionId, score: 1234,
    onChainSessionId32: KEY.toUpperCase().replace('0X', '0x'), receipts: [{ txHash: TX }], primaryTxHash: TX, settledAt: '2026-09-23T00:00:00.000Z',
  });
  return { state, session };
}

test('applySettlement stamps the session key on the flat, cadence and official rows', () => {
  const { state, session } = settledState();
  const flat = state.leaderboards['lester-blaster'].find((row) => row.sessionId === session.sessionId);
  assert.equal(flat.onChainSessionId32, KEY);
  assert.equal(flat.settlementTxHash, TX);
  const cadence = Object.values(state.cadenceLeaderboards['lester-blaster']).flatMap((periods) => Object.values(periods)).flat()
    .filter((row) => row.sessionId === session.sessionId);
  assert.ok(cadence.length > 0);
  assert.ok(cadence.every((row) => row.onChainSessionId32 === KEY));
  assert.equal(state.officialSessions.find((row) => row.sessionId === session.sessionId).onChainSessionId32, KEY);
  assert.equal(state.sessions[session.sessionId].onChainSessionId32, KEY);
  // A settlement without a key (older callers) stamps nothing new.
  const other = createInitialArcadeState();
  const plain = startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid' });
  recordScore(other, plain, 10, {});
  applySettlement(other, { sessionId: plain.sessionId, gameId: 'lester-blaster', primaryTxHash: TX });
  assert.equal(other.leaderboards['lester-blaster'][0].onChainSessionId32, undefined);
});

test('a settled local row and its chain record appear once', () => {
  const { state } = settledState();
  const flatBefore = state.leaderboards['lester-blaster'].length;
  const officialBefore = state.officialSessions.length;
  const merge = merger(state);
  assert.equal(merge(chainRecord(), 'lester-blaster'), false, 'the chain copy of the settled run is skipped');
  assert.equal(merge(chainRecord({ sessionId32: KEY.toUpperCase().replace('0X', '0x') }), 'lester-blaster'), false, 'whatever the hex case');
  assert.equal(state.leaderboards['lester-blaster'].length, flatBefore);
  assert.equal(state.officialSessions.length, officialBefore);
  assert.equal(state.leaderboards['lester-blaster'].filter((row) => row.onChainSessionId32 === KEY).length, 1);
  // Another session still merges.
  assert.equal(merge(chainRecord({ sessionId32: `0x${'6f'.repeat(32)}` }), 'lester-blaster'), true);
});

test('the dedup survives a reload, which keeps only the cadence boards', () => {
  const { state } = settledState();
  const reloaded = JSON.parse(JSON.stringify(snapshotArcadeState(state)));
  assert.equal(reloaded.leaderboards, undefined, 'persistence stores the cadence boards, not the flat board or official rows');
  const restored = { cadenceLeaderboards: reloaded.cadenceLeaderboards };
  assert.equal(merger(restored)(chainRecord(), 'lester-blaster'), false, 'the stamped cadence row alone keeps the chain copy out');
  const flatOnly = { leaderboards: JSON.parse(JSON.stringify(state.leaderboards)) };
  assert.equal(merger(flatOnly)(chainRecord(), 'lester-blaster'), false, 'as does the stamped flat-board row');
});

// Chikun's runtime id is checked with a verified replay claim in
// tests/chikun-portal-lifecycle.test.mjs; STACKED never goes through recordScore.
test('recordScore settlement input carries the registry runtime id', () => {
  const state = createInitialArcadeState();
  const session = startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid' });
  const result = recordScore(state, session, 50, { kills: 1, elapsedSeconds: 10 });
  assert.equal(result.settlementInput.runtimeId, RANKED_GAMES['lester-blaster'].runtimeId);
  assert.equal(result.settlementInput.seasonId, RANKED_GAMES['lester-blaster'].seasonId);
});
