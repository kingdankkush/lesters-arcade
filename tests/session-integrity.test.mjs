import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createCanonicalSessionHandle,
  createCanonicalSessionIdentity,
  createSessionEvidenceState,
  recordSessionInput,
  recordSessionEvent,
  finalizeSessionEvidence,
} from '../apps/portal/src/session-integrity.mjs';

const WALLET = `0x${'a'.repeat(40)}`;
const REGISTRY = `0x${'b'.repeat(40)}`;

const context = (overrides = {}) => ({
  sessionId: 'game-session-123e4567-e89b-42d3-a456-426614174000',
  chainId: 504,
  scoreRegistryAddress: REGISTRY,
  wallet: WALLET,
  gameId: 'lester-blaster',
  seasonId: 'season-2026-03',
  buildHash: 'hmh-1.1.2',
  seed: 1337,
  nonce: '123e4567-e89b-42d3-a456-426614174000',
  ...overrides,
});

test('canonical session handles are URL-safe UUID-backed public identifiers', () => {
  const handle = createCanonicalSessionHandle({
    uuid: '123E4567-E89B-42D3-A456-426614174000',
  });
  assert.equal(handle, 'game-session-123e4567-e89b-42d3-a456-426614174000');
  assert.match(handle, /^game-session-[0-9a-f-]{36}$/);
});

test('canonical session identity normalizes context and changes when any binding changes', async () => {
  const base = await createCanonicalSessionIdentity(context());
  const same = await createCanonicalSessionIdentity(context());
  assert.equal(base.sessionKey, same.sessionKey);
  assert.equal(base.wallet, WALLET);
  assert.equal(base.sessionKey.length, 66);

  for (const [field, value] of [
    ['chainId', 505],
    ['scoreRegistryAddress', `0x${'c'.repeat(40)}`],
    ['wallet', `0x${'d'.repeat(40)}`],
    ['gameId', 'chikun'],
    ['seasonId', 'season-2026-04'],
    ['buildHash', 'hmh-1.1.3'],
    ['seed', 1338],
    ['nonce', 'different-nonce'],
  ]) {
    const changed = await createCanonicalSessionIdentity(context({ [field]: value }));
    assert.notEqual(changed.sessionKey, base.sessionKey, `${field} must bind the key`);
  }
});

test('session evidence deduplicates unchanged input and preserves ordered gameplay events', () => {
  const evidence = createSessionEvidenceState({ sessionId: context().sessionId });
  assert.equal(recordSessionInput(evidence, { step: 1, moveX: 1, moveY: 0, aimX: 0.5, aimY: -0.5, shoot: true }), true);
  assert.equal(recordSessionInput(evidence, { step: 2, moveX: 1, moveY: 0, aimX: 0.5, aimY: -0.5, shoot: true }), false);
  assert.equal(recordSessionInput(evidence, { step: 3, moveX: 0, moveY: 0, aimX: 0.5, aimY: -0.5, shoot: false }), true);
  recordSessionEvent(evidence, { step: 3, type: 'kill', payload: { enemyId: 'fud-goblin', score: 100 } });
  recordSessionEvent(evidence, { step: 4, type: 'boss-phase', payload: { bossId: 'rug-pull-baron', phase: 2 } });
  assert.equal(evidence.inputs.length, 2);
  assert.deepEqual(evidence.events.map((event) => event.type), ['kill', 'boss-phase']);
});

test('final evidence hashes are deterministic and any stream or final-state tamper changes the envelope', async () => {
  async function build({ eventScore = 100, finalScore = 1000 } = {}) {
    const evidence = createSessionEvidenceState({ sessionId: context().sessionId });
    recordSessionInput(evidence, { step: 1, moveX: 1, moveY: 0, aimX: 0, aimY: -1, shoot: true });
    recordSessionEvent(evidence, { step: 2, type: 'kill', payload: { enemyId: 'fud-goblin', score: eventScore } });
    return finalizeSessionEvidence({
      identity: context(),
      evidence,
      finalState: { score: finalScore, kills: 1, maxCombo: 1, survivalSeconds: 12.5, hp: 80, level: 2 },
    });
  }

  const base = await build();
  const same = await build();
  assert.deepEqual(base, same);
  for (const key of ['sessionKey', 'inputHash', 'eventHash', 'finalStateHash', 'envelopeHash']) {
    assert.match(base[key], /^0x[0-9a-f]{64}$/, key);
  }
  assert.notEqual((await build({ eventScore: 101 })).envelopeHash, base.envelopeHash);
  assert.notEqual((await build({ finalScore: 1001 })).envelopeHash, base.envelopeHash);
});

test('portal runtime allocates canonical handles and wires evidence into gameplay and settlement', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  const chainClient = readFileSync(new URL('../apps/portal/src/litvm-chain-client.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /nextGlobalSessionId\(state\)/);
  assert.match(main, /recordSessionInput\(currentSession\.evidence/);
  assert.match(main, /recordSessionEvent\(currentSession\.evidence/);
  assert.match(main, /finalizeSessionEvidence\(/);
  assert.match(main, /saveActiveSessionCheckpoint\(/);
  assert.match(main, /clearActiveSessionCheckpoint\(/);
  assert.match(chainClient, /sessionKey/);
  assert.match(chainClient, /isBytes32Hex\(sessionKey\)/);
});
