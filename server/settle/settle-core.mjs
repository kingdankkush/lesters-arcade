// E3 POST /api/settle and E4 GET /api/settle/status (contract §4.3.3,
// §4.3.4, §4.4, A4, A9, A17, A20, A25-A28, A30, A31).
//
// settleRequest runs the §4.3.3 pipeline in order, cheapest checks first,
// stopping at the first failure. Nothing expensive (replay, signing,
// broadcast) runs until the entry is proven paid (security review S4):
//
//    1 auth and 2 pause, config and modules (the adapter's auth hook runs
//      both before the body is read; direct callers get the same checks)
//    3 body (read by the adapter, 1.8 MB cap)
//    4 rate limits               5 retry body
//    6 shape                     7 identity binding (no chain read)
//    8 existing row              9 paid entry (the server's own RPC)
//   10 ticket freshness         11 history and the HMH hero gate
//   12 verify                   13 run timing
//   14 achievements             15 insert (one CTE)
//   16 sign                     17 submit (lease, broadcast, receipt wait)
//   18 the owner SettleResponse
//
// Every dependency is injected (deps = { config, db, verify, chain, relayer,
// nowMs, catalog, heroGates, crypto, provider, deployment }), so tests run
// without Vercel or the network. attachSettleDeps builds the production set.

import * as nodeCrypto from 'node:crypto';
import { ethers } from 'ethers';
import { ipBucket } from '../http.mjs';
import { authenticateBearer, bearerAuthHook, optionalBearerWallet } from '../auth/bearer.mjs';
import { ensureSchema } from '../neon/migrations.mjs';
import { periodKeysFor } from '../neon/period-keys.mjs';
import { readAchievementHistory } from '../neon/queries.mjs';
import { hitRateLimit, rateLimitedResult } from '../neon/rate-limit.mjs';
import { explorerUrlFor, INDEX_GAMES, normalizeSessionId32, shareIdFor } from '../neon/rows.mjs';
import {
  attestationDeadlineFor, attestationDomain, attestationRecord, MAX_NFT_ACHIEVEMENTS, needsResign, resignRow, signVerifiedRun,
} from './attestation.mjs';
import { logSafeError } from './errors.mjs';
import { checkSubmittedRow, createChainReader, createRelayer, ENTRY_RECEIPT_WAIT_MS } from './relayer.mjs';
import {
  casStatus, insertSettleRow, isDeadLetter, isRetryableRow, readSessionAchievements, readSettleRow, recordFailure, retryAllowed,
  settleInsertParams, touchLastChecked,
} from './store.mjs';

export const RANKED_SETTLE_VERSION = 'lesters-ranked-settle-v1';
export const SETTLE_BODY_MAX_BYTES = 1_800_000;
export const SETTLE_LIMITS = Object.freeze({ wallet: 120, ip: 240, retryWallet: 240, windowSeconds: 3600 });
export const STATUS_LIMITS = Object.freeze({ ip: 1200, windowSeconds: 3600 });
export const STATUS_RECEIPT_THROTTLE_MS = 3000;
export const ENTRY_PENDING_RETRY_MS = 5000;
export const TICKET_EARLY_SECONDS = 120;
export const TICKET_LATE_SECONDS = 1800;
export const RUN_EARLY_SLACK_SECONDS = 30;
export const RUN_STALE_SECONDS = 7 * 24 * 60 * 60;
export const MAX_CLAIM_SCORE = 1e12;
// Used only when SESSION_SECRET is absent (E4 serves without it).
const UNKEYED_IP_BUCKET_SALT = 'lestersarcade-ip-bucket-unkeyed';
const EVIDENCE_KEYS = Object.freeze({
  chikun: Object.freeze({ encoding: 'chikun-flap-evidence-v6+json', required: ['flap'], allowed: ['encoding', 'flap'] }),
  stacked: Object.freeze({ encoding: 'stacked-sic1+base64', required: ['sic1', 'startLevel'], allowed: ['encoding', 'sic1', 'startLevel'] }),
  'lester-blaster': Object.freeze({ encoding: 'hmh-run-summary-v6+json', required: ['runSummary', 'sessionEnvelope'], allowed: ['encoding', 'runSummary', 'sessionEnvelope'] }),
});
const BODY_KEYS = new Set(['v', 'gameId', 'sessionId32', 'identity', 'seedTicket', 'entryTxHash', 'evidence', 'claim']);
const RETRY_KEYS = ['retry', 'sessionId32', 'v'];
const HEX32 = /^0x[0-9a-f]{64}$/;
const FLAG_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FLAG_SEVERITIES = new Set(['reject', 'flag']);
export const MAX_RESPONSE_FLAGS = 32;
// Failed rows whose last error is about the attestation are re-signed (with
// re-verification) before their next submission (§3.3 failed → signed).
const RESIGN_BEFORE_RETRY = new Set(['attestation-expired', 'invalid-attestation', 'verifier-rejected', 'stored-run-mismatch']);

const NO_STORE = Object.freeze({ 'Cache-Control': 'no-store' });
const json = (status, body, headers = {}) => ({ status, body, headers: { ...NO_STORE, ...headers } });
const fail = (status, error, extra = {}) => json(status, { ok: false, error, ...extra });
const retryableFail = (status, error, retryAfterMs, extra = {}) => fail(status, error, { retryable: true, retryAfterMs, ...extra });

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function lower(value) {
  return String(value ?? '').toLowerCase();
}

function clockOf(deps) {
  return typeof deps.nowMs === 'function' ? deps.nowMs : () => Number(deps.nowMs ?? Date.now());
}

// The lowest block a ScoreSubmitted log search reads: the deployment's start
// block, else INDEX_START_BLOCK (as the indexer), else 0.
function logStartBlock(deps) {
  const block = Number(deps?.deployment?.startBlock ?? deps?.config?.indexStartBlock ?? 0);
  return Number.isSafeInteger(block) && block > 0 ? block : 0;
}

// --- Gates -------------------------------------------------------------------

function missingDetail(config) {
  return [...(config?.missing ?? [])].join(',').slice(0, 240);
}

// §4.3.3 step 2 (also E13, E15): pause first, then the fail-closed config
// (A28: the detail lists variable NAMES only, never values).
export function settlementGate(deps) {
  const config = deps?.config;
  if (!config) return fail(503, 'settlement-not-configured');
  if (config.paused) return fail(503, 'settlement-paused');
  if (!config.settlementReady) {
    const missing = [...config.missing];
    if (missing.length === 1 && missing[0] === 'address-mismatch') return fail(503, 'address-mismatch', { detail: 'RANKED_SCORE_REGISTRY_ADDRESS differs from LITVM_DEPLOYMENT' });
    return fail(503, 'settlement-not-configured', { detail: missingDetail(config) });
  }
  if (!deps.db) return fail(503, 'settlement-not-configured', { detail: 'NEON_DATABASE_URL' });
  return null;
}

// The verify and achievements modules must have loaded (a deployment that
// cannot load them fails closed). E15 runs the same
// check, so a player is stopped before paying for a run E3 could not settle.
export function moduleGate(deps) {
  const verify = deps.verify;
  if (!verify || ['bindRankedIdentity', 'verifyRankedRun', 'computeEvidenceDigest', 'reverifyStoredRun'].some((name) => typeof verify[name] !== 'function')) {
    return fail(503, 'settlement-not-configured', { detail: 'verify-unavailable' });
  }
  const catalog = deps.catalog;
  if (!catalog || ['deriveEarnedAchievements', 'historyFieldsFor', 'nftAchievementIds', 'achievementById'].some((name) => typeof catalog[name] !== 'function')) {
    return fail(503, 'settlement-not-configured', { detail: 'achievements-unavailable' });
  }
  return null;
}

// The makeHandler auth hook of E3 (A30, §4.3.3 steps 1-2): the Bearer, then
// the pause, the config and the modules, all before the body is read, so a
// paused or unready service answers 503 whatever the body is.
export function settleAuthHook() {
  const bearer = bearerAuthHook();
  return async function settleAuth(request, deps) {
    return (await bearer(request, deps)) ?? settlementGate(deps) ?? moduleGate(deps);
  };
}

async function limitedBy(db, bucket, limit, nowMs) {
  const hit = await hitRateLimit(db, { bucket, limit, windowSeconds: SETTLE_LIMITS.windowSeconds, nowMs });
  return hit.ok ? null : rateLimitedResult(hit.retryAfterSeconds);
}

// --- Body shape (§5.1) --------------------------------------------------------

function isRetryBody(body) {
  return isPlainObject(body) && body.retry === true;
}

function validRetryBody(body) {
  return Object.keys(body).sort().join(',') === RETRY_KEYS.join(',') && body.v === RANKED_SETTLE_VERSION && HEX32.test(String(body.sessionId32 ?? ''));
}

export function validateSettleBody(body) {
  if (!isPlainObject(body)) return { ok: false, error: 'invalid-body' };
  if (Object.keys(body).some((key) => !BODY_KEYS.has(key))) return { ok: false, error: 'invalid-body' };
  if (body.v !== RANKED_SETTLE_VERSION) return { ok: false, error: 'invalid-body' };
  if (!Object.hasOwn(INDEX_GAMES, body.gameId)) return { ok: false, error: 'invalid-body' };
  if (!HEX32.test(String(body.sessionId32 ?? ''))) return { ok: false, error: 'invalid-body' };
  if (!isPlainObject(body.identity) || !isPlainObject(body.seedTicket)) return { ok: false, error: 'invalid-body' };
  if (body.entryTxHash !== undefined && body.entryTxHash !== null && !HEX32.test(String(body.entryTxHash))) return { ok: false, error: 'invalid-body' };
  if (body.claim !== undefined) {
    const claim = body.claim;
    if (!isPlainObject(claim) || Object.keys(claim).join(',') !== 'score' || !Number.isSafeInteger(claim.score) || claim.score < 0 || claim.score > MAX_CLAIM_SCORE) return { ok: false, error: 'invalid-body' };
  }
  const spec = EVIDENCE_KEYS[body.gameId];
  const evidence = body.evidence;
  if (!isPlainObject(evidence) || evidence.encoding !== spec.encoding) return { ok: false, error: 'invalid-evidence' };
  if (Object.keys(evidence).some((key) => !spec.allowed.includes(key)) || spec.required.some((key) => evidence[key] === undefined || evidence[key] === null)) return { ok: false, error: 'invalid-evidence' };
  if (body.gameId === 'chikun' && !isPlainObject(evidence.flap)) return { ok: false, error: 'invalid-evidence' };
  if (body.gameId === 'stacked' && typeof evidence.sic1 !== 'string') return { ok: false, error: 'invalid-evidence' };
  if (body.gameId === 'lester-blaster' && (!isPlainObject(evidence.runSummary) || !isPlainObject(evidence.sessionEnvelope))) return { ok: false, error: 'invalid-evidence' };
  return { ok: true };
}

// --- SettleResponse (§4.4) ----------------------------------------------------

async function safely(run, fallback) {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

export function pollAfterMsFor(row) {
  if (!row || row.status === 'confirmed' || isDeadLetter(row)) return null;
  return row.status === 'submitted' ? 2500 : 3000;
}

async function achievementsView(db, row, catalog) {
  const recorded = await readSessionAchievements(db, row.sessionId32);
  const nftIds = new Set(catalog ? await safely(async () => catalog.nftAchievementIds(row.gameId), []) : []);
  const catalogOrder = catalog ? await safely(async () => (typeof catalog.catalogFor === 'function' ? catalog.catalogFor(row.gameId).map((entry) => entry.id) : []), []) : [];
  const items = [];
  for (const unlock of recorded) {
    // eslint-disable-next-line no-await-in-loop
    const entry = catalog ? await safely(async () => catalog.achievementById(row.gameId, unlock.id), null) : null;
    items.push({
      id: unlock.id,
      gameId: row.gameId,
      title: entry?.title ?? null,
      tier: unlock.tier,
      nft: nftIds.has(unlock.id),
      image: entry?.image ?? null,
      unlockedAt: unlock.unlockedAt,
      tokenId: unlock.tokenId,
    });
  }
  const rank = (id) => {
    const index = catalogOrder.indexOf(id);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  return items.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

// The owner view (E3 always; E4 with a Bearer for the row's wallet) or the
// public view (E4 otherwise): no wallet, lastError or attempts, and score,
// stats and achievements only for a confirmed run.
export async function settleResponse(db, row, { view = 'owner', catalog = null } = {}) {
  const confirmed = row.status === 'confirmed';
  const common = {
    ok: true,
    view,
    sessionId32: row.sessionId32,
    shareId: shareIdFor(row.sessionId32),
    gameId: row.gameId,
    status: row.status,
    txHash: row.txHash ?? null,
    blockNumber: row.blockNumber ?? null,
    explorerUrl: explorerUrlFor(row.txHash),
    retryable: isRetryableRow(row),
    nextAttemptAt: row.nextAttemptAt ?? null,
    pollAfterMs: pollAfterMsFor(row),
    confirmedAt: row.confirmedAt ?? null,
  };
  const record = () => ({
    score: row.score,
    contract: { kills: row.kills, maxCombo: row.maxCombo, survivalSeconds: row.survivalSeconds, bossId: row.bossId ?? null },
    stats: row.stats ?? {},
  });
  if (view === 'public') {
    if (!confirmed) return common;
    return { ...common, ...record(), achievements: await achievementsView(db, row, catalog) };
  }
  return {
    ok: true,
    view: 'owner',
    sessionId32: row.sessionId32,
    shareId: common.shareId,
    gameId: row.gameId,
    wallet: row.wallet,
    status: row.status,
    ...record(),
    envelopeHash: row.envelopeHash,
    txHash: common.txHash,
    blockNumber: common.blockNumber,
    explorerUrl: common.explorerUrl,
    achievements: await achievementsView(db, row, catalog),
    retryable: common.retryable,
    attempts: row.attempts,
    lastError: row.lastError ?? null,
    nextAttemptAt: common.nextAttemptAt,
    verifiedAt: row.verifiedAt ?? null,
    confirmedAt: common.confirmedAt,
    pollAfterMs: common.pollAfterMs,
  };
}

async function ownerResult(deps, sessionId32) {
  const row = await readSettleRow(deps.db, sessionId32);
  return json(200, await settleResponse(deps.db, row, { view: 'owner', catalog: deps.catalog }));
}

// --- Submission ----------------------------------------------------------------

// Signer, domain and relayer, created only when a submission needs them and
// only after the config checks passed (A28).
export function submissionContext(deps) {
  let signer = null;
  let relayer = null;
  return {
    domain: attestationDomain({ chainId: deps.config.chainId, verifyingContract: deps.config.scoreRegistry.address }),
    signer() {
      signer ??= deps.config.verifier.createSigner(ethers);
      return signer;
    },
    relayer() {
      relayer ??= typeof deps.relayer === 'function' ? deps.relayer() : deps.relayer;
      return relayer;
    },
  };
}

// One submission attempt for a row that may be pending, signed or failed
// (§3.3): re-sign when the rule asks for it (re-verifying the stored
// evidence), move a due failed row back to signed, then submit through the
// relayer. → { status, code }
export async function driveSubmission(row, deps, ctx = submissionContext(deps), { receiptTimeoutMs } = {}) {
  const clock = clockOf(deps);
  let current = row;
  if (!current || current.source === 'chain-index') return { status: current?.status ?? null, code: null };
  const resign = current.status === 'pending'
    || (['signed', 'failed'].includes(current.status) && needsResign(current, clock()))
    || (current.status === 'failed' && RESIGN_BEFORE_RETRY.has(current.lastError));
  if (resign && ['pending', 'signed', 'failed'].includes(current.status)) {
    let result;
    try {
      result = await resignRow({ ethers, db: deps.db, row: current, verify: deps.verify, catalog: deps.catalog, signer: ctx.signer(), domain: ctx.domain, nowMs: clock });
    } catch (error) {
      logSafeError('settle:resign', error);
      result = { ok: false, class: 'wait', code: 'unknown-error' };
    }
    if (!result.ok) {
      const updated = await recordFailure(deps.db, { sessionId32: current.sessionId32, class: result.class, code: result.code, nowMs: clock(), from: current.status });
      return { status: updated?.status ?? current.status, code: updated?.lastError ?? result.code };
    }
    current = await readSettleRow(deps.db, current.sessionId32);
  } else if (current.status === 'failed') {
    await casStatus(deps.db, { sessionId32: current.sessionId32, from: 'failed', to: 'signed', set: { next_attempt_at: null }, nowMs: clock() });
    current = await readSettleRow(deps.db, current.sessionId32);
  }
  if (current?.status !== 'signed') return { status: current?.status ?? null, code: null };
  const options = receiptTimeoutMs === undefined ? undefined : { receiptTimeoutMs };
  return ctx.relayer().submit(current, options);
}

async function submitSafely(row, deps, ctx) {
  try {
    return await driveSubmission(row, deps, ctx);
  } catch (error) {
    // The row keeps its state; the cron drains it (§4.3.11).
    logSafeError('settle:submit', error);
    return { status: row.status, code: 'unknown-error' };
  }
}

// --- Paid entry (§4.3.3 step 9, A17, A27) --------------------------------------

async function checkPaidEntry({ body, wallet, gameId, sessionId32 }, deps) {
  const chain = deps.chain;
  const chainReadFailed = () => retryableFail(502, 'chain-read-failed', ENTRY_PENDING_RETRY_MS);
  let paid;
  try {
    paid = await chain.getPaidSession(sessionId32);
  } catch (error) {
    logSafeError('settle:paid', error);
    return { result: chainReadFailed() };
  }
  if (!paid.exists) {
    if (!body.entryTxHash) return { result: fail(402, 'entry-not-paid') };
    const receipt = await safely(async () => chain.waitForReceipt(body.entryTxHash, ENTRY_RECEIPT_WAIT_MS), null);
    try {
      paid = await chain.getPaidSession(sessionId32);
    } catch (error) {
      logSafeError('settle:paid', error);
      return { result: chainReadFailed() };
    }
    if (!paid.exists) {
      if (receipt && Number(receipt.status) === 0) return { result: fail(402, 'entry-not-paid') };
      const tx = await safely(async () => chain.getTransaction(body.entryTxHash), null);
      const entryAddress = lower(typeof chain.entryAddress === 'function' ? chain.entryAddress() : deps.config.deployment?.addresses?.arcadeRankedEntry);
      if (tx && (tx.from !== wallet || tx.to !== entryAddress || (tx.sessionId32 && tx.sessionId32 !== sessionId32))) return { result: fail(402, 'entry-not-paid') };
      // Pending, unknown or a lagging RPC: the client keeps the run and retries.
      return { result: retryableFail(409, 'entry-pending', ENTRY_PENDING_RETRY_MS) };
    }
  }
  if (paid.player !== wallet || paid.gameId32 !== lower(ethers.id(gameId))) return { result: fail(402, 'entry-not-paid') };
  if (BigInt(paid.amountWei) < BigInt(deps.config.minPaidWei)) return { result: fail(402, 'entry-underpaid') };
  return { openedAt: Number(paid.openedAt), amountWei: BigInt(paid.amountWei) };
}

// The HMH hero policy (§4.3.3 step 11): { gates: HMH_HERO_GATES (hero id →
// Ranked runs required), free: HMH_FREE_HEROES }, both from the verify slice
// (server/verify/hmh.mjs). null when either is missing, so E3 fails closed.
export function heroPolicyFrom(value) {
  if (!value || typeof value !== 'object') return null;
  const { gates, free } = value;
  if (!gates || typeof gates !== 'object' || Array.isArray(gates) || !Array.isArray(free)) return null;
  const counts = new Map();
  for (const [heroId, gate] of Object.entries(gates)) {
    const count = typeof gate === 'number' ? gate : Number(gate?.count ?? gate?.gate?.count);
    if (!Number.isSafeInteger(count) || count < 0) return null;
    counts.set(heroId, count);
  }
  return Object.freeze({ counts, free: new Set(free.filter((heroId) => typeof heroId === 'string')) });
}

async function loadHeroPolicy(deps) {
  try {
    return heroPolicyFrom(typeof deps.heroGates === 'function' ? await deps.heroGates() : deps.heroGates);
  } catch (error) {
    logSafeError('settle:hero-gates', error);
    return null;
  }
}

// A free hero passes; a gated hero needs history.runs ≥ its count; any other
// id (unknown, missing or malformed) is refused: the run-summary schema
// accepts any id-shaped heroId, so an unknown id is never treated as free.
export function heroAllowed(policy, heroId, runs) {
  if (typeof heroId !== 'string' || !heroId) return false;
  if (policy.free.has(heroId)) return true;
  if (!policy.counts.has(heroId)) return false;
  return Number(runs) >= policy.counts.get(heroId);
}

// The verifier's plausibility flags for a 422 (§4.3.3 "implausible-run (with
// flags)"): the id and severity of each, never the measured value or the
// ceiling (those would publish the validator's calibration).
export function responseFlags(flags) {
  if (!Array.isArray(flags)) return [];
  const out = [];
  for (const flag of flags) {
    const id = typeof flag === 'string' ? flag : flag?.id;
    if (typeof id !== 'string' || !FLAG_ID.test(id)) continue;
    const severity = typeof flag === 'object' && FLAG_SEVERITIES.has(flag?.severity) ? flag.severity : null;
    out.push({ id, severity });
    if (out.length >= MAX_RESPONSE_FLAGS) break;
  }
  return out;
}

// --- E3 ------------------------------------------------------------------------

async function retryBodyRequest(body, wallet, deps) {
  if (!validRetryBody(body)) return fail(400, 'invalid-body');
  const row = await readSettleRow(deps.db, body.sessionId32);
  if (!row) return fail(404, 'session-not-found');
  if (row.wallet !== wallet) return fail(403, 'wallet-mismatch');
  if (row.source === 'settle' && retryAllowed(row, clockOf(deps)())) await submitSafely(row, deps, submissionContext(deps));
  return ownerResult(deps, row.sessionId32);
}

// §4.3.3 step 8: same wallet and evidence digest → idempotent (no verify, no
// paid read, no chain call unless the retry rule allows one submission);
// another digest → 409; another wallet → 403.
async function existingRowRequest(existing, body, wallet, deps) {
  if (existing.wallet !== wallet) return fail(403, 'wallet-mismatch');
  if (existing.source === 'chain-index') return ownerResult(deps, existing.sessionId32);
  let computed;
  try {
    computed = await deps.verify.computeEvidenceDigest(body);
  } catch {
    return fail(400, 'invalid-evidence');
  }
  // Evidence that does not decode is the caller's error, not a conflict.
  if (!computed || computed.ok === false || typeof computed.digest !== 'string') return fail(400, 'invalid-evidence');
  if (lower(computed.digest) !== lower(existing.evidenceDigest)) return fail(409, 'session-conflict');
  if (retryAllowed(existing, clockOf(deps)())) await submitSafely(existing, deps, submissionContext(deps));
  return ownerResult(deps, existing.sessionId32);
}

export async function settleRequest({ headers = {}, body = null, ip = 'unknown' } = {}, deps) {
  // 1. Auth (the adapter already ran it before reading the body; direct
  //    callers get the same check).
  const auth = authenticateBearer(headers, deps);
  if (!auth.ok) return auth.status === 503 ? fail(503, 'settlement-not-configured', { detail: missingDetail(deps?.config) }) : fail(401, 'invalid-session');
  // 2. Pause and config, then the verify and achievements modules.
  const gate = settlementGate(deps) ?? moduleGate(deps);
  if (gate) return gate;
  // 3. The body (parsed by the adapter under the 1.8 MB cap).
  if (!isPlainObject(body)) return fail(400, 'invalid-body');
  const { db, config } = deps;
  const clock = clockOf(deps);
  const wallet = auth.wallet;
  const secret = config.session.secret();
  await ensureSchema(db);

  // 4. Rate limits. Retry bodies are authenticated and cheap: wallet bucket only.
  const retry = isRetryBody(body);
  const limited = retry
    ? await limitedBy(db, `settle-retry:w:${wallet}`, SETTLE_LIMITS.retryWallet, clock())
    : (await limitedBy(db, `settle:w:${wallet}`, SETTLE_LIMITS.wallet, clock())) ?? (await limitedBy(db, `settle:ip:${ipBucket(ip, secret)}`, SETTLE_LIMITS.ip, clock()));
  if (limited) return limited;

  // 5. Retry body: drive the state machine only; never re-verify.
  if (retry) return retryBodyRequest(body, wallet, deps);

  // 6. Shape.
  const shape = validateSettleBody(body);
  if (!shape.ok) return fail(400, shape.error);
  if (lower(body.identity.wallet) !== wallet) return fail(403, 'wallet-mismatch');
  const gameId = body.gameId;
  const sessionId32 = body.sessionId32;

  // 7. Identity binding: identity, seed ticket MAC and seed, session key.
  const bindOptions = { chainId: config.chainId, scoreRegistryAddress: config.scoreRegistry.address, wallet, nowMs: clock(), seedSecret: secret, crypto: deps.crypto ?? nodeCrypto };
  const bound = await deps.verify.bindRankedIdentity(body, bindOptions);
  if (!bound?.ok) return fail(400, bound?.error ?? 'identity-invalid');

  // 8. Existing row.
  const existing = await readSettleRow(db, sessionId32);
  if (existing) return existingRowRequest(existing, body, wallet, deps);

  // 9. Paid entry.
  const paid = await checkPaidEntry({ body, wallet, gameId, sessionId32 }, deps);
  if (paid.result) return paid.result;

  // 10. Ticket freshness (A26).
  const issuedAt = Number(body.seedTicket.issuedAt);
  if (!Number.isFinite(issuedAt) || paid.openedAt < issuedAt - TICKET_EARLY_SECONDS || paid.openedAt > issuedAt + TICKET_LATE_SECONDS) return fail(422, 'seed-ticket-stale');

  // 11. History and the HMH hero gate (§6.5, A7).
  const fields = await deps.catalog.historyFieldsFor(gameId);
  const history = await readAchievementHistory(db, { wallet, gameId, fields, excludeSessionId32: sessionId32 });
  if (gameId === 'lester-blaster') {
    const policy = await loadHeroPolicy(deps);
    if (!policy) return fail(503, 'settlement-not-configured', { detail: 'hero-gates-unavailable' });
    if (!heroAllowed(policy, body.evidence.runSummary?.identity?.heroId, history.runs)) return fail(422, 'hero-locked');
  }

  // 12. Verify: replay (Chikun, STACKED) or plausibility (HMH).
  const run = await deps.verify.verifyRankedRun(body, { ...bindOptions, bound });
  if (!run || run.ok === false) {
    const extra = {};
    if (typeof run?.detail === 'string') extra.detail = run.detail.slice(0, 240);
    if (Array.isArray(run?.flags)) extra.flags = responseFlags(run.flags);
    return fail([400, 422].includes(run?.status) ? run.status : 422, typeof run?.error === 'string' ? run.error : 'replay-rejected', extra);
  }
  if (run.sessionId32 !== sessionId32 || lower(run.wallet) !== wallet || run.gameId !== gameId) throw new Error('verified run does not match the request');

  // 13. Run timing from the chain (A26).
  const nowSeconds = clock() / 1000;
  const survival = Number(run.contract.survivalSeconds);
  const readyAt = paid.openedAt + survival - RUN_EARLY_SLACK_SECONDS;
  if (nowSeconds < readyAt) return retryableFail(409, 'run-timing-early', Math.max(1000, Math.ceil((readyAt - nowSeconds) * 1000)));
  if (nowSeconds > paid.openedAt + survival + RUN_STALE_SECONDS) return fail(422, 'run-stale');

  // 14. Achievements: all earned ids are recorded; only current-catalog NFT
  //     candidates ride on chain, at most 32 (A20).
  const earned = await deps.catalog.deriveEarnedAchievements(gameId, run, history);
  const nftSet = new Set(await deps.catalog.nftAchievementIds(gameId));
  const unlocks = [...earned].map((entry) => ({ id: entry.id, tier: entry.tier, nft: nftSet.has(entry.id) }));
  const nftIds = unlocks.filter((unlock) => unlock.nft).map((unlock) => unlock.id).slice(0, MAX_NFT_ACHIEVEMENTS);

  // 15. Insert (one CTE). inserted=false: a concurrent duplicate won.
  const openedAtMs = paid.openedAt * 1000;
  const inserted = await insertSettleRow(db, settleInsertParams({
    verifiedRun: run,
    openedAtMs,
    amountWei: paid.amountWei,
    clientClaim: body.claim ? { score: body.claim.score } : null,
    plausibility: run.plausibility ?? null,
    unlocks,
    nftIds,
    periodKeys: periodKeysFor(openedAtMs),
  }));
  if (!inserted.inserted) return existingRowRequest(await readSettleRow(db, sessionId32), body, wallet, deps);

  // 16. Sign, then CAS pending → signed.
  const ctx = submissionContext(deps);
  try {
    const signed = await signVerifiedRun(ethers, { verifiedRun: run, nftAchievementIds: nftIds, deadlineSeconds: attestationDeadlineFor(clock()), domain: ctx.domain, signer: ctx.signer() });
    await casStatus(db, { sessionId32, from: 'pending', to: 'signed', set: { attestation: attestationRecord(signed) }, nowMs: clock() });
  } catch (error) {
    // The row stays pending; the cron re-signs it from the stored evidence.
    logSafeError('settle:sign', error);
  }

  // 17. One submission attempt.
  const row = await readSettleRow(db, sessionId32);
  if (row?.status === 'signed') await submitSafely(row, deps, ctx);

  // 18. The owner view.
  return ownerResult(deps, sessionId32);
}

// --- E4 ------------------------------------------------------------------------

export async function settleStatusRequest({ query = {}, headers = {}, ip = 'unknown' } = {}, deps) {
  const fromKey = query.sessionId32 !== undefined ? normalizeSessionId32(query.sessionId32) : null;
  const fromShare = query.id !== undefined ? normalizeSessionId32(query.id) : null;
  if ((query.sessionId32 !== undefined && !fromKey) || (query.id !== undefined && !fromShare)) return fail(400, 'invalid-session-id');
  if (fromKey && fromShare && fromKey !== fromShare) return fail(400, 'invalid-session-id');
  const sessionId32 = fromKey ?? fromShare;
  if (!sessionId32) return fail(400, 'invalid-session-id');
  if (!deps?.db) return fail(503, 'index-not-configured');
  const { db, config } = deps;
  const clock = clockOf(deps);
  await ensureSchema(db);
  const salt = config?.session?.configured ? config.session.secret() : UNKEYED_IP_BUCKET_SALT;
  const hit = await hitRateLimit(db, { bucket: `status:ip:${ipBucket(ip, salt)}`, limit: STATUS_LIMITS.ip, windowSeconds: STATUS_LIMITS.windowSeconds, nowMs: clock() });
  if (!hit.ok) return rateLimitedResult(hit.retryAfterSeconds);
  let row = await readSettleRow(db, sessionId32);
  if (!row) return fail(404, 'session-not-found');

  // The only write: a throttled receipt check for a submitted row.
  const lastChecked = Date.parse(row.lastCheckedAt ?? '');
  const registryAddress = lower(deps.deployment?.addresses?.scoreSubmissionRegistry ?? config?.deployment?.addresses?.scoreSubmissionRegistry);
  if (row.status === 'submitted' && row.txHash && /^0x[0-9a-f]{40}$/.test(registryAddress)
    && (!Number.isFinite(lastChecked) || clock() - lastChecked > STATUS_RECEIPT_THROTTLE_MS)) {
    try {
      await checkSubmittedRow({ db, provider: deps.provider, registryAddress, row, nowMs: clock, startBlock: logStartBlock(deps) });
    } catch (error) {
      logSafeError('settle-status:receipt', error);
    } finally {
      await touchLastChecked(db, { sessionId32, nowMs: clock() });
    }
    row = await readSettleRow(db, sessionId32);
  }
  const viewer = optionalBearerWallet(headers, deps);
  const view = viewer && viewer === row.wallet ? 'owner' : 'public';
  return json(200, await settleResponse(db, row, { view, catalog: deps.catalog ?? null }));
}

// --- Production deps (A30) ------------------------------------------------------

async function optionalImport(load, label) {
  try {
    return await load();
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') logSafeError(`settle:import:${label}`, error);
    return null;
  }
}

function pickFunctions(module, names) {
  if (!module || names.some((name) => typeof module[name] !== 'function')) return null;
  return Object.freeze(Object.fromEntries(names.map((name) => [name, module[name]])));
}

// The verify slice's functions (server/verify/index.mjs), resolved at request
// time; null when the module cannot load, so the endpoint fails closed with
// 503 (tests/api-settle-handler.test.mjs proves the real module loads here).
export async function loadVerifyModule() {
  return pickFunctions(await optionalImport(() => import('../verify/index.mjs'), 'verify'), ['bindRankedIdentity', 'verifyRankedRun', 'computeEvidenceDigest', 'reverifyStoredRun']);
}

// The achievements registry (§6.2), resolved at request time; null when it
// cannot load (the endpoint then fails closed).
export async function loadAchievementRegistry() {
  return pickFunctions(await optionalImport(() => import('../../apps/portal/src/achievements/index.mjs'), 'achievements'), ['deriveEarnedAchievements', 'historyFieldsFor', 'nftAchievementIds', 'achievementById', 'catalogFor']);
}

// HMH_HERO_GATES and HMH_FREE_HEROES (server/verify/hmh.mjs), loaded only for
// an HMH settle or ticket; null when that module cannot load.
export async function loadHeroGates() {
  const module = await optionalImport(() => import('../verify/hmh.mjs'), 'hmh');
  if (!module?.HMH_HERO_GATES || typeof module.HMH_HERO_GATES !== 'object' || !Array.isArray(module.HMH_FREE_HEROES)) return null;
  return Object.freeze({ gates: module.HMH_HERO_GATES, free: module.HMH_FREE_HEROES });
}

// Adds the settle dependencies to index's base deps (buildBaseDeps plus the
// lazy public provider). The relayer is a factory: the relayer wallet is
// created from config.relayer.createWallet only inside the handler, after the
// config checks pass (A28).
export async function attachSettleDeps(deps, { env = process.env, verify = true, catalog = true, relayer = true } = {}) {
  const [verifyModule, registry] = await Promise.all([verify ? loadVerifyModule() : null, catalog ? loadAchievementRegistry() : null]);
  deps.verify = verifyModule;
  deps.catalog = registry;
  deps.heroGates = loadHeroGates;
  deps.chain = createChainReader({ provider: () => deps.provider, deployment: deps.deployment });
  if (relayer) {
    let memo = null;
    deps.relayer = () => {
      memo ??= createRelayer({
        db: deps.db,
        provider: deps.provider,
        wallet: deps.config.relayer.createWallet(ethers, deps.provider),
        registryAddress: deps.config.scoreRegistry.address,
        reserveWei: deps.deployment?.settlementGasReserveWei,
        holderId: `${env?.VERCEL_REGION ?? 'local'}:${(deps.crypto ?? nodeCrypto).randomUUID()}`,
        nowMs: deps.nowMs,
        chainId: deps.config.chainId,
        startBlock: logStartBlock(deps),
      });
      return memo;
    };
  }
  return deps;
}
