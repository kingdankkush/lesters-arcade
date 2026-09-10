# Level 1 authored world-design packet

This packet contains a small executable world-data change and a larger placement proposal. Native adoption and game/browser acceptance remain with Hermes. It does not activate the unadopted placements, new interiors, secrets or Level 2.

## Frontier Relay

Read `FRONTIER-OPENING.md` for the implemented opening. The preserved spawn is in Frontier Relay; Liquidation Yard remains the sixth district. The opening uses a ruined settlement vocabulary without renaming districts or reordering progression.

## Legal optional routes

The Ravine and Mining triangular optional routes cut across the side edges of their ramps. Canonical elevation rejects these drops; changing engine thresholds would conceal a layout defect. Both routes now use existing ramp-entry, upper-road/deck and descent nodes before returning through their existing southern node. No node coordinates or surface metadata changed, and the main route is untouched. Route-edge arrays rebuild normally from the new ordered node lists.

All seven routes are tested segment by segment with a radius-24 actor, canonical collision and elevation, and walking steps no longer than four units (240 units/second at 60 Hz). Both authored crossings are also tested outward and back. This proves authored geometric traversal; it is not a combat, controller or runtime performance certification.

## Liquidation Yard: a town around the fighting floor

Preserve the north shopfront, north tenement and water tower as the commercial neighborhood. A 192-wide frontage street at y=1070 joins the existing northern escape loop at (10650, 1250). It runs below the buildings and ends before the water tower. Sideways wear and sparse debris should establish shop entrances; the source buildings do not supply enterable interiors.

Keep the existing fuel island and market below the arena. The Batch 2 fuel-station canopy is a composite-art request over the existing island; retain its pump asset and collision. Calibrate supports and overhead occlusion before adoption. Do not treat the canopy footprint as automatically walkable.

The east tenement and lean-to remain the residential edge, preserving the current medbay-cache approach. A 144-wide service lane follows the exterior eastern side down to y=4450, then runs west behind two proposed lots: a brick warehouse and an overturned bus. This is authored road dressing and a future solid-placement reservation; it adds no route-graph progression or trigger. A distant northeast chapel gives the street a recognizable roofline while the extraction tower remains the canonical landmark.

All existing town blocker coordinates remain unchanged. Their baked `townPlacements` remain authoritative until Hermes makes a paired manifest change. The JSON table explicitly distinguishes existing collision-backed art from proposed solids; never display an unbound warehouse/bus as a traversable solid-looking object.

## Hashwood: uneven crowns, readable boundaries

Seven existing tree-bank blockers receive an authored canopy-composition request. Alternate crown radius and height rather than drawing a level continuous green roof. Use the final conifer-trio, hedgerow and root-ball sources as appropriate; their generation-relative scale needs calibration. Individual lobes are visual composition guides, not new collision circles or destructibles.

Preserve a continuous root/underbrush bank across each entire existing capsule. The canopy may break above it, but every physical edge must still have a visible cause. Existing blockers, path clearances, clearings and the shrine stay intact. A proposed low hollow stump on the south shoulder and root plate on the northeast shoulder add close-range shape without adding lore/loot mechanics.

Keep tall crowns clear of actor/POI sightlines when projected through the actual camera. Floor-footprint tests cannot prove elevated sprite occlusion. The dense willow is reserved for a later water-edge slice; its 437,867-triangle selected master should be baked, not directly loaded into the game.

## Ground materials and transitions

The five ground requests are flat, projection-only treatments on existing ground. Use the cracked-asphalt source as a reference for irregular wear, never as an uncalibrated raised slab. Vary patch sizes and orientation; avoid a repeated square grid. Blend Frontier earth into Ravine grit, river-bank wet ground into forest litter, and Mining gravel into Yard asphalt through the existing material system. These transition material requests introduce no new elevation bands or walkability rules.

Preserve bright actor/projectile contrast and the existing biome palettes. The environment should look weathered, not uniformly saturated. Static model signal lenses, panes and windows are not working lights or finished transparent glass.

## Integration sequence

1. Review the scoped world patch and the first two dedicated test files. Pair the opening arena with its camp anchor and the two new solids with matching native art. Preserve the current camera repair and other mixed work.
2. Register the batch-qualified native sources through Hermes's pipeline. Use the delivery GLBs/selected packed masters and exact source hashes; do not substitute raw provider models. No model source was modified by this packet.
3. Adopt the Yard and Hashwood request groups one at a time. Proposed-solid rows require paired world geometry, art and traversal checks before activation. Existing town art stays at its current manifest coordinates unless explicitly moved together.
4. Register the new dedicated tests in any explicit shared test/syntax inventories, regenerate owned assets, and perform canonical desktop/mobile play, world-tour and performance checks on the exact integrated candidate.
5. Accept Level 1 before placing new reward/lore triggers or planning Level 2. Current POIs remain unchanged and useful as visual opportunities; this packet does not silently add progression.

`LEVEL-ONE-PLACEMENT-REQUESTS.json` is the machine-readable handoff, with source paths/hashes and a disposition for all 40 Batch 2 models. `LEVEL-ONE-PLACEMENT-REQUESTS.md` is its readable placement table. The standalone review map in the submission is design evidence, not a game screenshot or release receipt.
