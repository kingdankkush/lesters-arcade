# HMH gore setting — Off / Reduced / Full

Branch `claude/200-gore` on `codex/visual-overhaul-200-20260929` (7ddfb0ea5).
Feature commit `fbdbc9049`. Owner decision (approved): a gore setting with three
levels, Off / Reduced / Full, default Full; share images and banners stay
gore-free.

## What changed

- **Setting key:** `goreLevel`, values `'off' | 'reduced' | 'full'`, default
  `'full'`. It rides the existing `game:settings` / `portal:settings` channel
  as an optional enum field (older parents without it stay valid; the child
  then reads the required `gore` boolean: `false` → `off`, `true` → `full`).
  The portal persists it as `gameplay.goreLevel` inside the existing
  `'hmh-settings'` localStorage record beside the legacy `gameplay.gore`
  boolean, through the same `mergeHmhRuntimeSettings` /
  `projectHmhRuntimeSettings` path every other pause setting uses. No
  save-schema change (`2`), no bridge protocol version change (`hmh-bridge/v1`).
- **Child (`apps/hmh-reboot/src/main.mjs`):** `syncRuntimeSettings` derives
  `goreLevel` on every sync and keeps `settings.gore = goreLevel !== 'off'`, so
  the pinned `resolveKillBurst` / `resolveImpactBurst` call sites and the
  bridge's required boolean are untouched. A new `applyPauseChoice('goreLevel',
  value)` path (like the numeric `applyPauseLevel`) leaves the pinned boolean
  path byte-identical. The lazily loaded pool is created with
  `createGorePresentation({ level: settings.goreLevel })` and re-levelled with
  `setLevel` on every sync. Telemetry: `dataset.settingGoreLevel`.
- **Presentation (`gore-presentation.mjs`):** `GORE_LEVELS`,
  `DEFAULT_GORE_LEVEL`, `GORE_REDUCED_LIMITS`, `normalizeGoreLevel`,
  `createGorePresentation({ level })`, `setLevel(level)`, `level` getter.
  - `full` — the previous pool byte for byte (`tests/hmh-render-alloc.test.mjs`
    still compares it against the 1.8.1 reference fixture).
  - `reduced` — marks 24 (was 48), droplets 12 (24), one droplet per hit (3),
    two per kill (5), fragments 6 (12), limbs 0 (8). A dismembering kill keeps
    its splat and spray but throws no limb chunks; the body crumples.
  - `off` — `add()` is a no-op, `frame()`/`render()` clear and draw nothing.
  - `setLevel` mid-run: stepping down trims the pools oldest-first and drops
    every limb, `off` clears, stepping up lets the pools grow again.
  - Corpses (`corpse-presentation.mjs`) take no gore input and are unchanged:
    kills read as clean crumples at every level.
- **Pause menu (`cockpit-ui.mjs`, `apps/portal/hmh-reboot/index.html`,
  `styles.css`):** a `<fieldset class="hmh-setting-choice"
  id="hmhSettingGoreLevel">` with a `<legend>` and three native radios
  (`hmhSettingGoreOff` / `hmhSettingGoreReduced` / `hmhSettingGoreFull`,
  `name="hmhSettingGoreLevel"`, Full checked). Arrow keys move the choice, Tab
  enters and leaves the group, the checked option is a filled segment, every
  option is a 44px target on desktop, compact and landscape. The markup is
  optional to the cockpit factory (own ids, `getElementById`), so the
  existing `hmh-setting-toggle === 4` pins and the boolean path stay as they
  were. New callback `onSettingChoice(key, value)`.
- **Bridge (`sdk/hmh-bridge-protocol.mjs`):** `goreLevel` added to the optional
  settings fields with an enum check; `gore` stays a required boolean.
- **Portal (`apps/portal/src/hmh-player-settings.mjs`):** `gameplay.goreLevel`
  (default `'full'`, unknown → `'full'`), merged from the child's
  `game:settings`, projected with the legacy toggle as master switch: toggle
  off → level `off` (stored level remembered); toggle on with a stored `off`
  (only possible when the legacy portal button was flipped on after the pause
  menu chose Off) → `full`, the later action wins. `apps/portal/main.js` needed
  no change: it spreads `gameplay` through.
- **Standalone (`standalone-session.mjs`):** dev sessions start at
  `gore: true, goreLevel: 'full'` (were `gore: false`).
- **Pin update:** `tests/hmh-reboot-progression-ui-adapters.test.mjs` no longer
  forbids `hmhSettingGore` in the pause markup (it still forbids
  `hmhSettingColorblind`).

## Determinism proof

There is no Node harness for the `main.mjs` tick loop, so the proof is at the
module layer plus static analysis (`tests/hmh-gore-level-setting.test.mjs`):

1. A scripted, deep-frozen combat visual stream (flesh / metal / shielded
   impacts, dismembering and plain kills, a muzzle event) is fed to a
   presentation at each of the three levels and rendered at several ticks.
   The stream serializes byte-identically before and after every level (any
   write would also throw on the frozen objects), the corpse clock and
   projection produce the same objects for every level, and the three levels
   do draw differently, so the comparison is real.
2. Static: every module under `apps/hmh-reboot/src/` outside the presentation
   owners (`gore-presentation.mjs`, `main.mjs`, `cockpit-ui.mjs`,
   `weapon-vfx.mjs`, `standalone-session.mjs`, `runtime-performance.mjs`) is
   free of `goreLevel` / `settings.gore` / `GORE_LEVELS`; `simulation.mjs`,
   `enemy-simulation.mjs`, `combat-lifecycle.mjs`, `run-summary-v7.mjs`,
   `enemy-combat.mjs`, `collision.mjs` and the three `sdk/hmh-run-summary*`
   modules never mention gore at all; `gore-presentation.mjs` imports only the
   deterministic hash; in `main.mjs` every `goreLevel` line is one of the
   allowed settings-sync / pause-callback / dataset / presentation uses, and
   `gorePresentation?.add(` has exactly one call site, the head of
   `pushCombatVisualEvent`, which consumes events after the simulation
   produced them.
3. `full` equals the default: explicit `{ level: 'full' }` and the no-argument
   factory produce deep-equal frames and draw ops for the scripted stream, and
   the existing 1.8.1 reference comparison still passes.

`reduceFlash` at every level: `resolveKillBurst`, `resolveImpactBurst` and
`resolveEnemyHitReaction` keep their clamped colours and alphas with
`gore` true or false, and the `main.mjs` call sites pass both flags from the
live settings.

## Share paths audited

- HMH has no live-scene capture. No file under `apps/hmh-reboot/src/`, nor
  `api/free-card.mjs`, `server/share/render-free-card.mjs`,
  `server/share/render-card.mjs`, `apps/portal/src/share-file.mjs` or
  `share-links.mjs`, uses `toDataURL`, `toBlob`, `renderer.extract`,
  `preserveDrawingBuffer`, `captureStream` or `html2canvas` (asserted by the
  test). The only canvas export in the portal is the avatar upload cropper,
  unrelated to shares.
- The Free share card is composed server-side by `api/free-card.mjs`
  (`@vercel/og`, Satori) purely from the token plus committed PNGs under
  `apps/portal/assets/share-cards/`; the Ranked card (`api/share-card.mjs`,
  `server/share/card-art.mjs`) uses the same background. Reviewed at full
  resolution, none contains blood, wounds or dismemberment; all show heroes
  with weapons, muzzle flame and city/forest backdrops:
  - `share-cards/lester-blaster.png` `a2261a76…39a0ea7` (Ranked/Free card
    background; also pinned by `server/share/card-art.mjs`)
  - `share-cards/lester-blaster-free.png` `902331ec…493c221f`
  - `share-cards/heroes/lit-commando.png` `2b8ce0b4…3e59c9`
  - `share-cards/heroes/lit-valkyrie.png` `62e49216…6f95b`
  - `share-cards/heroes/lester-original.png` `9093004e…781b2e`
  - `share-cards/heroes/lilly.png` `02ca2197…a73f2b`
  The test pins the full SHA-256 of each; replacing one fails it until the
  image is re-reviewed and this note updated.
- Banners (`apps/portal/assets/hmh-art/banners/hmh-*.webp`, the two
  `assets/generated/hmh-banners/*-keyart.jpg` for coming-soon cabinets) are
  static marketing art referenced by the portal pages and structured data;
  they are not produced from gameplay. Not hash-pinned (outside the share
  pipeline).
- Because no share path captures the scene, no forced-off capture switch was
  needed and none was added. If a live capture is ever introduced it must
  render with the pools at `off` (`gorePresentation.setLevel('off')`, restore
  afterwards) regardless of the player's setting; the static checks above will
  flag the capture call.

## Tests

- `node --test tests/hmh-gore-level-setting.test.mjs`: 12/12.
- Touched and adjacent suites together (`hmh-gore-level-setting`,
  `hmh-gore-presentation`, `hmh-reboot-upgrade-cards-and-settings`,
  `hmh-player-settings`, `hmh-reboot-progression-ui-adapters`,
  `hmh-reboot-protocol`, `hmh-reboot-vfx-budget-accessibility`,
  `hmh-reboot-standalone`, `hmh-reboot-runtime-settings`, `hmh-render-alloc`,
  `hmh-mobile-visual-caps`, `hmh-reboot-host`, `hmh-reboot-child-bridge`,
  `hmh-reboot-parent-bridge`, `hmh-cockpit-lazy-startup`): 127/127
  (baseline before the change: 106/106 on the same list minus the new file
  and the three new cockpit tests).
- `node scripts/syntax-check.mjs`: 1338 JS modules + 151 Python scripts.
- Full `npm test`: 6426 run, 6353 pass, 73 fail, 0 skipped. The 73 failures are
  the identical set that the untouched base commit 7ddfb0ea5 fails in a
  throwaway worktree of the same checkout (6411 run, 6338 pass, 73 fail;
  the failing-name sets were diffed and are equal). They are the visual
  overhaul branch's known breakage, none in a file this slice touched:
  asset-inventory / LFS-backed art tests (PixelLab kits, roster atlases,
  world packs, curated inventories), `hmh-reboot-startup-runtime` (a
  `terrainAreaStreaming` ReferenceError in the startup harness and the
  `eventMode` Pixi check on `actor-3d-pixi.mjs`), two `main.mjs` layer-order
  pins (`weapon-vfx`, `world-atmosphere`) on lines this slice does not
  change, the Chikun 1.8.2 byte-identity pin, the WO-39 sweep (a STACKED
  `innerHTML`), the Vercel crons pin and the child share/Ranked copy pins.
  Not hidden behind the retirement gate; `npm run test:release` was not run
  in this lane.

Source deltas (bytes, unminified): `main.mjs` +1,354, `cockpit-ui.mjs`
+1,421 (lazy chunk), `gore-presentation.mjs` +2,145 (lazy chunk),
`hmh-bridge-protocol.mjs` +367, `hmh-player-settings.mjs` +844. No build was
run in this lane; the initial-JS budget must be re-measured by root.

## Needs the root browser review

- Visual check of all three levels on desktop and phone framing: Full should
  look exactly as before; Reduced should show sparse blood with no limb chunks
  on a launcher / shotgun / rail kill; Off should show clean crumples only,
  with the flesh impact burst back to its tan puff.
- The pause panel with the new fieldset: two-column desktop grid (the fieldset
  spans both columns under the four toggles, above the SFX slider), the
  600px compact and the landscape blocks (44px segments), keyboard arrow-key
  movement and the focus ring on the checked segment.
- A mid-run switch through the pause menu on a live run: pools trim and limbs
  vanish on Full → Reduced, everything clears on Off, and `game:settings`
  carries `goreLevel` so the portal persists it and the next run restores it.
- `npm run build` and the initial-JS budget gate, `npm run visual:reboot`
  (the pause panel and any gore-bearing scene may need a reviewed baseline
  update), and the release harness; none were run here.
