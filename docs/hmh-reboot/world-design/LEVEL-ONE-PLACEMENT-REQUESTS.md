# Level 1 asset-placement requests

Status: authored reservations, not native runtime adoption. Coordinates, footprint sizes and heights are world units. All rows stand on existing ground at z=0. The exact shape, source GLB/master paths and hashes, facing/scale work, collision policy and dependencies are in `LEVEL-ONE-PLACEMENT-REQUESTS.json`.

| Placement / blocker | District | Anchor | Footprint / height | Classification | Art / native source | Conservative route-edge margin |
|---|---|---|---|---|---|---|
| `relay:west-farmhouse` / `relay-abandoned-farmhouse` | frontier-relay | (330, 1700) | 340 × 240 / 260 | canonical-blocker | `hmh-ld2-62-clapboard-farmhouse` | 539.1 |
| `relay:abandoned-pickup` / `relay-abandoned-pickup` | frontier-relay | (450, 3100) | 230 × 120 / 100 | canonical-blocker | `hmh-ld2-54-rusted-pickup-truck` | 368.4 |
| `relay:old-well` / `unbound` | frontier-relay | (330, 3720) | 120 × 120 / 150 | proposed-solid | `hmh-ld2-80-stone-well-with-winch` | 473.9 |
| `relay:north-hedge` / `unbound` | frontier-relay | (330, 1200) | 350 × 100 / 95 | proposed-solid | `hmh-ld2-75-hedgerow-section` | 741.2 |
| `relay:bus-shelter` / `unbound` | frontier-relay | (480, 4030) | 240 × 120 / 150 | proposed-solid | `hmh-ld2-53-bus-shelter` | 509.9 |
| `yard:town-north-shopfront` / `town-north-shopfront` | liquidation-yard | (10450, 650) | 380 × 300 / 220 | canonical-blocker | `awning-shopfront` | 81.9 |
| `yard:town-north-tenement` / `town-north-tenement` | liquidation-yard | (11150, 650) | 400 × 420 / 260 | canonical-blocker | `ruined-tenement` | 34.0 |
| `yard:town-water-tower` / `town-water-tower` | liquidation-yard | (11550, 1100) | 160 × 160 / 260 | canonical-blocker | `water-tower` | 42.7 |
| `yard:town-fuel-island` / `town-fuel-island` | liquidation-yard | (10800, 3600) | 320 × 280 / 200 | canonical-blocker | `hmh-ld2-64-fuel-station-canopy` | 210.3 |
| `yard:town-east-lean-to` / `town-east-lean-to` | liquidation-yard | (11650, 3050) | 300 × 300 / 180 | canonical-blocker | `corrugated-lean-to` | 90.2 |
| `yard:town-east-tenement` / `town-east-tenement` | liquidation-yard | (11350, 3740) | 360 × 360 / 260 | canonical-blocker | `ruined-tenement` | -2.6 |
| `yard:yard-wreck-row-north` / `yard-wreck-row-north` | liquidation-yard | (10650, 1950) | 180 × 90 / 150 | canonical-blocker | `wrecked-sedan` | 9.5 |
| `yard:yard-wreck-row-south` / `yard-wreck-row-south` | liquidation-yard | (10530, 3075) | 412 × 162 / 150 | canonical-blocker | `wrecked-sedan` | -19.4 |
| `yard:south-warehouse` / `unbound` | liquidation-yard | (10300, 4150) | 400 × 300 / 280 | proposed-solid | `hmh-ld2-63-brick-warehouse` | -22.0 |
| `yard:overturned-bus` / `unbound` | liquidation-yard | (10900, 4260) | 460 × 160 / 110 | proposed-solid | `hmh-ld2-55-overturned-school-bus` | -125.5 |
| `yard:east-chapel` / `unbound` | liquidation-yard | (11750, 500) | 320 × 300 / 350 | proposed-solid | `hmh-ld2-65-steepled-chapel` | 410.9 |
| `yard:dead-signal` / `unbound` | liquidation-yard | (10200, 900) | 40 × 40 / 180 | proposed-solid | `hmh-ld2-52-traffic-light-mast` | 45.7 |
| `hashwood:hashwood-north-tree-line` / `hashwood-north-tree-line` | hashwood | (7000, 620) | 2028 × 128 / 180 | canonical-blocker | `hmh-ld2-72-tall-conifer-trio` | -541.6 |
| `hashwood:hashwood-south-tree-line` / `hashwood-south-tree-line` | hashwood | (7000, 4100) | 2028 × 128 / 180 | canonical-blocker | `hmh-ld2-72-tall-conifer-trio` | -89.8 |
| `hashwood:hashwood-thicket-nw` / `hashwood-thicket-nw` | hashwood | (6375, 1440) | 478 × 248 / 180 | canonical-blocker | `hmh-ld2-75-hedgerow-section` | 43.6 |
| `hashwood:hashwood-thicket-south` / `hashwood-thicket-south` | hashwood | (6925, 3125) | 578 × 278 / 180 | canonical-blocker | `hmh-ld2-72-tall-conifer-trio` | 64.5 |
| `hashwood:hashwood-clearing-edge-west` / `hashwood-clearing-edge-west` | hashwood | (6755, 2655) | 262 × 362 / 180 | canonical-blocker | `hmh-ld2-74-uprooted-root-ball` | 41.2 |
| `hashwood:hashwood-clearing-edge-east` / `hashwood-clearing-edge-east` | hashwood | (7575, 2275) | 262 × 362 / 180 | canonical-blocker | `hmh-ld2-72-tall-conifer-trio` | -31.3 |
| `hashwood:hashwood-gate-thicket` / `hashwood-gate-thicket` | hashwood | (6100, 3225) | 428 × 278 / 180 | canonical-blocker | `hmh-ld2-75-hedgerow-section` | 126.4 |
| `hashwood:hollow-stump` / `unbound` | hashwood | (6200, 3670) | 160 × 140 / 90 | proposed-solid | `hmh-ld2-73-hollow-stump-shelf-fungus` | 719.1 |
| `hashwood:root-ball` / `unbound` | hashwood | (7750, 1500) | 220 × 150 / 140 | proposed-solid | `hmh-ld2-74-uprooted-root-ball` | 514.7 |

Margins are lower bounds from a circumscribed footprint circle, measured against route ribbons including the new ground requests. Negative values on retained legacy geometry do not establish an actual collision failure; canonical actor sweeps and the dedicated tests are the source of traversal truth. New/proposed structures also pass exact footprint-versus-ribbon checks with an additional 24-unit margin. These measurements do not certify projected canopy/body occlusion.

## Ground requests

| ID | District | Width | Authored points | Treatment |
|---|---|---|---|---|
| `relay:main-road-wear` | frontier-relay | 192 | (800, 2400) → (1250, 2750) → (1700, 2450) | worn teal-grey packed earth with sparse cracked asphalt remnants |
| `relay:training-path` | frontier-relay | 144 | (1250, 3200) → (900, 3450) | compacted dirt; no curb geometry |
| `yard:commercial-street` | liquidation-yard | 192 | (10200, 1070) → (11300, 1070) | cracked asphalt with worn shoulders; use B2-47 as surface reference, flatten slab height |
| `yard:commercial-connection` | liquidation-yard | 144 | (10650, 1250) → (10650, 1070) | cracked asphalt joining existing escape loop |
| `yard:south-service-lane` | liquidation-yard | 144 | (11350, 3400) → (11700, 3430) → (11750, 4450) → (10200, 4450) | worn asphalt with irregular gravel shoulders |

## Required pairing

Move `camp:relay-picket` from (1400, 3000, radius 360) to (900, 3450, radius 360) with the world arena change. Hermes owns that camp table and all atlas/native manifests. Other existing town blockers/manifest placements stay put. All proposed-solid rows require a later paired world/art change; this packet only activates the two new opening blockers in its isolated world-data candidate.

## Batch 2 library disposition

| Source key | Use | Reason |
|---|---|---|
| `hmh-ld2-41-stone-arch-bridge-span` | reserve | Reserve crossing kit until deck/rail/facing calibration against existing bridge and water contracts; culvert rear is capped |
| `hmh-ld2-42-timber-trestle-bridge-section` | reserve | Reserve crossing kit until deck/rail/facing calibration against existing bridge and water contracts; culvert rear is capped |
| `hmh-ld2-43-steel-truss-bridge-span` | reserve | Reserve crossing kit until deck/rail/facing calibration against existing bridge and water contracts; culvert rear is capped |
| `hmh-ld2-44-rope-plank-suspension-span` | reserve | Reserve crossing kit until deck/rail/facing calibration against existing bridge and water contracts; culvert rear is capped |
| `hmh-ld2-45-concrete-box-culvert` | reserve | Reserve crossing kit until deck/rail/facing calibration against existing bridge and water contracts; culvert rear is capped |
| `hmh-ld2-46-wooden-jetty-dock` | reserve | Reserve crossing kit until deck/rail/facing calibration against existing bridge and water contracts; culvert rear is capped |
| `hmh-ld2-47-cracked-asphalt-road-section` | reference-only | Ground-material reference for Yard streets only; do not import raised slab as collision |
| `hmh-ld2-48-road-guardrail-section` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-49-concrete-jersey-barrier` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-50-highway-overpass-pillar` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-51-road-sign-gantry` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-52-traffic-light-mast` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-53-bus-shelter` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-54-rusted-pickup-truck` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-55-overturned-school-bus` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-56-armored-transport-van` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-57-flatbed-semi-trailer` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-58-burnt-out-hatchback` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-59-tracked-excavator` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-60-mining-haul-truck` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-61-abandoned-motorcycle` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-62-clapboard-farmhouse` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-63-brick-warehouse` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-64-fuel-station-canopy` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-65-steepled-chapel` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-66-concrete-bunker-entrance` | reserve | Closed exterior/blocked entrance; no new interiors or progression in this slice |
| `hmh-ld2-67-railway-signal-box` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-68-quonset-hut` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-69-stone-watermill` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-70-dead-oak-broken-limbs` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-71-weeping-willow` | reserve | Reserve willow for later water-edge composition; 437867-triangle master must be baked, not loaded into runtime |
| `hmh-ld2-72-tall-conifer-trio` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-73-hollow-stump-shelf-fungus` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-74-uprooted-root-ball` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-75-hedgerow-section` | placement-request | Selected in the placement table; requires Hermes native integration |
| `hmh-ld2-76-rock-arch-formation` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-77-collapsed-mine-entrance` | reserve | Closed exterior/blocked entrance; no new interiors or progression in this slice |
| `hmh-ld2-78-railway-track-section` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-79-stacked-log-pile` | reserve | Verified library reserve; not needed to establish this slice without visual clutter |
| `hmh-ld2-80-stone-well-with-winch` | placement-request | Selected in the placement table; requires Hermes native integration |
