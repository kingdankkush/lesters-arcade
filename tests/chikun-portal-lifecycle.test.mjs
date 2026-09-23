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

test('Free retries verify a fresh result while duplicate results and Ranked resets stay closed',()=>{
 const state=createInitialArcadeState(),free=session('free',914),ranked=session('paid',915);
 const lifecycle=createChikunPortalLifecycle({state,session:free,recordScoreRef:()=>{throw new Error('practice never writes');}});
 const payload=resultPayload(free);
 assert.equal(lifecycle.handleResult(payload).ok,true);
 assert.equal(lifecycle.handleResult(payload).reason,'already-finalized');
 assert.equal(lifecycle.beginPracticeRun(),true);
 assert.equal(lifecycle.handleResult(payload).ok,true);
 assert.equal(state.leaderboards.chikun.length,0);
 const locked=createChikunPortalLifecycle({state,session:ranked,recordScoreRef:recordScore});
 locked.handleResult(resultPayload(ranked));
 assert.equal(locked.beginPracticeRun(),false);
 assert.equal(locked.handleResult(resultPayload(ranked)).reason,'already-finalized');
});

test('ranked result carries settlementInput and verified v6 evidence', () => {
  const state = createInitialArcadeState();
  const ranked = session('paid', 920);
  const payload = resultPayload(ranked);
  const lifecycle = createChikunPortalLifecycle({ state, session: ranked, recordScoreRef: recordScore });
  const final = lifecycle.handleResult(payload);
  assert.equal(final.ok, true);
  assert.equal(final.evidence, payload.replayClaim.evidence, 'the evidence object the replay verified');
  assert.equal(final.evidence.version, 'chikun-flap-evidence-v6');
  assert.equal(final.evidence.seed, ranked.seed);
  assert.equal(final.settlementInput.sessionId, ranked.sessionId);
  assert.equal(final.settlementInput.gameId, 'chikun');
  assert.equal(final.settlementInput.score, final.canonical.score);
  assert.equal(final.settlementInput.seasonId, 'chikun-season-preview-1');
  assert.equal(final.settlementInput.runtimeId, 'chikun:canvas-runtime-v7', 'the registry runtime id (contract §2.2)');

  const free = session('free', 921);
  const practice = createChikunPortalLifecycle({ state, session: free, recordScoreRef: () => { throw new Error('practice never writes'); } }).handleResult(resultPayload(free));
  assert.equal(practice.ok, true);
  assert.equal(practice.settlementInput, null, 'Free runs never produce a settlement input');
});

test('no Hard Money Heroes achievement reaches a Chikun run at the portal', () => {
  const state = createInitialArcadeState();
  // A wallet with Hard Money Heroes history: its Ranked counters are the ones
  // the HMH resolver reads (first run, paid-run milestones, kill totals).
  const hmh = startPlaySession({ wallet: WALLET, gameId: 'lester-blaster', mode: 'paid', sessionNonce: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f' });
  const hmhRun = recordScore(state, hmh, 5000, { kills: 120, elapsedSeconds: 600, maxCombo: 30 });
  assert.ok(hmhRun.unlockedAchievements.length > 0, 'the fixture wallet does unlock HMH achievements on HMH runs');
  const profile = state.profiles[WALLET.toLowerCase()];
  profile.progress['lester-blaster'].paidRuns = 99; // one Ranked run away from the 100-run HMH milestone
  const before = [...profile.achievements];

  for (let index = 0; index < 3; index += 1) {
    const ranked = session('paid', 930 + index);
    const final = createChikunPortalLifecycle({ state, session: ranked, recordScoreRef: recordScore }).handleResult(resultPayload(ranked));
    assert.equal(final.ok, true);
    assert.deepEqual(final.settlementInput.unlockedAchievements, [], 'no HMH id in the Chikun settlement input');
  }
  assert.deepEqual(profile.achievements, before, 'Chikun runs unlock no HMH achievement');
  assert.equal(profile.progress.chikun.paidRuns, 3);
  assert.equal(profile.progress['lester-blaster'].paidRuns, 99, 'Chikun runs do not count toward HMH paid-run milestones');
});
