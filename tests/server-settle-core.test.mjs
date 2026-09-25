import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import { issueSessionToken } from '../apps/portal/src/server-session.mjs';
import { deriveRankedSeed } from '../apps/portal/src/session-seed.mjs';
import { ipBucket } from '../server/http.mjs';
import { migrate } from '../server/neon/migrations.mjs';
import { periodKeysFor } from '../server/neon/period-keys.mjs';
import { createRelayer } from '../server/settle/relayer.mjs';
import { readSettleRow } from '../server/settle/store.mjs';
import { issueSeedTicket } from '../server/verify/seed-ticket.mjs';
import { localContracts, localWalletKeys } from '../scripts/lib/local-chain.mjs';
import * as settleApi from '../api/settle.mjs';
import * as statusApi from '../api/settle-status.mjs';
import * as seedApi from '../api/ranked-seed.mjs';
import * as attestApi from '../api/attest.mjs';
import * as nonceApi from '../api/session-nonce.mjs';
import * as sessionApi from '../api/session.mjs';
import * as retryApi from '../api/cron/settle-retry.mjs';
import { createPgliteClient, seedVerifiedSession } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import {
  bootLocalChain, buildSettleBody, createCatalogDouble, createVerifyDouble, fixtureEnv, HERO_GATES_DOUBLE,
  LOCAL_FEE_CAP_RESERVE_WEI, openPaidSession, SETTLE_SESSION_VALUE, stackedEvidence,
} from './helpers/settle-fixtures.mjs';

/**
 * Contract §4.3.3 (E3), §4.3.4 (E4), §4.3.13 (E15), §4.3.12 (E14), §4.4 and
 * A30: the real handlers, mounted through createHandler with the production
 * buildDeps (unmigrated PGlite, the in-process chain, its deployment record
 * and an injected clock). Seed tickets are the verify slice's real
 * issueSeedTicket, and the verify double (tests/helpers/settle-fixtures.mjs)
 * binds and digests with the real server/verify functions; only its replay
 * is a toy, so a test can choose a run's score and length. The achievements
 * registry and hero gates are small doubles with the real API.
 * tests/api-settle-handler.test.mjs runs the same handlers with the real
 * modules throughout.
 */

const IP = '198.51.100.23';
let local;
let registry;
let env;
let clockMs = 0;
const nowMs = () => clockMs;

before(async () => {
  local = await bootLocalChain();
  registry = local.record.addresses.scoreSubmissionRegistry.toLowerCase();
  env = fixtureEnv({ registry });
});

after(async () => {
  await local?.chain.close();
});

async function syncClock(offsetMs = 1000) {
  clockMs = (await local.chain.latestTimestamp()) * 1000 + offsetMs;
  return clockMs;
}

async function advanceChain(seconds) {
  await local.chain.increaseTime(seconds);
  await local.chain.mine();
  return syncClock();
}

async function scenario(run, { catalog: catalogOptions = {} } = {}) {
  const db = createPgliteClient();
  const snapshot = await local.chain.snapshot();
  const verify = createVerifyDouble({ nowMs });
  const catalog = createCatalogDouble(catalogOptions);
  try {
    await syncClock();
    await run({ db, verify, catalog });
  } finally {
    await local.chain.request('evm_setAutomine', [true]);
    await local.chain.revert(snapshot);
    await db.close();
  }
}

function bearer(wallet, audience = 'lestersarcade:development') {
  const { token } = issueSessionToken({ createHmac, timingSafeEqual }, { secret: SETTLE_SESSION_VALUE, wallet: String(wallet).toLowerCase(), nowMs: clockMs, audience });
  return `Bearer ${token}`;
}

// The production adapter and buildDeps; the doubles replace the verify slice
// and the achievements registry. `wrap(deps)` may adjust one request's deps.
function settleHandler({ db, verify, catalog }, { envOverride = env, wrap = null, provider = local.chain.provider } = {}) {
  return settleApi.createHandler(async () => {
    const deps = await settleApi.buildDeps(envOverride, { db, provider, deployment: local.deployment, nowMs });
    deps.verify = verify;
    deps.catalog = catalog;
    deps.heroGates = HERO_GATES_DOUBLE;
    return wrap ? wrap(deps) : deps;
  });
}

function statusHandler({ db, catalog }, { provider = local.chain.provider, envOverride = env } = {}) {
  return statusApi.createHandler(async () => {
    const deps = await statusApi.buildDeps(envOverride, { db, provider, deployment: local.deployment, nowMs });
    deps.catalog = catalog;
    return deps;
  });
}

// E15 checks the same modules as E3 (verify, the achievements registry and,
// for HMH, the hero gates), so it gets the same doubles.
function seedHandler({ db, verify, catalog }, { envOverride = env, issue = issueSeedTicket, wrap = null } = {}) {
  return seedApi.createHandler(async () => {
    const deps = await seedApi.buildDeps(envOverride, { db, deployment: local.deployment, nowMs });
    deps.issueSeedTicket = issue;
    deps.verify = verify;
    deps.catalog = catalog;
    deps.heroGates = HERO_GATES_DOUBLE;
    return wrap ? wrap(deps) : deps;
  });
}

function post(handler, body, { wallet = local.chain.wallets.player1.address, headers = {}, ip = IP } = {}) {
  return invoke(handler, { method: 'POST', url: '/api/settle', headers: { authorization: bearer(wallet), 'x-forwarded-for': ip, ...headers }, body });
}

function getStatus(handler, query, { wallet = null } = {}) {
  const headers = wallet ? { authorization: bearer(wallet) } : {};
  return invoke(handler, { url: `/api/settle-status?${query}`, headers: { 'x-forwarded-for': IP, ...headers } });
}

// Builds a §5.1 body (ticket issued now), opens its paid session on chain,
// sets entryTxHash and syncs the clock past the opening block.
async function paidBody({ player = local.chain.wallets.player1, gameId = 'chikun', evidenceOptions = {}, value = null, claim = undefined } = {}) {
  const body = await buildSettleBody({ gameId, wallet: player.address, registry, nowMs: clockMs, evidenceOptions, claim });
  const paid = await openPaidSession({ chain: local.chain, record: local.record, player, sessionId32: body.sessionId32, gameId, value });
  body.entryTxHash = paid.txHash;
  await syncClock();
  return { body, paid };
}

function relayerNonce() {
  return local.chain.provider.getTransactionCount(local.chain.wallets.relayer.address, 'latest');
}

async function fillBucket(db, bucket, hits) {
  await migrate(db);
  const windowStart = Math.floor(Math.floor(clockMs / 1000) / 3600) * 3600;
  await db.query(
    `INSERT INTO rate_limits (bucket, window_start, hits) VALUES ($1, to_timestamp($2::double precision), $3::int)
     ON CONFLICT (bucket, window_start) DO UPDATE SET hits = EXCLUDED.hits`,
    [bucket, String(windowStart), String(hits)],
  );
}

async function bucketHits(db, prefix) {
  const rows = await db.query('SELECT coalesce(sum(hits), 0)::int AS hits FROM rate_limits WHERE bucket LIKE $1', [`${prefix}%`]);
  return rows[0].hits;
}

function countingChain(chain, counts) {
  return Object.freeze({
    ...chain,
    getPaidSession: async (...args) => { counts.getPaidSession = (counts.getPaidSession ?? 0) + 1; return chain.getPaidSession(...args); },
    getSession: async (...args) => { counts.getSession = (counts.getSession ?? 0) + 1; return chain.getSession(...args); },
  });
}

test('requires a bearer token before reading the body', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  let reads = 0;
  const request = (headers) => ({ method: 'POST', url: '/api/settle', headers, get body() { reads += 1; return { v: 'lesters-ranked-settle-v1' }; } });
  const { fakeResponse } = await import('./helpers/fake-http.mjs');
  for (const headers of [{}, { authorization: 'Bearer nope' }, { authorization: bearer(local.chain.wallets.player1.address, 'lestersarcade:production') }, { authorization: 'Basic abc' }]) {
    const res = fakeResponse();
    // eslint-disable-next-line no-await-in-loop
    await handler(request(headers), res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json, { ok: false, error: 'invalid-session' });
    assert.equal(res.headers['cache-control'], 'no-store');
  }
  const unconfigured = fakeResponse();
  await settleApi.createHandler(() => settleApi.buildDeps({}))(request({ authorization: 'Bearer x' }), unconfigured);
  assert.deepEqual([unconfigured.statusCode, unconfigured.json.error], [503, 'settlement-not-configured']);
  assert.equal(reads, 0, 'a failed Bearer check never reads the body');
  assert.equal((await ctx.db.query("SELECT to_regclass('public.rate_limits') IS NULL AS absent"))[0].absent, true, 'and never touches the database');
  const res = fakeResponse();
  await handler(request({ authorization: bearer(local.chain.wallets.player1.address), 'x-forwarded-for': IP }), res);
  assert.equal(reads, 1, 'a valid token reads the body');
  assert.deepEqual([res.statusCode, res.json.error], [400, 'invalid-body']);
  const wrongMethod = await invoke(handler, { method: 'GET', url: '/api/settle' });
  assert.equal(wrongMethod.status, 405);
  const query = await invoke(handler, { method: 'POST', url: '/api/settle?cb=1', headers: { authorization: bearer(local.chain.wallets.player1.address) }, body: {} });
  assert.deepEqual([query.status, query.body.error], [400, 'invalid-query']);
}));

test('an unpaid body is 402 and never reaches the verifier', async () => scenario(async (ctx) => {
  const counts = {};
  const handler = settleHandler(ctx, { wrap: (deps) => ({ ...deps, chain: countingChain(deps.chain, counts) }) });
  const player = local.chain.wallets.player1;
  const unpaid = await buildSettleBody({ wallet: player.address, registry, nowMs: clockMs });
  const response = await post(handler, unpaid);
  assert.deepEqual([response.status, response.body], [402, { ok: false, error: 'entry-not-paid' }]);
  assert.equal(ctx.verify.calls.bindRankedIdentity, 1, 'binding runs before the paid check');
  assert.equal(ctx.verify.calls.verifyRankedRun, 0, 'the verifier never runs for an unpaid entry');
  assert.equal(counts.getPaidSession, 1);

  // A transaction that pays someone else's session, or reverted, proves nothing.
  const other = await paidBody({ player: local.chain.wallets.player2 });
  const borrowed = await post(handler, { ...unpaid, entryTxHash: other.body.entryTxHash });
  assert.deepEqual([borrowed.status, borrowed.body.error], [402, 'entry-not-paid']);
  // A reverted openSession (wrong fee), mined with status 0.
  const entry = localContracts(local.record, player).rankedEntry;
  const data = entry.interface.encodeFunctionData('openSession', [unpaid.sessionId32, ethers.id('chikun')]);
  const fee = await local.chain.provider.getFeeData();
  const raw = await player.signTransaction({
    type: 2, chainId: 4441, to: local.record.addresses.arcadeRankedEntry, data, value: 1n, gasLimit: 300_000n,
    nonce: await local.chain.provider.getTransactionCount(player.address, 'pending'), maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
  });
  await local.chain.provider.broadcastTransaction(raw).catch(() => null);
  const revertedHash = ethers.keccak256(raw).toLowerCase();
  assert.equal((await local.chain.provider.getTransactionReceipt(revertedHash))?.status, 0, 'the chain holds the reverted entry');
  const failedEntry = await post(handler, { ...unpaid, entryTxHash: revertedHash });
  assert.deepEqual([failedEntry.status, failedEntry.body.error], [402, 'entry-not-paid']);
  // Another player's paid session under this key is not this wallet's entry.
  const foreign = await buildSettleBody({ wallet: player.address, registry, nowMs: clockMs });
  await openPaidSession({ chain: local.chain, record: local.record, player: local.chain.wallets.player2, sessionId32: foreign.sessionId32, gameId: 'chikun' });
  assert.deepEqual((await post(handler, foreign)).body, { ok: false, error: 'entry-not-paid' });
  assert.equal(ctx.verify.calls.verifyRankedRun, 0);
  assert.equal((await ctx.db.query('SELECT count(*)::int AS n FROM verified_sessions'))[0].n, 0);
}));

test('an entry the RPC cannot see yet is a retryable entry-pending', async () => scenario(async (ctx) => {
  const player = local.chain.wallets.player1;
  const body = await buildSettleBody({ wallet: player.address, registry, nowMs: clockMs });
  await local.chain.request('evm_setAutomine', [false]);
  const pending = await openPaidSession({ chain: local.chain, record: local.record, player, sessionId32: body.sessionId32, gameId: 'chikun', wait: false });
  body.entryTxHash = pending.txHash;
  const waits = [];
  const handler = settleHandler(ctx, { wrap: (deps) => ({ ...deps, chain: { ...deps.chain, waitForReceipt: async (hash, timeoutMs) => { waits.push([hash, timeoutMs]); return null; } } }) });
  const response = await post(handler, body);
  assert.deepEqual([response.status, response.body], [409, { ok: false, error: 'entry-pending', retryable: true, retryAfterMs: 5000 }]);
  assert.deepEqual(waits, [[pending.txHash, 10_000]], 'the server waits at most 10 s for the entry receipt');
  assert.equal(ctx.verify.calls.verifyRankedRun, 0);
  await local.chain.request('evm_setAutomine', [true]);
  await local.chain.mine();
  await syncClock();
  const settled = await post(handler, body);
  assert.equal(settled.status, 200, JSON.stringify(settled.body));
  assert.equal(settled.body.status, 'confirmed');
}));

test('an underpaid entry is 402 entry-underpaid', async () => scenario(async (ctx) => {
  const operatorEntry = localContracts(local.record, local.chain.wallets.operator).rankedEntry;
  await (await operatorEntry.setEntryFeeEnabled(false)).wait();
  const { body, paid } = await paidBody({ value: 0n });
  assert.equal(paid.amountWei, 0n, 'a zero-fee session on the local chain');
  const response = await post(settleHandler(ctx), body);
  assert.deepEqual([response.status, response.body], [402, { ok: false, error: 'entry-underpaid' }]);
  assert.equal(ctx.verify.calls.verifyRankedRun, 0);
  // The minimum is configurable (RANKED_MIN_PAID_WEI); the default is 0.102 zkLTC.
  await (await operatorEntry.setEntryFeeEnabled(true)).wait();
  const normal = await paidBody();
  assert.equal(normal.paid.amountWei, 102_000_000_000_000_000n);
  const strict = settleHandler(ctx, { envOverride: { ...env, RANKED_MIN_PAID_WEI: '102000000000000001' } });
  assert.deepEqual((await post(strict, normal.body)).body, { ok: false, error: 'entry-underpaid' });
}));

test('a stale ticket is rejected; an early settle is retryable with retryAfterMs', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const player = local.chain.wallets.player1;
  // Ticket issued more than 30 minutes before the entry opened.
  const late = await buildSettleBody({ wallet: player.address, registry, nowMs: clockMs, ticketIssuedAtMs: clockMs - 1_900_000 });
  await openPaidSession({ chain: local.chain, record: local.record, player, sessionId32: late.sessionId32, gameId: 'chikun' });
  await syncClock();
  assert.deepEqual((await post(handler, late)).body, { ok: false, error: 'seed-ticket-stale' });
  // Ticket issued more than 2 minutes after the entry opened.
  const early = await buildSettleBody({ wallet: player.address, registry, nowMs: clockMs + 150_000 });
  await openPaidSession({ chain: local.chain, record: local.record, player, sessionId32: early.sessionId32, gameId: 'chikun' });
  await advanceChain(200);
  assert.deepEqual((await post(handler, early)).body, { ok: false, error: 'seed-ticket-stale' });

  // A 10-minute run settled 2 minutes after opening: wait, then settle.
  const { body, paid } = await paidBody({ evidenceOptions: { flaps: 400, gap: 90 } });
  const lengthSeconds = Math.floor((30 + 90 * 399 + 120) / 60);
  const response = await post(handler, body);
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'run-timing-early');
  assert.equal(response.body.retryable, true);
  const expected = (paid.openedAt + lengthSeconds - 30) * 1000 - clockMs;
  assert.ok(Math.abs(response.body.retryAfterMs - expected) <= 1000, `${response.body.retryAfterMs} vs ${expected}`);
  assert.equal((await ctx.db.query('SELECT count(*)::int AS n FROM verified_sessions'))[0].n, 0, 'an early run is not recorded');
  await advanceChain(lengthSeconds);
  const settled = await post(handler, body);
  assert.equal(settled.body.status, 'confirmed', JSON.stringify(settled.body));
  // Runs held back more than 7 days are stale.
  const { body: held } = await paidBody();
  await advanceChain(7 * 24 * 3600 + 120);
  assert.deepEqual((await post(handler, held)).body, { ok: false, error: 'run-stale' });
}));

test('a locked hero is rejected until the wallet has the runs', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const player = local.chain.wallets.player1;
  const wallet = player.address.toLowerCase();
  const locked = await paidBody({ gameId: 'lester-blaster', evidenceOptions: { heroId: 'lilly', elapsedMs: 60_000 } });
  await advanceChain(60);
  assert.deepEqual((await post(handler, locked.body)).body, { ok: false, error: 'hero-locked' });
  assert.equal(ctx.verify.calls.verifyRankedRun, 0, 'the gate runs before verification');
  const starter = await paidBody({ gameId: 'lester-blaster', evidenceOptions: { heroId: 'lit-commando', elapsedMs: 60_000 } });
  await advanceChain(60);
  assert.equal((await post(handler, starter.body)).body.status, 'confirmed', 'starters are never gated');
  for (let index = 0; index < 9; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await seedVerifiedSession(ctx.db, { wallet, gameId: 'lester-blaster', score: 100 + index });
  }
  assert.equal((await post(handler, locked.body)).body.status, 'confirmed', 'ten recorded runs (history excludes this session) unlock Lilly');
  const [row] = await ctx.db.query('SELECT plausibility::text AS plausibility, boss_id FROM verified_sessions WHERE session_id32 = $1', [locked.body.sessionId32]);
  assert.deepEqual(JSON.parse(row.plausibility), { verdict: 'ok', flags: [] }, 'HMH plausibility flags are stored (non-public)');
  assert.equal(row.boss_id, null);

  // A hero in neither HMH_FREE_HEROES nor HMH_HERO_GATES is never free, however
  // many runs the wallet has (the run-summary schema accepts any id-shaped heroId).
  const unknown = await paidBody({ gameId: 'lester-blaster', evidenceOptions: { heroId: 'lester-original-2', elapsedMs: 60_000 } });
  await advanceChain(60);
  const verifyCalls = ctx.verify.calls.verifyRankedRun;
  const refused = await post(handler, unknown.body);
  assert.deepEqual([refused.status, refused.body], [422, { ok: false, error: 'hero-locked' }]);
  const blank = await paidBody({ gameId: 'lester-blaster', evidenceOptions: { heroId: '', elapsedMs: 60_000 } });
  await advanceChain(60);
  assert.deepEqual((await post(handler, blank.body)).body, { ok: false, error: 'hero-locked' });
  assert.equal(ctx.verify.calls.verifyRankedRun, verifyCalls, 'refused before verification');
  const [recorded] = await ctx.db.query('SELECT count(*)::int AS n FROM verified_sessions WHERE session_id32 IN (SELECT jsonb_array_elements_text($1::jsonb))', [JSON.stringify([unknown.body.sessionId32, blank.body.sessionId32])]);
  assert.equal(recorded.n, 0, 'nothing recorded');

  // Without the free-hero list the gate cannot decide: fail closed.
  const gatesOnly = settleHandler(ctx, { wrap: (deps) => ({ ...deps, heroGates: { gates: HERO_GATES_DOUBLE.gates } }) });
  assert.deepEqual((await post(gatesOnly, unknown.body)).body, { ok: false, error: 'settlement-not-configured', detail: 'hero-gates-unavailable' });
}));

test('an implausible HMH run is 422 with the verifier\'s flag ids and severities only', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const { body } = await paidBody({ gameId: 'lester-blaster', evidenceOptions: { elapsedMs: 60_000, xp: 2_000_000 } });
  await advanceChain(60);
  const response = await post(handler, body);
  assert.equal(response.status, 422);
  assert.deepEqual(response.body, {
    ok: false,
    error: 'implausible-run',
    flags: [{ id: 'xp-above-ceiling', severity: 'reject' }, { id: 'xp-near-ceiling', severity: 'flag' }],
  }, 'never the measured value or the ceiling');
  assert.equal((await ctx.db.query('SELECT count(*)::int AS n FROM verified_sessions'))[0].n, 0);
}));

test('retry bodies do not spend the IP budget; full bodies do', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const { body } = await paidBody();
  const settled = await post(handler, body);
  assert.equal(settled.body.status, 'confirmed');
  const wallet = local.chain.wallets.player1.address.toLowerCase();
  assert.equal(await bucketHits(ctx.db, 'settle:ip:'), 1);
  assert.equal(await bucketHits(ctx.db, `settle:w:${wallet}`), 1);
  for (let index = 0; index < 3; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    const retry = await post(handler, { v: 'lesters-ranked-settle-v1', sessionId32: body.sessionId32, retry: true });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.status, 'confirmed');
  }
  assert.equal(await bucketHits(ctx.db, 'settle:ip:'), 1, 'retries never count against the IP bucket');
  assert.equal(await bucketHits(ctx.db, `settle:w:${wallet}`), 1);
  assert.equal(await bucketHits(ctx.db, `settle-retry:w:${wallet}`), 3);
  assert.equal(ctx.verify.calls.verifyRankedRun, 1, 'retry bodies never re-verify');
  const unknown = await post(handler, { v: 'lesters-ranked-settle-v1', sessionId32: `0x${'ab'.repeat(32)}`, retry: true });
  assert.deepEqual([unknown.status, unknown.body.error], [404, 'session-not-found']);
  const foreign = await post(handler, { v: 'lesters-ranked-settle-v1', sessionId32: body.sessionId32, retry: true }, { wallet: local.chain.wallets.player2.address });
  assert.deepEqual([foreign.status, foreign.body.error], [403, 'wallet-mismatch']);
  const malformed = await post(handler, { v: 'lesters-ranked-settle-v1', sessionId32: body.sessionId32, retry: true, extra: 1 });
  assert.deepEqual([malformed.status, malformed.body.error], [400, 'invalid-body']);
}));

test('a retry before next_attempt_at does not submit', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const relayer = local.chain.wallets.relayer.address;
  const balance = await local.chain.provider.getBalance(relayer);
  const { body } = await paidBody();
  await local.chain.setBalance(relayer, 1000n);
  const first = await post(handler, body);
  assert.equal(first.status, 200);
  assert.deepEqual([first.body.status, first.body.lastError, first.body.retryable, first.body.attempts], ['failed', 'relayer-underfunded', true, 0]);
  assert.equal(Date.parse(first.body.nextAttemptAt), clockMs + 60_000);
  assert.equal(first.body.pollAfterMs, 3000);
  await local.chain.setBalance(relayer, balance);
  const nonce = await relayerNonce();
  const retry = { v: 'lesters-ranked-settle-v1', sessionId32: body.sessionId32, retry: true };
  const early = await post(handler, retry);
  assert.deepEqual([early.body.status, early.body.nextAttemptAt], ['failed', first.body.nextAttemptAt], 'the current state, unchanged');
  const again = await post(handler, body);
  assert.equal(again.body.status, 'failed', 'a repeated full body follows the same rule');
  assert.equal(await relayerNonce(), nonce, 'nothing was submitted');
  const row = await readSettleRow(ctx.db, body.sessionId32);
  assert.deepEqual([row.infraFailures, row.attempts], [1, 0]);
  clockMs += 61_000;
  const due = await post(handler, retry);
  assert.equal(due.body.status, 'confirmed', JSON.stringify(due.body));
  assert.equal(await relayerNonce(), nonce + 1);
}));

test('rate limits per wallet and per IP', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const alice = local.chain.wallets.player1.address.toLowerCase();
  const bob = local.chain.wallets.player2.address.toLowerCase();
  const probe = { v: 'lesters-ranked-settle-v1', sessionId32: `0x${'cd'.repeat(32)}`, retry: true };
  assert.equal((await post(handler, probe)).status, 404, 'the first request creates the schema itself');
  await fillBucket(ctx.db, `settle:w:${alice}`, 120);
  const walletLimited = await post(handler, { v: 'lesters-ranked-settle-v1' });
  assert.deepEqual([walletLimited.status, walletLimited.body.error], [429, 'rate-limited']);
  assert.ok(Number(walletLimited.headers['retry-after']) >= 1);
  assert.equal((await post(handler, { v: 'lesters-ranked-settle-v1' }, { wallet: bob })).status, 400, 'another wallet on this IP still passes');
  await fillBucket(ctx.db, `settle:ip:${ipBucket(IP, SETTLE_SESSION_VALUE)}`, 240);
  const ipLimited = await post(handler, { v: 'lesters-ranked-settle-v1' }, { wallet: bob });
  assert.deepEqual([ipLimited.status, ipLimited.body.error], [429, 'rate-limited']);
  assert.equal((await post(handler, { v: 'lesters-ranked-settle-v1' }, { wallet: bob, ip: '2001:db8:1:2::9' })).status, 400, 'another /64 passes');
  await fillBucket(ctx.db, `settle:ip:${ipBucket('2001:db8:1:2::9', SETTLE_SESSION_VALUE)}`, 240);
  assert.equal((await post(handler, { v: 'lesters-ranked-settle-v1' }, { wallet: bob, ip: '2001:db8:1:2:ffff::1' })).status, 429, 'IPv6 is folded to its /64');
  assert.equal((await post(handler, probe, { wallet: bob })).status, 404, 'retry bodies ignore the IP bucket');
  await fillBucket(ctx.db, `settle-retry:w:${bob}`, 240);
  assert.equal((await post(handler, probe, { wallet: bob })).status, 429, 'retry bodies have their own wallet bucket');
}));

test('oversize bodies are 413 before parsing', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const { fakeResponse } = await import('./helpers/fake-http.mjs');
  let reads = 0;
  const res = fakeResponse();
  await handler({ method: 'POST', url: '/api/settle', headers: { authorization: bearer(local.chain.wallets.player1.address), 'content-length': '1800001' }, get body() { reads += 1; return {}; } }, res);
  assert.deepEqual([res.statusCode, res.json], [413, { ok: false, error: 'body-too-large' }]);
  assert.equal(reads, 0, 'the declared length is checked before the body is touched');
  const big = await post(handler, { v: 'lesters-ranked-settle-v1', pad: 'x'.repeat(1_800_001) });
  assert.deepEqual([big.status, big.body.error], [413, 'body-too-large'], 'a parsed body is measured when no length is declared');
  const json = await post(handler, '{"v":');
  assert.deepEqual([json.status, json.body.error], [400, 'invalid-json']);
}));

test('malformed bodies, identity errors and foreign wallets stop before any chain read', async () => scenario(async (ctx) => {
  const counts = {};
  const handler = settleHandler(ctx, { wrap: (deps) => ({ ...deps, chain: countingChain(deps.chain, counts) }) });
  const player = local.chain.wallets.player1;
  const body = await buildSettleBody({ wallet: player.address, registry, nowMs: clockMs, claim: { score: 1200 } });
  const cases = [
    [{ ...body, extra: true }, 400, 'invalid-body'],
    [{ ...body, v: 'lesters-ranked-settle-v0' }, 400, 'invalid-body'],
    [{ ...body, gameId: 'tetris' }, 400, 'invalid-body'],
    [{ ...body, sessionId32: body.sessionId32.toUpperCase() }, 400, 'invalid-body'],
    [{ ...body, entryTxHash: '0x1234' }, 400, 'invalid-body'],
    [{ ...body, claim: { score: 1.5 } }, 400, 'invalid-body'],
    [{ ...body, claim: { score: 1e13 } }, 400, 'invalid-body'],
    [{ ...body, claim: { score: 5, achievements: [] } }, 400, 'invalid-body'],
    [{ ...body, evidence: { ...body.evidence, encoding: 'stacked-sic1+base64' } }, 400, 'invalid-evidence'],
    [{ ...body, evidence: { ...body.evidence, extra: 1 } }, 400, 'invalid-evidence'],
    [{ ...body, evidence: { encoding: body.evidence.encoding } }, 400, 'invalid-evidence'],
    [{ ...body, identity: { ...body.identity, wallet: local.chain.wallets.player2.address.toLowerCase() } }, 403, 'wallet-mismatch'],
    [{ ...body, identity: { ...body.identity, chainId: 1 } }, 400, 'identity-chain-mismatch'],
    [{ ...body, seedTicket: { ...body.seedTicket, mac: '0'.repeat(64) } }, 400, 'seed-ticket-invalid'],
    [{ ...body, identity: { ...body.identity, seed: (body.identity.seed + 1) >>> 0 } }, 400, 'identity-seed-mismatch'],
    [{ ...body, sessionId32: `0x${'ef'.repeat(32)}` }, 400, 'session-key-mismatch'],
  ];
  for (const [candidate, status, error] of cases) {
    // eslint-disable-next-line no-await-in-loop
    const response = await post(handler, candidate);
    assert.deepEqual([response.status, response.body.error], [status, error], error);
  }
  assert.equal(counts.getPaidSession ?? 0, 0, 'no chain read before the binding passes');
  assert.equal(ctx.verify.calls.verifyRankedRun, 0);

  // A verifier rejection returns the verifier's status and code.
  const hmh = await paidBody({ gameId: 'lester-blaster', evidenceOptions: { elapsedMs: 30_000 } });
  hmh.body.evidence.runSummary.identity.terminalReason = 'quit';
  assert.deepEqual((await post(handler, hmh.body)).body, { ok: false, error: 'run-summary-not-terminal' });
}));

test('a verified paid run is recorded, signed, relayed and confirmed on the local chain', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const player = local.chain.wallets.player1;
  const { body, paid } = await paidBody({ claim: { score: 999_999 }, evidenceOptions: { flaps: 25 } });
  await advanceChain(10);
  const nonce = await relayerNonce();
  const response = await post(handler, body);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.headers['cache-control'], 'no-store');
  const view = response.body;
  assert.deepEqual(Object.keys(view).sort(), ['achievements', 'attempts', 'blockNumber', 'confirmedAt', 'contract', 'envelopeHash', 'explorerUrl', 'gameId', 'lastError', 'nextAttemptAt', 'ok', 'pollAfterMs', 'retryable', 'score', 'sessionId32', 'shareId', 'stats', 'status', 'txHash', 'verifiedAt', 'view', 'wallet'].sort());
  assert.equal(view.view, 'owner');
  assert.equal(view.status, 'confirmed');
  assert.equal(view.wallet, player.address.toLowerCase());
  assert.equal(view.shareId, body.sessionId32.slice(2));
  assert.equal(view.score, 2500, 'the server score, never the claim');
  assert.deepEqual(view.contract, { kills: 25, maxCombo: 12, survivalSeconds: 38, bossId: null });
  assert.equal(view.stats.forksPassed, 25);
  assert.equal(view.retryable, false);
  assert.equal(view.pollAfterMs, null);
  assert.equal(view.lastError, null);
  assert.match(view.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(view.explorerUrl, `https://liteforge.explorer.caldera.xyz/tx/${view.txHash}`);
  assert.equal(await relayerNonce(), nonce + 1, 'one relayed transaction');
  assert.ok(!JSON.stringify(view).includes('999999'), 'the client claim never appears in a response');

  const receipt = await local.chain.provider.getTransactionReceipt(view.txHash);
  assert.equal(receipt.status, 1);
  assert.equal(view.blockNumber, receipt.blockNumber);
  const scores = localContracts(local.record, local.chain.provider).scores;
  const session = await scores.getSession(body.sessionId32);
  assert.deepEqual([session.exists, session.player.toLowerCase(), session.score, session.kills], [true, view.wallet, 2500n, 25n]);
  assert.equal(await scores.sessionEnvelopeHash(body.sessionId32), view.envelopeHash, 'the server-computed v2 envelope hash is on chain');
  assert.equal(session.runtimeId, ethers.id('chikun:canvas-runtime-v7'));
  assert.equal(session.seasonId, ethers.id('chikun-season-preview-1'));

  const [row] = await ctx.db.query(`SELECT status, entry_amount_wei, client_claim::text AS claim, opened_at IS NOT NULL AS opened, source,
      (SELECT count(*)::int FROM session_evidence e WHERE e.session_id32 = v.session_id32) AS evidence
    FROM verified_sessions v WHERE session_id32 = $1`, [body.sessionId32]);
  assert.deepEqual(row, { status: 'confirmed', entry_amount_wei: String(paid.amountWei), claim: '{"score": 999999}', opened: true, source: 'settle', evidence: 1 });
  const stored = await readSettleRow(ctx.db, body.sessionId32);
  assert.deepEqual(Object.keys(stored.attestation).sort(), ['achievements32', 'deadline', 'digest', 'signature'], 'the attestation column holds only the four fields');
  assert.equal(Number(stored.attestation.deadline), Math.floor(clockMs / 1000) + 900, 'deadline = now + ATTESTATION_TTL_SECONDS');
}));

test('period keys come from the entry\'s openedAt', async () => scenario(async (ctx) => {
  const { body, paid } = await paidBody();
  await advanceChain(2 * 24 * 3600 + 3600);
  const response = await post(settleHandler(ctx), body);
  assert.equal(response.body.status, 'confirmed', JSON.stringify(response.body));
  const row = await readSettleRow(ctx.db, body.sessionId32);
  const opened = periodKeysFor(paid.openedAt * 1000);
  assert.deepEqual([row.dayKey, row.weekKey, row.monthKey], [opened.day, opened.week, opened.month]);
  assert.notEqual(row.dayKey, periodKeysFor(clockMs).day, 'not the settle day');
  assert.equal(row.openedAt, new Date(paid.openedAt * 1000).toISOString());
}));

test('achievements are all recorded and only catalog NFT ids are sent on chain', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const { body } = await paidBody({ evidenceOptions: { flaps: 25 } });
  await advanceChain(10);
  const response = await post(handler, body);
  assert.equal(response.body.status, 'confirmed', JSON.stringify(response.body));
  const recorded = response.body.achievements.map((item) => item.id);
  const nft = ctx.catalog.nftAchievementIds('chikun');
  assert.deepEqual(recorded.slice(0, 3), ['chikun-first-flight', 'chikun-ten-forks', 'chikun-coast-legend'], 'catalog order');
  assert.equal(recorded.length, 3 + 40, 'every earned id is recorded');
  assert.ok(!recorded.includes('chikun-unavailable'), 'unavailable entries are never earned');
  const [counts] = await ctx.db.query('SELECT count(*)::int AS n FROM achievement_unlocks WHERE session_id32 = $1', [body.sessionId32]);
  assert.equal(counts.n, 43);
  const scores = localContracts(local.record, local.chain.provider).scores;
  const onChain = [...await scores.getSessionAchievements(body.sessionId32)];
  const expected = recorded.filter((id) => nft.includes(id)).slice(0, 32).map((id) => ethers.id(id));
  assert.equal(onChain.length, 32, 'at most 32 ids ride in one settlement');
  assert.deepEqual(onChain, expected, 'only current-catalog NFT candidates, in catalog order');
  const row = await readSettleRow(ctx.db, body.sessionId32);
  assert.equal(row.achievements.length, 43);
  assert.deepEqual(row.nftAchievements, recorded.filter((id) => nft.includes(id)).slice(0, 32));
  const first = response.body.achievements[0];
  assert.deepEqual(first, { id: 'chikun-first-flight', gameId: 'chikun', title: 'Title chikun-first-flight', tier: 'bronze', nft: false, image: '/assets/fixture/chikun-first-flight.png', unlockedAt: first.unlockedAt, tokenId: null });
  assert.equal(response.body.achievements[2].nft, true);

  // The next run derives against history: already-unlocked ids are not
  // recorded again, and run-count criteria see this session.
  await syncClock();
  const second = await paidBody();
  const next = await post(handler, second.body);
  assert.deepEqual(next.body.achievements.map((item) => item.id), [], 'nothing new for a second, shorter run');
  const third = await paidBody();
  assert.deepEqual((await post(handler, third.body)).body.achievements.map((item) => item.id), ['chikun-three-runs', 'chikun-forks-total-40'], 'run counts and cumulative sums include this run');
}, { catalog: { extraNft: 40 } }));

test('a repeat POST returns the same state without a second transaction', async () => scenario(async (ctx) => {
  const counts = {};
  const handler = settleHandler(ctx, { wrap: (deps) => ({ ...deps, chain: countingChain(deps.chain, counts) }) });
  const { body } = await paidBody();
  const first = await post(handler, body);
  assert.equal(first.body.status, 'confirmed');
  const nonce = await relayerNonce();
  const verifyCalls = ctx.verify.calls.verifyRankedRun;
  const paidReads = counts.getPaidSession;
  const second = await post(handler, body);
  assert.equal(second.status, 200);
  assert.deepEqual(second.body, first.body, 'the same SettleResponse');
  assert.equal(ctx.verify.calls.verifyRankedRun, verifyCalls, 'no second replay');
  assert.equal(counts.getPaidSession, paidReads, 'no second paid-entry read');
  assert.equal(await relayerNonce(), nonce, 'no second transaction');
}));

test('an RPC failure on the paid-entry read is a retryable 502 chain-read-failed', async () => scenario(async (ctx) => {
  const failing = (deps) => ({ ...deps, chain: { ...deps.chain, getPaidSession: async () => { throw Object.assign(new Error('fetch failed https://user:hunter2@rpc.example'), { code: 'NETWORK_ERROR' }); } } });
  const { body } = await paidBody();
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  let response;
  try {
    response = await post(settleHandler(ctx, { wrap: failing }), body);
  } finally {
    console.error = original;
  }
  assert.deepEqual([response.status, response.body], [502, { ok: false, error: 'chain-read-failed', retryable: true, retryAfterMs: 5000 }]);
  assert.equal(ctx.verify.calls.verifyRankedRun, 0);
  assert.ok(logged.every((line) => !line.includes('hunter2') && !line.includes('rpc.example')), 'logs carry the name and code only');
  assert.equal((await post(settleHandler(ctx), body)).body.status, 'confirmed', 'the same body settles once the RPC answers');
}));

test('a thrown core error is 500 internal-error with nothing but the name and code logged', async () => scenario(async (ctx) => {
  const { body } = await paidBody();
  const neonUrl = 'postgresql://owner:hunter2@ep-secret.neon.tech/neondb';
  const throwing = (deps) => ({ ...deps, verify: { ...deps.verify, bindRankedIdentity: async () => { throw Object.assign(new TypeError(`boom ${neonUrl}`), { code: 'ERR_FIXTURE' }); } } });
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  let response;
  try {
    response = await post(settleHandler(ctx, { wrap: throwing }), body);
  } finally {
    console.error = original;
  }
  assert.deepEqual([response.status, response.body], [500, { ok: false, error: 'internal-error' }]);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(logged, [['[settle] internal-error', { name: 'TypeError', code: 'ERR_FIXTURE', sqlstate: null }]]);
  assert.doesNotMatch(JSON.stringify(logged), /hunter2|postgresql|boom/);
}));

test('a double-tapped POST records one row and sends one transaction', async () => scenario(async (ctx) => {
  const { body } = await paidBody();
  const nonce = await relayerNonce();
  const [first, second] = await Promise.all([post(settleHandler(ctx), body), post(settleHandler(ctx), body)]);
  assert.deepEqual([first.status, second.status], [200, 200], JSON.stringify([first.body, second.body]));
  assert.equal((await ctx.db.query('SELECT count(*)::int AS n FROM verified_sessions'))[0].n, 1);
  assert.equal((await ctx.db.query('SELECT count(*)::int AS n FROM session_evidence'))[0].n, 1);
  assert.equal(await relayerNonce(), nonce + 1, 'one relayed transaction');
  assert.ok([first.body.status, second.body.status].includes('confirmed'));
  assert.equal((await readSettleRow(ctx.db, body.sessionId32)).status, 'confirmed');
}));

test('a repeat POST whose evidence does not decode is 400 invalid-evidence, not a conflict', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const { body } = await paidBody({ gameId: 'stacked' });
  assert.equal((await post(handler, body)).body.status, 'confirmed');
  // The real computeEvidenceDigest decodes the SIC1 (verify's
  // decodeStackedEvidence): garbled base64, a body too short for the SIC1
  // header and a start level other than 1 are all undecodable.
  const undecodable = [
    { ...body.evidence, sic1: `${body.evidence.sic1.slice(0, -2)}!!` },
    { ...body.evidence, sic1: Buffer.alloc(21, 0x5a).toString('base64') },
    { ...body.evidence, startLevel: 2 },
  ];
  for (const evidence of undecodable) {
    // eslint-disable-next-line no-await-in-loop
    assert.deepEqual((await post(handler, { ...body, evidence })).body, { ok: false, error: 'invalid-evidence' });
  }
  const other = { ...body, evidence: stackedEvidence({ lines: 21, seed: body.identity.seed }) };
  assert.deepEqual((await post(handler, other)).body, { ok: false, error: 'session-conflict' }, 'decodable but different evidence is still 409');
  assert.equal(ctx.verify.calls.verifyRankedRun, 1, 'a repeat POST never re-verifies');
}));

test('a different evidence digest for the same session is 409', async () => scenario(async (ctx) => {
  const handler = settleHandler(ctx);
  const { body } = await paidBody();
  assert.equal((await post(handler, body)).body.status, 'confirmed');
  const altered = { ...body, evidence: { ...body.evidence, flap: { ...body.evidence.flap, flapDeltas: [...body.evidence.flap.flapDeltas, 90] } } };
  assert.deepEqual((await post(handler, altered)).body, { ok: false, error: 'session-conflict' });
  const row = await readSettleRow(ctx.db, body.sessionId32);
  assert.equal(row.score, 1200, 'the stored run is untouched');
}));

test('two concurrent settles serialize through the lease and both confirm', async () => scenario(async (ctx) => {
  const alice = await paidBody({ player: local.chain.wallets.player1 });
  const bob = await paidBody({ player: local.chain.wallets.player2 });
  const nonce = await relayerNonce();
  const [first, second] = await Promise.all([
    post(settleHandler(ctx), alice.body, { wallet: local.chain.wallets.player1.address }),
    post(settleHandler(ctx), bob.body, { wallet: local.chain.wallets.player2.address }),
  ]);
  assert.equal(first.body.status, 'confirmed', JSON.stringify(first.body));
  assert.equal(second.body.status, 'confirmed', JSON.stringify(second.body));
  const rows = await Promise.all([readSettleRow(ctx.db, alice.body.sessionId32), readSettleRow(ctx.db, bob.body.sessionId32)]);
  assert.deepEqual(rows.map((row) => row.txNonce).sort((a, b) => a - b), [nonce, nonce + 1], 'one nonce each, no collision');
  assert.equal(await relayerNonce(), nonce + 2);
}));

test('the status endpoint shows the public view without the owner\'s token', async () => scenario(async (ctx) => {
  const settle = settleHandler(ctx);
  const status = statusHandler(ctx);
  const owner = local.chain.wallets.player1.address;
  const { body } = await paidBody();
  // An unpublished run: the relayer cannot pay for gas yet.
  const relayer = local.chain.wallets.relayer.address;
  const balance = await local.chain.provider.getBalance(relayer);
  await local.chain.setBalance(relayer, 1000n);
  await post(settle, body);
  await local.chain.setBalance(relayer, balance);
  const publicFailed = await getStatus(status, `sessionId32=${body.sessionId32}`);
  assert.equal(publicFailed.status, 200);
  assert.deepEqual(Object.keys(publicFailed.body).sort(), ['blockNumber', 'confirmedAt', 'explorerUrl', 'gameId', 'nextAttemptAt', 'ok', 'pollAfterMs', 'retryable', 'sessionId32', 'shareId', 'status', 'txHash', 'view'].sort());
  assert.deepEqual([publicFailed.body.view, publicFailed.body.status, publicFailed.body.retryable], ['public', 'failed', true]);
  const ownerFailed = await getStatus(status, `id=${body.sessionId32.slice(2)}`, { wallet: owner });
  assert.deepEqual([ownerFailed.body.view, ownerFailed.body.lastError, ownerFailed.body.attempts, ownerFailed.body.wallet], ['owner', 'relayer-underfunded', 0, owner.toLowerCase()]);
  const stranger = await getStatus(status, `sessionId32=${body.sessionId32}`, { wallet: local.chain.wallets.player2.address });
  assert.equal(stranger.body.view, 'public', 'another wallet\'s token gets the public view');

  clockMs += 61_000;
  await post(settle, { v: 'lesters-ranked-settle-v1', sessionId32: body.sessionId32, retry: true });
  const publicConfirmed = await getStatus(status, `sessionId32=${body.sessionId32}`);
  assert.equal(publicConfirmed.body.status, 'confirmed');
  assert.equal(publicConfirmed.body.score, 1200, 'a confirmed run is a public record');
  assert.ok(Array.isArray(publicConfirmed.body.achievements) && publicConfirmed.body.stats && publicConfirmed.body.contract);
  for (const hidden of ['wallet', 'lastError', 'attempts']) assert.equal(Object.hasOwn(publicConfirmed.body, hidden), false, hidden);

  for (const [query, code, error] of [
    ['sessionId32=0x1234', 400, 'invalid-session-id'],
    ['', 400, 'invalid-session-id'],
    [`sessionId32=${body.sessionId32}&id=${'ab'.repeat(32)}`, 400, 'invalid-session-id'],
    [`sessionId32=0x${'ab'.repeat(32)}`, 404, 'session-not-found'],
    [`sessionId32=${body.sessionId32}&cb=1`, 400, 'invalid-query'],
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await getStatus(status, query);
    assert.deepEqual([response.status, response.body.error], [code, error], query);
  }
  const noNeon = await invoke(statusApi.createHandler(() => statusApi.buildDeps({})), { url: `/api/settle-status?sessionId32=${body.sessionId32}` });
  assert.deepEqual([noNeon.status, noNeon.body.error], [503, 'index-not-configured']);
  await ctx.db.query('DELETE FROM rate_limits');
  await fillBucket(ctx.db, `status:ip:${ipBucket(IP, SETTLE_SESSION_VALUE)}`, 1200);
  assert.equal((await getStatus(status, `sessionId32=${body.sessionId32}`)).status, 429, 'status:ip is 1,200 per hour');
}));

test('the status endpoint confirms a submitted row from its receipt', async () => scenario(async (ctx) => {
  const { body } = await paidBody();
  await local.chain.request('evm_setAutomine', [false]);
  const keys = localWalletKeys();
  const quickRelayer = (deps) => ({
    ...deps,
    relayer: createRelayer({ db: ctx.db, provider: local.chain.provider, wallet: new ethers.Wallet(keys.relayer, local.chain.provider), registryAddress: registry, reserveWei: LOCAL_FEE_CAP_RESERVE_WEI, nowMs, receiptTimeoutMs: 50 }),
  });
  const submitted = await post(settleHandler(ctx, { wrap: quickRelayer }), body);
  assert.deepEqual([submitted.body.status, submitted.body.pollAfterMs, submitted.body.retryable], ['submitted', 2500, true]);
  let receiptCalls = 0;
  const provider = new Proxy(local.chain.provider, {
    get(target, key) {
      if (key === 'getTransactionReceipt') return async (hash) => { receiptCalls += 1; return target.getTransactionReceipt(hash); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const status = statusHandler(ctx, { provider });
  const stillPending = await getStatus(status, `sessionId32=${body.sessionId32}`);
  assert.equal(stillPending.body.status, 'submitted');
  assert.equal(receiptCalls, 1);
  await getStatus(status, `sessionId32=${body.sessionId32}`);
  assert.equal(receiptCalls, 1, 'at most one receipt check every 3 s');
  await local.chain.mine();
  clockMs += 3_100;
  const confirmed = await getStatus(status, `sessionId32=${body.sessionId32}`, { wallet: local.chain.wallets.player1.address });
  assert.equal(receiptCalls, 2);
  assert.deepEqual([confirmed.body.status, confirmed.body.view, confirmed.body.pollAfterMs], ['confirmed', 'owner', null]);
  const receipt = await local.chain.provider.getTransactionReceipt(confirmed.body.txHash);
  assert.equal(confirmed.body.blockNumber, receipt.blockNumber);
}));

test('a paused or unready service answers 503 before the body is read', async () => scenario(async (ctx) => {
  const { fakeResponse } = await import('./helpers/fake-http.mjs');
  const paused = { ...env, SETTLEMENT_PAUSED: 'true' };
  const token = bearer(local.chain.wallets.player1.address);
  let reads = 0;
  const raw = (url, headers) => ({ method: 'POST', url, headers: { authorization: token, ...headers }, get body() { reads += 1; return '{"v":'; } });
  const cases = [
    [settleHandler(ctx, { envOverride: paused }), '/api/settle', {}, 'settlement-paused'],
    [settleHandler(ctx, { envOverride: paused }), '/api/settle', { 'content-length': '5000000' }, 'settlement-paused'],
    [seedHandler(ctx, { envOverride: paused }), '/api/ranked-seed', {}, 'settlement-paused'],
    [seedHandler(ctx, { envOverride: paused }), '/api/ranked-seed', { 'content-length': '5000000' }, 'settlement-paused'],
    [settleHandler(ctx, { wrap: (deps) => ({ ...deps, catalog: null }) }), '/api/settle', {}, 'settlement-not-configured'],
    [seedHandler(ctx, { wrap: (deps) => ({ ...deps, verify: null }) }), '/api/ranked-seed', {}, 'settlement-not-configured'],
  ];
  for (const [handler, url, headers, error] of cases) {
    const res = fakeResponse();
    // eslint-disable-next-line no-await-in-loop
    await handler(raw(url, headers), res);
    assert.deepEqual([res.statusCode, res.json.error], [503, error], `${url} ${JSON.stringify(headers)}`);
  }
  assert.equal(reads, 0, 'neither a malformed nor an oversized body is read while paused or unready');
  assert.equal((await ctx.db.query("SELECT to_regclass('public.schema_migrations') IS NULL AS absent"))[0].absent, true);
}));

test('the seed endpoint stops before payment whenever E3 could not settle the run', async () => scenario(async (ctx) => {
  const uuid = '33333333-3333-4333-8333-333333333333';
  const chikun = { gameId: 'chikun', sessionId: `game-session-${uuid}`, seasonId: 'chikun-season-preview-1', buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0' };
  const hmh = { gameId: 'lester-blaster', sessionId: `game-session-${uuid}`, seasonId: 'hmh-season-1-2026', buildHash: 'site-1.7.0:game-1.7.0' };
  const call = (handler, body) => invoke(handler, { method: 'POST', url: '/api/ranked-seed', headers: { authorization: bearer(local.chain.wallets.player1.address), 'x-forwarded-for': IP }, body });
  for (const [wrap, detail] of [
    [(deps) => ({ ...deps, verify: null }), 'verify-unavailable'],
    [(deps) => ({ ...deps, verify: { ...deps.verify, reverifyStoredRun: undefined } }), 'verify-unavailable'],
    [(deps) => ({ ...deps, catalog: null }), 'achievements-unavailable'],
    [(deps) => ({ ...deps, issueSeedTicket: null }), 'seed-ticket-unavailable'],
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await call(seedHandler(ctx, { wrap }), chikun);
    assert.deepEqual([response.status, response.body.error, response.body.detail], [503, 'settlement-not-configured', detail]);
  }
  const noGates = seedHandler(ctx, { wrap: (deps) => ({ ...deps, heroGates: async () => null }) });
  assert.deepEqual((await call(noGates, hmh)).body, { ok: false, error: 'settlement-not-configured', detail: 'hero-gates-unavailable' }, 'an HMH ticket needs the hero gates');
  assert.equal((await call(noGates, chikun)).status, 200, 'other games do not');
  assert.equal((await call(seedHandler(ctx), hmh)).status, 200);
}));

test('paused settlement answers 503 and touches nothing', async () => scenario(async (ctx) => {
  const paused = { ...env, SETTLEMENT_PAUSED: 'true' };
  const { body } = await paidBody();
  const response = await post(settleHandler(ctx, { envOverride: paused }), body);
  assert.deepEqual([response.status, response.body], [503, { ok: false, error: 'settlement-paused' }]);
  const seed = await invoke(seedHandler(ctx, { envOverride: paused }), { method: 'POST', url: '/api/ranked-seed', headers: { authorization: bearer(local.chain.wallets.player1.address) }, body: {} });
  assert.deepEqual([seed.status, seed.body.error], [503, 'settlement-paused']);
  assert.equal((await ctx.db.query("SELECT to_regclass('public.schema_migrations') IS NULL AS absent"))[0].absent, true, 'no schema, no rate-limit row, no settle row');
  assert.equal(ctx.verify.calls.bindRankedIdentity, 0);
}));

test('the seed endpoint issues tickets only to signed-in wallets and stops when paused', async () => scenario(async (ctx) => {
  const handler = seedHandler(ctx);
  const player = local.chain.wallets.player1;
  const uuid = '11111111-1111-4111-8111-111111111111';
  const request = { gameId: 'chikun', sessionId: `game-session-${uuid}`, seasonId: 'chikun-season-preview-1', buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0' };
  const call = (body, wallet = player.address, extraHeaders = {}) => invoke(handler, { method: 'POST', url: '/api/ranked-seed', headers: { ...(wallet ? { authorization: bearer(wallet) } : {}), 'x-forwarded-for': IP, ...extraHeaders }, body });
  assert.deepEqual((await call(request, null)).body, { ok: false, error: 'invalid-session' });
  assert.deepEqual((await call(request, null, { authorization: bearer(player.address, 'lestersarcade:production') })).body, { ok: false, error: 'invalid-session' });
  const issued = await call(request);
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.deepEqual(Object.keys(issued.body).sort(), ['ok', 'seed', 'seedTicket']);
  const { seedTicket, seed } = issued.body;
  assert.equal(seedTicket.v, 'lesters-ranked-seed-v1');
  assert.match(seedTicket.salt, /^[0-9a-f]{32}$/);
  assert.match(seedTicket.mac, /^[0-9a-f]{64}$/);
  assert.equal(seedTicket.issuedAt, Math.floor(clockMs / 1000), 'issuedAt from the injected clock');
  assert.equal(seed, await deriveRankedSeed({ ...request, wallet: player.address.toLowerCase(), salt: seedTicket.salt }));

  for (const bad of [
    { ...request, gameId: 'tetris' },
    { ...request, seasonId: 'hmh-season-1-2026' },
    { ...request, sessionId: 'game-session-123' },
    { ...request, buildHash: 'site-1.7.0:game-1.7.0' },
    { ...request, gameId: 'lester-blaster', seasonId: 'hmh-season-1-2026', buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.9.0' },
    { ...request, extra: 1 },
    { gameId: 'chikun' },
    [request],
  ]) {
    // eslint-disable-next-line no-await-in-loop
    assert.deepEqual((await call(bad)).body, { ok: false, error: 'invalid-body' }, JSON.stringify(bad));
  }
  const hmh = await call({ gameId: 'lester-blaster', sessionId: request.sessionId, seasonId: 'hmh-season-1-2026', buildHash: 'site-1.7.0:game-1.7.0' });
  assert.equal(hmh.status, 200);
  assert.deepEqual((await call({ ...request, pad: 'x'.repeat(2100) })).body, { ok: false, error: 'body-too-large' });
  const unavailable = await invoke(seedHandler(ctx, { issue: null }), { method: 'POST', url: '/api/ranked-seed', headers: { authorization: bearer(player.address) }, body: request });
  assert.deepEqual([unavailable.status, unavailable.body.detail], [503, 'seed-ticket-unavailable'], 'no ticket without the verify slice');
  await fillBucket(ctx.db, `seed:w:${player.address.toLowerCase()}`, 60);
  assert.equal((await call(request)).status, 429, 'seed:w is 60 per hour');
  assert.equal((await call(request, local.chain.wallets.player2.address)).status, 200);
  await fillBucket(ctx.db, `seed:ip:${ipBucket(IP, SETTLE_SESSION_VALUE)}`, 600);
  assert.equal((await call(request, local.chain.wallets.player2.address)).status, 429, 'seed:ip is 600 per hour');

  // The issued ticket settles: ticket → key → entry → E3.
  const other = local.chain.wallets.player2;
  const ticket = await invoke(seedHandler(ctx), { method: 'POST', url: '/api/ranked-seed', headers: { authorization: bearer(other.address), 'x-forwarded-for': '192.0.2.44' }, body: { ...request, sessionId: 'game-session-22222222-2222-4222-8222-222222222222' } });
  assert.equal(ticket.status, 200);
  const body = await buildSettleBody({ wallet: other.address, registry, nowMs: clockMs, uuid: '22222222-2222-4222-8222-222222222222' });
  const identity = { ...body.identity, seed: ticket.body.seed };
  const { createCanonicalSessionIdentity } = await import('../apps/portal/src/session-integrity.mjs');
  const sessionId32 = (await createCanonicalSessionIdentity(identity)).sessionKey;
  const flap = { ...body.evidence.flap, seed: ticket.body.seed };
  const settleBody = { ...body, identity, sessionId32, seedTicket: ticket.body.seedTicket, evidence: { ...body.evidence, flap } };
  const paid = await openPaidSession({ chain: local.chain, record: local.record, player: other, sessionId32, gameId: 'chikun' });
  settleBody.entryTxHash = paid.txHash;
  await syncClock();
  const settled = await post(settleHandler(ctx), settleBody, { wallet: other.address, ip: '192.0.2.45' });
  assert.equal(settled.body.status, 'confirmed', JSON.stringify(settled.body));
}));

test('attest is retired with 410', async () => {
  const handler = attestApi.createHandler(() => attestApi.buildDeps());
  const { fakeResponse } = await import('./helpers/fake-http.mjs');
  for (const method of ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS']) {
    let reads = 0;
    const res = fakeResponse();
    // eslint-disable-next-line no-await-in-loop
    await handler({ method, url: '/api/attest?x=1', headers: { 'content-length': '5000000' }, get body() { reads += 1; return {}; } }, res);
    assert.deepEqual([res.statusCode, res.json], [410, { ok: false, error: 'endpoint-retired', use: '/api/settle' }], method);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(reads, 0);
  }
  assert.deepEqual((await attestApi.attestRequest()).body, { ok: false, error: 'endpoint-retired', use: '/api/settle' });
  assert.equal(typeof attestApi.default, 'function');
});

test('missing or legacy env fails closed with the variable names only', async () => scenario(async (ctx) => {
  const keys = localWalletKeys();
  const secrets = [keys.verifier, keys.relayer, SETTLE_SESSION_VALUE, keys.verifier.slice(2), keys.relayer.slice(2)];
  const { body } = await paidBody();
  const token = { authorization: bearer(local.chain.wallets.player1.address) };
  const expectations = [];
  const probe = async (label, envOverride, expectedError, expectedDetail) => {
    const settle = await invoke(settleHandler(ctx, { envOverride }), { method: 'POST', url: '/api/settle', headers: token, body });
    const seed = await invoke(seedHandler(ctx, { envOverride }), { method: 'POST', url: '/api/ranked-seed', headers: token, body: {} });
    for (const response of [settle, seed]) {
      expectations.push(label);
      assert.equal(response.status, 503, label);
      assert.equal(response.body.error, expectedError, label);
      if (expectedDetail) assert.ok(String(response.body.detail).includes(expectedDetail), `${label}: ${response.body.detail}`);
      const text = JSON.stringify(response.body);
      for (const secret of secrets) assert.ok(!text.includes(secret), `${label} leaks no value`);
    }
  };
  for (const name of ['RANKED_VERIFIER_PRIVATE_KEY', 'RANKED_RELAYER_PRIVATE_KEY', 'RANKED_SCORE_REGISTRY_ADDRESS', 'NEON_DATABASE_URL']) {
    const partial = { ...env };
    delete partial[name];
    // eslint-disable-next-line no-await-in-loop
    await probe(`missing ${name}`, partial, 'settlement-not-configured', name);
  }
  await probe('legacy name', { ...env, VERIFIER_PRIVATE_KEY: keys.verifier }, 'settlement-not-configured', 'legacy-env-present:VERIFIER_PRIVATE_KEY');
  await probe('legacy relayer', { ...env, RELAYER_PRIVATE_KEY: keys.relayer }, 'settlement-not-configured', 'legacy-env-present:RELAYER_PRIVATE_KEY');
  await probe('legacy registry', { ...env, SCORE_REGISTRY_ADDRESS: registry }, 'settlement-not-configured', 'legacy-env-present:SCORE_REGISTRY_ADDRESS');
  await probe('registry mismatch', { ...env, RANKED_SCORE_REGISTRY_ADDRESS: `0x${'99'.repeat(20)}` }, 'address-mismatch', 'RANKED_SCORE_REGISTRY_ADDRESS');
  assert.equal(expectations.length, 16);
  const noSecret = { ...env };
  delete noSecret.SESSION_SECRET;
  const secretless = await invoke(settleHandler(ctx, { envOverride: noSecret }), { method: 'POST', url: '/api/settle', headers: token, body });
  assert.deepEqual([secretless.status, secretless.body.error], [503, 'settlement-not-configured']);
  assert.ok(secretless.body.detail.includes('SESSION_SECRET'));

  // The verify and achievements modules must be present (fail closed until
  // the parallel slices merge).
  const noVerify = await post(settleHandler(ctx, { wrap: (deps) => ({ ...deps, verify: null }) }), body);
  assert.deepEqual([noVerify.status, noVerify.body.detail], [503, 'verify-unavailable']);
  const noCatalog = await post(settleHandler(ctx, { wrap: (deps) => ({ ...deps, catalog: null }) }), body);
  assert.deepEqual([noCatalog.status, noCatalog.body.detail], [503, 'achievements-unavailable']);
  assert.equal(ctx.verify.calls.bindRankedIdentity, 0);

  // With no environment at all, every settle endpoint fails closed without a throw.
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const bare = [
      [settleApi, { method: 'POST', url: '/api/settle', headers: { authorization: 'Bearer x' }, body: {} }, 503, 'settlement-not-configured'],
      [seedApi, { method: 'POST', url: '/api/ranked-seed', headers: { authorization: 'Bearer x' }, body: {} }, 503, 'settlement-not-configured'],
      [statusApi, { url: `/api/settle-status?sessionId32=${body.sessionId32}` }, 503, 'index-not-configured'],
      [nonceApi, { url: '/api/session-nonce' }, 503, 'session-not-configured'],
      [sessionApi, { method: 'POST', url: '/api/session', body: {} }, 503, 'session-not-configured'],
      [attestApi, { method: 'POST', url: '/api/attest' }, 410, 'endpoint-retired'],
    ];
    for (const [api, request, code, error] of bare) {
      // eslint-disable-next-line no-await-in-loop
      const response = await invoke(api.createHandler(() => api.buildDeps({})), request);
      assert.deepEqual([response.status, response.body.error], [code, error], request.url);
      assert.equal(response.headers['cache-control'], 'no-store');
    }
  } finally {
    console.error = original;
  }
  assert.deepEqual(logged, [], 'no handler threw or logged');
}));

test('every settle handler exposes the A30 seam and no other override hook', async () => {
  const modules = [
    [settleApi, 'settleRequest'], [statusApi, 'settleStatusRequest'], [seedApi, 'rankedSeedRequest'],
    [nonceApi, 'sessionNonceRequest'], [sessionApi, 'sessionRequest'], [attestApi, 'attestRequest'], [retryApi, 'settleRetryRequest'],
  ];
  for (const [api, pure] of modules) {
    assert.equal(typeof api.buildDeps, 'function', pure);
    assert.equal(typeof api.createHandler, 'function', pure);
    assert.equal(typeof api.default, 'function', pure);
    assert.equal(typeof api[pure], 'function', pure);
  }
  const deployment = local.deployment;
  const deps = await settleApi.buildDeps(env, { db: null, deployment, nowMs: 42, verify: 'x', catalog: 'x', relayer: 'x', chain: 'x', config: 'x' });
  for (const key of ['config', 'crypto', 'db', 'deployment', 'fetchImpl', 'nowMs', 'provider', 'verify', 'catalog', 'chain', 'relayer', 'heroGates']) assert.ok(Object.hasOwn(deps, key), key);
  assert.equal(deps.nowMs(), 42);
  assert.notEqual(deps.verify, 'x', 'overrides are exactly db, provider, deployment, nowMs, fetchImpl and crypto');
  assert.notEqual(deps.catalog, 'x');
  assert.notEqual(deps.chain, 'x');
  assert.equal(typeof deps.relayer, 'function', 'the relayer wallet is created only when a submission needs it');
  assert.equal(typeof deps.config.session.secret, 'function');
  const status = await statusApi.buildDeps({}, { db: null, deployment, nowMs: 42, catalog: 'x' });
  assert.notEqual(status.catalog, 'x');
  const seed = await seedApi.buildDeps({}, { db: null, deployment, nowMs: 42, issueSeedTicket: 'x', verify: 'x', catalog: 'x', heroGates: 'x' });
  assert.notEqual(seed.issueSeedTicket, 'x');
  for (const key of ['verify', 'catalog', 'heroGates']) assert.notEqual(seed[key], 'x', key);
  assert.equal(Object.hasOwn(seed, 'relayer'), false, 'E15 never builds a relayer');
  const cron = await retryApi.buildDeps(env, { db: null, deployment, nowMs: 42, verify: 'x', relayer: 'x' });
  assert.notEqual(cron.verify, 'x');
  assert.equal(typeof cron.relayer, 'function');
});
