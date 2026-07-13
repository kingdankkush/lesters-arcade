---
name: hmh-atlas-packager
description: Use when consolidating Hard Money Heroes loose runtime frames into browser-safe atlases while preserving manifest coverage and visual output.
version: 1.0.0
license: MIT
---

# HMH Atlas Packager

## Trigger
Use when a frame-heavy runtime pack threatens repository, request-count, preload, or CDN budgets.

## Workflow
1. Build a disk-truth list from the imported runtime manifest. Never infer live coverage from folder names alone.
2. Back up loose sources to `~/lesters-arcade-vault/` before destructive cleanup.
3. Deduplicate exact hashes within an actor/pack.
4. Pack into lazy-loadable pages no larger than 4096×4096. Keep actors or coherent runtime groups together so one entity does not load unrelated textures.
5. Emit string frame references with atlas URL and validated crop metadata. Preserve state, direction, order, dimensions, and provenance.
6. Add runtime crop support before removing loose files. Keep a compatibility path for non-atlas refs.
7. Verify every atlas crop against the source RGBA pixels before deletion.
8. Move source frames to the vault, remove only verified tracked duplicates, and regenerate repo-health evidence.

## Pitfalls
- Do not create one global atlas that forces hundreds of megabytes into GPU memory.
- Do not weaken file/byte thresholds.
- Do not leave manifests pointing at removed PNGs.
- Do not run CPU-heavy packing during performance-soak measurement.

## Verification
- Run atlas parser/manifest tests, actor coverage tests, `npm run build`, and `npm run visual:regression`.
- Compare source/atlas crop hashes.
- Run `npm run repo:health:strict` and `npm run ship:gate`.
