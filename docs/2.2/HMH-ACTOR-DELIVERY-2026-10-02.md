# HMH actor delivery — October 2, 2026 candidate

This bounded presentation slice makes the existing 3D library reachable from ordinary child URLs. It does not complete master-list item 1 or certify phone performance.

## Implemented

- Lazy actor controller now starts by default. Desktop defaults to medium (24 actors); phones default to low (8). High is an explicit desktop choice (64). `actor3dPilot=0` or `actor3dQuality=sprites` skips the optional chunk. Save-data / at most two reported CPU threads retains sprites unless explicitly opted in. Unsupported WebGL and decode/draw/context failures retain or restore sprites.
- Low-tier hero delivery now uses separate gzip GLBs with static embedded WebP textures. All four are below 1,500,000 downloaded bytes; exact original geometry, rig and all 80 clips remain intact. Bases are 512 px for Commando/Lester and 448 px for Lilly/Valkyrie, with 128 px normal/material maps. Medium/high retain existing at-most-1K source images. This is a texture/download tier, not a mesh LOD.
- The lazy downloader bounds both compressed reads and inflated output, validates the exact asset byte ledger, handles already HTTP-decompressed GLBs, cancels failed/aborted owned readers, and retries the original asset on unavailable/unsupported gzip. Missing WebP browser support retains the existing sprite fallback. The decoder validates static single-frame WebP dimensions before allocation and rejects extended/animated containers and unrelated required extensions.
- Existing library clips now project actual long-gun fire and reload progress, strafe and back-pedal movement, lever/button/valve interactions. Channel gestures use the operating clock rather than the sprite's clamped reach clock. Standing idle now reaches each hero's existing four fidgets; fidgets cannot replace reloads.
- A stale cover clip cannot override terminal death. Cover / mantle / drop / land and district-boss projections already existed and remain wired. All twelve exact enemy ids and all three district boss ids already had lazy model registration.

No simulation, input, randomness, collision, scores, evidence, versions, contracts or release files changed. Source GLBs and their historical export receipts remain unchanged.

## Verification

Three new behavioral cases first failed for the absent policy, absent event selector and missing strafing. The initial focused controller/model/library run passed 51 cases. Controller/delivery/projection/library/ten-area wiring passed 65 cases. The final controller/delivery/library rerun passed 37 cases after adding the full channel clock and reload/fidget guard. Main parses. The actual backend test witnesses 512 × 256 startup and late archetype decode for a 1024 × 512 source plus failure/late-load cleanup.

The derived asset cases initially failed because the decoder rejected WebP and the abort path had not canceled its reader. A malformed-container case also failed before tightening the single-frame header checks. The final focused delivery/download/controller/model run passes 47/47 cases. Four asset cases prove original source hashes unchanged, byte budgets/hash receipts, exact geometry/nodes/skins/clips, all 80 poses at three sampled clocks, and texture dimensions. Loader cases cover compressed and HTTP-decoded bytes, unsupported/corrupt/over-inflated asset fallback, and abort cleanup.

Root owns combined builds, real-browser review, visual gate and commits. Those were not run by this lane. Review ordinary no-query gameplay, real low-tier WebP decode for every hero, explicit sprite opt-out, long-gun reload/fire, tall/short cover, interactions, district bosses and context fallback before acceptance.

## Measured source composition

Bytes below count unique binary buffer views by category; remaining bytes include other buffer data/alignment.

| Hero | GLB total | Embedded PNGs | Geometry | Animation | JSON |
|---|---:|---:|---:|---:|---:|
| Lit Commando | 8,656,592 | 6,486,737 | 1,274,334 | 317,192 | 576,872 |
| Lilly | 8,415,092 | 5,648,677 | 1,902,842 | 335,228 | 526,760 |
| Lit Valkyrie | 8,888,720 | 6,251,408 | 1,830,002 | 312,580 | 493,268 |
| Lester Original | 8,278,220 | 5,872,115 | 1,678,442 | 304,232 | 421,972 |

All four contain 80 clips. The library has no dedicated `walk` clip. Mere clip availability does not mean every action is triggered in gameplay or final-quality deformation has been accepted.

The current decoder reads embedded uncompressed GLB after bounded transport inflation, allows `EXT_texture_webp` only, supports embedded PNG/static WebP and requires float32 position/normal/UV/weights. Meshopt-compressed exports cannot be dropped into this decoder unchanged.

## Accepted download budget, pending visual acceptance

| Hero | Low download | Inflated GLB | Base edge | Decoded RGBA texture bytes |
|---|---:|---:|---:|---:|
| Lit Commando | 1,175,798 | 2,465,332 | 512 | 4,718,592 |
| Lilly | 1,492,144 | 2,996,836 | 448 | 3,735,552 |
| Lit Valkyrie | 1,477,679 | 2,890,224 | 448 | 3,735,552 |
| Lester Original | 1,467,566 | 2,687,348 | 512 | 4,718,592 |

Total low hero download is 5,613,187 bytes, reducing individual downloads by 82–86%. The source textures are 22,020,096 decoded RGBA bytes per hero, so these assets reduce that allocation by 79–83%. These figures exclude GPU mipmaps, geometry, animation, other actors and renderer allocations; they do not establish total memory or FPS. Medium/high downloads remain the original assets. No paid generation or Blender pass was used. The narrow generator holds the shared heavy lock for its bounded CPU export; combined browser jobs remain root-owned.

The generator, runtime registry and `low/manifest.json` record source and derived hashes. `.glb.gz` binaries have a dedicated Git LFS pattern. Original source exports/receipts remain untouched. The cheapest remaining mesh path is selectively reducing bodies toward 8–12k triangles while protecting face, hair and identifying costume/gear, with independent deformation review; transport compression alone cannot reduce geometry work.

Still open: real-browser acceptance of the new low assets; mesh LODs; dedicated walking and other untriggered actions; hero/enemy/boss reference review; animation blending/quality; resident-model memory bounds; phone FPS/thermal/long-run proof; heavy-load scenarios; user-facing Graphics Quality controls; release acceptance. Do not close master-list item 1 on this receipt.

## Native movement and enemy delivery follow-ups

The committed movement follow-up selects the existing run-start/run-stop and standing turn-left/turn-right/pivot clips from observed locomotion. Combat, reloads, cover, traversal and directional strafe/back-pedal take priority; repeated ticks hold, clock rollback/long gaps reset, and fidgets cannot interrupt an accent. The controller/delivery/library suite passed 40/40. This adds no acceleration, walk-speed tier or turn penalty; item 11's new movement rules and dedicated walk remain open.

The next zero-asset delivery slice connects native enemy corpses from the existing death-marker map. Corpses use only quality slots left after the hero, bosses and living enemies. Only visible fully opaque bodies enter the depth pass. Unknown/unready models retain sprites; fading, retirement, disposal, context loss and drawing failures restore the originals. The established 24-corpse cap, two-second lifetime, last-200-ms fade, death facing and clocks remain unchanged. This reuses existing death clips rather than exporting new bodies or consuming credits.

Ordinary enemy hit playback now traverses the existing normalized one-second clip during its six-tick hit window. Previously `/60` reached only the first tenth of the recoil. Tell/attack clocks and their precedence remain unchanged, as do all damage and knockback rules.

Four new cases first failed for truncated hit playback, missing corpse selection and missing sprite restoration. The final actor controller/delivery/library run passes 44/44; existing corpse, enemy production, creature and render-pass regressions pass 20/20, including old render-loop equivalence and stalled-simulation corpse expiry. Main parses and owned whitespace checks pass. Root still owns combined real-game acceptance, frame-time measurement and release checks. New native death variants and enemy stagger exports remain open; no new animation asset was authored in this slice.

For real-browser acceptance, `evidenceSafe=1&telemetry=1` additionally publishes `actor3dCorpseCount` and `actor3dHitCount`. Counts reflect only successful native frame rows after readiness filtering and reset on fallback; they do not count sprite-only corpse markers or unready hit models. Startup reads already initialized URL parameters directly to avoid the later telemetry flag's temporal dead zone. The new ownership case first failed for absent counts, then the controller/delivery suite passed 34/34.

Lead browser follow-up: all four optimized low hero downloads were previously
checked at the phone viewport, with no classic-asset fallback. Native enemy
hit rows were observed in the existing full-health pressure scene; ordinary
Free play separately showed native corpse playback and sprite fade handoff.
The first combined checker overconstrained crowded scenes by requiring spare
corpse slots, and stationary roster mode disables automatic fire. Original
failed receipts remain intact; `outputs/22-hmh-second/animation-observations.json`
records the independent observations. These are delivery checks, not acceptance
of final enemy animation quality, new clip sets, frame time or physical-phone
performance. Latest combined source regressions pass 88/88.

## Native hero transition polish (2026-10-03, candidate)

The four hero exports contain 80 authored clips each, including start/stop,
strafe, back-pedal, turn/pivot, cover, interaction and four identity-specific
fidgets. They do not contain a dedicated walk clip. Ordinary enemies still
have six clips and one death; district bosses have ten, including stagger and
supers. This slice adds no new clips or procedural substitute poses.

The native renderer now crossfades between eligible hero poses using the
authored blend metadata (2–6 ticks in the selected clips; native idle/aim/run
use four ticks). It interpolates local joint translation/scale and shortest-path
quaternion rotation before evaluating the skin, avoiding shrinking limbs from
matrix interpolation. Retargeting snapshots the currently drawn pose. One
absolute presentation tick travels through the existing hero render input;
repeated paused ticks freeze blending, and rollback or gaps above 30 ticks
reset directly to the selected pose. Hurt, death, dash, melee, grenade and all
fire/contact clips interrupt immediately. Enemy/boss pose timing is unchanged.

Only the hero allocates a transition snapshot, once per display: 1,200 bytes
of typed transform storage for Commando/Valkyrie/Lester, 1,280 for Lilly,
plus small node/state wrappers. Crossfade sampling adds no per-frame arrays
or model/texture downloads. Snapshot references release with the display;
existing fallback, disposal and context-loss ownership remain intact.

Validation: new behavior tests first failed, then 67/67 focused model,
projection, controller and hero-library regressions passed. The final contact
priority addition passed its six targeted cases. Native model pose receipts,
bounds, exact asset identity and ownership tests remain green. Browser visual
acceptance and performance measurements belong to the lead's combined pass;
neither is claimed here. Movement acceleration and a true walk tier remain
separate versioned gameplay work, as do authored enemy death variations.

## Actual low mesh LOD (2026-10-03, textured runtime silhouettes reviewed)

The low tier now has genuinely reduced skinned geometry, retaining the existing
low WebP texture sizes. Medium/high retain the classic GLBs byte-for-byte.

| Hero | Classic → low triangles | Classic → low vertices | Low download | Classic → low GPU geometry buffer bytes |
|---|---:|---:|---:|---:|
| Commando | 25,891 → 12,531 | 21,519 → 12,441 | 842,649 | 1,876,866 → 1,070,466 |
| Lilly | 27,496 → 13,396 | 25,645 → 14,789 | 1,014,100 | 2,216,576 → 1,263,496 |
| Valkyrie | 27,494 → 13,398 | 24,574 → 14,294 | 1,008,380 | 2,130,884 → 1,223,908 |
| Lester | 27,496 → 13,396 | 22,345 → 12,625 | 1,003,338 | 1,952,576 → 1,090,376 |

These are typed attribute/index buffer sums, including the renderer's tangent
buffer, not total GPU memory or measured FPS. Texture RGBA allocations remain
4,718,592 bytes for Commando/Lester and 3,735,552 for Lilly/Valkyrie, before
mipmaps. The four low downloads total 3,868,467 bytes. No new paid assets.

The native scratch exporter imports the accepted GLB with equivalent vertices
welded, preserving corner UVs/normals. It protects head/hand skin regions and
animated extrema measured from all 80 clips at five sample times. Protected
vertices must still match the source coordinates within 0.00001 metres after
import. Lower bodies target 3k triangles; torso/head 6k Commando/7k others.
Small held/released grenade meshes are retained verbatim. Geometry is repacked
into the original nodes, skin/inverse binds and animation binary streams;
scratch Blender animations/bone transforms are never adopted.

Failures were caught before publication: initial masks selected collapses
rather than protecting vertices, and disconnected GLB split vertices made
some reduced bodies visibly fragmented despite acceptable bounds. Inverted
protection masks, animated-extrema protection and welded import fixed those
issues. Tiny grenade reductions failed their strict silhouette checks, so
those original meshes were preserved instead of loosening the gate.

The existing runtime CPU preview now accepts an alternate asset and output.
Side-by-side idle/run/short-cover sheets were inspected for all four heroes;
the corrected low silhouettes retain gear, long coat, hair and mascot head.
These flat-shaded untextured sheets prove shape only. Root subsequently checked
all four actual low downloads and textured silhouettes in desktop and phone
viewports, with ready actor status and no page errors. Recognizable gear,
coat, hair and head remain intact. This accepts the reduced-geometry slice;
full clip/face/material polish and physical-device performance remain open.

Tests: 11/11 download/LOD cases pass, with genuinely reduced triangle/vertex
counts, exact original node/skin/80 animation tracks and sampled palettes,
four normalized influences, finite UVs/unit normals, and per-mesh animated
bounds within 3.5% of source scale at five times per clip. All source hashes
are unchanged. Download corruption/abort/classic fallback checks still pass.
The complete asset set and lazy registry were published together only after
scratch integrity checks; the texture-only generator now refuses to overwrite
an active mesh LOD.

Regeneration (native work under the shared heavy lock): run
`scripts/hmh-actor-low-mesh-protection.mjs`; for each hero run Blender with
`scripts/hmh-blender/build-hmh-low-mesh.py -- --hero <id>`, then bundled Python
`scripts/optimize-hmh-actor-mesh-tier.py --hero <id>`. Test the scratch directory
with `HMH_LOW_MESH_DIR=.tmp/hmh-low-mesh`, inspect the alternate-asset preview,
then publish all four together with the mesh-tier script's `--publish`.
Repacking reconstructs the texture input from the unchanged classic asset,
so a later run never measures or simplifies an already reduced low tier.
# Boss offscreen warning — 2026-10-03

Master item 8 now has a lazy screen-space warning for an active boss wholly outside the actual viewport and, with priority, an unseen **locked charge origin** during its existing tell. The filled human/bolt icon, directional arrow, countdown and clock ring read authoritative pending attack geometry/ticks; they do not move the camera, modify aim, spawn anything, or change damage/RNG/evidence. Union geometry is bounded to four nested levels and sixteen children; at most 32 pending attacks are inspected. A real partially visible body does not claim to be offscreen. Resolved tells disappear immediately. Reduced motion adds no pulsing or autonomous motion; the informational clock advances only with existing simulation ticks and freezes with pause.

The label/icon footprint reserves 50px around a measured HUD/touch safe rectangle. HUD/control/browser-chrome measurements occur at most once per simulation second or on resize/restart; short fully occluded viewports suppress the warning. The desktop objective band keeps a 96px bottom reserve. Warning reset, death, boss withdrawal and disposal clear ownership. Accessibility announces each warning rather than every countdown frame. Telemetry exposes only `bossEdgeWarningStatus` and `bossEdgeWarningProgress` under existing evidence/debug gating; no runtime debug object is published.

**Full dual-body boss camera framing remains open.** Actual `InputState.snapshot` maps the pointer through the same render camera (`screenToGround`); moving/zooming it changes the next shot direction. Reproduced at 414×896, hero (1000,1000), pointer (300,350): baseline camera (1000,1000), zoom .9 yields aim (.6884,-.7254); midpoint camera (1120,1000), zoom .65 yields (.8676,-.4972). Keeping a separate legacy input camera preserves aim but projects that world target at (196.17,377.22), visibly missing the cursor. That workaround was rejected. With 600 world units of horizontal separation plus hero/boss extents, a 414px viewport cannot retain the current approximately 72px mobile hero and show both complete bodies. A later camera design requires explicitly accepted input semantics or a separately versioned encounter-distance change. This warning improves the unseen-origin tell; it does not claim the requested always-visible boss body is complete.

Validation: new warning tests first failed on the absent module, then 9/9 passed, including real Pixi compiled polygon shapes (plain reusable numeric arrays, not typed-array instructions), locked origin/countdown, actual body visibility, bounded safe geometry, unchanged input/state, paused reduced-motion drawing, DOM extent cache, reset/disposal. Warning + existing input/world-space suites: **61/61 pass**. Syntax checks pass. Source module 8,082 bytes; standalone esbuild-minified 4,458 bytes / gzip 2,242 bytes (measurement only, actual combined initial/chunk budgets remain the parent build's authority). No art download or native job. Root inspected the actual Baron-court boss warning at desktop and phone viewports, with no page errors and HUD/touch clearance. A natural charge countdown capture remains open; physical iPhone performance remains unproven. Evidence: root `outputs/22-forest-lod-cover-routes/boss-edge-*` and focused receipt.
