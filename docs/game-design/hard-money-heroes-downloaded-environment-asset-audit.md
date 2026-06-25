# Hard Money Heroes downloaded environment asset audit

_Last updated: 2026-06-25_

Justin downloaded a broad library of terrain, tree, plant, building, water, road, cliff, and miscellaneous RPG asset packs into `C:/Users/just_/Downloads`. This audit decides what is safe/useful for Level 1 production.

## Audit method

- Inventoried local downloaded files without importing them into runtime.
- Scanned ZIP contents with Python `zipfile`.
- Sampled representative PNG/JPG files into temporary contact sheets for visual review.
- Read embedded license/readme snippets when present.
- Verified Screaming Brain Studios floor/autotile/water pack licensing against OpenGameArt / itch.io metadata.
- Blender source files were inventoried but not rendered because Blender is not installed in the Hermes environment.

Temporary local preview sheets are under:

```text
tmp/hmh-download-asset-audit/previews/
```

Those sheets are local audit artifacts only and should not be committed or shipped as game art.

## Inventory summary

- Relevant downloaded files scanned: **54**
- Total local download size scanned: **~901 MB**
- ZIP archives: **45**
- Standalone preview/source images: **8**
- Standalone Blender files: **1**

Approximate category breakdown:

| Category | Count | Notes |
|---|---:|---|
| Flora / trees / plants | 20 | Strong tree/plant references, mixed licenses and camera styles. |
| Terrain / floor / overworld tiles | 10 | Best direct Level 1 candidates are the SBS isometric tiles. |
| Buildings / tents / interiors | 5 | Wooden/tent refs are useful; Modern Interiors is not usable commercially. |
| Cliffs / rocks / crystals | 5 | Rocks/crystals useful mostly as props/reference; cliff source is Blender-only. |
| Water / seabed / shore | 4 | SBS water is the strongest direct candidate. Seabed packs are top-down/reference. |
| Misc / RPG / ruins / characters | 9 | POI inspiration only except maybe small prop ideas. |
| Road / skate POI | 1 | Skatepark vector set is reference-only for POI design. |

## Best direct-use candidates

These are the strongest packs for runtime ingestion because they match the game camera better and/or have clear permissive licensing.

### 1. Screaming Brain Studios isometric floor/autotile/water family

Files:

```text
sbs_-_isometric_floor_tiles_-_large_256x128.zip
sbs_-_isometric_floor_tiles_-_small_128x64.zip
sbs_-_floor_tile_update_1_-_autotiles.zip
sbs_-_floor_tile_update_2_-_water.zip
sbs_-_isometric_overworld_pack_-_large.zip
sbs_-_isometric_overworld_pack_-_small.zip
```

Decision: **direct-use candidate, high priority.**

Why useful:

- True 2:1 isometric tile geometry.
- Has large `256x128` and small `128x64` variants.
- Covers grass, dirt, sand, rocky ground, forest ground, water, water edges, terrain blends, and some road/cyber-road surfaces.
- The OpenGameArt page for the same SBS floor-tile collection lists the base, autotile, and water zips as **CC0**.
- The two overworld zips also contain embedded `License.txt` saying the assets are CC0/Public Domain and can be used commercially with no restrictions.

Best Level 1 uses:

- Base grass/desert/dirt ground tiles.
- Lake/river/pond edge experiments.
- Terrain blend/autotile references for road shoulders and biome seams.
- Rapid isometric tile prototyping in a future map-preview or Tiled-style pipeline.

Caveats:

- Some tile sheets use black or magenta backgrounds and need alpha cleanup/slicing before runtime use.
- They are good production-safe base tiles, but still need HMH palette/style pass so the level feels like Lester's Arcade rather than a generic tile demo.
- Roads still need custom HMH asphalt + paint. SBS road-like/cyber tiles can inform geometry and slicing, not final road identity.

### 2. SBS isometric overworld packs

Files:

```text
sbs_-_isometric_overworld_pack_-_large.zip
sbs_-_isometric_overworld_pack_-_small.zip
```

Decision: **direct-use candidate, high priority.**

Why useful:

- Embedded license is CC0/Public Domain.
- Good for water/forest/terrain blockouts and thick/flat tile variants.
- Could provide immediate better base tiles than the tiny deterministic placeholder wave.

Best Level 1 uses:

- Water/forest/terrain base tile references.
- Boundary construction experiments for river/lake/forest edges.
- Quick map preview tiles while original HMH-specific art is generated.

## Strong reference candidates, but avoid direct shipping unless license/style is resolved

### 3. Isometric tree packs

Files:

```text
isometric_trees_pack.zip
isometric_trees_source.zip
trees_source.blend.zip
trees_01.png
```

Decision: **reference-first, not direct shipping by default.**

Why useful:

- Visually aligned with the isometric boundary-tree need.
- `isometric_trees_pack.zip` has 516 image entries and many usable-looking conifer/tree sheets.
- Great for studying tree height, shadow, forest-wall density, and single-tree silhouette variety.

Caveats:

- Embedded license begins with `CC-BY-SA 3.0` and includes mixed attributions/CC0 sources.
- Share-alike/attribution complexity is not ideal for Lester's Arcade runtime assets.
- Use this to guide original generated tree kits unless Justin explicitly wants to accept license obligations.

Best Level 1 uses:

- Reference for forest boundary walls.
- Reference for single-tree variants and elevation-edge tree clusters.
- Possible internal source material only if we track attribution/share-alike rules carefully.

### 4. Plant pack

Files:

```text
plant_pack.zip
plant_pack_source_packed.blend
```

Decision: **reference-first.**

Why useful:

- Huge plant library: sampled pack reported 999 image entries.
- Useful for shrub, fern, grass, crop, and biome dressing silhouettes.

Caveats:

- License snippet includes CC-BY / CC-BY-SA 4.0 mix.
- Blender source cannot be rendered here without Blender.
- Use for reference and regenerate original HMH plants/crops rather than direct import.

### 5. Grassland tilesets

Files:

```text
grassland_tileset_updated.zip
grassland_tileset_sheets.zip
grassland_tiles.png
grassland_blend.zip
```

Decision: **reference-first / direct only after license provenance is confirmed.**

Why useful:

- Strong grassland/ground/water sheet references.
- Some tiles visually support the farm and forest boundary direction.
- The `grassland_blend.zip` has 19 blend files plus texture images, useful for source study if Blender is available later.

Caveats:

- No embedded license text was found in the scanned samples.
- Some assets look more top-down/orthographic than final HMH isometric runtime style.

### 6. Wooden buildings and sailor tents

Files:

```text
wooden_buildings_01.png
wooden_buildings_source.blend.zip
sailor-tents.zip
```

Decision: **reference-first, possible direct-use only after license check.**

Why useful:

- Wooden buildings are the clearest downloaded reference for town/farm modular silhouettes.
- Tents could inspire a roadside camp, farm-worker camp, or POI/miniboss encampment.

Caveats:

- No license was detected in the sampled metadata.
- Wooden building sheet appears low-light/black-background and would need extraction/palette cleanup.
- Tents are more painterly than pixel-art; better as composition reference.

## Useful as secondary prop references, not primary Level 1 tiles

### 7. CraftPix top-down packs

Files include:

```text
craftpix-net-385863-free-top-down-trees-pixel-art.zip
craftpix-net-141354-free-top-down-bushes-pixel-art.zip
craftpix-net-505052-free-forest-objects-top-down-pixel-art.zip
craftpix-net-974061-free-rocks-and-stones-top-down-pixel-art.zip
craftpix-net-639143-free-rocky-area-objects-pixel-art.zip
craftpix-net-694865-free-top-down-seabed-objects-pixel-art.zip
craftpix-net-934618-free-top-down-ruins-pixel-art.zip
craftpix-net-160005-free-ruined-temple-top-down-location-pixel-art.zip
craftpix-net-574220-free-path-and-road-top-down-pixel-tileset.zip
```

Decision: **reference / secondary props only.**

Why useful:

- Lots of readable pixel-art rocks, bushes, ruins, crystals, paths, seabed objects, and trees.
- Could inspire mini-boss POI props, cave/ruin accents, and shrub/rock silhouettes.

Caveats:

- Most are explicitly top-down, not isometric.
- They will look wrong as-is beside 2:1 isometric tiles and HMH actor art.
- License files mostly point to CraftPix's web license page rather than embedding exact terms, so direct commercial usage should be checked before shipping.
- Some sampled archives show coupon/preview images; those are not useful runtime art.

Best Level 1 uses:

- Reference for custom HMH boulders, bushes, dead trees, and ruin props.
- Possible tiny decorative props only after perspective and palette pass.

### 8. Standalone 3D/vector landscape images

Files include:

```text
3d-fantasy-scene.jpg
3d-isometric-landscape-with-forest-water.jpg
3d-marine-algae.jpg
digital-art-southwest-landscape.jpg
3d-isometric-green-bushes-grey-stones-rocks-garden-landscape-nature-objects.zip
isolated-isometric-tiles-computer-game.zip
set-ground-surfaces-grass-rocks-water-landscape-web-design-vector-illustration.zip
skate-park-set-with-skateboard-symbols-isometric-isolated-vector-illustration.zip
```

Decision: **composition/reference only.**

Why useful:

- Good mood/composition references for cliffs, ponds, southwest desert-town palette, garden object layouts, and isometric tile proportions.
- Skatepark set may inspire a future urban POI, but not Level 1 core.

Caveats:

- Stock/vector/3D-render look does not match HMH pixel-art runtime.
- Licensing appears tied to free/premium stock terms in some zips.
- Do not directly ingest these into runtime art.

## Reject / avoid for current Level 1 environment pass

| Pack | Reason |
|---|---|
| `Modern_Interiors_Free_v2.2.zip` | Embedded license says free version is non-commercial only. Also interior/top-down, not current Level 1 overworld priority. |
| `craftpix-net-363992-free-top-down-orc-game-character-pixel-art.zip` | Character pack, not Level 1 environment. Top-down fantasy orcs conflict with HMH faction direction. |
| `craftpix-net-809047-free-animated-magic-book-pixel-art-asset-pack.zip` | Magic-book UI/VFX pack; not relevant to Level 1 towns/farms/desert/water. |
| `craftpix-net-695666-free-undead-tileset-top-down-pixel-art.zip` | Useful only for distant ruin/cemetery inspiration; too fantasy/top-down for core Level 1. |
| `craftpix-net-106469-top-down-crystals-pixel-art.zip` duplicates | Crystals are not core Level 1 unless used sparingly as crypto POI weirdness. Top-down camera mismatch. |

## Recommended production decision

Use the downloads in three lanes:

### Lane A — Direct runtime ingestion candidate

Start with the **Screaming Brain Studios isometric tile family**:

1. Slice small `128x64` tiles first for runtime/world-preview speed.
2. Generate alpha-cleaned transparent PNGs from black/magenta backgrounds.
3. Build a Level 1 tile manifest:
   - grass base
   - dirt base
   - sand/desert base
   - rocky ground
   - water flat
   - water height-mapped shore
   - grass-to-dirt transitions
   - dirt-to-sand transitions
4. Add a contact sheet and tests proving every manifest tile exists and matches expected 2:1 tile dimensions.
5. Use these as the base layer under authored HMH props/templates.

### Lane B — Reference-first original HMH generation

Use these packs as style/composition references while generating original repo-owned HMH art:

- `isometric_trees_pack.zip` for forest walls and single-tree silhouettes.
- `plant_pack.zip` for shrubs/ferns/crops/cactus variants.
- `wooden_buildings_01.png` for town/farm building silhouette grammar.
- `grassland_tileset_*` for farm/grass/ground transitions.
- `cliffs_source.zip` / `digital-art-southwest-landscape.jpg` for desert cliff/elevation ideas.

### Lane C — Reference only / do not ingest

Use stock/vector/top-down packs only as inspiration:

- CraftPix top-down packs.
- Freepik/vector isometric scene zips.
- standalone 3D/JPG mood scenes.
- Modern Interiors free pack.

## Next implementation slice

The next practical slice should be:

1. Create `scripts/ingest-hmh-sbs-isometric-tiles.py`.
2. Extract/slice the SBS `128x64` tiles into a repo-owned generated folder, likely:
   - `apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/`
3. Convert magenta/black backgrounds to alpha where appropriate.
4. Create a manifest module and contact sheet.
5. Add tests for license/source metadata, dimensions, and required tile roles.
6. Wire selected tiles as ground-layer candidates for Level 1 sketch regions while keeping the authored `sketch-level1` props on top.

This will materially improve the actual Level 1 map foundation without risking third-party license/style drift.
