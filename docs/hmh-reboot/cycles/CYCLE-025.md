# HMH AAA Continuous Improvement Cycle 025

Date: `2026-07-27`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`

## Scope

Three accepted items, in the order they arrived:

1. **Mobile controls** — verbatim: *"Controls on mobile need to be simplified to
   just movement, aim, and power (grenade, power-up, etc)… When I tried playing
   on my phone, the movement controls didn't even work."* A **P0 defect** plus a
   design change.
2. **Movement, combat, weapons, weapon upgrades, VFX** — the next request.
3. The **roster lighting retune** carried over from Cycle 024, which was sitting
   uncommitted in the working tree.

## Part 1 — the mobile P0

The movement stick was not mis-tuned, it was **unreachable and undriveable**,
for two independent reasons, either of which alone breaks it:

1. **The layout measured the wrong viewport.** `touch-controls.mjs` sized the
   overlay from `window.innerWidth/innerHeight` — the *layout* viewport, which
   on a phone includes the strip behind the URL bar. Controls anchored to its
   bottom were laid out below the visible area. It now measures
   `window.visualViewport` and relayouts on its `resize` and `scroll` events.
2. **Drag tracking was bound to the stick element.** A thumb dragged past the
   stick radius stopped delivering events wherever `setPointerCapture` is
   unavailable or dropped, so the stick registered a touch and then froze.
   Tracking now happens on the window surface.

### Simplified control set

Eight on-screen controls became four: **MOVE**, **AIM**, **POWER**, pause.

- POWER maps onto the existing `grenade` action through `ACTION_BY_CONTROL`.
  The `ACTIONS` vocabulary and the snapshot the simulation consumes are
  **unchanged** — a UI change, not an input-contract change.
- Removing the fire button is safe because autofire is already on
  (`main.mjs` `createAimState({ autoFireEnabled: true })`; `aim.mjs` resolves
  `fire: input.fire || (autoFireEnabled && target)`). Verified before removing
  the button.
- **Dash was going to be lost with its button.** It is a core movement mechanic
  with i-frames, and the HUD advertises "DASH READY" permanently. Rather than
  ship a HUD element a touch player cannot act on, **double-tapping the movement
  stick now dashes** — the standard mobile idiom, costing no screen space and
  adding no control.

### Pause placement — the part that needed the browser to settle

Pause was placed top-left, then left of the minimap. **Both were wrong, and the
browser harness is what proved it.** In portrait the top row is fully occupied:
`.hmh-reboot-status-card` owns the top-left, the minimap the top-right, and on a
short screen (iPhone SE, 375 × 667) they meet. A button there renders, passes
every geometric assertion, and is **still not touchable**.

Pause now sits in the gutter between the sticks, with a defensive clamp against
the minimap. `hud-layout.mjs` exports `MINIMAP_EDGE_GUTTER`,
`MINIMAP_OUTER_PADDING`, `MINIMAP_MAX_WIDTH`, `COMPACT_PORTRAIT_MINIMAP_WIDTH`,
`MINIMAP_WIDTH_FRACTION`, `minimapWidthFor()` and `minimapExclusionLeft()`, and
both the HUD and the touch layout consume them, so they cannot disagree.

### The new gate, and why the first version of it was worthless

`npm run smoke:hmh:mobile-controls` drives four handset viewports.

The **first version of this harness passed with both fixes reverted** — it
dispatched every synthetic `pointermove` to the stick element as well as the
window, and never made the visual viewport differ from the layout viewport. It
now runs three scenarios, and **each was verified to fail against a
deliberately reverted build**:

| Scenario | What it proves | Reverted result |
| --- | --- | --- |
| A — real touch via CDP `Input.dispatchTouchEvent` | a thumb drag moves the hero | — |
| B — `pointermove` to the **window only** | tracking is surface-level, not element-bound | `produced only 3.01px` ✗ |
| C — visual viewport 120px shorter than layout | the layout measures the visible area | `aim is laid out below the visible area (824.1 > 724)` ✗ |

Scenario B stands in for iOS Safari: element-bound tracking survives in
Chromium because `setPointerCapture` works there, so no Chromium test can
reproduce the original failure directly.

| Device | Result |
| --- | --- |
| iPhone 13 portrait (390 × 844) | PASS — 219.21px real / 174.87px surface |
| Pixel 7 portrait (412 × 915) | PASS — 221.64px / 173.54px |
| iPhone SE portrait (375 × 667) | PASS — 215.96px / 173.80px |
| iPhone 13 landscape (844 × 390) | PASS — 218.40px / 174.96px |

It also hit-tests `document.elementFromPoint` at each control centre. That
catches DOM occluders — how pause failed twice — but **not** canvas-drawn HUD,
which sits below the overlay's stacking level. A partial check, recorded as
such.

## Part 2 — movement, combat, weapons, upgrades, VFX

### Five tier-three capstones were inert

The upgrade tree named nine capstones. Only four (`extended-mag`, `quad-shell`,
`drum-mag`, `overheat-reduction`) did anything. **`burst-fire`,
`armor-piercing`, `double-barrel`, `explosive` and `tracer-rounds` were
collected into `specials` and then read by nothing** — a player spent three
tiers and received only the numeric bonus.

All five are now live, resolved through a `SPECIAL_EFFECTS` table:

| Capstone | Effect |
| --- | --- |
| `armor-piercing` | pistol rounds pierce 2 targets |
| `explosive` | shotgun shells detonate (58px splash) |
| `double-barrel` | +6 pellets across the same arc |
| `tracer-rounds` | ×1.35 speed, ×1.25 range, tracer VFX |
| `burst-fire` | real 3-round burst: 4-tick gaps inside, full cadence after |

`buildShots` previously read `pelletCount`, `spreadRadians`, `projectileSpeed`
and `range` from the **raw definition**, so any capstone touching those would
have stayed inert even once resolved. It now reads the resolved profile.

The `pierce` and `splash` policies were already implemented in
`projectile-physics.mjs` and already threaded from shot to projectile in
`main.mjs`, so these are live end to end, not just in the profile.

### The launcher had no upgrade path at all

`launcher-rig` was the only carryable weapon absent from `UPGRADE_TREES`. It now
has all three branches, with capstones `twin-tube` (+1 grenade, tightened
spread), `shaped-charge` (128px blast, up from 92) and `bandolier` (7-round
tube).

A test asserts **every** capstone in **every** tree changes something beyond its
numbers, so another inert tag cannot be added silently.

### Movement: turn assist

Reversing direction used the same response time as starting from a standstill,
which is what made hard direction changes feel sluggish. Response time now
scales with how much the input opposes current velocity (`turnAccelerationTime`,
0.045 vs 0.08). Cruising in a straight line and top speed are **bit-identical**
— asserted — and setting the two times equal reproduces the old behaviour
exactly.

### VFX

Projectile trails were uniform. Tracer rounds now draw a long hot streak with a
leading spark; piercing rounds draw a hard bright lance. The tier-three capstone
is legible in play, not just in the upgrade panel.

## Part 3 — roster lighting retune (carried from Cycle 024)

**Correction to an earlier draft of this ledger:** it claimed Cycle 024 left
`reproducibleVerified: false` and that this cycle merely re-verified it. That
was wrong — `git show HEAD` confirms Cycle 024 committed `true`. The `false`
came from an **uncommitted working-tree render of my own**.

What is actually staged is a **new lighting retune** for the enemy roster: key
235→300, fill 95→120, rim 165→210, plus three light colours (blue key, blue
fill, green rim) where Cycle 024 used uncoloured lights. This is the start of
the shared art direction across the roster. It is projection-only — sprite
pixels, no hitbox, physics, RNG or spawn change. Re-rendered with
`assets:hmh:enemy-roster:verify`: 7 actors, 1,368 frames, 0 duplicates,
reproducibility verified.

## Test changes, each justified

- `hmh-reboot-touch-controls.test.mjs` — drove `pointermove` on the stick
  element; that binding **is** the defect, so it now drives the window surface.
  The `weaponNext` element interaction went with the element.
- `hmh-reboot-input.test.mjs` — two tests referenced `buttons.weaponNext`. The
  overlap assertion now covers `power` vs `pause`, **plus a new assertion** that
  power clears the minimap vertically. Net coverage up.
- `hmh-reboot-shell.test.mjs`, `hmh-reboot-release-certification.test.mjs` —
  pinned strings that the source no longer contains.
- `hmh-reboot-release-browser-certification.mjs` asserted exactly 8 touch
  controls and would have **failed the release certification gate**; it now
  asserts the control set by name, and checks every control clears the minimap
  rather than only the two utility buttons.
- `hmh-reboot-combat-browser-smoke.mjs` tapped `weaponNext`, `melee` and `dash`.
  Those mechanics still exist, so they are driven by keyboard there now rather
  than dropped.

New: `hmh-reboot-mobile-controls.test.mjs` (8), `hmh-reboot-weapon-capstones.test.mjs` (8),
`hmh-reboot-movement-turn-assist.test.mjs` (4).

## Preserved invariants

- Input snapshot contract and `ACTIONS` vocabulary unchanged; fixed 60 Hz, four
  catch-up steps; bridge and save schema unchanged.
- `SETTLEMENT_LIVE` remains `false`; parent-owned wallet/profile/leaderboard/
  settlement authority untouched.
- All 8 visual scenes **unchanged** against the accepted baselines.

## Gates

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — 332 JS modules + 49 Python scripts |
| `npm run test:release` | PASS — `1753 total / 1701 passing / 52 accepted legacy / 0 unexpected` (+20) |
| `npm run build` | PASS — HMH bundle 996.2 KB, under the gate |
| `npm run smoke:hmh:mobile-controls` | PASS — 4/4 devices (new; revert-verified) |
| `npm run certify:hmh:browser` | PASS |
| `npm run visual:reboot` | PASS — 8/8 scenes unchanged |
| `npm run assets:hmh:enemy-roster:verify` | PASS — reproducibility verified |
| `npm run assets:qa:hmh-reboot` | PASS — all atlas budgets met |
| `design:security-audit` | PASS — 5/5, zero findings |
| `design:web3-audit` | PASS — 9/9 |
| `smoke:portal:e2e` | PASS — all implemented flows |
| `smoke:hmh:performance` | PASS — desktop/mobile p95 **7 ms / 7 ms**, unchanged |
| `repo:health:strict`, `docs:links` | PASS |

## Known consequences

**Melee and weapon switching are not reachable on touch.** Both were bound to
buttons this cycle removes. Melee remains on `KeyE` and gamepad; weapon
switching on number keys and gamepad. A touch player keeps whatever weapon a
pickup last granted and cannot melee. Dash was rescued via double-tap; melee and
weapon switching were not, because the requested control set has no room and
inventing two more hidden gestures would undo the simplification that was asked
for. Recorded here rather than designed around silently — the cheapest fix if
wanted is a long-press on POWER to cycle weapons.

## Independent review

Reviewed adversarially against the exact staged index; verdict **BLOCK** with
three block-level and three major findings, all real and all fixed above: the
untouched `certify:hmh:browser` gate, a false "8/8 byte-identical" claim, the
misdescribed roster re-render, a new gate that passed with the fix reverted, the
orphaned combat smoke, and undisclosed loss of melee/dash. Also applied:
deduplicated five window listeners into one each, removed a dead code path,
mirrored the compact-portrait branch in `minimapExclusionLeft`, and replaced a
regex whose first alternative could never match.

## Deployment state

Pushing this branch produces a Vercel **Preview** deployment only. Production
promotion requires the Vercel dashboard or an authenticated CLI, neither of
which exists in this checkout, and per the Cycle 021 stop boundaries requires
explicit approval regardless.
