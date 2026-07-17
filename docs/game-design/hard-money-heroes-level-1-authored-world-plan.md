# Hard Money Heroes — Level 1 Authored World Plan

Status: active work plan for `lester-blaster`
Date: 2026-06-19

## Confirmed model

Justin's 2026-06-19 brief is treated as approval for the hybrid model:

- **Authored macro**: fixed district graph, road spine, rivers/culverts, skyline cues, POI spurs, and city seam.
- **Procedural micro**: spawn director, prop scatter, pickups, elite composition, and filler between landmarks.

This preserves roguelite replay while making Level 1 read as handcrafted instead of noise-filled.

## Canon reconciliation lock

- **Old Level 1**: The Slums / Underchain District.
- **New Level 1**: Crypto Wasteland.
- **Neon city / financial-core material** shifts to **Level 2: Litecoin City**.
- Persisted IDs stay unchanged.

## Work slices

1. **Canon + planning docs**
   - Add a reconciliation note and migration table.
   - Record the macro graph, POIs, and enemy roster in source data.
2. **Macro graph runtime metadata**
   - Main spine: desert approach -> ghost town -> country road -> residential edge -> city threshold.
   - Optional north/south shoulder loops.
   - POI spurs: Old Hashrate Camp, Rugpull Gulch, Dry Forest & Cave, Crossroads Trading Post, Mesa Overlook, Oasis Lakeside.
3. **Authored scene templates**
   - Add POI-specific template anchors so the world contains recognizable hand-built areas instead of only generic fillers.
4. **Enemy / animation production spec**
   - Add the wasteland roster with telegraph-frame minimums, AI pattern, sprite notes, and counterplay.
5. **Verification**
   - Targeted tests for campaign metadata, district graph branching, POI metadata, and route kinds.
   - Then broader runtime/test pass.

## Acceptance bar for this slice

- Level 1 metadata clearly reads as Crypto Wasteland.
- District graph exposes a visible main spine with optional POI spurs.
- POIs have telegraph, mini-boss seed, and reward category.
- Enemy gameplay roles remain intact, while visible runtime actors use only authored human or zombie silhouettes; legacy animal/mech IDs remain compatibility keys.
- No persisted IDs are changed.
