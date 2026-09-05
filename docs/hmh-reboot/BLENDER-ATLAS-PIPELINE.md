# HMH Blender-to-Atlas Pipeline

## Purpose

This repository-owned pipeline turns one neutral Blender mannequin scene into a deterministic, layered PixiJS atlas. It is a **pipeline pilot, not production character art**.

The pilot proves:

- one source `.blend` scene with a shared rig, fixed camera, fixed lights, and palette-locked materials;
- eight screen-semantic directions;
- independent lower-body movement and torso/weapon aim;
- transparent trimming with a stable ground-contact pivot;
- deterministic atlas packing and metadata;
- desktop and portrait-mobile runtime composition.

The atlas integration is render-only and has no gameplay authority. It cannot change collision, movement, damage, combat, scoring, persistence, bridge messages, wallet behavior, contracts, economy, analytics, or settlement.

## Required tool

- Blender 5.1.2
- Default Windows executable: `D:\Apps\Blender\blender.exe`
- Optional override: set `BLENDER_EXECUTABLE` to another Blender 5.1.2 executable
- Python with Pillow
- Node.js and the repository dependencies

The runner rejects a Blender version mismatch. It also scans Blender output for `Traceback (most recent call last)` because Blender can return process exit code 0 after a Python exception.

## Source of truth

- Manifest: `apps/hmh-reboot/assets/source/blender/hmh-character-pipeline.json`
- Blender scene: `apps/hmh-reboot/assets/source/blender/hmh-character-template.blend`
- Scene generator: `scripts/hmh-blender/create-hmh-character-template.py`
- Frame exporter: `scripts/hmh-blender/export-hmh-mannequin.py`
- Atlas packer: `scripts/build-hmh-blender-atlas.py`
- Orchestrator: `scripts/run-hmh-blender-pipeline.py`
- Runtime selector/adapter: `apps/hmh-reboot/src/mannequin-atlas.mjs`

The `.blend`, manifest, scripts, atlas, metadata, metrics, and contact sheet are repository-owned. Individual Blender render PNGs under `.tmp/hmh-reboot-blender/raw/` are an ignored intermediate and are never runtime assets.

## One-command generation

From the repository root:

```bash
npm run assets:hmh:blender-pipeline
```

This command:

1. Verifies Blender 5.1.2.
2. Recreates the canonical `.blend` scene.
3. Opens that scene in headless Blender.
4. Renders every required transparent layer frame.
5. Rejects missing, extra, empty, clipped-corner, off-palette, or shadow-alpha failures.
6. Packs a power-of-two atlas.
7. Writes metadata, metrics, and a checkerboard contact sheet.

## Reproducibility proof

Run:

```bash
npm run assets:hmh:blender-pipeline:verify
```

The verification command performs two independent exports from the same generated source scene and requires exact equality for:

- decoded raw RGBA frame-set SHA-256;
- committed atlas PNG SHA-256;
- committed atlas metadata SHA-256.

Blender may write non-canonical container bytes into temporary PNG files. The temporary files are ignored. The pipeline hashes decoded RGBA pixels, then uses Pillow to create the canonical committed atlas and metadata. Those canonical artifacts must be byte-identical across both runs.

The current pilot contains 64 frames:

- `shadow`: 1 idle frame x 8 directions = 8;
- `lower-body`: 1 idle plus 4 run frames x 8 directions = 40;
- `torso-head`: 1 aim frame x 8 directions = 8;
- `weapon`: 1 aim frame x 8 directions = 8.

Total: 64.

## Direction convention

The camera uses a 55-degree elevation and 45-degree azimuth. The Blender root angles are offset so atlas names describe screen-facing directions:

| Atlas direction | Blender root angle |
| --- | ---: |
| south | 135 |
| south-east | 180 |
| east | 225 |
| north-east | 270 |
| north | 315 |
| north-west | 0 |
| west | 45 |
| south-west | 90 |

The simulation index adapter is explicit:

`east, south-east, south, south-west, west, north-west, north, north-east`

No sprite rotation is used to fake directions.

## Layer contract

Runtime composition order is fixed:

1. `shadow`
2. `lower-body`
3. `torso-head`
4. `weapon`

The optional future layer is `coat-hair`.

All layers preserve the manifest source pivot at `[64, 104]`. Trimming changes the local sprite anchor but not the source ground-contact point. Lower-body direction comes from `motion.legDirection`; torso and weapon direction come from `motion.torsoDirection`. Run frame selection comes only from the deterministic simulation tick.

## Generated outputs

Directory:

`apps/portal/assets/generated/hmh-reboot-mannequin/`

Files:

- `hmh-reboot-mannequin-atlas.png`
- `hmh-reboot-mannequin-atlas.json`
- `hmh-reboot-mannequin-metrics.json`
- `hmh-reboot-mannequin-contact-sheet.png`

Required QA includes:

- 64 unique frame IDs with no missing or extra frames;
- 512 x 512 or smaller power-of-two atlas, maximum 2048 x 2048;
- source pivot variance no greater than 0.5 pixels;
- zero empty frames;
- zero transparent-corner failures;
- master-palette drift no greater than 8 percent at the configured color-distance threshold;
- translucent shadow mean alpha from 32 through 96;
- non-empty opaque content in every required layer;
- two-run reproducibility status `pass`.

## Runtime pilot

The default game still uses the certified Pixi graybox actor. The Blender atlas is opt-in only:

`http://127.0.0.1:8791/hmh-reboot/index.html?pipelinePilot=1`

The stage reports:

- `data-actor-art="pipeline-pilot-human-atlas"`
- `data-actor-art-source="blender-atlas-v1"`
- `data-actor-art-layers="shadow,lower-body,torso-head,weapon"`
- four live frame IDs in `data-actor-art-frame-ids`

The pilot container is anchored to the existing rendered ground-contact point. The source does not import or write combat, collision, bridge, persistence, wallet, settlement, or analytics state.

## Browser smoke

First build and serve the portal:

```bash
npm run build
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

Leave that terminal running. From a second terminal at the repository root:

```bash
npm run smoke:hmh:blender-pilot
```

The smoke verifies:

- atlas image and metadata return HTTP 200 from the same origin;
- no page errors, console errors, or failed requests;
- four ordered live layers;
- south-running lower body can coexist with east-aiming torso and weapon;
- at least two deterministic run frames animate during movement;
- all eight portrait-mobile controls remain present;
- desktop and mobile screenshots are created under `.hermes/evidence/hmh-reboot-phase19-blender/`.

Set `HMH_REBOOT_ORIGIN` if the portal uses a different local origin.

## Focused tests

```bash
node --test tests/hmh-reboot-blender-pipeline.test.mjs
node --test tests/hmh-reboot-mannequin-atlas.test.mjs
node --test tests/hmh-reboot-shell.test.mjs
```

## Hero selector turntables

The character-select turntables are a separate, portal-only render of the four
production heroes. They are not the gameplay atlases: the shipped 160 px hero
atlases under `apps/portal/assets/generated/hmh-reboot-production-heroes/` are
neither inputs nor outputs of this pipeline and must stay byte-identical when it
runs.

Manifest: `apps/hmh-reboot/assets/source/blender/hmh-hero-selector-render.json`
(`hmh-reboot-hero-selector-atlas-v3`). It inherits the committed hero scene
read-only (`hmh-production-heroes.blend`, ortho 2.75, exposure -0.45, pitch 55,
EEVEE) and renders one composite frame per spin direction per hero at 384 px:
shadow and lower-body idle frame 0 under torso-head and weapon aim frame 0, the
same pose the v2 recomposer used. Directions follow the selector spin order
`east, north-east, north, north-west, west, south-west, south, south-east`; the
rest frame shown under `prefers-reduced-motion` is `south`.

```bash
npm run assets:hmh:hero-selector
npm run check:hmh:hero-selector
```

`assets:hmh:hero-selector` (`scripts/run-hmh-hero-selector-render.py`):

1. Takes both `exclusive_pipeline_lock`s (`.tmp/hmh-reboot-hero-selector.lock`
   and `.tmp/hmh-production-hero-pipeline.lock`) so a concurrent hero
   regeneration cannot swap the `.blend` between passes.
2. Verifies Blender 5.1.2 and that the committed `.blend` hash is unchanged
   after both passes; the exporter
   (`scripts/hmh-blender/export-hmh-hero-selector.py`) asserts it opened the
   committed scene and never calls `save_mainfile`.
3. Runs two cold Blender passes (32 renders each, about 9 s per pass) and
   compares them premultiplied per frame against the hero
   `reproducibilityBudget` {8 changed visible pixels, 2 per channel, 32 total},
   mode `bounded-premultiplied-rgba-v1`. A drift report is written to
   `.tmp/hmh-reboot-hero-selector-drift-report.json` on every run. Pass A is
   blessed.
4. Proves the anti-jitter contract: the exporter projects the rig origin
   through the fixed camera per frame, and the runner refuses any movement
   above 0.5 px across all 64 rendered frames (v2 recentred each frame to its
   own alpha bbox, so a gun sticking out east shifted the whole hero).
5. Packs one 1536x768 PNG per hero (4x2 grid of 384 px cells) with Pillow at
   compress level 9 and enforces `maxBytesPerAtlas` 524,288 per file and
   `maxTotalBytes` 2,097,152 for the whole select-screen payload.
6. Writes `apps/portal/assets/generated/hmh-reboot-hero-selector/
   <actor>-selector-atlas.png`, `hmh-reboot-hero-selector-atlas.json` (per-frame
   pixel SHA-256, alpha bounds, foot line, provenance hashes of the scene,
   manifests and exporters) and the frozen module
   `apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs`, whose path is
   listed by the curated level-kit runtime manifest and must not move.

`check:hmh:hero-selector` is Blender-free and runs inside `npm run test:release`
on the Vercel image (CPython 3.12 + Pillow 11.3, no `.git`): it decodes every
tracked atlas, re-verifies each frame's pixel hash, bytes, SHA-256, dimensions,
caps, the module derivation, and the recorded hash of the committed `.blend`.
It accepts a pixel-identical PNG re-encode and rejects any pixel change.

Consumers: `apps/portal/main.js` (`heroRotationSprite`, `displayScale` 1.4 into
the 180 px card box) and `scripts/hmh-reboot-production-asset-qa.mjs`, which
applies the same per-atlas and total caps. The HMH child never imports it.

## External model sources

Cycle 072 added a second, additive source path beside the procedural builders: a
GLB/FBX authored outside the repository (ChatGPT concept sheet, Tripo, Mixamo),
committed under `apps/hmh-reboot/assets/source/models/` with its SHA-256 in the
manifest. Roadmap 1.2 makes such a committed mesh repo-owned source, exactly
like a `.blend`; what must stay reproducible is the render out of the exporter.

`scripts/hmh-blender/import-hmh-external-model.py` normalises one of those files
into the shape this pipeline already understands: height scaled on a parent
Empty, origin at ground contact, the single skinned mesh split at the waist into
`lower-body` and `torso-head` objects sharing one armature, weapon meshes moved
to a created `weapon_socket` bone, and every material rebuilt on the shared
`HMH_LookDev_v1` toon group whose rim colour comes from `hmh-light-rig.json`.

Both actor manifests carry optional per-entry `sourceModel`, `frameSize`,
`clipActions`, `lookDev` and `armature` keys as siblings of `clips`. When an
entry declares `clipActions`, the exporter plays the named Blender Action and
samples `frames` poses across its range instead of calling the trigonometric
`apply_pose`. Actors without those keys are completely unaffected; the four
shipped heroes and the whole enemy roster remain procedural.

Textures must be packed into the source file, because `external_dependencies()`
counts any image with a filepath and the runner requires a zero count.

The path is proven on a throwaway generated fixture, not on a shipped actor:

```bash
npm run assets:hmh:skinned-test
npm run assets:hmh:skinned-test:verify
```

Every artefact that gate produces — GLB, `.blend`, raw frames, atlas, metadata,
contact sheet — is an ignored intermediate under `.tmp/hmh-skinned-test-actor/`
and is never a runtime asset.

Source models travel through Git LFS (roadmap P-5, Cycle 073). `.gitattributes`
carries `filter=lfs diff=lfs merge=lfs -text` for `glb`, `fbx`, `bin`, `png`,
`jpg` and `jpeg` under `apps/hmh-reboot/assets/source/models/**`; the per-file
cap is 40 MB and PNG textures are at most 2048 px per edge. Before committing a
model: `git add` it, confirm `git lfs ls-files` lists it, then run
`npm run assets:hmh:models:lfs-check` (offline; passes with zero models today).
The clean-clone proof (`--clean-clone <dir>`) is a first-commit ritual, not a
Cycle 073 fact: the models directory is still empty.

Full contract, CLI, layer-split rules, look-dev constants and known limitations:
`docs/hmh-reboot/EXTERNAL-MODEL-PIPELINE.md`.

## Authority boundary

This pipeline has no gameplay authority. Blender objects, render layers, sprite pivots, atlas metadata, and Pixi display containers are projection data only. Gameplay continues to use the existing deterministic actor, movement, collision, combat, scoring, bridge, and session state. The default runtime path remains the graybox until a later phase explicitly replaces it after review.
