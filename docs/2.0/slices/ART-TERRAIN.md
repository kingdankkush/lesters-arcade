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
  soft on the phone tier. (Repeat broken by three blended samplings in the
  2.1 world visuals pass below; still soft on the phone tier.)
- Cliff tops of the big closed masses are uniform rock with moss patches; no
  vegetation clusters. (2.1: fissures and ledges; still no vegetation.)
- Phone frame cost of the 10-sampler terrain quad plus road strips is not
  measured.

## Phone-tier performance (2026-10-01)

Probe: `perf-probe-isolate.mjs` (headless Chrome, 414×896 @3, CPU throttle
4×, 8 s walk east from the Meadows spawn), portal served from this worktree
after `node build.mjs`, under the heavy lock. Absolute numbers move with
machine load (the coordinator's run measured 30.5 fps with art and 52 fps
without), so the before and after rows were taken in the same session.

| Run | fps | p50 ms | p95 ms | frames > 50 ms | heap MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| before, area art (CPU profile on) | 46.1 | 20.8 | 34.8 | 1 | 71 |
| before, `?areaArt=0` | 100.9 | 7.0 | 14.0 | 0 | 28 |
| after, area art (CPU profile on) | 123.9 | 7.0 | 13.9 | 1 | 39 |
| after, area art (no profiler) | 103.9 | 7.0 | 20.8 | 1 | 48 |
| after, `?areaArt=0` (no profiler) | 130.4 | 7.0 | 13.9 | 0 | 25 |

The profile showed the cost was Pixi walking the scene graph, not our code:
the camera moves the area-art root every frame, so Pixi recomputed the
transform of every descendant (`updateTransformAndChildren` + `appendFrom`
≈ 1.9 s of 9.3 s sampled), and the shared depth `RenderLayer` sorted every
attached node — including ~480 closed-mass solids (≈ 3,000 nodes) that were
merely `visible = false`. Fixes, all in the lazy chunk:

- The ground container is its own render group, so moving the root no longer
  re-walks terrain, roads, decals and fog.
- Solids build lazily the first time they come into view, leave the scene
  graph and the RenderLayer when they leave it, and are destroyed beyond two
  views; their blocker ids are still claimed at bind so production never
  draws a slab under them.
- Residency and solid culling run only when the camera moves 48 units or the
  zoom/view changes, against a view padded by that cell; props outside the
  view are detached instead of hidden.
- Fog is static on the phone tier; the binding reuses one camera object per
  frame; terrain field bytes are released once uploaded.

Visuals are unchanged: re-captured City highway, Woods camp and Ledger Ridge
(desktop and phone) match the `final/` receipts apart from props added by
the newer integration plans.

## World visuals pass: water, elevation, cliffs (2.1, 2026-10-01)

Lane WORLD-VISUALS, branch `claude/201-world-visuals` on live 2.0.0
(`f044868ff`). Owner playtest: "Some of the level assets looked incomplete
or elevation and cliffsides sometimes looking wonky", plus better water.
Projection only, all in the lazy area-art chunk. On the 2.0.0 base
`node build.mjs` reported `HMH initial JS + shared: 996,019 B` before and
after these changes; after merging integration `aed85e132` it reports
998,820 B, the integration's own growth (none of this lane's symbols are in
`game.js` or its static chunks). The `world-v2-area-art-binding` lazy
chunk grows from 42,417 B to 70,307 B (merged build).

### Survey

Real child (`?mode=free&world=ten-area&evidenceSafe=1`), headless Chrome
under the heavy lock, desktop 1280×800 @1x and phone 414×896 @3x, one page
load per waypoint through the evidence-only spawn `tenAreaEvidence=at:x,y`
(`world-v2-combat.mjs`, clear points only, never Ranked). 83 waypoints come
from the authored geometry: 10 area centres, 28 road mid-points and mouths,
11 water views (every bridge, three bank views per channel, the waterfall
shelf), 8 decks + the City gantry ramp, 14 named cliffs (standing below the
camera-facing foot) and 10 frontier seams. Receipts:
`docs/2.0/receipts/world-visuals-20261001/` (`before/`, `after/` contact
sheets and full-resolution shots, JPEG, `survey-*.json`).

| # | Class | Sev | Finding (before) | Status |
| --- | --- | --- | --- | --- |
| F1 | Water | H | Both authored water bodies (`scrypt-bayou-channel`, `hashwood-river-channel`) were invisible: the opaque area splat quad painted marsh/forest over the channels; river bridges stood on grass, reeds lined a dry "bank". | Fixed |
| F2 | Elevation | H | No deck, ramp or bridge was drawn (8 decks, 20 ramps, 4 bridges): the hero floated 24 units above flat ground on every deck and crossing; ramps had no slope or edge. | Fixed |
| F3 | Cliff | H | Rock slivers: 316 of the 483 closed-mass strips are under 60 units wide; every downward jog of their ragged long sides drew a full 180-unit face, so rows of brown spikes stood along every frontier and road corridor. | Fixed |
| F4 | Cliff / seam | H | Shared edges between abutting strips were ragged, faced and lipped on both sides (overlaps, gaps, lips across one mass); a footprint contact-shadow ellipse per strip drew dark hairlines over the neighbouring roofs. | Fixed |
| F5 | Cliff / elevation | H | The 180-unit masses on every area's south frontier drew their roof over the last ~180 units of walkable ground: the hero vanished behind rock at the south edge of an area. | Fixed |
| F6 | Cliff | M | Rock-face strip stretched once over the whole face (128 texels over 180–420 units, up to 6.5× anisotropic) and repeating every 260 units. | Fixed |
| F7 | Incomplete asset | M | Card buildings stood in front of a translucent lifted "mass" box (massAlpha 0.2–0.6) that read as a leftover greybox volume. | Fixed |
| F8 | Incomplete asset | M | The river crossings were a 430-unit stone-arch card (`b2-41`) standing alone on grass. | Fixed (card removed; the bridge is drawn) |
| F9 | Incomplete asset | M | Hollow Pines cemetery walls and the stone monument read as flat grey boxes. | Improved |
| F10 | Ground | M | Bayou plank walks were rasterised as meandering mud-coloured bands. | Fixed |
| F11 | Seam | M | The 1,000-unit gaps between areas (road corridors) showed bare production ground in a hard rectangle around the road. | Fixed |
| F12 | Cliff | L | Broad rock tops are one uniform slab. | Improved (fissures, ledges); no vegetation clusters |
| F13 | Water | M | Silver Coast has no authored water: the coast reads as a sand plain under cliffs. | Open: needs an authored sea/shallows piece (collision decision) |
| F14 | Seam | L | Dirt road ruts ran ruler-straight. | Improved (ruts wander) |
| F15 | Ground | L | Fortress/City paving tile grid repeats visibly. | Open |

### What changed

| Piece | File |
| --- | --- |
| Water shader, shore field, deck/ramp/bridge builder, rock-face variant weights, solid occlusion index | new `apps/hmh-reboot/src/world-v2-area-surfaces.mjs` |
| `paintSurfaces` (water, shadows, raised meshes, rails), combined rock mesh, exposed-edge rag/face/lip rules, foreground height, readability fade, card footing, wall courses, feathered terrain reach, wandering ruts | `world-v2-area-art.mjs` |
| Surfaces painted after every area's ground and road | `world-v2-area-art-binding.mjs` |
| Built trails (planks, paving) stay straight | `world-v2-terrain-field.mjs` |
| Stone-arch cards removed | `world-v2-area-plans/hashwood-river.mjs` |

- **Water.** One quad per water body (`area-water-<id>`) through
  `WATER_FRAGMENT`: a deterministic shore field (signed distance to the
  waterline from 56 units on the bank to 199 into the water; 8 units per
  texel, 16 on the phone tier, one grey canvas) drives a shallow-to-deep tint
  from the area palette (bayou olive-green, river grey-teal, off the cyan
  pickup band — test-enforced), wavelets in flow-aligned coordinates drifting
  with the current (two quintic value-noise octaves, a third on the full
  tier), lit from the shared upper-left key, a bent sky gradient, bank
  occlusion, a broken foam line and a wet dark band on the land. Only the shore
  texture is sampled. The drift is frozen on the phone tier and under reduced
  motion (`settingReduceMotion` or the media query).
- **Decks, ramps, bridges.** `buildRaisedSurfaces` turns every deck, ramp
  and bridge piece into a top quad lifted by the authored height at each
  corner, the district kit (timber planks turned across the travel
  direction; stone or concrete slabs with staggered joints), a worn rim, a
  low-to-high gradient and cleats on ramps, the camera-facing face down to the
  ground or the water (skipped where a ramp continues at the same height), a
  down-right cast shadow and rails on both long sides of every bridge. They
  paint in the ground layer above water and roads, below every actor.
- **Cliffs.** Each authored edge is exposed unless another solid at least
  60 % as tall (or the world edge) covers its outside. Shared edges stay
  straight (corners only slide along them) and get no face or lip; faces
  stand only on exposed edges that face the camera. Roof and faces are one
  mesh per solid (`SOLID_FRAGMENT`, one draw call as before). The face samples
  the strip three ways (periods 260/337/211) blended by `rockFaceVariant`
  (deterministic hash noise, test-enforced), mirrors it vertically every 110
  units and carries the lit lip and dark foot. A rock mass with walkable
  ground directly behind it draws lower (closed masses as a 56-unit
  foreground rim, area cliffs at no less than 55 %); any solid that still
  covers an actor's chest fades to 50 %. Rock solids no longer draw a
  footprint ellipse (their AO is in the terrain field).
- **Cost control.** Water and raised-surface nodes leave the ground pass
  while off view (one custom-shader draw each); the first three frames after
  bind draw them all plus one degenerate rock mesh so the water, raised and
  rock programs compile during load (the first desktop runs showed a
  ~180 ms frame on first sight). District control fields are built in
  24-row slices between frames with per-row feature bands (same bytes).
- **Integration (`aed85e132`).** Bridge decks now span exactly the
  channels; the collision lane's bank guards (8 units, inside every
  deep-water edge) and rail guards (40 units, ramp foot to ramp foot) are
  claimed by the area art: the water edge draws the bank, and rails now run
  along the crossing ramps as well as the decks. Guards and prop-card
  colliders never count as rock when cliff edges are classified.
- **Assets and seams.** Card buildings mark their footprint with a grounded
  footing; built walls get block courses (masonry) or boards (timber) and a
  coping lip; plank and paved trails stay straight; each district's splat
  quad (and its control field) reaches 560 units past the area and feathers
  over the last 120 with noise, so neighbouring areas blend across the
  corridors.

### Performance (same session, heavy lock, `perf-probe.mjs`)

| Build | desktop ten-area fps | phone-4x ten-area fps (two runs) |
| --- | ---: | ---: |
Alternating base/new builds in one lock session (`perf-probe.mjs` as
given, which measures from 1.5 s after the run starts, and a "steady"
variant that waits for `areaArtStatus === 'ready'` first). Base is
`d4df715e4` (live 2.0.0 visuals); new is `7d37d5bfe` (all fixes, before
the integration merge).

| Probe, run | base phone-4x fps | new phone-4x fps | base desktop max frame | new desktop max frame |
| --- | ---: | ---: | ---: | ---: |
| steady 1 | 54.1 | 68.4 | 69.5 ms | 13.9 ms |
| steady 2 | 68.1 | 62.1 | 69.4 ms | 14.6 ms |
| given probe 1 | 53.8 | 65.1 | 69.6 ms | 13.7 ms |
| given probe 2 | 69.8 | — (timeout; legacy fell to 33 fps under outside load in the same run) | 69.6 ms | 20.9 ms |

Desktop ten-area holds ~143–144 fps on both. The earlier runs without the
culling and warm-up measured 46–60 fps on phone-4x and a 170–740 ms
desktop frame; those causes are fixed above. Machine load from other lanes
moves single runs by ±10 fps, so only same-session alternating rows are
compared.

### Not done

- Silver Coast still has no water (F13); a sea or shallows needs an authored
  water piece and a collision decision.
- Fortress/City paving grid repeat (F15); vegetation clusters on rock tops.
- Owner art acceptance is not claimed.
