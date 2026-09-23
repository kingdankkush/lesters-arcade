import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHIKUN_EVIDENCE_VERSION,
  CHIKUN_MAX_FLAP_TRANSITIONS,
  buildChikunReplayClaim,
  createChikunRuntime,
  decodeFlapDeltas,
  encodeFlapDeltas,
  flapTicksOf,
  replayChikunRun,
  simulateChikunRun,
  verifyChikunReplayClaim,
} from '../apps/portal/src/chikun-cabinet.mjs';
import { GROUND_MAX_FLAPS } from '../apps/portal/src/chikun-ground-runtime.mjs';
import { createGroundRuntime as createFrozenV5Runtime, GROUND_EVIDENCE as FROZEN_V5_EVIDENCE } from '../apps/portal/src/chikun-ground-v5-runtime.mjs';
import * as frozenV5Course from '../apps/portal/src/chikun-ground-v5-course.mjs';
import { regionForObstacle, REGION_LOOP_SLOTS } from '../apps/portal/src/chikun-course-regions.mjs';
import { distanceAtTick, speedAtTick } from '../apps/portal/src/chikun-ground-course.mjs';
import { CHIKUN_MAX_MESSAGE_BYTES, createChikunBridgeEnvelope, validateChikunChildMessage } from '../apps/portal/src/chikun-bridge-protocol.mjs';
import { REPLAY_FILE_LIMIT, exportChikunReplay, importChikunReplay } from '../apps/chikun/src/replay-file.mjs';
import { routePilot } from '../scripts/chikun-course-pilot.mjs';
import { createInitialArcadeState, recordScore, startPlaySession } from '../apps/portal/src/arcade-core.mjs';
import { CHIKUN_GHOST_STORAGE_VERSION, buildChikunGhostTrack, createChikunGhostRecord, ghostYAt, readChikunGhostRecord } from '../apps/portal/src/chikun-daily-challenge.mjs';
import { createGuardedFrameLoop, finishRunSafely } from '../apps/chikun/src/frame-guard.mjs';

const v5Fixtures = JSON.parse(readFileSync(new URL('./fixtures/chikun-v5-replays.json', import.meta.url), 'utf8'));
const v6Fixtures = JSON.parse(readFileSync(new URL('./fixtures/chikun-v6-replays.json', import.meta.url), 'utf8'));
const harness = JSON.parse(readFileSync(new URL('../docs/qa/chikun-difficulty-harness-20260923.json', import.meta.url), 'utf8'));
const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

function driveFrozenV5(evidence) {
  const taps = new Set(evidence.flapSteps);
  const runtime = createFrozenV5Runtime({ seed: evidence.seed, maxTicks: evidence.maxTicks });
  while (!runtime.terminal) runtime.step({ flap: taps.has(runtime.snapshot().tick) });
  return runtime.result();
}

function resultPayload(result, replayClaim) {
  return {
    score: result.score,
    survivalTime: result.survivalTime,
    survivalTicks: result.survivalTicks,
    coinsCollected: result.coinsCollected,
    forksPassed: result.forksPassed,
    nearMisses: result.nearMisses,
    bestCombo: result.bestCombo,
    achievements: result.achievements,
    evidence: result.evidence,
    finalState: result.finalState,
    replayClaim,
  };
}

test('delta codec round-trips and rejects non-canonical input', () => {
  assert.equal(CHIKUN_MAX_FLAP_TRANSITIONS, 12_000);
  assert.equal(GROUND_MAX_FLAPS, CHIKUN_MAX_FLAP_TRANSITIONS);
  assert.deepEqual(encodeFlapDeltas([0, 4, 11, 18, 27]), [0, 4, 7, 7, 9]);
  assert.deepEqual(decodeFlapDeltas([0, 4, 7, 7, 9]), [0, 4, 11, 18, 27]);
  assert.deepEqual(encodeFlapDeltas([]), []);
  const ticks = Array.from({ length: 12_000 }, (_, i) => i * 18 + 3);
  assert.deepEqual(decodeFlapDeltas(encodeFlapDeltas(ticks)), ticks);
  assert.throws(() => decodeFlapDeltas([-1, 4]), /start at 0/);
  assert.throws(() => decodeFlapDeltas([3, 0, 4]), /strictly increasing/);
  assert.throws(() => decodeFlapDeltas([3, 1.5]), /integers/);
  assert.throws(() => decodeFlapDeltas([3, '4']), /integers/);
  assert.throws(() => decodeFlapDeltas([3, Number.NaN]), /integers/);
  assert.throws(() => decodeFlapDeltas(Array.from({ length: 12_001 }, () => 1)), /exceeds 12000/);
  assert.throws(() => decodeFlapDeltas([40, 8], 48), /within maxTicks/);
  assert.deepEqual(decodeFlapDeltas([40, 7], 48), [40, 47]);
  assert.throws(() => decodeFlapDeltas([216_000]), /within maxTicks/);
  assert.throws(() => decodeFlapDeltas('0,4'), /must be an array/);
  assert.throws(() => encodeFlapDeltas([4, 4]), /strictly increasing/);
  assert.throws(() => encodeFlapDeltas([-2]), /integers/);
  assert.throws(() => encodeFlapDeltas(Array.from({ length: 12_001 }, (_, i) => i)), /exceeds 12000/);
  const evidence = simulateChikunRun({ seed: 55, taps: [4, 11, 18], maxTicks: 48 }).evidence;
  assert.deepEqual(Object.keys(evidence), ['version', 'seed', 'fixedStepHz', 'maxTicks', 'flapDeltas']);
  assert.throws(() => replayChikunRun({ ...evidence, flapDeltas: [4, 7, 37] }), /within maxTicks/);
  assert.throws(() => replayChikunRun({ ...evidence, flapSteps: [4, 11, 18] }), /flapDeltas, not flapSteps/);
  // One run, one encoding: flaps at or after the final tick are refused, so the
  // same run cannot be resubmitted as differently padded evidence.
  const crashed = simulateChikunRun({ seed: 7, taps: [5, 30, 60], maxTicks: 4_000 });
  assert.ok(crashed.crashed && crashed.survivalTicks < 4_000);
  const lastTick = decodeFlapDeltas(crashed.evidence.flapDeltas).at(-1);
  for (const extra of [crashed.survivalTicks, crashed.survivalTicks + 10, 3_999]) {
    const padded = { ...crashed.evidence, flapDeltas: [...crashed.evidence.flapDeltas, extra - lastTick] };
    assert.throws(() => replayChikunRun(padded), /at or after the final tick/, `flap at ${extra}`);
    const claim = { version: 'chikun-parent-replay-v1', seed: 7, buildHash: 'b-1', seasonId: 's-1', evidence: padded, finalState: crashed.finalState };
    assert.throws(() => verifyChikunReplayClaim({ expectedSeed: 7, expectedBuildHash: 'b-1', expectedSeasonId: 's-1', score: crashed.score, runStats: crashed, replayClaim: claim }), /at or after the final tick/);
  }
  assert.deepEqual(replayChikunRun(crashed.evidence), crashed, 'the canonical evidence still replays');
});

test('flapTicksOf reads v5 and v6 evidence alike', () => {
  const v5 = v5Fixtures.runs[0].evidence;
  assert.equal(flapTicksOf(v5), v5.flapSteps, 'v5 flapSteps are returned as they are');
  const v6 = simulateChikunRun({ seed: 22, taps: v5.flapSteps.filter((tick) => tick < 1200), maxTicks: 1200 }).evidence;
  assert.equal(v6.version, CHIKUN_EVIDENCE_VERSION);
  assert.deepEqual(flapTicksOf(v6), v5.flapSteps.filter((tick) => tick < 1200 && tick < replayChikunRun(v6).survivalTicks));
  assert.deepEqual(flapTicksOf({ version: 'chikun-flap-evidence-v1', flapSteps: [3, 8] }), [3, 8]);
  assert.deepEqual(flapTicksOf({}), []);
  assert.deepEqual(flapTicksOf(null), []);
  assert.throws(() => flapTicksOf({ maxTicks: 10, flapDeltas: [4, 9] }), /within maxTicks/);
});

test('recordScore counts flaps from v6 evidence', () => {
  const state = createInitialArcadeState();
  const session = startPlaySession({ wallet: WALLET, gameId: 'chikun', mode: 'paid', urlSessionId: 'game-session-000000931', sequenceNumber: 931, sessionNonce: 'v6-flap-count' });
  const result = simulateChikunRun({ seed: session.seed, taps: [1, 18, 42, 68, 94, 120, 146], maxTicks: 300 });
  assert.equal(result.evidence.version, 'chikun-flap-evidence-v6');
  const replayClaim = buildChikunReplayClaim({ buildHash: session.buildHash, seasonId: session.seasonId, result });
  assert.equal(session.buildHash, 'site-1.7.0:game-1.7.0:cabinet-0.9.0');
  const accepted = recordScore(state, session, result.score, {
    elapsedSeconds: result.survivalTime, survivalTime: result.survivalTime, survivalTicks: result.survivalTicks,
    coinsCollected: result.coinsCollected, forksPassed: result.forksPassed, nearMisses: result.nearMisses, bestCombo: result.bestCombo,
    flapCount: 0, achievements: result.achievements, replayClaim,
  });
  assert.equal(accepted.acceptedForGlobalLeaderboard, true);
  const stored = state.officialSessions.at(-1);
  assert.equal(stored.runStats.flapCount, flapTicksOf(result.evidence).length);
  assert.equal(stored.runStats.flapCount > 0, true);
  assert.equal(stored.runStats.evidenceVersion, 'chikun-flap-evidence-v6');
  assert.equal(stored.runStats.runtimeVersion, 'canvas-runtime-v7');
});

test('flap cap ends the run as flap-limit', () => {
  const limited = limitedRun();
  assert.equal(limited.finalState.terminalReason, 'flap-limit');
  assert.equal(limited.crashed, false);
  assert.equal(limited.finalState.crashed, false);
  assert.equal(limited.evidence.flapDeltas.length, 12_000);
  assert.ok(limited.survivalTicks < limited.evidence.maxTicks, 'the cap, not the clock, ended it');
  assert.equal(flapTicksOf(limited.evidence).at(-1), limited.survivalTicks - 1, 'the 12,000th flap is applied on the last step');
  assert.deepEqual(replayChikunRun(limited.evidence), limited);
  const claim = buildChikunReplayClaim({ buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0', seasonId: 'chikun-season-preview-1', result: limited });
  const message = createChikunBridgeEnvelope({ type: 'game:result', sessionId: 'la-000001', messageId: 'game-9', payload: resultPayload(limited, claim) });
  assert.equal(validateChikunChildMessage(message).ok, true, 'flap-limit is a valid terminal reason on the bridge');
  assert.throws(() => simulateChikunRun({ seed: 3, taps: Array.from({ length: 12_001 }, (_, i) => i), maxTicks: 20_000 }), /exceeds 12000/);
});

// Twelve thousand flaps without a crash: follow the route pilot, and whenever it
// is not dropping for a low passage or ducking a plane, flap every tick (the
// soft ceiling holds Chikun at the top of the sky).
function limitedRun() {
  const runtime = createChikunRuntime({ seed: 19, maxTicks: 216_000 });
  while (!runtime.terminal) {
    const s = runtime.snapshot();
    const scroll = s.difficulty.scrollPixelsPerTick;
    const low = s.forks.find((o) => !o.passed && o.route === 'ground' && o.x + o.width > 250 && o.x - 280 < scroll * 112 + 140);
    const plane = s.forks.find((o) => !o.passed && o.kind === 'plane' && o.x + o.width > 220 && o.x - 280 < scroll * 80 + 230);
    runtime.step({ flap: low || plane ? routePilot(s) : true });
  }
  return runtime.result();
}

test('flap cap covers sixty minutes of the fastest profile and of hover play', () => {
  const rates = Object.entries(harness.profiles).map(([name, profile]) => [name, profile.flapsPerMinute.p99]);
  // Hover play flaps far more often than the bots: every scripted pilot, including
  // routePilot flying the full hour, is counted too.
  const hover = Object.entries(harness.pilots).map(([name, pilot]) => [name, pilot.flapsPerMinute]);
  const fastest = Math.max(...[...rates, ...hover].map(([, rate]) => rate));
  assert.ok(fastest > 0, JSON.stringify(rates));
  assert.ok(harness.pilots.routePilotFullSnapshot.flapsPerMinute > harness.profiles.exceptional.flapsPerMinute.p99, 'hover play is the faster case');
  assert.ok(CHIKUN_MAX_FLAP_TRANSITIONS >= 1.25 * 60 * harness.profiles.exceptional.flapsPerMinute.p99);
  assert.ok(CHIKUN_MAX_FLAP_TRANSITIONS >= 1.25 * 60 * fastest, `12,000 flaps cover 60 minutes at ${fastest} flaps per minute`);
  // A full-hour hover run stays under the cap, so it ends as run-complete, not flap-limit.
  assert.deepEqual(harness.pilots.routePilotFullSnapshot.causes, { 'run-complete': 16 });
  // Only sustained tapping above 12,000 / 60 = 200 taps a minute (3.3 a second)
  // for the whole hour reaches the cap, and that ends the run gracefully.
  assert.equal(CHIKUN_MAX_FLAP_TRANSITIONS / 60, 200);
});

test('60-minute worst-case result message fits the bridge cap', () => {
  assert.equal(CHIKUN_MAX_MESSAGE_BYTES, 262_144);
  assert.equal(REPLAY_FILE_LIMIT, 262_144);
  // The longest legal encoding: 12,000 deltas whose ticks stay under 216,000.
  // The cheapest extra digit is 1 -> 10 (9 ticks), then 10 -> 100 (90 ticks): all
  // 12,000 deltas get two digits and the leftover budget buys 1,066 three-digit ones.
  const hundreds = Math.floor((215_999 - 12_000 * 10) / 90);
  assert.equal(hundreds, 1_066);
  const flapDeltas = Array.from({ length: 12_000 }, (_, i) => (i < hundreds ? 100 : 10));
  const evidence = { version: 'chikun-flap-evidence-v6', seed: 0xffffffff, fixedStepHz: 60, maxTicks: 216_000, flapDeltas };
  assert.equal(decodeFlapDeltas(flapDeltas, 216_000).at(-1), 215_940);
  assert.throws(() => decodeFlapDeltas(Array.from({ length: 12_000 }, (_, i) => (i <= hundreds ? 100 : 10)), 216_000), /within maxTicks/, 'no room for one more 100');
  const finalState = { step: 216_000, y: -123.456789, velocity: -4.567891, score: 999_999_999, coinsCollected: 999_999, forksPassed: 999_999, nearMisses: 999_999, bestCombo: 999_999, survivalTicks: 216_000, survivalTime: 3600, crashed: false, terminalReason: 'flap-limit' };
  const payload = {
    score: 999_999_999, survivalTime: 3600, survivalTicks: 216_000, coinsCollected: 999_999, forksPassed: 999_999, nearMisses: 999_999, bestCombo: 999_999,
    achievements: ['chikun-first-flight', 'chikun-stack-three', 'chikun-fork-runner', 'chikun-thread-needle'],
    evidence, finalState,
    replayClaim: { version: 'chikun-parent-replay-v1', seed: 0xffffffff, buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0', seasonId: 'chikun-season-preview-1', evidence, finalState },
  };
  const message = createChikunBridgeEnvelope({ type: 'game:result', sessionId: 'game-session-000000001', messageId: 'game-999999', payload });
  const bytes = new TextEncoder().encode(JSON.stringify(message)).byteLength;
  assert.ok(bytes > 64 * 1024, `the old 64 KB cap would reject it (${bytes} bytes)`);
  assert.ok(bytes < CHIKUN_MAX_MESSAGE_BYTES, `${bytes} bytes`);
  assert.deepEqual(validateChikunChildMessage(message), { ok: true, value: message });
  // Non-canonical deltas and v5 evidence are refused by the bridge.
  const bad = structuredClone(message);
  bad.payload.evidence.flapDeltas[5] = 0;
  assert.equal(validateChikunChildMessage(bad).ok, false);
  const v5 = structuredClone(message);
  v5.payload.evidence = v5Fixtures.runs[0].evidence;
  assert.match(validateChikunChildMessage(v5).error, /flapSteps|flapDeltas|version/);
  const file = JSON.stringify({ format: 'chikun-replay-file-v1', game: 'chikun', evidence });
  assert.ok(new TextEncoder().encode(file).byteLength < REPLAY_FILE_LIMIT);
});

test('verifyChikunReplayClaim rejects v5 for Ranked', () => {
  const run = v5Fixtures.runs.find((entry) => entry.seed === 7 && entry.policy === 'flap-every-20-ticks');
  const result = run.result;
  const replayClaim = buildChikunReplayClaim({ buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0', seasonId: 'chikun-season-preview-1', result });
  assert.equal(replayClaim.evidence.version, 'chikun-flap-evidence-v5', 'the v5 replay itself still verifies');
  assert.throws(() => verifyChikunReplayClaim({
    expectedSeed: result.seed, expectedBuildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0', expectedSeasonId: 'chikun-season-preview-1',
    score: result.score, runStats: result, replayClaim,
  }), /evidence version does not match the current cabinet/);
  const v6 = simulateChikunRun({ seed: 7, taps: [5, 30, 60], maxTicks: 400 });
  const claim = buildChikunReplayClaim({ buildHash: 'b-1', seasonId: 's-1', result: v6 });
  assert.deepEqual(verifyChikunReplayClaim({ expectedSeed: 7, expectedBuildHash: 'b-1', expectedSeasonId: 's-1', score: v6.score, runStats: v6, replayClaim: claim }), v6);
});

test('v5 fixtures replay through the frozen runtime', () => {
  assert.equal(FROZEN_V5_EVIDENCE, 'chikun-flap-evidence-v5');
  assert.equal(frozenV5Course.COURSE_CADENCE, 340);
  assert.equal(frozenV5Course.speedAtTick(28_800), 2);
  assert.equal(frozenV5Course.CHIKUN_REGIONS.length, 7);
  assert.equal(v5Fixtures.runs.length, 6);
  for (const run of v5Fixtures.runs) {
    const label = `${run.policy} seed ${run.seed}`;
    assert.equal(run.evidence.version, 'chikun-flap-evidence-v5', label);
    assert.deepEqual(run.evidence, run.result.evidence);
    assert.deepEqual(replayChikunRun(run.evidence), run.result, `${label} replays exactly`);
    assert.deepEqual(driveFrozenV5(run.evidence), run.result, `${label} replays on the frozen v5 module`);
  }
  const live = createChikunRuntime({ seed: 7, maxTicks: 900, evidenceVersion: 'chikun-flap-evidence-v5' });
  const frozen = createFrozenV5Runtime({ seed: 7, maxTicks: 900 });
  for (let tick = 0; tick < 400; tick += 1) {
    const flap = tick % 23 === 0;
    assert.deepEqual(live.step({ flap }), frozen.step({ flap }));
  }
  // The v6 course really differs, so the frozen copy is what keeps v5 exact.
  const onV6 = simulateChikunRun({ seed: 7, taps: v5Fixtures.runs[1].evidence.flapSteps, maxTicks: v5Fixtures.maxTicks });
  assert.notDeepEqual(onV6.finalState, v5Fixtures.runs[1].result.finalState);
  const exported = exportChikunReplay(v5Fixtures.runs[0].result);
  assert.deepEqual(importChikunReplay(exported), v5Fixtures.runs[0].result, 'historical replay files still open');
});

test('v6 fixtures replay deterministically', () => {
  assert.equal(v6Fixtures.runs.length, 3);
  assert.ok(v6Fixtures.runs.some((run) => run.result.nearMisses >= 8), 'one run is near-miss heavy');
  for (const run of v6Fixtures.runs) {
    assert.equal(run.evidence.version, 'chikun-flap-evidence-v6');
    assert.deepEqual(run.evidence, run.result.evidence);
    const replayed = replayChikunRun(run.evidence);
    assert.deepEqual(replayed, run.result, `${run.profile} seed ${run.seed}`);
    assert.deepEqual(replayChikunRun(replayed.evidence), replayed);
    assert.deepEqual(JSON.parse(JSON.stringify(replayed)), run.result, 'results survive JSON round trips');
  }
});

test('v6 result counters follow their documented definitions', () => {
  for (const run of v6Fixtures.runs) {
    const taps = new Set(flapTicksOf(run.evidence));
    const runtime = createChikunRuntime({ seed: run.evidence.seed, maxTicks: run.evidence.maxTicks });
    let previous = runtime.snapshot();
    const passes = [];
    while (!runtime.terminal) {
      const next = runtime.step({ flap: taps.has(previous.tick) });
      if (next.forksPassed > previous.forksPassed) {
        assert.equal(next.forksPassed - previous.forksPassed, 1);
        const index = passes.length;
        const obstacle = next.forks.find((o) => o.index === index);
        passes.push({ index, near: next.nearMisses > previous.nearMisses, coin: obstacle.coin.collected });
      }
      previous = next;
    }
    const result = runtime.result();
    let combo = 0, best = 0, streak = 0, streakBest = 0, flawless = 0, clean = true, visit = -1;
    for (const pass of passes) {
      combo = pass.near || pass.coin ? combo + 1 : 0; best = Math.max(best, combo);
      streak = pass.near ? streak + 1 : 0; streakBest = Math.max(streakBest, streak);
      const { index, local, loop, region } = regionForObstacle(pass.index);
      if (loop * 8 + index !== visit) { visit = loop * 8 + index; clean = true; }
      if (pass.near) clean = false;
      if (local === region.slots - 1 && clean) flawless += 1;
    }
    const last = passes.length - 1;
    assert.equal(result.bestCombo, best, 'combo counts consecutive passes that took their coin or skimmed it');
    assert.equal(result.nearMissStreakBest, streakBest);
    assert.equal(result.flawlessRegions, flawless);
    assert.equal(result.regionIndexReached, last < 0 ? 0 : regionForObstacle(last).index);
    assert.equal(result.regionReached, last < 0 ? 'farmland' : regionForObstacle(last).region.id);
    assert.equal(result.laps, Math.floor((last + 1) / REGION_LOOP_SLOTS));
    assert.equal(result.distancePixels, distanceAtTick(result.survivalTicks));
    assert.equal(result.speedMultiplierReached, speedAtTick(result.survivalTicks));
    assert.deepEqual(Object.keys(result.finalState), ['step', 'y', 'velocity', 'score', 'coinsCollected', 'forksPassed', 'nearMisses', 'bestCombo', 'survivalTicks', 'survivalTime', 'crashed', 'terminalReason'], 'finalState keeps the bridge shape');
  }
  assert.ok(v6Fixtures.runs.some((run) => run.result.bestCombo !== run.result.forksPassed), 'bestCombo is no longer just forksPassed');
  assert.ok(v6Fixtures.runs.some((run) => run.result.laps >= 1 && run.result.regionIndexReached >= 0));
});

test('the child keeps its frame loop alive when a result fails', () => {
  // Drive the guarded loop with a fake animation-frame clock.
  const queue = [];
  const errors = [];
  const rendered = [];
  let disposed = false;
  let failAt = new Set([2, 3]);
  const loop = createGuardedFrameLoop({
    step: (now) => { if (failAt.has(now)) throw new Error(`frame ${now} failed`); rendered.push(now); },
    schedule: (next) => queue.push(next),
    isDisposed: () => disposed,
    onError: (error) => errors.push(error.message),
  });
  const tick = (now) => { const next = queue.shift(); assert.equal(typeof next, 'function', `a frame is scheduled before ${now}`); next(now); };
  queue.push(loop.frame);
  for (let now = 1; now <= 6; now += 1) tick(now);
  assert.deepEqual(rendered, [1, 4, 5, 6], 'frames after a failure still render');
  assert.deepEqual(errors, ['frame 2 failed'], 'a failure is reported once per run');
  assert.equal(queue.length, 1, 'the next frame is always re-armed');
  loop.reset();
  failAt = new Set([7]);
  tick(7);
  assert.deepEqual(errors, ['frame 2 failed', 'frame 7 failed'], 'a new run reports again');
  const brokenBridge = createGuardedFrameLoop({ step: () => { throw new Error('x'); }, schedule: (next) => queue.push(next), onError: () => { throw new Error('bridge down'); } });
  queue.length = 0;
  brokenBridge.frame(1);
  assert.equal(queue.length, 1, 'even a failing reporter cannot stop the loop');
  disposed = true;
  queue.length = 0;
  loop.frame(9);
  assert.equal(queue.length, 0, 'a disposed child stops scheduling');

  // finishRun throwing after it set phase 'game-over': reported once, and the
  // result screen is rebuilt instead of showing the previous run.
  const reports = [];
  let recovered = null;
  assert.equal(finishRunSafely(() => { throw new Error('replay claim failed'); }, { report: (error) => reports.push(error.message), recover: (error) => { recovered = error.message; } }), false);
  assert.deepEqual(reports, ['replay claim failed']);
  assert.equal(recovered, 'replay claim failed');
  assert.equal(finishRunSafely(() => {}, { report: () => assert.fail('no report'), recover: () => assert.fail('no recovery') }), true);
  assert.equal(finishRunSafely(() => { throw new Error('a'); }, { report: () => {}, recover: () => { throw new Error('b'); } }), false, 'a failing recovery is contained');

  // main.mjs wires the loop and the recovery through these helpers.
  const source = readFileSync(new URL('../apps/chikun/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /const frameLoop = createGuardedFrameLoop\(\{\s*step: \(now\) => stepFrame\(now\),\s*schedule: \(next\) => requestAnimationFrame\(next\),\s*isDisposed: \(\) => disposed,/);
  assert.match(source, /if \(runtime\.terminal\) finishRunSafely\(finishRun, \{ report: frameLoop\.report, recover: showUnfinishedRun \}\);/);
  const recovery = source.slice(source.indexOf('function showUnfinishedRun() {'), source.indexOf('function stepFrame(now) {'));
  assert.match(recovery, /resultStats\.replaceChildren\(\);/);
  assert.match(recovery, /restartButton\.disabled = false;/);
  assert.match(recovery, /resultScore\.textContent = String\(latestSnapshot\?\.score \?\? 0\);/);
  assert.match(source, /frameLoop\.reset\(\);\s*phase = 'running';/);
  assert.equal(source.match(/requestAnimationFrame\(frame\)/g).length, 1, 'the boot call; the loop re-arms itself');
  assert.match(source, /runtimeVersion: '0\.9\.0'/);
});

test('daily-challenge ghosts replay v6 flaps', () => {
  // A v6 run with real taps (the hardcore fixture) becomes a ghost that follows it.
  const run = v6Fixtures.runs.find((entry) => entry.profile === 'hardcore');
  const replayed = replayChikunRun(run.evidence);
  const track = buildChikunGhostTrack(run.evidence);
  assert.equal(track.terminalTick, replayed.survivalTicks);
  assert.equal(track.survivalTicks, replayed.survivalTicks);
  const taps = new Set(flapTicksOf(run.evidence));
  assert.ok(taps.size > 100);
  const runtime = createChikunRuntime({ seed: run.evidence.seed, maxTicks: run.evidence.maxTicks });
  const ys = new Map();
  while (!runtime.terminal) { const s = runtime.snapshot(); ys.set(s.tick, s.chikun.y); runtime.step({ flap: taps.has(s.tick) }); }
  ys.set(runtime.snapshot().tick, runtime.snapshot().chikun.y);
  assert.ok(track.samples.length > 100);
  for (const sample of track.samples) assert.equal(sample.y, ys.get(sample.tick), `ghost y at tick ${sample.tick}`);
  // A ghost that lost its flaps would run along the ground and die early.
  const flapless = buildChikunGhostTrack({ ...run.evidence, flapDeltas: [] });
  assert.ok(flapless.terminalTick < track.terminalTick);
  assert.ok(track.samples.some((sample) => sample.y < 500), 'the ghost flies');
  assert.ok(flapless.samples.every((sample) => sample.y >= 600), 'the flapless ghost never leaves the ground');
  assert.equal(ghostYAt(track, track.samples[5].tick), track.samples[5].y);
  const record = createChikunGhostRecord(run.result);
  assert.equal(record.version, CHIKUN_GHOST_STORAGE_VERSION);
  assert.equal(record.version, 'chikun-ghost-v4', 'v3 ghosts were recorded on the v5 course');
  assert.deepEqual(record.samples, track.samples);
  // A ghost stored before this course (storage v3) is not read back.
  const stale = { getItem: () => JSON.stringify({ ...record, version: 'chikun-ghost-v3' }) };
  assert.equal(readChikunGhostRecord(stale, record.seed), null);
});
