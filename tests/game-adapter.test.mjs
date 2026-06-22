import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInProcessGameAdapter, validateInProcessAdapter } from '../apps/portal/src/game-adapter.mjs';

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
});
