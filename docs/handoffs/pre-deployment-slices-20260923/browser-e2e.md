# Slice brief: browser-e2e (wave 4b, after rehearsal has merged)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/browser-e2e`, branch `fable/pd-browser-e2e`, based on the integration branch after the rehearsal slice has merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A17, A18, A25, A30, A33), §7 (all client APIs and events), §9.1, §10.2 (row browser-e2e), §10.3 (the import-hygiene note), §11 (rules 7, 9, 13), §13 (steps 9-10), §14 (rows C3, C19);
- the rehearsal slice's `scripts/lib/local-stack.mjs`, `scripts/lib/local-http.mjs` and `scripts/lib/rehearsal-driver.mjs`;
- guide §5.15 and §7 steps 9-10.

**Safety:** nothing here touches LiteForge, Vercel or production Neon. The `--live` modes are written and tested locally, and run for real only at runbook steps 9-10 with owner approval.

## Goal

1. Exercise the **real browser Ranked flow with both flags on** before production: sign-in, the seed ticket, the entry transaction in `requestRankedEntry`, the run starting on broadcast, the settlement handle, the results screen reaching `published`, and the share row pointing at `/s/<shareId>`, once per game. Today no test runs the combined wave-3 `main.js` path live; real players would be the first.
2. Bring every browser smoke up to date after wave 3, in preview mode.
3. `main.js` import hygiene and the README.

## Acceptance criteria

1. **Fixture wallet.** `scripts/lib/fixture-wallet.mjs` exports `installFixtureWallet(page, { rpcUrl, privateKey, chainId: 4441, announce: true })` for Playwright. It injects an EIP-1193 provider with `page.addInitScript` and announces it over EIP-6963 (`rdns: 'io.lestersarcade.fixture'`), and routes signing through `page.exposeFunction` to Node, where an ethers `Wallet` signs (`personal_sign`, `eth_sendTransaction` → signed raw transaction sent to `rpcUrl`, `eth_accounts`, `eth_requestAccounts`, `eth_chainId`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`). Reads are proxied to `rpcUrl`. The key never enters the page. `tests/fixture-wallet.test.mjs` unit-tests the request router without a browser.
2. **Live-flag browser run.** `scripts/ranked-live-browser-e2e.mjs`:
   - `--target local` (default): starts the rehearsal's local stack and `local-http.mjs` with the RPC proxy, then builds a **throwaway portal copy** in the OS temp directory: `npm run build` output plus `apps/portal`, with `settlement.mjs` flags set true and the address module regenerated as `deployed` from the local deployment record. Nothing in the repo changes. `local-http.mjs` serves that copy as the web root together with the API routes, and the RPC URL in the copy points at the proxy (patch `LITVM_LITEFORGE_NETWORK.rpcUrls` in the copy only, and add the proxy origin to the served CSP if `local-http.mjs` applies it);
   - for each game, with the fixture wallet on a Hardhat account: open the portal, Sign in (server nonce, one signature), open the game's Ranked mode, approve the entry, play a short run (HMH through its `terminalPilot=1` runtime parameter; Chikun and STACKED through their existing smoke drivers or input scripts), then assert:
     - the entry `sessionId32` recorded on chain equals the `sessionId32` the settle request used;
     - the results screen reaches `published` with the explorer link;
     - the share row points to `/s/<shareId>` and the share text has no address, no `session-` and no `#`;
     - zero console errors and zero failed requests;
   - `--live --site <origin> --rpc <url> --player-key-file <path> --confirm-live SPEND_TESTNET_ZKLTC --yes`: the same flow against a real site (runbook step 9, optional), with the key read in Node through `scripts/lib/key-source.mjs` and never printed.
   - This script needs Playwright (`PLAYWRIGHT_PACKAGE_PATH=C:/Users/just_/lesters-arcade-fable0916/benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs`), so it is **not** part of `npm test`. Run it and commit its JSON report to `docs/qa/ranked-live-browser-e2e-20260923.json`.
3. **Smokes in preview** (both flags false), each run against `python -m http.server 8809 --directory apps/portal` with `CHIKUN_PORTAL_ORIGIN`, `HMH_PORTAL_ORIGIN` or `STACKED_ORIGIN=http://127.0.0.1:8809`, all passing with zero console errors and zero failed requests:
   - `scripts/chikun-ranked-browser-smoke.mjs`: the results screen appears in preview (the selector results-share used); the new child and parent copy; the child share row hidden for Ranked; preview board and profile expectations; the stub provider unchanged; no `/api` calls at all. Add a `--live` variant for runbook step 10 that uses the fixture wallet against a real site with a funded key file (optional, spends testnet zkLTC).
   - `scripts/hmh-simulated-wallet-browser-smoke.mjs`: the fallback on localhost with no wallet is unchanged, and the picker does not appear.
   - `scripts/smoke-portal-flow.mjs` and `scripts/smoke-portal-interactions.mjs`: markers, including the regenerated site copy.
   - `scripts/stacked-playable-browser-smoke.mjs` (it asserts `/Local Only/` and `/No fees, prizes or online ranking/`, which ranked-client rewrote), `scripts/stacked-reactive-evidence-smoke.mjs` and `scripts/stacked-cabinet-browser-smoke.mjs`.
   - `scripts/hmh-reboot-portal-e2e.mjs` (it asserts the parent game-over summary, which results-share replaced for Ranked).
   Update each to the new truthful copy. Use the outdated-assertion lists in the wave-3 slices' final commit messages.
4. **Import hygiene** in `main.js` lines 1-316. Remove the names that are now unused: `submitRankedSession`, `requestVerifierAttestation`, `fetchGlobalLeaderboard`, `fetchPlayerSessions`, `fetchProfile`, `submitProfile`, `estimateSettlementGas`, `recordStackedScore`, `applySeedLeaderboard`, and any others a grep or `npm run build` shows unused. First check that every source-pinning test and audit script (`scripts/hmh-web3-settlement-audit.mjs`, `scripts/hmh-security-audit-sweep.mjs`, the `tests/*` that `readFileSync` `main.js`) still passes. Keep `CURRENT_RANKED_SEASON_ID` if anything still uses it.
5. **Docs.** README: a short "How Ranked works now" section (sign in, seed ticket, entry, relayed publish, index, share). **Do not** change the version, cache marker or production lines; those happen at deployment. A release receipt draft under `docs/qa/` lists the evidence (rehearsal report, step-7 checklist, live-flag browser report, smoke results) for the deploy session to complete.

## Files

- **You own:** contract §10.2 row browser-e2e.
- **Read-only:** everything else. `scripts/lib/local-stack.mjs` and `local-http.mjs` belong to rehearsal: if they need a small hook (for example serving a static directory or applying the CSP), make the smallest change, name it in the commit message, and add a test. A bug in another slice's module gets a failing test and a report, not a silent fix.

## Plan

1. `fixture-wallet.mjs` and its unit test. Commit.
2. The live-flag browser run for Chikun first, then STACKED and HMH; commit the report.
3. The smokes, one commit per smoke family.
4. Import hygiene, with the full gate. Commit.
5. README and the receipt draft. Register new files in `scripts/syntax-check.mjs` immediately after `"scripts/smoke-portal-flow.mjs",`.

## Verification

```
node --test tests/fixture-wallet.test.mjs
PLAYWRIGHT_PACKAGE_PATH=… node scripts/ranked-live-browser-e2e.mjs --target local
# each smoke in acceptance 3 against python -m http.server 8809 --directory apps/portal
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
npm run vercel:build
```

## Pitfalls

- **Never commit a flag flip or a `deployed` address module.** The live-flag run works only on the temp copy.
- **Serve `apps/portal` itself as the web root** for the smokes (AGENTS.md); the static server has no `/api` and no rewrites, which is why the live-flag run uses `local-http.mjs`.
- **`VERCEL_ENV=development`** in the local stack, or sign-in from `127.0.0.1` is refused.
- **Chain time.** The server refuses a settle before `openedAt + run length − 30 s` (retryable). Short runs make this moot; if a run is long, `evm_increaseTime` on the local chain rather than waiting.
- **WalletConnect cannot be exercised** on localhost (not an allowed Reown host). The fixture wallet covers the EIP-6963 path; WalletConnect is checked live at runbook step 9.

## Definition of done

- The live-flag browser run passes for all three games locally, with its report committed.
- Every smoke in acceptance 3 passes in preview with a clean console.
- Import hygiene is done; the gate shows exactly 51 and `npm run vercel:build` is green. Do not commit the gate JSON.
- The final message lists the smoke and live-run commands for runbook steps 9-10.
