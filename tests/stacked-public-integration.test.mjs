import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ARCADE_GAMES,
  CABINET_MODE_SELECT_PRESENTATIONS,
  LESTERS_ARCADE_V2_APP_SHELL,
  buildGameModeSelectModel,
  buildPlayerArcadeSnapshot,
  connectPlayerAccount,
  createInitialArcadeState,
  recordScore,
  startPlaySession,
} from '../apps/portal/src/arcade-core.mjs';
import {
  ARCADE_GAME_IDS_BY_SLUG,
  ARCADE_GAME_SLUGS,
  buildPlatformShellModel,
  gameIdForSlug,
  gameSlugFor,
} from '../apps/portal/src/arcade-router.mjs';
import { getCabinetLaunchReadiness, getRegisteredGame, listRegisteredGames } from '../apps/portal/src/game-registry.mjs';
import { validateGameManifest } from '../apps/portal/src/game-manifest.mjs';

const manifestUrl = new URL('../apps/portal/games/stacked/game.manifest.json', import.meta.url);

test('STACKED is consistently registered as a hidden development cabinet', async () => {
  const game = ARCADE_GAMES.find((candidate) => candidate.id === 'stacked');
  const cabinet = LESTERS_ARCADE_V2_APP_SHELL.cabinets.find((candidate) => candidate.id === 'stacked');
  const registered = getRegisteredGame('stacked');
  const manifestInput = JSON.parse(await readFile(manifestUrl, 'utf8'));
  const validated = validateGameManifest(manifestInput);

  assert.ok(game);
  assert.ok(cabinet);
  assert.equal(cabinet.gameId, 'stacked');
  assert.equal(CABINET_MODE_SELECT_PRESENTATIONS.stacked?.gameId, 'stacked');
  assert.ok(registered);
  assert.ok(listRegisteredGames().some((candidate) => candidate.id === 'stacked'));
  assert.equal(ARCADE_GAME_SLUGS.stacked, 'stacked');
  assert.equal(ARCADE_GAME_IDS_BY_SLUG.stacked, 'stacked');
  assert.equal(ARCADE_GAME_IDS_BY_SLUG.stack, 'stacked');
  assert.equal(validated.valid, true, validated.errors.join('\n'));
  assert.equal(validated.manifest.id, 'stacked');

  assert.equal(game.status, 'coming-soon');
  assert.equal(game.publicPlayable, false);
  assert.equal(game.devPlayable, true);
  assert.equal(game.entryFeeMicroUsdc, 0);
  assert.equal(game.rankedSeasonId, 'stacked-season-preview-1');
  assert.equal(cabinet.status, game.status);
  assert.equal(registered.status, game.status);
  assert.equal(cabinet.playable, false);
  assert.equal(cabinet.devPlayable, true);
  assert.equal(registered.devWallet, null);
  assert.deepEqual(registered.feeSplit, { dev: 100, platform: 0, liquidity: 0, treasury: 0 });
});

test('STACKED canonical and alias routes do not fall back to HMH', () => {
  assert.equal(gameSlugFor('stacked'), 'stacked');
  assert.equal(gameIdForSlug('stacked'), 'stacked');
  assert.equal(gameIdForSlug('stack'), 'stacked');
  const shell = buildPlatformShellModel('mode-select', { gameSlug: 'stacked', connected: true });
  assert.ok(shell.breadcrumbs.some((crumb) => crumb.label === 'STACKED'));
  assert.ok(buildGameModeSelectModel('stacked'));
});

test('STACKED state slots start empty and progress is created lazily', () => {
  const state = createInitialArcadeState();
  assert.deepEqual(state.leaderboards.stacked, []);
  assert.deepEqual(state.cadenceLeaderboards.stacked, {
    daily: {}, weekly: {}, monthly: {}, yearly: {}, 'all-time': {},
  });

  const wallet = '0x' + '6'.repeat(40);
  connectPlayerAccount(state, wallet);
  const profile = state.profiles[wallet];
  assert.ok(profile.progress.stacked);
  assert.equal(profile.progress.stacked.paidRuns, 0);
  assert.equal(profile.progress.stacked.freeRuns, 0);
  assert.equal(profile.progress.stacked.bestPaidScore, 0);
});

test('STACKED requires the dev gate and Free mode writes no progress or board rows', () => {
  const wallet = '0x' + '7'.repeat(40);
  assert.throws(
    () => startPlaySession({ wallet, gameId: 'stacked', mode: 'free' }),
    /not playable yet/,
  );
  const session = startPlaySession({
    wallet, gameId: 'stacked', mode: 'free', allowDevCabinet: true,
  });
  const state = createInitialArcadeState();
  const result = recordScore(state, session, 9001, { elapsedSeconds: 90 });
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);

  assert.equal(result.acceptedForGlobalLeaderboard, false);
  assert.equal(result.trackingDisabled, true);
  assert.deepEqual(state.leaderboards.stacked, []);
  assert.equal(snapshot.progress.stacked.bestFreeScore, 0);
  assert.equal(snapshot.progress.stacked.freeRuns, 0);
  assert.equal(snapshot.profile.xp, 0);
});

test('the tracked-session caller forwards only the parsed dev-cabinet gate', async () => {
  const source = await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(source, /function beginTrackedSession\(\{ mode \}\)[\s\S]*?allowDevCabinet: DEV_CABINETS_ENABLED,[\s\S]*?\n}/);
});

test('STACKED launch fails closed before wallet preflight or session creation until S-16 mounts its runtime', async () => {
  assert.deepEqual(getCabinetLaunchReadiness('stacked'), {
    ready: false,
    reason: 'STACKED gameplay is staged and will be enabled when its S-16 runtime mount lands.',
  });
  assert.equal(getCabinetLaunchReadiness('lester-blaster').ready, true);
  assert.equal(getCabinetLaunchReadiness('hard-money-heroes').ready, true);
  assert.equal(getCabinetLaunchReadiness('chikun').ready, true);

  const source = await readFile(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const handler = source.match(/async function startOfficialMode\(mode\) \{([\s\S]*?)\n}\n\n\/\/ Ranked PRE-FLIGHT/)?.[1];
  assert.ok(handler, 'startOfficialMode handler must remain inspectable');
  const guardAt = handler.indexOf("getCabinetLaunchReadiness(selectedGameId)");
  const walletAt = handler.indexOf("if (mode === 'ranked')");
  const sessionAt = handler.indexOf('await startMode(');
  assert.ok(guardAt >= 0 && guardAt < walletAt && guardAt < sessionAt,
    'runtime readiness must fail closed before wallet preflight and session start');
  assert.match(handler, /if \(!launch\.ready\)[\s\S]*?return;/);
});
