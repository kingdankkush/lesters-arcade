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

## Roads, banks, signs and fog (second window, 2026-10-01)

Merged integration `7d26c1880` and then `31022b045` (Farms, River, City,
Coast and Bayou plans attach `ground.terrain`). Commits `bdde94cf1` (roads +
banks), `e13117d0c` (splat slots, coherent rock edges, signs, fog),
`7a7242847` (rock faces), `3750fd22b` (City street rule), `b4bb508c3`
(half-tier frames) and the receipts commit. Still lazy-chunk only: every new symbol lands in
`chunks/world-v2-area-art-binding-*.js`; `node build.mjs` reports
`HMH initial JS + shared: 993,366 B` (the integration candidate number; the
grep of `hmh-reboot/game.js` and its static chunks finds none of the new
code).

- **Road meshes** (`paintRoadMesh`, GLSL `ROAD_FRAGMENT`): one mitered strip
  per authored road with `(lateral, along)` attributes. Opaque core
  (`coreFraction` of the authored width: paved 0.78 asphalt, gravel 0.62,
  dirt 0.5 of a new dusty `track` material) with an edge eroded by two noise
  octaves; shoulder (gravel or earth) fading `shoulderOut` beyond the authored
  half width into the splat ground; tyre ruts at `rutOffset`; a worn,
  dashed chalk centre line on paved roads; faded ends where a road enters an
  area. Drawn dirt → gravel → paved (`rank`), then every `b2-47` crack card
  on top. The Graphics recipe remains the fallback when no GL program can be
  built (headless tests).
- **Banks and bare masses**: outlines get a ragged edge from world-space
  noise (−8…+26 units, mostly outward), so the hundreds of thin closed-mass
  strips that share one straight run break it continuously. Roofs are a
  triangulated mesh through the grain shader (`SURFACE_FRAGMENT`, moss
  patches on rock); faces only on edges whose outward normal points down the
  screen, shaded from the authored edge, mapped world-continuously in u, with
  a two-step dark foot and a lit lip. Back edges get a thin shadow lip only.
  Every `closed-mass-*` and `world-guard-*` blocker id is in the binding's
  `blockerIds`, which the production renderer skips (test-enforced), so no
  old flat slab draws under a bank.
- **Splat slots for every zone**: zones and trails whose material is not one
  of the area's three now take one of two extra slots (largest painted area
  first, weights in the light canvas G/B) or fold onto the nearest colour, so
  no straight-edged Graphics zone fill remains under the splat. Built
  materials (asphalt, paving, masonry, boardwalk) keep a near-straight kerb;
  natural ones wander. Trails meander (±55 units at a 460-unit scale) and
  wear patchily. Control canvases are 384² on desktop (256² phone).
- **City signs**: plans may carry `signs` (validated 1–28 plain characters,
  cue-safe panel/ink). The Litecoin City plan letters every placed carrier
  and both facades from `city-branding.mjs` (`signForProp`/`signForPiece`);
  the renderer bakes each name once on a canvas (condensed capitals, chalk on
  slate) and stands it on the carrier.
- **Bayou fog**: `ground.fog` cards (≤ 0.4 alpha) in the ground layer under
  every actor; the Scrypt Bayou plan lays 17 along the channel and banks;
  slow drift, still under reduced motion (`settingReduceMotion` dataset or
  the media query).

Decoded ground pages per area (tiles + fringes + rock face + 2 × 384²
control): 6.4–7.9 MB, gate ≤ 8 MB in tests; the world-roads plan loads
crushed-ore, packed-earth, road and the earth/track grains (≈ 5 MB, shared).

- **City street rule and half-tier frames**: junction masts sit on the
  pavement (≤ 160 units, fading); no ground card taller than 100 units within
  120 units of a walked street/road centreline. Half-tier kit pages load at
  Pixi resolution 0.5 (`@0.5x`), so card frames and fill matrices are now in
  texture units — this fixed cropped cards across the whole phone tier.

Receipts: `docs/2.0/receipts/terrain-roads-20260930/` (`pass-1/` before,
`final/` after, JPEG, 4.6 MB, `review.md`).

## Not done (next window)

- City junction corners round off where two asphalt zones meet (the field
  ramp makes a soft outside corner); a kerb line would read better.
- The rock-face strip is a 512×128 bake: it repeats every 260 units and is
  soft on the phone tier.
- Cliff tops of the big closed masses are uniform rock with moss patches; no
  vegetation clusters.
- Phone frame cost of the 10-sampler terrain quad plus road strips is not
  measured.
