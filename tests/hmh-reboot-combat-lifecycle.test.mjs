import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerDefeatController } from '../apps/hmh-reboot/src/combat-lifecycle.mjs';
import {
  createBridgeEnvelope,
  validateChildMessage,
} from '../sdk/hmh-bridge-protocol.mjs';

function envelope(type, payload, messageId) {
  return createBridgeEnvelope({
    type,
    sessionId: 'session-phase12-defeat',
    messageId,
    payload,
  });
}

test('player defeat emits one deterministic protocol-valid game-over transition', () => {
  const controller = createPlayerDefeatController({ maxHealth: 100 });
  assert.equal(controller.resolve({ health: 1, kills: 3, elapsedMs: 1_500 }), null);

  const transition = controller.resolve({ health: 0, kills: 3, elapsedMs: 1_500 });
  assert.deepEqual(transition, {
    statePayload: {
      status: 'game-over',
      score: 0,
      kills: 3,
      elapsedMs: 1_500,
      health: 0,
      maxHealth: 100,
      xp: 0,
      level: 1,
      paused: false,
    },
    gameOverPayload: {
      score: 0,
      kills: 3,
      elapsedMs: 1_500,
      reason: 'defeated',
    },
  });
  assert.equal(validateChildMessage(envelope('game:state', transition.statePayload, 'game-defeat-state')).ok, true);
  assert.equal(validateChildMessage(envelope('game:game-over', transition.gameOverPayload, 'game-defeat-over')).ok, true);
  assert.equal(controller.resolve({ health: 0, kills: 3, elapsedMs: 1_517 }), null);
});

test('player defeat controller fails closed for invalid public state', () => {
  const controller = createPlayerDefeatController();
  assert.throws(() => controller.resolve({ health: -1, kills: 0, elapsedMs: 0 }), /health/);
  assert.throws(() => controller.resolve({ health: 100, kills: -1, elapsedMs: 0 }), /kills/);
  assert.throws(() => controller.resolve({ health: 100, kills: 0, elapsedMs: Number.NaN }), /elapsedMs/);
  assert.throws(() => createPlayerDefeatController({ maxHealth: 0 }), /maxHealth/);
});
