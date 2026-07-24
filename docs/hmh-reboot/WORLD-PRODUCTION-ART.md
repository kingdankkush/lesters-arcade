# Level 1 production world art

`reboot-15` replaces the default flat district fills, visible collision primitives, and always-on 64-pixel grid with deterministic Pixi vector world art for **Crypto Wasteland: Forked Frontier**.

## Runtime identity

- Classification: `production-art`
- Telemetry: `production-vector-world-v1`
- Runtime authority: `projection-only`
- World: `forked-frontier`, 12,000 × 4,800 authored world units
- Districts: 6
- Authored blocker projections: 11
- Landmarks: 6
- Bounded ambient/hazard particles: 50 per rendered frame

World art reads the immutable Level 1 world contract, camera, ground query, and simulation tick. It does not own or mutate collision, elevation, traversal, encounters, spawning, combat, damage, scoring, persistence, profiles, bridge messages, wallets, settlement, achievements, analytics, or Web3 state.

## District materials

| District | Production motif | Material layers |
|---|---|---|
| Frontier Relay | Relay circuits | Packed earth, relay traces, signal pads |
| Rugpull Ravine | Forked strata | Red rock, fracture lines, salvage scrap |
| Liquidity Crossing | Liquidity ripples | Wet bank, flow lines, bridge seams |
| Hashwood | Hash-ring roots | Forest floor, root rings, spore patches |
| Mining Camp | Ore grid | Crushed ore, loader tracks, warning marks |
| Liquidation Yard | Margin grid | Industrial slab, liquidation grid, warning chevrons |

Ramps and ledges inherit their district palette. Water, shallows, and the Proof-of-Work bridge retain dedicated material identities that remain aligned with the authoritative elevation surfaces.

## Blockers, props, and landmarks

Every `LEVEL_ONE_WORLD.blockers` visual kind has a production kit: fence, cliff, bridge rail, dense trees, machinery, building, and containers. Art is drawn from the same authored shapes used to create collision blockers, preserving visible/physical agreement.

Destructible cover and explosive zones are visible props, but their art never changes authoritative hit points, chain caps, damage, or collision.

The six authored landmark kinds have distinct silhouettes and at least three identity cues: relay signal tower, forked cliff, proof bridge, Hashwood beacon tree, mining headframe, and liquidation extraction tower.

## Interactions and effects

All POI hooks and hazard kinds have visible production icons. Hazards use deterministic pulse rings and bounded particle fields. Particle positions derive only from immutable feature ID, authored anchor, tick, count, and radius. The public resolver rejects empty IDs, invalid coordinates, negative ticks, and counts above 64.

## Shader-state contract

The vector renderer exposes deterministic tick-derived states for:

- `water-shimmer-v1`
- `hazard-pulse-v1`
- `beacon-glow-v1`
- `edge-vignette-v1`

These are presentation values, not custom gameplay clocks. Repeated calls with identical tick and district return identical frozen values.

## Runtime and browser verification

The production renderer uses nine ordered layers: terrain, routes, surfaces, details, blockers, landmarks, interactions, particles, and lighting. The prior gray grid is debug-only.

Browser certification covers:

- clean production-mode desktop and mobile screenshots;
- all six district tour captures;
- mobile controls and compact two-line combat status;
- world telemetry on desktop, mobile, and Proof-of-Work bridge;
- all six enemy families, elite overlays, death projection, Liquidator boss, combat, and minimap integration;
- zero console or page errors.
