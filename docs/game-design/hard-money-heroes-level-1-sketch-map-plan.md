# Hard Money Heroes Level 1 sketch map integration plan

_Last updated: 2026-06-25_

Justin's attached sketch (`Desktop/IMG_5849.png`) is **reference-only composition input**. Do not crop, ingest, manifest, or ship the sketch image itself as runtime art. Use it to drive authored macro layout, asset grammar, original pixel-art requests, and runtime setpiece data.

## High-level read of the sketch

Level 1 should become a decent-size bounded isometric map with visible natural and town-made edges instead of invisible limits. The player should feel like they are crossing a varied Crypto Wasteland: forest/lake on the west, rivers and bridges through the middle, a big readable desert basin with hills, then farms and towns toward the southeast/east.

The map is not a flat random field. It is a stitched authored world:

1. **West forest/lake belt**
   - Dense trees form the west boundary.
   - A park/pond pocket and forest mini-boss clearing sit inside this belt.
   - A lake/beach edge anchors the southwest corner.

2. **Main town west hub**
   - Road loop and building fronts create the first major town read.
   - This includes a mini-boss fight space.
   - The road bends toward the river bridge and central desert.

3. **Central river spine**
   - A north-south river cuts the map and connects into an east-west river branch.
   - Bridges are deliberate traversal chokepoints, not decorative props.
   - Water should be animated and should define boundaries around the playable route.

4. **Northern rock/hill/cliff edge**
   - Boulder, rock, cliff, and hill language forms the north boundary.
   - This needs elevation art: cliff faces, hill slopes, mesa shelf shadows.

5. **Northeast town / Town #3**
   - Town buildings, roads, river bend, and a bridge define a smaller town block.
   - Building fronts can also form the top/right map boundary in places.

6. **Central desert and hills basin**
   - Large open desert combat area with cacti, rocks, and hills.
   - Needs wide lanes. Cactus/rock placement should hug edges and pockets, not fill the whole basin.
   - Hills/elevation points can become sightline and mini-arena beats.

7. **Southeast farm and second town loop**
   - Roads curve through farms into a second town.
   - Farms need a distinct kit: farmhouse, barn, crop rows, fences, hay bales, silo/well, dirt driveway blends.
   - Second town has another mini-boss fight.

8. **Perimeter boundary language**
   - West: trees + lake/beach.
   - North: boulders + rocks + cliffs + hills.
   - East: trees + town building wall.
   - South: boulders + rocks + cliffs + trees + town building fronts.

## Source data now added

The sketch is now encoded in:

- `apps/portal/src/hmh-level-one-sketch-layout.mjs`

It exports:

- `HMH_LEVEL_ONE_SKETCH_LAYOUT`
- `HMH_LEVEL_ONE_SKETCH_REGIONS`
- `HMH_LEVEL_ONE_SKETCH_PERIMETER`
- `HMH_LEVEL_ONE_SKETCH_WATERWAYS`
- `HMH_LEVEL_ONE_SKETCH_ROAD_NETWORK`
- `HMH_LEVEL_ONE_SKETCH_TOWNS_AND_FARMS`
- `HMH_LEVEL_ONE_SKETCH_POIS`
- `HMH_LEVEL_ONE_SKETCH_EXISTING_ASSET_COVERAGE`
- `HMH_LEVEL_ONE_SKETCH_NEW_ASSET_REQUESTS`

It is attached to Level 1 campaign metadata through:

- `HMH_CAMPAIGN_LEVELS[Level 1].sketchMapPlan`
- `HMH_CAMPAIGN_LEVELS[Level 1].sketchAssetRequests`

Tests:

- `tests/hmh-level-one-sketch-layout.test.mjs`

## Existing repo-owned assets we can use immediately

### Boundaries and terrain

- `crypto/forest-tree-line` — forest perimeter/tree wall
- `nature/pine-tree` — single tree dressing
- `nature/oak-tree` — single tree dressing
- `nature/boulder` — generic rocks
- `crypto/desert-boulder` — desert boulder boundary
- `crypto/canyon-cliff-edge` — current cliff/elevation proxy
- `crypto/shoreline-water-edge` — current lake/shore proxy

### Roads

- `crypto/road-straight`
- `crypto/road-tjunction`
- `crypto/road-crossroad`
- `crypto/road-cap-end`
- `crypto/ground-dirt-asphalt-edge`

These let us block in the road graph now, but they are not enough for the final AAA road kit because the sketch needs curved road paths, road paint, shoulders, town-road loops, and driveway blends.

### Water and bridges

- `construct/river-straight`
- `construct/river-bend`
- `construct/wood-bridge`
- `crypto/shoreline-water-edge`

These are enough for readable runtime water/bridge placement, but final quality needs animated river/lake/pond variants.

### Towns

- `crypto/ghost-saloon-front`
- `crypto/ghost-boarded-storefront`
- `crypto/industrial-warehouse-facade`
- `crypto/utility-pole`
- `street/street-lamp`
- `street/trash-can`
- `street/mailbox`

These can block out town edges and roads, but final quality needs modular town-building front rows, corner facades, and roofline caps.

### Farms

Current farm coverage is **proxy-only**:

- `construct/fence-segment`
- `construct/fence-gate`
- `construct/fence-post`
- `interior/wooden-crate`
- `interior/stacked-boxes`
- `nature/bush`

We do **not** yet have a real AAA farm kit.

## New original pixel-art asset kits needed

### P0 — required for final Level 1 visual identity

1. **AAA asphalt road kit with paint**
   - Straight, curve, T-junction, crossroad, end cap.
   - Road paint/lane markers.
   - Cracked shoulders.
   - Dirt/asphalt transitions and farm driveway blends.

2. **Animated water system**
   - River straight flow loop.
   - River bend flow loop.
   - Lake edge shimmer.
   - Pond idle ripple.
   - Shoreline/beach transitions.
   - Shallow water/fording variants.
   - 4-8 frame loops per water type.

3. **Cliff, hill, and elevation kit**
   - Cliff faces for all useful isometric orientations.
   - Inner/outer corners.
   - Mesa shelves.
   - Hill slope shadows.
   - Walkable high-ground plateau edge.

4. **Modular town building fronts and boundary rows**
   - Storefront fronts.
   - Side walls.
   - Corner facades.
   - Roofline caps.
   - Door/window variants.
   - Boundary-row facades designed to tile side-by-side.

5. **Farmstead kit**
   - Farmhouse.
   - Barn.
   - Silo/well.
   - Corn rows.
   - Wheat rows.
   - Hay bales.
   - Fence corners.
   - Farm driveway dirt/asphalt blend.
   - 2-4 frame crop sway loop.

### P1 — strong polish pass

6. **Animated tree/shrub/cactus variants**
   - Pine/oak/tree-wall variants.
   - Single tree variants.
   - Bush/shrub variants.
   - Cactus variants.
   - Fallen log/stump variants.
   - Subtle 4-frame foliage sway on trees/shrubs.

7. **Bridge kit with rail/shadow variants**
   - Short bridge.
   - Long bridge.
   - Road bridge.
   - Wood bridge.
   - Rail edges.
   - Water shadow overlays.

### P2 — lived-in dressing

8. **Town/farm small prop kit**
   - Barrels, crates, mailboxes, signs, benches, trash cans.
   - Watering trough, fence repairs, crop baskets.
   - Optional sign/flag sway.

## POI / mini-boss encounter candidates from sketch

| POI | Location | Role | Setpiece direction |
|---|---|---|---|
| Forest Mini-Boss Clearing | Northwest forest | optional mini-boss | dense tree wall opens into darker clearing |
| Main Town Mini-Boss | West town | town mini-boss | road loop + town fronts + open duel lane |
| North River Bridge | upper central river | chokepoint | bridge crossing framed by cliffs/trees |
| Center Road Bridge | mid river branch | chokepoint | road visibly crosses river branch |
| South Main Town Bridge | west/central lower river | chokepoint | town road bends to bridge before desert |
| Central Hills Overlook | center desert | elevation skirmish | hill/cliff shadows break up open sand |
| Farmstead Ambush | south farm | rural ambush | crop/fence/barn language before enemy aggro |
| Second Town Mini-Boss | southeast town | late-town mini-boss | town buildings + road loop arena |

## Design rules for runtime placement

1. Route first: roads, bridges, beach edges, and river crossings define movement before decoration.
2. Boundaries must be visible in-world blockers: trees, cliffs, boulders, building fronts, water, beaches.
3. Town/farm roads use asphalt and paint. Desert routes can blend into dirt and sand shoulders.
4. Forest boundaries use dense tree walls; interiors use sparse single trees and bushes.
5. Desert interiors leave wide combat lanes. Cactus/rock clusters belong on edges, pockets, and hill bases.
6. Farms must read as farms through farmhouse/barn/crop-row/fence language, not generic town props.
7. Animated environment loops belong to water, trees, and crops only. Gameplay determinism stays in simulation code.

## Next implementation slices

1. **Runtime macro layout preview**
   - Teach the current scene generator to bias cells from `HMH_LEVEL_ONE_SKETCH_LAYOUT`.
   - Force only anchor cells: bridges, towns, farm hubs, and major POIs.
   - Keep procedural micro variation between anchors.

2. **Farmstead setpiece pack**
   - Add a `farmstead-crop-road` setpiece/template pack using current proxy assets.
   - Replace proxies when the real farm kit lands.

3. **Road/water/cliff asset production**
   - Generate or commission P0 asset kits first.
   - Ingest into `hmh-coherent-world` or a dedicated Level 1 environment manifest.
   - Add contact sheets and asset verification.

4. **Browser visual QA**
   - Verify roads connect, bridges are readable, farm/town silhouettes are distinct, and desert lanes stay clear.

## Status

This plan now has two implementation layers:

1. **Sketch layout contract — complete locally**
   - `apps/portal/src/hmh-level-one-sketch-layout.mjs`
   - `HMH_CAMPAIGN_LEVELS[Level 1].sketchMapPlan`
   - `tests/hmh-level-one-sketch-layout.test.mjs`

2. **First runtime craft / asset wave — complete locally**
   - `scripts/generate-hmh-level-one-sketch-assets.py`
   - `apps/portal/assets/generated/hmh-coherent-world/sketch-level1/`
   - `apps/portal/assets/generated/hmh-coherent-world/sketch-level1/sketch-level1-asset-manifest.mjs`
   - `docs/game-design/assets/hmh-level-1-sketch-asset-wave-contact-sheet.png`
   - `docs/game-design/hard-money-heroes-level-1-sketch-asset-wave.md`
   - `apps/portal/src/scene-templates.mjs` now exposes sketch-specific road, water, cliff, town, farm, and forest templates.
   - `apps/portal/src/district-generator.mjs` now biases Level 1 district preferences toward those sketch templates.

3. **SBS CC0 base-ground ingestion — complete locally**
   - `scripts/ingest-hmh-sbs-isometric-tiles.py`
   - `apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/`
   - `apps/portal/src/hmh-level-one-ground.mjs`
   - `tests/hmh-level-one-ground.test.mjs`
   - `apps/portal/main.js` now prefers the cleaned SBS Level 1 ground layer beneath authored props/templates.

4. **Original Level 1 polish assets — complete locally**
   - `scripts/generate-hmh-level-one-polish-assets.py`
   - `apps/portal/assets/generated/hmh-coherent-world/level1-polish/`
   - `docs/game-design/assets/hmh-level-1-polish-assets-contact-sheet.png`
   - `apps/portal/src/scene-templates.mjs` now mixes polish assets into forest walls, oasis edges, farms, town fronts, roads, and cliffs.

5. **Original final-paint terrain + animated water — complete locally**
   - `scripts/generate-hmh-level-one-final-paint-ground.py`
   - `apps/portal/assets/generated/hmh-level-one-ground/final-paint/`
   - `docs/game-design/assets/hmh-level-1-final-paint-ground-contact-sheet.png`
   - `apps/portal/src/hmh-level-one-ground.mjs` now prefers original `final-paint/*` tiles while preserving SBS CC0 fallback.
   - `apps/portal/main.js` crops animated terrain spritesheets frame-by-frame for living water/shore motion.

6. **Original final animated environment props — complete locally**
   - `scripts/generate-hmh-level-one-final-animated-props.py`
   - `apps/portal/assets/generated/hmh-coherent-world/level1-final-animated/`
   - `docs/game-design/assets/hmh-level-1-final-animated-props-contact-sheet.png`
   - `apps/portal/src/scene-templates.mjs` now uses animated foliage, reeds, crops, sign, barn, and town-bank props in high-visibility Level 1 templates.
   - `apps/portal/main.js` crops animated coherent-world prop spritesheets frame-by-frame.

The current craft slice creates original repo-owned runtime art and setpiece templates for the sketch, plus a CC0 isometric terrain foundation from the downloaded SBS packs, an original final-paint terrain/animated-water layer, and final animated environment props. It does not yet replace every building/tree/enemy animation with final hand-polished marketing art, but the Level 1 world now has runtime ground tiles, animated water/shore, animated foliage/crops/signage/structure details, roads, farms, towns, cliffs, forest boundaries, and lived-in prop detail wired into gameplay rendering.

## Downloaded asset-library audit

Justin's downloaded terrain/tree/water/building/road/cliff packs were audited in `docs/game-design/hard-money-heroes-downloaded-environment-asset-audit.md`.

Key decision: the Screaming Brain Studios isometric floor/autotile/water packs are the best direct-use candidates because they are true 2:1 isometric tiles and verified CC0. Tree/plant/building/source packs are mostly reference-first due license, camera, or style mismatch. CraftPix/top-down/vector/stock packs should be used as reference or secondary-prop inspiration, not as direct Level 1 base art.
