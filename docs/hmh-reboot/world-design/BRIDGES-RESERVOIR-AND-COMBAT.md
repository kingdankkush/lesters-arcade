# Level 1: bridges, reservoir and combat routes

This authored candidate follows the opening/routes packet and implements the owner's newer rule: water blocks traversal except across a physical bridge. It is pending paired native-art integration. The earlier packet and its source-asset requests remain immutable historical submissions; this document describes the subsequent world delta.

## Exploration and combat composition

| District | Open combat space | Tighter movement or elevation | Visual identity |
|---|---|---|---|
| Frontier Relay | Protected clearing and the relocated radius-360 training floor | Fence gate, depot edge and side cache approach | Ruined rural settlement, farmhouse, abandoned pickup, hedges |
| Rugpull Ravine | Radius-420 ambush bowl | Existing legal ramp to the 64-unit overlook and authored descent | Layered escarpments, weathered grit and cliff shoulders |
| Liquidity Crossing | Radius-420 eastern combat space | Two bridges, a 144-unit shore route, an 80-unit compound passage | River, southern reservoir, fuel compound and old pumping station |
| Hashwood | Radius-460 clearing | Winding forest edges and existing continuous root banks | Uneven conifer crowns, deadwood and readable canopy breaks |
| Mining Camp | Radius-500 work yard | Existing ramp to the 48-unit loader deck, fences and shack row | Machinery, timber, gravel and industrial silhouette |
| Liquidation Yard | Radius-620 final combat floor | Commercial frontage, preserved eastern alley and southern service street | Shops, tenements, new workers duplex and wrecked vehicles |

The larger arena circles are existing spaces, not newly claimed uninterrupted empty floors. Existing cover, encounter scheduling, actor scale, seeds, enemy anchors, POIs and effects remain unchanged. Native visibility, pursuit behavior and the fun of the combat still need integrated playtesting.

## Northern footbridge replaces the ford

The stable ID `crossing-shallows` now denotes a bridge surface at z=16, x=4500..5000, y=845..1105. Its old water/ford appearance must be replaced. A west ramp at x=4400..4500 and an east ramp at x=5000..5100 join dry ground to the deck. Both ramps share the deck's y extent. The existing crossing entry/exit and route-node IDs remain stable.

Physical rails use capsules at y=825 and y=1125, x=4510..4990, radius14 and maxZ72. The supplied original Blender timber bridge has a matching deck, approach wedges, posts and rails. Its source origin is (4750,975), with100 world units per Blender meter. This is an explicit source conversion, not a global engine scale change. Water outside the two bridge decks stays nonwalkable. The original main bridge is preserved.

The public stable legacy ID is deliberately retained to avoid a migration; readers must use surface kind/geometry rather than interpret the word “shallows.” Hermes must update any hardcoded ford material, speed, terrain band or visual test assumptions when adopting the new bridge.

## Southern reservoir and two approaches

`crossing-south-reservoir` is the supplied 12-vertex water polygon, at groundZ=-24 and waterLevel4, consistent with the existing river. It adds no swim, damage or reward mechanic. The renderer must union/clip its visible shoreline against the existing river; a standalone closed island texture would draw a false bank through the river.

`crossing-reservoir-loop` adds a 144-unit dry promenade from the eastern bridge abutment, around the western side of the fuel compound, along the north/east shore and to the pump court. The court is a deliberate exterior turnaround; the pumping station has no enterable interior. `crossing-reservoir-cut-through` supplies an alternate80-unit circuit between the wreck row and forest bank, reconnecting the shore to the existing eastern main-route node. It permits movement across the full80-unit corridor, giving a radius24 hero16 units of floor margin on each side. The broader shore route is also tested with an additional24-unit margin outside its full ribbon.

The tight passage offers a shorter, more constrained approach. The western route offers more lateral room. Neither route changes encounter budgets or creates a new progression requirement. Existing ramps and one-way drops keep their original rules.

## New source bodies and placement dependencies

| Stable world ID | Native source key | Anchor | Footprint | Max Z |
|---|---|---:|---:|---:|
| ravine-south-escarpment-outcrop | hmh-cx3-01-stratified-escarpment |3350,4340|480×300|319|
| yard-residential-duplex-south | hmh-cx3-02-workers-duplex |11600,4645|204×190|195|
| crossing-lakeside-pumphouse | hmh-cx3-03-lakeside-pumphouse |5800,4490|220×185|184|
| crossing-shallows + ramps/rails | hmh-cx3-05-timber-footbridge |4750,975|700×324 source envelope; individual canonical footprints above|72|

The duplex was moved south after a broad check found it obstructed the existing service alley. The final lot clears the y=4450 street and world boundary. Do not use the earlier11690,4110 proposal. The footprints were then reconciled to the measured native proportions using uniform source scales: cliff480 at yaw0, duplex203 at yaw90, pumphouse220 at yaw270. The rounded physical envelope differs from the native bounds by less than1.2 world units in each dimension. Read `CX3-PLACEMENT-CALIBRATION.json`. These are measured coarse envelopes; native grounded silhouettes, roof overhang and collision-edge behavior still need integrated visual review. Existing baked town coordinates are not moved.

`hmh-cx3-04-reservoir-terrain` is an editable, low-poly source assembly with the exact water polygon, shoreline treatment and a separate reusable bank sample. Its static opaque water texture is a material reference, not finished animated water or a substitute for the canonical surface. The sample bank is not a placed collision body.

## Validation and adoption

The dedicated water/bridge checks cover blocked unbridged crossings, dry spawn/POI anchors, physical rail containment, both bridge directions, the full promenade ribbon, the complete tight passage and arena clearance. The existing route test now walks all nine authored routes and both crossings.123 focused checks passed. No shared engine, runtime renderer, spawn schedule or release file was changed by this packet.

Five final GLBs have embedded textures, explicit tangents and zero Khronos errors/warnings; five packed masters were saved/reopened with source fingerprints checked. The26 desktop/mobile candidate frames include recorded ground pivots and four directions for each new Tripo prop. The512-cell atlas uses16MiB decoded; the256-cell atlas uses4MiB. These are selectable source candidates, not permission to load both tiers at once.

The square frames use the receiving source's45-degree projection helpers. The wide bridge card has explicit aspect-aware fitting and a recorded normalization scale for source-unit lighting. CPU Cycles shading differs from the receiving EEVEE recipe: native lighting/scale/occlusion and final atlas adoption remain Hermes review gates. Dense GLBs and masters stay outside the game download. The finished game must be evaluated on the current integrated candidate before any AAA, device-performance or release claim.
