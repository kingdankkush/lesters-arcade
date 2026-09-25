# Slice brief: jackpot-server (wave J2, parallel with jackpot-ui; merges first)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/jackpot-server`, branch `fable/jackpot-server`, based on the integration commit with jackpot-contracts merged (and polish-2; and version-column if it was ahead in the queue, design §G). Junction `node_modules`; never run `npm install`.

**Revision 2 (2026-09-24)** applies three reviews (design Appendix K). The main changes for this slice:
- every mirror is keyed by contract;
- new `jackpot_rules` and `seed_ticket_log` tables, and a fixed action-id format;
- a numeric selection sort;
- H9-H11, the stock-client and seed-provenance checks, and S8-S11;
- the rollover, relist and re-select rows of the state machine;
- the keeper never acts on an admin-reviewed session;
- a 300 s cron with per-call RPC timeouts;
- test seams;
- a live-`admin()` review gate with a server-computed timeline;
- `claim-pending`;
- `JACKPOT_UI_HIDDEN`;
- one additive best-effort call in `server/settle/seed.mjs`.

**Read first:**
- the design `docs/game-design/chikun-weekly-jackpot-design-20260924.md`: §0, §A.2-§A.3, §A.7-§A.10, §A.14-§A.15, §A.19, §B (all), §C (all), §D.1 (the honesty rules the API enables), §E steps E5-E7, E11 and the admin review rubric, §G, Appendix K.
- the contract: §1 (A15, A27, A28, A30, A31), §3.3-§3.4, §4.1, §9.2, §11.
- the code:
  - `server/http.mjs`, `server/config.mjs`, `server/deployment.mjs`
  - `server/neon/{migrations,queries,period-keys,rows}.mjs`
  - `server/settle/{relayer,errors,store,retry,settle-core,attestation,seed}.mjs`
  - `server/verify/{index,chikun,seed-ticket}.mjs`, `apps/portal/src/session-seed.mjs`, `server/indexer/index-chain.mjs`
  - `server/ops/{cron-runs,health}.mjs`, `api/cron/*.mjs`, `api/leaderboard.mjs`, `server/auth/bearer.mjs`, `server/share/*`
  - `apps/portal/owner/status.mjs`, `scripts/moderate-profile.mjs`, `scripts/vercel-secrets.mjs`
  - `scripts/lib/local-jackpot.mjs` (from jackpot-contracts), `scripts/lib/chikun-bots.mjs`, `scripts/chikun-course-pilot.mjs`, `scripts/chikun-difficulty-harness.mjs`

**Hard safety rule:**
- No LiteForge transactions. No Vercel env writes. No production Neon writes. Never read the vault.
- Tests use PGlite, the in-process chain and fixture keys only. Server fixtures set `VERCEL_ENV=development` and use the `RANKED_*` names (contract §11 rule 12).
- The one edit under `server/settle/**` is the additive seed-ticket log call (AC 9). It gets its own commit and must not change any settle or seed response.

## Goal

Make the jackpot automatic and observable on the server:
- the jackpot migration;
- a keeper cron that indexes jackpot events, selects, screens, submits, re-lists, clears or flags, and finalizes, following the design §C.4 state machine;
- the plausibility screen, the seed-ticket log and the calibration tool;
- the public `GET /api/jackpot` and the replay endpoint;
- the owner-only review API;
- health and status integration;
- profile and share additions;
- the secret-piping and ops scripts, and the admin review rubric.

## Acceptance criteria

1. **Migration** `000N_weekly_jackpot` (N = 3, or the next free number if version-column took 3) is exactly the design §C.2 DDL (tables `jackpot_weeks`, `jackpot_candidates`, `jackpot_actions`, `jackpot_events`, `jackpot_wallet_flags`, `jackpot_rules`, `seed_ticket_log`, plus their indexes).
   - It applies cleanly to fresh, v1 and v2 (and v3, if N = 4) databases.
   - A migration test inserts one real `jackpot_actions` id of every kind (`<game>:<contract8>:<weekIndex>:<kind>:<session|->`) and one row in every table.
   - Update every pinned schema version. The design §C.2 list is the minimum (`tests/cron-runs.test.mjs:53,60,69,86,92,111,207`, `tests/chain-indexer.test.mjs:331,332,338,373,392,395`, `tests/api-health.test.mjs:161`, `tests/moderate-profile.test.mjs:135,154`, `tests/neon-migrations.test.mjs`). Grep `tests/` for `schemaVersion`, `appliedMigrations`, `LATEST_SCHEMA_VERSION` and `[1, 2]` at your base, and list every hit in the first commit.
2. **Config** (design §C.1): the frozen `config.jackpot` sub-object.
   - The keeper key lives only in a closure.
   - `JACKPOT_CONTRACT_ADDRESS` is cross-checked against `LITVM_JACKPOT`, which is **statically imported** so the Vercel tracer bundles it.
   - `JACKPOT_PAUSED`, `JACKPOT_UI_HIDDEN`, `JACKPOT_MAX_TX_FEE_WEI` and `JACKPOT_ADMIN_WALLET` (an extra constraint, never the only gate) are supported.
   - **Seam:** `readServerConfig(env, { deployment, jackpotDeployment })`; the jackpot handlers' `buildDeps` accept `jackpotDeployment` next to the existing overrides.
   - `settlementReady`/`missing` never change because of jackpot variables (test: a missing keeper key leaves `/api/settle` readiness untouched).
   - The redaction test covers the keeper key.
3. **ABIs.** `server/chain/abis.mjs` gains `WEEKLY_JACKPOT_ABI` (the views, sends and events the server uses, including `adminReviewed`, `wasListed`, `staffEver`, `paused`, `rulesCount`, `rulesAt`), `ERC20_READ_ABI` (`balanceOf`, `decimals`, `symbol`) and the `EVENT_TOPICS` entries. `tests/chain-abis.test.mjs` passes against the new artifacts.
4. **Week helpers** `server/jackpot/weeks.mjs`: `weekIndexOf`, `weekKeyOfIndex`, `boundsOf(index, extension)`, a local date-range label, and a mapping to `periodKeyFor`, `periodStartMs` and `periodKeyResetAt`. They are identical to the contract (design §A.2), and a test runs them against the local contract's `weekBounds`.
5. **Indexer** `server/jackpot/indexer.mjs` (design §C.3):
   - one stream per instance, `litvm-4441-jackpot-<contract hex>`, for the active instance and every non-terminal `retired[]` instance;
   - address-filtered `getLogs`, 5,000-block chunks, a 15 s budget, **an 8 s timeout on every RPC call**;
   - the cursor moves only after a chunk succeeds;
   - permanent row errors are skipped, **except** that a non-conforming reason is stored as `'other'`;
   - idempotent mirrors, including `jackpot_rules` (delete-from-F then insert) and `staff_ever`;
   - a post-index reconcile through `candidatesOf`, `weekState`, `reviewOf` and `adminReviewed` for listed candidates, and `rulesCount`/`rulesAt`;
   - `CandidateSubmitted` from a non-keeper creates `source='public'`, `screen='pending'`.
6. **Selection** `server/jackpot/select.mjs`: the §C.4 SQL (numeric sort in every `ORDER BY`, `::text` only in the projection, `minPaidWei` compared as `numeric` in SQL), every parameter a string; code drops `maxTicks ≠ 216000` rows; the top 5 of the first 10; board order. Unit tests cover each filter and the 9,999 vs 48,213 case. Test-only `deps.jackpotSelect(rows)` filter seam.
7. **Screen** `server/jackpot/screen.mjs` and `plausibility.mjs` (design §B.3-§B.4):
   - integrity: `reverifyStoredRun` plus a jackpot-local copy of `sameRun` (it is module-private in `server/settle/attestation.mjs:128`) with a parity test against settle's behaviour; a jackpot-local full `ScoreRecord` decoder for `getSession` (the settle reader returns only `{exists, player, submittedAt}`); the chain cross-check; `checkEligibility`;
   - the stock-client check (`maxTicks === 216000`) and the seed-provenance check against `seed_ticket_log` (MAC recomputed with `seedTicketMacInput` and `SESSION_SECRET`, seed re-derived with `deriveRankedSeed`, `issuedAt` inside the A26 bounds);
   - features, including `evidenceDelaySeconds`;
   - hold rules H1-H11 with the exact v1 thresholds (H11 active only under `adminClearOnly` or a non-testnet token);
   - soft signals S1-S11, with **S8 implemented in v1** against the stock view edge and S10 best effort (`null` on RPC failure, ≤ 20 calls);
   - the review `timeline` (intervals, altitude samples every 6 ticks, obstacle visible ticks, route-commit ticks, whether each fast pair changed the trajectory);
   - the result `{ result, codes, features, soft, timeline }`;
   - infrastructure failure gives `error` and is never a flag.
8. **Keeper** `server/jackpot/{keeper,store,errors}.mjs` (design §C.4 send protocol):
   - the pre-send idempotency and authority read: **clear/flag on an `adminReviewed` or disqualified session → `skipped` with `review-locked`**, re-run before any re-send of a dropped transaction;
   - its own lease row through the exported `ensureLeaseRow`/`acquireLease`/`releaseLease`/`readLease`;
   - `estimateGas` × 1.25;
   - `maxFeePerGas = max(10 × base, 5 gwei)` with a 0 tip;
   - the fee cap → `fee-too-high`; balance → `keeper-underfunded`;
   - the nonce with gap guard;
   - CAS to `submitted` with `tx_hash` **before** broadcasting;
   - the dropped-transaction check after 180 s;
   - `JACKPOT_REVERTS` classification per design §A.15 (rev. 2 table);
   - backoff copied from `failureTransition`;
   - dead after 3 deterministic failures;
   - codes on the jackpot allowlist;
   - test-only `deps.keeperFault(stage)` at `'after-cas'`, `'after-broadcast'` and `'before-receipt'`.
9. **Seed-ticket log** `server/jackpot/ticket-log.mjs` and **one additive call in `server/settle/seed.mjs`** after `issueSeedTicket` succeeds (design §C.4 "Seed tickets"): best effort inside `try/catch`, logged with `logSafeError`, never delaying or changing the response, a no-op when the table is missing. Tests: the row is written; a database failure still returns 200 with the same ticket; the existing seed tests pass unchanged.
10. **Cron** `api/cron/weekly-jackpot.mjs`:
    - the handler seam of `api/cron/settle-retry.mjs`;
    - the gate order of design §C.4;
    - `withCronRun('weekly-jackpot', …)`;
    - `attachSettleDeps(base, { env, relayer: false })`;
    - a 120 s soft budget (the function allows 300 s), up to 5 screens and 3 sends per week per run, screening order on-chain-by-rank first;
    - the state machine table of design §C.4 rev. 2, exactly, including the empty-leader finalize row, the relist row, the `WeekExtended` re-select row, the full `awaiting-admin` trigger list, `admin_waiting_since`, and `claim-pending`;
    - every instance in `[active, ...retired]` with non-terminal weeks;
    - a `Finalized` event seen at any point makes the week terminal (or `claim-pending`).
    - Return `{ ok:true, weeks:[{ contract, weekKey, from, to, code }] }`.
    - Add `weeklyJackpot` to `CRON_NAMES` and the jackpot codes to `CRON_ERROR_CODES` (`server/ops/cron-runs.mjs`).
11. **`GET /api/jackpot`** (`api/jackpot.mjs`):
    - exactly the design §C.5 rev. 2 shape (`current.rules`, `pot.prizeWei`/`carryOverWei`/`funded`, a score-only open-week leader, per-row `token` and `contract`, `unclaimedWei`, `claim-pending`, `startsAt`/`closesAt` in history);
    - query allowlist `game`, `history`;
    - `Cache-Control: public, s-maxage=30, stale-while-revalidate=120`;
    - `live:false` when unconfigured, undeployed or `JACKPOT_UI_HIDDEN`;
    - Neon only (no RPC); amounts only from the mirrors; rules from `jackpot_rules`;
    - names through `publicDisplay`;
    - review values in public: `cleared | in-review | disqualified`.
12. **`GET /api/jackpot/replay?session=`** (`api/jackpot-replay.mjs`): a replay-file-v1 JSON only for candidates of weeks that have closed; otherwise 404 `not-available`; the §C.5 cache header. The output imports cleanly with `importChikunReplay`.
13. **`GET /api/jackpot/review?week=`** (`api/jackpot-review.mjs`):
    - bearer auth; the caller must equal the **live on-chain `admin()`** (one `eth_call`, 60 s memory cache) and, when set, `JACKPOT_ADMIN_WALLET` (403 `not-admin`);
    - `no-store`;
    - the design §C.6 payload: every candidate (listed, displaced, disqualified) with features, hold codes with rule text, soft signals, integrity and provenance results, on-chain review with `adminReviewed`/`wasListed`, action states, explorer links, the wallet's last 20 Chikun runs, the `timeline`, and `nextEligible` (the next 10 unlisted selection rows).
14. **Health and status:**
    - `server/ops/health.mjs` gains `crons.weeklyJackpot` and a `jackpot` part (`configured`, `keeperAddress`, `keeperBalanceWei`, `paused: { env, onChain }`, `uiHidden`, `awaitingAdmin`, `awaitingAdminOldestHours`, `claimPending`, `failed`). A failed part reports `null` plus `degraded`.
    - `apps/portal/owner/status.mjs` gains `CRON_LABELS.weeklyJackpot`, `staleCronSeconds.weeklyJackpot = 1200`, and warnings for keeper < 0.05 zkLTC, either pause, `awaiting-admin` (with a link to `/owner/jackpot.html`; an error after 7 days), `claim-pending` and `failed` weeks.
    - Update `tests/api-health.test.mjs` and `tests/owner-status-page.test.mjs`.
15. **Profile and share** (design §C.7):
    - `readPublicProfile` always returns `jackpot.wins` (possibly empty), only weeks with `prize_wei > 0` and status `paid` or `claim-pending`, with the token and date range **from the week row**;
    - the share page and card show the champion badge (with a date range, not an ISO key) for those weeks' winning sessions;
    - `cardRevision` includes it;
    - no "leader" state appears on cached share assets;
    - update the pinned profile and share tests.
16. **`vercel.json`:**
    - functions: `api/cron/weekly-jackpot.mjs` `{ maxDuration: 300, memory: 1024, includeFiles: 'apps/chikun/assets/obstacle-shapes.json' }`, `api/jackpot.mjs` `{ maxDuration: 10 }`, `api/jackpot-replay.mjs` `{ maxDuration: 10 }`, `api/jackpot-review.mjs` `{ maxDuration: 30, memory: 1024, includeFiles: 'apps/chikun/assets/obstacle-shapes.json' }`;
    - cron `{ path: '/api/cron/weekly-jackpot', schedule: '*/5 * * * *' }`;
    - rewrites `/api/jackpot/replay` → `/api/jackpot-replay`, `/api/jackpot/review` → `/api/jackpot-review`, `/jackpot/chikun` → `/jackpot/chikun.html`. The rules page file itself is created by jackpot-ui; until it merges, the rewrite target 404s harmlessly.
    - Update `tests/vercel-routing.test.mjs`, with a comment on the 300 s like index-chain's.
17. **Scripts** (contract §11 rule 13: dry runs by default; confirm phrases; secrets read in-process and never printed; tested with fixtures):
    - `scripts/jackpot-secrets.mjs`: `JACKPOT_KEEPER_PRIVATE_KEY` from `--key-file --key-field`, and `JACKPOT_CONTRACT_ADDRESS` from `LITVM_JACKPOT`. Values go to `vercel env add … production` over **stdin only**, with `--apply --confirm SET_JACKPOT_SECRETS`. It refuses any key field named like the operator's. Reuse `scripts/vercel-secrets.mjs` exports where they exist; otherwise mirror its guards. Do not edit it.
    - `scripts/jackpot-ops.mjs`: `status`, `requeue --week` (`REQUEUE_JACKPOT`), `rescreen --session` (never creates a clear or flag for an admin-reviewed session), `prune-tickets --older-than 60d` (`PRUNE_TICKET_LOG`). It uses the `moderate-profile.mjs` pattern and refuses while the schema is behind.
    - `scripts/chikun-plausibility-calibrate.mjs` (design §B.4, §C.8): `--human-dir`, `--from-neon` with `--vouched <file>` (unvouched rows never enter a gate denominator), `--bots N`, `--probe`, `--seed-variance`, `--out`. The receipt reports sets (a), (b) and (c) separately.
    - `scripts/lib/chikun-evasion-pilots.mjs`: the humanised solver and the widened-view pilot (set (b)).
18. **Docs.** The `## Server` section of `docs/web3/weekly-jackpot-operations.md`: the env table, cron behaviour and states, the review API, the ops scripts, the calibration protocol, and **the admin review rubric, SLA and 7-day default** (design §E) verbatim.

## Files

**You own:**
- C `server/jackpot/*.mjs` (including `ticket-log.mjs`, the local `sameRun` copy and the full `getSession` decoder)
- C `api/jackpot.mjs`, `api/jackpot-replay.mjs`, `api/jackpot-review.mjs`, `api/cron/weekly-jackpot.mjs`
- C `scripts/jackpot-secrets.mjs`, `scripts/jackpot-ops.mjs`, `scripts/chikun-plausibility-calibrate.mjs`, `scripts/lib/chikun-evasion-pilots.mjs`
- C exactly these tests: `tests/jackpot-server-migration.test.mjs`, `tests/jackpot-server-config.test.mjs`, `tests/jackpot-server-select.test.mjs`, `tests/jackpot-server-screen.test.mjs`, `tests/jackpot-server-keeper.test.mjs`, `tests/jackpot-server-cron.test.mjs`, `tests/jackpot-server-api.test.mjs`, `tests/jackpot-server-ticket-log.test.mjs`, `tests/jackpot-server-calibrate.test.mjs`; fixtures under `tests/fixtures/jackpot-server/**`
- E `server/neon/migrations.mjs`, `server/config.mjs`, `server/chain/abis.mjs`, `server/neon/queries.mjs` (profile wins, share champion and revision only)
- E `server/settle/seed.mjs` (**one additive best-effort call only**, AC 9, its own commit)
- E `server/share/render-page.mjs`, `server/share/render-card.mjs`
- E `server/ops/cron-runs.mjs`, `server/ops/health.mjs`, `apps/portal/owner/status.mjs`
- E `vercel.json`
- E the pinned tests named above
- E `docs/web3/weekly-jackpot-operations.md` (Server section)
- E `scripts/syntax-check.mjs` (after `'tests/moderate-profile.test.mjs',`)

**Read-only:**
- `contracts/**`, `scripts/lib/local-jackpot.mjs`, `apps/portal/src/generated/litvm-jackpot.mjs`
- `server/settle/**` except the one call in `seed.mjs` (import the exported lease, error and store helpers; never edit settle behaviour)
- `server/verify/**`, `server/indexer/index-chain.mjs`
- every UI file (jackpot-ui is parallel), and every `tests/jackpot-ui-*`, `tests/jackpot-rehearsal*`, `tests/jackpot-api-contract*`, `tests/jackpot-live-dry-run*` and `tests/jackpot-deploy-tooling*` file

## Interfaces

- **Produced:**
  - `/api/jackpot`, `/api/jackpot/replay` and `/api/jackpot/review`, with the exact design §C.5-§C.6 shapes; jackpot-ui builds against them;
  - the profile field `jackpot.wins`;
  - the `jackpot_*` and `seed_ticket_log` tables;
  - `server/jackpot/weeks.mjs`;
  - `plausibility.mjs` (server only; never import it from `apps/**`);
  - the test seams `jackpotDeployment`, `deps.jackpotSelect` and `deps.keeperFault` (J2 → J3; document them in the module headers).
- **Consumed:**
  - `WeeklyJackpot` artifacts and revert strings (design §A.15);
  - `LITVM_JACKPOT`;
  - `deployLocalJackpot` for tests;
  - `reverifyStoredRun`, `createChainReader`, the lease functions, `decodeRevertReason`, `classifyRelayError`, `withCronRun`, `errorLogFields`, `seedTicketMacInput`, `deriveRankedSeed`.

## Plan

1. Migration and the schema-pin updates (grep list in the commit); config, seams and redaction; ABIs. Commit.
2. `weeks.mjs` and `select.mjs`, with PGlite fixtures: board parity, every filter, the numeric sort, the season list from `jackpot_rules`. Commit.
3. `ticket-log.mjs` and the one `seed.mjs` call, with the failure test. Commit (own commit).
4. `plausibility.mjs` and `screen.mjs`:
   - features and holds tested on `tests/fixtures/chikun-v6-replays.json` (bot models must pass H4-H6);
   - short scripted-pilot runs generated in the test with `pilotFor('routePilotLandscape')` and a 3-minute `maxTicks` (must hold H4/H5/H6, and H7 for the non-stock `maxTicks`);
   - synthetic evidence for H1-H3, H9 (late evidence) and H10 (missing ticket);
   - integrity and provenance cases (bad MAC, seed mismatch);
   - S8 on a widened-view pilot fixture.
   Commit.
5. `store.mjs`, `errors.mjs` and `keeper.mjs`, tested on the in-process chain with `deployLocalJackpot`: lease, fee cap, underfunding, the CAS before broadcast, the dropped-transaction recovery, revert classification, and **a stale keeper flag after an admin clear is skipped**. Commit.
6. `indexer.mjs` and the cron state machine, tested end to end on PGlite plus the local chain, with `nowMs` injected and chain time moved:
   - unfunded (below `minFundWei`);
   - the happy path;
   - a public challenge;
   - flagged → `awaiting-admin` → an admin clear resumes;
   - no eligible leader → finalize rolls over;
   - five public decoys displace the list → admin disqualifies → the keeper re-lists the displaced honest rows;
   - `WeekExtended` after `review` → re-select;
   - someone else finalizes;
   - a failed prize transfer → `claim-pending` → claim → `paid`;
   - a crash after broadcast (`keeperFault`);
   - a dead action → `failed` → requeue.
   Commit.
7. The three API endpoints with fake-http tests (shape, headers, allowlist, `live:false` including `JACKPOT_UI_HIDDEN`, no amount before funding, `prizeWei` under a cap, score-only open leader, per-row token, replay availability, review auth against a rotated admin). Commit.
8. Health, status page, profile and share additions, `vercel.json`, the scripts, the calibration tool with `--probe` and its receipt, the evasion pilots, docs with the rubric, syntax-check, the full gate. Commit.

## Tests (titles)

- "jackpot migration applies to fresh and older databases, is idempotent, and accepts every action id kind"
- "jackpot variables never change settlement readiness"
- "config redacts the keeper key everywhere"
- "week helpers match the contract at every boundary"
- "selection is stricter than the board, sorts scores numerically and keeps board order"
- "selection excludes late, chain-index, mismatched, excluded, blocked, disqualified, staff, underpaid and non-stock rows"
- "seed ticket logging never changes the seed response"
- "bot-model replays pass the screen and scripted pilots are held"
- "late evidence, missing tickets and non-stock clients are held or flagged"
- "integrity failures flag and infrastructure errors never do"
- "keeper uses its own lease row and never the relayer's"
- "keeper records the tx hash before broadcasting"
- "keeper waits on fee spikes and low balance"
- "keeper recovers a dropped transaction"
- "keeper never overrides an admin decision"
- "revert strings map to already-done, skipped, wait and deterministic"
- "indexer mirrors every jackpot event idempotently, per contract, and ignores other addresses"
- "cron walks a funded week from close to paid"
- "cron marks an unfunded week and sends nothing"
- "cron screens and clears a public challenger within three runs"
- "cron waits for the admin when the leader is flagged"
- "cron rolls over a week with no eligible leader"
- "cron re-lists displaced candidates after decoys are disqualified"
- "cron finishes a week someone else finalized"
- "cron tracks a failed prize transfer until it is claimed"
- "jackpot API shape, cache header and allowlist"
- "jackpot API never reports an amount that was not funded on chain, and reports the capped prize"
- "replay endpoint serves only closed-week candidates"
- "review endpoint requires the current on-chain admin"
- "health and status report the jackpot cron, keeper and pauses"
- "profile lists jackpot wins with their own token and never zero-prize weeks"
- "share badge marks paid champions and busts the card cache"
- "jackpot secrets travel only over stdin"
- "calibration tool gates the must-hold set and reports the known-evasion set"

Every file runs offline in under 60 s. Long replays must be capped: no test replays a 60-minute run except one H1 case, which may use a precomputed `run-complete` evidence fixture of ≤ 20 KB.

## Pitfalls

- **Never push jackpot variables into `missing[]`.** That would 503 `/api/settle` and settle-retry.
- **Neon HTTP is one statement per request with no sessions.** The lease is a row, not a lock. Every write is a CAS, as in `server/settle/store.mjs`.
- **A15 typing.** SELECTs return text, int4 or bool only. Bigints and JSON go through `::text`; timestamps through `isoSql`. **Cast only in the final projection**; sort on the numeric columns.
- **Chain-index rows have no evidence.** Selection must join `session_evidence`, and a public candidate without evidence is flagged `integrity`.
- **The weekly board keeps `chain_mismatch` and `chain-index` rows; the jackpot must not.**
- **Replay needs `apps/chikun/assets/obstacle-shapes.json`** in the cron's and the review function's `includeFiles`, or verify fails closed.
- **Codes must be on both allowlists,** the jackpot one and `CRON_ERROR_CODES`, or `cron_runs` stores `unknown-error`.
- **Never log error messages** (they can embed the RPC URL). Use `errorLogFields`.
- **`relayer.mjs` `submit` is hard-wired to `verified_sessions`.** Copy the protocol; do not call it.
- **Time.** Tests must drive both `nowMs` and the chain timestamp. A mismatch causes false `PAYOUT_NOT_DUE`.
- **Staff wallets.** The keeper, admin and operator are `staffEver`; the fixture keeper must never also be a player in tests.
- **The seed-ticket call is on the live Ranked path.** Wrap everything; a thrown error, a slow insert or a missing table must never change the response or its timing beyond one awaited no-op. If in doubt, fire and forget with a caught promise.
- **An RPC call cannot be cancelled by a soft budget.** Give every call its own timeout.

## Definition of done

- Acceptance criteria 1-18 hold.
- The listed tests pass.
- `npm test`, `npm run check`, `npm run contracts:check` and `npm run build` pass, and `npm run test:release` shows exactly 51. Do not commit the gate JSON.
- No LiteForge, Vercel or production Neon access.
- The final commit message lists the new functions, the cron schedule, the migration number, and the measured local re-replay time.
