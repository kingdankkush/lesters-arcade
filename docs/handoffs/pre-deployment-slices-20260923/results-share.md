# Slice brief: results-share (wave 3, parallel with ranked-client, signin-entry, profile-boards and site-copy)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/results-share`, branch `fable/pd-results-share`, based on the integration branch after waves 1 and 2 have merged.

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A5, A18, A22, A23, A29, A30, A32), §2.5, §4.2-§4.4 (E4, E5, E9, E10, E11, and §4.3.9's parameter and render limits), §6.1-§6.3, §7.2 (the handle and snapshot you consume), §7.3, §7.4, §7.5 (card revision, unpublished runs, hidden profiles), §7.7, §10.3 (your `main.js` ranges), §11 (rule 5 byte budgets), §14 (rows S6, S13, S14, C11, C14, C16);
- guide §3.3, §3.4, §5.11, §5.12, and decisions D12, D13.

## Goal

1. One shared, lazy-loaded Ranked results screen for all three games, driven by the settlement handle. It shows:
   - a hero block with score and handle;
   - standing;
   - per-game stats;
   - a live on-chain timeline;
   - the achievements earned;
   - actions, with Share on X as the primary;
   - honest failure states.
2. X-first sharing: `@LestersArcade` once, `related=LestersArcade`, no hashtags.
3. A server-rendered share page `/s/<shareId>` with OG and Twitter tags.
4. A 1200×630 card image rendered with `@vercel/og`.

## Acceptance criteria

1. **`apps/portal/src/ranked-results-model.mjs`** (pure) implements `buildRankedResultsModel` per §7.3:
   - Timeline statuses derive from `snapshot.state`, `snapshot.entry` and `snapshot.server.status`, following the §7.2 and §3.3 mappings.
   - The banner covers every terminal and error state:
     - preview: "Ranked preview · not published while online settlement is off";
     - practice: "Entry didn't confirm, so this run was practice";
     - saved-locally: "Saved. Publishing will retry automatically", with Retry;
     - rejected: the server code mapped to plain words;
     - retrying: "Publishing will retry shortly" (the retryable `entry-pending` and `run-timing-early` codes);
     - paused: "Ranked publishing is paused; your run is saved and will publish when it resumes".

     There is never a dead end and never a fake success.
   - `actions.share` is true only in `published`, and in `preview` or `practice` with the Free template to the site root. A Ranked share (with its "Verified on LitVM" line) never goes out before the run is confirmed.
   - Per-game stats come from `context.localStats` until `server.stats` arrives, then from the server.
   - The standing text is `#3 this week · #12 all-time`. Weekly is the headline until Daily is switched on (D2). When the score beats `context.previousBest` (ranked-client fills it from the server index in hosted mode), add `New personal best (+4,210)`.
   - The hero handle is `context.displayName`, or the short wallet when it is null (hidden and blocked names arrive as null).
2. **`apps/portal/src/ranked-results.mjs`** (lazy UI) implements `openRankedResults` per §7.3:
   - it subscribes to `handle`;
   - the "Published" step links to `explorerUrl`;
   - achievements are rendered with `achievementById` (catalog title, image, tier colour);
   - **no NFT wording in phase 1** (A32): NFT-flagged achievements render like every other achievement. Only when an achievement's `tokenId` is non-null (phase 2) does it show "Minted" with a token link;
   - actions: **Share on X** is primary; a secondary menu holds Copy for Discord, Facebook and native share; then Play again (Ranked), Practice (Free), View profile, Back to arcade, all through the `actions` from the event;
   - it is fully keyboard and touch navigable, traps focus, closes on Escape, has `aria-live="polite"` on the timeline, honours `prefers-reduced-motion`, and has no horizontal scroll at 320 px.
   - Styles live in `apps/portal/src/styles/ranked-results.css`, injected once as a `<link>`, in the site's retro arcade look: `design-tokens.css` variables, the `.official-info-card` look, neon, and tier colours bronze `#cd7f32`, silver `#c7d0dc`, gold `#ffd54a`, platinum `#7bf6ff`, diamond `#19f7ff`, mythic `#ff5fa2`.
3. **Mount point.** Add exactly one listener block to `main.js`, immediately before `// Initial paint honors the URL (deep-link / refresh) instead of always splash.`, using the code in §7.7. Hard Money Heroes shows the results screen **in place of** the parent game-over summary for Ranked runs: `renderGameOverSummary` (`:2742-2824`) renders a compact "View results" button while a results screen is open or was dismissed for the current session. Free HMH keeps today's summary. Chikun and STACKED keep their child result panels, and the parent screen overlays them for Ranked.
4. **`apps/portal/src/share-links.mjs`** implements §7.4:
   - `buildShareLinks({text, url})` has no `hashtags` parameter;
   - X: `https://x.com/intent/post?text=…&url=…&related=LestersArcade`;
   - Facebook sharer: `?u=`;
   - Discord: text, a newline, then the URL;
   - newlines are preserved;
   - `xWeightedLength` follows twitter-text v3 weights (code points in U+0000-U+10FF, U+2000-U+200D, U+2010-U+201F and U+2032-U+2037 weigh 1, all others 2);
   - `buildRankedShareText` implements the three guide §5.12 templates (without the URL line; X appends it), with a "🔥 New personal best!" line when applicable;
   - `buildFreeShareText` ends "Practising on @LestersArcade".

   `buildHmhShareText` and `buildStackedShareText` stay exported without hashtags. Update every caller (`main.js:2773-2793`, `apps/chikun/src/main.mjs:826-840`, `apps/chikun/src/presentation.mjs:36-44` `buildChikunShareText`, `apps/stacked/src/main.mjs:94-100`) to drop hashtags, and use the Ranked share URL `sharePageUrl(sessionId32)` only in the parent results screen. **In the Chikun and STACKED children, hide the child result panel's share row for Ranked runs** (the child knows its mode; the parent results screen owns Ranked sharing, and the child does not know the session key). Free runs keep the child share row. Keep the file small: it ships in the Chikun and STACKED children. The STACKED entry is 27,756 B at `06ebe4ca` against a 29,000 B cap; **your net entry growth is ≤ 300 B** (ranked-client has 400 B, unlockables 400 B). Record the measured delta in your final commit message.
5. **Share invariants**, tested for every template and for worst-case stat values: `xWeightedLength(text) + 24 ≤ 280`; `@LestersArcade` appears exactly once; no `#`; no `/0x[0-9a-fA-F]{40}/`; no `session-`.
6. **Share page E10.** `server/share/render-page.mjs` `renderSharePage({ session, status })` and `api/share-page.mjs` (replacing index's stub; keep the `sharePageRequest` pure export) per §7.5 and §4.3.9:
   - every interpolated value is HTML-escaped (a test uses a malicious display name);
   - the full OG and Twitter tag set is present, including `twitter:site=@LestersArcade`, and `og:image` is the **versioned** card URL `…/api/share-card/<shareId>.png?v=<cardRev>` (E9 `cardRev`);
   - canonical URL, Play buttons to `/play/<route-slug>`;
   - a `confirmed` session shows "Verified on LitVM" and the transaction link; any other status shows "Publishing to LitVM…", no transaction link, and `noindex`;
   - a null `displayName` (hidden or blocked) shows the short wallet and the default avatar;
   - the cache headers of E10, with 404 cached `public, s-maxage=30`; only the `id` parameter is accepted (else 400);
   - 404 and 503 pages with generic tags.

   It reads through index's `readPublicSession` (`server/neon/queries.mjs`). Use the handler seam (A30): `buildDeps(env, overrides)`, `createHandler(depsFactory)` and the default export, so the rehearsal can render against PGlite.
7. **Card E11.** `server/share/render-card.mjs` `buildShareCardElement` and `api/share-card.mjs` (replacing index's stub; keep the `shareCardRequest` pure export and the A30 seam) per §7.5:
   - 1200×630 PNG from `@vercel/og` `ImageResponse` (0.11.1 was proven to render in Node in about 160 ms);
   - background from `apps/portal/assets/share-cards/<gameId>.png`: three backgrounds you produce from existing key art with `scripts/build-share-card-backgrounds.py` (Pillow, 1200×630, each under 300 KB). Raw sources are not committed (AGENTS.md asset hygiene);
   - it shows the score, the handle or short wallet (hidden rule as above), the standing, three headline stats, up to 4 badges, and "Verified on LitVM" **only when confirmed** (otherwise "Publishing to LitVM…");
   - no emoji and no network fetches;
   - cache headers per E11 (confirmed: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`, never `immutable`);
   - only `id` and `v` are accepted (else 400). When `v` differs from the current `cardRev`, answer `302` to the current versioned URL with `Cache-Control: public, s-maxage=60` instead of rendering; a missing `v` renders the current revision. Renders (not redirects or CDN hits) count against `card:ip:<ipBucket>`, 120 per hour.

   A Node test renders a real PNG from a fixture session: the PNG signature is present and the dimensions are 1200×630, read from the IHDR bytes. If `@vercel/og` 0.11 needs an explicit font in Node, commit a small OFL TTF under `apps/portal/assets/share-cards/fonts/` (covered by `includeFiles`) and load it with `fs`.
8. **Preview parity.** With `HOSTED_PROFILE_SYNC=false`, the results screen fetches nothing: no standing call, and share links point to the site root with the Free template. With both flags false the console stays clean.

## Files

- **You own:** contract §10.2 row results-share, and the §10.3 ranges (`:14`, `:2621-2824`, the one listener block).
- **Read-only:**
  - `ranked-settlement.mjs`, `ranked-requests.mjs` (ranked-client; code against §7.2);
  - `main.js` outside your ranges;
  - `apps/chikun/src/main.mjs` outside `:826-840`;
  - `apps/stacked/src/main.mjs` outside `:94-100`;
  - `server/neon/**` (index);
  - `apps/portal/src/achievements/**`;
  - `vercel.json` (index already routes `/s/` and the card).

## Interfaces

- **Produced:** §7.3, §7.4, §7.5, E10, E11.
- **Consumed:** the `lesters:ranked-run` event (§7.7) and the handle snapshot (§7.2); E5 (standing) and E9 (share page data); the catalog (§6.2); `shareIdFor` and `sessionId32ForShareId` (§7.1).

## Plan

1. `share-links.mjs` and the callers, with tests. Rewrite `tests/share-links.test.mjs`:
   - "…encode text, URL and hashtags…" becomes "X intent carries text, url and related without hashtags";
   - "all three cabinets mount the share row…" keeps `createShareRow({ title: 'Hard Money Heroes'`, `buildHmhShareText({`, `buildStackedShareText({`, `id="shareRow"`, or updates those pins in the same commit;
   - add "ranked templates fit X with one mention and no hashtags or addresses".

   Commit.
2. `ranked-results-model.mjs`, with a table-driven test (`tests/ranked-results-model.test.mjs`) covering every §7.2 client state times the entry statuses; the standing text and personal best; each game's stats list; the banners; "share is enabled only once published"; "NFT-flagged unlocks show no NFT wording without a token id". Commit.
3. `ranked-results.mjs`, the CSS, and the `main.js` listener and HMH summary change. Add a DOM test with a minimal fake document, or a jsdom-free structural test like `tests/official-profile-route.test.mjs` does: "results screen renders timeline, achievements and actions from a snapshot"; "focus is trapped and Escape closes"; "retry calls handle.retry". Commit.
4. Share-card backgrounds and `render-card.mjs` plus `api/share-card.mjs`, with a Node render test (`tests/share-card.test.mjs`): "renders a 1200x630 PNG"; "unpublished runs carry no verified badge"; "hidden profiles render the short wallet"; "a stale revision redirects instead of rendering"; "unknown parameters are rejected"; "confirmed cards are never immutable". Commit.
5. `render-page.mjs` and `api/share-page.mjs`, with tests (`tests/share-page.test.mjs`): "share page carries OG and Twitter tags with @LestersArcade and a versioned card URL"; "all interpolations are escaped"; "unknown ids render a 404 with generic tags"; "confirmed pages are cacheable, others briefly"; "unpublished runs say publishing, with no transaction link"; "hidden profiles show the short wallet". Use PGlite with index's `seedVerifiedSession` helper. Commit.
6. The child share rows: hide them for Ranked in `apps/chikun/src/main.mjs:826-840` and `apps/stacked/src/main.mjs:94-100`, with a test ("child share rows are hidden for Ranked runs and kept for Free"). If hiding needs a line outside those ranges, ask the orchestrator.
7. Register the files in `scripts/syntax-check.mjs` immediately after `'apps/portal/src/share-links.mjs',`, and `scripts/build-share-card-backgrounds.py` in the separate `PY_COMPILE_FILES` list (`:754`) immediately after `'scripts/build-chikun-ground-props.py',`.

## Verification

```
node --test tests/share-*.test.mjs tests/ranked-results-*.test.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

**Browser**, with `apps/portal` as the web root (`python -m http.server 8805 --directory apps/portal`):
1. Dispatch a synthetic `lesters:ranked-run` from the console with a fake handle, stepping `preview → verifying → publishing → published`.
2. Check 1280×800 and 320×640, keyboard-only navigation, and reduced motion. The console must be clean.
3. Check the HMH Free game-over summary is unchanged.

The share page and card cannot be served by the static server. Render them in Node tests, and optionally with `npx vercel dev` against PGlite-free local env (they will 503 without Neon, which is also worth seeing).

## Pitfalls

- **The service worker must not cache `/api/share-card`** (index added the `/api/` bypass). Do not render the card `<img>` inside the portal before that is merged; the share page itself is not controlled by the portal SW scope for cross-document loads.
- **Satori supports only flexbox and a subset of CSS.** Every `div` with more than one child needs `display:'flex'`.
- **The Chikun smoke asserts the native share `url === 'https://lestersarcade.io'`** and text matching `/Replay Verified Ranked/` (child share). If your child text change breaks that smoke, list it for the browser-e2e slice; do not keep old copy that is now wrong.
- **Keep `main.js` hunks inside `:14`, `:2621-2824` and the one listener block.** Ranked-client owns `:2826-3171`, including the calls to `renderGameOverSummary()`.
- **Never put wallet addresses in share text.** Handles come from the index, which falls back to a short wallet only on the card and page, never in X text.

## Definition of done

- Acceptance criteria 1-8 hold, with a PNG render proved in Node.
- The gate shows exactly 51. Do not commit the gate JSON.
- The bundle budgets pass, including the STACKED entry cap. The syntax-check entries are added.
- The final commit message lists the smoke assertions now outdated.
