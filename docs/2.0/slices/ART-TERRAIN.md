# ART — ten-area ground terrain (splat shader, control field, district pairs)

2026-09-30. Terrain lane, branch `claude/200-terrain`, on integration
`8cc3c9e3f`. Projection-only art for the ten-area world's ground, entirely
inside the lazy area-art chunk (`world-v2-area-art.mjs`,
`world-v2-area-art-binding.mjs`, `world-v2-area-art-schema.mjs`,
`world-v2-area-plans/*`, new `world-v2-terrain-field.mjs`). No initial-bundle
byte changed (`node build.mjs`: 663 B headroom including shared chunks, the
same 1,047,913 B candidate). No paid or generated art; every texture is an
existing `hmh-terrain-tiles` file. **Owner art acceptance is not claimed.**

## Why the ground read flat

Measured with Pillow, the tiles the area materials used are nearly flat colour:
`forest-floor` standard deviation 4/255, `packed-earth` 4, `road` 2,
`wet-bank` 3. Only `ledge-top` (17), `crushed-ore` (13), `bridge-deck` (16)
and the `rock-face` strip (25) carry grain. They were also tiled at 256–358
world units per repeat (57–80 texels per metre, not 128) through flat
`Graphics` texture fills with straight polygon edges and a 48–90 unit fringe.

## What shipped

| Piece | File |
| --- | --- |
| Grain-aware material registry (`color` + up to two `grain` layers with measured tile means), `DISTRICT_TERRAIN` pairs, `ground.terrain` validation, `wall` material on solids, `rock-face` overlay | `apps/hmh-reboot/src/world-v2-area-art-schema.mjs` |
| Deterministic control field (integer-hash value noise, zones, trails, road verges/dust, blocker AO + key-light cast, canopy bands) | `apps/hmh-reboot/src/world-v2-terrain-field.mjs` |
| Splat `Mesh` per area (GLSL 300 es, six grain samplers + two opaque control canvases), `@0.5x` tiles on the half tier, rock-face/ledge-top bank and mass solids with wall/roof materials, off-screen culling of static solids | `apps/hmh-reboot/src/world-v2-area-art.mjs` |
| Generic terrain plans for the eight undressed districts and the `world-masses` closed-mass plan, synthesised inside the lazy binding so the runtime world table never grows | `apps/hmh-reboot/src/world-v2-area-plans/district-terrain.mjs`, `world-v2-area-art-binding.mjs` |
| Meadows and Woods plans declare `ground.terrain` | `world-v2-area-plans/mweb-meadows.mjs`, `rugpull-woods.mjs` |

### Materials

Each material is a brief palette swatch (`color`) multiplied by amplified
tile grain. A grain layer samples one tile at `size` world units per repeat
(160 = 128 texels per metre at 40 units per metre), divides by the tile's
measured mean so the swatch survives, amplifies the deviation by `gain`
(2.4–2.8 for the flat tiles after the first inspection; 4–5 read as salt
speckle), optionally luminance only (`lum`, structure borrowed from
`ledge-top`/`crushed-ore`) and rotated 90° (`rot`) so the broad octave never
lines up with the fine one.

| District | Pair (+ accent) |
| --- | --- |
| MWEB Meadows | meadow + earth (+ gravel) |
| Litecoin City | paving + asphalt (+ gravel) |
| Halving Farms | soil + crop (+ earth) |
| Silver Coast | sand + wet sand (+ shallows tint) |
| Scrypt Bayou | marsh + peat (+ boardwalk) |
| Hashwood River | forest + moss (+ rock) |
| Hollow Pines | needle floor + rock (+ scree) |
| Ledger Ridge | rock + scree (+ dirt) |
| Fork Fortress | masonry + gravel (+ dirt) |
| Rugpull Woods | forest + camp earth (+ dirt) |

### Control field

`buildTerrainField({ summary, world, size })` returns RGBA bytes across the
plan bounds (512² desktop ≈ 7.8 units per texel, 256² phone): R = secondary
weight (macro patches from 3-octave noise at the district `patch` cell,
threshold at `1 - blend`; zones and trails whose material is one of the three
are rasterised with noise-wobbled feathers), G = accent weight, B = broad
value variation (2-octave noise at 1,500 units, ±`value`), A = light
(0.55–1.2: contact darkening at every blocker base with a down-right cast
from the shared upper-left key, darker discs under tree props, dust
lightening along the authored roads). The field is hashed from the area id,
never from simulation RNG, and `tests/hmh-world-v2-terrain.test.mjs` proves
byte-identical rebuilds. It uploads as two opaque canvases (weights/value and
light) so no data channel is alpha-premultiplied; the first pass through an
RGBA bitmap arrived on the GPU empty and painted the Meadows at 42 % value.

### Residency per area (decoded)

Ground pages only, before kit pages: 4–5 tiles × (1 MB + 256 KB fringe) +
rock face 256 KB + control 2 × 1 MB. Meadows/Woods 6.5 MB, City/Pines/
Fortress 6.5 MB, Farms/Bayou/River/Ridge 7.9 MB, Coast 7.9 MB after trimming
wet sand's broad layer; the test gate is ≤ 8 MB. Phone tier: `@0.5x.webp`
tiles, fringes and rock face (one quarter) and a 256² field (2 × 256 KB).

### Field build cost

Meadows 512² in Node: ~400 ms (110 nearby blockers). The binding awaits each
plan's `ready` with a `setTimeout(0)` between plans, so ten fields never land
in one frame; the phone tier is a quarter of the work.

## Evidence

`docs/2.0/receipts/terrain-20260930/` — real child,
`/hmh-reboot/index.html?mode=free&world=ten-area&evidenceSafe=1`, headless
Chrome under the heavy lock, desktop 1280×800 @1x and phone 414×896 @3x,
walked with WASD at 240 units/s. `review.md` holds the per-shot inspection.

## Not done (next window)

- Road ribbon meshes (opaque cores, eroded edges, shoulders, ruts, chalk
  centre line). Roads still paint through the previous `Graphics` recipe and
  read flat; the field only adds verge wear and dust beside them.
- Visual verification of the `world-masses` rock faces at a closed-mass edge
  in the real child, and whether the production renderer skip covers the
  `closed-mass-*` ids (the roads capture shows a rock-face strip at the left
  edge, the Meadows–Woods capture shows a flat brown band beyond the area
  border that was not resolved in the window).
- Phone-tier frame cost measurement (six samplers per fragment, full screen).
- Integration note: `61fad9308` on integration adds an authored Halving Farms
  plan; the binding prefers an authored `artTarget` over the generic terrain
  plan, but `tests/hmh-world-v2-area-art-binding.test.mjs` asserts
  `halving-farms-barn` among the blocker ids and will need that expectation
  moved to the authored plan.
