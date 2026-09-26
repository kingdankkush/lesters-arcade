# Chikun obstacles: rendered art built on the collision shapes

Slice 2 of the Chikun visual upgrade (owner direction: "better 3D models for
everything, better animations, better lighting"). Gameplay is untouched:
`tests/chikun-sim-identity.test.mjs` still pins the twelve simulation,
course, evidence and runtime modules plus `obstacle-shapes.json` to their
1.8.2 SHA-256, and nothing in this slice reads anything but the frozen
obstacle object and the tick.

## The rule: the collision is the truth

Every obstacle kind is modelled in Blender against its collision shapes, not
the other way round. `scripts/build-chikun-hitbox-templates.mjs` calls the
canonical `buildCourseObstacle()` (read-only) across seeds, indices and the
difficulty ramp and writes `scripts/chikun-blender/obstacle-templates.json`:
each kind's shapes relative to its anchor and the range of every size the
course can produce. The Blender modules frame their pixel-exact cameras from
the same anchors:

| Anchor | Kinds | How heights vary |
|---|---|---|
| Running line (y 690) | rock, log, thorn, hurdle, crate, shiba, pit, waterfall, trunks | fixed |
| Rect top | building caps, forest columns, pipe caps | facade columns (anchored on the running line) are cropped under the cap; forest columns are cropped at the running line and an undergrowth strip covers the cut |
| Rect bottom | canopy, storm | the column hangs from the top of the screen; rows above y 0 are skipped |
| Tree top (690 - height) | crowns | the trunk column is cropped under the crown |
| Obstacle y | drone, plane, hawk, eagle, pelican | fixed |

Screen-space modelling: one Blender unit is one logical pixel, the camera is
orthographic, pitched 19 degrees like Chikun's rig (the high-wing plane uses 7
degrees so its wing does not hide the cabin), and `rig.P(sx, sy, depth)` maps
a screen point to the world. A sphere of radius r projects to a circle of
radius r, so tree crowns are leaf volumes filling exactly the three collision
circles, the rock is a faceted boulder in its circle, the log's silhouette is
its rect.

## What ships (apps/portal/assets/generated/chikun-obstacles-v2)

| Kit | Sprites |
|---|---|
| common | 15 props with region variants (produce, steel and cardboard crates; hay bales, café barrels, traffic drums, jersey barrier, clipped hedge; oak, mossy, timber and driftwood logs; mossy and coastal boulders; the bramble), 4 tree crowns and 4 trunks, shiba (12-frame idle: tail wag, bark, breathing), hawk / eagle / pelican (8-frame flap, hinged wing rig), delivery drone (4-frame ducted rotors, LEDs), prop plane (4-frame propeller, nav lights), coin (12-frame spin, embossed Ł), storm cell (volumetric) |
| farmland | soil pit |
| forest | two forest-wall columns and their undergrowth, loam pit, mossy waterfall with its scrolling water sheet, bough canopy |
| town | three facades (half-timber, terracotta with shutters and balconies, sandstone with arched windows) and their roofs |
| city | three facades (glass curtain wall, brick with fire escape and neon, concrete ribbon windows) and roofs, green utility pipe, scaffold canopy |
| industrial | concrete trench pit, rusty pipe, pipe-rack canopy |
| suburbs | three facades (mint clapboard with porch, butter with bay window, blush brick with garage) and roofs |
| coast | tidal pit, basalt waterfall with its water sheet |

The runtime picks a variant by the obstacle's own region
(`regionForObstacle(o.index)`), so an obstacle never changes look when the
scenery switches around it. Building styles follow a hash of the obstacle
index so neighbours differ.

Removed from the rendered path: the "LOW PASSAGE", "GAP", "WATERFALL",
"SHIBA!" labels and the shop names. On lap 1 the two low passages (storm and
canopy) carry a small down-chevron badge instead of "FLY LOW / RUN". The
portrait AHEAD box in `main.mjs` is unchanged. The 1.8.2 code-drawn obstacles
(and their labels) remain as the fallback.

## Runtime (apps/chikun/src/obstacle-art.mjs)

- `layoutObstacleArt(o, {tick, reduced})` is pure: the sprite, animation
  frame, destination and visible rows/columns of every draw. Animations are
  functions of the tick (12 or 24 fps, phase-locked by the obstacle index);
  reduced motion parks every animation on frame 0 and freezes the water.
- Kits load through `Image` + `decode()` (the service worker's cache-first
  image rule applies), t2 (2x) art above density 1.3, two downloads at a
  time, 12 s timeout, no retry storm. `main.mjs` calls `loadGroundArt()` at
  boot, which now starts the common and farmland kits at a density guessed
  from the window; `drawGround()` then keeps common plus two region kits: the
  previous and current ones for the first 600 ticks of a region (its wide
  last obstacles are still leaving the screen), then the current and next ones
  (the next kit loads at least 460 ticks before that region's first obstacle
  appears). The kit schedule reads only the scenery clock, never the obstacle
  list.
- Each sprite is prescaled once per density into integer device slots (frames
  side by side, 2 device px apart), so every draw is a 1:1 blit at an identity
  transform. A density change waits 200 ms, then re-prescales; until then the
  old canvas draws scaled.
- Lighting: facades take the time-of-day grade as fills over their collision
  rects below the roof line; every other sprite uses a graded copy (gameplay
  strength 0.72) rebuilt when the quantised grade changes, at most two per
  frame, LRU-capped at 2.5 M device px (10 MB). Lit windows, lamps, drone LEDs and plane
  nav lights are added with `'lighter'` after the grade, scaled by the rig's
  `lightsOn`. Grounded obstacles get a soft contact shadow on the trailing side
  (strength from the rig's `shadowAlpha`); flyers a faint one on the ground.
- Storm weather is drawn inside the cell's own extent: rain in its lower part,
  a drizzle below it (at most 15 % alpha) and at most one lightning flash per
  two seconds, all from the tick and the obstacle index (off under reduced
  motion).
- Fallback: any sprite an obstacle needs that is missing or failed makes
  `drawObstacleArt()` return false and the 1.8.2 code path draws that
  obstacle. The 1.8.2 prop sprites (`chikun-ground-props-v1`) now download
  only when a v2 kit has failed.
- Look-ahead: nothing is drawn for an obstacle beyond either edge of the view.
- Debug: `?chikunDebug=art` adds `obstacles` (resident kits, bytes, graded
  pixels, failures) to `window.__chikunArtStats`; `?chikunDebug=hitbox`
  outlines the collision shapes of drawn obstacles (never in Ranked).

## Pipeline

```bash
# Collision templates (read-only against the course)
node scripts/build-chikun-hitbox-templates.mjs          # --check verifies it is current

# Render (Cycles on the GPU, ~5 min for all 67 sprites). Output goes to ../chikun-render-cache/obstacles.
"D:/Apps/Blender/blender.exe" -b --factory-startup --python-exit-code 1 \
  -P scripts/chikun-blender/build-chikun-obstacles.py -- --out ../chikun-render-cache/obstacles [--kit common | --only shiba,drone] [--samples 96]

# Pack: ink contour, trim, frame strips, t1, WebP, manifest, catalog, coverage masks
python scripts/build-chikun-obstacle-pack.py

# Review plates (every kind of each region over its backdrop at noon, golden hour, night, dawn)
python scripts/build-chikun-obstacle-review.py [--regions city] [--hitbox]
```

- `scripts/chikun-blender/obstacles/`: `rig.py` (camera, pitch, key / fill /
  rim / bounce lights, sky-over-ground environment, Standard + Medium High
  Contrast), `geo.py` (bmesh builder: boxes, cylinders, blobs, tubes, cards,
  prisms), `mats.py` (Cycles material library: wood, bark, stone, fur,
  feathers, straw, paint, rust, concrete, glass, water, leaf cards, emission
  pass switch), `fit.py` (screen-space fitting), one module per family
  (`props`, `trees`, `creatures`, `machines`, `structures`, `terrain`) and
  `registry.py` (every sprite: kit, anchor, frame, animation).
- Foliage (crowns, forest wall, bough canopy) is leaf cards scattered through
  the collision volume with a lobed skin and noise-gathered clusters, cards
  facing outward along the lobes, so the key light models round masses.
- The packer adds a 1 px ink contour (2 px at t2) from each sprite's own
  darkened edge colour, except for soft or tiling art (storm, pits, forest
  wall, water sheets).
- `manifest.json` records per sprite the Blender version, samples, device,
  render time and the SHA-256 of every build script (`scriptSets`); the
  catalog `apps/chikun/src/obstacle-catalog.mjs` is generated. No `.blend` or
  `.glb` is committed.
- `tests/chikun-obstacle-masks.json` (a test fixture, not shipped) holds a
  coverage mask per sprite frame on a 2 px grid.

## Alignment (measured, `tests/chikun-obstacle-art.test.mjs`)

Every kind is laid out by `layoutObstacleArt()` for 3 seeds x 7 regions x 2
laps (the geometry ramps with the obstacle index) x 4 ticks (animation
frames), and measured on a 2 px grid against its collision shapes (visible
area above the running line): coverage of each shape by art with alpha >= 0.5,
how far art leads the leftmost collision point, the largest empty hole inside a
shape (distance to the nearest art) and how far art reaches outside. The test
pins each kind to thresholds just below these values.

| Kind | Min coverage | Max leading art (px) | Max hole (px) | Max art outside (px) |
|---|---|---|---|---|
| rock | 98.2% | 5 | 2 | 15 (ferns at the foot) |
| log | 87.8% | 5 | 8 | 9 |
| thorn | 97.6% | 3 | 2 | 5 |
| hurdle | 88.2% | 5 | 8 | 5 |
| crate | 96.1% | 1 | 4 | 1 |
| shiba | 75.3% | 1 | 16 | 7 |
| willow / cherry / maple / oak | 98.9 to 99.6% | 3 | 4 | 30 (root flare on the ground, inside the trunk's reach) |
| drone | 68.7% | 0 | 10 | 7 |
| hawk / eagle | 69.6% | 0 | 16 | 21 (wingtips) |
| pelican | 76.7% | 9 | 16 | 21 |
| plane | 76.6% | 1 | 16 | 14 |
| storm | 99.3% | 11 | 14 | 17 (billow edges) |
| pipe | 94.1% | 3 | 10 | 3 |
| forest | 99.7% | 11 | 2 | 11 (crown fringe) |
| town (all 9 styles) | 98.9% | 3 | 2 | 15 (chimneys, antennas) |
| canopy | 100% | 11 | 2 | 15 (hanging vines) |
| waterfall (rock column) | 100% | - | 0 | - |

Pits are checked by anchoring: the sprite's hole is modelled on x 0..420 of the
template and lands on o.x .. o.x + 420, with rims fading out beyond both lips.
Flyer hitboxes are stadiums wider and taller than any bird or drone
silhouette; their art fills the core and the largest hole (16 px) stays well
under Chikun's 30 px radius. The legacy open-air tree and drone sprites
(`chikun-open-air-v1`, drawn from `obstacle-shapes.json` geometry for old
evidence replays) measure 97.9 to 98.8% (tree) and 56.8 to 59.5% (drone): the
drone's capsule is wider than its rotor sprite. Legacy flight is replay-only,
so this is recorded rather than redrawn.

## Budgets (measured)

| Kit | t2 download | t1 download | Logical px | Decoded at density 2 |
|---|---|---|---|---|
| common | 574 KB | 245 KB | 942 K | 14.4 MB |
| farmland | 23 KB | 9 KB | 28 K | 0.4 MB |
| forest | 391 KB | 137 KB | 509 K | 7.8 MB |
| town | 117 KB | 66 KB | 201 K | 3.1 MB |
| city | 198 KB | 92 KB | 443 K | 6.8 MB |
| industrial | 91 KB | 41 KB | 272 K | 4.2 MB |
| suburbs | 118 KB | 52 KB | 199 K | 3.0 MB |
| coast | 94 KB | 33 KB | 169 K | 2.6 MB |

A run starts with common + farmland (597 KB at t2, 254 KB at t1) after the
character atlases. At most two region kits are resident; graded copies are
capped at 2.5 M device px (10 MB) and only exist for sprites drawn while the
grade is not neutral. A node smoke over a whole loop at density 2 (every 20
ticks, fake images of the real sizes) peaked at 36.2 MB of obstacle
art, with every on-screen obstacle drawn from art and no fallback. The forest kit is the heaviest (three foliage
walls); with its backdrop it is about 600 KB at t2, far under the 1.5 MB per
region hard cap, but above the plan's 300 KB kit target: recorded here.

## Readability receipts

`docs/chikun/review/obstacles-<region>.webp` (noon and night rows) and
`obstacles.json` (all four keys) come from `build-chikun-obstacle-review.py`:
each region's backdrop with every kind it can spawn, graded as the runtime
grades them. Two metrics per obstacle: `body` (mean luminance of the obstacle
against a 12 px ring of backdrop, the plan's metric) and `edge` (the ink
contour band against the 3 px just outside it).

Most obstacles do not reach the plan's 3:1 `body` target yet, especially at
night (the grade darkens obstacles at 0.72 of the backdrop's strength, and
mid-value props sit on mid-value ground). They read clearly in the plates
through the ink contour, sharpness against the hazed backdrop and hue, but
the luminance numbers are the honest measure: the rim light and grade tuning
of slice 3 (lighting) should raise them, and Verify should check them in the
browser at every key.

## Not in this slice

- Rim light on obstacles, per-obstacle weather beyond the storm cell, steam
  puffs on pipes, waterfall mist particles, the coin's night halo (slice 3).
- `stormInView` on the scene bus and obstacle sounds (slices 3 and 4).
- Browser verification (Verify phase): frame-time p95 with obstacle art at
  densities 1, 2 and 3, heap and resident bytes (`?chikunDebug=art`), network
  bytes per kit, hitbox overlay screenshots (`?chikunDebug=hitbox`), a
  fallback run with `chikun-obstacles-v2` requests blocked.

Tripo credits used in this slice: 0 (Blender only). See `TRIPO-SPEND.md`.
