# ART — area plans lane B (River, Pines, Ridge, Fortress)

2026-09-30. Branch `claude/200-areas-b`; River from integration `8cc3c9e3f`,
Pines/Ridge/Fortress after merging `codex/visual-overhaul-200-20260929`
(`7d26c1880`, terrain splat system). These are projection-only dressing plans
on the `hmh-area-art-plan/v1` schema (`ART-AREA-SYSTEM.md`). They change no
blocker, surface, objective, RNG, progression or result. Nothing was
generated: every card is a frame on the existing HD kit pages. Every plan
carries `plan.ground.terrain = { ...DISTRICT_TERRAIN[areaId] }`. The renderer,
schema, binding, `plan-support.mjs` and `main.mjs` are untouched. **Owner art
acceptance is not claimed.**

## Status

| Area | Plan | Hook / scene | Commits |
| --- | --- | --- | --- |
| Hashwood River (06) | `world-v2-area-plans/hashwood-river.mjs` | `WORLD_V2_AREA_ART_HOOKS['hashwood-river']`, scene `arts` | `80d9c3227`, fixes `155491525` |
| Hollow Pines (07) | `world-v2-area-plans/hollow-pines.mjs` | `WORLD_V2_AREA_ART_HOOKS['hollow-pines']`, scene `arts` | `a192eae6f`, fixes `155491525` |
| Ledger Ridge (08) | `world-v2-area-plans/ledger-ridge.mjs` | `WORLD_V2_AREA_ART_HOOKS['ledger-ridge']`, scene `arts` | `9cea9f98c`, fixes `155491525` |
| Fork Fortress (09) | `world-v2-area-plans/fork-fortress.mjs` | `WORLD_V2_AREA_ART_HOOKS['fork-fortress']`, scene `arts` | `20c92e602`, fixes `155491525` |

Registration (`5c1839aeb`): the three new hooks sit on their own lines between
`// Lane B (areas 06-09).` and `// End lane B.` in
`world-v2-runtime-world.mjs`, with their own import lines in
`dev/world-v2-local-scene.mjs`. Seam tests are updated in
`tests/hmh-world-v2-runtime-world.test.mjs` and `tests/hmh-world-v2-local-scene.test.mjs`.

## Budgets (validator summary)

| Plan | Kit pages (exclusive + shared) | Encoded | Decoded full | Decoded @0.5x | Tiles (decoded) | Instances |
| --- | --- | ---: | ---: | ---: | --- | --- |
| hashwood-river | plants-00, structures-01 + props-00 | 6,170,898 | 50,331,648 | 12,582,912 | forest-floor, ledge-top, packed-earth, wet-bank (6,553,600) | 352 props, 7 solids, 4 zones, 28 trails |
| hollow-pines | plants-00, structures-01 + props-00 | 6,170,898 | 50,331,648 | 12,582,912 | crushed-ore, industrial-slab, ledge-top, packed-earth (6,553,600) | 426 props, 14 solids, 6 zones, 22 trails |
| ledger-ridge | plants-00, structures-01 + props-00 | 6,170,898 | 50,331,648 | 12,582,912 | crushed-ore, ledge-top, packed-earth (5,242,880) | 283 props, 9 solids, 5 zones, 18 trails |
| fork-fortress | structures-00, structures-01 + props-00 | 7,306,480 | 50,331,648 | 12,582,912 | crushed-ore, industrial-slab, ledge-top, packed-earth (6,553,600) | 201 props, 9 solids, 4 zones, 23 trails |

Every plan stays within two exclusive pages and four tiles. River, Pines and
Ridge use the same page set as Woods. Fortress is the only lane-B plan that
loads structures-00, and it loads no plants page.

## Hashwood River

The river plan places tall conifers on the waterfall shelf, the closed edge
woodland and thirteen bank groves: `b2-72` with plan tint `0xd6dcc0`, and
`b1-50` with the renderer's teal rule. Riverbank iris (`b1-09` ×44) lines both
channel edges. A stone arch (`b2-41`) stands on each of the two north–south
crossings. These cards bypass the guard on purpose, have no shadow and fade
while the actor is behind them. The waterfall shelf is a rock bank with a rock
arch (`b2-76`) and sandstone on top. The marquee is the `b1-13` stall row with
stake posts and log-pile cover; the capstan house is the signal box `b2-67`.
The timber trestle (`b2-42`) and rope span (`b2-44`) are left out because they
live on structures-00, which would be a third exclusive page.

## Hollow Pines

- **Giant dead tree**: `b2-70` as a `card` solid on `dead-tree-roots` with
  `fit: 'height'`, `height: 560` and `massAlpha: 0`. It paints about 730 units
  tall, roughly 10× the human and over twice an ordinary dead oak.
- **Cemetery**: masonry `mass` walls and a masonry stone monument.
  - The low boundary is a hedge of jersey barriers.
  - Six burial rows of low `b2-49` slabs (≤ 26 units) sit behind the public
    walk, with stone-well (`b2-80`) tombs at the row ends. The clearing, both
    gates and the tree approach stay open.
  - The crypt is the steepled chapel `b2-65`; the maintenance house is the
    quonset `b2-68`.
- **Groves**: rock banks with needle roofs, planted with blue-grey conifers,
  dead oaks and bleached relics (`b1-53`), plus a matching closed-edge
  woodland.
- **Lanes**: twelve pockets outside the walls with burnt shrub skeletons
  (`b1-05`), hollow stumps (`b2-73`) and root balls (`b2-74`).
- **Masonry rubble**: grey slab fragments at the crypt and the broken north
  boundary.
- **Lanterns**: traffic masts (`b2-52`) are not used. A signal mast reads as a
  road prop in a cemetery.

## Ledger Ridge

- **Rock cuts**: all five are rock banks. Their shelves carry sparse pines and
  full-height sandstone strata stacks, with a rock arch on the north cap.
- **Headframe and store**: the headframe card `b1-11` sits on its mass, and the
  quarry store is the quonset.
- **Under the north cap**: two collapsed mine entrances (`b2-77`) with rail
  spurs (`b2-78` ×12) and ore carts (`b1-16`).
- **Working landing**: the excavator (`b2-59`) and haul trucks (`b2-60`) park at
  least 450 units from the landing centre.
- **Cut feet and switchbacks**: timber, stumps, root balls and scrub.
- **Not placed**: the brief's rope crossing is not authored geometry, so no
  span card is placed.

## Fork Fortress

- **Gatehouses**: stilted guard towers (`b1-15`) on both.
- **Curtain rampart fill**: stacked containers (`b1-43`) as a hedge, plus
  jersey barriers and scrap along the curtain feet.
- **Keep**: a masonry mass. The sealed bunker entrance (`b2-66`) stands against
  its south face; it is a card only and implies no interaction.
- **Buildings**: the supply store is the brick warehouse `b2-63`, and the
  court's tall cover is the satellite relay bunker `b1-46`.
- **Quonset and second warehouse**: these stand on the closed high ground north
  of the keep (`groundZ` = mass height), not on the court's open floor, so no
  large building card implies walls that collision lacks.
- **Gate and edges**: sandbag emplacements (`b1-17`) at the gate; scrap
  barricades on the service edges.
- **Foreman perimeter**: server racks (`b1-41`) and transformers (`b1-19`) at
  least 600 units from the court centre.
- **Rock**: ridge-foot rock stacks and broken rock on the closed edge.

## Evidence (private scene, under the heavy lock)

`docs/2.0/receipts/area-plans-b-20260930/pass-1/` and `pass-2/` each hold
eight 1280×800 desktop captures from `/dist/hmh-world-v2-local/index.html`.
Each run selected the area in Inspection jump, began, walked with the arrow
keys and waited 2.5 s. Each folder also has a `browser-report.json` with actor
positions and plan snapshots.

The scenes are:

- `river-center`, `river-city-crossing`
- `pines-center`, `pines-dead-tree`
- `ridge-center`, `ridge-headframe`
- `fortress-center`, `fortress-keep`

Lock tokens were `claude-areas-b-49312-…` and `claude-areas-b-37648-…`; each
run waited for the other lane's lock and released only its own. The only
console error was one 404 (favicon). There were no page errors.

Pass 1 was inspected and five problems were rejected:

- Hard-edged apron rectangles on the River bridge approaches and capstan.
- Small sandstone (`b1-42`) cards reading as rusty barrels in Pines, Ridge and
  Fortress.
- The stone-well monument towering over the human.
- Dirt trails slicing the Fortress paving.
- The Ridge landmark walk missing the headframe.

Pass 2 fixes all five, and the Ridge walk now ends on the maintenance shelf
under the headframe. Inspection of pass 2:

- The headframe, mine entrance, rail spur and ore cart read at the right scale
  against the 72-unit human.
- Burial rows read as coherent slab rows behind the walk.
- Rubble is grey.
- The Fortress keep apron reads as a machinery bank with a clear court centre.
- The River bank reads as grass with iris along the channel.

## Tests

`node --test tests/hmh-world-v2-area-plans.test.mjs tests/hmh-world-v2-*.test.mjs tests/hmh-greybox-*.test.mjs`:
224 tests, 224 pass. On the merged base the verifier-freeze failure is gone.
`node scripts/syntax-check.mjs` passes (1386 JS modules + 169 Python scripts).

New lane-B regressions in `tests/hmh-world-v2-area-plans.test.mjs`:

- **River**: crossing arches, conifer and iris counts, and the shelf landmark.
- **All three new plans**: determinism, district terrain, pages, bytes, ≤ 4
  tiles, no pickups and an untouched world.
- **Pines**: the giant tree, burial rows inside the walls with the clearing
  open, no sandstone and no masts.
- **Ridge**: banks, headframe, mine and rail, sparse pines on shelves only,
  plant at the landing edges, and a strata height floor.
- **Fortress**: towers, container ramparts, the keep door against the keep face,
  buildings on closed high ground, and machinery at the perimeter.

Every prop also passes the full placement guard: bounds, blockers or a
matching-height support, water, routes ≥ 64, road corridors, sites ≥ 140 and
spawn.

## Weak spots / next

- **Pines tree**: the giant dead tree's crown sits above the reachable camera
  framing. From the tree view the roots and lower trunk dominate. A wider
  camera or a view from the crypt loop is needed to see the whole silhouette.
- **River crossings**:
  - The `b2-41` arch (430 high, about 190 wide) is narrower than the
    420-wide deck.
  - Ramp and bridge surfaces keep their greybox paint because the plan cannot
    claim elevated surfaces.
- **Containers**: `b1-43` keeps one rust-orange container panel under the
  multiplicative iron tint. It reads as weathered rust, but it is the closest
  lane-B decoration to the reserved orange band, so owner review is needed.
- **Sandstone**: the strata stacks (`b1-42`, `b2-76`) stay warm. This matches
  the ochre ridge reference but not the cool stone swatch exactly.
- **Fortress centre**: the court centre is a large uniform masonry field by
  design (quiet arena). Wear decals would help, but the detail page is not in
  the Fortress budget.
- **Not done**: phone framing, real-child captures (`node build.mjs` not run)
  and owner acceptance.
