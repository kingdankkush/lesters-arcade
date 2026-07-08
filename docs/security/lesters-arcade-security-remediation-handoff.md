# LESTER'S ARCADE — SECURITY REMEDIATION HANDOFF (WO-115 → WO-131)

**Repo:** `kingdankkush/lesters-arcade` · **For:** Hermes agent execution
**Source:** `lesters-arcade-security-review-2026-07-07.md` (co-reviewer audit @ `1b111fe3`) — commit that file to `docs/security/` as the canonical reference; every WO below cites its finding IDs.
**Continues:** WO-1–114. Standing rules apply, PLUS security-specific rules:

- **SR1 — No deploys without HALT.** Any WO ending in a testnet deployment stops for Justin's explicit approval of the deploy plan (contracts, constructor args, addresses). Mainnet is out of scope entirely — nothing in this guide touches it.
- **SR2 — Every fix ships with the invariant test that would have caught it.** The review proved `contracts:check` is structural-only (MEDIUM-10). A contract fix without a failing-then-passing test is not done.
- **SR3 — Findings are the spec.** The review's remediation snippets (Appendix A–E) are pre-approved implementation shapes. Deviations require a written reason in the commit.
- **SR4 — ABI alignment stays green.** Any ABI change updates the alignment regression test in the same commit. Any settlement payload change bumps `balanceVersion`.
- **SR5 — Verify current line numbers.** The review was cut at `1b111fe3`; re-locate every cited line before editing (the WO-102+ art work may have shifted files). If a finding's code has already changed, verify whether the vulnerability still exists and record the verdict either way in `docs/security/REMEDIATION_LOG.md`.

---

# TRACK S0 — THE ARCHITECTURE DECISION (do first; it scopes everything)

## WO-115 (P0): Canonical settlement path ruling + testnet blast-radius disclosure
**Findings:** HIGH-6 (two competing payment/settlement systems), HIGH-8 (`SETTLEMENT_LIVE = true` with no anti-cheat).
**The decision Justin must make (present this, HALT for ruling):**
- **Recommended:** **Path B now, Path A later.** Testnet MVP runs `ScoreSubmissionRegistry` (hardened per WO-120) + `ArcadePaymentRouter` (locked down per WO-118, unused while ranked is free) — matching current live wiring and Justin's ruling that ranked is free until mainnet. `SessionLedger + PaymentRouter` (Path A) is designated THE future paid-ranked path: fully fixed in code + tests in this guide (WO-116/117/119), but **removed from the deploy set** until paid ranked launches. This kills the "both half-wired" state without throwing away the escrow architecture the $0.50 mainnet fee will need.
- Alternative: fix and deploy Path A now with zero-fee sessions. More work before the same testnet outcome; only pick if Justin wants escrow exercised early.
**Also in this WO (regardless of ruling):**
1. Write `docs/security/SETTLEMENT_ARCHITECTURE.md`: the chosen canonical path, the deprecated-until-mainnet path, a sequence diagram of the live flow, and the trust model (who signs what, who can call what).
2. **Testnet disclosure (HIGH-8):** ranked UI + leaderboard page + docs gain an explicit testnet-beta notice: scores are player-submitted and not yet cheat-proof on-chain (client integrity gate only), leaderboards may be reset, no value attached. Copy through the WO-30 voice, approved by Justin.
3. Document the leaderboard reset policy (P3.4): testnet boards MAY reset at the WO-131 redeploy — announce mechanism decided here.
**Done when:** ruling recorded; architecture doc committed; disclosure live in UI (capture); reset policy written.

---

# TRACK S1 — CONTRACT FIXES (the criticals)

## WO-116 (P0): `SessionLedger` — signer authorization, owner check, collision-proof ids
**Findings:** CRITICAL-1, HIGH-3.
**Steps:**
1. `closeSession()` per Appendix A: (a) `require(msg.sender == sess.player, "Not the session owner")`; (b) replace raw `ecrecover` with OpenZeppelin `ECDSA.recover` (add the dependency; reject malleable sigs); (c) resolve the expected signer from `GameRegistry` via a new `IGameRegistry` interface — `registry.getGame(sess.gameId).devWallet` — and `require(signer == expectedSigner, "Unauthorized signer")`. Also require the game `exists && playable` (MEDIUM-1) and that the session is open and not already closed.
2. `openSession()` per Appendix C: per-player nonce mapping; `sessionId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, gameId, nonce))`; collision guard becomes `require(sessions[sessionId].openedAt == 0, "Session collision")`. Ensure `openedAt` is set on open (add if absent).
3. EIP-712: verify the domain separator includes chainId + verifyingContract; the client-side signing payload in `litvm-chain-client.mjs` must match the struct hash exactly — extend the ABI alignment test to cover the typed-data shape.
**Tests (SR2, in the new WO-125 harness):** unauthorized signer reverts; random-key signature reverts; non-player caller reverts; double-close reverts; same-block double-open produces two distinct sessions and pulls two fees; malleable-sig rejection.
**Done when:** all tests fail on the pre-fix contract and pass post-fix (prove both in the commit message); ABI alignment green.

## WO-117 (P0): `PaymentRouter` — access control, vault validation, circular wiring
**Findings:** CRITICAL-2, HIGH-2, LOW-1.
**Steps:**
1. `setDefaultVaults()` per Appendix B: `onlyOperator` modifier, operator set in constructor (`require(_operator != address(0))`), zero-address validation on all four vaults.
2. Circular constructor fix (HIGH-2): remove `_sessionLedger` from the constructor; add one-time `setSessionLedger(address)` guarded by `onlyOperator` + `require(sessionLedger == address(0), "ALREADY_SET")`. (Simplest of the review's three options; a factory is overkill for one pair.)
3. Route-time guard (LOW-1): `splitAndDisburse()` requires all default vaults non-zero before transferring.
4. Two-step operator transfer (MEDIUM-5 for this contract): `transferOperator(address)` + `acceptOperator()` pattern (or OZ `Ownable2Step` if OZ is now a dependency — prefer OZ for consistency with WO-116's ECDSA import).
**Tests:** non-operator `setDefaultVaults` reverts; zero-vault config reverts; `setSessionLedger` second call reverts; disburse with unset vaults reverts; operator transfer requires accept.

## WO-118 (P0): `ArcadePaymentRouter` — kill caller-controlled routing
**Findings:** CRITICAL-3.
**Steps (implement the review's model 2 — registry-derived, since players call it):**
1. Constructor/admin state: `operator`, `gameRegistry`, `allowedPaymentToken` (immutable or operator-settable-once).
2. `startPaidSession()`: DELETE `SplitConfig calldata split` and the token parameter from the public surface. Token = `allowedPaymentToken`; split bps + destinations read from `GameRegistry` for the given `gameId` (extend `GameRegistry` with per-game split data + platform defaults if not present — coordinate with WO-122); `require` game exists && playable.
3. Emit events with the derived (trusted) values so indexers see truth.
4. While ranked is free (WO-115 ruling), gate the whole function behind `require(entryFeeEnabled)` operator flag, default false — the code is mainnet-ready but inert on testnet.
**Tests:** caller-supplied destinations impossible by construction (compile-level assertion: function signature has no split param — lock with an ABI snapshot test); wrong token impossible; unregistered game reverts; fee flag off ⇒ reverts.

## WO-119 (P0): `SessionLedger.settle()` — atomic split
**Findings:** CRITICAL-4, HIGH-1 (wiring half).
**Steps:** Replace transfer-and-mark with the atomic pattern: transfer entry fee to `PaymentRouter` then call `IPaymentRouter(paymentRouter).splitAndDisburse(sess.gameId, sess.player, sess.entryFee)` in the same transaction (router splits from its received balance), then `sess.settled = true`. Add reentrancy guard (OZ `ReentrancyGuard`) on `settle()` and `openSession()` (external token calls). Settlement requires the session closed and not settled.
**Tests:** post-settle vault balances equal expected bps split exactly; double-settle reverts; settle-before-close reverts; reentrancy attack mock fails; funds can never rest in the router across transactions (invariant: router token balance == 0 after settle).

## WO-120 (P0): `ScoreSubmissionRegistry` — hardening for the live testnet path
**Findings:** HIGH-4, MEDIUM-1.
**Steps:**
1. Gate on registry: `require(g.exists && g.playable, ...)` via `IGameRegistry`.
2. **On-chain plausibility bounds** mirroring the client integrity module's design ceilings: max score, kills, maxCombo, survivalSeconds (generous — this stops bots writing `uint256.max`, not sophisticated cheats), achievement array length cap (e.g. ≤ 32). Source the constants from one place: generate a `contracts/src/gen/IntegrityBounds.sol` from the same JS balance constants via a build script, so client and chain can't drift (wire into `contracts:check`).
3. Optional-verifier hook, ready for the replay-verifier tier: `submitVerifiedSession(..., v, r, s)` accepting the trusted verifier's EIP-712 attestation → rows flagged `verified: true` on-chain; plain `submitSession` remains for casual/testnet rows flagged unverified. Leaderboard UI already distinguishes verified badges (WO-57) — wire the flag through the indexer.
4. Keep the existing `exists`-flag replay rejection; add an explicit event on rejection-worthy attempts? No — reverts suffice; do add `SessionSubmitted(sessionId, verified)` event field.
**Tests:** unregistered/unplayable game reverts; over-bounds values revert; achievement cap enforced; duplicate sessionId reverts; verified path validates the verifier signer against `GameRegistry.trustedVerifier`.

---

# TRACK S2 — REGISTRY, WRAPPER, PROFILE, TOURNAMENT

## WO-121 (P1): `LestersArcadeCore` — remove from deployment (fix-or-remove ruling)
**Findings:** HIGH-5.
**Recommendation to implement:** REMOVE it from the deploy path (the review's option 1). It mis-wires `AchievementRegistry` (gets `trustedVerifier` where a ledger is expected), strands `TournamentPool.owner` on the wrapper, and configures `ArcadePaymentRouter` with nothing. The WO-131 deploy script deploys contracts individually with explicit wiring. Keep the contract in-tree marked `/// @dev NOT FOR DEPLOYMENT — see docs/security/SETTLEMENT_ARCHITECTURE.md` or delete it outright (Justin's call — one-line HALT).
**Tests:** deploy-script test asserts the wrapper is not in the artifact set of the canonical deployment.

## WO-122 (P1): `GameRegistry` — devWallet confirmation + playable gating + split data
**Findings:** MEDIUM-1, MEDIUM-2.
**Steps:** (1) `confirmDevWallet(gameId)` callable only by the registered devWallet; `setPlayable(true)` requires `devWalletConfirmed`; (2) settlement/score contracts consume `exists && playable` (done in S1 — verify all three call sites); (3) add per-game split bps + destination fields (or platform-default fallback) for WO-118's registry-derived routing; (4) two-step operator transfer (MEDIUM-5).
**Tests:** unconfirmed wallet can't go playable; only devWallet can confirm; split data readable by router.

## WO-123 (P1): `PlayerProfileRegistry` — handle normalization + bounds
**Findings:** MEDIUM-3.
**Steps:** on-chain: lowercase-normalize ASCII before hashing (simple byte-loop for a-Z; reject non-printable), trim/reject leading/trailing spaces, enforce 3–20 byte length, charset `[a-z0-9_-]` (mirror the frontend rules — extract the frontend validator's rules into a shared spec doc so they can't drift); commit-reveal explicitly DEFERRED to mainnet (record in the architecture doc — front-running a free testnet handle is acceptable blast radius per WO-115 disclosure).
**Tests:** `Alice`/`alice`/`alice ` collide; bad charset/length reverts; existing-handle transfer rules unchanged.

## WO-124 (P2): `TournamentPool` — payout paths + ownership
**Findings:** MEDIUM-4, MEDIUM-5.
**Steps:** since tournaments are post-launch (Justin ruling), the minimal safe state: (1) add `Ownable2Step`; (2) add `finalizeTournament(id, winners[], amounts[])` (owner-only, sums ≤ prizePool, marks finalized) + `claim(id)` pull-payment per winner + `refundUnclaimed(id)` after a deadline + `rescueAccidental(token/native)` owner-only with event; (3) OR — if Justin prefers — gate `fundTournament` behind `require(false, "DISABLED_UNTIL_MAINNET")` and defer the payout design (HALT: one-line choice). Either way funds can never be permanently stranded.
**Tests:** per chosen option — payout math, double-claim reverts, refund window, or funding disabled.

---

# TRACK S3 — REAL CONTRACT TESTING (the review's structural gap)

## WO-125 (P0, runs FIRST in parallel with S1): Foundry test harness + invariant suite
**Findings:** MEDIUM-10.
**Steps:**
1. Add **Foundry** (`forge`) as the contract test framework (fast, fuzz + invariant native, no node dependency conflicts with the esbuild toolchain). `foundry.toml`, remappings for OZ, `contracts/test/` suite. npm script `contracts:test` wired into the verification gate next to `contracts:check` (which stays as the cheap structural pre-filter).
2. Port every test named in WO-116–124 as it lands, PLUS the review's checklist verbatim: unauthorized `setDefaultVaults` reverts; unauthorized/incorrect `closeSession` signature reverts; non-player close reverts; active-session collision impossible; settlement atomically routes to expected vaults; registry rejects unregistered/unplayable; deployment leaves admin functions callable by intended owner (deploy-fixture test).
3. **Fuzz/invariant targets:** SessionLedger escrow (`invariant: contract balance == Σ open-session entry fees`), PaymentRouter (`invariant: router balance == 0 between transactions`), score bounds fuzzing, nonce/session-id uniqueness fuzz.
4. Run Slither in CI (`contracts:slither`, informational gate — new HIGH findings block, knowns tracked in `docs/security/slither-triage.md`).
**Done when:** `contracts:test` green in the gate with ≥ the enumerated cases; fuzz runs configured (≥ 10k runs local, bounded in CI); Slither triage doc committed.

---

# TRACK S4 — JS RUNTIME & SANDBOX

## WO-126 (P1): One chain-write path
**Findings:** HIGH-7, MEDIUM-8.
**Steps:** `litvm-chain-client.mjs` becomes the ONLY live write layer. `settlement.mjs` demotes to a pure planner whose output feeds the chain client: its plan args become ABI-typed exactly as the client submits them (bytes32 ids via the same `toBytes32Id`); delete or dev-flag the generic live `settleRun()`/injected `sendTransaction` path (if kept for tests, it performs a fresh `eth_chainId` check pre-broadcast per the review). Test: plan args for a sample run byte-equal the chain client's encoded args (shared fixture).

## WO-127 (P1): Leaderboard replay dedupe
**Findings:** MEDIUM-6, MEDIUM-7.
**Steps:** Appendix D guard in `leaderboard-engine.recordCadenceScore()`; same sessionId guard on the flat `state.leaderboards[game.id]` push and on `state.settlements` in `arcade-core.mjs`; the WO-57 indexer dedupes by sessionId too (verify). Tests: double-settle callback, retry, and rehydration each produce exactly one row per board type.

## WO-128 (P1): folded into WO-115 step 2 (disclosure UI) — tracked here for the finding map (HIGH-8). Verify done.

## WO-129 (P2): postMessage hardening
**Findings:** MEDIUM-9.
**Steps:** parent shell: `if (event.source !== sandboxedIframe.contentWindow) return;` before parsing (per Appendix E) — for every listener including the mock harness; cabinet side: capture the parent origin at boot handshake and use it as explicit `targetOrigin` for all posts (replace `'*'`) + verify `event.origin` on inbound commands where the embedding origin is known; sandboxed cross-origin cabinets keep the SDK's shape/source-tag validation as the inner layer (document the two-layer model in `sdk/README.md`). Tests: pure parser tests extended with spoofed-source fixtures; a harness smoke that posts from a rogue frame and asserts rejection.

## WO-130 (P2): Low-severity sweep
**Findings:** LOW-2..5, MEDIUM-11.
1. Deploy script logs `deployer.address` only — delete the private-key fragment print (MEDIUM-11).
2. Simulated tx hashes → `simulatedTxHash: "sim:<hash>"`, `txHash` stays null for simulated rows; UI renders a SIMULATED badge instead of an explorer link (LOW-3).
3. Sandbox CSP: move first-party cabinet styles to external stylesheets, drop `'unsafe-inline'` for styleSrc (or nonce-based if a blocker emerges — document which) (LOW-4).
4. `manifestChecksum()` → keccak256 digest (via ethers, already a dep); keep FNV as the fast drift check if useful, but the recorded digest is cryptographic; add the digest field to `GameRegistry` registration (coordinate WO-122) so it anchors on-chain (LOW-5).
5. License ruling (LOW-2): HALT one-liner to Justin — keep `UNLICENSED` + add a LICENSE file stating proprietary, or pick a license for SDK reuse. Implement the answer.

---

# TRACK S5 — DEPLOYMENT & MIGRATION

## WO-131 (P0, LAST): Canonical testnet redeploy
**Findings:** HIGH-1, HIGH-6 (wiring half), plus everything above going live.
**Steps:**
1. Rewrite `deploy-contracts.mjs` for the WO-115 canonical set ONLY: GameRegistry (with verifier + operator), PlayerProfileRegistry, ScoreSubmissionRegistry (hardened), AchievementRegistry (wired to its real authorized caller), ArcadePaymentRouter (locked, fee-disabled) — Path A contracts compiled + tested but NOT deployed (per ruling). Explicit constructor args from a checked-in `deploy-config.testnet.json`; post-deploy wiring calls (setSessionLedger etc. where applicable); writes `deployment-record.json` + regenerates client ABIs + runs the alignment test — one command, idempotent-safe (refuses to overwrite a record without `--force`).
2. **HALT (SR1):** present the deploy plan (contracts, args, gas estimate, what dies) to Justin.
3. Execute on LiteForge testnet; verify each contract's wiring on-chain via a post-deploy assertion script (reads back operator/registry/token addresses and compares to config).
4. **Migration/reset:** per the WO-115 reset policy — new registry means fresh boards; the indexer snapshots the old boards to `docs/archive/leaderboards-pre-security-<date>.json` for posterity; UI announcement copy per the disclosure voice; profile registry migrates only if the contract changed (if unchanged, profiles persist — prefer not redeploying it unless WO-123 landed).
5. End-to-end proof: 5 consecutive ranked settlements from a fresh wallet through the hardened path; one bot-style garbage submission rejected by the new bounds; captures + tx links in the report.
**Done when:** new deployment live and verified; gate green including `contracts:test`; disclosure visible; remediation log shows every finding ID → commit → test → status; Justin sign-off.

---

# FINDING → WO MAP (completeness check — every ID must appear)

CRITICAL-1→WO-116 · CRITICAL-2→WO-117 · CRITICAL-3→WO-118 · CRITICAL-4→WO-119 · HIGH-1→WO-119/131 · HIGH-2→WO-117 · HIGH-3→WO-116 · HIGH-4→WO-120 · HIGH-5→WO-121 · HIGH-6→WO-115/131 · HIGH-7→WO-126 · HIGH-8→WO-115/128 · MEDIUM-1→WO-116/120/122 · MEDIUM-2→WO-122 · MEDIUM-3→WO-123 · MEDIUM-4→WO-124 · MEDIUM-5→WO-117/122/124 · MEDIUM-6→WO-127 · MEDIUM-7→WO-127 · MEDIUM-8→WO-126 · MEDIUM-9→WO-129 · MEDIUM-10→WO-125 · MEDIUM-11→WO-130 · LOW-1→WO-117 · LOW-2→WO-130 · LOW-3→WO-130 · LOW-4→WO-130 · LOW-5→WO-130/122

# EXECUTION ORDER

WO-115 (ruling, HALT) → WO-125 (harness — first, so every fix lands tested) → S1 in order 116→117→118→119→120 → S2 121→122→123 (124 may defer per its HALT) → S4 126→127→129→130 → WO-131 (deploy, HALT) . Maintain `docs/security/REMEDIATION_LOG.md` throughout: finding ID, verdict at current HEAD (per SR5), fix commit, test name, status. The review's Part V "what is working well" items are load-bearing — do not regress the sandbox `allow-same-origin` posture, the SDK validation primitives, or the chain-guard checks while refactoring around them.
