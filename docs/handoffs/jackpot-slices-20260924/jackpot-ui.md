# Slice brief: jackpot-ui (wave J2, parallel with jackpot-server; rebases after it merges)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/jackpot-ui`, branch `fable/jackpot-ui`, based on the integration commit with jackpot-contracts merged **and polish-2 merged** (design §G wave J0; polish-2 edits `portal-content.mjs`, `hosted-leaderboard-view.mjs`, `hosted-profile-view.mjs`, `game-manifest.mjs`, generated pages and the byte baselines). If version-column is still in flight, it merges before this slice (it edits both hosted views). Before your final gate, rebase onto the commit that merges jackpot-server. Junction `node_modules`; never run `npm install`.

**Revision 2 (2026-09-24)** applies three reviews (design Appendix K). The main changes for this slice:
- an import-free `jackpot-config.mjs`;
- surfaces show `prizeWei` (the capped prize), and only when `pot.funded`;
- an Age-corrected clock with client-side close detection;
- jackpot-leader-based results copy and the label "Jackpot lead (pending)";
- the open-week leader shows its score only;
- the Chikun child gets live detail copy and the **stock-view cap and draw cull** (anti-cheat);
- entry-modal fixes;
- a Claim button;
- 16 marked rules-page sections with local times;
- soft-launch honesty copy;
- the owner page draws the server-computed timeline and gains finalize, reinstate, flag, unblock, `adminSubmit` and refund;
- budgets measured after polish-2 with a deployed-shaped module;
- the curated inventory is regenerated.

**Read first:**
- the design `docs/game-design/chikun-weekly-jackpot-design-20260924.md`: §0, §A.3 (who can do what, for the owner page), §A.7-§A.10, §B.3 items 6-9, §B.4 (the view-cap paragraph), §C.5-§C.7 (**the API you build against**), §D (all), §E steps E9-E10 and the admin review rubric, §F items 1-4, §G, Appendix K rows F4-F23 and AC2.
- the contract: §7.3-§7.5, §9.1, §10.4 rule 8 (generated pages), §11 rules 5-7 and 10-11.
- the code:
  - `apps/portal/src/portal-content.mjs` (`noValue` `:79`, `serverRecords` `:103-111`), `scripts/build-portal-pages.mjs`, `apps/portal/index.html` (entry modal `:63-83`)
  - `apps/portal/main.js`: `requestRankedEntry` (≈`:5869`), `renderOfficialModeSelect` (≈`:5723`), and the block before `// Initial paint honors the URL` (≈`:16244`)
  - `apps/portal/src/routes/{official-play-routes,hosted-leaderboard-view,hosted-profile-view,lazy-routes}.mjs`, `apps/portal/src/leaderboard-view.mjs` (`formatResetCountdown` `:53`)
  - `apps/portal/src/ranked-results.mjs` (stylesheet loader `:30-50`, `readStanding` `:412`), `apps/portal/src/ranked-results-model.mjs` (`:165`, `:286`), `apps/portal/src/share-links.mjs` (read-only)
  - `apps/chikun/src/main.mjs` (`resizeFlightViewport` `:37-43`, `renderModeTease` `:374`, draw loop `:653`, replay import `:955-960`), `apps/chikun/src/viewport.mjs`, `apps/chikun/src/presentation.mjs:5-15`, `apps/chikun/src/replay-viewer.mjs`, `apps/chikun/src/replay-file.mjs`, `apps/portal/chikun/game.css:8`
  - `apps/portal/owner/confirm-dev-wallet.*`, `apps/portal/src/liteforge-fees.mjs`, `apps/portal/src/generated/litvm-jackpot.mjs`

**Hard safety rule:**
- `JACKPOT_LIVE` stays literal `false` in every commit. Throwaway flips in a temporary copy that is never committed are allowed.
- No chain writes except to the in-process chain in tests. No Vercel changes. Never read the vault.

## Goal

Put the Weekly Jackpot where it drives Ranked play (design §D.3), without claiming anything that is not funded on chain or payable this week:
- the Chikun mode select;
- the Chikun cabinet start screen;
- the Ranked entry modal;
- the results screen;
- the Scores page (with winners history);
- the profile (with Claim);
- the home page;
- share labels;
- a public rules page;
- the owner review and funding page.

Also close the CSS look-ahead cheat in the Chikun child (design §B.4). Everything else is lazy, flag-gated and inside the byte budgets.

## Acceptance criteria

1. **Flag module** `apps/portal/src/jackpot-config.mjs` (design §D.1):
   - `export const JACKPOT_LIVE = false;`, `JACKPOT_GAMES`, `JACKPOT_RULES_PATH`;
   - **no imports at all** (it does not re-export `LITVM_JACKPOT`; only the lazy jackpot chunks and the owner page import the generated module);
   - invariant test (importing both): `JACKPOT_LIVE ⇒ SETTLEMENT_LIVE && LITVM_JACKPOT.status === 'deployed'`.
2. **With the flag false, the product is unchanged except for the named honesty lines:**
   - no request to `/api/jackpot` from any surface (test: fetch spies over each loader);
   - `node scripts/build-portal-pages.mjs` produces byte-identical `index.html`, `discover/**`, `trust.html`, `llms.txt` and `sitemap.xml` against the post-polish-2 base, **except** the new hidden containers of item 5 (hidden and empty), the soft-launch `noValue` line and the `serverRecords` addition (design §D.6). Name every changed pin in the commit;
   - the Chikun child still shows `CHIKUN_REWARDS_TEASE` and its current detail line (pinned by `tests/chikun-regions.test.mjs:145-146`).
3. **Shared client modules** (design §D.2): `apps/portal/src/jackpot/jackpot-client.mjs` (`fetchJackpot`, `parseJackpot`, `formatTokenAmount`, `serverClock` using `serverTime` + the `Age` header, `phaseOf` deriving open/closed from `closesAt` on the corrected clock, `countdownParts`; 4 s timeout; 30 s memo; pure, with fetch and clock injected), `jackpot-view.mjs`, and `apps/portal/src/styles/jackpot.css`, loaded lazily through a `link[data-jackpot-css]` in retro arcade styling. `parseJackpot` rejects anything that deviates from design §C.5 rev. 2 and returns `null`.
4. **Honesty rules** (design §D.1), tested per surface:
   - an amount appears only when `live === true` and `current.pot.funded === true`;
   - the amount is `prizeWei`; with `carryOverWei > 0`, Scores, rules and mode select add "up to {cap}; the rest rolls over" (tested with a cap fixture);
   - every amount carries the symbol of its own week, and the first mention adds "(testnet token, no value)" while that token is a testnet token;
   - the leader is always "provisional" or "pending review" until `paid`; the open-week leader shows a score only;
   - weeks are local date ranges, never ISO keys; close times show local time next to UTC;
   - failure or timeout renders nothing;
   - amounts are formatted with BigInt only.
5. **Placements** (design §D.3, with the exact files and budgets there):
   - the mode-select marquee;
   - the Chikun child start-screen line **and detail line** (live funded, live unfunded) through an additive `buildChikunJackpotTease(api)` in `presentation.mjs`, and the `?replay=` deep link (strict same-origin regex `^/api/jackpot/replay\?session=0x[0-9a-f]{64}$`);
   - the entry-modal hidden row `#rankedEntryJackpot` (Chikun only; "Entries don't fund the prize"; Rules link in a new tab with `rel="noopener"`; hidden when the quote is below `current.rules.minPaidWei` or after `closesAt`; the last-5-minutes next-week note; never blocking payment);
   - the results-screen line based on `current.leader` and the run's own eligibility (never the board rank), and the `standingLabel: 'Jackpot lead (pending)'` pass-through through `ranked-results-model.mjs` (**`share-links.mjs` untouched**);
   - the Scores page header and "Past winners" list for Chikun · Weekly (with "Claim pending"), the board-vs-jackpot eligibility note, and the board's "resets in" countdown on the same corrected clock when the header is shown;
   - the profile "Jackpot Champion" section from `profile.jackpot.wins`, with a **Claim** button for the connected winner of a `claim-pending` week (`claim(week, to)`, `to` editable, the 180-day notice);
   - the home promo in a hidden `#jackpotPromo` section.
6. **Chikun stock view (anti-cheat; not flag-gated)** (design §B.4, §D.3):
   - `buildChikunViewport` caps the landscape logical width at 1,280 (portrait unchanged); a wider CSS box letterboxes (for example `object-fit: contain` on the canvas, or drawing into a centred 16:9 region);
   - the draw loop skips forks with `x > view.left + view.width + 40`;
   - `scripts/lib/chikun-bots.mjs` and the difficulty harness results are unchanged (they use 1280 × 720 and portrait sizes); prove it by re-running the harness fixture test;
   - test `tests/chikun-stock-view.test.mjs`: for CSS boxes of 16:9, 21:9, 32:9 and 4:3, no fork is drawn beyond logical x = 1,320 (the 1,280 edge plus the 40 px margin) in landscape, and `buildChikunViewport` returns the same object as before for 16:9 and every portrait size.
7. **Rules page** `/jackpot/chikun` (design §D.4):
   - `apps/portal/jackpot/chikun.html` + `apps/portal/jackpot/chikun-rules.mjs` (module only; no inline script);
   - copy blocks come from `portal-content.mjs` `jackpotRulesCopy(flags)`, rendered by `build-portal-pages.mjs`, with **the 16 section markers** of design §D.4;
   - local-time rendering of the close and payout times in the lazy module;
   - while the flag is false: noindex, the soft-launch banner, and not in the sitemap;
   - when true: indexed, and listed in `sitemap.xml` and `llms.txt`;
   - the legal block uses the owner-requested draft in design §F.1 verbatim, with an adjacent HTML comment `<!-- LEGAL-REVIEW-PENDING: owner confirms at E10 -->` so the guard still blocks a live flip until the owner confirms the text (then the comment is removed in the E10 commit).
   - **Guard test:** building with `chikunJackpotLive:true` fails if the built rules page still contains `LEGAL-REVIEW-PENDING` **or lacks any section marker** (the test uses a fixture legal text to show the success path).
8. **Copy plumbing** (design §D.6):
   - `portalCopyFor({ …, chikunJackpotLive })`;
   - `PORTAL_FLAGS.chikunJackpotLive`;
   - `resolvePortalFlags` accepts the optional third boolean (default false) and keeps every existing error message;
   - `PORTAL_FLAG_OVERRIDES.jackpot`;
   - the flag-false soft-launch `noValue` line and the `serverRecords` addition (seed-ticket log, jackpot review data, published replays);
   - the live copy for `noValue`, the FAQ entry, `trustStatus` and `llmsScope`, tested with the override.
9. **Owner page** `apps/portal/owner/jackpot.html` + `jackpot.mjs` + `jackpot-review-model.mjs` (design §D.5):
   - it **never imports** the Chikun runtime, `chikun-cabinet.mjs` or anything that imports `obstacle-shapes.json` (they cannot load unbundled);
   - the gate on the on-chain `admin()`; both pause flags shown;
   - SIWE sign-in through the existing session flow to read `/api/jackpot/review`;
   - the week view (local time and UTC) and candidate table, including evidence delay, provenance, `adminReviewed` and the `nextEligible` list;
   - the flap-timeline SVG drawn from the review API's `timeline` (with the look-ahead overlay and fast-pair marks);
   - "Watch in cabinet" and "Download replay";
   - admin actions: clear, flag, disqualify (session, or session + wallet for the week, with a reason including `multi-wallet`), reinstate, `adminSubmit` (enabled only below 5 rows), block and unblock, hold or release, extend with the remaining cap shown, pause or unpause, finalize (any wallet once due). Each is preceded by `checkEligibility` or a state read and followed by an explorer link; a rubric link sits next to Clear and Disqualify;
   - a Fund section for any wallet (exact `approve`, then `fund`; ≤ 8 weeks ahead with "fund at most 2 weeks ahead" advice; `minFundWei` shown), and "Refund my contributions" after a scheduled end;
   - Claim for a connected `claim-pending` winner;
   - `liteForgeFeeOverrides` for every write;
   - noindex; CSP-safe (module only; DOM through `createElement`/`textContent`); works at 320 px.
10. **Byte budgets** (design §D.3 totals), measured on the post-polish-2 base with a **deployed-shaped fixture** `litvm-jackpot.mjs` swapped in for the measurement only:
    - `dist/main.js` ≤ +600 B;
    - HMH child +0 B;
    - STACKED entry +0 B;
    - Chikun child ≤ +1,500 B (including the stock-view cap and cull);
    - each jackpot chunk within its row's limit.
    Measure with `node build.mjs` before and after, and record the deltas in the final commit message.
11. **Curated inventory.** Regenerate with `npm run assets:hmh:curated-level-kit-runtime` after adding `apps/portal/src/**` modules and commit it; on a conflict, regenerate, never hand-merge.

## Files

**You own:**
- C `apps/portal/src/jackpot-config.mjs`, `apps/portal/src/jackpot/*.mjs`, `apps/portal/src/styles/jackpot.css`
- C `apps/portal/jackpot/chikun.html`, `apps/portal/jackpot/chikun-rules.mjs`
- C `apps/portal/owner/jackpot.html`, `apps/portal/owner/jackpot.mjs`, `apps/portal/owner/jackpot-review-model.mjs`
- C `tests/fixtures/jackpot/*.json` (copied from the design §C.5 examples: open-funded, open-funded-capped, open-unfunded, open-below-min-fund, review-with-candidates, claim-pending, paid-history-two-tokens, not-live, review-api-with-timeline)
- C `tests/jackpot-ui-*.test.mjs`, `tests/owner-jackpot-page.test.mjs`, `tests/chikun-stock-view.test.mjs`
- E `apps/portal/src/portal-content.mjs` and `scripts/build-portal-pages.mjs`, with their regenerated outputs (`index.html` meta and copy blocks, `discover/**`, `trust.html`, `llms.txt`, `sitemap.xml` only if the builder changes it, and the new rules page)
- E `apps/portal/index.html`: one hidden row in `.ranked-entry-rows` and one hidden `#jackpotPromo` section
- E `apps/portal/main.js`: glue only, inside `requestRankedEntry`, the home-route render, and the block before `// Initial paint honors the URL`; each a one-line dynamic `import()` loader gated by `JACKPOT_LIVE`
- E `apps/portal/src/routes/official-play-routes.mjs` (one loader line in the Ranked mode-copy application for `chikun`), `routes/hosted-leaderboard-view.mjs`, `routes/hosted-profile-view.mjs`
- E `apps/portal/src/leaderboard-view.mjs` (only to accept an injected corrected clock in `formatResetCountdown`, default unchanged)
- E `apps/portal/src/ranked-results.mjs` (a nested lazy import) and `apps/portal/src/ranked-results-model.mjs` (the `standingLabel` override), with `tests/ranked-results-model.test.mjs`
- E `apps/chikun/src/main.mjs` (`resizeFlightViewport` if needed, the draw-loop cull, `renderModeTease`, and the `?replay=` import only), `apps/chikun/src/viewport.mjs` (the landscape cap), `apps/chikun/src/presentation.mjs` (additive `buildChikunJackpotTease` only)
- E `apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-runtime.mjs` (regenerated)
- E the tests pinning any text you change (the soft-launch `noValue` line, `serverRecords`); name each in the commit
- E `scripts/syntax-check.mjs` (after `'tests/ranked-results-model.test.mjs',`)

**Read-only:**
- `apps/portal/src/share-links.mjs`, `apps/hmh-reboot/**`, `apps/stacked/**`, `sdk/**`, `scripts/lib/chikun-bots.mjs`
- `server/**`, `api/**`, `vercel.json` (jackpot-server owns the `/jackpot/chikun` rewrite), `contracts/**`
- `apps/portal/owner/status.mjs` (jackpot-server)
- every `tests/jackpot-server-*`, `tests/jackpot-rehearsal*`, `tests/jackpot-api-contract*`, `tests/jackpot-live-dry-run*` and `tests/jackpot-deploy-tooling*` file

## Interfaces

- **Consumed:**
  - `GET /api/jackpot` (design §C.5 rev. 2);
  - `GET /api/jackpot/replay?session=` (the replay-file-v1 format of `apps/chikun/src/replay-file.mjs`);
  - `GET /api/jackpot/review?week=` (design §C.6, bearer; `timeline`, `nextEligible`);
  - `profile.jackpot.wins` (design §C.7);
  - `LITVM_JACKPOT` (lazy chunks and the owner page only);
  - the `WeeklyJackpot` ABI. Use human-readable fragments in `jackpot-review-model.mjs`, and add a test that each fragment exists in `contracts/artifacts/WeeklyJackpot.json`.
- **Produced:**
  - `parseJackpot` (the jackpot-rehearsal slice feeds the real handler's output into it);
  - `jackpot-review-model.mjs` (the rehearsal's admin, funder and claim helpers encode calls with it);
  - the `JACKPOT_LIVE` flag;
  - the flip surface for design §E step E10.

## Plan

1. `jackpot-config.mjs` (import-free), the client modules and fixtures, with tests (parsing, formatting 18-decimal amounts, the Age-corrected clock, `phaseOf` at the close, countdown, the honesty rules including the cap). Commit.
2. Copy plumbing, the soft-launch honesty lines and `serverRecords`, the rules page with 16 markers and the builder; flag-false byte identity except the named lines; the legal and marker guard. Commit.
3. SPA placements: mode select, entry modal, results line, home promo, Scores header and history, profile wins with Claim. Each has a unit test with fixtures and a fetch spy, and with the flag false (no fetch) and a test-only override (a `JACKPOT_LIVE` stub injected through the loader's `deps`, never by editing the literal). Commit.
4. Chikun child: the stock-view cap and cull with `tests/chikun-stock-view.test.mjs` (commit on its own, since it is a gameplay-visible change), then the start-screen and detail lines and the `?replay=` import, with tests in the existing Chikun child test style. Measure the child bytes. Commit.
5. Owner page and review model:
   - test with a fake `window.ethereum` backed by the in-process chain (`deployLocalJackpot`), as `tests/owner-confirm-page.test.mjs` does;
   - the gate refuses non-admin actions but allows funding and a winner's claim;
   - clear, disqualify, `adminSubmit`, reinstate, finalize, fund, refund and claim change the local chain as named;
   - the flap timeline renders from a fixture review payload, without importing the runtime.
   Commit.
6. Regenerate the curated inventory. Build, measure budgets with the deployed-shaped fixture, syntax-check, the full gate; rebase onto jackpot-server and re-run. Browser check:
   - serve `apps/portal` itself (`python -m http.server 8797 --directory apps/portal`), never the repo root;
   - open the home, Chikun mode select, Scores and `/jackpot/chikun.html`: no requests to `/api/jackpot` and a clean console;
   - `/chikun/index.html` in a browser window resized to 21:9 with the frame's `aspect-ratio` removed in devtools: no obstacle beyond the stock edge;
   - `/owner/jackpot.html` shows the "install a wallet" state and a clean console; then, with a stubbed `/api/jackpot/review` and fixture, a candidate's timeline renders.
   Commit.

## Tests (titles)

- "jackpot flag is false, the config imports nothing, and true implies settlement and a deployed jackpot module"
- "parseJackpot accepts the documented shape and rejects deviations"
- "token amounts format exactly with 18 decimals"
- "the corrected clock accounts for CDN age and the week closes on the client"
- "no surface fetches the jackpot API while the flag is false"
- "no surface shows an amount for an unfunded, below-minimum or unavailable week"
- "surfaces show the capped prize and the rollover note"
- "testnet token amounts are labelled as having no value, per week"
- "leader wording stays provisional until the week is paid and the open-week leader shows no name"
- "flag-false portal pages change only the named honesty lines"
- "the rules page is noindex and out of the sitemap until live"
- "a live build refuses a rules page with the legal placeholder or a missing section"
- "entry modal jackpot row never delays the entry, opens rules in a new tab and hides below the minimum or after the close"
- "results line compares against the jackpot leader, not the board rank"
- "results line uses the existing share label and leaves share-links unchanged"
- "scores header shows history with date ranges, replay and transaction links"
- "profile lists jackpot wins and offers claim to a claim-pending winner"
- "chikun child keeps the rewards tease while the flag is false"
- "chikun child shows the jackpot detail copy when live, funded or not"
- "chikun child never draws obstacles beyond the stock view"
- "chikun child imports only same-origin jackpot replays"
- "owner jackpot page gates admin actions on the on-chain admin and lets anyone fund"
- "owner jackpot page actions change the local chain as named"
- "owner jackpot page draws the server timeline without the runtime"
- "review model fragments exist in the WeeklyJackpot artifact"

## Pitfalls

- **`share-links.mjs` is shared with the Chikun and STACKED children.** Touching it spends the STACKED entry's 1,244 B headroom. Use the existing `standingLabel` (≤ 24 characters; `safeShareFragment` truncates). "Jackpot lead (pending)" is 22.
- **The child is flag-blind by design** (`main.mjs:357-358`), and `portal:init` is exact-keys. Do not change the bridge protocol. The child imports the import-free `jackpot-config.mjs` and fetches the API itself.
- **The stock-view cap changes what free players see only in non-stock frames.** The stock `.game-frame` is 16:9 in every breakpoint except the 9:16 portrait query, so normal players see no change; say so in the commit.
- **esbuild does not tree-shake the frozen generated module** and does not fold `if (JACKPOT_LIVE)` across modules. Keep the generated module out of anything the initial chunks import.
- **Generated pages.**
  - Any `index.html` edit means re-running `node scripts/build-portal-pages.mjs` and committing its outputs.
  - `tests/portal-pages-build.test.mjs` requires them current.
  - If there is a conflict at merge time, the orchestrator regenerates; never hand-merge.
- **The owner pages are public.**
  - Never render review data without the bearer token.
  - Never rely on hiding.
  - Authority is on chain.
  - `approve` exactly the amount; never unlimited.
- **LiteForge base fees jump.** Always use `liteForgeFeeOverrides` (10 × base, 5 gwei floor, tip 0).
- **No `.innerHTML =`, `eval` or `new Function`.** No quoted secret-like literals (`scripts/hmh-security-audit-sweep.mjs`).
- **Countdowns.** The API can be about 150 s old at the CDN. Correct with `serverTime` + `Age`, and derive "closed" from `closesAt` on the corrected clock, never from the cached `current.status`.
- **Hidden wallets** show `walletShort` only; the API already blanks `displayName`.

## Definition of done

- Acceptance criteria 1-11 hold.
- `JACKPOT_LIVE` is committed `false`.
- Budgets are met and recorded.
- The listed tests pass.
- `npm test`, `npm run check`, `npm run contracts:check` and `npm run build` pass, and `npm run test:release` shows exactly 51. Do not commit the gate JSON.
- The browser checks have a clean console, with the portal served as the web root.

## Hand-off record (2026-09-25)

Code head: `6e782161` on `fable/pd-jackpot-ui` (the finding-23 repair on top of `a759f54f`; see the finding table and the repair re-check below). It contains the integration release commit `3cbd2538` (1.8.3, version-column included) and `fable/pd-jackpot-server` (`55072d09`). Both came in as merges (`9cfea667`, `760d31cd`, `a759f54f`), not as a rebase, because pushed history must not be rewritten. `JACKPOT_LIVE` is committed `false`, and the rules page keeps the design §F.1 legal draft verbatim with its `LEGAL-REVIEW-PENDING` comment.

**Not all budgets are met.** Four deviations remain open (D1-D4 below) and need an owner or orchestrator decision. Until then, "Budgets are met" in the Definition of done does not hold.

### Review findings on `233f2314` (23)

| # | Finding | Result |
| --- | --- | --- |
| 1 | The owner timeline marked honest runs as look-ahead | Fixed in `d10d1a18`: only the server verdict is marked. `5ac3adea` checks this on the real v6 replays: the hardcore bot now shows 1 mark (the server's count) instead of 7. |
| 2, 10, 17 | AC10 budgets | `dist/main.js` is now +444 B (it was +1,229 B), fixed in `957da5f4` and `d597b4d1`. The hosted views are +200 B each (fixed in `401fcc51`). The claim chunk is 3,837 B (fixed in `401fcc51`). The rules page is still over its budget: see D1. The optional main.js budget assertion was not added, because `build.mjs` is outside this slice's files. |
| 3 | Not rebased onto jackpot-server; only hand-built fixtures were tested | Fixed. jackpot-server was merged in `760d31cd`. `5ac3adea` (`tests/jackpot-ui-server-contract.test.mjs`) runs the real `/api/jackpot`, review and profile handlers, the cron and the real replays. |
| 4, 11 | A nested render lost the share label | Fixed in `401fcc51`. It is tested on the direct verifying to published path with `hosted: false`. |
| 5, 9 | `parseJackpot` was stricter than the server (10-row cap, `rules: null`, zero `minFundWei`) | Fixed in `401fcc51`. It is tested with 14 candidate rows and with the real handler output. |
| 6 | Integrity results were not shown | Fixed in `d10d1a18`: each candidate card has an Integrity row. |
| 7 | The builder wrote pages before the rules guard ran | Fixed in `957da5f4`: every page is rendered in memory and written only after all guards pass. |
| 8 | Edits outside the assigned ranges, and the rules page was exempt from the preview sweep | Sweep fixed in `957da5f4`: the preview banner changed, and the rules page is swept except its legal block. The out-of-range edits are kept and listed under D5 for acknowledgement. |
| 12, 21 | A tie with the leader was shown as a lead | Fixed in `401fcc51`. A tie now reads "Tied with the jackpot leader (provisional)" and has no share label. |
| 13 | The SIWE session survived an account switch | Fixed in `d10d1a18`. An account switch or a 403 answer drops the session. |
| 14 | The `adminSubmit` pre-check was weak after the window closed | Fixed in `d10d1a18`. The page runs `eth_call` on `adminSubmit` from the admin account and refuses with the revert reason. |
| 15 | Empty `jackpot-config` shared chunk | Partly fixed in `401fcc51`: ranked-results no longer imports it. The rest is declined, see D4. |
| 16 | The child's jackpot line stayed frozen after the close | Fixed in `e1621e5e`. The line is rebuilt on every render and every 30 s, and a test covers the close. |
| 18 | The rules-page test redefined the budget as gzip | Fixed in `d597b4d1`. The test says the raw 10 KB row is not met. Its gzip check and its 19 KB raw ceiling only stop the size from growing unnoticed. |
| 19 | The byte record left out the shared client chunk | Fixed by this record (see the table below). |
| 20 | An entry was not noted if the modal closed before the answer arrived | Fixed in `401fcc51`, with a test. |
| 22 | Owner-page behaviours without tests | Fixed in `d10d1a18`: a full list of 5, the `LIST_FULL` refusal, a whole-wallet disqualify, and a simulated `TOO_LATE` refusal. `031475be` adds the 320 px layout rules. |
| 23 | Tests depended on the host locale | Partly fixed in `401fcc51`: the tests build their expected ranges in the host's own format, or pass `en-US`. That was not enough for the rules page. `chikun-rules.mjs` accepted a `locale` but never passed it to its two week ranges (this week's line and the past weeks), so its live test still failed with the host's default locale forced to en-GB or de-DE. Fixed in `6e782161`: both ranges take the page's locale. The test pins the en-US ranges with an explicit `en-US` and checks that a de-DE locale reaches this week's range and every past week's range; it fails against the old module. |

### Byte deltas

Method: `node build.mjs --metafile` on a `git archive` of each tree. The base is `3cbd2538` and the head is `a759f54f`. Each build swaps in a deployed-shaped `litvm-jackpot.mjs` for the measurement only. `JACKPOT_LIVE` is false, as committed. A throwaway copy with the flag flipped to true was measured as well; its only use is to show the size at the E10 flip. Sizes are raw bytes, with gzip at the default level in brackets.

| Item | Base | Head | Delta | Budget (design §D.3) | Met |
| --- | --- | --- | --- | --- | --- |
| `dist/main.js` | 1,160,924 (225,286) | 1,161,368 (225,504) | +444 | ≤ +600 | yes; at the flip +643, see D3 |
| main.js initial static closure | 2,202,251 | 2,203,174 | +923 | – | the entry, plus +479 in the curated-inventory chunk, plus the 0 B jackpot-config chunk (26 static chunks, was 25) |
| `hosted-leaderboard-view` | 14,764 | 14,964 | +200 | ≤ +200 | yes |
| `hosted-profile-view` | 24,664 | 24,864 | +200 | ≤ +200 | yes |
| `ranked-results` | 23,367 | 23,613 | +246 | ≤ +300 | yes |
| Chikun child `chikun/game.js` | 42,573 (16,332) | 44,054 (17,074) | +1,481 | ≤ +1,500 (stock-view cap and cull included) | yes; at the flip +1,547, see D3 |
| HMH child entry | 360,738 | 360,738 | +0 | +0 | yes |
| HMH initial JS + shared | 1,046,713 | 1,046,713 | +0 | ≤ 1,048,576, no growth | yes |
| STACKED entry | 27,694 | 27,694 | +0 | +0 (`share-links.mjs` untouched) | yes |

Lazy jackpot chunks. None of them exists on the base, and none is fetched while the flag is false.

| Chunk | Raw (gzip) | Row limit | Met |
| --- | --- | --- | --- |
| `chikun-jackpot-panel` (mode select) | 1,283 (733) | ≤ 5 KB | yes, counting its own chunk only |
| `jackpot-entry-line` | 1,276 (800) | ≤ 3 KB | yes, counting its own chunk only |
| `jackpot-results-line` | 2,103 (1,098) | ≤ 3 KB | yes, counting its own chunk only |
| `jackpot-board-header` | 2,723 (1,501) | ≤ 6 KB | yes, counting its own chunk only |
| `jackpot-profile-wins` | 1,754 (958) | ≤ 4 KB | yes, counting its own chunk only |
| `jackpot-profile-claim` | 3,837 (1,941) | the profile row's ≤ 4 KB | yes on its own; with the wins chunk 5,591, see D2 |
| `jackpot-home-promo` | 923 (568) | ≤ 3 KB | yes, counting its own chunk only |
| shared `jackpot-client.mjs` + `jackpot-view.mjs` chunk | 11,807 (4,581) | no row | see D2 |
| `jackpot-config.mjs` shared chunk | 0 | – | empty; see D4 |

Rules page (`/jackpot/chikun`): `chikun.html` is 12,211 B (3,807 gzip) and `chikun-rules.mjs` is 6,463 B (2,485 gzip), 18,674 B raw (6,292 gzip) in total, measured at `6e782161` (the locale fix added 39 B to the module), against "static page + module ≤ 10 KB". **Not met**, see D1.

The owner page is not in any bundle.

### Open deviations (need an owner or orchestrator decision)

- **D1. The rules page is 18,674 B raw, against a 10 KB budget.**
  - Where the bytes go: `<main>` holds 9,912 B (the 16 sections the design requires, the §F.1 legal draft at 1,562 B, and 1,530 B of `copy:` markers the builder and the flip guard need). The page head and shell are 2,299 B. The module is 6,463 B (local times, history and contracts).
  - The budget cannot be met without cutting required copy.
  - Measured as transferred, it is 6,292 B gzip. The test pins that value and a 19 KB raw ceiling; neither is the design's budget.
- **D2. The design has no row for the shared client (design §D.2), and each placement budgets only its own chunk.**
  - Each surface's first jackpot load also downloads the shared chunk once per page: 11,807 B (4,581 gzip).
  - Counted against every row, every row is over. For example, the entry row loads 1,276 + 11,807 = 13,083 B against its 3 KB limit.
  - The profile's claim chunk loads only for the connected winner of a claim-pending week, on top of the wins chunk: 1,754 + 3,837 = 5,591 B against 4 KB.
- **D3. At the E10 flip, two totals go over budget.**
  - `dist/main.js` grows to +643 B (budget +600) and the Chikun child to +1,547 B (budget 1,500).
  - The cause is the live-only branches that esbuild drops while `JACKPOT_LIVE` is false: +199 B in main.js and +66 B in the child.
  - The committed build meets both budgets. The flip commit must either trim these bytes or get them accepted.
- **D4. The empty `jackpot-config` chunk (the rest of finding 15).**
  - esbuild still keeps a 0 B shared chunk for `jackpot-config.mjs`.
  - `dist/main.js`, the Chikun child and both hosted views import it, at 28-36 B per import statement. The deltas above already include this cost. It adds one extra module request per page.
  - The chunk should fold into the chunk that only `main.js` and the Chikun child share if the hosted views took the flag from their route modules; esbuild groups modules by the entries that reach them. This was not verified with a build. That fix needs edits in `official-leaderboard-route.mjs`, `official-profile-route.mjs` and main.js's route deps, all outside this slice's files, so it is declined here.
- **D5. Edits outside the brief's file list, kept for acknowledgement at merge.**
  - `main.js` has a static `import { JACKPOT_LIVE } from './src/jackpot-config.mjs'` beside the settlement import. The three glue sites need it.
  - The test helper `tests/helpers/jackpot-fake-dom.mjs`.
  - Updated pins in `tests/portal-copy.test.mjs` and `tests/portal-trust-surface.test.mjs`. The text is unchanged; only its source moved to the builder-only `jackpotCopy()`.
  - `tests/portal-pages-build.test.mjs` now also checks the rules page for preview wording. Only its legal block is skipped.
- **D6. The Chikun child's `?replay=` deep link is not flag-gated** (carried over from `233f2314`).
  - It asks `/api/jackpot/replay` only when a strict same-origin link is opened.
  - No surface asks `/api/jackpot` while the flag is false.

### Verification

All results below are from the code head `a759f54f`.

| Check | Result |
| --- | --- |
| Jackpot, Chikun, portal copy/pages/trust and ranked-results suites | 138 tests, all pass |
| Owner page and server-contract suites | 12 tests, all pass |
| `npm run check` | passes (994 JS modules) |
| `npm run contracts:check` | passes |
| `npm run build` | passes |
| `npm run test:release` | `PASS tests=5053 passed=5002 expected_failures=51` |

The gate JSON was restored with `git checkout` and is not committed.

The last browser check ran on `031475be`, the commit just before the 1.8.3 merge. `apps/portal` was served as the web root, with the real jackpot-server review payload. It found:
- Home, Chikun mode select and Scores: no `/api/jackpot` request, the promo and entry row stay hidden, and there is no marquee.
- `/jackpot/chikun.html` at 1,280 and 320 px: `noindex`, no request, and no horizontal scroll.
- The Chikun cabinet at 21:9 with `aspect-ratio` removed: a 1600 × 900 canvas with `object-fit: contain`.
- `/owner/jackpot.html`: the install-a-wallet state. With a stubbed session, both candidates render at 1,280 and 320 px, each with a timeline marking 0 unexplained descents (the server's count) and a passed Integrity row. There is no horizontal scroll.
- The console had no app errors on any page.

The check was not re-run on `a759f54f`, for two reasons:
- That merge changed only integration files: the version marker, `sw.js`, and retired or regenerated asset files and manifests. None of this slice's files changed.
- An integration gate and a Playwright perf bench were running on this machine, and browser smokes must never run in parallel.

### Repair re-check on `6e782161` (finding 23)

The verifier forced the default `Intl` locale to en-GB, and separately to de-DE, and the live rules-page test failed under both. `6e782161` passes the page's locale to both week ranges in `chikun-rules.mjs` and tightens the test. Results at `6e782161`:

| Check | Result |
| --- | --- |
| New test assertions against the old module (en-US host) | fail, as expected |
| The slice's seven test files (the five `jackpot-ui-*` suites, `owner-jackpot-page` and `chikun-stock-view`), default locale forced to en-GB, then de-DE | 50 of 50 pass under each |
| Jackpot (UI, server, weekly, deploy tooling), owner page, Chikun, hosted, version-column, portal copy/pages/trust and ranked-results suites (29 files) | 278 tests, all pass |
| `npm run check` | passes (994 JS modules) |
| `npm run contracts:check` | passes |
| `npm run build` | passes. `dist/main.js` 1,161,368 B and `chikun/game.js` 44,054 B, both unchanged. HMH initial JS + shared is 1,046,713 B, unchanged. |
| `npm run test:release` (run after the wait rule: no other gate was running) | `PASS tests=5053 passed=5002 expected_failures=51` |

The gate JSON was restored with `git checkout` and is not committed. The only size change is the rules module (+39 B; see D1).

Browser check: `apps/portal` was served on `127.0.0.1:8797`, and the server was stopped afterwards. `/jackpot/chikun.html` is `noindex`, shows the local close times and "Contract: Not deployed yet.", keeps the live summary and history hidden, and makes no `/api` request. At 320 px there is no horizontal scroll. Every one of the rules page's own requests returned 200. The console errors came from other sources: the Browser pane's service-worker registration, and requests left over from an earlier session after its server had stopped.
