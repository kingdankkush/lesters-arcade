# STACKED — Portal Integration, Leaderboards, Profile, Achievements, Settings, Persistence

> Precedence: `../STACKED-CONTRACTS.md` overrides this specification wherever they disagree.

**Scope.** Implementation authority for every *parent-portal* change needed to ship the STACKED cabinet:
registration (`ARCADE_GAMES`, app shell, mode-select presentation, `REGISTERED_GAMES`, manifest), routing
and session mount wiring, the run-summary schema and its persisted projection, leaderboard columns / sort
order / trust column, profile surfaces, the 16-achievement set and the scoping work it requires, settings,
and persistence. Not covered here: the simulation (`mechanics.md`), rendering and zones (`visuals.md`),
touch and layout (`mobile.md`), evidence and replay verification (`integrity.md`), two-player readiness
(`versus.md`), build/CSP/service-worker/bundle gates (`gates.md`). Every name and constant is subordinate to
`docs/stacked/STACKED-CONTRACTS.md`.

Paths are relative to the Lester's Arcade repository root. Line numbers are from
`fable/hmh-cycle-072-visual-facelift` at `ff2934db` — navigation hints, not contracts. Match on the quoted
code.

**Contents.** §1 Identity and the doc-drift trap · §2 `arcade-core.mjs` · §3 `game-registry.mjs` ·
§4 Manifest · §5 Routing, mode select, mount wiring · §6 What registration implies elsewhere · §7 Run
summary schema and the persisted projection · §8 Leaderboards · §9 Profile · §10 Achievements ·
§11 Persistence · §12 Settings · §13 Tests and docs · §14 Landing order.

---

## 1. Identity: one string everywhere

The cabinet id is **`stacked`**, used verbatim as manifest `id`, `ARCADE_GAMES.id` (runtime `gameId`),
app-shell cabinet `id`, `REGISTERED_GAMES` key, URL slug, cadence-leaderboard key, and `profile.progress`
key. One alias, `stack`. Full identity table and collision audit: STACKED-CONTRACTS §3.

HMH carries three ids for one cabinet — manifest `hard-money-heroes`, engine `lester-blaster`
(`apps/portal/src/arcade-core.mjs:2112`), slug `hard-money-heroes`
(`apps/portal/src/arcade-router.mjs:31-36`) — costing a translation table at every boundary, and it is why
`official-profile-route.mjs` still carries a `s.gameId === 'hmh'` fixup. Chikun proved the single string.

Rejected ids: `block-reward` — live HMH identifier in five places
(`apps/hmh-reboot/src/run-progression.mjs:44-45`, `authored-prop-atlas.mjs:10`, `weapon-system.mjs:284`,
`sdk/hmh-run-summary-schema.mjs:44`, alias `'block-reward': 'coin-blaster'` in
`apps/portal/src/hmh-run-history.mjs:34`); `block-brawler` — already an `ARCADE_GAMES` entry
(`arcade-core.mjs:2155`, `coming-soon`).

**Alias placement.** `ARCADE_GAME_SLUGS` is gameId → slug; `ARCADE_GAME_IDS_BY_SLUG` is slug → gameId and is
what `gameIdForSlug` reads. `stack: 'stacked'` goes in **`ARCADE_GAME_IDS_BY_SLUG` only**; in the other map
it is silently inert (`gameSlugFor('stack')` would answer for a gameId that never exists). The alias is
never written into state, a session, or a leaderboard row.

### 1.1 The doc-drift trap

`cabinetMentionPatterns` (`scripts/cabinet-status-doc-drift-check.mjs:146-153`) builds two case-insensitive
patterns: `new RegExp('\\b' + escape(manifest.name), 'i')` — **no trailing `\b`**, so it matches any word
*starting* with the name — and, for a dashless manifest id,
`new RegExp('\\b' + escape(manifest.id) + '\\b', 'i')`. With `name: "STACKED"` / `id: "stacked"` both match
the English word "stacked"; dropping the dashless-id alias would not help, the name alone matches.

`checkDocForStaleClaims` (`:155-180`) then fails any line in `README.md`, `AGENTS.md`, or
`docs/THIRD_PARTY_GAME_ONBOARDING.md` containing one of `coming soon` / `coming-soon` /
`not public-playable` / `not public playable` / `not yet playable` / `not yet public` **and** matching a
pattern — or sitting under a heading that matches one, since a heading scopes every line beneath it
(`:161-172`). Fires only for `playable` manifests (`:188`, `:202`), so it is dormant until the §14 step-10
flip and permanent after. Runs inside `npm test` via `tests/cabinet-status-doc-drift-check.test.mjs`.

Grep-verified at `ff2934db`: those three files contain zero occurrences of "stack" in any casing. The trap
is entirely forward-looking. `chikun` carries it too and has never tripped it only because "chikun" is not
an English word.

---

## 2. `apps/portal/src/arcade-core.mjs`

### 2.1 `ARCADE_GAMES` — append after the `chikun` entry, before the closing `]);` at L2233

```js
{
  id: 'stacked',
  title: 'STACKED',
  cabinet: 'BLOCK CABINET 05',
  genre: 'Falling-block ledger stacker puzzle',
  status: 'coming-soon',   // -> 'playable'  only in the §14 step-10 commit
  publicPlayable: false,   // -> true        in the same commit
  devPlayable: true,       // stays true
  developer: "Lester's Arcade Core Team",
  entryFeeMicroUsdc: DEFAULT_ENTRY_FEE_MICRO_USDC,   // 0 — arcade-core.mjs:69
  livesPaid: 1,      // Ranked is ONE clean run. No continues, no restart.
  livesFree: Infinity,
  tagline: 'Seal the blocks. Clear the ledger. Do not let the chain reorg.',
  systemRole: 'child-dapp-cartridge',
  rankedSeasonId: 'stacked-season-preview-1',
  cabinetVersion: STACKED_CABINET_VERSION,           // from ./stacked-cabinet.mjs
  parentSystem: "Lester's Arcade",
  presentation: Object.freeze({
    medium: 'snes-cartridge',
    colorway: 'silver-neon-magenta',
    cabinetAsset: './assets/cabinet-stacked.svg',      // NEW placeholder SVG
    cartridgeAsset: './assets/cartridge-stacked.svg',  // NEW placeholder SVG
    marquee: 'STACKED',
  }),
}
```

- Entries are plain objects inside a frozen array (only `presentation` and `desktopCabinetSprite` are
  individually frozen) — match that shape. `lester-blaster` also carries `gameplay:`; nothing reads it for
  other cabinets, so STACKED omits it.
- `livesPaid: 1` departs from the `3` every other entry uses; it is what mode-select and gameplay copy read.
- `rankedSeasonId` is cabinet-owned so an HMH rollover (`CURRENT_RANKED_SEASON_ID = 'hmh-season-1-2026'`,
  `apps/portal/src/session-integrity.mjs:4`) cannot reset STACKED boards. `startPlaySession` already prefers
  `game.rankedSeasonId` (`:5235`).
- `cabinetVersion` feeds `buildHash` —
  `` `site-${SITE_VERSION}:game-${GAME_VERSION}${game.cabinetVersion ? `:cabinet-${game.cabinetVersion}` : ''}` ``
  (`:5234`) — which feeds `deriveSessionSeed`. Bumping it rotates every seed and retires stored replays, by
  design (STACKED-CONTRACTS freeze rule).

**Ships `coming-soon`, not `playable`.** Board slots and progress keys are built from `ARCADE_GAMES`
irrespective of status: `createInitialArcadeState` creates `state.leaderboards.stacked` and
`state.cadenceLeaderboards.stacked` (`:5014-5015`); `ensureAllGameProgress` creates
`profile.progress.stacked` (`:4960-4965`, reached on every `ensureProfile` → `connectPlayerAccount` at
`:5150`). `getGame('stacked')` throws until the entry lands (`:5019-5026`). But `playable` would also enable
the STACKED tab on every public profile immediately — `official-profile-route.mjs:360-377` builds its tab bar
from `ARCADE_GAMES` and enables on `game.status === 'playable'`; at `coming-soon` the same loop renders a
disabled `SOON` tab, as `lilly-pinball` and `mega-lester` do today.

**Required one-line `main.js` change.** `startPlaySession` refuses a non-playable cabinet unless
`allowDevCabinet && game.devPlayable` (`:5222`), and `beginTrackedSession`
(`apps/portal/main.js:5859-5866`) never passes it, so `?devCabinets=1` reaches mode select and throws
`"STACKED is not playable yet"` on the first Free start. Add `allowDevCabinet: DEV_CABINETS_ENABLED` to that
call in the same commit; the flag is computed at `main.js:282`.

Two second-order consumers:

- `getCartridgeSelectModel` (`:5040-5070`) derives `playable`/`routePath` from
  `status === 'playable' && publicPlayable !== false`, `devRoutePath` from `devPlayable`, and builds
  `discoveryTags` by substring-matching `genre + tagline` against a fixed list (`tap`, `run`, `pinball`,
  `platform`). None matches, so STACKED carries only `[status, medium]`. Add
  `...(discoveryText.includes('stacker') ? ['puzzle', 'stacker'] : [])`; the `genre` string supplies the
  match. Its consumers `renderCabinetStage` / `renderCartridges` (`main.js:6230-6259`) render into
  `#cabinetStage` / `#cartridgeRack`, which do not exist in `index.html` — dead surface, so this is for
  future readers, not a visible regression.
- Both placeholder SVGs must exist; copy the style of `apps/portal/assets/cabinet-chikun.svg` and
  `cartridge-chikun.svg`. **Nothing gates this:** `npm run assets:verify`
  (`scripts/verify-generated-assets.mjs`) checks a hard-coded list of generated manifests and never walks
  `ARCADE_GAMES.presentation`, so a missing file is a silent 404. The existence assertion goes in
  `tests/stacked-public-integration.test.mjs` (§13).

Import beside the chikun import at `arcade-core.mjs:8`:

```js
import { STACKED_CABINET_VERSION } from './stacked-cabinet.mjs';
```

`stacked-cabinet.mjs` must not import `arcade-core.mjs` (STACKED-CONTRACTS §2.10); `chikun-cabinet.mjs`
imports only `./arcade-sdk.mjs` and `./game-adapter.mjs`. A back-import creates a cycle through a module
loaded during `arcade-core`'s own evaluation, and `STACKED_CABINET_VERSION` reads `undefined` on the entry.

### 2.2 `LESTERS_ARCADE_V2_APP_SHELL.cabinets` — after the `chikun` entry (closes L614), before `mweb-invaders` (L615)

```js
Object.freeze({
  id: 'stacked',
  gameId: 'stacked',
  title: 'STACKED',
  status: 'coming-soon',   // flips in the §14 step-10 commit
  playable: false,         // flips in the same commit
  devPlayable: true,
  leaderboardEligible: true,
  description: 'Stack, spin, and seal falling ledger blocks. Free practice stays local; replay-verified Ranked runs write to your profile and the STACKED score boards.',
  bannerArt: './assets/cabinet-stacked.svg',
}),
```

This list, not `ARCADE_GAMES`, drives the arcade-floor card and the leaderboard game-filter tabs.
`publicLeaderboardCabinets()` filters on `cabinet.playable && cabinet.leaderboardEligible !== false`
(`main.js:286-288`); `cabinetPlayableInCurrentMode` gates the floor card on
`cabinet.playable || (DEV_CABINETS_ENABLED && cabinet.devPlayable)` (`main.js:283-285`).

`playable` here, `status`/`publicPlayable` in `ARCADE_GAMES`, and manifest `status` must agree at ship.
**Nothing enforces the first two against each other** — no existing test compares the lists — so flip all
three plus the README roster row in one commit (§14 step 10) and add the agreement assertion (§13).

No `desktopCabinetSprite`: `renderOfficialCabinets` renders sprite frames when present and otherwise falls
back to `cabinet.bannerArt` as a cropped, darkened background (`official-play-routes.mjs:124-135`) — the
placeholder-only outcome the owner locked.

### 2.3 `CABINET_MODE_SELECT_PRESENTATIONS` — after the `chikun` key (closes L556), before `});` at L557

```js
stacked: Object.freeze({
  gameId: 'stacked',
  title: 'STACKED',
  eyebrow: 'Selected Cabinet',
  copy: 'Choose Free Mode for an unlimited practice sandbox with a starting-level selector, or Play Ranked for one wallet-bound, replay-verified run recorded to your profile and the STACKED score boards.',
  artStatus: 'placeholder',
  backgroundAsset: './assets/generated/stacked-mode-select/stacked-mode-select-art.webp',
  backgroundPosition: 'center center',
  free: Object.freeze({
    label: 'Free Mode',
    official: false,
    icon: 'infinity',
    options: 'starting-level',                        // read by §5.5; inert for HMH/chikun
    startLevelRange: Object.freeze({ min: 1, max: 15 }),
    bannerAsset: './assets/generated/stacked-mode-select/stacked-free-mode.webp',
    bannerPosition: 'center center',
    bannerAlt: 'STACKED practice sandbox key art',
    copy: 'Practice sandbox: instant restart, starting-level selector, optional practice aids. Local score only — no profile progress, leaderboard placement, or chain writes.',
  }),
  ranked: Object.freeze({
    label: 'Play Ranked',
    official: true,
    icon: 'star',
    requiresZkLtc: false,
    chainId: 4441,
    token: 'zkLTC',
    faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl,
    bannerAsset: './assets/generated/stacked-mode-select/stacked-ranked-mode.webp',
    bannerPosition: 'center center',
    bannerAlt: 'STACKED ranked run key art',
    copy: 'One clean run on a parent-issued seed. No restart, no level skip, full input recording. Leaving the cabinet mid-run submits nothing. Handling values (DAS/ARR/DCD) stay yours to set and apply from your next run. Accepted scores are replay-verified by the parent before any profile or board write.',
  }),
}),
```

`startLevelRange.max = 15` matches `GRAVITY_LEVEL_CAP = 15` (STACKED-CONTRACTS §2.1).

`artStatus: 'placeholder'` shows `#officialModeArtNote` (`official-play-routes.mjs:191-194`; hidden only at
`'production'`). Without this key `buildGameModeSelectModel('stacked')` returns `null` and
`renderOfficialModeSelect` renders the "Mode selection blocked safely" dead-end with both buttons disabled
(`:150-178`).

**The three image paths are not optional and not gated.** `syncModeCard` (`:196-205`) assigns
`banner.src = model.bannerAsset` unconditionally and `applyGameModeSelectBackground` assigns
`backgroundAsset`; neither tolerates a missing file and no build step verifies them. Author three placeholder
WebPs at those paths in the same commit (mirroring `apps/portal/assets/generated/chikun-mode-select/`) or
point all three at committed art. Dangling paths render two broken images and a black panel.

### 2.4 Replace the hard-coded replay-verification branch

`recordScore` (`:5482-5491`):

```js
if (session.leaderboardEligible && game.id === 'chikun') {
  verifyChikunReplayClaim({ expectedSeed: session.seed, ... });
}
```

`buildParentSyncPacket` (`:5306-5315`) carries a **different** branch, and the difference is load-bearing:

```js
const replayed = game.id === 'chikun' && (session.leaderboardEligible || replayClaim)
  ? verifyChikunReplayClaim({ ... , runStats: submittedRunStats, replayClaim })
  : null;
```

The condition is `leaderboardEligible || replayClaim` — a Free run carrying a replay claim is still verified
— and the return value is used: `replayed` builds `canonicalRunStats` (`:5316-5324`) and
`canonicalReplayClaim` (`:5325-5331`), both chikun-shaped (`survivalTime`, `coinsCollected`, `forksPassed`,
`nearMisses`, `bestCombo`, `achievements`; version `'chikun-parent-replay-v1'`). Collapsing both call sites
onto one discard-the-result expression drops Free-run verification *and* the canonical-stats projection.

**Do not add a third string comparison.** New `apps/portal/src/run-verifier-registry.mjs`, two hooks, no
imports of its own (registration is push-based):

```js
const VERIFIERS = new Map();
// verify({expectedSeed, expectedBuildHash, expectedSeasonId, score, runStats, replayClaim})
//   -> canonical result object; THROWS on mismatch.
// canonicalize(replayed, { session, submittedRunStats }) -> { runStats, replayClaim }
export function registerRunVerifier(gameId, { verify, canonicalize }) { /* … */ }
export function getRunVerifier(gameId) { return VERIFIERS.get(gameId) ?? null; }
```

`arcade-core.mjs` registers `chikun` (wrapping `verifyChikunReplayClaim` plus its existing canonicalizer,
moved verbatim); `apps/portal/src/stacked-portal-lifecycle.mjs` registers `stacked` itself
(STACKED-CONTRACTS §2.10), so no new import edge into `arcade-core.mjs` is created.

```js
// recordScore — a gate. Result discarded on purpose.
const verifier = session.leaderboardEligible ? getRunVerifier(game.id) : null;
verifier?.verify({ expectedSeed: session.seed, expectedBuildHash: session.buildHash,
                   expectedSeasonId: session.seasonId, score, runStats, replayClaim });

// buildParentSyncPacket — condition and canonicalization both preserved.
const verifier = getRunVerifier(game.id);
const replayed = verifier && (session.leaderboardEligible || replayClaim)
  ? verifier.verify({ …, runStats: submittedRunStats, replayClaim })
  : null;
const { runStats: canonicalRunStats, replayClaim: canonicalReplayClaim } =
  replayed ? verifier.canonicalize(replayed, { session, submittedRunStats })
           : { runStats: Object.freeze({ ...submittedRunStats }), replayClaim: null };
```

`recordScore` discards its result because the canonical score is resolved upstream by the lifecycle
(`chikun-portal-lifecycle.mjs:37-49` verifies, then calls
`recordScoreRef(state, session, canonical.score, runStats)` with the re-simulated score). STACKED mirrors
that: the score written to the board is the parent's own `canonical.score`, never the child's number
(STACKED-CONTRACTS §4.3). A `canonical` binding inside `recordScore` would create a second, unread source of
truth. `tests/chikun-portal-lifecycle.test.mjs` and `tests/chikun-runtime.test.mjs` are the regression bar.

### 2.5 Per-game progress without HMH field pollution

`createEmptyGameProgress` (`:4927-4951`) is all-HMH vocabulary (`totalKills`, `grenadeKills`,
`bossesDefeated`, …) that Chikun rows already carry as permanent zeros. Do not rename or remove any of them —
`restoreArcadeState` copies profiles wholesale. Add one field, `custom: {}` (per-cabinet aggregates, owned by
the cabinet's stat schema), and in `updateProgressFromRun` (`:5426-5462`), after the generic fields:

```js
progress.custom ??= {};          // restored profiles predate the field
getGameStatSchema(session.gameId).reduceProgress?.(progress.custom, runStats);
```

`game-stat-schema.mjs` must not import `arcade-core.mjs`; formatters and `ACHIEVEMENTS` are passed in.
STACKED's `reduceProgress` maintains exactly eleven keys:

| Key | Rule | Backs |
| --- | --- | --- |
| `totalLines` | `+= runStats.linesCleared` | profile stat grid |
| `totalQuadClears` | `+= runStats.quadClears` | stat grid, ledger card |
| `totalSpins` | `+= runStats.spins` | stat grid, ledger card |
| `totalPerfectClears` | `+= runStats.perfectClears` | stat grid, ledger card |
| `totalPieces` | `+= runStats.pieces` | ledger card |
| `bestLines` | `Math.max` of `runStats.linesCleared` | badge progress #6, #12 |
| `bestCombo` | `Math.max` | stat grid; badge progress #4, #7 |
| `bestQuadClears` | `Math.max` | badge progress #10 |
| `bestBackToBack` | `Math.max` | badge progress #15 |
| `bestLevel` | `Math.max` | reserved for the results screen |
| `maxZoneReached` | `Math.max` | ledger card; badge progress #8, #13 |

Eleven integers, no arrays (arrays are what made `weaponIdsUsed`/`bossesDefeated` unbounded); every value
defends with `?? 0`. The key set is fixed by §10.3: every non-binary STACKED achievement needs a `best*` key
here or a generic `progress` field (`longestRunSeconds`, `paidRuns`) to render a fraction against.
`custom.bestCombo` and generic `progress.maxCombo` come from the same `runStats.maxCombo` and must never
diverge (`tests/game-stat-schema.test.mjs` asserts equality after a reduce); the duplicate exists so no
STACKED surface reads an HMH-named field.

**Three generic fields STACKED must not orphan.** `updateProgressFromRun` computes
`progress.longestRunSeconds` (`Math.max`) and `progress.cumulativeSeconds` (`+=`) from
`runStats.elapsedSeconds`, and `progress.maxCombo` from `runStats.maxCombo ?? runStats.maxKillCombo ?? 0`.
The frozen 16-key projection (§7.3) has **no `elapsedSeconds` key**, so the derivation moves into the
consumer:

```js
const elapsedSeconds = runStats.elapsedSeconds
  ?? (Number.isFinite(runStats.survivalTicks) ? Math.round(runStats.survivalTicks / 60) : 0);
```

HMH and Chikun supply `elapsedSeconds`, so the fallback is inert for them. Ticks stay the ranking quantity
(§8.3); seconds are display-only.

Every other HMH-shaped line in that function is a safe no-op against the 16-key projection —
`distanceMeters`, `kills`, `grenadeKills`, `meleeKills`, `powerUpsCollected`/`collectedPowerUps`,
`maxDamageCombo`, `enemyKillsByType`, `weaponId`, `rareWeaponId`, `bossId` are absent, so each guard falls
through to `?? 0` / `?? {}` / `?? []` or is skipped by `if (runStats.bossId)`. Verified line-by-line against
`:5427-5453`; no STACKED field name may collide with one of them.

---

## 3. `apps/portal/src/game-registry.mjs`

First-party, so it mirrors `hard-money-heroes` (`:13-20`), not chikun's 75/25 third-party split:

```js
'stacked': Object.freeze({
  id: 'stacked',
  name: 'STACKED',
  devWallet: '0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26',
  feeSplit: { dev: 100, platform: 0, liquidity: 0, treasury: 0 }, // first-party
  adapter: null,   // native cabinet — no third-party adapter
  status: 'live',
}),
```

`submitGameRun` in this file is a **stub** — `console.log` plus
`{ success: true, sessionId: Date.now(), gameId }` (`:80-88`). Not the ranked write path; must not be wired
into the STACKED lifecycle. The real path is
`recordScore -> recordCadenceScore -> state.cadenceLeaderboards`.

`REGISTERED_GAMES` is keyed by the **manifest** id (HMH's key is `'hard-money-heroes'` while its
`ARCADE_GAMES.id` is `'lester-blaster'`); STACKED's single-string identity makes them coincide. The map is
deliberately unfrozen (`:10-11`) because `registerGame()` mutates it at runtime; the STACKED entry is a
static literal, not a `registerGame` call.

---

## 4. `apps/portal/games/stacked/game.manifest.json`

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
  "capabilities": ["leaderboard", "achievements", "ranked", "audio"],
  "rankedEligible": true,
  "entry": "./main.mjs",
  "endpoints": [],
  "sandbox": { "allow": ["scripts"], "walletAccess": false, "sameOriginAccess": false },
  "devWallet": null,
  "description": "Deterministic falling-block ledger stacker with parent-seeded Ranked runs, replay-verified scores, and music-reactive projection-only visuals."
}
```

Against `validateGameManifest` (`apps/portal/src/game-manifest.mjs:58-159`):

- `id` — matches `ID_PATTERN` `/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/` (`:43`); 7 chars, inside 3–48.
- `name` — 2–48 chars, and the join key for the README roster gate (§13); exactly `STACKED` in both places.
- `version` — must equal `STACKED_CABINET_VERSION` from `apps/portal/src/stacked-cabinet.mjs`. Assert it:
  `npm run docs:cabinets` compares the manifest against a README cell only, never against the constant.
  `CHIKUN_CABINET_VERSION = '0.5.0'` (`chikun-cabinet.mjs:4`) is the precedent and is likewise unenforced.
- `sdkVersion` — major must be `1` to match `ARCADE_SDK_VERSION = '1.0.0'` (`:19`).
- `status` — `coming-soon` until the README roster row lands in the same commit; `assertCabinetStatusDocs`
  skips a non-playable manifest with no roster row. Inverse rule: a roster row for a non-playable manifest
  **must** contain a coming-soon phrase.
- `aspectSupport` — both entries mandatory (`REQUIRED_ASPECTS`, `:23`).
- `controlScheme` — **`dpad-buttons`.** `CONTROL_SCHEMES` is a closed five-value list (`:25-31`) with no
  gesture value. The action set is left/right/soft-drop on a d-pad axis plus rotate-CW / rotate-CCW /
  rotate-180 / hold / hard-drop buttons; the touch layer (`mobile.md`) is a skin over the same eight actions.
  Extending the list would mean editing the schema module, `tests/game-manifest.test.mjs`, and
  `canonicalManifestPayload`'s digest semantics for a cosmetic gain.
- `capabilities` — pinned in contract §3 as exactly `["leaderboard", "achievements", "ranked", "audio",
  "haptics"]`, in that order. `audio` because the cabinet plays its own SFX and the parent ducks music;
  `ranked` + `leaderboard` are both required for `rankedEligible: true` or validation hard-errors
  (`:112-116`); **`haptics` because the touch layer does call `navigator.vibrate`** — `mobile.md` §12 and
  S-15 ship `apps/stacked/src/haptics.mjs` with `tests/stacked-haptics.test.mjs` as its gate. An earlier
  draft of this bullet omitted it conditionally; the condition is met. `CAPABILITIES` (`:35-41`) accepts
  both spellings, so the drift would be silent — assert the pinned array.
- `entry` — relative same-origin path; absolute `http(s)` URLs are rejected.
- `runtimeVersion`, `sandbox` — **neither is validated or retained.** The normalized frozen manifest carries
  exactly `id, name, version, sdkVersion, status, aspectSupport, controlScheme, capabilities,
  rankedEligible, entry, endpoints, devWallet, description` (`:143-157`); `canonicalManifestPayload` (`:165-`)
  hashes a subset. They are read by `validateSandboxedCabinetManifest` (`apps/portal/src/arcade-sandbox.mjs`),
  which `tests/arcade-sandbox-security.test.mjs:18-38` runs against the **HMH manifest by path**, not a glob —
  so no existing test requires the block (chikun ships without one) and adding it extends no coverage.
  Include it for the security review; extend that test if the assertion is wanted. **The manifest block is
  not the runtime contract:** that test asserts `policy.sandboxAttribute === 'allow-scripts'` while
  `hmh-reboot-host.mjs:121` sets `allow-scripts allow-same-origin allow-pointer-lock` and `chikun-host.mjs`
  sets `allow-scripts allow-same-origin`. STACKED's host needs `allow-scripts allow-same-origin` — the bridge
  reads `iframe.contentWindow`.

`apps/portal/games/stacked/main.mjs` — contract entry re-exporting the deterministic core from
`apps/portal/src/stacked-cabinet.mjs`, following `apps/portal/games/chikun/main.mjs`. Never imported by the
portal runtime; the manifest declares it and the manifest test validates the pair.

---

## 5. Routing, mode select, and mount wiring

### 5.1 `apps/portal/src/arcade-router.mjs`

```js
// ARCADE_GAME_SLUGS (L22-29) — gameId -> slug
stacked: 'stacked',

// ARCADE_GAME_IDS_BY_SLUG (L31-36) — slug -> gameId
stacked: 'stacked',
stack: 'stacked',        // short URL alias, hand-typed links only

// GAME_TITLE_BY_SLUG (L47-52) — breadcrumb titles
stacked: 'STACKED',
```

Missing entries do not error, which is why they are dangerous. `gameSlugFor` falls back to
`DEFAULT_GAME_SLUG = 'hard-money-heroes'` (`:82-84`), so every STACKED run-detail link built by
`leaderboardDetailFor` (`arcade-core.mjs:4503-4516`, `` `/play/${gameSlug}/${urlSessionId}` ``) and every
`routePath` from `getCartridgeSelectModel` would silently point at HMH; `gameIdForSlug` falls back to
`'lester-blaster'` (`:86-88`), so an unmapped `/games/stacked` would load Hard Money Heroes.
`GAME_TITLE_BY_SLUG` is module-private (`const`, not `export`) — edit in place, there is no injection point.

Routes: `/games/stacked` (alias `/games/stack`), `/games/stacked/game-session-<id>`,
`/play/stacked/<urlSessionId>`, `/play/stacked?devCabinets=1`. No `vercel.json` **rewrite** is needed —
`/games/:path*` and `/play/:path*` already catch-all to `/index.html`. The `vercel.json` edits that *are*
required belong to `gates.md` (§6).

### 5.2 `apps/portal/main.js` — `startOfficialMode`

At `main.js:5161-5162`, replace the second line with a table, not a growing if-chain:

```js
setOfficialView(selectedGameId === 'lester-blaster' ? 'character-select' : 'gameplay');   // unchanged
const CABINET_MOUNTS = { chikun: mountChikunSession, stacked: mountStackedSession };      // was: if (selectedGameId === 'chikun') mountChikunSession();
CABINET_MOUNTS[selectedGameId]?.();
```

STACKED has no character select, so the first line is already correct. Everything above this
(`main.js:5118-5155`) applies unchanged: a Ranked start prompts `connectWallet()` and bails on failure,
refuses any `walletConnector !== 'injected-evm'` (the mock/offline QA wallet cannot rank), and requires a
passing `requestRankedEntry()` chain/funding pre-flight. STACKED inherits that gate and must not bypass it.
Free Mode has no wallet requirement — `beginTrackedSession` falls back to `MOCK_WALLET` (`main.js:5861`) —
which is why §9.2's "Free never touches the profile" rule is enforced in the lifecycle, not by the absence of
a wallet. The `allowDevCabinet` pass-through (§2.1) lands in the same commit.

### 5.3 `apps/portal/main.js` — session lifecycle

Add `mountStackedSession()` / `destroyStackedSession()` / `restartStackedSession()` beside the chikun trio
(`main.js:4914-5000`), plus module-level `let stackedActive = false;` and host/lifecycle refs beside
`hmhRebootActive` (L1829) and `chikunActive` (L1832). `mountStackedSession` must:

1. Return early unless `dom.officialCombatMount && currentSession && currentSession.gameId === 'stacked'`.
2. Call `destroyHmhRebootSession()` **and** `destroyChikunSession()` first — `mountChikunSession` only
   destroys the HMH session (`main.js:4933`), a latent two-cabinet bug a third cabinet makes reachable.
3. Build the init context with
   `buildCabinetInitContextFromSession(currentSession, { displayName, locale, aspect, reducedMotion })`
   (`main.js:4934-4939`) — **except `aspect`**. Chikun hard-codes `'landscape'`; STACKED declares both `9:16`
   and `16:9`, so derive `innerHeight > innerWidth ? 'portrait' : 'landscape'` at mount. A later orientation
   change is a projection-only `portal:settings` push, never a re-init — re-initialising re-issues
   `portal:init` and with it the seed.
4. Create `createStackedPortalLifecycle({ state, session: currentSession, recordScoreRef: recordScore,
   persist: persistArcadeStateSoon, onComplete })` (`main.js:4940-4959`). It **must call `recordScoreRef`
   only when `session.leaderboardEligible`**, as `chikun-portal-lifecycle.mjs:45-48` does. Do not lean on
   `recordScore`'s own non-eligible short-circuit: reaching it first runs `ensureProfile` →
   `connectPlayerAccount`, which creates the profile, runs `ensureAllGameProgress`, syncs character unlocks
   and pushes a `wallet-login` row into `state.loginEvents` (`arcade-core.mjs:5149-5161`, `:5170-5172`).
5. Create the host into `dom.officialCombatMount` and drive `combat.paused` / `combat.active` /
   `combat.gameOver` from its `onState` callback — the in-run settings panel (§12.3) is gated on
   `combat.menuSettingsOpen && !combat.pendingBegin && (combat.paused || combat.gameOver || combat.levelUpPaused)`
   (`main.js:3727`). **Refuse `onRestartRequest` when `currentSession.leaderboardEligible`** — the refusal
   belongs at the host, not only in the child UI.
6. Handle abandonment explicitly. `returnToOfficialGameMenu` and `exitToArcade` tear the host down without a
   `game:result`, so an abandoned Ranked run writes nothing — no `recordScore`, no cadence row, no
   achievement. Correct, matches chikun, and stated in the §2.3 Ranked copy. There is **no** resume rail:
   `state.activeSessionCheckpoint` and `state.submittedSessionIds` are persisted but written by nothing
   (§11). Abandonment is a run-history lifecycle state, never a `terminalReason` (STACKED-CONTRACTS §1.3).

Add `destroyStackedSession()` to `returnToOfficialGameMenu` (L4074-4075) and `exitToArcade` (L4091-4092), and
extend the global restart/exit key handlers at L14373-14385 that branch on `chikunActive`.

`document.documentElement.dataset.embeddedCabinet = 'stacked'` is set by the STACKED host as
`hmh-reboot-host.mjs:85-90` and `chikun-host.mjs:38-43` do, and deleted on teardown **only when it still
equals `'stacked'`** — chikun's guard at `chikun-host.mjs:42` is the pattern; HMH's unconditional
`delete root.dataset.embeddedCabinet` at `:89` is not, because with three cabinets a stale teardown clears a
flag another cabinet just set. Without the flag, phones draw the parent touch controls over the cabinet.

### 5.4 `apps/portal/src/routes/official-play-routes.mjs`

- `renderOfficialCabinets` (L93-144): the `cabinet.gameId === 'chikun'` await-loader branch (L109-120)
  becomes a lookup against an injected `cabinetLoaders` map so `loadStackedGame` is awaited on click, with
  the same `is-loading` / `aria-busy` treatment.
- `renderOfficialGameplay` (L225-244): add a `game.id === 'stacked'` branch beside `chikun` (L230-239) and
  `lester-blaster` (L240-243), or the gameplay header keeps HMH text.
- `createOfficialPlayRoutes`: replace the named `loadChikunGame` parameter with `cabinetLoaders` and wire it
  in the dependency object at `main.js:5018-5062` (current `loadChikunGame` at L5039).
- New `apps/portal/src/games/stacked/loader.mjs` exporting `loadStackedGame()`, following
  `apps/portal/src/games/chikun/loader.mjs`.

### 5.5 Free-mode starting-level selector — new DOM

The mode-select panel is one shared screen with fixed ids (`apps/portal/index.html:197-219`:
`#officialModeSelect`, `#officialFreeModeButton`, `#officialFreeModeBanner`, `#officialRankedModeButton`,
`#officialRankedTooltip` at L218) and nothing per-cabinet:

```html
<div id="officialFreeModeOptions" class="mode-card-options" hidden>
  <label for="officialFreeStartLevel">Starting level</label>
  <input id="officialFreeStartLevel" type="range" min="1" max="15" step="1" value="1" />
  <output id="officialFreeStartLevelValue">1</output>
</div>
```

Placement: sibling **immediately after** `.official-mode-grid`, before `#officialRankedTooltip` — not inside
`#officialFreeModeButton` (a range input inside a button is not operable) and not inside the grid
(two-column; a third child becomes a third card). Add `officialFreeModeOptions`, `officialFreeStartLevel`,
`officialFreeStartLevelValue` to the `dom` map in `main.js` (~L1714).

`renderOfficialModeSelect` shows it only when the presentation declares `free.options === 'starting-level'`
(§2.3), sizing `min`/`max` from `free.startLevelRange`, and sets `hidden = true` on every other cabinet and
every Ranked path. `startOfficialMode('free')` reads the value; `startOfficialMode('ranked')` must not —
Ranked `startLevel` is always `1` (`LEVEL_FOR_LINES`, STACKED-CONTRACTS §2.1).

The chosen level is clamped to `free.startLevelRange` in the parent before it leaves `startOfficialMode`,
then rides into the child in `portal:init`'s **`settings`** block, never `session`. The `session` block is
exact-key validated as exactly `['seed', 'buildHash', 'seasonId', 'rankedEligible']` (STACKED-CONTRACTS §4.1,
mirroring `sdk/hmh-bridge-protocol.mjs:106`), so an extra key there is rejected. That is also what stops the
start level entering the seed: `deriveSessionSeed` takes only `{ sessionId, gameId, seasonId, buildHash }`
(`arcade-core.mjs:5194-5196`).

---

## 6. What registration implies elsewhere

Consequences of §2–§5 owned by other documents, one line each.

| Consequence | Owner |
| --- | --- |
| `build.mjs` entry `'stacked/game': apps/stacked/src/main.mjs` → `dist/stacked/game.js`; widen `createHmhPixiPlugin`'s `/apps/hmh-reboot/src/` prefix test to include `/apps/stacked/src/` | `gates.md` |
| `STACKED_ENTRY_JS_CAP` / `STACKED_INITIAL_JS_CAP` (both `null` until measured); `HMH_INITIAL_JS_CAP` unchanged at `1_050_000` | `gates.md`, STACKED-CONTRACTS §2.7 |
| `vercel.json`: `/stacked/(.*)` CSP block, catch-all lookahead `/((?!(?:hmh-reboot\|chikun\|stacked)/).*)`, `/dist/(hmh-reboot\|chikun\|stacked)/(.*)` Cache-Control source | `gates.md`, STACKED-CONTRACTS §3 |
| `apps/portal/sw.js` `PRECACHE_URLS` additions, `CACHE_VERSION` bump, matching `README.md` L17 cache marker | `gates.md` |
| `scripts/syntax-check.mjs` `NODE_CHECK_FILES` — every new `.mjs`, source and test; the list is un-globbed by design (header comment L11-12), so an omission fails open | `gates.md`, STACKED-CONTRACTS §2.10 |
| Child shell `apps/portal/stacked/index.html` + `game.css` | `gates.md` |
| `stacked-cabinet.mjs` and everything under `apps/stacked/src/` must not import `game-adapter.mjs` or `game-manifest.mjs` (that chain statically imports `apps/portal/vendor/ethers.min.js` — 522,050 B on disk — for one keccak hash, and pulls `dist/chunks/chunk-VSG3JNSZ.js`, **392,452 B**, into the cold load) | STACKED-CONTRACTS §2.10 |

**Music (portal-owned).** `apps/portal/src/arcade-playlist-manifest.mjs` `gameQueues` holds two keys,
`hardMoneyHeroes` and `hard-money-heroes`, both pointing at the same 26-track list, byte-identical to
`defaultQueue` — per-game queueing is plumbing that selects nothing today.
`buildArcadeMusicQueueForContext` (`arcade-core.mjs:1120-1126`) tries the raw context first, so the key
`stacked` would match on the first lookup. **Ship no `stacked` key in Phase 1**: the cabinet inherits
`defaultQueue`, which is correct and, given the current data, indistinguishable. Add one only when it is an
ordered *subset*, and only via `scripts/ingest-arcade-playlist-music.py` (which emits both HMH aliases at
L248-251) — a hand edit is reverted on the next asset run. Because the visual layer must work with any track,
a curated queue is a preference, never a dependency.

---

## 7. Run summary schema — `sdk/stacked-run-summary-schema.mjs`

Sibling of `sdk/hmh-run-summary-schema.mjs`: exact-key validation (unknown **and** missing fields both fail),
integer bounds on every numeric, no free-form objects, DOM-free. Reuse the local helper style from the HMH
file (`plain`, `keys`, `integer`, `finite`) rather than importing it — those helpers are module-private.

### 7.1 Constants

Every bound is declared **once**, in `apps/portal/src/stacked-contracts.mjs`, and imported here
(STACKED-CONTRACTS §2; `tests/stacked-contracts.test.mjs` scans for duplicate declarations). This module
declares only `STACKED_RUN_SUMMARY_VERSION = 1`.

| Constant | Value | Note |
| --- | --- | --- |
| `STACKED_MAX_TICKS` | `432_000` | 2 h at 60 Hz. A terminal condition **inside the sim** (`terminalReason: 'tick-ceiling'`), not a validator-only cap — a run that survives a validator-only cap and is then rejected loses the player's score with no recourse. |
| `STACKED_MAX_PIECES` | `216_000` | `floor(STACKED_MAX_TICKS / STACKED_MIN_PLACEMENT_TICKS)`, floor `= 2`. |
| `STACKED_MAX_LINES` | `86_400` | `floor(STACKED_MAX_PIECES * 4 / 10)` — a piece is 4 cells, a row is 10. |
| `STACKED_MAX_QUAD_CLEARS` | `21_600` | `floor(STACKED_MAX_LINES / 4)`. |
| `STACKED_MAX_SCORE` | `1_000_000_000_000` | Derivation below. |
| `STACKED_MAX_ELAPSED_MS` | `7_200_000` | `STACKED_MAX_TICKS * 50 / 3`. |
| `BOARD_ROWS` | `24` | 20 visible + 4 buffer. **`STACKED_MATRIX_ROWS = 40` is retired**; `pressure.maxStackHeight` and `technique.softDropCells` bound against `BOARD_ROWS`. |
| `STACKED_LEVEL_CAP` | `30` | `totals.level` upper bound. |
| `STACKED_ZONE_COUNT` | `6` | `totals.zoneReached` upper bound. |

**Why 1e12 and not 1e9.** Schema-legal maximum score, term by term, at `STACKED_LEVEL_CAP = 30` and
`STACKED_COMBO_BONUS_CAP = 20`:

| Term | Worst case | Points |
| --- | --- | --- |
| Line/spin | densest per line is a CHAIN spin single, `800 × 30 × 3/2 = 36,000`, × `STACKED_MAX_LINES` | 3.110 × 10⁹ |
| MEMPOOL combo | `50 × 20 × 30 = 30,000` per clear × 86,400 all-single clears | 2.592 × 10⁹ |
| GENESIS bonus | `3,200 × 30 = 96,000` × `STACKED_MAX_QUAD_CLEARS` | 2.074 × 10⁹ |
| REORG rejections | `250 × 30` × `floor((432,000 − 3,600) / 120) + 1 = 3,571` | 2.678 × 10⁷ |
| Drop points | `softDropCells ≤ 216,000 × 24` at 1/cell; hard drops at 2/cell | 1.56 × 10⁷ |
| Survival trickle | `10 × 30` every 60 ticks × 7,200 | 2.16 × 10⁶ |
| **Total** | | **≈ 7.82 × 10⁹** |

1e9 would reject runs every other bound accepts. `1_000_000_000_000` dominates by ~128× and is already HMH's
score/xp bound (`sdk/hmh-run-summary-schema.mjs:132`) and `game:state score` bound
(`sdk/hmh-bridge-protocol.mjs:149`), so nothing downstream needs a wider integer. A realistic god-tier run
lands near 10⁷–10⁸. It is a **validator bound, not a sim clamp** — the sim carries no `Math.min(score, …)`.
Ranking is unaffected; `recordScore` only requires a non-negative integer.

### 7.2 Payload shape, bounds, cross-field rules

Seven exact-key blocks plus `schemaVersion`; 42 fields.

```js
{
  schemaVersion: 1,
  identity:  { seed, buildHash, mode, seasonId, terminalReason, startTick, endTick },
  totals:    { score, survivalTicks, elapsedMs, level, zoneReached, pieces, linesCleared },
  clears:    { singles, doubles, triples, quadClears, perfectClears, allClearStreakMax },
  technique: { spins, spinClears, maxCombo, maxBackToBack, holds, hardDrops, softDropCells },
  pressure:  { garbageRowsReceived, garbageRowsCleared, maxStackHeight, topOutTick },
  handling:  { dasTicks, arrTicks, dcdTicks, inputDevice },
  versus:    { wins, losses, draws, garbageSent, garbageReceived, kos, roundsPlayed },
}
```

All numerics are non-negative integers; **no floats anywhere in the summary** — float quantization is what
makes Chikun's `finalState` comparison fragile (`Number(state.y.toFixed(6))` compared by `JSON.stringify`).
**Five fields are strings**, bounded by pattern or enum in the table below: `identity.buildHash`,
`identity.mode`, `identity.seasonId`, `identity.terminalReason`, `handling.inputDevice`. A validator
written from the sentence rather than the table would reject every legal summary.

| Block.field | Bounds | Surface |
| --- | --- | --- |
| `identity.seed` | `0..0xffffffff` | analytics |
| `identity.buildHash` | `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/` | analytics |
| `identity.mode` | `'free' \| 'ranked'` | analytics |
| `identity.seasonId` | `/^[a-z0-9][a-z0-9-]{1,63}$/` | analytics |
| `identity.terminalReason` | `'block-out' \| 'lock-out' \| 'garbage-out' \| 'tick-ceiling' \| 'evidence-ceiling'` | **profile** (run row), trust tooltip |
| `identity.startTick` / `endTick` | `0..STACKED_MAX_TICKS`, `end >= start` | analytics |
| `totals.score` | `0..STACKED_MAX_SCORE` | **leaderboard** (sort key) |
| `totals.survivalTicks` | `0..STACKED_MAX_TICKS` | **leaderboard** (`SURVIVED`, rendered `ticks/60`) |
| `totals.elapsedMs` | `0..STACKED_MAX_ELAPSED_MS` | analytics |
| `totals.level` | `1..STACKED_LEVEL_CAP` | **leaderboard** (`LVL`) |
| `totals.zoneReached` | `1..STACKED_ZONE_COUNT` | profile |
| `totals.pieces` | `0..STACKED_MAX_PIECES` | profile |
| `totals.linesCleared` | `0..STACKED_MAX_LINES` | **leaderboard** (`LINES`) |
| `clears.singles` / `doubles` / `triples` | `0..STACKED_MAX_LINES` | analytics |
| `clears.quadClears` | `0..STACKED_MAX_QUAD_CLEARS` (21,600) | **leaderboard** (`HALVING`) |
| `clears.perfectClears` | `0..STACKED_MAX_QUAD_CLEARS` | profile |
| `clears.allClearStreakMax` | `0..1000` | analytics |
| `technique.spins` / `holds` / `hardDrops` | `0..STACKED_MAX_PIECES` | `spins` profile; rest analytics |
| `technique.spinClears` / `maxBackToBack` | `0..STACKED_MAX_LINES` | profile |
| `technique.maxCombo` | `0..STACKED_MAX_LINES` | **leaderboard** (`COMBO`) |
| `technique.softDropCells` | `0..STACKED_MAX_PIECES * BOARD_ROWS` | analytics |
| `pressure.garbageRowsReceived` | `0..STACKED_MAX_LINES` | profile |
| `pressure.garbageRowsCleared` | `0..STACKED_MAX_LINES` | analytics |
| `pressure.maxStackHeight` | `0..BOARD_ROWS` (24 — **not** 40) | analytics |
| `pressure.topOutTick` | `0..STACKED_MAX_TICKS` | analytics |
| `handling.dasTicks` / `arrTicks` / `dcdTicks` | `4..18` / `1..6` / `0..8` | analytics (G-19) |
| `handling.inputDevice` | `'keyboard' \| 'touch' \| 'gamepad' \| 'mixed'` | analytics |
| `versus.*` (7 fields) | `0..100_000`, **always exactly 0 in Phase 1** | reserved — §7.4 |

The `handling` block is **metadata only — never hashed, never ranked, never fed to the verifier**; it exists
because DAS/ARR/DCD live outside the sim and cannot be recovered from the input stream. Bounds are expressed
against derived constants, never free-standing round numbers: an independent `999` cap on `maxCombo` would
reject a schema-legal 1,000-line run.

Cross-field rules the validator enforces (precedent: `sdk/hmh-run-summary-schema.mjs:111-224`):

1. `singles + 2*doubles + 3*triples + 4*quadClears === linesCleared` — **exact**, not `<=`. A future mechanic
   clearing lines outside those four categories bumps `schemaVersion`.
2. `spinClears <= linesCleared` and `spins <= pieces`.
3. `holds + hardDrops <= pieces * 2`.
4. `garbageRowsCleared <= garbageRowsReceived`.
5. `endTick - startTick === survivalTicks` (HMH enforces the identical rule at `:133`).
6. `linesCleared <= floor(pieces * 4 / 10) + garbageRowsReceived` — REORG rows add clearable cells the player
   never placed, so the piece-derived bound alone would reject a legal high-garbage run.
7. `level === min(STACKED_LEVEL_CAP, 1 + floor(linesCleared / 10))` **in Ranked only** — Free runs may start
   above level 1.
8. `elapsedMs === round(survivalTicks * 50 / 3) ± 1`.
9. `topOutTick <= endTick`, and `topOutTick === endTick` when `terminalReason` is `'block-out'`, `'lock-out'`
   or `'garbage-out'`.
10. `endTick === STACKED_MAX_TICKS` when `terminalReason === 'tick-ceiling'`.
11. Every `versus.*` field is exactly `0` while `schemaVersion === 1`.

**Pause is inside these rules.** `elapsedMs` is a function of `survivalTicks` (rule 8), never wall-clock, and
`survivalTicks === endTick - startTick` (rule 5), so a paused run cannot inflate survival, ranking, or the
tick ceiling — a paused tick is a tick that never happens. That is what makes pause safe in Ranked. The
parent must never pass a wall-clock duration into any of these fields; when the in-run settings panel is
open (§12.3) the sim is paused by construction.

### 7.3 The 16-key persisted projection

`recordCadenceScore` builds one `runStats: { ...entry.runStats }` copy per record and stores that same
reference in all five cadence buckets (`leaderboard-engine.mjs:87-106`) — in-memory cost 1×, but the
**persisted JSON duplicates it five times**, and the quota fallback in `saveArcadeState` drops the entire
`cadenceLeaderboards` slice before giving up (`persistence.mjs:98-113`). The projection is therefore
mandatory. The lifecycle calls

```js
export function projectStackedRunStats(summary, { resultHash16, trust })  // sdk/stacked-run-summary-schema.mjs
```

before handing anything to `recordScore`. It returns a flat 16-key object; the key names are contract because
§2.5, §8.3, §8.4, §9.2 and §10.2 read them directly.

```
score, linesCleared, survivalTicks, maxCombo, quadClears, level,     // 6 leaderboard columns (§8.3)
zoneReached, pieces, spins, spinClears, maxBackToBack, perfectClears,
garbageRowsReceived, terminalReason,                                 // 8 profile fields (§9.2, §10.2)
resultHash16,   // first 16 hex chars of the run's resultHash — binds a row to a stored replay
trust           // 'stacked-parent-replay-v1' — the persisted verification stamp (§8.4)
```

`resultHash16` is deliberately not the full 66-character `resultHash`: enough to answer "does this row match
this stored replay", not enough for anything adversarial; never describe it as a commitment.

No key may collide with a name `updateProgressFromRun` consumes (`kills`, `grenadeKills`, `meleeKills`,
`distanceMeters`, `powerUpsCollected`, `collectedPowerUps`, `maxDamageCombo`, `enemyKillsByType`, `weaponId`,
`rareWeaponId`, `bossId`, `noDamage`). `maxCombo` intentionally does, because §2.5 wants it to feed
`progress.maxCombo`.

Measured `JSON.stringify` character counts for a representative run — score 184,320 / 142 lines /
78,240 ticks / 18 quad clears / L14 / zone 4 / 361 pieces, wallet `0x07cec…48B26`,
`sessionId: 'game-session-000000042'`, ISO `recordedAt`, `settlementTxHash: null`:

| Payload | Chars |
| --- | --- |
| 16-key projected `runStats` | 292 |
| Full 42-field summary | 763 (2.6×) |
| One cadence row (`wallet` + `score` + `sessionId` + `recordedAt` + `runStats` + `settlementTxHash`) with the projection | 475 |
| The same row carrying the full summary | 946 (2.0×) |

`localStorage` quotas count UTF-16 characters (~5 million typical) and `saveArcadeState` reports
`payload.length`, the same unit, so these compare directly. Current-period footprint at the engine's
`limitPerPeriod = 100`: `5 × 100 × 475 = 237,500 chars ≈ 232 KB` per game; with the full summary, ≈ 462 KB.

### 7.4 Reserved `versus` fields

Present in schema v1 so the Two Player phase needs no migration. Meanings fixed now:

| Field | Meaning |
| --- | --- |
| `wins` / `losses` | Rounds this player won / lost in the match this run belongs to. |
| `draws` | Rounds ending in a simultaneous top-out. |
| `garbageSent` | Rows sent to the opponent, per the garbage-attack table (`versus.md`). |
| `garbageReceived` | Rows received **from an opponent** — distinct from `pressure.garbageRowsReceived`, which is solo rising ledger. |
| `kos` | Opponent top-outs caused by this player's garbage. |
| `roundsPlayed` | `wins + losses + draws`; the denominator for a win rate. |

In Phase 1 all are exactly `0`, the validator rejects any other value, and none is projected into `runStats`
or `progress.custom`. **`summary.versus` is the only place they exist** — contract §4.4 freezes that, and
§1.2's rejected-variants table records the two shapes an earlier `versus.md` draft proposed and that are
now dead: `versus: null` on the `game:result` payload or in the stored `runStats` (§4.5 freezes that
payload at seven top-level keys), and `custom.versus` on the progress record (§2.5 freezes `custom` at
eleven keys). No Phase 1 UI may read them — a solo-only board showing "0-0" for everyone is worse
than showing nothing. When Two Player ships, `projectStackedRunStats` gains a `roundsPlayed` key,
`reduceProgress` gains a `roundsPlayed` accumulator, and the profile renders a "Record: W-L" cell behind
`custom.roundsPlayed > 0`. Until then `custom` has exactly the eleven keys in §2.5 and no code may test a
twelfth.

---

## 8. Leaderboards

### 8.1 Cadences — one engine change is required, and it is not the one you expect

`recordCadenceScore(state, gameId, entry, { limitPerPeriod = 100 })` and
`getLeaderboard(state, gameId, cadence, …)` are already `gameId`-parameterised across all five cadences
(`LEADERBOARD_CADENCES = ['daily','weekly','monthly','yearly','all-time']`, `leaderboard-engine.mjs:16`), and
`createInitialArcadeState` builds the `stacked` bucket automatically. STACKED files into all five buckets on
every accepted Ranked run with **no new write code**.

**Historical period buckets are never pruned.** Storage is
`state.cadenceLeaderboards[gameId][cadence][periodKey]`; `recordCadenceScore` only caps a bucket at
`limitPerPeriod` and nothing deletes an old `periodKey`, while `getLeaderboard` reads only the *current*
period key (`:125-126`) — so every past bucket is invisible to the UI and pure dead weight in the save. One
year of daily play across five cadences is `365 + 52 + 12 + 1 + 1 = 431` buckets per game. Saturation is not
a multi-player scenario: **de-duplication inside a bucket is by `sessionId`, not by wallet** (`:99-102`), so
one player's repeated Ranked runs each add a row and 100 runs in a UTC day fills that day's daily bucket to
`limitPerPeriod` plus the four buckets alongside it; per-wallet collapsing happens only at read time
(`bestByWallet`, `:136-144`). At one row per bucket: `431 × 475 ≈ 205 KB` per game per year. At 100 rows per
bucket: `431 × 100 × 475 ≈ 20.5 M chars` — ~4× a typical 5-million-character quota, at which point
`saveArcadeState` silently drops `cadenceLeaderboards` entirely (`persistence.mjs:101`) and every board stops
persisting for every cabinet. A third cabinet triples the rate.

**Decision: add
`pruneCadenceLeaderboards(state, { keepDaily = 14, keepWeekly = 8, keepMonthly = 12, keepYearly = 3 })` to
`leaderboard-engine.mjs`, called once in `main.js` immediately after `loadArcadeState`.** Game-agnostic, so
it fixes HMH and Chikun in the same stroke. Period keys sort lexicographically by construction
(`2026-09-05`, `2026-W36`, `2026-09`, `2026`), so retention is a sort-and-slice per cadence. `'all-time'` has
one constant key and is never pruned. Reads only touch the current period, so pruning removes nothing the UI
can display. (Destructiveness is owner gate G-17, `docs/stacked/DECISIONS.md`.)

Two facts not to design around:

- **The per-deploy `version` filter is dead code.** `getLeaderboard` filters on
  `!row.version || isCurrentVersion(row.version)` (`:132-134`), but `recordCadenceScore`'s `baseRow` has six
  fields and none is `version` (`:87-94`), so every row passes the `!row.version` escape. Do not tell players
  "boards reset each deploy".
- **`recordedAt` is client-clock** — `nowIso()` (`arcade-core.mjs:4923-4925`), bucketed by UTC in
  `periodKeyFor` (`leaderboard-engine.mjs:39-58`), so clock skew decides the daily bucket. Existing
  behaviour; do not claim daily boards are tamper-proof.

### 8.2 Sort key and tie-breakers

Score is the sort key, engine-side: `getLeaderboard` de-duplicates to the best row per wallet, then sorts
`b.score - a.score || recordedAt ascending` (`:145-146`), so earliest-posted wins a tie today. STACKED wants
a skill tie-break. **Add an optional `compareRows` option, defaulting to `null` so existing behaviour is
byte-identical:**

```js
const uniqueBestRows = [...bestByWallet.values()].sort((a, b) =>
  (b.score - a.score)
  || (compareRows ? compareRows(a, b) : 0)
  || String(a.recordedAt ?? '').localeCompare(String(b.recordedAt ?? '')));
```

Thread the same comparator through the per-wallet dedup at `:141`, or two rows from one wallet at identical
scores are separated by `recordedAt` while two rows from different wallets are separated by skill — an
inconsistency a player notices on their own placement first.

STACKED's comparator, from its stat schema: 1. `score` desc (engine) · 2. `runStats.linesCleared` desc (more
lines at the same score means less reliance on high-level multipliers) · 3. `runStats.survivalTicks` desc ·
4. `runStats.quadClears` desc · 5. `recordedAt` asc (engine fallback). HMH and Chikun supply no comparator
and keep today's ordering; `tests/leaderboard-engine.test.mjs` gains a case proving the default path is
unchanged.

### 8.3 Per-game columns — replacing the `chikunBoard` ternary

`apps/portal/src/routes/official-leaderboard-route.mjs` derives everything from one boolean,
`const chikunBoard = routeState.gameId === 'chikun'` (L242), repeated in the sort accessor (L243-254), the
header-label array (L265-277), every row cell (L320-324), and the "your placement" card (L348-350). A third
cabinet turns each into a three-way branch, and the header label and the cell it labels will drift.

**New module `apps/portal/src/game-stat-schema.mjs`:**

```js
export function getGameStatSchema(gameId) { /* registered schema, or the HMH default */ }

// shape:
{
  gameId,
  leaderboardColumns: [                       // exactly 5 middle columns
    { key, label, sortKey, accessor(entry), format(value, helpers) },
  ],
  compareRows(a, b),                          // §8.2 tie-breakers, or null
  youCardLine(entry, helpers),                // the 'small' line under YOUR RANK
  aggregateSessions(state, wallet, progress), // §9.1
  profileStatCells(progress, aggregates),     // [[label, value], ...]
  breakdownCards(progress, aggregates),       // [[title, copy], ...] — exactly 2
  recentRunLine(session, runStats, helpers),  // string
  emptyStateCopy,                             // replaces the hard-coded HMH sentence
  reduceProgress(custom, runStats),           // §2.5
  trustFor(entry, baseTrust, provenance),     // §8.4
}
```

`helpers` carries `formatSurvive` and `formatSeconds`, which the routes already receive by injection; the
module stays DOM-free and imports nothing from `arcade-core.mjs` (§2.5). Register three schemas:
`lester-blaster` (today's HMH shape, byte-identical), `chikun` (today's chikun shape), `stacked`; the default
for an unregistered gameId is the HMH shape, preserving today's fallthrough.

The route's fixed frame stays `#` / `DISPLAY NAME` / `SCORE` / … / `TRUST` / `RUN` / `POSTED` (11 columns);
only the five middle columns are schema-supplied:

| Column | Label | `sortKey` | Accessor | Format |
| --- | --- | --- | --- | --- |
| 1 | `LINES` | `lines` | `runStats.linesCleared ?? 0` | `toLocaleString()` |
| 2 | `SURVIVED` | `survive` | `runStats.survivalTicks ?? 0` | `formatSurvive(ticks / 60)` |
| 3 | `LVL` | `level` | `runStats.level ?? 1` | `` `L${v}` `` |
| 4 | `COMBO` | `combo` | `runStats.maxCombo ?? 0` | `` `×${v}` `` |
| 5 | `HALVING` | `quadClears` | `runStats.quadClears ?? 0` | `toLocaleString()` |

`HALVING` is the player-facing display name; `quadClears` is the identifier. They are decoupled on purpose
(STACKED-CONTRACTS §1.1) — a G-1 ruling that renames the display name changes this one header string and
nothing else.

**Column 2 is the reason the refactor exists.** Today the `survive` accessor (`:248`) and its cell (`:321`)
are the only pair that is *not* game-branched: both read
`runStats.surviveSeconds ?? runStats.elapsedSeconds ?? 0` and hand it to `formatSurvive`. STACKED ranks on
**ticks**, so a shared accessor would sort a 78,240-tick run against a 1,304-second run the moment a mixed
board exists; moving accessor *and* formatter into the schema keeps the sort key and the rendered string
derived from the same expression.

**Rank on ticks, not wall-clock seconds.** `DeterministicSimulation` clamps its accumulator to
`maxCatchUpSteps × fixedStepMs` and records the discarded remainder as `accumulatorOverflowMs`, never
replayed (`apps/hmh-reboot/src/simulation.mjs:151-153`), so a player on a stuttering device accumulates fewer
ticks per real second. Ticks are the fair metric; the displayed `m:ss` is `ticks / 60`.

Two fixes while replacing the ternaries:

- `getVal`'s `default: return e.score` (`:252`) silently sorts by score when the `sortKey` is unrecognised
  while the ▲/▼ arrow sits on a different column. Switching game tabs resets `sortKey` to `'score'`
  (`:97-105`), but nothing validates a sortKey against the active game's columns and the header builds its
  arrow from `routeState.sortKey === sortKey` (`:279`). Validate in the schema lookup: if
  `routeState.sortKey` is not one of `'rank' | 'name' | 'score' | 'trust' | 'date'` and not in the active
  schema's `sortKey` set, reset to `'score'`.
- `:100`, `if (cabinet.gameId === 'chikun') routeState.source = 'local';` — STACKED needs the same.
  `routeState.source ??= 'official'` (`:37`), and the `official` tab shows only rows where
  `leaderboardEntryProvenance` returns `official: true`, which requires a `settlementTxHash`
  (`leaderboard-seed.mjs:34`). `filterLeaderboardEntriesBySource` does **not** fall back when a tab is empty
  — it returns the requested tab with `rows: []` (`:38-54`) and the route assigns that back
  (`routeState.source = sourceBoard.source`, `:49`). A first visit would render an empty board under a
  "Verified Ranked" heading with no hint that "Local Preview" holds the scores.

### 8.4 Trust / provenance for verified-replay runs

**Problem 1 — the verdict does not survive a reload.** `leaderboardRowTrust` (`arcade-core.mjs:4485-4501`)
resolves from, in order: `state.flaggedSessions`, `session.integrity.verdict`, then
`row.settlementTxHash || session?.settlement?.primaryTxHash ? 'settled' : 'prototype'`. The first two are
reached through `state.sessions[row.sessionId]` / `state.flaggedSessions`, and **neither is persisted**
(`persistence.mjs:36-50` allow-list), so after a reload every STACKED row degrades to `Prototype`.

Fix without touching persistence versioning: stamp the verdict into the row. `projectStackedRunStats` writes
`runStats.trust = 'stacked-parent-replay-v1'`, which **is** persisted (it rides inside `runStats`). The
schema's `trustFor(entry, baseTrust, provenance)` returns:

| Condition | verdict | label | tone |
| --- | --- | --- | --- |
| `flaggedSessions` or `session.integrity` says `rejected` | `rejected` | `Rejected` | `danger` |
| … says `suspicious` | `suspicious` | `Needs review` | `warning` |
| `settlementTxHash` present | `settled` | `Settled` | `verified` |
| `runStats.trust === 'stacked-parent-replay-v1'` | `verified-replay` | `Replay verified` | `verified` |
| otherwise | `prototype` | `Prototype` | `muted` |

A flag always outranks the stamp — the stamp says the evidence re-simulated to the submitted numbers, not
that the run is above suspicion. Tooltip flag codes come from `validateStackedRunPlausibility`
(`integrity.md`) and are shipped strings, e.g. `quad-clears-exceed-lines`.

**Problem 2 — the row never renders `trust.label` for an unsettled run.**

```js
trustBadge.textContent = provenance.official
  ? (entry.trust?.label ?? 'Pending')
  : provenance.label.replace('HOUSE SCORE', 'House Score');
```

(`official-leaderboard-route.mjs:325-326`). `provenance.official` is true only when `settlementTxHash` is
present (`leaderboard-seed.mjs:34`), and with settlement disabled every STACKED row is `local-practice` with
`label: 'LOCAL'` — so the cell renders `LOCAL` and the `verified-replay` verdict is never shown. Stamping the
row is necessary but not sufficient.

**Required route change**, alongside the schema extraction: pass `provenance` into `trustFor`, and render
`entry.trust.label` whenever the resolved verdict is one the cabinet owns (`verified-replay`, `suspicious`,
`rejected`), falling back to the provenance label otherwise. The ternary becomes one expression the schema
controls, with the HMH/Chikun schemas returning today's exact strings.

Row copy must say **"Replay verified", never "Verified"**: the parent has no server, all verification happens
in the same JavaScript context that produced the run, and a modified client can produce a self-consistent
forged claim *and* write the `trust` stamp itself. The stamp raises forgery cost and preserves an honest
verdict across reloads; it is not an anti-cheat guarantee and the copy must not imply otherwise.

`filterLeaderboardEntriesBySource` (`leaderboard-seed.mjs:38-55`) is already game-agnostic — it keys off
`entry.seed === true`, a profile `seed` flag, a `0xSEED…` wallet prefix, or `settlementTxHash` — so the
official/local/demo tabs need no change.

---

## 9. Profile

`apps/portal/src/routes/official-profile-route.mjs` builds its game tab bar from `ARCADE_GAMES` (L359-378),
enabling on `game.status === 'playable'` and rendering a disabled `SOON` badge otherwise (L361, L367-368), so
a `coming-soon` entry shows an inert tab from §14 step 2 and goes live automatically at step 10. Everything
below the tab bar is a per-game ternary and moves to the schema.

### 9.1 Concrete edits

| Site | Today | Change |
| --- | --- | --- |
| L380-395 | `hmhStats` / `chikunRuns` / `chikunTotals` computed inline | `const aggregates = schema.aggregateSessions(state, connectedWallet, gp)` |
| L396-400 | empty-state copy hard-codes "score, kills, survival, achievements, and LitVM receipts" | `schema.emptyStateCopy` |
| L402-423 | `routeState.gameId === 'chikun' ? [...] : [...]` stat grid (plus the `bestScore` fallback at L402) | `schema.profileStatCells(gp, aggregates)` |
| L441-459 | `'Flight ledger'` / `'Enemy breakdown'` / `'Ranked integrity'` / `'Boss ledger'` | `schema.breakdownCards(gp, aggregates)` — exactly two cards, same DOM |
| L461-483 | recent-run block, ternary at L472-474 | `schema.recentRunLine(session, runStats, helpers)` |
| L487 | `if (hmhRunHistory && routeState.gameId === 'lester-blaster')` | leave gated; expose an optional `schema.detailCard` hook so STACKED can add its own later |
| L687-694 | five dead `let`s (`officialLeaderboardCadence`, `leaderboardSortKey`, `leaderboardSortDir`, `leaderboardSearch`, `leaderboardGameId`), never read | delete — extraction leftovers |

On the last row: `tests/official-leaderboard-route.test.mjs:73-75` asserts those five names are absent from
**`main.js`**, not from this file. The copies here are unreferenced and nothing catches them; delete them and
extend that test to cover `official-profile-route.mjs`.

**Constraint on `aggregateSessions`:** the current Chikun implementation reduces over `state.sessions`
(L384-395), which is **not persisted** — that card is empty after every reload. STACKED's must read
`profile.progress.stacked.custom` (§2.5), persisted inside `profiles`. It may read `state.sessions` only for
the "last 5 ranked runs" list, which is legitimately ephemeral and labelled as such.

### 9.2 STACKED profile section content

The card is gated on `gp && (gp.paidRuns + gp.freeRuns) > 0` (L396), and `freeRuns` is permanently `0` — but
not because `recordScore` is a no-op for a Free run. Its non-eligible branch returns before
`updateProgressFromRun`, XP, achievements and every board write (`arcade-core.mjs:5496-5514`), but **after**
`ensureProfile` (`:5493`) and `ensureGameProgress` (`:5494`), and `ensureProfile` is `connectPlayerAccount`,
which creates the profile, runs `ensureAllGameProgress`, syncs character unlocks and appends a
`wallet-login` row to `state.loginEvents`. The real guarantee is §5.3: the STACKED lifecycle never calls
`recordScore` for a Free session at all. Everything below counts Ranked runs only and the copy must not
imply otherwise.

**Stat grid (10 cells)** — `[label, value]` pairs against the existing `.game-stats-grid` DOM (a generic
loop; HMH renders 8, Chikun 10):

| Label | Source |
| --- | --- |
| Best Score | `gp.bestPaidScore` — not `max(paid, free)`; `bestFreeScore` is structurally always 0 |
| Ranked Runs | `gp.paidRuns` — not `paidRuns + freeRuns`, which would render "12 (12 ranked)" |
| Longest Run | `formatSeconds(gp.longestRunSeconds)` — fed by the `survivalTicks`-derived seconds in §2.5 |
| Leaderboard | `#rank / total` from `getLeaderboard(state, 'stacked', 'all-time', { wallet })`, else `Unranked` |
| Total Lines | `custom.totalLines` |
| Best Lines (run) | `custom.bestLines` |
| Halvings | `custom.totalQuadClears` |
| Spins | `custom.totalSpins` |
| Perfect Clears | `custom.totalPerfectClears` |
| Best Combo | `custom.bestCombo` (equal to `gp.maxCombo` by construction — §2.5) |

**Cadence rank strip** — new, and the answer to "rank across cadences".
`getAllCadenceLeaderboards(state, 'stacked', { wallet, displayNameFor })` (`leaderboard-engine.mjs:172-174`)
returns one board per cadence carrying `playerRank` and `playerEntry` (`:166-167`). Render a five-cell row —
`DAILY #3 · WEEKLY #7 · MONTHLY #12 · YEARLY #12 · ALL-TIME #14` — with `—` where `playerRank` is null.

**The `—` placeholder and the `·` separators are rendered values, not copy-sheet text.** They are chosen
for alignment in a fixed-width row and are produced from data, so `collectStackedCopyTexts()` must not
collect them and `STACKED_COPY_STYLE_RULES.bannedPlayerFacingPatterns`' `em-dash` rule (`gates.md` §8.2)
does not reach them. Without that scoping the S-20 assertion that the strip renders an em-dash and the
S-22 scan that bans one would collide. If a later change routes the placeholder through the copy sheet,
change it to a hyphen in the same commit.
Reuses `.game-stats-grid` styling; no new CSS.

**Breakdown cards (2)**, matching the existing two-card DOM:

1. *Ledger breakdown* — `${custom.totalLines} lines · ${custom.totalQuadClears} halvings ·
   ${custom.totalSpins} spins · ${custom.totalPerfectClears} perfect clears · best epoch
   ${custom.maxZoneReached}/6.`
2. *Ranked integrity* — "Ranked results are accepted only after the parent re-simulates the recorded input
   stream against the issued seed, build hash, and season. Free runs are verified locally and never write to
   this profile."

**Recent ranked runs (5)** —
`${score} pts · ${urlSessionId} · ${linesCleared} lines · ${quadClears} halvings · L${level} · ${survivalLabel}`
plus the existing trust chip and detail link. Sourced from `profileV2.sessionFeed.rows`, derived from the
unpersisted `state.sessions`, so it is empty after a reload for **every** cabinet — pre-existing, not a
STACKED regression. Do not build a STACKED stat on it; prefer the persisted `state.runHistory` if this list
is ever made durable.

### 9.3 Global leaderboards page

Same schema, same module. `publicLeaderboardCabinets()` picks up the STACKED tab from §2.2 once `playable`
flips; the filter-panel copy at L78 (`playableCabinetNames()` joined by `humanList`) updates itself. The only
manual edits here are §8.3's column refactor and §8.4's trust resolver.

---

## 10. Achievements

### 10.1 Scoping — a prerequisite, not a nicety

`recordScore` calls `maybeUnlockRunAchievements(profile, score, runStats, progress)` for **every**
leaderboard-eligible session with no gameId check (`arcade-core.mjs:5519`), and `FIRST_PAID_RUN` is unlocked
unconditionally inside it (`:5386-5388`), so Chikun ranked runs already unlock HMH badges. Required:

1. `defineAchievement` (`:1413-1441`) gains a `gameId` field defaulting to `'lester-blaster'`, so all **57**
   existing definitions keep their meaning without edits. `gameId: null` marks platform-wide — apply to
   `CABINET_PIONEER` and `FIRST_PAID_RUN` only.
2. `maybeUnlockRunAchievements` takes `session.gameId` and dispatches to a per-game resolver; HMH's existing
   `resolveAchievementUnlocksForRun` (`:4599`) becomes the `lester-blaster` resolver, unchanged.
3. The profile achievement grid (`official-profile-route.mjs:627-654`) filters to
   `gameId === null || gameId === routeState.gameId`. **`achievementSummary` cannot be filtered the same
   way:** it lives inside `buildPlayerArcadeSnapshot(state, wallet)` (`arcade-core.mjs:5776`, summary at
   `:5822-5826`), which has no gameId parameter and several callers. Leave the global summary alone — it is
   the platform-wide total and stays correct — and add a sibling `achievementSummaryByGame` keyed by gameId
   (`null`-scoped badges counted in every bucket). The profile card reads the per-game entry; nothing
   existing changes shape.
4. One-line bug fix while in the file: `ACHIEVEMENT_TIER_UNLOCK_PCT` (`:5861-5863`) is
   `{ bronze: 62, silver: 34, gold: 15, platinum: 6, diamond: 2 }` with no `mythic`, so the six existing
   mythic achievements fall back to `?? 40` (`:5867`) and read as *more common* than gold (15) and platinum
   (6). Add `mythic: 1`. `diffNudge` is `{ easy: 4, medium: 0, hard: -3, expert: -5 }` with `?? 0` otherwise,
   and tier/difficulty are paired one-to-one in the existing set (all six mythic badges are `endgame`, all
   six diamond badges are `long-haul`), so after the fix mythic renders `1%` and diamond `2%` with no
   collision. STACKED ships no mythic badge.

Three hard gates on step 1:

- **Badge assets.** `tests/hmh-achievement-atlas.test.mjs:56-66` iterates `ACHIEVEMENT_LIST` and asserts, for
  every achievement, that `achievementBadgeAssetById(id)` resolves, that `asset.tier` and `asset.unlockType`
  **equal the definition's**, and that both unlocked and locked PNGs exist on disk. Adding 16 definitions
  fails `npm test` — and `npm run vercel:build` through `test:release`, which spawns `node --test` over the
  same suite (`scripts/hmh-reboot-test-retirement-gate.mjs:131`) — until 32 files exist and
  `HMH_ACHIEVEMENT_ATLAS` lists them with matching tier/unlockType. `npm run assets:hmh:achievement-atlas`
  (`scripts/generate-hmh-achievement-atlas.py`) reads `ACHIEVEMENT_LIST` out of `arcade-core.mjs` via a Node
  subprocess (`:49-52`), draws a badge for any id without a hand-made one, and rewrites the manifest
  (`achievementCount` 57 → 73). **Run it in the same commit as the definitions.** The generator itself does
  not raise on an unfamiliar tier or unlockType (`TIER_COLORS` covers all six tiers including `mythic`,
  `:16-23`; per-achievement drawing uses `.get(..., fallback)` at `:168`, `:175`); the reasons the STACKED set
  reuses existing `unlockType` values are the atlas test's equality assertion and `unlockTypeIconSrc`
  resolving to `null` for an unknown type.
- **Title uniqueness.** The grid resolves unlocked state by **title**, not id:
  `new Map((snapshot?.achievements ?? []).map((a) => [a.title, a]))` (`official-profile-route.mjs:627`), so
  two achievements sharing a title light up together. None of the 16 below collides with the 57 existing
  titles; add a uniqueness test so the next cabinet cannot break it silently.
- **The glyph is not a fallback here.**
  `renderAchievementIcon({ iconSrc: a.iconSrc, icon: a.unlocked ? (a.icon ?? '🏅') : '🔒', … })` (`:648`)
  reads `a.iconSrc`, which `defineAchievement` never produces — it emits `badgeSrc` / `lockedBadgeSrc` /
  `tierBadgeSrc` / `unlockTypeIconSrc` — so the grid renders the `icon` string for every achievement today,
  generated PNGs or not. Choose the glyphs as the thing players actually see, one character each.

`unlockAchievement` throws `Unknown achievement: <id>` for an id absent from `ACHIEVEMENTS` (`:5112-5115`), so
the ids must be registered before any resolver can emit them. `unlockType` values outside
`HMH_ACHIEVEMENT_ATLAS.unlockTypesById` resolve `unlockTypeIconSrc` to `null` (`:1430`) — the set reuses
existing types (`score`, `survival`, `combo`, `level-clear`, `skill`, `volume`) and only existing `difficulty`
values (`easy | medium | hard | expert | long-haul | endgame`).

### 10.2 The set — 16 achievements

All use the existing
`defineAchievement({ key, id, title, description, tier, difficulty, unlockType, icon, requirement, gameId: 'stacked' })`
shape. `requirement` is inert metadata (the resolver evaluates) authored to match what the resolver checks,
so the two can be diffed.

| # | key | id | Title | Tier | Difficulty | unlockType | Icon | requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `STACKED_FIRST_SEAL` | `stacked-first-seal` | First Seal | bronze | easy | `score` | `▣` | `{ linesCleared: 1 }` |
| 2 | `STACKED_FIRST_QUAD` | `stacked-first-quad` | Halving Day | bronze | easy | `score` | `◆` | `{ quadClears: 1 }` |
| 3 | `STACKED_FIRST_SPIN` | `stacked-first-spin` | Torque Ledger | bronze | easy | `skill` | `↻` | `{ spinClears: 1 }` |
| 4 | `STACKED_COMBO_5` | `stacked-combo-5` | Chain of Five | bronze | easy | `combo` | `⛓` | `{ maxCombo: 5 }` |
| 5 | `STACKED_SURVIVE_180` | `stacked-survive-180` | Three-Minute Block | bronze | easy | `survival` | `⌛` | `{ survivalTicks: 10800 }` |
| 6 | `STACKED_LINES_40` | `stacked-lines-40` | Forty Rows | silver | medium | `score` | `▤` | `{ linesCleared: 40 }` |
| 7 | `STACKED_COMBO_10` | `stacked-combo-10` | Chain Reaction | silver | medium | `combo` | `⛓` | `{ maxCombo: 10 }` |
| 8 | `STACKED_ZONE_3` | `stacked-zone-3` | Third Epoch | silver | medium | `level-clear` | `Ⅲ` | `{ zoneReached: 3 }` |
| 9 | `STACKED_SURVIVE_360` | `stacked-survive-360` | Six-Minute Miner | silver | medium | `survival` | `⏳` | `{ survivalTicks: 21600 }` |
| 10 | `STACKED_QUAD_10` | `stacked-quad-10` | Ten Halvings | silver | medium | `score` | `◈` | `{ quadClears: 10 }` |
| 11 | `STACKED_PERFECT_CLEAR` | `stacked-perfect-clear` | Empty Ledger | gold | hard | `skill` | `◇` | `{ perfectClears: 1 }` |
| 12 | `STACKED_LINES_150` | `stacked-lines-150` | Hundred-Fifty Block | gold | hard | `score` | `▥` | `{ linesCleared: 150 }` |
| 13 | `STACKED_ZONE_6` | `stacked-zone-6` | Full Chain | platinum | expert | `level-clear` | `Ⅵ` | `{ zoneReached: 6 }` |
| 14 | `STACKED_SURVIVE_900` | `stacked-survive-900` | Fifteen-Minute Validator | platinum | expert | `survival` | `⏱` | `{ survivalTicks: 54000 }` |
| 15 | `STACKED_B2B_10` | `stacked-b2b-10` | Difficulty Adjustment | platinum | expert | `combo` | `⇄` | `{ maxBackToBack: 10 }` |
| 16 | `STACKED_RANKED_25` | `stacked-ranked-25` | Ranked Stacker | diamond | long-haul | `volume` | `✦` | `{ rankedRuns: 25 }` |

Ids #2 and #10 use the technical root `quad`, never the display name: achievement ids are permanent once
unlocked and must not carry a name still under owner gate G-1 (STACKED-CONTRACTS §1.1). The titles are
display copy and move with the display name.

Thresholds against the owner's session-length bands (beginner 2–3 min, intermediate 4–6, expert 6–12, elite
12–30, god 30–40), at 60 ticks/second:

- #5 `10800` = 3:00, top of the beginner band — the first badge that requires surviving rather than starting.
  #9 `21600` = 6:00, the expert floor. #14 `54000` = 15:00, inside the elite band.
- Line thresholds at ~3 pieces per line (2.5 is the perfect-packing floor; real play runs 3–4): **#6, 40 lines
  ≈ 120 pieces**, at a beginner-band ~0.7 pieces/second ≈ 2:50, consistent with #5. **#12, 150 lines ≈ 450
  pieces**, at an expert-band 1.0–1.5 pieces/second ≈ **5:00–7:30**, inside the expert band.
- #12 (gold) is reachable slightly earlier in wall-clock than #9 (silver, 6:00), but neither threshold
  **implies** the other — 6:00 of survival does not produce 150 lines, and 150 lines does not require 6:00 —
  so tier dominance holds. If the final gravity curve in `mechanics.md` makes 150 lines strictly imply 6:00
  survival, raise #12 to 200 lines rather than demoting the tier.
- #16 counts `progress.paidRuns`, and ordering is favourable: `recordScore` runs `updateProgressFromRun`
  (which increments `paidRuns`) at `:5516` **before** `maybeUnlockRunAchievements` at `:5519`, so the badge
  unlocks on the 25th accepted run, not the 26th.

**Tier-dominance rule.** #13 is `platinum`, not `gold`, because zone advancement is driven by survival
milestones and zone 6 (`mainnet-aurora`) is terminal: if reaching it takes longer than 15:00, a gold badge
would be strictly harder than a platinum one (#14). The zone milestone table is owned by `visuals.md`. The
binding constraint: **no achievement whose threshold strictly implies another's may sit at a lower tier.** If
`visuals.md` places zone 6 at or before 6:00, drop #13 to `silver`; at or before 15:00 but after 6:00, drop
it to `gold`. This is the only tier in the set not fixed here.

Coverage: first quad clear (#2), first spin (#3), combo chains (#4, #7, #15), survival (#5, #9, #14), epochs
(#8 mid-run, #13 terminal — per-zone badges for 1/2/4/5 cut because five near-identical badges dilute the
grid), lines-in-a-run (#1, #6, #12), perfect clears (#11), Ranked volume (#16).

Resolver inputs: 15 of 16 read single-run fields from `runStats` (`linesCleared`, `quadClears`, `spinClears`,
`maxCombo`, `survivalTicks`, `zoneReached`, `perfectClears`, `maxBackToBack`) — all in the projected 16-key
`runStats` (§7.3); #16 reads `progress.paidRuns`. None reads a `progress.custom` cumulative, so the resolver
stays a pure function of `(runStats, progress)`.

### 10.3 Free vs Ranked

**All 16 are Ranked-only, structurally.** `recordScore`'s non-eligible branch returns
`{ acceptedForGlobalLeaderboard: false, trackingDisabled: true, localScore, unlockedAchievements: [] }`
before `updateProgressFromRun`, XP or `maybeUnlockRunAchievements` (`arcade-core.mjs:5496-5514`) — and per
§5.3 the lifecycle does not reach it at all for a Free run. There is no parent write path from Free Mode and
adding one would break the Free/Ranked isolation the owner locked.

To keep the sandbox from feeling dead, ship a **device-local Free medal shelf**: storage key
`stacked-free-medals-v1`, plain `localStorage`, owned by the child runtime — **not** in
`lesters-arcade-save-v1`, not in `profile.achievements`, not in `state`. Same 16 thresholds evaluated
child-side, rendered inside the cabinet results screen only, never on the portal profile, never counted
toward `achievementSummary`, never sent over the bridge. Profile copy: "Free Mode medals are practice-only
and stay on this device. Profile badges unlock in Ranked."

The profile grid additionally shows locked STACKED badges with progress text (`112 / 150 lines`) from
persisted aggregates. #1–#15 are **single-run** thresholds while `custom` holds cumulative *and* best-of
aggregates, so the progress text must read a best-of source, never a cumulative one —
`custom.totalQuadClears` against a single-run threshold of 10 would claim progress a player has not made:

| Badge | Progress source |
| --- | --- |
| #6, #12 (lines in a run) | `custom.bestLines` |
| #4, #7 (combo) | `custom.bestCombo` |
| #10 (quad clears in a run) | `custom.bestQuadClears` |
| #15 (back-to-back) | `custom.bestBackToBack` |
| #5, #9, #14 (survival) | `gp.longestRunSeconds × 60`, compared in ticks |
| #8, #13 (epoch) | `custom.maxZoneReached` |
| #16 (ranked volume) | `gp.paidRuns` |
| #1, #2, #3, #11 (threshold = 1) | none — binary, render as a plain locked chip |

Nothing reads a cumulative `total*` key for badge progress. The locked-badge progress line is new DOM in the
grid at `official-profile-route.mjs:639-652`, behind the same per-game filter as the badges.

---

## 11. Persistence

**`ARCADE_PERSIST_VERSION` stays at `3`. Do not bump it.** `restoreArcadeState` gates on
`![1, 2, ARCADE_PERSIST_VERSION].includes(snapshot.version)` and returns `false` otherwise
(`persistence.mjs:58`). There is no migration function — an unrecognised version is silently ignored and then
overwritten on the next save, so bumping to `4` destroys every existing player's profile, usernames and
leaderboards. Nothing STACKED adds requires a shape change:

| New state | Where it lives | Why no bump |
| --- | --- | --- |
| `state.cadenceLeaderboards.stacked` | Already snapshotted wholesale (`persistence.mjs:42`) | New key under an existing object |
| `profile.progress.stacked` (incl. `custom`) | Inside `profiles`, copied wholesale (`:29-35`) | New key under an existing object |
| `profile.achievements` STACKED ids | Existing flat string array | No shape change |
| `state.runHistory` STACKED rows | Existing array; `appendRunRecord` spreads whatever the caller passes, so the lifecycle must include `gameId: 'stacked'` | No shape change |

STACKED writes nothing to a new arcade save key. Its own `localStorage` keys sit outside
`snapshotArcadeState`: `stacked-player-settings-v1` (§12); `stacked-replay-v1:<sessionId>` with index
`stacked-replay-v1:index` (owned by `apps/portal/src/stacked-replay-store.mjs`, 2-replay LRU,
`STACKED_MAX_STORED_REPLAY_CHARS = 240_000`, written **after** the score write so storage never holds a
replay for a run that did not rank — `integrity.md`); and `stacked-free-medals-v1` (§10.3).

Existing saves:

- A v1/v2/v3 save loads normally. Its `profiles` entries have no `progress.stacked` —
  `ensureAllGameProgress` creates one lazily from `ARCADE_GAMES` (`arcade-core.mjs:4960-4965`) on the next
  `ensureProfile` / `connectPlayerAccount` (`:5150`) or `buildPlayerArcadeSnapshot` (`:5778`), and
  `progress.custom` by the `??=` guard in §2.5. Nothing is lost and nothing throws.
- A corrupt (unparseable) save is removed via `storage.removeItem` and the session starts clean
  (`persistence.mjs:125-130`). Unchanged.
- Quota pressure degrades in three steps: full → drop `avatarDataUrl` → drop `cadenceLeaderboards`
  (`:98-113`). The 16-key projection roughly halves the row against the full 42-field summary, but the
  projection alone does **not** make step three rare — unbounded historical period buckets do, and §8.1's
  `pruneCadenceLeaderboards` is the actual fix. Ship both.

Not persisted, therefore off-limits as a source for any STACKED profile card: `state.sessions`,
`state.officialSessions`, `state.settlements`, the flat `state.leaderboards`, `state.flaggedSessions`,
`state.sessionsByUrlId`, `state.loginEvents`, `state.payments`, `state.transactions`. §8.4 and §9.1 route
around this.

`RUN_HISTORY_LIMIT` (50) is shared across cabinets and stays as it is — run history is a convenience feed,
not the record of truth.

`state.activeSessionCheckpoint` and `state.submittedSessionIds` (`SUBMITTED_SESSION_LIMIT` 1000) are persisted
and restored (`persistence.mjs:44-49`, `:82-89`) but **written by nothing** in `apps/portal/src` or `main.js`
— grep-verified. They are inert schema, not an existing resume rail or double-submit guard. STACKED must not
assume either exists; adding one is new work in its own cycle and needs no version bump because the fields
are already in the snapshot.

---

## 12. Settings

New module `apps/portal/src/stacked-player-settings.mjs`, a strict sibling of
`apps/portal/src/hmh-player-settings.mjs`: same `clamp`/`bool`/deep-`freeze` helpers, same
`normalize…(input)` → frozen object contract, same "normalize on every read, never trust storage"
discipline. Storage key `stacked-player-settings-v1`, `STACKED_PLAYER_SETTINGS_VERSION = 1`. It must not
extend the HMH settings object — HMH's bindings come from `apps/hmh-reboot/src/action-map.mjs` and its action
set has nothing in common with this one.

```js
export const STACKED_PLAYER_SETTINGS_DEFAULTS = freeze({
  version: 1,
  handling: {
    dasMs: 133,    // clamp  67..300  -> dasTicks 8, range 4..18
    arrMs:  33,    // clamp  17..100  -> arrTicks 2, range 1..6
    dcdMs:   0,    // clamp   0..133  -> dcdTicks 0, range 0..8
    cancelDas: true,
  },
  controls: {
    keyboardBindings: { ...DEFAULT_STACKED_BINDINGS },  // 8 actions, §12.1
    touchLayout: 'gesture',    // 'gesture' | 'buttons'
    touchOpacity: 0.4,         // clamp 0.2..0.8
    touchLeftHanded: false,
    touchSensitivity: 1,       // clamp 0.5..2
  },
  video: {
    qualityTier: 'auto',       // 'auto' | 'desktopHigh' | 'desktopLow' | 'mobile'
    reducedEffects: false,
    audioReactive: true,
    ghostPiece: true,
    gridLines: true,
  },
  audio: { musicEnabled: true, sfxEnabled: true, sfxVolume: 0.85 },
  accessibility: { reduceMotion: false, reduceFlash: false, colorblindPieces: false, hudScale: 1 },
});
```

**There is no soft-drop-factor setting.** `SOFT_DROP_FACTOR = 20` is a frozen sim constant read inside
`step()` (STACKED-CONTRACTS §2.1); a per-player value would have to travel in the evidence header and be
applied by the verifier, and a verifier running defaults would diverge from the run it is checking.

Handling values are stored in ms for the UI and converted to ticks **exactly once, at run start**:
`dasTicks = clamp(round(dasMs / (1000/60)), 4, 18)`, `arrTicks = clamp(round(arrMs / (1000/60)), 1, 6)`,
`dcdTicks = clamp(round(dcdMs / (1000/60)), 0, 8)`. The UI displays the **snapped** value so the number the
player sees is the number the run uses; the ms clamps above are exactly the ranges those tick bounds admit.
The three resolved tick values are recorded in `summary.handling` (§7.2).

`video.qualityTier` is the explicit player override read first by `selectStackedQualityTier`
(`apps/stacked/src/render/quality-tier.mjs`, `visuals.md`); `'auto'` runs the selection ladder. Reduced
motion is a **modifier**, never a tier — it lives in `accessibility.reduceMotion`.

### 12.1 Action set and remapping

Eight actions, primary and secondary key code each, in the frozen bit order: `moveLeft`, `moveRight`,
`softDrop`, `hardDrop`, `rotateCW`, `rotateCCW`, `rotate180`, `hold` (STACKED-CONTRACTS §2.3). Export
`rebindStackedKeyboard(settings, actionId, code, { rankedActive })` mirroring `rebindHmhPlayerKeyboard(...)`
(`hmh-player-settings.mjs:95-104`).

**Ranked lock rule: rebinding is refused while `rankedActive === true` and permitted freely between runs**,
matching the existing HMH copy — "Rebind from the in-game pause panel; ranked bindings are locked."
(`main.js:3794`). It costs nothing in integrity terms — the evidence is a per-tick action mask, not key codes
— but a mid-run rebind is a plausible source of an unintended input and an unreproducible complaint.

**DAS/ARR/DCD are permitted in Ranked and editable at any time, but a change takes effect at the next run
start, never mid-run.** Two facts:

1. Recorded Ranked evidence is the post-expansion **per-tick held-state mask**, not raw key transitions, so
   DAS/ARR/DCD sit entirely outside the sim and a run recorded on any handling configuration re-simulates
   identically on a verifier running defaults (STACKED-CONTRACTS §2.3). That is what makes them a legitimate
   free setting rather than a fairness hole.
2. The ms→tick conversion happens once at run start and `summary.handling` records the values the run used;
   a mid-run change would make that block ambiguous and answer G-19's cross-device fairness question with a
   value no run actually used.

Locking handling entirely would punish players for owning a keyboard preference and would not make a forged
run harder. §2.3's Ranked copy states the rule.

### 12.2 Projection-only settings

`video.qualityTier`, `video.reducedEffects`, `video.audioReactive`, `video.ghostPiece`, `video.gridLines` and
every `accessibility.*` value are **projection-only** and may change at any moment, including mid-Ranked;
none can reach collision, RNG, scoring, evidence, or results. AGENTS.md: "Art, interpolation, particles,
shaders, audio, animation LOD, and quality tiers are projection-only. They may not change collision, damage,
AI, spawning, RNG, progression, evidence, or results."

`audioReactive: false` must fully disable the analyser-driven visual layer, and the visual-regression capture
harness must force it off so baselines stay deterministic. `ghostPiece` looks like a gameplay setting and is
not — the ghost renders a position the sim already computed — so it stays available in Ranked (owner gate
G-11, recommendation **on**).

### 12.3 Where the UI lives

**In-run panel** — `#combatSettingsPanel` (`apps/portal/index.html:280`), rendered by
`renderCombatSettingsPanel()` (`main.js:3725-3845`): four quick-action buttons (music, gore, viewport,
auto-fullscreen), a nine-range tuning grid over `hmhPlayerSettings.audio/controls/accessibility`, a control
summary, an accessibility grid and a touch grid, ending in one `replaceChildren(...)` of twelve nodes
(`:3844`). It reads from **two** stores — `hmhPlayerSettings` for the ranges and control summary,
`gameSettings` for quick actions, accessibility toggles and touch options — so a generic model must carry a
read/write pair per control, not a single dotted path. Rather than forking a 120-line function on
`stackedActive`, add
`apps/portal/src/cabinet-settings-registry.mjs` mapping `gameId -> buildSettingsModel(settings)` returning
`{ sections: [{ title, copy, controls: [{ kind: 'toggle'|'range'|'enum', id, label, description, read(), write(v) }] }] }`.
`renderCombatSettingsPanel` renders that generically; the HMH model is the current panel expressed as data,
so its DOM output is unchanged. The panel is gated on
`combat.menuSettingsOpen && !combat.pendingBegin && (combat.paused || combat.gameOver || combat.levelUpPaused)`
(`:3727`) — hence §5.3's requirement that the host drive `combat.paused`, and hence the fact that opening the
panel mid-run means the sim is paused (§7.2).

**Portal Settings route** — `renderSettings()` in `apps/portal/src/routes/official-shell-routes.mjs:97-112`
is four static info cards (Controls / Audio / Network / Sign out). Add a fifth, per-cabinet card list driven
by the same registry, so handling values are editable outside a run. This is where a player sets DAS/ARR
before ever starting one.

STACKED's model, in order: **Handling** (3 ranges + 1 toggle), **Controls** (8 rebind rows + touch-layout
enum + opacity range + sensitivity range + handedness toggle), **Video** (quality enum + 4 toggles),
**Audio** (2 toggles + 1 range), **Accessibility** (3 toggles + hud-scale range).

Changes are pushed to the mounted child through `portal:settings`. The HMH protocol is the shape to mirror,
not the module to reuse: `validateSettingsPayload` is exact-key `['settings']` wrapping an exact-key inner
payload (`sdk/hmh-bridge-protocol.mjs:138-141`). STACKED gets its own
`apps/portal/src/stacked-bridge-protocol.mjs` (`STACKED_BRIDGE_PROTOCOL = 'stacked-bridge/v1'`,
`STACKED_MAX_MESSAGE_BYTES = 65_536`) alongside `chikun-bridge-protocol.mjs`; its `validateSettings` and the
defaults object above must be edited in the same commit or every settings push is rejected by its own
validator. Only the projection-only subset in §12.2 may travel mid-run; handling values travel but apply at
the next run start (§12.1), and `startLevel` travels once on `portal:init` (§5.5) and never again.

---

## 13. Tests and docs this document owns

| File | Requirement |
| --- | --- |
| `README.md` roster | Add a row to the `## Current game roster` table (header L29, rows L31-33), keyed exactly by the manifest `name` (`STACKED`) in the first cell — `parseReadmeRoster` joins on that cell, not the Game ID column — in the **same commit** that flips `status` to `playable`. The State cell must contain none of `coming soon` / `coming-soon` / `not public-playable` / `not public playable` / `not yet playable` / `not yet public`; a stated semver must equal `manifest.version`. Inverse: a roster row for a non-playable manifest **must** contain one of those phrases. |
| `README.md`, `AGENTS.md`, `docs/THIRD_PARTY_GAME_ONBOARDING.md` | Once the manifest is playable, no line — and no line under a heading naming STACKED — may pair a coming-soon phrase with a word starting with "stack" (§1.1). |
| `tests/stacked-run-summary-schema.test.mjs` | Exact-key rejection (extra and missing field) at every block; every bound; all eleven cross-field rules; `versus.* !== 0` rejected at `schemaVersion 1`; the `tick-ceiling` invariants; `projectStackedRunStats` returns exactly the 16 keys in §7.3. |
| `tests/game-stat-schema.test.mjs` | HMH and Chikun schemas produce byte-identical column/label/accessor/trust output to today's hard-coded arrays; STACKED produces the §8.3 five; after a reduce, `custom.bestCombo === progress.maxCombo`. |
| `tests/stacked-public-integration.test.mjs` | `getGame('stacked')` resolves; `createInitialArcadeState` creates both board slots; `ensureAllGameProgress` creates `progress.stacked`; `gameSlugFor('stacked') === 'stacked'`; `gameIdForSlug('stack') === 'stacked'`; `gameIdForSlug('stacked') === 'stacked'`; `publicLeaderboardCabinets()` includes it once `playable` flips; `buildGameModeSelectModel('stacked')` is non-null; **every asset path in the `ARCADE_GAMES` `presentation` block and the `CABINET_MODE_SELECT_PRESENTATIONS` entry exists on disk** (nothing else gates this — §2.1); app-shell `playable` and `ARCADE_GAMES` `status` agree; manifest `version === STACKED_CABINET_VERSION`. |
| `tests/stacked-achievements.test.mjs` | All 16 ids **and titles** unique across `ACHIEVEMENT_DEFINITIONS`; a Free session unlocks nothing; a Ranked STACKED session unlocks no `lester-blaster`-scoped badge; `ACHIEVEMENT_TIER_UNLOCK_PCT.mythic` exists and is below `diamond`. |
| `npm run assets:hmh:achievement-atlas` | Run and its output committed in the same commit as the 16 definitions, or `tests/hmh-achievement-atlas.test.mjs` fails on 32 missing badge PNGs (§10.1). |
| `tests/leaderboard-engine.test.mjs` | `compareRows` default path byte-identical; `pruneCadenceLeaderboards` keeps the current period and never touches `all-time`. |
| `tests/arcade-core.test.mjs`, `tests/arcade-router.test.mjs` | Assertions for the added entries, slugs, and the `stack` alias. |
| `tests/persistence.test.mjs` | A v3 save with no `progress.stacked` restores without throwing and gains the key lazily. |
| `tests/official-leaderboard-route.test.mjs` | Extend the dead-`let` assertion to cover `official-profile-route.mjs`. |
| `tests/chikun-portal-lifecycle.test.mjs`, `tests/chikun-runtime.test.mjs` | Pass **unchanged** after the §2.4 verifier-registry refactor; the sync packet's chikun `canonicalRunStats` / `canonicalReplayClaim` byte-identical. |

Every new `.mjs` — source and test — must be appended to `NODE_CHECK_FILES` in `scripts/syntax-check.mjs`
(`gates.md`). `npm test` is `node --test tests/*.test.mjs tests/projectile-pool.test.mjs`, so a new test file
is picked up by filename alone. The deploy gate and the certification rule for CSP/routing/service-worker
changes (`AGENTS.md:122`) belong to `gates.md`.

---

## 14. Landing order

1. `stacked-contracts.mjs` (every frozen constant, no imports) and a `stacked-cabinet.mjs` stub exporting
   `STACKED_CABINET_VERSION = '0.1.0'`. Everything imports these; neither imports `arcade-core.mjs`.
2. `arcade-core.mjs` §2.1 + §2.2 + §2.3, `arcade-router.mjs`, `game-registry.mjs`, the two placeholder SVGs
   **and** the three mode-select images, the manifest at `coming-soon` with **no** README roster row, plus the
   `allowDevCabinet: DEV_CABINETS_ENABLED` pass-through in `beginTrackedSession` — without it
   `?devCabinets=1` reaches mode select and then throws on start. After this commit the cabinet is reachable
   only at `?devCabinets=1`, the profile shows an inert `SOON` tab, and the boards and
   `profile.progress.stacked` exist.
3. `leaderboard-engine.mjs`: `compareRows` + `pruneCadenceLeaderboards` with the default-path regression test.
   Small, isolated, fixes an existing HMH/Chikun problem — land it before anything depends on it.
4. `game-stat-schema.mjs` + the leaderboard/profile refactors (§8.3, §8.4, §9.1), registering HMH and Chikun
   first and asserting no visual change. Highest regression risk in the plan; land it alone.
5. `run-verifier-registry.mjs` (with the `canonicalize` hook) and the two `arcade-core` call-site
   replacements (§2.4).
6. `sdk/stacked-run-summary-schema.mjs` + `projectStackedRunStats`, then the STACKED stat schema.
7. Build entry, budgets, `vercel.json`, `sw.js` + README cache marker, child shell, host/bridge/lifecycle,
   `main.js` mount wiring and the `index.html` mode-select DOM (§5; `gates.md` for the build/CSP/SW half).
   Creates a new deployment candidate — certify before step 8.
8. Achievement `gameId` scoping + the 16 definitions + the resolver + `npm run assets:hmh:achievement-atlas`
   output — **one commit**, because definitions without the regenerated atlas fail `npm test`.
9. `stacked-player-settings.mjs` + `cabinet-settings-registry.mjs` + the two settings surfaces.
10. Flip to public — **one commit, four files that move together**: manifest `status: 'playable'`;
    `ARCADE_GAMES` `status: 'playable'` + `publicPlayable: true`; app-shell `status: 'playable'` +
    `playable: true`; README roster row with no coming-soon phrase and a semver equal to `manifest.version`.
    Then sweep `README.md`, `AGENTS.md` and `docs/THIRD_PARTY_GAME_ONBOARDING.md` for any line — or heading
    scoping a line — pairing a coming-soon phrase with a word starting with "stack" (§1.1). Nothing enforces
    the ARCADE_GAMES/app-shell agreement today; `tests/stacked-public-integration.test.mjs` is what makes it
    enforced from here on. Gated on owner gates G-1, G-2, G-3.
