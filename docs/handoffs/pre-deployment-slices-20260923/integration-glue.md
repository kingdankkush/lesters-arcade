# Slice brief: integration-glue (wave 3c; orchestrator-defined)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/integration-glue`, branch `fable/pd-integration-glue`, base = the integration commit that merged all five wave-3 slices (settle-wiring, ranked-client, signin-entry, results-share, profile-boards) on top of site-copy and the 0.002 zkLTC reserve.
**Read first:** contract §7 (all), §9.1, §10.3, §11; the briefs `ranked-client.md`, `signin-entry.md`, `results-share.md`, `profile-boards.md`, `site-copy.md`; and the hand-off notes collected in the orchestrator's `wave3-followups.md` (quoted where needed below).

The five wave-3 slices were built in parallel against the contract. Each left notes about seams the others own. This slice closes those seams so that, **with both flags flipped to true** (the step-7 state), every Ranked, sign-in, profile, leaderboard, results and share path works end to end and no public text is false. Unlockables (wave 3b) and rehearsal (wave 4) run in parallel with you: do not touch `hmh-character-config.mjs`, the character-select call sites, `apps/*/src` palette/skin hooks, or `scripts/lib/local-*.mjs` / `scripts/rehearse-*.mjs`.

## Work items

### A. One sign-in path (signin-entry ↔ profile-boards), critical for launch

1. There must be exactly one SIWE login path, owned by `wallet-session.mjs` (contract §7.6): it fetches `GET /api/session/nonce`, builds the challenge with the **server** nonce and server `issuedAt`, gets one signature, and calls `profileSync.login({ challenge, signature })` (profile-boards made `login()` refuse any non-server nonce). Remove or reroute `authenticateWalletSiwe` in `main.js` (~:5957-5980 at the wave-3 base; re-grep) and any other browser-nonce login.
2. `walletSession.token(wallet)` / `isAuthenticated(wallet)` are backed by `profileSync.tokenFor(wallet)`; every Bearer caller (profile PUT, profile refresh, settle, seed tickets, name-claim flow) gets its token only through the wallet session. On any 401 from a Bearer call, call `walletSession.invalidate()`; stored v1 (pre-1.8.0) tokens are discarded.
3. `lesters:wallet-session` is dispatched after sign-in, silent restore and sign-out, and profile-boards' caches re-hydrate on it.
4. Before any on-chain profile write (name or avatar via `PlayerProfileRegistry`), `await ensureWalletProvider()` so a restored WalletConnect session creates its provider on that click.
5. `official-profile-route` still says "Connect Wallet to Save Progress": use the "Sign in" wording signin-entry adopted.

### B. Ranked client ↔ results screen ↔ profile

6. In the `lesters:ranked-run` context, `context.sessionId` equals the `session.sessionId` that `currentSession`/`lastCompletedSession` hold (HMH switches to "View results" by it). The §7.2 snapshot exposes `persisted` (false for unpersisted STACKED bodies) and `handle.subscribe(fn)` returns an unsubscribe function. Verify each and fix where missing.
7. On `lesters:ranked-retry-request`, the ranked client calls `event.preventDefault()` (or sets `detail.handled = true`) when it holds a live handle for that id, so the profile does not POST the retry body twice.
8. The boot `lesters:ranked-pending` dispatch happens after `main.js` has finished evaluating (the profile listener registers later in the file); prove with a test that the profile receives the boot count.
9. No call to the removed `profileSync.settle` remains. Remove the now-unused `mergeChainRecordIntoState`, `ensureGameIdHashes` and `_hydratingLeaderboard` only if nothing references them (keep any literal a test pins, or update the test in the same commit).
10. The results screen's entry chip reflects `entryReceipt` / `lesters:ranked-entry` (broadcast → confirmed | failed).
11. **Reopen results.** After the results screen is dismissed in Chikun or STACKED there is no way back to it. Add a small parent-level "View results" affordance (portal chrome, not the child iframe) while that game's cabinet is open and a Ranked results handle exists; keyboard and touch reachable, 320 px safe.

### C. Share page and card

12. `vercel.json` `functions["api/share-card.mjs"].includeFiles` also includes `apps/portal/assets/generated/achievement-badges/**` so production cards show badge art. Update `tests/vercel-routing.test.mjs` accordingly.
13. `api/share-page.mjs` (and the card, if it shows an avatar) passes `avatarSrc` from `arcade-avatars.mjs` (`avatarUri` → site path); hidden or blocked profiles keep the default avatar. Test both.

### D. Copy that becomes false when the flags flip

Each of these must read from the flags (`PORTAL_FLAGS` / `portalCopyFor` in `portal-content.mjs`, or `SETTLEMENT_LIVE` / `HOSTED_PROFILE_SYNC`) so preview stays truthful and launch is truthful, with tests for both states:

14. `routes/official-play-routes.mjs` (~:370) "STACKED // Local Ranked Preview".
15. `leaderboard-view.mjs` `STACKED_LOCAL_NOTICE` (must not show on hosted boards).
16. `arcade-core.mjs` STACKED game description ("stay on this device", ~:673) and the Chikun mode descriptor ("on-chain publishing remains safely gated", ~:586); also Chikun's `requiresZkLtc:false`, which would hide the faucet link after the flip (all three games require zkLTC for Ranked at launch).
17. `apps/portal/stacked/index.html` (~:59) scoreNote "local ledger" (this page is static: render both variants or make the text neutral and true in both states).
18. `routes/official-profile-route.mjs` STACKED text.
19. Sweep once more: `rg -n -i "local ranked preview|stay on this device|remains safely gated|local ledger|not an online leaderboard|device-local|publishing remains disabled"` across `apps/`, and make every hit flag-aware or already true in both states. The preview-only pinned phrase "Verified on-chain publishing remains disabled" (ship-readiness test) may stay in the **preview** branch only.

### E. Contract and doc amendments

20. Contract §5.3: the boss XP figure 480 is wrong; the reboot uses `LIQUIDATOR_THREAT_COST = 48`, which is 1,040 base XP (1,820 at max rank). Amend the text to match the code the validator uses.
21. Contract §7.4 and guide §5.12: record that Ranked share text says "Rank N this week" (no `#`, no hashtags; Weekly is the headline while Daily is off), per results-share.
22. `apps/portal/src/achievements/stats.mjs` header comment: a mapper throw is a 500 (verify's policy), not a rejected run.
23. Re-run `npm run design:web3-audit` and commit the regenerated `docs/qa/hard-money-heroes-web3-settlement-audit.{json,md}` if they changed.

### F. Test robustness

24. `tests/hmh-tripo-production-asset-qa.test.mjs` "unified production QA actually includes the native package report" runs 67-98 s against a 120 s timeout and has timed out under load. If it is **not** in `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json`, raise that one test's timeout to 300 s (no other change). If it is ledgered, leave it.

## Definition of done

1. Items A1-A5, B6-B11, C12-C13, D14-D19, E20-E23 and F24 are each done with a test (or, for doc items, the doc edit), or explicitly shown to be already satisfied with evidence in the final report.
2. A browser check on your port with a **throwaway** copy of the portal where `SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC` are true (never committed) shows: the Sign in button and picker, the Ranked modal quoting 0.1 + 0.002 = 0.102 zkLTC, and no false preview copy on the splash, games, Scores and Profile views; plus the committed preview state with a clean console.
3. Gates: `npm test`, `npm run check`, `npm run contracts:check`, `npm run build` (byte budgets: HMH initial + shared ≤ 1,048,576; no HMH child growth from this slice), `npm run test:release` (exactly 51), gate JSON not committed. Regenerate `hmh-curated-level-kit-runtime.mjs` and the portal pages if your changes require it.
