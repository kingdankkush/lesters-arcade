import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import { periodKeysFor } from '../server/neon/period-keys.mjs';
import { migrate } from '../server/neon/migrations.mjs';
import { attestationDomain, attestationRecord, needsResign, resignRow, signVerifiedRun } from '../server/settle/attestation.mjs';
import {
  allowlistedCode, classifyRelayError, CONTRACT_REVERTS, decodeRevertReason, ERROR_CODE_ALLOWLIST, logSafeError, nonceErrorKind,
} from '../server/settle/errors.mjs';
import { acquireLease, createChainReader, createRelayer, ensureLeaseRow, readLease, releaseLease } from '../server/settle/relayer.mjs';
import {
  casStatus, failureTransition, insertSettleRow, readSettleRow, recordFailure, settleInsertParams,
} from '../server/settle/store.mjs';
import { localContracts } from '../scripts/lib/local-chain.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { bootLocalChain, buildSettleBody, createCatalogDouble, createVerifyDouble, LOCAL_FEE_CAP_RESERVE_WEI, openPaidSession, SETTLE_SESSION_VALUE } from './helpers/settle-fixtures.mjs';

/**
 * Contract §3.3 and §3.4 (A1, A31; security review S9): the relayer lease,
 * nonce handling, funds and fee caps, receipts, dropped transactions, the
 * error classes and the re-sign rule, against PGlite and the contracts
 * slice's in-process chain (chain 4441, fees on, games playable).
 */

let local;
let registry;
let domain;
let clockMs = 0;
const nowMs = () => clockMs;
const verify = createVerifyDouble({ nowMs });
const catalog = createCatalogDouble();

before(async () => {
  local = await bootLocalChain();
  registry = local.record.addresses.scoreSubmissionRegistry.toLowerCase();
  domain = attestationDomain({ chainId: 4441, verifyingContract: registry });
});

after(async () => {
  await local?.chain.close();
});

async function syncClock(offsetMs = 1000) {
  clockMs = (await local.chain.latestTimestamp()) * 1000 + offsetMs;
  return clockMs;
}

// A fresh migrated database and a chain snapshot, both undone afterwards.
async function scenario(run) {
  const db = createPgliteClient();
  const snapshot = await local.chain.snapshot();
  try {
    await migrate(db);
    await syncClock();
    await run(db);
  } finally {
    await local.chain.request('evm_setAutomine', [true]);
    await local.chain.revert(snapshot);
    await db.close();
  }
}

function relayerFor(db, overrides = {}) {
  return createRelayer({
    db,
    provider: local.chain.provider,
    wallet: local.chain.wallets.relayer,
    registryAddress: registry,
    reserveWei: LOCAL_FEE_CAP_RESERVE_WEI,
    holderId: 'test:relayer',
    nowMs,
    sleep: async () => {},
    ...overrides,
  });
}

// Inserts a verified run (verify double) and signs it. `pay` opens the paid
// session on chain first.
async function seedSignedRow(db, { player = local.chain.wallets.player1, gameId = 'chikun', pay = true, deadlineSeconds = null, signer = local.chain.wallets.verifier, nftIds = [], evidenceOptions = {} } = {}) {
  const body = await buildSettleBody({ gameId, wallet: player.address, registry, nowMs: clockMs, evidenceOptions });
  const common = { chainId: 4441, scoreRegistryAddress: registry, wallet: player.address.toLowerCase(), nowMs: clockMs, seedSecret: SETTLE_SESSION_VALUE };
  const bound = await verify.bindRankedIdentity(body, common);
  assert.equal(bound.ok, true, JSON.stringify(bound));
  const run = await verify.verifyRankedRun(body, { ...common, bound });
  assert.equal(run.ok, true, JSON.stringify(run));
  let paid = { amountWei: 0n, openedAt: Math.floor(clockMs / 1000) };
  if (pay) paid = await openPaidSession({ chain: local.chain, record: local.record, player, sessionId32: body.sessionId32, gameId });
  await syncClock();
  const openedAtMs = paid.openedAt * 1000;
  const inserted = await insertSettleRow(db, settleInsertParams({
    verifiedRun: run, openedAtMs, amountWei: paid.amountWei, unlocks: nftIds.map((id) => ({ id, tier: 'platinum', nft: true })), nftIds, periodKeys: periodKeysFor(openedAtMs),
  }));
  assert.equal(inserted.inserted, true);
  const signed = await signVerifiedRun(ethers, { verifiedRun: run, nftAchievementIds: nftIds, deadlineSeconds: deadlineSeconds ?? Math.floor(clockMs / 1000) + 900, domain, signer });
  assert.equal(await casStatus(db, { sessionId32: run.sessionId32, from: 'pending', to: 'signed', set: { attestation: attestationRecord(signed) }, nowMs: clockMs }), true);
  return { row: await readSettleRow(db, run.sessionId32), body, run, signed };
}

async function onChainSession(sessionId32) {
  return createChainReader({ provider: local.chain.provider, deployment: local.deployment }).getSession(sessionId32);
}

function wrapProvider(overrides) {
  const base = local.chain.provider;
  return new Proxy(base, {
    get(target, key) {
      if (Object.hasOwn(overrides, key)) return overrides[key];
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

test('lease is exclusive until it expires', async () => scenario(async (db) => {
  const relayer = local.chain.wallets.relayer.address;
  await ensureLeaseRow(db, relayer);
  await ensureLeaseRow(db, relayer);
  const first = await acquireLease(db, { relayer, holder: 'holder-a', leaseMs: 40_000 });
  assert.deepEqual(first.nextNonce, null);
  assert.equal(await acquireLease(db, { relayer, holder: 'holder-b', leaseMs: 40_000 }), null, 'another holder waits');
  assert.ok(await acquireLease(db, { relayer, holder: 'holder-a', leaseMs: 40_000 }), 'the holder may renew');
  assert.equal(await releaseLease(db, { relayer, holder: 'holder-b', nextNonce: 99 }), false, 'only the holder releases');
  await db.query("UPDATE relayer_lease SET lease_until = now() - interval '1 second' WHERE relayer = $1", [relayer.toLowerCase()]);
  const taken = await acquireLease(db, { relayer, holder: 'holder-b', leaseMs: 40_000 });
  assert.ok(taken, 'an expired lease can be taken');
  assert.equal(await acquireLease(db, { relayer, holder: 'holder-a', leaseMs: 40_000 }), null, 'the old holder lost it');
  assert.equal(await releaseLease(db, { relayer, holder: 'holder-b', nextNonce: 7 }), true);
  assert.deepEqual(await readLease(db, relayer), { holder: null, nextNonce: 7, leaseUntil: '1970-01-01T00:00:00.000Z' });
  assert.equal((await acquireLease(db, { relayer, holder: 'holder-c', leaseMs: 40_000 })).nextNonce, 7, 'next_nonce survives the release');
  await releaseLease(db, { relayer, holder: 'holder-c', nextNonce: 7 });

  // A lease miss is never a failure: the row stays signed with nothing spent.
  const { row } = await seedSignedRow(db);
  await acquireLease(db, { relayer, holder: 'someone-else', leaseMs: 40_000 });
  const sleeps = [];
  const busy = await relayerFor(db, { sleep: async (ms) => { sleeps.push(ms); } }).submit(row);
  assert.deepEqual(busy, { status: 'signed', code: 'lease-busy' });
  assert.deepEqual(sleeps, [750, 750, 750], 'four tries, 750 ms apart');
  const after = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([after.status, after.attempts, after.infraFailures, after.lastError, after.txHash], ['signed', 0, 0, null, null]);
}));

test('holder never broadcasts with under five seconds of lease', async () => scenario(async (db) => {
  const { row } = await seedSignedRow(db);
  const wallet = local.chain.wallets.relayer.address;
  const nonceBefore = await local.chain.provider.getTransactionCount(wallet, 'latest');
  const broadcasts = [];
  const provider = wrapProvider({ broadcastTransaction: async (raw) => { broadcasts.push(raw); return local.chain.provider.broadcastTransaction(raw); } });
  const short = await relayerFor(db, { provider, leaseMs: 4_000 }).submit(row);
  assert.deepEqual(short, { status: 'signed', code: 'lease-busy' });
  // A 40 s lease that runs down while the transaction is signed.
  let monotonic = 0;
  const slowWallet = new Proxy(local.chain.wallets.relayer, {
    get(target, key) {
      if (key === 'signTransaction') return async (tx) => { monotonic += 36_000; return target.signTransaction(tx); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const late = await relayerFor(db, { provider, wallet: slowWallet, monotonicMs: () => monotonic }).submit(row);
  assert.deepEqual(late, { status: 'signed', code: 'lease-busy' });
  assert.equal(broadcasts.length, 0, 'nothing was broadcast');
  assert.equal(await local.chain.provider.getTransactionCount(wallet, 'latest'), nonceBefore);
  const after = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([after.status, after.txHash, after.attempts, after.infraFailures], ['signed', null, 0, 0]);
  assert.deepEqual((await readLease(db, wallet)).holder, null, 'the lease was released');
}));

test('tx hash is recorded before broadcast and confirmed after the receipt', async () => scenario(async (db) => {
  const { row } = await seedSignedRow(db, { nftIds: ['chikun-coast-legend'] });
  const seen = [];
  const provider = wrapProvider({
    broadcastTransaction: async (raw) => {
      seen.push({ hash: ethers.keccak256(raw).toLowerCase(), row: await readSettleRow(db, row.sessionId32) });
      return local.chain.provider.broadcastTransaction(raw);
    },
  });
  const wallet = local.chain.wallets.relayer.address;
  const nonce = await local.chain.provider.getTransactionCount(wallet, 'latest');
  const result = await relayerFor(db, { provider }).submit(row);
  assert.equal(result.status, 'confirmed', JSON.stringify(result));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].row.status, 'submitted', 'the CAS to submitted happens before the broadcast');
  assert.equal(seen[0].row.txHash, seen[0].hash, 'the stored hash is keccak256(raw)');
  assert.equal(seen[0].row.txNonce, nonce);
  assert.equal(seen[0].row.relayer, wallet.toLowerCase());
  const confirmed = await readSettleRow(db, row.sessionId32);
  const receipt = await local.chain.provider.getTransactionReceipt(seen[0].hash);
  const block = await local.chain.provider.getBlock(receipt.blockNumber);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.txHash, seen[0].hash);
  assert.equal(confirmed.blockNumber, receipt.blockNumber);
  assert.equal(confirmed.confirmedAt, new Date(block.timestamp * 1000).toISOString(), 'confirmed_at is the block time');
  assert.equal((await readLease(db, wallet)).nextNonce, nonce + 1, 'released with next_nonce = nonce + 1');
  const session = await onChainSession(row.sessionId32);
  assert.deepEqual([session.exists, session.player], [true, row.wallet]);
  const scores = localContracts(local.record, local.chain.provider).scores;
  assert.deepEqual([...await scores.getSessionAchievements(row.sessionId32)], [ethers.id('chikun-coast-legend')], 'the NFT candidate rode in the settlement');
  assert.ok(receipt.gasUsed > 0n);
}));

test('nonce-too-low and nonce-too-high are retried from the chain\'s counts', async () => scenario(async (db) => {
  const wallet = local.chain.wallets.relayer;
  // Too high: a stored next_nonce ahead of the chain (inside the gap guard).
  const high = await seedSignedRow(db);
  const latest = await local.chain.provider.getTransactionCount(wallet.address, 'latest');
  await ensureLeaseRow(db, wallet.address);
  await db.query('UPDATE relayer_lease SET next_nonce = $2::bigint WHERE relayer = $1', [wallet.address.toLowerCase(), String(latest + 3)]);
  const errors = [];
  const provider = wrapProvider({
    broadcastTransaction: async (raw) => {
      try {
        return await local.chain.provider.broadcastTransaction(raw);
      } catch (error) {
        errors.push(nonceErrorKind(error));
        throw error;
      }
    },
  });
  const highResult = await relayerFor(db, { provider }).submit(high.row);
  assert.equal(highResult.status, 'confirmed', JSON.stringify(highResult));
  assert.deepEqual(errors, ['too-high']);
  assert.equal((await readSettleRow(db, high.row.sessionId32)).txNonce, latest, 'retried at the latest count');

  // Too low: the wallet sent a transaction outside the lease and a lagging
  // node reported the old pending count once.
  const low = await seedSignedRow(db);
  await (await wallet.sendTransaction({ to: wallet.address, value: 1n })).wait();
  const stale = await local.chain.provider.getTransactionCount(wallet.address, 'latest') - 1;
  await db.query('UPDATE relayer_lease SET next_nonce = $2::bigint WHERE relayer = $1', [wallet.address.toLowerCase(), String(stale)]);
  let lagging = true;
  const laggingProvider = wrapProvider({
    getTransactionCount: async (address, tag) => {
      if (tag === 'pending' && lagging) { lagging = false; return stale; }
      return local.chain.provider.getTransactionCount(address, tag);
    },
    broadcastTransaction: provider.broadcastTransaction,
  });
  errors.length = 0;
  const lowResult = await relayerFor(db, { provider: laggingProvider }).submit(low.row);
  assert.equal(lowResult.status, 'confirmed', JSON.stringify(lowResult));
  assert.deepEqual(errors, ['too-low']);
  assert.equal((await readSettleRow(db, low.row.sessionId32)).txNonce, stale + 1, 'retried from the re-read pending count');
  assert.equal((await readLease(db, wallet.address)).nextNonce, stale + 2);

  // Unit: the three nonce error families.
  assert.equal(nonceErrorKind({ code: 'NONCE_EXPIRED' }), 'too-low');
  assert.equal(nonceErrorKind({ message: 'nonce too high' }), 'too-high');
  assert.equal(nonceErrorKind({ code: 'REPLACEMENT_UNDERPRICED' }), 'replacement');
  assert.equal(nonceErrorKind({ info: { error: { message: 'already known' } } }), 'replacement');
  assert.equal(nonceErrorKind({ message: 'execution reverted' }), null);
}));

test('a dropped transaction returns the row to signed and resets the nonce', async () => scenario(async (db) => {
  const { row } = await seedSignedRow(db);
  const wallet = local.chain.wallets.relayer.address;
  await local.chain.request('evm_setAutomine', [false]);
  const relayer = relayerFor(db, { receiptTimeoutMs: 50 });
  const sent = await relayer.submit(row);
  assert.equal(sent.status, 'submitted', JSON.stringify(sent));
  const submitted = await readSettleRow(db, row.sessionId32);
  assert.equal((await readLease(db, wallet)).nextNonce, submitted.txNonce + 1);
  assert.deepEqual(await relayer.checkReceipt(submitted), { status: 'submitted', code: null }, 'younger than 180 s: keep waiting');
  assert.equal(await local.chain.request('hardhat_dropTransaction', [submitted.txHash]), true);
  clockMs += 181_000;
  const dropped = await relayer.checkReceipt(submitted);
  assert.deepEqual(dropped, { status: 'signed', code: 'dropped-tx' });
  const back = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([back.status, back.lastError, back.infraFailures, back.attempts, back.txHash], ['signed', 'dropped-tx', 1, 0, null]);
  assert.equal((await readLease(db, wallet)).nextNonce, await local.chain.provider.getTransactionCount(wallet, 'latest'), 'next_nonce reset to the latest count');
  await local.chain.request('evm_setAutomine', [true]);
  await syncClock();
  const again = await relayer.submit(back);
  assert.equal(again.status, 'confirmed', 'the next submission refills the nonce');
}));

test('an existing on-chain session is marked confirmed without resubmitting', async () => scenario(async (db) => {
  const { row, signed } = await seedSignedRow(db);
  const scores = localContracts(local.record, local.chain.wallets.relayer).scores;
  const direct = await (await scores.submitVerifiedSession(signed.run, [...signed.achievements32], signed.signature)).wait();
  const block = await local.chain.provider.getBlock(direct.blockNumber);
  const wallet = local.chain.wallets.relayer.address;
  const nonce = await local.chain.provider.getTransactionCount(wallet, 'latest');
  const result = await relayerFor(db).submit(row);
  assert.deepEqual(result, { status: 'confirmed', code: null });
  assert.equal(await local.chain.provider.getTransactionCount(wallet, 'latest'), nonce, 'no second transaction');
  const confirmed = await readSettleRow(db, row.sessionId32);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.confirmedAt, new Date(block.timestamp * 1000).toISOString(), 'confirmed at the on-chain submittedAt');

  // Someone else's session under the same id would be a deterministic failure.
  assert.deepEqual(classifyRelayError({ reason: 'SESSION_EXISTS' }), { class: 'already-done', code: 'session-exists' });
}));

test('an RPC outage waits without spending attempts', async () => scenario(async (db) => {
  const { row } = await seedSignedRow(db);
  const outage = Object.assign(new Error('request failed: fetch failed (https://user:hunter2@rpc.example/secret-key)'), { code: 'NETWORK_ERROR' });
  const provider = wrapProvider({ estimateGas: async () => { throw outage; } });
  const first = await relayerFor(db, { provider }).submit(row);
  assert.deepEqual(first, { status: 'failed', code: 'rpc-unavailable' });
  const waited = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([waited.status, waited.attempts, waited.infraFailures, waited.lastError], ['failed', 0, 1, 'rpc-unavailable']);
  assert.equal(Date.parse(waited.nextAttemptAt) - clockMs, 60_000, 'min(60 s x 2^0, 15 min)');
  assert.equal(await casStatus(db, { sessionId32: row.sessionId32, from: 'failed', to: 'signed', nowMs: clockMs }), true);
  const timeout = wrapProvider({ getFeeData: async () => { throw Object.assign(new Error('timeout'), { code: 'TIMEOUT' }); } });
  assert.deepEqual(await relayerFor(db, { provider: timeout }).submit(await readSettleRow(db, row.sessionId32)), { status: 'failed', code: 'rpc-timeout' });
  const second = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([second.attempts, second.infraFailures], [0, 2]);
  assert.equal(Date.parse(second.nextAttemptAt) - clockMs, 120_000);
  let capped = { ...second, infraFailures: 9 };
  assert.equal(Date.parse(failureTransition(capped, { class: 'wait', code: 'rpc-timeout', nowMs: clockMs }).nextAttemptAt) - clockMs, 15 * 60_000, 'capped at 15 minutes');
  capped = { ...second, infraFailures: 4 };
  assert.equal(Date.parse(failureTransition(capped, { class: 'wait', code: 'rpc-timeout', nowMs: clockMs }).nextAttemptAt) - clockMs, 15 * 60_000);
  assert.equal(failureTransition({ ...second, infraFailures: 3 }, { class: 'wait', code: 'rpc-timeout', nowMs: clockMs }).nextAttemptAt, new Date(clockMs + 480_000).toISOString());
}));

test('a deterministic revert dead-letters after three attempts', async () => scenario(async (db) => {
  const { row } = await seedSignedRow(db, { pay: false });
  const relayer = relayerFor(db);
  const delays = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await relayer.submit(await readSettleRow(db, row.sessionId32));
    assert.deepEqual(result, { status: 'failed', code: 'session-not-paid' });
    // eslint-disable-next-line no-await-in-loop
    const failed = await readSettleRow(db, row.sessionId32);
    assert.equal(failed.attempts, attempt);
    assert.equal(failed.infraFailures, 0);
    delays.push(failed.nextAttemptAt === null ? null : Date.parse(failed.nextAttemptAt) - clockMs);
    // eslint-disable-next-line no-await-in-loop
    if (attempt < 3) assert.equal(await casStatus(db, { sessionId32: row.sessionId32, from: 'failed', to: 'signed', nowMs: clockMs }), true);
  }
  assert.deepEqual(delays, [30_000, 60_000, null], 'least(30 s x 2^attempts, 30 min), then the dead letter');
  const dead = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([dead.status, dead.nextAttemptAt, dead.lastError], ['failed', null, 'session-not-paid']);
  assert.equal(failureTransition({ ...dead, attempts: 1, verifiedAt: new Date(clockMs).toISOString() }, { class: 'deterministic', code: 'x', nowMs: clockMs }).lastError, 'unknown-error');
}));

test('an expired or rejected attestation is re-signed from re-verified evidence', async () => scenario(async (db) => {
  const signer = local.chain.wallets.verifier;
  // Expired: ATTESTATION_EXPIRED is a re-sign, not a failure count.
  const expired = await seedSignedRow(db, { deadlineSeconds: Math.floor(clockMs / 1000) - 60 });
  assert.equal(needsResign(expired.row, clockMs), true);
  assert.deepEqual(await relayerFor(db).submit(expired.row), { status: 'pending', code: 'attestation-expired' });
  const pending = await readSettleRow(db, expired.row.sessionId32);
  assert.deepEqual([pending.status, pending.resigns, pending.attempts, pending.lastError], ['pending', 1, 0, 'attestation-expired']);
  const calls = verify.calls.reverifyStoredRun;
  assert.deepEqual(await resignRow({ ethers, db, row: pending, verify, catalog, signer, domain, nowMs }), { ok: true, moved: true });
  assert.equal(verify.calls.reverifyStoredRun, calls + 1, 're-signing re-verified the stored evidence');
  const resigned = await readSettleRow(db, expired.row.sessionId32);
  assert.equal(resigned.status, 'signed');
  assert.equal(needsResign(resigned, clockMs), false);
  assert.equal(Number(resigned.attestation.deadline), Math.floor(clockMs / 1000) + 900);
  assert.equal((await relayerFor(db).submit(resigned)).status, 'confirmed');

  // Rejected: a verifier the registry does not trust. Three re-signs in a
  // row, then an infra wait with verifier-rejected (a rotated key needs the
  // env updated); no attempt is spent.
  const impostor = local.chain.wallets.attacker;
  const rejected = await seedSignedRow(db, { signer: impostor });
  let current = rejected.row;
  for (let round = 1; round <= 3; round += 1) {
    // eslint-disable-next-line no-await-in-loop
    assert.deepEqual(await relayerFor(db).submit(current), { status: 'pending', code: 'invalid-attestation' });
    // eslint-disable-next-line no-await-in-loop
    current = await readSettleRow(db, rejected.row.sessionId32);
    assert.equal(current.resigns, round);
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await resignRow({ ethers, db, row: current, verify, catalog, signer: impostor, domain, nowMs })).ok, true);
    // eslint-disable-next-line no-await-in-loop
    current = await readSettleRow(db, rejected.row.sessionId32);
  }
  assert.deepEqual(await relayerFor(db).submit(current), { status: 'failed', code: 'verifier-rejected' });
  const waiting = await readSettleRow(db, rejected.row.sessionId32);
  assert.deepEqual([waiting.status, waiting.lastError, waiting.attempts, waiting.infraFailures, waiting.resigns], ['failed', 'verifier-rejected', 0, 1, 0]);
  assert.ok(waiting.nextAttemptAt, 'a wait, not a dead letter');

  // The re-sign rule never trusts the stored columns: an edited score no
  // longer matches the re-verified run.
  const edited = await seedSignedRow(db);
  await db.query('UPDATE verified_sessions SET score = score + 1 WHERE session_id32 = $1', [edited.row.sessionId32]);
  const tampered = await readSettleRow(db, edited.row.sessionId32);
  assert.deepEqual(await relayerFor(db).submit(tampered), { status: 'pending', code: 'invalid-attestation' }, 'the stored digest no longer matches the columns');
  assert.deepEqual(await resignRow({ ethers, db, row: await readSettleRow(db, edited.row.sessionId32), verify, catalog, signer, domain, nowMs }), { ok: false, class: 'deterministic', code: 'stored-run-mismatch' });

  // NFT ids on re-sign: the row's nft_achievements ∩ the current catalog.
  const nft = await seedSignedRow(db, { nftIds: ['chikun-coast-legend', 'chikun-retired-nft'], deadlineSeconds: Math.floor(clockMs / 1000) + 30 });
  assert.equal(needsResign(nft.row, clockMs), true, 'a deadline inside two minutes is re-signed before any submit');
  await resignRow({ ethers, db, row: nft.row, verify, catalog, signer, domain, nowMs });
  assert.deepEqual((await readSettleRow(db, nft.row.sessionId32)).attestation.achievements32, [ethers.id('chikun-coast-legend')]);
}));

test('an underfunded relayer or a fee spike waits without signing', async () => scenario(async (db) => {
  const { row } = await seedSignedRow(db);
  const signs = [];
  const countingWallet = new Proxy(local.chain.wallets.relayer, {
    get(target, key) {
      if (key === 'signTransaction') return async (tx) => { signs.push(tx.nonce); return target.signTransaction(tx); };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const wallet = local.chain.wallets.relayer.address;
  const balance = await local.chain.provider.getBalance(wallet);
  await local.chain.setBalance(wallet, 1000n);
  assert.deepEqual(await relayerFor(db, { wallet: countingWallet }).submit(row), { status: 'failed', code: 'relayer-underfunded' });
  await local.chain.setBalance(wallet, balance);
  let current = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([current.attempts, current.infraFailures, current.lastError], [0, 1, 'relayer-underfunded']);
  await casStatus(db, { sessionId32: row.sessionId32, from: 'failed', to: 'signed', nowMs: clockMs });
  current = await readSettleRow(db, row.sessionId32);
  assert.deepEqual(await relayerFor(db, { wallet: countingWallet, reserveWei: '1' }).submit(current), { status: 'failed', code: 'fee-too-high' });
  current = await readSettleRow(db, row.sessionId32);
  assert.deepEqual([current.attempts, current.infraFailures, current.lastError], [0, 2, 'fee-too-high']);
  assert.deepEqual(signs, [], 'nothing was signed');

  // A relayer the registry does not allow waits too.
  await casStatus(db, { sessionId32: row.sessionId32, from: 'failed', to: 'signed', nowMs: clockMs });
  const stranger = relayerFor(db, { wallet: local.chain.wallets.attacker });
  assert.deepEqual(await stranger.submit(await readSettleRow(db, row.sessionId32)), { status: 'failed', code: 'relayer-not-allowed' });
}));

test('stored errors are allowlisted codes, never messages', async () => scenario(async (db) => {
  const secretUrl = 'https://user:hunter2@rpc.example/secret-key';
  const { row } = await seedSignedRow(db);
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  try {
    const provider = wrapProvider({ estimateGas: async () => { throw Object.assign(new Error(`could not coalesce error (${secretUrl})`), { code: 'UNKNOWN_ERROR', info: { error: { message: `boom at ${secretUrl}` } } }); } });
    await relayerFor(db, { provider }).submit(row);
    logSafeError('settle:test', Object.assign(new Error(`message with ${secretUrl}`), { code: 'SERVER_ERROR' }));
  } finally {
    console.error = original;
  }
  const [raw] = await db.query('SELECT row_to_json(v)::text AS text FROM verified_sessions v WHERE session_id32 = $1', [row.sessionId32]);
  assert.ok(!raw.text.includes('rpc.example') && !raw.text.includes('hunter2'), 'no raw message is stored');
  assert.equal((await readSettleRow(db, row.sessionId32)).lastError, 'rpc-unavailable');
  assert.ok(logged.every((line) => !line.includes('rpc.example') && !line.includes('hunter2')), 'logs carry the name and code only');
  assert.ok(logged.some((line) => line.includes('SERVER_ERROR')));

  // Unknown codes collapse to unknown-error, in the store and in the classifier.
  assert.equal(allowlistedCode(`boom ${secretUrl}`), 'unknown-error');
  assert.equal(await casStatus(db, { sessionId32: row.sessionId32, from: 'failed', to: 'failed', set: { last_error: `boom ${secretUrl}` }, nowMs: clockMs }), true);
  assert.equal((await readSettleRow(db, row.sessionId32)).lastError, 'unknown-error');
  await recordFailure(db, { sessionId32: row.sessionId32, class: 'wait', code: 'Some Raw Message', nowMs: clockMs });
  assert.equal((await readSettleRow(db, row.sessionId32)).lastError, 'unknown-error');
  assert.deepEqual(classifyRelayError({ reason: 'Only minter' }), { class: 'deterministic', code: 'unknown-error' });
  assert.deepEqual(classifyRelayError({ code: 'CALL_EXCEPTION', data: `0x08c379a0${ethers.AbiCoder.defaultAbiCoder().encode(['string'], ['SCORE_OUT_OF_BOUNDS']).slice(2)}` }), { class: 'deterministic', code: 'score-out-of-bounds' });
  assert.equal(decodeRevertReason({ data: `${ethers.id('ECDSAInvalidSignature()').slice(0, 10)}` }), 'ECDSAInvalidSignature');
  assert.deepEqual(classifyRelayError({ data: `${ethers.id('ECDSAInvalidSignature()').slice(0, 10)}` }), { class: 're-sign', code: 'invalid-attestation' });
  assert.deepEqual(classifyRelayError({ reason: 'GAME_NOT_PLAYABLE' }), { class: 'wait', code: 'game-not-playable' });
  assert.deepEqual(classifyRelayError({ reason: 'NOT_PLAYER_OR_RELAYER' }), { class: 'wait', code: 'relayer-not-allowed' });
  assert.deepEqual(classifyRelayError({ code: 'INSUFFICIENT_FUNDS' }), { class: 'wait', code: 'relayer-underfunded' });
  assert.deepEqual(classifyRelayError(new Error('???')), { class: 'wait', code: 'unknown-error' });
  for (const code of ERROR_CODE_ALLOWLIST) assert.match(code, /^[a-z0-9][a-z0-9_-]{1,63}$/, `${code} fits the last_error CHECK`);
  for (const [name, { code }] of Object.entries(CONTRACT_REVERTS)) {
    if (/^[A-Z_]+$/.test(name) && name !== 'NOT_PLAYER_OR_RELAYER') assert.equal(code, name.toLowerCase().replace(/_/g, '-'), name);
  }
  await assert.rejects(db.query("UPDATE verified_sessions SET last_error = 'Raw Message With Spaces' WHERE session_id32 = $1", [row.sessionId32]), (error) => error.code === '23514', 'the column CHECK backs the allowlist');
}));
