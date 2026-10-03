# Chikun Shiba and hurdle native loop slice — 2026-10-03

Candidate reviewed in actual Chrome desktop/phone viewports. This replaces two old ground prop painters; it does not close all of master item 10 or certify the release.

## Delivered

- Reuses original `apps/chikun/assets/source/ground-sky/shiba.blend` and `hurdle.blend` read-only. Derived native sources and sixteen registered PNG poses live outside Git in `C:/Users/just_/Documents/Codex/2026-09-29/you-are-taking-over-as-lead/outputs/chikun-ground-loop-kit-20261003/`.
- Shiba retains its original amber/cream shape, curl tail and pointed ears. Refined facial planes, inner ears, eye highlight and shoulder tufts; eight cosmetic tail/ear/breath poses at 12 fps.
- Hurdle gets fitted foot shoes, fastening bolts, clamps, powder-coated metal and safety enamel. Eight loose hazard-wrap poses; rigid bar/legs remain fixed.
- Separate sixteen-frame alpha page; existing accepted four-prop atlas stays unchanged. Reduced motion freezes frame zero. Draw bounds, Shiba's existing bounce and label, coin painting, course, collision, randomness and evidence remain unchanged.
- Lazy one-page owner validates identities/dimensions; handles failure, timeout, disposal and late decode. Successful loading skips the two old copies; failure requests only those two old assets.

## Budget

| Tier | Atlas | Encoded bytes | Decoded bytes |
|---|---|---:|---:|
| Phone/low | 1024 × 128 | 51,614 | 524,288 |
| Desktop/medium | 2048 × 256 | 119,972 | 2,097,152 |

Frames: 128 × 64 low, 256 × 128 medium; eight columns, two rows. Aggregate native building/obstacle + sky + four ground props + these loops: **4,786,376 B low**, **18,264,156 B medium** decoded. This is not whole-game texture memory: it excludes region/character/tree art and any remaining fallbacks.

## Verification and limitations

- RED first: new behavior suite failed because no loop owner existed. After implementation, canonical draw bounds, snapshot nonmutation, all eight frame selections, reduced motion, unsafe metadata and cleanup pass.
- Native packer independently decodes both WebPs and requires eight unique compressed-frame hashes per prop; all poses fit a common crop without clipping. Runtime files and hashes match receipts; original sources unchanged.
- Combined focused replay/identity/art suites **34/34 pass**, followed by the added shell ownership/fallback test, **5/5 loop suite pass**. Three modified/new runtime modules pass syntax; both new Python scripts pass AST; focused whitespace check passes.
- Initial scratch bake rejected by framing gate due to stale transforms on the new inner-ear pieces; fixed by evaluating transforms before capture. No rejected frame was packaged.
- Final Blender PID **40352** and packer PID **42376** closed exit 0; owned heavy lock released after closure. Prior failed scratch children **51092/47432** also closed, and their lock was released. No native job remains.
- Contact sheet inspected at full resolution: `outputs/chikun-ground-loop-kit-20261003/loop-contact-sheet.png`. Actual game framing/animation and combined quality acceptance remain the root review's responsibility.
- Native poses are baked cosmetic loops, not a new gameplay animation rig. New owl/course rules, real-phone soak/performance and remaining master scope stay open.

Root follow-up: actual natural Free entry loads the loop owner (`groundLoopKit=ready`) at both viewports without page errors. Both props were inspected through the actual canonical runtime painter in a labelled gallery. All eight frame selections/unique native pose hashes are tested; the gallery capture is still-image projection evidence, not an all-region natural animation playthrough. Its phone overlay stretches vertically; natural gameplay is captured separately. Accepted bounded model/material improvement; physical-phone performance and full Chikun quality remain open.

New syntax registry entries: `scripts/chikun-blender/build-chikun-ground-loop-kit.py`, `scripts/chikun-blender/pack-chikun-ground-loop-kit.py`, and `apps/chikun/src/ground-loop-kit.mjs`. Runtime WebPs use the new LFS pattern in `.gitattributes`.
