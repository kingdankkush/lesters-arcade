# STACKED settings simplification (2026-09-25)

Owner direction (Justin, 2026-09-24): STACKED had too many settings, and most
of them could simply be on by default. He asked for a smaller menu with a
better UI. He also accepted two earlier recommendations:

- Reduced flashes stays on as the safety option, but a gentle version of the
  music-reactive board glow runs while it is on, so the glow shows by default.
- The scene and reactive-board preferences move out of the child key
  `stacked-visual-scenes-v1` and into the portal's player settings, so they
  persist like everything else.

For the in-cabinet menu, this record supersedes `spec/portal.md` §12.2–12.3.
The spec itself is an intake document hashed in `PROVENANCE.txt` and is left
unchanged. [SETTINGS.md](SETTINGS.md) is the short current reference.

## Controls

There were 15 controls. There are now 9 on touch and 8 on desktop, on one card
(`#preferencePanel`). The card starts closed. The Settings tile opens and
closes it, and its `aria-expanded` follows the card.

| # | Group | Label | Control | Default |
|---|---|---|---|---|
| 1 | Effects | Visual effects | Radio group `effectsPreset` (`#effectsOff` / `#effectsCalm` / `#effectsStandard` / `#effectsFull`), styled as a segmented control | Standard |
| 2 | Effects | Music world | `#visualizerSelect` with its motion preview | Journey |
| 3 | Play | Landing guide | `#ghostToggle` | on |
| 4 | Play | Board grid | `#gridToggle` | on |
| 5 | Play (touch or 600 px and narrower) | Left-handed buttons | `#leftHandToggle` | off |
| 6 | Accessibility | Reduced motion | `#motionToggle` | Follows the arcade setting or the OS `prefers-reduced-motion` until the first STACKED save |
| 7 | Accessibility | Reduced flashes | `#flashToggle` | **on** |
| 8 | Accessibility | Piece patterns | `#pieceMarksToggle` | off |
| 9 | Sound | Game sounds | `#volumeRange`, 0–100 in steps of 5. At 0 it shows and announces "Off". | 35% |

Focus order follows the table. `#continueButton` is the first focusable control
in the dialog and `#volumeRange` is the last, so the focus trap wraps on those.
Each effects segment is a 44 px target that can be tapped anywhere. The
segments sit 2 × 2 at 440 px wide and below. The checked segment is marked by
bold weight and an inset bar as well as colour. In forced-colours mode it gets
a `Highlight` border.

## Effects presets

`expandStackedEffectsPreset` in `apps/portal/src/stacked-player-settings.mjs`
is the only table of preset values:

| Preset | `effectsIntensity` | `reducedEffects` | `scene` | `reactiveBoard` | `audioReactive` | What the player sees |
|---|---|---|---|---|---|---|
| `off` | 0 | true | `off` | false | false | The board and pieces only. The danger rail and captions stay. The host stops sampling audio. |
| `calm` | 0.4 | true | `off` | false | false | A slow ambient world and softer bursts. Nothing follows the music. |
| `standard` | 0.7 | false | `auto` | true | true | The music world, the auto scene deck and the board glow. The glow is gentle while Reduced flashes is on. |
| `full` | 1.0 | false | `auto` | true | true | Everything at full strength. Reduced flashes still softens it. |

The renderer reads the expanded fields, so its contract is unchanged. Reduced
motion stays a separate toggle, because it is an accessibility need rather than
a matter of how busy the screen looks. The renderer already stills the reactive
visuals when it is on.

## Old settings, new treatment

| Old control | Now |
|---|---|
| Landing guide, Board grid, Music world, Reduced motion | Kept |
| Left-handed controls | Kept, renamed "Left-handed buttons" |
| Reduced flashes | Kept and on by default. It now means a gentle glow instead of no glow. |
| Piece markings | Kept, renamed "Piece patterns" |
| Effect intensity, Minimal effects, React to music, Music-reactive board, Backdrop scene | Folded into the Effects preset |
| Next scene | Removed from the UI. `renderer.nextScene` stays for QA. |
| Game sound volume and Game sound effects | Merged into one slider. `sfxEnabled` is `sfxVolume > 0`. |
| Handling, bindings, touch layout/opacity/sensitivity, quality tier, HUD scale, music toggle | Unchanged and still hidden, because the exact-key bridge validator needs them |

## Storage and migration

Everything is stored under `stacked-player-settings-v1`. The file stores
`video.effectsPreset` and also the fields the preset expands to, so the saved
object never contradicts itself and a 1.8.1 rollback reads fields it already
knows.

`readStackedSettings(storage, reducedMotion, { prefersReducedMotion })`:

1. Start from the defaults. Reduced motion is seeded from the arcade setting
   or, through the injectable third argument, from `matchMedia('(prefers-reduced-motion: reduce)')`.
2. Read the parent key. Only this allowlist is recovered: the booleans
   `ghostPiece`, `gridLines`, `musicEnabled`, `sfxEnabled`, `reduceMotion`,
   `reduceFlash`, `colorblindPieces` and `touchLeftHanded`, plus the
   `visualizer` and a finite `sfxVolume` between 0 and 1.
3. Read the legacy child key in a separate `try`, so a malformed legacy value
   never drops the parent values. Only a known scene name and a boolean
   `reactiveBoard` are used.
4. A saved `effectsPreset` wins. Without one, `stackedEffectsPresetFromLegacy`
   classifies the old values:
   - intensity 0 → `off`
   - Minimal effects on, React to music off, intensity below 0.55, scene `off`,
     or reactive board off → `calm`
   - intensity 0.85 or more → `full`
   - otherwise → `standard`
5. Expand the preset. Then `sfxEnabled: false` becomes volume 0, and
   `sfxEnabled` is set to `sfxVolume > 0`.
6. The legacy key is never written or deleted. Remove the read one release
   after this ships.

`applyStackedPresentationPreferences` is the authority on what gets saved. The
host expands the preset itself, so derived fields sent by the child are
ignored. The bridge (`stacked-bridge-protocol.mjs`) accepts `effectsPreset`,
`scene` (`auto` or `off`) and `reactiveBoard` as optional presentation keys in
`settings.video` and in `game:preferences-request`. The required keys and
`version: 1` are unchanged.

### Deploy skew

An arcade tab that loaded the 1.8.1 `stacked-host.mjs` chunk before a deploy
keeps the 1.8.1 exact-key validator in memory, but relaunching STACKED loads the
new child. That validator rejects `effectsPreset`, `scene` and `reactiveBoard`.
The rejection happens before the host advances its message sequence, so every
later child message fails as out of order, including `game:result`, and a
Ranked run would end "Not saved". A service-worker bump does not help, because
the old host is already in memory.

`apps/stacked/src/preferences-bridge.mjs` prevents this:

- `stackedParentKnowsPresets(init.settings)` is true only when the init
  settings carry a valid `effectsPreset`. Only such a parent is sent the three
  preset keys. Any other parent gets exactly the 1.8.1 key set, which the
  current host classifies back to the same preset (0 → off, minimal → calm,
  0.7 → standard, 1 → full).
- `withStackedEffectsPreset` gives settings without a preset (from `portal:init`
  or a `portal:settings` echo) the nearest preset in the child's copy, so the
  radios, the backdrop and the board glow agree. Settings that already carry a
  preset are left exactly as the parent sent them.

`tests/stacked-preferences-bridge.test.mjs` pins the 1.8.1 request key set and
round-trips every preset through a 1.8.1 host echo. The key set was also checked
against the real 60ea173a validator.

The reverse case is a 1.8.1 child with a new host. It needs the new portal chunk
from the network and the old child from a cache, because the service worker is
network-first for scripts and HTML. The 1.8.1 child then rejects the new
`portal:init` with "Invalid parent message", so the launch fails before a run
starts and no result is at stake. A reload fixes it.

A successful save is silent. A failed save is announced once through
`#stackedStatus`, and `#settingsSaveNote` changes to "Couldn't save on this
device. Your changes still apply to this run."

## Gentle board glow

`apps/stacked/src/render/board-pulse.mjs`:

- **Off** under reduced motion, zero intensity, `audioReactive: false` or
  `reactiveBoard: false`. The Off and Calm presets set both of the last two.
- **Normal mode** (Reduced flashes off) is unchanged: the frame follows
  `0.4·level + 0.6·beat` and the piece follows `0.35·level + 0.65·beat`, capped
  at `PULSE_CEILINGS` (0.20 / 0.26, tint mix 0.35).
- **Gentle mode** (Reduced flashes on) only runs while live music is `available`.
  Let `I = 0.35 + 0.65·intensity`. Then both frame and piece equal
  `GENTLE_PULSE_CEILINGS (0.12) · I · (0.5 + 0.5·level)`. There is no beat term
  and no tint mix.

Safety argument:

- No node goes above 0.12 alpha.
- The music level moves a node by at most `0.12 × GENTLE_SWING (0.5) = 0.06` alpha.
- The level envelope is smoothed (0.12 s attack, 0.35 s release).
- Beat onsets have no effect and the hue never shifts.
- The affected area is a 6 px ring outside the well plus four 3 px cell rims.

This is far below both the luminance-change threshold and the area threshold
of the WCAG 2.3.1 general-flash rule. Starting or stopping music causes a
single step of at most 0.12 alpha. At the Standard default the frame breathes
between about 0.048 and 0.097 alpha, so the glow is visible but clearly softer
than normal mode.

## Gamepad

`apps/stacked/src/menu-navigation.mjs` handles the overlay:

- Up and down move between visible, enabled stops and wrap at both ends.
  Disabled controls are now skipped (F12).
- A radio group counts as one stop: its checked radio.
- Left and right on a radio pick the neighbouring preset, stopping at the ends,
  and fire one bubbling `change`. On a select or range they step it as before.
- A clicks buttons, checkboxes and summaries.

## Ranked

All 9 controls are presentation-only. None of them reaches the simulation, RNG,
evidence, scoring, the run summary or replay verification. They work the same
in Free and Ranked, before a run and from the pause overlay, and no new locks
are added. These existing rules still apply:

- The start level is forced to 1 in Ranked.
- UNDO is Free-only.
- Handling stays at the contract constants.
- Time in Settings counts against the 15-minute Ranked pause allowance.
- `runStats.reducedMotion` reports `accessibility.reduceMotion`.

The fine print says every setting is allowed in Ranked.

## Verification

Unit tests, run in this change:

- `node --test tests/*stacked*.test.mjs` plus `unlockables-children`,
  `lazy-routes`, `integration-glue-copy` and `share-links`
- New or extended tests: `stacked-player-settings`, `stacked-bridge-protocol`,
  `stacked-music-worlds`, `stacked-board-pulse`, `stacked-music-scenes`,
  `stacked-shell-ui`, `stacked-menu-navigation` and `stacked-preferences-bridge`

Still owed, because browser runs and the release gate were not available in
this session:

- `npm run build`. It includes the STACKED entry and initial JS caps. The entry
  now imports `stacked-player-settings.mjs`, which the portal shares.
- `scripts/stacked-playable-browser-smoke.mjs`, `scripts/stacked-reactive-evidence-smoke.mjs`
  and `scripts/stacked-visualizer-performance.mjs`. They have been retargeted to
  the new card but have not been run.
- Screenshots of the closed and open card at desktop, 390 px and 320 px,
  including the 2 × 2 segments.
- A gamepad pass through the card.
- A visual check that the gentle glow reads at Standard.

## Follow-ups

- `apps/portal/main.js` belongs to another session. It should forward the
  arcade `reduceFlash` into `readStackedSettings` and persist the Free start
  level.
- Handling presets (DAS/ARR) affect gameplay. They need an owner decision, a
  Ranked review and `summary.handling` evidence.
- Remove the `stacked-visual-scenes-v1` read one release after this ships.
- Retire the dead schema fields with a `version: 2` bridge.
- Once the owner confirms fixed scenes are gone, delete the fixed-scene path
  (`renderer.nextScene`) and move per-scene art evidence to
  `scripts/stacked-visualizer-qa-entry.mjs`.
