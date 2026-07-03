# Hard Money Heroes Level 1 Noir Ground Tool Bake-off (WO-49)

**Status:** HALT awaiting Justin tool choice.  
**Rule:** Do not generate, commit, or integrate a full Level 1 noir ground batch until Justin chooses one pilot path and approves the contact sheet.

## Decision to make

Which tool should produce the approved noir ground pilot before scaling to the full Level 1 batch?

## Options

| Tool path | Best for | Risk | Pilot output |
| --- | --- | --- | --- |
| PixelLab `create_tiles_pro` | Fast 2:1 isometric terrain/path/water candidates using the existing queue, manifest, and contact-sheet pipeline. | Can output mini-scenes or noisy non-seamless tiles; credit spend requires approval. | 6 tile candidates: wet blacktop, ghost-town cobble, moonwash sand, bridge/water edge, sodium asphalt, boss-yard scorched ground. |
| ComfyUI Flux/SDXL img2img | Style-locking a noir palette from existing final-paint/PixelLab candidates before hand pixel cleanup. | Local/cloud setup and model dependencies can cost time; output still needs tile normalization and alpha/edge cleanup. | 3 style-lock passes over current route tiles plus one 3x3 seam contact sheet. |
| Repo final-paint post-process | Zero-credit, no-new-model redress using current repo-owned final-paint ground plus palette, edge-wear, and lighting overlays. | Least novel art; may look like a grade/filter unless hand-painted replacement follows. | Runtime-safe noir variants for spawn road, ghost-town street, water/shore, and boss-yard ground. |

## Pilot scope only

- `spawn-broken-road`: spawn road / wet blacktop safe gate
- `ghost-saloon-mainstreet`: ghost-town street / false-front cobble-dirt
- `shoreline-ford`: Blackwater ford / water-shore transition
- `rugpull-gulch-boss-yard`: boss-yard ground / showdown circle

## Evaluation criteria

1. 2:1 isometric ground reads at gameplay zoom without high-frequency noise.
2. 3x3 seam/contact-sheet pass before runtime integration.
3. No text, logos, protected emblems, copied reference shapes, or baked characters.
4. Hero/enemy silhouettes remain readable over the ground in noir lighting.
5. Runtime output can be atlas-packed or manifest-backed without raw generation files in git.

## Full-batch unlock

The full batch is blocked until all are true:

- Justin chooses a tool path.
- Pilot contact sheet is approved.
- Pilot browser smoke passes in the Level 1 canvas.
- Any credit/model/cloud spend is explicitly approved.

Recommended default if speed matters: **Repo final-paint post-process first**, then use PixelLab or ComfyUI only for replacement tiles that fail the pilot contact sheet.
