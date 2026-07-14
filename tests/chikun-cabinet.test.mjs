import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseInboundMessage } from '../apps/portal/src/arcade-sdk.mjs';
import { validateGameManifest } from '../apps/portal/src/game-manifest.mjs';
import {
  CHIKUN_CABINET_VERSION,
  CHIKUN_FIXED_STEP_HZ,
  CHIKUN_MAX_FLAP_TRANSITIONS,
  CHIKUN_RUNTIME_VERSION,
  buildChikunReplayClaim,
  buildChikunVerticalSliceConfig,
  createChikunCabinet,
  loadChikunGame,
  replayChikunRun,
  simulateChikunRun,
} from '../apps/portal/src/chikun-cabinet.mjs';
import {
  buildCabinetInitContextFromSession,
  buildParentSyncPacket,
  createInitialArcadeState,
  getCartridgeSelectModel,
  getGame,
  recordScore,
  startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

test('WO-55 Chikun ships one valid playable ranked Cabinet SDK manifest', () => {
  const manifestPath = fileURLToPath(new URL('../apps/portal/games/chikun/game.manifest.json', import.meta.url));
  const staleManifestPath = fileURLToPath(new URL('../games/chikun/game.manifest.json', import.meta.url));
  assert.equal(existsSync(manifestPath), true);
  assert.equal(existsSync(staleManifestPath), false, 'the divergent root Chikun manifest must be consolidated away');
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const result = validateGameManifest(raw);
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.manifest.id, 'chikun');
  assert.equal(result.manifest.version, CHIKUN_CABINET_VERSION);
  assert.equal(raw.runtimeVersion, CHIKUN_RUNTIME_VERSION);
  assert.equal(CHIKUN_CABINET_VERSION, '0.2.0');
  assert.equal(CHIKUN_RUNTIME_VERSION, 'deterministic-core-v2');
  assert.equal(result.manifest.status, 'playable');
  assert.equal(result.manifest.controlScheme, 'tap');
  assert.equal(result.manifest.rankedEligible, true);
  assert.equal(result.manifest.capabilities.includes('ranked'), true);
  assert.equal(result.manifest.capabilities.includes('leaderboard'), true);
});

test('WO-55 Chikun vertical slice has deterministic flap/fork/coin scoring rules', () => {
  const config = buildChikunVerticalSliceConfig();
  assert.equal(config.gameId, 'chikun');
  assert.equal(config.version, CHIKUN_CABINET_VERSION);
  assert.equal(config.runtimeVersion, CHIKUN_RUNTIME_VERSION);
  assert.equal(config.sdkVersion, '1.0.0');
  assert.equal(config.rules.input, 'tap-to-flap');
  assert.equal(config.rules.score.coinValue, 25);
  assert.equal(config.rules.score.forkPassValue, 10);
  assert.equal(config.hazards.some((hazard) => hazard.id === 'fork-gap'), true);

  const a = simulateChikunRun({ seed: 55, taps: [4, 11, 18, 27, 36, 44] });
  const b = simulateChikunRun({ seed: 55, taps: [4, 11, 18, 27, 36, 44] });
  assert.deepEqual(a, b);
  assert.equal(a.gameId, 'chikun');
  assert.equal(a.score > 0, true);
  assert.equal(a.survivalTime > 0, true);
  assert.equal(Array.isArray(a.achievements), true);
});

test('Chikun deterministic core normalizes bounded flap evidence and replays the exact final state', () => {
  const result = simulateChikunRun({
    seed: 55,
    taps: [18, 4, 4, -3, 11, 27, 999],
    maxTicks: 48,
  });

  assert.equal(CHIKUN_FIXED_STEP_HZ, 60);
  assert.equal(result.seed, 55);
  assert.equal(result.fixedStepHz, CHIKUN_FIXED_STEP_HZ);
  assert.equal(result.evidence.version, 'chikun-flap-evidence-v1');
  assert.deepEqual(result.evidence.flapSteps, [0, 4, 11, 18, 27]);
  assert.equal(Object.isFrozen(result.evidence), true);
  assert.equal(Object.isFrozen(result.evidence.flapSteps), true);

  const replayed = replayChikunRun(result.evidence);
  assert.deepEqual(replayed, result);
  assert.deepEqual(replayed.finalState, result.finalState);
});

test('Chikun evidence fails closed when flap transitions exceed the bounded replay budget', () => {
  const taps = Array.from({ length: CHIKUN_MAX_FLAP_TRANSITIONS + 1 }, (_, step) => step);
  assert.throws(
    () => simulateChikunRun({ seed: 55, taps, maxTicks: taps.length + 1 }),
    /flap evidence exceeds/i,
  );
  assert.throws(
    () => simulateChikunRun({ seed: 55, taps: Array(CHIKUN_MAX_FLAP_TRANSITIONS + 1).fill(0), maxTicks: 48 }),
    /flap evidence exceeds/i,
  );
});

test('Chikun replay rejects non-canonical flap evidence before simulation', () => {
  const evidence = simulateChikunRun({ seed: 55, taps: [4, 11, 18], maxTicks: 48 }).evidence;
  assert.throws(() => replayChikunRun({ ...evidence, flapSteps: '4,11,18' }), /flapSteps must be an array/i);
  assert.throws(() => replayChikunRun({ ...evidence, flapSteps: [4, 4, 11] }), /strictly increasing/i);
  assert.throws(() => replayChikunRun({ ...evidence, flapSteps: [4, 48] }), /within maxTicks/i);
});

test('ranked Chikun cabinet binds simulation to the parent-issued seed and session metadata', () => {
  const session = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'paid',
    sessionNonce: '123e4567-e89b-42d3-a456-426614174057',
    allowDevCabinet: true,
  });
  const cabinet = createChikunCabinet({ sessionId: session.sessionId });
  const parentInit = buildCabinetInitContextFromSession(session);
  const ctx = cabinet.init(parentInit);
  cabinet.start({ mode: 'ranked' });

  const result = cabinet.simulate({ seed: 999, taps: [3, 8, 13, 21, 34], maxTicks: 48 });
  assert.equal(ctx.seed, session.seed);
  assert.equal(ctx.buildHash, 'site-1.3.0:game-1.3.0:cabinet-0.2.0');
  assert.equal(ctx.seasonId, 'chikun-season-preview-1');
  assert.equal(result.seed, session.seed);
  assert.deepEqual(result, simulateChikunRun({ seed: session.seed, taps: [3, 8, 13, 21, 34], maxTicks: 48 }));
});

test('ranked Chikun cabinet rejects a tampered result before emitting a score intent', () => {
  const session = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'paid',
    sessionNonce: '123e4567-e89b-42d3-a456-426614174058',
    allowDevCabinet: true,
  });
  const cabinet = createChikunCabinet({ sessionId: session.sessionId });
  const events = [];
  cabinet.adapter.on((message) => events.push(message));
  cabinet.init(buildCabinetInitContextFromSession(session));
  cabinet.start({ mode: 'ranked' });
  const result = cabinet.simulate({ taps: [3, 8, 13, 21, 34], maxTicks: 48 });

  assert.throws(() => cabinet.submitRun({ ...result, score: result.score + 5_000 }), /canonical replay/i);
  assert.deepEqual(events.map((event) => event.type), [
    'arcade.ready',
    'arcade.sessionStart',
    'arcade.statUpdate',
  ]);
});

test('WO-55 Chikun cabinet emits replay evidence through the public adapter path', () => {
  const session = startPlaySession({
    wallet: WALLET,
    gameId: 'chikun',
    mode: 'paid',
    sessionNonce: '123e4567-e89b-42d3-a456-426614174055',
    allowDevCabinet: true,
  });
  const cabinet = createChikunCabinet({ sessionId: session.sessionId });
  const events = [];
  cabinet.adapter.on((message) => events.push(message));

  const ctx = cabinet.init(buildCabinetInitContextFromSession(session));
  assert.equal(ctx.gameId, 'chikun');
  assert.equal(ctx.capabilities.canWriteOfficialState, false);
  cabinet.start({ mode: 'ranked' });
  const result = cabinet.simulate({ taps: [3, 8, 13, 21, 34] });
  cabinet.submitRun(result);

  assert.deepEqual(events.map((event) => event.type), [
    'arcade.ready',
    'arcade.sessionStart',
    'arcade.statUpdate',
    'arcade.scoreSubmit',
    'arcade.gameOver',
  ]);
  for (const event of events) {
    const parsed = parseInboundMessage(event, { expectedGameId: 'chikun' });
    assert.equal(parsed.valid, true, `${event.type}: ${parsed.errors.join('; ')}`);
  }
  const scoreIntent = events.find((event) => event.type === 'arcade.scoreSubmit');
  assert.equal(scoreIntent.payload.replayClaim.version, 'chikun-parent-replay-v1');
  assert.equal(scoreIntent.payload.replayClaim.seed, session.seed);
  assert.equal(scoreIntent.payload.replayClaim.buildHash, session.buildHash);
  assert.deepEqual(scoreIntent.payload.replayClaim.evidence, result.evidence);
  assert.deepEqual(scoreIntent.payload.replayClaim.finalState, result.finalState);
  assert.equal(scoreIntent.payload.runStats.coinsCollected, result.coinsCollected);
  assert.equal(scoreIntent.payload.runStats.forksPassed, result.forksPassed);
  const parentPacket = buildParentSyncPacket(session, scoreIntent.payload);
  assert.equal(parentPacket.replayVerification.status, 'local-replay-passed');
  assert.equal(parentPacket.scoreClaim.runStats.survivalTime, result.survivalTime);
});

test('WO-72 portal model keeps Chikun dev-testable but public coming soon', () => {
  const game = getGame('chikun');
  assert.equal(game.status, 'coming-soon');
  assert.equal(game.devPlayable, true);
  assert.equal(game.systemRole, 'child-dapp-cartridge');
  assert.equal(game.cabinetVersion, CHIKUN_CABINET_VERSION);
  assert.equal(game.rankedSeasonId, 'chikun-season-preview-1');
  assert.equal(game.presentation.cartridgeAsset.endsWith('cartridge-chikun.svg'), true);
  const cartridge = getCartridgeSelectModel().find((entry) => entry.id === 'chikun');
  assert.equal(cartridge.status, 'coming-soon');
  assert.equal(cartridge.playable, false);
  assert.equal(cartridge.routePath, null);
  assert.equal(cartridge.devRoutePath, '/play/chikun?devCabinets=1');

  assert.throws(() => startPlaySession({ wallet: WALLET, gameId: 'chikun', mode: 'free' }), /not playable yet/);
  const free = startPlaySession({ wallet: WALLET, gameId: 'chikun', mode: 'free', allowDevCabinet: true });
  assert.equal(free.leaderboardEligible, false);
  assert.equal(free.entryFeeMicroUsdc, 0);
  const ranked = startPlaySession({ wallet: WALLET, gameId: 'chikun', mode: 'paid', urlSessionId: 'game-session-000000055', sequenceNumber: 55, allowDevCabinet: true });
  assert.equal(ranked.leaderboardEligible, true);
  assert.equal(ranked.urlSessionId, 'game-session-000000055');
  const run = simulateChikunRun({ seed: ranked.seed, taps: [3, 8, 13, 21, 34], maxTicks: 48 });
  const replayClaim = buildChikunReplayClaim({
    buildHash: ranked.buildHash,
    seasonId: ranked.seasonId,
    result: run,
  });
  const runStats = {
    survivalTime: run.survivalTime,
    survivalTicks: run.survivalTicks,
    coinsCollected: run.coinsCollected,
    forksPassed: run.forksPassed,
    achievements: run.achievements,
  };

  assert.throws(
    () => buildParentSyncPacket(ranked, { score: run.score, runStats }),
    /replay claim is required/i,
  );
  assert.throws(
    () => buildParentSyncPacket(ranked, { score: run.score + 1, runStats, replayClaim }),
    /canonical replay/i,
  );

  const packet = buildParentSyncPacket(ranked, { score: run.score, runStats, replayClaim });
  assert.equal(packet.childGame.id, 'chikun');
  assert.equal(packet.writeSets.includes('official scores'), true);
  assert.equal(packet.replayVerification.status, 'local-replay-passed');
  assert.equal(packet.verifier.status === 'verified', false, 'local replay must not claim official settlement verification');

  const state = createInitialArcadeState();
  assert.throws(
    () => recordScore(state, ranked, run.score + 1, { ...runStats, replayClaim }),
    /canonical replay/i,
  );
  assert.equal(state.leaderboards.chikun.length, 0);
  const accepted = recordScore(state, ranked, run.score, { ...runStats, replayClaim });
  assert.equal(accepted.acceptedForGlobalLeaderboard, true);
});

test('WO-55 Chikun loader returns the vertical slice instead of a placeholder stub', async () => {
  const loaded = await loadChikunGame();
  const publicEntry = await import('../apps/portal/games/chikun/main.mjs');
  assert.equal(loaded.manifest.id, 'chikun');
  assert.equal(loaded.manifest.version, CHIKUN_CABINET_VERSION);
  assert.equal(loaded.manifest.runtimeVersion, CHIKUN_RUNTIME_VERSION);
  assert.equal(publicEntry.CHIKUN_CABINET_VERSION, CHIKUN_CABINET_VERSION);
  assert.equal(publicEntry.CHIKUN_RUNTIME_VERSION, CHIKUN_RUNTIME_VERSION);
  assert.equal(publicEntry.CHIKUN_FIXED_STEP_HZ, 60);
  assert.equal(typeof publicEntry.replayChikunRun, 'function');
  const entry = loaded.entryPoint({ sessionId: 'game-session-000000056' });
  assert.equal(entry.loaded, true);
  assert.equal(entry.cabinet.id, 'chikun');
  assert.equal(typeof entry.cabinet.simulate, 'function');
});
