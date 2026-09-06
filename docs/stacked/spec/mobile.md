# STACKED — Mobile, Touch, Gamepad & Responsive Layout

> Precedence: `../STACKED-CONTRACTS.md` overrides this specification wherever they disagree.

**Scope.** Authority for STACKED's on-screen cell solver and portrait/landscape geometry, the touch
control scheme and its thresholds, gamepad and keyboard defaults, haptics, the mobile quality tier's
render budget and thermal behaviour, and orientation / backgrounding / interruption handling.
Everything here is **projection or input-layer**: no rule may read a wall clock inside a fixed step,
and no rule may change the recorded input mask in a device-dependent way. The one contract crossing
into the simulation is the frozen 8-bit action mask (`docs/stacked/STACKED-CONTRACTS.md` §2.3),
identical for keyboard, touch, on-screen buttons and gamepad. Where this document disagrees with
`STACKED-CONTRACTS.md`, the contract wins. Sim rules → `mechanics.md`; particle presets, zone
palettes, render tree → `visuals.md`; evidence codec, plausibility gate, replay storage →
`integrity.md`; leaderboards, achievements, portal shell → `portal.md`; two-player layout →
`versus.md`; CI gates → `gates.md`.

**Contents.** §0 ownership, modules, build wiring · §1 layout mode selection · §2 portrait geometry ·
§3 landscape geometry · §4 safe areas and thumb reach · §5 touch control scheme · §6 the input layer
and the frozen mask · §7 quality tier and mobile render budget · §8 orientation change mid-run ·
§9 backgrounding and interruption · §10 thermal governor · §11 gamepad and keyboard · §12 haptics ·
§13 settings and manifest values · §14 test and gate plan.

---

## 0. Ownership, modules, and build wiring

One direction of coupling is legal: **the classifier may read simulation state; the simulation may
never read the classifier.** Auto-shift consults "can this piece still move left?" (§6.3); the spawn
lockout consults the last spawn tick (§5.3). Because the recorded artifact is the per-tick mask and
replay replays masks rather than re-running the classifier, this creates no feedback path into
verification.

| File | Exports | Status |
|---|---|---|
| `apps/stacked/src/touch-gestures.mjs` | `GesturePointer`, `createGestureClassifier` | in contract §2.10 |
| `apps/stacked/src/input-intents.mjs` | `STACKED_INTENTS`, `STACKED_INTENT_BIT`, `createIntentQueue`, `createAutoShift`, `buildTickMask` | in §2.10 |
| `apps/stacked/src/gamepad.mjs` | `STACKED_GAMEPAD_MAP`, `mapStackedGamepadEdges` | in §2.10 |
| `apps/stacked/src/cell-solver.mjs` | `STACKED_LAYOUT_TUNING`, `selectStackedLayoutMode`, `solveStackedCellLayout` | addition |
| `apps/stacked/src/safe-area.mjs` | `readSafeAreaInsets`, `readViewportBox` | addition |
| `apps/stacked/src/touch-tuning.mjs` | `STACKED_TOUCH_TUNING`, `deriveTouchThresholds` | addition |
| `apps/stacked/src/touch-pad-layout.mjs` | `solveStackedPadLayout` | addition |
| `apps/stacked/src/haptics.mjs` | `STACKED_HAPTIC_PATTERNS`, `createHapticChannel` | addition |
| `apps/stacked/src/thermal-governor.mjs` | `THERMAL_LADDER`, `createThermalGovernor` | addition |

"Addition" = not yet in the contract's §2.10 map; must be added there.

Two earlier module names are **dead** (contract §2.8, §2.6): `apps/stacked/src/layout.mjs` — the
board-slot layout function is `layoutMatch` in `apps/portal/src/stacked-layout.mjs` — and
`apps/stacked/src/stacked-performance.mjs` — the quality tier is
`apps/stacked/src/render/quality-tier.mjs`.

Every module and test file above must be appended to `NODE_CHECK_FILES` in
`scripts/syntax-check.mjs`. That array is explicit and un-globbed by design (header, line 7: the
lists carry no globbing "so nothing silently escapes the gate"), so an omission escapes
`npm run check`, which sits inside `vercel:build`.

**Build wiring, not optional.** `createHmhPixiPlugin` (`build.mjs:70`, plugin `hmh-pixi-vendor`)
externalizes `pixi.js` to the shared vendor chunk only when
`externalizeRuntimeImports && importer.includes('/apps/hmh-reboot/src/')` (line 76); every other
importer falls through to `{ path: pixiModule }` (line 79), inlining the whole 575,891-byte engine.
Widen that test to an array including `/apps/stacked/src/` in the same commit that adds the entry, or
`dist/stacked/game.js` ships a second full copy of Pixi. `HMH_INITIAL_JS_CAP` (`build.mjs:42`) stays
`1_050_000`; `STACKED_ENTRY_JS_CAP` and `STACKED_INITIAL_JS_CAP` are `null` until S-11 measures them
(contract §2.7).

### 0.1 Composing with `layoutMatch`

`layoutMatch` (`apps/portal/src/stacked-layout.mjs`) positions authored board boxes — `CELL_PX = 32`,
frames `'wide'` 512 × 640 and `'tall'` 320 × 800 — returning
`{ slot, frame, x, y, scale, visible }`. This document's solver resolves the on-screen CSS cell and
feeds `scale = cell / CELL_PX`.

- `'tall'` = 10 × 25 authored cells: 20 playfield + 1.5 spawn-headroom + 3.5 rows of in-box HUD. At
  cell 28 that is 280 × 700: 602 px board+headroom, 98 px HUD — within 2 px of the solved
  `hudTopWithRailsCollapsedPx` of 96.
- `'wide'` = 16 × 20 authored cells: 2.6 hold rail + 10 board + 2.4 next rail + 1 frame chrome
  across, 20 playfield rows down. The 1.5-row headroom band is overdraw above the authored box, not
  inside it, which is why the landscape height divisor is still 21.5 (§3).
- `x`/`y` are integers, so a slot origin never lands on a half CSS pixel. `scale` is uniform but
  generally **not** an integer (`28 / 32 = 0.875`). Contract §2.8's "All four are integers" must be
  read as applying to `x`/`y`; an integer `scale` forces `cell ∈ {32, 64, …}` and contradicts the
  same paragraph's `14 ≤ cell ≤ 44`. Flagged for the contract's next revision; no constant changes.
  Crispness comes from the device-pixel snap (§2), which makes `cell × snapResolution` — hence
  `scale × CELL_PX × snapResolution` — an integer.

---

## 1. Layout mode selection

Board = `BOARD_WIDTH` 10 columns × `BOARD_VISIBLE_ROWS` 20 rows, plus **1.5 rows of dimmed spawn
headroom** rendered above (the top-out warning band, drawn into 1.5 of the 4 `BOARD_BUFFER_ROWS`).
Layout divisor is `21.5`, never `20`.

`selectStackedLayoutMode` is a pure function of the *visual* viewport, not the layout viewport.
`applyLayout` in `createTouchControlAdapter` (`apps/hmh-reboot/src/touch-controls.mjs:286`) reads
`windowRef.visualViewport ?? null` first and falls back to `innerWidth`/`innerHeight`, with a comment
recording that anchoring to the layout viewport put the movement stick under the URL bar on a real
phone. Use the same fallback chain.

```js
export const STACKED_LAYOUT_TUNING = Object.freeze({
  version: 'stacked-layout-v1',
  columns: 10,
  visibleRows: 20,
  spawnHeadroomRows: 1.5,
  rowDivisor: 21.5,               // visibleRows + spawnHeadroomRows
  landscapeEnterAspect: 1.16,     // prior mode portrait -> landscape at or above
  portraitEnterAspect: 0.862,     // = 1/1.16; the band is symmetric in log-aspect
  minCellPx: 14,                  // pre-snap bound; per-tier effective bounds in §2
  maxCellPx: 44,
  gutterPx: 12,
  railPanelMinPx: 64,             // absolute floor; the live test is cell-relative, §2
  previewCellFraction: 0.45,
  hudTopPx: 56,                   // 36 px readout row + 20 px of breathing room
  hudTopWithRailsCollapsedPx: 96, // 36 (readout) + 4 (gap) + 56 (hold/next strip)
  padBandPx: 132,                 // bottom band reserved by the on-screen-button scheme
});
```

- `aspect = viewportWidth / viewportHeight`.
- No prior mode: `portrait` if `aspect < 1`, else `landscape`.
- Prior `portrait`: stay portrait until `aspect >= 1.16`, then `landscape`.
- Prior `landscape`: stay landscape until `aspect <= 0.862`, then `portrait`.

Threshold order matters: with portrait exiting at 0.862 and landscape at 1.16, `aspect = 1.0`
satisfies **both** exits and the mode flips on every re-solve. The dead band is `(0.862, 1.16)`;
inside it the current mode is kept.

**Band width derivation.** Aspect is a ratio, so `(0.92, 1.16)` is not symmetric — 0.16 above 1.0,
0.08 below. On a near-square viewport of side `S` with `c` px of collapsible browser chrome,
visual-viewport aspect swings between `S/(S+c)` and `1`; collapsing chrome grows the visible height
and lowers the aspect, so the downward rail is under pressure. At the smallest realistic near-square
mobile viewport (`S ≈ 700`, `c = 90`) that is `700/790 = 0.886` — crosses a 0.92 rail, not 0.862.
Rails are `1.16` and `1/1.16 = 0.862`.

The band is inert on a phone (390 × 844 is aspect 0.462; a 90 px height swing moves it only across
0.418–0.517). It earns its keep on tablets in split view and resizable desktop windows.

Exactly **two** modes. No tablet mode; a tablet lands in `landscape` with a larger clamped cell.
`classifyDevice` (`apps/portal/src/device-model.mjs:11-30`) does classify a large touch device as
`tablet` (`MOBILE_MAX = 600` / `TABLET_MAX = 1024` on the shortest side), but that drives the portal
shell, not the cabinet.

---

## 2. Portrait (9:16) geometry

Two solves, never a feedback loop. Pass 1 probes and picks the branch; pass 2 solves that branch and
is final. The branch is never re-evaluated against pass 2's output — that is what would oscillate,
and 320 × 568 is a viewport where it demonstrably would.

**Device-pixel snapping.** Snap so `cell * snapResolution` is an integer. At 1.25 that quantizes the
cell to 0.8 CSS px steps; unsnapped, the cell lands on a fractional device pixel and produces seams
between minos on roughly every fourth column.

- **`snapResolution` is the run-start *resolved* render resolution** — the output of the full §7
  clamp chain, `max(1, min(tier.resolutionCap, devicePixelRatio))` after the per-tier area ceiling —
  evaluated once at run start and frozen. It is **not** `resolutionCap`: a 1440 × 900 desktop window
  at dpr 1 resolves to 1, so snapping to the `desktopHigh` cap of 2 would permit a cell of 40.5 on a
  half device pixel. Resolve first, then snap.
- Snapping is applied **after** the raw clamp and **before** the min/max bounds, so effective bounds
  are `minCellPx' = ceil(14 * r) / r` and `maxCellPx' = floor(44 * r) / r`: 14.4 and 44 at
  `r = 1.25`; 14 and 44 at `r = 1`, `1.5`, `2`.
- `snapResolution` is **never** re-read from the resolution the thermal governor is running at (§10)
  nor re-derived when `reduceMotion` toggles (§13). Either would change the cell; the cell sets
  `moveStepPx`; `moveStepPx` is touch sensitivity. Only a relayout (§8) may re-snap the cell, and
  that is already a recorded, visible discontinuity.

```
safe        = readSafeAreaInsets()                        // env(safe-area-inset-*) probe
Wu          = W - safe.left - safe.right - 2*gutterPx
bottomBand  = touchScheme === 'pad' ? padBandPx : max(safe.bottom, 8) + 48

// pass 1 - probe, picks the branch
probeHu     = H - safe.top - hudTopPx*hudScale - bottomBand
probeCell   = clamp(min(Wu/10, probeHu/21.5), 14, 44)
probeRail   = (W - safe.left - safe.right - 10*probeCell) / 2
railMinPx   = max(railPanelMinPx, 4*0.45*probeCell + 12)  // cell-relative, derived below
railsUsable = probeRail >= railMinPx

// pass 2 - final
hudTop      = (railsUsable ? hudTopPx : hudTopWithRailsCollapsedPx) * hudScale
Hu          = H - safe.top - hudTop - bottomBand
cell        = snap(clamp(min(Wu/10, Hu/21.5), 14, 44))    // floor(c*r)/r, then bounds
boardW      = 10*cell
boardH      = 20*cell
rail        = (W - safe.left - safe.right - boardW) / 2
boardLeft   = safe.left + rail
boardBottom = H - bottomBand - 4
boardTop    = boardBottom - boardH
headroomTop = boardTop - 1.5*cell                         // clipped at safe.top if it does not fit
```

Anchoring the board to the **bottom** of the free region is what makes the `minCellPx` floor
survivable: when the viewport is too short for `21.5 * cell`, the headroom band is clipped and the 20
playfield rows are never clipped. Absolute rule.

**The rail test is cell-relative.** A preview must fit a 4-wide piece:
`previewCell = min(0.45*cell, (panelWidth - 6)/4)` where `panelWidth = rail - 6` (panel inset 3 px
from the screen-safe edge and 3 px from the board edge). Holding `previewCell >= 0.45*cell` needs
`panelWidth >= 4*0.45*cell + 6`, i.e. `rail >= 1.8*cell + 12`. `railPanelMinPx = 64` survives only as
an absolute floor: at `cell = 14.4` the relative test asks 37.9 px, not enough rail for a readable
panel at any cell, so 64 wins. Evaluated: at the phone-portrait probe cell of 30.65 the test asks
**67.2 px**; at the tablet probe cell of 44 it asks **91.2 px**.

**Consequence: a phone in portrait never gets side rails.** On 390 × 844 the probe rail is 41.7
against 67.2. That is the default phone-portrait layout, not an edge case.

Worked example — 390 × 844 CSS, dpr 3, safe top 47 / bottom 34, gesture scheme, `hudScale` 1, mobile
tier (`snapResolution` 1.25):

| quantity | value |
|---|---|
| `Wu` | 390 − 0 − 0 − 24 = **366** |
| `bottomBand` | max(34, 8) + 48 = **82** |
| `probeHu` | 844 − 47 − 56 − 82 = **659** |
| `probeCell` | min(36.6, 659/21.5 = 30.65) = **30.65** |
| `probeRail` | (390 − 306.5)/2 = **41.7** → below the required 67.2, so **strip layout** |
| `hudTop` | **96** |
| `Hu` | 844 − 47 − 96 − 82 = **619** |
| raw `cell` | min(36.6, 619/21.5 = 28.79) = **28.79** |
| snapped `cell` | floor(28.79 × 1.25)/1.25 = 35/1.25 = **28.0** |
| board | **280 × 560**, `boardTop` 198, `boardBottom` 758 |
| headroom band | 42 px tall, from y 156 |
| free rail each side | **55** — decorative, holds the zone/combo readout only |

The snap costs 0.79 px (28.79 → 28.0) because 28.8 would exceed `Hu/21.5`. The snap always rounds
**down**, or the board overflows its own solve.

Element placement, portrait — **strip layout** (all phones):

| Element | Placement | Size |
|---|---|---|
| Score / lines / level | HUD row 1, full `Wu` width, inside `safe.top` | 36 px tall, text refreshed at 10 Hz |
| Hold + next queue (5) | HUD row 2, one horizontal strip | 56 px tall; slots proportional, not fixed — five 2 px gaps, and the remaining `Wu − 10` splits 18.5% to hold and 16.3% to each of five next slots (18.5 + 5×16.3 = 100). At `Wu` 366: hold 65.9, next 58.0 each. At `Wu` 296 (320-wide phone): hold 52.9, next 46.6 each, where `previewCell` is bound by `0.45*cell` = 8.6 long before slot width bites |
| Preview minos | inside their slots | `previewCell = min(0.45*cell, (slotW − 6)/4, (slotH − 8)/2)` = **12.6** at cell 28 |
| Board | horizontally centred | `10*cell × 20*cell` |
| Spawn headroom band | directly above the board | `1.5 * cell`, 35% opacity, top-out line at its base, clipped at `safe.top` |
| Zone / combo readout | free rail, vertically centred on the board | `rail − 6` wide |
| Pause | top-right, **outside** the thumb arcs (§4) | 44 px hit rect |
| Hold button (gesture-scheme redundancy) | bottom corner opposite the drag hand | 56 px hit rect |

**Side-rail layout** (`probeRail >= railMinPx`; tablets and unusually wide portraits): hold panel in
the left rail top-aligned to board row 0 at `2.6 * cell` tall, next queue in the right rail at
`2.2 * cell` per slot with slots 4–5 at 70% scale, `hudTop` back to 56, zone/combo below hold.
Tablet check, 820 × 1180, safe 24/20, dpr 2, mobile tier (`snapResolution` 1.25): `probeCell` clamps
at 44, `probeRail` 190 against 91.2 → side rails; final cell 44 (44 × 1.25 = 55, already snapped),
board 440 × 880, panel 184 wide, `previewCell` 19.8. Vertical use = 24 (safe) + 56 (HUD) + 66
(headroom) + 880 (board) + 4 + 68 (bottom band) = **1,098 of 1,180**, 82 px of slack above the
headroom band. Nothing stretches.

---

## 3. Landscape (16:9) geometry

Landscape is height-bound, essentially always. The constraint is a column budget, not a fraction of
viewport width:

```
Hu          = H - safe.top - safe.bottom - 2*gutterPx
heightCell  = Hu / 21.5
widthCell   = (W - safe.left - safe.right - 2*hudColumnPx - 4*gutterPx) / (10 + 2.6 + 2.4)
cell        = snap(clamp(min(heightCell, widthCell), 14, 44))
```

with `hudColumnPx = 120`. `widthCell` is the cell at which the board group plus both HUD columns
exactly fills the safe width, and it is slack by a wide margin on every golden viewport. (An earlier
draft capped the board at 34% of viewport width. Inert — the outer columns are fixed-width and do not
scale with the board — and removed rather than left as a rule that never fires.)

844 × 390, safe left/right 47, safe top/bottom 0 (notched phone rotated): `Hu` = 366,
`heightCell` = 17.02, `widthCell` = (844 − 94 − 240 − 48)/15 = 30.8 → raw 17.02, snapped at
`snapResolution` 1.25 to **16.8**, board **168 × 336**. Columns:
47 + 120 + 43.7 + 168 + 40.3 + 120 + 47 = 586 of 844, 258 px of slack in the outer columns.
`previewCell` is 7.6 px there — the honest cost of landscape on a phone, and why portrait is the
primary mobile target.

Column order, left to right:

`[ safe.left | HUD column (score/level/lines, 120 px) | Hold rail (2.6*cell) | board | Next rail (2.4*cell) | zone/combo column (120 px) | safe.right ]`

Board group centred, outer columns absorb slack. Thumb arcs sit at the bottom corners, clear of the
HUD columns' bottom 96 px.

**Landscape has no `bottomBand`, and the pad scheme does not shrink the landscape cell.** The height
budget subtracts only safe insets and gutters; pad clusters live in the outer slack, occupying the
bottom 96 px of the combined outer region (HUD column plus its share of slack: 129 + 120 = 249 px per
side on 844 × 390, 47 of it safe inset, leaving 202 px against a 3-button cluster needing ~150 px at
48 px hit rects). Selecting `pad` in landscape re-solves nothing; `padBandPx` is portrait-only.
`touchScheme` is still frozen mid-run (§13) because a run can rotate, and in portrait it moves the
cell.

Reference solves: 1180 × 820 tablet landscape at dpr 2 (`snapResolution` 1.25) → cell 36.8, board
368 × 736, group 792 of 1180. 1440 × 900 desktop at dpr 1 → resolution `max(1, min(2, 1)) = 1`, so
`snapResolution` **1**, cell 40, board 400 × 800. Only `maxCellPx` binds above that: 3440 × 1440
gives `heightCell` 65.86 → clamps to 44, group 900, outer columns take the remaining 2,540 px.

---

## 4. Safe areas and thumb reach

Safe-area insets use the `env()` probe proven by the exported `readSafeAreaInsets`
(`apps/hmh-reboot/src/touch-controls.mjs:136`): a hidden fixed-position div whose padding is set to
`env(safe-area-inset-*)`, read back through `getComputedStyle`, then removed. Copy it into
`apps/stacked/src/safe-area.mjs` rather than importing across the app boundary —
`touch-controls.mjs:1` imports `computeTouchControlLayout` from `./input.mjs`, which pulls in HMH's
world-space math and action map, so a one-function import drags all of that in for a 12-line probe.

`apps/portal/hmh-reboot/index.html`, `apps/portal/chikun/index.html` and `apps/portal/index.html`
all ship `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`;
`apps/portal/stacked/index.html` uses the identical meta. `viewport-fit=cover` is what makes
`env(safe-area-inset-*)` non-zero. Do **not** add `user-scalable=no` — ignored on iOS, and an
accessibility smell.

**Thumb arcs.** One-handed at 390 × 844: a disc of radius ~145 CSS px centred at `(40, H − 44)`
(right-handed: `(W − 40, H − 44)`). Two-thumb: radius 130 centred at `(56, H − 72)` and
`(W − 56, H − 72)`.

Placement rules — rules, not guidance:

1. Any control hit **under time pressure** has its centre inside a thumb arc: the Hold button and
   every pad-scheme button.
2. Pause is placed **outside** every thumb arc, top-right inside `safe.top`. A pause button inside
   the arc gets hit mid-run.
3. No interactive control may overlap the board rect. `solveStackedCellLayout` returns the board rect
   and every control rect; `tests/stacked-layout.test.mjs` asserts zero overlap on every golden
   viewport.
4. Nothing within `safe.bottom` of the bottom edge, nothing within 16 px of the left/right edges on a
   device reporting non-zero `safe.left`/`safe.right` (rotated notch).
5. Pad buttons clear the home-indicator strip, anchoring at `H − max(safe.bottom, 8) − 12`.
6. **Hit-test order is controls first, gesture surface second.** A pointerdown inside any control rect
   belongs to that control and never enters the classifier. The gesture surface is the board rect
   inflated by 12 px plus the rails, *minus* every control rect.

**Handedness.** The Hold button anchors in the bottom corner **opposite** the drag hand: default
bottom-left for the left thumb; `touchLeftHanded` mirrors it. In one-handed play the button is out of
reach by construction and the swipe-up Hold (§5.3) is the path. Handedness mirrors control
*positions* only; it does **not** mirror the rotation tap halves — left half is always
counter-clockwise, right half always clockwise, because those are spatial mappings onto the board.

---

## 5. Touch control scheme

**Default: gesture ("Direct Touch"). Alternate: on-screen buttons ("Pad"), a settings option.**

Gesture is the default because pad costs a 132 px bottom band, which on 390 × 844 drops `Hu` from
619 to 569 and the cell from 28.0 to 26.4 — 5.7% smaller cell, **11% less board area**. Pad ships
because gesture requires sustained fine motor control and some players cannot or will not use it; it
is an accessibility requirement, not a preference toggle.

### 5.1 Tuning constants

```js
export const STACKED_TOUCH_TUNING = Object.freeze({
  version: 'stacked-touch-tuning-v1',

  // Horizontal move
  moveStepCellFraction: 0.62,   // drag distance per column, as a fraction of cell
  moveStepMinPx: 16,
  moveStepMaxPx: 30,
  maxStepsPerSample: 4,         // per coalesced sample; guards a scheduler-stall jump
  moveQueueMax: 9,              // = STACKED_MOVE_QUEUE_MAX; board width - 1

  // Axis lock
  axisLockTravelPx: 10,

  // Tap (rotate)
  tapMaxTravelPx: 12,
  tapMaxDurationMs: 220,
  pairTapWindowMs: 90,          // second pointerdown inside this window = 180 rotate

  // Soft drop
  softDropVelocityPxPerSec: 380,
  softDropMinTravelPx: 24,
  softDropReleaseTravelPx: 8,   // upward travel that clears bit 2 without a release

  // Hard drop
  hardDropVelocityPxPerSec: 1200,
  hardDropMinTravelPx: 90,
  hardDropMaxDurationMs: 180,
  velocityWindowMs: 60,
  hardDropMonotonicSamples: 3,

  // Shared
  spawnLockoutMs: 140,          // applies to hardDrop AND soft-drop engage
  holdSwipeUpVelocityPxPerSec: 700,
  holdSwipeUpMinTravelPx: 56,
  maxConcurrentPointers: 3,
  postRelayoutSwallowMs: 400,
});
```

`deriveTouchThresholds({ cell, touchSensitivity })` resolves pixel values:
`moveStepPx = clamp(cell * 0.62 / touchSensitivity, 16, 30)`. `touchSensitivity` is clamped to
`[0.5, 2]`, the range `validateSettings` (`sdk/hmh-bridge-protocol.mjs:63`) already enforces.

The quantity describing the feel is the **gain**, `cell / moveStepPx` — unclamped a constant
`1/0.62 = 1.61×`; the clamps make it vary:

| Case | `cell` | `moveStepPx` | gain |
|---|---|---|---|
| Phone portrait (390 × 844) | 28.0 | 17.4 | **1.61×** |
| Tablet portrait | 44.0 | 27.3 | 1.61× |
| Phone landscape (844 × 390) | 16.8 | 16 (floored) | 1.05× |
| Cell floor (14.4) | 14.4 | 16 (floored) | 0.90× |

At the phone-portrait figure, 17.4 CSS px on a 390 px-wide, ~64 mm-wide display is **2.9 mm of thumb
travel per column**; crossing the 10-wide board (9 steps) costs 156 px ≈ 26 mm. The 16 px floor is
not cosmetic: below it, resting-finger digitizer jitter of 1–2 px produces phantom column steps, so
on small cells the gain falls toward and below 1:1 rather than the floor being removed. This 1.6× to
0.9× spread across devices is the substance of owner gate G-19 (contract §5.5).

### 5.2 Per-pointer state machine

Each active pointer runs an independent `GesturePointer`. Up to 3 concurrent; a 4th `pointerdown` is
ignored, not queued.

```
undecided --travel >= 10px, |dx| >= |dy|--> horizontal  (claims "mover" if free, else spent)
undecided --travel >= 10px, |dx| <  |dy|--> vertical
undecided --a second undecided pointerdown within 90ms--> pairTap (both pointers)
undecided --pointerup, travel < 12px, duration < 220ms--> tap, then done
pairTap   --first pointerup, both still inside the tap limits--> rotate180; other pointer -> spent
pairTap   --either pointer breaks a tap limit--> both revert to undecided classification
vertical  --emits hardDrop--> spent (soft-drop bit released in the same tick)
spent     --emits nothing at all until pointerup
any       --pointerup / pointercancel--> done
```

**Axis lock is the single most important rule here.** Decided once, when travel first exceeds 10 px,
and it survives until pointerup. A horizontally-locked pointer can never soft- or hard-drop; a
vertically-locked pointer can never move columns. That kills the two classic touch failures of the
genre: hard-dropping while shuffling sideways, and drifting a column while soft-dropping.

Only one pointer holds the `mover` role — the first to lock horizontal; a second that locks
horizontal while the role is taken becomes `spent`. This lets a player drag-move with one thumb while
tapping rotate with the other, which is the actual input-rate unlock.

### 5.3 Gesture definitions

**Horizontal move — drag, incrementally re-baselined.** Each time the pointer's x crosses another
`moveStepPx` from the *last committed* position (not the pointerdown origin), one column step is
banked into the move queue and the baseline advances to the current x. The queue drains at the
encoding's rate (§6.1).

`getCoalescedEvents()` is called on every `pointermove` when available, so a 120 Hz digitizer's
intermediate samples are not lost on a 60 Hz frame; otherwise the classifier processes the single
event. `maxStepsPerSample = 4` applies **per sample**, not per event, and the sample re-baselines to
the pointer position with the remainder dropped. Reaching it needs `4 * 17.4 / sampleInterval` —
about **4,200 px/s** at 60 Hz, **8,400 px/s** at 120 Hz. Crossing the whole 390 px screen inside one
16.7 ms frame is 23,400 px/s, so a real drag never reaches the cap while coalescing works; the cap
exists for the scheduler stall that delivers one uncoalesced jump.

The bank bound is `STACKED_MOVE_QUEUE_MAX = 9` (contract §2.3), and 9 is not arbitrary: the piece
starts somewhere in a 10-wide well, so a tenth banked step cannot change where it ends up. Steps
beyond 9 are dropped and counted into `droppedInputs`.

**Rotate — tap.** Fires on `pointerup` when the pointer never left `undecided`, travel < 12 px,
duration < 220 ms. Left half of the gesture surface → `rotateCCW` (bit 5); right half → `rotateCW`
(bit 4); pair tap → `rotate180` (bit 6).

The pair is committed at the second `pointerdown`, provided it lands within 90 ms of the first
pointer's own down and **both are still `undecided`**; from that instant neither can emit a single
rotation. `rotate180` is emitted when the *first* of the pair lifts, provided both are still inside
`tapMaxTravelPx` and `tapMaxDurationMs`; the survivor becomes `spent`. If either breaks a tap limit
first, the pair dissolves and both revert to ordinary classification — the one that moved becomes
horizontal or vertical, the one that did not can still tap. No timer anywhere in this, only
comparisons at event time. Left/right halves already cover both single rotations, so the second
finger buys the 180 (otherwise two taps and two lock-delay resets) rather than duplicating
counter-rotate.

**Soft drop — downward drag past a velocity gate.** A vertically-locked pointer requests bit 2 **set**
when trailing-60 ms downward velocity exceeds 380 px/s **and** cumulative downward travel exceeds
24 px. Bit 2 is **cleared** on pointerup, on pointercancel, when the pointer travels 8 px back
upward, or when the pointer becomes `spent`. Bit 2 is the only level bit in the mask; the sim applies
`SOFT_DROP_FACTOR = 20` gravity while it is set (`mechanics.md`).

**Hard drop — flick.** Requires *all five*:

1. The pointer is vertically locked.
2. Trailing-60 ms downward velocity ≥ 1200 px/s.
3. Cumulative downward travel ≥ 90 px.
4. Total pointer duration ≤ 180 ms.
5. The last 3 position samples were all monotonically downward.

Velocity is computed over a *trailing 60 ms window*, never first-sample-to-last, so a slow drag
ending in a flick reads as a flick and a fast drag decelerating into a stop does not.

**The flick-eats-the-next-piece bug, and the two rules that kill it.** A flick necessarily satisfies
the soft-drop gate on its way through (24 px at 1,200 px/s), so the naive stream sets bit 2, then
bit 3, then clears bit 2 whenever the finger lifts. If that release lands on a later tick, the *next*
piece spawns already soft-dropping.

- **A pointer that sets bit 3 becomes `spent`**, and bit 2 is cleared in the *same tick's mask*.
  Contract §2.3 precedence rule 4 (`hardDrop` beats `softDrop`) makes that tick unambiguous and
  identical under replay.
- **`spawnLockoutMs = 140` covers both bit 3 and the soft-drop engage.** Neither may be requested
  within 140 ms of the last piece spawn, so a soft-drop level engaged before a lock does not carry to
  the new piece; the pointer must re-cross the 24 px / 380 px/s gate. The classifier reads the sim's
  last spawn tick — legal, one-way, per §0.

**Hold — swipe up, or button.** A vertically-locked pointer with upward velocity ≥ 700 px/s and
upward travel ≥ 56 px sets bit 7. The 56 px minimum is deliberately larger than the soft-drop gate
because an upward swipe is also the browser's scroll-away gesture. The 56 px Hold button is the
redundant path and the only one available to players who cannot flick reliably.

### 5.4 The hard problems, answered

| Problem | Resolution |
|---|---|
| Tap vs short drag | Classified on pointerup or on threshold crossing, whichever comes first. **No timers anywhere.** A pointer that has banked a column step can never become a tap; one that never leaves `undecided` and lifts inside 12 px / 220 ms is a tap. The exits are mutually exclusive, so there is no ambiguous middle. |
| Accidental hard drop | Five stacked gates (§5.3) plus the 140 ms spawn lockout. Axis lock alone eliminates the dominant case (a sideways shuffle that dips). |
| Flick landing on the next piece | The `spent` rule plus the shared spawn lockout. |
| Input rate for fast players | Re-baselined incremental stepping, coalesced-sample draining, a 9-deep move queue, up to 3 concurrent pointers with a single-owner mover role, zero delay timers. A competent player sustains 6–8 discrete intents/sec; the throughput ceiling is the mask encoding's (§6.1), not the classifier's. |
| One-handed play | The gesture surface spans board plus rails and needs no reach precision. Only Hold and Pause are positional; the swipe-up Hold path needs no reach at all. |

### 5.5 Pad scheme (alternate)

Eight controls, each with a **48 CSS px minimum hit rect** around a 26–30 px glyph — 48 rather than
the 44 `buildDeviceProfile` returns as `minTapTargetPx` for touch devices
(`apps/portal/src/device-model.mjs:58`), because 44 px is fine for a menu item, not for a control
pressed several hundred times per run.

- Left cluster (bottom-left arc): `left`, `right`, `soft drop`.
- Right cluster (bottom-right arc): `rotate CCW`, `rotate CW`, `hard drop`, `HOLD`.
- Pause: top-right HUD, unchanged.

`left`/`right` are hold-to-repeat through `createAutoShift` (§6.3). `hard drop` fires on the
`pointerdown` rising edge only, with the same 140 ms spawn lockout. `soft drop` holds bit 2: set on
pointerdown, cleared on pointerup, pointercancel, or the tick the pointer leaves the button rect.
`touchLeftHanded` swaps the clusters. `touchScale` in `[0.75, 1.5]` scales button radii — the range
`validateSettings` (`sdk/hmh-bridge-protocol.mjs:64`) enforces for HMH's `touchScale`.

**`touchScale` scales glyphs inside a fixed band; it never resizes the band.** `padBandPx` stays 132
at every scale, which is what makes `touchScale` hot-swappable mid-run (§13): a growing band would
move the cell and `moveStepPx` with it. Clusters are two rows inside the band, so button radius is
clamped to `min(touchScale * 24, (padBandPx - 12) / 4)` — base radius 24 (the 48 px minimum rect)
against a ceiling of 30, since two rows of 2 × 30 plus a 12 px gap is exactly 132 — and at
`touchScale > 1.25` the clusters spread horizontally rather than growing vertically. The 48 px
minimum is a floor on the *rect*, not the glyph, and is never scaled below 48 even at 0.75.

**Pointer accounting.** `maxConcurrentPointers = 3` is a property of the **gesture surface**, not the
controls. Each pad button owns at most one pointer and is hit-tested independently (§4 rule 6), so a
player may hold `left`, `soft drop` and `rotate CW` while a fourth finger lands on `HOLD`. A second
pointer inside an already-owned button rect is ignored, not queued, and does not re-trigger its
rising edge.

Selecting pad sets `bottomBand = 132` **in portrait** and re-solves the cell (§2); in landscape it
changes no geometry (§3). Frozen during a Ranked run (§13).

---

## 6. The input layer and the frozen mask

### 6.1 One `uint8` held-state mask per tick

Keyboard, gesture, pad button and gamepad converge on the frozen 8-bit mask of contract §2.3 before
`step()` is called: bit 0 `moveLeft`, 1 `moveRight`, 2 `softDrop` (**level** — the only held bit),
3 `hardDrop`, 4 `rotateCW`, 5 `rotateCCW`, 6 `rotate180`, 7 `hold`. All eight bits are allocated; a
ninth action would invalidate every stored replay and force `stacked-bridge/v2`. `pause` is **not** a
bit — a runtime state change, never recorded.

An earlier draft proposed a 9-action edge alphabet with an explicit `softDropOff`. Dead: with a
per-tick mask, `softDropOff` is bit 2 going to `0`. The classifier design, spawn lockout and flick
rules above survive unchanged; only the encoding they feed differs.

`buildTickMask` is a **per-tick** function, not per-frame. On a frame running N catch-up steps it is
called N times, so the recorded byte for tick T is exactly the byte handed to `step()` on tick T and
the verifier needs no host adapter.

```js
// apps/stacked/src/input-intents.mjs
export function buildTickMask(prevMask, queue, held, ctx) {
  let mask = 0;
  if (held.softDrop && !ctx.spawnLockoutActive) mask |= 1 << 2;      // level bit
  if (queue.moveSteps > 0) {
    const bit = queue.moveDir === 'left' ? 0 : 1;
    if ((prevMask & (1 << bit)) === 0) { mask |= 1 << bit; queue.moveSteps -= 1; }
  }
  for (const intent of queue.edges) {                                // arrival order
    const bit = STACKED_INTENT_BIT[intent];                          // 3, 4, 5, 6 or 7
    if ((prevMask & (1 << bit)) === 0) { mask |= 1 << bit; queue.consume(intent); }
    // else: leave queued one tick so the bit can fall and re-rise
  }
  return mask;
}
```

**Throughput, stated exactly.** `STACKED_MAX_MOVE_STEPS_PER_TICK = 1` is structural: one move bit per
tick. Move bits are edge-triggered inside the sim, so a bit set on tick T must be clear on T+1 before
firing again. Sustained stepping is therefore **one column per two ticks — 30 cells/s** — and
draining a full 9-step queue takes 17 ticks (masks on 1, 3, 5, 7, 9, 11, 13, 15, 17), **283 ms** to
cross a 10-wide board. Contract §2.3's parenthetical "≤ 9 ticks (150 ms)" is a derivation gloss
written against a one-tick-per-step reading and should read ≤ 17 ticks (283 ms);
`STACKED_MAX_MOVE_STEPS_PER_TICK = 1` and `STACKED_MOVE_QUEUE_MAX = 9` are unaffected and are not
re-opened here. The queue is what makes a full-width traverse a *latency* cost rather than a *dropped
input* cost.

Simultaneous bits on one tick are resolved by contract §2.3's precedence table (`lastHorizontal`
latch; `rotateCCW` > `rotateCW` > `rotate180`; `hold` before `hardDrop`; `hardDrop` over
`softDrop`). The input layer does not pre-resolve them.

### 6.2 Commit rule (the determinism contract)

1. The classifier pushes resolved intents into an ordered pending queue storing **order only** — no
   timestamps beyond arrival sequence.
2. The queue is drained by **the first fixed step that actually runs**, not by the rAF callback. On a
   120 Hz display running a 60 Hz sim, roughly half of all rAF callbacks execute zero steps, and
   frame-level draining would discard every input arriving during those frames. Chikun does it
   correctly — `flapQueued` is cleared inside the step loop and survives a zero-step frame
   (`apps/chikun/src/main.mjs:78-80, 344-347`).
3. A queued intent survives at most `STACKED_INPUT_BUFFER_TICKS = 4` consecutive zero-step frames,
   mirroring Chikun's `flapBufferFrames = 2` with a larger bound. Zero-step frames between steps is
   `ceil(refreshHz/60) - 1` — 1 at 120 Hz, 2 at 144 Hz, 4 at 300 Hz.
4. A frame running N catch-up steps builds N masks (§6.1). The multiplication trap that would
   quadruple a hard drop is closed twice: per-tick masks set the edge bit in only one of them, and
   in-sim edge detection fires once even if an identical mask reaches four steps.
   `MAX_CATCH_UP_STEPS = 4` in `apps/hmh-reboot/src/simulation.mjs` is the ceiling precedent; HMH's
   own convention of one frozen `input` object reused across catch-up steps is **not** adopted.
5. The step consumes its whole mask before applying that tick's gravity, in the frozen within-tick
   order (contract §2.3: hold → rotate → shift → hardDrop → gravity/softDrop → lock timer → lock →
   line clears → pending garbage → spawn).
6. Queue overflow — more than `STACKED_MOVE_QUEUE_MAX = 9` banked move steps, or a 4th concurrent
   pointer — is **dropped, not deferred**, and counted into `runStats.droppedInputs` (contract §4.5).
7. **The classifier is outside the simulation.** Pixel thresholds, velocities, axis lock, coalesced
   samples, DAS expansion and gamepad Schmitt triggers all live in `touch-gestures.mjs` /
   `input-intents.mjs` / `gamepad.mjs`, never inside a step callback.
8. **The evidence records no device identity.** `tests/stacked-input-device-parity.test.mjs` proves
   it: the same intent list built from synthetic keyboard, pointer and gamepad events must produce
   byte-identical masks and run results.
9. Haptics (§12) and the VFX layer consume the frame's mask history **and** the frame's simulation
   event list, both from the render layer, never inside a step — so a device with no vibrator
   produces the same run.

### 6.3 DAS / ARR / DCD — counted in ticks, not milliseconds

They translate a *held direction* into discrete move steps, and are a property of held-button inputs
only.

| Source | DAS/ARR | Rationale |
|---|---|---|
| Keyboard | Yes | Held key is the canonical case. |
| Gamepad d-pad / stick | Yes | Same held-button semantics. |
| Pad scheme left/right | Yes | Literally a held button. |
| Touch gesture drag | **No** | Drag distance *is* the repeat mechanism; there is no held-direction state to expand, and layering DAS on a drag would double-move. |

`moveStepPx` is touch's analogue of ARR. **There is no touch analogue of DAS**, and wall-charge is
not emulated on touch. This is the derivation contract §2.3 cites when rejecting integrity's
level-triggered move bits.

**Auto-shift is expanded in ticks, evaluated once per fixed step, never per rAF callback.** A
ms-counted expansion driven off the frame loop emits a different number of steps on a 120 Hz phone
than on a 45 Hz one — a device-dependent input stream. Settings are stored in ms for the UI and
converted once at run start:

- `dasTicks = clamp(round(dasMs / (1000/60)), 4, 18)` — default 133 ms → **8 ticks**; 60–300 ms →
  4–18 ticks.
- `arrTicks = clamp(round(arrMs / (1000/60)), 1, 6)` — default 33 ms → **2 ticks**; 17–100 ms →
  1–6 ticks.
- `dcdTicks` default **0**, range `0..8`, stored in ticks (the ms form is rejected by contract §2.3).
  On a held-direction change the controller sets remaining charge to `min(dasTicks, dcdTicks)`.

The UI displays the snapped value (8 ticks reads back as 133 ms). A 0 ms ARR is not offered because 1
tick is already the floor. `arrTicks = 1` still yields one column per **two** ticks after edge
expansion (§6.1), so the range's practical span is one column per 2 ticks to one per 6.

**Auto-shift stops at the wall** (frozen rule, contract §2.3). Once the sim reports the piece cannot
move further in the held direction, `createAutoShift` stops emitting and re-arms on the next spawn,
rotation or direction change. Without it, holding against the wall emits up to 30 dead transitions
per second — an evidence-size problem and a plausibility-gate false positive.

**DAS/ARR/DCD are not replayed, because the recorded stream is post-expansion.** `createAutoShift`
expands a held direction into plain move bits *before* the mask is built, so a run recorded at 1-tick
ARR and one at 6-tick ARR are both mask streams and both verify identically on a verifier running
defaults. They are player-configurable in Free and Ranked alike and travel in `summary.handling` as
metadata (§13). They are frozen for a run's duration: `InputState.setKeyboardBindings`
(`apps/hmh-reboot/src/input.mjs:117`) and `rebindKeyboardAction`
(`apps/hmh-reboot/src/action-map.mjs:55-56`) already throw
`'keyboard bindings are locked during an active ranked run'` when `rankedActive`; STACKED applies the
same lock to `dasMs`, `arrMs`, `dcdTicks`, `touchScheme`, `touchSensitivity` and `hudScale`.

### 6.4 Latency budget

Target: **touch-down to corresponding pixel, 65 ms at p95** on the reference device (§7.1).

| Stage | p95 (ms) | Notes |
|---|---|---|
| Digitizer sample + OS/browser dispatch | 16 | Not ours. Coalesced samples recover intermediate positions but not this. |
| pointerdown to classifier decision | **0** | No gesture uses a delay timer: move and soft drop act on threshold crossing, rotate resolves on pointerup, the pair tap on the first lift. This is why there is no double-tap gesture anywhere in the scheme. |
| Classifier to intent queue | 0.2 | Same task, synchronous push. |
| Queue to the first fixed step that runs | 15.9 | 0–16.7 uniform. Drained inside the step loop, so an event arriving during the previous frame's paint lands on this frame's step. |
| Step to draw | 0 | Same frame; the work is inside §7.2's 16.67 ms budget. |
| Draw to vsync present | 16.7 | |
| Compositor + display | 8 | |
| **p95 total** | **56.8** | 8.2 ms of headroom against the 65 ms target. |

The total sums per-stage p95s, which is pessimistic (for independent stages the p95 of the sum is
strictly below the sum of the p95s); only the queue-to-step wait has real variance. Budget against
56.8 anyway. The figure covers the *first* action of a gesture; the nth banked move step lands
`2(n−1)` ticks later by §6.1 — a throughput cost, not a latency one.

Listeners are registered `{ passive: false }` and `preventDefault()` on the gesture surface and on
the window-level pointer/touch handlers that mirror it.

### 6.5 Transition volume this section is responsible for

The `SIC1` codec, its header, recorder invariants, chunking and the plausibility gate belong to
`integrity.md` and contract §2.3. This section owes them the **transition rate touch and held-button
input produce**, which sizes stored replays.

A transition is a mask change; recorder invariant 1 permits **at most one record per tick**, so the
structural ceiling is 60 transitions/s for every input device. An earlier draft's "45 actions/s
averaged over any 10-second window" plausibility bound is **dropped** — a sustained maximal drag
legitimately produces one transition per tick. Invariant 1 is the bound.

Per-piece transition counts, post-expansion (set + clear per edge bit):

| Case | move | rotate | hardDrop | hold | softDrop | total |
|---|---|---|---|---|---|---|
| Typical | 4 × 2 = 8 | 1.2 × 2 = 2.4 | 2 | 0.3 × 2 = 0.6 | 0.5 × 2 = 1 | **~14** |
| Heavy-drag elite | 9 × 2 = 18 | 2 × 2 = 4 | 2 | 0.3 × 2 = 0.6 | 2 | **~27** |

Contract §2.3's planning figure of ~20/piece sits between them: a 40-minute god-tier run of ~6,000
pieces × 20 = **120,000 transitions ≈ 132,000 B ≈ 176,000 base64url chars**, against
`STACKED_MAX_STORED_REPLAY_CHARS = 240_000`. The hard ceilings —
`STACKED_MAX_INPUT_TRANSITIONS = 432_000` (= `STACKED_MAX_TICKS`),
`STACKED_MAX_EVIDENCE_BYTES = 1_302_000`, `STACKED_EVIDENCE_CHUNK_RAW_BYTES = 42_000`,
`STACKED_MAX_EVIDENCE_CHUNKS = 33` — are unreachable in legal play by invariant 1, so no touch
behaviour can drive a run into `terminalReason: 'evidence-ceiling'`.

---

## 7. Quality tier and mobile render budget

Tier selection, the tier table and the module home are frozen in contract §2.6:
`apps/stacked/src/render/quality-tier.mjs` exporting `STACKED_QUALITY_TIERS` and
`selectStackedQualityTier`. **Three tiers — `desktopHigh`, `desktopLow`, `mobile` — and reduced
motion is a modifier (`reducedMotion: boolean`), never a fourth tier.** Ladder: explicit
`stackedQuality` override; `coarsePointer === true && width <= 820` → `mobile` (**both**);
`coarsePointer === true` → `desktopLow`; `hardwareConcurrency <= 4 || deviceMemory <= 4` →
`desktopLow` (`undefined` is "not low"); otherwise `desktopHigh`.

`selectRuntimePerformanceProfile` (`apps/hmh-reboot/src/runtime-performance.mjs:53-64`) is the
*shape* precedent only — reduced-motion first, then `width <= 700 || coarsePointer`, profiles named
`desktop`/`mobile`/`reducedMotion`, `resolution = Math.min(resolutionCap, devicePixelRatio)`. STACKED
copies neither its predicate nor its vocabulary; an earlier draft of this section did, and lost.

Frozen tier table (contract §2.6):

| Field | `desktopHigh` | `desktopLow` | `mobile` |
|---|---|---|---|
| `particleCapacity` | 6_000 | 2_600 | **1_200** |
| `resolutionCap` | 2 | 1.5 | **1.25** |
| `maxPixelArea` | 4_000_000 | 1_600_000 | **1_600_000** |
| `bloomCap` (absolute `layerPost` alpha) | 0.35 | 0.22 | **0** |
| `antialias` | true | false | **false** |

`resolutionCap` 1.25 and `antialias: false` on mobile are identical to
`RUNTIME_PERFORMANCE_PROFILES` (`runtime-performance.mjs:35`), so the two cabinets do not disagree
about what a phone can afford. The 1,600,000-pixel budget is not invented: `combatCanvasRenderScale`
(`apps/portal/src/device-model.mjs:205-215`) already defaults `maxPixelArea` to `1_600_000` and
derives scale as `sqrt(maxPixelArea / (width * height))`.

**Mobile-tier render budget** — the ceilings §7.2 depends on. `visuals.md` owns per-event particle
presets and zone tables.

| Field | mobile | with `reducedMotion` |
|---|---|---|
| steady-state live particles | ≤ 260 | 0 |
| `bloomDownsample` | 4 | — (bloom off) |
| `backgroundLayers` | 2 | 1 |
| `backgroundUpdateHz` | 30 | 0 (static) |
| `audioReactiveBands` | 4 | 0 |
| `pieceTrailFrames` | 3 | 0 |
| `ghostPieceStyle` | `'outline'` | `'outline'` |
| `screenShakeMaxPx` | 4 | 0 |
| `maxDrawCalls` (asserted) | **40** | 24 |

`desktopHigh` asserts `maxDrawCalls` 90. `desktopLow` is not separately budgeted here; the gate
measures only the two smoke viewports (§7.3).

**Steady-state 260 live particles, derived — and why the pool is 1,200.** The mobile backbuffer at
390 × 844 and resolution 1.25 is 487.5 × 1055 = 514,313 device px. Additive particles are budgeted at
half a backbuffer of fill per frame — 257,000 device px. A mean particle quad of 24 CSS px is 30
device px on a side, 900 px². 257,000 / 900 = 285; round down to 260 for headroom against the
background and bloom passes. Demand check: 10 particles per cleared line × 4 lines = 40 per HALVING,
one clear per second, ~900 ms life ⇒ ~40 live in normal play. The frozen `particleCapacity: 1_200` is
a **pool size**, sized in contract §2.6 as an adversarial concurrency ceiling of ~230 padded ~5× for
governor headroom; it is never reallocated, and the ladder moves only the alive ceiling. 260 is the
fill steady state, 1,200 is the allocation.

**`maxDrawCalls = 40`, derived.** Steady-state baseline: background layers 2, board field batch 2,
ghost 1, active piece 1, spawn band 1, hold panel 1, next queue 1, HUD text 4, callout sprites 2,
particle container 1, energy-target draw 1, bloom passes 3, composite 1, frame chrome 2 = **23**. 40
is ~1.7×, the budget for callouts and zone transitions stacking. The `reducedMotion` figure of 24
drops the particle container (−1), the energy-target draw (−1), three bloom passes and their
composite (−4) and one background layer (−1), adding back the static additive halo sprite that
replaces bloom (+1): 23 − 7 + 1 = **17**, so 24 is ~1.4× — tighter, because reduced motion also
removes the transient callouts the 1.7× exists for.

**Post-processing.** Mobile keeps bloom, but only as a quarter-resolution Kawase pass over a
dedicated *energy* render target holding glowing minos, clear flashes and the audio-reactive
background rim — not the whole scene. Fill at `bloomDownsample: 4`: energy RT is 514,313/16 =
32,144 px; drawing energy sprites into it ~32k, three Kawase passes 96k, composite over the full
backbuffer 514k ⇒ **~642k px of extra fill**. Full-scene bloom needs the scene rendered to a
full-resolution RT first (514k) before the same chain ⇒ **~1,160k px**, plus one extra
full-resolution pass and its bandwidth. §7.2's 1.60 ms budget assumes a pessimistic ~400 Mpx/s on the
reference class and must be confirmed by the on-device pass, not asserted. Under `reducedMotion`
bloom is off entirely, replaced by a static additive halo sprite.

**Resolution / DPR clamping.** Two clamps, in order:

```js
resolution = Math.min(tier.resolutionCap, devicePixelRatio);
if (cssW * cssH * resolution ** 2 > tier.maxPixelArea) {
  resolution = Math.sqrt(tier.maxPixelArea / (cssW * cssH));
}
resolution = Math.max(1, resolution);
```

**This chain's output is `snapResolution`** (§2): evaluated once at run start against the run-start
CSS viewport, frozen, re-evaluated only on a relayout.

Where each clamp bites:

- 390 × 844 at dpr 3, mobile: first clamp gives 1.25, backbuffer 514k px, well inside 1.6 M — the
  area ceiling does not fire.
- The mobile area ceiling fires above `1_600_000 / 1.25² = 1,024,000` CSS px. A 1180 × 820 tablet is
  967,600 and stays under; a 1366 × 1024 iPad Pro is 1,398,784 and clamps to
  `sqrt(1.6M/1.399M) = 1.07`.
- The `Math.max(1, …)` floor wins over the ceiling on very large desktop windows (a maximised 4K
  window cannot meet 4 Mpx at resolution 1). Deliberate: rendering below 1 CSS px per device px is
  worse than the frame cost, and §10 covers the residue. The floor never conflicts on a phone, where
  resolution 1 is 329k px.
- A single 1.6 Mpx ceiling on `desktopHigh` would clamp a 1440 × 900 window at dpr 2 to 1.11 and
  defeat `resolutionCap: 2` on every display anyone owns; hence 4,000,000, which holds resolution 2
  up to a ~1 Mpx window and tapers above it (1920 × 1080 gets 1.39). `desktopLow` takes the tighter
  1.6 M budget because it *is* the weak-GPU tier.

### 7.1 Reference device class that must hold 60 fps

**iPhone 11 / A13 (2019)** and **Pixel 6a / Snapdragon 7-class (2022)**, at 390 × 844 CSS, dpr 3,
portrait, gesture scheme, on a warm device after 10 minutes of play. Below that class the thermal
ladder (§10) takes over; nothing is blocked.

390 × 844 at dpr 3 is the same synthetic viewport the HMH smoke uses —
`scripts/hmh-reboot-performance-browser-smoke.mjs:145` measures `{ width: 390, height: 844 }` with
`deviceScaleFactor: 3, isMobile: true, hasTouch: isMobile` — so the STACKED copy is a 1:1 port.
`scripts/hmh-reboot-mobile-controls-browser-smoke.mjs` is the second precedent: it drives real touch
through CDP `Input.dispatchTouchEvent`, delivers `pointermove` to the window only, and forces a
visual viewport shorter than the layout viewport, because an earlier version of that harness passed
with both of its fixes reverted.

### 7.2 Frame budget, mobile tier, 60 fps = 16.67 ms

| Stage | Budget (ms) |
|---|---|
| Intent queue drain + gesture classification + mask build | 0.40 |
| Fixed-step simulation, 1 step typical (1.40 at the 4-step ceiling) | 0.35 |
| Board diff to sprite sync (dirty cells only, never a full 200-cell rebuild) | 0.90 |
| Particle update, ≤ 260 live | 0.35 |
| Background layer update (1.2 ms at 30 Hz, amortised) | 0.60 |
| Audio-band read + projection mapping (0.30 ms at 30 Hz, amortised) | 0.15 |
| HUD / text update (2.0 ms at 10 Hz, amortised) | 0.33 |
| Pixi render, ≤ 40 draw calls | 6.50 |
| Bloom pass (quarter-res, energy target only) | 1.60 |
| Subtotal | **11.18** |
| GC, scheduler jitter, and the extra 1.05 ms of a 4-step catch-up frame | 5.49 |
| **Total** | **16.67** |

Amortised rows are `cost × rate / 60`: background 1.2 × 30/60 = 0.60, HUD text 2.0 × 10/60 = 0.33,
audio 0.30 × 30/60 = 0.15. A 4-step catch-up frame spends 1.40 rather than 0.35 on simulation and
still leaves 4.44 ms of headroom.

Two rules, not estimates:

- **Sprite sync is diff-based.** The board is 200 visible cells; re-uploading all of them is 200
  transform writes for typically fewer than 8 changed cells. Maintain a dirty-cell set from the sim's
  per-tick change list.
- **HUD text is throttled to 10 Hz.** Text layout is the most expensive per-frame Pixi operation at
  this scale. Combo and line-clear callouts are sprites, not text, so they are exempt.

### 7.3 What the automated gate asserts

`scripts/stacked-performance-browser-smoke.mjs`, a port of the HMH smoke, keeps that script's
assertions — p95 frame ≤ 34 ms (line 115), p99 ≤ 70 ms (line 116), ≥ 170 measured frames (line 114),
retained heap growth < `HEAP_GROWTH_MAX_BYTES` = 16 MB (line 12) under forced GC via
`--js-flags=--expose-gc` (line 26) and `scripts/lib/heap-sampler.mjs`, at most 2 long tasks over
100 ms across boot plus window (lines 119–123), and `assert.deepEqual(errors, [])` for page and
console errors — and adds STACKED caps:

- `dataset.renderResolution <= 1.25` on the mobile viewport;
- `dataset.qualityProfile === 'mobile'` on the mobile viewport, one of
  `'desktopHigh'`/`'desktopLow'` on the desktop viewport;
- `dataset.reducedMotion === 'false'` (a separate boolean key, never a tier value);
- `dataset.particlePoolSize === '1200'` and `0 < dataset.renderedParticles <= 1200`, the lower bound
  so the budget is exercised;
- draw calls ≤ 40.

The frozen telemetry dataset keys on `#stackedStage`, gated behind `telemetry=1` (contract §2.6):
`qualityProfile`, `reducedMotion`, `renderResolution`, `renderedParticles`, `particlePoolSize`,
`simulationTick`, `runScore`, `garbageRowsInserted`, `runRestarts`, `longestRunTicks`, `assetsReady`.
`gates.md`'s browser smoke asserts the losing `desktop`/`mobile`/`reducedMotion` vocabulary and must
be rewritten.

Port details that are easy to get wrong and visible in the source:

- Playwright imports from the vendored path
  `../benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs` (line 3), not a bare
  specifier.
- The HMH smoke asserts bundle size against `BUNDLE_MAX_BYTES = 1_050_000` (line 8). The STACKED copy
  calls `assertStackedJsBudget` on `apps/portal/dist/stacked/game.js`, which **hard-fails with
  `Error('STACKED_ENTRY_JS_CAP has no measured baseline yet')`** until S-11 sets the cap
  (contract §2.7).
- Origin comes from `HMH_REBOOT_ORIGIN` defaulting to `http://127.0.0.1:8791` (line 6), what
  `npm run serve` binds. The STACKED copy uses `STACKED_ORIGIN` with the same default.
- The HMH perf smoke hard-codes the Windows Chrome path with **no** override, while
  `scripts/hmh-reboot-visual-regression.mjs` honours `HMH_REBOOT_BROWSER_EXECUTABLE` and
  `scripts/hmh-reboot-mobile-controls-browser-smoke.mjs` honours `HMH_CHROME_PATH`. The STACKED copy
  honours `STACKED_BROWSER_EXECUTABLE` and falls back to the same hard-coded path.

34 ms p95 is what a headless browser under Playwright on a desktop can assert *reliably*, not a
60 fps proof. §7.2's 16.67 ms budget is an on-device target, verified by a manual device pass on the
reference hardware and recorded in the cycle's certification notes. Do not present the harness number
as evidence of 60 fps on a phone.

---

## 8. Orientation change mid-run

Orientation is projection. The simulation never sees it and is **never paused for it** — pausing on
rotation would hand a player a free stall in a Ranked run.

On `orientationchange`, `window resize`, or `visualViewport resize`/`scroll`:

1. Re-run `selectStackedLayoutMode` (with hysteresis, §1) and `solveStackedCellLayout`; compare to the
   current result.
2. **If the mode is unchanged and the cell moved by less than 0.5 px, this is a no-op relayout:
   reposition and stop.** Steps 3–6 do not run. `visualViewport scroll` fires when browser chrome
   collapses, which ordinary touches provoke; running the full sequence would cancel the player's
   pointer several times a minute.
3. **Cancel every active pointer immediately** and clear bit 2 if soft drop was engaged. A mid-drag
   rotation whose pointer stayed alive would resolve as a phantom flick against the new coordinate
   system.
4. Rebuild board sprites from board state at the new cell size and re-feed `layoutMatch` (§0.1).
   Nothing interpolates across a relayout; a piece mid-fall snaps to its exact sub-row position.
5. **Swallow new `pointerdown` on the gesture surface for 400 ms** (`postRelayoutSwallowMs`).
   Re-gripping a rotating phone produces palm and thumb contacts that would resolve as rotate taps.
   The swallow covers the gesture surface only: **control rects stay live**, because a player who has
   just rotated into a layout they dislike must still be able to hit Pause. Pad-scheme buttons are
   controls, so pad is not swallowed at all.
6. Emit a run event so the results screen can explain the discontinuity. `game:run-event`'s payload
   is exact-keyed `['tick','sequence','eventType','value']` with numeric `value` and `eventType`
   matching `/^[a-z0-9][a-z0-9-]{1,63}$/` (contract §4.1), so the encoding is
   `eventType: 'layout-portrait' | 'layout-landscape'` and `value: round(cell * 100)`. Mode and cell
   both survive; no protocol widening needed.

`createTouchControlAdapter` already registers `resize`, `orientationchange` and both `visualViewport`
`resize` and `scroll` (`apps/hmh-reboot/src/touch-controls.mjs:316-318`); STACKED registers the same
four and adds the change test, the pointer cancel and the swallow window.

**`moveStepPx` changes with the cell**, so a relayout that changes the cell changes touch sensitivity
mid-run. Unavoidable — the alternative is a piece-to-thumb ratio that varies by device — and handled
by recording the change (step 6) and surfacing it on the results screen. It is part of what owner
gate G-19 decides.

**A relayout stall does not fast-forward the simulation.** The runtime clamps its frame delta the way
`DeterministicSimulation.update` does (`apps/hmh-reboot/src/simulation.mjs`: `maxFrameDeltaMs`, then
an accumulator ceiling of `STACKED_MAX_CATCH_UP_STEPS × fixedStepMs`), so a 300 ms hitch drops
simulation time rather than burning four catch-up steps of gameplay the player could not see. Because
the ranked metric is `survivalTicks / 60`, dropped time costs the player ticks; there is no exploit
in provoking one.

**Run end during any projection transition** needs no ordering rule. The results snapshot is taken
from simulation state, which relayout, zone transitions and the audio-reactive layer never touch. A
top-out on the same frame as a rotation, or on the frame a zone crossfade begins, finalizes
identically whichever runs first. The projection transition is torn down without being allowed to
finish — a crossfade in flight is cut, not awaited — because waiting would make the recorded end tick
and the observed end time disagree.

**No orientation lock.** STACKED never calls `screen.orientation.lock()`: it requires fullscreen, is
unimplemented on iOS Safari, and would be a promise rejection on the common path for a problem
already solved by supporting both orientations.

If the post-rotation cell would fall below the floor — 568 × 320 gives `Hu/21.5 = 13.77` — play
continues at the floored cell with the **headroom band clipped at `safe.top`** and the playfield
intact, per §2's bottom anchor. At 568 × 320 (dpr 2, mobile tier, `snapResolution` 1.25, floor 14.4)
the 20 playfield rows need 288 px against 296 px of `Hu`, so the playfield fits with 8 px to spare and
**13.6 of the headroom band's 21.6 px are clipped**, leaving an 8 px band. At `Hu <= 288` the band
vanishes and the top-out line is drawn as a 2 px rule on the board's top edge.

**The floor yields before the playfield does.** If `Hu` cannot fit `20 * minCellPx'`, the floor loses:
`cell = snapDown(min(Hu/20, widthBoundCell))`, ignoring the floor, because "the 20 playfield rows are
never clipped" is absolute and the floor is a legibility preference. Below `Hu = 280` (20 rows at the
unsnapped 14 px floor) the cabinet stops solving and shows a blocking "viewport too small" panel with
the required height. No device in the reference matrix reaches it — the shortest, 568 × 320, has `Hu`
296 — so this is a guard, not a layout. A non-blocking "rotate back for a bigger board" hint shows
for 4 seconds and never blocks play, the same posture `buildDeviceProfile` takes at
`apps/portal/src/device-model.mjs:56` with `suggestLandscape`.

---

## 9. Backgrounding, interruption, and the no-restart rule

The case to design against: a phone call arrives at minute 28 of a 34-minute Ranked run.

**On `visibilitychange` to hidden:**

1. Pause the simulation immediately. No ticks accrue while hidden.
2. Cancel all pointers, clear the intent queue, and write a mask-`0` record at the current tick.
   Recorder invariant 3 (contract §2.3) requires a synthesised release on pause, `blur` and
   `visibilitychange` to hidden, or a key held across a pause keeps charging DAS on resume and the
   replay diverges from what the player saw.
3. Record `suspendStartedAt` (wall clock, metadata only; it never touches the sim).

The child does **not** send `game:pause`. Contract §4.1 enumerates child → parent as `game:ready`,
`game:state`, `game:evidence-chunk`, `game:result`, `game:error` (plus `game:run-event`), and the
iframe shares the top-level document's visibility state, so the parent observes the same
`visibilitychange` and sends `portal:pause`. The child self-pauses on its own listener with no
ordering dependency on that message. `portal:pause` carries
`{ source: 'portal' | 'system' | 'visibility' | 'user' }` — the enum `validateGamePause` already
accepts (`sdk/hmh-bridge-protocol.mjs:182`), a superset of the three at
`apps/portal/src/chikun-bridge-protocol.mjs:170` — so the parent needs no new vocabulary.

Precedent: HMH's `handleVisibilityChange` calls `pauseRuntime('visibility')` when
`document.visibilityState === 'hidden'` (`apps/hmh-reboot/src/main.mjs`); Chikun's listener calls
`togglePause('visibility', true)` on hidden and, on returning to visible, sets
`accumulator = 0; previousFrameAt = performance.now()` (`apps/chikun/src/main.mjs:447-448`).
`createTouchControlAdapter` registers its pointer-cancelling `visibilitychange` handler on the
**document** and its `blur` handler on the **window**; STACKED uses the same pair on the same
targets.

**On return to visible:**

1. **Do not auto-resume.** Show a resume gate with a 3-2-1 countdown. Auto-resuming drops the player
   into a falling piece they have not seen, on a board they have not re-read.
2. Before the first frame after the countdown, zero the step accumulator and reset the frame
   timestamp — the Chikun pattern. Without it the accumulator absorbs the hidden interval and the sim
   burns its 4 catch-up steps on the first frame back.
3. Add the suspended interval to `suspendedMs`; increment `suspendCount`.
4. Re-run the §8 relayout test. A bfcache restore or a rotation while hidden can come back at a
   different size.
5. Swallow gesture-surface `pointerdown` for `postRelayoutSwallowMs` after the countdown ends, on §8
   step 5's terms — the tap that dismisses a notification lands on the game.

**States the countdown must survive:**

- **Hidden again during the countdown.** The gate re-arms from 3, not from where it was, and the
  interval is added to `suspendedMs`. The sim never started, so nothing rewinds.
- **A relayout during the countdown.** Solve it (§8 steps 1–4 and 6) but do not restart the
  countdown; the board the player is re-reading is the one they will play.
- **Counting down is not playing.** The countdown accrues `suspendedMs` and no ticks, so it cannot be
  used to study the board beyond its own 3 seconds.
- **The suspend limit crossing mid-countdown.** Evaluate `RANKED_SUSPEND_LIMIT_MS` once, when the
  return-to-visible is detected, before the gate is shown. A run over budget is finalized then and
  never shows a countdown it would immediately invalidate.

**Interaction with the no-restart rule.** An interruption is not a restart. Session, seed and mask
stream are untouched; the run resumes at the exact tick it stopped:

> A Ranked run may be **suspended** indefinitely; it may never be **rewound**.

- `suspendCount` and `suspendedMs` travel as `runStats.pauseCount` and `runStats.pausedWallClockMs`
  (contract §4.5), shown on the results screen and the leaderboard detail row. They do not affect
  score.
- Survival time is `survivalTicks / 60`, never a wall clock, so backgrounded time cannot inflate or
  deflate the ranked metric — which also removes any incentive to background deliberately.
- **The user pause button is available in Ranked** and draws from the same budget. A deliberate pause
  is exactly as much of a board-integrity hole as a backgrounded tab; leaving one unmetered just
  moves the exploit. It sends `source: 'user'`, resumes through the same 3-2-1 gate, and accumulates
  into the same `suspendedMs`. (Owner gate G-7 is the Ranked pause policy; this is the
  recommendation, and what §14 asserts.)
- **Hard limit: `RANKED_SUSPEND_LIMIT_MS = 15 * 60 * 1000`**, summed across every suspend of the run,
  whatever the source. A run exceeding it is terminated on the next return and finalized at the state
  it was suspended at — **submitted, not discarded**. An indefinitely parkable run is a
  board-integrity hole (park on a good board, come back with a plan or a second screen); silently
  discarding it would punish a player for a phone call. The results screen states why the run ended.
  The `terminalReason` written is the sim's own state at suspend, from the frozen five-value enum;
  suspend-limit termination is a **lifecycle** outcome in the run-history row, not a sixth terminal
  reason.
- Free mode has no suspend limit and records no suspend telemetry.

**Page kill.** If the tab is unloaded or the iframe destroyed, the run is lost. No mid-run persistence
in Phase 1: `apps/portal/src/persistence.mjs:44` does carry `activeSessionCheckpoint` in its
versioned snapshot allow-list, but nothing writes STACKED board state into it, and doing so would
create a save-scumming surface. Say this in the Ranked mode-select copy.

**iOS specifics.** A call or lock fires `visibilitychange` and frequently `pagehide` with
`persisted: true` (bfcache). Handle `pageshow` with `event.persisted === true` as a
return-from-hidden — run the resume gate, and re-read `visualViewport` and the safe-area insets.

**Audio on resume.** The arcade music `<audio id="arcadeMusicAudio" preload="metadata">` element lives
in the parent document (`apps/portal/index.html`), not the child, and the parent's
`ensureArcadeMusicPlayer` already `await`s `audio.play()` inside a `try`/`catch` and silently sets
`arcadeMusic.playing = false` on rejection. The child must not attempt to restart it. Audio-reactive
band values reach the child as plain numbers from the parent — a child iframe cannot build a Web
Audio graph over an element it does not own, and no `AnalyserNode` exists anywhere in the portal
today, so this is new parent-side surface (`visuals.md` owns it). Because the bands arrive as numbers
on the projection path they are structurally incapable of reaching the sim. The visual layer must
render correctly at zero band energy: a silent resume has to look intentional, not broken.

---

## 10. Battery and thermal degradation

No Battery Status API: deprecated, permission-gated where it exists, absent on iOS. Degrade on
**measured frame time** instead.

`createThermalGovernor({ tier })` keeps a rolling window of the last 180 frames (3 s at 60 fps) and
tracks two metrics, because one cannot do both jobs:

- **Step down** when the window's p95 *rAF delta* exceeds 20 ms for 3 consecutive windows (9 s). The
  delta is the symptom the player feels.
- **Step up** when the window's p95 *measured frame work* — `performance.now()` at frame end minus at
  frame start — is below 11 ms for 6 consecutive windows (18 s). Frame work is the only metric
  comparable across rungs; a delta-based promotion test reads "fine" the instant it steps down and
  oscillates forever.

Asymmetric on purpose: fast to protect the frame rate, slow to restore.

The rungs are the frozen frame-budget guard levels of contract §2.6. This document owns the
**driver**, not the ladder; the mobile-tier additions only remove work.

| Level | Frozen rung (contract §2.6) | Mobile-tier additions |
|---|---|---|
| L0 | full tier | — |
| L1 | alive ceiling × 0.60; bloom 2 passes → 1 | `backgroundUpdateHz` 30 → 15 |
| L2 | × 0.35; bloom off; backdrop shader → static gradient | `pieceTrailFrames` → 0 |
| L3 | × 0.15; board glow off; shake × 0.5; parallax → 1 layer; **announced** with a `PERF` pip in the HUD | `audioReactiveBands` 4 → 2 |

Hard rules:

- Every rung is projection-only. The fixed step never changes; the ladder cannot touch the intent
  stream, the mask, or the pools (only the alive ceiling moves).
- **The governor never changes `renderResolution` at any rung.** An earlier draft floored resolution
  to 1.0 and halved the render rate to 30 Hz at L3; both are rejected. Holding `renderResolution`
  fixed is what makes the frozen `snapResolution` (§2) airtight — a step-down cannot change the cell,
  cannot change `moveStepPx`, cannot change touch sensitivity mid-run — and keeps
  `dataset.renderResolution` a stable smoke assertion. Board minos are additionally drawn from an
  atlas with a 1-device-pixel bleed on each edge, so seams never depend on the snap.
  `tests/stacked-thermal-governor.test.mjs` proves the claim by running N ticks forced to L0 and
  forced to L3 and asserting byte-identical run results and an identical solved cell.
- **Windows containing a discontinuity are discarded, not measured**: the first 120 frames after
  boot, any window containing a relayout (§8), any window containing a resume gate (§9). Otherwise a
  rotation hitch trips a step-down.
- L3 is announced. Silently degrading mid-run and letting the player conclude their phone is broken
  is worse than telling them.
- The highest rung reached is recorded once per run as a `perf-rung` run event (`value` = 0–3) and
  reported as `runStats.degradationLevel` (contract §4.5).
- `prefers-reduced-motion: reduce` sets the `reducedMotion` **modifier** at boot; the governor may
  never clear it. Reduced motion is a stated preference, not a performance state.

---

## 11. Gamepad and keyboard

Polled once per rAF with the same pattern as `apps/hmh-reboot/src/main.mjs`:
`[...(navigator.getGamepads?.() ?? [])].find(Boolean)`. No `gamepadconnected` listener is required;
polling handles connect and disconnect.

**Poll before the drain, not after.** The poll runs at the top of the rAF callback, ahead of the step
loop, so gamepad edges land on the same frame's first tick mask.

| Bit / intent | Buttons | Axes |
|---|---|---|
| `moveLeft` / `moveRight` (0 / 1) | D-pad 14 / 15 | Left stick axis 0, Schmitt trigger: fire above 0.5, re-arm below 0.35 |
| `softDrop` (2, level) | D-pad down 13 | Axis 1 above 0.5 |
| `hardDrop` (3) | D-pad up 12 | Axis 1 below −0.5 |
| `rotateCW` (4) | 0 (A / Cross), 5 (RB) | — |
| `rotateCCW` (5) | 1 (B / Circle), 4 (LB) | — |
| `rotate180` (6) | 3 (Y / Triangle) | — |
| `hold` (7) | 2 (X / Square), 6 and 7 (triggers) | — |
| `pause` (not a bit) | 9 (Start / Menu) | — |

- Pressed-ness uses the same tolerant test as `buttonPressed` (`apps/hmh-reboot/src/input.mjs:56`):
  `buttons?.[i]?.pressed === true || Number(buttons?.[i]?.value ?? 0) > 0.5`, so analogue triggers
  work.
- Bits 3–7 are edge bits: set for one tick, cleared the next (§6.1). Bit 2 is held. The Schmitt
  trigger (0.5 fire, 0.35 re-arm) stops a stick resting near the threshold from machine-gunning move
  edges.
- **No `gamepadDeadzone` setting.** HMH exposes one because `mapGamepadSnapshot`
  (`apps/hmh-reboot/src/input.mjs:60`) normalizes a continuous 2D vector with a default deadzone of
  0.2; STACKED consumes axes only as directional edges through a Schmitt trigger whose lower rail
  (0.35) already is the deadzone. A second adjustable threshold would just be a way to break the
  trigger.
- `moveLeft`/`moveRight` from d-pad or stick feed `createAutoShift`; DAS/ARR/DCD apply exactly as for
  keyboard (§6.3), in ticks, and stop at the wall.
- Gamepad works on a phone with a paired controller because polling is device-agnostic; STACKED
  simply does not draw a gamepad HUD on the mobile tier.
- **Gamepad vibration actuators are deferred past Phase 1.** Support is inconsistent across
  browser/controller pairs and needs a per-frame effect loop; §12 is `navigator.vibrate` only.

Desktop keyboard defaults — the source the gamepad and pad schemes mirror:

| Bindable control | Default |
|---|---|
| `moveLeft` / `moveRight` | `ArrowLeft` / `ArrowRight` |
| `rotateCW` | `ArrowUp` (alternate `KeyX`) |
| `rotateCCW` | `ControlLeft` (alternate `KeyZ`) |
| `rotate180` | `KeyA` |
| `softDrop` | `ArrowDown` |
| `hardDrop` | `Space` |
| `hold` | `ShiftLeft` (alternate `KeyC`) |
| `pause` | `Escape` |

Nine bindable controls, eight mask bits: `softDrop` is one held key driving the level bit, and
`pause` is bindable but is not a simulation action. Every default and alternate is inside
`ALLOWED_KEY_CODES` (`apps/hmh-reboot/src/action-map.mjs:31`: arrows, `Space`, `Escape`, `Tab`,
`Enter`, both Shift/Control/Alt, `KeyA`–`KeyZ`, `Digit0`–`Digit9`), so STACKED reuses that allow-list
verbatim. Rebinding follows `normalizeKeyboardBindings` (line 39) — allow-list membership, no
duplicate codes, fall back to the action's own default and then to the first unused allowed code
(line 48) — and is locked during an active Ranked run (line 56).

**How the alternates fit, since `normalizeKeyboardBindings` stores exactly one code per action.** The
alternates are **not bindable and not part of the binding record**: a frozen secondary table, live
for an action only while that action still holds its default primary code, dropped for the rest of
the session when that action is rebound. That confines the duplicate-code invariant to the nine
primaries — the only set `normalizeKeyboardBindings` reasons about — so a player who rebinds
`rotateCW` to `KeyX` does not end up with `KeyX` bound twice. The nine defaults (`ArrowLeft`,
`ArrowRight`, `ArrowUp`, `ControlLeft`, `KeyA`, `ArrowDown`, `Space`, `ShiftLeft`, `Escape`) are
mutually distinct, and so are the three alternates (`KeyX`, `KeyZ`, `KeyC`).

---

## 12. Haptics

`navigator.vibrate` only. Grepping `apps/` and `sdk/` for `navigator.vibrate` across `.mjs`, `.js`
and `.html` (excluding `dist/`) returns **zero matches** — new surface, so it gets its own module and
its own tests.

The manifest declares the `haptics` capability, and contract §3 pins the array as exactly
`["leaderboard", "achievements", "ranked", "audio", "haptics"]`. `CAPABILITIES`
(`apps/portal/src/game-manifest.mjs:35-41`) already contains `'haptics'`, annotated "requests vibration
on supported devices", so no validator change is needed — **and that is precisely the hazard**: a
manifest that omits `haptics` also validates, so the drift would be silent. Assert the pinned array.

**Feature detection is a single boot-time check.** If `typeof navigator.vibrate !== 'function'`,
`createHapticChannel` returns a frozen no-op object. iOS Safari has no `navigator.vibrate` and a
sandboxed iframe has no legal substitute; iOS gets no haptics. Do not fake it with a low-frequency
audio thump — worse than nothing, and it pollutes the audio-reactive analysis.

```js
export const STACKED_HAPTIC_PATTERNS = Object.freeze({
  lock:        8,
  hold:        10,
  hardDrop:    14,
  clearSingle: 12,                            // CONFIRM
  clearDouble: 18,                            // BATCH
  clearTriple: 24,                            // MERKLE
  clearQuad:   Object.freeze([28, 40, 28]),   // HALVING,  96 ms
  clearSpin:   Object.freeze([16, 30, 16]),   // FORK,     62 ms
  levelUp:     Object.freeze([10, 40, 10]),   //           60 ms
  zoneChange:  Object.freeze([10, 40, 10, 40, 10]), // EPOCH, 110 ms
  topOut:      Object.freeze([60, 60, 120]),  //          240 ms
});
```

The four-line-clear key is `clearQuad`, following the frozen technical root `quad` (contract §1.1);
the display name `HALVING` appears only in copy.

Deliberately absent: any haptic on a move bit, and any on hitting a wall. At 6–8 moves per second a
per-move buzz is a continuous drone that drains battery and desensitises the player to the patterns
that matter.

- **Projection-only.** Emitted from the frame's mask history and the frame's simulation event list,
  in the render layer, never inside a step callback, and never gating anything. A device with no
  vibrator produces an identical run and replay.
- **Rate limited to one `vibrate()` call per 80 ms** (at most 12/s). 80 rather than 50 ms so the
  stated call ceiling and window agree, and so the longest pattern (`topOut`, 240 ms) is not chopped
  by three successive calls. A call arriving inside the window *supersedes* the pending one rather
  than queueing; a queue would produce a buzz trail lagging the visuals.
- **A `false` return disables the channel for the rest of the run.** `navigator.vibrate` returns false
  when the engine refuses (no sticky activation, policy block, out-of-range pattern) and throws
  nothing. Without this a refusing device burns a call every 80 ms for 40 minutes.
- **Silenced while paused, suspended, or behind the resume gate** — whenever the simulation is not
  advancing.
- **On by default**, single `hapticsEnabled` boolean, hot-swappable mid-run.
- **Force-off** under `prefers-reduced-motion: reduce`, regardless of the setting. Vestibular and
  sensory sensitivities travel together often enough that this is the safe default; the player can
  re-enable explicitly.

---

## 13. Settings shape and manifest values

STACKED needs its own bridge protocol module: the HMH one pins `gameId === 'lester-blaster'`, and its
`validateSettings` optional-field allow-list (`sdk/hmh-bridge-protocol.mjs:51`) is closed, so
`touchScheme`, `dasMs`, `arrMs`, `dcdTicks`, `hapticsEnabled` and `showGhostPiece` would all be
rejected as unexpected fields. The payload rides `portal:init`'s `settings` block and
`portal:settings`, validated with the same `exactKeys`-plus-range-table technique. Corollary for the
parent: it must send **per-cabinet** settings payloads, not one union payload.

```js
// portal:settings payload -> settings
{
  // required booleans
  musicEnabled: boolean,
  reduceMotion: boolean,
  reduceFlash: boolean,
  hapticsEnabled: boolean,
  showGhostPiece: boolean,

  // optional, validated by range or enum
  touchScheme: 'gesture' | 'pad',   // default 'gesture'
  touchLeftHanded: boolean,          // default false
  touchScale: 0.75..1.5,             // default 1
  touchSensitivity: 0.5..2,          // default 1, scales moveStepPx inversely
  dasMs: 60..300,                    // default 133 -> dasTicks 8
  arrMs: 17..100,                    // default 33  -> arrTicks 2
  dcdTicks: 0..8,                    // default 0, stored in ticks
  hudScale: 0.8..1.3,                // default 1
  startLevel,                        // Free mode only; rides settings, never session
  keyboardBindings: { ...the 9 bindable controls of §11... },
}
```

`touchScale`, `touchSensitivity` and `hudScale` reuse the exact ranges the HMH validator enforces
(`sdk/hmh-bridge-protocol.mjs:63-65`: 0.75–1.5, 0.5–2, 0.8–1.3), so a shared parent settings UI needs
no per-cabinet range table for them. `startLevel` rides in `settings` and never in `session`, which
structurally prevents a Free-mode start level from reaching the derived seed (contract §4.1).

**Hot vs frozen during a Ranked run.** Anything not listed is frozen.

| Setting | Ranked mid-run | Why |
|---|---|---|
| `touchScheme` | frozen | Changes `bottomBand`, hence the cell, hence `moveStepPx`. |
| `dasMs`, `arrMs`, `dcdTicks` | frozen | Changes the step count of a held direction. |
| `keyboardBindings` | frozen | Throws, per `action-map.mjs:56`. |
| `touchSensitivity` | frozen | Directly scales `moveStepPx`. |
| `hudScale` | frozen | Changes `hudTop`, hence the cell, hence `moveStepPx`. |
| `touchScale` | **hot** | Button radii only, inside a fixed `padBandPx` (§5.5); cannot move the cell. |
| `touchLeftHanded` | **hot** | Mirrors control positions only. |
| `hapticsEnabled`, `showGhostPiece`, `reduceFlash`, `musicEnabled` | **hot** | Pure projection. |
| `reduceMotion` | **hot** | Sets the `reducedMotion` modifier; the governor may never clear it. It changes the *render* resolution but never re-snaps the cell — `snapResolution` is frozen at run start (§2) — so it cannot move `moveStepPx`. |

**Where the handling metadata travels.** The `SIC1` header is a fixed 24 bytes (contract §2.3) with
no metadata slots, so an earlier draft's claim that this data rides in the evidence header is wrong.

| Datum | Home |
|---|---|
| `dasTicks`, `arrTicks`, `dcdTicks`, `inputDevice` (`'keyboard' \| 'touch' \| 'gamepad' \| 'mixed'`) | `summary.handling` (contract §4.4) — metadata only, never hashed, never ranked, never fed to the verifier |
| `suspendCount`, `suspendedMs` | `runStats.pauseCount`, `runStats.pausedWallClockMs` (§4.5) |
| highest thermal rung | `runStats.degradationLevel` (§4.5) |
| quality tier, reduced-motion modifier, dropped inputs | `runStats.qualityTier`, `runStats.reducedMotion`, `runStats.droppedInputs` (§4.5) |
| `touchScheme`, `moveStepPx` and its relayout history, `cell`, `layoutMode`, `snapResolution`, `hapticsEnabled` | **Not transmitted in Phase 1.** Every payload is exact-key validated, so adding them means widening a frozen schema. Kept device-local for the results screen and run-history row; the `layout-portrait` / `layout-landscape` run events (§8) already carry the cell across the wire. |

Deliberately **not** a setting: the soft-drop multiplier. `SOFT_DROP_FACTOR = 20` is frozen for every
mode and device (contract §2.1). It is read inside `step()`, so a player-chosen value would have to
travel in the evidence header and be applied by the verifier.

Manifest values pinned in `apps/portal/games/stacked/game.manifest.json`:

- `aspectSupport: ["9:16", "16:9"]` — both hard-required by
  `REQUIRED_ASPECTS = Object.freeze(['9:16', '16:9'])` (`apps/portal/src/game-manifest.mjs:23`), and
  both genuinely implemented above.
- `controlScheme: "dpad-buttons"`. `CONTROL_SCHEMES` (line 25) is a frozen five-value list
  (`twin-stick`, `single-stick`, `tap`, `dpad-buttons`, `pointer`) with no gesture value.
  `dpad-buttons` is the honest closest match — the action vocabulary *is* directional steps plus
  discrete buttons, and the alternate scheme is literally a d-pad and buttons. Do not add a
  `'gesture'` value: that means editing the shared validator and its tests, and every other cabinet
  inherits the churn.
- `capabilities` is contract §3's pinned array: `["leaderboard", "achievements", "ranked", "audio",
  "haptics"]`, in that order, with `"haptics"` present because this section ships it. `rankedEligible: true` additionally requires `"ranked"` and `"leaderboard"`, which the
  validator checks. On `"audio"`: its comment at `game-manifest.mjs:39` reads "parent ducks arcade
  music", but no ducking implementation exists in the parent today — the capability is declarative.
  If ducking is ever built it must exempt STACKED, or the audio-reactive layer loses its signal.

---

## 14. Test and gate plan

Files already in contract §2.10's map:

| File | Asserts |
|---|---|
| `tests/stacked-layout.test.mjs` | Golden solved layouts for 390×844 dpr3, 360×800, 320×568, 428×926, 844×390, 568×320, 820×1180, 1180×820, 1440×900 dpr1. `14 <= cell <= 44`; `cell * snapResolution` is an integer on every one, with `snapResolution` from the resolved §7 clamp chain and **not** `resolutionCap` (1440×900 dpr1 separates them: cell 40 at `snapResolution` 1, not 40.5 at cap 2); **no control rect overlaps the board rect**; nothing inside the safe-area insets; the 20 playfield rows are never clipped; the branch chosen by pass 1 is never re-decided by pass 2; selecting `pad` moves the cell in portrait and not in landscape; `scale * CELL_PX === cell` for the slot handed to `layoutMatch`, and `x`/`y` are integers. **Plus hysteresis:** sweeping aspect up through 1.16 and back down through 0.862 produces exactly one transition each way, and no aspect in `[0.862, 1.16]` changes the mode from either prior state; a 700×700 viewport whose visual height swings 90 px either way never changes mode. |
| `tests/stacked-touch-gestures.test.mjs` | Every threshold in `STACKED_TOUCH_TUNING` gets a just-under and a just-over case from synthetic pointer-event arrays. Named cases: a diagonal flick must **not** set bit 3; a fast horizontal drag banks exactly N steps; an uncoalesced 200 px jump banks exactly 4; a flick within 140 ms of spawn is swallowed; a soft-drop engage within 140 ms of spawn is swallowed; a hard-drop pointer clears bit 2 in the same tick's mask and emits nothing afterwards; a tap after a banked column step is not a rotate; a pair tap whose second finger drags dissolves into one drag plus one live tap. **Plus the commit queue:** a zero-step frame does not drain the queue; the intent survives to the next stepping frame; it is discarded after 4 consecutive zero-step frames; a 10th banked move step is dropped and increments `droppedInputs`; two coalesced samples of 4 steps each bank 8 and drain over 15 ticks; a 4-step catch-up frame builds 4 distinct masks and fires each edge exactly once. |
| `tests/stacked-autoshift.test.mjs` | DAS/ARR/DCD expansion is deterministic and tick-counted; ms→tick conversion matches §6.3 (133→8, 33→2, clamped to 4..18 and 1..6); 1-tick and 6-tick ARR both produce plain move bits and verify identically against a defaults verifier; auto-shift stops at the wall and re-arms on spawn/rotation/direction change; no DAS path exists for gesture input. |
| `tests/stacked-input-device-parity.test.mjs` | The same intent list from synthetic keyboard, touch and gamepad sources produces a byte-identical mask stream, byte-identical `SIC1` bytes, and a byte-identical result tuple. **The section's load-bearing test.** |
| `tests/stacked-quality-tier.test.mjs` | The five-step ladder, including that `coarsePointer && width <= 820` is an `&&` (a 1024-wide touch laptop resolves to `desktopLow`, not `mobile`); the resolution clamp; the per-tier area ceiling (mobile bites at 1366×1024, not at 1180×820; `desktopHigh` bites at 1920×1080); the resolution floor of 1; `reducedMotion` is a boolean modifier, never a tier value. |

**Additions** to §2.10's map, which must be appended there and to `NODE_CHECK_FILES`:

| File | Asserts |
|---|---|
| `tests/stacked-thermal-governor.test.mjs` | Step-down on rAF delta (p95 > 20 ms for 3 windows), step-up on measured frame work (p95 < 11 ms for 6 windows), both hysteresis counts; windows containing boot, a relayout, or a resume are discarded; L0 and L3 produce identical run results; the solved cell and `renderResolution` are identical at L0 and L3; the governor never clears the `reducedMotion` modifier. |
| `tests/stacked-haptics.test.mjs` | No-op when `navigator.vibrate` is absent; a `false` return disables the channel; the rate limiter supersedes rather than queues at an 80 ms window; forced off under `reduceMotion`; silenced while paused; no pattern registered for a move bit. |
| `scripts/stacked-performance-browser-smoke.mjs` | §7.3, including the dataset-key assertions. Honours `STACKED_BROWSER_EXECUTABLE` and `STACKED_ORIGIN`. |
| `scripts/stacked-touch-browser-smoke.mjs` | Port of `hmh-reboot-mobile-controls-browser-smoke.mjs`: real touch via CDP `Input.dispatchTouchEvent`; `pointermove` delivered to the window only; a visual viewport deliberately shorter than the layout viewport, with every control and the board inside the visible region. |

The `test` script is `node --test tests/*.test.mjs tests/projectile-pool.test.mjs`, so anything
matching `tests/*.test.mjs` is picked up by `npm test` automatically; the source modules and the
`scripts/*` harnesses are not, and they are what silently escapes the gate if `NODE_CHECK_FILES` is
not edited.

---

> **Trademark note.** The block-stacking genre's best-known brand name is a registered trademark and
> appears nowhere in this document, in STACKED's assets, UI copy, or identifiers. The four-line clear
> is `quad` in every identifier and `HALVING` in display copy, per contract §1.1.
