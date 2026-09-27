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
  strength 0.72) rebuilt when the quantised grade or value separation changes,
  at most two per frame plus six for sprites just coming into view (so a
  multi-part obstacle never enters ungraded and pops), up to four copies per
  sprite, LRU-capped at 2.5 M device px (10 MB). Value separation (below) is
  applied after the grade. Lit windows, lamps, drone LEDs and plane
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

## Value separation (apps/chikun/src/obstacle-separation.mjs)

The obstacle-contrast slice. Every obstacle draw is graded away from the
backdrop band it sits in until its body reaches a target WCAG luminance
contrast (the receipts' `body` metric):

- deepen: a source-atop fill towards a cool near-black (`[14, 16, 26]`; black
  for pits, which are holes and are never lifted), a multiply that keeps the
  art's texture;
- lift: the copy added onto itself (`'lighter'`, exposure x (1 + 1.7 s)), then
  a small wash of the key light's colour (the rig's `rim`: white sun at noon,
  amber at golden hour, blue moonlight at night; 0.2 s by day, 0.35 s at full
  night). A lift stops where the body's brightest mean channel would pass
  115 %, so a white barrier is not blown out. Facades, graded over their rects,
  lift with a plain fill.

Targets: 3.5:1 in daylight and 2.6:1 at full night within gentle amounts
(deepen <= 0.55, lift <= 0.4), else a floor of 2.6:1 (2.2:1 at night) within
firm ones (deepen <= 0.65, lift <= 0.65). The day target sits above the 3:1
goal because the model reads about 10 % high against the receipts. A sprite
goes its natural way first (a dark log stays dark, a hay bale stays bright);
the other direction is tried only when that fails and its own contrast with
the band is weak (below 1.5:1), so a pink blossom is never crushed to black.
Every part of a multi-part obstacle (a row of buildings, a tree's trunk and
crown, the forest wall's columns) goes one way, chosen by the parts'
area-weighted lean.

Inputs: the sprite's catalogued tone (mean sRGB and mean linear luminance of
its opaque pixels, written by the packer), the obstacle's own region, the
light rig and the rows the draw covers plus 12 px above and below. The
backdrop luminance behind those rows comes from `obstacle-backdrop-profile.mjs`
(generated by `build-chikun-obstacle-separation.py`: each region composited as
the review plates do at the four moments a key is alone in the rig, noon 0 s,
sunset 45 s, night 90 s, sunrise 135 s, eight scroll distances; mean and
lower/upper quartile per 24 px band). A deepen is solved against the mean of
the band's mean and lower quartile, a lift against its mean and upper
quartile, so a flyer stays separated as darker or brighter parts of its band
pass behind it.

Through the day: the separation is solved per key (each key's own grade,
profile row and night share) and blended by the rig's key weights, cubed, so
a blend leans on its dominant key and an obstacle deepened at noon and lifted
at golden hour cross-fades between the two instead of flipping on screen
(tested: over a whole day no step between 0.25 s buckets exceeds 0.1). Solves
are memoised per sprite, region, key, direction and rows (about 0.09 ms a
frame for six mixed obstacles in node, 0.66 ms before memoising). Nothing
reads the course ahead or any gameplay state; the look-ahead guard is
unchanged.

## Pipeline

```bash
# Collision templates (read-only against the course)
node scripts/build-chikun-hitbox-templates.mjs          # --check verifies it is current

# Render (Cycles on the GPU, ~5 min for all 67 sprites). Output goes to ../chikun-render-cache/obstacles.
"D:/Apps/Blender/blender.exe" -b --factory-startup --python-exit-code 1 \
  -P scripts/chikun-blender/build-chikun-obstacles.py -- --out ../chikun-render-cache/obstacles [--kit common | --only shiba,drone] [--samples 96]

# Pack: ink contour, trim, frame strips, t1, WebP, manifest, catalog, coverage masks
python scripts/build-chikun-obstacle-pack.py

# Backdrop luminance profiles for the value separation (~4 min; --check verifies it is current)
python scripts/build-chikun-obstacle-separation.py

# Review plates (every kind of each region over its backdrop at noon, golden hour, night, dawn)
python scripts/build-chikun-obstacle-review.py [--regions city] [--hitbox] [--no-separation]
python scripts/chikun-obstacle-contrast-summary.py [--json]   # medians, lowest kinds, targets met
```

- `scripts/chikun-blender/obstacles/`: `rig.py` (camera, pitch, key / fill /
  key-matched rim / cool counter rim / bounce lights, sky-over-ground environment, Standard + Medium High
  Contrast), `geo.py` (bmesh builder: boxes, cylinders, blobs, tubes, cards,
  prisms), `mats.py` (Cycles material library: wood, bark, stone, fur,
  feathers, straw, paint, rust, concrete, glass, water, leaf cards, emission
  pass switch), `fit.py` (screen-space fitting), one module per family
  (`props`, `trees`, `creatures`, `machines`, `structures`, `terrain`) and
  `registry.py` (every sprite: kit, anchor, frame, animation).
- Foliage (crowns, forest wall, bough canopy) is leaf cards scattered through
  the collision volume with a lobed skin and noise-gathered clusters, cards
  facing outward along the lobes, so the key light models round masses.
- Rim light (obstacle-contrast slice): a sun of the key's own neutral
  daylight colour from behind on the key's side (azimuth -128, elevation 26,
  strength 9) draws a sunlit edge along the upper left of every silhouette,
  the side that faces the sun in the scenery; the old cool back rim stays as a
  weaker counter rim on the right (strength 1). Every region's scenery is
  rendered in the same neutral key (SCENERY.md), so one rim matches them all;
  the runtime grade and the lift colour carry the time of day.
- The packer adds a 1 px ink contour (2 px at t2) from each sprite's own edge
  colour darkened to 20 % at full opacity (was 30 % at 90 %), except for soft
  or tiling art (storm, pits, forest wall, water sheets), and records each
  sprite's body tone for the value separation.
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
| common | 543 KB | 247 KB | 942 K | 14.4 MB |
| farmland | 24 KB | 9 KB | 28 K | 0.4 MB |
| forest | 400 KB | 142 KB | 509 K | 7.8 MB |
| town | 115 KB | 66 KB | 201 K | 3.1 MB |
| city | 195 KB | 93 KB | 443 K | 6.8 MB |
| industrial | 93 KB | 43 KB | 272 K | 4.2 MB |
| suburbs | 116 KB | 52 KB | 199 K | 3.0 MB |
| coast | 97 KB | 35 KB | 169 K | 2.6 MB |

(After the obstacle-contrast re-render: 1,622,544 B at t2 across the kits, was
1,645,216 B; 703,660 B at t1, was 691,126 B. Same frames and logical sizes.)
A run starts with common + farmland (568 KB at t2, 256 KB at t1) after the
character atlases. At most two region kits are resident; graded copies are
capped at 2.5 M device px (10 MB). Since the value separation they exist at
every hour (at noon too, where the grade alone was neutral), so the cap is
now reached in ordinary play rather than only at dusk and night; the
separation code and its backdrop profile add 21.6 KB of source
(`obstacle-separation.mjs` 11.6 KB, `obstacle-backdrop-profile.mjs` 10.1 KB)
to the child's lazily loaded chunk. A node smoke over a whole loop at density 2 (every 20
ticks, fake images of the real sizes) peaked at 36.2 MB of obstacle
art, with every on-screen obstacle drawn from art and no fallback. The forest kit is the heaviest (three foliage
walls); with its backdrop it is about 600 KB at t2, far under the 1.5 MB per
region hard cap, but above the plan's 300 KB kit target: recorded here.

## Readability receipts

`docs/chikun/review/obstacles-<region>.webp` (noon and night rows) and
`obstacles.json` (all four keys) come from `build-chikun-obstacle-review.py`:
each region's backdrop with every kind it can spawn, graded and separated as
the runtime does it (the layout dump runs the runtime's `separationOf()`).
Two metrics per obstacle: `body` (mean linear luminance of the obstacle
against a 12 px ring of backdrop, the plan's metric; `L` records both
luminances) and `edge` (the ink contour band against the 3 px just outside
it). Flyers cross the whole view, so each is measured at seven positions
along its row over the bare backdrop: `body` is their median, `bodyMin` the
worst, `sweep` all seven, `placed` the position in the plate. Every lineup
obstacle now belongs to the region it is shown in (the dump used to borrow
indices from the next region for small regions).

| Receipts | noon median | noon lowest kind | golden | night median | dawn |
|---|---|---|---|---|---|
| before (8e035a34, old tool) | 1.75 | 1.05 (log) | 1.51 | 1.31 | 1.52 |
| rim + ink only (`--no-separation`) | 1.63 | 1.09 | 1.44 | 1.35 | 1.48 |
| shipped (rim + ink + separation) | 3.14 | 2.27 (pit) | 2.78 | 2.76 | 2.81 |

Targets (this slice): noon median >= 3:1, no kind below 2.2:1 at noon, night
median >= 2.5:1: all met (`chikun-obstacle-contrast-summary.py`). The median
`edge` ratio rose from 1.83 to 3.19 at noon and from 1.25 to 1.87 at night.
The rim and ink alone do not move the body metric (the rim brightens a thin
edge, the ink darkens one); they are for the silhouette, and the separation
does the value work.

Where it is still low: pits at night (1.63; a black hole on dark soil at
night cannot go darker, and lifting a hole would misread it), trees at night
(oak 1.87: a dark trunk on a dark band), eagles at dawn and golden hour
(1.58, 1.62: the blend between keys trades a little contrast for no pops).

What a player sees: by day most obstacles are darker and more saturated than
before (logs, crates on bright bands, facades, pipes, storms, the forest
wall), light props on mid-value ground (hay, shiba, white barriers, drums)
are brighter, and some flyers go grey against a bright sky (the white drone
and pelican in farmland and coast). At night the play layer is moonlit:
obstacles are lifted in a cool light well above the dark backdrop (trunks and
driftwood read pale grey-blue), with lit windows over them.

## Not in this slice

- Per-obstacle weather beyond the storm cell, steam puffs on pipes,
  waterfall mist particles, the coin's night halo (slice 3). (The rim light
  and value separation shipped in the obstacle-contrast slice.)
- `stormInView` on the scene bus and obstacle sounds (slices 3 and 4).
- Browser verification (Verify phase): frame-time p95 with obstacle art at
  densities 1, 2 and 3, heap and resident bytes (`?chikunDebug=art`), network
  bytes per kit, hitbox overlay screenshots (`?chikunDebug=hitbox`), a
  fallback run with `chikun-obstacles-v2` requests blocked.

Tripo credits used in this slice: 0 (Blender only). See `TRIPO-SPEND.md`.
