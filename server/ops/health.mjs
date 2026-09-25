// The Ranked health report behind GET /api/health (ops-health AC1).
//
// One public JSON document with only aggregate, non-secret facts: whether
// settlement is configured (a boolean, never the list of missing variables),
// the relayer's public address, balance and allowance, an estimate of how many
// settles that balance still pays for, the settle queue by status, the chain
// index lag, the last outcome of each cron, and the latest base fee.
//
// Every read has a short deadline. A part that cannot be read (no database
// configured, a Neon or RPC failure, a timeout, a head block with no base fee)
// reports null for its fields, is named in `degradedParts`, and sets
// `degraded: true`; the report itself is always produced, so the endpoint
// never answers 500 because a dependency is down.
//
// `ok` is the API envelope flag, as on every other endpoint: true on every
// report, false only on an error body. `healthy` is the one boolean for an
// uptime monitor: settlement is configured and not paused, every part was
// read, the relayer is allowed on the registry and can pay for at least one
// more settle. Judgement thresholds (settles left under 50, queue age, index
// lag, cron failures) stay the owner page's warnings. Both keep HTTP 200.
//
// Nothing here reads a secret: the relayer address is the deployment's public
// one (scripts/vercel-secrets.mjs refuses a relayer key for any other
// address), and chain reads go through the server's public provider.

import { ethers } from 'ethers';
import { SITE_VERSION } from '../../apps/portal/src/version-tracking.mjs';
import { SCORE_REGISTRY_ABI, WEEKLY_JACKPOT_ABI } from '../chain/abis.mjs';
import { INDEXER_STREAM } from '../indexer/index-chain.mjs';
import { ensureSchema } from '../neon/migrations.mjs';
import { CRON_NAMES, readCronRuns } from './cron-runs.mjs';

export const HEALTH_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60';
// Gas one submitVerifiedSession is budgeted at for the settles-left estimate
// (balance / (475k gas x base fee), rounded down). The relayer refuses to send
// unless it holds gasLimit x maxFeePerGas (about twice the base fee plus the
// tip, server/settle/relayer.mjs), so settles stop a little before the
// estimate reaches 0; the owner page says so.
export const SETTLE_GAS_ESTIMATE = 475_000n;
// Each part's read deadline. The two parts run in parallel, and even run back
// to back they stay well inside vercel.json's maxDuration for api/health.mjs
// (15 s), so a hung read is a degraded 200, never a 504
// (tests/vercel-routing.test.mjs pins this).
export const HEALTH_DB_TIMEOUT_MS = 4_000;
export const HEALTH_CHAIN_TIMEOUT_MS = 4_000;
// Dead letters verified this recently can still be requeued
// (server/settle/store.mjs requeueDeadLetters, the D10 stale window).
export const REQUEUE_WINDOW_DAYS = 7;
// The fixed vocabulary of degradedParts. 'jackpot' is the Chikun Weekly
// Jackpot part (jackpot-server, design §C.4 "Health and status page").
export const HEALTH_PARTS = Object.freeze(['database', 'queue', 'index-cursor', 'crons', 'chain-head', 'relayer-address', 'relayer-balance', 'relayer-allowed', 'jackpot']);

const registryIface = new ethers.Interface(SCORE_REGISTRY_ABI);
const jackpotIface = new ethers.Interface(WEEKLY_JACKPOT_ABI);
const ADDRESS = /^0x[0-9a-f]{40}$/;
const CRON_KEYS = Object.freeze({ indexChain: CRON_NAMES.indexChain, settleRetry: CRON_NAMES.settleRetry, weeklyJackpot: CRON_NAMES.weeklyJackpot });
const EMPTY_CRON = Object.freeze({ lastOkAt: null, lastErrorAt: null, lastErrorCode: null, runs: 0, failures: 0 });
const UNKNOWN_CRON = Object.freeze({ lastOkAt: null, lastErrorAt: null, lastErrorCode: null, runs: null, failures: null });

function lowerAddress(value) {
  const text = String(value ?? '').toLowerCase();
  return ADDRESS.test(text) ? text : null;
}

function clockOf(deps) {
  return typeof deps?.nowMs === 'function' ? deps.nowMs : () => Number(deps?.nowMs ?? Date.now());
}

// Races run() against a deadline. The losing read is abandoned, never awaited.
function withDeadline(run, ms) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('health read timed out'), { code: 'TIMEOUT' })), Math.max(1, ms));
  });
  return Promise.race([Promise.resolve().then(run), timeout]).finally(() => clearTimeout(timer));
}

async function settle(run, ms) {
  try {
    return { ok: true, value: await withDeadline(run, ms) };
  } catch {
    return { ok: false, value: null };
  }
}

function nonNegativeInt(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

// Settle queue counts by status (§3.3): failed rows that will retry are
// `failed`, dead letters (failed with no next attempt) are `dead`, and
// `deadRequeueable` is the part of `dead` that scripts/requeue-dead-letters.mjs
// can still requeue (source 'settle', verified in the last 7 days; older ones
// are permanent, so only these are worth a warning). The oldest unconfirmed
// row is the oldest one still being worked on (dead letters wait for the
// operator and are counted, not aged). One statement, on the vs_queue partial
// index; int4 and text columns only (A15).
export async function readQueueHealth(db, { nowMs }) {
  const rows = await db.query(
    `SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending,
            count(*) FILTER (WHERE status = 'signed')::int AS signed,
            count(*) FILTER (WHERE status = 'submitted')::int AS submitted,
            count(*) FILTER (WHERE status = 'failed' AND next_attempt_at IS NOT NULL)::int AS failed,
            count(*) FILTER (WHERE status = 'failed' AND next_attempt_at IS NULL)::int AS dead,
            count(*) FILTER (WHERE status = 'failed' AND next_attempt_at IS NULL AND source = 'settle'
                             AND verified_at >= $1::timestamptz - interval '${REQUEUE_WINDOW_DAYS} days')::int AS dead_requeueable,
            coalesce(floor(extract(epoch FROM ($1::timestamptz
                 - min(verified_at) FILTER (WHERE status <> 'failed' OR next_attempt_at IS NOT NULL))))::bigint::text, '') AS oldest_age_seconds
       FROM verified_sessions
      WHERE status IN ('pending', 'signed', 'submitted', 'failed')`,
    [new Date(Number(nowMs)).toISOString()],
  );
  const row = rows[0] ?? {};
  const age = row.oldest_age_seconds === '' || row.oldest_age_seconds === null || row.oldest_age_seconds === undefined ? null : Math.max(0, Number(row.oldest_age_seconds));
  return {
    pending: nonNegativeInt(row.pending) ?? 0,
    signed: nonNegativeInt(row.signed) ?? 0,
    submitted: nonNegativeInt(row.submitted) ?? 0,
    failed: nonNegativeInt(row.failed) ?? 0,
    dead: nonNegativeInt(row.dead) ?? 0,
    deadRequeueable: nonNegativeInt(row.dead_requeueable) ?? 0,
    oldestUnconfirmedAgeSeconds: Number.isFinite(age) ? age : null,
  };
}

// The jackpot weeks that need the owner (every instance): awaiting the admin
// (with the oldest wait in hours), claim-pending and failed. One statement,
// int4 columns only (A15).
export async function readJackpotWeekHealth(db, { nowMs }) {
  const rows = await db.query(
    `SELECT count(*) FILTER (WHERE status = 'awaiting-admin')::int AS awaiting_admin,
            coalesce(floor(extract(epoch FROM ($1::timestamptz - min(admin_waiting_since) FILTER (WHERE status = 'awaiting-admin'))) / 3600)::int, -1) AS oldest_hours,
            count(*) FILTER (WHERE status = 'claim-pending')::int AS claim_pending,
            count(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM jackpot_weeks`,
    [new Date(Number(nowMs)).toISOString()],
  );
  const row = rows[0] ?? {};
  const oldest = Number(row.oldest_hours ?? -1);
  return {
    awaitingAdmin: nonNegativeInt(row.awaiting_admin) ?? 0,
    awaitingAdminOldestHours: oldest >= 0 ? oldest : null,
    claimPending: nonNegativeInt(row.claim_pending) ?? 0,
    failed: nonNegativeInt(row.failed) ?? 0,
  };
}

// The indexer's cursor (last indexed block), or null before its first chunk.
export async function readIndexCursor(db) {
  const rows = await db.query('SELECT last_block::text AS last_block FROM indexer_state WHERE stream = $1', [INDEXER_STREAM]);
  return rows.length ? nonNegativeInt(rows[0].last_block) : null;
}

async function readDatabasePart(db, { nowMs, deadlineMs }) {
  const failed = { queue: null, cursor: { ok: false, value: null }, crons: null, jackpotWeeks: null, parts: ['queue', 'index-cursor', 'crons', 'jackpot'] };
  if (!db) return { ...failed, parts: ['database', ...failed.parts] };
  const started = Date.now();
  const left = () => deadlineMs - (Date.now() - started);
  const schema = await settle(() => ensureSchema(db), left());
  if (!schema.ok) return failed;
  const [queue, cursor, crons, jackpotWeeks] = await Promise.all([
    settle(() => readQueueHealth(db, { nowMs }), left()),
    settle(() => readIndexCursor(db), left()),
    settle(() => readCronRuns(db), left()),
    settle(() => readJackpotWeekHealth(db, { nowMs }), left()),
  ]);
  const parts = [];
  if (!queue.ok) parts.push('queue');
  if (!cursor.ok) parts.push('index-cursor');
  if (!crons.ok) parts.push('crons');
  if (!jackpotWeeks.ok) parts.push('jackpot');
  return { queue: queue.ok ? queue.value : null, cursor, crons: crons.ok ? crons.value : null, jackpotWeeks: jackpotWeeks.ok ? jackpotWeeks.value : null, parts };
}

// The jackpot's chain facts: the keeper's zkLTC balance and the on-chain
// pause (admin or operator). Read only when the jackpot is configured.
async function readJackpotChainPart(deps, { deadlineMs }) {
  const jackpot = deps?.config?.jackpot;
  if (!jackpot?.ready) return { keeperAddress: null, balance: { ok: true, value: null }, paused: { ok: true, value: null }, parts: [] };
  let keeperAddress = null;
  try {
    keeperAddress = jackpot.keeper.address(ethers);
  } catch {
    keeperAddress = null;
  }
  let provider = null;
  try {
    provider = deps.provider;
  } catch {
    provider = null;
  }
  if (!provider || !keeperAddress) return { keeperAddress, balance: { ok: false, value: null }, paused: { ok: false, value: null }, parts: ['jackpot'] };
  const [balance, paused] = await Promise.all([
    settle(() => provider.getBalance(keeperAddress), deadlineMs),
    settle(async () => {
      const [value] = jackpotIface.decodeFunctionResult('paused', await provider.call({ to: jackpot.contract.address, data: jackpotIface.encodeFunctionData('paused', []) }));
      return value === true;
    }, deadlineMs),
  ]);
  return { keeperAddress, balance, paused, parts: balance.ok && paused.ok ? [] : ['jackpot'] };
}

async function readChainPart(deps, { relayer, registry, deadlineMs }) {
  let provider = null;
  try {
    provider = deps.provider;
  } catch {
    provider = null;
  }
  if (!provider) {
    const missing = { ok: false, value: null };
    const parts = ['chain-head', ...(relayer ? ['relayer-balance'] : []), ...(relayer && registry ? ['relayer-allowed'] : [])];
    return { head: missing, balance: missing, allowed: missing, parts };
  }
  const [head, balance, allowed] = await Promise.all([
    settle(() => provider.getBlock('latest'), deadlineMs),
    relayer ? settle(() => provider.getBalance(relayer), deadlineMs) : { ok: false, value: null },
    relayer && registry
      ? settle(async () => {
        const data = registryIface.encodeFunctionData('relayers', [relayer]);
        const [value] = registryIface.decodeFunctionResult('relayers', await provider.call({ to: registry, data }));
        return value === true;
      }, deadlineMs)
      : { ok: false, value: null },
  ]);
  const parts = [];
  if (!head.ok || !head.value) parts.push('chain-head');
  if (relayer && !balance.ok) parts.push('relayer-balance');
  if (relayer && registry && !allowed.ok) parts.push('relayer-allowed');
  return { head: head.ok && head.value ? head : { ok: false, value: null }, balance, allowed, parts };
}

function bigintOrNull(value) {
  try {
    if (value === null || value === undefined) return null;
    const big = BigInt(value);
    return big >= 0n ? big : null;
  } catch {
    return null;
  }
}

function cronView(runs, key) {
  if (runs === null) return { ...UNKNOWN_CRON };
  const row = runs[CRON_KEYS[key]];
  return row ? { lastOkAt: row.lastOkAt, lastErrorAt: row.lastErrorAt, lastErrorCode: row.lastErrorCode, runs: row.runs, failures: row.failures } : { ...EMPTY_CRON };
}

// → the public health document (ops-health AC1).
export async function collectHealth(deps, { dbTimeoutMs = HEALTH_DB_TIMEOUT_MS, chainTimeoutMs = HEALTH_CHAIN_TIMEOUT_MS } = {}) {
  const clock = clockOf(deps);
  const nowMs = clock();
  const config = deps?.config ?? {};
  const deployment = deps?.deployment ?? {};
  const relayer = deployment.status === 'deployed' ? lowerAddress(deployment.relayer) : null;
  const registry = deployment.status === 'deployed' ? lowerAddress(deployment.addresses?.scoreSubmissionRegistry) : null;

  const [database, chain, jackpotChain] = await Promise.all([
    readDatabasePart(deps?.db ?? null, { nowMs, deadlineMs: dbTimeoutMs }),
    readChainPart(deps, { relayer, registry, deadlineMs: chainTimeoutMs }),
    readJackpotChainPart(deps, { deadlineMs: chainTimeoutMs }),
  ]);

  const block = chain.head.value;
  const headBlock = block ? nonNegativeInt(block.number) : null;
  const baseFee = block ? bigintOrNull(block.baseFeePerGas) : null;
  const balance = chain.balance.ok ? bigintOrNull(chain.balance.value) : null;
  const cursorBlock = database.cursor.ok ? database.cursor.value : null;
  const settlesLeft = balance !== null && baseFee !== null && baseFee > 0n ? balance / (SETTLE_GAS_ESTIMATE * baseFee) : null;
  // With no estimate (a zero base fee) only an empty balance is known to stop settles.
  const funded = balance !== null && (settlesLeft !== null ? settlesLeft > 0n : balance > 0n);
  const allowed = chain.allowed.ok ? chain.allowed.value === true : null;

  // A readable head without a base fee is a failed base-fee read.
  const degradedParts = [...(relayer ? [] : ['relayer-address']), ...database.parts, ...chain.parts, ...jackpotChain.parts, ...(block && baseFee === null ? ['chain-head'] : [])];
  const ordered = HEALTH_PARTS.filter((part) => degradedParts.includes(part));
  const settlementReady = config.settlementReady === true;
  const paused = config.paused === true;
  return {
    ok: true,
    healthy: settlementReady && !paused && ordered.length === 0 && allowed === true && funded,
    version: SITE_VERSION,
    checkedAt: new Date(nowMs).toISOString(),
    settlementReady,
    paused,
    degraded: ordered.length > 0,
    degradedParts: ordered,
    relayer: {
      address: relayer,
      balanceWei: balance === null ? null : balance.toString(),
      allowed,
      estimatedSettlesLeft: settlesLeft === null ? null : Number(settlesLeft),
    },
    queue: database.queue ?? { pending: null, signed: null, submitted: null, failed: null, dead: null, deadRequeueable: null, oldestUnconfirmedAgeSeconds: null },
    index: {
      cursorBlock,
      headBlock,
      lagBlocks: cursorBlock !== null && headBlock !== null ? Math.max(0, headBlock - cursorBlock) : null,
    },
    crons: {
      indexChain: cronView(database.crons, 'indexChain'),
      settleRetry: cronView(database.crons, 'settleRetry'),
      weeklyJackpot: cronView(database.crons, 'weeklyJackpot'),
    },
    baseFeeGwei: baseFee === null ? null : Number(ethers.formatUnits(baseFee, 'gwei')),
    // The Chikun Weekly Jackpot (design §C.4): null when a read failed (then
    // 'jackpot' is in degradedParts), never a 500.
    jackpot: ordered.includes('jackpot') ? null : {
      configured: config.jackpot?.ready === true,
      keeperAddress: jackpotChain.keeperAddress,
      keeperBalanceWei: jackpotChain.balance.value === null ? null : String(jackpotChain.balance.value),
      paused: { env: config.jackpot?.paused === true, onChain: jackpotChain.paused.value },
      uiHidden: config.jackpot?.uiHidden === true,
      awaitingAdmin: database.jackpotWeeks.awaitingAdmin,
      awaitingAdminOldestHours: database.jackpotWeeks.awaitingAdminOldestHours,
      claimPending: database.jackpotWeeks.claimPending,
      failed: database.jackpotWeeks.failed,
    },
  };
}
