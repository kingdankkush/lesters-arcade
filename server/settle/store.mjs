// Neon store of the settle queue: verified_sessions is the queue (contract A8,
// §3.2, §3.3, A15).
//
// One statement per call (Neon HTTP has no sessions, A1): the insert is one
// data-modifying CTE, and every transition is a compare-and-set that names
// the status it expects, so a concurrent writer is detected by a zero-row
// result instead of a lock. Every SELECT returns only text, int4 or boolean
// columns, and every parameter is a string or null (A15).
//
// Timestamps written here come from the injected clock (nowMs), so the queue
// agrees with the rest of the request (and with the tests' clock).

import { isoSql } from '../neon/queries.mjs';
import { parseJsonText } from '../neon/rows.mjs';
import { allowlistedCode } from './errors.mjs';

export const SETTLE_STATUSES = Object.freeze(['pending', 'signed', 'submitted', 'confirmed', 'failed']);
export const DETERMINISTIC_MAX_ATTEMPTS = 3;
export const MAX_RESIGNS = 3;
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const PENDING_RESIGN_AFTER_MS = 30_000;
export const SUBMITTED_CHECK_AFTER_MS = 180_000;
const SESSION_ID32 = /^0x[0-9a-f]{64}$/;

// §3.3, verbatim: session row, evidence and achievement unlocks in one statement.
export const SETTLE_INSERT_SQL = `WITH s AS (
  INSERT INTO verified_sessions (session_id32, session_handle, wallet, game_id, season_id, runtime_id, build_hash, seed,
      score, kills, max_combo, survival_seconds, boss_id, stats, envelope_hash, achievements, nft_achievements,
      day_key, week_key, month_key, status, verified_at, opened_at, entry_amount_wei, client_claim, plausibility)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8::bigint,$9::bigint,$10::bigint,$11::bigint,$12::bigint,$13,$14::jsonb,$15,
          ARRAY(SELECT jsonb_array_elements_text($16::jsonb)), ARRAY(SELECT jsonb_array_elements_text($17::jsonb)),
          $18,$19,$20,'pending',$21::timestamptz,$28::timestamptz,$29,$30::jsonb,$31::jsonb)
  ON CONFLICT (session_id32) DO NOTHING
  RETURNING session_id32, wallet, game_id
), e AS (
  INSERT INTO session_evidence (session_id32, encoding, evidence, evidence_bytes, evidence_digest, identity)
  SELECT session_id32, $22, $23, $24::int, $25, $26::jsonb FROM s
  RETURNING session_id32
), u AS (
  INSERT INTO achievement_unlocks (wallet, game_id, achievement_id, session_id32, tier, nft, unlocked_at)
  SELECT s.wallet, s.game_id, a.id, s.session_id32, a.tier, a.nft, $21::timestamptz
  FROM s CROSS JOIN jsonb_to_recordset($27::jsonb) AS a(id text, tier text, nft boolean)
  ON CONFLICT (wallet, game_id, achievement_id) DO NOTHING
  RETURNING achievement_id
)
SELECT (SELECT count(*)::int FROM s) AS inserted,
       (SELECT coalesce(array_to_json(array_agg(achievement_id)), '[]'::json)::text FROM u) AS unlocked;`;

function iso(ms) {
  return new Date(Number(ms)).toISOString();
}

function nullableString(value) {
  return value === null || value === undefined ? null : String(value);
}

function intText(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new TypeError(`expected an integer, got ${value}`);
  return String(number);
}

// The 31 string-or-null parameters of SETTLE_INSERT_SQL.
//   verifiedRun   the §5.3 VerifiedRun
//   openedAtMs    getPaidSession(...).openedAt × 1000 (period keys come from it, A26)
//   amountWei     the entry's amountWei (decimal string or bigint)
//   clientClaim   the body's claim or null (non-public, A9)
//   plausibility  HMH soft flags or null (non-public, §5.3)
//   unlocks       [{ id, tier, nft }] for achievement_unlocks (every earned id)
//   nftIds        the NFT candidates sent on chain (§4.3.3 step 14, A20)
//   periodKeys    { day, week, month } of openedAt
export function settleInsertParams({ verifiedRun, openedAtMs, amountWei, clientClaim = null, plausibility = null, unlocks = [], nftIds = [], periodKeys }) {
  const run = verifiedRun;
  const evidence = run.evidence;
  const params = [
    run.sessionId32,
    nullableString(run.sessionHandle),
    String(run.wallet).toLowerCase(),
    run.gameId,
    run.seasonId,
    run.runtimeId,
    nullableString(run.buildHash),
    run.seed === null || run.seed === undefined ? null : intText(run.seed),
    intText(run.score),
    intText(run.contract.kills),
    intText(run.contract.maxCombo),
    intText(run.contract.survivalSeconds),
    run.contract.bossId === null || run.contract.bossId === undefined ? null : String(run.contract.bossId),
    JSON.stringify(run.stats ?? {}),
    String(run.envelopeHash).toLowerCase(),
    JSON.stringify(unlocks.map((unlock) => unlock.id)),
    JSON.stringify([...nftIds]),
    periodKeys.day,
    periodKeys.week,
    periodKeys.month,
    new Date(run.verifiedAt).toISOString(),
    evidence.encoding,
    evidence.text,
    intText(evidence.bytes),
    String(evidence.digest).toLowerCase(),
    JSON.stringify(run.identity),
    JSON.stringify(unlocks.map((unlock) => ({ id: unlock.id, tier: unlock.tier, nft: unlock.nft === true }))),
    iso(openedAtMs),
    String(BigInt(amountWei)),
    clientClaim === null || clientClaim === undefined ? null : JSON.stringify(clientClaim),
    plausibility === null || plausibility === undefined ? null : JSON.stringify(plausibility),
  ];
  if (params.length !== 31 || params.some((value) => value !== null && typeof value !== 'string')) throw new TypeError('A15: settle insert parameters must be 31 strings or nulls');
  return params;
}

// → { inserted: boolean, unlocked: string[] }. inserted=false means the row
// already existed (the idempotent path, §4.3.3 step 15).
export async function insertSettleRow(db, params) {
  const rows = await db.query(SETTLE_INSERT_SQL, params);
  const row = rows[0] ?? {};
  return { inserted: Number(row.inserted ?? 0) === 1, unlocked: parseJsonText(row.unlocked, []) };
}

const ROW_COLUMNS = `v.session_id32, v.session_handle, v.wallet, v.game_id, v.season_id, v.runtime_id, v.build_hash,
       v.seed::text AS seed, v.score::text AS score, v.kills::text AS kills, v.max_combo::text AS max_combo,
       v.survival_seconds::text AS survival_seconds, v.boss_id, v.stats::text AS stats, v.envelope_hash,
       array_to_json(v.achievements)::text AS achievements, array_to_json(v.nft_achievements)::text AS nft_achievements,
       v.day_key, v.week_key, v.month_key, v.status, v.source, v.attestation::text AS attestation, v.tx_hash,
       v.tx_nonce::text AS tx_nonce, v.block_number::text AS block_number, v.relayer, v.attempts, v.last_error,
       v.infra_failures, v.resigns, v.entry_amount_wei,
       ${isoSql('v.opened_at')} AS opened_at, ${isoSql('v.next_attempt_at')} AS next_attempt_at,
       ${isoSql('v.last_checked_at')} AS last_checked_at, ${isoSql('v.verified_at')} AS verified_at,
       ${isoSql('v.submitted_at')} AS submitted_at, ${isoSql('v.confirmed_at')} AS confirmed_at,
       ${isoSql('v.updated_at')} AS updated_at, e.evidence_digest, e.encoding`;

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function settleRowFrom(raw) {
  if (!raw) return null;
  return Object.freeze({
    sessionId32: raw.session_id32,
    sessionHandle: raw.session_handle ?? null,
    wallet: raw.wallet,
    gameId: raw.game_id,
    seasonId: raw.season_id,
    runtimeId: raw.runtime_id,
    buildHash: raw.build_hash ?? null,
    seed: numberOrNull(raw.seed),
    score: Number(raw.score),
    kills: Number(raw.kills),
    maxCombo: Number(raw.max_combo),
    survivalSeconds: Number(raw.survival_seconds),
    bossId: raw.boss_id ?? null,
    stats: parseJsonText(raw.stats, {}),
    envelopeHash: raw.envelope_hash,
    achievements: parseJsonText(raw.achievements, []),
    nftAchievements: parseJsonText(raw.nft_achievements, []),
    dayKey: raw.day_key,
    weekKey: raw.week_key,
    monthKey: raw.month_key,
    status: raw.status,
    source: raw.source,
    attestation: parseJsonText(raw.attestation, null),
    txHash: raw.tx_hash ?? null,
    txNonce: numberOrNull(raw.tx_nonce),
    blockNumber: numberOrNull(raw.block_number),
    relayer: raw.relayer ?? null,
    attempts: Number(raw.attempts ?? 0),
    lastError: raw.last_error ?? null,
    infraFailures: Number(raw.infra_failures ?? 0),
    resigns: Number(raw.resigns ?? 0),
    entryAmountWei: raw.entry_amount_wei ?? null,
    openedAt: raw.opened_at ?? null,
    nextAttemptAt: raw.next_attempt_at ?? null,
    lastCheckedAt: raw.last_checked_at ?? null,
    verifiedAt: raw.verified_at ?? null,
    submittedAt: raw.submitted_at ?? null,
    confirmedAt: raw.confirmed_at ?? null,
    updatedAt: raw.updated_at ?? null,
    evidenceDigest: raw.evidence_digest ?? null,
    encoding: raw.encoding ?? null,
  });
}

function requireId(sessionId32) {
  if (!SESSION_ID32.test(String(sessionId32 ?? ''))) throw new TypeError('sessionId32 must be 0x + 64 lowercase hex');
  return sessionId32;
}

export async function readSettleRow(db, sessionId32) {
  const rows = await db.query(
    `SELECT ${ROW_COLUMNS} FROM verified_sessions v LEFT JOIN session_evidence e ON e.session_id32 = v.session_id32 WHERE v.session_id32 = $1`,
    [requireId(sessionId32)],
  );
  return settleRowFrom(rows[0]);
}

// The stored evidence and canonical identity, for the re-sign rule (§3.3).
export async function readStoredEvidence(db, sessionId32) {
  const rows = await db.query(
    'SELECT encoding, evidence, evidence_bytes, evidence_digest, identity::text AS identity FROM session_evidence WHERE session_id32 = $1',
    [requireId(sessionId32)],
  );
  const row = rows[0];
  if (!row) return null;
  return { encoding: row.encoding, text: row.evidence, bytes: Number(row.evidence_bytes), digest: row.evidence_digest, identity: parseJsonText(row.identity, null) };
}

// The achievements this session recorded first (achievement_unlocks is the
// authority for "first earned", §3.3).
export async function readSessionAchievements(db, sessionId32) {
  const rows = await db.query(
    `SELECT achievement_id, game_id, tier, nft, token_id, ${isoSql('unlocked_at')} AS unlocked_at
     FROM achievement_unlocks WHERE session_id32 = $1 ORDER BY achievement_id`,
    [requireId(sessionId32)],
  );
  return rows.map((row) => ({ id: row.achievement_id, gameId: row.game_id, tier: row.tier, storedNft: row.nft === true, tokenId: row.token_id ?? null, unlockedAt: row.unlocked_at ?? null }));
}

// Columns a transition may set, with their SQL casts. Values are strings or
// null (A15); numbers and objects are converted here.
const SETTABLE = Object.freeze({
  attestation: 'jsonb', tx_hash: 'text', tx_nonce: 'bigint', block_number: 'bigint', relayer: 'text',
  submitted_at: 'timestamptz', confirmed_at: 'timestamptz', next_attempt_at: 'timestamptz', last_checked_at: 'timestamptz',
  last_error: 'text', attempts: 'int', infra_failures: 'int', resigns: 'int',
});
const INCREMENTABLE = Object.freeze(['attempts', 'infra_failures', 'resigns']);

function settableValue(column, value) {
  if (value === null || value === undefined) return null;
  if (SETTABLE[column] === 'jsonb') return JSON.stringify(value);
  if (SETTABLE[column] === 'timestamptz') return typeof value === 'number' ? iso(value) : String(value);
  if (column === 'last_error') return allowlistedCode(value);
  return String(value);
}

// Compare-and-set: UPDATE … WHERE session_id32 = $1 AND status IN (from)
// RETURNING. Returns true when this call moved the row (§3.3).
export async function casStatus(db, { sessionId32, from, to, set = {}, increment = {}, nowMs = Date.now() } = {}) {
  requireId(sessionId32);
  const expected = (Array.isArray(from) ? from : [from]).map(String);
  if (!expected.length || expected.some((status) => !SETTLE_STATUSES.includes(status))) throw new TypeError('casStatus needs expected statuses');
  if (!SETTLE_STATUSES.includes(to)) throw new TypeError(`unknown status ${to}`);
  const params = [sessionId32, to, JSON.stringify(expected), iso(nowMs)];
  const assignments = ['status = $2', 'updated_at = $4::timestamptz'];
  for (const [column, value] of Object.entries(set)) {
    if (!Object.hasOwn(SETTABLE, column)) throw new TypeError(`casStatus cannot set ${column}`);
    params.push(settableValue(column, value));
    assignments.push(`${column} = $${params.length}::${SETTABLE[column]}`);
  }
  for (const [column, amount] of Object.entries(increment)) {
    if (!INCREMENTABLE.includes(column) || Object.hasOwn(set, column)) throw new TypeError(`casStatus cannot increment ${column}`);
    params.push(intText(amount));
    assignments.push(`${column} = ${column} + $${params.length}::int`);
  }
  const rows = await db.query(
    `UPDATE verified_sessions SET ${assignments.join(', ')}
     WHERE session_id32 = $1 AND status IN (SELECT jsonb_array_elements_text($3::jsonb))
     RETURNING session_id32`,
    params,
  );
  return rows.length === 1;
}

// Pure: the §3.3 effect of one classified failure on a row's counters.
// → { status, attempts, infraFailures, resigns, lastError, nextAttemptAt (ISO|null), deadLetter }
export function failureTransition(row, { class: errorClass, code, nowMs }) {
  const now = Number(nowMs);
  const attempts = Number(row.attempts ?? 0);
  const infraFailures = Number(row.infraFailures ?? 0);
  const resigns = Number(row.resigns ?? 0);
  const verifiedAt = Date.parse(row.verifiedAt ?? '');
  const base = { attempts, infraFailures, resigns };
  // Retryable for more than 7 days since verified_at: dead letter 'stale' (D10).
  if (Number.isFinite(verifiedAt) && now - verifiedAt > STALE_AFTER_MS) {
    return { ...base, status: 'failed', lastError: 'stale', nextAttemptAt: null, deadLetter: true };
  }
  const waitResult = (waitCode) => ({
    ...base,
    status: 'failed',
    infraFailures: infraFailures + 1,
    lastError: allowlistedCode(waitCode),
    nextAttemptAt: iso(now + Math.min(60_000 * 2 ** Math.min(infraFailures, 4), 15 * 60_000)),
    deadLetter: false,
  });
  if (errorClass === 'wait') return waitResult(code);
  if (errorClass === 're-sign') {
    // After three re-signs in a row the verifier itself is rejected (a rotated
    // key needs the env updated): an infra wait that spends no attempt.
    if (resigns >= MAX_RESIGNS) return { ...waitResult('verifier-rejected'), resigns: 0 };
    return { ...base, status: 'pending', resigns: resigns + 1, lastError: allowlistedCode(code), nextAttemptAt: iso(now), deadLetter: false };
  }
  // deterministic (and anything unclassified).
  const nextAttempts = attempts + 1;
  const dead = nextAttempts >= DETERMINISTIC_MAX_ATTEMPTS;
  return {
    ...base,
    status: 'failed',
    attempts: nextAttempts,
    lastError: allowlistedCode(code),
    nextAttemptAt: dead ? null : iso(now + Math.min(30_000 * 2 ** attempts, 30 * 60_000)),
    deadLetter: dead,
  };
}

// Records one classified failure (§3.3). A compare-and-set on the status and
// the counters it read, so a concurrent writer is never overwritten. `from`
// restricts the statuses this failure may apply to. Returns the updated row,
// or null when the row moved (or is not in `from`).
export async function recordFailure(db, { sessionId32, class: errorClass, code, nowMs = Date.now(), from = null } = {}) {
  const row = await readSettleRow(db, sessionId32);
  if (!row) return null;
  const allowed = from === null ? ['pending', 'signed', 'submitted', 'failed'] : (Array.isArray(from) ? from : [from]);
  if (!allowed.includes(row.status)) return null;
  const next = failureTransition(row, { class: errorClass, code, nowMs });
  const rows = await db.query(
    `UPDATE verified_sessions SET status = $2, attempts = $3::int, infra_failures = $4::int, resigns = $5::int,
            last_error = $6, next_attempt_at = $7::timestamptz, updated_at = $8::timestamptz
     WHERE session_id32 = $1 AND status = $9 AND attempts = $10::int AND infra_failures = $11::int AND resigns = $12::int
     RETURNING session_id32`,
    [sessionId32, next.status, String(next.attempts), String(next.infraFailures), String(next.resigns), next.lastError, next.nextAttemptAt, iso(nowMs),
      row.status, String(row.attempts), String(row.infraFailures), String(row.resigns)],
  );
  if (!rows.length) return null;
  return readSettleRow(db, sessionId32);
}

// submitted (or any unfinished status) → confirmed, with the block facts.
export async function markConfirmed(db, { sessionId32, txHash = null, blockNumber = null, confirmedAtMs, nowMs = Date.now(), from = ['submitted', 'signed', 'failed', 'pending'] } = {}) {
  const confirmedAt = Number.isFinite(Number(confirmedAtMs)) ? iso(confirmedAtMs) : iso(nowMs);
  const set = { confirmed_at: confirmedAt, block_number: blockNumber, next_attempt_at: null, last_error: null };
  if (txHash) set.tx_hash = String(txHash).toLowerCase();
  return casStatus(db, { sessionId32, from, to: 'confirmed', set, nowMs });
}

// E4's throttle stamp. No other column changes.
export async function touchLastChecked(db, { sessionId32, nowMs = Date.now() } = {}) {
  await db.query('UPDATE verified_sessions SET last_checked_at = $2::timestamptz WHERE session_id32 = $1', [requireId(sessionId32), iso(nowMs)]);
}

// A dead letter is a failed row with no next attempt (§3.3, §4.4).
export function isDeadLetter(row) {
  return row?.status === 'failed' && !row?.nextAttemptAt;
}

export function isRetryableRow(row) {
  return Boolean(row) && row.status !== 'confirmed' && !isDeadLetter(row);
}

// The retry-body rule (§4.3.3 step 5): submit only for signed, or failed,
// retryable and due.
export function retryAllowed(row, nowMs) {
  if (!row) return false;
  if (row.status === 'signed') return true;
  if (row.status !== 'failed' || isDeadLetter(row)) return false;
  return Date.parse(row.nextAttemptAt) <= Number(nowMs);
}

// §4.3.11: at most `limit` rows, in priority order: pending rows older than
// 30 s (re-sign), submitted rows older than 180 s (receipt check), signed
// rows, then failed rows that are retryable and due. Rows retryable for more
// than 7 days are left to deadLetterStaleRows.
export async function listDueRows(db, { nowMs = Date.now(), limit = 8 } = {}) {
  const rows = await db.query(
    `SELECT ${ROW_COLUMNS},
            CASE v.status WHEN 'pending' THEN 1 WHEN 'submitted' THEN 2 WHEN 'signed' THEN 3 ELSE 4 END AS priority
     FROM verified_sessions v LEFT JOIN session_evidence e ON e.session_id32 = v.session_id32
     WHERE v.source = 'settle' AND (
          (v.status = 'pending' AND coalesce(v.next_attempt_at, v.verified_at + interval '30 seconds') <= $1::timestamptz
             AND v.verified_at >= $1::timestamptz - interval '7 days')
       OR (v.status = 'submitted' AND coalesce(v.submitted_at, v.verified_at) <= $1::timestamptz - interval '180 seconds')
       OR (v.status = 'signed' AND v.verified_at >= $1::timestamptz - interval '7 days')
       OR (v.status = 'failed' AND v.next_attempt_at IS NOT NULL AND v.next_attempt_at <= $1::timestamptz
             AND v.verified_at >= $1::timestamptz - interval '7 days'))
     ORDER BY priority, coalesce(v.next_attempt_at, v.submitted_at, v.verified_at) ASC, v.session_id32 ASC
     LIMIT $2::int`,
    [iso(nowMs), intText(limit)],
  );
  return rows.map(settleRowFrom);
}

// §4.3.11 step 5 (guide D10): rows retryable for more than 7 days since
// verified_at become dead letters with code 'stale'. Submitted rows are left
// to their receipt check. Returns [{ sessionId32, from }].
export async function deadLetterStaleRows(db, { nowMs = Date.now(), limit = 50 } = {}) {
  const rows = await db.query(
    `UPDATE verified_sessions v SET status = 'failed', next_attempt_at = NULL, last_error = 'stale', updated_at = $1::timestamptz
     FROM (SELECT session_id32, status AS old_status FROM verified_sessions
           WHERE source = 'settle' AND verified_at < $1::timestamptz - interval '7 days'
             AND (status IN ('pending', 'signed') OR (status = 'failed' AND next_attempt_at IS NOT NULL))
           ORDER BY verified_at ASC, session_id32 ASC LIMIT $2::int) s
     WHERE v.session_id32 = s.session_id32 AND v.status = s.old_status
     RETURNING v.session_id32, s.old_status`,
    [iso(nowMs), intText(limit)],
  );
  return rows.map((row) => ({ sessionId32: row.session_id32, from: row.old_status }));
}

// Operator recovery (§3.3, scripts/requeue-dead-letters.mjs).
export async function listDeadLetters(db, { sessionIds = null, limit = 500 } = {}) {
  const ids = sessionIds === null ? null : sessionIds.map(requireId);
  const rows = await db.query(
    `SELECT v.session_id32, v.wallet, v.game_id, v.last_error, v.attempts, ${isoSql('v.verified_at')} AS verified_at
     FROM verified_sessions v
     WHERE v.source = 'settle' AND v.status = 'failed' AND v.next_attempt_at IS NULL
       AND ($1::text IS NULL OR v.session_id32 IN (SELECT jsonb_array_elements_text($1::jsonb)))
     ORDER BY v.verified_at ASC, v.session_id32 ASC LIMIT $2::int`,
    [ids === null ? null : JSON.stringify(ids), intText(limit)],
  );
  return rows.map((row) => ({ sessionId32: row.session_id32, wallet: row.wallet, gameId: row.game_id, lastError: row.last_error ?? null, attempts: Number(row.attempts), verifiedAt: row.verified_at }));
}

// Moves the given dead letters back to failed with attempts = 0,
// infra_failures = 0 and next_attempt_at = now. verified_at is the stale
// clock (§3.3), so a row that would be stale again at once (verified more
// than 6 days ago) restarts its retry window at the requeue; newer rows keep
// their verified_at. Returns the requeued ids.
export async function requeueDeadLetters(db, { sessionIds, nowMs = Date.now() } = {}) {
  const ids = (sessionIds ?? []).map(requireId);
  if (!ids.length) return [];
  const rows = await db.query(
    `UPDATE verified_sessions SET attempts = 0, infra_failures = 0, resigns = 0, next_attempt_at = $2::timestamptz,
            verified_at = CASE WHEN verified_at < $2::timestamptz - interval '6 days' THEN $2::timestamptz ELSE verified_at END,
            updated_at = $2::timestamptz
     WHERE session_id32 IN (SELECT jsonb_array_elements_text($1::jsonb))
       AND source = 'settle' AND status = 'failed' AND next_attempt_at IS NULL
     RETURNING session_id32`,
    [JSON.stringify(ids), iso(nowMs)],
  );
  return rows.map((row) => row.session_id32);
}
