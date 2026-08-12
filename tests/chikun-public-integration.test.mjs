import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  CHIKUN_CABINET_VERSION,
  CHIKUN_RUNTIME_VERSION,
  buildChikunReplayClaim,
  simulateChikunRun,
} from '../apps/portal/src/chikun-cabinet.mjs';
import {
  LESTERS_ARCADE_V2_APP_SHELL,
  buildGameModeSelectModel,
  buildPlayerArcadeSnapshot,
  createInitialArcadeState,
  getAllCadenceLeaderboards,
  getGame,
  recordScore,
  startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

function rankedRun(session) {
  const result = simulateChikunRun({
    seed: session.seed,
    taps: [1, 18, 42, 68, 94, 120, 146, 172, 198, 224, 250],
    maxTicks: 300,
  });
  return {
    result,
    replayClaim: buildChikunReplayClaim({
      buildHash: session.buildHash,
      seasonId: session.seasonId,
      result,
    }),
  };
}

test("Chikun's Escape is a public playable cabinet with production Free and Ranked mode art", () => {
  const game = getGame('chikun');
  const cabinet = LESTERS_ARCADE_V2_APP_SHELL.cabinets.find((entry) => entry.gameId === 'chikun');
  const mode = buildGameModeSelectModel('chikun');

  assert.equal(CHIKUN_CABINET_VERSION, '0.4.0');
  assert.equal(CHIKUN_RUNTIME_VERSION, 'canvas-runtime-v2');
  assert.equal(game.status, 'playable');
  assert.equal(cabinet.status, 'playable');
  assert.equal(cabinet.playable, true);
  assert.equal(cabinet.leaderboardEligible, true);
  assert.equal(mode.artStatus, 'production');
  assert.equal(mode.free.bannerAsset, './assets/generated/chikun-mode-select/chikuns-escape-free-mode.webp');
  assert.equal(mode.ranked.bannerAsset, './assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp');
  assert.match(mode.free.bannerAlt, /bright blue sky.*green pipes/i);
  assert.match(mode.ranked.bannerAlt, /stormy.*green pipes/i);

  for (const relative of [
    '../apps/portal/assets/generated/chikun-mode-select/chikuns-escape-free-mode.webp',
    '../apps/portal/assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp',
  ]) {
    const path = fileURLToPath(new URL(relative, import.meta.url));
    assert.equal(existsSync(path), true, `${relative} must exist`);
    assert.equal(statSync(path).size > 100_000, true, `${relative} must be a production-sized image`);
  }
});

test('public Free and Ranked Chikun sessions start without the development-cabinet bypass', () => {
  const free = startPlaySession({ wallet: WALLET, gameId: 'chikun', mode: 'free', sessionNonce: 'free-public' });
  assert.equal(free.leaderboardEligible, false);
  assert.equal(free.mode, 'free');

  const ranked = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'paid',
    urlSessionId: 'game-session-000000901',
    sequenceNumber: 901,
    sessionNonce: 'ranked-public',
  });
  assert.equal(ranked.leaderboardEligible, true);
  assert.equal(ranked.gameId, 'chikun');
  assert.equal(ranked.urlSessionId, 'game-session-000000901');
});

test('a canonical Ranked Chikun result updates its profile snapshot and every Chikun score cadence', () => {
  const state = createInitialArcadeState();
  const session = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'paid',
    urlSessionId: 'game-session-000000902',
    sequenceNumber: 902,
    sessionNonce: 'ranked-score',
  });
  const { result, replayClaim } = rankedRun(session);
  const accepted = recordScore(state, session, result.score, {
    elapsedSeconds: result.survivalTime,
    survivalTime: result.survivalTime,
    survivalTicks: result.survivalTicks,
    coinsCollected: result.coinsCollected,
    forksPassed: result.forksPassed,
    nearMisses: result.nearMisses,
    bestCombo: result.bestCombo,
    flapCount: result.evidence.flapSteps.length,
    achievements: result.achievements,
    replayClaim,
  });

  assert.equal(accepted.acceptedForGlobalLeaderboard, true);
  assert.equal(accepted.leaderboardEntry.gameId, 'chikun');
  assert.equal(state.officialSessions.at(-1).gameId, 'chikun');
  assert.equal(state.officialSessions.at(-1).urlSessionId, 'game-session-000000902');

  const boards = getAllCadenceLeaderboards(state, 'chikun', { wallet: WALLET });
  assert.deepEqual(boards.map((board) => board.cadence), ['daily', 'weekly', 'monthly', 'yearly', 'all-time']);
  for (const board of boards) {
    assert.equal(board.topEntries[0].sessionId, session.sessionId);
    assert.equal(board.topEntries[0].score, result.score);
  }

  const snapshot = buildPlayerArcadeSnapshot(state, WALLET);
  const progress = snapshot.progress.chikun;
  assert.equal(progress.paidRuns, 1);
  assert.equal(progress.bestPaidScore, result.score);
  assert.equal(snapshot.highScores.some((entry) => entry.gameId === 'chikun' && entry.score === result.score), true);
  assert.equal(snapshot.officialSessions.some((entry) => entry.gameId === 'chikun' && entry.sessionId === session.sessionId), true);
});
