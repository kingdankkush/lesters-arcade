import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INDEX_API_ENDPOINTS,
  RANKED_SETTLE_RETRY_VERSION,
  createIndexApiClient,
  tokenWallet,
} from '../apps/portal/src/index-api-client.mjs';

// Fixture tokens only: base64url('v2|<audience>|<wallet>|<expiresAt>') + '.' + a fake MAC.
const WALLET = `0x${'ab'.repeat(20)}`;
const OTHER = `0x${'cd'.repeat(20)}`;
const v2TokenFor = (wallet, audience = 'lestersarcade:development') => `${Buffer.from(`v2|${audience}|${wallet}|9999999999999`).toString('base64url')}.fixture-mac`;
const SIGNED_IN = v2TokenFor(WALLET);
const SESSION_ID32 = `0x${'5e'.repeat(32)}`;

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function recorder(answer = () => jsonResponse(200, { ok: true })) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return answer(url, init);
  };
  return { calls, fetchImpl };
}

test('offline preview never fetches', async () => {
  const { calls, fetchImpl } = recorder();
  let tokenReads = 0;
  const client = createIndexApiClient({ hosted: false, fetchImpl, getToken: () => { tokenReads += 1; return SIGNED_IN; } });
  assert.equal(client.hosted, false);
  const answers = await Promise.all([
    client.leaderboard({ game: 'chikun' }),
    client.profile(WALLET),
    client.profile(WALLET, { self: true }),
    client.refreshProfile(WALLET),
    client.savePreferences({ nameClaimDismissed: true }),
    client.session('ab'.repeat(32)),
    client.retrySettle(SESSION_ID32),
  ]);
  for (const answer of answers) assert.deepEqual(answer, { ok: false, error: 'offline-preview' });
  assert.equal(calls.length, 0, 'no request of any kind in preview');
  assert.equal(tokenReads, 0, 'the token is not even read in preview');
  // A hosted flag without a fetch implementation also stays offline.
  assert.deepEqual(await createIndexApiClient({ hosted: true, fetchImpl: null }).leaderboard({ game: 'chikun' }), { ok: false, error: 'offline-preview' });
});

test('self profile uses the self URL with bearer and no-store', async () => {
  const { calls, fetchImpl } = recorder(() => jsonResponse(200, { ok: true, wallet: WALLET, profile: { displayName: 'Lit Pilot', nameBlocked: null }, preferences: {} }));
  const client = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => SIGNED_IN });

  const self = await client.profile(WALLET.toUpperCase().replace('0X', '0x'), { self: true });
  assert.equal(self.ok, true);
  assert.equal(self.profile.displayName, 'Lit Pilot');
  assert.equal(calls[0].url, `${INDEX_API_ENDPOINTS.profile}?wallet=${WALLET}&self=1`);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers.authorization, `Bearer ${SIGNED_IN}`);
  assert.equal(calls[0].init.cache, 'no-store');

  const publicView = await client.profile(WALLET);
  assert.equal(publicView.ok, true);
  assert.equal(calls[1].url, `${INDEX_API_ENDPOINTS.profile}?wallet=${WALLET}`, 'the public URL is the plain, CDN-cached one');
  assert.equal(calls[1].init.headers.authorization, undefined, 'the public URL never carries the token');
  assert.equal(calls[1].init.cache, undefined);

  // Another wallet's self view, or no token at all, never reaches the network.
  assert.deepEqual(await client.profile(OTHER, { self: true }), { ok: false, error: 'sign-in-required' });
  const anonymous = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => null });
  assert.deepEqual(await anonymous.profile(WALLET, { self: true }), { ok: false, error: 'sign-in-required' });
  const legacy = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => `${Buffer.from(`${WALLET}|123`).toString('base64url')}.mac` });
  assert.deepEqual(await legacy.profile(WALLET, { self: true }), { ok: false, error: 'sign-in-required' }, 'a 1.7.0 v1 token is not a session');
  assert.deepEqual(await client.profile('nope'), { ok: false, error: 'invalid-wallet' });
  assert.equal(calls.length, 2);
});

test('retrySettle posts the retry body with bearer', async () => {
  const { calls, fetchImpl } = recorder(() => jsonResponse(200, { ok: true, view: 'owner', sessionId32: SESSION_ID32, status: 'submitted', retryable: true }));
  const client = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => SIGNED_IN });
  const answer = await client.retrySettle(SESSION_ID32.toUpperCase().replace('0X', '0x'));
  assert.equal(answer.ok, true);
  assert.equal(answer.status, 'submitted', 'the SettleResponse status wins over the HTTP status');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, INDEX_API_ENDPOINTS.settle);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, `Bearer ${SIGNED_IN}`);
  assert.equal(calls[0].init.cache, 'no-store');
  assert.deepEqual(JSON.parse(calls[0].init.body), { v: RANKED_SETTLE_RETRY_VERSION, sessionId32: SESSION_ID32, retry: true });
  assert.equal(RANKED_SETTLE_RETRY_VERSION, 'lesters-ranked-settle-v1');

  assert.deepEqual(await client.retrySettle('0x1234'), { ok: false, error: 'invalid-session-id' });
  const anonymous = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => null });
  assert.deepEqual(await anonymous.retrySettle(SESSION_ID32), { ok: false, error: 'sign-in-required' });
  assert.equal(calls.length, 1);
});

test('refresh sends the bearer token only for the signed-in wallet', async () => {
  const { calls, fetchImpl } = recorder(() => jsonResponse(200, { ok: true, wallet: WALLET, profile: { displayName: 'Lit Pilot', avatarUri: null, hidden: false } }));
  const client = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => SIGNED_IN });
  const own = await client.refreshProfile(WALLET);
  assert.equal(own.profile.displayName, 'Lit Pilot');
  assert.equal(calls[0].url, `${INDEX_API_ENDPOINTS.refresh}?wallet=${WALLET}`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, `Bearer ${SIGNED_IN}`);
  assert.equal(calls[0].init.cache, 'no-store');
  await client.refreshProfile(OTHER);
  assert.equal(calls[1].url, `${INDEX_API_ENDPOINTS.refresh}?wallet=${OTHER}`);
  assert.equal(calls[1].init.headers.authorization, undefined, 'another wallet is refreshed anonymously');
});

test('preferences are PUT with the token and no-store, and a 401 discards the token', async () => {
  let discarded = 0;
  let status = 200;
  const { calls, fetchImpl } = recorder(() => (status === 200
    ? jsonResponse(200, { ok: true, wallet: WALLET, preferences: { nameClaimDismissed: true }, updatedAt: 'x' })
    : jsonResponse(401, { ok: false, error: 'invalid-session' })));
  const client = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => SIGNED_IN, onUnauthorized: () => { discarded += 1; } });
  const saved = await client.savePreferences({ nameClaimDismissed: true });
  assert.equal(saved.ok, true);
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].url, INDEX_API_ENDPOINTS.profile);
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.headers.authorization, `Bearer ${SIGNED_IN}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), { preferences: { nameClaimDismissed: true } });
  assert.equal(discarded, 0);

  status = 401;
  const rejected = await client.savePreferences({ nameClaimDismissed: true });
  assert.deepEqual([rejected.ok, rejected.status, rejected.error], [false, 401, 'invalid-session']);
  assert.equal(discarded, 1, 'a dead v2 token is dropped');
  await client.profile(WALLET, { self: true });
  assert.equal(discarded, 2);
  await client.profile(WALLET);
  assert.equal(discarded, 2, 'an anonymous read never discards the token');
  assert.deepEqual(await client.savePreferences(null), { ok: false, error: 'invalid-body' });
});

test('leaderboard queries send only declared parameters', async () => {
  const { calls, fetchImpl } = recorder(() => jsonResponse(200, { ok: true, gameId: 'chikun', period: 'weekly', rows: [], total: 0, you: null, resetsAt: null }));
  const client = createIndexApiClient({ hosted: true, fetchImpl, getToken: () => SIGNED_IN });
  await client.leaderboard({ game: 'chikun' });
  assert.equal(calls[0].url, '/api/leaderboard?game=chikun&period=weekly');
  assert.equal(calls[0].init.headers.authorization, undefined, 'E5 is public');
  await client.leaderboard({ game: 'stacked', period: 'all-time', page: 3, q: `  ${'x'.repeat(40)} `, wallet: WALLET.toUpperCase().replace('0X', '0x') });
  const url = new URL(calls[1].url, 'https://lestersarcade.io');
  assert.deepEqual([...url.searchParams.keys()], ['game', 'period', 'page', 'q', 'wallet']);
  assert.equal(url.searchParams.get('q'), 'x'.repeat(32), 'search is trimmed and capped at 32 characters');
  assert.equal(url.searchParams.get('wallet'), WALLET);
  await client.leaderboard({ game: 'chikun', period: 'monthly', periodKey: '2026-09', wallet: 'not-a-wallet' });
  assert.equal(calls[2].url, '/api/leaderboard?game=chikun&period=monthly&periodKey=2026-09');
  assert.deepEqual(await client.leaderboard({ game: 'chikun', period: 'yearly' }), { ok: false, error: 'invalid-period' });
  assert.deepEqual(await client.leaderboard({ game: 'chikun', page: 401 }), { ok: false, error: 'invalid-page' });
  assert.deepEqual(await client.leaderboard({}), { ok: false, error: 'invalid-game' });
  assert.equal(calls.length, 3);
});

test('errors keep the server code and retry hints, and a network failure is retryable', async () => {
  const failing = createIndexApiClient({ hosted: true, fetchImpl: async () => jsonResponse(502, { ok: false, error: 'chain-read-failed', retryable: true, retryAfterMs: 5000 }) });
  assert.deepEqual(await failing.refreshProfile(WALLET), { ok: false, status: 502, error: 'chain-read-failed', retryable: true, retryAfterMs: 5000 });
  const offline = createIndexApiClient({ hosted: true, fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepEqual(await offline.leaderboard({ game: 'chikun' }), { ok: false, error: 'network', retryable: true });
  const unconfigured = createIndexApiClient({ hosted: true, fetchImpl: async () => jsonResponse(503, { ok: false, error: 'index-not-configured' }) });
  assert.deepEqual(await unconfigured.profile(WALLET), { ok: false, status: 503, error: 'index-not-configured' });
  const garbled = createIndexApiClient({ hosted: true, fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } }) });
  assert.deepEqual(await garbled.profile(WALLET), { ok: false, status: 200, error: 'http-200' });
  const { calls, fetchImpl } = recorder(() => jsonResponse(200, { ok: true, session: { shareId: 'ab'.repeat(32) } }));
  const client = createIndexApiClient({ hosted: true, fetchImpl });
  await client.session(`0x${'AB'.repeat(32)}`);
  assert.equal(calls[0].url, `/api/session/${'ab'.repeat(32)}`);
  assert.deepEqual(await client.session('nope'), { ok: false, error: 'invalid-session-id' });
});

test('tokenWallet reads only v2 payloads', () => {
  assert.equal(tokenWallet(SIGNED_IN), WALLET);
  assert.equal(tokenWallet(v2TokenFor(OTHER, 'lestersarcade:production')), OTHER);
  assert.equal(tokenWallet(`${Buffer.from(`v1|x|${WALLET}|1`).toString('base64url')}.mac`), null);
  assert.equal(tokenWallet(`${Buffer.from(`${WALLET}|1`).toString('base64url')}.mac`), null);
  assert.equal(tokenWallet('no-dot'), null);
  assert.equal(tokenWallet(`${SIGNED_IN}.extra`), null);
  assert.equal(tokenWallet(null), null);
});
