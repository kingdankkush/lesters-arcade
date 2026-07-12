# Hard Money Heroes Level 1 World Blueprint v3 - Traversal and Collision Contract

Status: implemented and release-certified
Gameplay truth: authored metadata
Visual truth: generated and normalized art

## 1. Core rule

Collision and pathing are not inferred from visible pixels.

Every map cell and placed structure has authored gameplay metadata. Generated art is selected to match that metadata. If art and metadata disagree, the asset fails certification and is not integrated.

## 2. Base terrain classes

| Terrain class | Player | Ground enemy | Air enemy | Typical use |
| --- | --- | --- | --- | --- |
| Normal ground | Passable | Passable | Passable | grass, dirt, road, cobble, sand |
| Slow ground | Passable, slower | Passable, higher path cost | Passable | fields, mud, authored ford |
| Deep water | Blocked | Blocked | Passable | river, lake, sea |
| Cliff/mountain | Blocked | Blocked | Passable | hard natural boundary |
| Bridge deck | Passable | Passable | Passable | overrides water only inside deck footprint |
| World perimeter | Blocked | Blocked | Blocked | finite Level 1 boundary |
| Hazard ground | Policy-specific | Policy-specific | Policy-specific | fire, acid, damaging event areas |

## 3. Cell and edge metadata

Each cell carries:

- terrain family
- ground navigation class
- movement cost
- elevation
- water depth
- bridge or ford state
- biome
- route membership
- encounter membership
- stable visual-variant seed

Each cell can also carry a four-bit edge-barrier mask:

- north = 1
- east = 2
- south = 4
- west = 8

Edge barriers stop actors from cutting through:

- cliff lips
- retaining walls
- fences
- closed gates
- building walls
- steep slopes

A cell can be visually open while a particular edge remains blocked.

## 4. Structures and props

Every solid prop requires an explicit footprint.

Supported footprints:

- circle
- rectangle
- capsule
- polygon

### Trees

- trunk footprint blocks movement
- canopy does not expand collision
- canopy is an overhang and occlusion layer
- characters can move beneath visual branches where appropriate

### Rocks

- small visual pebbles have no collision
- substantial rocks use capsule or polygon footprints
- visual transparent corners do not become invisible blockers

### Buildings

- use multi-cell footprints
- walls block actors and selected projectiles
- door sockets remain passable
- roof is an overhang layer
- collision footprint is smaller and more accurate than the full PNG bounds

### Mountains and cliffs

- plateau and cliff polygons block ground actors
- slope/stair openings explicitly remove edge barriers
- air enemies may cross unless an authored air blocker exists
- cliff collision follows the ground-contact edge, not the entire visible cliff image

### Bridges

- water remains blocked beneath the bridge
- a bridge-deck footprint creates a narrow passable override above it
- deck entry and exit must connect reachable dry banks
- bridge rails may use separate low barrier footprints
- ground enemies path to bridge entrances rather than crossing nearby water

## 5. Player movement

The player uses continuous swept-circle collision:

1. Compute intended movement segment.
2. Check blocked terrain and edge barriers.
3. Sweep against nearby solid footprints.
4. Resolve the earliest collision.
5. Slide along the obstacle where safe.
6. Prevent tunneling through thin fences, walls, trees, and cliff edges.

This preserves smooth analog movement while respecting the authored grid.

## 6. Ground-enemy navigation

Ground enemies use two levels of navigation:

### Global route

- A* or flow-field navigation over the 100 by 100 ground-navigation grid
- movement costs favor roads and normal terrain
- fields, mud, and fords cost more
- deep water, cliffs, and perimeter cells are excluded
- bridge deck cells connect otherwise separated banks

### Local movement

- obstacle and actor avoidance
- swept collision against solid footprints
- short detours around trees, rocks, buildings, and cover
- no diagonal corner cutting through blocked edges
- role-specific spacing for melee, ranged, elite, and boss actors

## 7. Air-enemy navigation

Air enemies:

- may cross water
- may cross ordinary ground props
- may cross cliffs
- still respect the finite world perimeter
- can respect explicit tall-air blockers if required
- retain world-space height and shadow cues

Air navigation is separate from ground navigation rather than a special exception scattered through combat code.

## 8. Projectiles and line of sight

Movement collision, projectile collision, and line of sight are separate policies.

Examples:

- grass: blocks nothing
- tree trunk: blocks movement and selected projectiles
- tree canopy: may affect visibility but not movement
- low rock: blocks movement and bullets but not arcing explosives
- building wall: blocks movement, bullets, and line of sight
- water: blocks ground movement but not ordinary projectiles
- cliff face: blocks movement, bullets, and line of sight according to elevation
- bridge rail: may block movement while allowing shots over it

## 9. Authoring workflow

For every generated or normalized asset:

1. Assign stable asset ID.
2. Record visual bounds.
3. Record ground-contact anchor.
4. Record collision footprints.
5. Record projectile and line-of-sight policy.
6. Place asset on the authored map.
7. Render collision/debug overlays.
8. Walk and pathfind around it in a certification scene.
9. Reject or correct any mismatch between art and gameplay footprint.

## 10. Debug overlays

Development mode will expose:

- green passable cells
- amber slow cells
- red blocked cells
- directional edge barriers
- prop and building footprints
- bridge passable overrides
- player collision sweep
- ground-enemy route
- air-enemy route
- projectile blockers
- line-of-sight blockers
- spawn-safe and arena-safe regions

The overlay makes it immediately visible if a character appears able to walk somewhere that metadata forbids, or vice versa.

## 11. Automated validation

Blueprint and runtime integration must test:

- ground actors cannot enter deep water
- ground enemies route to bridges
- air enemies can cross water
- every bridge connects two reachable banks
- every critical and optional POI is reachable
- no walkable cell lies inside a solid structure footprint
- roads do not terminate inside blocked terrain
- enemies do not cut diagonally through cliff corners
- player collision cannot tunnel through thin barriers
- building doors line up with passable cells
- tree collision follows trunks rather than canopies
- projectiles obey material-specific blocker policy
- map perimeter blocks every actor class
- deterministic seeds produce identical navigation data

## 12. Approval implication

The current artwork direction is compatible with this system because:

- terrain and structures can be separated into layers
- road, river, bridge, and cliff connectors are explicit
- buildings and mountains are treated as multi-cell assets
- trees and rocks can use grounded footprints
- walkable areas remain metadata-controlled

The next stage is not bulk image generation. It is one certified terrain-and-collision vertical slice containing:

- normal ground
- slow ground
- deep water
- cliff blocker
- tree footprint
- rock footprint
- building footprint and door
- bridge override
- ground-enemy route
- air-enemy route

Only after that slice behaves correctly should the remaining terrain and landmarks be generated and integrated.