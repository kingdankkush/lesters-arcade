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

## Authority boundary

This pipeline has no gameplay authority. Blender objects, render layers, sprite pivots, atlas metadata, and Pixi display containers are projection data only. Gameplay continues to use the existing deterministic actor, movement, collision, combat, scoring, bridge, and session state. The default runtime path remains the graybox until a later phase explicitly replaces it after review.
