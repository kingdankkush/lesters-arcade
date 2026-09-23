// Relayed submission of verified runs (contract §3.4, A1, A31).
//
// Serialization is a Neon lease row, not an advisory lock (A1): one
// conditional UPDATE … RETURNING takes the relayer's lease for 40 s. The
// holder then populates and prices the transaction, checks the funds and fee
// caps, signs locally, records tx_hash and tx_nonce with a compare-and-set to
// submitted, broadcasts, and releases the lease with next_nonce. It never
// broadcasts with less than 5 s of lease left, retries nonce errors inside the
// lease, and waits for the receipt only after the release.
//
// Failures are classified by server/settle/errors.mjs and recorded through
// the store; nothing raw is stored or logged.

import { randomUUID } from 'node:crypto';
import { ethers } from 'ethers';
import { EVENT_TOPICS, RANKED_ENTRY_ABI, SCORE_REGISTRY_ABI } from '../chain/abis.mjs';
import { attestationMatchesRow, isAttestationRecord, runFromRow } from './attestation.mjs';
import { classifyRelayError, decodeRevertReason, isDefiniteRejection, logSafeError, nonceErrorKind } from './errors.mjs';
import { casStatus, markConfirmed, readSettleRow, recordFailure, SUBMITTED_CHECK_AFTER_MS } from './store.mjs';

export const LEASE_MS = 40_000;
export const LEASE_TRIES = 4;
export const LEASE_RETRY_MS = 750;
export const MIN_BROADCAST_LEASE_MS = 5_000;
export const RECEIPT_WAIT_MS = 15_000;
export const ENTRY_RECEIPT_WAIT_MS = 10_000;
export const NONCE_GAP_GUARD = 8;
export const MAX_NONCE_TRIES = 3;
export const FEE_CAP_MULTIPLIER = 5n;
// The ScoreSubmitted log search for a run confirmed through getSession (§3.3).
export const PUBLISH_LOG_CHUNK = 5_000;
const MAX_BISECT_STEPS = 64;

const registryIface = new ethers.Interface(SCORE_REGISTRY_ABI);
const entryIface = new ethers.Interface(RANKED_ENTRY_ABI);
const openSessionIface = new ethers.Interface(['function openSession(bytes32 sessionId, bytes32 gameId) payable']);
const ADDRESS = /^0x[0-9a-f]{40}$/;

// relayers(address) is read once per process per registry and relayer; only
// a true answer is remembered, so an operator fix is seen on the next call.
const allowedRelayers = new Set();

const iso = (ms) => new Date(Number(ms)).toISOString();
const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const defaultMonotonic = () => performance.now();

function lower(address) {
  return String(address ?? '').toLowerCase();
}

// --- Lease (§3.4 SQL) --------------------------------------------------------

export async function ensureLeaseRow(db, relayer) {
  await db.query('INSERT INTO relayer_lease (relayer) VALUES ($1) ON CONFLICT (relayer) DO NOTHING', [lower(relayer)]);
}

// → { nextNonce: number|null, leaseUntil } or null when another holder has it.
export async function acquireLease(db, { relayer, holder, leaseMs = LEASE_MS }) {
  const rows = await db.query(
    `UPDATE relayer_lease
        SET holder = $2, lease_until = now() + make_interval(secs => $3::double precision), updated_at = now()
      WHERE relayer = $1 AND (lease_until < now() OR holder = $2)
     RETURNING coalesce(next_nonce::text, '') AS next_nonce,
               to_char(lease_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS lease_until`,
    [lower(relayer), String(holder), String(leaseMs / 1000)],
  );
  if (!rows.length) return null;
  const text = rows[0].next_nonce;
  return { nextNonce: text === '' || text === null || text === undefined ? null : Number(text), leaseUntil: rows[0].lease_until };
}

export async function releaseLease(db, { relayer, holder, nextNonce }) {
  const rows = await db.query(
    `UPDATE relayer_lease SET holder = NULL, lease_until = 'epoch', next_nonce = NULLIF($3, '')::bigint, updated_at = now()
      WHERE relayer = $1 AND holder = $2 RETURNING relayer`,
    [lower(relayer), String(holder), nextNonce === null || nextNonce === undefined ? '' : String(nextNonce)],
  );
  return rows.length === 1;
}

export async function readLease(db, relayer) {
  const rows = await db.query(
    `SELECT holder, coalesce(next_nonce::text, '') AS next_nonce,
            to_char(lease_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS lease_until
       FROM relayer_lease WHERE relayer = $1`,
    [lower(relayer)],
  );
  if (!rows.length) return null;
  return { holder: rows[0].holder ?? null, nextNonce: rows[0].next_nonce === '' ? null : Number(rows[0].next_nonce), leaseUntil: rows[0].lease_until };
}

// --- Chain reads -------------------------------------------------------------

async function waitForReceiptOn(provider, txHash, timeoutMs) {
  if (!txHash) return null;
  try {
    return (await provider.waitForTransaction(txHash, 1, Math.max(1, Number(timeoutMs) || 1))) ?? null;
  } catch (error) {
    if (error?.code !== 'TIMEOUT') logSafeError('settle:receipt', error);
    return null;
  }
}

async function readSession(provider, registryAddress, sessionId32) {
  const data = registryIface.encodeFunctionData('getSession', [sessionId32]);
  const [session] = registryIface.decodeFunctionResult('getSession', await provider.call({ to: registryAddress, data }));
  return { exists: session.exists === true, player: lower(session.player), submittedAt: Number(session.submittedAt) };
}

// The chain reads of E3 (§4.3.3 step 9) and the relayer, over the server's
// own RPC. `provider` may be a function so a lazily created provider is only
// built when a read happens.
export function createChainReader({ provider, deployment }) {
  const current = () => (typeof provider === 'function' ? provider() : provider);
  const entryAddress = () => lower(deployment?.addresses?.arcadeRankedEntry);
  const registryAddress = () => lower(deployment?.addresses?.scoreSubmissionRegistry);
  return Object.freeze({
    entryAddress,
    registryAddress,
    // → { exists, player, gameId32, amountWei: bigint, openedAt: seconds }
    async getPaidSession(sessionId32) {
      const data = entryIface.encodeFunctionData('getPaidSession', [sessionId32]);
      const [paid] = entryIface.decodeFunctionResult('getPaidSession', await current().call({ to: entryAddress(), data }));
      return { exists: paid.exists === true, player: lower(paid.player), gameId32: lower(paid.gameId), amountWei: BigInt(paid.amountWei), openedAt: Number(paid.openedAt) };
    },
    // Resolves the receipt, or null when none arrives within timeoutMs.
    waitForReceipt(txHash, timeoutMs = ENTRY_RECEIPT_WAIT_MS) {
      return waitForReceiptOn(current(), txHash, timeoutMs);
    },
    // → { from, to, sessionId32|null } or null when the node does not know it.
    async getTransaction(txHash) {
      const tx = await current().getTransaction(txHash);
      if (!tx) return null;
      let sessionId32 = null;
      try {
        const parsed = openSessionIface.parseTransaction({ data: tx.data });
        if (parsed?.name === 'openSession') sessionId32 = lower(parsed.args[0]);
      } catch {
        sessionId32 = null;
      }
      return { from: lower(tx.from), to: lower(tx.to), sessionId32 };
    },
    getSession(sessionId32) {
      return readSession(current(), registryAddress(), sessionId32);
    },
  });
}

// --- The publishing transaction ---------------------------------------------

function topicAddress(topic) {
  const text = lower(topic);
  return /^0x[0-9a-f]{64}$/.test(text) ? `0x${text.slice(26)}` : null;
}

// The transaction that published a run the chain already holds (§3.3:
// getSession(id).exists ⇒ confirmed with block_number and confirmed_at = block
// time). A row confirmed this way may carry a hash that is not the publisher
// (a transaction that reverted SESSION_EXISTS, or one that never landed), so
// the publisher is read from the ScoreSubmitted log whose indexed sessionId
// is this session (session ids are unique on chain: at most one log).
//
// The search reads the chunk that ends at `hintBlock` (a race or an
// ambiguous broadcast lands there). When getSession's submittedAt is older
// than that chunk, it bisects block timestamps down to the deployment's
// start block for the first block at submittedAt and reads the chunk from
// there. → { txHash, blockNumber } | null. RPC failures throw, so the caller
// retries later instead of confirming without the facts.
export async function findPublishingTx({ provider, registryAddress, sessionId32, player = null, submittedAt = null, hintBlock = null, startBlock = 0, chunk = PUBLISH_LOG_CHUNK }) {
  const registry = lower(registryAddress);
  const key = lower(sessionId32);
  const floor = Math.max(0, Math.floor(Number(startBlock) || 0));
  const head = hintBlock === null || hintBlock === undefined ? Number(await provider.getBlockNumber()) : Number(hintBlock);
  if (!Number.isSafeInteger(head) || head < floor) return null;
  const size = Math.max(1, Math.floor(Number(chunk) || PUBLISH_LOG_CHUNK));
  const logsIn = async (fromBlock, toBlock) => {
    const logs = await provider.getLogs({ address: registry, topics: [EVENT_TOPICS.ScoreSubmitted, key], fromBlock, toBlock });
    const match = (logs ?? []).find((log) => log && !log.removed && lower(log.address) === registry
      && lower(log.topics?.[0]) === EVENT_TOPICS.ScoreSubmitted && lower(log.topics?.[1]) === key
      && (!player || topicAddress(log.topics?.[2]) === lower(player)));
    return match ? { txHash: lower(match.transactionHash), blockNumber: Number(match.blockNumber) } : null;
  };
  const nearFrom = Math.max(floor, head - size + 1);
  const near = await logsIn(nearFrom, head);
  if (near || nearFrom === floor) return near;
  const target = Number(submittedAt);
  if (!Number.isFinite(target) || target <= 0) return null;
  const timestampOf = async (blockNumber) => {
    const block = await provider.getBlock(blockNumber);
    if (!block || !Number.isFinite(Number(block.timestamp))) throw Object.assign(new Error('block unavailable'), { code: 'SERVER_ERROR' });
    return Number(block.timestamp);
  };
  // Timestamps never decrease: when the chunk already read starts before
  // submittedAt, it held the publishing block, and there was no log.
  if (await timestampOf(nearFrom) < target) return null;
  let lo = floor;
  let hi = nearFrom - 1;
  if (await timestampOf(hi) < target) return null;
  for (let step = 0; step < MAX_BISECT_STEPS && lo < hi; step += 1) {
    const mid = Math.floor((lo + hi) / 2);
    // eslint-disable-next-line no-await-in-loop
    if (await timestampOf(mid) < target) lo = mid + 1;
    else hi = mid;
  }
  return logsIn(lo, Math.min(nearFrom - 1, lo + size - 1));
}

// --- Receipts ----------------------------------------------------------------

async function blockTimeMs(provider, blockNumber, fallbackMs) {
  try {
    const block = await provider.getBlock(blockNumber);
    if (block && Number.isFinite(Number(block.timestamp))) return Number(block.timestamp) * 1000;
  } catch (error) {
    logSafeError('settle:block', error);
  }
  return fallbackMs;
}

// Confirms a run the chain already holds for this player with the facts of
// the transaction that published it: `ownReceipt` when that is a successful
// receipt of the row's own transaction, else the ScoreSubmitted log
// (findPublishingTx). A publisher that cannot be found clears the stored
// hash (a wrong explorer link is worse than none). A failed log read confirms
// nothing and returns null, so the caller leaves the row for the next check.
async function confirmFromChain({ db, provider, registryAddress, row, session, nowMs, from, hintBlock = null, startBlock = 0, ownReceipt = null }) {
  let facts;
  if (ownReceipt && Number(ownReceipt.status) === 1) {
    facts = { txHash: lower(ownReceipt.hash ?? row.txHash), blockNumber: Number(ownReceipt.blockNumber) };
  } else {
    try {
      facts = await findPublishingTx({ provider, registryAddress, sessionId32: row.sessionId32, player: row.wallet, submittedAt: session.submittedAt, hintBlock, startBlock });
    } catch (error) {
      logSafeError('settle:publisher', error);
      return null;
    }
  }
  await markConfirmed(db, {
    sessionId32: row.sessionId32,
    txHash: facts?.txHash ?? null,
    blockNumber: facts?.blockNumber ?? null,
    confirmedAtMs: session.submittedAt * 1000,
    nowMs: nowMs(),
    from,
  });
  return { status: 'confirmed', code: null };
}

// SESSION_EXISTS, or a revert on a session that the chain already holds: the
// run is confirmed when getSession shows it for this player (§3.3 "already
// done"); otherwise the rejection is deterministic.
async function settleExistingSession({ db, provider, registryAddress, row, nowMs, from, startBlock = 0 }) {
  let session;
  try {
    session = await readSession(provider, registryAddress, row.sessionId32);
  } catch (error) {
    const failure = classifyRelayError(error);
    const updated = await recordFailure(db, { sessionId32: row.sessionId32, class: failure.class === 'already-done' ? 'wait' : failure.class, code: failure.code, nowMs: nowMs(), from });
    return { status: updated?.status ?? row.status, code: updated?.lastError ?? failure.code };
  }
  if (session.exists && session.player === row.wallet) {
    let ownReceipt = null;
    if (row.txHash) {
      try {
        ownReceipt = await provider.getTransactionReceipt(row.txHash);
      } catch {
        ownReceipt = null;
      }
    }
    const confirmed = await confirmFromChain({ db, provider, registryAddress, row, session, nowMs, from, startBlock, ownReceipt });
    if (confirmed) return confirmed;
    const updated = await recordFailure(db, { sessionId32: row.sessionId32, class: 'wait', code: 'rpc-unavailable', nowMs: nowMs(), from });
    return { status: updated?.status ?? row.status, code: updated?.lastError ?? 'rpc-unavailable' };
  }
  const updated = await recordFailure(db, { sessionId32: row.sessionId32, class: 'deterministic', code: 'session-exists', nowMs: nowMs(), from });
  return { status: updated?.status ?? row.status, code: updated?.lastError ?? 'session-exists' };
}

// Applies a mined receipt to a submitted row (§3.3): status 1 → confirmed
// with the block facts; status 0 → confirmed when getSession already holds
// the run, else classified by the decoded revert.
export async function applyReceipt({ db, provider, registryAddress, row, receipt, nowMs, startBlock = 0 }) {
  const clock = typeof nowMs === 'function' ? nowMs : () => Number(nowMs);
  if (receipt.status === 1) {
    const confirmedAtMs = await blockTimeMs(provider, receipt.blockNumber, clock());
    const moved = await markConfirmed(db, { sessionId32: row.sessionId32, txHash: receipt.hash ?? row.txHash, blockNumber: receipt.blockNumber, confirmedAtMs, nowMs: clock(), from: ['submitted'] });
    return { status: moved ? 'confirmed' : (await readSettleRow(db, row.sessionId32))?.status ?? 'confirmed', code: null };
  }
  let session = null;
  try {
    session = await readSession(provider, registryAddress, row.sessionId32);
  } catch {
    session = null;
  }
  if (session?.exists && session.player === row.wallet) {
    // This transaction reverted (SESSION_EXISTS): another one published the
    // run at or before this receipt's block.
    const confirmed = await confirmFromChain({ db, provider, registryAddress, row, session, nowMs: clock, from: ['submitted'], hintBlock: Number(receipt.blockNumber), startBlock });
    return confirmed ?? { status: 'submitted', code: 'rpc-unavailable' };
  }
  // Re-run the call at the receipt's block to decode the revert.
  let failure = { class: 'wait', code: 'unknown-error' };
  try {
    const tx = await provider.getTransaction(receipt.hash ?? row.txHash);
    if (tx) {
      await provider.call({ from: tx.from, to: tx.to, data: tx.data, blockTag: receipt.blockNumber });
    }
  } catch (error) {
    failure = classifyRelayError(error);
  }
  if (failure.class === 'already-done') failure = { class: 'deterministic', code: 'session-exists' };
  const updated = await recordFailure(db, { sessionId32: row.sessionId32, class: failure.class, code: failure.code, nowMs: clock(), from: ['submitted'] });
  return { status: updated?.status ?? (await readSettleRow(db, row.sessionId32))?.status ?? 'submitted', code: updated?.lastError ?? failure.code };
}

// E4's throttled receipt check (§4.3.4): read-only apart from applying a
// receipt that exists. It never resubmits and never applies the dropped rule
// (that needs the relayer's lease; the cron does it).
export async function checkSubmittedRow({ db, provider, registryAddress, row, nowMs, startBlock = 0 }) {
  if (row?.status !== 'submitted' || !row.txHash) return { status: row?.status ?? null, code: null };
  const receipt = await provider.getTransactionReceipt(row.txHash);
  if (!receipt) return { status: 'submitted', code: null };
  return applyReceipt({ db, provider, registryAddress, row, receipt, nowMs, startBlock });
}

// --- The relayer -------------------------------------------------------------

export function createRelayer({
  db,
  provider,
  wallet,
  registryAddress,
  reserveWei,
  leaseMs = LEASE_MS,
  holderId = `${process.env.VERCEL_REGION ?? 'local'}:${randomUUID()}`,
  nowMs = Date.now,
  chainId = 4441,
  sleep = defaultSleep,
  monotonicMs = defaultMonotonic,
  receiptTimeoutMs = RECEIPT_WAIT_MS,
  droppedAfterMs = SUBMITTED_CHECK_AFTER_MS,
  startBlock = 0,
} = {}) {
  if (!db || typeof db.query !== 'function') throw new TypeError('createRelayer needs db');
  if (!provider) throw new TypeError('createRelayer needs provider');
  if (!wallet || typeof wallet.signTransaction !== 'function' || !ADDRESS.test(lower(wallet.address))) throw new TypeError('createRelayer needs a wallet');
  const registry = lower(registryAddress);
  if (!ADDRESS.test(registry)) throw new TypeError('createRelayer needs the score registry address');
  const reserve = BigInt(reserveWei ?? 0);
  if (reserve <= 0n) throw new TypeError('createRelayer needs settlementGasReserveWei');
  const address = lower(wallet.address);
  const clock = typeof nowMs === 'function' ? nowMs : () => Number(nowMs);
  const domain = { name: "Lester's Arcade Ranked Settlement", version: '2', chainId: Number(chainId), verifyingContract: registry };

  async function fail(row, failure, from = ['signed']) {
    if (failure.class === 'already-done') return settleExistingSession({ db, provider, registryAddress: registry, row, nowMs: clock, from, startBlock });
    const updated = await recordFailure(db, { sessionId32: row.sessionId32, class: failure.class, code: failure.code, nowMs: clock(), from });
    if (updated) return { status: updated.status, code: updated.lastError ?? failure.code };
    return { status: (await readSettleRow(db, row.sessionId32))?.status ?? row.status, code: failure.code };
  }

  async function relayerAllowed() {
    const key = `${chainId}:${registry}:${address}`;
    if (allowedRelayers.has(key)) return true;
    const data = registryIface.encodeFunctionData('relayers', [address]);
    const [allowed] = registryIface.decodeFunctionResult('relayers', await provider.call({ to: registry, data }));
    if (allowed === true) allowedRelayers.add(key);
    return allowed === true;
  }

  async function takeLease(relayerAddress = address) {
    await ensureLeaseRow(db, relayerAddress);
    for (let attempt = 0; attempt < LEASE_TRIES; attempt += 1) {
      const startedAt = monotonicMs();
      // eslint-disable-next-line no-await-in-loop
      const lease = await acquireLease(db, { relayer: relayerAddress, holder: holderId, leaseMs });
      if (lease) return { ...lease, deadline: startedAt + leaseMs };
      // eslint-disable-next-line no-await-in-loop
      if (attempt < LEASE_TRIES - 1) await sleep(LEASE_RETRY_MS);
    }
    return null;
  }

  async function waitForReceipt(txHash, timeoutMs = receiptTimeoutMs) {
    return waitForReceiptOn(provider, txHash, timeoutMs);
  }

  // One submission attempt for a signed row (§3.4). → { status, code, txHash? }
  async function submit(row, { receiptTimeoutMs: waitMs = receiptTimeoutMs } = {}) {
    if (row?.status !== 'signed') return { status: row?.status ?? null, code: null };
    if (!isAttestationRecord(row.attestation) || !attestationMatchesRow(ethers, row, domain)) return fail(row, { class: 're-sign', code: 'invalid-attestation' });
    let built;
    try {
      built = runFromRow(ethers, row);
    } catch {
      return fail(row, { class: 'deterministic', code: 'stored-run-mismatch' });
    }
    try {
      if (!(await relayerAllowed())) return fail(row, { class: 'wait', code: 'relayer-not-allowed' });
    } catch (error) {
      return fail(row, classifyRelayError(error));
    }

    const lease = await takeLease();
    if (!lease) return { status: 'signed', code: 'lease-busy' };
    const leaseLeft = () => lease.deadline - monotonicMs();
    let nextNonce = lease.nextNonce;
    let broadcastHash = null;
    let outcome = null;
    try {
      const data = registryIface.encodeFunctionData('submitVerifiedSession', [built.run, [...built.achievements32], row.attestation.signature]);
      let estimate;
      try {
        estimate = await provider.estimateGas({ from: wallet.address, to: registry, data });
      } catch (error) {
        outcome = await fail(row, classifyRelayError(error, { decodeRevert: decodeRevertReason }));
        return outcome;
      }
      const gasLimit = (BigInt(estimate) * 125n + 99n) / 100n;
      let fee;
      let balance;
      let pendingCount;
      let latestCount;
      try {
        [fee, balance, pendingCount, latestCount] = await Promise.all([
          provider.getFeeData(),
          provider.getBalance(wallet.address),
          provider.getTransactionCount(wallet.address, 'pending'),
          provider.getTransactionCount(wallet.address, 'latest'),
        ]);
      } catch (error) {
        outcome = await fail(row, classifyRelayError(error));
        return outcome;
      }
      const eip1559 = fee?.maxFeePerGas !== null && fee?.maxFeePerGas !== undefined;
      const maxFee = eip1559 ? BigInt(fee.maxFeePerGas) : (fee?.gasPrice === null || fee?.gasPrice === undefined ? null : BigInt(fee.gasPrice));
      if (maxFee === null) {
        outcome = await fail(row, { class: 'wait', code: 'rpc-unavailable' });
        return outcome;
      }
      // Funds and fee caps, before signing (§3.4). Neither spends an attempt.
      const cost = gasLimit * maxFee;
      if (cost > FEE_CAP_MULTIPLIER * reserve) {
        outcome = await fail(row, { class: 'wait', code: 'fee-too-high' });
        return outcome;
      }
      if (BigInt(balance) < cost) {
        outcome = await fail(row, { class: 'wait', code: 'relayer-underfunded' });
        return outcome;
      }
      // Nonce choice with the gap guard.
      let nonce = Math.max(Number(pendingCount), nextNonce ?? 0);
      if (nextNonce !== null && nextNonce > Number(latestCount) + NONCE_GAP_GUARD) nonce = Number(pendingCount);
      let tooHighRetried = false;
      for (let attempt = 0; attempt < MAX_NONCE_TRIES && !broadcastHash; attempt += 1) {
        const tx = {
          type: eip1559 ? 2 : 0,
          chainId: Number(chainId),
          nonce,
          to: registry,
          data,
          value: 0n,
          gasLimit,
          ...(eip1559 ? { maxFeePerGas: maxFee, maxPriorityFeePerGas: BigInt(fee.maxPriorityFeePerGas ?? 0n) } : { gasPrice: maxFee }),
        };
        // eslint-disable-next-line no-await-in-loop
        const raw = await wallet.signTransaction(tx);
        const txHash = ethers.keccak256(raw).toLowerCase();
        if (leaseLeft() < MIN_BROADCAST_LEASE_MS) {
          outcome = { status: 'signed', code: 'lease-busy' };
          return outcome;
        }
        // Record the hash before the broadcast (§3.4 step 6).
        // eslint-disable-next-line no-await-in-loop
        const moved = await casStatus(db, { sessionId32: row.sessionId32, from: 'signed', to: 'submitted', set: { tx_hash: txHash, tx_nonce: nonce, relayer: address, submitted_at: clock(), last_checked_at: null }, nowMs: clock() });
        if (!moved) {
          // Someone else moved the row; nothing was broadcast.
          // eslint-disable-next-line no-await-in-loop
          outcome = { status: (await readSettleRow(db, row.sessionId32))?.status ?? null, code: null };
          return outcome;
        }
        if (leaseLeft() < MIN_BROADCAST_LEASE_MS) {
          // eslint-disable-next-line no-await-in-loop
          await casStatus(db, { sessionId32: row.sessionId32, from: 'submitted', to: 'signed', set: { tx_hash: null, tx_nonce: null, submitted_at: null }, nowMs: clock() });
          outcome = { status: 'signed', code: 'lease-busy' };
          return outcome;
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          await provider.broadcastTransaction(raw);
          broadcastHash = txHash;
          nextNonce = nonce + 1;
        } catch (error) {
          const kind = nonceErrorKind(error);
          if (!kind && !isDefiniteRejection(error)) {
            // Ambiguous (timeout, transport): the node may hold the
            // transaction. Keep the row submitted with its hash; the receipt
            // check and the dropped-transaction rule resolve it.
            broadcastHash = txHash;
            nextNonce = nonce + 1;
            break;
          }
          // The node rejected it, so it is not in the mempool: back to signed.
          // eslint-disable-next-line no-await-in-loop
          await casStatus(db, { sessionId32: row.sessionId32, from: 'submitted', to: 'signed', set: { tx_hash: null, tx_nonce: null, submitted_at: null }, nowMs: clock() });
          if (kind === 'too-low') {
            // eslint-disable-next-line no-await-in-loop
            nonce = Math.max(nonce + 1, Number(await provider.getTransactionCount(wallet.address, 'pending')));
            continue;
          }
          if (kind === 'too-high' && !tooHighRetried) {
            tooHighRetried = true;
            // eslint-disable-next-line no-await-in-loop
            nonce = Number(await provider.getTransactionCount(wallet.address, 'latest'));
            continue;
          }
          if (kind === 'replacement') {
            nonce += 1;
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          outcome = await fail(row, kind ? { class: 'wait', code: 'nonce-conflict' } : classifyRelayError(error));
          return outcome;
        }
      }
      if (!broadcastHash) {
        outcome = await fail(row, { class: 'wait', code: 'nonce-conflict' });
        return outcome;
      }
    } catch (error) {
      // An unexpected fault (the database, the signer): leave the row for the
      // cron and report the wait class without recording a raw message.
      logSafeError('settle:relayer', error);
      if (!broadcastHash) {
        const current = await readSettleRow(db, row.sessionId32).catch(() => null);
        if (current?.status === 'submitted' && current.txHash && !broadcastHash) {
          await casStatus(db, { sessionId32: row.sessionId32, from: 'submitted', to: 'signed', set: { tx_hash: null, tx_nonce: null, submitted_at: null }, nowMs: clock() }).catch(() => false);
        }
        outcome = await fail(row, classifyRelayError(error)).catch(() => ({ status: 'signed', code: 'unknown-error' }));
        return outcome;
      }
    } finally {
      // Release with next_nonce = last used + 1, or the old value when nothing
      // was broadcast (§3.4).
      await releaseLease(db, { relayer: address, holder: holderId, nextNonce }).catch((error) => logSafeError('settle:lease', error));
    }

    // Receipt wait after the release.
    const receipt = await waitForReceipt(broadcastHash, waitMs);
    const current = await readSettleRow(db, row.sessionId32);
    if (!receipt || current?.status !== 'submitted') return { status: current?.status ?? 'submitted', code: null, txHash: broadcastHash };
    const applied = await applyReceipt({ db, provider, registryAddress: registry, row: current, receipt, nowMs: clock, startBlock });
    return { ...applied, txHash: broadcastHash };
  }

  // Receipt check for a submitted row (§3.3): confirmed, classified, or,
  // with no receipt 180 s after submitted_at and no on-chain session, the
  // dropped-transaction rule: back to signed and next_nonce reset to the
  // latest count under the lease.
  async function checkReceipt(row) {
    if (row?.status !== 'submitted' || !row.txHash) return { status: row?.status ?? null, code: null };
    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(row.txHash);
    } catch (error) {
      return { status: 'submitted', code: classifyRelayError(error).code };
    }
    if (receipt) return applyReceipt({ db, provider, registryAddress: registry, row, receipt, nowMs: clock, startBlock });
    const submittedAt = Date.parse(row.submittedAt ?? '');
    if (Number.isFinite(submittedAt) && clock() - submittedAt < droppedAfterMs) return { status: 'submitted', code: null };
    let session;
    try {
      session = await readSession(provider, registry, row.sessionId32);
    } catch (error) {
      return { status: 'submitted', code: classifyRelayError(error).code };
    }
    if (session.exists && session.player === row.wallet) {
      // Another transaction published the run; this one never landed.
      const confirmed = await confirmFromChain({ db, provider, registryAddress: registry, row, session, nowMs: clock, from: ['submitted'], startBlock });
      return confirmed ?? { status: 'submitted', code: 'rpc-unavailable' };
    }
    // Dropped. The lease row belongs to the relayer that sent it.
    const sender = ADDRESS.test(lower(row.relayer)) ? lower(row.relayer) : address;
    const lease = sender === address ? await takeLease(sender) : null;
    if (sender === address && !lease) return { status: 'submitted', code: 'lease-busy' };
    let resetNonce = lease?.nextNonce ?? null;
    try {
      if (lease) resetNonce = Number(await provider.getTransactionCount(wallet.address, 'latest'));
      const moved = await casStatus(db, {
        sessionId32: row.sessionId32,
        from: 'submitted',
        to: 'signed',
        set: { tx_hash: null, tx_nonce: null, submitted_at: null, last_error: 'dropped-tx' },
        increment: { infra_failures: 1 },
        nowMs: clock(),
      });
      return { status: moved ? 'signed' : (await readSettleRow(db, row.sessionId32))?.status ?? null, code: 'dropped-tx' };
    } catch (error) {
      return { status: 'submitted', code: classifyRelayError(error).code };
    } finally {
      if (lease) await releaseLease(db, { relayer: sender, holder: holderId, nextNonce: resetNonce }).catch((error) => logSafeError('settle:lease', error));
    }
  }

  return Object.freeze({ address, holderId, submit, checkReceipt, waitForReceipt });
}

// Forgets the once-per-process relayers() answers (tests only).
export function resetRelayerAllowanceCache() {
  allowedRelayers.clear();
}

export { iso as isoTime };
