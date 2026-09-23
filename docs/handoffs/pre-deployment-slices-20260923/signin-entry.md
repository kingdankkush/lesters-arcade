# Slice brief: signin-entry (wave 3, parallel with ranked-client, results-share, profile-boards and site-copy)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/signin-entry`, branch `fable/pd-signin-entry`, based on the integration branch after waves 1 and 2 have merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A13, A17, A18, A22, A25, A27), §2.4, §2.7, §4.3.1-§4.3.2, §4.3.13 (E15), §4.5 (CSP, especially `frame-src`), §7.1 (`applySeedTicket`), §7.6, §7.7, §8.3, §9.1, §10.3 (your `main.js` ranges), §11, §14 (rows S1, S17, F7, C20);
- guide §3.1, §3.2, §5.9, §5.10, decision D9, and §1.1 (the Reown project id).

## Goal

Sign-in is one button and is mobile-first:
- a wallet picker (EIP-6963, MetaMask and Rabby featured, install links, deep links, lazy WalletConnect via Reown AppKit);
- LiteForge add or switch at sign-in, with one explainer;
- plain-language SIWE with a server nonce, and silent re-auth for 24 h;
- a balance chip with the faucet.

The Ranked entry is seamless: a background pre-flight with a cached quote, one confirmation, the run starting on broadcast with a confirming chip, and a specific message plus retry for each failure.

## Acceptance criteria

1. **Modules** (`apps/portal/src/`), all loaded with `import()` from your `main.js` ranges, never statically:
   - `wallet-config.mjs` (§7.6);
   - `wallet-session.mjs` (§7.6 API);
   - `wallet-picker.mjs` with a pure `buildWalletPickerModel({ providers, isMobile, host, remembered })` and `openWalletPicker({ documentRef, model, onPick })`. It sits over the page, traps focus, closes on Escape, works at 320 px, and its buttons are at least 44 px and within thumb reach;
   - `walletconnect-provider.mjs`, which returns an EIP-1193 provider from `@reown/appkit` + `@reown/appkit-adapter-ethers`. It is created only when the player picks WalletConnect, only on `REOWN_ALLOWED_HOSTS`, with a custom LiteForge network (4441, `https://liteforge.rpc.caldera.xyz/http`, explorer `https://liteforge.explorer.caldera.xyz`), `features: { analytics:false, email:false, socials:false }` and `projectId = REOWN_PROJECT_ID`;
   - `ranked-preflight.mjs` (§7.6);
   - `apps/portal/src/styles/wallet-picker.css`, injected as a `<link>` by the picker.
2. **Picker rules:**
   - Installed EIP-6963 wallets are listed with MetaMask (`io.metamask`) and Rabby (`io.rabby`) first.
   - With neither installed there are install links, and on mobile the deep links (MetaMask, Trust). Add a Rabby mobile deep link only if you can confirm a documented universal link; otherwise omit it.
   - WalletConnect is shown only on `REOWN_ALLOWED_HOSTS`.
   - The existing simulated-wallet fallback (local QA) stays **only** when there is no injected provider, no EIP-6963 announcement and WalletConnect is unavailable. That keeps `scripts/hmh-simulated-wallet-browser-smoke.mjs` valid on localhost.
   - A player who declines `eth_requestAccounts` stays signed out with a clear message. This removes the mock fallback at `main.js:6278`.
3. **Chain at sign-in.** After accounts are granted, one explainer, then `wallet_switchEthereumChain` 0x1159, falling back to `wallet_addEthereumChain` on 4902 (reuse `requestLiteForgeNetwork`). This replaces the deferral at `main.js:6248`. A refusal keeps the player signed in for Free play, and the Ranked modal still offers the switch.
4. **SIWE (A13).** When `HOSTED_PROFILE_SYNC` is true: `GET /api/session/nonce` (`cache:'no-store'`), then `buildSiweChallenge({ domain: location.hostname, address, chainId: 4441, nonce, issuedAt: <server issuedAt> })`, then `personal_sign`, then `profileSync.login({ challenge, signature })`, **awaited**. `walletAuthenticated` is true only on `ok`.
   - When false: today's local challenge and `ethers.verifyMessage` path, with no network.
   - The statement text comes from the shared `SIWE_STATEMENT` (already changed by settle). Never pass a custom statement.
   - Dispatch `lesters:wallet-session` after every sign-in, restore and sign-out.
5. **Silent re-auth.** On boot, right after `bindWalletProviderEvents(detectEthereumProvider());` (`:15056`), when `walletSession.remembered()` exists:
   - **injected or EIP-6963 kinds:**
     1. find that provider (wait at most 500 ms for EIP-6963 announcements);
     2. call `eth_accounts` (never `eth_requestAccounts`);
     3. if the account equals the remembered wallet and `profileSync.hasSession(wallet)` is true (hosted), or the local session flag is set (preview), restore `connectedWallet`, `connectedProvider`, `walletConnector='injected-evm'` and `walletAuthenticated=true` without any prompt.
   - **`walletconnect` kind: never create AppKit during boot** (no WalletConnect relay connection in Free Mode, guide rule 3). With a live token for the remembered wallet, restore `connectedWallet` and `walletAuthenticated=true` with `connectedProvider = null` and a "provider pending" flag; create the WalletConnect provider lazily on the first action that needs the wallet (Sign in, the Ranked entry, a profile write).

   Otherwise stay signed out quietly.
6. **Provider plumbing.** Add a `main.js` global `connectedProvider` (inside `:1833-1843`). `detectEthereumProvider()` returns `connectedProvider ?? eip6963Registry.preferred()?.provider ?? globalThis.ethereum`. WalletConnect sessions use `walletConnector = 'injected-evm'` (§7.6), so the existing guards keep working. Remember `{kind, rdns, wallet}` via `walletSession.remember`.
7. **Balance chip** (live only; it reads balance over the **public RPC**) in the nav and the Ranked modal: `0.1234 zkLTC` plus "Get zkLTC" linking to `https://liteforge.hub.caldera.xyz` when below `entryTotal + gas`. Free Mode stays one click away.
8. **Background pre-flight** (live only). `renderOfficialModeSelect` (`:5385-5397`) calls `rankedPreflight.start({ gameId: selectedGameId, wallet, walletProvider })` **after** the pinned `officialPlayRoutes.renderModeSelect(); hmhChallengeUi.render(selectedGameId)` pair, when a wallet is connected and authenticated.
   - Reads use the public RPC (`quoteEntry`, gate, balance). The only wallet call is `eth_chainId`.
   - `requestRankedEntry` shows the cached quote at once (`peek`), then refreshes.
   - `checkRankedReadiness` `needWei` includes `entryTotalWei` plus a gas estimate (today it omits the fee: `litvm-chain-client.mjs:453-465`).
   - The unfunded guard copy no longer describes preview mode (`:5646`).
9. **Entry (A17, A25).**
   - Add `sendRankedEntry` to `litvm-chain-client.mjs` (§7.6), returning after broadcast. `openRankedSession` becomes a wrapper that awaits `wait()`.
   - **Seed ticket first (live only).** In `onApprove`, before building the identity: `POST /api/ranked/seed` with the Bearer token and `cache:'no-store'`, body `{ gameId, sessionId, seasonId, buildHash }` from the pending session; then `applySeedTicket(pendingSession, response)` (§7.1). The game has not mounted yet (`startOfficialMode` mounts it after `requestRankedEntry` resolves), so the run uses the ticket seed. A 503 (`settlement-paused` or `settlement-not-configured`) shows "Ranked is paused right now. Free Mode is open." and resolves false with **no wallet prompt**; a 401 re-runs sign-in once. You may prefetch the ticket when the modal opens, as long as it is applied before the key is computed; refetch it if it is older than 10 minutes at approval, because the server rejects a ticket used more than 30 minutes after issue (`seed-ticket-stale`, A26) and that would strand a paid run. Preview never calls E15.
   - `requestRankedEntry` `onApprove` then uses `rankedIdentityFor(pendingSession, { scoreRegistryAddress: LITVM_CONTRACT_ADDRESSES.scoreSubmissionRegistry })` (A10; this replaces `:5578`), then `rankedSessionKey`, then `sendRankedEntry`. It sets `pendingSession.entryReceipt` and `pendingSession.entryConfirmed` exactly as §7.6, dispatches `lesters:ranked-entry` (`broadcast`, then `confirmed` or `failed`), and resolves on broadcast so the run starts.
   - A small "Entry confirming…" chip (a lazy module) listens for the event and turns green on `confirmed`. On `failed` it shows "Entry didn't go through. This run is practice and won't be ranked."
   - Never open a wallet prompt from inside a game canvas input handler. Every prompt comes from a DOM button click.
10. **Errors.** `classifyWalletError` drives exactly one message and one action per kind:

    | Kind | Message | Actions |
    | --- | --- | --- |
    | user-cancelled | "You cancelled in your wallet. Nothing was charged." | Try again |
    | wrong-network | "Your wallet is on another network." | Switch to LiteForge |
    | insufficient-funds | "You need about {total} zkLTC. Balance {bal}." | Get zkLTC, Re-check |
    | missing-wallet | — | the picker |
    | wallet-error | the short message | Try again |

    The `user rejected` regex in `main.js:3144-3161` belongs to ranked-client and is removed there; do not duplicate it.
11. **Modal copy and values.** `index.html:63-81`, `:104-105`:
    - the button label becomes "Sign in";
    - the modal shows entry `0.1 zkLTC`, settlement reserve `0.002 zkLTC` ("pays the relayer that publishes your score on LitVM"), and the total `0.102 zkLTC` (quoted live by `quoteEntry`);
    - the split "85% to the game's developer · 15% to the arcade";
    - a "Free Mode is always free" link;
    - one confirmation button;
    - readable at 320 px.

    `RANKED_SETTLEMENT_GAS_RESERVE_WEI` (`arcade-core.mjs:108`) is ALREADY `'2000000000000000'` (0.002 zkLTC, orchestrator commit after the 2026-09-23 owner decision) and its pins are already updated; do not change it. Previously this step said: change it to `'100000000000000'`, and update its pins: `tests/settlement.test.mjs:118-121`, `tests/arcade-core.test.mjs:528-529,552`, and the modal-quote test in `tests/ranked-entry-preflight.test.mjs`. Do **not** touch `DEFAULT_SETTLEMENT_GAS_RESERVE_WEI` in `scripts/deploy-contracts.mjs`: it is pinned, and the config overrides it.
12. **CSP** (`vercel.json`, the portal catch-all rule only). Add the Reown and WalletConnect hosts to `connect-src`, `img-src` and `font-src`, taken from Reown's current CSP documentation (fetch it; do not guess), and record the doc URL in the commit message. **`frame-src` does not exist in that rule today**: frames fall back to `default-src 'self'`, which is what lets the `/hmh-reboot/`, `/chikun/` and `/stacked/` game iframes load. Add it as `frame-src 'self' <reown hosts>`. Without `'self'` all three games break in production only, because the local static server sends no CSP. `script-src` is unchanged (AppKit is bundled). Update `tests/vercel-security-headers.test.mjs`: the new hosts are present, `frame-src` starts with `'self'`, and no remote script origin is allowed.
13. **Preview parity.** With both flags false:
    - no `/api/*` calls, no RPC calls, no Reown load unless the player explicitly picks WalletConnect on an allowed host;
    - the Ranked modal behaves as today (local preview text pinned by `tests/ranked-entry-preflight.test.mjs` "local preview preserves no-network behavior…", regex `/local ranked testnet preview/i`);
    - the console is clean.

## Files

- **You own:** contract §10.2 row signin-entry, and the §10.3 ranges. Also `arcade-core.mjs:108` only, and `tests/settlement.test.mjs` / `tests/arcade-core.test.mjs` reserve lines only.
- **Read-only:**
  - `main.js` outside your ranges;
  - `profile-sync-client.mjs` (profile-boards; use its existing `login` / `hasSession` / `session` API);
  - `ranked-identity.mjs`;
  - `server/**`, `api/**`, `sdk/**`, `apps/hmh-reboot/**`.

## Interfaces

- **Produced:** §7.6 (the session fields `entryReceipt` and `entryConfirmed`, `wallet-session`, the pre-flight); the events `lesters:ranked-entry` and `lesters:wallet-session`; the `connectedProvider` global.
- **Consumed:** E1 and E2 (settle); §7.1 `rankedIdentityFor` and `rankedSessionKey`; `LITVM_CONTRACT_ADDRESSES`, `LITVM_DEPLOYMENT` (contracts).

## Plan

1. **Build spike first.** Add a throwaway dynamic import of `walletconnect-provider.mjs`, run `node build.mjs --metafile` (check that `build.mjs` supports it; if not, inspect `apps/portal/dist/chunks` sizes). Confirm that:
   - AppKit lands only in lazy chunks, not `dist/main.js`'s static graph;
   - `hmh-reboot/game.js` initial JS is unchanged;
   - the build succeeds through the HMH Pixi bare-specifier plugin.

   If AppKit pulls npm `ethers` as a second copy, that is acceptable only inside the lazy chunk. Record the chunk sizes in the commit message.
2. `wallet-config.mjs`, `wallet-session.mjs`, with tests (`tests/wallet-session.test.mjs`):
   - "hosted sign-in fetches a server nonce and uses its issuedAt";
   - "preview sign-in stays offline";
   - "silent restore needs the same wallet and a live token";
   - "a remembered WalletConnect session restores without creating AppKit";
   - "sign-out clears the token and the remembered connector";
   - "events announce session changes".
3. `wallet-picker.mjs` (pure model plus the DOM), with tests (`tests/wallet-picker.test.mjs`):
   - "MetaMask and Rabby are featured first";
   - "install and deep links appear when no wallet is present on mobile";
   - "WalletConnect only on allowed hosts";
   - "simulated fallback only when nothing is available".
4. `ranked-preflight.mjs` and the `litvm-chain-client.mjs` changes, with tests (`tests/ranked-preflight.test.mjs`):
   - "preflight caches per game and wallet for sixty seconds";
   - "funds check includes the entry total";
   - "reads go through the public RPC, not the wallet";
   - "sendRankedEntry resolves on broadcast and reports confirmation later".

   And `tests/ranked-entry-flow.test.mjs` (pure helpers extracted from your `main.js` range, or a VM-executed test):
   - "each wallet error kind maps to one message and one action" (acceptance 10's table);
   - "sign-in switches to 4441 once, with the explainer" (acceptance 3, including the refusal path that keeps Free play);
   - "the entry chip goes pending, then confirmed or failed" (acceptance 9);
   - "live entry fetches and applies a seed ticket before computing the key";
   - "a paused seed service stops the entry before any wallet prompt".

   Use a fake EIP-1193 plus a fake ethers, or the contracts slice's local chain (`scripts/lib/local-chain.mjs`) for a true `openSession` broadcast and receipt.
5. The `main.js` ranges (acceptance 3-11). Update `tests/ranked-entry-preflight.test.mjs` (VM whitelist: add each new identifier your executed paths use, and keep every existing test's intent). Keep the literals `detectEthereumProvider`, `checkRankedReadiness`, `requestLiteForgeNetwork` (`scripts/hmh-security-audit-sweep.mjs`) and `rankedEntryApprove`.
6. `index.html`, CSS, CSP and the tests. The site-copy slice edits other parts of `index.html` in parallel (head meta, the scores section and the FAQ), so stay inside `:63-81` and `:104-105`. After editing `index.html`, run `node scripts/build-portal-pages.mjs` and commit its outputs (contract §10.4 rule 8); if they conflict with site-copy's at merge, the orchestrator regenerates them.
7. Register the files in `scripts/syntax-check.mjs` immediately after `"apps/portal/src/wallet-auth.mjs",`.

## Verification

```
node --test tests/wallet-*.test.mjs tests/ranked-preflight.test.mjs tests/ranked-entry-preflight.test.mjs tests/ranked-entry-flow.test.mjs tests/vercel-security-headers.test.mjs tests/settlement.test.mjs tests/arcade-core.test.mjs tests/litvm-ranked-contract-gate.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
node scripts/hmh-security-audit-sweep.mjs
```

**Browser**, with `apps/portal` as the web root (`python -m http.server 8804 --directory apps/portal`):
1. With no wallet: the simulated fallback is unchanged, and the console is clean.
2. With a real MetaMask or Rabby in desktop Chrome: the picker lists it; sign-in switches the chain and signs once. Reload: signed in silently, with no prompt.
3. Ranked modal at 320 px (DevTools), in the preview copy.
4. Optionally run `PLAYWRIGHT_PACKAGE_PATH=C:/Users/just_/lesters-arcade-fable0916/benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs HMH_PORTAL_ORIGIN=http://127.0.0.1:8804 node scripts/hmh-simulated-wallet-browser-smoke.mjs`.

WalletConnect cannot be exercised on localhost (not an allowed Reown domain). The live check happens at deployment.

## Pitfalls

- **`tests/hmh-challenge-ui.test.mjs` pins the render order** inside `renderOfficialModeSelect` and `hmhChallenge: hmhChallengeUi.requestFor(selectedGameId, normalizedMode)`. Add code only after the pinned calls.
- **The Chikun Ranked smoke's stub provider throws** on `eth_call`, `eth_blockNumber`, `eth_sendTransaction` and `eth_estimateGas`. Keep every such call behind `SETTLEMENT_LIVE`, and keep the pre-flight reads on the public RPC.
- **The SIWE `domain` is `location.hostname`** (no port). The server allows localhost only outside production.
- **`buildSiweChallenge` lowercases the address** in the challenge, but the message keeps the checksummed address the wallet presented. The server rebuilds from the message's address line (`server-session.mjs:32-35`). Pass the address exactly as the wallet returned it.
- **Name the Reown constant `REOWN_PROJECT_ID`.** The security sweep regex flags `*_API_KEY`-style literals.
- **AppKit must not be statically reachable from `main.js`.** Keep every Reown import inside `walletconnect-provider.mjs`, loaded with `import()`.
- **Do not touch the settlement, results or profile code.** Coordinate only through the session fields and events.

## Definition of done

- Acceptance criteria 1-13 hold, with preview parity verified in the browser and by tests.
- The gate shows exactly 51. Do not commit the gate JSON.
- The build passes with the AppKit chunk lazy. The syntax-check entries are added.
- The final commit message lists the lazy chunk sizes, the CSP host list with its source URL, and the smoke assertions now outdated (for the browser-e2e slice).
