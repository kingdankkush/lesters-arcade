# HMH hero clip library — 9 native clips plus 71 authored clips per hero

2026-09-30. Branch `claude/200-animation`, base `7cac31fa9`. Animation lane of the 2.0 overhaul (brief section 2.4).

## What exists

A data-driven, Blender-free clip authoring library for the four hero rigs, a catalogue of 67 shared gameplay clips plus four idle fidgets per hero, and re-exported hero GLBs that carry the nine native clips byte-for-byte plus the library. The runtime can select any clip by name, existing states map exactly as before, and idle fidgets play from a presentation-only hash after 4 s of standing still. Nothing here reads or writes simulation state.

| Piece | Path |
|---|---|
| Authoring engine | `scripts/hmh-blender/hmh_clip_library.py` |
| Clip catalogue (all poses) | `scripts/hmh-blender/hmh_hero_clip_catalogue.py` |
| Exporter (pure Python, appends to the committed GLB) | `scripts/hmh-blender/export-hmh-hero-clips.py` |
| Native pose dump (Blender, CPU, read-only) | `scripts/hmh-blender/dump-hmh-hero-pose-basis.py` |
| Equivalence proof | `scripts/hmh-blender/check-hmh-hero-clip-equivalence.py` |
| Contact sheet (Blender Eevee + Pillow) | `scripts/hmh-blender/render-hmh-hero-clip-sheet.py` |
| Per-hero clip manifests | `apps/portal/assets/generated/hmh-actor-3d-pilot/<hero>-clips.json` |
| Generated runtime table | `apps/hmh-reboot/src/actor-3d-clip-table.mjs` |
| Runtime selection + fidget picker | `apps/hmh-reboot/src/actor-3d-clips.mjs` |
| Receipts | `docs/2.0/receipts/hmh-hero-clips-20260930/` |
| Tests | `tests/hmh-hero-clip-library.test.mjs` plus the updated actor suites |

## Authoring approach

Every clip is a list of pose keys at 60 Hz ticks. A key maps rig bone names to offsets in **Blender pose-bone semantics** (`rot` XYZ Euler degrees, `loc` metres in the bone's rest frame, `scale`), composed on top of the hero's neutral stance (its native `idle` at t=0), so an empty pose is the standing hero and any value can be typed back into Blender's N-panel for that bone. Keys carry an ease (`linear`, `in`, `out`, `in-out`, `hold`); rotations slerp between keys, locations and scales lerp.

Rig facts measured on all four rigs by `dump-hmh-hero-pose-basis.py`: +Y runs along each bone, +Z points forward, and local X points to world −X on **both** sides. So `x` swings a limb forward/back, `z` moves it sideways (negative is outward on the right), `y` twists, and the left/right mirror is `rot (x, −y, −z)`, `loc (−x, y, z)`. `mirrored_clip` derives every `-r` variant from its `-l` sibling with that rule. Clips are root-motion-free: only `root` yaws (turns, twirl) and only the pelvis rises or drops in place.

The reference vocabulary (run stride ±31° thighs, aim arms, melee wind-up/strike, grenade release, death crumple) was measured from the native clips so the library reads in the same idiom.

### Export and equivalence

A baked clip becomes glTF LINEAR samplers whose node transforms are `rest ∘ basis`, exactly what Blender's exporter writes for pose bones. The exporter reads the committed hero GLB, strips any previous library block (recorded in `asset.extras.hmhClipLibrary`), bakes each clip at a sparse normalised grid (9, 13, 17 or 25 samples by length; every grid contains t = 0, 0.5, 1), drops channels that never leave rest, collapses constant channels to two keys, packs each clip into one buffer view and appends. Geometry, textures, skin and the nine native animations are untouched bytes.

`check-hmh-hero-clip-equivalence.py` re-expresses all nine native clips of every hero from their Blender per-frame pose basis through the library and compares every sampled translation/rotation/scale against the committed samplers. **Tolerance 1e-5; measured maximum 7.8e-7** (float32 rounding) on all four heroes. The shipped native clips remain Blender's bytes; the proof shows the library's math is the exporter's math.

Every GLB clip is normalised to 1.0 s; the manifest `frames` value is the playback tick count. The runtime clock is `loop ? (tick % frames) / frames : min(1, tick / frames)`, which for the nine native clips reproduces the controller's previous per-state constants exactly (tested).

### Blender re-import caveat

Blender keeps a bone's last pose when a clip has no channel for it, while glTF puts it at rest. `verify-hmh-actor-glb-pilot.py` and the sheet renderer now reset every pose bone before activating a clip. Until that reset the first verification of the sparse clips showed stale poses (visible as collapsed "blobs" on the first contact sheet); the committed receipts are from the corrected verifier and the runtime CPU-skinning test reproduces them within 2e-5 m for all 80 clips per hero.

## Clip inventory

Shared (all four heroes, 67): run-start, run-stop, strafe-l/r, back-pedal, turn-l/r, pivot; dodge-roll, stumble, knockdown, get-up, stun, fall, land; cover-enter-tall/short, cover-idle-tall-l/r, cover-idle-short, cover-shuffle-l/r, cover-peek-fire-l/r, cover-popup-fire, cover-blind-fire, cover-reload, cover-hit, cover-leave-step/run/roll; mantle, vault, drop; fire-shotgun/rifle/heavy/launcher, recoil-light/heavy, reload-pistol/long/heavy, weapon-swap; melee-1, melee-2, melee-finisher; throw-short/long; hit-front/back/left/right; death-front/back/explode; spawn, victory, level-up, multikill; interact-door/lever/valve/button, pickup; water-wade, hazard-flinch.

| Hero | Native | Shared library | Fidgets (presentation only, 4 s idle, instantly interruptible) | Pending |
|---|---:|---:|---|---|
| Lit Commando | 9 | 67 | fidget-shoulder-pose, fidget-flip-phone, fidget-knuckles-stretch, fidget-salute | walk cycle, slope up/down, hazard death variants, cover-slide as a separate state |
| Lilly | 9 | 67 | fidget-glasses-tablet, fidget-air-code, fidget-sip-coffee, fidget-coat-twirl | same |
| Lit Valkyrie | 9 | 67 | fidget-selfie, fidget-hair-flip, fidget-sprinter-stretch, fidget-bubble-gum | same |
| Lester | 9 | 67 | fidget-coin-flip, fidget-meditate, fidget-read-book, fidget-polish-head | same |

Every manifest entry carries `frames`, `loop`, `blendIn`, `blendOut`, `interruptible`, `prop` (`blaster`, `knife`, `frag`, `none`) and `category`. `cover-shuffle` ships as `-l`/`-r` because the shuffle direction is not symmetric. Long-gun clips (rifle, shotgun, heavy, launcher) pose the arms for a two-handed weapon but the only held mesh in these GLBs is the coin blaster; the runtime shows it as the stand-in until long-gun meshes exist.

## Sizes

| Hero | Before | After | Library bytes | Clips |
|---|---:|---:|---:|---:|
| lit-commando | 8,023,452 | 8,656,592 | 633,140 | 80 |
| lilly | 7,860,780 | 8,415,092 | 554,312 | 80 |
| lit-valkyrie | 8,360,540 | 8,888,720 | 528,180 | 80 |
| lester-original | 7,829,828 | 8,278,220 | 448,392 | 80 |

All under the 9,000,000 B cap (the previous hero test cap was 8 MiB; it moved with this slice). No quantisation was needed; the runtime decoder's clip bound rose from 16 to 128.

## Runtime

- `actor-3d-model.mjs`: clip bound 16 → 128. All actor 3D modules stay in the lazily imported chunk (`main.mjs` dynamic-imports `actor-3d-controller.mjs`); `main.mjs` is unchanged, so the HMH initial/shared JS does not grow.
- `actor-3d-controller.mjs`: `hero.clip` + `hero.clipTick` select a named clip when it exists for that hero; otherwise the previous `action` mapping applies unchanged. The controller owns an idle-fidget picker and overrides the presented clip while a fidget plays.
- `actor-3d-clips.mjs`: `createIdleFidgetPicker` keys `deterministicUnit` (the presentation hash family, never simulation RNG) on the idle start tick, waits 240 ticks, avoids an immediate repeat and cancels on any non-idle observation.
- `actor-3d-pixi.mjs`: held-prop visibility comes from the clip table (`prop`), reproducing the native rules.
- The sprite fallback (`hero-motion-atlas.mjs`) is untouched.

## Contact sheet

`docs/2.0/receipts/hmh-hero-clips-20260930/lilly-clip-contact-sheet-runtime.png`: every library clip of Lilly at t = 0.25 / 0.5 / 0.75, rasterised by `scripts/hmh-hero-clip-preview.mjs` with the runtime's own decoder and skinning math (CPU only, no heavy lock). It was inspected clip by clip; notes are in `lilly-clip-sheet-review.md` beside it. The Blender Eevee sheet (`render-hmh-hero-clip-sheet.py`) needs the shared GPU lock and is added when a render slot is free; its first pass exposed the unkeyed-bone re-import caveat above.

## What root must verify in the browser

1. `?actor3dPilot=1` with each hero: idle still plays, then a fidget starts after ~4 s of no input and stops the frame input arrives.
2. Native states (run, aim, pistol-fire, melee, grenade, dash, hurt, death) look identical to the previous build.
3. Force a library clip through the descriptor (`hero.clip = 'cover-idle-tall-l'`, `clipTick`) and confirm prop visibility follows the table (knife only in melee-*, frag only in throw-*, nothing in interact-*/death-*).
4. Bundle budget: confirm the combined initial build stays at 1,046,864 B (no initial-chunk import of `actor-3d-clips.mjs`).
5. Phone memory with the larger GLBs (8.3–8.9 MB each, one hero loaded at a time).

## Not done

No gameplay states drive cover, traversal, hazards or ceremonies yet; those are simulation slices. Blend-in/out ticks are recorded but the pilot still cuts between clips. Poses are first-pass authored, reviewed only on the contact sheet, not in the game camera.
