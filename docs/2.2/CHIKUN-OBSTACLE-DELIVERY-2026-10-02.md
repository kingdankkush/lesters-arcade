# Chikun obstacle art and sound controls — October 2, 2026

Bounded delivery for master-list item 10 and item 26's oscillator mute bug.
This does not finish every part of either item.

## Implemented

- Six newly authored native Blender assets: brass/enamel pressure pipe, patrol
  drone, irregular hanging canopy, storm cloud/rain, waterfall/foam and cut-bank
  gap lips. Runtime alpha WebPs replace the existing presentation of pipe,
  drone, canopy, storm, waterfall and pit. Eagle retains its existing animated
  native sheet. No owl or obstacle kind was added.
- Actual `drawGroundObstacle` dispatch uses the kit by default after a dynamic
  import in the child. Metadata and images load from the same origin. Failed,
  incomplete, timed-out or disposed loads retain the old geometry fallback.
- Drone, canopy, storm and waterfall each have eight distinct native Blender
  frames at 12 fps, packed into fixed 4×2 sheets. These animate hover/rotors,
  foliage sway, rolling cloud/rain and pleated flow/foam respectively. Pipe and
  gap bank remain static. Existing eagle already has its native eight-frame
  loop and is reused. All four new loops have eight distinct **decoded runtime
  frames** in both texture tiers, verified after WebP compression.
- Layered rotor blur, storm rain/local cloud glow and water mist use snapshot
  time. Reduced motion freezes native loops at frame zero and stops layered
  motion; there are no whole-screen lightning flashes.
- Ground gap/canopy fallback labels were removed. Existing course, collision
  shapes, random streams, input evidence, replay versions and scoring unchanged.
- Phones choose low textures regardless of DPR; desktop selects low at 1x or
  medium at higher density. Highest authored tier is medium; there is no new
  high-resolution tier in this batch. Total decoded caps are enforced at 4 MiB
  for phones/low and 12 MiB for medium.
- Retained legacy fallback tones now use the same context, eight-voice cap and
  gain master as sampled sounds. Mute affects playing tails and future voices.
  A persisted pause-menu SFX volume slider controls both sources, including 0%.
  No new sound or synthesized cue was introduced.
- The character now follows the existing environment light rig through a
  restrained warm/night tint and small upper-left rim glow. One reusable
  192×192 grade canvas preserves ungraded blended poses and prevents accumulated
  darkening during animation crossfades. Menus stay neutrally lit. Scenery's
  existing day/region transitions were already implemented and retained.

## Asset receipts and limits

`apps/portal/assets/generated/chikun-obstacle-kit-v1/manifest.json` binds the
six source hashes and twelve runtime WebP hashes/sizes. Both tiers together are
**938,210 encoded bytes**. All six medium sheets decode to **9,622,364 bytes**;
low sheets decode to **2,399,432 bytes**. The additional character grade canvas
is 147,456 bytes. No 3D engine is added to Chikun.

Native source `.blend` files, raw PNGs, render log, native receipt and reviewed
contact sheet are outside Git, in:

Final native loop source:
`C:/Users/just_/Documents/Codex/2026-09-29/you-are-taking-over-as-lead/outputs/chikun-obstacle-loops-20261002/`

Earlier still inspection:
`C:/Users/just_/Documents/Codex/2026-09-29/you-are-taking-over-as-lead/outputs/chikun-obstacle-kit-20261002/`

Reproducible producers are `scripts/chikun-blender/build-chikun-obstacle-kit.py`
and `pack-chikun-obstacle-kit.py`. Blender receives an explicit output folder;
pass `--loops` for the four eight-frame loops. The packer uses a common alpha
bounding box across every pose, keeping atlas pivots stable, and makes both
tiers plus local animated WebP previews.
No paid generation was used. First native attempt failed because a factory
empty scene has no World; fixed explicitly and both subsequent six-asset runs
completed. Final correction replaced regular canopy rows and tubular water
ribbons with irregular crowns and a continuous pleated water surface.

## Verification

- RED obstacle module import, then implemented loader/dispatch: 3 focused cases.
- RED shared audio-volume API, then shared master/fallback implementation.
- 26 focused audio, native-kit, existing eagle-loop/view and actual ground-host
  tests pass. Syntax checks pass for main, audio and obstacle kit.
- Tests cover immutable canonical obstacle snapshots, all six draw branches,
  decoded-memory/path validation, partial/late load disposal, legacy fallback
  mute and 0% volume, plus the unchanged eagle destination and cabinet boundary.
- Eleven additional facelift, simulation identity, look-ahead art and VFX cases
  pass (37 focused checks total); the identity check binds the current shared
  course/evidence/collision files to their existing immutable release receipt.
- Loop sampling RED→GREEN verifies 12 fps, wrap, sheet coordinates and reduced
  motion. Two character-light tests verify bounded tint/rim and that the retained
  source pose is not recoloured. Six existing character-sheet cases pass.
- Direct decoded-atlas inspection proves all runtime dimensions and SHA-256
  receipts, with eight distinct frames in each animated kind and tier. Native
  bakes ran under the shared lock with a bounded owned process and cleanup.
- Contact sheet inspected; combined built game desktop and phone browser
  verification is owned by root and must be recorded separately. This native
  evidence is not physical-phone acceptance or release certification.

## 2026-10-03 native facade follow-up

The next inspected gap was the large procedural building obstacle groups. A
read-only sample of 20 seeds across 480 slots each found 1,000 town-kind groups
out of 9,600 slots (10.4%); each contains three facades. The existing scenery's
urban geometry helpers were reused for authored towers, gables and striped shop
awnings. Nine native designs now replace town shops, city blocks and suburban
homes in the default runtime: three fixed designs per family, including bevelled
trim, recessed glass, shutters/siding, storefronts, warm interiors and integrated
native shop signage. These are static design variations, not animation loops.

Each design is projected to its existing committed shape rectangle. The stable
obstacle index selects the variation; tick and reduced motion never change it.
No course, collision, evidence, seed or RNG file changed. The existing lazy
obstacle kit handles the new assets, with the old renderer as its failure fallback.

Current complete kit totals supersede the initial six-asset figures above:

- 18 runtime WebPs / nine asset sheets across low and medium tiers.
- 1,064,452 encoded bytes total (the facade slice adds 126,242 bytes).
- 3,016,904 decoded bytes in the low phone tier, below 4 MiB.
- 12,103,772 decoded bytes in medium, below 12 MiB.
- Facade medium frames at most 192 × 384; low at most 96 × 192. Three designs
  share one atlas per family. Decoded inspection proves all three designs differ
  in every family and tier, after WebP compression.

Native sources, receipts, renders and inspected source/runtime contact sheet:
`C:\Users\just_\Documents\Codex\2026-09-29\you-are-taking-over-as-lead\outputs\chikun-building-kit-20261003`.
The bake ran under an owned shared heavy lock with a ten-minute process limit;
all nine renders completed, Blender exited and the lock was removed. Sources
remain outside Git; runtime WebPs use the existing LFS pattern. No paid generation.

Fourteen focused checks pass: facade bounds/stable variety/snapshot preservation,
runtime hashes and memory caps, retained native kit/loop behavior and immutable
course/evidence identity. Source/runtime contact sheet inspected. Combined browser
desktop/phone evidence and physical-device acceptance remain root-owned.

New source/test files for the syntax registry (owned by root for this slice):
`scripts/chikun-blender/build-chikun-building-kit.py`,
`scripts/chikun-blender/pack-chikun-building-kit.py`,
`tests/chikun-building-kit.test.mjs`.

## Remaining master-list scope

Procedural forest clusters, older small ground props, remaining bird
variants/extra animated kinds, owl behavior decision and
gamepad/haptics/shared feel remain outside this bounded delivery. Existing
39 native character clips and obstacle-family hit mappings were inspected;
final player acceptance of those deaths is still needed. Art acceptance,
actual phone performance and normal release checks still apply.
