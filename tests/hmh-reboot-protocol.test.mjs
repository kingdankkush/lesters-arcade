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
import { HMH_RUN_SUMMARY_CATALOGS as summaryCatalogs } from '../sdk/hmh-run-summary-schema.mjs';
import { projectHmhRuntimeSettings } from '../apps/portal/src/hmh-player-settings.mjs';

const settings = projectHmhRuntimeSettings();

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

function runSummary() {
  return {
    schemaVersion: 1,
    identity: {
      seed: 1234567890,
      buildHash: 'site-106:hmh-wave-6a',
      mode: 'ranked',
      heroId: 'lit-commando',
      terminalReason: 'defeated',
      startTick: 0,
      endTick: 3600,
    },
    totals: {
      survivalTicks: 3600,
      elapsedMs: 60000,
      score: 4200,
      level: 4,
      xp: 1900,
      litecoin: 1,
      currentCombo: 2,
      maxCombo: 12,
      damageDealt: 9000,
      damageTaken: 80,
      healing: 30,
      distanceMilli: 1234567,
    },
    kills: {
      total: 44,
      byEnemyRole: summaryCatalogs.enemyRoles.map((enemyRoleId, index) => ({ enemyRoleId, count: index === 0 ? 44 : 0 })),
      byWeapon: summaryCatalogs.weapons.map((weaponId, index) => ({ weaponId, count: index === 0 ? 44 : 0 })),
      elite: 2,
      boss: 0,
    },
    weapons: summaryCatalogs.weapons.map((weaponId, index) => ({
      weaponId,
      pickups: index === 0 ? 1 : 0,
      swaps: index === 0 ? 2 : 0,
      triggers: index === 0 ? 120 : 0,
      triggerContacts: index === 0 ? 80 : 0,
      projectilesEmitted: index === 0 ? 120 : 0,
      projectileContacts: index === 0 ? 80 : 0,
      reloadStarts: index === 0 ? 5 : 0,
      reloadCompletes: index === 0 ? 5 : 0,
      emptyAttempts: 0,
      equippedTicks: index === 0 ? 3600 : 0,
      damage: index === 0 ? 9000 : 0,
      kills: index === 0 ? 44 : 0,
      criticalHits: index === 0 ? 8 : 0,
      overkill: index === 0 ? 120 : 0,
    })),
    grenades: { thrown: 1, detonated: 1, contacts: 2, kills: 0, selfDamage: 0, overflows: 0 },
    collectibles: summaryCatalogs.collectibles.map((effectId) => ({ effectId, collected: effectId === 'litecoin-token' ? 1 : 0, activeTicks: 0 })),
    upgrades: summaryCatalogs.upgrades.map((upgradeId) => ({ upgradeId, offered: 0, selected: 0 })),
    exploration: {
      visitedDistrictMask: 3,
      discoveredPoiMask: 5,
      revealedCells: 120,
      totalCells: 240,
      revealedPermille: 500,
      distanceMilli: 1234567,
    },
  };
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

test('canonical run-summary capability and exact bounded payload pass validation', () => {
  const ready = createBridgeEnvelope({
    type: 'game:ready',
    sessionId: 'game-session-000000001',
    messageId: 'game-ready-summary',
    payload: { runtimeVersion: '0.5.0', renderer: 'pixi.js', capabilities: ['run-summary'] },
  });
  assert.equal(validateChildMessage(ready).ok, true);
  const envelope = createBridgeEnvelope({
    type: 'game:run-summary',
    sessionId: 'game-session-000000001',
    messageId: 'game-summary-1',
    payload: runSummary(),
  });
  const result = validateChildMessage(envelope);
  assert.equal(result.ok, true, result.error);
  assert.ok(new TextEncoder().encode(JSON.stringify(envelope)).byteLength < HMH_MAX_MESSAGE_BYTES);
});

test('run-summary rejects extra authority fields, wrong catalog rows, inconsistent totals, and out-of-range values', () => {
  const envelope = createBridgeEnvelope({
    type: 'game:run-summary',
    sessionId: 'game-session-000000001',
    messageId: 'game-summary-invalid',
    payload: runSummary(),
  });
  envelope.payload.walletAddress = '0x1234';
  assert.match(validateChildMessage(envelope).error, /unexpected|exact fields/i);
  delete envelope.payload.walletAddress;
  envelope.payload.weapons[0].weaponId = 'unknown-weapon';
  assert.equal(validateChildMessage(envelope).ok, false);
  envelope.payload = runSummary();
  envelope.payload.kills.total = 43;
  assert.equal(validateChildMessage(envelope).ok, false);
  envelope.payload = runSummary();
  envelope.payload.exploration.revealedPermille = 1001;
  assert.equal(validateChildMessage(envelope).ok, false);
  envelope.payload = runSummary();
  envelope.payload.weapons[0].damage = Number.POSITIVE_INFINITY;
  assert.equal(validateChildMessage(envelope).ok, false);
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
