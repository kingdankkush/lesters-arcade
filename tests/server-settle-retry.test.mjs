import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ethers } from 'ethers';

import { migrate } from '../server/neon/migrations.mjs';
import { periodKeysFor } from '../server/neon/period-keys.mjs';
import { readPublicProfile } from '../server/neon/queries.mjs';
import { attestationDomain, attestationRecord, signVerifiedRun } from '../server/settle/attestation.mjs';
import { runSettleRetry } from '../server/settle/retry.mjs';
import { insertSettleRow, markConfirmed, readSettleRow, requeueDeadLetters, settleInsertParams } from '../server/settle/store.mjs';
import { localContracts, localWalletKeys } from '../scripts/lib/local-chain.mjs';
import { REQUEUE_CONFIRM, runRequeueDeadLetters } from '../scripts/requeue-dead-letters.mjs';
import * as retryApi from '../api/cron/settle-retry.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';
import {
  bootLocalChain, buildSettleBody, createCatalogDouble, createVerifyDouble, fixtureEnv, openPaidSession, REAL_SETTLEMENT_GAS_RESERVE_WEI, SETTLE_CRON_VALUE,
  SETTLE_SESSION_VALUE,
} from './helpers/settle-fixtures.mjs';

/**
 * Contract §4.3.11 (E13), §3.3 and the requeue script: the cron drains due
 * rows in priority order within its budget, re-signs pending rows by
 * re-verification, dead-letters rows retryable for more than 7 days, and
 * rejects a missing or wrong CRON_SECRET. Dead letters are recoverable by
 * the operator with scripts/requeue-dead-letters.mjs (dry run by default).
 */

const NOW = Date.parse('2026-09-23T12:00:00.000Z');
const REGISTRY = `0x${'33'.repeat(20)}`;
// The real 0.002 zkLTC reserve and the 0.012 zkLTC entry it implies (0.01 +
// 0.002); these rows never reach a chain, so the values are only realistic.
const ENTRY_AMOUNT_WEI = 12_000_000_000_000_000n;
const DEPLOYMENT = Object.freeze({
  status: 'deployed', chainId: 4441, settlementGasReserveWei: REAL_SETTLEMENT_GAS_RESERVE_WEI,
  addresses: Object.freeze({ scoreSubmissionRegistry: REGISTRY, arcadeRankedEntry: `0x${'44'.repeat(20)}` }),
});
const PLAYER = new ethers.Wallet(`0x${'55'.repeat(32)}`).address.toLowerCase();

async function withDb(run, { migrated = true } = {}) {
  const db = createPgliteClient();
  try {
    if (migrated) await migrate(db);
    await run(db);
  } finally {
    await db.close();
  }
}

// Inserts a verified run (verify double), then moves it to `status` with the
// given ages. Signed and later statuses carry a real attestation.
async function seedRow(db, verify, { status = 'signed', registry = REGISTRY, player = PLAYER, verifiedAgoMs = 60_000, submittedAgoMs = null, nextAttemptInMs = null, deadLetter = false, nowMs = NOW, signer = new ethers.Wallet(localWalletKeys().verifier) } = {}) {
  const verifiedAt = nowMs - verifiedAgoMs;
  const body = await buildSettleBody({ wallet: player, registry, nowMs: verifiedAt });
  const common = { chainId: 4441, scoreRegistryAddress: registry, wallet: player, nowMs: verifiedAt, seedSecret: SETTLE_SESSION_VALUE };
  const bound = await verify.bindRankedIdentity(body, common);
  const run = await verify.verifyRankedRun(body, { ...common, bound });
  assert.equal(run.ok, true);
  const verified = { ...run, verifiedAt: new Date(verifiedAt).toISOString() };
  await insertSettleRow(db, settleInsertParams({ verifiedRun: verified, openedAtMs: verifiedAt - 60_000, amountWei: ENTRY_AMOUNT_WEI, periodKeys: periodKeysFor(verifiedAt - 60_000) }));
  if (status !== 'pending') {
    const domain = attestationDomain({ chainId: 4441, verifyingContract: registry });
    const signed = await signVerifiedRun(ethers, { verifiedRun: run, deadlineSeconds: Math.floor(nowMs / 1000) + 900, domain, signer });
    const txHash = ['submitted', 'confirmed'].includes(status) ? `0x${ethers.id(run.sessionId32).slice(2)}` : null;
    await db.query(
      `UPDATE verified_sessions SET status = $2, attestation = $3::jsonb, tx_hash = $4, submitted_at = $5::timestamptz,
              next_attempt_at = $6::timestamptz, confirmed_at = $7::timestamptz, attempts = $8::int
        WHERE session_id32 = $1`,
      [run.sessionId32, status, JSON.stringify(attestationRecord(signed)), txHash,
        submittedAgoMs === null ? null : new Date(nowMs - submittedAgoMs).toISOString(),
        status === 'failed' && !deadLetter ? new Date(nowMs + (nextAttemptInMs ?? -1000)).toISOString() : null,
        status === 'confirmed' ? new Date(nowMs).toISOString() : null,
        deadLetter ? '3' : '0'],
    );
  }
  return run.sessionId32;
}

// A relayer double: records the calls and settles rows through the store.
function fakeRelayer(db, { nowMs = () => NOW, onSubmit = null, confirmSubmitted = true } = {}) {
  const calls = [];
  return {
    calls,
    async submit(row) {
      calls.push(['submit', row.sessionId32, row.status]);
      onSubmit?.(row);
      await markConfirmed(db, { sessionId32: row.sessionId32, confirmedAtMs: nowMs(), nowMs: nowMs(), from: ['signed'] });
      return { status: 'confirmed', code: null };
    },
    async checkReceipt(row) {
      calls.push(['check', row.sessionId32, row.status]);
      if (!confirmSubmitted) return { status: 'submitted', code: null };
      await markConfirmed(db, { sessionId32: row.sessionId32, confirmedAtMs: nowMs(), nowMs: nowMs(), from: ['submitted'] });
      return { status: 'confirmed', code: null };
    },
  };
}

async function cronDeps(db, { env = fixtureEnv({ registry: REGISTRY }), verify, catalog = createCatalogDouble(), relayer, nowMs = NOW, deployment = DEPLOYMENT } = {}) {
  const deps = await retryApi.buildDeps(env, { db, deployment, nowMs });
  deps.verify = verify;
  deps.catalog = catalog;
  if (relayer) deps.relayer = relayer;
  return deps;
}

test('cron drains due rows in priority order within budget', async () => withDb(async (db) => {
  const verify = createVerifyDouble({ nowMs: () => NOW });
  const ids = {
    failedDue: await seedRow(db, verify, { status: 'failed', nextAttemptInMs: -5_000 }),
    signed: await seedRow(db, verify, { status: 'signed' }),
    submittedOld: await seedRow(db, verify, { status: 'submitted', submittedAgoMs: 200_000 }),
    pendingOld: await seedRow(db, verify, { status: 'pending', verifiedAgoMs: 60_000 }),
    pendingFresh: await seedRow(db, verify, { status: 'pending', verifiedAgoMs: 10_000 }),
    submittedFresh: await seedRow(db, verify, { status: 'submitted', submittedAgoMs: 100_000 }),
    failedLater: await seedRow(db, verify, { status: 'failed', nextAttemptInMs: 60_000 }),
    dead: await seedRow(db, verify, { status: 'failed', deadLetter: true }),
    confirmed: await seedRow(db, verify, { status: 'confirmed' }),
  };
  const relayer = fakeRelayer(db);
  const reverified = verify.calls.reverifyStoredRun;
  const result = await runSettleRetry(await cronDeps(db, { verify, relayer }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.processed, [
    { sessionId32: ids.pendingOld, from: 'pending', to: 'confirmed', code: null },
    { sessionId32: ids.submittedOld, from: 'submitted', to: 'confirmed', code: null },
    { sessionId32: ids.signed, from: 'signed', to: 'confirmed', code: null },
    { sessionId32: ids.failedDue, from: 'failed', to: 'confirmed', code: null },
  ], 'pending > 30 s, submitted > 180 s, signed, failed and due; nothing else');
  assert.equal(verify.calls.reverifyStoredRun, reverified + 1, 'the pending row was re-signed by re-verification');
  assert.deepEqual(relayer.calls.map(([kind, id]) => [kind, id]), [['submit', ids.pendingOld], ['check', ids.submittedOld], ['submit', ids.signed], ['submit', ids.failedDue]]);
  const resigned = await readSettleRow(db, ids.pendingOld);
  assert.ok(resigned.attestation?.signature, 'a fresh attestation was stored');
  for (const untouched of ['pendingFresh', 'submittedFresh', 'failedLater', 'dead']) {
    // eslint-disable-next-line no-await-in-loop
    assert.notEqual((await readSettleRow(db, ids[untouched])).status, 'confirmed', untouched);
  }

  // At most 8 rows per call.
  const more = [];
  for (let index = 0; index < 10; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    more.push(await seedRow(db, verify, { status: 'signed' }));
  }
  const batch = await runSettleRetry(await cronDeps(db, { verify, relayer: fakeRelayer(db) }));
  assert.equal(batch.body.processed.length, 8);
  // And within the time budget: a row starts only with 5 s of budget left.
  for (let index = 0; index < 5; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    more.push(await seedRow(db, verify, { status: 'signed' }));
  }
  let monotonic = 0;
  const slow = fakeRelayer(db, { onSubmit: () => { monotonic += 21_000; } });
  const timed = await runSettleRetry(await cronDeps(db, { verify, relayer: slow }), { budgetMs: 45_000, monotonicMs: () => monotonic });
  assert.equal(timed.body.processed.length, 2, 'seven rows are due, but the third would start with under 5 s left');
  assert.equal((await runSettleRetry(await cronDeps(db, { verify, relayer: fakeRelayer(db) }))).body.processed.length, 5);
  assert.equal((await runSettleRetry(await cronDeps(db, { verify, relayer: fakeRelayer(db) }))).body.processed.length, 0, 'drained');
}));

test('cron dead-letters stale rows', async () => withDb(async (db) => {
  const verify = createVerifyDouble({ nowMs: () => NOW });
  const eightDays = 8 * 24 * 3600 * 1000;
  const stale = {
    pending: await seedRow(db, verify, { status: 'pending', verifiedAgoMs: eightDays }),
    signed: await seedRow(db, verify, { status: 'signed', verifiedAgoMs: eightDays }),
    failed: await seedRow(db, verify, { status: 'failed', verifiedAgoMs: eightDays, nextAttemptInMs: 60_000 }),
  };
  const kept = {
    submitted: await seedRow(db, verify, { status: 'submitted', verifiedAgoMs: eightDays, submittedAgoMs: 100_000 }),
    confirmed: await seedRow(db, verify, { status: 'confirmed', verifiedAgoMs: eightDays }),
    dead: await seedRow(db, verify, { status: 'failed', verifiedAgoMs: eightDays, deadLetter: true }),
    recent: await seedRow(db, verify, { status: 'failed', verifiedAgoMs: 6 * 24 * 3600 * 1000, nextAttemptInMs: 60_000 }),
  };
  const relayer = fakeRelayer(db, { confirmSubmitted: false });
  const result = await runSettleRetry(await cronDeps(db, { verify, relayer }));
  const staleEntries = result.body.processed.filter((entry) => entry.code === 'stale');
  assert.deepEqual(staleEntries.map((entry) => entry.sessionId32).sort(), Object.values(stale).sort());
  assert.deepEqual(new Map(staleEntries.map((entry) => [entry.sessionId32, entry.from])), new Map([[stale.pending, 'pending'], [stale.signed, 'signed'], [stale.failed, 'failed']]));
  assert.deepEqual(relayer.calls, [], 'stale rows are never retried first');
  for (const id of Object.values(stale)) {
    // eslint-disable-next-line no-await-in-loop
    const row = await readSettleRow(db, id);
    assert.deepEqual([row.status, row.nextAttemptAt, row.lastError], ['failed', null, 'stale']);
  }
  assert.equal((await readSettleRow(db, kept.submitted)).status, 'submitted', 'a submitted row is left to its receipt check');
  assert.equal((await readSettleRow(db, kept.confirmed)).status, 'confirmed');
  assert.equal((await readSettleRow(db, kept.dead)).lastError, null);
  assert.ok((await readSettleRow(db, kept.recent)).nextAttemptAt, 'six days old is still retryable');
}));

test('cron rejects a missing or wrong secret', async () => withDb(async (db) => {
  const env = fixtureEnv({ registry: REGISTRY });
  const verify = createVerifyDouble({ nowMs: () => NOW });
  const catalog = createCatalogDouble();
  const mount = (envOverride = env) => retryApi.createHandler(async () => {
    const deps = await retryApi.buildDeps(envOverride, { db, deployment: DEPLOYMENT, nowMs: NOW });
    deps.verify = verify;
    deps.catalog = catalog;
    deps.relayer = fakeRelayer(db);
    return deps;
  });
  for (const authorization of [undefined, '', 'Bearer', `Bearer ${SETTLE_CRON_VALUE}x`, `bearer ${SETTLE_CRON_VALUE}`, SETTLE_CRON_VALUE]) {
    // eslint-disable-next-line no-await-in-loop
    const response = await invoke(mount(), { url: '/api/cron/settle-retry', headers: authorization === undefined ? {} : { authorization } });
    assert.deepEqual([response.status, response.body], [401, { ok: false, error: 'unauthorized' }], String(authorization));
  }
  assert.equal((await db.query("SELECT to_regclass('public.schema_migrations') IS NULL AS absent"))[0].absent, true, 'nothing was touched');
  const withoutSecret = { ...env };
  delete withoutSecret.CRON_SECRET;
  const unset = await invoke(mount(withoutSecret), { url: '/api/cron/settle-retry', headers: { authorization: 'Bearer ' } });
  assert.equal(unset.status, 401, 'no CRON_SECRET: every call is unauthorized');
  const paused = await invoke(mount({ ...env, SETTLEMENT_PAUSED: 'true' }), { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  assert.deepEqual([paused.status, paused.body.error], [503, 'settlement-paused']);
  assert.equal((await db.query("SELECT to_regclass('public.schema_migrations') IS NULL AS absent"))[0].absent, true, 'paused touches no row');
  const legacy = await invoke(mount({ ...env, RELAYER_PRIVATE_KEY: localWalletKeys().relayer }), { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  assert.deepEqual([legacy.status, legacy.body.error, legacy.body.detail], [503, 'settlement-not-configured', 'legacy-env-present:RELAYER_PRIVATE_KEY']);
  const ok = await invoke(mount(), { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  assert.deepEqual([ok.status, ok.body], [200, { ok: true, processed: [] }], 'the first call on an unmigrated database works');
  assert.equal(ok.headers['cache-control'], 'no-store');
  const query = await invoke(mount(), { url: '/api/cron/settle-retry?now=1', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
  assert.equal(query.status, 400);
  const bare = await invoke(retryApi.createHandler(() => retryApi.buildDeps({})), { url: '/api/cron/settle-retry', headers: { authorization: 'Bearer ' } });
  assert.deepEqual([bare.status, bare.body.error], [401, 'unauthorized']);
}, { migrated: false }));

test('cron re-signs a pending row and publishes it on the local chain', async () => {
  const local = await bootLocalChain();
  const db = createPgliteClient();
  try {
    const registry = local.record.addresses.scoreSubmissionRegistry.toLowerCase();
    const env = fixtureEnv({ registry });
    let clockMs = (await local.chain.latestTimestamp()) * 1000 + 1000;
    const verify = createVerifyDouble({ nowMs: () => clockMs });
    const player = local.chain.wallets.player1;
    const body = await buildSettleBody({ wallet: player.address, registry, nowMs: clockMs });
    const common = { chainId: 4441, scoreRegistryAddress: registry, wallet: player.address.toLowerCase(), nowMs: clockMs, seedSecret: SETTLE_SESSION_VALUE };
    const run = await verify.verifyRankedRun(body, { ...common, bound: await verify.bindRankedIdentity(body, common) });
    const paid = await openPaidSession({ chain: local.chain, record: local.record, player, sessionId32: body.sessionId32, gameId: 'chikun' });
    await migrate(db);
    await insertSettleRow(db, settleInsertParams({ verifiedRun: run, openedAtMs: paid.openedAt * 1000, amountWei: paid.amountWei, periodKeys: periodKeysFor(paid.openedAt * 1000) }));
    clockMs = (await local.chain.latestTimestamp()) * 1000 + 31_000;
    const handler = retryApi.createHandler(async () => {
      const deps = await retryApi.buildDeps(env, { db, provider: local.chain.provider, deployment: local.deployment, nowMs: () => clockMs });
      deps.verify = verify;
      deps.catalog = createCatalogDouble();
      return deps;
    });
    const response = await invoke(handler, { url: '/api/cron/settle-retry', headers: { authorization: `Bearer ${SETTLE_CRON_VALUE}` } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.processed, [{ sessionId32: body.sessionId32, from: 'pending', to: 'confirmed', code: null }]);
    const row = await readSettleRow(db, body.sessionId32);
    assert.equal(row.status, 'confirmed');
    const session = await localContracts(local.record, local.chain.provider).scores.getSession(body.sessionId32);
    assert.deepEqual([session.exists, session.player.toLowerCase()], [true, player.address.toLowerCase()]);
  } finally {
    await db.close();
    await local.chain.close();
  }
});

test('requeue script lists dead letters in a dry run and requeues only with --apply and the confirm phrase', async () => withDb(async (db) => {
  const verify = createVerifyDouble({ nowMs: () => NOW });
  const eightDays = 8 * 24 * 3600 * 1000;
  const deadOld = await seedRow(db, verify, { status: 'failed', deadLetter: true, verifiedAgoMs: eightDays });
  const deadNew = await seedRow(db, verify, { status: 'failed', deadLetter: true, verifiedAgoMs: 3_600_000 });
  const retryable = await seedRow(db, verify, { status: 'failed', nextAttemptInMs: 60_000 });
  await seedRow(db, verify, { status: 'confirmed', verifiedAgoMs: 1_800_000 });
  const lines = [];
  const out = (line) => lines.push(String(line));
  const run = (argv, extra = {}) => runRequeueDeadLetters({ argv, db, out, nowMs: () => NOW, ...extra });
  const recentRuns = async () => (await readPublicProfile(db, PLAYER, { self: true, nowMs: NOW, catalog: null })).recentSessions.map((row) => [row.sessionId32, row.verifiedAt]);
  const recentBefore = await recentRuns();
  assert.equal(recentBefore.length, 4);

  const dry = await run(['--all-dead']);
  assert.equal(dry.exitCode, 0);
  assert.deepEqual(dry.found, [deadNew]);
  assert.deepEqual(dry.stale, [deadOld], 'a dead letter verified more than 7 days ago is stale');
  assert.deepEqual(dry.requeued, []);
  assert.ok(lines.some((line) => line.includes(`stale, not requeued`) && line.includes(deadOld)));
  assert.ok(lines.some((line) => line.includes('dry run: nothing was requeued')));
  assert.equal((await readSettleRow(db, deadNew)).nextAttemptAt, null, 'a dry run writes nothing');

  lines.length = 0;
  assert.equal((await run(['--all-dead', '--apply'])).exitCode, 2, '--apply alone is refused');
  assert.equal((await run(['--all-dead', '--apply', '--confirm', 'yes'])).exitCode, 2);
  assert.equal((await readSettleRow(db, deadNew)).nextAttemptAt, null);
  assert.equal((await run([])).exitCode, 2, 'a selection is required');
  assert.equal((await run(['--all-dead', '--session', deadOld])).exitCode, 2, 'not both');
  assert.equal((await run(['--session', '0x1234'])).exitCode, 2);
  assert.equal((await run(['--all-dead', '--force'])).exitCode, 2);
  assert.equal((await run(['--all-dead', '--key-env'])).exitCode, 2, 'a key flag needs a value');

  const one = await run(['--session', deadNew, '--session', retryable, '--apply', '--confirm', REQUEUE_CONFIRM]);
  assert.deepEqual(one.requeued, [deadNew], 'only dead letters are requeued');
  assert.ok(lines.some((line) => line.includes(`not a dead letter (skipped): ${retryable}`)));
  const requeuedNew = await readSettleRow(db, deadNew);
  assert.deepEqual([requeuedNew.status, requeuedNew.attempts, requeuedNew.infraFailures, requeuedNew.nextAttemptAt], ['failed', 0, 0, new Date(NOW).toISOString()]);
  assert.equal(requeuedNew.verifiedAt, new Date(NOW - 3_600_000).toISOString(), 'verified_at is never rewritten');

  const all = await run(['--all-dead', '--apply', `--confirm=${REQUEUE_CONFIRM}`]);
  assert.deepEqual([all.found, all.stale, all.requeued], [[], [deadOld], []]);
  const stillDead = await readSettleRow(db, deadOld);
  assert.deepEqual([stillDead.nextAttemptAt, stillDead.verifiedAt], [null, new Date(NOW - eightDays).toISOString()], 'the stale row is left as it was');
  assert.deepEqual(await requeueDeadLetters(db, { sessionIds: [deadOld], nowMs: NOW }), [], 'the store refuses a stale row too');
  assert.deepEqual(await recentRuns(), recentBefore, 'the profile\'s recent runs keep their order and verification times');

  const due = await runSettleRetry(await cronDeps(db, { verify, relayer: fakeRelayer(db) }));
  const picked = due.body.processed.filter((entry) => [deadOld, deadNew].includes(entry.sessionId32));
  assert.deepEqual(picked.map((entry) => [entry.sessionId32, entry.to]), [[deadNew, 'confirmed']], 'the cron picks the requeued row up');
}));

test('requeue script reads the connection string through key-source and never prints it', async () => {
  const secretUrl = 'postgresql://owner:hunter2@ep-secret-pooler.neon.tech/neondb?sslmode=require';
  const dir = mkdtempSync(join(tmpdir(), 'requeue-key-'));
  try {
    const jsonFile = join(dir, 'neon.json');
    writeFileSync(jsonFile, JSON.stringify({ neon: { url: secretUrl }, other: 'x' }));
    const textFile = join(dir, 'neon.txt');
    writeFileSync(textFile, `${secretUrl}\n`);
    const lines = [];
    const out = (line) => lines.push(String(line));
    const used = [];
    const fetchImpl = async (endpoint, init) => {
      used.push(init.headers['Neon-Connection-String']);
      throw Object.assign(new Error(`connect failed ${secretUrl}`), { code: 'ECONNREFUSED' });
    };
    const run = (argv, env = {}) => runRequeueDeadLetters({ argv: ['--all-dead', ...argv], env, out, fetchImpl, nowMs: () => NOW });

    // Default: --key-env NEON_DATABASE_URL.
    assert.equal((await run([], { NEON_DATABASE_URL: secretUrl })).exitCode, 1);
    // A named variable, a JSON field and a plain-text file.
    assert.equal((await run(['--key-env', 'OPS_NEON_URL'], { OPS_NEON_URL: secretUrl })).exitCode, 1);
    assert.equal((await run(['--key-file', jsonFile, '--key-field', 'neon.url'])).exitCode, 1);
    assert.equal((await run([`--key-file=${textFile}`])).exitCode, 1);
    assert.deepEqual(used, [secretUrl, secretUrl, secretUrl, secretUrl], 'each source reached the client');
    assert.deepEqual(lines, Array(4).fill('requeue failed (ECONNREFUSED)'));

    lines.length = 0;
    assert.equal((await run([])).exitCode, 2);
    assert.equal((await run(['--key-file', jsonFile, '--key-field', 'neon.missing'])).exitCode, 2);
    assert.equal((await run(['--key-env', 'OPS_NEON_URL', '--key-file', jsonFile])).exitCode, 2);
    assert.equal((await run(['--key-env', secretUrl])).exitCode, 2, 'a pasted value is refused');
    assert.equal((await run(['--key-file', jsonFile, '--key-field', 'other'])).exitCode, 2, 'the value must look like a connection string');
    assert.deepEqual(lines.slice(0, 1), ['environment variable NEON_DATABASE_URL is not set or empty; nothing was requeued.']);
    assert.ok(lines[1].includes('neon.missing') && lines[1].includes(jsonFile));
    assert.equal(lines.length, 5);
    assert.equal(used.length, 4, 'no client for a source that failed');
    for (const line of lines) {
      assert.ok(!line.includes('hunter2') && !line.includes('ep-secret'), line);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
