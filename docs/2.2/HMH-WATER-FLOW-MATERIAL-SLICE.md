# Existing-channel water material — October 3

Implemented locally; Chrome compiled the first material, but actual screenshots exposed an oversized bright caustic web and grey sky wash. That material was **not accepted**. A source-only corrective pass is frozen for fresh desktop/phone review. This bounded slice covers the existing Scrypt Bayou and Hashwood River channels. It does **not** create Silver Coast's missing sea, move banks, change navigation or introduce map-v3 rules.

The prior material had one global drift direction and faint depth/foam over procedural noise gradients. The existing shore texture now packs signed waterline distance in R and a local, shore-tangent current in G/B, with opaque alpha. Near banks the current follows the closest shoreline; open water blends back toward the district's authored drift. Its original signed-distance bytes are unchanged. No new GPU texture or downloaded/generated art was added.

The material uses crossed analytic wave normals, two staggered flow phases to bound displacement in long runs, shallow/deep absorption, directional specular, shallow-only refracted-light caustics, broken foam and wet-bank sheen. Bayou optics remain calmer than the faster river. The half tier and reduced-motion setting retain their existing frozen phase; the phone material still receives depth, normal lighting, foam and caustic detail. These are presentation changes only, with no simulation RNG, collision, score or evidence changes.

Measured on this development machine, median of five local shore-field builds:

| Existing channel | Tier | Shore texture | Existing GPU allocation | Temporary distance + flow arrays | Build time |
|---|---|---|---:|---:|---:|
| Bayou | Full | 77×514 | 158,312 B | 118,734 B | 9.919 ms |
| Bayou | Half | 39×257 | 40,092 B | 30,069 B | 2.550 ms |
| River | Full | 514×69 | 141,864 B | 106,398 B | 9.135 ms |
| River | Half | 257×35 | 35,980 B | 26,985 B | 2.461 ms |

GPU allocation is unchanged: the old grayscale field was already uploaded as RGBA. CPU construction now temporarily holds two more bytes per texel for flow; field arrays are discarded after texture creation. Ground/kit page budgets and residency remain unchanged. These local construction timings are **not** phone frame-time measurements.

Three RED tests reproduced missing flow channels, missing packed-channel upload and missing optics on the actual material uniform group. Final focused flow/terrain/renderer/binding/native checks passed **36/36**, including unchanged authored geometry, signed-depth parity, shore-current direction, speed-independent field data, opaque packed texture, disposal and frozen reduced-motion/tier behaviour. A legacy terrain fixture was updated to the actual Ridge atlas dimensions without weakening its production dimension guard. Module syntax and whitespace checks passed. New test: `tests/hmh-water-flow-material.test.mjs`; owning sources: `world-v2-area-surfaces.mjs` and the water setup in `world-v2-area-art.mjs`.

Remaining: actual shader compilation and normal-game screenshots in both channels, full-resolution desktop/phone art approval and measured phone frame time. Master item 5 also retains the separately versioned Coast sea, surf/beach geometry and authored bank kits. No paid generation, native bake, browser/build job, commit or deployment occurred in this subagent slice.

## Corrective optics pass after actual Chrome review

Reviewed `outputs/22-water-combat-sky/hmh-river-desktop.png` and `hmh-bayou-desktop.png` at original resolution. Caustics are now about 2.5 times finer, interrupted by a low-frequency patch mask, and fully fade by 62 world units from the bank (previously 125). Their maximum RGB light contribution is about one third of the first pass. Exponential depth absorption reaches 69% deeper palette at 80 units and 95% at 199; the grey sky blend drops from roughly 15% in deep flat water to 5%. Crossed ripples are moderately finer and directional specular is tighter (full exponent 96, half 56). Palettes, geometry, flow field, frozen motion policy and memory are unchanged.

One additional RED test reproduced the missing shallow/depth optical contract, then evaluated the actual scalar GLSL functions to require zero caustics by 65 units and predominantly deep colour at mid-channel. Combined focused suite now passes **37/37**. Corrective shader compilation and art acceptance still require the root's fresh browser capture; these numbers alone are not visual approval. Clear dry bank evidence entries are River `at:7000,11405` and Bayou `at:2615,11600`, validated against the runtime player's radius 24 and ground query.

Root's fresh combined Chrome job passed River/Bayou desktop and phone viewport
captures with no page errors, visible corrected optics, and owned resource
closure. The quieter shallow band and deeper palette were visually reviewed.
This accepts this material slice; it does not complete final bank art, Coast
sea, ten-area approval or physical-phone performance. Original first-pass
failure receipts remain beside the accepted captures.
