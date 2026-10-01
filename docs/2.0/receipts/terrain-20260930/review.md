# Terrain lane — real-child inspection, 2026-09-30

Real child at `/hmh-reboot/index.html?mode=free&world=ten-area&evidenceSafe=1`,
headless Chrome (WebGL) under the heavy lock, desktop 1280×800 @1x and phone
414×896 @3x, walked with WASD at 240 units/s from the Meadows spawn
(`real-child-report.json` has the per-capture status; `areaArtStatus` was
`ready` on every capture, no page errors). Honest notes per shot. Owner
acceptance is not claimed.

## Pass 1 (discarded)

The RGBA control bitmap reached the GPU empty: every weight, value and light
channel read zero, so the Meadows painted at 42 % value as a dark speckled
grey with no sage. Replaced by two opaque canvases. The pass-1 captures were
deleted; all files in this folder are pass 2.

## Pass 2 — grain gains 4.5 / 4.2 (captured before the gain reduction committed with this code)

- `desktop-meadows-spawn.png` — The ground is no longer a flat tinted
  rectangle: sage meadow with organic earth patches, soft gravel apron on the
  relay approach, broad light/dark variation, visible contact darkening at
  the relay home's base. Weak: the fine grain reads as bright salt speckle
  (forest-floor amplified ×4.5), the earth patches read sandy rather than
  trodden, and the human still stands on grain that is a touch too loud for a
  quiet combat floor. Gains were lowered to 2.6/2.4 after this inspection
  (pass 3 pending).
- `desktop-meadows-relay-court.png` — Same reading; the court earth is a solid
  feathered shape rather than a polygon. The HD props (well, homes) sit on the
  darkened base band correctly.
- `desktop-meadows-woods-road.png` — Left: meadow/earth transition is soft and
  organic (good). Right: a flat brown band with two lighter horizontal lines
  beyond x≈14,500 (the area border). This is either the previous road
  `Graphics` recipe (the Meadows–Woods dirt road starts here) or the
  production renderer's closed-mass slab; not resolved in the window. Roads
  remain the weakest surface.
- `desktop-halving-farms.png` — The walk stayed on the Meadows–Farms gravel
  road: the whole view is the old `Graphics` road ribbon (flat crushed-ore
  fill with halo/shoulder bands) with a wreck card. Confirms priority 2 (road
  meshes) is still open. A closed-mass rock face strip is visible at the far
  left edge (the `rock-face` overlay does draw).
- `desktop-woods-camp.png` — Reached the Woods camp objective. Forest floor
  with the moss/needle grain reads as ground, not noise; the worn camp paths
  show. Weak: the camp court and stores yard still paint as hard-edged
  `Graphics` zones because their materials (`earth`, `marsh`) were outside
  the Woods splat set — moved to `campearth`/`dirt` with this commit so they
  rasterise into the field; the dirt road at the left is the flat ribbon
  again.
- `phone-*.png` — Same scenes at 414×896 @3x on the half tier (`@0.5x` tiles
  and a 256² field): grain stays legible at phone framing, UI contained; the
  same road weakness.

## Still weak after this window

1. Roads: flat `Graphics` ribbons with translucent halos; need the ribbon
   mesh (opaque core, eroded edge, shoulder fade, ruts, chalk centre line).
2. Grain contrast: pass 2 is too loud; the committed gains are lower and need
   a pass-3 capture to confirm.
3. Closed-mass rock faces not visually verified at an area border.
4. No phone frame-cost measurement for the six-sampler full-screen quad.
