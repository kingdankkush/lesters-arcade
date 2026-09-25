// The jackpot keeper's send protocol (design §C.4 "Send protocol", J9).
//
// It copies the reference protocol of the settle relayer (createRelayer().submit,
// server/settle/relayer.mjs), against jackpot_actions instead of
// verified_sessions (the relayer's submit is hard-wired to that table):
//
//   0. Pre-send idempotency and authority read. submit: already in
//      candidatesOf(w), or checkEligibility answers ALREADY_CANDIDATE (any other
//      eligibility reason is classified without sending). clear/flag: reviewOf
//      is already the target → confirmed 'already-done'; adminReviewed, or
//      Disqualified → 'skipped' with 'review-locked': an admin decision is
//      terminal for the keeper (a stale screen, a re-signed dropped transaction
//      or a rescreen never overrides it). finalize: weekState(w) is not Open,
//      or w is after a scheduled end → 'already-done'. Step 0 runs before EVERY
//      send, including the re-send of a dropped transaction.
//   1. Its own lease row (the keeper address) through the exported
//      ensureLeaseRow / acquireLease / releaseLease; never the relayer's.
//   2. estimateGas × 1.25.
//   3. maxFeePerGas = max(10 × latest base fee, 5 gwei), tip 0 (LiteForge
//      charges only the base fee). gasLimit × maxFee over JACKPOT_MAX_TX_FEE_WEI
//      → wait 'fee-too-high'; a balance under it → wait 'keeper-underfunded'.
//   4. Nonce = max(pending, lease.next_nonce), gap guard 8.
//   5. Sign locally; txHash = keccak256(raw); CAS pending|signed|failed →
//      submitted with tx_hash and tx_nonce BEFORE broadcasting, with the lease
//      checked before and after.
//   6. Broadcast; nonce errors retry inside the lease; an ambiguous transport
//      failure keeps the hash as broadcast. Every RPC call has its own
//      timeout, the nonce re-reads of a retry and the revert decode's
//      getTransaction included: a hung node never holds the lease or the run
//      past its budget (a timed-out re-read is a wait, nothing is sent).
//   7. Release the lease with nextNonce, then wait up to 15 s for the receipt.
//   8. Success → confirmed; a revert → decoded and classified (errors.mjs);
//      no receipt 180 s after submitted_at → the chain state is read: done →
//      confirmed, otherwise dropped → back to 'signed' with next_nonce reset
//      under the lease.
//
// Test seam (J2 → J3, never read from env): deps.keeperFault(stage) is called
// at 'after-cas', 'after-broadcast' and 'before-receipt'; a test makes it
// throw to simulate a killed cron (rehearsal R10). It defaults to a no-op.

import { ethers } from 'ethers';
import { acquireLease, ensureLeaseRow, releaseLease } from '../settle/relayer.mjs';
import { isDefiniteRejection, logSafeError, nonceErrorKind } from '../settle/errors.mjs';
import { jackpotIface } from './chain.mjs';
import { classifyJackpotError, classifyJackpotRevert } from './errors.mjs';
import { casAction, readAction, recordActionFailure } from './store.mjs';
import { weekIndexOfKey } from './weeks.mjs';

export const KEEPER_LEASE_MS = 40_000;
export const KEEPER_LEASE_TRIES = 4;
export const KEEPER_LEASE_RETRY_MS = 750;
export const MIN_BROADCAST_LEASE_MS = 5_000;
export const RECEIPT_WAIT_MS = 15_000;
export const DROPPED_AFTER_MS = 180_000;
export const NONCE_GAP_GUARD = 8;
export const MAX_NONCE_TRIES = 3;
export const GAS_MULTIPLIER_PERCENT = 125n;
export const BASE_FEE_MULTIPLIER = 10n;
export const MIN_MAX_FEE_WEI = 5_000_000_000n; // 5 gwei
export const FAULT_STAGES = Object.freeze(['after-cas', 'after-broadcast', 'before-receipt']);

const iso = (ms) => new Date(Number(ms)).toISOString();
const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const defaultMonotonic = () => performance.now();

// The fee fields of a keeper transaction (design §C.4 step 3).
export function keeperFeeFields(baseFeePerGas) {
  const base = BigInt(baseFeePerGas ?? 0);
  const tenfold = base * BASE_FEE_MULTIPLIER;
  return { maxFeePerGas: tenfold > MIN_MAX_FEE_WEI ? tenfold : MIN_MAX_FEE_WEI, maxPriorityFeePerGas: 0n };
}

function encodeAction(action) {
  const week = weekIndexOfKey(action.weekKey);
  switch (action.kind) {
    case 'submit': return jackpotIface.encodeFunctionData('submitCandidate', [action.sessionId32]);
    case 'clear': return jackpotIface.encodeFunctionData('clear', [action.sessionId32]);
    case 'flag': return jackpotIface.encodeFunctionData('flag', [action.sessionId32, ethers.encodeBytes32String(action.reason ?? 'screen-hold')]);
    case 'finalize': return jackpotIface.encodeFunctionData('finalize', [week]);
    default: throw new TypeError(`unknown action kind ${action.kind}`);
  }
}

// Step 0. → null (go ahead) or { class, code } (settle without sending).
//   rulesFor(weekIndex) → { adminClearOnly } | null (the jackpot_rules mirror)
export async function preSendCheck({ chain, action, rulesFor = null }) {
  const week = weekIndexOfKey(action.weekKey);
  const session = action.sessionId32;
  if (action.kind === 'submit') {
    const list = await chain.candidatesOf(week);
    if (list.some((row) => row.sessionId32 === session)) return { class: 'already-done', code: 'already-done' };
    const check = await chain.checkEligibility(session);
    if (check.ok) return null;
    return classifyJackpotRevert(check.reason, { kind: 'submit' });
  }
  if (action.kind === 'clear' || action.kind === 'flag') {
    const [review, adminReviewed] = await Promise.all([chain.reviewOf(session), chain.adminReviewed(session)]);
    const target = action.kind === 'clear' ? 'cleared' : 'flagged';
    if (review === target) return { class: 'already-done', code: 'already-done' };
    if (adminReviewed || review === 'disqualified') return { class: 'skipped', code: 'review-locked' };
    if (action.kind === 'clear') {
      if (review === 'flagged') return { class: 'skipped', code: 'review-locked' };
      const rules = typeof rulesFor === 'function' ? await rulesFor(week) : null;
      if (rules?.adminClearOnly) return { class: 'skipped', code: 'review-locked' };
      if (await chain.paused()) return { class: 'wait', code: 'jackpot-paused' };
    }
    return null;
  }
  if (action.kind === 'finalize') {
    const end = await chain.endAfterWeek();
    if (end !== 0 && week > end) return { class: 'already-done', code: 'already-done' };
    const state = await chain.weekState(week);
    if (state.status !== 'open') return { class: 'already-done', code: 'already-done' };
    return null;
  }
  return { class: 'deterministic', code: 'unknown-error' };
}

export function createKeeper({
  db,
  provider,
  wallet,
  chain,
  maxTxFeeWei,
  rulesFor = null,
  holderId = `${process.env.VERCEL_REGION ?? 'local'}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  nowMs = Date.now,
  chainId = 4441,
  sleep = defaultSleep,
  monotonicMs = defaultMonotonic,
  receiptTimeoutMs = RECEIPT_WAIT_MS,
  droppedAfterMs = DROPPED_AFTER_MS,
  leaseMs = KEEPER_LEASE_MS,
  keeperFault = null,
} = {}) {
  if (!db || typeof db.query !== 'function') throw new TypeError('createKeeper needs db');
  if (!provider) throw new TypeError('createKeeper needs provider');
  if (!wallet || typeof wallet.signTransaction !== 'function') throw new TypeError('createKeeper needs the keeper wallet');
  if (!chain?.address) throw new TypeError('createKeeper needs the jackpot chain reader');
  const clock = typeof nowMs === 'function' ? nowMs : () => Number(nowMs);
  const address = String(wallet.address).toLowerCase();
  const to = chain.address;
  const feeCap = BigInt(maxTxFeeWei ?? 0);
  const fault = async (stage) => {
    if (typeof keeperFault === 'function') await keeperFault(stage);
  };

  async function settleWithoutSending(action, outcome, from) {
    const updated = await recordActionFailure(db, { id: action.id, class: outcome.class, code: outcome.code, nowMs: clock(), from });
    const current = updated ?? await readAction(db, action.id);
    return { status: current?.status ?? action.status, code: current?.lastError ?? outcome.code };
  }

  async function takeLease() {
    await ensureLeaseRow(db, address);
    for (let attempt = 0; attempt < KEEPER_LEASE_TRIES; attempt += 1) {
      const startedAt = monotonicMs();
      // eslint-disable-next-line no-await-in-loop
      const lease = await acquireLease(db, { relayer: address, holder: holderId, leaseMs });
      if (lease) return { ...lease, deadline: startedAt + leaseMs };
      // eslint-disable-next-line no-await-in-loop
      if (attempt < KEEPER_LEASE_TRIES - 1) await sleep(KEEPER_LEASE_RETRY_MS);
    }
    return null;
  }

  async function waitForReceipt(txHash, timeoutMs) {
    try {
      return (await provider.waitForTransaction(txHash, 1, Math.max(1, Number(timeoutMs) || 1))) ?? null;
    } catch (error) {
      if (error?.code !== 'TIMEOUT') logSafeError('jackpot:receipt', error);
      return null;
    }
  }

  // A mined receipt of a submitted action (step 8).
  async function applyReceipt(action, receipt) {
    if (Number(receipt.status) === 1) {
      const moved = await casAction(db, { id: action.id, from: ['submitted'], to: 'confirmed', set: { confirmed_at: clock(), next_attempt_at: null, last_error: null } });
      return { status: moved ? 'confirmed' : (await readAction(db, action.id))?.status ?? 'confirmed', code: null, txHash: action.txHash };
    }
    let failure = { class: 'wait', code: 'unknown-error' };
    try {
      const tx = await chain.withTimeout(() => provider.getTransaction(receipt.hash ?? action.txHash), 'getTransaction');
      if (tx) await chain.withTimeout(() => provider.call({ from: tx.from, to: tx.to, data: tx.data, blockTag: receipt.blockNumber }), 'replay-call');
    } catch (error) {
      failure = classifyJackpotError(error, { kind: action.kind });
    }
    const updated = await recordActionFailure(db, { id: action.id, class: failure.class, code: failure.code, nowMs: clock(), from: ['submitted'] });
    return { status: updated?.status ?? (await readAction(db, action.id))?.status ?? 'submitted', code: updated?.lastError ?? failure.code, txHash: action.txHash };
  }

  // One send of a pending, signed or due failed action. → { status, code, txHash? }
  async function send(action, { receiptTimeoutMs: waitMs = receiptTimeoutMs } = {}) {
    if (!['pending', 'signed', 'failed'].includes(action?.status)) return { status: action?.status ?? null, code: null };
    const from = [action.status];
    // 0. Idempotency and authority, before every send.
    let pre;
    try {
      pre = await preSendCheck({ chain, action, rulesFor });
    } catch (error) {
      return settleWithoutSending(action, classifyJackpotError(error, { kind: action.kind }), from);
    }
    if (pre) return settleWithoutSending(action, pre, from);

    let data;
    try {
      data = encodeAction(action);
    } catch {
      return settleWithoutSending(action, { class: 'deterministic', code: 'unknown-error' }, from);
    }
    const lease = await takeLease();
    if (!lease) return { status: action.status, code: 'lease-busy' };
    const leaseLeft = () => lease.deadline - monotonicMs();
    let nextNonce = lease.nextNonce;
    let broadcastHash = null;
    let outcome = null;
    try {
      let estimate;
      try {
        estimate = await chain.withTimeout(() => provider.estimateGas({ from: wallet.address, to, data }), 'estimateGas');
      } catch (error) {
        outcome = await settleWithoutSending(action, classifyJackpotError(error, { kind: action.kind }), from);
        return outcome;
      }
      const gasLimit = (BigInt(estimate) * GAS_MULTIPLIER_PERCENT + 99n) / 100n;
      let block;
      let balance;
      let pendingCount;
      let latestCount;
      try {
        [block, balance, pendingCount, latestCount] = await Promise.all([
          chain.withTimeout(() => provider.getBlock('latest'), 'getBlock'),
          chain.withTimeout(() => provider.getBalance(wallet.address), 'getBalance'),
          chain.withTimeout(() => provider.getTransactionCount(wallet.address, 'pending'), 'nonce'),
          chain.withTimeout(() => provider.getTransactionCount(wallet.address, 'latest'), 'nonce'),
        ]);
      } catch (error) {
        outcome = await settleWithoutSending(action, classifyJackpotError(error, { kind: action.kind }), from);
        return outcome;
      }
      const fees = keeperFeeFields(block?.baseFeePerGas ?? 0n);
      const cost = gasLimit * fees.maxFeePerGas;
      if (feeCap > 0n && cost > feeCap) {
        outcome = await settleWithoutSending(action, { class: 'wait', code: 'fee-too-high' }, from);
        return outcome;
      }
      if (BigInt(balance) < cost) {
        outcome = await settleWithoutSending(action, { class: 'wait', code: 'keeper-underfunded' }, from);
        return outcome;
      }
      let nonce = Math.max(Number(pendingCount), nextNonce ?? 0);
      if (nextNonce !== null && nextNonce > Number(latestCount) + NONCE_GAP_GUARD) nonce = Number(pendingCount);
      let tooHighRetried = false;
      let expected = from;
      for (let attempt = 0; attempt < MAX_NONCE_TRIES && !broadcastHash; attempt += 1) {
        const tx = { type: 2, chainId: Number(chainId), nonce, to, data, value: 0n, gasLimit, ...fees };
        // eslint-disable-next-line no-await-in-loop
        const raw = await wallet.signTransaction(tx);
        const txHash = ethers.keccak256(raw).toLowerCase();
        if (leaseLeft() < MIN_BROADCAST_LEASE_MS) {
          outcome = { status: action.status, code: 'lease-busy' };
          return outcome;
        }
        // 5. Record the hash before the broadcast.
        // eslint-disable-next-line no-await-in-loop
        const moved = await casAction(db, { id: action.id, from: expected, to: 'submitted', set: { tx_hash: txHash, tx_nonce: nonce, keeper: address, submitted_at: clock(), next_attempt_at: null } });
        if (!moved) {
          // eslint-disable-next-line no-await-in-loop
          outcome = { status: (await readAction(db, action.id))?.status ?? null, code: null };
          return outcome;
        }
        // eslint-disable-next-line no-await-in-loop
        await fault('after-cas');
        if (leaseLeft() < MIN_BROADCAST_LEASE_MS) {
          // eslint-disable-next-line no-await-in-loop
          await casAction(db, { id: action.id, from: ['submitted'], to: 'signed', set: { tx_hash: null, tx_nonce: null, submitted_at: null } });
          outcome = { status: 'signed', code: 'lease-busy' };
          return outcome;
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          await chain.withTimeout(() => provider.broadcastTransaction(raw), 'broadcast');
          broadcastHash = txHash;
          nextNonce = nonce + 1;
        } catch (error) {
          const kind = nonceErrorKind(error);
          if (!kind && !isDefiniteRejection(error)) {
            // Ambiguous (timeout, transport): the node may hold it. Keep the
            // action submitted with its hash; the receipt check resolves it.
            broadcastHash = txHash;
            nextNonce = nonce + 1;
            break;
          }
          // eslint-disable-next-line no-await-in-loop
          await casAction(db, { id: action.id, from: ['submitted'], to: 'signed', set: { tx_hash: null, tx_nonce: null, submitted_at: null } });
          expected = ['signed'];
          if (kind === 'too-low' || (kind === 'too-high' && !tooHighRetried)) {
            // The retry inside the lease re-reads the nonce, under its own
            // timeout like every other RPC call: a hung node must not hold the
            // lease and the run past its budget.
            let count;
            try {
              // eslint-disable-next-line no-await-in-loop
              count = Number(await chain.withTimeout(() => provider.getTransactionCount(wallet.address, kind === 'too-low' ? 'pending' : 'latest'), 'nonce'));
            } catch (readError) {
              // eslint-disable-next-line no-await-in-loop
              outcome = await settleWithoutSending({ ...action, status: 'signed' }, classifyJackpotError(readError, { kind: action.kind }), ['signed']);
              return outcome;
            }
            if (kind === 'too-low') nonce = Math.max(nonce + 1, count);
            else {
              tooHighRetried = true;
              nonce = count;
            }
            continue;
          }
          if (kind === 'replacement') {
            nonce += 1;
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          outcome = await settleWithoutSending({ ...action, status: 'signed' }, kind ? { class: 'wait', code: 'nonce-conflict' } : classifyJackpotError(error, { kind: action.kind }), ['signed']);
          return outcome;
        }
      }
      if (!broadcastHash) {
        outcome = await settleWithoutSending({ ...action, status: 'signed' }, { class: 'wait', code: 'nonce-conflict' }, ['signed']);
        return outcome;
      }
      await fault('after-broadcast');
    } finally {
      await releaseLease(db, { relayer: address, holder: holderId, nextNonce }).catch((error) => logSafeError('jackpot:lease', error));
    }

    await fault('before-receipt');
    const receipt = await waitForReceipt(broadcastHash, waitMs);
    const current = await readAction(db, action.id);
    if (!receipt || current?.status !== 'submitted') return { status: current?.status ?? 'submitted', code: null, txHash: broadcastHash };
    return applyReceipt(current, receipt);
  }

  // Receipt check of a submitted action (step 8): applied when mined; with no
  // receipt 180 s after submitted_at, the chain state decides between
  // confirmed (someone did it) and dropped (back to signed, nonce reset).
  async function checkSubmitted(action) {
    if (action?.status !== 'submitted' || !action.txHash) return { status: action?.status ?? null, code: null };
    let receipt;
    try {
      receipt = await chain.withTimeout(() => provider.getTransactionReceipt(action.txHash), 'receipt');
    } catch (error) {
      return { status: 'submitted', code: classifyJackpotError(error, { kind: action.kind }).code };
    }
    if (receipt) return applyReceipt(action, receipt);
    const submittedAt = Date.parse(action.submittedAt ?? '');
    if (Number.isFinite(submittedAt) && clock() - submittedAt < droppedAfterMs) return { status: 'submitted', code: null };
    let pre;
    try {
      pre = await preSendCheck({ chain, action, rulesFor });
    } catch (error) {
      return { status: 'submitted', code: classifyJackpotError(error, { kind: action.kind }).code };
    }
    if (pre?.class === 'already-done') {
      const moved = await casAction(db, { id: action.id, from: ['submitted'], to: 'confirmed', set: { confirmed_at: clock(), last_error: 'already-done' } });
      return { status: moved ? 'confirmed' : (await readAction(db, action.id))?.status ?? null, code: 'already-done' };
    }
    // Dropped. Reset next_nonce to the latest count under the keeper's lease.
    const lease = await takeLease();
    if (!lease) return { status: 'submitted', code: 'lease-busy' };
    let resetNonce = lease.nextNonce;
    try {
      resetNonce = Number(await chain.withTimeout(() => provider.getTransactionCount(wallet.address, 'latest'), 'nonce'));
      const moved = await casAction(db, {
        id: action.id, from: ['submitted'], to: 'signed',
        set: { tx_hash: null, tx_nonce: null, submitted_at: null, last_error: 'tx-dropped' }, increment: { infra_failures: 1 },
      });
      return { status: moved ? 'signed' : (await readAction(db, action.id))?.status ?? null, code: 'tx-dropped' };
    } catch (error) {
      return { status: 'submitted', code: classifyJackpotError(error, { kind: action.kind }).code };
    } finally {
      await releaseLease(db, { relayer: address, holder: holderId, nextNonce: resetNonce }).catch((error) => logSafeError('jackpot:lease', error));
    }
  }

  return Object.freeze({ address, holderId, send, checkSubmitted });
}

export { iso as isoTime };
