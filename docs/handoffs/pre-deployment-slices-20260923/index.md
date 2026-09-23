# Slice brief: index (wave 1, parallel with contracts and chikun-tune → achievements)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/index`, branch `fable/pd-index`, base = the integration-branch commit that adds the contract doc on top of `06ebe4ca` (or `06ebe4ca` itself).

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A6, A8, A14, A15, A22, A23, A24, A26, A28, A29, A30, A31, A34), §2.5, §3 (all), §4 (all, especially §4.1, §4.2, §4.3.4-§4.3.10 and §4.5), §6.3 (headline keys), §6.5, §7.5 (card revision), §7.8 (`name-moderation.mjs`), §8.1-§8.5, §9.2, §10, §11, §14 (why these rules exist);
- guide §5.2 and §4.

## Goal

Build the server foundation every later slice stands on:
- the shared HTTP and config helpers;
- versioned Neon migrations for **all** tables, including the settle, lease and nonce tables that settle uses;
- the read APIs (leaderboard, public profile and preferences, profile refresh, public verified session);
- the chain indexer cron;
- the sanitizer fix;
- the complete `vercel.json` routing, functions and crons, with fail-closed stubs for endpoints other slices own;
- the service-worker `/api/` bypass;
- a PGlite test harness.

## Acceptance criteria

1. **`server/http.mjs`** exports exactly the helpers in §4.1.
   - `readJsonBody` enforces `maxBytes` from `content-length` before parsing, and from `Buffer.byteLength(JSON.stringify(req.body))` when Vercel has already parsed the body. It returns 413 `body-too-large` / 400 `invalid-json`.
   - `ipBucket` folds IPv6 to its /64 before the HMAC (IPv4 and IPv4-mapped IPv6 use the v4 address). Test: two addresses in one /64 share a bucket; different /64s do not.
   - `queryOf(req, allowed)` rejects undeclared parameters with 400 `invalid-query`.
   - **The handler seam (A30).** Every `api/*.mjs` module you write (stubs included) exports `buildDeps(env, overrides)`, `createHandler(depsFactory)` and `export default createHandler(() => buildDeps())`. `createHandler` checks the Bearer token before the body is read where the endpoint needs auth. Write a small shared helper for this in `server/http.mjs` (for example `makeHandler({ methods, auth, maxBytes, query, run })`) so every endpoint uses the same adapter. Tests mount `createHandler(() => buildDeps(fixtureEnv, { db, provider, deployment, nowMs }))` with fake `req`/`res`.
2. **`server/config.mjs`** exports `readServerConfig(env, { deployment })` exactly as in §9.2 and A28:
   - the `RANKED_*` names; any legacy name (`VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `SCORE_REGISTRY_ADDRESS`) present makes `settlementReady` false and lists `legacy-env-present:<NAME>` in `missing`;
   - **no secret strings on the object**: secrets live in closures behind `session.secret()`, `neon.createClient()`, `verifier.createSigner(ethers)`, `relayer.createWallet(ethers, provider)` and `cron.matches(header)` (SHA-256 both sides, then `timingSafeEqual`);
   - `toJSON()`, `toString()` and `[Symbol.for('nodejs.util.inspect.custom')]` all redact. A test passes fixture secrets and asserts none appears in `util.inspect(config, { depth: 10, showHidden: true })`, `String(config)` or `JSON.stringify(config)`;
   - an absent `VERCEL_ENV` is `production`; `paused` from `SETTLEMENT_PAUSED === 'true'`; `minPaidWei` from `RANKED_MIN_PAID_WEI` (default `'100100000000000000'`).
   - **`server/deployment.mjs`** exports `loadDeployment()`: a dynamic `import('../apps/portal/src/generated/litvm-addresses.mjs')` with a fallback of `{status:'unavailable', chainId:4441, startBlock:null, addresses:{…all null…}}`. The contracts slice creates that module in parallel.
3. **`server/neon/migrations.mjs`** holds `MIGRATIONS` with migration 1 = **exactly** the §3.2 DDL (including the revision-2 columns `infra_failures`, `resigns`, `opened_at`, `entry_amount_wei`, `client_claim`, `plausibility`, `chain_mismatch`, `name_blocked`, `board_excluded`, and the allowlisted `last_error` CHECK), plus `migrate(db)` and `ensureSchema(db)` per A34:
   - memoized per process in a module-level `Map` keyed by `db.schemaKey`; a failure clears the entry;
   - a version check first; `migrate` only when behind; one retry on SQLSTATE `42P07`, `42710` or `23505`;
   - `server-neon.mjs` `createNeonClient` gains `schemaKey` (host plus database name, never the password), and the PGlite helper gives each instance a unique `schemaKey`;
   - every handler and cron that touches Neon calls `ensureSchema(db)` first, and caches its Neon client at module scope;
   - **handler tests start from an unmigrated PGlite**, so a missing `ensureSchema` call fails them;
   - `scripts/neon-migrate.mjs` applies them with `NEON_DATABASE_URL` from the environment and prints only the applied versions;
   - applying twice is a no-op (test).
4. **Driver independence (A15).** Every query returns only text, int4 or boolean columns, and every parameter is a string or null. `tests/helpers/pglite-client.mjs` exports `createPgliteClient() → { query(sql, params) → rows, close() }`, backed by `@electric-sql/pglite` in memory. It is reused by settle, results-share and rehearsal.
5. **`server/neon/queries.mjs`** exports:
   - `readLeaderboard(db, { gameId, seasonId, period, periodKey, page, pageSize = 25, q, wallet })` returning `{ total, rows, you }`, per §4.3.5 and D1: `board_excluded` wallets never rank, hidden names are null, and `q` never matches a hidden name;
   - `readWalletStanding(db, { gameId, seasonId, wallet })` returning `{ weekly, monthly, allTime }`, each `{ rank, score } | null` (null for an excluded wallet);
   - `readPublicProfile(db, wallet, { self })` per §4.3.6: the public view lists only confirmed recent sessions; the self view adds every non-pending status with `retryable`, `lastError`, `nextAttemptAt`, `preferences` and `profile.nameBlocked`; `nft` comes from the current catalog (lazy import, empty fallback);
   - `readPublicSession(db, sessionId32)` per §4.3.8, with the `hidden` rule, `verification`, and `cardRev` (§7.5, `sha256Hex` over `{ status, displayName, avatarUri, hidden, verification }`, first 12 hex after `0x`). It never returns `client_claim` or `plausibility`;
   - `readAchievementHistory(db, { wallet, gameId, fields: { sum, max }, excludeSessionId32 })` per §6.5. It rejects any path that fails the regex, and builds SQL only from validated paths;
   - `upsertWalletProfile(db, { wallet, displayName, handleHash, avatarUri, profileBlock, onchainUpdatedAt })`;
   - `writePreferences(db, wallet, preferences)`.

   Also `server/neon/rate-limit.mjs` `hitRateLimit(db, { bucket, limit, windowSeconds, nowMs })` returning `{ ok, hits, retryAfterSeconds }` (single-statement upsert). `server/neon/period-keys.mjs` exports `periodKeysFor(ms)` returning `{ day, week, month }` via `leaderboard-engine.mjs` `periodKeyFor`, and `periodResetAt(period, ms)`. `server/neon/rows.mjs` maps rows to the API shapes.
6. **Endpoints** E5 `api/leaderboard.mjs`, E6/E7 `api/profile.mjs`, E8 `api/profile-refresh.mjs`, E9 `api/verified-session.mjs` and E12 `api/cron/index-chain.mjs` behave exactly as in §4.3, including status codes, error codes and Cache-Control.
   - E6 GET is public and server-derived; the self view is the distinct URL `?wallet=…&self=1` with a required Bearer token and `private, no-store` (E6s). E7 PUT accepts preferences only.
   - E8 applies `refresh:w:<wallet>` only with a Bearer token for that wallet, otherwise only the IP bucket.
   - E9: 404 is cached `public, s-maxage=30`; unknown query parameters are 400.
   - `profileRequest` stays the exported pure name in `api/profile.mjs`.
   - Every handler module (stubs included) exports `buildDeps` and `createHandler` per A30.
7. **Stubs.** `api/session-nonce.mjs`, `api/settle-status.mjs`, `api/cron/settle-retry.mjs`, `api/share-page.mjs`, `api/share-card.mjs` and `api/ranked-seed.mjs` exist and answer `503 {ok:false, error:'not-implemented'}`, each with a pure `…Request` export, `buildDeps`, `createHandler` and the default export.
8. **Indexer.** `server/indexer/index-chain.mjs` exports `indexChain({ db, deployment, getLogs, getBlock, call, nowMs, budgetMs = 45000, chunk = 5000, maxChunks = 10 })`, implementing §4.3.10 with injected chain access. `api/cron/index-chain.mjs` wires it to ethers `JsonRpcProvider(RPC_URL, 4441, { staticNetwork: true })` and runs `migrate(db)` first (A34), returning `schemaVersion`.
   - Every `getLogs` call passes an explicit `address` for its stream (score registry; the three collections; `PlayerProfileRegistry`).
   - An existing row is confirmed only when the log's player, gameId32 and score equal the row's; otherwise `chain_mismatch = true` and it counts under `mismatches`.
   - Unknown games or seasons are skipped and counted, never inserted; a per-log failure never freezes `last_block`.
   - Orphan rows take period keys from `getPaidSession(id).openedAt` when it exists, else the block time.
   - Reverse maps come from the ids in §2.1 and §2.2. The achievement-id reverse map is a lazy `import('../../apps/portal/src/achievements/index.mjs')` with an empty fallback, because the achievements slice runs in parallel.
   - Cron auth is `Authorization: Bearer ${CRON_SECRET}`.
9. **Chain helpers.** `server/chain/abis.mjs` holds human-readable fragments for every function and event in §8.2-§8.5 that the server uses; a test proves each exists in `contracts/artifacts/<Name>.json`. `server/chain/public-rpc.mjs` exports `createPublicProvider({ rpcUrl, chainId })`.
10. **Profile sanitizing and moderation (A29).**
    - `apps/portal/src/name-moderation.mjs` per contract §7.8: `moderateName(cleaned) → { ok, reason }`, pure, importing only `username-registry.mjs` (`containsBlockedTerm`; that module has no imports). It is shared with the browser: profile-boards uses it in wave 3, so keep the API exactly as specified. Tests (`tests/name-moderation.test.mjs`): "blocks profanity and impersonation after look-alike folding"; "allows normal names".
    - `server/profile/sanitize.mjs` exports `sanitizeOnchainProfile(getProfileResult)` returning `{ displayName, nameBlocked, handleHash, avatarUri }` per §8.4: a name that fails the charset or `moderateName` is `displayName: null`, with `nameBlocked` set for moderation failures. Also `sanitizePreferences(input)` per §4.3.6. The upsert never touches `hidden` or `board_excluded`.
    - `scripts/moderate-profile.mjs --wallet 0x… (--hide | --unhide | --exclude | --include) [--apply]`: dry run by default, `NEON_DATABASE_URL` from the environment, never printed. After `--hide` it prints that share cards refresh within an hour (their `s-maxage`) and how to purge the Vercel cache for immediate removal. Test it against PGlite through an injected client.
    - Fix `apps/portal/src/server-session.mjs` `sanitizeProfileDocument` (guide §5.2 item 5): keep `:` `-` `T` `.` `Z` in `recordedAt` (ISO), allow emoji and multi-codepoint avatars up to 8 UTF-16 units, and accept `0x`-prefixed 64-hex `envelopeHash` (store it lowercase with `0x`). Keep the export name.
11. **`vercel.json`** carries every entry in §4.5 except the CSP, with rewrites in the stated order and position. Existing entries stay, including the pinned `/(profile|scores|leaderboards|settings)`.
    - Add `apps/portal/assets/share-cards/.gitkeep`, so the `includeFiles` glob matches from day one.
    - `tests/vercel-routing.test.mjs` gains "API, share and profile deep links route to their functions", "crons and function limits are declared", "noindex covers profile, share and owner pages", and "every functions entry points at an existing file".
12. **Service worker.** `apps/portal/sw.js` never intercepts a same-origin `/api/` request (A23). Update `tests/portal-service-worker-cache.test.mjs`: add "same-origin API requests stay outside the worker" and keep the others. Do **not** change `CACHE_VERSION`; that happens at deployment.
13. **Fail closed.** With no env at all, every new endpoint returns its 503 code, and no handler throws (test with an empty env). A second test sets only the legacy names and proves `settlementReady` is false.

## Files

- **You own:** contract §10.2, row index.
- **Read-only:**
  - `apps/portal/src/leaderboard-engine.mjs` (import `periodKeyFor`; chikun-tune edits line `:144`);
  - `apps/portal/src/achievements/**` (parallel slice; lazy import only);
  - `apps/portal/src/username-registry.mjs` (import `containsBlockedTerm` only; profile-boards edits `validateUsername` in wave 3);
  - `apps/portal/src/generated/**` (contracts);
  - `api/settle.mjs`, `api/session.mjs`, `api/attest.mjs` (the settle slice owns them in wave 2);
  - `main.js` and all portal UI.

## Interfaces

- **Produced:** §3 DDL; §4.1 helpers and the A30 handler seam; §4.3.5-§4.3.10 endpoints; `readAchievementHistory`; `hitRateLimit`; `readPublicSession` with `cardRev` (results-share's share page and card consume it); `createPgliteClient`; `readServerConfig`; `loadDeployment`; `createPublicProvider`; the ABIs (including `getPaidSession`, which settle and the indexer use); `name-moderation.mjs` (profile-boards consumes it); `scripts/moderate-profile.mjs` (the owner uses it; runbook checkpoint O2).
- **Consumed:** `leaderboard-engine.mjs` `periodKeyFor`; `server-neon.mjs` `createNeonClient`; `server-session.mjs` `verifySessionToken`; the contract artifacts.

## Plan

1. `server/http.mjs`, `server/config.mjs`, `server/deployment.mjs`, with tests (`tests/server-http-config.test.mjs`).
2. `tests/helpers/pglite-client.mjs` and `server/neon/migrations.mjs`, with tests (`tests/neon-migrations.test.mjs`: "migration 1 creates every table, index and constraint"; "migrate is idempotent and records the version"; "constraints reject malformed ids, statuses and scores"; "the settle insert CTE is atomic across session, evidence and unlocks"). The last test runs the exact §3.3 CTE on PGlite, because settle depends on it working.
3. `server/neon/{period-keys,rows,rate-limit,queries}.mjs`, with tests (`tests/neon-queries.test.mjs`). Seed rows with a helper `seedVerifiedSession(db, overrides)` that you export from `tests/helpers/pglite-client.mjs` for reuse. Tests:
   - "leaderboard ranks the best score per wallet with earliest confirmation winning ties";
   - "weekly, monthly, daily and all-time filter by period key and season";
   - "only confirmed rows rank";
   - "search matches display names and wallet prefixes without re-ranking";
   - "hidden profiles keep their rank but lose their name, and search never finds them";
   - "board-excluded wallets never rank and have no standing";
   - "blocked names are stored null with the reason";
   - "pagination returns 25 rows and the total";
   - "`you` reports the caller's standing";
   - "history sums and maxima exclude the current session";
   - "history rejects unsafe paths";
   - "rate limit counts per window and reports retry-after".
4. Endpoints E5-E9 and the stubs, with `tests/api-index-endpoints.test.mjs` driving the handlers through `createHandler` against an **unmigrated** PGlite. Cover every status code in §4.3.5-§4.3.8 and the Cache-Control values, plus: "the self profile needs a matching bearer and is never cacheable"; "the public profile lists only confirmed sessions"; "a hidden wallet's session shows no name on E9"; "E9 never returns client claims or plausibility flags"; "unknown query parameters are rejected"; "anonymous refreshes never spend a wallet's bucket". Add `tests/server-http-config.test.mjs` cases "config never exposes secrets to inspect, String or JSON", "legacy env names fail closed", "an absent VERCEL_ENV is production", "IPv6 addresses share a /64 bucket".
5. The profile sanitizer and the `server-session.mjs` fix. Update `tests/server-session-profile.test.mjs`:
   - the "profile documents are bounded…" test keeps its assertions except the removed "exactly one CREATE" (A-schema memo), and adds ISO `recordedAt`, emoji avatar and `0x` envelope cases;
   - leave the session and settle tests in that file alone (settle owns them).
6. The indexer and cron, with `tests/chain-indexer.test.mjs`. Build real logs with ethers `Interface.encodeEventLog` from `server/chain/abis.mjs`. Tests:
   - "ScoreSubmitted confirms a pending row";
   - "unknown on-chain sessions are inserted as chain-index rows";
   - "AchievementUnlocked stamps token ids";
   - "profile events re-read getProfile and sanitize";
   - "cursor advances per chunk within the time budget";
   - "decoy contracts emitting the same topics are ignored";
   - "a log that disagrees with the row is flagged, not confirmed";
   - "unknown games are skipped without freezing the cursor";
   - "the cron migrates first and reports the schema version";
   - "cron rejects missing or wrong CRON_SECRET";
   - "not-deployed skips cleanly".
7. `vercel.json`, the `.gitkeep` and the routing tests; then the `sw.js` bypass and its test.
8. `name-moderation.mjs`, `sanitize.mjs` and `scripts/moderate-profile.mjs`, with their tests.
9. Register every new file in `scripts/syntax-check.mjs` immediately after `'api/profile.mjs',` (the `tests/helpers/*.mjs` files and `apps/portal/src/name-moderation.mjs` too).

## Verification

```
node --test tests/neon-*.test.mjs tests/api-index-endpoints.test.mjs tests/chain-indexer.test.mjs tests/server-*.test.mjs tests/vercel-*.test.mjs tests/portal-service-worker-cache.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

Optional: `npx vercel dev` locally to hit `/api/leaderboard?game=chikun` and see `503 index-not-configured`. Never point it at production Neon.

## Pitfalls

- **Neon HTTP is one statement per call** (`server-neon.mjs`). Never rely on a transaction across calls. The settle insert is one CTE statement.
- **Time.** `verifySessionToken` takes `nowMs` in milliseconds. The old attest code used seconds; new server code is milliseconds everywhere.
- **PGlite.** It is a single connection, so it cannot prove concurrency. Test compare-and-set and lease semantics logically (two sequential "holders").
- **`api/profile.mjs:14` `schemaReady` is a module boolean not keyed to any database.** Replace it with `ensureSchema(db)` (A34).
- **`CREATE … IF NOT EXISTS` races.** Two cold starts can both try to create a table and one fails on the catalog; that is why `migrate` retries once on duplicate-object errors.
- **Secrets in logs.** Never pass `config`, `deps` or a raw error object to `console.*`. Log error names and codes only. `util.inspect` ignores `toJSON`.
- **`vercel.json` `functions` keys must match existing files,** or the Vercel build fails. That is why the stubs exist.
- **Parameters are strings** (A15). `jsonb_to_recordset` and `jsonb_array_elements_text` handle arrays.
- **Do not import `arcade-core.mjs` from server code.** It drags in about 1.6 MB. Import `leaderboard-engine.mjs` (small) and the specific pure modules.
- **Secrets.** Never log or return env values. Error `detail` must not echo connection strings (`neon <status>: <message>` from `server-neon.mjs` is fine; the URL is never included).

## Definition of done

- Acceptance criteria 1-13 hold, and all new tests pass on PGlite.
- The gate shows exactly 51. Do not commit the gate JSON.
- The build passes and the syntax-check entries are added.
- The final commit message lists the stub files that other slices must replace.
