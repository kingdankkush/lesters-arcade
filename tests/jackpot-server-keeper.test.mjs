import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import { readLease } from '../server/settle/relayer.mjs';
import { createJackpotChain } from '../server/jackpot/chain.mjs';
import { JACKPOT_REVERTS, NEVER_SENT_REVERTS, allowlistedJackpotCode, classifyJackpotError, classifyJackpotRevert } from '../server/jackpot/errors.mjs';
import { FAULT_STAGES, GAS_MULTIPLIER_PERCENT, KEEPER_LEASE_MS, MIN_BROADCAST_LEASE_MS, NONCE_GAP_GUARD, createKeeper, keeperFeeFields } from '../server/jackpot/keeper.mjs';
import { actionFailureTransition, createAction, readAction, upsertRules } from '../server/jackpot/store.mjs';
import { weekKeyOfIndex } from '../server/jackpot/weeks.mjs';
import { CRON_ERROR_CODES } from '../server/ops/cron-runs.mjs';
import { createPgliteClient } from './helpers/pglite-client.mjs';
import { DAY, HOUR, bootJackpotChain } from './fixtures/jackpot-server/chain-harness.mjs';
import { ensureMigrated } from './fixtures/jackpot-server/helpers.mjs';

/**
 * jackpot-server AC8 (design §C.4 "Send protocol"): the keeper sends on the
 * in-process chain with its own lease row, estimateGas × 1.25 and the
 * LiteForge fee fields, waits on fee spikes and low balance, records the
 * transaction hash before broadcasting, recovers dropped transactions,
 * classifies every revert, and never overrides an admin decision.
 */

let h;
let db;
let clockMs;
const newId = () => ethers.hexlify(ethers.randomBytes(32)).toLowerCase();

before(async () => {
  h = await bootJackpotChain();
  db = createPgliteClient();
  await ensureMigrated(db);
  const rules = await h.jackpot.rulesAt(0);
  await upsertRules(db, { contract: h.contract, rules: { fromWeek: Number(rules.fromWeek), seasonId32: rules.seasonId, altSeasonId32: null, minPaidWei: rules.minPaidWei, maxSurvivalSeconds: Number(rules.maxSurvivalSeconds), maxScore: rules.maxScore, maxPrizeWei: rules.maxPrizeWei, minFundWei: rules.minFundWei, adminClearOnly: rules.adminClearOnly } });
  // Into week W, then two settled runs.
  await h.at(h.bounds().start + DAY);
  clockMs = (await h.now()) * 1000;
});

after(async () => {
  await db?.close();
  await h?.close();
});

function keeperWith({
  fault = null, maxTxFeeWei = '10000000000000000', wallet = null, holderId = 'test:keeper', rulesFor = null, provider = h.provider, timeoutMs = undefined, monotonicMs = undefined,
} = {}) {
  const chain = createJackpotChain({ provider, contract: h.contract, deployment: h.deployment, ...(timeoutMs ? { timeoutMs } : {}) });
  return createKeeper({
    db, provider, wallet: wallet ?? new ethers.Wallet(h.keeperKey, h.provider), chain, maxTxFeeWei, holderId, nowMs: () => clockMs,
    receiptTimeoutMs: 3_000, keeperFault: fault, rulesFor, sleep: async () => {}, ...(monotonicMs ? { monotonicMs } : {}),
  });
}

// The in-process provider with some methods replaced (spies, hung or failing RPC calls).
function wrapProvider(overrides) {
  return new Proxy(h.provider, {
    get(target, prop) {
      if (Object.hasOwn(overrides, prop)) return overrides[prop];
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
const hang = () => new Promise(() => {});

// Rising scores, so every new run enters the top 5.
async function settled(playerIndex, score = 1_000n + BigInt(playerIndex) * 10n) {
  const player = await h.player(playerIndex);
  const sessionId = newId();
  await h.settle({ player, sessionId, score });
  return { sessionId, player };
}

const action = (kind, sessionId32 = null, reason = null) => createAction(db, { contract: h.contract, weekIndex: h.W, kind, sessionId32, reason }).then((result) => result.action);

test('keeper uses its own lease row and never the relayer\'s', async () => {
  const { sessionId } = await settled(0);
  const keeper = keeperWith();
  const relayer = h.deployment.relayer;
  // The relayer's lease is held by someone else: the keeper does not care.
  await db.query("INSERT INTO relayer_lease (relayer, holder, lease_until, next_nonce) VALUES ($1, 'settle:other', now() + interval '1 hour', 99)", [relayer]);
  const submit = await action('submit', sessionId);
  const result = await keeper.send(submit);
  assert.equal(result.status, 'confirmed', JSON.stringify(result));
  assert.equal((await h.jackpot.candidatesOf(h.W))[0].sessionId, sessionId);
  const lease = await readLease(db, keeper.address);
  assert.equal(lease.holder, null, 'released');
  assert.equal(lease.nextNonce, await h.provider.getTransactionCount(keeper.address, 'latest'));
  assert.deepEqual(await readLease(db, relayer), { holder: 'settle:other', nextNonce: 99, leaseUntil: (await readLease(db, relayer)).leaseUntil }, 'the relayer row is untouched');
  const stored = await readAction(db, submit.id);
  assert.equal(stored.keeper, keeper.address);
  assert.match(stored.txHash, /^0x[0-9a-f]{64}$/);

  // The keeper's own lease is busy: nothing is sent and no attempt is spent.
  const { sessionId: other } = await settled(1);
  const busy = await action('submit', other);
  await db.query("UPDATE relayer_lease SET holder = 'jackpot:other', lease_until = now() + interval '1 hour' WHERE relayer = $1", [keeper.address]);
  const nonce = await h.provider.getTransactionCount(keeper.address, 'latest');
  assert.deepEqual(await keeper.send(busy), { status: 'pending', code: 'lease-busy' });
  assert.equal(await h.provider.getTransactionCount(keeper.address, 'latest'), nonce);
  assert.equal((await readAction(db, busy.id)).attempts, 0);
  await db.query("UPDATE relayer_lease SET holder = NULL, lease_until = 'epoch' WHERE relayer = $1", [keeper.address]);
  assert.equal((await keeper.send(busy)).status, 'confirmed');
});

test('keeper records the tx hash before broadcasting', async () => {
  const { sessionId } = await settled(2);
  const submit = await action('submit', sessionId);
  const seen = [];
  const crash = keeperWith({ fault: async (stage) => { seen.push(stage); if (stage === 'after-cas') throw Object.assign(new Error('killed'), { code: 'KILLED' }); } });
  await assert.rejects(crash.send(submit), /killed/);
  assert.deepEqual(seen, ['after-cas']);
  const recorded = await readAction(db, submit.id);
  assert.equal(recorded.status, 'submitted', 'the hash is recorded before any broadcast');
  assert.match(recorded.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(await h.provider.getTransaction(recorded.txHash), null, 'and it was never broadcast');
  assert.equal((await readLease(db, crash.address)).holder, null, 'the lease is not left behind');
  // Within 180 s the receipt check waits; after it, the chain state decides: not done → dropped.
  const keeper = keeperWith();
  assert.deepEqual(await keeper.checkSubmitted(recorded), { status: 'submitted', code: null });
  clockMs += 181_000;
  assert.deepEqual(await keeper.checkSubmitted(recorded), { status: 'signed', code: 'tx-dropped' });
  const dropped = await readAction(db, submit.id);
  assert.deepEqual([dropped.status, dropped.txHash, dropped.infraFailures, dropped.lastError], ['signed', null, 1, 'tx-dropped']);
  assert.equal((await keeper.send(dropped)).status, 'confirmed', 'the re-send runs step 0 again and lands');
  assert.deepEqual(FAULT_STAGES, ['after-cas', 'after-broadcast', 'before-receipt']);
});

test('keeper recovers a dropped transaction', async () => {
  // A crash after the broadcast: the transaction landed; the receipt check confirms it.
  const { sessionId } = await settled(3);
  const submit = await action('submit', sessionId);
  await assert.rejects(keeperWith({ fault: (stage) => { if (stage === 'after-broadcast') throw new Error('killed'); } }).send(submit), /killed/);
  const afterBroadcast = await readAction(db, submit.id);
  assert.equal(afterBroadcast.status, 'submitted');
  assert.deepEqual((await keeperWith().checkSubmitted(afterBroadcast)).status, 'confirmed');
  const lease = await readLease(db, afterBroadcast.keeper);
  assert.equal(lease.nextNonce, afterBroadcast.txNonce + 1, 'the lease kept the next nonce');

  // A crash before the receipt wait: the same.
  const clear = await action('clear', sessionId);
  await assert.rejects(keeperWith({ fault: (stage) => { if (stage === 'before-receipt') throw new Error('killed'); } }).send(clear), /killed/);
  assert.equal((await keeperWith().checkSubmitted(await readAction(db, clear.id))).status, 'confirmed');
  assert.equal(await h.jackpot.reviewOf(sessionId), 1n, 'Cleared');

  // A dropped transaction that someone else's transaction made unnecessary: confirmed, never re-sent.
  const { sessionId: other } = await settled(4);
  const submitOther = await action('submit', other);
  await assert.rejects(keeperWith({ fault: (stage) => { if (stage === 'after-cas') throw new Error('killed'); } }).send(submitOther), /killed/);
  await (await h.jackpot.connect(h.wallets.attacker).submitCandidate(other)).wait();
  clockMs += 181_000;
  assert.deepEqual(await keeperWith().checkSubmitted(await readAction(db, submitOther.id)), { status: 'confirmed', code: 'already-done' });
});

test('keeper waits on fee spikes and low balance', async () => {
  const { sessionId } = await settled(5);
  const submit = await action('submit', sessionId);
  const spike = await keeperWith({ maxTxFeeWei: '1000' }).send(submit);
  assert.deepEqual([spike.status, spike.code], ['failed', 'fee-too-high']);
  let stored = await readAction(db, submit.id);
  assert.deepEqual([stored.attempts, stored.infraFailures], [0, 1], 'a wait never spends an attempt');
  assert.equal(Date.parse(stored.nextAttemptAt) - clockMs, 60_000, 'backoff min(60 s × 2^n, 15 min)');
  // Fees: max(10 × base fee, 5 gwei), tip 0.
  assert.deepEqual(keeperFeeFields(100n), { maxFeePerGas: 5_000_000_000n, maxPriorityFeePerGas: 0n });
  assert.deepEqual(keeperFeeFields(1_000_000_000n), { maxFeePerGas: 10_000_000_000n, maxPriorityFeePerGas: 0n });

  const poor = ethers.Wallet.createRandom().connect(h.provider);
  const underfunded = await keeperWith({ wallet: poor, holderId: 'test:poor' }).send(stored);
  assert.deepEqual([underfunded.status, underfunded.code], ['failed', 'keeper-underfunded']);
  stored = await readAction(db, submit.id);
  assert.deepEqual([stored.attempts, stored.infraFailures, stored.lastError], [0, 2, 'keeper-underfunded']);
  assert.equal(Date.parse(stored.nextAttemptAt) - clockMs, 120_000);
  // The keeper's own estimate, seen through a spy on the provider.
  const estimates = [];
  const spying = wrapProvider({ estimateGas: async (request) => { const value = await h.provider.estimateGas(request); estimates.push(value); return value; } });
  const sent = await keeperWith({ provider: spying }).send(stored);
  assert.equal(sent.status, 'confirmed');
  // The transaction the keeper sent carries the LiteForge fee fields and a 1.25 × gas limit.
  const tx = await h.provider.getTransaction((await readAction(db, submit.id)).txHash);
  assert.equal(tx.maxPriorityFeePerGas, 0n);
  assert.ok(tx.maxFeePerGas >= 5_000_000_000n);
  assert.equal(estimates.length, 1, 'one estimate per send');
  assert.equal(GAS_MULTIPLIER_PERCENT, 125n);
  assert.equal(tx.gasLimit, (estimates[0] * 125n + 99n) / 100n, 'estimateGas × 1.25, rounded up');
  assert.ok(tx.gasLimit > estimates[0]);
});

test('keeper never overrides an admin decision', async () => {
  const { sessionId } = await settled(6);
  await (await h.jackpot.connect(h.wallets.attacker).submitCandidate(sessionId)).wait();
  // The admin clears; a stale keeper flag (from an earlier screen) is skipped, nothing is sent.
  await (await h.jackpot.connect(h.wallets.developer).clear(sessionId)).wait();
  const flag = await action('flag', sessionId, 'screen-hold');
  const keeper = keeperWith();
  const nonce = await h.provider.getTransactionCount(keeper.address, 'latest');
  assert.deepEqual(await keeper.send(flag), { status: 'skipped', code: 'review-locked' });
  assert.equal(await h.provider.getTransactionCount(keeper.address, 'latest'), nonce, 'no transaction');
  assert.equal(await h.jackpot.reviewOf(sessionId), 1n, 'still Cleared by the admin');

  // A keeper flag dropped in flight while the admin decided: step 0 runs again before the re-send.
  const { sessionId: second } = await settled(7);
  await (await h.jackpot.connect(h.wallets.attacker).submitCandidate(second)).wait();
  const flag2 = await action('flag', second, 'screen-hold');
  await assert.rejects(keeperWith({ fault: (stage) => { if (stage === 'after-cas') throw new Error('killed'); } }).send(flag2), /killed/);
  await (await h.jackpot.connect(h.wallets.developer).clear(second)).wait();
  clockMs += 181_000;
  assert.equal((await keeper.checkSubmitted(await readAction(db, flag2.id))).status, 'signed');
  assert.deepEqual(await keeper.send(await readAction(db, flag2.id)), { status: 'skipped', code: 'review-locked' });
  assert.equal(await h.jackpot.reviewOf(second), 1n);

  // A disqualified session: skipped; a keeper clear of a keeper flag: skipped.
  const { sessionId: third } = await settled(8);
  await (await h.jackpot.connect(h.wallets.developer).disqualify(third, false, ethers.encodeBytes32String('automation'))).wait();
  assert.deepEqual(await keeper.send(await action('clear', third)), { status: 'skipped', code: 'review-locked' });
  const { sessionId: fourth } = await settled(9);
  assert.equal((await keeper.send(await action('flag', fourth, 'screen-hold'))).status, 'confirmed');
  assert.deepEqual(await keeper.send(await action('clear', fourth)), { status: 'skipped', code: 'review-locked' });
  // adminClearOnly weeks: the keeper never clears.
  const { sessionId: fifth } = await settled(10);
  const locked = keeperWith({ rulesFor: async () => ({ adminClearOnly: true }) });
  assert.deepEqual(await locked.send(await action('clear', fifth)), { status: 'skipped', code: 'review-locked' });
});

test('revert strings map to already-done, skipped, wait and deterministic', async () => {
  const expected = {
    NOT_FOUND: ['deterministic', 'not-eligible'], NOT_VERIFIED: ['deterministic', 'not-eligible'], WRONG_GAME: ['deterministic', 'not-eligible'],
    NOT_PAID: ['deterministic', 'not-eligible'], BELOW_MIN_PAID: ['deterministic', 'not-eligible'], BEFORE_FIRST_WEEK: ['deterministic', 'not-eligible'],
    WRONG_SEASON: ['deterministic', 'not-eligible'], SURVIVAL_CAP: ['deterministic', 'not-eligible'], SCORE_CAP: ['deterministic', 'not-eligible'],
    ZERO_SCORE: ['deterministic', 'not-eligible'], STAFF_WALLET: ['deterministic', 'not-eligible'],
    SETTLED_LATE: ['skipped', 'settled-late'], WINDOW_CLOSED: ['skipped', 'window-closed'], WALLET_BLOCKED: ['skipped', 'skipped'],
    DISQUALIFIED: ['skipped', 'skipped'], NOT_BETTER: ['skipped', 'skipped'], NOT_IN_TOP: ['skipped', 'skipped'],
    ALREADY_CANDIDATE: ['already-done', 'already-done'], WEEK_SETTLED: ['already-done', 'already-done'], NOTHING_TO_CLAIM: ['already-done', 'already-done'],
    PAYOUT_NOT_DUE: ['wait', 'payout-not-due'], PAUSED: ['wait', 'jackpot-paused'], WEEK_HELD: ['wait', 'week-held'], LEADER_NOT_CLEARED: ['wait', 'leader-not-cleared'],
    REVIEW_LOCKED: ['skipped', 'review-locked'], ONLY_KEEPER: ['deterministic', 'keeper-not-authorized'], ONLY_ADMIN: ['deterministic', 'keeper-not-authorized'],
    'Only platform operator': ['deterministic', 'keeper-not-authorized'],
  };
  for (const [reason, [cls, code]] of Object.entries(expected)) assert.deepEqual(classifyJackpotRevert(reason, { kind: 'submit' }), { class: cls, code }, reason);
  assert.deepEqual(Object.keys(JACKPOT_REVERTS).sort(), Object.keys(expected).sort());
  assert.deepEqual(classifyJackpotRevert('AFTER_END', { kind: 'finalize' }), { class: 'already-done', code: 'already-done' }, 'J1: a week after the end is terminal');
  assert.deepEqual(classifyJackpotRevert('AFTER_END', { kind: 'submit' }), { class: 'deterministic', code: 'not-eligible' });
  for (const reason of NEVER_SENT_REVERTS) assert.deepEqual(classifyJackpotRevert(reason), { class: 'deterministic', code: 'unknown-error' }, reason);
  assert.ok(['BAD_RULES', 'END_FINAL', 'EMPTY_GAME_ID'].every((reason) => NEVER_SENT_REVERTS.includes(reason)));
  // Infrastructure (no revert data): wait with an allowlisted code, never the message.
  assert.deepEqual(classifyJackpotError(Object.assign(new Error('fetch failed https://rpc.example/k'), { code: 'SERVER_ERROR' })), { class: 'wait', code: 'chain-read-failed' });
  assert.deepEqual(classifyJackpotError(Object.assign(new Error('x'), { code: 'TIMEOUT' })), { class: 'wait', code: 'rpc-timeout' });
  assert.deepEqual(classifyJackpotError(Object.assign(new Error('insufficient funds for gas'), { code: 'INSUFFICIENT_FUNDS' })), { class: 'wait', code: 'keeper-underfunded' });
  assert.equal(allowlistedJackpotCode('Some RPC https://x'), 'unknown-error');
  for (const code of Object.values(expected).map(([, code]) => code)) assert.ok(CRON_ERROR_CODES.includes(code), `${code} is on the cron allowlist`);

  // Deterministic: dead after 3 attempts, backoff min(30 s × 2^n, 30 min).
  let row = { attempts: 0, infraFailures: 0 };
  const steps = [];
  for (let n = 0; n < 3; n += 1) {
    row = { ...row, ...actionFailureTransition(row, { class: 'deterministic', code: 'not-eligible', nowMs: 0 }) };
    steps.push([row.status, row.attempts, row.nextAttemptAt]);
  }
  assert.deepEqual(steps, [['failed', 1, new Date(30_000).toISOString()], ['failed', 2, new Date(60_000).toISOString()], ['dead', 3, null]]);
  const wait = actionFailureTransition({ attempts: 2, infraFailures: 9 }, { class: 'wait', code: 'rpc-timeout', nowMs: 0 });
  assert.deepEqual([wait.status, wait.attempts, wait.nextAttemptAt], ['failed', 2, new Date(15 * 60_000).toISOString()], 'waits never dead-letter and cap at 15 min');

  // On chain: a submit of an unknown session dies after three sends that never happen.
  const keeper = keeperWith();
  const ghost = await action('submit', newId());
  let current = ghost;
  for (let n = 0; n < 3; n += 1) {
    // eslint-disable-next-line no-await-in-loop
    await keeper.send(current);
    // eslint-disable-next-line no-await-in-loop
    current = await readAction(db, ghost.id);
  }
  assert.deepEqual([current.status, current.attempts, current.lastError, current.txHash], ['dead', 3, 'not-eligible', null]);

  // A finalize before payout: wait (estimateGas reverts PAYOUT_NOT_DUE); a mined revert is decoded from its receipt.
  const finalize = await action('finalize');
  const early = await keeper.send(finalize);
  assert.deepEqual([early.status, early.code], ['failed', 'payout-not-due']);
  // A reverting transaction mined anyway (a fixed gas limit, no estimate): the node rejects the
  // send with the revert, but the block holds it with status 0.
  const attacker = h.wallets.attacker;
  const raw = await attacker.signTransaction({
    type: 2, chainId: 4441, nonce: await h.provider.getTransactionCount(attacker.address, 'pending'), to: h.contract,
    data: h.jackpot.interface.encodeFunctionData('finalize', [h.W]), gasLimit: 200_000n, maxFeePerGas: 10_000_000_000n, maxPriorityFeePerGas: 0n, value: 0n,
  });
  const mined = { hash: ethers.keccak256(raw) };
  await h.provider.send('eth_sendRawTransaction', [raw]).catch(() => null);
  const receipt = await h.provider.getTransactionReceipt(mined.hash);
  assert.equal(receipt.status, 0, 'a mined revert');
  await db.query("UPDATE jackpot_actions SET status = 'submitted', tx_hash = $2, submitted_at = now() WHERE id = $1", [finalize.id, mined.hash.toLowerCase()]);
  const decoded = await keeper.checkSubmitted(await readAction(db, finalize.id));
  assert.deepEqual([decoded.status, decoded.code], ['failed', 'payout-not-due']);
  // The same receipt with a hung getTransaction: the decode read times out on its own deadline (a wait, never a verdict).
  await db.query("UPDATE jackpot_actions SET status = 'submitted', next_attempt_at = NULL WHERE id = $1", [finalize.id]);
  const stalled = keeperWith({ provider: wrapProvider({ getTransaction: () => hang() }), timeoutMs: 1_000 });
  const hungDecode = await stalled.checkSubmitted(await readAction(db, finalize.id));
  assert.deepEqual([hungDecode.status, hungDecode.code], ['failed', 'rpc-timeout']);

  // A submit after the candidate window of a never-listed session: skipped without a send.
  const { sessionId } = await settled(11);
  await h.at(h.bounds().candidateUntil + HOUR);
  const late = await keeper.send(await action('submit', sessionId));
  assert.deepEqual(late, { status: 'skipped', code: 'window-closed' });
  assert.equal(weekKeyOfIndex(h.W), (await readAction(db, ghost.id)).weekKey);
});

test('keeper guards the nonce, retries nonce errors inside the lease and keeps an ambiguous broadcast', async () => {
  // (The candidate window of week W has closed in the test above: these sends are keeper flags.)
  const keeperAddress = new ethers.Wallet(h.keeperKey).address;
  const lease = () => readLease(db, keeperAddress.toLowerCase());
  const latestNonce = () => h.provider.getTransactionCount(keeperAddress, 'latest');

  // The gap guard: a lease next_nonce more than 8 ahead of the chain is a stale lease, not a nonce to use.
  const { sessionId: first } = await settled(12);
  const latest = await latestNonce();
  await db.query('UPDATE relayer_lease SET next_nonce = $2::bigint WHERE relayer = $1', [keeperAddress.toLowerCase(), String(latest + NONCE_GAP_GUARD + 40)]);
  const guarded = await action('flag', first, 'screen-hold');
  assert.equal((await keeperWith().send(guarded)).status, 'confirmed');
  assert.equal((await readAction(db, guarded.id)).txNonce, latest, 'the pending count, not the stale lease nonce');
  assert.equal((await lease()).nextNonce, latest + 1);

  // A nonce taken by someone else between the read and the broadcast: re-read and retried inside the same lease.
  const { sessionId: second } = await settled(13);
  const racer = new ethers.Wallet(h.keeperKey, h.provider);
  let raced = 0;
  const racing = wrapProvider({
    broadcastTransaction: async (raw) => {
      if (raced === 0) {
        raced += 1;
        const parsed = ethers.Transaction.from(raw);
        await (await racer.sendTransaction({ to: racer.address, value: 0n, nonce: parsed.nonce, type: 2, gasLimit: 21_000n, maxFeePerGas: parsed.maxFeePerGas, maxPriorityFeePerGas: 0n })).wait();
        throw Object.assign(new Error('nonce too low'), { code: 'NONCE_EXPIRED' });
      }
      return h.provider.broadcastTransaction(raw);
    },
  });
  const before = await latestNonce();
  const retry = await action('flag', second, 'screen-hold');
  assert.equal((await keeperWith({ provider: racing }).send(retry)).status, 'confirmed');
  assert.deepEqual([raced, (await readAction(db, retry.id)).txNonce, (await lease()).nextNonce], [1, before + 1, before + 2]);
  assert.equal(await h.jackpot.reviewOf(second), 2n, 'Flagged');

  // An ambiguous broadcast (the node took it, the answer was lost): the hash is kept and its receipt confirms it.
  const { sessionId: third } = await settled(14);
  const lost = wrapProvider({
    broadcastTransaction: async (raw) => {
      await h.provider.broadcastTransaction(raw);
      throw Object.assign(new Error('socket hang up'), { code: 'NETWORK_ERROR' });
    },
  });
  const ambiguous = await action('flag', third, 'screen-hold');
  assert.equal((await keeperWith({ provider: lost }).send(ambiguous)).status, 'confirmed');
  assert.ok(await h.provider.getTransaction((await readAction(db, ambiguous.id)).txHash), 'the kept hash is the broadcast transaction');

  // A nonce error whose re-read hangs: the read times out on its own deadline, nothing is sent, the lease is released.
  const { sessionId: fourth } = await settled(15);
  let counts = 0;
  const stuck = wrapProvider({
    broadcastTransaction: async () => { throw Object.assign(new Error('nonce too low'), { code: 'NONCE_EXPIRED' }); },
    getTransactionCount: (address, tag) => { counts += 1; return counts > 2 ? hang() : h.provider.getTransactionCount(address, tag); },
  });
  const hung = await action('flag', fourth, 'screen-hold');
  const nonceBefore = await latestNonce();
  const timedOut = await keeperWith({ provider: stuck, timeoutMs: 1_000 }).send(hung);
  assert.deepEqual([timedOut.status, timedOut.code], ['failed', 'rpc-timeout']);
  const waiting = await readAction(db, hung.id);
  assert.deepEqual([waiting.status, waiting.txHash, waiting.attempts, waiting.infraFailures], ['failed', null, 0, 1]);
  assert.equal((await lease()).holder, null, 'the lease is released');
  assert.equal(await latestNonce(), nonceBefore);

  // The lease deadline is checked before the CAS (nothing recorded) and after it (back to signed, nothing broadcast).
  const { sessionId: fifth } = await settled(16);
  const late = await action('flag', fifth, 'screen-hold');
  let mono = 0;
  const beforeCas = await keeperWith({ monotonicMs: () => { const value = mono; mono += KEEPER_LEASE_MS - MIN_BROADCAST_LEASE_MS + 1_000; return value; } }).send(late);
  assert.deepEqual(beforeCas, { status: 'pending', code: 'lease-busy' });
  assert.deepEqual([(await readAction(db, late.id)).status, (await readAction(db, late.id)).txHash], ['pending', null]);
  let clock = 0;
  const afterCas = await keeperWith({ monotonicMs: () => clock, fault: (stage) => { if (stage === 'after-cas') clock += KEEPER_LEASE_MS - MIN_BROADCAST_LEASE_MS + 1_000; } }).send(late);
  assert.deepEqual(afterCas, { status: 'signed', code: 'lease-busy' });
  const signed = await readAction(db, late.id);
  assert.deepEqual([signed.status, signed.txHash, signed.attempts], ['signed', null, 0]);
  assert.equal(await latestNonce(), nonceBefore, 'nothing was broadcast');
  assert.equal((await keeperWith().send(signed)).status, 'confirmed');
});
