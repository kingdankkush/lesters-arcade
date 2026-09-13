import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARCADE_GAMES, LESTERS_ARCADE_V2_APP_SHELL, getCartridgeSelectModel, buildGameModeSelectModel } from '../apps/portal/src/arcade-core.mjs';
import { getCabinetLaunchReadiness } from '../apps/portal/src/game-registry.mjs';

test('public STACKED cabinet and normal play route agree across all launch registries', () => {
  const manifest = JSON.parse(readFileSync(new URL('../apps/portal/games/stacked/game.manifest.json', import.meta.url)));
  const game = ARCADE_GAMES.find(game => game.id === 'stacked');
  const shell = LESTERS_ARCADE_V2_APP_SHELL.cabinets.find(game => game.id === 'stacked');
  const cartridge = getCartridgeSelectModel().find(game => game.id === 'stacked');
  assert.equal(manifest.status, 'playable');
  assert.equal(game.status, 'playable');
  assert.equal(game.publicPlayable, true);
  assert.equal(shell.status, 'playable');
  assert.equal(shell.playable, true);
  assert.equal(cartridge.playable, true);
  assert.equal(cartridge.routePath, '/play/stacked');
  assert.deepEqual(getCabinetLaunchReadiness('stacked'), { ready: true, reason: null });
  assert.equal(game.entryFeeMicroUsdc, 0);
  assert.equal(manifest.devWallet, null);
  assert.deepEqual(manifest.endpoints, []);
});

test('beta mode selection explicitly discloses local-only Ranked and isolated Free play', () => {
  const model = buildGameModeSelectModel('stacked');
  assert.match(model.copy, /beta/i);
  assert.match(model.ranked.label, /local/i);
  assert.match(model.ranked.copy, /No fees, prizes or online ranking/);
  assert.equal(model.ranked.requiresZkLtc, false);
  assert.equal(model.free.official, false);
  assert.match(model.free.copy, /no profile progress, leaderboard placement, or chain writes/);
});
