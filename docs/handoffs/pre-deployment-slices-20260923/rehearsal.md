# Slice brief: rehearsal (wave 4, after unlockables has merged; browser-e2e follows it in wave 4b)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/rehearsal`, branch `fable/pd-rehearsal`, based on the integration branch after waves 1-3b have merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`), all of it, but especially §1 (A20, A25-A31, A34), §2, §3.3, §4 (including the §4.1 rules and the A30 handler seam), §5, §7.2, §8, §9, §10.1 (checkpoint O2), §11 (rules 9, 12, 13), §13 (the live runbook this work serves), §14;
- guide §5.14 item 6, §5.15 and §7; decision D14.

**Safety:** this slice never touches LiteForge, Vercel or production Neon. The live mode is built and tested against a local stand-in. Running it for real is runbook step 9, with owner approval.

## Goal

1. One end-to-end driver that plays **one Ranked session per game** through the real server handlers and the real contracts:
   - on a local Hardhat chain (chain 4441) with PGlite standing in for Neon, now;
   - on LiteForge against `https://lestersarcade.io`, later (runbook step 9).
2. A phase-2 rehearsal: define the approved NFT subset, then `setMinter(relayer)`, then backfill-mint from `achievement_unlocks` by the catalog, then index.
3. A **step-7 dry run**: flip the flags in a throwaway worktree, regenerate everything step 7 regenerates, run the release build, and record the exact checklist the deploy session will follow.

The browser smokes, the live-flag browser run, `main.js` import hygiene and the README move to the browser-e2e slice (wave 4b), which builds on your `local-http.mjs`.

## Acceptance criteria

1. **`scripts/lib/rehearsal-driver.mjs`** exports `runRankedE2E({ target, api, chain, wallets, games = ['lester-blaster','chikun','stacked'], cronSecret, log })`, returning a JSON report. It is target-agnostic:
   - `api` is an HTTP client `(method, path, { headers, body }) → { status, headers, body }`;
   - `chain` is an ethers provider plus signers.

   For each game it asserts and records every item of guide §7 step 9:
   1. build a real session with `startPlaySession({ wallet, gameId, mode:'paid' })`;
   2. **SIWE**: `GET /api/session/nonce`, build the message, sign it with the player wallet, `POST /api/session`, keep the token;
   3. **seed ticket**: `POST /api/ranked/seed` with the token, then `applySeedTicket(session, response)`, then `rankedIdentityFor(…, { scoreRegistryAddress })` and `rankedSessionKey`;
   4. **entry**: `quoteEntry`, then `openSession{value: totalWei}` from the player (keep the tx hash for `entryTxHash`), then `isPaid` is true;
   5. **real evidence** at the ticket seed, with verify's generators (`tests/fixtures/ranked/build-fixtures.mjs`):
      - Chikun: a `scripts/lib/chikun-bots.mjs` bot run of 1-2 minutes, as v6 evidence;
      - STACKED: `buildStackedEvidence({ seed, buildHash, seasonId, topOutAtTick: 3600 })`, a short terminal SIC1 run;
      - HMH: a summary built with `sdk/hmh-run-summary.mjs` plus `finalizeSessionEvidence`, which passes the reboot-calibrated validator;
   6. wait until the run length has passed on the chain clock (local: `increaseTime`; live: real time), then `POST /api/settle` with the Bearer token; poll `GET /api/settle/status` (with the token) until `confirmed` (timeout 120 s);
   7. on chain, `getSession(sessionId32).exists` and `sessionEnvelopeHash` equal the response `envelopeHash`;
   8. `GET /api/leaderboard?game=&period=weekly` contains the row with rank ≥ 1 and the `txHash`;
   9. `GET /api/profile?wallet=` has `games[g].confirmedRuns ≥ 1` and `bestScore`, and `achievements` includes this session's unlocks;
   10. `GET /api/session/<shareId>` is 200 with a `cardRev`, and `GET /s/<shareId>` HTML carries the versioned `og:image` and `twitter:site` `@LestersArcade`;
   11. `GET /api/share-card/<shareId>.png?v=<cardRev>` returns a PNG;
   12. a profile name change: `setProfile(cleaned, 'lestersarcade:avatar/<id>')` from the player, then `POST /api/profile/refresh` (with the token), then the profile shows the name;
   13. `GET /api/cron/index-chain` with the cron secret runs cleanly, reports `schemaVersion`, and is idempotent.

   Negative checks:
   - a second POST of the same body returns the same state and sends no new transaction;
   - an **unpaid** session is 402 `entry-not-paid`;
   - a session opened with fees disabled is 402 `entry-underpaid` (local only: the operator turns fees off for that one entry, then back on);
   - a tampered Chikun claim does not change the server score;
   - evidence copied from one wallet's run and resubmitted under another wallet's ticket is rejected;
   - a token for a **different, ephemeral in-process wallet** (created by the driver, never funded) gets 403 `wallet-mismatch`;
   - with `SETTLEMENT_PAUSED=true` (local only), E15 and E3 answer 503 `settlement-paused` and no row changes.
2. **Local target.** `scripts/lib/local-stack.mjs` `startLocalStack()`:
   - uses `scripts/lib/local-chain.mjs` (contracts) to deploy the suite, confirm the dev wallets, set playable and enable fees;
   - builds an **unmigrated** PGlite through `tests/helpers/pglite-client.mjs` (index), so the first requests prove the handlers' lazy `ensureSchema` (A34);
   - builds an in-process `api` client that routes paths **exactly as `vercel.json` does**. Read `vercel.json` rewrites and apply them (query strings carried through), so routing drift is caught. It mounts each `api/*.mjs` module's `createHandler(() => buildDeps(env, { db, provider, deployment, nowMs }))` with fake `req`/`res` (A30), so the production adapter runs;
   - its `env` holds fixture values: `VERCEL_ENV=development`, `SESSION_ALLOWED_DOMAINS` for the driver's domain, Hardhat fixture keys under the **`RANKED_*` names**, a 64-character random `SESSION_SECRET`, a `CRON_SECRET`, and `RANKED_SCORE_REGISTRY_ADDRESS` equal to the local deployment.
3. **Live-shaped target, tested locally.** The **same driver** works over real HTTP and JSON-RPC:
   - `scripts/lib/local-http.mjs` serves the handlers with `node:http`, mounting the same `createHandler(() => buildDeps(env, overrides))` for each module behind the `vercel.json` rewrites, and can also serve a static directory (browser-e2e uses that to serve a portal build);
   - a JSON-RPC-over-HTTP proxy forwards to the Hardhat EIP-1193 provider;
   - `tests/local-chain-rehearsal.test.mjs` runs the driver twice: once in-process, once through the HTTP stand-in (`--target live`, pointing at `http://127.0.0.1:<port>` and the proxy RPC). Split into two files if timing needs it; each stays under 60 s.
4. **`scripts/rehearse-ranked-e2e.mjs`** CLI:
   - `--target local` (default): runs `startLocalStack` and writes the report to `docs/qa/pre-deployment-rehearsal-20260923.json`;
   - `--target live --site https://lestersarcade.io --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path> (--cron-secret-file <path> | --cron-secret-env <NAME>) --confirm-live SPEND_TESTNET_ZKLTC`:
     - reads the player key and the cron secret inside the process through `scripts/lib/key-source.mjs` (contracts), and **never prints or logs them**;
     - refuses to run without every flag;
     - prints the plan (3 entries at `quoteEntry` totals) and waits for `--yes`;
     - skips the local-only negative checks and reminds the operator of owner checkpoint O2 (whether the test wallet's rows stay on the launch boards or get `board_excluded`).
   - **Do not run the live mode in this slice.**
5. **Phase 2.** `scripts/rehearse-nft-phase2.mjs` and `scripts/backfill-nft-mints.mjs`:
   - the backfill has a pure `planBackfillMints({ unlockRows, deployment, nftIdsByGame })` returning `[{ registry, player, achievementId32, sessionId32 }]` for rows whose `achievement_id` is in `nftIdsByGame[gameId]` (from `nftAchievementIds(gameId)` of the catalog **at run time**) and whose `token_id` is null. It ignores the stored `nft` flag (contract A20);
   - a resync step `resyncNftFlags(db, nftIdsByGame)` rewrites `achievement_unlocks.nft` from the catalog, for display consistency;
   - the CLI reads Neon (`NEON_DATABASE_URL`), dry-runs by default, and broadcasts only with `--broadcast` plus `LITVM_BACKFILL_CONFIRM=BACKFILL_NFT_MINTS_4441`, using a relayer key through `key-source.mjs` (never printed);
   - `tests/nft-phase2-rehearsal.test.mjs`, on the local stack after one settled run:
     1. insert one unlock for the player's session whose id is in the **approved** subset but was `nft:false` in phase 1, and one that was `nft:true` in phase 1 but is **not** approved (labelled test setup: platinum and mythic are not earnable in a short run). This proves the backfill follows the approved catalog, not the stored flag;
     2. `planNftDefinitions` (contracts) with the operator sends the definitions for the approved subset, then `setMinter(relayer, true)`;
     3. backfill with the relayer; only the approved id mints;
     4. the index cron stamps `token_id`, `mint_tx_hash` and `minted_at`;
     5. E6 shows `tokenId` and the catalog's `nft` flag;
     6. `tokenURI` is `https://lestersarcade.io/achievements/<slug>/<id>.json`;
     7. a second backfill mints nothing (`mintFor` returns false for duplicates).
6. **Step-7 dry run** (`scripts/rehearse-step7-dry-run.mjs`). In a **throwaway git worktree** under the OS temp directory (never merged, never pushed, removed at the end; `node_modules` junctioned like the slice worktrees, never `npm install`):
   1. write `contracts/deployment-record.hardened.json` from a local-chain deploy (`deployLocalSuite`), and regenerate the address module with `status:'deployed'`;
   2. set `SETTLEMENT_LIVE = true` and `HOSTED_PROFILE_SYNC = true` in `apps/portal/src/settlement.mjs`;
   3. run `node scripts/build-portal-pages.mjs` (the site-copy slice made the public copy flag-driven);
   4. run `npm run vercel:build` (about 8 minutes) and collect every failing test and every audit script that complains;
   5. write `docs/qa/step7-dry-run-20260923.json` in **your** worktree: the failing tests by file and name, the pinned literals involved, the generated files that changed, and the exact edits step 7 must make. Add a "Step-7 checklist" section to `docs/web3/contract-overhaul-20260916.md` from it.

   The script needs `--confirm-throwaway` and refuses to run inside the main worktree. It must leave no trace in the repo other than the two output files.
7. **Docs:** `docs/web3/contract-overhaul-20260916.md` gains the rehearsal commands, the live-E2E command template (runbook step 9), and the step-7 checklist. The rehearsal report JSON is committed.

## Files

- **You own:** contract §10.2 row rehearsal.
- **Read-only:** everything else.
  - If the E2E exposes a bug in another slice's module, do **not** fix it here silently. Write a failing test that reproduces it, and report it in the final message so the orchestrator can route the fix to its owner.
  - The exception is trivial wiring (for example a `buildDeps` override that is not passed through): fix it with the smallest change, and name it in the commit message.

## Interfaces

- **Produced:** the E2E driver and report format (runbook step 9), `local-stack.mjs`, `local-http.mjs` (browser-e2e builds on both), the phase-2 scripts, the step-7 checklist.
- **Consumed:** every endpoint in §4; `local-chain.mjs`, `planNftDefinitions`, `key-source.mjs` (contracts); `createPgliteClient` (index); `rankedIdentityFor`, `rankedSessionKey`, `applySeedTicket` and the fixture generators (verify); `scripts/lib/chikun-bots.mjs` (chikun-tune); `sdk/hmh-run-summary.mjs`; `nftAchievementIds` (achievements).

## Plan

1. `local-stack.mjs` with vercel-rewrite routing, plus a smoke test: nonce, login, a seed ticket, and a leaderboard read on an empty (unmigrated) database.
2. `rehearsal-driver.mjs` for Chikun first; then STACKED and HMH; then the negative checks. Make `tests/local-chain-rehearsal.test.mjs` pass in-process (under 60 s; keep runs short).
3. `local-http.mjs` and the RPC proxy; run the same driver through HTTP.
4. The CLI and the report JSON.
5. The phase-2 scripts and their test.
6. The step-7 dry run and its outputs.
7. Docs. Register the files in `scripts/syntax-check.mjs` immediately after `"scripts/compile-contracts.mjs",`.

## Verification

```
node --test tests/local-chain-rehearsal.test.mjs tests/nft-phase2-rehearsal.test.mjs
node scripts/rehearse-ranked-e2e.mjs --target local
node scripts/rehearse-step7-dry-run.mjs --confirm-throwaway
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

Then `npm run vercel:build` in your own worktree for the full release gate, about 8 minutes at baseline.

## Pitfalls

- **Session keys commit to `scoreRegistryAddress` and the ticket seed.** Always derive identities from the **local** deployment and a ticket from the local E15, never from the predicted module or the FNV seed.
- **`replayStackedRun` needs the exact terminal tick and `maxTicks = 432000`.** Use verify's top-out generator; the soak pilot alone never tops out.
- **Chain time drives the timing checks.** The server compares `openedAt` (block time) with the run length. Locally, `increaseTime` past the run length before settling; never sleep.
- **Settle polls:** `pollAfterMs` guides retries, and the relayer lease is 40 s. Local receipts arrive instantly, so use the status endpoint rather than sleeping.
- **Hardhat time.** Attestation deadlines use chain time. Do not `evm_increaseTime` past 900 s between sign and submit unless you are testing re-signing.
- **`@vercel/og` in Node** may be slow on first render. Keep card checks to one per game.
- **Stay inside the time limits.** The gate runs these tests inside `vercel:build` on Vercel. Keep them offline and under 60 s per file. Split the files if needed; never mark them skipped. The step-7 dry run is a script, not a test.
- **Never read the vault.** Live-mode key handling is written and unit-tested with fixture key files under the OS temp directory.
- **`VERCEL_ENV` must be `development` locally**, or E2 rejects `127.0.0.1` (an absent value is production).

## Definition of done

- Both targets pass locally, the phase-2 rehearsal passes, and the step-7 dry run has produced its checklist.
- The report and the checklist are committed.
- The gate shows exactly 51, and `npm run vercel:build` is green. Do not commit the gate JSON.
- The final message lists: the live-E2E command template, the step-7 checklist summary, any cross-slice bugs found (with failing tests), and the remaining owner-gated steps (contract §13).
