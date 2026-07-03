import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseInboundMessage } from '../apps/portal/src/arcade-sdk.mjs';
import { validateGameManifest } from '../apps/portal/src/game-manifest.mjs';
import {
  buildChikunVerticalSliceConfig,
  createChikunCabinet,
  loadChikunGame,
  simulateChikunRun,
} from '../apps/portal/src/chikun-cabinet.mjs';
import {
  buildParentSyncPacket,
  getCartridgeSelectModel,
  getGame,
  startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';

test('WO-55 Chikun ships a valid playable ranked Cabinet SDK manifest', () => {
  const manifestPath = fileURLToPath(new URL('../apps/portal/games/chikun/game.manifest.json', import.meta.url));
  assert.equal(existsSync(manifestPath), true);
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const result = validateGameManifest(raw);
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.manifest.id, 'chikun');
  assert.equal(result.manifest.status, 'playable');
  assert.equal(result.manifest.controlScheme, 'tap');
  assert.equal(result.manifest.rankedEligible, true);
  assert.equal(result.manifest.capabilities.includes('ranked'), true);
  assert.equal(result.manifest.capabilities.includes('leaderboard'), true);
});

test('WO-55 Chikun vertical slice has deterministic flap/fork/coin scoring rules', () => {
  const config = buildChikunVerticalSliceConfig();
  assert.equal(config.gameId, 'chikun');
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

test('WO-55 Chikun cabinet emits valid free/ranked SDK events through the public adapter path', () => {
  const cabinet = createChikunCabinet({ sessionId: 'game-session-000000055' });
  const events = [];
  cabinet.adapter.on((message) => events.push(message));

  const ctx = cabinet.init({ mode: 'ranked', displayName: 'Chikun Tester', walletShort: '0x1234…5678', rankedEligible: true });
  assert.equal(ctx.gameId, 'chikun');
  assert.equal(ctx.capabilities.canWriteOfficialState, false);
  cabinet.start({ mode: 'ranked' });
  const result = cabinet.simulate({ seed: 55, taps: [3, 8, 13, 21, 34] });
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
});

test('WO-72 portal model keeps Chikun dev-testable but public coming soon', () => {
  const game = getGame('chikun');
  assert.equal(game.status, 'coming-soon');
  assert.equal(game.devPlayable, true);
  assert.equal(game.systemRole, 'child-dapp-cartridge');
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
  const packet = buildParentSyncPacket(ranked, { score: 155, runStats: { survivalTime: 42, coinsCollected: 3 } });
  assert.equal(packet.childGame.id, 'chikun');
  assert.equal(packet.writeSets.includes('official scores'), true);
});

test('WO-55 Chikun loader returns the vertical slice instead of a placeholder stub', async () => {
  const loaded = await loadChikunGame();
  assert.equal(loaded.manifest.id, 'chikun');
  assert.equal(loaded.manifest.version, 'vertical-slice-v1');
  const entry = loaded.entryPoint({ sessionId: 'game-session-000000056' });
  assert.equal(entry.loaded, true);
  assert.equal(entry.cabinet.id, 'chikun');
  assert.equal(typeof entry.cabinet.simulate, 'function');
});
