import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  createWalletSession,
  isV2SessionToken,
  WALLET_CONNECTOR_STORAGE_KEY,
  LOCAL_WALLET_SESSION_STORAGE_KEY,
  WALLET_SESSION_EVENT,
} from '../apps/portal/src/wallet-session.mjs';
import { createProfileSync, SESSION_TOKEN_STORAGE_KEY } from '../apps/portal/src/profile-sync-client.mjs';
import { SIWE_STATEMENT } from '../apps/portal/src/wallet-auth.mjs';
import { issueSessionToken, verifySiweLogin } from '../apps/portal/src/server-session.mjs';
import { loadEthers } from '../apps/portal/src/litvm-chain-client.mjs';

const ethers = await loadEthers();
// Public fixture key (0x11…11), never a real wallet.
const signer = new ethers.Wallet(`0x${'11'.repeat(32)}`);
const ADDRESS = signer.address; // checksummed, as a wallet returns it
const WALLET = ADDRESS.toLowerCase();
const OTHER = `0x${'22'.repeat(20)}`;
const TOKEN_HMAC_FIXTURE = 'fixture-session-hmac-key-at-least-32-characters';
const AUDIENCE = 'lestersarcade:development';
const NOW = Date.parse('2026-09-23T10:00:00.000Z');

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
}

function eventRecorder() {
  const events = [];
  return { events, dispatchEvent(event) { events.push({ type: event.type, detail: event.detail }); return true; } };
}

// An EIP-1193 wallet backed by the fixture key.
function fixtureWallet({ accounts = [ADDRESS], declineSign = false } = {}) {
  const calls = [];
  return {
    calls,
    async request({ method, params = [] }) {
      calls.push(method);
      if (method === 'eth_accounts') return accounts;
      if (method === 'personal_sign') {
        if (declineSign) throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
        assert.equal(params[1], ADDRESS, 'personal_sign gets the address exactly as the wallet presented it');
        return signer.signMessage(params[0]);
      }
      throw new Error(`fixture wallet does not implement ${method}`);
    },
  };
}

// The hosted services: E1 answers a server nonce, E2 verifies the SIWE login
// with the real server check (chain 4441) and issues a real v2 token.
function hostedServer({ nonceStatus = 200, nonceBody = null, loginStatus = 200, loginWallet = null, loginThrows = false } = {}) {
  const requests = [];
  const nonce = 'ab'.repeat(36);
  const issuedAt = new Date(NOW - 3_000).toISOString();
  async function fetchImpl(url, init = {}) {
    requests.push({ url, init });
    if (url === '/api/session/nonce') {
      if (nonceStatus !== 200) return new Response(JSON.stringify({ ok: false, error: 'session-not-configured' }), { status: nonceStatus });
      return new Response(JSON.stringify(nonceBody ?? { ok: true, nonce, issuedAt, expiresAt: new Date(NOW + 600_000).toISOString() }), { status: 200 });
    }
    if (url === '/api/session') {
      if (loginThrows) throw new TypeError('Failed to fetch');
      if (loginStatus !== 200) return new Response(JSON.stringify({ ok: false, error: 'signature-invalid' }), { status: loginStatus });
      if (loginWallet) {
        const token = issueSessionToken(crypto, { secret: TOKEN_HMAC_FIXTURE, wallet: loginWallet, nowMs: NOW, audience: AUDIENCE });
        return new Response(JSON.stringify({ ok: true, wallet: loginWallet, ...token }), { status: 200 });
      }
      const { challenge, signature } = JSON.parse(init.body);
      const verified = verifySiweLogin(ethers, { challenge, signature, allowedDomains: ['lestersarcade.io'], nowMs: NOW, expectedChainId: 4441 });
      if (!verified.ok) return new Response(JSON.stringify({ ok: false, error: verified.error }), { status: 401 });
      if (challenge.nonce !== nonce) return new Response(JSON.stringify({ ok: false, error: 'nonce-invalid' }), { status: 401 });
      const token = issueSessionToken(crypto, { secret: TOKEN_HMAC_FIXTURE, wallet: verified.wallet, nowMs: NOW, audience: AUDIENCE });
      return new Response(JSON.stringify({ ok: true, wallet: verified.wallet, ...token }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }
  return { fetchImpl, requests, nonce, issuedAt };
}

function hostedSession({ storage = memoryStorage(), server = hostedServer(), events = eventRecorder() } = {}) {
  const profileSync = createProfileSync({ fetchImpl: server.fetchImpl, storage, now: () => NOW });
  const session = createWalletSession({
    hosted: true, fetchImpl: server.fetchImpl, storage, now: () => NOW, profileSync, loadEthers,
    domain: 'lestersarcade.io', chainId: 4441, eventTarget: events,
  });
  return { session, profileSync, storage, server, events };
}

test('hosted sign-in fetches a server nonce and uses its issuedAt', async () => {
  const { session, server, profileSync, storage } = hostedSession();
  const wallet = fixtureWallet();
  const result = await session.signIn({ provider: wallet, address: ADDRESS });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.authenticated, true);
  assert.equal(result.wallet, WALLET);
  assert.ok(isV2SessionToken(result.token));

  const [nonceRequest, loginRequest] = server.requests;
  assert.equal(nonceRequest.url, '/api/session/nonce');
  assert.equal(nonceRequest.init.cache, 'no-store');
  assert.equal(loginRequest.url, '/api/session');
  const { challenge } = JSON.parse(loginRequest.init.body);
  assert.equal(challenge.nonce, server.nonce, 'the server nonce, never a browser nonce');
  assert.equal(challenge.issuedAt, server.issuedAt, 'the server issuedAt, so client clock skew cannot make the login stale');
  assert.equal(challenge.chainId, 4441);
  assert.equal(challenge.domain, 'lestersarcade.io');
  assert.equal(challenge.message.split('\n')[1], ADDRESS, 'the message keeps the checksummed address');
  assert.ok(challenge.message.includes(`\n${SIWE_STATEMENT}\n`), 'the shared plain-language statement');
  assert.deepEqual(wallet.calls, ['personal_sign'], 'one signature, no other wallet call');

  // The token lives where profileSync keeps it, and the session API hands it out.
  assert.equal(JSON.parse(storage.getItem(SESSION_TOKEN_STORAGE_KEY)).wallet, WALLET);
  assert.equal(profileSync.hasSession(WALLET), true);
  assert.equal(session.isAuthenticated(WALLET), true);
  assert.equal(session.token(WALLET), result.token);
  assert.equal(session.token(OTHER), null, 'a token is only ever handed out for its own wallet');
});

test('hosted sign-in stays signed out when the session service is down or the wallet declines', async () => {
  const down = hostedSession({ server: hostedServer({ nonceStatus: 503 }) });
  const wallet = fixtureWallet();
  const result = await down.session.signIn({ provider: wallet, address: ADDRESS });
  assert.equal(result.ok, false);
  assert.equal(result.error.kind, 'service-unavailable');
  assert.deepEqual(wallet.calls, [], 'no signature is requested without a server nonce');

  const declined = hostedSession();
  const cancelled = await declined.session.signIn({ provider: fixtureWallet({ declineSign: true }), address: ADDRESS });
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.error.kind, 'user-cancelled');
  assert.equal(declined.session.isAuthenticated(WALLET), false);
  assert.equal(declined.server.requests.some((request) => request.url === '/api/session'), false);
});

test('hosted sign-in stays signed out when the server refuses the login or sends a malformed nonce', async () => {
  // POST /api/session answers 401: a wallet error the player can retry, no token.
  const refused = hostedSession({ server: hostedServer({ loginStatus: 401 }) });
  const result = await refused.session.signIn({ provider: fixtureWallet(), address: ADDRESS });
  assert.deepEqual([result.ok, result.authenticated, result.token], [false, false, null]);
  assert.equal(result.error.kind, 'wallet-error');
  assert.equal(result.error.message, 'The arcade could not verify that signature. Try again.');
  assert.equal(refused.session.isAuthenticated(WALLET), false);
  assert.equal(refused.storage.getItem(SESSION_TOKEN_STORAGE_KEY), null);

  // A login for another wallet is refused, and its token is not kept.
  const other = hostedSession({ server: hostedServer({ loginWallet: OTHER }) });
  const mismatch = await other.session.signIn({ provider: fixtureWallet(), address: ADDRESS });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.error.kind, 'wallet-error');
  assert.equal(other.storage.getItem(SESSION_TOKEN_STORAGE_KEY), null);
  assert.equal(other.profileSync.hasSession(OTHER), false);

  // The session service unreachable after the signature: unavailable, not the player's fault.
  const offline = hostedSession({ server: hostedServer({ loginThrows: true }) });
  const unreachable = await offline.session.signIn({ provider: fixtureWallet(), address: ADDRESS });
  assert.equal(unreachable.error.kind, 'service-unavailable');

  // A nonce that is not 72 lowercase hex characters, or a bad issuedAt: no
  // signature is ever requested.
  for (const nonceBody of [
    { ok: true, nonce: 'ab'.repeat(35), issuedAt: new Date(NOW).toISOString() },
    { ok: true, nonce: 'AB'.repeat(36), issuedAt: new Date(NOW).toISOString() },
    { ok: true, nonce: 'ab'.repeat(36), issuedAt: 'yesterday-ish' },
    { ok: false, nonce: 'ab'.repeat(36), issuedAt: new Date(NOW).toISOString() },
  ]) {
    const malformed = hostedSession({ server: hostedServer({ nonceBody }) });
    const wallet = fixtureWallet();
    const attempt = await malformed.session.signIn({ provider: wallet, address: ADDRESS });
    assert.equal(attempt.ok, false, JSON.stringify(nonceBody));
    assert.equal(attempt.error.kind, 'service-unavailable');
    assert.deepEqual(wallet.calls, [], 'no personal_sign without a valid server nonce');
    assert.equal(malformed.server.requests.some((request) => request.url === '/api/session'), false);
  }
});

test('preview silent restore needs the same wallet and a live local flag', async () => {
  const storage = memoryStorage();
  let fetches = 0;
  const fetchImpl = async () => { fetches += 1; throw new Error('no network in preview'); };
  const first = createWalletSession({ hosted: false, fetchImpl, storage, now: () => NOW, loadEthers, domain: 'localhost', eventTarget: null });
  assert.equal((await first.signIn({ provider: fixtureWallet(), address: ADDRESS })).ok, true);
  first.remember({ kind: 'legacy', wallet: ADDRESS });
  const reboot = (at) => createWalletSession({ hosted: false, fetchImpl, storage, now: () => at, profileSync: null, loadEthers, domain: 'localhost', eventTarget: null });

  const wallet = fixtureWallet();
  const restored = await reboot(NOW + 60_000).restore({ provider: wallet });
  assert.deepEqual({ ...restored }, { ok: true, wallet: WALLET, address: ADDRESS, authenticated: true, providerPending: false });
  assert.deepEqual(wallet.calls, ['eth_accounts']);
  // Another account in the wallet: stays signed out.
  assert.equal((await reboot(NOW + 60_000).restore({ provider: fixtureWallet({ accounts: [OTHER] }) })).ok, false);
  // The local flag lasts 24 h.
  assert.equal((await reboot(NOW + 25 * 60 * 60 * 1000).restore({ provider: fixtureWallet() })).ok, false);
  assert.equal(fetches, 0, 'preview restore never touches the network');
});

test('preview sign-in stays offline', async () => {
  const storage = memoryStorage();
  let fetches = 0;
  const events = eventRecorder();
  const session = createWalletSession({
    hosted: false, fetchImpl: async () => { fetches += 1; throw new Error('no network in preview'); },
    storage, now: () => NOW, profileSync: null, loadEthers, domain: 'localhost', eventTarget: events,
  });
  const wallet = fixtureWallet();
  const result = await session.signIn({ provider: wallet, address: ADDRESS });
  assert.equal(result.ok, true);
  assert.equal(result.authenticated, true);
  assert.equal(result.token, null, 'preview has no server token');
  assert.equal(fetches, 0);
  assert.deepEqual(wallet.calls, ['personal_sign']);
  assert.equal(session.isAuthenticated(WALLET), true, 'the local challenge was recovered with ethers.verifyMessage');
  assert.equal(JSON.parse(storage.getItem(LOCAL_WALLET_SESSION_STORAGE_KEY)).wallet, WALLET);

  // A signature from a different key never authenticates.
  const impostor = new ethers.Wallet(`0x${'33'.repeat(32)}`);
  const bad = await createWalletSession({ hosted: false, storage: memoryStorage(), now: () => NOW, loadEthers, domain: 'localhost', eventTarget: null })
    .signIn({ provider: { request: async ({ params }) => impostor.signMessage(params[0]) }, address: ADDRESS });
  assert.equal(bad.ok, false);
});

test('silent restore needs the same wallet and a live token', async () => {
  // Signed in once (hosted), remembered as an EIP-6963 MetaMask.
  const { session, storage, server } = hostedSession();
  assert.equal((await session.signIn({ provider: fixtureWallet(), address: ADDRESS })).ok, true);
  session.remember({ kind: 'eip6963', rdns: 'io.metamask', wallet: ADDRESS });
  const nonceCalls = server.requests.length;

  // Same browser, next boot: a fresh profileSync reads the stored token.
  const reboot = () => {
    const profileSync = createProfileSync({ fetchImpl: server.fetchImpl, storage, now: () => NOW + 60_000 });
    return createWalletSession({ hosted: true, fetchImpl: server.fetchImpl, storage, now: () => NOW + 60_000, profileSync, loadEthers, domain: 'lestersarcade.io', eventTarget: null });
  };
  const wallet = fixtureWallet();
  const restored = await reboot().restore({ provider: wallet });
  assert.deepEqual({ ...restored }, { ok: true, wallet: WALLET, address: ADDRESS, authenticated: true, providerPending: false });
  assert.deepEqual(wallet.calls, ['eth_accounts'], 'eth_accounts only: never eth_requestAccounts, never a signature');
  assert.equal(server.requests.length, nonceCalls, 'restore makes no network call');

  // Another account in the wallet: stay signed out quietly.
  const switched = await reboot().restore({ provider: fixtureWallet({ accounts: [OTHER] }) });
  assert.equal(switched.ok, false);
  assert.equal(switched.authenticated, false);
  // A locked wallet (no accounts) or no provider at all: signed out.
  assert.equal((await reboot().restore({ provider: fixtureWallet({ accounts: [] }) })).ok, false);
  assert.equal((await reboot().restore({ provider: null })).ok, false);

  // An expired token: signed out.
  const later = createProfileSync({ fetchImpl: server.fetchImpl, storage, now: () => NOW + 25 * 60 * 60 * 1000 });
  const expired = createWalletSession({ hosted: true, storage, now: () => NOW + 25 * 60 * 60 * 1000, profileSync: later, loadEthers, eventTarget: null });
  assert.equal((await expired.restore({ provider: fixtureWallet() })).ok, false);
});

test('a token stored by the 1.7.0 flow is discarded instead of restored or sent', async () => {
  const storage = memoryStorage();
  // v1 payload `wallet|expiresAt`, as the live 1.7.0 /api/session minted it.
  const v1 = `${Buffer.from(`${WALLET}|${NOW + 3_600_000}`).toString('base64url')}.fixture-mac`;
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: WALLET, token: v1, expiresAt: NOW + 3_600_000 }));
  storage.setItem(WALLET_CONNECTOR_STORAGE_KEY, JSON.stringify({ kind: 'legacy', rdns: null, wallet: WALLET }));
  assert.equal(isV2SessionToken(v1), false);
  const profileSync = createProfileSync({ storage, now: () => NOW });
  assert.equal(profileSync.hasSession(WALLET), true, 'profileSync alone would still offer it');
  const session = createWalletSession({ hosted: true, storage, now: () => NOW, profileSync, loadEthers, eventTarget: null });
  assert.equal(session.token(WALLET), null);
  assert.equal((await session.restore({ provider: fixtureWallet() })).ok, false);
  assert.equal(storage.getItem(SESSION_TOKEN_STORAGE_KEY), null, 'the dead token is removed from storage');
});

test('a remembered WalletConnect session restores without creating AppKit', async () => {
  const { session, storage, server } = hostedSession();
  assert.equal((await session.signIn({ provider: fixtureWallet(), address: ADDRESS })).ok, true);
  session.remember({ kind: 'walletconnect', rdns: null, wallet: ADDRESS });
  const requestsBefore = server.requests.length;
  const profileSync = createProfileSync({ fetchImpl: server.fetchImpl, storage, now: () => NOW + 1_000 });
  const reboot = createWalletSession({ hosted: true, fetchImpl: server.fetchImpl, storage, now: () => NOW + 1_000, profileSync, loadEthers, eventTarget: null });
  // Any attempt to reach a provider (and so AppKit) would throw here.
  const restored = await reboot.restore({ provider: { request() { throw new Error('AppKit must not be created at boot'); } } });
  assert.deepEqual({ ...restored }, { ok: true, wallet: WALLET, authenticated: true, providerPending: true });
  assert.equal(server.requests.length, requestsBefore, 'no relay, API or session call at boot');

  // Without a live token it stays signed out, still without touching a provider.
  const empty = memoryStorage({ [WALLET_CONNECTOR_STORAGE_KEY]: JSON.stringify({ kind: 'walletconnect', rdns: null, wallet: WALLET }) });
  const noToken = createWalletSession({ hosted: true, storage: empty, now: () => NOW, profileSync: createProfileSync({ storage: empty, now: () => NOW }), loadEthers, eventTarget: null });
  assert.equal((await noToken.restore({ provider: null })).ok, false);

  // The static source never names AppKit: it is reachable only through
  // walletconnect-provider.mjs, loaded with import() on the player's click.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../apps/portal/src/wallet-session.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*(?:@reown|appkit|walletconnect)/i);
});

test('sign-out clears the token and the remembered connector', async () => {
  const { session, storage, profileSync } = hostedSession();
  assert.equal((await session.signIn({ provider: fixtureWallet(), address: ADDRESS })).ok, true);
  session.remember({ kind: 'eip6963', rdns: 'io.rabby', wallet: ADDRESS });
  assert.deepEqual({ ...session.remembered() }, { kind: 'eip6963', rdns: 'io.rabby', wallet: WALLET });
  session.signOut();
  assert.equal(session.remembered(), null);
  assert.equal(storage.getItem(WALLET_CONNECTOR_STORAGE_KEY), null);
  assert.equal(storage.getItem(SESSION_TOKEN_STORAGE_KEY), null);
  assert.equal(profileSync.hasSession(WALLET), false);
  assert.equal(session.token(WALLET), null);
  assert.equal(session.isAuthenticated(WALLET), false);

  // Preview: the local flag goes too.
  const local = memoryStorage();
  const preview = createWalletSession({ hosted: false, storage: local, now: () => NOW, loadEthers, domain: 'localhost', eventTarget: null });
  await preview.signIn({ provider: fixtureWallet(), address: ADDRESS });
  preview.remember({ kind: 'legacy', wallet: ADDRESS });
  preview.signOut();
  assert.equal(local.getItem(LOCAL_WALLET_SESSION_STORAGE_KEY), null);
  assert.equal(local.getItem(WALLET_CONNECTOR_STORAGE_KEY), null);

  // remember() refuses unknown kinds and malformed wallets.
  preview.remember({ kind: 'mock-wallet', wallet: ADDRESS });
  preview.remember({ kind: 'eip6963', wallet: 'not-a-wallet' });
  assert.equal(preview.remembered(), null);
});

test('events announce session changes', async () => {
  const events = eventRecorder();
  const { session } = hostedSession({ events });
  await session.signIn({ provider: fixtureWallet({ declineSign: true }), address: ADDRESS });
  await session.signIn({ provider: fixtureWallet(), address: ADDRESS });
  session.remember({ kind: 'eip6963', rdns: 'io.metamask', wallet: ADDRESS });
  await session.restore({ provider: fixtureWallet() });
  session.invalidate();
  session.signOut();
  assert.ok(events.events.every((event) => event.type === WALLET_SESSION_EVENT));
  assert.deepEqual(events.events.map((event) => event.detail), [
    { wallet: WALLET, authenticated: false }, // declined signature
    { wallet: WALLET, authenticated: true },  // sign-in
    { wallet: WALLET, authenticated: true },  // restore
    { wallet: WALLET, authenticated: false }, // a 401 invalidated the token
    { wallet: null, authenticated: false },   // sign-out
  ]);
  assert.equal(WALLET_SESSION_EVENT, 'lesters:wallet-session');
});
