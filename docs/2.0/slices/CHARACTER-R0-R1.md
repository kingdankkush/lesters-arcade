# Character opening proof — R0 exports, R1 ownership contract

2026-09-29. Branch `codex/200-character-pilot-20260929`, base `2d67acb9`.

## What exists

Two source-derived, skinned GLBs with embedded PBR textures and the existing authored clips. An offline gate rejects external dependencies, malformed buffers, invalid skinning, missing timed clips, and out-of-range joints. A separate Blender re-import measures actual deformed geometry. Existing `.blend` files and packed images were opened without scripts and never saved; their SHA-256 values were checked before and after export.

`apps/hmh-reboot/src/actor-3d-projection.mjs` defines detached frozen visual inputs and optional backend ownership. It is not imported by the game. It creates one backend display per actor, preserves `worldDepthKey(y)` for attachment to the existing Pixi world layer, and releases resources on removal, backend failure, context loss, and disposal. Disabled/unsupported cases never invoke the backend factory. The caller must restore existing sprite presentation after fallback.

**There is no working real-time renderer in this slice.** There is no glTF runtime loader, GPU skinning backend, active game switch, browser scene, device acceptance, or heavy-load performance result. R0 is implemented; R1's boundary is tested, and its actual Pixi integration is open. A single overlay canvas would fail actor/prop interleaving and is not the proposed next step.

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

## RED / GREEN and build evidence

- Ownership: RED 8/8 failed before implementation; GREEN 8/8 pass. A further invalid camera/viewport output case was RED before validation and is now GREEN.
- GLB boundary: RED 4/4 failed before implementation; GREEN 4/4 pass. A further invalid joint/target case was RED before validation and is now GREEN.
- Asset/receipt binding: RED 2/2 failed before manifest generation; GREEN 2/2 pass.
- Independent review added RED corrupt animation/index/view cases and a RED source-output path gate. All are GREEN. Animation samples must be finite FLOATs with valid shapes/counts; times are nonnegative and strictly increasing; indices are unsigned SCALARs; views/accessors stay inside the declared buffer. Before opening Blender, inspection/export/re-import outputs must equal their exact owned destinations, protecting sources even when an output path is inside the worktree.
- Final focused run: 19 Node tests, 19 pass, zero skips; its path wrapper also runs three passing Python regressions. Eight changed JS files parse; four Python files compile.
- Baseline and final builds pass: HMH entry 315,021 B + Pixi 465,746 B + static shared chunks 258,550 B = **1,039,317 B**, leaving **9,259 B** under the 1,048,576 B cap. Initial JS increased by zero because there is no active import.
- The 780,767 B entry-plus-vendor figure omits shared chunks and is not the authoritative budget result.

Blender, builds, and previews ran under the shared heavy lock, released after focused checks. The full release gate, `visual:reboot`, actual-game browser inspection, Ranked runs, phone load scenarios, and 30-minute flat-memory test were **not run for this source-only opening proof**. No active renderer, simulation, RNG, evidence, verifier, version, settlement, or deployment changed. Tests read files directly and do not require Git.

## Reproduce and next slice

Run Blender 5.1.2 with `--background --factory-startup --disable-autoexec --python scripts/hmh-blender/export-hmh-actor-glb-pilot.py -- --actor <actor-id> --mode inspect --output .tmp/hmh-actor-3d-pilot/<actor-id>-inspection.json`, then `--mode export --output apps/portal/assets/generated/hmh-actor-3d-pilot/<actor-id>.glb`. Re-import using `scripts/hmh-blender/verify-hmh-actor-glb-pilot.py -- --actor <actor-id> --output-prefix .tmp/hmh-actor-3d-pilot/<actor-id>-reimport --preview`; refresh the manifest with `node scripts/inspect-hmh-actor-glb-pilot.mjs`.

Run `node --test tests/hmh-actor-3d-projection.test.mjs tests/hmh-actor-glb.test.mjs tests/hmh-actor-glb-pilot-assets.test.mjs tests/hmh-actor-pilot-paths.test.mjs`. The export is source-bound; substitutions require a separately reviewed identity change.

Next: build the actual dynamically imported loader/GPU backend behind an exact default-off switch, returning individual Pixi displays attached to the existing world layer. Prove prop/actor crossing, eight directions, feet, fallback, and disposal in the real game; run `visual:reboot` and inspect desktop/phone screenshots and metrics. Compare identical game input traces with pilot off/on, then measure crowd/boss/streaming/soak scenarios on the owner's XS Max with Chrome. Offline renders and desktop phone emulation cannot certify that device gate.

A2 coordination identified legacy props baked at 45° with Y√2 compensation. New 55°-from-vertical actors are not a final calibrated target alongside those props. The common presentation adapter must be measured with 1m X/Y/Z rulers and grounded footprint crossings against the current `worldToScreen`; its local camera basis is `cos55 * groundY − sin55 * Z` before yaw/sign conventions. Preserve source models and disclose any copy-only prewarp and projection compensation.
