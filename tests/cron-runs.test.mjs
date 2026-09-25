import assert from 'node:assert/strict';
import test from 'node:test';

import * as indexCronApi from '../api/cron/index-chain.mjs';
import * as retryCronApi from '../api/cron/settle-retry.mjs';
import { LATEST_SCHEMA_VERSION, MIGRATIONS, ensureSchema, migrate, readSchemaVersion } from '../server/neon/migrations.mjs';
import {
  CRON_ERROR_CODES, CRON_NAMES, allowlistedCronCode, cronOutcomeOf, readCronRuns, recordCronRun, thrownCronCode, withCronRun,
} from '../server/ops/cron-runs.mjs';
import { ERROR_CODE_ALLOWLIST } from '../server/settle/errors.mjs';
import { createPgliteClient, randomHex32 } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import { createCatalogDouble, createVerifyDouble, fixtureEnv, SETTLE_CRON_VALUE } from './helpers/settle-fixtures.mjs';

/**
 * ops-health AC2 and AC6: Neon migration 2 adds the cron_runs table, on a
 * fresh database and on the live version-1 schema, without touching any
 * version-1 row; the index-chain and settle-retry crons record every
 * authorized run's outcome with an allowlisted code (or an error name plus
 * SQLSTATE), never raw error text, and bookkeeping never changes a cron's
 * answer.
 */

const NOW = Date.parse('2026-09-24T18:00:00.000Z');
const SECRET_URL = 'postgresql://owner:hunter2-secret@ep-quiet-lake.neon.tech/neondb';
const CRON_COLUMNS = ['name', 'last_ok_at', 'last_error_at', 'last_error_code', 'runs', 'failures', 'updated_at'];

async function withDb(run) {
  const db = createPgliteClient();
  try {
    await run(db);
  } finally {
    await db.close();
  }
}

// The live production schema: migration 1 applied and recorded, nothing else.
async function applyVersionOne(db) {
  for (const statement of MIGRATIONS[0].statements) await db.query(statement);
  await db.query("INSERT INTO schema_migrations (version, name) VALUES (1, '0001_ranked_index')");
}

async function tableNames(db) {
  return (await db.query("SELECT table_name::text AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1")).map((row) => row.name);
}

async function cronRow(db, name) {
  const runs = await readCronRuns(db);
  return runs[name] ?? null;
}

test('migration 2 is the additive cron_runs table and a fresh database gets both versions', async () => withDb(async (db) => {
  assert.equal(LATEST_SCHEMA_VERSION, 2);
  assert.deepEqual(MIGRATIONS.map((migration) => [migration.version, migration.name]), [[1, '0001_ranked_index'], [2, '0002_cron_runs']]);
  const second = MIGRATIONS[1].statements;
  assert.equal(second.length, 1);
  assert.match(second[0], /^CREATE TABLE IF NOT EXISTS cron_runs \(/, 'additive and idempotent');
  for (const statement of second) assert.doesNotMatch(statement, /\b(ALTER|DROP|UPDATE|DELETE|TRUNCATE|RENAME)\b/i, 'migration 2 never changes a version-1 object');

  assert.deepEqual(await migrate(db), { version: 2, applied: [1, 2] });
  const columns = (await db.query("SELECT column_name::text AS name FROM information_schema.columns WHERE table_name = 'cron_runs' ORDER BY ordinal_position")).map((row) => row.name);
  assert.deepEqual(columns, CRON_COLUMNS);
  const types = Object.fromEntries((await db.query("SELECT column_name::text AS name, data_type::text AS type FROM information_schema.columns WHERE table_name = 'cron_runs'")).map((row) => [row.name, row.type]));
  assert.deepEqual([types.name, types.last_ok_at, types.last_error_code, types.runs, types.failures], ['text', 'timestamp with time zone', 'text', 'integer', 'integer']);
  // The CHECKs keep names and codes to a safe shape: no free text can be stored.
  await assert.rejects(db.query("INSERT INTO cron_runs (name) VALUES ('Index Chain')"), (error) => error.code === '23514');
  await assert.rejects(db.query("INSERT INTO cron_runs (name, last_error_code) VALUES ('index-chain', $1)", [`boom ${SECRET_URL}`]), (error) => error.code === '23514');
  await assert.rejects(db.query("INSERT INTO cron_runs (name, runs) VALUES ('index-chain', -1)"), (error) => error.code === '23514');
  assert.deepEqual(await migrate(db), { version: 2, applied: [] }, 'applying twice is a no-op');
}));

test('migration 2 upgrades the live version-1 database without touching its rows', async () => withDb(async (db) => {
  await applyVersionOne(db);
  assert.equal(await readSchemaVersion(db), 1);
  const sessionId32 = randomHex32();
  await db.query(
    `INSERT INTO verified_sessions (session_id32, wallet, game_id, season_id, runtime_id, score, envelope_hash, day_key, week_key, month_key, status, attempts, last_error, next_attempt_at)
     VALUES ($1, $2, 'chikun', 'chikun-s1', 'chikun-runtime', 4200, $3, '2026-09-24', '2026-W39', '2026-09', 'failed', 2, 'rpc-timeout', $4::timestamptz)`,
    [sessionId32, `0x${'ab'.repeat(20)}`, randomHex32(), new Date(NOW).toISOString()],
  );
  await db.query("INSERT INTO indexer_state (stream, last_block) VALUES ('litvm-4441', 54210000)");
  await db.query("INSERT INTO relayer_lease (relayer, next_nonce) VALUES ($1, 7)", [`0x${'49'.repeat(20)}`]);
  const before = await db.query('SELECT session_id32, status, attempts, last_error, score::text AS score FROM verified_sessions');
  const tablesBefore = await tableNames(db);

  assert.deepEqual(await migrate(db), { version: 2, applied: [2] }, 'only migration 2 runs on a version-1 database');
  assert.deepEqual(await db.query('SELECT session_id32, status, attempts, last_error, score::text AS score FROM verified_sessions'), before, 'queue rows are untouched');
  assert.deepEqual(await db.query("SELECT last_block::text AS last_block FROM indexer_state"), [{ last_block: '54210000' }]);
  assert.deepEqual(await db.query('SELECT next_nonce::text AS next_nonce FROM relayer_lease'), [{ next_nonce: '7' }]);
  assert.deepEqual(await tableNames(db), [...tablesBefore, 'cron_runs'].sort(), 'exactly one table is added');
  assert.deepEqual(await readCronRuns(db), {}, 'no run is recorded yet');
  assert.deepEqual((await db.query('SELECT version::int AS v FROM schema_migrations ORDER BY 1')).map((row) => row.v), [1, 2]);
}));

test('the first request on a version-1 database migrates it through ensureSchema, race-safe', async () => withDb(async (db) => {
  await applyVersionOne(db);
  // A concurrent cold start creates cron_runs first; this process loses the
  // catalog race and retries the version once (A34).
  let raced = false;
  const racing = {
    schemaKey: db.schemaKey,
    async query(sql, params) {
      if (!raced && sql.includes('CREATE TABLE IF NOT EXISTS cron_runs')) {
        raced = true;
        await db.query(sql, params);
        throw Object.assign(new Error('relation "cron_runs" already exists'), { code: '42P07' });
      }
      return db.query(sql, params);
    },
  };
  assert.equal(await ensureSchema(racing), 2);
  assert.equal(raced, true);
  assert.ok((await tableNames(db)).includes('cron_runs'));
  assert.equal(await ensureSchema(racing), 2, 'memoized');
}));

test('recordCronRun counts runs and failures and keeps the latest times and code', async () => withDb(async (db) => {
  await recordCronRun(db, { name: 'index-chain', ok: true, nowMs: NOW });
  await recordCronRun(db, { name: 'index-chain', ok: false, code: 'chain-read-failed', nowMs: NOW + 60_000 });
  let row = await cronRow(db, 'index-chain');
  assert.deepEqual(row, { lastOkAt: '2026-09-24T18:00:00.000Z', lastErrorAt: '2026-09-24T18:01:00.000Z', lastErrorCode: 'chain-read-failed', runs: 2, failures: 1 });
  // An older run that finishes late never moves a time or code backwards.
  await recordCronRun(db, { name: 'index-chain', ok: false, code: 'Error:57P01', nowMs: NOW - 60_000 });
  await recordCronRun(db, { name: 'index-chain', ok: true, nowMs: NOW - 120_000 });
  row = await cronRow(db, 'index-chain');
  assert.deepEqual(row, { lastOkAt: '2026-09-24T18:00:00.000Z', lastErrorAt: '2026-09-24T18:01:00.000Z', lastErrorCode: 'chain-read-failed', runs: 4, failures: 2 });
  await recordCronRun(db, { name: 'index-chain', ok: true, nowMs: NOW + 120_000 });
  assert.equal((await cronRow(db, 'index-chain')).lastOkAt, '2026-09-24T18:02:00.000Z');
  // A code that is not safe text is stored as unknown-error, never verbatim.
  await recordCronRun(db, { name: 'settle-retry', ok: false, code: `boom ${SECRET_URL}`, nowMs: NOW });
  assert.deepEqual(await cronRow(db, 'settle-retry'), { lastOkAt: null, lastErrorAt: '2026-09-24T18:00:00.000Z', lastErrorCode: 'unknown-error', runs: 1, failures: 1 });
  await assert.rejects(recordCronRun(db, { name: 'Bad Name', ok: true, nowMs: NOW }), TypeError);
  assert.deepEqual(Object.keys(await readCronRuns(db)), ['index-chain', 'settle-retry']);
}));

test('cron outcome codes are allowlisted, or an error name plus SQLSTATE', () => {
  for (const code of ERROR_CODE_ALLOWLIST) assert.ok(CRON_ERROR_CODES.includes(code), code);
  assert.deepEqual(cronOutcomeOf({ status: 200, body: { ok: true, processed: [] } }), { record: true, ok: true, code: null });
  assert.deepEqual(cronOutcomeOf({ status: 200, body: { ok: true, skipped: 'not-deployed' } }), { record: true, ok: true, code: null });
  assert.deepEqual(cronOutcomeOf({ status: 502, body: { ok: false, error: 'chain-read-failed', retryable: true } }), { record: true, ok: false, code: 'chain-read-failed' });
  assert.deepEqual(cronOutcomeOf({ status: 503, body: { ok: false, error: 'settlement-not-configured', detail: 'SESSION_SECRET,RANKED_RELAYER_PRIVATE_KEY' } }), { record: true, ok: false, code: 'settlement-not-configured' }, 'env names in the detail are never stored');
  assert.deepEqual(cronOutcomeOf({ status: 503, body: { ok: false, error: 'settlement-not-configured', detail: 'verify-unavailable' } }), { record: true, ok: false, code: 'verify-unavailable' });
  assert.deepEqual(cronOutcomeOf({ status: 503, body: { ok: false, error: 'address-mismatch' } }), { record: true, ok: false, code: 'address-mismatch' });
  assert.deepEqual(cronOutcomeOf({ status: 503, body: { ok: false, error: 'settlement-paused' } }).record, false, 'a paused run is not recorded (A27)');
  assert.deepEqual(cronOutcomeOf({ status: 500, body: { ok: false, error: `boom ${SECRET_URL}` } }).code, 'unknown-error');
  assert.deepEqual(cronOutcomeOf(undefined), { record: true, ok: false, code: 'unknown-error' });
  assert.equal(allowlistedCronCode('relayer-underfunded'), 'relayer-underfunded');
  assert.equal(allowlistedCronCode('relayer underfunded'), 'unknown-error');
  assert.equal(thrownCronCode(Object.assign(new Error(`neon 500 ${SECRET_URL}`), { code: '57P01' })), 'Error:57P01');
  assert.equal(thrownCronCode(Object.assign(new Error('x'), { name: 'NeonDbError', code: '40001' })), 'NeonDbError:40001');
  assert.equal(thrownCronCode(Object.assign(new TypeError('x'), { code: 'ERR_INVALID_ARG_TYPE' })), 'TypeError');
  assert.equal(thrownCronCode(Object.assign(new Error('x'), { name: SECRET_URL })), 'Error');
  assert.equal(thrownCronCode(Object.assign(new Error('x'), { name: '$internal' })), 'Error');
  assert.equal(thrownCronCode('a thrown string'), 'Error');
});

test('withCronRun records a throw and re-throws it, and a failed write never changes the answer', async () => withDb(async (db) => {
  const deps = { db, nowMs: () => NOW };
  const failure = Object.assign(new Error(`connect ${SECRET_URL}`), { code: '08006' });
  await assert.rejects(withCronRun('index-chain', deps, async () => { throw failure; }), (error) => error === failure);
  assert.deepEqual(await cronRow(db, 'index-chain'), { lastOkAt: null, lastErrorAt: '2026-09-24T18:00:00.000Z', lastErrorCode: 'Error:08006', runs: 1, failures: 1 });

  const warned = [];
  const logger = { warn: (...args) => warned.push(args) };
  const broken = { schemaKey: `${db.schemaKey}:broken`, async query(sql, params) { if (/cron_runs/.test(sql)) throw Object.assign(new Error(`write failed ${SECRET_URL}`), { code: '53300' }); return db.query(sql, params); } };
  const answer = { status: 200, body: { ok: true, processed: [] }, headers: { 'Cache-Control': 'no-store' } };
  assert.equal(await withCronRun('settle-retry', { db: broken, nowMs: () => NOW }, async () => answer, { logger }), answer);
  assert.deepEqual(warned, [['[cron/settle-retry] run-record-failed', { name: 'Error', code: '53300', sqlstate: '53300' }]]);
  assert.doesNotMatch(JSON.stringify(warned), /hunter2|postgresql|write failed/);
  assert.equal(await withCronRun('settle-retry', { db: null, nowMs: () => NOW }, async () => answer), answer, 'no database: nothing to record');
}));

// --- The real cron handlers --------------------------------------------------

const DEPLOYED = Object.freeze({
  status: 'deployed', chainId: 4441, startBlock: 1,
  addresses: Object.freeze({
    gameRegistry: '0xcb0b695ebee650afcce93f566259cb477b19bf23', playerProfileRegistry: '0x3eb9e9f2620940496a2b8ed6f7384e6687587c94',
    arcadeRankedEntry: '0x10cd09e694e2b2cd70d37f8cdddcda3ef1208190', scoreSubmissionRegistry: '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55',
    achievementRegistries: Object.freeze({ 'lester-blaster': '0xc1a383cb7521978f429424443fdd69bdd71ff737', chikun: '0xf6cd1cf7e1accaea93accdfb911034b3e8eb6f93', stacked: '0x5430f8c142ca7ec8971a447cc09ae63f8860a8a7' }),
  }),
  settlementGasReserveWei: '2000000000000000',
});
const INDEX_ENV = { VERCEL_ENV: 'development', CRON_SECRET: SETTLE_CRON_VALUE, RANKED_SCORE_REGISTRY_ADDRESS: DEPLOYED.addresses.scoreSubmissionRegistry };
const AUTH = { authorization: `Bearer ${SETTLE_CRON_VALUE}` };

function quietChain({ head = 20, fail = false } = {}) {
  return {
    async getLogs() { if (fail) throw new Error('could not coalesce error (https://rpc.example/secret-key)'); return []; },
    async getBlock(tag) { const number = tag === 'latest' ? head : Number(tag); return { number, timestamp: 1_790_000_000 + number }; },
    async call() { throw new Error('no calls expected'); },
  };
}

function indexHandler({ db, env = INDEX_ENV, chain = quietChain(), clock = () => NOW }) {
  return indexCronApi.createHandler(() => indexCronApi.buildDeps(env, { db, deployment: DEPLOYED, provider: chain, nowMs: clock }));
}

test('the index-chain cron records its ok, error and thrown runs, and 401s record nothing', async () => withDb(async (db) => {
  let clockMs = NOW;
  const clock = () => clockMs;
  const denied = await invoke(indexHandler({ db, clock }), { url: '/api/cron/index-chain', headers: { authorization: 'Bearer wrong' } });
  assert.equal(denied.status, 401);
  assert.deepEqual(await tableNames(db), [], 'an unauthorized call touches nothing');

  const ok = await invoke(indexHandler({ db, clock }), { url: '/api/cron/index-chain', headers: AUTH });
  assert.deepEqual([ok.status, ok.body.ok, ok.body.schemaVersion], [200, true, 2]);
  assert.deepEqual(await cronRow(db, CRON_NAMES.indexChain), { lastOkAt: '2026-09-24T18:00:00.000Z', lastErrorAt: null, lastErrorCode: null, runs: 1, failures: 0 });

  clockMs = NOW + 300_000;
  const chainDown = await invoke(indexHandler({ db, clock, chain: quietChain({ head: 40, fail: true }) }), { url: '/api/cron/index-chain', headers: AUTH });
  assert.deepEqual([chainDown.status, chainDown.body.error], [502, 'chain-read-failed']);
  assert.deepEqual(await cronRow(db, CRON_NAMES.indexChain), { lastOkAt: '2026-09-24T18:00:00.000Z', lastErrorAt: '2026-09-24T18:05:00.000Z', lastErrorCode: 'chain-read-failed', runs: 2, failures: 1 });

  clockMs = NOW + 600_000;
  const mismatch = await invoke(indexHandler({ db, clock, env: { ...INDEX_ENV, RANKED_SCORE_REGISTRY_ADDRESS: `0x${'9f'.repeat(20)}` } }), { url: '/api/cron/index-chain', headers: AUTH });
  assert.deepEqual([mismatch.status, mismatch.body.error], [503, 'address-mismatch']);
  assert.equal((await cronRow(db, CRON_NAMES.indexChain)).lastErrorCode, 'address-mismatch');

  clockMs = NOW + 900_000;
  const failing = { schemaKey: db.schemaKey, query: (sql, params) => (/FROM indexer_state WHERE stream/.test(sql) ? Promise.reject(Object.assign(new Error(`read failed ${SECRET_URL}`), { name: 'NeonDbError', code: '57P01' })) : db.query(sql, params)) };
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  let thrown;
  try {
    thrown = await invoke(indexHandler({ db: failing, clock }), { url: '/api/cron/index-chain', headers: AUTH });
  } finally {
    console.error = original;
  }
  assert.deepEqual([thrown.status, thrown.body], [500, { ok: false, error: 'internal-error' }]);
  assert.deepEqual(logged, [['[cron/index-chain] internal-error', { name: 'NeonDbError', code: '57P01', sqlstate: '57P01' }]]);
  assert.deepEqual(await cronRow(db, CRON_NAMES.indexChain), { lastOkAt: '2026-09-24T18:00:00.000Z', lastErrorAt: '2026-09-24T18:15:00.000Z', lastErrorCode: 'NeonDbError:57P01', runs: 4, failures: 3 });

  clockMs = NOW + 1_200_000;
  assert.equal((await invoke(indexHandler({ db, clock }), { url: '/api/cron/index-chain', headers: AUTH })).status, 200);
  const recovered = await cronRow(db, CRON_NAMES.indexChain);
  assert.deepEqual([recovered.lastOkAt, recovered.runs, recovered.failures], ['2026-09-24T18:20:00.000Z', 5, 3], 'the last ok is newer than the last error again');
}));

function retryHandler({ db, env = fixtureEnv({ registry: DEPLOYED.addresses.scoreSubmissionRegistry }), listFails = null }) {
  return retryCronApi.createHandler(async () => {
    const deps = await retryCronApi.buildDeps(env, { db: listFails ? { schemaKey: db.schemaKey, query: (sql, params) => (/priority/.test(sql) ? Promise.reject(listFails) : db.query(sql, params)) } : db, deployment: DEPLOYED, nowMs: NOW });
    deps.verify = createVerifyDouble({ nowMs: () => NOW });
    deps.catalog = createCatalogDouble();
    deps.relayer = { async submit() { throw new Error('no rows expected'); }, async checkReceipt() { throw new Error('no rows expected'); } };
    return deps;
  });
}

test('the settle-retry cron records its runs, but a paused run touches nothing', async () => withDb(async (db) => {
  const env = fixtureEnv({ registry: DEPLOYED.addresses.scoreSubmissionRegistry });
  const paused = await invoke(retryHandler({ db, env: { ...env, SETTLEMENT_PAUSED: 'true' } }), { url: '/api/cron/settle-retry', headers: AUTH });
  assert.deepEqual([paused.status, paused.body.error], [503, 'settlement-paused']);
  assert.deepEqual(await tableNames(db), [], 'paused: no migration, no bookkeeping, no row (A27)');

  const denied = await invoke(retryHandler({ db }), { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}x` } });
  assert.equal(denied.status, 401);
  assert.deepEqual(await tableNames(db), []);

  const ok = await invoke(retryHandler({ db }), { url: '/api/cron/settle-retry', headers: AUTH });
  assert.deepEqual([ok.status, ok.body], [200, { ok: true, processed: [] }]);
  assert.deepEqual(await cronRow(db, CRON_NAMES.settleRetry), { lastOkAt: '2026-09-24T18:00:00.000Z', lastErrorAt: null, lastErrorCode: null, runs: 1, failures: 0 });

  const legacy = await invoke(retryHandler({ db, env: { ...env, RELAYER_PRIVATE_KEY: `0x${'12'.repeat(32)}` } }), { url: '/api/cron/settle-retry', headers: AUTH });
  assert.deepEqual([legacy.status, legacy.body.error], [503, 'settlement-not-configured']);
  assert.deepEqual(await cronRow(db, CRON_NAMES.settleRetry), { lastOkAt: '2026-09-24T18:00:00.000Z', lastErrorAt: '2026-09-24T18:00:00.000Z', lastErrorCode: 'settlement-not-configured', runs: 2, failures: 1 });

  const pausedAgain = await invoke(retryHandler({ db, env: { ...env, SETTLEMENT_PAUSED: 'true' } }), { url: '/api/cron/settle-retry', headers: AUTH });
  assert.equal(pausedAgain.status, 503);
  assert.equal((await cronRow(db, CRON_NAMES.settleRetry)).runs, 2, 'a paused run is not counted');

  const original = console.error;
  console.error = () => {};
  let thrown;
  try {
    thrown = await invoke(retryHandler({ db, listFails: Object.assign(new Error(`timeout ${SECRET_URL}`), { code: '57014' }) }), { url: '/api/cron/settle-retry', headers: AUTH });
  } finally {
    console.error = original;
  }
  assert.equal(thrown.status, 500);
  const row = await cronRow(db, CRON_NAMES.settleRetry);
  assert.deepEqual([row.lastErrorCode, row.runs, row.failures], ['Error:57014', 3, 2]);
  const stored = JSON.stringify(await db.query('SELECT * FROM cron_runs'));
  assert.doesNotMatch(stored, /hunter2|postgresql|timeout|SESSION_SECRET|RELAYER/, 'no raw error text or env name is stored');
}));
