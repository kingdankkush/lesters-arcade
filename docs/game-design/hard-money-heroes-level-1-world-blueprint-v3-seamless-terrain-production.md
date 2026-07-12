# Hard Money Heroes Level 1 World Blueprint v3 - Seamless Terrain Production Contract

Status: implemented and release-certified
Projection: 2:1 isometric
Logical cell footprint: 64 by 32 pixels

## 1. Non-negotiable rule

The final ground map must be seamless in every valid north, east, south, west, and corner neighborhood.

No final terrain cell is generated as an unrelated image. Image generation creates material masters, connected supertile concepts, and landmark references. Deterministic masks and authored metadata own final edge geometry.

## 2. Layer stack

Every rendered world cell is assembled from ordered layers:

1. `ground`: complete 64 by 32 base diamond
2. `transition`: biome, dirt, grass, sand, cobble, and asphalt edge mask
3. `water`: river, lake, sea, foam, and flow overlay
4. `elevation`: cliff face, slope, retaining wall, or bank
5. `shadow`: terrain and structure contact shadows
6. `structure`: building, bridge, tree trunk, rock, wall, or mountain body
7. `overhang`: roof, canopy, branches, cliff cap, signs without text, and foreground overlap
8. `decal`: cracks, ruts, weeds, litter, tire marks, shells, and local wear

Only `ground` is required to fill the entire diamond. Other layers may exceed the cell footprint but must use stable anchors and declared bounds.

## 3. Connectivity masks

### Roads, paths, rivers, fences, and walls

Use a four-bit NESW connection mask:

- north = 1
- east = 2
- south = 4
- west = 8

This produces 16 exact states:

- empty
- four end caps
- two straights
- four corners
- four T junctions
- four-way junction
- isolated/full state as required by the family

The map data, not the image, selects the mask.

### Organic terrain transitions

Use the existing 47-tile blob pattern plus Wang edge/corner metadata for:

- grass to dirt
- forest floor to grass
- desert to dry grass
- rock to mountain
- beach to mud
- mud to freshwater
- beach to sea
- town ground to asphalt
- field to grass

The 47-tile family covers cardinal and diagonal neighbor combinations without square-looking cutouts.

## 4. Generation method

### Material masters

Generate clean, largely featureless material samples:

- dry grass
- lush grass
- forest floor
- packed dirt
- desert sand
- rock
- cobble
- asphalt
- farm rows
- beach
- mud
- freshwater
- sea

Material masters should have no major prop crossing an edge.

### Connected supertiles

Generate 4 by 4 or 6 by 6 connected source patches when composition matters. The prompt must declare every edge connector:

- north connector type and lane index
- east connector type and lane index
- south connector type and lane index
- west connector type and lane index
- interior route mask
- water-flow direction
- elevation continuation
- outer safety ring

The connected patch is an art reference and texture source. It is not sliced blindly and dropped into runtime.

### Final tile construction

1. Normalize the approved material to the canonical palette and pixel scale.
2. Build exact vector/pixel masks for the 64 by 32 diamond.
3. Apply the correct 16-state or 47-state topology mask.
4. Add family-specific edge texture and corner details.
5. Add deterministic cosmetic variation only inside safe mask regions.
6. Extrude atlas edge pixels into a four-pixel gutter.
7. Render with nearest-neighbor sampling only.
8. Certify all required neighborhoods before integration.

## 5. Buildings

Buildings are never cropped into unrelated ground tiles.

Each building is a multi-cell chunk with:

- stable ID
- tile-aligned origin
- footprint width and height
- bottom-center world anchor
- ground-contact polygon
- collision polygon or rectangles
- roof/overhang bounds
- occlusion-fade bounds
- shadow layer
- entry sockets
- road/path connector sockets
- prop sockets
- sprite bounds for culling

A building may visually cross several cells while remaining one structure asset. The ground beneath it remains a complete seamless terrain layer.

Landmark chunks reserve a one-cell outer safety ring. Large structures stay inside that ring unless a declared road, wall, fence, river, or cliff connector intentionally exits the chunk.

## 6. Mountains and cliffs

Mountains are separated into:

- plateau ground
- cliff face
- cliff cap
- slope or stairs
- rock overhang
- contact shadow
- blocked collision footprint

A cliff edge uses exact connection masks. A mountain continuing beyond a chunk edge declares that connector in metadata. Peaks and unique rock silhouettes stay away from arbitrary slice boundaries.

No peak, building roof, bridge, cave mouth, or landmark is cut at a cell edge and expected to continue by chance.

## 7. Roads and paths

Road and path centerlines are authored in map data. The compositor derives:

- straight
- corner
- T junction
- four-way junction
- end cap
- bridge approach
- ford approach
- town intersection
- shoulder and drainage direction

Wheel ruts, lane wear, and cracks follow the route mask. They do not terminate at a tile edge unless the route terminates.

## 8. Rivers, lake, and sea

Water topology is authored separately from surface art:

- entry edge
- exit edge
- flow direction
- width class
- depth class
- bank family
- foam family
- bridge-underlay flag
- lake/river/sea classification

River flow lines and bank contours continue exactly through neighboring masks. Bridge decks remain separate structure layers above uninterrupted water.

## 9. Atlas rules

- canonical ground diamond: 64 by 32 pixels
- transparent source frame may be larger for vertical content
- four-pixel atlas gutter
- four-pixel edge extrusion
- integer coordinates only
- nearest-neighbor sampling only
- no fractional camera placement after projection rounding
- premultiplied-alpha behavior verified in Canvas 2D
- mipmaps disabled for pixel-art atlas use

## 10. Seam certification

Every terrain family must pass:

1. all 16 NESW route/water connector states
2. all used 47-tile blob masks
3. inner and outer corner contact sheets
4. repeated 5 by 5 same-material render
5. randomized 5 by 5 valid-neighborhood render
6. bridge-over-water render
7. cliff-height continuation render
8. building-footprint and overhang render
9. atlas gutter and alpha-halo audit
10. nearest-neighbor scale test at supported camera scales
11. deterministic seed repeatability
12. portrait, landscape, tablet, compact desktop, and desktop visual captures

A tile family fails if:

- a bank or road shifts at an edge
- a path width changes unintentionally
- lighting direction changes
- texture scale changes
- transparent fringe appears
- a structure is cropped
- a peak or roof expects an unrelated neighbor to complete it
- a cosmetic decal breaks the connector

## 11. Runtime selection

For each authored cell:

1. Read terrain family and biome.
2. Read north, east, south, west, and diagonal neighbors.
3. Compute path/water NESW masks.
4. Compute organic 47-blob mask.
5. Select deterministic visual variant from the cosmetic RNG stream.
6. Draw complete ground diamond.
7. Draw transition and water layers.
8. Draw elevation.
9. Queue structures and overhangs by ground-contact depth.
10. Draw decals that are certified for the selected mask.

Gameplay RNG is never consumed by cosmetic tile selection.

## 12. Follow-up approval examples

### Sample C: Connected road and river neighborhood

Purpose:

- prove road width continues across cell boundaries
- prove river banks and flow continue
- prove bridge deck and water remain separate
- keep all large props inside the neighborhood safety ring

### Sample D: Cliff, forest, and switchback supertile

Purpose:

- prove cliff faces continue across multiple cells
- prove path switchbacks retain width and grounding
- prove trees and peaks are separate overhang assets
- avoid cropped mountain peaks or buildings at arbitrary cell edges

These examples remain concept references. Final seam certification happens with normalized masks and programmatic neighborhood renders.