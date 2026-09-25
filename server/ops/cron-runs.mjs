// Cron run bookkeeping (ops-health; Neon migration 2, table `cron_runs`).
//
// /api/cron/index-chain and /api/cron/settle-retry record the outcome of every
// authorized run: one row per cron with the last success, the last error and
// its code, and run and failure counters. /api/health reports these rows and
// the owner status page warns when a cron's last error is newer than its last
// success.
//
// A stored code is never raw error text (A31): it is an allowlisted code from
// the cron's own answer (settlement-not-configured, chain-read-failed, …), or
// for a throw the error's name plus its Postgres SQLSTATE when it has one
// ('NeonDbError:57P01'). Bookkeeping never changes a cron's answer: a failed
// write is logged as one redacted line and ignored.
//
// A paused settle-retry run is not recorded: SETTLEMENT_PAUSED leaves every
// row untouched (A27), and /api/health reports the pause itself.

import { errorLogFields } from '../http.mjs';
import { ensureSchema } from '../neon/migrations.mjs';
import { ERROR_CODE_ALLOWLIST } from '../settle/errors.mjs';
import { JACKPOT_ERROR_CODES } from '../jackpot/errors.mjs';

export const CRON_NAMES = Object.freeze({ indexChain: 'index-chain', settleRetry: 'settle-retry', weeklyJackpot: 'weekly-jackpot' });

// Error codes a cron answer can carry, plus the relayer allowlist of §4.4 and
// the jackpot allowlist (design §C.4 "Codes"; otherwise a jackpot failure
// would be stored as unknown-error).
export const CRON_ERROR_CODES = Object.freeze([...new Set([
  'index-not-configured', 'settlement-not-configured', 'settlement-paused', 'address-mismatch', 'chain-read-failed',
  'verify-unavailable', 'achievements-unavailable', 'internal-error', ...ERROR_CODE_ALLOWLIST, ...JACKPOT_ERROR_CODES,
])]);
const ALLOWED_CODES = new Set(CRON_ERROR_CODES);
// Settle-gate details that name a failed module rather than env names.
const MODULE_DETAILS = new Set(['verify-unavailable', 'achievements-unavailable']);
const CRON_NAME = /^[a-z][a-z0-9-]{0,47}$/;
const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

function iso(ms) {
  return new Date(Number(ms)).toISOString();
}

function clockOf(deps) {
  return typeof deps?.nowMs === 'function' ? deps.nowMs : () => Number(deps?.nowMs ?? Date.now());
}

// An answer's error code, reduced to the allowlist ('unknown-error' otherwise).
export function allowlistedCronCode(code) {
  return typeof code === 'string' && ALLOWED_CODES.has(code) ? code : 'unknown-error';
}

// The stored code of a thrown error: its name, plus ':<SQLSTATE>' when it
// carries one. Both parts are shape-checked by errorLogFields, so no message
// text can reach the table.
export function thrownCronCode(error) {
  const { name, sqlstate } = errorLogFields(error);
  const safeName = /^[A-Za-z0-9]/.test(name) ? name.replace(/[^A-Za-z0-9_]/g, '').slice(0, 64) || 'Error' : 'Error';
  return sqlstate ? `${safeName}:${sqlstate}` : safeName;
}

// → { record:false } | { record:true, ok:true, code:null } | { record:true, ok:false, code }
export function cronOutcomeOf(result) {
  const body = result?.body && typeof result.body === 'object' ? result.body : {};
  if (result?.status === 200 && body.ok === true) return { record: true, ok: true, code: null };
  if (body.error === 'settlement-paused') return { record: false, ok: false, code: 'settlement-paused' };
  const code = MODULE_DETAILS.has(body.detail) ? body.detail : body.error;
  return { record: true, ok: false, code: allowlistedCronCode(code) };
}

// Records one run. Ensures the schema first (A34), so the table exists on a
// database that was still at version 1.
export async function recordCronRun(db, { name, ok, code = null, nowMs = Date.now() } = {}) {
  if (!db || typeof db.query !== 'function') throw new TypeError('recordCronRun needs a database client');
  if (!CRON_NAME.test(String(name ?? ''))) throw new TypeError('recordCronRun needs a cron name');
  await ensureSchema(db);
  const at = iso(nowMs);
  if (ok) {
    await db.query(
      `INSERT INTO cron_runs (name, last_ok_at, runs, failures, updated_at) VALUES ($1, $2::timestamptz, 1, 0, now())
       ON CONFLICT (name) DO UPDATE SET last_ok_at = GREATEST(cron_runs.last_ok_at, EXCLUDED.last_ok_at),
              runs = cron_runs.runs + 1, updated_at = now()`,
      [name, at],
    );
    return;
  }
  const stored = typeof code === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(code) ? code : 'unknown-error';
  await db.query(
    `INSERT INTO cron_runs (name, last_error_at, last_error_code, runs, failures, updated_at) VALUES ($1, $2::timestamptz, $3, 1, 1, now())
     ON CONFLICT (name) DO UPDATE SET
            last_error_code = CASE WHEN cron_runs.last_error_at IS NULL OR EXCLUDED.last_error_at >= cron_runs.last_error_at
                                   THEN EXCLUDED.last_error_code ELSE cron_runs.last_error_code END,
            last_error_at = GREATEST(cron_runs.last_error_at, EXCLUDED.last_error_at),
            runs = cron_runs.runs + 1, failures = cron_runs.failures + 1, updated_at = now()`,
    [name, at, stored],
  );
}

// Every cron row, keyed by name: { lastOkAt, lastErrorAt, lastErrorCode, runs, failures }.
export async function readCronRuns(db) {
  const rows = await db.query(
    `SELECT name, to_char(last_ok_at AT TIME ZONE 'UTC', ${ISO}) AS last_ok_at,
            to_char(last_error_at AT TIME ZONE 'UTC', ${ISO}) AS last_error_at,
            last_error_code, runs::int AS runs, failures::int AS failures
       FROM cron_runs ORDER BY name`,
  );
  const out = {};
  for (const row of rows) {
    out[row.name] = {
      lastOkAt: row.last_ok_at ?? null,
      lastErrorAt: row.last_error_at ?? null,
      lastErrorCode: row.last_error_code ?? null,
      runs: Number(row.runs ?? 0),
      failures: Number(row.failures ?? 0),
    };
  }
  return out;
}

async function recordSafely(name, deps, outcome, logger) {
  if (!outcome.record || !deps?.db) return;
  try {
    await recordCronRun(deps.db, { name, ok: outcome.ok, code: outcome.code, nowMs: clockOf(deps)() });
  } catch (error) {
    logger.warn(`[cron/${name}] run-record-failed`, errorLogFields(error));
  }
}

// Runs one authorized cron invocation and records its outcome. A throw is
// recorded, then re-thrown so the adapter answers 500 and logs it once.
export async function withCronRun(name, deps, run, { logger = console } = {}) {
  let result;
  try {
    result = await run();
  } catch (error) {
    await recordSafely(name, deps, { record: true, ok: false, code: thrownCronCode(error) }, logger);
    throw error;
  }
  await recordSafely(name, deps, cronOutcomeOf(result), logger);
  return result;
}
