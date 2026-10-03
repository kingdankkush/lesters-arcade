# HMH ground material slice — October 2, 2026

Bounded progress against master items 2 and 4. The complete ten-area art kit,
cliff/elevation kit, local lights and final visual acceptance remain open.

## What changed

- Ten authored seamless surfaces: grass, earth, gravel, sand, stone, mud,
  paving, asphalt, fallen broad leaves and pine needles. Sparse directional tufts, chips, joints and worn material
  islands replace amplified uniform speckle. Full 512px and phone 256px assets,
  plus matching fringe strips, total **455,335 encoded bytes**. Legacy terrain
  images, source proofs and original-map geometry are unchanged.
- Ten-area material grain gains are capped at 0.95 (fine) and 0.4 (secondary),
  with distinct sand ripples. Existing palette colours and splat slot counts
  remain. The new assets occupy the same decoded texture dimensions as those
  they replace; this is not proof of total phone texture residency.
- Macro control value is normalized independently of the material strength.
  Previously strength was applied twice, erasing most broad variation. The
  shader still applies the area's authored strength once.
- Worn paths retain an opaque authored spine; limited edge meander and wear
  no longer displace most of a narrow path by up to 55 world units.
- Ground contact/cast shadows reach zero smoothly before their culling bounds.
  Bounding rectangles no longer cut visible dark bands into open terrain.

The producer is `scripts/build-hmh-world-v2-surfaces.py`. It uses bake-only
seeded NumPy randomness, writes the surface manifest and measured mean module,
and does not access gameplay RNG, navigation, blockers, scores or evidence.
Runtime images are Git LFS assets. Rebuild needs Python, NumPy and Pillow;
normal game/build tests consume checked-in assets without personal archives.

## Reference use

Actually inspected the owner's ridge image `ChatGPT Image Sep 29, 2026,
03_24_06 PM-1.png` and Woods/Bayou image `03_23_14 PM-1.png` from Level
References. Their coherent rock strata, open worn path spines, clustered
understory and soft ground shading informed this pass. The images were not
copied into the runtime or presented as finished in-game art.

## Verification

Three new regression cases were RED before implementation: missing authored
surface assets, doubly attenuated macro variation, and a ten-light-level hard
shadow cutoff. They now pass. Combined terrain, schema, renderer and binding
checks: **37 passed, zero failed**. Covers asset hashes/full-phone files,
deterministic field bytes, stable route spine, continuous shadow support,
projection-only world immutability, lazy binding and cache disposal.

The first bake exposed a paving wrap seam; the joint recipe was corrected.
Distinct forest litter initially exceeded the per-area 8 MiB ground budget;
marsh/moss now reuse their own material at the secondary scale instead of
loading a grass page. The regenerated assets and budget checks passed.
Maximum average neighboring luminance
delta is 0.4159/255, versus a uniform high-frequency grain treatment. Actual
PNG bakes were inspected. This measurement is an asset diagnostic, not a
claim of final player-visible quality.

Actual game screenshots, `visual:reboot` comparison and combined bundle budget
are owned by the integration agent and were pending when this slice was
handed over. Physical phone performance has not been tested by this slice.

## Still needed for master items 2–4

An additional bounded centre framing pass is recorded in
`HMH-CENTRE-COMPOSITION-SLICE.md`; final bespoke centre landmarks remain open.
Wall/water/cliff transition decals, complete native building/prop art,
road curbs/drainage, a modular
cliff kit and seam fixes, improved decks/ramps, repeated pillar replacement,
local light pools, district fog/depth direction and final review of all ten
areas. Do not mark the full terrain/world/light overhaul complete from this
shared material pass.
