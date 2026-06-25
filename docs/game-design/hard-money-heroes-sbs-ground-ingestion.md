# HMH Level 1 SBS CC0 ground ingestion

_Last updated: 2026-06-25_

This pass ingests the strongest direct-use downloaded terrain candidates: Screaming Brain Studios 2:1 isometric floor, autotile, water, and overworld tiles.

## Source and license

- Source: Screaming Brain Studios isometric tile packs from Justin's `Downloads` folder.
- License: **CC0/Public Domain**.
- Verification sources:
  - https://screamingbrainstudios.itch.io/isotilepack
  - https://opengameart.org/content/1000-isometric-floor-tiles

The runtime assets emitted by this script are cleaned/sliced derivatives of the CC0 SBS sheets. Attribution is optional but the manifest preserves source metadata.

## Outputs

```text
apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/
apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.json
apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs
docs/game-design/assets/hmh-level-1-sbs-ground-contact-sheet.png
```

## Role coverage

- `grass`: 2 tile(s)
- `dirt`: 2 tile(s)
- `sand`: 2 tile(s)
- `rocky`: 2 tile(s)
- `water`: 3 tile(s)
- `shore`: 3 tile(s)
- `grass-to-dirt`: 2 tile(s)
- `dirt-to-sand`: 2 tile(s)
- `grass-to-sand`: 1 tile(s)
- `grass-to-water`: 1 tile(s)
- `road`: 3 tile(s)

Total cleaned tiles: **23**.

## Runtime use

The ground renderer prefers these cleaned SBS tiles for the Level 1 base terrain layer:

- grass / forest floor
- dirt / road shoulders
- sand / desert
- rocky ground
- water
- height-mapped shore tiles
- grass-to-dirt and dirt-to-sand seams

Authored HMH props/templates still render above this base layer, so the level keeps its Lester's Arcade identity while using production-safe isometric ground geometry.
