# Native timber cover and marquee posts — 2026-10-03

Candidate checked in actual combined desktop/phone-viewport review. Replaces four untextured brown `stakes` decorations; this does not close the full building/placement or forest/world-art master items.

## Delivered and preserved

- Meadows `mweb-meadows-court-wall`: grounded timber windbreak/storage screen, fitted caps/rails, recessed boards, diagonal brace, iron fastening and stone footing.
- River `hashwood-river-marquee-west-post` and `marquee-east-post`: narrow covered timber stands using the market's subdued patched-canvas language, modeled canopy folds, pleated backing, counter boards and framing. These are registered native geometry for the existing post volumes, not stretched house facades.
- River `hashwood-river-court-tall-screen`: matching worn timber screen treatment.
- Exact four blocker identities, shapes, heights, positions and all collision properties remain canonical; a fixed golden covers the complete blocker records. No map, cover rules, pathfinding, objective, spawn, RNG, run evidence or actor camera change.
- Native 45-degree orthographic bake has equal y/z scaling. Normalizing its registered physical extent retains the existing renderer's `y - height` projection. Existing depth node sorting, contact shadow and actor cutaway remain in use.
- Source material reused read-only: `13 - Covered Market Stall Row - Textured Master.blend`, source SHA-256 `37bd18ecfa6edd315b3c4b09612d46c5ccbbefd7958229aba3936134e34ec229`. Packed colour-texture luminance modulates new muted timber/cloth materials; fitted structural meshes are newly authored. No paid assets or source modifications.
- Derived native `.blend` scenes, PNGs and source sheet remain outside Git at `C:/Users/just_/Documents/Codex/2026-09-29/you-are-taking-over-as-lead/outputs/hmh-timber-screens-20261003/`.

## Budget and runtime

One shared lazy atlas, acquired only by the Meadows/River plans and released through the existing reference-counted area cache. Frames have two-pixel full-tier gutters. Frame selection is fixed and validates against its registered piece identity; runtime physical dimensions must match its authored solid. Wrong atlas dimensions reject readiness and release ownership.

| Tier | Page | Encoded bytes | Decoded bytes |
|---|---|---:|---:|
| Full | 512 × 256 | 28,704 | 524,288 |
| Half | 256 × 128 | 11,216 | 131,072 |

Four 128 × 256 full frames (64 × 128 half). Full ground/material accounting becomes **8,257,536 B Meadows**, **7,208,960 B River**, within the 8 MiB per-area cap. The page is shared, not duplicated when both plans are loaded. This is the area-ground/material budget, not whole-game texture residency. Existing `hmh-art-target/*.webp` LFS rule covers the runtime pages.

## Verification

- RED: all four new slice checks failed before implementation (no native style/page/painting). GREEN: **72/72** focused renderer, schema, plans, binding, native kits, terrain, water and collision-art checks pass.
- New coverage asserts complete blocker golden plus footprint/height placement; tests full and both half source-resolution conventions, one page acquisition, disposal, unsafe frame identity and wrong-dimension failure; runtime byte hashes and unchanged-source receipt match.
- Existing collision-art audit recognizes the validated native solid as footprint-filled art. All thresholds, geometry checks and prop-blocker generation stay unchanged; all collision-art checks pass. Existing fake texture loaders now use the native page's exact dimensions.
- New generator Python AST, renderer/schema syntax and focused whitespace checks pass. Root owns combined syntax registry/gates.
- First source sheet rejected for overly striped roof-board materials. One bounded correction calmed variation, added continuous rail shadows and modeled canopy patches/backing folds. Corrected sheet inspected at original resolution; no additional native iteration planned before real runtime review.
- Final Blender **49992** and packer **49340** closed exit 0; owned lock released after both closed. Earlier scratch **24864/48304** also closed exit 0. No native job remains.

## Actual runtime review

Root `outputs/22-timber-death/` captures actual Free gameplay at the Meadows wall and River posts. Full/half atlas requests return 200; art readiness, original cover entry and 60% cue pass with no page errors. Desktop shows both River posts; the narrower phone view shows one post at its ground contact. Full-resolution captures were inspected. These are initial fitted replacements, with surrounding composition and structural scale still open; no physical-device or final-area quality acceptance is claimed. All owned browser/server resources closed and the shared lock released.

New syntax registry entry: `scripts/build-hmh-native-timber-screens.py`. Root owns PROGRESS, registry, commits and combined browser work.
