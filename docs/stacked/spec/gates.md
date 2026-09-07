# STACKED — Cabinet Art, Manifest, Test Plan, and Acceptance Gates

> Precedence: `../STACKED-CONTRACTS.md` overrides this specification wherever they disagree.

**Scope.** Implementation authority for getting STACKED onto the arcade floor without breaking an existing gate, and for proving it is finished: placeholder cabinet art, the `game.manifest.json` and the `docs:cabinets` doc-drift gate, the node test plan, the visual-regression baseline set, performance and soak acceptance, CSP / service-worker / security-sweep review, the documentation deliverables, and the ordered ship checklist. It owns none of the simulation, rendering, input, portal-integration or protocol design it tests — those are `mechanics.md`, `visuals.md`, `mobile.md`, `integrity.md`, `portal.md`, `versus.md` in this directory, and `docs/stacked/STACKED-CONTRACTS.md` is authoritative over all of them for names, ids and constants. Every repo fact below was read out of the working tree at `ff2934db`.

**Contents.** §1 identity and the doc-drift naming trap · §2 placeholder cabinet art · §3 manifest and `docs:cabinets` · §4 test plan · §5 visual regression · §6 performance and soak · §7 security, CSP, service worker · §8 documentation deliverables · §9 ship checklist.

---

## 1. Identity, registration, and the doc-drift naming trap

### 1.1 What this document consumes

Identity is frozen in contract §3 and not restated. The values every gate here touches:

| Slot | Value |
| --- | --- |
| Manifest `id`, `ARCADE_GAMES[].id`, app-shell `id`, `REGISTERED_GAMES` key, URL slug | `stacked` (one string, no split; alias `stack` in `ARCADE_GAME_IDS_BY_SLUG` only) |
| Manifest `name` | `STACKED` — also the README roster join key (§3.3) |
| Child host page | `apps/portal/stacked/index.html` + `apps/portal/stacked/game.css` (Chikun's `game.css`, **not** HMH's `styles.css`) |
| Build entry → output | `apps/stacked/src/main.mjs` → `dist/stacked/game.js`; `apps/stacked/src/verify-worker.mjs` → `dist/stacked/verify-worker.js` |
| Manifest `entry` shim | `apps/portal/games/stacked/main.mjs` |

Verified precedent: `apps/chikun/src/main.mjs` builds to `dist/chikun/game.js`, is hosted by `apps/portal/chikun/index.html` + `game.css`, and its manifest `entry` resolves to `apps/portal/games/chikun/main.mjs`, a thin re-export of `apps/portal/src/chikun-cabinet.mjs`. **The shim is easy to forget and nothing fails loudly without it** — `validateGameManifest()` only checks `entry` is a non-empty relative string, so a missing file is a runtime 404, not a gate failure. §4.8 asserts it.

### 1.2 The built-in registry entry

`apps/portal/src/game-registry.mjs` holds a module-private `REGISTERED_GAMES` keyed by **manifest id** (`hard-money-heroes`, `chikun`), not runtime `gameId`. STACKED needs a built-in entry:

```js
stacked: Object.freeze({
  id: 'stacked',
  name: 'STACKED',
  devWallet: null,
  feeSplit: { dev: 100, platform: 0, liquidity: 0, treasury: 0 },  // first-party, mirrors hard-money-heroes
  adapter: 'games/stacked/main.mjs',
  status: 'live',
}),
```

The map is not exported; the public surface is `getRegisteredGame(id)`, `listRegisteredGames()`, `registerGame(config)`. Tests go through those (§4.8).

### 1.3 The `docs:cabinets` naming trap — specific to this id

`checkDocForStaleClaims()` in `scripts/cabinet-status-doc-drift-check.mjs` scopes each **playable** manifest to patterns from `cabinetMentionPatterns()`:

```js
const patterns = [new RegExp(`\\b${escapeRegExp(manifest.name)}`, 'i')];   // ALWAYS added, no trailing \b
const alias = manifest.id.includes('-') ? null : manifest.id;              // bare-id alias only when hyphen-free
if (alias) patterns.push(new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i'));
```

Both fire for STACKED. The name pattern has **no trailing word boundary**: `/\bSTACKED/i` matches the ordinary English word "stacked" and anything starting with it. The id is hyphen-free, so `/\bstacked\b/i` is added on top.

Consequence: **once the manifest is `playable`, any line in `README.md`, `AGENTS.md` or `docs/THIRD_PARTY_GAME_ONBOARDING.md` containing "stacked" (any case, whole word or prefix) *and* one of `coming soon`, `coming-soon`, `not public-playable`, `not public playable`, `not yet playable`, `not yet public` fails the build** — as does any such line under a heading containing "stacked", even when the line itself never says it. The scan is line-based over the raw file and **fenced code blocks are not skipped**. `GOVERNED_DOCS` is exactly those three paths; the rest of `docs/` is unconstrained.

Today those files carry two coming-soon lines, neither at risk: `README.md:33` (`| Future cabinets | Various | Coming Soon | …`) and `docs/THIRD_PARTY_GAME_ONBOARDING.md:61` (`"status": "coming-soon",` inside the §3 sample manifest, under `## 3. Game Manifest`). **Never change that sample's example id to `stacked`** — it would fail the gate from inside a code fence the moment STACKED goes playable. While the manifest is `coming-soon` the trap is inert: only `playableManifests` reach `checkDocForStaleClaims()`.

---

## 2. Placeholder cabinet art

Owner decision, applied not re-argued: hand-authored SVG only, committed as source, no generator, no ingest script, no `assets:*` npm script, no real rotation set. A consistent art pass for every cabinet lands in a later dedicated cycle.

### 2.1 Files

Five hand-authored SVGs. Nothing under `apps/portal/assets/generated/` — that tree is owned by the Python ingest scripts and `npm run assets:verify`, and a hand-written file there is at risk from the next pipeline run.

| Path | viewBox | Referenced by | Byte cap |
| --- | --- | --- | --- |
| `apps/portal/assets/cabinet-stacked.svg` | `0 0 360 520` | `presentation.cabinetAsset` **and** every app-shell sprite frame | 4 KiB |
| `apps/portal/assets/cartridge-stacked.svg` | `0 0 120 160` | `presentation.cartridgeAsset` | 2 KiB |
| `apps/portal/assets/stacked-mode-select/stacked-mode-bg.svg` | `0 0 1600 900` | `CABINET_MODE_SELECT_PRESENTATIONS.stacked.backgroundAsset` | 6 KiB |
| `apps/portal/assets/stacked-mode-select/stacked-free-banner.svg` | `0 0 1200 525` | `…stacked.free.bannerAsset` | 6 KiB |
| `apps/portal/assets/stacked-mode-select/stacked-ranked-banner.svg` | `0 0 1200 525` | `…stacked.ranked.bannerAsset` | 6 KiB |

`cabinet-*.svg` / `cartridge-*.svg` sit flat in `apps/portal/assets/` where the existing placeholder family lives (verified present: `cabinet-chikun.svg`, `cabinet-generic-brawler.svg`, `cabinet-generic-pinball.svg`, `cabinet-generic-platformer.svg`, `cabinet-lester-blaster.svg`, `cartridge-block-brawler.svg`, `cartridge-chikun.svg`, `cartridge-lester-blaster.svg`, `cartridge-lilly-pinball.svg`, `cartridge-mega-lester.svg`), which keeps the later art pass greppable. The mode-select trio gets its own directory, mirroring `assets/generated/chikun-mode-select/` without living under `generated/`.

Rotator aspect is `512 / 560` (`.hmh-cabinet-rotator`, `apps/portal/styles.css`) with `object-fit: contain`, so `360 × 520` letterboxes cleanly. Do not chase a pixel-exact match.

### 2.2 Style

Copy the register of `apps/portal/assets/cabinet-generic-brawler.svg` — 880 bytes, single line, `viewBox="0 0 360 520"`, a cabinet body path, a marquee band with monospace text, a screen rect of flat colour blocks, a control deck. No gradients, no filters, no external references. Do **not** copy `cabinet-chikun.svg` (495 bytes, `200 × 280`, a "COMING SOON" plate) or `cartridge-chikun.svg` (374 bytes, `120 × 160`, "SOON") — wrong artefact for a cabinet that ships playable.

Reference content for `cabinet-stacked.svg` (colours follow the zone-0 `genesis-vault` palette in `visuals.md`; the shape and marquee text are load-bearing):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520">
  <path d="M56 38h248l32 72-24 376H48L24 110z" fill="#101a2e" stroke="#4ad6ff" stroke-width="8"/>
  <path d="M72 56h216l22 54H50z" fill="#050a16" stroke="#cfd8e3" stroke-width="6"/>
  <text x="180" y="91" text-anchor="middle" font-family="monospace" font-size="22" font-weight="900" fill="#cfd8e3">STACKED</text>
  <rect x="67" y="133" width="226" height="162" rx="14" fill="#050b16" stroke="#111" stroke-width="14"/>
  <rect x="96" y="236" width="38" height="38" fill="#4ad6ff"/><rect x="134" y="236" width="38" height="38" fill="#4ad6ff"/>
  <rect x="172" y="198" width="38" height="76" fill="#b48cff"/><rect x="210" y="236" width="38" height="38" fill="#ffd166"/>
  <path d="M84 392h192l20 74H64z" fill="#09101c" stroke="#4ad6ff" stroke-width="5"/>
</svg>
```

All five files: no `<script>`, no `<foreignObject>`, no `xlink:href` to another file, no embedded raster `data:` URI, no web font. One extra on the cabinet SVG: **no `#frame=x,y,w,h,aw,ah` fragment on the path** — `parseAtlasFrameRef()` in `apps/portal/src/atlas-frame-ref.mjs` would route the frame through a `<canvas>` atlas blit instead of an `<img>`, which does not work for vector sources.

### 2.3 How the cabinet entry references them

`ARCADE_GAMES` entry — copy the `chikun` shape (verified fields: `id`, `title`, `cabinet`, `genre`, `status`, `publicPlayable`, `devPlayable`, `developer`, `entryFeeMicroUsdc`, `livesPaid`, `livesFree`, `tagline`, `systemRole`, `rankedSeasonId`, `cabinetVersion`, `parentSystem`, `presentation`, `desktopCabinetSprite`):

```js
presentation: Object.freeze({
  medium: 'upright-cabinet',
  colorway: 'silver-neon-cyan',
  cabinetAsset: './assets/cabinet-stacked.svg',
  cartridgeAsset: './assets/cartridge-stacked.svg',
  marquee: 'STACKED',
}),
```

`presentation.marquee` is a plain string, not an asset path (verified against `chikun`, whose marquee is `'CHIKUN'`). There is no marquee image to author.

**The app-shell sprite is mandatory and must have exactly six frames.** `renderOfficialCabinets()` in `apps/portal/src/routes/official-play-routes.mjs` renders, in order: `desktopCabinetSprite` (rotating frames, adds `featured-cabinet-card`) → `bannerArt` (darkened `.cabinet-card-banner`) → a bare copy card; only `cabinet.id === 'hard-money-heroes'` gets a `productionCabinetSprite()` fallback. A one-frame sprite is **broken**: `renderRotatingCabinetSprite()` sets `--cabinet-frame-count`, but **nothing in `apps/portal/styles.css` reads it**.

```css
.cabinet-rotation-frame { animation: hmhCabinetFrame var(--cabinet-loop-duration) steps(1, end) infinite; animation-delay: var(--cabinet-frame-delay); }
@keyframes hmhCabinetFrame { 0%, 15.8% { opacity: 1; } 16%, 100% { opacity: 0; } }
```

The 16 % duty cycle is hard-coded for six frames (1/6 ≈ 16.67 %). With one frame `--cabinet-loop-duration` = 600 ms and the only frame is opaque 96 ms, transparent 504 ms — a **1.67 Hz strobe**; `:first-child { opacity: 1 }` does not save it, because a running animation beats a normal declaration. So: **six identical frames, `frameDurationMs: 600`** — chikun's shape, and the only frame count the CSS supports.

```js
desktopCabinetSprite: Object.freeze({
  id: 'stacked-cabinet',
  frameDurationMs: 600,
  frames: Object.freeze([
    Object.freeze({ src: './assets/cabinet-stacked.svg', durationMs: 600 }),
    // …five more identical entries; exactly six total
  ]),
}),
```

Six copies of one image means exactly one frame is opaque at any moment and the card reads as a still. A residual ~24 ms gap per 600 ms step exists today for every cabinet (16 % of 3,600 ms is 576 ms, not 600 ms) — pre-existing, shared with HMH and Chikun; note it in the cycle doc, do not fix it here. **Do not also set `bannerArt`**: the sprite branch wins and the banner is dead weight. When the art pass lands a rotation set with a frame count other than six, the keyframes must be rewritten to consume `--cabinet-frame-count`; record that as the art pass's prerequisite.

Mode select needs all three assets or the panel renders empty. `buildGameModeSelectModel(gameId)` is `CABINET_MODE_SELECT_PRESENTATIONS[gameId] ?? null`, keyed by the **`ARCADE_GAMES` id** (`renderOfficialModeSelect()` passes `selectedGame().id`); a `null` model renders the hard "Mode selection blocked safely" dead-end with both buttons disabled and `dataset.artStatus = 'unconfigured'`. The entry copies the two shipped entries (`lester-blaster`, `chikun`) exactly: `gameId`, `title`, `eyebrow`, `copy`, `artStatus`, `backgroundAsset`, `backgroundPosition`, plus `free` / `ranked` blocks carrying `label`, `official`, `icon`, `bannerAsset`, `bannerAlt`, `copy`. The ranked block additionally carries `requiresZkLtc`, `chainId: 4441`, `token: 'zkLTC'`, `faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl`; Chikun's blocks also carry `bannerPosition: 'center center'`, HMH's do not. Use `requiresZkLtc: false` (Chikun's value) while `entryFeeMicroUsdc` resolves to `0`. Set `artStatus: 'production'` **only when real art lands** — the route hides `dom.officialModeArtNote` on exactly that value, so a placeholder cabinet claiming `production` suppresses the note saying the art is placeholder. Copy is fed from the copy sheet (§8.2), not inlined.

### 2.4 Art test — `tests/stacked-cabinet-art.test.mjs`

For every asset path referenced by the `stacked` entries in `ARCADE_GAMES` (`presentation.cabinetAsset`, `presentation.cartridgeAsset`, every `desktopCabinetSprite.frames[].src`), `LESTERS_ARCADE_V2_APP_SHELL.cabinets`, and `CABINET_MODE_SELECT_PRESENTATIONS`: assert the file exists under `apps/portal/`, ends `.svg`, parses as XML with a root `<svg>`, is under its byte cap, and contains none of `<script`, `<foreignObject`, `xlink:href`, `data:image`, `#frame=`. Also assert `desktopCabinetSprite.frames.length === 6` (reason in a comment), that no STACKED entry sets `bannerArt`, and that `apps/portal/games/stacked/main.mjs` exists. Nothing else in the suite resolves these strings.

---

## 3. Manifest and the `docs:cabinets` gate

### 3.1 Manifest at each stage

`apps/portal/games/stacked/game.manifest.json`, enforced by `validateGameManifest()` in `apps/portal/src/game-manifest.mjs`.

```json
{
  "id": "stacked",
  "name": "STACKED",
  "version": "0.1.0",
  "runtimeVersion": "pixi-runtime-v1",
  "sdkVersion": "1.0.0",
  "status": "coming-soon",
  "aspectSupport": ["9:16", "16:9"],
  "controlScheme": "dpad-buttons",
  "capabilities": ["leaderboard", "achievements", "ranked", "audio", "haptics"],
  "rankedEligible": true,
  "entry": "./main.mjs",
  "endpoints": [],
  "devWallet": null,
  "description": "..."
}
```

- `id` must match `/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/` (3–48 chars). `stacked` passes.
- `name` must be 2–48 chars after trim, and because `parseReadmeRoster()` joins on it, it is the exact string the README roster's first cell must carry at ship. `validateGameManifest` reads `input.name ?? input.title`; write `name`, never `title`.
- `controlScheme: "dpad-buttons"` — `CONTROL_SCHEMES` is the frozen list `['twin-stick','single-stick','tap','dpad-buttons','pointer']`; nothing describes swipe+tap block handling and `dpad-buttons` is the honest closest fit. **Do not add an enum value.** Not because of checksum drift (`canonicalManifestPayload()` hashes the *value*, not the enum) but because `CONTROL_SCHEMES` is the published Cabinet SDK v1 contract documented to third parties in `docs/THIRD_PARTY_GAME_ONBOARDING.md` §3. `tests/game-manifest.test.mjs` does **not** pin the list — it only asserts an unknown value like `'mind-control'` is rejected — so a widening passes the suite silently. That is a reason for more caution, not less.
- `capabilities` is pinned in contract §3 as exactly `["leaderboard", "achievements", "ranked", "audio", "haptics"]`, in that order. `ranked` and `leaderboard` are both required or `rankedEligible: true` is a hard validation error; `audio` because the cabinet plays its own SFX. **`haptics` is included because haptics ship** — S-15 delivers `apps/stacked/src/haptics.mjs`, `STACKED_HAPTIC_PATTERNS`, `createHapticChannel` and a real `navigator.vibrate` call, gated by `tests/stacked-haptics.test.mjs` (`mobile.md` §12). An earlier draft of this bullet omitted it on the condition "unless touch haptics ship"; the condition is met. Note that `CAPABILITIES` (`game-manifest.mjs:35-41`) already contains `'haptics'`, so **both spellings validate and the drift is silent** — assert the pinned array, do not describe it.
- `runtimeVersion` is **not** validated and is dropped from the frozen normalized manifest, which keeps exactly `id, name, version, sdkVersion, status, aspectSupport, controlScheme, capabilities, rankedEligible, entry, endpoints, devWallet, description`. Keep it as human metadata; `chikun` carries it and the onboarding doc documents it.
- `endpoints: []`, `devWallet: null`. `endpoints` entries must be `https://` if ever added.
- `entry: "./main.mjs"` — the validator rejects only an empty string or an absolute `http(s)` URL; a dangling relative path passes and 404s at runtime.
- **Omit the `sandbox` block.** HMH's manifest carries `{ "allow": ["scripts"], "walletAccess": false, "sameOriginAccess": false }` and `tests/arcade-sandbox-security.test.mjs` asserts that shape for it. STACKED is first-party and mounts through its own host with same-origin access, exactly as HMH and Chikun do in practice; Chikun's manifest has no block. Do not add STACKED to that test.

**Ship stage:** `"status": "playable"`, `"version": "1.0.0"` (complete solo game, unlike Chikun's `0.5.0` vertical slice).

### 3.2 Manifest `version` vs `STACKED_CABINET_VERSION`

`ARCADE_GAMES[stacked].cabinetVersion` feeds `buildHash = site-<SITE_VERSION>:game-<GAME_VERSION>:cabinet-<cabinetVersion>`, which feeds `deriveSessionSeed()`. Chikun sources it from `CHIKUN_CABINET_VERSION = '0.5.0'` exported by `apps/portal/src/chikun-cabinet.mjs`; mirror with `STACKED_CABINET_VERSION = '0.1.0'` in `apps/portal/src/stacked-cabinet.mjs` (contract §3). **It changes only when the simulation changes** — it rotates every seed and retires the season's stored replays. The manifest `version` is a publish number and moves freely. They start unequal (`0.1.0` / `1.0.0`) and stay so; say this in the cycle doc so a later agent does not "tidy" them together.

### 3.3 The `docs:cabinets` contract, exactly

`scripts/cabinet-status-doc-drift-check.mjs` runs standalone (`npm run docs:cabinets`) and inside `npm test` via `tests/cabinet-status-doc-drift-check.test.mjs`, whose final case calls `assertCabinetStatusDocs()` with no arguments — real repo root, real manifests, real docs. `npm run test:release` re-runs every `tests/*.test.mjs` and `npm run vercel:build` runs `test:release`, so the gate is in the deploy path. It asserts:

1. **README roster row.** `parseReadmeRoster()` reads only the `## Current game roster` section (to the next `^## `) and keys rows by the **first table cell**, looked up as `roster.get(manifest.name)`. `checkRosterRow()` requires: `playable` → the State cell contains **none** of the six coming-soon phrases; not `playable` → **at least one**; and any `x.y.z` semver in the State cell (backticked or not) must equal `manifest.version`. A non-playable manifest with **no** row is skipped entirely (`if (manifest.status !== 'playable' && !roster.has(manifest.name)) continue;`) — that is how `template-cabinet` passes with no row.
2. **No stale claims** in the three `GOVERNED_DOCS`. A line with a coming-soon phrase fails if a *playable* cabinet is named on that line **or in the nearest preceding heading** (§1.3).

Ranked eligibility is deliberately **not** asserted — the script's header says so, because `rankedEligible` and `leaderboardEligible` are set independently.

| Stage | Manifest `status` | README roster row | App-shell flags |
| --- | --- | --- | --- |
| S-06 … S-21 | `coming-soon` | **omit the row entirely** | `playable: false, devPlayable: true` |
| S-22 ship commit | `playable` | add row; no coming-soon phrase, State carries `1.0.0` | `playable: true, leaderboardEligible: true` |

Omitting the row during development is deliberate: the gate skips non-playable manifests with no row, so nothing needs syncing while the cabinet churns. `?devCabinets=1` is the developer path — `DEV_CABINETS_ENABLED` is `new URLSearchParams(window.location.search).get('devCabinets') === '1'` and `cabinetPlayableInCurrentMode(cabinet)` returns `Boolean(cabinet?.playable || (DEV_CABINETS_ENABLED && cabinet?.devPlayable))`; a dev-only card renders with the `dev-cabinet` class and a `DEV HARNESS` label. `publicLeaderboardCabinets()` filters on `cabinet.playable && cabinet.leaderboardEligible !== false`, so a dev-stage STACKED never appears in the public board copy; set `leaderboardEligible: true` explicitly at ship anyway (Chikun does, HMH does not, and the asymmetry is confusing).

**The ship commit contains, atomically:**

1. `game.manifest.json` — `status` → `playable`, `version` → `1.0.0`.
2. `README.md` — a roster row whose first cell is exactly `STACKED`. Columns are `Cabinet | Game ID | State | Summary`; today three rows (Hard Money Heroes / `lester-blaster` / "Playable reboot candidate"; Chikun's Escape / `chikun` / "Public playable, Ranked-eligible (`0.5.0`)"; Future cabinets / Various / "Coming Soon"). Target:
   `| STACKED | \`stacked\` | Public playable, Ranked-eligible (\`1.0.0\`) | Original falling-block arcade cabinet with parent-seeded Ranked replay verification, live music-reactive projection, and 9:16 / 16:9 support |`
   The existing "Future cabinets … Coming Soon" row is fine: `Future cabinets` matches no manifest name and the line has neither "stacked" nor a STACKED heading scope.
3. `AGENTS.md` — a "Current game direction" paragraph naming STACKED as public playable and Ranked-eligible, plus a scan proving no coming-soon line sits under a heading naming it.
4. `docs/THIRD_PARTY_GAME_ONBOARDING.md` — STACKED is first-party and gets **no** reference-implementation section (that document's `## 5. Chikun's Escape` is for third-party onboarding); it is only scanned.
5. `apps/portal/src/arcade-core.mjs` — app-shell `playable: true`, `leaderboardEligible: true`; `ARCADE_GAMES` `status: 'playable'`, `publicPlayable: true`.

Verify with `npm run docs:cabinets` alone, then `npm test`. If the gate fires with a `(scoped by heading "…")` message, the offending line is not the one naming the cabinet — read the heading it reports.

### 3.4 `npm run check` — the un-globbed allowlist

`scripts/syntax-check.mjs` is an explicit, deliberately un-globbed allowlist: `NODE_CHECK_FILES` and `PY_COMPILE_FILES`, with a header comment stating there is no globbing and instructing that new modules be added by editing the array. Every new `.mjs` — the modules in contract §2.10, the `games/stacked/main.mjs` shim, the copy sheet, child modules under `apps/stacked/src/`, and **every new test file** — must be appended in the same commit.

What omission costs: a missing **test** file still executes (`npm test` globs `tests/*.test.mjs`; `test:release` uses `readdirSync(tests)`). What is lost is the `node --check` parse gate, and for non-test source modules that is the only gate that ever opens them. Cycle-doc checklist line: **"new `.mjs` count added to `NODE_CHECK_FILES` equals new `.mjs` count in the diff."**

### 3.5 Other registration gates

- `npm run repo:health:strict` fails above `SHIP_MAX_TRACKED_FILES = 8_000` or `SHIP_MAX_TRACKED_BYTES = 350 MB`. `git ls-files` reports **2,731** today; STACKED's whole footprint (5 SVGs, ~30 modules, 48 tests, 12 baselines, docs) is under 120 files. Not at risk; do not delete referenced assets to make room.
- `npm run design:tokens` (`scripts/design-token-guard.mjs`) reads only `apps/portal/styles.css`, `apps/portal/styles-arcade-polish.css` and `apps/portal/index.html`. **It does not scan `apps/portal/stacked/game.css`.** Keep the child stylesheet token-driven by review and say so in the cycle doc rather than claiming a gate that does not reach it.

---

## 4. Test plan

All node tests live in `tests/`, named `stacked-*.test.mjs`, run by `node --test tests/*.test.mjs` (`npm test`) and re-run by `npm run test:release`. **New tests must pass.**

`test:release` (`scripts/hmh-reboot-test-retirement-gate.mjs`) compares failures against `docs/hmh-reboot/LEGACY-TEST-RETIREMENT.json` (schema `hmh-reboot-legacy-test-retirement-v1`, `acceptedFailures` length **42**, `failed_file_count` **31**) and writes `docs/testing/hmh-reboot-test-retirement-gate.json`. **Never add a STACKED test to that ledger.** Three constraints that are easy to trip:

- The aggregate summary must report **zero** `cancelled`, `skipped` and `todo`. One `t.skip()`, `{ skip: true }` or `todo` fails the release gate outright — write conditional coverage as an explicit branch.
- Every failure event must be top-level (`nesting === 0`); a nested failure reports as `unexpected non-top-level test failure` even when ledgered.
- The raw `node --test` process must exit `1` and the reporter's stderr must be empty. A module writing to stderr on import fails the gate with no failing test.

Every test module is DOM-free and importable in plain Node. That is why the sim lives at `apps/portal/src/stacked-sim.mjs` (contract §2.10), not under `apps/stacked/src/`.

### 4.0 Test-file map

**The full set is forty-eight files.** Contract §2.10 enumerates them and `STACKED-CYCLES.md` schedules them cycle by cycle; neither an earlier sixteen-file list in the contract nor an earlier "16 + 8 = 24" count here was complete, and an implementer who treated a partial list as closed would drop `stacked-projection-firewall.test.mjs` and `stacked-copy-sheet.test.mjs` — both mandatory ship gates. Do not re-count from this section; read contract §2.10.

The eighteen this document specifies the content of:

`stacked-contracts.test.mjs` (contract §0 duplicate-declaration scan over `apps/`, `sdk/`, `scripts/`, `tests/`) · `stacked-sim.test.mjs` (§4.1) · `stacked-sim-determinism.test.mjs` (§4.2) · `stacked-replay-claim.test.mjs` (§4.3) · `stacked-input-codec.test.mjs` (§4.4) · `stacked-evidence-codec.test.mjs` (§4.4) · `stacked-bridge-protocol.test.mjs` (§4.5) · `stacked-parent-bridge.test.mjs` (§4.5) · `stacked-host.test.mjs` (§4.5) · `stacked-portal-lifecycle.test.mjs` (§4.5) · `stacked-run-integrity.test.mjs` (§4.6) · `stacked-run-lifecycle-states.test.mjs` (§4.7) · `stacked-public-integration.test.mjs` (§4.8) · `stacked-leaderboard-profile.test.mjs` (§4.9) · `stacked-copy-sheet.test.mjs` (§4.10) · `stacked-quality-tier.test.mjs` (§6.1) · `stacked-cabinet-art.test.mjs` (§2.4) · `stacked-run-summary-schema.test.mjs` (contract §4.4 bounds).

The other thirty are specified by the document that owns their area — `mechanics.md` (`stacked-difficulty-model`, `stacked-soak-pilot`), `visuals.md` §6.3 (`stacked-projection-firewall`, `stacked-zones`, `stacked-particle-system`, `stacked-flash-limiter`, `stacked-audio-band-analysis`, `stacked-audio-graph`, `stacked-root-fit`, `stacked-render-tree`), `mobile.md` (`stacked-layout`, `stacked-layout-hysteresis`, `stacked-touch-gestures`, `stacked-commit-queue`, `stacked-autoshift`, `stacked-input-device-parity`, `stacked-thermal-governor`, `stacked-haptics`), `integrity.md` (`stacked-replay-store`, `stacked-trust-column`, `stacked-sim-purity`), `portal.md` (`stacked-achievements`, `stacked-free-medals`, `stacked-player-settings`, `stacked-settings-hot-frozen`, `stacked-telemetry-contract`, `stacked-shell`, `stacked-bundle-budget`) and `versus.md` (`stacked-versus-table`, `stacked-match`).

**Two are mandatory ship gates and may not be deferred, descoped, or merged into another file:** `stacked-projection-firewall.test.mjs` (the twelve-case identical-`resultHash` proof that keeps every visual on the far side of the firewall) and `stacked-copy-sheet.test.mjs` (§4.10's naming scan, the only machine check that owner decision D-2's trademark rule holds in shipped strings). Every one of the forty-eight is appended to `NODE_CHECK_FILES`.

### 4.1 Pure simulation — `tests/stacked-sim.test.mjs`

Rules and constants are owned by `mechanics.md` and frozen in contract §2.1–§2.5; this is what the gate asserts.

| Area | Assertions |
| --- | --- |
| Rotation / kicks | Every piece × every rotation state × both directions resolves to the exact expected cell set on an empty board (golden fixture). Every wall-kick offset exercised at least once against a constructed blocking board; assert the chosen kick **index**, not just "it rotated". A rotation with no legal kick leaves the piece untouched and consumes no reset beyond `LOCK_RESET_CAP`. |
| Bag randomizer | 10,000 consecutive draws from one seed: every window of 7 is a permutation of the 7 piece ids, no repeat inside a window, max gap between two occurrences of one piece ≤ 12. Repeat over 256 seeds; invariant holds for all, and ≥ 250 produce distinct first-bag orderings (guards a collapsed seed mix). `bagRefills === 2 + floor(pieces / 7)` exactly; `bagDraws >= 6 * bagRefills`. |
| Scoring | Table-driven from contract §2.4: one case per (clear count × spin kind × `chainActive` × `comboCount` × `level`), exact integer awarded. `Math.floor(scaled * 3 / 2)` for a `CHAIN` clear, never `* 1.5`. Combo term saturates at `STACKED_COMBO_BONUS_CAP = 20`; level saturates at `STACKED_LEVEL_CAP = 30`. A four-line clear always scores `HALVING` (800), spin or not; a spin row **replaces** the plain clear row, never sums. **No clamp at `STACKED_MAX_SCORE` inside `step()`** — a run legally past 1e9 keeps accumulating. Score monotonic in `level`; no path yields a non-integer or a negative delta. |
| Rising ledger | Contract §2.5 exactly: first REORG at `GARBAGE_START_TICK = 3_600`; interval `720` stepping down `30` every `2_700` to `GARBAGE_INTERVAL_FLOOR_TICKS = 120`, floor reached at tick **57,600**; `GARBAGE_ROWS_PER_INJECTION = 1`; `GARBAGE_PENDING_MAX = 8` → `garbage-out`; hole repeats the previous column with probability `3/5`, drawn from the `garbage` substream and never the `bag` substream; **one RNG draw per garbage group, not per row** (`garbageGroups` recorded, never inferred). Garbage never inserts while a lock is resolving. The two-player attack table is exported, frozen, and has **no consumer** in the shipped graph (grep assertion over `apps/`). |
| Terminal conditions | Each independently: `block-out`, `lock-out` (all four cells at `y >= BOARD_VISIBLE_ROWS`), `garbage-out`, `tick-ceiling` (`tick >= STACKED_MAX_TICKS`), `evidence-ceiling` (encoded bytes `>= STACKED_MAX_EVIDENCE_BYTES`). Each sets the terminal flag with a distinct `terminalReason`, freezes the result, and makes a further `step()` throw. `STACKED_TERMINAL_REASONS` is exactly `['block-out','lock-out','garbage-out','tick-ceiling','evidence-ceiling']` and frozen; all five rank normally, none is a rejection. |
| Board shape | `BOARD_WIDTH = 10`, `BOARD_VISIBLE_ROWS = 20`, `BOARD_BUFFER_ROWS = 4`, `BOARD_ROWS = 24`. No piece ever rests above row 23; `pressure.maxStackHeight` can never exceed `BOARD_ROWS`. |
| Zone advance | `zoneForTick(tick)` is a pure function of tick — not wall clock, not an animation completing, not score. Assert the mapping table directly, and that a top-out on the exact tick of a zone boundary gives the same canonical result as one a tick either side. The 150-tick transition is projection; nothing in the sim may await it. |
| Step contract | `step()` throws on a non-plain-object input, on a mask outside `0..255`, and after terminal. Source scan: `apps/portal/src/stacked-sim.mjs` contains none of `Date.now`, `performance.now`, `Math.random`, `Math.hypot`, `Math.sin`, `Math.cos`, `Math.pow`. `Math.hypot` is banned specifically because its result is implementation-defined in ECMA-262 — do not inherit it from an existing cabinet. |

### 4.2 Determinism — `tests/stacked-sim-determinism.test.mjs`

One canonicaliser next to the sim:

```js
export function canonicalStackedResultJson(result) // explicit ordered field list, integers only
export function stackedResultDigest(result)       // FNV-1a-64 over that string; logging only, never a verification input
```

Verification compares **field by field against the explicit list**, not `JSON.stringify` equality, so key order never becomes load-bearing across a season of stored claims.

1. Same seed + same stream → byte-identical canonical JSON, twice in one process and once through a fresh module instance.
2. Different seed → divergent result (guards a seed accepted and ignored).
3. **Quality-tier invariance:** same seed + inputs run four times — `desktopHigh`, `desktopLow`, `mobile`, and once with the `reducedMotion` modifier — identical canonical JSON. The tier is a render argument the sim never receives; the test proves it.
4. **Audio invariance:** the band feed supplied as absent, all-zero, and a scripted 60 Hz series → identical canonical JSON.
5. **Import-graph proof:** `apps/portal/src/stacked-sim.mjs` imports nothing but `./seeded-rng.mjs` and `./stacked-contracts.mjs` — in particular nothing from the audio-analysis module, the Pixi vendor, or `apps/stacked/src/`. The cheapest structural guarantee that projection cannot reach simulation, and worth more than any behavioural test.
6. **Golden vector:** `tests/fixtures/stacked-golden-run.json` — seed, input stream, expected canonical JSON, expected digest. Any change is a deliberate `STACKED_CABINET_VERSION` bump, flagged in review.
7. **Ticks, not frames.** The stream is strictly increasing in tick index; replay produces the same tick count; survival is `survivalTicks` with seconds derived as `ticks / 60`; `totals.elapsedMs === round(survivalTicks * 50 / 3)` ± 1. Catch-up saturation drops simulated time, so a wall-clock survival metric is device-dependent and must not be stored.
8. **Batching invariance:** the canonical result depends on the stream alone regardless of batching — 1 step per call, 4 per call and 240 at once must agree, with `STACKED_MAX_CATCH_UP_STEPS = 4` capping any single frame.

### 4.3 Replay claim — `tests/stacked-replay-claim.test.mjs`

Round trip `buildStackedReplayClaim` → `verifyStackedReplayClaim` returns the canonical result. Then a tamper matrix, each case asserting a **throw**, not a falsy return: wrong `seed` · wrong `buildHash` · wrong `seasonId` · claim `version` altered · submitted `score` +1 · any single secondary stat mutated · one transition removed · one added · transitions reordered · evidence truncated (the SIC1 terminator's final tick index no longer equals the header's total-ticks field) · header `fixedStepHz` ≠ 60 · a reserved lead byte `0x81`–`0xFE` present · a non-null-prototype claim object · an extra key · a chunked stream with a missing or duplicated chunk index.

Plus: the verifier's return value is used for the write, never the submitted numbers — assert the lifecycle passes `canonical.score`.

**Where the hook goes.** Chikun's precedent is inside `recordScore()` in `apps/portal/src/arcade-core.mjs`: `if (session.leaderboardEligible && game.id === 'chikun') verifyChikunReplayClaim({...})`, with `runStats.replayClaim` stripped off the persisted stats first. STACKED needs that branch **and** the lifecycle-side call in `stacked-portal-lifecycle.handleResult()`; assert both, because a lifecycle-only check is bypassable by any other `recordScore` caller.

### 4.4 Input codec, evidence chunking, and the ceilings

The `SIC1` codec (one `uint8` held-state mask per tick, transition-encoded) is specified in `integrity.md` and frozen in contract §2.3. This section owns the message-size budget and the assertions.

**Chunk-size derivation** (frozen as `STACKED_EVIDENCE_CHUNK_RAW_BYTES = 42_000` / `STACKED_EVIDENCE_CHUNK_B64_CHARS = 56_000`). The bridge cap is `STACKED_MAX_MESSAGE_BYTES = 64 * 1024 = 65,536`, measured as `new TextEncoder().encode(JSON.stringify(message)).byteLength` **of the whole message object** — the measurement `sdk/hmh-bridge-protocol.mjs` uses and `apps/portal/src/chikun-bridge-protocol.mjs` mirrors as `CHIKUN_MAX_MESSAGE_BYTES`. The envelope (`protocol`, `type`, `sessionId`, `messageId`, `chunkIndex`, `chunkCount`, `totalRawBytes`, framing) costs ≤ **4,096** bytes, leaving `65,536 − 4,096 = 61,440` usable base64 chars = **46,080** raw bytes. 42,000 leaves margin and `42,000 = 14,000 × 3`, so every boundary lands on a base64 3-byte group with no interior `=`. `56,000 = 42,000 × 4 / 3`, exact.

Chikun's single-message shape does not generalize: its evidence is `{ version, seed, fixedStepHz, maxTicks, flapSteps }` with `flapSteps` at most 4,096 increasing integers, ~7 bytes each, ~29 KB worst case. A god-tier STACKED stream is ~120,000 transitions ≈ 132,000 raw bytes, hence chunking (contract §4.1).

**The ceilings** (derived in contract §2.2/§2.3): `STACKED_MAX_TICKS = 432_000` (2 h at 60 Hz), `STACKED_MAX_EVIDENCE_BYTES = 1_302_000` (structural worst legal encoding **1,299,429 B**, rounded up to `31 × 42,000`), `STACKED_MAX_EVIDENCE_CHUNKS = 33` (two above the 31 the byte ceiling implies, so envelope rounding cannot make a legal stream illegal). `1,302,000 ÷ 432,000 = 3.014` bytes/tick against a 3-byte worst record with at most one record per tick, so **the tick ceiling provably fires first**; `'evidence-ceiling'` is unreachable in legal play and only bounds the parent's reassembly buffer against a hostile or broken child. Both are terminal conditions inside the sim, scored and submitted normally — the encoder stops the run, it never drops records.

**`tests/stacked-input-codec.test.mjs`:**

- Encode → decode → identity for 10,000 randomly generated legal mask streams.
- Short form (`0DDDDBBB`, gap 1–16, single toggled bit) and general form (`0x80`, LEB128 gap−1, absolute mask) each round-trip, and a mixed stream round-trips.
- The terminator (`0xFF`, LEB128 final tick index) must be reached, and decode **rejects** unless that index equals the header's total-ticks field — assert a truncated stream is rejected on exactly that check.
- Lead bytes `0x81`–`0xFE` rejected, never skipped. Header FNV-1a-32 over bytes `[24 .. end]` mismatch rejected before any decode.
- Recorder invariants: at most one record per tick index; tick 0's mask forced to `0`; a synthesised mask-`0` record on pause, `blur`, and `visibilitychange` to hidden.
- Decode rejects a gap of zero, a tick index beyond the header's total ticks, and trailing bytes after the terminator.

**`tests/stacked-evidence-codec.test.mjs`:**

- A synthetic 40-minute god-tier stream (144,000 ticks, ~120,000 transitions) encodes to ≤ **140,000** raw bytes and splits into ≤ **4** chunks (`ceil(bytes / 42_000)`). A 3-minute beginner stream (10,800 ticks, ~6,000 transitions) fits in **1**. Pin both as named constants; if either fails, the encoding changes, not the constant.
- The structural worst case at `STACKED_MAX_TICKS` encodes to **1,299,429** bytes ≤ `STACKED_MAX_EVIDENCE_BYTES`, and `ceil(1_299_429 / 42_000) = 31 <= 33`.
- **Ordering, asserted directly:** a stream at the worst legal record density terminates on `'tick-ceiling'`, never `'evidence-ceiling'`.
- Reassembly rejects, all **before** any decode or simulation work: a missing index, a duplicated index, a `chunkCount` mismatch, a `totalRawBytes` mismatch, more than 33 chunks, a reassembled length over the byte ceiling, a bad `"SIC1"` magic, a header-checksum mismatch.
- Every chunk message, JSON-serialised with its envelope, is under 65,536 UTF-8 bytes, asserted with the protocol validator's own measurement.
- `STACKED_MAX_TICKS` is enforced by the sim as a terminal condition **and** by the protocol validator as a bound on decoded ticks: one tick over is rejected. Same for the byte ceiling, one byte over.
- A stream above `STACKED_MAX_STORED_REPLAY_CHARS = 240_000` base64url chars is not stored locally, reason `replay-too-large`, and **still ranks**. Assert the 2-replay LRU (most recent Ranked + personal best) and that the replay write happens **after** the score write.

### 4.5 Bridge, host, lifecycle

`tests/stacked-bridge-protocol.test.mjs` — exact-key acceptance and rejection per message type (extra key, missing key, wrong type all rejected), matching the `exactKeys(...)` discipline in `apps/portal/src/chikun-bridge-protocol.mjs`; the 65,536-byte serialized cap; `session` validated as exactly `['seed','buildHash','seasonId','rankedEligible']`; `session.seed` an integer in `[0, 0xffffffff]`; `fixedStepHz === 60`; `session.rankedEligible === (mode === 'ranked')`; `gameId === 'stacked'`; and **`startLevel` present in `settings`, absent from `session`** — the structural reason a Free-mode start level cannot reach the seed. Parent→child is exactly the **six** of contract §4.1 — `portal:init`, `portal:settings`, `portal:pause`, `portal:resume`, `portal:exit`, `portal:audio-frame` — and child→parent exactly the five `game:ready`, `game:state`, `game:evidence-chunk`, `game:result`, `game:error`. `portal:audio-frame` carries the live band vector for owner decision D-5 (`visuals.md` §2.8); its payload is exact-key validated as `{ audio: { t, sub, bass, lowMid, mid, high, level, onset, beatPhase, bpm, available } }`, all integers but the two booleans, and it is the one parent→child type that is **droppable** — a missed frame is a visual stutter, never a state error. Assert the send rate stays at 30 Hz against a 60 messages/second ceiling in either direction. An evidence chunk sent as a `game:run-event` is rejected (that payload's `value` validates as a finite number; a base64 chunk is a string).

`tests/stacked-parent-bridge.test.mjs` — child-origin equality on the iframe `src`; `sessionId` binding on every child message; a replayed `messageId` rejected; a protocol error tears the bridge down.

`tests/stacked-host.test.mjs` — mirror `apps/portal/src/chikun-host.mjs`: `mountSession` sets `document.documentElement.dataset.embeddedCabinet = 'stacked'` and `destroy` deletes it **only when it still holds `'stacked'`** (chikun's `else if (dataset.embeddedCabinet === 'chikun') delete …` guard — with three cabinets an unconditional teardown clears a flag another cabinet just set); a positive finite `readyTimeoutMs` is required and a READY timeout destroys the session; `mount.replaceChildren(iframe)` leaves exactly one iframe and `destroy()` calls `mount.replaceChildren()`; a run-summary identity mismatch (seed / buildHash / mode) destroys the session.

`tests/stacked-portal-lifecycle.test.mjs` — the one-shot `finalized` latch rejects a second result; Ranked writes `canonical.score` only after verification; a restart request in Ranked is refused at the host, not merely hidden in UI; the soak pilot is refused when `mode === 'ranked'` (§6.3); re-simulation happens **exactly once** and correctness does not depend on the Web Worker existing (the inline fallback produces the same canonical result); the verifier is registered via `registerRunVerifier('stacked', fn)` so no new import edge into `arcade-core.mjs` is created.

**Free-mode isolation, precisely.** `recordScore()` returns `{ acceptedForGlobalLeaderboard: false, trackingDisabled: true, localScore, unlockedAchievements: [] }` for a non-`leaderboardEligible` session — but reaches that return *after* `ensureProfile(state, session.wallet)` and `ensureGameProgress(profile, game.id)`, so it does create the profile and the empty progress slot. **"Free mode mutates nothing" is false and must not be asserted.** Assert instead: no cadence-leaderboard row, no flat-leaderboard row, no `profile.totalPaidRuns` increment, no `profile.xp` change, no `updateProgressFromRun` effect, no achievement unlock, no persist call, no write to `stacked-replay-v1:*`. The Free medal shelf writes only `stacked-free-medals-v1` and never touches the profile, boards, XP, rank, or achievements.

### 4.6 Integrity gate — `tests/stacked-run-integrity.test.mjs`

`apps/portal/src/hmh-run-integrity.mjs` **is** wired and is a live precedent: `apps/portal/main.js` imports `validateRunPlausibility` at line 272 and calls it in the ranked settlement path at line 2798, gating publication on `integrity.rankable` and logging a `suspicious` verdict; `apps/portal/src/web3-live-readiness.mjs` imports `buildReplayVerificationEnvelope`.

Copy its shape into `apps/portal/src/stacked-run-integrity.mjs`, exporting `STACKED_INTEGRITY_TOLERANCE`, `deriveStackedRunCeilings`, `validateStackedRunPlausibility`. Call it from `stacked-portal-lifecycle.handleResult()` **before** re-simulation (cheap pre-filter on the submitted numbers) and again after, against the canonical numbers. Flag definitions belong to `integrity.md`; the gate asserts:

- Frozen return `Object.freeze({ ok, verdict, rankable: verdict !== 'rejected', flags, ceilings })`, `verdict ∈ 'ok' | 'suspicious' | 'rejected'` — matching HMH, where `rejected` blocks the write and `suspicious` is logged and allowed. `flags` entries are `{ code, severity, detail }` to match `leaderboardRowTrust`'s tooltip renderer.
- The function takes exactly the sixteen fields in contract §4.5 (`score, pieces, lines, level, maxCombo, quadClears, perfectClears, ticks, garbageRowsReceived, garbageRowsCleared, garbageGroups, garbageDraws, holdsUsed, bagRefills, bagDraws, transitionCount`); an extra or missing key is rejected.
- One case per reject flag against the frozen ceilings — `score-implausible`, `lines-exceed-ceiling` (`> STACKED_MAX_LINES = 86_400`, from `STACKED_MAX_PIECES = 216_000` at `STACKED_MIN_PLACEMENT_TICKS = 2`), `quad-clears-exceed-lines`, `combo-exceeds-clears`, `level-inconsistent-with-lines` (`level !== min(30, 1 + floor(lines / 10))` in Ranked), `bag-refill-mismatch` (`bagRefills !== 2 + floor(pieces / 7)`), `garbage-exceeds-rise-rate` — and one case per suspect flag.
- **`garbage-exceeds-rise-rate` imports `GARBAGE_INTERVAL_FLOOR_TICKS = 120`** and bounds with `floor((ticks - GARBAGE_START_TICK) / GARBAGE_INTERVAL_FLOOR_TICKS) + 1`, clamped at 0 below `GARBAGE_START_TICK = 3_600`. There is no flat `GARBAGE_RISE_INTERVAL_FRAMES`; the interval is a curve and only its minimum keeps the bound sound at every point. Assert at ticks 3,600 / 30,000 / 57,600 / 432,000.
- The wiring assertion that keeps it alive: read `apps/portal/src/stacked-portal-lifecycle.mjs` and assert it imports and calls `validateStackedRunPlausibility`, both before and after re-simulation.

### 4.7 Interrupted, paused, hidden, resized — `tests/stacked-run-lifecycle-states.test.mjs`

Each is a determinism hole if guessed. These are contract, not suggestion.

- **Pause.** Free may pause freely. In Ranked pause is permitted but is **not a simulation event**: no `step()` calls, no tick advance, no record except the synthesised mask-`0` release (§4.4). Assert pausing at tick *T* for any number of real seconds gives the same canonical JSON as never pausing. **Do not implement pause as an action bit** — pause is not an input bit and nothing presentational ever is.
- **Tab hidden / catch-up.** `requestAnimationFrame` stops in a hidden tab. The loop caps catch-up at `STACKED_MAX_CATCH_UP_STEPS = 4` per frame (the `AGENTS.md` rule, and what `DeterministicSimulation` in `apps/hmh-reboot/src/simulation.mjs` already does) and drops the remainder. Assert a 60-second hidden interval advances ticks by at most `4 × framesElapsed`, and that the canonical result depends on the recorded stream alone regardless of batching.
- **Resize / orientation.** Projection-only, unconditionally: a viewport change mid-run may not alter board dimensions, the piece set, gravity, lock delay, the garbage curve, or the input action mapping. 9:16 and 16:9 differ only in HUD / next / hold placement, decided by `layoutMatch()` in `apps/portal/src/stacked-layout.mjs`, never by a view. Assert a fixed seed and stream with a resize from 1440×900 to 390×844 injected at tick 300 gives the same canonical JSON. Touch controls re-lay-out without dropping a held input — a held soft-drop ending because the button moved is a recorded mask change and would diverge; assert the held bit survives.
- **Interruption.** A Ranked run interrupted by navigation, reload, bridge teardown, host `destroy()`, or a READY timeout is **abandoned: not resumable, not partially scored.** No delivered chunk may be used, no row is written, `activeSessionCheckpoint` is cleared for that `sessionId` with `{ submitted: false }` (the `clearActiveSessionCheckpoint` call shape `main.js` already uses), and the `finalized` latch is set so a late `game:result` is refused. Assert each entry point independently. `abandoned` is a run-history lifecycle state and **never a `terminalReason`** — assert it never appears in a result tuple or run summary. Free interruption is a no-op by construction.
- **Music source absent.** The analyser tap degrades, never throws: if `arcadeMusicAudio` is paused, has no current track, or the `AudioContext` is suspended by autoplay policy, the projection feed falls back to the same frozen neutral band vector `evidenceSafe=1` pins. Assert live audio, silent audio, and no `AudioContext` at all give identical canonical JSON — §4.2 item 4 requires this of the sim; this states the runtime side so the fallback exists to be tested.

### 4.8 Registration parity — `tests/stacked-public-integration.test.mjs`

Assert the same id string appears in `ARCADE_GAMES`, `LESTERS_ARCADE_V2_APP_SHELL.cabinets` (with `gameId` matching), `CABINET_MODE_SELECT_PRESENTATIONS`, both exported router tables (`ARCADE_GAME_SLUGS`, `ARCADE_GAME_IDS_BY_SLUG`), and the manifest; that `validateGameManifest()` accepts the on-disk file; that `gameSlugFor('stacked') === 'stacked'` (**not** `'hard-money-heroes'`, the silent `DEFAULT_GAME_SLUG` fallback); `gameIdForSlug('stacked') === 'stacked'`; and `gameIdForSlug('stack') === 'stacked'` while `gameSlugFor('stacked')` still returns `'stacked'` — the alias lives in `ARCADE_GAME_IDS_BY_SLUG` only, and putting it in `ARCADE_GAME_SLUGS` is silently inert.

`REGISTERED_GAMES` is module-private (a bare `const`, deliberately unfrozen because `registerGame()` mutates it). Prove registration through the public surface: `getRegisteredGame('stacked')` non-null with `adapter === 'games/stacked/main.mjs'`, `status === 'live'`, `feeSplit` summing to 100; `listRegisteredGames().map((g) => g.id)` contains `'stacked'`.

`GAME_TITLE_BY_SLUG` in `apps/portal/src/arcade-router.mjs` is also module-private. Prove it through `buildPlatformShellModel('mode-select', { gameSlug: 'stacked', connected: true }).breadcrumbs`, which must contain a crumb labelled `STACKED` — it fails if the slug is missing, because the lookup falls back to `GAME_TITLE_BY_SLUG[DEFAULT_GAME_SLUG]` = "Hard Money Heroes".

Also assert `apps/portal/games/stacked/main.mjs` exists and re-exports the deterministic core, and that no module under `apps/stacked/src/` imports `game-adapter.mjs` or `game-manifest.mjs` (that chain statically imports `apps/portal/vendor/ethers.min.js` for one keccak hash and pulls `dist/chunks/chunk-VSG3JNSZ.js`, **392,452 bytes**, into the cold load; `ARCADE_SDK_VERSION` is imported from `arcade-sdk.mjs` directly).

### 4.9 Leaderboard and profile — `tests/stacked-leaderboard-profile.test.mjs`

- `createInitialArcadeState()` produces `leaderboards.stacked` and `cadenceLeaderboards.stacked`. Both are `Object.fromEntries(ARCADE_GAMES.map(...))`, so this assertion **is** the registration proof — no separate wiring exists to forget, and it holds irrespective of `status`.
- A ranked `recordScore` writes one row into all five cadences (`daily`, `weekly`, `monthly`, `yearly`, `all-time`) and into the flat top-10.
- **The stored `runStats` bag is exactly the 16-key projection** (contract §4.4) and nothing else: `score, linesCleared, survivalTicks, maxCombo, quadClears, level, zoneReached, pieces, spins, spinClears, maxBackToBack, perfectClears, garbageRowsReceived, terminalReason, resultHash16, trust`. Assert the exact key set. `runStats` is persisted verbatim inside `cadenceLeaderboards`, and `apps/portal/src/persistence.mjs` degrades a quota failure by dropping `avatarDataUrl` and then **the entire `cadenceLeaderboards` slice**; a fat bag × 200 rows per period (`applySeedLeaderboard` uses `limitPerPeriod: 200`) × 5 cadences × 3 games is how boards disappear. `resultHash16` is the first 16 hex chars of the 66-character `resultHash`; the full hash is never persisted into a row.
- Free-mode isolation exactly as §4.5 states it.
- **Achievement scoping.** `recordScore` calls `maybeUnlockRunAchievements(profile, score, runStats, progress)` with no gameId, and that function unconditionally unlocks `ACHIEVEMENTS.FIRST_PAID_RUN` before evaluating the rest — so a Chikun ranked run already unlocks HMH achievements today. STACKED must not add a third cabinet to the leak. The fix belongs in `arcade-core.mjs`: thread `game.id` into `maybeUnlockRunAchievements` and scope each achievement to the cabinets defining it. Assert a `stacked` ranked run unlocks only the 16 `stacked-*` achievements (including `stacked-first-quad` and `stacked-quad-10`) **and** that HMH's unlocks are byte-identical for a `lester-blaster` run, because this touches shipped behaviour. If scoping is deferred under gate G-8, record it in the cycle doc as a known defect rather than asserting a behaviour that does not exist.
- **No STACKED seed rows.** `applySeedLeaderboard(state, gameId, recordFn, options)` is invoked in `main.js` exactly once, as `applySeedLeaderboard(state, 'lester-blaster', recordCadenceScore, { count: 50 })`, and `buildSeedLeaderboardEntries` produces HMH-shaped `runStats` (kills, surviveSeconds, level, tier, combo, weapon) under `0xSEED`-prefixed synthetic wallets. Assert STACKED's boards start empty; a synthetic row would be indistinguishable from a real one on a board sorted by score.
- **Leaderboard route.** `apps/portal/src/routes/official-leaderboard-route.mjs` hard-codes eleven columns (`rank, name, score, kills, survive, level, combo, powerups, trust, detail, date`) and switches labels and values on one boolean, `const chikunBoard = routeState.gameId === 'chikun'`, with a ternary per column in both `cols` and `getVal`. `portal.md` owns the replacement — a per-`gameId` table of `{ key, label, sortKey, value(entry) }` rows defaulting to the HMH list. Assert here that `stacked` resolves to the six STACKED columns — `score` · `linesCleared` (`LINES`) · `survivalTicks` (`SURVIVED`, rendered `ticks / 60`) · `maxCombo` (`COMBO`) · `quadClears` (`HALVING`) · `level` (`LVL`) — and that HMH's and Chikun's rendered labels and values are **byte-identical before and after**. Do not inherit the pre-existing defect: `getVal`'s `default: return e.score` means `rank` and `trust` already sort by score while the header arrow sits on their column. Every column declares its own accessor; there is no `default`.
- **Profile route.** The STACKED tab renders from `profile.progress.stacked` (durable custom stats under `.custom`), **not** `state.sessions` — `state.sessions` is created by `createInitialArcadeState()` but is not in the persistence snapshot (which carries only `version`, `savedAt`, `seeded`, `profiles`, `usernames`, `cadenceLeaderboards`, `runHistory`, `activeSessionCheckpoint`, `submittedSessionIds`), so an inline reduction over sessions shows empty after every reload.
- **Persistence.** Adding `profile.progress.stacked` and `cadenceLeaderboards.stacked` requires **no** `ARCADE_PERSIST_VERSION` bump — profiles and the cadence map are copied wholesale. Assert a round trip through `saveArcadeState`/`restoreArcadeState` at version 3 preserves them. **Do not bump to 4:** `restoreArcadeState` returns `false` unless `snapshot.version` is in `[1, 2, ARCADE_PERSIST_VERSION]` and there is no migration step, so a bump silently discards every existing save.

### 4.10 Copy sheet and naming — `tests/stacked-copy-sheet.test.mjs`

The trademark rule is a shipped-strings rule and needs a shipped-strings gate. Scan the concatenation of: copy-sheet texts, the manifest JSON, the STACKED entries in `arcade-core.mjs`, every STACKED achievement `id` / `title` / `description`, the version strings (`SIC1`, `stacked-bridge/v1`, `stacked-result-v1`, `stacked-run-payload-v1`), the particle preset ids, the plausibility flag codes, and the child runtime's user-facing string table. Assert the trademarked genre name and the trademarked term for a four-line clear appear in **none** of them in any case, and that the four-line clear is referred to only as `HALVING` in display copy and only by the root `quad` in identifiers (`quadClears`, `stacked-first-quad`, `stacked-quad-10`, preset `quadClear`, flag `quad-clears-exceed-lines`, `clearType: 'quad'`).

The banned pattern is a `RegExp` in `STACKED_COPY_STYLE_RULES.bannedPlayerFacingPatterns`, so the module defining it necessarily contains the string. **The scan must exclude the rule-definition module from its own input**, the way `scripts/hmh-security-audit-sweep.mjs` skips itself with `if (rel === 'scripts/hmh-security-audit-sweep.mjs') continue;`.

Also assert the copy-sheet style rules exactly as `validateHmhCopySheet` does: `maxHeadlineChars: 42`, `maxBodyChars: 190`, and the banned patterns `em-dash` (`/—/`), `paid-testnet` (`/\bpaid\b/i`), `prototype-mode` (`/\bprototype\b/i`).

**Scope the em-dash rule to authored copy, not to rendered values.** `collectStackedCopyTexts()` returns the copy sheet's authored strings only. It must **not** collect placeholder or separator glyphs the renderer emits from data — in particular `portal.md` §9.2's cadence rank strip, which renders `—` where `playerRank` is null and `·` between cells. Those are rendered values chosen for typographic alignment in a fixed-width row, not player-facing prose, and `tests/stacked-leaderboard-profile.test.mjs` (§4.9, S-20) asserts the em-dash placeholder is present. Without this scoping the two tests collide at S-22: one asserts the glyph exists, the other bans it. If a future change routes the placeholder through the copy sheet, change the placeholder to a hyphen at the same time.

### 4.11 Browser smoke — `scripts/stacked-ranked-browser-smoke.mjs`

Model on `scripts/chikun-ranked-browser-smoke.mjs`: Playwright chromium at `process.env.STACKED_BROWSER_EXECUTABLE ?? process.env.CHROME_EXECUTABLE_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe``, a mock `globalThis.ethereum` injected via `page.addInitScript`, env-driven `STACKED_PORTAL_ORIGIN` (default `http://127.0.0.1:8791`), `STACKED_VIEWPORT` (`WIDTHxHEIGHT`, default `1440x1000`, validated against `/^(\d+)x(\d+)$/`), `STACKED_MODE` (`free` | `ranked`, default `ranked`), and `MIN_TOUCH_TARGET_PX = 44` with the same sub-pixel epsilon the chikun smoke uses.

Flow, asserted end to end: splash → cabinet floor → STACKED card enabled → mode select renders (not the "blocked safely" dead-end; assert `dom.officialModeSelect.dataset.artStatus !== 'unconfigured'`) → Ranked → wallet connect → gameplay mounts one iframe → child reaches READY → scripted inputs produce a real line clear → top out → result verified → leaderboard row present → profile tab shows the run → exit back to the floor.

Hard assertions: zero `pageerror`; zero `console` errors **including zero CSP violation reports**; exactly one `<canvas>` in the child; `document.documentElement.dataset.embeddedCabinet === 'stacked'` while mounted and absent after exit; every touch target ≥ 44 px on the mobile viewport; the child-reported `evidenceDigest` equal to a digest recomputed in Node from the same seed and reassembled stream. Run at `1440x1000` and `390x844`, **sequentially**.

### 4.12 Gate commands

| Command | What it proves for STACKED | When |
| --- | --- | --- |
| `npm run check` | every new `.mjs` is in `NODE_CHECK_FILES` and parses | every commit |
| `npm test` | all `stacked-*.test.mjs` plus `docs:cabinets` via its test | every commit |
| `npm run docs:cabinets` | manifest / README / AGENTS / onboarding agreement | status-flip commit |
| `npm run build` | the `stacked/game` entry bundles; `HMH_INITIAL_JS_CAP` still holds | any runtime change |
| `npm run test:release` | full suite against the retirement ledger — 0 unexpected failures, 0 skipped/todo | before any push |
| `npm run design:security-audit` | no `.innerHTML =` / `.outerHTML =` / `eval(` / `new Function(` / inline secrets | any UI change |
| `npm run design:third-party-security` | HMH sandbox contract unchanged | any manifest/sandbox change |
| `npm run design:tokens` | `styles.css` + `styles-arcade-polish.css` still token-driven (**not** the child stylesheet) | any portal CSS change |
| `npm run repo:health:strict` | ≤ 8,000 files / 350 MB | before ship |
| `npm run docs:links` | new docs have no broken links | doc commits |
| `npm run assets:verify` | existing HMH/Chikun generated-asset manifests untouched | before ship |
| `npm run contracts:check` | no contract drift | before ship |
| `npm run vercel:build` | the deploy path (`assets:hmh:curated-level-kit-runtime → assets:verify → test:release → check → contracts:check → build`) | before ship |
| `npm run visual:stacked` | render-layer baselines (§5); needs a prior `npm run build` | any render change |
| `npm run visual:responsive` | portal DOM at five viewports incl. the new `stacked-mode-select` state | any portal layout change |
| `npm run smoke:stacked:performance` | frame / heap / bundle budgets (§6) | any runtime change |
| `npm run test:soak:stacked` | 40-minute leak gate (§6.3) | before ship |
| `node scripts/stacked-ranked-browser-smoke.mjs` | the real flow | before ship, both viewports |
| `npm run smoke:portal` + `npm run smoke:portal:interactions` | the existing portal flow did not regress | before ship |

**Standing rule: never run browser gates in parallel.** `AGENTS.md` read-order item 4 points at `docs/handoffs/2026-08-02-hmh-cycle-049-fable-handoff.md` for exactly this — never parallel browser smokes, heap-gate variance, and Vercel workflow. Two Chrome instances on one machine make frame-time and heap numbers meaningless. `scripts/hmh-browser-soak.mjs` enforces it for itself with a PID lock directory at `.tmp/hmh-reboot-soak-<profile>.lock` (`acquireRunLock()` at line 57, stale-PID recovery included); `scripts/stacked-browser-soak.mjs` must take `.tmp/stacked-soak-<profile>.lock` the same way. Beyond the locks the runbook is serial.

---

## 5. Visual regression

**STACKED gets its own baseline set.** Neither existing script generalizes: `scripts/hmh-reboot-visual-regression.mjs` hard-codes 12 HMH scenes, the URL `/hmh-reboot/index.html`, HMH query flags (`worldTour=ravine`, `director=1&boss=1`), HMH readiness gates (`dataset.actorArtSource === 'production-blender-atlas-v1'`, `dataset.enemyArt`, `dataset.authoredPropStatus`) and the directory `docs/testing/VISUAL_BASELINES/hmh-reboot`; `scripts/visual-regression.mjs` is a different script (parent renderer, PNG diffing, `docs/testing/VISUAL_BASELINES/hmh-level-1`). That directory holds exactly `current`, `hmh-level-1`, `hmh-reboot`.

**New: `scripts/stacked-visual-regression.mjs`**, importing rather than re-implementing `decodePng`, `signatureFromPng`, `compareSignatures`, `classifyScene`, `VISUAL_SIGNATURE_SCHEMA`, `SIGNATURE_WIDTH = 32`, `SIGNATURE_HEIGHT = 18`, `SIGNATURE_TOLERANCE = 2.5`, `SIGNATURE_MAX_CELL_DELTA = 26`, `SIGNATURE_MAX_CHANGED_CELLS = 24` (all verified named exports of the HMH script, which guards its runner behind an `isMain` check on `process.argv[1]`, so importing executes no capture). Two pieces come from elsewhere and are easy to miss: the static server is `startPortalStaticServer({ rootDir })` from `scripts/hmh-reboot-portal-e2e.mjs`, and Playwright comes from the vendored path `../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs`, not a top-level dependency. Chrome path: `process.env.STACKED_BROWSER_EXECUTABLE ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe``.

Own schema string `stacked-visual-signature-v1`, not `hmh-reboot-visual-signature-v1`, so a baseline file cannot be moved between sets and silently accepted. Baselines are 32×18 luma-signature JSON files, not PNGs, at `docs/testing/VISUAL_BASELINES/stacked/<scene-id>.json`.

**Build precondition.** `npm run visual:reboot` is bare (no build step); the script instead hard-exits with `Missing build artifact apps/portal/dist/hmh-reboot/game.js. Run: npm run build`. Mirror exactly — check `dist/stacked/game.js`, exit 1 with the same instruction — rather than chaining a build into the npm script, which would make every capture wait on a rebuild.

**Determinism prerequisite — non-negotiable.** At a mean tolerance of 2.5 and a max single-cell tolerance of 26, live music-reactive bloom makes every capture non-deterministic and the gate useless. The child must honour `evidenceSafe=1`, which **pins** the audio-reactive projection to a fixed neutral energy — not "off", which would hide a whole render path; pinned means the analyser feed is replaced by a frozen constant band vector. The harness always sets it.

**Settled-tick handshake.** The precedent is a *stage element* dataset, not `documentElement` (which carries only `embeddedCabinet`): the HMH harness waits on `document.querySelector('#hmhRebootStage')?.dataset.simulationTick` reaching the scene's `tick`, after its asset-readiness keys. STACKED mirrors this on `#stackedStage` (§6.1): wait for `dataset.assetsReady === 'true'`, then for `dataset.simulationTick` to reach the target, then capture. WebGL is captured through the browser compositor, never in-page — `preserveDrawingBuffer` is false and an in-page readback returns a cleared buffer that compares equal forever.

**Scene list** (`STACKED_VISUAL_SCENES`, **12 scenes**, entry shape `{ id, query, viewport, tick }` matching `VISUAL_SCENES`; all at `deviceScaleFactor: 1`). Zone numbers are the `STACKED_ZONES` **indices 0–5** from contract §2.9, so the scene id and query value cannot drift by one:

| Scene id | Zone | Query | Viewport | Tick |
| --- | --- | --- | --- | --- |
| `zone-0-desktop` | `genesis-vault` | `evidenceSafe=1&telemetry=1&zone=0&seed=1337` | 1440×900 | 240 |
| `zone-1-desktop` | `mempool-drift` | `…&zone=1&seed=1337` | 1440×900 | 240 |
| `zone-2-desktop` | `hashrate-forge` | `…&zone=2&seed=1337` | 1440×900 | 240 |
| `zone-3-desktop` | `scrypt-lattice` | `…&zone=3&seed=1337` | 1440×900 | 240 |
| `zone-4-desktop` | `halving-eclipse` | `…&zone=4&seed=1337` | 1440×900 | 240 |
| `zone-5-desktop` | `mainnet-aurora` | `…&zone=5&seed=1337` | 1440×900 | 240 |
| `zone-0-mobile` | `genesis-vault` | `…&zone=0&seed=1337` | 390×844 | 240 |
| `zone-5-mobile` | `mainnet-aurora` | `…&zone=5&seed=1337` | 390×844 | 240 |
| `board-pressure-desktop` | — | `…&zone=3&garbage=8&seed=1337` | 1440×900 | 900 |
| `board-pressure-mobile` | — | same | 390×844 | 900 |
| `game-over-desktop` | — | `…&topOutAt=600&seed=1337` | 1440×900 | 660 |
| `game-over-mobile` | — | same | 390×844 | 660 |

All twelve are child-runtime captures at `/stacked/index.html?<query>`. **No portal DOM scenes belong in this set.** Portal DOM goes to `npm run visual:responsive` (`scripts/responsive-matrix.mjs`), which already covers `/scores` and `/profile` across five viewports (`iphone-portrait` 390×844 dpr 3, `android-portrait` 412×915 dpr 2.625, `phone-landscape` 844×390 dpr 3, `tablet-landscape` 1024×768 dpr 2, `desktop` 1440×900 dpr 1). Add one state to its `STATES` list, in that file's exact shape (it navigates to `/?responsiveMatrix=1` then `history.pushState` to `state.path`, so the path must be one `viewForPath` resolves):

```js
{ id: 'stacked-mode-select', path: '/games/stacked', expectedStep: 'mode-select' },
```

`/games/stacked` (not `/play/stacked`) matches the existing entry `{ id: 'mode-select', path: '/games/hard-money-heroes', expectedStep: 'mode-select' }` and is guest-allowed, so it resolves without a wallet. STACKED's leaderboard columns and profile cells are proven by §4.9 plus the browser smoke.

```json
"visual:stacked": "node scripts/stacked-visual-regression.mjs",
"visual:stacked:accept": "node scripts/stacked-visual-regression.mjs --accept"
```

**Baseline acceptance procedure** (mirrors the `AGENTS.md` render-layer rule):

1. Make the render change.
2. `npm run build && npm run visual:stacked`. Read both the captured PNGs **and** the printed comparison metrics (`meanDelta`, `maxDelta`, `changedCells` per scene). Screenshots alone are not evidence. Current-run PNGs go under `.hermes/evidence/stacked-visual/current/`, mirroring the HMH script's `.hermes/evidence/hmh-reboot-visual/current/` (line 254) — `docs/testing/VISUAL_BASELINES/current/` belongs to the *other* visual script and must not be reused.
3. Confirm the diff is the intended change, checking what a falling-block board silently breaks: board/grid alignment, ghost-piece registration against the locked stack, next/hold panel containment, garbage-row seam, HUD containment inside the 9:16 safe area, zone palette identity.
4. Only then `npm run visual:stacked:accept`.
5. Commit the updated `docs/testing/VISUAL_BASELINES/stacked/*.json` **in the same commit as the source change**.

A scene whose signature is all zeros is a **failed** capture — the script must fail on it, not accept it.

---

## 6. Performance and soak acceptance

### 6.1 Steady-state gate — `scripts/stacked-performance-browser-smoke.mjs`

Copy `scripts/hmh-reboot-performance-browser-smoke.mjs`: Playwright from `benchmarks/hmh-engine-bakeoff/node_modules/playwright`; Chrome launched with `--enable-gpu --ignore-gpu-blocklist --enable-webgl --enable-precise-memory-info --js-flags=--expose-gc`; `sampleRetainedHeap` / `summarizeHeapSamples` / `HEAP_SAMPLE_COUNT = 7` from `scripts/lib/heap-sampler.mjs`; `MEASUREMENT_WINDOW_MS = 5_000` after boot; long tasks collected across boot **and** window. That script hard-codes `executablePath` with **no** env override — a portability bug; use `process.env.STACKED_BROWSER_EXECUTABLE ?? <default>`.

**Telemetry contract.** The HMH smoke reads HMH-specific **dataset keys** off `#hmhRebootStage` (`performanceProfile`, `renderResolution`, `animatedEnemies`, `enemyCount`, `worldParticles`, `worldRenderedParticles`, `simulationTick`) and derives `actualResolutionX/Y` from `canvas.width / rect.width`. The result-object field names in that script are *not* the dataset names; copying assertions without copying the reads is how you end up asserting on `NaN`.

STACKED publishes its own set on `#stackedStage`, gated behind `telemetry=1` so a Ranked player's live score is not in the DOM of a shipped build (contract §2.6, verbatim): `qualityProfile`, `reducedMotion`, `renderResolution`, `renderedParticles`, `particlePoolSize`, `simulationTick`, `runScore`, `garbageRowsInserted` (cumulative, monotonic), `runRestarts`, `longestRunTicks`, `assetsReady`. `actualResolutionX/Y` are derived from the canvas and not published. The soak (§6.3) and the visual harness (§5) read this same set; define it once.

**`dataset.qualityProfile` is one of `desktopHigh` | `desktopLow` | `mobile`, and reduced motion is a separate boolean `dataset.reducedMotion` — never a fourth tier value.** The tier comes from `selectStackedQualityTier(...)` in `apps/stacked/src/render/quality-tier.mjs`; `tests/stacked-quality-tier.test.mjs` asserts the five-step ladder, in particular that the mobile predicate is `coarsePointer === true && width <= 820` (both conditions — an `||` sends every 10–13″ tablet and touchscreen laptop to the phone tier and flips the tier while a desktop player resizes) and that an `undefined` `hardwareConcurrency` or `deviceMemory` is treated as "not low" and falls through.

| Metric | `desktopHigh` 1440×900 dpr 1 | `mobile` 390×844 dpr 3 | reduced-motion modifier |
| --- | --- | --- | --- |
| `dataset.qualityProfile` | `desktopHigh` | `mobile` | tier unchanged; `dataset.reducedMotion === 'true'` |
| `resolutionCap` | ≤ 2 | ≤ 1.25 | tier cap |
| `maxPixelArea` clamp | 4,000,000 | 1,600,000 | as tier |
| p95 frame | ≤ 20 ms | ≤ 24 ms | ≤ 20 ms |
| p99 frame | ≤ 40 ms | ≤ 48 ms | ≤ 40 ms |
| Measured frames in 5 s | ≥ 240 | ≥ 225 | ≥ 240 |
| `renderedParticles` | > 0 and ≤ 6,000 | > 0 and ≤ 1,200 | **> 0 and ≤ the tier's reduced ceiling — never 0** |
| Long tasks > 100 ms (boot + window) | ≤ 2 | ≤ 2 | ≤ 2 |
| Retained heap growth (forced GC) | < 16 MB | < 16 MB | < 16 MB |
| Page + console errors | 0 | 0 | 0 |

`desktopLow` is not a separate smoke run; it is asserted in `tests/stacked-quality-tier.test.mjs` against its frozen fields — `particleCapacity` 2,600, `resolutionCap` 1.5, `maxPixelArea` 1,600,000, `bloomCap` 0.22, `antialias` false. (`desktopHigh`: capacity 6,000, `bloomCap` 0.35, `antialias` true. `mobile`: capacity 1,200, `bloomCap` 0, `antialias` false.)

**Frame-count derivation.** 5,000 ms at a perfect 60 Hz is 300 frames — but the HMH script computes percentiles over `frameTimes.slice(15)`, discarding the first fifteen samples, so the achievable ceiling is **≈ 285**. Copy the slice (it keeps a post-GC stall out of the percentiles), which makes 285 the denominator. HMH's own gate accepts `frames >= 170`, 60 % of its 285. **240 desktop (84 % of 285) and 225 mobile (79 %)** sit well above that floor while surviving scheduler noise; an earlier 255/240 pair was written against a 300 denominator, leaving under 0.5 s of jitter for the whole window — it fails on any machine that is not perfectly idle, precisely the variance the Cycle 049 handoff warns about. Reduced motion still renders particles (at ×0.35 speed and ×0.60 lifetime), but removes shake, parallax and scale pulsing, so it takes the desktop number.

**Particle assertions use the frozen capacities, not HMH's numbers.** HMH asserts `renderedParticles <= 50` desktop / `<= 30` mobile, but that counter is `dataset.worldRenderedParticles` — world-layer particles only, one subsystem of a much larger scene; an analogy to it is meaningless in either direction. The frozen capacities (6,000 / 2,600 / 1,200) come from visuals §5's derived adversarial concurrent-particle sums of **893 / 329 / 142**, padded 35 % to 1,200 / 445 / 190 and rounded up to the derived ceilings **~1,200 / ~540 / ~230**, then ~5× for governor headroom. (445 and 190 are already the padded values; treating them as the adversarial sums double-pads two of the three tiers.) Assert `0 < renderedParticles <= particleCapacity` per tier and `mobile < desktopHigh` at the same scene.

**Reduced motion does not zero the particle count** (contract §2.6, ruling for visuals §7.1, which owns the setting). `reduceMotion` is a *motion* modifier: particle initial speeds ×0.35, lifetimes ×0.60, shake and parallax to zero, domain warp frozen — the particles keep rendering. Assert `0 < renderedParticles <= reducedCeiling` under the modifier. `renderedParticles === 0` is asserted **only** under `stackedEffects=minimal`, and the frame-budget guard at level 3 is the only other thing that zeroes the alive ceiling. An earlier draft of this section asserted `=== 0` under the modifier and called it "the modifier's whole contract"; a correct implementation of visuals §7.1 fails that assertion, and the natural way to make it pass is to break the setting.

The frame-budget governor is projection-only and never reallocates pools; only the alive ceiling moves. Assert its three levels are reachable and reversible: L1 `capacity ×0.60`, bloom 2 passes → 1; L2 `×0.35`, bloom off, backdrop shader → static gradient; L3 `×0.15`, board glow off, shake ×0.5, parallax → 1 layer, and **L3 is announced** with a `PERF` pip in the HUD. `dataset.degradationLevel` never changes the canonical result (§4.2 item 3).

### 6.2 Bundle budget

`STACKED_ENTRY_JS_CAP` and `STACKED_INITIAL_JS_CAP` are **`null` and hard-fail until measured** (contract §2.7): `assertStackedJsBudget` throws `Error('STACKED_ENTRY_JS_CAP has no measured baseline yet')`, a readable failure rather than the `TypeError` `safeByteCount()` would raise on `null`. S-11's first clean build sets each to **measured × 1.08, rounded up to the nearest 1,000**, quoted in the cycle ledger. A cap that starts permissive never gets tightened, which is why no guessed number ships.

Five things that must hold for those caps to mean anything:

- **Pixi must be externalized, and today it would not be.** `createHmhPixiPlugin` in `build.mjs` externalizes the `pixi.js` specifier to `'../chunks/hmh-pixi.js'` **only** when `args.importer` contains `/apps/hmh-reboot/src/` (line 76). A `pixi.js` import from `/apps/stacked/src/` falls through to `{ path: pixiModule }` and inlines the whole engine — the vendor chunk is **575,891 bytes** today, so `dist/stacked/game.js` lands near 600 KB. Widen the condition to an array including `/apps/stacked/src/` in the same commit that adds the entry. The relative external resolves without further change because `dist/stacked/` sits at the same depth as `dist/hmh-reboot/`.
- **Measure the entry *plus its statically imported chunks*, never the entry alone.** The build runs with `splitting: true`. Measured today: `dist/chikun/game.js` is 22,358 bytes but its first line imports four chunks totalling 422,304 bytes; `dist/hmh-reboot/game.js` is 398,971 bytes and imports 64,526 bytes of shared chunks on top of the Pixi vendor. "Chikun is 22 KB" is an artefact of where esbuild put the code, not a scale reference. The assertion must parse import specifiers out of the head of `dist/stacked/game.js`, `stat()` each referenced chunk, and sum — excluding `chunks/hmh-pixi.js`, counted separately as vendor. A cap on the entry file alone is trivially evaded by esbuild moving one module into a shared chunk.
- **`assertHmhInitialJsBudget` undercounts.** It is called with `entryBytes` and `vendorBytes` only: 398,971 + 575,891 = 974,862 against `HMH_INITIAL_JS_CAP = 1_050_000`, reporting **75,138 bytes** free. But `dist/hmh-reboot/game.js` also imports `chunks/chunk-22O5W2QY.js` (63,871 B) and `chunks/chunk-2WGYLO4P.js` (655 B), which the budget never sees. Real HMH initial JS is **1,039,388 bytes — 10,612 under the cap.** A fourth entry sharing modules with HMH grows exactly those shared chunks and the gate will not notice. Before and after adding `stacked/game` to `entryPoints`, record the sizes of `dist/main.js`, `dist/hmh-reboot/game.js`, `dist/chikun/game.js` and every `dist/chunks/chunk-*.js` in the cycle doc. **If HMH's true initial JS crosses 1,050,000 that is a stop, not a cap bump**, and `HMH_INITIAL_JS_CAP` must not be retargeted at the sum of the split caps (`HMH_ENTRY_JS_CAP + ARCADE_PIXI_VENDOR_CAP` = 1,077,000, which is 27,000 bytes *looser* than the build promises today).
- **Do not add Pixi symbols to the shared vendor chunk before G-5 is answered.** `apps/hmh-reboot/src/pixi-vendor.mjs` re-exports exactly nine — `Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite`. STACKED's renderer needs seven more (`ParticleContainer`, `Particle`, `Filter`, `GlProgram`, `RenderTexture`, `Mesh`, `Geometry`); `visuals.md` §1.2 prices them at a measured **+21,469 bytes** (575,891 → 597,360 for a 16-export build). That table is the **proposal attached to G-5, not an instruction** — contract §2.7 rules that the nine stay until the owner answers, and no cycle may edit that module before then. Two facts make it a gate and not a preference. First, the arithmetic: real HMH initial JS today is 1,039,388 (398,971 entry + 575,891 vendor + 63,871 + 655 shared chunks) against `HMH_INITIAL_JS_CAP = 1_050_000`, so the seven exports land it at **1,060,857 — over the cap** — while `assertHmhInitialJsBudget`, which never sees the two shared chunks, would still report 996,331 and pass. Per the stop rule below, that is a stop, not a cap bump. Second, `vercel.json` serves `/dist/chunks/(.*)` with `Cache-Control: public, max-age=31536000, immutable` and `hmh-pixi.js` carries **no content hash in its filename**, so a mutated vendor chunk cannot be relied on to reach a returning browser: growing it in place needs a cache-busting plan as well as an accepted crossing. The standing recommendation is option (b), a renamed `arcade-pixi-v1.js` carrying all sixteen with both cabinets repointed. Whichever option lands, this bullet and `visuals.md` §1.2 must be brought to the same sentence in the same commit.
- Every threshold in §6.1 is a *starting* budget. On first run record the actual measurements in the cycle doc; if one is unreachable, change it with the measurement quoted beside it, exactly as the HMH heap-cap comments do. Do not silently loosen.

### 6.3 40-minute god-tier soak — `scripts/stacked-browser-soak.mjs`

Copy `scripts/hmh-browser-soak.mjs` wholesale — PID lock directory, free-port static server over `apps/portal`, periodic sampling (`sampleIntervalMs = Math.min(30_000, Math.max(2_000, Math.round(durationMs / 60)))`), forced-GC retained-heap sampling, partial-report writing so a crash still leaves evidence, and a Markdown + JSON report pair.

```json
"test:soak:stacked": "npm run build && node scripts/stacked-browser-soak.mjs --profile=desktop --minutes=40",
"test:soak:stacked:mobile": "npm run build && node scripts/stacked-browser-soak.mjs --profile=mobile --minutes=40"
```

HMH's `test:soak` / `test:soak:mobile` run `--minutes=30`; STACKED runs 40, the top of the owner's god-tier band. 40 minutes is 144,000 ticks, comfortably inside `STACKED_MAX_TICKS = 432_000`, so the soak never terminates on the tick ceiling. Reports: `docs/testing/stacked-browser-soak.json` / `.md` (and `-mobile` variants), plus `docs/testing/stacked-browser-soak.partial.json` while running. Lock: `.tmp/stacked-soak-<profile>.lock`.

**Driving a 40-minute run.** A human cannot be scripted and a god-tier run cannot be reached by random input. The HMH soak query is `evidenceSafe=1&combatPilot=1&telemetry=1&seed=424242` (line 25); STACKED gets `evidenceSafe=1&stackPilot=1&telemetry=1&seed=424242`, where `stackPilot=1` enables a dev-only greedy placement policy in `apps/stacked/src/dev/soak-pilot.mjs` that reads the board and emits per-tick held-state masks a player could have produced. Constraints:

- It is an **input source**, not a simulation change: nothing it produces may be unrecordable by the codec — one `uint8` mask per tick, `STACKED_MAX_MOVE_STEPS_PER_TICK = 1`.
- Refused whenever `mode === 'ranked'`; asserted in `tests/stacked-portal-lifecycle.test.mjs`.
- Imported dynamically behind the query flag so it is tree-shaken out of the default bundle; assert `dist/stacked/game.js` does not contain the string `soak-pilot`.

**Soak thresholds** (constants at the top of the script, HMH's names kept):

| Constant | STACKED | HMH today | Rationale |
| --- | --- | --- | --- |
| `SIMULATION_HZ` | 60 | 60 | `STACKED_FIXED_STEP_HZ` |
| `MAX_P95_FRAME_MS` | 22 | 28 | lighter scene |
| `MIN_MEDIAN_FPS` | 55 | 45 | lighter scene |
| `MAX_HEAP_GROWTH_BYTES` | 48 MB | 64 MB | far less allocated per tick |
| `MAX_HEAP_GROWTH_PERCENT` | 150 | 150 | both must be exceeded to fail, as in HMH |
| `MAX_DOM_GROWTH` | 200 nodes | 200 | same |
| minimum tick advance | `floor(minutes * 60 * SIMULATION_HZ * 0.8)` = **115,200** at 40 min | same formula | proves the run simulated, not that a tab idled |

STACKED-specific soak failures, all read from the §6.1 telemetry set:

- **Longest single run ≥ 20 minutes.** A "zero `runRestarts`" rule would assume a greedy pilot survives 40 minutes against the rising ledger, which is an assumption, not a measurement — and if false the honest fix is a weaker gate, not a weaker pilot. Restarts are allowed and counted, but the report must show one uninterrupted run with `dataset.longestRunTicks >= 72_000`, and the 115,200-tick advance check still has to pass. A restarting run also exercises teardown, which is where a leak usually lives.
- `dataset.garbageRowsInserted` (cumulative and monotonic, **not** rows currently on the board) must strictly increase between the first and last sample. A board-occupancy reading can legitimately sit flat while the curve runs, because the pilot clears rows as fast as they rise.
- `dataset.particlePoolSize` must not grow monotonically across samples. The classic falling-block leak is per-clear VFX objects never returned to a pool.
- More than four retained-heap samples missing, or any page or console error.

Run desktop and mobile **sequentially**, never together.

---

## 7. Security, CSP, and the service worker

### 7.1 CSP: no permission widened, but a new bucket is mandatory

Nothing here needs a wider policy. Audio is the parent's same-origin `<audio id="arcadeMusicAudio" preload="metadata">` in `apps/portal/index.html` — no `crossOrigin` attribute anywhere in `index.html`, `main.js` or `arcade-music-transport.mjs`, and every track `src` in `apps/portal/src/arcade-playlist-manifest.mjs` is a relative `./assets/audio/playlist/*.mp3`. Same-origin media is what makes an `AnalyserNode` tap legal at all, so `media-src 'self' blob:` already covers it and no `connect-src` origin is added. **If a future playlist track is ever added from another origin the analyser silently returns zeros rather than erroring** — the tap must therefore fall back to the frozen neutral band vector rather than trusting an all-zero read, and §4.7 covers that state. The analyser lives parent-side (an `AnalyserNode` cannot reach into the iframe); bands cross the bridge as projection-only data and never enter the evidence stream. The cabinet makes no network requests: `endpoints: []`.

A new child directory **cannot** inherit the existing policy. `vercel.json`'s catch-all source is `/((?!(?:hmh-reboot|chikun)/).*)` (line 54) and sets `frame-ancestors 'none'`, so `/stacked/` would fall into that bucket and the portal could not iframe it at all — a blank cabinet with no error path until the READY timeout. Two edits, both required, same commit:

1. A new header block placed **before** the catch-all, based on the tighter Chikun policy plus one directive Chikun does not need:

```
"source": "/stacked/(.*)",
"Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests"
```

2. Extend the catch-all lookahead to `/((?!(?:hmh-reboot|chikun|stacked)/).*)`. **The lookahead is the load-bearing edit** — Vercel does not stop at the first matching `source`, so leaving the catch-all matching `/stacked/` leaves a second `Content-Security-Policy` header in play carrying `frame-ancestors 'none'`. Ordering the new block first is housekeeping; excluding the path is the fix.

**`worker-src 'self' blob:` is not optional.** Chikun's bucket omits it because Chikun is Canvas 2D. PixiJS 8's `Assets` / texture loader decodes image bitmaps on a worker built from a blob URL, which is why the `/hmh-reboot/` bucket — the only other Pixi child here — carries it; STACKED also builds `dist/stacked/verify-worker.js`. Copying Chikun's policy verbatim onto a Pixi runtime is the likeliest way to ship a cabinet that loads its shell then fails to load a texture, with the only symptom a console CSP report. `manifest-src` is *not* needed: HMH's bucket carries it because its host page links a web manifest and the STACKED host page does not.

Start **without** `'unsafe-eval'` (owner gate **G-6**). HMH's bucket carries it and nothing in this repo records why, so that is not evidence Pixi needs it. Author the strict policy, run the browser smoke, and treat any CSP violation in the console as a smoke failure (§4.11 already asserts zero console errors). If and only if a violation appears, add `'unsafe-eval'` to `script-src` in that bucket **and** record the exact violated directive and the Pixi call site in the cycle ledger. Never add it pre-emptively; budget one cycle step for resolving it.

Also extend the existing `Cache-Control` rule `/dist/(hmh-reboot|chikun)/(.*)` (line 18) to `/dist/(hmh-reboot|chikun|stacked)/(.*)` → `public, max-age=0, must-revalidate`, in the same commit as the build change: `dist/stacked/verify-worker.js` matching no rule would mean a verifier one build behind the sim. **Never** put a STACKED artifact under `/dist/chunks/`, which is `max-age=31536000, immutable` with no content hash. No `rewrites` change is needed — `/games/:path*` and `/play/:path*` already rewrite to `/index.html`.

### 7.2 Service worker

`apps/portal/sw.js`: append `/stacked/index.html`, `/stacked/game.css`, `/dist/stacked/game.js` to `PRECACHE_URLS` and bump `CACHE_VERSION` from `'lesters-arcade-v24-hmh-encounter-truth'` (line 13) to a new marker, e.g. `'lesters-arcade-v25-stacked-cabinet'`. Both edits in one commit; a precache addition without a version bump leaves returning players on a shell referencing a bundle that no longer exists. `install` uses `cache.addAll(PRECACHE_URLS).catch(() => {})`, so one mistyped path fails the whole precache **silently** — verify every added URL resolves against the running static server before committing. JS and CSS are network-first at fetch time, so a stale bundle is not the primary risk; a broken precache list is.

Note the filename: **`/stacked/game.css`**. `apps/portal/chikun/` contains `game.css` + `index.html`; `apps/portal/hmh-reboot/` contains `styles.css` + `index.html`. Follow Chikun.

`npm run docs:production` is the network-backed check that the README cache marker matches the live worker; update that marker line when certifying the deployment.

### 7.3 What the security scripts actually check

`npm run design:security-audit` (`scripts/hmh-security-audit-sweep.mjs`) walks `apps/portal`, `scripts`, `tests` (skipping any `dist`, `vendor` or `node_modules` at any depth) over `.mjs/.js/.html/.json/.css` and fails on four patterns:

- `dom-xss-innerhtml` — `/\.innerHTML\s*=/` (high), `allow: /vendor\//`
- `dom-xss-outerhtml` — `/\.outerHTML\s*=/` (high), `allow: /vendor\//`
- `dynamic-code-eval` — `/\beval\s*\(|new\s+Function\s*\(/` (critical), `allow: /vendor\//`
- `inline-secret-assignment` — `/(api[_-]?key|secret|password|private[_-]?key|bearer)\s*[:=]\s*['"][^'"]{8,}['"]/gi` (critical), `allow: /(safetyNotes|vendor\/)/`

plus five hardening checks — `no-app-innerhtml`, `target-blank-rel-noopener`, `service-worker-network-first-scripts`, `wallet-provider-readiness`, `avatar-sanitization` — of which `no-app-innerhtml` requires `apps/portal/main.js` to contain no `.innerHTML =` at all. Two consequences: **all cabinet UI is built with `document.createElement` + `textContent`**, no template-literal HTML injection anywhere in the portal-side modules *or the tests*; and the §7.2 edit must not disturb the `request.destination === 'script'` / `networkFirst(request)` strings that `service-worker-network-first-scripts` greps for.

**Gap to close in this cycle:** `scopeDirs` at line 36 is exactly `[apps/portal, scripts, tests]`. `apps/hmh-reboot/` and `apps/chikun/` escape it today and `apps/stacked/` would too; `apps/portal/stacked/index.html` and `game.css` are already in scope, so it is only the JS source tree that escapes. Add `path.join(repoRoot, 'apps', 'stacked')` to `scopeDirs` — a one-line change that brings only genuinely new code into scope, so it cannot surface pre-existing findings or destabilise the gate. Do not add the other two child directories in this cycle; that is a separate cleanup with its own risk.

`npm run design:third-party-security` is `node --test tests/arcade-sandbox-security.test.mjs` and asserts the HMH manifest's sandbox contract. STACKED omits the `sandbox` block (§3.1) and must not be added to that test.

### 7.4 Certification consequence

`AGENTS.md`: "Any runtime, asset, routing, CSP, service-worker, or release-harness change creates a new candidate and requires fresh certification." Shipping STACKED touches routing, CSP, the service worker and the release harness, so the ship commit produces a **new deployment candidate requiring fresh certification**, and promotion needs explicit per-deployment owner approval (**G-15**). Say so in the cycle doc; do not promote anything.

The same file's projection-only rule is what this design leans on: art, interpolation, particles, shaders, audio, animation LOD and quality tiers "may not change collision, damage, AI, spawning, RNG, progression, evidence, or results." §4.2's determinism assertions are the machine-checkable form of that sentence.

---

## 8. Documentation deliverables

### 8.1 Roadmap and cycle docs

- `docs/stacked/STACKED-MASTER-PLAN.md` — the master plan, committed as implementation authority, in the house style of `docs/hmh-reboot/AAA-ROADMAP.md` (standing dependency order, acceptance bars, completed-item reconciliation, owner gates). `docs/stacked/STACKED-CONTRACTS.md` and `docs/stacked/spec/*.md` sit beside it; `docs/stacked/DECISIONS.md` carries the STACKED owner gates.
- `docs/stacked/cycles/CYCLE-001.md`, `-002.md`, … — one per cycle, in the exact shape of `docs/hmh-reboot/cycles/CYCLE-072.md`:

```md
# STACKED Cabinet Cycle 001

Date: `YYYY-MM-DD`
Status: `LOCAL · VERIFIED · NOT DEPLOYED`
Branch: `fable/stacked-cycle-001-<slice>`
Baseline: `<40-hex baseline commit>`

## Scope: <one-line slice name>
1. …

## Runtime and determinism evidence
- …

## Verification
- `npm run check`: PASS — N JavaScript modules + M Python scripts.
- `npm test`: PASS.
- `npm run test:release`: PASS — N scanned, N passing, 42 accepted legacy failures, 0 unexpected.
- `npm run build`: PASS — dist/stacked/game.js N bytes + N bytes of shared chunks; HMH real initial JS N of 1,050,000.
- `npm run visual:stacked`: PASS — 12 scenes, max mean delta X.
- `npm run smoke:stacked:performance`: PASS — desktopHigh p95 X ms, mobile p95 Y ms.

## Honest visual note
<what still looks unfinished, in plain words>

## Boundaries
<what this cycle deliberately did not do>
```

Keep the "Honest visual note". It is the part of the house style that stops a cycle doc reading as marketing; Cycle 072's note is the model. A separate `docs/stacked/` tree is deliberate: `docs/hmh-reboot/cycles/` is HMH's ledger (CYCLE-001 through CYCLE-072 today, 039 and 069 absent) and the `AGENTS.md` read order points at it for HMH work. Do not interleave and do not renumber into HMH's gaps.

### 8.2 Copy sheet

Mirror the HMH pattern exactly:

- `apps/portal/src/stacked-copy-sheet.mjs` exporting `STACKED_COPY_STYLE_RULES`, `STACKED_COPY_SHEET`, `collectStackedCopyTexts()`, `stackedCopy(path, fallback)`, `validateStackedCopySheet()` — the five-export shape of `apps/portal/src/hmh-copy-sheet.mjs`.
- `scripts/stacked-copy-sheet.mjs` exporting `renderStackedCopySheetMarkdown()` / `writeStackedCopySheet()`, writing `docs/copy/stacked-copy-sheet.json` and `.md` (that directory holds exactly `hard-money-heroes-copy-sheet.json` and `.md` today).
- npm script `"design:copy-sheet:stacked": "node scripts/stacked-copy-sheet.mjs"`.

`STACKED_COPY_STYLE_RULES.bannedPlayerFacingPatterns` must include at minimum `em-dash` (`/—/`), `paid-testnet` (`/\bpaid\b/i`), `prototype-mode` (`/\bprototype\b/i`), the trademarked genre name in any case, and its use as a term for a four-line clear. The copy sheet is the **single** place the display name `HALVING` is defined; every other surface references it. Because contract §1.1 decouples the display name from the `quad` identifier root, a G-1 ruling that renames it touches copy strings and achievement *titles* only — no id, no schema field, no seed, no stored replay. `tests/stacked-copy-sheet.test.mjs` (§4.10) is the enforcement, including the self-exclusion rule and the rule that the patterns govern **authored copy only** — `collectStackedCopyTexts()` excludes rendered placeholders and separators such as `portal.md` §9.2's cadence-rank-strip `—` and `·`.

Feed `CABINET_MODE_SELECT_PRESENTATIONS.stacked` from the copy sheet the way the HMH presentation reads `HMH_COPY_SHEET.modeSelect.free.label` / `.copy`, so mode-select copy cannot drift from the approved sheet. Chikun inlines its strings; follow HMH here, not Chikun.

### 8.3 `CHANGELOG.md` (repo root)

One release heading in the existing style — version heading, `### Added` / `### Changed` / `### Performance` / `### Deployment boundary`, past tense, no marketing. The most recent heading is `## 1.3.0 - 2026-07-13` (line 5), so `1.4.0` is next. (`package.json` says `0.3.1`; that divergence is pre-existing and not this cycle's to reconcile.)

```md
## 1.4.0 - <date>

### Added

- STACKED, an original falling-block arcade cabinet: Free practice mode, parent-seeded Ranked mode with deterministic re-simulation, five cadence leaderboards, cabinet achievements, and 9:16 / 16:9 support.
- Live music-reactive projection driven by the parent arcade player, excluded from simulation, RNG, scoring, and replay evidence.
- A STACKED visual-signature baseline set, a performance browser smoke, and a 40-minute soak gate.

### Changed

- The `/stacked/` child runtime has its own Content-Security-Policy bucket and the service-worker cache marker moved to `lesters-arcade-v25-stacked-cabinet`.

### Deployment boundary

- This is a portal/game release only. It does not broadcast transactions, deploy contracts, rotate addresses, or change on-chain settlement approval.
```

The "Deployment boundary" paragraph is mandatory and copied verbatim from the 1.3.0 entry; every release heading carries it.

### 8.4 The two `DECISIONS.md` files

**They are different files and neither substitutes for the other.** Do not merge them, and do not count entries across them.

| File | Created by | Holds | Shape |
| --- | --- | --- | --- |
| `docs/stacked/DECISIONS.md` | **S-01** | The **nineteen owner gates** (`STACKED-CYCLES.md` §6), each marked open / answered, each with its exact ask and what it blocks. This is where an agent writes a blocked gate before stopping, and what `STACKED-MASTER-PLAN.md` §6, `STACKED-CYCLES.md` §6, `integrity.md` §9, `portal.md` §8.1 and contract §5 all point at. | One record per gate; status is machine-readable at a glance. |
| `DECISIONS.md` (repo root) | already exists | Narrative entries for genuinely contested design decisions, appended by the **ship cycle (S-22)** alongside the `CHANGELOG.md` entry. | The file's existing four-part prose form — `## <date> — <decision sentence>`, then `Decision:`, `Rationale:`, `Tradeoffs:`, `Revisit when:`. Three to five sentences each; prose, not a table. |

The ship gate's check is therefore two counts, not one: nineteen gate records in `docs/stacked/DECISIONS.md`, each either answered or explicitly still open, and **at least five** narrative entries appended to the root file. Write these five at minimum:

- **STACKED ships solo-only with two-player pre-wired but unconsumed** — Tradeoffs: a frozen garbage-attack table with no consumer is dead data until phase 2, and `boardSlot[1]` ships created and hidden. Revisit when: a lockstep transport exists.
- **Music-reactive visuals are computed parent-side and streamed to the child as projection-only data** — Tradeoffs: a new high-rate bridge message that must be excluded from replay evidence by construction, not by convention.
- **STACKED uses one identifier string across manifest, runtime `gameId` and URL slug** — Tradeoffs: diverges from HMH's three-namespace precedent, so the router tables read asymmetrically. Revisit when: HMH's ids are unified.
- **Ranked evidence is chunked, and the simulation carries both a two-hour tick ceiling and an evidence-byte ceiling** — Rationale: a god-tier stream does not fit one 65,536-byte bridge message (§4.4), and one ceiling cannot bound both simulated time and the parent's reassembly buffer. Tradeoffs: a multi-message path the parent must reassemble and bound, and two terminal conditions of which `evidence-ceiling` is provably unreachable in legal play. Revisit when: the bridge message cap changes.
- **The leaderboard route gets a per-cabinet column table instead of a third per-game boolean** — Rationale: the route switches eleven columns on `gameId === 'chikun'` and a fourth cabinet makes that unreadable. Tradeoffs: the refactor touches two shipped boards and needs byte-identical before/after assertions.

---

## 9. Ship checklist

| # | Action | Caught by if omitted |
| --- | --- | --- |
| 1 | Five placeholder SVGs committed, paths match the cabinet entries, sprite has six frames | `tests/stacked-cabinet-art.test.mjs` |
| 2 | `apps/portal/games/stacked/main.mjs` shim exists and re-exports the deterministic core | `stacked-cabinet-art` + `stacked-public-integration` (nothing else — a missing file is a runtime 404) |
| 3 | Manifest at `status: coming-soon`, no README row | `npm run docs:cabinets` |
| 4 | Every new `.mjs` appended to `NODE_CHECK_FILES` | `npm run check` passes silently if omitted — audit the diff against §3.4's checklist line |
| 5 | `stacked/game` and `stacked/verify-worker` added to `build.mjs` `entryPoints`; before/after sizes of `dist/main.js`, both existing child entries and every `chunks/chunk-*.js` recorded in the cycle doc | `npm run build` catches only a hard failure; chunk reshuffling is a review item |
| 6 | Pixi importer condition widened to include `/apps/stacked/src/` | bundle assertion in `smoke:stacked:performance` (entry ~3× over) |
| 6b | Real HMH initial JS (entry + shared chunks + vendor) still under 1,050,000 | nothing automated — `assertHmhInitialJsBudget` undercounts by ~64 KB |
| 6c | `STACKED_ENTRY_JS_CAP` / `STACKED_INITIAL_JS_CAP` set from the first clean build at measured × 1.08, rounded up to the nearest 1,000, quoted in the ledger | `assertStackedJsBudget` throws its "no measured baseline yet" error until they are |
| 7 | `/stacked/(.*)` CSP block added **with `worker-src 'self' blob:`** and the catch-all lookahead extended to `hmh-reboot\|chikun\|stacked` | browser smoke: the iframe never loads (`frame-ancestors 'none'`), or textures never load (worker blocked) |
| 7b | `/dist/(hmh-reboot\|chikun\|stacked)/(.*)` Cache-Control rule extended | nothing automated — a verifier one build behind the sim |
| 8 | `sw.js` precache (`/stacked/index.html`, `/stacked/game.css`, `/dist/stacked/game.js`) + `CACHE_VERSION` bump, every URL verified to resolve | nothing automated — `addAll` failures are swallowed |
| 9 | `apps/stacked` added to the security-sweep `scopeDirs` | nothing automated |
| 10 | Determinism golden vector committed at `tests/fixtures/stacked-golden-run.json` | `tests/stacked-sim-determinism.test.mjs` |
| 10b | Pause / hidden-tab catch-up / resize / interruption implemented as §4.7 states them | `tests/stacked-run-lifecycle-states.test.mjs` |
| 11 | Integrity module called from the lifecycle both before and after re-simulation | `tests/stacked-run-integrity.test.mjs` wiring assertion |
| 11b | Leaderboard route's `chikunBoard` boolean replaced by a per-`gameId` column table; HMH and Chikun output unchanged | `tests/stacked-leaderboard-profile.test.mjs` |
| 11c | `stacked` entry added to the built-in registry map in `game-registry.mjs` | `tests/stacked-public-integration.test.mjs` |
| 11d | Both router tables carry `stacked`; `ARCADE_GAME_IDS_BY_SLUG` alone carries the `stack` alias | `tests/stacked-public-integration.test.mjs` (a missing entry falls back silently to HMH) |
| 12 | Evidence chunking, tick ceiling and evidence-byte ceiling implemented and bounded | `tests/stacked-evidence-codec.test.mjs` |
| 13 | Visual baselines committed with the render change; `stacked-mode-select` added to `responsive-matrix` `STATES` | `npm run visual:stacked`, `npm run visual:responsive` |
| 14 | 40-minute soak green on desktop and mobile, run sequentially | `npm run test:soak:stacked` |
| 15 | Ship commit: manifest `playable` + `1.0.0`, README row keyed on `STACKED`, `AGENTS.md`, onboarding-doc scan, app-shell `playable: true` + `leaderboardEligible: true`, `ARCADE_GAMES` `status: 'playable'` + `publicPlayable: true` | `npm run docs:cabinets` inside `npm test` and `npm run test:release` |
| 16 | Cycle doc, copy sheet regenerated, CHANGELOG + DECISIONS entries | `npm run docs:links` for links only; the rest is review |
| 17 | `npm run vercel:build` green; new candidate declared, promotion **not** performed | owner approval gate G-15 |
