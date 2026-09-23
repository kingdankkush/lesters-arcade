import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import test from 'node:test';
import { ethers } from 'ethers';

import { buildSiweChallenge, isServerNonce, SIWE_STATEMENT } from '../apps/portal/src/wallet-auth.mjs';
import { issueSessionToken, verifySessionToken, verifySiweLogin } from '../apps/portal/src/server-session.mjs';
import { checkSiweNonce, consumeSiweNonce, issueSiweNonce, SIWE_NONCE_TTL_MS } from '../server/auth/siwe-nonce.mjs';
import { ipBucket, verifyBearer } from '../server/http.mjs';
import { migrate } from '../server/neon/migrations.mjs';
import * as nonceApi from '../api/session-nonce.mjs';
import * as sessionApi from '../api/session.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';

/**
 * Contract A13, §4.3.1 (E1) and §4.3.2 (E2): server-issued SIWE nonces that
 * expire in ten minutes and log in once, the domain rule with an absent
 * VERCEL_ENV counted as production, the chain check, and v2 session tokens
 * bound to the deployment's audience. Handlers are mounted through
 * createHandler(() => buildDeps(env, overrides)) against an UNMIGRATED PGlite.
 */

const crypto = { createHmac, timingSafeEqual };
const SESSION_VALUE = `session-fixture-${'5e'.repeat(16)}`;
const OTHER_VALUE = `session-fixture-${'6f'.repeat(16)}`;
const NOW = Date.parse('2026-09-23T12:00:00.000Z');
const IP = '203.0.113.7';
const NEON_URL = 'postgresql://fixture@db.invalid/settle';
const DEV_ENV = Object.freeze({ VERCEL_ENV: 'development', SESSION_SECRET: SESSION_VALUE, NEON_DATABASE_URL: NEON_URL });
const PROD_ENV = Object.freeze({ SESSION_SECRET: SESSION_VALUE, NEON_DATABASE_URL: NEON_URL });
const player = new ethers.Wallet(`0x${'55'.repeat(32)}`);

function mount(api, { db, env = DEV_ENV, nowMs = NOW } = {}) {
  return api.createHandler(() => api.buildDeps(env, { db, nowMs }));
}

async function withDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

async function fetchNonce(db, { env = DEV_ENV, nowMs = NOW } = {}) {
  const response = await invoke(mount(nonceApi, { db, env, nowMs }), { url: '/api/session-nonce', headers: { 'x-forwarded-for': IP } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

async function signedLogin(nonceBody, { domain = 'lestersarcade.io', chainId = 4441, issuedAt = nonceBody.issuedAt, wallet = player, nonce = nonceBody.nonce } = {}) {
  const challenge = buildSiweChallenge({ domain, address: wallet.address, chainId, nonce, issuedAt });
  return { challenge, signature: await wallet.signMessage(challenge.message) };
}

async function postSession(db, body, { env = DEV_ENV, nowMs = NOW } = {}) {
  return invoke(mount(sessionApi, { db, env, nowMs }), { method: 'POST', url: '/api/session', headers: { 'x-forwarded-for': IP }, body });
}

async function fillBucket(db, bucket, hits, nowMs = NOW) {
  await migrate(db);
  const windowStart = Math.floor(Math.floor(nowMs / 1000) / 3600) * 3600;
  await db.query(
    `INSERT INTO rate_limits (bucket, window_start, hits) VALUES ($1, to_timestamp($2::double precision), $3::int)
     ON CONFLICT (bucket, window_start) DO UPDATE SET hits = EXCLUDED.hits`,
    [bucket, String(windowStart), String(hits)],
  );
}

test('server nonce is 72 hex, signed, and expires in ten minutes', async () => {
  const random = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const issued = issueSiweNonce({ secret: SESSION_VALUE, nowMs: NOW, randomBytes: () => random });
  const expiresAtSeconds = Math.floor((NOW + SIWE_NONCE_TTL_MS) / 1000);
  const mac = createHmac('sha256', SESSION_VALUE).update(`siwe-nonce|00112233445566778899aabbccddeeff|${expiresAtSeconds}`).digest('hex').slice(0, 32);
  assert.equal(issued.nonce, `00112233445566778899aabbccddeeff${expiresAtSeconds.toString(16).padStart(8, '0')}${mac}`);
  assert.equal(issued.nonce.length, 72);
  assert.equal(isServerNonce(issued.nonce), true);
  assert.equal(isServerNonce('abc123'), false, 'a browser nonce is not a server nonce');
  assert.equal(isServerNonce(issued.nonce.toUpperCase()), false);
  assert.equal(issued.issuedAt, '2026-09-23T12:00:00.000Z');
  assert.equal(issued.expiresAt, '2026-09-23T12:10:00.000Z');
  assert.deepEqual(checkSiweNonce(issued.nonce, { secret: SESSION_VALUE, nowMs: NOW + SIWE_NONCE_TTL_MS - 1 }), { ok: true, expiresAtMs: expiresAtSeconds * 1000 });
  assert.equal(SIWE_NONCE_TTL_MS, 600_000);

  await withDb(async (db) => {
    const body = await fetchNonce(db);
    assert.deepEqual(Object.keys(body).sort(), ['expiresAt', 'issuedAt', 'nonce', 'ok']);
    assert.match(body.nonce, /^[0-9a-f]{72}$/);
    assert.equal(Date.parse(body.expiresAt) - Date.parse(body.issuedAt), 600_000);
    assert.equal(body.issuedAt, new Date(NOW).toISOString(), 'issuedAt comes from the server clock');
    assert.equal(checkSiweNonce(body.nonce, { secret: SESSION_VALUE, nowMs: NOW }).ok, true, 'signed with SESSION_SECRET');
    assert.equal(checkSiweNonce(body.nonce, { secret: OTHER_VALUE, nowMs: NOW }).error, 'nonce-invalid', 'another secret cannot vouch for it');
    assert.notEqual((await fetchNonce(db)).nonce, body.nonce, 'every nonce is random');

    const response = await invoke(mount(nonceApi, { db }), { url: '/api/session-nonce?cb=1' });
    assert.deepEqual([response.status, response.body.error], [400, 'invalid-query']);
    await fillBucket(db, `nonce:ip:${ipBucket(IP, SESSION_VALUE)}`, 300);
    const limited = await invoke(mount(nonceApi, { db }), { url: '/api/session-nonce', headers: { 'x-forwarded-for': IP } });
    assert.deepEqual([limited.status, limited.body.error], [429, 'rate-limited'], 'nonce:ip is 300 per hour');
    assert.ok(Number(limited.headers['retry-after']) > 0);
    const otherIp = await invoke(mount(nonceApi, { db }), { url: '/api/session-nonce', headers: { 'x-forwarded-for': '198.51.100.9' } });
    assert.equal(otherIp.status, 200);
  });

  const shortValue = 'x'.repeat(31);
  for (const env of [{ NEON_DATABASE_URL: NEON_URL, VERCEL_ENV: 'development' }, { SESSION_SECRET: shortValue, NEON_DATABASE_URL: NEON_URL }, { SESSION_SECRET: SESSION_VALUE }]) {
    await withDb(async (db) => {
      const overrides = env.NEON_DATABASE_URL ? { db, nowMs: NOW } : { nowMs: NOW };
      const response = await invoke(nonceApi.createHandler(() => nonceApi.buildDeps(env, overrides)), { url: '/api/session-nonce' });
      assert.deepEqual([response.status, response.body], [503, { ok: false, error: 'session-not-configured' }]);
      assert.equal(response.headers['cache-control'], 'no-store');
    });
  }
});

test('tampered or expired nonces are rejected', async () => {
  const { nonce } = issueSiweNonce({ secret: SESSION_VALUE, nowMs: NOW, randomBytes: (size) => Buffer.alloc(size, 7) });
  const flip = (text, index) => `${text.slice(0, index)}${text[index] === '0' ? '1' : '0'}${text.slice(index + 1)}`;
  for (const index of [0, 31, 32, 39, 40, 71]) {
    assert.equal(checkSiweNonce(flip(nonce, index), { secret: SESSION_VALUE, nowMs: NOW }).error, 'nonce-invalid', `character ${index}`);
  }
  for (const bad of [null, '', nonce.slice(1), `${nonce}0`, nonce.toUpperCase(), 'z'.repeat(72)]) {
    assert.equal(checkSiweNonce(bad, { secret: SESSION_VALUE, nowMs: NOW }).error, 'nonce-invalid');
  }
  assert.equal(checkSiweNonce(nonce, { secret: SESSION_VALUE, nowMs: NOW + SIWE_NONCE_TTL_MS }).error, 'nonce-expired');

  await withDb(async (db) => {
    // Through E2: a tampered nonce fails after the signature checks pass.
    const nonceBody = await fetchNonce(db);
    const tampered = await postSession(db, await signedLogin(nonceBody, { nonce: flip(nonceBody.nonce, 50) }));
    assert.deepEqual([tampered.status, tampered.body], [401, { ok: false, error: 'nonce-invalid' }]);
    const browserNonce = await postSession(db, await signedLogin(nonceBody, { nonce: 'abc123def456' }));
    assert.deepEqual([browserNonce.status, browserNonce.body.error], [401, 'nonce-invalid'], 'a browser-generated nonce never logs in');

    // A fresh challenge (issuedAt within the window) cannot revive an old nonce.
    const later = NOW + SIWE_NONCE_TTL_MS + 30_000;
    const expired = await postSession(db, await signedLogin(nonceBody, { issuedAt: new Date(later - 60_000).toISOString() }), { nowMs: later });
    assert.deepEqual([expired.status, expired.body.error], [401, 'nonce-expired']);
    const stale = await postSession(db, await signedLogin(nonceBody), { nowMs: later });
    assert.deepEqual([stale.status, stale.body.error], [401, 'challenge-stale'], 'a stale challenge fails first');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM auth_nonces'))[0].n, 0, 'rejected nonces are never consumed');
  });
});

test('a nonce logs in once and replays fail as nonce-used', async () => withDb(async (db) => {
  const nonceBody = await fetchNonce(db);
  const body = await signedLogin(nonceBody);
  assert.ok(body.challenge.message.includes(SIWE_STATEMENT));
  const first = await postSession(db, body);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(Object.keys(first.body).sort(), ['expiresAt', 'ok', 'token', 'wallet']);
  assert.equal(first.body.wallet, player.address.toLowerCase());
  assert.equal(first.body.expiresAt, NOW + 24 * 60 * 60 * 1000);
  assert.equal(first.headers['cache-control'], 'no-store');
  assert.deepEqual(verifySessionToken(crypto, { secret: SESSION_VALUE, token: first.body.token, nowMs: NOW, audience: 'lestersarcade:development' }), { wallet: player.address.toLowerCase(), expiresAt: first.body.expiresAt });

  const replay = await postSession(db, body);
  assert.deepEqual([replay.status, replay.body], [401, { ok: false, error: 'nonce-used' }]);
  const resigned = await postSession(db, await signedLogin(nonceBody, { issuedAt: new Date(NOW + 1000).toISOString() }), { nowMs: NOW + 2000 });
  assert.deepEqual([resigned.status, resigned.body.error], [401, 'nonce-used'], 'a new signature over the same nonce is still a replay');
  const [row] = await db.query('SELECT wallet, to_char(expires_at AT TIME ZONE \'UTC\', \'YYYY-MM-DD"T"HH24:MI:SS"Z"\') AS expires FROM auth_nonces WHERE nonce = $1', [nonceBody.nonce]);
  assert.deepEqual(row, { wallet: player.address.toLowerCase(), expires: '2026-09-23T12:10:00Z' });
  assert.equal(await consumeSiweNonce(db, { nonce: nonceBody.nonce, wallet: null, expiresAt: Date.parse(nonceBody.expiresAt) }), false);

  const second = await postSession(db, await signedLogin(await fetchNonce(db)));
  assert.equal(second.status, 200, 'a fresh nonce logs in again');

  // Wallet bucket (30/h, after the signature verifies) and IP bucket (300/h).
  await fillBucket(db, `session:w:${player.address.toLowerCase()}`, 30);
  const walletLimited = await postSession(db, await signedLogin(await fetchNonce(db)));
  assert.deepEqual([walletLimited.status, walletLimited.body.error], [429, 'rate-limited']);
  const unsigned = await postSession(db, { challenge: (await signedLogin(await fetchNonce(db))).challenge, signature: `0x${'00'.repeat(65)}` });
  assert.equal(unsigned.status, 401, 'an unverified signature never reaches the wallet bucket');
  await fillBucket(db, `session:ip:${ipBucket(IP, SESSION_VALUE)}`, 300);
  const ipLimited = await postSession(db, { challenge: null, signature: null });
  assert.deepEqual([ipLimited.status, ipLimited.body.error], [429, 'rate-limited']);

  const tooBig = await invoke(mount(sessionApi, { db }), { method: 'POST', url: '/api/session', headers: { 'content-length': String(16 * 1024 + 1) }, body: {} });
  assert.deepEqual([tooBig.status, tooBig.body.error], [413, 'body-too-large']);
  const notObject = await invoke(mount(sessionApi, { db }), { method: 'POST', url: '/api/session', body: '[1,2]' });
  assert.deepEqual([notObject.status, notObject.body.error], [400, 'invalid-body']);
  const wrongMethod = await invoke(mount(sessionApi, { db }), { method: 'GET', url: '/api/session' });
  assert.equal(wrongMethod.status, 405);
  const unconfigured = await invoke(sessionApi.createHandler(() => sessionApi.buildDeps({ NEON_DATABASE_URL: NEON_URL }, { db, nowMs: NOW })), { method: 'POST', url: '/api/session', body });
  assert.deepEqual([unconfigured.status, unconfigured.body.error], [503, 'session-not-configured']);
}));

test('production rejects localhost; development allows it; an absent VERCEL_ENV counts as production', async () => withDb(async (db) => {
  for (const [label, env] of [['absent', PROD_ENV], ['production', { ...PROD_ENV, VERCEL_ENV: 'production' }]]) {
    for (const domain of ['localhost', '127.0.0.1']) {
      const response = await postSession(db, await signedLogin(await fetchNonce(db, { env }), { domain }), { env });
      assert.deepEqual([response.status, response.body.error], [401, 'domain-not-allowed'], `${label} ${domain}`);
    }
    const www = await postSession(db, await signedLogin(await fetchNonce(db, { env }), { domain: 'www.lestersarcade.io' }), { env });
    assert.equal(www.status, 200, `${label}: www.lestersarcade.io is allowed`);
    assert.ok(verifySessionToken(crypto, { secret: SESSION_VALUE, token: www.body.token, nowMs: NOW, audience: 'lestersarcade:production' }), 'production audience');
  }
  const local = await postSession(db, await signedLogin(await fetchNonce(db), { domain: 'localhost' }));
  assert.equal(local.status, 200, 'development allows localhost');
  const loopback = await postSession(db, await signedLogin(await fetchNonce(db), { domain: '127.0.0.1' }));
  assert.equal(loopback.status, 200);
  const evil = await postSession(db, await signedLogin(await fetchNonce(db), { domain: 'evil.example' }));
  assert.deepEqual([evil.status, evil.body.error], [401, 'domain-not-allowed']);
  const pinned = { ...DEV_ENV, SESSION_ALLOWED_DOMAINS: 'play.example' };
  const pinnedLocal = await postSession(db, await signedLogin(await fetchNonce(db, { env: pinned }), { domain: 'localhost' }), { env: pinned });
  assert.deepEqual([pinnedLocal.status, pinnedLocal.body.error], [401, 'domain-not-allowed'], 'SESSION_ALLOWED_DOMAINS replaces the defaults');
}));

test('login on another chain fails as wrong-chain', async () => withDb(async (db) => {
  const wrong = await signedLogin(await fetchNonce(db), { chainId: 1 });
  const response = await postSession(db, wrong);
  assert.deepEqual([response.status, response.body], [401, { ok: false, error: 'wrong-chain' }]);
  const allowedDomains = ['lestersarcade.io'];
  assert.equal(verifySiweLogin(ethers, { ...wrong, allowedDomains, nowMs: NOW }).ok, true, 'callers without expectedChainId behave as before');
  assert.equal(verifySiweLogin(ethers, { ...wrong, allowedDomains, nowMs: NOW, expectedChainId: 4441 }).error, 'wrong-chain');
  const forged = { ...wrong, signature: await new ethers.Wallet(`0x${'66'.repeat(32)}`).signMessage(wrong.challenge.message) };
  assert.equal(verifySiweLogin(ethers, { ...forged, allowedDomains, nowMs: NOW, expectedChainId: 4441 }).error, 'signer-mismatch', 'the signature is checked before the chain');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM auth_nonces'))[0].n, 0, 'a wrong-chain login never spends its nonce');
}));

test('v1 tokens and tokens for another audience are rejected', async () => {
  const wallet = player.address.toLowerCase();
  const expiresAt = NOW + 60_000;
  const sign = (payload) => `${Buffer.from(payload).toString('base64url')}.${createHmac('sha256', SESSION_VALUE).update(payload).digest('base64url')}`;
  const v1 = sign(`${wallet}|${expiresAt}`);
  assert.equal(verifySessionToken(crypto, { secret: SESSION_VALUE, token: v1, nowMs: NOW, audience: 'lestersarcade:production' }), null, 'a live 1.7.0 token dies');
  const v2 = sign(`v2|lestersarcade:production|${wallet}|${expiresAt}`);
  assert.deepEqual(verifySessionToken(crypto, { secret: SESSION_VALUE, token: v2, nowMs: NOW, audience: 'lestersarcade:production' }), { wallet, expiresAt });
  assert.equal(verifySessionToken(crypto, { secret: SESSION_VALUE, token: v2, nowMs: NOW, audience: 'lestersarcade:preview' }), null, 'another audience');
  assert.equal(verifySessionToken(crypto, { secret: SESSION_VALUE, token: v2, nowMs: NOW }), null, 'no audience, no session');
  assert.equal(verifySessionToken(crypto, { secret: SESSION_VALUE, token: sign(`v3|lestersarcade:production|${wallet}|${expiresAt}`), nowMs: NOW, audience: 'lestersarcade:production' }), null);
  assert.equal(verifySessionToken(crypto, { secret: SESSION_VALUE, token: sign(`v2|lestersarcade:production|${wallet}|${expiresAt}|x`), nowMs: NOW, audience: 'lestersarcade:production' }), null);
  assert.equal(verifySessionToken(crypto, { secret: SESSION_VALUE, token: v2, nowMs: expiresAt + 1, audience: 'lestersarcade:production' }), null, 'expired');
  assert.equal(verifySessionToken(crypto, { secret: OTHER_VALUE, token: v2, nowMs: NOW, audience: 'lestersarcade:production' }), null, 'wrong secret');
  assert.throws(() => issueSessionToken(crypto, { secret: SESSION_VALUE, wallet, nowMs: NOW }), /audience/, 'a token always names its audience');
  assert.throws(() => issueSessionToken(crypto, { secret: SESSION_VALUE, wallet, nowMs: NOW, audience: 'a|b' }), /audience/);

  // The Bearer seam uses the deployment's audience: a preview or local token
  // never works in production, even with a shared secret.
  const { token } = issueSessionToken(crypto, { secret: SESSION_VALUE, wallet, nowMs: NOW, audience: 'lestersarcade:development' });
  const devDeps = await sessionApi.buildDeps(DEV_ENV, { db: null, nowMs: NOW });
  const prodDeps = await sessionApi.buildDeps(PROD_ENV, { db: null, nowMs: NOW });
  assert.equal(verifyBearer({ authorization: `Bearer ${token}` }, devDeps)?.wallet, wallet);
  assert.equal(verifyBearer({ authorization: `Bearer ${token}` }, prodDeps), null);
  assert.equal(verifyBearer({ authorization: `Bearer ${v1}` }, prodDeps), null);
  assert.equal(verifyBearer({ authorization: `Bearer ${v2}` }, prodDeps)?.wallet, wallet);
});
