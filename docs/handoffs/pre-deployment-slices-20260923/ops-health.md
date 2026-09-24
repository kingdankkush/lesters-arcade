# Slice brief: ops-health (post-launch hardening, guide §8 "monitoring")

**Worktree:** `C:/Users/just_/lesters-arcade-wt/ops-health`, branch `fable/pd-ops-health`. Production is live (1.8.0, `docs/qa/ranked-launch-release-20260924.json`); flags are true.
**Read first:** contract §1 (A1, A24, A28, A30, A31, A34), §3.3-3.4, §4.1, §4.3.10-11, §9.2; `server/http.mjs`, `server/config.mjs`, `api/cron/*.mjs`, `server/settle/**`, `server/indexer/index-chain.mjs`.

## Goal
Give the owner one place to see whether Ranked is healthy, and make cron failures diagnosable from Vercel logs without leaking secrets.

## Acceptance criteria
1. `GET /api/health` (new function, `createHandler`/`buildDeps` seam, fail-closed like the others, `Cache-Control: public, s-maxage=30, stale-while-revalidate=60`, unknown-parameter rejection). Public JSON with only aggregate, non-secret facts: `ok`, `version`, `settlementReady` (boolean only, never the `missing` list names of secrets), `relayer: { address, balanceWei, allowed, estimatedSettlesLeft }` (balance / (475k gas x latest base fee), rounded down), `queue: { pending, signed, submitted, failed, dead, oldestUnconfirmedAgeSeconds }` from `verified_sessions`, `index: { cursorBlock, headBlock, lagBlocks }`, `crons: { indexChain: { lastOkAt, lastErrorAt, lastErrorCode }, settleRetry: {...} }`, `baseFeeGwei`. Chain and DB reads each have a short timeout; a failed part reports `null` for its fields and `degraded: true`, never 500.
2. Cron run bookkeeping: `api/cron/index-chain.mjs` and `api/cron/settle-retry.mjs` record each run's outcome in Neon (new migration 2 with a small `cron_runs(name text primary key, last_ok_at, last_error_at, last_error_code, runs, failures)` table; migrations stay versioned, idempotent, A15 driver-independent SQL). `last_error_code` is an allowlisted code (A31) or the error's `name` plus a Postgres SQLSTATE when present; never raw error text.
3. Diagnosable failures: every `500 internal-error` path in the api layer (`server/http.mjs` catch) logs one line `console.error('[<label>] internal-error', { name, code, sqlstate })` with no message text, URL or secret, so the Vercel runtime log shows the cause class. Tests assert the logged object has only those keys.
4. Owner status page `apps/portal/owner/status.html` + `status.mjs` (noindex, CSP-safe, same conventions as `owner/confirm-dev-wallet.*`): reads `/api/health`, shows the numbers with plain warnings: relayer estimated settles left < 50, queue has failed/dead rows, oldest unconfirmed > 10 min, index lag > 20,000 blocks, a cron's last error newer than its last ok. Works at 320 px.
5. vercel.json: the health function entry (maxDuration 15), no rewrite needed; noindex for `/owner/`. Tests updated (`tests/vercel-routing.test.mjs`).
6. Tests (PGlite + fixtures, offline, < 60 s): health shapes, degraded paths, cron bookkeeping, log redaction, migration 2 on a fresh and a v1 database. Register new files in `scripts/syntax-check.mjs`.

## Out of scope
Contract changes; alerting to external services (no channel configured); any UI inside the SPA.
