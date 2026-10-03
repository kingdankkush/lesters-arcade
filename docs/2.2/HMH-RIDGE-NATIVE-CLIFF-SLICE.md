# Ledger Ridge native cliff kit — October 3

Implemented and desktop/phone-viewport reviewed in the local 2.2 candidate. Physical-device and release acceptance remain pending.

The existing world-v2 cliff renderer used a single 512×128 procedural rock-face strip, mirrored vertically every 110 world units and blended horizontally. The supplied Ridge reference shows broad fractured strata, a grounded cap edge and loose rubble at the foot. This bounded slice dresses **Ledger Ridge only** with four native fractured-face bakes, a cap-lip strip and loose-rock footing.

Source: `C:/Users/just_/Desktop/Projects/LestersArcade-Assets/Tripo-Environment-Powerups/native/42/42 - Stylized Layered Sandstone Rock Formation - Textured Master.blend`. The generator imports its packed colour image into a separate native scene, neutralises the source's red hue toward Ridge grey/ochre, and builds asymmetric fractured geometry. It does not claim that the original sandstone mesh itself is a continuous cliff kit. The archive is read-only and its SHA-256 stayed `968188146c68601fa4753d8c60f349e243ae31d672b4b3e93fbe6d8c4dececa1`.

`scripts/build-hmh-ridge-cliff-kit.py` creates six reconstructible native scenes and source PNGs outside Git under the lead workspace's `outputs/native-ridge-cliffs/`. Runtime atlas and receipt live under `apps/portal/assets/generated/hmh-art-target/`:

- `ridge-cliff-kit.webp`: 1024×512, **104,916 encoded bytes / 2,097,152 decoded bytes**.
- `ridge-cliff-kit@0.5x.webp`: 512×256, **46,092 encoded bytes / 524,288 decoded bytes**.
- `ridge-cliff-kit.json`: measured sizes, hashes, frame rectangles and source provenance.

The original rock-face page is retained as fallback. Ridge's total measured ground allocation is **7,471,104 decoded bytes**, below the existing 8 MiB cap by 917,504 bytes. Other districts load no new atlas. Assets are lazy-loaded through the existing shared texture cache and released on disposal; both tiers retain equal world dimensions.

The frozen Ridge plan opts into `native-ridge-v1`. The existing exposed-edge selection, visual height reduction, ragged roof outline, roof triangulation and depth pivot remain authoritative. The normal GLSL path samples the four native face variants over the face's full height, blends a native cap and appends a narrow 26-unit ground rubble band to the same rock mesh. The non-GL fallback uses the same authored edge's affine projection for native face/cap/foot sprites. No collider, ground height, traversal route, object identity, map version, simulation randomness or evidence field changes.

Review honesty: an initial material-node lookup failed before rendering and was corrected. The first successful native atlas was visually rejected because its regular rows read as masonry. One corrective bake produced larger asymmetric fracture planes and lighter grey/ochre rock; its actual pixels were reviewed against the supplied Ridge reference. Native Blender process 40940 and pack process 7908 closed; the owned heavy lock was released. No paid generation was used.

Tests first reproduced the missing Ridge opt-in and absent native atlas. Final focused checks passed **35/35**, covering native receipt integrity, strict district opt-in, unchanged authored world, memory cap, full/half projected parity, malformed-atlas cleanup and existing composition/schema/renderer/area-plan regressions. Module syntax and diff whitespace checks passed. **Actual desktop/phone GLSL review is still pending**: use the normal ten-area world with an evidence-only location `tenAreaEvidence=at:7500,3300` south of the lower cut. The southern face of `ledger-ridge-lower-cut` should show its full native face/lip/foot near the centre of the view.

This does not finish master item 3: other biomes' cliff kits, ramps/decks, railings, Meadows–Woods seam, perimeter fog and actual pillar variants remain open. Browser acceptance may still require correcting art or projection before this candidate is approved.

Independent review corrected premultiplied-alpha handling for the cap/foot and matched the fallback's frame rectangles to the shader's one-physical-texel inset. Native frame crop and equal full/half world dimensions are tested. Binding fixtures were corrected to the actual atlas dimensions without weakening production size validation; the combined focused run then passed **38/38**.

The actual `outputs/22-hmh-second/hmh-ridge-desktop.png` capture showed straight vertical texture jumps near x80 and x680. Native bakes have unequal left/right edges, so sawtooth horizontal repeats were incorrect. All six native face/cap/foot samples now use a continuous triangle-wave mirror; native vertical coordinates still sample the complete face height. A regression failed before this correction and evaluates the actual GLSL scalar expression across positive and negative turn boundaries against an image with unequal opposite edges. Final native/renderer/schema/binding checks passed **20/20**. **A fresh browser capture is required to accept the seam correction; the earlier screenshot is failed visual evidence.** No texture or native scene was rebaked for this fix.

Lead acceptance follow-up: fresh Chrome desktop and 414×896 phone-viewport
captures at `tenAreaEvidence=at:7500,3200` show the vertical texture jumps
removed; both full/half atlas requests returned 200 with no page errors.
Latest artifacts under `outputs/22-hmh-second/` replace the failed screenshots;
timestamped receipts preserve the prior failures. Browser/server closure was
confirmed. All 88 combined focused regressions pass; required legacy HMH
visual comparison passes 12 unchanged scenes. This accepts this bounded Ridge
presentation improvement, not final area art or physical-phone performance.
