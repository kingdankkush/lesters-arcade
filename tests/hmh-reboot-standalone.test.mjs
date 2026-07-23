import assert from 'node:assert/strict';
import test from 'node:test';
import { createBridgeEnvelope, validateParentMessage } from '../sdk/hmh-bridge-protocol.mjs';
import { createStandaloneInitPayload } from '../apps/hmh-reboot/src/standalone-session.mjs';

test('standalone development payload uses the same validated canonical init contract', () => {
  const first = createStandaloneInitPayload();
  const second = createStandaloneInitPayload();
  assert.deepEqual(second, first, 'standalone fallback must be deterministic');
  assert.equal(first.gameId, 'lester-blaster');
  assert.equal(first.mode, 'free');
  assert.equal(first.heroId, 'lit-commando');
  assert.equal(first.profile.displayName, 'Standalone Developer');
  assert.equal(first.session.rankedEligible, false);
  assert.equal(Number.isInteger(first.session.seed), true);
  const envelope = createBridgeEnvelope({
    type: 'portal:init',
    sessionId: 'hmh-standalone-dev',
    messageId: 'standalone-1',
    payload: first,
  });
  assert.equal(validateParentMessage(envelope).ok, true);
});

test('standalone production pilot accepts only the four canonical actor ids', () => {
  for (const heroId of ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']) {
    assert.equal(createStandaloneInitPayload({ heroId }).heroId, heroId);
  }
  assert.throws(() => createStandaloneInitPayload({ heroId: 'max-mempool' }), /unsupported standalone hero/);
});

test('standalone payload is deeply immutable and exposes no authority fields', () => {
  const payload = createStandaloneInitPayload();
  assert.equal(Object.isFrozen(payload), true);
  assert.equal(Object.isFrozen(payload.profile), true);
  assert.equal(Object.isFrozen(payload.session), true);
  assert.equal(Object.isFrozen(payload.settings), true);
  assert.doesNotMatch(JSON.stringify(payload), /wallet|contract|settlement|privateKey/i);
});
