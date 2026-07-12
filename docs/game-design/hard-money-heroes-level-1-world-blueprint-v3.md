# Hard Money Heroes Level 1 World Blueprint v3

Status: implemented and release-certified for the live Level 1 runtime
Date: 2026-07-11
Level ID: `level-1-crypto-wasteland`
Blueprint ID: `hmh-level-1-world-blueprint-v3`

## 1. Decision summary

Level 1 is a compact, authored 100 by 100 logical-cell adventure map. The blueprint defines all 10,000 cells and replaces the former coarse 263 by 225 district footprint through the World v3 runtime, material, object, traversal, and gameplay adapters.

The map is designed around:

- one readable critical spine
- two optional adventure loops
- natural mountain-to-lake-to-sea hydrology
- diegetic forest, cliff, water, and building boundaries
- broad swarm arenas
- short cat-and-mouse chokepoints
- strong landmark sightlines
- one optional mini-boss route promoted per run
- one final Rug Pull Baron arena
- a clear Litecoin City extraction seam

The map data is authoritative. Images never determine collision.

## 2. Implemented scope

This blueprint now drives the live Level 1 runtime through generated source data, map visuals, tests, certified material and landmark manifests, coordinate adapters, traversal and collision policy, object placement, campaign anchors, and visual regression. It replaces the former 263 by 225 runtime footprint with the authored 100 by 100 world while preserving the existing player and enemy sprite systems.

The first two art samples remain as historical approval references rather than runtime assets:

1. `sample-terrain-river-road-transition`
2. `sample-landmark-ghost-saloon-arena`

The shipped World v3 materials and lighthouse landmark were normalized and certified against the approved projection, palette, pixel density, lighting, material language, and edge-connectivity rules.

## 3. Canon reconciliation

### Preserve

- `level-1-crypto-wasteland`
- `lester-blaster`
- Crypto Wasteland as Level 1
- Litecoin City as the Level 2 destination
- Rug Pull Baron as the final Level 1 boss
- deterministic seed behavior
- 2:1 isometric projection
- 64 by 32 logical tile footprint
- world-space movement and collision
- persisted IDs, profile keys, achievements, and leaderboard compatibility

### Replaced by the World v3 implementation

- 263 by 225 Level 1 dimensions
- coarse district-cell terrain placement
- random-looking terrain and prop scatter
- ad hoc surface-zone rectangles
- generated road/water placement as the primary source of world structure

### Integrate rather than discard

- curated Level 1 asset manifests
- existing campaign and POI IDs
- existing biome, district, scene-template, ground-selection, collision, and traversal helpers
- authored route, boss, extraction, and visual-regression contracts

## 4. Research-derived design principles

The blueprint adapts proven patterns instead of copying a single game.

| Reference | Useful pattern | HMH adaptation |
| --- | --- | --- |
| Children of Morta | Predesigned rooms connected through generated corridors | Authored arenas and landmarks connected by fixed routes, while spawn and pickup variation remains procedural |
| Hades | Reusable combat-space grammar, strong exits, rapid pacing, clear encounter choices | Each HMH pressure knot has clean entry/exit reads, strong silhouettes, and short travel recovery between fights |
| Diablo-style ARPGs | Reusable terrain families, room/chunk assembly, biome-specific encounter language | Wang-style terrain families plus bespoke 4x4 to 16x16 landmark chunks |
| Project Zomboid | Cell, chunk, and tile hierarchy with structured map data | 100x100 logical cells grouped into authored regions and encounter chunks, exported as repo-owned data |
| Commandos and Desperados | Recognizable landmarks, sightline-driven spaces, multiple approach lanes | POIs are visible before commitment and provide open, stealthy, or chokepoint approaches |
| Kevin Lynch-style spatial legibility | Paths, edges, districts, nodes, and landmarks | Main spine, water/cliff edges, biome districts, crossroads nodes, and named monuments form the navigation language |

### Sources

- Supergiant Games, Hades: <https://www.supergiantgames.com/games/hades/>
- Children of Morta design discussion: <https://www.gamedeveloper.com/design/the-design-challenges-of-quot-children-of-morta-quot->
- Isometric projection reference: <https://pikuma.com/blog/isometric-projection-in-games>
- Project Zomboid isometric development: <https://pzwiki.net/wiki/Isometric_Development>
- Project Zomboid cell/chunk/tile map: <https://map.projectzomboid.com/>
- Tiled official documentation: <https://doc.mapeditor.org/en/stable/manual/introduction/>
- LDtk official site: <https://ldtk.io/>

### Blueprint-specific adaptation

Blueprint v3 deliberately does not copy the scale or pacing of any reference game:

- It uses Hades-style forward momentum without reducing the world to disconnected rooms.
- It uses Diablo-style biome silhouettes without adopting open-world sprawl.
- It uses Project Zomboid-style named-place legibility without survival-sim travel distances.
- It uses Commandos and Desperados chokepoint discipline without stealth-first pacing.
- Ghost Saloon Square is the first dominant visual and gameplay anchor. Crossroads Trading Post is the geographic route-selection hub, so the ghost town does not need to sit at the literal map center.
- Three optional mini-boss-capable arenas are the maximum. Other POIs remain exploration, rest, swarm, event, or reward spaces.

## 5. Coordinate and projection contract

- Map dimensions: 100 by 100 logical cells
- Cell count: 10,000
- Authored origin: northwest
- Positive X: east
- Positive Y: south
- Runtime projection: 2:1 isometric
- Logical diamond: 64 by 32 pixels
- Runtime integration later recenters authored `0..99` coordinates around the current world origin

A generated source image may use a square transparent canvas, but the actual ground footprint inside it must be a centered 2:1 isometric diamond.

## 6. Macro world composition

### Northern highlands

- mountain and cliff perimeter
- two spring sources
- dry pine forest
- cave pocket
- switchback path
- mesa overlook
- long-range enemy pressure

### Western wasteland

- broken-road spawn
- desert and dry grass
- ghost town
- saloon square
- salvage and hashrate camp
- open kiting fields

### Central watershed

- twin mountain tributaries
- Silver Wallet Lake
- four authored bridges
- one optional shallow ford
- crossroads trading post
- route-choice and recovery space

### Eastern lowlands

- prairie and country roads
- farm fields
- normal frontier town
- courthouse/diner/gas-station landmark language
- Litecoin City threshold on the horizon

### Southern coast

- lake outlet and river delta
- mud and reed banks
- beach
- boardwalk path
- wrecked lighthouse and shipwreck
- deep sea perimeter

## 7. Critical path

| Order | ID | Anchor | Beat | Purpose |
| ---: | --- | --- | --- | --- |
| 1 | `broken-road-spawn` | 8,78 | orientation/rest | Teach movement and establish the eastward road cue |
| 2 | `ghost-saloon-mainstreet` | 24,65 | first pressure | Teach cover, broad streets, and optional commitment |
| 3 | `twin-river-bridges` | 46,47 | navigation test | Use water as a readable hard barrier with explicit crossings |
| 4 | `crossroads-trading-post` | 58,45 | branch/rest | Let the player choose an adventure loop and preview rewards |
| 5 | `frontier-town-square` | 71,52 | swarm escalation | Combine open square movement with cover-lined edges |
| 6 | `rugpull-gulch-boss-yard` | 87,35 | final boss | Deliver a clean arena with visible add gates and backdrop landmark |
| 7 | `litecoin-city-threshold` | 93,39 | extraction/rest | Reveal the Level 2 destination and remove random post-boss clutter |

The main spine targets five clear cells in width. It is readable from the current camera and never depends on minimap-only guidance.

## 8. Adventure loops

### North adventure loop: Pine Shadow and Mesa

Route:

`Ghost Town -> Pine Creek -> Dry Forest Cave -> Mountain Switchback -> Mesa Overlook -> Northeast Ridge Bridge -> Crossroads`

Gameplay:

- tighter forest lanes
- short ambush pockets
- cave-mouth bottleneck
- ridge sightlines
- projectile and range rewards
- higher pressure, shorter route

### South adventure loop: Hashrate, Farm, and Coast

Route:

`Ghost Town -> Old Hashrate Camp -> Silver Wallet Lake -> Farm Bridge -> Beach Road -> Wrecked Lighthouse -> Frontier Town`

Gameplay:

- wide swarm arenas
- lake-shore route reading
- farm-row cat-and-mouse spaces
- outlet bridge chokepoint
- optional coastal mini-boss
- longer route with more rewards and recovery opportunities

Both loops reconnect. Neither is a permanent dead end.

## 9. Hydrology

Two tributaries descend from the northern mountains:

1. Northwest Pine Creek
2. Northeast Ridge Run

They feed Silver Wallet Lake near the center-south of the map. The lake drains through Silver Wallet Outlet, crosses the farm belt, widens into a delta, and reaches the southern sea.

Rules:

- water elevation never rises downstream
- tributaries merge into the lake rather than crossing each other
- the lake has a visible outlet
- roads cross deep water only at authored bridges
- deep river, lake, and sea water block ground actors
- air actors ignore ground-water collision but still respect the world perimeter
- the single authored ford is slow and visually distinct
- bridge deck elevation is separate from water-surface elevation beneath it

### Crossings

- Pine Creek wood bridge
- West River main stone-road bridge
- East River main stone-road bridge
- Lake Outlet farm wood bridge
- One optional shallow ford near Silver Wallet Lakeside

## 10. Points of interest and encounter spaces

| POI | Role | Arena read | Reward family |
| --- | --- | --- | --- |
| Ghost Saloon Square | optional mini-boss | wide main street with false-front cover | weapon or shield |
| Dry Forest Cave | optional mini-boss | curved pocket with cave-mouth bottleneck | XP, luck, or summon |
| Mesa Overlook | exploration landmark | elevated switchback and sniper ridge | range or pierce |
| Old Hashrate Camp | swarm arena | broad desert oval with mining rigs and bones | drone or orbital |
| Silver Wallet Lakeside | exploration landmark | dry bank, reeds, shrine, optional ford | health or regeneration |
| Crossroads Trading Post | exploration landmark | wagon circle and signpost route selector | reroll economy |
| Frontier Town Square | swarm arena | open square with low edge cover | coin or upgrade |
| Wrecked Litecoin Lighthouse | optional mini-boss | coastal half-ring with shipwreck ribs | mobility or luck |
| Rugpull Gulch Boss Yard | final boss arena | clean ruined-vault yard with billboard backdrop | level clear and rare draft |

All arenas exist physically every run. The encounter director promotes one optional mini-boss route; other optional arenas can host an elite event, treasure, shop, or rest beat.

## 11. Combat-space rules

- Main route width: 5 cells
- Secondary route width: 3 cells
- Short chokepoints: 2 cells
- Normal swarm arena diameter: 12 to 16 cells
- Final boss arena diameter: 16 cells in the compact blueprint
- Tall blockers stay near arena rims
- Central kite lanes remain visually quiet
- Every normal arena has at least two exits
- Every mandatory fight has at least one retreat/readjustment lane
- Chokepoints stay short so melee swarms do not become collision queues
- Cover uses rhythm rather than random scatter
- Enemy spawn gates are outside the current camera-safe center

### Graybox space-allocation target

The 10,000-cell terrain counts are not equivalent to gameplay-space categories. During the playable graybox, route and encounter tagging should target:

- approximately 60 percent traversal and exploration space
- approximately 25 percent fight-ready arena or pressure space
- approximately 15 percent connectors, gates, bridges, alleys, gullies, and short chokepoints

These are tuning targets rather than rigid quotas. The acceptance criterion is alternating rhythm: open fight bowl, tension connector, landmark reveal, and reward or recovery pocket.

## 12. Pacing target

Target Level 1 duration: 6 minutes 30 seconds.

| Time | Beat |
| --- | --- |
| 0:00-0:35 | Spawn orientation and first road choice |
| 0:35-1:25 | Ghost-town pressure knot |
| 1:25-2:35 | North or south adventure-loop commitment |
| 2:35-3:45 | Crossroads rest and optional mini-boss resolution |
| 3:45-5:15 | Frontier-town swarm escalation |
| 5:15-6:30 | Rugpull Gulch approach and final boss |

Exploration is rewarded through visible optional destinations rather than hidden random pickups alone.

## 13. Navigation and collision taxonomy

### Ground navigation codes

- `.` normal traversable ground
- `~` slow traversable ground
- `#` blocked for ground actors

### Terrain collision classes

- open ground
- slow ground
- deep water
- hard cliff
- dense forest wall
- structure wall
- low cover
- tall occluder
- bridge deck
- authored ford
- hazard-only
- arena gate

### Additional runtime metadata planned for integration

- movement cost
- player traversability
- ground-enemy traversability
- air-enemy traversability
- projectile blocking
- line-of-sight blocking
- cover height
- occlusion fade class
- spawn eligibility
- prop sockets
- encounter membership
- minimap color

Collision is never inferred from image opacity or color.

## 14. Terrain art grammar

The map uses reusable edge-aware terrain families plus authored landmark chunks.

Terrain families:

- dry grass
- lush grass
- forest floor
- packed dirt
- wasteland sand
- rocky ground
- cliff and mountain
- cobblestone
- cracked asphalt
- farm field
- beach sand
- mud and reeds
- deep freshwater
- shallow ford
- sea water
- wood bridge
- stone-road bridge

Each tile context includes north, east, south, and west neighbor terrain codes. These produce a Wang-style adjacency mask for straight edges, inner corners, outer corners, channels, end caps, and isolated patches.

### Art source rules

- square transparent source canvas
- centered 2:1 isometric diamond
- normalize to a 64 by 32 logical footprint
- high-detail 16-bit arcade pixel art
- crisp pixel clusters
- controlled palette
- northwest key light
- southeast cast shadows
- no antialiasing
- no painterly blur
- no text
- no UI
- no actors
- no baked collision marks
- no baked character shadows

## 15. Landmark chunk strategy

Reusable ground tiles should not carry major narrative objects. Landmarks use authored chunks:

- 4 by 4: route transitions, bridge approaches, shrine pockets
- 8 by 8: small POIs, cave mouths, trading-post nodes
- 12 by 12: saloon square, hashrate camp, town square, lighthouse arena
- 16 by 16: Rugpull Gulch boss yard

Each chunk has:

- tile-aligned origin
- ground mask
- collision mask
- prop anchors
- spawn gates
- camera-safe region
- occluder list
- minimap silhouette
- required route connections

## 16. Machine-readable deliverables

- `docs/game-design/data/hmh-level-1-world-blueprint-v3.json`
- `docs/game-design/data/hmh-level-1-world-blueprint-v3-tile-contexts.csv`
- `scripts/build-hmh-level-one-world-blueprint-v3.py`
- `tests/hmh-level-one-world-blueprint-v3.test.mjs`

The CSV has one row for every logical cell with terrain, biome, elevation, navigation, route, encounter, four-neighbor terrain, and prompt-family ID.

## 17. Visual deliverables

Directory:

`docs/game-design/assets/hmh-level-1-world-blueprint-v3/`

Files:

- `terrain-map.png`
- `biome-map.png`
- `navigation-map.png`
- `route-map.png`
- `encounter-map.png`
- `isometric-preview.png`
- `blueprint-contact-sheet.png`

## 18. Current generated metrics

- Total cells: 10,000
- Reachable ground cells from spawn: 8,072
- Blocked cells: 1,928
- Normal traversable cells: 7,854
- Slow traversable cells: 218
- Critical-path anchors: 7
- POIs: 9
- Bridges: 4
- Deep-water ground traversal: blocked
- Every critical and optional anchor: reachable
- Perimeter: blocked on all four sides

## 19. Approval criteria

Approve the blueprint when:

- the world reads as one coherent place rather than separate patches
- the main route is understandable without arrows
- the two optional loops feel meaningfully different
- rivers visibly flow from mountains to lake to sea
- bridges and the ford read as intentional crossings
- town placement follows roads and freshwater
- open arenas and short chokepoints alternate cleanly
- the Rugpull boss yard has a memorable approach and silhouette
- the art samples match the desired pixel density, palette, and lighting
- terrain transitions tile without seams

## 20. Completed implementation sequence

1. Lock art style and terrain prompt template.
2. Produce one complete terrain-family vertical slice.
3. Slice and normalize runtime tiles.
4. Create atlas and manifest.
5. Add pure blueprint loader and coordinate conversion.
6. Add navigation and collision adapters.
7. Render the 100 by 100 graybox in the live canvas.
8. Verify traversal, camera, depth sorting, performance, and minimap.
9. Integrate terrain biome by biome.
10. Integrate landmark chunks and props.
11. Rebuild enemy spawn zones and encounter activation.
12. Run source tests and exact visual regression.
13. Only then accept the new live baseline.
