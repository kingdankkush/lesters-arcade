import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import test from 'node:test';
import { ethers } from 'ethers';

import { buildSiweChallenge } from '../apps/portal/src/wallet-auth.mjs';
import { issueSessionToken, sanitizeProfileDocument, verifySessionToken, verifySiweLogin, SESSION_TTL_MS } from '../apps/portal/src/server-session.mjs';
import { createNeonClient, neonEndpointFor } from '../apps/portal/src/server-neon.mjs';
import { buildDeps as buildSessionDeps, sessionRequest } from '../api/session.mjs';
import { profileRequest } from '../api/profile.mjs';
import { settleRequest } from '../api/settle.mjs';

/**
 * Owner decisions 2026-09-16: wallet login is the account, profiles sync
 * through a hosted database behind SIWE session tokens, and Ranked scores
 * are settled for the player by a relayer funded from the entry reserve.
 */

const crypto = { createHmac, timingSafeEqual };
const secret = 'x'.repeat(48);
const wallet = new ethers.Wallet(`0x${'55'.repeat(32)}`);
const now = Date.parse('2026-09-16T12:00:00.000Z');

async function signedChallenge(overrides = {}) {
  const challenge = buildSiweChallenge({ domain: 'lestersarcade.io', address: wallet.address, chainId: 4441, nonce: 'abc123def456', issuedAt: new Date(now).toISOString(), ...overrides });
  const signature = await wallet.signMessage(challenge.message);
  return { challenge, signature };
}

test('a SIWE login verifies only a fresh, allowed, exactly-reconstructed challenge signed by the challenged wallet', async () => {
  const { challenge, signature } = await signedChallenge();
  const allowedDomains = ['lestersarcade.io'];
  assert.deepEqual(verifySiweLogin(ethers, { challenge, signature, allowedDomains, nowMs: now + 1000 }), { ok: true, wallet: wallet.address.toLowerCase(), chainId: 4441 });
  assert.deepEqual(verifySiweLogin(ethers, { challenge, signature, allowedDomains, nowMs: now + 1000, expectedChainId: 4441 }), { ok: true, wallet: wallet.address.toLowerCase(), chainId: 4441 });
  assert.equal(verifySiweLogin(ethers, { challenge, signature, allowedDomains: ['evil.example'], nowMs: now }).error, 'domain-not-allowed');
  assert.equal(verifySiweLogin(ethers, { challenge, signature, allowedDomains, nowMs: now + 11 * 60 * 1000 }).error, 'challenge-stale');
  assert.equal(verifySiweLogin(ethers, { challenge: { ...challenge, message: `${challenge.message}!` }, signature, allowedDomains, nowMs: now }).error, 'message-mismatch');
  const other = await new ethers.Wallet(`0x${'66'.repeat(32)}`).signMessage(challenge.message);
  assert.equal(verifySiweLogin(ethers, { challenge, signature: other, allowedDomains, nowMs: now }).error, 'signer-mismatch');
  assert.equal(verifySiweLogin(ethers, { challenge, signature: '0x1234', allowedDomains, nowMs: now }).error, 'invalid-signature');
  // Contract §4.3.2 step 2: E2 passes expectedChainId 4441.
  const mainnet = await signedChallenge({ chainId: 1 });
  assert.equal(verifySiweLogin(ethers, { ...mainnet, allowedDomains, nowMs: now, expectedChainId: 4441 }).error, 'wrong-chain');
  assert.equal(verifySiweLogin(ethers, { ...mainnet, allowedDomains, nowMs: now }).ok, true, 'callers without expectedChainId are unchanged');
});

test('session tokens round-trip, expire, and reject tampering, a short secret, v1 payloads and other audiences', () => {
  const audience = 'lestersarcade:production';
  const { token, expiresAt } = issueSessionToken(crypto, { secret, wallet: wallet.address, nowMs: now, audience });
  assert.equal(expiresAt, now + SESSION_TTL_MS);
  assert.deepEqual(verifySessionToken(crypto, { secret, token, nowMs: now + 5, audience }), { wallet: wallet.address.toLowerCase(), expiresAt });
  assert.equal(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'), `v2|${audience}|${wallet.address.toLowerCase()}|${expiresAt}`, 'contract A13 payload');
  assert.equal(verifySessionToken(crypto, { secret, token, nowMs: expiresAt + 1, audience }), null, 'expired');
  assert.equal(verifySessionToken(crypto, { secret: 'y'.repeat(48), token, nowMs: now, audience }), null, 'wrong secret');
  assert.equal(verifySessionToken(crypto, { secret, token: `${token}a`, nowMs: now, audience }), null, 'tampered');
  assert.equal(verifySessionToken(crypto, { secret, token, nowMs: now, audience: 'lestersarcade:preview' }), null, 'another audience');
  const v1Payload = `${wallet.address.toLowerCase()}|${expiresAt}`;
  const v1 = `${Buffer.from(v1Payload).toString('base64url')}.${createHmac('sha256', secret).update(v1Payload).digest('base64url')}`;
  assert.equal(verifySessionToken(crypto, { secret, token: v1, nowMs: now, audience }), null, 'v1 tokens from the 1.7.0 login die');
  assert.throws(() => issueSessionToken(crypto, { secret: 'short', wallet: wallet.address, audience }), /32 characters/);
  assert.throws(() => issueSessionToken(crypto, { secret, wallet: wallet.address }), /audience/);
});

test('the session endpoint fails closed without a secret and issues a v2 token for a valid server-nonce login', async () => {
  const { createPgliteClient } = await import('./helpers/pglite-client.mjs');
  const { invoke } = await import('./helpers/fake-http.mjs');
  const nonceApi = await import('../api/session-nonce.mjs');
  const env = { VERCEL_ENV: 'development', SESSION_SECRET: secret, NEON_DATABASE_URL: 'postgresql://fixture@db.invalid/settle' };
  const db = createPgliteClient();
  try {
    const { challenge, signature } = await signedChallenge();
    assert.equal((await sessionRequest({ body: { challenge, signature } }, await buildSessionDeps({}, { db, nowMs: now }))).status, 503);
    const nonce = await invoke(nonceApi.createHandler(() => nonceApi.buildDeps(env, { db, nowMs: now })), { url: '/api/session-nonce' });
    assert.equal(nonce.status, 200);
    const login = await signedChallenge({ nonce: nonce.body.nonce, issuedAt: nonce.body.issuedAt });
    const deps = await buildSessionDeps(env, { db, nowMs: now });
    assert.deepEqual((await sessionRequest({ body: { challenge, signature } }, deps)).body, { ok: false, error: 'nonce-invalid' }, 'a browser nonce no longer logs in');
    const ok = await sessionRequest({ body: login }, deps);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.wallet, wallet.address.toLowerCase());
    assert.ok(verifySessionToken(crypto, { secret, token: ok.body.token, nowMs: now, audience: 'lestersarcade:development' }));
    assert.equal((await sessionRequest({ body: { challenge: login.challenge, signature: `0x${'00'.repeat(65)}` } }, deps)).status, 401);
  } finally {
    await db.close();
  }
});

test('profile documents are bounded and profile sync needs the database, a session token for writes, and nothing for reads', async () => {
  const doc = sanitizeProfileDocument({ handle: 'Lit<script>Commando', avatar: '🎮', xp: 12.7, runHistory: Array.from({ length: 60 }, (_, i) => ({ sessionId: `s${i}`, gameId: 'lester-blaster', score: i, envelopeHash: 'A'.repeat(64) })), achievements: ['a', 'a', 'b'], preferences: { theme: 'dark' } });
  assert.equal(doc.handle, 'LitscriptCommando');
  assert.equal(doc.xp, 13);
  assert.equal(doc.runHistory.length, 50);
  assert.equal(doc.runHistory[0].envelopeHash, 'a'.repeat(64));
  assert.deepEqual(doc.achievements, ['a', 'b']);
  assert.deepEqual(doc.preferences, { theme: 'dark' });
  // Guide §5.2 item 5: ISO timestamps, emoji avatars and 0x envelope hashes survive.
  assert.equal(doc.avatar, '🎮', 'emoji avatars are kept');
  const iso = sanitizeProfileDocument({ runHistory: [{ sessionId: 'game-session-1', gameId: 'chikun', recordedAt: '2026-09-23T10:05:00.123Z', envelopeHash: `0x${'B'.repeat(64)}` }] }).runHistory[0];
  assert.equal(iso.recordedAt, '2026-09-23T10:05:00.123Z', 'recordedAt keeps : - T . Z');
  assert.equal(iso.envelopeHash, `0x${'b'.repeat(64)}`, '0x-prefixed envelope hashes are stored lowercase with 0x');
  assert.equal(sanitizeProfileDocument({ runHistory: [{ sessionId: 's', gameId: 'g', recordedAt: '2026-09-23T10:05:00Z<img src=x>' }] }).runHistory[0].recordedAt, '2026-09-23T10:05:00Z', 'markup is still stripped');
  assert.equal(sanitizeProfileDocument({ runHistory: [{ sessionId: 's', gameId: 'g', envelopeHash: `0x${'b'.repeat(63)}` }] }).runHistory[0].envelopeHash, null);
  assert.equal(sanitizeProfileDocument({ avatar: '👩🏽‍🚀' }).avatar, '👩🏽‍🚀', 'a multi-codepoint emoji avatar within 8 UTF-16 units is kept');
  assert.equal(sanitizeProfileDocument({ avatar: '🏳️‍🌈👩🏽‍🚀' }).avatar, '🏳️‍🌈', 'avatars are cut at 8 UTF-16 units on a whole character');
  assert.equal(sanitizeProfileDocument({ avatar: '<b>🎮</b>' }).avatar, 'b🎮b', 'markup characters are dropped from avatars');

  assert.equal(neonEndpointFor('postgresql://user:pw@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require'), 'https://ep-cool-123.us-east-2.aws.neon.tech/sql');
  assert.throws(() => neonEndpointFor('mysql://x'), /postgres/);
  assert.equal(createNeonClient({ connectionString: '' }), null);

  // E6 / E7 (contract §4.3.6): the profile is server-derived and PUT accepts
  // preferences only. The database starts unmigrated: the handler must call
  // ensureSchema itself (A34).
  const { buildDeps } = await import('../api/profile.mjs');
  const { createPgliteClient } = await import('./helpers/pglite-client.mjs');
  assert.equal((await profileRequest({ method: 'GET', query: { wallet: wallet.address } }, await buildDeps({}))).status, 503, 'no database url fails closed');
  const client = createPgliteClient();
  try {
    const env = { VERCEL_ENV: 'development', SESSION_SECRET: secret };
    const deps = await buildDeps(env, { db: client, nowMs: now });
    const empty = await profileRequest({ method: 'GET', query: { wallet: wallet.address } }, deps);
    assert.equal(empty.status, 200);
    assert.equal(empty.body.profile.displayName, null);
    assert.equal((await profileRequest({ method: 'PUT', headers: {}, body: { preferences: {} } }, deps)).status, 401);
    const { token } = issueSessionToken(crypto, { secret, wallet: wallet.address, nowMs: now, audience: 'lestersarcade:development' });
    const written = await profileRequest({ method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: { ...doc, handle: 'Ace Pilot', preferences: { selectedCharacterId: 'ace-pilot' } } }, deps);
    assert.equal(written.status, 200);
    assert.equal(written.body.wallet, wallet.address.toLowerCase());
    assert.deepEqual(written.body.preferences, { selectedCharacterId: 'ace-pilot' });
    const read = await profileRequest({ method: 'GET', query: { wallet: wallet.address.toUpperCase().replace('0X', '0x'), self: '1' }, headers: { authorization: `Bearer ${token}` } }, deps);
    assert.equal(read.status, 200);
    assert.equal(read.body.preferences.selectedCharacterId, 'ace-pilot');
    assert.equal(read.body.profile.displayName, null, 'names are never accepted from the browser');
  } finally {
    await client.close();
  }
});

test('relayed settlement returns the attestation without a relayer and relays it with one', async () => {
  const verifier = new ethers.Wallet(`0x${'11'.repeat(32)}`);
  const registry = `0x${'33'.repeat(20)}`;
  const body = {
    gameId: 'stacked', sessionId32: ethers.id('game-session-000000042'), player: wallet.address, score: 4200, kills: 0, maxCombo: 4, survivalSeconds: 240,
    envelope: { version: 'lesters-session-envelope-v1', inputHash: 'a'.repeat(64), eventHash: 'b'.repeat(64), finalStateHash: 'c'.repeat(64), envelopeHash: 'd'.repeat(64), identity: { wallet: wallet.address } },
    runtimeId: 'stacked:1.6.0', seasonId: 'stacked-season-preview-1', achievements: ['stacked-first-quad'],
  };
  const env = { VERIFIER_PRIVATE_KEY: verifier.privateKey, SCORE_REGISTRY_ADDRESS: registry };
  const unrelayed = await settleRequest(body, { env, now: () => 1_700_000_000 });
  assert.equal(unrelayed.status, 200);
  assert.equal(unrelayed.body.relayed, false);
  assert.ok(unrelayed.body.signature);
  const relayerKey = `0x${'77'.repeat(32)}`;
  const sent = [];
  const providerFactory = () => ({
    // Enough of an ethers provider for Contract calls in the relay path.
    async call({ to, data }) {
      const iface = new ethers.Interface(['function getSession(bytes32) view returns (tuple(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId, uint64 submittedAt, bool verified, bool exists))', 'function relayers(address) view returns (bool)']);
      const parsed = iface.parseTransaction({ data });
      if (parsed.name === 'getSession') return iface.encodeFunctionResult('getSession', [[ethers.ZeroHash, ethers.ZeroAddress, ethers.ZeroHash, 0n, 0n, 0n, 0n, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash, 0n, false, false]]);
      if (parsed.name === 'relayers') return iface.encodeFunctionResult('relayers', [true]);
      throw new Error(`unexpected call ${parsed.name} to ${to}`);
    },
    async getNetwork() { return { chainId: 4441n }; },
    async resolveName(name) { return name; },
    async estimateGas() { return 300000n; },
    async getFeeData() { return { gasPrice: 1_000_000_000n, maxFeePerGas: null, maxPriorityFeePerGas: null }; },
    async getTransactionCount() { return 0; },
    async broadcastTransaction(raw) { sent.push(raw); const hash = ethers.keccak256(raw); return { hash, wait: async () => ({ blockNumber: 1 }) }; },
    async getBlock() { return { baseFeePerGas: null }; },
    async getBlockNumber() { return 2; },
    async getTransactionReceipt(hash) { return { hash, blockNumber: 1, blockHash: ethers.ZeroHash, status: 1, logs: [], gasUsed: 1n, cumulativeGasUsed: 1n, gasPrice: 1n, from: ethers.ZeroAddress, to: registry, index: 0, type: 2, logsBloom: `0x${'00'.repeat(256)}`, contractAddress: null, root: null, blobGasUsed: null, blobGasPrice: null, confirmations: async () => 2 }; },
    async getTransaction(hash) { return { hash, blockNumber: 1 }; },
  });
  const relayed = await settleRequest(body, { env: { ...env, RELAYER_PRIVATE_KEY: relayerKey }, now: () => 1_700_000_000, providerFactory });
  assert.equal(relayed.status, 200, JSON.stringify(relayed.body).slice(0, 300));
  assert.equal(relayed.body.relayed, true);
  assert.equal(relayed.body.relayer, new ethers.Wallet(relayerKey).address);
  assert.match(relayed.body.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(sent.length, 1, 'exactly one transaction was broadcast');
  assert.equal((await settleRequest({ ...body, gameId: 'lester-blaster', score: 9_000_000_000, survivalSeconds: 2 }, { env, now: () => 1_700_000_000 })).status, 422, 'implausible HMH runs are never relayed');
});
