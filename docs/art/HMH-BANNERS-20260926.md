# Hard Money Heroes banner art refresh: design plan (2026-09-26)

Status: plan only. No product code, assets or tests change in the commit that adds this file.
Branch `fable/hmh-banners`, base `origin/fable/master-list-20260916` at `a93246bd`.
Rebase onto the newest integration head at Verify (1.8.6 or later).

## 1. What the owner asked for

Replace every Hard Money Heroes banner and key-art surface on the site with the 23 new
16:9 images that use the real Lit Commando, Lit Valkyrie, Lester and Lilly art:

- Homepage: replace the HMH game banner.
- Mode select: new Free Mode and Ranked Mode banners.
- Level 1 intro screen and Level 1 loading screen: rotate the loading images and the
  extras, and make both pages look good while keeping the game information prominent.
- Social sharing: one cover for shared Free Mode sessions, one for verified Ranked sessions.
- Retire the old art. The blog is later work, but the full-size art must stay available for it.

## 2. Decisions

| Surface | Image | Why |
|---|---|---|
| Homepage HMH feature banner | `HMH-Extra4` | Whole cast grouped on the right, dark open forest on the left for title and calls to action |
| Portal HMH backdrop (screens that used `hard-money-heroes-keyart-bg.jpg`) | `HMH-Extra4` | Same reason; dark left keeps UI readable; one derivative set serves both |
| Free Mode banner (mode select, discover page, leaderboard fallback none) | `HMH-FreeMode2` | Owner label |
| Ranked Mode banner (mode select, discover page, leaderboard HMH card) | `HMH-RankedMode` | Owner label |
| Free Mode share cover (og:image and twitter:image of `/games/hard-money-heroes`, where HMH Free shares now point) | `HMH-FreeMode-Share` | Owner label |
| Ranked share card background (`share-cards/lester-blaster.png`, E11 card behind every verified HMH run) | `HMH-RankedMode-Share` | Owner label; heroes sit right, card text sits left and bottom |
| Level 1 intro (portal `#officialLevelIntro`) and Level 1 loading (child `#hmhStartup`) rotation pool | all 15 `Level-Load-*` plus `HMH-Extra`, `HMH-Extra2`, `HMH-Extra3` (18 images) | Owner request; the selected hero's `Level-Load-<hero>` image shows first and the hero's images make up about half the rotation |

The originals are copied untouched to
`C:/Users/just_/lesters-arcade-vault/hmh-art/banners-2026-09-26/` (done 2026-09-26; all 23
SHA-256 values verified against the Desktop folder). The source PNGs are never committed.
The blog uses the vault copies, and the committed 1600 px derivatives are available as well.

## 3. Source inventory

All 23 sources are 1672x941 RGB PNGs, 2.4 to 3.2 MB, with no text in the art. Focal point =
the centre of the heroes' faces and torsos as fractions of width and height; it drives
`object-position` and the cover crops. Hero tags drive the rotation weighting (ids as the
runtime uses them: `lit-commando`, `lit-valkyrie`, `lester-original`, `lilly`). The focal
values are first reads from contact sheets; the build script's `--preview` sheet confirms
them before any page uses them.

| Source | Scene | Heroes (x span) | Focal | Open area for text |
|---|---|---|---|---|
| HMH-Extra4 | Moonlit forest, horde behind, muzzle flash | all four (0.41-0.99) | 0.72, 0.35 | left 0-0.40, full height, near black |
| HMH-FreeMode2 | Moonlit forest trail, zombies behind | Commando, Valkyrie (0.47-0.95) | 0.71, 0.22 | left 0-0.42, dark trees |
| HMH-RankedMode | Burning fortress wall, violet-eyed horde | Lester, Lilly (0.42-0.95) | 0.68, 0.30 | top-left sky 0-0.40 x 0-0.30; lower left is busy (horde) |
| HMH-FreeMode-Share | Dark forest stream, all four crouched | all four (0.46-1.0) | 0.73, 0.30 | left 0-0.42, dark |
| HMH-RankedMode-Share | Burning city, violet horde, sandbags | all four (0.50-1.0) | 0.74, 0.30 | left 0-0.45, smoke; bottom band |
| HMH-Extra | Moonlit forest, flashlight | Lilly, Lester (0.46-0.95) | 0.70, 0.25 | left 0-0.40 |
| HMH-Extra2 | Moonlit forest, horde | Commando, Valkyrie (0.49-0.93) | 0.71, 0.22 | left 0-0.45 |
| HMH-Extra3 | Forest, Litecoin banners | Lester, Lilly (0.44-0.99) | 0.71, 0.28 | left 0-0.40 |
| Level-Load-Extra-01 | Flooded vault ruins, Litecoin vault door | Lester (0.12-0.44) | 0.28, 0.30 | right half busy (zombies) |
| Level-Load-Extra-02 | Sunlit forest ravine | Lilly (0.13-0.48) | 0.30, 0.25 | right half (zombies in light) |
| Level-Load-Extra-03 | Stormy boardwalk, ferris wheel, arcade | Lit Commando (0.41-0.83) | 0.62, 0.25 | left sky |
| Level-Load-Extra-04 | Snow road, convoy | Lit Valkyrie (0.21-0.44) | 0.32, 0.25 | right half bright snow (poor for light text) |
| Level-Load-Extra-05 | Rail yard, burning skyline | Lester (0.08-0.53) | 0.30, 0.30 | right sky |
| Level-Load-Extra-07 | Logging camp at sunset | Lester (0.06-0.50) | 0.32, 0.25 | right (zombies) |
| Level-Load-Extra-08 | Flooded subway platform | Lilly (0.04-0.46) | 0.25, 0.25 | right tunnel |
| Level-Load-Extra-09 | Rainy forest checkpoint | Lit Commando (0.13-0.44) | 0.30, 0.20 | right |
| Level-Load-Extra-10 | City ruins charge, drone | all four (0.39-1.0) | 0.68, 0.35 | left 0-0.35 dark smoke |
| Level-Load-Extra-11 | Overgrown rooftops, skyline | Lilly (0.01-0.50) | 0.30, 0.20 | right |
| Level-Load-Extra-12 | Overpass, wrecked cars, violet horde | Lit Valkyrie (0.50-0.81) | 0.65, 0.30 | left (busy) |
| Level-Load-Lester | Rainy harbour, lighthouse | Lester (0.12-0.51) | 0.32, 0.30 | right |
| Level-Load-Lilly | Container docks, cranes | Lilly (0.14-0.43) | 0.28, 0.25 | right |
| Level-Load-LitCommando | Burning town street, pickup truck | Lit Commando (0.51-0.78) | 0.64, 0.25 | left |
| Level-Load-LitValkyrie | Industrial catwalk, lanterns | Lit Valkyrie (0.50-0.71) | 0.60, 0.25 | left |

Pool counts by hero tag: Lester 7 (01, 05, 07, Level-Load-Lester, Extra, Extra3, Extra-10),
Lilly 7 (02, 08, 11, Level-Load-Lilly, Extra, Extra3, Extra-10), Lit Commando 5 (03, 09,
Level-Load-LitCommando, Extra2, Extra-10), Lit Valkyrie 5 (04, 12, Level-Load-LitValkyrie,
Extra2, Extra-10).

Observation. Every image keeps the heroes' faces in the top 45 percent of the frame. Hero x
positions vary: 10 of the 18 pool images put the hero in the left half, 8 in the right half
or across the frame. Any layout that overlays text on a full-bleed image has to account for
that. The plan below avoids overlaid body text on rotating art: it frames the rotating art
uncropped and puts the text in a panel next to it or under it.

## 4. Every surface that shows HMH banner or key art today (integration head `a93246bd`)

| # | File:line | What | Current art | New |
|---|---|---|---|---|
| 1 | `apps/portal/index.html:127` | Homepage "On the floor" HMH preview card | `hmh-banners/hard-money-heroes-free-mode-banner.jpg` (1200x670, 229 KB) | HMH-Extra4 feature banner (section 5.1) |
| 2 | `apps/portal/index.html:199` | Mode select `#officialFreeModeBanner` (static default) | free-mode-banner.jpg | HMH-FreeMode2 |
| 3 | `apps/portal/index.html:205` | Mode select `#officialRankedModeBanner` | `hard-money-heroes-ranked-banner.jpg` (222 KB) | HMH-RankedMode |
| 4 | `apps/portal/index.html:179` (inside `#officialGameIntroSplash`) | HMH intro video `poster` | `hard-money-heroes/screens/boot-splash.png` (1672x941, 591 KB, fetched before first paint on the homepage although its section is hidden) | HMH-Extra4 960 px WebP, set when the section is shown |
| 5 | `apps/portal/index.html:242-260` | Portal Level 1 intro `#officialLevelIntro` (step `level-one-intro`, `src/routes/official-app-routes.mjs:113`) | none (plain card) | rotation (section 5.4) |
| 6 | `apps/portal/src/arcade-core.mjs:538, 544, 556` | `CABINET_MODE_SELECT_PRESENTATIONS['lester-blaster']`: `backgroundAsset` (points at a missing `hmh-keyart-bg.jpg`), `free.bannerAsset`, `ranked.bannerAsset`; applied at runtime by `src/routes/official-play-routes.mjs:346-348` | old banners | new banner paths plus `bannerSrcset`, `bannerSizes`, `bannerPosition` |
| 7 | `apps/portal/src/portal-content.mjs:16` | `PORTAL_GAMES[HMH].art`: feeds og:image, twitter:image and JSON-LD `image` (`portalPageMeta:403`, `portalSchema:419`) and both discover-page mode banners (`scripts/build-portal-pages.mjs:134-135`) | free-mode-banner.jpg | `art` (feature banner), new `freeArt`, `rankedArt`, `ogImage` fields |
| 8 | `apps/portal/discover/{hard-money-heroes,games,chikun,stacked}.html` lines 23, 31, 54, 127, 179, 199, 205 | Generated from index.html and portal-content.mjs | as above | regenerate with `scripts/build-portal-pages.mjs`, never hand-edit |
| 9 | `apps/portal/src/leaderboard-view.mjs:119` and `styles-arcade-polish.css:2140` | Leaderboard HMH cabinet banner | ranked-banner.jpg | HMH-RankedMode 640 px WebP |
| 10 | `apps/portal/main.js:442` `HMH_KEY_ART_BG`, used by `hardMoneyHeroScreenStyle` (`:482`) on splash, mainMenu, cabinetSelect, modeSelect, profile, leaderboards, settings, options | Full-bleed backdrop | `hmh-key-art/hard-money-heroes-keyart-bg.jpg` (1280x715, 198 KB) | HMH-Extra4 backdrop (1600 px, 960 px under 700 px wide) |
| 11 | `apps/portal/main.js:443-448` `HMH_LOADING_KEYARTS` | Legacy portal loading screen (`showHMHLoadingScreen`, `:5594`); unreachable for HMH since `beginOfficialLevel` mounts the reboot child and returns (`:5441-5455`) | 4 paths to files that do not exist | 4 pool derivatives (keeps the Level 1 `return null` invariant pinned by `tests/hmh-level-one-visible-runtime.test.mjs:406-418`) |
| 12 | `apps/portal/styles.css:563` (`.arcade-floor-view`, `.mode-select-view`) and `styles-arcade-polish.css:201` (`.game-intro-shell::before`) | CSS backdrops | keyart-bg.jpg | HMH-Extra4 backdrop |
| 13 | `apps/portal/hmh-reboot/index.html:16-39`, `hmh-reboot/styles.css:47-75, 954-956` | Child Level 1 briefing and loading panel `#hmhStartup` | none (gradient) | rotation (section 5.5) |
| 14 | `scripts/build-share-card-backgrounds.py:7, 53` producing `apps/portal/assets/share-cards/lester-blaster.png`, read by `api/share-card.mjs:43`, drawn by `server/share/render-card.mjs:139-141` | Ranked E11 share card background | pixel-doubled ranked-banner.jpg (264 KB) | HMH-RankedMode-Share (section 6.1) |
| 15 | `apps/portal/main.js:2441` `shareUrlFor('hmh-reboot')` and `apps/portal/src/ranked-results-model.mjs:292` (`url: SHARE_ORIGIN`) | Free Mode share URLs; `/hmh-reboot` has no og tags and the homepage og:image is the arcade poster | none | HMH Free shares link `/games/hard-money-heroes`, whose og:image becomes the Free share cover (section 6.2) |
| 16 | `server/neon/queries.mjs:343-346` `cardRevision`, `:424`; `server/share/render-page.mjs:227-228` | Card revision in E9 and in `?v=` of each share page og:image | no art term | fold an art revision in for HMH only (section 6.1) |

Not affected (checked): `apps/portal/sw.js` precache list (no HMH banners), `sitemap.xml`,
`llms.txt`, `manifest.webmanifest`, all `game.manifest.json` files (no cover fields),
`hmh-banners/litvm-legends-keyart.jpg` and `mweb-invaders-keyart.jpg` (coming-soon cabinets,
not HMH; they stay).

Tests and scripts that pin the old art: `tests/arcade-core.test.mjs:2001-2002` (banner file
names), `tests/portal-pages-build.test.mjs` (generated pages), `tests/share-card.test.mjs:284`
(background size), `tests/neon-queries.test.mjs:399-401` (literal Chikun card revision
`9aad35cebaa9`, which must not move), `scripts/optimize-assets.py:29` (`hmh-key-art` directory),
`scripts/hmh-load-speed-report.mjs:47`. Docs: `apps/portal/assets/README.md`,
`docs/cleanup/unused-assets-audit-20260925.{json,md}`, `docs/art/GLOBAL_ART_CENSUS.*`,
`docs/game-design/hard-money-heroes-generated-art-pack.md`.

## 5. Surface designs

Shared rules for every surface:

- WebP only (`<picture>` is unnecessary; WebP is universal in the supported browsers). AVIF
  is supported by the local Pillow 12.2 and would save about 40 percent, but it would add
  about 5 MB to the repository for a second copy of each image, so it is left out.
- Every `<img>` carries `width`, `height`, `decoding="async"`, `srcset` and `sizes`; below the
  fold `loading="lazy" fetchpriority="low"`; nothing is preloaded in `<head>`.
- Every art container has a gradient background of its own (`--hmh-art-fallback`, navy to
  teal), so a failed image leaves a designed panel and no broken-image icon.
- Text never sits directly on busy art: either a panel next to the art, or a scrim of at
  least 0.72 alpha behind body text and 0.55 behind 24 px or larger headings. Contrast is
  checked by a machine test (section 8), not by eye.
- Captions and alt text name the heroes shown ("Lit Valkyrie holds a snowy convoy road").

### 5.1 Homepage HMH feature banner (`index.html`, "On the floor")

Today the HMH card is one of three equal cards. It becomes a full-width feature banner above
the Chikun and STACKED cards (which move to a two-column row, unchanged):

- Desktop and tablet (from 720 px): `HMH-Extra4` fills a 16:7 frame, `object-position: 72% 35%`.
  A left-to-right scrim (rgba(5,7,15,0.92) at 0 percent to transparent at 55 percent) holds
  the text block in the open forest: kicker "Survival shooter · Cabinet 01", `h3` "Hard Money
  Heroes", the existing one-line pitch ("Choose your hero. Build your loadout. Hold off the
  horde."), a primary "Play Free" link and a secondary "Play Ranked" link, and one fact line
  read from the portal copy source (Ranked price per run; with the ranked-onboarding facts
  module when it is on the base, otherwise the current copy).
- Phone (below 720 px): the image sits on top at 16:9 (`object-position: 75% 35%`, hardly
  cropped) and the same text block sits under it on the panel colour, so nothing depends on
  a scrim at 320-390 px.
- Markup: the card is no longer one big `<a>` (links cannot nest). It becomes an `<article>`
  with a linked heading and two call-to-action links: "Play Free" goes to
  `/games/hard-money-heroes`; "Play Ranked" goes to the same page's Ranked card (or to the
  "How Ranked works" guide when that page is on the base).
- `srcset` 640w, 960w, 1600w; `sizes="(min-width: 1320px) 1280px, 100vw"`; lazy (the section is
  below the fold at 390x844 and at 1440x900).

### 5.2 Mode select Free and Ranked banners (runtime and discover pages)

- `HMH-FreeMode2` for Free (`object-position: 71% 22%`), `HMH-RankedMode` for Ranked
  (`68% 30%`). The banner frame changes from 16:7 to 16:9 on phones (almost no crop) and
  stays 16:7 from 720 px, where the focal point keeps both faces in frame.
- Each card gains a short fact row under the title, from existing copy sources only (no new
  claims): Free "No wallet · Unlimited runs · Practice only"; Ranked "<price> testnet zkLTC
  per run · Checked and published on LitVM · Boards and achievements". Price and proof wording
  come from `docs/handoffs/ranked-onboarding-20260926/ranked-onboarding.md` through its facts
  module if that has landed on the base at Verify; on `a93246bd` it has not (the page still
  says 0.102), so the existing strings stay and only the art changes.
- Runtime: the model gains `bannerSrcset`, `bannerSizes` and `bannerPosition`;
  `syncModeCard` sets `srcset` and `sizes` for every cabinet and clears them when a model has
  none. Without that, an HMH `srcset` left on the element would override Chikun's and
  STACKED's `src`.
- Build: `scripts/build-portal-pages.mjs` sets the Free banner from `game.freeArt ?? game.art`
  and the Ranked banner from `game.rankedArt ?? game.art` (today both use `game.art`, so the
  HMH discover page shows Free art on the Ranked card), and replaces or strips `srcset` the
  same way, so the Chikun and STACKED discover pages never carry HMH art.

### 5.3 Leaderboard HMH banner and portal backdrops

- Leaderboard HMH card: `HMH-RankedMode` 640 px WebP, `background-position: 68% 30%`, in both
  `leaderboard-view.mjs` and the CSS rule (they must stay equal, per the file's comment).
- Backdrops (`HMH_KEY_ART_BG`, `.arcade-floor-view`, `.mode-select-view`,
  `.game-intro-shell::before`, `arcade-core` `backgroundAsset`): `HMH-Extra4` at 1600 px, 960 px
  under 700 px wide, `background-position: 70% 35%`, keeping today's scrims.
- HMH intro video poster: `HMH-Extra4` 960 px, assigned when `#officialGameIntroSplash` is
  shown, not in the static markup. This removes a 591 KB PNG from the homepage's pre-paint
  requests (`boot-splash.png` itself stays; the level editor sprite library references it).

### 5.4 Level 1 intro (portal `#officialLevelIntro`)

The intro card today is text only: eyebrow "Level 1 // Into the Forked Frontier", title
"Level 1: The Crypto Wasteland", a story paragraph, seven control chips and "Begin Level 1".

- Layout from 1024 px: two columns inside the view. Left (about 56 percent): an uncropped 16:9
  art frame with the rotation, a hero caption chip at bottom left ("Lit Valkyrie") and a slow
  Ken Burns drift (scale 1.00 to 1.05 over 8 s toward the image's focal point). Right: the
  existing card content, with the title and the Begin button at the top of the reading order
  and the control chips as a two-column grid. Behind both, a blurred and darkened copy of the
  current image (the 480 px derivative, `filter: blur(28px) brightness(.35)`) gives the view
  the image's colour without competing with the text.
- Phones and short screens: the 16:9 frame spans the width on top (uncropped, so hero
  position does not matter), then title, Begin button, story and chips.
- Because the frame is uncropped, no image needs a per-breakpoint crop here, and no body text
  ever sits on art.
- Rotation: section 5.6. The module is loaded with `import()` when the route shows step
  `level-one-intro`, so it adds nothing to the portal's initial JS (about 7 KB of headroom
  is left there).

### 5.5 Level 1 loading and briefing (child `#hmhStartup`)

The panel shows the level name ("The Forked Frontier"), story, route, insertion point, four
briefing rows, three tip columns, the progress bar, the status line and Enter or Back. Today
it takes the whole 1440x900 view with no art, and on a 390x844 phone the Enter button sits
below the fold.

- Desktop (from 1024 px wide and 700 px tall): row 1 has the 16:9 art frame (about 45 percent
  of the card width, uncropped, crossfade plus Ken Burns) beside the kicker, title, story,
  route, insertion point and briefing rows; row 2 has the three tip columns across the full
  width; row 3 has progress, status and buttons. The same blurred backdrop as the intro sits
  behind the card.
- Phone portrait: the art frame spans the width at the top, then title and briefing. A new
  sticky action bar pinned to the bottom of `#hmhStartup` holds the progress bar, the status
  line and Enter, so progress and the call to action are always visible (today they are
  about two screens down).
- Short landscape (max-height 600 px, phones turned sideways): art frame in a 38 percent left
  column, content scrolling on the right, the sticky action bar across the bottom.
- Rotating tip line: a single `<p class="hmh-startup-ticker" aria-live="off">` under the art
  frame cycles through the sentences of the existing tip articles (read from the DOM, so no
  second copy of the tips exists), changing with the image.
- The existing markup, ids and `data-briefing-*` hooks stay (tests pin them, and the child
  writes the level briefing into them).
- Hard limits: the art is a host-page module (`apps/portal/hmh-reboot/startup-art-rotation.mjs`
  loaded with its own `<script type="module" src>`; no inline script under the route CSP
  `script-src 'self' 'unsafe-eval'`, `style-src 'self'`), so it never enters `game.js` or the
  1,048,576 B initial child budget. It sets no style attributes (CSP), only classes, `src`,
  `srcset` and CSSOM custom properties. It never touches the simulation, the bridge, the
  canvas or the startup gate.
- Loading priority: the first image (the selected hero's) is requested at normal priority as
  soon as the panel is shown. No other image is requested until `#hmhRebootStage` reports
  `data-startup-art="ready"` or 4 s have passed, so the rotation never competes with atlas
  downloads or decoding. Each next image is fetched `fetchpriority="low"` and `decode()`d
  before the crossfade.
- Selected hero: read from `#hmhHudHero[data-hero]`, which the child sets from the bridge
  init payload (`hud.setHero(payload.heroId)`, `apps/hmh-reboot/src/main.mjs:2908`) in the
  same task that unhides `#hmhStartup` (`:2870`). The module waits for the panel to be shown,
  then reads the attribute on the next animation frame, and follows later changes with a
  MutationObserver. It parses no bridge messages.
- Teardown: when `#hmhStartup` is hidden (the run starts), the rotation stops, timers clear
  and the `<img>` elements are removed so their decoded bitmaps are released before gameplay.

### 5.6 Rotation rules (shared by 5.4 and 5.5)

A pure module `apps/portal/src/hmh-banner-rotation.mjs` exports the sequence logic; the two
thin DOM controllers (portal intro, host page) import it.

- Slot 0 is always `Level-Load-<selected hero>`.
- Each later slot draws from the hero's own set with probability 0.5 and from the rest of
  the pool otherwise, using shuffle bags so every image appears before any repeats and the
  previous image never repeats immediately. Over a long session about half the images feature
  the selected hero.
- The portal intro and the loading screen share one sequence per run through
  `sessionStorage` (wrapped in try/catch; each surface works without it), so the loading screen
  continues where the intro left off instead of restarting. The loading screen still opens on
  the hero image when the intro was skipped (restart from the pause menu).
- Timing: 7 s per image, 900 ms crossfade, Ken Burns 8 s. Rotation pauses while
  `document.hidden`.
- `prefers-reduced-motion: reduce` (and the portal's own Reduce motion setting on the intro):
  no crossfade, no Ken Burns and no automatic rotation; the hero image stays.
- Randomness is presentation-only `Math.random` in portal and host-page modules, annotated
  `cosmetic-rng-ok`. Nothing is added under `apps/hmh-reboot/src/**`, and a test asserts no
  simulation module imports the rotation module.

## 6. Social sharing

### 6.1 Verified Ranked sessions (E11 share card)

- `scripts/build-share-card-backgrounds.py` takes `lester-blaster` from the committed
  1600 px `HMH-RankedMode-Share` derivative (`hmh-art/share/`, focus 0.74, 0.30). The card draws its text on the
  left (title top left, 148 px score and handle middle left, three stat boxes bottom left),
  the status pill top right and badges bottom right; the heroes sit right of centre, so the
  legibility mask stays as it is (strong left and bottom).
- Rendering mode: the current pixel-doubled 192-colour palette (156 KB for this image) turns
  the violet horde glow grey and coarsens the faces. The HMH card uses a full-resolution
  1200x630 palette PNG (FASTOCTREE, up to 256 colours, sized to stay at or under 280,000 B;
  measured 284 KB before the mask, less after). Chikun and STACKED keep the pixel-doubled look,
  so their card bytes and revisions do not change. The file stays a PNG, so
  `api/share-card.mjs` and its `data:image/png` path do not change.
- Top right: the status pill ("VERIFIED ON LITVM") has an opaque background and may overlap
  Lit Valkyrie's hair; the Verify step renders a fixture card and adds a light top-right
  vignette only if the pill reads worse than on today's card.
- Card revision: changing `lester-blaster.png` changes every HMH card, so the revision moves
  on purpose. A new module `server/share/card-art.mjs` exports
  `SHARE_CARD_ART = { 'lester-blaster': { revision: 'hmh-art-2026-09-26', sha256: '<png hash>' } }`.
  `cardRevision()` gains an optional `art` field that joins the digest only when present (the
  same pattern the jackpot champion badge uses), and `readPublicSession` passes the game's art
  revision. Effects: every HMH session gets a new `cardRev`; its share page emits the new `?v=`;
  a request for an old `?v=` answers 302 to the current revision (existing logic,
  `api/share-card.mjs:115`); X and Discord fetch the new image when they re-scrape. Chikun and
  STACKED revisions, including the literal `9aad35cebaa9` fixture, stay the same. A test hashes
  `share-cards/lester-blaster.png` and fails when it differs from `SHARE_CARD_ART` without a new
  revision.

### 6.2 Free Mode sessions

Free runs have no per-run page, so a Free share unfurls from the URL it links. Today HMH Free
shares link `/hmh-reboot` (no og tags) or the homepage (arcade poster).

- HMH Free shares link `https://lestersarcade.io/games/hard-money-heroes` (the discover page,
  a play-free landing page): `main.js:2441` and, for `lester-blaster` only, the Free template in
  `ranked-results-model.mjs`. Chikun and STACKED Free shares keep their current URL.
- That page's `og:image` and `twitter:image` become
  `/assets/hmh-art/og/hmh-free-share-1200x630.jpg`: `HMH-FreeMode-Share` cover-cropped to
  1200x630 (focus 0.73, 0.30), a left scrim, and a baked lockup in the dark left area:
  "LESTER'S ARCADE · FREE MODE" (cyan), "Hard Money Heroes" (large), "Top-down roguelike
  run-and-gun. Play free in your browser." and "lestersarcade.io", set in the Geist font that
  `@vercel/og` already ships (same face as the Ranked cards). JPEG quality 85, target at or under
  200 KB, hard cap 300 KB. JPEG rather than WebP for the widest unfurl support.
- `portalPageMeta` uses `game.ogImage ?? game.art`; the page also gains
  `og:image:width` 1200, `og:image:height` 630 and `og:image:alt` (the share pages already
  emit these). JSON-LD `VideoGame.image` uses the 1600 px feature banner.
- X `summary_large_image` shows 1.91:1, which is 1200x630 exactly; Discord shows the full image.

## 7. Derivative pipeline

`scripts/build-hmh-banner-art.py` (Pillow; committed, reproducible):

- `--source DIR` (default: the vault folder) reads the 23 PNGs and checks each SHA-256 against
  the manifest's recorded source hash.
- Writes WebP (quality 80, method 6) to `apps/portal/assets/hmh-art/`:
  - `banners/` Extra4, FreeMode2 and RankedMode at 1600,
    960 and 640 px wide (16:9, 1600x900, 960x540, 640x360);
  - `share/` FreeMode-Share and RankedMode-Share at 1600 px only: the committed sources of the
    og image and the E11 card background (the existing card script derives only from committed
    art), and full-size copies for the blog;
  - `loading/` the 18 pool images at 1280, 800 and 480 px wide;
  - `og/hmh-free-share-1200x630.jpg`;
  - then runs the share-card builder for `lester-blaster`.
- Writes `apps/portal/assets/hmh-art/manifest.json` (per image: source name and hash, role,
  hero tags, focal point, alt text, outputs with width, height, bytes, sha256) and the data
  module `apps/portal/src/generated/hmh-banner-art.mjs` (paths, srcsets, focal points, hero
  tags) that the portal and the host page import.
- `--check` (runs in `npm test`, needs no sources): every manifest output exists with the
  recorded size and hash, dimensions and byte caps hold (1600 px at or under 300 KB, 960 or
  1280 px at or under 200 KB, 640 or 480 px at or under 90 KB, og at or under 300 KB), the data
  module matches the manifest, and the total stays under 9 MB.
- `--preview` writes a contact sheet of every crop used (16:7, 16:9, 1200x630, phone frames)
  to `.tmp/` for the focal-point review.
- `.gitattributes` gains `*.webp binary`. Nothing goes to Git LFS (Vercel builds fail on LFS).

Measured at quality 80: 1600 px 174-339 KB, 1024 px 92-178 KB, 640 px 42-80 KB. Estimated
committed total about 8 MB (3 banner sets about 1.3 MB, 2 share sources about 0.4 MB, 18 pool sets about 6.2 MB, og and
card about 0.4 MB) against about 0.65 MB deleted. Tracked bytes are 292 MiB of the 350 MiB
`repo:health:strict` budget, so about 50 MiB stays free.

## 8. Performance, accessibility and verification

Baseline, integration head, local static server, cold browser, one run each (3 runs median
at Verify):

| Page | Viewport | FCP | Transfer | Images | Notes |
|---|---|---|---|---|---|
| Homepage `/` | 1440x900 | 124 ms | 9.05 MB | 3.52 MB | `boot-splash.png` 591 KB and the old HMH banner 229 KB among pre-paint requests |
| Homepage `/` | 390x844 | 2,476 ms (first page of a cold browser; treat as noise) | 9.05 MB | 3.52 MB | same |
| HMH route `/hmh-reboot/` | 1440x900 | 392 ms | 3.10 MB | 0 (atlases arrive as fetches) | startup ready after 3.8 s |
| HMH route | 390x844 | 200 ms | 3.09 MB | 0 | ready after 3.6 s |

Evidence: `.tmp/baseline/*.png` and `baseline-metrics.json` in the worktree (not committed).

Verify step (every browser job under the shared heavy lock, one job at a time):

- The same capture at 320x640, 390x844, 1280x800, 1440x900 and 1920x1080: homepage, mode
  select, `/games/hard-money-heroes`, leaderboard, portal Level 1 intro, child startup (early
  and ready), and a fixture E11 card; read every screenshot.
- Report FCP, LCP, total transfer and image bytes before and after for the homepage and the
  HMH route. Targets: no new request before first paint on either page; homepage transfer at
  least 0.5 MB lower (poster fix plus smaller banner); HMH route at most one extra image
  (about 60-200 KB) before `data-startup-art="ready"`; time to "ready" unchanged within noise.
- Contrast: a Playwright check samples the rendered pixels behind each text box on art
  surfaces and requires 4.5:1 (3:1 for 24 px or larger) against the text colour.
- Test the host module under the real route CSP (Playwright route adds the `vercel.json`
  header) with no CSP violations in the console.
- `og:image` and `twitter:image` of `/games/hard-money-heroes` fetch as 1200x630; the E11 card
  renders 1200x630 with the new background.
- Gates: `npm test` (includes `docs:cabinets`, share-card, share-page, portal-pages-build,
  new `hmh-banner-art` tests), `npm run check`, `npm run build`, HMH bundle budget unchanged,
  `npm run visual:reboot` (accept a new baseline only for the intended startup-panel change and
  commit it under `docs/testing/VISUAL_BASELINES/`), `repo:health:strict`, `docs:links`,
  `design:security-audit`.
- After regenerating index and discover pages, diff the onboarding strings (Ranked price,
  faucet line, "How Ranked works" link) against the integration head so none are lost.

New tests (`tests/hmh-banner-art.test.mjs` and additions): manifest and files agree; no file
references a deleted path (including sw.js, sitemap, llms.txt); the Chikun and STACKED
discover pages carry no HMH `srcset`; rotation slot 0 is the hero image, no immediate repeat,
hero share within 0.4-0.6 over 1,000 seeded draws, reduced motion gives one image; the host page
loads the rotation module and no `apps/hmh-reboot/src` file imports it; `cardRevision` moves for
HMH only; the og image is 1200x630.

## 9. Deletions (only once nothing references them)

- `apps/portal/assets/generated/hmh-banners/hard-money-heroes-free-mode-banner.jpg` (228,694 B)
- `apps/portal/assets/generated/hmh-banners/hard-money-heroes-ranked-banner.jpg` (222,312 B)
- `apps/portal/assets/generated/hmh-key-art/hard-money-heroes-keyart-bg.jpg` (198,229 B) and the
  then-empty directory (drop it from `scripts/optimize-assets.py:29`)
- Dead references with no file: `hmh-banners/hmh-keyart-bg.jpg` (`arcade-core.mjs:538`),
  `hmh-key-art/hmh-loading-keyart-1..4.jpg` (`main.js:444-447`)

Kept: `hmh-banners/litvm-legends-keyart.jpg`, `hmh-banners/mweb-invaders-keyart.jpg` (other
cabinets), `hard-money-heroes/screens/boot-splash.png` (level editor sprite library),
`generated/hmh-cabinet-key-art-textfree.png` (listed in the assets README; not a banner).

## 10. Implementation order

1. Pipeline: `build-hmh-banner-art.py`, manifest, data module, derivatives, `--check`, tests.
   Review the `--preview` sheet and correct focal points.
2. Static banners: homepage feature banner, mode cards (runtime `srcset` handling), portal
   content fields, page builder, leaderboard, backdrops, intro video poster. Regenerate pages
   and diff the onboarding strings.
3. Share: Free og image, Free share URLs, E11 background, `card-art.mjs` and `cardRev`.
4. Rotation module, portal Level 1 intro, child host module and startup layout.
5. Delete the old art, update docs (assets README, cleanup audit, art census), run the gates
   and the browser verification, then hand off with the before and after numbers.

## 11. Open points for the owner

- The level name differs between the portal intro ("Level 1: The Crypto Wasteland") and the
  loading screen ("The Forked Frontier"). This plan keeps both strings; say which one is the
  name to show on both.
- Several loading images show armoured enemies with glowing visors (Extra-05, Extra-08,
  Extra-12, Level-Load-Lilly, Level-Load-LitValkyrie) and one zombie wears a Bitcoin logo
  (Extra-01). The game's own enemies must read as zombies; as marketing art these are fine
  unless you would rather keep them off the Level 1 screens.
- Commercial-use rights for creator art are still an open gate in AGENTS.md; these images are
  owner-made, so they are assumed cleared.
