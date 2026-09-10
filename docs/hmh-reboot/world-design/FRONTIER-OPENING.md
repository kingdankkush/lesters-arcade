# Frontier Relay: abandoned settlement opening

Status: authored world-data candidate; native appearance and companion camp change await Hermes integration. Base: `9ce7372021a1b14a5b6910bcd0fa1d7d328d8bef`.

The player starts in the familiar clearing at (800, 2400). A weathered farmhouse on the northwest edge and a stopped, rusted pickup southwest establish an abandoned settlement. The broad existing route bends southeast and then east toward the ravine gate. The relay tower remains the orientation landmark. The scene should read through building and road placement before any signage or lore text is added.

## Implemented data

| Feature | Candidate | Why |
|---|---|---|
| Spawn | (800, 2400), radius-560 protected circle, radius-24 actor | Existing run opening and player scale preserved |
| `relay-abandoned-farmhouse` | (330, 1700), 340 × 240 footprint, height 260, ground 0 | Northwest settlement edge; enough margin around the entire spawn disc |
| `relay-abandoned-pickup` | (450, 3100), 230 × 120 footprint, height 100, ground 0 | Provides nearby cover on the southern verge without closing the training approach |
| `relay-training-yard` | (900, 3450), existing radius 360 | Entire circle clears protected spawn by 134.75 units and keeps an extra actor radius clear of solids |

The farmhouse and pickup reuse the existing building/container collision and cover semantics. Their IDs do not introduce damage, loot, destruction, doors, unlocks or interactions. Every new solid has an explicit matching visible-barrier record through the existing world constructors. Native source-to-footprint calibration is still required before these bodies can be accepted with the new art.

The old arena at (1400, 3000) overlapped the protected circle by 71.47 units. The existing test checked centers and missed this. New coverage checks complete arena circles and solid footprints, plus a 24-unit margin. The arena radius was retained; no encounter schedule, spawn-point data or pacing budget changed.

## Routes and side opportunities

- **Primary exit:** preserve the existing 192-wide route through `relay-bend` and `relay-gate`. Keep its ground treatment broad and quiet. The main route across the whole level remains 13,281.90 units, or about 55.34 seconds at the existing unopposed walking speed.
- **Northern spur:** `relay-loop-north` connects to the existing `relay-armory` at (1550, 1550). Leave the relay tower and armory readable; no new building is inserted among their existing satellites.
- **Southern spur:** `relay-loop-south` connects to `relay-cache` at (1250, 3100) and to the new training-lot center. All three access legs pass canonical collision and elevation in both directions.
- **Later dressing:** a static well, garden hedge and disused bus shelter are reserved in the placement request table. They require new matching world solids and native adoption in a later paired change. They are not active in this patch.

## Required companion integration

Hermes owns `ARENA_CAMPS` in `apps/hmh-reboot/src/authored-prop-atlas.mjs`. Its `camp:relay-picket` row duplicates (1400, 3000, radius 360); move it to (900, 3450, radius 360) alongside the world anchor. Rebuild and verify the camp/dressing output against the new world. Do not integrate the arena hunk by itself.

Use the final delivered sources `hmh-ld2-62-clapboard-farmhouse` and `hmh-ld2-54-rusted-pickup-truck`, with their GLB/master hashes from `LEVEL-ONE-PLACEMENT-REQUESTS.json`. Establish actual facing, height and bottom-center grounding in the existing 2.5D atlas pipeline. A request uses a batch-qualified source key; it is not an existing runtime alias. The collision footprint is a target for bake/calibration, not proof that generation-relative model scale already matches it.

Current renderer fallback geometry and the schematic review map do not prove native art acceptance. Hermes must inspect full-body hero visibility, contact shadows, depth sorting, HUD framing and the opening during real desktop/mobile play. The separately open portrait pickup camera issue must be fixed through its owned camera lane.

## Source proof

`hmh-world-design-opening-clearance.test.mjs` and `hmh-world-design-routes.test.mjs` were run before the world edit: 14 evaluated, four expected failures (arena overlap, missing settlement structures, Ravine ramp edge, Mining ramp edge). After the data edit all 14 passed. The existing spawn, stable IDs, legacy blockers, main route, surfaces, landmarks, POIs, interactions and enemy spawn points are preserved by the accompanying contract comparison.
