# Slice brief: profile-boards (wave 3, parallel with ranked-client, signin-entry, results-share and site-copy)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/profile-boards`, branch `fable/pd-profile-boards`, based on the integration branch after waves 1 and 2 have merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A6, A7, A20, A22, A23, A29, A32), §2.5, §4.3.4-§4.3.8 (including the E6 self view `&self=1`), §4.4 (the allowlisted `lastError` codes), §6.1-§6.3, §7.7 (including `lesters:ranked-pending` and `lesters:ranked-retry-request`), §7.8 (D10 retry, held tokens), §7.9 (hero gate ownership), §8.4, §9.1, §10.3 (your `main.js` ranges), §11, §14 (rows S6, C6, C11, C20, C21);
- guide §3.5, §5.7, §5.8, §5.6 item 7 (display), §5.4 item 4, and decisions D1-D4 and D10.

## Goal

1. Wallet-based, accurate profiles and leaderboards from the server index:
   - a public `/profile/<wallet>`;
   - on-chain name and avatar changes through `PlayerProfileRegistry`, with pre-checks so no transaction reverts;
   - a profanity and impersonation filter;
   - an optional name prompt after a player's first Ranked run.
2. The Scores page on `/api/leaderboard`: Weekly (default), Monthly and All-time, with reset times, verified transaction links, search, jump-to-rank and inviting empty states.
3. The clean slate (D4): no House Demo, no Local Preview tab, no client-pushed stats, and HMH character unlocks from verified counts.
4. In preview (`HOSTED_PROFILE_SYNC=false`), today's device-local views keep working, clearly labelled, with no network (A22).

## Acceptance criteria

1. **`apps/portal/src/index-api-client.mjs`** per §7.8. Every method short-circuits to `{ok:false, error:'offline-preview'}` when `hosted` is false. `profile(…, {self:true})` calls the distinct self URL `GET /api/profile?wallet=…&self=1` with the Bearer token (from `profileSync.session?.token`) and `cache:'no-store'`; the plain URL is CDN-cached and never carries preferences. `refreshProfile` sends the Bearer token when the wallet is the signed-in one. `retrySettle(sessionId32)` POSTs the retry body to `/api/settle` with the Bearer token.
2. **Routing (A6):**
   - `arcade-router.mjs` `viewForPath('/profile/0xabc…')` returns `{ step:'profile', gameSlug:null, sessionId:null, wallet:'0xabc…' }` (lowercase, valid hex40 only; the key is absent otherwise).
   - `routeForView('profile', { wallet })` returns `/profile/<wallet>`.
   - `portal-route-controller.mjs`: `setView` keeps a viewed wallet in the URL, and `applyLocation()` calls the hydrate hooks for `profile` and `leaderboards` (today it never does).
   - The existing `deepEqual` tests on 3-key shapes stay green.
3. **Profile page** (`routes/official-profile-route.mjs`, hosted mode). It renders for the viewed wallet (the connected wallet when the path has none) from E6. It shows:
   - the on-chain display name, or the short wallet, and the avatar resolved from `ARCADE_AVATARS`;
   - per-game best score and weekly, monthly and all-time ranks;
   - Ranked runs played;
   - recent verified sessions with explorer links (§4.3.6);
   - every achievement unlock, joined with the catalog for title, image and tier. **No NFT wording in phase 1** (A32). The "⛓ Soulbound NFT" badge and token link show only when `tokenId` is non-null (phase 2), and on that path only the profile confirms the holding with `fetchPlayerAchievements` over the public RPC (guide §5.6 item 7); a failed confirmation hides the badge, not the achievement.
   - a hidden or blocked name shows the short wallet; on the viewer's own profile a blocked name explains itself from the self view's `profile.nameBlocked` ("That name isn't allowed here. Choose another.").

   Edit controls appear only when the viewed wallet is the connected, authenticated wallet. "Share profile" copies `https://lestersarcade.io/profile/<wallet>`. The "device-local … not NFTs" copy (`official-profile-route.mjs:56`) is removed; preview mode says "Achievements earned on this device (preview)".

   **D10 retry (guide decision D10: auto-retry, retry button on the profile, no refunds).** On the viewer's own profile (self view), each recent session with status `failed` or `signed` and `retryable: true` shows a **Retry** button. It dispatches `lesters:ranked-retry-request` with that session id (ranked-client retries its handle when it holds one) and otherwise calls `indexApi.retrySettle(id)`, then re-reads the self view. When `lesters:ranked-pending` reports a count above zero, show "N runs saved on this device" with **Retry saved runs** (`lesters:ranked-retry-request` with `null`). A dead-lettered session (`retryable: false`, not confirmed) shows "This run could not be published. Testnet entries are not refunded." and no button. `lastError` codes map to plain words; never show a raw code.
4. **Name and avatar change.** Only when hosted **and** `LITVM_DEPLOYMENT.status === 'deployed'`; otherwise the existing local username editor stays. The flow:
   1. `normalizeHandle(raw)` (§7.8), which mirrors `PlayerProfileRegistry._normalizedHandle` byte for byte: trim spaces only, lowercase A-Z, charset `[a-z0-9 _.-]`, collapse space runs, 3-18 bytes;
   2. `moderateName(cleaned)` from `apps/portal/src/name-moderation.mjs`, which the **index slice created in wave 1** and the server also runs (A29). Import it; do not re-implement or edit it;
   3. `handleOwner(handleHash)` over the **public RPC**: taken by another wallet means "That name is taken", with no transaction;
   4. `estimateSetProfile` shows "Network fee about X zkLTC" before the wallet opens;
   5. `sendSetProfile({ displayName: cleaned, avatarUri })`, then wait;
   6. `POST /api/profile/refresh`, then dispatch `lesters:profile-changed`.

   Avatar picker: `ARCADE_AVATARS` (8-12 existing site images; `avatarUri = 'lestersarcade:avatar/<id>'`). Avatars and names change on chain together, through `setProfile`. Every wallet prompt comes from a button click.
5. **First-Ranked name prompt.** `name-claim-prompt.mjs` (lazy) listens to `lesters:ranked-run`. When hosted, the wallet has no on-chain name (a cached E6 response) and `preferences.nameClaimDismissed` is not true, it shows one small non-blocking toast "Claim your arcade name" with "Claim" (opens the profile name editor) and "Not now" (PUT `preferences.nameClaimDismissed = true`). Register the listener in your `:4894-5013` range.
6. **Leaderboard** (`routes/official-leaderboard-route.mjs` and `leaderboard-view.mjs`), hosted mode:
   - period tabs Weekly (default), Monthly and All-time, with no Daily and no Yearly. The API accepts `daily` for later; add a `LEADERBOARD_PERIODS` constant with a `daily:false` switch;
   - "Resets Monday 00:00 UTC" and "Resets on the 1st, 00:00 UTC", with relative time from `resetsAt`;
   - rows from E5, with 25 per page and "Show more" fetching page+1;
   - server-side search (`q`, debounced 300 ms);
   - jump-to-my-rank from `you`;
   - a per-row "⛓ verified" link to `explorerUrl`;
   - the banners stay;
   - empty state "Be the first on this week's board" with a **Play Ranked** button (opens mode select for that game);
   - loading and offline states;
   - rendering stays synchronous with an async fill (the hydrate hook fetches and re-renders).

   **No source tabs**: remove the House Demo and Local Preview tabs (`LEADERBOARD_SOURCE_TABS` in `leaderboard-seed.mjs:24-28`). `sourceForGame` no longer forces Chikun or STACKED to local (`official-leaderboard-route.mjs:85-89`), and the STACKED official empty state (`leaderboard-view.mjs:304-311`) is replaced by the generic inviting one (guide §5.4 item 4).
7. **Preview mode** (`!hosted`). The Scores page shows today's device-local board without tabs (local rows only, with "Preview · this device" notice copy). The Profile page shows today's device-local profile. There is no fetch and no RPC.
8. **Clean slate:**
   - remove the House Demo seed at `main.js:1804-1807` (`applySeedLeaderboard`), and ignore any stored `__seededLeaderboard` rows (filter by the seed provenance helper);
   - `profile-sync-client.mjs`: `buildProfileDocument` sends **preferences only**. `mergeRemoteProfile` no longer merges xp, run counts, achievements or run history (the spoofable fields, guide §5.7). `pull` reads the new E6 shape. Remove `settle()`: ranked-client no longer uses it (A3).
   - Remove `hydrateLeaderboardFromChain` and `hydrateProfileFromChain` from the route controller wiring (`:4771-4786`), replacing them with index-backed hydrate functions that are no-ops in preview. The 200-session chain scan is retired, and in preview this also removes today's RPC calls.
9. **Verified character unlocks.** You **own** `buildCharacterUnlockMap(profile, config, { verifiedRuns })` in `hmh-character-config.mjs` and its tests (contract §7.9). In hosted mode, Lester (5) and Lilly (10) use `verifiedRuns` (from `games['lester-blaster'].confirmedRuns` in E6), and local `unlocks.characters` flags and the local `getaway-clear` migration are ignored (D4). Preview mode keeps today's local logic. `tests/hmh-ranked-recruitment.test.mjs` stays green; add hosted-mode cases. The unlockables slice (wave 3b) only supplies a cached `verifiedRuns`; E3 enforces the same gates server-side for Ranked. Keep the `gate.count` values and the `unlockableCharacters` shape, which the server reads.
10. **Username rules.** `username-registry.mjs` `validateUsername` tab and newline handling is aligned with the contract. The on-chain editor always sends `cleaned` (tabs are invalid, not collapsed). Add a parity test that fuzzes 500 random ASCII names through `normalizeHandle` and a JS port of `_normalizedHandle`, checking they agree on validity and hash.

## Files

- **You own:** contract §10.2 row profile-boards, and the §10.3 ranges (`:292`, `:294`, `:1791-1830`, `:1844-1878`, `:4771-4786`, `:4894-5013`).
- **Read-only:**
  - `main.js` outside your ranges;
  - `mergeChainRecordIntoState` (`:4833-4891`, ranked-client);
  - the wallet functions (signin-entry);
  - the results screen and share links (results-share);
  - `apps/portal/src/name-moderation.mjs` (index; import only);
  - `ranked-settlement.mjs` (ranked-client; talk to it only through the `lesters:*` events, never import it, so there is one settlement client per page);
  - `server/**`, `api/**`, `sdk/**`, `apps/hmh-reboot/**`.

## Interfaces

- **Produced:** §7.8; the `lesters:profile-changed` event; `buildCharacterUnlockMap` with `verifiedRuns`; the `/profile/<wallet>` routing.
- **Consumed:** E5, E6, E7, E8 (index); §6.2 catalogs; §8.4 registry facts; the events `lesters:ranked-run` and `lesters:wallet-session`; `LITVM_DEPLOYMENT` (contracts).

## Plan

1. `index-api-client.mjs`, `profile-chain.mjs`, `arcade-avatars.mjs`, with tests:
   - `tests/profile-chain.test.mjs`: "normalizeHandle mirrors the contract for 500 fuzzed names" (a JS port of `_normalizedHandle` with `ethers.id` hashing); "availability check reads handleOwners through the public RPC"; "estimate and send return a tx hash and a wait function"; "moderation blocks the name before any wallet prompt". The chain tests can use a fake provider, or the contracts slice's local chain (`scripts/lib/local-chain.mjs`) for a real `setProfile` and `handleOwners` round trip.
   - `tests/index-api-client.test.mjs`: "offline preview never fetches"; "self profile uses the self URL with bearer and no-store"; "retrySettle posts the retry body with bearer".
2. Router and route controller (acceptance 2), with updated `tests/arcade-router.test.mjs` and `tests/portal-route-controller.test.mjs` (add "deep link to a wallet profile hydrates on load" and "setView preserves the viewed wallet").
3. Leaderboard route and view (acceptance 6-7). Update the pinned tests:

   | Test | Change |
   | --- | --- |
   | `tests/official-leaderboard-route.test.mjs` "leaderboard route restores default state…" | `cadence` default becomes `'weekly'` |
   | same file, "main delegates leaderboard rendering…" | keep `createOfficialLeaderboardRoute` and `const leaderboardRouteState =` |
   | `tests/leaderboard-view.test.mjs` | every copy test now describes hosted and preview states truthfully |
   | `tests/hmh-leaderboard-provenance.test.mjs` "leaderboard source tabs keep official, local, and house demo…" | now "hosted boards show only verified rows; preview shows only this device" |
   | `tests/arcade-core.test.mjs` "leaderboard page treats games and time windows as compact filters…" | keep the class names `leaderboard-filter-shell`, `leaderboard-game-filter`, `leaderboard-time-filter` |

4. Profile route (acceptance 3-5), with updated `tests/official-profile-route.test.mjs`. Keep `createOfficialProfileRoute(... documentRef: document` and the achievement-module `iconSrc` pins (`tests/hmh-achievement-atlas.test.mjs:104-109`). Add hosted-mode tests driven by an E6 fixture: "public profile renders another wallet read-only"; "own profile shows the on-chain name editor only when deployed"; "NFT badge only when a token id exists, confirmed on chain"; "own failed runs offer Retry and dead letters say no refunds"; "saved runs on this device offer Retry saved runs"; "a blocked name explains itself only to its owner".

   **Hosted leaderboard rendering** (`tests/official-leaderboard-route.test.mjs` or a new `tests/hosted-leaderboard.test.mjs`), from an E5 fixture: "the hosted leaderboard renders E5 rows with verified links"; "Weekly, Monthly and All-time tabs show their reset times"; "an empty board invites a Ranked run"; "Show more fetches the next page"; "search is debounced and server-side"; "jump to my rank uses you".
5. `profile-sync-client.mjs` changes, with `tests/profile-sync-client.test.mjs` updated. The "relayed settlement…" test is removed together with `settle()`; the remote-merge test asserts the spoofable fields are ignored.
6. `hmh-character-config.mjs` verified counts (acceptance 9).
7. The `main.js` ranges: seed removal, the profile sync block, route wiring, index-backed hydrate, and the name-prompt listener.
8. Register the new files in `scripts/syntax-check.mjs` immediately after `"apps/portal/src/arcade-router.mjs",`.

## Verification

```
node --test tests/profile-chain.test.mjs tests/name-moderation.test.mjs tests/index-api-client.test.mjs tests/hosted-leaderboard.test.mjs tests/arcade-router.test.mjs tests/portal-route-controller.test.mjs tests/official-*-route.test.mjs tests/leaderboard-view.test.mjs tests/hmh-leaderboard-provenance.test.mjs tests/profile-sync-client.test.mjs tests/hmh-character-config.test.mjs tests/hmh-ranked-recruitment.test.mjs tests/username-registry.test.mjs tests/arcade-core.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

**Browser**, with `apps/portal` as the web root (`python -m http.server 8806 --directory apps/portal`), both flags false:
1. The Scores page shows the local preview board with no tabs and no House rows.
2. The Profile page shows the local profile with the updated copy.
3. No `/api` or RPC requests in the Network panel, and a clean console.

The hosted views cannot run against a static server. Cover them with fixture-driven route tests, and optionally with a temporary local override of the `hosted` dependency in DevTools (never committed).

## Pitfalls

- **`/profile/<wallet>` 404s on `python -m http.server`** (no SPA fallback). Test deep links in unit tests; the index slice already added the Vercel rewrite.
- **The route controller's `syncRoute` pushes `routeForView(step)`**, which drops the wallet today. Fix it there, not in `main.js`.
- **On chain, `displayName` is raw and `avatarUri` unbounded.** Always render the index's sanitized values, never raw chain strings.
- **Tabs and non-ASCII revert on chain** (`Invalid handle char`). Validate before the wallet opens.
- **`profile.unlocks.characters[id] === true` is sticky today**, and `getaway-clear` unions from the remote document. Both paths must be ignored in hosted mode.
- **Keep the leaderboard render synchronous.** Several tests render and assert without awaiting.
- **The Chikun smoke asserts** the Scores board labels (`COINS`, `CLEARED`, `NEAR MISS`) and the profile text `/Device-local.*SCORE SOURCE/`. Keep those labels in preview mode where they are still true, and otherwise list the outdated assertions for the browser-e2e slice.

## Definition of done

- Acceptance criteria 1-10 hold, with preview parity verified.
- The gate shows exactly 51. Do not commit the gate JSON.
- The build passes and the syntax-check entries are added.
- The final commit message lists the smoke assertions now outdated.
