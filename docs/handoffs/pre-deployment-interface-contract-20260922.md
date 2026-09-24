# Pre-deployment interface contract (2026-09-22 guide, Ranked + Web3 launch)

**Status:** binding for every implementation slice of `docs/handoffs/pre-deployment-web3-guide-20260922.md` (the "guide").
**Revision:** 2 (2026-09-23), with the reserve amendment of 2026-09-23: LiteForge base fees rose from about 0.01 to about 1.5 gwei, so the owner raised the settlement reserve from 0.0001 to **0.002 zkLTC** (entry total 0.102 zkLTC, `RANKED_MIN_PAID_WEI` default `102000000000000000`, client `RANKED_SETTLEMENT_GAS_RESERVE_WEI = '2000000000000000'`). Any 0.0001 / 0.1001 figure left below is superseded. Applies the security, feasibility and completeness reviews. Decisions A25 to A34, the runbook amendments (§13) and the review dispositions (§14) are new in this revision.
**Base commit:** `06ebe4ca` on `fable/master-list-20260916` (worktree `C:/Users/just_/lesters-arcade-fable0916`). Every `file:line` below is as of that commit. Line numbers drift after each merge: re-grep by the function or anchor text given next to each number.
**Vercel plan:** Pro (team `justin-agent-projects`, checked with `npx vercel teams ls` on 2026-09-23). Minute-level crons and `maxDuration` up to 300 s are available. The runbook re-checks the plan before deploying (§13 step 0), because a Hobby plan rejects the every-minute cron at deploy time.

This document is the single source of truth that parallel slices code against. If a brief and this contract disagree, the contract wins. If the contract and the guide disagree, the guide's owner decisions (D1 to D15) win, and the contract gets amended in the same commit that notices the conflict.

Section map:

| § | Topic |
| --- | --- |
| 1 | Architecture decisions, with rationale |
| 2 | Identifiers: games, seasons, runtimes, session keys, share ids |
| 3 | Neon schema: versioned migrations, settle state machine, relayer lease |
| 4 | HTTP endpoints and the `vercel.json` delta |
| 5 | Settlement request payloads and the canonical verified run |
| 6 | Achievements: catalog entries, stats shapes, derivation, history, metadata |
| 7 | Client module APIs and integration events |
| 8 | Contract call facts |
| 9 | Flags, environment variables, fail-closed rules |
| 10 | Slice plan, file ownership, `main.js` ranges, merge rules |
| 11 | Repo rules every slice follows |
| 12 | Known risks |
| 13 | Deployment runbook amendments (supersede guide §7 where they differ) |
| 14 | Review disposition |

---

## 1. Architecture decisions

Each decision has an id so briefs and commits can cite it.

**A1. Relayer mutex is a Neon lease row, not an advisory lock.** The Neon HTTP client (`apps/portal/src/server-neon.mjs`) runs one statement per HTTP call with no session. `pg_advisory_xact_lock` would be released when its own statement ends, and `pg_advisory_lock` belongs to a session that ends with the call. So serialization uses the `relayer_lease` row (§3.2): a single-statement conditional `UPDATE … RETURNING` takes the lease for 40 s. The holder then:

1. signs the transaction locally;
2. records `tx_hash` and `tx_nonce` with a compare-and-set to `submitted`;
3. broadcasts;
4. releases the lease with `next_nonce = nonce + 1`.

Receipt waiting happens after the lease is released. A holder must never broadcast when fewer than 5 s of its lease remain. Nonce errors are retried inside the lease (§3.4).

**A2. Chikun obstacle JSON bundling.** `chikun-obstacles.mjs:1` imports `../../chikun/assets/obstacle-shapes.json` with `with {type:'json'}`. Vercel's file tracer already follows that static import: production `/api/attest` loaded through the same chain on 2026-09-17. As belt and braces, `vercel.json` `functions` adds `includeFiles: "apps/chikun/assets/obstacle-shapes.json"` to every function that imports the Chikun verifier (`api/settle.mjs`, `api/cron/settle-retry.mjs`). The verify slice also adds a Node test that imports the server verifier with no flags, which proves the import-attribute syntax works on Node 20.10 and later.

**A3. `/api/attest` is retired.** `api/attest.mjs` becomes a stub that answers every method with `410 {ok:false, error:'endpoint-retired', use:'/api/settle'}`. The settle slice lands it in wave 2, together with the tests that pin `attestRequest` today. The signing logic moves to `server/settle/attestation.mjs`. What neutralizes every older build, including the live 1.7.0 one and any rebuild of it, is the env rename in A28: old code reads names that are never set, so it fails closed with 503.

The new browser flow never asks the player to sign a score submission. The relayer publishes, and failures retry through the queue. `submitRankedSession` and `requestVerifierAttestation` stay in `litvm-chain-client.mjs` for owner tooling but have no runtime caller. Only the ranked-client slice may update `scripts/hmh-web3-settlement-audit.mjs` and its test to drop the pinned `submitRankedSession(provider` literal.

**A4. Evidence travels in the settle body.** No separate upload endpoint. The body cap is 1,800,000 bytes, which covers the STACKED protocol maximum of 1,302,000 SIC1 bytes (1,736,000 base64 chars) plus JSON. It is enforced from the `content-length` header before parsing, and from the serialized size when the header is missing. Rationale:

- one request makes idempotency atomic;
- Vercel's request limit (about 4.5 MB) is above the cap;
- the guide's 600 KB figure would reject legal 2-hour STACKED runs.

**A5. Share page.** `/s/<shareId>` is rewritten to the function `/api/share-page?id=<shareId>`, which server-renders the HTML and its OG and Twitter tags. The card image `/api/share-card/<shareId>.png?v=<rev>` is rewritten to `/api/share-card?id=<shareId>` (the query string is carried through). `rev` is the card revision of §7.5, so a rename, a hide or a confirmation produces a new image URL. The share id is the session key without `0x`, as 64 lowercase hex characters (§2.5). It never contains `0x` or `session-`, so it passes the Chikun smoke's `/0x[a-f0-9]{40}|session-/i` guard.

**A6. `/profile/<wallet>` routing.** `vercel.json` rewrites `/profile/:wallet` to `/index.html`. `arcade-router.viewForPath` adds a `wallet` key only when the second segment is a valid address, so existing `deepEqual` tests on 3-key shapes stay valid. `routeForView('profile', {wallet})` returns `/profile/<wallet>`. `portal-route-controller.applyLocation()` must call the hydrate hook for `profile` and `leaderboards` (today it never does).

**A7. Unlockables in phase 1.** An unlockable is granted when any of these is true:

- the wallet has **earned** the gating achievement (a server-recorded row in `achievement_unlocks`, read through `GET /api/profile`);
- (phase 2) the wallet holds the gating soulbound token (`tokenId` not null in the same response, confirmed with `fetchPlayerAchievements`);
- the gate is a verified run count (`games[g].confirmedRuns`).

The browser caches the last profile response per wallet in `localStorage` (`lesters-arcade-unlocks-v1:<wallet>`, 7-day TTL), so unlocks keep working in Free Mode and offline. Without `HOSTED_PROFILE_SYNC` nothing extra unlocks and nothing is fetched.

A cached grant is acceptable for **cosmetics** only. The HMH heroes Lester and Lilly are not cosmetic: they carry gameplay `simMultipliers` (`hmh-character-config.mjs:70-90`). The browser cache only decides what the hero select shows. For Ranked, E3 enforces the hero gate from the wallet's server history (§4.3.3 step 11), so an edited cache can change Free play only.

**A8. `verified_sessions` is the settle queue.** There is no separate `settle_queue` table. One row per session id gives idempotency, and `status`, `attempts` and `next_attempt_at` drive retries (§3.3).

**A9. The server is the judge.**

- The server replays Chikun and STACKED and runs the HMH plausibility and summary checks itself.
- **HMH is plausibility-checked, not replayed** (guide §5.1 item 6). The browser still produces the HMH run summary, and the server only bounds it with a reboot-calibrated validator (§5.3) plus the wall-clock bound of A26. HMH achievements that depend only on client-attested fields are never NFT candidates (§6.1). The trust page says so (A33).
- Client claims (score, stats, achievements, envelope hash) are ignored for scoring. `claim.score` must be a safe integer from 0 to 1e12 (else `400 invalid-body`) and is stored only in the non-public column `verified_sessions.client_claim`. It never appears in `stats` or in any public response.
- The on-chain `envelopeHash` is computed by the server as the v2 ranked envelope (§2.6), which commits to the exact evidence stored in `session_evidence`.
- This also protects Safari players from V8 and JavaScriptCore `Math.hypot` last-bit differences: nobody compares the client result with the server result.

**A10. Per-game season in the session key.** Both identity sites in `main.js` (`currentCanonicalSessionIdentity` at `:2831-2841`, and the entry identity at `:5578`) are replaced by one helper, `rankedIdentityFor(session)` (§7.1). It uses `session.seasonId`, which already holds the per-game value. The settle body carries the full identity preimage. The server recomputes the session key and the seed and requires both to match (§5.2).

**A11. `buildHash` is format-checked, not allowlisted.** Seed unpredictability comes from the server-issued seed ticket (A25), not from the build. An allowlist would add no protection, and it would reject runs whose entry was paid just before a deploy.

- The server requires `^site-\d+\.\d+\.\d+:game-\d+\.\d+\.\d+$` for `lester-blaster`, and the same with `:cabinet-\d+\.\d+\.\d+` for `chikun` and `stacked`.
- Replay compatibility is gated by evidence version: ranked Chikun accepts only `chikun-flap-evidence-v6`, and STACKED only SIC1 codec 1.

**A12. Contract bounds.**

- The server rejects `score > 10_000_000_000` (the contract `MAX_SCORE`) with `422 score-out-of-bounds`.
- It clamps `maxCombo` to 10,000, `kills` to 100,000 and `survivalSeconds` to 86,400 in the contract fields. The unclamped values stay in `stats`.
- `STACKED_MAX_SCORE` (1e12) in `stacked-contracts.mjs` is **not** changed. That module is frozen and pinned.
- Real STACKED scores reach about 1e8 in 2 hours.

**A13. SIWE nonce.** The nonce is stateless and HMAC-signed with `SESSION_SECRET`, and it expires after 10 minutes. It is made single-use by inserting it into `auth_nonces` (primary key) when it is used; a second use returns `401 nonce-used`. `/api/session` and `/api/session/nonce` need both `SESSION_SECRET` and `NEON_DATABASE_URL`, otherwise they return 503.

**Session token v2.** The token payload becomes `v2|<audience>|<wallet>|<expiresAt>`, where `audience = 'lestersarcade:' + environment` and `environment = VERCEL_ENV ?? 'production'`. `verifySessionToken` accepts only v2 tokens whose audience equals the verifier's own audience. Tokens minted by the live 1.7.0 `/api/session` (`wallet|expiresAt`) therefore die at the 1.8.0 deploy, and a token minted by a preview or local server never works in production, even if a secret were shared. `SESSION_SECRET` is also rotated at runbook step 6 (§13), and each environment must have its own value.

The browser takes `issuedAt` from the nonce response so client clock skew cannot make a login stale. The SIWE statement becomes exactly `Sign in to Lester\u2019s Arcade. This does not cost anything or send a transaction.` (the `SIWE_STATEMENT` constant, changed by the settle slice). The client and the server share that constant.

**A14. Server-only code lives in `/server` at the repo root.** `apps/portal` is the public web root, so every file under it is downloadable. New server modules go to `server/**` and are imported by `api/**`. Existing `apps/portal/src/server-session.mjs` and `server-neon.mjs` stay where they are (tests import them). Helpers never go under `api/`, because every file there becomes a function.

**A15. Driver-independent SQL.** Neon HTTP and PGlite type values differently. Every `SELECT` therefore returns only `text`, `int4` or `boolean` columns:

- JSONB becomes `col::text` and is parsed in JS;
- arrays become `array_to_json(col)::text`;
- bigints become `col::text` and go through `Number()`;
- timestamps become `to_char(col AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.

Parameters are always strings or `null`:
- numbers are sent as `String(n)` and cast in SQL (`$9::bigint`, `$3::int`);
- booleans as `'true'` / `'false'`, cast with `::boolean`;
- objects as `JSON.stringify` cast with `::jsonb`;
- arrays as a JSON string, expanded in SQL (`ARRAY(SELECT jsonb_array_elements_text($16::jsonb))`, or `jsonb_to_recordset($27::jsonb) AS a(id text, tier text, nft boolean)`).

Never pass a JS array or number as a parameter, because the two drivers serialize them differently.

**A16. Ranked restart always pays.** HMH `restartCombatRun`, Chikun `restartChikunSession` and the STACKED `onRestart` (`main.js:1927`, today `setOfficialView('mode-select')`) all call `startOfficialMode('ranked')` when the finished run was Ranked. That function shows the entry modal. In preview it approves without payment. A test covers each of the three.

**A17. Start on broadcast.** The run starts as soon as `openSession` is broadcast. The session carries `entryReceipt.status` (`pending`, then `confirmed` or `failed`) and `entryConfirmed`, a promise.

- Settlement awaits `entryConfirmed`, for up to 90 s after the run ends, before it calls `/api/settle`.
- A failed entry turns the run into unranked practice with a plain message.
- The settle body carries `entryTxHash`. The server reads the entry over its own RPC, which may lag the wallet's RPC. When the session is not yet visible it waits for that transaction's receipt (at most 10 s) and then answers the **retryable** `409 entry-pending` rather than a terminal 402 (§4.3.3). A 402 is returned only when the chain proves the entry is missing, reverted, underpaid or someone else's.

**A18. Integration seams are `window` CustomEvents** (§7.7), so parallel wave-3 slices never call each other's code from `main.js`.

**A19. Pre-deploy address module.** `apps/portal/src/generated/litvm-addresses.mjs` starts in state `status:'predicted'` with the addresses derived from the operator's nonce 0 (§8.1). After the broadcast it is regenerated from `contracts/deployment-record.hardened.json` with `status:'deployed'` and `startBlock`. The portal and server read addresses only from this module (plus `RANKED_SCORE_REGISTRY_ADDRESS`, which must equal it). With seed tickets (A25), live session keys no longer depend on the predicted addresses matching preview ones; the predicted module still lets every wave build and test against the real deployment addresses before the broadcast.

**A20. NFT-flagged achievement ids ride in `submitVerifiedSession` from phase 1.**

- Only ids earned this run that are in `nftAchievementIds(gameId)` **of the code catalog at signing time** go in, at most 32.
- The collections deploy empty, so `mintFor` returns `false` for undefined ids without reverting.
- `achievement_unlocks.nft` records the phase-1 **proposal** and is informational only. Nothing reads it to decide a mint or a badge.
- In phase 2 the owner approves the subset, the catalog's `nft` flags are edited to match, and a resync step rewrites `achievement_unlocks.nft` from the catalog. The backfill (`planBackfillMints`) selects rows by `achievement_id IN nftAchievementIds(gameId)` from the catalog **at run time**, ignoring the stored flag. Profiles and results derive NFT display from the catalog plus a non-null `tokenId` (A32).

**A21. Local chain.** The Hardhat in-process network is configured with `chainId: 4441`. EIP-712 domains, session keys and `LITVM_LITEFORGE_NETWORK` therefore work unchanged in the rehearsal.

**A22. Preview mode keeps device-local views.** While `HOSTED_PROFILE_SYNC` is false, the Scores and Profile pages keep today's device-local rendering. The source tabs are removed, the House Demo seed is removed, and a "Preview · this device" notice is shown. When it is true, they render only index data. Every new route or model takes `hosted` and `live` as injected booleans, so tests cover both branches.

**A23. The service worker bypasses `/api/`.** `sw.js` must not intercept any `/api/` request: no caching of JSON or share-card images. Browser calls that need freshness also pass `cache:'no-store'`.

**A24. Crons.**

- `/api/cron/settle-retry` runs every minute (`* * * * *`).
- `/api/cron/index-chain` runs every 5 minutes (`*/5 * * * *`).
- Both require `Authorization: Bearer ${CRON_SECRET}`. The comparison hashes both values with SHA-256 and compares the digests with `crypto.timingSafeEqual`.

**A25. Server-issued seed tickets (live Ranked only).** A seed computed only from client-chosen values lets a player grind a uuid to hit any 32-bit seed. That enables replay theft (settling someone else's exported Chikun replay as your own) and choosing easy seeds. So, when `SETTLEMENT_LIVE` is true, the seed of a Ranked session comes from the server:

1. After the player approves the entry and **before** the session key is computed, the browser calls E15 `POST /api/ranked/seed` with its Bearer token and `{ gameId, sessionId, seasonId, buildHash }`.
2. The server returns a random 16-byte `salt`, `issuedAt` (integer seconds) and a MAC binding the salt to the session, wallet, game, season and build (§2.7).
3. The seed is `deriveRankedSeed(...)`, the first 32 bits of a SHA-256 over those values plus the salt. It is unpredictable before the ticket is issued, and a ticket is bound to one wallet.
4. The browser applies the ticket to the pending session (`applySeedTicket`, §7.1), then computes the session key and pays. The settle body carries the ticket, and E3 checks the MAC and the seed (§5.2).

In preview the FNV seed of §2.3 stays, with no network. Evidence copied from another run cannot be replayed under a ticket seed the copier did not receive. The residual risk is a bot or solver that plays the real seed faster than real time; the wall-clock bound (A26) makes it spend real time, but replay proves only that a run is valid under the rules, not who played it (§12).

**A26. Run timing comes from the chain.** `ArcadeRankedEntry.getPaidSession(sessionId32).openedAt` (block seconds) bounds every Ranked run:

- `openedAt ≥ ticket.issuedAt − 120` and `openedAt ≤ ticket.issuedAt + 1800`, else `422 seed-ticket-stale` (a ticket is used within 30 minutes of issue);
- `now ≥ openedAt + survivalSeconds − 30`, else the **retryable** `409 run-timing-early` with `retryAfterMs`. An honest client settles after the run ends, so it only hits this when its entry took more than 30 s to land, and then it just waits;
- `now ≤ openedAt + survivalSeconds + 7 days`, else `422 run-stale`.

Period keys (day, week, month) come from `openedAt`, the time the run was played, not from the settle time. Holding a run back therefore cannot move it into a later period.

**A27. Kill switches that really stop Ranked.** `setEntryFeeEnabled(false)` is **not** a stop: it makes Ranked free while the relayer still pays gas. The levers are:

- `SETTLEMENT_PAUSED=true` in the production env, then a redeploy of the current release. E15, E3 and E13 answer `503 settlement-paused` and leave every row untouched. The browser cannot obtain a seed ticket, so it stops at the Ranked modal before any payment.
- `GameRegistry.setPlayable(gameId32, false)` per game (`scripts/operator-actions.mjs pause-games`), which blocks `openSession` and `submitVerifiedSession` on chain.
- `ScoreSubmissionRegistry.setTrustedVerifier(new)` to rotate a leaked verifier key, and `setRelayer(relayer, false)` to stop a leaked relayer key.
- E3 requires `getPaidSession(...).amountWei ≥ RANKED_MIN_PAID_WEI` (default `102000000000000000`, the 0.1 zkLTC fee plus the 0.002 reserve), else `402 entry-underpaid`. So a free session is never relayed, and turning fees off makes Ranked unusable instead of free.

**A28. Server secrets use new names, and config never holds key strings.** The live 1.7.0 `/api/attest` signs any posted score with `VERIFIER_PRIVATE_KEY`, unauthenticated, and `api/settle.mjs` relays with `RELAYER_PRIVATE_KEY`. Any rebuild of pre-1.8.0 code with production env would turn into a public signing oracle if those names ever held keys. So:

- The new names are `RANKED_VERIFIER_PRIVATE_KEY`, `RANKED_RELAYER_PRIVATE_KEY` and `RANKED_SCORE_REGISTRY_ADDRESS`. The legacy names `VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY` and `SCORE_REGISTRY_ADDRESS` are never written to any Vercel environment.
- `readServerConfig` fails closed when any legacy name is present at all: `settlementReady = false` and `missing` gains `legacy-env-present:<NAME>`. E3, E13 and E15 then answer `503 settlement-not-configured`.
- The config object holds **no secret strings**. Secrets live in closures and are reached only through functions: `session.secret()`, `neon.createClient()`, `verifier.createSigner(ethers)`, `relayer.createWallet(ethers, provider)` and `cron.matches(headerValue)`. The config defines `toJSON()`, `toString()` and `[Symbol.for('nodejs.util.inspect.custom')]`, all redacted. A test checks that `util.inspect(config, { depth: 10, showHidden: true })`, `String(config)` and `JSON.stringify(config)` contain none of the fixture secret values.
- Only the settle core, E15 and the two crons call those factories.

**A29. Name moderation runs on the server.** Anyone can call `PlayerProfileRegistry.setProfile` directly, so the browser filter is only a courtesy.

- `apps/portal/src/name-moderation.mjs` is created by the **index** slice in wave 1. It is pure, has no imports except `username-registry.mjs` (`containsBlockedTerm`), and is shared by the browser and the server.
- `sanitizeOnchainProfile` runs `moderateName`. A name that fails is stored as `display_name = NULL` with `name_blocked = <reason>`, so it never reaches any board, profile, share page, card or unfurl.
- `wallet_profiles.hidden` is the owner's manual flag, and `board_excluded` removes a wallet from ranking. Both are set only by `scripts/moderate-profile.mjs` (index slice).
- `hidden` applies on **every** display surface: E5, E6, E9, E10, E11 and the results-screen handle. A hidden wallet shows as its short wallet with no avatar. `q` search never matches a hidden or blocked name.

**A30. One handler seam.** Every `api/*.mjs` module exports:

```
export function buildDeps(env = process.env, overrides = {})   // → deps; overrides: db, provider, deployment, nowMs, fetchImpl, crypto
export function createHandler(depsFactory)                      // → (req, res) => Promise<void>: the real req/res adapter
export default createHandler(() => buildDeps());
```

`createHandler` owns the whole adapter: method check, the Bearer check before the body is read (where the endpoint needs auth), `readJsonBody` with the cap, query parsing with the unknown-parameter check, `try/catch` into `500 internal-error`, headers and `sendJson`. Tests, `scripts/lib/local-stack.mjs` and `scripts/lib/local-http.mjs` mount `createHandler(() => buildDeps(env, { db, provider, deployment, nowMs }))`, so they exercise the production adapter with only the database, chain and clock swapped. No handler has any other override hook. The dependency is always named `provider` (never `providerFactory`).

**A31. Errors are classified, and the retryable ones say so.** Any error body may carry `retryable: true` and `retryAfterMs`. The client keeps the request and retries those (§7.2). Relayer failures are split into deterministic contract rejections, which count toward the dead letter, and infrastructure trouble, which waits without spending attempts (§3.3). Every stored `last_error` and every returned `lastError` is a code from the allowlist in §4.4, never raw error text: ethers messages can embed the RPC URL.

**A32. No NFT wording until a token exists.** In phase 1 no surface says "NFT", "soulbound" or "minting". The results screen and the profile show NFT-flagged unlocks as normal achievements. The "⛓ Soulbound NFT" badge, the token link and the "minted" state appear only when `tokenId` is non-null (phase 2). The profile-boards slice confirms held tokens with `fetchPlayerAchievements`, on that `tokenId != null` path only.

**A33. Public copy is generated from the flags.** The landing-page FAQ, meta, OG, Twitter and JSON-LD descriptions, `portal-content.mjs`, the discover pages, `llms.txt` and `trust.html` describe Ranked. They are rendered by `scripts/build-portal-pages.mjs` from `SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC`, with preview wording while the flags are false and launch wording once they are true. The committed files must equal the build output (test). The step-7 flag flip therefore regenerates the copy in the same commit (§13). Launch wording states the 0.102 zkLTC entry, the on-chain publishing, that HMH is plausibility-checked while Chikun and STACKED are replay-verified, and the server-side storage in Neon (wallet-linked sessions, evidence, achievements, and HMAC'd IP buckets). Owner: the site-copy slice (§10.2).

**A34. Neon schema exists before the first query, everywhere.** Every handler and cron that touches Neon, E1 and E2 included, calls `ensureSchema(db)` before its first query. `ensureSchema` is memoized per process (a module-level `Map` of promises keyed by `db.schemaKey`, which is the database host plus name for Neon and a unique id per PGlite instance), and a failure clears the memo. It first reads `SELECT coalesce(max(version),0)::int AS v FROM schema_migrations` (treating a missing table as 0) and runs `migrate` only when behind. A concurrent creator can fail on the catalog; `migrate` retries once on SQLSTATE `42P07`, `42710` or `23505`. Each handler caches its Neon client at module scope, so the memo hits. E12 also calls `migrate(db)` explicitly and reports the applied versions, which the runbook uses as the production migration step (§13).

---

## 2. Identifiers

### 2.1 Games

| gameId (on chain, API, Neon) | Route slug | Title | `gameId32 = ethers.id(gameId)` |
| --- | --- | --- | --- |
| `lester-blaster` | `hard-money-heroes` | Hard Money Heroes | `0x545dd61662e9dc794369142dd2768078f04eb05c60daec6fe35ec6b9f854205e` |
| `chikun` | `chikun` | Chikun's Escape | `0xe293f354d567ca05ed272162a4f9056216cf9f40e9fe59bbf8b6227c0ce4f385` |
| `stacked` | `stacked` | STACKED | `0xf59739dcdad762dcc1b5c107223be71d49deb6bb5c775307196190123630d7f5` |

APIs accept `game=` as a gameId or a route slug and always answer with the gameId. `ethers.id` is keccak256 of the UTF-8 string. It is **not** `formatBytes32String`.

### 2.2 Seasons and runtimes

| gameId | seasonId | seasonId32 | runtimeId | runtimeId32 |
| --- | --- | --- | --- | --- |
| `lester-blaster` | `hmh-season-1-2026` (`CURRENT_RANKED_SEASON_ID`) | `0x0d51bf17a0c812235cd14152862053cdf66fb19a7fc64fd41dae9fa18cf72947` | `lester-blaster:hmh-run-summary-v6` | `0x7a49b1ef4a70d8a4f787edc9cf0777f9eeae2c08d8c4d0b63c0a123600b4a2e0` |
| `chikun` | `chikun-season-preview-1` | `0xdec4900d7408bc67cb59219f09a8afed684ab088cf7633784e5f97d6cda50e51` | `chikun:canvas-runtime-v7` | `0x22ee05d74f52b967d5644200912b19d1834d60274eeedc9c692f2e83fcfbd411` |
| `stacked` | `stacked-season-preview-1` | `0xc0ea09f7acabf8c293b44bb21d4ddd53036bc6886649dbe65b2afb6b17277db5` | `stacked:stacked-result-v1` | `0x34b1f2f810dadc00f74f2fc706011f6f5e06c3a70850ee288227a914f995f60e` |

- The seasonIds are the existing `getPlaySessionIdentity(gameId).seasonId` values; the season strings are unchanged.
- The Chikun retune (chikun-tune slice) sets `CHIKUN_RUNTIME_VERSION = 'canvas-runtime-v7'`, `CHIKUN_CABINET_VERSION = '0.9.0'` and `CHIKUN_EVIDENCE_VERSION = 'chikun-flap-evidence-v6'`. The Chikun `buildHash` becomes `site-1.7.0:game-1.7.0:cabinet-0.9.0` until the release bump.
- `runtimeId` strings are the source for `runtimeId32 = ethers.id(runtimeId)`. They are defined once, in `RANKED_GAMES` (§7.1), and a test asserts `RANKED_GAMES.chikun.runtimeId === 'chikun:' + CHIKUN_RUNTIME_VERSION`.
- HMH `bossId` on chain is `ethers.id('boss-liquidator')` = `0x81b9332af0bfe9f6c1d9221d44a8ee1c46ba5c60c4e4f7cc4e7e4b61d7991cb8` when `runSummary.kills.boss > 0`, otherwise ZERO32. Chikun and STACKED always send `bossId: null`, which becomes ZERO32.

### 2.3 Session handle, nonce and seed

- The session handle is `sessionId = 'game-session-' + uuid`, with a lowercase RFC 4122 uuid (`createCanonicalSessionHandle`). The server requires `/^game-session-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`.
- `nonce` equals the uuid part of `sessionId` (`startPlaySession` builds the handle from `sessionNonce`). The server requires this equality.
- **Preview and Free seed:** `deriveSessionSeed({sessionId, gameId, seasonId, buildHash})`: FNV-1a 32 over `sessionId|gameId|seasonId|buildHash`, then `>>>0` (`arcade-core.mjs:5302`). The verify slice moves it, byte-identical, to `apps/portal/src/session-seed.mjs`. `arcade-core.mjs` calls it inside `startPlaySession` (`:5353`), so it must keep a local binding: replace the function with exactly
  ```
  import { deriveSessionSeed } from './session-seed.mjs';
  export { deriveSessionSeed };
  ```
  (a bare `export { … } from` creates no local binding and would throw in `startPlaySession`).
- **Live Ranked seed:** the ticket seed of §2.7, applied to the pending session before the session key is computed (A25). `startPlaySession` still derives the FNV seed first; `applySeedTicket` replaces it.
- Ranked seeds never come from HMH challenges, which are Free-only (`hmh-challenges.mjs:43`).

### 2.4 Session key (sessionId32), the paid entry key

```
identity = {
  version: 'lesters-canonical-session-v1',   // added by createCanonicalSessionIdentity
  sessionId,                                  // 'game-session-<uuid>'
  chainId: 4441,
  scoreRegistryAddress,                       // lowercase, = LITVM_DEPLOYMENT.addresses.scoreSubmissionRegistry
  wallet,                                     // lowercase player address
  gameId,                                     // §2.1
  seasonId,                                   // §2.2, per game
  buildHash,                                  // format per A11
  seed,                                       // uint32: the §2.7 ticket seed when live, the §2.3 FNV seed in preview
  nonce,                                      // uuid part of sessionId
}                                             // exactly these 9 keys: createCanonicalSessionIdentity whitelists them
                                              // (session-integrity.mjs:50-77). The ticket travels beside the identity (§5.1);
                                              // the key binds it through the seed.
sessionKey = sessionId32 = '0x' + sha256(canonicalSessionJson(identity))    // session-integrity.mjs:50-77
```

`openSession(sessionId32, gameId32)` pays against this key. `isPaid(sessionId32, player, gameId32)` binds the player and the game on chain, and the key itself binds the game, season, wallet, registry, chain, build and seed. Because the key includes `scoreRegistryAddress`, it changes when the registry moves. For that reason the predicted address is used before deploy (A19).

### 2.5 Share id

```
shareId = sessionId32.slice(2)        // 64 lowercase hex, no 0x
sessionId32 = '0x' + shareId
share URL  = 'https://lestersarcade.io/s/' + shareId
card URL   = 'https://lestersarcade.io/api/share-card/' + shareId + '.png'
```

The APIs accept either form in `id=`, normalize to lowercase, and return 400 `invalid-session-id` for anything else.

### 2.6 Evidence digest and the ranked envelope (v2)

| gameId | `encoding` | Stored `evidence` text | `evidenceDigest` |
| --- | --- | --- | --- |
| `chikun` | `chikun-flap-evidence-v6+json` | `canonicalSessionJson(flapEvidenceV6)` | `await sha256Hex(flapEvidenceV6)` (canonical JSON) |
| `stacked` | `stacked-sic1+base64` | standard base64 **with** padding of the SIC1 bytes (`encodeStackedBase64`) | `'0x' + sha256(sic1Bytes)`, the host's `evidenceDigest` |
| `lester-blaster` | `hmh-run-summary-v6+json` | `canonicalSessionJson({ runSummary, sessionEnvelope })` | `await sha256Hex({ runSummary, sessionEnvelope })` |

```
envelopeHash = await sha256Hex({
  version: 'lesters-ranked-envelope-v2',
  gameId, sessionKey: sessionId32, encoding, evidenceDigest,
})
```

The server computes this. It is the `envelopeHash` in the EIP-712 `VerifiedRun` and in `verified_sessions.envelope_hash`, so anyone holding the stored evidence can recompute and check it. `rankedEnvelopeHash(...)` in `ranked-identity.mjs` (§7.1) is the only implementation, and browser and server share it.

### 2.7 Seed ticket (A25)

```
seedTicket = { v: 'lesters-ranked-seed-v1',
               salt,        // 32 lowercase hex (16 random bytes, server-generated)
               issuedAt,    // integer seconds (server clock)
               mac }        // 64 lowercase hex
mac  = hex(HMAC-SHA256(SESSION_SECRET,
          'lesters-ranked-seed-v1|' + [sessionId, wallet, gameId, seasonId, buildHash, salt, issuedAt].join('|')))
seed = deriveRankedSeed({ sessionId, wallet, gameId, seasonId, buildHash, salt })
     = parseInt((await sha256Hex(canonicalSessionJson({ v: 'lesters-ranked-seed-v1', sessionId, wallet, gameId, seasonId, buildHash, salt }))).slice(2, 10), 16) >>> 0
```

- `wallet` is lowercase. `deriveRankedSeed` is async (WebCrypto), lives in `apps/portal/src/session-seed.mjs` (verify slice) and is identical in the browser and in Node. A test pins one fixture value.
- `issueSeedTicket` and `checkSeedTicket` live in `server/verify/seed-ticket.mjs` (verify slice), take `crypto` and the secret by injection, and compare MACs with `timingSafeEqual`.
- A ticket is bound to one sessionId, so replaying it yields the same session key, which can be paid only once. It needs no single-use table.

---

## 3. Neon schema

### 3.1 Migration runner

- Owned by the index slice: `server/neon/migrations.mjs`.
- `MIGRATIONS` is an array of `{ version:int, name:string, statements:string[] }`. Every statement is idempotent (`IF NOT EXISTS`) and is sent as its own HTTP call.
- `migrate(db)` creates `schema_migrations` first. It reads the applied versions, runs every statement of each missing version in order, then runs `INSERT INTO schema_migrations(version,name) VALUES($1,$2) ON CONFLICT DO NOTHING`.
- `ensureSchema(db)` follows A34: memoized per process by `db.schemaKey`, a version check first, `migrate` only when behind, the memo cleared on failure. This replaces the `schemaReady` boolean in `api/profile.mjs:14`, which was set per module and never keyed to the database.
- `CREATE … IF NOT EXISTS` is **not** race-safe in Postgres (concurrent creators can collide on `pg_type` / `pg_class`). `migrate` retries the whole version once on SQLSTATE `42P07`, `42710` or `23505`.
- **Call rule:** every handler and cron that touches Neon calls `ensureSchema(db)` before its first query (A34). PGlite test helpers must **not** migrate in setup for handler-level tests, so a missing call fails the test.
- `scripts/neon-migrate.mjs` runs `migrate` with `NEON_DATABASE_URL` from the environment and never prints the URL. Per §11 rule 13 it is a dry run by default (one `SELECT` on `schema_migrations`, listing the pending versions) and applies only with `--apply --confirm APPLY_MIGRATIONS` (clarified 2026-09-23 by the index fixer). `scripts/moderate-profile.mjs` never migrates: on a schema that is behind it stops before any write. In production the migration step is the E12 call in §13 step 8b, because the database URL lives only in Vercel.

`arcade_profiles` is no longer created or read. Decision D4 is a clean slate, and no production table exists yet (guide §1.1).

### 3.2 DDL: migration 1, `0001_ranked_index`

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verified_sessions (
  session_id32      TEXT PRIMARY KEY CHECK (session_id32 ~ '^0x[0-9a-f]{64}$'),
  session_handle    TEXT NULL CHECK (session_handle IS NULL OR session_handle ~ '^game-session-[0-9a-f-]{36}$'),
  wallet            TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  game_id           TEXT NOT NULL CHECK (game_id IN ('lester-blaster','chikun','stacked')),
  season_id         TEXT NOT NULL CHECK (char_length(season_id) BETWEEN 1 AND 64),
  runtime_id        TEXT NOT NULL CHECK (char_length(runtime_id) BETWEEN 1 AND 96),
  build_hash        TEXT NULL CHECK (build_hash IS NULL OR char_length(build_hash) <= 128),
  seed              BIGINT NULL CHECK (seed IS NULL OR seed BETWEEN 0 AND 4294967295),
  score             BIGINT NOT NULL CHECK (score BETWEEN 0 AND 10000000000),
  kills             BIGINT NOT NULL DEFAULT 0 CHECK (kills BETWEEN 0 AND 100000),
  max_combo         BIGINT NOT NULL DEFAULT 0 CHECK (max_combo BETWEEN 0 AND 10000),
  survival_seconds  BIGINT NOT NULL DEFAULT 0 CHECK (survival_seconds BETWEEN 0 AND 86400),
  boss_id           TEXT NULL CHECK (boss_id IS NULL OR char_length(boss_id) <= 64),
  stats             JSONB NOT NULL DEFAULT '{}'::jsonb,
  envelope_hash     TEXT NOT NULL CHECK (envelope_hash ~ '^0x[0-9a-f]{64}$'),
  achievements      TEXT[] NOT NULL DEFAULT '{}',
  nft_achievements  TEXT[] NOT NULL DEFAULT '{}',
  day_key           TEXT NOT NULL CHECK (day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  week_key          TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  month_key         TEXT NOT NULL CHECK (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  status            TEXT NOT NULL CHECK (status IN ('pending','signed','submitted','confirmed','failed')),
  source            TEXT NOT NULL DEFAULT 'settle' CHECK (source IN ('settle','chain-index')),
  attestation       JSONB NULL,
  tx_hash           TEXT NULL CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'),
  tx_nonce          BIGINT NULL,
  block_number      BIGINT NULL,
  relayer           TEXT NULL CHECK (relayer IS NULL OR relayer ~ '^0x[0-9a-f]{40}$'),
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT NULL CHECK (last_error IS NULL OR last_error ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),   -- §4.4 allowlist codes only
  infra_failures    INTEGER NOT NULL DEFAULT 0,          -- infrastructure waits (§3.3); never dead-letters on its own
  resigns           INTEGER NOT NULL DEFAULT 0,
  opened_at         TIMESTAMPTZ NULL,                    -- getPaidSession.openedAt (A26); period keys come from it
  entry_amount_wei  TEXT NULL CHECK (entry_amount_wei IS NULL OR entry_amount_wei ~ '^[0-9]{1,78}$'),
  client_claim      JSONB NULL,                          -- non-public diagnostics (A9); never returned by any endpoint
  plausibility      JSONB NULL,                          -- HMH validator flags (§5.3); non-public
  chain_mismatch    BOOLEAN NOT NULL DEFAULT false,      -- indexer found a ScoreSubmitted log that disagrees with this row
  next_attempt_at   TIMESTAMPTZ NULL,
  last_checked_at   TIMESTAMPTZ NULL,
  verified_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at      TIMESTAMPTZ NULL,
  confirmed_at      TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vs_confirmed_has_time CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL),
  CONSTRAINT vs_submitted_has_tx   CHECK (status <> 'submitted' OR tx_hash IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS vs_board_all   ON verified_sessions (game_id, season_id, score DESC, confirmed_at ASC) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS vs_board_week  ON verified_sessions (game_id, season_id, week_key,  score DESC, confirmed_at ASC) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS vs_board_month ON verified_sessions (game_id, season_id, month_key, score DESC, confirmed_at ASC) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS vs_board_day   ON verified_sessions (game_id, season_id, day_key,   score DESC, confirmed_at ASC) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS vs_wallet_game ON verified_sessions (wallet, game_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS vs_queue       ON verified_sessions (status, next_attempt_at) WHERE status IN ('pending','signed','submitted','failed');
CREATE INDEX IF NOT EXISTS vs_tx_hash     ON verified_sessions (tx_hash) WHERE tx_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS session_evidence (
  session_id32     TEXT PRIMARY KEY REFERENCES verified_sessions(session_id32) ON DELETE CASCADE,
  encoding         TEXT NOT NULL CHECK (encoding IN ('chikun-flap-evidence-v6+json','stacked-sic1+base64','hmh-run-summary-v6+json')),
  evidence         TEXT NOT NULL,
  evidence_bytes   INTEGER NOT NULL CHECK (evidence_bytes BETWEEN 1 AND 1800000),
  evidence_digest  TEXT NOT NULL CHECK (evidence_digest ~ '^0x[0-9a-f]{64}$'),
  identity         JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_profiles (
  wallet              TEXT PRIMARY KEY CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  display_name        TEXT NULL CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 3 AND 18),
  handle_hash         TEXT NULL CHECK (handle_hash IS NULL OR handle_hash ~ '^0x[0-9a-f]{64}$'),
  avatar_uri          TEXT NULL CHECK (avatar_uri IS NULL OR avatar_uri ~ '^lestersarcade:avatar/[a-z0-9-]{1,32}$'),
  profile_block       BIGINT NULL,
  onchain_updated_at  TIMESTAMPTZ NULL,
  preferences         JSONB NOT NULL DEFAULT '{}'::jsonb,
  hidden              BOOLEAN NOT NULL DEFAULT false,      -- owner flag (A29): name and avatar never shown
  name_blocked        TEXT NULL CHECK (name_blocked IS NULL OR name_blocked IN ('profanity','impersonation')),
  board_excluded      BOOLEAN NOT NULL DEFAULT false,      -- owner flag: the wallet never ranks (E5, E9 standing)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wp_display_name ON wallet_profiles (lower(display_name));

CREATE TABLE IF NOT EXISTS achievement_unlocks (
  wallet          TEXT NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  game_id         TEXT NOT NULL CHECK (game_id IN ('lester-blaster','chikun','stacked')),
  achievement_id  TEXT NOT NULL CHECK (achievement_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  session_id32    TEXT NOT NULL REFERENCES verified_sessions(session_id32),
  tier            TEXT NOT NULL CHECK (tier IN ('bronze','silver','gold','platinum','diamond','mythic')),
  nft             BOOLEAN NOT NULL DEFAULT false,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_id        TEXT NULL CHECK (token_id IS NULL OR token_id ~ '^[0-9]{1,78}$'),
  mint_tx_hash    TEXT NULL CHECK (mint_tx_hash IS NULL OR mint_tx_hash ~ '^0x[0-9a-f]{64}$'),
  minted_at       TIMESTAMPTZ NULL,
  PRIMARY KEY (wallet, game_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS au_session      ON achievement_unlocks (session_id32);
CREATE INDEX IF NOT EXISTS au_nft_unminted ON achievement_unlocks (game_id, achievement_id) WHERE nft AND token_id IS NULL;

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce       TEXT PRIMARY KEY CHECK (nonce ~ '^[0-9a-f]{72}$'),
  wallet      TEXT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_nonces_expiry ON auth_nonces (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        TEXT NOT NULL CHECK (char_length(bucket) <= 128),
  window_start  TIMESTAMPTZ NOT NULL,
  hits          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE IF NOT EXISTS relayer_lease (
  relayer      TEXT PRIMARY KEY CHECK (relayer ~ '^0x[0-9a-f]{40}$'),
  holder       TEXT NULL,
  lease_until  TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  next_nonce   BIGINT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indexer_state (
  stream      TEXT PRIMARY KEY,
  last_block  BIGINT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Period keys are computed in JS from `opened_at` (A26) for `settle` rows. For `chain-index` rows they come from `getPaidSession(id).openedAt` when that session exists, otherwise from the block timestamp. They use `periodKeyFor` from `apps/portal/src/leaderboard-engine.mjs:43` (weekly is the ISO week with Monday UTC as day one, `YYYY-Www`; monthly is `YYYY-MM`; daily is `YYYY-MM-DD`), re-exported with reset times by `server/neon/period-keys.mjs` (index). Keys never change after insert.

### 3.3 Settle state machine (`verified_sessions.status`)

```
          insert (verify ok)                  sign (EIP-712)
(none) ───────────────────────▶ pending ──────────────────────▶ signed
                                   │ crash / timeout (cron re-signs) ▲
                                   └───────────────────────────────┘│
signed ──lease + local sign + CAS (tx_hash,tx_nonce)──▶ submitted    │
signed ──submit error──▶ classified (below)                           │
submitted ──receipt.status=1, or getSession(id).exists──▶ confirmed (block_number, confirmed_at = block time)
submitted ──receipt.status=0──▶ classified by the decoded revert (if getSession(id).exists ⇒ confirmed instead)
submitted ──no receipt 180 s after submitted_at and !getSession(id).exists──▶ signed (dropped tx; infra_failures+1; nonce reset, §3.4)
failed ──next_attempt_at ≤ now and retryable (cron, or a due POST retry)──▶ signed (re-sign per the re-sign rule)
failed and not retryable ──▶ dead letter (next_attempt_at NULL, retryable=false in the API)
confirmed: terminal.
```

**Error classes** (A31). The relayer decodes every failure into one class and one allowlisted code (§4.4):

| Class | Examples (decoded) | Effect |
| --- | --- | --- |
| deterministic | `SESSION_NOT_PAID`, `*_OUT_OF_BOUNDS`, `ACHIEVEMENTS_HASH_MISMATCH`, `TOO_MANY_ACHIEVEMENTS`, `EMPTY_*`, `stored-run-mismatch` | `failed`, `attempts + 1`, backoff. Dead letter when `attempts ≥ 3`. |
| re-sign | `ATTESTATION_EXPIRED`, `INVALID_ATTESTATION` | `pending` (re-sign next), `resigns + 1`. After 3 re-signs in a row it becomes an infra wait with code `verifier-rejected` (a rotated verifier needs the env updated). |
| already done | `SESSION_EXISTS` | `getSession(id)`: if it exists for this player, `confirmed`; otherwise deterministic. |
| wait | `GAME_NOT_PLAYABLE`, `RANKED_ENTRY_UNSET`, `NOT_PLAYER_OR_RELAYER` (`relayer-not-allowed`), `relayer-underfunded`, `fee-too-high`, RPC errors, timeouts, lease not acquired, `settlement-paused` | `failed`, `infra_failures + 1`, **attempts unchanged**, `next_attempt_at = now + min(60 s × 2^min(infra_failures,4), 15 min)`. |

- A row that has been retryable for more than 7 days since `verified_at` is dead-lettered with code `stale` (guide D10: auto-retry, no refunds).
- **Dead letters are recoverable by the operator.** `scripts/requeue-dead-letters.mjs` (settle slice; dry run by default, `--apply` to write, `NEON_DATABASE_URL` from env, never printed) moves chosen dead letters back to `failed` with `attempts = 0` and `next_attempt_at = now()`.
- **Re-sign rule** (security review S16). A re-sign never trusts the stored JSON. It re-verifies the run from `session_evidence` (`reverifyStoredRun`, §5.3: the stored identity and evidence, replayed again, without the ticket and timing checks), requires the result to equal the row's `score`, contract fields and `envelope_hash`, and signs that fresh VerifiedRun. NFT ids are the row's `nft_achievements` intersected with `nftAchievementIds(gameId)` of the current catalog. A mismatch is the deterministic code `stored-run-mismatch`. `attestation` stores only `{ signature, digest, deadline, achievements32 }`.
- **Compare-and-set.** Every transition is `UPDATE verified_sessions SET … , updated_at = now() WHERE session_id32 = $1 AND status = $expected RETURNING session_id32`. A zero-row result means someone else moved the row; re-read it and return the current state.
- **Backoff for deterministic failures.** `next_attempt_at = now() + least(30 s × 2^attempts, 30 min)`.
- **Initial insert.** One atomic statement (data-modifying CTEs) writes the session row, its evidence and the achievement unlocks:

```sql
WITH s AS (
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
       (SELECT coalesce(array_to_json(array_agg(achievement_id)), '[]'::json)::text FROM u) AS unlocked;
```

  `$28` is `opened_at` (ISO), `$29` the entry amount in wei (decimal string), `$30` the client claim JSON or `null`, `$31` the HMH plausibility flags JSON or `null`. `$18`-`$20` are the period keys of `opened_at`. `inserted = 0` means the row already existed: take the idempotent path (§4.3.3). `unlocked` lists the achievements this session recorded first. `verified_sessions.achievements` holds the derived list; `achievement_unlocks` is the authority for "first earned".

### 3.4 Relayer lease and nonce

```sql
-- ensure row
INSERT INTO relayer_lease (relayer) VALUES ($1) ON CONFLICT (relayer) DO NOTHING;
-- acquire (holder = `${process.env.VERCEL_REGION ?? 'local'}:${crypto.randomUUID()}`)
UPDATE relayer_lease
   SET holder = $2, lease_until = now() + make_interval(secs => $3::double precision), updated_at = now()
 WHERE relayer = $1 AND (lease_until < now() OR holder = $2)
RETURNING coalesce(next_nonce::text, '') AS next_nonce,
          to_char(lease_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS lease_until;
-- release
UPDATE relayer_lease SET holder = NULL, lease_until = 'epoch', next_nonce = NULLIF($3, '')::bigint, updated_at = now()
 WHERE relayer = $1 AND holder = $2;
```

- **Lease.** Length is 40 s. Acquisition makes up to 4 attempts, 750 ms apart. If they all fail, the row stays `signed` and the response says `status:'signed'`; the client retries (§7.2) and the cron drains. A lease miss is never a failure and spends no attempt.
- **Choosing the nonce.** Take `n = max(pendingCount, next_nonce ?? 0)`, where `pendingCount = getTransactionCount(relayer, 'pending')`. If `next_nonce > latestCount + 8`, use `pendingCount` instead (gap guard for dropped transactions).
- **Funds and fee caps, before signing.** `fee = getFeeData()`; `maxFee = fee.maxFeePerGas ?? fee.gasPrice`. If `gasLimit × maxFee > 5 × settlementGasReserveWei` (from `LITVM_DEPLOYMENT`), stop with the wait code `fee-too-high`. If the relayer balance is below `gasLimit × maxFee`, stop with the wait code `relayer-underfunded`. Neither spends an attempt.
- **Building the transaction:**
  1. `populateTransaction` for `submitVerifiedSession(run, nftIds32, signature)`;
  2. `gasLimit = estimateGas × 1.25`; an estimate revert is classified by its decoded reason (§3.3);
  3. the fee caps above;
  4. `signTransaction`;
  5. `txHash = keccak256(raw)`;
  6. CAS `signed → submitted` with `tx_hash`, `tx_nonce`, `relayer`, `submitted_at`;
  7. `broadcastTransaction(raw)`.
- **Nonce errors:**
  - `nonce too low` or `NONCE_EXPIRED`: re-read `pendingCount`, move the row back to `signed`, and retry. At most 3 tries inside one lease.
  - `nonce too high` (a gap): set `n = getTransactionCount(relayer, 'latest')`, move the row back to `signed`, and retry once.
  - `replacement transaction underpriced` or `already known`: `n + 1`, then retry.
- **Dropped transaction** (no receipt 180 s after `submitted_at` and no on-chain session): the row goes back to `signed` and the lease row's `next_nonce` is reset to `getTransactionCount(relayer, 'latest')` under the lease, so later submissions refill the gap instead of queueing behind it.
- **Release** with `next_nonce = lastUsedNonce + 1`, or keep the old value if nothing was broadcast.
- **After the lease is released**, wait for the receipt: `provider.waitForTransaction(txHash, 1, 15000)`. If it arrives, CAS to `confirmed`. Otherwise answer `submitted`.

---

## 4. HTTP endpoints

### 4.1 Common rules

- Handlers follow the existing pattern. There is a pure `export async function <name>Request({ method, query, headers, body, ip }, deps) → { status, body, headers? }`. The real `req`/`res` adapter is `createHandler(depsFactory)` (A30), and the default export is `createHandler(() => buildDeps())`. The adapter:
  - checks the method;
  - for Bearer-authenticated endpoints (E3, E7, E15), verifies the token **before** reading the body, and answers 401 without touching the body when it fails;
  - rejects query parameters the endpoint does not declare with `400 invalid-query` (this stops cache-busting renders and reads);
  - reads the body with the size limit;
  - builds the pure request and calls the pure function inside `try/catch` (any throw becomes `500 {ok:false, error:'internal-error'}`, logged as the error `name` and code only, never the message or the deps);
  - sets headers.
- `buildDeps(env = process.env, overrides = {})` returns the dependency object. Tests, the rehearsal's `local-stack.mjs` and `local-http.mjs` pass:
  - `db`: a Neon client or the PGlite adapter;
  - `provider`: an ethers provider, for example the local Hardhat chain;
  - `deployment`: a `LITVM_DEPLOYMENT`-shaped object;
  - `nowMs`;
  - `fetchImpl`;
  - `crypto` (node:crypto by default).

  Without overrides, `buildDeps` reads `readServerConfig(env, { deployment: await loadDeployment() })`, reuses a module-scope Neon client for `config.neon.createClient()`, and a module-scope public provider. Tests mount `createHandler(() => buildDeps(fixtureEnv, overrides))` with fake `req`/`res`, so the production adapter is what they exercise.
- Shared helpers come from `server/http.mjs` (index slice):

  ```
  readJsonBody(req, { maxBytes }) → { ok:true, body } | { ok:false, status:400|413, error:'invalid-json'|'body-too-large' }
  sendJson(res, status, body, { cache = 'no-store', headers = {} })
  bearerToken(req) → string | null
  clientIp(req) → string          // first x-forwarded-for entry, else x-real-ip, else 'unknown'
  ipBucket(ip, secret) → string   // HMAC-SHA256(secret, folded ip) hex, first 32 chars. IPv6 is folded to its /64
                                  // (first four hextets of the expanded address); IPv4 and IPv4-mapped IPv6 use the full v4 address.
  queryOf(req, allowed: string[]) → { ok:true, query } | { ok:false, status:400, error:'invalid-query' }
  createHandler(...)              // per module, built on these helpers (A30)
  ```
- Retryable error bodies carry `retryable: true` and `retryAfterMs` (A31). Every other error is terminal for the client.
- Time units: server code uses milliseconds everywhere. The EIP-712 `deadline` is in seconds (`ATTESTATION_TTL_SECONDS = 900`).
- Every error body is `{ ok:false, error:'<kebab-code>', detail?:string≤240 }`. Private keys, connection strings and raw RPC URLs with credentials never appear in any response or log.
- Addresses are always lowercase in responses. Explorer links are `https://liteforge.explorer.caldera.xyz/tx/<hash>`.

### 4.2 Endpoint table

| # | Method + path | Function file | Owner | Auth | Cache-Control |
| --- | --- | --- | --- | --- | --- |
| E1 | `GET /api/session/nonce` | `api/session-nonce.mjs` | settle | none | `no-store` |
| E2 | `POST /api/session` | `api/session.mjs` | settle | SIWE body | `no-store` |
| E3 | `POST /api/settle` | `api/settle.mjs` | settle | Bearer | `no-store` |
| E4 | `GET /api/settle/status` | `api/settle-status.mjs` | settle | optional Bearer (full view for the session's own wallet) | `no-store` |
| E5 | `GET /api/leaderboard` | `api/leaderboard.mjs` | index | none | `public, s-maxage=15, stale-while-revalidate=60` |
| E6 | `GET /api/profile?wallet=` | `api/profile.mjs` | index | none | `public, s-maxage=10, stale-while-revalidate=30` |
| E6s | `GET /api/profile?wallet=&self=1` | `api/profile.mjs` | index | Bearer (required; same wallet) | `private, no-store` |
| E7 | `PUT /api/profile` | `api/profile.mjs` | index | Bearer | `no-store` |
| E8 | `POST /api/profile/refresh` | `api/profile-refresh.mjs` | index | optional Bearer (rate-limited) | `no-store` |
| E9 | `GET /api/session/<shareId>` | `api/verified-session.mjs` | index | none | confirmed: `public, s-maxage=300, stale-while-revalidate=86400`; else `public, s-maxage=5`; 404: `public, s-maxage=30` |
| E10 | `GET /s/<shareId>` | `api/share-page.mjs` | results-share | none | confirmed: `public, s-maxage=300, stale-while-revalidate=86400`; else `public, s-maxage=15`; 404: `public, s-maxage=30` |
| E11 | `GET /api/share-card/<shareId>.png?v=<rev>` | `api/share-card.mjs` | results-share | none | confirmed: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` (never `immutable`); else `public, max-age=0, s-maxage=30`; 404: `public, s-maxage=30` |
| E12 | `GET /api/cron/index-chain` | `api/cron/index-chain.mjs` | index | `Bearer CRON_SECRET` | `no-store` |
| E13 | `GET /api/cron/settle-retry` | `api/cron/settle-retry.mjs` | settle | `Bearer CRON_SECRET` | `no-store` |
| E14 | any `/api/attest` | `api/attest.mjs` | settle | none | `no-store`, always `410` |
| E15 | `POST /api/ranked/seed` | `api/ranked-seed.mjs` | settle | Bearer | `no-store` |

In wave 1 the index slice creates `api/session-nonce.mjs`, `api/settle-status.mjs`, `api/cron/settle-retry.mjs`, `api/share-page.mjs`, `api/share-card.mjs` and `api/ranked-seed.mjs` as **fail-closed stubs** answering `503 {ok:false, error:'not-implemented'}`. This lets `vercel.json` reference every function from wave 1 on. The owning slice replaces the whole file.

### 4.3 Endpoint contracts

#### 4.3.1 E1 `GET /api/session/nonce`

- **Needs:** `SESSION_SECRET` (at least 32 characters) and `NEON_DATABASE_URL`. Missing either gives `503 session-not-configured`.
- **Rate limit:** `nonce:ip:<ipBucket>`, 300 per hour (shared mobile and event IPs are common, D9), else `429 rate-limited` with a `Retry-After` header.
- **200** `{ ok:true, nonce, issuedAt, expiresAt }`:
  - `nonce` is 72 lowercase hex characters: `hex(random 16 bytes) ‖ hex8(expiresAtSeconds) ‖ first 16 bytes of HMAC-SHA256(SESSION_SECRET, 'siwe-nonce|' + randomHex + '|' + expiresAtSeconds)`;
  - `issuedAt` is the server time as an ISO string with milliseconds;
  - `expiresAt` is `issuedAt` plus 10 minutes, as ISO.

#### 4.3.2 E2 `POST /api/session`

- **Body:** at most 16 KB: `{ challenge: { domain, address, chainId, nonce, issuedAt, uri, message }, signature }`.
- **Checks, in this order:**
  1. The existing `verifySiweLogin` checks.
  2. `chainId === 4441`, else `wrong-chain`.
  3. The nonce format and MAC, else `nonce-invalid`.
  4. The nonce has not expired, else `nonce-expired`.
  5. **Consume** it: `INSERT INTO auth_nonces(nonce, wallet, expires_at) VALUES(...) ON CONFLICT DO NOTHING RETURNING nonce`. No row returned means `nonce-used`.
- **Allowed domains:** `SESSION_ALLOWED_DOMAINS` (comma-separated) when set. Otherwise `['lestersarcade.io','www.lestersarcade.io']`, plus `localhost` and `127.0.0.1` only when `VERCEL_ENV` is set and is not `'production'`. **An absent `VERCEL_ENV` is production** (fail closed); local stacks and tests set `VERCEL_ENV=development`.
- **Rate limits:** `session:ip:<ipBucket>` 300 per hour, and `session:w:<wallet>` 30 per hour counted after the signature verifies.
- **200** `{ ok:true, wallet, token, expiresAt }`. The token is v2 with an audience (A13); `SESSION_TTL_MS` (24 h) is unchanged. `issueSessionToken` and `verifySessionToken` (`server-session.mjs:53-77`) gain an `audience` option, and the settle slice updates their tests.
- **401** `{ ok:false, error }`. The error is one of: `missing-challenge`, `invalid-address`, `domain-not-allowed`, `challenge-stale`, `message-mismatch`, `invalid-challenge`, `invalid-signature`, `signer-mismatch`, `wrong-chain`, `nonce-invalid`, `nonce-expired`, `nonce-used`.
- **503** `session-not-configured`.

#### 4.3.3 E3 `POST /api/settle`

- **Headers:** `Authorization: Bearer <session token>`, `content-type: application/json`.
- **Body:** at most 1,800,000 bytes, else `413 body-too-large`. Its shape is in §5.1: either the full body, or `{ v:'lesters-ranked-settle-v1', sessionId32, retry:true }`.
- **Needs:** `SESSION_SECRET`, `NEON_DATABASE_URL`, `RANKED_VERIFIER_PRIVATE_KEY`, `RANKED_RELAYER_PRIVATE_KEY`, `RANKED_SCORE_REGISTRY_ADDRESS`, no legacy name present (A28), `LITVM_DEPLOYMENT.status === 'deployed'`, and `RANKED_SCORE_REGISTRY_ADDRESS` equal (case-insensitive) to `LITVM_DEPLOYMENT.addresses.scoreSubmissionRegistry`. Otherwise `503 settlement-not-configured` with `detail` listing the missing variable **names** only.

**Pipeline**, cheapest checks first, stopping at the first failure. Nothing expensive (replay, signing, broadcast) runs until the entry is proven paid (security review S4):

1. **Auth,** before the body is read (A30). `verifySessionToken` (v2, audience) must succeed, else `401 invalid-session`. The token's wallet is the caller.
2. **Pause and config.** `SETTLEMENT_PAUSED` gives `503 settlement-paused`; a config that is not ready gives `503 settlement-not-configured`.
3. **Body** read with the 1,800,000-byte cap.
4. **Rate limits.**
   - Full bodies: `settle:w:<wallet>` 120 per hour and `settle:ip:<ipBucket>` 240 per hour.
   - Retry bodies: `settle-retry:w:<wallet>` 240 per hour only. They are authenticated and cheap, so they never count against the IP bucket.
   - Exceeding any of them gives `429 rate-limited` with `Retry-After`.
5. **Retry body.** Look up the row. No row gives `404 session-not-found`. A row with another wallet gives `403 wallet-mismatch`. Run one submission attempt only if the status is `signed`, or `failed`, retryable and `next_attempt_at ≤ now` (§3.3). Otherwise return the current SettleResponse unchanged.
6. **Shape** (§5.1), else `400 invalid-body` or `400 invalid-evidence`. `identity.wallet` must equal the token wallet, else `403 wallet-mismatch`.
7. **Identity binding** (`bindRankedIdentity`, §5.2): identity checks, seed ticket MAC and seed, then the session key (one SHA-256). Errors are 400 with the §5.2 codes.
8. **Existing row** for `sessionId32`:
   - same wallet **and** the same `evidence_digest` as `computeEvidenceDigest(body)` (§5.3, no replay): idempotent. Return the current SettleResponse, and run one submission attempt when the retry-body rule of step 5 allows it;
   - a different digest: `409 session-conflict`;
   - a different wallet: `403 wallet-mismatch`.
9. **Paid entry** (A17, A27), over the server's RPC (`RPC_URL`). The entry address is `LITVM_DEPLOYMENT.addresses.arcadeRankedEntry`. Read `getPaidSession(sessionId32)`:
   - not found and `body.entryTxHash` given: wait for that receipt for at most 10 s, then read again. Still not found: if the receipt shows a revert, or the transaction's `from` is not the wallet or its `to` is not the entry contract, `402 entry-not-paid`; otherwise (pending, unknown or lagging) the retryable `409 entry-pending` with `retryAfterMs: 5000`;
   - not found and no `entryTxHash`: `402 entry-not-paid`;
   - found with another player or game: `402 entry-not-paid`;
   - `amountWei < RANKED_MIN_PAID_WEI`: `402 entry-underpaid`;
   - an RPC failure: `502 chain-read-failed` (the client treats 5xx as retryable).
10. **Ticket freshness** (A26): `openedAt` against `seedTicket.issuedAt`, else `422 seed-ticket-stale`.
11. **History and the HMH hero gate.** `history = readAchievementHistory(db, { wallet, gameId, fields: historyFieldsFor(gameId), excludeSessionId32 })` (§6.5). For `lester-blaster`, the summary's `identity.heroId` must be free or have its gate met: `history.runs ≥ gate.count` from `HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.unlockableCharacters` (`hmh-character-config.mjs`, which has no imports). Otherwise `422 hero-locked`.
12. **Verify.** `verifyRankedRun(body, { …, bound })` (§5.3): replay or plausibility. A failure returns the verifier's status (400 or 422) and code.
13. **Run timing** (A26): `run-timing-early` (retryable 409 with `retryAfterMs`) or `422 run-stale`.
14. **Achievements.** `earned = deriveEarnedAchievements(gameId, verifiedRun, history)`.
15. **Insert** with the atomic CTE (§3.3), period keys from `openedAt`. `inserted = 0` means a concurrent duplicate: re-read and take step 8.
16. **Sign.** `signVerifiedRun` (§8.2) with the NFT ids of A20, then CAS `pending → signed` storing `attestation = { signature, digest, deadline, achievements32 }`.
17. **Submit.** One submission attempt with lease, broadcast and a 15 s receipt wait (§3.4).
18. **200** SettleResponse (§4.4, owner view).

**Errors:** 400 `invalid-body` | `invalid-evidence` | `identity-*` | `seed-ticket-invalid` | `session-key-mismatch` | `evidence-*` | `run-summary-*` | `session-envelope-invalid`; 401 `invalid-session`; 402 `entry-not-paid` | `entry-underpaid`; 403 `wallet-mismatch`; 404 `session-not-found`; 409 `session-conflict`, and the retryable `entry-pending` | `run-timing-early`; 413 `body-too-large`; 422 `replay-rejected` | `implausible-run` (with `flags`) | `score-out-of-bounds` | `seed-ticket-stale` | `run-stale` | `hero-locked`; 429 `rate-limited`; 502 `chain-read-failed`; 503 `settlement-not-configured` | `settlement-paused` | `address-mismatch`.

A test proves the ordering: an unpaid body gets 402 with the verifier spy never called, and a body with a bad token gets 401 with the body never read.

`vercel.json`: `maxDuration: 60`, `memory: 1024`.

#### 4.3.4 E4 `GET /api/settle/status?sessionId32=0x…` (or `?id=<shareId>`)

- **200** SettleResponse: the **owner view** when a valid Bearer token for the row's wallet is sent, otherwise the **public view** (§4.4). `404 session-not-found`; `400 invalid-session-id` | `invalid-query`; `503 index-not-configured` without Neon.
- Every session key is public in `RankedSessionOpened` events, so the public view must never expose an unpublished run's wallet, score or stats.
- **Rate limit:** `status:ip:<ipBucket>` 1,200 per hour (a client polls at most every 2.5 s for 180 s per run).
- **Side effect:** if the status is `submitted` and `last_checked_at` is more than 3 s old, call `getTransactionReceipt(tx_hash)`, CAS to `confirmed` (or apply the receipt rules of §3.3), then set `last_checked_at = now()`. No other writes, and no submissions from this endpoint.

#### 4.3.5 E5 `GET /api/leaderboard`

**Query:**
- `game` (gameId or slug, required);
- `period` = `weekly` | `monthly` | `all-time` | `daily` (default `weekly`);
- `periodKey` (optional, must match the period's key format; defaults to the current one);
- `page` (1-based integer from 1 to 400, default 1);
- `q` (optional, at most 32 characters after trimming);
- `wallet` (optional address).

**Ranking** follows D1: the best row per wallet within `game_id`, `season_id = RANKED_GAMES[g].seasonId`, the period filter and `status='confirmed'`, excluding wallets with `wallet_profiles.board_excluded = true`. It is ordered by `score DESC, confirmed_at ASC, session_id32 ASC`, with `rank = ROW_NUMBER()` over that order. Rows with `hidden = true` still rank, but `displayName` and `avatarUri` are null.

**`q` matches** `lower(display_name) LIKE '%' || lower(q) || '%'` (after escaping `%` and `_`) only where `hidden = false` (blocked names are already null), OR the wallet prefix (`q` with or without `0x`, at least 4 hex characters). Search filters the ranked list; it does not re-rank. Unknown query parameters give `400 invalid-query`.

**200:**
```json
{ "ok": true, "gameId": "chikun", "seasonId": "chikun-season-preview-1", "period": "weekly", "periodKey": "2026-W39",
  "resetsAt": "2026-09-28T00:00:00.000Z", "page": 1, "pageSize": 25, "total": 137,
  "rows": [ { "rank": 1, "wallet": "0x…", "walletShort": "0x1234…abcd", "displayName": "Chikun King", "avatarUri": null,
              "score": 19475, "stats": { /* headline keys, §6.3 */ }, "sessionId32": "0x…", "shareId": "…",
              "txHash": "0x…", "explorerUrl": "https://liteforge.explorer.caldera.xyz/tx/0x…", "confirmedAt": "…" } ],
  "you": null }
```
- `you` is `{ rank, score, sessionId32, shareId }` when `wallet` is given and has a row in the period, otherwise null.
- `resetsAt` is null for `all-time`.

**Errors:** 400 `invalid-game` | `invalid-period` | `invalid-period-key` | `invalid-page` | `invalid-query` | `invalid-wallet`; 503 `index-not-configured`.

#### 4.3.6 E6 and E7 `/api/profile`

**GET `?wallet=0x…`** (public):
```json
{ "ok": true, "wallet": "0x…",
  "profile": { "displayName": "Lit Pilot", "avatarUri": "lestersarcade:avatar/lester", "hidden": false, "onchainUpdatedAt": "…" },
  "games": { "lester-blaster": { "rankedRuns": 4, "confirmedRuns": 4, "bestScore": 48210, "bestSessionId32": "0x…",
                                 "ranks": { "weekly": 3, "monthly": 5, "allTime": 12 },
                                 "totals": { /* sums of §6.3 headline numeric keys */ }, "lastPlayedAt": "…" },
             "chikun": { … }, "stacked": { … } },
  "recentSessions": [ { "sessionId32": "0x…", "shareId": "…", "gameId": "chikun", "score": 19475, "status": "confirmed",
                        "txHash": "0x…", "explorerUrl": "…", "verifiedAt": "…", "confirmedAt": "…", "stats": { /* headline */ } } ],
  "achievements": [ { "id": "chikun-reach-coast", "gameId": "chikun", "tier": "gold", "nft": false, "sessionId32": "0x…",
                      "unlockedAt": "…", "tokenId": null, "mintTxHash": null } ],
  "preferences": null, "updatedAt": "…" }
```
- `profile` fields are null when there is no `wallet_profiles` row. When `hidden` is true, `displayName` and `avatarUri` are null. `profile.nameBlocked` (`'profanity'|'impersonation'|null`) is returned **only** in the self view, so the owner of the wallet learns why their name does not show.
- `games` always contains all three gameIds, with zeros and nulls when empty.
- `recentSessions` holds at most 20, newest first. The public view lists only `confirmed` sessions. The self view (`&self=1`) lists every status except `pending`, with `retryable`, `lastError` and `nextAttemptAt`, which the D10 retry button needs (§7.8).
- `achievements` holds every unlock for the wallet, ordered by `unlocked_at`. `nft` in each entry is taken from the **current catalog** (A20), not the stored flag.
- `preferences` is non-null only in the self view.
- **Self view** `GET /api/profile?wallet=0x…&self=1`: requires a Bearer token for the same wallet (else `401 invalid-session`), and is always `private, no-store`. It is a distinct URL, so the CDN can never serve a cached public body to it.
- **Errors:** 400 `invalid-wallet` | `invalid-query`; 401 (self view); 503 `index-not-configured`.

**PUT** (Bearer, body at most 4 KB) takes `{ preferences: { selectedCharacterId?: string≤32 matching /^[a-z0-9-]+$/, cosmetics?: { [gameId]: { [slot:/^[a-z-]{1,24}$/]: id≤48 } }, nameClaimDismissed?: boolean } }`. Unknown keys are dropped, and the serialized result must be at most 2,048 bytes. A PUT **merges** its top-level keys into the stored preferences, so a PUT of `{ nameClaimDismissed }` keeps `cosmetics` and `selectedCharacterId`; a key's whole value (for example the full `cosmetics` map) is replaced. The merged document must also fit 2,048 bytes, else `400 invalid-body` with `detail: 'preferences-too-large'` (clarified 2026-09-23 by the index fixer).
- **200** `{ ok:true, wallet, preferences, updatedAt }`.
- **Errors:** 400 `invalid-body`; 401 `invalid-session`; 503 `session-not-configured` | `index-not-configured`.
- Names, avatars, stats, runs and achievements are **never** accepted from the browser.

#### 4.3.7 E8 `POST /api/profile/refresh?wallet=0x…` (or body `{wallet}`)

- Reads `PlayerProfileRegistry.getProfile(wallet)` over the public RPC, sanitizes and moderates (§8.4, A29), and upserts `wallet_profiles` (display_name, name_blocked, handle_hash, avatar_uri, profile_block = latest block, onchain_updated_at = `lastUpdated`). It never touches `hidden` or `board_excluded`.
- **Rate limits:** with a Bearer token for the same wallet, `refresh:w:<wallet>` 30 per hour. Without one, only `refresh:ip:<ipBucket>` 60 per hour. A per-target-wallet bucket is never applied to anonymous calls, so nobody can exhaust a victim's refreshes.
- **200** `{ ok:true, wallet, profile:{ displayName, avatarUri, hidden } }`.
- **Errors:** 400 `invalid-wallet`; 429; 502 `chain-read-failed`; 503 `index-not-configured` | `chain-not-configured` (status not `deployed`).

#### 4.3.8 E9 `GET /api/session/<shareId>`

- **200:**
  ```
  { ok:true, session:{ sessionId32, shareId, gameId, gameTitle, wallet, walletShort, displayName, avatarUri,
                       score, stats, contract:{kills,maxCombo,survivalSeconds,bossId}, status, txHash, blockNumber,
                       explorerUrl, verifiedAt, confirmedAt, seasonId, runtimeId,
                       achievements:[{ id, tier, nft, unlockedAt, tokenId }],
                       standing:{ weekly:number|null, monthly:number|null, allTime:number|null } } }
  ```
  `standing` is the rank of this session's wallet in each period, only when this session is that wallet's best and the wallet is not `board_excluded`; otherwise null per period.
- `displayName` and `avatarUri` are null when the profile is `hidden` (A29); blocked names are already null. Consumers fall back to `walletShort`.
- `stats` is the §6.3 server stats only, as the headline subset (§6.3: "the `stats` subset in E5, E6 and E9 rows"); `client_claim` and `plausibility` are never included.
- `verification`: `'replay'` for Chikun and STACKED, `'plausibility'` for HMH, `'chain-index'` for rows the indexer created.
- `cardRev`: the card revision of §7.5, so the share page can build the versioned `og:image`.
- **Errors:** 404 `session-not-found`; 400 `invalid-session-id` | `invalid-query`; 503.
- Rows with status `pending` return 404, because a pending run is not yet a verified public record. Rows in `signed`, `submitted` or `failed` are returned with their status, and every consumer must render them as unpublished (A32, §7.5).

#### 4.3.9 E10 and E11 share page and card

These are specified in §7.5. Unknown ids return 404 HTML with generic OG tags (site image `https://lestersarcade.io/assets/brand/lesters-arcade-logo-horizontal.png`). Without Neon: 503 HTML with generic tags. Both accept only the declared query parameters (`id`, and `v` for the card), else 400. E11 counts **renders** (not CDN hits) against `card:ip:<ipBucket>`, 120 per hour.

#### 4.3.10 E12 `GET /api/cron/index-chain`

- **Auth:** `Authorization: Bearer ${CRON_SECRET}` compared per A24; a missing secret or mismatch gives `401 unauthorized`. Deployment status not `deployed` gives `200 {ok:true, skipped:'not-deployed'}`.
- **Migration first:** `migrate(db)` runs before indexing, and the response reports `schemaVersion` (A34, §13 step 8b).
- **Registry address (§9.2):** on a `deployed` deployment, after the migration, an absent or malformed `RANKED_SCORE_REGISTRY_ADDRESS` gives `503 settlement-not-configured` (`detail: 'RANKED_SCORE_REGISTRY_ADDRESS'`) and one that differs from `LITVM_DEPLOYMENT.addresses.scoreSubmissionRegistry` gives `503 address-mismatch`; both bodies still carry `schemaVersion` and nothing is indexed. Local stacks that call E12 set the variable (clarified 2026-09-23 by the index fixer).
- **Work** proceeds in chunks of at most 5,000 blocks and at most 10 chunks per call, within a 45 s time budget, from `indexer_state['litvm-4441'].last_block + 1`. Before the first run the start is `LITVM_DEPLOYMENT.startBlock`, or `INDEX_START_BLOCK` when set. `last_block` is updated after each chunk.
- **Every `getLogs` call carries an explicit `address` filter** for its stream: the score registry for `ScoreSubmitted`, the three collection addresses for `AchievementUnlocked`, and `PlayerProfileRegistry` for the profile events. Anyone can deploy a contract that emits the same topic0, so an unfiltered query is a bug; a test feeds decoy logs from another address and asserts they are ignored. Logs handled:
  - `ScoreSubmitted` on the score registry:
    - an existing row not yet `confirmed` becomes `confirmed`, with `tx_hash` = log tx, `block_number` and `confirmed_at` = block timestamp, **only if** the log's player, gameId32 and score equal the row's. Otherwise the row is left as is, `chain_mismatch = true`, and the response counts it under `mismatches`;
    - a missing row is inserted with `source='chain-index'`, `session_handle NULL`, `build_hash NULL`, `seed NULL`, `stats = { kills, maxCombo, survivalSeconds }`, `envelope_hash = sessionEnvelopeHash(id)`, season and runtime from the reverse maps of §2.2, period keys per §3.2, and `status='confirmed'`;
    - a log whose gameId or seasonId is not in the reverse maps is skipped and counted under `skipped`, never inserted (the `game_id` CHECK would throw and freeze `last_block`).
  - `AchievementUnlocked` on the three collections: set `token_id`, `mint_tx_hash` and `minted_at` on the matching `achievement_unlocks` row. The reverse map `ethers.id(id) → id` is built from the catalogs (§6). Unknown ids are skipped.
  - `ProfileCreated` / `ProfileUpdated`: `getProfile(wallet)`, then sanitize, moderate and upsert (§8.4, A29).
  - Housekeeping: delete `auth_nonces` expired more than 1 h ago, and `rate_limits` rows with `window_start < now() - interval '2 days'`.
  - A per-log failure is logged and counted; it never stops `last_block` from advancing past a log that can never succeed.
- **200** `{ ok:true, schemaVersion, fromBlock, toBlock, scores, achievements, profiles, skipped, mismatches, lagBlocks }`.

#### 4.3.11 E13 `GET /api/cron/settle-retry`

- Same auth as E12. `SETTLEMENT_PAUSED` gives `503 settlement-paused` with no row touched.
- Takes at most 8 rows per call (a 45 s budget), in this order:
  1. `pending` rows older than 30 s (re-sign by re-verification, §3.3);
  2. `submitted` rows older than 180 s (receipt or `getSession` check, dropped-tx rule);
  3. `signed` rows;
  4. `failed` rows that are retryable with `next_attempt_at <= now()`;
  5. dead-lettering of rows retryable for more than 7 days (`stale`).
- It holds the relayer lease while broadcasting, per §3.4, and classifies every failure per §3.3.
- **200** `{ ok:true, processed:[{sessionId32, from, to, code}] }`.

#### 4.3.12 E14 `/api/attest`

Every method answers `410 {ok:false, error:'endpoint-retired', use:'/api/settle'}`.

#### 4.3.13 E15 `POST /api/ranked/seed` (A25)

- **Auth:** Bearer v2 before the body is read, else `401 invalid-session`.
- **Needs:** `SESSION_SECRET`, `NEON_DATABASE_URL` and `settlementReady`; else `503 settlement-not-configured`. `SETTLEMENT_PAUSED` gives `503 settlement-paused`. Because the browser cannot compute a live session key without a ticket, these 503s stop players **before** they pay.
- **Body** at most 2 KB: `{ gameId, sessionId, seasonId, buildHash }`. `gameId ∈ RANKED_GAMES`, `seasonId === RANKED_GAMES[g].seasonId`, the §2.3 handle regex and the A11 build format; else `400 invalid-body`.
- **Rate limits:** `seed:w:<wallet>` 60 per hour and `seed:ip:<ipBucket>` 600 per hour. A ticket that is never paid for costs the player nothing, so the per-wallet limit is what bounds seed shopping.
- **200** `{ ok:true, seedTicket, seed }` per §2.7, with `issuedAt` from the injected clock.

### 4.4 SettleResponse

This is the body of E3 and E4. The **owner view** (E3 always; E4 with a Bearer token for the row's wallet):

```
{ ok: true, view: 'owner',
  sessionId32, shareId, gameId, wallet,
  status: 'pending'|'signed'|'submitted'|'confirmed'|'failed',
  score, contract: { kills, maxCombo, survivalSeconds, bossId: string|null },
  stats,                                   // §6.3 full stats for this game (server-derived only)
  envelopeHash,
  txHash: string|null, blockNumber: number|null, explorerUrl: string|null,
  achievements: [ { id, gameId, title, tier, nft, image, unlockedAt, tokenId: string|null } ],   // recorded by THIS session; nft from the current catalog
  retryable: boolean,                      // true unless dead-lettered or confirmed
  attempts: number, lastError: string|null, nextAttemptAt: string|null,
  verifiedAt, confirmedAt: string|null,
  pollAfterMs: number|null }               // 2500 while submitted, 3000 while pending/signed/failed-retryable, null when confirmed or dead
```

The **public view** (E4 without a matching Bearer token) is `{ ok, view:'public', sessionId32, shareId, gameId, status, txHash, blockNumber, explorerUrl, retryable, nextAttemptAt, pollAfterMs, confirmedAt }`. When the status is `confirmed` it also carries `score`, `contract`, `stats` and `achievements`, because a confirmed run is a public record. It never carries `wallet`, `lastError` or `attempts`.

`title` and `image` come from the catalogs (§6.1).

**`lastError` / `last_error` allowlist** (A31): a decoded revert name lowercased with `_` → `-` (for example `session-not-paid`, `attestation-expired`, `score-out-of-bounds`), or one of `relayer-not-allowed`, `relayer-underfunded`, `fee-too-high`, `rpc-unavailable`, `rpc-timeout`, `lease-busy`, `nonce-conflict`, `dropped-tx`, `verifier-rejected`, `stored-run-mismatch`, `settlement-paused`, `stale`, `unknown-error`. Anything else is stored as `unknown-error`, and the detail goes to the function log as the error `code` only.

### 4.5 `vercel.json` delta (landed entirely by the index slice in wave 1, except the CSP)

Add these top-level keys. Keep every existing entry, including the pinned `"/(profile|scores|leaderboards|settings)"` rewrite.

```json
"functions": {
  "api/settle.mjs":               { "maxDuration": 60, "memory": 1024, "includeFiles": "apps/chikun/assets/obstacle-shapes.json" },
  "api/cron/settle-retry.mjs":    { "maxDuration": 60, "memory": 1024, "includeFiles": "apps/chikun/assets/obstacle-shapes.json" },
  "api/cron/index-chain.mjs":     { "maxDuration": 60 },
  "api/settle-status.mjs":        { "maxDuration": 15 },
  "api/leaderboard.mjs":          { "maxDuration": 10 },
  "api/profile.mjs":              { "maxDuration": 10 },
  "api/profile-refresh.mjs":      { "maxDuration": 15 },
  "api/verified-session.mjs":     { "maxDuration": 10 },
  "api/session.mjs":              { "maxDuration": 10 },
  "api/session-nonce.mjs":        { "maxDuration": 10 },
  "api/share-page.mjs":           { "maxDuration": 10 },
  "api/share-card.mjs":           { "maxDuration": 20, "memory": 1024, "includeFiles": "apps/portal/assets/share-cards/**" },
  "api/ranked-seed.mjs":          { "maxDuration": 10 }
},
"crons": [
  { "path": "/api/cron/settle-retry", "schedule": "* * * * *" },
  { "path": "/api/cron/index-chain",  "schedule": "*/5 * * * *" }
]
```

Append these rewrites **before** the existing `"/games/:path*"` entry. Order matters: `nonce` must come before `:id`.

```json
{ "source": "/s/:id([0-9a-fA-F]{64})", "destination": "/api/share-page?id=:id" },
{ "source": "/profile/:wallet(0x[0-9a-fA-F]{40})", "destination": "/index.html" },
{ "source": "/api/session/nonce", "destination": "/api/session-nonce" },
{ "source": "/api/session/:id((?:0x)?[0-9a-fA-F]{64})", "destination": "/api/verified-session?id=:id" },
{ "source": "/api/settle/status", "destination": "/api/settle-status" },
{ "source": "/api/profile/refresh", "destination": "/api/profile-refresh" },
{ "source": "/api/ranked/seed", "destination": "/api/ranked-seed" },
{ "source": "/api/share-card/:id([0-9a-fA-F]{64}).png", "destination": "/api/share-card?id=:id" }
```

**Name each captured param after the destination query key** (amended 2026-09-23 by the index fixer). Vercel's router (`@vercel/routing-utils` `replaceSegments`) appends every named source param that the destination pathname does not use and the destination query does not already carry, as `name=$n`. The first draft's `:shareId` → `?id=:shareId` therefore compiled to `/api/verified-session?id=$1&shareId=$1`, and every handler answers an undeclared `shareId` with `400 invalid-query`. With `:id` the compiled destinations carry only `id` (checked with `getTransformedRoutes` from vercel CLI 59.14.0 and 59.25.4, which also confirms path-to-regexp 6 accepts every constrained `:param(...)` form above).

Vercel merges the original query string (`?v=<rev>`) into a rewrite destination; `tests/vercel-routing.test.mjs` pins the compiled routes, that no `/api/` destination gains an undeclared query key, and that the card handler receives `v` from the original query.

Do **not** use Vercel's regex source form as a fallback: the router rejects `"^/s/(?<shareId>[0-9a-fA-F]{64})$"` with `invalid_rewrite` ("invalid `source` pattern").

Headers to add:
- `X-Robots-Tag: noindex, follow` for `/profile/(.*)`, `/s/(.*)` (share pages are shared links, not index targets) and `/owner/(.*)`.
- `Cache-Control: no-store` for `/owner/(.*)`.

CSP (signin-entry slice only, wave 3): add the Reown/WalletConnect hosts to `connect-src`, `img-src` and `font-src` of the portal catch-all rule. **`frame-src` does not exist in that rule today**: frames fall back to `default-src 'self'`, which is what lets the `/hmh-reboot/`, `/chikun/` and `/stacked/` game iframes load. The new directive must therefore be `frame-src 'self' <reown hosts>`; without `'self'` all three games break in production only (the local static server sends no CSP). Do not touch the `/hmh-reboot/`, `/chikun/` or `/stacked/` rules. `script-src` stays `'self' 'unsafe-inline'`: AppKit is bundled locally, never loaded from a CDN. `tests/vercel-security-headers.test.mjs` asserts that `frame-src` starts with `'self'` and that `script-src` gains no remote origin.

Optional owner step (a Vercel change, so not a slice task): a Vercel Firewall rate-limit rule on `/api/*`, listed in §13.

---

## 5. Settlement payloads and the verified run

### 5.1 Settle request body

```
{
  v: 'lesters-ranked-settle-v1',
  gameId: 'lester-blaster' | 'chikun' | 'stacked',
  sessionId32: '0x…',                               // must equal the recomputed session key
  identity: { sessionId, chainId, scoreRegistryAddress, wallet, gameId, seasonId, buildHash, seed, nonce },   // §2.4 preimage, no version/sessionKey
  seedTicket: { v:'lesters-ranked-seed-v1', salt, issuedAt, mac },   // §2.7, required
  entryTxHash: '0x…' | null,                        // the openSession transaction (A17); 0x + 64 lowercase hex
  evidence: <per game, below>,
  claim: { score: <safe integer 0..1e12> } | undefined   // optional, non-public diagnostics only (A9)
}
```

Unknown top-level keys give `400 invalid-body`. `claim` with any other key or a non-integer score gives `400 invalid-body`.

Per-game `evidence` (the JSON sizes are validated by the server):

| gameId | `evidence` | Limits |
| --- | --- | --- |
| `chikun` | `{ encoding:'chikun-flap-evidence-v6+json', flap:{ version:'chikun-flap-evidence-v6', seed, fixedStepHz:60, maxTicks, flapDeltas:number[] } }` | `flapDeltas.length ≤ 12000`; `flapDeltas[0] ≥ 0`, others `≥ 1`, all integers; decoded ticks `< maxTicks`; `maxTicks ≤ 216000` |
| `stacked` | `{ encoding:'stacked-sic1+base64', sic1:'<standard base64 with padding>', startLevel:1 }` | decoded bytes ≤ `STACKED_MAX_EVIDENCE_BYTES` (1,302,000); canonical base64 (`decodeStackedBase64(text, STACKED_MAX_EVIDENCE_BYTES)`) |
| `lester-blaster` | `{ encoding:'hmh-run-summary-v6+json', runSummary:<schema v6>, sessionEnvelope:<lesters-session-envelope-v1> }` | `JSON.stringify(runSummary).length ≤ 262144`; envelope ≤ 8 KB |

**Chikun flap delta encoding (evidence v6):**
- `tick[0] = flapDeltas[0]`, and `tick[i] = tick[i-1] + flapDeltas[i]`.
- The ticks are the pre-step ticks at which a flap was applied, exactly as `taps` in the runtime.
- Encoder and decoder are `encodeFlapDeltas(ticks)` and `decodeFlapDeltas(deltas)` in `chikun-cabinet.mjs` (chikun-tune slice).
- The v6 runtime ends the run gracefully with `terminalReason:'flap-limit'` when the 12,000th flap is applied. It never throws.

### 5.2 Identity binding (verify slice, `server/verify/index.mjs`)

`bindRankedIdentity(body, { chainId, scoreRegistryAddress, wallet, nowMs, seedSecret, crypto })` is async and cheap (no replay). It returns `{ ok:true, gameId, identity /* canonical, with version and sessionKey */ }` or `{ ok:false, status:400, error }`. It runs `validateRankedIdentity` (sync, the shared §7.1 function) and then the async checks, in this order:

| Check | Error code |
| --- | --- |
| object with exactly the 9 keys | `identity-invalid` |
| `gameId ∈ RANKED_GAMES` | `identity-game-unknown` |
| `gameId === body.gameId` | `identity-invalid` |
| `chainId === chainId` | `identity-chain-mismatch` |
| lowercase registry equals config | `identity-registry-mismatch` |
| lowercase wallet equals the token wallet | `identity-wallet-mismatch` |
| `seasonId === RANKED_GAMES[g].seasonId` | `identity-season-mismatch` |
| `buildHash` format (A11) | `identity-buildhash-invalid` |
| handle regex (§2.3) | `identity-session-invalid` |
| `nonce ===` the uuid part | `identity-nonce-mismatch` |
| `seedTicket` shape (§2.7), `issuedAt ≤ now + 60 s`, MAC valid (`checkSeedTicket`) | `seed-ticket-invalid` |
| `seed === await deriveRankedSeed({ sessionId, wallet, gameId, seasonId, buildHash, salt })` | `identity-seed-mismatch` |
| `(await createCanonicalSessionIdentity(identity)).sessionKey === body.sessionId32` | `session-key-mismatch` |

All of them return status 400. The FNV seed is never accepted for a live settle.

### 5.3 Verifiers

`verifyRankedRun(body, { chainId, scoreRegistryAddress, wallet, nowMs, seedSecret, crypto, bound })` returns `Promise<VerifiedRun | { ok:false, status, error, detail?, flags? }>`. With `bound` (the result of `bindRankedIdentity`) it skips the binding; without it, it binds first. It dispatches per game.

`reverifyStoredRun({ gameId, identity /* stored canonical */, evidence: { encoding, text } })` replays or re-checks stored evidence **without** the ticket, paid and timing checks, and returns the same VerifiedRun. The re-sign rule of §3.3 uses it.

The per-game rules:

- **chikun** (`server/verify/chikun.mjs`):
  - the evidence version must be v6 (`evidence-version-unsupported`);
  - `flap.seed === identity.seed` (`evidence-seed-mismatch`);
  - pre-validate with `decodeFlapDeltas(flap.flapDeltas)` and the §5.1 limits (`evidence-invalid`);
  - `replayChikunRun(flap)`: the v6 evidence object exactly as received, which the cabinet decodes itself; a throw becomes `422 replay-rejected`;
  - the result must be terminal;
  - stats come from `statsFromChikunResult(result)` (§6.3), and `score = result.score`.
- **stacked** (`server/verify/stacked.mjs`):
  - `startLevel === 1`;
  - decode the base64, then `assertStackedEvidenceHeader`;
  - the header seed must equal `identity.seed`;
  - `replayStackedRun(bytes, { expectedSeed: identity.seed, maxTicks: STACKED_MAX_TICKS, config:{ startLevel:1, buildHash: identity.buildHash, seasonId: identity.seasonId } })`, where a throw becomes `422 replay-rejected`;
  - stats come from `statsFromStackedTuple(tuple)`, and `score = tuple.score`.
- **lester-blaster** (`server/verify/hmh.mjs`):
  - `validateRunSummaryPayload(runSummary)` must return no error (`run-summary-invalid`);
  - `runSummary.identity.seed === identity.seed`, `.buildHash === identity.buildHash` and `.mode === 'ranked'` (`run-summary-identity-mismatch`);
  - `.terminalReason === 'defeated'` (`run-summary-not-terminal`);
  - `sessionEnvelope.version === 'lesters-session-envelope-v1'`, `sessionEnvelope.sessionKey === body.sessionId32`, `sessionEnvelope.identity` deep-equals the canonical identity (with `version` and `sessionKey`), and `sessionEnvelope.envelopeHash` equals the recomputed v1 hash (`sha256Hex` over the envelope without `sessionKey` and `envelopeHash`). Failures give `session-envelope-invalid`.
  - **plausibility uses a reboot-calibrated validator**, not `validateRunPlausibility`. The legacy function in `hmh-run-integrity.mjs` derives its ceilings from the old in-process economy (`MAX_XP_PER_KILL = calculateRoguelikeKillXp({boss:true}) = 115`, so about 155 XP per kill with tolerance, and a hard reject above level 80), while the reboot grants `(80 + 20 × threat) × xpMultiplier` XP per kill (120-200 for normal enemies; 1,040 base XP for the boss, whose threat is `LIQUIDATOR_THREAT_COST = 48`, so 1,820 at the maximum `xpMultiplier` rank), up to +75% from three `xpMultiplier` ranks, combo milestones of 120/240/480/900 XP, weapon caches of 160-260 XP, and levels up to 1000 (`apps/hmh-reboot/src/run-progression.mjs:58-62, 260, 277-279, 386-431`; `enemy-archetypes.mjs`; `collectible-system.mjs:21-24`). The legacy function would flag normal paid reboot runs. The verify slice writes `server/verify/hmh-plausibility.mjs` with `validateRebootRunPlausibility(runSummary)`, deriving every ceiling from constants imported from those pure reboot modules (they import only `value-guards.mjs`):
    - **reject** (`422 implausible-run` with `flags`) only for hard impossibilities: progress with zero elapsed time; a boss kill before the boss band (`encounter-director.mjs`, `minTick 72_000`); `totals.level` inconsistent with `totals.xp` under the reboot level curve (`150 × L × (L + 1)`); XP above the reboot ceiling computed from the kill counts by role and threat, maximum multipliers, combo milestones and caches; kills above the encounter director's spawn capacity for the elapsed ticks; score above the reboot score ceiling (per-kill `(100 + 25 × threat) × maxScoreMultiplier`, silver at `SILVER_SCORE_PER_COIN × maxScoreMultiplier`, plus objective rewards);
    - **soft flags** (anything near a ceiling) never reject: the run ranks, and the flags are stored in the non-public `verified_sessions.plausibility` for owner review;
    - tests: a realistic reboot summary (300 kills of threat 4-6, one `xpMultiplier` rank, a combo reaching 30, 4 weapon caches, about 18 minutes) must verify; a summary above level 80 with consistent XP must verify; and each hard impossibility must reject.
  - stats come from `statsFromHmhRunSummary(runSummary)`, and `score = totals.score`.
  - `HMH_HERO_GATES` is exported from `server/verify/hmh.mjs`, read from `hmh-character-config.mjs` (`unlockableCharacters[].gate.count`, keyed by id); settle uses it for the `hero-locked` check of §4.3.3 step 11.
- **All games:** `score > 10_000_000_000` gives `422 score-out-of-bounds`.

**VerifiedRun** (success, frozen):
```
{ ok: true,
  gameId, sessionId32, sessionHandle, wallet, seasonId, runtimeId, buildHash, seed,
  score,                                                   // integer 0..1e10
  contract: { kills, maxCombo, survivalSeconds, bossId },  // integers clamped per A12; bossId string|null
  stats,                                                   // §6.3
  evidence: { encoding, text, bytes, digest },             // exactly what session_evidence stores
  envelopeHash,                                            // §2.6
  identity,                                                // canonical, incl. version + sessionKey
  verifiedAt }                                             // ISO from injected now()
```

Contract field mapping:

| gameId | kills | maxCombo | survivalSeconds | bossId |
| --- | --- | --- | --- | --- |
| `lester-blaster` | `kills.total` | `min(totals.maxCombo, 10000)` | `floor(totals.elapsedMs / 1000)` | `'boss-liquidator'` if `kills.boss > 0` else null |
| `chikun` | `forksPassed` | `min(bestCombo, 10000)` | `floor(survivalTicks / 60)` | null |
| `stacked` | `lines` | `min(maxCombo, 10000)` | `floor(ticks / 60)` | null |

---

## 6. Achievements

### 6.1 Modules (achievements slice)

`apps/portal/src/achievements/`:
- `index.mjs`: registry and derivation;
- `hmh.mjs`, `chikun.mjs`, `stacked.mjs`: one catalog per game;
- `stats.mjs`: the per-game stats mappers;
- `metadata.mjs`: the ERC-721 builder.

These are pure ESM, Node-safe, and must not import `arcade-core.mjs`, `hmh-run-integrity.mjs`, the DOM, `Date.now` or `Math.random`. They may import `sdk/hmh-run-summary-schema.mjs` catalogs, `chikun-ground-course.mjs` / `chikun-course-regions.mjs` (pure) and `stacked-sim.mjs` `zoneForTick`. They are **never** imported by `apps/hmh-reboot/**` or `sdk/**`.

**Catalog entry (frozen):**
```
{ id: string /^[a-z0-9][a-z0-9-]{1,63}$/, gameId, title: string ≤ 40, description: string ≤ 140,
  tier: 'bronze'|'silver'|'gold'|'platinum'|'diamond'|'mythic',
  category: string /^[a-z-]{2,24}$/, nft: boolean, available: boolean, order: integer,
  image: '/assets/…png', lockedImage: '/assets/…png',     // site-root absolute paths
  criteria: (run, history) => boolean,                      // pure; run = VerifiedRun-like {gameId, score, stats}
  progress: ((run|null, history) => ({ current:number, target:number }) | null) | null }
```

**Catalog rules:**
- HMH keeps exactly the 57 ids, titles and tiers of `ACHIEVEMENT_DEFINITIONS` (`arcade-core.mjs:1509-1573`); a parity test pins this. The seven `l2-*` ids are `available:false` ("coming soon"), because the reboot has no Level 2.
- Chikun and STACKED have **40 each**: 14 bronze, 12 silver, 9 gold and 5 platinum.
- **NFT candidates** (`nft:true`): 5 each for Chikun and STACKED (platinum, replay-verified), and **3 for HMH**: `two-hundred-ranked-runs`, `two-fifty-ranked-runs` and `arcade-legend-500`. Those depend only on server-counted paid runs. `marathon-wallet` (cumulative claimed survival) and `perfect-boss-gauntlet` (claimed no-damage) depend only on client-attested fields, because HMH is plausibility-checked (A9), so they are `nft:false`; the owner may revisit that in phase 2. The candidates are proposed only; nothing is defined on chain in phase 1, and the owner approves the subset in phase 2 (A20).
- **Owner review.** The owner reviews the catalog doc (`docs/game-design/achievement-catalogs-20260923.md`) at checkpoint O1 (§10.1) before any production deploy, because thresholds are baked into `achievement_unlocks` from the first verified run.

### 6.2 Registry API (`achievements/index.mjs`)

```
export const ACHIEVEMENT_GAME_IDS = ['lester-blaster','chikun','stacked'];
export function catalogFor(gameId) → ReadonlyArray<Entry>                  // throws on unknown gameId
export function achievementById(gameId, id) → Entry | null
export function nftAchievementIds(gameId) → string[]
export function historyFieldsFor(gameId) → { sum: string[], max: string[] } // stats paths, §6.5
export function emptyHistory(wallet, gameId) → History
export function deriveEarnedAchievements(gameId, verifiedRun, history) → ReadonlyArray<Entry>
    // = catalogFor(gameId).filter(e => e.available && !history.unlockedIds.includes(e.id) && e.criteria(verifiedRun, history))
    // throws if verifiedRun.gameId !== gameId; order = catalog order; deterministic
export function achievementId32(ethers, id) → '0x…'                          // ethers.id(id) = keccak256(utf8 id)
```

### 6.3 Stats shapes (`achievements/stats.mjs`)

These are the only inputs to criteria, `verified_sessions.stats` and the results screen. Every numeric value is a finite number.

```
statsFromChikunResult(result) →
{ score, survivalTicks, survivalSeconds /* ticks/60, 3 dp */, coinsCollected, forksPassed, nearMisses, bestCombo,
  nearMissStreakBest, flawlessRegions, flapCount, distanceMeters /* floor(distanceAtTick(ticks)/10) */,
  regionIndexReached /* 0..6, obstacle-exact: region of the highest obstacle index passed */,
  regionReached /* region id string */, laps /* completed loops */, speedMultiplierReached /* 2 dp */,
  terminalReason, evidenceVersion }

statsFromStackedTuple(tuple) →
{ score, lines, level, quadClears, spins, perfectClears, maxCombo, maxBackToBack, garbageRowsReceived,
  garbageRowsCleared, pieces, holdsUsed, ticks, survivalSeconds /* ticks/60, 3 dp */, zone /* zoneForTick(ticks) */,
  terminalReason, boardHash }

statsFromHmhRunSummary(runSummary) →
{ score, kills, bossKills, eliteKills, maxCombo, level, xp, survivalTicks, elapsedMs, survivalSeconds /* elapsedMs/1000, 3 dp */,
  damageTaken, damageDealt, healing, litecoin, grenadeKills, meleeKills,
  weaponsUsed /* string[] sorted */, uniqueWeaponCount, powerUpsCollected, uniquePowerUps /* string[] sorted */,
  districtsVisited, poisDiscovered, revealedPermille, killsByRole /* {roleId:count} */,
  familyKills /* {goblin, drone, gasBeast, …} per the catalog's role→family table */,
  noDamage /* 0|1 */, perfectBossKill /* 0|1 */, bossEngaged /* 0|1 */, heroId, terminalReason }
```

Chikun v6 must expose `nearMissStreakBest`, `flawlessRegions`, a meaningful `bestCombo` (≠ `forksPassed` in general) and the obstacle-exact region counters on the runtime `result` object. The chikun-tune slice adds them outside `finalState`, so bridge `validateFinalState` is unchanged.

**Leaderboard headline keys** (the `stats` subset in E5, E6 and E9 rows):
- `lester-blaster`: `kills, survivalSeconds, maxCombo, level, bossKills`
- `chikun`: `forksPassed, nearMisses, coinsCollected, bestCombo, survivalSeconds, regionReached, laps`
- `stacked`: `lines, level, quadClears, perfectClears, maxCombo, survivalSeconds`

These names match what `leaderboard-view.mjs` columns already read (`lines`, `level`, `quadClears`, `maxCombo`, `survivalSeconds`, `kills`, `bossKills`, `forksPassed`, `nearMisses`, `coinsCollected`, `bestCombo`).

### 6.4 HMH resolver fixes (achievements slice, in `arcade-core.mjs`)

- `maybeUnlockRunAchievements` runs only for `lester-blaster`. It uses `progress.paidRuns` (HMH-scoped) instead of `profile.totalPaidRuns`.
- `achievement-progress.mjs` `paidRuns` reads `profile.progress['lester-blaster'].paidRuns`.
- `ACHIEVEMENT_TIER_UNLOCK_PCT` gains a `mythic` entry rarer than `diamond`.
- `hmhResolverInputsFromRunSummary(runSummary)` (in `achievements/stats.mjs`) maps the canonical summary to the legacy resolver inputs (`arcade-core.mjs:4700-4760`), with these **exact keys**, so the browser resolver and the server catalog agree (guide §5.5 item 2):
  - `enemyKillsByType`, keyed by the **legacy ids the resolver reads**: the goblin family total under `'fud-goblin'`, the drone family under `'sybil-drone'`, the gas-beast family under `'gas-beast'`, using the `HMH_ROLE_FAMILIES` table;
  - `stageIndexReached`, derived from `districtsVisited` with the same thresholds the server catalog uses: `≥ 6 → 13`, `≥ 4 → 8`, `≥ 2 → 4`, else `1` (the resolver unlocks slums, foundry and getaway at 4, 8 and 13);
  - `grenadeKills`, `meleeKills`, `bossId` (`'boss-liquidator'` only when `kills.boss > 0`), `noDamage`, `maxCombo`, `weaponIds` and `collectedPowerUps`.
  
  A parity test runs the HMH fixtures through both the legacy resolver (with the mapper's inputs) and `deriveEarnedAchievements`, and requires the same HMH ids, except entries documented `available:false` and history-based ids that need server history. The ranked-client slice uses the mapper at the `submitCombatGameOver` call site.

### 6.5 History (read from Neon by `readAchievementHistory`, index slice)

```
History = { wallet, gameId,
            runs: number,                      // verified_sessions rows for wallet+game, all statuses, EXCLUDING the current session
            sums:   { [path]: number },        // sum over those rows of (stats #>> path)::numeric, 0 when none
            maxima: { [path]: number },        // max over those rows, 0 when none
            unlockedIds: string[] }            // achievement_unlocks ids for wallet+game
```

- **Paths:** `^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)?$`. A dotted path means nested JSON: `familyKills.gasBeast` becomes `stats #>> '{familyKills,gasBeast}'`.
- The SQL is built only from paths returned by `historyFieldsFor` and validated with that regex. Paths are never taken from user input.
- Criteria use `history.runs + 1` for totals that include the current run, and `history.sums[p] + run.stats[p]` for cumulative totals.

### 6.6 ERC-721 metadata (achievements slice; published in phase 2)

- **Generator:** `scripts/generate-achievement-metadata.mjs` (npm script `achievements:metadata`). It writes `apps/portal/achievements/<slug>/<id>.json`, where the slug is the on-chain gameId. It covers **every** available achievement, so the NFT subset can change without regenerating paths. `tokenUriPath = '<id>.json'` and `baseTokenUri = 'https://lestersarcade.io/achievements/<slug>/'`.
- **JSON:**
  ```
  { name, description, image: 'https://lestersarcade.io' + entry.image, external_url: 'https://lestersarcade.io/games/<route-slug>',
    attributes: [ {trait_type:'Game', value:title}, {trait_type:'Tier', value}, {trait_type:'Category', value},
                  {trait_type:'Soulbound', value:'Yes'}, {trait_type:'Season', value:'LiteForge testnet'} ],
    animation_url?: string }
  ```
  `animation_url` is reserved. It is emitted only when the catalog entry has `animation` (a site-root path to a `.glb` or a self-contained `.html` viewer). Upgrading the art means replacing files, never re-minting.

---

## 7. Client module APIs

### 7.1 `apps/portal/src/ranked-identity.mjs` (verify slice; browser and server)

Pure, no DOM. It imports only `session-integrity.mjs` and `session-seed.mjs`.

```
export const RANKED_GAMES = Object.freeze({ 'lester-blaster': { gameId, slug:'hard-money-heroes', title, seasonId, runtimeId, buildHashPattern, evidenceEncoding },
                                            chikun: {…}, stacked: {…} });   // values from §2.1/§2.2/§2.6
export const RANKED_SETTLE_VERSION = 'lesters-ranked-settle-v1';
export const RANKED_ENVELOPE_VERSION = 'lesters-ranked-envelope-v2';
export function rankedIdentityFor(session, { chainId = 4441, scoreRegistryAddress }) → identity preimage (§2.4, sync)
export async function rankedSessionKey(identity) → '0x…'
export function validateRankedIdentity(identity, { chainId, scoreRegistryAddress, wallet, gameId }) → { ok:true, identity } | { ok:false, error }   // §5.2 minus the async key check
export function shareIdFor(sessionId32) → string ; export function sessionId32ForShareId(shareId) → '0x…' | null
export async function sha256BytesHex(bytes: Uint8Array) → '0x…'       // WebCrypto; works in Node ≥20 and browsers
export async function evidenceDigestFor(gameId, evidence) → '0x…'       // §2.6
export async function rankedEnvelopeHash({ gameId, sessionId32, encoding, evidenceDigest }) → '0x…'
export function applySeedTicket(session, { seed, seedTicket }) → session
    // sets session.seed = seed, session.canonicalContext = Object.freeze({ ...session.canonicalContext, seed }),
    // session.seedTicket = seedTicket; call before rankedIdentityFor / rankedSessionKey and before the game mounts
```

`apps/portal/src/session-seed.mjs` (verify slice) exports `deriveSessionSeed` (FNV, frozen) and `async deriveRankedSeed({ sessionId, wallet, gameId, seasonId, buildHash, salt })` (§2.7). It imports only `session-integrity.mjs`.

### 7.2 `apps/portal/src/ranked-settlement.mjs` (ranked-client slice; lazy-loaded)

```
export const RANKED_CLIENT_STATES = ['preview','waiting-entry','verifying','queued','publishing','published',
                                     'retrying','saved-locally','rejected','practice'];
export function createRankedSettlementClient({ live, fetchImpl = fetch, getToken /* (wallet) => string|null */, storage,
                                                now = Date.now, setTimeoutImpl, clearTimeoutImpl,
                                                pendingKey = 'lesters-arcade-ranked-pending-v1',
                                                onPendingCount /* (count) => void */, onPublished /* (snapshot) => void */,
                                                onUnauthorized /* (wallet, refusedToken) => void */ }) → {
  settle(request /* §5.1 body */, { entryConfirmed /* Promise<'confirmed'|'failed'>|null */, localScore, persistBody = true }) → Handle,
  resume() → Handle[],            // re-drive stored pending requests after reload (live only)
  get(sessionId32) → Handle | null,
}
Handle = { sessionId32, gameId, get state(), get snapshot(), subscribe(fn) → unsubscribe, retry() → Promise<void>, dispose() }
snapshot = { state, sessionId32, shareId, gameId, wallet, localScore,
             entry: { status:'none'|'pending'|'confirmed'|'failed', txHash|null },
             server: SettleResponse | null, error: { code, message, retryable } | null, updatedAt }
```

**Client state machine:**
- `live === false` → `preview` (terminal; no network).
- `entryConfirmed` pending → `waiting-entry` (at most 90 s). `failed`, or a timeout, → `practice` (terminal; no `/api/settle` call).
- POST → `verifying`. Then the server status maps as follows:
  - `pending` or `signed` → `queued`: POST `{retry:true}` after `pollAfterMs`, at most 20 times, then keep polling GET status every 15 s (the cron drains the queue).
  - `submitted` → `publishing`: GET status every `pollAfterMs` for at most 180 s.
  - `confirmed` → `published` (terminal).
  - `failed` + `retryable` → `retrying`: POST retry after `max(pollAfterMs, nextAttemptAt - now)`.
  - `failed` + not retryable → `rejected`.
- An error body with `retryable: true` (`entry-pending`, `run-timing-early`) → `retrying`: re-POST the full body after `max(retryAfterMs, 5 s)`, with backoff; `entry-pending` gives up after 10 minutes into `saved-locally`.
- Any other HTTP 4xx except 401, 404 and 429 → `rejected`, with the server code. That includes `402 entry-not-paid` and `entry-underpaid`, which the server returns only when the chain proves them (A17).
- 401 → `saved-locally`, with error `sign-in-required`, after calling `onUnauthorized(wallet, refusedToken)` (main.js: the wallet session drops that token, §7.6). A refused retry nudge follows the status view instead.
- 404 on a retry POST or a status GET → re-POST the full body once, if it is still persisted; otherwise `saved-locally`.
- A network error, 429 or 5xx → `saved-locally`: backoff 5, 15, 45, 120 s, then a manual `retry()`. `503 settlement-paused` shows "Ranked publishing is paused; your run is saved and will publish when it resumes."
- The request body is persisted in `storage[pendingKey]` (at most 5 entries, newest first) until `published`, `rejected` or `practice`.
- STACKED bodies above 240,000 base64 chars are not persisted: the results screen says "Keep this tab open until publishing finishes".
- Every fetch uses `cache:'no-store'`. POSTs **and** status GETs send `Authorization: Bearer <getToken(wallet)>` for the run's wallet, so status responses are the owner view (§4.4).
- Integration: the client dispatches `lesters:ranked-pending` `{ count }` whenever the number of unpublished persisted bodies changes, and listens for `lesters:ranked-retry-request` `{ sessionId32|null }`: a specific id calls that handle's `retry()`, and `null` calls `resume()` (§7.7).

`apps/portal/src/ranked-requests.mjs` (ranked-client slice), with pure request builders:
```
export async function buildChikunSettleRequest({ session, scoreRegistryAddress, evidence /* v6 evidence object from replayClaim */, claimScore })
export async function buildStackedSettleRequest({ session, scoreRegistryAddress, sic1Bytes, claimScore })
export async function buildHmhSettleRequest({ session, scoreRegistryAddress, runSummary, sessionEnvelope, claimScore })
  → §5.1 body (identity = rankedIdentityFor(session, …), sessionId32 = await rankedSessionKey(identity),
               seedTicket = session.seedTicket, entryTxHash = session.entryReceipt?.txHash ?? null)
```

A builder throws if `session.seedTicket` is missing while live; preview never builds a body.

**Result context** (guide §3.3 hero and standing). Before a Ranked run starts, ranked-client captures `context.displayName` and `context.previousBest`: in hosted mode from `GET /api/profile?wallet=` (public view: `profile.displayName`, `games[g].bestScore`), fetched once when the run starts, and in preview from local state (`currentPlayerBestScoreForMode` semantics, recomputed locally without touching results-share's range). A device-local best is never used in hosted mode.

### 7.3 Results screen (results-share slice)

`apps/portal/src/ranked-results-model.mjs` (pure):
```
export function buildRankedResultsModel({ snapshot, context, standing /* E5 'you' per period or null */ }) →
  { hero: { score, scoreLabel, handle },
    standing: { text: string|null, personalBestDelta: number|null },
    stats: [{ key, label, value }],                  // per game, §3.3 of the guide: HMH kills/time/combo/level/boss; Chikun region/laps/forks/near-misses/coins/best combo; STACKED lines/level/Halvings/perfect clears/best combo/time
    timeline: [{ id:'entry'|'verified'|'publishing'|'published'|'achievements', status:'done'|'active'|'pending'|'failed'|'skipped', label, href|null }],
    achievements: [{ id, title, tier, image, tokenId: string|null }],   // no NFT field shown in phase 1 (A32)
    actions: { share:boolean, retry:boolean, playAgain:true, practice:true, profile:boolean },
    banner: { kind:'preview'|'practice'|'saved-locally'|'retrying'|'paused'|'rejected'|null, text } }
```

- `actions.share` is true only in `published` (a confirmed session) and in `preview` or `practice` (which share the Free template to the site root). A Ranked share never goes out before the run is on chain.
- NFT-flagged unlocks render as normal achievements. A token badge and link appear only when `tokenId` is non-null (A32).
- `hero.handle` is `context.displayName`, or the short wallet when it is null (hidden and blocked names are null upstream).

`apps/portal/src/ranked-results.mjs` (lazy UI):
```
export function openRankedResults({ handle, context, actions, documentRef = document, mount, fetchImpl, live, hosted, reducedMotion })
  → { close(), update(), element }
```
- It subscribes to `handle`. When it reaches `published` and `hosted` is true, it fetches the standing with `GET /api/leaderboard?game=&period=weekly&wallet=` and `period=all-time`.
- Focus is trapped inside while open. `Escape` closes it, and focus returns to the previously focused element.
- It honours `prefers-reduced-motion` and works at 320 px.
- Styles live in `apps/portal/src/styles/ranked-results.css`, injected as `<link>` once.

### 7.4 Share links (`apps/portal/src/share-links.mjs`, results-share slice)

```
export const SHARE_ORIGIN = 'https://lestersarcade.io';
export const X_MENTION = '@LestersArcade'; export const X_RELATED = 'LestersArcade';
export function shareUrlFor(path = '')                                   // existing
export function sharePageUrl(sessionId32OrShareId) → 'https://lestersarcade.io/s/<shareId>'
export function xWeightedLength(text) → number                           // twitter-text v3 weights; URLs are NOT in text (added by X)
export function buildRankedShareText(gameId, { score, standingLabel, stats, personalBest }) → string   // multi-line, '\n'
export function buildFreeShareText(gameId, { score, stats }) → string   // ends 'Practising on @LestersArcade', no verification line
export function buildShareLinks({ text, url }) → Object.freeze({ text, url, x, facebook, discord })
    // x = 'https://x.com/intent/post?text=…&url=…&related=LestersArcade'; NO hashtags parameter, no `via`
    // facebook = 'https://www.facebook.com/sharer/sharer.php?u=…'; discord = text + '\n' + url
export function createShareRow({ documentRef, navigatorRef, title, links, onStatus })  // primary "Share on X"; secondary menu: Copy for Discord, Facebook, native share
```

**Invariants** (all tested):
- `xWeightedLength(text) + 1 + 23 ≤ 280`;
- `@LestersArcade` appears exactly once;
- no `#`;
- no `/0x[0-9a-fA-F]{40}/`;
- no `session-`;
- newlines are preserved (the old `clean()` whitespace collapse is removed for templates).

The templates are the guide's §5.12 texts minus the URL line: X appends the `url` parameter. The Ranked standing reads "Rank N this week" (for example `48,210 pts · Rank 3 this week`), never "#3": the no-`#` invariant covers it, there are no hashtags, and Weekly is the headline period while the Daily board is off (D2). The results screen and the card, which are not share text, still show "#3 this week" (amended at integration, results-share). The Ranked template (with its "⛓ Verified on LitVM" line) is used only for a `published` run; every other state shares the Free template to the site root (§7.3 `actions.share`). In the Chikun and STACKED children, the child result panel's share row is hidden for Ranked runs, because the parent results screen owns Ranked sharing and the child does not know the session key (results-share slice). `buildHmhShareText` and `buildStackedShareText` stay exported for Free Mode and child callers, without hashtags.

### 7.5 Share page and card (results-share slice; server)

- **Card revision.** `cardRev = (await sha256Hex(canonicalSessionJson({ status, displayName, avatarUri, hidden, verification }))).slice(2, 14)`, computed by index in `readPublicSession` (E9 `cardRev`). Standing is not in the revision: the card's standing can lag by up to its 1-hour `s-maxage`.
- **Unpublished runs.** For any status other than `confirmed`, the page and the card show "Publishing to LitVM…" with no transaction link and no "Verified on LitVM" badge, and the page carries `noindex`.
- **Hidden profiles.** The page and the card use `walletShort` and the default avatar when `displayName` is null (A29).
- `server/share/render-page.mjs`: `renderSharePage({ session /* E9 shape */ | null, status }) → { status, headers, html }`. It HTML-escapes every interpolated value and writes these tags:
  - `og:type=website`, `og:site_name=Lester's Arcade`, `og:title`, `og:description`, `og:url=https://lestersarcade.io/s/<shareId>`;
  - `og:image=https://lestersarcade.io/api/share-card/<shareId>.png?v=<cardRev>`, `og:image:width=1200`, `og:image:height=630`;
  - `twitter:card=summary_large_image`, `twitter:site=@LestersArcade`, `twitter:title`, `twitter:description`, `twitter:image`;
  - `<link rel=canonical>`.

  The body shows the card, stats, standing, badges, the transaction link and Play buttons (`/play/<route-slug>`). The CSS is inline and the page has no JS.
- `server/share/render-card.mjs`: `buildShareCardElement({ session, background /* data URI */ })` returns a Satori element tree of plain objects (no JSX). The image is 1200×630:
  - game key art background from `apps/portal/assets/share-cards/<gameId>.png`, read with `fs` and passed as a data URI (see `includeFiles`);
  - score, handle (or short wallet), standing, three headline stats, up to 4 badge images, and a "Verified on LitVM" badge **only when `status === 'confirmed'`** (otherwise "Publishing to LitVM…");
  - no emoji (Satori would fetch emoji from a CDN).
- `api/share-card.mjs` uses `new ImageResponse(element, { width:1200, height:630 })` from `@vercel/og` 0.11, then `Buffer.from(await response.arrayBuffer())`, `content-type: image/png`, and the cache rules of E11. If `v` is present and differs from the current `cardRev`, it answers `302` to the current versioned URL (`Cache-Control: public, s-maxage=60`) instead of rendering, so varying `v` cannot force renders. A missing `v` renders the current revision.
- `@vercel/og` 0.11.1 was proven to render a 1200×630 PNG in Node in 159 ms (feasibility review), so the font risk is closed; the slice still commits a Node render test.

### 7.6 Wallet session and sign-in (signin-entry slice)

`apps/portal/src/wallet-config.mjs`:
```
export const REOWN_PROJECT_ID = 'eedf4ae26a379df793b7f4eef223a0c9';    // public id; never name it *_API_KEY (security audit regex)
export const REOWN_ALLOWED_HOSTS = ['lestersarcade.io','www.lestersarcade.io'];
export const FEATURED_WALLET_RDNS = ['io.metamask','io.rabby'];
export const WALLET_INSTALL_LINKS = { 'io.metamask':'https://metamask.io/download/', 'io.rabby':'https://rabby.io/' };
export const WALLET_DEEP_LINKS = { metamask:'https://metamask.app.link/dapp/lestersarcade.io', trust:'https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Flestersarcade.io' };
export const LITEFORGE_FAUCET_URL = 'https://liteforge.hub.caldera.xyz';
```

`apps/portal/src/wallet-session.mjs`:
```
export const WALLET_CONNECTOR_STORAGE_KEY = 'lesters-arcade-wallet-connector-v1';   // { kind:'eip6963'|'walletconnect'|'legacy', rdns|null, wallet }
export function createWalletSession({ hosted, fetchImpl, storage, now, profileSync, loadEthers, domain, chainId = 4441 }) → {
  async signIn({ provider, address }) → { ok, wallet, authenticated, token|null, expiresAt|null, error?: { kind, message } }
      // hosted: GET /api/session/nonce → buildSiweChallenge({domain, address, chainId, nonce, issuedAt: server issuedAt}) → personal_sign → profileSync.login()
      // !hosted: local challenge with generateNonce(), verified with ethers.verifyMessage (today's behaviour), no network
  async restore({ provider }) → { ok, wallet|null, authenticated, providerPending }
      // injected / EIP-6963: eth_accounts (no prompt) + stored token for the same wallet ⇒ authenticated without a signature.
      // walletconnect: NEVER creates AppKit at boot (no relay connection in Free Mode, guide rule 3). With a live token for the
      // remembered wallet it returns { ok:true, wallet, authenticated:true, providerPending:true }; the provider is created
      // lazily on the first action that needs the wallet (Sign in, the Ranked entry, a profile write).
  isAuthenticated(wallet) → boolean, token(wallet) → string|null, signOut() → void,
  invalidate() → void,        // drop the token after a 401 without forgetting the wallet; announces { wallet, authenticated:false }
  announce({ wallet, authenticated }) → detail,                     // dispatches lesters:wallet-session (§7.7)
  remember({ kind, rdns, wallet }) → void, remembered() → { kind, rdns, wallet } | null }
```

The Bearer token is stored by `profileSync.login` under the existing key `lesters-arcade-session-token` (`{wallet, token, expiresAt}`). Every Bearer caller (profile pull and PUT, the index client's self view, refresh and preferences, settle, seed tickets, the name-claim flow) reads it only through `walletSession.token(wallet)` / `isAuthenticated(wallet)`, which are backed by `profileSync.tokenFor(wallet)` (a live v2 token issued to that wallet, or null); `main.js` never reads `profileSync.session`, `hasSession` or `tokenFor` itself (amended at integration, integration-glue; `tests/integration-glue-signin.test.mjs`). A 401 from any Bearer caller reaches `main.js` as `onUnauthorized(wallet, refusedToken)`, which calls `walletSession.invalidate()` only while the wallet session still holds that token for that wallet: a 401 for a token already replaced by a newer sign-in (a request still in flight across a wallet switch) signs nobody out. Stored pre-v2 (1.7.0) tokens are discarded by both `profileSync` and the wallet session. `walletConnector` stays `'injected-evm'` for WalletConnect too (it is an EIP-1193 provider). A new `main.js` global, `connectedProvider`, holds the provider the player picked, and `detectEthereumProvider()` returns it first when it is set.

`apps/portal/src/ranked-preflight.mjs`:
```
export function createRankedPreflight({ live, loadEthers, readProvider /* public RPC */, now, ttlMs = 60000 }) → {
  start({ gameId, wallet, walletProvider }) → Promise<Preflight>,   // background, cached per gameId+wallet
  peek({ gameId, wallet }) → Preflight | null }
Preflight = { ok, gameId, chainId|null, onChain, balanceWei: bigint, entryFeeWei, settlementGasReserveWei, entryTotalWei,
              needWei /* entryTotal + gas estimate */, hasFunds, rankedEntryAddress, error|null, errorKind|null, checkedAt }
```

**Seed ticket.** When live, `requestRankedEntry`'s approve handler first calls E15 (`POST /api/ranked/seed` with the Bearer token, `cache:'no-store'`, body `{ gameId, sessionId, seasonId, buildHash }` from the pending session), then `applySeedTicket(pendingSession, response)` (§7.1), and only then builds the identity and the session key. A 503 (`settlement-paused`, `settlement-not-configured`) shows "Ranked is paused right now. Free Mode is open." and resolves false, with no wallet prompt. A 401 re-runs sign-in once. The preflight may fetch the ticket in the background when the modal opens, as long as it is applied before the key is computed; a prefetched ticket older than 10 minutes at approval is fetched again, because E3 rejects a ticket used more than 30 minutes after issue (A26).

**Entry.** `litvm-chain-client.mjs` gains `sendRankedEntry(walletProvider, { sessionKey, gameId, preflight })`, which returns `{ txHash, sessionId32, amountWei, wait: () => Promise<{ status:'confirmed'|'failed', blockNumber|null }> }` right after broadcast. `openRankedSession` stays as a wrapper that awaits `wait()`, for existing tests. `requestRankedEntry` sets:

```
pendingSession.entryReceipt = { txHash, sessionId32, amountWei: string, status: 'pending' }
pendingSession.entryConfirmed = wait().then(r => (pendingSession.entryReceipt.status = r.status))   // 'confirmed' | 'failed'
```

and dispatches `lesters:ranked-entry` (§7.7). The approve flow resolves (and the run starts) on broadcast.

### 7.7 Integration events (dispatched on `window`)

| Event | Dispatched by | `detail` | Listened to by |
| --- | --- | --- | --- |
| `lesters:ranked-run` | ranked-client, once per finished Ranked run (preview included) | `{ handle, context, actions }` (below) | results-share (opens the results screen); profile-boards (first-Ranked name prompt) |
| `lesters:ranked-entry` | signin-entry | `{ sessionId, gameId, status:'broadcast'|'confirmed'|'failed', txHash }` | results-share (entry chip); ranked-client (optional) |
| `lesters:wallet-session` | signin-entry | `{ wallet|null, authenticated:boolean }` | profile-boards, unlockables |
| `lesters:profile-changed` | profile-boards (after rename or avatar confirmation plus refresh) | `{ wallet, displayName|null, avatarUri|null }` | results-share (handle), unlockables |
| `lesters:ranked-pending` | ranked-client (whenever the count of unpublished persisted bodies changes, and once after boot) | `{ count }` | profile-boards (the D10 "Retry saved runs" button) |
| `lesters:ranked-retry-request` | profile-boards (Retry buttons) | `{ sessionId32: string|null }` | ranked-client (`get(id)?.retry()`, or `resume()` for null) |

`lesters:ranked-run` detail:
```
{ handle,                                               // §7.2
  context: { gameId, gameTitle, sessionId, sessionId32: string|null, wallet, displayName: string|null,
             localScore, localStats /* §6.3 shape computed locally */, previousBest: number|null,
             entry: { status:'none'|'pending'|'confirmed'|'failed', txHash|null }, mode: 'ranked' },
  actions: { playAgainRanked(), practiceFree(), viewProfile(), backToArcade() } }
```

The results-share listener sits in `main.js` immediately before the line `// Initial paint honors the URL (deep-link / refresh) instead of always splash.` (`:15330`):

```
window.addEventListener('lesters:ranked-run', (event) => { void import('./src/ranked-results.mjs').then(({ openRankedResults }) => openRankedResults({ ...event.detail, documentRef: document, mount: dom.officialGameplay ?? document.body, live: SETTLEMENT_LIVE, hosted: HOSTED_PROFILE_SYNC })).catch((error) => console.error('[Ranked results]', error)); });
```

### 7.8 Index API client and profile writes (profile-boards slice)

- `apps/portal/src/index-api-client.mjs`: `createIndexApiClient({ hosted, fetchImpl, getToken /* () => string|null */, onUnauthorized /* (wallet, refusedToken) => void, on a 401 to a Bearer call */ })` returns `{ leaderboard(params), profile(wallet, { self }), refreshProfile(wallet), savePreferences(prefs), session(shareId), retrySettle(sessionId32) }`.
  - Every method resolves `{ ok:false, error:'offline-preview' }` without fetching when `hosted` is false.
  - `profile(…, {self:true})` calls the self URL `GET /api/profile?wallet=…&self=1` with the Bearer token; it and `savePreferences` use `cache:'no-store'`.
  - `refreshProfile` sends the Bearer token when the wallet is the signed-in one (E8 rate limits).
  - `retrySettle(sessionId32)` POSTs `{ v:'lesters-ranked-settle-v1', sessionId32, retry:true }` to `/api/settle` with the Bearer token.
- `apps/portal/src/profile-sync-client.mjs` (the token store): `createProfileSync({ …, getToken /* (wallet) => string|null */, onUnauthorized /* (wallet, refusedToken) => void */ })`. In the portal `getToken` is `walletSession.token` (§7.6); `pull()` and `push()` send a Bearer token only when it is a v2 token naming the requested wallet. On a 401 it calls `onUnauthorized(wallet, refusedToken)`, logs out only if its stored token is the refused one, and `pull()` then reads the public view once without a token. `tokenFor(wallet)` answers the stored live v2 token issued to that wallet, or null.
- **D10 retry on the profile** (profile-boards). On the viewer's own profile (self view), each recent session with status `failed` or `signed` and `retryable` shows a **Retry** button that dispatches `lesters:ranked-retry-request` with its id when ranked-client holds a handle for it, and otherwise calls `retrySettle`. When `lesters:ranked-pending` reports a count above zero, the profile shows "N runs saved on this device" with **Retry saved runs** (`lesters:ranked-retry-request` with `null`). A dead-lettered session shows "This run could not be published. Testnet entries are not refunded." and no button.
- **Held tokens** (A32): only when an achievement's `tokenId` is non-null does the profile show the "⛓ Soulbound NFT" badge and token link, and confirm it with `fetchPlayerAchievements` over the public RPC.
- `apps/portal/src/profile-chain.mjs`:
  - `normalizeHandle(raw)` returns `{ ok, cleaned /* string to send: trim 0x20 ends, collapse space runs to one */, normalized /* lowercase, for hashing */, handleHash, error }`. It mirrors `PlayerProfileRegistry._normalizedHandle` exactly: charset `[A-Za-z0-9 _.-]`, 3 to 18 bytes after collapsing.
  - `handleOwner(handleHash, { readProvider })`.
  - `estimateSetProfile(walletProvider, { displayName, avatarUri })` returns `{ gasLimit, gasWei, gasZkLtc }`.
  - `sendSetProfile(walletProvider, {...})` returns `{ txHash, wait() }`.
- `apps/portal/src/arcade-avatars.mjs`: `ARCADE_AVATARS = [{ id, label, src }]` (existing site art). `avatarUri = 'lestersarcade:avatar/<id>'`.
- `apps/portal/src/name-moderation.mjs` (**index slice, wave 1**; shared by the browser and the server, A29): `moderateName(cleaned)` returns `{ ok, reason:'profanity'|'impersonation'|null }`. It reuses `username-registry.containsBlockedTerm` and adds impersonation terms (lester, lesters, lestersarcade, admin, official, moderator, support, litvm, dappit), applied after folding look-alike characters (0→o, 1→l, 3→e, 4→a, 5→s, 7→t, @→a, $→s). profile-boards uses it before the wallet prompt; index uses it in `sanitizeOnchainProfile`.

### 7.9 Unlockables (unlockables slice)

`apps/portal/src/unlockables.mjs`:
```
export const UNLOCKABLES = [{ id, gameId, kind:'character'|'hero-skin'|'weapon-skin'|'coat'|'trail'|'hat'|'piece-skin'|'scene',
                              title, requires: { achievementId } | { confirmedRuns: n }, preview: '/assets/…', artStatus:'ready'|'pending' }];
export function unlockState(entry, { achievementIds: Set, heldAchievementIds: Set /* tokenId != null */, confirmedRuns: {gameId:n} }) → { unlocked, reason }
export function unlocksFromProfileResponse(profileResponse) → { achievementIds, heldAchievementIds, confirmedRuns }
```

`apps/portal/src/unlockables-store.mjs` reads and writes the per-wallet cache of A7.

**Sets (D8, "yes to everything proposed"), with no new art files:**

| Game | Kinds and minimum count | How it renders |
| --- | --- | --- |
| Hard Money Heroes | `hero-skin` ≥ 3 (palette tints of the selected hero), `weapon-skin` ≥ 3 (tints of weapon and projectile sprites) | Pixi `tint` in the HMH child, driven by an optional `cosmetics` key in the existing init settings. **Budget: ≤ 350 B** of HMH child initial JS; tint tables stay in the parent. |
| Chikun's Escape | `coat` ≥ 4 (hue and saturation filters at draw time), `trail` ≥ 3 (particle colours), `hat` ≥ 3 (drawn procedurally from pixel rectangles on the Chikun sprite: for example a cap, a top hat and a crown) | Chikun child draw hooks. |
| STACKED | `piece-skin` ≥ 4 (palette sets), `scene` ≥ 3 (colour grades of existing visualizers; never lock a visualizer that is free today) | Lazy render modules. **Budget: ≤ 400 B** of STACKED entry JS. |

If the HMH tint plumbing cannot fit its budget, the slice stops and reports to the orchestrator, which asks the owner. It never silently ships HMH skins as "Coming soon".

**HMH hero gates.** profile-boards owns `buildCharacterUnlockMap(profile, config, { verifiedRuns })` and its tests: Lester at 5 and Lilly at 10 confirmed runs from `games['lester-blaster'].confirmedRuns` when hosted, local counts in preview. Unlockables only supplies `verifiedRuns` from the A7 cache, so the gates work before E6 loads and offline, and adds one test for that. E3 enforces the same gates for Ranked (§4.3.3 step 11).

---

## 8. Contract call facts

### 8.1 Addresses and the generated module

`apps/portal/src/generated/litvm-addresses.mjs` is generated by `scripts/generate-litvm-addresses.mjs` (contracts slice). **Never hand-edit it.**

```
// GENERATED by scripts/generate-litvm-addresses.mjs — do not edit.
export const LITVM_DEPLOYMENT = Object.freeze({
  status: 'predicted' | 'deployed',
  chainId: 4441,
  source: 'predicted-from-operator-nonce-0' | 'contracts/deployment-record.hardened.json',
  deployedAt: null | '<ISO>',
  startBlock: null | <number>,             // min deployment block, from the record
  deployer: '0x6ac08bed727a6951d755f0674f096e6a8ac06bff',
  trustedVerifier: '0x4d637a6c5b5c6f97cfa3d98bd53deeb8510120c7',
  relayer: '0x494af36ea4958c417260faf3efb3b672b343eaf6',
  settlementGasReserveWei: '2000000000000000',
  addresses: Object.freeze({
    gameRegistry, playerProfileRegistry, arcadeRankedEntry, scoreSubmissionRegistry,    // lowercase
    achievementRegistries: Object.freeze({ 'lester-blaster', chikun, stacked }),
  }),
});
```

Predicted values, from `getCreateAddress({from: 0x6Ac08Bed…6bfF, nonce})`:

| Nonce | Contract | Address |
| --- | --- | --- |
| 0 | GameRegistry | `0xCB0B695eBEE650aFcCe93F566259cb477B19bf23` |
| 1 | PlayerProfileRegistry | `0x3EB9e9F2620940496A2b8Ed6f7384e6687587c94` |
| 2 | ArcadeRankedEntry | `0x10cd09e694e2B2Cd70d37f8CDdDcdA3Ef1208190` |
| 3 | ScoreSubmissionRegistry | `0xc5c5949a02fAC9a4115df182672C0f8cEB0Eaf55` |
| 4 | Achievements lester-blaster | `0xc1A383cB7521978f429424443fdD69Bdd71Ff737` |
| 5 | Achievements chikun | `0xf6Cd1cf7e1acCAeA93ACcdFB911034b3e8EB6f93` |
| 6 | Achievements stacked | `0x5430f8c142Ca7ec8971a447Cc09ae63f8860A8A7` |

`settlement.mjs` `LITVM_CONTRACT_ADDRESSES` is rebuilt from this module with exactly these keys:

```
{ gameRegistry, playerProfileRegistry, arcadeRankedEntry, scoreSubmissionRegistry,
  achievementRegistries: { 'lester-blaster', chikun, stacked } }
```

The legacy June keys (`achievementRegistry`, `arcadePaymentRouter`, `lestersArcadeCore`) are removed. `contracts/deployment-record.json` (June) stays as the archive.

`deployment-record.hardened.json` gains `blocks: { gameRegistry, playerProfileRegistry, arcadeRankedEntry, scoreSubmissionRegistry, achievementRegistries:{slug:n} }`, `startBlock` (their minimum) and `deployTxHashes` (same shape).

### 8.2 ScoreSubmissionRegistry

- **EIP-712 domain:** `{ name:"Lester's Arcade Ranked Settlement", version:'2', chainId:4441, verifyingContract:<registry> }`.
- **`VerifiedRun`** is 13 fields in this order: `sessionId, gameId, player, score, kills, maxCombo, survivalSeconds, bossId, envelopeHash, runtimeId, seasonId, deadline, achievementsHash`.
- **Signing:** `signVerifiedRun(ethers, { verifiedRun, nftAchievementIds, deadline, domain, signer })` (settle slice, `server/settle/attestation.mjs`) calls `buildVerifiedRun`:
  - ids that are not bytes32 are hashed with `ethers.id`;
  - a null `bossId` becomes ZERO32;
  - `achievementsHash = keccak256(abi.encodePacked(bytes32[]))`, or `keccak256('0x')` when empty.
  - `runtimeId` and `seasonId` must never be null (null would hash `ethers.id('')`); the verified run always carries both.
- **Submission:** `submitVerifiedSession(run, achievements32, signature)` is sent from the relayer. It reverts, in this order:

  | Order | Revert |
  | --- | --- |
  | 1 | `NOT_PLAYER_OR_RELAYER` |
  | 2 | `ATTESTATION_EXPIRED` |
  | 3 | `EMPTY_*` |
  | 4 | `SESSION_EXISTS` |
  | 5 | `TOO_MANY_ACHIEVEMENTS` |
  | 6 | `ACHIEVEMENTS_HASH_MISMATCH` |
  | 7 | `GAME_NOT_PLAYABLE` |
  | 8 | `RANKED_ENTRY_UNSET` / `SESSION_NOT_PAID` |
  | 9 | `*_OUT_OF_BOUNDS` |
  | 10 | `INVALID_ATTESTATION` |

  It then calls `mintFor` on `achievementRegistryByGame[gameId]` for each id. An undefined id returns false without reverting. **A registry that reverts, for example `"Only minter"`, reverts the whole settlement.**
- **Reads:** `getSession(bytes32)` returns `(sessionId, player, gameId, score, kills, maxCombo, survivalSeconds, bossId, runtimeId, seasonId, submittedAt, verified, exists)`. Also `sessionEnvelopeHash(bytes32)`, `getSessionAchievements(bytes32)`, `relayers(address)`, `rankedEntry()`, `trustedVerifier()`.
- **Server ABI:** derived from `contracts/artifacts/ScoreSubmissionRegistry.json`, not hand-written. A test asserts that the server's function fragments exist in the artifact ABI.
- **Events to index:**
  - `ScoreSubmitted(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId)`, topic0 `0x73ec57c5e363c24b83733fedeed6265c15e32920f276b11eec2f92ef9a673bdf`. It carries no envelope hash and no achievements.
  - `SessionSubmitted(bytes32 indexed sessionId, bool verified)`, topic0 `0xc558944acf0a60aaa447720c7d7854875dd95d6576e6f10d3a582b1553ca4ca5`. Not indexed separately.

### 8.3 ArcadeRankedEntry

| Function | Facts |
| --- | --- |
| `quoteEntry(bytes32 gameId)` | Returns `(entryFeeWei, settlementGasReserveWei, totalWei)`. Reverts `GAME_NOT_REGISTERED`. Returns `(0,0,0)` when fees are disabled. |
| `openSession(bytes32 sessionId, bytes32 gameId)` | Payable, exact `totalWei`. Reverts: `EMPTY_SESSION_ID`, `SESSION_EXISTS`, `GAME_NOT_REGISTERED`, `GAME_NOT_PLAYABLE`, `DEV_WALLET_UNCONFIRMED`, `WRONG_ENTRY_FEE`, `RELAYER_VAULT_UNSET`, `ENTRY_FEE_DISABLED`. |
| `isPaid(bytes32 sessionId, address player, bytes32 gameId)` | View, returns bool. |
| `getPaidSession(bytes32)` | Returns `(player, gameId, amountWei, openedAt, exists)`. E3 uses it for the paid, amount and timing checks (A26, A27). |
| `setEntryFeeEnabled(bool)` | Operator only. `false` makes `openSession` require `msg.value == 0` and `quoteEntry` return `(0,0,0)`. **Never a kill switch** (A27): with the minimum-paid check such sessions are rejected, so disabling fees makes Ranked unusable. |

Event `RankedSessionOpened(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 amountWei)`, topic0 `0x14f46b8cebfe91f0708e999826c93785fc98cc35cb8c7c5a53ecbf99aaaf1207`.

### 8.4 PlayerProfileRegistry

- **Reads:**
  - `getProfile(address)` returns `(bytes32 handle, string displayName, string avatarUri, uint256 createdAt, uint256 lastUpdated, bool exists)`;
  - `handleOwners(bytes32)` returns an address.
- **Write:** `setProfile(string displayName, string avatarUri)` creates or updates. It reverts `Handle taken`, `Invalid handle char`, `Handle too short` or `Handle too long`.
- **Handle hash:** `keccak256(utf8(normalized))`, where `normalized` is:
  1. strip leading and trailing `0x20` only;
  2. lowercase A to Z;
  3. allow only `[a-z0-9 _.-]`;
  4. collapse runs of spaces;
  5. require 3 to 18 bytes.
- **Always send the cleaned string**: trimmed, single spaces, original case.
- **Mirror sanitizing** (server, `server/profile/sanitize.mjs`, index slice):
  - `display_name` = the trimmed and collapsed `displayName` if it matches `^[A-Za-z0-9 _.-]{3,18}$` **and** passes `moderateName` (A29), else null; `name_blocked` = the moderation reason or null;
  - `avatar_uri` = the value if it matches `^lestersarcade:avatar/[a-z0-9-]{1,32}$`, else null;
  - `handle_hash` = the on-chain `handle`.
- **Events:**
  - `ProfileCreated(address indexed wallet, bytes32 indexed handle, string displayName)`, topic0 `0x4e7a7e66fe87642c23aa0ec0360ed3051eaf7f243bfa32bf99e390acf608fb4c`. No avatar; first creation emits no `ProfileUpdated`.
  - `ProfileUpdated(address indexed wallet, string displayName, string avatarUri)`, topic0 `0x6eb3a1c6a4675ba92d44e090515b1ceea358f26565d2854df0c99c3f5eaf9850`.
  - `HandleReserved`: ignored.

### 8.5 AchievementRegistry (one per game)

| Function | Access and behaviour |
| --- | --- |
| `defineAchievement(bytes32 id, bytes32 gameId, string title, string category, string tokenUriPath)` | Operator only, idempotent (phase 2 only, `scripts/define-nft-achievements.mjs`). |
| `setMinter(address, bool)` | Operator only (phase 2: the relayer). |
| `mintFor(address player, bytes32 achievementId, bytes32 sessionId)` | Minter only. Returns false for an undefined id, a duplicate or a zero player. |
| `tokenIdFor(address, bytes32)` | `uint256(keccak256(abi.encode(wallet, id32)))`. |
| `hasUnlocked(address, bytes32)` | View. |
| `tokenURI` | `baseTokenUri + tokenUriPath`. |

- `achievementId32 = ethers.id(id)`.
- Event `AchievementUnlocked(address indexed wallet, bytes32 indexed achievementId, bytes32 indexed sessionId, uint256 tokenId)`, topic0 `0xa63e9940f858e00a63db1b55555c7b25e93c8fd9a85e1e9e21fd0fff4a2dc22e`. It is emitted by the three collection addresses.

### 8.6 GameRegistry

- `confirmDevWallet(bytes32 gameId)` (selector `0x33cf3157`) must be sent from the developer wallet `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26`.
- Then the operator sends `setPlayable(bytes32 gameId, bool)`. `setPlayable(gameId, false)` is also the on-chain kill switch per game (A27).
- Operator tooling: `scripts/operator-actions.mjs` (contracts slice, §10.2) wraps `setPlayable`, `setEntryFeeEnabled`, `setSettlementGasReserve`, `setRelayer` and `setTrustedVerifier`, with a dry run by default.
- `getGame(bytes32)` returns a 12-field tuple (`litvm-chain-client.mjs:37`).

---

## 9. Flags, environment, fail-closed rules

### 9.1 Client flags (`apps/portal/src/settlement.mjs`, literal exports parsed by `scripts/hmh-release-facts.mjs`)

| Flag | Now | Flipped at | Gates |
| --- | --- | --- | --- |
| `SETTLEMENT_LIVE` | `false` | guide §7 step 7 | Seed tickets (`/api/ranked/seed`), entry payment, background preflight RPC reads, balance chip RPC read, `/api/settle*` calls, pending resume |
| `HOSTED_PROFILE_SYNC` | `false` | guide §7 step 7 | `/api/session*`, `/api/profile*`, `/api/leaderboard`, `/api/session/<id>`, index-backed Scores and Profile, unlockables fetch |

- **Invariant**, pinned by a test in the contracts slice: `SETTLEMENT_LIVE ⇒ HOSTED_PROFILE_SYNC && LITVM_DEPLOYMENT.status === 'deployed'`.
- **With both false** the portal makes **zero** requests to `/api/*` and zero RPC calls.
  - Local preview Ranked works exactly as today: the modal approves without payment, and a `preview` results screen is shown.
  - The console stays clean on a static server, including the Chikun Ranked smoke with its legacy stub provider (which throws on any method other than accounts, `chainId`, `getBalance`, `personal_sign` and switch/add chain).
- WalletConnect is offered only when `location.hostname ∈ REOWN_ALLOWED_HOSTS`.

### 9.2 Server environment

| Variable | Used by | When absent or invalid |
| --- | --- | --- |
| `SESSION_SECRET` (≥ 32 characters; a **different** value per Vercel environment) | E1, E2, E3, E6s, E7, E8 (Bearer), E15, IP bucketing, seed-ticket MACs | 503 `session-not-configured` (E1, E2, E7); E3 and E15 503 `settlement-not-configured`; E6s 401; E8 serves anonymous limits |
| `NEON_DATABASE_URL` | every DB endpoint | 503 `index-not-configured` (E1 and E2: `session-not-configured`) |
| `RANKED_VERIFIER_PRIVATE_KEY` (0x + 64 hex) | E3, E13 | 503 `settlement-not-configured` |
| `RANKED_RELAYER_PRIVATE_KEY` (0x + 64 hex) | E3, E13 | 503 `settlement-not-configured` |
| `RANKED_SCORE_REGISTRY_ADDRESS` | E3, E13, E15, E12 | 503; a mismatch with `LITVM_DEPLOYMENT` gives 503 `address-mismatch` |
| `VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `SCORE_REGISTRY_ADDRESS` (legacy) | nothing | **must be absent**; if any is present, `settlementReady` is false (A28) |
| `SETTLEMENT_PAUSED` (`'true'` to pause) | E3, E13, E15 | absent means not paused |
| `RANKED_MIN_PAID_WEI` (decimal wei) | E3 | default `102000000000000000` |
| `CRON_SECRET` (≥ 32 characters) | E12, E13 | 401 on every call |
| `RPC_URL` | all chain I/O | default `https://liteforge.rpc.caldera.xyz/http`. It is never echoed; errors store allowlisted codes only (A31). |
| `SESSION_ALLOWED_DOMAINS` | E2 | default per §4.3.2 |
| `LITVM_CHAIN_ID` | tests and rehearsal only | default 4441 |
| `INDEX_START_BLOCK` | E12 | default `LITVM_DEPLOYMENT.startBlock` |
| `VERCEL_ENV` | E2 domain rule, token audience | **treated as `production` when absent** (fail closed); local stacks set `development` |

`server/config.mjs` (index slice) exposes `readServerConfig(env = process.env, { deployment })`. Per A28 it holds no secret strings:

```
→ frozen { chainId, rpcUrl /* may carry credentials: redacted by toJSON and inspect, never logged */, environment, isProduction, paused, minPaidWei,
           session:{ configured, secret() /* → string */, allowedDomains },
           neon:{ configured, schemaKey, createClient() },
           verifier:{ configured, createSigner(ethers) /* → ethers.Wallet, no provider */ },
           relayer:{ configured, createWallet(ethers, provider) },
           scoreRegistry:{ configured, address, matchesDeployment }, cron:{ configured, matches(authorizationHeader) },
           deployment, settlementReady:boolean, missing:string[], legacyEnvPresent:string[],
           toJSON(), toString(), [Symbol.for('nodejs.util.inspect.custom')]() /* all redacted */ }
```

The redaction test passes fixture secrets and asserts none of them appears in `util.inspect(config, { depth: 10, showHidden: true })`, `String(config)` or `JSON.stringify(config)`.

`deployment` comes from `server/deployment.mjs` `loadDeployment()`. That function does `await import('../apps/portal/src/generated/litvm-addresses.mjs')`, and if the module does not exist yet (index runs in parallel with contracts) it falls back to `{ status:'unavailable', … all null }`.

Secrets are read only from the environment. No script prints, logs or writes them. Deploy and live-E2E scripts read keys from the vault file inside the process and never echo them (guide §2.1).

---

## 10. Slice plan, ownership and merge rules

### 10.1 Waves

| Wave | Slices (parallel within a wave unless noted) | Depends on |
| --- | --- | --- |
| 1 | `chikun-tune`, then `achievements` (sequential); in parallel `index` and `contracts` | — |
| 2 | `verify` and `settle` in parallel. Merge `verify` first; `settle` rebases onto it before its final gate and adds the handler wiring test (§10.4). | wave 1 merged |
| 3 | `ranked-client`, `signin-entry`, `results-share`, `profile-boards`, `site-copy` in parallel | wave 2 merged |
| 3b | `unlockables` | wave 3 merged |
| 4 | `rehearsal` (server end to end, phase 2, step-7 dry run) | wave 3b merged |
| 4b | `browser-e2e` (browser smokes, the live-flag browser run, import hygiene, README) | `rehearsal` merged |
| — | Deployment (guide §7 as amended by §13) runs after wave 4b, with owner approval at each ⚠ step | all, plus O1 |

**Owner checkpoints** (the orchestrator pauses for the owner; slices keep running):

| Id | When | What |
| --- | --- | --- |
| O1 | any time after `achievements` merges, **before §13 step 3** | The owner reviews `docs/game-design/achievement-catalogs-20260923.md` (guide §10 item 2): the 137 achievements, thresholds and availability. Changes go back to the achievements owner as a follow-up slice. |
| O2 | before §13 step 9 | The owner decides what happens to the live test wallet's launch rows: keep them, or set `board_excluded` with `scripts/moderate-profile.mjs` (recommended: a fresh test wallet, excluded). |
| O3 | phase 2 (not this release) | The owner approves the NFT subset (A20). |

### 10.2 Files per slice (C = create, E = edit; anything else is read-only for that slice)

| Slice | Owns |
| --- | --- |
| chikun-tune | C `scripts/chikun-difficulty-harness.mjs`, `scripts/lib/chikun-bots.mjs`, `apps/portal/src/chikun-ground-v5-runtime.mjs`, `apps/portal/src/chikun-ground-v5-course.mjs`, `tests/fixtures/chikun-v5-replays.json`, `tests/fixtures/chikun-v6-replays.json`, `tests/chikun-difficulty.test.mjs`, `tests/chikun-evidence-v6.test.mjs`, `docs/qa/chikun-difficulty-harness-20260923.json`. E `apps/portal/src/chikun-ground-course.mjs`, `chikun-ground-runtime.mjs`, `chikun-course-regions.mjs`, `chikun-cabinet.mjs` (adds `flapTicksOf(evidence)`, which reads v5 `flapSteps` or v6 `flapDeltas`), `chikun-bridge-protocol.mjs`, `chikun-profile.mjs`, `leaderboard-engine.mjs` (the v5 filter at `:144` only), `apps/chikun/src/{main,replay-file,replay-viewer,presentation}.mjs` (not the share lines `main.mjs:826-840`), `scripts/chikun-course-pilot.mjs`, `scripts/chikun-course-audit.mjs`. **Every `flapSteps` reader outside those files, switched to `flapTicksOf`:** `apps/portal/src/arcade-core.mjs:5649-5650` (the `recordScore` Chikun `flapCount` line only), `apps/portal/src/chikun-daily-challenge.mjs:80` (`buildChikunGhostTrack`), `apps/portal/src/chikun-portal-lifecycle.mjs:14` (the `flapCount` line only), `scripts/chikun-ground-browser.mjs`, `scripts/chikun-ground-performance.mjs`, `scripts/chikun-open-air-browser-smoke.mjs`. The Chikun tests listed in its brief, plus the v5 pins in `tests/arcade-core.test.mjs:494` (Chikun `buildHash`) and `tests/chikun-host.test.mjs:78` (`runtimeVersion`), and the `flapSteps` uses in `tests/arcade-sdk.test.mjs`, `tests/chikun-replay-file.test.mjs`, `tests/chikun-replay-viewer.test.mjs`, `tests/chikun-vfx-presentation.test.mjs`. `scripts/syntax-check.mjs` |
| achievements | C `apps/portal/src/achievements/*.mjs`, `scripts/generate-achievement-metadata.mjs`, `scripts/generate-game-achievement-badges.py`, `apps/portal/achievements/**`, `apps/portal/assets/generated/achievement-badges/{chikun,stacked}/**`, `tests/achievement-catalogs.test.mjs`, `tests/achievement-derivation.test.mjs`, `tests/achievement-metadata.test.mjs`, `tests/fixtures/achievements/**`, `docs/game-design/achievement-catalogs-20260923.md`. E `apps/portal/src/arcade-core.mjs` (only `maybeUnlockRunAchievements`, `resolveAchievementUnlocksForRun`, `ACHIEVEMENT_TIER_UNLOCK_PCT`), `apps/portal/src/achievement-progress.mjs`, `tests/achievement-progress.test.mjs`, the specific `tests/arcade-core.test.mjs` cases in its brief, `package.json` (one script), `scripts/syntax-check.mjs` (both lists) |
| index | C `server/http.mjs`, `server/config.mjs`, `server/deployment.mjs`, `server/neon/{migrations,queries,rate-limit,period-keys,rows}.mjs`, `server/chain/{public-rpc,abis}.mjs`, `server/profile/sanitize.mjs`, `server/indexer/index-chain.mjs`, `apps/portal/src/name-moderation.mjs`, `api/leaderboard.mjs`, `api/profile-refresh.mjs`, `api/verified-session.mjs`, `api/cron/index-chain.mjs`, the stubs `api/session-nonce.mjs`, `api/settle-status.mjs`, `api/cron/settle-retry.mjs`, `api/share-page.mjs`, `api/share-card.mjs`, `api/ranked-seed.mjs`, `scripts/neon-migrate.mjs`, `scripts/moderate-profile.mjs`, `tests/helpers/pglite-client.mjs`, tests. E `api/profile.mjs`, `apps/portal/src/server-session.mjs` (sanitizer only), `apps/portal/src/server-neon.mjs` (adds `schemaKey`), `apps/portal/sw.js` (`/api/` bypass only), `vercel.json` (all of §4.5 except the CSP), `tests/server-session-profile.test.mjs` (profile parts), `tests/vercel-routing.test.mjs`, `tests/portal-service-worker-cache.test.mjs`, `scripts/syntax-check.mjs` |
| contracts | C `hardhat.config.js`, `scripts/generate-litvm-addresses.mjs`, `apps/portal/src/generated/litvm-addresses.mjs`, `scripts/define-nft-achievements.mjs`, `scripts/lib/local-chain.mjs`, `scripts/lib/key-source.mjs`, `scripts/operator-actions.mjs`, `scripts/vercel-secrets.mjs`, `scripts/live-cron.mjs`, `apps/portal/owner/confirm-dev-wallet.html`, `apps/portal/owner/confirm-dev-wallet.mjs`, tests. E `scripts/deploy-contracts.mjs` (record fields and the generator call only; keep every pinned literal), `apps/portal/src/settlement.mjs` (addresses and the invariant comment; **not** the flag values), `apps/portal/src/litvm-chain-client.mjs` (address source, `pickReadProvider` public RPC for reads, legacy fallback removal), `scripts/hmh-web3-settlement-audit.mjs` (the `safe-ranked-live-gate` check), `scripts/hmh-web3-live-readiness.mjs`, `tests/litvm-ranked-contract-gate.test.mjs`, `tests/deploy-contracts-security.test.mjs` (additions only), `package.json` (scripts), `.gitignore`, `docs/web3/contract-overhaul-20260916.md`, `scripts/syntax-check.mjs` |
| verify | C `apps/portal/src/ranked-identity.mjs`, `apps/portal/src/session-seed.mjs`, `server/verify/{index,chikun,stacked,hmh,hmh-plausibility,seed-ticket}.mjs`, `tests/fixtures/ranked/**`, tests. E `apps/portal/src/arcade-core.mjs` (replace `deriveSessionSeed` with the import-and-export form of §2.3 only), `scripts/syntax-check.mjs` |
| settle | C `server/settle/{settle-core,store,relayer,attestation,retry,errors,seed}.mjs`, `server/auth/{siwe-nonce,bearer}.mjs`, `scripts/requeue-dead-letters.mjs`, tests. E `api/settle.mjs`, `api/session.mjs`, `api/attest.mjs`, and full replacement of the stubs `api/session-nonce.mjs`, `api/settle-status.mjs`, `api/cron/settle-retry.mjs`, `api/ranked-seed.mjs`; `apps/portal/src/server-session.mjs` (`verifySiweLogin` chain and nonce checks; token v2 with audience), `apps/portal/src/wallet-auth.mjs` (`SIWE_STATEMENT` and `isServerNonce` only), `tests/server-session-profile.test.mjs` (session and settle parts), `tests/verifier-attestation.test.mjs`, `tests/wallet-auth.test.mjs` (statement pin), `scripts/syntax-check.mjs` |
| ranked-client | C `apps/portal/src/ranked-settlement.mjs`, `apps/portal/src/ranked-requests.mjs`, tests. E the `main.js` ranges in §10.3, `apps/portal/src/chikun-portal-lifecycle.mjs`, `stacked-host.mjs` (result-status copy, digest pass-through), `stacked-portal-lifecycle.mjs`, `stacked-persistence.mjs`, `arcade-core.mjs` (`applySettlement` stamps `onChainSessionId32`; `recordScore` `settlementInput.runtimeId`; the STACKED mode copy at `:589-611`), `apps/chikun/src/main.mjs` (Ranked overlay copy `:467-537` only), `apps/stacked/src/main.mjs` (`:76`, `:108`, `:204`, `:260` copy only), `apps/portal/stacked/index.html:55`, `scripts/hmh-web3-settlement-audit.mjs` and its test (drop the player-signed literals), the pinned tests listed in its brief, `scripts/syntax-check.mjs` |
| signin-entry | C `apps/portal/src/wallet-config.mjs`, `wallet-session.mjs`, `wallet-picker.mjs`, `walletconnect-provider.mjs`, `ranked-preflight.mjs`, `apps/portal/src/styles/wallet-picker.css`, tests. E the `main.js` ranges in §10.3, `apps/portal/index.html` (`:63-81`, `:104-105`), `apps/portal/src/wallet-auth.mjs` (picker helpers and error kinds; not `SIWE_STATEMENT`), `apps/portal/src/litvm-chain-client.mjs` (`sendRankedEntry`, `checkRankedReadiness` funds and public reads), `apps/portal/src/arcade-core.mjs:108` only (`RANKED_SETTLEMENT_GAS_RESERVE_WEI` becomes `'100000000000000'`), `vercel.json` (CSP values only), `tests/ranked-entry-preflight.test.mjs`, `tests/wallet-auth.test.mjs` (picker parts), `tests/vercel-security-headers.test.mjs`, the reserve pins in `tests/settlement.test.mjs:118-121` and `tests/arcade-core.test.mjs:528-529,552`, `scripts/syntax-check.mjs` |
| results-share | C `apps/portal/src/ranked-results.mjs`, `ranked-results-model.mjs`, `apps/portal/src/styles/ranked-results.css`, `server/share/{render-page,render-card}.mjs`, `apps/portal/assets/share-cards/*.png`, `scripts/build-share-card-backgrounds.py`, tests. E `api/share-page.mjs` and `api/share-card.mjs` (replace the stubs), `apps/portal/src/share-links.mjs`, the `main.js` ranges in §10.3, `apps/chikun/src/main.mjs` (share call `:826-840` only, including hiding the child share row for Ranked), `apps/chikun/src/presentation.mjs` (`buildChikunShareText` only), `apps/stacked/src/main.mjs` (`:94-100` only, including hiding the child share row for Ranked), `tests/share-links.test.mjs`, `scripts/syntax-check.mjs` (both lists) |
| profile-boards | C `apps/portal/src/index-api-client.mjs`, `profile-chain.mjs`, `arcade-avatars.mjs`, `name-claim-prompt.mjs`, tests. E the `main.js` ranges in §10.3, `apps/portal/src/profile-sync-client.mjs`, `routes/official-leaderboard-route.mjs`, `routes/official-profile-route.mjs`, `routes/portal-route-controller.mjs`, `arcade-router.mjs`, `leaderboard-view.mjs`, `leaderboard-seed.mjs`, `hmh-character-config.mjs` (owner of `buildCharacterUnlockMap` with `verifiedRuns`), `username-registry.mjs` (`validateUsername` only; keep `containsBlockedTerm`'s signature, which `name-moderation.mjs` imports), their pinned tests, `scripts/syntax-check.mjs`. Reads `name-moderation.mjs` (index) |
| site-copy | C tests. E `apps/portal/src/portal-content.mjs` (flag-aware `PORTAL_DESCRIPTION` and `PORTAL_FAQ`), `scripts/build-portal-pages.mjs` (renders the flag-dependent blocks), its generated outputs (`apps/portal/index.html` head meta, JSON-LD, the scores section at `:139-141` and the FAQ list; **not** `:63-81` or `:104-105`), `apps/portal/discover/**`, `apps/portal/llms.txt`, `apps/portal/sitemap.xml` (only if the builder changes it), `apps/portal/trust.html`, `tests/portal-trust-surface.test.mjs`, `tests/portal-discovery.test.mjs` and any other test pinning that copy, `scripts/syntax-check.mjs` |
| unlockables | C `apps/portal/src/unlockables.mjs`, `unlockables-store.mjs`, `apps/portal/src/routes/unlockables-panel.mjs`, tests. E `hmh-character-config.mjs` (supplying cached `verifiedRuns` only), `arcade-core.mjs` (`LESTER_BLASTER_UNLOCKABLES` text), `chikun-bridge-protocol.mjs` and `stacked-bridge-protocol.mjs` (the settings validators only), the HMH init-settings validator and hero or weapon sprite setup in `apps/hmh-reboot/src/**` (the tint hook only, ≤ 350 B), `apps/chikun/src/{main,character}.mjs` (the coat, trail and hat draw hooks), `apps/stacked/src/render/**` (palette hooks), `main.js` (anchored by function name after wave 3), `scripts/syntax-check.mjs` |
| rehearsal | C `scripts/lib/rehearsal-driver.mjs`, `scripts/lib/local-stack.mjs`, `scripts/lib/local-http.mjs`, `scripts/rehearse-ranked-e2e.mjs`, `scripts/rehearse-nft-phase2.mjs`, `scripts/backfill-nft-mints.mjs`, `scripts/rehearse-step7-dry-run.mjs`, `tests/local-chain-rehearsal.test.mjs`, `tests/nft-phase2-rehearsal.test.mjs`, `docs/qa/pre-deployment-rehearsal-20260923.json`, `docs/qa/step7-dry-run-20260923.json`. E `docs/web3/contract-overhaul-20260916.md` (rehearsal commands, the live-E2E template, the step-7 checklist), `scripts/syntax-check.mjs` |
| browser-e2e | C `scripts/lib/fixture-wallet.mjs`, `scripts/ranked-live-browser-e2e.mjs`, `tests/fixture-wallet.test.mjs`, `docs/qa/ranked-live-browser-e2e-20260923.json`, the release receipt draft under `docs/qa/`. Small hooks in rehearsal's `scripts/lib/local-http.mjs` only if needed (named in the commit). E the browser smokes (`scripts/chikun-ranked-browser-smoke.mjs` including a `--live` variant, `scripts/hmh-simulated-wallet-browser-smoke.mjs`, `scripts/smoke-portal-flow.mjs`, `scripts/smoke-portal-interactions.mjs`, `scripts/stacked-playable-browser-smoke.mjs`, `scripts/stacked-reactive-evidence-smoke.mjs`, `scripts/stacked-cabinet-browser-smoke.mjs`, `scripts/hmh-reboot-portal-e2e.mjs`), `main.js` lines 1-316 (import hygiene only), README ("How Ranked works now"), `scripts/syntax-check.mjs` |

### 10.3 `main.js` ranges for wave 3 (numbers at `06ebe4ca`; anchors in parentheses)

No slice edits `main.js` in waves 1, 2 or 3b except as listed. Wave-3 slices touch only these ranges, and add static imports only by inserting new lines immediately after their own anchor import line:

| Slice | Ranges | Import anchor (insert after) |
| --- | --- | --- |
| ranked-client | `:16`; `:286-287`; `:1895-1955` (`lastHmhRunSummary` … `lastSettlementSucceeded`, incl. `mountStackedSession`); `:2826-3171` (`recordCurrentSessionEvent` … end of `settleRankedRun`); `:3424-3432` and `:3842-3845` (only the `officialScoreSubmitted` / `officialSubmissionEnabled` arguments); `:4111-4147` (`restartCombatRun`); `:4823-4892` (`ensureGameIdHashes`, `mergeChainRecordIntoState`); `:5068-5196` (HMH reboot mount; keep `finalizeRanked: ({ runSummary }) => submitCombatGameOver(runSummary)`); `:5198-5300` (Chikun destroy, restart, mount); `:6290-6320` (`beginTrackedSession`, `startMode`); `:6321-6400` (`completePrototypeRun`, legacy) | `:287` (session-integrity import) |
| signin-entry | `:24-26`; `:1833-1843` (wallet globals); `:1879-1889` (EIP-6963 registry); `:5385-5397` (`renderOfficialModeSelect`: add the preflight **after** the two pinned calls); `:5423-5666` (`connectOfficialWallet` … `requestRankedEntry`, incl. the entry identity at `:5578`, replaced by `rankedIdentityFor`); `:5931-6289` (`detectEthereumProvider` … `ensureWalletConnected`); `:14788-14799` (`render`, connect button wiring); `:15024-15056` (`bindWalletProviderEvents` + boot binding; silent re-auth goes right after `:15056`) | `:26` |
| results-share | `:14`; `:2621-2824` (`currentPlayerBestScoreForMode` … `renderGameOverSummary`, incl. the share row); one new block immediately before `// Initial paint honors the URL (deep-link / refresh) instead of always splash.` (`:15330`) | `:14` |
| profile-boards | `:292`, `:294`; `:1791-1830` (state init; drop `applySeedLeaderboard` at `:1804-1807`); `:1844-1878` (hosted profile sync block); `:4771-4786` (route controller hydrate wiring); `:4894-5013` (hydrate functions, profile and leaderboard route state and deps; also the name-prompt listener) | `:294` |

- Lines `:1-316` other than those listed are read-only in wave 3. Unused names in existing import statements stay until the browser-e2e slice's import-hygiene pass.
- The E15 seed-ticket call and `applySeedTicket` go inside signin-entry's `requestRankedEntry` range. The STACKED Ranked `onRestart` (`:1927`) and the result-context profile fetch (in `startMode`, `:6301-6320`) are in ranked-client's ranges. The D10 retry listeners are registered in profile-boards' `:4894-5013` range.
- Logic goes into new modules. A `main.js` hunk should be glue: build a context, call a module, render.
- Tests that pin `main.js` text are listed in each brief. A slice that must change a pinned string updates the test in the same commit.

### 10.4 Merge rules

1. Each slice works in its own worktree `C:/Users/just_/lesters-arcade-wt/<slice-key>` on branch `fable/pd-<slice-key>`, created by the slice runner from the wave's base commit, with `node_modules` junctioned. Never run `npm install`, and never touch `C:/Users/just_/lesters-arcade-fable0916` or another slice's worktree. Commit per logical step with tests. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
2. Slices run `npm run test:release` to prove exactly 51 tolerated failures, but **do not commit** `docs/testing/hmh-reboot-test-retirement-gate.json`: `git checkout` it before committing. The orchestrator merges slices in the order given in §10.1, regenerates that JSON once per integration with `npm run test:release`, and commits it. Never hand-edit it.
3. `scripts/syntax-check.mjs`: each slice inserts its new entries (single-quoted, one per line) **immediately after its anchor line**, so parallel inserts never touch the same hunk:

   | Slice | Anchor line |
   | --- | --- |
   | chikun-tune | `'scripts/chikun-course-pilot.mjs',` |
   | achievements | `"tests/achievement-progress.test.mjs",` |
   | index | `'api/profile.mjs',` |
   | contracts | `"scripts/deploy-contracts.mjs",` |
   | verify | `'apps/portal/src/verifier-attestation.mjs',` |
   | settle | `'api/settle.mjs',` |
   | ranked-client | `"apps/portal/src/session-integrity.mjs",` |
   | signin-entry | `"apps/portal/src/wallet-auth.mjs",` |
   | results-share | `'apps/portal/src/share-links.mjs',` |
   | profile-boards | `"apps/portal/src/arcade-router.mjs",` |
   | unlockables | `"apps/portal/src/hmh-character-config.mjs",` |
   | site-copy | `'scripts/build-portal-pages.mjs',` |
   | rehearsal | `"scripts/compile-contracts.mjs",` |
   | browser-e2e | `"scripts/smoke-portal-flow.mjs",` |

   `PY_COMPILE_FILES` (`scripts/syntax-check.mjs:754`) is a separate list with its own anchors: achievements inserts after `'scripts/build-chikun-ground-motion.py',` and results-share after `'scripts/build-chikun-ground-props.py',`.

4. `vercel.json`: only the index slice (wave 1) and the signin-entry slice (CSP values, wave 3) edit it.
5. **Stub hand-off:** a slice replacing an index stub replaces the whole file. It must keep the file path, the default export, the pure `…Request` export, `buildDeps` and `createHandler` (A30).
6. **Wave 2:** after `verify` merges, `settle` rebases, replaces its verify and seed-ticket test doubles with the real `server/verify/**` and `session-seed.mjs`, adds `tests/api-settle-handler.test.mjs` (the real handler through `createHandler`, PGlite, an in-process Hardhat chain, and the real verifier), then gates.
7. **Shared-file edits in one wave** (for example `apps/chikun/src/main.mjs` by ranked-client and results-share, or `apps/portal/index.html` by signin-entry and site-copy) are disjoint by line range. A slice that needs a line outside its range asks the orchestrator. It never edits it silently.
8. **Generated portal pages.** `scripts/build-portal-pages.mjs` derives `apps/portal/discover/**`, `llms.txt`, `sitemap.xml` and the FAQ and meta of `index.html` from `index.html` plus `portal-content.mjs`. Any slice that edits `index.html` runs the builder and commits its outputs. When two slices' generated files conflict at merge time, the orchestrator resolves them by re-running `node scripts/build-portal-pages.mjs` on the merged tree and committing the result, exactly as it regenerates the gate JSON. Never hand-merge generated pages.

---

## 11. Repo rules for every slice

1. **Tests.** Every new module ships with `node:test` tests in `tests/*.test.mjs`. There are no skipped, todo or conditional tests (the retirement gate fails on any). Hardhat and PGlite tests must not need network access and must finish in under 60 s per file.
2. **Gate.** `npm run test:release` must report exactly **51** failures, all of them the ledgered ones in `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json`. Never rename or touch a ledgered test. Slices restore the regenerated `docs/testing/hmh-reboot-test-retirement-gate.json` instead of committing it (§10.4.2).
3. **Verification before handoff:** `npm test`, `npm run check`, `npm run contracts:check`, `npm run build` (which runs the HMH and STACKED bundle budgets), and `npm run test:release`.
4. **Syntax check.** Register every new `.mjs` or `.js` file (`api/`, `server/`, `apps/`, `scripts/`, `tests/`) in `scripts/syntax-check.mjs` at your anchor. At `06ebe4ca` the file has **LF** endings, and `.gitattributes` sets `eol=lf`. Guide §1.3 says CRLF; that is wrong. Editing it with Python in text mode, or with the Edit tool, preserves the endings either way. Check with `git diff --stat` that only your lines changed.
5. **Lazy UI.** New portal UI loads through dynamic `import()` from its `main.js` region. Never import a new module from `apps/hmh-reboot/**` or `sdk/**`. The HMH child initial JS cap (1,048,576 bytes, 2,147 B of headroom measured at `06ebe4ca`) and the STACKED caps (`STACKED_ENTRY_JS_CAP` 29,000, `STACKED_INITIAL_JS_CAP` 607,000) must still pass `npm run build`. **The STACKED entry is 27,756 B at `06ebe4ca`** (the 26,277 B comment in `stacked-contracts.mjs:84` is stale), so only 1,244 B remain. Byte budgets for the entry: ranked-client ≤ 400 B, results-share ≤ 300 B, unlockables ≤ 400 B (palette data lazy). HMH child budget: unlockables ≤ 350 B; no other slice may grow it. Each slice records its measured delta in its final commit message. `share-links.mjs` is shared with the Chikun and STACKED children, so keep it small.
6. **DOM building.** Build DOM with `el()` / `appendText()` or `createElement`. No `.innerHTML =`, `eval` or `new Function`. No quoted literal matching `(api_key|secret|password|private_key|bearer)\s*[:=]\s*'…8+'` (`scripts/hmh-security-audit-sweep.mjs`).
7. **Browser checks.** Serve `apps/portal` itself as the web root (`python -m http.server 8797 --directory apps/portal`), never the repo root. Check the console is clean. Deep links (`/profile/<wallet>`, `/s/<id>`) cannot be served by the static server: cover them with unit tests or `npx vercel dev`.
8. **Keys.** Never read, print or log private keys. The vault file `C:/Users/just_/lesters-arcade-vault/**` is off limits to every slice. Tests use public fixture keys only (Hardhat's default accounts, or the `0x11…11` fixture already used by the Chikun smoke).
9. **No chain writes or Vercel changes.** No slice deploys contracts, sends a transaction on LiteForge, writes Vercel env or secrets, flips `SETTLEMENT_LIVE` or `HOSTED_PROFILE_SYNC` in a committed file, or promotes a deployment. Those are guide §7 steps (as amended by §13) that need the owner's approval in the moment. Throwaway flag flips in a temporary worktree or a temporary copy of `apps/portal` that is never committed are allowed (the rehearsal's step-7 dry run and the browser-e2e live-flag run).
10. **Pinned literals.** Keep the literal strings other tests pin unless your brief says to change them, and then update the test in the same commit.
11. **Pure modules.** Modules shared by browser and server take `fetch`, `ethers`, storage and clocks by injection, and never touch `process.env` or `window` at import time.
12. **Server fixtures.** Server tests and local stacks set `VERCEL_ENV=development` explicitly (an absent value is production, §9.2), use a fixture `SESSION_SECRET` of at least 32 characters, the `RANKED_*` env names, and never the legacy names except in the test that proves they fail closed.
13. **Secret-bearing scripts** (operator actions, Vercel secrets, live cron, live E2E, backfill, requeue, moderation) read keys and secrets only inside the process from `--key-env <NAME>`, `--key-file <path> --key-field <field>` or the environment, through `scripts/lib/key-source.mjs`. They are dry runs by default, need `--broadcast` or `--apply` plus a confirm phrase to act, never print a secret, and are tested with fixture files under the OS temp directory. No slice runs any of them against LiteForge, Vercel or production Neon.

---

## 12. Known risks

- **Bots and solvers (residual, accepted for testnet).** Replay proves that a Chikun or STACKED run is valid under the rules for a seed issued to this wallet after the ticket; it does not prove a human played. A bot or an offline solver that plays the real seed can still post superhuman runs. Seed tickets (A25) stop replay theft and seed grinding, and the wall-clock bound (A26) makes every run cost real time, but neither stops a solver. The owner's levers are `board_excluded` and `hidden` (A29).
- **HMH is client-authoritative within bounds.** The reboot-calibrated validator rejects impossibilities and flags the rest for review, but a fabricated summary under the ceilings still ranks. HMH NFT candidates are limited to server-counted run totals (§6.1), and the trust page says HMH is plausibility-checked (A33). Server replay of HMH stays post-launch work (guide §8).
- **Concurrent achievement derivation.** Two settles for the same wallet at the same moment can each derive against history without the other. `achievement_unlocks` stops duplicates, but a cumulative threshold crossed by the pair can be missed until the next run. This is accepted for the testnet launch.
- **Build drift between entry and settle.** A STACKED or Chikun run whose simulation code changes between entry and settle can fail replay (`replay-rejected`). Mitigations: frozen per-version runtimes (Chikun v5 and v6), and no sim changes without an evidence version bump.
- **Replay-store size.** STACKED runs over about 180 KB raw (about 50 minutes) cannot be persisted by `stacked-replay-store` for a retry after reload, and bodies above 240,000 base64 characters are not persisted by the settlement client. The server stores the evidence on the first successful POST.
- **Unproven Neon value typing.** Neon HTTP typing has never been exercised live; A15 removes the dependency. The first production call is the E12 migration call in §13 step 8b.
- **Reown CSP host list.** The list must be taken from the Reown docs at implementation time. A missing host shows up as a blocked WalletConnect modal in the live check. `frame-src` must keep `'self'` (§4.5).
- **Hardhat on Vercel builds.** `hardhat` is a devDependency that the Vercel install also pulls in. The in-process network must not try to download a compiler; the contracts slice proves this with an offline test.
- **Build time.** Hardhat and PGlite tests run inside `vercel:build` (through `test:release`). They must stay offline and fast, or the production build slows down or fails. The STACKED fixtures use the top-out wrapper of the verify brief, so no test replays a 2-hour run.
- **Chikun retune.** The bots only approximate humans, and the D11 bands may need course redesign rather than parameter tuning.
- **Unearnable HMH achievements.** Level 2, speed-clear and all-bosses entries ship `available:false`.
- **Byte budgets.** The STACKED entry has 1,244 B and the HMH child 2,147 B of headroom; the per-slice budgets of §11 rule 5 leave little slack.
- **Period edge.** Period keys come from `openedAt`, so a run opened before a weekly reset and published after it lands on the previous week's board, and the results screen shows no weekly standing for it.

---

## 13. Deployment runbook amendments (supersede guide §7 where they differ)

The guide's §7 steps keep their numbers. These amendments come from the reviews; ⚠ still means the owner approves in the moment, with the session in "ask before each action" mode.

- **Step 0 (new), before step 2.** Owner checkpoint O1 is done. `npx vercel teams ls` still shows the Pro plan (the every-minute cron needs it). The rehearsal's step-7 checklist (`docs/qa/step7-dry-run-20260923.json`) exists and is current.
- **Step 2.** Also run `node scripts/operator-actions.mjs status` (read-only: operator nonce, balances, current contract state).
- **Step 3 ⚠.** As written. The same commit adds `contracts/deployment-record.hardened.json` and the regenerated address module (`status:'deployed'`).
- **Step 4 ⚠ (hosting fixed).** Production still serves 1.7.0 at this point, which has no owner page. From the step-3 commit, serve the portal locally: `python -m http.server 8791 --directory apps/portal`, and the owner opens `http://127.0.0.1:8791/owner/confirm-dev-wallet.html` in MetaMask or Rabby on the owner wallet. The page checks on-chain facts (code at the registry address and `getGame(id).exists`), not only the module status.
- **Step 5 ⚠.** `node scripts/operator-actions.mjs activate --key-file <vault path> --key-field operator --broadcast --confirm ACTIVATE_GAMES_4441`. It reads the key inside the process and never prints it.
- **Step 6 ⚠ (secrets renamed; A28, A13).** `node scripts/vercel-secrets.mjs` (dry run lists names only), then with `--apply`:
  - writes `RANKED_VERIFIER_PRIVATE_KEY`, `RANKED_RELAYER_PRIVATE_KEY` and `RANKED_SCORE_REGISTRY_ADDRESS` to **production** by piping values from the vault into `vercel env add … production` over stdin;
  - generates `CRON_SECRET` (32 random bytes, hex), writes it to a new vault file `C:/Users/just_/lesters-arcade-vault/keys/cron-secret.txt`, and pipes it to Vercel;
  - **rotates `SESSION_SECRET`** in production to a fresh random value, so every token from the 1.7.0 login flow dies (token v2 already rejects them);
  - verifies with `vercel env ls production` that none of the legacy names `VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY` or `SCORE_REGISTRY_ADDRESS` exists, and that the Preview environment has its own `SESSION_SECRET` or none;
  - optional: `RPC_URL`, `SESSION_ALLOWED_DOMAINS`, `RANKED_MIN_PAID_WEI`. Never `SETTLEMENT_PAUSED` at launch.
- **Step 7.** Follow the step-7 checklist from the rehearsal dry run: set both flags true, run `node scripts/build-portal-pages.mjs` (A33 regenerates the public copy), update exactly the tests the checklist names, and commit.
- **Step 8 ⚠.** As written (1.8.0, cache marker v53, `npm run vercel:build`, deploy, promote).
- **Step 8b (new).** `node scripts/live-cron.mjs --site https://lestersarcade.io --path /api/cron/index-chain --secret-file <vault cron-secret.txt>` runs the production migration and the first live Neon call; it prints only `schemaVersion` and the counts. Then the same for `/api/cron/settle-retry` (expect `processed: []`).
- **Step 9 ⚠.** Owner checkpoint O2 first. Then `node scripts/rehearse-ranked-e2e.mjs --target live --site https://lestersarcade.io --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path> --cron-secret-file <vault cron-secret.txt> --confirm-live SPEND_TESTNET_ZKLTC --yes`. Optionally run `node scripts/ranked-live-browser-e2e.mjs --live …` for one real browser run.
- **Step 10.** As written, including the live smokes (the browser-e2e slice's `--live` Chikun smoke variant is optional and spends testnet zkLTC).
- **Optional (owner, Vercel change).** A Vercel Firewall rate-limit rule on `/api/*` (for example 600 requests per minute per IP).

**Emergency stops and rollback** (replaces the guide's rollback line; A27):

1. **Pause Ranked:** add `SETTLEMENT_PAUSED=true` to production env and redeploy **the current 1.8.0 release**. New entries stop at the modal before payment; queued rows wait.
2. **Stop on chain:** `node scripts/operator-actions.mjs pause-games --broadcast …` (`setPlayable(gameId, false)` for each game).
3. **Leaked verifier key:** `operator-actions.mjs rotate-verifier` (`setTrustedVerifier`), then update `RANKED_VERIFIER_PRIVATE_KEY`. **Leaked relayer key:** `operator-actions.mjs relayer-off` (`setRelayer(relayer, false)`).
4. **Site rollback:** Vercel **Instant Rollback** to `dpl_2Q1MYFG9YQWypPjs84VLKdTkwdsu` (1.7.0). Never "Redeploy" or rebuild a pre-1.8.0 commit with production env. Even then, the renamed secrets mean old code finds no keys and fails closed.
5. **Never** use `setEntryFeeEnabled(false)` as a stop: with the minimum-paid check it makes Ranked unusable, and without it Ranked would become free while the relayer pays gas.
6. **Dead letters** after an incident: `node scripts/requeue-dead-letters.mjs` (dry run), then `--apply`.

---

## 14. Review disposition

Three adversarial reviews (security, feasibility, completeness) ran against revision 1. Every finding was checked against the code at `06ebe4ca`. "Fixed" names where revision 2 addresses it; "modified" means the fix differs from the reviewer's proposal, with the reason; "declined" means the reviewer's proposal was not adopted, with the reason.

**Security**

| # | Finding | Disposition |
| --- | --- | --- |
| S1 | Seed not bound to wallet, server randomness or time (blocker) | Fixed: seed tickets (A25, §2.7, E15, §5.2) and chain-time bounds (A26). Modified: (a) the ticket travels beside the 9-key identity, bound through the seed, because `createCanonicalSessionIdentity` whitelists 9 keys and changing the key preimage would touch every key site; (b) "too early" is a retryable wait rather than a 422, because an honest player whose entry lands late would otherwise lose a paid run; the upper bound is 7 days instead of 24 h, because period keys now come from `openedAt`, which removes the incentive to hold runs. Declined: (c) the seed-independent input dedupe, because copied inputs cannot replay under a ticket seed the copier did not receive, so it adds storage and a query for no protection. (d) documented in §12. |
| S2 | New secrets reuse the env names the unauthenticated 1.7.0 signer reads (blocker) | Fixed: `RANKED_*` names, legacy names fail closed (A28); token v2 with audience (A13); `SESSION_SECRET` rotation and legacy-name check at step 6, Instant Rollback only (§13). Modified: the 410 stub is not back-ported to `main`; the rename alone makes every old build fail closed, and production only changes at step 8. |
| S3 | `setEntryFeeEnabled(false)` makes Ranked free; `SETTLEMENT_LIVE=false` is browser-only | Fixed: minimum paid amount, `SETTLEMENT_PAUSED`, rewritten stops (A27, §13). |
| S4 | Replay runs before the paid check | Fixed: E3 reordered, Bearer before body, spy test (§4.3.3, A30). |
| S5 | Rate limits bypassable by IPv6 and harsh on shared IPs; retries consume the IP budget; E8 victim bucket | Fixed: /64 folding, retry bodies off the IP bucket, higher IP ceilings, E8 per-wallet bucket only with that wallet's Bearer (§4.1, §4.3). |
| S6 | Moderation only in the browser; `hidden` ignored by E9, page and card; immutable cards | Fixed: A29 (server moderation in wave 1, `hidden` everywhere, `q` excludes hidden), card revisions and a 1-hour cap instead of `immutable` (§7.5), `scripts/moderate-profile.mjs`. Modified: a failed moderation nulls the name (`name_blocked`) instead of setting `hidden`, so the owner's manual flag is never overwritten by a refresh. |
| S7 | HMH decided by the browser; client-attested NFT candidates; hero gates not enforced | Fixed: reboot-calibrated validator plus the timing bound (§5.3, A26); HMH NFT candidates cut to the 3 run-count ones (§6.1); `hero-locked` check (§4.3.3 step 11); A7 rationale corrected. Modified: no new per-row stats flag; `verification` is derived from the game and source and exposed by E9. |
| S8 | `toJSON` does not stop `util.inspect` from printing keys | Fixed: A28 (closures, inspect redaction, three-way test). |
| S9 | Infrastructure errors dead-letter paid runs; nonce gaps; no fee cap | Fixed: error classes, infra waits without attempts, nonce reset and `nonce too high`, balance and fee caps, requeue script, 7-day `stale` (§3.3, §3.4). |
| S10 | E4 leaks unpublished runs and raw errors | Fixed: public and owner views, allowlisted `lastError` (§4.3.4, §4.4). |
| S11 | Retry path ignores `next_attempt_at` | Fixed (§4.3.3 step 5). |
| S12 | Indexer address filters, unknown games, field matching | Fixed (§4.3.10). |
| S13 | Public reads unlimited and cache-bustable | Fixed: unknown-parameter rejection, card `v` redirect, per-IP render and status buckets, brief 404 caching, optional WAF rule (§4.1, §4.3.9, §13). Modified: no per-IP Neon bucket on E5, E6 or E9; they are CDN-cached and parameter-checked, and a Neon write per public read would double database load. |
| S14 | "Verified on LitVM" on unpublished runs; client claim in public stats | Fixed (§7.3, §7.4, §7.5, A9). |
| S15 | Fail-open `VERCEL_ENV`, cron compare, token audience | Fixed (§4.3.2, A24, A13). |
| S16 | Re-signing trusts the stored JSON | Fixed, modified: re-sign re-verifies from the stored evidence (§3.3), which also covers edited columns, rather than signing from columns. |
| S17 | WalletConnect restore instantiates AppKit at boot | Fixed (§7.6). |

**Feasibility**

| # | Finding | Disposition |
| --- | --- | --- |
| F1 | Legacy HMH plausibility rejects normal reboot runs (blocker) | Fixed: `validateRebootRunPlausibility` from reboot constants, soft flags rank, realistic fixture tests (§5.3). Verified: `MAX_XP_PER_KILL` is 115 (`hmh-run-integrity.mjs:43`) while reboot kills grant `80 + 20 × threat` (`run-progression.mjs:421-431`). |
| F2 | Chikun v6 breaks `flapSteps` readers outside chikun-tune | Fixed: `flapTicksOf` and every reader assigned to chikun-tune (§10.2). |
| F3 | No sanctioned seam for tests to reach the real handler | Fixed: `createHandler(depsFactory)` (A30). |
| F4 | The soak pilot cannot produce short Ranked-valid STACKED fixtures | Fixed: top-out wrapper, pilot built with `mode:'free'` (verify brief). |
| F5 | A lagging RPC turns a paid run into a terminal 402 | Fixed: `entryTxHash`, bounded wait, retryable `entry-pending` (A17, §4.3.3 step 9, §7.2). |
| F6 | Owner page unusable at runbook step 4 | Fixed: local serving from the step-3 commit and on-chain gating (§13 step 4, contracts brief). |
| F7 | A new `frame-src` without `'self'` breaks all three games | Fixed (§4.5). |
| F8 | Bare re-export breaks `startPlaySession` | Fixed (§2.3). |
| F9 | Migration race, per-request memo, no production migration step | Fixed (A34, §3.1, §13 step 8b). |
| F10 | STACKED entry baseline stale | Fixed: 27,756 B and per-slice budgets (§11 rule 5). |
| F11 | Bearer self profile could get a CDN-cached public body | Fixed: distinct `&self=1` URL (E6s). |
| F12 | Retry POSTs count against the IP bucket | Fixed (same as S5). |
| F13 | No anchors for new Python scripts | Fixed (§10.4 rule 3). |
| — | Vercel plan not confirmable by the reviewer (403) | Kept: checked by `npx vercel teams ls` in revision 1; re-checked at §13 step 0. |

**Completeness**

| # | Finding | Disposition |
| --- | --- | --- |
| C1 | Public site copy unowned and false after the flip (blocker) | Fixed: new `site-copy` slice, copy generated from the flags (A33, §10.2), step 7 regenerates it (§13). |
| C2 | Step-7 flip never rehearsed | Fixed: rehearsal's step-7 dry run in a throwaway worktree (rehearsal brief, §13 step 0). |
| C3 | Live-flag browser Ranked flow never exercised | Fixed: new `browser-e2e` slice (wave 4b) with a fixture EIP-1193 wallet and a throwaway live-flag build against the local stack, plus a `--live` Chikun smoke. |
| C4 | No operator or secret tooling | Fixed: `operator-actions.mjs`, `vercel-secrets.mjs`, `live-cron.mjs`, `key-source.mjs` in contracts (§10.2, §11 rule 13). |
| C5 | Owner page hosting undefined | Fixed (same as F6). |
| C6 | D10 profile retry unowned | Fixed: profile-boards (§7.8), events (§7.7). |
| C7 | Unlockables deferred sets without owner approval | Fixed: every D8 set ships without new art files, within byte budgets; if HMH cannot fit, the slice stops and the orchestrator asks the owner (§7.9). |
| C8 | `hidden` not honoured everywhere | Fixed (same as S6). |
| C9 | Phase-2 backfill trusts the phase-1 flag | Fixed (A20). |
| C10 | Schema existence not guaranteed | Fixed (same as F9); handler tests start from an unmigrated PGlite. |
| C11 | Conflicting NFT wording | Fixed: A32. |
| C12 | Mapper keys leave the legacy resolver mismatched | Fixed: exact keys and a parity test (§6.4). |
| C13 | STACKED restart not covered | Fixed (A16). |
| C14 | Child share rows in Ranked | Fixed: hidden for Ranked (§7.4). |
| C15 | Source of `displayName` and `previousBest` | Fixed (§7.2 result context). |
| C16 | Unconditional "Verified on LitVM" | Fixed (same as S14). |
| C17 | Live CLI gaps and test-wallet rows | Fixed: `--cron-secret-file`/`--cron-secret-env`, an ephemeral wallet for the 403 check, `board_excluded` and owner checkpoint O2. |
| C18 | Flap cap vs 60 minutes unproven | Fixed: flap-rate percentiles and a cap test (chikun-tune brief). |
| C19 | Smoke list incomplete | Fixed (browser-e2e row, §10.2). |
| C20 | Unnamed acceptance tests | Fixed: named tests in the signin-entry and profile-boards briefs. |
| C21 | Two owners for the HMH hero gates | Fixed (§7.9). |
| C22 | No owner review stop for the catalogs | Fixed: checkpoint O1 (§10.1). |

