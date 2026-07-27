# HMH AAA Continuous Improvement Cycle 022

Date: `2026-07-27`
Status: `LOCAL GATES PASSED · NOT PUSHED · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `1b1bd62e`

## Scope: playtest defect, terrain readability

Accepted Cycle 022 scope from a human playtest:

> "the level design doesn't have very good terrain tiling and it's hard to know
> what you're walking on, what's elevated, what's water"

This cycle addresses that defect only. Two further items from the same
playtest — pickup identification and character model detail — are **not** in
this cycle and are recorded as the next slices.

## Root cause

Every surface in the world drew as a flat colour fill. Water, walkable ground,
road, bridge deck and ledge were separable only by hue, with no material or
structural cue. Confirmed by capture before any change
(`.tmp/art-review/before-bridge.png`).

## What changed

### Authored seamless terrain materials

New `scripts/build-hmh-terrain-tiles.py` (`npm run assets:hmh:terrain`) bakes
11 tileable 256px materials: six district grounds plus `road`, `water`,
`shallow-water`, `bridge-deck` and `ledge-top`.

- Seamlessness is **mathematical, not eyeballed**: value noise samples a
  periodic lattice whose period divides the tile size, and the shading pass
  samples neighbours with wraparound so lighting wraps too.
- Shading is a real lit surface: multi-octave height field to normal to
  Lambert plus a Blinn highlight, against one shared light direction so every
  material reads as part of one world.
- Constructed surfaces get structure carved into the height field before
  shading, so joints catch light like geometry: `bridge-deck` gets planks with
  end joints, `industrial-slab` gets a panel grid. This is what makes a deck
  read as *built* rather than *noisy*.
- `--verify-seamless` compares wrap-edge delta against interior adjacent-pixel
  delta and fails on an anomaly. A first version of that check simply required
  opposite edges to be near-identical, which is wrong for high-frequency
  detail and produced a false failure; the statistical form is the shipped one.
- Deterministic: integer hash, no RNG, no timestamps.

### Runtime tiling

New `apps/hmh-reboot/src/terrain-tile-atlas.mjs` holds the registry and hands
out tiling sprites. `world-production-art.mjs` now places pooled sprites for
district ground, rectangular surfaces, and roads.

**Two implementation traps, both hit and both recorded so they are not
repeated:**

1. `Graphics.fill({ texture, matrix })` **cannot tile.** Pixi batches graphics
   fills, and batched samplers cannot use repeat addressing, so the tile
   clamped and stretched its edge pixels into long streaks. `TilingSprite` has
   its own shader that wraps correctly and is the only reliable primitive
   here.
2. Repeat addressing must be set on `source.style` (`addressMode`,
   `addressModeU`, `addressModeV`) with an explicit `update()`. Assigning only
   the `source.addressMode` convenience property left the sampler clamping.

Layering matters: water, bridge decks and ledges paint an opaque base into the
`surfaces` layer, so their material sits in a **separate container above that
layer** or the fill hides it. Roads are stroked polylines rather than
rectangles, so they tile through one viewport-sized sprite **masked** by the
road stroke.

### Readability cues

- Shoreline foam: a bright inner band hugging every water edge — the clearest
  "this is water, do not stand here" signal.
- Raised surfaces keep their cast shadow, lit top edge and shaded front lip
  from Cycle 005. These draw in a dedicated `surfaceCues` layer **above** the
  opaque deck material — drawing them below it hid them entirely.

### Escape hatch

`?flatTerrain=1` restores the flat colour fills for regression comparison.

## Preserved invariants

- Projection-only. Surface semantics — what is walkable, what is water, what
  elevation a tile sits at — still come from the authored world contract in
  `level-one-world.mjs`. A test strips comments from the new module and asserts
  it contains no gameplay vocabulary.
- Flat-colour fill remains beneath every tiled surface, so a missing or failed
  tile degrades to exactly the previous appearance rather than blanking the
  world. Terrain loads asynchronously and never blocks boot.
- Fixed 60 Hz, four catch-up steps, bridge and save schema unchanged.
  `SETTLEMENT_LIVE` remains `false`.

## Gates

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — 332 JS modules + 49 Python scripts |
| `npm run test:release` | PASS — `1733 total / 1681 passing / 52 accepted legacy / 0 unexpected` (+12) |
| `npm run build` | PASS — HMH bundle **1,017,072 bytes**, under the 1,050,000 gate |
| `npm run assets:hmh:terrain` | PASS — 11 materials, seamless verified |
| `npm run visual:reboot` | 8/8 scenes changed as intended; baselines re-accepted after inspecting PNGs |
| `npm run assets:qa:hmh-reboot` | PASS |
| `design:security-audit` | PASS — 5/5, zero findings |
| `design:web3-audit` | PASS — 9/9 |
| `repo:health:strict`, `docs:links` | PASS |
| Chrome five-viewport certification | PASS |
| `smoke:portal:e2e` | PASS — six flows |
| `smoke:hmh:collectibles`, `smoke:hmh:cockpit` | PASS |
| `smoke:hmh:performance` | PASS — desktop/mobile p95 **7 ms / 7 ms**, unchanged |

Frame time is unchanged: tiling replaces the three-pass procedural
`drawDistrictMaterial` once tiles load, offsetting roughly ten added sprite
quads. Sprites are pooled across frames, though the pool lookup itself still
allocates a filtered array per placement — a small, known inefficiency rather
than the "no per-frame allocation" an earlier draft of this ledger claimed.

## Independent review

Reviewed adversarially against the exact staged index. Verdict: **BLOCK**, two
must-fix defects, both reproduced by the reviewer in a real browser and both
fixed and re-verified the same way:

1. **Every road rendered solid white whenever tiles were absent.** The road
   mask is a live white Graphics stroke until Pixi excludes it on assignment.
   When no tile existed it was never assigned, so it painted the road surface
   white — on every cold boot before the 1 MB of textures resolved, on any
   load failure, and under the `?flatTerrain=1` escape hatch, making that
   comparison path unusable for the comparison it exists for. The mask now
   defaults to hidden and is shown only after assignment. Verified by capture
   in all three states.
2. **The opaque surface tile buried the readability cues.** `surfaceSprites`
   sits above `layers.surfaces` at alpha 1, so the shoreline foam, lit top
   edge, front lip, water depth gradient, shimmer bands and caustics were all
   painted over — precisely the cues this cycle exists to add — and were still
   computed every frame. They now draw into a dedicated `surfaceCues` layer
   above the tile container.

The review also caught a **dishonest test**: the original
"water and raised surfaces keep their explicit readability cues" asserted that
two *comment strings* existed while the behaviour they described was hidden.
It has been replaced with assertions on layer ordering and draw targets, plus
new tests for the mask-visibility contract and the sprite-pool mask exclusion.

Also applied from the review: terrain load status is now published to
`dataset.terrainTiles` / `terrainTilesLoaded` / `terrainTilesError` (it was
write-only, so a failure was silent and the visual harness could not gate on
it); `--verify-seamless` now derives its limit from the median of the interior
delta distribution rather than a single midline pair, which could pass a real
edge step where structure inflated that one sample; and the unused
`terrainTilingOffset` export was removed.

## Evidence

- Before: `.tmp/art-review/before-bridge.png`, `before-ravine.png`
- After: `.tmp/art-review/after-bridge.png`, `after-ravine.png`, `after-mining.png`
- Material sheet: `.tmp/art-review/terrain-tiles.png`, `structured-tiles.png`
- Fallback proof: `.tmp/art-review/flatterrain.png` (escape hatch),
  `tiles-blocked.png` (all tile requests aborted) — both render the previous
  flat-colour world with correct tan roads and report
  `dataset.terrainTiles = flat-colour-fallback`.

## Not in this cycle

The same playtest raised two more items. Neither is addressed here:

1. **Pickups and weapon drops are unidentifiable.** They remain vector shapes.
   The enemy-roster Blender pipeline is the template for authoring distinct
   3D icons per collectible type.
2. **Character and enemy models lack detail.** Bodies are primitive-built and
   render at 128px. Raising this means more geometry (face, hands, feet, gear),
   a better lighting rig, and a higher render resolution.

Carried debt also unchanged: roster renders at a 45-degree camera pitch versus
the heroes' 55; `assets:qa:hmh-reboot` still inspects only hero atlases; legacy
`visual:regression` still broken for the reboot.

## Deployment state

**Not pushed.** Production remains Cycle 021 (`a81f1c8f`,
`https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app`), verified
healthy earlier today. Pushing, deploying and promoting all require explicit
approval per the Cycle 021 handoff stop boundaries.
