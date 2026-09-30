# ART — HD prop kit (both Tripo batches re-rendered at 512/768 px)

2026-09-30. World-art lane, branch `claude/200-world-art`. Projection-only art. No consumer, map, collision, navigation, simulation, version, service-worker or Ranked change. No paid asset generation: every frame is a Blender re-render of a model the owner already holds on disk. **Art acceptance is not claimed**; this is a candidate kit for the area-dressing wave.

## Problem

Woods/Meadows camp and building cards come from the shipped 256 px package (`apps/portal/assets/generated/hmh-reboot-tripo-props/`) and go visibly soft at roughly 300 px display size. The level-design batch (bridges, roads, vehicles, buildings, farm/forest props, IDs 41–80) was never rendered into the repository, so nine of ten areas had no dressing kit.

## What was rendered

Both owner delivery catalogs, read-only, hash-checked before and after every render:

| Batch | Source root (delivery GLBs, not raw `models/`) | Catalog SHA-256 | Models |
| --- | --- | --- | --- |
| `b1` | `C:\Users\just_\Desktop\Projects\LestersArcade-Assets\Tripo-Environment-Powerups\delivery\HMH-3D-Models` | `a3b8ac5646d59591055e7e817b0f7aeee51c81add32dd917ca6ae3db8b50ddb2` | 56 (IDs 01–56) |
| `b2` | `C:\Users\just_\Desktop\Projects\LestersArcade-Assets\Tripo-Level-Design-Batch-2\delivery\HMH-Level-Design-Batch-2-Models` | `10a211fe3f387f7c7024031c059cd731511c30f971f1b3f40dad96866c675edb` | 40 (IDs 41–80) |

Batch 2 uses the owner's *delivery* GLBs because that pack is where the owner's own corrections live (51 gantry two-sided material, 71 willow supplemental canopy); the raw provider files under `models/` are recorded per item as `sourceRawGlbSha256`.

Camera contract is identical to the 256 px package: Blender EEVEE, orthographic, 45° pitch around +X, 78% occupancy, film transparent, original materials, one static frame, the same three-light rig, and the same batch-1 yaw overrides (12, 13, 18, 20, 27, 33, 41, 44, 45, 52, 56 at 90°). Render frames are **512 px** for plants, props/vehicles and pickups and **768 px** for large structures and bridges (batch 1: 11–15, 43, 46–48, 51, 52, 56; batch 2: 41–46, 50, 62–69, 76, 77). The 256 px package is untouched; its producer hashes and adoption gate still pass.

Blender 5.1.2 (ec6e62d40fa9, 2026-05-19), one fresh `--factory-startup --disable-autoexec` process per model and per pass. Two passes (A/B) per model; 94 of 96 decode bit-identically. The two owner-corrected batch-2 models (51, 71) carry overlapping coplanar surfaces whose z-fight resolves differently per GPU pass; they are accepted under a recorded sub-perceptual tolerance (≤64 differing pixels, peak channel delta ≤8; measured 13 px/Δ7 and 45 px/Δ4) with the counts written into their receipts.

**Result: 96 rendered, 96 accepted (84 ok, 12 fixed), 0 rejected.**

## Package

`apps/portal/assets/generated/hmh-reboot-tripo-props-hd/` — manifest `hmh-tripo-props-hd.json` (pipeline `hmh-tripo-static-props-hd/v1`, `classification: native-render-hd-candidate`, `artAccepted: false`, `canonicalAdoption: false`).

Pages are 2048×2048 lossless exact WebP (same encoding as the shipped package) grouped by class, each with a `@0.5x` variant (frame-isolated premultiplied Lanczos 2:1, WebP quality 90 / lossless alpha, the same recipe as `build-hmh-mobile-half-res.py`). Frames are trimmed to their painted alpha bounds plus a 2 px margin and kept even-aligned so the half page never bleeds between neighbours.

| Page | Class | Items | Encoded bytes | Decoded bytes (w×h×4) | @0.5x encoded | @0.5x decoded |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `tripo-props-hd-plants-00.webp` | plants | 21 | 1,676,832 | 16,777,216 | 222,840 | 4,194,304 |
| `tripo-props-hd-props-00.webp` | props | 26 | 2,093,182 | 16,777,216 | 201,074 | 4,194,304 |
| `tripo-props-hd-structures-00.webp` | structures | 15 | 2,812,414 | 16,777,216 | 222,970 | 4,194,304 |
| `tripo-props-hd-structures-01.webp` | structures | 14 | 2,400,884 | 16,777,216 | 190,830 | 4,194,304 |
| `tripo-props-hd-pickups-00.webp` | pickups | 20 | 1,636,718 | 16,777,216 | 142,080 | 4,194,304 |
| **Total** | | **96** | **10,620,030** | **83,886,080** | **979,794** | **20,971,520** |

Total package on disk (pages + half pages + manifest): 11,816,259 bytes. No `items/` directory: a single card is a Pixi texture frame on its class page.

### Class → page map

Every class fits in at most two pages, so an area loads only the classes it dresses with (a typical area: plants + props + one structures page = three pages, 50,331,648 decoded bytes at full resolution, a quarter of that on phones).

| Class | Render frame | Pages | Items per page |
| --- | --- | ---: | --- |
| plants | 512 px | 1 | `tripo-props-hd-plants-00.webp`: b1-01, b1-02, b1-03, b1-04, b1-05, b1-06, b1-07, b1-08, b1-09, b1-10, b1-49, b1-50, b1-53, b1-54, b1-55, b2-70, b2-71, b2-72, b2-73, b2-74, b2-75 |
| props | 512 px | 1 | `tripo-props-hd-props-00.webp`: b1-16, b1-17, b1-18, b1-19, b1-20, b1-41, b1-42, b1-44, b1-45, b2-47, b2-48, b2-49, b2-51, b2-52, b2-53, b2-54, b2-55, b2-56, b2-57, b2-58, b2-59, b2-60, b2-61, b2-78, b2-79, b2-80 |
| structures | 768 px | 2 | `tripo-props-hd-structures-00.webp`: b1-12, b1-14, b1-15, b1-43, b1-46, b1-47, b1-51, b1-52, b1-56, b2-42, b2-43, b2-44, b2-45, b2-50, b2-62; `tripo-props-hd-structures-01.webp`: b1-11, b1-13, b1-48, b2-41, b2-46, b2-63, b2-64, b2-65, b2-66, b2-67, b2-68, b2-69, b2-76, b2-77 |
| pickups | 512 px | 1 | `tripo-props-hd-pickups-00.webp`: b1-21, b1-22, b1-23, b1-24, b1-25, b1-26, b1-27, b1-28, b1-29, b1-30, b1-31, b1-32, b1-33, b1-34, b1-35, b1-36, b1-37, b1-38, b1-39, b1-40 |

### Per-item metadata

`items[]`: `assetId` (`b1-NN`/`b2-NN`), batch/source IDs and names, `class`, `frameSize`, `page`/`pageImage`, `frame` (trimmed rect on the page), `renderFrame` (render size, trim offset, model-derived pivot), `anchor` (normalized in the frame), `groundAnchorPixels`, `groundAnchorMethod`, `alphaBounds` (relative to the frame), `groundFootprintPixels` (projected corners of the bounding-box base at ground level — new base-contact metadata), `modelDimensions`, `cameraYawDegrees`, `sourceModelSha256`, `sourceRawGlbSha256`, `renderFileSha256`, `sourcePixelSha256`, `materialConcerns`, `review`, `runtimeApproved: false`.

## Review

Labelled contact sheets (one per page, red cross = ground pivot, cyan = base footprint) are under `docs/2.0/receipts/tripo-props-hd-20260930/` with `review.json` (every one of the 96 items has an entry), `render-receipts.json` (per item: source SHA-256 before/after, render-request hash, A and B render-file hashes, A/B comparison, closed-log hashes, Blender identity, producer script hashes) and `pack-summary.json`. All five sheets were inspected at full 2048 px for facing, base contact, clipped bases, missing/black textures and transparent-hole artifacts. No black or missing textures, clipped bases or hole artifacts were found (the renderer refuses any frame that touches an edge).

Fixed items:

| Item | Name | Yaw | Pivot fix | Reason |
| --- | --- | ---: | --- | --- |
| b1-31 | 31 - Proof Of Work | - | painted-base | Mesh bounds include invisible geometry below the painted model, so the model-derived ground pivot floated below the visible base; pivot y snapped to the painted base (groundAnchorMethod painted-base-review-fix). |
| b2-43 | B2-43 - Steel Truss Bridge Span | 90 | - | Steel truss span is modelled along X while the other bridges span along Y; re-rendered at yaw 90 so its span and visible deck match b2-41/42/44. |
| b2-48 | B2-48 - Road Guardrail Section | 90 | - | Source rendered end-on at the default yaw 0 (long axis along the camera depth); re-rendered at yaw 90 so the side profile reads on screen. |
| b2-51 | B2-51 - Road Sign Gantry | 90 | - | Source rendered end-on at the default yaw 0 (long axis along the camera depth); re-rendered at yaw 90 so the side profile reads on screen. A/B passes are non-exact within the recorded sub-perceptual tolerance (13 px, peak channel delta 7) from z-fighting on the owner-corrected two-sided sign panels; accepted at tolerance. |
| b2-52 | B2-52 - Traffic Light Mast | - | painted-base | Mesh bounds include invisible geometry below the painted model, so the model-derived ground pivot floated below the visible base; pivot y snapped to the painted base (groundAnchorMethod painted-base-review-fix). |
| b2-53 | B2-53 - Bus Shelter | 180 | - | Default yaw showed the closed back panel; re-rendered at yaw 180 so the open side with the bench faces the camera. |
| b2-55 | B2-55 - Overturned School Bus | 90 | - | Source rendered end-on at the default yaw 0 (long axis along the camera depth); re-rendered at yaw 90 so the side profile reads on screen. |
| b2-59 | B2-59 - Tracked Excavator | 90 | - | Source rendered end-on at the default yaw 0 (long axis along the camera depth); re-rendered at yaw 90 so the side profile reads on screen. |
| b2-61 | B2-61 - Abandoned Motorcycle | 90 | - | Source rendered end-on at the default yaw 0 (long axis along the camera depth); re-rendered at yaw 90 so the side profile reads on screen. |
| b2-71 | B2-71 - Weeping Willow | - | - | A/B passes are non-exact within the recorded sub-perceptual tolerance (45 px, peak channel delta 4) from z-fighting between the owner-added supplemental canopy and the original leaf surfaces; accepted at tolerance. Facing and grounding read correctly. |
| b2-75 | B2-75 - Hedgerow Section | 90 | - | Source rendered end-on at the default yaw 0 (long axis along the camera depth); re-rendered at yaw 90 so the side profile reads on screen. |
| b2-77 | B2-77 - Collapsed Mine Entrance | 180 | - | Default yaw showed the rubble back of the mound; re-rendered at yaw 180 so the timbered (intentionally blocked) portal faces the camera. |

Rejected: none.

Caveats seen in review, left as-is: b2-77's portal interior renders dark (unlit cavity, not a missing texture); b2-64 (fuel canopy) and b2-66 (bunker) read mostly as roof mass from this pitch; b2-45's rear is capped in the source (owner note). Bridges 41/42/43/44 all span vertically on screen with the deck visible; the pipeline's per-item `--yaw` can produce the other axis when the dressing wave needs it.

## Regeneration

```bash
PY="/c/Users/just_/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
W=/path/to/work   # outside the repo; holds raw A/B PNGs, reports, logs and per-item receipts
"$PY" -B -X utf8 scripts/run-hmh-tripo-props-hd.py render --work "$W" --blender D:/Apps/Blender/blender.exe
"$PY" -B -X utf8 scripts/run-hmh-tripo-props-hd.py render --work "$W" --blender D:/Apps/Blender/blender.exe --replace \
  --ids b2-43 b2-48 b2-51 b2-55 b2-59 b2-61 b2-75 b2-53 b2-77 \
  --yaw b2-43=90 --yaw b2-48=90 --yaw b2-51=90 --yaw b2-55=90 --yaw b2-59=90 --yaw b2-61=90 --yaw b2-75=90 --yaw b2-53=180 --yaw b2-77=180
rm -rf apps/portal/assets/generated/hmh-reboot-tripo-props-hd
"$PY" -B -X utf8 scripts/run-hmh-tripo-props-hd.py pack --work "$W" \
  --package apps/portal/assets/generated/hmh-reboot-tripo-props-hd \
  --receipts docs/2.0/receipts/tripo-props-hd-20260930 \
  --review docs/2.0/receipts/tripo-props-hd-20260930/review.json
node --test tests/hmh-tripo-props-hd-package.test.mjs
```

Rendering is a heavy job: take `lesters-arcade-wt/.locks/heavy.lock` first. The default source roots are the two owner delivery folders; the scripts never write there.

## Gate

`node --test tests/hmh-tripo-props-hd-package.test.mjs` — 6 tests: manifest identity; every page file exists, hashes match, WebP header dimensions match, encoded bytes equal file size and decoded bytes equal w×h×4 (full and @0.5x); class grouping with ≤2 pages per class; every rectangle inside its page, even-aligned, non-overlapping, pivot/anchor/alpha consistent; accepted + rejected = both rosters exactly once and review.json agrees; receipts and contact sheets bound by hash. No browser. Existing `tripo-props` tests (35) still pass; `node scripts/syntax-check.mjs` passes.

## Not done here

Woods/Meadows consumers still read the 256 px package (area dressing is the next wave). No build, browser smoke or `visual:reboot` was run in this lane, no version or service-worker marker changed, nothing pushed. Owner art acceptance, footprint calibration against the 40-unit metre, and the per-area residency budget remain open.
