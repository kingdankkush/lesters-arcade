# Hard Money Heroes Crypto Wasteland District Production Sheet

Status: Draft

This sheet turns Level 1 into authored districts instead of random prop scatter. It uses the existing runtime stage art, scene templates, district generator, and obstacle system first, then asks Pixellab for only the missing seam, blocker, and landmark art.

## 1. Existing inputs to reuse first

These are already in the repo and should be treated as the base kit before any new asset generation:

- `docs/game-design/hard-money-heroes-environment-runtime-manifest.md`
- `docs/game-design/hard-money-heroes-environment-asset-inventory.md`
- `apps/portal/src/biome-model.mjs`
- `apps/portal/src/scene-templates.mjs`
- `apps/portal/src/district-generator.mjs`
- `apps/portal/src/world-obstacles.mjs`
- `apps/portal/assets/generated/hmh-production-art-pass/`
- `apps/portal/assets/hard-money-heroes/environment/`
- the user-provided environment reference images and contact sheets

The current runtime already has the correct five major stage belts:

1. desert approach
2. ghost town
3. country road
4. residential edge
5. inner city

The job now is not to invent a different game. The job is to make each stage belt read like a deliberate district with strong routes, landmarks, and transition bands.

## 2. World grammar

A district in Hard Money Heroes should always be built from the same grammar:

- ground theme
- path network
- blocker kit
- landmark
- transition band
- reward pockets

If any one of those is missing, the map starts to feel like decoration instead of a place.

### Map shape rules

- Main routes should be obvious from the isometric camera.
- Side routes should branch off the main route and reconnect later.
- Dead ends should be rare and usually contain reward, cover, or a mini objective.
- Bridges, gates, canyon cuts, and shoreline crossings are the only places that should intentionally narrow the route hard.
- A district should feel like a loop or a spoke off a loop, not a hallway with props.

## 3. Level 1 structure as district belts

Level 1 is already staged as an outward progression. The design should turn that into a readable district sequence.

### Belt A: Desert approach

Purpose:
- establish Crypto Wasteland
- teach long sight lines
- keep cover sparse and meaningful

Reuse first:
- desert runtime backdrops
- `rock_field`
- `street_block` where roads or outposts exist
- current desert rocks, cactus, and weathered structures from the runtime manifest

Pathing shape:
- a central road spine with 1 or 2 side loops
- small salvage pockets off the main road
- a few landmark pull points that the player can see from multiple cells

Pixellab gaps:
- road cap pieces
- dirt to sand transition tiles
- sand to rock edge tiles
- cactus variants
- wrecked vehicle silhouettes
- gas station or outpost landmark shells

### Belt B: Ghost town

Purpose:
- introduce cover-heavy main street play
- create readable corners, porches, and alley cuts
- move from open wasteland into authored human space

Reuse first:
- ghost town runtime backgrounds
- `street_block`
- `downtown_district`
- `diner_interior`, `grocery_interior`, `arcade_interior`
- current porch, sign, lamp, and storefront art

Pathing shape:
- a main street loop
- alley branches behind storefronts
- one or two wider plazas around landmarks
- side streets that reconnect to the main street instead of ending abruptly

Pixellab gaps:
- storefront facade set
- porch rail pieces
- hitch posts and wooden fence segments
- broken awnings and saloon front variants
- sheriff or bank facade shell

### Belt C: Country road

Purpose:
- connect districts with visible direction
- create travel lanes that feel like roads instead of open noise
- add utility clutter and roadside landmarks

Reuse first:
- country road runtime backgrounds
- `road` and `street_block` routing logic
- current sign, lamp, car, and road-strip art

Pathing shape:
- a main road with shoulder lanes
- pull-off lots and rest stops
- roadside loops for combat pockets
- narrow bridge or culvert chokepoints where terrain shifts

Pixellab gaps:
- road intersection and T-junction kits
- curb and shoulder transition tiles
- roadside ditch and gravel strip pieces
- utility pole and signpost variants
- service station and rest stop props

### Belt D: Residential edge

Purpose:
- soften the world visually while keeping route logic strong
- use lawns, hedges, fences, sidewalks, and driveways as cover language
- create neighborhood loops that reconnect instead of dead-ending

Reuse first:
- residential edge runtime backgrounds
- `suburban_residential`
- `fenced_yard`
- `green_park`
- `city_park`

Pathing shape:
- neighborhood loops
- sidewalk squares
- pocket park routing around a central landmark
- fence breaks and driveway connectors

Pixellab gaps:
- house fronts and roofline silhouettes
- hedge and fence kit
- mailbox, driveway, and curb pieces
- playground or pocket-park landmark props
- tree-line transition pieces

### Belt E: Inner city

Purpose:
- increase density and visual complexity near the end of the level
- use tall silhouettes and tight route splits
- create strong landmark beacons and choke points

Reuse first:
- inner city runtime backgrounds
- `downtown_district`
- `industrial_zone`
- `walled_compound`
- current warehouse, parking, and city prop sets

Pathing shape:
- block grids
- alley loops
- plaza or plaza-plus-arcade nodes
- service lanes behind buildings
- a few deliberate hard choke points

Pixellab gaps:
- high-rise facade pieces
- parking garage shell
- overpass and underpass pieces
- alley fire escape props
- billboard frame and bus stop props

## 4. District family mapping

These are the reusable district families the map logic should keep assembling.

| District family | Surface / ground | Main route shape | Landmark role | What should block movement | What Pixellab still needs |
| --- | --- | --- | --- | --- | --- |
| Desert hub | sand, dirt, cracked road | radial loop off a road spine | gas station or outpost | boulders, cacti, wrecks | transition tiles, wrecks, cactus variants |
| Ghost town | dirt road, pavement, worn boards | main street loop | saloon, bank, sheriff, arcade | porches, fences, boarded facades | storefront facades, porch kits |
| Country road | road, shoulder gravel, dirt | long corridor with side pockets | rest stop, sign cluster, service station | ditches, posts, rocks | road junction tiles, road edge pieces |
| Residential edge | grass, sidewalk, asphalt | neighborhood loops | park, playground, water tower | hedges, fences, driveways | house fronts, hedge kits, curb cuts |
| Inner city | pavement, concrete, asphalt | block grid and alley loops | tower, plaza, transit stop | building shells, barriers, planters | high-rise shells, overpass pieces |
| Industrial yard | pavement, concrete, gravel | service loop and fenced lanes | warehouse, refinery, loading dock | pipes, containers, walls, rails | pipe clusters, container stacks, dock pieces |
| Beach or coast | sand, boardwalk, shallow water | shoreline curve with branches | pier, cabana, lifeguard | dunes, posts, rocks, water | shoreline edge tiles, pier kit |
| Forest edge | grass, dirt, forest floor | trail loop with clearings | shrine, cabin, grove | trees, roots, logs, boulders | tree line kit, log piles, root edge pieces |

## 5. Mechanics and pathing budgets

These budgets are the difference between a readable district and a noisy one.

### Route width

- Main route: 2 to 3 tiles wide
- Side route: 1 to 2 tiles wide
- Choke point: 1 tile only when the world has a visible reason, such as a bridge, canyon pass, gate, or underpass

### Loop budget

- Every district should have at least 1 loop
- A larger district should have 2 loops or a loop plus a return route
- A dead end is allowed only if it rewards the player with loot, cover, or a mini objective

### Cover density

- Desert and road belts should have lower cover density and longer sight lines
- Ghost town and inner city should have higher cover density and stronger corner play
- Residential edge should sit in the middle with hedge, fence, and driveway cover
- Forest and beach belts should use natural blockers and shoreline boundaries instead of hard walls

### Terrain logic

- Deep water: impassable
- Shallow water: slow or semi-passable if the design needs it
- Road and pavement: fastest travel, lowest cover
- Sand and dirt: walkable but softer and visually slower
- Grass and forest floor: walkable, can support concealment if the rendering supports it
- Rock and cliff edges: hard blockers or route edges

### Landmark logic

Each district should have one clear landmark that can be seen before the player enters the POI area. The landmark should do one of these jobs:

- point the player toward the next route
- act as a combat anchor
- define the district silhouette
- create a reward pocket or set piece

## 6. Existing templates that should carry the load first

The scene-template system already gives us a lot of the map grammar we need.

Use these as the first pass before generating new art:

- `street_block`
- `downtown_district`
- `suburban_residential`
- `industrial_zone`
- `city_park`
- `green_park`
- `fenced_yard`
- `walled_compound`
- `tree_grove`
- `rock_field`
- `river_crossing`
- `beach_boardwalk`
- `diner_interior`
- `grocery_interior`
- `office_interior`
- `gym_interior`
- `arcade_interior`

Design rule:

- If the current template can solve the composition problem, reuse it.
- If the template fails because the seam art does not exist, that seam should become a Pixellab request.

## 7. Pixellab asset priorities

The first Pixellab pass should focus on missing connective tissue, not shiny extras.

### Priority 1

- ground transition kits
- road intersection kits
- curb and shoulder kits
- wall and fence kits
- shoreline and water edge kits

### Priority 2

- landmark shells for gas station, outpost, warehouse, water tower, pier, and tower
- ghost town storefront facades
- residential house fronts and hedge pieces
- industrial dock and pipe pieces

### Priority 3

- ambient loops such as tumbleweed, dust, heat shimmer, water ripple, and palm sway
- extra signage, cones, crates, and utility clutter
- future district anchor assets for later world belts

## 8. Pixellab prompt queue

These prompts are meant to fill the missing pieces of the district system.

| job | prompt |
| --- | --- |
| cw-ground-transition-kit | 16-bit pixel-art isometric seamless ground transition kit for Hard Money Heroes. Include sand to dirt, dirt to cracked asphalt, asphalt to concrete curb, grass to dirt, grass to pavement, sand to rock, and shallow puddle edge pieces. Tile-sheet friendly, no text, no logos, no watermark. |
| cw-road-network-kit | 16-bit pixel-art isometric road network kit. Include road straights, curves, T-junctions, four-way intersections, lane stripes, crosswalks, road caps, curb stops, and faded painted arrows. Seamless game-ready tiles, no text. |
| cw-desert-blocker-kit | 16-bit pixel-art isometric desert blocker kit. Include boulders, cactus variants, tumbleweed, wrecked car shells, oil drum clutter, weathered signposts, and sand drift piles. Transparent background, no text. |
| cw-ghost-town-kit | 16-bit pixel-art isometric ghost town prop kit. Include saloon front, boarded storefront, sheriff office facade, bank facade, porch rail pieces, hitch posts, hanging sign brackets, and worn wooden fence segments. Transparent background, no readable signage. |
| cw-canyon-kit | 16-bit pixel-art isometric canyon and badlands kit. Include cliff edge tiles, sandstone walls, switchback road pieces, guardrails, mine shaft entrance, tunnel mouth, stone arch, and narrow bridge supports. Tile-sheet friendly, no text. |
| cw-industrial-rail-kit | 16-bit pixel-art isometric industrial rail and yard kit. Include warehouse wall sections, loading dock, container stack, pipe cluster, chain-link fence, power box, pallet stack, and rail spur barrier. Transparent background, no text. |
| cw-residential-edge-kit | 16-bit pixel-art isometric residential edge kit. Include house front shells, hedge pieces, driveway slabs, mailbox, picket fence, sidewalk curb, tree planter, and parked bike or scooter clutter. Transparent background, no logos, no text. |
| cw-shoreline-kit | 16-bit pixel-art isometric shoreline kit. Include wet sand, shallow water foam edge, boardwalk planks, pier supports, cabana shell, lifeguard stand, driftwood, and shell clutter. Tile-sheet friendly, no text. |
| cw-forest-greenbelt-kit | 16-bit pixel-art isometric forest edge kit. Include tree line pieces, log pile, root edge, trail marker, shrub cluster, mossy rock, fallen trunk, and leaf litter accents. Transparent background, no text. |
| cw-inner-city-kit | 16-bit pixel-art isometric inner city kit. Include high-rise facade shell, parking garage, overpass, underpass wall, billboard frame, alley fire escape, bus stop, and street barrier pieces. Transparent background, no readable signs. |
| cw-utility-kit | 16-bit pixel-art isometric roadside utility kit. Include power pole, traffic cone, road sign, trash can, crate, barrel, hydrant, and cable spool clutter. Transparent background, no text. |
| cw-landmark-kit | 16-bit pixel-art isometric landmark prop sheet for Crypto Wasteland districts. Include gas station, outpost tower, water tower, warehouse, diner shell, pier shack, shrine or lookout tower, and billboard frame. Clean silhouettes, transparent background, no readable text. |
| cw-ambient-loop-kit | 16-bit pixel-art ambient animation sheet. Include tumbleweed loop, dust swirl, heat shimmer, water ripple, palm sway, tree sway, hanging sign sway, and neon flicker. Transparent background, no text. |

## 9. How these prompts should be used

The Pixellab pass should only target missing art, not art that already exists in the runtime manifest or the production art pass.

Use the current runtime art first for:

- the five stage backdrop belts
- the existing enemy and player sprites
- the pickup and VFX systems
- the cabinet and interior prop sets
- the known road and ground silhouettes already in the renderer

Pixellab should fill in:

- transition seams between surfaces
- route edges and choke points
- landmark shells that define the district silhouette
- missing blocker variants that make the path logic readable
- ambient motion layers that keep the world alive without changing navigation

## 10. Build order

The order below is the safest way to build the district system without breaking readability.

1. Lock the pathing grammar.
2. Confirm the district belt map for Level 1.
3. Reuse existing runtime art for the stage backdrops and broad silhouettes.
4. Add the first Pixellab tile kits for ground transitions and road edges.
5. Add blocker kits for desert, ghost town, residential, and inner city routes.
6. Add landmark shells for each district belt.
7. Add the ambient loop set last.
8. Run a full play pass and remove any asset that reads as random clutter instead of a deliberate route piece.

## 11. Definition of done

This pass is finished when:

- every stage belt reads as a district instead of a prop pile
- the player can follow the road or path network without confusion
- every district has a landmark and at least one loop
- blockers create routes instead of noise
- water, cliffs, fences, walls, and buildings behave as intentional movement logic
- Pixellab output is limited to seams, blockers, and landmarks the current art cannot already provide
- the map feels like a designed place the player can learn and master
