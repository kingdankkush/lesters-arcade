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

import {
  ARCADE_SDK_VERSION,
  SDK_EVENTS,
  SDK_LIFECYCLE_METHODS,
  authorizeRankedSubmit,
  buildArcadeMessage,
  buildInitContext,
  parseInboundMessage,
  validateEventPayload,
} from './arcade-sdk.mjs';
import { validateGameManifest } from './game-manifest.mjs';

export const CABINET_SDK_V1_PUBLIC_EXPORTS = Object.freeze([
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
]);

function normalizeSurvivalTime(payload = {}) {
  const survivalTime = payload.survivalTime ?? payload.survived ?? payload.survivalSeconds ?? 0;
  return { ...payload, survivalTime };
}

export function createInProcessGameAdapter({ gameId = null, sessionId = null, rankedEligible = false } = {}) {
  if (!gameId) throw new Error('createInProcessGameAdapter requires { gameId }');

  let state = 'idle'; // idle | ready | starting | running | paused | ended
  let seq = 0;
  let initContext = null;
  const listeners = new Set();
  const stats = { score: 0, kills: 0, survivalTime: 0, powerUpsCollected: 0 };

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
    getInitContext: () => initContext,

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    init(context = {}) {
      initContext = buildInitContext({ gameId, sessionId, rankedEligible, ...context });
      state = 'ready';
      return initContext;
    },

    start(sessionConfig = {}) {
      if (!initContext) this.init({ mode: sessionConfig.mode || 'free' });
      state = 'starting';
      emit(SDK_EVENTS[0], {}); // arcade.ready
      state = 'running';
      emit(SDK_EVENTS[1], { mode: sessionConfig.mode || initContext?.mode || 'free' }); // arcade.sessionStart
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
      Object.assign(stats, normalizeSurvivalTime(partial));
      emit(SDK_EVENTS[2], { score: stats.score, kills: stats.kills }); // arcade.statUpdate
      return true;
    },

    emitAchievement(achievementId) {
      return emit(SDK_EVENTS[3], { id: achievementId }) !== null; // arcade.achievement
    },

    submitScore(score, runStats = {}) {
      if (state !== 'running' && state !== 'ended') return false;
      const payload = normalizeSurvivalTime({ ...runStats, score });
      const {
        replayClaim = null,
        score: normalizedScore,
        survivalTime,
        survived: _survived,
        survivalSeconds: _survivalSeconds,
        ...gameRunStats
      } = payload;
      const scorePayload = {
        score: normalizedScore,
        survivalTime,
        runStats: gameRunStats,
        ...(replayClaim ? { replayClaim } : {}),
      };
      return emit(SDK_EVENTS[4], scorePayload) !== null; // arcade.scoreSubmit
    },

    end(result = {}) {
      if (state === 'ended') return false;
      state = 'ended';
      Object.assign(stats, normalizeSurvivalTime(result));
      emit(SDK_EVENTS[5], { score: stats.score }); // arcade.gameOver
      return true;
    },

    teardown() {
      state = 'idle';
      listeners.clear();
      Object.keys(stats).forEach((k) => { stats[k] = 0; });
      seq = 0;
      initContext = null;
    },
  };
}

export function createTemplateCabinetAdapter({ sessionId = null } = {}) {
  return createInProcessGameAdapter({ gameId: 'template-cabinet', sessionId, rankedEligible: false });
}

export function createHardMoneyHeroesCabinetAdapter({ sessionId = null } = {}) {
  return createInProcessGameAdapter({ gameId: 'hard-money-heroes', sessionId, rankedEligible: true });
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
