# Chikun native sky art — 2026-10-03

## Delivered

The current default course's hawk, pelican and propeller plane now use refined
native 3D models baked to eight registered poses at 12 fps. The original native
body, camera/light and plane meshes were reused; the birds gained layered primary
and covert feathers, distinct plumage, bills, eyes, tail feathers and folded feet.
The pelican has a long bill and throat pouch. The plane gained enamel materials,
glass, propeller blades, wheel hubs, engine ports, rivets and a tail stripe.

The dynamic `sky-kit.mjs` loader downloads only one tier, caps decoded sheets at
1 MiB phone / 2 MiB full, bounds startup to twelve seconds, cancels late downloads
and releases owned images on failure/disposal. Phone selection overrides DPR.
Reduced motion freezes at pose zero. The actual `drawGroundObstacle` path uses
the same x/y/width/height destination as the old static sprite. Collision capsules,
course kinds, course seed/oscillation, evidence and scores are unchanged. There
is no new simulation or presentation randomness.

Successful native startup avoids fetching the three replaced static sprites.
Failure lazily loads only those three old sprites; remaining old ground/tree art
continues loading normally. The loader status is `#gameShell[data-sky-kit]`.
Existing preboot QA `paintObstacle` calls the actual combined renderer, including
these sheets. A projected obstacle gallery must be labelled presentation evidence,
not an organically played all-region run.

## Asset and memory measurements

Six runtime WebPs: 172,350 encoded bytes (phone 59,694; full 112,656).
Decoded sky sheets: phone 720,896 B; full 1,966,080 B. Bird frames are 128×64
phone / 192×96 full; plane frames 128×48 / 256×96. All sheets have four columns,
two rows, one common crop per actor and two-pixel transparent frame gutters.
Native poses stay inside the render bounds. All eight poses remain distinct after
WebP decoding at both tiers; receipts include file and decoded-pose SHA-256 hashes.

The obstacle subset resident estimate, including the earlier native obstacle/facade
kit, retained legacy ground sprites and the existing eagle atlas at its largest
high tier, is **7,151,136 B on phone** and **17,483,188 B at full quality**. This is
not total game memory: character animation sheets, ragdolls, region art, canvases,
browser decode buffers and audio are excluded. The three skipped static sprites
save 247,336 B decoded; net increase is 473,560 B phone / 1,718,744 B full. Actual
iPhone XS Max memory and frame-time acceptance remains open.

## Verification and evidence

Eighteen focused sky/native-kit/facade/eagle-loop checks passed. The five new checks
cover exact legacy draw bounds with immutable canonical snapshots, reduced motion,
phone/cap/path validation, late cancellation/failure cleanup, avoiding unused static
downloads, and shipped hashes/unique poses. No build or browser job was run by this
agent. Root owns combined desktop/phone review and normal release checks.

First bakes failed distinct-pose/framing checks: Blender was evaluating newly keyed
poses at frame one, and feathers exceeded the initial camera framing. Those failures
were corrected in the producer before the final atlas was admitted. Native jobs
ran under the shared owned lock with a ten-minute owned-process timeout; each
process exited, and the lock was released. Original source files were not written.
No paid generation or new sound effects were used.

Native derived `.blend` sources, PNG poses, immutable-source receipts and the
inspected actual-runtime contact sheet live outside Git at:
`C:\Users\just_\Documents\Codex\2026-09-29\you-are-taking-over-as-lead\outputs\chikun-sky-kit-20261003`.

Integration files: `apps/chikun/src/sky-kit.mjs`, `main.mjs`, `ground-world.mjs`,
`apps/portal/assets/generated/chikun-sky-kit-v1/`,
`scripts/chikun-blender/build-chikun-sky-kit.py`,
`scripts/chikun-blender/pack-chikun-sky-kit.py`, `tests/chikun-sky-kit.test.mjs`.
Root owns syntax registry and LFS-pattern integration.

Root added the syntax entries and runtime LFS pattern. Combined Chrome review
passed natural guest Free entry and sky-kit loading at desktop/phone sizes,
then inspected separately labelled runtime-painter views of all three actors.
No page errors; owned browser/server closure confirmed. Natural all-region
encounters, typed deaths and physical-phone performance remain open.

## Remaining art/content gaps

Procedural forest clusters; old static shiba, rock, log, thorn, hurdle and crate;
old static willow/cherry/maple/oak trees; final normal-play obstacle/death acceptance;
open owl behavior and shared gamepad/haptics/feel work. Eagle, drone, canopy, storm,
waterfall, pipe, pit lip, three facade families and the three sky actors above have
new native art, but this does not complete all master items 10/26.
