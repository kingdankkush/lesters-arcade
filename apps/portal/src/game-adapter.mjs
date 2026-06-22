// Lester's Arcade — In-Process SDK Adapter
//
// Bridges the in-process HMH game runtime to the Arcade SDK event system.
// This is the transitional step before moving HMH into a sandboxed iframe:
// the adapter wraps the game's start/pause/resume/end lifecycle and emits
// the arcade.* event schema so the parent portal can track game state.
//
// When Chikun's Escape is onboarded, it will use the same adapter pattern
// (or a sandboxed iframe version) to integrate with the portal.
//
// Usage:
//   const adapter = createInProcessGameAdapter({ gameId: 'hard-money-heroes' });
//   adapter.start({ mode: 'free', characterId: 'lester' });
//   adapter.emitStatUpdate({ score: 4200, kills: 12 });
//   adapter.end({ score: 4200, kills: 12, survived: 320 });

import { buildArcadeMessage, validateEventPayload, SDK_EVENTS } from './arcade-sdk.mjs';

export function createInProcessGameAdapter({ gameId = null } = {}) {
  if (!gameId) throw new Error('createInProcessGameAdapter requires { gameId }');

  let state = 'idle'; // idle | starting | running | paused | ended
  let seq = 0;
  const listeners = new Set();
  const stats = { score: 0, kills: 0, survived: 0, powerUpsCollected: 0 };

  function emit(type, payload = {}) {
    const validation = validateEventPayload(type, payload);
    if (!validation.valid) {
      console.warn(`[SDK Adapter] Invalid event payload for ${type}:`, validation.errors);
      return null;
    }
    const message = buildArcadeMessage(type, payload, { gameId, seq: seq++ });
    listeners.forEach((fn) => {
      try { fn(message); } catch (e) { console.warn('[SDK Adapter] Listener error:', e); }
    });
    return message;
  }

  return {
    gameId,
    getState: () => state,
    getStats: () => ({ ...stats }),

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    start(sessionConfig = {}) {
      state = 'starting';
      emit(SDK_EVENTS[0], { gameId, sessionConfig }); // arcade.ready
      state = 'running';
      emit(SDK_EVENTS[1], { gameId, mode: sessionConfig.mode || 'free', ...sessionConfig }); // arcade.sessionStart
      return true;
    },

    pause() {
      if (state !== 'running') return false;
      state = 'paused';
      return true;
    },

    resume() {
      if (state !== 'paused') return false;
      state = 'running';
      return true;
    },

    emitStatUpdate(partial = {}) {
      if (state !== 'running') return false;
      Object.assign(stats, partial);
      emit(SDK_EVENTS[2], { gameId, ...stats }); // arcade.statUpdate
      return true;
    },

    emitAchievement(achievementId) {
      return emit(SDK_EVENTS[3], { gameId, achievementId }) !== null; // arcade.achievement
    },

    submitScore(score, runStats = {}) {
      if (state !== 'running' && state !== 'ended') return false;
      emit(SDK_EVENTS[4], { gameId, score, ...runStats }); // arcade.scoreSubmit
      return true;
    },

    end(result = {}) {
      if (state === 'ended') return false;
      state = 'ended';
      Object.assign(stats, result);
      emit(SDK_EVENTS[5], { gameId, ...stats }); // arcade.gameOver
      return true;
    },

    teardown() {
      state = 'idle';
      listeners.clear();
      Object.keys(stats).forEach((k) => { stats[k] = 0; });
      seq = 0;
    },
  };
}

// Validates the adapter invariants (called during npm test).
export function validateInProcessAdapter() {
  const errors = [];
  const adapter = createInProcessGameAdapter({ gameId: 'test-game' });
  if (adapter.getState() !== 'idle') errors.push('adapter should start idle');
  adapter.start({ mode: 'free' });
  if (adapter.getState() !== 'running') errors.push('adapter should be running after start');
  adapter.emitStatUpdate({ score: 100 });
  if (adapter.getStats().score !== 100) errors.push('stats should update');
  adapter.pause();
  if (adapter.getState() !== 'paused') errors.push('adapter should be paused');
  adapter.resume();
  adapter.end({ score: 100, kills: 5 });
  if (adapter.getState() !== 'ended') errors.push('adapter should be ended');
  adapter.teardown();
  if (adapter.getState() !== 'idle') errors.push('adapter should be idle after teardown');
  return { ok: errors.length === 0, errors };
}
