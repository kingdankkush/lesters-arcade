# Hard Money Heroes authored setpiece grammar

This document captures the implementation-facing plan for building handcrafted-feeling isometric levels without a full level editor.

## Reference policy

Justin's reference images are **composition references only**. They guide level layout, biome grammar, setpiece density, path readability, and asset requests. Do not ship those image files directly as level art unless Justin explicitly asks.

## Build order

1. **Primary traversal lane** — draw the road, trail, street, bridge, ford, alley, or sidewalk first.
2. **Hard boundaries** — use trees, rock walls, water, fences, buildings, cliffs, medians, and walls to carve the playable shape.
3. **Landmarks** — add one readable memory anchor per area: oasis, cave mouth, civic plaza, bank, harbor, rig camp, town square, statue.
4. **Gameplay hooks** — add spawn slots, miniboss arenas, pickup pockets, chokepoints, hazard tells, and exit/seam cues.
5. **Soft dressing** — add bushes, flowers, cacti, lily pads, rocks, benches, trash cans, crates, cars/trailers later in clusters. Never use even random scatter to carry the area identity.

## Layer contract

- `ground`: sand, grass, asphalt, stone, marsh, shallow water, deep water.
- `route`: clear player path. Target 4+ tiles open for main lanes, 3+ for bridges/fords.
- `hardBoundary`: solid blockers that shape traversal.
- `softDressing`: mostly non-blocking props clustered near edges/landmarks.
- `landmark`: a memorable POI silhouette visible before commitment.
- `gameplay`: deterministic spawn/reward/hazard/camera-readability hooks.

## Setpiece packs now encoded

Runtime/data source: `apps/portal/src/hmh-authored-setpieces.mjs`.

- Forest Trail Boundary
- Creek / River Ford Crossing
- Oasis / Lake Shore Arena
- Desert Wash and Dune Path
- Rock Wall Canyon Corridor
- Marsh Boardwalk Pocket
- Lived-in Town Main Street
- City Civic Plaza Block
- Residential Neighborhood Loop
- Harbor / Industrial Service Edge

Each pack defines:

- biome/district/level applicability
- traversal route style and minimum clearance
- ground palette
- hard boundaries
- soft dressing
- landmarks
- gameplay hooks
- runtime scene-template ids
- preferred template ids for generator biasing

## Runtime integration

The district generator now carries authored setpiece data alongside existing macro layout context:

- `authoredSetpiecePackIds`
- `authoredTemplatePoolIds`
- `authoredPreferredTemplateIds`

These feed `districtTemplateContextForCell(...)`, which already biases `pickTemplate(...)` without hard-forcing every cell. This preserves replayability while making the world read as authored.

## Scene templates added

Runtime/rendering source: `apps/portal/src/scene-templates.mjs`.

- `authored_forest_trail_edge`
- `authored_creek_shallow_ford`
- `authored_oasis_lake_shore`
- `authored_desert_dune_wash`
- `authored_rock_wall_corridor`
- `authored_marsh_boardwalk`
- `authored_town_mainstreet_lived_in`
- `authored_city_civic_block`
- `authored_residential_neighborhood`
- `authored_harbor_service_edge`

These currently use repo-owned coherent-world assets as code-authored template grammar. Future original assets can replace individual asset keys without changing the setpiece contract.

## Design rules to preserve

- Paths and routes are designed first. Decoration comes last.
- Buildings in town/city align to streets and sidewalks.
- Utility poles belong on route edges; later art can add implied wire runs to buildings.
- Forest boundaries use dense tree-line tiles; only a few sparse interior trees are allowed.
- Water must be typed by gameplay/readability: shallow, deep, ford, creek, lake, marsh, harbor.
- Desert reads through wide sandy washes, cactus/dune/rock clusters, and canyon walls.
- Rocky spaces use rock walls to create corners/chokepoints, not random boulder scatter.
- Marsh spaces need boardwalk/dry-island routes so the player understands passable terrain.
- Every POI should be telegraphed before commitment and should reconnect cleanly to the main route.
