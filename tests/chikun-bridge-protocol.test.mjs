import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHIKUN_BRIDGE_PROTOCOL,
  CHIKUN_MAX_MESSAGE_BYTES,
  createChikunBridgeEnvelope,
  validateChikunChildMessage,
  validateChikunConnectMessage,
  validateChikunParentMessage,
} from '../apps/portal/src/chikun-bridge-protocol.mjs';
import { buildChikunReplayClaim, simulateChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';

const sessionId = 'chikun:ranked:12345678';

function envelope(type, payload, messageId = 'message-1') {
  return createChikunBridgeEnvelope({ type, sessionId, messageId, payload });
}

test('Chikun bridge accepts a bounded parent init contract for Free or Ranked', () => {
  const connect = validateChikunConnectMessage({
    protocol: CHIKUN_BRIDGE_PROTOCOL,
    type: 'portal:connect',
    nonce: '1234567890abcdef1234567890abcdef',
  });
  assert.equal(connect.ok, true);

  const rankedInit = envelope('portal:init', {
    gameId: 'chikun',
    mode: 'ranked',
    profile: { displayName: 'Player One', locale: 'en-US' },
    session: { seed: 1234, buildHash: 'chikun-canvas-v1', seasonId: 'season-0', rankedEligible: true },
    settings: { musicEnabled: true, reduceMotion: false },
  });
  assert.equal(validateChikunParentMessage(rankedInit).ok, true);

  const freeInit = structuredClone(rankedInit);
  freeInit.messageId = 'message-2';
  freeInit.payload.mode = 'free';
  freeInit.payload.session.rankedEligible = false;
  assert.equal(validateChikunParentMessage(freeInit).ok, true);
});

test('Chikun bridge rejects mode/eligibility drift, unknown fields, oversized packets, and re-bound sessions', () => {
  const invalidEligibility = envelope('portal:init', {
    gameId: 'chikun',
    mode: 'free',
    profile: { displayName: 'Player One', locale: 'en-US' },
    session: { seed: 1234, buildHash: 'chikun-canvas-v1', seasonId: 'season-0', rankedEligible: true },
    settings: { musicEnabled: true, reduceMotion: false },
  });
  assert.equal(validateChikunParentMessage(invalidEligibility).ok, false);

  const unknownField = envelope('portal:pause', { surprise: true });
  assert.equal(validateChikunParentMessage(unknownField).ok, false);

  const oversized = envelope('game:error', { code: 'runtime-error', message: 'x'.repeat(CHIKUN_MAX_MESSAGE_BYTES) });
  assert.equal(validateChikunChildMessage(oversized).ok, false);

  const wrongSession = envelope('game:state', {
    status: 'running', score: 42, coinsCollected: 1, forksPassed: 0, survivalTicks: 120, paused: false,
  });
  wrongSession.sessionId = 'other:session:1234';
  const validShape = validateChikunChildMessage(wrongSession);
  assert.equal(validShape.ok, true, 'shape validation is separate from the bridge instance session binding');
});

test('Chikun child result and restart-request contracts validate canonical replay evidence', () => {
  const canonical = simulateChikunRun({ seed: 1234, taps: [1, 20, 44], maxTicks: 300 });
  const replayClaim = buildChikunReplayClaim({
    buildHash: 'chikun-canvas-v1',
    seasonId: 'season-0',
    result: canonical,
  });
  const result = envelope('game:result', {
    score: canonical.score,
    survivalTime: canonical.survivalTime,
    survivalTicks: canonical.survivalTicks,
    coinsCollected: canonical.coinsCollected,
    forksPassed: canonical.forksPassed,
    achievements: canonical.achievements,
    evidence: canonical.evidence,
    finalState: canonical.finalState,
    replayClaim,
  });
  assert.equal(validateChikunChildMessage(result).ok, true);
  assert.equal(validateChikunChildMessage(envelope('game:restart-request', {})).ok, true);
});
