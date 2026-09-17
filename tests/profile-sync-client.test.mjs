import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProfileDocument, createProfileSync, mergeRemoteProfile, SESSION_TOKEN_STORAGE_KEY } from '../apps/portal/src/profile-sync-client.mjs';
import { sanitizeProfileDocument } from '../apps/portal/src/server-session.mjs';

/**
 * Browser side of the 2026-09-16 services: the session token follows the
 * wallet, profile pull/push is best-effort and silent when the service is not
 * configured, and relayed settlement hands back either a tx hash or an
 * attestation the player can submit themselves.
 */

const WALLET = '0xAbCdEf0000000000000000000000000000000001';
const lower = WALLET.toLowerCase();

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function localProfile(overrides = {}) {
  return { wallet: lower, handle: 'Player 0001', usernameSet: false, avatar: '🕹️', rank: 'New Challenger', xp: 10, achievements: ['cabinet-pioneer'], totalPaidRuns: 1, totalFreeRuns: 2, preferences: { selectedCharacterId: 'lester' }, ...overrides };
}

test('a profile document round-trips through the server sanitiser and only carries the wallet\'s own runs', () => {
  const runs = [
    { sessionId: 's-1', gameId: 'stacked', wallet: WALLET, score: 4200.4, recordedAt: '2026-09-16T00:00:00.000Z', runStats: { kills: 0, survivalSeconds: 240 }, envelopeHash: 'A'.repeat(64) },
    { sessionId: 's-2', gameId: 'lester-blaster', wallet: '0x' + '9'.repeat(40), score: 1 },
    { gameId: 'stacked', wallet: WALLET, score: 5 },
  ];
  const doc = buildProfileDocument(localProfile(), runs);
  assert.deepEqual(doc.runHistory.map((r) => r.sessionId), ['s-1']);
  assert.equal(doc.runHistory[0].elapsedSeconds, 240);
  assert.equal(doc.runHistory[0].score, 4200);
  const sanitized = sanitizeProfileDocument(doc);
  assert.equal(sanitized.handle, 'Player 0001');
  assert.equal(sanitized.runHistory[0].envelopeHash, 'a'.repeat(64));
  assert.deepEqual(sanitized.preferences, { usernameSet: false, selectedCharacterId: 'lester' });
});

test('merging a remote document only ever grows progress and follows the customised identity', () => {
  const profile = localProfile();
  const remote = { handle: 'Ace Pilot', avatar: '🚀', xp: 40, rank: 'Contender', totalPaidRuns: 3, totalFreeRuns: 0, achievements: ['cabinet-pioneer', 'stacked-first-quad'], preferences: { usernameSet: true }, runHistory: [{ sessionId: 's-9', gameId: 'stacked', score: 900 }] };
  const merged = mergeRemoteProfile(profile, remote, [{ sessionId: 's-1' }]);
  assert.equal(merged.changed, true);
  assert.equal(profile.handle, 'Ace Pilot');
  assert.equal(profile.usernameSet, true);
  assert.equal(profile.avatar, '🚀');
  assert.equal(profile.xp, 40);
  assert.equal(profile.rank, 'Contender');
  assert.equal(profile.totalPaidRuns, 3);
  assert.equal(profile.totalFreeRuns, 2, 'local count is not lowered');
  assert.deepEqual(profile.achievements, ['cabinet-pioneer', 'stacked-first-quad']);
  assert.deepEqual(merged.missingRuns.map((r) => [r.sessionId, r.wallet, r.status]), [['s-9', lower, 'synced-from-profile']]);

  const customised = localProfile({ handle: 'Keep Me', usernameSet: true, xp: 100 });
  const again = mergeRemoteProfile(customised, remote, [{ sessionId: 's-9' }]);
  assert.equal(customised.handle, 'Keep Me', 'a locally set name is never overwritten');
  assert.equal(customised.xp, 100);
  assert.equal(customised.rank, 'New Challenger', 'rank only follows a higher remote xp');
  assert.equal(again.missingRuns.length, 0);
  assert.deepEqual(mergeRemoteProfile(localProfile(), null), { changed: false, missingRuns: [] });
});

test('login stores the session token per wallet, expiry and a 503 leave the browser local-only', async () => {
  const storage = memoryStorage();
  let nowMs = 1_000_000;
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([url, init.method]);
    if (url === '/api/session') return jsonResponse(200, { ok: true, wallet: lower, token: 'abc.def', expiresAt: nowMs + 60_000 });
    throw new Error(`unexpected ${url}`);
  };
  const sync = createProfileSync({ fetchImpl, storage, now: () => nowMs });
  assert.equal(sync.hasSession(WALLET), false);
  const login = await sync.login({ challenge: { message: 'm' }, signature: '0x1' });
  assert.equal(login.ok, true);
  assert.equal(sync.hasSession(WALLET), true);
  assert.equal(sync.hasSession('0x' + '2'.repeat(40)), false, 'the token is bound to the wallet');
  assert.ok(storage.getItem(SESSION_TOKEN_STORAGE_KEY));

  const restored = createProfileSync({ fetchImpl, storage, now: () => nowMs });
  assert.equal(restored.hasSession(WALLET), true, 'a stored token survives a reload');
  nowMs += 61_000;
  assert.equal(restored.hasSession(WALLET), false, 'an expired token is ignored');

  const unconfigured = createProfileSync({ fetchImpl: async () => jsonResponse(503, { ok: false, error: 'session-not-configured' }), storage: memoryStorage(), now: () => nowMs });
  const missing = await unconfigured.login({ challenge: { message: 'm' }, signature: '0x1' });
  assert.deepEqual([missing.ok, missing.unavailable, missing.error], [false, true, 'session-not-configured']);
  assert.equal(unconfigured.serviceState().session, 'unconfigured');
  const offline = createProfileSync({ fetchImpl: async () => { throw new Error('offline'); }, storage: memoryStorage() });
  assert.equal((await offline.login({ challenge: { message: 'm' }, signature: '0x1' })).unavailable, true);
});

test('profile pull needs no session, push is debounced behind the session token and clears it on 401', async () => {
  const storage = memoryStorage();
  const nowMs = 5_000;
  const requests = [];
  const timers = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, method: init.method, auth: init.headers?.authorization ?? null, body: init.body ? JSON.parse(init.body) : null });
    if (url === '/api/session') return jsonResponse(200, { ok: true, wallet: lower, token: 'tok.en', expiresAt: nowMs + 60_000 });
    if (url.startsWith('/api/profile?wallet=')) return jsonResponse(200, { ok: true, wallet: lower, profile: { handle: 'Remote' }, updatedAt: 'x' });
    if (url === '/api/profile' && init.method === 'PUT') {
      return init.body.includes('"handle":"expire"') ? jsonResponse(401, { ok: false, error: 'invalid-session' }) : jsonResponse(200, { ok: true, wallet: lower, updatedAt: 'y' });
    }
    throw new Error(`unexpected ${url}`);
  };
  const sync = createProfileSync({ fetchImpl, storage, now: () => nowMs, setTimeoutImpl: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeoutImpl: (id) => { timers[id - 1].cleared = true; } });
  const pulled = await sync.pull(WALLET);
  assert.deepEqual([pulled.ok, pulled.profile.handle, requests[0].url], [true, 'Remote', `/api/profile?wallet=${lower}`]);
  assert.equal((await sync.pull('nope')).unavailable, true);

  assert.equal(sync.push({ handle: 'a' }, { wallet: WALLET }), false, 'no session, nothing queued');
  await sync.login({ challenge: { message: 'm' }, signature: '0x1' });
  assert.equal(sync.push({ handle: 'a' }, { wallet: WALLET }), true);
  assert.equal(sync.push({ handle: 'b' }, { wallet: WALLET }), true);
  assert.equal(timers.filter((t) => !t.cleared).length, 1, 'a burst collapses to one timer');
  timers.at(-1).fn();
  await new Promise((resolve) => setImmediate(resolve));
  const put = requests.filter((r) => r.method === 'PUT');
  assert.equal(put.length, 1);
  assert.deepEqual([put[0].auth, put[0].body.handle], ['Bearer tok.en', 'b']);

  const expired = await sync.pushNow({ handle: 'expire' }, { wallet: WALLET });
  assert.equal(expired.status, 401);
  assert.equal(sync.hasSession(WALLET), false, 'a rejected token is dropped');
  assert.equal(storage.getItem(SESSION_TOKEN_STORAGE_KEY), null);
  assert.deepEqual(await sync.flush(WALLET), { ok: true, skipped: true });
});

test('relayed settlement returns the tx hash, falls back to the attestation, and surfaces verifier refusals', async () => {
  const make = (status, body) => createProfileSync({ fetchImpl: async () => jsonResponse(status, body), storage: null });
  const relayed = await make(200, { ok: true, relayed: true, txHash: '0x' + 'ab'.repeat(32), signature: '0xsig' }).settle({ gameId: 'stacked' });
  assert.deepEqual([relayed.relayed, relayed.txHash], [true, '0x' + 'ab'.repeat(32)]);
  const attested = await make(200, { ok: true, relayed: false, txHash: null, signature: '0xsig', deadline: 1 }).settle({});
  assert.deepEqual([attested.relayed, attested.signature], [false, '0xsig']);
  const broken = await make(502, { ok: false, error: 'relay-failed', detail: 'nonce', attestation: { signature: '0xsig', deadline: 1, run: {}, achievements32: [], domain: {} } }).settle({});
  assert.deepEqual([broken.ok, broken.relayed, broken.signature, broken.relayError], [true, false, '0xsig', 'nonce']);
  await assert.rejects(make(409, { ok: false, error: 'session-already-settled' }).settle({}), /already settled/);
  await assert.rejects(make(422, { ok: false, error: 'implausible-run' }).settle({}), /implausible/);
  await assert.rejects(make(503, { ok: false, error: 'verifier-not-configured' }).settle({}), /not configured/);
  await assert.rejects(make(503, { ok: false, error: 'relayer-not-allowed' }).settle({}), /not authorised/);
  await assert.rejects(createProfileSync({ fetchImpl: null }).settle({}), /unavailable/);
});
