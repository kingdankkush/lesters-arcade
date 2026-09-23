import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SESSION_TOKEN_STORAGE_KEY,
  buildProfileDocument,
  createProfileSync,
  mergeRemoteProfile,
  sessionTokenWallet,
} from '../apps/portal/src/profile-sync-client.mjs';
import { createIndexApiClient } from '../apps/portal/src/index-api-client.mjs';
import { buildSiweChallenge, generateNonce } from '../apps/portal/src/wallet-auth.mjs';
import { sanitizePreferences } from '../server/profile/sanitize.mjs';

/**
 * Browser side of the hosted profile: the session token comes only from the
 * wallet session of contract §7.6 (server nonce, then profileSync.login), stale
 * or pre-v2 tokens are dropped, and the profile document carries preferences
 * only, because every stat now comes from the verified-session index.
 */

const WALLET = '0xAbCdEf0000000000000000000000000000000001';
const lower = WALLET.toLowerCase();
const SERVER_NONCE = 'a1'.repeat(36); // 72 lowercase hex, the E1 shape
const SERVER_ISSUED_AT = '2026-09-23T10:00:00.000Z';
// Fixture token: base64url('v2|<audience>|<wallet>|<expiresAt>') + '.' + a fake MAC.
const v2TokenFor = (wallet, expiresAt) => `${Buffer.from(`v2|lestersarcade:development|${wallet}|${expiresAt}`).toString('base64url')}.fixture-mac`;
const legacyTokenFor = (wallet, expiresAt) => `${Buffer.from(`${wallet}|${expiresAt}`).toString('base64url')}.fixture-mac`;

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function localProfile(overrides = {}) {
  return { wallet: lower, handle: 'Player 0001', usernameSet: false, avatar: '🕹️', rank: 'New Challenger', xp: 10, achievements: ['cabinet-pioneer'], totalPaidRuns: 1, totalFreeRuns: 2, progress: { 'lester-blaster': { paidRuns: 1 } }, preferences: { selectedCharacterId: 'lester-original' }, ...overrides };
}

// A double of signin-entry's wallet session (contract §7.6), honouring its API:
// createWalletSession({ hosted, fetchImpl, storage, now, profileSync, loadEthers, domain, chainId })
// → { signIn, restore, isAuthenticated, token, signOut, remember, remembered }.
function createWalletSessionDouble({ hosted, fetchImpl, profileSync, domain = 'lestersarcade.io', chainId = 4441 }) {
  let remembered = null;
  return {
    async signIn({ provider, address }) {
      const wallet = String(address).toLowerCase();
      if (!hosted) return { ok: true, wallet, authenticated: true, token: null, expiresAt: null };
      const nonceResponse = await fetchImpl('/api/session/nonce', { method: 'GET', cache: 'no-store' });
      const { nonce, issuedAt } = await nonceResponse.json();
      const challenge = buildSiweChallenge({ domain, address, chainId, nonce, issuedAt });
      const signature = await provider.request({ method: 'personal_sign', params: [challenge.message, address] });
      const login = await profileSync.login({ challenge, signature });
      return login.ok
        ? { ok: true, wallet, authenticated: true, token: login.token, expiresAt: login.expiresAt }
        : { ok: false, wallet, authenticated: false, token: null, expiresAt: null, error: { kind: 'server', message: login.error } };
    },
    async restore() {
      const wallet = remembered?.wallet ?? null;
      return { ok: true, wallet, authenticated: Boolean(wallet) && profileSync.hasSession(wallet), providerPending: false };
    },
    isAuthenticated: (wallet) => profileSync.hasSession(wallet),
    token: (wallet) => profileSync.tokenFor(wallet),
    signOut: () => { profileSync.logout(); remembered = null; },
    remember: (entry) => { remembered = entry; },
    remembered: () => remembered,
  };
}

test('the wallet session is the only way to a token: server nonce in, v2 token out', async () => {
  const storage = memoryStorage();
  const nowMs = Date.parse(SERVER_ISSUED_AT) + 1_000;
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    seen.push({ url, method: init.method, cache: init.cache, auth: init.headers?.authorization ?? null, body: init.body ? JSON.parse(init.body) : null });
    if (url === '/api/session/nonce') return jsonResponse(200, { ok: true, nonce: SERVER_NONCE, issuedAt: SERVER_ISSUED_AT, expiresAt: '2026-09-23T10:10:00.000Z' });
    if (url === '/api/session') {
      const { challenge } = JSON.parse(init.body);
      assert.equal(challenge.nonce, SERVER_NONCE, 'the challenge carries the server nonce');
      assert.equal(challenge.issuedAt, SERVER_ISSUED_AT, 'and the server issuedAt, so client clock skew cannot stale it');
      return jsonResponse(200, { ok: true, wallet: lower, token: v2TokenFor(lower, nowMs + 86_400_000), expiresAt: nowMs + 86_400_000 });
    }
    if (url.startsWith('/api/profile?')) return jsonResponse(200, { ok: true, wallet: lower, profile: { displayName: null, avatarUri: null, hidden: false, nameBlocked: null }, games: {}, recentSessions: [], achievements: [], preferences: {} });
    throw new Error(`unexpected ${url}`);
  };
  const profileSync = createProfileSync({ fetchImpl, storage, now: () => nowMs });
  const walletSession = createWalletSessionDouble({ hosted: true, fetchImpl, profileSync });
  const provider = { request: async ({ method }) => { assert.equal(method, 'personal_sign'); return `0x${'1'.repeat(130)}`; } };

  assert.equal(walletSession.isAuthenticated(WALLET), false);
  const signedIn = await walletSession.signIn({ provider, address: WALLET });
  assert.equal(signedIn.ok, true);
  assert.equal(signedIn.authenticated, true);
  assert.equal(sessionTokenWallet(signedIn.token), lower);
  assert.equal(walletSession.token(WALLET), signedIn.token);
  assert.equal(profileSync.session.token, signedIn.token, 'main.js reads profileSync.session?.token (§7.6)');
  assert.deepEqual(seen.map((call) => [call.url, call.cache]), [['/api/session/nonce', 'no-store'], ['/api/session', 'no-store']]);

  // The index client picks the token up from the same place.
  const indexApi = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => profileSync.session?.token ?? null, onUnauthorized: () => profileSync.logout() });
  assert.equal((await indexApi.profile(WALLET, { self: true })).ok, true);
  assert.equal(seen.at(-1).auth, `Bearer ${signedIn.token}`);

  // A reload restores the token for the same wallet only.
  const reloaded = createProfileSync({ fetchImpl, storage, now: () => nowMs });
  assert.equal(reloaded.hasSession(WALLET), true);
  assert.equal(reloaded.tokenFor(`0x${'2'.repeat(40)}`), null, 'the token is bound to the wallet');
  walletSession.signOut();
  assert.equal(storage.getItem(SESSION_TOKEN_STORAGE_KEY), null);
});

test('a browser-made nonce never reaches /api/session', async () => {
  let calls = 0;
  const profileSync = createProfileSync({ fetchImpl: async () => { calls += 1; return jsonResponse(200, {}); }, storage: memoryStorage() });
  const challenge = buildSiweChallenge({ domain: 'lestersarcade.io', address: WALLET, chainId: 4441, nonce: generateNonce(), issuedAt: SERVER_ISSUED_AT });
  const refused = await profileSync.login({ challenge, signature: `0x${'1'.repeat(130)}` });
  assert.deepEqual(refused, { ok: false, unavailable: false, error: 'nonce-not-server-issued' });
  assert.equal(calls, 0, 'the old browser-nonce login path makes no request at all');
  assert.equal((await profileSync.login({ challenge: { message: 'm' }, signature: '0x1' })).error, 'nonce-not-server-issued');
  assert.equal(profileSync.hasSession(WALLET), false);
});

test('pre-v2, expired and rejected tokens are discarded', async () => {
  const nowMs = 1_000_000;
  const storage = memoryStorage();
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: lower, token: legacyTokenFor(lower, nowMs + 60_000), expiresAt: nowMs + 60_000 }));
  const fromOldSite = createProfileSync({ fetchImpl: async () => jsonResponse(200, {}), storage, now: () => nowMs });
  assert.equal(fromOldSite.hasSession(WALLET), false, 'a 1.7.0 token is never sent again');
  assert.equal(storage.getItem(SESSION_TOKEN_STORAGE_KEY), null, 'and it is removed from storage');

  storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: `0x${'2'.repeat(40)}`, token: v2TokenFor(lower, nowMs + 60_000), expiresAt: nowMs + 60_000 }));
  assert.equal(createProfileSync({ storage, now: () => nowMs }).session, null, 'a token for another wallet is not this wallet’s session');

  let clock = nowMs;
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: lower, token: v2TokenFor(lower, nowMs + 60_000), expiresAt: nowMs + 60_000 }));
  const expiring = createProfileSync({ storage, now: () => clock });
  assert.equal(expiring.hasSession(WALLET), true);
  clock += 61_000;
  assert.equal(expiring.hasSession(WALLET), false, 'an expired token is ignored');

  const loginFetch = async () => jsonResponse(401, { ok: false, error: 'nonce-used' });
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: lower, token: v2TokenFor(lower, nowMs + 60_000), expiresAt: nowMs + 60_000 }));
  const rejected = createProfileSync({ fetchImpl: loginFetch, storage, now: () => nowMs });
  const answer = await rejected.login({ challenge: { nonce: SERVER_NONCE, message: 'm' }, signature: '0x1' });
  assert.deepEqual([answer.ok, answer.status, answer.error], [false, 401, 'nonce-used']);
  assert.equal(rejected.hasSession(WALLET), false, 'a 401 discards the stored token');

  const badToken = createProfileSync({ fetchImpl: async () => jsonResponse(200, { ok: true, wallet: lower, token: legacyTokenFor(lower, 1), expiresAt: nowMs + 60_000 }), storage: memoryStorage(), now: () => nowMs });
  assert.equal((await badToken.login({ challenge: { nonce: SERVER_NONCE, message: 'm' }, signature: '0x1' })).error, 'invalid-token');
  assert.equal(badToken.hasSession(WALLET), false);

  const unconfigured = createProfileSync({ fetchImpl: async () => jsonResponse(503, { ok: false, error: 'session-not-configured' }), storage: memoryStorage(), now: () => nowMs });
  const missing = await unconfigured.login({ challenge: { nonce: SERVER_NONCE, message: 'm' }, signature: '0x1' });
  assert.deepEqual([missing.ok, missing.unavailable, missing.error], [false, true, 'session-not-configured']);
  assert.equal(unconfigured.serviceState().session, 'unconfigured');
  const offline = createProfileSync({ fetchImpl: async () => { throw new Error('offline'); }, storage: memoryStorage() });
  assert.equal((await offline.login({ challenge: { nonce: SERVER_NONCE, message: 'm' }, signature: '0x1' })).unavailable, true);
});

test('the profile document carries preferences only and survives the server sanitizer', () => {
  const doc = buildProfileDocument(localProfile({ xp: 99_999, totalPaidRuns: 500, achievements: ['arcade-legend-500'] }), [{ sessionId: 's-1', gameId: 'stacked', wallet: WALLET, score: 4200 }]);
  assert.deepEqual(doc, { preferences: { selectedCharacterId: 'lester-original' } });
  assert.deepEqual(sanitizePreferences(doc.preferences), doc.preferences, 'E7 keeps every key the browser sends');
  assert.deepEqual(buildProfileDocument(localProfile({ preferences: { selectedCharacterId: 'Not Valid!' } })), { preferences: {} });
  assert.deepEqual(buildProfileDocument({ wallet: lower }), { preferences: {} });
  assert.throws(() => buildProfileDocument(null), /profile is required/);
});

test('merging the index profile ignores every spoofable field', () => {
  const profile = localProfile();
  const before = structuredClone(profile);
  const legacyDocument = { handle: 'Ace Pilot', avatar: '🚀', xp: 40_000, rank: 'Legend', totalPaidRuns: 300, totalFreeRuns: 9, achievements: ['arcade-legend-500'], preferences: { usernameSet: true }, runHistory: [{ sessionId: 's-9', gameId: 'stacked', score: 900 }] };
  assert.deepEqual(mergeRemoteProfile(profile, legacyDocument), { changed: false });
  assert.deepEqual(profile, before, 'an old browser-pushed document changes nothing');

  const indexed = {
    ok: true, wallet: lower,
    profile: { displayName: 'Lit Pilot', avatarUri: 'lestersarcade:avatar/lilly', hidden: false },
    games: { 'lester-blaster': { rankedRuns: 40, confirmedRuns: 40, bestScore: 99_999 } },
    achievements: [{ id: 'arcade-legend-500', gameId: 'lester-blaster' }],
    recentSessions: [{ sessionId32: `0x${'1'.repeat(64)}`, score: 5 }],
    preferences: { selectedCharacterId: 'lilly', nameClaimDismissed: true },
    xp: 1e9, totalPaidRuns: 1e9, runHistory: [{ sessionId: 'forged' }],
  };
  assert.deepEqual(mergeRemoteProfile(profile, indexed), { changed: true });
  assert.equal(profile.handle, 'Lit Pilot', 'the on-chain name (D3) follows the wallet');
  assert.equal(profile.usernameSet, true);
  assert.equal(profile.preferences.selectedCharacterId, 'lilly');
  for (const key of ['xp', 'rank', 'totalPaidRuns', 'totalFreeRuns', 'achievements', 'avatar', 'progress']) {
    assert.deepEqual(profile[key], before[key], `${key} is never merged`);
  }
  assert.deepEqual(mergeRemoteProfile(profile, indexed), { changed: false }, 'idempotent');
  assert.deepEqual(mergeRemoteProfile(localProfile(), { profile: { displayName: null, hidden: true } }), { changed: false }, 'a hidden or blocked name leaves the local one');
  assert.deepEqual(mergeRemoteProfile(localProfile(), null), { changed: false });
});

test('pull reads the E6 shape, uses the self view with a token and falls back after a 401', async () => {
  const nowMs = 5_000;
  const storage = memoryStorage();
  const token = v2TokenFor(lower, nowMs + 60_000);
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: lower, token, expiresAt: nowMs + 60_000 }));
  const requests = [];
  let selfStatus = 200;
  const body = { ok: true, wallet: lower, profile: { displayName: 'Lit Pilot', avatarUri: null, hidden: false }, games: { chikun: { confirmedRuns: 2 } }, recentSessions: [], achievements: [], preferences: { nameClaimDismissed: true }, updatedAt: 'x' };
  const fetchImpl = async (url, init) => {
    requests.push({ url, auth: init.headers?.authorization ?? null, cache: init.cache });
    if (url.endsWith('&self=1')) return selfStatus === 200 ? jsonResponse(200, body) : jsonResponse(401, { ok: false, error: 'invalid-session' });
    return jsonResponse(200, { ...body, preferences: null });
  };
  const sync = createProfileSync({ fetchImpl, storage, now: () => nowMs });
  const own = await sync.pull(WALLET);
  assert.deepEqual([own.ok, own.self, own.profile.displayName, own.games.chikun.confirmedRuns, own.preferences.nameClaimDismissed], [true, true, 'Lit Pilot', 2, true]);
  assert.deepEqual(requests[0], { url: `/api/profile?wallet=${lower}&self=1`, auth: `Bearer ${token}`, cache: 'no-store' });

  const other = await sync.pull(`0x${'3'.repeat(40)}`);
  assert.equal(other.self, false);
  assert.equal(requests[1].auth, null, 'another wallet is read through the public URL');

  selfStatus = 401;
  const fallback = await sync.pull(WALLET);
  assert.deepEqual([fallback.ok, fallback.self, fallback.preferences], [true, false, null]);
  assert.equal(sync.hasSession(WALLET), false, 'the rejected token is gone');
  assert.equal(storage.getItem(SESSION_TOKEN_STORAGE_KEY), null);
  assert.equal((await sync.pull('nope')).unavailable, true);
});

test('preference pushes are debounced behind the session token and a 401 drops it', async () => {
  const storage = memoryStorage();
  const nowMs = 5_000;
  storage.setItem(SESSION_TOKEN_STORAGE_KEY, JSON.stringify({ wallet: lower, token: v2TokenFor(lower, nowMs + 60_000), expiresAt: nowMs + 60_000 }));
  const requests = [];
  const timers = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, method: init.method, auth: init.headers?.authorization ?? null, cache: init.cache, body: init.body ? JSON.parse(init.body) : null });
    return init.body.includes('expire') ? jsonResponse(401, { ok: false, error: 'invalid-session' }) : jsonResponse(200, { ok: true, wallet: lower, preferences: {}, updatedAt: 'y' });
  };
  const sync = createProfileSync({ fetchImpl, storage, now: () => nowMs, setTimeoutImpl: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeoutImpl: (id) => { timers[id - 1].cleared = true; } });
  assert.equal(sync.push({ preferences: { selectedCharacterId: 'lilly' } }, { wallet: `0x${'2'.repeat(40)}` }), false, 'another wallet has no session');
  assert.equal(sync.push({ preferences: { selectedCharacterId: 'lit-valkyrie' } }, { wallet: WALLET }), true);
  assert.equal(sync.push({ preferences: { selectedCharacterId: 'lilly' } }, { wallet: WALLET }), true);
  assert.equal(timers.filter((t) => !t.cleared).length, 1, 'a burst collapses to one timer');
  timers.at(-1).fn();
  await new Promise((resolve) => setImmediate(resolve));
  const put = requests.filter((r) => r.method === 'PUT');
  assert.equal(put.length, 1);
  assert.deepEqual([put[0].url, put[0].cache, put[0].body], ['/api/profile', 'no-store', { preferences: { selectedCharacterId: 'lilly' } }]);
  assert.match(put[0].auth, /^Bearer /);

  const expired = await sync.pushNow({ preferences: { selectedCharacterId: 'expire' } }, { wallet: WALLET });
  assert.equal(expired.status, 401);
  assert.equal(sync.hasSession(WALLET), false, 'a rejected token is dropped');
  assert.equal(storage.getItem(SESSION_TOKEN_STORAGE_KEY), null);
  assert.deepEqual(await sync.flush(WALLET), { ok: true, skipped: true });
});

test('the relayed settle() is gone: ranked-client owns settlement (A3)', () => {
  const sync = createProfileSync({ storage: null });
  assert.equal('settle' in sync, false);
  assert.deepEqual(Object.keys(sync.serviceState()), ['session', 'profile']);
});
