// E13 the settle retry cron (contract §4.3.11, §3.3, §3.4, A24, A31; guide D10).
//
// Every minute, at most 8 rows within a 45 s budget, in this order:
//   1. pending rows older than 30 s: re-signed by re-verification (§3.3);
//   2. submitted rows older than 180 s: receipt or getSession check, and the
//      dropped-transaction rule;
//   3. signed rows;
//   4. failed rows that are retryable with next_attempt_at <= now;
//   5. rows retryable for more than 7 days become dead letters ('stale').
// It holds the relayer lease while broadcasting (the relayer does), and
// every failure is classified and recorded (never a raw message).
// SETTLEMENT_PAUSED answers 503 with no row touched.

import { ensureSchema } from '../neon/migrations.mjs';
import { logSafeError } from './errors.mjs';
import { driveSubmission, settlementGate, submissionContext } from './settle-core.mjs';
import { deadLetterStaleRows, listDueRows, readSettleRow } from './store.mjs';

export const RETRY_BATCH_LIMIT = 8;
export const RETRY_BUDGET_MS = 45_000;
// A row is started only with this much budget left (sign, lease, broadcast).
export const RETRY_ROW_RESERVE_MS = 5_000;
const RECEIPT_WAIT_MAX_MS = 15_000;

const NO_STORE = Object.freeze({ 'Cache-Control': 'no-store' });
const json = (status, body) => ({ status, body, headers: { ...NO_STORE } });

function modulesReady(deps) {
  const verify = deps.verify;
  const catalog = deps.catalog;
  return Boolean(verify && typeof verify.reverifyStoredRun === 'function' && catalog && typeof catalog.nftAchievementIds === 'function');
}

// → { status, body: { ok:true, processed:[{ sessionId32, from, to, code }] }, headers }
export async function runSettleRetry(deps, { limit = RETRY_BATCH_LIMIT, budgetMs = RETRY_BUDGET_MS, monotonicMs = () => performance.now() } = {}) {
  const gate = settlementGate(deps);
  if (gate) return gate;
  if (!modulesReady(deps)) return json(503, { ok: false, error: 'settlement-not-configured', detail: 'verify-unavailable' });
  const { db } = deps;
  const clock = typeof deps.nowMs === 'function' ? deps.nowMs : () => Number(deps.nowMs ?? Date.now());
  await ensureSchema(db);
  const started = monotonicMs();
  const remaining = () => budgetMs - (monotonicMs() - started);
  const ctx = submissionContext(deps);
  const processed = [];
  const rows = await listDueRows(db, { nowMs: clock(), limit });
  for (const row of rows) {
    if (remaining() < RETRY_ROW_RESERVE_MS) break;
    let outcome;
    try {
      if (row.status === 'submitted') {
        outcome = await ctx.relayer().checkReceipt(row);
      } else {
        const receiptTimeoutMs = Math.max(1, Math.min(RECEIPT_WAIT_MAX_MS, remaining() - RETRY_ROW_RESERVE_MS));
        outcome = await driveSubmission(row, deps, ctx, { receiptTimeoutMs });
      }
    } catch (error) {
      // An unexpected fault leaves the row as it is for the next run.
      logSafeError('cron/settle-retry', error);
      outcome = { status: row.status, code: 'unknown-error' };
    }
    // eslint-disable-next-line no-await-in-loop
    const after = await readSettleRow(db, row.sessionId32);
    processed.push({ sessionId32: row.sessionId32, from: row.status, to: after?.status ?? outcome?.status ?? row.status, code: outcome?.code ?? null });
  }
  for (const stale of await deadLetterStaleRows(db, { nowMs: clock() })) {
    processed.push({ sessionId32: stale.sessionId32, from: stale.from, to: 'failed', code: 'stale' });
  }
  return json(200, { ok: true, processed });
}
