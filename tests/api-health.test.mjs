import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';

import * as healthApi from '../api/health.mjs';
import { SITE_VERSION } from '../apps/portal/src/version-tracking.mjs';
import { SCORE_REGISTRY_ABI, WEEKLY_JACKPOT_ABI } from '../server/chain/abis.mjs';
import { casWeekStatus, ensureWeekRow, updateWeek } from '../server/jackpot/store.mjs';
import { weekIndexOfMs, weekKeyOfIndex } from '../server/jackpot/weeks.mjs';
import { MIGRATIONS, migrate } from '../server/neon/migrations.mjs';
import { recordCronRun } from '../server/ops/cron-runs.mjs';
import { collectHealth, HEALTH_CACHE_CONTROL, HEALTH_PARTS, SETTLE_GAS_ESTIMATE } from '../server/ops/health.mjs';
import { createPgliteClient, seedVerifiedSession } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { fixtureEnv, SETTLE_CRON_VALUE, SETTLE_SESSION_VALUE } from './helpers/settle-fixtures.mjs';
import { DEFAULT_MIN_PAID_WEI } from '../server/config.mjs';

/**
 * ops-health AC1: GET /api/health answers one public JSON report built only
 * from aggregate, non-secret facts: settlementReady as a boolean, the
 * relayer's public address, balance, allowance and estimated settles left,
 * the settle queue by status, the index lag, each cron's last outcome and the
 * base fee. Every read has a short deadline; a failed part is null with
 * degraded: true, never a 500. `ok` is the envelope flag; `healthy` is the
 * monitor boolean. It is edge-cached for 30 s and rejects any query
 * parameter. Handler tests start from an unmigrated PGlite (A34).
 */

const NOW = Date.parse('2026-09-24T18:00:00.000Z');
const RELAYER = '0x494af36ea4958c417260faf3efb3b672b343eaf6';
const REGISTRY = '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55';
const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 54207405, relayer: RELAYER, settlementGasReserveWei: '2000000000000000',
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: REGISTRY,
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
});
const RPC_WITH_KEY = 'https://liteforge.rpc.example/v1/rk9-health-secret-key';
const NEON_PASSWORD = `npg_health_${'Zq7'.repeat(3)}`;
const registryIface = new ethers.Interface(SCORE_REGISTRY_ABI);
const BODY_KEYS = ['ok', 'healthy', 'version', 'checkedAt', 'settlementReady', 'paused', 'settleMinPaidWei', 'degraded', 'degradedParts', 'relayer', 'queue', 'index', 'crons', 'baseFeeGwei', 'jackpot'];
const NO_JACKPOT = Object.freeze({ configured: false, keeperAddress: null, keeperBalanceWei: null, paused: { env: false, onChain: null }, uiHidden: false, awaitingAdmin: 0, awaitingAdminOldestHours: null, claimPending: 0, failed: 0 });
const ONE_ZKLTC = 10n ** 18n;
const BASE_FEE = 1_500_000_000n; // 1.5 gwei

function fakeProvider({ head = 54_230_000, baseFee = BASE_FEE, balance = ONE_ZKLTC, allowed = true, fail = [], hang = [] } = {}) {
  const calls = [];
  const gate = (name, run) => {
    calls.push(name);
    if (hang.includes(name)) return new Promise(() => {});
    if (fail.includes(name)) return Promise.reject(Object.assign(new Error(`request failed ${RPC_WITH_KEY}`), { code: 'SERVER_ERROR' }));
    return Promise.resolve().then(run);
  };
  return {
    calls,
    getBlock: (tag) => gate('getBlock', () => ({ number: tag === 'latest' ? head : Number(tag), timestamp: NOW / 1000, baseFeePerGas: baseFee })),
    getBalance: (address) => gate('getBalance', () => { calls.push(`balance:${String(address).toLowerCase()}`); return balance; }),
    call: ({ to, data }) => gate('call', () => {
      const [address] = registryIface.decodeFunctionData('relayers', data);
      calls.push(`relayers:${String(to).toLowerCase()}:${String(address).toLowerCase()}`);
      return registryIface.encodeFunctionResult('relayers', [allowed]);
    }),
  };
}

function envFor(extra = {}) {
  return fixtureEnv({ registry: REGISTRY, extra: { RPC_URL: RPC_WITH_KEY, ...extra } });
}

function handlerFor({ db, provider = fakeProvider(), env = envFor(), deployment = DEPLOYED, nowMs = NOW }) {
  return healthApi.createHandler(() => healthApi.buildDeps(env, { db, provider, deployment, nowMs }));
}

async function withDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

const minutesAgo = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const WEEK_MINUTES = 7 * 24 * 60;

test('health reports the relayer, queue, index lag, crons and base fee as aggregate facts', async () => withDb(async (db) => {
  const wallet = `0x${'c4'.repeat(20)}`;
  await seedVerifiedSession(db, { wallet, status: 'pending', verifiedAt: minutesAgo(12) });
  await seedVerifiedSession(db, { wallet, status: 'signed', verifiedAt: minutesAgo(3) });
  await seedVerifiedSession(db, { wallet, status: 'submitted', verifiedAt: minutesAgo(2) });
  // Unequal counts, so swapping the retrying and dead-letter filters, or
  // counting a dead letter twice, changes the answer: 2 retrying, 3 dead of
  // which 2 can still be requeued (verified within 7 days).
  await seedVerifiedSession(db, { wallet, status: 'failed', verifiedAt: minutesAgo(5), attempts: 1, lastError: 'rpc-timeout', nextAttemptAt: NOW + 60_000 });
  await seedVerifiedSession(db, { wallet, status: 'failed', verifiedAt: minutesAgo(7), attempts: 0, lastError: 'relayer-underfunded', nextAttemptAt: NOW - 30_000 });
  await seedVerifiedSession(db, { wallet, status: 'failed', verifiedAt: minutesAgo(600), attempts: 3, lastError: 'session-not-paid', nextAttemptAt: null });
  await seedVerifiedSession(db, { wallet, status: 'failed', verifiedAt: minutesAgo(WEEK_MINUTES - 1), attempts: 3, lastError: 'session-not-paid', nextAttemptAt: null });
  await seedVerifiedSession(db, { wallet, status: 'failed', verifiedAt: minutesAgo(WEEK_MINUTES + 1), attempts: 0, lastError: 'stale', nextAttemptAt: null });
  await seedVerifiedSession(db, { wallet, status: 'confirmed', verifiedAt: minutesAgo(900) });
  await seedVerifiedSession(db, { wallet, status: 'confirmed', source: 'chain-index', verifiedAt: minutesAgo(30) });
  await db.query("INSERT INTO indexer_state (stream, last_block) VALUES ('litvm-4441', 54229000)");
  await recordCronRun(db, { name: 'index-chain', ok: true, nowMs: NOW - 120_000 });
  await recordCronRun(db, { name: 'settle-retry', ok: true, nowMs: NOW - 180_000 });
  await recordCronRun(db, { name: 'settle-retry', ok: false, code: 'Error:57P01', nowMs: NOW - 60_000 });

  const provider = fakeProvider();
  const response = await invoke(handlerFor({ db, provider }), { url: '/api/health' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.headers['cache-control'], HEALTH_CACHE_CONTROL);
  assert.equal(HEALTH_CACHE_CONTROL, 'public, s-maxage=30, stale-while-revalidate=60');
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(Object.keys(response.body), BODY_KEYS);
  const expectedLeft = Number(ONE_ZKLTC / (SETTLE_GAS_ESTIMATE * BASE_FEE));
  assert.equal(expectedLeft, 1403, '1 zkLTC / (475k gas x 1.5 gwei), rounded down');
  assert.deepEqual(response.body, {
    ok: true,
    healthy: true,
    version: SITE_VERSION,
    checkedAt: '2026-09-24T18:00:00.000Z',
    settlementReady: true,
    paused: false,
    settleMinPaidWei: DEFAULT_MIN_PAID_WEI,
    degraded: false,
    degradedParts: [],
    relayer: { address: RELAYER, balanceWei: ONE_ZKLTC.toString(), allowed: true, estimatedSettlesLeft: expectedLeft },
    queue: { pending: 1, signed: 1, submitted: 1, failed: 2, dead: 3, deadRequeueable: 2, oldestUnconfirmedAgeSeconds: 720 },
    index: { cursorBlock: 54_229_000, headBlock: 54_230_000, lagBlocks: 1000 },
    crons: {
      indexChain: { lastOkAt: '2026-09-24T17:58:00.000Z', lastErrorAt: null, lastErrorCode: null, runs: 1, failures: 0 },
      settleRetry: { lastOkAt: '2026-09-24T17:57:00.000Z', lastErrorAt: '2026-09-24T17:59:00.000Z', lastErrorCode: 'Error:57P01', runs: 2, failures: 1 },
      weeklyJackpot: { lastOkAt: null, lastErrorAt: null, lastErrorCode: null, runs: 0, failures: 0 },
    },
    baseFeeGwei: 1.5,
    jackpot: NO_JACKPOT,
  });
  assert.ok(provider.calls.includes(`balance:${RELAYER}`), 'the balance is the deployment relayer\'s');
  assert.ok(provider.calls.includes(`relayers:${REGISTRY}:${RELAYER}`), 'the allowance is ScoreSubmissionRegistry.relayers(relayer)');
}));

test('the report never carries a secret, an env name or the missing list', async () => withDb(async (db) => {
  const neonUrl = `postgresql://owner:${NEON_PASSWORD}@ep-health.neon.tech/neondb`;
  const secrets = [SETTLE_SESSION_VALUE, SETTLE_CRON_VALUE, NEON_PASSWORD, neonUrl, RPC_WITH_KEY, 'rk9-health-secret-key'];
  const env = envFor({ NEON_DATABASE_URL: neonUrl });
  const keys = [env.RANKED_VERIFIER_PRIVATE_KEY, env.RANKED_RELAYER_PRIVATE_KEY];
  for (const variant of [env, { ...env, RELAYER_PRIVATE_KEY: env.RANKED_RELAYER_PRIVATE_KEY }, { ...env, SESSION_SECRET: '' }]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await invoke(handlerFor({ db, env: variant }), { url: '/api/health' });
    assert.equal(response.status, 200);
    const text = JSON.stringify(response.body);
    for (const secret of [...secrets, ...keys, ...keys.map((key) => key.slice(2))]) assert.equal(text.includes(secret), false, 'no secret in the report');
    assert.doesNotMatch(text, /SESSION_SECRET|RANKED_|NEON_DATABASE_URL|RELAYER_PRIVATE_KEY|legacy-env|missing|postgres|rpc\.example/, 'no env name or missing list');
  }
  const legacy = await invoke(handlerFor({ db, env: { ...env, RELAYER_PRIVATE_KEY: env.RANKED_RELAYER_PRIVATE_KEY } }), { url: '/api/health' });
  assert.equal(legacy.body.settlementReady, false, 'settlementReady is a boolean only');
  assert.equal(legacy.body.healthy, false, 'unconfigured settlement is not healthy');
  const paused = await invoke(handlerFor({ db, env: { ...env, SETTLEMENT_PAUSED: 'true' } }), { url: '/api/health' });
  assert.deepEqual([paused.body.settlementReady, paused.body.paused, paused.body.healthy], [true, true, false]);
  // The settle floor is a public setting (the J17 check compares it with the chain quote): the configured
  // value, the default when unset or malformed, never the env name.
  const floor = await invoke(handlerFor({ db, env: { ...env, RANKED_MIN_PAID_WEI: '100000000000000000' } }), { url: '/api/health' });
  assert.equal(floor.body.settleMinPaidWei, '100000000000000000');
  const malformed = await invoke(handlerFor({ db, env: { ...env, RANKED_MIN_PAID_WEI: '0.1' } }), { url: '/api/health' });
  assert.equal(malformed.body.settleMinPaidWei, DEFAULT_MIN_PAID_WEI);
  assert.doesNotMatch(JSON.stringify(floor.body), /RANKED_MIN_PAID_WEI/);
}));

test('the first request migrates an unmigrated or a version-1 database (A34)', async () => {
  await withDb(async (db) => {
    const response = await invoke(handlerFor({ db }), { url: '/api/health' });
    assert.equal(response.status, 200);
    assert.deepEqual([response.body.degraded, response.body.queue.pending, response.body.queue.oldestUnconfirmedAgeSeconds, response.body.index.cursorBlock, response.body.index.lagBlocks], [false, 0, null, null, null], 'an empty queue and no cursor are facts, not failures');
    assert.deepEqual(response.body.crons.indexChain, { lastOkAt: null, lastErrorAt: null, lastErrorCode: null, runs: 0, failures: 0 });
    assert.deepEqual((await db.query('SELECT version::int AS v FROM schema_migrations ORDER BY 1')).map((row) => row.v), [1, 2, 3]);
  });
  await withDb(async (db) => {
    for (const statement of MIGRATIONS[0].statements) await db.query(statement);
    await db.query("INSERT INTO schema_migrations (version, name) VALUES (1, '0001_ranked_index')");
    const response = await invoke(handlerFor({ db }), { url: '/api/health' });
    assert.deepEqual([response.status, response.body.degraded], [200, false]);
    assert.equal((await db.query("SELECT to_regclass('public.cron_runs') IS NOT NULL AS present"))[0].present, true, 'migration 2 was applied');
  });
});

test('failed reads are null with degraded parts, never a 500', async () => withDb(async (db) => {
  const failure = Object.assign(new Error(`neon 500 postgresql://owner:${NEON_PASSWORD}@ep/neondb`), { code: '57P01' });
  const broken = { schemaKey: `broken:${db.schemaKey}`, query: () => Promise.reject(failure) };
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  let response;
  try {
    response = await invoke(handlerFor({ db: broken, provider: fakeProvider({ fail: ['getBlock', 'getBalance', 'call'] }) }), { url: '/api/health' });
  } finally {
    console.error = original;
  }
  assert.equal(response.status, 200);
  assert.deepEqual(logged, [], 'a degraded part is not an internal error');
  assert.deepEqual([response.body.ok, response.body.degraded, response.body.healthy], [true, true, false], 'still a 200 report, but not healthy');
  assert.deepEqual(response.body.degradedParts, ['queue', 'index-cursor', 'crons', 'chain-head', 'relayer-balance', 'relayer-allowed', 'jackpot']);
  assert.deepEqual(response.body.relayer, { address: RELAYER, balanceWei: null, allowed: null, estimatedSettlesLeft: null });
  assert.deepEqual(response.body.queue, { pending: null, signed: null, submitted: null, failed: null, dead: null, deadRequeueable: null, oldestUnconfirmedAgeSeconds: null });
  assert.deepEqual(response.body.index, { cursorBlock: null, headBlock: null, lagBlocks: null });
  assert.deepEqual(response.body.crons.settleRetry, { lastOkAt: null, lastErrorAt: null, lastErrorCode: null, runs: null, failures: null });
  assert.equal(response.body.baseFeeGwei, null);
  assert.equal(response.body.jackpot, null, 'a failed jackpot read is null, never a guess');
  assert.doesNotMatch(JSON.stringify(response.body), /hunter2|postgres|npg_|rpc\.example/);

  // One failing read keeps every other field.
  const partial = await invoke(handlerFor({ db, provider: fakeProvider({ fail: ['getBalance'] }) }), { url: '/api/health' });
  assert.deepEqual([partial.body.degradedParts, partial.body.healthy], [['relayer-balance'], false]);
  assert.deepEqual(partial.body.relayer, { address: RELAYER, balanceWei: null, allowed: true, estimatedSettlesLeft: null });
  assert.equal(partial.body.baseFeeGwei, 1.5);
  assert.equal(partial.body.queue.pending, 0);
}));

test('reads that hang are cut off at their deadline', async () => withDb(async (db) => {
  const hanging = { schemaKey: `hanging:${db.schemaKey}`, query: () => new Promise(() => {}) };
  const deps = await healthApi.buildDeps(envFor(), { db: hanging, provider: fakeProvider({ hang: ['getBlock', 'getBalance', 'call'] }), deployment: DEPLOYED, nowMs: NOW });
  const started = Date.now();
  const report = await collectHealth(deps, { dbTimeoutMs: 60, chainTimeoutMs: 60 });
  assert.ok(Date.now() - started < 2_000, 'the report does not wait for a hung read');
  assert.equal(report.degraded, true);
  assert.deepEqual(report.degradedParts, ['queue', 'index-cursor', 'crons', 'chain-head', 'relayer-balance', 'relayer-allowed', 'jackpot']);

  // A slow query after a fast schema check still meets the one database deadline.
  await migrate(db);
  let slowQueries = 0;
  const slow = { schemaKey: db.schemaKey, query: (sql, params) => (/FILTER \(WHERE status = 'pending'\)/.test(sql) ? (slowQueries += 1, new Promise(() => {})) : db.query(sql, params)) };
  const slowDeps = await healthApi.buildDeps(envFor(), { db: slow, provider: fakeProvider(), deployment: DEPLOYED, nowMs: NOW });
  const slowReport = await collectHealth(slowDeps, { dbTimeoutMs: 400, chainTimeoutMs: 400 });
  assert.ok(slowQueries >= 1);
  assert.deepEqual(slowReport.degradedParts, ['queue']);
  assert.equal(slowReport.crons.indexChain.runs, 0, 'the other database reads still answered');
}));

test('with no environment at all the report fails closed', async () => {
  const noEnv = await invoke(healthApi.createHandler(() => healthApi.buildDeps({}, { provider: fakeProvider({ fail: ['getBlock', 'getBalance', 'call'] }), deployment: DEPLOYED, nowMs: NOW })), { url: '/api/health' });
  assert.equal(noEnv.status, 200);
  assert.deepEqual([noEnv.body.ok, noEnv.body.healthy, noEnv.body.settlementReady, noEnv.body.paused, noEnv.body.degraded], [true, false, false, false, true], 'ok is the envelope flag; healthy is what a monitor reads');
  assert.deepEqual(noEnv.body.degradedParts, ['database', 'queue', 'index-cursor', 'crons', 'chain-head', 'relayer-balance', 'relayer-allowed', 'jackpot']);

  const undeployed = await invoke(healthApi.createHandler(() => healthApi.buildDeps({}, { provider: fakeProvider(), deployment: { ...DEPLOYED, status: 'predicted' }, nowMs: NOW })), { url: '/api/health' });
  assert.equal(undeployed.status, 200);
  assert.equal(undeployed.body.relayer.address, null, 'no relayer before the deployment');
  assert.deepEqual(undeployed.body.degradedParts, ['database', 'queue', 'index-cursor', 'crons', 'relayer-address', 'jackpot']);
  for (const part of undeployed.body.degradedParts) assert.ok(HEALTH_PARTS.includes(part), part);
  assert.equal(undeployed.body.index.headBlock, 54_230_000, 'the chain head is still read');

  const badRpc = await invoke(healthApi.createHandler(() => healthApi.buildDeps({ RPC_URL: 'not a url' }, { deployment: DEPLOYED, nowMs: NOW })), { url: '/api/health' });
  assert.equal(badRpc.status, 200, 'a provider that cannot be built is a degraded part');
  assert.equal(badRpc.body.index.headBlock, null);
  assert.deepEqual(badRpc.body.degradedParts, ['database', 'queue', 'index-cursor', 'crons', 'chain-head', 'relayer-balance', 'relayer-allowed', 'jackpot']);
  const nothing = await invoke(healthApi.createHandler(() => healthApi.buildDeps({ RPC_URL: 'not a url' }, { deployment: { ...DEPLOYED, status: 'unavailable' }, nowMs: NOW })), { url: '/api/health' });
  assert.deepEqual(nothing.body.degradedParts, ['database', 'queue', 'index-cursor', 'crons', 'chain-head', 'relayer-address', 'jackpot'], 'no relayer reads are expected without a relayer');
});

test('settles-left rounds down and a zero base fee gives no estimate', async () => withDb(async (db) => {
  const tight = await invoke(handlerFor({ db, provider: fakeProvider({ balance: (SETTLE_GAS_ESTIMATE * BASE_FEE * 49n) + (SETTLE_GAS_ESTIMATE * BASE_FEE) - 1n }) }), { url: '/api/health' });
  assert.deepEqual([tight.body.relayer.estimatedSettlesLeft, tight.body.healthy], [49, true], 'a low estimate is the owner page warning, not unhealthy');
  const free = await invoke(handlerFor({ db, provider: fakeProvider({ baseFee: 0n }) }), { url: '/api/health' });
  assert.deepEqual([free.body.relayer.estimatedSettlesLeft, free.body.baseFeeGwei, free.body.degraded, free.body.healthy], [null, 0, false, true]);
  const notAllowed = await invoke(handlerFor({ db, provider: fakeProvider({ allowed: false, head: 10 }) }), { url: '/api/health' });
  assert.deepEqual([notAllowed.body.relayer.allowed, notAllowed.body.degraded, notAllowed.body.healthy], [false, false, false]);
}));

test('an empty relayer is never healthy, with or without an estimate', async () => withDb(async (db) => {
  const short = await invoke(handlerFor({ db, provider: fakeProvider({ balance: (SETTLE_GAS_ESTIMATE * BASE_FEE) - 1n }) }), { url: '/api/health' });
  assert.deepEqual([short.body.relayer.estimatedSettlesLeft, short.body.degraded, short.body.healthy], [0, false, false]);
  const one = await invoke(handlerFor({ db, provider: fakeProvider({ balance: SETTLE_GAS_ESTIMATE * BASE_FEE }) }), { url: '/api/health' });
  assert.deepEqual([one.body.relayer.estimatedSettlesLeft, one.body.healthy], [1, true]);
  // A zero base fee gives no estimate; an empty balance still stops every priced send.
  const emptyFree = await invoke(handlerFor({ db, provider: fakeProvider({ baseFee: 0n, balance: 0n }) }), { url: '/api/health' });
  assert.deepEqual([emptyFree.body.relayer.estimatedSettlesLeft, emptyFree.body.relayer.balanceWei, emptyFree.body.degraded, emptyFree.body.healthy], [null, '0', false, false]);
}));

test('a head block with no base fee is a degraded chain-head read', async () => withDb(async (db) => {
  for (const baseFee of [null, undefined, -1n]) {
    const provider = fakeProvider();
    provider.getBlock = async () => ({ number: 54_230_000, timestamp: NOW / 1000, baseFeePerGas: baseFee });
    // eslint-disable-next-line no-await-in-loop
    const response = await invoke(handlerFor({ db, provider }), { url: '/api/health' });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.degradedParts, ['chain-head'], String(baseFee));
    assert.deepEqual([response.body.degraded, response.body.healthy, response.body.baseFeeGwei, response.body.relayer.estimatedSettlesLeft], [true, false, null, null]);
    assert.equal(response.body.index.headBlock, 54_230_000, 'the head block number is still reported');
    assert.equal(response.body.relayer.balanceWei, ONE_ZKLTC.toString());
  }
}));

test('unknown query parameters and other methods are rejected before any read', async () => {
  let touched = false;
  const db = { schemaKey: 'never-used', async query() { touched = true; return []; } };
  const provider = fakeProvider();
  for (const url of ['/api/health?cb=1', '/api/health?now=1&x=2', '/api/health?refresh']) {
    // eslint-disable-next-line no-await-in-loop
    const response = await invoke(handlerFor({ db, provider }), { url });
    assert.deepEqual([response.status, response.body], [400, { ok: false, error: 'invalid-query' }], url);
    assert.equal(response.headers['cache-control'], 'no-store', 'an error is never edge-cached');
  }
  for (const method of ['POST', 'PUT', 'DELETE']) {
    // eslint-disable-next-line no-await-in-loop
    const response = await invoke(handlerFor({ db, provider }), { method, url: '/api/health' });
    assert.deepEqual([response.status, response.headers.allow], [405, 'GET'], method);
  }
  assert.equal(touched, false);
  assert.deepEqual(provider.calls, []);
});

// jackpot-server (design §C.4 "Health and status page"): the weekly-jackpot
// cron, the keeper's balance, both pauses, the awaiting-admin backlog (with
// the oldest wait) and the claim-pending and failed weeks. The keeper's
// address is public; its key never appears.
const KEEPER_KEY = `0x${'5d'.repeat(32)}`;
const KEEPER = new ethers.Wallet(KEEPER_KEY).address.toLowerCase();
const JACKPOT = `0x${'ab12'.repeat(10)}`;
const jackpotIface = new ethers.Interface(WEEKLY_JACKPOT_ABI);
const TOKEN = Object.freeze({ address: `0x${'7e'.repeat(20)}`, symbol: 'tCHIKUN', decimals: 18, name: "Lester's Arcade Test CHIKUN (no value)", testnet: true });
const JACKPOT_DEPLOYMENT = Object.freeze({
  status: 'deployed', chainId: 4441,
  instances: Object.freeze({ chikun: Object.freeze({ address: JACKPOT, startBlock: 100, firstWeek: 2961, admin: `0x${'07'.repeat(20)}`, keeper: KEEPER, residualRecipient: `0x${'07'.repeat(20)}`, token: TOKEN, retired: Object.freeze([]) }) }),
});

function jackpotProvider({ keeperBalance = 4n * 10n ** 16n, onChainPaused = false, failPaused = false } = {}) {
  const provider = fakeProvider();
  const relayersCall = provider.call;
  provider.getBalance = async (address) => {
    provider.calls.push(`balance:${String(address).toLowerCase()}`);
    return String(address).toLowerCase() === KEEPER ? keeperBalance : ONE_ZKLTC;
  };
  provider.call = async (request) => {
    if (String(request.to).toLowerCase() !== JACKPOT) return relayersCall(request);
    const parsed = jackpotIface.parseTransaction({ data: request.data });
    provider.calls.push(`jackpot:${parsed.name}`);
    if (failPaused) throw Object.assign(new Error(`request failed ${RPC_WITH_KEY}`), { code: 'SERVER_ERROR' });
    return jackpotIface.encodeFunctionResult('paused', [onChainPaused]);
  };
  return provider;
}

test('health and status report the jackpot cron, keeper and pauses', async () => withDb(async (db) => {
  const env = envFor({ JACKPOT_KEEPER_PRIVATE_KEY: KEEPER_KEY, JACKPOT_CONTRACT_ADDRESS: JACKPOT, JACKPOT_PAUSED: 'true' });
  const jackpotHandler = (provider, extra = {}) => healthApi.createHandler(() => healthApi.buildDeps({ ...env, ...extra }, { db, provider, deployment: DEPLOYED, jackpotDeployment: JACKPOT_DEPLOYMENT, nowMs: NOW }));
  await migrate(db);
  const week = weekIndexOfMs(NOW);
  const statuses = [[week - 4, 'failed'], [week - 3, 'awaiting-admin', 50], [week - 2, 'awaiting-admin', 7], [week - 1, 'claim-pending'], [week - 5, 'paid']];
  for (const [index, status, waitedHours] of statuses) {
    await ensureWeekRow(db, { contract: JACKPOT, weekIndex: index, token: TOKEN });
    if (status === 'paid') continue;
    assert.equal(await casWeekStatus(db, { contract: JACKPOT, weekKey: weekKeyOfIndex(index), from: 'open', to: status }), true);
    if (waitedHours) await updateWeek(db, { contract: JACKPOT, weekKey: weekKeyOfIndex(index), set: { admin_waiting_since: new Date(NOW - (waitedHours * 3_600_000) - 60_000).toISOString() } });
  }
  await recordCronRun(db, { name: 'weekly-jackpot', ok: true, nowMs: NOW - 240_000 });
  await recordCronRun(db, { name: 'weekly-jackpot', ok: false, code: 'keeper-underfunded', nowMs: NOW - 60_000 });

  const provider = jackpotProvider({ onChainPaused: true });
  const response = await invoke(jackpotHandler(provider), { url: '/api/health' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.degradedParts, []);
  assert.equal(response.body.healthy, true, 'a paused jackpot is an owner-page warning, not an unhealthy settlement path');
  assert.deepEqual(response.body.crons.weeklyJackpot, { lastOkAt: '2026-09-24T17:56:00.000Z', lastErrorAt: '2026-09-24T17:59:00.000Z', lastErrorCode: 'keeper-underfunded', runs: 2, failures: 1 });
  assert.deepEqual(response.body.jackpot, {
    configured: true, keeperAddress: KEEPER, keeperBalanceWei: String(4n * 10n ** 16n), paused: { env: true, onChain: true }, uiHidden: false,
    awaitingAdmin: 2, awaitingAdminOldestHours: 50, claimPending: 1, failed: 1,
  });
  assert.ok(provider.calls.includes(`balance:${KEEPER}`), 'the balance is the keeper\'s');
  assert.ok(provider.calls.includes('jackpot:paused'), 'the on-chain pause is WeeklyJackpot.paused()');
  const text = JSON.stringify(response.body);
  assert.equal(text.includes(KEEPER_KEY.slice(2)), false, 'the keeper key never appears');
  assert.doesNotMatch(text, /JACKPOT_|rpc\.example/);

  // A failed jackpot chain read degrades only the jackpot part.
  const broken = await invoke(jackpotHandler(jackpotProvider({ failPaused: true }), { JACKPOT_PAUSED: '', JACKPOT_UI_HIDDEN: 'true' }), { url: '/api/health' });
  assert.deepEqual([broken.status, broken.body.degradedParts, broken.body.jackpot, broken.body.relayer.allowed], [200, ['jackpot'], null, true]);

  // Unconfigured, the jackpot reads nothing on chain and reports the backlog.
  const bare = jackpotProvider();
  const unconfigured = await invoke(healthApi.createHandler(() => healthApi.buildDeps(envFor(), { db, provider: bare, deployment: DEPLOYED, jackpotDeployment: JACKPOT_DEPLOYMENT, nowMs: NOW })), { url: '/api/health' });
  assert.deepEqual(unconfigured.body.jackpot, { ...NO_JACKPOT, awaitingAdmin: 2, awaitingAdminOldestHours: 50, claimPending: 1, failed: 1 });
  assert.equal(bare.calls.some((call) => call.startsWith('jackpot:') || call === `balance:${KEEPER}`), false);
}));
