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

test('truthful Ranked copy in preview and live', () => {
  const model = buildGameModeSelectModel('stacked');
  assert.match(model.copy, /beta/i);
  assert.equal(model.ranked.label, 'Play Ranked');
  assert.match(model.ranked.copy, /replay verification/);
  assert.match(model.copy, /replay-verified/);
  // Neither preview nor launch wording: no claim that results stay local, and
  // no claim that they are already published.
  for (const text of [model.copy, model.ranked.label, model.ranked.copy]) {
    assert.doesNotMatch(text, /local only|this device only|online scores .* not enabled|no fees|preview/i);
    assert.doesNotMatch(text, /on-chain|published|LitVM/i);
  }
  // Live Ranked needs zkLTC (the faucet link shows only when SETTLEMENT_LIVE).
  assert.equal(model.ranked.requiresZkLtc, true);
  assert.equal(model.free.official, false);
  assert.match(model.free.copy, /no profile progress, leaderboard placement, or chain writes/);
});
