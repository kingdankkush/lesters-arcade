import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARCADE_SDK_VERSION,
  SDK_LIFECYCLE_METHODS,
  SDK_EVENTS,
  WALLET_ACTION_KINDS,
  buildInitContext,
  buildArcadeMessage,
  parsePostMessageEvent,
  resolveParentTargetOrigin,
  validateEventPayload,
  parseInboundMessage,
  createMessageRateLimiter,
  authorizeRankedSubmit,
} from '../apps/portal/src/arcade-sdk.mjs';

test('SDK exposes the audit §4.2 lifecycle methods and event names', () => {
  for (const m of ['init', 'start', 'pause', 'resume', 'end', 'teardown', 'resize']) {
    assert.ok(SDK_LIFECYCLE_METHODS.includes(m), `missing lifecycle method ${m}`);
  }
  for (const e of [
    'arcade.ready', 'arcade.sessionStart', 'arcade.statUpdate', 'arcade.achievement',
    'arcade.scoreSubmit', 'arcade.gameOver', 'arcade.requestWalletAction',
  ]) {
    assert.ok(SDK_EVENTS.includes(e), `missing event ${e}`);
  }
});

test('buildInitContext gives identity read-only and NO signing capability', () => {
  const ctx = buildInitContext({
    gameId: 'hard-money-heroes',
    sessionId: 'game-session-000000001',
    mode: 'ranked',
    displayName: 'LitChad',
    walletShort: '0x1e57…1e57',
    rankedEligible: true,
  });
  assert.equal(ctx.sdkVersion, ARCADE_SDK_VERSION);
  assert.equal(ctx.gameId, 'hard-money-heroes');
  assert.equal(ctx.mode, 'ranked');
  assert.equal(ctx.player.displayName, 'LitChad');
  // No provider/signer/keys anywhere on the context.
  assert.equal('provider' in ctx, false);
  assert.equal('signer' in ctx, false);
  assert.equal(ctx.capabilities.canWriteOfficialState, false);
  assert.equal(ctx.capabilities.canRequestWalletAction, true);
  assert.equal(Object.isFrozen(ctx), true);
});

test('buildInitContext rejects bad gameId/mode', () => {
  assert.throws(() => buildInitContext({ gameId: '' }));
  assert.throws(() => buildInitContext({ gameId: 'x', mode: 'paid-real-money' }));
});

test('buildInitContext freezes parent-issued deterministic session metadata without exposing signing capability', () => {
  const ctx = buildInitContext({
    gameId: 'chikun',
    sessionId: 'game-session-000000057',
    mode: 'ranked',
    seed: 0xffffffff + 55,
    buildHash: 'chikun-deterministic-core-v1',
    seasonId: 'chikun-season-preview-1',
    rankedEligible: true,
  });

  assert.equal(ctx.seed, 54);
  assert.equal(ctx.buildHash, 'chikun-deterministic-core-v1');
  assert.equal(ctx.seasonId, 'chikun-season-preview-1');
  assert.equal('provider' in ctx, false);
  assert.equal('signer' in ctx, false);
  assert.equal(Object.isFrozen(ctx), true);
});

test('buildArcadeMessage stamps source/version/gameId and rejects unknown types', () => {
  const msg = buildArcadeMessage('arcade.statUpdate', { score: 100, kills: 3 }, { gameId: 'hmh', seq: 5 });
  assert.equal(msg.source, 'lesters-arcade-sdk');
  assert.equal(msg.sdkVersion, ARCADE_SDK_VERSION);
  assert.equal(msg.gameId, 'hmh');
  assert.equal(msg.seq, 5);
  assert.equal(msg.type, 'arcade.statUpdate');
  assert.throws(() => buildArcadeMessage('arcade.hack', {}, { gameId: 'hmh' }));
  assert.throws(() => buildArcadeMessage('arcade.ready', {}, { gameId: '' }));
});

test('validateEventPayload enforces per-event schema', () => {
  assert.equal(validateEventPayload('arcade.ready', {}).valid, true);
  assert.equal(validateEventPayload('arcade.sessionStart', { mode: 'free' }).valid, true);
  assert.equal(validateEventPayload('arcade.sessionStart', { mode: 'bogus' }).valid, false);
  assert.equal(validateEventPayload('arcade.statUpdate', { score: 50 }).valid, true);
  assert.equal(validateEventPayload('arcade.statUpdate', { score: -1 }).valid, false);
  assert.equal(validateEventPayload('arcade.statUpdate', { score: 50, kills: -2 }).valid, false);
  assert.equal(validateEventPayload('arcade.achievement', { id: 'first-blood' }).valid, true);
  assert.equal(validateEventPayload('arcade.achievement', { id: '' }).valid, false);
  assert.equal(validateEventPayload('arcade.scoreSubmit', { score: 900, survivalTime: 120 }).valid, true);
  const replayPayload = {
    score: 900,
    survivalTime: 120,
    runStats: { coinsCollected: 3, forksPassed: 2 },
    replayClaim: {
      version: 'chikun-parent-replay-v1',
      seed: 55,
      buildHash: 'site-1.3.0:game-1.3.0:cabinet-0.2.0',
      seasonId: 'chikun-season-preview-1',
      evidence: { version: 'chikun-flap-evidence-v1', seed: 55, fixedStepHz: 60, maxTicks: 48, flapSteps: [3, 8] },
      finalState: { score: 900 },
    },
  };
  assert.equal(validateEventPayload('arcade.scoreSubmit', replayPayload).valid, true);
  assert.equal(validateEventPayload('arcade.scoreSubmit', { ...replayPayload, runStats: [] }).valid, false);
  assert.equal(validateEventPayload('arcade.scoreSubmit', {
    ...replayPayload,
    replayClaim: { ...replayPayload.replayClaim, padding: 'x'.repeat(70_000) },
  }).valid, false);
  assert.equal(validateEventPayload('arcade.scoreSubmit', { score: 900 }).valid, false); // missing survivalTime
  assert.equal(validateEventPayload('arcade.gameOver', { score: 0 }).valid, true);
  assert.equal(validateEventPayload('arcade.requestWalletAction', { action: 'connect' }).valid, true);
  assert.equal(validateEventPayload('arcade.requestWalletAction', { action: 'drainWallet' }).valid, false);
});

test('parseInboundMessage is the parent security gate', () => {
  const good = buildArcadeMessage('arcade.statUpdate', { score: 10 }, { gameId: 'hmh', seq: 1 });
  const okRes = parseInboundMessage(good, { expectedGameId: 'hmh' });
  assert.equal(okRes.valid, true);

  // wrong source tag rejected
  assert.equal(parseInboundMessage({ ...good, source: 'evil' }, { expectedGameId: 'hmh' }).valid, false);
  // gameId spoofing rejected (cabinet can only speak for its own game)
  assert.equal(parseInboundMessage(good, { expectedGameId: 'other-game' }).valid, false);
  // incompatible sdk major rejected
  assert.equal(parseInboundMessage({ ...good, sdkVersion: '2.0.0' }, { expectedGameId: 'hmh' }).valid, false);
  // bad payload rejected
  const badPayload = buildArcadeMessage('arcade.statUpdate', { score: 5 }, { gameId: 'hmh' });
  assert.equal(parseInboundMessage({ ...badPayload, payload: { score: -5 } }, { expectedGameId: 'hmh' }).valid, false);
  // non-object rejected
  assert.equal(parseInboundMessage('nope').valid, false);
});

test('parsePostMessageEvent rejects spoofed frame source and origin before payload parsing', () => {
  const expectedSourceWindow = { frame: 'real-cabinet' };
  const rogueSourceWindow = { frame: 'rogue' };
  const good = buildArcadeMessage('arcade.statUpdate', { score: 10 }, { gameId: 'hmh', seq: 1 });

  assert.equal(parsePostMessageEvent({ source: expectedSourceWindow, origin: 'https://lestersarcade.io', data: good }, {
    expectedSourceWindow,
    expectedOrigin: 'https://lestersarcade.io',
    expectedGameId: 'hmh',
  }).valid, true);

  const spoofedSource = parsePostMessageEvent({ source: rogueSourceWindow, origin: 'https://lestersarcade.io', data: good }, {
    expectedSourceWindow,
    expectedOrigin: 'https://lestersarcade.io',
    expectedGameId: 'hmh',
  });
  assert.equal(spoofedSource.valid, false);
  assert.ok(spoofedSource.errors.some((error) => error.includes('source')));

  const spoofedOrigin = parsePostMessageEvent({ source: expectedSourceWindow, origin: 'https://evil.example', data: good }, {
    expectedSourceWindow,
    expectedOrigin: 'https://lestersarcade.io',
    expectedGameId: 'hmh',
  });
  assert.equal(spoofedOrigin.valid, false);
  assert.ok(spoofedOrigin.errors.some((error) => error.includes('origin')));
});

test('resolveParentTargetOrigin prefers handshake origin over wildcard posting', () => {
  assert.equal(resolveParentTargetOrigin({ handshakeOrigin: 'https://lestersarcade.io' }), 'https://lestersarcade.io');
  assert.equal(resolveParentTargetOrigin({ referrer: 'https://lestersarcade.io/play/hard-money-heroes' }), 'https://lestersarcade.io');
  assert.equal(resolveParentTargetOrigin({ fallbackOrigin: 'http://localhost:5173' }), 'http://localhost:5173');
  assert.equal(resolveParentTargetOrigin({}), null);
});

test('createMessageRateLimiter throttles floods within a fixed window', () => {
  const rl = createMessageRateLimiter({ windowMs: 1000, maxPerWindow: 3 });
  assert.equal(rl.allow(0), true);
  assert.equal(rl.allow(100), true);
  assert.equal(rl.allow(200), true);
  assert.equal(rl.allow(300), false); // 4th in window -> dropped
  assert.equal(rl.allow(1001), true); // new window -> allowed again
});

test('authorizeRankedSubmit enforces the free/ranked boundary + chain guard', () => {
  // Happy path: ranked, eligible, connected, real wallet, right chain.
  assert.equal(authorizeRankedSubmit({
    mode: 'ranked', rankedEligible: true, walletConnected: true, onExpectedChain: true, isMockWallet: false,
  }).authorized, true);

  // Free runs can never write official state.
  assert.equal(authorizeRankedSubmit({ mode: 'free', rankedEligible: true, walletConnected: true, onExpectedChain: true }).authorized, false);
  // Mock wallet can never submit.
  const mock = authorizeRankedSubmit({ mode: 'ranked', rankedEligible: true, walletConnected: true, onExpectedChain: true, isMockWallet: true });
  assert.equal(mock.authorized, false);
  assert.ok(mock.reasons.some((r) => r.includes('mock wallet')));
  // Wrong chain blocked.
  assert.equal(authorizeRankedSubmit({ mode: 'ranked', rankedEligible: true, walletConnected: true, onExpectedChain: false }).authorized, false);
  // Not eligible blocked.
  assert.equal(authorizeRankedSubmit({ mode: 'ranked', rankedEligible: false, walletConnected: true, onExpectedChain: true }).authorized, false);
  // No wallet blocked.
  assert.equal(authorizeRankedSubmit({ mode: 'ranked', rankedEligible: true, walletConnected: false, onExpectedChain: true }).authorized, false);
});

test('WALLET_ACTION_KINDS is the closed set a game may request', () => {
  assert.deepEqual([...WALLET_ACTION_KINDS].sort(), ['connect', 'getProfile', 'submitRanked'].sort());
});
