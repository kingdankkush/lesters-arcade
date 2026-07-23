import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HMH_BRIDGE_PROTOCOL,
  HMH_MAX_MESSAGE_BYTES,
  createBridgeEnvelope,
  validateChildMessage,
  validateConnectMessage,
  validateParentMessage,
} from '../sdk/hmh-bridge-protocol.mjs';

const settings = Object.freeze({
  musicEnabled: true,
  screenShake: true,
  gore: false,
  reduceMotion: false,
  reduceFlash: false,
  colorblindTags: false,
});

function parentInit(overrides = {}) {
  return createBridgeEnvelope({
    type: 'portal:init',
    sessionId: 'game-session-000000001',
    messageId: 'portal-1',
    payload: {
      gameId: 'lester-blaster',
      mode: 'free',
      heroId: 'male-commando',
      profile: { displayName: 'Guest', locale: 'en' },
      session: { seed: 1234567890, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: false },
      settings,
      ...overrides,
    },
  });
}

test('valid portal init envelope passes exact schema validation', () => {
  const result = validateParentMessage(parentInit());
  assert.equal(result.ok, true);
  assert.equal(result.value.protocol, HMH_BRIDGE_PROTOCOL);
  assert.equal(result.value.payload.gameId, 'lester-blaster');
  assert.equal(result.value.payload.heroId, 'male-commando');
  assert.equal(result.value.payload.session.seed, 1234567890);
});

test('unknown and extra parent fields fail closed', () => {
  const message = parentInit();
  message.payload.walletAddress = '0x1234';
  const result = validateParentMessage(message);
  assert.equal(result.ok, false);
  assert.match(result.error, /unexpected/i);
});

test('wrong protocol and unsupported message type fail closed', () => {
  const wrongProtocol = { ...parentInit(), protocol: 'hmh-bridge/v0' };
  assert.equal(validateParentMessage(wrongProtocol).ok, false);
  const wrongType = { ...parentInit(), type: 'portal:wallet-secret' };
  assert.equal(validateParentMessage(wrongType).ok, false);
});

test('oversized messages are rejected before payload use', () => {
  const oversized = parentInit({ heroId: `hero-${'x'.repeat(HMH_MAX_MESSAGE_BYTES)}` });
  const result = validateParentMessage(oversized);
  assert.equal(result.ok, false);
  assert.match(result.error, /size/i);
});

test('valid child ready envelope passes and wallet-shaped leakage fails', () => {
  const ready = createBridgeEnvelope({
    type: 'game:ready',
    sessionId: 'game-session-000000001',
    messageId: 'game-1',
    payload: {
      runtimeVersion: '0.1.0',
      renderer: 'pixi.js',
      capabilities: ['pause', 'settings', 'restart'],
    },
  });
  assert.equal(validateChildMessage(ready).ok, true);
  ready.payload.wallet = '0x1234';
  assert.equal(validateChildMessage(ready).ok, false);
});

test('connect handshake requires exact protocol, nonce, and type', () => {
  const valid = { protocol: HMH_BRIDGE_PROTOCOL, type: 'portal:connect', nonce: 'nonce-1234567890abcdef' };
  assert.equal(validateConnectMessage(valid).ok, true);
  assert.equal(validateConnectMessage({ ...valid, origin: '*' }).ok, false);
  assert.equal(validateConnectMessage({ ...valid, nonce: 'short' }).ok, false);
});

test('portal lifecycle and settings commands use bounded exact payloads', () => {
  for (const type of ['portal:pause', 'portal:resume', 'portal:restart', 'portal:dispose']) {
    const message = createBridgeEnvelope({ type, sessionId: 'game-session-000000001', messageId: `portal-${type}`, payload: {} });
    assert.equal(validateParentMessage(message).ok, true, type);
    message.payload.reason = 'untrusted';
    assert.equal(validateParentMessage(message).ok, false, `${type} extra field`);
  }
  const update = createBridgeEnvelope({
    type: 'portal:settings',
    sessionId: 'game-session-000000001',
    messageId: 'portal-settings',
    payload: { settings: { ...settings } },
  });
  assert.equal(validateParentMessage(update).ok, true);
  update.payload.settings.gore = 'yes';
  assert.equal(validateParentMessage(update).ok, false);
});

test('child state and game-over messages enforce finite bounded telemetry', () => {
  const state = createBridgeEnvelope({
    type: 'game:state',
    sessionId: 'game-session-000000001',
    messageId: 'game-state-1',
    payload: { status: 'running', score: 1200, kills: 12, elapsedMs: 5500, health: 82, maxHealth: 100, xp: 40, level: 2, paused: false },
  });
  assert.equal(validateChildMessage(state).ok, true);
  state.payload.score = Number.POSITIVE_INFINITY;
  assert.equal(validateChildMessage(state).ok, false);

  const gameOver = createBridgeEnvelope({
    type: 'game:game-over',
    sessionId: 'game-session-000000001',
    messageId: 'game-over-1',
    payload: { score: 4200, kills: 44, elapsedMs: 60000, reason: 'defeated' },
  });
  assert.equal(validateChildMessage(gameOver).ok, true);
  gameOver.payload.reason = '<script>alert(1)</script>';
  assert.equal(validateChildMessage(gameOver).ok, false);
});

test('child errors expose only a bounded code and safe message', () => {
  const error = createBridgeEnvelope({
    type: 'game:error',
    sessionId: 'game-session-000000001',
    messageId: 'game-error-1',
    payload: { code: 'renderer-init-failed', message: 'WebGL initialization failed.' },
  });
  assert.equal(validateChildMessage(error).ok, true);
  error.payload.stack = 'private stack';
  assert.equal(validateChildMessage(error).ok, false);
});

test('child pause exit run score achievement and settings events use exact bounded schemas', () => {
  const validMessages = [
    ['game:pause', { paused: true, source: 'user' }],
    ['game:exit', { reason: 'menu' }],
    ['game:run-event', { tick: 120, sequence: 4, eventType: 'enemy-defeated', value: 1 }],
    ['game:score-result', { score: 4200, kills: 44, elapsedMs: 60000, checksum: 'run-0123456789abcdef' }],
    ['game:achievement', { achievementId: 'first-blood', tick: 120 }],
    ['game:settings', { settings: { ...settings } }],
  ];
  for (const [type, payload] of validMessages) {
    const message = createBridgeEnvelope({
      type,
      sessionId: 'game-session-000000001',
      messageId: `game-${type}`,
      payload,
    });
    assert.equal(validateChildMessage(message).ok, true, type);
    message.payload.walletAddress = '0x1234';
    assert.equal(validateChildMessage(message).ok, false, `${type} rejects extra authority fields`);
  }
});

test('portal init rejects wrong game identity and malformed canonical bindings', () => {
  assert.equal(validateParentMessage(parentInit({ gameId: 'unknown-game' })).ok, false);
  assert.equal(validateParentMessage(parentInit({ profile: { displayName: '<script>', locale: 'en' } })).ok, false);
  assert.equal(validateParentMessage(parentInit({ session: { seed: -1, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: false } })).ok, false);
  assert.equal(validateParentMessage(parentInit({ session: { seed: 1, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: 'yes' } })).ok, false);
});
