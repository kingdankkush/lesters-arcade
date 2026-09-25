// Neon store of the Chikun Weekly Jackpot (design §C.2, §C.4; contract A15).
//
// Every mirror is keyed by contract (J7), so two instances never mix. One
// statement per call (Neon HTTP has no sessions): writes are idempotent
// upserts or compare-and-set updates that name the state they expect, and a
// zero-row result means someone else moved the row. SELECTs return only text,
// int4 or boolean columns (bigints and JSON as ::text, timestamps through
// isoSql), and every parameter is a string or null.
//
// Action ids are '<game>:<contract first 8 hex>:<week index>:<kind>:<session|->',
// all lowercase (design §C.2; rev. 1 used the week key, whose capital W failed
// the id CHECK).

import { isoSql } from '../neon/queries.mjs';
import { parseJsonText } from '../neon/rows.mjs';
import { allowlistedJackpotCode } from './errors.mjs';
import { boundsIsoOf, weekKeyOfIndex } from './weeks.mjs';

export const JACKPOT_GAME_ID = 'chikun';
export const WEEK_STATUSES = Object.freeze(['open', 'closed', 'selecting', 'review', 'awaiting-admin', 'finalizing', 'paid', 'claim-pending', 'rolled', 'unfunded', 'failed']);
// Weeks the cron never touches again. claim-pending waits for a claim or a
// recycle; failed waits for the owner's requeue.
export const TERMINAL_WEEK_STATUSES = Object.freeze(['paid', 'rolled', 'unfunded']);
export const ACTION_KINDS = Object.freeze(['submit', 'clear', 'flag', 'finalize']);
export const ACTION_STATUSES = Object.freeze(['pending', 'signed', 'submitted', 'confirmed', 'skipped', 'failed', 'dead']);
export const SCREEN_STATES = Object.freeze(['pending', 'pass', 'hold', 'integrity-fail', 'error']);
export const REVIEW_STATES = Object.freeze(['none', 'cleared', 'flagged', 'disqualified']);
export const ACTION_DEAD_AFTER = 3;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const SESSION = /^0x[0-9a-f]{64}$/;
const WEEK_KEY = /^[0-9]{4}-W[0-9]{2}$/;
const REASON = /^[a-z][a-z0-9-]{1,31}$/;
// jackpot_events.reason and jackpot_wallet_flags.reason allow one character.
const SHORT_REASON = /^[a-z][a-z0-9-]{0,31}$/;

const iso = (ms) => new Date(Number(ms)).toISOString();
const text = (value) => (value === null || value === undefined ? null : String(value));
const bool = (value) => (value ? 'true' : 'false');

function requireAddress(value, label = 'address') {
  const lower = String(value ?? '').toLowerCase();
  if (!ADDRESS.test(lower)) throw new TypeError(`${label} must be a 0x address`);
  return lower;
}

function requireSession(value) {
  const lower = String(value ?? '').toLowerCase();
  if (!SESSION.test(lower)) throw new TypeError('sessionId32 must be 0x + 64 hex');
  return lower;
}

function requireWeekKey(value) {
  if (!WEEK_KEY.test(String(value ?? ''))) throw new TypeError('weekKey must be YYYY-Www');
  return String(value);
}

function intText(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new TypeError(`expected an integer, got ${value}`);
  return String(number);
}

function weiText(value) {
  const big = BigInt(value ?? 0);
  if (big < 0n) throw new TypeError('wei must be non-negative');
  return big.toString();
}

export function actionId({ gameId = JACKPOT_GAME_ID, contract, weekIndex, kind, sessionId32 = null }) {
  if (!ACTION_KINDS.includes(kind)) throw new TypeError(`unknown action kind ${kind}`);
  const address = requireAddress(contract, 'contract');
  const session = sessionId32 === null || sessionId32 === undefined ? '-' : requireSession(sessionId32);
  return `${gameId}:${address.slice(2, 10)}:${intText(weekIndex)}:${kind}:${session}`;
}

// --- Weeks --------------------------------------------------------------------

const WEEK_COLUMNS = `contract, game_id, week_key, week_index, token_address, token_symbol, token_decimals, token_testnet,
  ${isoSql('starts_at')} AS starts_at, ${isoSql('closes_at')} AS closes_at, ${isoSql('settle_cutoff_at')} AS settle_cutoff_at,
  ${isoSql('candidate_until')} AS candidate_until, ${isoSql('payout_at')} AS payout_at, status, funded_wei, carried_in_wei,
  prize_wei, unclaimed_wei, winner, winning_session, winning_score::text AS winning_score, finalize_tx_hash,
  ${isoSql('finalized_at')} AS finalized_at, rolled_to_week, held, extension_s, last_error,
  ${isoSql('admin_waiting_since')} AS admin_waiting_since, ${isoSql('updated_at')} AS updated_at`;

export function weekRowFrom(raw) {
  if (!raw) return null;
  return Object.freeze({
    contract: raw.contract,
    gameId: raw.game_id,
    weekKey: raw.week_key,
    weekIndex: Number(raw.week_index),
    token: Object.freeze({ address: raw.token_address, symbol: raw.token_symbol, decimals: Number(raw.token_decimals), testnet: raw.token_testnet === true }),
    startsAt: raw.starts_at,
    closesAt: raw.closes_at,
    settleCutoffAt: raw.settle_cutoff_at,
    candidateUntil: raw.candidate_until,
    payoutAt: raw.payout_at,
    status: raw.status,
    fundedWei: raw.funded_wei,
    carriedInWei: raw.carried_in_wei,
    prizeWei: raw.prize_wei ?? null,
    unclaimedWei: raw.unclaimed_wei,
    winner: raw.winner ?? null,
    winningSession: raw.winning_session ?? null,
    winningScore: raw.winning_score === null || raw.winning_score === undefined ? null : Number(raw.winning_score),
    finalizeTxHash: raw.finalize_tx_hash ?? null,
    finalizedAt: raw.finalized_at ?? null,
    rolledToWeek: raw.rolled_to_week ?? null,
    held: raw.held === true,
    extensionSeconds: Number(raw.extension_s ?? 0),
    lastError: raw.last_error ?? null,
    adminWaitingSince: raw.admin_waiting_since ?? null,
    updatedAt: raw.updated_at ?? null,
  });
}

// Creates the row of a week (bounds from weeks.mjs, token from the instance)
// if it does not exist. Never changes an existing row. → the row.
export async function ensureWeekRow(db, { contract, gameId = JACKPOT_GAME_ID, weekIndex, token, status = 'open', extensionSeconds = 0 }) {
  const address = requireAddress(contract, 'contract');
  if (!WEEK_STATUSES.includes(status)) throw new TypeError(`unknown week status ${status}`);
  const bounds = boundsIsoOf(weekIndex, extensionSeconds);
  const weekKey = weekKeyOfIndex(weekIndex);
  await db.query(
    `INSERT INTO jackpot_weeks (contract, game_id, week_key, week_index, token_address, token_symbol, token_decimals, token_testnet,
        starts_at, closes_at, settle_cutoff_at, candidate_until, payout_at, status, extension_s, updated_at)
     VALUES ($1, $2, $3, $4::int, $5, $6, $7::int, $8::boolean, $9::timestamptz, $10::timestamptz, $11::timestamptz,
        $12::timestamptz, $13::timestamptz, $14, $15::int, now())
     ON CONFLICT (contract, week_key) DO NOTHING`,
    [address, gameId, weekKey, intText(weekIndex), requireAddress(token?.address, 'token address'), String(token?.symbol ?? ''),
      intText(token?.decimals ?? 18), bool(token?.testnet === true), bounds.startsAt, bounds.closesAt, bounds.settleCutoffAt,
      bounds.candidateUntil, bounds.payoutAt, status, intText(extensionSeconds)],
  );
  return readWeekRow(db, { contract: address, weekKey });
}

export async function readWeekRow(db, { contract, weekKey }) {
  const rows = await db.query(`SELECT ${WEEK_COLUMNS} FROM jackpot_weeks WHERE contract = $1 AND week_key = $2`, [requireAddress(contract, 'contract'), requireWeekKey(weekKey)]);
  return weekRowFrom(rows[0]);
}

export async function readWeekRows(db, { contract = null, statuses = null } = {}) {
  const rows = await db.query(
    `SELECT ${WEEK_COLUMNS} FROM jackpot_weeks
     WHERE ($1::text IS NULL OR contract = $1)
       AND ($2::text IS NULL OR status IN (SELECT jsonb_array_elements_text($2::jsonb)))
     ORDER BY week_index ASC, contract ASC`,
    [contract === null ? null : requireAddress(contract, 'contract'), statuses === null ? null : JSON.stringify(statuses)],
  );
  return rows.map(weekRowFrom);
}

// Mirror columns a week update may set, with their SQL casts.
const WEEK_SETTABLE = Object.freeze({
  funded_wei: 'text', carried_in_wei: 'text', prize_wei: 'text', unclaimed_wei: 'text', winner: 'text', winning_session: 'text',
  winning_score: 'bigint', finalize_tx_hash: 'text', finalized_at: 'timestamptz', rolled_to_week: 'text', held: 'boolean',
  extension_s: 'int', settle_cutoff_at: 'timestamptz', candidate_until: 'timestamptz', payout_at: 'timestamptz',
  last_error: 'text', admin_waiting_since: 'timestamptz',
});

function weekSetValue(column, value) {
  if (value === null || value === undefined) return null;
  if (WEEK_SETTABLE[column] === 'boolean') return bool(value);
  if (WEEK_SETTABLE[column] === 'timestamptz') return typeof value === 'number' ? iso(value) : String(value);
  if (column === 'last_error') return allowlistedJackpotCode(value);
  if (['funded_wei', 'carried_in_wei', 'prize_wei', 'unclaimed_wei'].includes(column)) return weiText(value);
  return String(value);
}

function assignments(set, params, table) {
  const out = [];
  for (const [column, value] of Object.entries(set)) {
    if (!Object.hasOwn(table, column)) throw new TypeError(`cannot set ${column}`);
    params.push(table === WEEK_SETTABLE ? weekSetValue(column, value) : value);
    out.push(`${column} = $${params.length}::${table[column]}`);
  }
  return out;
}

// Sets mirror columns of a week (no status change). → true when a row changed.
export async function updateWeek(db, { contract, weekKey, set = {} }) {
  const params = [requireAddress(contract, 'contract'), requireWeekKey(weekKey)];
  const parts = assignments(set, params, WEEK_SETTABLE);
  if (!parts.length) return false;
  const rows = await db.query(`UPDATE jackpot_weeks SET ${parts.join(', ')}, updated_at = now() WHERE contract = $1 AND week_key = $2 RETURNING week_key`, params);
  return rows.length === 1;
}

// Compare-and-set of a week's status (plus any mirror columns).
export async function casWeekStatus(db, { contract, weekKey, from, to, set = {} }) {
  const expected = (Array.isArray(from) ? from : [from]).map(String);
  if (!expected.length || expected.some((status) => !WEEK_STATUSES.includes(status)) || !WEEK_STATUSES.includes(to)) throw new TypeError('casWeekStatus needs known statuses');
  const params = [requireAddress(contract, 'contract'), requireWeekKey(weekKey), to, JSON.stringify(expected)];
  const parts = assignments(set, params, WEEK_SETTABLE);
  const rows = await db.query(
    `UPDATE jackpot_weeks SET status = $3${parts.length ? `, ${parts.join(', ')}` : ''}, updated_at = now()
     WHERE contract = $1 AND week_key = $2 AND status IN (SELECT jsonb_array_elements_text($4::jsonb)) RETURNING week_key`,
    params,
  );
  return rows.length === 1;
}

// --- Candidates ---------------------------------------------------------------

const CANDIDATE_COLUMNS = `contract, game_id, week_key, session_id32, wallet, score::text AS score, ${isoSql('submitted_at')} AS submitted_at,
  source, on_chain, was_listed, chain_rank, review, review_reason, admin_reviewed, screen, screen_codes, features::text AS features,
  ${isoSql('screened_at')} AS screened_at, ${isoSql('updated_at')} AS updated_at`;

export function candidateRowFrom(raw) {
  if (!raw) return null;
  return Object.freeze({
    contract: raw.contract,
    gameId: raw.game_id,
    weekKey: raw.week_key,
    sessionId32: raw.session_id32,
    wallet: raw.wallet,
    score: Number(raw.score),
    submittedAt: raw.submitted_at ?? null,
    source: raw.source,
    onChain: raw.on_chain === true,
    wasListed: raw.was_listed === true,
    chainRank: raw.chain_rank === null || raw.chain_rank === undefined ? null : Number(raw.chain_rank),
    review: raw.review,
    reviewReason: raw.review_reason ?? null,
    adminReviewed: raw.admin_reviewed === true,
    screen: raw.screen,
    screenCodes: raw.screen_codes ? raw.screen_codes.split(',').filter(Boolean) : [],
    features: parseJsonText(raw.features, null),
    screenedAt: raw.screened_at ?? null,
    updatedAt: raw.updated_at ?? null,
  });
}

// Inserts a candidate (keeper selection or a public submission); an existing
// row keeps its screen and review, and gains any chain facts given.
export async function upsertCandidate(db, { contract, gameId = JACKPOT_GAME_ID, weekKey, sessionId32, wallet, score, source, submittedAt = null, onChain = null, wasListed = null, chainRank = undefined }) {
  if (!['keeper', 'public'].includes(source)) throw new TypeError('source must be keeper or public');
  const rows = await db.query(
    `INSERT INTO jackpot_candidates (contract, game_id, week_key, session_id32, wallet, score, submitted_at, source, on_chain, was_listed, chain_rank, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::timestamptz, $8, coalesce($9::boolean, false), coalesce($10::boolean, false), $11::int, now())
     ON CONFLICT (contract, session_id32) DO UPDATE SET
       submitted_at = coalesce(EXCLUDED.submitted_at, jackpot_candidates.submitted_at),
       on_chain = CASE WHEN $9::boolean IS NULL THEN jackpot_candidates.on_chain ELSE $9::boolean END,
       was_listed = jackpot_candidates.was_listed OR coalesce($10::boolean, false),
       chain_rank = CASE WHEN $12::boolean THEN $11::int ELSE jackpot_candidates.chain_rank END,
       updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [requireAddress(contract, 'contract'), gameId, requireWeekKey(weekKey), requireSession(sessionId32), requireAddress(wallet, 'wallet'),
      intText(score), submittedAt === null ? null : (typeof submittedAt === 'number' ? iso(submittedAt) : String(submittedAt)), source,
      onChain === null ? null : bool(onChain), wasListed === null ? null : bool(wasListed),
      chainRank === undefined || chainRank === null ? null : intText(chainRank), bool(chainRank !== undefined)],
  );
  return { inserted: rows[0]?.inserted === true };
}

export async function readCandidates(db, { contract, weekKey = null }) {
  const rows = await db.query(
    `SELECT ${CANDIDATE_COLUMNS} FROM jackpot_candidates WHERE contract = $1 AND ($2::text IS NULL OR week_key = $2)
     ORDER BY score DESC, submitted_at ASC NULLS LAST, session_id32 ASC`,
    [requireAddress(contract, 'contract'), weekKey === null ? null : requireWeekKey(weekKey)],
  );
  return rows.map(candidateRowFrom);
}

export async function readCandidate(db, { contract, sessionId32 }) {
  const rows = await db.query(`SELECT ${CANDIDATE_COLUMNS} FROM jackpot_candidates WHERE contract = $1 AND session_id32 = $2`, [requireAddress(contract, 'contract'), requireSession(sessionId32)]);
  return candidateRowFrom(rows[0]);
}

// Candidate rows of a session under any contract (the replay endpoint).
export async function readCandidatesBySession(db, sessionId32) {
  const rows = await db.query(`SELECT ${CANDIDATE_COLUMNS} FROM jackpot_candidates WHERE session_id32 = $1`, [requireSession(sessionId32)]);
  return rows.map(candidateRowFrom);
}

const CANDIDATE_SETTABLE = Object.freeze({
  on_chain: 'boolean', was_listed: 'boolean', chain_rank: 'int', review: 'text', review_reason: 'text', admin_reviewed: 'boolean',
  screen: 'text', screen_codes: 'text', features: 'jsonb', screened_at: 'timestamptz', submitted_at: 'timestamptz',
});

function candidateValue(column, value) {
  if (value === null || value === undefined) return null;
  const cast = CANDIDATE_SETTABLE[column];
  if (cast === 'boolean') return bool(value);
  if (cast === 'jsonb') return JSON.stringify(value);
  if (cast === 'timestamptz') return typeof value === 'number' ? iso(value) : String(value);
  if (column === 'review' && !REVIEW_STATES.includes(value)) throw new TypeError(`unknown review ${value}`);
  if (column === 'screen' && !SCREEN_STATES.includes(value)) throw new TypeError(`unknown screen ${value}`);
  if (column === 'review_reason' && !REASON.test(String(value))) return 'other';
  if (column === 'screen_codes') return Array.isArray(value) ? value.join(',') : String(value);
  return String(value);
}

// Sets candidate columns. `whenScreen` makes it a compare-and-set on screen.
export async function updateCandidate(db, { contract, sessionId32, set = {}, whenScreen = null }) {
  const params = [requireAddress(contract, 'contract'), requireSession(sessionId32)];
  const parts = [];
  for (const [column, value] of Object.entries(set)) {
    if (!Object.hasOwn(CANDIDATE_SETTABLE, column)) throw new TypeError(`cannot set candidate ${column}`);
    params.push(candidateValue(column, value));
    parts.push(`${column} = $${params.length}::${CANDIDATE_SETTABLE[column]}`);
  }
  if (!parts.length) return false;
  let guard = '';
  if (whenScreen !== null) {
    params.push(JSON.stringify(Array.isArray(whenScreen) ? whenScreen : [whenScreen]));
    guard = ` AND screen IN (SELECT jsonb_array_elements_text($${params.length}::jsonb))`;
  }
  const rows = await db.query(`UPDATE jackpot_candidates SET ${parts.join(', ')}, updated_at = now() WHERE contract = $1 AND session_id32 = $2${guard} RETURNING session_id32`, params);
  return rows.length === 1;
}

// Rows of a week that are no longer in candidatesOf lose on_chain/chain_rank.
export async function clearChainRanks(db, { contract, weekKey, keepSessions = [] }) {
  await db.query(
    `UPDATE jackpot_candidates SET on_chain = false, chain_rank = NULL, updated_at = now()
     WHERE contract = $1 AND week_key = $2 AND (on_chain OR chain_rank IS NOT NULL)
       AND session_id32 NOT IN (SELECT jsonb_array_elements_text($3::jsonb))`,
    [requireAddress(contract, 'contract'), requireWeekKey(weekKey), JSON.stringify(keepSessions.map(requireSession))],
  );
}

// --- Actions ------------------------------------------------------------------

const ACTION_COLUMNS = `id, contract, game_id, week_key, kind, session_id32, reason, status, keeper, tx_hash, tx_nonce::text AS tx_nonce,
  attempts, infra_failures, last_error, ${isoSql('next_attempt_at')} AS next_attempt_at, ${isoSql('submitted_at')} AS submitted_at,
  ${isoSql('confirmed_at')} AS confirmed_at, ${isoSql('created_at')} AS created_at, ${isoSql('updated_at')} AS updated_at`;

export function actionRowFrom(raw) {
  if (!raw) return null;
  return Object.freeze({
    id: raw.id,
    contract: raw.contract,
    gameId: raw.game_id,
    weekKey: raw.week_key,
    kind: raw.kind,
    sessionId32: raw.session_id32 ?? null,
    reason: raw.reason ?? null,
    status: raw.status,
    keeper: raw.keeper ?? null,
    txHash: raw.tx_hash ?? null,
    txNonce: raw.tx_nonce === null || raw.tx_nonce === undefined || raw.tx_nonce === '' ? null : Number(raw.tx_nonce),
    attempts: Number(raw.attempts ?? 0),
    infraFailures: Number(raw.infra_failures ?? 0),
    lastError: raw.last_error ?? null,
    nextAttemptAt: raw.next_attempt_at ?? null,
    submittedAt: raw.submitted_at ?? null,
    confirmedAt: raw.confirmed_at ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  });
}

// Creates an action once (the id is the idempotency key). → { created, action }
export async function createAction(db, { contract, gameId = JACKPOT_GAME_ID, weekIndex, kind, sessionId32 = null, reason = null }) {
  const id = actionId({ gameId, contract, weekIndex, kind, sessionId32 });
  if (reason !== null && !REASON.test(reason)) throw new TypeError(`bad action reason ${reason}`);
  const rows = await db.query(
    `INSERT INTO jackpot_actions (id, contract, game_id, week_key, kind, session_id32, reason, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', now(), now())
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [id, requireAddress(contract, 'contract'), gameId, weekKeyOfIndex(weekIndex), kind, sessionId32 === null ? null : requireSession(sessionId32), reason],
  );
  return { created: rows.length === 1, action: await readAction(db, id) };
}

export async function readAction(db, id) {
  const rows = await db.query(`SELECT ${ACTION_COLUMNS} FROM jackpot_actions WHERE id = $1`, [String(id)]);
  return actionRowFrom(rows[0]);
}

export async function readWeekActions(db, { contract, weekKey }) {
  const rows = await db.query(
    `SELECT ${ACTION_COLUMNS} FROM jackpot_actions WHERE contract = $1 AND week_key = $2 ORDER BY created_at ASC, id ASC`,
    [requireAddress(contract, 'contract'), requireWeekKey(weekKey)],
  );
  return rows.map(actionRowFrom);
}

// Actions of a week that are due now, submitted ones first (receipt checks),
// then pending and signed, then failed ones whose backoff has passed.
export async function listDueActions(db, { contract, weekKey, nowMs, limit = 10 }) {
  const rows = await db.query(
    `SELECT ${ACTION_COLUMNS},
            CASE status WHEN 'submitted' THEN 1 WHEN 'signed' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END AS priority
     FROM jackpot_actions
     WHERE contract = $1 AND week_key = $2 AND (
          status IN ('pending', 'signed', 'submitted')
       OR (status = 'failed' AND next_attempt_at IS NOT NULL AND next_attempt_at <= $3::timestamptz))
     ORDER BY priority, CASE kind WHEN 'flag' THEN 1 WHEN 'clear' THEN 2 WHEN 'submit' THEN 3 ELSE 4 END, created_at ASC, id ASC
     LIMIT $4::int`,
    [requireAddress(contract, 'contract'), requireWeekKey(weekKey), iso(nowMs), intText(limit)],
  );
  return rows.map(actionRowFrom);
}

const ACTION_SETTABLE = Object.freeze({
  keeper: 'text', tx_hash: 'text', tx_nonce: 'bigint', last_error: 'text', next_attempt_at: 'timestamptz', submitted_at: 'timestamptz',
  confirmed_at: 'timestamptz', attempts: 'int', infra_failures: 'int', reason: 'text',
});
const ACTION_INCREMENTABLE = Object.freeze(['attempts', 'infra_failures']);

function actionValue(column, value) {
  if (value === null || value === undefined) return null;
  if (ACTION_SETTABLE[column] === 'timestamptz') return typeof value === 'number' ? iso(value) : String(value);
  if (column === 'last_error') return allowlistedJackpotCode(value);
  return String(value);
}

// Compare-and-set of an action's status. → true when this call moved it.
export async function casAction(db, { id, from, to, set = {}, increment = {} }) {
  const expected = (Array.isArray(from) ? from : [from]).map(String);
  if (!expected.length || expected.some((status) => !ACTION_STATUSES.includes(status)) || !ACTION_STATUSES.includes(to)) throw new TypeError('casAction needs known statuses');
  const params = [String(id), to, JSON.stringify(expected)];
  const parts = ['status = $2', 'updated_at = now()'];
  for (const [column, value] of Object.entries(set)) {
    if (!Object.hasOwn(ACTION_SETTABLE, column)) throw new TypeError(`cannot set action ${column}`);
    params.push(actionValue(column, value));
    parts.push(`${column} = $${params.length}::${ACTION_SETTABLE[column]}`);
  }
  for (const [column, amount] of Object.entries(increment)) {
    if (!ACTION_INCREMENTABLE.includes(column) || Object.hasOwn(set, column)) throw new TypeError(`cannot increment ${column}`);
    params.push(intText(amount));
    parts.push(`${column} = ${column} + $${params.length}::int`);
  }
  const rows = await db.query(
    `UPDATE jackpot_actions SET ${parts.join(', ')} WHERE id = $1 AND status IN (SELECT jsonb_array_elements_text($3::jsonb)) RETURNING id`,
    params,
  );
  return rows.length === 1;
}

// Pure: the effect of one classified keeper failure, copied from settle's
// failureTransition (server/settle/store.mjs) without its stale and re-sign
// rules. → { status, attempts, infraFailures, lastError, nextAttemptAt }
export function actionFailureTransition(action, { class: errorClass, code, nowMs }) {
  const now = Number(nowMs);
  const attempts = Number(action.attempts ?? 0);
  const infraFailures = Number(action.infraFailures ?? 0);
  if (errorClass === 'skipped') return { status: 'skipped', attempts, infraFailures, lastError: allowlistedJackpotCode(code), nextAttemptAt: null };
  if (errorClass === 'already-done') return { status: 'confirmed', attempts, infraFailures, lastError: 'already-done', nextAttemptAt: null };
  if (errorClass === 'wait') {
    return {
      status: 'failed',
      attempts,
      infraFailures: infraFailures + 1,
      lastError: allowlistedJackpotCode(code),
      nextAttemptAt: iso(now + Math.min(60_000 * 2 ** Math.min(infraFailures, 4), 15 * 60_000)),
    };
  }
  const nextAttempts = attempts + 1;
  const dead = nextAttempts >= ACTION_DEAD_AFTER;
  return {
    status: dead ? 'dead' : 'failed',
    attempts: nextAttempts,
    infraFailures,
    lastError: allowlistedJackpotCode(code),
    nextAttemptAt: dead ? null : iso(now + Math.min(30_000 * 2 ** attempts, 30 * 60_000)),
  };
}

// Records one classified failure as a CAS on the status and counters read.
// → the updated action, or null when it moved.
export async function recordActionFailure(db, { id, class: errorClass, code, nowMs, from = null }) {
  const action = await readAction(db, id);
  if (!action) return null;
  const allowed = from ?? ['pending', 'signed', 'submitted', 'failed'];
  if (!allowed.includes(action.status)) return null;
  const next = actionFailureTransition(action, { class: errorClass, code, nowMs });
  const rows = await db.query(
    `UPDATE jackpot_actions SET status = $2, attempts = $3::int, infra_failures = $4::int, last_error = $5, next_attempt_at = $6::timestamptz,
            confirmed_at = CASE WHEN $2 = 'confirmed' THEN $7::timestamptz ELSE confirmed_at END, updated_at = now()
     WHERE id = $1 AND status = $8 AND attempts = $9::int AND infra_failures = $10::int RETURNING id`,
    [id, next.status, String(next.attempts), String(next.infraFailures), next.lastError, next.nextAttemptAt, iso(nowMs), action.status,
      String(action.attempts), String(action.infraFailures)],
  );
  if (!rows.length) return null;
  return readAction(db, id);
}

// A settled submit action back to pending (a re-list of a displaced row).
export async function requeueAction(db, { id, from = ['confirmed', 'skipped'] }) {
  return casAction(db, { id, from, to: 'pending', set: { tx_hash: null, tx_nonce: null, submitted_at: null, next_attempt_at: null, last_error: null, attempts: 0, infra_failures: 0 } });
}

// Owner recovery (scripts/jackpot-ops.mjs requeue): dead actions of a week back to pending.
export async function requeueDeadActions(db, { contract = null, weekKey }) {
  const rows = await db.query(
    `UPDATE jackpot_actions SET status = 'pending', attempts = 0, infra_failures = 0, next_attempt_at = NULL, last_error = NULL,
            tx_hash = NULL, tx_nonce = NULL, submitted_at = NULL, updated_at = now()
     WHERE status = 'dead' AND week_key = $1 AND ($2::text IS NULL OR contract = $2) RETURNING id`,
    [requireWeekKey(weekKey), contract === null ? null : requireAddress(contract, 'contract')],
  );
  return rows.map((row) => row.id);
}

// --- Events -------------------------------------------------------------------

// Upserts one event row. → true when it was new.
export async function insertEvent(db, { txHash, logIndex, blockNumber, blockTimeMs, contract, event, weekKey = null, sessionId32 = null, wallet = null, amountWei = null, reason = null }) {
  const rows = await db.query(
    `INSERT INTO jackpot_events (tx_hash, log_index, block_number, block_time, contract, event, week_key, session_id32, wallet, amount_wei, reason)
     VALUES ($1, $2::int, $3::bigint, $4::timestamptz, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tx_hash, log_index) DO NOTHING RETURNING tx_hash`,
    [String(txHash).toLowerCase(), intText(logIndex), intText(blockNumber), iso(blockTimeMs), requireAddress(contract, 'contract'), String(event),
      weekKey, sessionId32, wallet, amountWei === null ? null : weiText(amountWei), reason],
  );
  return rows.length === 1;
}

export async function readEvents(db, { contract, weekKey = null, events = null, limit = 500 }) {
  const rows = await db.query(
    `SELECT tx_hash, log_index, block_number::text AS block_number, ${isoSql('block_time')} AS block_time, contract, event, week_key,
            session_id32, wallet, amount_wei, reason
     FROM jackpot_events
     WHERE contract = $1 AND ($2::text IS NULL OR week_key = $2)
       AND ($3::text IS NULL OR event IN (SELECT jsonb_array_elements_text($3::jsonb)))
     ORDER BY block_number ASC, log_index ASC LIMIT $4::int`,
    [requireAddress(contract, 'contract'), weekKey === null ? null : requireWeekKey(weekKey), events === null ? null : JSON.stringify(events), intText(limit)],
  );
  return rows.map((row) => ({
    txHash: row.tx_hash, logIndex: Number(row.log_index), blockNumber: Number(row.block_number), blockTime: row.block_time,
    contract: row.contract, event: row.event, weekKey: row.week_key ?? null, sessionId32: row.session_id32 ?? null,
    wallet: row.wallet ?? null, amountWei: row.amount_wei ?? null, reason: row.reason ?? null,
  }));
}

// --- Wallet flags ---------------------------------------------------------------

export async function upsertWalletFlag(db, { contract, wallet, blocked = null, staffEver = null, reason = undefined }) {
  await db.query(
    `INSERT INTO jackpot_wallet_flags (contract, wallet, blocked, staff_ever, reason, updated_at)
     VALUES ($1, $2, coalesce($3::boolean, false), coalesce($4::boolean, false), $5, now())
     ON CONFLICT (contract, wallet) DO UPDATE SET
       blocked = CASE WHEN $3::boolean IS NULL THEN jackpot_wallet_flags.blocked ELSE $3::boolean END,
       staff_ever = jackpot_wallet_flags.staff_ever OR coalesce($4::boolean, false),
       reason = CASE WHEN $6::boolean THEN $5 ELSE jackpot_wallet_flags.reason END,
       updated_at = now()`,
    [requireAddress(contract, 'contract'), requireAddress(wallet, 'wallet'), blocked === null ? null : bool(blocked), staffEver === null ? null : bool(staffEver),
      reason === undefined || reason === null ? null : (SHORT_REASON.test(reason) ? reason : 'other'), bool(reason !== undefined)],
  );
}

export async function readWalletFlags(db, { contract }) {
  const rows = await db.query('SELECT wallet, blocked, staff_ever, reason FROM jackpot_wallet_flags WHERE contract = $1 ORDER BY wallet', [requireAddress(contract, 'contract')]);
  return rows.map((row) => ({ wallet: row.wallet, blocked: row.blocked === true, staffEver: row.staff_ever === true, reason: row.reason ?? null }));
}

// --- Rules --------------------------------------------------------------------

export function rulesRowFrom(raw) {
  return Object.freeze({
    fromWeek: Number(raw.from_week),
    seasonId32: raw.season_id32,
    altSeasonId32: raw.alt_season_id32 ?? null,
    minPaidWei: raw.min_paid_wei,
    maxSurvivalSeconds: Number(raw.max_survival_s),
    maxScore: raw.max_score,
    maxPrizeWei: raw.max_prize_wei,
    minFundWei: raw.min_fund_wei,
    adminClearOnly: raw.admin_clear_only === true,
  });
}

// A RulesScheduled with fromWeek = F: this contract's rows from F on are
// replaced (the contract pops every epoch >= F before pushing), then inserted.
export async function replaceRulesFrom(db, { contract, rules }) {
  const address = requireAddress(contract, 'contract');
  const fromWeek = intText(rules.fromWeek);
  await db.query('DELETE FROM jackpot_rules WHERE contract = $1 AND from_week >= $2::int', [address, fromWeek]);
  await upsertRules(db, { contract: address, rules });
}

export async function upsertRules(db, { contract, rules }) {
  const alt = String(rules.altSeasonId32 ?? '').toLowerCase();
  await db.query(
    `INSERT INTO jackpot_rules (contract, from_week, season_id32, alt_season_id32, min_paid_wei, max_survival_s, max_score, max_prize_wei, min_fund_wei, admin_clear_only, updated_at)
     VALUES ($1, $2::int, $3, $4, $5, $6::int, $7, $8, $9, $10::boolean, now())
     ON CONFLICT (contract, from_week) DO UPDATE SET season_id32 = EXCLUDED.season_id32, alt_season_id32 = EXCLUDED.alt_season_id32,
       min_paid_wei = EXCLUDED.min_paid_wei, max_survival_s = EXCLUDED.max_survival_s, max_score = EXCLUDED.max_score,
       max_prize_wei = EXCLUDED.max_prize_wei, min_fund_wei = EXCLUDED.min_fund_wei, admin_clear_only = EXCLUDED.admin_clear_only, updated_at = now()`,
    [requireAddress(contract, 'contract'), intText(rules.fromWeek), String(rules.seasonId32).toLowerCase(),
      /^0x0{64}$/.test(alt) || !alt ? null : alt, weiText(rules.minPaidWei), intText(rules.maxSurvivalSeconds), weiText(rules.maxScore),
      weiText(rules.maxPrizeWei), weiText(rules.minFundWei), bool(rules.adminClearOnly === true)],
  );
}

// Deletes epochs past `count` known on-chain epochs' from_weeks (reconcile).
export async function deleteRulesNotIn(db, { contract, fromWeeks }) {
  await db.query(
    'DELETE FROM jackpot_rules WHERE contract = $1 AND from_week NOT IN (SELECT (jsonb_array_elements_text($2::jsonb))::int)',
    [requireAddress(contract, 'contract'), JSON.stringify(fromWeeks.map((week) => String(week)))],
  );
}

export async function readRules(db, { contract }) {
  const rows = await db.query(
    `SELECT from_week, season_id32, alt_season_id32, min_paid_wei, max_survival_s, max_score, max_prize_wei, min_fund_wei, admin_clear_only
     FROM jackpot_rules WHERE contract = $1 ORDER BY from_week ASC`,
    [requireAddress(contract, 'contract')],
  );
  return rows.map(rulesRowFrom);
}

// Pure rulesFor(week): the last epoch with fromWeek <= week, else the first
// epoch (the contract answers epoch 0 for earlier weeks), else null.
export function rulesForWeek(rulesList, weekIndex) {
  const list = [...(rulesList ?? [])].sort((a, b) => a.fromWeek - b.fromWeek);
  if (!list.length) return null;
  let found = list[0];
  for (const rules of list) if (rules.fromWeek <= Number(weekIndex)) found = rules;
  return found;
}

// --- Indexer cursor -----------------------------------------------------------

export function jackpotStream(contract, chainId = 4441) {
  return `litvm-${chainId}-jackpot-${requireAddress(contract, 'contract').slice(2)}`;
}

export async function readCursor(db, stream) {
  const rows = await db.query('SELECT last_block::text AS last_block FROM indexer_state WHERE stream = $1', [String(stream)]);
  return rows.length ? Number(rows[0].last_block) : null;
}

export async function writeCursor(db, stream, block) {
  await db.query(
    `INSERT INTO indexer_state (stream, last_block, updated_at) VALUES ($1, $2::bigint, now())
     ON CONFLICT (stream) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = now()`,
    [String(stream), intText(block)],
  );
}

export { iso as isoTime, text as nullableText };
