# Chikun native ground-obstacle replacement — October 3

Actual desktop/phone viewport review accepts this bounded rock, log, thorn and crate replacement. Hurdle/Shiba are delivered separately in the loop slice; ground trees remain open. Course versions, collision shapes, obstacle generation, RNG, timing, scores, replay and evidence were not changed.

The existing runtime WebPs were inspected at original resolution: a smooth pebble-shaped rock, striped cylinder log, straight briars with oversized pale cones, and a plain plank crate. The four original native Blender files in `apps/chikun/assets/source/ground-sky/` were reused read-only. Each original SHA was checked unchanged after refinement. Derived native scenes and PNGs live outside Git at `outputs/chikun-ground-obstacle-kit-20261003/`; originals were not overwritten.

The refined rock has an irregular fractured silhouette, a darker cleft and small foot fragments. The log has textured bark, uneven furrows, a broken branch, side knot, end-growth rings and a split. Briars have curved woody stems, pointed folded leaves and smaller sharp hooks. The crate has fitted lips, timber braces, rivets, plank splits and material variation. Native modelling and lighting carry the detail; no paid generation or downloaded art was used. The native atlas was inspected, but that inspection does not replace actual game screenshots at the canonical drawn scale.

| Tier | Atlas | Encoded | Decoded |
|---|---:|---:|---:|
| Phone low | 512×256 | 57,758 B | 524,288 B |
| Desktop medium | 1024×512 | 146,698 B | 2,097,152 B |

The four static frames share one alpha page per tier. The optional loader strictly validates the local file identity and exact bounded dimensions. The phone uses low independently of DPR. It is lazy, releases the image on disposal/failure/cancellation and loads the old four fallback images only if the new kit fails. Successful startup avoids duplicate old rock/log/thorn/crate textures. Existing sky and larger obstacle-kit ownership remains separate.

Aggregate native pages, including the existing obstacle/building kit and new sky kit: **4,262,088 B low**, **16,167,004 B medium**. This is the sum of these three native kits, not the entire game: region scenery, character sheets, trees, other legacy props and transient browser allocations also consume memory. The new ground page contributes exactly 0.5 MiB low or 2 MiB medium. Physical-phone memory and frame time remain unverified.

The painter uses the exact old destination rectangle `[x, 690-height, width, height]`. Canonical rock/log/thorn/crate widths remain 76/112/100/78 and heights 50/48/64/76. Static frames do not change with tick, replay seek or reduced-motion state. The old simulation and course modules were untouched; the ordinary fallback and ground coin path remain available. The real renderer-review seam receives the same kit owner as ordinary gameplay.

Tests began RED for missing painter wiring, then passed **30/30** across ground/sky/native obstacle painters, host forwarding, simulation identity and v5/v6 replay evidence suites. Coverage includes exact crop/destination rectangles, immutable snapshots, static time behaviour, strict tier bounds, safe paths, downloaded-image cleanup, recorded native hashes, fallback ownership and lazy shell wiring. Module/Python syntax and whitespace checks passed. No tests depend on Git or external native sources.

Native Blender PID 49664 and packer PID 35296 both exited 0. The token-owned shared heavy lock was released after their exact closure. No browser, build, commit or deployment occurred in this lane.

Files: `ground-obstacle-kit.mjs`, limited optional painter/lifecycle changes in Chikun `ground-world.mjs` and `main.mjs`, `build-chikun-ground-obstacle-kit.py`, `pack-chikun-ground-obstacle-kit.py`, `tests/chikun-ground-obstacle-kit.test.mjs`, and `chikun-ground-obstacle-kit-v1/` runtime pages/manifest. `.gitattributes` adds LFS coverage for these WebPs. Root owns syntax registry and progress reconciliation.

Root reviewed actual desktop/phone natural Free entry with `shell.dataset.groundObstacleKit === 'ready'` and the four canonical runtime painters in a labelled gallery, with no page errors. The later six-prop gallery includes the separate Shiba/hurdle loops; its phone review overlay stretches vertically and is not a natural all-region encounter. Physical-phone frame-time/memory, ground-tree upgrades and broader Chikun course/world work remain open. Evidence: root `outputs/22-forest-lod-cover-routes/`, timestamped 26-scene and focused receipts. This does not complete all Chikun obstacles or the overhaul.
