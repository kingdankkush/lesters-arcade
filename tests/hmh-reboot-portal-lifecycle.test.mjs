import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createHmhRebootPortalLifecycle } from '../apps/portal/src/hmh-reboot-portal-lifecycle.mjs';

function fixture({ paid = true } = {}) {
  const combat = {
    active: true,
    paused: false,
    gameOver: false,
    gameOverSubmitted: false,
    score: 0,
    kills: 0,
    elapsedGameSeconds: 0,
    health: 100,
    maxHealth: 100,
  };
  const calls = { stat: [], score: [], end: [], ranked: [], free: [], sync: 0, errors: [] };
  const adapter = {
    emitStatUpdate(value) { calls.stat.push(value); return true; },
    submitScore(score, value) { calls.score.push({ score, value }); return true; },
    end(value) { calls.end.push(value); return true; },
  };
  const session = { sessionId: paid ? 'game-session-000000001' : 'lester-blaster-free-abc', isPaid: paid };
  const lifecycle = createHmhRebootPortalLifecycle({
    combat,
    getSession: () => session,
    getAdapter: () => adapter,
    finalizeRanked: (value) => { calls.ranked.push(value); combat.gameOverSubmitted = true; },
    finalizeFree: (value) => { calls.free.push(value); },
    syncUi: () => { calls.sync += 1; },
    onError: (error) => calls.errors.push(error),
  });
  return { combat, calls, lifecycle };
}

const scoreResult = {
  type: 'game:score-result',
  payload: { score: 4200, kills: 19, elapsedMs: 91234.5, checksum: 'hmh-score:0123456789abcdef' },
};
const gameOver = {
  type: 'game:game-over',
  payload: { score: 4200, kills: 19, elapsedMs: 91234.5, reason: 'defeated' },
};
const runSummary = {
  type: 'game:run-summary',
  payload: {
    schemaVersion: 1,
    identity: { terminalReason: 'defeated' },
    totals: { score: 4200, elapsedMs: 91234.5 },
    kills: { total: 19 },
  },
};

test('ranked reboot result finalizes parent rails exactly once after a matching canonical summary and score candidate', () => {
  const { combat, calls, lifecycle } = fixture({ paid: true });
  assert.equal(lifecycle.handleRunSummary(runSummary), true);
  lifecycle.handleScoreResult(scoreResult);
  assert.equal(lifecycle.handleState(gameOver), true);
  assert.equal(combat.active, false);
  assert.equal(combat.gameOver, true);
  assert.equal(combat.gameOverReason, 'defeated');
  assert.equal(combat.score, 4200);
  assert.equal(combat.kills, 19);
  assert.equal(combat.elapsedGameSeconds, 91.2345);
  assert.equal(calls.ranked.length, 1);
  assert.equal(calls.ranked[0].runSummary, runSummary.payload);
  assert.equal(calls.free.length, 0);
  assert.equal(calls.score.length, 1);
  assert.equal(calls.score[0].score, 4200);
  assert.equal(calls.end.length, 1);
  assert.equal(calls.sync, 1);
  assert.deepEqual(calls.errors, []);

  lifecycle.handleScoreResult(scoreResult);
  assert.equal(lifecycle.handleState(gameOver), false);
  assert.equal(calls.ranked.length, 1);
  assert.equal(calls.end.length, 1);
});

test('free reboot result ends SDK lifecycle and persists summary without writing ranked rails', () => {
  const { calls, lifecycle } = fixture({ paid: false });
  lifecycle.handleRunSummary(runSummary);
  lifecycle.handleScoreResult(scoreResult);
  assert.equal(lifecycle.handleState(gameOver), true);
  assert.equal(calls.ranked.length, 0);
  assert.equal(calls.free.length, 1);
  assert.equal(calls.free[0].runSummary, runSummary.payload);
  assert.equal(calls.score.length, 0);
  assert.equal(calls.end.length, 1);
  assert.deepEqual(calls.errors, []);
});

test('reboot result fails closed when score candidate and game-over summary disagree', () => {
  const { combat, calls, lifecycle } = fixture({ paid: true });
  lifecycle.handleRunSummary(runSummary);
  lifecycle.handleScoreResult(scoreResult);
  const accepted = lifecycle.handleState({
    ...gameOver,
    payload: { ...gameOver.payload, score: 999999 },
  });
  assert.equal(accepted, false);
  assert.equal(combat.gameOverSubmitted, false);
  assert.equal(calls.ranked.length, 0);
  assert.equal(calls.score.length, 0);
  assert.equal(calls.end.length, 0);
  assert.equal(calls.errors.length, 1);
  assert.match(calls.errors[0].message, /does not match/i);
});

test('reboot result fails closed without exactly one prior canonical run summary', () => {
  const { combat, calls, lifecycle } = fixture({ paid: true });
  lifecycle.handleScoreResult(scoreResult);
  assert.equal(lifecycle.handleState(gameOver), false);
  assert.equal(combat.gameOverSubmitted, false);
  assert.equal(calls.ranked.length, 0);
  assert.match(calls.errors.at(-1).message, /run summary/i);

  const duplicate = fixture({ paid: true });
  assert.equal(duplicate.lifecycle.handleRunSummary(runSummary), true);
  assert.equal(duplicate.lifecycle.handleRunSummary(runSummary), false);
  assert.match(duplicate.calls.errors.at(-1).message, /duplicate/i);
});

test('live state and pause messages synchronize parent combat and SDK stats', () => {
  const { combat, calls, lifecycle } = fixture({ paid: false });
  lifecycle.handleState({
    type: 'game:state',
    payload: { status: 'running', score: 320, kills: 3, elapsedMs: 2500, health: 84, maxHealth: 120, xp: 77, level: 2, paused: false },
  });
  assert.equal(combat.score, 320);
  assert.equal(combat.kills, 3);
  assert.equal(combat.elapsedGameSeconds, 2.5);
  assert.equal(combat.health, 84);
  assert.equal(combat.maxHealth, 120);
  assert.equal(combat.runXp, 77);
  assert.equal(combat.runLevel, 2);
  assert.deepEqual(calls.stat.at(-1), { score: 320, kills: 3, survivalTime: 2.5 });
  lifecycle.handleState({ type: 'game:pause', payload: { paused: true, source: 'user' } });
  assert.equal(combat.paused, true);
});

test('portal entrypoint binds reboot game over, canonical summary, seed, and restart to parent authority', () => {
  const source = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(source, /createHmhRebootPortalLifecycle\(\{/);
  assert.match(source, /onState: \(message\) => hmhRebootLifecycle\?\.handleState\(message\)/);
  assert.match(source, /onRunSummary: \(message\) => hmhRebootLifecycle\?\.handleRunSummary\(message\)/);
  assert.match(source, /hmhRebootLifecycle\?\.handleScoreResult\(message\)/);
  assert.match(source, /finalizeRanked: \(\{ runSummary \}\) => submitCombatGameOver\(runSummary\)/);
  assert.match(source, /seed: currentSession\.seed \?\? currentSession\.canonicalContext\?\.seed \?\? 0/);
  assert.match(source, /currentSession = beginTrackedSession\(\{ mode: wasPaid \? 'paid' : 'free' \}\)/);
  assert.match(source, /sessionId: currentSession\.sessionId,\s+rankedEligible: currentSession\.isPaid/);
  assert.doesNotMatch(source, /if \(hmhRebootActive\) \{\s+hmhRebootHost\?\.restart\(\)/);
});
