import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CABINET_SDK_V1_PUBLIC_EXPORTS,
  createHardMoneyHeroesCabinetAdapter,
  createInProcessGameAdapter,
  createTemplateCabinetAdapter,
  validateInProcessAdapter,
} from '../apps/portal/src/game-adapter.mjs';
import { parseInboundMessage } from '../apps/portal/src/arcade-sdk.mjs';
import { validateGameManifest } from '../apps/portal/src/game-manifest.mjs';

describe('game-adapter', () => {
  it('starts idle and transitions through the lifecycle', () => {
    const adapter = createInProcessGameAdapter({ gameId: 'test-game' });
    assert.equal(adapter.getState(), 'idle');
    adapter.start({ mode: 'free' });
    assert.equal(adapter.getState(), 'running');
    adapter.pause();
    assert.equal(adapter.getState(), 'paused');
    adapter.resume();
    assert.equal(adapter.getState(), 'running');
    adapter.end({ score: 500 });
    assert.equal(adapter.getState(), 'ended');
    adapter.teardown();
    assert.equal(adapter.getState(), 'idle');
  });

  it('tracks stats via emitStatUpdate', () => {
    const adapter = createInProcessGameAdapter({ gameId: 'test' });
    adapter.start({ mode: 'free' });
    adapter.emitStatUpdate({ score: 100, kills: 2 });
    adapter.emitStatUpdate({ score: 250, kills: 5 });
    assert.equal(adapter.getStats().score, 250);
    assert.equal(adapter.getStats().kills, 5);
    adapter.teardown();
  });

  it('notifies listeners on events', () => {
    const adapter = createInProcessGameAdapter({ gameId: 'test' });
    const events = [];
    adapter.on((msg) => events.push(msg.type));
    adapter.start({ mode: 'free' });
    adapter.emitStatUpdate({ score: 100 });
    adapter.end({ score: 100 });
    assert.ok(events.length >= 3);
    adapter.teardown();
  });

  it('prevents stat updates when not running', () => {
    const adapter = createInProcessGameAdapter({ gameId: 'test' });
    assert.equal(adapter.emitStatUpdate({ score: 100 }), false);
    adapter.start({ mode: 'free' });
    assert.equal(adapter.emitStatUpdate({ score: 100 }), true);
    adapter.teardown();
  });

  it('requires gameId', () => {
    assert.throws(() => createInProcessGameAdapter({}), /gameId/);
  });

  it('validateInProcessAdapter passes all invariants', () => {
    const result = validateInProcessAdapter();
    assert.ok(result.ok, result.errors.join(', '));
  });

  it('WO-54 publishes an explicit Cabinet SDK v1 export surface and template manifest', () => {
    assert.deepEqual([...CABINET_SDK_V1_PUBLIC_EXPORTS].sort(), [
      'ARCADE_SDK_VERSION',
      'SDK_EVENTS',
      'SDK_LIFECYCLE_METHODS',
      'authorizeRankedSubmit',
      'buildArcadeMessage',
      'buildInitContext',
      'createInProcessGameAdapter',
      'createTemplateCabinetAdapter',
      'parseInboundMessage',
      'validateEventPayload',
      'validateGameManifest',
    ].sort());

    const manifestPath = fileURLToPath(new URL('../apps/portal/games/template-cabinet/game.manifest.json', import.meta.url));
    assert.equal(existsSync(manifestPath), true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const result = validateGameManifest(manifest);
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.equal(result.manifest.id, 'template-cabinet');
    assert.equal(result.manifest.rankedEligible, false);
  });

  it('WO-54 template cabinet emits valid free-mode SDK events without official write access', () => {
    const adapter = createTemplateCabinetAdapter({ sessionId: 'game-session-000000054' });
    const events = [];
    adapter.on((message) => events.push(message));

    const ctx = adapter.init({ mode: 'free', displayName: 'Template Tester' });
    assert.equal(ctx.gameId, 'template-cabinet');
    assert.equal(ctx.capabilities.canWriteOfficialState, false);
    adapter.start({ mode: 'free' });
    adapter.emitStatUpdate({ score: 54, kills: 0 });
    adapter.end({ score: 54, survivalTime: 12 });

    assert.deepEqual(events.map((event) => event.type), ['arcade.ready', 'arcade.sessionStart', 'arcade.statUpdate', 'arcade.gameOver']);
    for (const event of events) {
      const parsed = parseInboundMessage(event, { expectedGameId: 'template-cabinet' });
      assert.equal(parsed.valid, true, parsed.errors.join('; '));
    }
  });

  it('WO-54 Hard Money Heroes adapter proves free/ranked parent event compatibility', () => {
    const adapter = createHardMoneyHeroesCabinetAdapter({ sessionId: 'game-session-000000055' });
    const events = [];
    adapter.on((message) => events.push(message));

    const ctx = adapter.init({ mode: 'ranked', displayName: 'HMH Tester', walletShort: '0x1234…abcd', rankedEligible: true });
    assert.equal(ctx.gameId, 'hard-money-heroes');
    assert.equal(ctx.rankedEligible, true);
    adapter.start({ mode: 'ranked', characterId: 'lit-commando' });
    adapter.emitStatUpdate({ score: 1200, kills: 12, survivalTime: 180 });
    adapter.emitAchievement('first-blood');
    adapter.submitScore(1200, { survivalTime: 180, kills: 12, maxCombo: 4 });
    adapter.end({ score: 1200, kills: 12, survivalTime: 180 });

    assert.deepEqual(events.map((event) => event.type), [
      'arcade.ready',
      'arcade.sessionStart',
      'arcade.statUpdate',
      'arcade.achievement',
      'arcade.scoreSubmit',
      'arcade.gameOver',
    ]);
    for (const event of events) {
      const parsed = parseInboundMessage(event, { expectedGameId: 'hard-money-heroes' });
      assert.equal(parsed.valid, true, `${event.type}: ${parsed.errors.join('; ')}`);
    }
    assert.equal(events.find((event) => event.type === 'arcade.achievement').payload.id, 'first-blood');
    assert.equal(events.find((event) => event.type === 'arcade.scoreSubmit').payload.survivalTime, 180);
  });
});
