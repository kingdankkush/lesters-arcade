import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  RANKED_CLIENT_STATES, RANKED_MAX_PENDING, RANKED_PENDING_KEY, RANKED_SETTLEMENT_MESSAGES, RANKED_SETTLEMENT_UNSTORED_MESSAGES, RANKED_TIMING,
  createRankedSettlementClient, fetchRankedResultContext, rankedSettlementStatusCopy,
} from '../apps/portal/src/ranked-settlement.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/ranked/${name}.json`, import.meta.url), 'utf8'));
const CHIKUN = fixture('chikun-valid');
const BODY = CHIKUN.body;
const KEY = BODY.sessionId32;
const WALLET = BODY.identity.wallet;
const TOKEN = 'token-for-fixture-wallet';
const START = 1_790_000_100_000;

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Deterministic timers: nothing runs until the test advances the clock.
function fakeClock(start = START) {
  let t = start;
  let seq = 0;
  const timers = new Map();
  return {
    now: () => t,
    setTimeout: (fn, ms) => { seq += 1; timers.set(seq, { at: t + ms, fn }); return seq; },
    clearTimeout: (id) => { timers.delete(id); },
    delays: () => [...timers.values()].map((timer) => timer.at - t).sort((a, b) => a - b),
    async advance(ms) {
      const end = t + ms;
      await flush();
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        t = due[1].at;
        due[1].fn();
        await flush();
      }
      t = end;
      await flush();
    },
  };
}

function memoryStorage() {
  const data = new Map();
  return { data, getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => { data.set(key, String(value)); }, removeItem: (key) => { data.delete(key); } };
}

// Scripted /api responses, consumed in order; every call is recorded.
function scriptedFetch(script = []) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const call = { url, method: init.method ?? 'GET', headers: { ...(init.headers ?? {}) }, cache: init.cache, body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    const next = script.shift();
    if (next === undefined) throw new Error(`unexpected fetch ${call.method} ${url}`);
    if (next === 'network') throw new TypeError('Failed to fetch');
    const { status = 200, body = null, headers = {} } = typeof next === 'function' ? next(call) : next;
    return { status, ok: status >= 200 && status < 300, headers: { get: (name) => headers[name.toLowerCase()] ?? null }, json: async () => body };
  };
  return { fetchImpl, calls, script };
}

const settleResponse = (status, extra = {}) => ({
  status: 200,
  body: {
    ok: true, view: 'owner', sessionId32: KEY, shareId: KEY.slice(2), gameId: 'chikun', wallet: WALLET, status, score: 1234,
    contract: { kills: 1, maxCombo: 1, survivalSeconds: 60, bossId: null }, stats: {}, envelopeHash: `0x${'ee'.repeat(32)}`,
    txHash: ['submitted', 'confirmed'].includes(status) ? `0x${'aa'.repeat(32)}` : null, blockNumber: status === 'confirmed' ? 42 : null,
    explorerUrl: null, achievements: [], retryable: status !== 'confirmed', attempts: 0, lastError: null, nextAttemptAt: null,
    verifiedAt: '2026-09-23T00:00:00.000Z', confirmedAt: status === 'confirmed' ? '2026-09-23T00:01:00.000Z' : null,
    pollAfterMs: status === 'confirmed' ? null : status === 'submitted' ? 2500 : 3000, ...extra,
  },
});
const errorResponse = (status, error, extra = {}) => ({ status, body: { ok: false, error, ...extra } });

function setup({ live = true, script = [], token = TOKEN, storage = memoryStorage(), clock = fakeClock(), counts = [], published = [] } = {}) {
  const fetch = scriptedFetch(script);
  const client = createRankedSettlementClient({
    live, fetchImpl: fetch.fetchImpl, getToken: (wallet) => (wallet === WALLET ? token : null), storage,
    now: clock.now, setTimeoutImpl: clock.setTimeout, clearTimeoutImpl: clock.clearTimeout,
    onPendingCount: (count) => counts.push(count), onPublished: (snapshot) => published.push(snapshot),
  });
  return { client, fetch, storage, clock, counts, published };
}

const stored = (storage) => JSON.parse(storage.getItem(RANKED_PENDING_KEY) ?? '[]');

test('the client state list is the §7.2 list', () => {
  assert.deepEqual(RANKED_CLIENT_STATES, ['preview', 'waiting-entry', 'verifying', 'queued', 'publishing', 'published', 'retrying', 'saved-locally', 'rejected', 'practice']);
});

test('preview never fetches', async () => {
  const storage = memoryStorage();
  const clock = fakeClock();
  const counts = [];
  const client = createRankedSettlementClient({
    live: false, fetchImpl: () => { throw new Error('preview must not fetch'); }, getToken: () => { throw new Error('preview must not read a token'); },
    storage, now: clock.now, setTimeoutImpl: clock.setTimeout, clearTimeoutImpl: clock.clearTimeout, onPendingCount: (count) => counts.push(count),
  });
  const handle = client.settle(null, { localScore: 900, gameId: 'stacked', wallet: WALLET, sessionId: 'game-session-x', entryConfirmed: Promise.resolve('confirmed') });
  assert.equal(handle.state, 'preview');
  assert.equal(handle.snapshot.gameId, 'stacked');
  assert.equal(handle.snapshot.localScore, 900);
  assert.equal(handle.snapshot.sessionId32, null);
  assert.equal(handle.snapshot.notice, null);
  const withBody = client.settle(BODY, { localScore: 1234 });
  assert.equal(withBody.state, 'preview');
  await withBody.retry();
  assert.deepEqual(client.resume(), []);
  assert.deepEqual(client.handleRetryRequest({ sessionId32: null }), []);
  await clock.advance(10 * 60_000);
  assert.equal(storage.data.size, 0, 'nothing is stored in preview');
  assert.deepEqual(clock.delays(), [], 'no timers in preview');
  assert.deepEqual(counts, [], 'the preview client never reports stored bodies');
  assert.equal(rankedSettlementStatusCopy(handle.snapshot), 'Canonical Ranked preview saved locally. No transaction was sent; verified on-chain publishing remains disabled.');
});

test('verifying, queued, publishing and published follow the server status', async () => {
  const states = [];
  const { client, fetch, clock, storage, published } = setup({
    script: [settleResponse('signed'), settleResponse('submitted'), settleResponse('submitted'), settleResponse('confirmed')],
  });
  const handle = client.settle(BODY, { localScore: 1234 });
  handle.subscribe((snapshot) => states.push(snapshot.state));
  assert.equal(handle.state, 'verifying', 'the full body is being verified');
  assert.equal(stored(storage).length, 1, 'the body is kept until published');
  await clock.advance(0);
  assert.equal(handle.state, 'queued');
  assert.deepEqual(clock.delays(), [3000], 'retry after pollAfterMs');
  await clock.advance(3000);
  assert.deepEqual(fetch.calls[1].body, { v: 'lesters-ranked-settle-v1', sessionId32: KEY, retry: true }, 'queued posts the retry body');
  assert.equal(handle.state, 'publishing');
  assert.deepEqual(clock.delays(), [2500]);
  await clock.advance(2500);
  assert.equal(fetch.calls[2].method, 'GET');
  assert.equal(fetch.calls[2].url, `/api/settle/status?sessionId32=${KEY}`);
  await clock.advance(2500);
  assert.equal(handle.state, 'published');
  assert.deepEqual(states, ['queued', 'publishing', 'publishing', 'published']);
  assert.equal(handle.snapshot.server.txHash, `0x${'aa'.repeat(32)}`);
  assert.equal(stored(storage).length, 0, 'published drops the stored body');
  assert.deepEqual(clock.delays(), []);
  assert.equal(published.length, 1);
  assert.equal(published[0].sessionId, BODY.identity.sessionId);
  assert.match(rankedSettlementStatusCopy(handle.snapshot), /Run published on LitVM\. Tx 0xaaaaaaaa…aaaaaa\./);
});

test('failed rows retry when retryable and end rejected when dead-lettered', async () => {
  const next = new Date(START + 20_000).toISOString();
  const { client, fetch, clock } = setup({ script: [settleResponse('failed', { retryable: true, lastError: 'rpc-timeout', nextAttemptAt: next }), settleResponse('confirmed')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'retrying');
  assert.equal(handle.snapshot.error.code, 'rpc-timeout');
  assert.deepEqual(clock.delays(), [20_000], 'waits for nextAttemptAt');
  await clock.advance(20_000);
  assert.equal(fetch.calls[1].body.retry, true);
  assert.equal(handle.state, 'published');

  const dead = setup({ script: [settleResponse('failed', { retryable: false, lastError: 'session-not-paid' })] });
  const deadHandle = dead.client.settle(BODY);
  await dead.clock.advance(0);
  assert.equal(deadHandle.state, 'rejected');
  assert.equal(deadHandle.snapshot.error.code, 'dead-letter');
  assert.equal(deadHandle.snapshot.error.serverCode, 'session-not-paid');
  assert.equal(stored(dead.storage).length, 0);
});

test('401 saves locally with sign-in-required', async () => {
  const { client, clock, storage } = setup({ script: [errorResponse(401, 'invalid-session')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.error.code, 'sign-in-required');
  assert.equal(stored(storage).length, 1, 'the body stays on the device');
  assert.deepEqual(clock.delays(), [], 'no automatic retry until the player signs in');

  const noToken = setup({ token: null });
  const tokenless = noToken.client.settle(BODY);
  assert.equal(tokenless.state, 'saved-locally');
  assert.equal(tokenless.snapshot.error.code, 'sign-in-required');
  assert.equal(noToken.fetch.calls.length, 0, 'no request without a token');
});

test('entry-pending retries and keeps the body', async () => {
  const pending = () => errorResponse(409, 'entry-pending', { retryable: true, retryAfterMs: 5000 });
  const script = Array.from({ length: 40 }, pending);
  const { client, fetch, clock, storage } = setup({ script });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'retrying');
  assert.equal(handle.snapshot.error.code, 'entry-pending');
  assert.equal(stored(storage).length, 1);
  assert.deepEqual(clock.delays(), [5000], 'max(retryAfterMs, 5 s)');
  await clock.advance(5000);
  assert.equal(fetch.calls.length, 2);
  assert.deepEqual(fetch.calls[1].body, BODY, 'the full body is re-POSTed');
  assert.deepEqual(clock.delays(), [10_000], 'with backoff');
  await clock.advance(RANKED_TIMING.retryableGiveUpMs - 5000 - 1);
  assert.equal(handle.state, 'retrying', 'still retrying inside the 10 minutes');
  await clock.advance(RANKED_TIMING.retryableMaxMs + 1);
  assert.equal(handle.state, 'saved-locally', 'entry-pending gives up after 10 minutes');
  assert.equal(handle.snapshot.error.code, 'entry-pending');
  assert.equal(stored(storage).length, 1, 'still kept for a later retry');
});

test('an early settle waits retryAfterMs and retries', async () => {
  const { client, fetch, clock } = setup({ script: [errorResponse(409, 'run-timing-early', { retryable: true, retryAfterMs: 42_000 }), settleResponse('confirmed')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'retrying');
  assert.deepEqual(clock.delays(), [42_000]);
  await clock.advance(41_999);
  assert.equal(fetch.calls.length, 1, 'not before the server said so');
  await clock.advance(1);
  assert.equal(fetch.calls.length, 2);
  assert.deepEqual(fetch.calls[1].body, BODY);
  assert.equal(handle.state, 'published');
});

test('a retryable chain read failure re-POSTs the body', async () => {
  const { client, fetch, clock } = setup({ script: [errorResponse(502, 'chain-read-failed', { retryable: true, retryAfterMs: 5000 }), settleResponse('pending')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'retrying');
  await clock.advance(5000);
  assert.deepEqual(fetch.calls[1].body, BODY);
  assert.equal(handle.state, 'queued');
});

test('entry-not-paid and entry-underpaid are final', async () => {
  for (const code of ['entry-not-paid', 'entry-underpaid']) {
    const { client, fetch, clock, storage } = setup({ script: [errorResponse(402, code)] });
    const handle = client.settle(BODY);
    await clock.advance(0);
    assert.equal(handle.state, 'rejected');
    assert.equal(handle.snapshot.error.code, code);
    assert.equal(handle.snapshot.error.retryable, false);
    assert.equal(handle.snapshot.error.message, RANKED_SETTLEMENT_MESSAGES[code]);
    assert.equal(stored(storage).length, 0, 'a rejected body is dropped');
    await handle.retry();
    await clock.advance(60_000);
    assert.equal(fetch.calls.length, 1, 'no retry after a final rejection');
  }
  const other = setup({ script: [errorResponse(422, 'replay-rejected')] });
  const replay = other.client.settle(BODY);
  await other.clock.advance(0);
  assert.equal(replay.state, 'rejected');
  assert.equal(replay.snapshot.error.code, 'replay-rejected');
});

test('paused publishing saves locally with the paused message', async () => {
  const { client, fetch, clock, storage } = setup({ script: [errorResponse(503, 'settlement-paused'), settleResponse('signed')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.error.message, 'Ranked publishing is paused; your run is saved and will publish when it resumes.');
  assert.equal(rankedSettlementStatusCopy(handle.snapshot), 'Ranked publishing is paused; your run is saved and will publish when it resumes.');
  assert.equal(stored(storage).length, 1);
  assert.deepEqual(clock.delays(), [5000]);
  await clock.advance(5000);
  assert.deepEqual(fetch.calls[1].body, BODY, 'no row yet, so the full body goes again');
  assert.equal(handle.state, 'queued');
});

test('network errors, 429 and 5xx back off 5, 15, 45 and 120 s, then wait for a manual retry', async () => {
  const { client, fetch, clock } = setup({ script: ['network', errorResponse(429, 'rate-limited'), errorResponse(500, 'internal-error'), 'network', 'network', settleResponse('confirmed')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.error.code, 'network-error');
  for (const [wait, code] of [[5000, 'rate-limited'], [15_000, 'internal-error'], [45_000, 'network-error'], [120_000, 'network-error']]) {
    assert.deepEqual(clock.delays(), [wait]);
    await clock.advance(wait);
    assert.equal(handle.state, 'saved-locally');
    assert.equal(handle.snapshot.error.code, code);
  }
  assert.deepEqual(clock.delays(), [], 'after the fourth backoff only retry() re-drives');
  assert.equal(fetch.calls.length, 5);
  await handle.retry();
  assert.equal(handle.state, 'published');
});

test('a 404 on a retry POST re-POSTs the full body once', async () => {
  const { client, fetch, clock } = setup({ script: [settleResponse('pending'), errorResponse(404, 'session-not-found'), settleResponse('signed'), errorResponse(404, 'session-not-found')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  await clock.advance(3000);
  assert.equal(fetch.calls[1].body.retry, true);
  assert.deepEqual(fetch.calls[2].body, BODY, 'the full body goes again after a 404');
  assert.equal(handle.state, 'queued');
  await clock.advance(3000);
  assert.equal(handle.state, 'saved-locally', 'only once');
  assert.equal(handle.snapshot.error.code, 'session-not-found');
});

test('queued runs fall back to status polling after twenty retries', async () => {
  const script = [settleResponse('pending'), ...Array.from({ length: 20 }, () => settleResponse('signed')), settleResponse('signed'), settleResponse('signed')];
  const { client, fetch, clock } = setup({ script });
  const handle = client.settle(BODY);
  await clock.advance(0);
  for (let index = 0; index < 20; index += 1) await clock.advance(3000);
  assert.equal(fetch.calls.filter((call) => call.method === 'POST' && call.body.retry === true).length, 20);
  assert.equal(handle.state, 'queued');
  assert.deepEqual(clock.delays(), [RANKED_TIMING.queuedPollMs]);
  await clock.advance(15_000);
  await clock.advance(15_000);
  const tail = fetch.calls.slice(21);
  assert.equal(tail.length, 2);
  assert.ok(tail.every((call) => call.method === 'GET' && call.url.startsWith('/api/settle/status?sessionId32=')), 'the cron drains the queue; the client only polls');
});

test('publishing polls for 180 s, then slows to 15 s', async () => {
  const { client, fetch, clock } = setup({ script: Array.from({ length: 80 }, () => settleResponse('submitted')) });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'publishing');
  await clock.advance(RANKED_TIMING.publishingWindowMs);
  assert.deepEqual(clock.delays(), [RANKED_TIMING.queuedPollMs]);
  const before = fetch.calls.length;
  await clock.advance(15_000);
  assert.equal(fetch.calls.length, before + 1);
});

test('the entry is awaited for 90 s, and a failed or late entry makes the run practice', async () => {
  let confirm;
  const confirmed = setup({ script: [settleResponse('pending')] });
  const handle = confirmed.client.settle(BODY, { entryConfirmed: new Promise((resolve) => { confirm = resolve; }), entry: { status: 'pending', txHash: `0x${'cd'.repeat(32)}` } });
  assert.equal(handle.state, 'waiting-entry');
  assert.equal(handle.snapshot.entry.status, 'pending');
  assert.equal(confirmed.fetch.calls.length, 0, 'nothing is sent while the entry confirms');
  confirm('confirmed');
  await confirmed.clock.advance(0);
  assert.equal(handle.snapshot.entry.status, 'confirmed');
  assert.equal(handle.state, 'queued');

  const failed = setup();
  const failedHandle = failed.client.settle(BODY, { entryConfirmed: Promise.resolve('failed') });
  await failed.clock.advance(0);
  assert.equal(failedHandle.state, 'practice');
  assert.equal(failedHandle.snapshot.entry.status, 'failed');
  assert.equal(failedHandle.snapshot.error.message, 'Entry didn’t go through. This run is practice and won’t be ranked.');
  assert.equal(failed.fetch.calls.length, 0, 'practice never calls /api/settle');
  assert.equal(stored(failed.storage).length, 0);

  const late = setup();
  const lateHandle = late.client.settle(BODY, { entryConfirmed: new Promise(() => {}) });
  await late.clock.advance(RANKED_TIMING.entryWaitMs - 1);
  assert.equal(lateHandle.state, 'waiting-entry');
  await late.clock.advance(1);
  assert.equal(lateHandle.state, 'practice');
  assert.equal(late.fetch.calls.length, 0);
});

test('pending requests persist and resume after reload', async () => {
  const storage = memoryStorage();
  const first = setup({ storage, script: ['network'] });
  const handle = first.client.settle(BODY, { localScore: 1234, entry: { status: 'confirmed', txHash: BODY.entryTxHash } });
  await first.clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  handle.dispose();
  const saved = stored(storage);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].sessionId32, KEY);
  assert.deepEqual(saved[0].body, BODY);
  assert.equal(saved[0].localScore, 1234);

  // A fresh page: a new client over the same storage.
  const second = setup({ storage, script: [settleResponse('confirmed')] });
  assert.equal(second.client.get(KEY), null);
  const [resumed] = second.client.resume();
  assert.equal(resumed.sessionId32, KEY);
  assert.equal(resumed.snapshot.localScore, 1234);
  assert.equal(second.client.get(KEY), resumed);
  await second.clock.advance(0);
  assert.deepEqual(second.fetch.calls[0].body, BODY, 'the stored body is re-POSTed');
  assert.equal(resumed.state, 'published');
  assert.equal(stored(storage).length, 0);
  assert.deepEqual(second.counts, [1, 0], 'boot count, then the change');
});

test('at most five bodies are kept, newest first', async () => {
  const { client, storage } = setup({ token: null });
  const keys = [];
  for (let index = 0; index < RANKED_MAX_PENDING + 1; index += 1) {
    const key = `0x${String(index).padStart(2, '0').repeat(32)}`;
    keys.push(key);
    client.settle({ ...BODY, sessionId32: key });
  }
  assert.deepEqual(stored(storage).map((row) => row.sessionId32), keys.slice(1).reverse());
  assert.equal(client.get(keys[0]).snapshot.persisted, false, 'the evicted body is no longer stored');
});

test('pending count and retry-request events drive retries', async () => {
  const storage = memoryStorage();
  const { client, fetch, clock, counts } = setup({ storage, script: ['network', settleResponse('pending'), settleResponse('confirmed')] });
  assert.deepEqual(counts, [0], 'reported once after boot');
  const handle = client.settle(BODY);
  assert.deepEqual(counts, [0, 1]);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  client.handleRetryRequest({ sessionId32: KEY.toUpperCase().replace('0X', '0x') });
  await flush();
  assert.equal(fetch.calls.length, 2, 'a specific id retries that handle');
  assert.equal(handle.state, 'queued');
  client.handleRetryRequest({ sessionId32: null });
  await clock.advance(3000);
  assert.equal(handle.state, 'published');
  assert.deepEqual(counts, [0, 1, 0]);

  // After a reload, a retry request for a stored id resumes it.
  const reload = memoryStorage();
  reload.setItem(RANKED_PENDING_KEY, JSON.stringify([{ sessionId32: KEY, gameId: 'chikun', wallet: WALLET, localScore: 5, entry: { status: 'confirmed', txHash: null }, savedAt: START, body: BODY }]));
  const next = setup({ storage: reload, script: [settleResponse('signed')] });
  assert.deepEqual(next.counts, [1]);
  const [resumed] = next.client.handleRetryRequest({ sessionId32: KEY });
  await next.clock.advance(0);
  assert.equal(resumed.state, 'queued');
});

test('oversize STACKED bodies are not persisted', async () => {
  const sic1 = 'A'.repeat(240_004);
  const big = { ...BODY, gameId: 'stacked', evidence: { encoding: 'stacked-sic1+base64', sic1, startLevel: 1 } };
  const { client, storage, fetch } = setup({ script: [settleResponse('pending')] });
  const handle = client.settle(big);
  assert.equal(stored(storage).length, 0);
  assert.equal(handle.snapshot.persisted, false);
  assert.deepEqual(handle.snapshot.notice, { code: 'keep-tab-open', message: 'Keep this tab open until publishing finishes' });
  assert.equal(fetch.calls[0].body.evidence.sic1.length, 240_004, 'it is still sent');
  const small = setup();
  const fits = small.client.settle({ ...big, sessionId32: `0x${'12'.repeat(32)}`, evidence: { ...big.evidence, sic1: 'A'.repeat(240_000) } });
  assert.equal(fits.snapshot.persisted, true);
});

test('Bearer token on POST and status GET', async () => {
  const { client, fetch, clock } = setup({ script: [settleResponse('pending'), settleResponse('submitted'), settleResponse('confirmed')] });
  client.settle(BODY);
  await clock.advance(0);
  await clock.advance(3000);
  await clock.advance(2500);
  assert.deepEqual(fetch.calls.map((call) => call.method), ['POST', 'POST', 'GET']);
  for (const call of fetch.calls) assert.equal(call.headers.authorization, `Bearer ${TOKEN}`, `${call.method} ${call.url}`);
});

test('every request uses no-store', async () => {
  const { client, fetch, clock } = setup({ script: [errorResponse(409, 'entry-pending', { retryable: true, retryAfterMs: 5000 }), settleResponse('pending'), settleResponse('submitted'), settleResponse('confirmed')] });
  client.settle(BODY);
  await clock.advance(0);
  await clock.advance(5000);
  await clock.advance(3000);
  await clock.advance(2500);
  assert.equal(fetch.calls.length, 4);
  assert.ok(fetch.calls.every((call) => call.cache === 'no-store'));
  const profile = scriptedFetch([{ status: 200, body: { ok: true, profile: { displayName: 'Lit Pilot' }, games: { chikun: { bestScore: 19475 } } } }]);
  await fetchRankedResultContext({ hosted: true, fetchImpl: profile.fetchImpl, wallet: WALLET, gameId: 'chikun' });
  assert.equal(profile.calls[0].cache, 'no-store');
});

test('settle is idempotent per session key and an unusable request is rejected', async () => {
  const { client, fetch } = setup({ script: [settleResponse('pending')] });
  const handle = client.settle(BODY);
  assert.equal(client.settle(BODY), handle);
  assert.equal(fetch.calls.length, 1);
  const broken = client.settle(null, { gameId: 'chikun', wallet: WALLET });
  assert.equal(broken.state, 'rejected');
  assert.equal(broken.snapshot.error.code, 'request-unavailable');
});

test('the result context comes from the index when hosted and from the device in preview', async () => {
  const hosted = scriptedFetch([{ status: 200, body: { ok: true, profile: { displayName: 'Lit Pilot', hidden: false }, games: { stacked: { bestScore: 48210 } } } }]);
  assert.deepEqual(await fetchRankedResultContext({ hosted: true, fetchImpl: hosted.fetchImpl, wallet: WALLET.toUpperCase().replace('0X', '0x'), gameId: 'stacked', local: { displayName: 'Device Name', previousBest: 999_999 } }), { displayName: 'Lit Pilot', previousBest: 48210 });
  assert.equal(hosted.calls[0].url, `/api/profile?wallet=${WALLET}`);
  assert.equal(hosted.calls[0].method, 'GET');

  const empty = scriptedFetch([{ status: 200, body: { ok: true, profile: { displayName: null }, games: { stacked: { bestScore: null } } } }]);
  assert.deepEqual(await fetchRankedResultContext({ hosted: true, fetchImpl: empty.fetchImpl, wallet: WALLET, gameId: 'stacked', local: { displayName: 'Device Name', previousBest: 50 } }), { displayName: null, previousBest: null }, 'a device-local best is never used in hosted mode');
  const down = scriptedFetch(['network']);
  assert.deepEqual(await fetchRankedResultContext({ hosted: true, fetchImpl: down.fetchImpl, wallet: WALLET, gameId: 'stacked', local: { previousBest: 50 } }), { displayName: null, previousBest: null });

  const preview = await fetchRankedResultContext({ hosted: false, fetchImpl: () => { throw new Error('preview must not fetch'); }, wallet: WALLET, gameId: 'stacked', local: { displayName: 'Device Name', previousBest: 50 } });
  assert.deepEqual(preview, { displayName: 'Device Name', previousBest: 50 });
});

test('status copy is truthful for every state', () => {
  const copy = (state, extra = {}) => rankedSettlementStatusCopy({ state, ...extra });
  assert.match(copy('waiting-entry'), /Waiting for your Ranked entry/);
  assert.match(copy('verifying'), /Verifying/);
  assert.match(copy('queued'), /Queued for publishing/);
  assert.match(copy('publishing'), /Publishing your run on LitVM/);
  assert.equal(copy('published'), 'Run published on LitVM.');
  assert.match(copy('saved-locally'), /Saved on this device/);
  assert.match(copy('practice'), /practice/);
  assert.match(copy('rejected', { error: { message: 'no' } }), /^no$/);
  for (const state of RANKED_CLIENT_STATES) assert.ok(copy(state).length > 0, state);
});

test('a 404 on a status GET re-POSTs the full body once, then saves locally', async () => {
  const { client, fetch, clock } = setup({ script: [settleResponse('submitted'), errorResponse(404, 'session-not-found'), settleResponse('submitted'), errorResponse(404, 'session-not-found')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'publishing');
  await clock.advance(2500);
  assert.equal(fetch.calls[1].method, 'GET');
  assert.equal(fetch.calls[2].method, 'POST');
  assert.deepEqual(fetch.calls[2].body, BODY, 'the stored full body goes again after a status 404');
  assert.equal(handle.state, 'publishing');
  await clock.advance(2500);
  assert.equal(fetch.calls.length, 4);
  assert.equal(handle.state, 'saved-locally', 'only once');
  assert.equal(handle.snapshot.error.code, 'session-not-found');
  assert.deepEqual(clock.delays(), [], 'a manual retry takes it from here');
});

test('a 404 on the full POST saves locally with no automatic retry', async () => {
  const { client, fetch, clock, storage } = setup({ script: [errorResponse(404, 'session-not-found')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.error.code, 'session-not-found');
  assert.deepEqual(clock.delays(), [], 'no timer: re-POSTing the same body cannot help');
  await clock.advance(10 * 60_000);
  assert.equal(fetch.calls.length, 1);
  assert.equal(stored(storage).length, 1, 'the body stays for a manual retry');
});

test('run-timing-early keeps retrying past the 10-minute give-up', async () => {
  const early = () => errorResponse(409, 'run-timing-early', { retryable: true, retryAfterMs: 60_000 });
  const { client, fetch, clock } = setup({ script: Array.from({ length: 20 }, early) });
  const handle = client.settle(BODY);
  await clock.advance(0);
  await clock.advance(RANKED_TIMING.retryableGiveUpMs + 120_000);
  assert.equal(handle.state, 'retrying', 'the server said when; the client never gives up on it');
  assert.equal(handle.snapshot.error.code, 'run-timing-early');
  assert.ok(fetch.calls.length >= 11, `re-POSTed every minute (${fetch.calls.length})`);
  assert.ok(fetch.calls.every((call) => call.body.retry !== true), 'always the full body');
  assert.deepEqual(clock.delays(), [60_000]);
});

test('dispose() clears the pending timer and stops the handle', async () => {
  const { client, fetch, clock } = setup({ script: [settleResponse('pending')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.deepEqual(clock.delays(), [3000]);
  handle.dispose();
  assert.deepEqual(clock.delays(), []);
  await clock.advance(60_000);
  assert.equal(fetch.calls.length, 1);
  assert.equal(client.get(KEY), null);
});

test('retry() from saved-locally restarts the give-up window', async () => {
  const pending = () => errorResponse(409, 'entry-pending', { retryable: true, retryAfterMs: 5000 });
  const { client, clock } = setup({ script: Array.from({ length: 60 }, pending) });
  const handle = client.settle(BODY);
  await clock.advance(0);
  await clock.advance(RANKED_TIMING.retryableGiveUpMs + RANKED_TIMING.retryableMaxMs);
  assert.equal(handle.state, 'saved-locally', 'gave up after 10 minutes');
  await handle.retry();
  assert.equal(handle.state, 'retrying', 'a manual retry waits another 10 minutes');
  assert.deepEqual(clock.delays(), [5000], 'with the backoff reset as well');
});

test('a 429 waits for Retry-After', async () => {
  const { client, clock } = setup({ script: [{ status: 429, body: { ok: false, error: 'rate-limited' }, headers: { 'retry-after': '30' } }] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.error.code, 'rate-limited');
  assert.deepEqual(clock.delays(), [30_000], 'max(Retry-After, the 5 s backoff)');
});

test('resume() re-drives only handles that stopped', async () => {
  const { client, fetch, clock } = setup({ script: [settleResponse('pending')] });
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'queued');
  assert.deepEqual(client.resume(), [handle]);
  await flush();
  assert.equal(fetch.calls.length, 1, 'a queued handle keeps its own schedule');
  assert.deepEqual(clock.delays(), [3000]);
  assert.equal(handle.state, 'queued');
});

// A token that disappears mid-publish (a sign-out, an expiry, a wallet switch).
function signOutSetup(script) {
  const clock = fakeClock();
  const fetch = scriptedFetch(script);
  const auth = { token: TOKEN };
  const client = createRankedSettlementClient({
    live: true, fetchImpl: fetch.fetchImpl, getToken: (wallet) => (wallet === WALLET ? auth.token : null), storage: memoryStorage(),
    now: clock.now, setTimeoutImpl: clock.setTimeout, clearTimeoutImpl: clock.clearTimeout,
  });
  return { client, fetch, clock, auth };
}
const publicView = (status) => ({
  status: 200,
  body: {
    ok: true, view: 'public', sessionId32: KEY, shareId: KEY.slice(2), gameId: 'chikun', status,
    txHash: ['submitted', 'confirmed'].includes(status) ? `0x${'aa'.repeat(32)}` : null, blockNumber: status === 'confirmed' ? 42 : null, explorerUrl: null,
    retryable: status !== 'confirmed', nextAttemptAt: null, pollAfterMs: status === 'confirmed' ? null : status === 'submitted' ? 2500 : 3000,
    confirmedAt: status === 'confirmed' ? '2026-09-23T00:01:00.000Z' : null,
  },
});

test('a sign-out mid-publish keeps following the run through the public status view', async () => {
  const { client, fetch, clock, auth } = signOutSetup([settleResponse('submitted'), publicView('submitted'), publicView('confirmed')]);
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'publishing');
  auth.token = null;
  await clock.advance(2500);
  assert.equal(fetch.calls[1].method, 'GET');
  assert.equal(fetch.calls[1].headers.authorization, undefined, 'no token, so the public view');
  assert.equal(handle.state, 'publishing', 'the relayer is still publishing it');
  assert.equal(handle.snapshot.server.wallet, WALLET, 'the owner fields already known are kept');
  await clock.advance(2500);
  assert.equal(handle.state, 'published');
  assert.equal(handle.snapshot.server.txHash, `0x${'aa'.repeat(32)}`);
});

test('a queued run with no token polls status instead of nudging, and a refused nudge does the same', async () => {
  const signedOut = signOutSetup([settleResponse('pending'), publicView('pending'), publicView('submitted')]);
  const handle = signedOut.client.settle(BODY);
  await signedOut.clock.advance(0);
  signedOut.auth.token = null;
  await signedOut.clock.advance(3000);
  assert.equal(signedOut.fetch.calls[1].method, 'GET', 'no retry POST without the owner token');
  assert.equal(handle.state, 'queued');
  await signedOut.clock.advance(3000);
  assert.equal(handle.state, 'publishing');

  const expired = signOutSetup([settleResponse('pending'), errorResponse(401, 'invalid-session'), publicView('submitted')]);
  const expiredHandle = expired.client.settle(BODY);
  await expired.clock.advance(0);
  await expired.clock.advance(3000);
  assert.deepEqual(expired.fetch.calls.map((call) => call.method), ['POST', 'POST', 'GET']);
  assert.equal(expiredHandle.state, 'publishing', 'a 401 on the nudge is not a stop');
});

test('a run that stopped for a sign-in goes again when the wallet signs in', async () => {
  const { client, fetch, clock, auth } = signOutSetup([settleResponse('pending')]);
  auth.token = null;
  const handle = client.settle(BODY);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.error.code, 'sign-in-required');
  assert.equal(fetch.calls.length, 0);
  auth.token = TOKEN;
  assert.deepEqual(client.retrySignedOut(), [handle]);
  await clock.advance(0);
  assert.equal(fetch.calls[0].headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(handle.state, 'queued');
  assert.deepEqual(client.retrySignedOut(), [], 'only handles waiting for a sign-in');
});

test('a run that is not stored on this device never says it is', async () => {
  const sic1 = 'A'.repeat(240_004);
  const big = { ...BODY, gameId: 'stacked', evidence: { encoding: 'stacked-sic1+base64', sic1, startLevel: 1 } };
  const { client, clock } = setup({ script: ['network'] });
  const handle = client.settle(big);
  await clock.advance(0);
  assert.equal(handle.state, 'saved-locally');
  assert.equal(handle.snapshot.persisted, false);
  assert.equal(handle.snapshot.error.code, 'network-error');
  const claimsStored = /(?<!not )saved on this device|your run is saved|it is saved/i;
  assert.doesNotMatch(handle.snapshot.error.message, claimsStored);
  assert.match(handle.snapshot.error.message, /Keep this tab open/);
  assert.doesNotMatch(rankedSettlementStatusCopy(handle.snapshot), claimsStored);
  assert.match(rankedSettlementStatusCopy({ state: 'waiting-entry', notice: handle.snapshot.notice }), /Keep this tab open/);
  assert.doesNotMatch(rankedSettlementStatusCopy({ state: 'waiting-entry', notice: handle.snapshot.notice }), /Run saved/);
  for (const [code, message] of Object.entries(RANKED_SETTLEMENT_UNSTORED_MESSAGES)) {
    assert.doesNotMatch(message, claimsStored, code);
    assert.match(RANKED_SETTLEMENT_MESSAGES[code], /saved/, `${code} has a stored form`);
  }

  // An evicted body: its line changes when it stops being stored.
  const evict = setup({ token: null });
  const seen = [];
  const first = evict.client.settle({ ...BODY, sessionId32: `0x${'00'.repeat(32)}` });
  await evict.clock.advance(0);
  first.subscribe((snapshot) => seen.push(snapshot));
  assert.equal(first.snapshot.error.message, RANKED_SETTLEMENT_MESSAGES['sign-in-required']);
  for (let index = 1; index <= RANKED_MAX_PENDING; index += 1) evict.client.settle({ ...BODY, sessionId32: `0x${String(index).padStart(2, '0').repeat(32)}` });
  assert.equal(first.snapshot.persisted, false);
  assert.equal(first.snapshot.error.message, RANKED_SETTLEMENT_UNSTORED_MESSAGES['sign-in-required']);
  assert.equal(seen.at(-1).notice.code, 'keep-tab-open', 'subscribers hear the eviction');
});
