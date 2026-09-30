# Character opening proof — R0 exports and default-off R1 pilot

2026-09-29. Branch `codex/200-character-pilot-20260929`, base `2d67acb9`.

## What exists

Two source-derived, skinned GLBs with embedded PBR textures and the existing authored clips. An offline gate rejects external dependencies, malformed buffers, invalid skinning, missing timed clips, and out-of-range joints. A separate Blender re-import measures actual deformed geometry. Existing `.blend` files and packed images were opened without scripts and never saved; their SHA-256 values were checked before and after export.

`apps/hmh-reboot/src/actor-3d-projection.mjs` defines detached frozen visual inputs and optional backend ownership. It creates one backend display per actor, preserves `worldDepthKey(y)` for attachment to the existing Pixi world layer, and releases resources on removal, backend failure, context loss, and disposal. Disabled/unsupported cases never invoke the backend factory.

R0 was committed as `bf451fd5`. Its original proof was offline only. R1 adds a bounded embedded-GLB decoder, real authored-clip evaluator, and Pixi Mesh GPU backend behind exact `?actor3dPilot=1`. The default game still draws its accepted sprites. The local build, four actual-game browser captures, isolated Pixi integration fixture and existing visual suite pass. This is not device accepted or a performance result; complete authoritative digest/evidence pairing and actual-game post-context-loss screenshots remain scheduled checks.

The pilot draws at most two live instances: Commando with Coin Blaster and the first visible Bagholder. Unsupported hero identities, weapons and interaction poses retain the existing sprite presentation. Existing shadows, telegraphs, health pips, simulation, input, camera and evidence remain authoritative. The model backend receives frozen copied visual fields only, with no health, collision radius, AI or RNG object.

Each actor owns a Container and per-material Mesh children in the same Pixi context and existing world RenderLayer. Geometry and embedded textures are shared by model. Per-actor depth bands preserve actor painter order even for equal/adjacent ground Y; native props remain interleaved by `worldDepthKey(y)`. Conservative per-primitive bounds are derived from joint envelopes and posed each frame. A fixed 2×2 Pixi preflight draw validates material/geometry/global-uniform binding before accepted art hides; it is a fixed resource, not an overlay or copied actor atlas. Real browser draws use the root canvas depth buffer; the fixture captures a native prop behind and in front, ties both actor foot-depth keys and alternates adjacent ground Y during replacement.

Fallback restores original `renderable` values, aborts pending model requests, removes displays and frees owned geometry/textures/bitmaps/target resources and frontend shader/program objects. Pixi retains one compiled pilot program entry in its renderer cache until renderer/context teardown; this is a bounded cache, not immediate native-program release. Actor tracking removes retired IDs and is bounded to two live entries; its 1,000-replacement test passes. Context loss ends this experimental renderer for the session and preserves the accepted fallback. A load disposed before resolution cannot resurrect.

Shading is provisional directional/ambient PBR-inspired lighting using geometric skinned normals and the embedded base/roughness/metallic textures. The R0 GLBs contain no tangent accessors, so their embedded tangent-space normal maps remain dormant. Parent review of the full-resolution game captures finds real survivor/zombie geometry but dark, fragmented textured silhouettes against the road at phone size. This is a technical pilot, not final-quality or approved art, final retopology, a completed clip catalogue, or the heavy-load character gate. After complete pairing/context proof, the next visual slice needs a real normal-map tangent basis, lighting and readable scale/contact depth; measure before widening the roster.

## Measured assets

| Actor | Source triangles | GLB triangles / vertices | Joints | Clips | GLB bytes | RGBA8 texture estimate with mipmaps |
|---|---:|---:|---:|---:|---:|---:|
| Lit Commando | 1,965,100 | 25,891 / 21,519 | 22 | 9 | 8,023,452 | 29,360,112 B |
| Bagholder Rusher | 114,422 | 8,274 / 6,968 | 19 | 6 | 1,746,308 | 4,199,756 B |

Commando source SHA-256: `0c930374daccb2b9458a8600fdf3150dc51f6b5d8b4a47edcd05d92905fc6284`.

Bagholder source SHA-256: `d71630544fb236ad3a165a3e9d3e3f7aa2f5bbd254311b6d8f9c7a1f92b85856`.

GLB digests, texture dimensions, clip names/durations, and geometry counts are in `apps/portal/assets/generated/hmh-actor-3d-pilot/manifest.json`. Runtime GLBs use Git LFS. No dependency was installed and no paid tool was used.

The reductions are automatic Blender decimation for this pilot, **not final retopology or approved art**. Body textures are 1024px for Commando and 512px for Bagholder; Commando equipment is 512px. These experimental conversion settings are not production budgets or changes to the draft art bible. Original UVs, materials, equipment, rigs, and clip data remain the basis. Together the candidates estimate 33,559,868 B of texture storage with mipmaps before scene, render-target, CPU decode, or driver overhead. Phone memory still requires a real measurement.

## Grounding and inspection

The 55° camera from vertical (35° above ground), current floor projection, and inverse input projection remain unchanged. GLB axes are standard Y-up; a future backend must map them to the existing world-foot projection. Pixel scale and camera calibration are presentation contracts, not collision geometry.

Bagholder retains the existing additive whole-actor grounding through an animated parent, leaving original bone clips untouched. Independent re-import at five poses per clip measured a maximum absolute foot error of `0.00000035762786865234375` m. An initial export failed: Blender dropped the constant parent channel on `tell`, leaving feet 22 mm high. Enabling `export_optimize_animation_keep_anim_object` fixed it; the corrected GLB and pose receipt are tested together.

Commando preserves authored run/dash lift. Idle/held poses measure about 0.66 mm above the floor after reduction, death reaches -0.064 mm, and sampled run lift reaches 0.122 m. This inherited animation does not change simulation movement.

Mesh validation removed invalid geometry left by decimation. Blender still reports multiple image nodes sharing a texture sampler; Commando also reports reduction to four joint influences. Exported weights are normalized and joint indices are valid. Full-resolution 768px offline previews were inspected: Commando remains a detailed human survivor and Bagholder a stooped humanoid zombie with its debt satchel. These three-light previews are model inspections, not game screenshots or art sign-off.

Actual pose receipts: `docs/2.0/receipts/lit-commando-glb-reimport.json` and `docs/2.0/receipts/bagholder-rusher-glb-reimport.json`.

## R0 RED / GREEN and build evidence

- Ownership: RED 8/8 failed before implementation; GREEN 8/8 pass. A further invalid camera/viewport output case was RED before validation and is now GREEN.
- GLB boundary: RED 4/4 failed before implementation; GREEN 4/4 pass. A further invalid joint/target case was RED before validation and is now GREEN.
- Asset/receipt binding: RED 2/2 failed before manifest generation; GREEN 2/2 pass.
- Independent review added RED corrupt animation/index/view cases and a RED source-output path gate. All are GREEN. Animation samples must be finite FLOATs with valid shapes/counts; times are nonnegative and strictly increasing; indices are unsigned SCALARs; views/accessors stay inside the declared buffer. Before opening Blender, inspection/export/re-import outputs must equal their exact owned destinations, protecting sources even when an output path is inside the worktree.
- Final focused run: 19 Node tests, 19 pass, zero skips; its path wrapper also runs three passing Python regressions. Eight changed JS files parse; four Python files compile.
- Baseline and final builds pass: HMH entry 315,021 B + Pixi 465,746 B + static shared chunks 258,550 B = **1,039,317 B**, leaving **9,259 B** under the 1,048,576 B cap. Initial JS increased by zero because there is no active import.
- The 780,767 B entry-plus-vendor figure omits shared chunks and is not the authoritative budget result.

For R0, Blender, builds and previews ran under the shared heavy lock. The full release gate, `visual:reboot`, actual-game browser inspection, Ranked runs, phone load scenarios and 30-minute flat-memory test were not run at that source-only stage. R0 changed no active renderer. Both slices leave simulation, RNG, evidence, verifier, version, settlement and deployment unchanged. Tests read files directly and do not require Git.

## R1 RED / GREEN, bytes and browser evidence

Loader/pose tests first failed on missing implementations, followed by RED cases for conservative bounds, invalid geometry/oversized PNGs, bad material/index references and unsupported fallback diagnostics. Independent review added malformed tangent/material/texture regressions and a RED lifetime registry/abort ownership case. All are GREEN. The CPU weighted-vertex audit reproduces every Blender receipt clip at five poses within 0.02 mm; joint-envelope projection bounds contain sampled deformed vertices at four headings. The heavy-window focused run passed **33/33 Node tests, zero skips** (model 14, controller 10, projection 9). A later parent-requested pure RED prior-target-restoration failure regression is GREEN after hardening; the next combined run includes34 cases. No browser rerun is implied for that failure-only lazy-controller change.

The first enabled browser safely fell back before loading models. Startup art left a depthless offscreen framebuffer bound, so the original support check misread its `DEPTH_BITS=0` as the canvas's capabilities. A RED test now covers both depth24 acceptance and depth0 refusal while restoring the startup target. The correction uses Pixi's public target binding API, measures the canvas depth, restores the prior target and keeps the >=16-bit depth and WebGL2/uniform gates. A failure restoring the prior target yields unsupported, with no backend load or hidden sprites. The successful browser reports real GPU skinning, zero page errors and no GL errors after its integration fixture.

Final build: HMH entry **316,091 B** + Pixi **470,858 B** + static shared **258,843 B** = **1,045,792 B**, leaving **2,784 B** under 1,048,576 B. Increase from R0 is **6,475 B**; the new public Pixi exports contribute **5,112 B**. The loader, clip evaluator, shader backend and switch controller are separate lazy chunks. No package was installed and no duplicate Pixi library was emitted. The entry-plus-vendor subtotal **786,949 B** omits shared chunks and is not the cap receipt.

`scripts/hmh-actor-3d-browser-smoke.mjs` uses the actual built game in Chrome at 1440×900/tick90 and 390×844/tick240, with the switch off and on. Compositor screenshots were inspected at full resolution. Disabled scenes load no pilot chunks or GLBs. Enabled scenes draw both actors, have changing GPU joint palettes, use depth tests and perform real mesh preflight draws before hiding the originals. The fixed RAF clock is a capture fixture, **never an FPS measurement**.

The desktop off/on authoritative checkpoint subset hashes match (`22d125620f0c95b8aafa63f1bd529e2fe39c84e949721cb13fe1d1ca1f2ea466`); mobile-viewport hashes match (`ab75bcb672615de189c3e4e8fd7d7cccf8cb122296242f378938b0d30479407a`). These cover tick, position, target, weapon/ammo, projectiles, score/progression, aim and surface telemetry. They are **not complete simulation/RNG digests or run-evidence byte comparisons**. That stronger check remains required before renderer acceptance.

The isolated same-context fixture reuses the actual lazy controller/backend and native bus-shelter prop. It captures tied actor depth with the prop first and last in the real RenderLayer; validates actual shader 1 m X/ground-Y/height rulers within 0.001 pixels; replaces the enemy20 times while layer membership remains3; loses and restores the real WebGL context using `WEBGL_lose_context`; verifies fallback, restored original flags and only the native prop remaining. Its restored prop renders without a GL error. This fixture does not substitute for the next actual-game post-loss sprite/resource capture.

`visual:reboot` passes **12/12 unchanged scenes**, including desktop/mobile enemy crops and reduced-motion evidence, zero errors/skips, without accepting new baselines. Its current screenshots/runtime files are under `.hermes/evidence/hmh-reboot-visual/current/`. The machine-readable pilot receipt is `docs/2.0/receipts/actor-3d-r1-browser.json`; local original screenshots are `.tmp/hmh-actor-3d-pilot/browser/`. Full release/Ranked gates, physical XS Max tests, heavy-load scenarios, 30-minute flat-memory soak and final art acceptance have **not run**.

## Reproduce and next slice

Run Blender 5.1.2 with `--background --factory-startup --disable-autoexec --python scripts/hmh-blender/export-hmh-actor-glb-pilot.py -- --actor <actor-id> --mode inspect --output .tmp/hmh-actor-3d-pilot/<actor-id>-inspection.json`, then `--mode export --output apps/portal/assets/generated/hmh-actor-3d-pilot/<actor-id>.glb`. Re-import using `scripts/hmh-blender/verify-hmh-actor-glb-pilot.py -- --actor <actor-id> --output-prefix .tmp/hmh-actor-3d-pilot/<actor-id>-reimport --preview`; refresh the manifest with `node scripts/inspect-hmh-actor-glb-pilot.mjs`.

Run `node --test tests/hmh-actor-3d-projection.test.mjs tests/hmh-actor-glb.test.mjs tests/hmh-actor-glb-pilot-assets.test.mjs tests/hmh-actor-pilot-paths.test.mjs`. The export is source-bound; substitutions require a separately reviewed identity change.

For R1 run `node --test tests/hmh-actor-3d-controller.test.mjs tests/hmh-actor-3d-model.test.mjs tests/hmh-actor-3d-projection.test.mjs`, `node build.mjs --metafile`, `node scripts/hmh-actor-3d-browser-smoke.mjs` and `npm run visual:reboot` under the shared heavy lock. Next: capture actual-game context loss/restoration and complete authoritative digest/evidence pairing in the reserved browser window; audit all eight headings/clip transitions, then measure crowd/boss/streaming/soak scenarios on the owner's XS Max with Chrome. Offline renders and desktop phone emulation cannot certify that device gate.

A2 coordination identified legacy props baked at 45° with Y√2 compensation. New 55°-from-vertical actors are not a final calibrated art target alongside those legacy props. The pilot uses height prewarp `cot55` and screen Y compensation `sec55` for the local `cos55 * groundY − sin55 * Z` camera basis, preserving the current `worldToScreen` foot and 1 m height projection. Its actual GPU ruler receipt passes. Sources remain unchanged. A2's common prop calibration and owner-approved art slice remain separate requirements.
