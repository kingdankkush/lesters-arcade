# Slice brief: settle-wiring (wave 2 follow-up; orchestrator-defined)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/settle-wiring`, branch `fable/pd-settle-wiring`, base = the integration commit that merged achievements, verify and settle.
**Read first:** contract §3.3, §3.4, §4.3.3, §4.3.13, §5.2, §5.3, §6.2, §10.4 rule 6, §11; `docs/handoffs/pre-deployment-slices-20260923/settle.md` and `verify.md`.

## Goal

The verify, achievements and settle slices were built in parallel; settle coded against injected doubles. This slice wires the real modules together and proves the real settle handler end to end (contract §10.4 rule 6), then fixes whatever that proof exposes.

## Files

Owns: `tests/api-settle-handler.test.mjs` (create), `tests/helpers/settle-fixtures.mjs`, `server/settle/**`, `server/verify/verified-run.mjs` (switch to the static achievements stats import), `api/settle.mjs`, `api/ranked-seed.mjs`, `api/settle-status.mjs`, `api/cron/settle-retry.mjs`, `api/session*.mjs`, and minimal fixes in `server/verify/**` or `apps/portal/src/achievements/**` only if the real wiring proves a contract mismatch (name each in the commit message). `scripts/syntax-check.mjs` (anchor `'api/settle.mjs',`).

## Settle slice hand-off (verbatim)

**Settle-wiring step** (orchestrator, after merging achievements, verify and settle):

1. **Rebase fable/pd-settle** onto the integration branch that has server/verify/** and apps/portal/src/achievements/**. No production code change is expected. buildDeps already imports these paths at request time:
   - `../verify/index.mjs`: bindRankedIdentity, verifyRankedRun, computeEvidenceDigest, reverifyStoredRun.
   - `../verify/hmh.mjs`: HMH_HERO_GATES, loaded only for an HMH settle.
   - `../verify/seed-ticket.mjs`: issueSeedTicket (api/ranked-seed.mjs).
   - `../../apps/portal/src/achievements/index.mjs`: deriveEarnedAchievements, historyFieldsFor, nftAchievementIds, achievementById, catalogFor.
2. **Check the real signatures** match what settle calls:
   - `bindRankedIdentity(body, {chainId, scoreRegistryAddress, wallet, nowMs, seedSecret, crypto})` → `{ok, gameId, identity}`.
   - `verifyRankedRun(body, {...same, bound})` → VerifiedRun or `{ok:false, status, error, detail?, flags?}`. HMH soft flags must be on `verifiedRun.plausibility`, which is what gets stored.
   - `computeEvidenceDigest(body)` (sync or async) → `{encoding, text, bytes, digest}`.
   - `reverifyStoredRun({gameId, identity, evidence:{encoding, text}})`.
   - `issueSeedTicket({crypto, secret, nowMs, randomBytes, sessionId, wallet, gameId, seasonId, buildHash})` → `{seedTicket, seed}`.
   - If verify names differ, adapt `loadVerifyModule` / `loadHeroGates` in server/settle/settle-core.mjs and `loadIssueSeedTicket` in server/settle/seed.mjs.
3. **Add tests/api-settle-handler.test.mjs**, 'real handler settles a Chikun, a STACKED and an HMH run end to end on the local chain':
   - Mount `settleApi.createHandler(() => settleApi.buildDeps(fixtureEnv, {db, provider, deployment, nowMs}))` with an unmigrated PGlite, and get tickets through the real E15 handler.
   - Build bodies with verify's `buildFixtureBody` / `buildStackedEvidence` (topOutAtTick 3,600) / a 1-2 minute Chikun bot run, against the local registry.
   - Open the session on chain, `increaseTime` past the run length, then POST.
   - Reuse `bootLocalChain`, `deploymentFromRecord`, `fixtureEnv`, `openPaidSession` and `LOCAL_FEE_CAP_RESERVE_WEI` from tests/helpers/settle-fixtures.mjs.
   - **Important:** the fixture deployment must carry the larger settlementGasReserveWei (1e16), which is what deploymentFromRecord does. submitVerifiedSession used 473,462 gas; × 1.25 × the chain's ~1.07 gwei maxFee ≈ 6.3e14 wei, above 5 × the real 1e14 reserve, so the real reserve gives fee-too-high on the in-process chain.
   - Register the file after `'api/settle.mjs',` in scripts/syntax-check.mjs and keep it under 60 s.
4. **Replace the doubles where the brief asks.** The settle tests inject `tests/helpers/settle-fixtures.mjs` doubles through the deps factory, and those tests keep passing after the merge. At minimum add a parity check that the doubles' seed-ticket MAC, deriveRankedSeed, v2 envelope hash and VerifiedRun shape equal the real verify functions on one fixture. Consider switching `buildSettleBody` to verify's generators.
5. **Re-run the gates** after the rebase: `npm test`, `npm run check`, `npm run contracts:check`, `npm run build`, `npm run test:release` (51), then `git checkout` the gate JSON.

**Owner / deployment risk:**
- The §3.4 fee cap (gasLimit × maxFeePerGas ≤ 5 × 0.0001 zkLTC) only allows a maxFeePerGas up to about 0.84 gwei at about 590k gasLimit. If LiteForge fees are higher, every settle waits as fee-too-high (no attempts spent, but nothing publishes).
- Check the live `getFeeData()` and `estimateGas` of submitVerifiedSession against the reserve before runbook step 8, or raise `settlementGasReserveWei`. That is an on-chain operator action plus the generated address module.

**Other slices:**
- **profile-boards / signin-entry:** apps/portal/src/profile-sync-client.mjs still logs in with a browser nonce and without the server issuedAt. With HOSTED_PROFILE_SYNC on, E2 would answer 401 nonce-invalid until the client calls GET /api/session/nonce and uses its nonce and issuedAt. Tokens are v2 and audience-bound (`'lestersarcade:' + VERCEL_ENV`), so tokens stored from 1.7.0 must be discarded on 401.
- **ranked-client:** the settle client should treat `502 chain-read-failed` as retryable. It carries `retryable: true` and `retryAfterMs`. A `signed` response with a lease miss is normal: retry with the retry body after pollAfterMs (3,000 ms).
- **contracts / ranked-client:** `litvm-chain-client.mjs` `requestVerifierAttestation` still targets /api/attest, which now answers 410. Per A3 it has no runtime caller, but owner tooling that used it must move to /api/settle.
- **rehearsal:** scripts/lib/local-stack.mjs can mount every settle handler with `createHandler(() => buildDeps(env, {db, provider, deployment, nowMs}))`. It must set VERCEL_ENV=development, a fixture NEON_DATABASE_URL (settlementReady needs it even with a db override), CRON_SECRET, the RANKED_* names, and a deployment override whose settlementGasReserveWei clears the fee cap on the in-process chain.

## Verify slice hand-off (verbatim)

- Settle (on rebase):
  - `await issueSeedTicket`.
  - Pass the verify options exactly as fixtureVerifyOptions shows.
  - Store VerifiedRun.plausibility in verified_sessions.plausibility.
  - Compare reverifyStoredRun's score, contract and envelopeHash for the re-sign rule.
  - For the hero-locked check, use HMH_FREE_HEROES together with HMH_HERO_GATES and refuse hero ids in neither list: the child accepts any id-shaped heroId, so an unknown id must not count as free.
  - The fixture builder's buildFixtureBody(…) accepts a wallet, registry, secret, salt, issuedAt and entryTxHash, so bodies can be rebuilt for the Hardhat chain.
- Orchestrator, at integration:
  - Re-run `npm run assets:hmh:curated-level-kit-runtime` on the merged tree rather than hand-merging that generated list; index, verify and other slices each add paths.
  - Once achievements merges, delete the stats fallback and the existsSync branch in server/verify/verified-run.mjs. The verify tests pin the stats key order, so a reorder in achievements' stats.mjs would need a matching test update.
- Contract amendment: §5.3 says the boss grants 480 XP, but the reboot uses LIQUIDATOR_THREAT_COST = 48, which is 1,040 base XP (1,820 at max rank). The code value is what the validator uses.
- Performance note for chikun-tune or later: the v7 Chikun runtime takes about 14 µs per tick (step() rebuilds a full snapshot every tick), so a 60-minute replay would take about 3 s. That is fine within settle's 60 s maxDuration but above the guide's 1.6 s estimate.

## Definition of done

1. `tests/api-settle-handler.test.mjs` settles one Chikun, one STACKED and one HMH run through the real E15 and E3 handlers (`createHandler(() => buildDeps(env, {db, provider, deployment, nowMs}))`), an unmigrated PGlite and the in-process Hardhat chain (chainId 4441), with the real verify and achievements modules, and asserts: status confirmed after the receipt, the `verified_sessions` row, `session_evidence`, `achievement_unlocks` rows derived by the server, `getSession(...).exists` on chain, and E4 status. Also one negative per class: wrong wallet token (403), unpaid session (402), tampered score/evidence (422 replay-rejected or equivalent), duplicate settle (idempotent same state). Under 60 s, offline.
2. A parity test proves the settle doubles (seed-ticket MAC, deriveRankedSeed, v2 envelope hash, VerifiedRun shape) equal the real verify functions on one fixture, or the doubles are replaced by the real functions.
3. `server/verify/verified-run.mjs` imports `apps/portal/src/achievements/stats.mjs` statically (verify's fallback removed) and the stats still deepEqual on all ranked fixtures.
4. Gates: `npm test`, `npm run check`, `npm run contracts:check`, `npm run build`, `npm run test:release` (exactly 51), gate JSON not committed.
