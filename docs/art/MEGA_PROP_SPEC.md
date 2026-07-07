# HMH Mega-Prop Specification

Applies to WO-102 through WO-107 for Hard Money Heroes Level 1. This spec replaces small random prop assembly with large pre-rendered set pieces that are generated, integrated, rendered, captured, and verified in the same work order.

## Why mega-props

The previous art passes failed because high-effort assets were generated but not visibly consumed by the runtime. Mega-props fix the most visible Level 1 quality problem by making each major location read as one authored scene instead of a cluster of mismatched tiles.

A mega-prop is a large transparent pixel-art diorama that includes the main object, baked local lighting, contact grime, ground apron, and soft shadow as one composition. Examples: storefront block with signage and awning, forest rock outcrop with cliff face, farm barn with silo and fence apron.

## Runtime layers

1. Ground layer: seamless/painterly textures, biome transitions, roads, water patterns.
2. Mega-prop layer: large pre-rendered scene objects with collision polygons and optional draw-over slices.
3. Actor/FX layer: heroes, enemies, pickups, bullets, combat VFX, HUD.

## Asset contract

Each asset entry must declare:

- `id`: stable runtime key.
- `src`: browser path to a transparent PNG.
- `canvas`: source pixel dimensions.
- `density`: `1.0` unless a work order explicitly documents a temporary PixelLab source-size limitation.
- `groundContactY`: source-image y row where the asset touches the ground plane.
- `shadowDirection`: constant `south-east`.
- `bakedShadow`: must be true for accepted mega-props.
- `footprintTiles`: approximate ground footprint `{ w, h }` in Level 1 world tiles.
- `collisionPolygons`: one or more convex polygons in local tile coordinates around the physical body, not the whole image.
- `bodyKind`: `building`, `cliff`, `farmstead`, `tree-cluster`, `dock`, `arena-landmark`, or `gate`.
- `overSlice`: optional rectangle for awnings/canopies/tree canopies that should draw over actors.
- `animatedAnchors`: optional named anchors for steam, sign flicker, water glint, windmill blades, fireflies, etc.
- `r1Observation`: exact seed/location/camera observation required before the asset counts as done.

## PixelLab production note

PixelLab `create_map_object` currently caps single transparent objects below the final 768px target. WO-102 may use PixelLab transparent candidates as the source of truth, then integrate at authored screen size through `footprintTiles` without creating placeholder art. If a 768px native source is required for a later family, use a separate bake-off path and document the selected generator in the manifest.

## Done means visible

No mega-prop is complete because it exists in `assets/generated`. Done requires:

1. Candidate sheet exists.
2. Winner is integrated into a runtime manifest.
3. The runtime renderer resolves that manifest key.
4. Seed `1337` capture shows the asset on screen at its exact planned location.
5. Collision proof confirms the player cannot walk through solid body areas and is not blocked by empty transparent apron.
6. Superseded small/proxy art is de-referenced in the same commit where the replacement becomes visible.

## WO-102 proof trio

| Asset | Planned role | First runtime placement | R1 observation |
| --- | --- | --- | --- |
| `wo102-noodle-bar-storefront` | city/storefront block with awning over-slice | ghost town main street or city threshold storefront beat | At seed 1337, near grid `40,2`, a neon storefront block with baked wet-ground shadow replaces the old tiny saloon/storefront cluster. |
| `wo102-forest-rock-outcrop` | two-level forest cliff/boundary rock | country road forest/ford bend | At seed 1337, near grid `57,2`, the forest boundary reads as a composed rock/cliff wall rather than scattered small rocks/trees. |
| `wo102-farm-barn-silo-cluster` | farmstead landmark | residential/farm loop | At seed 1337, near grid `83,4`, a barn+silo cluster with fence apron and SE baked shadow anchors the farm zone. |
