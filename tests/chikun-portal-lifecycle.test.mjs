import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildChikunReplayClaim,
  simulateChikunRun,
} from '../apps/portal/src/chikun-cabinet.mjs';
import {
  createInitialArcadeState,
  recordScore,
  startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';
import { createChikunPortalLifecycle } from '../apps/portal/src/chikun-portal-lifecycle.mjs';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

function session(mode, sequence) {
  return startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode,
    urlSessionId: `game-session-${String(sequence).padStart(9, '0')}`,
    sequenceNumber: sequence,
    sessionNonce: `lifecycle-${sequence}`,
  });
}

function resultPayload(playSession) {
  const result = simulateChikunRun({
    seed: playSession.seed,
    taps: [1, 18, 42, 68, 94, 120, 146, 172, 198, 224, 250],
    maxTicks: 300,
  });
  return {
    ...result,
    replayClaim: buildChikunReplayClaim({
      buildHash: playSession.buildHash,
      seasonId: playSession.seasonId,
      result,
    }),
  };
}

test('Ranked lifecycle verifies once, records once, persists once, and exposes accepted profile data', () => {
  const state = createInitialArcadeState();
  const ranked = session('paid', 910);
  const calls = { record: 0, persist: 0, complete: 0 };
  const lifecycle = createChikunPortalLifecycle({
    state,
    session: ranked,
    recordScoreRef: (...args) => { calls.record += 1; return recordScore(...args); },
    persist: () => { calls.persist += 1; },
    onComplete: () => { calls.complete += 1; },
  });

  const first = lifecycle.handleResult(resultPayload(ranked));
  const duplicate = lifecycle.handleResult(resultPayload(ranked));

  assert.equal(first.ok, true);
  assert.equal(first.acceptedForGlobalLeaderboard, true);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'already-finalized');
  assert.deepEqual(calls, { record: 1, persist: 1, complete: 1 });
  assert.equal(state.leaderboards.chikun.length, 1);
  assert.equal(state.profiles[WALLET.toLowerCase()].progress.chikun.paidRuns, 1);
});

test('Free lifecycle verifies canonical evidence but never writes a ranked score or profile run', () => {
  const state = createInitialArcadeState();
  const free = session('free', 911);
  const calls = { record: 0, persist: 0 };
  const lifecycle = createChikunPortalLifecycle({
    state,
    session: free,
    recordScoreRef: () => { calls.record += 1; throw new Error('must not write'); },
    persist: () => { calls.persist += 1; },
  });

  const final = lifecycle.handleResult(resultPayload(free));
  assert.equal(final.ok, true);
  assert.equal(final.acceptedForGlobalLeaderboard, false);
  assert.deepEqual(calls, { record: 0, persist: 0 });
  assert.equal(state.leaderboards.chikun.length, 0);
  assert.equal(state.profiles[WALLET.toLowerCase()], undefined);
});

test('tampered Ranked evidence fails closed before profile or leaderboard mutation', () => {
  const state = createInitialArcadeState();
  const ranked = session('paid', 912);
  const lifecycle = createChikunPortalLifecycle({ state, session: ranked, recordScoreRef: recordScore });
  const tampered = resultPayload(ranked);
  tampered.score += 999;

  const failed = lifecycle.handleResult(tampered);
  assert.equal(failed.ok, false);
  assert.match(failed.reason, /score.*canonical replay|verification/i);
  assert.equal(state.leaderboards.chikun.length, 0);
  assert.equal(state.profiles[WALLET.toLowerCase()], undefined);
});
