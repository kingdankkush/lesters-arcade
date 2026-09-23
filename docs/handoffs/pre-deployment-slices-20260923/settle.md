# Slice brief: settle (wave 2, parallel with verify; rebases onto verify before the final gate)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/settle`, branch `fable/pd-settle`, based on the integration branch after all of wave 1 has merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A1, A3, A4, A8, A9, A12, A13, A15, A17, A20, A24-A28, A30, A31, A34), §2.7, §3 (all), §4.1-§4.4 (E1-E4, E13, E14, E15), §5, §6.2, §6.5, §8.2, §8.3, §9.2, §10.4 (rule 6), §11, §13 (emergency stops), §14 (rows S1-S5, S9-S11, S15, S16, F3, F5);
- guide §5.1 items 1-3 and 7-11, §5.6 item 4, and decision D10.

## Goal

The authenticated, idempotent, nonce-safe settlement service:
- server-issued SIWE nonces, hardened login and v2 session tokens;
- seed tickets for live Ranked (E15);
- `POST /api/settle`: auth, rate limits, identity and ticket binding, the paid-entry, amount and timing checks, verify, history-based achievement derivation, the Neon writes, EIP-712 signing, and relayed submission through the lease;
- `GET /api/settle/status`;
- the retry cron with classified failures;
- `/api/attest` retired.

## Acceptance criteria

1. **E1 `GET /api/session/nonce`** and **E2 `POST /api/session`** behave exactly as §4.3.1-§4.3.2 (nonce layout, 10-minute expiry, single use through `auth_nonces`, domain rules by `VERCEL_ENV` with **absent = production**, `wrong-chain`, the raised rate limits, every 401 code).
   - `server/auth/siwe-nonce.mjs` exports `issueSiweNonce({ secret, nowMs, randomBytes })`, `checkSiweNonce(nonce, { secret, nowMs })` (returning `{ ok, error }`) and `consumeSiweNonce(db, { nonce, wallet, expiresAt })`.
   - `verifySiweLogin` in `apps/portal/src/server-session.mjs` gains the optional `{ expectedChainId }` (E2 passes 4441). Existing calls without it behave as before.
   - **Token v2 (A13).** `issueSessionToken` and `verifySessionToken` take an `audience` (`'lestersarcade:' + (VERCEL_ENV ?? 'production')`); the payload is `v2|<audience>|<wallet>|<expiresAt>`. Verification rejects v1 tokens and other audiences. Update the token tests in `tests/server-session-profile.test.mjs`.
2. **`SIWE_STATEMENT`** in `apps/portal/src/wallet-auth.mjs` becomes exactly `'Sign in to Lester\u2019s Arcade. This does not cost anything or send a transaction.'` (A13). Add `isServerNonce(nonce) → boolean` (`/^[0-9a-f]{72}$/`). Update the pinned tests (`tests/wallet-auth.test.mjs` includes-statement checks; `tests/server-session-profile.test.mjs` SIWE cases).
3. **E15 `POST /api/ranked/seed`** (§4.3.13) in `server/settle/seed.mjs` `seedRequest(req, deps)`, using verify's `issueSeedTicket` (`server/verify/seed-ticket.mjs`; a local double until you rebase). It answers 503 when paused or not ready, so a paused service stops players before they pay.
4. **E3 `POST /api/settle`** implements the §4.3.3 pipeline **in that order**, with every listed status and error code. It lives in `server/settle/settle-core.mjs`, `settleRequest({ method, headers, body, ip }, deps)`, where:

   ```
   deps = { config, db, verify: { bindRankedIdentity, verifyRankedRun, computeEvidenceDigest, reverifyStoredRun },
            chain: { getPaidSession, waitForReceipt, getTransaction, getSession }, relayer, nowMs, catalog, heroGates }
   ```

   All of it is injected, so tests run without Vercel or the network. Key points:
   - the Bearer check happens before the body is read (A30); `SETTLEMENT_PAUSED` gives 503 before any work;
   - retry bodies count only against `settle-retry:w`; full bodies against `settle:w` (120/h) and `settle:ip` (240/h, IPv6 folded to /64 by index's `ipBucket`);
   - a retry body submits only for `signed`, or `failed` + retryable + `next_attempt_at ≤ now`; otherwise it returns the current state;
   - binding (identity, ticket, session key) and the existing-row check run before any chain read; the paid checks (`getPaidSession`, the `entryTxHash` wait, `entry-not-paid`, `entry-underpaid` against `config.minPaidWei`, the retryable `entry-pending`), then ticket freshness, then history and `hero-locked`, **then** replay, then the run-timing check (retryable `run-timing-early`, `run-stale`);
   - period keys from `openedAt`; `opened_at`, `entry_amount_wei`, `client_claim` (validated safe integer) and `plausibility` stored per the §3.3 CTE;
   - the response is the owner view of §4.4.
   The body is capped at 1,800,000 bytes through `server/http.mjs` `readJsonBody`.
5. **Store.** `server/settle/store.mjs` holds:
   - the §3.3 atomic insert CTE, with string parameters per A15 (parameters `$1`-`$31`);
   - compare-and-set transitions (`casStatus(db, { sessionId32, from, to, set })` returning a boolean);
   - `readSettleRow`;
   - `listDueRows(db, { nowMs, limit })` in the §4.3.11 order;
   - `recordFailure(db, { sessionId32, class, code })` per the §3.3 error classes: deterministic → `attempts + 1` with backoff, dead letter at `attempts ≥ 3`; re-sign → `pending`, `resigns + 1`, after 3 re-signs an infra wait with `verifier-rejected`; wait → `infra_failures + 1`, attempts unchanged, `min(60 s × 2^min(infra_failures,4), 15 min)`; rows retryable for over 7 days since `verified_at` → dead letter `stale`;
   - `markConfirmed`.
6. **Errors.** `server/settle/errors.mjs` exports `classifyRelayError(error, { decodeRevert })` returning `{ class, code }`, and the §4.4 allowlist. `last_error` and `lastError` are only allowlisted codes, never raw messages (ethers `SERVER_ERROR` messages embed the RPC URL). Logs carry the error name and code only.
7. **Relayer.** `server/settle/relayer.mjs` exports `createRelayer({ db, provider, wallet /* from config.relayer.createWallet */, registryAddress, reserveWei, leaseMs = 40000, holderId, nowMs })` returning `{ submit(row), checkReceipt(row), waitForReceipt(txHash, timeoutMs) }`. It implements §3.4 exactly:
   - lease acquire, up to 4 tries 750 ms apart; a miss is not a failure;
   - nonce choice with the gap guard; `nonce too low` / `NONCE_EXPIRED`, `nonce too high` and `replacement underpriced` / `already known` handling, at most 3 tries in the lease;
   - populate, estimate gas × 1.25, then the **funds and fee caps** (`fee-too-high` above 5 × reserve, `relayer-underfunded` below the needed balance; both wait codes);
   - `signTransaction`, `txHash = keccak256(raw)`, CAS to `submitted`, then `broadcastTransaction`;
   - never broadcast with less than 5 s of lease left;
   - release with `next_nonce`; receipt wait after the release;
   - a dropped transaction returns the row to `signed` and resets `next_nonce` to `getTransactionCount(latest)` under the lease;
   - `relayers(wallet.address)` checked once per process: false is the wait code `relayer-not-allowed`;
   - `SESSION_EXISTS` or an existing `getSession(id)` for this player → `confirmed`.
8. **Attestation and re-signing.** `server/settle/attestation.mjs` `signVerifiedRun(ethers, { verifiedRun, nftAchievementIds, deadlineSeconds, domain, signer })` returns `{ run, achievements32, signature, digest, deadline }`. It wraps `verifier-attestation.mjs` `buildVerifiedRun` and `signAttestation`. The deadline is `now + ATTESTATION_TTL_SECONDS` (900 s). `attestation` stores only `{ signature, digest, deadline, achievements32 }`. **A re-sign never trusts stored JSON** (§3.3): it calls `reverifyStoredRun` on `session_evidence`, requires the result to equal the row's score, contract fields and `envelope_hash`, and signs that fresh run; NFT ids are the row's `nft_achievements` ∩ `nftAchievementIds(gameId)`. A mismatch is the deterministic `stored-run-mismatch`. A row found with `deadline < now + 120 s` is re-signed before any submit.
9. **Achievements.** Derivation uses `deriveEarnedAchievements(gameId, verifiedRun, history)` with `history` from `readAchievementHistory(db, { wallet, gameId, fields: historyFieldsFor(gameId), excludeSessionId32 })`.
   - **All** earned ids go to `achievement_unlocks`.
   - **Only** ids in `nftAchievementIds(gameId)` of the current catalog go into `submitVerifiedSession` (A20), at most 32.
   - The SettleResponse `achievements` are the rows recorded by this session, with titles and images from `achievementById` and `nft` from the current catalog.
   - The HMH hero gate uses the same `history.runs` (§4.3.3 step 11, `HMH_HERO_GATES` from verify).
10. **E4 `GET /api/settle/status`** per §4.3.4: owner view with a Bearer token for the row's wallet, public view otherwise (no wallet, `lastError` or `attempts`; score, stats and achievements only when confirmed); `status:ip` limit; read-only apart from the throttled receipt check.
11. **E13 `GET /api/cron/settle-retry`** per §4.3.11 (`server/settle/retry.mjs` `runSettleRetry(deps)`), protected by `config.cron.matches`, honouring `SETTLEMENT_PAUSED`, classifying every failure, and dead-lettering `stale` rows.
12. **E14.** `api/attest.mjs` answers 410 `endpoint-retired` for every method. Remove its import from `api/settle.mjs`. Move the signing-related tests from `tests/verifier-attestation.test.mjs` (the `attestRequest` parts) to the attestation module; the pure `verifier-attestation.mjs` tests stay.
13. **Handlers (A30).** `api/settle.mjs`, `api/settle-status.mjs`, `api/session-nonce.mjs`, `api/session.mjs`, `api/ranked-seed.mjs` and `api/cron/settle-retry.mjs` each export `buildDeps(env, overrides)`, `createHandler(depsFactory)` and `export default createHandler(() => buildDeps())`, using index's `server/http.mjs` seam. `buildDeps` wires:
    - `readServerConfig(env, { deployment: await loadDeployment() })` (index; `RANKED_*` names, legacy names fail closed);
    - a module-scope Neon client from `config.neon.createClient()`, then `ensureSchema(db)` before the first query (A34);
    - a module-scope public provider;
    - `config.relayer.createWallet(ethers, provider)` and `config.verifier.createSigner(ethers)`, created **only** inside the handler after the config checks pass;
    - the verify functions from `server/verify/index.mjs` (the verify slice; see rule 6);
    - the achievements registry.
    Overrides are exactly `db`, `provider`, `deployment`, `nowMs`, `fetchImpl` and `crypto`. No other hook exists. Every handler wraps the core in try/catch and turns a throw into `500 internal-error`. No secret, config object or raw error is ever logged.
14. **Operator recovery.** `scripts/requeue-dead-letters.mjs [--session 0x… | --all-dead] [--apply]`: a dry run by default, `NEON_DATABASE_URL` from the environment (never printed), moves chosen dead letters back to `failed` with `attempts = 0`, `infra_failures = 0` and `next_attempt_at = now()`. Tested against PGlite with an injected client.

## Files

- **You own:** contract §10.2, row settle.
- **Read-only:**
  - `server/neon/**`, `server/http.mjs`, `server/config.mjs`, `server/deployment.mjs`, `server/chain/**` (index; ask the orchestrator for changes);
  - `server/verify/**`, `session-seed.mjs` and `ranked-identity.mjs` (verify, parallel);
  - `apps/portal/src/achievements/**`;
  - `scripts/lib/local-chain.mjs` (contracts; use it in tests);
  - every portal UI file, `main.js`, and `profile-sync-client.mjs` (profile-boards owns the browser client in wave 3).

## Interfaces

- **Produced:** E1-E4, E13, E14, E15; the SettleResponse (§4.4) owner and public views; the error allowlist. The ranked-client, signin-entry, results-share, profile-boards and rehearsal slices consume them.
- **Consumed:**
  - index: `readServerConfig`, `loadDeployment`, the `server/http.mjs` seam and helpers, `hitRateLimit`, `readAchievementHistory`, `ensureSchema`, `createPublicProvider`, the ABIs (including `getPaidSession`), `createPgliteClient`;
  - contracts: `LITVM_DEPLOYMENT`, local chain;
  - achievements: `deriveEarnedAchievements`, `historyFieldsFor`, `nftAchievementIds`, `achievementById`;
  - verify: `bindRankedIdentity`, `verifyRankedRun`, `computeEvidenceDigest`, `reverifyStoredRun`, `issueSeedTicket`, `HMH_HERO_GATES`, `deriveRankedSeed`, and the fixture generators in `tests/fixtures/ranked/build-fixtures.mjs`.

## Plan

1. **Nonce, login and tokens** (acceptance 1-2), with tests (`tests/server-siwe-nonce.test.mjs`):
   - "server nonce is 72 hex, signed, and expires in ten minutes";
   - "tampered or expired nonces are rejected";
   - "a nonce logs in once and replays fail as nonce-used";
   - "production rejects localhost; development allows it; an absent VERCEL_ENV counts as production";
   - "login on another chain fails as wrong-chain";
   - "v1 tokens and tokens for another audience are rejected".
2. **Store, errors and relayer** against PGlite plus the contracts slice's local chain (`startLocalChain`, `deployLocalSuite`, `activateLocalGames`; enable fees; a player wallet opens a session with `openSession{value: total}`). Tests (`tests/server-relayer.test.mjs`):
   - "lease is exclusive until it expires";
   - "holder never broadcasts with under five seconds of lease";
   - "tx hash is recorded before broadcast and confirmed after the receipt";
   - "nonce-too-low and nonce-too-high are retried from the chain's counts";
   - "a dropped transaction returns the row to signed and resets the nonce";
   - "an existing on-chain session is marked confirmed without resubmitting";
   - "an RPC outage waits without spending attempts";
   - "a deterministic revert dead-letters after three attempts";
   - "an expired or rejected attestation is re-signed from re-verified evidence";
   - "an underfunded relayer or a fee spike waits without signing";
   - "stored errors are allowlisted codes, never messages".

   For the error paths, wrap the provider and inject failures on a call counter.
3. **Seed tickets and settle core** with injected verify functions. Until verify merges, use a double that returns a VerifiedRun built from a small inline object meeting the §5.3 shape and a ticket double. Tests (`tests/server-settle-core.test.mjs`):
   - "requires a bearer token before reading the body";
   - "an unpaid body is 402 and never reaches the verifier" (spy);
   - "an entry the RPC cannot see yet is a retryable entry-pending";
   - "an underpaid entry is 402 entry-underpaid" (a zero-fee session on the local chain);
   - "a stale ticket is rejected; an early settle is retryable with retryAfterMs";
   - "a locked hero is rejected until the wallet has the runs";
   - "retry bodies do not spend the IP budget; full bodies do";
   - "a retry before next_attempt_at does not submit";
   - "rate limits per wallet and per IP";
   - "oversize bodies are 413 before parsing";
   - "a verified paid run is recorded, signed, relayed and confirmed on the local chain";
   - "period keys come from the entry's openedAt";
   - "achievements are all recorded and only catalog NFT ids are sent on chain";
   - "a repeat POST returns the same state without a second transaction";
   - "a different evidence digest for the same session is 409";
   - "two concurrent settles serialize through the lease and both confirm";
   - "the status endpoint shows the public view without the owner's token";
   - "the status endpoint confirms a submitted row from its receipt";
   - "paused settlement answers 503 and touches nothing";
   - "the seed endpoint issues tickets only to signed-in wallets and stops when paused";
   - "attest is retired with 410";
   - "missing or legacy env fails closed with the variable names only".
4. **Cron retry** (`tests/server-settle-retry.test.mjs`): "cron drains due rows in priority order within budget"; "cron dead-letters stale rows"; "cron rejects a missing or wrong secret". Plus the requeue script test.
5. Handlers. Update the pinned tests: `tests/server-session-profile.test.mjs` (the SIWE, token and "relayed settlement…" tests are rewritten for the new pipeline; the profile tests belong to index) and `tests/verifier-attestation.test.mjs`.
6. **Rebase onto the merged verify slice** (contract §10.4 rule 6). Replace the doubles with the real `server/verify/**`, `seed-ticket.mjs` and `session-seed.mjs` (the handlers must already import them). Add `tests/api-settle-handler.test.mjs`, "real handler settles a Chikun, a STACKED and an HMH run end to end on the local chain": mount `createHandler(() => buildDeps(fixtureEnv, { db, provider, deployment, nowMs }))` with fake `req`/`res`, an **unmigrated** PGlite, and the local chain's deployment record. For each game: get a ticket through the real E15 handler, build the body with verify's generators (`buildFixtureBody`, `buildStackedEvidence` with `topOutAtTick` 3,600, a 1-2 minute Chikun bot run) against the **local** registry address, open the session on chain, advance chain time past the run length (`increaseTime`), then POST. Keep the file under 60 s.
7. Register every new file in `scripts/syntax-check.mjs` immediately after `'api/settle.mjs',`.

## Verification

```
node --test tests/server-siwe-nonce.test.mjs tests/server-relayer.test.mjs tests/server-settle-core.test.mjs tests/server-settle-retry.test.mjs tests/api-settle-handler.test.mjs tests/server-session-profile.test.mjs tests/verifier-attestation.test.mjs tests/wallet-auth.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

## Pitfalls

- **One statement per Neon call.** The lease and CAS are single statements; there are no transactions (A1, A15).
- **`buildVerifiedRun` turns null `runtimeId` or `seasonId` into `ethers.id('')`.** The verified run always carries both. Assert it before signing.
- **`bigint()` in `verifier-attestation.mjs:48` rounds with `Math.round`.** The contract fields are integers already (floored by verify), so no rounding happens.
- **`submitVerifiedSession` reverts `NOT_PLAYER_OR_RELAYER`** unless the relayer was `setRelayer`'d. The local suite does this, like the deploy script. Registry `mintFor` from a non-minter reverts the whole settle; the score registry is the minter.
- **Vercel parses JSON bodies lazily.** Check the token first, then read the body; enforce the size from `content-length` first (`readJsonBody`).
- **Never read, print or log key values.** Keys exist only inside the wallet objects built by the config factories. Never pass `config`, `deps`, a wallet or a raw error to `console.*`: `util.inspect` ignores `toJSON`. Tests use Hardhat fixture keys and set `VERCEL_ENV=development`.
- **Retry bodies must not re-verify.** The evidence is already stored. They only drive the state machine.
- **Idempotency first.** A second POST for a confirmed session must not call `getPaidSession`, verify or the chain again.
- **Chain time.** `openedAt` is the block timestamp. Local tests use `increaseTime` to make a run's length pass before settling; never sleep.
- **Keep the handler's time budget.** Entry wait (≤ 10 s) plus replay (≤ 2 s) plus RPC plus the 15 s receipt wait stays under `maxDuration` 60.

## Definition of done

- Acceptance criteria 1-14 hold, and the end-to-end handler test passes after the rebase.
- The gate shows exactly 51. Do not commit the gate JSON.
- The syntax-check entries are added.
- No real network is used in any test.
