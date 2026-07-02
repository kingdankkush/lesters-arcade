# Hard Money Heroes Level 1 Ship Focus

**Status:** active production direction for the next polish push.  
**Intent:** ship one AAA-feeling Level 1 survival loop before expanding extraction, Litecoin City, The Getaway, or later campaign content.

## 1. Scope decision

Level 1 is now the product-quality target:

- **Primary loop:** survive as long as possible in Level 1.
- **8:00 meaning:** full pressure wall / difficulty cap ramp point, **not** the forced end of the run.
- **Deferred:** extraction helicopter finale, Level 2 Litecoin City, Level 3 The Getaway.
- **Current finish line:** Level 1 feels polished enough to ship as a standalone survival arcade game.

## 2. Level-design quality target

Level 1 should read as an authored isometric world, not scattered props:

- towns with readable main streets, alleys, storefront silhouettes, fences, lamps, porches, and cover pockets
- forests with tree-wall boundaries, clear trail loops, boulders/logs as deliberate blockers, and readable canopy breaks
- waterfronts with river/lake edges, bridges, docks, shore reeds, safe banks, and chokepoints
- roads and paths that guide traversal through loops, arenas, POIs, and safe/unsafe lanes
- parallax/pass-through elements: bridges, tunnels, cliff faces, boulders, hills, raised platforms, and overhead silhouettes

Reference style remains translation-only:

- Age of Empires II: DE = authored isometric density and material hierarchy
- Hades = combat readability, lighting hierarchy, and readable arena centers
- Deep Rock Survivor = swarm readability, escape lanes, enemy silhouette clarity
- Metal Slug = chunky handmade pixel-art attitude and punchy effects

## 3. PixelLab production workflow

Use PixelLab API tools by job type instead of one generic generator:

| Need | Preferred PixelLab tool | Notes |
| --- | --- | --- |
| terrain/ground/path/water tiles | `create_tiles_pro` / `create_isometric_tile` / Map Workshop tileset generation | best for clean isometric tile geometry |
| buildings, rocks, trees, blockers, props | `create_map_object` / object creator | use transparent background, high top-down view |
| playable heroes and enemies | character creator + character states + animation tools | preserve identity and animation coverage |
| object animations / VFX props | object animation tools | keep silhouettes readable at gameplay zoom |
| cleanup and edits | Pixelorama / Aseprite extension | polish alpha, outlines, palette, pivots, and frame timing |

Repo command for the current Level 1 P0 queue:

```bash
npm run assets:hmh:level1:queue
npm run assets:hmh:level1:pixellab -- queue --limit 18
npm run assets:hmh:level1:pixellab -- collect --limit 18
```

Collected candidates land under:

```text
apps/portal/assets/generated/hmh-coherent-world/level1-reference-style/candidates/
```

These are **candidates**, not final integrated runtime art, until they pass contact-sheet QC and atlas integration.

## 4. Enemy scale rule

Runtime enemy draw scale is locked to **100%**.

Do not use random 50%-150% draw scaling for enemy variety. That makes collision, hit detection, aim reads, contact damage, and player learning less accurate.

Instead:

- small enemies must be authored as smaller sprites inside their native canvas
- large enemies must be authored as larger sprites inside their native canvas
- hitboxes/footprints should come from role metadata and combat tuning, not visual scale randomness
- elite/miniboss status should change stats, effects, tells, and authored art, not runtime sprite scale

## 5. Character art QA focus

Playable characters need a full sprite/animation audit:

- Lit Commando: current silver/black armor read is acceptable; continue improving animation polish.
- Lit Valkyrie: close to Lilly with teal hair; add glasses and complete all gameplay animation coverage.
- Lilly: new character model exists as direction; generate the full pixel-art sprite set rather than leaving her partial.
- Lester: restore the intended Lester identity: blue spherical head with Litecoin logo face, using the original references as identity direction.

For now, Level 1 environment and combat readability take priority over finishing every hero variant.

## 6. Immediate quality gates

A Level 1 asset candidate is not ready for runtime integration until it passes:

- correct 2:1 / isometric perspective for its role
- transparent corners / clean alpha
- no copied reference art, text, or logos
- readable at gameplay zoom
- no baked-in characters on ground tiles
- path/arena center stays quiet enough for bullets, pickups, and enemies
- works in a contact sheet against neighboring materials
- has a clear atlas key and intended collision/render role

## 7. Claude Fable review response slice — 2026-07-01

Justin's playtest called out the real P0 issue: the previous Level 1 slices proved wiring but still looked like square ground tiles with sparse props after spawn. The active Fable master todo therefore drives the next art/runtime work in this order:

1. **World sprint first:** terrain seam breakup, road/path grammar, authored far-field dressing, natural boundaries.
2. **Readability before claims:** enemy glows/tells/corpse decals are an interim readability layer only, not a replacement for the full sprite matrix.
3. **No "AAA" language unless visible on screen:** every slice must add something the player can notice during traversal or combat.

The current corrective slice adds:

- `LEVEL_ONE_WORLD_DRESSING_CHUNKS`: reusable authored chunks for desert salvage, ghost town frontage, forest rings, shoreline banks, farmstead pockets, inner-city barricades, ruined camp bones, and roadside arcade caches.
- deterministic world-dressing placement around the player beyond spawn so traversal has landmarks and diegetic boundaries instead of only floor tiles.
- `levelOneGroundEdgeBreakupForTile(...)`: deterministic road wear, ruts, shore foam, edge strokes, and flecks to reduce square tile seams while the real 47-blob autotile set is still open.
- `drawLevelOneEnemyReadabilityAura(...)`: immediate enemy readability aura/telegraph/death-decal pass while full hero/enemy sprite completion remains P0.

Still P0 after this slice, per Fable:

- real 47-blob terrain autotile atlas and transition masks
- full Level 1 road kit, bridge/water kit, and natural arena boundary kit
- generated + QA-passed hero/enemy animation matrices
- sprite QA gate for alpha, palette, silhouette, pivots, muzzle anchors, and telegraph frame coverage
- proper lighting, shadows, VFX, and corpse/particle pooling
