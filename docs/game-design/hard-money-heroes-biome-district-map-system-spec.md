# Hard Money Heroes Biome District Map System Spec

Status: Draft

This spec turns Hard Money Heroes from a world of scattered props into a world of authored biome districts: readable, traversable map sections built from ground tiles, path tiles, blocker kits, and district-specific point-of-interest assemblies.

It extends `docs/game-design/coherent-world-assembly-plan.md`, which already establishes the scene-template layer. This document defines the higher-level map grammar that scene templates should serve.

## 1. What the reference images are telling us

The concept images all share the same core pattern:

- a district has one clear visual identity
- a landmark anchors the area
- roads, paths, or borders guide movement
- props are grouped into intentional kits
- biome transitions are gradual, not random
- the shape of the district is readable from above

The key takeaway is simple: the map should feel like a **beautiful maze**, not a pile of decorations.

## 2. Design goals

1. Every map section should feel like a real place.
2. Ground tiles should match the props and structures that sit on them.
3. Biomes should be assembled from kits, not random scatter.
4. Traversal should support loops and multiple directions.
5. Blockers should make sense in-world: buildings, trees, fences, rocks, walls, water.
6. Combat should stay readable in the isometric view.
7. Each district should be recognizable from silhouette, color, and structure.

## 3. World structure

Treat the playable world as a graph of districts.

### Core entities

- **Ground theme**: the base surface for a district. Example: sand, grass, asphalt, concrete, forest floor, beach sand, shallow water.
- **Path network**: the walkable route system. Example: road, sidewalk, trail, boardwalk, bridge, alley, dry riverbed.
- **POI kit**: a prebuilt set of props that defines the district. Example: park, beach, residential block, industrial yard, forest grove.
- **Landmark**: the dominant visual anchor for the district. Example: fountain, tower, pier, shrine, gas station, warehouse, cabin.
- **Transition band**: a boundary zone that blends one district into the next.

### District rule

A district is not just a biome label. It is a complete authored package:

```text
District = ground theme + path network + blocker logic + POI kit + landmark + transition rules
```

## 4. Map grammar

### Ground tiles

Ground tiles define the biome first, before the props do.

| Surface | Role | Passability |
| --- | --- | --- |
| Sand / cracked sand | Desert, wasteland, badlands | Walkable unless styled as dune or hazard |
| Dirt / dry soil | Rural routes, transitional ground | Walkable |
| Grass | Park, residential, forest edge | Walkable unless overgrown |
| Asphalt | Roads, parking lots, streets | Walkable |
| Concrete | Civic spaces, plazas, industrial pads | Walkable |
| Beach sand | Coast and shoreline districts | Walkable |
| Shallow water | Tidal edges, puddles, marsh, slow river edge | Slow or semi-passable depending on design |
| Deep water | Ocean, river core, lake core | Impassable |
| Forest floor | Dense woods, groves, trails | Walkable with clear trail logic |
| Mud / swamp | Wet transition zones | Slow |
| Rock / stone | Canyons, cliffs, ruins, badlands | Walkable if authored, otherwise blocker |

### Path tiles

Paths are the player-readable movement system.

- roads
- sidewalks
- trails
- boardwalks
- bridges
- alleys
- dry creek beds
- service lanes
- dock planks

A district should have a path system that feels intentional from the top-down isometric view.

### Blocker classes

Blockers should be authored, not accidental.

- buildings
- walls
- fences
- trees
- dense bushes
- boulders
- railings
- water bodies
- cliffs / embankments
- parked vehicles or debris when used as hard blockers

## 5. Traversal rules

### The player should usually be able to do this

- move forward without a dead end every few steps
- branch to a side route and come back around
- use roads or paths to understand where to go next
- read safe passage versus blocked passage instantly

### The player should usually not see this

- random props sitting in the middle of a path for no reason
- a building or tree placed where it breaks the path logic without a visible reason
- water that looks decorative but behaves like ground
- a district with no loop and too many dead ends

### Pathing principles

1. **Main routes are always readable.**
2. **Loops are better than cul-de-sacs.**
3. **Dead ends should be rare and meaningful.**
4. **Intersections should be deliberate, not noisy.**
5. **Blockers should shape routes, not obscure them.**
6. **Tall objects should frame movement lanes, not sit in the center of them.**

## 6. District template families

These are the core map families the game should be able to assemble.

| District family | Ground theme | Landmark examples | Common blockers | Route shape |
| --- | --- | --- | --- | --- |
| Desert / Crypto Wasteland | sand, dirt, rock | ruin, tower, gas stop, outpost | cacti, boulders, wrecks | roads and dry tracks with loop backs |
| Ghost town / road settlement | dusty road, cracked pavement | storefronts, church, saloon, main street | fences, porches, collapsed structures | street grid with alleys |
| Residential edge | grass, sidewalk, asphalt | homes, pocket park, playground | hedges, driveways, fences | neighborhood loops and cul-de-sacs with exits |
| Urban core | asphalt, concrete | plaza, tower, transit stop, monument | buildings, barriers, planters | blocks, alleys, intersections |
| Industrial yard | concrete, gravel, asphalt | refinery, warehouse, rail spur | pipes, tanks, containers, walls | service roads and fenced loops |
| Beach / coast | sand, boardwalk, shallow water | pier, cabana cluster, lifeguard post | dunes, rocks, posts, docks | shoreline curve with dock branches |
| Forest / grove | forest floor, dirt, grass | shrine, cabin, grove, creek crossing | trees, roots, logs, boulders | winding trails with clear clearings |
| Park / civic green | grass, path, concrete | fountain, pavilion, statue, playground | hedges, trees, benches, planters | looping paths and open center |

## 7. Crypto Wasteland level 1 layout

Level 1 should start as the desert macro-biome and then branch into authored side districts that feel like natural consequences of travel direction.

### Suggested macro layout

- **Start zone:** desert hub / Crypto Wasteland core
- **Branch 1:** badlands -> canyon cut -> mine / ruin path
- **Branch 2:** ghost town -> dusty main street -> road settlement
- **Branch 3:** scrubland -> industrial rail yard -> utility edge
- **Branch 4:** oasis / dry river transition -> palm road -> coastal or beach access
- **Branch 5:** dry greenbelt -> park or forest transition if the world wants a softer biome shift

### Level 1 pacing rule

The world should feel like it opens up as the player travels outward.

- central desert = sparse, readable, low density
- outer districts = denser, more specific, more landmark-driven
- transitions = gradual, using props and ground changes to signal the shift

### Important constraint

Not every biome needs to appear immediately. If a biome is too distinct to fit naturally in the starting area, make it a side branch, a later ring, or a deeper branch of the district graph.

## 8. Transition bands

Transitions are not filler. They are authored zones that teach the player the world is changing.

### Examples

- desert -> ghost town: cracked sand, dirt road, weathered signage, sparse fences
- ghost town -> residential: pavement, hedges, lawns, sidewalks, mailboxes
- residential -> urban: denser roads, higher buildings, concrete, street clutter
- desert -> industrial: gravel, pipes, rusted fencing, utility lines
- beach -> water: sand, shoreline foam, docks, boardwalks
- forest -> park: thinning trees, path widening, benches, mowed grass

## 9. Asset kit requirements

To support this map system, the asset set should be organized into kits.

### Ground kit

- base tiles
- edge tiles
- corner tiles
- T-junctions
- crossroads
- transition tiles between neighboring ground themes

### Path kit

- road straights and curves
- sidewalk straights and corners
- trail segments
- boardwalk segments
- bridge pieces
- intersection pieces

### Blocker kit

- walls
- fences
- gates
- trees
- bushes
- boulders
- rocks
- barricades
- railings
- building footprints

### Landmark kit

- fountain
- pier
- gas station
- shrine
- tower
- warehouse
- cabin
- statue
- billboard
- overpass
- pavilion

### Water kit

- deep water
- shallow water
- shoreline edges
- current / river pieces
- puddles or marsh accents if needed

### Dressing kit

- signs
- lights
- benches
- trash cans
- flowers
- shrubs
- road cones
- crates
- litter
- utility props

## 10. Readability rules for isometric play

These are especially important in an isometric roguelike.

1. **Silhouette first.** A district should read from its major shapes before the player notices small props.
2. **High contrast at route edges.** The path should stand out from surrounding ground.
3. **Keep intersections clean.** Too much clutter at a junction makes navigation feel mushy.
4. **Let blockers frame, not hide, routes.**
5. **Use landmarks to orient the player.** The eye should naturally know where to go next.
6. **Use repetition with variation.** Repeated props make a district feel intentional; a little variation keeps it alive.
7. **Do not place tiny props where they visually fight with collision.**

## 11. Relationship to the existing scene-template system

This spec sits above the current scene-template layer.

- `coherent-world-assembly-plan.md` defines how a cell becomes a coherent scene.
- This spec defines how scenes combine into authored districts.
- Scene templates should be chosen by district family, not by a flat random biome pool.
- `groundTheme` should always match the district.
- `pathEdge` and `onHost` are still valid placement rules.
- The overall structure should avoid random prop selection as the primary driver of the world.

## 12. Definition of done

A biome district system is working when:

- the player can recognize a district by silhouette and ground theme
- the map supports loops and branching routes without frequent dead ends
- each district has a clear landmark
- blockers make logical sense in the world
- water and terrain rules are consistent
- transitions feel authored, not accidental
- the world feels like a place, not a scattershot of assets

## 13. Next practical step

Create the first concrete district kit list for **Crypto Wasteland**:

- desert hub
- ghost town edge
- badlands / canyon route
- industrial utility route
- coast or oasis transition
- the blockers, landmarks, and path pieces needed for each
